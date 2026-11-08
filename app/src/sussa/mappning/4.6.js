// Sussa 4.6 Anestesi och intensivvård: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r2: intensivvården (iva.js och medicinteknik.js, app/test/iva.test.js och app/test/medicinteknik.test.js).
// Tidigare byggt: vätskebalansen (administrering.js och lakemedelsvyer.js, app/test/lakemedelsstod.test.js).
import { T } from '../medicinteknik-r9.js';

const VB = 'Vätskebalans > ';
const DEMO = 'Hjärtintensiven på Kardiologiska kliniken är demons intensivvårdsavdelning med åtta platser. Reglerna och protokollen är demoregler, inte kliniskt beslutsstöd, och utrustningen är simulerad. Specialområdet sköts upp i Tilläggsavtal 3.';

export default [
  {
    id: '4.6.1.1', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.oversikt, T.overvakning, T.analys, T.anestesi, T.infusion, T.vatska, T.uppfoljning],
    losning: 'Intensivvården har en egen sida med översikt och övervakning, analys mot fördefinierade parametrar, anestesibedömning, kontinuerliga infusioner med titrering, timvis vätskebalans och uppföljning, byggda på mätvärdena, utrustningen, läkemedlen och vätskebalansen som redan finns.',
    expert: 'Systemet räknar själv dos per kilo och timme, balans per timme, larm och förslag ur journalen, så att intensivvårdens personal arbetar med samma uppgifter som resten av vården utan att föra över något.',
    anmarkning: `${DEMO} Operationsplanering, anestesijournal under ingreppet, uppvakningsavdelning och scoring som SAPS 3 saknas.`,
  },
  {
    id: '4.6.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.oversikt, T.overvakning, T.simulerad, T.referens, T.kbIva],
    losning: 'Översikten visar alla patienter på intensivvårdsavdelningen med senaste värdena, NEWS2, larm och förslag, kopplad utrustning, infusioner och vätskebalans, med de mest akuta först. Övervakningen per patient har täta värden från den kopplade monitorn (var femte minut) med kurvor över de senaste timmarna där monitorns värden är märkta.',
    expert: 'Systemet sorterar själv patienterna efter larm och säger när monitorns värden väntar på godkännande, så att den som går in på avdelningen ser vem som behöver hjälp först.',
    anmarkning: `${DEMO} Realtidsvisning med vågformer och larm direkt från monitorn finns inte. Vyn uppdateras när den öppnas.`,
  },
  {
    id: '4.6.1.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.analys, T.parametrar, T.vatska, T.infusion],
    losning: 'Fördefinierade parametrar med gränser och trender (lågt medelartärtryck, fall i medelartärtrycket, låg syremättnad, puls, andningsfrekvens, feber, oliguri, vätskebalans och titreringsmål) prövas av systemet mot de senaste godkända värdena och omsätts i larm, varningar och förslag med vad som ska göras. Gränserna för medelartärtryck, syremättnad, trendfönster och oliguri är parametrar som systemförvaltaren ändrar med fyra ögon.',
    expert: 'Systemet prövar reglerna själv vid varje visning och säger vad som ska göras, och räknar aldrig med ett värde som inte är godkänt utan säger i stället till att det bör granskas.',
    anmarkning: `${DEMO} Egna regler per patient och regler som användaren skriver själv finns inte.`,
  },
  {
    id: '4.6.1.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.anestesi, T.anestesiSparr],
    losning: 'Läkaren gör en strukturerad anestesibedömning med ingrepp, planerad tid, ASA-klass, anestesiform och luftväg. Systemet hämtar aktuella läkemedel med observationer (antikoagulantia, diabetes, betablockerare), överkänslighet, diagnoser, vikt, BMI och tidigare anestesibedömningar, föreslår ASA-klass ur diagnoserna och räknar fastetiderna ur den planerade tiden. Bedömningen sparas med underlaget och ändras aldrig.',
    expert: 'Systemet fyller i allt som redan står i journalen och varnar för risker som svår luftväg, så att läkaren bara bedömer det som kräver en undersökning.',
    anmarkning: `${DEMO} Operationsanmälan finns inte (Sussa 4.5.1.2), så bedömningen knyts till vårdkontakten och inte till en anmälan. Riskbedömning med fler skalor och samtycke till anestesi saknas.`,
  },
  {
    id: '4.6.1.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.infusion, T.infusionVikt, T.gemensam, T.pumpDos],
    losning: 'Läkaren ordinerar en kontinuerlig infusion i sprutpump ur ett protokoll med dos per kilo och timme, koncentration, intervall, bolusdos och högsta dygnsdos. Systemet räknar hastigheten i ml/h på den godkända vikten, föreslår titrering efter mätvärden (smärta och, för säkerheten, andningsfrekvens) inom det ordinerade intervallet och visar infusionerna, bolusarna och vätskorna i en gemensam vy. Sjuksköterskan titrerar med ett klick, och pumpens doser registreras och kontrolleras.',
    expert: 'Systemet räknar om dos per kilo till ml per timme, föreslår nästa dos ur det senaste värdet och stoppar en dos utanför det ordinerade intervallet med en förklaring.',
    anmarkning: `${DEMO} Det finns ett protokoll, morfin. Vasoaktiva läkemedel och sedering saknas eftersom de inte finns i demons läkemedelskatalog.`,
  },
  {
    id: '4.6.1.6', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.vatska, T.gemensam, `${VB}vätskebalansen räknar in administrerad volym av sig själv`, 'Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen', 'Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras'],
    losning: 'Vätskebalansen räknas timvis och kumulativt det senaste dygnet, med urin och dränage per timme och urin i ml per kilo och timme på den godkända vikten. Systemet varnar för oliguri när urinen har varit under 0,5 ml/kg/h i flera timmar. Volymen från infusioner och pumpar räknas in av sig själv.',
    expert: 'Systemet räknar balansen per timme och urinen per kilo själv och varnar för oliguri, så ingen behöver summera listor eller räkna med vikten.',
    anmarkning: `${DEMO} Perspiratio och vätskeförlust via respirator räknas inte.`,
  },
  {
    id: '4.6.1.7', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.uppfoljning],
    losning: 'Uppföljningen per intensivvårdsavdelning visar vårddygn, vårdtillfällen, beläggning, medelvårdtid, vårdtyngd (andel vårddygn med kopplad monitor och med kontinuerlig infusion) och kvalitetsindikatorer (andel monitorvärden som godkänns inom en timme, vårddygn med vätskebalans och återinskrivning inom 48 timmar), utan personuppgifter. Vårdenhetens personal ser sin avdelning och uppföljningsrollen alla.',
    expert: 'Systemet räknar uppföljningen ur det som redan dokumenteras, så ingen behöver föra statistik för hand.',
    anmarkning: `${DEMO} Vårdtyngd enligt NEMS eller NAS och rapportering till Svenska Intensivvårdsregistret saknas.`,
  },
];
