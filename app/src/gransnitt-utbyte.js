// Runda 14, r4 (Sussa 3.6.1.3): dokumentationen av gränssnitten för informationsutbyte, så att en beställare själv kan
// ta ansvar för utveckling och förvaltning. Registret är data här, och docs/gransnitt.md skrivs ur det med
// scripts/dokument-md.js. Ett test stoppar bygget om koden har ett gränssnitt mot andra system som inte står i registret:
//   - varje adressprefix som servern själv skickar vidare (url.pathname i server.js, till exempel /fhir, /oauth, /mt och
//     /ps) hör till ett gränssnitt här, eller står bland de interna med motivering;
//   - varje rutt i API:t vars adress tyder på informationsutbyte (ord som riv, intyg, fhir, idp, datauttag och dicomweb,
//     se ORD_FOR_UTBYTE) hör till ett gränssnitt här;
//   - varje fil i src/rivta/ och varje fil i src/ som bygger SOAP-meddelanden eller RIV-TA-namnrymder hör till ett
//     gränssnitt här;
//   - varje adress och fil som registret nämner finns i koden.
// FHIR-resurserna och tjänstekontrakten räknas ur koden (CapabilityStatement och tjanstekontrakt.js), så att dokumentet
// alltid säger samma sak som servern.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { capability } from './fhir.js';
import { KONTRAKT, PRODUCENTER } from './tjanstekontrakt.js';
import { FORMAT as MT_FORMAT } from './medicinteknik.js';
import { FLODEN as PS_FLODEN } from './produktionssystem.js';

export const APP = join(import.meta.dir, '..');
export const ROT = join(APP, '..');

// Fälten för ett gränssnitt:
//   id, rubrik      rubriken är avsnittets rubrik i docs/gransnitt.md.
//   standard        standarden eller formatet, på vanlig svenska.
//   riktning        vem som anropar vem.
//   adresser        adresser som finns i koden (strängar i src/, med :id för en del som varierar).
//   prefix          adressprefix som hör till gränssnittet, för kontrollen av koden.
//   kod             filer i app/ som gränssnittet bygger på.
//   dokument        fler dokument i förrådet.
//   text            vad gränssnittet gör och hur det används.
//   behorighet      behörighet och loggning.
//   simulerat       vad som är simulerat i demon, eller null.
//   hanvisning      gränssnitt som beskrivs i ett annat dokument: sökvägen dit. Adresser och filer prövas då inte.
//   katalog         en katalog i app/ där varje fil hör till gränssnittet.
const g = (id, rubrik, f) => ({ id, rubrik, adresser: [], prefix: [], kod: [], dokument: [], simulerat: null, hanvisning: null, katalog: null, ...f });

const resurstyper = () => capability('').rest[0].resource.map(r => r.type);

export const GRANSSNITT = [
  g('fhir', 'FHIR R4 för läsning och skrivning', {
    standard: 'HL7 FHIR R4 (4.0.1), JSON, med HL7 Swedens basprofiler för patient, organisation och personal',
    riktning: 'Externa tillämpningar och system anropar Vårdkällan',
    adresser: ['/fhir/metadata', '/fhir/Composition', '/fhir/Observation', '/fhir/MedicationRequest'], prefix: ['/fhir'],
    kod: ['src/fhir.js', 'src/fhir-skrivning.js', 'src/fhir-definitioner.js', 'src/oppet-api.js', 'src/api-tackning.js'],
    dokument: ['docs/fhir-validering.md', 'docs/api-avvikelser.md', 'docs/informationsmodell.md'],
    text: () => `Journalens information som FHIR-resurser. CapabilityStatement på /fhir/metadata anger versionen, resurserna, sökparametrarna och vad som går att skriva, och profilerna och operationerna kan läsas utan inloggning. Resurstyperna i dag: ${resurstyper().join(', ')}. Skrivning görs med samma funktioner som gränssnittet, så samma kontroller gäller. Fel svaras med OperationOutcome på svenska. Sidan Öppet API visar täckningen: vilka vanliga flöden som går att göra genom API:t.`,
    behorighet: 'Samma behörighetsmotor som gränssnittet: yrkesroll, vårdrelation, inre sekretess, spärr och skyddad identitet. Varje läsning och skrivning loggas på patienten.',
    simulerat: null,
  }),
  g('smart', 'SMART on FHIR och OAuth 2.0', {
    standard: 'SMART App Launch (EHR launch och standalone launch) med OAuth 2.0, kod med PKCE (S256)',
    riktning: 'En extern tillämpning startas från journalen eller för sig och anropar FHIR-API:t med en åtkomstbiljett',
    adresser: ['/fhir/.well-known/smart-configuration', '/oauth/authorize', '/oauth/token', '/oauth/revoke', '/tillampningar/'], prefix: ['/oauth', '/tillampningar'],
    kod: ['src/smart.js', 'src/oppet-api.js', 'src/api-forvaltning.js'],
    text: 'Tillämpningarna registreras av systemförvaltaren på sidan Öppet API med de omfång och adresser som de får använda. En biljett gäller den inloggade personen, begränsas av omfånget och ger aldrig mer än personen själv får. Den går ut efter 30 minuter och återkallas vid utloggning och när tillämpningen stängs. Demon har en registrerad tillämpning på samma server.',
    behorighet: 'Varje anrop prövas och loggas som om personen gjorde det, utan aktiva val, nödåtkomst eller samtycke. Utfärdande, återkallelse och utgång loggas.',
  }),
  g('systemkonton', 'Systemkonton med SMART Backend Services', {
    standard: 'SMART Backend Services: OAuth 2.0 client_credentials med private_key_jwt',
    riktning: 'Ett system utan inloggad person, till exempel ett regionalt vårddatalager, hämtar från Vårdkällan',
    adresser: ['/oauth/token', '/api/oppet-api/systemkonton'], prefix: ['/api/oppet-api/systemkonton'],
    kod: ['src/systemkonton.js', 'src/oppet-api.js'],
    text: 'Systemförvaltaren registrerar systemets offentliga nyckel och väljer informationsmängder och vårdenheter. Systemet räknar fram omfånget och skriver på vanlig svenska vad kontot får. Kontot byter ett klientintyg som det har signerat mot en åtkomstbiljett och läser sedan FHIR-API:t och prenumererar på nya poster.',
    behorighet: 'Kontot läser bara poster som har registrerats på dess vårdenheter och i dess informationsmängder, och kontot slås upp vid varje prövning så att en återkallelse gäller direkt. Varje läsning loggas.',
  }),
  g('prenumerationer', 'Prenumerationer och webbhookar', {
    standard: 'FHIR R4 Subscription med rest-hook',
    riktning: 'Vårdkällan skickar ett meddelande till en godkänd mottagare när något är nytt, ändrat eller borttaget',
    adresser: ['/fhir/Subscription', '/api/oppet-api/mottagare'], prefix: ['/api/oppet-api/mottagare'],
    kod: ['src/prenumeration.js', 'src/oppet-api.js'],
    text: 'Meddelandet innehåller bara id: prenumerationen, händelsens nummer och resursens adress, inga patientuppgifter. Mottagaren hämtar resursen med sin egen behörighet. Mottagaradressen ska vara godkänd av systemförvaltaren och vara https på port 443, namnet slås upp en gång och får inte peka på en intern adress, och omdirigeringar följs aldrig.',
    behorighet: 'Den som skapar prenumerationen måste få söka resurstypen, och före varje meddelande prövas att personen eller systemkontot fortfarande får läsa just den resursen. Det som inte får läsas ger inget meddelande.',
    simulerat: 'I demon sparas meddelandena men skickas inte, om inte driften har slagit på utskick till de godkända mottagarna.',
  }),
  g('datauttag', 'Datauttag för uppföljning', {
    standard: 'NDJSON med ett manifest i samma form som FHIR Bulk Data Access',
    riktning: 'Uppföljningens system hämtar från Vårdkällan',
    adresser: ['/api/datauttag', '/api/datauttag/schema', '/api/datauttag/:typ'], prefix: ['/api/datauttag'],
    kod: ['src/datauttag.js', 'src/utdata-rutter.js'],
    text: 'Fyra tabeller: vårdkontakter, diagnoser, ordinationer och remisser, pseudonymiserade och utan fritext. Uttaget byggs om varje natt och kan läsas inkrementellt med stabila radnycklar. Schemat för tabellerna finns på /api/datauttag/schema.',
    behorighet: 'Bara rollen uppföljning. Varje uttag loggas utan patient. Spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade rader står i manifestet.',
  }),
  g('tjanstekontrakt', 'Nationella tjänstekontrakt i bilaga K10', {
    standard: 'RIV-TA-liknande JSON med kontraktens huvud och kropp',
    riktning: 'Nationella tjänster anropar Vårdkällan som producent; konsumentrollerna är lokala funktioner',
    adresser: ['/api/riv/:kontrakt', '/api/tjanstekontrakt'], prefix: ['/api/riv', '/api/tjanstekontrakt'],
    kod: ['src/tjanstekontrakt.js', 'src/rapportering-rutter.js'],
    text: () => `Tabellen över de ${KONTRAKT.length} tjänstekontrakten i bilaga K10 visar för varje kontrakt vad bilagan anger och hur Vårdkällan svarar mot det. En simulerad producent finns för ${PRODUCENTER.join(', ')}. Producenten läser genom FHIR-API:t, så behörighet och loggning är desamma.`,
    behorighet: 'Samma som FHIR-API:t. Varje anrop loggas med kontraktets namn i loggens resurs.',
    simulerat: 'JSON i stället för SOAP och utan tjänsteplattformen. Inte anslutet till den nationella tjänsteplattformen.',
  }),
  g('rivta', 'RIVTA-kontrakt mot tjänsteplattformen', {
    standard: 'RIVTA (SOAP och tjänstekontraktens scheman)',
    riktning: 'Vårdkällan som producent och konsument mot tjänsteplattformen',
    prefix: ['/rivta', '/api/rivta'], katalog: 'src/rivta', hanvisning: 'docs/rivta.md',
    text: 'Den gemensamma grunden för RIVTA och kontrakten för journalen, NPÖ, sammanhållen journalföring, spärr, samtycke, HSA och PU-tjänsten beskrivs i docs/rivta.md, med scheman, versioner och hur kontrakten valideras och prövas mot tjänsteplattformen.',
    behorighet: 'Se docs/rivta.md och docs/sakerhetsarkitektur.md.',
  }),
  g('intyg', 'Intyg, e-remiss och processkontrakt', {
    standard: 'RIVTA-kontrakt för intyg, remiss, vaccination, läkemedel och register',
    riktning: 'Vårdkällan mot Intygstjänsten, Webcert och andra nationella tjänster',
    prefix: ['/api/intyg', '/api/webcert', '/api/eremiss'], hanvisning: 'docs/rivta.md',
    text: 'Intyg och processkontrakten byggs på den gemensamma RIVTA-grunden och beskrivs i docs/rivta.md: Intygstjänsten och Webcert, e-remiss, vaccination, Infektionsverktyget, kvalitetsregister, formulärtjänsten, e-recept och dos.',
    behorighet: 'Se docs/rivta.md och docs/sakerhetsarkitektur.md.',
  }),
  g('medicinteknik', 'Medicinteknisk utrustning', {
    standard: () => `${MT_FORMAT.fhir.namn} och ${MT_FORMAT.hl7v2.namn}`,
    riktning: 'Utrustningen skickar till Vårdkällan med utrustningens nyckel, utan session',
    adresser: ['/mt/fhir', '/mt/hl7v2', '/mt/format', '/api/mt/utrustning'], prefix: ['/mt'],
    kod: ['src/medicinteknik.js', 'src/medicinteknik-rutter.js', 'src/mt-klass.js'],
    text: () => `${MT_FORMAT.fhir.text} ${MT_FORMAT.hl7v2.text} Formaten, koderna och enheterna finns som JSON på /mt/format. Ett meddelande i fel format, med okänd kod, fel enhet, orimligt värde eller fel tid nekas med en förklaring på svenska och sparas med orsaken. Värdena klassas som referens tills en läkare eller sjuksköterska har godkänt dem.`,
    behorighet: 'Utrustningen identifieras med en nyckel som visas en gång. Värden tas bara emot under en gällande koppling till patienten, och varje koppling loggas.',
    simulerat: 'Utrustningen och dess nycklar är simulerade i demon.',
  }),
  g('produktionssystem', 'Producentsystem för beställning och svar', {
    standard: 'HL7 FHIR R4: Bundle, ServiceRequest, Specimen, Task, DiagnosticReport och ActivityDefinition',
    riktning: 'Laboratoriets system hämtar beställningar och skickar status, svar och katalog till Vårdkällan',
    adresser: [...PS_FLODEN.map(f => f.vag), '/api/produktionssystem'], prefix: ['/ps', '/api/produktionssystem'],
    kod: ['src/produktionssystem.js', 'src/labb-fhir.js'],
    text: () => `Fyra flöden: ${PS_FLODEN.map(f => `${f.text.toLowerCase()} (${f.metod} ${f.vag})`).join(', ')}. Ett meddelande som inte går att ta emot får svar i en OperationOutcome på svenska, och inget sparas förrän hela meddelandet är kontrollerat. Systemförvaltaren ansluter ett laboratorium på sidan för producentsystem och får nyckeln en gång.`,
    behorighet: 'Laboratoriet identifieras med sin nyckel, som sparas som HMAC. Varje svar som rör en patient loggas.',
    simulerat: 'Laboratoriernas producentsystem är simulerade, men går genom samma gränssnitt och kontroller som ett riktigt.',
  }),
  g('dicomweb', 'Bilder med DICOMweb', {
    standard: 'DICOMweb (QIDO-RS och WADO-RS)',
    riktning: 'Bildvisaren och andra system hämtar studier, serier och instanser från Vårdkällan',
    adresser: ['/api/dicomweb/studies'], prefix: ['/api/dicomweb'],
    kod: ['src/bildmedia.js', 'src/r11r5-rutter.js'],
    text: 'Studier, serier och instanser med metadata, visningsbilder och miniatyrer, mot bildarkivet i demon.',
    behorighet: 'Samma behörighet som journalen, prövad på bildens patient, och varje hämtning loggas.',
    simulerat: 'Bildarkivet är simulerat i demon.',
  }),
  g('earkiv', 'Export till e-arkiv och återföring', {
    standard: 'Riksarkivets FGS Paketstruktur 2.0 (E-ARK CSIP och SIP 2.1.0) med journalen i HL7 FHIR R4',
    riktning: 'Vårdkällan levererar paket till e-arkivet och får en signerad kvittens',
    adresser: ['/api/arkiv/beslut/:id/paket', '/api/arkiv/beslut/:id/leverera', '/api/arkiv/leverans/:id/kontroll'], prefix: ['/api/arkiv/beslut/:id/paket', '/api/arkiv/beslut/:id/leverera', '/api/arkiv/leverans'],
    kod: ['src/arkiv.js', 'src/earkiv.js', 'src/zip.js', 'src/earkiv-scheman'],
    dokument: ['docs/earkiv-validering.md'],
    text: 'Arkivarien registrerar ett beslut, och systemet bygger paketet med METS, PREMIS, SHA-256 för varje fil och mappningen mot e-arkivets dataelement. Paketet med alla journaler är återföringen av all data när avtalet upphör. Paketet är prövat med E-ARK:s validator.',
    behorighet: 'Bara arkivarien, med ett registrerat beslut. Varje journal i paketet loggas som utlämnad till e-arkivet.',
    simulerat: 'E-arkivet är simulerat i demon, och paketet är inte prövat mot en verklig leveransöverenskommelse.',
  }),
  g('utskrift', 'Utskrift och utlämnande', {
    standard: 'Utskriftsvänlig sida som webbläsaren skriver ut eller sparar som PDF',
    riktning: 'Vårdkällan lämnar ut en journalkopia på papper eller som fil',
    adresser: ['/api/patient/:id/utskrift', '/api/utskrift/:id', '/api/patient/:id/utskrifter'], prefix: ['/api/utskrift'],
    kod: ['src/utskrift.js', 'src/utdata-rutter.js'],
    text: 'Systemet väljer syfte och delar ur sammanhanget. Varje utskrift sparas med id, delar, versioner och en kontrollsumma, och utskrifts-id:t står på varje sida.',
    behorighet: 'Samma behörighet som på skärmen. Utskriften loggas och utlämnandet registreras.',
    simulerat: 'Det finns ingen central utskriftstjänst.',
  }),
  g('rapportering', 'Rapportering till myndigheter och kvalitetsregister', {
    standard: 'Mottagarnas egna filformat, sammanställda ur journalen',
    riktning: 'Vårdkällan skickar till myndigheter och register',
    adresser: ['/api/rapportering', '/api/rapportering/:id/skicka', '/api/graviditetsregistret/skicka'], prefix: ['/api/rapportering', '/api/graviditetsregistret'],
    kod: ['src/myndighetsrapport.js', 'src/rapportering-rutter.js', 'src/graviditetsregistret.js', 'src/bhvq.js'],
    text: 'Systemet sammanställer det som är nytt sedan förra utskicket, kontrollerar varje post och förklarar felen på vanlig svenska innan något skickas.',
    behorighet: 'Varje patient som rapporteras loggas som ett utlämnande. Uppföljningsrollen ser antal och fel, inga patientuppgifter.',
    simulerat: 'Mottagarna är simulerade, och inget skickas på riktigt.',
  }),
  g('masterdata', 'Masterdata', {
    standard: 'Utbytbara adaptrar med ett gemensamt kontrakt för varje källa',
    riktning: 'Vårdkällan hämtar organisation, personal, befolkning, läkemedel och kodverk från sina källor',
    adresser: ['/api/masterdata', '/api/masterdata/:del/synkronisera', '/api/hsa-katalog'], prefix: ['/api/masterdata', '/api/hsa-katalog'],
    kod: ['src/masterdata.js'],
    text: 'Varje källa valideras innan något ändras, och synkroniseringen räknar själv ut vad som är nytt, ändrat och borta. Inget raderas.',
    behorighet: 'Synkroniseringen görs av systemförvaltaren och loggas.',
    simulerat: 'Bara filadaptern finns, och den läser seeden. Inga riktiga anslutningar till HSA, PU-tjänsten eller NPL finns.',
  }),
  g('inloggning', 'Inloggning med biljett och flerfaktor', {
    standard: 'OpenID Connect: id-biljett som JWT signerad med ES256, JWKS och Discovery; WebAuthn och RFC 6238 för den andra faktorn',
    riktning: 'En autentiseringstjänst utfärdar biljetten och Vårdkällan kontrollerar den',
    adresser: ['/api/login/biljett', '/api/idp/jwks', '/api/idp/.well-known/openid-configuration', '/api/login/flerfaktor'], prefix: ['/api/idp', '/api/login/biljett', '/api/login/flerfaktor'],
    kod: ['src/idp.js', 'src/flerfaktor.js'],
    dokument: ['docs/sakerhetsarkitektur.md'],
    text: 'Vårdkällan godtar bara biljetter från betrodda utfärdare, med rätt algoritm, nyckel, mottagare och giltighetstid, och bara en gång. Inloggningen tas helt ur biljettens attribut: person, medarbetaruppdrag och vårdenhet.',
    behorighet: 'Varje inloggning och varje misslyckat försök hamnar i säkerhetsloggen.',
    simulerat: 'Autentiseringstjänsten och SITHS-kortet är simulerade.',
  }),
  g('inloggningstjanst', 'Inloggningstjänstens biljett', {
    standard: 'Inloggningstjänstens biljett',
    riktning: 'Inloggningstjänsten lämnar en biljett som Vårdkällan löser in',
    hanvisning: 'docs/sakerhetsarkitektur.md',
    text: 'Inloggningen via inloggningstjänstens biljett beskrivs i docs/sakerhetsarkitektur.md.',
    behorighet: 'Se docs/sakerhetsarkitektur.md.',
  }),
  g('signering', 'Signerade meddelanden och certifikat', {
    standard: 'ECDSA P-256 med SHA-256 över ett meddelandehuvud, med certifikatkedja och signerad kvittens',
    riktning: 'Vårdkällan och andra organisationer signerar och kvitterar meddelanden till varandra',
    adresser: ['/api/certifikat', '/api/signerade/:id/kontroll'], prefix: ['/api/certifikat', '/api/signerade'],
    kod: ['src/signering.js', 'src/pki.js'],
    text: 'Beviset för varje meddelande sparas och kan kontrolleras när som helst, så att ingen av parterna senare kan förneka vad som skickades och togs emot.',
    behorighet: 'Mottagaren kontrollerar certifikatkedjan mot de betrodda utfärdarna, att certifikatet gäller och inte är återkallat och att signaturen och innehållets hash stämmer. Bevisen ändras och raderas aldrig.',
    simulerat: 'Certifikaten är utfärdade av en test-CA som skapas när servern startar och inte är publikt erkänd.',
  }),
  g('kalender', 'Kalenderprenumeration och inbjudningar', {
    standard: 'iCalendar (RFC 5545)',
    riktning: 'Personalens kalenderprogram hämtar från Vårdkällan',
    adresser: ['/api/kalender/', '/api/kalender/lank', '/api/bokning/:id/inbjudan.ics'], prefix: ['/api/kalender'],
    kod: ['src/kontorsstod.js', 'src/r10r7-rutter.js'],
    text: 'Personen skapar en hemlig länk som läggs in som prenumeration i kalenderprogrammet. Länken visas en gång och kan återkallas.',
    behorighet: 'Länken sparas som HMAC, och kalendern hämtas utan inloggning och utan att någon sandlåda skapas. Den visar bara personens egna tider, med tid, typ och mottagning, och antalet hämtningar per timme har ett tak.',
  }),
  g('lasekopia', 'Läskopian vid avbrott', {
    standard: 'JSON, krypterad i webbläsaren med AES-GCM',
    riktning: 'Vårdkällans webbgränssnitt hämtar en läskopia och skickar loggen från läsläget',
    adresser: ['/api/lasekopia', '/api/lasekopia/logg', '/api/lasekopia/krypterad-logg'], prefix: ['/api/lasekopia'],
    kod: ['src/server.js', 'public/js/lasekopia.js', 'public/js/reservkopia.js'],
    text: 'När servern inte svarar läser gränssnittet ur en krypterad läskopia, och loggen från läsläget förs över när servern svarar igen. Läskopian är ett gränssnitt mellan Vårdkällans server och dess egen klient, inte mot andra system, men den beskrivs här eftersom den lämnar ut journalinformation.',
    behorighet: 'Läskopian byggs med samma behörighetskontroll som de vanliga anropen, och utlämnandet loggas.',
  }),
];

// Adressprefix som servern skickar vidare men som inte är gränssnitt för informationsutbyte med andra system.
export const INTERNA = {
  '/api': 'Webbgränssnittets eget API. Det är inte ett gränssnitt för informationsutbyte och ändras med gränssnittet; adresserna och avvikelserna står i docs/design.md och docs/api-avvikelser.md.',
  '/api/min': 'Min journal, invånarens del av webbgränssnittet.',
  '/api/health': 'Driftens hälsokontroll, utan uppgifter om patienter.',
};

// Ord i en adress i API:t som tyder på informationsutbyte med ett annat system.
export const ORD_FOR_UTBYTE = /\/(riv|rivta|tjanstekontrakt|intyg|webcert|eremiss|npo|nll|sjf|soap|hsa[a-z-]*|pu|fhir|oauth|idp|dicomweb|datauttag|prenumeration[a-z]*|webbhook[a-z]*|kalender|masterdata|rapportering|graviditetsregistret|certifikat|signerade|produktionssystem|lasekopia)(\/|$)|\/login\/biljett/;
// Innehåll i en källfil som tyder på ett gränssnitt mot den nationella tjänsteplattformen.
export const SOAP_ELLER_RIV = /urn:riv:|soap:Envelope|xmlns:soap|soapenv:Envelope/;

export const PROCESS = [
  ['Läs den maskinläsbara beskrivningen', 'Varje gränssnitt beskriver sig självt där det går: CapabilityStatement på /fhir/metadata, SMART-konfigurationen för FHIR-API:t, autentiseringstjänstens konfiguration och nycklar enligt OpenID Connect (adresserna står vid gränssnitten nedan), formaten för medicinteknik på /mt/format och tabellerna i datauttaget på /api/datauttag/schema. Informationsmodellen finns på /api/informationsmodell och i docs/informationsmodell.md.'],
  ['Anslut ett system', 'Systemförvaltaren registrerar externa tillämpningar, systemkonton och mottagare för prenumerationer på sidan Öppet API och ansluter laboratorier på sidan för producentsystem. Systemet räknar fram omfång och behörigheter ur valen och visar nycklar en gång.'],
  ['Ändra eller lägg till ett gränssnitt', 'Källkoden är öppen under EUPL 1.2. Varje gränssnitt nedan anger filerna det bygger på. Skriv testet först i app/test, och använd samma funktioner och samma behörighetsmotor som gränssnittet, så att behörighet och loggning blir desamma. All kontroll görs på servern.'],
  ['Versionera', 'Versionen står i app/package.json och i CapabilityStatement. Varje ändring i API:t får en rad i ändringsloggen (app/src/api-andringar.js) under versionen, och sidan Öppet API visar ändringsloggen. Bygget stoppas om ändringsloggen och servern inte stämmer.'],
  ['Pröva', 'Servertesterna körs med bun scripts/kor-tester.js och i varje bygge, och bygget stoppas om ett test är rött. FHIR-resurserna valideras med HL7:s validator (docs/fhir-validering.md), exportpaketet med E-ARK:s validator (docs/earkiv-validering.md) och RIVTA-kontrakten mot sina scheman (docs/rivta.md). Avvikelser från standarderna skrivs i docs/api-avvikelser.md.'],
  ['Dokumentera', 'Lägg gränssnittet i registret app/src/gransnitt-utbyte.js och skriv om det här dokumentet med bun scripts/dokument-md.js. Ett test stoppar bygget om koden har ett gränssnitt mot andra system som inte står i registret, eller om dokumentet inte är skrivet ur registret.'],
  ['Förvalta', 'Personal och utvecklare lämnar ärenden om information som saknas i API:t på sidan Öppet API, och systemförvaltaren svarar och följer upp dem där. Täckningen visar vilka vanliga flöden som går att göra genom API:t. Uppgraderingar godkänns av två systemförvaltare och kan backas.'],
];

const varde = (x) => (typeof x === 'function' ? x() : x);

export function markdown() {
  const ut = ['# Gränssnitt för informationsutbyte', '',
    'Den här beskrivningen samlar Vårdkällans gränssnitt för informationsutbyte med andra system och processen för hur en beställare själv utvecklar och förvaltar dem (Sussa 3.6.1.3). Den skrivs ur registret i `app/src/gransnitt-utbyte.js` med `bun scripts/dokument-md.js`, och ett test i bygget stoppar bygget om koden har ett gränssnitt som inte står här.', '',
    '## Översikt', '', '| Gränssnitt | Standard | Riktning |', '| --- | --- | --- |',
    ...GRANSSNITT.map(x => `| [${x.rubrik}](#${ankare(x.rubrik)}) | ${varde(x.standard)} | ${x.riktning} |`),
    '', '## Process för egen utveckling och förvaltning', '',
    ...PROCESS.map(([r, t], i) => `${i + 1}. **${r}.** ${t}`)];
  for (const x of GRANSSNITT) {
    ut.push('', `## ${x.rubrik}`, '', varde(x.text), '', `Standard: ${varde(x.standard)}.`, '', `Riktning: ${x.riktning}.`);
    if (x.adresser.length) ut.push('', `Adresser: ${x.adresser.map(a => `\`${a}\``).join(', ')}.`);
    ut.push('', `Behörighet och loggning: ${x.behorighet}`);
    if (x.simulerat) ut.push('', `Simulerat: ${x.simulerat}`);
    if (x.kod.length || x.katalog) ut.push('', `Koden: ${[...x.kod, ...(x.katalog ? [`${x.katalog}/`] : [])].map(f => `\`app/${f}\``).join(', ')}.`);
    const dok = [...(x.hanvisning ? [x.hanvisning] : []), ...x.dokument];
    if (dok.length) ut.push('', `Dokumentation: ${dok.map(f => `\`${f}\``).join(', ')}.`);
  }
  ut.push('', '## Det som inte är gränssnitt för informationsutbyte', '',
    ...Object.entries(INTERNA).map(([p, t]) => `- \`${p}\`: ${t}`));
  return `${ut.join('\n')}\n`;
}
export const ankare = (t) => t.toLocaleLowerCase('sv-SE').replace(/[^a-z0-9åäö -]/g, '').trim().replace(/ /g, '-');

// ---- Kontrollen av koden -----------------------------------------------------------------------------------------
const allaFiler = (d) => {
  const ut = [];
  if (!existsSync(d)) return ut;
  for (const n of readdirSync(d).sort()) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) ut.push(...allaFiler(f)); else if (n.endsWith('.js')) ut.push(f);
  }
  return ut;
};
export const kallfiler = (src = join(APP, 'src')) => allaFiler(src).map(f => ({ fil: relative(APP, f), text: readFileSync(f, 'utf8') }));

// Adressprefixen som servern skickar vidare i server.js: url.pathname.startsWith('/x') och url.pathname === '/x'.
export function serverprefix(text) {
  const ut = new Set();
  for (const m of text.matchAll(/(?:url\.pathname|path)\.startsWith\('(\/[^']*)'\)|url\.pathname === '(\/[^']*)'/g)) ut.add((m[1] ?? m[2]).replace(/\/+$/, '') || '/');
  return [...ut].sort();
}
// Rutterna i API:t: rutt('GET', '/api/...') i alla källfiler.
export function rutter(filer) {
  const ut = [];
  for (const { fil, text } of filer) for (const m of text.matchAll(/rutt\('([A-Z]+)',\s*['`](\/[^'`]+)['`]/g)) ut.push({ metod: m[1], vag: m[2], fil });
  return ut;
}
const somMonster = (a) => new RegExp(`^${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+')}`);
// Hör adressen till ett gränssnitt i registret? Ett prefix eller en adress som adressen börjar med räcker.
export function gransnittFor(vag, register = GRANSSNITT) {
  const v = vag.replace(/:\w+/g, 'x');
  return register.find(x => [...x.prefix, ...x.adresser].some(p => somMonster(p).test(v) || somMonster(p).test(vag))) ?? null;
}
