// API för beställning och svar och för kontrollerna till avdelningen (runda 8, r1, Sussa 4.4 och testfall 3.1 till 3.3
// och 3.5). Servern lämnar sina hjälpare hit. All behörighet prövas i behörighetsmotorn, och varje åtkomst till
// patientuppgifter loggas i åtkomstloggen.
import { Fel } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import { ANALYS, LAB } from './labb-katalog.js';
import * as labb from './labb.js';
import * as kontroller from './kontroller.js';
import { etikettPdf, pdf } from './filformat.js';
import * as streckkod from './streckkod.js';
// Runda 11, r6: undersökningar, upprepade beställningar, underlag, rättade svar och patientnära analyser.
import * as undersokningar from './undersokningar.js';
import * as versioner from './labb-svarsversioner.js';
import * as underlag from './labb-underlag.js';
import * as patientnara from './patientnara.js';
import { varde as konfig } from './konfiguration.js';

const PDF_HUVUD = (namn) => ({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${namn}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
// Etikettskrivare per arbetsplats: avdelningarna har etikettskrivare och mottagningarna skriver ut på A4-ark. Runda 11,
// r6: vilka arbetsplatser som har etikettskrivare är en parameter i systemförvaltningen (Sussa 12.1.1.9). Formatet kan
// alltid väljas i utskriften.
export function etikettformatFor(db, enhetId) {
  const namn = db.query('SELECT namn FROM enheter WHERE id = ?').get(enhetId)?.namn;
  let lista = [];
  try { lista = konfig(db, 'labb.etikettskrivare'); } catch { /* standardvärdet saknas inte */ }
  return namn && lista.some(n => n.toLocaleLowerCase('sv') === namn.toLocaleLowerCase('sv')) ? 'etikett' : 'a4';
}

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  const q = (c, k) => c.url.searchParams.get(k);
  const medBestallning = (c, id, handling, fn) => {
    kravInloggad(c);
    const b = labb.bestallningRad(c.db, id);
    return medPatient(c, b.patient_id, handling, (atk, p) => fn(atk, labb.bestallningRad(c.db, b.id), p));
  };
  const bestallHandling = (c) => (kanRoll(c.personal, 'bestalla_prov') ? 'bestalla_prov' : 'bestalla_prov_uppdrag');

  // Fliken Prover: beställningarna och kontrollerna.
  rutt('GET', '/api/patient/:id/prover', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_prover', (atk) => {
      const ut = { ...labb.forPatient(atk), kontroller: kontroller.forPatient(new Atkomst(c.db, c.personal, atk.patientId, atk.val, 'las_prover')) };
      // Runda 11, r6: allt som är planerat för patienten, och vilka svar den inloggade har läst.
      ut.planerat = undersokningar.planerat(ut.bestallningar, ut.kontroller.kontroller);
      for (const b of ut.bestallningar) versioner.markeraLast(c.db, c.personal, labb.bestallningRad(c.db, b.id));
      return ut;
    });
  });
  // Runda 11, r6: förslaget har också undersökningarnas prioritet, vårdförlopp och frågor (undersokningar.js).
  rutt('GET', '/api/patient/:id/prover/forslag', (c, id) => { kravInloggad(c); return medPatient(c, id, bestallHandling(c), (atk, p) => {
    const f = labb.forslag(atk, p);
    for (const a of f.analyser) {
      const d = ANALYS[a.analys ?? a.id];
      if (d?.ror === 'undersokning') Object.assign(a, { undersokning: true, modalitet: d.modalitet ?? null, kontrast: Boolean(d.kontrast), magnet: Boolean(d.magnet), stralning: Boolean(d.stralning) });
      if (d?.lab) a.lab = { ...a.lab, ...labKort(d.lab) };
      if (d?.patientnara) a.patientnara = true;
    }
    return { ...f, undersokning: undersokningar.forslag(atk, p) };
  }); });
  rutt('POST', '/api/patient/:id/prover', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, bestallHandling(c), (atk) => undersokningar.bestall(atk, c.body))]; });
  rutt('POST', '/api/labb/:id/signera', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => labb.signera(atk, b)));
  rutt('POST', '/api/labb/:id/makulera', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => labb.makulera(atk, b, c.body)));
  rutt('POST', '/api/labb/:id/andra', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => labb.andra(atk, b, c.body)));
  rutt('POST', '/api/labb/:id/overlat', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => labb.overlat(atk, b, c.body)));
  rutt('POST', '/api/labb/:id/vidimera', (c, id) => medBestallning(c, id, 'vidimera_provsvar', (atk, b) => labb.vidimera(atk, b)));
  rutt('POST', '/api/labb/:id/skicka', (c, id) => medBestallning(c, id, 'ta_prov', (atk, b) => labb.skickaTagna(atk, b)));
  // Demoknappen: det simulerade laboratoriet svarar direkt.
  rutt('POST', '/api/labb/:id/simulera-svar', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => labb.simuleraSvar(atk, b)));
  rutt('POST', '/api/labb/prov/:id/tagen', (c, id) => {
    kravInloggad(c);
    const p = labb.provRad(c.db, id);
    // Runda 13, r3 (E2-53): armbandet för blodgruppering och bastest.
    return medPatient(c, p.patient_id, 'ta_prov', (atk) => labb.taProv(atk, labb.provRad(c.db, p.id), new Date(), { identitet: c.body?.identitet ?? null }));
  });

  // Etiketter och provtagningsanvisning. Streckkoden innehåller bara etikettens id.
  rutt('GET', '/api/labb/:id/etiketter', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => {
    const e = labb.etiketter(atk, b);
    return { ...e, format: etikettformatFor(c.db, c.personal.enhet_id), etiketter: e.etiketter.map(x => ({ ...x, svg: streckkod.svg(x.etikett) })) };
  }));
  rutt('GET', '/api/labb/:id/etiketter.pdf', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => {
    const e = labb.etiketter(atk, b);
    // Formatet följer skrivaren där den som skriver ut arbetar, och kan väljas i adressen.
    const format = ['etikett', 'a4'].includes(q(c, 'format')) ? q(c, 'format') : etikettformatFor(c.db, c.personal.enhet_id);
    const tid = (t) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });
    const sidor = e.etiketter.map(x => ({
      rader: [{ text: e.patient.namn, fet: true, storlek: 8 }, { text: e.patient.personnummer, storlek: 7 },
        { text: `${x.etikett}  ${e.nummer}`, fet: true }, { text: x.analyser.join(', ').slice(0, 60) }, { text: `${x.ror}, ${x.lab}`.slice(0, 60) },
        { text: x.provtagen ? `Tagen ${tid(x.provtagen)}` : `Planerad ${tid(x.planerad)}` }],
      streck: streckkod.streck(x.etikett),
    }));
    atk.logga('las_prover', atk.grund(), `labb:etiketter:${b.nummer}`);
    return new Response(etikettPdf(sidor, { format, titel: `Etiketter ${b.nummer}` }), { headers: PDF_HUVUD(`etiketter-${b.nummer}.pdf`) });
  }));
  rutt('GET', '/api/labb/:id/anvisning', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => labb.anvisning(atk, b)));
  rutt('GET', '/api/labb/:id/anvisning.pdf', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => {
    const a = labb.anvisning(atk, b);
    const rader = [{ text: `Provtagningsanvisning ${a.nummer}`, fet: true, storlek: 16 }, { text: `Planerad provtagning ${new Date(a.planerad).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}` }, { text: '' },
      ...a.steg.flatMap(s => [{ text: `${s.nr}. ${s.ror} (${s.farg}), etikett ${s.etikett}`, fet: true }, { text: `   ${s.analyser.join(', ')} till ${s.lab}. ${s.beskrivning}.` }]),
      ...(a.forbered.length ? [{ text: '' }, { text: 'Förberedelser', fet: true }, ...a.forbered.map(t => ({ text: t }))] : []),
      { text: '' }, { text: a.demoregel, storlek: 9 }];
    atk.logga('las_prover', atk.grund(), `labb:anvisning:${b.nummer}`);
    return new Response(pdf(rader, { titel: `Provtagningsanvisning ${a.nummer}` }), { headers: PDF_HUVUD(`anvisning-${a.nummer}.pdf`) });
  }));

  // Provtagningslistan för vårdenheten. Varje patient loggas en gång per session och dag.
  rutt('GET', '/api/provtagning', (c) => {
    kravInloggad(c);
    const ut = labb.provtagningslista(c.db, c.personal, (pid) => valFor(c.s, pid), { datum: q(c, 'datum') });
    loggaPatienter(c, ut.patienter.map(p => p.patient.id), 'ta_prov', `provtagning:${ut.datum}`);
    return ut;
  });
  rutt('GET', '/api/labb/uppfoljning', (c) => { kravInloggad(c); return labb.uppfoljning(c.db, c.personal, { dagar: Math.min(365, Math.max(1, Number(q(c, 'dagar')) || 30)) }); });

  // Kontrollerna (Sussas testfall 3.5) och de planerade uppgifterna per vårdenhet och dag.
  rutt('GET', '/api/patient/:id/kontroller', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_prover', (atk) => kontroller.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/kontroller', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera_kontroll', (atk) => kontroller.ordinera(atk, c.body))]; });
  rutt('POST', '/api/kontroll/:id/avsluta', (c, id) => {
    kravInloggad(c);
    const k = kontroller.kontrollRad(c.db, id);
    return medPatient(c, k.patient_id, 'ordinera_kontroll', (atk) => kontroller.avsluta(atk, k, c.body));
  });
  rutt('GET', '/api/planerat', (c) => {
    kravInloggad(c);
    const { patientIdn, ...ut } = kontroller.planerat(c.db, c.personal, (pid) => valFor(c.s, pid), { enhetId: q(c, 'enhet'), datum: q(c, 'datum') });
    loggaPatienter(c, patientIdn, 'las_prover', `planerat:${ut.enhet.id}:${ut.datum}`);
    return ut;
  });

  // Runda 11, r6: underlagen till beställningen och i svaren, med samma behörighet som beställningen.
  rutt('GET', '/api/labb/underlag/:id', (c, id) => {
    kravInloggad(c);
    const u = underlag.rad(c.db, id);
    return medBestallning(c, u.bestallning_id, 'las_prover', (atk, b) => {
      atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id }, beskrivning: `labb:underlag:${u.id}` });
      atk.logga('las_prover', atk.grund(), `labb:underlag:${u.id}`);
      return underlag.fil(u);
    });
  });
  rutt('POST', '/api/labb/:id/underlag', (c, id) => medBestallning(c, id, 'las_prover', (atk, b) => {
    atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
    if (vardenhetFor(c.db, c.personal.enhet_id) !== vardenhetFor(c.db, b.enhet_id) || !(kanRoll(c.personal, 'bestalla_prov') || c.personal.id === b.registrerad_av)) throw new Fel(403, 'Underlag bifogas av en läkare på den beställande vårdenheten eller av den som registrerade beställningen.', 'nekad');
    if (b.makulerad_tid) throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
    const filer = underlag.provaAlla(c.db, c.body.underlag, b.id);
    if (!filer.length) throw new Fel(400, 'Välj en fil att bifoga.', 'ogiltig', { falt: ['underlag'] });
    underlag.spara(c.db, b, filer, { av: c.personal.id });
    labb.historikRad(c.db, b, c.personal.id, 'Underlag bifogat', filer.map(f => f.namn).join(', '), new Date().toISOString());
    return { bestallning: labb.bestallningUt(c.db, labb.bestallningRad(c.db, b.id), c.personal), text: `${filer.length === 1 ? 'Underlaget är bifogat' : `${filer.length} underlag är bifogade`} till ${b.nummer}.` };
  }));
  // Rättade svar: demoknappen för det simulerade laboratoriet och kvittensen av ett rättat svar.
  rutt('POST', '/api/labb/:id/analys/:aid/simulera-rattelse', (c, id, aid) => medBestallning(c, id, 'las_prover', (atk, b) => {
    const a = c.db.query('SELECT * FROM labb_analyser WHERE id = ? AND bestallning_id = ?').get(Number(aid) || 0, b.id);
    if (!a) throw new Fel(404, 'Analysen finns inte i beställningen.', 'saknas');
    const r = versioner.simuleraRattelse(atk, b, a);
    return { bestallning: labb.bestallningUt(c.db, labb.bestallningRad(c.db, b.id), c.personal), text: `${r.text} (simulerat)` };
  }));
  rutt('POST', '/api/labb/analys/:aid/last', (c, aid) => {
    kravInloggad(c);
    const a = /^\d{1,9}$/.test(String(aid)) ? c.db.query('SELECT * FROM labb_analyser WHERE id = ?').get(Number(aid)) : null;
    if (!a) throw new Fel(404, 'Analysen finns inte.', 'saknas');
    return medBestallning(c, a.bestallning_id, 'las_prover', (atk) => versioner.kvitteraLast(atk, a));
  });
  // Patientnära analys: instrumentet mäter provet och skickar svaret genom det öppna gränssnittet (simulerat).
  rutt('POST', '/api/labb/prov/:id/instrument', (c, id) => {
    kravInloggad(c);
    const p = labb.provRad(c.db, id);
    return medPatient(c, p.patient_id, 'ta_prov', (atk) => patientnara.mat(atk, labb.provRad(c.db, p.id)));
  });
  // Röntgenklinikens arbetslista: inkomna undersökningar, prioritet, bokning, utförande och utlåtande.
  rutt('GET', '/api/undersokningar', (c) => { kravInloggad(c); return undersokningar.arbetslista(c.db, c.personal, new Date(), (c.s.undersokningarLoggade ??= new Set())); });
  rutt('POST', '/api/undersokningar/:id/boka', (c, id) => { kravInloggad(c); return undersokningar.boka(c.db, c.personal, id, c.body); });
  // Runda 13, r3 (E2-45): med bekräftelsen av patientens identitet.
  rutt('POST', '/api/undersokningar/:id/utford', (c, id) => { kravInloggad(c); return undersokningar.registreraUtford(c.db, c.personal, id, new Date(), c.body ?? {}); });
  rutt('POST', '/api/undersokningar/:id/simulera-utlatande', (c, id) => { kravInloggad(c); return undersokningar.simuleraUtlatande(c.db, c.personal, id); });
  rutt('GET', '/api/undersokningar/:id/underlag/:uid', (c, id, uid) => { kravInloggad(c); return undersokningar.underlagForUtforare(c.db, c.personal, id, uid); });

  // Loggar varje patient i en lista en gång per session och resurs, så att en vy som uppdateras inte fyller loggen.
  function loggaPatienter(c, idn, handling, resurs) {
    const loggade = (c.s.labbLoggad ??= new Set());
    for (const pid of new Set(idn)) {
      const k = `${resurs}:${pid}`;
      if (loggade.has(k)) continue;
      loggade.add(k);
      const a = new Atkomst(c.db, c.personal, pid, valFor(c.s, pid), handling);
      a.logga(handling, a.prova(handling).grund, resurs);
    }
  }
}

// Raderna i inkorgen. Varje rad loggas på patienten en gång per session och rad.
export function inkorg(c, patientKort, patientRad, valFor) {
  const ut = labb.inkorg(c.db, c.personal, (pid) => valFor(c.s, pid));
  // Runda 11, r6: rättade svar för den som har läst den tidigare versionen.
  ut.provsvarRattade = versioner.rattadeForPersonal(c.db, c.personal, (pid) => valFor(c.s, pid));
  const loggade = (c.s.labbInkorgLoggad ??= new Set());
  for (const [lista, typ] of [['provsvarAttVidimera', 'vidimera'], ['labbAttSignera', 'signera'], ['provsvarKritiska', 'kritisk'], ['provsvarRattade', 'rattat']]) {
    for (const r of ut[lista]) {
      const resurs = `inkorg:labb:${typ}:${r.nummer}`;
      if (!loggade.has(resurs)) {
        loggade.add(resurs);
        const a = new Atkomst(c.db, c.personal, r.patientId, valFor(c.s, r.patientId), 'las_prover');
        a.logga('las_prover', a.prova('las_prover').grund, resurs);
      }
      r.patient = patientKort(patientRad(c.db, r.patientId));
    }
  }
  return ut;
}

// Körs vid varje anrop med en sandlåda: det simulerade laboratoriet svarar på det som har hunnit bli klart.
export const efterTid = (db) => labb.forfallnaSvar(db);
// Runda 11, r6: patientens beställningar med status i Min journal (undersokningar.js).
export const MIN_DELAR = { bestallningar: (atk) => undersokningar.minBestallningar(atk) };
const labKort = (id) => { const l = LAB[id]; return l ? { id: l.id, namn: l.namn, kort: l.kort, hsa: l.hsa, disciplin: l.disciplin, simulerat: true } : {}; };
export { Fel };
