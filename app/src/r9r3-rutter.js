// API för runda 9, r3: specialistområdena i Sussa kapitel 4. Operation (operation.js), blodprodukter (blod.js), graviditet
// och förlossning (obstetrik.js), cytostatika (cytostatika.js) och bilder och media (bilder.js). En rad som anges med id
// hämtas först, och anropet prövas sedan på radens patient, så att loggen hamnar på rätt patient. Modulerna binder
// dessutom varje rad till patienten och prövar radens vårdenhet i behörighetsmotorn.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as op from './operation.js';
import * as blod from './blod.js';
import * as obs from './obstetrik.js';
import * as cyto from './cytostatika.js';
import * as bilder from './bilder.js';

const q = (c, namn) => c.url.searchParams.get(namn) || null;
const okand = () => { throw new Fel(404, 'Åtgärden finns inte.', 'saknas'); };
const kravStatistik = (c) => { if (!kanRoll(c.personal, 'statistik')) throw new Fel(403, 'Din yrkesroll har inte uppföljningen.', 'nekad'); };

// Schemat för alla fem modulerna, för seeden och för en sandlåda från före runda 9.
export function sakra(db) {
  op.sakra(db); blod.sakra(db); obs.sakra(db); cyto.sakra(db); bilder.sakra(db);
}

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal }) {
  const val = (c) => (pid) => valFor(c.s, pid);
  const medRad = (c, rad, handling, fn) => medPatient(c, rad.patient_id, handling, (atk) => fn(atk, rad));

  // ---- Operationsplanering (Sussa 4.5) ----
  rutt('GET', '/api/patient/:id/operation', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_operation', (atk) => op.forPatient(atk)); });
  rutt('GET', '/api/patient/:id/operation/forslag', (c, id) => { kravInloggad(c); return medPatient(c, id, 'operation_anmala', (atk) => op.anmalForslag(atk)); });
  rutt('POST', '/api/patient/:id/operation', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'operation_anmala', (atk) => op.anmal(atk, c.body))]; });
  rutt('GET', '/api/operation/vantelista', (c) => { kravInloggad(c); return op.vantelista(c.db, c.personal, val(c)); });
  rutt('GET', '/api/operation/oversikt', (c) => { kravInloggad(c); return op.oversikt(c.db, c.personal, val(c), { datum: q(c, 'datum') }); });
  rutt('GET', '/api/operation/uppfoljning', (c) => { kravInloggad(c); return op.uppfoljning(c.db, c.personal, { fran: q(c, 'fran'), till: q(c, 'till') }); });
  rutt('GET', '/api/operation/:aid/:del', (c, aid, del) => {
    kravInloggad(c);
    const an = op.anmalanRad(c.db, aid);
    if (del === 'planeringsforslag') return medRad(c, an, 'operation_planera', (atk, r) => op.planeringsforslag(atk, r));
    if (del === 'uppvakning') return medRad(c, an, 'las_operation', (atk, r) => op.uppvakning(atk, r));
    if (del === 'checklista') return medRad(c, an, 'las_operation', (atk, r) => ({ underlag: op.checklistaUnderlag(atk, r), checklista: op.CHECKLISTA }));
    return okand();
  });
  const OP = {
    planera: ['operation_planera', (atk, r, b) => op.planera(atk, r, b)], stryk: ['operation_planera', (atk, r, b) => op.stryk(atk, r, b)],
    anestesi: ['operation_anmala', (atk, r, b) => op.anestesibedomning(atk, r, b)], prover: ['bestalla_prov', (atk, r) => op.bestallProver(atk, r)],
    checklista: ['operation_registrera', (atk, r, b) => op.checklista(atk, r, b)], handelse: ['operation_registrera', (atk, r, b) => op.registrera(atk, r, b)],
    implantat: ['operation_registrera', (atk, r, b) => op.implantat(atk, r, b)], kontroll: ['operation_registrera', (atk, r, b) => op.kontroll(atk, r, b)],
    'skriv-ut': ['operation_registrera', (atk, r, b) => op.skrivUt(atk, r, b)],
  };
  rutt('POST', '/api/operation/:aid/:atgard', (c, aid, atgard) => {
    kravInloggad(c);
    if (!Object.hasOwn(OP, atgard)) return okand();
    const [h, fn] = OP[atgard];
    return medRad(c, op.anmalanRad(c.db, aid), h, (atk, r) => fn(atk, r, c.body));
  });

  // ---- Blodprodukter (Sussa 4.4.2.12) ----
  rutt('GET', '/api/patient/:id/blod', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_prover', (atk) => blod.forPatient(atk)); });
  rutt('GET', '/api/patient/:id/blod/forslag', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_prover', (atk) => blod.forslag(atk, { produkt: q(c, 'produkt') ?? undefined })); });
  rutt('POST', '/api/patient/:id/blod', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'bestalla_prov', (atk) => blod.bestall(atk, c.body))]; });
  rutt('GET', '/api/blod/kontroller', (c) => { kravInloggad(c); return blod.vantandeKontroller(c.db, c.personal, val(c)); });
  // Runda 10, r6: den som beställde blodet kvitterar en avvikelse från transfusionskontrollen.
  rutt('POST', '/api/blod/avvikelse/:aid/kvittera', (c, aid) => {
    kravInloggad(c);
    blod.sakra(c.db);
    const a = /^\d{1,9}$/.test(String(aid)) ? c.db.query('SELECT patient_id FROM blod_avvikelser WHERE id = ?').get(Number(aid)) : null;
    if (!a) throw new Fel(404, 'Avvikelsen finns inte.', 'saknas');
    return medPatient(c, a.patient_id, 'las_prover', (atk) => blod.kvitteraAvvikelse(atk, aid));
  });
  rutt('POST', '/api/blod/:bid/utlamna', (c, bid) => { kravInloggad(c); return medRad(c, blod.bestallningRad(c.db, bid), 'ge_lakemedel', (atk, r) => blod.utlamna(atk, r)); });
  const BLOD = { forbered: (atk, e, b) => blod.forbered(atk, e, b), kontrollera: (atk, e, b) => blod.kontrollera(atk, e, b), starta: (atk, e) => blod.starta(atk, e),
    avsluta: (atk, e, b) => blod.avsluta(atk, e, b), aterlamna: (atk, e, b) => blod.aterlamna(atk, e, b) };
  // Runda 11, r4: en transfusionsreaktion rapporteras till blodcentralen (hemovigilans).
  BLOD.reaktion = (atk, e, b) => blod.reaktion(atk, e, b);
  rutt('POST', '/api/blodenhet/:eid/:atgard', (c, eid, atgard) => {
    kravInloggad(c);
    if (!Object.hasOwn(BLOD, atgard)) return okand();
    return medRad(c, blod.enhetRad(c.db, eid), 'ge_lakemedel', (atk, e) => BLOD[atgard](atk, e, c.body));
  });

  // ---- Graviditet och förlossning (Sussa 4.7) ----
  rutt('GET', '/api/patient/:id/graviditet', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_graviditet', (atk) => obs.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/graviditet', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'graviditet', (atk) => obs.registrera(atk, c.body))]; });
  rutt('GET', '/api/graviditet/uppfoljning', (c) => { kravInloggad(c); kravStatistik(c); return obs.uppfoljning(c.db, c.personal, { fran: q(c, 'fran'), till: q(c, 'till') }); });
  const GRAV = { ultraljud: (atk, g, b) => obs.ultraljud(atk, g, b), besok: (atk, g, b) => obs.besok(atk, g, b), prover: (atk, g) => obs.bestallProver(atk, g),
    forlossning: (atk, g, b) => obs.startaForlossning(atk, g, b) };
  rutt('POST', '/api/graviditet/:gid/:atgard', (c, gid, atgard) => {
    kravInloggad(c);
    if (!Object.hasOwn(GRAV, atgard)) return okand();
    return medRad(c, obs.graviditetRad(c.db, gid), atgard === 'prover' ? 'bestalla_prov' : 'graviditet', (atk, g) => GRAV[atgard](atk, g, c.body));
  });
  rutt('POST', '/api/forlossning/:fid/:atgard', (c, fid, atgard) => {
    kravInloggad(c);
    if (!['partogram', 'fodelse'].includes(atgard)) return okand();
    return medRad(c, obs.forlossningRad(c.db, fid), 'graviditet', (atk, f) => (atgard === 'partogram' ? obs.partogram(atk, f, c.body) : obs.fodelse(atk, f, c.body)));
  });

  // ---- Cytostatika (Sussa 4.8) ----
  rutt('GET', '/api/patient/:id/cytostatika', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_cytostatika', (atk) => cyto.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/cytostatika', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera_cytostatika', (atk) => cyto.ordinera(atk, c.body))]; });
  rutt('GET', '/api/cytostatika/kontroller', (c) => { kravInloggad(c); return cyto.vantandeKontroller(c.db, c.personal, val(c)); });
  rutt('GET', '/api/cytostatika/uppfoljning', (c) => { kravInloggad(c); return cyto.uppfoljning(c.db, c.personal, { fran: q(c, 'fran'), till: q(c, 'till') }); });
  rutt('GET', '/api/cytostatika/cykel/:cid/:del', (c, cid, del) => {
    kravInloggad(c);
    const cy = cyto.cykelRad(c.db, cid);
    if (del === 'provkontroll') return medRad(c, cy, 'las_cytostatika', (atk, r) => cyto.provkontroll(atk, r));
    if (del === 'beredningsorder') return medRad(c, cy, 'las_cytostatika', (atk, r) => cyto.beredningsorder(atk, r));
    return okand();
  });
  const CYKEL = { prover: ['bestalla_prov', (atk, r) => cyto.bestallProver(atk, r)], godkann: ['ordinera_cytostatika', (atk, r) => cyto.godkann(atk, r)],
    dosjustera: ['ordinera_cytostatika', (atk, r, b) => cyto.dosjustera(atk, r, b)], 'skjut-upp': ['ordinera_cytostatika', (atk, r, b) => cyto.skjutUpp(atk, r, b)],
    bered: ['ge_cytostatika', (atk, r) => cyto.bered(atk, r)] };
  rutt('POST', '/api/cytostatika/cykel/:cid/:atgard', (c, cid, atgard) => {
    kravInloggad(c);
    if (!Object.hasOwn(CYKEL, atgard)) return okand();
    const [h, fn] = CYKEL[atgard];
    return medRad(c, cyto.cykelRad(c.db, cid), h, (atk, r) => fn(atk, r, c.body));
  });
  rutt('POST', '/api/cytostatika/behandling/:bid/nasta', (c, bid) => { kravInloggad(c); return medRad(c, cyto.behandlingRad(c.db, bid), 'ordinera_cytostatika', (atk, r) => cyto.nastaCykel(atk, r)); });
  const DOS = { 'ta-emot': (atk, d, b) => cyto.taEmot(atk, d, b), iordningstall: (atk, d, b) => cyto.iordningstall(atk, d, b), kontrollera: (atk, d, b) => cyto.kontrollera(atk, d, b), ge: (atk, d) => cyto.ge(atk, d) };
  // Runda 11, r4: infusionens start, paus, återupptagande, reaktion, extravasering och slut.
  Object.assign(DOS, { starta: (atk, d) => cyto.startaInfusion(atk, d), pausa: (atk, d, b) => cyto.pausaInfusion(atk, d, b), ateruppta: (atk, d, b) => cyto.aterupptaInfusion(atk, d, b),
    reaktion: (atk, d, b) => cyto.reaktionInfusion(atk, d, b), extravasering: (atk, d) => cyto.extravasering(atk, d), avsluta: (atk, d) => cyto.avslutaInfusion(atk, d) });
  rutt('POST', '/api/cytostatika/dos/:did/:atgard', (c, did, atgard) => {
    kravInloggad(c);
    if (!Object.hasOwn(DOS, atgard)) return okand();
    return medRad(c, cyto.dosRad(c.db, did), 'ge_cytostatika', (atk, d) => DOS[atgard](atk, d, c.body));
  });

  // ---- Bilder och media (Sussa 4.2) ----
  const skriv = (c) => (kanRoll(c.personal, 'skriv_journal') ? 'skriv_journal' : 'skriv_omvardnad');
  const las = (c) => (kanRoll(c.personal, 'las_journal') ? 'las_journal' : 'las_omvardnad');
  rutt('GET', '/api/patient/:id/media', (c, id) => { kravInloggad(c); return medPatient(c, id, las(c), (atk) => bilder.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/media', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, skriv(c), (atk) => bilder.ladda(atk, c.body))]; });
  rutt('GET', '/api/patient/:id/media/jamforelse', (c, id) => { kravInloggad(c); return medPatient(c, id, las(c), (atk) => bilder.jamforelse(atk, q(c, 'kroppsstalle') ?? '')); });
  rutt('POST', '/api/patient/:id/media/remissbilaga/:bid', (c, id, bid) => { kravInloggad(c); return [201, medPatient(c, id, skriv(c), (atk) => bilder.franRemissbilaga(atk, bid, c.body))]; });
  rutt('POST', '/api/patient/:id/media/studie', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'remittera', (atk) => bilder.bestallUndersokning(atk, c.body))]; });
  rutt('GET', '/api/media/vantande', (c) => { kravInloggad(c); return bilder.vantande(c.db, c.personal, val(c)); });
  rutt('GET', '/api/media/:mid/fil', (c, mid) => { kravInloggad(c); return medRad(c, bilder.mediaRad(c.db, mid), las(c), (atk, m) => bilder.fil(atk, m)); });
  rutt('POST', '/api/media/:mid/granska', (c, mid) => { kravInloggad(c); return medRad(c, bilder.mediaRad(c.db, mid), 'skriv_journal', (atk, m) => bilder.granska(atk, m, c.body)); });
  rutt('GET', '/api/media/studie/:sid/visa', (c, sid) => { kravInloggad(c); return medRad(c, bilder.studieRad(c.db, sid), 'las_journal', (atk, s) => bilder.visaStudie(atk, s)); });
  // Patientens egen uppladdning i Min journal.
  rutt('GET', '/api/min/journal/:id/bild/mottagare', (c, id) => medMinJournal(c, id, 'min:bild:mottagare', (atk) => ({ mottagare: bilder.minMottagare(atk) })));
  rutt('POST', '/api/min/journal/:id/bild', (c, id) => [201, medMinJournal(c, id, 'min:bild', (atk) => bilder.minLaddaUpp(atk, c.body))]);
}
