// Egen vårdbegäran från invånaren i Min journal (runda 6, r4, Sussa 3.3.2.1).
//
// Systemet är experten. Invånaren beskriver sitt besvär med egna ord och behöver inte veta vilken vårdenhet som ska ta
// emot det:
//   - Systemet föreslår vårdenheter där invånaren redan har kontakt eller är listad, och rekommenderar den som passar
//     besväret (demoregler: ord i beskrivningen och vårdenhetens inriktning). Utan någon kontakt föreslås vårdcentralerna.
//   - Vid ord som kan tyda på något akut säger systemet att invånaren ska ringa 112, innan något skickas.
//   - Begäran hamnar som en remiss hos vårdenheten, med Min journal som avsändare, och går genom samma statuskedja:
//     mottagen, bedömd, besvarad. Svaret visas för invånaren i Min journal.
// En vårdnadshavare kan skicka en vårdbegäran för ett barn under 13 år, som i resten av Min journal.
import { Fel, iso, idag, addDagar } from './db.js';
import { vardenhetFor, harVardrelation } from './atkomst.js';
import { EGEN, tolkaBilaga, sparaBilaga } from './remiss-r4.js';

export const MAX_OPPNA = 3;
const SVAR_DAGAR = 14;

// Demoregler: ord i beskrivningen som pekar mot en inriktning, och vårdenheterna med den inriktningen.
const INRIKTNINGAR = [
  { ord: /hjärt|bröstet|flimmer|blodtryck|svimm|klappning/i, enheter: ['uso-kard', 'lind-med'], text: 'Besväret låter som något som rör hjärtat, och du har kontakt med vårdenheten.' },
  { ord: /knä|höft|led|fraktur|bruten|axel|fot/i, enheter: ['uso-ort', 'kkoga-ort'], text: 'Besväret låter som något som rör leder eller skelett, och du har kontakt med vårdenheten.' },
  { ord: /oro|ångest|nedstämd|sömn|deprim/i, enheter: ['uso-psyk'], text: 'Besväret låter som något som rör det psykiska, och du har kontakt med vårdenheten.' },
];
// Ord som kan tyda på något akut (demoregel). Då ska invånaren ringa 112 i stället för att vänta på svar.
const AKUT = /bröstsmärt|ont i bröstet|tryck över bröstet|svårt att andas|andnöd|kan inte andas|medvetslös|förlam|sluddr|kraftig blödning|ta mitt liv|självmord/i;
export const AKUT_TEXT = 'Det du beskriver kan vara tecken på något akut. Ring 112 om du har allvarliga besvär eller blir sämre. En vårdbegäran läses inte direkt, utan i vårdenhetens vanliga arbete.';

const enhet = (db, id) => { const e = db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };

function tolkaBesvar(text) {
  const t = typeof text === 'string' ? text.trim() : '';
  if (t.length < 10) throw new Fel(400, 'Beskriv ditt besvär med några meningar: vad du känner, sedan när och om det har blivit sämre.', 'ogiltig', { falt: ['besvar'] });
  if (t.length > 2000) throw new Fel(400, 'Beskrivningen får vara högst 2 000 tecken.', 'ogiltig', { falt: ['besvar'] });
  return t;
}

// Förslagen för patienten och besväret. Akutmottagningen tar aldrig emot en vårdbegäran.
export function forslag(db, patientId, besvar) {
  const text = tolkaBesvar(besvar);
  const vardenheter = db.query("SELECT id, namn, forald_id FROM enheter WHERE typ = 'vardenhet' AND id <> 'uso-akut' ORDER BY namn").all();
  const listning = db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').all(patientId).map(l => vardenhetFor(db, l.enhet_id));
  const kontakt = vardenheter.filter(v => harVardrelation(db, patientId, v.id)).map(v => v.id);
  const vardcentraler = vardenheter.filter(v => v.forald_id === 'primarvard').map(v => v.id);
  const inriktning = INRIKTNINGAR.find(i => i.ord.test(text) && i.enheter.some(e => kontakt.includes(e)));
  const rekommenderad = inriktning ? inriktning.enheter.find(e => kontakt.includes(e)) : listning[0] ?? null;
  const ut = new Map();
  const lagg = (id, skal) => { if (!ut.has(id)) ut.set(id, { enhet: enhet(db, id), skal, rekommenderad: id === rekommenderad }); };
  if (inriktning) lagg(rekommenderad, inriktning.text);
  for (const id of listning) lagg(id, 'Du är listad på vårdcentralen. Börja där när du är osäker.');
  for (const id of kontakt) lagg(id, 'Du har kontakt med vårdenheten sedan tidigare.');
  // Utan listning föreslås vårdcentralerna, som tar emot vårdbegäran från alla i demon.
  if (!listning.length) for (const id of vardcentraler) lagg(id, 'Vårdcentralen tar emot vårdbegäran från alla i demon.');
  const lista = [...ut.values()].sort((a, b) => Number(b.rekommenderad) - Number(a.rekommenderad));
  if (!lista.some(x => x.rekommenderad) && lista.length) lista[0].rekommenderad = true;
  return { forslag: lista, akut: AKUT.test(text) ? AKUT_TEXT : null, demoregler: 'Förslagen räknas med demoregler ur beskrivningen, dina kontakter och din listning.' };
}

export const minForslag = (atk, body = {}) => forslag(atk.db, atk.patient.id, body.besvar);

const oppna = (db, pid) => db.query(`SELECT count(*) AS n FROM remisser WHERE patient_id = ? AND fran_enhet_id = ? AND status NOT IN ('besvarad', 'svar_kvitterat')
  AND NOT (status = 'bedomd' AND beslut IN ('avvisad', 'vidarebefordrad'))`).get(pid, EGEN).n;

export function skapa(atk, body = {}) {
  const db = atk.db;
  const pid = atk.patient.id;
  const f = forslag(db, pid, body.besvar);
  const val = f.forslag.find(x => x.enhet.id === body.enhetId);
  if (!val) throw new Fel(400, 'Välj en av de vårdenheter som systemet föreslår.', 'ogiltig', { falt: ['enhetId'] });
  if (oppna(db, pid) >= MAX_OPPNA) throw new Fel(400, `Du har redan ${MAX_OPPNA === 3 ? 'tre' : MAX_OPPNA} vårdbegäranden som vården inte har svarat på. Vänta på svar, eller ring vårdenheten.`, 'ogiltig');
  // Runda 10, r6: med gränserna som systemförvaltningen har satt.
  const bilaga = body.bilaga ? tolkaBilaga(body.bilaga, db) : null;
  const text = body.besvar.trim();
  const id = Number(db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status, skickad_tid)
    VALUES (?, ?, ?, ?, ?, NULL, 'normal', ?, 'skickad', ?)`).run(pid, EGEN, val.enhet.id, atk.invanare.id, text, addDagar(idag(), SVAR_DAGAR), iso()).lastInsertRowid);
  db.query('INSERT INTO egen_vardbegaran (remiss_id, invanare_id, patient_id, skal, skapad) VALUES (?, ?, ?, ?, ?)').run(id, atk.invanare.id, pid, val.skal, iso());
  if (bilaga) sparaBilaga(db, { remissId: id, patientId: pid, bilaga, avInvanare: atk.invanare.id });
  atk.logga(`min:vardbegaran:${id}`, { handling: 'invanare_begaran' });
  return [201, { id, till: val.enhet.namn, fran: 'Egen vårdbegäran via Min journal', egen: true, status: 'skickad', svarSenast: addDagar(idag(), SVAR_DAGAR), bilaga: Boolean(bilaga) }];
}
