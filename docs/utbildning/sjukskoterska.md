# Utbildning i Vårdkällan: Sjuksköterska

Det här materialet hör till Grundkurs i Vårdkällan. Det skrivs ur Vårdkällans egna register, så att arbetsflödena, filmerna, övningarna och uppdragen alltid är de som finns i systemet.

## Vad du gör i Vårdkällan

Som sjuksköterska registrerar du mätvärden och vitalparametrar, ger doser från Läkemedel att ge, skriver omvårdnadsanteckningar, skriver in, flyttar och skriver ut patienter och registrerar delegeringar till undersköterskor. Barnmorskan och distriktssköterskan har samma behörigheter i demon.

Systemet är experten, inte du. Det betyder att systemet fyller i det som det kan räkna ut ur sammanhanget, till exempel vårdkontakt, enhet, tid och koder. Det föreslår nästa steg och kontrollerar mot regler och kodverk innan något sparas.

När något inte går, eller när systemet varnar, står det på vanlig svenska varför och vad du kan göra i stället. Du behöver aldrig kunna kodverk, regler eller lagtext för att göra rätt.

I demon väljer du en demoroll under Personal på startsidan. Demorollerna för din yrkesroll är:

- Johan Ek, Sjuksköterska
- Hanna Lilja, Distriktssköterska
- Sofia Ekdahl, Barnmorska
- Therese Hedberg, Operationskoordinator (operationssjuksköterska)
- Elias Wickman, Onkologisjuksköterska
- Linnea Forsman, Röntgensjuksköterska

Alla patienter i demon är påhittade och har testpersonnummer från Skatteverket. Varje besökare får en egen sandlåda, så det du gör påverkar ingen annan.

## Vanliga arbetsflöden

Varje arbetsflöde har en klickbudget: det största antalet klick, fältbyten och tangenttryck som flödet får kräva. Budgeten mäts automatiskt i gränssnittet efter varje ändring, så att ett flöde inte blir krångligare utan att det märks.

### Registrera blodtryck

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Johan Ek flödet.

Ett klick till mätvärdena, ett fältbyte för värdet och ett klick för att registrera. Blodtryck är det vanligaste mätvärdet och ska vara förvalt, så att listan inte behöver ändras.

### Skriva in en patient

Börjar i: Översikten för en patient på mottagningen. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Ett klick på Skriv in, ett fältbyte vardera för orsaken och för sal och säng, och ett klick för att skriva in. Avdelningen är förvald, och orsaken fylls i när patienten kommer från akuten eller med en remiss.

### Flytta en patient till en annan avdelning

Börjar i: Patientens översikt. Klickbudget: högst 5 steg. I demon gör Johan Ek flödet.

Ett klick på Flytta, två klick för att välja avdelning i listan, ett fältbyte för sal och säng och ett klick för att flytta. Vårdtillfället och allt som är dokumenterat följer med, så inget registreras om.

### Skriva ut en patient

Börjar i: Översikten för en inlagd patient. Klickbudget: högst 2 steg. I demon gör Johan Ek flödet.

Ett klick på Skriv ut och ett för att bekräfta. Systemet kontrollerar själv osignerade anteckningar och epikris och säger vad som återstår.

### Ge en dos

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Johan Ek flödet.

Sussa 3.5.2.18. Ett klick till Läkemedel att ge och ett på Ge för dosen. Systemet har räknat fram dagens doser ur ordinationerna och kontrollerat dosen mot ordinationen och tidigare doser, och tiden, vem som gav den och vårdkontakten sätts av systemet. En varning för dubbel dos eller för tidig dos visas först när den gäller. Runda 13, r3 (E2-5): utan skannat armband bekräftar sjuksköterskan med ett klick hur patientens identitet kontrollerades, med det vanligaste sättet förvalt, en gång per patient och läkemedelsrunda. Med skanning behövs inget extra klick.

### Registrera en delegering

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Ett klick till Delegeringar, ett på Ny delegering för undersköterskan, ett för intyget att kunskaperna är kontrollerade och ett för att registrera. Systemet föreslår samma omfattning som den nuvarande delegeringen, giltighet från i dag i ett år och uppföljningen, och påminner i inkorgen 30 dagar innan den går ut.

### Registrera en NEWS2-kontroll

Börjar i: Patientens översikt. Klickbudget: högst 8 steg. I demon gör Johan Ek flödet.

Sussa 3.1.3.5 och 3.1.3.9. Ett klick till Mätvärden och ett på Registrera NEWS2-kontroll, där andningsfrekvensen redan har fokus, ett fältbyte vardera för syremättnad, blodtryck, puls och temperatur, ett klick för medvetandegraden och ett för att registrera. Luft är förvalt, tiden och vårdkontakten sätter systemet, och systemet räknar poängen och säger vad som ska göras.

### Registrera en dos i efterhand

Börjar i: Läkemedel att ge efter återställning. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Sussa 3.5.2.2. Ett klick på Mer för dosen, ett på Given tidigare och ett för att registrera. Systemet föreslår tiden, aldrig i framtiden, kontrollerar den mot ordinationen och tidigare doser och visar att registreringen gjordes i efterhand. Runda 13, r3 (E2-5): utan skannat armband bekräftar sjuksköterskan med ett klick hur patientens identitet kontrollerades, med det vanligaste sättet förvalt, en gång per patient och läkemedelsrunda. Med skanning behövs inget extra klick.

### Lämna ut ett hjälpmedel

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Johan Ek flödet.

Sussa 7.1.1.1 och 3.4.4.4. Ett klick på Lämna ut hjälpmedel i kostnadsrutan och ett på hjälpmedlet. Systemet tar hjälpmedlen ur vårdenhetens prislista, knyter utlämningen till den pågående vårdkontakten och skapar posten och hjälpmedelsavgiften i faktureringsunderlaget. Budgeten har plats för ett klick till.

### Registrera längd och vikt vid ett BHV-besök och se kurvan

Börjar i: Översikten för ett barn på barnavårdscentralen. Klickbudget: högst 4 steg. I demon gör Hanna Lilja flödet.

Sussa 4.1.1.4 och 4.1.1.6. Ett klick på fliken Tillväxt, där vikten redan har fokus, ett fältbyte till längden och ett klick för att registrera. Systemet sätter tid, vårdkontakt och kod, räknar BMI, SD och percentil och ritar kurvan direkt. Ett steg räknas med för huvudomfånget, som mäts vid de flesta besök det första året.

### Överblicka dagens händelser på avdelningen

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 1 steg. I demon gör Johan Ek flödet.

Sussa 3.4.1.6 och testfall 7.1. Ett klick på Avdelningens planering i arbetslistan. Vyn visar allt som är planerat för avdelningens patienter i dag i tidsordning: uppgifter, läkemedel att ge och bokade tider, med vem som ansvarar.

### Registrera längd, vikt, blodtryck och puls

Börjar i: Patientens översikt. Klickbudget: högst 6 steg. I demon gör Johan Ek flödet.

Sussa testfall 4.2. Ett klick på Registrera mätvärde och ett på formuläret för flera värden, där längden har fokus, ett fältbyte vardera för vikt, blodtryck och puls och ett klick för att registrera. Tiden och vårdkontakten sätter systemet, och BMI räknas själv.

### Registrera provtagning

Börjar i: Provtagningen efter återställning. Klickbudget: högst 2 steg. I demon gör Johan Ek flödet.

Sussa 4.4.2.6 och testfall 3.3. Rören står i provtagningsordning med etiketter, och ett klick på Tagen per rör registrerar provtagningen. Systemet sätter tid och provtagare och skickar proverna till laboratoriet när alla rör är tagna. Patienten har två rör.

### Koppla en patientmonitor till patienten

Börjar i: Patientens mätvärden efter återställning. Klickbudget: högst 2 steg. I demon gör Johan Ek flödet.

Sussa 3.6.1.5. Med en streckkodsläsare skannas monitorns streckkod i fältet, som är ett fältbyte och Enter. I demon väljs monitorn med ett klick i listan över utrustning på vårdenheten, vilket motsvarar skanningen. Systemet hittar utrustningen, knyter den till patienten och den pågående vårdkontakten och avslutar en tidigare koppling när monitorn flyttas.

### Godkänna värden från monitorn

Börjar i: Mätvärden med värden från en kopplad monitor. Klickbudget: högst 1 steg. I demon gör Johan Ek flödet.

Sussa 3.6.1.6. Ett klick på Godkänn vid värdena som väntar. Systemet godkänner alla värden från utrustningen som sjuksköterskan får se på sin vårdenhet, och de räknas sedan i NEWS2, larm och beslutsstöd.

### Öppna patienten genom att skanna armbandet

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 2 steg. I demon gör Johan Ek flödet.

Sussa 3.1.3.6. Fältet Skanna i toppraden tar emot läsaren: ett fältbyte och läsarens Enter. Systemet tolkar koden, prövar behörigheten och öppnar patienten. Utan fältet fångas en skanning också när fokus inte står i ett textfält, och då är det inget steg alls.

### Dokumentera ett sår med kroppsbilden

Börjar i: Patientens översikt. Klickbudget: högst 8 steg. I demon gör Johan Ek flödet.

Sussa 3.1.3.1, 3.1.3.5 och 5.1.1.3. Ett klick på Ny anteckning, två för att välja Sårdokumentation i listan, ett klick på hälen i kroppsbilden, där fokus flyttas till beskrivningen, ett klick på sårtypen, ett fältbyte vardera för längd och bredd och ett klick för att signera. Systemet skriver kroppsdelen och sidan, fyller i vikten ur mätvärdena och skriver anteckningens text.

### Registrera en perifer venkateter

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Sussa 3.1.3.3 och 3.1.3.8. Ett klick på fliken In- och utfarter, ett fältbyte till Var den sitter och ett klick på Registrera. Perifer venkateter och den vanligaste storleken är förvalda, och systemet sätter tiden, vårdkontakten, KVÅ-koden och nästa skötsel. Budgeten har ett steg till för att välja en annan typ i listan.

### Svara på ett meddelande från en patient och avsluta

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Sussa 3.7.1.1. Ett klick på Meddelanden, ett på meddelandet, ett fältbyte till svaret och ett klick på Svara och avsluta. Systemet har skickat meddelandet till sjuksköterskan ur vad det gäller och aviserar patienten om svaret.

### Planera en operation från väntelistan

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 4 steg. I demon gör Therese Hedberg flödet.

Sussa 4.5.1.2. Ett klick på Operation i menyn, ett på Väntelista, ett på Planera vid patienten som har väntat längst och ett på Planera i systemets förslag. Systemet har valt sal i vårdenhetens block, tid, operatör, operationssjuksköterska, anestesiteam och utrustning som är lediga och skriver kallelsen.

### Registrera att patienten kommer in på salen

Börjar i: Operationsavdelningens program. Klickbudget: högst 3 steg. I demon gör Therese Hedberg flödet.

Sussa 4.5.1.3. Ett klick på patienten i dagens program, ett på In på sal och ett på Registrera. Systemet sätter tiden, kontrollerar id-bandet när det skannas, startar anestesimonitorn och visar checklistan före anestesi med det som systemet redan vet ifyllt.

### Registrera ett besök i graviditetsjournalen

Börjar i: Graviditetsjournalen i vecka 30. Klickbudget: högst 5 steg. I demon gör Hanna Lilja flödet.

Sussa 4.7.1.2. Ett fältbyte vardera för blodtryck, vikt, symfys-fundusmått och fosterljud och ett klick på Spara besöket. Systemet sätter veckan, varnar för blodtryck, protein, symfys-fundusmått och fosterljud och registrerar blodtryck och vikt som mätvärden.

### Bedöma CTG under en förlossning

Börjar i: Förlossningens översikt. Klickbudget: högst 2 steg. I demon gör Sofia Ekdahl flödet.

Sussa 4.7.1.3. Ett klick på patienten och ett på Bekräfta bedömningen. Systemet hämtar kurvan från monitorn, räknar basalfrekvens, variabilitet och decelerationer, klassar kurvan och föreslår åtgärden, så barnmorskan skriver något bara när hon bedömer annorlunda.

### Lägga in en bild från datorn i journalen

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Sussa 4.2.1.1, 4.2.1.2 och 4.2.1.4. Ett klick på fliken Bilder, ett på Fil från datorn eller mobilen och ett på Spara i journalen. Valet av fil i datorns fönster är ett steg till, som sidan inte ser. Kroppsstället är förifyllt ur patientens senaste bild, och systemet läser typen och tiden ur filen, skickar den i delar, gör miniatyren och knyter bilden till vårdkontakten.

### Jämföra bilder av ett kroppsställe över tid

Börjar i: Patientens översikt. Klickbudget: högst 2 steg. I demon gör Johan Ek flödet.

Sussa 4.2.1.2. Ett klick på fliken Bilder och ett på Jämför bilder av korsbenet över tid. Systemet har grupperat bilderna efter kroppsställe och ställer dem bredvid varandra i tidsordning med dagarna från den första.

### Hämta en bild från en apparat och föra in den i journalen

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Johan Ek flödet.

Sussa 4.2.1.4. Ett klick på fliken Bilder, ett på Från en apparat eller en annan vårdgivare, ett på Hämta från apparaten och ett på För in i journalen. Apparaten är förvald, kroppsstället föreslås ur patientens senaste bild, och systemet kontrollerar att apparatens patient är journalens innan bilden kan föras in.

### Boka en inkommen undersökning på röntgenkliniken

Börjar i: Röntgenklinikens undersökningar efter återställning. Klickbudget: högst 1 steg. I demon gör Linnea Forsman flödet.

Sussa 4.4.2.7. Ett klick på Boka vid den undersökning som står först. Systemet har ordnat listan efter prioritet och senaste dag och föreslår den första lediga tiden i rätt rum.

### Registrera vårdtyngden enligt NEMS för en patient på intensivvården

Börjar i: Övervakningen av en patient på intensivvården. Klickbudget: högst 1 steg. I demon gör Johan Ek flödet.

Sussa 4.6.1.7. Ett klick på Registrera vårdtyngden. Systemet har redan kryssat i de poster som står i journalen, som kopplad monitor, intravenösa läkemedel och andningsstöd, och räknar poängen själv. Sjuksköterskan kryssar bara i det som bara den som vårdar vet.

## Instruktionsfilmer

Filmerna visar ett arbetsflöde från början till slut med textade steg på svenska. De spelas in på nytt efter varje ändring i gränssnittet, så att de alltid visar det gränssnitt som finns.

### Ge en dos

Sjuksköterskan ger en dos från Läkemedel att ge. Systemet räknar fram dagens doser ur ordinationerna och varnar för dubbel dos.

Flöde: Ge en dos, klickbudget 3. [Se filmen](../filmer/ge-dos.webm)

### Registrera en NEWS2-kontroll

Sjuksköterskan registrerar vitalparametrar. Systemet räknar NEWS2 och säger vad som ska göras och när nästa kontroll ska göras.

Flöde: Registrera en NEWS2-kontroll, klickbudget 8. [Se filmen](../filmer/news2.webm)

## Övningar

Övningarna görs under Utbildning i demon. Servern rättar svaren och förklarar varje svar. När alla svar är rätt får du ett intyg som gäller i 365 dagar. Här står frågorna med rätt svar och förklaringen, så att du kan läsa på före och efter.

### Övning 1

Vad händer när du öppnar journalen för en patient i Vårdkällan?

Rätt svar: Åtkomsten skrivs i åtkomstloggen med vem, när och på vilken grund, och patienten kan se den i Min journal.

Varje åtkomst till patientuppgifter loggas, också när du bara läser. Loggen går inte att ändra, och patienten ser i Min journal vilken vårdenhet och yrkesroll som har läst.

### Övning 2

Ett val dyker upp som du inte vet hur du ska fylla i. Vad gäller i Vårdkällan?

Rätt svar: Systemet fyller i det som går att räkna ut, föreslår resten och förklarar på vanlig svenska varför något inte går.

Systemet är experten: koder, vårdkontakt, enhet och tider sätts av systemet, och när något inte går står det varför. Knappen Hjälp i flödet förklarar stegen.

### Övning 3

Du behöver läsa vad en annan vårdenhet har dokumenterat om demopatienten Gunnar Åkesson. Hur gör du?

Rätt svar: Väljer Visa uppgifter från andra vårdenheter i patienthuvudet och anger syftet, som systemet föreslår.

Inre sekretess: andra vårdenheters uppgifter visas efter ett aktivt val med syfte. Valet loggas och gäller sessionen för den patienten.

Pröva i demon: logga in som Johan Ek och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/patient/p01).

### Övning 4

Demopatienten Elin Sandberg har spärrat uppgifter. Vad ser du som inte arbetar på den spärrade vårdenheten?

Rätt svar: En spärrmarkering, men inte innehållet eller vilken vårdenhet det gäller. Spärren hävs bara med patientens samtycke i stunden.

En spärr hävs bara tillfälligt med patientens samtycke, och nödåtkomst häver aldrig en spärr.

### Övning 5

En patient har skyddade personuppgifter. Vad visar systemet i arbetslistan och väntrummet?

Rätt svar: Skyddad identitet i stället för namnet, och adressen visas aldrig. Väntrummet visar bara könummer.

Systemet maskerar skyddad identitet överallt utan att någon behöver komma ihåg det. Visa identitet kräver ett syfte och loggas.

Pröva i demon: logga in som Johan Ek och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/arbetslista).

### Övning 6

Patienten saknar vårdrelation till din vårdenhet och kan inte samtycka, men du behöver journalen för vården. Vad gäller?

Rätt svar: Du väljer Nödåtkomst med ett syfte. Åtkomsten flaggas i loggen och följs upp, och en spärr hävs aldrig.

Nödåtkomst kräver syfte och intyg om att patienten inte kan samtycka. Den syns för logggranskaren.

Pröva i demon: logga in som Johan Ek och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/sok).

### Övning 7

Du ska ge en dos från Läkemedel att ge, och systemet varnar för dubbel dos. Vad betyder det?

Rätt svar: Att en dos av samma läkemedel redan är registrerad nyss. Kontrollera innan du ger igen.

Systemet räknar fram dagens doser ur ordinationerna och varnar för dubbel dos, för tidig dos och högsta dygnsdos, med en förklaring.

Pröva i demon: logga in som Johan Ek och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/administrering).

### Övning 8

Du registrerar vitalparametrar och NEWS2 blir 7. Vad gör systemet?

Rätt svar: Räknar NEWS2, skriver vad som ska göras och när nästa kontroll ska göras, och larmar i inkorgen för sjuksköterskan och läkaren.

NEWS2 räknas ur vitalparametrarna. En summa som kräver åtgärd larmar i inkorgen. Reglerna är demoregler.

## Praktiska prov

Ett praktiskt prov görs på riktigt i en övningsjournal, som är en av demons påhittade patienter. Systemet kontrollerar själv att det blev rätt och säger på vanlig svenska vad som saknas. Utbildaren eller verksamhetschefen startar proven för vårdenheten. Ett godkänt prov gäller i ett år.

### Skriva och signera en journalanteckning

Öppna fliken Journal för patienten i övningsjournalen, skriv en anteckning och signera den. Kontrollera provet när anteckningen är signerad.

### Registrera ett blodtryck

Öppna fliken Mätvärden i journalen för patienten i övningsjournalen och registrera ett blodtryck. Kontrollera provet när mätvärdet är sparat.

## Uppdrag i testinbjudan

Uppdragen görs i demon under Testa (#/testa). De följer så långt det går Sussas användbarhetstestfall och ligger i den ordning en arbetsdag har dem. Systemet bockar av ett uppdrag själv när det har hänt, och ett uppdrag som går ut på att hitta något har en fråga som systemet rättar.

### Sjuksköterska

Du arbetar som Johan Ek, sjuksköterska på avdelning 72, som motsvarar Sussas medicinavdelning.

1. Överblicka dagens arbete för din arbetsplats (Sussas testfall 7.1).
   Ta fram dagens arbete på avdelningen.
   Meddela vilka händelser som äger rum klockan 11.
   Fråga: Vilka händelser äger rum klockan 11?
2. Akut inskrivning av patient på vårdavdelning (Sussas testfall 6.1).
   Upprätta ett oplanerat slutenvårdstillfälle på avdelningen.
   Koppla patienten till en sängplats.
   Klart när: Mira Axelsson finns på en sängplats på avdelningen.
3. Registrera mätvärden (Sussas testfall 4.2).
   Längd 165 cm, vikt 75 kg, blodtryck 140/90 mmHg och puls 83 slag per minut.
   Klart när: Mätvärdena är inmatade i journalen.
4. Gör en NEWS2-kontroll.
   En av patienterna på avdelningen verkar sämre. Registrera en NEWS2-kontroll och se vad systemet föreslår.
5. Administrera läkemedel (Sussas testfall 1.4).
   Ge Paracetamol Panpharma och läs upp instruktionen.
   Iordningställ och ge Glukos med Addex-Magnesium och läs upp instruktionen.
   Ge sömnmedicinen.
   Ge premedicineringen inför röntgen.
   Dokumentera att patienten kräktes upp premedicineringen.
   Klart när: Instruktionerna är upplästa, alla fyra läkemedel är administrerade och det är dokumenterat att patienten kräktes upp premedicineringen.
6. Ordinera läkemedel på uppdrag (Sussas testfall 1.3).
   Alvedon 1 g tablett mot smärta som engångsordination.
   Morfin injektionsvätska 10 mg/ml, 1 ml intramuskulärt mot smärta, engångsordination.
   Klart när: De två läkemedlen är ordinerade.
7. Upprätta en labbeställning på uppdrag (Sussas testfall 3.2).
   Samma analyser som i testfall 3.1.
   Spara eller skicka.
   Klart när: Beställningen är sparad, skickad eller verkställd.
8. Registrera provtagning (Sussas testfall 3.3).
   Hitta beställningen med blodstatus, B12, folat och urinodling.
   Markera vilka prover som är tagna och skicka.
   Klart när: Beställningen är skickad.
9. Skapa anteckning (Sussas testfall 4.1).
   Skriv och signera en omvårdnadsanteckning, eller dokumentera tobaksvanorna för Berit Strandhall som i Sussas testfall 4.1.
   Klart när: Informationen är inmatad på ett strukturerat sätt i journalen.
10. Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (Sussas testfall 6.2).
   Flytta Fatima Baskar till den andra avdelningen.
   Hon ska inte knytas till någon sängplats.
   Klart när: Fatima Baskar finns på den nya avdelningen utan sängplats.
11. Svara på ett meddelande från en patient.
   En patient har skrivit en fråga till mottagningen i Min journal. Svara på den.
12. Skriv ut en patient.
   En av patienterna på avdelningen går hem i dag. Skriv ut patienten.

### Barnmorska

Du arbetar som Sofia Ekdahl, barnmorska på förlossningen. Sussas testfall har inga uppdrag för barnmorskor, så uppdragen här är förlossningens vanliga arbetsflöden.

1. Ta emot på förlossningen.
   Se vilka kvinnor som är inne på förlossningen och öppna journalen för den som föder nu.
2. Bedöm CTG.
   Bedöm det pågående CTG:t för kvinnan som föder.
3. Fyll i partogrammet.
   Registrera hur mycket modermunnen har öppnat sig.
4. Registrera smärtlindring.
   Kvinnan vill ha lustgas. Registrera smärtlindringen.
5. Registrera barnet.
   Barnet är fött. Registrera kön, vikt, längd, huvudomfång och Apgar.
6. Gör födelseanmälan.
   Gör födelseanmälan för ett barn som saknar en.
7. Gör en kontroll på BB.
   Gör en kontroll av en mamma eller ett barn på BB.

## Det här ska du kunna efter utbildningen

- Ge en dos från Läkemedel att ge och förstå varningen för dubbel dos.
- Registrera en NEWS2-kontroll och följa det systemet föreslår.
- Skriva in, flytta och skriva ut en patient.
- Registrera en delegering för en undersköterska.
- Skriva och signera en omvårdnadsanteckning.
- Göra de vanliga arbetsflödena ovan inom klickbudgeten.
- Svara rätt på alla 8 övningar och få intyget.
