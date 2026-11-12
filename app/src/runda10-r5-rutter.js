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
import * as vaccinationsprogram from './vaccinationsprogram.js';
import * as vardkontakt from './vardkontakt.js';
import * as sammanhallen from './sammanhallen.js';
import * as akut from './akutflode.js';

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

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
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
  // Sussa 3.5.1.7: de nationella vaccinationsprogrammen och rapporteringen till vaccinationsregistret (simulerat).
  rutt('GET', '/api/patient/:id/vaccinationsprogram', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_oversikt', (atk, p) => vaccinationsprogram.forPatient(atk, p)); });
  rutt('POST', '/api/patient/:id/vaccinationsprogram/vaccination', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vaccinera', (atk, p) => vaccinationsprogram.vaccinera(atk, p, c.body, vardkontakt.knyt)); });
  rutt('POST', '/api/patient/:id/vaccinationsprogram/tidigare', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vaccinera', (atk, p) => vaccinationsprogram.tidigare(atk, p, c.body)); });
  // Sussa 3.2.2.3: sammanhållen journalföring med en simulerad annan vårdgivare.
  rutt('GET', '/api/patient/:id/sammanhallen', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_journal', (atk) => sammanhallen.lage(atk, c.s, { sortera: c.url.searchParams.get('sortera') ?? 'nyast', typ: c.url.searchParams.get('typ') })); });
  rutt('POST', '/api/patient/:id/sammanhallen', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_journal', (atk) => sammanhallen.hamta(atk, c.s, c.body)); });
  rutt('POST', '/api/patient/:id/sammanhallen/aterkalla', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_journal', (atk) => sammanhallen.aterkalla(atk, c.s)); });
  // Runda 14, r2: tillfällig hävning av spärr hos en annan vårdgivare med patientens samtycke, och jämförelsen av
  // Vårdkällans spärrar med spärrtjänsten (tjänstekontrakten i RIVTA, simulerade i demon).
  rutt('POST', '/api/patient/:id/sammanhallen/hav-sparr', (c, id) => { kravInloggad(c); return medPatient(c, id, 'samtycke_sparr', (atk) => sammanhallen.havSparr(atk, c.s, c.body)); });
  rutt('GET', '/api/patient/:id/sparr/sparrtjansten', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_sparr', (atk) => sammanhallen.jamforSparrar(atk)); });
  // Sussa 3.2.3.5: flödet på akutmottagningen. Behörigheten prövas i akutflode.js, och varje åtgärd loggas på patienten.
  rutt('GET', '/api/akut', (c) => akut.tavla(c.db, kravInloggad(c), { prioritet: c.url.searchParams.get('prioritet'), steg: c.url.searchParams.get('steg') }));
  rutt('GET', '/api/akut/ledtider', (c) => akut.ledtiderPerPrioritet(c.db, kravInloggad(c)));
  rutt('POST', '/api/akut/ankomst', (c) => akut.ankomst(c.db, kravInloggad(c), c.body));
  // Den simulerade ambulansen: en egen avsändare i demons kontroll för simuleringar, inte en inloggad person.
  rutt('POST', '/api/demo/ambulans/forvarning', (c) => akut.forvarningFranAmbulansen(c, c.body));
  rutt('POST', '/api/akut/:id/triage', (c, id) => akut.triagera(c.db, kravInloggad(c), akut.hamta(c.db, id), c.body));
  rutt('POST', '/api/akut/:id/aktivitet', (c, id) => [201, akut.planera(c.db, kravInloggad(c), akut.hamta(c.db, id), c.body)]);
  rutt('POST', '/api/akut/:id/aktivitet/:aid/utford', (c, id, aid) => akut.utford(c.db, kravInloggad(c), akut.hamta(c.db, id), aid));
  rutt('POST', '/api/akut/:id/bedomning', (c, id) => akut.bedom(c.db, kravInloggad(c), akut.hamta(c.db, id)));
  rutt('POST', '/api/akut/:id/beslut', (c, id) => akut.besluta(c.db, kravInloggad(c), akut.hamta(c.db, id), c.body));
  rutt('POST', '/api/akut/:id/utregistrera', (c, id) => akut.utregistrera(c.db, kravInloggad(c), akut.hamta(c.db, id), c.body, (pid) => valFor(c.s, pid)));
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
