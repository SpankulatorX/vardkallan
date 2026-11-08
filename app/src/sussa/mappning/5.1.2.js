// Sussa 5.1.2 Masterdata: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 9, r4: fler delar av masterdatan, schemat, parametrarna och tillgängligheten.
import { T } from '../runda9-r4.js';

const { B, KV } = TEST;

const GRUND = [
  'Masterdata > organisation och personal i sandlådan kommer från filadaptern',
  'Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats',
  'Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt',
  'Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del',
];

export default [
  {
    id: '5.1.2.1', kategori: 'system', egna: ['D9', 'L9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`,
      `${KV}varje läkemedel i katalogen har en ATC-kod ur WHO:s register`,
      ...GRUND, T.mdKodverk, T.mdLakemedel, T.mdSchema, T.mdTillganglig,
    ],
    losning: 'Masterdata som förvaltas externt läses från utbytbara källor med ett gemensamt kontrakt (masterdata.js): organisation, personal, befolkning, läkemedelskatalogen från NPL, kodverken från utgivarna, listning, arbetsscheman, prislistor, beställarregistret och tillgängligheten i förrådet. Källorna läses in efter ett schema, valideras och synkroniseras utan att något raderas. En ny utgåva av ett kodverk läggs fram för godkännande med jämförelsen färdig.',
    expert: 'Systemet läser in källorna själv, validerar dem innan något ändras och räknar ut vad som är nytt, ändrat och borta. Användaren väljer läkemedel och diagnoser ur listor som kommer från källan och behöver aldrig skriva en kod.',
    anmarkning: 'Demon har bara filadaptern, som läser seeden. HSA, PU-tjänsten, NPL och de andra källorna är inte anslutna, och adaptrarna mot dem är inte byggda.',
  },
  {
    id: '5.1.2.2', kategori: 'system', egna: ['L9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${B}vårdrelation: listning och remiss till enheten ger vårdrelation`,
      ...GRUND, T.mdKodverk, T.mdLakemedel, T.mdListning, T.mdScheman, T.mdApi,
    ],
    losning: 'Alla exempel i kravet är delar av masterdatan med samma kontrakt, validering och synkronisering: organisationsstruktur, personaluppgifter, arbetsscheman, läkemedelsinformation, befolkningsinformation, patientens listning, tillgänglighet i förrådet, prislistor, beställarregistret och kodverk, internationella, nationella och lokala. Varje del har en nyckel (HSA-id, personnummer, NPL-id, kodverk och version, enhet och version) som synkroniseringen jämför på, och sidan Kodverk och masterdata visar källan, antalet och den senaste inläsningen per del.',
    expert: 'Systemet räknar fram vårdrelationen ur listningen och flyttar den när patienten listar om sig, gör personal och beställare som saknas i källan inaktiva och ger en ändrad prislista en ny version i stället för att ändra den. Ingen behöver lägga upp något för hand.',
    anmarkning: 'Källorna är simulerade med filadaptern. Tillgängligheten i förrådet och beställarregistret visas bara i masterdatan och används ännu inte vid utlämning av hjälpmedel eller beställning.',
  },
  {
    id: '5.1.2.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [...GRUND, T.mdSchema, T.mdParameter, T.mdTillganglig, T.mdApi],
    losning: 'Masterdatan hämtas från utbytbara källor (adaptrar) med ett gemensamt kontrakt, och resten av systemet beror aldrig på vilken källa som används. Synkroniseringen körs efter ett schema vars intervall systemförvaltningen ändrar med fyra ögon, och vilka delar som räknas som masterdata är parametrar: en del som förvaltas i Vårdkällan läses inte in. Svarar en källa inte ändras ingenting, de senast giltiga uppgifterna används, avvikelsen visas och systemet försöker igen efter en timme.',
    expert: 'Systemet validerar varje källa innan något ändras och räknar själv ut vad som har ändrats. Personal som saknas blir inaktiv i stället för att raderas, en skyddad identitet från folkbokföringen gäller direkt, och när en källa inte svarar fortsätter allt att fungera med de senast giltiga uppgifterna.',
    anmarkning: 'Inga riktiga anslutningar: HSA-katalogen, personalsystemet och folkbokföringen via PU-tjänsten finns inte. Schemat körs när sandlådan används, inte av en fristående tjänst, och ett nytt format på en källa kräver en ny adapter i koden.',
  },
];
