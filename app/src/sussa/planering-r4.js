// Runda 6, r4: planering och tidbok, del 2, remiss, del 2 och egen vårdbegäran. Testnamnen (app/test/planering.test.js,
// app/test/remiss-del2.test.js och klickbudgeten) och de poster i Sussa 3.3.1, 3.3.2 och 3.4.1 till 3.4.4 som byggdes
// i rundan. Mappningsfilerna för avsnitten ersätter sina poster med dessa, så att ändringen ligger samlad här.
import { TEST } from '../krav.js';
import { T, flode } from './tidbok-tester.js';

const { A, R } = TEST;
const PL = 'Planering > ';
const KA = 'Kallelser, del 2 > ';
const FI = 'FHIR-incheckning > ';
const PS = 'Planering, säkerhet > ';
const RE = 'Remiss, del 2 > ';
const VB = 'Egen vårdbegäran > ';

export const T4 = {
  resurser: `${PL}seeden har lokaler, utrustning och en simulerad sjukresa som resurser, och tidstypen ingrepp med vad den kräver`,
  ingrepp: `${PL}systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt`,
  ombokaResurser: `${PL}ombokning flyttar rum, utrustning och sjukresa, och avbokning släpper dem`,
  kedja: `${PL}provtagning före läkarbesök: systemet föreslår tiderna i följd med rätt mellanrum och bokar båda med ett klick`,
  kedjaOmboka: `${PL}tider i följd: ombokning flyttar provtagningen med, och avbokning avbokar båda`,
  arbetslista: `${PL}tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter`,
  bevakning: `${PL}egna bevakningar på individ- och enhetsnivå med datum och ansvarig syns i Dagens arbete och inkorgen`,
  bevakningSakerhet: `${PL}egna bevakningar: utan vårdrelation, med fel ansvarig eller på en annan vårdenhet nekas, och skyddad identitet maskeras`,
  period: `${PL}Dagens arbete visar en fritt vald tidsperiod`,
  vyer: `${PL}anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen`,
  vantetider: `${PL}väntetidsstatistik per vårdenhet utan personuppgifter, med vårdgarantin som demoregel`,
  sprak: `${KA}kallelsen skrivs på patientens språk, och patienten väljer språk i Min journal`,
  filer: `${KA}kallelsen som PDF och iCalendar för personalen och för patienten i Min journal, och varje hämtning loggas`,
  filerSkyddad: `${KA}kallelsen som PDF för en patient med skyddade personuppgifter kräver Visa identitet och har aldrig adress`,
  utanTid: `${KA}kallelse utan förbokad tid: patienten väljer själv en tid i Min journal inom ramen som systemet sätter`,
  fhirPersonal: `${FI}personalen checkar in med PATCH på Appointment med samma behörighet som gränssnittet, och det loggas`,
  fhirInvanare: `${FI}invånaren checkar in sin egen tid med PATCH, bara när incheckningen är öppen`,
  fhirEncounter: `${FI}Encounter-status arrived registrerar ankomsten på den planerade vårdkontakten`,
  fhirNekad: `${FI}fel roll, en annan vårdenhet och andra ändringar än status nekas`,
  sakerhet: `${PS}förslagen tar inte hänsyn till bokningar och resurser som användaren inte får se, och en annan vårdenhets resurser används aldrig`,
  utkast: `${RE}ett utkast fylls i av systemet, kan sparas och ändras av den som skrev det och skickas när det är klart`,
  ateranvand: `${RE}ett utkast kan återanvända en tidigare remiss som användaren får läsa`,
  bilagor: `${RE}bilagor: typen avgörs ur innehållet, storleken kontrolleras, filen lagras på servern och varje hämtning loggas`,
  komplettera: `${RE}avsändaren kompletterar en skickad remiss med en bilaga, men inte efter svaret och inte från en annan vårdenhet`,
  vidarebefordra: `${RE}vidarebefordran till en annan vårdenhet med motivering: systemet kvitterar mottagningen och avsändaren ser var remissen är`,
  ledtider: `${RE}ledtider och avvikelser per vårdenhet och för regionen, utan personuppgifter`,
  vardbegaran: `${VB}invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten`,
  vardbegaranAkut: `${VB}vid tecken på akuta besvär hänvisar systemet till 112, och en invånare kan ha högst tre öppna vårdbegäranden`,
};
const kbIngrepp = () => flode('boka-ingrepp');
const kbKedja = () => flode('boka-kedja');

const p = (id, avsedd, egna, tester, losning, expert, anmarkning) => ({ id, kategori: 'system', egna, avsedd, tester, losning, expert, anmarkning });

const POSTER = () => Object.fromEntries([
  p('3.3.1.3', 'delvis', ['D1'], [`${R}seeden har remisser i varje läge och larm`, `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`, `${R}vårdadministratör ser status men inte klinisk text`, T4.bilagor, T4.vidarebefordra, T4.vardbegaran],
    'Remisser visas per patient och i en översikt över inkommande och utgående, med statuskedjan, vem som gjorde varje steg och när, bilagorna, vidarebefordran och om remissen är en egen vårdbegäran från patienten. Det som väntar på åtgärd visas i inkorgen.',
    'Inkorgen visar självt vad som väntar, och kortet visar bara de steg som enheten får ta. Vårdadministratören ser status och att det finns bilagor, men ingen klinisk text och inga filnamn.',
    'Konsultation skiljs inte från remiss. Urval och filter i remissöversikten finns bara som inkommande och utgående, och vårdbegäran från externa vårdgivare saknas (3.3.1.2).'),
  p('3.3.1.4', 'delvis', ['D1'], [`${R}ny remiss valideras`, flode('remiss'), `${A}helflöde: remiss genom hela statuskedjan`, T4.utkast, T4.ateranvand, T4.bilagor, T4.komplettera],
    'En remiss skapas från patientens journal, kan sparas som utkast som bara den som skrev det ser, kan utgå från en tidigare remiss och får bilagor (PDF, PNG, JPEG och text). Den valideras innan den skickas, och avsändaren kan komplettera med en bilaga fram till svaret.',
    'Systemet fyller i patient, avsändare, enhet, prioritet och sista svarsdatum, avgör filtypen ur filens innehåll och inte ur namnet, kopierar frågeställning och anamnes från en tidigare remiss som användaren får läsa och säger på vanlig svenska vad som saknas.',
    'Bilagor är högst 40 kB och fem per remiss i demon, eftersom sandlådan ligger i minnet. Konsultation skiljs inte från remiss.'),
  p('3.3.1.5', 'delvis', ['D1'], [`${R}bara mottagande enhet kan kvittera, bedöma och svara`, `${R}avvisning kräver motivering och avslutar kedjan`, `${R}bara avsändaren kan kvittera svaret`, flode('kvittera-svar'), T4.vidarebefordra, T4.komplettera],
    'Mottagande enhet kvitterar, bedömer, svarar, avvisar med motivering eller skickar remissen vidare till en annan vårdenhet med motivering. Avsändaren kvitterar svaret och kan komplettera med bilagor.',
    'Systemet visar bara de steg som enheten får ta just då. Vid vidarebefordran kvitterar systemet mottagningen, skickar remissen vidare med samma avsändare, så att svaret kommer rätt, och den vårdenhet som skickade vidare har inte längre vårdrelation genom remissen.',
    'Konsultation skiljs inte från remiss, och omprioritering av en inkommande remiss görs på väntelistan efter bedömningen.'),
  p('3.3.1.6', 'uppfyllt_demo', ['D1', 'M4'], [`${R}larm: mottagningskvittens saknas efter 2 timmar`, `${R}larm: svar saknas efter sista svarsdatum`, `${R}larm: svar inte kvitterat efter 3 dagar`, T4.ledtider],
    'Larm när mottagningskvittens, svar eller kvittens av svaret uteblir, och ledtider per vårdenhet och för regionen: median mellan varje mätpunkt i statuskedjan, andel inom förväntad tid, avvikelser, avvisade och vidarebefordrade.',
    'Systemet bevakar tiderna självt, räknar ledtiderna ur statuskedjan med larmgränserna som förväntad handläggningstid och visar dem utan personuppgifter, så ingen behöver ta fram statistiken för hand.',
    'Mätpunkterna är statuskedjans steg. Migrerade remisser räknas inte. På regionnivå visas medianen bara när minst tre remisser finns i mätpunkten.'),
  p('3.3.2.1', 'uppfyllt_demo', ['L5'], [T4.vardbegaran, T4.vardbegaranAkut],
    'Invånaren skickar en egen vårdbegäran i Min journal med en beskrivning av besväret och en bifogad fil. Den hamnar som en remiss hos vårdenheten med Min journal som avsändare, går genom samma statuskedja, och svaret visas för invånaren i Min journal.',
    'Systemet föreslår vårdenheten ur beskrivningen, invånarens kontakter och listning, rekommenderar den som passar och säger att invånaren ska ringa 112 när beskrivningen kan tyda på något akut. Vårdenheten bedömer som vanligt, och en accepterad begäran hamnar på väntelistan som ett nybesök.',
    'Min journal är Vårdkällans egen e-tjänst. Mottagning från 1177 Vårdguidens e-tjänster, visning av status i 1177 och direktkommunikation med invånaren efter svaret finns inte. Förslagen och orden för akuta besvär är demoregler.'),
  p('3.4.1.2', 'uppfyllt_demo', [], [T.seed, T.tidbok, T.forslag, T4.resurser, T4.ingrepp, T4.ombokaResurser, kbIngrepp()],
    'Personal, lokaler, utrustning och sjukresor är resurser i tidboken. Ett ingrepp kräver de resurser som det behöver, till exempel behandlingsrum och defibrillator för en elkonvertering, och bokningen knyter personal, lokal, utrustning och sjukresa till patienten samtidigt.',
    'Systemet väljer själv resurserna ur tidstypen, ingreppet och patientens behov av sjukresa, föreslår bara tider där allt är ledigt hela tiden och bokar allt med ett klick, så ingen behöver veta vilket rum eller vilken utrustning som krävs.',
    'Sjukresan är simulerad och märkt så. Resurser, scheman och ingreppens krav ändras bara i seeden. Utrustningens service läggs in i seeden.'),
  p('3.4.1.3', 'uppfyllt_demo', ['D1', 'M4'], [`${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`, `${R}larm: mottagningskvittens saknas efter 2 timmar`, T.startsida, T.egenbokning, T4.bevakning, T4.bevakningSakerhet],
    'Bevakningar för en patient eller för hela vårdenheten, med datum och ansvarig. De syns i Dagens arbete och i inkorgen, där inkorgens räknare tar med dem, och läggs upp av personalen själv eller skapas av systemet, till exempel när en patient avbokar.',
    'Systemet fyller i datum (om en vecka) och ansvarig (den som lägger upp den), föreslår vanliga texter och skapar själv bevakningar utifrån det som händer, så ingen behöver komma ihåg att följa upp.',
    'Påminnelser utanför systemet, till exempel sms till personalen, finns inte.'),
  p('3.4.1.4', 'uppfyllt_demo', ['D6'], [T.forslag, T.boka, T.skyddad, flode('boka-remiss'), T.abAnteckning, T.abDiagnos, flode('aterbesok'), T4.kedja, T4.kedjaOmboka, kbKedja()],
    'Planeringen använder det som redan finns: remissen, tidigare vårdgivare, andra bokningar, väntelistans gräns och läkarens planering. Flera aktiviteter i följd, till exempel provtagning före läkarbesök, föreslås och bokas i ett steg ur en bokningsmall. Skyddad identitet maskeras i alla listor.',
    'Systemet föreslår läkarbesöket och provtagningen samma dag med rätt mellanrum, bokar båda med ett klick, skickar en kallelse som säger båda tiderna och flyttar eller avbokar provtagningen när läkarbesöket ändras.',
    'Demon har en mall med tider i följd. Mallar ändras bara i seeden.'),
  p('3.4.1.5', 'delvis', [], [T.tidbok, T.forslag, T4.ingrepp, T4.arbetslista, T4.resurser],
    'Tidboken visar beläggningen per vårdgivare och dag och en arbetslista per lokal, utrustning och sjukresa, och förslagen tar hänsyn till att personal, lokal och utrustning är lediga samtidigt.',
    'Systemet räknar beläggningen och väljer bara tider där alla resurser är lediga, och visar resursens dag utan patientuppgifter när tidboken visas utan namn.',
    'Produktionsplanering över längre tid och prognoser för kapacitet finns inte. Sjukresan är simulerad.'),
  p('3.4.1.6', 'uppfyllt_demo', [], [T.tidbok, T.startsida, T.egenbokning, T4.vyer, T4.period, T4.arbetslista],
    'Planeringen visas för enheten (Dagens arbete och tidboken), per vårdgivare (schemat), per resurs (arbetslistan) och per patient (översikten och Min journal). Användaren väljer och sparar vad tidboken och Dagens arbete visar, och tidboken kan visas utan patientuppgifter.',
    'Systemet väljer förvalet efter rollen: vårdadministratören ser hela mottagningen med resurserna, läkaren och sjuksköterskan sitt eget schema. Det användaren väljer sparas på servern och gäller på alla datorer.',
    'Läkare och sjuksköterskor når tidboken från arbetslistan och läser den utan att boka.'),
  p('3.4.1.7', 'uppfyllt_demo', [], [T.vantelista, T.remissVantelista, T.startsida, T4.vantetider],
    'Väntelistan per vårdenhet med prioritet, väntetid och dagar kvar till gränsen, urval och omprioritering med orsak, och statistik över väntetider per tidstyp och yrkesroll för vårdenheten och för regionen, utan personuppgifter.',
    'Systemet räknar dagarna mot vårdgarantin och det medicinska måldatumet, lyfter den som riskerar att passera gränsen och räknar väntetiderna och andelen före gränsen självt.',
    'Vårdgarantin är en demoregel. På regionnivå visas väntetider bara när minst tre patienter väntar i gruppen.'),
  p('3.4.1.8', 'uppfyllt_demo', ['D6'], [`${A}arbetslista maskerar skyddad identitet`, `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`, flode('oppna-patient'), T.startsida, flode('checka-in'), T4.period, T4.bevakning],
    'Arbetslistan, inkorgen och Dagens arbete är aktivitetslistor för olika roller. Dagens arbete visar en fritt vald period med patienter, remisser, väntelista, kallelser och bevakningar, och användaren väljer vilka delar som visas.',
    'Listorna räknas fram ur vårdrelationen, bokningarna och bevakningarna, och varje rad har en enda nästa åtgärd som systemet har valt. Bara dagens patienter kan checkas in.',
    'Aviseringar utanför systemet, till exempel sms eller e-post till personalen, finns inte. Inkorgens räknare är aviseringen i systemet.'),
  p('3.4.2.2', 'delvis', ['D6'], [T.forslag, T.boka, T.omboka, T.avboka, T.kallelse, flode('boka-remiss'), flode('omboka'), T4.ingrepp, T4.kedja, T4.arbetslista, kbIngrepp(), kbKedja()],
    'Bokningen utgår från planeringen på väntelistan. Bokningsmallar finns för ingrepp (personal, lokal och utrustning samtidigt) och för tider i följd (provtagning före läkarbesök). Bokningen skapar vårdkontakten och kallelsen, och resursernas arbetslista visar dagen per lokal och utrustning.',
    'Allt som går att räkna ut görs av systemet: tider, resurser, tiden före, kallelse, kanal, avgift och vårdkontakt. Den som bokar väljer bara bland förslagen, och ändringar flyttar allt som hör ihop.',
    'Bokningsregler och mallar som verksamheten själv kan ändra finns inte i gränssnittet. Arbetslistan per utrustning skickas inte till något medicintekniskt system.'),
  p('3.4.3.3', 'uppfyllt_demo', [], [T.kallelse, T.paminnelse, T.omboka, T.avboka, T.skyddad, T.egenIncheckning, T.grupp, T4.sprak, T4.filer, T4.filerSkyddad, T4.utanTid],
    'Kallelser och påminnelser skrivs ur bokningen, med ett nytt besked när tiden ändras eller avbokas. Patienten bekräftar, väljer språk för kallelserna och kan spara kallelsen som PDF och lägga den i kalendern. En kallelse utan förbokad tid låter patienten välja tid själv i Min journal inom en ram.',
    'Systemet skriver kallelsen på patientens språk, väljer kanal efter skyddad identitet och patientens val, sätter ramen för en kallelse utan tid från i morgon till postens gräns och föreslår samma tider som vårdadministratören får.',
    'Kallelserna finns på svenska och engelska. Sms och brev är simulerade, och underlag till en central distributionskanal finns bara som PDF per kallelse. Kallelse utan förbokad tid gäller återbesök, telefon och video, aldrig nybesök (beslut 2026-11-03).'),
  p('3.4.4.5', 'uppfyllt_demo', [], [T.egenIncheckning, T.skyddad, T.fhir, T.fhirInvanare, T4.fhirPersonal, T4.fhirInvanare, T4.fhirEncounter, T4.fhirNekad],
    'Patienten checkar in i Min journal, som fungerar i mobilen, eller på skärmen i väntrummet. En mobil lösning kan checka in genom FHIR-API:t med PATCH på Appointment eller Encounter, med samma behörighet och loggning som gränssnittet.',
    'Systemet väljer rätt tid, öppnar incheckningen från en timme före till en halvtimme efter tiden och registrerar ankomsten på vårdkontakten. Genom FHIR tas bara incheckning emot, så att andra ändringar alltid går genom systemets regler.',
    'Positionsbaserad incheckning i mobilen finns inte. Skärmen i väntrummet är simulerad.'),
].map(x => [x.id, x]));

// Ersätter avsnittets poster med rundans.
let cache = null;
export const medR4 = (poster) => { cache ??= POSTER(); return poster.map(x => cache[x.id] ?? x); };
