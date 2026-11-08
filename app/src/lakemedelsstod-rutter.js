// API för läkemedelsprocessen, del 2 (runda 6, r2): mallar med flera ordinationer, upp- och nedtrappning, muntlig
// ordination, generella direktiv, makulering, utvärdering och uppföljning, fördjupad läkemedelsgenomgång, dosering över
// flera dygn och förpackningar. Servern lämnar sina hjälpare hit, så att routningen för de här delarna ligger samlad.
// All behörighet prövas i behörighetsmotorn och varje åtkomst loggas, som i resten av API:t.
import { Fel, idag } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
import * as administrering from './administrering.js';
import * as vardkontakt from './vardkontakt.js';
import * as stod from './lakemedelsstod.js';
import * as vagar from './ordinationsvagar.js';
import * as uppfoljning from './lakemedelsuppfoljning.js';
import * as vyer from './lakemedelsvyer.js';

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  const medOrdination = (c, id, handling, fn) => {
    kravInloggad(c);
    const o = lakemedel.hamtaRad(c.db, id);
    return medPatient(c, o.patient_id, handling, (atk) => fn(atk, o));
  };
  const katalog = (c, id) => {
    const lm = c.db.query('SELECT * FROM katalog WHERE id = ?').get(id ?? '');
    if (!lm) throw new Fel(400, 'Välj ett läkemedel i katalogen.', 'ogiltig', { falt: ['lakemedelId'] });
    return lm;
  };

  // Mallar med flera ordinationer (Sussa 3.5.1.3, 3.5.2.14).
  rutt('GET', '/api/patient/:id/ordinationspaket', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => vagar.paketLista(atk)); });
  rutt('GET', '/api/patient/:id/ordinationspaket/:paket', (c, id, paket) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => vagar.paketForslag(atk, paket)); });
  rutt('POST', '/api/patient/:id/ordinationspaket/:paket', (c, id, paket) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'ordinera', (atk) => vagar.ordineraPaket(atk, paket, c.body, { knytKontakt: (ut) => vardkontakt.knyt(atk, 'ordinationer', ut, c.body) }))];
  });
  rutt('POST', '/api/ordinationspaket', (c) => { const p = kravInloggad(c); return [201, vagar.faststallPaket(c.db, p, c.body)]; });

  // Upp- och nedtrappning (3.5.2.12): systemets förslag på schema för produkten.
  rutt('GET', '/api/patient/:id/lakemedel/trappning', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'ordinera', (atk) => {
      atk.krav('ordinera');
      const q = Object.fromEntries(c.url.searchParams);
      return stod.trappforslag(katalog(c, q.lakemedelId), q.startdos ? q : {});
    });
  });

  // Muntlig ordination (3.5.2.12).
  rutt('GET', '/api/patient/:id/muntlig-ordination', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'registrera_muntlig_ordination', (atk) => { administrering.kravVardande(atk, 'registrera_muntlig_ordination', null, 'muntlig_ordination:forslag'); return { lakare: vagar.muntligaLakare(atk), omedelbarTimmar: stod.MUNTLIG_OMEDELBAR_TIMMAR,
      // Runda 8, r4: läkaren och skälet från sjuksköterskans senaste muntliga ordination för patienten.
      senaste: vagar.senasteMuntlig(atk) }; });
  });
  rutt('POST', '/api/patient/:id/muntlig-ordination', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'registrera_muntlig_ordination', (atk) => vardkontakt.knyt(atk, 'ordinationer', vagar.registreraMuntlig(atk, c.body), c.body))];
  });
  rutt('POST', '/api/ordination/:id/muntlig/signera', (c, id) => medOrdination(c, id, 'ordinera', (atk, o) => vagar.signeraMuntlig(atk, o)));

  // Generella direktiv (3.5.2.15).
  rutt('GET', '/api/direktiv', (c) => { const p = kravInloggad(c); return vagar.direktivLista(c.db, p); });
  rutt('POST', '/api/direktiv', (c) => { const p = kravInloggad(c); return [201, vagar.faststallDirektiv(c.db, p, c.body)]; });
  rutt('POST', '/api/direktiv/:id/upphav', (c, id) => { const p = kravInloggad(c); return vagar.upphavDirektiv(c.db, p, id, c.body); });
  rutt('GET', '/api/patient/:id/direktiv', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => vagar.direktivForPatient(atk)); });
  rutt('POST', '/api/patient/:id/direktiv/:did', (c, id, did) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'ordinera_direktiv', (atk) => vardkontakt.knyt(atk, 'ordinationer', vagar.ordineraEnligtDirektiv(atk, did, c.body), c.body))];
  });

  // Makulering (3.5.2.2). Handlingen prövas i lakemedelsstod.makulera med vårdrelation på den egna vårdenheten.
  rutt('POST', '/api/patient/:id/makulera', (c, id) => {
    kravInloggad(c);
    const handling = c.body?.typ === 'vatskebalans' ? 'registrera_matvarde' : 'ge_lakemedel';
    return medPatient(c, id, handling, (atk) => stod.makulera(atk, c.body?.typ, c.body?.id, c.body, {
      // Makuleringen sparas och syns utan samtycke, så bara doser som syns utan samtycke kan makuleras (säkerhetsgranskning).
      kravVardande: administrering.kravVardande,
      synligaDoser: () => new Set(administrering.synligaAdministreringar(new Atkomst(c.db, atk.personal, atk.patientId, { ...atk.val, samtycke_sparr: false }, atk.handling)).map(a => a.id)),
    }));
  });

  // Utvärdering och uppföljning (3.5.2.10, 3.5.2.20).
  rutt('GET', '/api/ordination/:id/utvardering', (c, id) => medOrdination(c, id, 'las_lakemedel', (atk, o) => uppfoljning.utvarderingsunderlag(atk, o)));
  rutt('POST', '/api/ordination/:id/utvardering', (c, id) => medOrdination(c, id, 'utvardera_lakemedel', (atk, o) => [201, uppfoljning.utvardera(atk, o, c.body)]));
  rutt('GET', '/api/lakemedel/uppfoljning', (c) => { const p = kravInloggad(c); return uppfoljning.patientgrupp(c.db, p); });

  // Fördjupad läkemedelsgenomgång (3.5.1.6).
  rutt('GET', '/api/patient/:id/fordjupad-genomgang', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => uppfoljning.fordjupad(atk)); });
  rutt('POST', '/api/patient/:id/fordjupad-genomgang', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'lakemedelsgenomgang', (atk) => uppfoljning.startaFordjupad(atk))]; });
  rutt('POST', '/api/patient/:id/fordjupad-genomgang/:gid/steg', (c, id, gid) => { kravInloggad(c); return [201, medPatient(c, id, 'lakemedelsgenomgang', (atk) => uppfoljning.sparaSteg(atk, gid, c.body))]; });

  // Dosering över flera dygn (3.5.1.2, 3.5.1.8).
  rutt('GET', '/api/patient/:id/doseringsoversikt', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_lakemedel', (atk) => vyer.doseringsoversikt(atk, { fran: c.url.searchParams.get('fran') ?? undefined, dagar: c.url.searchParams.get('dagar') ?? undefined }));
  });
}

// Inkorgens rader för läkemedelsprocessen, del 2. Varje rad visar uppgifter om en patient och loggas därför på patienten,
// en gång per session och rad, som återinsättningen (runda 5).
export function inkorg(c, patientKort, patientRad) {
  const p = c.personal;
  const db = c.db;
  const loggade = (c.s.lakemedelsstodLoggad ??= new Set());
  const logga = (patientId, resurs) => {
    if (loggade.has(resurs)) return;
    loggade.add(resurs);
    const a = new Atkomst(db, p, patientId, {}, 'las_lakemedel');
    a.logga('las_lakemedel', a.prova('las_lakemedel').grund, resurs);
  };
  const med = (r, resurs) => { logga(r.patientId, resurs); return { ...r, patient: patientKort(patientRad(db, r.patientId)) }; };
  const provaUtanVal = (patientId, enhetId) => new Atkomst(db, p, patientId, {}, 'las_lakemedel').prova('las_lakemedel', { enhet_id: enhetId, gemensam: true }).tillaten;
  return {
    lakemedelsuppfoljningar: kanRoll(p, 'utvardera_lakemedel') ? uppfoljning.passeradeUppfoljningar(db, p).map(r => med(r, `inkorg:uppfoljning:${r.ordinationId}`)) : [],
    muntligaAttSignera: vagar.muntligaAttSignera(db, p, provaUtanVal).map(r => med(r, `inkorg:muntlig:${r.ordinationId}`)),
    fordjupadeGenomgangar: uppfoljning.genomgangarIInkorg(db, p).map(r => med(r, `inkorg:fordjupad_genomgang:${r.genomgangId}`)),
    licenserSomGarUt: licenserIInkorg(db, p),
  };
}

// Licenser för vårdenhetens licensläkemedel som går ut inom 30 dagar eller har gått ut, för läkarna på vårdenheten.
// Raden innehåller inga patientuppgifter.
function licenserIInkorg(db, personal) {
  if (personal.yrke !== 'lakare') return [];
  const ve = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(personal.enhet_id);
  const minVe = ve?.typ === 'arbetsplats' ? ve.forald_id : ve?.id;
  const grans = new Date(Date.parse(`${idag()}T12:00:00Z`) + 30 * 86400_000).toISOString().slice(0, 10);
  return db.query('SELECT l.*, k.namn FROM licenser l JOIN katalog k ON k.id = l.lakemedel_id WHERE l.patient_id IS NULL ORDER BY l.giltig_till').all()
    .filter(l => l.enhet_id === minVe && l.giltig_till <= grans)
    .filter(l => !db.query('SELECT 1 FROM licenser WHERE lakemedel_id = ? AND enhet_id = ? AND patient_id IS NULL AND giltig_fran <= ? AND giltig_till > ?').get(l.lakemedel_id, l.enhet_id, l.giltig_till, l.giltig_till))
    .map(l => ({ licensId: l.id, lakemedel: l.namn, licensnummer: l.licensnummer, giltigTill: l.giltig_till, utgangen: l.giltig_till < idag(),
      text: l.giltig_till < idag() ? `Licensen för ${l.namn} gick ut ${l.giltig_till}. Läkemedlet får inte ges förrän en ny licens är beviljad.` : `Licensen för ${l.namn} går ut ${l.giltig_till}. Ansök om förlängning hos Läkemedelsverket i god tid.` }));
}
