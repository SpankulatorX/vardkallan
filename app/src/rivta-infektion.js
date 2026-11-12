// Runda 14, r3: Infektionsverktyget (Sussa 2.2.1.13) med riv.processdevelopment.infections 1.0.2, RIVTA Basic Profile
// 2.0. Vårdkällan är konsument och skickar det som verktyget följer upp:
//   ProcessCareEncounter        vårdtillfällen i slutenvård;
//   ProcessCondition            infektionsdiagnoser (ICD-10-SE);
//   ProcessPrescriptionReason   antibiotika (ATC J01) med ordinationsorsaken, som systemet tar ur patientens
//                               infektionsdiagnos på vårdenheten, och smittvägen, som systemet räknar ut;
//   DeleteCondition             när en diagnos inte längre finns i journalen.
// Meddelandena är openEHR-kompositioner. De byggs ur kontraktets egna mallar i domänen (Mall *.xml), där systemet fyller
// i variablerna, och valideras mot schemat som alla andra meddelanden. Mallarna följer inte schemat på två ställen
// (template_id och namnet på tillståndet med å), och då gäller schemat.
//
// Systemet är experten: överföringen görs av systemet, och läkaren behöver aldrig välja smittväg eller ordinationsorsak
// i en separat dialog. Smittvägen är vårdrelaterad när diagnosen ställdes mer än 48 timmar efter inskrivningen och
// annars samhällsförvärvad (demoregel). Patienter med skyddade personuppgifter lämnas inte ut, med samma prövning som
// alla utgående registreringar (provaUtlamning). Infektionsverktyget är simulerat (rivta-infektion-simulerad.js).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { iso } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { tolka, barn } from './rivta/xml.js';
import { RIVTA_ROT } from './rivta/kontrakt.js';
import { vardgivare } from './rivta/konsumenter.js';
import * as r3 from './rivta-r3.js';

const DOMAN = 'riv.processdevelopment.infections';
export const DEF = {
  vardkontakt: () => r3.def(DOMAN, 'ProcessCareEncounter', '1.0'),
  tillstand: () => r3.def(DOMAN, 'ProcessCondition', '1.0'),
  orsak: () => r3.def(DOMAN, 'ProcessPrescriptionReason', '1.0'),
  taBortTillstand: () => r3.def(DOMAN, 'DeleteCondition', '1.0'),
};
export const LOGISK_ADRESS = 'SE0000000000-SIMINFEKTION';
const MALL = { vardkontakt: ['ProcessCareEncounterInteraction', 'Mall CareEncounter.xml'], tillstand: ['ProcessConditionInteraction', 'Mall Condition.xml'],
  orsak: ['ProcessPrescriptionReasonInteraction', 'Mall PrescriptionReason Condition.xml'], taBortTillstand: ['DeleteConditionInteraction', 'Mall_DeleteCondition.xml'] };
// Diagnoser som verktyget följer upp (demoregel, ett urval ur triggerlistan): bakteriella infektioner och sepsis,
// övre och nedre luftvägsinfektioner, urinvägsinfektioner och hudinfektioner.
export const INFEKTION = /^(A[0-4]\d|B9[5-7]|J0[0-6]|J1[2-8]|J2[0-2]|N10|N30|N39\.0|L0[0-3]|T81\.4)/;
const ANTIBIOTIKA = /^J01/;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS infektion_overforingar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, slag TEXT NOT NULL, kalla_id TEXT NOT NULL, resultat TEXT NOT NULL, tid TEXT NOT NULL,
  UNIQUE (slag, kalla_id)
);
`;
export const sakra = (db) => db.exec(SCHEMA);

let transportTill = () => { throw new r3.RivtaFel('transport', 'Infektionsverktyget är inte anslutet.'); };
export const sattTransport = (fn) => { transportTill = fn; };

const xmlEsc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const tid = (t) => new Date(t).toISOString().slice(0, 19);
let mallar = null;
function mall(namn) {
  mallar ??= {};
  if (!mallar[namn]) {
    const [kat, fil] = MALL[namn];
    const d = join(RIVTA_ROT, DOMAN, 'schemas', 'interactions', kat);
    if (!readdirSync(d).includes(fil)) throw new Error(`Mallen ${fil} saknas.`);
    mallar[namn] = readFileSync(join(d, fil), 'utf8')
      .replace('template_id="Vårdkontakt"', 'template_id="Vardkontakt"').replace('template_id="Tillstånd"', 'template_id="Tillstand"')
      .replace(/(<urn1:name>\s*<urn1:value>)Tillstånd(<\/urn1:value>)/, '$1Tillstand$2');
  }
  return mallar[namn];
}
// Mallen med variablerna ifyllda, som kroppens element.
export function bygg(namn, varden) {
  const text = mall(namn).replace(/\$\$([^<"]+)/g, (m, k) => {
    const n = k.trim();
    if (!Object.hasOwn(varden, n)) throw new Error(`Variabeln ${n} saknas för ${namn}.`);
    return xmlEsc(varden[n]);
  });
  return barn(tolka(text), 'Body', 'http://schemas.xmlsoap.org/soap/envelope/').barn[0];
}

function patientVarden(p) {
  const nr = String(p.personnummer).replace(/\D/g, '');
  return { personid: nr, 'person-id': nr, oid_personid: Number(nr.slice(6, 8)) > 60 ? '1.2.752.129.2.1.3.3' : '1.2.752.129.2.1.3.1', issuer_personid: 'Skatteverket', assigner_personid: 'Folkbokföringen',
    födelsetidpunkt: `${p.fodd}T00:00:00`, kön: p.kon === 'kvinna' ? '2' : p.kon === 'man' ? '1' : '0' };
}

async function skicka(db, namn, rad, varden, slag, kallaId) {
  if (db.query('SELECT 1 FROM infektion_overforingar WHERE slag = ? AND kalla_id = ? AND resultat = ?').get(slag, kallaId, 'ok')) return 'redan';
  let resultat = 'fel';
  try {
    const svar = await r3.anropa(db, DEF[namn](), { logiskAdress: LOGISK_ADRESS, begaran: bygg(namn, { logical_address: LOGISK_ADRESS, ...varden }), transport: transportTill(db) });
    resultat = svar.ResultCode === 'OK' ? 'ok' : 'fel';
  } catch (x) { if (!(x instanceof r3.RivtaFel)) throw x; }
  db.query('INSERT INTO infektion_overforingar (patient_id, enhet_id, slag, kalla_id, resultat, tid) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (slag, kalla_id) DO UPDATE SET resultat = excluded.resultat, tid = excluded.tid')
    .run(rad.patient_id, rad.enhet_id, slag, kallaId, resultat, iso());
  return resultat;
}

// Överför det som inte är överfört än. Ger antalet per slag. Körs av systemet, utan att någon behöver göra något.
export async function overfor(db, { patientId = null } = {}) {
  const vg = vardgivare(db);
  const hsa = (enhetId) => db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(vardenhetFor(db, enhetId))?.hsa_id;
  const ut = { vardkontakter: 0, tillstand: 0, orsaker: 0, borttagna: 0, utelamnade: 0 };
  const pat = new Map();
  const patient = (id) => (pat.has(id) ? pat.get(id) : pat.set(id, db.query('SELECT * FROM patienter WHERE id = ?').get(id)).get(id));
  const far = (id, enhetId) => {
    const p = patient(id);
    const pr = r3.provaUtlamning(db, p, { slag: 'uppfoljning', enhetId });
    if (!pr.tillaten || !/^\d{12}$/.test(String(p?.personnummer ?? '').replace(/\D/g, ''))) { ut.utelamnade++; return false; }
    return true;
  };
  const filter = patientId ? 'AND patient_id = ?' : '';
  const arg = patientId ? [patientId] : [];
  // Vårdtillfällen i slutenvård.
  for (const v of db.query(`SELECT * FROM vardkontakter WHERE typ = 'slutenvard' AND coalesce(kalla, 'vardkallan') = 'vardkallan' ${filter}`).all(...arg)) {
    if (!far(v.patient_id, v.enhet_id)) continue;
    const r = await skicka(db, 'vardkontakt', v, { ...patientVarden(patient(v.patient_id)), vårdgivare: vg, 'registrerande enhet': hsa(v.enhet_id), vårdkontaktid: `VK-${v.id}`,
      vårdkontakttid_starttidpunkt: tid(v.start), vårdkontakttid_sluttidpunkt: tid(v.slut ?? v.start) }, 'vardkontakt', String(v.id));
    if (r === 'ok') ut.vardkontakter++;
  }
  // Infektionsdiagnoser.
  const diagnoser = db.query(`SELECT * FROM diagnoser WHERE coalesce(kalla, 'vardkallan') = 'vardkallan' ${filter}`).all(...arg).filter(d => INFEKTION.test(d.kod));
  for (const d of diagnoser) {
    if (!far(d.patient_id, d.enhet_id)) continue;
    const r = await skicka(db, 'tillstand', d, { ...patientVarden(patient(d.patient_id)), vårdgivare: vg, 'registrerande enhet': hsa(d.enhet_id), tillståndsid: `D-${d.id}`,
      tillståndskod: d.kod.replace('.', ''), tillståndstid: `${d.datum.slice(0, 10)}T00:00:00` }, 'tillstand', String(d.id));
    if (r === 'ok') ut.tillstand++;
  }
  // Antibiotika med ordinationsorsak: den senaste infektionsdiagnosen på samma vårdenhet.
  for (const o of db.query(`SELECT o.*, k.atc FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE coalesce(o.kalla, 'vardkallan') = 'vardkallan' ${patientId ? 'AND o.patient_id = ?' : ''}`).all(...arg)) {
    if (!ANTIBIOTIKA.test(o.atc) || !far(o.patient_id, o.enhet_id)) continue;
    const ve = vardenhetFor(db, o.enhet_id);
    const d = diagnoser.filter(x => x.patient_id === o.patient_id && vardenhetFor(db, x.enhet_id) === ve).sort((a, b) => b.datum.localeCompare(a.datum))[0];
    if (!d) continue;
    const inskrivning = db.query("SELECT start FROM vardkontakter WHERE patient_id = ? AND typ = 'slutenvard' AND start <= ? ORDER BY start DESC LIMIT 1").get(o.patient_id, o.start);
    const smittvag = inskrivning && Date.parse(o.start) - Date.parse(inskrivning.start) > 48 * 3600_000 ? 'vard' : 'samhalle';
    const r = await skicka(db, 'orsak', o, { ...patientVarden(patient(o.patient_id)), vårdgivare: vg, 'registrerande enhet': hsa(o.enhet_id),
      registreringstidpunkt_ordinationstidpunkt: tid(o.start), registreringstidpunkt: tid(o.skapad), id_terminologi: '1.2.752.116.1.1.1', tillståndskod: d.kod.replace('.', ''), smittväg: smittvag,
      enhet_tillståndsid: hsa(d.enhet_id), tillståndsid: `D-${d.id}`, id_utgivare: 'CeHis', enhet_aktivitetsid: hsa(o.enhet_id), aktivitetsid: `O-${o.id}`, id_typ: '1.2.752.129.2.1.4.1',
      ordinationstidpunkt: tid(o.start), enhet_ordinationsid: hsa(o.enhet_id), ordinationsid: `O-${o.id}`, 'ATC-kod': o.atc }, 'orsak', String(o.id));
    if (r === 'ok') ut.orsaker++;
  }
  // En överförd diagnos som inte längre finns i journalen tas bort.
  const finns = new Set(diagnoser.map(d => String(d.id)));
  for (const t of db.query(`SELECT * FROM infektion_overforingar WHERE slag = 'tillstand' AND resultat = 'ok' ${filter}`).all(...arg)) {
    if (finns.has(t.kalla_id)) continue;
    const r = await skicka(db, 'taBortTillstand', t, { ConditionId: `D-${t.kalla_id}` }, 'borttagen', t.kalla_id);
    if (r === 'ok') ut.borttagna++;
  }
  return ut;
}

// Efter en ny diagnos eller ordination: överföringen för patienten görs i bakgrunden, bara när det gäller en
// infektionsdiagnos eller antibiotika, så att ingen handling i journalen väntar på verktyget.
export function efterAndring(db, patientId, { kod = null, atc = null } = {}) {
  if (!(kod && INFEKTION.test(kod)) && !(atc && ANTIBIOTIKA.test(atc))) return null;
  try { sakra(db); } catch { return null; }
  return r3.bakgrund(db, overfor(db, { patientId }));
}
