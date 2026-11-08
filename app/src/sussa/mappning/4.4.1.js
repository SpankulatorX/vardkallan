// Sussa 4.4.1 Grundläggande behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 8, r1: beställning och svar (labb.js, labb-fhir.js, kontroller.js och labb-rutter.js).
import { T, TESTFALL_3 } from '../labb-r8.js';

const { KV, FS, MJ } = TEST;
const SIM = 'Laboratorierna är simulerade: svaren räknas fram av demon, och ingen kommunikation med ett riktigt producentsystem görs.';

export default [
  {
    id: '4.4.1.1', kategori: 'system', egna: ['D9', 'D6'], avsedd: 'uppfyllt_demo',
    tester: [T.paket, T.provtagning, T.svar, T.vidimera, T.apiFlode, `${MJ}provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt`, ...TESTFALL_3['3.1'], ...TESTFALL_3['3.3']],
    losning: 'Fliken Prover i journalen: läkaren beställer analyser och paket för patienten, den som tar proverna bockar av rör för rör med etiketter, proverna skickas till det simulerade laboratoriet och svaren kommer tillbaka som mätvärden med NPU-kod, referensintervall och avvikelse, i den ansvariga läkarens inkorg för vidimering. Varje prov har ett etikett-id som knyter röret till patienten och beställningen.',
    expert: 'Systemet föreslår paket ur vårdkontakten, diagnoserna och läkemedlen, väljer laboratorium, rör, provtagningsordning och anamnes, tar bort prov som nyss är tagna och skickar proverna själv när alla rör är tagna.',
    anmarkning: SIM,
  },
  {
    id: '4.4.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.flerLab, T.paket],
    losning: 'Klinisk kemi har tre utförande laboratorier (USÖ, Lindesberg och Karlskoga). Beställningen går till laboratoriet som hör till sjukhuset där den görs, och ett annat laboratorium i samma disciplin kan väljas.',
    expert: 'Systemet väljer laboratoriet ur enhetens plats i organisationen, så att ingen behöver veta vilket laboratorium som tar emot prov från vårdenheten.',
    anmarkning: SIM,
  },
  {
    id: '4.4.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.unikt, T.folja, T.fhir],
    losning: 'Varje beställning får ett beställnings-id (VKB, år och löpnummer) och varje rör ett etikett-id, som aldrig återanvänds, inte heller efter makulering, gallring eller sammanslagning av journaler. Id:t står på etiketterna, i historiken, i inkorgen och i FHIR som requisition och identifier.',
    expert: 'Systemet skapar id:t själv ur en räknare som aldrig går bakåt, så att det inte kan skrivas fel eller användas två gånger.',
    anmarkning: 'Kommunikationen med producentsystemet är simulerad, men id:t följer med till det simulerade laboratoriet och i FHIR.',
  },
  {
    id: '4.4.1.4', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [T.svar, T.fhir, T.katalog, `${FS}labbvärden har NPU-kod och UCUM-enhet`, `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`],
    losning: 'Analyserna och svaren har NPU-kod och UCUM-enhet, odlingarnas fynd Snomed CT, och de visas på samma sätt i beställningen, bland mätvärdena, i inkorgen, i Min journal och i FHIR, där svaret är en DiagnosticReport med samma Observation som mätvärdet.',
    expert: 'Systemet sätter kod, enhet och referensintervall själv och skriver ut avvikelsen i text, så att samma värde tolkas likadant överallt utan att någon översätter det.',
    anmarkning: 'NPU-koderna är kontrollerade mot IFCC:s NPU-fil och Snomed CT-koderna mot tx.fhir.org (docs/kodkontroll.md). Referensintervallen är demovärden.',
  },
  {
    id: '4.4.1.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.folja, T.unikt, T.etiketter],
    losning: 'Det som går att visa i demon: spårbarhet för varje steg med vem och när, en historik som inte går att ändra, unika id för beställning och prov och etiketter som knyter röret till patienten.',
    expert: 'Systemet skriver själv historiken och id:n, så att spårbarheten inte beror på att någon kommer ihåg att dokumentera.',
    anmarkning: 'Ingen bedömning mot STAFS 2015:13 är gjord. Kraven gäller i första hand laboratoriets egen verksamhet.',
  },
];
