// Sussa 3.1.3 Informationsinmatning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';
// Runda 8, r5: tilläggen för tobaksvanor, epikrisen, mätvärdena, övningarna och parametrarna (sussa/runda8-r5.js).
import { medR8r5 } from '../runda8-r5.js';
// Runda 10, r3: formulären, kroppsbilden, röstinmatningen och rättstavningen (sussa/runda10-r3.js).
import { medR10r3 } from '../runda10-r3.js';

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
  { id: '3.1.3.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Registrering av in- och utfarter, till exempel katetrar och dränage, är inte byggd.' },
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
  { id: '3.1.3.8', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'In- och utfarter är inte byggda.' },
  {
    id: '3.1.3.9', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
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
    ],
    losning: 'Mätvärden och provsvar registreras och visas per typ, med NPU för labb, LOINC för vitalparametrar och UCUM-enheter, och lämnas ut i FHIR. En kurva per mätvärde med referensintervall och värden utanför markerade, NEWS2 över tid, och en hel NEWS2-kontroll registreras i ett formulär. När NEWS2 eller ett enskilt värde kräver åtgärd larmar systemet i inkorgen för sjuksköterskan och läkaren på vårdenheten.',
    expert: 'Systemet kodar varje mätvärde, räknar NEWS2, säger vad som ska göras och när nästa kontroll ska göras, larmar själv och väljer målintervallet för INR vid warfarin, så ingen behöver kunna tabellerna. NEWS2 räknas inte för barn eller under graviditet, eftersom skalan inte gäller där.',
    anmarkning: 'NEWS2 och referensintervallen är demoregler (D10). Syremättnad räknas bara med skala 1. Mätvärden från medicinteknisk utrustning, som ska kunna skiljas från manuellt inmatade, finns inte; NEWS2 och eGFR är märkta som räknade av systemet.',
  },
  { id: '3.1.3.10', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Rättstavning och grammatikkontroll med medicinska termer är inte byggd.' },
];
export default medR10r3(medR8r5(POSTERNA));
