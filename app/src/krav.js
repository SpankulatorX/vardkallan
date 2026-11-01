// Kravregistret (K1, K4). Varje krav pekar på de automatiska tester som visar det. Statusen uppfyllt_demo
// ges bara när alla testerna finns och är gröna i test-resultat.json från bygget. Annars delvis.
// Källa: rapporten "Cosmic upphandling krav och kritik", avsnitten Kravlista och designchecklista
// samt Misstag att inte upprepa.
import { existsSync, readFileSync } from 'node:fs';
import { FLODEN } from './klickbudget.js';

const RAPPORT = 'Cosmic upphandling krav och kritik';
const k = (id, rubrik, kalla, status, var_, tester = [], anmarkning = null) => ({ id, rubrik, kalla, status, var: var_, tester, anmarkning });

const B = 'Behörighetsmotorn > ';
const A = 'API > ';
const L = 'Åtkomstloggen > ';
const J = 'Journal > ';
const M = 'Läkemedel > ';
const R = 'Remiss > ';
const F = 'FHIR > ';
const S = 'Seed > ';
const KR = 'Kravregistret > ';
const KV = 'Kodverk > ';
const FS = 'FHIR-struktur > ';
const LK = 'Läskopia > ';
// Testerna av gränssnittet körs i Playwright (test/avbrott.cjs, test/anvandartest.cjs och test/klickbudget.cjs), se klientresultat.js.
const GA = 'Gränssnitt > Avbrott > ';
const GU = 'Gränssnitt > Användartest > ';
const GK = 'Gränssnitt > Klickbudget > ';
export const klickbudgetTest = (f) => `${GK}${f.namn} inom budget`;

export const KRAV = [
  // Kravspårbarhet
  k('K1', 'Kravregister med id, källa, status och koppling till tester', `${RAPPORT}, Kravspårbarhet`, 'delvis', '/krav',
    [`${KR}alla krav K1 till K5, D1 till D12, L1 till L13 och M1 till M13 finns`, `${KR}status uppfyllt_demo bara när alla tester är gröna`, `${A}krav visar kravregistret`],
    'Registret finns, men Sussas kravspecifikation med originalnummer och de 205 utvärderingskriterierna är inte utlämnad. Kraven här kommer från rapportens ramverk.'),
  k('K2', 'Svarsmappning från kriterier till leverantörens FVIS-krav', `${RAPPORT}, Kravspårbarhet`, 'planerat', '/krav', [], 'Kräver bilaga A1, som inte är tillgänglig.'),
  k('K3', 'Prioritetssignal för krav som exkluderades eller sköts upp', `${RAPPORT}, Kravspårbarhet`, 'planerat', '/krav', [], 'Kräver bilaga 1 till Tilläggsavtal 3.'),
  k('K4', 'Varje krav bryts ned till automatiserade testfall och ett användarscenario', `${RAPPORT}, Kravspårbarhet`, 'delvis', '/krav',
    [`${KR}saknade eller röda tester ger delvis`, `${KR}planerade krav förblir planerade`],
    'Automatiska tester körs i bygget och bygget stoppas om de är röda. Användarscenarier med verkliga användare saknas.'),
  k('K5', 'Bör-krav och målbild som separat backlogg', `${RAPPORT}, Kravspårbarhet`, 'planerat', '/krav'),

  // Icke-funktionella krav och design
  k('D1', 'Kvitterade meddelanden med larm, och en NLL-timeout döljer aldrig en lyckad förskrivning', `${RAPPORT}, D1`, 'delvis', '/inkorg',
    [`${R}statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat`, `${R}larm: mottagningskvittens saknas efter 2 timmar`, `${R}larm: svar saknas efter sista svarsdatum`,
      `${R}larm: svar inte kvitterat efter 3 dagar`, `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`, `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`],
    'Remiss och förskrivning har kvittens och larm. Epikriser skickas inte mellan vårdgivare i första versionen, och NLL är simulerad.'),
  k('D2', 'Kronologisk helhetsbild där migrerad historik syns likvärdigt med ny', `${RAPPORT}, D2`, 'uppfyllt_demo', '/patient/:id',
    [`${A}översikten har tidslinje med migrerade poster märkta`, `${S}migrerad historik från VAS och Cosmic finns för patient 1`]),
  k('D3', 'Verifierad migrering med avstämningsrapport', `${RAPPORT}, D3`, 'delvis', '/migrering',
    [`${A}migreringsavstämningen visar avvikelsen`],
    'Avstämningen räknas på seedens migrerade poster. Någon riktig migrering från VAS eller Cosmic görs inte.'),
  k('D4', 'Läsåtkomst vid avbrott och inloggning som inte faller med en extern tjänst', `${RAPPORT}, D4`, 'delvis', '/',
    [`${LK}nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning`, `${LK}innehåller bara det servern redan lämnar ut till den inloggade`,
      `${LK}spärrade uppgifter och skyddad identitet följer samma regler i läskopian`, `${LK}yrkesrollen styr vad läskopian innehåller`,
      `${LK}utan inloggning lämnas ingen läskopia ut`, `${LK}att uppgifterna lämnas ut till läskopian loggas en gång per patient och grund`,
      `${LK}åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka`, `${LK}åtkomster utanför läskopian, med fel handling eller fel tid avvisas`,
      `${LK}en rad som skickas två gånger loggas en gång`, `${LK}läskopians nyckel och kopplingar överlever omstart av servern`, `${LK}service workern cachar alla statiska filer`,
      `${GA}appen startar utan nät från service workern och visar läsläget`, `${GA}läskopian i webbläsaren är krypterad och nyckeln ligger inte i IndexedDB`,
      `${GA}skrivande är avstängt i läsläget med en förklaring`, `${GA}simulerat avbrott ger läsläge medan servern svarar andra besökare`,
      `${GA}åtkomster i läsläget når åtkomstloggen när servern svarar igen`, `${GA}läskopian rensas vid utloggning`, `${GA}utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs`, `${GA}läskopian används inte efter 8 timmar`],
    'Läsläget gäller den som var inloggad när avbrottet kom, i samma webbläsarflik, och visar arbetslistan och de patienter som kopierats. Inloggningen i demon är ett simulerat SITHS-kort som inte beror på någon extern tjänst, men en riktig inloggning med reservväg vid avbrott hos Inera är inte byggd. Läsläget ersätter inte en reservrutin med utskrifter eller ett separat reservsystem för läsning.'),
  k('D5', 'Svarstidsmål per vanlig åtgärd, mätta i drift och publicerade', `${RAPPORT}, D5`, 'uppfyllt_demo', '/drift',
    [`${A}hälsa och Server-Timing på alla svar`, `${A}drift visar p50 och p95 per endpoint`],
    'Målet i demon är p95 under 200 ms per endpoint. Mätningen gäller demons server, inte ett produktionssystem.'),
  { ...k('D6', 'Klickbudget per vanligt arbetsflöde, mätt med verkliga användare', `${RAPPORT}, D6`, 'delvis', '/krav',
    [`Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden`, ...FLODEN.map(klickbudgetTest),
      'Användartest > räkningen: klick på knappar och länkar, inte i fält som gränssnittet har satt fokus i', 'Användartest > SUS-poängen räknas med standardformeln',
      'Användartest > uppgifterna följer flödena i klickbudgeten', 'Användartest > sammanställningen ger median, spridning, andel slutförda och SUS per flöde',
      `${GU}testläget räknar klick, fältbyten och tangenter som klickbudgetskriptet för samma flöden`, `${GU}enkäten ger SUS-poäng enligt standardformeln`,
      `${GU}resultatfilen laddas ner med datum, version, deltagarkod, uppgifter och SUS-poäng`, `${GU}inget anrop skickar testresultat till servern`,
      `${GU}testläget rensas när testet avslutas`],
    'Klick, fältbyten och tangenttryck mäts i Playwright med ett skript som gör flödena i gränssnittet. För mätningen med verkliga användare finns ett testläge i demon med samma uppgifter och samma räkning, en enkät med SUS och tre öppna frågor, ett testprotokoll för testledaren (docs/anvandartest.md) och ett skript som sammanställer resultatfilerna. Själva mätningen med personer som arbetar i vården återstår. SVT Norrbotten rapporterade 2026-02-19 att det i Cosmic krävs upp till 21 knapptryck för att få fram rätt information. Den siffran är inte mätt här och flödena är inte desamma.'), bilaga: 'klickbudget' },
  k('D7', 'Små releaser med automatiserad regressionstest och återgång', `${RAPPORT}, D7`, 'delvis', '/krav',
    [`${KR}status uppfyllt_demo bara när alla tester är gröna`],
    'Bygget kör alla tester och stoppas om något är rött. Testerna och FHIR-valideringen körs också i GitHub Actions vid varje push och pull request. Återgång och kundens godkännande före uppgradering är inte byggda.'),
  k('D8', 'Behörighetsmodell som tvingar minsta åtkomst, testad mot roller', `${RAPPORT}, D8`, 'uppfyllt_demo', '/patient/:id',
    [`${B}yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte`, `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`,
      `${B}yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel`, `${B}yrkesroll: logggranskare får läsa loggen men inte journalen`,
      `${B}nekad: utan grund nekas åtkomst utan erbjudande om val`, `${A}nekad åtkomst ger 403 kraver_val och loggas som nekad`],
    'Testat mot demons roller, inte mot verkliga användare.'),
  k('D9', 'Öppna format: FHIR R4, ICD-10-SE och ATC', `${RAPPORT}, D9`, 'delvis', '/fhir/metadata',
    [`${F}metadata är ett CapabilityStatement`, `${F}sökning ger Bundle searchset`, `${F}Patient har personnummer med rätt identifier-system`,
      `${F}Condition använder ICD-10-SE`, `${F}MedicationRequest använder ATC och har uppföljningsdatum`,
      `${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`, `${KV}varje läkemedel i katalogen har en ATC-kod ur WHO:s register`,
      `${KV}varningsreglernas ATC-prefix stämmer med WHO:s register`, `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`,
      `${FS}inga tomma listor, tomma strängar eller null, och varje kodning har system och kod`, `${FS}vitalparametrar följer FHIR R4:s vitalparameterprofiler`,
      `${FS}labbvärden har NPU-kod och UCUM-enhet`, `${FS}meta.profile bara för profiler som validerats`,
      `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`, `${FS}varje tillägg och eget kodsystem har en publicerad definition`,
      `${FS}Condition och MedicationRequest har display ur kodverket`, `${FS}MedicationRequest har NPL-id med E-hälsomyndighetens system`,
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`],
    'FHIR R4 med ICD-10-SE, ATC, NPL-id, NPU (labb), LOINC (vitalparametrar) och UCUM. Koderna är kontrollerade mot Socialstyrelsen, WHO, IFCC och LOINC (docs/kodkontroll.md). Läkemedelskatalogens 50 produkter är kontrollerade mot Läkemedelsverkets NPL och har riktiga NPL-id (docs/lakemedelskontroll.md). Alla resurstyper validerades 2026-10-31 med HL7:s validator 7.0.3 mot FHIR R4 och hl7se.fhir.base 1.1.0 utan fel (docs/fhir-validering.md). Validatorn körs i GitHub Actions vid varje push och pull request och fäller körningen vid fel, men inte i Docker-bygget av demon. Patient, Organization och Practitioner påstår HL7 Swedens basprofiler. eGFR saknar kod. openEHR, Snomed CT, KVÅ och RIVTA-adaptrar saknas.'),
  k('D10', 'Beslutsstöd i separata moduler, journalkärnan utanför MDR', `${RAPPORT}, D10`, 'delvis', '/patient/:id/lakemedel',
    [`${M}varningarna är märkta som demoregler`],
    'Varningsreglerna ligger i en egen modul och är märkta som demoregler. Ingen MDR-bedömning är gjord.'),
  k('D11', 'Styrd lokal anpassning av mallar inom fastställda ramar', `${RAPPORT}, D11`, 'planerat', null, [], 'Mallarna är fasta i koden i första versionen.'),
  k('D12', 'All drift, support och personuppgiftsbehandling inom EU', `${RAPPORT}, D12`, 'planerat', null, [], 'Demon innehåller inga riktiga personuppgifter. Driftkrav och DPIA är inte gjorda.'),

  // Lagkrav och nationella tjänster
  k('L1', 'En journal per patient, signatur och tidpunkt, ingen ändring eller utplåning', 'PDL 3 kap., HSLF-FS 2016:40 6 kap.', 'delvis', '/patient/:id/anteckningar',
    [`${J}signerad anteckning kan inte ändras i databasen (trigger)`, `${J}signerad anteckning kan inte raderas (trigger)`, `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
      `${A}helflöde: anteckning skapas, signeras och rättas`],
    'Bevarande i minst tio år gäller inte demons sandlådor, som lever i åtta timmar.'),
  k('L2', 'Behörighet efter behovs- och riskanalys, minsta nödvändiga åtkomst', 'PDL 4 kap. 2 §, HSLF-FS 4 kap. 2 till 3 §§', 'delvis', '/patient/:id',
    [`${B}yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte`, `${B}yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel`],
    'Rollerna ger minsta åtkomst. En dokumenterad behovs- och riskanalys finns inte.'),
  k('L3', 'Spärr, aktivt val, synlig spärrmarkering och nödåtkomst', 'PDL 4 kap. 4 till 5 §§, HSLF-FS 4 kap. 4 till 8 §§', 'uppfyllt_demo', '/patient/:id',
    [`${B}inre sekretess: andra enheters uppgifter kräver aktivt val`, `${B}inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val`,
      `${B}spärr: spärrmarkering syns men innehållet döljs`, `${B}spärr: aktivt val häver inte spärren`, `${B}spärr: samtycke i stunden visar spärrade uppgifter`,
      `${B}nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst`, `${B}nödåtkomst: häver aldrig en spärr`, `${A}spärrmarkering och samtycke via API`,
      `${A}nödåtkomst via API flaggas i logguppföljningen`],
    'Lag 2022:913 om sammanhållen vård- och omsorgsdokumentation är inte läst och inte inbyggd.'),
  k('L4', 'Loggning av varje åtkomst, logguppföljning och logginformation till patienten', 'HSLF-FS 4 kap. 9 till 12 §§, PDL 8 kap. 5 §', 'delvis', '/logg',
    [`${L}varje rad kedjas med sha256 av föregående hash och raden`, `${L}UPDATE på loggen avbryts av trigger`, `${L}DELETE på loggen avbryts av trigger`,
      `${L}verifiera upptäcker ändrad rad när triggern släppts i en kopia`, `${A}logggranskaren ser logg med hel kedja, andra roller nekas`, `${F}FHIR-anrop loggas`],
    'Loggen kan inte ändras och kan följas upp med flaggor. Stickprovsrutin, lagring i fem år och patientens egen e-tjänst finns inte.'),
  k('L5', 'Flerfaktorsautentisering vid direktåtkomst och patientens e-åtkomst', 'HSLF-FS 3 kap. 15 §, 4 kap. 12 §', 'planerat', '/', [], 'Inloggningen simulerar ett SITHS-kort. Ingen riktig autentisering.'),
  k('L6', 'Skyddade personuppgifter hanteras i hela kedjan, även uppropning', 'OSL 25 kap., Örebro-fallet 2024', 'uppfyllt_demo', '/vantrum',
    [`${B}skyddad identitet: namn och personnummer maskeras`, `${A}arbetslista maskerar skyddad identitet`, `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}väntrummet visar aldrig namn för skyddad patient`, `${A}visa identitet kräver syfte och loggas`, `${F}skyddad patient maskeras i FHIR`],
    'Paragrafen i OSL är inte verifierad i rapporten.'),
  k('L7', 'NLL: ordinationsorsak och uppföljningsdatum, kvittens för varje överföring', 'Prop. 2024/25:182', 'delvis', '/patient/:id/lakemedel',
    [`${M}ordinationsorsak är obligatorisk`, `${M}uppföljningsdatum är obligatoriskt`, `${M}databasen vägrar ordination utan orsak (CHECK)`, `${M}NLL: normal överföring kvitteras`,
      `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`, `${S}alla ordinationer har orsak och uppföljningsdatum`,
      `${KV}ordinationerna i seeden har dos och administrationsväg som passar produktens styrka och form`, `${FS}MedicationRequest har NPL-id med E-hälsomyndighetens system`],
    'NLL är simulerad. Ingen riktig anslutning till E-hälsomyndigheten. Läkemedlen har riktiga NPL-id från Läkemedelsverket. Förpackning väljs inte, så NPL-pack-id saknas, och E-hälsomyndighetens profiler för NLL kräver NPL-pack-id eller varunummer (felkod 2-25-1370).'),
  k('L8', 'NPÖ, 1177 journal, e-remiss, Webcert och tjänsteplattformen (RIVTA)', 'Inera', 'planerat', null, [], 'Inga riktiga integrationer i första versionen.'),
  k('L9', 'HSA, SITHS, Säker digital kommunikation, patientregistret och kvalitetsregister', 'Inera, Socialstyrelsen', 'planerat', null,
    [`${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`],
    'HSA-id i demon är påhittade. Ingen rapportering till patientregistret byggs. Diagnoserna har ICD-10-SE 2026, som rapporteringen kräver, kontrollerade mot Socialstyrelsens kodfil.'),
  k('L10', 'EHDS: CE-märkning, interoperabilitets- och loggningskomponent', 'Förordning (EU) 2025/327', 'planerat', null,
    [`${FS}inga tomma listor, tomma strängar eller null, och varje kodning har system och kod`, `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`],
    'Inte uppfyllt. FHIR R4 och HL7 Swedens basprofiler är validerade, men det europeiska utbytesformatet för journaler, CE-märkning och EHDS loggningskomponent finns inte.'),
  k('L11', 'MDR för beslutsstöd, läkemedelsvarningar och dosering', 'MDR (EU) 2017/745', 'planerat', null, [], 'Demon är inte CE-märkt. Varningarna är demoregler.'),
  k('L12', 'NIS2 genom cybersäkerhetslagen', 'Cybersäkerhetslagen (2025:1506)', 'planerat', null, []),
  k('L13', 'GDPR, arkivlagen, säkerhetsskyddslagen och tillgänglighetslagen', 'Egen kunskap i anteckningarna, ska verifieras', 'planerat', null, []),

  // Misstag att inte upprepa
  k('M1', 'Driftstart trots kända brister: mätbara avbrottskriterier och stopprätt', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, []),
  k('M2', 'Krav utvärderade på papper: krav som testfall och spårbar bedömning', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/krav',
    [`${KR}status uppfyllt_demo bara när alla tester är gröna`], 'Kraven är testfall i bygget. Empirisk användbarhetsmätning saknas.'),
  k('M3', 'Sanktion för stor för att användas: betalning mot levererad funktion', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, [], 'Gäller avtal och styrning, inte koden.'),
  k('M4', 'Tappade meddelanden mellan vårdnivåer: kvittens, larm och test av felvägar', `${RAPPORT}, Misstag att inte upprepa`, 'uppfyllt_demo', '/inkorg',
    [`${R}larm: mottagningskvittens saknas efter 2 timmar`, `${R}larm: svar inte kvitterat efter 3 dagar`, `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`]),
  k('M5', 'Migrerad historik blev osynlig: avstämd migrering och kronologisk vy', `${RAPPORT}, Misstag att inte upprepa`, 'uppfyllt_demo', '/migrering',
    [`${A}översikten har tidslinje med migrerade poster märkta`, `${A}migreringsavstämningen visar avvikelsen`]),
  k('M6', 'För bred åtkomst och svaga spärrar: behörighet som testat krav', `${RAPPORT}, Misstag att inte upprepa`, 'uppfyllt_demo', '/patient/:id',
    [`${B}spärr: aktivt val häver inte spärren`, `${B}nödåtkomst: häver aldrig en spärr`, `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`]),
  k('M7', 'Personuppgifter utanför EU: EU-krav i avtal och arkitektur', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, []),
  k('M8', 'Uppgraderingar skapar nya fel: små releaser och automatiserade tester', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/krav',
    [`${KR}status uppfyllt_demo bara när alla tester är gröna`], 'Återgång är inte byggd.'),
  k('M9', 'Fler klick och långsamhet: klickbudget och svarstidsmål', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/drift',
    [`${A}drift visar p50 och p95 per endpoint`, `Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden`],
    'Svarstid mäts i drift och klick mäts med ett skript i Playwright. Sekreterare, vårdadministratörer och andra verkliga användare har inte varit med i designen eller mätningen.'),
  k('M10', 'Ändringar fastnar i samverkan: eget förvaltningsteam med beslutsrätt', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, [], 'Gäller organisation, inte koden.'),
  k('M11', 'Beslut utanför demokratisk insyn: diarieföring och öppen dokumentation', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/krav', [], 'Designen och koden är öppna. Diarieföring gäller organisationen.'),
  k('M12', 'Inlåsning: regionägd kod och data i öppna format', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/fhir/metadata',
    [`${F}sökning ger Bundle searchset`], 'Öppen källkod och FHIR. Export av hela databasen i öppet format är inte byggd.'),
  k('M13', 'Medicinteknisk klassning sent: avsett ändamål och klassning före bygget', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, [], 'Ingen MDR-klassning är gjord. Varningarna är märkta som demoregler.'),
];

export function lasTestresultat(fil) {
  try {
    if (!fil || !existsSync(fil)) return null;
    return JSON.parse(readFileSync(fil, 'utf8'));
  } catch { return null; }
}

// Status beräknas från testresultatet. Ett krav som avses vara uppfyllt men saknar gröna tester blir delvis.
// klient är resultatet från testerna av gränssnittet (klientresultat.js). Ett inaktuellt klienttest räknas inte som grönt.
export function kravregister(resultat, register = KRAV, klient = null) {
  const status = new Map([...(resultat?.tester ?? []), ...(klient?.tester ?? [])].map(t => [t.namn, t.status]));
  const krav = register.map(x => {
    const tester = x.tester.map(namn => ({ namn, status: status.get(namn) ?? 'saknas' }));
    const allaGrona = tester.length > 0 && tester.every(t => t.status === 'grön');
    let s = x.status;
    if (s === 'uppfyllt_demo' && !allaGrona) s = 'delvis';
    const ut = { id: x.id, rubrik: x.rubrik, kalla: x.kalla, status: s, avsedd: x.status, var: x.var, tester, anmarkning: x.anmarkning };
    if (x.bilaga === 'klickbudget') ut.klickbudget = klient?.klickbudget ?? null;
    return ut;
  });
  const summa = { uppfyllt_demo: 0, delvis: 0, planerat: 0 };
  for (const x of krav) summa[x.status]++;
  return {
    testresultat: resultat ? { tid: resultat.tid, bun: resultat.bun, antal: resultat.antal, godkanda: resultat.godkanda, misslyckade: resultat.misslyckade } : null,
    klienttester: klient?.klienttester ?? null,
    summa, krav,
  };
}
