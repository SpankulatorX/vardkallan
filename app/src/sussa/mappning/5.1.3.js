// Sussa 5.1.3 Gemensam informationsstruktur: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 9, r4: informationsmodellen mot NI, nationellt fackspråk och förvaltningen av kodverk.
import { TESTER_NI, TESTER_NF, TESTER_KODVERK } from '../runda9-r4.js';

const { F, KV, FS } = TEST;

const NI_LOSNING = 'Vårdkällans informationsmodell (informationsmodell.js, GET /api/informationsmodell och docs/informationsmodell.md) mappar varje tabell med patientuppgifter och varje FHIR R4-resurs i API:t mot informationsklasserna i Nationell informationsstruktur 2023:2, Modeller för hälso- och sjukvård: diagnoser och mätvärden är Observation med typ och värde, ordinationer är Beslut, åtgärder och givna doser Aktivitet, anteckningar Dokument, besök och vårdtillfällen Vårdkontakt och remisser Remiss. Begreppen har termbankens definitioner, och NI:s attribut pekar på kolumnerna som bär dem.';
const NI_EXPERT = 'Systemet klassar själv varje tabell med patientuppgifter. En ny del av journalen som ingen har klassat får NI:s allmänna klass Uppgift i patientjournal och visas som allmänt klassad, så informationsstrukturen har aldrig en lucka och ingen behöver kunna NI för att dokumentera.';
const NF_LOSNING = 'Nationellt fackspråk används i alla delar där det är tillämpbart (fackssprak.js, GET /api/fackssprak): Snomed CT för sökorden i journalens mallar, åtgärder, provtyper och fynd i odlingar och barnhälsovårdens tillväxt och vaccinationer, ICD-10-SE för diagnoser, KVÅ för åtgärder och termerna i Socialstyrelsens termbank för begreppen i informationsmodellen. Sökorden har koden i Snomed CT i FHIR, och varje identitet kontrolleras med Snomed CT:s kontrollsiffra och partition i bygget.';
const NF_EXPERT = 'Systemet sätter koden själv ur det användaren redan gör: sökordet Bedömning ger Snomed CT 424836000 och en NEWS2-kontroll både KVÅ QD008 och Snomed CT 304495004. Användaren ser bara den svenska texten och behöver aldrig välja eller kunna en kod.';
const NF_ANM = 'Delmängden är begrepp i den internationella utgåvan, kontrollerade mot tx.fhir.org (20250201). Den svenska utgåvan med svenska termer kräver licens och är inte kontrollerad. Fyra sökord har ingen exakt motsvarighet och får ingen kod. Sökning och inmatning med hjälp av strukturen i Snomed CT finns inte.';

export default [
  { id: '5.1.3.1', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo', tester: [...TESTER_NI],
    losning: NI_LOSNING, expert: NI_EXPERT,
    anmarkning: 'Kontrollerad mot NI 2023:2 för hälso- och sjukvård, den senaste utgåvan som går att läsa. Ansvaret för NI flyttas till E-hälsomyndigheten, och en ny utgåva därifrån är inte kontrollerad. Modellerna för vård och omsorg och för socialtjänst är inte mappade.' },
  { id: '5.1.3.2', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo', tester: [...TESTER_NF],
    losning: NF_LOSNING, expert: NF_EXPERT, anmarkning: NF_ANM },
  { id: '5.1.3.3', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo', tester: [...TESTER_NI],
    losning: `${NI_LOSNING} Samma modell gäller i hela systemet, eftersom den räknas fram ur databasen och CapabilityStatement. När NI ändras läggs den nya utgåvan in som en ny version av modellen, och testerna visar vilka klasser, tabeller och resurser som berörs.`,
    expert: NI_EXPERT,
    anmarkning: 'Kontrollerad mot NI 2023:2 för hälso- och sjukvård. Klasserna är mappade, men varje attribut i NI är inte mappat mot en kolumn, bara de som bär klassernas kärna.' },
  { id: '5.1.3.4', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo', tester: [...TESTER_NF],
    losning: `${NF_LOSNING} Varje del av NF hanteras som ett kodverk med version och giltighet i förvaltningen av kodverk.`,
    expert: NF_EXPERT, anmarkning: NF_ANM },
  {
    id: '5.1.3.5', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${KV}varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel`,
      `${KV}varje läkemedel i katalogen har en ATC-kod ur WHO:s register`,
      `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`,
      `${F}Condition använder ICD-10-SE`,
      `${FS}Condition och MedicationRequest har display ur kodverket`,
      // Runda 6, r1: eGFR med LOINC och åtgärder med KVÅ.
      'Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning',
      'Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie',
      'Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet',
      // Runda 9, r4: förvaltningen av kodverk över tid och lokala kodverk.
      ...TESTER_KODVERK,
    ],
    losning: 'ICD-10-SE för diagnoser, ATC och NPL-id för läkemedel, NPU för labb, LOINC för vitalparametrar, skalor och eGFR, KVÅ för åtgärder och UCUM för enheter, kontrollerade mot källorna (docs/kodkontroll.md). Alla kodverk förvaltas på ett ställe (kodverksforvaltning.js, sidan Kodverk och masterdata): varje kodverk har version, giltighetsdatum, utgivare och källa, en ny utgåva läses in från källan eller klistras in, jämförs med den som gäller och gäller när en annan systemförvaltare har godkänt den. Lokala kodverk från verksamheten skapas på samma sätt, och Vårdkällans egna kodverk står med som lokala. Diagnoser prövas mot den utgåva som gäller den dag de registreras.',
    expert: 'Systemet sätter koden själv utifrån det användaren gör, och kontrollerar en ny utgåva åt systemförvaltaren: form, dubbletter och kontrollsiffror, vad som är nytt, ändrat och borttaget och hur många diagnoser som har en kod som tas bort. En kod som inte gäller längre går inte att välja, och förklaringen säger vilken utgåva som tog bort den.',
    anmarkning: 'Utgåvorna i demon är de inbyggda. Ingen riktig utgåva läses från Socialstyrelsen, WHO, IFCC eller Regenstrief, och en utgåva kan ha högst 2000 koder. Åtgärder som systemet registrerar själv (KVÅ) prövas inte mot utgåvan, eftersom systemet sätter dem ur en fast koppling. Ett lokalt kodverk som skapas här används ännu inte av någon funktion i journalen, men går att hämta i API:t.',
  },
];
