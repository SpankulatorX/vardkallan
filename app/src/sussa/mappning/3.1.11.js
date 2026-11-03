// Sussa 3.1.11 Signering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { J, GK } = TEST;

export default [
  {
    id: '3.1.11.1', kategori: 'system', egna: ['L1'], avsedd: 'uppfyllt_demo',
    tester: [
      `${J}signerad anteckning kan inte ändras via API-funktionen`,
      `${J}signerad anteckning kan inte ändras i databasen (trigger)`,
      `${J}signerad anteckning kan inte raderas (trigger)`,
      `${J}annan än författaren kan inte ändra eller signera utkast`,
      `${GK}Skriva och signera en daganteckning inom budget`,
    ],
    losning: 'Anteckningar skrivs som utkast och signeras av författaren. En signerad anteckning kan inte ändras eller raderas, inte ens direkt i databasen.',
    expert: 'Systemet låser anteckningen vid signering och gör en rättelse till en ny version, så användaren behöver inte kunna reglerna om journalens oföränderlighet.',
    anmarkning: 'Signeringen görs med den inloggade sessionen. SITHS-kortet är simulerat och ingen elektronisk underskrift med certifikat görs.',
  },
  {
    id: '3.1.11.2', kategori: 'system', egna: ['L1'], avsedd: 'delvis',
    tester: [
      `${J}signerad anteckning kan inte ändras via API-funktionen`,
      `${J}signerad anteckning kan inte ändras i databasen (trigger)`,
      `${J}signerad anteckning kan inte raderas (trigger)`,
      `${J}annan än författaren kan inte ändra eller signera utkast`,
      `${GK}Skriva och signera en daganteckning inom budget`,
      `${J}rättelse skapar ny version och den gamla finns kvar oförändrad`,
    ],
    losning: 'Signering av egna utkast, med rättelse som ny version.',
    expert: 'Utkast syns bara för författaren tills de signeras, och systemet säger på vanlig svenska varför en signerad anteckning inte kan ändras.',
    anmarkning: 'Signering med certifikat, signering av flera anteckningar samtidigt och signeringslistor saknas.',
  },
  {
    id: '3.1.11.3', kategori: 'system', egna: ['L1'], avsedd: 'uppfyllt_demo',
    tester: [
      'Kontrasignering > systemet föreslår överläkaren och aldrig den som signerade, den som begär eller en underläkare',
      'Kontrasignering > begäran hamnar i inkorgen och kontrasigneras med ett klick, och syns i FHIR',
      'Kontrasignering > den som har signerat kan inte kontrasignera själv',
      'Kontrasignering > en roll eller enhet utan behörighet nekas, och begäran ger ingen åtkomst utöver posten',
      'Kontrasignering > spärrade uppgifter och andra vårdenheters uppgifter kan inte begäras kontrasignerade',
      'Kontrasignering > ett provsvar kan begäras kontrasignerat, och en kontrasignering kan inte ändras eller raderas',
      `${GK}Begära kontrasignering av en anteckning inom budget`,
      `${GK}Kontrasignera en anteckning inom budget`,
    ],
    losning: 'En signerad anteckning eller ett mätvärde, till exempel ett provsvar, kan begäras kontrasignerat. Begäran hamnar i mottagarens inkorg, anteckningen visar vem som har kontrasignerat och när, och i FHIR är den som kontrasignerade attester på Composition.',
    expert: 'Systemet föreslår en överläkare på samma vårdenhet som får läsa uppgiften, aldrig den som signerade eller en underläkare, och kontrasigneringen görs med ett klick i anteckningen.',
    anmarkning: 'Kontrasignering av mätvärden går bara att begära genom API:t. Krav på kontrasignering per yrkesgrupp, till exempel för underläkare, är inte konfigurerat.',
  },
];
