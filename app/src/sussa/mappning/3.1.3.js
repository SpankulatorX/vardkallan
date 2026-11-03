// Sussa 3.1.3 Informationsinmatning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { J, KV, FS, MJ, GK } = TEST;

export default [
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
    losning: 'Mätvärden som blodtryck, puls, temperatur och saturation registreras manuellt och visas per typ.',
    expert: 'Systemet kontrollerar värdet mot rimliga gränser och sätter enhet och kod själv, så användaren skriver bara siffrorna.',
    anmarkning: 'Registreringen i efterhand är begränsad till de senaste 30 dagarna.',
  },
  {
    id: '3.1.3.5', kategori: 'system', egna: ['L1'], avsedd: 'delvis',
    tester: [
      `${J}mallar finns för alla anteckningstyper`,
      `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
      `${J}mätvärden valideras och registreras`,
    ],
    losning: 'Strukturerade sökord i mallar, fritext under varje sökord och strukturerade mätvärden.',
    expert: 'Mallen ger sökorden för anteckningstypen, så användaren behöver inte komma ihåg strukturen för en viss anteckning.',
    anmarkning: 'Skalor och poängmodeller, bilder med markeringar och beräkningsunderlag saknas.',
  },
  { id: '3.1.3.6', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Textfri inmatning, till exempel skanning av streckkoder, är inte byggd.' },
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
    ],
    losning: 'Mätvärden och provsvar registreras och visas per typ, med NPU för labb, LOINC för vitalparametrar och UCUM-enheter, och lämnas ut i FHIR.',
    expert: 'Systemet kodar varje mätvärde själv och visar det för patienten efter vårdgivarens regler, så ingen behöver välja kod eller avgöra när ett provsvar får visas.',
    anmarkning: 'Kurvor över tid och larm vid avvikande värden saknas.',
  },
  { id: '3.1.3.10', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Rättstavning och grammatikkontroll med medicinska termer är inte byggd.' },
];
