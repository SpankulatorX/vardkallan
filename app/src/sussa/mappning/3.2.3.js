// Sussa 3.2.3 Processtöd för specifika vårdprocesser: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const { A } = TEST;
const TV = 'Tvångsvård > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));
const BEHORIGHET = [
  `${TV}inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt`,
  `${TV}skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning`,
];

export default [
  {
    id: '3.2.3.1', kategori: 'system', egna: ['L3'], avsedd: 'uppfyllt_demo',
    tester: [
      `${TV}fristerna räknas ur lagen: intagning inom 24 timmar, vårdintyg högst fyra dagar, ansökan före fyra veckor och vård i högst fyra månader`,
      `${TV}övergång från frivillig vård: beslut inom 24 timmar, underställning dagen efter och ansökan inom fyra dagar (11 och 12 §§)`,
      `${TV}utan ansökan i tid upphör tvångsvården av sig själv (28 §), och 26 a § låter den öppna vården kvarstå`,
      `${TV}tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO`,
      `${TV}rättspsykiatrisk vård: fyra månader utan särskild utskrivningsprövning och anmälan inom fyra månader med`,
      `${TV}läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten`,
      ...BEHORIGHET, flode('intagningsbeslut'),
    ],
    losning: 'Dokumentation och uppföljning av psykiatrisk tvångsvård och rättspsykiatrisk vård byggd direkt från LPT (1991:1128) och LRV (1991:1129): vårdintyg, kvarhållning, beslut om intagning, övergång från frivillig vård, ansökan och anmälan till förvaltningsrätten, rättens beslut, öppen tvångsvård, tvångsåtgärder och upphörande, med paragraf för varje frist och krav.',
    expert: 'Systemet räknar alla frister ur lagen, varnar före dem, förklarar med paragraf vad lagen kräver och säger när lagen inte anger någon tid, prövar att rätt läkare beslutar och föreslår nästa steg.',
    anmarkning: 'Kravet hänvisar till Socialstyrelsens regelverk. Socialstyrelsens föreskrifter om psykiatrisk tvångsvård är inte lästa, bara lagarna. Chefsöverläkarens uppdrag enligt 39 § är simulerat. Rättspsykiatrisk vård för den som är anhållen eller häktad (LRV 4 §) och ärenden om permission och särskild utskrivningsprövning hos förvaltningsrätten är inte byggda.',
  },
  {
    id: '3.2.3.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${TV}läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten`,
      `${TV}beslutet nekas för den som saknar chefsöverläkarens uppdrag, och tvångsåtgärder kräver uppdraget utom under kvarhållningen`,
      `${TV}vårdintyget skickas av systemet till den psykiatriska vårdenheten och svaret röjer inget om andra uppgifter där`,
      `${TV}beslutsjournalen kan inte ändras eller raderas (trigger)`,
      `${TV}kontrollerna före intagningen: vårdintygets ålder, vem som utfärdade det och chefsöverläkarens uppdrag (6 b och 39 §§)`,
      'Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar',
      ...BEHORIGHET, flode('intagningsbeslut'),
    ],
    losning: 'En obruten tvångsvårdsperiod från vårdintyg till upphörande, i sluten och öppen form, med en sammanhållen beslutsjournal som visar vem, var och när för varje beslut. Den samordnade vårdplanen enligt 7 a § upprättas under Planer och är klar när kommunen har justerat den.',
    expert: 'Läkaren registrerar beslutet med ett klick. Systemet fyller i allt annat ur sammanhanget: den psykiatriska vårdenhet som vårdintyget skickas till, ankomsten, fristerna och inskrivningen.',
    anmarkning: 'Beslutsjournalen kan bara visas i tidsordning i demon.',
  },
  {
    id: '3.2.3.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [`${TV}parallella processer: den somatiska vården visas medan tvångsvården fortsätter`, ...BEHORIGHET],
    losning: 'Tvångsvårdsperioden är skild från vårdtillfället. När patienten vårdas på en somatisk avdelning, i demon hjärtintensiven, fortsätter perioden med sina frister, och den somatiska vården visas i tvångsvården och tvångsvården i översikten, för den som får se båda.',
    expert: 'Systemet håller isär de två processerna och visar dem bredvid varandra, så att ingen behöver flytta eller registrera om tvångsvården när patienten flyttas för somatisk vård.',
    anmarkning: 'Den somatiska vårdenheten och psykiatrin ser varandras uppgifter först efter aktivt val, som all annan information mellan vårdenheter.',
  },
  {
    id: '3.2.3.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${TV}bevakningen på enhetsnivå sorterar på fristen och uppföljningen innehåller inga personuppgifter`,
      `${TV}inkorgen visar fristen för ansökan och uppgifterna för läkaren på den psykiatriska vårdenheten`,
      `${TV}tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO`,
      ...BEHORIGHET,
    ],
    losning: 'Bevakningen på den psykiatriska vårdenheten visar alla pågående perioder med nästa frist, pågående tvångsåtgärder och det som återstår, sorterat på den frist som kommer först. Uppföljningen per vårdenhet räknar perioder, tvångsåtgärder och passerade frister utan namn, personnummer eller id.',
    expert: 'Systemet ordnar bevakningen efter fristerna och lägger det som är nära eller har passerat i läkarens inkorg, med underrättelser till IVO och uppföljningssamtal som uppgifter.',
    anmarkning: 'Grupper med färre än tre perioder visas inte som tal. Rapportering till IVO och andra myndigheter är inte byggd, bara uppgiften att underrätta.',
  },
  {
    id: '3.2.3.5', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${A}väntrummet visar aldrig namn för skyddad patient`,
    ],
    losning: 'Väntrummet på akutmottagningen med könummer, prioritet, ankomst och väntetid. Uppropning sker med könummer.',
    expert: 'Systemet sorterar på prioritet och väntetid och väljer själv att ropa upp med könummer, så skyddad identitet aldrig röjs vid uppropningen.',
    anmarkning: 'In- och utregistrering, triage, logistik mellan stegen och flödesöversikt för akutmottagningen saknas.',
  },
];
