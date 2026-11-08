// Sussa 3.2.2 Vårdplaner och vårdprocesser: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 10, r5: processtöd, kunskapsstöd, vårdprocesser, högflödesmottagning, läkemedel och vaccination (sussa/runda10-r5.js).
import { medR10r5 } from '../runda10-r5.js';
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const { A, S } = TEST;
const VP = 'Vårdplan > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));

const POSTERNA = [
  {
    id: '3.2.2.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${VP}systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick`,
      `${VP}en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas`,
      `${VP}inre sekretess, spärr och nödåtkomst gäller vårdplanerna`,
      flode('vardplan'),
    ],
    losning: 'Standardiserade vårdplaner som mallar (hjärtsvikt, förebyggande av trycksår, diabetes, förebyggande av fall och vårdplan vid psykiatrisk tvångsvård) och individuella planer med mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, under fliken Planer och i översikten.',
    expert: 'Systemet föreslår standardplanen ur diagnosen och sammanhanget och fyller i mål, åtgärder, ansvarig och uppföljningsdatum, så läkaren eller sjuksköterskan sätter upp planen med två klick.',
    anmarkning: 'Mallarna och när de föreslås är demoregler, inte granskade av vården. Mallarna är fasta i koden (se D11).',
  },
  {
    id: '3.2.2.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${VP}systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick`,
      `${VP}en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas`,
      `${VP}åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena`,
      `${VP}uppehåll, återupptagning, uppföljning och avslutning sparas i historiken, som inte kan ändras`,
      `${VP}avvikelser från planen visas i översikten och uppföljningen bevakas i inkorgen`,
      `${VP}inre sekretess, spärr och nödåtkomst gäller vårdplanerna`,
      `${VP}tvångsvården föreslår vårdplanen enligt 16 § och uppgiften försvinner när planen finns`,
      `${VP}FHIR: vårdplanen är en CarePlan med samma behörighet och loggning, och invånaren får den inte`,
    ],
    losning: 'Planen anpassas efter patienten (mål och åtgärder läggs till och tas bort), kan göra uppehåll och återupptas, följs upp mål för mål och avslutas med utvärdering. Avvikelser (passerad uppföljning, åtgärd som inte är gjord, mål som inte nåddes) syns i planen, översikten och inkorgen. Historiken ändras aldrig. I FHIR är planen en CarePlan.',
    expert: 'Systemet bevakar uppföljningen, ser själv när en åtgärd som gäller ett mätvärde är gjord och visar avvikelserna, så ingen behöver leta efter vad som har missats.',
    anmarkning: 'Standardplaner kan inte importeras i demon. Uppföljningen av utfall gäller målen i en plan, inte statistik över många patienter.',
  },
  {
    id: '3.2.2.3', kategori: 'system', egna: ['D2', 'M5'], avsedd: 'delvis',
    tester: [
      `${A}migreringsavstämningen visar avvikelsen`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
    ],
    losning: 'Migrerad historik från VAS och Cosmic visas i samma kronologi som ny dokumentation, med källan utskriven och en avstämning av migreringen.',
    expert: 'Systemet lägger gammal och ny dokumentation i samma tidslinje och visar själv var en avvikelse finns, så användaren behöver inte leta i ett annat system.',
    anmarkning: 'Information som skapas utanför Vårdkällan, hos andra vårdgivare eller i kringsystem, hämtas inte. Migreringen gäller seedens poster.',
  },
];
export default medR10r5(POSTERNA);
