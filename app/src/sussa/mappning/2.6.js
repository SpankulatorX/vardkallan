// Sussa 2.6 Innovationsrum för utveckling: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { R6 } from './2.5.js';

export default [
  { id: '2.6.1.1', kategori: 'leverantor', egna: ['M11'], tester: [], avsedd: 'planerat',
    anmarkning: 'Källkoden och dokumentationen är öppna på GitHub under EUPL 1.2. Utvecklarforum, utbildning och support finns inte.' },
  // Runda 9, r6: systemförvaltaren registrerar och återkallar tillämpningar, sidan för utvecklare och ärenden mellan
  // kund och utvecklare (api-forvaltning.js, public/js/oppet-api-forvaltning.js).
  {
    id: '2.6.1.2', kategori: 'system', egna: ['M11', 'M12'], avsedd: 'uppfyllt_demo',
    tester: [
      'SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas',
      'SMART on FHIR > standalone launch: personen väljer patienten bland sina patienter på arbetslistan',
      'SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas',
      'Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget',
      R6.tillampning, R6.aterkallad, R6.provas, R6.arendeKedja, R6.arendeExpert, R6.andringslogg,
      'Gränssnitt > Öppet API > systemförvaltaren registrerar en tillämpning, ser vad den får och kan återkalla den',
      'Gränssnitt > Öppet API > ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd',
    ],
    losning: 'Programmeringsspråk, ramverk och API:er: innovationer byggs som externa tillämpningar i valfritt språk med etablerade standarder, SMART on FHIR (EHR launch och standalone launch med OAuth 2.0 och PKCE) och FHIR R4. Funktioner: allt i journalen går att läsa och mätvärden, anteckningar, diagnoser, ordinationer, remisser, bokning och inskrivning går att skriva. Distribution: systemförvaltaren registrerar en tillämpning på sidan Öppet API med namn, adress och vad den ska läsa, och den syns sedan i journalen för de roller som får använda den, tills den återkallas. Sidan För utvecklare har dokumentationen (CapabilityStatement och SMART-konfigurationen), en exempeltillämpning med öppen källkod och en sandlåda med påhittade patienter för varje besökare. Utvecklarforum och support: ärenden mellan kund och utvecklare med frågor, fel och begäran om ny information, med svar och en statuskedja. Framtidssäkring: ändringsloggen och versionen i CapabilityStatement, som bygget kontrollerar. Källkoden är öppen under EUPL 1.2 på GitHub.',
    expert: 'Plattformen sköter inloggning, patientkontext, behörighet och loggning, så den som bygger en tillämpning bara behöver läsa FHIR, och tillämpningen kan aldrig se mer än användaren. Systemförvaltaren väljer bara vad tillämpningen ska läsa: systemet räknar fram omfånget och behörigheten och skriver vad tillämpningen får.',
    anmarkning: 'Källkoden för en tillämpning som en samarbetspartner bygger förvaltas av den som bygger den. Support och distribution utanför kundens egen förvaltning är leverantörens åtagande. I demon kan en tillämpning registreras med en adress på samma server eller en https-adress, och den gäller bara i den egna sandlådan.',
  },
  { id: '2.6.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller innovationer som leverantören redan har genomfört.' },
];
