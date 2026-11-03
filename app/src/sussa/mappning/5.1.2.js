// Sussa 5.1.2 Masterdata: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, KV } = TEST;

export default [
  {
    id: '5.1.2.1', kategori: 'system', egna: ['D9', 'L9'], avsedd: 'delvis',
    tester: [
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`,
      `${KV}varje läkemedel i katalogen har en ATC-kod ur WHO:s register`,
    ],
    losning: 'Läkemedelskatalogen och kodverken bygger på externt förvaltade källor: NPL från Läkemedelsverket, ICD-10-SE från Socialstyrelsen och ATC från WHO.',
    expert: 'Systemet visar läkemedel och diagnoser med namn och kod ur källorna, så användaren väljer i en lista i stället för att skriva koder.',
    anmarkning: 'Källorna är kontrollerade en gång och uppdateras inte automatiskt. HSA, PU-tjänsten och listning hämtas inte.',
  },
  {
    id: '5.1.2.2', kategori: 'system', egna: ['L9'], avsedd: 'delvis',
    tester: [
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${B}vårdrelation: listning och remiss till enheten ger vårdrelation`,
    ],
    losning: 'Läkemedelsinformation från NPL, organisationsstruktur och personal i seeden, och listning som ger vårdrelation.',
    expert: 'Systemet räknar fram vårdrelationen ur listningen, så ingen behöver lägga upp åtkomst för listade patienter.',
    anmarkning: 'Organisation, personal, scheman, befolkning och listning ligger i seeden och hämtas inte från masterdatakällor.',
  },
  {
    id: '5.1.2.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [
      'Masterdata > organisation och personal i sandlådan kommer från filadaptern',
      'Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats',
      'Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt',
      'Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del',
    ],
    losning: 'Organisation, personal och befolkning hämtas från utbytbara källor (adaptrar) med ett gemensamt kontrakt. Demon har en filadapter som läser seeden, och sandlådan byggs ur den. En synkronisering validerar källan och räknar ut nya, ändrade och borttagna poster utan att radera något.',
    expert: 'Systemet validerar varje källa innan något ändras och räknar själv ut vad som har ändrats. Personal som saknas blir inaktiv i stället för att raderas, och en skyddad identitet från folkbokföringen gäller direkt.',
    anmarkning: 'Inga riktiga anslutningar: HSA-katalogen, personalsystemet och folkbokföringen via PU-tjänsten finns inte. Synkroniseringen körs inte efter ett schema, och vilka uppgifter som räknas som masterdata går inte att ändra utan kod.',
  },
];
