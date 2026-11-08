// Runda 10, r5: API för kunskapsstödet, det kunskapsgenererande stödet, kollegakontrollen av högriskläkemedel,
// överföringen av läkemedelsberättelsen, vaccinationsprogrammen, den sammanhållna journalföringen och flödet på
// akutmottagningen. Behörigheten prövas i modulerna och av behörighetsmotorn, och varje anrop som rör en patient loggas
// på patienten som de andra anropen (medPatient).
import { Fel, idag } from './db.js';
import { alder, kanRoll } from './atkomst.js';
import * as kunskapsstod from './kunskapsstod.js';
import * as utfallsstod from './utfallsstod.js';
import * as hogrisk from './hogriskkontroll.js';
import * as lakemedel from './lakemedel.js';
import { OLAMPLIGA_ALDRE } from './lakemedelsregler.js';
import { synligaAdministreringar, kravVardande } from './administrering.js';
import * as overforing from './lakemedelsoverforing.js';

// Läkemedelsinformationen för ett läkemedel och patienten: eGFR enligt samma regel som säkerhetskontrollerna (från alla
// vårdenheter utan aktivt val men aldrig från en spärrad vårdenhet utan samtycke), patientens ålder och vårdenhetens
// erfarenhet av substansen.
export function lakemedelsinfo(atk, p, lakemedelId) {
  atk.krav('las_lakemedel');
  const lm = typeof lakemedelId === 'string' ? atk.db.query('SELECT * FROM katalog WHERE id = ?').get(lakemedelId) : null;
  if (!lm) throw new Fel(404, 'Läkemedlet finns inte i katalogen.', 'saknas');
  const ar = alder(p.fodd, idag());
  const info = kunskapsstod.lakemedelsinfo(lm, { egfr: lakemedel.egfrForSakerhet(atk), alder: ar, olampligAldre: OLAMPLIGA_ALDRE.find(x => lm.atc.startsWith(x.atc))?.text ?? null });
  atk.logga('las_lakemedel', atk.grund(), `lakemedelsinfo:${lm.id}`);
  return { ...info, utfall: utfallsstod.substans(atk.db, atk.personal, lm.atc) };
}

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  // Sussa 3.5.1.5: läkemedelsinformation vid ordination och administrering.
  rutt('GET', '/api/patient/:id/lakemedelsinfo/:lm', (c, id, lm) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk, p) => lakemedelsinfo(atk, p, decodeURIComponent(lm))); });
  // Sussa 3.2.1.3: vårdenhetens utfall för en standardplan, utan patientuppgifter.
  rutt('GET', '/api/utfall/vardplan/:mall', (c, mall) => { const pers = kravInloggad(c); if (!['lakare', 'sjukskoterska'].includes(pers.yrke)) throw new Fel(403, 'Utfallen visas för läkare och sjuksköterskor.', 'nekad'); return utfallsstod.vardplan(c.db, pers, mall); });
  // Kollegakontrollen av ett högriskläkemedel, i kollegans egen inloggning.
  rutt('POST', '/api/patient/:id/kollegakontroll/:kid', (c, id, kid) => { kravInloggad(c); return medPatient(c, id, 'ge_lakemedel', (atk) => hogrisk.kontrollera(atk, kid, { synligaAdministreringar, kravVardande }, c.body)); });
  // Sussa 3.5.1.1: läkemedelsberättelsen, läkemedelslistan och epikrisen till nästa vårdgivare.
  rutt('GET', '/api/patient/:id/lakemedelsoverforing', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => overforing.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/lakemedelsoverforing', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => overforing.skicka(atk, c.body)); });
  rutt('POST', '/api/lakemedelsoverforing/:id/kvittera', (c, id) => {
    const pers = kravInloggad(c);
    const rad = /^\d{1,9}$/.test(id) ? overforing.hamta(c.db, id) : null;
    // Kommunen kvitterar i planeringen den deltar i. Vårdens personal kvitterar på patienten, med loggning.
    if (kanRoll(pers, 'samverkan')) return overforing.kommunKvittera(c.db, pers, rad);
    if (!rad) throw new Fel(404, 'Överföringen finns inte.', 'saknas');
    return medPatient(c, rad.patient_id, 'las_lakemedel', (atk) => overforing.kvittera(atk, rad));
  });
  rutt('GET', '/api/samverkan/:id/lakemedel', (c, id) => overforing.forKommun(c.db, kravInloggad(c), id));
  // Vilka grupper av högriskläkemedel som kontrolleras i dag.
  rutt('GET', '/api/kollegakontroll/grupper', (c) => { kravInloggad(c); return { grupper: Object.entries(hogrisk.KATEGORIER).map(([gid, k]) => ({ id: gid, rubrik: k.rubrik, varfor: k.varfor, pa: hogrisk.aktiv(c.db, gid) })) }; });
}

// Inkorgen: doser på den egna vårdenheten som väntar på kollegakontroll, bara antal och utan patientuppgifter.
export function inkorg(c, patientKort) {
  const n = c.personal ? hogrisk.vantarPaKontroll(c.db, c.personal) : 0;
  return {
    // Läkemedelsöverföringar till vårdenheten som inte är kvitterade, för patienter med vårdrelation.
    lakemedelsoverforingar: c.personal ? overforing.inkorg(c.db, c.personal, patientKort) : [],
    kollegakontrollerAttGora: n ? [{ antal: n, text: `${n} ${n === 1 ? 'dos av ett högriskläkemedel väntar' : 'doser av högriskläkemedel väntar'} på kollegakontroll av en annan sjuksköterska eller läkare.`, lank: '#/administrering' }] : [],
  };
}
