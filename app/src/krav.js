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
const MJ = 'Min journal > ';
// Testerna av gränssnittet körs i Playwright (test/avbrott.cjs, test/anvandartest.cjs och test/klickbudget.cjs), se klientresultat.js.
const GA = 'Gränssnitt > Avbrott > ';
const GU = 'Gränssnitt > Användartest > ';
const GK = 'Gränssnitt > Klickbudget > ';
const SR = 'Sussa-registret > ';
const VK = 'Vårdkontakt > ';
// Samma prefix används i mappningen av Sussas kravspecifikation (sussa/mappning/).
export const TEST = { B, A, L, J, M, R, F, S, KR, KV, FS, LK, MJ, GA, GU, GK, SR };
export const klickbudgetTest = (f) => `${GK}${f.namn} inom budget`;

export const KRAV = [
  // Kravspårbarhet
  k('K1', 'Kravregister med id, källa, status och koppling till tester', `${RAPPORT}, Kravspårbarhet`, 'delvis', '/krav',
    [`${KR}alla krav K1 till K5, D1 till D12, L1 till L13 och M1 till M13 finns`, `${KR}status uppfyllt_demo bara när alla tester är gröna`, `${A}krav visar kravregistret`,
      `${SR}alla 305 id finns exakt en gång, och varje post har en mappning`, `${SR}uppfyllt_demo kräver gröna tester`, `${SR}källan och de saknade kapitlen anges`,
      `${SR}API: krav/sussa ger registret utan inloggning, med egna krav och testernas status`],
    'Sussas kravspecifikation med originalnummer finns nu för kapitel 1 till 6 och 11: 305 poster, varav 165 utvärderingskriterier, i Sussa-registret med koppling till tester och till kraven här. Kapitel 7 till 10 och 12 ingår inte i utdraget från Konkurrensverket, och viktningsträdet för utvärderingskriterierna (bilaga F1:1) saknas. Kraven K, D, L och M kommer från rapportens ramverk.'),
  k('K2', 'Svarsmappning från kriterier till leverantörens FVIS-krav', `${RAPPORT}, Kravspårbarhet`, 'planerat', '/krav', [], 'Kräver bilaga A1, den avtalade specifikationen med leverantörens svar på kraven, som inte är tillgänglig. Sussas krav och kriterier finns nu med originalnummer, men inte leverantörens svar på dem.'),
  k('K3', 'Prioritetssignal för krav som exkluderades eller sköts upp', `${RAPPORT}, Kravspårbarhet`, 'planerat', '/krav', [], 'Kräver bilaga 1 till Tilläggsavtal 3, som begärdes ut från Konkurrensverket 2026-11-03.'),
  k('K4', 'Varje krav bryts ned till automatiserade testfall och ett användarscenario', `${RAPPORT}, Kravspårbarhet`, 'delvis', '/krav',
    [`${KR}saknade eller röda tester ger delvis`, `${KR}planerade krav förblir planerade`],
    'Automatiska tester körs i bygget och bygget stoppas om de är röda. Användarscenarier med verkliga användare saknas.'),
  k('K5', 'Bör-krav och målbild som separat backlogg', `${RAPPORT}, Kravspårbarhet`, 'planerat', '/krav'),

  // Icke-funktionella krav och design
  k('D1', 'Kvitterade meddelanden med larm, och när NLL inte svarar i tid döljs aldrig en lyckad förskrivning', `${RAPPORT}, D1`, 'delvis', '/inkorg',
    [`${R}statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat`, `${R}larm: mottagningskvittens saknas efter 2 timmar`, `${R}larm: svar saknas efter sista svarsdatum`,
      `${R}larm: svar inte kvitterat efter 3 dagar`, `${M}NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen`, `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`],
    'Remiss och förskrivning har kvittens och larm. Epikriser skickas inte mellan vårdgivare i första versionen, och NLL är simulerad.'),
  k('D2', 'Kronologisk helhetsbild där migrerad historik syns likvärdigt med ny', `${RAPPORT}, D2`, 'uppfyllt_demo', '/patient/:id',
    [`${A}översikten har tidslinje med migrerade poster märkta`, `${S}migrerad historik från VAS och Cosmic finns för patient 1`]),
  k('D3', 'Verifierad migrering med avstämningsrapport', `${RAPPORT}, D3`, 'delvis', '/migrering',
    [`${A}migreringsavstämningen visar avvikelsen`],
    'Avstämningen räknas på seedens migrerade poster. Någon riktig migrering från VAS eller Cosmic görs inte.'),
  k('D4', 'Läsåtkomst vid avbrott och inloggning som inte faller med en extern tjänst', `${RAPPORT}, D4`, 'uppfyllt_demo', '/',
    [`${LK}nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning`, `${LK}innehåller bara det servern redan lämnar ut till den inloggade`,
      `${LK}spärrade uppgifter och skyddad identitet följer samma regler i läskopian`, `${LK}yrkesrollen styr vad läskopian innehåller`,
      `${LK}utan inloggning lämnas ingen läskopia ut`, `${LK}att uppgifterna lämnas ut till läskopian loggas en gång per patient och grund`,
      `${LK}åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka`, `${LK}åtkomster utanför läskopian, med fel handling eller fel tid avvisas`,
      `${LK}en rad som skickas två gånger loggas en gång`, `${LK}läskopians nyckel och kopplingar överlever omstart av servern`, `${LK}service workern cachar alla statiska filer`,
      `${LK}krypterade åtkomster från läsläget tas emot utan inloggning och loggas på personen som hade läskopian`,
      `${LK}krypterade rader som inte går att verifiera eller gäller fel person eller kopia avvisas`,
      `${LK}läskopian tar emot loggen från före utloggningen men inga senare läsningar, och nyckeln lämnas inte ut igen`,
      `${LK}en läsning efter utloggningen tas inte emot`, `${LK}tiderna rättas när webbläsarens klocka går fel`,
      `${LK}en krypterad rad loggas en gång, också efter omstart av servern, och inte efter att läskopian gått ut`,
      `${LK}en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något`,
      `${LK}varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient`,
      `${LK}förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar`,
      `${GA}läskopian förnyas av sig själv medan personen är inloggad`,
      `${GA}läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter`,
      `${GA}appen startar utan nät från service workern och visar läsläget`, `${GA}läskopian i webbläsaren är krypterad och nyckeln ligger inte i IndexedDB`,
      `${GA}skrivande är avstängt i läsläget med en förklaring`, `${GA}simulerat avbrott ger läsläge medan servern svarar andra besökare`,
      `${GA}åtkomster i läsläget når åtkomstloggen när servern svarar igen`, `${GA}läskopian rensas vid utloggning`, `${GA}utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs`, `${GA}läskopian används inte efter 8 timmar`,
      `${GA}reservkoden väljs när webbläsaren är uppkopplad och bara den inslagna nyckeln sparas`,
      `${GA}efter omstart av webbläsaren utan nät visas vilka som har en reservkopia på datorn och när den går ut`,
      `${GA}fel reservkod ger väntetid och rätt reservkod öppnar läsläget`, `${GA}åtkomster med reservkod loggas krypterat och överlever att fliken stängs`,
      `${GA}när servern svarar igen mitt i läsläget med reservkod når åtkomsterna åtkomstloggen`,
      `${GA}utloggning raderar reservkopian, den inslagna nyckeln och loggen efter att loggen förts över`,
      `${GA}utloggning i en flik avslutar läsläget i webbläsarens andra flikar`, `${GA}en navigering direkt till en fil ersätter inte appen i service workerns cache`,
      `${GA}fem fel reservkoder raderar reservkopian och flikar kan inte pröva samtidigt`,
      `${GA}två personer på samma dator har var sin reservkopia som bara öppnas med egen kod`, `${GA}simulerat avbrott visar reservinloggningen när fliken stängs i demon`,
      `${MJ}patientvyn får ingen läskopia`],
    'I demon går det att läsa arbetslistan och de patienter som kopierats när servern inte svarar: i samma flik direkt, och i en ny flik eller efter en omstart av webbläsaren med en reservkod. Läskopian förnyas av sig själv var fjärde minut medan personen är inloggad, så läkemedelsuppgifterna är högst 10 minuter gamla när ett avbrott börjar (Sussa 11.2.1.8), och läsläget visar per patient hur gamla de är. Förnyelserna loggas inte var för sig: loggen visar när utlämnandet av varje patient började och när uppgifterna lämnades ut senast. Ingen del av inloggningen beror på en extern tjänst. Simulerat: SITHS-kortet och dess PIN-räknare. Reservkoden låser upp en nyckel som är inslagen i webbläsaren, och räknaren för felaktiga försök ligger i webbläsaren och kan kringgås av den som har datorn, så en kod med sex siffror skyddar bara en kort stund mot den som kopierar webbläsarens lagring. En riktig reservväg för inloggningen vid avbrott hos Inera är inte byggd. Läskopian innehåller inte hela journalen och ersätter inte en reservrutin med utskrifter eller ett separat reservsystem för läsning.'),
  k('D5', 'Svarstidsmål per vanlig åtgärd, mätta i drift och publicerade', `${RAPPORT}, D5`, 'uppfyllt_demo', '/drift',
    [`${A}hälsa och Server-Timing på alla svar`, `${A}drift visar p50 och p95 per adress i API:t`],
    'Målet i demon är p95 under 200 ms per adress i API:t. Mätningen gäller demons server, inte ett produktionssystem.'),
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
      `${B}nekad: utan grund nekas åtkomst utan erbjudande om val`, `${A}nekad åtkomst ger 403 kraver_val och loggas som nekad`,
      `${VK}inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får`,
      `${VK}vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se`],
    'Testat mot demons roller, inte mot verkliga användare.'),
  k('D9', 'Öppna format: FHIR R4, ICD-10-SE och ATC', `${RAPPORT}, D9`, 'delvis', '/fhir/metadata',
    [`${F}metadata är ett CapabilityStatement`, `${F}sökning ger Bundle searchset`, `${F}Patient har personnummer med rätt identifier-system`,
      `${F}Condition använder ICD-10-SE`, `${F}MedicationRequest använder ATC och har uppföljningsdatum`,
      `${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`, `${KV}varje läkemedel i katalogen har en ATC-kod ur WHO:s register`,
      `${KV}varningsreglernas ATC-prefix stämmer med WHO:s register`, `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`,
      `${FS}inga tomma listor, tomma strängar eller tomma värden, och varje kodning har system och kod`, `${FS}vitalparametrar följer FHIR R4:s vitalparameterprofiler`,
      `${FS}labbvärden har NPU-kod och UCUM-enhet`, `${FS}meta.profile bara för profiler som validerats`,
      `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`, `${FS}varje tillägg och eget kodsystem har en publicerad definition`,
      `${FS}Condition och MedicationRequest har display ur kodverket`, `${FS}MedicationRequest har NPL-id med E-hälsomyndighetens system`,
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${MJ}FHIR med patientens session: egna resurser och $everything, inget annat`, `${MJ}FHIR för invånaren lämnar inte ut mer än Min journal`,
      `${MJ}FHIR för invånaren: id i fel journal ger alltid 404, och identifier eller fritext i adressen loggas aldrig`,
      'Administrering via API > FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen',
      // Runda 6, r1: eGFR med LOINC för CKD-EPI 2021 och åtgärder med KVÅ.
      'Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning',
      'Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie',
      'Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet'],
    'FHIR R4 med ICD-10-SE, ATC, NPL-id, NPU (labb), LOINC (vitalparametrar) och UCUM. Patienten når sina egna resurser med sessionen från Min journal. Koderna är kontrollerade mot Socialstyrelsen, WHO, IFCC och LOINC (docs/kodkontroll.md). Läkemedelskatalogens 50 produkter är kontrollerade mot Läkemedelsverkets NPL och har riktiga NPL-id (docs/lakemedelskontroll.md). Alla resurstyper validerades 2026-10-31 med HL7:s validator 7.0.3 mot FHIR R4 och hl7se.fhir.base 1.1.0 utan fel (docs/fhir-validering.md). MedicationAdministration och List för läkemedelsprocessen kom till 2026-11-03 och är bara kontrollerade med strukturtesterna i bygget, inte med HL7:s validator. Validatorn körs i GitHub Actions vid varje push och pull request och fäller körningen vid fel, men inte i Docker-bygget av demon. Patient, Organization och Practitioner påstår HL7 Swedens basprofiler. eGFR har LOINC 98979-8 (CKD-EPI 2021), eftersom demons laboratorium räknar eGFR ur kreatinin med den formeln och NPU saknar kod för skattad glomerulär filtration. Åtgärder har KVÅ (QD008, PA001 och XV015) som systemet sätter själv, och lämnas ut som Procedure. openEHR, Snomed CT och RIVTA-adaptrar saknas.'),
  k('D10', 'Beslutsstöd i separata moduler, journalkärnan utanför MDR', `${RAPPORT}, D10`, 'delvis', '/patient/:id/lakemedel',
    [`${M}varningarna är märkta som demoregler`, 'Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler',
      // Runda 6, r1: NEWS2 och skalorna i en egen modul (skalor.js), märkta som demoregler.
      'Skalor > NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4'],
    'Varningsreglerna vid ordination ligger i lakemedel.js, och reglerna för administrering, utsättning och läkemedelsgenomgång i en egen modul (lakemedelsregler.js), skild från journalkärnan. De fördefinierade ordinationerna ligger i ordinationsmallar.js. NEWS2, GCS, NRS, referensintervallen och eGFR ligger i skalor.js. Alla är märkta som demoregler. Ingen MDR-bedömning är gjord.'),
  k('D11', 'Styrd lokal anpassning av mallar inom fastställda ramar', `${RAPPORT}, D11`, 'planerat', null, [], 'Mallarna är fasta i koden i första versionen.'),
  k('D12', 'All drift, support och personuppgiftsbehandling inom EU', `${RAPPORT}, D12`, 'planerat', null, [], 'Demon innehåller inga riktiga personuppgifter. Driftkrav och DPIA är inte gjorda.'),

  // Lagkrav och nationella tjänster
  k('L1', 'En journal per patient, signatur och tidpunkt, ingen ändring eller utplåning', 'PDL 3 kap., HSLF-FS 2016:40 6 kap.', 'delvis', '/patient/:id/anteckningar',
    [`${J}signerad anteckning kan inte ändras i databasen (trigger)`, `${J}signerad anteckning kan inte raderas (trigger)`, `${J}signerad anteckning flyttas till en annan patient bara under en sammanslagning av just de journalerna (trigger)`, `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
      `${A}helflöde: anteckning skapas, signeras och rättas`,
      'Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan',
      'Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel',
      'Kontrasignering > den som har signerat kan inte kontrasignera själv'],
    'Bevarande i minst tio år gäller inte demons sandlådor, som lever i åtta timmar. Journalen utplånas bara efter ett registrerat beslut, om förstöring enligt patientdatalagen 8 kap. 4 § eller om gallring tidigast tio år efter den sista uppgiften (3 kap. 17 §), och det loggas. Kontrasignering finns, och den som har signerat kan inte kontrasignera själv.'),
  k('L2', 'Behörighet efter behovs- och riskanalys, minsta nödvändiga åtkomst', 'PDL 4 kap. 2 §, HSLF-FS 4 kap. 2 till 3 §§', 'delvis', '/patient/:id',
    [`${B}yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte`, `${B}yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel`],
    'Rollerna ger minsta åtkomst. En dokumenterad behovs- och riskanalys finns inte.'),
  k('L3', 'Spärr, aktivt val, synlig spärrmarkering och nödåtkomst', 'PDL 4 kap. 4 till 5 §§, HSLF-FS 4 kap. 4 till 8 §§', 'uppfyllt_demo', '/patient/:id',
    [`${B}inre sekretess: andra enheters uppgifter kräver aktivt val`, `${B}inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val`,
      `${B}spärr: spärrmarkering syns men innehållet döljs`, `${B}spärr: aktivt val häver inte spärren`, `${B}spärr: samtycke i stunden visar spärrade uppgifter`,
      `${B}nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst`, `${B}nödåtkomst: häver aldrig en spärr`, `${A}spärrmarkering och samtycke via API`,
      `${A}nödåtkomst via API flaggas i logguppföljningen`, `${MJ}spärrade uppgifter visas för patienten själv och spärren redovisas`,
      `${MJ}begäran om spärr ändrar inte spärren och registreras som begäran till vården`,
      'Uppmärksamhetsinformation > en bekräftad uppgift ur spärrade uppgifter följer källans spärr, och utsättningen röjs inte i förslagen',
      `${VK}nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras`,
      `${VK}en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades`,
      `${VK}hälsoärendet visar bara de vårdkontakter som användaren får se`,
      `${VK}FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se`],
    'Lag 2022:913 om sammanhållen vård- och omsorgsdokumentation är inte läst och inte inbyggd. Patienten kan i Min journal begära spärr eller att en spärr hävs, men begäran behandlas inte av någon i demon.'),
  k('L4', 'Loggning av varje åtkomst, logguppföljning och logginformation till patienten', 'HSLF-FS 2016:40 4 kap. 9 till 12 §§, PDL 5 kap. 5 § och 8 kap. 5 §', 'delvis', '/logg',
    [`${L}varje rad kedjas med sha256 av föregående hash och raden`, `${L}UPDATE på loggen avbryts av trigger`, `${L}DELETE på loggen avbryts av trigger`,
      `${L}verifiera upptäcker ändrad rad när triggern släppts i en kopia`, `${A}logggranskaren ser logg med hel kedja, andra roller nekas`, `${F}FHIR-anrop loggas`,
      `${MJ}logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn`, `${MJ}nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista`,
      `${MJ}patientens egen läsning loggas som egen åtkomst och flaggas inte i logguppföljningen`,
      `${MJ}nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan`,
      'Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra',
      'Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel',
      'Datauttag > bara uppföljningsrollen når datauttaget, och nekade försök loggas',
      // Runda 6, r1: export av loggen, säkerhetsloggen och stickprovskontroll (4 kap. 9 b §).
      'Export av loggen > åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas',
      'Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras',
      'Stickprovskontroll > systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår',
      'Stickprovskontroll > en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas'],
    'Utskrifter, utlämnanden, export till e-arkiv, gallring, radering och datauttag loggas också. Loggen kan inte ändras och kan följas upp med flaggor. Patienten ser själv i Min journal vilken vårdenhet och yrkesroll som har läst journalen, när och på vilken grund (HSLF-FS 2016:40 4 kap. 10 §), och kan begära ett loggutdrag med namn. Stickprovskontroller enligt 4 kap. 9 b § finns: systemet drar åtkomsterna slumpvis, säger vad som ska kontrolleras och sparar granskningen så att kontrollen är dokumenterad. Loggen kan exporteras till fil som NDJSON eller CSV med hela kedjan, och säkerhetshändelser loggas i en egen kedja. Lagring i minst fem år finns inte, eftersom demons sandlådor lever i åtta timmar, och inloggningen i Min journal är simulerad (se L5).'),
  k('L5', 'Flerfaktorsautentisering vid direktåtkomst och patientens e-åtkomst', 'HSLF-FS 2016:40 3 kap. 15 § och 4 kap. 11 till 12 §§, PDL 5 kap. 5 §', 'delvis', '/',
    [`${MJ}inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter`, `${MJ}patienten når sin egen journal men inte någon annans, oavsett id i adressen`,
      `${MJ}patientsessionen når inga av personalens API:er`, `${MJ}personalens session når inte Min journal`, `${MJ}utloggning och byte av roll i samma webbläsare nollställer sessionen`,
      `${MJ}anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas`,
      `${MJ}en äldre version av en anteckning som har ersatts av en version som inte visas går inte att nå, varken i Min journal eller i FHIR`,
      `${B}invånare: egen journal från 16 år, vårdnadshavare till 13 år och aldrig för ett barn med skyddad identitet`],
    'Patientens e-tjänst Min journal finns, med egen session och egen behörighet på servern, och den talar om vad som inte visas (4 kap. 12 §). Flerfaktorsautentisering finns inte: e-legitimationen för patienten och SITHS-kortet för personalen är simulerade och kopplade till ingen extern tjänst.'),
  k('L6', 'Skyddade personuppgifter hanteras i hela kedjan, även uppropning', 'OSL 25 kap., Örebro-fallet 2024', 'uppfyllt_demo', '/vantrum',
    [`${B}skyddad identitet: namn och personnummer maskeras`, `${A}arbetslista maskerar skyddad identitet`, `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}väntrummet visar aldrig namn för skyddad patient`, `${A}visa identitet kräver syfte och loggas`, `${F}skyddad patient maskeras i FHIR`,
      `${MJ}skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter`],
    'Paragrafen i OSL är inte verifierad i rapporten.'),
  k('L7', 'NLL: ordinationsorsak och uppföljningsdatum, kvittens för varje överföring', 'Prop. 2024/25:182', 'delvis', '/patient/:id/lakemedel',
    [`${M}ordinationsorsak är obligatorisk`, `${M}uppföljningsdatum är obligatoriskt`, `${M}databasen vägrar ordination utan orsak (CHECK)`, `${M}NLL: normal överföring kvitteras`,
      `${M}NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen`, `${S}alla ordinationer har orsak och uppföljningsdatum`,
      `${KV}ordinationerna i seeden har dos och administrationsväg som passar produktens styrka och form`, `${FS}MedicationRequest har NPL-id med E-hälsomyndighetens system`,
      'Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick',
      // Runda 6, r2: förpackning med NPL-pack-id, och en muntlig ordination skickas när läkaren har signerat.
      'Förpackning med NPL-pack-id > katalogens förpackningar finns i NPL under samma produkt och är inte avregistrerade',
      'Förpackning med NPL-pack-id > systemet väljer förpackningen när förskrivaren inte väljer, och överföringen till NLL har NPL-pack-id',
      'Muntlig ordination > sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar'],
    'Administreringar, vidimeringar och läkemedelsgenomgångar registreras i journalen men skickas inte till NLL, som bara tar emot ordinationer och förskrivningar. NLL är simulerad. Ingen riktig anslutning till E-hälsomyndigheten. Läkemedlen har riktiga NPL-id från Läkemedelsverket. Varje ordination av en produkt i NPL har sedan 2026-11-03 en förpackning med NPL-pack-id ur Läkemedelsverkets NPL, vald av förskrivaren eller förvald av systemet, och FHIR anger den med E-hälsomyndighetens system för NPL-pack-id. Varunummer ur E-hälsomyndighetens produkt- och artikelregister saknas, eftersom registret inte är öppet nedladdningsbart. En muntlig ordination skickas till NLL först när läkaren har signerat, och blodprodukter, nutrition och egendefinierade läkemedel skickas inte.'),
  k('L8', 'NPÖ, 1177 journal, e-remiss, Webcert och tjänsteplattformen (RIVTA)', 'Inera', 'planerat', null, [], 'Inga riktiga integrationer i första versionen. Vårdkällan har en egen e-tjänst för patienten, Min journal (L4 och L5), men ingen anslutning till 1177 journal via tjänsteplattformen.'),
  k('L9', 'HSA, SITHS, Säker digital kommunikation, patientregistret och kvalitetsregister', 'Inera, Socialstyrelsen', 'planerat', null,
    [`${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`],
    'HSA-id i demon är påhittade. Ingen rapportering till patientregistret byggs. Diagnoserna har ICD-10-SE 2026, som rapporteringen kräver, kontrollerade mot Socialstyrelsens kodfil.'),
  k('L10', 'EHDS: CE-märkning, interoperabilitets- och loggningskomponent', 'Förordning (EU) 2025/327', 'planerat', null,
    [`${FS}inga tomma listor, tomma strängar eller tomma värden, och varje kodning har system och kod`, `${FS}Patient, Organization och Practitioner följer HL7 Swedens basprofiler`],
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
    [`${R}larm: mottagningskvittens saknas efter 2 timmar`, `${R}larm: svar inte kvitterat efter 3 dagar`, `${M}NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen`]),
  k('M5', 'Migrerad historik blev osynlig: avstämd migrering och kronologisk vy', `${RAPPORT}, Misstag att inte upprepa`, 'uppfyllt_demo', '/migrering',
    [`${A}översikten har tidslinje med migrerade poster märkta`, `${A}migreringsavstämningen visar avvikelsen`]),
  k('M6', 'För bred åtkomst och svaga spärrar: behörighet som testat krav', `${RAPPORT}, Misstag att inte upprepa`, 'uppfyllt_demo', '/patient/:id',
    [`${B}spärr: aktivt val häver inte spärren`, `${B}nödåtkomst: häver aldrig en spärr`, `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`,
      `${MJ}patientsessionen når inga av personalens API:er`, `${MJ}svaren innehåller inga id, interna anteckningar eller uppgifter om andra patienter`,
      `${MJ}ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas`]),
  k('M7', 'Personuppgifter utanför EU: EU-krav i avtal och arkitektur', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, []),
  k('M8', 'Uppgraderingar skapar nya fel: små releaser och automatiserade tester', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/krav',
    [`${KR}status uppfyllt_demo bara när alla tester är gröna`], 'Återgång är inte byggd.'),
  k('M9', 'Fler klick och långsamhet: klickbudget och svarstidsmål', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/drift',
    [`${A}drift visar p50 och p95 per adress i API:t`, `Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden`],
    'Svarstid mäts i drift och klick mäts med ett skript i Playwright. Sekreterare, vårdadministratörer och andra verkliga användare har inte varit med i designen eller mätningen.'),
  k('M10', 'Ändringar fastnar i samverkan: eget förvaltningsteam med beslutsrätt', `${RAPPORT}, Misstag att inte upprepa`, 'planerat', null, [], 'Gäller organisation, inte koden.'),
  k('M11', 'Beslut utanför demokratisk insyn: diarieföring och öppen dokumentation', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/krav', [], 'Designen och koden är öppna. Diarieföring gäller organisationen.'),
  k('M12', 'Inlåsning: regionägd kod och data i öppna format', `${RAPPORT}, Misstag att inte upprepa`, 'delvis', '/fhir/metadata',
    [`${F}sökning ger Bundle searchset`, 'Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil',
      'Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter', 'Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas'],
    'Öppen källkod och FHIR. Alla journaler kan exporteras i ett paket enligt Riksarkivets FGS Paketstruktur 2.0 med journalen i FHIR R4, vilket är återföringen av all data i ett standardiserat arkiveringsformat som avtalet kräver när det upphör. Datauttaget för uppföljning är NDJSON. Paketet är inte prövat mot ett verkligt e-arkiv, och tabeller som inte hör till journalen, till exempel sandlådans inställningar, följer inte med.'),
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
