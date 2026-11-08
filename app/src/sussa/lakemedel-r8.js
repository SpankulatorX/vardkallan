// Runda 8, r4: bristerna i läkemedelsprocessen som Sussas testfall 1.1 till 1.4 visade. Testnamnen
// (app/test/lakemedel-r8.test.js och klickbudgeten) och ändringarna i de poster i Sussa 3.5.1 och 3.5.2 som rundan
// byggde. Mappningsfilerna för avsnitten lägger ändringarna ovanpå sina poster, så att de ligger samlade här.
import { TEST } from '../krav.js';

const { GK } = TEST;
const AS = 'Administrationssätt ur beredningsformen > ';
const DM = 'Doseringsmallar per produkt > ';
const TI = 'Tillsatser i infusion > ';
const DA = 'Dosändring > ';
const MF = 'Muntlig ordination i följd > ';

export const T = {
  satt: `${AS}ögondroppar, ögonsalva, nässpray och nebulisator får sitt administrationssätt, och ögondroppar sparas aldrig som peroralt`,
  produkt: `${DM}Alvedon forte 1 g och paracetamol som infusion får egna förslag ur produkten, inte tablettdosen för 500 mg`,
  styrka: `${DM}en annan styrka i samma form får samma antal tabletter och dosen ur styrkan, och en annan form får inte substansens mall`,
  tillsats: `${TI}glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans`,
  dosandring: `${DA}dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning`,
  fran: `${DA}en ny dosering från ett senare datum gäller av sig själv när dagen kommer, också i Läkemedel att ge`,
  sakerhet: `${DA}säkerhet: dosändring kräver ordinationsrätt och vårdrelation, inte trappschema, och en spärrad enhets ordination röjs inte`,
  api: `${DA}API: dosändring med loggning och FHIR`,
  muntlig: `${MF}läkaren och skälet föreslås från sjuksköterskans förra muntliga ordination, bara för samma patient och inom två timmar`,
  kbDos: `${GK}Ändra dosen i en pågående ordination inom budget`,
};
export const TESTER_R8R4 = Object.values(T);

// Ändringar per post: tester som läggs till, text som läggs till sist i lösningen och expertrollen, och en anmärkning
// som ersätter den förra när rundan har byggt det som saknades.
const ANDRINGAR = {
  '3.5.1.3': {
    tester: [T.produkt, T.styrka],
    losning: 'En läkemedelsmall har varianter per beredningsform och styrka, till exempel 1 g tabletter och infusion för paracetamol, som godkänns med mallen.',
    ersattExpert: 'Systemet föreslår doseringen ur den produkt och beredningsform som väljs och ur patientens ålder och njurfunktion, räknar dosen ur styrkan när bara styrkan skiljer och använder inte en mall för en annan beredningsform, så förskrivaren bara ändrar det som avviker. Den som ordinerar ser bara mallar som den mallansvariga läkaren har godkänt och behöver aldrig veta vilken version som gäller.',
  },
  '3.5.1.4': {
    tester: [T.tillsats],
    losning: 'En tillsats som Addex-Magnesium ordineras i basvätskan, så att blandningen är en ordination som kontrolleras, iordningsställs, ges och vidimeras tillsammans.',
    expert: 'Systemet skriver doseringen ur volymen, tillsatserna och tiden, räknar koncentrationen per liter och mängden per timme och säger hur ett koncentrat ordineras när det väljs för sig.',
    ersattAnmarkning: 'Spädningsreglerna är demoregler för fem substanser och två tillsatser, kaliumklorid och Addex-Magnesium, inte granskade av farmaceut. Beredning med etikett och kontroll av den som späder finns inte.',
  },
  '3.5.2.1': {
    tester: [T.tillsats, T.dosandring],
    expert: 'En dosändring görs i den pågående ordinationen, så att administreringen, vidimeringen och NLL följer samma ordination.',
  },
  '3.5.2.12': {
    tester: [T.satt, T.produkt, T.dosandring, T.fran, T.sakerhet, T.muntlig, T.kbDos],
    losning: 'Dosen, doseringen, tiderna och styrkan ändras i en pågående ordination från i dag eller ett senare datum, utan att sätta ut och ordinera på nytt. Administrationssättet följer beredningsformen, också för ögon, öron, näsa, hud, ändtarm och slida, och en engångsdos ordineras med ett klick.',
    ersattExpert: 'Systemet föreslår doseringen, administrationssättet och trappschemat ur produkten och beredningsformen, fyller i den nya doseringen när styrkan byts och kontrollerar varje dos med samma varningar som en ny ordination. Det stoppar en muntlig ordination som inte är signerad efter två timmar, fyller i läkaren och skälet för nästa muntliga ordination och låter en ny dosering gälla av sig själv när dagen kommer.',
  },
  '3.5.2.11': {
    avsedd: 'delvis',
    tester: [T.dosandring, T.fran, T.sakerhet, T.api, T.kbDos],
    losning: 'Förskrivningen justeras i den pågående ordinationen: dosen, doseringen, tiderna och styrkan, från ett datum. Ändringen skickas till NLL, och ett byte av styrka är en ny förskrivning som ersätter den förra med den nya produktens förpackning.',
    expert: 'Systemet föreslår produkterna med samma substans och form och fyller i doseringen för den nya styrkan, så att läkaren inte behöver sätta ut, söka och ordinera på nytt.',
    ersattAnmarkning: 'Överföringen till NLL är simulerad. Förskrivning i Nationellt e-receptformat, makulering av e-recept med kvarvarande uttag och uttag på apotek finns inte.',
  },
  '3.5.2.17': {
    tester: [T.tillsats],
    losning: 'En infusion med tillsats iordningsställs som en dos, med blandningens volym, koncentration och hastighet.',
    expert: 'Systemet visar vid iordningsställandet hur mycket av tillsatsen som sätts till och hur fort blandningen ges.',
  },
  '3.5.2.18': {
    tester: [T.satt],
    losning: 'Listan visar administrationssättet ur ordinationen, också i ögat, i örat och i näsan.',
  },
};

const lagg = (a, b) => (b ? `${a ? `${a} ` : ''}${b}` : a);
// Lägger rundans ändringar ovanpå avsnittets poster.
export const medR8r4 = (poster) => poster.map(x => {
  const a = ANDRINGAR[x.id];
  if (!a) return x;
  return { ...x, ...(a.avsedd ? { avsedd: a.avsedd } : {}), tester: [...x.tester, ...a.tester.filter(t => !x.tester.includes(t))], losning: lagg(x.losning, a.losning), expert: a.ersattExpert ?? lagg(x.expert, a.expert),
    anmarkning: a.ersattAnmarkning ?? x.anmarkning };
});
