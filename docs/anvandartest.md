# Användartest av Vårdkällan: protokoll för testledaren

Det här protokollet beskriver hur ett användartest av Vårdkällans demo går till, från rekrytering till sammanställning. Det är skrivet för dig som leder testet. Testet görs med testläget i demon, som du når från inloggningssidan (länken Användartest) eller på adressen `#/anvandartest`.

## Syfte

Kravet D6 i Vårdkällans kravregister lyder: klickbudget per vanligt arbetsflöde, mätt med verkliga användare. Varje vanligt arbetsflöde har en budget, ett största antal steg som flödet får kräva. Budgetarna och motiveringarna står på sidan Kravspårbarhet och i `app/src/klickbudget.js`. Hittills har stegen mätts med ett skript som gör flödena i en webbläsare. Skriptet vet exakt var det ska klicka, så det mäter den kortaste vägen. Användartestet visar hur många steg det tar för en person som arbetar i vården och möter systemet för första gången, var personen tvekar eller tar omvägar, och hur personen upplever systemet.

Testet ska svara på tre frågor:

1. Klarar deltagarna de vanliga arbetsflödena utan hjälp?
2. Hur många steg behöver de, jämfört med budgeten och med skriptets mätning?
3. Hur upplever de systemet, mätt med System Usability Scale (SUS) och tre öppna frågor?

## Uppgifterna

Testläget har en uppgift per flöde i klickbudgeten. Uppgiften beskriver en situation i vården och säger inte var man ska klicka. Testläget loggar in rätt demoroll och visar rätt startsida innan uppgiften börjar, så att alla deltagare börjar på samma ställe som skriptet. När demorollen byts återställs demon, så att patienterna är som från början.

| Uppgift | Demoroll i testet | Börjar i | Budget (steg) | Målgrupp |
|---|---|---|---|---|
| Öppna patient från arbetslistan | Läkare, kardiologen | Arbetslistan | 1 | Läkare |
| Läsa senaste anteckning | Läkare, kardiologen | Patientens översikt | 1 | Läkare |
| Skriva och signera en daganteckning | Läkare, kardiologen | Patientens översikt | 4 | Läkare |
| Ordinera ett läkemedel utan varning | Läkare, kardiologen | Patientens översikt | 7 | Läkare |
| Sätta ut ett läkemedel | Läkare, kardiologen | Patientens översikt | 4 | Läkare |
| Registrera blodtryck | Sjuksköterska, avdelning 72 | Patientens översikt | 3 | Sjuksköterskor |
| Skicka remiss | Distriktsläkare, vårdcentral | Patientens översikt | 7 | Läkare |
| Kvittera remissvar | Distriktsläkare, vårdcentral | Arbetslistan | 3 | Läkare |
| Nödåtkomst | Läkare, akuten | Arbetslistan | 8 | Läkare |

Välj uppgifter efter deltagarens yrkesroll när du startar testet:

- Läkare gör alla uppgifter utom Registrera blodtryck.
- Sjuksköterskor gör Öppna patient från arbetslistan, Läsa senaste anteckning och Registrera blodtryck. De två första görs i demon med läkarens roll, men sidorna ser likadana ut. De räknas in i sammanställningen för alla deltagare, inte för målgruppen.
- Undersköterskor, vårdadministratörer och medicinska sekreterare kan göra Öppna patient från arbetslistan och Läsa senaste anteckning. Deras erfarenheter är värdefulla, men det finns ännu inga flöden i klickbudgeten som är skrivna för deras arbete.

Uppgifterna görs alltid i den ordning testläget visar dem, eftersom några bygger på varandra.

## Antal deltagare

Planera för minst fem deltagare per yrkesroll som ska bedömas, alltså minst fem läkare och fem sjuksköterskor.

Fem deltagare per grupp är vanlig praxis i användbarhetstest. Nielsen och Landauer visade att de flesta användbarhetsproblem i ett gränssnitt hittas med ett fåtal testpersoner, och att varje ny person ger mindre ny kunskap (Nielsen och Landauer 1993). Nielsen rekommenderar därför flera små test med omkring fem personer i stället för ett stort (Nielsen 2000). Rekommendationen gäller en grupp användare som liknar varandra. Användare med olika arbetsuppgifter behöver egna grupper, och därför räknas fem per yrkesroll.

Fem är ett golv, inte ett mål. Faulkner visade att fem personer i olika försök hittade mellan 55 och 99 procent av problemen, och att spridningen minskar med fler deltagare (Faulkner 2003). För siffror som median och andel slutförda behövs fler: Nielsen rekommenderar omkring 20 deltagare när syftet är att mäta och jämföra (Nielsen 2006). Med fem deltagare är medianen ett grovt mått. Har du möjlighet, testa med åtta till tio personer per yrkesroll.

## Rekrytering

Deltagarna ska arbeta i vården i dag och använda ett journalsystem i sitt arbete. Sprid förfrågan brett, till exempel via verksamhetschefer, fackliga kanaler eller nätverk för vårdpersonal, och be om personer med olika lång erfarenhet och från olika verksamheter. Undvik att bara rekrytera personer som är särskilt intresserade av it, eftersom de inte är representativa.

Testet tar 30 till 45 minuter. Om testet görs på arbetstid behöver deltagaren chefens godkännande. Erbjud gärna att testet görs på deltagarens arbetsplats.

Om testet görs som en del av forskning, till exempel ett examensarbete, kan lagen (2003:460) om etikprövning av forskning som avser människor bli aktuell. Fråga lärosätet innan du börjar.

## Information och samtycke

Läs upp eller lämna över informationen nedan innan testet börjar. Fråga sedan om deltagaren vill vara med. Samtycket är muntligt. Notera det på ditt anteckningsblad med deltagarkoden, inte med namn.

---

**Information till dig som deltar i användartestet av Vårdkällan**

Vårdkällan är ett vårdinformationssystem med öppen källkod. Det du testar är en demo, inte ett system som används i vården. Vi vill veta hur systemet fungerar för den som arbetar i vården.

Det är systemet som testas, inte du. Det finns inga fel svar. När något är svårt är det precis det vi behöver veta.

Du får ett antal uppgifter, en i taget, längst ner på skärmen. Gör uppgiften som du skulle göra den i ditt arbete och tryck på Klar när du tycker att du är klar. Vill du inte fortsätta med en uppgift trycker du på Hoppa över. Säg gärna högt vad du tänker medan du arbetar. Testledaren svarar inte på frågor om hur systemet fungerar under uppgifterna. Efter uppgifterna svarar du på en kort enkät.

Alla patienter i demon är påhittade, med testpersonnummer från Skatteverket. Inga riktiga patientuppgifter finns i systemet.

Systemet räknar dina klick, fältbyten och tangenttryck och mäter tiden för varje uppgift. Det du skriver i fälten sparas inte. Om dig sparas bara din yrkesroll och hur länge du har arbetat med journalsystem. Du får en kod i stället för ditt namn, och ingenting sparas som kan kopplas till dig. I enkäten ska du inte skriva namn eller andra personuppgifter. Inget skickas till servern. Resultatet finns bara i webbläsaren tills testledaren har sparat det.

Det är frivilligt att delta. Du kan avbryta när du vill, utan att säga varför.

---

Spela inte in ljud eller bild under testet. Det behövs inte för mätningen, och en inspelning är en personuppgift.

## Förberedelser

1. Använd en dator med mus och en skärm som är minst 1280 pixlar bred, så att demon visas som på en vanlig arbetsdator. Ha en aktuell version av Chrome, Edge eller Firefox.
2. Gör ett provtest med en kollega innan det första riktiga testet, så att du vet hur testläget fungerar och hur lång tid det tar.
3. Förbered ett anteckningsblad per deltagare med deltagarkoden, uppgifterna i ordning och plats för observationer.
4. Bestäm deltagarkoderna i förväg, till exempel L01 till L10 för läkare och S01 till S10 för sjuksköterskor. Koden får inte innehålla namn, initialer eller födelsedatum. Testläget tar inte emot koder med sex siffror i rad.

## Genomförande steg för steg

1. Öppna ett nytt privat webbläsarfönster (inkognito). Då får deltagaren en egen sandlåda i demon, och inget finns kvar från ett tidigare test.
2. Gå till demon och tryck på länken Användartest på inloggningssidan.
3. Läs informationen för deltagaren och fråga om samtycke.
4. Skriv in deltagarkoden, välj uppgifter efter deltagarens yrkesroll och tryck på Starta testet.
5. Berätta hur det går till att tänka högt: "Säg vad du tittar efter, vad du tänker göra och vad du förväntar dig ska hända." Visa listen längst ner och knapparna Börja uppgiften, Klar och Hoppa över.
6. Låt deltagaren läsa uppgiften och själv trycka på Börja uppgiften. Från det trycket räknas stegen och tiden.
7. Under uppgiften hjälper du inte. Du får bara påminna om att tänka högt, med neutrala frågor som "Vad tänker du nu?" eller "Vad letar du efter?". Säg inte om något är rätt eller fel, och peka inte på skärmen.
8. Om deltagaren ber om hjälp, fråga först: "Vad skulle du göra om du satt ensam?" Är deltagaren fortfarande fast och vill ha hjälp, tryck på Hjälp behövdes innan du hjälper, och hjälp sedan så lite som möjligt. Varje tryck registreras med tiden i uppgiften. Deltagaren kan också trycka på knappen själv.
9. Om deltagaren vill ge upp, eller om uppgiften har pågått i fem minuter utan att deltagaren kommer vidare, föreslå Hoppa över.
10. Deltagaren trycker själv på Klar. Säg inte om uppgiften blev rätt gjord. Testläget registrerar för sig om uppgiftens mål syntes på skärmen.
11. Skriv på anteckningsbladet vad som hände: var deltagaren tvekade, vad deltagaren sa, vad som var oväntat. Skriv inga namn.
12. När uppgifterna är klara loggas deltagaren ut och enkäten visas. Låt deltagaren fylla i den själv utan att du tittar på eller kommenterar svaren.
13. Resultatet visas efter enkäten. Tryck på Ladda ner resultatfil och spara filen, och tryck gärna också på Kopiera som text och spara texten som reserv. Filnamnet innehåller deltagarkoden och datumet.
14. Tryck på Avsluta och rensa och stäng det privata fönstret. Då raderas allt som testläget har sparat i webbläsaren.
15. Tacka deltagaren och fråga om det är något mer deltagaren vill berätta.

Testläget kan avbrytas när som helst med Avbryt testet i listen, innan en uppgift har börjat. Allt som har mätts raderas då.

## Vad testläget mäter

Stegen räknas med samma regler som skriptet för klickbudgeten, så att siffrorna går att jämföra:

- **Klick**: varje musklick på en knapp, länk, kryssruta, rad eller annat som går att klicka på. En rullgardinslista som ändras räknas som två klick, att öppna och att välja.
- **Fältbyte**: varje gång deltagaren själv flyttar sig till ett textfält, med musen eller med Tab. Ett fält där systemet redan har satt markören räknas inte.
- **Tangent**: tangenter som inte är text, till exempel Enter för att skicka en sökning. Det som skrivs och tangenter som används för att skriva och rätta text räknas inte.

Klick på ytor som inte går att klicka på räknas för sig (`ovrigaKlick`) och ingår inte i stegen. Klick i testlägets egen list räknas inte.

För varje uppgift innehåller resultatfilen status (`klar` eller `hoppade_over`), om uppgiftens mål syntes på skärmen (`malUppnatt`), tiden i millisekunder, tiden tills målet syntes, antalet gånger hjälp behövdes och när, klick, fältbyten, tangenter och summan (`uppmatt`), och en steglogg med vad som klickades på. Stegloggen innehåller knapparnas och fältens namn, aldrig det som har skrivits. Filen innehåller också datum, deltagarkod, appens version, en hash av gränssnittet, deltagarens yrkesroll och erfarenhet, svaren på SUS med poängen och svaren på de öppna frågorna.

Tiden är ett ungefärligt mått. Att tänka högt tar tid, och tiden ska inte jämföras med hur snabbt någon arbetar i sitt vanliga system.

## Enkäten

Enkäten är System Usability Scale (SUS), tio påståenden som besvaras på en skala från 1 (Instämmer inte alls) till 5 (Instämmer helt) (Brooke 1996). Den svenska översättningen kommer från Helene Åvik Persson och kollegor, som översatte och prövade skalan psykometriskt (Åvik Persson m.fl. 2025). Där översättningen säger "denna applikation" står här "detta system", eftersom SUS tillåter att ordet byts mot det som testas.

Poängen räknas med standardformeln: för de udda påståendena (1, 3, 5, 7, 9) dras 1 från svaret, för de jämna (2, 4, 6, 8, 10) dras svaret från 5. Summan multipliceras med 2,5 och ger en poäng mellan 0 och 100. Poängen är inte en procentsats. Ett medelvärde kring 68 brukar anges som genomsnittligt för de system som har mätts med SUS (Sauro och Lewis 2016).

Efter SUS kommer tre öppna frågor: vad var svårast, vad var bättre eller sämre än i det journalsystem deltagaren använder i dag, och vad saknades. Deltagaren anger också sin yrkesroll och hur många år deltagaren har arbetat med journalsystem, som val bland fasta alternativ.

## Insamling och sammanställning

1. Spara alla resultatfiler i en mapp som bara testledarna kommer åt. Använd ett filnamn per deltagare, som testläget föreslår.
2. Läs igenom svaren på de öppna frågorna. Om en deltagare ändå har skrivit ett namn eller något annat som kan peka ut en person, ta bort det ur filen innan den delas.
3. Sammanställ filerna med skriptet i `app/scripts/`. Det läser både resultatfiler (`.json`) och sparade texter (`.txt`):

   ```sh
   docker run --rm -v "$PWD/app:/app:ro" -v "/sökväg/till/resultatmappen:/resultat:ro" -w /app oven/bun:1.3.14-alpine bun scripts/sammanstall-anvandartest.js /resultat
   ```

   Med `--json` skrivs sammanställningen som JSON. Med `--klickbudget <fil>` jämförs med en annan mätning av skriptet än `app/klickbudget.json`.
4. Sammanställningen visar för varje flöde: budgeten, skriptets mätning, antalet deltagare i flödets målgrupp, hur många som slutförde uppgiften utan hjälp, median och spridning för stegen och tiden (median, kvartiler och lägsta till högsta värde) och om flödet är inom kriterierna nedan. Därefter SUS: medelvärde, standardavvikelse, median och spridning. Skriptet varnar om resultaten kommer från olika versioner av gränssnittet, om samma deltagarkod finns i flera filer och om skriptets mätning gjordes på en annan version.

En uppgift räknas som slutförd när deltagaren tryckte på Klar och uppgiftens mål syntes på skärmen. Median och spridning för stegen räknas på de slutförda uppgifterna. Uppgifter där deltagaren tryckte på Klar utan att målet syntes, och uppgifter som hoppades över, redovisas för sig och ingår i andelen som inte slutförde.

## Jämförelse med klickbudgeten och skriptets mätning

Det finns tre siffror per flöde:

- **Budgeten** är taket: det antal steg flödet får kräva, med obligatoriska fält inräknade.
- **Skriptets mätning** är den kortaste vägen, gjord av ett skript som vet var det ska klicka. Den visar vad gränssnittet tillåter.
- **Deltagarnas median** visar vad det kostar en person som inte känner systemet.

Skillnaden mellan deltagarnas median och skriptets mätning är omvägar. Titta i stegloggen och på anteckningsbladet för att se var omvägarna började: en knapp som inte hittades, en flik som öppnades i onödan, ett fält som inte var förvalt. Ligger medianen över budgeten är det ett fel i gränssnittet som ska rättas, inte ett skäl att höja budgeten.

Jämförelsen är rättvis bara när deltagarna och skriptet har mätt samma version av gränssnittet. Resultatfilen har en hash av gränssnittet, och skriptets mätning i `app/klickbudget.json` har samma slags hash. Ändras gränssnittet under testperioden, redovisa resultaten per version.

## När D6 räknas som uppfyllt

D6 räknas som uppfyllt i demon när alla följande villkor gäller:

1. Varje flöde i klickbudgeten har gjorts av minst fem deltagare ur flödets målgrupp: läkare för läkarflödena och sjuksköterskor för Registrera blodtryck.
2. I varje flöde har minst 80 procent av deltagarna i målgruppen slutfört uppgiften utan hjälp.
3. I varje flöde är medianen för stegen bland deltagarna i målgruppen som slutförde uppgiften inom budgeten.
4. Alla resultat kommer från samma version av gränssnittet, eller också redovisas versionerna för sig och villkoren gäller den senaste.
5. Sammanställningen, SUS-resultatet och en sammanfattning av svaren på de öppna frågorna är publicerade i projektet, och noten för D6 i kravregistret (`app/src/krav.js`) anger antalet deltagare och resultatet.

Skriptet för sammanställningen kontrollerar villkor 1 till 3 och skriver om alla flöden är inom kriterierna. SUS-poängen ingår inte i villkoren för D6, men den redovisas alltid. Om ett flöde inte klarar villkoren rättas gränssnittet, skriptet för klickbudgeten körs igen och flödet testas med nya deltagare.

## Källor

- Brooke J. SUS: A "quick and dirty" usability scale. I: Jordan PW, Thomas B, Weerdmeester BA, McClelland IL (red.). Usability Evaluation in Industry. London: Taylor & Francis; 1996. s. 189 till 194.
- Faulkner L. Beyond the five-user assumption: Benefits of increased sample sizes in usability testing. Behavior Research Methods, Instruments, & Computers. 2003;35(3):379 till 383.
- Nielsen J, Landauer TK. A mathematical model of the finding of usability problems. I: Proceedings of the INTERACT '93 and CHI '93 Conference on Human Factors in Computing Systems. New York: ACM; 1993. s. 206 till 213.
- Nielsen J. Why You Only Need to Test with 5 Users. Nielsen Norman Group; 2000. https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/
- Nielsen J. Quantitative Studies: How Many Users to Test? Nielsen Norman Group; 2006. https://www.nngroup.com/articles/quantitative-studies-how-many-users/
- Sauro J, Lewis JR. Quantifying the User Experience: Practical Statistics for User Research. 2:a uppl. Cambridge, MA: Morgan Kaufmann; 2016.
- Helene Åvik Persson, Charlotte Castor, Nilla Andersson, Mia Hylén. Swedish Version of the System Usability Scale: Translation, Adaption, and Psychometric Evaluation. JMIR Human Factors. 2025;12:e64210. doi:10.2196/64210
