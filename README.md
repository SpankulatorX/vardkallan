# Vårdkällan

Hela vården i ett öppet system.

Vårdkällan är ett vårdinformationssystem med öppen källkod, byggt från grunden på öppna standarder (HL7 FHIR R4). Det är inte en kopia av något befintligt system. Projektet visar att kärnan i ett journalsystem går att bygga öppet, med data i öppna format som vårdgivaren själv äger, och att de problem som har drabbat stora journalsysteminföranden i Sverige och Norden går att konstruera bort.

Demo: https://vardkallan.404haven.se

Demon använder bara påhittade patienter och testpersonnummer från Skatteverket. Den är inte avsedd för vård av riktiga patienter, är inte CE-märkt som medicinteknisk produkt och är ett fristående projekt, inte en tjänst från någon region.

## Det här finns i första versionen

- Patientöversikt, journalanteckningar med signering och rättelser som aldrig skriver över tidigare version, läkemedelslista, mätvärden, diagnoser, remisser och inkorg.
- Behörighet enligt patientdatalagen och HSLF-FS 2016:40: vårdrelation, inre sekretess med aktivt val, spärr med spärrmarkering och samtycke, nödåtkomst och minsta nödvändiga åtkomst per yrkesroll. All kontroll sker på servern.
- Skyddade personuppgifter skyddas i hela kedjan, även i väntrum och uppropning.
- En åtkomstlogg som inte går att ändra (hashkedja och databastriggrar), logglista per patient och logguppföljning.
- Läkemedelslistan är byggd för Nationella läkemedelslistan: ordinationsorsak och uppföljningsdatum är obligatoriska, varje överföring kvitteras och en timeout döljer aldrig en registrerad förskrivning. Kopplingen till NLL är simulerad i demon.
- Remisser med mottagningskvittens, bedömning, svar och kvittens av svaret, och larm när något uteblir.
- Migrerad historik visas i samma kronologi som ny dokumentation, med en avstämningsrapport för migreringen.
- Öppet FHIR R4-API under `/fhir` med samma behörighet och loggning som gränssnittet.
- Kravspårbarhet: varje krav visas med de automatiska tester som visar att det är uppfyllt. Bygget stoppas om ett test är rött.

Det som inte är byggt än (bland annat tidbok, specialområden som anestesi och intensivvård och cytostatika, och riktiga integrationer mot nationella tjänster) visas som planerat på sidan Moduler.

## Kör lokalt

Kräver Docker.

```sh
docker build -t vardkallan app
docker run --rm -p 127.0.0.1:8080:8080 vardkallan
```

Öppna http://127.0.0.1:8080 och välj en demoroll. Varje besökare får en egen sandlåda i minnet.

Tester:

```sh
docker run --rm -v "$PWD/app:/app" -w /app oven/bun:1.3.14-alpine bun test
```

## Struktur

- `docs/design.md`: syfte, behörighetsregler och API-kontrakt.
- `app/src/`: server (Bun), behörighetsmotor, logg, journal, läkemedel, remiss, FHIR och kravregister.
- `app/src/seed/`: påhittade verksamheter, personal och patienter.
- `app/public/`: webbgränssnittet, JavaScript utan byggsteg.
- `app/test/`: automatiska tester. `test/genomgang.cjs`: genomgång i webbläsaren av alla demoroller.

## Licens

EUPL 1.2, Europeiska unionens licens för öppen källkod. Se `LICENSE`.
