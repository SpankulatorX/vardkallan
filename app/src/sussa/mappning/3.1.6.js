// Sussa 3.1.6 Basfakta patient: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 6, r1: basfakta som ett och samma objekt i API:t och patienthuvudet (vitalparametrar.js).
const BF = 'Basfakta > ';

export default [
  {
    id: '3.1.6.1', kategori: 'system', egna: ['D9'], avsedd: 'uppfyllt_demo',
    tester: [
      `${BF}basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem`,
      `${BF}basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet`,
    ],
    losning: 'Basfakta är ett och samma strukturerade objekt i patienthuvudet och i GET /api/patient/:id/basfakta: ålder, kön, var patienten vårdas, listning, överkänslighet, uppmärksamhetsinformation, vikt och längd. Varje uppgift har en hänvisning till sin FHIR-resurs (Patient, AllergyIntolerance och Observation).',
    expert: 'Systemet sammanställer basfakta själv ur journalen och räknar BMI ur vikten och längden, så ingen behöver föra in uppgifterna på ett särskilt ställe.',
    anmarkning: 'Basfakta byggs av det som redan finns i journalen. Ett eget formulär för att registrera eller ändra överkänslighet saknas, den finns bara i seeden.',
  },
  {
    id: '3.1.6.2', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${BF}basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem`,
      `${BF}basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet`,
    ],
    losning: 'Varje uppgift i basfakta har när, var och av vem den registrerades, och samma uppgift visas likadant i patienthuvudet i alla patientens vyer. Spärrade uppgifter och andra vårdenheters uppgifter utan aktivt val tas inte med.',
    expert: 'Systemet visar bara det rollen får se och räknar fram det som går att räkna fram, till exempel BMI från vikten de senaste 30 dagarna, och säger att det är räknat av systemet.',
    anmarkning: 'Nyregistrering och ändring av överkänslighet och andra basfakta i ett eget flöde saknas.',
  },
];
