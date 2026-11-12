// Gemensamma hjälpfunktioner för testerna.
import { nySessionsDb } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import { starta } from '../src/server.js';
// Runda 9, r5: en session som byter person i ett test får personens medarbetaruppdrag ur masterdata (idp.js).
import { uppdragUrMasterdata } from '../src/idp.js';

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
