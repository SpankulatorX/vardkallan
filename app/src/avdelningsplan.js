// Planerade händelser på en vårdavdelning och en resurs planering (runda 8, r3, Sussa 3.4.1.6, 3.4.1.8 och 3.1.2.2 och
// testfall 7.1 till 7.4).
//
// Systemet är experten. Sjuksköterskan, läkaren, undersköterskan och fysioterapeuten ser allt som är planerat för
// avdelningens patienter i dag i en vy, utan att leta på flera ställen:
//   - Uppgifter som planeras här: provtagning, omläggning, sjukgymnastik, teamrond, undersökningar, förberedelser, samtal
//     och konsultationer. Den som planerar skriver vad som ska göras, och systemet avgör typen, vem som brukar göra det
//     (yrkesrollen) och hur lång tid det tar ur texten, och föreslår nästa hela timme.
//   - Läkemedel att ge i dag ur ordinationerna (administrering.js), med samma behörighet som Läkemedel att ge.
//   - Patientens bokade tider på andra arbetsplatser, till exempel på mottagningen, men bara de som användaren får se.
//   - Kontroller och andra planerade uppgifter från andra moduler genom registreraKalla (r1:s kontroller och
//     provtagningar ansluts så när de finns).
// En person eller ett rum har sin egen planering för en dag eller en vecka: avdelningens uppgifter med personen som
// ansvarig, bokade tider i personens scheman och teambesök.
//
// Behörighet. Varje patient prövas i behörighetsmotorn med handlingen las_planering (vårdrelation, spärr och inre
// sekretess) och varje visning loggas på patienten. Uppgifter från en annan vårdenhet visas bara efter aktivt val, och en
// spärrad enhets uppgifter aldrig, och inget i svaret säger att de finns.
import { Fel, iso, idag, addDagar, datumAv, lokalTid, giltigtDatum } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, visningsnamn, visningsPnr, harVardrelation } from './atkomst.js';
import * as administrering from './administrering.js';
import * as tidbok from './tidbok.js';
import { teamDeltagare } from './bokning-r8.js';

const MIN = 60_000;
const TZ = 'Europe/Stockholm';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS planerade_uppgifter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, text TEXT NOT NULL, start TEXT NOT NULL, slut TEXT NOT NULL,
  yrke TEXT, ansvarig_id TEXT, status TEXT NOT NULL DEFAULT 'planerad', skapad TEXT NOT NULL, skapad_av TEXT, utford TEXT, utford_av TEXT,
  struken TEXT, struken_av TEXT, struken_orsak TEXT, kalla TEXT NOT NULL DEFAULT 'vardkallan',
  CHECK (status IN ('planerad', 'utford', 'struken'))
);
CREATE INDEX IF NOT EXISTS ix_planerade_patient ON planerade_uppgifter (patient_id, start);
CREATE INDEX IF NOT EXISTS ix_planerade_enhet ON planerade_uppgifter (enhet_id, start);
CREATE INDEX IF NOT EXISTS ix_planerade_ansvarig ON planerade_uppgifter (ansvarig_id, start);
CREATE TRIGGER IF NOT EXISTS planerad_uppgift_raderas_ej BEFORE DELETE ON planerade_uppgifter BEGIN SELECT RAISE(ABORT, 'En planerad uppgift raderas inte. Stryk den med en orsak.'); END;
`;
export function sakra(db) {
  const fanns = Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'planerade_uppgifter'").get());
  db.exec(SCHEMA);
  return !fanns;
}

// Typerna av uppgifter. yrke är den yrkesroll som brukar göra uppgiften och min hur lång tid den tar (demoregler).
// ord är orden som systemet känner igen typen på i texten.
export const TYPER = {
  provtagning: { text: 'Provtagning', yrke: 'sjukskoterska', min: 15, ord: /prov|blodprov|elstatus|odling/i },
  kontroll: { text: 'Kontroll', yrke: 'sjukskoterska', min: 15, ord: /temperatur|puls|blodtryck|glukos|blodsocker|vikt|längd|saturation|kontroll|inspektion/i },
  omlaggning: { text: 'Omläggning', yrke: 'sjukskoterska', min: 30, ord: /omlägg|sutur|slangbyte|cvk|sår|avgips/i },
  sjukgymnastik: { text: 'Sjukgymnastik', yrke: 'fysioterapeut', min: 30, ord: /sjukgymn|fysioterap|träning|mobiliser/i },
  teamrond: { text: 'Teamrond', yrke: 'lakare', min: 30, ord: /rond/i },
  undersokning: { text: 'Undersökning', yrke: 'sjukskoterska', min: 30, ord: /ekg|röntgen|ultraljud|eko|datortomografi|magnetkamera|undersökning/i },
  forberedelse: { text: 'Förberedelse', yrke: 'sjukskoterska', min: 15, ord: /fasta|kontrast|dusch|inför op|premedicin/i },
  konsult: { text: 'Konsultation', yrke: 'lakare', min: 30, ord: /konsult/i },
  samtal: { text: 'Samtal', yrke: 'lakare', min: 30, ord: /samtal|anhörig|distansmöte|prata med/i },
  transport: { text: 'Transport', yrke: 'underskoterska', min: 30, ord: /^till |operation|transport/i },
  ovrigt: { text: 'Övrigt', yrke: 'sjukskoterska', min: 30, ord: null },
};
export const YRKEN = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', underskoterska: 'Undersköterska', fysioterapeut: 'Fysioterapeut' };
export const STATUS = { planerad: 'Planerad', utford: 'Utförd', struken: 'Struken' };

// Systemet avgör typen ur texten. Ordningen i TYPER avgör när flera ord passar.
export function tolkaTyp(text) {
  const t = String(text ?? '');
  for (const [id, x] of Object.entries(TYPER)) if (x.ord && x.ord.test(t)) return id;
  return 'ovrigt';
}

// Andra moduler kan lägga till planerade uppgifter i vyn, till exempel ordinerade kontroller och provtagningar (r1).
// En källa är en funktion (db, { patientId, fran, till }) som returnerar rader med { id, tid, slut, typ, text, enhet_id,
// yrke, ansvarig_id, status }. Raderna prövas i behörighetsmotorn på sin enhet, som allt annat i vyn.
const KALLOR = [];
export function registreraKalla(namn, fn) { if (!KALLOR.some(k => k.namn === namn)) KALLOR.push({ namn, fn }); }

const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel, yrke FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const patientRad = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const patientKort = (p, visa = false) => ({ id: p.id, namn: visningsnamn(p, visa), personnummer: visningsPnr(p, visa), skyddad: Boolean(p.skyddad) });
const dygn = (datum) => ({ fran: lokalTid(datum, '00:00'), till: lokalTid(addDagar(datum, 1), '00:00') });
const klockslag = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', '.');

// Avdelningarna på användarens vårdenhet: arbetsplatser med inskrivna patienter. Den egna arbetsplatsen först om den är
// en avdelning, annars den med flest inskrivna.
export function avdelningar(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const rader = db.query(`SELECT enhet_id AS id, count(DISTINCT patient_id) AS n FROM vardkontakter WHERE typ = 'slutenvard' AND slut IS NULL AND enhet_id IN (${enheter.map(() => '?').join(', ')}) GROUP BY enhet_id ORDER BY n DESC, enhet_id`).all(...enheter);
  const lista = rader.map(r => ({ ...enhetKort(db, r.id), inskrivna: r.n }));
  const egen = lista.findIndex(a => a.id === personal.enhet_id);
  if (egen > 0) lista.unshift(...lista.splice(egen, 1));
  return lista;
}

const kravRoll = (personal) => { if (!kanRoll(personal, 'las_planering')) throw new Fel(403, 'Din yrkesroll ser inte avdelningens planering.', 'nekad'); };
const valjAvdelning = (db, personal, enhetId) => {
  const lista = avdelningar(db, personal);
  if (enhetId && !lista.some(a => a.id === enhetId)) {
    const ve = vardenhetFor(db, personal.enhet_id);
    if (vardenhetFor(db, enhetId) !== ve) throw new Fel(403, 'Avdelningen hör till en annan vårdenhet.', 'nekad');
  }
  return { lista, vald: enhetId ? (lista.find(a => a.id === enhetId) ?? { ...enhetKort(db, enhetId), inskrivna: 0 }) : lista[0] ?? null };
};

// En uppgift som den visas.
function uppgiftUt(db, u) {
  return {
    id: `u${u.id}`, uppgiftId: u.id, tid: u.start, slut: u.slut, typ: u.typ, typText: TYPER[u.typ]?.text ?? u.typ, text: u.text, kalla: 'planering',
    yrke: u.yrke, yrkeText: YRKEN[u.yrke] ?? null, ansvarig: personKort(db, u.ansvarig_id), status: u.status, statusText: STATUS[u.status],
    utford: u.utford, utfordAv: personKort(db, u.utford_av), enhet: enhetKort(db, u.enhet_id),
  };
}

// Allt som är planerat för en patient under perioden och som användaren får se. atk har handlingen las_planering.
// lakemedel: true tar med dagens läkemedel att ge (bara en dag åt gången, eftersom doserna räknas per dag).
export function handelserFor(atk, { fran, till, lakemedelDagar = [] }) {
  const db = atk.db;
  const ut = [];
  const egna = db.query("SELECT * FROM planerade_uppgifter WHERE patient_id = ? AND start >= ? AND start < ? AND status <> 'struken' ORDER BY start, id").all(atk.patientId, fran, till);
  for (const u of atk.filtrera(egna, 'las_planering')) ut.push(uppgiftUt(db, u));
  // Läkemedel att ge i dag, med samma behörighet som Läkemedel att ge.
  if (kanRoll(atk.personal, 'las_lakemedel') && atk.prova('las_lakemedel').tillaten) {
    const lm = new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_lakemedel');
    for (const dag of lakemedelDagar) {
      for (const d of administrering.lista(lm, { dag }).doser) {
        ut.push({ id: `l${d.nyckel}`, tid: d.planerad, slut: d.planerad, typ: 'lakemedel', typText: 'Läkemedel', text: `${d.lakemedel?.namn ?? 'Läkemedel'}. ${d.dosering ?? ''}`.trim(), kalla: 'lakemedel',
          yrke: 'sjukskoterska', yrkeText: 'Sjuksköterska', ansvarig: null, status: ['given', 'overlamnad'].includes(d.administrering?.status) ? 'utford' : 'planerad', statusText: d.administrering?.status === 'given' ? 'Given' : 'Att ge' });
      }
    }
  }
  // Bokade tider, på den egna vårdenheten eller efter aktivt val. En tid på en spärrad enhet syns aldrig.
  const bokningar = db.query(`SELECT b.*, t.start, t.slut, t.tidstyp, t.rubrik, s.enhet_id, s.personal_id FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE b.patient_id = ? AND b.status IN ('bokad', 'incheckad') AND t.start >= ? AND t.start < ? ORDER BY t.start`).all(atk.patientId, fran, till);
  for (const b of atk.filtrera(bokningar, 'las_planering')) {
    const team = b.tidstyp === 'team' ? teamDeltagare(db, b.id) : null;
    ut.push({ id: `b${b.id}`, tid: b.start, slut: b.slut, typ: 'bokning', typText: 'Bokad tid', text: `${b.tidstyp === 'grupp' ? (b.rubrik ?? 'Gruppträff') : tidbok.TIDSTYPER[b.tidstyp]?.text ?? 'Besök'} på ${enhetKort(db, b.enhet_id)?.namn ?? ''}`, kalla: 'tidbok',
      yrke: null, yrkeText: null, ansvarig: team ? null : personKort(db, b.personal_id), deltagare: team, status: b.status === 'incheckad' ? 'utford' : 'planerad', statusText: b.status === 'incheckad' ? 'Incheckad' : 'Bokad', enhet: enhetKort(db, b.enhet_id) });
  }
  // Andra modulers planerade uppgifter (registreraKalla).
  for (const k of KALLOR) {
    const rader = k.fn(db, { patientId: atk.patientId, fran, till }) ?? [];
    for (const r of atk.filtrera(rader, 'las_planering')) ut.push({ ...r, id: `${k.namn}:${r.id}`, kalla: k.namn, ansvarig: personKort(db, r.ansvarig_id), yrkeText: YRKEN[r.yrke] ?? null, statusText: STATUS[r.status] ?? r.status, enhet: enhetKort(db, r.enhet_id) });
  }
  return ut.sort((a, b) => a.tid.localeCompare(b.tid) || String(a.id).localeCompare(String(b.id)));
}

// Dagens planering för en avdelning (testfall 7.1 och 7.2). En rad per inskriven patient med vårdrelation.
export function avdelningensDag(db, personal, valFor, { enhetId = null, datum = idag() } = {}) {
  kravRoll(personal);
  if (!giltigtDatum(datum)) throw new Fel(400, 'Datumet ska skrivas ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['datum'] });
  const { lista, vald } = valjAvdelning(db, personal, enhetId);
  const { fran, till } = dygn(datum);
  const patienter = [];
  if (vald) {
    const kontakter = db.query("SELECT * FROM vardkontakter WHERE typ = 'slutenvard' AND slut IS NULL AND enhet_id = ? ORDER BY plats, id").all(vald.id);
    const sedda = new Set();
    for (const v of kontakter) {
      if (sedda.has(v.patient_id)) continue;
      sedda.add(v.patient_id);
      const p = patientRad(db, v.patient_id);
      if (!p || p.sammanslagen_till) continue;
      const atk = new Atkomst(db, personal, p.id, valFor(p.id), 'las_planering');
      if (!atk.prova('las_planering').tillaten) continue;
      const handelser = handelserFor(atk, { fran, till, lakemedelDagar: [datum] });
      atk.logga('las_planering', atk.grund(), `planering:${vald.id}:${datum}`);
      patienter.push({ patient: patientKort(p, atk.val?.visa_identitet), plats: v.plats, handelser });
    }
  }
  return {
    datum, avdelning: vald, avdelningar: lista, patienter, typer: Object.fromEntries(Object.entries(TYPER).map(([id, t]) => [id, t.text])),
    kanPlanera: kanRoll(personal, 'planera'), kanUtfora: kanRoll(personal, 'utfora_uppgift'),
    personal: avdelningensPersonal(db, personal),
    demoregler: 'Demoregler: hur lång tid en uppgift tar och vem som brukar göra den är påhittat för demon.',
  };
}

// Personalen på vårdenheten som kan vara ansvarig för en uppgift.
export function avdelningensPersonal(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  return db.query(`SELECT id, namn, titel, yrke FROM personal WHERE enhet_id IN (${enheter.map(() => '?').join(', ')}) AND coalesce(aktiv, 1) = 1 AND yrke IN ('lakare', 'sjukskoterska', 'underskoterska', 'fysioterapeut') ORDER BY yrke, namn`)
    .all(...enheter).map(p => ({ id: p.id, namn: p.namn, titel: p.titel, yrkeText: YRKEN[p.yrke] }));
}

// En patients planering över flera dagar (testfall 7.3). Förval: tre dagar bakåt och tre framåt.
export function patientensPlanering(atk, { fran = null, till = null } = {}) {
  atk.krav('las_planering');
  const db = atk.db;
  const f = giltigtDatum(fran ?? '') ? fran : addDagar(idag(), -3);
  const t = giltigtDatum(till ?? '') ? till : addDagar(idag(), 3);
  if (t < f) throw new Fel(400, 'Perioden slutar före den börjar.', 'ogiltig', { falt: ['till'] });
  if ((Date.parse(t) - Date.parse(f)) / 86400_000 > 31) throw new Fel(400, 'Visa högst en månad åt gången.', 'ogiltig', { falt: ['till'] });
  const handelser = handelserFor(atk, { fran: lokalTid(f, '00:00'), till: lokalTid(addDagar(t, 1), '00:00'), lakemedelDagar: [idag()].filter(d => d >= f && d <= t) });
  atk.logga('las_planering', atk.grund(), `planering:patient:${f}:${t}`);
  const p = patientRad(db, atk.patientId);
  const dagar = [];
  for (let d = f; d <= t; d = addDagar(d, 1)) dagar.push({ datum: d, handelser: handelser.filter(h => datumAv(new Date(h.tid)) === d) });
  return { patient: patientKort(p, atk.val?.visa_identitet), fran: f, till: t, idag: idag(), dagar };
}

// En persons planering för en vecka eller ett intervall (testfall 7.4): avdelningens uppgifter med personen som
// ansvarig, tider i personens scheman och teambesök. Patienten visas bara med vårdrelation på vårdenheten, och varje
// patient som visas loggas. Personen måste arbeta på samma vårdenhet.
export function resursensPlanering(db, personal, valFor, { personalId, fran = null, till = null } = {}) {
  kravRoll(personal);
  const ve = vardenhetFor(db, personal.enhet_id);
  const person = db.query('SELECT * FROM personal WHERE id = ?').get(personalId);
  if (!person || vardenhetFor(db, person.enhet_id) !== ve) throw new Fel(404, 'Personen finns inte på din vårdenhet.', 'saknas');
  const idagD = idag();
  const vd = (new Date(`${idagD}T12:00:00Z`).getUTCDay() + 6) % 7;
  const f = giltigtDatum(fran ?? '') ? fran : addDagar(idagD, -vd);
  const t = giltigtDatum(till ?? '') ? till : addDagar(f, 6);
  if (t < f || (Date.parse(t) - Date.parse(f)) / 86400_000 > 31) throw new Fel(400, 'Välj en period på högst en månad.', 'ogiltig', { falt: ['till'] });
  const F = lokalTid(f, '00:00');
  const T = lokalTid(addDagar(t, 1), '00:00');
  const atkFor = new Map();
  const far = (pid) => {
    if (!atkFor.has(pid)) {
      const atk = new Atkomst(db, personal, pid, valFor(pid), 'las_planering');
      atkFor.set(pid, atk.prova('las_planering').tillaten ? atk : null);
    }
    return atkFor.get(pid);
  };
  const rader = [];
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  // Säkerhetsgranskningen runda 8: en rad som användaren inte får se, för att patienten saknar vårdrelation, enheten är
  // spärrad eller kräver aktivt val, visas bara som upptagen tid. Den har ingen text, typ, enhet, ansvarig eller deltagare.
  const visade = new Set();
  const synlig = (pid, enhetId) => {
    const atk = far(pid);
    if (!atk || !atk.filtrera([{ enhet_id: enhetId }], 'las_planering').length) return null;
    visade.add(pid);
    return atk;
  };
  const upptagen = (id, tid, slut) => ({ id, tid, slut, typ: 'upptagen', typText: 'Upptagen', text: 'Upptagen', patient: null });
  for (const u of db.query(`SELECT * FROM planerade_uppgifter WHERE ansvarig_id = ? AND status <> 'struken' AND start >= ? AND start < ? AND enhet_id IN (${ph}) ORDER BY start`).all(personalId, F, T, ...enheter)) {
    const atk = synlig(u.patient_id, u.enhet_id);
    rader.push(atk ? { ...uppgiftUt(db, u), patient: patientKort(patientRad(db, u.patient_id), atk.val?.visa_identitet) } : upptagen(`x${rader.length}`, u.start, u.slut));
  }
  const bokningar = db.query(`SELECT DISTINCT b.id FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    LEFT JOIN teambesok_deltagare d ON d.bokning_id = b.id
    WHERE (s.personal_id = ?1 OR d.personal_id = ?1) AND b.status IN ('bokad', 'incheckad') AND t.start >= ?2 AND t.start < ?3`).all(personalId, F, T);
  for (const { id } of bokningar) {
    const b = tidbok.bokningRad(db, id);
    const tid = tidbok.tidRad(db, b.tid_id);
    const enhetId = tidbok.schemaRad(db, tid.schema_id).enhet_id;
    const atk = synlig(b.patient_id, enhetId);
    if (!atk) { rader.push(upptagen(`x${rader.length}`, tid.start, tid.slut)); continue; }
    rader.push({ id: `b${b.id}`, tid: tid.start, slut: tid.slut, typ: 'bokning', typText: 'Bokad tid', text: tid.tidstyp === 'grupp' ? (tid.rubrik ?? 'Gruppträff') : tidbok.TIDSTYPER[tid.tidstyp]?.text ?? 'Besök',
      patient: patientKort(patientRad(db, b.patient_id), atk.val?.visa_identitet), deltagare: tid.tidstyp === 'team' ? teamDeltagare(db, b.id) : null, enhet: enhetKort(db, enhetId), status: 'planerad', statusText: 'Bokad' });
  }
  // Bara de patienter vars rader visas loggas.
  for (const [pid, atk] of atkFor) if (atk && visade.has(pid)) atk.logga('las_planering', atk.grund(), `planering:resurs:${personalId}:${f}:${t}`);
  rader.sort((a, b) => a.tid.localeCompare(b.tid));
  const dagar = [];
  for (let d = f; d <= t; d = addDagar(d, 1)) dagar.push({ datum: d, handelser: rader.filter(r => datumAv(new Date(r.tid)) === d) });
  return { person: { id: person.id, namn: person.namn, titel: person.titel, yrkeText: YRKEN[person.yrke] ?? null }, fran: f, till: t, idag: idagD, dagar,
    utanPatient: 'En rad som bara säger Upptagen gäller en patient vars uppgifter du inte får se. Den visas bara som upptagen tid.' };
}

// ---------------------------------------------------------------------------------------------------------------
// Planera, utföra och stryka

// Avdelningen där patienten är inskriven på användarens vårdenhet, eller null.
function inskrivenPa(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  return db.query(`SELECT enhet_id FROM vardkontakter WHERE patient_id = ? AND typ = 'slutenvard' AND slut IS NULL AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY start DESC LIMIT 1`).get(patientId, ...enheter)?.enhet_id ?? null;
}

// Systemets förslag när en uppgift planeras: typ, yrkesroll och längd ur texten, och nästa hela timme.
export function forslag(text, nu = new Date()) {
  const typ = tolkaTyp(text);
  const t = new Date(Math.ceil(nu.getTime() / (60 * MIN)) * 60 * MIN);
  return { typ, typText: TYPER[typ].text, yrke: TYPER[typ].yrke, yrkeText: YRKEN[TYPER[typ].yrke], minuter: TYPER[typ].min, start: t.toISOString() };
}

export function planera(atk, body = {}, { nu = new Date() } = {}) {
  atk.krav('planera');
  const db = atk.db;
  const enhet = inskrivenPa(db, atk.personal, atk.patientId);
  if (!enhet) throw new Fel(400, 'Patienten är inte inskriven på en avdelning på din vårdenhet. Uppgifter planeras för inskrivna patienter.', 'ogiltig');
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 120) : '';
  if (!text) throw new Fel(400, 'Skriv vad som ska göras, till exempel Omläggning av sår.', 'ogiltig', { falt: ['text'] });
  const f = forslag(text, nu);
  const typ = body.typ ?? f.typ;
  if (!Object.hasOwn(TYPER, typ)) throw new Fel(400, 'Typen finns inte.', 'ogiltig', { falt: ['typ'] });
  let start = f.start;
  if (body.start) {
    const ms = Date.parse(body.start);
    if (!Number.isFinite(ms)) throw new Fel(400, 'Tiden går inte att läsa. Skriv datum och klockslag.', 'ogiltig', { falt: ['start'] });
    if (ms < nu.getTime() - 24 * 60 * MIN) throw new Fel(400, 'Tiden har redan varit. En uppgift planeras framåt.', 'ogiltig', { falt: ['start'] });
    start = new Date(ms).toISOString();
  }
  const minuter = body.minuter == null ? TYPER[typ].min : Number(body.minuter);
  if (!Number.isInteger(minuter) || minuter < 5 || minuter > 480) throw new Fel(400, 'En uppgift tar mellan 5 minuter och 8 timmar.', 'ogiltig', { falt: ['minuter'] });
  let ansvarig = null;
  if (body.ansvarigId) {
    ansvarig = avdelningensPersonal(db, atk.personal).find(p => p.id === body.ansvarigId);
    if (!ansvarig) throw new Fel(400, 'Den ansvariga ska arbeta på din vårdenhet.', 'ogiltig', { falt: ['ansvarigId'] });
  }
  const yrke = ansvarig ? db.query('SELECT yrke FROM personal WHERE id = ?').get(ansvarig.id).yrke : TYPER[typ].yrke;
  const id = Number(db.query(`INSERT INTO planerade_uppgifter (patient_id, enhet_id, typ, text, start, slut, yrke, ansvarig_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(atk.patientId, enhet, typ, text, start, new Date(Date.parse(start) + minuter * MIN).toISOString(), yrke, ansvarig?.id ?? null, iso(nu), atk.personal.id).lastInsertRowid);
  atk.logga('planera', atk.grund(), `planerad_uppgift:${id}`);
  return [201, { ...uppgiftUt(db, uppgiftRad(db, id)), besked: `${text} är planerad klockan ${klockslag(start)}${ansvarig ? ` med ${ansvarig.namn} som ansvarig` : `, för ${YRKEN[yrke].toLowerCase()}`}.` }];
}

export function uppgiftRad(db, id) {
  const u = db.query('SELECT * FROM planerade_uppgifter WHERE id = ?').get(Number(id));
  if (!u) throw new Fel(404, 'Uppgiften finns inte.', 'saknas');
  return u;
}
function kravSammaVardenhet(atk, u) {
  if (vardenhetFor(atk.db, u.enhet_id) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    atk.logga(atk.handling, 'nekad', `planerad_uppgift:${u.id}`, 'nekad');
    throw new Fel(403, 'Uppgiften hör till en annan vårdenhet.', 'nekad');
  }
}

export function utfor(atk, u) {
  atk.krav('utfora_uppgift');
  kravSammaVardenhet(atk, u);
  if (u.status !== 'planerad') throw new Fel(400, u.status === 'utford' ? 'Uppgiften är redan utförd.' : 'Uppgiften är struken.', 'ogiltig');
  atk.db.query("UPDATE planerade_uppgifter SET status = 'utford', utford = ?, utford_av = ? WHERE id = ?").run(iso(), atk.personal.id, u.id);
  atk.logga('utfora_uppgift', atk.grund(), `planerad_uppgift:${u.id}:utford`);
  return uppgiftUt(atk.db, uppgiftRad(atk.db, u.id));
}

export function stryk(atk, u, body = {}) {
  atk.krav('planera');
  kravSammaVardenhet(atk, u);
  if (u.status !== 'planerad') throw new Fel(400, 'Bara en planerad uppgift kan strykas.', 'ogiltig');
  const orsak = typeof body.orsak === 'string' ? body.orsak.trim().slice(0, 200) : '';
  if (!orsak) throw new Fel(400, 'Skriv varför uppgiften stryks.', 'ogiltig', { falt: ['orsak'] });
  atk.db.query("UPDATE planerade_uppgifter SET status = 'struken', struken = ?, struken_av = ?, struken_orsak = ? WHERE id = ?").run(iso(), atk.personal.id, orsak, u.id);
  atk.logga('planera', atk.grund(), `planerad_uppgift:${u.id}:struken`);
  return uppgiftUt(atk.db, uppgiftRad(atk.db, u.id));
}

// ---------------------------------------------------------------------------------------------------------------
// Seed: några uppgifter i dag för de inskrivna på Avdelning 72, så att vyn har innehåll i den vanliga demon.
export const SEED = [
  { patient: 'p01', text: 'Provtagning, blodprover', klocka: '11:00', ansvarig: null },
  { patient: 'p01', text: 'EKG', klocka: '14:00', ansvarig: null },
  { patient: 'p04', text: 'Sjukgymnastik, gångträning', klocka: '10:00', ansvarig: 'fys-kard' },
  { patient: 'p04', text: 'Omläggning av perifer venkateter', klocka: '13:00', ansvarig: null },
  { patient: 'p04', text: 'Teamrond', klocka: '09:00', ansvarig: 'lak-kard' },
];
export function seeda(db, { bas = new Date() } = {}) {
  sakra(db);
  if (db.query('SELECT 1 FROM planerade_uppgifter LIMIT 1').get()) return;
  const datum = datumAv(bas);
  for (const s of SEED) {
    const enhet = db.query("SELECT enhet_id FROM vardkontakter WHERE patient_id = ? AND typ = 'slutenvard' AND slut IS NULL ORDER BY start DESC LIMIT 1").get(s.patient)?.enhet_id;
    if (!enhet) continue;
    const typ = tolkaTyp(s.text);
    const start = lokalTid(datum, s.klocka);
    const yrke = s.ansvarig ? db.query('SELECT yrke FROM personal WHERE id = ?').get(s.ansvarig)?.yrke ?? TYPER[typ].yrke : TYPER[typ].yrke;
    db.query('INSERT INTO planerade_uppgifter (patient_id, enhet_id, typ, text, start, slut, yrke, ansvarig_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(s.patient, enhet, typ, s.text, start, new Date(Date.parse(start) + TYPER[typ].min * MIN).toISOString(), yrke, s.ansvarig, bas.toISOString(), 'ssk-kard');
  }
}
export const harVardrelationPa = harVardrelation;
