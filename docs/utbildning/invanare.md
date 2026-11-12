# Utbildning i Vårdkällan: Invånare i Min journal

Det här materialet hör till Grundkurs i Vårdkällan. Det skrivs ur Vårdkällans egna register, så att arbetsflödena, filmerna, övningarna och uppdragen alltid är de som finns i systemet.

## Vad du gör i Vårdkällan

Som invånare loggar du in i Min journal med en simulerad e-legitimation. Där läser du din journal, ser vilka vårdenheter som har läst den, bokar och bokar om tider, lämnar egna mätningar, skriver till vården och begär loggutdrag eller spärr.

Systemet är experten, inte du. Det betyder att systemet fyller i det som det kan räkna ut ur sammanhanget, till exempel vårdkontakt, enhet, tid och koder. Det föreslår nästa steg och kontrollerar mot regler och kodverk innan något sparas.

När något inte går, eller när systemet varnar, står det på vanlig svenska varför och vad du kan göra i stället. Du behöver aldrig kunna kodverk, regler eller lagtext för att göra rätt.

I demon väljer du en påhittad patient under Patient på startsidan. Inloggningen med e-legitimation är simulerad.

## Vanliga arbetsflöden

Varje arbetsflöde har en klickbudget: det största antalet klick, fältbyten och tangenttryck som flödet får kräva. Budgeten mäts automatiskt i gränssnittet efter varje ändring, så att ett flöde inte blir krångligare utan att det märks.

### Patienten bokar om sin tid i Min journal

Börjar i: Min journal för en patient med bokad tid. Klickbudget: högst 3 steg. I demon gör Mikael Svensson flödet.

Ett klick på fliken Tider, ett på Boka om och ett på den föreslagna tiden. Systemet visar bara tider av samma typ, minst 24 timmar fram, och skickar den nya kallelsen.

### Lämna en egen mätning i Min journal

Börjar i: Min journal för patienten. Klickbudget: högst 3 steg. I demon gör Gunnar Åkesson flödet.

Sussa 3.6.1.7. Ett klick på Egna mätningar, ett fältbyte till värdet och ett klick för att skicka. Blodtryck är förvalt, tiden är nu och systemet väljer själv vårdenheten som tar emot mätningen.

### Skriva ett meddelande till vården i Min journal

Börjar i: Min journal för patienten. Klickbudget: högst 3 steg. I demon gör Gunnar Åkesson flödet.

Sussa 3.7.1.1 och 3.7.1.3. Ett klick på Meddelanden, ett fältbyte till texten och ett klick på Skicka. En fråga till vården är förvald, och systemet väljer vårdenheten där patienten senast hade kontakt.

### Boka en tid för patienten som ombud

Börjar i: Min journal för ombudet. Klickbudget: högst 3 steg.

Sussa 3.4.2.3. Ett klick på patienten som fullmakten gäller, som öppnar patientens tider, ett på Visa lediga tider och ett på den tid som systemet föreslår först. Ombudet ser bara tider och meddelanden, och bokningen loggas på patienten.

### Rapportera dagens tabletter i Min journal

Börjar i: Min journal för patienten med cytostatika. Klickbudget: högst 3 steg. I demon gör Anna Viklund flödet.

Sussa 4.8.1.6. Ett klick på Min behandling, ett i rutan för morgonens tabletter och ett på Skicka. Inget besvär är förvalt, och systemet bedömer rapporten och säger direkt om patienten ska ringa.

## Instruktionsfilmer

Filmerna visar ett arbetsflöde från början till slut med textade steg på svenska. De spelas in på nytt efter varje ändring i gränssnittet, så att de alltid visar det gränssnitt som finns.

### Boka om sin tid i Min journal

Patienten bokar om sin tid i Min journal och ser direkt den nya tiden.

Flöde: Patienten bokar om sin tid i Min journal, klickbudget 3. [Se filmen](../filmer/egen-ombokning.webm)

## Uppdrag i testinbjudan

Uppdragen görs i demon under Testa (#/testa). De följer så långt det går Sussas användbarhetstestfall och ligger i den ordning en arbetsdag har dem. Systemet bockar av ett uppdrag själv när det har hänt, och ett uppdrag som går ut på att hitta något har en fråga som systemet rättar.

### Patient i Min journal

Du är Gunnar Åkesson, en påhittad patient, och loggar in i Min journal med en simulerad e-legitimation.

1. Läs din journal.
   Läs den senaste anteckningen i din journal.
2. Se vem som har läst din journal.
   Ta reda på vilka vårdenheter som har läst din journal och när.
3. Lämna en egen mätning.
   Du har mätt blodtrycket hemma. Lämna värdet till vården.
4. Skriv till vården.
   Skriv en fråga till mottagningen.
5. Förnya ett recept.
   Be om att få ett recept förnyat.
6. Boka, boka om eller avboka en tid.
   Boka en tid, eller boka om eller avboka en tid som du har.
7. Begär ett loggutdrag eller en spärr.
   Begär ett utdrag ur loggen, eller begär att uppgifter från en vårdenhet spärras.

## Det här ska du kunna efter utbildningen

- Läsa din journal och se vem som har läst den.
- Boka om en tid.
- Lämna en egen mätning och skriva till vården.
- Begära ett loggutdrag eller en spärr.
- Göra de vanliga arbetsflödena ovan inom klickbudgeten.
