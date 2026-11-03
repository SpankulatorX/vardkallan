// Klickbudget per vanligt arbetsflöde (D6). Budgetarna sätts här och mäts av test/klickbudget.cjs, som gör flödena
// i gränssnittet i Playwright och skriver resultatet till klickbudget.json. Testet misslyckas om ett flöde kräver
// fler steg än budgeten.
//
// Så räknas det:
//   klick      varje musklick på en knapp, länk, kryssruta eller rad. En rullgardinslista räknas som två klick
//              (öppna och välja), utom när rätt värde redan är förvalt och inte behöver röras.
//   fältbyte   varje gång användaren måste flytta sig till ett textfält. Ett fält som gränssnittet redan har satt
//              fokus i räknas inte. Texten som skrivs räknas inte tecken för tecken.
//   tangent    tangenter som inte är text, till exempel Enter för att skicka en sökning.
//
// Budgeten är antalet steg som flödet behöver: ett steg för att komma dit, ett fältbyte för varje fält som måste
// fyllas i, två klick för en lista som måste ändras och ett klick för att spara eller bekräfta. Obligatoriska fält
// (ordinationsorsak, uppföljningsdatum, syfte vid nödåtkomst) räknas med. De går inte att spara bort, eftersom
// lagen eller NLL kräver dem. Budgeten är alltså ett tak som gränssnittet ska klara, inte ett mål att trimma mot.
// Mätningen görs med ett skript, inte med verkliga användare.

export const REGLER = 'Klick på knappar, länkar och rader räknas. En rullgardinslista som måste ändras räknas som två klick. Varje flytt till ett textfält räknas som ett fältbyte, utom när fältet redan har fokus. Text som skrivs räknas inte tecken för tecken. Tangenter som Enter räknas.';

export const FLODEN = [
  {
    id: 'oppna-patient', namn: 'Öppna patient från arbetslistan', roll: 'lak-kard', start: 'Arbetslistan efter inloggning', budget: 1,
    motivering: 'Ett klick på patientens namn. Översikten med läkemedel, diagnoser, mätvärden och senaste anteckningar ska synas direkt, utan flikbyte.',
  },
  {
    id: 'las-anteckning', namn: 'Läsa senaste anteckning', roll: 'lak-kard', start: 'Patientens översikt', budget: 1,
    motivering: 'Ett klick på den senaste anteckningen i översikten, som då visas i sin helhet.',
  },
  {
    id: 'daganteckning', namn: 'Skriva och signera en daganteckning', roll: 'lak-kard', start: 'Patientens översikt', budget: 4,
    motivering: 'Ett klick för att öppna en ny anteckning, ett fältbyte för vart och ett av de två sökord som skrivs (Aktuellt och Bedömning) och ett klick för att signera. Mallen Daganteckning och den pågående vårdkontakten ska vara förvalda.',
  },
  {
    id: 'ordinera', namn: 'Ordinera ett läkemedel utan varning', roll: 'lak-kard', start: 'Patientens översikt', budget: 7,
    motivering: 'Ett klick för att öppna ordinationen, ett fältbyte till sökfältet och ett klick på träffen, ett fältbyte vardera för dosering och ordinationsorsak, ett klick för uppföljningsdatum och ett för att spara. Utan varningar ska kontroll och sparande ske med samma klick.',
  },
  {
    id: 'utsattning', namn: 'Sätta ut ett läkemedel', roll: 'lak-kard', start: 'Patientens översikt', budget: 4,
    motivering: 'Ett klick till läkemedelslistan, ett på Sätt ut för raden, ett fältbyte för den obligatoriska orsaken och ett klick för att bekräfta.',
  },
  {
    id: 'uppmarksamhet', namn: 'Bekräfta föreslagen uppmärksamhetsinformation', roll: 'lak-kard', start: 'Patientens översikt', budget: 1,
    motivering: 'Systemet har själv hittat Waran i läkemedelslistan och föreslår antikoagulantiabehandling som uppmärksamhetsinformation. Förslaget visas under patienthuvudet, och ett klick på Bekräfta registrerar det. Inget skrivs in, och kategori, kod och källa sätts av systemet.',
  },
  {
    id: 'blodtryck', namn: 'Registrera blodtryck', roll: 'ssk-kard', start: 'Patientens översikt', budget: 3,
    motivering: 'Ett klick till mätvärdena, ett fältbyte för värdet och ett klick för att registrera. Blodtryck är det vanligaste mätvärdet och ska vara förvalt, så att listan inte behöver ändras.',
  },
  {
    id: 'remiss', namn: 'Skicka remiss', roll: 'lak-vc', start: 'Patientens översikt', budget: 7,
    motivering: 'Ett klick till remisserna och ett för att öppna en ny remiss, två klick för att välja mottagare i listan, ett fältbyte vardera för frågeställning och anamnes och ett klick för att skicka. Prioritet och sista svarsdatum ska ha rimliga förval.',
  },
  {
    id: 'kvittera-svar', namn: 'Kvittera remissvar', roll: 'lak-vc', start: 'Arbetslistan efter inloggning', budget: 3,
    motivering: 'Ett klick till inkorgen, ett på svaret, som då visas i sin helhet, och ett för att kvittera att svaret är läst. Svaret ska läsas före kvittensen, så kvittensen ligger inte direkt i inkorgen.',
  },
  {
    id: 'nodatkomst', namn: 'Nödåtkomst', roll: 'lak-akut', start: 'Arbetslistan efter inloggning', budget: 8,
    motivering: 'Ett klick till sök, ett fältbyte och Enter för sökningen, ett klick på träffen, ett på Nödåtkomst, ett för syftet, ett för intyget att patienten inte kan samtycka och ett för att öppna. Syfte och intyg krävs och ska inte gå att hoppa över.',
  },
  {
    id: 'reservnummer', namn: 'Registrera patient utan känd identitet', roll: 'lak-akut', start: 'Arbetslistan efter inloggning', budget: 5,
    motivering: 'Sussa 3.1.1. Ett klick till sök och ett på Registrera ny patient, ett klick för kön, ett fältbyte för ungefärlig ålder och ett klick för att registrera. Identitetsfältet lämnas tomt, så skapar systemet reservnumret själv. Ingen typ av nummer väljs i en lista, och namnet kan saknas.',
  },
  {
    id: 'sla-samman', namn: 'Slå samman en dubblett', roll: 'adm-kard', start: 'Arbetslistan efter inloggning', budget: 4,
    motivering: 'Sussa 3.1.1.2. Systemet har själv hittat dubbletten. Ett klick till inkorgen, ett på förslaget, som visar journalerna sida vid sida, ett på Slå samman journalerna och ett för att bekräfta. Vilken journal som blir kvar avgör systemet.',
  },
  // Vårdkontakt, vårdtillfälle och hälsoärende (Sussa 3.4.4, 6.1.1). Ingen behöver välja en vårdkontakt för att dokumentera.
  {
    id: 'halsoarende', namn: 'Bekräfta ett hälsoärende', roll: 'lak-kard', start: 'Patientens översikt', budget: 1,
    motivering: 'Ett klick på Bekräfta i systemets förslag. Systemet har redan sett att kontakterna har samma diagnos och vilka kontakter som hör ihop.',
  },
  {
    id: 'inskrivning', namn: 'Skriva in en patient', roll: 'ssk-kard', start: 'Översikten för en patient på mottagningen', budget: 4,
    motivering: 'Ett klick på Skriv in, ett fältbyte vardera för orsaken och för sal och säng, och ett klick för att skriva in. Avdelningen är förvald, och orsaken fylls i när patienten kommer från akuten eller med en remiss.',
  },
  {
    id: 'flytta', namn: 'Flytta en patient till en annan avdelning', roll: 'ssk-kard', start: 'Patientens översikt', budget: 5,
    motivering: 'Ett klick på Flytta, två klick för att välja avdelning i listan, ett fältbyte för sal och säng och ett klick för att flytta. Vårdtillfället och allt som är dokumenterat följer med, så inget registreras om.',
  },
  {
    id: 'utskrivning', namn: 'Skriva ut en patient', roll: 'ssk-kard', start: 'Översikten för en inlagd patient', budget: 2,
    motivering: 'Ett klick på Skriv ut och ett för att bekräfta. Systemet kontrollerar själv osignerade anteckningar och epikris och säger vad som återstår.',
  },
  {
    id: 'registrera-besok', namn: 'Registrera ett besök', roll: 'adm-kard', start: 'Översikten för en remitterad patient', budget: 3,
    motivering: 'Ett klick på Registrera vårdkontakt och ett för att registrera. Besök, nu och mottagningen är förvalda och kontaktorsaken kommer från remissen. Ett fältbyte räknas med för orsaken när systemet inte kan föreslå den.',
  },
  {
    id: 'planera-video', namn: 'Planera ett videobesök', roll: 'adm-kard', start: 'Översikten för en remitterad patient', budget: 5,
    motivering: 'Ett klick på Registrera vårdkontakt, ett på Video, ett på Planerad och ett för att registrera. Tiden är förvald till nästa vardag klockan 9. Ett fältbyte räknas med för att ändra tiden.',
  },
  // Utskrift och kontrasignering (Sussa 3.1.9 och 3.1.11.3). Systemet föreslår syftet, delarna och vem som kontrasignerar.
  {
    id: 'utskrift', namn: 'Skriva ut läkemedelslistan vid utskrivning', roll: 'lak-kard', start: 'Patientens översikt', budget: 2,
    motivering: 'Sussa 3.1.9. Ett klick på Skriv ut och ett för att skriva ut. Patienten är inlagd, så systemet föreslår syftet Läkemedelslista till patienten vid utskrivning, väljer läkemedelslistan och registrerar att kopian lämnas ut till patienten. Utskriften får ett utskrifts-id och loggas.',
  },
  {
    id: 'begar-kontrasignering', namn: 'Begära kontrasignering av en anteckning', roll: 'lak-kard', start: 'Patientens översikt', budget: 3,
    motivering: 'Sussa 3.1.11.3. Ett klick på den senaste anteckningen, ett på Begär kontrasignering och ett för att skicka. Systemet föreslår överläkaren på samma vårdenhet som får läsa anteckningen, och aldrig den som signerade.',
  },
  {
    id: 'kontrasignera', namn: 'Kontrasignera en anteckning', roll: 'lak-kard', start: 'Arbetslistan efter inloggning', budget: 3,
    motivering: 'Sussa 3.1.11.3. Ett klick till inkorgen, ett på begäran, som öppnar anteckningen i sin helhet, och ett på Kontrasignera. Anteckningen ska läsas före kontrasigneringen, så knappen ligger inte direkt i inkorgen.',
  },
];
