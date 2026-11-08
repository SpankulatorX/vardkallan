// Systemkonton för externa tillämpningar utan inloggad person (runda 10, r1, Sussa 2.5.1.2). Ett regionalt vårddatalager
// eller ett engagemangsindex hämtar nya, ändrade och borttagna poster för valda informationsmängder, utan att någon
// person sitter vid tillämpningen. Det görs med SMART Backend Services: tillämpningen har ett nyckelpar, systemförvaltaren
// registrerar den offentliga nyckeln, och tillämpningen byter ett klientintyg som den har signerat med sin privata nyckel
// mot en åtkomstbiljett (OAuth 2.0 client_credentials med private_key_jwt).
//
// Systemet är experten: systemförvaltaren väljer bara vad kontot ska få (informationsmängder) och för vilka vårdenheter.
// Systemet räknar fram omfånget och handlingarna i behörighetsmotorn och skriver på vanlig svenska vad kontot får.
//
// Reglerna, som behörighetsmotorn prövar för varje läsning och varje meddelande (atkomst.js, provaSystemkonto):
// - Kontot läser bara poster som har registrerats på någon av dess vårdenheter, och bara i dess informationsmängder.
//   Aktiva val, nödåtkomst och samtycke finns inte för ett systemkonto.
// - Patienter med skyddade personuppgifter lämnas aldrig ut till ett systemkonto.
// - Uppgifter som patienten har spärrat lämnas aldrig ut, eftersom kontot inte kan fråga patienten om samtycke.
// - Varje läsning och varje meddelande loggas på patienten med kontot som den som läste och grunden systemkonto.
// - Den privata nyckeln sparas aldrig i Vårdkällan. En nyckel med privat del avvisas.
// - Ett återkallat konto får inga biljetter, dess biljetter slutar gälla och dess prenumerationer avslutas.
import { createPublicKey, verify, randomBytes } from 'node:crypto';
import { Fel, iso } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';

export const HANDLING = 'forvalta_api';
export const TAK = { konton: 10 };
// Ett klientintyg får gälla högst fem minuter (SMART Backend Services), och biljetten gäller fem minuter.
export const INTYG_MAX_SEKUNDER = 5 * 60;
export const BILJETT_SEKUNDER = 5 * 60;
export const INTYG_TYP = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

// Informationsmängderna som ett systemkonto kan få, med resurstyperna och handlingen i behörighetsmotorn.
export const MANGDER = {
  diagnoser: { namn: 'diagnoser', typer: ['Condition'], handling: 'las_diagnoser' },
  matvarden: { namn: 'mätvärden', typer: ['Observation'], handling: 'las_matvarden' },
  lakemedel: { namn: 'läkemedel', typer: ['MedicationRequest'], handling: 'las_lakemedel' },
  overkanslighet: { namn: 'överkänsligheter', typer: ['AllergyIntolerance'], handling: 'las_oversikt' },
  vardkontakter: { namn: 'vårdkontakter', typer: ['Encounter'], handling: 'las_admin' },
};
// Patienten behövs för att posterna ska kunna knytas till rätt person, och prenumerationerna för att få meddelanden.
const ALLTID = ['system/Patient.r', 'system/Subscription.crds'];

export function sakraSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS api_systemkonton (
    id TEXT PRIMARY KEY, namn TEXT NOT NULL, syfte TEXT NOT NULL, vardenheter TEXT NOT NULL, mangder TEXT NOT NULL, omfang TEXT NOT NULL,
    nyckel TEXT NOT NULL, far TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, aterkallad TEXT, aterkallad_av TEXT, orsak TEXT);
  CREATE TABLE IF NOT EXISTS api_systemkonto_intyg (konto_id TEXT NOT NULL, jti TEXT NOT NULL, utgar TEXT NOT NULL, PRIMARY KEY (konto_id, jti));`);
}
const harSchema = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_systemkonton'").get());
const text = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const PERSONNUMMER = /\b(?:\d{2})?\d{6}[-+]?\d{4}\b/;
const lista = (ord) => (ord.length < 2 ? ord.join('') : `${ord.slice(0, -1).join(', ')} och ${ord.at(-1)}`);

function kravForvaltare(personal) {
  if (!kanRoll(personal, HANDLING)) throw new Fel(403, 'Bara systemförvaltaren registrerar och återkallar systemkonton.', 'nekad');
}
const logga = (db, personal, resurs, syfte) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: HANDLING, resurs, grund: 'administrativ', syfte });

// Kontot som behörighetsmotorn prövar mot: vårdenheterna och handlingarna, eller null om kontot saknas eller är återkallat.
// Slås upp i databasen vid varje prövning, så att en återkallelse eller ändring gäller direkt.
export function kontoFor(db, id) {
  if (!harSchema(db)) return null;
  const r = db.query('SELECT * FROM api_systemkonton WHERE id = ? AND aterkallad IS NULL').get(String(id));
  if (!r) return null;
  const mangder = JSON.parse(r.mangder);
  return {
    id: r.id, namn: r.namn, vardenheter: JSON.parse(r.vardenheter), mangder, omfang: JSON.parse(r.omfang),
    handlingar: [...new Set(mangder.map(m => MANGDER[m].handling))], typer: mangder.flatMap(m => MANGDER[m].typer),
  };
}

// Systemets förslag ur informationsmängderna och vårdenheterna: omfånget och texten om vad kontot får.
export function forslag(db, { mangder, vardenheter } = {}) {
  const m = Array.isArray(mangder) ? [...new Set(mangder.map(String))] : [];
  if (!m.length) throw new Fel(400, 'Välj minst en informationsmängd som kontot ska få, till exempel diagnoser.', 'ogiltig', { falt: ['mangder'] });
  const okand = m.find(x => !Object.hasOwn(MANGDER, x));
  if (okand) throw new Fel(400, `Informationsmängden ${okand} finns inte för systemkonton.`, 'ogiltig', { falt: ['mangder'] });
  const v = Array.isArray(vardenheter) ? [...new Set(vardenheter.map(String))] : [];
  if (!v.length) throw new Fel(400, 'Välj de vårdenheter vars uppgifter kontot ska få.', 'ogiltig', { falt: ['vardenheter'] });
  const enheter = v.map(id => db.query('SELECT id, namn, typ FROM enheter WHERE id = ?').get(id));
  if (enheter.some(e => !e || e.typ !== 'vardenhet')) throw new Fel(400, 'Välj vårdenheter ur listan. En arbetsplats hör till sin vårdenhet.', 'ogiltig', { falt: ['vardenheter'] });
  const omfang = [...m.flatMap(x => MANGDER[x].typer.map(t => `system/${t}.rs`)), ...ALLTID];
  const far = `Läsa ${lista(m.map(x => MANGDER[x].namn))} som har registrerats på ${lista(enheter.map(e => e.namn))}, och patientens namn och identitet för de posterna. `
    + 'Kontot får meddelanden om nya, ändrade och borttagna poster med bara id. Aldrig patienter med skyddade personuppgifter, aldrig spärrade uppgifter och aldrig något från andra vårdenheter.';
  return { mangder: m, vardenheter: enheter.map(e => e.id), omfang, far };
}

// En offentlig nyckel i JWK för ES256 (EC P-256) eller RS384 (RSA). En nyckel med privat del avvisas, eftersom
// signeringsnycklar aldrig sparas i Vårdkällan.
export function provaNyckel(jwk) {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) throw new Fel(400, 'Ange tillämpningens offentliga nyckel som JWK.', 'ogiltig', { falt: ['nyckel'] });
  if (['d', 'p', 'q', 'dp', 'dq', 'qi', 'k'].some(k => Object.hasOwn(jwk, k))) {
    throw new Fel(400, 'Nyckeln innehåller den privata delen. Skicka bara den offentliga nyckeln. Den privata nyckeln stannar hos tillämpningen och sparas aldrig i Vårdkällan.', 'ogiltig', { falt: ['nyckel'] });
  }
  const ec = jwk.kty === 'EC' && jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string';
  const rsa = jwk.kty === 'RSA' && typeof jwk.n === 'string' && typeof jwk.e === 'string' && Buffer.from(jwk.n, 'base64url').length >= 256;
  if (!ec && !rsa) throw new Fel(400, 'Nyckeln ska vara en EC-nyckel på kurvan P-256 (ES256) eller en RSA-nyckel på minst 2048 bitar (RS384).', 'ogiltig', { falt: ['nyckel'] });
  const ren = ec ? { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } : { kty: 'RSA', n: jwk.n, e: jwk.e };
  try { createPublicKey({ key: ren, format: 'jwk' }); } catch { throw new Fel(400, 'Nyckeln går inte att läsa som en offentlig nyckel.', 'ogiltig', { falt: ['nyckel'] }); }
  return { ...ren, ...(typeof jwk.kid === 'string' ? { kid: jwk.kid.slice(0, 100) } : {}) };
}

const kontoUt = (db, r) => ({
  id: r.id, namn: r.namn, syfte: r.syfte, vardenheter: JSON.parse(r.vardenheter).map(id => ({ id, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id })),
  mangder: JSON.parse(r.mangder), omfang: JSON.parse(r.omfang), far: r.far, nyckel: { kty: JSON.parse(r.nyckel).kty, kid: JSON.parse(r.nyckel).kid ?? null },
  registrerad: r.registrerad, aterkallad: r.aterkallad, orsak: r.orsak,
  prenumerationer: db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prenumerationer'").get()
    ? db.query("SELECT COUNT(*) n FROM prenumerationer WHERE personal_id = ? AND status = 'aktiv'").get(r.id).n : 0,
});
export const konton = (db) => (harSchema(db) ? db.query('SELECT * FROM api_systemkonton ORDER BY registrerad').all().map(r => kontoUt(db, r)) : []);

// Registrerar ett systemkonto. Kontot får en egen rad i personalkatalogen med yrket systemkonto, så att behörighetsmotorn
// och åtkomstloggen behandlar det som den som läser. Raden kan aldrig logga in (idp.js).
export function registrera(db, personal, body = {}) {
  kravForvaltare(personal);
  sakraSchema(db);
  const namn = text(body.namn, 80);
  if (namn.length < 3) throw new Fel(400, 'Ange kontots namn, till exempel Regionens vårddatalager.', 'ogiltig', { falt: ['namn'] });
  const syfte = text(body.syfte, 500);
  if (syfte.length < 10) throw new Fel(400, 'Beskriv kort varför tillämpningen behöver uppgifterna, så att logggranskningen kan bedöma åtkomsten.', 'ogiltig', { falt: ['syfte'] });
  if (PERSONNUMMER.test(namn) || PERSONNUMMER.test(syfte)) throw new Fel(400, 'Texten ser ut att innehålla ett personnummer. Ett systemkonto beskrivs utan patientuppgifter.', 'ogiltig', { falt: ['syfte'] });
  const f = forslag(db, body);
  const nyckel = provaNyckel(body.nyckel);
  if (db.query('SELECT COUNT(*) n FROM api_systemkonton').get().n >= TAK.konton) throw new Fel(409, `Demon har plats för ${TAK.konton} systemkonton.`, 'ogiltig');
  // Id:t är kontots client_id. Det är slumpat och unikt över alla sandlådor, eftersom biljetten begärs utan sandlåda.
  const id = `sys-${randomBytes(9).toString('base64url')}`;
  const nu = iso();
  db.query('INSERT INTO personal (id, namn, yrke, titel, enhet_id, hsa_id, demo, aktiv) VALUES (?, ?, ?, ?, ?, ?, 0, 1)')
    .run(id, `Systemkonto: ${namn}`, 'systemkonto', 'Systemkonto för en extern tillämpning', f.vardenheter[0], `SE2321000164-${id.toUpperCase()}`);
  db.query('INSERT INTO api_systemkonton (id, namn, syfte, vardenheter, mangder, omfang, nyckel, far, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, namn, syfte, JSON.stringify(f.vardenheter), JSON.stringify(f.mangder), JSON.stringify(f.omfang), JSON.stringify(nyckel), f.far, nu, personal.id);
  logga(db, personal, `api:systemkonto:${id}`, `Systemkontot ${namn} registrerades med omfånget ${f.omfang.join(' ')}.`);
  return kontoUt(db, db.query('SELECT * FROM api_systemkonton WHERE id = ?').get(id));
}

// Återkallar kontot: inga nya biljetter, de som finns slutar gälla och kontots prenumerationer avslutas.
export function aterkalla(db, personal, id, body = {}, { aterkallaBiljetter = () => 0 } = {}) {
  kravForvaltare(personal);
  const r = harSchema(db) ? db.query('SELECT * FROM api_systemkonton WHERE id = ?').get(String(id)) : null;
  if (!r) throw new Fel(404, 'Systemkontot finns inte.', 'saknas');
  if (r.aterkallad) return { ...kontoUt(db, r), aterkallade: 0, avslutade: 0 };
  const orsak = text(body.orsak, 300);
  if (orsak.length < 3) throw new Fel(400, 'Ange varför systemkontot återkallas.', 'ogiltig', { falt: ['orsak'] });
  const nu = iso();
  db.query('UPDATE api_systemkonton SET aterkallad = ?, aterkallad_av = ?, orsak = ? WHERE id = ?').run(nu, personal.id, orsak, r.id);
  db.query('UPDATE personal SET aktiv = 0 WHERE id = ?').run(r.id);
  const harPren = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prenumerationer'").get();
  const avslutade = harPren ? db.query("UPDATE prenumerationer SET status = 'avslutad', avslutad = ?, orsak = ? WHERE personal_id = ? AND status = 'aktiv'").run(nu, 'Systemkontot återkallades.', r.id).changes : 0;
  const aterkallade = aterkallaBiljetter(r.id);
  logga(db, personal, `api:systemkonto:${r.id}:aterkallad`, `Systemkontot ${r.namn} återkallades: ${orsak}`);
  return { ...kontoUt(db, db.query('SELECT * FROM api_systemkonton WHERE id = ?').get(r.id)), aterkallade, avslutade };
}

// ---------------------------------------------------------------------------------------------------------------
// Klientintyget (SMART Backend Services): en JWT signerad med tillämpningens privata nyckel, med iss och sub lika med
// kontots id, aud lika med biljettadressen, exp högst fem minuter fram och ett jti som bara används en gång.

const delarAv = (jwt) => {
  const d = typeof jwt === 'string' ? jwt.split('.') : [];
  if (d.length !== 3) return null;
  try { return { huvud: JSON.parse(Buffer.from(d[0], 'base64url')), last: JSON.parse(Buffer.from(d[1], 'base64url')), data: `${d[0]}.${d[1]}`, sig: Buffer.from(d[2], 'base64url') }; } catch { return null; }
};
// Kontots id ur intyget, innan det är prövat, för att hitta sandlådan. Ger null om intyget inte går att läsa.
export const kontoIdI = (jwt) => { const d = delarAv(jwt); return typeof d?.last?.iss === 'string' && /^sys-[A-Za-z0-9_-]{12}$/.test(d.last.iss) ? d.last.iss : null; };

// Prövar intyget mot kontot i db. Ger kontot eller kastar Fel med en förklaring (OAuth-felet invalid_client).
export function provaIntyg(db, jwt, { aud, nu = Date.now() } = {}) {
  const fel = (t) => new Fel(401, t, 'invalid_client');
  const d = delarAv(jwt);
  if (!d) throw fel('Klientintyget går inte att läsa som en JWT.');
  const { huvud, last } = d;
  const id = kontoIdI(jwt);
  const r = id && harSchema(db) ? db.query('SELECT * FROM api_systemkonton WHERE id = ?').get(id) : null;
  if (!r) throw fel('Systemkontot finns inte.');
  if (r.aterkallad) throw fel('Systemkontot är återkallat.');
  const nyckel = JSON.parse(r.nyckel);
  const alg = nyckel.kty === 'EC' ? 'ES256' : 'RS384';
  if (huvud.alg !== alg) throw fel(`Klientintyget ska vara signerat med ${alg}.`);
  const nyckelObj = createPublicKey({ key: { kty: nyckel.kty, ...(nyckel.kty === 'EC' ? { crv: nyckel.crv, x: nyckel.x, y: nyckel.y } : { n: nyckel.n, e: nyckel.e }) }, format: 'jwk' });
  const ok = alg === 'ES256'
    ? verify('sha256', Buffer.from(d.data), { key: nyckelObj, dsaEncoding: 'ieee-p1363' }, d.sig)
    : verify('sha384', Buffer.from(d.data), nyckelObj, d.sig);
  if (!ok) throw fel('Signaturen stämmer inte med kontots offentliga nyckel.');
  if (last.sub !== id) throw fel('sub ska vara kontots id, som iss.');
  if (last.aud !== aud) throw fel('aud ska vara Vårdkällans biljettadress.');
  const sek = Math.floor(nu / 1000);
  if (!Number.isInteger(last.exp) || last.exp <= sek) throw fel('Klientintyget har gått ut.');
  if (last.exp > sek + INTYG_MAX_SEKUNDER) throw fel('Klientintyget får gälla högst fem minuter.');
  if (typeof last.jti !== 'string' || last.jti.length < 8 || last.jti.length > 200) throw fel('Klientintyget saknar jti.');
  db.query('DELETE FROM api_systemkonto_intyg WHERE utgar < ?').run(new Date(nu).toISOString());
  if (db.query('SELECT 1 FROM api_systemkonto_intyg WHERE konto_id = ? AND jti = ?').get(id, last.jti)) throw fel('Klientintyget har redan använts.');
  db.query('INSERT INTO api_systemkonto_intyg (konto_id, jti, utgar) VALUES (?, ?, ?)').run(id, last.jti, new Date(last.exp * 1000).toISOString());
  return kontoFor(db, id);
}

// Omfånget i biljetten: det som tillämpningen begär och kontot har, eller allt kontot har om inget begärs.
export function beviljat(konto, begart) {
  const b = String(begart ?? '').split(/\s+/).filter(Boolean);
  return b.length ? konto.omfang.filter(o => b.includes(o)) : konto.omfang;
}

// Behörighetsmotorns prövning för ett systemkonto (anropas från atkomst.js prova). patient är raden ur patienter.
export function prova(db, konto, { patient, handling, resurs }) {
  if (!konto) return { tillaten: false, skal: 'Systemkontot finns inte eller är återkallat.' };
  // Patientens namn och identitet (Patient) prövas på patientnivå och ingår alltid, så att posterna kan knytas till rätt
  // person. Allt annat kräver att kontot har fått informationsmängden.
  const identitet = !resurs?.enhet_id && ['las_oversikt', 'las_admin'].includes(handling);
  if (!konto.handlingar.includes(handling) && !identitet) return { tillaten: false, skal: 'Systemkontot har inte fått den informationsmängden.' };
  if (!patient) return { tillaten: false, skal: 'Patienten saknas.' };
  if (patient.skyddad) return { tillaten: false, skal: 'Patienter med skyddade personuppgifter lämnas inte ut till systemkonton.' };
  const sparrade = db.query('SELECT enhet_id FROM sparrar WHERE patient_id = ? AND aktiv = 1').all(patient.id).map(r => vardenhetFor(db, r.enhet_id));
  if (!resurs?.enhet_id) {
    // På patientnivå: patienten har en vårdkontakt eller en diagnos på någon av kontots vårdenheter.
    const har = konto.vardenheter.some(v => !sparrade.includes(v)
      && db.query('SELECT 1 FROM vardkontakter WHERE patient_id = ?1 AND enhet_id IN (SELECT id FROM enheter WHERE id = ?2 OR forald_id = ?2) LIMIT 1').get(patient.id, v));
    return har ? { tillaten: true } : { tillaten: false, skal: 'Patienten har inga uppgifter på systemkontots vårdenheter.' };
  }
  const enhet = vardenhetFor(db, resurs.enhet_id);
  if (!konto.vardenheter.includes(enhet)) return { tillaten: false, skal: 'Uppgiften är registrerad på en vårdenhet som systemkontot inte har fått.' };
  if (sparrade.includes(enhet)) return { tillaten: false, skal: 'Uppgiften är spärrad och lämnas inte ut till systemkonton.' };
  return { tillaten: true };
}
