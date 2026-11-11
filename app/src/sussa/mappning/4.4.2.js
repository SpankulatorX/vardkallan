// Sussa 4.4.2 Beställning och svar: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 8, r1: beställning och svar (labb.js, labb-fhir.js, kontroller.js och labb-rutter.js).
import { T, TESTFALL_3 } from '../labb-r8.js';
// Runda 9, r3: blodprodukter (blod.js).
import { BLOD } from '../runda9-r3.js';
// Runda 11, r4: transfusionen i läkemedelslistan, kontrollen vid sängen, hemovigilansen och blodcentralens vy.
import { BLOD_R11, GRANSSNITT_R11R4 } from '../runda11-r4.js';
// Runda 11, r6: undersökningar, rättade svar, underlag, koder, patientnära analyser och Min journal (undersokningar.js).
import { R6, R6_KB } from '../runda11-r6.js';

const { MJ } = TEST;
const SIM = 'Laboratorierna är simulerade.';

export default [
  {
    id: '4.4.2.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.folja, T.provtagning, T.svar, T.vidimera, T.apiFlode],
    losning: 'Varje beställning visar kedjan beställd, signerad (på uppdrag), provtagen, mottagen av laboratoriet, besvarad och vidimerad, med vem och när, och hela historiken med makulering, ändring och överlåtelse.',
    expert: 'Systemet för kedjan själv ur det som görs: ingen sätter status för hand.',
    anmarkning: SIM,
  },
  {
    id: '4.4.2.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.fhirBehorighet, T.planerat, T.kontrollUppgift, R6.planerat, R6.flera, R6.fysiologi, R6.api],
    losning: 'Fliken Prover börjar med Planerat för patienten: alla prover som inte är tagna, undersökningar i radiologi, ultraljud, klinisk fysiologi och klinisk neurofysiologi med bokad tid eller senaste dag, och kontrollerna som är ordinerade, från alla vårdenheter som användaren får se, i tidsordning. Beställningarna med hela kedjan står under. Avdelningens planerade uppgifter per dag finns i API:t (GET /api/planerat).',
    expert: 'Systemet samlar själv allt som är planerat i alla vårdprocesser och prövar varje rad i behörighetsmotorn, så att en beställning från en annan vårdenhet visas efter ett aktivt val och en spärrad inte alls.',
    anmarkning: 'Röntgenkliniken, klinisk fysiologi och klinisk neurofysiologi är simulerade.',
  },
  {
    id: '4.4.2.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.overlat, T.apiSparr],
    losning: 'Ansvaret för en beställning överlåts till en annan läkare med orsak. Den nya läkaren får svaren att vidimera i sin inkorg, och överlåtelsen står i historiken.',
    expert: 'Systemet prövar att den nya läkaren har en vårdrelation till patienten och förklarar varför det inte går när den saknas.',
    anmarkning: 'Den nya läkaren behöver en vårdrelation till patienten. Utan aktivt val visas bara att svar väntar, inte svaren.',
  },
  {
    id: '4.4.2.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.svar, T.kritisk],
    losning: 'Varje svar visas med referensintervall och avvikelsen i text (högt, lågt, kritiskt högt, kritiskt lågt, fynd), i beställningen, i inkorgen och i FHIR som interpretation.',
    expert: 'Systemet jämför själv svaret med referensintervallet för patientens kön och larmar vid kritiska värden.',
    anmarkning: 'Referensintervallen och de kritiska gränserna är demovärden, inte ett laboratoriums egna.',
  },
  {
    id: '4.4.2.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.folja, T.samman, T.svar, T.kritisk, T.dubbHistorik, R6.minStatus, R6.minRegel, R6.rattatLast],
    losning: 'Beställningen som kort med kedjan, rören, svaren med avvikelse och historiken. Avvikande och kritiska svar står först i inkorgen och har en egen markering. Allt för en patient visas samlat, också efter att en journal med reservnummer har slagits samman med den gällande.',
    expert: 'Systemet uppmärksammar själv avvikande och kritiska svar och ordnar inkorgen efter dem, och historiken innehåller aldrig något som bygger på uppgifter som läsaren inte får se. Patienten ser själv i Min journal statusen, den bokade tiden och förberedelsen för varje beställning, och svaret när läkaren har gått igenom det.',
    anmarkning: 'Visningsreglerna för en vårdenhet i Min journal gäller också dess beställningar. Laboratorierna är simulerade.',
  },
  {
    id: '4.4.2.6', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [R6.underlag, R6.upprepad, R6.kreatinin, R6.egfr, R6.graviditet, R6.implantat, ...R6_KB.bestall, T.paket, T.dubb, T.dubbDold, T.anvisning, T.provtagning, T.uppdrag, T.signeraBehorighet, T.kbPaket, T.kbProv, ...TESTFALL_3['3.1'], ...TESTFALL_3['3.2'], ...TESTFALL_3['3.3']],
    losning: 'Beställning av en eller flera analyser i olika rör och till olika laboratorier, med provtagningstid per analys, anamnes och kommentar, beställning på uppdrag och provtagningsanvisning som PDF. Utförda och kvarstående rör syns i beställningen och i provtagningslistan.',
    expert: 'Systemet föreslår paket, tar bort prov som nyss är tagna och fyller i laboratorium, rör, provtagningsordning och anamnes, räknat bara på det användaren får se. Före en undersökning kontrollerar systemet njurfunktionen före kontrast och lägger till P-Kreatinin när ett aktuellt värde saknas, och frågar om graviditet och implantat bara när undersökningen kräver det.',
    anmarkning: `Underlaget är högst 40 kB per fil och sex per beställning i demon. ${SIM}`,
  },
  {
    id: '4.4.2.7', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.planerat, T.kontrollUppgift, T.apiKontroll, T.apiLista, R6.planerat, R6.arbetslista, R6.fysiologi, R6.upprepad, ...R6_KB.boka],
    losning: 'Planerade och utförda prover och kontroller syns i fliken Prover, i provtagningslistan för vårdenheten och i API:t för avdelningens planerade uppgifter per dag, med status planerad, utförd eller försenad.',
    expert: 'Systemet bockar själv av en kontroll när mätvärdet registreras i tid, visar ett prov som försenat när tiden har gått och visar undersökningar med bokad tid eller senaste dag för prioriteten. Röntgenkliniken får den första lediga tiden föreslagen.',
    anmarkning: 'Röntgenkliniken, klinisk fysiologi och klinisk neurofysiologi och deras tider är simulerade.',
  },
  {
    id: '4.4.2.8', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.paket, T.fhir, R6.flera, R6.kreatinin, R6.svf],
    losning: 'En beställning blir en delbeställning per laboratorium (till exempel klinisk kemi och klinisk mikrobiologi) med egna rör och ett eget svar, under samma beställnings-id.',
    expert: 'Systemet delar själv beställningen per laboratorium, rör och specialistsystem: prover, röntgen och ultraljud i samma beställning blir en beställning till varje system under samma beställnings-id, med egen status, egen bokning och eget svar.',
    anmarkning: `Röntgen och ultraljud är två simulerade specialistsystem på samma röntgenklinik. ${SIM}`,
  },
  {
    id: '4.4.2.9', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.makulera, T.unikt, T.folja],
    losning: 'Makulering med orsak innan laboratoriet har svarat, och ändring (analyser tas bort eller läggs till) så länge röret inte är taget. Inget raderas, och historiken visar vem, när och varför.',
    expert: 'Systemet stoppar en makulering efter svar och en ändring av ett taget rör och förklarar varför.',
    anmarkning: 'Ett svar som har kommit kan inte makuleras. Ett felaktigt svar tas upp med laboratoriet.',
  },
  {
    id: '4.4.2.10', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.overlat, T.apiSparr],
    losning: 'Överlåtelse med ett klick och val av läkare, med orsak. Svaren som inte är vidimerade följer med till den nya läkaren.',
    expert: 'Systemet prövar vårdrelationen och flyttar själv vidimeringen till den nya läkarens inkorg.',
    anmarkning: 'Överlåtelsen gäller hela beställningen, inte enskilda analyser.',
  },
  {
    id: '4.4.2.11', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [T.svar, T.fhir, T.katalog, R6.koder, R6.utlatande, R6.svf, R6.underlagSvar],
    losning: 'Svaren tas emot med NPU-kod och UCUM-enhet, och odlingarnas fynd med Snomed CT, och lämnas ut i FHIR med samma koder.',
    expert: 'Systemet visar koden som text och sätter den själv i FHIR, så att ingen behöver kunna kodverket. Svaren från röntgen och fysiologin tas emot med åtgärden i KVÅ, fyndet i Snomed CT och vårdförloppet, och en kod som inte har kodverkets form tas inte emot.',
    anmarkning: 'Vårdkällan har ett utdrag ur KVÅ 2026 (docs/kodkontroll.md). En kod som saknas i utdraget tas emot med avsändarens text och märks som okänd.',
  },
  { id: '4.4.2.12', kategori: 'system', egna: [], tester: [...Object.values(BLOD), ...Object.values(BLOD_R11), GRANSSNITT_R11R4.blod], avsedd: 'uppfyllt_demo',
    losning: 'Läkaren beställer erytrocyter, plasma eller trombocyter i fliken Blod med antal och indikation, och beställningen blir en tillfällig ordination i läkemedelslistan. Blodgruppering och bastest beställs och besvaras som andra prover. Blodcentralen förenlighetsprövar och bereder enheter, och varje enhet följs från utlämning via förberedelse och kontroll vid sängen till transfunderad, återlämnad eller avbruten. Transfusionen blir en administrering i läkemedelslistan med enhetsnumret. En transfusionsreaktion är en egen rapport till blodcentralen (hemovigilans). Blodcentralens vy visar vårdenhetens beställningar i kedjan, blodet på avdelningen, reaktionerna och lagret.',
    expert: 'Systemet beställer själv blodgruppering och bastest som saknas, prövar i samma transfusionskontroll hos blodcentralen, i producentsystemet och vid sängen att blodgrupp och bastest gäller, kräver en andra person som kontrollerar i sin egen inloggning, säger när blodet ska återlämnas, klassar en reaktion, stoppar transfusionen och beställer proverna med ett klick. En blodprodukt kan bara ges från blodbeställningen.',
    anmarkning: 'Blodcentralen, enhetsnumren, lagret och reglerna för förenlighet och reaktioner är simulerade demoregler. En oidentifierad patient med reservnummer följs på samma sätt.' },
  {
    id: '4.4.2.13', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [R6.rattat, R6.rattatLast, R6.rattatPs, R6.rattatDemo, R6.underlagSvar, R6.fysiologi, R6.utlatande, T.svar, T.vidimera, T.kritisk, T.undantag, `${MJ}provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt`],
    losning: 'Nya svar hamnar i den ansvariga läkarens inkorg för vidimering, med avvikande och kritiska först, och kritiska svar larmar också sjuksköterskorna på vårdenheten. Min journal visar svaret när det är vidimerat.',
    expert: 'Systemet larmar själv vid kritiska svar och ordnar inkorgen efter avvikelse. Ett rättat svar är märkt som rättat med den tidigare versionen kvar, och den som läste den tidigare versionen får det rättade svaret i inkorgen.',
    anmarkning: 'Laboratorierna och röntgenkliniken är simulerade, och demoknappen för ett rättat svar gäller bara de simulerade laboratorierna.',
  },
  {
    id: '4.4.2.14', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.kontroll, T.kontrollUppgift, ...TESTFALL_3['3.5'], R6.instrument, R6.instrumentEtikett],
    losning: 'Interna analyser på avdelningen, som SR och blodsocker, ordineras som kontroller och registreras som mätvärden bland laboratoriets svar, med samma kod och kurva.',
    expert: 'Systemet bockar av kontrollen när värdet registreras, så att samma värde inte behöver dokumenteras två gånger. Instrumentet skickar svaret genom det öppna gränssnittet med provets etikett, så att ingen skriver in värdet och svaret hamnar på rätt patient.',
    anmarkning: 'Instrumentet är simulerat, men svaret går genom samma gränssnitt och kontroller som från ett riktigt.',
  },
  {
    id: '4.4.2.15', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.uppfoljning],
    losning: 'Uppföljningen i provtagningsvyn och i API:t visar vårdenhetens antal beställningar, beställningar på uppdrag, makuleringar, avvikande och kritiska svar och ledtiderna till provtagning, svar och vidimering, utan personuppgifter.',
    expert: 'Systemet räknar allt ur det som redan är registrerat.',
    anmarkning: 'Uppföljningen gäller den egna vårdenheten och senaste 1 till 365 dagarna.',
  },
];
