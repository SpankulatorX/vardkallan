// Systemuppbyggnaden (runda 9, r6, Sussa 2.1.1.1): förteckningen över ingående moduler med tillverkare, kopplad till
// kraven, som svarsbilaga K9 begär, och beskrivningen i de fem perspektiv som kravet räknar upp. Förteckningen räknas
// fram ur källkoden vid varje start: varje fil i app/src och app/public/js är en modul, och modulens beskrivning är
// kommentaren överst i filen. Kraven som en modul stödjer kommer från Sussa-registrets mappning, där lösningen nämner
// filen, och från de Sussa-id som filens egen kommentar anger. Testet i app/test/runda9-r6-arkitektur.test.js stoppar
// bygget om en fil saknas i förteckningen eller saknar beskrivning, så förteckningen kan inte bli inaktuell.
//
// Totalkostnaden är en modell med uttalade antaganden, inte en offert: minnet per sandlåda (databasens storlek i minnet)
// mäts av servern, svarstiden mäts i lasttestet, och priset för en server är ett antagande som går att ändra.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SPEC, MAPPNING } from './sussa/index.js';

const APP = join(import.meta.dir, '..');
const EGEN = 'Vårdkällan (öppen källkod under EUPL 1.2)';

// Komponenter som inte är skrivna här, med tillverkare och vad de används till.
export const KOMPONENTER = [
  { namn: 'Bun 1.3.14', tillverkare: 'Oven', anvands: 'Körmiljö för servern: HTTP, JavaScript, test och SQLite.', del: 'drift' },
  { namn: 'SQLite (bun:sqlite)', tillverkare: 'SQLite Consortium, inbyggd i Bun', anvands: 'Databasen för varje sandlåda, med triggrar som skyddar journal och logg.', del: 'drift' },
  { namn: 'Alpine Linux (oven/bun:1.3.14-alpine)', tillverkare: 'Alpine Linux och Oven', anvands: 'Containeravbilden som demon körs i.', del: 'drift' },
  { namn: 'Playwright', tillverkare: 'Microsoft', anvands: 'Testerna av gränssnittet. Ingår inte i det som körs i drift.', del: 'test' },
  { namn: 'HL7 FHIR Validator 7.0.3', tillverkare: 'HL7 International', anvands: 'Validering av FHIR-resurserna i GitHub Actions. Ingår inte i det som körs i drift.', del: 'test' },
  { namn: 'Noto Sans (typsnitt)', tillverkare: 'Google, med fri licens för typsnitt', anvands: 'Typsnittet i gränssnittet.', del: 'gränssnitt' },
];

// Skiktet för en modul, efter namnet. Logiken är medvetet enkel och testas mot att varje modul får ett skikt.
const SKIKT = [
  [/^public\//, 'Gränssnitt'],
  [/(^|\/)(server|.*-rutter|r\d.*-rutter|oppet-api)\.js$/, 'Rutter och API'],
  [/(^|\/)(fhir.*|smart|prenumeration|tjanstekontrakt|masterdata|labb-fhir|tidbok-fhir|api-.*)\.js$/, 'Integration och öppet API'],
  [/(^|\/)(atkomst|logg|sakerhetslogg|logguppfoljning|identitet|undantag|lagring)\.js$/, 'Behörighet, loggning och informationssäkerhet'],
  [/(-regler|skalor|lakemedelsregler|kontroller|uppmarksamhet-regler|tvangsvard-regler)\.js$/, 'Regler och beslutsstöd'],
  [/(^|\/)(db|.*-schema|schema-.*)\.js$|(^|\/)seed\//, 'Data och schema'],
  [/(^|\/)sussa\/|(^|\/)(krav|klickbudget|klientresultat|version|anvandartest.*|sussa-.*|api-tackning)\.js$/, 'Kravregister och kvalitet'],
];
const skiktFor = (fil) => SKIKT.find(([re]) => re.test(fil))?.[1] ?? 'Verksamhetslogik';

function filer(rot, under) {
  const ut = [];
  for (const namn of readdirSync(join(rot, under)).sort()) {
    const vag = join(under, namn);
    if (statSync(join(rot, vag)).isDirectory()) ut.push(...filer(rot, vag));
    else if (namn.endsWith('.js')) ut.push(vag);
  }
  return ut;
}

// Kommentaren överst i filen, utan kommentartecken, som en mening.
function beskrivning(text) {
  const rader = [];
  for (const r of text.split('\n')) {
    const m = r.match(/^\s*\/\/\s?(.*)$/);
    if (!m) break;
    rader.push(m[1].trim());
  }
  return rader.join(' ').replace(/\s+/g, ' ').trim();
}

const SUSSA_ID = /\b(?:KD\d\.\d\.\d\.\d{1,2}|\d{1,2}\.\d{1,2}\.\d{1,2}\.\d{1,2})\b/g;

// Förteckningen: en post per modul med skikt, tillverkare, beskrivning och de krav i Sussa-registret som modulen stödjer.
export function moduler({ rot = APP } = {}) {
  const kanda = new Set(SPEC.poster.map(p => p.id));
  const omnamnd = new Map();
  for (const m of MAPPNING) {
    for (const f of `${m.losning ?? ''} ${m.anmarkning ?? ''}`.match(/[\w-]+\.js/g) ?? []) {
      if (!omnamnd.has(f)) omnamnd.set(f, new Set());
      omnamnd.get(f).add(m.id);
    }
  }
  return [...filer(rot, 'src'), ...filer(rot, 'public')].map((vag) => {
    const fil = relative(rot, join(rot, vag)).replaceAll('\\', '/');
    const text = readFileSync(join(rot, vag), 'utf8');
    const beskr = beskrivning(text);
    const egna = new Set((beskr.match(SUSSA_ID) ?? []).filter(id => kanda.has(id)));
    const namn = fil.split('/').pop();
    // En fil i public/js och en i src kan ha samma namn. Mappningen nämner bara filnamnet, så båda får kraven.
    for (const id of omnamnd.get(namn) ?? []) egna.add(id);
    return { modul: fil, skikt: skiktFor(fil), tillverkare: EGEN, beskrivning: beskr, krav: [...egna].sort((a, b) => a.localeCompare(b, 'sv', { numeric: true })), rader: text.split('\n').length };
  });
}

// De fem perspektiven i kravtexten. Varje perspektiv pekar på moduler som finns, och testet kontrollerar det.
export const PERSPEKTIV = [
  {
    id: 'kontextuell', rubrik: 'Kontextuell: det tekniska sammanhanget',
    text: 'Vårdkällan är ett kärnsystem som körs som en tjänst i en container. Personalen arbetar i en webbläsare och invånaren i Min journal. Externa system ansluter via det öppna FHIR R4-API:t, SMART on FHIR och prenumerationer. De nationella tjänsterna (NLL, tjänsteplattformen, HSA, laboratoriet och e-legitimation) är simulerade i demon och har var sin adapter med samma kontrakt som en riktig anslutning.',
    moduler: ['src/server.js', 'src/oppet-api.js', 'src/smart.js', 'src/prenumeration.js', 'src/tjanstekontrakt.js', 'src/masterdata.js', 'src/labb.js'],
  },
  {
    id: 'konceptuell', rubrik: 'Övergripande konceptuell: funktionerna',
    text: 'En journal per patient med vårdkontakter, anteckningar, diagnoser, mätvärden, läkemedel, remisser, provtagning, tidbok, planering och vårdplaner, ett gemensamt kravregister och samma regler för behörighet och loggning i hela systemet, så att användaren upplever ett system.',
    moduler: ['src/journal.js', 'src/vardkontakt.js', 'src/lakemedel.js', 'src/remiss.js', 'src/labb.js', 'src/tidbok.js', 'src/planering.js', 'src/vardplan.js', 'src/krav.js'],
  },
  {
    id: 'logisk', rubrik: 'Logisk: moduler, skikt och grundläggande mönster',
    text: 'Fyra skikt: gränssnittet i webbläsaren (moduler utan byggsteg), rutterna och API:t, verksamhetslogiken med regler och beslutsstöd i egna moduler, och data i SQLite med triggrar. Två mönster går igenom allt: varje åtkomst till en patient prövas i behörighetsmotorn och loggas i en kedja som inte kan ändras, och FHIR-API:t skriver genom samma rutter som gränssnittet.',
    moduler: ['public/js/app.js', 'src/atkomst.js', 'src/logg.js', 'src/fhir-skrivning.js', 'src/lakemedelsregler.js', 'src/db.js'],
  },
  {
    id: 'fysisk', rubrik: 'Fysisk (konceptuell): drift och nät',
    text: 'En container med Bun och SQLite, som demon kör bakom en omvänd proxy med TLS. Varje besökare får en egen databas i minnet (sandlåda) som sparas vid omstart. Webbläsaren har en service worker och en krypterad läskopia så att arbetslistan och journalen går att läsa vid avbrott. I en riktig drift ligger databasen på disk med säkerhetskopior, som modulen för lagring prövar.',
    moduler: ['src/server.js', 'src/db.js', 'src/lagring.js', 'public/sw.js', 'public/js/lasekopia.js', 'public/js/avbrott.js'],
  },
  {
    id: 'moduler', rubrik: 'Ingående moduler med tillverkare (svarsbilaga K9)',
    text: 'Förteckningen nedan räknas fram ur källkoden: varje modul med skikt, tillverkare, beskrivning och de krav i Sussa-registret som den stödjer. Komponenter från andra tillverkare står för sig.',
    moduler: [],
  },
];

// Totalkostnaden per användare och månad ur mätningen och antagandena. matning är { mbPerSandlada, p95Ms, samtidiga }
// från lasttestet. Antagandena står i svaret så att den som läser ser vad siffran bygger på.
export const ANTAGANDEN = {
  serverKrPerManad: 1500, serverMinneMb: 8192, reservMinne: 0.5, aktivaAvAnstallda: 0.3, driftTimmarPerManad: 8, timkostnadKr: 900,
  text: 'En server med 8 gigabyte minne för 1 500 kronor i månaden, hälften av minnet i reserv, 30 procent av de anställda inloggade samtidigt och 8 timmars drift i månaden till 900 kronor i timmen. Licenskostnad finns inte, eftersom koden är öppen.',
};
export function totalkostnad(matning, a = ANTAGANDEN) {
  if (!matning || !(matning.mbPerSandlada > 0)) return null;
  const samtidigaPerServer = Math.floor((a.serverMinneMb * (1 - a.reservMinne)) / matning.mbPerSandlada);
  const anstalldaPerServer = Math.floor(samtidigaPerServer / a.aktivaAvAnstallda);
  const krPerManad = a.serverKrPerManad + a.driftTimmarPerManad * a.timkostnadKr;
  return {
    samtidigaPerServer, anstalldaPerServer, krPerServerOchManad: krPerManad,
    krPerAnvandareOchManad: Math.round((krPerManad / anstalldaPerServer) * 100) / 100,
    matning, antaganden: a, licens: 0,
  };
}

// Svaret på GET /api/arkitektur.
let cache = null;
export function arkitektur({ matning = null } = {}) {
  cache ??= moduler();
  return {
    perspektiv: PERSPEKTIV, moduler: cache, komponenter: KOMPONENTER,
    skikt: [...new Set(cache.map(m => m.skikt))],
    totalkostnad: totalkostnad(matning), antaganden: ANTAGANDEN,
  };
}
