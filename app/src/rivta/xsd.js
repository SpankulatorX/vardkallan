// Runda 14, r2: validering mot tjänstekontraktens XML-scheman (XSD 1.0), och byggande och läsning av meddelanden utifrån
// schemat. Schemana läses från de pinnade filerna under app/rivta/ med den säkra tolken i xml.js, och import och include
// följs bara till filer under samma katalog, aldrig till nätverket.
//
// Valideringen tar den del av XSD som tjänstekontrakten i RIVTA använder: element, complexType med sequence och choice,
// grupper, xs:any med namespace och processContents, attribut och anyAttribute, simpleContent och complexContent med
// extension, simpleType med restriction (enumeration, pattern, längder, gränser och siffror), union och list, och de
// inbyggda typerna. En konstruktion som inte tas med (till exempel xs:all, substitutionGroup eller xs:redefine) ger ett fel
// när schemat läses, så att valideringen aldrig tyst blir svagare än schemat.
//
// Samma modell bygger ett meddelande ur ett vanligt objekt (bygg): elementen kommer i schemats ordning med rätt namnrymd,
// och ett fält som schemat inte har är ett fel. lasUt gör det omvända. Allt som byggs valideras innan det skickas.
import { readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { tolka, el as nyttEl, harText } from './xml.js';

export const XS = 'http://www.w3.org/2001/XMLSchema';
export const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const nyckel = (ns, lokal) => `${ns ?? ''}|${lokal}`;
const OBEGRANSAT = Infinity;

export class SchemaFel extends Error {}

// ---------------------------------------------------------------------------------------------------------------
// De inbyggda typerna. vit är hur blanktecken behandlas (preserve, replace eller collapse), och prova ger en
// felbeskrivning eller null.
const tal = (re) => (v) => (re.test(v) ? null : 'är inte ett tal av rätt slag');
const heltal = /^[+-]?\d+$/;
const intervall = (min, max) => (v) => {
  if (!heltal.test(v)) return 'är inte ett heltal';
  const b = BigInt(v);
  return (min != null && b < min) || (max != null && b > max) ? 'ligger utanför typens gränser' : null;
};
const tidRe = {
  dateTime: /^-?\d{4,}-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
  date: /^-?\d{4,}-(\d{2})-(\d{2})(Z|[+-]\d{2}:\d{2})?$/,
  time: /^(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
  gYear: /^-?\d{4,}(Z|[+-]\d{2}:\d{2})?$/,
  gYearMonth: /^-?\d{4,}-(\d{2})(Z|[+-]\d{2}:\d{2})?$/,
  duration: /^-?P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/,
};
function provaTid(typ, v) {
  const m = tidRe[typ].exec(v);
  if (!m) return `är inte ett värde av typen ${typ}`;
  if (typ === 'dateTime' || typ === 'date') {
    const man = Number(m[1]), dag = Number(m[2]);
    if (man < 1 || man > 12 || dag < 1 || dag > 31) return 'har en månad eller dag som inte finns';
    if (typ === 'dateTime' && (Number(m[3]) > 24 || Number(m[4]) > 59 || Number(m[5]) > 60)) return 'har en tid som inte finns';
  }
  if (typ === 'time' && (Number(m[1]) > 24 || Number(m[2]) > 59 || Number(m[3]) > 60)) return 'har en tid som inte finns';
  return null;
}
const NCNAME = /^[A-Za-z_À-￯][A-Za-z0-9_.\-·À-￯]*$/;
const INBYGGDA = {
  anySimpleType: { vit: 'preserve', prova: () => null },
  string: { vit: 'preserve', prova: () => null },
  normalizedString: { vit: 'replace', prova: () => null },
  token: { vit: 'collapse', prova: () => null },
  language: { vit: 'collapse', prova: (v) => (/^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(v) ? null : 'är inte en språkkod') },
  Name: { vit: 'collapse', prova: (v) => (/^[A-Za-z_:À-￯][A-Za-z0-9_.:\-·À-￯]*$/.test(v) ? null : 'är inte ett namn') },
  NCName: { vit: 'collapse', prova: (v) => (NCNAME.test(v) ? null : 'är inte ett namn utan kolon') },
  ID: { vit: 'collapse', prova: (v) => (NCNAME.test(v) ? null : 'är inte ett id') },
  IDREF: { vit: 'collapse', prova: (v) => (NCNAME.test(v) ? null : 'är inte ett id') },
  NMTOKEN: { vit: 'collapse', prova: (v) => (/^[A-Za-z0-9_.:\-·À-￯]+$/.test(v) ? null : 'är inte ett namnord') },
  anyURI: { vit: 'collapse', prova: (v) => (/[\s<>"{}|\\^`]/.test(v.replace(/ /g, '')) ? 'är inte en URI' : null) },
  QName: { vit: 'collapse', qname: true, prova: (v) => (/^([A-Za-z_][\w.\-]*:)?[A-Za-z_][\w.\-]*$/.test(v) ? null : 'är inte ett kvalificerat namn') },
  boolean: { vit: 'collapse', prova: (v) => (/^(true|false|1|0)$/.test(v) ? null : 'ska vara ett sanningsvärde') },
  decimal: { vit: 'collapse', tal: true, prova: tal(/^[+-]?(\d+(\.\d*)?|\.\d+)$/) },
  double: { vit: 'collapse', tal: true, prova: tal(/^([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?|[+-]?INF|NaN)$/) },
  float: { vit: 'collapse', tal: true, prova: tal(/^([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?|[+-]?INF|NaN)$/) },
  integer: { vit: 'collapse', tal: true, prova: intervall(null, null) },
  nonNegativeInteger: { vit: 'collapse', tal: true, prova: intervall(0n, null) },
  positiveInteger: { vit: 'collapse', tal: true, prova: intervall(1n, null) },
  nonPositiveInteger: { vit: 'collapse', tal: true, prova: intervall(null, 0n) },
  negativeInteger: { vit: 'collapse', tal: true, prova: intervall(null, -1n) },
  long: { vit: 'collapse', tal: true, prova: intervall(-(2n ** 63n), 2n ** 63n - 1n) },
  int: { vit: 'collapse', tal: true, prova: intervall(-(2n ** 31n), 2n ** 31n - 1n) },
  short: { vit: 'collapse', tal: true, prova: intervall(-32768n, 32767n) },
  byte: { vit: 'collapse', tal: true, prova: intervall(-128n, 127n) },
  unsignedLong: { vit: 'collapse', tal: true, prova: intervall(0n, 2n ** 64n - 1n) },
  unsignedInt: { vit: 'collapse', tal: true, prova: intervall(0n, 2n ** 32n - 1n) },
  unsignedShort: { vit: 'collapse', tal: true, prova: intervall(0n, 65535n) },
  unsignedByte: { vit: 'collapse', tal: true, prova: intervall(0n, 255n) },
  base64Binary: { vit: 'collapse', prova: (v) => (/^([A-Za-z0-9+/] ?)*(=( ?=)?)?$/.test(v) && v.replace(/ /g, '').length % 4 === 0 ? null : 'är inte base64') },
  hexBinary: { vit: 'collapse', prova: (v) => (/^([0-9a-fA-F]{2})*$/.test(v) ? null : 'är inte hexadecimalt') },
  ...Object.fromEntries(Object.keys(tidRe).map(t => [t, { vit: 'collapse', tid: true, prova: (v) => provaTid(t, v) }])),
};

function blanka(v, vit) {
  if (vit === 'preserve') return v;
  const r = v.replace(/[\t\n\r]/g, ' ');
  return vit === 'replace' ? r : r.replace(/ +/g, ' ').trim();
}

// Ett mönster i XSD är förankrat och har några egna klasser (\i och \c). Det blir ett reguljärt uttryck i JavaScript.
function monster(p) {
  const js = p.replace(/\\i/g, '[A-Za-z_:\\u00C0-\\uFFEF]').replace(/\\c/g, '[A-Za-z0-9_.:\\-\\u00B7\\u00C0-\\uFFEF]')
    .replace(/\\I/g, '[^A-Za-z_:\\u00C0-\\uFFEF]').replace(/\\C/g, '[^A-Za-z0-9_.:\\-\\u00B7\\u00C0-\\uFFEF]');
  if (/\[[^\]]*-\[/.test(js)) throw new SchemaFel(`Mönstret ${p} använder subtraktion av teckenklasser, som valideringen inte har.`);
  try { return new RegExp(`^(?:${js})$`, 'u'); } catch { return new RegExp(`^(?:${js})$`); }
}

// ---------------------------------------------------------------------------------------------------------------

const SKIP = new Set(['annotation']);
const intAttr = (v, std) => (v == null ? std : v === 'unbounded' ? OBEGRANSAT : Number(v));

export class Schemaset {
  constructor(rot) {
    this.rot = resolve(rot);
    this.filer = new Map();
    this.dekl = { element: new Map(), typ: new Map(), grupp: new Map(), attribut: new Map() };
    this.kompilerade = new Map();
  }

  // Läser en schemafil och allt den importerar. vag är relativ till rotkatalogen.
  las(vag) {
    const full = resolve(this.rot, vag);
    if (full !== this.rot && !full.startsWith(this.rot + sep)) throw new SchemaFel(`Schemat ${vag} ligger utanför katalogen med scheman.`);
    if (this.filer.has(full)) return this;
    const dok = tolka(readFileSync(full, 'utf8'), { byte: 8 * 1024 * 1024 });
    if (dok.ns !== XS || dok.lokal !== 'schema') throw new SchemaFel(`${vag} är inte ett XML-schema.`);
    const tns = dok.attr.find(a => a.lokal === 'targetNamespace')?.varde ?? '';
    const info = { full, tns, elementForm: attr(dok, 'elementFormDefault') ?? 'unqualified', attributForm: attr(dok, 'attributeFormDefault') ?? 'unqualified' };
    this.filer.set(full, info);
    for (const b of dok.barn) {
      if (b.ns !== XS) continue;
      const namn = attr(b, 'name');
      if (b.lokal === 'import' || b.lokal === 'include') {
        const plats = attr(b, 'schemaLocation');
        if (!plats) throw new SchemaFel(`${vag}: xs:${b.lokal} utan schemaLocation kan inte följas.`);
        if (/^[a-z]+:/i.test(plats)) throw new SchemaFel(`${vag}: schemat pekar på ${plats}. Bara lokala filer läses.`);
        this.las(resolve(dirname(full), plats));
        if (b.lokal === 'include') {
          // En inkluderad fil utan targetNamespace får den inkluderande filens namnrymd. Det används inte i RIVTA.
          const inf = this.filer.get(resolve(dirname(full), plats));
          if (inf.tns !== tns) throw new SchemaFel(`${vag}: xs:include av ett schema med en annan namnrymd tas inte med.`);
        }
        continue;
      }
      if (SKIP.has(b.lokal)) continue;
      const m = { element: 'element', complexType: 'typ', simpleType: 'typ', group: 'grupp', attribute: 'attribut' }[b.lokal];
      if (!m) throw new SchemaFel(`${vag}: xs:${b.lokal} på översta nivån tas inte med i valideringen.`);
      if (!namn) throw new SchemaFel(`${vag}: xs:${b.lokal} saknar namn.`);
      this.dekl[m].set(nyckel(tns, namn), { nod: b, info });
    }
    return this;
  }

  // QName i ett schemaattribut (type, ref, base) som { ns, lokal }.
  qname(nod, varde) {
    const i = varde.indexOf(':');
    const p = i < 0 ? '' : varde.slice(0, i);
    const lokal = i < 0 ? varde : varde.slice(i + 1);
    if (p && !Object.hasOwn(nod.prefixer, p)) throw new SchemaFel(`Prefixet ${p} i ${varde} är inte deklarerat i schemat.`);
    return { ns: p ? nod.prefixer[p] : (nod.prefixer[''] ?? ''), lokal };
  }

  // Den kompilerade typen för ett namn.
  typ(ns, lokal) {
    const k = nyckel(ns, lokal);
    if (ns === XS) {
      if (lokal === 'anyType') return { art: 'komplex', innehall: null, allt: true, attribut: [], anyAttribute: { namespace: '##any', process: 'skip' } };
      if (!INBYGGDA[lokal]) throw new SchemaFel(`Den inbyggda typen xs:${lokal} tas inte med i valideringen.`);
      return { art: 'enkel', namn: `xs:${lokal}`, inbyggd: lokal, vit: INBYGGDA[lokal].vit, kontroller: [] };
    }
    if (this.kompilerade.has(k)) return this.kompilerade.get(k);
    const d = this.dekl.typ.get(k);
    if (!d) throw new SchemaFel(`Typen ${lokal} i ${ns || 'utan namnrymd'} finns inte i de lästa schemana.`);
    // Platshållaren gör att en typ som refererar till sig själv (genom ett element) kan kompileras.
    const t = { namn: lokal, ns };
    this.kompilerade.set(k, t);
    Object.assign(t, d.nod.lokal === 'simpleType' ? this.enkelTyp(d.nod, d.info) : this.komplexTyp(d.nod, d.info));
    return t;
  }

  enkelTyp(nod, info) {
    const delar = nod.barn.filter(b => b.ns === XS && !SKIP.has(b.lokal));
    if (delar.length !== 1) throw new SchemaFel(`En enkel typ ska ha en begränsning, en union eller en lista (${attr(nod, 'name') ?? 'anonym'}).`);
    const d = delar[0];
    if (d.lokal === 'restriction') {
      const basNamn = attr(d, 'base');
      const inre = d.barn.find(b => b.ns === XS && b.lokal === 'simpleType');
      const bas = basNamn ? this.typ(...Object.values(this.qname(d, basNamn))) : inre ? { art: 'enkel', ...this.enkelTyp(inre, info) } : null;
      if (!bas || bas.art !== 'enkel') throw new SchemaFel('En restriction av en enkel typ ska ha en enkel bastyp.');
      const kontroller = [];
      const enumvarden = [];
      const monsterLista = [];
      let vit = bas.vit;
      for (const f of d.barn) {
        if (f.ns !== XS || SKIP.has(f.lokal) || f.lokal === 'simpleType') continue;
        const v = attr(f, 'value');
        switch (f.lokal) {
          case 'enumeration': enumvarden.push(v); break;
          case 'pattern': monsterLista.push(monster(v)); break;
          case 'length': kontroller.push({ fel: `ska ha exakt ${v} tecken`, ok: (x) => [...x].length === Number(v) }); break;
          case 'minLength': kontroller.push({ fel: `ska ha minst ${v} tecken`, ok: (x) => [...x].length >= Number(v) }); break;
          case 'maxLength': kontroller.push({ fel: `får ha högst ${v} tecken`, ok: (x) => [...x].length <= Number(v) }); break;
          case 'minInclusive': kontroller.push({ fel: `ska vara minst ${v}`, ok: (x) => jamfor(x, v) >= 0 }); break;
          case 'maxInclusive': kontroller.push({ fel: `får vara högst ${v}`, ok: (x) => jamfor(x, v) <= 0 }); break;
          case 'minExclusive': kontroller.push({ fel: `ska vara större än ${v}`, ok: (x) => jamfor(x, v) > 0 }); break;
          case 'maxExclusive': kontroller.push({ fel: `ska vara mindre än ${v}`, ok: (x) => jamfor(x, v) < 0 }); break;
          case 'totalDigits': kontroller.push({ fel: `får ha högst ${v} siffror`, ok: (x) => x.replace(/^[+-]/, '').replace('.', '').replace(/^0+(?=\d)/, '').length <= Number(v) }); break;
          case 'fractionDigits': kontroller.push({ fel: `får ha högst ${v} decimaler`, ok: (x) => (x.split('.')[1] ?? '').replace(/0+$/, '').length <= Number(v) }); break;
          case 'whiteSpace': vit = v; break;
          default: throw new SchemaFel(`Fasetten xs:${f.lokal} tas inte med i valideringen.`);
        }
      }
      if (enumvarden.length) kontroller.push({ fel: `ska vara ett av ${enumvarden.slice(0, 12).join(', ')}${enumvarden.length > 12 ? ' med flera' : ''}`, ok: (x) => enumvarden.includes(x) });
      // Flera mönster i samma steg räcker att ett stämmer; mönster i olika steg ska alla stämma.
      if (monsterLista.length) kontroller.push({ fel: 'följer inte typens mönster', ok: (x) => monsterLista.some(r => r.test(x)) });
      return { art: 'enkel', bas, inbyggd: bas.inbyggd, vit, kontroller, enum: enumvarden.length ? enumvarden : null };
    }
    if (d.lokal === 'union') {
      const medlemmar = (attr(d, 'memberTypes') ?? '').split(/\s+/).filter(Boolean).map(q => this.typ(...Object.values(this.qname(d, q))));
      for (const inre of d.barn.filter(b => b.ns === XS && b.lokal === 'simpleType')) medlemmar.push({ art: 'enkel', ...this.enkelTyp(inre, info) });
      return { art: 'enkel', union: medlemmar, vit: 'collapse', kontroller: [] };
    }
    if (d.lokal === 'list') {
      const it = attr(d, 'itemType');
      const inre = d.barn.find(b => b.ns === XS && b.lokal === 'simpleType');
      return { art: 'enkel', lista: it ? this.typ(...Object.values(this.qname(d, it))) : { art: 'enkel', ...this.enkelTyp(inre, info) }, vit: 'collapse', kontroller: [] };
    }
    throw new SchemaFel(`xs:${d.lokal} i en simpleType tas inte med i valideringen.`);
  }

  komplexTyp(nod, info) {
    const t = { art: 'komplex', innehall: null, attribut: [], anyAttribute: null, blandat: attr(nod, 'mixed') === 'true', enkelt: null };
    if (attr(nod, 'abstract') === 'true') throw new SchemaFel('Abstrakta typer tas inte med i valideringen.');
    for (const b of nod.barn) {
      if (b.ns !== XS || SKIP.has(b.lokal)) continue;
      if (['sequence', 'choice', 'group'].includes(b.lokal)) t.innehall = this.partikel(b, info);
      else if (b.lokal === 'attribute') t.attribut.push(this.attributDekl(b, info));
      else if (b.lokal === 'anyAttribute') t.anyAttribute = { namespace: attr(b, 'namespace') ?? '##any', process: attr(b, 'processContents') ?? 'strict', tns: info.tns };
      else if (b.lokal === 'simpleContent' || b.lokal === 'complexContent') {
        const ext = b.barn.find(x => x.ns === XS && !SKIP.has(x.lokal));
        if (!ext || ext.lokal !== 'extension') throw new SchemaFel(`xs:${b.lokal} med ${ext ? `xs:${ext.lokal}` : 'inget innehåll'} tas inte med i valideringen, bara extension.`);
        const bas = this.typ(...Object.values(this.qname(ext, attr(ext, 'base'))));
        let egen = null;
        const egnaAttr = [];
        let egenAny = null;
        for (const x of ext.barn) {
          if (x.ns !== XS || SKIP.has(x.lokal)) continue;
          if (['sequence', 'choice', 'group'].includes(x.lokal)) egen = this.partikel(x, info);
          else if (x.lokal === 'attribute') egnaAttr.push(this.attributDekl(x, info));
          else if (x.lokal === 'anyAttribute') egenAny = { namespace: attr(x, 'namespace') ?? '##any', process: attr(x, 'processContents') ?? 'strict', tns: info.tns };
          else throw new SchemaFel(`xs:${x.lokal} i en extension tas inte med i valideringen.`);
        }
        if (b.lokal === 'simpleContent') {
          if (egen) throw new SchemaFel('En simpleContent kan inte ha element.');
          t.enkelt = bas.art === 'enkel' ? bas : bas.enkelt;
          if (!t.enkelt) throw new SchemaFel('En simpleContent ska bygga på en typ med enkelt innehåll.');
          t.attribut = [...(bas.attribut ?? []), ...egnaAttr];
        } else {
          if (bas.art !== 'komplex') throw new SchemaFel('En complexContent ska bygga på en komplex typ.');
          t.innehall = bas.innehall && egen ? { art: 'sekvens', delar: [bas.innehall, egen], min: 1, max: 1 } : (bas.innehall ?? egen);
          t.attribut = [...bas.attribut, ...egnaAttr];
          t.blandat = t.blandat || bas.blandat;
        }
        t.anyAttribute = egenAny ?? bas.anyAttribute ?? null;
      } else throw new SchemaFel(`xs:${b.lokal} i en complexType tas inte med i valideringen.`);
    }
    return t;
  }

  attributDekl(b, info) {
    if (attr(b, 'ref')) throw new SchemaFel('Attribut med ref tas inte med i valideringen.');
    const namn = attr(b, 'name');
    const typNamn = attr(b, 'type');
    const inre = b.barn.find(x => x.ns === XS && x.lokal === 'simpleType');
    const typ = typNamn ? this.typ(...Object.values(this.qname(b, typNamn))) : inre ? { art: 'enkel', ...this.enkelTyp(inre, info) } : this.typ(XS, 'anySimpleType');
    const form = attr(b, 'form') ?? info.attributForm;
    return { ns: form === 'qualified' ? info.tns : '', lokal: namn, typ, kravs: attr(b, 'use') === 'required', fixed: attr(b, 'fixed') };
  }

  partikel(b, info) {
    const min = intAttr(attr(b, 'minOccurs'), 1);
    const max = intAttr(attr(b, 'maxOccurs'), 1);
    if (b.lokal === 'sequence' || b.lokal === 'choice') {
      const delar = b.barn.filter(x => x.ns === XS && !SKIP.has(x.lokal)).map(x => this.partikel(x, info));
      return { art: b.lokal === 'sequence' ? 'sekvens' : 'val', delar, min, max };
    }
    if (b.lokal === 'group') {
      const ref = attr(b, 'ref');
      if (!ref) throw new SchemaFel('En grupp i en innehållsmodell ska ha ref.');
      const q = this.qname(b, ref);
      const d = this.dekl.grupp.get(nyckel(q.ns, q.lokal));
      if (!d) throw new SchemaFel(`Gruppen ${ref} finns inte.`);
      const inre = d.nod.barn.find(x => x.ns === XS && !SKIP.has(x.lokal));
      return { art: 'sekvens', delar: [this.partikel(inre, d.info)], min, max };
    }
    if (b.lokal === 'any') {
      return { art: 'any', namespace: attr(b, 'namespace') ?? '##any', process: attr(b, 'processContents') ?? 'strict', tns: info.tns, min, max };
    }
    if (b.lokal === 'element') return { art: 'element', ...this.elementDekl(b, info, false), min, max };
    throw new SchemaFel(`xs:${b.lokal} i en innehållsmodell tas inte med i valideringen.`);
  }

  // En elementdeklaration: { ns, lokal, typ (kompileras vid behov), nillable }.
  elementDekl(b, info, global) {
    for (const a of ['substitutionGroup', 'abstract']) if (attr(b, a) && attr(b, a) !== 'false') throw new SchemaFel(`Elementattributet ${a} tas inte med i valideringen.`);
    const set = this;
    const ref = attr(b, 'ref');
    if (ref) {
      const q = this.qname(b, ref);
      const mal = () => {
        const g = set.globalt(q.ns, q.lokal);
        if (!g) throw new SchemaFel(`Elementet ${ref} som det refereras till finns inte.`);
        return g;
      };
      return { ref: true, ns: q.ns, lokal: q.lokal, get typ() { return mal().typ; }, get nillable() { return mal().nillable; }, get fixed() { return mal().fixed; } };
    }
    const namn = attr(b, 'name');
    const form = attr(b, 'form') ?? info.elementForm;
    const ns = global || form === 'qualified' ? info.tns : '';
    const typNamn = attr(b, 'type');
    const inre = b.barn.find(x => x.ns === XS && (x.lokal === 'complexType' || x.lokal === 'simpleType'));
    let typ = null;
    const dekl = {
      ns, lokal: namn, nillable: attr(b, 'nillable') === 'true', fixed: attr(b, 'fixed'),
      get typ() {
        if (!typ) {
          if (typNamn) typ = set.typ(...Object.values(set.qname(b, typNamn)));
          else if (inre) typ = inre.lokal === 'complexType' ? { namn: `${namn} (anonym)`, ...set.komplexTyp(inre, info) } : { art: 'enkel', namn: `${namn} (anonym)`, ...set.enkelTyp(inre, info) };
          else typ = set.typ(XS, 'anyType');
        }
        return typ;
      },
    };
    return dekl;
  }

  // Den globala deklarationen för ett element, eller null.
  globalt(ns, lokal) {
    const k = nyckel(ns, lokal);
    const c = this.kompilerade.get(`element ${k}`);
    if (c) return c;
    const d = this.dekl.element.get(k);
    if (!d) return null;
    const dekl = this.elementDekl(d.nod, d.info, true);
    this.kompilerade.set(`element ${k}`, dekl);
    return dekl;
  }

  // Kompilerar allt som har lästs, så att ett schema som inte tas med ger fel direkt och inte först vid ett anrop.
  kompileraAllt() {
    for (const [k, d] of this.dekl.typ) { const [ns, lokal] = k.split('|'); this.typ(ns, lokal); void d; }
    for (const k of this.dekl.element.keys()) {
      const [ns, lokal] = k.split('|');
      const dekl = this.globalt(ns, lokal);
      void dekl.typ;
    }
    for (const t of this.kompilerade.values()) if (t.art === 'komplex') genomgaPartiklar(t.innehall, (p) => { if (p.art === 'element') void p.typ; });
    return this;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Validering. Ger en lista med fel på svenska, tom om meddelandet följer schemat.
  validera(nod) {
    const fel = [];
    const dekl = this.globalt(nod.ns, nod.lokal);
    if (!dekl) return [`Elementet ${nod.lokal} i namnrymden ${nod.ns || '(ingen)'} är inte deklarerat i tjänstekontraktets schema.`];
    this.valideraEl(nod, dekl, `/${nod.lokal}`, fel);
    return fel.slice(0, 50);
  }

  valideraEl(nod, dekl, vag, fel) {
    if (fel.length > 50) return;
    const nil = nod.attr.find(a => a.ns === XSI && a.lokal === 'nil')?.varde;
    if (nil === 'true' || nil === '1') {
      if (!dekl.nillable) fel.push(`${vag}: elementet får inte vara xsi:nil.`);
      else if (nod.barn.length || harText(nod)) fel.push(`${vag}: ett element med xsi:nil ska vara tomt.`);
      return;
    }
    if (nod.attr.some(a => a.ns === XSI && a.lokal === 'type')) { fel.push(`${vag}: xsi:type tas inte emot.`); return; }
    const typ = dekl.typ;
    if (typ.art === 'enkel') {
      for (const a of nod.attr) if (a.ns !== XSI) fel.push(`${vag}: attributet ${a.lokal} är inte tillåtet här.`);
      if (nod.barn.length) { fel.push(`${vag}: elementet ska bara ha text, inga element.`); return; }
      const f = provaEnkel(typ, nod.text, nod);
      if (f) fel.push(`${vag}: värdet ${kort(nod.text)} ${f}.`);
      if (dekl.fixed != null && blanka(nod.text, typ.vit ?? 'preserve') !== dekl.fixed) fel.push(`${vag}: värdet ska vara ${dekl.fixed}.`);
      return;
    }
    this.valideraAttribut(nod, typ, vag, fel);
    if (typ.allt) return;
    if (typ.enkelt) {
      if (nod.barn.length) { fel.push(`${vag}: elementet ska bara ha text, inga element.`); return; }
      const f = provaEnkel(typ.enkelt, nod.text, nod);
      if (f) fel.push(`${vag}: värdet ${kort(nod.text)} ${f}.`);
      return;
    }
    if (!typ.blandat && harText(nod)) fel.push(`${vag}: elementet får inte ha text, bara element.`);
    const barn = nod.barn;
    if (!typ.innehall) {
      if (barn.length) fel.push(`${vag}: elementet ska vara tomt, men har ${barn[0].lokal}.`);
      return;
    }
    const langst = { pos: 0 };
    const slut = matcha(typ.innehall, barn, new Set([0]), langst);
    if (!slut.has(barn.length)) {
      if (langst.pos < barn.length) fel.push(`${vag}: elementet ${barn[langst.pos].lokal} är inte tillåtet här${langst.pos ? ` efter ${barn[langst.pos - 1].lokal}` : ''}, eller så saknas ett obligatoriskt element före det.`);
      else fel.push(`${vag}: ett obligatoriskt element saknas${barn.length ? ` efter ${barn.at(-1).lokal}` : ''}.`);
      return;
    }
    const lokala = elementIModell(typ.innehall);
    const raknare = new Map();
    for (const b of barn) {
      const k = nyckel(b.ns, b.lokal);
      const n = (raknare.get(k) ?? 0) + 1;
      raknare.set(k, n);
      const bvag = `${vag}/${b.lokal}${n > 1 ? `[${n}]` : ''}`;
      const d = lokala.get(k);
      if (d) { this.valideraEl(b, d, bvag, fel); continue; }
      const w = wildcardFor(typ.innehall, b.ns);
      if (!w || w.process === 'skip') continue;
      const g = this.globalt(b.ns, b.lokal);
      if (g) this.valideraEl(b, g, bvag, fel);
      else if (w.process === 'strict') fel.push(`${bvag}: elementet är inte deklarerat.`);
    }
  }

  valideraAttribut(nod, typ, vag, fel) {
    const sedda = new Set();
    for (const a of nod.attr) {
      if (a.ns === XSI) continue;
      const d = typ.attribut.find(x => x.lokal === a.lokal && x.ns === a.ns);
      if (d) {
        sedda.add(d);
        const f = provaEnkel(d.typ, a.varde, nod);
        if (f) fel.push(`${vag}/@${a.lokal}: värdet ${kort(a.varde)} ${f}.`);
        if (d.fixed != null && a.varde !== d.fixed) fel.push(`${vag}/@${a.lokal}: värdet ska vara ${d.fixed}.`);
        continue;
      }
      if (typ.anyAttribute && tillaterNs(typ.anyAttribute, a.ns)) continue;
      fel.push(`${vag}: attributet ${a.lokal} är inte tillåtet här.`);
    }
    for (const d of typ.attribut) if (d.kravs && !sedda.has(d)) fel.push(`${vag}: attributet ${d.lokal} saknas.`);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Bygger ett element ur ett objekt. Nycklarna är elementens lokala namn, en lista för element som får förekomma flera
  // gånger, '@namn' för attribut och '$' för texten i ett element med enkelt innehåll och attribut.
  bygg(ns, lokal, varde) {
    const dekl = this.globalt(ns, lokal);
    if (!dekl) throw new SchemaFel(`Elementet ${lokal} finns inte i schemat.`);
    return this.byggEl(dekl, varde, lokal);
  }

  byggEl(dekl, varde, vag) {
    const typ = dekl.typ;
    if (typ.art === 'enkel') return nyttEl(dekl.ns, dekl.lokal, text(varde, vag));
    const attr = [];
    const objekt = varde && typeof varde === 'object' && !Array.isArray(varde) ? varde : null;
    if (typ.enkelt) {
      const e = nyttEl(dekl.ns, dekl.lokal, text(objekt ? objekt.$ : varde, vag));
      if (objekt) e.attr = byggAttr(typ, objekt, vag);
      return e;
    }
    if (!objekt) throw new SchemaFel(`${vag}: ett objekt behövs för ett element med innehåll.`);
    const anvanda = new Set(['$any']);
    const barn = [];
    const ga = (p) => {
      if (!p) return;
      if (p.art === 'sekvens' || p.art === 'val') { p.delar.forEach(ga); return; }
      if (p.art === 'any') { if (Array.isArray(objekt.$any)) barn.push(...objekt.$any); return; }
      anvanda.add(p.lokal);
      const v = objekt[p.lokal];
      if (v == null) return;
      const lista = Array.isArray(v) ? v : [v];
      if (lista.length > 1 && p.max <= 1) throw new SchemaFel(`${vag}/${p.lokal}: får bara förekomma en gång.`);
      for (const x of lista) if (x != null) barn.push(this.byggEl(p, x, `${vag}/${p.lokal}`));
    };
    ga(typ.innehall);
    for (const k of Object.keys(objekt)) if (!anvanda.has(k) && !k.startsWith('@')) throw new SchemaFel(`${vag}: fältet ${k} finns inte i schemat.`);
    const e = nyttEl(dekl.ns, dekl.lokal, barn);
    e.attr = byggAttr(typ, objekt, vag);
    void attr;
    return e;
  }

  // Läser ut ett element som ett objekt, med samma form som bygg tar. Element som får förekomma flera gånger blir listor,
  // xs:boolean blir true eller false och övriga enkla värden text.
  lasUt(nod) {
    const dekl = this.globalt(nod.ns, nod.lokal);
    if (!dekl) throw new SchemaFel(`Elementet ${nod.lokal} finns inte i schemat.`);
    return this.lasEl(nod, dekl);
  }

  lasEl(nod, dekl) {
    const typ = dekl.typ;
    if (typ.art === 'enkel') return varde(typ, nod.text);
    if (typ.enkelt) {
      const v = varde(typ.enkelt, nod.text);
      return nod.attr.length ? { $: v, ...Object.fromEntries(nod.attr.filter(a => a.ns !== XSI).map(a => [`@${a.lokal}`, a.varde])) } : v;
    }
    const ut = {};
    for (const a of nod.attr) if (a.ns !== XSI) ut[`@${a.lokal}`] = a.varde;
    const lokala = elementIModell(typ.innehall);
    for (const b of nod.barn) {
      const d = lokala.get(nyckel(b.ns, b.lokal));
      if (!d) { (ut.$any ??= []).push(b); continue; }
      const v = this.lasEl(b, d);
      if (d.max > 1) (ut[b.lokal] ??= []).push(v);
      else ut[b.lokal] = v;
    }
    return ut;
  }
}

function byggAttr(typ, objekt, vag) {
  const ut = [];
  for (const [k, v] of Object.entries(objekt)) {
    if (!k.startsWith('@') || v == null) continue;
    const d = (typ.attribut ?? []).find(x => x.lokal === k.slice(1));
    if (!d) throw new SchemaFel(`${vag}: attributet ${k.slice(1)} finns inte i schemat.`);
    ut.push({ ns: d.ns, lokal: d.lokal, varde: text(v, vag) });
  }
  return ut;
}

function text(v, vag) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new SchemaFel(`${vag}: talet är inte ändligt.`); return String(v); }
  if (typeof v === 'string') return v;
  throw new SchemaFel(`${vag}: ett enkelt värde ska vara text, tal eller sant eller falskt.`);
}

function varde(typ, rått) {
  let t = typ;
  while (t && !t.inbyggd && t.bas) t = t.bas;
  const inb = typ.inbyggd ?? t?.inbyggd;
  const v = blanka(rått, typ.vit ?? 'preserve');
  if (inb === 'boolean') return v === 'true' || v === '1';
  return v;
}

const attr = (nod, lokal) => nod.attr.find(a => a.lokal === lokal && a.ns === '')?.varde ?? null;
const kort = (v) => { const s = String(v).trim(); return `"${s.length > 40 ? `${s.slice(0, 40)}` : s}"`; };

function jamfor(a, b) {
  const x = Number(a), y = Number(b);
  if (Number.isFinite(x) && Number.isFinite(y) && /^[+-]?[\d.]+$/.test(a) && /^[+-]?[\d.]+$/.test(b)) return x - y;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Prövar ett enkelt värde mot typen, med bastyperna först. Ger en felbeskrivning eller null.
function provaEnkel(typ, ratt, nod) {
  const v = blanka(ratt, typ.vit ?? 'preserve');
  if (typ.union) return typ.union.some(m => !provaEnkel(m, ratt, nod)) ? null : 'passar inte någon av typerna i unionen';
  if (typ.lista) {
    for (const del of v.split(' ').filter(Boolean)) { const f = provaEnkel(typ.lista, del, nod); if (f) return f; }
    return null;
  }
  if (typ.bas) { const f = provaEnkel(typ.bas, v, nod); if (f) return f; }
  else if (typ.inbyggd) {
    const b = INBYGGDA[typ.inbyggd];
    const f = b.prova(v);
    if (f) return f;
    if (b.qname && v.includes(':') && !Object.hasOwn(nod.prefixer, v.split(':')[0])) return 'har ett prefix som inte är deklarerat';
  }
  for (const k of typ.kontroller ?? []) if (!k.ok(v)) return k.fel;
  return null;
}

function tillaterNs(w, ns) {
  const n = w.namespace;
  if (n === '##any') return true;
  if (n === '##other') return ns !== '' && ns !== w.tns;
  return n.split(/\s+/).some(x => (x === '##targetNamespace' ? ns === w.tns : x === '##local' ? ns === '' : x === ns));
}

function genomgaPartiklar(p, f) {
  if (!p) return;
  f(p);
  if (p.delar) p.delar.forEach(d => genomgaPartiklar(d, f));
}

const modellCache = new WeakMap();
function elementIModell(p) {
  if (!p) return new Map();
  if (modellCache.has(p)) return modellCache.get(p);
  const m = new Map();
  genomgaPartiklar(p, (x) => { if (x.art === 'element' && !m.has(nyckel(x.ns, x.lokal))) m.set(nyckel(x.ns, x.lokal), x); });
  modellCache.set(p, m);
  return m;
}
function wildcardFor(p, ns) {
  let w = null;
  genomgaPartiklar(p, (x) => { if (!w && x.art === 'any' && tillaterNs(x, ns)) w = x; });
  return w;
}

// Matchar en partikel med dess förekomster mot barnen från en mängd startpositioner. Ger mängden slutpositioner.
// Mängder av positioner gör matchningen korrekt även när en modell inte är deterministisk, utan att gå exponentiellt.
function matcha(p, barn, start, langst) {
  const res = new Set();
  if (p.min === 0) for (const s of start) res.add(s);
  let front = new Set(start);
  const sedda = new Set(start);
  for (let n = 1; front.size && n <= Math.min(p.max, barn.length + 1); n++) {
    const nasta = matchaEn(p, barn, front, langst);
    if (n >= p.min) for (const x of nasta) res.add(x);
    if (n < p.min) front = nasta;
    else { front = new Set([...nasta].filter(x => !sedda.has(x))); for (const x of nasta) sedda.add(x); }
  }
  return res;
}
function matchaEn(p, barn, front, langst) {
  const ut = new Set();
  if (p.art === 'element' || p.art === 'any') {
    for (const pos of front) {
      if (pos > langst.pos) langst.pos = pos;
      const b = barn[pos];
      if (!b) continue;
      if (p.art === 'element' ? b.ns === p.ns && b.lokal === p.lokal : tillaterNs(p, b.ns)) { ut.add(pos + 1); if (pos + 1 > langst.pos) langst.pos = pos + 1; }
    }
    return ut;
  }
  if (p.art === 'sekvens') {
    let s = front;
    for (const d of p.delar) { s = matcha(d, barn, s, langst); if (!s.size) break; }
    return s;
  }
  for (const d of p.delar) for (const x of matcha(d, barn, front, langst)) ut.add(x);
  return ut;
}

// Läser ett schema med allt det importerar och kompilerar det. Cachas per fil.
const cache = new Map();
export function schema(rot, ...vagar) {
  const k = `${resolve(rot)}|${vagar.join('|')}`;
  if (!cache.has(k)) {
    const s = new Schemaset(rot);
    for (const v of vagar) s.las(v);
    cache.set(k, s.kompileraAllt());
  }
  return cache.get(k);
}
