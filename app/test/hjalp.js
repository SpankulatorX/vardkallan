// Gemensamma hjälpfunktioner för testerna.
import { nySessionsDb } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import { starta } from '../src/server.js';
// Runda 9, r5: en session som byter person i ett test får personens medarbetaruppdrag ur masterdata (idp.js).
import { uppdragUrMasterdata } from '../src/idp.js';
import { berordaEnheter } from '../src/arkiv.js';

export const nyDb = () => nySessionsDb();
export const personal = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
export const atk = (db, personalId, patientId, val = {}, handling = 'las_oversikt') => new Atkomst(db, personal(db, personalId), patientId, val, handling);

// Startar servern på en slumpvis port och ger en klient som håller sessionskakan.
export function testserver(opts = {}) {
  // Runda 13, r2: testerna skapar sandlådor fortare än en människa, så en sandlåda får flyttas till disk direkt efter ett
  // anrop när en ny behöver platsen (tryggSekunder 0).
  // Taken för tunga anrop och sandlådor per adress gäller människor; testerna prövar dem i missbruk-r13.test.js.
  const app = starta({ port: 0, hostname: '127.0.0.1', nyaPerTimme: 1000, tryggSekunder: 0, tidsbudgetSandladaMs: 1e9, tidsbudgetAdressMs: 1e9, maxPerAdress: 1e9, ...opts });
  return app;
}

export function klient(app, { origin = null } = {}) {
  let kaka = null;
  const anrop = async (metod, vag, kropp, extra = {}) => {
    // Runda 13, r3 (E2-5): en dos som ges utan skannat armband skickas med uppgiften om identiteten, på ett ställe för alla
    // tester som inte prövar just det. Ett test som vill pröva kravet skickar identitet: null.
    if (metod === 'POST' && /^\/api\/patient\/[^/]+\/administreringar$/.test(vag) && kropp && (kropp.atgard ?? 'ge') === 'ge' && !kropp.armband && !('identitet' in kropp)) {
      kropp = { ...kropp, identitet: { satt: 'id_band_hand' } };
    }
    const h = { ...extra };
    if (kaka) h.Cookie = kaka;
    if (kropp !== undefined) h['Content-Type'] = 'application/json';
    if (origin && metod !== 'GET') h.Origin = origin;
    const res = await fetch(app.url + vag, { method: metod, headers: h, body: kropp !== undefined ? JSON.stringify(kropp) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) kaka = sc.split(';')[0];
    const typ = res.headers.get('content-type') || '';
    const data = typ.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  };
  return {
    get: (v, extra) => anrop('GET', v, undefined, extra),
    post: (v, k = {}, extra) => anrop('POST', v, k, extra),
    put: (v, k = {}, extra) => anrop('PUT', v, k, extra),
    raw: anrop,
    kaka: () => kaka,
    async logga(personalId) { const r = await anrop('POST', '/api/login', { personalId }); if (r.status !== 200) throw new Error(JSON.stringify(r.data)); return r; },
  };
}

export const sandlada = (app, k) => app.sessioner.get(k.kaka().split('=')[1]);
// Låter en session vara inloggad som en annan person, med personens uppdrag, som efter en inloggning med biljett.
export function somPerson(s, id) { s.personalId = id; s.uppdrag = uppdragUrMasterdata(s.db, personal(s.db, id)); return s; }

// Runda 13, r3 (E3-35): verksamhetschefen för varje berörd vårdenhet godkänner verkställandet av en gallring eller
// radering i sin egen inloggning, i samma sandlåda som arkivarien. Varje vårdenhet i seeden har en verksamhetschef, och
// en vårdenhet som ett test har lagt till får en.
export async function godkannGallring(app, k, id) {
  const db = sandlada(app, k).db;
  const b = db.query('SELECT * FROM arkivbeslut WHERE id = ?').get(Number(id));
  const enheter = [...berordaEnheter(db, b).keys()];
  if (!enheter.length) enheter.push('uso-kard');
  let r;
  for (const ve of enheter) {
    let chef = db.query('SELECT personal_id FROM verksamhetschefer WHERE enhet_id = ?').get(ve)?.personal_id;
    if (!chef) {
      chef = `vch-test-${ve}`;
      db.query("INSERT OR IGNORE INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo) VALUES (?, 'Test Verksamhetschef', 'verksamhetschef', 'Verksamhetschef', ?, ?, 0)").run(chef, ve, chef);
      db.query('INSERT INTO verksamhetschefer (enhet_id, personal_id) VALUES (?, ?)').run(ve, chef);
    }
    const v = klient(app);
    await v.logga('vch-kard');
    const s = sandlada(app, v);
    s.db = db;
    somPerson(s, chef);
    r = await v.post(`/api/arkiv/beslut/${id}/godkann`, {});
    if (r.status !== 200) throw new Error(JSON.stringify(r.data));
  }
  return r;
}
