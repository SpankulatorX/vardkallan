// Sussa 3.1.3 Informationsinmatning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';
// Runda 8, r5: tilläggen för tobaksvanor, epikrisen, mätvärdena, övningarna och parametrarna (sussa/runda8-r5.js).
import { medR8r5 } from '../runda8-r5.js';
// Runda 10, r3: formulären, kroppsbilden, röstinmatningen och rättstavningen (sussa/runda10-r3.js).
import { medR10r3 } from '../runda10-r3.js';
// Runda 10, r4: in- och utfarter, skala 2 och inmatningen av mätvärden (sussa/runda10-r4.js).
import { INFARTER, MATVARDEN } from '../runda10-r4.js';
// Runda 9, r2: värden från medicinteknisk utrustning (sussa/medicinteknik-r9.js).
import { T as MT } from '../medicinteknik-r9.js';

const { J, KV, FS, MJ, GK } = TEST;
// Runda 6, r1: skalor, NEWS2 och kurvor (skalor.js och vitalparametrar.js).
const SK = 'Skalor > ';
const MV = 'Mätvärden och NEWS2 > ';
const N2L = 'NEWS2-larm i inkorgen > ';

const POSTERNA = [
  {
    id: '3.1.3.1', kategori: 'system', egna: ['L1', 'D11'], avsedd: 'delvis',
    tester: [
      `${J}mallar finns för alla anteckningstyper`,
      `${J}utkast kan ändras av författaren`,
      `${J}sjuksköterska kan skriva omvårdnadsanteckning men inte läkaranteckning`,
    ],
    losning: 'Anteckningar skrivs i mallar med sökord per anteckningstyp. Omvårdnadsanteckningen följer VIPS.',
    expert: 'Systemet visar bara de mallar rollen får skriva och förväljer daganteckning och den egna enhetens vårdkontakt, så användaren skriver bara det som är nytt.',
    anmarkning: 'Beskrivande bilder, formulär med fält och skalor saknas, och mallarna är fasta i koden.',
  },
  { id: '3.1.3.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Röstinmatning och taligenkänning är inte byggda.' },
  // Runda 10, r4: in- och utfarter (infarter.js).
  { id: '3.1.3.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo', tester: INFARTER,
    losning: 'In- och utfarter registreras i en egen flik: perifer och central venkateter, PICC, kvarliggande och suprapubisk urinkateter, nasogastrisk sond och dränage, med typ, storlek, placering och tid, och följs med skötsel, byte och avveckling. Varje rad visar hur många dygn den har suttit, när nästa skötsel ska göras och vem som gjorde vad. Insättning, skötsel, byte och avveckling får KVÅ-kod och lämnas ut i FHIR som Procedure. Skötseln står i avdelningens planering, och händelserna står i översiktens tidslinje.',
    expert: 'Den som registrerar väljer typ och skriver var den sitter. Systemet förväljer storlek och tid, knyter registreringen till vårdkontakten, sätter KVÅ-koden, räknar nästa skötsel och lägger den i avdelningens planering, påminner om att pröva behovet och stoppar en andra urinkateter.',
    anmarkning: 'Intervallen för skötsel och påminnelserna är demoregler. Armband och förpackning kan skannas vid sängen, men riktiga läsare och förpackningar med GTIN är inte provade.' },
  {
    id: '3.1.3.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${J}mätvärden valideras och registreras`,
      `${GK}Registrera blodtryck inom budget`,
      `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`,
    ],
    losning: 'Mätvärden som blodtryck, puls, temperatur och syremättnad registreras manuellt och visas per typ.',
    expert: 'Systemet kontrollerar värdet mot rimliga gränser och sätter enhet och kod själv, så användaren skriver bara siffrorna.',
    anmarkning: 'Registreringen i efterhand är begränsad till de senaste 30 dagarna.',
  },
  {
    id: '3.1.3.5', kategori: 'system', egna: ['L1'], avsedd: 'delvis',
    tester: [
      `${J}mallar finns för alla anteckningstyper`,
      `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
      `${J}mätvärden valideras och registreras`,
      `${SK}NEWS2: varje parameter ger poäng enligt Chart 1 i RCP 2017`,
      `${SK}NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4`,
      `${SK}GCS: systemet räknar summan och skriver texten, och fel delvärden avvisas`,
      `${SK}NRS och ACVPU: systemet skriver texten`,
      `${MV}medvetandegrad, GCS, smärta och syrgas registreras, valideras och får text av systemet`,
    ],
    losning: 'Strukturerade sökord i mallar, fritext under varje sökord och strukturerade mätvärden. Skalor och poängmodeller: NEWS2 som systemet räknar ur vitalparametrarna, Glasgow Coma Scale med ögonöppning, verbalt och motoriskt svar, smärta med NRS 0 till 10 och medvetandegrad med ACVPU. Systemet räknar summan och skriver texten, till exempel GCS 13 (E3 V4 M6). Inga licensierade skalor.',
    expert: 'Mallen ger sökorden för anteckningstypen, och skalorna väljs i listor med vanlig text, så användaren behöver varken komma ihåg strukturen eller poängtabellerna. Systemet räknar poängen och skriver texten, och NEWS2 räknas utan att någon behöver räkna alls.',
    anmarkning: 'Bilder med markeringar och fler skalor (till exempel för trycksår och nutrition) saknas. Skalorna är demoregler och inte kliniskt beslutsstöd.',
  },
  // Runda 9, r7: streckkodsläsaren (skanning.js).
  { id: '3.1.3.6', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      'Skanning > systemet känner själv igen armband, personnummer, provetikett, iordningställd dos och läkemedelsförpackning',
      'Skanning > armbandet öppnar patienten, och i en öppen journal kontrollerar systemet att armbandet hör till patienten',
      'Skanning > provetiketten bockar av röret vid provtagningen, och en etikett för en annan patient stoppas',
      'Skanning > läkemedelsförpackningen kontrolleras mot patientens ordinationer, utgångsdatum och batch',
      'Skanning > skanningen ger aldrig mer än behörigheten: utan vårdrelation och utan rätt roll nekas den',
      'Skanning > armbandskoden är slumpmässig, och utan åtkomst till patienten är svaret detsamma som för en kod som inte finns',
      'Skanning > misslyckade uppslag har ett tak per session',
      'Skanning > seeden har armband för de inskrivna patienterna',
    ],
    losning: 'Ett fält för streckkodsläsare (tangentbordsläge) högst upp i Vårdkällan, som tar emot armband, personnummer, provetiketter, etiketter på iordningställda doser och läkemedelsförpackningar med GS1-koder (artikelnummer, utgångsdatum, batch och serienummer). Patientens armband skrivs ut från journalen med en slumpmässig kod som inte innehåller personuppgifter.',
    expert: 'Den som skannar väljer aldrig vad koden är. Systemet tolkar den, öppnar patienten, bockar av röret vid provtagningen, kontrollerar förpackningen mot ordinationen och utgångsdatumet, stoppar ett rör, en dos eller ett armband som hör till en annan patient än den som är öppen och sparar varje skanning med vem, var, när och resultatet.',
    anmarkning: 'I demon är förpackningens artikelnummer NPL-pack-id, eftersom katalogen saknar GTIN. Batch och utgångsdatum sparas med skanningen men inte på den givna dosen. Riktiga läsare är inte provade. Medicintekniska produkter har ingen egen kodtyp än.' },
  { id: '3.1.3.7', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Röstinmatning är inte byggd.' },
  { id: '3.1.3.8', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo', tester: INFARTER,
    losning: 'Omfattning: sju typer av in- och utfarter med storlek i typens enhet, placering, tid, vem som satte dem, artikel, batch och utgångsdatum från förpackningen, skötsel med anteckning, byte och avveckling med orsak. Registrering: typ och placering räcker, resten fyller systemet i. Identitet: armbandet kan skannas och kontrolleras mot den öppna patienten. Bedside skanning: armband och förpackning skannas vid sängen. Presentation: en flik med det som sitter nu och det som är avvecklat, med dygn, nästa skötsel och historik, och händelserna i tidslinjen. Utbud: typerna med storlekar och placeringar finns i en tabell. Enhetlighet: samma behörighet, spärr och loggning som omvårdnadsanteckningarna.',
    expert: 'Systemet följer varje in- och utfart själv: det räknar dygnen och nästa skötsel, lägger skötseln i avdelningens planering, markerar det som är försenat och påminner om att pröva om en urinkateter eller venkateter fortfarande behövs.',
    anmarkning: 'Utbudet av typer, storlekar och placeringar är en tabell i koden och ändras inte från gränssnittet. Intervallen för skötsel är demoregler.' },
  {
    id: '3.1.3.9', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${J}mätvärden valideras och registreras`,
      `${FS}vitalparametrar följer FHIR R4:s vitalparameterprofiler`,
      `${FS}labbvärden har NPU-kod och UCUM-enhet`,
      `${MJ}provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt`,
      `${MV}kurvorna har referensintervall och markerar värden utanför`,
      `${MV}NEWS2 räknas av systemet ur vitalparametrarna, med serie, vad som ska göras och nästa kontroll`,
      `${MV}en hel NEWS2-omgång registreras på en gång, med samma tid och vårdkontakt och åtgärden QD008`,
      `${MV}NEWS2-omgången sparas inte alls när ett värde saknas eller är fel`,
      `${MV}FHIR: NEWS2 som härledd Observation med samma behörighet som mätvärdena`,
      `${N2L}larmet syns för sjuksköterskan och läkaren på vårdenheten, med vad som ska göras, men inte för andra roller eller vårdenheter`,
      `${N2L}larmet bygger bara på den egna vårdenhetens värden: en spärrad vårdenhets värden larmar inte och nämns inte`,
      klickbudgetTest(FLODEN.find(f => f.id === 'news2')),
      // Runda 10, r4: skala 2, inmatningen, urvalet, värden från utrustning och vätskebalansen.
      ...MATVARDEN, MT.fhir, MT.referens, MT.egenSkild,
      'Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv',
      'Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri',
    ],
    losning: 'Mätvärden och provsvar registreras och visas per typ, med NPU för labb, LOINC för vitalparametrar och UCUM-enheter, och lämnas ut i FHIR. En kurva per mätvärde med referensintervall och värden utanför markerade, NEWS2 över tid, och en hel NEWS2-kontroll registreras i ett formulär. När NEWS2 eller ett enskilt värde kräver åtgärd larmar systemet i inkorgen för sjuksköterskan och läkaren på vårdenheten. Varje värde visar om det är manuellt inmatat, maskinellt från medicinteknisk utrustning eller laboratoriet, räknat av systemet, migrerat eller patientens egen mätning, och listan väljs ut efter mätvärde, inmatning och period. Syremättnaden räknas med skala 2 när läkaren har beslutat det. Vätskebalansen räknas ur in- och utflödena och den administrerade volymen.',
    expert: 'Systemet kodar varje mätvärde, avgör om det kom in manuellt eller maskinellt, räknar NEWS2, säger vad som ska göras och när nästa kontroll ska göras, larmar själv och väljer målintervallet för INR vid warfarin, så ingen behöver kunna tabellerna. NEWS2 räknas inte för barn eller under graviditet, och vid andningssvikt med hyperkapné föreslår systemet skala 2 för syremättnaden.',
    anmarkning: 'NEWS2 och referensintervallen är demoregler (D10). Den medicintekniska utrustningen är simulerad (Sussa 3.6.1).',
  },
  { id: '3.1.3.10', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Rättstavning och grammatikkontroll med medicinska termer är inte byggd.' },
];
export default medR10r3(medR8r5(POSTERNA));
