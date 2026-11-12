// Runda 14, r3: meddelandenas innehåll som ett träd av element, för kontrakten för intyg, e-remiss, vaccination,
// Infektionsverktyget, NKRR, formulär, 1177 och dos. Kuvertet (SOAP enligt RIVTA Basic Profile 2.1), huvudena, felen och
// valideringen mot schemat hör till den gemensamma grunden i src/rivta/ (del r2). Här byggs bara kroppen, i schemats
// ordning, och den tolkas när den kommer in.
//
// Ett element är { n: 'prefix:namn', a: { attribut }, b: [barn] eller text }. Element utan värde (null eller undefined)
// tas bort, så att valfria element kan anges direkt ur journalens uppgifter utan villkor.

// Ett element. Barnen får vara element, text, tal, null (tas bort) eller listor av element.
export function e(n, b = null, a = null) {
  if (b === null || b === undefined) return a && Object.values(a).some(v => v !== null && v !== undefined) ? { n, a: rensa(a), b: [] } : null;
  if (Array.isArray(b)) {
    const barn = b.flat(Infinity).filter(x => x !== null && x !== undefined && x !== '');
    if (!barn.length && !a) return null;
    return { n, a: a ? rensa(a) : null, b: barn };
  }
  return { n, a: a ? rensa(a) : null, b: String(b) };
}
const rensa = (a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)]));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const esc = (s) => String(s).replace(/[&<>"']/g, c => ESC[c]);

// XML för ett element. ns är namnrymderna { prefix: uri } som deklareras på det yttersta elementet.
export function xml(el, ns = {}) {
  const dekl = Object.entries(ns).map(([p, u]) => ` xmlns${p ? `:${p}` : ''}="${esc(u)}"`).join('');
  return ut(el, dekl);
}
function ut(el, dekl = '') {
  if (typeof el === 'string') return esc(el);
  const attr = Object.entries(el.a ?? {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  if (typeof el.b === 'string') return `<${el.n}${dekl}${attr}>${esc(el.b)}</${el.n}>`;
  if (!el.b?.length) return `<${el.n}${dekl}${attr}/>`;
  return `<${el.n}${dekl}${attr}>${el.b.map(x => ut(x)).join('')}</${el.n}>`;
}

// Tolkning av ett inkommande meddelande. Bara element, attribut, text och CDATA. En dokumenttypsdeklaration eller en
// entitet utöver de fem fördefinierade avvisas, så att inga externa entiteter eller entitetsbomber kan tolkas, och storlek
// och djup har tak. Elementen får { n (lokalt namn), ns (namnrymd), a, b, text }.
export const MAX_BYTE = 2_000_000;
export const MAX_DJUP = 60;
export const MAX_ELEMENT = 50_000;
export class XmlFel extends Error {}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function avkoda(s) {
  if (/&(?!(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);)/.test(s)) throw new XmlFel('Ett ensamt &-tecken i meddelandet.');
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, k) => {
    if (k[0] === '#') {
      const c = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      if (!Number.isFinite(c) || c > 0x10ffff) throw new XmlFel('Ogiltig teckenreferens.');
      return String.fromCodePoint(c);
    }
    if (!Object.hasOwn(ENT, k)) throw new XmlFel('Meddelandet innehåller en entitet som inte tas emot.');
    return ENT[k];
  });
}
export function tolka(text) {
  if (typeof text !== 'string') throw new XmlFel('Meddelandet ska vara text.');
  if (Buffer.byteLength(text) > MAX_BYTE) throw new XmlFel('Meddelandet är för stort.');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new XmlFel('Meddelandet får inte ha en dokumenttypsdeklaration.');
  let i = 0;
  const rot = { n: '#rot', b: [], nsmap: {} };
  const stack = [rot];
  let antal = 0;
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/gy;
  while (i < text.length) {
    re.lastIndex = i;
    const m = re.exec(text);
    if (!m) throw new XmlFel('Meddelandet är inte välformad XML.');
    i = re.lastIndex;
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) { top.b.push(m[1]); continue; }
    if (m[6] !== undefined) { if (stack.length > 1) top.b.push(avkoda(m[6])); else if (m[6].trim()) throw new XmlFel('Text utanför rotelementet.'); continue; }
    if (m[0].startsWith('<!--') || m[0].startsWith('<?')) continue;
    if (m[2] !== undefined) {
      if (stack.length < 2 || top.qn !== m[2]) throw new XmlFel(`Sluttaggen ${m[2]} stämmer inte.`);
      stack.pop();
      continue;
    }
    if (++antal > MAX_ELEMENT) throw new XmlFel('Meddelandet har för många element.');
    if (stack.length > MAX_DJUP) throw new XmlFel('Meddelandet är för djupt.');
    const attr = {};
    const nsmap = { ...top.nsmap };
    for (const am of m[4].matchAll(/([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      const v = avkoda(am[3] ?? am[4] ?? '');
      if (am[1] === 'xmlns') nsmap[''] = v; else if (am[1].startsWith('xmlns:')) nsmap[am[1].slice(6)] = v; else attr[am[1].includes(':') ? am[1].split(':')[1] : am[1]] = v;
    }
    const [pre, lok] = m[3].includes(':') ? m[3].split(':') : ['', m[3]];
    const el = { n: lok, ns: nsmap[pre] ?? null, qn: m[3], a: attr, b: [], nsmap };
    top.b.push(el);
    if (!m[5]) stack.push(el);
  }
  if (stack.length !== 1) throw new XmlFel('Meddelandet slutar mitt i ett element.');
  const rotEl = rot.b.filter(x => typeof x !== 'string');
  if (rotEl.length !== 1) throw new XmlFel('Meddelandet ska ha ett rotelement.');
  return stada(rotEl[0]);
}
// Text i element som bara har text, och bara element i element som har barn.
function stada(el) {
  const barn = el.b.filter(x => typeof x !== 'string');
  const text = el.b.filter(x => typeof x === 'string').join('');
  delete el.nsmap; delete el.qn;
  if (barn.length) { el.b = barn.map(stada); el.text = null; } else { el.b = []; el.text = text; }
  return el;
}

// Hjälp för att läsa ett tolkat meddelande på lokala namn: hitta(el, 'intyg/intygs-id/extension').
export function hitta(el, vag) {
  let x = el;
  for (const del of vag.split('/')) { x = x?.b?.find(c => c.n === del); if (!x) return null; }
  return x;
}
export const text = (el, vag) => { const x = vag ? hitta(el, vag) : el; return x ? (x.text ?? '').trim() : null; };
export const alla = (el, namn) => (el?.b ?? []).filter(c => c.n === namn);
