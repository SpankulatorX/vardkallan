# Utbildning i Vårdkällan: Fysioterapeut

Det här materialet hör till Grundkurs i Vårdkällan. Det skrivs ur Vårdkällans egna register, så att arbetsflödena, filmerna, övningarna och uppdragen alltid är de som finns i systemet.

## Vad du gör i Vårdkällan

Som fysioterapeut tar du emot och bedömer remisser, skriver anteckningar efter besök, registrerar mätvärden och bockar av planerade uppgifter som träning. Fysioterapeuten spelar också Sussas paramedicinare, alltså arbetsterapeut, dietist och kurator.

Systemet är experten, inte du. Det betyder att systemet fyller i det som det kan räkna ut ur sammanhanget, till exempel vårdkontakt, enhet, tid och koder. Det föreslår nästa steg och kontrollerar mot regler och kodverk innan något sparas.

När något inte går, eller när systemet varnar, står det på vanlig svenska varför och vad du kan göra i stället. Du behöver aldrig kunna kodverk, regler eller lagtext för att göra rätt.

I demon väljer du en demoroll under Personal på startsidan. Demorollerna för din yrkesroll är:

- Jenny Holmberg, Fysioterapeut (hjärtrehabilitering)

Alla patienter i demon är påhittade och har testpersonnummer från Skatteverket. Varje besökare får en egen sandlåda, så det du gör påverkar ingen annan.

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

Pröva i demon: logga in som Jenny Holmberg och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/patient/p01).

### Övning 4

Demopatienten Elin Sandberg har spärrat uppgifter. Vad ser du som inte arbetar på den spärrade vårdenheten?

Rätt svar: En spärrmarkering, men inte innehållet eller vilken vårdenhet det gäller. Spärren hävs bara med patientens samtycke i stunden.

En spärr hävs bara tillfälligt med patientens samtycke, och nödåtkomst häver aldrig en spärr.

### Övning 5

En patient har skyddade personuppgifter. Vad visar systemet i arbetslistan och väntrummet?

Rätt svar: Skyddad identitet i stället för namnet, och adressen visas aldrig. Väntrummet visar bara könummer.

Systemet maskerar skyddad identitet överallt utan att någon behöver komma ihåg det. Visa identitet kräver ett syfte och loggas.

Pröva i demon: logga in som Jenny Holmberg och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/arbetslista).

## Praktiska prov

Ett praktiskt prov görs på riktigt i en övningsjournal, som är en av demons påhittade patienter. Systemet kontrollerar själv att det blev rätt och säger på vanlig svenska vad som saknas. Utbildaren eller verksamhetschefen startar proven för vårdenheten. Ett godkänt prov gäller i ett år.

### Skriva och signera en journalanteckning

Öppna fliken Journal för patienten i övningsjournalen, skriv en anteckning och signera den. Kontrollera provet när anteckningen är signerad.

## Uppdrag i testinbjudan

Uppdragen görs i demon under Testa (#/testa). De följer så långt det går Sussas användbarhetstestfall och ligger i den ordning en arbetsdag har dem. Systemet bockar av ett uppdrag själv när det har hänt, och ett uppdrag som går ut på att hitta något har en fråga som systemet rättar.

### Fysioterapeut och andra yrken

Du arbetar som Jenny Holmberg, fysioterapeut på kardiologiska mottagningen. Hon spelar Sussas paramedicinare, alltså också arbetsterapeut, dietist och kurator.

1. Överblicka dagens arbete för din arbetsplats (Sussas testfall 7.1).
   Ta fram dagens arbete på avdelningen.
   Meddela vilka händelser som äger rum klockan 11.
   Fråga: Vilka händelser äger rum klockan 11?
2. Ta emot vårdbegäran (Sussas testfall 2.3).
   Fördela Berit Strandhall till bakjouren, en namngiven läkare.
   Sätt Gerda Ström på väntelistan för besök om två månader.
   Avvisa Elin Arnströms remiss på grund av fel vårdnivå med en svarstext.
   Skicka Trevis Ljungs remiss vidare till psykiatriska kliniken.
   Klart när: De fyra remisserna är fördelade, prioriterade, avvisade eller vidareskickade.
3. Bocka av dagens träning.
   Du har en planerad gångträning med en patient på avdelningen. Markera att den är gjord.
4. Skapa anteckning (Sussas testfall 4.1).
   Skriv och signera en anteckning efter ett besök, eller dokumentera tobaksvanorna för Berit Strandhall som i Sussas testfall 4.1.
   Klart när: Informationen är inmatad på ett strukturerat sätt i journalen.
5. Registrera ett mätvärde.
   Registrera pulsen efter ett träningspass.
6. Besvara en vårdbegäran (Sussas testfall 2.6).
   Du har just träffat Sara Sandmark på mottagningen.
   Besvara vårdbegäran från vårdcentralen med texten: Tack för remissen. Vi har träffat Sara och gett henne rätt behandling.
   Skicka svaret.
   Klart när: Remissvaret är skickat.
7. Upprätta och skicka vårdbegäran (Sussas testfall 2.1).
   Mottagare Hudkliniken.
   Frågeställning: Hudförändring, malignt?
   Anamnes: Pat har en hudförändring på låret som har förändrats snabbt. Är det malignt?
   Skicka vårdbegäran.
   Klart när: Vårdbegäran är skickad.

## Det här ska du kunna efter utbildningen

- Bedöma och besvara en remiss.
- Skriva och signera en anteckning efter ett besök.
- Bocka av en planerad uppgift.
- Svara rätt på alla 5 övningar och få intyget.
