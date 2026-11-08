// Runda 9, r4: API för informationsstrukturen (NI), nationellt fackspråk, förvaltningen av kodverk och masterdatans
// källor (Sussa 5.1.2 och 5.1.3). Informationsmodellen och fackspråket innehåller inga patientuppgifter och läses av
// all inloggad personal. Kodverkens utgåvor och inläsningen av masterdata hör till systemförvaltningen, och
// behörigheten prövas i modulerna och här.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as informationsmodell from './informationsmodell.js';
import * as fackssprak from './fackssprak.js';
import * as kodverksforvaltning from './kodverksforvaltning.js';
import * as masterdata from './masterdata.js';
import { capability } from './fhir.js';
import { loggaRad } from './logg.js';
import * as migreringsimport from './migreringsimport.js';

const id = (s) => (/^\d{1,9}$/.test(String(s)) ? Number(s) : 0);
const personal = (c) => {
  if (!c.personal) throw new Fel(401, 'Logga in som personal först.', 'ej_inloggad');
  return c.personal;
};

export const fhirTyper = () => capability('').rest[0].resource.map(r => r.type);

export function registreraRutter({ rutt, kravInloggad }) {
  registreraMigrering({ rutt, kravInloggad });
  rutt('GET', '/api/informationsmodell', (c) => { kravInloggad(c); personal(c); return informationsmodell.modell(c.db, fhirTyper()); });
  rutt('GET', '/api/fackssprak', (c) => { kravInloggad(c); personal(c); return fackssprak.oversikt(); });

  rutt('GET', '/api/kodverk', (c) => { kravInloggad(c); return kodverksforvaltning.oversikt(c.db, personal(c)); });
  // Koderna i den utgåva som gäller i dag, för formulär och integrationer. Inga patientuppgifter.
  rutt('GET', '/api/kodverk/:id/koder', (c, kv) => { kravInloggad(c); personal(c); return kodverksforvaltning.koderUt(c.db, kv); });
  rutt('POST', '/api/kodverk/forhandsvisa', (c) => { kravInloggad(c); return kodverksforvaltning.forhandsvisa(c.db, personal(c), c.body); });
  rutt('POST', '/api/kodverk/utgavor', (c) => { kravInloggad(c); return [201, kodverksforvaltning.foresla(c.db, personal(c), c.body)]; });
  rutt('POST', '/api/kodverk/utgavor/:id/godkann', (c, u) => { kravInloggad(c); return kodverksforvaltning.godkann(c.db, personal(c), id(u), c.body); });
  rutt('POST', '/api/kodverk/utgavor/:id/avsluta', (c, u) => { kravInloggad(c); return kodverksforvaltning.avsluta(c.db, personal(c), id(u), c.body); });

  // Systemförvaltaren läser in en del av masterdatan direkt i stället för att vänta på schemat.
  rutt('POST', '/api/masterdata/:del/synkronisera', (c, del) => {
    kravInloggad(c);
    const p = personal(c);
    if (!kanRoll(p, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen läser in masterdata.', 'nekad');
    if (!Object.hasOwn(masterdata.KONTRAKT, del)) throw new Fel(404, 'Den delen av masterdata finns inte.', 'saknas');
    if (!masterdata.extern(c.db, del)) throw new Fel(400, `${masterdata.KONTRAKT[del].namn} förvaltas i Vårdkällan och läses inte in från en källa. Det ändras under Regler och parametrar.`, 'ogiltig');
    const rapport = masterdata.synkronisera(c.db, del);
    loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, handling: 'konfigurera', resurs: `masterdata:${del}`, grund: 'administrativ' });
    return { rapport, delar: masterdata.oversikt(c.db) };
  });
}

// Migreringen: förhandsvisa och läsa in ett uttag ur ett annat journalsystem, och filerna som har lästs in.
export function registreraMigrering({ rutt, kravInloggad }) {
  rutt('POST', '/api/migrering/forhandsvisa', (c) => { kravInloggad(c); return migreringsimport.forhandsvisa(c.db, personal(c), c.body.fil); });
  rutt('POST', '/api/migrering/las-in', (c) => { kravInloggad(c); return [201, migreringsimport.lasIn(c.db, personal(c), c.body.fil)]; });
  rutt('GET', '/api/migrering/filer', (c) => { kravInloggad(c); const p = personal(c); if (!kanRoll(p, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen läser in migreringsfiler.', 'nekad'); return { filer: migreringsimport.filer(c.db) }; });
}

// Schemat för masterdatan körs i början av varje anrop, som det simulerade laboratoriet.
export function efterTid(db) {
  try { masterdata.synkOmDags(db); } catch { /* en källa som fallerar får aldrig stoppa anropet; avvikelsen syns i översikten */ }
}
