// API för runda 11, r4: cytostatika och blodprodukter i version 1.1. Regimbiblioteket med versioner och godkännande,
// vårdenhetens vy för cytostatika, beredningsenheten (cytostatika-beredning.js), premedicineringen, patientens
// rapporter i Min journal, transfusionsreaktionerna och blodcentralens vy (blod.js). Infusionens åtgärder finns bland
// dosens åtgärder i r9r3-rutter.js. En rad som anges med id hämtas först och prövas sedan på radens patient.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as cyto from './cytostatika.js';
import * as bered from './cytostatika-beredning.js';
import * as blod from './blod.js';

const q = (c, namn) => c.url.searchParams.get(namn) || null;

export function sakra(db) { bered.sakra(db); blod.sakra(db); }

// Om personalen arbetar på beredningsenheten, och om dess vårdenhet ger cytostatika, för menyn.
export function session(db, p) {
  sakra(db);
  const { vardenhetFor, enheterUnder } = require('./atkomst.js');
  const ve = vardenhetFor(db, p.enhet_id);
  const enheter = enheterUnder(db, ve);
  return {
    beredning: kanRoll(p, 'bereda_cytostatika') && ve === cyto.BEREDNINGSENHET_ID,
    cytostatika: kanRoll(p, 'las_cytostatika') && (cyto.ONKOLOGISKA.has(ve) || Boolean(db.query(`SELECT 1 FROM cyto_behandlingar WHERE enhet_id IN (${enheter.map(() => '?').join(', ')}) LIMIT 1`).get(...enheter))),
    // Läkare på en onkologisk enhet ordinerar cytostatika, så fliken Cytostatika visas för alla deras patienter.
    onkologi: cyto.ONKOLOGISKA.has(ve),
  };
}

// Om patienten har en cytostatikabehandling eller en blodbeställning som den inloggade får se.
export const huvud = (atk) => ({ specialistR11r4: { cytostatika: cyto.iHuvud(atk), blod: blod.iHuvud(atk) } });

// Inkorgen: regimversioner som väntar på den regimansvariga läkarens godkännande, och patienternas rapporter i Min
// journal där systemet har sagt att de ska ringa, för den läkare som ordinerade behandlingen. Rapporterna prövas och
// loggas på patienten en gång per session.
export function inkorg(c, patientKort, patientRad, valFor) {
  const db = c.db;
  const p = c.personal;
  if (!p) return {};
  cyto.sakra(db);
  const regim = cyto.arRegimansvarig(db, p) ? db.query("SELECT * FROM cyto_regimversioner WHERE status = 'vantar' AND skapad_av <> ? ORDER BY skapad").all(p.id)
    .map(v => ({ id: v.id, regim: JSON.parse(v.innehall).namn, version: v.version, andring: v.andring })) : [];
  const { Atkomst } = require('./atkomst.js');
  const loggade = (c.s.cytoRapportLoggad ??= new Set());
  const rapporter = [];
  for (const r of db.query(`SELECT r.*, b.ordinerad_av FROM cyto_patientrapporter r JOIN cyto_doser d ON d.id = r.dos_id JOIN cyto_cykler cy ON cy.id = d.cykel_id
    JOIN cyto_behandlingar b ON b.id = cy.behandling_id WHERE b.ordinerad_av = ? AND r.bedomning <> 'ok' AND r.tid >= ? ORDER BY r.id DESC`).all(p.id, new Date(Date.now() - 7 * 86400_000).toISOString())) {
    const atk = new Atkomst(db, p, r.patient_id, valFor(c.s, r.patient_id), 'las_cytostatika');
    const g = atk.prova('las_cytostatika', { enhet_id: r.enhet_id });
    if (!g.tillaten) continue;
    const resurs = `inkorg:cyto_rapport:${r.id}`;
    if (!loggade.has(resurs)) { loggade.add(resurs); atk.logga('las_cytostatika', g.grund, resurs); }
    rapporter.push({ id: r.id, patientId: r.patient_id, patient: patientKort(patientRad(db, r.patient_id)), datum: r.datum, bedomning: r.bedomning, text: cyto.RAPPORTRAD[r.bedomning] });
  }
  return { cytoRegimversioner: regim, cytoRapporter: rapporter };
}

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal }) {
  const val = (c) => (pid) => valFor(c.s, pid);
  const medRad = (c, rad, handling, fn) => medPatient(c, rad.patient_id, handling, (atk) => fn(atk, rad));

  // ---- Regimbiblioteket och vårdenhetens vy ----
  rutt('GET', '/api/cytostatika/regimer', (c) => { kravInloggad(c); return cyto.regimbibliotek(c.db, c.personal); });
  rutt('POST', '/api/cytostatika/regimer/:regim/version', (c, regim) => { kravInloggad(c); return [201, cyto.foreslaVersion(c.db, c.personal, regim, c.body)]; });
  rutt('POST', '/api/cytostatika/regimversion/:vid/:beslut', (c, vid, beslut) => {
    kravInloggad(c);
    if (beslut === 'godkann') return cyto.godkannVersion(c.db, c.personal, vid);
    if (beslut === 'avsla') return cyto.avslaVersion(c.db, c.personal, vid, c.body);
    throw new Fel(404, 'Åtgärden finns inte.', 'saknas');
  });
  rutt('GET', '/api/cytostatika/enhet', (c) => { kravInloggad(c); return cyto.enhetsvy(c.db, c.personal, val(c)); });
  rutt('POST', '/api/cytostatika/premed/:pid/ge', (c, pid) => { kravInloggad(c); return medRad(c, cyto.premedRad(c.db, pid), 'ge_cytostatika', (atk, r) => cyto.gePremed(atk, r, c.body)); });

  // ---- Beredningsenheten ----
  rutt('GET', '/api/beredning/arbetslista', (c) => { kravInloggad(c); return bered.arbetslista(c.db, c.personal); });
  rutt('POST', '/api/beredning/dos/:did/bered', (c, did) => { kravInloggad(c); return bered.bered(c.db, c.personal, did, c.body); });
  rutt('GET', '/api/beredning/lager', (c) => { kravInloggad(c); return bered.lager(c.db, c.personal); });
  rutt('POST', '/api/beredning/lager', (c) => { kravInloggad(c); return [201, bered.taEmotBatch(c.db, c.personal, c.body)]; });
  rutt('POST', '/api/beredning/lager/:lid/kassera', (c, lid) => { kravInloggad(c); return bered.kassera(c.db, c.personal, lid, c.body); });
  rutt('GET', '/api/beredning/sparbarhet', (c) => { kravInloggad(c); return bered.sparbarhet(c.db, c.personal, q(c, 'batch')); });
  rutt('POST', '/api/beredning/kapacitet', (c) => { kravInloggad(c); return bered.sattKapacitet(c.db, c.personal, c.body); });
  rutt('GET', '/api/beredning/uppfoljning', (c) => { kravInloggad(c); return bered.uppfoljning(c.db, c.personal, { fran: q(c, 'fran'), till: q(c, 'till') }); });

  // ---- Patientens uppföljning i Min journal ----
  rutt('POST', '/api/min/journal/:id/cytostatika/rapport', (c, id) => [201, medMinJournal(c, id, 'min:cytostatika:rapport', (atk) => cyto.minRapport(atk, c.body))]);

  // ---- Blod: transfusionsreaktioner och blodcentralen ----
  rutt('POST', '/api/blod/reaktion/:rid/prover', (c, rid) => {
    kravInloggad(c);
    blod.sakra(c.db);
    const r = /^\d{1,9}$/.test(String(rid)) ? c.db.query('SELECT patient_id FROM blod_reaktioner WHERE id = ?').get(Number(rid)) : null;
    if (!r) throw new Fel(404, 'Rapporten finns inte.', 'saknas');
    return [201, medPatient(c, r.patient_id, 'bestalla_prov', (atk) => blod.reaktionProver(atk, rid))];
  });
  rutt('GET', '/api/blodcentral', (c) => { kravInloggad(c); return blod.blodcentralVy(c.db, c.personal, val(c)); });

  // Demoläget: en godkänd kur som beredningsenheten kan bereda, bara i den egna sandlådan.
  rutt('POST', '/api/demo/cytostatika-kur', (c) => { kravInloggad(c); return require('./cytostatika-demo.js').godkannDemoKur(c.db); });
}
