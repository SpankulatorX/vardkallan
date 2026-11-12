// Vårdkällan. Varje besökare får en egen sandlåda i minnet, en kopia av den seedade mallen.
// Sandlådorna sparas till SESSION_FIL vid SIGTERM och läses in vid start.
// Runda 11, r1: testcontainerns falska klocka läses in först av allt (gör ingenting utan testflaggan, se testklocka.js).
import { TESTKLOCKA } from './testklocka.js';
import { join, normalize, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { Fel, nySessionsDb, lasSandlada, idag, installning, migrera } from './db.js';
import { Atkomst, ROLLER, kanRoll, vardenhetFor, harVardrelation, aktivaSparrar, visningsnamn, visningsPnr, alder, starkasteGrund } from './atkomst.js';
import * as logg from './logg.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as remiss from './remiss.js';
import * as fhir from './fhir.js';
import * as minJournal from './patientvy.js';
import * as uppmarksamhet from './uppmarksamhet.js';
import * as identitet from './identitet.js';
import * as vardkontakt from './vardkontakt.js';
import * as administrering from './administrering.js';
// Delegering av läkemedelshantering (runda 5).
import * as delegering from './delegering.js';
import * as vidimering from './vidimering.js';
import * as ordinationsmallar from './ordinationsmallar.js';
import * as tidbok from './tidbok.js';
// Runda 5, r1: planerad vårdhändelse i tidboken och läkarens återbesök.
import * as vardhandelse from './vardhandelse.js';
import * as aterbesok from './aterbesok.js';
// Återinsättning efter ett uppehåll med antikoagulantia i läkarens inkorg (runda 5, r4).
import * as aterinsattning from './aterinsattning.js';
// Avvisad remiss med en vårdhändelse som ett läkemedel väntar på (runda 5, r4).
import * as remissavvisning from './remissavvisning.js';
import { kravregister, lasTestresultat } from './krav.js';
import { sussaRegister } from './sussa/index.js';
// Runda 11, r8: modulregistret.
import { modulregister, exempel as modulExempel } from './moduler.js';
import { lasKlientresultat, gransnittHash } from './klientresultat.js';
import { YRKEN } from './seed/personal.js';
// Utskrift, kontrasignering, arkiv och datauttag (Sussa 3.1.9, 3.1.11.3, 5.4.2, 5.3.1.7 och 6.3.1).
import { registreraRutter as utdataRutter, tillagg as utdata } from './utdata-rutter.js';
// Runda 6, r3: vårdplaner, psykiatrisk tvångsvård, samordnad planering (SIP och SPU) och ändringar i hälsoärenden.
import { registreraRutter as r3Rutter, tillagg as r3 } from './r3-rutter.js';
// Runda 6, r1: sökning i journalen, mätvärden med kurvor och NEWS2, basfakta, säkerhetsloggen, loggexport och stickprov.
import { registreraRutter as r1Rutter } from './sok-matvarden-logg-rutter.js';
import * as vitalparametrar from './vitalparametrar.js';
import * as sakerhetslogg from './sakerhetslogg.js';
// Läkemedelsprocessen, del 2 (runda 6, r2).
// Runda 8, r4: dosändring i en pågående ordination.
import * as dosandring from './dosandring.js';
import { registreraRutter as lakemedelsstodRutter, inkorg as lakemedelsstodInkorg } from './lakemedelsstod-rutter.js';
import * as lakemedelsstod from './lakemedelsstod.js';
import * as lakemedelsvyer from './lakemedelsvyer.js';
// Runda 6, r6: ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar.
import { registreraRutter as lakemedelsansvarRutter, inkorg as lakemedelsansvarInkorg } from './lakemedelsansvar-rutter.js';
// Runda 6, r5: skrivning via FHIR, prenumerationer, SMART on FHIR och masterdata (oppet-api.js).
import { skapaOppetApi } from './oppet-api.js';
// Runda 6, r4: planering och tidbok, del 2, remiss, del 2, egen vårdbegäran och incheckning genom FHIR.
import { registreraRutter as r4Rutter, inkorg as r4Inkorg, period as r4Period } from './planering-rutter.js';
// Runda 7, r5: rapportering till myndigheter och register och de nationella tjänstekontrakten (rapportering-rutter.js).
import { registreraRutter as r7r5Rutter, inkorg as r7r5Inkorg } from './rapportering-rutter.js';
import * as planering from './planering.js';
import * as tidbokFhir from './tidbok-fhir.js';
// Runda 7, r3: ekonomi, faktureringsunderlag och kostnader i vårdprocessen (Sussa 7.1).
import { registreraRutter as ekonomiRutter } from './ekonomi-rutter.js';
// Runda 8, r3: fri bokning, teambesök, gruppträffar och avdelningens planerade händelser (r8r3-rutter.js).
import { registreraRutter as r8r3Rutter } from './r8r3-rutter.js';
import * as ekonomi from './ekonomi.js';
// Runda 7, r4: systemförvaltningen, med konfiguration, omorganisation, undantag och lagring.
import { registreraRutter as systemforvaltningRutter, efterDatum as systemforvaltningEfterDatum, inkorg as systemforvaltningInkorg } from './systemforvaltning-rutter.js';
import * as konfiguration from './konfiguration.js';
import * as undantag from './undantag.js';
import * as omorganisation from './omorganisation.js';
// Runda 7, r6: barnhälsovården, tillväxt och rapporteringen till Svenska barnhälsovårdsregistret (bhv-rutter.js).
import { registreraRutter as bhvRutter, inkorg as bhvInkorg, session as bhvSession } from './bhv-rutter.js';
import { minTillvaxt } from './bhv.js';
// Runda 8, r1: beställning och svar, provtagning och kontrollerna till avdelningen (labb-rutter.js).
import { registreraRutter as labbRutter, inkorg as labbInkorg, efterTid as labbEfterTid, MIN_DELAR as labbMinDelar } from './labb-rutter.js';
// Runda 9, r3: operation, blodprodukter, graviditet och förlossning, cytostatika och bilder (r9r3-rutter.js).
import { registreraRutter as r9r3Rutter } from './r9r3-rutter.js';
// Runda 11, r5: bilder och media 1.1, uppladdning i delar, annoteringar, import och DICOMweb (r11r5-rutter.js).
import { registreraRutter as r11r5Rutter } from './r11r5-rutter.js';
// Runda 7, r2: nyhetsrutan, övningarna med intyg och tillgänglighetsredogörelsen.
import { registreraRutter as utbildningRutter } from './utbildning-rutter.js';
import { redogorelse as tillganglighet } from './tillganglighet.js';
// Runda 7, r1: demoläget för Sussas användbarhetstester (sussa-demo.js).
import * as sussaDemo from './sussa-demo.js';
import * as anvandartestSvar from './anvandartest-svar.js';
// Runda 8, r5: tobaksvanor, epikrisens förslag, flera mätvärden och villkoren för version 1.0.
import * as tobak from './tobak.js';
import { registreraRutter as r5Rutter } from './r5-rutter.js';
// Runda 9, r6: systemuppbyggnaden (Sussa 2.1.1.1).
import * as arkitektur from './arkitektur.js';
import { villkor10 } from './version.js';
// Runda 9, r1: beredning med kontroll och etikett, patientnära skanning, förbrukningsartiklar och mer i
// läkemedelsprocessen (r9r1-rutter.js).
import { registreraRutter as r9r1Rutter, inkorg as r9r1Inkorg } from './r9r1-rutter.js';
// Runda 8, r2: remiss på uppdrag, fördelning, remisskonferens och extern pappersremiss (remiss-r8.js).
import * as remissR8 from './remiss-r8.js';
// Runda 10, r6: konsultation, urval i remissöversikten och kvittens av beslut på uppdrag (remiss-r10.js).
import * as remissR10 from './remiss-r10.js';
// Runda 10, r6: producentsystem för beställning och svar genom det öppna gränssnittet (produktionssystem.js).
import * as produktionssystem from './produktionssystem.js';
import { avvikelserIInkorg as blodAvvikelserIInkorg } from './blod.js';
// Runda 9, r2: medicinteknisk utrustning, anestesi och intensivvård (medicinteknik.js och iva.js).
import { registreraRutter as mtRutter, skapaMottagning as mtMottagning, efterTid as mtEfterTid } from './medicinteknik-rutter.js';
import { skapaNyckellager as mtNyckellager, patientvy as mtPatientvyFor, minaMatningar as mtMinaMatningar } from './medicinteknik.js';
import { session as ivaSession } from './iva.js';
const mtPatientvy = (atk) => mtPatientvyFor(atk, journal.synligaMatvarden(atk));
// Runda 9, r5: inloggning med biljett från en autentiseringstjänst (Sussa 5.2.1.6 och 5.2.1.8).
import * as idp from './idp.js';
import { registreraRutter as r9r5Rutter } from './runda9-r5-rutter.js';
import * as miljoer from './miljoer.js';
// Runda 9, r7: skanning, analys, folkhälsa, spårbarhet, forskningsuttag, in- och utfarter, restjournaler och signering.
import { registreraRutter as r9r7Rutter } from './r9r7-rutter.js';
// Runda 10, r1: överkänslighet och skrivkön för arbete utan uppkoppling (r10r1-rutter.js).
import { registreraRutter as r10r1Rutter } from './r10r1-rutter.js';
// Runda 10, r5: kunskapsstöd, utfall, kollegakontroll, läkemedelsöverföring, vaccinationsprogram, sammanhållen
// journalföring och akutflödet (runda10-r5-rutter.js).
import { registreraRutter as r10r5Rutter, inkorg as r10r5Inkorg } from './runda10-r5-rutter.js';
import * as sammanhallen from './sammanhallen.js';
import * as levnadsvanor from './levnadsvanor.js';
import * as folkhalsa from './folkhalsa.js';
// Runda 9, r4: informationsstrukturen, fackspråket, kodverken och masterdatans källor (arkitektur-rutter.js).
import { registreraRutter as r9r4Rutter, efterTid as masterdataEfterTid } from './arkitektur-rutter.js';
// Runda 10, r2: vyer, presentation, sökning, utskrifter och loggning.
import { registreraRutter as r10r2Rutter } from './runda10-r2-rutter.js';
import * as presentationsvyer from './presentationsvyer.js';
// Runda 10, r3: formulärmotorn och rättstavningen (r10r3-rutter.js), och formulären bland mallarna.
import { registreraRutter as r10r3Rutter } from './r10r3-rutter.js';
import { mallarFor as formularMallar } from './formularmotor.js';
// Runda 10, r4: in- och utfarter, restjournaler och donation (runda10-r4-rutter.js).
import { registreraRutter as r10r4Rutter, tidslinje as r10r4Tidslinje, inkorg as r10r4Inkorg } from './runda10-r4-rutter.js';
// Runda 11, r4: cytostatika och blodprodukter i version 1.1 (r11r4-rutter.js).
import * as r11r4 from './r11r4-rutter.js';
import { minBehandling as cytoMinBehandling, minHuvud as cytoMinHuvud } from './cytostatika.js';
import { avlidenFor } from './avliden.js';
// Runda 10, r7: ombud, meddelanden, begäranden, vårdplanen i Min journal, kassan, kapaciteten och kontorsstödet.
import { registreraRutter as r10r7Rutter, MIN_DELAR as r10r7MinDelar, kalenderSvar } from './r10r7-rutter.js';
// Runda 11, r3: graviditet, förlossning, BB och Graviditetsregistret.
import { registreraRutter as r11r3Rutter, session as r11r3Session, efterInloggning as r11r3EfterInloggning } from './r11r3-rutter.js';
import { minGraviditet, harMinGraviditet } from './obstetrik.js';
import { skapaKalenderlager } from './kontorsstod.js';
// Runda 11, r7: intensivvården och tillväxten (r11r7-rutter.js).
import { registreraRutter as r11r7Rutter } from './r11r7-rutter.js';
// Runda 12, r1: journalens mallar, sökord och mätvärdestyper utan programmerare (r12r1-rutter.js).
import { registreraRutter as r12r1Rutter } from './r12r1-rutter.js';
import { mallarFor as strukturMallar } from './journalstruktur.js';
// Runda 12, r3 (vårt L5): flerfaktorsinloggning med passkeys och engångskoder.
import * as flerfaktor from './flerfaktor.js';
// Runda 12, r2: uppgraderingar med återgång och säkerhetskopior (runda12-r2-rutter.js och releaser.js).
import { registreraRutter as r12r2Rutter } from './runda12-r2-rutter.js';
import { MIGRERINGAR as r12r2Migreringar } from './releaser.js';
import { skapaKopielager, schemalagdaStegvis } from './sakerhetskopior.js';
// Runda 13, r2: sandlådor som vilar på disk, inga tappade sandlådor och en vänlig sida när demon är full.
import { Database } from 'bun:sqlite';
import * as vila from './sandlada-vila.js';

const PUBLIC = join(import.meta.dir, '..', 'public');
// Runda 13, r2: taket för sandlådor i minnet och på disk tillsammans. En sandlåda tas aldrig bort för att ge plats åt
// en ny; när taket är nått får en ny besökare en sida som säger när det är lönt att försöka igen.
const MAX_SANDLADOR = 3000;
const SESSION_TTL = 8 * 3600_000;
// Runda 13, r2: en sandlåda där ingen har loggat in har inget att förlora och försvinner efter en timme utan användning.
const TOM_TTL = 3600_000;
// Runda 13, r2: så mycket ledigt utrymme lämnas alltid kvar på disken.
const DISK_RESERV = 1024 * 1048576;
const MAX_KROPP = 64 * 1024;
const SPARVERSION = 1;
// Runda 13, r2: sessionsfilen med vilande sandlådor, där databaserna ligger i katalogen för vilande sandlådor.
const SPARVERSION_VILA = 2;
// Runda 12, r2: nyckeln för kopiornas namn. Med en katalog sparas den i en fil där, annars en ny för varje start.
function kopieNyckel(katalog) {
  const { randomBytes } = require('node:crypto');
  if (!katalog) return randomBytes(32);
  const fil = join(katalog, '.nyckel');
  try { return readFileSync(fil); } catch { /* skapas nedan */ }
  const n = randomBytes(32);
  try { require('node:fs').mkdirSync(katalog, { recursive: true, mode: 0o700 }); writeFileSync(fil, n, { mode: 0o600 }); } catch (e) { console.error('Nyckeln för kopiorna kunde inte sparas:', e.message); }
  return n;
}
// Appens version och en hash av gränssnittet. /api/health visar dem, och användartestet märker resultatet med dem.
const APPVERSION = (() => { try { return JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')).version; } catch { return null; } })();
let gransnitt;
const gransnittVersion = () => { if (gransnitt === undefined) { try { gransnitt = gransnittHash(PUBLIC); } catch { gransnitt = null; } } return gransnitt; };
const VAL_TYPER = ['andra_enheter', 'nodatkomst', 'samtycke_sparr', 'visa_identitet'];
// Läskopian för avbrott (D4): så många av de senaste anteckningarna per patient följer med.
const LASKOPIA_ANTECKNINGAR = 5;
// Läskopians läkemedelsdel (Sussa 11.2.1.8): uppgifterna om ordinerade och administrerade läkemedel får vara högst 10
// minuter gamla när servern inte svarar. Webbläsaren förnyar kopian var fjärde minut av sig själv. Med en minuts
// fördröjning för en flik i bakgrunden och ett misslyckat försök som görs om efter 30 sekunder håller det.
const LASKOPIA_FORNYA_MS = 4 * 60_000;
const LASKOPIA_LAKEMEDEL_MAX_MS = 10 * 60_000;
// Delarna i läkemedelsdelen: namnet i kopian och i läsläget (GET /api/patient/:id/<namn>), läshandlingen och funktionen
// som ger samma svar som det vanliga anropet. Läsläget svarar på /api/patient/:id/<namn> ur kopian och loggar läsningen
// med handlingen.
const LASKOPIA_LAKEMEDEL = {
  lakemedel: { handling: 'las_lakemedel', hamta: (atk) => lakemedel.lista(atk) },
  // Dagens administreringar med givna doser (administrering.js).
  administreringar: { handling: 'las_lakemedel', hamta: (atk) => administrering.lista(atk) },
};
// Runda 10, r1: fler delar av journalen i läskopian (Sussa 2.3.1.4): mätvärdena och remisserna, med samma funktion och
// läshandling som det vanliga anropet. Läsläget svarar på /api/patient/:id/<namn> ur kopian och loggar läsningen med
// handlingen, på samma sätt som läkemedelsdelen. handling är en funktion av personen, eftersom remisserna läses med
// olika handlingar för olika roller.
const LASKOPIA_JOURNAL = {
  matvarden: { handling: () => 'las_matvarden', hamta: (atk, p) => ({ ...vitalparametrar.matvardesvy(atk, p), mt: mtPatientvy(atk),
    // Namn och enhet per typ, så att ett mätvärde som registreras under avbrottet kan visas i listan.
    typer: Object.fromEntries(Object.entries(journal.MATTYPER).map(([k, v]) => [k, { namn: v.namn, enhet: v.enhet }])) }) },
  remisser: { handling: (pers) => (kanRoll(pers, 'las_remiss') ? 'las_remiss' : 'las_remiss_status'), hamta: (atk) => remiss.forPatient(atk) },
};
// Varför utlämnandet till läskopian slutade, i loggen.
const LASKOPIA_SLUT = {
  utloggning: 'Förnyelsen slutade när personen loggade ut.',
  inloggning: 'Förnyelsen slutade vid en ny inloggning i samma webbläsare.',
  invanare: 'Förnyelsen slutade när någon loggade in i Min journal i samma webbläsare.',
  utgangen: 'Förnyelsen slutade när läskopian gick ut.',
  utanfor: 'Förnyelsen slutade eftersom patienten inte längre hör till läskopian.',
};
// Läshandlingar som får rapporteras från läsläget i efterhand.
const LASLAGE_HANDLINGAR = ['las_oversikt', 'las_admin', 'las_lakemedel', 'las_journal', 'las_omvardnad'];
const KLOCKMARGINAL = 5 * 60_000;
// Så många rader från läsläget tas emot per läskopia. Fler avvisas, så att ett id aldrig glöms och kan loggas igen.
const MAX_LASLOGG_ID = 5000;
// Så många läskopior per sandlåda håller servern reda på för att kunna ta emot loggen från läsläget i efterhand.
const MAX_KOPIOR = 10;

// Svarstider: senaste mätningarna per endpoint.
export class Matning {
  constructor(max = 500, maxNycklar = 150) { this.max = max; this.maxNycklar = maxNycklar; this.data = new Map(); }
  lagg(nyckel, ms) {
    if (!this.data.has(nyckel) && this.data.size >= this.maxNycklar) nyckel = 'övrigt';
    let a = this.data.get(nyckel);
    if (!a) { a = []; this.data.set(nyckel, a); }
    a.push(ms);
    if (a.length > this.max) a.shift();
  }
  sammanstall() {
    const p = (s, q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
    return [...this.data].map(([endpoint, a]) => {
      const s = [...a].sort((x, y) => x - y);
      return { endpoint, antal: a.length, p50: Math.round(p(s, 0.5) * 10) / 10, p95: Math.round(p(s, 0.95) * 10) / 10 };
    }).sort((x, y) => x.endpoint.localeCompare(y.endpoint));
  }
}

export function normaliseraVag(metod, vag) {
  if (vag.startsWith('/fhir/')) {
    const d = vag.split('/');
    if (d.length > 3 && d[3]) d[3] = ':id';
    return `${metod} ${d.join('/')}`;
  }
  if (!vag.startsWith('/api/')) return `${metod} statisk`;
  return `${metod} ${vag.split('/').map(s => (/^p\d+$/.test(s) || /^\d+$/.test(s) ? ':id' : s)).join('/')}`;
}

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const SAKERHET = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

async function statisk(path) {
  if (path === '/' || path === '') path = '/index.html';
  let avkodad;
  try { avkodad = decodeURIComponent(path); } catch { return null; }
  let fil = normalize(join(PUBLIC, avkodad));
  if (!fil.startsWith(PUBLIC + '/')) return null;
  let f = Bun.file(fil);
  if (!(await f.exists())) {
    // Okända sökvägar utan filändelse får index.html, så att gränssnittet kan ha egna adresser.
    if (/\.[a-z0-9]+$/i.test(path)) return null;
    fil = join(PUBLIC, 'index.html');
    f = Bun.file(fil);
    if (!(await f.exists())) return null;
  }
  const ext = fil.slice(fil.lastIndexOf('.'));
  // Runda 6, r5: externa tillämpningar visas i en ram i journalen, så de får ramas in av samma webbplats.
  const ram = path.startsWith('/tillampningar/') ? { 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': SAKERHET['Content-Security-Policy'].replace("frame-ancestors 'none'", "frame-ancestors 'self'") } : {};
  return new Response(f, { headers: { 'Content-Type': TYPER[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', ...SAKERHET, ...ram } });
}

export function starta({ port = Number(process.env.PORT || 8080), hostname = '0.0.0.0', origin = process.env.ORIGIN || '',
  sessionFil = process.env.SESSION_FIL || '', testresultat = process.env.TESTRESULTAT || join(import.meta.dir, '..', 'test-resultat.json'),
  klientresultat = { klickbudget: process.env.KLICKBUDGET || join(import.meta.dir, '..', 'klickbudget.json'), klienttester: process.env.KLIENTTESTER || join(import.meta.dir, '..', 'klienttest-resultat.json'),
    // Runda 7, r1: Sussas användbarhetstester (test/sussa-testfall.cjs).
    sussatestfall: process.env.SUSSATESTFALL || join(import.meta.dir, '..', 'sussa-testfall.json'),
    // Runda 12, r2: lasttestet och valideringen med HL7:s validator, som räknas bara när de gäller den kod som körs.
    lasttest: process.env.LASTTEST || join(import.meta.dir, '..', 'lasttest.json'), fhirvalidering: process.env.FHIRVALIDERING || join(import.meta.dir, '..', 'fhir-validering.json') },
  nyaPerTimme = Number(process.env.NYA_PER_TIMME || 60),
  // Runda 7, r2 (K2 1.6.1): inloggningen går ut efter så här många minuter utan aktivitet. Runda 8, r5: utan värde här
  // gäller parametrarna på sidan Regler och parametrar, skilda för personal och invånare (konfiguration.js).
  inloggningMinuter = process.env.INLOGGNING_MINUTER ? Number(process.env.INLOGGNING_MINUTER) : null,
  // Runda 7, r1: svaren från riktiga användartester, i en egen databas som alla sandlådor delar. Bredvid sessionsfilen
  // när den finns, annars bara i minnet.
  anvandartestFil = process.env.ANVANDARTEST_FIL || (sessionFil ? join(dirname(sessionFil), 'anvandartest.sqlite') : ':memory:'),
  // Runda 6, r5: mottagaradresser och sändning för prenumerationerna, utbytbara i testerna.
  oppetApiVal = {},
  // Runda 12, r2: säkerhetskopiorna på två platser (sakerhetskopior.js). Bredvid sessionsfilen när den finns, annars i
  // minnet. kopieMinuter är hur ofta en kopia tas, och maxSessioner hur många sandlådor servern håller (lasttestet).
  kopieKatalog = process.env.KOPIOR_KATALOG || (sessionFil ? join(dirname(sessionFil), 'kopior') : null),
  kopieAndra = process.env.KOPIOR_ANDRA || (sessionFil ? join(dirname(sessionFil), 'kopior-2') : null),
  kopieMinuter = Number(process.env.KOPIOR_MINUTER || 15),
  // Runda 13, r2: sandlådor som vilar på disk (sandlada-vila.js). vilaKatalog ligger bredvid sessionsfilen, annars
  // vilar sandlådorna komprimerade i minnet. vilaMinuter är hur länge en sandlåda får vara oanvänd innan den skrivs till
  // disk. maxIMinnet räknas ur containerns minnesgräns när driften inte sätter det, maxSandlador är taket för alla
  // sandlådor (maxSessioner är det äldre namnet), och maxDiskMb taket för diskutrymmet för vilande sandlådor och kopior.
  // tryggSekunder är hur länge efter att en sandlåda har använts som den inte flyttas till disk för att ge plats åt en ny.
  vilaKatalog = process.env.VILA_KATALOG || (sessionFil ? join(dirname(sessionFil), 'vila') : null),
  vilaMinuter = Number(process.env.VILA_MINUTER || 10),
  maxIMinnet = process.env.MAX_I_MINNET ? Number(process.env.MAX_I_MINNET) : vila.maxIMinnet(vila.minnesgrans()),
  maxSessioner = null,
  maxSandlador = Number(process.env.MAX_SANDLADOR || process.env.MAX_SESSIONER || MAX_SANDLADOR),
  maxDiskMb = Number(process.env.MAX_DISK_MB || 8192),
  tryggSekunder = Number(process.env.VILA_TIDIGAST_SEKUNDER ?? 20),
  // Runda 13, r2: tak mot missbruk från många anonyma besökare. maxSandladaMb är hur stor en sandlåda får bli,
  // tidsbudgetSandladaMs och tidsbudgetAdressMs hur många millisekunder anrop en sandlåda och en adress får använda per
  // minut, och maxPerAdress hur många levande sandlådor en adress får ha.
  maxSandladaMb = Number(process.env.MAX_SANDLADA_MB || 24),
  tidsbudgetSandladaMs = Number(process.env.TIDSBUDGET_SANDLADA_MS || 30_000),
  tidsbudgetAdressMs = Number(process.env.TIDSBUDGET_ADRESS_MS || 45_000),
  maxPerAdress = Number(process.env.MAX_PER_ADRESS || 150) } = {}) {
  if (maxSessioner) maxSandlador = maxSessioner;
  const sessioner = new Map();
  // Runda 12, r3: nyckeln som krypterar nycklarna för engångskoder, bredvid sessionsfilen så att den följer med en omstart.
  flerfaktor.satNyckel({ fil: sessionFil ? join(dirname(sessionFil), 'flerfaktor.nyckel') : null });
  const nyaPerIp = new Map();
  // Runda 7, r1.
  const anvandartestDb = anvandartestSvar.oppna(anvandartestFil);
  anvandartestSvar.stada(anvandartestDb);
  // Runda 12, r2: lagret med säkerhetskopior. Nyckeln som döljer sandlådornas id sparas bredvid kopiorna, aldrig i en
  // sandlåda, så att kopiorna hittas igen när servern har startat om.
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 1): ett tak för alla kopiornas diskutrymme (MAX_KOPIOR_MB).
  const kopior = skapaKopielager({ katalog: kopieKatalog, andraKatalog: kopieAndra, intervallMinuter: kopieMinuter, hemlighet: kopieNyckel(kopieKatalog), maxByte: Number(process.env.MAX_KOPIOR_MB || 4096) * 1048576 });
  const serverMatning = new Matning(1000);
  const startad = new Date().toISOString();

  const slumpId = () => Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
  const slumpNyckel = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const kakSid = (req) => (req.headers.get('cookie') || '').match(/(?:^|;\s*)vk_sid=([A-Za-z0-9_-]{32})(?:;|$)/)?.[1];
  const kaka = (sid) => `vk_sid=${sid}; Path=/; HttpOnly; SameSite=Lax${origin.startsWith('https') ? '; Secure' : ''}`;
  // Cloudflare skriver över cf-connecting-ip vid kanten. Rubriken gäller bara när LITA_PA_PROXY=1,
  // alltså när enda vägen in är tunneln och Caddy. Annars räknas socketens adress.
  const litaPaProxy = process.env.LITA_PA_PROXY === '1';
  const klientIp = (req, server) => (litaPaProxy && req.headers.get('cf-connecting-ip')) || server.requestIP(req)?.address || 'okänd';

  // Läskopian (D4): lasnyckel är nyckeln som webbläsaren krypterar sin läskopia och loggen från läsläget med. Den har ett
  // id, läskopians id. kopior håller för varje läskopia som sandlådan har lämnat ut reda på vem den gäller, nyckeln,
  // hur länge den gäller, vilka patienter som lämnades ut på vilken grund och när, och vilka rader från läsläget som
  // redan har tagits emot. En läskopia finns kvar efter utloggning och ny inloggning tills den går ut, så att loggen
  // från läsläget kan tas emot även när den kommer efter ett avbrott, från en ny flik eller efter en omstart av
  // webbläsaren. Nyckeln lämnas bara ut till den inloggade medan inloggningen pågår, aldrig senare.
  const nyLasnyckel = () => ({ id: slumpId(), nyckel: slumpNyckel(), giltigTill: new Date(Date.now() + SESSION_TTL).toISOString() });
  const aktuellKopia = (s) => (s.lasnyckel ? s.kopior.get(s.lasnyckel.id) ?? null : null);
  function rensaKopior(s, nu = Date.now()) {
    for (const [id, k] of s.kopior) if (Date.parse(k.giltigTill) + KLOCKMARGINAL < nu) { avslutaKopia(s, k, 'utgangen'); s.kopior.delete(id); }
    while (s.kopior.size > MAX_KOPIOR) { const id = s.kopior.keys().next().value; avslutaKopia(s, s.kopior.get(id), 'utgangen'); s.kopior.delete(id); }
  }
  // Läskopian förnyas av sig själv medan personen är inloggad (Sussa 11.2.1.8), men varje förnyelse loggas inte för
  // sig. Loggen visar när utlämnandet av en patient började (resurs lasekopia, när servern lämnade ut patienten första
  // gången och igen om grunden ändras) och när uppgifterna lämnades ut senast (resurs lasekopia:slut, med tiden för den
  // senaste förnyelsen och antalet förnyelser). Den sista raden skrivs när utlämnandet slutar: vid utloggning, ny
  // inloggning, när läskopian går ut eller när patienten inte längre hör till kopian.
  function avslutaUtlamnande(s, kopia, pid, orsak) {
    const u = kopia.patienter.get(pid);
    if (!u || u.slut) return;
    u.slut = true;
    const pers = s.db.query('SELECT * FROM personal WHERE id = ?').get(kopia.personalId);
    if (!pers) return;
    const fornyad = u.fornyad ?? 0;
    logg.loggaRad(s.db, {
      tid: u.senast ?? u.tid, personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: pid, handling: u.handling, resurs: 'lasekopia:slut', grund: u.grund,
      syfte: `Senaste utlämnandet till läskopian för avbrott. Uppgifterna förnyades ${fornyad} ${fornyad === 1 ? 'gång' : 'gånger'} efter att de lämnades ut. ${LASKOPIA_SLUT[orsak]}`,
      resultat: 'tillaten',
    });
  }
  function avslutaKopia(s, kopia, orsak) {
    if (!kopia) return;
    for (const pid of kopia.patienter.keys()) avslutaUtlamnande(s, kopia, pid, orsak);
  }
  // Ser till att den inloggade har en nyckel och en läskopia att föra loggen mot.
  function sakraKopia(s) {
    if (!s.personalId) return null;
    if (!aktuellKopia(s)) {
      s.lasnyckel = nyLasnyckel();
      s.kopior.set(s.lasnyckel.id, { personalId: s.personalId, nyckel: s.lasnyckel.nyckel, giltigTill: s.lasnyckel.giltigTill, patienter: new Map(), loggIds: new Set() });
      rensaKopior(s);
    }
    return aktuellKopia(s);
  }
  // personalId och invanareId är aldrig satta samtidigt: personalens och invånarens inloggning utesluter varandra.
  // Runda 12, r2: kopieId är sandlådans stabila id för säkerhetskopiorna. Det skapas med sandlådan och roteras aldrig,
  // till skillnad från sessionskakan, så att kopiorna hittas efter en ny inloggning.
  const nySession = () => medVila({ db: nySessionsDb(), personalId: null, invanareId: null, val: {}, sist: Date.now(), matning: new Matning(200), lasnyckel: null, oppnade: new Set(), kopior: new Map(), kopieId: slumpId() });
  // Runda 12, r2: en sandlåda som försvinner tar sina säkerhetskopior med sig. Runda 13, r2: och sin fil på disken.
  function taBortSandlada(sid) {
    const s = sessioner.get(sid);
    if (!s) return;
    s.dbOmVaken?.close();
    s.db = null;
    sessioner.delete(sid);
    pagande.delete(s);
    raknaAdress(s.adress, -1);
    kopior.radera(s.kopieId ?? sid);
    vilolager.radera(s.kopieId ?? sid);
  }
  // Läskopian som id:t gäller, i den sandlåda som lämnade ut den. Kräver ingen session: loggen från läsläget visar
  // själv att den kommer från den som hade läskopian, eftersom den är krypterad med läskopians nyckel. Runda 13, r2: en
  // sandlåda som vilar har läskopiornas id kvar i minnet och läses in när en av dem efterfrågas.
  function hittaKopia(id) {
    const nu = Date.now();
    for (const s of sessioner.values()) {
      if (s.vilar && !(s.kopiaIds ?? []).includes(id)) continue;
      if (s.vilar) vaknaSandlada(s);
      const k = s.kopior.get(id);
      if (k && Date.parse(k.giltigTill) + KLOCKMARGINAL >= nu) return { s, kopia: k };
    }
    return null;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Runda 13, r2: sandlådor som vilar på disk (sandlada-vila.js). Sessionen finns alltid kvar i minnet; bara databasen,
  // läskopiornas kopplingar och svarstiderna skrivs till disk. s.db läser in sandlådan igen när någon behöver den, så
  // att allt som pekar på sessionen (miljöer, biljetter, utrustningens nycklar, prenumerationer) gäller som förut.
  // s.rord är när databasen senast användes, s.anvand när besökaren senast gjorde något (bakgrundsanrop räknas inte).
  const vilaNyckel = kopieNyckel(vilaKatalog);
  const vilolager = vila.skapaVilolager({ katalog: vilaKatalog, hemlighet: vilaNyckel });
  // Runda 13, r2: besökarens adress sparas bara som HMAC med en hemlig nyckel.
  const adressHmac = (ip) => require('node:crypto').createHmac('sha256', vilaNyckel).update(`adress:${ip}`).digest('hex').slice(0, 32);
  const perAdress = new Map();
  const raknaAdress = (a, d) => { if (!a) return; const n = (perAdress.get(a) ?? 0) + d; if (n > 0) perAdress.set(a, n); else perAdress.delete(a); };
  // Tidsbudgeten: millisekunder anrop i fack om tio sekunder, för den senaste minuten.
  const nyttFonster = () => new Map();
  const laggTillTid = (f, ms, nu = Date.now()) => { const k = Math.floor(nu / 10_000); f.set(k, (f.get(k) ?? 0) + ms); for (const x of f.keys()) if (x < k - 5) f.delete(x); };
  const tidSenasteMinuten = (f, nu = Date.now()) => { if (!f) return 0; const k = Math.floor(nu / 10_000); let sum = 0; for (const [x, v] of f) if (x >= k - 5) sum += v; return sum; };
  const budgetAdress = new Map();
  function kravBudget(c, s) {
    if (c.adress && tidSenasteMinuten(budgetAdress.get(c.adress)) > tidsbudgetAdressMs) throw new Fel(429, 'Det har kommit många tunga anrop från din adress den senaste minuten. Vänta en stund och försök igen.', 'for_manga');
    if (s && tidSenasteMinuten(s.budget) > tidsbudgetSandladaMs) throw new Fel(429, 'Sandlådan har gjort många tunga anrop den senaste minuten. Vänta en stund och försök igen.', 'for_manga');
  }
  // Minnet: en sandlåda kostar sin databas och lika mycket till som en vanlig, men minst lika mycket som en vanlig.
  const PER_SANDLADA = vila.MATT.perSandladaMb * 1048576;
  const MALL_BYTE = 3.5 * 1048576;
  const minnesbudget = maxIMinnet * PER_SANDLADA;
  const kostnad = (s) => Math.max(PER_SANDLADA, (s.dbByte ?? MALL_BYTE) + PER_SANDLADA - MALL_BYTE);
  const minneVakna = () => { let sum = 0; for (const x of vakna) sum += kostnad(x); return sum; };
  // Taket för databasens storlek gäller varje gång en databas sätts i sandlådan (ny, inläst, återställd eller miljö).
  const satDbTak = (db) => { try { const ps = db.query('PRAGMA page_size').get().page_size; db.exec(`PRAGMA max_page_count = ${Math.floor(maxSandladaMb * 1048576 / ps)}`); } catch (e) { console.error('Taket för sandlådan:', e.message); } };
  const vakna = new Set();
  // Anrop som pågår per sandlåda. En sandlåda med ett pågående anrop flyttas aldrig till disk.
  const pagande = new Map();
  const bokningar = new WeakMap();
  const tryggMs = tryggSekunder * 1000;
  const vilaMs = vilaMinuter * 60_000;
  const maxDiskByte = maxDiskMb * 1048576;
  let overskridna = 0;
  function medVila(falt) {
    const { db: forsta = null, ...s } = falt;
    let db = null;
    s.rord = Date.now();
    s.anvand ??= s.sist ?? Date.now();
    Object.defineProperty(s, 'db', {
      enumerable: true, configurable: true,
      get() { s.rord = Date.now(); if (!db) vaknaSandlada(s); return db; },
      set(v) { db = v; if (v) { satDbTak(v); vakna.add(s); } else vakna.delete(s); },
    });
    Object.defineProperty(s, 'vilar', { enumerable: false, configurable: true, get: () => !db });
    Object.defineProperty(s, 'dbOmVaken', { enumerable: false, configurable: true, get: () => db });
    if (forsta) s.db = forsta;
    return s;
  }
  function boka(req, s) {
    if (!req || !s) return;
    pagande.set(s, (pagande.get(s) ?? 0) + 1);
    const b = bokningar.get(req);
    if (b) b.push(s); else bokningar.set(req, [s]);
  }
  function slappa(req) {
    for (const s of bokningar.get(req) ?? []) { const n = (pagande.get(s) ?? 1) - 1; if (n > 0) pagande.set(s, n); else pagande.delete(s); }
    bokningar.delete(req);
  }
  // Det som en vilande sandlåda behöver ha kvar i minnet för att hittas utan att läsas in: kalenderlänkarnas HMAC och
  // systemkontonas id.
  function vilaIndex(db) {
    const ut = { kalender: [], konton: [] };
    try { ut.kalender = db.query('SELECT hmac FROM kalenderlankar WHERE aterkallad IS NULL').all().map(r => r.hmac); } catch { /* inga kalenderlänkar */ }
    try { ut.konton = db.query('SELECT id FROM api_systemkonton').all().map(r => r.id); } catch { /* inga systemkonton */ }
    return ut;
  }
  const kopiorTillJson = (m) => [...m].map(([id, k]) => [id, { ...k, patienter: [...k.patienter], loggIds: [...k.loggIds] }]);
  const kopiorFranJson = (a) => new Map((a ?? []).map(([id, k]) => [id, { ...k, patienter: new Map(k.patienter), loggIds: new Set(k.loggIds) }]));
  // Skriver sandlådan till disk och släpper den ur minnet. Gör inget med en sandlåda som har ett pågående anrop.
  function vilaSandlada(s, { tvinga = false } = {}) {
    const db = s.dbOmVaken;
    if (!db || (!tvinga && pagande.get(s))) return false;
    try {
      vilolager.vila(s.kopieId, db.serialize(), { app: APPVERSION, kopior: kopiorTillJson(s.kopior), matning: [...s.matning.data] });
    } catch (e) { console.error('Sandlådan kunde inte skrivas till disk:', e.message); return false; }
    s.vilaIndex = vilaIndex(db);
    s.kopiaIds = [...s.kopior.keys()];
    db.close();
    s.db = null;
    s.kopior = null;
    s.matning = null;
    return true;
  }
  // Läser in en sandlåda som vilar. Gör plats i minnet först, och tar då den sandlåda som har varit oanvänd längst.
  function vaknaSandlada(s) {
    if (!s.vilar) return;
    if (!gorPlats(true, kostnad(s))) overskridna++;
    const ut = vilolager.vakna(s.kopieId);
    if (!ut) {
      const sid = sidFor(s);
      if (sid) taBortSandlada(sid);
      throw new Fel(500, 'Sandlådan kunde inte läsas in från disken. Ladda om sidan för att börja om i en ny sandlåda.', 'fel');
    }
    const db = Database.deserialize(ut.data);
    s.dbByte = ut.data.byteLength;
    // En sandlåda som vilade när programmet uppgraderades får de nya tabellerna.
    if (ut.meta.app !== APPVERSION) migrera(db);
    db.exec('PRAGMA foreign_keys = OFF');
    s.kopior = kopiorFranJson(ut.meta.kopior);
    s.matning = new Matning(200);
    for (const [k, v] of ut.meta.matning ?? []) s.matning.data.set(k, v);
    delete s.kopiaIds;
    delete s.vilaIndex;
    s.db = db;
    vilolager.radera(s.kopieId);
    rensaKopior(s);
  }
  // Ser till att det finns plats i minnet för en sandlåda till. En sandlåda som har använts de senaste tryggSekunder
  // flyttas inte för att ge plats åt en ny besökare; då svarar gorPlats false. För en besökare vars sandlåda vilar
  // (tvinga) räcker det att den andra inte har använts den senaste sekunden, och finns ingen sådan överskrids taket
  // tillfälligt, eftersom en sandlåda aldrig får tappas.
  function gorPlats(tvinga, behov = PER_SANDLADA) {
    while (vakna.size >= maxIMinnet || (vakna.size && minneVakna() + behov > minnesbudget)) {
      const nu = Date.now();
      let kandidat = null;
      for (const s of vakna) if (!pagande.get(s) && (!kandidat || s.rord < kandidat.rord)) kandidat = s;
      if (!kandidat) return false;
      const ledig = nu - kandidat.rord;
      if (ledig < tryggMs && !(tvinga && ledig >= 1000)) return false;
      if (!vilaSandlada(kandidat)) return false;
    }
    return true;
  }
  // Varför en ny besökare inte får en sandlåda just nu, eller null. Disken: taket för antalet sandlådor, taket för
  // diskutrymmet eller för lite ledigt på disken. Minnet: alla platser används just nu.
  function fullOrsak(nu = Date.now()) {
    const ledigt = vila.ledigtPaDisk(vilaKatalog);
    const disk = sessioner.size >= maxSandlador || vilolager.byte() + kopior.byte() >= maxDiskByte || (ledigt != null && ledigt < DISK_RESERV);
    if (disk) return { orsak: 'disk', forsokIgenSekunder: vila.forsokIgenOm([...sessioner.values()].map(x => x.sist + (x.harLoggatIn || x.ursprung ? SESSION_TTL : TOM_TTL)), nu) };
    if (!gorPlats(false)) return { orsak: 'minne', forsokIgenSekunder: vila.forsokIgenOm([...vakna].map(x => x.rord + tryggMs), nu, { max: 120 }) };
    return null;
  }
  const FULL_TEXT = 'Demon har många besökare just nu, och alla platser är upptagna. Varje besökare får en egen sandlåda, och de som redan arbetar får behålla sina. Det är tillfälligt.';
  function kravPlats() {
    const f = fullOrsak();
    if (f) throw new Fel(503, FULL_TEXT, 'demo_full', f);
  }
  // Flyttar sandlådor som inte har använts på vilaMinuter till disk. Körs varje minut.
  function vilaStadning(nu = Date.now()) {
    let n = 0;
    for (const s of [...vakna]) if ((s.anvand ?? s.sist) < nu - vilaMs && s.rord < nu - tryggMs && vilaSandlada(s)) n++;
    return n;
  }
  const kapacitet = () => ({
    iMinnet: vakna.size, maxIMinnet, minneMb: Math.round(minneVakna() / 1048576), minnesbudgetMb: Math.round(minnesbudget / 1048576), maxSandladaMb, vilar: sessioner.size - vakna.size, sandlador: sessioner.size, maxSandlador, vilaMinuter,
    diskMb: Math.round((vilolager.byte() + kopior.byte()) / 1048576 * 10) / 10, maxDiskMb, overskridna,
    minne: { rssMb: Math.round(process.memoryUsage().rss / 1048576), anvantMb: (x => (x ? Math.round(x / 1048576) : null))(vila.minneNu()), gransMb: (x => (x ? Math.round(x / 1048576) : null))(vila.minnesgrans()) },
  });

  function hamtaSession(req) {
    const sid = kakSid(req);
    const s = sid && sessioner.get(sid);
    if (!s) return null;
    // Runda 13, r2: anropet bokar sandlådan, så att den inte flyttas till disk medan anropet pågår, och läser in den om
    // den vilar.
    boka(req, s);
    if (s.vilar) vaknaSandlada(s);
    s.sist = Date.now();
    if (req.headers.get('x-vk-bakgrund') !== '1') s.anvand = s.sist;
    sessioner.delete(sid); sessioner.set(sid, s);
    kontrolleraInloggning(s, req);
    return { sid, s };
  }

  // Runda 7, r2 (K2 1.6.1, justerbar tidsgräns): inloggningen går ut efter en tid utan aktivitet, men sandlådan finns
  // kvar, så att utkast och annat som sparats finns efter en ny inloggning. Anrop som gränssnittet gör av sig självt
  // (förnyelsen av läskopian) har rubriken X-Vk-Bakgrund och räknas inte som aktivitet. Gränssnittet varnar fem
  // minuter innan, och knappen Fortsätt arbeta är ett anrop som räknas.
  const VARNING_MINUTER = 5;
  const inloggad = (s) => Boolean(s.personalId || s.invanareId);
  // Runda 8, r5: gränsen i minuter för sessionens inloggade, ur sandlådans parametrar. Ett fel i en äldre sandlåda ger
  // standardvärdet 30 minuter.
  const minuterFor = (s) => {
    if (inloggningMinuter) return inloggningMinuter;
    try { return konfiguration.varde(s.db, s.invanareId && !s.personalId ? 'sakerhet.utloggning_invanare_min' : 'sakerhet.utloggning_personal_min'); } catch { return 30; }
  };
  const inloggningMs = (s) => minuterFor(s) * 60_000;
  function kontrolleraInloggning(s, req) {
    const nu = Date.now();
    if (inloggad(s) && s.aktiv && nu - s.aktiv > inloggningMs(s)) loggaUtInaktiv(s);
    if (!s.aktiv || req.headers.get('x-vk-bakgrund') !== '1') s.aktiv = nu;
  }
  function loggaUtInaktiv(s) {
    const minuter = minuterFor(s);
    const fore = inloggade(s);
    const akt = aktuellKopia(s);
    if (akt) akt.stangd = new Date().toISOString();
    avslutaKopia(s, akt, 'utloggning');
    oppetApi.aterkalla(s, 'Åtkomstbiljetten återkallades när inloggningen gick ut efter en tid utan aktivitet.');
    s.personalId = null; s.uppdrag = null; s.invanareId = null; s.val = {}; s.lasnyckel = null; s.oppnade = new Set();
    try {
      sakerhetslogg.logga(s.db, { typ: 'utloggning', personal_id: fore.personal?.id ?? null, invanare_id: fore.invanare?.id ?? null, enhet_id: fore.personal?.enhet_id ?? null,
        beskrivning: `Utloggning efter ${minuter} minuter utan aktivitet.` });
    } catch (e) { console.error('Säkerhetsloggen:', e.message); }
  }
  // Runda 9, r5 (Sussa 5.2.1.8): behörigheten följer masterdata i varje anrop. När personen inte längre är aktiv eller
  // medarbetaruppdraget i biljetten inte stämmer med masterdata, till exempel efter byte av vårdenhet, avslutas
  // inloggningen som vid utloggning, och säkerhetsloggen får orsaken. Ingen behöver ta bort någon behörighet för hand.
  function loggaUtOgiltigtUppdrag(s, p, orsak) {
    const akt = aktuellKopia(s);
    if (akt) akt.stangd = new Date().toISOString();
    avslutaKopia(s, akt, 'utloggning');
    oppetApi.aterkalla(s, 'Åtkomstbiljetten återkallades när medarbetaruppdraget upphörde.');
    s.personalId = null; s.uppdrag = null; s.val = {}; s.lasnyckel = null; s.oppnade = new Set();
    s.utloggadOrsak = orsak;
    try {
      sakerhetslogg.logga(s.db, { typ: 'utloggning', personal_id: p?.id ?? null, enhet_id: p?.enhet_id ?? null, beskrivning: `Inloggningen avslutades av systemet: ${orsak}` });
    } catch (e) { console.error('Säkerhetsloggen:', e.message); }
  }
  const inloggningUt = (s) => (s && inloggad(s) ? { garUt: new Date((s.aktiv ?? Date.now()) + inloggningMs(s)).toISOString(), minuter: minuterFor(s), varningMinuter: VARNING_MINUTER } : null);
  function skapaSession(req, server) {
    // Runda 13, r2: när demon är full får besökaren veta när det är lönt att försöka igen. Det prövas före taket per
    // adress, så att sidan som försöker igen av sig själv inte förbrukar besökarens nya besök. Ingen sandlåda tas bort
    // för att ge plats.
    kravPlats();
    // Runda 13, r2: taket för levande sandlådor per adress.
    const adress = adressHmac(klientIp(req, server));
    if ((perAdress.get(adress) ?? 0) >= maxPerAdress) throw new Fel(429, `Det finns redan ${maxPerAdress} sandlådor från din adress. En sandlåda där ingen har loggat in försvinner efter en timme, och de andra efter åtta timmar utan användning.`, 'for_manga');
    const k = `${klientIp(req, server)}:${Math.floor(Date.now() / 3600_000)}`;
    const n = (nyaPerIp.get(k) ?? 0) + 1;
    nyaPerIp.set(k, n);
    if (n > nyaPerTimme) throw new Fel(429, 'För många nya besök från din adress. Försök igen om en stund.', 'nekad');
    const sid = slumpId();
    const s = nySession();
    s.adress = adress;
    raknaAdress(adress, 1);
    sessioner.set(sid, s);
    boka(req, s);
    return { sid, s, ny: true };
  }

  function stadning(nu = Date.now()) {
    const grans = nu - SESSION_TTL;
    // Runda 7, r1: testtillfällen utan aktivitet på 90 dagar raderas med sina svar.
    anvandartestSvar.stada(anvandartestDb);
    for (const [sid, s] of [...sessioner]) {
      // Runda 13, r2: en sandlåda där ingen har loggat in (och som inte är en miljö) försvinner efter en timme.
      const ttl = s.harLoggatIn || s.ursprung ? grans : nu - TOM_TTL;
      if (s.sist < ttl) { oppetApi.aterkalla(s, 'Åtkomstbiljetten återkallades när sessionen gick ut.'); taBortSandlada(sid); }
      // Runda 13, r2: en vilande sandlåda städas när den läses in igen.
      else if (!s.vilar) { rensaKopior(s); utdata.stadning(s.db); }
    }
    // Runda 6, r5: åtkomstbiljetter som har gått ut tas bort och loggas.
    oppetApi.stada();
    // Runda 12, r2.
    stadaKopior();
    // Runda 13, r2.
    try { vilolager.stada([...sessioner.values()].map(x => x.kopieId)); } catch (e) { console.error('De vilande sandlådorna kunde inte städas:', e.message); }
    const timme = Math.floor(nu / 3600_000);
    for (const k of nyaPerIp.keys()) if (!k.endsWith(`:${timme}`)) nyaPerIp.delete(k);
    // Runda 13, r2.
    for (const [a, f] of budgetAdress) if (!tidSenasteMinuten(f, nu)) budgetAdress.delete(a);
  }
  const stadningsTimer = setInterval(() => stadning(), 10 * 60_000);
  // Runda 13, r2: sandlådor som inte har använts på vilaMinuter flyttas till disk varje minut.
  const vilaTimer = setInterval(() => { try { vilaStadning(); } catch (e) { console.error('Vilan:', e.message); } }, 60_000);
  vilaTimer.unref?.();

  function lasSparade() {
    if (!sessionFil || !existsSync(sessionFil)) return;
    try {
      const grans = Date.now() - SESSION_TTL;
      for (const x of JSON.parse(readFileSync(sessionFil, 'utf8'))) {
        if (![SPARVERSION, SPARVERSION_VILA].includes(x.v) || x.sist < grans || !/^[A-Za-z0-9_-]{32}$/.test(x.sid)) continue;
        // Runda 13, r2: en sandlåda som vilade när servern stoppades har sin databas på disken och fortsätter vila.
        if (x.v === SPARVERSION_VILA) {
          if (typeof x.kopieId !== 'string' || !vilolager.finns(x.kopieId)) continue;
          sessioner.set(x.sid, medVila({
            personalId: x.personalId, uppdrag: x.uppdrag ?? null, invanareId: x.personalId ? null : x.invanareId ?? null, val: x.val ?? {}, sist: x.sist, aktiv: x.aktiv ?? x.sist, anvand: x.anvand ?? x.sist,
            lasnyckel: x.lasnyckel ?? null, oppnade: new Set(x.oppnade ?? []), kopieId: x.kopieId, kopiaIds: x.kopiaIds ?? [], vilaIndex: x.vilaIndex ?? { kalender: [], konton: [] },
            harLoggatIn: Boolean(x.harLoggatIn), kopior: null, matning: null,
            adress: typeof x.adress === 'string' ? x.adress : null, dbByte: Number(x.dbByte) || null,
          }));
          raknaAdress(sessioner.get(x.sid).adress, 1);
          continue;
        }
        const s = {
          db: lasSandlada(x.db), personalId: x.personalId, uppdrag: x.uppdrag ?? null, invanareId: x.personalId ? null : x.invanareId ?? null, val: x.val ?? {}, sist: x.sist, aktiv: x.aktiv ?? x.sist, matning: new Matning(200),
          lasnyckel: x.lasnyckel ?? null, oppnade: new Set(x.oppnade ?? []),
          // Runda 12, r2: en session som sparades före kopieId har sina kopior under sitt sid.
          kopieId: x.kopieId ?? x.sid,
          kopior: new Map((x.kopior ?? []).map(([id, k]) => [id, { ...k, patienter: new Map(k.patienter), loggIds: new Set(k.loggIds) }])),
        };
        // Sparat av en äldre version, med en nyckel utan id och en enda läskopia per session.
        if (s.lasnyckel && !s.lasnyckel.id && s.personalId) {
          s.lasnyckel = { id: slumpId(), ...s.lasnyckel };
          s.kopior.set(s.lasnyckel.id, { personalId: s.personalId, nyckel: s.lasnyckel.nyckel, giltigTill: s.lasnyckel.giltigTill, patienter: new Map(x.kopia ?? []), loggIds: new Set(x.kopiaLoggIds ?? []) });
        }
        // Runda 9, r5: en session från en version före biljetterna får uppdraget ur masterdata.
        if (s.personalId && !s.uppdrag) s.uppdrag = idp.uppdragUrMasterdata(s.db, s.db.query('SELECT * FROM personal WHERE id = ?').get(s.personalId));
        rensaKopior(s);
        // Runda 13, r2: en sandlåda från en äldre version läses in en i taget och skrivs genast till disk, så att alla inte
        // ligger i minnet samtidigt.
        s.harLoggatIn = true;
        const ms = medVila(s);
        sessioner.set(x.sid, ms);
        if (vilolager.typ === 'katalog') vilaSandlada(ms, { tvinga: true });
      }
      console.log(`Läste in ${sessioner.size} sparade sandlådor`);
    } catch (e) { console.error('Kunde inte läsa sparade sandlådor:', e.message); }
    try { unlinkSync(sessionFil); } catch { /* redan borta */ }
  }
  function spara() {
    if (!sessionFil) return 0;
    // Runda 13, r2: med en katalog för vilande sandlådor skrivs alla sandlådor dit, och sessionsfilen har bara
    // sessionerna, utan databaser.
    if (vilolager.typ === 'katalog') {
      for (const x of [...vakna]) vilaSandlada(x, { tvinga: true });
      const lista = [...sessioner].filter(([, x]) => x.vilar).map(([sid, x]) => ({
        v: SPARVERSION_VILA, sid, personalId: x.personalId, uppdrag: x.uppdrag ?? null, invanareId: x.invanareId, val: x.val, sist: x.sist, aktiv: x.aktiv, anvand: x.anvand,
        lasnyckel: x.lasnyckel, oppnade: [...x.oppnade], kopieId: x.kopieId, kopiaIds: x.kopiaIds, vilaIndex: x.vilaIndex, harLoggatIn: Boolean(x.harLoggatIn),
        adress: x.adress ?? null, dbByte: x.dbByte ?? null,
      }));
      writeFileSync(sessionFil + '.tmp', JSON.stringify(lista), { mode: 0o600 });
      renameSync(sessionFil + '.tmp', sessionFil);
      return lista.length;
    }
    for (const x of sessioner.values()) if (x.vilar) vaknaSandlada(x);
    const lista = [...sessioner].map(([sid, x]) => ({
      v: SPARVERSION, sid, personalId: x.personalId, uppdrag: x.uppdrag ?? null, invanareId: x.invanareId, val: x.val, sist: x.sist, aktiv: x.aktiv, db: Buffer.from(x.db.serialize()).toString('base64'),
      lasnyckel: x.lasnyckel, oppnade: [...x.oppnade], kopieId: x.kopieId,
      kopior: [...x.kopior].map(([id, k]) => [id, { ...k, patienter: [...k.patienter], loggIds: [...k.loggIds] }]),
    }));
    writeFileSync(sessionFil + '.tmp', JSON.stringify(lista), { mode: 0o600 });
    renameSync(sessionFil + '.tmp', sessionFil);
    return lista.length;
  }
  lasSparade();
  // Runda 12, r2: schemalagda säkerhetskopior av sandlådorna som har ändrats sedan sin senaste kopia.
  // Runda 13, r2 (fynd 1): en sandlåda i taget, och en vilande sandlåda kopieras från disken utan att läsas in.
  let kopierar = false;
  const kopieSchema = kopieMinuter > 0 ? setInterval(() => {
    if (kopierar) return;
    kopierar = true;
    schemalagdaStegvis(kopior, sessioner, new Date(), { vilande: (x) => vilolager.data(x.kopieId) }).catch(e => console.error('Säkerhetskopiorna:', e.message)).finally(() => { kopierar = false; });
  }, kopieMinuter * 60_000) : null;
  // Kopior för sandlådor som inte finns (till exempel efter en omstart utan sparade sandlådor) tas bort.
  const stadaKopior = () => { try { kopior.stada([...sessioner.values()].map(s => s.kopieId)); } catch (e) { console.error('Kopiorna kunde inte städas:', e.message); } };
  stadaKopior();
  kopieSchema?.unref?.();
  // Runda 13, r2: filer för vilande sandlådor som inte finns (till exempel efter en omstart utan sessionsfil) tas bort.
  try { vilolager.stada([...sessioner.values()].map(x => x.kopieId)); } catch (e) { console.error('De vilande sandlådorna kunde inte städas:', e.message); }

  function kontrolleraOrigin(req) {
    if (!origin) return;
    const o = req.headers.get('origin');
    if (o) { if (o !== origin) throw new Fel(403, 'Förfrågan kom från fel ursprung.', 'nekad'); return; }
    const ref = req.headers.get('referer');
    if (!ref || !(ref === origin || ref.startsWith(origin + '/'))) throw new Fel(403, 'Förfrågan saknar ursprung.', 'nekad');
  }

  async function lasKropp(req) {
    const langd = Number(req.headers.get('content-length') || 0);
    if (langd > MAX_KROPP) throw new Fel(413, 'För stor förfrågan.', 'ogiltig');
    const txt = await req.text();
    if (txt.length > MAX_KROPP) throw new Fel(413, 'För stor förfrågan.', 'ogiltig');
    if (!txt.trim()) return {};
    if (!(req.headers.get('content-type') || '').startsWith('application/json')) throw new Fel(415, 'Förväntade JSON.', 'ogiltig');
    let v;
    try { v = JSON.parse(txt); } catch { throw new Fel(400, 'Ogiltig JSON.', 'ogiltig'); }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Fel(400, 'Förväntade ett JSON-objekt.', 'ogiltig');
    return v;
  }

  const valFor = (s, pid) => {
    const v = s.val[pid] ?? {};
    return Object.fromEntries(VAL_TYPER.map(t => [t, Boolean(v[t])]));
  };
  const personalRad = (db, id) => (id ? db.query('SELECT * FROM personal WHERE id = ?').get(id) : null);
  const enhetKort = (db, id) => {
    const e = db.query('SELECT * FROM enheter WHERE id = ?').get(id);
    return e ? { id: e.id, namn: e.namn, hsaId: e.hsa_id } : null;
  };
  // En journal som har slagits samman med en annan leder till den gällande journalen (Sussa 3.1.1.2).
  const patientRad = (db, id) => {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(identitet.gallandeId(db, id));
    if (!p) throw new Fel(404, 'Patienten finns inte.', 'saknas');
    return p;
  };

  // Patientens namn och personnummer, maskerade för skyddad identitet, för listor utanför journalen.
  const patientKort = (p) => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) });

  // roll är personal (simulerat SITHS-kort) eller invanare (simulerad e-legitimation, Min journal). Invånaren får
  // ingen nyckel till läskopian och inga behörigheter för personalens handlingar.
  function sessionUt(s) {
    const p = personalRad(s.db, s.personalId);
    const inv = p ? null : minJournal.invanareRad(s.db, s.invanareId);
    const ut = { inloggad: Boolean(p || inv), demoDatum: installning(s.db, 'seed_datum') ?? idag() };
    // Runda 9, r5 (KD1.1.1.5): vilken miljö sandlådan är, så att gränssnittet kan märka den.
    ut.miljo = miljoer.miljoFor(s.db);
    // Runda 7, r2: när inloggningen går ut utan aktivitet, så att gränssnittet kan varna.
    if (p || inv) ut.inloggning = inloggningUt(s);
    // Runda 12, r3: om flerfaktor är på för den inloggade och hur inloggningen bekräftades, eller att en inloggning
    // väntar på den andra faktorn.
    if (p || inv) ut.flerfaktor = { aktiv: flerfaktor.kravs(s.db, p ? 'personal' : 'invanare', p ? p.id : inv.id), metod: s.flerfaktorMetod ?? null };
    else if (s.vantande && s.vantande.utgar > Date.now()) ut.flerfaktorVantar = { typ: s.vantande.typ, namn: s.vantande.namn, metoder: flerfaktor.metoder(s.db, s.vantande.typ, s.vantande.id) };
    if (inv) Object.assign(ut, { roll: 'invanare' }, minJournal.sessionDel(s.db, inv));
    if (p) {
      const ve = vardenhetFor(s.db, p.enhet_id);
      ut.roll = 'personal';
      ut.personal = { id: p.id, namn: p.namn, yrke: p.yrke, yrkeText: YRKEN[p.yrke], titel: p.titel, hsaId: p.hsa_id };
      ut.enhet = { ...enhetKort(s.db, p.enhet_id), vardenhet: enhetKort(s.db, ve) };
      ut.behorigheter = ROLLER[p.yrke] ?? [];
      // Runda 9, r5: medarbetaruppdraget ur biljetten från autentiseringstjänsten.
      ut.uppdrag = idp.uppdragUt(s.db, s.uppdrag);
      // Undersköterskan har behörigheten att ge läkemedel bara med en giltig delegering i dag (runda 5).
      if (p.yrke === 'underskoterska' && !delegering.giltigNu(s.db, p).giltig) ut.behorigheter = ut.behorigheter.filter(h => h !== 'ge_lakemedel');
      // Runda 6, r3: om personalen arbetar på en vårdenhet med psykiatrisk tvångsvård.
      ut.r3 = r3.session(s.db, p);
      // Runda 7, r6: om personalens vårdenhet har barnhälsovård.
      ut.bhv = bhvSession(s.db, p);
      // Runda 9, r2: om personalens vårdenhet har en intensivvårdsavdelning.
      ut.iva = ivaSession(s.db, p);
      // Runda 11, r2: om personalens vårdenhet opererar, så att menyn visar operationsavdelningen.
      ut.operation = require('./operation.js').session(s.db, p);
      // Runda 11, r3: om personalens vårdenhet har mödrahälsovård eller förlossning (obstetrik.js).
      ut.obstetrik = r11r3Session(s.db, p);
      // Runda 11, r4: beredningsenheten och vårdenheter som ger cytostatika.
      ut.r11r4 = r11r4.session(s.db, p);
      sakraKopia(s);
      ut.lasnyckel = s.lasnyckel;
    }
    return ut;
  }

  // Kontext och loggning för en patient. Fel kastas vidare; nekade försök loggas i Atkomst.krav.
  function medPatient(c, pid, handling, fn) {
    const p = patientRad(c.db, pid);
    const atk = new Atkomst(c.db, c.personal, p.id, valFor(c.s, p.id), handling);
    const ut = fn(atk, p);
    if (!atk.loggad) atk.logga(handling, atk.grund(), c.url.pathname);
    return ut;
  }

  function patientHuvud(c, atk, p) {
    const db = c.db;
    const val = valFor(c.s, p.id);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    const r = atk.krav(handling);
    const min = vardenhetFor(db, c.personal.enhet_id);
    const sparrar = aktivaSparrar(db, p.id);
    const enheter = new Set(db.query(`SELECT enhet_id FROM anteckningar WHERE patient_id = ?1 UNION SELECT enhet_id FROM diagnoser WHERE patient_id = ?1
      UNION SELECT enhet_id FROM matvarden WHERE patient_id = ?1 UNION SELECT enhet_id FROM vardkontakter WHERE patient_id = ?1`).all(p.id).map(x => vardenhetFor(db, x.enhet_id)));
    const andra = [...enheter].filter(e => e !== min && !sparrar.includes(e));
    const visad = p.skyddad ? val.visa_identitet : true;
    const listning = db.query('SELECT * FROM listningar WHERE patient_id = ?').get(p.id);
    return {
      id: p.id, namn: visningsnamn(p, val.visa_identitet), personnummer: visningsPnr(p, val.visa_identitet), alder: alder(p.fodd, idag()),
      kon: p.kon, skyddad: Boolean(p.skyddad), identitetVisad: Boolean(p.skyddad && val.visa_identitet),
      overkanslighet: journal.synligOverkanslighet(atk), sparrmarkering: r.spärrade, grund: r.grund,
      harAndraEnheter: andra.length > 0, andraEnheterVisade: Boolean(val.andra_enheter || r.grund === 'nodatkomst'),
      nodatkomst: Boolean(val.nodatkomst), samtyckeSparr: Boolean(val.samtycke_sparr), visad,
      listning: listning ? { enhet: enhetKort(db, listning.enhet_id), fran: listning.fran } : null,
      uppmarksamhet: uppmarksamhet.forHuvud(atk),
      // Runda 6, r1: basfakta som ett och samma objekt i huvudet och i GET /api/patient/:id/basfakta (Sussa 3.1.6).
      basfakta: vitalparametrar.basfakta(atk, p),
      ...identitetIHuvud(c, p),
      ...utdata.huvud(db, p),
      // Runda 10, r4: en avliden patient är märkt med datum (avliden.js).
      avliden: avlidenFor(db, p.id),
      // Runda 11, r2: syftet som dialogen för aktivt val förväljer för anestesienheten (operation.js).
      aktivtValSyfte: require('./operation.js').aktivtValSyfte(db, c.personal, p.id),
      // Runda 11, r4: om patienten har cytostatika eller blod som den inloggade får se, för flikarna.
      ...r11r4.huvud(atk),
    };
  }

  // Identiteten (Sussa 3.1.1): typ, antal tidigare identiteter och, för den som kan slå samman journaler, hur många
  // troliga dubbletter systemet har hittat.
  function identitetIHuvud(c, p) {
    const typ = p.id_typ ?? 'personnummer';
    return {
      identitet: { typ, typText: identitet.TYPER[typ].text },
      tidigareIdentiteter: c.db.query("SELECT count(*) AS n FROM identiteter WHERE patient_id = ? AND status = 'tidigare'").get(p.id).n,
      dubbletter: kanRoll(c.personal, 'sla_samman') ? identitet.dubbletterFor(c.db, p.id).length : 0,
    };
  }

  function oversikt(c, atk, p) {
    const db = c.db;
    const pers = c.personal;
    atk.krav(kanRoll(pers, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
    const ord = kanRoll(pers, 'las_lakemedel') ? lakemedel.synligaOrdinationer(atk) : null;
    const dia = kanRoll(pers, 'las_diagnoser') ? journal.synligaDiagnoser(atk) : null;
    const mv = kanRoll(pers, 'las_matvarden') ? journal.synligaMatvarden(atk) : null;
    const kanAnt = kanRoll(pers, 'las_journal') || kanRoll(pers, 'las_omvardnad');
    const ant = kanAnt ? journal.listaAnteckningar(atk).anteckningar : null;
    const rem = (kanRoll(pers, 'las_remiss') || kanRoll(pers, 'las_remiss_status')) ? remiss.forPatient(atk).remisser : null;
    const vk = journal.synligaVardkontakter(atk);
    const tidslinje = [
      ...vk.map(v => ({ tid: v.start, typ: 'vardkontakt', rubrik: v.orsak, text: v.plats, enhet: enhetKort(db, v.enhet_id), kalla: v.kalla, kallaEtikett: journal.kallaEtikett(v.kalla, v.start), ref: { typ: 'vardkontakt', id: v.id } })),
      ...(ant ?? []).map(a => ({ tid: a.signerad?.tid ?? a.skapad, typ: 'anteckning', rubrik: a.typ, text: a.sammanfattning, enhet: a.enhet, kalla: a.kalla, kallaEtikett: a.kallaEtikett, ref: { typ: 'anteckning', id: a.id } })),
      ...(ord ?? []).flatMap(o => {
        const u = lakemedel.ordinationUt(db, o, { historik: false });
        const h = [{ tid: o.skapad, typ: 'ordination', rubrik: `Ordinerat: ${u.lakemedel?.namn}`, text: `${u.dosering}. ${u.ordinationsorsak}`, enhet: u.vardenhet, kalla: o.kalla, kallaEtikett: u.kallaEtikett, ref: { typ: 'ordination', id: o.id } }];
        if (o.utsatt_tid) h.push({ tid: o.utsatt_tid, typ: 'ordination', rubrik: `Utsatt: ${u.lakemedel?.namn}`, text: o.utsatt_orsak, enhet: u.vardenhet, kalla: 'vardkallan', kallaEtikett: null, ref: { typ: 'ordination', id: o.id } });
        return h;
      }),
      ...(rem ?? []).map(r => ({ tid: r.tider.skickad, typ: 'remiss', rubrik: `Remiss till ${r.till.namn}`, text: r.fragestallning ?? r.status, enhet: r.fran, kalla: r.kalla, kallaEtikett: r.kallaEtikett, ref: { typ: 'remiss', id: r.id } })),
      // Runda 10, r5: uppgifter från en annan vårdgivare genom sammanhållen journalföring, efter samtycke och aktivt val.
      ...sammanhallen.tidslinje(atk, c.s),
      // Runda 10, r4: in- och utfarter och skannade restjournaler, med samma behörighet som deras egna vyer.
      ...r10r4Tidslinje(atk),
    ].sort((a, b) => String(b.tid).localeCompare(String(a.tid)));
    // Vårdkontakter, vårdtillfällen och hälsoärenden (vardkontakt.js), byggt av det som redan är filtrerat ovan.
    const vardstruktur = vardkontakt.oversiktDel(atk, { vk, ant, dia, mv, ord, rem });
    return {
      lakemedel: ord ? ord.filter(lakemedel.aktuell).map(o => lakemedel.ordinationUt(db, o, { historik: false })) : null,
      diagnoser: dia ? dia.map(d => journal.diagnosUt(db, d)) : null,
      matvarden: mv ? journal.senastePerTyp(mv).map(m => journal.matvardeUt(db, m)) : null,
      anteckningar: ant ? ant.slice(0, 5) : null,
      remisser: rem ? rem.filter(r => r.status !== 'svar_kvitterat' && r.beslut !== 'avvisad') : null,
      tidslinje: vardkontakt.berikaTidslinje(db, tidslinje, vardstruktur, vk),
      vardkontakter: vk.map(v => vardkontakt.kontaktUt(db, v, pers)),
      vardstruktur,
      kontakt: { adress: p.skyddad ? null : p.adress, postnr: p.skyddad ? null : p.postnr, ort: p.skyddad ? null : p.ort, telefon: p.skyddad ? null : p.telefon, kontaktperson: p.skyddad ? null : p.kontaktperson },
      // Runda 7, r4: undantagna uppgifter står med antal och motivering (undantag.js).
      dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr, undantagna: undantag.undantagnaUt(atk) },
      // Runda 6, r3: vårdplaner, tvångsvård, samordnad planering och förslag om hälsoärenden (r3-rutter.js).
      r3: r3.oversikt(atk),
      // Runda 8, r5: den senaste anteckningen om tobaksvanor bland dem som syns (tobak.js).
      tobak: kanRoll(pers, 'las_omvardnad') ? tobak.oversiktDel(db, ant) : null,
      // Runda 9, r7: den senaste anteckningen om levnadsvanor bland dem som syns (levnadsvanor.js).
      levnadsvanor: kanRoll(pers, 'las_omvardnad') ? levnadsvanor.oversiktDel(db, ant) : null,
      // Runda 9, r7: systemets rekommendation när patienten ingår i en folkhälsoinsats på vårdenheten (folkhalsa.js).
      folkhalsa: folkhalsa.forPatient(atk),
    };
  }

  function arbetslista(c) {
    const db = c.db;
    const p = c.personal;
    if (p.yrke === 'logggranskare') return [];
    // Runda 6, r6: verksamhetschefen läser inte journalen och har ingen arbetslista.
    if (p.yrke === 'verksamhetschef') return [];
    // Runda 7, r4: systemförvaltaren läser inte journalen.
    if (p.yrke === 'systemforvaltare') return [];
    const ve = vardenhetFor(db, p.enhet_id);
    const enheter = db.query("SELECT id FROM enheter WHERE id = ? OR (forald_id = ? AND typ = 'arbetsplats')").all(ve, ve).map(r => r.id);
    const ph = enheter.map(() => '?').join(', ');
    const ids = new Set([
      ...db.query(`SELECT patient_id FROM vardkontakter WHERE enhet_id IN (${ph})`).all(...enheter),
      ...db.query(`SELECT patient_id FROM listningar WHERE enhet_id IN (${ph})`).all(...enheter),
      ...db.query('SELECT patient_id FROM remisser WHERE till_enhet_id = ? OR fran_enhet_id = ?').all(ve, ve),
    ].map(r => r.patient_id));
    const larm = remiss.larmForEnhet(db, p);
    const nll = lakemedel.nllAvvikelser(db, p);
    const ut = [];
    for (const id of ids) {
      if (!harVardrelation(db, id, ve)) continue;
      const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(id);
      // En planerad kontakt längre fram (en bokning i tidboken) är inte pågående.
      const vk = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND slut IS NULL
        AND NOT (coalesce(planerad, 0) = 1 AND ankomst IS NULL AND start > ?) ORDER BY start DESC`).get(id, ...enheter, new Date(Date.now() + 3600_000).toISOString());
      const inkRemiss = db.query("SELECT * FROM remisser WHERE patient_id = ? AND till_enhet_id = ? AND status <> 'svar_kvitterat' ORDER BY skickad_tid DESC").get(id, ve);
      const list = db.query(`SELECT 1 FROM listningar WHERE patient_id = ? AND enhet_id IN (${ph})`).get(id, ...enheter);
      ut.push({
        id, namn: visningsnamn(pat), personnummer: visningsPnr(pat), alder: alder(pat.fodd, idag()), kon: pat.kon,
        plats: vk ? vk.plats : inkRemiss ? 'Inkommande remiss' : list ? 'Listad' : 'Nyligen avslutad kontakt',
        orsak: vk?.orsak ?? (inkRemiss && kanRoll(p, 'las_remiss') ? inkRemiss.fragestallning : null),
        skyddad: Boolean(pat.skyddad), larm: larm.filter(l => l.patientId === id).length + nll.filter(n => n.patientId === id).length,
        pagaende: Boolean(vk), vardform: vk?.typ ?? null,
        uppmarksamhet: uppmarksamhet.symbolFor(db, p, id, valFor(c.s, id)),
      });
    }
    const ordning = { slutenvard: 0, akut: 1, oppenvard: 2 };
    return ut.sort((a, b) => (ordning[a.vardform] ?? 3) - (ordning[b.vardform] ?? 3) || a.namn.localeCompare(b.namn, 'sv'));
  }

  function sok(c, q) {
    const db = c.db;
    const atk = new Atkomst(db, c.personal, null, {}, 'sok');
    atk.krav('sok');
    const fraga = String(q ?? '').trim().slice(0, 60);
    if (fraga.length < 2) throw new Fel(400, 'Skriv minst två tecken.', 'ogiltig', { falt: ['q'] });
    const siffror = fraga.replace(/[-\s]/g, '');
    // Systemet avgör självt om frågan är ett nummer (personnummer, samordningsnummer, reservnummer eller OID) eller ett
    // namn, och hittar patienten också på en tidigare identitet (Sussa 3.1.1).
    const t = identitet.tolka(fraga);
    const traffar = new Map();
    let rader;
    if (/^\d{6,9}$/.test(siffror)) {
      // Början av ett nummer. Skyddade patienter hittas bara på fullständigt nummer.
      rader = db.query('SELECT * FROM patienter WHERE sammanslagen_till IS NULL AND (personnummer LIKE ? OR substr(personnummer, 3) LIKE ?) AND skyddad = 0 ORDER BY personnummer LIMIT 20').all(`${siffror}%`, `${siffror}%`);
    } else if (t.arIdentitet) {
      if (!t.ok) throw new Fel(400, t.fel, 'ogiltig', { falt: ['q'] });
      const h = identitet.hittaPaIdentitet(db, t);
      rader = h ? [patientRad(db, h.patientId)] : [];
      if (h && h.identitet.status !== 'gallande') traffar.set(h.patientId, { typText: identitet.TYPER[t.typ].text, status: h.identitet.status });
    } else {
      // SQLite:s lower() hanterar bara ASCII, så namnen jämförs här med svensk gemenisering.
      const sv = (s) => s.toLocaleLowerCase('sv-SE');
      const m = sv(fraga);
      rader = db.query('SELECT * FROM patienter WHERE skyddad = 0 AND sammanslagen_till IS NULL').all()
        .filter(p => sv(`${p.fornamn} ${p.efternamn}`).includes(m))
        .sort((a, b) => a.efternamn.localeCompare(b.efternamn, 'sv') || a.fornamn.localeCompare(b.fornamn, 'sv'))
        .slice(0, 20);
    }
    const ve = vardenhetFor(db, c.personal.enhet_id);
    atk.logga('sok', atk.grund(), `sok:${fraga} (${rader.length} träffar)`);
    return rader.map(p => ({ id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), alder: alder(p.fodd, idag()), kon: p.kon, skyddad: Boolean(p.skyddad), vardrelation: harVardrelation(db, p.id, ve),
      identitetstyp: p.id_typ ?? 'personnummer', typText: identitet.TYPER[p.id_typ ?? 'personnummer'].text, traffPa: traffar.get(p.id) ?? null,
      // Runda 6, r1: uppmärksamhetssymbolen med samma regler som i patienthuvudet (Sussa 3.1.5.2).
      uppmarksamhet: uppmarksamhet.symbolFor(db, c.personal, p.id, valFor(c.s, p.id)),
      // Runda 10, r4: en avliden patient är märkt med datum också i sökningen.
      avliden: avlidenFor(db, p.id) }));
  }

  function vantrum(c) {
    const db = c.db;
    const atk = new Atkomst(db, c.personal, null, {}, 'vantrum');
    atk.krav('vantrum');
    const akut = vardenhetFor(db, c.personal.enhet_id) === 'uso-akut';
    const nu = Date.now();
    return db.query("SELECT * FROM vantrum WHERE status = 'vantar' ORDER BY ankomst").all().map(v => {
      const p = db.query('SELECT * FROM patienter WHERE id = ?').get(v.patient_id);
      const rad = { konummer: v.konummer, ankomst: v.ankomst, prioritet: v.prioritet, status: v.status, vantetidMin: Math.max(0, Math.round((nu - Date.parse(v.ankomst)) / 60000)), uppropning: `Nummer ${v.konummer}` };
      if (akut) Object.assign(rad, { patientId: p.id, skyddad: Boolean(p.skyddad), namn: p.skyddad ? null : visningsnamn(p), orsak: v.orsak, uppmarksamhet: uppmarksamhet.symbolFor(db, c.personal, p.id, valFor(c.s, p.id)) });
      return rad;
    });
  }

  // Läskopian för avbrott (D4). Den byggs med exakt samma funktioner och samma behörighetskontroll som de vanliga
  // anropen, en Atkomst per del precis som när gränssnittet hämtar dem, så den innehåller aldrig mer än servern redan
  // lämnar ut till den inloggade. Patienter som den inloggade inte får öppna hoppas över utan att något loggas som nekat.
  // Med kommer patienterna på arbetslistan och de patienter personen har öppnat under sessionen. Att en patient lämnas
  // ut till läskopian loggas en gång per inloggning, och igen om grunden ändras (till exempel efter ett aktivt val).
  function lasekopia(c) {
    const db = c.db;
    const pers = c.personal;
    const s = c.s;
    const kopia = sakraKopia(s);
    const { lasnyckel: _, ...session } = sessionUt(s);
    const alla = db.query('SELECT * FROM enheter').all();
    // Runda 7, r4: en enhet som har stängts vid en omorganisation är märkt, så att den inte går att välja som mottagare.
    const nod = (e) => ({ id: e.id, hsaId: e.hsa_id, namn: e.namn, kortnamn: e.kortnamn, typ: e.typ, ...(omorganisation.arStangd(c.db, e.id) ? { stangd: true } : {}), barn: alla.filter(b => b.forald_id === e.id).map(nod) });
    const ut = {
      kopiaId: s.lasnyckel.id, skapad: new Date().toISOString(), giltigTill: s.lasnyckel.giltigTill, session,
      fornyas: { intervallMs: LASKOPIA_FORNYA_MS, lakemedelMaxMs: LASKOPIA_LAKEMEDEL_MAX_MS },
      enheter: alla.filter(e => !e.forald_id).map(nod), mallar: journal.MALLAR, arbetslista: [], patienter: {},
    };
    if (pers.yrke === 'logggranskare') return ut;
    ut.arbetslista = arbetslista(c);
    const ids = [...new Set([...ut.arbetslista.map(x => x.id), ...s.oppnade])];
    for (const pid of ids) {
      const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
      if (!pat) continue;
      const handling = kanRoll(pers, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
      const val = valFor(s, pid);
      const delar = [];
      const ny = (h = handling) => { const a = new Atkomst(db, pers, pid, val, h); delar.push(a); return a; };
      if (!ny().prova(handling).tillaten) continue;
      // Runda 10, r2: översikten i läskopian har samma vy som i appen (presentationsvyer.js).
      const ovAtk = ny();
      const post = { handling, huvud: patientHuvud(c, ny(), pat), oversikt: presentationsvyer.medVy(ovAtk, oversikt(c, ovAtk, pat)), lakemedel: null, lakemedelsdel: null, anteckningar: null, anteckning: {} };
      // Läkemedelsdelen har en egen tid per patient, så att läsläget kan visa hur gammal den är.
      const lmTid = new Date().toISOString();
      const lmDelar = Object.entries(LASKOPIA_LAKEMEDEL).filter(([, d]) => kanRoll(pers, d.handling));
      for (const [namn, d] of lmDelar) post[namn] = d.hamta(ny(d.handling));
      if (lmDelar.length) post.lakemedelsdel = { tid: lmTid, delar: Object.fromEntries(lmDelar.map(([namn, d]) => [namn, d.handling])) };
      // Runda 10, r1: mätvärdena och remisserna för de roller som får läsa dem.
      const jDelar = Object.entries(LASKOPIA_JOURNAL).map(([namn, d]) => [namn, d, d.handling(pers)]).filter(([, , h]) => kanRoll(pers, h));
      for (const [namn, d, h] of jDelar) post[namn] = d.hamta(ny(h), pat);
      if (jDelar.length) post.journaldel = { delar: Object.fromEntries(jDelar.map(([namn, , h]) => [namn, h])) };
      if (kanRoll(pers, 'las_journal') || kanRoll(pers, 'las_omvardnad')) {
        const l = journal.listaAnteckningar(ny('las_journal'));
        const senaste = l.anteckningar.slice(0, LASKOPIA_ANTECKNINGAR);
        post.anteckningar = { anteckningar: senaste, dolda: l.dolda, iLaskopian: senaste.length, totalt: l.anteckningar.length };
        for (const a of senaste) post.anteckning[a.id] = utdata.anteckning(db, pers, journal.hamtaAnteckning(ny(journal.lasHandling(a.kategori)), journal.hamtaAnteckningRad(db, a.id)));
      }
      const grunder = new Set(delar.flatMap(a => [...a.grunder]));
      const grund = starkasteGrund(grunder, pers.yrke === 'vardadministrator' ? 'administrativ' : 'vardrelation');
      const forra = kopia.patienter.get(pid);
      const borjar = !forra || forra.slut;
      if (borjar || forra.grund !== grund) delar[0].logga(handling, grund, 'lasekopia', 'tillaten', 'Läskopia för avbrott, krypterad i webbläsaren. Den förnyas automatiskt medan inloggningen pågår, och när förnyelsen slutar loggas när uppgifterna lämnades ut senast.');
      kopia.patienter.set(pid, { grund, handling, tid: forra?.tid ?? ut.skapad, senast: ut.skapad, fornyad: borjar ? 0 : (forra.fornyad ?? 0) + 1 });
      ut.patienter[pid] = post;
    }
    // Patienter som inte längre hör till läskopian finns inte i den nya kopian, och utlämnandet av dem har slutat.
    for (const pid of kopia.patienter.keys()) if (!ut.patienter[pid]) avslutaUtlamnande(s, kopia, pid, 'utanfor');
    return ut;
  }

  // Åtkomster som gjordes i läsläget, när servern inte svarade, tas emot i efterhand. Bara åtkomster till patienter som
  // servern har lämnat ut till läskopian, bara läshandlingar som rollen har och bara tider inom läskopians giltighet.
  // Raden loggas på den person som läskopian lämnades ut till, aldrig på den som råkar vara inloggad när den kommer.
  // Läsningar efter att personen loggade ut tas inte emot. Varje rad har ett id från webbläsaren, så att en rad som
  // skickas två gånger loggas en gång. skillnad är hur många millisekunder webbläsarens klocka gick fel när raderna
  // skickades; tiden rättas med den, och det står i syftet.
  function taEmotRader(db, pers, kopia, rader, skillnad = 0) {
    const nu = Date.now();
    const syfte = skillnad
      ? `Läsläge vid avbrott, läskopia i webbläsaren. Tiden är rättad, eftersom webbläsarens klocka gick fel med ${Math.round(Math.abs(skillnad) / 60_000)} minuter.`
      : 'Läsläge vid avbrott, läskopia i webbläsaren';
    let mottagna = 0;
    const avvisade = [];
    for (const r of rader) {
      const id = typeof r?.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(r.id) ? r.id : null;
      if (!id) { avvisade.push({ id: null, orsak: 'Raden saknar giltigt id.' }); continue; }
      if (kopia?.loggIds.has(id)) { mottagna++; continue; }
      const utlamnad = kopia && pers && typeof r.patientId === 'string' ? kopia.patienter.get(r.patientId) : null;
      if (!utlamnad) { avvisade.push({ id, orsak: 'Patienten fanns inte i din läskopia.' }); continue; }
      if (!LASLAGE_HANDLINGAR.includes(r.handling) || !kanRoll(pers, r.handling)) { avvisade.push({ id, orsak: 'Handlingen är inte en läsning som din yrkesroll får göra.' }); continue; }
      const t = (typeof r.tid === 'string' ? Date.parse(r.tid) : NaN) + skillnad;
      if (!Number.isFinite(t) || t < Date.parse(utlamnad.tid) - KLOCKMARGINAL || t > nu + KLOCKMARGINAL || t < nu - SESSION_TTL || t > Date.parse(kopia.giltigTill) + KLOCKMARGINAL) {
        avvisade.push({ id, orsak: 'Tidpunkten ligger utanför läskopians giltighet.' }); continue;
      }
      if (kopia.stangd && t > Date.parse(kopia.stangd) + KLOCKMARGINAL) { avvisade.push({ id, orsak: 'Läsningen gjordes efter utloggningen.' }); continue; }
      if (kopia.loggIds.size >= MAX_LASLOGG_ID) { avvisade.push({ id, orsak: 'Läskopian har redan tagit emot så många rader som går.' }); continue; }
      const resurs = typeof r.resurs === 'string' ? r.resurs.slice(0, 200) : '';
      logg.loggaRad(db, {
        tid: new Date(t).toISOString(), personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: r.patientId, handling: r.handling,
        resurs: `laslage:${resurs}`, grund: utlamnad.grund, syfte, resultat: 'tillaten',
      });
      kopia.loggIds.add(id);
      mottagna++;
    }
    return { mottagna, avvisade };
  }

  // Den inloggade rapporterar åtkomster i läsläget mot sin pågående läskopia, med raderna i klartext.
  function lasekopiaLogg(c) {
    const rader = c.body.rader;
    if (!Array.isArray(rader) || rader.length > 500) throw new Fel(400, 'Skicka högst 500 rader i en lista.', 'ogiltig', { falt: ['rader'] });
    return taEmotRader(c.db, c.personal, aktuellKopia(c.s), rader);
  }

  // Loggen från läsläget som webbläsaren har sparat krypterad. Varje rad är krypterad för sig med läskopians nyckel
  // (AES-GCM), med läskopians id, personen och radens id som additional data. Bara den som hade läskopian och dess
  // nyckel kan skapa en rad som går att dekryptera, så raderna kan tas emot utan inloggning: från en ny flik, efter en
  // omstart av webbläsaren eller när någon annan har loggat in. En rad som inte går att dekryptera, eller som ändrats,
  // avvisas. Raderna loggas i sandlådan som lämnade ut läskopian, på personen som den lämnades ut till.
  const loggAad = (kopiaId, personalId, id) => Buffer.from(`vardkallan-laslogg|${kopiaId}|${personalId}|${id}`);
  function dekrypteraRad(nyckel, aad, iv, data) {
    if (typeof iv !== 'string' || typeof data !== 'string' || iv.length > 32 || data.length > 4096) return null;
    try {
      const ivB = Buffer.from(iv, 'base64url');
      const d = Buffer.from(data, 'base64url');
      if (ivB.length !== 12 || d.length < 17) return null;
      const dc = createDecipheriv('aes-256-gcm', nyckel, ivB);
      dc.setAAD(aad);
      dc.setAuthTag(d.subarray(d.length - 16));
      const v = JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString('utf8'));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch { return null; }
  }
  function krypteradLogg(c) {
    const { kopiaId, rader, klocka } = c.body;
    if (typeof kopiaId !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(kopiaId)) throw new Fel(400, 'Ange läskopians id.', 'ogiltig', { falt: ['kopiaId'] });
    if (!Array.isArray(rader) || rader.length > 500) throw new Fel(400, 'Skicka högst 500 rader i en lista.', 'ogiltig', { falt: ['rader'] });
    const hittad = hittaKopia(kopiaId);
    if (!hittad) throw new Fel(404, 'Läskopian finns inte längre på servern, så åtkomsterna kan inte föras över.', 'saknas');
    const { s, kopia } = hittad;
    const pers = personalRad(s.db, kopia.personalId);
    const nyckel = Buffer.from(kopia.nyckel, 'base64url');
    const klara = [];
    const ogiltiga = [];
    for (const r of rader) {
      const id = typeof r?.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(r.id) ? r.id : null;
      if (!id) { ogiltiga.push({ id: null, orsak: 'Raden saknar giltigt id.' }); continue; }
      const rad = dekrypteraRad(nyckel, loggAad(kopiaId, kopia.personalId, id), r.iv, r.data);
      if (!rad || rad.id !== id) { ogiltiga.push({ id, orsak: 'Raden kunde inte verifieras med läskopians nyckel.' }); continue; }
      klara.push(rad);
    }
    // Webbläsarens klocka när raderna skickades. Går den fel med mer än marginalen rättas radernas tider med skillnaden,
    // eftersom de är mätta med samma klocka. Mer än ett dygn fel räknas inte som en klocka som går fel.
    const k = typeof klocka === 'string' ? Date.parse(klocka) : NaN;
    const skillnad = Number.isFinite(k) && Math.abs(Date.now() - k) > KLOCKMARGINAL && Math.abs(Date.now() - k) < 24 * 3600_000 ? Date.now() - k : 0;
    const ut = taEmotRader(s.db, pers, kopia, klara, skillnad);
    return { mottagna: ut.mottagna, avvisade: [...ogiltiga, ...ut.avvisade] };
  }

  function registreraVal(c, p, { typ, syfte }) {
    const db = c.db;
    if (!VAL_TYPER.includes(typ)) throw new Fel(400, 'Okänt val.', 'ogiltig', { falt: ['typ'] });
    const s = typeof syfte === 'string' ? syfte.trim() : '';
    if (s.length < 3 || s.length > 300) throw new Fel(400, 'Ange syftet med valet.', 'ogiltig', { falt: ['syfte'] });
    const nuvarande = valFor(c.s, p.id);
    const atk = new Atkomst(db, c.personal, p.id, nuvarande, typ);
    if (!kanRoll(c.personal, typ)) { atk.logga(typ, 'nekad', null, 'nekad', s); throw new Fel(403, 'Din yrkesroll kan inte göra det valet.', 'nekad'); }
    const ve = vardenhetFor(db, c.personal.enhet_id);
    let grund;
    if (typ === 'nodatkomst') {
      if (harVardrelation(db, p.id, ve)) throw new Fel(400, 'Det finns redan en vårdrelation. Nödåtkomst behövs inte.', 'ogiltig');
      grund = 'nodatkomst';
    } else {
      const r = atk.krav(kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
      if (typ === 'samtycke_sparr') {
        if (!aktivaSparrar(db, p.id).some(e => e !== ve)) throw new Fel(400, 'Patienten har inga spärrade uppgifter.', 'ogiltig');
        grund = 'samtycke_sparr';
      } else if (typ === 'visa_identitet') {
        if (!p.skyddad) throw new Fel(400, 'Patienten har inte skyddad identitet.', 'ogiltig');
        grund = r.grund;
      } else grund = r.grund === 'nodatkomst' ? 'nodatkomst' : 'aktivt_val';
    }
    c.s.val[p.id] = { ...(c.s.val[p.id] ?? {}), [typ]: { syfte: s, tid: new Date().toISOString() } };
    atk.logga(typ, grund, null, 'tillaten', s);
    return { ok: true, val: valFor(c.s, p.id) };
  }

  // Personalens API:er kräver personalens inloggning. En invånare som är inloggad i Min journal får samma svar som den
  // som inte är inloggad alls, och omvänt för Min journal.
  const kravInloggad = (c) => {
    // Runda 9, r5: när systemet har avslutat inloggningen för att uppdraget upphörde säger svaret varför.
    if (!c.personal) throw new Fel(401, c.invanare ? 'Den här delen är för vårdens personal. Logga in med SITHS-kort.' : c.s?.utloggadOrsak ? `Du är utloggad. ${c.s.utloggadOrsak} Logga in igen.` : 'Logga in först.', 'ej_inloggad');
    return c.personal;
  };
  const kravInvanare = (c) => {
    if (!c.invanare) throw new Fel(401, 'Logga in med e-legitimation för att läsa din journal.', 'ej_inloggad');
    return c.invanare;
  };
  const kravRoll = (c, handling) => {
    kravInloggad(c);
    if (!kanRoll(c.personal, handling)) throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
  };

  // Routningstabell: metod, mönster, hanterare(c, ...parametrar).
  const R = [];
  const rutt = (metod, monster, fn) => R.push([metod, new RegExp(`^${monster.replace(/:\w+/g, '([^/]+)')}$`), fn]);

  rutt('GET', '/api/session', (c) => sessionUt(c.s));
  rutt('GET', '/api/demo/personal', (c) => c.db.query('SELECT * FROM personal WHERE demo = 1 ORDER BY rowid').all().map(p => ({
    id: p.id, namn: p.namn, yrke: p.yrke, yrkeText: YRKEN[p.yrke], titel: p.titel, enhet: enhetKort(c.db, p.enhet_id),
  })));
  // Runda 9, r5 (Sussa 5.2.1.6 och 5.2.1.8): inloggningen går genom den simulerade autentiseringstjänsten (idp.js). Valet
  // av demoroll är det simulerade SITHS-kortet: tjänsten utfärdar en signerad biljett, och personen, medarbetaruppdraget
  // och behörigheten tas ur biljettens attribut, på samma sätt som för en biljett som kommer utifrån (/api/login/biljett).
  function loggaInMedBiljett(c, biljett, { forbruka = true, demo = false } = {}) {
    const { personal: p, uppdrag } = idp.loggaIn(c.db, idp.verifiera(biljett, { forbruka }));
    // Runda 12, r3: har personen en passkey eller en app för engångskoder i sandlådan väntar inloggningen på den.
    stoppaOprovbarFaktor(c, 'personal', p.id, p.enhet_id);
    if (flerfaktor.kravs(c.db, 'personal', p.id)) return borjaFlerfaktor(c, { typ: 'personal', id: p.id, namn: p.namn, enhet: p.enhet_id, uppdrag, demo });
    return slutforPersonal(c, p, uppdrag, { demo });
  }
  function slutforPersonal(c, p, uppdrag, { demo = false, metod = null } = {}) {
    // Runda 6, r5: tillämpningarnas åtkomstbiljetter gäller inte efter en ny inloggning.
    oppetApi.aterkalla(c.s, 'Åtkomstbiljetten återkallades vid en ny inloggning.');
    avslutaKopia(c.s, aktuellKopia(c.s), 'inloggning');
    c.s.personalId = p.id;
    c.s.uppdrag = uppdrag;
    c.s.utloggadOrsak = null;
    c.s.invanareId = null;
    c.s.val = {};
    // Ny nyckel och ny läskopia vid varje inloggning, så att en tidigare persons kopia inte går att läsa. Den förra
    // läskopian finns kvar på servern tills den går ut, bara för att kunna ta emot loggen från läsläget.
    c.s.lasnyckel = null;
    c.s.oppnade = new Set();
    c.s.vantande = null;
    c.s.flerfaktorMetod = metod;
    // Runda 13, r2 (fynd 8): när inloggningen senast bekräftades med en faktor.
    c.s.flerfaktorTid = metod ? Date.now() : null;
    sakraKopia(c.s);
    c.rotera = true;
    // Runda 11, r3: demopatienterna för förlossningen vid barnmorskans första inloggning i sandlådan.
    if (demo) r11r3EfterInloggning(c.db, p);
    return sessionUt(c.s);
  }
  rutt('POST', '/api/login', (c) => {
    const p = typeof c.body.personalId === 'string' ? c.db.query('SELECT * FROM personal WHERE id = ? AND demo = 1').get(c.body.personalId) : null;
    if (!p) throw new Fel(400, 'Välj en av demorollerna.', 'ogiltig', { falt: ['personalId'] });
    // Biljetten skapas och prövas i samma anrop och lämnar aldrig servern, så den behöver inte sparas som använd.
    return loggaInMedBiljett(c, idp.autentisera(c.db, p), { forbruka: false, demo: true });
  });
  // En biljett från en betrodd autentiseringstjänst. Personen behöver inte vara en demoroll, men måste vara aktiv i
  // masterdata, och uppdraget i biljetten måste stämma med masterdata.
  rutt('POST', '/api/login/biljett', (c) => loggaInMedBiljett(c, c.body.biljett));
  // Autentiseringstjänstens publika nycklar och konfiguration (OpenID Connect Discovery), utan sandlåda.
  rutt('GET', '/api/idp/jwks', () => idp.jwks());
  rutt('GET', '/api/idp/.well-known/openid-configuration', (c) => idp.konfiguration(origin || `${c.url.protocol}//${c.url.host}`));
  // Utloggning efter ett avbrott kan ha med sig åtkomsterna från läsläget. De loggas innan sessionen avslutas,
  // eftersom de annars aldrig går att föra över.
  // Sessionen avslutas alltid, även om raderna inte går att ta emot.
  rutt('POST', '/api/logout', (c) => {
    let lasloggen;
    try {
      if (c.personal && Array.isArray(c.body?.rader)) lasloggen = lasekopiaLogg(c);
      // Bara personalen har läskopia. Rader från läsläget i en session där ingen personal är inloggad tas inte emot,
      // och det står i svaret så att klienten kan säga det.
      else if (Array.isArray(c.body?.rader) && c.body.rader.length) {
        lasloggen = { mottagna: 0, avvisade: [], fel: 'Åtkomsterna från läsläget kunde inte tas emot, eftersom ingen personal är inloggad i sessionen.' };
      }
    } catch (e) {
      lasloggen = { mottagna: 0, avvisade: [], fel: e instanceof Fel ? e.message : 'Raderna kunde inte tas emot.' };
    } finally {
      // Läskopian stängs: rader från läsningar före utloggningen tas fortfarande emot, senare läsningar inte.
      const akt = aktuellKopia(c.s);
      if (akt) akt.stangd = new Date().toISOString();
      avslutaKopia(c.s, akt, 'utloggning');
      // Runda 6, r5: tillämpningarnas åtkomstbiljetter återkallas och återkallelsen loggas.
      oppetApi.aterkalla(c.s, 'Åtkomstbiljetten återkallades vid utloggning.');
      c.s.personalId = null; c.s.uppdrag = null; c.s.invanareId = null; c.s.val = {}; c.s.lasnyckel = null; c.s.oppnade = new Set();
      // Runda 12, r3: en inloggning som väntar på den andra faktorn avbryts också.
      c.s.vantande = null; c.s.flerfaktorMetod = null;
    }
    return { ...sessionUt(c.s), ...(lasloggen ? { lasloggen } : {}) };
  });
  // Inloggning i Min journal med simulerad e-legitimation. Personalens inloggning, val och läskopia nollställs, och
  // sessionskakan byts som vid personalens inloggning.
  rutt('GET', '/api/demo/invanare', (c) => minJournal.demoInvanare(c.db));
  rutt('POST', '/api/login/invanare', (c) => {
    const inv = minJournal.provaInloggning(c.db, c.body.invanareId);
    // Runda 12, r3: med en passkey eller en app för engångskoder väntar inloggningen på den.
    stoppaOprovbarFaktor(c, 'invanare', inv.id, null);
    if (flerfaktor.kravs(c.db, 'invanare', inv.id)) return borjaFlerfaktor(c, { typ: 'invanare', id: inv.id, namn: minJournal.sessionDel(c.db, inv).invanare.namn });
    return slutforInvanare(c, inv);
  });
  function slutforInvanare(c, inv, { metod = null } = {}) {
    oppetApi.aterkalla(c.s, 'Åtkomstbiljetten återkallades när någon loggade in i Min journal i samma webbläsare.');
    c.s.invanareId = inv.id;
    c.s.personalId = null; c.s.uppdrag = null;
    c.s.val = {};
    // Personalens läskopia stängs som vid utloggning.
    const akt = aktuellKopia(c.s);
    if (akt) akt.stangd = new Date().toISOString();
    avslutaKopia(c.s, akt, 'invanare');
    c.s.lasnyckel = null;
    c.s.oppnade = new Set();
    c.s.vantande = null;
    c.s.flerfaktorMetod = metod;
    // Runda 13, r2 (fynd 8): när inloggningen senast bekräftades med en faktor.
    c.s.flerfaktorTid = metod ? Date.now() : null;
    c.rotera = true;
    return sessionUt(c.s);
  }

  // Runda 12, r3 (vårt L5): flerfaktorsinloggning. Den första faktorn (det simulerade SITHS-kortet eller den simulerade
  // e-legitimationen) är godkänd, och den förra inloggningen i webbläsaren avslutas direkt, så att ingen annan är
  // inloggad medan den andra faktorn väntar. Ingen nyckel till läskopian lämnas ut förrän den andra faktorn är godkänd.
  const webbplats = (c) => { const u = new URL(origin || `${c.url.protocol}//${c.url.host}`); return { rpId: u.hostname, ursprung: u.origin }; };
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 7): en aktiv faktor som inte kan prövas (nyckeln för
  // engångskoder går inte att dekryptera) stoppar inloggningen i stället för att släppa igenom utan andra faktor.
  function stoppaOprovbarFaktor(c, typ, id, enhet) {
    if (flerfaktor.kravs(c.db, typ, id) || !flerfaktor.oprovbara(c.db, typ, id).length) return;
    sakerhetslogg.logga(c.db, { typ: 'inloggning_misslyckad', personal_id: typ === 'personal' ? id : null, invanare_id: typ === 'invanare' ? id : null, enhet_id: enhet,
      metod: 'POST', vag: c.url.pathname, status: 403, beskrivning: 'Inloggningen stoppades: en aktiv faktor kan inte prövas, eftersom nyckeln för engångskoder inte går att dekryptera.' });
    throw new Fel(403, 'Din app för engångskoder kan inte prövas i den här sandlådan, så inloggningen stoppas för att skydda kontot. Återställ demon för att börja om utan faktor.', 'nekad');
  }
  function borjaFlerfaktor(c, agare) {
    oppetApi.aterkalla(c.s, 'Åtkomstbiljetten återkallades vid en ny inloggning.');
    const akt = aktuellKopia(c.s);
    if (akt) akt.stangd = new Date().toISOString();
    avslutaKopia(c.s, akt, 'inloggning');
    c.s.personalId = null; c.s.uppdrag = null; c.s.invanareId = null; c.s.val = {}; c.s.lasnyckel = null; c.s.oppnade = new Set(); c.s.flerfaktorMetod = null;
    c.s.vantande = { ...agare, utgar: Date.now() + flerfaktor.UTMANING_S * 1000, forsok: 0 };
    c.rotera = true;
    sakerhetslogg.logga(c.db, { typ: 'flerfaktor', personal_id: agare.typ === 'personal' ? agare.id : null, invanare_id: agare.typ === 'invanare' ? agare.id : null, enhet_id: agare.enhet ?? null,
      metod: 'POST', vag: c.url.pathname, status: 200, beskrivning: 'Den första faktorn är godkänd. Inloggningen väntar på den andra faktorn.' });
    return { ...sessionUt(c.s), flerfaktor: { kravs: true, ...flerfaktor.inloggningsutmaning(c.db, c.s, agare, webbplats(c)) } };
  }
  rutt('POST', '/api/login/flerfaktor', (c) => {
    const v = c.s.vantande;
    if (!v || v.utgar < Date.now()) { c.s.vantande = null; throw new Fel(400, 'Inloggningen har gått ut eller avbrutits. Välj rollen igen.', 'ogiltig'); }
    const agare = flerfaktor.agareNyckel(v.typ, v.id);
    const vem = { personal_id: v.typ === 'personal' ? v.id : null, invanare_id: v.typ === 'invanare' ? v.id : null, enhet_id: v.enhet ?? null };
    if (flerfaktor.sparrad(c.s, agare)) {
      c.s.vantande = null;
      throw new Fel(429, 'För många felaktiga försök den senaste kvarten. Vänta en stund, eller återställ sandlådan om du har tappat bort din faktor.', 'nekad');
    }
    let r;
    try { r = flerfaktor.prova(c.db, c.s, v, c.body, webbplats(c)); } catch (e) {
      if (!(e instanceof Fel)) throw e;
      v.forsok++;
      flerfaktor.raknaFel(c.s, agare);
      sakerhetslogg.logga(c.db, { typ: 'inloggning_misslyckad', ...vem, metod: 'POST', vag: '/api/login/flerfaktor', status: e.status, beskrivning: `Den andra faktorn godkändes inte. ${e.message}`.slice(0, 300) });
      if (v.forsok >= flerfaktor.MAX_FORSOK) { c.s.vantande = null; throw new Fel(400, 'För många felaktiga försök. Välj rollen igen för att börja om.', 'nekad'); }
      // En ny utmaning för passkeyn, så att det går att försöka igen.
      throw new Fel(e.status, e.message, e.kod, { ...e.extra, flerfaktor: { kravs: true, ...flerfaktor.inloggningsutmaning(c.db, c.s, v, webbplats(c)) } });
    }
    c.s.vantande = null;
    if (v.typ === 'personal') {
      const p = personalRad(c.db, v.id);
      const orsak = p ? idp.uppdragGaller(c.db, p, v.uppdrag) : 'Personen finns inte.';
      if (orsak) throw new Fel(403, orsak, 'nekad');
      return slutforPersonal(c, p, v.uppdrag, { demo: v.demo, metod: r.metod });
    }
    return slutforInvanare(c, minJournal.provaInloggning(c.db, v.id), { metod: r.metod });
  });
  rutt('POST', '/api/login/flerfaktor/avbryt', (c) => { c.s.vantande = null; c.s.flerfaktorUtmaning = null; return sessionUt(c.s); });
  // Den inloggade registrerar och tar bort sina faktorer. Personalen och invånaren har var sina, i sandlådan.
  const agareFor = (c) => {
    if (c.personal) return { typ: 'personal', id: c.personal.id, namn: c.personal.namn, enhet: c.personal.enhet_id };
    if (c.invanare) return { typ: 'invanare', id: c.invanare.id, namn: minJournal.sessionDel(c.db, c.invanare).invanare.namn };
    throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  };
  const loggaFaktor = (c, a, text) => sakerhetslogg.logga(c.db, { typ: 'flerfaktor', personal_id: a.typ === 'personal' ? a.id : null, invanare_id: a.typ === 'invanare' ? a.id : null,
    enhet_id: a.enhet ?? null, metod: 'POST', vag: c.url.pathname.replace(/\/\d+\//, '/:id/'), status: 200, beskrivning: text });
  const oversiktFor = (c, a) => flerfaktor.oversikt(c.db, a.typ, a.id, { metod: c.s.flerfaktorMetod ?? null });
  rutt('GET', '/api/flerfaktor', (c) => oversiktFor(c, agareFor(c)));
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 8): en faktor läggs till eller tas bort bara efter en färsk
  // bekräftelse med en faktor som redan var aktiv: inloggningen med faktor de senaste fem minuterna, eller en kod från
  // appen för engångskoder i bekraftelse. En faktor som just har registrerats räknas aldrig som bekräftelse, så att den
  // som har kommit åt en öppen session inte kan lägga till sin egen faktor och sedan ta bort den riktiga. Felaktiga koder
  // räknas som vid inloggningen och loggas, och efter för många stoppas bekräftelsen en kvart.
  const FARSK_MS = 5 * 60_000;
  function kravFarskBekraftelse(c, a, kod) {
    if (!flerfaktor.kravs(c.db, a.typ, a.id)) return;
    if (c.s.flerfaktorTid && Date.now() - c.s.flerfaktorTid <= FARSK_MS) return;
    const agare = flerfaktor.agareNyckel(a.typ, a.id);
    const m = flerfaktor.metoder(c.db, a.typ, a.id);
    const nu = Date.now();
    const fel = ((c.s.bekraftaFel ??= {})[agare] ?? []).filter(t => t > nu - 15 * 60_000);
    if (flerfaktor.sparrad(c.s, agare) || fel.length >= flerfaktor.MAX_FORSOK) {
      throw new Fel(429, 'För många felaktiga koder den senaste kvarten. Vänta en stund, eller logga ut och logga in igen med din faktor.', 'nekad');
    }
    if (typeof kod !== 'string' || !m.includes('totp')) {
      throw new Fel(403, m.includes('totp') ? 'Bekräfta med en kod från din app för engångskoder först.' : 'Logga in igen med din passkey först. Bekräftelsen gäller i fem minuter.', 'bekrafta_faktor', { metoder: m });
    }
    try { flerfaktor.prova(c.db, c.s, a, { typ: 'totp', kod }, webbplats(c)); } catch (e) {
      if (!(e instanceof Fel)) throw e;
      fel.push(nu);
      c.s.bekraftaFel[agare] = fel;
      flerfaktor.raknaFel(c.s, agare, nu);
      sakerhetslogg.logga(c.db, { typ: 'inloggning_misslyckad', personal_id: a.typ === 'personal' ? a.id : null, invanare_id: a.typ === 'invanare' ? a.id : null, enhet_id: a.enhet ?? null,
        metod: 'POST', vag: c.url.pathname, status: e.status, beskrivning: `Bekräftelsen med en faktor godkändes inte. ${e.message}`.slice(0, 300) });
      if (fel.length >= flerfaktor.MAX_FORSOK || flerfaktor.sparrad(c.s, agare)) throw new Fel(429, 'För många felaktiga koder den senaste kvarten. Vänta en stund, eller logga ut och logga in igen med din faktor.', 'nekad');
      throw e;
    }
    c.s.bekraftaFel[agare] = [];
    c.s.flerfaktorTid = nu;
  }
  rutt('POST', '/api/flerfaktor/passkey/borja', (c) => { const a = agareFor(c); kravFarskBekraftelse(c, a, c.body.bekraftelse); return flerfaktor.borjaPasskey(c.db, c.s, a, webbplats(c)); });
  rutt('POST', '/api/flerfaktor/passkey', (c) => {
    const a = agareFor(c);
    kravFarskBekraftelse(c, a, c.body.bekraftelse);
    const f = flerfaktor.sparaPasskey(c.db, c.s, a, c.body, webbplats(c));
    loggaFaktor(c, a, 'En passkey registrerades. Flerfaktor krävs vid nästa inloggning.');
    return [201, { faktor: f, ...oversiktFor(c, a) }];
  });
  rutt('POST', '/api/flerfaktor/totp/borja', (c) => { const a = agareFor(c); kravFarskBekraftelse(c, a, c.body.bekraftelse); return flerfaktor.borjaTotp(c.db, a); });
  rutt('POST', '/api/flerfaktor/totp', (c) => {
    const a = agareFor(c);
    kravFarskBekraftelse(c, a, c.body.bekraftelse);
    const f = flerfaktor.bekraftaTotp(c.db, a, c.body.kod);
    loggaFaktor(c, a, 'En app för engångskoder registrerades. Flerfaktor krävs vid nästa inloggning.');
    return [201, { faktor: f, ...oversiktFor(c, a) }];
  });
  rutt('POST', '/api/flerfaktor/:id/ta-bort', (c, id) => {
    const a = agareFor(c);
    kravFarskBekraftelse(c, a, c.body.bekraftelse ?? c.body.kod);
    const r = flerfaktor.taBort(c.db, a, id);
    loggaFaktor(c, a, r.aktiv ? 'En faktor togs bort. Flerfaktor är fortfarande på.' : 'Den sista faktorn togs bort. Flerfaktor är av.');
    return { ...r, metod: c.s.flerfaktorMetod ?? null };
  });
  rutt('POST', '/api/reset', (c) => {
    // Runda 9, r5: en miljö återställs inte till demons sandlåda, eftersom den då skulle få fel märkning.
    if (miljoer.miljoFor(c.db).typ !== 'produktion') throw new Fel(400, `Det här är en ${miljoer.miljoFor(c.db).text.toLowerCase()}. Den återställs inte. Gå tillbaka till produktionsmiljön och skapa en ny miljö där.`, 'ogiltig');
    oppetApi.aterkalla(c.s, 'Åtkomstbiljetten återkallades när sandlådan återställdes.');
    c.s.db.close();
    c.s.db = nySessionsDb();
    // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 3): den nya sandlådan får ett nytt id för kopiorna, och
    // kopiorna av den gamla tas bort, så att återställningen aldrig ger åtkomst till något som skyddades av en faktor.
    kopior.radera(c.s.kopieId);
    c.s.kopieId = slumpId();
    c.s.aterstallning = null;
    c.s.val = {};
    c.s.oppnade = new Set();
    // Den nya sandlådan har en ny logg, så läskopian lämnas ut och loggas på nytt där. Läskopior från tidigare
    // inloggningar hör till den gamla sandlådan och glöms.
    const akt = aktuellKopia(c.s);
    c.s.kopior = new Map(akt ? [[c.s.lasnyckel.id, { ...akt, patienter: new Map() }]] : []);
    return { ok: true, ...sessionUt(c.s) };
  });
  // Runda 9, r5 (KD1.1.1.5): systemförvaltaren skapar en acceptanstest-, utbildnings- eller testmiljö ur en kopia av
  // sandlådan (miljoer.js). Miljön blir en egen sandlåda. Svaret har en adress som gäller en gång i fem minuter och
  // byter webbläsarens session till miljön. Taket per sandlåda och taket för nya besök från adressen gäller.
  const miljoBiljetter = new Map();
  const finnsSession = (s) => [...sessioner.values()].includes(s);
  const sidFor = (s) => { for (const [sid, x] of sessioner) if (x === s) return sid; return null; };
  const miljoerUt = (s) => ({
    aktuell: miljoer.miljoFor(s.db), typer: Object.entries(miljoer.MILJOER).filter(([k]) => k !== 'produktion').map(([typ, m]) => ({ typ, ...m })), max: miljoer.MAX_PER_SANDLADA,
    skapade: (s.miljoer ?? []).filter(m => finnsSession(m.s)).map(m => ({ typ: m.typ, text: miljoer.MILJOER[m.typ].text, skapad: m.skapad })),
  });
  rutt('GET', '/api/miljoer', (c) => { kravRoll(c, 'konfigurera'); return miljoerUt(c.s); });
  rutt('POST', '/api/miljoer', (c) => {
    kravRoll(c, 'konfigurera');
    if (miljoer.miljoFor(c.db).typ !== 'produktion') throw new Fel(400, 'En ny miljö skapas ur produktionsmiljön. Gå tillbaka till produktionsmiljön först.', 'ogiltig');
    const levande = (c.s.miljoer ?? []).filter(m => finnsSession(m.s));
    if (levande.length >= miljoer.MAX_PER_SANDLADA) throw new Fel(429, `Sandlådan har redan ${miljoer.MAX_PER_SANDLADA} miljöer. De försvinner när de inte har använts på åtta timmar.`, 'nekad');
    const k = `${c.ip ?? 'okänd'}:${Math.floor(Date.now() / 3600_000)}`;
    const n = (nyaPerIp.get(k) ?? 0) + 1;
    if (n > nyaPerTimme) throw new Fel(429, 'För många nya besök från din adress. Försök igen om en stund.', 'nekad');
    // Runda 13, r2: ingen sandlåda tas bort för att ge plats åt miljön. När demon är full säger svaret när det är lönt
    // att försöka igen.
    kravPlats();
    nyaPerIp.set(k, n);
    const { db, resultat } = miljoer.skapa(c.db, c.body.typ);
    // Runda 12, r2: den nya miljön får ett eget id för kopiorna.
    const ny = medVila({ db, personalId: null, invanareId: null, val: {}, sist: Date.now(), matning: new Matning(200), lasnyckel: null, oppnade: new Set(), kopior: new Map(), ursprung: c.s, kopieId: slumpId(), adress: c.s.adress ?? null });
    raknaAdress(ny.adress, 1);
    sessioner.set(slumpId(), ny);
    const skapad = new Date().toISOString();
    c.s.miljoer = [...levande, { typ: c.body.typ, s: ny, skapad }];
    const biljett = slumpId();
    miljoBiljetter.set(biljett, { s: ny, utgar: Date.now() + 5 * 60_000 });
    return [201, { miljo: { typ: c.body.typ, ...miljoer.MILJOER[c.body.typ], skapad }, adress: `/api/miljoer/oppna/${biljett}`, resultat, ...miljoerUt(c.s) }];
  });
  // Tillbaka från en miljö till produktionsmiljön som den skapades ur, om den finns kvar.
  rutt('POST', '/api/miljoer/tillbaka', (c) => {
    const prod = c.s.ursprung;
    const sid = prod && finnsSession(prod) ? sidFor(prod) : null;
    if (!sid) throw new Fel(404, 'Produktionsmiljön som miljön skapades ur finns inte längre. Ladda om sidan för att börja om i en ny sandlåda.', 'saknas');
    c.sid = sid;
    c.ny = true;
    return { ok: true, adress: '/' };
  });
  // Länken öppnas bara i webbläsaren som skapade miljön: anropet ska ha sessionskakan för produktionsmiljön. Annars
  // skulle den som fick se länken också kunna gå tillbaka till den produktionsmiljön.
  function oppnaMiljo(req, url) {
    const text = (t, status) => new Response(t, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    const biljett = url.pathname.split('/').pop();
    const b = miljoBiljetter.get(biljett);
    for (const [t, x] of miljoBiljetter) if (x.utgar < Date.now()) miljoBiljetter.delete(t);
    if (b && (!kakSid(req) || sessioner.get(kakSid(req)) !== b.s.ursprung)) return text('Länken till miljön kan bara öppnas i webbläsaren som skapade miljön.', 403);
    miljoBiljetter.delete(biljett);
    const sid = b && b.utgar >= Date.now() && finnsSession(b.s) ? sidFor(b.s) : null;
    if (!sid) return text('Länken till miljön har redan använts eller gått ut. Skapa miljön igen.', 410);
    return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': kaka(sid), 'Cache-Control': 'no-store' } });
  }
  rutt('GET', '/api/enheter', (c) => {
    const alla = c.db.query('SELECT * FROM enheter').all();
    const nod = (e) => ({ id: e.id, hsaId: e.hsa_id, namn: e.namn, kortnamn: e.kortnamn, typ: e.typ, barn: alla.filter(b => b.forald_id === e.id).map(nod) });
    return alla.filter(e => !e.forald_id).map(nod);
  });
  rutt('GET', '/api/arbetslista', (c) => { kravInloggad(c); return arbetslista(c); });
  rutt('GET', '/api/sok', (c) => { kravInloggad(c); return sok(c, c.url.searchParams.get('q')); });
  rutt('GET', '/api/vantrum', (c) => { kravInloggad(c); return vantrum(c); });
  rutt('GET', '/api/lasekopia', (c) => { kravInloggad(c); return lasekopia(c); });
  rutt('POST', '/api/lasekopia/logg', (c) => { kravInloggad(c); return lasekopiaLogg(c); });
  rutt('POST', '/api/lasekopia/krypterad-logg', (c) => krypteradLogg(c));

  rutt('GET', '/api/patient/:id', (c, id) => {
    kravInloggad(c);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    const ut = medPatient(c, id, handling, (atk, p) => patientHuvud(c, atk, p));
    c.s.oppnade.add(ut.id);
    return ut;
  });
  rutt('POST', '/api/patient/:id/val', (c, id) => { kravInloggad(c); return registreraVal(c, patientRad(c.db, id), c.body); });
  rutt('GET', '/api/patient/:id/oversikt', (c, id) => {
    kravInloggad(c);
    const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
    // Runda 10, r2: vyn för situationen, med delarna och tidsurvalet (presentationsvyer.js).
    return medPatient(c, id, handling, (atk, p) => presentationsvyer.medVy(atk, oversikt(c, atk, p), { situation: c.url.searchParams.get('situation') }));
  });
  rutt('GET', '/api/patient/:id/anteckningar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_journal', (atk) => journal.listaAnteckningar(atk)); });
  rutt('POST', '/api/patient/:id/anteckningar', (c, id) => {
    kravInloggad(c);
    // Runda 10, r3: kategorin för ett formulär kommer ur formulärets definition (journal.kategoriFor).
    return [201, medPatient(c, id, journal.skrivHandling(journal.kategoriFor(c.db, c.body.typ)), (atk) => vardkontakt.knyt(atk, 'anteckningar', journal.skapaAnteckning(atk, c.body), c.body))];
  });
  const medAnteckning = (c, id, handling, fn) => {
    kravInloggad(c);
    const a = journal.hamtaAnteckningRad(c.db, id);
    return medPatient(c, a.patient_id, handling(a), (atk) => fn(atk, a));
  };
  rutt('GET', '/api/anteckning/:id', (c, id) => medAnteckning(c, id, a => journal.lasHandling(a.kategori), (atk, a) => utdata.anteckning(c.db, c.personal, journal.hamtaAnteckning(atk, a))));
  rutt('PUT', '/api/anteckning/:id', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => journal.andraUtkast(atk, a, c.body)));
  rutt('POST', '/api/anteckning/:id/signera', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => journal.signera(atk, a)));
  rutt('POST', '/api/anteckning/:id/ratta', (c, id) => medAnteckning(c, id, a => journal.skrivHandling(a.kategori), (atk, a) => [201, journal.ratta(atk, a, c.body)]));
  // Runda 7, r4: mallarnas sökord kan ändras av systemförvaltningen (konfiguration.js).
  // Runda 10, r3: och de formulär som den inloggade får fylla i (formularmotor.js).
  // Runda 12, r1: de mallar som systemförvaltningen har skapat och vårdenhetens lokala anpassningar (journalstruktur.js).
  rutt('GET', '/api/mallar', (c) => [...strukturMallar(c.db, c.personal, konfiguration.mallar(c.db)), ...formularMallar(c.db, c.personal)]);

  rutt('GET', '/api/patient/:id/lakemedel', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => lakemedel.lista(atk)); });
  rutt('GET', '/api/lakemedel/katalog', (c) => { kravInloggad(c); return lakemedel.sokKatalog(c.db, c.url.searchParams.get('q') ?? ''); });
  rutt('POST', '/api/patient/:id/lakemedel/kontroll', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => lakemedel.kontroll(atk, c.body)); });
  rutt('POST', '/api/patient/:id/lakemedel', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'ordinera', (atk) => {
      // Tillägget (administrationssätt, mall, vårdhändelse och volym) kontrolleras innan ordinationen sparas.
      // Vårdhändelsen i tidboken (vardhandelse.js) prövas först, så att en nekad koppling inte lämnar en ordination.
      // Väljs en bokning eller en post på väntelistan bestämmer servern vårdhändelsens text.
      const koppling = vardhandelse.forbered(atk, c.body);
      const kropp = koppling ? { ...c.body, vardhandelse: { ...c.body.vardhandelse, text: koppling.text } } : c.body;
      // Runda 6, r2: spädning, förpackning och trappschema kontrolleras före sparandet, och systemet räknar fram volym,
      // dosering och slut ur dem.
      const stod = lakemedelsstod.forbered(c.db, kropp);
      const tillagg = ordinationsmallar.valideraTillagg(c.db, stod.kropp);
      const ut = lakemedel.spara(atk, stod.kropp);
      ordinationsmallar.sparaTillagg(c.db, ut.ordination.id, tillagg);
      lakemedelsstod.sparaTillagg(c.db, ut.ordination.id, stod.extra);
      Object.assign(ut.ordination, lakemedelsstod.tillaggUt(c.db, lakemedel.hamtaRad(c.db, ut.ordination.id)));
      vardhandelse.knyt(atk, ut.ordination.id, koppling);
      Object.assign(ut.ordination, ordinationsmallar.tillaggUt(c.db, ut.ordination.id, { full: true }));
      return vardkontakt.knyt(atk, 'ordinationer', ut, c.body);
    })];
  });
  const medOrdination = (c, id, fn) => {
    kravInloggad(c);
    const o = lakemedel.hamtaRad(c.db, id);
    return medPatient(c, o.patient_id, 'ordinera', (atk) => fn(atk, o));
  };
  rutt('POST', '/api/ordination/:id/utsatt', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.utsatt(atk, o, c.body)));
  rutt('POST', '/api/ordination/:id/nll-avstam', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.avstam(atk, o)));
  rutt('GET', '/api/ordination/:id/utsattning', (c, id) => medOrdination(c, id, (atk, o) => lakemedel.utsattningskontroll(atk, o)));
  // Runda 8, r4: dosändring i en pågående ordination, med ny dosering från ett datum (dosandring.js).
  rutt('GET', '/api/ordination/:id/dosandring', (c, id) => medOrdination(c, id, (atk, o) => dosandring.underlag(atk, o)));
  rutt('POST', '/api/ordination/:id/dosandring', (c, id) => medOrdination(c, id, (atk, o) => dosandring.andra(atk, o, c.body)));

  // Läkemedelsprocessen (Sussa 3.5): administrering, vidimering, läkemedelsgenomgång, fördefinierade ordinationer,
  // planerad vårdhändelse och vätskebalans. Behörigheten prövas i administrering.js och vidimering.js, och varje
  // anrop loggas på patienten som de andra anropen.
  const dagParam = (c) => { const d = c.url.searchParams.get('dag'); return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : idag(); };
  rutt('GET', '/api/administreringar', (c) => { kravInloggad(c); return administrering.avdelning(c.db, c.personal, (pid) => valFor(c.s, pid), { dag: dagParam(c) }); });
  rutt('GET', '/api/patient/:id/administreringar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => administrering.lista(atk, { dag: dagParam(c) })); });
  rutt('POST', '/api/patient/:id/administreringar/kontroll', (c, id) => { kravInloggad(c); return medPatient(c, id, 'ge_lakemedel', (atk) => administrering.kontroll(atk, c.body)); });
  rutt('POST', '/api/patient/:id/administreringar', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ge_lakemedel', (atk) => vardkontakt.knyt(atk, 'administreringar', administrering.spara(atk, c.body), c.body))]; });
  rutt('GET', '/api/patient/:id/vidimering', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => vidimering.underlag(atk)); });
  rutt('POST', '/api/patient/:id/vidimering', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => vidimering.vidimera(atk))]; });
  rutt('GET', '/api/patient/:id/lakemedelsgenomgang', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => vidimering.genomgang(atk)); });
  rutt('POST', '/api/patient/:id/lakemedelsgenomgang', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => vidimering.sparaGenomgang(atk, c.body))]; });
  rutt('GET', '/api/patient/:id/lakemedel/forslag', (c, id) => {
    kravInloggad(c);
    // Runda 6, r2: sjuksköterskan som dokumenterar en muntlig ordination får samma förslag som läkaren.
    const handling = kanRoll(c.personal, 'ordinera') ? 'ordinera' : 'registrera_muntlig_ordination';
    return medPatient(c, id, handling, (atk) => {
      atk.krav(handling);
      const lm = c.db.query('SELECT * FROM katalog WHERE id = ?').get(c.url.searchParams.get('lakemedelId') ?? '');
      if (!lm) throw new Fel(400, 'Välj ett läkemedel i katalogen.', 'ogiltig', { falt: ['lakemedelId'] });
      return ordinationsmallar.forslag(atk, lm);
    });
  });
  // Runda 5, r4: vårdhändelsen sätts upp på väntelistan igen efter en avvisad remiss.
  rutt('POST', '/api/ordination/:id/vardhandelse/igen', (c, id) => medOrdination(c, id, (atk) => vardhandelse.igen(atk, id)));
  rutt('POST', '/api/ordination/:id/vardhandelse', (c, id) => {
    kravInloggad(c);
    const o = lakemedel.hamtaRad(c.db, id);
    const handling = kanRoll(c.personal, 'ordinera') ? 'ordinera' : 'ge_lakemedel';
    return medPatient(c, o.patient_id, handling, (atk) => {
      // Delegeringen omfattar doser, inte tiden för en vårdhändelse (runda 5).
      if (c.personal.yrke === 'underskoterska') {
        atk.logga(handling, 'nekad', `ordination:${o.id}`, 'nekad');
        throw new Fel(403, 'Tiden för en planerad vårdhändelse sätts av en sjuksköterska eller läkare.', 'nekad');
      }
      administrering.kravVardande(atk, handling, { enhet_id: o.enhet_id, gemensam: true }, `ordination:${o.id}`);
      // Säkerhetsgranskning runda 5: vårdhändelsens tid är den ordinerande vårdenhetens planering. Bara den vårdenheten
      // sätter den för hand, och ett försök från en annan vårdenhet nekas och loggas innan något ändras.
      if (vardenhetFor(c.db, o.enhet_id) !== vardenhetFor(c.db, c.personal.enhet_id)) {
        atk.logga(handling, 'nekad', `ordination:${o.id}:vardhandelse`, 'nekad');
        throw new Fel(403, 'Vårdhändelsens tid sätts av den vårdenhet som ordinerade läkemedlet.', 'nekad');
      }
      ordinationsmallar.tidsattHandelse(c.db, o.id, c.body.tid, c.personal.id);
      atk.logga(handling, atk.grund(), `ordination:${o.id}:vardhandelse`);
      // Tiden satt för hand är reserven: vårdhändelsen följer inte längre tidboken (vardhandelse.js).
      vardhandelse.efterHandTid(atk, o.id);
      return { ordinationId: o.id, ...ordinationsmallar.tillaggUt(c.db, o.id, { full: true }) };
    });
  });
  // Runda 5, r1: förslag på vårdhändelse ur tidboken när läkaren ordinerar (vardhandelse.js).
  rutt('GET', '/api/patient/:id/vardhandelse/forslag', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'ordinera', (atk) => vardhandelse.forslag(atk, { text: (c.url.searchParams.get('text') ?? '').slice(0, 300) }));
  });
  rutt('GET', '/api/patient/:id/vatskebalans', (c, id) => {
    kravInloggad(c);
    // Runda 6, r2: med beredd volym, kalorier, vikt, förväntad balans, filter och sortering (lakemedelsvyer.js).
    return medPatient(c, id, 'las_matvarden', (atk) => lakemedelsvyer.vatskebalans(atk, { dag: dagParam(c), brytning: c.url.searchParams.get('brytning') ?? '00',
      riktning: c.url.searchParams.get('riktning'), sortering: c.url.searchParams.get('sortering') ?? 'tid',
      // Runda 9, r1: prognosen 24, 48 eller 72 timmar framåt.
      prognosTimmar: c.url.searchParams.get('prognos') ?? 24 }));
  });
  rutt('POST', '/api/patient/:id/vatskebalans', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => vardkontakt.knyt(atk, 'vatskebalans', administrering.registreraVatska(atk, c.body), c.body))]; });
  // Delegering av läkemedelshantering (runda 5, HSLF-FS 2017:37 9 kap., delegering.js). Sjuksköterskan registrerar och
  // återkallar delegeringar för undersköterskorna på sin vårdenhet, och undersköterskan ser sina egna. Varje
  // registrering och varje nekat försök loggas.
  rutt('GET', '/api/delegeringar', (c) => delegering.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/delegeringar', (c) => [201, delegering.registrera(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/delegering/:id/aterkalla', (c, id) => delegering.aterkalla(c.db, kravInloggad(c), id, c.body));
  // Nästa överföring till NLL får timeout. Med { lage: 'fel' } får den i stället ett felsvar.
  rutt('POST', '/api/demo/nll-timeout', (c) => {
    kravInloggad(c);
    const lage = c.body.lage === 'fel' ? 'fel' : 'timeout';
    installning(c.db, 'nll_nasta', lage);
    return { ok: true, nastaOverforing: lage };
  });

  // Uppmärksamhetsinformation (Sussa 3.1.5): bekräfta ett förslag eller registrera ur listan, avfärda ett förslag och
  // avsluta en uppgift. Behörigheten prövas i uppmarksamhet.js och anropet loggas som skriv_journal.
  rutt('GET', '/api/uppmarksamhet/termer', (c) => { kravInloggad(c); return uppmarksamhet.termer(); });
  rutt('POST', '/api/patient/:id/uppmarksamhet', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'skriv_journal', (atk) => uppmarksamhet.registrera(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/uppmarksamhet/avfard', (c, id) => { kravInloggad(c); return medPatient(c, id, 'skriv_journal', (atk) => uppmarksamhet.avfarda(atk, c.body)); });
  rutt('POST', '/api/uppmarksamhet/:id/avsluta', (c, id) => {
    kravInloggad(c);
    const r = uppmarksamhet.hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, 'skriv_journal', (atk) => uppmarksamhet.avsluta(atk, r, c.body));
  });

  // Runda 6, r1: listan med kurvorna och NEWS2 i samma anrop (vitalparametrar.js).
  // Runda 9, r2: med utrustningen och värdena som väntar på bedömning (medicinteknik.js).
  rutt('GET', '/api/patient/:id/matvarden', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk, p) => ({ ...vitalparametrar.matvardesvy(atk, p, c.url.searchParams), mt: mtPatientvy(atk) })); });
  rutt('POST', '/api/patient/:id/matvarden', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => vardkontakt.knyt(atk, 'matvarden', journal.registreraMatvarde(atk, c.body), c.body))]; });

  rutt('GET', '/api/patient/:id/remisser', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, kanRoll(c.personal, 'las_remiss') ? 'las_remiss' : 'las_remiss_status', (atk) => remiss.forPatient(atk));
  });
  rutt('POST', '/api/patient/:id/remisser', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'remittera', (atk) => vardkontakt.knyt(atk, 'remisser', remiss.skapa(atk, c.body), c.body))]; });
  rutt('GET', '/api/remisser', (c) => {
    kravInloggad(c);
    if (!kanRoll(c.personal, 'las_remiss') && !kanRoll(c.personal, 'las_remiss_status')) throw new Fel(403, 'Din yrkesroll har inte tillgång till remisser.', 'nekad');
    const riktning = c.url.searchParams.get('riktning') === 'utgaende' ? 'utgaende' : 'inkommande';
    // Runda 10, r6: urval på typ, status, prioritet och tid, med antalet per val bland de egna remisserna.
    return { riktning, ...remissR10.urval(remiss.lista(c.db, c.personal, riktning), c.url.searchParams) };
  });
  const medRemiss = (c, id, handling, fn) => {
    kravInloggad(c);
    const r = remiss.hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, handling, (atk) => fn(atk, r));
  };
  rutt('POST', '/api/remiss/:id/mottag', (c, id) => medRemiss(c, id, 'mottag_remiss', (atk, r) => remiss.mottag(atk, r)));
  // En accepterad remiss hamnar på väntelistan av sig själv (tidbok.js). Läkaren kan ange tidstyp och yrkesroll.
  // Runda 5, r4: förhandsvisningen av en avvisning, och avvisningen med beslut om läkemedel som väntar på en vårdhändelse.
  rutt('GET', '/api/remiss/:id/avvisning', (c, id) => medRemiss(c, id, 'bedom_remiss', (atk, r) => remissavvisning.forhandsvisa(atk, r)));
  rutt('POST', '/api/demo/remiss-vardhandelse', (c) => { kravInloggad(c); return remissavvisning.demo(c.db, c.personal); });
  // Runda 7, r1: testpatienterna och datan för Sussas testfall läggs in i den inloggades sandlåda.
  rutt('POST', '/api/demo/sussa-testfall', (c) => sussaDemo.laddaTestdata(c.db, kravInloggad(c)));
  // Runda 7, r1: svaren från riktiga användartester, knutna till ett testtillfälle (anvandartest-svar.js). Testledaren
  // (uppföljningsrollen) skapar tillfället och får koden en gång. Den som är inloggad sparar svar med koden, och läsning,
  // export och radering kräver både rollen och koden. Koden skickas i anropets innehåll, aldrig i adressen.
  rutt('POST', '/api/anvandartest/tillfallen', (c) => { kravRoll(c, 'anvandartest_las'); return [201, anvandartestSvar.skapaTillfalle(anvandartestDb, { session: c.s, skapare: c.ip })]; });
  rutt('POST', '/api/anvandartest/svar', (c) => { kravInloggad(c); return [201, anvandartestSvar.spara(anvandartestDb, c.body, { session: c.s })]; });
  rutt('POST', '/api/anvandartest/svar/lista', (c) => { kravRoll(c, 'anvandartest_las'); return anvandartestSvar.lista(anvandartestDb, c.body.kod); });
  rutt('POST', '/api/anvandartest/svar/export', (c) => {
    kravRoll(c, 'anvandartest_las');
    const ut = anvandartestSvar.exportera(anvandartestDb, c.body.kod, c.body.format === 'csv' ? 'csv' : 'json');
    return new Response(ut.text, { status: 200, headers: { 'Content-Type': ut.contentType, 'Content-Disposition': `attachment; filename="${ut.namn}"`, 'Cache-Control': 'no-store' } });
  });
  rutt('POST', '/api/anvandartest/tillfalle/radera', (c) => { kravRoll(c, 'anvandartest_las'); return anvandartestSvar.radera(anvandartestDb, c.body.kod); });
  rutt('POST', '/api/remiss/:id/bedom', (c, id) => medRemiss(c, id, 'bedom_remiss', (atk, r) => {
    if (c.body.beslut === 'avvisad') return remissavvisning.avvisa(atk, r, c.body);
    const ut = remiss.bedom(atk, r, c.body);
    // Runda 10, r6: en accepterad konsultation sätter inte patienten på väntelistan, eftersom vårdansvaret stannar hos remittenten.
    const vantelista = c.body.beslut === 'accepterad' && !remissR10.arKonsultation(r);
    if (vantelista) ut.vantelista = tidbok.efterBedomning(c.db, remiss.hamtaRad(c.db, r.id), c.body);
    // Runda 8, r2: läkaren väljer inom vilken tid besöket ska ske, med ett förval som systemet räknar ur prioriteten.
    if (vantelista) ut.vantelista = remissR8.sattTidsram(c.db, ut.vantelista, c.body);
    // En avvisad remiss är inte längre grund för de tider som bokades på den.
    if (c.body.beslut === 'avvisad') ut.avbokade = tidbok.efterAvvisning(c.db, remiss.hamtaRad(c.db, r.id), c.personal);
    return ut;
  }));
  rutt('POST', '/api/remiss/:id/svara', (c, id) => medRemiss(c, id, 'svara_remiss', (atk, r) => remiss.svara(atk, r, c.body)));
  rutt('POST', '/api/remiss/:id/kvittera-svar', (c, id) => medRemiss(c, id, 'kvittera_svar', (atk, r) => remiss.kvitteraSvar(atk, r)));

  // Vårdkontakt, vårdtillfälle och hälsoärende (vardkontakt.js). All prövning sker i behörighetsmotorn och varje
  // anrop loggas på patienten, som de andra anropen.
  const synligt = (atk) => ({ kontakter: journal.synligaVardkontakter(atk), diagnoser: kanRoll(atk.personal, 'las_diagnoser') ? journal.synligaDiagnoser(atk) : [] });
  const medKontakt = (c, id, handling, fn) => {
    kravInloggad(c);
    const v = vardkontakt.hamtaKontakt(c.db, id);
    return medPatient(c, v.patient_id, handling, (atk) => fn(atk, v));
  };
  const medVardtillfalle = (c, id, handling, fn) => {
    kravInloggad(c);
    const vt = vardkontakt.hamtaVardtillfalle(c.db, id);
    return medPatient(c, vt.patient_id, handling, (atk) => fn(atk, vt));
  };
  const lasning = (c) => (kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
  // Avdelningarna som tar emot inneliggande patienter, för inskrivning och flytt. Inga patientuppgifter.
  rutt('GET', '/api/avdelningar', (c) => { kravInloggad(c); return vardkontakt.avdelningar(c.db); });
  rutt('GET', '/api/patient/:id/vardkontakt/aktuell', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk) => vardkontakt.aktuell(atk)); });
  rutt('POST', '/api/patient/:id/vardkontakter', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_vardkontakt', (atk) => vardkontakt.registrera(atk, c.body)); });
  rutt('GET', '/api/vardkontakt/:id', (c, id) => medKontakt(c, id, lasning(c), (atk, v) => vardkontakt.kontaktMedInnehall(atk, v)));
  rutt('PATCH', '/api/vardkontakt/:id', (c, id) => medKontakt(c, id, 'registrera_vardkontakt', (atk, v) => vardkontakt.andra(atk, v, c.body)));
  rutt('POST', '/api/vardkontakt/:id/avsluta', (c, id) => medKontakt(c, id, 'registrera_vardkontakt', (atk, v) => vardkontakt.avsluta(atk, v)));
  rutt('POST', '/api/patient/:id/vardtillfallen', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vardtillfalle', (atk) => vardkontakt.skrivIn(atk, c.body)); });
  rutt('GET', '/api/vardtillfalle/:id', (c, id) => medVardtillfalle(c, id, 'las_admin', (atk, vt) => vardkontakt.lasVardtillfalle(atk, vt)));
  rutt('POST', '/api/vardtillfalle/:id/flytta', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.flytta(atk, vt, c.body)));
  rutt('POST', '/api/vardtillfalle/:id/permission', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.permission(atk, vt, c.body)));
  rutt('POST', '/api/vardtillfalle/:id/permission/avsluta', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.aterFranPermission(atk, vt)));
  rutt('POST', '/api/vardtillfalle/:id/skriv-ut', (c, id) => medVardtillfalle(c, id, 'vardtillfalle', (atk, vt) => vardkontakt.skrivUt(atk, vt)));
  rutt('POST', '/api/patient/:id/halsoarenden', (c, id) => { kravInloggad(c); return medPatient(c, id, 'halsoarende', (atk) => { const x = synligt(atk); return vardkontakt.bekrafta(atk, c.body, x.kontakter, x.diagnoser); }); });
  rutt('POST', '/api/patient/:id/halsoarenden/avvisa', (c, id) => { kravInloggad(c); return medPatient(c, id, 'halsoarende', (atk) => { const x = synligt(atk); return vardkontakt.avvisa(atk, c.body, x.kontakter, x.diagnoser); }); });

  // Tidbok, väntelista, kallelser, incheckning och betalning (tidbok.js, Sussa 3.4.1 till 3.4.4). Varje åtgärd prövas i
  // behörighetsmotorn med handlingarna boka, kalla, checka_in och vantelista, och loggas på patienten. Listorna
  // (startsidan, tidboken och väntelistan) visar bara patienter med vårdrelation på vårdenheten, som arbetslistan.
  const medPost = (c, id, handling, fn) => { kravInloggad(c); const v = tidbok.vantelistaRad(c.db, id); return medPatient(c, v.patient_id, handling, (atk) => fn(atk, v)); };
  const medBokning = (c, id, handling, fn) => { kravInloggad(c); const b = tidbok.bokningRad(c.db, id); return medPatient(c, b.patient_id, handling, (atk) => fn(atk, b)); };
  // Runda 6, r4: Dagens arbete för en fritt vald period och med användarens val av delar, och tidboken med användarens
  // val av vårdgivare och resurser. Läkare och sjuksköterskor läser tidboken utan att boka.
  rutt('GET', '/api/idag', (c) => {
    kravRoll(c, 'boka');
    return { ...tidbok.startsida(c.db, c.personal, r4Period(c.url.searchParams)), vy: planering.vyFor(c.db, c.personal, 'idag').installning };
  });
  rutt('GET', '/api/tidbok', (c) => {
    kravRoll(c, 'las_tidbok');
    const d = c.url.searchParams.get('datum');
    return tidbok.tidbok(c.db, c.personal, { datum: /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d : idag(), avidentifierad: c.url.searchParams.get('avidentifierad') === '1', vy: planering.vyFor(c.db, c.personal, 'tidbok').installning });
  });
  rutt('GET', '/api/vantelista', (c) => { kravRoll(c, 'vantelista'); return { poster: tidbok.vantelista(c.db, c.personal), prioriteringsorsaker: tidbok.OMPRIORITERING, demoregler: tidbok.DEMOREGLER.text }; });
  rutt('GET', '/api/vantelista/:id/forslag', (c, id) => medPost(c, id, 'boka', (atk, v) => tidbok.forslagForPost(atk, v)));
  rutt('POST', '/api/vantelista/:id/boka', (c, id) => medPost(c, id, 'boka', (atk, v) => tidbok.boka(atk, v, c.body)));
  rutt('POST', '/api/vantelista/:id/prioritet', (c, id) => medPost(c, id, 'vantelista', (atk, v) => tidbok.prioritera(atk, v, c.body)));
  rutt('POST', '/api/patient/:id/vantelista', (c, id) => { kravInloggad(c); return medPatient(c, id, 'vantelista', (atk) => tidbok.nyPost(atk, c.body)); });
  rutt('GET', '/api/patient/:id/bokningar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk) => tidbok.patientensBokningar(atk)); });
  // Runda 5, r1: läkaren sätter upp ett återbesök som systemet föreslår (aterbesok.js).
  rutt('GET', '/api/patient/:id/aterbesok/forslag', (c, id) => {
    kravInloggad(c);
    const a = c.url.searchParams.get('anteckningId');
    return medPatient(c, id, 'skriv_journal', (atk) => aterbesok.forslag(atk, { anteckningId: a ? Number(a) : null }));
  });
  rutt('POST', '/api/patient/:id/aterbesok', (c, id) => { kravInloggad(c); return medPatient(c, id, 'skriv_journal', (atk) => aterbesok.skapa(atk, c.body)); });
  rutt('GET', '/api/bokning/:id/forslag', (c, id) => medBokning(c, id, 'boka', (atk, b) => tidbok.forslagForBokning(atk, b)));
  rutt('POST', '/api/bokning/:id/omboka', (c, id) => medBokning(c, id, 'boka', (atk, b) => tidbok.omboka(atk, b, c.body)));
  rutt('POST', '/api/bokning/:id/avboka', (c, id) => medBokning(c, id, 'boka', (atk, b) => tidbok.avboka(atk, b, c.body)));
  rutt('POST', '/api/bokning/:id/checka-in', (c, id) => medBokning(c, id, 'checka_in', (atk, b) => tidbok.checkaIn(atk, b)));
  rutt('POST', '/api/bokning/:id/betala', (c, id) => medBokning(c, id, 'checka_in', (atk, b) => tidbok.betala(atk, b, c.body)));
  rutt('POST', '/api/kallelse/:id/klar', (c, id) => {
    kravInloggad(c);
    const k = c.db.query('SELECT * FROM kallelser WHERE id = ?').get(Number(id));
    if (!k) throw new Fel(404, 'Kallelsen finns inte.', 'saknas');
    return medPatient(c, k.patient_id, 'kalla', (atk) => tidbok.kallelseKlar(atk, k));
  });
  rutt('POST', '/api/tid/:id/kalla', (c, id) => { kravRoll(c, 'kalla'); return tidbok.kallaGrupp(c.db, c.personal, tidbok.tidRad(c.db, id), { valFor: (pid) => valFor(c.s, pid), Atkomst }); });
  rutt('POST', '/api/bevakning/:id/klar', (c, id) => { kravInloggad(c); const b = tidbok.bevakningRad(c.db, id); return medPatient(c, b.patient_id, 'vantelista', (atk) => tidbok.bevakningKlar(atk, b)); });
  // Incheckningsskärmen i väntrummet (simulerad). Skärmen öppnas av vårdadministratören och visar aldrig namn.
  // Högst 10 misslyckade försök per session på 15 minuter, så att skärmen inte kan användas för att pröva personnummer.
  const SKARM_FORSOK = 10;
  rutt('POST', '/api/incheckning/skarm', (c) => {
    kravRoll(c, 'checka_in');
    const forsok = (c.s.skarmForsok ?? []).filter(t => t > Date.now() - 15 * 60_000);
    c.s.skarmForsok = forsok;
    if (forsok.length >= SKARM_FORSOK) throw new Fel(403, 'För många försök på skärmen. Be personalen i receptionen om hjälp.', 'nekad');
    const far = (pid) => new Atkomst(c.db, c.personal, pid, {}, 'checka_in').prova('checka_in').tillaten;
    const { patientId, bokningId, ...ut } = tidbok.skarmIncheckning(c.db, c.personal, c.body.personnummer, { far });
    if (!ut.ok) forsok.push(Date.now());
    if (ut.ok) {
      new Atkomst(c.db, c.personal, patientId, {}, 'checka_in').logga('checka_in', 'administrativ', `incheckning:skarm:bokning:${bokningId}`, 'tillaten',
        'Patienten checkade in på incheckningsskärmen i väntrummet.');
    }
    return ut;
  });

  rutt('GET', '/api/inkorg', (c) => {
    const p = kravInloggad(c);
    const med = (x) => ({ ...x, patient: patientKort(patientRad(c.db, x.patientId)) });
    return medSymbol(c, {
      osigneradeAnteckningar: journal.osigneradeFor(c.db, p.id).map(med),
      okvitteradeSvar: kanRoll(p, 'kvittera_svar') ? remiss.okvitteradeSvar(c.db, p) : [],
      larm: p.yrke === 'logggranskare' ? [] : remiss.larmForEnhet(c.db, p),
      nllAvvikelser: kanRoll(p, 'las_lakemedel') ? lakemedel.nllAvvikelser(c.db, p).map(med) : [],
      dubbletter: kanRoll(p, 'sla_samman') ? dubbletterIInkorg(c) : [],
      ...utdata.inkorg(c.db, p),
      // Delegeringar som går ut inom 30 dagar, för sjuksköterskan på samma vårdenhet (runda 5).
      delegeringarSomGarUt: delegering.paminnelser(c.db, p),
      // Återinsättning efter uppehåll med antikoagulantia, för läkaren (runda 5, r4).
      aterinsattningar: aterinsattningIInkorg(c),
      // Vårdhändelser som avbokades eftersom remissen avvisades, för den ordinerande läkaren (runda 5, r4).
      avbokadeVardhandelser: avbokadeIInkorg(c),
      // Runda 6, r3: vårdplaner att följa upp, tvångsvårdens frister och samordnad planering (r3-rutter.js).
      ...r3.inkorg(c, { patientKort, patientRad }),
      // NEWS2 eller ett enskilt värde som kräver åtgärd, för sjuksköterskan och läkaren (runda 6, r1).
      news2Larm: news2IInkorg(c),
      // Runda 6, r2: passerade uppföljningar, muntliga ordinationer att signera, fördjupade genomgångar och licenser.
      ...lakemedelsstodInkorg(c, patientKort, patientRad),
      // Runda 6, r6: mallar som väntar på den mallansvariga läkarens godkännande, utan patientuppgifter.
      ...lakemedelsansvarInkorg(c),
      // Runda 6, r4: egna bevakningar som har löpt ut, den inloggades och vårdenhetens.
      ...r4Inkorg(c),
      // Runda 7, r4: patienter som kan tillfrågas om en spärr efter en omorganisation, för vårdadministratören.
      ...systemforvaltningInkorg(c),
      // Runda 7, r5: fel i rapporterna till myndigheter och register som den inloggade kan rätta.
      ...r7r5Inkorg(c, patientKort, patientRad, valFor),
      // Runda 7, r6: avvikande tillväxt, mätningar hemma att bekräfta och hälsobesök att boka i barnhälsovården.
      ...bhvInkorg(c, patientKort, patientRad, valFor),
      // Runda 8, r2: remisser att signera som har skrivits på läkarens uppdrag, och remisser fördelade till läkaren.
      ...remissR8.inkorg(c, patientKort, patientRad),
      // Runda 10, r6: beslut som har registrerats på läkarens uppdrag och väntar på läkarens kvittens.
      ...remissR10.inkorg(c, patientKort, patientRad),
      // Runda 10, r6: avvikelser från transfusionskontrollen för den som beställde blodet (blod.js).
      ...blodAvvikelserIInkorg(c, patientKort, patientRad, valFor),
      // Runda 8, r1: provsvar att vidimera, beställningar på uppdrag att signera och kritiska provsvar.
      ...labbInkorg(c, patientKort, patientRad, valFor),
      // Runda 9, r1: beredningar som väntar på kontroll av en annan sjuksköterska eller läkare, utan patientuppgifter.
      ...r9r1Inkorg(c, patientKort, patientRad, valFor),
      // Runda 10, r5: doser av högriskläkemedel som väntar på kollegakontroll, utan patientuppgifter.
      ...r10r5Inkorg(c, patientKort, patientRad, valFor),
      // Runda 10, r4: förslag om donation till vårdenhetens donationsansvariga (donation.js).
      ...r10r4Inkorg(c, patientKort, patientRad, valFor),
      // Runda 11, r4: regimversioner att godkänna och patienternas rapporter om cytostatika att ringa om.
      ...r11r4.inkorg(c, patientKort, patientRad, valFor),
    });
  });
  // Runda 6, r1: NEWS2-larmen loggas på patienten en gång per session och mätomgång, som raderna om återinsättning.
  function news2IInkorg(c) {
    const loggade = (c.s.news2Loggad ??= new Set());
    return vitalparametrar.larmForInkorg(c.db, c.personal, (pid) => valFor(c.s, pid)).map(r => {
      const resurs = `inkorg:news2:${r.ankareId}`;
      if (!loggade.has(resurs)) {
        loggade.add(resurs);
        const a = new Atkomst(c.db, c.personal, r.patientId, valFor(c.s, r.patientId), 'las_matvarden');
        a.logga('las_matvarden', a.prova('las_matvarden').grund, resurs);
      }
      return { ...r, patient: patientKort(patientRad(c.db, r.patientId)) };
    });
  }
  // Runda 6, r1: uppmärksamhetssymbolen på varje rad i inkorgen som har en patient (Sussa 3.1.5.2). Samma regler som i
  // patienthuvudet: symbolen visas bara när den inloggade får läsa patientens översikt, annars är den tom.
  function medSymbol(c, inkorg) {
    for (const lista of Object.values(inkorg)) {
      if (!Array.isArray(lista)) continue;
      for (const r of lista) {
        if (!r?.patient?.id) continue;
        const symbol = uppmarksamhet.symbolFor(c.db, c.personal, r.patient.id, valFor(c.s, r.patient.id));
        if (symbol) r.patient = { ...r.patient, uppmarksamhet: symbol };
      }
    }
    return inkorg;
  }
  // Återinsättning efter uppehåll (runda 5, r4). Behörigheten prövas i aterinsattning.js. Varje rad visar läkemedlet
  // för en patient och loggas därför på patienten, en gång per session och ordination, så att inkorgens uppdateringar
  // inte fyller loggen.
  rutt('POST', '/api/ordination/:id/aterinsattning/avsluta', (c, id) => { kravInloggad(c); return aterinsattning.avsluta(c.db, c.personal, id, c.body); });
  // Raden utan grund i inkorgen (runda 5, r4). Läkaren anger syftet, nödåtkomsten registreras och loggas som vanligt,
  // och först då får klienten veta vilken patient det gäller.
  rutt('POST', '/api/ordination/:id/avbokad/nodatkomst', (c, id) => {
    kravInloggad(c);
    const patientId = vardhandelse.avbokadUtanGrund(c.db, c.personal, id);
    registreraVal(c, patientRad(c.db, patientId), { typ: 'nodatkomst', syfte: c.body?.syfte });
    return { href: `#/patient/${encodeURIComponent(patientId)}/lakemedel/utsatt-${encodeURIComponent(id)}` };
  });
  function avbokadeIInkorg(c) {
    const loggade = (c.s.vardhandelseAvbokadLoggad ??= new Set());
    return vardhandelse.avbokadeIInkorg(c.db, c.personal).map(r => {
      // En rad utan grund visar inga patientuppgifter och loggas som sådan (runda 5, r4).
      const resurs = `inkorg:vardhandelse_avbokad${r.utanPatient ? '_utan_grund' : ''}:${r.ordinationId}`;
      if (!loggade.has(resurs)) {
        loggade.add(resurs);
        const a = new Atkomst(c.db, c.personal, r.patientId, {}, 'las_lakemedel');
        const p = a.prova('las_lakemedel');
        a.logga('las_lakemedel', p.tillaten ? p.grund : 'administrativ', resurs);
      }
      if (r.utanPatient) { const { patientId: _pid, ...rest } = r; return rest; }
      return { ...r, patient: patientKort(patientRad(c.db, r.patientId)) };
    });
  }
  function aterinsattningIInkorg(c) {
    const loggade = (c.s.aterinsattningLoggad ??= new Set());
    return aterinsattning.inkorg(c.db, c.personal).map(r => {
      if (!loggade.has(r.ordinationId)) {
        loggade.add(r.ordinationId);
        const a = new Atkomst(c.db, c.personal, r.patientId, {}, 'las_lakemedel');
        a.logga('las_lakemedel', a.prova('las_lakemedel').grund, `inkorg:aterinsattning:${r.ordinationId}`);
      }
      return { ...r, patient: patientKort(patientRad(c.db, r.patientId)) };
    });
  }

  // Identiteter (Sussa 3.1.1). Systemet tolkar numret, skapar reservnummer, byter identitet när ett personnummer blir
  // känt och föreslår själv sammanslagning av dubbletter, som en vårdadministratör bekräftar. Allt prövas i
  // behörighetsmotorn och loggas.
  const identitetKort = (p, visad = false) => ({
    ...patientKort(p), namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad), identitetstyp: p.id_typ, typText: identitet.TYPER[p.id_typ].text,
    fodd: p.skyddad && !visad ? null : p.fodd, kon: p.kon,
  });
  const lasHandling = (c) => (kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
  // Patienterna med en trolig dubblett, för vårdadministratörens inkorg. Bara patienter med vårdrelation på den egna
  // vårdenheten, och inga uppgifter om den andra journalen: de visas och loggas när förslaget öppnas.
  function dubbletterIInkorg(c) {
    const ut = [];
    for (const rad of arbetslista(c)) {
      const n = identitet.dubbletterFor(c.db, rad.id).length;
      if (n) ut.push({ patientId: rad.id, patient: patientKort(patientRad(c.db, rad.id)), antal: n });
    }
    return ut;
  }
  rutt('GET', '/api/identitet/tolka', (c) => {
    kravInloggad(c);
    const t = identitet.tolka(String(c.url.searchParams.get('q') ?? '').slice(0, 80));
    return { ...t, demoFel: identitet.demoKontroll(t) };
  });
  rutt('POST', '/api/patienter', (c) => {
    kravRoll(c, 'registrera_patient');
    const db = c.db;
    const atk = new Atkomst(db, c.personal, null, {}, 'registrera_patient');
    atk.krav('registrera_patient');
    let r;
    try { r = identitet.registrera(db, c.body, { idag: idag(), av: c.personal.id }); } catch (e) {
      if (e.kod === 'finns') e.extra = { patient: patientKort(patientRad(db, e.extra.patientId)) };
      throw e;
    }
    // Den nya patienten får en pågående vårdkontakt på den enhet som registrerade, så att vården kan dokumentera direkt.
    const enhet = db.query('SELECT namn FROM enheter WHERE id = ?').get(vardenhetFor(db, c.personal.enhet_id));
    const typ = /akut/i.test(enhet?.namn ?? '') ? 'akut' : 'oppenvard';
    db.query('INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, orsak) VALUES (?, ?, ?, ?, ?)').run(r.id, c.personal.enhet_id, typ, new Date().toISOString(), 'Registrerad som ny patient');
    atk.patientId = r.id;
    atk.logga('registrera_patient', c.personal.yrke === 'vardadministrator' ? 'administrativ' : 'vardrelation', `registrering:${r.typ}`);
    const p = patientRad(db, r.id);
    return [201, { patient: identitetKort(p, true), skapatReservnummer: r.skapatReservnummer }];
  });
  rutt('GET', '/api/patient/:id/identiteter', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, lasHandling(c), (atk, p) => {
      atk.krav(lasHandling(c));
      const db = c.db;
      const val = valFor(c.s, p.id);
      const visad = !p.skyddad || val.visa_identitet;
      const slaSamman = kanRoll(c.personal, 'sla_samman');
      const dubbletter = slaSamman ? identitet.dubbletterFor(db, p.id).map(d => {
        const annan = db.query('SELECT * FROM patienter WHERE id = ?').get(d.annan);
        // Att förslaget visas loggas på den andra journalen, som en sökträff.
        loggaRadFor(c, annan.id, 'dubblettkontroll', `dubblett:${p.id}`);
        return { annan: identitetKort(annan), kvar: d.till, grund: d.grund, grundText: identitet.GRUNDTEXT[d.grund] };
      }) : [];
      return {
        patientId: p.id, patient: identitetKort(p, visad), identiteter: identitet.identiteterUt(db, p.id, visad),
        sammanslagningar: identitet.sammanslagningarFor(db, p.id).map(s => ({ ...s, franPatient: identitetKort(db.query('SELECT * FROM patienter WHERE id = ?').get(s.fran), visad) })),
        dubbletter, kan: { andraIdentitet: kanRoll(c.personal, 'andra_identitet'), slaSamman },
      };
    });
  });
  rutt('POST', '/api/patient/:id/identitet', (c, id) => {
    kravRoll(c, 'andra_identitet');
    return medPatient(c, id, 'andra_identitet', (atk, p) => {
      atk.krav('andra_identitet');
      const text = typeof c.body.identitet === 'string' ? c.body.identitet : '';
      const t = identitet.tolka(text);
      if (!t.arIdentitet) throw new Fel(400, 'Det går inte att tolka som ett nummer. Skriv personnummer, samordningsnummer eller OID och nummer.', 'ogiltig', { falt: ['identitet'] });
      if (!t.ok) throw new Fel(400, t.fel, 'ogiltig', { falt: ['identitet'] });
      const demo = identitet.demoKontroll(t);
      if (demo) throw new Fel(400, demo, 'ogiltig', { falt: ['identitet'] });
      let r;
      try { r = identitet.nyIdentitet(c.db, p, t, { personal: c.personal }); } catch (e) {
        if (e.kod === 'dubblett') {
          atk.logga('andra_identitet', atk.grund(), `identitet:${t.typ}:dubblett`);
          const annan = c.db.query('SELECT * FROM patienter WHERE id = ?').get(e.extra.annanId);
          loggaRadFor(c, annan.id, 'dubblettkontroll', `dubblett:${p.id}`);
          e.extra = { annan: identitetKort(annan), kanSlaSamman: kanRoll(c.personal, 'sla_samman') };
        }
        throw e;
      }
      atk.logga('andra_identitet', atk.grund(), `identitet:${t.typ}:${r.utfall}`);
      return { utfall: r.utfall, identitet: { typ: t.typ, typText: t.typText, visning: t.visning, beskrivning: t.beskrivning } };
    });
  });
  rutt('POST', '/api/patient/:id/sammanslagning', (c, id) => {
    kravRoll(c, 'sla_samman');
    const p = patientRad(c.db, id);
    const atk = new Atkomst(c.db, c.personal, p.id, valFor(c.s, p.id), 'sla_samman');
    atk.krav('sla_samman');
    const med = typeof c.body.med === 'string' ? identitet.gallandeId(c.db, c.body.med) : null;
    const forslag = identitet.dubbletterFor(c.db, p.id).find(d => d.annan === med);
    if (!forslag) throw new Fel(400, 'Systemet har inget förslag om att slå samman de här journalerna. Två journaler slås bara samman när systemet har hittat att de troligen gäller samma person.', 'ogiltig', { falt: ['med'] });
    // Behörigheten prövas mot båda journalerna. Ett förslag om att två journaler gäller samma person är ingen behörighet:
    // annars kunde den som skriver in en annan patients nummer få tillgång till den patientens journal genom sammanslagningen.
    const annan = forslag.fran === p.id ? forslag.till : forslag.fran;
    const atkAnnan = new Atkomst(c.db, c.personal, annan, valFor(c.s, annan), 'sla_samman');
    atkAnnan.krav('sla_samman');
    const r = identitet.slaSamman(c.db, { fran: forslag.fran, till: forslag.till, personal: c.personal, grund: forslag.grund, loggGrund: atk.grund() });
    if (c.s.oppnade.delete(forslag.fran)) c.s.oppnade.add(forslag.till);
    return { till: r.till, fran: r.fran, antal: r.antal, patient: identitetKort(patientRad(c.db, r.till)) };
  });
  rutt('POST', '/api/patient/:id/dubblett/avfarda', (c, id) => {
    kravRoll(c, 'sla_samman');
    const p = patientRad(c.db, id);
    const atk = new Atkomst(c.db, c.personal, p.id, valFor(c.s, p.id), 'sla_samman');
    atk.krav('sla_samman');
    const med = typeof c.body.med === 'string' ? c.body.med : null;
    const forslag = identitet.dubbletterFor(c.db, p.id).find(d => d.annan === med);
    if (!forslag) throw new Fel(400, 'Det finns inget sådant förslag.', 'ogiltig', { falt: ['med'] });
    const nu = new Date().toISOString();
    c.db.query("UPDATE dubblettforslag SET status = 'avfardad', avgjord = ?, avgjord_av = ? WHERE status = 'oppen' AND ((fran_patient_id = ?3 AND till_patient_id = ?4) OR (fran_patient_id = ?4 AND till_patient_id = ?3))")
      .run(nu, c.personal.id, forslag.fran, forslag.till);
    c.db.query("INSERT INTO dubblettforslag (fran_patient_id, till_patient_id, grund, skapad, av, status, avgjord, avgjord_av) VALUES (?, ?, ?, ?, ?, 'avfardad', ?, ?)")
      .run(forslag.fran, forslag.till, forslag.grund, nu, c.personal.id, nu, c.personal.id);
    atk.logga('dubblett_avfardad', atk.grund(), `dubblett:${forslag.fran}>${forslag.till}`);
    return { ok: true };
  });
  // En loggrad om en annan journal än den som öppnades, till exempel när ett förslag om sammanslagning visar den.
  function loggaRadFor(c, patientId, handling, resurs) {
    new Atkomst(c.db, c.personal, patientId, {}, handling).logga(handling, 'administrativ', resurs);
  }

  // Loggraderna får patientens namn och personnummer, maskerade för skyddad identitet, så att granskaren ser vem raden gäller.
  const medPatientKort = (db, rader) => {
    const cache = new Map();
    return rader.map(r => {
      if (!r.patientId) return { ...r, patient: null };
      if (!cache.has(r.patientId)) {
        const p = db.query('SELECT * FROM patienter WHERE id = ?').get(r.patientId);
        cache.set(r.patientId, p ? patientKort(p) : null);
      }
      return { ...r, patient: cache.get(r.patientId) };
    });
  };
  rutt('GET', '/api/patient/:id/logglista', (c, id) => {
    kravInloggad(c);
    const p = patientRad(c.db, id);
    const atk = new Atkomst(c.db, c.personal, p.id, {}, 'las_logg');
    atk.krav('las_logg');
    atk.logga('las_logg', 'logggranskning', 'logglista');
    return { patientId: p.id, patient: patientKort(p), rader: medPatientKort(c.db, logg.lista(c.db, { patientId: identitet.allaPatientIdn(c.db, p.id) })), kedjaHel: logg.verifiera(c.db).hel };
  });
  rutt('GET', '/api/logg', (c) => {
    kravInloggad(c);
    const atk = new Atkomst(c.db, c.personal, null, {}, 'las_logg');
    atk.krav('las_logg');
    const q = c.url.searchParams;
    // Runda 9, r5: urvalet skyddsbehov visar åtkomster till uppgifter med mycket högt skyddsbehov.
    const flagga = ['nodatkomst', 'nekad', 'samtycke', 'vard', 'arkiv', 'skyddsbehov', 'alla'].includes(q.get('flagga')) ? q.get('flagga') : 'alla';
    const datum = (v, slut) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}${slut ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : v || null);
    const rader = medPatientKort(c.db, logg.lista(c.db, { flagga, fran: datum(q.get('fran'), false), till: datum(q.get('till'), true) }));
    atk.logga('las_logg', 'logggranskning', `logg:${flagga}`);
    const v = logg.verifiera(c.db);
    return { flagga, rader, kedjaHel: v.hel, verifiering: v };
  });

  // Min journal. Varje anrop prövar att invånaren får läsa just den journalen och loggar läsningen.
  // Nekade försök räknas per invånare och sandlåda, också över ut- och inloggningar.
  const nekadeFor = (c) => ((c.s.nekadeInvanare ??= {})[c.invanare.id] ??= { antal: 0 });
  const medMinJournal = (c, pid, resurs, fn) => {
    kravInvanare(c);
    const atk = new minJournal.InvanareAtkomst(c.db, c.invanare, pid, nekadeFor(c));
    atk.krav(resurs);
    const ut = fn(atk);
    if (!atk.loggad) atk.logga(resurs);
    return ut;
  };
  const MIN_DELAR = {
    oversikt: minJournal.oversikt, anteckningar: minJournal.anteckningar, diagnoser: minJournal.diagnoser, lakemedel: minJournal.lakemedel,
    provsvar: minJournal.provsvar, remisser: minJournal.remisser, vardkontakter: minJournal.vardkontakter, logglista: minJournal.logglista,
    sparrar: minJournal.sparrvy, tider: tidbok.minaTider,
  };
  // Runda 6, r4: språket för kallelserna.
  MIN_DELAR.sprak = planering.minSprak;
  // Runda 7, r3: patienten ser hela sitt högkostnadsskydd, med alla avgifter (ekonomi.js).
  MIN_DELAR.hogkostnadsskydd = ekonomi.minHogkostnadsskydd;
  // Runda 7, r6: barnets tillväxtkurvor och vaccinationer för vårdnadshavaren.
  MIN_DELAR.tillvaxt = minTillvaxt;
  // Runda 9, r2: patientens egna mätningar med status (medicinteknik.js).
  MIN_DELAR.egenmatning = (atk) => mtMinaMatningar(atk, journal.MATTYPER);
  // Runda 10, r7: meddelanden, ombud, vårdplaner, avgifter för tjänster och möteslänkar (r10r7-rutter.js).
  Object.assign(MIN_DELAR, r10r7MinDelar);
  // Runda 11, r3: graviditeten för kvinnan själv, och i huvudet om hon har en som visas (obstetrik.js).
  MIN_DELAR.graviditet = (atk) => minGraviditet(atk);
  // Runda 11, r4: den överlämnade perorala cytostatikabehandlingen och patientens rapporter.
  MIN_DELAR.cytostatika = (atk) => cytoMinBehandling(atk);
  // Runda 11, r6: patientens beställningar med status (labb-rutter.js).
  Object.assign(MIN_DELAR, labbMinDelar);
  rutt('GET', '/api/min/journal/:id', (c, id) => medMinJournal(c, id, 'min:journal', (atk) => ({ ...minJournal.huvud(atk), graviditet: harMinGraviditet(atk), ...cytoMinHuvud(atk) })));
  rutt('GET', '/api/min/journal/:id/:del', (c, id, del) => {
    if (!Object.hasOwn(MIN_DELAR, del)) throw new Fel(404, 'Okänd adress.', 'saknas');
    return medMinJournal(c, id, `min:${del}`, (atk) => MIN_DELAR[del](atk));
  });
  rutt('GET', '/api/min/journal/:id/anteckning/:aid', (c, id, aid) => medMinJournal(c, id, `min:anteckning:${Number(aid) || 0}`, (atk) => minJournal.anteckning(atk, aid)));
  rutt('POST', '/api/min/journal/:id/begaran', (c, id) => [201, medMinJournal(c, id, 'min:begaran', (atk) => minJournal.skapaBegaran(atk, c.body))]);
  // Patientens egna tider i Min journal: incheckning, ombokning, avbokning, bekräftelse, betalning och egen bokning.
  rutt('GET', '/api/min/journal/:id/bokning/:bid/forslag', (c, id, bid) => medMinJournal(c, id, `min:bokning:${Number(bid) || 0}:forslag`, (atk) => tidbok.minForslag(atk, bid)));
  const MIN_BOKNING = { 'checka-in': tidbok.minCheckaIn, omboka: tidbok.minOmboka, avboka: tidbok.minAvboka, bekrafta: tidbok.minBekrafta, betala: tidbok.minBetala };
  rutt('POST', '/api/min/journal/:id/bokning/:bid/:atgard', (c, id, bid, atgard) => {
    if (!Object.hasOwn(MIN_BOKNING, atgard)) throw new Fel(404, 'Okänd adress.', 'saknas');
    return medMinJournal(c, id, `min:bokning:${Number(bid) || 0}`, (atk) => MIN_BOKNING[atgard](atk, bid, c.body));
  });
  rutt('GET', '/api/min/journal/:id/boka/forslag', (c, id) => medMinJournal(c, id, 'min:boka:forslag', (atk) => tidbok.minNyaForslag(atk, c.url.searchParams.get('nyckel'))));
  rutt('POST', '/api/min/journal/:id/boka', (c, id) => medMinJournal(c, id, 'min:boka', (atk) => tidbok.minBoka(atk, c.body)));

  rutt('GET', '/api/migrering', (c) => {
    kravInloggad(c);
    const datatyper = c.db.query('SELECT * FROM migrering ORDER BY datatyp, kalla').all().map(m => ({
      datatyp: m.datatyp, kalla: m.kalla, antalKalla: m.antal_kalla, antalOverforda: m.antal_overforda, antalVerifierade: m.antal_verifierade,
      avvikelse: m.antal_kalla !== m.antal_overforda || m.antal_overforda !== m.antal_verifierade,
    }));
    const avvikelser = c.db.query('SELECT * FROM migrering_avvikelser ORDER BY id').all().map(a => ({
      id: a.id, patientId: a.patient_id, datatyp: a.datatyp, kalla: a.kalla, beskrivning: a.beskrivning, atgard: a.atgard, status: a.status,
    }));
    return { datatyper, avvikelser, summa: { antalKalla: datatyper.reduce((s, d) => s + d.antalKalla, 0), antalOverforda: datatyper.reduce((s, d) => s + d.antalOverforda, 0), antalVerifierade: datatyper.reduce((s, d) => s + d.antalVerifierade, 0) } };
  });
  rutt('GET', '/api/krav', () => kravregister(lasTestresultat(testresultat), undefined, lasKlientresultat(klientresultat)));
  // Sussas kravspecifikation med originalnummer, mappad till Vårdkällan och till de egna kraven (K1).
  rutt('GET', '/api/krav/sussa', () => {
    const resultat = lasTestresultat(testresultat);
    const klient = lasKlientresultat(klientresultat);
    return sussaRegister(resultat, klient, { egna: kravregister(resultat, undefined, klient) });
  });
  // Runda 8, r5: villkoren för version 1.0, räknade ur Sussa-registret, Sussas testfall och säkerhetsfynden (version.js).
  rutt('GET', '/api/krav/version', () => {
    const resultat = lasTestresultat(testresultat);
    const klient = lasKlientresultat(klientresultat);
    return villkor10(sussaRegister(resultat, klient, { egna: kravregister(resultat, undefined, klient) }), klient.sussaTestfall, { version: APPVERSION });
  });
  // Svarstidsmål (D5): p95 under 200 ms per endpoint.
  const MAL_P95 = 200;
  const medMal = (rader) => rader.map(r => ({ ...r, inomMal: r.p95 <= MAL_P95 }));
  rutt('GET', '/api/drift', (c) => ({ startad, sandladar: sessioner.size,
    // Runda 13, r2: hur många sandlådor som är i minnet och vilar på disk, taken och minnet.
    kapacitet: kapacitet(), mal: { p95Ms: MAL_P95 }, server: medMal(serverMatning.sammanstall()), sandlada: c.s ? medMal(c.s.matning.sammanstall()) : [], ...utdata.drift(c.db) }));
  // Runda 9, r6: systemuppbyggnaden med modulerna, de fem perspektiven och totalkostnaden ur serverns eget minne och
  // svarstider (arkitektur.js, Sussa 2.1.1.1). Inga patientuppgifter.
  rutt('GET', '/api/arkitektur', () => {
    const tider = serverMatning.sammanstall();
    const p95 = tider.length ? Math.max(...tider.map(t => t.p95 ?? 0)) : null;
    // Minnet per sandlåda är databasens storlek i minnet, i snitt över sandlådorna.
    // Runda 13, r2: bara sandlådorna i minnet, så att sidan inte läser in de vilande.
    const storlek = [...vakna].map(x => { try { const p = x.db.query('PRAGMA page_count').get().page_count; return p * x.db.query('PRAGMA page_size').get().page_size; } catch { return 0; } });
    const mb = storlek.length ? storlek.reduce((a, b) => a + b, 0) / storlek.length / 1048576 : null;
    return arkitektur.arkitektur({ matning: mb ? { mbPerSandlada: Math.round(mb * 10) / 10, p95Ms: p95, sandladar: sessioner.size } : null });
  });
  // Runda 11, r8: modulregistret (moduler.js). Statusen räknas ur gränssnittets kod, serverns rutter och Sussa-registret
  // med samma testresultat som kravsidan. Inga patientuppgifter, och sidan går att läsa utan inloggning.
  rutt('GET', '/api/moduler', () => {
    const resultat = lasTestresultat(testresultat);
    const register = sussaRegister(resultat, lasKlientresultat(klientresultat));
    const apiFinns = (vag) => R.some(([, re]) => re.test(modulExempel(vag)));
    return modulregister({ register, apiFinns });
  });
  utdataRutter({ rutt, kravInloggad, medPatient, valFor, version: APPVERSION });
  // Runda 6, r3.
  r3Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 8, r3.
  r8r3Rutter({ rutt, kravInloggad, medPatient, valFor });
  r1Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 6, r2: läkemedelsprocessen, del 2.
  lakemedelsstodRutter({ rutt, kravInloggad, medPatient });
  // Runda 6, r6.
  lakemedelsansvarRutter({ rutt, kravInloggad });
  // Runda 6, r5: tillämpningar i journalen, masterdata och täckningen av API:t. Skrivningen via FHIR går genom R.
  const oppetApi = skapaOppetApi({ R, sessioner, valFor, kontrolleraOrigin, avvisaFranAnnanWebbplats, hamtaSession, inloggade, origin, maxKropp: MAX_KROPP, ...oppetApiVal });
  oppetApi.registreraRutter({ rutt, kravInloggad, medPatient });
  // Runda 6, r4 (planering-rutter.js).
  r4Rutter({ rutt, kravInloggad, kravRoll, medPatient, medMinJournal });
  // Runda 8, r2 (remiss-r8.js).
  remissR8.registreraRutter({ rutt, kravInloggad, medPatient, efterBedomning: tidbok.efterBedomning, efterAvvisning: tidbok.efterAvvisning,
    knyt: (atk, ut, body) => vardkontakt.knyt(atk, 'remisser', ut, body) });
  // Runda 10, r6 (remiss-r10.js).
  remissR10.registreraRutter({ rutt, kravInloggad, medPatient, remissUt: remiss.remissUt, hamtaRad: remiss.hamtaRad });
  // Runda 7, r3 (ekonomi-rutter.js).
  ekonomiRutter({ rutt, kravInloggad, medPatient });
  // Runda 7, r4: systemförvaltningen.
  systemforvaltningRutter({ rutt, kravInloggad });
  // Runda 7, r5 (rapportering-rutter.js).
  r7r5Rutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal });
  // Runda 7, r6 (bhv-rutter.js).
  bhvRutter({ rutt, kravInloggad, medPatient, medMinJournal, valFor });
  // Runda 8, r1 (labb-rutter.js).
  labbRutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 9, r3 (r9r3-rutter.js).
  r9r3Rutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal });
  // Runda 11, r5 (r11r5-rutter.js).
  r11r5Rutter({ rutt, kravInloggad, medPatient });
  // Runda 7, r2: nyheter, övningar och intyg, och tillgänglighetsredogörelsen med testernas status.
  utbildningRutter({ rutt, kravInloggad });
  // Runda 8, r5: epikrisens förslag och flera mätvärden på en gång (r5-rutter.js).
  r5Rutter({ rutt, kravInloggad, medPatient });
  // Runda 9, r2: medicinteknisk utrustning, anestesi och intensivvård. Mottagningen från utrustningen har egna nycklar.
  const mtNycklar = mtNyckellager();
  mtRutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal, nycklar: mtNycklar });
  const mtMottag = mtMottagning({ nycklar: mtNycklar, finns: (s) => [...sessioner.values()].includes(s), maxKropp: MAX_KROPP });
  // Runda 10, r6: producentsystemen anropar /ps med anslutningens nyckel, utan session.
  const psNycklar = produktionssystem.skapaNyckellager();
  produktionssystem.registreraRutter({ rutt, kravInloggad, nycklar: psNycklar });
  const psApi = produktionssystem.skapaProducentApi({ nycklar: psNycklar, finns: (s) => [...sessioner.values()].includes(s), maxKropp: MAX_KROPP });
  // Runda 9, r5: skyddsbehov, signering och certifikat, e-arkivet och miljöerna (runda9-r5-rutter.js).
  r9r5Rutter({ rutt, kravInloggad, kravRoll, medPatient, version: APPVERSION });
  // Runda 9, r1 (r9r1-rutter.js).
  r9r1Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 9, r7 (r9r7-rutter.js).
  r9r7Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 10, r1 (r10r1-rutter.js).
  r10r1Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 10, r5 (runda10-r5-rutter.js).
  r10r5Rutter({ rutt, kravInloggad, medPatient, valFor, patientRad, patientKort });
  // Runda 9, r4 (arkitektur-rutter.js).
  r9r4Rutter({ rutt, kravInloggad });
  // Runda 10, r2 (runda10-r2-rutter.js).
  r10r2Rutter({ rutt, kravInloggad, medPatient, valFor, patientKort });
  // Runda 10, r3 (r10r3-rutter.js).
  r10r3Rutter({ rutt, kravInloggad, medPatient });
  // Runda 10, r4 (runda10-r4-rutter.js).
  r10r4Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 11, r4 (r11r4-rutter.js).
  r11r4.registreraRutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal });
  // Runda 10, r7 (r10r7-rutter.js). Kalenderlänkarna finns som HMAC i minnet och i sandlådan.
  const kalender = skapaKalenderlager();
  r10r7Rutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal, kalender });
  // Runda 11, r3: graviditet, förlossning, BB och Graviditetsregistret (r11r3-rutter.js).
  r11r3Rutter({ rutt, kravInloggad, medPatient, valFor });
  // Runda 11, r7 (r11r7-rutter.js).
  r11r7Rutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal });
  // Runda 12, r1 (r12r1-rutter.js).
  r12r1Rutter({ rutt, kravInloggad });
  // Runda 12, r2.
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 3): efter inläsningen av en kopia loggas sessionen ut, så att
  // nästa inloggning prövas mot den inlästa sandlådan med dess faktorer. Läskopiorna hör till den gamla databasen.
  const loggaUtAlla = (s) => {
    oppetApi.aterkalla(s, 'Åtkomstbiljetten återkallades när en säkerhetskopia lästes in.');
    s.personalId = null; s.uppdrag = null; s.invanareId = null; s.val = {}; s.lasnyckel = null; s.oppnade = new Set();
    s.vantande = null; s.flerfaktorMetod = null; s.flerfaktorUtmaning = null; s.kopior = new Map();
  };
  r12r2Rutter({ rutt, kravInloggad, testresultat, kopior, migrera, loggaUtAlla });
  // Fortsätt arbeta: anropet räknas som aktivitet och förlänger inloggningen. Demoläget flyttar tiden så att varningen
  // visas direkt (bara i den egna sandlådan).
  const kravNagon = (c) => { if (!c.personal && !c.invanare) throw new Fel(401, 'Logga in först.', 'ej_inloggad'); };
  rutt('POST', '/api/session/forlang', (c) => { kravNagon(c); return { inloggning: inloggningUt(c.s) }; });
  rutt('POST', '/api/demo/inloggning-gar-ut', (c) => {
    kravNagon(c);
    const sek = Math.max(5, Math.min(minuterFor(c.s) * 60, Math.round(Number(c.body.sekunder) || 270)));
    c.s.aktiv = Date.now() - inloggningMs(c.s) + sek * 1000;
    return { inloggning: inloggningUt(c.s) };
  });
  rutt('GET', '/api/tillganglighet', () => {
    const resultat = lasTestresultat(testresultat);
    return tillganglighet([...(resultat?.tester ?? []), ...lasKlientresultat(klientresultat).tester]);
  });

  // Endpoints som inte behöver en sandlåda.
  const UTAN_SESSION = new Set(['/api/health', '/api/krav', '/api/krav/sussa', '/api/krav/version', '/api/drift', '/api/lasekopia/krypterad-logg', '/api/tillganglighet']);
  // Runda 9, r5: autentiseringstjänstens nycklar och konfiguration.
  for (const v of ['/api/idp/jwks', '/api/idp/.well-known/openid-configuration']) UTAN_SESSION.add(v);
  // Runda 11, r8: modulsidan är offentlig.
  UTAN_SESSION.add('/api/moduler');

  async function api(req, server, url, c) {
    if (url.pathname === '/api/health') return json({ ok: true, sandladar: sessioner.size, version: APPVERSION, gransnitt: gransnittVersion(),
      // Runda 12, r2: programmets schemaversion, den högsta migreringen det känner till (releaser.js).
      schemaversion: Math.max(0, ...r12r2Migreringar.map(m => m.id)),
      // Runda 11, r1: bara i en testcontainer med falsk klocka, så att Playwright kan ställa webbläsarens klocka lika.
      ...(TESTKLOCKA ? { testklocka: new Date().toISOString() } : {}) });
    // Runda 9, r5: länken till en ny miljö byter session utan att skapa en sandlåda.
    if (req.method === 'GET' && /^\/api\/miljoer\/oppna\/[A-Za-z0-9_-]{32}$/.test(url.pathname)) return oppnaMiljo(req, url);
    // Runda 10, r7: kalenderprenumerationen hämtas av ett kalenderprogram utan session (r10r7-rutter.js).
    if (req.method === 'GET' && url.pathname.startsWith('/api/kalender/')) { const k = kalenderSvar(url, { kalender, sessioner }); if (k) return k; }
    const metod = req.method;
    // Runda 7, r1: klientens adress, för gränsen per skapare av testtillfällen.
    c.ip = klientIp(req, server);
    // Runda 13, r2: tidsbudgeten för adressen prövas före allt annat, också före en ny sandlåda.
    kravBudget(c, null);
    if (metod !== 'GET' && metod !== 'HEAD') kontrolleraOrigin(req);
    let traff = null;
    for (const [m, re, fn] of R) {
      const x = url.pathname.match(re);
      if (x && m === metod) { traff = [fn, x.slice(1).map(decodeURIComponent)]; break; }
      if (x) traff = traff ?? 'metod';
    }
    if (!traff) throw new Fel(404, 'Okänd adress.', 'saknas');
    if (traff === 'metod') throw new Fel(405, 'Metoden stöds inte.', 'ogiltig');
    let sess = hamtaSession(req);
    // Runda 13, r2: sandlådans tidsbudget, som följer sandlådan också när den har vilat.
    if (sess) kravBudget(c, sess.s);
    if (!sess && !UTAN_SESSION.has(url.pathname)) sess = skapaSession(req, server);
    // Runda 7, r4: en förberedd omorganisation genomförs av systemet den dag den gäller, före allt annat i anropet.
    if (sess) systemforvaltningEfterDatum(sess.s.db);
    // Runda 8, r1: det simulerade laboratoriet svarar på det som har hunnit bli klart.
    if (sess) labbEfterTid(sess.s.db);
    // Runda 9, r2: den simulerade utrustningen skickar det som har hunnit mätas.
    if (sess) mtEfterTid(sess.s.db);
    // Runda 9, r4: masterdatan läses in från källorna efter schemat.
    if (sess) masterdataEfterTid(sess.s.db);
    if (sess) Object.assign(c, { s: sess.s, sid: sess.sid, ny: sess.ny, db: sess.s.db, ...inloggade(sess.s) });
    if (c.invanare && url.pathname.startsWith('/api/min/')) avvisaFranAnnanWebbplats(req);
    c.body = metod === 'GET' ? {} : await lasKropp(req);
    c.url = url;
    // Runda 11, r5: en rutt kan svara med ett löfte (avkodning och miniatyrer av bilder görs asynkront i bildmedia.js).
    let ut = await traff[0](c, ...traff[1]);
    // En fil, till exempel exportpaketet eller datauttaget, går ut som den är.
    if (ut instanceof Response) return ut;
    let status = 200;
    if (Array.isArray(ut) && typeof ut[0] === 'number') [status, ut] = ut;
    // Ny sessionsnyckel vid inloggning, samma sandlåda.
    if (c.rotera && c.sid) {
      // Runda 13, r2: en sandlåda där någon har loggat in lever i åtta timmar.
      c.s.harLoggatIn = true;
      sessioner.delete(c.sid);
      c.sid = slumpId();
      sessioner.set(c.sid, c.s);
      c.ny = true;
    }
    // Runda 7, r2: varje svar till en inloggad säger när inloggningen går ut, så att gränssnittet kan varna i tid.
    const garUt = inloggningUt(c.s)?.garUt;
    return json(ut, status, { ...(c.ny ? { 'Set-Cookie': kaka(c.sid) } : {}), ...(garUt ? { 'X-Inloggning-Gar-Ut': garUt } : {}) });
  }

  // Sessionskakan är SameSite=Lax, så en länk från en annan webbplats skickar med den. Invånarens läsningar loggas, och
  // ett anrop som webbläsaren märker som en navigering från en annan webbplats avvisas, så att ingen annan sida kan få
  // invånaren att göra åtkomster i sitt namn. Klienter utanför webbläsaren skickar inte rubriken.
  function avvisaFranAnnanWebbplats(req) {
    if (req.headers.get('sec-fetch-site') === 'cross-site') throw new Fel(403, 'Anropet kom från en annan webbplats.', 'nekad');
  }

  // Den inloggade personalen eller invånaren, aldrig båda. Skulle båda vara satta räknas ingen som inloggad.
  function inloggade(s) {
    let personal = personalRad(s.db, s.personalId);
    // Runda 9, r5: medarbetaruppdraget prövas mot masterdata i varje anrop (idp.uppdragGaller).
    if (personal) {
      const orsak = idp.uppdragGaller(s.db, personal, s.uppdrag);
      if (orsak) { loggaUtOgiltigtUppdrag(s, personal, orsak); personal = null; }
    }
    const invanare = minJournal.invanareRad(s.db, s.invanareId);
    if (personal && invanare) return { personal: null, invanare: null };
    return { personal: personal ?? null, invanare };
  }

  // Runda 6, r4: incheckning genom FHIR med PATCH på Appointment och Encounter (tidbok-fhir.js). Samma session,
  // ursprungskontroll och behörighet som resten av API:t. Andra skrivningar svarar som förut.
  async function fhirIncheckning(req, url, c) {
    kontrolleraOrigin(req);
    const sess = hamtaSession(req);
    if (sess) Object.assign(c, { s: sess.s, db: sess.s.db, ...inloggade(sess.s) });
    if (c.invanare) avvisaFranAnnanWebbplats(req);
    if (!c.db) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    const langd = Number(req.headers.get('content-length') || 0);
    const kropp = langd > MAX_KROPP ? '' : await req.text();
    if (kropp.length > MAX_KROPP) throw new Fel(413, 'För stor förfrågan.', 'ogiltig');
    const delar = url.pathname.replace(/^\/fhir\/?/, '').split('/').filter(Boolean);
    const nekade = c.invanare ? ((c.s.nekadeInvanare ??= {})[c.invanare.id] ??= { antal: 0 }) : null;
    const r = tidbokFhir.skriv({ db: c.db, personal: c.personal, invanare: c.invanare ?? null, nekade, valFor: (pid) => valFor(c.s, pid) }, delar, { kropp, typ: req.headers.get('content-type') });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  async function fhirSvar(req, url, c) {
    // Runda 6, r5: skrivning, prenumerationer, åtkomstbiljetter och SMART-konfigurationen.
    const r5 = await oppetApi.fhir(req, url, c);
    if (r5) return r5;
    const sess = hamtaSession(req);
    // Runda 13, r2: tidsbudgeten gäller också FHIR-API:t.
    kravBudget(c, sess?.s ?? null);
    // Runda 7, r4: förberedda omorganisationer som gäller i dag genomförs först.
    if (sess) systemforvaltningEfterDatum(sess.s.db);
    // Runda 8, r1: det simulerade laboratoriet svarar på det som har hunnit bli klart.
    if (sess) labbEfterTid(sess.s.db);
    if (sess) mtEfterTid(sess.s.db);
    if (sess) Object.assign(c, { s: sess.s, db: sess.s.db, ...inloggade(sess.s) });
    if (c.invanare) avvisaFranAnnanWebbplats(req);
    const base = origin || `${url.protocol}//${url.host}`;
    if (req.method !== 'GET') throw new Fel(405, 'Bara läsning stöds i FHIR-API:t.', 'ogiltig');
    const db = c.db;
    if (!db && !fhir.oppenSokvag(url.pathname.replace(/\/+$/, ''))) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    const nekade = c.invanare ? ((c.s.nekadeInvanare ??= {})[c.invanare.id] ??= { antal: 0 }) : null;
    const r = fhir.hantera({ db, personal: c.personal, invanare: c.invanare ?? null, nekade, valFor: (pid) => valFor(c.s, pid), url, base });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const server = Bun.serve({
    port, hostname,
    // Ingen förfrågan behöver mer än 64 kB. Taket gäller också kroppar utan Content-Length.
    maxRequestBodySize: MAX_KROPP * 2,
    async fetch(req, srv) {
      const t0 = performance.now();
      const url = new URL(req.url);
      // Runda 13, r2: adressen som HMAC, för taken per adress. Hälsokontrollen räknas inte.
      const c = url.pathname === '/api/health' ? {} : { adress: adressHmac(klientIp(req, srv)) };
      let svar;
      try {
        if (url.pathname.startsWith('/api/')) svar = await api(req, srv, url, c);
        else if (url.pathname.startsWith('/fhir/') && req.method === 'PATCH') svar = await fhirIncheckning(req, url, c);
        else if (url.pathname === '/fhir' || url.pathname.startsWith('/fhir/')) svar = await fhirSvar(req, url, c);
        // Runda 6, r5: OAuth 2.0 för SMART on FHIR.
        else if (url.pathname.startsWith('/oauth/')) svar = await oppetApi.oauth(req, url, c, { arbetslista });
        // Runda 9, r2: mottagningen från medicinteknisk utrustning, med utrustningens nyckel och utan session.
        else if (url.pathname === '/mt' || url.pathname.startsWith('/mt/')) svar = await mtMottag(req, url);
        // Runda 10, r6: producentsystemen för beställning och svar.
        else if (url.pathname === '/ps' || url.pathname.startsWith('/ps/')) svar = await psApi(req, url);
        else if (req.method !== 'GET' && req.method !== 'HEAD') svar = new Response('Metoden stöds inte.', { status: 405 });
        else svar = (await statisk(url.pathname)) ?? new Response('Sidan finns inte.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } catch (e) {
        const arFhir = url.pathname.startsWith('/fhir');
        if (e instanceof Fel) {
          c.felkod = e.kod;
          // Runda 9, r5: orsaken till en misslyckad inloggning till säkerhetsloggen. Texten är serverns egen.
          c.feltext = e.message;
          svar = arFhir
            ? new Response(JSON.stringify(fhir.utfall(e.status, e.kod, e.message)), { status: e.status, headers: { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' } })
            : json({ fel: e.message, kod: e.kod, ...e.extra }, e.status, { ...(c.ny ? { 'Set-Cookie': kaka(c.sid) } : {}),
              // Runda 13, r2: när demon är full säger svaret när det är lönt att försöka igen.
              ...(e.kod === 'demo_full' ? { 'retry-after': String(e.extra.forsokIgenSekunder), 'x-vk-full': '1' } : {}) });
        } else if (e?.code === 'SQLITE_FULL') {
          // Runda 13, r2: sandlådans databas har nått sitt tak.
          svar = json({ fel: `Sandlådan är full. En sandlåda får vara högst ${maxSandladaMb} MB i demon. Ta bort något som du har lagt in, eller återställ demon för att börja om.`, kod: 'sandlada_full' }, 507);
        } else if (e?.code?.startsWith?.('SQLITE_CONSTRAINT')) {
          svar = json({ fel: 'Ändringen är inte tillåten.', kod: 'ogiltig' }, 400);
        } else {
          console.error(new Date().toISOString(), url.pathname, e);
          svar = json({ fel: 'Något gick fel på servern. Försök igen.', kod: 'fel' }, 500);
        }
      }
      const ms = performance.now() - t0;
      svar.headers.set('Server-Timing', `app;dur=${ms.toFixed(1)}`);
      // Okända sökvägar samlas i en nyckel så att mätningen inte växer med vad besökare hittar på.
      const nyckel = [404, 405].includes(svar.status) ? `${req.method} okänd` : normaliseraVag(req.method, url.pathname);
      // Runda 6, r1: säkerhetshändelser i sandlådans säkerhetslogg (Sussa 5.3.1.12). Ett fel i loggningen stoppar aldrig svaret.
      if (c.s) {
        try {
          sakerhetslogg.efterAnrop(c.s.db, { nyckel, status: svar.status, kod: c.felkod ?? null, fel: c.feltext ?? null, fore: { personal: c.personal, invanare: c.invanare }, efter: inloggade(c.s) });
        } catch (e) { console.error('Säkerhetsloggen:', e.message); }
      }
      // Runda 6, r5: ändringarna i sandlådan ger meddelanden till prenumerationerna.
      if (c.s) oppetApi.efterAnrop(c.s, origin || `${url.protocol}//${url.host}`);
      serverMatning.lagg(nyckel, ms);
      if (c.s?.matning) c.s.matning.lagg(nyckel, ms);
      // Runda 13, r2: anropets tid räknas mot sandlådans och adressens budget, sandlådans storlek räknas för minnet, och
      // sandlådan får flyttas till disk igen.
      if (c.adress) { let f = budgetAdress.get(c.adress); if (!f) budgetAdress.set(c.adress, (f = nyttFonster())); laggTillTid(f, ms); }
      if (c.s) {
        laggTillTid((c.s.budget ??= nyttFonster()), ms);
        const vdb = c.s.dbOmVaken;
        if (vdb) { try { c.s.dbByte = vdb.query('PRAGMA page_count').get().page_count * vdb.query('PRAGMA page_size').get().page_size; } catch { /* stängd */ } }
      }
      slappa(req);
      return svar;
    },
  });

  return {
    server, sessioner, port: server.port, url: `http://127.0.0.1:${server.port}`, spara, oppetApi,
    kopior, stadaKopior,
    stopp() { clearInterval(stadningsTimer); clearInterval(vilaTimer); if (kopieSchema) clearInterval(kopieSchema); server.stop(true); for (const s of sessioner.values()) { s.dbOmVaken?.close(); s.db = null; } sessioner.clear(); anvandartestDb.close(); },
    // Runda 13, r2: vilan och städningen med en vald tid, för testerna och lasttestet.
    vilolager, vila: (s) => vilaSandlada(s, { tvinga: true }), vilaStadning, stadning, kapacitet, glomKalenderlankar: () => kalender.lankar.clear(),
  };
}

if (import.meta.main) {
  const app = starta();
  const avsluta = () => {
    try { const n = app.spara(); if (n) console.log(`Sparade ${n} sandlådor`); } catch (e) { console.error('Kunde inte spara sandlådorna:', e.message); }
    process.exit(0);
  };
  process.on('SIGTERM', avsluta);
  process.on('SIGINT', avsluta);
  console.log(`Vårdkällan lyssnar på ${app.port}${process.env.ORIGIN ? ` (${process.env.ORIGIN})` : ''}`);
}

