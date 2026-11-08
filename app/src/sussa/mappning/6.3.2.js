// Sussa 6.3.2 Rapportering till kvalitetsregister och myndigheter: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r5: rapporteringen till myndigheter och register (myndighetsrapport.js), som också möter avtalets tillägg
// 2020 (A1.7 punkt 4: patientregistret, Väntetider i vården, Vårdtillfällesdatabasen och medicinska födelseregistret).
const M = 'Myndighetsrapportering > ';
const A = 'Myndighetsrapportering i API:t > ';

export default [
  {
    id: '6.3.2.1', kategori: 'nationell', egna: ['L9'], avsedd: 'delvis',
    tester: [
      `${M}kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter`,
      `${A}kvalitetsregistrets återkoppling sparas och kan läsas`,
      `${A}läkaren och sjuksköterskan registrerar och ångrar patientens invändning mot kvalitetsregistret, och det loggas`,
      `${A}patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den`,
      `${A}att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient`,
    ],
    losning: 'Ett demoregister för hjärtsvikt på sidan Rapportering: systemet tar själv fram patienterna med hjärtsvikt som hade en vårdkontakt i specialiserad vård, med läkemedelsgrupper, blodtryck, puls, NT-proBNP och eGFR ur journalen, och skickar dem varje månad till ett simulerat kvalitetsregister. Registret skickar tillbaka en återkoppling per vårdenhet som sparas och visas, så att data också går att ta emot från registret.',
    expert: 'Systemet väljer patienterna och fyller i varje uppgift ur det som redan är registrerat, och utelämnar själv den som har motsatt sig registreringen enligt patientdatalagen 7 kap. 2 §, utan att någon behöver kunna registrets variabler.',
    anmarkning: 'Kvalitetsregistret och dess återkoppling är simulerade, jämförelsetalen är påhittade och formatet är ett antagande. Inga verkliga nationella kvalitetsregister är anslutna. Läkaren och sjuksköterskan registrerar och ångrar patientens invändning under fliken Identitet, och patienten anmäler och ångrar den själv i Min journal. Informationen till patienten enligt 7 kap. 3 § bevakas inte. Patienter med skyddade personuppgifter och spärrade uppgifter utelämnas som ett försiktigt val.',
  },
  {
    id: '6.3.2.2', kategori: 'nationell', egna: ['L9'], avsedd: 'delvis',
    tester: [
      `${M}patientregistrets filer följer HSLF-FS 2023:33 med semikolon, rätt antal fält och filnamn med länskod och period`,
      `${M}diagnoser rapporteras utan punkt, yttre orsaker i egen fil och åtgärder och givna läkemedel med datum`,
      `${M}en vårdkontakt med fel hålls kvar, och felet beskrivs på svenska med vem som rättar`,
      `${M}primärvård och kontakter utan läkare rapporteras inte till patientregistret och räknas med bestämmelse`,
      `${M}skyddade personuppgifter och spärrade uppgifter rapporteras till patientregistret enligt lag och redovisas som antal`,
      `${M}psykiatrisk vårdform enligt LPT räknas fram ur beslutsjournalen`,
      `${M}väntande i specialiserad vård följer filspecifikationen med fas, aktivitet, remiss och måldatum`,
      `${M}medicinska födelseregistret tar förlossningar ur diagnoserna, och utan utfall är det ett fel`,
      `${M}Vårdtillfällesdatabasen har ett antaget format som är märkt som antagande`,
      `${M}en yttre orsak sätts ihop ur tre frågor och kontrolleras mot ICD-10-SE`,
      `${A}bara uppföljningsrollen granskar och skickar, och nekade försök loggas`,
      `${A}granskningen visar fel och fältens ifyllnad utan patientuppgifter`,
      `${A}att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient`,
      `${A}läkaren får felet i inkorgen bara för sin vårdenhet och rättar det med systemets förslag, och vårdkontakten följer med i nästa rapport`,
      `${A}en yttre orsak registreras i inkorgen ur svaren, och en kod som systemet inte känner till nekas`,
      `${A}en diagnos som registreras via rapportfelet röjer inte dolda diagnoser, och två huvuddiagnoser rättas av den som får se båda`,
      `${A}demoläget ger ett fel på kardiologen och ett på akutmottagningen i rätt inkorg`,
      `${A}väntelistans fritext visas inte för uppföljningsrollen, bara för vårdadministratören efter prövningen`,
      `${A}inkorgen följer det aktuella läget när en vårdkontakt flyttas eller personalen byter enhet efter att sammanställningen har sparats`,
      `${A}den sparade sammanställningen görs om när en spärr eller en vårdenhet ändras`,
      `${A}ett fel för ett vårdtillfälle syns bara när behörigheten gäller vårdtillfällets och varje kontakts vårdenhet, utan och med samtycke`,
      'Gränssnitt > Klickbudget > Granska och skicka månadens rapport till patientregistret inom budget',
    ],
    losning: 'Sidan Rapportering för uppföljningsrollen med patientregistret (slutenvård, specialiserad öppenvård, åtgärder, läkemedelstillförsel och psykiatrisk vårdform enligt HSLF-FS 2023:33 i lydelsen enligt HSLF-FS 2025:44), väntande i specialiserad vård enligt Socialstyrelsens filspecifikation för väntetidsdatabasen, Vårdtillfällesdatabasen i ett antaget format och medicinska födelseregistret enligt HSLF-FS 2024:5. Systemet sammanställer filerna själv ur vårdtillfällen, vårdkontakter, diagnoser, åtgärder, givna läkemedel, tvångsvårdens beslut och väntelistan, kontrollerar dem mot filspecifikationen och visar varje fel på svenska. Felen hamnar i inkorgen hos den som kan rätta dem. Mappningen mot sjukhus- och verksamhetskoder visas med källor. Mottagarna är simulerade.',
    expert: 'Systemet räknar fram varje fält, avgör huvud- och bidiagnos, sätter ihop yttre orsak ur tre frågor och håller själv kvar en kontakt med fel tills den är rättad, så att den kommer med i nästa rapport utan att någon behöver komma ihåg den. Det räknar också fram det som inte omfattas av uppgiftsskyldigheten och redovisar det som antal med bestämmelsen.',
    anmarkning: 'Mottagarna är simulerade och inget skickas på riktigt. Väntetiderna omfattar bara väntande i specialiserad vård, inte genomförda kontakter, primärvård, standardiserade vårdförlopp eller vårdplatser. Medicinska födelseregistret får bara de uppgifter som finns utanför en förlossningsjournal, eftersom Vårdkällan inte har någon, och mödrahälsovårdens och barnets filer saknas. För Vårdtillfällesdatabasen hittades ingen gällande teknisk beskrivning. Mappningen ändras i koden, inte i ett gränssnitt. En process för nya krav på rapporteringen finns inte i systemet utöver att källor och versioner står i docs/kodkontroll.md. Inskrivnings- och utskrivningssätt räknas som ordinärt boende när inget annat är registrerat, och avlidna registreras inte.',
  },
];
