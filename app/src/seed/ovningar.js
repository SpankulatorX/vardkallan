// Övningarna i utbildningsmiljön som de var i första versionen (runda 7, r2). Seeden lägger in dem som version 1, och
// sedan ändrar verksamhetschefen eller en utbildare dem i gränssnittet (utbildning.js). Inga patientuppgifter utom
// demopatienternas påhittade namn. Modulen beror inte på db.js.
import { YRKEN } from './personal.js';

const JOURNAL = ['lakare', 'sjukskoterska', 'underskoterska', 'vardadministrator', 'farmaceut'];
const ALLA = Object.keys(YRKEN);

const o = (id, roller, fraga, alternativ, ratt, forklaring, prova = null) => ({ id, roller, fraga, alternativ: alternativ.map(([a, text]) => ({ id: a, text })), ratt, forklaring, prova });

export const OVNINGAR_V1 = [
  o('logg', ALLA, 'Vad händer när du öppnar journalen för en patient i Vårdkällan?', [
    ['a', 'Inget sparas om du bara läser.'],
    ['b', 'Åtkomsten skrivs i åtkomstloggen med vem, när och på vilken grund, och patienten kan se den i Min journal.'],
    ['c', 'Bara ändringar i journalen loggas.'],
  ], 'b', 'Varje åtkomst till patientuppgifter loggas, också när du bara läser. Loggen går inte att ändra, och patienten ser i Min journal vilken vårdenhet och yrkesroll som har läst.'),
  o('expert', ALLA, 'Ett val dyker upp som du inte vet hur du ska fylla i. Vad gäller i Vårdkällan?', [
    ['a', 'Du behöver kunna kodverket för att fylla i det.'],
    ['b', 'Systemet fyller i det som går att räkna ut, föreslår resten och förklarar på vanlig svenska varför något inte går.'],
    ['c', 'Hoppa över valet, det kontrolleras ändå inte.'],
  ], 'b', 'Systemet är experten: koder, vårdkontakt, enhet och tider sätts av systemet, och när något inte går står det varför. Knappen Hjälp i flödet förklarar stegen.'),
  o('andra-enheter', JOURNAL, 'Du behöver läsa vad en annan vårdenhet har dokumenterat om demopatienten Gunnar Åkesson. Hur gör du?', [
    ['a', 'Ber en kollega på den andra vårdenheten skriva ut journalen.'],
    ['b', 'Väljer Visa uppgifter från andra vårdenheter i patienthuvudet och anger syftet, som systemet föreslår.'],
    ['c', 'Det går inte att läsa andra vårdenheters uppgifter.'],
  ], 'b', 'Inre sekretess: andra vårdenheters uppgifter visas efter ett aktivt val med syfte. Valet loggas och gäller sessionen för den patienten.', '#/patient/p01'),
  o('sparr', JOURNAL, 'Demopatienten Elin Sandberg har spärrat uppgifter. Vad ser du som inte arbetar på den spärrade vårdenheten?', [
    ['a', 'Allt, eftersom du har vårdrelation.'],
    ['b', 'En spärrmarkering, men inte innehållet eller vilken vårdenhet det gäller. Spärren hävs bara med patientens samtycke i stunden.'],
    ['c', 'Innehållet, om du väljer nödåtkomst.'],
  ], 'b', 'En spärr hävs bara tillfälligt med patientens samtycke, och nödåtkomst häver aldrig en spärr.'),
  o('skyddad', JOURNAL, 'En patient har skyddade personuppgifter. Vad visar systemet i arbetslistan och väntrummet?', [
    ['a', 'Namn och adress som vanligt.'],
    ['b', 'Skyddad identitet i stället för namnet, och adressen visas aldrig. Väntrummet visar bara könummer.'],
    ['c', 'Patienten visas inte alls.'],
  ], 'b', 'Systemet maskerar skyddad identitet överallt utan att någon behöver komma ihåg det. Visa identitet kräver ett syfte och loggas.', '#/arbetslista'),
  o('overkanslighet', ['lakare'], 'Du ordinerar amoxicillin till demopatienten Gunnar Åkesson, som är överkänslig mot penicilliner. Vad gör systemet?', [
    ['a', 'Sparar ordinationen utan varning.'],
    ['b', 'Varnar innan ordinationen sparas och kräver en motivering om du ändå vill ordinera.'],
    ['c', 'Tar bort överkänsligheten ur journalen.'],
  ], 'b', 'Ordinationen kontrolleras mot överkänslighet och andra läkemedel innan den sparas. En allvarlig varning kräver en motivering, som sparas med ordinationen.', '#/patient/p01/lakemedel'),
  o('nodatkomst', ['lakare', 'sjukskoterska'], 'Patienten saknar vårdrelation till din vårdenhet och kan inte samtycka, men du behöver journalen för vården. Vad gäller?', [
    ['a', 'Du kan inte öppna journalen.'],
    ['b', 'Du väljer Nödåtkomst med ett syfte. Åtkomsten flaggas i loggen och följs upp, och en spärr hävs aldrig.'],
    ['c', 'Du öppnar journalen som vanligt.'],
  ], 'b', 'Nödåtkomst kräver syfte och intyg om att patienten inte kan samtycka. Den syns för logggranskaren.', '#/sok'),
  o('dubbel-dos', ['sjukskoterska', 'underskoterska'], 'Du ska ge en dos från Läkemedel att ge, och systemet varnar för dubbel dos. Vad betyder det?', [
    ['a', 'Att listan är fel och varningen kan bortses från.'],
    ['b', 'Att en dos av samma läkemedel redan är registrerad nyss. Kontrollera innan du ger igen.'],
    ['c', 'Att läkaren måste ordinera på nytt.'],
  ], 'b', 'Systemet räknar fram dagens doser ur ordinationerna och varnar för dubbel dos, för tidig dos och högsta dygnsdos, med en förklaring.', '#/administrering'),
  o('news2', ['sjukskoterska'], 'Du registrerar vitalparametrar och NEWS2 blir 7. Vad gör systemet?', [
    ['a', 'Inget, du räknar NEWS2 själv.'],
    ['b', 'Räknar NEWS2, skriver vad som ska göras och när nästa kontroll ska göras, och larmar i inkorgen för sjuksköterskan och läkaren.'],
    ['c', 'Skickar ett sms till patienten.'],
  ], 'b', 'NEWS2 räknas ur vitalparametrarna. En summa som kräver åtgärd larmar i inkorgen. Reglerna är demoregler.'),
  o('delegering', ['underskoterska'], 'När får du som undersköterska ge ett läkemedel?', [
    ['a', 'När som helst om sjuksköterskan säger det.'],
    ['b', 'Bara med en giltig delegering. Systemet prövar delegeringen för just den dosen och visar knappen Ge bara då.'],
    ['c', 'Aldrig.'],
  ], 'b', 'Delegeringen registreras av en sjuksköterska eller läkare enligt HSLF-FS 2017:37 9 kap., och systemet påminner innan den går ut.', '#/delegeringar'),
  o('boka', ['vardadministrator'], 'En remiss väntar på tid. Hur bokar du?', [
    ['a', 'Letar själv efter en ledig tid i tidboken och räknar dagarna mot vårdgarantin.'],
    ['b', 'Väljer en av de tider som systemet föreslår i Dagens arbete. Systemet räknar dagarna mot vårdgarantin och skriver kallelsen.'],
    ['c', 'Ringer patienten först.'],
  ], 'b', 'Systemet föreslår de lämpligaste tiderna, så att bokningen är ett klick, och väljer kanal för kallelsen.', '#/idag'),
  o('samman', ['vardadministrator'], 'Systemet har hittat en trolig dubblett. Vem slår samman journalerna?', [
    ['a', 'Den som först ser dubbletten.'],
    ['b', 'Vårdadministratören bekräftar sammanslagningen, med behörighet till båda journalerna. Den gamla identiteten går att söka på.'],
    ['c', 'Systemet slår samman utan att fråga.'],
  ], 'b', 'Systemet hittar troliga dubbletter, och bara en vårdadministratör bekräftar sammanslagningen.'),
  o('genomgang', ['farmaceut'], 'Vad gör du i en fördjupad läkemedelsgenomgång?', [
    ['a', 'Ändrar ordinationerna själv.'],
    ['b', 'Går igenom läkemedlen med läkaren och patienten. Systemet tar fram läkemedelsberättelsen.'],
    ['c', 'Skickar en remiss till apoteket.'],
  ], 'b', 'Farmaceuten deltar i genomgången, och läkaren ordinerar. Systemet sammanställer underlaget.'),
  o('stickprov', ['logggranskare'], 'Hur väljs åtkomsterna i ett stickprov?', [
    ['a', 'Granskaren väljer själv vilka personer som ska granskas.'],
    ['b', 'Systemet drar åtkomsterna slumpvis för perioden, och du markerar var och en som befogad eller att den ska utredas.'],
    ['c', 'Bara nödåtkomster granskas.'],
  ], 'b', 'Stickprov enligt HSLF-FS 2016:40 4 kap. 9 b §. Nödåtkomster är dessutom flaggade i logguppföljningen.', '#/logg'),
  o('gallring', ['arkivarie'], 'När får en journal gallras?', [
    ['a', 'När den är äldre än tio år.'],
    ['b', 'Bara efter ett registrerat beslut, och åtkomstloggen ändras inte.'],
    ['c', 'När patienten ber om det.'],
  ], 'b', 'Gallring och förstöring görs bara efter ett registrerat beslut. Exportpaketet följer Riksarkivets FGS.', '#/arkiv'),
  o('datauttag', ['uppfoljning'], 'Vad innehåller datauttaget för uppföljning?', [
    ['a', 'Hela journalen med namn.'],
    ['b', 'Uppgifter utan namn och personnummer, uppdaterade varje natt.'],
    ['c', 'Bara antalet patienter.'],
  ], 'b', 'Datauttaget har inga namn eller personnummer och uppdateras varje natt.', '#/datauttag'),
  o('samverkan', ['kommun'], 'Vad ser du som kommunens personal i Vårdkällan?', [
    ['a', 'Patientens hela journal.'],
    ['b', 'Den samordnade planeringen som delas med kommunen, inte journalen.'],
    ['c', 'Ingenting.'],
  ], 'b', 'Kommunen är en simulerad part i demon och ser bara den samordnade planeringen.', '#/samverkan'),
  o('ledningsansvar', ['verksamhetschef'], 'Vilket ansvar kan du som verksamhetschef inte lämna över?', [
    ['a', 'Inget, allt kan lämnas över.'],
    ['b', 'Det samlade ledningsansvaret för läkemedel. Enskilda uppgifter kan uppdras åt andra, och systemet påminner när ett uppdrag saknas.'],
    ['c', 'Ansvaret för läkemedelsmallarna.'],
  ], 'b', 'Gröna häftet 1.3: ledningsansvaret kan inte överlåtas, men uppdrag som medicinskt ansvarig läkare kan utses.', '#/lakemedelsansvar'),
  o('intyg', ['verksamhetschef'], 'Hur ser du vilka på vårdenheten som har giltigt intyg?', [
    ['a', 'Du frågar var och en.'],
    ['b', 'Under Utbildning. Systemet vet vilka som arbetar på vårdenheten, räknar giltigheten och visar vilka som går ut inom 30 dagar.'],
    ['c', 'Det går inte att se.'],
  ], 'b', 'Intyget gäller i ett år. Systemet räknar själv vilka som har giltigt intyg.', '#/utbildning'),
  // Runda 7: ekonomen (r3) och systemförvaltaren (r4) fick egna övningar när delarna slogs ihop.
  o('ekonomi-underlag', ['ekonom'], 'Ekonomisystemet behöver förra månadens faktureringsunderlag för en vårdenhet. Hur tar du fram det?', [
    ['a', 'Ber vårdenheten registrera alla besök och åtgärder i en lista.'],
    ['b', 'Hämtar underlaget för vårdenheten och månaden som fil. Systemet har redan skapat posterna ur det som har hänt och räknat priserna och betalningsmottagarna.'],
    ['c', 'Läser journalerna och räknar själv.'],
  ], 'b', 'Systemet skapar faktureringsunderlaget av sig självt ur vårdkontakter, åtgärder, läkemedel och hjälpmedel. Ekonomen läser aldrig journalen, och varje export loggas på patienterna i underlaget.', '#/ekonomi'),
  o('fyra-ogon', ['systemforvaltare'], 'Du har föreslagit en ändring av en regel. När börjar den gälla?', [
    ['a', 'Direkt när du sparar den.'],
    ['b', 'När en annan systemförvaltare har godkänt den, från det giltighetsdatum som står i förslaget.'],
    ['c', 'När du själv har godkänt den.'],
  ], 'b', 'Fyra ögon: ingen godkänner sina egna ändringar. Systemet visar effekten i förväg, kontrollerar att värdet är rimligt och sparar historiken, som inte går att ändra.', '#/regler'),
];
