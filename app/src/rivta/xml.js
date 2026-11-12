// Runda 14, r2: en säker XML-tolk och en serialiserare för tjänstekontrakten (RIVTA). Tolken tar bara det som SOAP och
// tjänstekontraktens scheman behöver, och avvisar resten innan något annat läses:
// - ingen DOCTYPE, inga DTD:er och inga egna entiteter, så att varken externa entiteter (XXE) eller entitetsbomber kan
//   förekomma. Bara de fem fördefinierade entiteterna och teckenreferenser tolkas;
// - inga instruktioner (processing instructions) utom XML-deklarationen först i dokumentet, och bara UTF-8;
// - aldrig något från nätverket eller disken: tolken läser bara den text den får;
// - tak på storleken, djupet, antalet element, antalet attribut och längden på namn.
// Namnrymderna löses upp, och ett prefix som inte är deklarerat är ett fel.

export const XMLNS = 'http://www.w3.org/2000/xmlns/';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export const TAK = { byte: 2 * 1024 * 1024, djup: 48, element: 60_000, attribut: 64, namn: 200 };

export class XmlFel extends Error {
  constructor(text, pos = null) {
    super(pos == null ? text : `${text} (tecken ${pos})`);
    this.xmlfel = true;
  }
}

const NAMN = /^[A-Za-z_À-￯][A-Za-z0-9_.\-·À-￯]*$/;
const ENTITETER = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// Ersätter entiteter och teckenreferenser. Allt annat efter & är ett fel.
function avkoda(s, pos) {
  if (!s.includes('&')) return s;
  return s.replace(/&([^;&]{0,12});?/g, (m, namn) => {
    if (!m.endsWith(';')) throw new XmlFel('Ett & måste skrivas &amp;', pos);
    if (Object.hasOwn(ENTITETER, namn)) return ENTITETER[namn];
    let kod = null;
    if (/^#x[0-9a-fA-F]{1,6}$/.test(namn)) kod = parseInt(namn.slice(2), 16);
    else if (/^#[0-9]{1,7}$/.test(namn)) kod = parseInt(namn.slice(1), 10);
    if (kod == null) throw new XmlFel(`Entiteten &${namn}; är inte tillåten. Bara de fem fördefinierade entiteterna och teckenreferenser tolkas.`, pos);
    if (!(kod === 0x9 || kod === 0xA || kod === 0xD || (kod >= 0x20 && kod <= 0xD7FF) || (kod >= 0xE000 && kod <= 0xFFFD) || (kod >= 0x10000 && kod <= 0x10FFFF))) {
      throw new XmlFel('Teckenreferensen pekar på ett tecken som inte är tillåtet i XML.', pos);
    }
    return String.fromCodePoint(kod);
  });
}

function delaNamn(q, pos) {
  if (q.length > TAK.namn) throw new XmlFel('Ett namn är för långt.', pos);
  const i = q.indexOf(':');
  const prefix = i < 0 ? '' : q.slice(0, i);
  const lokal = i < 0 ? q : q.slice(i + 1);
  if ((prefix && !NAMN.test(prefix)) || !NAMN.test(lokal) || lokal.includes(':')) throw new XmlFel(`Namnet ${q} är inte ett giltigt XML-namn.`, pos);
  return { prefix, lokal };
}

// Ett element i trädet: { ns, lokal, prefix, attr: [{ ns, lokal, prefix, varde }], barn: [element], text, prefixer }.
// text är elementets egen text (utan barnens), och prefixer är de namnrymder som gäller i elementet (för QName i scheman).
export function tolka(indata, tak = {}) {
  const t = { ...TAK, ...tak };
  const s = typeof indata === 'string' ? indata : Buffer.from(indata).toString('utf8');
  if (Buffer.byteLength(s, 'utf8') > t.byte) throw new XmlFel(`Meddelandet är större än ${Math.round(t.byte / 1024)} kB.`);
  if (s.includes('\u0000')) throw new XmlFel('Meddelandet innehåller ett nolltecken.');
  let i = s.charCodeAt(0) === 0xFEFF ? 1 : 0;
  const stack = [];
  let rot = null;
  let antal = 0;
  const vit = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
  const forsta = i;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    const textSlut = lt < 0 ? s.length : lt;
    if (textSlut > i) {
      const text = s.slice(i, textSlut);
      if (stack.length) {
        if (text.includes(']]>')) throw new XmlFel('Teckenföljden ]]> får inte stå i text.', i);
        const el = stack.at(-1);
        el.text += avkoda(text, i);
      } else if ([...text].some(c => !vit(c))) throw new XmlFel('Text utanför rotelementet.', i);
    }
    if (lt < 0) break;
    i = lt;
    if (s.startsWith('<?', i)) {
      const slut = s.indexOf('?>', i);
      if (slut < 0) throw new XmlFel('En instruktion avslutas inte.', i);
      const innehall = s.slice(i + 2, slut);
      // Bara XML-deklarationen, och bara först i dokumentet.
      if (!/^xml(\s|$)/.test(innehall) || i !== forsta) throw new XmlFel('Instruktioner är inte tillåtna, bara XML-deklarationen först i dokumentet.', i);
      const kod = /encoding\s*=\s*["']([^"']+)["']/.exec(innehall)?.[1];
      if (kod && !/^utf-?8$/i.test(kod)) throw new XmlFel('Bara teckenkodningen UTF-8 tas emot.', i);
      i = slut + 2;
      continue;
    }
    if (s.startsWith('<!--', i)) {
      const slut = s.indexOf('-->', i + 4);
      if (slut < 0) throw new XmlFel('En kommentar avslutas inte.', i);
      if (s.slice(i + 4, slut).includes('--')) throw new XmlFel('En kommentar får inte innehålla --.', i);
      i = slut + 3;
      continue;
    }
    if (s.startsWith('<![CDATA[', i)) {
      if (!stack.length) throw new XmlFel('CDATA utanför rotelementet.', i);
      const slut = s.indexOf(']]>', i + 9);
      if (slut < 0) throw new XmlFel('En CDATA-sektion avslutas inte.', i);
      stack.at(-1).text += s.slice(i + 9, slut);
      i = slut + 3;
      continue;
    }
    if (s.startsWith('<!', i)) throw new XmlFel('DOCTYPE, DTD och entitetsdeklarationer är inte tillåtna.', i);
    if (s.startsWith('</', i)) {
      const slut = s.indexOf('>', i);
      if (slut < 0) throw new XmlFel('En sluttagg avslutas inte.', i);
      const namn = s.slice(i + 2, slut).trim();
      const el = stack.pop();
      if (!el || el.qnamn !== namn) throw new XmlFel(`Sluttaggen </${namn}> passar inte${el ? ` till <${el.qnamn}>` : ''}.`, i);
      delete el.qnamn;
      i = slut + 1;
      continue;
    }
    // En starttagg. Attributvärden kan innehålla >, så taggen läses tecken för tecken.
    let j = i + 1;
    while (j < s.length && !vit(s[j]) && s[j] !== '>' && s[j] !== '/') j++;
    const qnamn = s.slice(i + 1, j);
    if (!qnamn) throw new XmlFel('Ett element saknar namn.', i);
    const rattAttr = [];
    let tom = false;
    for (;;) {
      while (j < s.length && vit(s[j])) j++;
      if (j >= s.length) throw new XmlFel(`Taggen <${qnamn}> avslutas inte.`, i);
      if (s[j] === '>') { j++; break; }
      if (s[j] === '/' && s[j + 1] === '>') { tom = true; j += 2; break; }
      let k = j;
      while (k < s.length && s[k] !== '=' && !vit(s[k]) && s[k] !== '>' && s[k] !== '/') k++;
      const anamn = s.slice(j, k);
      while (k < s.length && vit(s[k])) k++;
      if (s[k] !== '=') throw new XmlFel(`Attributet ${anamn} saknar värde.`, k);
      k++;
      while (k < s.length && vit(s[k])) k++;
      const q = s[k];
      if (q !== '"' && q !== "'") throw new XmlFel(`Värdet för ${anamn} ska stå inom citattecken.`, k);
      const slut = s.indexOf(q, k + 1);
      if (slut < 0) throw new XmlFel(`Värdet för ${anamn} avslutas inte.`, k);
      const rått = s.slice(k + 1, slut);
      if (rått.includes('<')) throw new XmlFel(`Värdet för ${anamn} innehåller <.`, k);
      // Radbrytningar och tabbar i attribut normaliseras till mellanslag, som i XML 1.0.
      rattAttr.push({ qnamn: anamn, varde: avkoda(rått, k).replace(/[\t\n\r]/g, ' ') });
      if (rattAttr.length > t.attribut) throw new XmlFel(`Ett element har fler än ${t.attribut} attribut.`, k);
      j = slut + 1;
    }
    if (++antal > t.element) throw new XmlFel(`Meddelandet har fler än ${t.element} element.`, i);
    if (stack.length + 1 > t.djup) throw new XmlFel(`Meddelandet är djupare än ${t.djup} nivåer.`, i);
    if (!stack.length && rot) throw new XmlFel('Dokumentet har mer än ett rotelement.', i);
    // Namnrymderna: ärvda och egna deklarationer.
    const prefixer = { ...(stack.at(-1)?.prefixer ?? { xml: XML_NS }) };
    const sedda = new Set();
    for (const a of rattAttr) {
      if (sedda.has(a.qnamn)) throw new XmlFel(`Attributet ${a.qnamn} står två gånger.`, i);
      sedda.add(a.qnamn);
      if (a.qnamn === 'xmlns') prefixer[''] = a.varde;
      else if (a.qnamn.startsWith('xmlns:')) {
        const p = a.qnamn.slice(6);
        delaNamn(p, i);
        if (p === 'xml' || p === 'xmlns') throw new XmlFel(`Prefixet ${p} får inte deklareras om.`, i);
        if (!a.varde) throw new XmlFel(`Prefixet ${p} får inte deklareras med en tom namnrymd.`, i);
        prefixer[p] = a.varde;
      }
    }
    const { prefix, lokal } = delaNamn(qnamn, i);
    if (prefix && !Object.hasOwn(prefixer, prefix)) throw new XmlFel(`Prefixet ${prefix} är inte deklarerat.`, i);
    const attr = [];
    const unika = new Set();
    for (const a of rattAttr) {
      if (a.qnamn === 'xmlns' || a.qnamn.startsWith('xmlns:')) continue;
      const d = delaNamn(a.qnamn, i);
      if (d.prefix && !Object.hasOwn(prefixer, d.prefix)) throw new XmlFel(`Prefixet ${d.prefix} är inte deklarerat.`, i);
      const ns = d.prefix ? prefixer[d.prefix] : '';
      const nyckel = `${ns}|${d.lokal}`;
      if (unika.has(nyckel)) throw new XmlFel(`Attributet ${d.lokal} står två gånger.`, i);
      unika.add(nyckel);
      attr.push({ ns, lokal: d.lokal, prefix: d.prefix, varde: a.varde });
    }
    const el = { ns: prefix ? prefixer[prefix] : (prefixer[''] ?? ''), lokal, prefix, attr, barn: [], text: '', prefixer, qnamn };
    if (stack.length) stack.at(-1).barn.push(el);
    else rot = el;
    if (tom) delete el.qnamn;
    else stack.push(el);
    i = j;
  }
  if (stack.length) throw new XmlFel(`Elementet <${stack.at(-1).qnamn}> avslutas inte.`);
  if (!rot) throw new XmlFel('Meddelandet har inget rotelement.');
  return rot;
}

// Hjälpare för trädet.
export const attribut = (el, lokal, ns = '') => el.attr.find(a => a.lokal === lokal && a.ns === ns)?.varde ?? null;
export const barnen = (el, lokal = null, ns = undefined) => el.barn.filter(b => (lokal == null || b.lokal === lokal) && (ns === undefined || b.ns === ns));
export const barn = (el, lokal, ns = undefined) => barnen(el, lokal, ns)[0] ?? null;
export const harText = (el) => /[^ \t\r\n]/.test(el.text);

// ---------------------------------------------------------------------------------------------------------------
// Serialiseraren. Ett element byggs med el(ns, lokal, barn, attribut), och skrivs med skriv(). Namnrymderna får prefix
// i den ordning de dyker upp och deklareras på rotelementet, så att varje del kan läsas för sig.

export const esc = (v) => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  .replace(/\r/g, '&#13;');

export function el(ns, lokal, barn = [], attr = []) {
  return { ns: ns ?? '', lokal, attr, barn: Array.isArray(barn) ? barn.filter(b => b != null) : [], text: Array.isArray(barn) ? '' : String(barn) };
}

// Skriver elementet som XML. prefix är förslag på prefix per namnrymd ({ [ns]: 'p' }).
export function skriv(rot, { prefix = {}, deklaration = false } = {}) {
  const tilldelade = new Map();
  let n = 0;
  // Runda 14, r3: värdet i xsi:type är ett QName. Dess namnrymd får ett prefix som andra, och värdet skrivs med det.
  const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
  const xsiNs = (e, a) => {
    if (a.ns !== XSI || a.lokal !== 'type' || !e.prefixer) return null;
    const i = a.varde.indexOf(':');
    return e.prefixer[i < 0 ? '' : a.varde.slice(0, i)] ?? null;
  };
  const samla = (e) => {
    for (const ns of [e.ns, ...e.attr.map(a => a.ns), ...e.attr.map(a => xsiNs(e, a))]) {
      if (ns && ns !== XML_NS && !tilldelade.has(ns)) tilldelade.set(ns, prefix[ns] ?? `ns${++n}`);
    }
    e.barn.forEach(samla);
  };
  samla(rot);
  const q = (ns, lokal) => (!ns ? lokal : ns === XML_NS ? `xml:${lokal}` : `${tilldelade.get(ns)}:${lokal}`);
  const ut = [];
  const skrivEl = (e, rotEl) => {
    const a = e.attr.map(x => { const ns = xsiNs(e, x); const v = ns ? `${tilldelade.get(ns)}:${x.varde.slice(x.varde.indexOf(':') + 1)}` : x.varde; return ` ${q(x.ns, x.lokal)}="${esc(v)}"`; }).join('');
    const d = rotEl ? [...tilldelade.entries()].map(([ns, p]) => ` xmlns:${p}="${esc(ns)}"`).join('') : '';
    const namn = q(e.ns, e.lokal);
    if (!e.barn.length && !e.text) { ut.push(`<${namn}${d}${a}/>`); return; }
    ut.push(`<${namn}${d}${a}>`);
    if (e.text) ut.push(esc(e.text).replace(/>/g, '&gt;'));
    for (const b of e.barn) skrivEl(b, false);
    ut.push(`</${namn}>`);
  };
  // Ett element utan namnrymd under ett element med standardnamnrymd behöver ingen deklaration, eftersom alla element
  // med namnrymd har prefix.
  skrivEl(rot, true);
  return `${deklaration ? '<?xml version="1.0" encoding="UTF-8"?>' : ''}${ut.join('')}`;
}
