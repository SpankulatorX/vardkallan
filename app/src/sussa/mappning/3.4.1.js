// Sussa 3.4.1 Planering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
import { T, flode } from '../tidbok-tester.js';
// Runda 6, r4.
import { medR4 } from '../planering-r4.js';

const { A, M, R, GK } = TEST;

const AVSNITT = [
  {
    id: '3.4.1.1', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [T.remissVantelista, T.forslag, T.boka, T.vantelista, flode('boka-remiss'), T.abTolka, T.abAnteckning, T.abDiagnos, T.abSakerhet, flode('aterbesok'), T.vhVantelista],
    losning: 'Patientplaneringen utgår från väntelistan. En accepterad remiss hamnar där av sig själv, läkaren sätter upp återbesök från en signerad anteckning eller patientens översikt, och en planerad vårdhändelse som ett läkemedel väntar på hamnar där när den saknar bokning. När patienten ska få tid föreslår systemet de lämpligaste tiderna, och bokningen blir en planerad vårdkontakt.',
    expert: 'Systemet tar tidstyp, yrkesroll och prioritet ur remissen, och för återbesöket tidstyp, yrkesroll och tidsram ur anteckningens planering, diagnosen och den senaste kontakten, så läkaren bekräftar med ett klick. Sedan räknar systemet gränsen och föreslår tider hos den vårdgivare patienten har träffat förut, så vårdadministratören bokar med ett klick och letar aldrig i en kalender.',
    anmarkning: 'Vårdgarantin räknas med en demoregel (90 dagar från att remissen togs emot), inte enligt någon regions tillämpning. Förslagen på återbesök efter diagnos är demoregler, och planeringen tolkas ur fri text med enkla regler.',
  },
  {
    id: '3.4.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.seed, T.tidbok, T.forslag],
    losning: 'Varje vårdgivare har ett schema per mottagning med tider av olika typ (nybesök, återbesök, telefon, video och gruppträff), och bokningen knyter tiden till patienten. Tidboken visar beläggningen per vårdgivare och dag.',
    expert: 'Systemet väljer själv rätt resurs ur den yrkesroll och tidstyp som patienten behöver, så att ingen behöver veta vem som har vilka tider.',
    anmarkning: 'Bara personal är resurser. Lokaler, utrustning och transporter kan inte bokas, och scheman ändras bara i seeden.',
  },
  {
    id: '3.4.1.3', kategori: 'system', egna: ['D1', 'M4'], avsedd: 'delvis',
    tester: [
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
      `${R}larm: mottagningskvittens saknas efter 2 timmar`,
      `${M}NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen`,
      T.startsida, T.egenbokning,
    ],
    losning: 'Inkorgen samlar bevakningar för enheten och den inloggade: remisslarm, okvitterade svar och NLL-avvikelser. Vårdadministratörens startsida visar bevakningar som har löpt ut, med en åtgärd per rad, och väntelistans patienter som närmar sig gränsen.',
    expert: 'Systemet skapar bevakningarna självt utifrån det som händer, till exempel när en patient avbokar i Min journal, så ingen behöver lägga upp en påminnelse för hand.',
    anmarkning: 'En egen bevakning kan inte läggas upp i gränssnittet, bara i seeden och av systemet.',
  },
  {
    id: '3.4.1.4', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [T.forslag, T.boka, T.skyddad, flode('boka-remiss'), T.abAnteckning, T.abDiagnos, flode('aterbesok')],
    losning: 'Planeringen använder det som redan finns: remissen, patientens tidigare vårdgivare, andra bokningar och väntelistans gräns, och för läkarens återbesök anteckningens planering, diagnosen och den senaste kontakten. Skyddad identitet maskeras i alla listor.',
    expert: 'Förslagen räknas ur befintlig information, så att vårdadministratören inte skriver in något som systemet redan vet.',
    anmarkning: 'Flera aktiviteter i följd, till exempel provtagning före läkarbesök, kan inte bokas i ett steg.',
  },
  {
    id: '3.4.1.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.tidbok, T.forslag],
    losning: 'Tidboken visar per vårdgivare och dag hur många tider som är bokade, och förslagen tar hänsyn till vilka tider som är lediga.',
    expert: 'Systemet räknar beläggningen och väljer bland de lediga tiderna själv.',
    anmarkning: 'Lokaler, utrustning, transporter och produktionsplanering över längre tid saknas.',
  },
  {
    id: '3.4.1.6', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.tidbok, T.startsida, T.egenbokning],
    losning: 'Planeringen visas för enheten (dagens arbete och tidboken per mottagning), per vårdgivare (schemat i tidboken) och per patient (bokade tider i översikten och i Min journal). Tidboken kan visas utan patientuppgifter.',
    expert: 'Varje roll ser det den behöver: vårdadministratören dagens arbete i ordning och patienten sina egna tider. Den avidentifierade vyn visar bara att en tid är upptagen.',
    anmarkning: 'Vyerna kan inte anpassas av användaren.',
  },
  {
    id: '3.4.1.7', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.vantelista, T.remissVantelista, T.startsida],
    losning: 'Väntelistan per vårdenhet visar prioritet, väntetid och dagar kvar till gränsen, med urval för dem nära gränsen, remisser och hög prioritet. Omprioritering är ett klick och kräver en orsak, som sparas i postens historik.',
    expert: 'Systemet räknar dagarna mot vårdgarantin och det medicinska måldatumet och lyfter den som riskerar att passera gränsen. Vid patientvald väntan räknas inte vårdgarantin.',
    anmarkning: 'Uppföljning på aggregerad nivå, till exempel statistik över väntetider, saknas. Vårdgarantin är en demoregel.',
  },
  {
    id: '3.4.1.8', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [
      `${A}arbetslista maskerar skyddad identitet`,
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
      `${GK}Öppna patient från arbetslistan inom budget`,
      T.startsida, flode('checka-in'),
    ],
    losning: 'Arbetslistan visar patienter med vårdrelation på enheten, och inkorgen visar bevakningar. Vårdadministratörens startsida är en aktivitetslista för dagen: patienter i dag, remisser som väntar på tid, väntelistan, kallelser som behöver gå ut och bevakningar som har löpt ut.',
    expert: 'Listorna räknas fram ur vårdrelationen och dagens bokningar, och varje rad har en enda nästa åtgärd som systemet har valt.',
    anmarkning: 'Notifieringar utanför systemet och fritt valda tidsperioder saknas.',
  },
];

// Runda 6, r4: posterna som byggdes i planering och tidbok, del 2, och remiss, del 2, ersätts ur sussa/planering-r4.js.
export default medR4(AVSNITT);
