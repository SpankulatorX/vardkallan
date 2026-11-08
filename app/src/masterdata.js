// Masterdata (runda 6, r5, Sussa 5.1.2.3). Organisation, personal och befolkning hämtas från källor som går att byta ut
// (adaptrar). Varje källa följer samma kontrakt och ger poster i Vårdkällans egen form, så att resten av systemet aldrig
// beror på vilken källa som används. I demon finns bara filadaptern, som läser seeden. I drift skulle organisationen
// komma från HSA-katalogen, personalen från HSA och regionens personalsystem och befolkningen från folkbokföringen via
// PU-tjänsten. Inga riktiga anslutningar finns.
//
// Systemet är experten: en källa valideras innan något ändras, och synkroniseringen räknar själv ut vad som är nytt,
// ändrat och borta. Ingenting raderas. Personal som saknas i källan blir inaktiv, och en enhet som saknas står kvar och
// rapporteras, eftersom journaluppgifter pekar på den. En ändrad skyddad identitet gäller direkt.
import { ENHETER } from './seed/enheter.js';
import { PERSONAL } from './seed/personal.js';
import { PATIENTER } from './seed/patienter.js';
import { IDENTITETSPATIENTER } from './seed/identiteter.js';
import { TIDBOK_PERSONAL } from './seed/tidbok.js';
import { PROVTAGNING_PERSONAL, MIN_JOURNAL_ENHET, EXTERN_ENHET } from './seed/planering.js';

// Runda 8, r2: extern är avsändaren av pappersremisser från vårdgivare utanför Vårdkällan.
const ENHETSTYPER = ['vardgivare', 'sjukhus', 'vardenhet', 'arbetsplats', 'forvaltning', 'kommun', 'etjanst', 'extern'];
// Kontraktet per del: obligatoriska fält och en kontroll per post. Fel beskrivs på svenska.
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
};

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
  };
}

// Källan per del. bytKalla gör att en annan adapter används, till exempel i ett test eller när en riktig anslutning finns.
const kallor = { organisation: filadapter(), personal: filadapter(), befolkning: filadapter() };
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
    const nyckel = p?.id ?? p?.identitet;
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

// Synkroniserar en del mot källan och ger en rapport. En källa med fel ändrar ingenting.
export function synkronisera(db, del, adapter = kalla(del)) {
  const v = validera(del, adapter[del]());
  const rapport = { del, kalla: adapter.namn, tid: new Date().toISOString(), nya: [], andrade: [], inaktiverade: [], saknasIKallan: [], oforandrade: 0, fel: v.fel.map(f => f.text) };
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
    } else {
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
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return spara(db, rapport);
}

function spara(db, rapport) {
  db.exec('CREATE TABLE IF NOT EXISTS masterdata_synk (id INTEGER PRIMARY KEY, del TEXT NOT NULL, kalla TEXT NOT NULL, tid TEXT NOT NULL, rapport TEXT NOT NULL)');
  db.query('INSERT INTO masterdata_synk (del, kalla, tid, rapport) VALUES (?, ?, ?, ?)').run(rapport.del, rapport.kalla, rapport.tid, JSON.stringify(rapport));
  return rapport;
}

// Översikten: källan per del, antalet poster och den senaste synkroniseringen.
export function oversikt(db) {
  const har = db.query("SELECT 1 FROM sqlite_master WHERE name = 'masterdata_synk'").get();
  return Object.keys(KONTRAKT).map((del) => {
    const k = kalla(del);
    const senaste = har ? db.query('SELECT rapport FROM masterdata_synk WHERE del = ? ORDER BY id DESC LIMIT 1').get(del) : null;
    const r = senaste ? JSON.parse(senaste.rapport) : null;
    return {
      del, namn: KONTRAKT[del].namn, kalla: { id: k.id, namn: k.namn, beskrivning: k.beskrivning }, antal: k[del]().length,
      senaste: r ? { tid: r.tid, nya: r.nya.length, andrade: r.andrade.length, inaktiverade: r.inaktiverade.length, fel: r.fel.length } : null,
    };
  });
}
