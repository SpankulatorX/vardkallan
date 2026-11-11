// API för medicinteknisk utrustning, anestesi och intensivvård (runda 9, r2, Sussa 3.6.1, 3.5.2.19 och 4.6.1). Servern
// lämnar sina hjälpare hit. All behörighet prövas i behörighetsmotorn, och varje åtkomst till patientuppgifter loggas i
// åtkomstloggen. Mottagningen från utrustningen (/mt/fhir och /mt/hl7v2) kräver utrustningens nyckel och ingen session.
import { Fel } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import * as journal from './journal.js';
import * as mt from './medicinteknik.js';
import * as iva from './iva.js';
import * as nems from './iva-nems.js';

const FHIR_JSON = { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' };
const utfall = (status, niva, text) => new Response(JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: niva, code: status >= 400 ? (status === 401 ? 'security' : status === 429 ? 'throttled' : 'invalid') : 'informational', diagnostics: text }] }), { status, headers: FHIR_JSON });
// Svaret på ett HL7 v2-meddelande: ACK med MSA AA (mottaget), AE (fel i meddelandet) eller AR (avvisat).
const hl7Svar = (kod, kontroll, text, status = 200) => new Response(`MSH|^~\\&|VARDKALLAN|VARDKALLAN|||${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}||ACK^R01^ACK|${kontroll || 'okand'}|P|2.6\rMSA|${kod}|${kontroll || ''}|${String(text).replace(/[|\r\n]/g, ' ')}\r`, { status, headers: { 'Content-Type': 'application/hl7-v2; charset=utf-8', 'Cache-Control': 'no-store' } });

// Mottagningen från utrustningen. nycklar är nyckellagret (medicinteknik.skapaNyckellager), finns säger om en sandlåda
// fortfarande finns och maxKropp är serverns tak för en förfrågan.
export function skapaMottagning({ nycklar, finns, maxKropp }) {
  return async function mottag(req, url) {
    const vag = url.pathname.replace(/\/+$/, '');
    const format = vag === '/mt/fhir' ? 'fhir' : vag === '/mt/hl7v2' ? 'hl7v2' : null;
    if (vag === '/mt' || vag === '/mt/format') {
      return new Response(JSON.stringify({ format: mt.FORMAT, koder: mt.KODER, tak: mt.TAK, demo: mt.DEMO }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (!format) return new Response('Okänd adress.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    const svara = (status, text, ok = false) => (format === 'fhir' ? utfall(status, ok ? 'information' : 'error', text) : hl7Svar(ok ? 'AA' : status === 400 ? 'AE' : 'AR', null, text, status));
    if (req.method !== 'POST') return svara(405, 'Utrustningen skickar med POST.');
    const auth = req.headers.get('authorization') ?? '';
    const nyckel = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    const k = nyckel ? nycklar.hitta(nyckel, finns) : null;
    if (!k) return svara(401, 'Utrustningens nyckel saknas eller gäller inte. Skapa en ny nyckel för utrustningen i Vårdkällan.');
    if (!nycklar.taktak(k)) return svara(429, `Utrustningen har skickat mer än ${mt.TAK.perMinut} meddelanden den senaste minuten. Vänta en stund.`);
    const typ = req.headers.get('content-type') ?? '';
    if (format === 'fhir' && !/^application\/(fhir\+)?json/.test(typ)) return svara(415, 'Skicka meddelandet som application/fhir+json.');
    if (format === 'hl7v2' && !/^(application\/hl7-v2|x-application\/hl7-v2\+er7|text\/plain)/.test(typ)) return svara(415, 'Skicka meddelandet som application/hl7-v2 eller text/plain.');
    const text = await req.text();
    if (text.length > maxKropp) return svara(413, 'Meddelandet är för stort.');
    let kropp = text;
    if (format === 'fhir') {
      try { kropp = JSON.parse(text); } catch { return svara(400, 'Meddelandet är inte giltig JSON.'); }
    }
    const kontroll = format === 'hl7v2' ? (text.split(/\r\n|\r|\n/)[0] ?? '').split(text[3] ?? '|')[9] ?? null : null;
    const r = mt.taEmot(k.s.db, k.utrustning, { format, kropp }, { matttyper: journal.MATTYPER });
    const status = r.status === 'mottaget' ? 200 : 422;
    if (format === 'hl7v2') return hl7Svar(r.status === 'mottaget' ? 'AA' : 'AE', kontroll, r.text, status);
    return utfall(status, r.status === 'mottaget' ? 'information' : 'error', r.text);
  };
}

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal, nycklar }) {
  const q = (c, k) => c.url.searchParams.get(k);
  // Loggar varje patient i en lista en gång per session och resurs, så att en vy som uppdateras inte fyller loggen.
  function loggaPatienter(c, idn, handling, resurs) {
    const loggade = (c.s.ivaLoggad ??= new Set());
    for (const pid of new Set(idn)) {
      const k = `${resurs}:${pid}`;
      if (loggade.has(k)) continue;
      loggade.add(k);
      const a = new Atkomst(c.db, c.personal, pid, valFor(c.s, pid), handling);
      a.logga(handling, a.prova(handling).grund, resurs);
    }
  }

  // Utrustningen: koppla, avsluta, godkänna värden och skapa en nyckel för en riktig utrustning.
  rutt('GET', '/api/patient/:id/mt', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk) => { atk.krav('las_matvarden'); return mt.patientvy(atk, journal.synligaMatvarden(atk)); }); });
  rutt('POST', '/api/patient/:id/mt/koppla', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'koppla_utrustning', (atk, p) => mt.koppla(atk, p, c.body))]; });
  rutt('POST', '/api/mt/koppling/:id/avsluta', (c, id) => {
    kravInloggad(c);
    const k = mt.kopplingRad(c.db, id);
    return medPatient(c, k.patient_id, 'koppla_utrustning', (atk) => mt.avsluta(atk, mt.kopplingRad(c.db, k.id), c.body));
  });
  rutt('POST', '/api/patient/:id/mt/godkann', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'godkanna_matvarde', (atk) => mt.godkann(atk, journal.synligaMatvarden(new Atkomst(c.db, c.personal, atk.patientId, atk.val, 'las_matvarden')), c.body));
  });
  rutt('GET', '/api/mt/utrustning', (c) => ({ utrustning: mt.utrustningFor(c.db, kravInloggad(c)), format: mt.FORMAT, demo: mt.DEMO }));
  rutt('POST', '/api/mt/utrustning/:id/nyckel', (c, id) => [201, nycklar.utfarda(c.s, kravInloggad(c), id)]);
  // Demoknappen: den simulerade monitorn skickar värdena för nu direkt, i samma format och genom samma mottagning.
  rutt('POST', '/api/mt/koppling/:id/simulera', (c, id) => {
    kravInloggad(c);
    const k = mt.kopplingRad(c.db, id);
    return medPatient(c, k.patient_id, 'koppla_utrustning', (atk) => {
      atk.krav('koppla_utrustning');
      const u = mt.utrustningRad(c.db, k.utrustning_id);
      if (!u.simulerad) throw new Fel(400, 'Bara den simulerade utrustningen skickar värden från Vårdkällan.', 'ogiltig');
      if (k.slut) throw new Fel(400, 'Kopplingen är avslutad.', 'ogiltig');
      const t = new Date().toISOString();
      const kropp = u.typ === 'monitor' ? mt.simuleradMonitor(c.db, u, k, t) : mt.simuleradPump(c.db, u, k, new Date(Date.now() - mt.PUMP_MIN * 60_000).toISOString(), t);
      if (!kropp) throw new Fel(400, 'Pumpen har ingen hastighet att rapportera för ordinationen.', 'ogiltig');
      return mt.taEmot(c.db, u, { format: 'fhir', kropp }, { simulerat: true, matttyper: journal.MATTYPER });
    });
  });
  // Pumparna på vårdenheten för Läkemedel att ge, och kvittering av en varning från pumpen.
  rutt('GET', '/api/mt/pumpar', (c) => {
    kravInloggad(c);
    const { pumpar, patientIdn } = mt.pumpar(c.db, c.personal, (pid) => valFor(c.s, pid));
    loggaPatienter(c, patientIdn, 'las_lakemedel', 'mt:pumpar');
    return { pumpar, demo: mt.DEMO };
  });
  rutt('POST', '/api/mt/pumphandelse/:id/kvittera', (c, id) => {
    kravInloggad(c);
    const h = /^\d{1,9}$/.test(id) && mt.finns(c.db) ? c.db.query('SELECT * FROM mt_pumphandelser WHERE id = ?').get(Number(id)) : null;
    if (!h) throw new Fel(404, 'Rapporten finns inte.', 'saknas');
    return medPatient(c, h.patient_id, 'ge_lakemedel', (atk) => mt.kvittera(atk, h, c.body));
  });

  // Patientens egna mätningar i Min journal.
  // Listan över de egna mätningarna är en del av Min journal (MIN_DELAR.egenmatning i server.js).
  rutt('POST', '/api/min/journal/:id/egenmatning', (c, id) => [201, medMinJournal(c, id, 'min:egenmatning', (atk) => mt.registreraEgen(atk, c.body, { matttyper: journal.MATTYPER }))]);

  // Intensivvården: översikten, övervakningen per patient, infusionerna, anestesibedömningen och uppföljningen.
  rutt('GET', '/api/iva', (c) => {
    kravInloggad(c);
    const { patientIdn, ...ut } = iva.oversikt(c.db, c.personal, (pid) => valFor(c.s, pid), { enhetId: q(c, 'enhet') });
    if (ut.enhet) loggaPatienter(c, patientIdn, 'las_matvarden', `iva:oversikt:${ut.enhet.id}`);
    return ut;
  });
  // Runda 11, r7: med vårdtyngden enligt NEMS (iva-nems.js).
  rutt('GET', '/api/iva/uppfoljning', (c) => nems.medNems(c.db, iva.uppfoljning(c.db, kravInloggad(c), { enhetId: q(c, 'enhet'), dagar: q(c, 'dagar') })));
  rutt('GET', '/api/patient/:id/iva', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk, p) => iva.overvakning(atk, p, { timmar: q(c, 'timmar') })); });
  rutt('GET', '/api/patient/:id/iva/vatska', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk) => iva.vatskaTimvis(atk, { timmar: Math.min(72, Math.max(1, Number(q(c, 'timmar')) || 24)) })); });
  rutt('GET', '/api/patient/:id/iva/infusion/forslag', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk, p) => iva.infusionsforslag(atk, p)); });
  rutt('POST', '/api/patient/:id/iva/infusion', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk, p) => iva.ordineraInfusion(atk, p, c.body))]; });
  rutt('POST', '/api/patient/:id/iva/infusion/:oid/dos', (c, id, oid) => { kravInloggad(c); return medPatient(c, id, 'ge_lakemedel', (atk) => iva.andraDos(atk, oid, c.body)); });
  rutt('GET', '/api/patient/:id/anestesi', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_journal', (atk, p) => {
      atk.krav('las_journal');
      return { bedomningar: iva.anestesiLista(atk), forslag: kanRoll(c.personal, 'anestesibedomning') ? iva.anestesiForslag(atk, p, { planerad: q(c, 'planerad'), anmalanId: q(c, 'anmalan') }) : null, anestesiformer: iva.ANESTESIFORMER };
    });
  });
  rutt('POST', '/api/patient/:id/anestesi', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'anestesibedomning', (atk, p) => iva.sparaAnestesi(atk, p, c.body))]; });
}

// Den simulerade utrustningen skickar det som har hunnit mätas. Ett fel stoppar aldrig anropet.
export function efterTid(db) {
  try { mt.efterTid(db, journal.MATTYPER); } catch (e) { console.error('Den simulerade utrustningen:', e.message); }
}
