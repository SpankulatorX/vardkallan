// Masterdata (runda 6, r5, Sussa 5.1.2.3; runda 9, r4, Sussa 5.1.2.1 till 5.1.2.3). Organisation, personal,
// befolkning, läkemedel, kodverk, listning, arbetsscheman, prislistor, beställarregistret och tillgängligheten i förrådet
// hämtas från källor som går att byta ut (adaptrar). Varje källa följer samma kontrakt och ger poster i Vårdkällans egen
// form, så att resten av systemet aldrig beror på vilken källa som används. I demon finns bara filadaptern, som läser
// seeden. I drift skulle organisationen komma från HSA-katalogen, personalen från HSA och regionens personalsystem,
// befolkningen från folkbokföringen via PU-tjänsten, läkemedlen från Läkemedelsverkets NPL, kodverken från utgivarna,
// listningen från listningstjänsten, scheman från bemanningssystemet, prislistorna från ekonomisystemet och
// tillgängligheten från förrådssystemet. Inga riktiga anslutningar finns.
//
// Systemet är experten: en källa valideras innan något ändras, och synkroniseringen räknar själv ut vad som är nytt,
// ändrat och borta. Ingenting raderas. Personal som saknas i källan blir inaktiv, och en enhet som saknas står kvar och
// rapporteras, eftersom journaluppgifter pekar på den. En ändrad skyddad identitet gäller direkt. En ny utgåva av ett
// kodverk läggs fram för godkännande med jämförelsen färdig. Systemet läser in källorna efter ett schema, och svarar en
// källa inte används de senast giltiga uppgifterna medan systemet visar avvikelsen och försöker igen. Vilka delar som
// räknas som masterdata är parametrar som systemförvaltningen ändrar (konfiguration.js).
import { ENHETER } from './seed/enheter.js';
import { PERSONAL } from './seed/personal.js';
import { PATIENTER } from './seed/patienter.js';
import { IDENTITETSPATIENTER } from './seed/identiteter.js';
import { TIDBOK_PERSONAL } from './seed/tidbok.js';
import { PROVTAGNING_PERSONAL, MIN_JOURNAL_ENHET, EXTERN_ENHET } from './seed/planering.js';
import { KATALOG } from './seed/lakemedel-katalog.js';

// Modulerna som importerar db.js läses när de behövs, eftersom db.js importerar den här modulen när seeden byggs.
const kodverk = () => require('./kodverksforvaltning.js');
const konfig = () => require('./konfiguration.js');
const sandlada = () => require('./db.js').nySessionsDb();

const datum = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Runda 8, r2: extern är avsändaren av pappersremisser från vårdgivare utanför Vårdkällan.
const ENHETSTYPER = ['vardgivare', 'sjukhus', 'vardenhet', 'arbetsplats', 'forvaltning', 'kommun', 'etjanst', 'extern'];
// Kontraktet per del: obligatoriska fält, nyckeln och en kontroll per post. Fel beskrivs på svenska.
export const KONTRAKT = {
  organisation: {
    namn: 'Organisation', falt: ['id', 'hsaId', 'namn', 'typ'],
    prova: (p, alla) => (!ENHETSTYPER.includes(p.typ) ? `okänd enhetstyp ${p.typ}` : p.forald && !alla.some(x => x.id === p.forald) ? `överordnad enhet ${p.forald} finns inte i källan` : null),
  },
  personal: {
    namn: 'Personal', falt: ['id', 'hsaId', 'namn', 'yrke', 'enhetId'],
    prova: (p) => (!/^[A-Z0-9-]{6,40}$/.test(p.hsaId) ? `HSA-id ${p.hsaId} har fel form` : null),
  },
  befolkning: {
    namn: 'Befolkning', falt: ['identitet', 'fornamn', 'efternamn'],
    prova: (p) => (typeof p.skyddad !== 'boolean' ? 'uppgiften om skyddad identitet saknas' : null),
  },
  // Runda 9, r4: de nya delarna.
  lakemedel: {
    namn: 'Läkemedel', falt: ['id', 'npl', 'namn', 'substans', 'form', 'atc'],
    prova: (p) => (!/^(19|20)\d{12}$/.test(p.npl) ? `NPL-id ${p.npl} har fel form` : !/^[A-Z](\d\d([A-Z]([A-Z](\d\d)?)?)?)?$/.test(p.atc) ? `ATC-koden ${p.atc} har fel form` : null),
  },
  kodverk: {
    namn: 'Kodverk', falt: ['kodverk', 'version', 'giltigFran', 'koder'], nyckel: (p) => `${p.kodverk} ${p.version}`,
    prova: (p) => (!Array.isArray(p.koder) ? 'koderna är ingen lista' : !datum(p.giltigFran) ? `giltighetsdatumet ${p.giltigFran} har fel form` : null),
  },
  listning: {
    namn: 'Listning', falt: ['identitet', 'enhetId', 'fran'],
    prova: (p) => (!datum(p.fran) ? `datumet ${p.fran} har fel form` : null),
  },
  scheman: { namn: 'Arbetsscheman', falt: ['id', 'enhetId', 'personalId', 'yrkesroll'], prova: () => null },
  prislistor: {
    namn: 'Prislistor', falt: ['enhetId', 'version', 'giltigFran', 'poster'], nyckel: (p) => `${p.enhetId} ${p.version}`,
    prova: (p) => (!Number.isInteger(p.version) || p.version < 1 ? `versionen ${p.version} är inget heltal` : !datum(p.giltigFran) ? `giltighetsdatumet ${p.giltigFran} har fel form` : typeof p.poster !== 'object' ? 'prislistan har inga poster' : null),
  },
  bestallare: {
    namn: 'Beställarregister', falt: ['id', 'hsaId', 'namn', 'enhetId', 'kundnummer'],
    prova: (p) => (!/^[A-Z0-9-]{4,30}$/.test(p.kundnummer) ? `kundnumret ${p.kundnummer} har fel form` : null),
  },
  forrad: {
    namn: 'Tillgänglighet i förrådet', falt: ['artikel', 'enhetId', 'saldo'], nyckel: (p) => `${p.artikel} ${p.enhetId}`,
    prova: (p) => (!Number.isInteger(p.saldo) || p.saldo < 0 ? `saldot ${p.saldo} är inget heltal från 0` : null),
  },
};
const nyckelFor = (del, p) => (KONTRAKT[del].nyckel ? KONTRAKT[del].nyckel(p) : p?.id ?? p?.identitet);

// Påhittade saldon i demons förråd för hjälpmedlen som ortopeden lämnar ut (ekonomi-schema.js).
const FORRAD = [['HM-KRYCK', 'uso-ort', 14], ['HM-ORTOS-KNA', 'uso-ort', 3], ['HM-ROLLATOR', 'uso-ort', 0], ['HM-SPACER', 'vc-tybble', 22], ['HM-SPACER', 'uso-barn', 9]];

// Raderna i en ny sandlåda, för de delar som seeden bygger i flera steg. Läses en gång per process.
let seedRader = null;
function franSeed() {
  if (seedRader) return seedRader;
  const db = sandlada();
  seedRader = {
    listning: db.query('SELECT p.personnummer AS identitet, l.enhet_id AS enhetId, l.fran FROM listningar l JOIN patienter p ON p.id = l.patient_id WHERE p.personnummer IS NOT NULL ORDER BY l.patient_id').all(),
    scheman: db.query('SELECT id, enhet_id AS enhetId, personal_id AS personalId, yrkesroll FROM scheman ORDER BY id').all(),
    prislistor: db.query('SELECT enhet_id AS enhetId, version, giltig_fran AS giltigFran, poster FROM prislistor ORDER BY id').all().map(p => ({ ...p, poster: JSON.parse(p.poster) })),
  };
  db.close();
  return seedRader;
}

// Filadaptern läser seeden. hsaId för personalen räknas som i seeden.
export function filadapter() {
  return {
    id: 'fil', namn: 'Fil (seeden)', beskrivning: 'Läser seeden i app/src/seed. Demons enda källa.',
    // Runda 6, r4: vårdenheten för egna vårdbegäranden från Min journal.
    organisation: () => [...ENHETER, MIN_JOURNAL_ENHET, EXTERN_ENHET].map(e => ({ id: e.id, hsaId: e.hsa, namn: e.namn, kortnamn: e.kortnamn ?? null, typ: e.typ, forald: e.forald ?? null })),
    // Personalen i seed/personal.js och personalen i tidbokens scheman (seed/tidbok.js).
    personal: () => [
      ...PERSONAL.map((p, i) => ({ id: p.id, hsaId: `SE2321000164-VKP${String(i + 1).padStart(3, '0')}`, namn: p.namn, yrke: p.yrke, titel: p.titel, enhetId: p.enhet, demo: Boolean(p.demo), aktiv: p.aktiv !== false })),
      // Runda 6, r4: provtagningssköterskan på kardiologens mottagning (seed/planering.js).
      ...[...TIDBOK_PERSONAL, PROVTAGNING_PERSONAL].filter(t => !PERSONAL.some(p => p.id === t.id)).map(p => ({ id: p.id, hsaId: p.hsa, namn: p.namn, yrke: p.yrke, titel: p.titel, enhetId: p.enhet, demo: false, aktiv: true })),
    ],
    befolkning: () => [...PATIENTER, ...IDENTITETSPATIENTER].filter(p => p.pnr).map(p => ({
      identitet: p.pnr, fornamn: p.fornamn, efternamn: p.efternamn, adress: p.adress ?? null, postnr: p.postnr ?? null, ort: p.ort ?? null, skyddad: Boolean(p.skyddad),
    })),
    // Runda 9, r4.
    lakemedel: () => KATALOG.map(l => ({ id: l.id, npl: l.npl, namn: l.namn, substans: l.substans, styrka: l.styrka ?? null, form: l.form, atc: l.atc })),
    kodverk: () => Object.entries(kodverk().KODVERK).map(([id, d]) => ({ kodverk: id, version: d.version, giltigFran: d.giltigFran, koder: Object.entries(d.koder()).map(([kod, text]) => ({ kod, text })) })),
    listning: () => franSeed().listning.map(r => ({ ...r })),
    scheman: () => franSeed().scheman.map(r => ({ ...r })),
    prislistor: () => franSeed().prislistor.map(r => ({ ...r, poster: structuredClone(r.poster) })),
    bestallare: () => ENHETER.filter(e => e.typ === 'vardenhet').map((e, i) => ({ id: `best-${e.id}`, hsaId: e.hsa, namn: e.namn, enhetId: e.id, kundnummer: `DEMO-K${String(i + 1).padStart(3, '0')}` })),
    forrad: () => FORRAD.map(([artikel, enhetId, saldo]) => ({ artikel, enhetId, saldo })),
  };
}

// Källan per del. bytKalla gör att en annan adapter används, till exempel i ett test eller när en riktig anslutning finns.
const kallor = Object.fromEntries(Object.keys(KONTRAKT).map(d => [d, filadapter()]));
export const kalla = (del) => kallor[del];
export function bytKalla(del, adapter) {
  if (!Object.hasOwn(KONTRAKT, del)) throw new Error(`Okänd del av masterdata: ${del}`);
  if (typeof adapter?.[del] !== 'function' || !adapter.id || !adapter.namn) throw new Error(`Källan följer inte kontraktet för ${del}.`);
  const forra = kallor[del];
  kallor[del] = adapter;
  return forra;
}

// Validerar posterna från en källa. Ger { giltiga, fel } där fel är { index, text }.
export function validera(del, poster) {
  const k = KONTRAKT[del];
  const fel = [];
  if (!Array.isArray(poster)) return { giltiga: [], fel: [{ index: null, text: `${k.namn}: källan gav ingen lista.` }] };
  const sett = new Set();
  const giltiga = [];
  poster.forEach((p, index) => {
    const saknas = k.falt.filter(f => p?.[f] == null || p[f] === '');
    const nyckel = saknas.length ? null : nyckelFor(del, p);
    const text = saknas.length ? `saknar ${saknas.join(', ')}` : sett.has(nyckel) ? `${nyckel} finns två gånger` : k.prova(p, poster);
    if (text) fel.push({ index, text: `${k.namn}, post ${index + 1}: ${text}.` }); else { sett.add(nyckel); giltiga.push(p); }
  });
  return { giltiga, fel };
}

// Posterna som byggSeed lägger in: organisationen och personalen ur källan, validerade.
export function forSeed() {
  const ut = {};
  for (const del of ['organisation', 'personal']) {
    const v = validera(del, kalla(del)[del]());
    if (v.fel.length) throw new Error(`Masterdata från ${kalla(del).namn} är ogiltig: ${v.fel.map(f => f.text).join(' ')}`);
    ut[del] = v.giltiga;
  }
  return ut;
}

const lika = (a, b, falt) => falt.every(f => (a[f] ?? null) === (b[f] ?? null));

// Tabellerna för beställarregistret och tillgängligheten i förrådet, som bara masterdata skriver i.
export function sakerstall(db) {
  db.exec('CREATE TABLE IF NOT EXISTS masterdata_synk (id INTEGER PRIMARY KEY, del TEXT NOT NULL, kalla TEXT NOT NULL, tid TEXT NOT NULL, rapport TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS bestallarregister (id TEXT PRIMARY KEY, hsa_id TEXT NOT NULL, namn TEXT NOT NULL, enhet_id TEXT NOT NULL, kundnummer TEXT NOT NULL, aktiv INTEGER NOT NULL DEFAULT 1)');
  db.exec('CREATE TABLE IF NOT EXISTS forradstillgang (artikel TEXT NOT NULL, enhet_id TEXT NOT NULL, saldo INTEGER NOT NULL, uppdaterad TEXT NOT NULL, PRIMARY KEY (artikel, enhet_id))');
}

// Synkroniseringen av en tabell med en nyckel: nya läggs in, ändrade uppdateras och de som saknas i källan rapporteras.
function tabellsynk(db, rapport, { giltiga, tabell, nyckel, rad, saknas = true }) {
  const fore = new Map(db.query(`SELECT * FROM ${tabell}`).all().map(r => [nyckel.map(n => r[n]).join('|'), r]));
  const sedda = new Set();
  for (const p of giltiga) {
    const r = rad(p);
    const k = nyckel.map(n => r[n]).join('|');
    sedda.add(k);
    const f = fore.get(k);
    const kolumner = Object.keys(r);
    if (!f) { db.query(`INSERT INTO ${tabell} (${kolumner.join(', ')}) VALUES (${kolumner.map(() => '?').join(', ')})`).run(...kolumner.map(c => r[c])); rapport.nya.push(k); }
    else {
      const andras = kolumner.filter(c => !nyckel.includes(c) && c !== 'uppdaterad');
      if (!lika(f, r, andras)) { db.query(`UPDATE ${tabell} SET ${andras.map(c => `${c} = ?`).join(', ')} WHERE ${nyckel.map(n => `${n} = ?`).join(' AND ')}`).run(...andras.map(c => r[c]), ...nyckel.map(n => r[n])); rapport.andrade.push(k); }
      else rapport.oforandrade++;
    }
  }
  if (saknas) rapport.saknasIKallan = [...fore.keys()].filter(k => !sedda.has(k));
}

// Hämtar posterna från en källa. En källa som inte svarar eller kastar ett fel ger ett fel, aldrig ett undantag.
function hamtaPoster(adapter, del) {
  try {
    const poster = adapter[del]();
    if (poster && typeof poster.then === 'function') return { fel: 'Källan svarade inte i tid.' };
    return { poster };
  } catch (e) {
    return { fel: `Källan svarade inte: ${String(e?.message ?? e).slice(0, 200)}` };
  }
}

// Synkroniserar en del mot källan och ger en rapport. En källa med fel eller som inte svarar ändrar ingenting.
export function synkronisera(db, del, adapter = kalla(del), nu = new Date()) {
  sakerstall(db);
  const rapport = { del, kalla: adapter.namn, tid: nu.toISOString(), tillganglig: true, nya: [], andrade: [], inaktiverade: [], saknasIKallan: [], oforandrade: 0, fel: [] };
  const h = hamtaPoster(adapter, del);
  if (h.fel) return spara(db, { ...rapport, tillganglig: false, fel: [h.fel] });
  const v = validera(del, h.poster);
  rapport.fel = v.fel.map(f => f.text);
  if (v.fel.length) return spara(db, rapport);
  db.exec('BEGIN');
  try {
    if (del === 'organisation') {
      const fore = new Map(db.query('SELECT * FROM enheter').all().map(e => [e.id, e]));
      for (const e of v.giltiga) {
        const rad = { id: e.id, hsa_id: e.hsaId, namn: e.namn, kortnamn: e.kortnamn ?? null, typ: e.typ, forald_id: e.forald ?? null };
        const f = fore.get(e.id);
        if (!f) { db.query('INSERT INTO enheter VALUES (?, ?, ?, ?, ?, ?)').run(rad.id, rad.hsa_id, rad.namn, rad.kortnamn, rad.typ, rad.forald_id); rapport.nya.push(e.id); }
        else if (!lika(f, rad, ['hsa_id', 'namn', 'kortnamn', 'typ', 'forald_id'])) { db.query('UPDATE enheter SET hsa_id = ?, namn = ?, kortnamn = ?, typ = ?, forald_id = ? WHERE id = ?').run(rad.hsa_id, rad.namn, rad.kortnamn, rad.typ, rad.forald_id, e.id); rapport.andrade.push(e.id); }
        else rapport.oforandrade++;
      }
      const ids = new Set(v.giltiga.map(e => e.id));
      rapport.saknasIKallan = [...fore.keys()].filter(id => !ids.has(id));
    } else if (del === 'personal') {
      const fore = new Map(db.query('SELECT * FROM personal').all().map(p => [p.id, p]));
      for (const p of v.giltiga) {
        const rad = { namn: p.namn, yrke: p.yrke, titel: p.titel ?? null, enhet_id: p.enhetId, hsa_id: p.hsaId, aktiv: p.aktiv === false ? 0 : 1 };
        const f = fore.get(p.id);
        if (!f) { db.query('INSERT INTO personal VALUES (?, ?, ?, ?, ?, ?, 0, ?)').run(p.id, rad.namn, rad.yrke, rad.titel, rad.enhet_id, rad.hsa_id, rad.aktiv); rapport.nya.push(p.id); }
        else if (!lika(f, rad, Object.keys(rad))) { db.query('UPDATE personal SET namn = ?, yrke = ?, titel = ?, enhet_id = ?, hsa_id = ?, aktiv = ? WHERE id = ?').run(rad.namn, rad.yrke, rad.titel, rad.enhet_id, rad.hsa_id, rad.aktiv, p.id); rapport.andrade.push(p.id); }
        else rapport.oforandrade++;
      }
      // Personal som inte finns i källan blir inaktiv. Den raderas aldrig, eftersom journalen och loggen pekar på den.
      const ids = new Set(v.giltiga.map(p => p.id));
      for (const [id, f] of fore) if (!ids.has(id) && f.aktiv) { db.query('UPDATE personal SET aktiv = 0 WHERE id = ?').run(id); rapport.inaktiverade.push(id); }
    } else if (del === 'befolkning') {
      // Befolkningen uppdaterar namn, adress och skyddad identitet för patienter som redan finns. Nya personer blir
      // patienter först när de registreras i vården.
      for (const p of v.giltiga) {
        const f = db.query('SELECT * FROM patienter WHERE personnummer = ?').get(p.identitet);
        if (!f) continue;
        const rad = { fornamn: p.fornamn, efternamn: p.efternamn, adress: p.adress ?? null, postnr: p.postnr ?? null, ort: p.ort ?? null, skyddad: p.skyddad ? 1 : 0 };
        if (!lika(f, rad, Object.keys(rad))) {
          db.query('UPDATE patienter SET fornamn = ?, efternamn = ?, adress = ?, postnr = ?, ort = ?, skyddad = ? WHERE id = ?').run(rad.fornamn, rad.efternamn, rad.adress, rad.postnr, rad.ort, rad.skyddad, f.id);
          rapport.andrade.push(f.id);
        } else rapport.oforandrade++;
      }
    } else if (del === 'lakemedel') {
      // Bara produkter med NPL-id kommer från källan. Egna och lokala produkter i katalogen rörs inte.
      const fore = new Map(db.query('SELECT * FROM katalog WHERE npl IS NOT NULL').all().map(k => [k.id, k]));
      for (const l of v.giltiga) {
        const rad = { namn: l.namn, substans: l.substans, styrka: l.styrka || null, form: l.form, atc: l.atc, npl: l.npl };
        const f0 = fore.get(l.id);
        const f = f0 ? { ...f0, styrka: f0.styrka || null } : null;
        if (!f) { db.query('INSERT INTO katalog (id, namn, substans, styrka, form, atc, npl) VALUES (?, ?, ?, ?, ?, ?, ?)').run(l.id, rad.namn, rad.substans, rad.styrka, rad.form, rad.atc, rad.npl); rapport.nya.push(l.id); }
        else if (!lika(f, rad, Object.keys(rad))) { db.query('UPDATE katalog SET namn = ?, substans = ?, styrka = ?, form = ?, atc = ?, npl = ? WHERE id = ?').run(rad.namn, rad.substans, rad.styrka, rad.form, rad.atc, rad.npl, l.id); rapport.andrade.push(l.id); }
        else rapport.oforandrade++;
      }
      // En produkt som saknas i källan står kvar, eftersom ordinationer pekar på den, och rapporteras.
      const ids = new Set(v.giltiga.map(l => l.id));
      rapport.saknasIKallan = [...fore.keys()].filter(id => !ids.has(id));
    } else if (del === 'kodverk') {
      // En ny utgåva läggs fram för godkännande med jämförelsen färdig. Samma utgåva igen ändrar ingenting.
      for (const u of v.giltiga) {
        const r = kodverk().franKalla(db, u, adapter.namn, nu);
        if (r.status === 'inlast') rapport.nya.push(`${u.kodverk} ${u.version}`);
        else if (r.status === 'fel' || r.status === 'okand') rapport.fel.push(r.text);
        else rapport.oforandrade++;
      }
    } else if (del === 'listning') {
      // Listningen ger vårdrelation till vårdcentralen. En person som listar om sig får den nya enheten, och en person
      // som inte är patient blir det först när den registreras i vården.
      for (const l of v.giltiga) {
        const p = db.query('SELECT id FROM patienter WHERE personnummer = ? AND sammanslagen_till IS NULL').get(l.identitet);
        if (!p) continue;
        const f = db.query('SELECT * FROM listningar WHERE patient_id = ?').all(p.id);
        if (f.some(x => x.enhet_id === l.enhetId)) { rapport.oforandrade++; continue; }
        if (f.length) { db.query('UPDATE listningar SET enhet_id = ?, fran = ? WHERE patient_id = ?').run(l.enhetId, l.fran, p.id); rapport.andrade.push(p.id); }
        else { db.query('INSERT INTO listningar VALUES (?, ?, ?)').run(p.id, l.enhetId, l.fran); rapport.nya.push(p.id); }
      }
    } else if (del === 'scheman') {
      tabellsynk(db, rapport, { giltiga: v.giltiga, tabell: 'scheman', nyckel: ['id'], rad: (s) => ({ id: s.id, enhet_id: s.enhetId, personal_id: s.personalId, yrkesroll: s.yrkesroll }) });
    } else if (del === 'prislistor') {
      // En version av en prislista ändras aldrig. En ny version läggs in och gäller från sitt datum.
      for (const p of v.giltiga) {
        const f = db.query('SELECT poster FROM prislistor WHERE enhet_id = ? AND version = ?').get(p.enhetId, p.version);
        if (!f) {
          db.query('INSERT INTO prislistor (enhet_id, version, giltig_fran, poster, skapad, skapad_av, orsak) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(p.enhetId, p.version, p.giltigFran, JSON.stringify(p.poster), nu.toISOString(), null, `Inläst från ${adapter.namn}`);
          rapport.nya.push(`${p.enhetId} ${p.version}`);
        } else if (f.poster !== JSON.stringify(p.poster)) rapport.fel.push(`Prislistor: version ${p.version} för ${p.enhetId} skiljer sig från den som redan finns. En version ändras aldrig, så källan behöver ge den ett nytt versionsnummer.`);
        else rapport.oforandrade++;
      }
    } else if (del === 'bestallare') {
      tabellsynk(db, rapport, { giltiga: v.giltiga, tabell: 'bestallarregister', nyckel: ['id'], rad: (b) => ({ id: b.id, hsa_id: b.hsaId, namn: b.namn, enhet_id: b.enhetId, kundnummer: b.kundnummer, aktiv: 1 }) });
      // En beställare som saknas i källan blir inaktiv och kan inte väljas, men raderas inte.
      for (const id of rapport.saknasIKallan) if (db.query('UPDATE bestallarregister SET aktiv = 0 WHERE id = ? AND aktiv = 1').run(id).changes) rapport.inaktiverade.push(id);
    } else if (del === 'forrad') {
      tabellsynk(db, rapport, { giltiga: v.giltiga, tabell: 'forradstillgang', nyckel: ['artikel', 'enhet_id'], rad: (f) => ({ artikel: f.artikel, enhet_id: f.enhetId, saldo: f.saldo, uppdaterad: nu.toISOString() }) });
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return spara(db, rapport);
}

function spara(db, rapport) {
  sakerstall(db);
  db.query('INSERT INTO masterdata_synk (del, kalla, tid, rapport) VALUES (?, ?, ?, ?)').run(rapport.del, rapport.kalla, rapport.tid, JSON.stringify(rapport));
  return rapport;
}

const harSynk = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE name = 'masterdata_synk'").get());
const senasteRapport = (db, del) => {
  if (!harSynk(db)) return null;
  const r = db.query('SELECT rapport FROM masterdata_synk WHERE del = ? ORDER BY id DESC LIMIT 1').get(del);
  return r ? JSON.parse(r.rapport) : null;
};
// Den senaste inläsningen då källan svarade, eller null.
const senastTillganglig = (db, del) => {
  for (const r of db.query('SELECT rapport FROM masterdata_synk WHERE del = ? ORDER BY id DESC LIMIT 200').all(del)) {
    const x = JSON.parse(r.rapport);
    if (x.tillganglig !== false) return x;
  }
  return null;
};

// Om en del hämtas från en extern källa, enligt parametern i konfigurationen.
export const extern = (db, del, nu = new Date()) => konfig().varde(db, `masterdata.extern.${del}`, nu);

// Schemat: varje del som hämtas från en källa läses in när det har gått så många timmar som parametern säger sedan den
// senaste inläsningen, och en timme efter ett försök då källan inte svarade. En ny sandlåda räknar seeden som den
// första inläsningen. Ger rapporterna från det som lästes in.
const TIMME = 3600_000;
export function synkOmDags(db, nu = new Date()) {
  sakerstall(db);
  const timmar = konfig().varde(db, 'masterdata.synk_timmar', nu);
  const ut = [];
  for (const del of Object.keys(KONTRAKT)) {
    if (!extern(db, del, nu)) continue;
    const r = senasteRapport(db, del);
    if (!r) {
      // Beställarregistret och förrådet finns inte i seeden, så de läses in första gången direkt.
      if (del === 'bestallare' || del === 'forrad') ut.push(synkronisera(db, del, kalla(del), nu));
      else spara(db, { del, kalla: kalla(del).namn, tid: nu.toISOString(), tillganglig: true, seed: true, nya: [], andrade: [], inaktiverade: [], saknasIKallan: [], oforandrade: 0, fel: [] });
      continue;
    }
    const vanta = (r.tillganglig === false ? 1 : timmar) * TIMME;
    if (nu.getTime() - Date.parse(r.tid) >= vanta) ut.push(synkronisera(db, del, kalla(del), nu));
  }
  return ut;
}

// Översikten: källan per del, antalet poster, den senaste inläsningen och avvikelsen när källan inte svarade. När källan
// inte svarar används de senast giltiga uppgifterna, och översikten säger från när de är.
export function oversikt(db, nu = new Date()) {
  return Object.keys(KONTRAKT).map((del) => {
    const k = kalla(del);
    const r = senasteRapport(db, del);
    const ok = r?.tillganglig === false ? senastTillganglig(db, del) : r;
    const h = hamtaPoster(k, del);
    const ext = extern(db, del, nu);
    return {
      del, namn: KONTRAKT[del].namn, kalla: { id: k.id, namn: k.namn, beskrivning: k.beskrivning }, extern: ext,
      forvaltning: ext ? 'Hämtas från källan' : 'Förvaltas i Vårdkällan',
      antal: Array.isArray(h.poster) ? h.poster.length : null,
      senaste: r ? { tid: r.tid, nya: r.nya.length, andrade: r.andrade.length, inaktiverade: r.inaktiverade.length, fel: r.fel.length, tillganglig: r.tillganglig !== false, seed: Boolean(r.seed) } : null,
      avvikelse: r?.tillganglig === false
        ? `${k.namn} svarade inte vid inläsningen ${r.tid.slice(0, 16).replace('T', ' ')}. ${ok ? `Uppgifterna från ${ok.tid.slice(0, 16).replace('T', ' ')} används` : 'Uppgifterna från seeden används'} tills källan svarar, och systemet försöker igen om en timme.`
        : r?.fel.length ? `Den senaste inläsningen hade fel och ändrade ingenting: ${r.fel[0]}` : null,
    };
  });
}
