// Sussa 3.5.2 Process för läkemedelshantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, A, M, S, KV, GK } = TEST;

export default [
  {
    id: '3.5.2.1', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${B}gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade`,
      `${M}utsättning kräver orsak och inget raderas`,
      `${M}sjuksköterska kan inte ordinera`,
    ],
    losning: 'En gemensam läkemedelsfunktion för hela patienten, där ordination och utsättning görs på samma lista.',
    expert: 'Systemet visar alla enheters ordinationer i en lista och låter bara den som får ordinera göra det, så ingen behöver veta var en ordination gjordes.',
    anmarkning: 'Iordningsställande, administrering och vidimering ingår inte, så processen hålls inte samman hela vägen.',
  },
  { id: '3.5.2.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Registrering i efterhand av aktiviteter i läkemedelsprocessen är inte byggd. Mätvärden kan registreras i efterhand inom 30 dagar.' },
  { id: '3.5.2.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Vätskebalans är inte byggd.' },
  {
    id: '3.5.2.4', kategori: 'system', egna: ['L7', 'D9'], avsedd: 'delvis',
    tester: [
      `${KV}varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod`,
      `${KV}ingen ordination i seeden börjar före produktens godkännande i NPL`,
    ],
    losning: 'Godkända läkemedel ur en katalog med 50 produkter, kontrollerade mot Läkemedelsverkets NPL.',
    expert: 'Systemet låter förskrivaren välja produkt ur katalogen med rätt namn, styrka och form, så ingen behöver skriva in läkemedlet.',
    anmarkning: 'Icke godkända läkemedel (extempore och licens), egendefinierade läkemedel, blodprodukter och nutrition saknas.',
  },
  { id: '3.5.2.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Administrering under permission är inte byggd.' },
  {
    id: '3.5.2.6', kategori: 'system', egna: ['L7'], avsedd: 'uppfyllt_demo',
    tester: [
      `${M}ordinationsorsak är obligatorisk`,
      `${M}databasen vägrar ordination utan orsak (CHECK)`,
      `${S}alla ordinationer har orsak och uppföljningsdatum`,
      `${GK}Ordinera ett läkemedel utan varning inom budget`,
    ],
    losning: 'Ordinationsorsak är obligatorisk vid ordination och kan inte saknas ens i databasen.',
    expert: 'Systemet säger på vanlig svenska vad som saknas innan ordinationen kan sparas och föreslår uppföljningsdatum, så förskrivaren inte behöver kunna NLL:s krav.',
    anmarkning: 'Orsaken är fritext. Strukturerad ordinationsorsak med kod saknas.',
  },
  { id: '3.5.2.7', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Ordination kopplad till en planerad vårdhändelse är inte byggd.' },
  { id: '3.5.2.8', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Utsättning kräver orsak, men varning vid utsättning av läkemedel med särskilda observationer är inte byggd.' },
  { id: '3.5.2.9', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Vidimering av samlade pågående ordinationer är inte byggd.' },
  {
    id: '3.5.2.10', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}utsättning kräver orsak och inget raderas`,
      `${A}helflöde: ordination med varning, kvittens och NLL-timeout med avstämning`,
      `${GK}Sätta ut ett läkemedel inom budget`,
    ],
    losning: 'Ordination, varning, kvittens, överföring till NLL och utsättning, med historik där utsatta ordinationer finns kvar med orsak.',
    expert: 'Systemet raderar aldrig en ordination utan sparar utsättningen med orsak och tid, så historiken finns kvar utan att någon behöver spara den.',
    anmarkning: 'Iordningsställande, administrering och utvärdering saknas.',
  },
  { id: '3.5.2.11', kategori: 'nationell', egna: ['L7'], tester: [], avsedd: 'planerat',
    anmarkning: 'Förskrivning enligt NEF med justering och makulering av e-recept är inte byggd. Överföringen till NLL är simulerad.' },
  {
    id: '3.5.2.12', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}ordinationsorsak är obligatorisk`,
      `${M}uppföljningsdatum är obligatoriskt`,
      `${M}sjuksköterska kan inte ordinera`,
      `${GK}Ordinera ett läkemedel utan varning inom budget`,
    ],
    losning: 'Ordination av stående läkemedel, vid behov och tillfälliga, med dos, orsak, uppföljningsdatum och start och slut.',
    expert: 'Systemet föreslår uppföljningsdatum och kontrollerar ordinationen mot journalen, så förskrivaren fyller bara i det som inte går att räkna ut.',
    anmarkning: 'Ordinationen skiljer inte på öppen och sluten vård, och administrering i slutenvården saknas.',
  },
  {
    id: '3.5.2.13', kategori: 'system', egna: ['L7'], avsedd: 'uppfyllt_demo',
    tester: [
      `${M}ordinationsorsak är obligatorisk`,
      `${M}databasen vägrar ordination utan orsak (CHECK)`,
      `${M}utsättning kräver orsak och inget raderas`,
      `${GK}Sätta ut ett läkemedel inom budget`,
    ],
    losning: 'Insättningsorsak och utsättningsorsak är obligatoriska och sparas med ordinationen.',
    expert: 'Systemet kräver orsaken i samma steg som åtgärden och förklarar varför, så ingen behöver komma ihåg att dokumentera den efteråt.',
    anmarkning: 'Orsakerna är fritext utan kodverk.',
  },
  { id: '3.5.2.14', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.5.2.15', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Ordination enligt generella direktiv är inte byggd.' },
  { id: '3.5.2.16', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Beställning av slutenvårdsdos kräver en extern dosleverantör och är inte byggd.' },
  { id: '3.5.2.17', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Iordningsställande är inte byggt.' },
  { id: '3.5.2.18', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Administrering och överlämnande är inte byggda.' },
  { id: '3.5.2.19', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Automatgenererad administrering från medicinteknisk utrustning är inte byggd.' },
  {
    id: '3.5.2.20', kategori: 'system', egna: ['L7'], avsedd: 'delvis',
    tester: [
      `${M}uppföljningsdatum är obligatoriskt`,
      `${S}alla ordinationer har orsak och uppföljningsdatum`,
    ],
    losning: 'Varje ordination har ett obligatoriskt uppföljningsdatum.',
    expert: 'Systemet kräver uppföljningsdatum och föreslår ett, så uppföljningen planeras när ordinationen görs.',
    anmarkning: 'Uppföljning av administrering och utvärdering av behandlingen saknas, och passerade uppföljningsdatum bevakas inte.',
  },
  { id: '3.5.2.21', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Vätskebalans är inte byggd.' },
];
