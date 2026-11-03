# Vårdkällan

[![Tester och FHIR-validering](https://github.com/SpankulatorX/vardkallan/actions/workflows/test.yml/badge.svg)](https://github.com/SpankulatorX/vardkallan/actions/workflows/test.yml)

Hela vården i ett öppet system.

Vårdkällan är ett vårdinformationssystem med öppen källkod, byggt från grunden på öppna standarder (HL7 FHIR R4). Det är inte en kopia av något befintligt system. Projektet visar att kärnan i ett journalsystem går att bygga öppet, med data i öppna format som vårdgivaren själv äger, och att de problem som har drabbat stora journalsysteminföranden i Sverige och Norden går att konstruera bort.

Demo: https://vardkallan.404haven.se

Demon använder bara påhittade patienter och testpersonnummer från Skatteverket. Den är inte avsedd för vård av riktiga patienter, är inte CE-märkt som medicinteknisk produkt och är ett fristående projekt, inte en tjänst från någon region.

## Det här finns i första versionen

- Patientöversikt, journalanteckningar med signering och rättelser som aldrig skriver över tidigare version, läkemedelslista, mätvärden, diagnoser, remisser och inkorg.
- Behörighet enligt patientdatalagen och HSLF-FS 2016:40: vårdrelation, inre sekretess med aktivt val, spärr med spärrmarkering och samtycke, nödåtkomst och minsta nödvändiga åtkomst per yrkesroll. All kontroll sker på servern.
- Skyddade personuppgifter skyddas i hela kedjan, även i väntrum och uppropning.
- Personnummer, samordningsnummer, reservnummer och annan identitet med OID. Numret skrivs eller klistras in i valfritt format och systemet avgör självt vad det är och förklarar vad som är fel. Reservnummer skapas av systemet (med ett påhittat format i demon). När personnumret blir känt följer journalen med och den gamla identiteten finns kvar och går att söka på. Systemet hittar själv troliga dubbletter, och en vårdadministratör bekräftar sammanslagningen.
- En åtkomstlogg som inte går att ändra (hashkedja och databastriggrar), logglista per patient och logguppföljning.
- Min journal, en e-tjänst för patienten: patienten loggar in med simulerad e-legitimation och läser sin journal efter vårdgivarens visningsregler, och ser vilken vårdenhet och yrkesroll som har läst den, när och på vilken grund. Spärr och loggutdrag begärs hos vården. Vårdnadshavare läser barnets journal tills barnet fyller 13 år.
- Uppmärksamhetsinformation strukturerad efter Socialstyrelsens huvudgrupper (överkänslighet, medicinska tillstånd och behandlingar, smitta och särskild vårdrutin), med en symbol i patienthuvudet, arbetslistan och väntrummet. Systemet föreslår själv uppgifterna ur läkemedelslistan, diagnoserna och överkänsligheterna, och läkaren bekräftar med ett klick. Förslagsreglerna är demoregler.
- Läkemedelslistan är byggd för Nationella läkemedelslistan: ordinationsorsak och uppföljningsdatum är obligatoriska, varje överföring kvitteras och när NLL inte svarar i tid döljs aldrig en registrerad förskrivning. Kopplingen till NLL är simulerad i demon.
- Läkemedelsprocessen hela vägen: systemet räknar fram dagens doser per avdelning och patient ur ordinationerna, och sjuksköterskan ger, iordningsställer eller lämnar över med ett klick, också i efterhand och under permission. Systemet varnar för dubbel dos, för tidig dos, dos utan ordination och högsta dygnsdos och förklarar varför. Läkaren ser vad som har ändrats sedan senaste vidimeringen och vidimerar med ett klick, får varning vid utsättning av läkemedel som inte får sättas ut tvärt, förslag på dos och tider ur produkt och patient och en läkemedelsgenomgång med automatiskt framtagen läkemedelsberättelse. Administrerad volym räknas in i vätskebalansen. Läkaren ger läkemedel med samma kontroller som sjuksköterskan, och undersköterskan ger bara med en giltig delegering enligt HSLF-FS 2017:37 9 kap., som en sjuksköterska eller läkare registrerar med systemets förslag och påminns om i inkorgen innan den går ut. Systemet prövar själv att delegeringen gäller just den dosen och visar knappen Ge bara då. En annan dos än ordinationens kvitteras med motivering, och antikoagulantia sätts bara ut med en plan som sparas med utsättningen. Efter ett uppehåll påminner systemet läkaren i inkorgen dagen före återinsättningen, och en knapp öppnar ordinationen ifylld ur den tidigare. Avslutas behandlingen för gott avfärdar läkaren raden med en orsak som systemet föreslår. Varningarna och förslagen är demoregler.
- Läsläge vid avbrott: när servern inte svarar går det att läsa arbetslistan och patienternas journaler ur en krypterad läskopia i webbläsaren, med reservinloggning. Läskopian förnyas av sig själv medan man är inloggad, så läkemedelsuppgifterna är högst 10 minuter gamla när ett avbrott börjar, och läsläget visar per patient hur gamla de är.
- Remisser med mottagningskvittens, bedömning, svar och kvittens av svaret, och larm när något uteblir.
- Vårdkontakt och vårdtillfälle som bärande struktur: allt som dokumenteras hör till en vårdkontakt, och ingen behöver välja kontakten själv. Systemet knyter anteckningar, mätvärden, ordinationer och remisser till den pågående kontakten, eller skapar en ur sammanhanget. Vårdadministratören registrerar planerade och oplanerade besök, telefon, video och hembesök med patientavgift enligt demoregler, och sjuksköterskan skriver in, flyttar och skriver ut. Ett vårdtillfälle följer med vid flytt och sängbyte, och systemet föreslår hälsoärenden som bekräftas med ett klick.
- Utskrift av hela eller delar av journalen med utskrifts-id på varje sida, där systemet föreslår syftet och utskriften bara innehåller det man får se och själv säger vad som saknas. Utlämnande och återlämnande av journalhandlingar registreras. Kontrasignering, där systemet föreslår vem och begäran hamnar i den personens inkorg.
- Export till e-arkiv enligt Riksarkivets FGS Paketstruktur 2.0 med journalen i FHIR R4, som också är återföringen av all data. Gallring och förstöring av journaler bara efter ett registrerat beslut, utan att åtkomstloggen ändras. Ett datauttag för uppföljning utan namn och personnummer som uppdateras varje natt.
- Tidbok, väntelista och kallelser för vårdadministratören: Dagens arbete visar vilka som kommer i dag och om de har kommit, remisser som väntar på tid, väntelistan, kallelser som behöver gå ut och bevakningar, med en nästa åtgärd per rad. Systemet föreslår de lämpligaste tiderna, så att bokning och ombokning är ett klick, räknar dagar mot vårdgarantin, skriver kallelserna och påminnelserna och väljer kanal själv. Patienten checkar in och bokar om återbesök, telefon- och videotider i Min journal eller checkar in på en skärm i väntrummet, och avgiften räknas av systemet. Läkaren sätter upp återbesök med ett klick, där systemet föreslår typ, yrkesroll och tidsram ur anteckningens planering, diagnosen och den senaste kontakten. Ett läkemedel som ska ges inför en vårdhändelse, till exempel en elkonvertering, får sin tid från tidboken, och systemet räknar om dosen när tiden bokas om eller avbokas. En avbokad vårdhändelse sätter systemet upp på väntelistan igen, utom när en remiss avvisades: då beslutar den läkare som ordinerade läkemedlet från inkorgen. Sms, brev och betalning är simulerade, och vårdgarantin och avgifterna är demoregler.
- Vårdplaner där systemet föreslår en standardplan ur diagnosen och bevakar uppföljningen, psykiatrisk tvångsvård där systemet räknar alla frister ur LPT och LRV med paragraf och föreslår nästa steg, samordnad planering vid utskrivning och samordnad individuell plan med kommunen som simulerad part, och hälsoärenden som kan avslutas, delas och slås ihop.
- Sökning i journalen: ett sökfält i patientens journal söker i anteckningar, diagnoser, läkemedel och mätvärden och visar träffarna i tidsordning med träffen markerad. Systemet tolkar vanliga ord, ICD-10-koder, läkemedelsnamn och läkemedelsgrupper, och söker bara i det användaren får läsa, så att inget spärrat eller dolt röjs.
- Mätvärden med en kurva per mätvärde och referensintervall, och NEWS2 som systemet räknar ur vitalparametrarna med vad som ska göras och när nästa kontroll ska göras. När NEWS2 eller ett enskilt värde kräver åtgärd larmar systemet i inkorgen för sjuksköterskan och läkaren. Glasgow Coma Scale och smärta med NRS, där systemet räknar summan och skriver texten. Basfakta om patienten i patienthuvudet och API:t som ett och samma objekt. Skalorna är demoregler.
- Logguppföljningen exporterar loggen till fil (NDJSON eller CSV), har säkerhetshändelser som en egen logg (inloggningar, avvisade anrop och ändrade behörigheter) och stickprovskontroller enligt HSLF-FS 2016:40 4 kap. 9 b §, där systemet drar åtkomsterna slumpvis och granskaren markerar dem med ett klick. Åtgärder får KVÅ av systemet.
- Migrerad historik visas i samma kronologi som ny dokumentation, med en avstämningsrapport för migreringen.
- Öppet FHIR R4-API under `/fhir` med samma behörighet och loggning som gränssnittet.
- Kravspårbarhet: varje krav visas med de automatiska tester som visar att det är uppfyllt. Bygget stoppas om ett test är rött. Testerna och FHIR-valideringen mot HL7:s validator körs på GitHub vid varje ändring (`.github/workflows/test.yml`). En språkkontroll i bygget stoppar engelska ord, tankstreck, ellipser och saknade å, ä och ö i allt som visas.
- Sussas kravspecifikation för Cosmic med originalnummer (kapitel 1 till 6 och 11, 305 poster, utlämnad av Konkurrensverket 2026-11-03) på sidan Kravspårbarhet: varje post med kravtext, Vårdkällans lösning, hur systemet tar expertrollen och testerna som visar det. Grundprincipen är att systemet är experten, inte användaren (`docs/design.md`).

Det som inte är byggt än (bland annat kassa och resursbokning, specialområden som anestesi och intensivvård och cytostatika, och riktiga integrationer mot nationella tjänster) visas som planerat på sidan Moduler.

## Kör lokalt

Kräver Docker.

```sh
docker build -t vardkallan app
docker run --rm -p 127.0.0.1:8080:8080 vardkallan
```

Öppna http://127.0.0.1:8080 och välj en demoroll under Personal, eller en patient under Patient. Varje besökare får en egen sandlåda i minnet.

Tester:

```sh
docker run --rm -v "$PWD/app:/app" -w /app oven/bun:1.3.14-alpine bun test
```

## Struktur

- `docs/design.md`: syfte, behörighetsregler och API-kontrakt.
- `app/src/`: server (Bun), behörighetsmotor, logg, journal, läkemedel, remiss, Min journal för patienten (`patientvy.js`), FHIR, kravregister och Sussa-registret (`sussa/`).
- `app/src/seed/`: påhittade verksamheter, personal och patienter.
- `app/public/`: webbgränssnittet, JavaScript utan byggsteg.
- `app/test/`: automatiska tester. `test/genomgang.cjs`: genomgång i webbläsaren av alla demoroller och av Min journal, och av varje vy på 360 px med knappar som är minst 40 px höga.
- `docs/anvandartest.md`: testprotokoll för användartest med personer som arbetar i vården, med testläget i demon på `#/anvandartest`.

## Licens

EUPL 1.2, Europeiska unionens licens för öppen källkod. Se `LICENSE`.
