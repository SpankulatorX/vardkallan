# Innovationsrummet

Sussas kravspecifikation har kravet 2.6.1.1: "Kärnsystemet ska innehålla ett innovationsrum som inkluderar dokumentation, utvecklarforum, utbildning, processer, rutiner och support. Beskriv hur kravet uppfylls."

Ett innovationsrum är den plats där vårdgivarens egen personal, forskare och andra utvecklare lär sig systemet, prövar idéer mot det och bygger nya tillämpningar på det, utan att röra den vård som pågår. Det behöver fyra saker: dokumentation som stämmer med systemet, en miljö där man får göra fel, en väg in för det som byggs och människor att fråga.

Det här dokumentet beskriver hur Vårdkällan uppfyller delarna i kravet, vad som finns i dag och vad som kräver en ansvarig organisation.

## Dokumentation

Dokumentationen är öppen och ligger i samma repo som koden, så att en ändring i koden och i dokumentationen granskas tillsammans. Det mesta skrivs ur systemets egna register, och ett test stoppar bygget när dokumentet och koden säger olika saker.

- Det öppna API:t följer HL7 FHIR R4. `GET /fhir/metadata` ger API:ts CapabilityStatement, med programmets version och varje resurstyp, sökparameter och skrivning som servern tar emot.
- Ändringsloggen för API:t, `app/src/api-andringar.js`, säger i vilken version varje resurstyp och skrivning kom. Den visas på sidan Öppet API i demon och under `GET /api/oppet-api/andringar`. Ett test stoppar bygget om CapabilityStatement anger något som loggen saknar, eller tvärtom.
- `docs/api-avvikelser.md` beskriver var API:t avviker från eller lägger till något i kontraktet, och `docs/fhir-validering.md` hur resurserna prövas med HL7:s validator.
- De nationella tjänstekontrakten i bilaga K10 och hur Vårdkällan svarar mot dem står i `app/src/tjanstekontrakt.js` och under `GET /api/tjanstekontrakt`.
- Täckningen, alltså vilka vanliga arbetsflöden som går att göra via API:t och vad som saknas, står i `app/src/api-tackning.js` och på sidan Öppet API.
- `docs/design.md` beskriver syftet, behörighetsreglerna, API-kontraktet och varje del av systemet. Informationsmodellen står i `docs/informationsmodell.md` och säkerhetsarkitekturen i `docs/sakerhetsarkitektur.md`.
- Kravsidan (#/krav) och modulsidan (#/moduler) räknas fram ur kravregistret, Sussa-registret och testresultaten, så att de aldrig säger att något finns som inte är prövat.

## Sandlådor där vem som helst kan pröva

Demon på https://vardkallan.404haven.se är öppen för alla. Varje besökare får en egen sandlåda med påhittade patienter, och det som görs där påverkar ingen annan. En utvecklare kan alltså pröva både gränssnittet och API:t mot ett komplett system, med alla behörighetsregler och all loggning, utan att få se en riktig patient.

Systemförvaltaren kan dessutom skapa en utbildningsmiljö, en testmiljö eller en acceptanstestmiljö under Lagring. Varje miljö är en egen sandlåda och är märkt överst på varje sida. Den som vill köra hela systemet själv bygger det med Docker enligt `CONTRIBUTING.md`.

## Externa tillämpningar

Det som byggs i innovationsrummet kommer in i systemet som registrerade tillämpningar, med samma behörighet och loggning som gränssnittet. Förvaltningen står i `app/src/api-forvaltning.js`:

- Systemförvaltaren registrerar och återkallar externa tillämpningar för SMART on FHIR på sidan Öppet API. Systemet räknar fram omfånget och skriver själv vad tillämpningen får göra. En tillämpning startas från journalen och får aldrig mer behörighet än den inloggade personen har.
- En registrerad tillämpning har adressen till sin källkod, sin licens och sin version. Med en adress föreslår systemet EUPL 1.2.
- Systemkonton för tillämpningar utan inloggad person, till exempel ett vårddatalager, hämtar biljett med SMART Backend Services och prenumererar på nya poster på sina vårdenheter.
- Personal och samarbetspartner lämnar ärenden om information som saknas i API:t, frågor och fel. Systemet säger direkt om det som begärs redan finns, och ett ärende kan bara stå som levererat i en version som finns i ändringsloggen.

Demon har en registrerad tillämpning, Blodtryck över tid, som visar hur en tillämpning startas från journalen.

## Utbildning

Utbildningen finns i systemet och i repot, och materialet skrivs ur systemets egna register:

- Övningar under Utbildning för varje yrkesroll, med ett intyg som gäller i ett år, och praktiska prov i en övningsjournal.
- Utbildningskonceptet, utbildningsplanen och materialet för varje roll i `docs/utbildning/`, med arbetsflödena och klickbudgeten, övningarna med rätt svar och förklaring och uppdragen i testinbjudan.
- Instruktionsfilmer för de vanligaste arbetsflödena i `docs/filmer/`, inspelade på nytt efter varje ändring i gränssnittet.
- Hjälp i de vanligaste flödena och nyheterna efter varje ny version.

För utvecklare är `CONTRIBUTING.md` och `docs/design.md` utbildningen: hur systemet byggs och testas, vilka regler koden följer och hur behörighetsmotorn fungerar.

## Processer och rutiner

Så föreslås och beslutas en förändring:

1. Ärende. Ett förslag eller ett fel beskrivs i ett ärende på GitHub, eller i en synpunkt från demon.
2. Gren. Ändringen görs i en egen gren.
3. Tester. Testerna skrivs först, och servertesterna ska vara gröna, 0 röda. Gränssnittstesterna körs när gränssnittet har ändrats. Ett krav räknas som uppfyllt bara när alla dess tester finns och är gröna.
4. Granskning. Ändringen lämnas som ett ändringsförslag och granskas innan den tas in. GitHub Actions kör servertesterna, testerna med falsk klocka och FHIR-valideringen för varje ändringsförslag.
5. Version och nyheter. Varje version har ett nummer i `app/package.json`, nyheter per roll i `app/src/nyheter.json` och en rad i API:ts ändringslogg, och ett test prövar att de stämmer med varandra. En uppgradering används först när två systemförvaltare har godkänt den, var och en i sin egen inloggning, och den går att backa.
6. Säkerhetsgranskning. Ändringarna säkerhetsgranskas, och granskningarna beskrivs i `docs/design.md`. Öppna fynd står i `app/src/sakerhetsfynd.json` tills de är rättade och prövade, och version 1.0 krävde att listan var tom. Säkerhetsbrister rapporteras inte i öppna ärenden, som `CONTRIBUTING.md` beskriver.

Rutinerna i driften av systemet finns i systemet själv: ändringar av regler, parametrar, mallar och kodverk gäller först när en annan systemförvaltare har godkänt dem, och varje ändring sparas med historik som inte går att ändra.

## Utvecklarforum

Ett utvecklarforum är en öppen plats där utvecklare ställer frågor, visar vad de har byggt och diskuterar förslag innan de blir ärenden. När ett forum öppnas fungerar det så här:

- Det har några få kategorier: frågor om API:t och tillämpningar, idéer och förslag, visa vad du har byggt och frågor om utbildningen.
- En ansvarig organisation har moderatorer som svarar, flyttar en fråga som visar sig vara ett fel till ett ärende och länkar svaren till dokumentationen, så att samma fråga inte behöver ställas två gånger.
- Forumet har samma regler som repot: inga riktiga personuppgifter och inga detaljer om säkerhetsbrister.

Ett forum behöver en ansvarig organisation som håller det levande och svarar. Det öppna projektet är inte en sådan organisation. I dag finns ärendena och ändringsförslagen på GitHub, där frågor och förslag kan lämnas och diskuteras öppet.

## Support

Support är att någon svarar inom en avtalad tid och tar ansvar för att ett fel blir rättat. Det kräver en ansvarig organisation med en servicedesk, avtalade servicenivåer och en driftorganisation, och det öppna projektet är inte en sådan organisation och lovar inga svarstider.

Det som finns i dag:

- Ärenden och ändringsförslag på GitHub.
- Knappen Lämna synpunkt på varje sida i demon. Synpunkten sparas med vyn och demorollen, och projektet läser den.
- Ärendena mellan kund och utvecklare på sidan Öppet API, som visar hur en vårdgivare och en utvecklare kan föra ett ärende till en version. I demon ligger de i besökarens egen sandlåda.

## Det som finns och det som saknas

Dokumentationen, sandlådorna, registreringen av externa tillämpningar, utbildningen och processerna för förändring finns i dag och prövas automatiskt där det går. Utvecklarforum och support med avtalade svarstider kräver en ansvarig organisation, som det öppna projektet inte är. Den organisation som inför Vårdkällan kan bygga dem på det som redan finns: ärendena på GitHub, synpunkterna från demon och ärendena på sidan Öppet API.
