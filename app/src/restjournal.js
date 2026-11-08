// Skannade restjournaler (runda 10, r4, Sussa 3.1.10.1 och 3.1.10.2): pappersjournaler som skannas in, knyts till
// patienten och visas i journalens kronologi tillsammans med migrerad historik och ny dokumentation.
//
// Systemet är experten:
//   - Den som skannar väljer bara filen. Systemet läser textlagret i en skannad PDF (det som skannerns OCR har lagt in),
//     föreslår dokumenttypen ur rubrikerna och perioden ur datumen i texten, och sätter vårdenheten, tiden och den som
//     skannade. Förslagen kan ändras innan dokumentet sparas.
//   - Systemet kontrollerar identiteten: står ett personnummer i texten som inte är patientens stoppas dokumentet, och
//     hittar systemet inget personnummer, som i en bild utan text, ska den som skannar bekräfta att dokumentet gäller
//     patienten.
//   - Samma fil skannas inte in två gånger för patienten. Ett dokument som har skannats till fel patient makuleras med
//     orsak och raderas aldrig.
//   - Dokumentet visas i översiktens tidslinje vid periodens slut, märkt som skannad pappersjournal, och texten är
//     sökbar i sökfältet i journalen.
//
// Behörighet. En restjournal skannas in av vårdadministratören, läkaren eller sjuksköterskan (handlingen restjournal)
// och läses som journalen (las_journal), med inre sekretess, spärr och loggning på vårdenheten där den skannades.
// Vårdadministratören skannar men läser inte dokumentet efteråt. OCR av bilder görs inte i demon: en PNG eller JPEG
// sparas som bild, utan text.
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import { tolkaMedia } from './bilder.js';
import { tabell, finns, personNamn, enhetKort, textFalt, iso, bunden, andraRad, vardkontaktFor } from './specialist-hjalp.js';

export const LAS = 'las_journal';
export const SKRIV = 'restjournal';
export const DOKUMENTTYPER = tabell({
  journal: 'Journalanteckningar', epikris: 'Epikriser', remiss: 'Remisser och svar', provsvar: 'Provsvar', lakemedel: 'Läkemedelslistor', ovrigt: 'Övrigt',
});
// Orden som systemet känner igen dokumenttypen på. Ordningen avgör när flera passar.
const TYPORD = [
  ['epikris', /epikris/i], ['remiss', /remiss|remissvar/i], ['provsvar', /provsvar|laboratori|analys/i], ['lakemedel', /läkemedelslista|läkemedelsordination|ordinationslista/i],
  ['journal', /journalanteckning|daganteckning|anteckning|mottagningsbesök|inskrivning/i],
];
export const ORSAKER = tabell({ fel_patient: 'Skannad till fel patient', dubblett: 'Skannad två gånger', olasbar: 'Skanningen går inte att läsa' });
export const MAX_PER_PATIENT = 30;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS restjournaler (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, dokumenttyp TEXT NOT NULL, period_fran TEXT,
  period_till TEXT, ursprung TEXT, namn TEXT NOT NULL, typ TEXT NOT NULL, storlek INTEGER NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL, text TEXT,
  text_ofullstandig INTEGER NOT NULL DEFAULT 0, identitet TEXT NOT NULL, skannad TEXT NOT NULL, skannad_av TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'journal', makulerad TEXT, makulerad_av TEXT, makulerad_orsak TEXT,
  CHECK (status IN ('journal', 'makulerad')), CHECK (identitet IN ('personnummer', 'bekraftad'))
);
CREATE INDEX IF NOT EXISTS ix_restjournaler_patient ON restjournaler (patient_id);
CREATE TRIGGER IF NOT EXISTS restjournaler_andras_ej BEFORE UPDATE OF enhet_id, dokumenttyp, period_fran, period_till, ursprung, namn, typ, storlek, sha256, data, text, text_ofullstandig, identitet, skannad, skannad_av ON restjournaler
  BEGIN SELECT RAISE(ABORT, 'En skannad restjournal ändras inte. Makulera den och skanna in den igen.'); END;
CREATE TRIGGER IF NOT EXISTS restjournaler_makuleras_en_gang BEFORE UPDATE OF status ON restjournaler WHEN OLD.status <> 'journal'
  BEGIN SELECT RAISE(ABORT, 'Restjournalen är redan makulerad.'); END;
CREATE TRIGGER IF NOT EXISTS restjournaler_raderas_ej BEFORE DELETE ON restjournaler BEGIN SELECT RAISE(ABORT, 'En skannad restjournal raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }
export const finnsTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'restjournaler'").get());

export function restjournalRad(db, id) {
  sakra(db);
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM restjournaler WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Restjournalen finns inte.', 'saknas');
  return r;
}

// ---- Textlagret i en PDF -----------------------------------------------------------------------------------------
// En skanner med OCR lägger texten i PDF:en som textobjekt. Systemet läser strängarna i Tj och TJ ur varje innehållsström,
// också komprimerade med FlateDecode. Inget körs ur filen, och en ström som inte går att läsa hoppas över.
// Säkerhetsgranskningen i runda 10: en liten fil kan ha en ström som packas upp till hundratals MB. Varje ström packas
// därför upp till högst perStrom byte, alla strömmar i filen delar budgeten totalt, högst strommar strömmar läses och
// läsningen slutar vid tecken tecken. Når filen en gräns är texten ofullständig, men dokumentet sparas ändå.
export const PDF_GRANS = Object.freeze({ perStrom: 200_000, totalt: 1_000_000, strommar: 50, tecken: 20_000 });
const PDF_ESC = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
function pdfStrang(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, x) => (PDF_ESC[x] ?? String.fromCharCode(parseInt(x, 8) & 0xff)));
}
export function pdfText(buf, grans = PDF_GRANS) {
  const s = buf.toString('latin1');
  const rader = [];
  let pos = 0, kvar = grans.totalt, tecken = 0, lasta = 0, ofullstandig = false;
  while (true) {
    const start = s.indexOf('stream', pos);
    if (start < 0) break;
    const huvud = s.slice(Math.max(0, start - 300), start);
    const fran = s[start + 6] === '\r' ? start + 8 : start + 7;
    const slut = s.indexOf('endstream', fran);
    if (slut < 0) break;
    pos = slut + 9;
    if (lasta >= grans.strommar || kvar <= 0 || tecken >= grans.tecken) { ofullstandig = true; break; }
    lasta++;
    let data = buf.subarray(fran, slut);
    if (/\/FlateDecode/.test(huvud.slice(huvud.lastIndexOf('<<')))) {
      try { data = inflateSync(data, { maxOutputLength: Math.min(grans.perStrom, kvar) }); } catch (e) {
        // En ström som packas upp till mer än gränsen läses inte alls, och texten är ofullständig.
        if (e?.code === 'ERR_BUFFER_TOO_LARGE' || e instanceof RangeError) ofullstandig = true;
        continue;
      }
    } else if (data.length > Math.min(grans.perStrom, kvar)) { ofullstandig = true; continue; }
    kvar -= data.length;
    const t = data.toString('latin1');
    if (!/\b(Tj|TJ)\b/.test(t)) continue;
    for (const m of t.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:\\.|[^\]])*)\]\s*TJ/g)) {
      const rad = m[1] != null ? pdfStrang(m[1]) : [...m[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map(x => pdfStrang(x[1])).join('');
      rader.push(rad);
      tecken += rad.length + 1;
      if (tecken >= grans.tecken) break;
    }
  }
  const text = rader.join('\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim();
  if (text.length > grans.tecken) ofullstandig = true;
  return { text: text.slice(0, grans.tecken), ofullstandig };
}

// ---- Systemets förslag ur texten ------------------------------------------------------------------------------------
const giltigt = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
export function datumI(text) {
  const ut = new Set();
  for (const m of String(text ?? '').matchAll(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g)) if (giltigt(`${m[1]}-${m[2]}-${m[3]}`)) ut.add(`${m[1]}-${m[2]}-${m[3]}`);
  return [...ut].sort();
}
// Personnummer i texten, som de tio sista siffrorna (ÅÅMMDDNNNN). Datum med bindestreck räknas inte.
export function personnummerI(text) {
  const ut = new Set();
  for (const m of String(text ?? '').matchAll(/(?<![\d-])(?:(?:19|20)(\d{6})|(\d{6}))[-+]?(\d{4})(?![\d-])/g)) ut.add(`${m[1] ?? m[2]}${m[3]}`);
  return [...ut];
}
export function forslag(text, nu = new Date()) {
  const t = String(text ?? '');
  const typ = TYPORD.find(([, r]) => r.test(t))?.[0] ?? (t ? 'journal' : 'ovrigt');
  const idag = iso(nu).slice(0, 10);
  const datum = datumI(t).filter(d => d <= idag);
  return { dokumenttyp: typ, periodFran: datum[0] ?? null, periodTill: datum.at(-1) ?? null, personnummer: personnummerI(t) };
}

// Identiteten: ett personnummer i texten ska vara patientens. Utan personnummer krävs att den som skannar bekräftar.
function identitet(p, pnr, bekraftat) {
  const egen = String(p.personnummer).slice(-10);
  if (pnr.length && !pnr.includes(egen)) {
    throw new Fel(409, 'Personnumret i dokumentet är inte patientens. Kontrollera att du har öppnat rätt patient och att dokumentet gäller patienten. Ingenting är sparat.', 'annan_patient');
  }
  if (pnr.includes(egen)) return 'personnummer';
  if (bekraftat !== true) {
    throw new Fel(400, 'Systemet hittade inget personnummer i dokumentet. Bekräfta att dokumentet gäller patienten innan det sparas.', 'bekrafta', { falt: ['bekraftat'] });
  }
  return 'bekraftad';
}

function lasFil(body) {
  const fil = tolkaMedia(body.fil);
  const { text, ofullstandig } = fil.typ === 'application/pdf' ? pdfText(fil.buf) : { text: '', ofullstandig: false };
  return { ...fil, text, ofullstandig, sha256: createHash('sha256').update(fil.buf).digest('hex') };
}

// Samma fil för patienten, bland det som inte ligger på en spärrad vårdenhet, så att svaret inte röjer en spärrad restjournal.
function redanSkannad(atk, sha) {
  return atk.db.query("SELECT enhet_id FROM restjournaler WHERE patient_id = ? AND sha256 = ? AND status = 'journal'").all(atk.patientId, sha)
    .some(r => { const p = atk.prova(SKRIV, { enhet_id: r.enhet_id }); return p.tillaten || p.krav === 'kraver_val'; });
}

export const dokumenttyperUt = () => Object.entries(DOKUMENTTYPER).map(([id, text]) => ({ id, text }));

// POST /api/patient/:id/restjournaler/tolka { fil }: systemets förslag, utan att något sparas.
export function tolka(atk, p, body = {}, nu = new Date()) {
  atk.krav(SKRIV);
  const fil = lasFil(body);
  const f = forslag(fil.text, nu);
  const egen = String(p.personnummer).slice(-10);
  return {
    namn: fil.namn, typ: fil.typ, storlek: fil.buf.length, sha256: fil.sha256, harText: Boolean(fil.text), utdrag: fil.text.slice(0, 400), textOfullstandig: fil.ofullstandig,
    dokumenttyp: f.dokumenttyp, periodFran: f.periodFran, periodTill: f.periodTill,
    identitet: f.personnummer.length ? (f.personnummer.includes(egen) ? 'stammer' : 'annan') : 'saknas',
    text: f.personnummer.length
      ? (f.personnummer.includes(egen) ? 'Personnumret i dokumentet är patientens.' : 'Personnumret i dokumentet är inte patientens. Dokumentet kan inte sparas för den här patienten.')
      : fil.text ? 'Systemet hittade inget personnummer i texten. Bekräfta att dokumentet gäller patienten.' : 'Bilden har ingen text som systemet kan läsa. Bekräfta att dokumentet gäller patienten.',
    redanSkannad: redanSkannad(atk, fil.sha256),
  };
}

// POST /api/patient/:id/restjournaler { fil, dokumenttyp?, periodFran?, periodTill?, ursprung?, bekraftat? }
export function skanna(atk, p, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav(SKRIV);
  const fil = lasFil(body);
  const f = forslag(fil.text, nu);
  const id = identitet(p, f.personnummer, body.bekraftat);
  const dokumenttyp = body.dokumenttyp == null || body.dokumenttyp === '' ? f.dokumenttyp : body.dokumenttyp;
  if (!finns(DOKUMENTTYPER, dokumenttyp)) throw new Fel(400, 'Välj vilken sorts dokument det är.', 'ogiltig', { falt: ['dokumenttyp'] });
  const idag = iso(nu).slice(0, 10);
  const periodFran = body.periodFran === undefined ? f.periodFran : (body.periodFran || null);
  const periodTill = body.periodTill === undefined ? f.periodTill : (body.periodTill || null);
  const falt = [];
  if (periodFran && (!giltigt(periodFran) || periodFran > idag)) falt.push('periodFran');
  if (periodTill && (!giltigt(periodTill) || periodTill > idag)) falt.push('periodTill');
  if (!falt.length && periodFran && periodTill && periodFran > periodTill) falt.push('periodFran', 'periodTill');
  if (falt.length) throw new Fel(400, 'Perioden ska vara datum som inte ligger i framtiden, och början ska vara före slutet.', 'ogiltig', { falt });
  if (redanSkannad(atk, fil.sha256)) {
    throw new Fel(409, 'Samma fil är redan inskannad för patienten.', 'finns_redan');
  }
  if (db.query("SELECT count(*) AS n FROM restjournaler WHERE patient_id = ? AND status = 'journal'").get(atk.patientId).n >= MAX_PER_PATIENT) {
    throw new Fel(409, `Patienten har redan ${MAX_PER_PATIENT} skannade restjournaler i demon.`, 'tak');
  }
  const r = db.query(`INSERT INTO restjournaler (patient_id, enhet_id, vardkontakt_id, dokumenttyp, period_fran, period_till, ursprung, namn, typ, storlek, sha256, data, text, text_ofullstandig, identitet, skannad, skannad_av)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), dokumenttyp, periodFran, periodTill,
    textFalt(body.ursprung, 120) || null, fil.namn, fil.typ, fil.buf.length, fil.sha256, fil.buf, fil.text || null, fil.ofullstandig ? 1 : 0, id, iso(nu), atk.personal.id);
  return restjournalUt(db, restjournalRad(db, r.lastInsertRowid), { kvitto: !kanRoll(atk.personal, LAS) });
}

const period = (r) => (r.period_fran && r.period_till ? (r.period_fran === r.period_till ? r.period_fran : `${r.period_fran} till ${r.period_till}`) : r.period_fran ?? r.period_till ?? 'Okänd period');
export const ETIKETT = 'Skannad pappersjournal';

// kvitto: bara det som visar att skanningen är gjord, för den som skannar men inte läser journalen.
export function restjournalUt(db, r, { kvitto = false } = {}) {
  const bas = { id: r.id, namn: r.namn, sha256: r.sha256, storlek: r.storlek, skannad: { tid: r.skannad, av: personNamn(db, r.skannad_av) }, status: r.status };
  if (kvitto) return bas;
  // Runda 10, r4, säkerhetsgranskningen: texten är ofullständig när filen nådde gränserna för textlagret.
  return {
    ...bas, typ: r.typ, bild: r.typ.startsWith('image/'), dokumenttyp: r.dokumenttyp, dokumenttypText: DOKUMENTTYPER[r.dokumenttyp] ?? r.dokumenttyp,
    period: { fran: r.period_fran, till: r.period_till, text: period(r) }, ursprung: r.ursprung, vardenhet: enhetKort(db, r.enhet_id),
    identitet: r.identitet === 'personnummer' ? 'Personnumret i dokumentet är patientens.' : 'Den som skannade bekräftade att dokumentet gäller patienten.',
    harText: Boolean(r.text), textOfullstandig: Boolean(r.text_ofullstandig), utdrag: r.text ? r.text.slice(0, 300) : null, url: `/api/restjournal/${r.id}/fil`, kallaEtikett: ETIKETT,
    makulerad: r.status === 'makulerad' ? { tid: r.makulerad, av: personNamn(db, r.makulerad_av), orsak: ORSAKER[r.makulerad_orsak] ?? r.makulerad_orsak } : null,
  };
}

// Restjournalerna som anroparen får läsa. Makulerade visas inte.
export function synliga(atk, { medMakulerade = false } = {}) {
  if (!finnsTabell(atk.db) || !kanRoll(atk.personal, LAS)) return [];
  const rader = atk.db.query(`SELECT * FROM restjournaler WHERE patient_id = ?${medMakulerade ? '' : " AND status = 'journal'"} ORDER BY coalesce(period_till, period_fran, skannad) DESC, id DESC`).all(atk.patientId);
  return atk.filtrera(rader, LAS);
}

// GET /api/patient/:id/restjournaler
export function lista(atk) {
  sakra(atk.db);
  const kanSkanna = kanRoll(atk.personal, SKRIV);
  if (!kanRoll(atk.personal, LAS)) {
    atk.krav(SKRIV);
    return { dokument: [], kanSkanna, kanLasa: false, dokumenttyper: dokumenttyperUt(), orsaker: Object.entries(ORSAKER).map(([id, text]) => ({ id, text })), dolda: { kraverVal: 0, sparrade: false } };
  }
  atk.krav(LAS);
  return {
    dokument: synliga(atk).map(r => restjournalUt(atk.db, r)), kanSkanna, kanLasa: true, dokumenttyper: dokumenttyperUt(),
    orsaker: Object.entries(ORSAKER).map(([id, text]) => ({ id, text })), dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
  };
}

const huvuden = (typ, namn) => ({ 'Content-Type': typ, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(namn)}`, 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'", 'Cache-Control': 'no-store' });

// GET /api/restjournal/:id/fil: dokumentet, med samma prövning som raden. Loggas.
export function fil(atk, r) {
  bunden(atk, r);
  if (r.status !== 'journal') throw new Fel(404, 'Restjournalen finns inte.', 'saknas');
  atk.krav(LAS, { resurs: { enhet_id: r.enhet_id }, beskrivning: `restjournal:${r.id}` });
  atk.logga(LAS, atk.grund(), `restjournal:${r.id}`);
  return new Response(r.data, { headers: huvuden(r.typ, r.namn) });
}

// POST /api/restjournal/:id/makulera { orsak }: på den vårdenhet där den skannades, av den som får skanna och läsa.
export function makulera(atk, r, body = {}, nu = new Date()) {
  andraRad(atk, bunden(atk, r), SKRIV, LAS, 'En restjournal makuleras bara på den vårdenhet där den skannades.');
  if (r.status !== 'journal') throw new Fel(409, 'Restjournalen är redan makulerad.', 'makulerad');
  if (!finns(ORSAKER, body.orsak)) throw new Fel(400, 'Välj varför restjournalen makuleras.', 'ogiltig', { falt: ['orsak'] });
  atk.db.query("UPDATE restjournaler SET status = 'makulerad', makulerad = ?, makulerad_av = ?, makulerad_orsak = ? WHERE id = ?").run(iso(nu), atk.personal.id, body.orsak, r.id);
  return restjournalUt(atk.db, restjournalRad(atk.db, r.id));
}

// Händelserna i översiktens tidslinje, vid periodens slut eller när dokumentet skannades.
export function tidslinje(atk) {
  return synliga(atk).map(r => ({
    tid: r.period_till ?? r.period_fran ?? r.skannad, typ: 'restjournal', rubrik: `Restjournal: ${DOKUMENTTYPER[r.dokumenttyp] ?? r.dokumenttyp}`,
    text: `${period(r)}${r.ursprung ? `. ${r.ursprung}` : ''}${r.text ? `. ${r.text.replace(/\s+/g, ' ').slice(0, 160)}` : ''}`,
    enhet: enhetKort(atk.db, r.enhet_id), kalla: 'skannad', kallaEtikett: ETIKETT, ref: { typ: 'restjournal', id: r.id },
  }));
}

// Träffarna i sökfältet i journalen (journalsok.js): ord i den lästa texten, med samma behörighet som listan.
export function sokTraffar(atk, ord, markera) {
  const ut = [];
  for (const r of synliga(atk)) {
    const text = String(r.text ?? '').replace(/\s+/g, ' ');
    const lag = text.toLocaleLowerCase('sv-SE');
    const i = ord.map(o => lag.indexOf(o)).filter(x => x >= 0).sort((a, b) => a - b)[0];
    if (i == null) continue;
    const utdrag = text.slice(Math.max(0, i - 60), i + 120);
    ut.push({ typ: 'restjournal', tid: r.period_till ?? r.period_fran ?? r.skannad, rubrik: `Restjournal: ${DOKUMENTTYPER[r.dokumenttyp] ?? r.dokumenttyp}`,
      delar: markera(utdrag, ord) ?? [{ text: utdrag, markerad: false }], vardenhet: enhetKort(atk.db, r.enhet_id), kalla: 'skannad', kallaEtikett: ETIKETT,
      ref: { flik: 'restjournaler', sub: String(r.id) } });
  }
  return ut;
}
