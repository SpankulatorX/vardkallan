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
    motivering: 'Ett klick för att öppna ordinationen, ett fältbyte till sökfältet och ett klick på träffen, ett fältbyte vardera för dosering och ordinationsorsak, ett klick för uppföljningsdatum och ett för att spara. Utan varningar ska kontroll och sparande ske med samma klick. Systemet föreslår dosering, tider och uppföljning ur produkten och patienten (Sussa 3.5.1.3), så doseringen behöver bara skrivas när förslaget inte passar.',
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
  // Läkemedelsprocessen (Sussa 3.5.2). Systemet räknar fram dagens doser och kontrollerar dem innan något sparas.
  {
    id: 'ge-dos', namn: 'Ge en dos', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning', budget: 2,
    motivering: 'Sussa 3.5.2.18. Ett klick till Läkemedel att ge och ett på Ge för dosen. Systemet har räknat fram dagens doser ur ordinationerna och kontrollerat dosen mot ordinationen och tidigare doser, och tiden, vem som gav den och vårdkontakten sätts av systemet. En varning för dubbel dos eller för tidig dos visas först när den gäller.',
  },
  {
    id: 'vidimera', namn: 'Vidimera pågående ordinationer', roll: 'lak-kard', start: 'Patientens översikt', budget: 2,
    motivering: 'Sussa 3.5.2.9. Ett klick till läkemedelslistan, där systemet visar vad som har ändrats sedan den senaste vidimeringen, och ett klick för att vidimera hela listan.',
  },
  {
    id: 'utsattning-varning', namn: 'Sätta ut ett läkemedel med varning', roll: 'lak-kard', start: 'Patientens översikt', budget: 4,
    motivering: 'Sussa 3.5.2.8. Ett klick till läkemedelslistan, ett på Sätt ut för raden, ett fältbyte för den obligatoriska orsaken och ett klick för att sätta ut trots varningen. Systemet visar varningen och ett förslag på nedtrappning innan något sparas, och orsaken är motiveringen, så inget extra fält behövs.',
  },
  // Säkrare utsättning (runda 5, Sussa 3.5.2.8). Antikoagulantia sätts bara ut med en plan.
  {
    id: 'utsattning-plan', namn: 'Sätta ut Waran med plan', roll: 'lak-kard', start: 'Patientens översikt', budget: 4,
    motivering: 'Sussa 3.5.2.8. Ett klick till läkemedelslistan, ett på Sätt ut för Waran, ett på den plan som gäller och ett på Jag har en plan. Systemet förklarar risken för blodpropp och stroke, föreslår planerna med nytt medel eller datum för återinsättning ifyllt och skriver orsaken ur planen, så inget behöver skrivas.',
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
  // Vem som får ge läkemedel (runda 5, Sussa 3.5.2.18, HSLF-FS 2017:37 9 kap.). Systemet prövar delegeringen för varje dos.
  {
    id: 'ge-dos-delegering', namn: 'Ge en dos med delegering', roll: 'usk-kard', start: 'Arbetslistan efter inloggning', budget: 2,
    motivering: 'Sussa 3.5.2.18. Ett klick till Läkemedel att ge och ett på Ge för dosen. Systemet har kontrollerat att undersköterskans delegering omfattar dosens läkemedelsform och administrationssätt, att den gäller i dag och på vårdenheten, och visar knappen Ge bara för de doserna. Delegeringen sparas med dosen.',
  },
  {
    id: 'registrera-delegering', namn: 'Registrera en delegering', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning', budget: 4,
    motivering: 'Ett klick till Delegeringar, ett på Ny delegering för undersköterskan, ett för intyget att kunskaperna är kontrollerade och ett för att registrera. Systemet föreslår samma omfattning som den nuvarande delegeringen, giltighet från i dag i ett år och uppföljningen, och påminner i inkorgen 30 dagar innan den går ut.',
  },
  // Tidbok, väntelista, kallelser och incheckning (Sussa 3.4.1 till 3.4.4). Systemet föreslår tiderna och skriver
  // kallelserna, så ingen behöver leta i en kalender.
  {
    id: 'boka-remiss', namn: 'Boka tid för en remiss', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 2,
    motivering: 'Ett klick på Boka tid vid remissen och ett på den tid som systemet föreslår först. Tidstyp, yrkesroll, gränsen mot vårdgarantin och tidigare vårdgivare har systemet redan tagit hänsyn till, och kallelsen går ut av sig själv.',
  },
  {
    id: 'checka-in', namn: 'Checka in en patient', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 1,
    motivering: 'Ett klick på Checka in i raden för patienten. Ankomsten registreras på den planerade vårdkontakten och avgiften visas, räknad av systemet.',
  },
  {
    id: 'gruppkallelse', namn: 'Skicka en gruppkallelse', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 3,
    motivering: 'Ett klick på Skicka kallelser för gruppträffen och ett för att bekräfta. Systemet har skrivit kallelserna och väljer kanal för varje deltagare. Ett klick räknas med för att granska en kallelse.',
  },
  {
    id: 'omboka', namn: 'Boka om en tid', roll: 'adm-kard', start: 'Översikten för en patient med bokad tid', budget: 2,
    motivering: 'Ett klick på Boka om och ett på den tid som systemet föreslår. Samma tidstyp och samma vårdgivare kommer först, och patienten får en ny kallelse utan att någon ber om det.',
  },
  {
    id: 'egen-ombokning', namn: 'Patienten bokar om sin tid i Min journal', roll: 'inv-p14', start: 'Min journal för en patient med bokad tid', budget: 3,
    motivering: 'Ett klick på fliken Tider, ett på Boka om och ett på den föreslagna tiden. Systemet visar bara tider av samma typ, minst 24 timmar fram, och skickar den nya kallelsen.',
  },
  // Runda 5, r1: läkaren sätter upp ett återbesök som systemet föreslår (Sussa 3.4.1.1).
  {
    id: 'aterbesok', namn: 'Sätta upp ett återbesök', roll: 'lak-kard', start: 'Patientens översikt', budget: 2,
    motivering: 'Sussa 3.4.1.1. Ett klick på Återbesök och ett för att bekräfta systemets förslag. Systemet har läst tidstyp, yrkesroll och tidsram ur anteckningens planering, diagnosen och den senaste kontakten, och posten hamnar på väntelistan och i vårdadministratörens Dagens arbete.',
  },
  // Runda 5, r4: systemet bevakar datumet för återinsättning efter ett uppehåll med antikoagulantia (Sussa 3.5.2.8).
  {
    id: 'aterinsattning', namn: 'Sätta in Waran igen efter ett uppehåll', roll: 'lak-kard', start: 'Arbetslistan dagen före en återinsättning', budget: 3,
    motivering: 'Sussa 3.5.2.8. Ett klick till inkorgen, ett på Sätt in igen för raden som systemet har lagt dit dagen före och ett för att spara. Systemet fyller i läkemedlet, doseringen, ordinationsorsaken och uppföljningen ur den ordination som gjorde uppehåll, så inget behöver skrivas, och raden försvinner när läkemedlet är insatt.',
  },
  {
    id: 'avsluta-aterinsattning', namn: 'Avsluta behandlingen efter ett uppehåll', roll: 'lak-kard', start: 'Arbetslistan dagen före en återinsättning', budget: 3,
    motivering: 'Sussa 3.5.2.8. Ett klick till inkorgen, ett på Avslutad behandling för raden och ett för att avsluta. Systemet föreslår orsaken och har den vanligaste förvald, sparar vem och när, och raden försvinner för alla som har fått den.',
  },
  // Runda 5, r4: en avvisning som avbokar en vårdhändelse frågar om läkemedlet i samma dialog (Sussa 3.5.2.7).
  {
    id: 'avvisa-remiss-satt-ut', namn: 'Avvisa en remiss och sätta ut läkemedlet', roll: 'lak-kard', start: 'Inkommande remisser med en vårdhändelse som väntar', budget: 4,
    motivering: 'Sussa 3.5.2.7. Ett klick på Bedöm, ett på Avvisa, ett fältbyte för motiveringen och ett för att spara. När Avvisa väljs visar systemet att tiden för vårdhändelsen avbokas och vilket läkemedel som väntar på den, med Sätt ut förvalt och orsaken ifylld, så beslutet fattas medan läkaren har åtkomst.',
  },
  // Runda 6, r3: vårdplaner och psykiatrisk tvångsvård (Sussa 3.2.2.1 och 3.2.3.1).
  {
    id: 'vardplan', namn: 'Sätta upp en standardvårdplan', roll: 'lak-kard', start: 'Patientens översikt', budget: 3,
    motivering: 'Sussa 3.2.2.1. Ett klick på Sätt upp vårdplanen vid systemets förslag och ett för att upprätta planen. Systemet har valt standardplanen ur diagnosen och fyllt i mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, så inget fält behöver fyllas i.',
  },
  {
    id: 'intagningsbeslut', namn: 'Registrera ett intagningsbeslut', roll: 'lak-psyk', start: 'Översikten för en patient som väntar på beslut om intagning', budget: 4,
    motivering: 'Sussa 3.2.3.1. Ett klick på Besluta om intagning, ett för att bekräfta undersökningen och bedömningen enligt 3 § LPT och ett för att besluta. Systemet har kontrollerat vårdintyget, vem som utfärdade det, uppdraget enligt 39 § och fristen på 24 timmar, räknar fristen för ansökan till förvaltningsrätten och skriver in patienten.',
  },
  // Runda 6, r1: sökning i journalen (Sussa 3.1.8) och NEWS2 (Sussa 3.1.3.5 och 3.1.3.9).
  {
    id: 'sok-journal', namn: 'Söka i journalen och öppna träffen', roll: 'lak-kard', start: 'Patientens översikt', budget: 3,
    motivering: 'Sussa 3.1.8.1. Ett fältbyte till sökfältet ovanför flikarna, Enter för att söka och ett klick på träffen. Systemet tolkar ordet blodtryck som mätvärdet, söker i allt läkaren får läsa och öppnar kurvan för blodtrycket.',
  },
  {
    id: 'news2', namn: 'Registrera en NEWS2-kontroll', roll: 'ssk-kard', start: 'Patientens översikt', budget: 8,
    motivering: 'Sussa 3.1.3.5 och 3.1.3.9. Ett klick till Mätvärden och ett på Registrera NEWS2-kontroll, där andningsfrekvensen redan har fokus, ett fältbyte vardera för syremättnad, blodtryck, puls och temperatur, ett klick för medvetandegraden och ett för att registrera. Luft är förvalt, tiden och vårdkontakten sätter systemet, och systemet räknar poängen och säger vad som ska göras.',
  },
  // Runda 6, r2: läkemedelsprocessen, del 2 (Sussa 3.5.1.3, 3.5.2.14 och 3.5.2.2).
  {
    id: 'ordinera-mall', namn: 'Ordinera från en mall med flera ordinationer', roll: 'lak-kard', start: 'Patientens läkemedelsflik', budget: 3,
    motivering: 'Sussa 3.5.1.3 och 3.5.2.14. Ett klick på Ordinera från mall, ett på mallen och ett för att ordinera. Systemet fyller i varje ordination ur produktens mall och patientens ålder och njurfunktion, varnar per ordination, tar själv bort ett läkemedel som patienten redan har och förklarar varför, och knyter ordinationerna till samma vårdhändelse.',
  },
  {
    id: 'dos-efterhand', namn: 'Registrera en dos i efterhand', roll: 'ssk-kard', start: 'Läkemedel att ge efter återställning', budget: 3,
    motivering: 'Sussa 3.5.2.2. Ett klick på Mer för dosen, ett på Given tidigare och ett för att registrera. Systemet föreslår tiden, aldrig i framtiden, kontrollerar den mot ordinationen och tidigare doser och visar att registreringen gjordes i efterhand.',
  },
  // Runda 6, r6: ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar (Gröna häftet 1.4.2 och 1.4.3).
  {
    id: 'utse-mal', namn: 'Utse en medicinskt ansvarig läkare', roll: 'vch-kard', start: 'Verksamhetschefens startsida', budget: 3,
    motivering: 'Gröna häftet 1.3 och 1.4.2. Påminnelsen om att uppdraget saknas står först på verksamhetschefens startsida med systemets förslag (den som hade uppdraget senast). Ett klick på Utse och ett för att bekräfta. Systemet fyller i perioden, ett år, och omfattningen ur häftet och prövar att läkaren arbetar på vårdenheten och har kompetensen. Budgeten har plats för ett klick till.',
  },
  {
    id: 'godkanna-mall', namn: 'Godkänna en ändrad läkemedelsmall', roll: 'lak-kard', start: 'Inkorgen efter återställning', budget: 2,
    motivering: 'Sussa 3.5.1.3 och Gröna häftet 1.4.3. Den ändrade mallen ligger i den mallansvariga läkarens inkorg. Ett klick på Granska, som visar innehållet och vad som har ändrats mot den förra versionen, och ett på Godkänn. Systemet ersätter den förra versionen och sparar godkännandet med innehållet.',
  },
  // Runda 6, r5: en extern tillämpning startas från journalen med SMART on FHIR (Sussa 5.1.1.4).
  {
    id: 'extern-tillampning', namn: 'Starta en extern tillämpning från journalen', roll: 'lak-kard', start: 'Patientens översikt', budget: 2,
    motivering: 'Sussa 5.1.1.4. Ett klick på fliken Tillämpningar och ett på Starta för Blodtryck över tid. Systemet ger tillämpningen patienten och den inloggade och sköter åtkomsten med SMART on FHIR och PKCE, så ingen behöver välja patient eller logga in igen.',
  },
  // Runda 6, r4: ingrepp med lokal och utrustning, och tider i följd (Sussa 3.4.1.2, 3.4.1.4, 3.4.1.5 och 3.4.2.2).
  {
    id: 'boka-ingrepp', namn: 'Boka elkonvertering med rum och utrustning', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 3,
    motivering: 'Sussa 3.4.1.2, 3.4.1.5 och 3.4.2.2. Ett klick på Boka tid vid elkonverteringen på väntelistan och ett på den tid som systemet föreslår först. Systemet föreslår bara tider då läkaren, ett behandlingsrum och defibrillatorn är lediga, bokar dem samtidigt och bokar sjukresan när patienten behöver den. Ett klick räknas med för att visa fler förslag.',
  },
  {
    id: 'boka-kedja', namn: 'Boka provtagning före läkarbesök', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 3,
    motivering: 'Sussa 3.4.1.4 och 3.4.2.2. Ett klick på Boka tid vid återbesöket och ett på det förslag som systemet visar först. Systemet föreslår läkarbesöket och provtagningen samma dag med rätt mellanrum, bokar båda och skickar en kallelse som säger när provtagningen är. Ett klick räknas med för att visa fler förslag.',
  },  // Runda 7, r5: rapportering till myndigheter och register (Sussa 6.3.2.2 och avtalets tillägg 2020).
  {
    id: 'rapport-par', namn: 'Granska och skicka månadens rapport till patientregistret', roll: 'uppf', start: 'Rapporteringssidan efter återställning', budget: 3,
    motivering: 'Sussa 6.3.2.2. Systemet har redan sammanställt rapporten ur vårdtillfällena, vårdkontakterna, diagnoserna och åtgärderna och kontrollerat den mot Socialstyrelsens filspecifikation. Ett klick på Granska, som visar felen, det som inte rapporteras och filerna, ett på Skicka och ett för att bekräfta. Kontakter med fel hålls kvar och följer med av sig själv nästa månad, så att ingen behöver komma ihåg dem.',
  },
  // Runda 7, r7: kravsidan visar vad Sussa värderade högst och som Vårdkällan ännu inte uppfyller (K2).
  {
    id: 'kravviktning', namn: 'Visa de tio högst viktade kriterierna som inte är uppfyllda', roll: 'adm-kard', start: 'Kravsidan', budget: 2,
    motivering: 'K2. Ett klick på genvägen ovanför filtren, som väljer utvärderingskriterier som inte är uppfyllda i demon, sorterar dem efter vikten i Sussas utvärdering och visar de tio första med vikt och signaler från avtalet. Budgeten har plats för ett klick till.',
  },
  // Runda 7, r3: faktureringsunderlaget för en månad (Sussa 7.1.1.1 och 7.1.1.2).
  {
    id: 'exportera-underlag', namn: 'Exportera faktureringsunderlag för en månad', roll: 'eko', start: 'Ekonomens startsida', budget: 3,
    motivering: 'Sussa 7.1.1.1 och 7.1.1.2. Ett klick på CSV för vårdenheten. Systemet har redan skapat posterna ur det som har hänt, räknat priserna ur prislistan och betalningsmottagarna, och förra månaden är förvald eftersom den är avslutad. Budgeten har plats för att välja en annan månad i listan.',
  },
  {
    id: 'lamna-ut-hjalpmedel', namn: 'Lämna ut ett hjälpmedel', roll: 'ssk-kard', start: 'Patientens översikt', budget: 3,
    motivering: 'Sussa 7.1.1.1 och 3.4.4.4. Ett klick på Lämna ut hjälpmedel i kostnadsrutan och ett på hjälpmedlet. Systemet tar hjälpmedlen ur vårdenhetens prislista, knyter utlämningen till den pågående vårdkontakten och skapar posten och hjälpmedelsavgiften i faktureringsunderlaget. Budgeten har plats för ett klick till.',
  },
  // Runda 7, r4: systemförvaltningen (Sussa 12.1.1.1, 12.1.1.3 till 12.1.1.6).
  {
    id: 'forbered-namnbyte', namn: 'Förbereda ett namnbyte för en enhet', roll: 'sysf', start: 'Omorganisationen efter återställning', budget: 4,
    motivering: 'Sussa 12.1.1.1 och 12.1.1.4. Ett klick på Ändra vid enheten, där namnbyte är förvalt och det nuvarande namnet är markerat så att det nya skrivs direkt, och ett klick på Förbered. Systemet föreslår datumet (första dagen i nästa månad), förhandsvisar medan man skriver vad som påverkas, kontrollerar att namnet inte redan finns och genomför bytet själv på dagen. Budgeten har plats för att ändra datumet.',
  },
  {
    id: 'andra-demoregel', namn: 'Ändra en demoregel', roll: 'sysf', start: 'Reglerna efter återställning', budget: 3,
    motivering: 'Sussa 12.1.1.3, 12.1.1.5 och 12.1.1.6. Ett klick på Ändra vid regeln, där det nuvarande värdet är markerat så att det nya skrivs direkt, ett fältbyte till den obligatoriska motiveringen och ett klick på Skicka för godkännande. Systemet föreslår att ändringen gäller från i morgon, visar effekten och förklarar direkt om värdet inte är rimligt. En annan systemförvaltare godkänner ändringen (fyra ögon).',
  },
  // Runda 7, r6: tillväxt i barnhälsovården (Sussa 4.1.1.4 och 4.1.1.6).
  {
    id: 'tillvaxt-bhv', namn: 'Registrera längd och vikt vid ett BHV-besök och se kurvan', roll: 'ssk-vc', start: 'Översikten för ett barn på barnavårdscentralen', budget: 4,
    motivering: 'Sussa 4.1.1.4 och 4.1.1.6. Ett klick på fliken Tillväxt, där vikten redan har fokus, ett fältbyte till längden och ett klick för att registrera. Systemet sätter tid, vårdkontakt och kod, räknar BMI, SD och percentil och ritar kurvan direkt. Ett steg räknas med för huvudomfånget, som mäts vid de flesta besök det första året.',
  },
  // Runda 8, r4: dosändring i en pågående ordination (Sussa 3.5.2.11 och 3.5.2.12, testfall 1.1).
  {
    id: 'andra-dos', namn: 'Ändra dosen i en pågående ordination', roll: 'lak-kard', start: 'Patientens översikt', budget: 4,
    motivering: 'Sussa 3.5.2.12 och testfall 1.1. Ett klick till läkemedelslistan, ett på Ändra dos för raden, ett på den nya styrkan, där systemet fyller i doseringen och dosen, och ett för att spara. Ordinationen fortsätter med samma orsak och uppföljning, utan att sättas ut och ordineras på nytt, och den nya doseringen gäller från i dag om inget annat datum väljs.',
  },
  // Runda 7, r2: nyhetsrutan efter en ny version (Sussa 10.1.1.4).
  {
    id: 'nyheter', namn: 'Läsa nyheterna och stänga dem', roll: 'lak-kard', start: 'Arbetslistan med nyheterna efter en ny version', budget: 1,
    motivering: 'Sussa 10.1.1.4. Nyheterna för rollen visas själva efter en ny version, utan att användaren behöver leta, och läses där de står. Ett klick på Stäng nyheterna, och de kommer inte tillbaka förrän nästa version.',
  },
  // Runda 8, r3: fri bokning, teambesök, gruppträff och avdelningens planering (Sussa 3.4.1, 3.4.2 och testfall 5.1 till
  // 5.3 och 7.1).
  {
    id: 'boka-fri', namn: 'Boka en patient fritt', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 4,
    motivering: 'Sussa 3.4.2.2 och testfall 5.1. Ett klick på Boka besök, där sökfältet har fokus, och Enter. Med en enda träff väljer systemet patienten och visar besökstyp, vårdgivare och de lämpligaste tiderna, och ett klick på en tid bokar den, skapar vårdkontakten och skickar kallelsen. Budgeten har plats för att välja patienten bland flera träffar.',
  },
  {
    id: 'boka-team', namn: 'Boka ett teambesök', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 5,
    motivering: 'Sussa 3.4.1.5 och testfall 5.2. Ett klick på Boka teambesök, där sökfältet har fokus, och Enter. Systemet föreslår teamet och tider då alla och ett rum är lediga hela besöket, och ett klick bokar allt och skickar kallelsen. Budgeten har plats för att ändra teamet med två klick.',
  },
  {
    id: 'grupp-lagg-till', namn: 'Lägga till en patient i en gruppträff', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 3,
    motivering: 'Testfall 5.3. Ett klick på Lägg till patient vid gruppträffen, där sökfältet har fokus, Enter och ett klick på träffen. Systemet bokar platsen, skriver kallelsen och räknar platserna kvar, och när träffen är full sätter det patienten på gruppens väntelista.',
  },
  {
    id: 'avdelningens-handelser', namn: 'Överblicka dagens händelser på avdelningen', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning', budget: 1,
    motivering: 'Sussa 3.4.1.6 och testfall 7.1. Ett klick på Avdelningens planering i arbetslistan. Vyn visar allt som är planerat för avdelningens patienter i dag i tidsordning: uppgifter, läkemedel att ge och bokade tider, med vem som ansvarar.',
  },
  // Runda 7, r2: varningen före utloggningen (bilaga K2 1.6.1, justerbar tidsgräns).
  {
    id: 'forlang-inloggning', namn: 'Fortsätta arbeta när inloggningen snart går ut', roll: 'lak-kard', start: 'Arbetslistan när inloggningen snart går ut', budget: 1,
    motivering: 'K2 1.6.1. Fem minuter före utloggningen visar systemet en varning med fokus på knappen Fortsätt arbeta. Ett klick, eller Enter, förlänger inloggningen. Inget behöver skrivas.',
  },
  // Runda 8, r5: tobaksvanorna, epikrisen och flera mätvärden på en gång (Sussas tema 4).
  {
    id: 'tobaksvanor', namn: 'Fylla i tobaksmallen i en anteckning', roll: 'lak-kard', start: 'Patientens översikt', budget: 4,
    motivering: 'Sussa testfall 4.1. Ett klick på Dokumentera tobaksvanor i översikten, ett klick på Dagligen för cigaretter, som flyttar fokus till antalet och sätter svaret Ja själv, ett klick på Erbjudet och accepterat för det stöd som systemet föreslår och ett klick för att signera. Systemet räknar ut åtgärden och KVÅ-koden ur svaren och patientens ålder.',
  },
  {
    id: 'epikris', namn: 'Skriva och signera en epikris', roll: 'lak-kard', start: 'Översikten för en inlagd patient', budget: 3,
    motivering: 'Sussa testfall 4.3. Ett klick på Skriv epikris vid vårdtillfället. Systemet har skrivit orsaken till vården ur vårdtillfället och diagnoserna och läkemedelsförändringarna ur ordinationerna, och fokus står i Förlopp. Ett fältbyte till Uppföljning och ett klick för att signera.',
  },
  {
    id: 'grundmatningar', namn: 'Registrera längd, vikt, blodtryck och puls', roll: 'ssk-kard', start: 'Patientens översikt', budget: 6,
    motivering: 'Sussa testfall 4.2. Ett klick på Registrera mätvärde och ett på formuläret för flera värden, där längden har fokus, ett fältbyte vardera för vikt, blodtryck och puls och ett klick för att registrera. Tiden och vårdkontakten sätter systemet, och BMI räknas själv.',
  },
  // Runda 8, r2: remiss på uppdrag, fördelning till en namngiven läkare och pappersremiss (Sussa 3.3.1.2 till 3.3.1.5).
  {
    id: 'remiss-pa-uppdrag', namn: 'Skriva en remiss på uppdrag av en läkare', roll: 'adm-kard', start: 'Patientens översikt', budget: 6,
    motivering: 'Sussa 3.3.1.4 och testfall 2.2. Ett klick på Remiss på uppdrag, där mottagaren har fokus, två klick för att välja mottagare i listan, ett fältbyte vardera för frågeställning och anamnes och ett klick för att skicka till läkaren. Systemet föreslår uppdragsgivaren ur patientens tider och vårdkontakter och fyller i prioritet och sista svarsdatum. Remissen skickas när läkaren har signerat den i inkorgen.',
  },
  {
    id: 'fordela-remiss', namn: 'Fördela en remiss till en läkare', roll: 'adm-kard', start: 'Inkommande remisser efter återställning', budget: 2,
    motivering: 'Sussa 3.3.1.5 och testfall 2.3 och 2.4. Ett klick på Fördela och ett på läkaren. Systemet föreslår bakjouren först, visar hur många remisser varje läkare har att bedöma och kvitterar mottagningen.',
  },
  {
    id: 'registrera-pappersremiss', namn: 'Registrera en pappersremiss', roll: 'adm-kard', start: 'Inkommande remisser efter återställning', budget: 6,
    motivering: 'Sussa 3.3.1.2 och testfall 2.5. Ett klick på Registrera vid den inskannade remissen, där patientfältet har fokus och systemet väljer patienten när sökningen ger en träff, ett fältbyte vardera för avsändande enhet, frågeställning och anamnes och ett klick för att registrera. Remissdatumet är förvalt till i dag, och budgeten har plats för att ändra det.',
  },
  // Runda 8, r1: beställning och svar (Sussa 4.4.2.6 och testfall 3.1 och 3.3).
  {
    id: 'bestall-paket', namn: 'Beställa ett standardpaket med prover', roll: 'lak-kard', start: 'Arbetslistan efter inloggning', budget: 3,
    motivering: 'Sussa 4.4.2.6 och testfall 3.1. Ett klick på patienten, ett på Beställ prover i översikten och ett på Beställ vid det paket som systemet föreslår ur vårdkontakten, diagnoserna och läkemedlen. Systemet väljer laboratorium, rör, provtagningsordning och anamnes, tar bort analyser som nyss är tagna och förklarar varför, och knyter beställningen till vårdkontakten.',
  },
  {
    id: 'registrera-provtagning', namn: 'Registrera provtagning', roll: 'ssk-kard', start: 'Provtagningen efter återställning', budget: 2,
    motivering: 'Sussa 4.4.2.6 och testfall 3.3. Rören står i provtagningsordning med etiketter, och ett klick på Tagen per rör registrerar provtagningen. Systemet sätter tid och provtagare och skickar proverna till laboratoriet när alla rör är tagna. Patienten har två rör.',
  },
  // Runda 9, r2: medicinteknisk utrustning, godkännande av värden, intensivvården och egna mätningar (Sussa 3.6.1 och 4.6).
  {
    id: 'koppla-monitor', namn: 'Koppla en patientmonitor till patienten', roll: 'ssk-kard', start: 'Patientens mätvärden efter återställning', budget: 2,
    motivering: 'Sussa 3.6.1.5. Med en streckkodsläsare skannas monitorns streckkod i fältet, som är ett fältbyte och Enter. I demon väljs monitorn med ett klick i listan över utrustning på vårdenheten, vilket motsvarar skanningen. Systemet hittar utrustningen, knyter den till patienten och den pågående vårdkontakten och avslutar en tidigare koppling när monitorn flyttas.',
  },
  {
    id: 'godkanna-mt', namn: 'Godkänna värden från monitorn', roll: 'ssk-kard', start: 'Mätvärden med värden från en kopplad monitor', budget: 1,
    motivering: 'Sussa 3.6.1.6. Ett klick på Godkänn vid värdena som väntar. Systemet godkänner alla värden från utrustningen som sjuksköterskan får se på sin vårdenhet, och de räknas sedan i NEWS2, larm och beslutsstöd.',
  },
  {
    id: 'iva-oversikt', namn: 'Öppna intensivvårdens översikt och övervakningen av en patient', roll: 'lak-kard', start: 'Arbetslistan efter inloggning', budget: 2,
    motivering: 'Sussa 4.6.1.2. Ett klick på Intensivvård i menyn och ett på patienten. Översikten har redan räknat larm, förslag, infusioner och vätskebalans för alla patienter på avdelningen, med de mest akuta först.',
  },
  {
    id: 'egen-matning', namn: 'Lämna en egen mätning i Min journal', roll: 'inv-p01', start: 'Min journal för patienten', budget: 3,
    motivering: 'Sussa 3.6.1.7. Ett klick på Egna mätningar, ett fältbyte till värdet och ett klick för att skicka. Blodtryck är förvalt, tiden är nu och systemet väljer själv vårdenheten som tar emot mätningen.',
  },
  // Runda 9, r1: förbrukningsartiklar ur en mall (Sussa 3.5.4.2 och 3.5.4.4).
  {
    id: 'forbrukning-mall', namn: 'Förskriva förbrukningsartiklar ur en mall', roll: 'lak-vc', start: 'Översikten för en patient med insulin', budget: 2,
    motivering: 'Sussa 3.5.4.2 och 3.5.4.4. Ett klick till läkemedelsfliken och ett på Förskriv mallen vid den mall som systemet föreslår ur läkemedelslistan. Systemet väljer pennkanyler, lansetter och kanylburk, tar bort teststickorna som redan är förskrivna, räknar mängden för tre månader ur antalet injektioner och skriver anvisningen, giltigheten och uppföljningen.',
  },
  // Runda 9, r7: streckkodsläsaren och de färdiga patientgrupperna.
  {
    id: 'skanna-armband', namn: 'Öppna patienten genom att skanna armbandet', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning', budget: 2,
    motivering: 'Sussa 3.1.3.6. Fältet Skanna i toppraden tar emot läsaren: ett fältbyte och läsarens Enter. Systemet tolkar koden, prövar behörigheten och öppnar patienten. Utan fältet fångas en skanning också när fokus inte står i ett textfält, och då är det inget steg alls.',
  },
  {
    id: 'patientgrupp', namn: 'Visa en färdig patientgrupp', roll: 'lak-vc', start: 'Arbetslistan efter inloggning', budget: 3,
    motivering: 'Sussa 6.2.1.2. Ett klick på Analys och statistik och ett på Visa gruppen för den färdiga grupp som är förvald. Systemet skriver vad gruppen betyder och varför varje patient är med, och räknar bara på det som läkaren får se.',
  },
  // Runda 10, r7: meddelanden från invånare, kontorsstödet, kapaciteten, kassan och ombudet (Sussa 3.4.1.5, 3.4.2.3,
  // 3.4.4.1, 3.4.4.4, 3.7.1.1, 3.7.1.3 och 5.1.1.1).
  {
    id: 'fornya-recept', namn: 'Förnya ett recept som patienten har bett om i Min journal', roll: 'lak-kard', start: 'Arbetslistan efter inloggning', budget: 3,
    motivering: 'Sussa 3.4.4.4 och 3.7.1.3. Ett klick på Meddelanden, ett på patientens begäran och ett på Receptet är förnyat. Systemet skapar avgiften för förnyelsen och skriver svaret till patienten, så läkaren skriver ingenting.',
  },
  {
    id: 'kalenderprenumeration', namn: 'Lägga in sin tidbok i kalenderprogrammet', roll: 'lak-kard', start: 'Arbetslistan efter inloggning', budget: 2,
    motivering: 'Sussa 5.1.1.1. Ett klick på Kontorsstöd och ett på Skapa kalenderlänk. Länken läggs in som prenumeration i Outlook eller ett annat kalenderprogram, som sedan hämtar tiderna själv varje timme.',
  },
  {
    id: 'svara-meddelande', namn: 'Svara på ett meddelande från en patient och avsluta', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning', budget: 4,
    motivering: 'Sussa 3.7.1.1. Ett klick på Meddelanden, ett på meddelandet, ett fältbyte till svaret och ett klick på Svara och avsluta. Systemet har skickat meddelandet till sjuksköterskan ur vad det gäller och aviserar patienten om svaret.',
  },
  {
    id: 'kapacitetsprognos', namn: 'Se vårdenhetens kapacitet och prognos för väntelistan', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 1,
    motivering: 'Sussa 3.4.1.5. Ett klick på Kapacitet. Systemet har redan räknat lediga tider mot väntelistan och remisserna för tolv veckor, när kön är borta och vilka förslag som behövs.',
  },
  {
    id: 'kassa-avgift', namn: 'Ta betalt för en receptförnyelse i kassan', roll: 'adm-kard', start: 'Vårdadministratörens startsida', budget: 4,
    motivering: 'Sussa 3.4.4.4. Ett klick på Kassa, ett fältbyte till personnumret, ett klick på Registrera avgift och ett på Kort. Förnyelse av recept är förvald, och systemet räknar avgiften ur ålder, LMA-kort och frikort.',
  },
  {
    id: 'dagsavslut', namn: 'Göra dagsavslut i kassan', roll: 'adm-kard', start: 'Kassan', budget: 2,
    motivering: 'Sussa 3.4.4.1. Ett klick på Gör dagsavslut och ett på Stäm av och avsluta. Systemet har räknat kassan per betalsätt och fyllt i terminalens belopp, så kassören skriver något bara när det inte stämmer.',
  },
  {
    id: 'skicka-meddelande', namn: 'Skriva ett meddelande till vården i Min journal', roll: 'inv-p01', start: 'Min journal för patienten', budget: 3,
    motivering: 'Sussa 3.7.1.1 och 3.7.1.3. Ett klick på Meddelanden, ett fältbyte till texten och ett klick på Skicka. En fråga till vården är förvald, och systemet väljer vårdenheten där patienten senast hade kontakt.',
  },
  {
    id: 'ombud-boka', namn: 'Boka en tid för patienten som ombud', roll: 'inv-om01', start: 'Min journal för ombudet', budget: 3,
    motivering: 'Sussa 3.4.2.3. Ett klick på patienten som fullmakten gäller, som öppnar patientens tider, ett på Visa lediga tider och ett på den tid som systemet föreslår först. Ombudet ser bara tider och meddelanden, och bokningen loggas på patienten.',
  },
];
