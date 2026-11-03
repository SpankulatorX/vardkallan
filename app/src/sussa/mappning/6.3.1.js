// Sussa 6.3.1 Datauttag från Kärnsystemet: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
const D = 'Datauttag > ';

export default [
  {
    id: '6.3.1.1', kategori: 'system', egna: ['M12'], avsedd: 'uppfyllt_demo',
    tester: [
      `${D}bara uppföljningsrollen når datauttaget, och nekade försök loggas`,
      `${D}manifestet följer FHIR Bulk Data och uttaget loggas`,
      `${D}datauttaget innehåller inga namn, personnummer, adresser eller fritext`,
      `${D}spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet`,
    ],
    losning: 'En accesspunkt för uppföljning under /api/datauttag med vårdkontakter, diagnoser, ordinationer och remisser som NDJSON och ett manifest i samma form som FHIR Bulk Data. Patienten finns med som pseudonym, åldersgrupp och kön, utan namn, personnummer och fritext. Bara uppföljningsrollen når den, och varje uttag loggas.',
    expert: 'Systemet bygger uttaget själv, tar bort det som pekar ut personer och lämnar bara det som uppföljningen behöver.',
    anmarkning: 'Pseudonymiserade uppgifter är fortfarande personuppgifter. Spärrade uppgifter tas inte med, vilket är ett försiktigt val. Uttaget omfattar alla vårdenheter hos vårdgivaren, utan uppdelning per uppdrag.',
  },
  {
    id: '6.3.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${D}uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt`,
      `${D}drift-vyn visar när datauttaget senast uppdaterades och när nästa uppdatering sker`,
    ],
    losning: 'Uttaget uppdateras av sig själv varje natt klockan 02.00 svensk tid, och när det hämtas om den senaste uppdateringen är äldre. Sidan Svarstider visar när det senast uppdaterades och nästa gång.',
    expert: 'Systemet sköter uppdateringen och visar själv när den skedde, så att ingen behöver starta en körning.',
    anmarkning: 'I demon uppdateras varje sandlåda för sig när servern städar var tionde minut.',
  },
  {
    id: '6.3.1.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${D}manifestet följer FHIR Bulk Data och uttaget loggas`, `${D}datauttaget innehåller inga namn, personnummer, adresser eller fritext`],
    losning: 'Fyra tabeller: vårdkontakter, diagnoser, ordinationer och remisser. Fälten beskrivs under /api/datauttag/schema.',
    expert: 'Systemet beskriver själv varje fält och vad som har utelämnats.',
    anmarkning: 'Mätvärden, anteckningar, vårdtillfällen och patientavgifter finns inte i uttaget.',
  },
  {
    id: '6.3.1.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${D}uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt`],
    losning: 'En gång per natt, och direkt när uttaget hämtas efter att tiden har passerat.',
    expert: 'Systemet uppdaterar själv och visar nästa uppdatering.',
    anmarkning: 'Eftersläpningen är upp till ett dygn. Strömmande uppdatering finns inte.',
  },
  {
    id: '6.3.1.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${D}uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt`, `${D}manifestet följer FHIR Bulk Data och uttaget loggas`],
    losning: 'Inkrementell utläsning av nya, ändrade och borttagna rader sedan föregående uppdatering, med stabila radnycklar och dokumenterade fält. Uttaget läses ur en sparad uppdatering, så att utläsningen inte belastar journalens tabeller.',
    expert: 'Systemet räknar fram ändringarna själv, så att mottagaren bara behöver läsa det som är nytt.',
    anmarkning: 'Metod för kvalitetssäkring av data finns inte utöver testerna. Bara föregående uppdatering sparas.',
  },
];
