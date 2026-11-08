// Kunskapsgenererande stöd, det tredje steget i beslutsstödstrappan (runda 10, r5, Sussa 3.2.1.3).
//
// Systemet lär sig av journalens egna data på vårdenheten och återför det som stöd där beslutet fattas:
//   - vårdplanerna: hur många avslutade planer ur samma standardplan som nådde alla mål och hur lång tid de tog, visat
//     när systemet föreslår planen och i planen,
//   - varningarna: hur ofta samma varning har kvitterats och ordinationen ändå sparats på vårdenheten, visat vid
//     varningen, så att en varning som nästan alltid kvitteras syns som en kandidat för systemförvaltningen att se över,
//   - läkemedlen: hur många ordinationer av substansen på vårdenheten som sattes ut inom 30 dagar, visat vid
//     läkemedelsinformationen.
// Allt räknas om vid varje anrop ur journalens rader, så att stödet följer det som händer på vårdenheten.
//
// Integritet. Bara vårdenhetens egna rader räknas, utan namn, personnummer eller id. Varje tal som visas är 0 eller
// minst 5, och en andel visas bara när både de som nådde utfallet och de som inte gjorde det är 0 eller minst 5, så att
// ett litet tal aldrig kan räknas fram som skillnaden mellan två visade tal. Annars säger systemet att underlaget är
// för litet, utan att visa talen.
//
// Utfallen är beskrivande statistik ur en demo med påhittade patienter. De är inte en medicinteknisk produkt och ingen
// MDR-bedömning är gjord, och de säger ingenting om orsak och verkan.
import { vardenhetFor, enheterUnder } from './atkomst.js';
import { addDagar } from './db.js';

export const MINSTA = 5;
export const DEMOMARKNING = 'Utfallen räknas ur journalens egna data på vårdenheten och är beskrivande statistik, inte ett bevis för orsak och verkan. Det kunskapsgenererande stödet är en demo och inte en medicinteknisk produkt (ingen MDR-bedömning).';
export const SKYDD = `Tal under ${MINSTA} visas inte, så att ingen enskild patient kan pekas ut.`;

const ok = (x) => x === 0 || x >= MINSTA;
// En andel av n, där x nådde utfallet. Visas bara när x, n och n - x var för sig är 0 eller minst MINSTA.
export function andel(x, n) {
  if (n < MINSTA || !ok(x) || !ok(n - x)) return { visas: false, n: n < MINSTA ? null : n };
  return { visas: true, x, n, procent: Math.round((x / n) * 100) };
}

const enheterFor = (db, personal) => enheterUnder(db, vardenhetFor(db, personal.enhet_id));
const ph = (a) => a.map(() => '?').join(', ');
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;

// Avslutade vårdplaner ur en standardplan på användarens vårdenhet: hur många som nådde alla mål vid den sista
// uppföljningen och medianen för hur många dagar planen pågick.
export function vardplan(db, personal, mall) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const en = enheterFor(db, personal);
  const planer = db.query(`SELECT id, skapad FROM vardplaner WHERE mall = ? AND status = 'avslutad' AND enhet_id IN (${ph(en)})`).all(mall, ...en);
  let nadde = 0;
  const dagar = [];
  for (const p of planer) {
    const hist = db.query("SELECT typ, tid, detalj FROM vardplan_historik WHERE plan_id = ? AND typ IN ('uppfoljning', 'avslutad') ORDER BY tid DESC, id DESC").all(p.id);
    const sista = hist.find(h => h.typ === 'uppfoljning');
    const mal = sista ? Object.values(JSON.parse(sista.detalj ?? '{}').mal ?? {}) : [];
    if (mal.length && mal.every(s => s === 'uppnatt')) nadde++;
    const slut = hist.find(h => h.typ === 'avslutad');
    if (slut) dagar.push(Math.max(0, Math.round((Date.parse(slut.tid) - Date.parse(p.skapad)) / 86400_000)));
  }
  const a = andel(nadde, planer.length);
  const enhet = enhetsnamn(db, ve);
  const text = a.visas
    ? `På ${enhet} nådde ${a.x} av ${a.n} avslutade planer ur standardplanen alla mål vid den sista uppföljningen (${a.procent} procent). Planerna pågick i median ${median(dagar)} dagar.`
    : `Underlaget på ${enhet} är för litet för att visa utfallet för standardplanen. ${SKYDD}`;
  return { typ: 'vardplan', mall, enhet: { id: ve, namn: enhet }, ...a, medianDagar: a.visas ? median(dagar) : null, text, demomarkning: DEMOMARKNING };
}

// Hur ofta en varning har kvitterats på vårdenheten det senaste året: antal ordinationer där varningen kvitterades.
// Kvitteringarna sparas med ordinationen (kvitterade_varningar), så bara sparade ordinationer räknas.
export function varning(db, personal, regel, nu = Date.now()) {
  const en = enheterFor(db, personal);
  const fran = new Date(nu - 365 * 86400_000).toISOString();
  const n = db.query(`SELECT kvitterade_varningar AS k FROM ordinationer WHERE enhet_id IN (${ph(en)}) AND skapad >= ? AND kvitterade_varningar IS NOT NULL`).all(...en, fran)
    .filter(r => { try { return JSON.parse(r.k).some(x => x?.regel === regel); } catch { return false; } }).length;
  const visas = ok(n);
  return {
    typ: 'varning', regel, visas, kvitterade: visas ? n : null,
    text: !visas ? `Varningen har kvitterats vid färre än ${MINSTA} ordinationer på vårdenheten det senaste året.`
      : n === 0 ? 'Varningen har inte kvitterats vid någon ordination på vårdenheten det senaste året.'
        : `Varningen har kvitterats vid ${n} ordinationer på vårdenheten det senaste året. En varning som ofta kvitteras ses över av systemförvaltningen.`,
    demomarkning: DEMOMARKNING,
  };
}

// Ordinationer av substansen på vårdenheten de senaste två åren och hur många av dem som sattes ut inom 30 dagar.
export function substans(db, personal, atc, nu = Date.now()) {
  const en = enheterFor(db, personal);
  const fran = new Date(nu - 730 * 86400_000).toISOString().slice(0, 10);
  const rader = db.query(`SELECT o.start, o.utsatt_tid AS utsatt FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id
    WHERE k.atc = ? AND o.enhet_id IN (${ph(en)}) AND o.start >= ?`).all(atc, ...en, fran);
  const tidigt = rader.filter(r => r.utsatt && r.utsatt.slice(0, 10) <= addDagar(r.start, 30)).length;
  const a = andel(tidigt, rader.length);
  return {
    typ: 'substans', atc, ...a,
    text: a.visas ? `Av ${a.n} ordinationer av substansen på vårdenheten de senaste två åren sattes ${a.x} ut inom 30 dagar (${a.procent} procent).`
      : `Underlaget på vårdenheten är för litet för att visa hur ofta substansen sätts ut. ${SKYDD}`,
    demomarkning: DEMOMARKNING,
  };
}

// Lägger till vårdenhetens erfarenhet vid varje varning (berikade varningar från kunskapsstod.js).
export function vidVarningar(db, personal, varningar = [], nu = Date.now()) {
  const cache = new Map();
  return varningar.map(x => {
    if (!x?.regel) return x;
    if (!cache.has(x.regel)) cache.set(x.regel, varning(db, personal, x.regel, nu));
    return { ...x, utfall: cache.get(x.regel) };
  });
}
