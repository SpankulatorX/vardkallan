# Utbildning i Vårdkällan: Systemförvaltare

Det här materialet hör till Grundkurs i Vårdkällan. Det skrivs ur Vårdkällans egna register, så att arbetsflödena, filmerna, övningarna och uppdragen alltid är de som finns i systemet.

## Vad du gör i Vårdkällan

Som systemförvaltare föreslår du ändringar av regler, parametrar, mallar, kodverk och formulär, förbereder omorganisationer, registrerar externa tillämpningar och följer upp lagringen och säkerhetskopiorna. En ändring gäller först när en annan systemförvaltare har godkänt den. Du läser inte journalerna.

Systemet är experten, inte du. Det betyder att systemet fyller i det som det kan räkna ut ur sammanhanget, till exempel vårdkontakt, enhet, tid och koder. Det föreslår nästa steg och kontrollerar mot regler och kodverk innan något sparas.

När något inte går, eller när systemet varnar, står det på vanlig svenska varför och vad du kan göra i stället. Du behöver aldrig kunna kodverk, regler eller lagtext för att göra rätt.

I demon väljer du en demoroll under Personal på startsidan. Demorollerna för din yrkesroll är:

- Tomas Lindh, Systemförvaltare (applikationskonfiguration)
- Nora Ekholm, Systemförvaltare

Alla patienter i demon är påhittade och har testpersonnummer från Skatteverket. Varje besökare får en egen sandlåda, så det du gör påverkar ingen annan.

## Vanliga arbetsflöden

Varje arbetsflöde har en klickbudget: det största antalet klick, fältbyten och tangenttryck som flödet får kräva. Budgeten mäts automatiskt i gränssnittet efter varje ändring, så att ett flöde inte blir krångligare utan att det märks.

### Förbereda ett namnbyte för en enhet

Börjar i: Omorganisationen efter återställning. Klickbudget: högst 4 steg. I demon gör Tomas Lindh flödet.

Sussa 12.1.1.1 och 12.1.1.4. Ett klick på Ändra vid enheten, där namnbyte är förvalt och det nuvarande namnet är markerat så att det nya skrivs direkt, och ett klick på Förbered. Systemet föreslår datumet (första dagen i nästa månad), förhandsvisar medan man skriver vad som påverkas, kontrollerar att namnet inte redan finns och genomför bytet själv på dagen. Budgeten har plats för att ändra datumet.

### Ändra en demoregel

Börjar i: Reglerna efter återställning. Klickbudget: högst 3 steg. I demon gör Tomas Lindh flödet.

Sussa 12.1.1.3, 12.1.1.5 och 12.1.1.6. Ett klick på Ändra vid regeln, där det nuvarande värdet är markerat så att det nya skrivs direkt, ett fältbyte till den obligatoriska motiveringen och ett klick på Skicka för godkännande. Systemet föreslår att ändringen gäller från i morgon, visar effekten och förklarar direkt om värdet inte är rimligt. En annan systemförvaltare godkänner ändringen (fyra ögon).

### Bygga ett formulär och föreslå det

Börjar i: Systemförvaltarens formulär. Klickbudget: högst 5 steg. I demon gör Tomas Lindh flödet.

Sussa 5.1.1.3. Ett klick på Nytt formulär, där fokus står i namnet, ett fältbyte till första frågan, ett klick på Lägg till fråga, där fokus flyttas till den nya frågan, ett klick på Föreslå och ett för att skicka med motiveringen. Systemet sätter nycklarna, förhandsvisar formuläret och säger vad som behöver ändras.

### Registrera en incident

Börjar i: Servicenivåsidan efter återställning. Klickbudget: högst 4 steg. I demon gör Tomas Lindh flödet.

Ett fältbyte till vad som har hänt, ett klick för hur många som berörs, ett för om vården kan arbeta och ett på Registrera incidenten. Systemet sätter prioriteten enligt servicenivåavtalet, tiden och sorten (driftstörning) och säger direkt när beställaren ska ha rapporten och när processen för en större incident ska startas.

## Instruktionsfilmer

Filmerna visar ett arbetsflöde från början till slut med textade steg på svenska. De spelas in på nytt efter varje ändring i gränssnittet, så att de alltid visar det gränssnitt som finns.

### Registrera en incident

Systemförvaltaren registrerar en driftstörning. Systemet sätter prioriteten enligt servicenivåavtalet och säger när beställaren ska ha rapporten.

Flöde: Registrera en incident, klickbudget 4. [Se filmen](../filmer/registrera-incident.webm)

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

Du har föreslagit en ändring av en regel. När börjar den gälla?

Rätt svar: När en annan systemförvaltare har godkänt den, från det giltighetsdatum som står i förslaget.

Fyra ögon: ingen godkänner sina egna ändringar. Systemet visar effekten i förväg, kontrollerar att värdet är rimligt och sparar historiken, som inte går att ändra.

Pröva i demon: logga in som Tomas Lindh och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/regler).

## Uppdrag i testinbjudan

Uppdragen görs i demon under Testa (#/testa). De följer så långt det går Sussas användbarhetstestfall och ligger i den ordning en arbetsdag har dem. Systemet bockar av ett uppdrag själv när det har hänt, och ett uppdrag som går ut på att hitta något har en fråga som systemet rättar.

### Systemförvaltare

Du arbetar som Tomas Lindh, systemförvaltare. Sussas testfall har inga uppdrag för systemförvaltare, så uppdragen här är förvaltningens vanliga arbetsflöden. Ingen ändring gäller innan en andra systemförvaltare har godkänt den.

1. Godkänn en ändring.
   Den andra systemförvaltaren har föreslagit en ändrad regel. Granska den och godkänn eller avslå den.
2. Föreslå en ändrad regel.
   Föreslå att en regel eller parameter ändras, till exempel hur många journalöppningar loggkontrollen tar stickprov på.
3. Ändra en journalmall eller ett mätvärde.
   Föreslå en ny journalmall eller en ny mätvärdestyp, till exempel midjemått.
4. Bygg ett formulär.
   Bygg ett enkelt bedömningsformulär och föreslå det.
5. Lägg in en ny utgåva av ett kodverk.
   Lägg in en ny utgåva av ett kodverk, till exempel några nya diagnoskoder.
6. Förbered ett namnbyte.
   Kardiologiska mottagningen ska byta namn nästa månad. Förbered namnbytet.
7. Kontrollera säkerhetskopian.
   Kontrollera att säkerhetskopian går att läsa tillbaka.

## Det här ska du kunna efter utbildningen

- Föreslå en ändrad regel och godkänna en annan systemförvaltares förslag.
- Förbereda ett namnbyte för en enhet.
- Registrera en extern tillämpning på sidan Öppet API.
- Kontrollera att säkerhetskopian går att läsa tillbaka.
- Göra de vanliga arbetsflödena ovan inom klickbudgeten.
- Svara rätt på alla 3 övningar och få intyget.
