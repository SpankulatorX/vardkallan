// Sussa 3.1.9 Utskrifter: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { GK } = TEST;
const U = 'Utskrift > ';
// Runda 10, r2: urval och menprövning (test/utskrift-urval.test.js).
const UU = 'Utskrift, urval > ';
const UM = 'Utskrift, menprövning > ';

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
    anmarkning: 'Patientens begäran om journalkopia i Min journal är inte byggd. Menprövningen görs av den som lämnar ut. Systemet föreslår beslut och grund men prövar inte själv.',
  },
  {
    id: '3.1.9.4', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${U}syftet och delarna föreslås ur sammanhanget`,
      `${U}skyddad identitet maskeras i utskriften och en avidentifierad utskrift saknar namn och personnummer`,
      `${U}en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med`,
      `${UU}ett datumintervall tar bara med poster från intervallet, och urvalet står i utskriften`,
      `${UU}en enskild anteckning skrivs ut för sig, och loggen, posterna och kontrollsumman gäller just urvalet`,
      `${UU}valda poster ur flera delar skrivs ut, och en post som inte syns för den inloggade avvisas utan att röja den`,
      `${UU}förslaget erbjuder datumintervall och de poster som går att välja, och bara de som rollen får läsa`,
      `${GK}Skriva ut en enskild anteckning inom budget`,
    ],
    losning: 'Utskrift av hela journalen eller av delar: fördefinierade utskrifter efter syfte, fritt val av delar, ett datumintervall, valda poster och en enskild anteckning direkt från journalen. Avidentifierad utskrift och skydd av patientens identitet. Utskriften går till den skrivare som datorn har, eller sparas som PDF i webbläsarens utskriftsdialog.',
    expert: 'Systemet föreslår syfte, delar och intervall ur patientens läge, erbjuder bara de delar och poster rollen får läsa och säger i utskriften vad urvalet var och vad som inte kom med.',
    anmarkning: 'Utskriften skickas till skrivaren genom webbläsaren. En central utskriftstjänst med köer och skrivarval på servern hör till driftmiljön och finns inte i demon, och servern skapar ingen egen PDF.',
  },
  {
    id: '3.1.9.5', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${U}varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra`,
      `${U}utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet`,
      `${UM}menprövningen registreras strukturerat med beslut, grund och vem, och systemet föreslår grunden ur mottagaren`,
      `${UM}logggranskaren söker utlämnanden på mottagare över alla patienter, och sökningen loggas`,
      `${UM}sökningen på mottagare maskerar skyddad identitet`,
    ],
    losning: 'Loggning av varje utskrift, utlämnande och återlämnande. Menprövningen registreras med beslut, grund och vem som prövade, och kan inte ändras. Logggranskaren söker en utskrift på id:t som står på papperet och utlämnanden på mottagare över alla patienter, och varje patient har en flik med utskrifter och utlämnanden.',
    expert: 'Systemet loggar och kopplar ihop utskrift och utlämnande själv, föreslår menprövningens grund ur mottagaren och sätter den som registrerar som den som prövade, så att en utlämnad handling hittas med id:t på papperet eller med mottagaren.',
    anmarkning: 'Lagrummen i menprövningen är ett urval för demon. Ett beslut att inte lämna ut, som är ett myndighetsbeslut med överklagandehänvisning, registreras inte här.',
  },
];
