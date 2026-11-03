// Sussa 3.4.4 Registrering av vårdkontakt och betalning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const VK = 'Vårdkontakt > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));

export default [
  {
    id: '3.4.4.1', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [
      `${VK}vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget`,
      `${VK}patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler`,
      flode('registrera-besok'),
    ],
    losning: 'Vårdkontakter registreras från patientens översikt, och patientavgiften räknas fram för varje kontakt i öppenvård och visas när kontakten registreras.',
    expert: 'Systemet fyller i kontaktsätt, tid, mottagning och kontaktorsak, och räknar ut avgiften ur kontakttyp, ålder och högkostnadsskydd, så att ingen behöver kunna avgiftsreglerna.',
    anmarkning: 'Betalning, kvitto och kassa är inte byggda. Avgifterna är demoregler, inte någon regions avgifter.',
  },
  { id: '3.4.4.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Incheckning som patienten gör själv hör till tidboken, som inte är byggd. När den byggs registrerar incheckningen ankomsten på den planerade vårdkontakten, på samma sätt som vårdadministratören gör i dag.' },
  {
    id: '3.4.4.3', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [
      `${VK}vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget`,
      `${VK}planerad kontakt på distans, och ankomsten registreras på den planerade`,
      `${VK}kontaktorsak krävs bara när systemet inte kan föreslå den`,
      `${VK}den som dokumenterar kan ändra kontakten som systemet skapade, men inte en annan enhets`,
      `${VK}yrkesrollen avgör vem som registrerar kontakter och vem som skriver in och ut`,
      `${VK}vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om`,
      flode('registrera-besok'), flode('planera-video'), flode('inskrivning'),
    ],
    losning: 'Vårdadministratören registrerar planerade och oplanerade kontakter, som besök, telefon, video eller hembesök, från patientens översikt. Sjuksköterskan skriver in, flyttar och skriver ut. En kontakt kan ändras och avslutas, och vem som registrerade och ändrade den och när visas på kontakten. Den som dokumenterar får en kontakt utan att registrera den.',
    expert: 'Systemet föreslår allt som går att räkna ut: besök, nu, mottagningen och kontaktorsaken från en remiss. När patienten kommer till en planerad kontakt registreras ankomsten på den, och samma kontakt kan inte registreras två gånger.',
    anmarkning: 'Kontakter kan inte registreras från en tidbok, eftersom tidboken inte är byggd. Utländska och oidentifierade patienter hanteras i patientidentiteten, inte här.',
  },
  {
    id: '3.4.4.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${VK}patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler`],
    losning: 'Patientavgiften räknas fram ur kontakttyp och kontaktsätt, med avgiftsfrihet för barn och de äldsta och med högkostnadsskyddet räknat över tolv månader, och visas med förklaring när kontakten registreras.',
    expert: 'Systemet räknar avgiften och säger varför den blir som den blir, till exempel att högkostnadsskyddet är nått. Ingen behöver kunna reglerna eller räkna själv.',
    anmarkning: 'Beloppen och reglerna är demoregler. Betalsätt, återbetalning, LMA-kort, avgifter för hjälpmedel, recept och intyg och patienter från andra län är inte byggda.',
  },
  { id: '3.4.4.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Incheckning lämnas till tidboken, som inte är byggd. Ankomsten på en planerad vårdkontakt kan redan registreras, och det är den som en incheckning ska sätta.' },
];
