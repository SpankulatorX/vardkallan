# Bidra till Vårdkällan

Vårdkällan är ett öppet vårdinformationssystem under licensen EUPL 1.2. Alla får läsa koden, köra den, ändra den och föreslå ändringar. Den här filen beskriver hur du bygger och kör systemet, hur testerna körs, vilka regler koden följer och hur ett bidrag lämnas.

Det övergripande syftet, behörighetsreglerna och API-kontraktet står i `docs/design.md`. Hur projektet uppfyller kravet på ett innovationsrum, med dokumentation, utbildning, processer och support, står i `docs/innovationsrum.md`.

## Bygga och köra lokalt

Du behöver Docker. Från repots rot:

```sh
docker build -t vardkallan app
docker run --rm -p 127.0.0.1:8080:8080 vardkallan
```

Öppna http://127.0.0.1:8080 och välj en demoroll under Personal, eller en patient under Patient. Varje besökare får en egen sandlåda med påhittade patienter, och det som görs i en sandlåda påverkar ingen annan.

Bygget kör servertesterna i ett eget steg och stoppas om något test är rött. Resultaten av gränssnittstesterna följer med in i bygget som filer i `app/` (`klickbudget.json`, `klienttest-resultat.json` och `sussa-testfall.json`).

Systemet har inga beroenden utöver Bun och dess inbyggda SQLite. Gränssnittet är vanlig JavaScript utan byggsteg, i `app/public/`.

## Testa

### Servertesterna

Servertesterna körs med Bun i en container, från repots rot:

```sh
docker run --rm --memory=3g -v "$PWD:/w" -w /w/app oven/bun:1.3.14-alpine bun scripts/kor-tester.js
```

`scripts/kor-tester.js` kör hela sviten, skriver `app/test-resultat.json` och prövar att varje test som kravregistret och Sussa-registret pekar på finns. Sista raden säger hur många tester som är gröna, röda och hoppade, och den ska säga 0 röda. Skriptet avslutas med ett fel om något test är rött eller om ett register pekar på ett test som inte finns.

En enskild testfil körs med `bun test test/<fil>.test.js` i samma container. Tester som kan bero på klockslaget prövas med falsk klocka med `scripts/klocktest.js`, till exempel `bun scripts/klocktest.js --tid vardag-2330`, som beskrivs i `docs/design.md` under Köra testerna med falsk klocka.

### Gränssnittstesterna

Gränssnittet prövas i en riktig webbläsare med Playwright. Skripten ligger i `test/` och körs mot en server som är igång, med adressen som argument:

```sh
docker run -d --rm --memory=3g --name vk-test -p 127.0.0.1:18201:8080 vardkallan
NODE_PATH=$(npm root -g) node test/klickbudget.cjs http://127.0.0.1:18201
```

Kör dem i den här ordningen:

1. `test/klickbudget.cjs`: de vanliga arbetsflödena med riktiga klick och tangenttryck, mot klickbudgeten i `app/src/klickbudget.js`.
2. `test/avbrott.cjs`: läsläget och skrivkön när servern inte svarar.
3. `test/anvandartest.cjs`: testläget för användartest från början till slut.
4. `test/sussa-testfall.cjs`: Sussas användbarhetstestfall.
5. Servertesterna med `scripts/kor-tester.js`, som ovan.
6. `test/genomgang.cjs`: varje vy för varje demoroll och Min journal, också på 360 px.
7. `test/tillganglighet.cjs`: tillgänglighetskontrollen mot det som går att pröva automatiskt i WCAG 2.1 nivå AA.
8. `test/mobil.cjs`: de mobila flödena i en skärm som är 360 px bred.

Resultaten skrivs till filer i `app/` med en hash av `app/public/`. Ändras gränssnittet efteråt räknas gränssnittstesterna som inaktuella tills skripten har körts igen.

## Regler för koden

- Namn och kommentarer är på svenska, med å, ä och ö i kommentarer och texter. Kodvärden och identifierare skrivs utan å, ä och ö.
- Inga nya beroenden utan ett tydligt skäl. Det som går att skriva med Bun och webbläsarens egna funktioner skrivs så.
- Gränssnittet får inte ha skript i HTML eller resurser från andra adresser. Servern sätter `Content-Security-Policy` med `default-src 'self'`, så att skript bara får komma från den egna servern, som med `script-src 'self'`.
- Testdriven utveckling: skriv testet först, se det bli rött och skriv sedan koden. Varje ny funktion har tester, och varje rättat fel får ett test som hade hittat det.
- All behörighet prövas på servern, i behörighetsmotorn i `app/src/atkomst.js`. Gränssnittet döljer det som rollen inte får göra, men det är servern som nekar.
- Varje åtkomst till patientuppgifter loggas i åtkomstloggen, också när någon bara läser, och loggen går inte att ändra. Säkerhetshändelser loggas i säkerhetsloggen.
- Systemet är experten: det fyller i det som går att räkna ut, föreslår nästa steg och förklarar på vanlig svenska varför något inte går. Ett nytt vanligt arbetsflöde får en post i `FLODEN` i `app/src/klickbudget.js` med budget och motivering.

## Kravregistret, Sussa-registret och testnamnen

Kraven är kopplade till testerna med testernas namn. Kravregistret (`app/src/krav.js`) och Sussa-registret (`app/src/sussa/`) pekar på tester med namnet som det står i `app/test-resultat.json`: gruppens och testets namn åtskilda med `>`, till exempel `Utbildningsmaterial > filerna i docs/utbildning är exakt det som skrivs ur registren`. Ett krav räknas som uppfyllt i demon bara när alla dess tester finns och är gröna.

Därför är testnamnen beskrivande meningar på svenska som säger vad testet visar. Byter du namn på ett test ska registren som pekar på det ändras i samma ändring, annars stoppas bygget.

Dokument som skrivs ur register i `app/src/`, till exempel `docs/behorighetsanalys.md` och `docs/utbildning/`, skrivs om med `bun scripts/dokument-md.js` i `app/`. Ett test prövar att filerna i `docs/` är exakt det som skrivs.

## Språket

All text som visas för användaren, och all dokumentation, är på svenska:

- Korrekt å, ä och ö.
- Inga tankstreck och inga ellipser. Skriv om meningen, eller använd kommatecken, kolon eller punkt.
- Inga engelska ord utom de lånord, förkortningar och namn som står i listorna i `app/test/sprakkontroll.js`. Skriv pröva när det betyder att testa något.
- Inga anteckningar till oss själva i texter som andra läser.

`app/test/sprak.test.js` prövar gränssnittets texter och serverns felmeddelanden mot reglerna.

## Inga riktiga personuppgifter

Allt i repot och i demon är påhittat. Patienter har testpersonnummer från Skatteverket, och personal och verksamheter har påhittade namn. Lägg aldrig in riktiga personnummer, namn på riktiga patienter eller uppgifter ur en riktig journal, inte heller i ett ärende, en testfil eller en skärmbild.

## Lämna ett bidrag

1. Öppna ett ärende på GitHub som beskriver vad du vill ändra och varför, om ändringen inte är liten. Då kan andra säga till tidigt om något redan finns eller krockar.
2. Gör ändringen i en egen gren i din kopia av repot.
3. Skriv testerna först och se till att servertesterna säger 0 röda. Har gränssnittet ändrats, kör också gränssnittstesterna.
4. Uppdatera dokumentationen i samma ändring: `docs/design.md`, och de register som dokument i `docs/` skrivs ur.
5. Lämna ett ändringsförslag (pull request) mot huvudgrenen med en kort beskrivning av vad som har ändrats och hur det är prövat.

Ändringsförslaget granskas innan det tas in. GitHub Actions kör servertesterna, testerna med falsk klocka och FHIR-valideringen för varje ändringsförslag.

## Säkerhetsbrister

Rapportera inte en säkerhetsbrist i ett öppet ärende eller ett ändringsförslag, eftersom alla kan läsa dem. Projektet behöver en kontaktväg för sådana rapporter. Använd GitHubs funktion för privata säkerhetsrapporter för repot om den är påslagen. Är den inte det, öppna ett ärende som bara säger att du vill rapportera en säkerhetsbrist och ber om en privat kontaktväg, utan detaljer om bristen.

Öppna fynd från säkerhetsgranskningarna står i `app/src/sakerhetsfynd.json` tills de är rättade och prövade, och säkerhetsarkitekturen beskrivs i `docs/sakerhetsarkitektur.md`.

## Licens

Vårdkällan har licensen EUPL 1.2, Europeiska unionens licens för öppen källkod. Se `LICENSE`. När du lämnar ett bidrag lämnar du det under EUPL 1.2.

Undantag: filerna med WHO:s tillväxtstandard och tillväxtreferens i `app/src/seed/` har licensen CC BY-NC-SA 3.0 IGO, som beskrivs i `README.md`.
