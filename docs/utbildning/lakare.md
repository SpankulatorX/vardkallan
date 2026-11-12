# Utbildning i Vårdkällan: Läkare

Det här materialet hör till Grundkurs i Vårdkällan. Det skrivs ur Vårdkällans egna register, så att arbetsflödena, filmerna, övningarna och uppdragen alltid är de som finns i systemet.

## Vad du gör i Vårdkällan

Som läkare läser du journalen för dina patienter, skriver och signerar anteckningar, ordinerar och sätter ut läkemedel, skickar remisser och kvitterar svar, ställer diagnoser och skriver epikriser. Du arbetar oftast från arbetslistan och patientens översikt. Nödåtkomst och uppgifter från andra vårdenheter kräver ett aktivt val med syfte, som systemet föreslår och loggar.

Systemet är experten, inte du. Det betyder att systemet fyller i det som det kan räkna ut ur sammanhanget, till exempel vårdkontakt, enhet, tid och koder. Det föreslår nästa steg och kontrollerar mot regler och kodverk innan något sparas.

När något inte går, eller när systemet varnar, står det på vanlig svenska varför och vad du kan göra i stället. Du behöver aldrig kunna kodverk, regler eller lagtext för att göra rätt.

I demon väljer du en demoroll under Personal på startsidan. Demorollerna för din yrkesroll är:

- Sara Lindqvist, Läkare
- Erik Nyström, Läkare
- Per Holm, Läkare (distriktsläkare)
- Lena Ström, Läkare
- Martin Ödman, Anestesiläkare
- Rebecka Ståhl, Läkare (onkologi)

Alla patienter i demon är påhittade och har testpersonnummer från Skatteverket. Varje besökare får en egen sandlåda, så det du gör påverkar ingen annan.

## Vanliga arbetsflöden

Varje arbetsflöde har en klickbudget: det största antalet klick, fältbyten och tangenttryck som flödet får kräva. Budgeten mäts automatiskt i gränssnittet efter varje ändring, så att ett flöde inte blir krångligare utan att det märks.

### Öppna patient från arbetslistan

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 1 steg. I demon gör Sara Lindqvist flödet.

Ett klick på patientens namn. Översikten med läkemedel, diagnoser, mätvärden och senaste anteckningar ska synas direkt, utan flikbyte.

### Läsa senaste anteckning

Börjar i: Patientens översikt. Klickbudget: högst 1 steg. I demon gör Sara Lindqvist flödet.

Ett klick på den senaste anteckningen i översikten, som då visas i sin helhet.

### Skriva och signera en daganteckning

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Ett klick för att öppna en ny anteckning, ett fältbyte för vart och ett av de två sökord som skrivs (Aktuellt och Bedömning) och ett klick för att signera. Mallen Daganteckning och den pågående vårdkontakten ska vara förvalda.

### Ordinera ett läkemedel utan varning

Börjar i: Patientens översikt. Klickbudget: högst 7 steg. I demon gör Sara Lindqvist flödet.

Ett klick för att öppna ordinationen, ett fältbyte till sökfältet och ett klick på träffen, ett fältbyte vardera för dosering och ordinationsorsak, ett klick för uppföljningsdatum och ett för att spara. Utan varningar ska kontroll och sparande ske med samma klick. Systemet föreslår dosering, tider och uppföljning ur produkten och patienten (Sussa 3.5.1.3), så doseringen behöver bara skrivas när förslaget inte passar.

### Sätta ut ett läkemedel

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Ett klick till läkemedelslistan, ett på Sätt ut för raden, ett fältbyte för den obligatoriska orsaken och ett klick för att bekräfta.

### Bekräfta föreslagen uppmärksamhetsinformation

Börjar i: Patientens översikt. Klickbudget: högst 1 steg. I demon gör Sara Lindqvist flödet.

Systemet har själv hittat Waran i läkemedelslistan och föreslår antikoagulantiabehandling som uppmärksamhetsinformation. Förslaget visas under patienthuvudet, och ett klick på Bekräfta registrerar det. Inget skrivs in, och kategori, kod och källa sätts av systemet.

### Skicka remiss

Börjar i: Patientens översikt. Klickbudget: högst 7 steg. I demon gör Per Holm flödet.

Ett klick till remisserna och ett för att öppna en ny remiss, två klick för att välja mottagare i listan, ett fältbyte vardera för frågeställning och anamnes och ett klick för att skicka. Prioritet och sista svarsdatum ska ha rimliga förval.

### Kvittera remissvar

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Per Holm flödet.

Ett klick till inkorgen, ett på svaret, som då visas i sin helhet, och ett för att kvittera att svaret är läst. Svaret ska läsas före kvittensen, så kvittensen ligger inte direkt i inkorgen.

### Nödåtkomst

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 8 steg. I demon gör Erik Nyström flödet.

Ett klick till sök, ett fältbyte och Enter för sökningen, ett klick på träffen, ett på Nödåtkomst, ett för syftet, ett för intyget att patienten inte kan samtycka och ett för att öppna. Syfte och intyg krävs och ska inte gå att hoppa över.

### Registrera patient utan känd identitet

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 5 steg. I demon gör Erik Nyström flödet.

Sussa 3.1.1. Ett klick till sök och ett på Registrera ny patient, ett klick för kön, ett fältbyte för ungefärlig ålder och ett klick för att registrera. Identitetsfältet lämnas tomt, så skapar systemet reservnumret själv. Ingen typ av nummer väljs i en lista, och namnet kan saknas.

### Bekräfta ett hälsoärende

Börjar i: Patientens översikt. Klickbudget: högst 1 steg. I demon gör Sara Lindqvist flödet.

Ett klick på Bekräfta i systemets förslag. Systemet har redan sett att kontakterna har samma diagnos och vilka kontakter som hör ihop.

### Vidimera pågående ordinationer

Börjar i: Patientens översikt. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.9. Ett klick till läkemedelslistan, där systemet visar vad som har ändrats sedan den senaste vidimeringen, och ett klick för att vidimera hela listan.

### Sätta ut ett läkemedel med varning

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.8. Ett klick till läkemedelslistan, ett på Sätt ut för raden, ett fältbyte för den obligatoriska orsaken och ett klick för att sätta ut trots varningen. Systemet visar varningen och ett förslag på nedtrappning innan något sparas, och orsaken är motiveringen, så inget extra fält behövs.

### Sätta ut Waran med plan

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.8. Ett klick till läkemedelslistan, ett på Sätt ut för Waran, ett på den plan som gäller och ett på Jag har en plan. Systemet förklarar risken för blodpropp och stroke, föreslår planerna med nytt medel eller datum för återinsättning ifyllt och skriver orsaken ur planen, så inget behöver skrivas.

### Skriva ut läkemedelslistan vid utskrivning

Börjar i: Patientens översikt. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.9. Ett klick på Skriv ut och ett för att skriva ut. Patienten är inlagd, så systemet föreslår syftet Läkemedelslista till patienten vid utskrivning, väljer läkemedelslistan och registrerar att kopian lämnas ut till patienten. Utskriften får ett utskrifts-id och loggas.

### Begära kontrasignering av en anteckning

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.11.3. Ett klick på den senaste anteckningen, ett på Begär kontrasignering och ett för att skicka. Systemet föreslår överläkaren på samma vårdenhet som får läsa anteckningen, och aldrig den som signerade.

### Kontrasignera en anteckning

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.11.3. Ett klick till inkorgen, ett på begäran, som öppnar anteckningen i sin helhet, och ett på Kontrasignera. Anteckningen ska läsas före kontrasigneringen, så knappen ligger inte direkt i inkorgen.

### Sätta upp ett återbesök

Börjar i: Patientens översikt. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.4.1.1. Ett klick på Återbesök och ett för att bekräfta systemets förslag. Systemet har läst tidstyp, yrkesroll och tidsram ur anteckningens planering, diagnosen och den senaste kontakten, och posten hamnar på väntelistan och i vårdadministratörens Dagens arbete.

### Sätta in Waran igen efter ett uppehåll

Börjar i: Arbetslistan dagen före en återinsättning. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.8. Ett klick till inkorgen, ett på Sätt in igen för raden som systemet har lagt dit dagen före och ett för att spara. Systemet fyller i läkemedlet, doseringen, ordinationsorsaken och uppföljningen ur den ordination som gjorde uppehåll, så inget behöver skrivas, och raden försvinner när läkemedlet är insatt.

### Avsluta behandlingen efter ett uppehåll

Börjar i: Arbetslistan dagen före en återinsättning. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.8. Ett klick till inkorgen, ett på Avslutad behandling för raden och ett för att avsluta. Systemet föreslår orsaken och har den vanligaste förvald, sparar vem och när, och raden försvinner för alla som har fått den.

### Avvisa en remiss och sätta ut läkemedlet

Börjar i: Inkommande remisser med en vårdhändelse som väntar. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.7. Ett klick på Bedöm, ett på Avvisa, ett fältbyte för motiveringen och ett för att spara. När Avvisa väljs visar systemet att tiden för vårdhändelsen avbokas och vilket läkemedel som väntar på den, med Sätt ut förvalt och orsaken ifylld, så beslutet fattas medan läkaren har åtkomst.

### Sätta upp en standardvårdplan

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.2.2.1. Ett klick på Sätt upp vårdplanen vid systemets förslag och ett för att upprätta planen. Systemet har valt standardplanen ur diagnosen och fyllt i mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, så inget fält behöver fyllas i.

### Registrera ett intagningsbeslut

Börjar i: Översikten för en patient som väntar på beslut om intagning. Klickbudget: högst 4 steg. I demon gör Lena Ström flödet.

Sussa 3.2.3.1. Ett klick på Besluta om intagning, ett för att bekräfta undersökningen och bedömningen enligt 3 § LPT och ett för att besluta. Systemet har kontrollerat vårdintyget, vem som utfärdade det, uppdraget enligt 39 § och fristen på 24 timmar, räknar fristen för ansökan till förvaltningsrätten och skriver in patienten.

### Söka i journalen och öppna träffen

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.8.1. Ett fältbyte till sökfältet ovanför flikarna, Enter för att söka och ett klick på träffen. Systemet tolkar ordet blodtryck som mätvärdet, söker i allt läkaren får läsa och öppnar kurvan för blodtrycket.

### Ordinera från en mall med flera ordinationer

Börjar i: Patientens läkemedelsflik. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.1.3 och 3.5.2.14. Ett klick på Ordinera från mall, ett på mallen och ett för att ordinera. Systemet fyller i varje ordination ur produktens mall och patientens ålder och njurfunktion, varnar per ordination, tar själv bort ett läkemedel som patienten redan har och förklarar varför, och knyter ordinationerna till samma vårdhändelse.

### Godkänna en ändrad läkemedelsmall

Börjar i: Inkorgen efter återställning. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.1.3 och Gröna häftet 1.4.3. Den ändrade mallen ligger i den mallansvariga läkarens inkorg. Ett klick på Granska, som visar innehållet och vad som har ändrats mot den förra versionen, och ett på Godkänn. Systemet ersätter den förra versionen och sparar godkännandet med innehållet.

### Starta en extern tillämpning från journalen

Börjar i: Patientens översikt. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 5.1.1.4. Ett klick på fliken Tillämpningar och ett på Starta för Blodtryck över tid. Systemet ger tillämpningen patienten och den inloggade och sköter åtkomsten med SMART on FHIR och PKCE, så ingen behöver välja patient eller logga in igen.

### Ändra dosen i en pågående ordination

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.2.12 och testfall 1.1. Ett klick till läkemedelslistan, ett på Ändra dos för raden, ett på den nya styrkan, där systemet fyller i doseringen och dosen, och ett för att spara. Ordinationen fortsätter med samma orsak och uppföljning, utan att sättas ut och ordineras på nytt, och den nya doseringen gäller från i dag om inget annat datum väljs.

### Läsa nyheterna och stänga dem

Börjar i: Arbetslistan med nyheterna efter en ny version. Klickbudget: högst 1 steg. I demon gör Sara Lindqvist flödet.

Sussa 10.1.1.4. Nyheterna för rollen visas själva efter en ny version, utan att användaren behöver leta, och läses där de står. Ett klick på Stäng nyheterna, och de kommer inte tillbaka förrän nästa version.

### Fortsätta arbeta när inloggningen snart går ut

Börjar i: Arbetslistan när inloggningen snart går ut. Klickbudget: högst 1 steg. I demon gör Sara Lindqvist flödet.

K2 1.6.1. Fem minuter före utloggningen visar systemet en varning med fokus på knappen Fortsätt arbeta. Ett klick, eller Enter, förlänger inloggningen. Inget behöver skrivas.

### Fylla i tobaksmallen i en anteckning

Börjar i: Patientens översikt. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Sussa testfall 4.1. Ett klick på Dokumentera tobaksvanor i översikten, ett klick på Dagligen för cigaretter, som flyttar fokus till antalet och sätter svaret Ja själv, ett klick på Erbjudet och accepterat för det stöd som systemet föreslår och ett klick för att signera. Systemet räknar ut åtgärden och KVÅ-koden ur svaren och patientens ålder.

### Skriva och signera en epikris

Börjar i: Översikten för en inlagd patient. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa testfall 4.3. Ett klick på Skriv epikris vid vårdtillfället. Systemet har skrivit orsaken till vården ur vårdtillfället och diagnoserna och läkemedelsförändringarna ur ordinationerna, och fokus står i Förlopp. Ett fältbyte till Uppföljning och ett klick för att signera.

### Beställa ett standardpaket med prover

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 4.4.2.6 och testfall 3.1. Ett klick på patienten, ett på Beställ prover i översikten och ett på Beställ vid det paket som systemet föreslår ur vårdkontakten, diagnoserna och läkemedlen. Systemet väljer laboratorium, rör, provtagningsordning och anamnes, tar bort analyser som nyss är tagna och förklarar varför, och knyter beställningen till vårdkontakten.

### Öppna intensivvårdens översikt och övervakningen av en patient

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 4.6.1.2. Ett klick på Intensivvård i menyn och ett på patienten. Översikten har redan räknat larm, förslag, infusioner och vätskebalans för alla patienter på avdelningen, med de mest akuta först.

### Förskriva förbrukningsartiklar ur en mall

Börjar i: Översikten för en patient med insulin. Klickbudget: högst 2 steg. I demon gör Per Holm flödet.

Sussa 3.5.4.2 och 3.5.4.4. Ett klick till läkemedelsfliken och ett på Förskriv mallen vid den mall som systemet föreslår ur läkemedelslistan. Systemet väljer pennkanyler, lansetter och kanylburk, tar bort teststickorna som redan är förskrivna, räknar mängden för tre månader ur antalet injektioner och skriver anvisningen, giltigheten och uppföljningen.

### Visa en färdig patientgrupp

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Per Holm flödet.

Sussa 6.2.1.2. Ett klick på Analys och statistik och ett på Visa gruppen för den färdiga grupp som är förvald. Systemet skriver vad gruppen betyder och varför varje patient är med, och räknar bara på det som läkaren får se.

### Skriva ut en enskild anteckning

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.9.4. Ett klick till Journal, där den senaste signerade anteckningen redan är öppen, ett på Skriv ut anteckningen och ett på Skriv ut. Systemet väljer anteckningen, delen och syftet, loggar utskriften och sätter utskrifts-id:t.

### Registrera en överkänslighet

Börjar i: Patientens översikt. Klickbudget: högst 5 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.6.2. Ett klick på uppmärksamhetsraden och ett på Ny överkänslighet, där ämnet redan har fokus, ett fältbyte till reaktionen och ett klick för att registrera. Systemet slår upp ATC-koden ur ämnet och föreslår allvarlighetsgraden ur reaktionen, och basfakta, symbolen och varningarna vid ordination följer med.

### Söka bland vårdenhetens patienter på en diagnos

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.8.2. Ett klick på Sök patient, ett fältbyte till Sök i journalerna och Enter. Systemet gör om ordet förmaksflimmer till diagnoskoderna, prövar varje patient i behörighetsmotorn och säger varför patienten är med.

### Skicka en konsultation

Börjar i: Patientens översikt. Klickbudget: högst 7 steg. I demon gör Per Holm flödet.

Sussa 3.3.1.4. Ett klick på Skicka remiss, där formuläret öppnas med mottagaren i fokus, ett klick på Fråga om råd, två klick för att välja mottagare i listan, ett fältbyte vardera för frågeställning och anamnes och ett klick för att skicka. Prioritet och sista svarsdatum är förvalda, och systemet förklarar vad valet betyder för vårdansvaret.

### Skicka läkemedelsberättelsen till nästa vårdgivare

Börjar i: Översikten för den inlagda patienten efter återställning. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.5.1.1. Ett klick till läkemedelsfliken och ett på Skicka läkemedelsberättelsen. Systemet har tagit fram berättelsen ur ordinationernas historik, den aktuella listan och epikrisen, och valt mottagarna själv: vårdcentralen där patienten är listad och kommunen i den samordnade planeringen.

### Ge en vaccination i programmet för riskgrupper

Börjar i: Översikten för den inlagda patienten efter återställning. Klickbudget: högst 4 steg. I demon gör Per Holm flödet.

Sussa 3.5.1.7. Ett klick på fliken Vaccinationer, ett på Ge dosen vid den dos som systemet föreslår, ett på svaret att patienten är frisk i dag och ett för att registrera. Systemet har räknat ut att patienten ska ha dosen och varför, frågar om vaccinationer någon annanstans med nej förvalt, föreslår injektionsstället efter åldern, sätter ATC, dos och tid och rapporterar dosen till vaccinationsregistret.

### Hämta uppgifter från en annan vårdgivare

Börjar i: Översikten för den inlagda patienten efter återställning. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.2.2.3. Ett klick för patientens samtycke och ett på Hämta. Systemet föreslår syftet, registrerar samtycket och lägger uppgifterna från den andra vårdgivaren i tidslinjen med källan utskriven.

### Registrera en ankomst på akutmottagningen

Börjar i: Väntrummet efter återställning. Klickbudget: högst 4 steg. I demon gör Erik Nyström flödet.

Sussa 3.2.3.5. Ett klick på Ny ankomst, personnumret, ett fältbyte till kontaktorsaken och ett klick för att registrera. Systemet sätter könumret, ankomsttiden och akutbesöket och lägger patienten på flödestavlan och i väntrummet.

### Diktera och signera en daganteckning

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.3.2 och 3.1.3.7. Ett klick på Ny anteckning, ett på Diktera och ett för att signera. Resten görs med rösten: texten hamnar i det första tomma sökordet, gå till bedömning byter sökord och sluta diktera avslutar. Systemet sätter skiljetecken och stor bokstav, och signeringen görs alltid med knappen.

### Rätta en felstavad medicinsk term i en anteckning

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.3.10. Ett klick på Ny anteckning, där fokus står i Aktuellt, ett klick på förslaget som systemet visar under fältet och ett för att signera. Systemet kontrollerar texten själv när man slutar skriva.

### Pröva donation efter ett dödsfall på intensivvården

Börjar i: Inkorgen med ett förslag om donation. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.1.12.1. Ett klick på förslaget i inkorgen och ett på Starta donationsutredning. Systemet har redan identifierat den möjliga donatorn, slår upp Donationsregistret (simulerat) och bockar av det som går att räkna ut i checklistan.

### Förnya ett recept som patienten har bett om i Min journal

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 3.4.4.4 och 3.7.1.3. Ett klick på Meddelanden, ett på patientens begäran och ett på Receptet är förnyat. Systemet skapar avgiften för förnyelsen och skriver svaret till patienten, så läkaren skriver ingenting.

### Lägga in sin tidbok i kalenderprogrammet

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 5.1.1.1. Ett klick på Kontorsstöd och ett på Skapa kalenderlänk. Länken läggs in som prenumeration i Outlook eller ett annat kalenderprogram, som sedan hämtar tiderna själv varje timme.

### Visa en röntgenstudie ur arkivet med ett annat fönster

Börjar i: Patientens översikt. Klickbudget: högst 3 steg. I demon gör Sara Lindqvist flödet.

Sussa 4.2.1.3. Ett klick på fliken Bilder, ett på Visa bilderna och ett på fönstret Ben. Systemet hämtar studien från arkivet genom DICOMweb och har redan valt fönstret efter undersökningen.

### Beställa en röntgenundersökning

Börjar i: Översikten för den inlagda patienten efter återställning. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Sussa 4.4.2.6 och 4.4.2.8. Ett klick på Beställ prover i översikten, ett på Välj analyser, ett på undersökningen och ett på Beställ. Systemet fyller i frågeställningen ur vårdkontakten, föreslår prioriteten, kontrollerar strålning, kontrast och implantat och skickar beställningen till röntgenkliniken.

### Läsa in ett barns tillväxtdata från ett annat journalsystem

Börjar i: Tillväxten för ett barn som har flyttat hit. Klickbudget: högst 3 steg. I demon gör Per Holm flödet.

Sussa 4.1.1.7. Ett klick för att öppna inläsningen, ett på Hämta från journalsystemet och ett på Läs in. Systemet hämtar mätningarna med GetObservations, kontrollerar att de gäller barnet, prövar varje värde och visar vad som redan finns, så att användaren bara bekräftar.

### Godkänna en cytostatikakur

Börjar i: Journalen för patienten med cytostatika. Klickbudget: högst 2 steg. I demon gör Rebecka Ståhl flödet.

Sussa 4.8.1.1 och 4.8.1.4. Ett klick på fliken Cytostatika och ett på Godkänn kuren. Systemet har räknat doserna med dagens vikt, prövat provsvaren, den kumulativa dosen och beredningsenhetens platser och skickar beredningsordern i samma klick.

### Godkänna en ny version av en cytostatikaregim

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 3 steg. I demon gör Rebecka Ståhl flödet.

Sussa 4.8.1.4. Ett klick på Cytostatika i menyn, ett på Regimbiblioteket och ett på Godkänn. Systemet har skrivit vad som skiljer versionen från den gällande, och bara en regimansvarig läkare som inte skrev versionen ser knappen.

### Beställa blod

Börjar i: Journalen för patienten med cytostatika. Klickbudget: högst 3 steg. I demon gör Rebecka Ståhl flödet.

Sussa 4.4.2.12. Ett klick på fliken Blod, ett fältbyte till indikationen och ett klick på Beställ. Erytrocyter och två enheter är förvalda, och systemet beställer själv blodgruppering och bastest som saknas.

### Lämna en synpunkt

Börjar i: Arbetslistan efter inloggning. Klickbudget: högst 4 steg. I demon gör Sara Lindqvist flödet.

Ett klick på Lämna synpunkt, som syns på varje sida. Textfältet har fokus direkt, så testaren skriver utan fältbyte. Ett klick för vad det gäller, ett för hur allvarligt det är och ett på Skicka. Sidan, demorollen, uppdraget, versionen, skärmbredden, webbläsaren och tiden fyller systemet i själv, och yrke och journalsystem kommer från startsidan om testaren har fyllt i dem där.

### Välja yrkesroll och starta första uppdraget

Börjar i: Startsidan för testare. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Ett klick på yrkesrollen, som loggar in i rätt demoroll och startar uppdragen i panelen, och ett klick på en patient i arbetslistan för det första uppdraget. Systemet bockar av uppdraget själv och ställer jämförelsefrågan.

### Skriva ett intyg i intygsapplikationen

Börjar i: Journalen för patienten på vårdcentralen. Klickbudget: högst 2 steg. I demon gör Per Holm flödet.

Sussa 2.2.1.9. Ett klick på fliken Intyg och ett på Skriv intyget. Systemet har föreslagit det intyg som passar patienten och visar bara de intyg som får skrivas, och utkastet öppnas i intygsapplikationen med patienten, läkaren, vårdenheten och diagnosen ifyllda.

### Skicka en e-remiss till en vårdgivare utanför Vårdkällan

Börjar i: Journalen för patienten på vårdcentralen. Klickbudget: högst 3 steg. I demon gör Per Holm flödet.

Sussa 2.2.1.12 och 3.3.1.2. Ett klick på fliken Remisser, ett på Skicka e-remiss och ett på Skicka. Frågeställningen har fokus direkt, mottagare och prioritet är förvalda, och patienten, remittenten, vårdenheten och diagnoserna från den egna vårdenheten fyller systemet i.

### Läsa en äldre anteckning ur mellanarkivet

Börjar i: Patientens översikt. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 5.4.2.2. Ett klick på fliken Journal och ett på anteckningen, som står bland de andra märkt Ur mellanarkivet. Ingen behöver veta att mellanarkivet finns eller söka där: systemet hämtar handlingen, prövar behörigheten och säger att innehållet är oförändrat.

### Logga in genom vårdgivarens inloggningstjänst

Börjar i: Inloggningssidan med en inkopplad inloggningstjänst. Klickbudget: högst 2 steg. I demon gör Sara Lindqvist flödet.

Sussa 5.2.1.1. Ett klick på tjänsten på inloggningssidan och ett på Logga in i tjänsten. Uppdraget, vårdenheten och behörigheten kommer ur biljetten och katalogen, så personen väljer ingenting i Vårdkällan. I en verklig tjänst ersätts klicket i tjänsten av SITHS-kortet.

## Instruktionsfilmer

Filmerna visar ett arbetsflöde från början till slut med textade steg på svenska. De spelas in på nytt efter varje ändring i gränssnittet, så att de alltid visar det gränssnitt som finns.

### Skriva och signera en daganteckning

Läkaren skriver en daganteckning i patientens översikt och signerar den. Systemet fyller i vårdkontakt, enhet och tid.

Flöde: Skriva och signera en daganteckning, klickbudget 4. [Se filmen](../filmer/daganteckning.webm)

### Ordinera ett läkemedel

Läkaren ordinerar ett läkemedel. Systemet föreslår dos och kontrollerar mot överkänslighet och andra läkemedel innan ordinationen sparas.

Flöde: Ordinera ett läkemedel utan varning, klickbudget 7. [Se filmen](../filmer/ordinera.webm)

### Skicka en remiss

Distriktsläkaren skickar en remiss. Systemet föreslår mottagare och fyller i patientens uppgifter.

Flöde: Skicka remiss, klickbudget 7. [Se filmen](../filmer/remiss.webm)

### Nödåtkomst

Läkaren på akutmottagningen öppnar journalen för en patient utan vårdrelation. Systemet kräver syfte, loggar åtkomsten och häver aldrig en spärr.

Flöde: Nödåtkomst, klickbudget 8. [Se filmen](../filmer/nodatkomst.webm)

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

Pröva i demon: logga in som Sara Lindqvist och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/patient/p01).

### Övning 4

Demopatienten Elin Sandberg har spärrat uppgifter. Vad ser du som inte arbetar på den spärrade vårdenheten?

Rätt svar: En spärrmarkering, men inte innehållet eller vilken vårdenhet det gäller. Spärren hävs bara med patientens samtycke i stunden.

En spärr hävs bara tillfälligt med patientens samtycke, och nödåtkomst häver aldrig en spärr.

### Övning 5

En patient har skyddade personuppgifter. Vad visar systemet i arbetslistan och väntrummet?

Rätt svar: Skyddad identitet i stället för namnet, och adressen visas aldrig. Väntrummet visar bara könummer.

Systemet maskerar skyddad identitet överallt utan att någon behöver komma ihåg det. Visa identitet kräver ett syfte och loggas.

Pröva i demon: logga in som Sara Lindqvist och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/arbetslista).

### Övning 6

Du ordinerar amoxicillin till demopatienten Gunnar Åkesson, som är överkänslig mot penicilliner. Vad gör systemet?

Rätt svar: Varnar innan ordinationen sparas och kräver en motivering om du ändå vill ordinera.

Ordinationen kontrolleras mot överkänslighet och andra läkemedel innan den sparas. En allvarlig varning kräver en motivering, som sparas med ordinationen.

Pröva i demon: logga in som Sara Lindqvist och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/patient/p01/lakemedel).

### Övning 7

Patienten saknar vårdrelation till din vårdenhet och kan inte samtycka, men du behöver journalen för vården. Vad gäller?

Rätt svar: Du väljer Nödåtkomst med ett syfte. Åtkomsten flaggas i loggen och följs upp, och en spärr hävs aldrig.

Nödåtkomst kräver syfte och intyg om att patienten inte kan samtycka. Den syns för logggranskaren.

Pröva i demon: logga in som Sara Lindqvist och öppna [samma ställe i demon](https://vardkallan.404haven.se/#/sok).

## Praktiska prov

Ett praktiskt prov görs på riktigt i en övningsjournal, som är en av demons påhittade patienter. Systemet kontrollerar själv att det blev rätt och säger på vanlig svenska vad som saknas. Utbildaren eller verksamhetschefen startar proven för vårdenheten. Ett godkänt prov gäller i ett år.

### Ordinera paracetamol vid behov

Öppna fliken Läkemedel i journalen för patienten i övningsjournalen och ordinera paracetamol vid behov mot smärta, med orsak och uppföljning. Kontrollera provet när ordinationen är sparad.

### Skriva och signera en journalanteckning

Öppna fliken Journal för patienten i övningsjournalen, skriv en anteckning och signera den. Kontrollera provet när anteckningen är signerad.

## Uppdrag i testinbjudan

Uppdragen görs i demon under Testa (#/testa). De följer så långt det går Sussas användbarhetstestfall och ligger i den ordning en arbetsdag har dem. Systemet bockar av ett uppdrag själv när det har hänt, och ett uppdrag som går ut på att hitta något har en fråga som systemet rättar.

### Läkare på sjukhus

Du arbetar som Sara Lindqvist, läkare på kardiologiska kliniken. Avdelning 72 motsvarar Sussas medicinavdelning.

1. Ta emot dagens första patient.
   Öppna journalen för en av dina patienter i arbetslistan och läs den senaste anteckningen.
2. Överblicka provsvar (Sussas testfall 3.4).
   Leta rätt på provsvaret PK som en läkare på vårdcentralen beställde, taget en viss dag klockan 11.36.
   Läs upp provsvaret.
   Fråga: Vilket värde hade PK-provet?
3. Ordinera läkemedel (Sussas testfall 1.2).
   Paracetamol Panpharma 10 mg/ml infusion 100 ml som engångsordination, ges som intravenös infusion under 15 minuter.
   Glukos 25 mg/ml buffrad 1000 ml med Addex Magnesium 20 mmol, ges på två timmar.
   Stesolid 10 mg som premedicinering en timme före röntgen.
   Klart när: Läkemedlen är ordinerade.
4. Ordinera ett läkemedel och ta ställning till varningen.
   Ordinera ibuprofen vid behov till Gunnar Åkesson, som har Waran. Läs varningen från systemet och bestäm om ordinationen ska göras.
5. Upprätta en labbeställning (Sussas testfall 3.1).
   P-CRP, B-Blodstatus och P-Kreatinin till kemlab i dag klockan 9.
   Blododling till baktlab med anamnes.
   Spara eller skicka.
   Klart när: Beställningen är sparad, skickad eller verkställd.
6. Ta emot vårdbegäran (Sussas testfall 2.3).
   Fördela Berit Strandhall till bakjouren, en namngiven läkare.
   Sätt Gerda Ström på väntelistan för besök om två månader.
   Avvisa Elin Arnströms remiss på grund av fel vårdnivå med en svarstext.
   Skicka Trevis Ljungs remiss vidare till psykiatriska kliniken.
   Klart när: De fyra remisserna är fördelade, prioriterade, avvisade eller vidareskickade.
7. Besvara en vårdbegäran (Sussas testfall 2.6).
   Du har just träffat Sara Sandmark på mottagningen.
   Besvara vårdbegäran från vårdcentralen med texten: Tack för remissen. Vi har träffat Sara och gett henne rätt behandling.
   Skicka svaret.
   Klart när: Remissvaret är skickat.
8. Upprätta och skicka vårdbegäran (Sussas testfall 2.1).
   Mottagare Hudkliniken.
   Frågeställning: Hudförändring, malignt?
   Anamnes: Pat har en hudförändring på låret som har förändrats snabbt. Är det malignt?
   Skicka vårdbegäran.
   Klart när: Vårdbegäran är skickad.
9. Överblicka patientens planering (Sussas testfall 7.3).
   Visa den samlade bilden av Bertil Danielssons händelser.
   Meddela vilken händelse som äger rum klockan 15.
   Fråga: Vilken händelse har Bertil Danielsson klockan 15?
10. Hitta information från tidigare slutenvårdstillfälle (Sussas testfall 6.3).
   Sök epikrisen från vårdtillfället 2016-03-22 till 2016-03-26.
   Öppna den och hitta huvuddiagnosen.
   Fråga: Vilken var huvuddiagnosen vid det tidigare vårdtillfället?
11. Skapa slutanteckning eller epikris (Sussas testfall 4.3).
   Epikris för vårdtillfället på avdelningen med diagnosen sepsis.
   Vårdförlopp, bedömning och planering med Sussas texter.
   Signera.
   Klart när: Informationen är inmatad och anteckningen är signerad.
12. Visualisera en specifik resurs arbetsplanering (Sussas testfall 7.4).
   Visa läkarens arbetsuppgifter under perioden.
   Meddela vilken arbetsuppgift som äger rum klockan 11.
   Fråga: Vilken arbetsuppgift har läkaren klockan 11?

### Läkare i primärvården

Du arbetar som Per Holm, distriktsläkare på Vårdcentralen Tybble, som motsvarar Sussas vårdcentral.

1. Överblicka ankomstregistrering (Sussas testfall 5.6).
   Sök fram dina patienter som har kommit i dag.
   Meddela antalet.
   Fråga: Hur många av dina patienter har kommit i dag?
2. Ta emot dagens första patient.
   Öppna journalen för en av patienterna som har kommit och läs den senaste anteckningen.
3. Registrera mätvärden (Sussas testfall 4.2).
   Längd 165 cm, vikt 75 kg, blodtryck 140/90 mmHg och puls 83 slag per minut.
   Klart när: Mätvärdena är inmatade i journalen.
4. Skapa anteckning (Sussas testfall 4.1).
   Rökare ja, 25 cigaretter per dag, rökavvänjning erbjuden och accepterad, och en kommentar.
   Klart när: Informationen är inmatad på ett strukturerat sätt i journalen.
5. Förskriva läkemedel (Sussas testfall 1.1).
   Förskriv Alvedon 1 g tablett vid behov mot värk, tillsvidare.
   Förskriv Kloramfenikol ögondroppar 5 mg/ml, 1 droppe 6 gånger dagligen i en vecka i höger öga, tidsbegränsat.
   Förskriv Sertralin 50 mg, en halv tablett i 6 dagar och därefter en tablett varje morgon, med uppföljning om två veckor och provförpackning.
   Ändra dosen av Metformin till 850 mg morgon och kväll och byt ut receptet mot ett nytt.
   Skicka förskrivningen.
   Klart när: Tre läkemedel är förskrivna och dosen är ändrad.
6. Upprätta en labbeställning (Sussas testfall 3.1).
   P-CRP, B-Blodstatus och P-Kreatinin till kemlab i dag klockan 9.
   Blododling till baktlab med anamnes.
   Spara eller skicka.
   Klart när: Beställningen är sparad, skickad eller verkställd.
7. Upprätta en beställning eller ordination på intern analys eller mätvärde (Sussas testfall 3.5).
   Puls, blodtryck, sänkningsreaktion, temperatur och vikt i morgon klockan 7.
   Följ vätskebalansen det kommande dygnet.
   Spara, signera eller verkställ.
   Klart när: Beställningen är sparad, signerad eller verkställd.
8. Upprätta och skicka vårdbegäran (Sussas testfall 2.1).
   Mottagare Hudkliniken.
   Frågeställning: Hudförändring, malignt?
   Anamnes: Pat har en hudförändring på låret som har förändrats snabbt. Är det malignt?
   Skicka vårdbegäran.
   Klart när: Vårdbegäran är skickad.
9. Kvittera ett remissvar.
   Ett svar på en remiss som du har skickat har kommit. Läs det och kvittera att du har sett det.
10. Signera (Sussas testfall 4.4).
   Signera alla osignerade poster.
   Klart när: Alla osignerade poster är signerade.

## Det här ska du kunna efter utbildningen

- Öppna en patient från arbetslistan och läsa översikten.
- Skriva och signera en daganteckning.
- Ordinera ett läkemedel och ta ställning till en varning.
- Skicka en remiss och kvittera ett remissvar.
- Veta när nödåtkomst får användas och vad som loggas.
- Göra de vanliga arbetsflödena ovan inom klickbudgeten.
- Svara rätt på alla 7 övningar och få intyget.
