// Sussa 3.1.9 Utskrifter: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { GK } = TEST;
const U = 'Utskrift > ';

export default [
  {
    id: '3.1.9.1', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${U}utskriften har samma innehåll som gränssnittet, med utskrifts-id, syfte, vem och när`,
      `${U}en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med`,
      `${GK}Skriva ut läkemedelslistan vid utskrivning inom budget`,
    ],
    losning: 'Utskrift av delar av eller hela journalen (läkemedel, diagnoser, anteckningar, mätvärden, remisser och vårdkontakter) som en utskriftsvänlig sida med patient, tid, vem som skrev ut och syfte. Webbläsarens utskriftsdialog öppnas, där utskriften också kan sparas som PDF.',
    expert: 'Systemet föreslår syftet och delarna ur sammanhanget, till exempel läkemedelslistan när patienten är inskriven, och tar bara med det som behörighetsmotorn släpper igenom för den inloggade.',
    anmarkning: 'Ingen central utskriftstjänst och ingen PDF som skapas av servern. PDF görs med webbläsarens Spara som PDF.',
  },
  {
    id: '3.1.9.2', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${U}varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra`,
      `${U}spärrade uppgifter och andra vårdenheters uppgifter kommer inte med utan aktivt val eller samtycke, och utelämnandet sägs men röjs inte`,
    ],
    losning: 'Varje utskrift loggas i åtkomstloggen och sparas med utskrifts-id, vem, när, syfte, delar, vilka poster med version som togs med, vad som utelämnades och en kontrollsumma av innehållet. Utskrifts-id:t står på varje sida, och logggranskaren söker på det.',
    expert: 'Systemet sätter utskrifts-id:t, loggar och sparar spårbarheten själv, och utskriften säger själv vad som inte kom med utan att röja vad det är.',
    anmarkning: 'Tabellen med utskrifter kan inte ändras eller raderas (databastriggrar).',
  },
  {
    id: '3.1.9.3', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${U}utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet`,
      `${U}ett utlämnande som inte har kommit tillbaka i tid hamnar i vårdenhetens inkorg`,
    ],
    losning: 'Utlämnande av journalhandlingar registreras med mottagare, handling, menprövning, vem och när (patientdatalagen 3 kap. 11 §), i samma steg som utskriften när kopian lämnas till patienten. Originalhandlingar som ska tillbaka får ett datum, och återlämnandet registreras med ett klick.',
    expert: 'Systemet fyller i beskrivningen ur utskriften, föreslår mottagare och datum för återlämnande och påminner i vårdenhetens inkorg när en handling inte har kommit tillbaka.',
    anmarkning: 'Patientens begäran om journalkopia i Min journal är inte byggd. Menprövningen registreras som text; systemet gör ingen prövning.',
  },
  {
    id: '3.1.9.4', kategori: 'system', egna: ['L4'], avsedd: 'delvis',
    tester: [
      `${U}syftet och delarna föreslås ur sammanhanget`,
      `${U}skyddad identitet maskeras i utskriften och en avidentifierad utskrift saknar namn och personnummer`,
      `${U}en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med`,
    ],
    losning: 'Fördefinierade utskrifter efter syfte, fritt urval av delar, avidentifierad utskrift och skydd av patientens identitet. Utskriften kan sparas som PDF i webbläsaren.',
    expert: 'Systemet föreslår syfte och delar ur patientens läge och erbjuder bara de delar rollen får läsa.',
    anmarkning: 'Central utskriftstjänst, utskrift av en enskild anteckning eller ett datumintervall och val av enstaka poster finns inte.',
  },
  {
    id: '3.1.9.5', kategori: 'system', egna: ['L4'], avsedd: 'delvis',
    tester: [
      `${U}varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra`,
      `${U}utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet`,
    ],
    losning: 'Loggning av varje utskrift, utlämnande och återlämnande, sökning på utskrifts-id i logguppföljningen och en flik per patient med utskrifter och utlämnanden.',
    expert: 'Systemet loggar och kopplar ihop utskrift och utlämnande själv, så att en utlämnad handling hittas med id:t på papperet.',
    anmarkning: 'Menprövningen registreras som text. Det finns ingen sökning på mottagare över alla patienter.',
  },
];
