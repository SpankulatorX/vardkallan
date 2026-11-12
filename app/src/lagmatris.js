// Lagkravsmatrisen (runda 9, r6, Sussa 2.7.1.2): de lagar, förordningar och föreskrifter som reglerar beställarens
// skyldigheter när kärnsystemet används, och för varje skyldighet den funktion i systemet som stödjer den, med de
// automatiska tester som visar det. En skyldighet som bara organisationen eller tillverkaren kan uppfylla, till exempel
// en behovs- och riskanalys, CE-märkning eller anmälan av incidenter, står som en avgränsning med en förklaring och
// pekar på det systemet ändå gör för att stödja den, när det finns något.
//
// Hänvisningarna är skrivna efter lagtexten men är inte juridiskt granskade. Statusen per rad räknas fram ur testerna
// vid varje bygge (sussa/index.js), som för kraven.
// Prefixen är desamma som i krav.js. De står här för sig, eftersom krav.js läser matrisen för kravet L13.
const B = 'Behörighetsmotorn > ';
const A = 'API > ';
const L = 'Åtkomstloggen > ';
const J = 'Journal > ';
const M = 'Läkemedel > ';
const R = 'Remiss > ';
const F = 'FHIR > ';
const LK = 'Läskopia > ';
const MJ = 'Min journal > ';
const GT = 'Gränssnitt > Tillgänglighet > ';

// Lagarna i matrisen. kort är namnet som raderna använder.
export const LAGAR = [
  { kort: 'PDL', namn: 'Patientdatalagen (2008:355)' },
  { kort: 'HSLF-FS 2016:40', namn: 'Socialstyrelsens föreskrifter och allmänna råd om journalföring och behandling av personuppgifter i hälso- och sjukvården (HSLF-FS 2016:40)' },
  { kort: 'Lag 2022:913', namn: 'Lagen (2022:913) om sammanhållen vård- och omsorgsdokumentation' },
  { kort: 'Patientsäkerhetslagen', namn: 'Patientsäkerhetslagen (2010:659)' },
  { kort: 'Patientlagen', namn: 'Patientlagen (2014:821)' },
  { kort: 'OSL', namn: 'Offentlighets- och sekretesslagen (2009:400)' },
  { kort: 'GDPR', namn: 'Dataskyddsförordningen (EU) 2016/679' },
  { kort: 'Arkivlagen', namn: 'Arkivlagen (1990:782) och Riksarkivets föreskrifter' },
  { kort: 'NLL', namn: 'Lagen (2018:1212) om nationell läkemedelslista' },
  { kort: 'HSLF-FS 2017:37', namn: 'Socialstyrelsens föreskrifter och allmänna råd om ordination och hantering av läkemedel i hälso- och sjukvården (HSLF-FS 2017:37)' },
  { kort: 'DOS-lagen', namn: 'Lagen (2018:1937) om tillgänglighet till digital offentlig service' },
  { kort: 'Cybersäkerhetslagen', namn: 'Cybersäkerhetslagen (2025:1506), som genomför NIS2-direktivet (EU) 2022/2555' },
  { kort: 'MDR', namn: 'Förordningen (EU) 2017/745 om medicintekniska produkter' },
  { kort: 'Säkerhetsskyddslagen', namn: 'Säkerhetsskyddslagen (2018:585)' },
];

const rad = (lag, paragraf, skyldighet, stod, tester) => ({ lag, paragraf, skyldighet, stod, tester, avgransning: null });
const avgr = (lag, paragraf, skyldighet, avgransning, stod = null, tester = []) => ({ lag, paragraf, skyldighet, stod, tester, avgransning });

export const MATRIS = [
  // Patientdatalagen
  rad('PDL', '3 kap. 1 och 10 §§', 'Journal ska föras för varje patient (1 §), och en uppgift ska signeras av den som har gjort den (10 §).',
    'En journal per patient. Varje anteckning signeras av den som skrivit den, med tid.', [`${A}helflöde: anteckning skapas, signeras och rättas`]),
  rad('PDL', '3 kap. 14 och 17 §§', 'En uppgift i en journalhandling får inte utplånas eller göras oläslig annat än enligt lag (14 §), och journalen bevaras minst tio år efter den senaste uppgiften (17 §).',
    'En signerad anteckning kan inte ändras eller raderas i databasen. En rättelse blir en ny version och den gamla står kvar. Gallring sker tidigast tio år efter sista uppgiften.',
    [`${J}signerad anteckning kan inte ändras i databasen (trigger)`, `${J}signerad anteckning kan inte raderas (trigger)`, `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
      'Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel']),
  rad('PDL', '4 kap. 1 och 2 §§', 'Behörighet till uppgifter om patienter ska begränsas till vad var och en behöver för sitt arbete.',
    'Behörighetsmotorn ger varje yrkesroll minsta åtkomst, och servern prövar varje anrop.',
    [`${B}yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte`, `${B}yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel`,
      `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`]),
  rad('PDL', '4 kap. 3 §', 'Åtkomst ska dokumenteras och kunna kontrolleras systematiskt.',
    'Varje åtkomst loggas i en kedja som inte kan ändras, och stickprov dras av systemet.',
    [`${L}varje rad kedjas med sha256 av föregående hash och raden`, `${L}UPDATE på loggen avbryts av trigger`, `${L}DELETE på loggen avbryts av trigger`,
      'Stickprovskontroll > systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår']),
  rad('PDL', '4 kap. 4 och 5 §§', 'Inre sekretess: uppgifter i en annan vårdprocess får bara läsas efter ett aktivt val, och patienten kan spärra.',
    'Andra vårdenheters uppgifter kräver ett aktivt val, och en spärr hävs bara med patientens samtycke i stunden.',
    [`${B}inre sekretess: andra enheters uppgifter kräver aktivt val`, `${B}spärr: aktivt val häver inte spärren`, `${B}spärr: samtycke i stunden visar spärrade uppgifter`]),
  rad('PDL', '7 kap. 2 §', 'Patienten får motsätta sig att uppgifter förs till ett kvalitetsregister.',
    'Invändningen registreras av vården eller av patienten själv i Min journal, och registret får inte patientens uppgifter.',
    ['Myndighetsrapportering > kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter',
      'Myndighetsrapportering i API:t > patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den']),
  rad('PDL', '8 kap. 4 §', 'Journalhandlingar förstörs efter beslut av Inspektionen för vård och omsorg.',
    'Arkivarien registrerar beslutet, och bara de utpekade posterna med hela versionskedjan tas bort, med loggning.',
    ['Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan']),
  rad('PDL', '8 kap. 5 §', 'Patienten har rätt att få veta vem som har tagit del av uppgifterna.',
    'Patienten ser i Min journal vilken vårdenhet och yrkesroll som läst journalen och när, och kan begära ett utdrag med namn.',
    [`${MJ}logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn`, `${MJ}nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista`]),

  // HSLF-FS 2016:40
  rad('HSLF-FS 2016:40', '3 kap. 15 §', 'Stark autentisering vid åtkomst till personuppgifter i ett system med direktåtkomst.',
    'Inloggning med SITHS-kort och PIN är byggd som ett flöde i demon, och invånaren loggar in med e-legitimation. Båda är simulerade.',
    [`${MJ}inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter`, `${MJ}personalens session når inte Min journal`]),
  avgr('HSLF-FS 2016:40', '4 kap. 2, 2 a och 3 §§', 'Behörigheter ska tilldelas efter en behovs- och riskanalys, och analysen ska dokumenteras (2 a §).',
    'Analysen görs av vårdgivaren. Systemet ger varje roll minsta åtkomst och visar vad varje roll får, så att analysen kan göras mot det som systemet faktiskt tillåter.',
    'Rollerna och deras handlingar är testade.', [`${B}yrkesroll: logggranskare får läsa loggen men inte journalen`]),
  rad('HSLF-FS 2016:40', '4 kap. 9 och 9 b §§', 'Loggarna ska kontrolleras regelbundet och systematiskt, och kontrollerna dokumenteras.',
    'Logguppföljningen flaggar avvikande åtkomster, och stickprov dras slumpvis och granskningen sparas.',
    ['Stickprovskontroll > en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas', `${A}nödåtkomst via API flaggas i logguppföljningen`]),
  rad('HSLF-FS 2016:40', '4 kap. 12 §', 'Patienten ska få veta när uppgifter inte visas i e-tjänsten.',
    'Min journal talar om vilka anteckningstyper vårdgivaren inte visar.', [`${MJ}anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas`]),
  rad('HSLF-FS 2016:40', '5 och 6 kap.', 'Journalens innehåll och rättelse: en felaktig uppgift rättas så att den ursprungliga syns.',
    'Rättelse kräver orsak och sparar en ny version.', ['Journal > rättelse kräver orsak', `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`]),

  // Lag 2022:913
  rad('Lag 2022:913', '3 kap. 1, 3, 5 och 6 §§', 'Direktåtkomst till andra vårdgivares uppgifter kräver samtycke eller en nödsituation, och spärrar gäller.',
    'Nödåtkomst kräver ett aktivt val med syfte, häver aldrig en spärr och flaggas i logguppföljningen.',
    [`${B}nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst`, `${B}nödåtkomst: häver aldrig en spärr`, `${A}nödåtkomst via API flaggas i logguppföljningen`]),

  // Patientsäkerhetslagen
  avgr('Patientsäkerhetslagen', '3 kap. 1 och 2 §§', 'Vårdgivaren ska bedriva ett systematiskt patientsäkerhetsarbete.',
    'Arbetet bedrivs av vårdgivaren. Systemet stödjer det med kvittenser och larm när ett meddelande inte når fram, så att inget försvinner mellan vårdnivåer.',
    'Remissernas statuskedja och larm är testade.', [`${R}larm: mottagningskvittens saknas efter 2 timmar`, `${R}larm: svar inte kvitterat efter 3 dagar`]),

  // Patientlagen
  rad('Patientlagen', '3 kap.', 'Patienten ska få information om sin vård. Rätten att ta del av journalen följer av OSL 12 kap. 1 § och PDL 8 kap. 1 §, och e-tjänsten av PDL 5 kap. 5 §.',
    'Min journal visar patientens egna uppgifter, tider och vad som inte visas, med egen session.',
    [`${MJ}patienten når sin egen journal men inte någon annans, oavsett id i adressen`, `${MJ}patientsessionen når inga av personalens API:er`]),

  // OSL
  rad('OSL', '21 kap. 3 § och 25 kap. 1 §', 'Sekretess i hälso- och sjukvården, och skydd för personer med skyddade personuppgifter.',
    'Skyddad identitet maskeras överallt, också i väntrummet, och visas bara med syfte som loggas.',
    [`${B}skyddad identitet: namn och personnummer maskeras`, `${A}väntrummet visar aldrig namn för skyddad patient`, `${A}visa identitet kräver syfte och loggas`, `${F}skyddad patient maskeras i FHIR`]),

  // GDPR
  rad('GDPR', 'Artikel 5.1 f och 32', 'Lämpliga tekniska åtgärder för säkerheten: behörighet, loggning och skydd för kopior.',
    'Loggen är en kedja som inte kan ändras, säkerhetshändelser loggas för sig och läskopian vid avbrott är krypterad.',
    ['Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras', `${LK}spärrade uppgifter och skyddad identitet följer samma regler i läskopian`]),
  rad('GDPR', 'Artikel 15 och 20', 'Den registrerade har rätt till tillgång till sina uppgifter och att få dem i ett maskinläsbart format.',
    'Patienten läser sin journal i Min journal och kan hämta allt med FHIR Patient/$everything.',
    [`${MJ}FHIR med patientens session: egna resurser och $everything, inget annat`, `${MJ}FHIR för invånaren lämnar inte ut mer än Min journal`]),
  rad('GDPR', 'Artikel 25', 'Inbyggt dataskydd: uppgifter för uppföljning ska vara så få som möjligt och pseudonymiserade.',
    'Datauttaget för uppföljning har inga namn, personnummer, adresser eller fritext, och spärrade uppgifter kommer inte med.',
    ['Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext', 'Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet']),
  avgr('GDPR', 'Artikel 30 och 35', 'Register över behandlingar och konsekvensbedömning.',
    'Registret och konsekvensbedömningen tas fram av vårdgivaren som personuppgiftsansvarig. Demon innehåller inga riktiga personuppgifter.'),

  // Arkivlagen
  rad('Arkivlagen', '3 till 6 och 10 §§', 'Allmänna handlingar ska bevaras, ordnas och kunna lämnas till arkivmyndigheten, och gallring sker efter beslut.',
    'Journalerna kan exporteras till e-arkiv i Riksarkivets FGS Paketstruktur 2.0 med kontrollsummor, och gallring görs bara efter ett registrerat beslut.',
    ['Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil', 'Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter']),

  // Nationell läkemedelslista
  rad('NLL', '3 kap.', 'Ordinationer och förskrivningar ska föras över till den nationella läkemedelslistan med ordinationsorsak.',
    'Varje ordination har orsak och uppföljningsdatum, och överföringen kvitteras eller hittas vid avstämning. NLL är simulerad.',
    [`${M}ordinationsorsak är obligatorisk`, `${M}NLL: normal överföring kvitteras`, `${M}NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen`]),

  // HSLF-FS 2017:37
  rad('HSLF-FS 2017:37', '9 kap.', 'Iordningställande och administrering får bara överlåtas med delegering.',
    'Systemet prövar delegeringen vid varje dos och förklarar varför en dos inte går.',
    ['Delegering > undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR', 'Delegering > undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras']),

  // DOS-lagen
  rad('DOS-lagen', '10 till 13 §§', 'Digital service ska vara tillgänglig enligt standarden EN 301 549 (10 till 12 §§), och en tillgänglighetsredogörelse ska finnas (13 §).',
    'Tillgänglighetskontrollen körs i varje vy för varje roll, och redogörelsen skrivs ur samma register.',
    ['Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat', `${GT}varje formulärfält, knapp och länk har ett namn som beskriver syftet`,
      `${GT}texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller`]),

  // Cybersäkerhetslagen och NIS2
  avgr('Cybersäkerhetslagen', '3 och 4 kap.', 'Riskhantering, incidentrapportering och ledningens ansvar hos en verksamhetsutövare.',
    'Kraven gäller organisationen och processerna, och kan inte uppfyllas med kod. Systemet stödjer dem med säkerhetsloggen och prövad återläsning av säkerhetskopior.',
    'Säkerhetshändelser loggas för sig, och återläsningen av kopian prövas.', ['Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser',
      'Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter']),

  // MDR
  avgr('MDR', 'Artikel 2, 5 och 10', 'Programvara med medicinskt syfte ska vara CE-märkt.',
    'CE-märkning görs av tillverkaren och kan inte visas med kod. Vårdkällan är inte CE-märkt. Beslutsstödet ligger i egna moduler, skilda från journalen, och är märkt som demoregler, så att det kan klassas för sig.',
    'Varningarna är märkta som demoregler och ligger i egna moduler.', [`${M}varningarna är märkta som demoregler`, 'Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler']),

  // Säkerhetsskyddslagen
  avgr('Säkerhetsskyddslagen', '2 kap.', 'Säkerhetsskyddsanalys och skydd av säkerhetskänslig verksamhet.',
    'Analysen och skyddet gäller verksamheten och driften, inte systemets funktion. Demon innehåller inga säkerhetsskyddsklassificerade uppgifter.'),
];

// Testerna som matrisen pekar på, för mappningen av 2.7.1.2 och kravet L13.
export const LAGTESTER = [...new Set(MATRIS.flatMap(r => r.tester))];
export const testerFor = (...lagar) => [...new Set(MATRIS.filter(r => lagar.includes(r.lag)).flatMap(r => r.tester))];

// Matrisen med statusen per rad ur testresultaten: uppfylld när alla testerna är gröna, avgränsad när skyldigheten är
// organisationens eller tillverkarens.
export function lagmatris(status = new Map()) {
  return {
    lagar: LAGAR,
    rader: MATRIS.map(r => {
      const tester = r.tester.map(namn => ({ namn, status: status.get(namn) ?? 'saknas' }));
      const grona = tester.length > 0 && tester.every(t => t.status === 'grön');
      return { ...r, tester, status: r.avgransning ? 'avgransad' : grona ? 'uppfylld' : 'delvis' };
    }),
    granskning: 'Hänvisningarna till paragrafer är inte juridiskt granskade.',
  };
}

