// Runda 10, r3: rättstavning och grammatik för svenska och medicinska termer (Sussa 3.1.3.10).
//
// Fälten i journalen har webbläsarens egen stavningskontroll på svenska (lang och spellcheck), som sköter den allmänna
// svenskan. Den här modulen kontrollerar det som webbläsaren inte kan: medicinska termer. Ordlistan byggs ur Vårdkällans
// medicinska ordlista (seed/stavning-ordlista.js), titlarna i ICD-10-SE och KVÅ, läkemedelskatalogens namn och substanser,
// mätvärdena och sökorden, så att den följer kodverken när de uppdateras. Ett ord som inte finns och som ligger nära en
// medicinsk term markeras med förslag. Systemet känner själv igen böjningar och sammansättningar, så att pneumonin och
// blodtrycksmätningen inte markeras. Grammatiken kontrolleras med regler för det som är vanligt i journaltext: samma ord
// två gånger, liten bokstav efter punkt, mellanslag runt skiljetecken och särskrivning av medicinska termer.
//
// Varje person har en egen ordlista med ord som inte ska markeras. Texten som kontrolleras sparas aldrig och loggas
// aldrig, eftersom den kan innehålla patientuppgifter i ett fält som ännu inte är sparat. Den kontrolleras bara för den
// som är inloggad som personal.
import { Fel, iso } from './db.js';
import { ICD10SE, KVA } from './kodverk.js';
import { SOKORD } from './fackssprak.js';
import * as O from './seed/stavning-ordlista.js';

export const MAX_TEXT = 8000;
export const MAX_ORD = 500;
const SPRAK = { sv: 'svenska', en: 'engelska' };
const ORD = /[\p{L}][\p{L}'-]*/gu;
const lagsta = (s) => s.toLocaleLowerCase('sv-SE');
const ordAv = (text) => [...new Set((text ?? '').split(/[^\p{L}]+/u).map(lagsta).filter(w => w.length >= 4))];

// Ordlistan per sandlåda, byggd en gång. Läkemedelskatalogen läses ur sandlådan.
const cache = new WeakMap();
function ordlistor(db) {
  if (cache.has(db)) return cache.get(db);
  const icd = Object.values(ICD10SE).flatMap(ordAv);
  const kva = Object.values(KVA).flatMap(ordAv);
  const lm = db.query('SELECT namn, substans FROM katalog').all().flatMap(r => [...ordAv(r.namn), ...ordAv(r.substans)]);
  const ovr = [...Object.keys(SOKORD).flatMap(ordAv), ...Object.values(require('./journal.js').MATTYPER).flatMap(m => ordAv(m.namn))];
  const egen = O.MEDICINSKA.map(lagsta);
  const med = new Set([...egen, ...icd, ...kva, ...lm, ...ovr]);
  const l = {
    sv: { medicinska: med, kanda: new Set([...med, ...O.VANLIGA.map(lagsta)]), lista: [...med] },
    en: { medicinska: new Set(O.ENGELSKA), kanda: new Set([...O.ENGELSKA, ...O.ENGELSKA_VANLIGA]), lista: [...O.ENGELSKA] },
    kallor: [
      { kalla: 'Vårdkällans medicinska ordlista', utgava: `version ${O.VERSION.version}, ${O.VERSION.datum}`, antal: new Set(egen).size },
      { kalla: 'ICD-10-SE', utgava: 'ICD-10-SE 2026, Socialstyrelsen', antal: new Set(icd).size },
      { kalla: 'KVÅ', utgava: 'KVÅ 2026, E-hälsomyndigheten', antal: new Set(kva).size },
      { kalla: 'Läkemedelskatalogen', utgava: 'Vårdkällans läkemedelskatalog i sandlådan', antal: new Set(lm).size },
      { kalla: 'Sökord och mätvärden', utgava: 'Journalens mallar och mätvärdestyper', antal: new Set(ovr).size },
      { kalla: 'Medicinska termer på engelska', utgava: `version ${O.VERSION.version}, ${O.VERSION.datum}`, antal: O.ENGELSKA.length },
    ],
  };
  cache.set(db, l);
  return l;
}

// Böjningsändelser som systemet tar bort för att hitta grundformen, längsta först.
const ANDELSER = {
  sv: ['ningarna', 'ningarnas', 'ningens', 'ningar', 'ningen', 'arnas', 'ernas', 'ornas', 'arna', 'erna', 'orna', 'ande', 'ende', 'ning', 'aren', 'eren',
    'ens', 'ets', 'ats', 'ade', 'are', 'aste', 'ast', 'en', 'et', 'ar', 'er', 'or', 'na', 'ns', 'ts', 'an', 'at', 'ad', 's', 'n', 't', 'a', 'e', 'r'],
  en: ['ations', 'ation', 'ings', 'ing', 'ies', 'es', 'ed', 'ly', 's'],
};

// Är ordet känt: i ordlistan, en böjning av ett ord i den, eller sammansatt av kända ord (med eller utan fogens s).
function kand(w, l, sprak, egna, djup = 2) {
  if (w.length <= 3 || l.kanda.has(w) || egna.has(w)) return true;
  for (const a of ANDELSER[sprak]) {
    if (w.length - a.length >= 3 && w.endsWith(a)) {
      const stam = w.slice(0, -a.length);
      if (l.kanda.has(stam) || l.kanda.has(`${stam}a`) || l.kanda.has(`${stam}e`) || egna.has(stam)) return true;
    }
  }
  if (sprak !== 'sv' || djup === 0) return false;
  for (let i = 4; i <= w.length - 3; i++) {
    const a = w.slice(0, i);
    const forled = l.kanda.has(a) || (a.endsWith('s') && l.kanda.has(a.slice(0, -1)));
    if (forled && kand(w.slice(i), l, sprak, egna, djup - 1)) return true;
  }
  return false;
}

// Avståndet mellan två ord: infogning, borttagning, utbyte och två bokstäver som bytt plats räknas som ett steg vardera.
export function avstand(a, b, tak = 3) {
  if (Math.abs(a.length - b.length) > tak) return tak + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const k = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + k);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const somOrdet = (forebild, ord) => (forebild[0] === forebild[0].toLocaleUpperCase('sv-SE') && forebild[0] !== forebild[0].toLocaleLowerCase('sv-SE') ? ord[0].toLocaleUpperCase('sv-SE') + ord.slice(1) : ord);

function forslag(w, l) {
  const tak = w.length <= 7 ? 1 : 2;
  return l.lista.map(t => ({ t, d: avstand(w, t, tak) })).filter(x => x.d <= tak)
    .sort((a, b) => a.d - b.d || Math.abs(a.t.length - w.length) - Math.abs(b.t.length - w.length) || a.t.localeCompare(b.t, 'sv')).slice(0, 3).map(x => x.t);
}

const FORKORTNINGAR = new Set(['t.ex.', 'bl.a.', 'p.g.a.', 'pga.', 'dvs.', 'd.v.s.', 'ca.', 'kl.', 'mg.', 'ml.', 'st.', 'nr.', 'resp.', 'enl.', 'jfr.', 'ev.', 'e.g.', 'i.e.', 'etc.', 'vb.', 'v.b.', 'tim.', 'min.']);

function grammatik(text, l, sprak) {
  const ut = [];
  const g = (start, slut, forklaring, forslagLista) => ut.push({ start, slut, text: text.slice(start, slut), typ: 'grammatik', forklaring, forslag: forslagLista });
  const ord = [...text.matchAll(ORD)];
  for (let i = 0; i + 1 < ord.length; i++) {
    const a = ord[i]; const b = ord[i + 1];
    if (lagsta(a[0]) === lagsta(b[0]) && /^\s+$/.test(text.slice(a.index + a[0].length, b.index))) g(a.index, b.index + b[0].length, `Ordet ${a[0]} står två gånger i rad.`, [a[0]]);
  }
  for (const m of text.matchAll(/([.!?])(\s+)(\p{Ll}\p{L}*)/gu)) {
    const fore = text.slice(0, m.index + 1).match(/(\S+)$/)?.[1] ?? '';
    if (FORKORTNINGAR.has(lagsta(fore)) || /^(\p{L}\.){2,}$/u.test(fore)) continue;
    const s = m.index + m[1].length + m[2].length;
    g(s, s + m[3].length, sprak === 'sv' ? 'En ny mening börjar med stor bokstav.' : O.ENGELSKA_TEXTER.stor, [m[3][0].toLocaleUpperCase('sv-SE') + m[3].slice(1)]);
  }
  for (const m of text.matchAll(/([\p{L}\d])([ \t]+)([,.;:!?])/gu)) {
    const s = m.index + 1;
    const tecken = { ',': 'kommatecken', '.': 'punkt', ';': 'semikolon', ':': 'kolon', '!': 'utropstecken', '?': 'frågetecken' }[m[3]];
    g(s, s + m[2].length + 1, `Inget mellanslag före ${tecken}.`, [m[3]]);
  }
  for (const m of text.matchAll(/([,;:])(\p{L})|(\p{L})([.!?])(\p{Lu})/gu)) {
    const s = m[1] ? m.index : m.index + 1;
    g(s, s + 2, sprak === 'sv' ? 'Det behövs ett mellanslag efter skiljetecknet.' : O.ENGELSKA_TEXTER.mellanslag, [`${m[1] ?? m[4]} ${m[2] ?? m[5]}`]);
  }
  if (sprak === 'sv') {
    for (let i = 0; i + 1 < ord.length; i++) {
      const a = ord[i]; const b = ord[i + 1];
      if (a[0].length < 3 || b[0].length < 3 || text.slice(a.index + a[0].length, b.index) !== ' ') continue;
      const ihop = lagsta(a[0] + b[0]);
      if (l.medicinska.has(ihop) && !l.medicinska.has(lagsta(a[0]) + ' ' + lagsta(b[0]))) g(a.index, b.index + b[0].length, `${a[0]} ${b[0]} skrivs ihop: ${ihop}.`, [somOrdet(a[0], ihop)]);
    }
  }
  for (const m of text.matchAll(/(\S)( {2,})(\S)/gu)) g(m.index + 1, m.index + 1 + m[2].length, 'Det står två mellanslag i rad. Ett räcker.', [' ']);
  return ut;
}

const egnaOrd = (db, personal) => new Set(db.query('SELECT ord FROM personlig_ordlista WHERE personal_id = ?').all(personal.id).map(r => r.ord));
const sakra = (db) => require('./formularmotor.js').sakra(db);

// Kontrollerar en text. Svaret har varje möjligt fel med position, förklaring och förslag. Texten sparas inte.
export function kontrollera(db, personal, { text, sprak = 'sv' } = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  if (typeof text !== 'string') throw new Fel(400, 'Texten saknas.', 'ogiltig', { falt: ['text'] });
  if (text.length > MAX_TEXT) throw new Fel(400, `Texten är längre än ${MAX_TEXT} tecken, som är det längsta ett sökord kan ha.`, 'ogiltig', { falt: ['text'] });
  if (!Object.hasOwn(SPRAK, sprak)) throw new Fel(400, 'Språket kan vara svenska (sv) eller engelska (en).', 'ogiltig', { falt: ['sprak'] });
  sakra(db);
  const alla = ordlistor(db);
  const l = alla[sprak];
  const egna = egnaOrd(db, personal);
  const fel = [];
  for (const m of text.matchAll(ORD)) {
    const ord = m[0].replace(/['-]+$/, '');
    // Förkortningar med versaler, som CRP och EKG, och ord med siffror kontrolleras inte.
    if (ord.length < 5 || /\p{Lu}/u.test(ord.slice(1))) continue;
    const w = lagsta(ord);
    if (kand(w, l, sprak, egna)) continue;
    const f = forslag(w, l);
    if (!f.length) continue;
    fel.push({ start: m.index, slut: m.index + ord.length, text: ord, typ: 'stavning', forslag: f.map(x => somOrdet(ord, x)),
      forklaring: sprak === 'sv' ? `Ordet liknar en medicinsk term men finns inte i ordlistan. Menar du ${somOrdet(ord, f[0])}?` : O.ENGELSKA_TEXTER.term(somOrdet(ord, f[0])) });
  }
  fel.push(...grammatik(text, l, sprak));
  fel.sort((a, b) => a.start - b.start || a.slut - b.slut);
  return { sprak, fel };
}

export function ordlista(db, personal) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  sakra(db);
  return { ord: [...egnaOrd(db, personal)].sort((a, b) => a.localeCompare(b, 'sv')), max: MAX_ORD, kallor: ordlistor(db).kallor };
}

const provaOrd = (ord) => {
  const w = typeof ord === 'string' ? lagsta(ord.trim()) : '';
  if (!/^[\p{L}][\p{L}'-]{1,39}$/u.test(w)) throw new Fel(400, 'Lägg till ett ord i taget, med 2 till 40 bokstäver.', 'ogiltig', { falt: ['ord'] });
  return w;
};

export function laggTill(db, personal, { ord } = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  sakra(db);
  const w = provaOrd(ord);
  if (db.query('SELECT COUNT(*) n FROM personlig_ordlista WHERE personal_id = ?').get(personal.id).n >= MAX_ORD) throw new Fel(400, `Ordlistan har redan ${MAX_ORD} ord. Ta bort ord som inte längre behövs.`, 'ogiltig');
  db.query('INSERT OR IGNORE INTO personlig_ordlista (personal_id, ord, tillagd) VALUES (?, ?, ?)').run(personal.id, w, iso());
  return ordlista(db, personal);
}

export function taBort(db, personal, { ord } = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  sakra(db);
  db.query('DELETE FROM personlig_ordlista WHERE personal_id = ? AND ord = ?').run(personal.id, provaOrd(ord));
  return ordlista(db, personal);
}
