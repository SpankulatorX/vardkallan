// Sussa KD1.1 Drift, teknik och underhåll: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r2: posterna för tillgänglighet och skärmanpassning ersätts ur sussa/runda7-r2.js.
import { medR7r2 } from '../runda7-r2.js';
// Runda 9, r5: inloggning med biljett, skyddsbehov, signering, certifikat, e-arkiv, gallring och miljöer (sussa/runda9-r5.js).
import { medR9r5 } from '../runda9-r5.js';
// Runda 12, r2 (sussa/runda12-r2.js).
import { medR12r2 } from '../runda12-r2.js';
// Runda 13, r2: kapacitet, vilande sandlådor och säkerhetskopiornas tak (sussa/runda13-r2.js).
import { medR13r2 } from '../runda13-r2.js';

// Runda 7, r4: lagringen (lagring.js och test/systemforvaltning.test.js).
const S = 'Systemförvaltning > ';
const L = {
  klassa: `${S}lagring: varje tabell klassas efter huvudman, och ingen tabell är oklassad`,
  uttag: `${S}lagring: uttaget för en huvudman har bara dess egna uppgifter, och en annan huvudmans uppgifter finns inte med`,
  schema: `${S}lagring: uttaget har samma tabeller, index och triggrar som originalet`,
  vacuum: `${S}lagring: säkerhetskopia till fil med VACUUM INTO och återläsning ger ett konsistent läge med alla tabeller, rader och triggrar`,
  underkand: `${S}lagring: en kopia som skiljer sig från originalet underkänns`,
  filBeslut: `${S}lagring: uttaget som fil kräver ett beslut med diarienummer och skäl, och fyra ögon`,
  filInnehall: `${S}lagring: filen har bara huvudmannens uppgifter, ett manifest med kontrollsummor, NDJSON per tabell och FHIR per patient, och är märkt som demodata`,
  filLogg: `${S}lagring: varje patient i uttaget loggas, och filen hämtas genom API:t bara av systemförvaltaren`,
  prov: `${S}lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter`,
};
const LOSNING_KOPIA = 'Säkerhetskopian är en konsistent ögonblicksbild av hela databasen, tagen i en enda operation (SQLite VACUUM INTO till en fil, eller serialize i minnet). Återläsningen läser in kopian i en ny databas och jämför tabell för tabell och rad för rad, kontrollerar att alla triggrar och index finns och verkar, att databasen är hel och att åtkomstloggens och säkerhetsloggens hashkedjor håller. Provet körs automatiskt i bygget, och systemförvaltaren kan köra det i sandlådan från sidan Lagring.';
const EXPERT_KOPIA = 'Systemet gör hela jämförelsen själv och säger vilken kontroll som inte höll och i vilken tabell. Ingen behöver veta hur databasen är byggd för att se att återläsningen ger ett fungerande system.';
const ANM_KOPIA = 'I demon är varje besökares sandlåda en databas i minnet, som sparas till disk när servern stängs. Sedan version 1.2 kopieras den också på ett schema till två platser, och systemförvaltaren kan återställa den till en tidpunkt (se KD1.1.3.6).';
const LOSNING_HUVUDMAN = 'Varje uppgift hör till en huvudman genom den enhet den registrerades på: enheten leder upp till en vårdgivare. En tabell utan enhet hör till huvudmannen genom patienten, och en tabell som pekar på en annan rad genom den raden. En huvudmans uppgifter tas ut till en egen databas med samma tabeller, index och triggrar, och systemet kontrollerar att uttaget inte har någon rad från en annan huvudman. Som fil tas uppgifterna ut efter ett beslut med diarienummer och skäl som en annan systemförvaltare har godkänt: en ZIP med ett manifest med kontrollsummor (SHA-256), en NDJSON-fil per tabell och ett FHIR R4-bundle per patient, och varje patient i filen loggas.';
const EXPERT_HUVUDMAN = 'Systemet klassar själv varje tabell efter dess kolumner, så att en ny tabell kommer med utan att någon behöver komma ihåg det. En tabell som inte går att klassa tas inte med i ett uttag och visas på sidan Lagring, hellre än att den läcker till en annan huvudman.';
const ANM_HUVUDMAN = 'Demon har en huvudman, Region Örebro län, och den simulerade kommunen. Testet lägger in en andra påhittad region och visar att uppgifterna särskiljs. En uttagsfil från demon är märkt som demodata. Beslutet om uttag godkänns av den andra systemförvaltaren, som är en egen demoroll.';

const AVSNITT = [
  { id: 'KD1.1.1.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.4', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Krav på drift samt maskin- och programvara är inte byggt ännu (runda 7)." },
  { id: 'KD1.1.1.6', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.7', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.8', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.9', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.10', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.11', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.12', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.1.13', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.2.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.2.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.3.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.3.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  // Runda 7, r4: lagring, säkerhetskopiering och uttag per huvudman (lagring.js).
  {
    id: 'KD1.1.3.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [L.vacuum, L.underkand, L.prov],
    losning: LOSNING_KOPIA,
    expert: EXPERT_KOPIA,
    anmarkning: ANM_KOPIA,
  },
  {
    id: 'KD1.1.3.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [L.klassa, L.uttag, L.schema, L.filBeslut, L.filInnehall, L.filLogg, L.prov],
    losning: LOSNING_HUVUDMAN,
    expert: EXPERT_HUVUDMAN,
    anmarkning: ANM_HUVUDMAN,
  },
  {
    id: 'KD1.1.3.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [L.klassa, L.uttag, L.schema, L.prov],
    losning: `${LOSNING_HUVUDMAN} Sidan Lagring visar databasens storlek, antal rader per tabell och de största tabellerna, och varje provåterläsning sparas med storlek och tid så att volymen kan följas.`,
    expert: EXPERT_HUVUDMAN,
    anmarkning: `${ANM_HUVUDMAN} Lagringsklasser med olika kvalitet och prestanda, flytt av äldre data till billigare lagring och prognoser för volymen hör till driften och finns inte i demon.`,
  },
  {
    id: 'KD1.1.3.6', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [L.vacuum, L.underkand, L.prov],
    losning: `${LOSNING_KOPIA} Det som har registrerats går inte att radera eller skriva över: signerade anteckningar, loggar, ändringar av konfigurationen och flyttar vid omorganisation skyddas av databasens triggrar, och loggarna har hashkedjor som visar om något har ändrats.`,
    expert: EXPERT_KOPIA,
    anmarkning: `${ANM_KOPIA} Skydd mot krascher i infrastrukturen, störningar i nätet och dataläckage utanför applikationen hör till driften.`,
  },
  { id: 'KD1.1.4.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Krav på följsamhet mot klient och klientplattform är inte byggt ännu (runda 7)." },
  { id: 'KD1.1.4.4', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.5', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.6', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.7', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.8', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.9', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Gäller leverantörens åtagande, drift eller process och inte systemets funktion." },
  { id: 'KD1.1.4.10', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: "Bildskärm är inte byggt ännu (runda 7)." },
];
// Runda 12, r3: arbete över flera skärmar (public/js/flera-fonster.js).
const R12R3 = {
  'KD1.1.4.10': {
    avsedd: 'uppfyllt_demo',
    tester: ['Gränssnitt > Tillgänglighet > flera skärmar: en del av journalen öppnas i ett nytt fönster som följer patientbytet, och ett låst fönster visar tydligt att en annan patient är öppen'],
    losning: 'Responsiv design utan minsta upplösning: från 320 px bredd till 2560 px. Under 640 px blir menyn en knapp och knapparna minst 40 px höga, mellan 640 och 1100 px blir patienthuvudet och sidopanelerna smalare, och på stor skärm begränsas textraderna så att de går att läsa. Text och symboler är vektorer, så hög upplösning ger skarp text. För flera skärmar kan en del av journalen, till exempel läkemedelslistan, öppnas i ett nytt fönster med ett klick. Användarens fönster följer varandra: när en patient öppnas i ett fönster byter de andra fönstren som visar en journal till samma patient och behåller sin flik. Ett fönster kan låsas till sin patient och visar då en tydlig varning med båda patienternas namn när en annan patient öppnas i ett annat fönster.',
    expert: 'Systemet anpassar själv gränssnittet till skärmens storlek, förstoring och kontrastinställning, och håller användarens fönster på samma patient utan att användaren behöver göra något. Ett fönster med en annan patient än de andra syns alltid tydligt.',
    anmarkning: 'Rekommendation: minst 1280 px bredd för arbete med journalen på en vanlig arbetsplats, men allt fungerar från 320 px. Fönstren talar med varandra genom BroadcastChannel inom samma webbläsare och inloggning, och varje fönster hämtar journalen med sin egen behörighetsprövning. Prövat i Chromium med Playwright. Riktiga plattor, telefoner och fysiska skärmar är inte prövade.',
  },
};
export default medR13r2(medR12r2(medR9r5(medR7r2(AVSNITT)))).map(x => (R12R3[x.id] ? { ...x, ...R12R3[x.id], tester: [...new Set([...(x.tester ?? []), ...R12R3[x.id].tester])] } : x));
// Runda 12, r2: säkerhetskopior på två platser och återställning till en tidpunkt (sussa/runda12-r2.js), med medR12r2 ovan.
