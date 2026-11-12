// Sussa 3.4.4 Registrering av vårdkontakt och betalning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 13, r4 (sussa/runda13-r4.js).
import { medR13r4 } from '../runda13-r4.js';
import { klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';
import { T } from '../tidbok-tester.js';
// Runda 6, r4.
import { medR4 } from '../planering-r4.js';
// Runda 10, r7: kapacitet, ombud, kassan, meddelanden och kontorsstödet (sussa/runda10-r7.js).
import { medR10r7 } from '../runda10-r7.js';

const VK = 'Vårdkontakt > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));

const AVSNITT = [
  {
    id: '3.4.4.1', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [
      `${VK}vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget`,
      `${VK}patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler`,
      flode('registrera-besok'), T.incheckning, T.betalning, flode('checka-in'),
    ],
    losning: 'Vårdkontakter registreras från patientens översikt, eller genom incheckningen på en bokad tid, som registrerar ankomsten på den planerade vårdkontakten. Patientavgiften räknas fram för varje kontakt i öppenvård, och betalningen registreras med kort eller faktura, eller av systemet som frikort eller avgiftsfritt, med kvittonummer.',
    expert: 'Systemet fyller i kontaktsätt, tid, mottagning och kontaktorsak, räknar ut avgiften ur kontakttyp, ålder och högkostnadsskydd och registrerar själv när patienten inte ska betala något, så att ingen behöver kunna avgiftsreglerna.',
    anmarkning: 'Betalningen är simulerad och märkt så: inga pengar dras och ingen faktura skickas. Kassaredovisning saknas. Avgifterna är demoregler, inte någon regions avgifter.',
  },
  {
    id: '3.4.4.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.egenIncheckning, T.skyddad, T.incheckning, T.skarm],
    losning: 'Patienten checkar in själv i Min journal eller på incheckningsskärmen i väntrummet. Incheckningen registrerar ankomsten på den planerade vårdkontakten, ger ett konummer och visar avgiften.',
    expert: 'Systemet hittar patientens tid själv ur personnumret och öppnar incheckningen från en timme före till en halvtimme efter tiden. Skärmen visar aldrig namn och svarar likadant för ett nummer utan tid som för ett nummer som inte finns.',
    anmarkning: 'Incheckningsskärmen är simulerad i webbläsaren och öppnas av vårdadministratören. Ingen riktig kiosk eller kortläsare finns.',
  },
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
    anmarkning: 'En bokad tid i tidboken är en planerad vårdkontakt, och incheckningen registrerar ankomsten på den. Utländska och oidentifierade patienter hanteras i patientidentiteten, inte här.',
  },
  {
    id: '3.4.4.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [`${VK}patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler`, T.betalning, T.incheckning, T.egenIncheckning,
      // Runda 7, r3: LMA-kort, hjälpmedelsavgift, vårdnadshavare som betalar och avgifterna i faktureringsunderlaget.
      'Ekonomi: faktureringsunderlag > vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren',
      'Ekonomi: faktureringsunderlag > utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas',
      'Ekonomi: faktureringsunderlag > betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region',
      'Ekonomi: faktureringsunderlag > ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras',
      'Ekonomi: avgiften visas som e-frikortet > i vårdkontaktslistan och tidbokens betalning skiljer sig svaret med och utan dolda besök bara i beloppet och frikortsstatusen',
      'Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det'],
    losning: 'Patientavgiften räknas fram ur kontakttyp och kontaktsätt, med avgiftsfrihet för barn och de äldsta och med högkostnadsskyddet räknat över tolv månader, och visas med förklaring vid incheckningen. Betalningen registreras med kort eller faktura av vårdadministratören eller av patienten i Min journal, med vem, när och kvittonummer, och kan inte ändras i efterhand.',
    expert: 'Systemet räknar avgiften och säger varför den blir som den blir, till exempel att högkostnadsskyddet är nått. När patienten har frikort eller inte ska betala registrerar systemet det självt, så att ingen behöver kunna reglerna eller räkna.',
    anmarkning: 'Beloppen och reglerna är demoregler, och betalningen är simulerad. Sedan runda 7 betalar en asylsökande med LMA-kort den lägre avgiften (demoregel), ett utlämnat hjälpmedel kan ha en hjälpmedelsavgift, vårdnadshavaren är betalningsmottagare för ett barn och en avgift som inte betalades vid besöket kommer med i faktureringsunderlaget (Sussa 7.1). Patienter från andra län betalar samma avgift, och vården faktureras hemregionen. Avgiften visas som e-frikortet: frikort till ett datum eller avgiften att betala, aldrig betalda belopp, och patienten ser hela högkostnadsskyddet i Min journal. Återbetalning och avgifter för recept och intyg är inte byggda.',
  },
  {
    id: '3.4.4.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.egenIncheckning, T.skyddad, T.fhir, T.fhirInvanare],
    losning: 'Patienten checkar in i Min journal, som fungerar i mobilen, eller på skärmen i väntrummet, och får konummer och avgift. Incheckningen syns i FHIR som Appointment.status arrived, så att andra mobila lösningar kan läsa den.',
    expert: 'Systemet väljer rätt tid själv och registrerar ankomsten på vårdkontakten, och avgiftsfria besök registreras utan att någon gör något.',
    anmarkning: 'Incheckning genom FHIR (skrivning) och positionsbaserad incheckning i mobilen saknas. Skärmen i väntrummet är simulerad.',
  },
];

// Runda 6, r4: posterna som byggdes i planering och tidbok, del 2, och remiss, del 2, ersätts ur sussa/planering-r4.js.
// Runda 13, r4: ankomst i efterhand (sussa/runda13-r4.js).
export default medR13r4(medR10r7(medR4(AVSNITT)));
