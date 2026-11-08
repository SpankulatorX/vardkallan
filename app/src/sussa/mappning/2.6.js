// Sussa 2.6 Innovationsrum för utveckling: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { R6, R10 } from './2.5.js';

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
      // Runda 10, r1: källkod, licens och version för innovationer av typ B, systemkonton, och typ A: konfiguration och
      // mallar med fyra ögon och historik, och miljöer för test och acceptanstest före produktion.
      'Innovationsramverket > en tillämpning registreras med källkoden, licensen och versionen, och öppen källkod kräver adressen till källkoden',
      R10.backend, R10.uiKonto,
      'Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet',
      'Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade',
      'Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas',
      'Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter',
      'Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön',
    ],
    losning: 'Innovationer av båda typerna i kravspecifikationen. Typ A, inom Kärnsystemet: regler, parametrar och mallarnas sökord ändras av systemförvaltningen utan programmering, med förslag, fyra ögon, ett giltighetsdatum och en historik som inte kan ändras, och prövas först i en utbildnings-, test- eller acceptanstestmiljö med samma regler som produktionen. Typ B, utanför Kärnsystemet: programmeringsspråk, ramverk och API:er: innovationer byggs som externa tillämpningar i valfritt språk med etablerade standarder, SMART on FHIR (EHR launch och standalone launch med OAuth 2.0 och PKCE) och FHIR R4. Funktioner: allt i journalen går att läsa och mätvärden, anteckningar, diagnoser, överkänslighet, ordinationer, remisser, nya patienter, bokning och inskrivning går att skriva, och systemkonton utan inloggad person prenumererar på nya och ändrade poster. Hantering av källkod: Vårdkällans källkod är öppen under EUPL 1.2 på GitHub, och varje registrerad tillämpning har adressen till sin källkod, sin licens och sin version, med öppen källkod som systemets förslag. För typ A är konfigurationens historik versionshanteringen. Distribution: systemförvaltaren registrerar en tillämpning på sidan Öppet API med namn, adress och vad den ska läsa, och den syns sedan i journalen för de roller som får använda den, tills den återkallas. Sidan För utvecklare har dokumentationen (CapabilityStatement och SMART-konfigurationen), en exempeltillämpning med öppen källkod och en sandlåda med påhittade patienter för varje besökare. Utvecklarforum och support: ärenden mellan kund och utvecklare med frågor, fel och begäran om ny information, med svar och en statuskedja. Framtidssäkring: ändringsloggen och versionen i CapabilityStatement, som bygget kontrollerar. Källkoden är öppen under EUPL 1.2 på GitHub.',
    expert: 'Plattformen sköter inloggning, patientkontext, behörighet och loggning, så den som bygger en tillämpning bara behöver läsa FHIR, och tillämpningen kan aldrig se mer än användaren. Systemförvaltaren väljer bara vad tillämpningen ska läsa: systemet räknar fram omfånget och behörigheten och skriver vad tillämpningen får.',
    anmarkning: 'Källkoden för en tillämpning som en samarbetspartner bygger förvaltas i samarbetspartnerns eget förråd, och Vårdkällan håller reda på var den finns, licensen och versionen. Support och utvecklarforum i demon är ärendena på sidan Öppet API. I demon kan en tillämpning registreras med en adress på samma server eller en https-adress, och den gäller bara i den egna sandlådan.',
  },
  { id: '2.6.1.3', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller innovationer som leverantören redan har genomfört.' },
];
