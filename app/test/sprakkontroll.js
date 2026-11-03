// Språkkontrollen av gränssnittet (test/sprak.test.js): plockar ut de texter som visas för användaren ur public/ och
// serverns felmeddelanden och varningar i src/, och prövar dem mot reglerna i docs/design.md: svenska, inga engelska
// ord utom tillåtna lånord och egennamn, inga tankstreck eller ellipser, korrekt å, ä och ö och inga interna
// anteckningar.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PLATS = '\u0001';

// Delar upp JavaScript i strängar och mallsträngar. Varje sträng får koden närmast före sig, så att reglerna kan se om
// den är en kod i FHIR, en SQL-fråga eller en text. En mallsträngs fasta delar sätts ihop med en platshållare där
// uttrycken stod, så att HTML som delas av ett uttryck hålls ihop.
export function strangar(kod) {
  const ut = [];
  let i = 0;
  let senast = '';
  const ramar = []; // en ram per öppen mallsträng: { delar, djup }
  const lagg = (text, fore, rad) => ut.push({ text, fore, rad });
  const radFor = (pos) => kod.slice(0, pos).split('\n').length;
  const kanRegex = () => /(^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase|\bof|\bin)\s*$/.test(kod.slice(Math.max(0, i - 12), i));
  while (i < kod.length) {
    const c = kod[i];
    const n = kod[i + 1];
    if (c === '/' && n === '/') { i = kod.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = kod.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (c === '/' && kanRegex()) {
      i++;
      let klass = false;
      while (i < kod.length && (kod[i] !== '/' || klass)) {
        if (kod[i] === '\\') i++;
        else if (kod[i] === '[') klass = true;
        else if (kod[i] === ']') klass = false;
        else if (kod[i] === '\n') break;
        i++;
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const start = i;
      let s = '';
      i++;
      while (i < kod.length && kod[i] !== c) {
        if (kod[i] === '\\') { s += avkoda(kod[i + 1]); i += 2; continue; }
        s += kod[i++];
      }
      i++;
      lagg(s, kod.slice(Math.max(0, start - 40), start), radFor(start));
      continue;
    }
    if (c === '`' || (c === '}' && ramar.length && ramar.at(-1).djup === 0)) {
      // Början på en mallsträng, eller fortsättningen efter ett uttryck.
      let ram;
      if (c === '`') { ram = { delar: [''], djup: 0, start: i, fore: kod.slice(Math.max(0, i - 40), i) }; ramar.push(ram); } else { ram = ramar.at(-1); ram.delar.push(''); }
      i++;
      let klar = false;
      while (i < kod.length) {
        if (kod[i] === '\\') { ram.delar[ram.delar.length - 1] += avkoda(kod[i + 1]); i += 2; continue; }
        if (kod[i] === '`') { i++; klar = true; break; }
        if (kod[i] === '$' && kod[i + 1] === '{') { i += 2; break; }
        ram.delar[ram.delar.length - 1] += kod[i++];
      }
      if (klar) { ramar.pop(); lagg(ram.delar.join(PLATS), ram.fore, radFor(ram.start)); }
      continue;
    }
    if (ramar.length) {
      if (c === '{') ramar.at(-1).djup++;
      else if (c === '}') ramar.at(-1).djup--;
    }
    if (!/\s/.test(c)) senast = c;
    i++;
  }
  void senast;
  return ut;
}
const avkoda = (c) => ({ n: '\n', t: '\t', u: '' }[c] ?? c);

// Synlig text ur HTML: textnoderna och de attribut som visas eller läses upp (title, aria-label, placeholder, alt).
const SYNLIGA_ATTRIBUT = /\b(?:title|aria-label|aria-description|placeholder|alt|data-tips)\s*=\s*"([^"]*)"/g;
export function synligHtml(html) {
  const attr = [];
  let text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<\/?[a-zA-Z][^>]*>?/g, (tagg) => { for (const m of tagg.matchAll(SYNLIGA_ATTRIBUT)) attr.push(m[1]); return ' '; });
  return [text, ...attr].map(t => t.replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' '));
}

// Om en sträng ur koden är en text som visas. Identifierare, sökvägar, väljare, klassnamn, loggnycklar, HTTP-rubriker,
// CSP och SQL är det inte.
const SQL = /\b(SELECT|INSERT|UPDATE|DELETE FROM|CREATE|PRAGMA|ALTER|DROP)\b|\bIS (NOT )?NULL\b| AND | OR |^(AND|OR) |\bIN \(|\w+ = '\w+'|\w+ = \?|<> \?|\b(NEW|OLD)\.|NOT NULL|\bINTEGER\b/;
// Ett ord i koden: snake_case, kebab-case med gemener, camelCase, nyckel:värde, var(--x), &entitet;, en sökväg, ett id med
// versaler och bindestreck (VK-ADM-) eller en del av en nyckel med lodstreck.
const KODTOKEN = /^[a-z0-9]+(?:[_|][\w|]*)+$|^(?!e-)[a-z0-9]+(?:-[a-z0-9]+)+,?$|^[a-z]+[A-Z][A-Za-z]*,?$|^[\wåäö.-]*:[^\s/]|--|^&\w+;$|^[\w.]+\(|^[/#.[]|=|^'(self|none|unsafe-inline)'|\||^[A-Z0-9]+(-[A-Z0-9]*)+$/;
export function arText(s) {
  const t = s.replace(new RegExp(PLATS, 'g'), ' ').trim();
  if (!/[A-Za-zÅÄÖåäöÉé]{2}/.test(t)) return false;
  if (SQL.test(t) || t.startsWith('<?xml')) return false;
  if (/^(https?:|\/|#\/|\.\/|\.\.\/|data:|mailto:|urn:)/.test(t)) return false;
  // Loggens och händelsernas nycklar börjar med ett kodord och kolon (sok:p01, kontrasignering:forslag:1).
  if (/^[a-zåäö]+:(?! )/.test(s.trim())) return false;
  // Ett enda ord med gemener, bindestreck eller understreck är ett id, en klass eller en kod, och ett enda ord med bara
  // versaler en konstant (POST, ORAL).
  if (/^[a-zåäö0-9_\-.:/]+$/.test(t) || /^[A-Z0-9_]+$/.test(t)) return false;
  // Väljare, klasslistor, kolumnlistor och nycklar: varje ord är kod, eller texten saknar både versal och skiljetecken
  // och har minst ett kodord.
  const tokens = t.split(/\s+/).filter(w => /[A-Za-zÅÄÖåäö]/.test(w));
  const kod = tokens.filter(w => KODTOKEN.test(w));
  if (kod.length === tokens.length) return false;
  if (kod.length && tokens.length - kod.length < 3 && !/[A-ZÅÄÖ]/.test(t) && !/[.!?]$/.test(t)) return false;
  if (/^[a-z]+(, [a-z]+)+$/.test(t)) return false;
  // En lista med CSS-väljare: a[href], button, [role="tab"].
  if (/^[\w-]*(\[[^\]]*\])*(\s*,\s*[\w-]*(\[[^\]]*\])*)+$/.test(t)) return false;
  return true;
}

// Ord i en text. Ord med siffror (U-XXXXXXXX, 7.0.3, p01), kodord (kraver_val, sok:p01), ord inom citattecken (kodvärden,
// till exempel "hembesok") och ord som är en del av en adress eller ett filnamn räknas inte. Tillåtna fraser med flera
// ord tas bort först.
export function ord(text) {
  let rent = text.replace(new RegExp(PLATS, 'g'), ' ').replace(/"[^"\n]{1,40}"|”[^”\n]{1,40}”/g, ' ');
  for (const f of FRASER) rent = rent.split(f).join(' ');
  rent = rent.split(/\s+/).filter(w => !/https?:\/\/|www\.|\.(?:js|json|html|css|md|pdf|csv|zip|svg|txt|ndjson)\b|@|_|^\$|^[\wåäö]+:[^\s]/.test(w)).join(' ');
  return rent.split(/[^A-Za-zÅÄÖåäöÉéÜü0-9\-]+/).filter(w => w && /[A-Za-zÅÄÖåäö]/.test(w) && !/\d/.test(w))
    .flatMap(w => (TILLATNA.has(w.replace(/^-+|-+$/g, '')) ? [w.replace(/^-+|-+$/g, '')] : w.split('-'))).filter(w => w.length > 1);
}

// Vanliga engelska ord som inte också är svenska ord. Svenska ord med samma stavning (in, under, start, status, data,
// demo, test, plan, form, version, risk, problem, filter) står inte här.
export const ENGELSKA = new Set(`
the and of to with for is are was were been being this that these those not you your we our they them it its from by at on an or
if then else when where which who whom what how why any some can cannot will would should could must may might has have had do
does did done yes please thanks thank here there click tap press back next previous close open search sort show hide view page
home menu settings help about contact new add create update updated delete deleted remove removed edit save saved cancel
cancelled canceled submit send login logout logged sign signed signin signout user users username password error errors warning
warnings failed fail failure success successful loading loaded load saving retry again try wait waiting offline online network
connection timeout undefined null nan true false object function invalid required missing unknown found access denied forbidden
unauthorized allowed role admin staff doctor nurse appointment schedule booking booked slot free busy arrived finished inactive
draft pending ready today yesterday tomorrow week month year day days hour hours minute minutes name date time select choose
enter type file upload download print message notification request response list item items value values none other more less
first last only also very still yet already now never always each every both either neither such own same than too into over out
up down off dashboard patients record records note notes report reports health care medication medications order orders lab
result results endpoint endpoints usability saturation
`.trim().split(/\s+/));

// Lånord, förkortningar och egennamn som får stå i svensk text. Förkortningar med versaler och ord med w måste stå här,
// så att en ny förkortning eller ett nytt engelskt ord prövas en gång.
export const TILLATNA = new Set(`
FHIR SITHS NPÖ ATC HSA HSA-id NLL NPL NPU PDL ICD ICD-10-SE LOINC UCUM HL7 R4 JSON PDF CSV ZIP URL API API:t SMS QR ID PIN PEF INR
eGFR EKG CRP Hb NT-proBNP KOL BMI SpO2 MEWS NEWS NEWS2 RETTS SFINX AT ASA EUPL GitHub Bun SQLite SPA CSP HTTP HTTPS TLS OK
Skatteverket Socialstyrelsen Läkemedelsverket Inera E-hälsomyndigheten Konkurrensverket Sussa Cosmic Vårdkällan Region Örebro län
Windows Linux macOS Android iOS Chrome Firefox Safari Edge PWA SUS IT SV SE EU OID UTF-8 XML HTML CSS JS NDJSON
Patient Encounter EpisodeOfCare Condition Observation MedicationRequest MedicationAdministration List AllergyIntolerance Flag
ServiceRequest Composition Organization Practitioner AuditEvent CapabilityStatement Bundle OperationOutcome Schedule Slot Appointment
StructureDefinition CodeSystem ValueSet
Enter Tab Escape Backspace Delete Home End PageUp PageDown Insert ArrowLeft ArrowRight ArrowUp ArrowDown Shift Control Alt AltGraph
Meta CapsLock Fn Dead Process Unidentified Compose
AES GCM AES-GCM HSLF FS HSLF-FS OSL VAS CE MDR EHDS GDPR DPIA METS FGS RIVTA SIP CSIP PREMIS ARK WHO IFCC KVÅ PK PCI NSAID MRSA
CT USÖ SVT LMA FVIS JMIR VK DELETE CHECK ÅÅÅÅ MM DD NNNN ÅÅÅÅMMDD VKÅÅÅÅMMDD XXXXXXXX
workern workerns Playwright Webcert Thomas Wall Wennberg Waran Warfarin Eliquis Brilique webb
LPT LRV SPU HSL SoL IVO CarePlan GCS NRS ACVPU CKD-EPI warfarin
PNG JPEG iCalendar
`.trim().split(/\s+/));
// Fraser med engelska ord som är namn på standarder, rubriker, parametrar och tekniska begrepp. Ett tomt värde i data
// beskrivs som tomt, inte som null (beslut 2026-11-03).
export const FRASER = ['HL7 Sweden', '$everything', 'pull request', 'Server-Timing', 'X-Content-Type-Options', 'Content-Type', 'Content-Disposition',
  'FHIR Bulk Data Access', 'Bulk Data', 'Service worker', 'service worker', 'Service Worker', 'Sökparametern schedule',
  'System Usability Scale', 'GitHub Actions',
  // Runda 6, r1: källorna för NEWS2 och GCS och en titel i NEWS2 som citeras.
  'Royal College of Physicians', 'National Early Warning Score', 'Glasgow Coma Scale', 'specialist registrar'];

// Svenska ord som ofta skrivs utan å, ä eller ö. Formen utan prickar är inget eget ord.
export const UTAN_PRICKAR = new Map(Object.entries({
  pa: 'på', ar: 'är', nar: 'när', fran: 'från', nagon: 'någon', nagot: 'något', nagra: 'några', ocksa: 'också', maste: 'måste',
  lakare: 'läkare', lakemedel: 'läkemedel', sjukskoterska: 'sjuksköterska', vardenhet: 'vårdenhet', vardkontakt: 'vårdkontakt',
  atkomst: 'åtkomst', behorighet: 'behörighet', oppna: 'öppna', oppen: 'öppen', stang: 'stäng', hamta: 'hämta', andring: 'ändring',
  overkanslighet: 'överkänslighet', sok: 'sök', soka: 'söka', sokning: 'sökning', forslag: 'förslag', foreslar: 'föreslår', forsta: 'första',
  fore: 'före', ga: 'gå', gar: 'går', fa: 'få', ater: 'åter', aterstall: 'återställ', oversikt: 'översikt', vantelista: 'väntelista',
  vantar: 'väntar', ratt: 'rätt', over: 'över', mal: 'mål', manad: 'månad', vecka: null, tid: null, losenord: 'lösenord', bestall: 'beställ',
  sjukvard: 'sjukvård', vard: 'vård', varden: 'vården', anvandare: 'användare', anvand: 'använd', lagg: 'lägg', tillganglig: 'tillgänglig',
  forfattare: 'författare', for: 'för', hogst: 'högst', minst: null, overlamna: 'överlämna', ingar: 'ingår',
}).filter(([, v]) => v));

// Ord som är riktiga svenska ord både med och utan prickar. Den automatiska kontrollen hoppar över dem.
const BADA_GILTIGA = new Set(['andra', 'har', 'sa', 'var', 'man', 'fora', 'kar', 'tank', 'akut', 'alla', 'all', 'vara', 'gora', 'far',
  'lar', 'mot', 'dar', 'tva', 'ga', 'han', 'hon', 'ore', 'langd', 'lasa', 'las', 'satt', 'lat', 'kom', 'tar', 'ta', 'hor', 'bor', 'mat',
  'ror', 'tal', 'spar', 'ratt', 'del', 'del', 'rad', 'fyll', 'lan', 'na', 'gang', 'vag', 'sal', 'pas', 'tag', 'kort', 'ost', 'ser',
  'ska', 'sma', 'ar', 'aga', 'rakna', 'fran', 'tid', 'stall', 'galla', 'vagt', 'agda', 'vagen', 'lagre', 'fall', 'bar', 'kan', 'band',
  'stod', 'blad', 'trad', 'vant', 'vanta', 'atta', 'tog', 'gar', 'ange', 'anga', 'lage', 'lagt', 'lag', 'lak', 'form', 'fortsatt',
  'svar', 'val', 'natt', 'mats', 'saker', 'faller', 'ersatts', 'behovs', 'alder']);

// Interna anteckningar och råd till oss själva, som aldrig ska visas för användaren.
export const INTERN = /\b(TODO|FIXME|XXX|HACK)\b|\b([Tt]änk på att|[Kk]om ihåg att|[Ss]äg inte|[Gg]löm inte att|OBS! [Ii]ntern|[Ii]ntern anteckning)/;

const VIKA = (w) => w.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e');

// Prövar alla texter. Returnerar fel som { fil, rad, regel, ord, text }.
export function prova(texter) {
  const fel = [];
  const allaOrd = new Set();
  for (const t of texter) for (const w of ord(t.text)) allaOrd.add(w);
  // Ord med å, ä eller ö som också förekommer utan prickar på något ställe, till exempel Väntelista och Vantelista.
  const vikta = new Map();
  for (const w of allaOrd) if (/[åäöÅÄÖ]/.test(w)) vikta.set(VIKA(w), w);
  for (const t of texter) {
    const { text } = t;
    const ny = (regel, o) => fel.push({ ...t, regel, ord: o, text: text.replace(new RegExp(PLATS, 'g'), '…').slice(0, 160) });
    if (/[—–]/.test(text)) ny('tankstreck', text.match(/[—–]/)[0]);
    if (/…|\.\.\.(?!\w)/.test(text)) ny('ellips', '…');
    const intern = text.match(INTERN);
    if (intern) ny('intern anteckning', intern[0]);
    // Ett tomt värde beskrivs som tomt, också när null står inom citattecken som ett kodvärde (beslut 2026-11-03).
    if (/["”]null["”]/i.test(text)) ny('engelska', 'null');
    for (const w of ord(text)) {
      const lag = w.toLowerCase();
      if (TILLATNA.has(w)) continue;
      if (/^[A-ZÅÄÖ0-9]{2,}$/.test(w)) { ny('okänd förkortning', w); continue; }
      if (ENGELSKA.has(lag)) { ny('engelska', w); continue; }
      // Svenska ord har nästan aldrig w utom i webb och i namn, som får stå i listan ovan.
      if (/w/i.test(w) && !/^webb/i.test(w)) { ny('engelska', w); continue; }
      if (UTAN_PRICKAR.has(lag)) { ny('å, ä och ö', `${w} (${UTAN_PRICKAR.get(lag)})`); continue; }
      if (!/[åäö]/i.test(w) && vikta.has(lag) && !BADA_GILTIGA.has(lag)) ny('å, ä och ö', `${w} (${vikta.get(lag)})`);
    }
  }
  return fel;
}

const filer = (rot, filter) => readdirSync(rot).flatMap((f) => {
  const p = join(rot, f);
  return statSync(p).isDirectory() ? filer(p, filter) : filter(p) ? [p] : [];
});

// Texterna i gränssnittet: index.html, alla skript i public/ och CSS-regler med content.
export function gransnittTexter(app) {
  const ut = [];
  const pub = join(app, 'public');
  for (const f of filer(pub, p => /\.(js|html|css)$/.test(p))) {
    const kod = readFileSync(f, 'utf8');
    const fil = relative(app, f);
    if (f.endsWith('.html')) { for (const text of synligHtml(kod)) ut.push({ fil, rad: 0, text }); continue; }
    if (f.endsWith('.css')) { for (const m of kod.matchAll(/content:\s*"([^"]*)"/g)) ut.push({ fil, rad: 0, text: m[1] }); continue; }
    for (const s of strangar(kod)) {
      const delar = /<[a-zA-Z/!]|^\s*[\w-]+="/.test(s.text) ? synligHtml(s.text.replace(/^(\s*[\w-]+=")/, '<x $1') ) : [s.text];
      for (const text of delar) if (arText(text)) ut.push({ fil, rad: s.rad, text });
    }
  }
  return ut;
}

// Serverns texter: felmeddelanden (new Fel), varningar och förklaringar. Koder och benämningar i FHIR (display, code,
// system) är kodverkens engelska och visas inte i gränssnittet, och SQL är ingen text. kodverk.js har kodverkens egna
// benämningar (ATC och LOINC på engelska) och fhir-definitioner.js FHIR:s maskinnamn, som inte får ha å, ä eller ö.
// kallelse-engelska.js har kallelsen på engelska för patienter som har valt det språket och filformat.js syntaxen för
// PDF och iCalendar (runda 6, r4).
const FHIRKOD = /\b(display|code|system|url|valueCode|resourceType)\s*:\s*$/;
export function serverTexter(app) {
  const ut = [];
  for (const f of filer(join(app, 'src'), p => p.endsWith('.js') && !/\/(seed|sussa)\/|\/(kodverk|fhir-definitioner|kallelse-engelska|filformat)\.js$/.test(p))) {
    const kod = readFileSync(f, 'utf8');
    const fil = relative(app, f);
    for (const s of strangar(kod)) {
      if (FHIRKOD.test(s.fore) || /\[\s*'[A-Z]+',\s*$/.test(s.fore)) continue;
      const delar = /<[a-zA-Z/!]/.test(s.text) ? synligHtml(s.text) : [s.text];
      for (const text of delar) if (arText(text)) ut.push({ fil, rad: s.rad, text });
    }
  }
  return ut;
}
