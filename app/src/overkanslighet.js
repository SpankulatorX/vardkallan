// Runda 10, r2: basfakta, överkänslighet i ett eget flöde (Sussa 3.1.6.2). Läkare och sjuksköterskor registrerar en ny
// överkänslighet, ändrar den som en ny version och avslutar den med en orsak. Tabellen overkanslighet har de gällande
// uppgifterna, som basfakta, uppmärksamhetssymbolen, varningarna vid ordination, FHIR och Min journal redan läser, och
// varje händelse sparas i overkanslighet_handelser med när, var, av vem och varför.
//
// Systemet är experten: det slår upp ATC-koden ur ämnet (en lista med vanliga ämnen och läkemedelskatalogen), föreslår
// allvarlighetsgraden ur reaktionen och förklarar varför. Användaren behöver inte kunna ATC-koderna. En överkänslighet
// hör till vårdenheten där den registrerades, så att spärr och inre sekretess gäller som för annan journalinformation.
import { Fel, iso, idag } from './db.js';
import { kanRoll, vardenhetFor, aktivaSparrar } from './atkomst.js';
import { ATC } from './kodverk.js';
import { foreslagenGrad } from './uppmarksamhet-regler.js';
// Runda 10, r1: uppmärksamhetsinformationen med grad och kod, och varningarna för läkemedel i listan som omfattas.
import { bekraftaOverkanslighet } from './uppmarksamhet.js';
import { synligaOrdinationer, aktuell as ordinationAktuell } from './lakemedel.js';

export const HANDLING = 'registrera_overkanslighet';
const LAS = 'las_oversikt';

export const ALLVARLIGHET = { allvarlig: 'Allvarlig', mattlig: 'Måttlig', lindrig: 'Lindrig' };

// Vanliga ämnen. ATC-koderna finns i kodverk.ATC (WHO:s index), och ett ämne som inte är ett läkemedel har ingen kod.
const AMNEN = [
  { amne: 'Penicilliner', atc: 'J01C', ord: ['penicillin', 'penicilliner', 'betalaktam'] },
  { amne: 'Antiinflammatoriska läkemedel (NSAID)', atc: 'M01A', ord: ['nsaid', 'nsaid-preparat', 'antiinflammatoriska'] },
  { amne: 'Acetylsalicylsyra', atc: 'B01AC06', ord: ['asa', 'acetylsalicylsyra', 'trombyl', 'aspirin'] },
  { amne: 'Latex', atc: null, ord: ['latex', 'gummi'] },
  { amne: 'Jordnöt', atc: null, ord: ['jordnöt', 'jordnötter'] },
  { amne: 'Nötter', atc: null, ord: ['nöt', 'nötter', 'hasselnöt', 'cashew'] },
  { amne: 'Ägg', atc: null, ord: ['ägg'] },
  { amne: 'Skaldjur', atc: null, ord: ['skaldjur', 'räkor', 'kräftdjur'] },
  { amne: 'Bi- och getingstick', atc: null, ord: ['bi', 'geting', 'getingstick', 'bistick', 'insektsstick'] },
  { amne: 'Nickel', atc: null, ord: ['nickel'] },
  { amne: 'Plåster och tejp', atc: null, ord: ['plåster', 'tejp'] },
];

const norm = (s) => String(s ?? '').trim().toLocaleLowerCase('sv');
const versal = (s) => (s ? s.charAt(0).toLocaleUpperCase('sv') + s.slice(1) : s);

// Ämnen som systemet känner igen: listan och läkemedelskatalogens substanser, för förslagen i formuläret.
export function amnen(db) {
  const katalog = db.query('SELECT DISTINCT substans, atc FROM katalog ORDER BY substans').all()
    .map(k => ({ amne: versal(k.substans), atc: k.atc })).filter(k => k.atc && Object.hasOwn(ATC, k.atc));
  const sett = new Set();
  return { amnen: [...AMNEN.map(({ amne, atc }) => ({ amne, atc })), ...katalog].filter(a => !sett.has(norm(a.amne)) && sett.add(norm(a.amne))) };
}

// Allvarlighetsgraden ur reaktionen. Anafylaxi, svullnad i svalget, andningsbesvär och blodtrycksfall är allvarliga.
const ALLVARLIGT = /anafylax|svullnad i svalg|svalgsvullnad|andningsbesvär|andnöd|bronkospasm|blodtrycksfall|chock|medvetslös|quincke|angioödem/i;
const MATTLIGT = /urtikaria|nässelutslag|utslag|eksem|svullnad|kräk|diarré|feber/i;
export function foreslaAllvarlighet(reaktion) {
  if (ALLVARLIGT.test(reaktion ?? '')) return { allvarlighet: 'allvarlig', varfor: 'Reaktionen kan vara livshotande, så systemet föreslår allvarlig.' };
  if (MATTLIGT.test(reaktion ?? '')) return { allvarlighet: 'mattlig', varfor: 'Reaktionen ger tydliga besvär men är inte livshotande, så systemet föreslår måttlig.' };
  return { allvarlighet: 'lindrig', varfor: 'Reaktionen beskriver lindriga besvär, så systemet föreslår lindrig.' };
}

// Ämnet tolkat: namn, ATC-kod och om det är ett läkemedel, med en förklaring på vanlig svenska.
export function tolkaAmne(db, amne) {
  const q = norm(amne);
  if (!q) return null;
  const lista = AMNEN.find(a => norm(a.amne) === q || a.ord.includes(q));
  if (lista) return { amne: lista.amne, atc: lista.atc, lakemedel: Boolean(lista.atc), kalla: 'lista' };
  const k = db.query('SELECT substans, namn, atc FROM katalog WHERE lower(substans) = ?1 OR lower(namn) = ?1 LIMIT 1').get(q)
    ?? db.query("SELECT substans, namn, atc FROM katalog WHERE lower(namn) LIKE ?1 || ' %' LIMIT 1").get(q);
  if (k?.atc) return { amne: versal(k.substans), atc: k.atc, lakemedel: true, kalla: 'katalog' };
  return { amne: versal(String(amne).trim()), atc: null, lakemedel: false, kalla: 'fritext' };
}

// Förslaget för formuläret: ämnet med ATC-kod och allvarlighetsgraden ur reaktionen. Inga patientuppgifter.
export function forslag(db, personal, { amne, reaktion } = {}) {
  if (!kanRoll(personal, HANDLING)) throw new Fel(403, 'Din yrkesroll registrerar inte överkänslighet.', 'nekad');
  const t = tolkaAmne(db, amne);
  if (!t) throw new Fel(400, 'Skriv vad patienten är överkänslig mot.', 'ogiltig', { falt: ['amne'] });
  const a = foreslaAllvarlighet(reaktion);
  const varfor = [];
  if (t.atc) varfor.push(`Systemet hittade ATC-kod ${t.atc}${ATC[t.atc] ? ` (${ATC[t.atc]})` : ''}. Vid ordination varnar systemet för alla läkemedel inom koden.`);
  else if (t.kalla === 'lista') varfor.push(`${t.amne} är inte ett läkemedel och har ingen ATC-kod.`);
  else varfor.push(`Systemet hittade ingen ATC-kod för ${t.amne}. Om det är ett läkemedel, skriv substansens namn, annars ger en ordination ingen varning.`);
  varfor.push(a.varfor);
  return { ...t, allvarlighet: a.allvarlighet, varfor };
}

const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const personKort = (db, id) => {
  const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id);
  return p ? { id: p.id, namn: p.namn, titel: p.titel } : null;
};
const okUt = (db, o) => ({
  id: o.id, amne: o.amne, atc: o.atc, reaktion: o.reaktion, allvarlighet: o.allvarlighet, allvarlighetText: ALLVARLIGHET[o.allvarlighet] ?? o.allvarlighet,
  datum: o.datum, version: o.version ?? 1, vardenhet: { id: o.enhet_id, namn: enhetsnamn(db, o.enhet_id) },
  registrerad: o.registrerad ?? null, registreradAv: personKort(db, o.registrerad_av), kalla: o.kalla,
});
const handelseUt = (db, h) => ({
  id: h.id, overkanslighetId: h.overkanslighet_id, version: h.version, handelse: h.handelse, amne: h.amne, atc: h.atc, reaktion: h.reaktion,
  allvarlighet: h.allvarlighet, allvarlighetText: ALLVARLIGHET[h.allvarlighet] ?? h.allvarlighet, orsak: h.orsak, tid: h.tid,
  av: personKort(db, h.av), vardenhet: { id: vardenhetFor(db, h.av_enhet), namn: enhetsnamn(db, vardenhetFor(db, h.av_enhet)) },
});

function handelse(db, o, typ, personal, orsak = null) {
  db.query(`INSERT INTO overkanslighet_handelser (overkanslighet_id, patient_id, enhet_id, version, handelse, amne, atc, reaktion, allvarlighet, orsak, tid, av, av_enhet)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(o.id, o.patient_id, o.enhet_id, o.version ?? 1, typ, o.amne, o.atc, o.reaktion, o.allvarlighet, orsak, iso(), personal.id, personal.enhet_id);
}

const lasText = (v, falt, min, max, text) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min || s.length > max) throw new Fel(400, text, 'ogiltig', { falt: [falt] });
  return s;
};
const lasAllvarlighet = (v, reaktion) => {
  if (v == null || v === '') return foreslaAllvarlighet(reaktion).allvarlighet;
  if (!Object.hasOwn(ALLVARLIGHET, v)) throw new Fel(400, 'Välj allvarlig, måttlig eller lindrig.', 'ogiltig', { falt: ['allvarlighet'] });
  return v;
};

// Registrerar en ny överkänslighet på den inloggades vårdenhet. inp: { amne, reaktion, allvarlighet?, grad? }.
// Runda 10, r1: svaret har också graden i uppmärksamhetsinformationen (grad, gradBekraftad) och varningar för läkemedel
// i listan som omfattas (varningar).
export function registrera(atk, inp = {}) {
  atk.krav(HANDLING, { resurs: { enhet_id: atk.personal.enhet_id } });
  const db = atk.db;
  const t = tolkaAmne(db, lasText(inp.amne, 'amne', 2, 120, 'Skriv vad patienten är överkänslig mot.'));
  const reaktion = lasText(inp.reaktion, 'reaktion', 2, 300, 'Beskriv reaktionen, till exempel utslag eller andningsbesvär.');
  const allvarlighet = lasAllvarlighet(inp.allvarlighet, reaktion);
  // Samma ämne två gånger på samma vårdgivare är en dubblett. Bara rader som den inloggade får se jämförs, så att en
  // spärrad rad inte röjs av en dubblettkontroll.
  const synliga = atk.filtrera(db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv'").all(atk.patientId), LAS, { gemensam: true });
  if (synliga.some(o => norm(o.amne) === norm(t.amne))) throw new Fel(400, `Överkänslighet mot ${t.amne.toLowerCase()} är redan registrerad. Ändra den i stället.`, 'ogiltig', { falt: ['amne'] });
  const tid = iso();
  const id = db.transaction(() => {
    const r = db.query(`INSERT INTO overkanslighet (patient_id, enhet_id, amne, atc, reaktion, allvarlighet, datum, kalla, version, registrerad, registrerad_av)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'vardkallan', 1, ?, ?)`).run(atk.patientId, atk.personal.enhet_id, t.amne, t.atc, reaktion, allvarlighet, idag(), tid, atk.personal.id);
    const nyId = Number(r.lastInsertRowid);
    handelse(db, db.query('SELECT * FROM overkanslighet WHERE id = ?').get(nyId), 'registrerad', atk.personal);
    return nyId;
  })();
  atk.logga(HANDLING, atk.grund(), `overkanslighet:${id}`);
  const o = db.query('SELECT * FROM overkanslighet WHERE id = ?').get(id);
  // Runda 10, r1: en läkare bekräftar graden i uppmärksamhetsinformationen i samma steg, med ATC-koden. En sjuksköterska
  // registrerar överkänsligheten, och systemet föreslår då graden för läkaren att bekräfta (uppmarksamhet-regler.js).
  const grad = bekraftaOverkanslighet(atk, o, inp.grad ?? null);
  return { ...okUt(db, o), grad: grad ?? foreslagenGrad(o), gradBekraftad: Boolean(grad), varningar: varningarFor(atk, o) };
}

// Runda 10, r1: läkemedel i listan som omfattas av överkänsligheten, bara bland de aktuella ordinationer som den
// inloggade får se, så att en spärrad ordination aldrig röjs av en varning.
function varningarFor(atk, o) {
  if (!o.atc || !kanRoll(atk.personal, 'las_lakemedel')) return [];
  return synligaOrdinationer(atk).filter(x => ordinationAktuell(x))
    .map(x => atk.db.query('SELECT namn, atc FROM katalog WHERE id = ?').get(x.lakemedel_id)).filter(lm => lm?.atc?.startsWith(o.atc))
    .map(lm => ({ niva: 'allvarlig', regel: 'overkanslighet', text: `${lm.namn} i läkemedelslistan har ATC-kod ${lm.atc} och omfattas av överkänsligheten. Kontakta förskrivaren om ordinationen ska sättas ut.` }));
}

// En gällande överkänslighet som den inloggade får se. En rad som inte finns, en avslutad rad och en rad som är dold får
// samma svar.
const SAKNAS = 'Överkänsligheten finns inte bland det du kan se.';
export function hamta(atk, id) {
  const db = atk.db;
  const o = Number.isInteger(Number(id)) ? db.query("SELECT * FROM overkanslighet WHERE id = ? AND status = 'aktiv'").get(Number(id)) : null;
  if (!o || o.patient_id !== atk.patientId) throw new Fel(404, SAKNAS, 'saknas');
  if (!atk.filtrera([o], LAS, { gemensam: true }).length) throw new Fel(404, SAKNAS, 'saknas');
  return o;
}

// Vårdgivaren (huvudmannen) för en enhet: den vårdgivare eller kommun som enheten leder upp till, som huvudman() i
// lagring.js.
function vardgivareFor(db, enhetId) {
  let e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(enhetId);
  for (let i = 0; i < 10 && e && e.forald_id && !['vardgivare', 'kommun'].includes(e.typ); i++) e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(e.forald_id);
  return e?.id ?? enhetId;
}

// Säkerhetsgranskningen av runda 10, r2: en överkänslighet är gemensam information inom vårdgivaren. Den som får
// registrera ändrar och avslutar en rad som hör till en vårdenhet hos den egna vårdgivaren, aldrig en rad hos en annan
// vårdgivare och aldrig en spärrad vårdenhets rad, inte heller med patientens samtycke till att visa den. Behörigheten
// prövas mot radens egen enhet.
function hamtaForAndring(atk, id) {
  const db = atk.db;
  const o = hamta(atk, id);
  if (vardgivareFor(db, o.enhet_id) !== vardgivareFor(db, atk.personal.enhet_id)) {
    atk.logga(HANDLING, 'nekad', `overkanslighet:${o.id}`, 'nekad');
    throw new Fel(403, 'Överkänsligheten är registrerad hos en annan vårdgivare och ändras där.', 'nekad');
  }
  const ve = vardenhetFor(db, o.enhet_id);
  if (ve !== vardenhetFor(db, atk.personal.enhet_id) && aktivaSparrar(db, o.patient_id).includes(ve)) {
    atk.logga(HANDLING, 'nekad', `overkanslighet:${o.id}`, 'nekad');
    throw new Fel(403, 'Uppgiften är spärrad av patienten och kan bara ändras på vårdenheten där den registrerades.', 'nekad');
  }
  if (!atk.prova(HANDLING, { enhet_id: o.enhet_id, gemensam: true }).tillaten) throw new Fel(404, SAKNAS, 'saknas');
  return o;
}
export const patientFor = (db, id) => (Number.isInteger(Number(id)) ? db.query('SELECT patient_id FROM overkanslighet WHERE id = ?').get(Number(id))?.patient_id ?? null : null);

// Ändrar en överkänslighet som en ny version. inp: { amne?, reaktion?, allvarlighet?, orsak }.
export function andra(atk, id, inp = {}) {
  atk.krav(HANDLING, { resurs: { enhet_id: atk.personal.enhet_id } });
  const db = atk.db;
  const o = hamtaForAndring(atk, id);
  const orsak = lasText(inp.orsak, 'orsak', 3, 300, 'Skriv varför uppgiften ändras. Orsaken visas i historiken.');
  const t = inp.amne != null ? tolkaAmne(db, lasText(inp.amne, 'amne', 2, 120, 'Skriv vad patienten är överkänslig mot.')) : { amne: o.amne, atc: o.atc };
  const reaktion = inp.reaktion != null ? lasText(inp.reaktion, 'reaktion', 2, 300, 'Beskriv reaktionen.') : o.reaktion;
  // En ny reaktion ger ett nytt förslag på allvarlighetsgrad, om inte en grad anges.
  const allvarlighet = inp.allvarlighet != null ? lasAllvarlighet(inp.allvarlighet, reaktion) : inp.reaktion != null ? foreslaAllvarlighet(reaktion).allvarlighet : o.allvarlighet;
  if (t.amne === o.amne && t.atc === o.atc && reaktion === o.reaktion && allvarlighet === o.allvarlighet) {
    throw new Fel(400, 'Uppgifterna är desamma som förut, så ingenting ändras.', 'ogiltig', { falt: ['reaktion'] });
  }
  db.transaction(() => {
    db.query('UPDATE overkanslighet SET amne = ?, atc = ?, reaktion = ?, allvarlighet = ?, version = version + 1, registrerad = ?, registrerad_av = ? WHERE id = ?')
      .run(t.amne, t.atc, reaktion, allvarlighet, iso(), atk.personal.id, o.id);
    const ny = db.query('SELECT * FROM overkanslighet WHERE id = ?').get(o.id);
    handelse(db, ny, 'andrad', atk.personal, orsak);
    // En bekräftad grad gäller den tidigare reaktionen. När systemets förslag ändras ska graden bekräftas på nytt.
    if (foreslagenGrad(ny) !== foreslagenGrad(o)) {
      db.query("UPDATE uppmarksamhet SET status = 'avslutad', avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE kalla_typ = 'overkanslighet' AND kalla_id = ? AND status = 'aktiv'")
        .run(iso(), atk.personal.id, 'Överkänsligheten är ändrad, och graden bekräftas på nytt.', o.id);
    }
  })();
  atk.logga(HANDLING, atk.grund(), `overkanslighet:${o.id}`);
  return okUt(db, db.query('SELECT * FROM overkanslighet WHERE id = ?').get(o.id));
}

// Avslutar en överkänslighet med en orsak. Raden ligger kvar med status, vem, när och varför, men är inte längre gällande:
// den försvinner ur basfakta, uppmärksamhetssymbolen och varningarna, och historiken visar avslutet.
export function avsluta(atk, id, inp = {}) {
  atk.krav(HANDLING, { resurs: { enhet_id: atk.personal.enhet_id } });
  const db = atk.db;
  const o = hamtaForAndring(atk, id);
  const orsak = lasText(inp.orsak, 'orsak', 3, 300, 'Skriv varför överkänsligheten avslutas, till exempel att en provokation var negativ.');
  db.transaction(() => {
    handelse(db, o, 'avslutad', atk.personal, orsak);
    db.query("UPDATE uppmarksamhet SET status = 'avslutad', avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE kalla_typ = 'overkanslighet' AND kalla_id = ? AND status = 'aktiv'")
      .run(iso(), atk.personal.id, orsak, o.id);
    db.query("UPDATE overkanslighet SET status = 'avslutad', avslutad = ?, avslutad_av = ?, avslut_orsak = ? WHERE id = ?").run(iso(), atk.personal.id, orsak, o.id);
  })();
  atk.logga(HANDLING, atk.grund(), `overkanslighet:${o.id}`);
  return handelseUt(db, db.query("SELECT * FROM overkanslighet_handelser WHERE overkanslighet_id = ? AND handelse = 'avslutad' ORDER BY id DESC").get(o.id));
}

// De gällande överkänsligheterna och historiken för patienten, med samma behörighet som basfakta.
export function forPatient(atk) {
  atk.krav(LAS);
  const db = atk.db;
  const aktuella = atk.filtrera(db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv' ORDER BY datum DESC, id DESC").all(atk.patientId), LAS, { gemensam: true });
  const historik = atk.filtrera(db.query('SELECT * FROM overkanslighet_handelser WHERE patient_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId), LAS, { gemensam: true });
  const kan = kanRoll(atk.personal, HANDLING) && atk.prova(HANDLING, { enhet_id: atk.personal.enhet_id }).tillaten;
  return { aktuella: aktuella.map(o => okUt(db, o)), historik: historik.map(h => handelseUt(db, h)), kan: { registrera: kan }, allvarlighet: ALLVARLIGHET };
}
