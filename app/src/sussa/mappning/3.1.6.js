// Sussa 3.1.6 Basfakta patient: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 6, r1: basfakta som ett och samma objekt i API:t och patienthuvudet (vitalparametrar.js).
const BF = 'Basfakta > ';
// Runda 10, r2: överkänslighet i ett eget flöde (overkanslighet.js, test/overkanslighet.test.js).
const OK = 'Basfakta, överkänslighet > ';

export default [
  {
    id: '3.1.6.1', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${BF}basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem`,
      `${BF}basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet`,
    ],
    losning: 'Basfakta är ett och samma strukturerade objekt i patienthuvudet och i GET /api/patient/:id/basfakta: ålder, kön, var patienten vårdas, listning, överkänslighet, uppmärksamhetsinformation, vikt och längd. Varje uppgift har en hänvisning till sin FHIR-resurs (Patient, AllergyIntolerance och Observation).',
    expert: 'Systemet sammanställer basfakta själv ur journalen och räknar BMI ur vikten och längden, så ingen behöver föra in uppgifterna på ett särskilt ställe.',
    anmarkning: 'Basfakta byggs av det som redan finns i journalen. Vikt och längd registreras som mätvärden och överkänslighet i ett eget flöde (3.1.6.2).',
  },
  {
    id: '3.1.6.2', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${BF}basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem`,
      `${BF}basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet`,
      'Journal > mätvärden valideras och registreras',
      `${OK}systemet slår upp ATC-koden och föreslår allvarlighetsgraden ur ämnet och reaktionen`,
      `${OK}nyregistrering: basfakta, uppmärksamhetssymbolen och varningen vid ordination uppdateras, med när, var och av vem`,
      `${OK}ändring blir en ny version med orsak, och den tidigare versionen finns kvar i historiken`,
      `${OK}avslut med orsak tar bort överkänsligheten ur basfakta och symbolen, men historiken visar den med vem och varför`,
      `${OK}fel roll, en spärrad vårdenhets rad och en rad som inte finns nekas, utan att något röjs`,
      `${OK}skyddad identitet: svaret innehåller varken namn eller personnummer`,
      `${OK}en annan vårdenhets rad hos samma vårdgivare får ändras och avslutas, och avslutet lämnar raden kvar med historiken`,
      `${OK}en rad hos en annan vårdgivare och en spärrad vårdenhets rad kan inte ändras eller avslutas, och felet röjer inget`,
      'Gränssnitt > Klickbudget > Registrera en överkänslighet inom budget',
    ],
    losning: 'Basfakta dokumenteras där uppgiften uppstår: vikt och längd som mätvärden och överkänslighet i ett eget flöde där läkare och sjuksköterskor registrerar, ändrar som ny version och avslutar med orsak. Varje uppgift har när, var och av vem, och historiken går inte att ändra. Samma uppgift visas likadant i patienthuvudet i alla patientens vyer, i uppmärksamhetssymbolen, i varningarna vid ordination, i Min journal och i FHIR (AllergyIntolerance). Spärrade uppgifter och andra vårdenheters uppgifter utan aktivt val tas inte med.',
    expert: 'Systemet slår upp ATC-koden ur ämnet, föreslår allvarlighetsgraden ur reaktionen och förklarar förslaget, så användaren behöver inte kunna kodverket. Det räknar fram det som går, till exempel BMI, och visar bara det rollen får se.',
    anmarkning: 'Listan över ämnen utan läkemedelskatalogen är ett urval för demon. Ämnen som inte är läkemedel har ingen kod ur något nationellt kodverk.',
  },
];
