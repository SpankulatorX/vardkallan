// API för runda 7, r5: rapportering till myndigheter och register (myndighetsrapport.js) och de nationella
// tjänstekontrakten med den simulerade RIV-TA-producenten (tjanstekontrakt.js). Servern lämnar sina hjälpare hit, så
// att routningen ligger samlad. All behörighet prövas i behörighetsmotorn och varje åtkomst loggas.
//
// Uppföljningsrollen ser rapporterna, felen och antalen, men inga patientuppgifter: felen har ingen patient, och
// filerna visas bara med hur många rader som har varje fält ifyllt. När rapporten skickas loggas varje patient i filerna.
import { Fel } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import * as logg from './logg.js';
import * as mr from './myndighetsrapport.js';
import { KALLOR } from './rapportkoder.js';
import * as tk from './tjanstekontrakt.js';

// Det uppföljningsrollen får se av ett fel: ingen patient, ingen vårdkontakt, inget datum, ingen detalj ur journalen och
// ingen länk in i journalen. Vårdenheten och vem som rättar räcker för att följa upp.
const VEM = { diagnos: 'Läkare på vårdenheten', yttre_orsak: 'Läkare på vårdenheten', identitet: 'Vårdadministratör på vårdenheten', aktivitet: 'Vårdadministratör på vårdenheten', vantelista: 'Vårdadministratör på vårdenheten', mappning: 'Den som förvaltar rapporteringen' };
const felUtanPatient = (f, i) => ({ nyckel: `${f.rapport}:${f.regel}:${i + 1}`, rapport: f.rapport, regel: f.regel, text: f.text, enhet: f.enhet, atgard: f.atgard,
  vem: VEM[f.atgard], iInkorgen: ['diagnos', 'yttre_orsak', 'identitet', 'aktivitet', 'vantelista'].includes(f.atgard), lank: f.atgard === 'mappning' ? '#/rapportering?visa=mappning' : null });
// Filerna visas utan rader: bara hur många rader som har varje fält ifyllt. Alla fält i en rad, också datum, tider och
// id, kan tillsammans peka ut en patient, så inga värden lämnas ut till rapporteringsrollen.
const ifyllda = (f) => f.falt.map((namn, i) => ({ falt: namn, ifyllda: f.rader.filter(r => String(r[i] ?? '') !== '').length }));

function sammanfattning(db, s) {
  const senast = mr.historik(db, s.rapport.id)[0] ?? null;
  return {
    ...s.rapport, period: s.period, antal: s.antal, fel: s.fel.length, varningar: s.varningar.length, kvarhallna: s.kvarhallna,
    senast: senast ? { id: senast.id, skickad: senast.skickad, period: senast.period, kvittens: senast.kvittens } : null,
  };
}

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  const kravRoll = (c, handling) => {
    const p = kravInloggad(c);
    if (!kanRoll(p, handling)) {
      logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling, resurs: c.url.pathname, grund: 'nekad', resultat: 'nekad' });
      throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
    }
    return p;
  };
  const loggUtanPatient = (c, resurs) => logg.loggaRad(c.db, { personal_id: c.personal.id, enhet_id: c.personal.enhet_id, handling: 'myndighetsrapport', resurs, grund: 'uppfoljning', resultat: 'tillaten' });
  const rapportId = (id) => { if (!mr.RAPPORT_ID.includes(id)) throw new Fel(404, 'Det finns ingen sådan rapport.', 'saknas'); return id; };

  rutt('GET', '/api/rapportering', (c) => {
    kravRoll(c, 'myndighetsrapport');
    const rapporter = mr.RAPPORT_ID.map(id => sammanfattning(c.db, mr.sammanstall(c.db, id)));
    loggUtanPatient(c, 'rapport:oversikt');
    return { rapporter };
  });
  rutt('GET', '/api/rapportering/mappning', (c) => { kravRoll(c, 'myndighetsrapport'); return { enheter: mr.mappning(c.db), kallor: KALLOR }; });
  rutt('GET', '/api/rapportering/historik', (c) => { kravRoll(c, 'myndighetsrapport'); return { skickade: mr.historik(c.db) }; });
  rutt('GET', '/api/rapportering/aterkoppling', (c) => { kravRoll(c, 'myndighetsrapport'); return { aterkoppling: mr.senasteAterkoppling(c.db) }; });
  rutt('GET', '/api/rapportering/:id', (c, id) => {
    kravRoll(c, 'myndighetsrapport');
    const s = mr.sammanstall(c.db, rapportId(id));
    loggUtanPatient(c, `rapport:${id}:granska`);
    return {
      ...sammanfattning(c.db, s),
      filer: s.filer.map(f => ({ kod: f.kod, namn: f.namn, rubrik: f.rubrik, falt: f.falt, antal: f.antal, sha256: f.sha256, ifyllda: ifyllda(f) })),
      felLista: s.fel.map(felUtanPatient), varningLista: s.varningar.map(v => ({ text: v.text })), undantag: s.undantag, format: s.format,
    };
  });
  rutt('POST', '/api/rapportering/:id/skicka', (c, id) => {
    const p = kravRoll(c, 'myndighetsrapport');
    const ut = mr.skicka(c.db, p, rapportId(id));
    return [201, ut];
  });

  // Rättningar: läkaren registrerar en diagnos eller en yttre orsak på vårdkontakten, som systemet föreslår.
  rutt('GET', '/api/rapportering/rattning/val', (c) => { kravInloggad(c); return { yttreOrsak: mr.YTTRE_VAL, diagnoser: mr.DIAGNOSLISTA }; });
  rutt('POST', '/api/vardkontakt/:id/diagnos', (c, id) => {
    kravInloggad(c);
    const vk = mr.kontaktForRattning(c.db, id);
    return [201, medPatient(c, vk.patient_id, 'registrera_diagnos', (atk) => mr.registreraDiagnos(atk, vk, c.body))];
  });
  // Patienten motsätter sig registrering i kvalitetsregistret (patientdatalagen 7 kap. 2 §).
  rutt('POST', '/api/patient/:id/kvalitetsregister/motsatt', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'kvalitetsregister', (atk, p) => { atk.krav('kvalitetsregister'); const ut = mr.motsatt(c.db, c.personal, p.id); atk.logga('kvalitetsregister', atk.grund(), 'kvalitetsregister:motsatt'); return ut; })];
  });

  // Demoläget för rättningarna i inkorgen, i den egna sandlådan.
  rutt('POST', '/api/demo/rapportfel', (c) => {
    const p = kravInloggad(c);
    if (!kanRoll(p, 'registrera_diagnos')) throw new Fel(403, 'Demoläget kan bara skapas av en läkare.', 'nekad');
    return [201, mr.demoRapportfel(c.db)];
  });

  // De nationella tjänstekontrakten (K10) och den simulerade producenten.
  rutt('GET', '/api/tjanstekontrakt', (c) => {
    kravInloggad(c);
    return { kontrakt: tk.KONTRAKT, tjanster: tk.TJANSTER, symboler: tk.SYMBOLER, status: tk.STATUS, k10Rader: tk.K10_RADER, producenter: tk.PRODUCENTER };
  });
  rutt('POST', '/api/riv/:kontrakt', (c, kontrakt) => { kravInloggad(c); return tk.anropa({ ...c, valFor: (pid) => valFor(c.s, pid) }, kontrakt, c.body); });
}

// Rader i inkorgen: fel i rapporterna som den inloggade kan rätta. Läkaren får saknade diagnoser och yttre orsaker,
// vårdadministratören identiteter och väntelistans uppgifter, bara på den egna vårdenheten och bara när
// behörighetsmotorn ger åtkomst. Raden loggas på patienten en gång per session.
export function inkorg(c, patientKort, patientRad, valFor) {
  const p = c.personal;
  const lakare = kanRoll(p, 'registrera_diagnos');
  const admin = p.yrke === 'vardadministrator';
  if (!lakare && !admin) return { rapportfel: [] };
  const min = vardenhetFor(c.db, p.enhet_id);
  const atgarder = lakare ? ['diagnos', 'yttre_orsak'] : ['identitet', 'aktivitet', 'vantelista'];
  const handling = lakare ? 'registrera_diagnos' : 'las_admin';
  const loggade = (c.s.rapportfelLoggad ??= new Set());
  const ut = [];
  const sett = new Set();
  // Läkaren rättar diagnoser i patientregistret och födelseregistret, vårdadministratören identiteter och väntelistan.
  // Vårdtillfällesdatabasen har samma fel som patientregistrets slutenvård.
  for (const id of lakare ? ['par', 'mfr'] : ['par', 'viv']) {
    for (const f of mr.sammanstallCachad(c.db, id).fel) {
      if (!atgarder.includes(f.atgard) || !f.patientId || f.enhet?.id !== min) continue;
      const nyckel = `${f.regel}:${f.radNyckel}`;
      if (sett.has(nyckel)) continue;
      const atk = new Atkomst(c.db, p, f.patientId, valFor(c.s, f.patientId), handling);
      if (!atk.prova(handling, { enhet_id: f.enhet.id }).tillaten) continue;
      sett.add(nyckel);
      const resurs = `inkorg:rapportfel:${nyckel}`;
      if (!loggade.has(resurs)) { loggade.add(resurs); atk.logga(handling, atk.prova(handling, { enhet_id: f.enhet.id }).grund, resurs); }
      const vk = f.vardkontaktId ? c.db.query('SELECT * FROM vardkontakter WHERE id = ?').get(f.vardkontaktId) : null;
      ut.push({
        nyckel, regel: f.regel, atgard: f.atgard, text: f.text, detalj: f.detalj, datum: f.datum, rapporter: [mr.RAPPORTER[id].namn], patientId: f.patientId,
        patient: patientKort(patientRad(c.db, f.patientId)), vardkontaktId: f.vardkontaktId,
        forslag: f.atgard === 'diagnos' && vk ? mr.diagnosforslag(c.db, vk) : [],
      });
    }
  }
  return { rapportfel: ut };
}
