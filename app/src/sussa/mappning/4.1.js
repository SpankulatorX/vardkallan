// Sussa 4.1 Tillväxt: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r6: tillväxt och barnhälsovård (tillvaxt.js, bhv-program.js, bhv.js och bhvq.js).
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const { GK } = TEST;
const TV = 'Tillväxt > ';
const PR = 'Barnhälsovårdens program > ';
const HM = 'Mätningar hemma och Min journal > ';
const RQ = 'Rapportering till Svenska barnhälsovårdsregistret > ';
const KF = 'Kodverk och FHIR för tillväxt > ';
const AP = 'API för barnhälsovården > ';
const KB = klickbudgetTest(FLODEN.find(f => f.id === 'tillvaxt-bhv'));

export default [
  {
    id: '4.1.1.1', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [
      `${TV}kurvorna, analysen och larmet för barnet byggs av det användaren får se`,
      `${TV}mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort`,
      `${AP}läkaren på barnavårdscentralen ser tillväxten och registrerar vikt och längd`,
      `${AP}personal utan vårdrelation nekas, och sjuksköterskan på kardiologen har ingen barnhälsovård`,
      KB,
    ],
    losning: 'Fliken Tillväxt i journalen för barn och ungdomar har registrering av vikt, längd och huvudomfång vid besöket, kurvor för vikt, längd, huvudomfång och BMI efter ålder med referenslinjer, larm vid avvikande tillväxt, förändringen under en vald period, födelseuppgifter med målängd och barnhälsovårdens program med besök och vaccinationer.',
    expert: 'Systemet räknar ålder, SD, percentil och BMI, larmar själv när kurvor korsas och föreslår nästa steg och nästa besök, så sjuksköterskan skriver bara mätvärdena.',
    anmarkning: 'Larmen och tidsfönstren är demoregler, inte kliniskt beslutsstöd.',
  },
  {
    id: '4.1.1.2', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [`${TV}z-värden och referenslinjer räknas enligt WHO:s tabeller`, `${TV}korrigerad ålder för för tidigt födda till två år, och målängd ur föräldrarnas längd`, 'Licens för tillväxtreferensen > WHO-tabellen har en egen licensfil och omfattas inte av EUPL'],
    losning: 'Kurvorna bygger på WHO:s tillväxtstandard 0 till 5 år (L, M och S per månad för vikt, längd, huvudomfång och BMI efter ålder, pojkar och flickor). För ett barn som är fött före vecka 37 räknas korrigerad ålder till två år.',
    expert: 'Systemet väljer referens efter barnets kön och ålder och korrigerar för för tidig födsel själv, så ingen behöver välja kurvblad.',
    anmarkning: 'De svenska referenserna som barnhälsovården använder finns inte utgivna under en fri licens och används inte (docs/kodkontroll.md). Prematurkurvor, kurvor för syndrom och WHO:s referens efter fem år saknas. WHO:s tabell används under CC BY-NC-SA 3.0 IGO.',
  },
  {
    id: '4.1.1.3', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [`${TV}z-värden och referenslinjer räknas enligt WHO:s tabeller`],
    losning: 'En referens finns: WHO:s tillväxtstandard 0 till 5 år, med kurvor för vikt, längd, huvudomfång och BMI efter ålder och linjerna -2, -1, 0, +1 och +2 SD. Referensen ligger i en egen tabell med källa och licens, så att en annan referens kan läggas till.',
    expert: 'Källan, licensen och att kurvan för huvudomfång följer WHO står under kurvorna, så att den som läser vet vad jämförelsen bygger på.',
    anmarkning: 'Bara en referens. Svenska referenser, prematurkurvor och kurvor för syndrom saknas, och referensen kan inte bytas i gränssnittet.',
  },
  {
    id: '4.1.1.4', kategori: 'system', egna: ['D9', 'D6'], avsedd: 'delvis',
    tester: [
      `${TV}mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort`,
      `${TV}födelseuppgifter, föräldrarnas längd och händelser kontrolleras, och en ny uppgift ersätter den förra`,
      `${KF}huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns`,
      `${RQ}systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren`,
      `${HM}vårdnadshavaren registrerar en mätning som väntar tills barnavårdscentralen bekräftar den`,
      `${PR}sjuksköterskor gör barnhälsovårdens flöde med ett uppdrag på barnavårdscentralen, och utan uppdrag nekas det`,
      KB,
    ],
    losning: 'Vikt, längd och huvudomfång registreras i ett formulär vid besöket, i en transaktion med samma tid och vårdkontakt. Födelsevikt, födelselängd, huvudomfång vid födelsen, graviditetslängd och föräldrarnas längd registreras som egna uppgifter. Alla observationer i K11 utom sitthöjd har registrets Snomed CT-kod. Vårdnadshavaren kan skicka en mätning från hemmet som barnavårdscentralen bekräftar.',
    expert: 'Systemet sätter tid, kod, enhet och vårdkontakt, prövar värdet mot rimliga gränser och säger på vanlig svenska vad som är fel, och knyter mätningen till rätt besök i programmet.',
    anmarkning: 'Sitthöjd finns inte. Koderna i K11 är inte kontrollerade mot den gällande utgåvan av Snomed CT.',
  },
  {
    id: '4.1.1.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [`${TV}kurvorna, analysen och larmet för barnet byggs av det användaren får se`, `${TV}larmar när kurvor korsas, när huvudomfånget växer för snabbt, utanför två SD och för nyfödda`],
    losning: 'För en vald period räknar systemet förändringen för vikt, längd, huvudomfång och BMI: skillnaden, skillnaden per månad och hur SD-värdet har ändrats. Utan period räknas hela tiden sedan födelsen.',
    expert: 'Beräkningarna görs automatiskt och skrivs som text, så ingen behöver läsa av kurvan eller räkna själv.',
    anmarkning: 'Larmreglerna är demoregler.',
  },
  {
    id: '4.1.1.6', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [`${TV}kurvorna, analysen och larmet för barnet byggs av det användaren får se`, `${HM}Min journal visar kurvorna och vaccinationerna utan larm, id eller personal`, KB],
    losning: 'Kurvorna ritas som SVG med referenslinjerna -2, -1, 0, +1 och +2 SD och kan visas för barnets ålder, första året, två år eller fem år. Varje kurva har en tabell med datum, ålder, värde, SD, percentil och källa. Punkternas form visar källan: vården, en bekräftad mätning hemma, en mätning hemma som väntar och födelsen. Särskilda händelser visas på kurvan. Vårdnadshavaren ser samma kurvor i Min journal.',
    expert: 'Systemet väljer ålderspannet efter barnets ålder och visar SD och percentil vid varje värde, så att avvikelsen syns utan att någon räknar.',
    anmarkning: 'Pubertetsdata och prematurkurvor saknas, och vilka mått som visas går inte att välja.',
  },
  {
    id: '4.1.1.7', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${RQ}systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren`,
      `${RQ}ett orimligt värde hålls kvar med en förklaring och en länk, och undantagen räknas`,
      'Licens för tillväxtreferensen > barn med skyddade personuppgifter undantas från registret enligt en konstant',
      `${AP}FHIR: vaccinationerna är Immunization med ATC och dos, med samma behörighet och loggning, och invånaren ser dem utan personal`,
      `${KF}huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns`,
    ],
    losning: 'Export till Svenska barnhälsovårdsregistret enligt K11 (tillväxt, besök och tuberkulosrisk och BCG), med kontroll före utskicket. Mätvärdena finns i FHIR som Observation (huvudomfång med vitalparameterprofilen) och kan läsas in genom FHIR-API:t, och vaccinationerna finns som Immunization.',
    expert: 'Systemet sammanställer det som är nytt sedan förra utskicket, håller kvar barn med fel och förklarar felet med en länk till det som ska rättas.',
    anmarkning: 'Mottagaren är simulerad. Import från ett annat journalsystem eller en fil är inte byggd, och tjänstekontrakten GetObservation och GetActivities är inte anslutna.',
  },
  {
    id: '4.1.1.8', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${RQ}en annan vårdenhet ser inget och en roll utan behörighet nekas`],
    losning: 'Uppföljningen på barnavårdscentralen visar för varje besök i programmet hur många barn som har passerat åldern, hur många besök som gjordes i tid och med alla mått, och vaccinationstäckningen per dos. Den visar antal, aldrig vilka barn det gäller.',
    expert: 'Systemet räknar indikatorerna själv ur det som redan är registrerat, utan att någon för statistik.',
    anmarkning: 'Indikatorerna är fasta och kan inte väljas, och det finns ingen uppföljning för regionen.',
  },
];
