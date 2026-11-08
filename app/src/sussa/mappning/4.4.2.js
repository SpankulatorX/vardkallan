// Sussa 4.4.2 Beställning och svar: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 8, r1: beställning och svar (labb.js, labb-fhir.js, kontroller.js och labb-rutter.js).
import { T, TESTFALL_3 } from '../labb-r8.js';
// Runda 9, r3: blodprodukter (blod.js).
import { BLOD } from '../runda9-r3.js';

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
    id: '4.4.2.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.fhirBehorighet, T.planerat, T.kontrollUppgift],
    losning: 'Fliken Prover visar patientens alla beställningar från alla vårdenheter som användaren får se, med inre sekretess och spärr, och kontrollerna som är ordinerade till avdelningen. Avdelningens planerade uppgifter per dag finns i API:t (GET /api/planerat).',
    expert: 'Systemet samlar beställningarna och kontrollerna själv och prövar varje rad i behörighetsmotorn, så att inget dolt räknas eller visas.',
    anmarkning: 'Röntgen, fysiologi och andra undersökningar finns inte, bara laboratorieprov och kontroller.',
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
    id: '4.4.2.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.folja, T.samman, T.svar, T.kritisk, T.dubbHistorik],
    losning: 'Beställningen som kort med kedjan, rören, svaren med avvikelse och historiken. Avvikande och kritiska svar står först i inkorgen och har en egen markering. Allt för en patient visas samlat, också efter att en journal med reservnummer har slagits samman med den gällande.',
    expert: 'Systemet uppmärksammar själv avvikande och kritiska svar och ordnar inkorgen efter dem, och historiken innehåller aldrig något som bygger på uppgifter som läsaren inte får se.',
    anmarkning: 'Patienten ser svaren i Min journal men inte beställningens status.',
  },
  {
    id: '4.4.2.6', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [T.paket, T.dubb, T.dubbDold, T.anvisning, T.provtagning, T.uppdrag, T.signeraBehorighet, T.kbPaket, T.kbProv, ...TESTFALL_3['3.1'], ...TESTFALL_3['3.2'], ...TESTFALL_3['3.3']],
    losning: 'Beställning av en eller flera analyser i olika rör och till olika laboratorier, med provtagningstid per analys, anamnes och kommentar, beställning på uppdrag och provtagningsanvisning som PDF. Utförda och kvarstående rör syns i beställningen och i provtagningslistan.',
    expert: 'Systemet föreslår paket och tar bort prov som nyss är tagna med en förklaring, räknat bara på det användaren får se, och fyller i laboratorium, rör, provtagningsordning och anamnes.',
    anmarkning: `Underlag kan inte bifogas till en beställning. ${SIM}`,
  },
  {
    id: '4.4.2.7', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.planerat, T.kontrollUppgift, T.apiKontroll, T.apiLista],
    losning: 'Planerade och utförda prover och kontroller syns i fliken Prover, i provtagningslistan för vårdenheten och i API:t för avdelningens planerade uppgifter per dag, med status planerad, utförd eller försenad.',
    expert: 'Systemet bockar själv av en kontroll när mätvärdet registreras i tid och visar ett prov som försenat när tiden har gått.',
    anmarkning: 'Undersökningar utanför laboratoriet finns inte.',
  },
  {
    id: '4.4.2.8', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.paket, T.fhir],
    losning: 'En beställning blir en delbeställning per laboratorium (till exempel klinisk kemi och klinisk mikrobiologi) med egna rör och ett eget svar, under samma beställnings-id.',
    expert: 'Systemet delar själv beställningen per laboratorium och rör.',
    anmarkning: `Röntgen och ultraljud finns inte, bara laboratorierna. ${SIM}`,
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
    id: '4.4.2.11', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [T.svar, T.fhir, T.katalog],
    losning: 'Svaren tas emot med NPU-kod och UCUM-enhet, och odlingarnas fynd med Snomed CT, och lämnas ut i FHIR med samma koder.',
    expert: 'Systemet visar koden som text och sätter den själv i FHIR, så att ingen behöver kunna kodverket.',
    anmarkning: 'KVÅ och standardiserade vårdförlopp i svar tas inte emot.',
  },
  { id: '4.4.2.12', kategori: 'system', egna: [], tester: Object.values(BLOD), avsedd: 'delvis',
    losning: 'Läkaren beställer erytrocyter, plasma eller trombocyter till den simulerade blodcentralen med antal och indikation. Blodgruppering och bastest beställs och besvaras som andra prover i beställning och svar. Blodcentralen förenlighetsprövar och bereder enheter, och varje enhet följs från utlämning via förberedelse och kontroll vid sängen till transfunderad eller återlämnad. Varje steg sparas med vem och när och visas i beställningen.',
    expert: 'Systemet beställer själv blodgruppering och bastest som saknas, prövar bastestets giltighet i tre dygn, stoppar ett positivt bastest, kontrollerar id-band, enhetsnummer och blodgruppens förenlighet vid sängen, kräver en andra person som kontrollerar i sin egen inloggning och säger när blodet ska återlämnas.',
    anmarkning: 'Delvis: blodcentralen, enhetsnumren och reglerna är simulerade och finns i API:t men ännu inte i ett eget gränssnitt. Transfusionen registreras i blodbeställningen och inte som en administrering i läkemedelslistan, och transfusionsreaktioner rapporteras bara som text.' },
  {
    id: '4.4.2.13', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.svar, T.vidimera, T.kritisk, T.undantag, `${MJ}provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt`],
    losning: 'Nya svar hamnar i den ansvariga läkarens inkorg för vidimering, med avvikande och kritiska först, och kritiska svar larmar också sjuksköterskorna på vårdenheten. Min journal visar svaret när det är vidimerat.',
    expert: 'Systemet larmar själv vid kritiska svar och ordnar inkorgen efter avvikelse.',
    anmarkning: 'Uppdaterade svar (en rättelse från laboratoriet) och bifogade underlag i svaret finns inte.',
  },
  {
    id: '4.4.2.14', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.kontroll, T.kontrollUppgift, ...TESTFALL_3['3.5']],
    losning: 'Interna analyser på avdelningen, som SR och blodsocker, ordineras som kontroller och registreras som mätvärden bland laboratoriets svar, med samma kod och kurva.',
    expert: 'Systemet bockar av kontrollen när värdet registreras, så att samma värde inte behöver dokumenteras två gånger.',
    anmarkning: 'Patientnära instrument är inte anslutna. Värdet skrivs in för hand.',
  },
  {
    id: '4.4.2.15', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.uppfoljning],
    losning: 'Uppföljningen i provtagningsvyn och i API:t visar vårdenhetens antal beställningar, beställningar på uppdrag, makuleringar, avvikande och kritiska svar och ledtiderna till provtagning, svar och vidimering, utan personuppgifter.',
    expert: 'Systemet räknar allt ur det som redan är registrerat.',
    anmarkning: 'Uppföljningen gäller den egna vårdenheten och senaste 1 till 365 dagarna.',
  },
];
