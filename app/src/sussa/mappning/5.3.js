// Sussa 5.3 Informationssäkerhet: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 9, r5: inloggning med biljett, skyddsbehov, signering, certifikat, e-arkiv, gallring och miljöer (sussa/runda9-r5.js).
import { medR9r5 } from '../runda9-r5.js';

const { B, A, L, J, M, F, MJ } = TEST;

export default medR9r5([
  { id: '5.3.1.1', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens dokumenterade informationssäkerhetsarbete för tjänsteleveransen. Det finns inget sådant för demon.' },
  {
    id: '5.3.1.2', kategori: 'system', egna: ['L3', 'D8'], avsedd: 'delvis',
    tester: [
      `${B}inre sekretess: andra enheters uppgifter kräver aktivt val`,
      `${B}inre sekretess: arbetsplats räknas till sin vårdenhet`,
      `${B}spärr: spärrmarkering syns men innehållet döljs`,
      `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`,
    ],
    losning: 'Varje uppgift hör till en vårdenhet och en kategori, och skyddas efter vårdenhet, spärr och yrkesroll.',
    expert: 'Systemet skyddar varje uppgift efter var den skrevs och vem som läser, så användaren behöver inte avgöra vad som är känsligt.',
    anmarkning: 'Skydd baserat på processer och planer saknas, och det finns ingen klassning av informationens skyddsbehov.',
  },
  {
    id: '5.3.1.3', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: [
      `${B}skyddad identitet: namn och personnummer maskeras`,
      `${A}arbetslista maskerar skyddad identitet`,
      `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}väntrummet visar aldrig namn för skyddad patient`,
      `${A}visa identitet kräver syfte och loggas`,
      `${F}skyddad patient maskeras i FHIR`,
      `${MJ}skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter`,
      `${B}invånare: egen journal från 16 år, vårdnadshavare till 13 år och aldrig för ett barn med skyddad identitet`,
    ],
    losning: 'Skyddad identitet maskeras i arbetslista, sök, väntrum, journal, FHIR och Min journal, och att visa identiteten kräver syfte och loggas.',
    expert: 'Systemet maskerar skyddad identitet överallt, så ingen behöver komma ihåg vem som har skyddade personuppgifter.',
    anmarkning: 'Förändringar som kan röja en skyddad person, till exempel byte av vårdenhet, hanteras inte särskilt.',
  },
  { id: '5.3.1.4', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Kryptering av trafiken sköts av driften. Demon nås över HTTPS och sessionskakan får Secure, men det är inte ett åtagande för en tjänsteleverans.' },
  { id: '5.3.1.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Oavvislighet med kryptografiska metoder mot andra organisationer är inte byggd.' },
  {
    id: '5.3.1.6', kategori: 'system', egna: ['L1'], avsedd: 'uppfyllt_demo',
    tester: [
      `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
      `${J}rättelse kräver orsak`,
      `${J}bara senaste versionen kan rättas`,
      `${A}helflöde: anteckning skapas, signeras och rättas`,
      `${M}utsättning kräver orsak och inget raderas`,
    ],
    losning: 'En rättelse blir en ny version med orsak, och den tidigare versionen visas överstruken men läsbar. Utsatta ordinationer finns kvar med orsak.',
    expert: 'Systemet sparar varje ändring som ny version och visar historiken vid anteckningen, så ingen behöver leta efter vad som ändrats.',
    anmarkning: 'Ändringshistorik för diagnoser och mätvärden finns inte, eftersom de inte går att ändra i demon.',
  },
  {
    id: '5.3.1.7', kategori: 'system', egna: ['L1', 'L4'], avsedd: 'uppfyllt_demo',
    tester: [
      'Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan',
      'Arkiv > radering av hela journalen behåller identiteten, utskrifterna, utlämnandena och loggen',
      'Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas',
      'Arkiv > export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i',
      'Arkiv > arkivariens postförteckning visar inget innehåll och nämner inte en spärrad vårdenhet',
    ],
    losning: 'Radering av utpekade poster eller hela journalen bara efter ett registrerat beslut, till exempel Inspektionen för vård och omsorgs beslut om journalförstöring (patientdatalagen 8 kap. 4 §). Åtkomstloggen ändras aldrig: dess rader om patienten finns kvar, och raderingen loggas med beslutets id och antal poster utan innehåll. Patientens identitet, utskrifter och utlämnanden finns kvar.',
    expert: 'Arkivarien pekar ut posterna med typ, datum och vårdenhet utan att läsa innehållet. Systemet tar med hela versionskedjan för en rättad anteckning och släpper journalens skydd bara för de raderna, i en transaktion.',
    anmarkning: 'Förstöring av kopior som har lämnats ut till andra hanteras inte. Loggens fritext (syftet med ett aktivt val eller en nödåtkomst) finns kvar efter radering.',
  },
  { id: '5.3.1.8', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Certifikat mellan instanser och delsystem används inte.' },
  { id: '5.3.1.9', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens fysiska skydd i driften.' },
  { id: '5.3.1.10', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens skydd mot skadlig kod i driften.' },
  { id: '5.3.1.11', kategori: 'leverantor', egna: ['D7', 'M8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens säkerhetsuppdateringar. Demon byggs om från en fast Bun-version, men det finns inget åtagande om uppdateringar.' },
  {
    id: '5.3.1.12', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}nekad åtkomst ger 403 kraver_val och loggas som nekad`,
      `${A}nödåtkomst via API flaggas i logguppföljningen`,
      `${L}okänd grund vägras`,
      `${MJ}nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan`,
      // Runda 6, r1: säkerhetsloggen (sakerhetslogg.js).
      'Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser',
      'Säkerhetsloggen > ändrade behörigheter och inställningar blir säkerhetshändelser',
      'Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras',
    ],
    losning: 'Säkerhetshändelser loggas som en egen loggtyp i en egen kedja: inloggning och utloggning, misslyckad inloggning, anrop som avvisas med 401 eller 403, ändrade behörigheter (delegering att ge läkemedel), ändrade inställningar, export av loggen och stickprovskontroller. Nekade åtkomster och nödåtkomst loggas också i åtkomstloggen och flaggas i logguppföljningen.',
    expert: 'Systemet loggar händelserna själv i varje anrop och sparar sökvägen utan patientens id. Logggranskaren ser händelserna i en egen flik med kedjans status och kan exportera dem.',
    anmarkning: 'Händelser i driften utanför sandlådan, till exempel omstart av servern och nya sandlådor, loggas inte här. Inloggningen med SITHS och e-legitimation är simulerad.',
  },
  { id: '5.3.1.13', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens intrångsskydd i driften.' },
  { id: '5.3.1.14', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens incidentrapportering.' },
  { id: '5.3.1.15', kategori: 'leverantor', egna: ['D4'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens kontinuitetsplan. Läsläget vid avbrott (D4) är en del av tekniken, men det finns ingen kontinuitetsplan.' },
  { id: '5.3.1.16', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens plan för återställning. Demon sparar sandlådorna vid omstart, men det finns ingen plan för systemhaveri.' },
  { id: '5.3.1.17', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens informationssäkerhetsarbete.' },
  {
    id: '5.3.1.18', kategori: 'system', egna: ['D8', 'M6'], avsedd: 'delvis',
    tester: [
      `${B}nekad: utan grund nekas åtkomst utan erbjudande om val`,
      `${A}skrivande anrop med fel Origin avvisas`,
      `${A}sessionskakan är HttpOnly och SameSite=Lax`,
      `${A}för stor kropp avvisas`,
      `${MJ}ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas`,
    ],
    losning: 'All behörighetskontroll sker på servern, loggen och den signerade journalen skyddas av databastriggrar, och anrop från andra webbplatser avvisas.',
    expert: 'Säkerheten ligger i servern och databasen och inte i användarens val, så den gäller oavsett hur systemet anropas.',
    anmarkning: 'Ingen extern säkerhetsgranskning eller penetrationstest är gjord.',
  },
]);
