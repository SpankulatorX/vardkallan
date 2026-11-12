// Runda 14, r5: driftdokumenten i docs/drift/ (Sussa KD1, 5.2.1.5, 5.3.1.x, 9, 11 och 12). Ett öppet projekt kan inte
// åta sig att driva systemet. Dokumenten är det en driftansvarig behöver för att kunna uppfylla leverantörens åtaganden:
// processer, mallar och kravlistor som går att ta över och fylla i, med hänvisningar till det systemet redan har som stöd.
// Texterna ligger i driftdokument-processer.js och driftdokument-skydd.js och skrivs till docs/drift/ av
// scripts/dokument-md.js. Testet (test/driftdokument.test.js) prövar att varje Sussa-id och varje fil som texterna
// hänvisar till finns, och att texterna följer språkreglerna.
//
// Skrivsätt i texterna: kod, filer och rutter står inom «». En «app/...» eller «docs/...» blir en länk till filen.
import spec from './sussa/kravspec.json' with { type: 'json' };
import { DOKUMENT as PROCESSER, FORKORTNINGAR as F_PROCESSER } from './driftdokument-processer.js';
import { DOKUMENT as SKYDD, FORKORTNINGAR as F_SKYDD } from './driftdokument-skydd.js';

export const DOKUMENT = [...PROCESSER, ...SKYDD];
export const FORKORTNINGAR = { ...F_PROCESSER, ...F_SKYDD };
export const KATALOG = 'docs/drift';

const POSTER = new Map(spec.poster.map(p => [p.id, p]));
const TYP = { krav_vid_anbud: 'Skallkrav vid anbud', krav_vid_leverans: 'Skallkrav vid leverans', utvarderingskriterium: 'Utvärderingskriterium' };

// Sussas id i en text: KD1.3.2.1 och 5.3.1.14. Versionsnummer som 1.4.0 och ITIL v3 räknas inte, eftersom ett id har
// fyra delar.
export const sussaId = (text) => [...new Set([...text.matchAll(/(?<![\w.])(KD\d+\.\d+\.\d+\.\d+|\d{1,2}\.\d+\.\d+\.\d+)(?![\w.]*\d)/g)].map(m => m[1]))];
// Allt inom «» i en text.
export const kodDelar = (text) => [...text.matchAll(/«([^»\n]+)»/g)].map(m => m[1]);
// Filer som texten länkar till: det inom «» som börjar med app/ eller docs/. Rutter med frågor räknas inte.
export const filer = (text) => [...new Set(kodDelar(text).filter(k => /^(app|docs)\//.test(k)).map(k => k.split(/[?#\s]/)[0]))];

// Från docs/drift/ till en fil i repot.
const lank = (vag) => (vag.startsWith('docs/') ? `../${vag.slice(5)}` : `../../${vag}`);
const kod = (text) => text.replace(/«([^»\n]+)»/g, (_, k) => (/^(app|docs)\//.test(k) ? `[\`${k}\`](${lank(k.split(/[?#\s]/)[0])})` : `\`${k}\``));

const STANDARD = 'Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.';

// Förkortningarna som ett dokument använder, i bokstavsordning.
const anvanda = (text) => Object.keys(FORKORTNINGAR).filter(f => new RegExp(`(?<![\\wÅÄÖåäö])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\wÅÄÖåäö])`).test(text)).sort((a, b) => a.localeCompare(b, 'sv'));

export function markdown(d) {
  const krav = d.sussa.map((id) => {
    const p = POSTER.get(id);
    return `| ${id} | ${p ? p.rubrik : 'Saknas i kravspecifikationen'} | ${p ? TYP[p.typ] ?? p.typ : ''} |`;
  });
  const fork = anvanda(d.text);
  return [
    `# ${d.rubrik}`, '', d.sammanfattning, '', STANDARD, '',
    '## Krav i Sussa som dokumentet gäller', '', '| Id | Krav | Slag |', '| --- | --- | --- |', ...krav, '',
    kod(d.text.trim()), '',
    ...(fork.length ? ['## Förkortningar', '', ...fork.map(f => `- ${f}: ${FORKORTNINGAR[f]}`), ''] : []),
    'Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.', '',
  ].join('\n');
}

// Innehållsförteckningen i docs/drift/README.md med en tabell från varje Sussa-id till dokumenten.
export function index() {
  const perId = new Map();
  for (const d of DOKUMENT) for (const id of d.sussa) perId.set(id, [...(perId.get(id) ?? []), d]);
  const ordning = (a, b) => spec.poster.findIndex(p => p.id === a) - spec.poster.findIndex(p => p.id === b);
  return [
    '# Drift, processer och leverantörens åtaganden', '',
    'Sussas kravspecifikation har ett sextiotal skallkrav som gäller leverantören och inte systemets funktion: drift, datahallar, servicenivåer, processer enligt ITIL, informationssäkerhet hos leverantören, support, utbildning, projekt och test. Ett öppet projekt kan inte själv åta sig att driva systemet. Dokumenten här är det som en region eller en driftleverantör behöver för att kunna uppfylla kraven: processer, mallar och kravlistor som går att ta över och fylla i, med hänvisningar till det systemet redan har som stöd.', '',
    STANDARD, '',
    'Systemet ger stöd där det går utan någon motpart: servicenivårapporten räknas ur systemets egna mått och incidentregistret, och incidentrapporten till beställaren tas ut som fil (vyn Servicenivåer och incidenter, för systemförvaltaren). Kravsidan i demon visar för varje krav vad som är byggt och vad som återstår.', '',
    '## Dokumenten', '', '| Dokument | Innehåll | Sussa |', '| --- | --- | --- |',
    ...DOKUMENT.map(d => `| [${d.rubrik}](${d.fil}) | ${d.sammanfattning} | ${d.sussa.join(', ')} |`), '',
    '## Från krav till dokument', '', '| Id | Krav | Dokument |', '| --- | --- | --- |',
    ...[...perId.keys()].sort(ordning).map(id => `| ${id} | ${POSTER.get(id)?.rubrik ?? ''} | ${perId.get(id).map(d => `[${d.rubrik}](${d.fil})`).join(', ')} |`), '',
    'Dokumenten skrivs ur Vårdkällans källkod (app/src/driftdokument.js) med app/scripts/dokument-md.js, och ett test i bygget prövar att varje krav och varje fil de hänvisar till finns.', '',
  ].join('\n');
}

// Filerna i docs/drift/ som [namn, markdown].
export const dokumentFiler = () => [['README.md', index()], ...DOKUMENT.map(d => [d.fil, markdown(d)])];
