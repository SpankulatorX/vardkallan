// Prenumerationer i FHIR R4, Subscription med rest-hook (runda 6, r5, Sussa 2.5.1.2). En extern tillämpning får veta att
// något är nytt, ändrat eller borttaget, till exempel ett regionalt vårddatalager eller ett engagemangsindex.
//
// Reglerna:
// - Samma behörighet som läsningen. Den som skapar prenumerationen måste få söka resurstypen för patienten, och före
//   varje meddelande prövar behörighetsmotorn att prenumerantens person fortfarande får läsa just den resursen, utan
//   aktiva val, nödåtkomst eller samtycke. Det som personen inte får läsa ger inget meddelande, och inget meddelande
//   säger att något dolt finns.
// - Meddelandet innehåller bara id: vilken prenumeration, händelsens nummer och resursens adress. Inga
//   patientuppgifter. Mottagaren hämtar resursen med sin egen behörighet, och den hämtningen loggas som vanligt.
// - Mottagaradressen ska vara godkänd av administratören (GODKANDA_MOTTAGARE). Den ska vara https på port 443, utan
//   inloggningsuppgifter i adressen, och namnet får inte peka på en intern adress. Omdirigeringar följs aldrig.
// - Varje meddelande loggas på patienten i åtkomstloggen.
//
// Ändringarna fångas med triggrar i databasen, så att allt som sparas kommer med, från gränssnittet, från FHIR-API:t och
// från systemets egna funktioner. Triggrarna läggs till när den första prenumerationen skapas.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import { lasHandling } from './journal.js';
import { MATKOD } from './kodverk.js';

// Mottagaradresser som administratören har godkänt. Demons adresser ligger under .test, som aldrig går att slå upp, och
// meddelandena simuleras (sparas utan att skickas) om inte servern startas med WEBHOOK_SKICKA=1.
export const GODKANDA_MOTTAGARE = (process.env.WEBHOOK_GODKANDA || 'https://vardlager.region.test/fhir-notis,https://engagemangsindex.region.test/notis')
  .split(',').map(s => s.trim()).filter(Boolean);

// Resurstyperna som går att prenumerera på, med tabellen, läshandlingen och om uppgiften är gemensam för vårdgivaren.
export const KALLOR = {
  Observation: { tabell: 'matvarden', handling: () => 'las_matvarden' },
  Condition: { tabell: 'diagnoser', handling: () => 'las_diagnoser' },
  MedicationRequest: { tabell: 'ordinationer', handling: () => 'las_lakemedel', gemensam: true },
  AllergyIntolerance: { tabell: 'overkanslighet', handling: () => 'las_oversikt', gemensam: true },
  ServiceRequest: { tabell: 'remisser', handling: () => 'las_remiss', enhet: 'fran_enhet_id' },
  Composition: { tabell: 'anteckningar', handling: (r) => lasHandling(r.kategori), extra: 'kategori', villkor: (r) => r.status === 'signerad' },
  Encounter: { tabell: 'vardkontakter', handling: () => 'las_admin' },
};
const TYP_FOR = Object.fromEntries(Object.entries(KALLOR).map(([typ, k]) => [k.tabell, typ]));

export function sakraSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS prenumerationer (
    id INTEGER PRIMARY KEY, personal_id TEXT NOT NULL, typ TEXT NOT NULL, patient_id TEXT NOT NULL, kod TEXT, kriterier TEXT NOT NULL,
    mottagare TEXT NOT NULL, status TEXT NOT NULL, orsak TEXT, skapad TEXT NOT NULL, avslutad TEXT, klient TEXT, handelser INTEGER NOT NULL DEFAULT 0, fel TEXT);
  CREATE TABLE IF NOT EXISTS prenumeration_notiser (
    id INTEGER PRIMARY KEY, prenumeration_id INTEGER NOT NULL, nummer INTEGER NOT NULL, tid TEXT NOT NULL, handelse TEXT NOT NULL, fokus TEXT NOT NULL,
    status TEXT NOT NULL, svar TEXT);
  CREATE TABLE IF NOT EXISTS fhir_andringar (
    id INTEGER PRIMARY KEY, tabell TEXT NOT NULL, rad_id INTEGER NOT NULL, patient_id TEXT, enhet_id TEXT, extra TEXT, villkor TEXT, handelse TEXT NOT NULL, tid TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS fhir_andringar_last (id INTEGER PRIMARY KEY CHECK (id = 1), senast INTEGER NOT NULL);
  INSERT OR IGNORE INTO fhir_andringar_last VALUES (1, 0);`);
  for (const [typ, k] of Object.entries(KALLOR)) {
    const enhet = k.enhet ?? 'enhet_id';
    const extra = k.extra ?? 'NULL';
    const villkor = typ === 'Composition' ? 'status' : 'NULL';
    const radv = (x) => `${x}.id, ${x}.patient_id, ${x}.${enhet}, ${extra === 'NULL' ? 'NULL' : `${x}.${extra}`}, ${villkor === 'NULL' ? 'NULL' : `${x}.${villkor}`}`;
    const ins = (handelse, x) => `INSERT INTO fhir_andringar (tabell, rad_id, patient_id, enhet_id, extra, villkor, handelse, tid) VALUES ('${k.tabell}', ${radv(x)}, '${handelse}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
    db.exec(`CREATE TRIGGER IF NOT EXISTS fhir_ny_${k.tabell} AFTER INSERT ON ${k.tabell} BEGIN ${ins('ny', 'NEW')}; END;
      CREATE TRIGGER IF NOT EXISTS fhir_andrad_${k.tabell} AFTER UPDATE ON ${k.tabell} BEGIN ${ins('andrad', 'NEW')}; END;
      CREATE TRIGGER IF NOT EXISTS fhir_borttagen_${k.tabell} AFTER DELETE ON ${k.tabell} BEGIN ${ins('borttagen', 'OLD')}; END;`);
  }
}
const harSchema = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'prenumerationer'").get());

// Adressen prövas mot listan och reglerna. Ger URL-objektet eller kastar Fel med förklaringen.
export function provaMottagare(adress, godkanda = GODKANDA_MOTTAGARE) {
  let u;
  try { u = new URL(adress); } catch { throw new Fel(400, 'Mottagaradressen är inte en giltig adress.', 'ogiltig', { falt: ['endpoint'] }); }
  if (u.protocol !== 'https:') throw new Fel(400, 'Mottagaradressen ska börja med https.', 'ogiltig', { falt: ['endpoint'] });
  if (u.username || u.password) throw new Fel(400, 'Mottagaradressen får inte innehålla användarnamn eller lösenord.', 'ogiltig', { falt: ['endpoint'] });
  if (u.port && u.port !== '443') throw new Fel(400, 'Mottagaradressen ska använda port 443.', 'ogiltig', { falt: ['endpoint'] });
  if (isIP(u.hostname.replace(/^\[|\]$/g, ''))) throw new Fel(400, 'Mottagaradressen ska ha ett namn, inte en IP-adress.', 'ogiltig', { falt: ['endpoint'] });
  const ren = `${u.origin}${u.pathname}`;
  if (u.search || u.hash || !godkanda.includes(ren)) {
    throw new Fel(403, 'Mottagaradressen är inte godkänd. Administratören godkänner varje adress som meddelanden får skickas till.', 'nekad', { falt: ['endpoint'] });
  }
  return u;
}

// Om en IP-adress är intern, lokal eller reserverad. En sådan adress tar aldrig emot meddelanden.
export function arInternIp(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (isIP(ip) === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const v4 = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return arInternIp(v4[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s) || s.startsWith('64:ff9b:') || s.startsWith('2001:db8');
  }
  return true;
}

// Skickar ett meddelande. Namnet slås upp och varje adress prövas innan något skickas. Ger { status, svar }.
export async function skickaPaRiktigt(adress, kropp, { uppslag = lookup, hamta = fetch } = {}) {
  const u = new URL(adress);
  let adresser;
  try { adresser = await uppslag(u.hostname, { all: true, verbatim: true }); } catch { return { status: 'misslyckad', svar: 'Namnet gick inte att slå upp.' }; }
  if (!adresser.length || adresser.some(a => arInternIp(a.address))) return { status: 'misslyckad', svar: 'Namnet pekar på en intern adress. Meddelandet skickades inte.' };
  try {
    const r = await hamta(adress, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(kropp), signal: AbortSignal.timeout(5000) });
    if (r.status >= 300 && r.status < 400) return { status: 'misslyckad', svar: 'Mottagaren svarade med en omdirigering, som inte följs.' };
    return r.ok ? { status: 'skickad', svar: `HTTP ${r.status}` } : { status: 'misslyckad', svar: `HTTP ${r.status}` };
  } catch { return { status: 'misslyckad', svar: 'Mottagaren svarade inte i tid.' }; }
}
// Standard i demon: meddelandet sparas som simulerat och skickas inte.
export const simulera = async () => ({ status: 'simulerad', svar: 'Simulerat i demon. Meddelandet sparades men skickades inte.' });

// Kriterierna, till exempel Observation?patient=p01 eller Observation?patient=Patient/p01&code=http://loinc.org|85354-9.
export function tolkaKriterier(text) {
  const m = typeof text === 'string' ? text.trim().match(/^([A-Za-z]+)\?(.+)$/) : null;
  if (!m || !Object.hasOwn(KALLOR, m[1])) throw new Fel(400, `Kriterierna ska vara en sökning på en av ${Object.keys(KALLOR).join(', ')} med patient, till exempel Observation?patient=p01.`, 'ogiltig', { falt: ['criteria'] });
  const q = new URLSearchParams(m[2]);
  const okanda = [...q.keys()].filter(k => !['patient', 'subject', 'code'].includes(k));
  if (okanda.length) throw new Fel(400, `Sökparametern ${okanda[0]} stöds inte i prenumerationer. Använd patient och, för Observation, code.`, 'ogiltig', { falt: ['criteria'] });
  const pid = (q.get('patient') ?? q.get('subject') ?? '').replace(/^Patient\//, '');
  if (!/^p\d{1,4}$/.test(pid)) throw new Fel(400, 'Prenumerationen gäller en patient. Ange patient i kriterierna, till exempel Observation?patient=p01.', 'ogiltig', { falt: ['criteria'] });
  const kod = q.get('code');
  if (kod && m[1] !== 'Observation') throw new Fel(400, 'Sökparametern code stöds bara för Observation.', 'ogiltig', { falt: ['criteria'] });
  return { typ: m[1], patientId: pid, kod: kod ? kod.split('|').pop() : null, text: text.trim() };
}

const BACKPORT = 'http://hl7.org/fhir/uv/subscriptions-backport/StructureDefinition/backport-payload-content';
const STATUS = { aktiv: 'active', avslutad: 'off', fel: 'error' };
export function subscription(r) {
  return {
    resourceType: 'Subscription', id: String(r.id), status: STATUS[r.status] ?? 'off', reason: r.orsak, criteria: r.kriterier,
    ...(r.fel ? { error: r.fel } : {}), ...(r.avslutad ? { end: r.avslutad } : {}),
    channel: { type: 'rest-hook', endpoint: r.mottagare, payload: 'application/fhir+json', _payload: { extension: [{ url: BACKPORT, valueCode: 'id-only' }] } },
  };
}

// Skapar en prenumeration. Behörigheten prövas som en sökning på resurstypen för patienten och loggas.
export function skapa(db, personal, resurs, { godkanda = GODKANDA_MOTTAGARE, klient = null } = {}) {
  if (!resurs || resurs.resourceType !== 'Subscription') throw new Fel(400, 'Kroppen ska vara en FHIR-resurs av typen Subscription.', 'ogiltig');
  if (resurs.channel?.type !== 'rest-hook') throw new Fel(400, 'Bara kanalen rest-hook stöds.', 'ogiltig', { falt: ['channel'] });
  if (resurs.channel.header?.length) throw new Fel(400, 'Rubriker i kanalen stöds inte. Mottagaren känner igen meddelandet på prenumerationens id.', 'ogiltig', { falt: ['channel'] });
  const k = tolkaKriterier(resurs.criteria);
  provaMottagare(resurs.channel.endpoint, godkanda);
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(k.patientId)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const handling = k.typ === 'Composition' ? (kanRoll(personal, 'las_journal') ? 'las_journal' : 'las_omvardnad') : k.typ === 'ServiceRequest' && !kanRoll(personal, 'las_remiss') ? 'las_remiss_status' : KALLOR[k.typ].handling({});
  const atk = new Atkomst(db, personal, k.patientId, {}, handling);
  atk.krav(handling, { beskrivning: `fhir/Subscription?criteria=${k.typ}` });
  sakraSchema(db);
  const orsak = typeof resurs.reason === 'string' && resurs.reason.trim() ? resurs.reason.trim().slice(0, 300) : 'Prenumeration från en extern tillämpning';
  const r = db.query("INSERT INTO prenumerationer (personal_id, typ, patient_id, kod, kriterier, mottagare, status, orsak, skapad, klient) VALUES (?, ?, ?, ?, ?, ?, 'aktiv', ?, ?, ?)")
    .run(personal.id, k.typ, k.patientId, k.kod, k.text, resurs.channel.endpoint, orsak, iso(), klient);
  const id = Number(r.lastInsertRowid);
  atk.logga(handling, atk.grund(), `fhir/Subscription/${id}`, 'tillaten', `Prenumeration på ${k.typ} till ${new URL(resurs.channel.endpoint).hostname}.`);
  return db.query('SELECT * FROM prenumerationer WHERE id = ?').get(id);
}

// Den egna prenumerationen. En annan persons prenumeration finns inte för den som frågar.
export function egen(db, personal, id) {
  if (!harSchema(db) || !/^\d{1,9}$/.test(String(id))) throw new Fel(404, 'Resursen finns inte.', 'saknas');
  const r = db.query('SELECT * FROM prenumerationer WHERE id = ? AND personal_id = ?').get(Number(id), personal.id);
  if (!r) throw new Fel(404, 'Resursen finns inte.', 'saknas');
  return r;
}
export const egna = (db, personal) => (harSchema(db) ? db.query('SELECT * FROM prenumerationer WHERE personal_id = ? ORDER BY id').all(personal.id) : []);
export function avsluta(db, personal, id) {
  const r = egen(db, personal, id);
  if (r.status === 'aktiv') db.query("UPDATE prenumerationer SET status = 'avslutad', avslutad = ? WHERE id = ?").run(iso(), r.id);
  return db.query('SELECT * FROM prenumerationer WHERE id = ?').get(r.id);
}

// Meddelandet enligt FHIR Subscriptions R5 Backport för R4: en Bundle av typen history med en SubscriptionStatus som
// Parameters och en post per händelse med bara resursens adress.
export function meddelande(base, p, { nummer, tid, handelse, fokus }) {
  const metod = handelse === 'ny' ? 'POST' : handelse === 'borttagen' ? 'DELETE' : 'PUT';
  return {
    resourceType: 'Bundle', type: 'history', timestamp: tid,
    entry: [
      {
        fullUrl: `urn:uuid:${crypto.randomUUID()}`,
        resource: {
          resourceType: 'Parameters', parameter: [
            { name: 'subscription', valueReference: { reference: `${base}/fhir/Subscription/${p.id}` } },
            { name: 'status', valueCode: 'active' }, { name: 'type', valueCode: 'event-notification' },
            { name: 'events-since-subscription-start', valueString: String(nummer) },
            { name: 'notification-event', part: [{ name: 'event-number', valueString: String(nummer) }, { name: 'timestamp', valueInstant: tid }, { name: 'focus', valueReference: { reference: `${base}/fhir/${fokus}` } }] },
          ],
        },
        request: { method: 'GET', url: `${base}/fhir/Subscription/${p.id}/$status` }, response: { status: '200' },
      },
      { fullUrl: `${base}/fhir/${fokus}`, request: { method: metod, url: fokus }, response: { status: metod === 'POST' ? '201' : '200' } },
    ],
  };
}

// Går igenom ändringarna sedan förra gången och ger meddelandena som ska skickas. Varje meddelande är prövat mot
// prenumerantens behörighet och loggat på patienten. Ändringarna läses en gång.
export function behandla(db, base) {
  if (!harSchema(db)) return [];
  const senast = db.query('SELECT senast FROM fhir_andringar_last WHERE id = 1').get().senast;
  const andringar = db.query('SELECT * FROM fhir_andringar WHERE id > ? ORDER BY id').all(senast);
  if (!andringar.length) return [];
  db.query('UPDATE fhir_andringar_last SET senast = ? WHERE id = 1').run(andringar.at(-1).id);
  const aktiva = db.query("SELECT * FROM prenumerationer WHERE status = 'aktiv'").all();
  const ut = [];
  // Samma rad ändras ofta flera gånger i ett anrop (till exempel en anteckning som sparas och signeras). Ett
  // meddelande per rad och prenumeration räcker, med den sista händelsen.
  const sista = new Map();
  for (const a of andringar) sista.set(`${a.tabell}:${a.rad_id}`, a.handelse === 'andrad' && sista.get(`${a.tabell}:${a.rad_id}`)?.handelse === 'ny' ? { ...a, handelse: 'ny' } : a);
  for (const a of sista.values()) {
    const typ = TYP_FOR[a.tabell];
    for (const p of aktiva) {
      if (p.typ !== typ || p.patient_id !== a.patient_id) continue;
      const rad = { id: a.rad_id, enhet_id: a.enhet_id, kategori: a.extra, status: a.villkor };
      const k = KALLOR[typ];
      if (k.villkor && a.handelse !== 'borttagen' && !k.villkor(rad)) continue;
      if (p.kod && typ === 'Observation') {
        const m = a.handelse === 'borttagen' ? null : db.query('SELECT typ FROM matvarden WHERE id = ?').get(a.rad_id);
        if (!m || !matchaKod(m.typ, p.kod)) continue;
      }
      const personal = db.query('SELECT * FROM personal WHERE id = ? AND aktiv = 1').get(p.personal_id);
      if (!personal) continue;
      const handling = k.handling(rad);
      if (!kanRoll(personal, handling)) continue;
      const atk = new Atkomst(db, personal, a.patient_id, {}, handling);
      const egenRemiss = typ === 'ServiceRequest' && remissEgen(db, personal, a.rad_id);
      const prov = egenRemiss ? atk.prova(handling) : atk.prova(handling, { enhet_id: a.enhet_id, gemensam: Boolean(k.gemensam) });
      if (!prov.tillaten || !atk.prova(handling).tillaten) continue;
      const nummer = p.handelser + 1;
      p.handelser = nummer;
      db.query('UPDATE prenumerationer SET handelser = ? WHERE id = ?').run(nummer, p.id);
      const tid = iso();
      const fokus = `${typ}/${a.rad_id}`;
      atk.grunder.add(prov.grund);
      atk.logga(handling, atk.grund(), `fhir/Subscription/${p.id}/notis`, 'tillaten', `Meddelande om ${a.handelse === 'ny' ? 'ny' : a.handelse === 'borttagen' ? 'borttagen' : 'ändrad'} ${typ} till ${new URL(p.mottagare).hostname}, bara med id.`);
      const notis = db.query("INSERT INTO prenumeration_notiser (prenumeration_id, nummer, tid, handelse, fokus, status) VALUES (?, ?, ?, ?, ?, 'vantar')").run(p.id, nummer, tid, a.handelse, fokus);
      ut.push({ notisId: Number(notis.lastInsertRowid), mottagare: p.mottagare, kropp: meddelande(base, p, { nummer, tid, handelse: a.handelse, fokus }) });
    }
  }
  return ut;
}
const remissEgen = (db, personal, id) => {
  const r = db.query('SELECT fran_enhet_id, till_enhet_id FROM remisser WHERE id = ?').get(id);
  const min = vardenhetFor(db, personal.enhet_id);
  return Boolean(r && (r.fran_enhet_id === min || r.till_enhet_id === min));
};
// Koden i kriterierna jämförs med mätvärdets LOINC- eller NPU-kod.
const matchaKod = (typ, kod) => Boolean(MATKOD[typ]?.coding.some(c => c.code === kod));

// Sparar utfallet av ett skickat meddelande.
export function sparaUtfall(db, notisId, { status, svar }) {
  db.query('UPDATE prenumeration_notiser SET status = ?, svar = ? WHERE id = ?').run(status, svar, notisId);
  if (status === 'misslyckad') {
    const pid = db.query('SELECT prenumeration_id FROM prenumeration_notiser WHERE id = ?').get(notisId)?.prenumeration_id;
    if (pid) db.query('UPDATE prenumerationer SET fel = ? WHERE id = ?').run(svar, pid);
  }
}
export const notiser = (db, prenumerationId) => (harSchema(db) ? db.query('SELECT * FROM prenumeration_notiser WHERE prenumeration_id = ? ORDER BY id').all(prenumerationId) : []);
