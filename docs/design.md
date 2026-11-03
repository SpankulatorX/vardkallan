# Vårdkällan: design för första versionen

Vårdkällan är ett öppet och komplett vårdinformationssystem, byggt från grunden på öppna standarder. Det är inte en kopia av Cosmic. Första versionen är en publik demo på https://vardkallan.404haven.se med påhittade patienter i Region Örebro läns verksamheter. Den ska visa att kärnan i ett journalsystem går att bygga öppet, och att de fel som drabbade Cosmic i Sussa går att konstruera bort.

Underlag: en sammanställning av offentliga källor om upphandlingen av Cosmic och kritiken mot systemet (Konkurrensverkets ansökningar, förvaltningsrättens och kammarrättens domar, revisionsrapporter och regionernas egna handlingar). Krav-id nedan (K1 till K5, D1 till D12, L1 till L13) kommer därifrån. Dessutom finns Sussas egen kravspecifikation med originalnummer för kapitel 1 till 6 och 11, som Konkurrensverket lämnade ut 2026-11-03 (se avsnittet Sussa-registret).

## Grundprincip: systemet är experten

Grundprincipen formulerades den 3 november 2026:

"Hela grundtanken är att det ska vara systemet som är experten, inte användaren. Alla flöden måste vara superenkla för användarna, oavsett vilken roll de har. Självklart ska kravspecifikationen uppfyllas, men om den lösning som Cosmic har valt inte uppfyller principen om att systemet ska vara experten ska den skrivas om så att principen alltid gäller."

Sussas krav är mest skrivna som "beskriv hur ni stödjer X". De säger vad vården behöver, inte hur det ska lösas. Vårdkällan uppfyller behovet, men på ett sätt där systemet bär kunskapen om regler, kodverk och lagar. I praktiken betyder det i varje funktion:

- Systemet fyller i allt det kan räkna ut ur sammanhanget: vårdkontakt, enhet, tid, patientens uppgifter och förval.
- Det finns inga fält eller val som systemet kan avgöra själv. Användaren ska aldrig behöva kunna kodverk, regler eller lagtext.
- Systemet föreslår nästa steg, kontrollerar mot regler och kodverk och förklarar på vanlig svenska varför något inte går eller varför det varnar.
- Varje roll ser det rollen behöver just då, och inget annat.
- Flödet ska klara en klickbudget (`app/src/klickbudget.js`, mätt med `test/klickbudget.cjs`). Nya vanliga flöden får en egen post i `FLODEN` med budget och motivering.
- För varje Sussa-post som byggs står det i Sussa-registret hur systemet tar expertrollen (fältet `expert`).

Exempel som redan finns: aktivt val och samtycke frågas efter bara när behörighetsmotorn kräver det och med förslag på grund, ordinationen kontrolleras mot överkänslighet och andra läkemedel innan den sparas, koder för diagnoser, läkemedel och mätvärden sätts av systemet, skyddad identitet maskeras överallt utan att någon behöver komma ihåg det, och remissens och NLL:s kvittenser bevakas av systemet och hamnar i inkorgen när något uteblir.

## Mål

1. Patientöversikt, journalanteckningar, läkemedelslista, remiss och svar, mätvärden och diagnoser för en patient.
2. Behörighet enligt patientdatalagen och HSLF-FS 2016:40 4 kap.: vårdrelation, inre sekretess med aktivt val, spärr med spärrmarkering, nödåtkomst, minsta nödvändiga åtkomst per yrkesroll.
3. Skyddade personuppgifter skyddas i hela kedjan, även i väntrum och uppropning.
4. Varje åtkomst loggas i en logg som inte går att ändra (hashkedja och databastriggrar). Logglista till patienten och logguppföljning för granskare.
5. Läkemedelslistan är byggd för Nationella läkemedelslistan: ordinationsorsak och uppföljningsdatum är obligatoriska, och varje överföring har kvittens. En timeout döljer aldrig en lyckad förskrivning (D1).
6. Remisser har mottagningskvittens, bedömning, svar och kvittens av svaret, med larm när något uteblir (D1).
7. Migrerad historik från VAS och Cosmic visas i samma kronologi som ny dokumentation, med källa utskriven, och en avstämningsrapport för migreringen (D2, D3).
8. Öppet FHIR R4-API för alla resurser, med samma behörighetskontroll och loggning som gränssnittet (D9).
9. Kravspårbarhet: en sida som visar varje krav, var det uppfylls och vilka automatiska tester som visar det, med testresultat från bygget (K1, K4). Sussas kravspecifikation med originalnummer visas på samma sida, mappad post för post till Vårdkällan.
10. Svarstid mäts för varje anrop och visas (D5).
11. Patienten läser sin egen journal och ser vem som har läst den i Min journal, Vårdkällans egen e-tjänst för invånare (se avsnittet Min journal).

## Icke-mål i första versionen

Tidbok och kassa, specialområdena (anestesi och IVA, cytostatika, operation, förlossning, BVC), riktiga integrationer mot NLL, NPÖ, 1177 och e-remiss, diktat, mobilklient, BI. De visas på modulsidan som planerade, aldrig som klara.

## Det som får demon att misslyckas även om den fungerar

- Riktiga personuppgifter. Bara testpersonnummer från Skatteverket (`research/testpersonnummer.json`) och påhittade namn.
- Att se ut som en tjänst från Region Örebro län. Verksamheternas namn får användas, men inte regionens logotyp eller grafiska profil, och sidfoten säger att det är ett fristående demoprojekt.
- Att påstå att demon uppfyller Cosmic-kraven eller är CE-märkt. Läkemedelsvarningarna är märkta som demoregler, inte kliniskt beslutsstöd (D10).
- Att behörighetsregler bara finns i gränssnittet. All kontroll sker på servern.

## Teknik (mitt val)

- Bun 1.3 (image `oven/bun:1.3.14-alpine`), inga externa beroenden om det går att undvika. `bun:sqlite`.
- Varje besökare får en egen sandlåda: en SQLite-databas i minnet, skapad genom `Database.deserialize` av en seedad mall. Max 400 sandlådor, 8 timmar. Samma mönster som `~/Projekt/motionsportalen/app/src/server.js` och `db.js`, där sandlådorna sparas till `/data/sessioner.json` vid SIGTERM och läses in vid start.
- Alla datum i seeden räknas relativt till dagens datum när sandlådan skapas, så att demon alltid ser aktuell ut.
- Frontend: vanilla JavaScript-moduler utan byggsteg, i `app/public/`. Svenska genomgående.
- Container `vardkallan` på proxy-net bakom Caddy och cloudflared, read_only, cap_drop ALL, som motioner.

## Katalogstruktur

```
~/Projekt/vardkallan/
  docs/design.md
  research/testpersonnummer.json
  app/
    Dockerfile  package.json
    src/server.js      HTTP, sessioner, routning, svarstidsmätning
    src/db.js          schema, triggrar, seed-mall, serialisering
    src/seed/          enheter.js personal.js lakemedel-katalog.js patienter.js (journalhistorik per patient)
    src/atkomst.js     behörighetsmotorn (ren funktion, testas utförligt)
    src/logg.js        åtkomstlogg med hashkedja
    src/journal.js     anteckningar, signering, rättelse
    src/lakemedel.js   ordination, utsättning, varningar, NLL-simulering
    src/remiss.js      remissflödet och larm
    src/fhir.js        FHIR R4-mappning och /fhir-routning
    src/krav.js        kravregistret med koppling till tester
    src/sussa/         Sussas kravspecifikation (kravspec.json), mappning per avsnitt (mappning/) och index.js
    public/            index.html, app.css, js/
    test/              bun test, en fil per modul
```

## Verksamheter (Organization)

Vårdgivare: Region Örebro län (påhittat HSA-id `SE2321000164-VK0000`). Vårdenheter med påhittade HSA-id av formen `SE2321000164-VKnnnn`:

- Universitetssjukhuset Örebro (USÖ): Akutmottagningen, Kardiologiska kliniken (avdelning 72 och mottagning), Medicinska kliniken, Infektionskliniken, Ortopediska kliniken, Allmänpsykiatriska kliniken.
- Lindesbergs lasarett: Medicinkliniken.
- Karlskoga lasarett: Ortopediska kliniken.
- Vårdcentralen Tybble och Vårdcentralen Kumla (primärvård, listning).

## Personal och demoroller

Inloggning sker med ett simulerat SITHS-kort: besökaren väljer person och den enhet personen arbetar på. Påhittade namn.

| Id | Namn | Yrke | Enhet |
|---|---|---|---|
| lak-kard | Sara Lindqvist | Läkare | Kardiologiska kliniken USÖ |
| ssk-kard | Johan Ek | Sjuksköterska | Kardiologiska kliniken USÖ, avd 72 |
| usk-kard | Amira Haddad | Undersköterska | Kardiologiska kliniken USÖ, avd 72 |
| lak-akut | Erik Nyström | Läkare | Akutmottagningen USÖ |
| lak-vc | Per Holm | Läkare (distriktsläkare) | Vårdcentralen Tybble |
| lak-psyk | Lena Ström | Läkare | Allmänpsykiatriska kliniken USÖ |
| adm-kard | Karin Berg | Vårdadministratör | Kardiologiska kliniken USÖ |
| logg | Mats Wall | Logggranskare (informationssäkerhet) | Regionkansliet |

Patienterna loggar in i Min journal med simulerad e-legitimation. Varje patient med personnummer i `seed/patienter.js` är också en invånare (`inv-p01` till `inv-p15`), och därtill finns vårdnadshavaren Johanna Bergström (`inv-vh01`, testpersonnummer 19861214-2383) till barnet Leo Bergström (p09), utan egen journal i demon. Barnet kan inte logga in självt.

## Behörighetsmotorn (atkomst.js)

En ren funktion `prova(db, { personal, patient, handling, resurs, val })` som returnerar `{ tillaten, grund, krav, spärrade, skal }`. Regler:

1. **Yrkesroll** bestämmer vilka handlingar som alls är möjliga (minsta åtkomst, D8):
   - Läkare: läsa och skriva journal, ordinera, remittera, svara på remiss.
   - Sjuksköterska: läsa journal, skriva omvårdnadsanteckning, registrera mätvärden, ge och kvittera, inte ordinera.
   - Undersköterska: läsa översikt (läkemedel, mätvärden, överkänslighet, omvårdnadsanteckningar), registrera mätvärden. Inte läkaranteckningar.
   - Vårdadministratör: administrativa uppgifter (namn, kontakter, remissernas status, vårdkontakter), ingen journaltext, inga läkemedel.
   - Logggranskare: åtkomstloggen för alla patienter, ingen journal.
   - Patientidentitet (Sussa 3.1.1): läkare, sjuksköterskor och vårdadministratörer registrerar nya patienter och nya identiteter. Bara vårdadministratören bekräftar att två journaler slås samman.
2. **Vårdrelation** krävs för journalåtkomst. Den finns om patienten har en pågående eller nyligen avslutad (90 dagar) vårdkontakt, inskrivning eller listning på personalens enhet, eller en remiss till enheten.
3. **Inre sekretess**: personalen ser utan vidare sin egen enhets uppgifter. Andra enheters uppgifter inom vårdgivaren visas först efter ett aktivt val ("Visa uppgifter från andra vårdenheter") med angivet syfte. Valet loggas och gäller sessionen för den patienten.
4. **Spärr**: en patient kan ha spärrat uppgifter från en enhet (i demon: Allmänpsykiatriska kliniken för en patient). Andra enheter ser en spärrmarkering, "Det finns spärrade uppgifter", men inte innehållet eller enhetens namn. Spärren kan tillfälligt hävas bara med patientens samtycke i stunden, vilket registreras och loggas. Nödåtkomst häver aldrig en spärr.
5. **Nödåtkomst**: utan vårdrelation kan en läkare eller sjuksköterska öppna journalen om patienten inte kan samtycka och det behövs för vården. Motivering är obligatorisk, åtkomsten flaggas i loggen och syns i logguppföljningen.
6. **Utan grund** nekas åtkomsten, och försöket loggas som nekat.
7. **Skyddade personuppgifter**: patienten har markering. Namn ersätts av "Skyddad identitet" i listor, adressen visas aldrig, personnumret visas maskerat (`19800101-****`) tills personalen väljer "Visa identitet" med syfte (loggas). I väntrums- och uppropningsvyn visas bara könummer för alla patienter, och aldrig namn för en skyddad patient.

Servern anropar motorn i varje API- och FHIR-anrop. Gränssnittet döljer bara knappar för det som motorn ändå nekar.

## Loggen (logg.js)

Tabell `atkomstlogg` med `id, tid, personal_id, enhet_id, patient_id, handling, resurs, grund, syfte, resultat, prev_hash, hash`. `hash = sha256(prev_hash + kanonisk JSON av raden)`. SQLite-triggrar `BEFORE UPDATE` och `BEFORE DELETE` gör `RAISE(ABORT, ...)`. En funktion `verifiera(db)` kontrollerar hela kedjan. Grund är en av `egen_enhet`, `vardrelation`, `aktivt_val`, `samtycke_sparr`, `nodatkomst`, `administrativ`, `logggranskning`, `nekad`, och för invånarens läsning i Min journal `egen_atkomst` och `vardnadshavare`. En rad från Min journal har `invanare_id` i stället för `personal_id`; fältet tas med i den kanoniska JSON:en bara när det är satt, så att hashen för personalens rader är oförändrad.

## Journal (journal.js)

Anteckning = typ, sökord (lista av `{ sokord, text }`), enhet, vårdkontakt, författare, status `utkast | signerad`. En signerad anteckning ändras aldrig. Rättelse skapar en ny version med `ersatter_id` och obligatorisk orsak, och den gamla versionen visas överstruken men läsbar (HSLF-FS 2016:40 6 kap.). Mallar per typ: Inskrivningsanteckning, Daganteckning, Mottagningsanteckning, Omvårdnadsanteckning, Epikris, Akutanteckning. Källa: `vardkallan`, `migrerad:VAS` eller `migrerad:Cosmic`.

## Läkemedel (lakemedel.js)

- Katalog med cirka 40 vanliga läkemedel: namn, styrka, form, ATC-kod, påhittat NPL-id.
- Ordination: läkemedel, dosering (text plus strukturerat: dos, enhet, tider, vid behov), **ordinationsorsak (obligatorisk)**, **uppföljningsdatum (obligatoriskt)**, start, eventuellt slut, typ `staende | vid_behov | tillfallig`.
- Varningar före sparande (demoregler, märkta så): överkänslighet där ATC-prefixet matchar, dubbelordination av samma substans eller grupp (ATC 5 tecken), ett fåtal interaktioner (warfarin med NSAID, två antikoagulantia, metformin vid lågt eGFR). En allvarlig varning måste kvitteras med motivering.
- Utsättning med orsak. Inget raderas.
- NLL-simulering: varje ändring skapar ett meddelande med status `skickad → kvitterad` eller `fel` eller `timeout`. Vid timeout blir ordinationen `nll_status = okand_kontrolleras`, och en avstämning frågar NLL igen och hittar att den faktiskt registrerades. Ordinationen syns hela tiden i listan. Demoknapp "Simulera timeout mot NLL" för nästa överföring.

## Remiss (remiss.js)

Statuskedja: `skickad → mottagen (kvittens) → bedomd (accepterad | avvisad med motivering) → besvarad → svar_kvitterat`. Larm i inkorgen när mottagningskvittens saknas efter 2 timmar, när svar saknas efter sista svarsdatum, och när ett svar inte har kvitterats av avsändaren efter 3 dagar. Seeden innehåller remisser i varje läge, även ett som har larm.

## Kronologi och migrering

Översikten visar en tidslinje över vårdkontakter, anteckningar, ordinationer och remisser där migrerade poster har en etikett ("Migrerad från VAS 2014") men samma vikt i övrigt. Sidan Migreringsavstämning visar per datatyp antal i källan, antal överförda och antal verifierade. Ett avvikelsefall i seeden (en överkänslighet som inte var strukturerad i källan) visas som öppen avvikelse med åtgärd.

## Läsläge vid avbrott och reservinloggning (D4)

Den som arbetar ska kunna läsa det hen behöver när servern inte svarar, och inloggningen ska inte falla med en extern tjänst. Under avbrottet går inget att spara, eftersom det inte skulle nå journalen, och varje läsning hamnar i åtkomstloggen i efterhand. API:t står i `docs/api-avvikelser.md`.

**Läskopian.** När någon är inloggad bygger servern en läskopia med samma funktioner och samma behörighetskontroll som de vanliga anropen: arbetslistan och, för patienterna på den och de patienter personen har öppnat, patienthuvudet, översikten, läkemedlen och de fem senaste anteckningarna. Spärrar, inre sekretess och skyddad identitet gäller som i journalen. Att uppgifterna lämnas ut loggas. Webbläsaren krypterar kopian med AES-GCM och en nyckel som servern skapar vid varje inloggning och som gäller i 8 timmar, och sparar chiffertexten i IndexedDB. Nyckeln finns i fliken (sessionStorage), så läsläget fungerar i samma flik även om sidan laddas om.

**Läsläget.** Svarar inte servern läser gränssnittet ur kopian. Allt skrivande stängs av med en förklaring, och läget och kopians tidpunkt syns överst. Service workern cachar gränssnittets filer så att appen startar utan nät, men aldrig `/api` eller `/fhir`.

**Reservinloggning.** Stängs fliken eller startas webbläsaren om under avbrottet är flikens nyckel borta. För det fallet kan den inloggade välja en reservkod, minst sex siffror eller en lösenfras på minst tolv tecken, i sidhuvudet eller i avbrottsraden. Webbläsaren härleder en nyckel ur koden med PBKDF2 (SHA-256, 600 000 iterationer, slumpat salt på 16 byte), slår in läskopians nyckel med AES-GCM och sparar den inslagna nyckeln, saltet och den krypterade kopian i IndexedDB. Den inslagna nyckeln är bunden till personen, läskopian, giltighetstiden, saltet och antalet iterationer. Koden och den råa nyckeln sparas aldrig, och nyckeln som koden packar upp kan inte exporteras ur webbläsaren. Reservkopian förnyas tillsammans med läskopian under inloggningen, utan koden.

Vid avbrott i en ny flik eller efter en omstart visar appen, från service workern, vilka personer som har en reservkopia på datorn och när den går ut. Personen väljer sig själv och anger koden, och läsläget öppnas med samma innehåll och samma regler som läskopian. Fel kod ger ökande väntetid (2, 5, 15 och 30 sekunder), och det femte felet raderar reservkopian från datorn. Väntetiden kontrolleras och försöket räknas i samma transaktion, så flera flikar kan inte pröva samtidigt. En omladdning av sidan kräver koden igen.

Reservkopian är per person och per webbläsarprofil, så flera som delar dator har var sin, och inloggningssidan visar vilka som finns och när de går ut. Den gäller lika länge som läskopian, 8 timmar från inloggningen. En ny inloggning av samma person tar bort den gamla, eftersom den inte går att förnya utan koden. Utloggning raderar personens reservkopia, den inslagna nyckeln och läskopian, efter att loggen från läsläget har förts över. Webbläsarens andra flikar får veta det och avslutar sitt läsläge.

**Loggen från läsläget.** Varje läsning sparas som en egen rad, krypterad med läskopians nyckel och med läskopians id, personen och radens id som additional data. Raden kan skickas till servern utan nyckel och utan inloggning, eftersom servern har nyckeln och själv dekrypterar och kontrollerar den. Därför överlever loggen att fliken stängs, och den förs över så snart servern svarar: när läsläget slutar, när appen startar eller före en utloggning. Servern loggar raden på den person läskopian lämnades ut till och i den sandlåda som lämnade ut den, bara för patienter i kopian, bara läshandlingar som rollen har, bara inom kopians giltighet och bara en gång per rad. Bara den som har läskopians nyckel kan skapa en rad, så ingen kan föra in rader på någon annan. Servern behåller nyckeln tills läskopian går ut, även efter utloggning, för att kunna ta emot loggen, men lämnar aldrig ut den igen. Vid utloggningen stängs läskopian: läsningar före utloggningen tas emot, senare läsningar inte. Går datorns klocka fel rättar servern radernas tider med skillnaden mellan klockorna när raderna skickas, och det syns i loggen.

**När servern svarar igen** skickas loggen, och fliken fortsätter som samma person om samma person är inloggad i webbläsarens session. Var fliken inloggad med reservkod och någon annan, eller ingen, är inloggad i webbläsaren visas inloggningen i stället.

**Demon.** Knappen "Simulera avbrott" gör att just den fliken beter sig som om servern var nere. Under det simulerade avbrottet går det att välja reservkod och att simulera att fliken stängs, så att reservinloggningen syns. "Avsluta simulerat avbrott" för över loggen.

**Det som är simulerat, och begränsningarna.**

- I vården låser SITHS-kortet upp en privat nyckel med PIN-koden, även utan nät, och kortets hårdvara håller nyckeln och räknar felaktiga försök. I demon är kortet simulerat med reservkoden, och räknaren ligger i webbläsaren. Den kan kringgås av den som har datorn: den som kopierar IndexedDB kan pröva koder utan räknare och utan väntetid. En kod med sex siffror står då bara emot en kort stund, en lång lösenfras betydligt längre. Det är bara kortets hårdvara som skyddar på riktigt.
- En riktig reservväg för inloggningen när Ineras tjänster (SITHS, HSA och inloggningstjänsten) inte svarar är inte byggd. Inloggningen i demon beror inte på någon extern tjänst eftersom kortet är simulerat.
- Läskopian innehåller arbetslistan och de patienter som personen har öppnat, inte hela journalen, och ersätter inte en reservrutin med utskrifter eller ett separat reservsystem för läsning.
- Reservkoden måste ha valts medan personen var inloggad på samma dator och i samma webbläsare. Det kräver ingen ny inloggning, så den som kommer åt en olåst, inloggad flik kan välja en reservkod och få läsåtkomst som finns kvar efter att webbläsaren stängts, tills personen loggar ut eller i högst 8 timmar. Sidhuvudet visar när en reservkopia finns. Ett riktigt kort kräver sin PIN-kod.
- Den som kan reservkoden kan också skapa loggrader på personen för patienterna i läskopian, så länge den gäller. Det ger inte mer än koden redan ger: att läsa samma uppgifter.
- Webbläsaren kan erbjuda att spara reservkoden i sin lösenordshanterare. Dialogen ber användaren att inte göra det.
- Återställer webbläsaren en stängd flik eller session kan flikens nyckel komma tillbaka, och läsläget öppnas då utan reservkod, precis som sessionen gör när servern svarar.
- Skadlig kod i sidan eller i webbläsaren medan läsläget pågår kan använda nyckeln, precis som den kan läsa det som visas. Webbläsaren kan skriva sessionStorage till disken för att kunna återställa flikar. Kopian ersätter inte diskkryptering och en låst skärm.
- De lokala tidskontrollerna av läskopians giltighet går att kringgå genom att ändra datorns klocka, men servern tar bara emot loggrader inom kopians giltighet.
- Loggen från läsläget går inte att förfalska, men den som har datorn kan radera rader innan de har förts över. Att uppgifterna lämnades ut till läskopian loggas alltid på servern, så logguppföljningen ser vem som hade en läskopia och vilka patienter den gällde.
- I demon har varje besökare en egen sandlåda. Har servern glömt sandlådan (efter 8 timmar utan användning eller en omstart utan sparade sandlådor) går loggen inte att föra över, och det visas för den som är vid datorn.

## API-kontrakt (JSON, sessionskaka `vk_sid`, HttpOnly, SameSite=Lax)

Alla svar har rubriken `Server-Timing: app;dur=<ms>`. Fel: `{ fel: "text", kod: "nekad" | "saknas" | "ogiltig" | "kraver_val" | "kraver_samtycke" }` med 400, 403 eller 404. `kraver_val` och `kraver_samtycke` betyder att åtgärden blir möjlig med ett aktivt val respektive samtycke och att gränssnittet ska fråga.

- `GET /api/health` → `{ ok, sandladar }` (se api-avvikelser.md för tillagda fält)
- `GET /api/session` → `{ inloggad, personal?, enhet?, demoDatum }`
- `GET /api/demo/personal` → lista över demoroller `{ id, namn, yrke, enhet: { id, namn } }`
- `POST /api/login { personalId }` → session. `POST /api/logout`. `POST /api/reset` ger ny sandlåda.
- `GET /api/enheter` → vårdenhetsträd.
- `GET /api/arbetslista` → patienter med vårdrelation på min enhet: `{ id, namn, personnummer, alder, kon, plats, orsak, skyddad, larm }` (namn och personnummer maskerade för skyddade).
- `GET /api/sok?q=` → sök på namn eller identitet (personnummer, samordningsnummer, reservnummer eller OID, också tidigare identiteter) i hela regionen. Träffar visas med maskering. Sökningen loggas.
- Identiteter (Sussa 3.1.1): `GET /api/identitet/tolka?q=`, `POST /api/patienter`, `GET /api/patient/:id/identiteter`, `POST /api/patient/:id/identitet`, `POST /api/patient/:id/sammanslagning`, `POST /api/patient/:id/dubblett/avfarda`. Fälten beskrivs i `docs/api-avvikelser.md`.
- `GET /api/vantrum` → akutmottagningens väntrum: `{ konummer, ankomst, prioritet, ... }` aldrig namn för skyddade.
- `GET /api/patient/:id` → huvud: `{ id, namn, personnummer, alder, kon, skyddad, identitetVisad, overkanslighet: [...], sparrmarkering: bool, grund, harAndraEnheter, andraEnheterVisade }`. Kan svara 403 `kraver_val` (nödåtkomst behövs).
- `POST /api/patient/:id/val { typ: "andra_enheter" | "nodatkomst" | "samtycke_sparr" | "visa_identitet", syfte }` → registrerar valet i sessionen och loggar.
- `GET /api/patient/:id/oversikt` → `{ lakemedel, diagnoser, matvarden (senaste per typ), anteckningar (senaste 5), remisser (pågående), tidslinje }`
- `GET /api/patient/:id/anteckningar` → lista. `GET /api/anteckning/:id` → full med versioner.
- `POST /api/patient/:id/anteckningar { typ, vardkontaktId?, sokord: [{sokord, text}] }` → utkast. `PUT /api/anteckning/:id` (bara utkast, bara författaren). `POST /api/anteckning/:id/signera`. `POST /api/anteckning/:id/ratta { orsak, sokord }`.
- `GET /api/mallar` → anteckningstyper med sökord.
- `GET /api/patient/:id/lakemedel` → ordinationer med `nll_status` och historik. `GET /api/lakemedel/katalog?q=`.
- `POST /api/patient/:id/lakemedel/kontroll { ...ordination }` → `{ varningar: [{ niva: "allvarlig" | "observera", text, regel }] }`.
- `POST /api/patient/:id/lakemedel { ...ordination, kvitteradeVarningar?: [{ regel, motivering }] }`. `POST /api/ordination/:id/utsatt { orsak }`. `POST /api/demo/nll-timeout` (nästa överföring får timeout). `POST /api/ordination/:id/nll-avstam`.
- `GET /api/patient/:id/matvarden`, `POST /api/patient/:id/matvarden { typ, varde, enhet, tid? }`.
- `GET /api/patient/:id/remisser`, `POST /api/patient/:id/remisser { tillEnhetId, fragestallning, anamnes, prioritet, svarSenast }`.
- `GET /api/remisser?riktning=inkommande|utgaende`. `POST /api/remiss/:id/mottag`, `/bedom { beslut, motivering }`, `/svara { svar }`, `/kvittera-svar`.
- `GET /api/inkorg` → `{ osigneradeAnteckningar, okvitteradeSvar, larm, nllAvvikelser }`.
- `GET /api/patient/:id/logglista` → åtkomster för patienten, för logggranskaren. Patienten ser sina åtkomster i Min journal.
- Min journal (invånarens session): `POST /api/login/invanare { invanareId }`, `GET /api/demo/invanare`, `GET /api/min/journal/:id` och `/:id/{oversikt|anteckningar|diagnoser|lakemedel|provsvar|remisser|vardkontakter|logglista|sparrar}`, `GET /api/min/journal/:id/anteckning/:aid`, `POST /api/min/journal/:id/begaran`. Fälten beskrivs i `docs/api-avvikelser.md`.
- `GET /api/logg?flagga=nodatkomst|nekad|samtycke|alla&fran&till` (bara logggranskare) → rader plus `{ kedjaHel: bool }`.
- `GET /api/migrering` → avstämningen.
- `GET /api/krav` → kravregistret med status och testresultat.
- `GET /api/drift` → svarstider per endpoint (p50, p95, antal) för sandlådan och servern.
- `GET /fhir/metadata`, `GET /fhir/{Patient|Encounter|Condition|Observation|MedicationRequest|AllergyIntolerance|ServiceRequest|Composition|Organization|Practitioner}?patient=...`, `GET /fhir/{typ}/{id}`, `GET /fhir/AuditEvent?patient=` (logggranskare). Svar `application/fhir+json`, sökningar som `Bundle` av typen `searchset`. Personnummer med systemet `http://electronichealth.se/identifier/personnummer`, ICD-10-SE `http://hl7.org/fhir/sid/icd-10-se`, ATC `http://www.whocc.no/atc`. Samma behörighet och loggning som `/api`.

## Seed: patienter (påhittade namn, testpersonnummer)

Minst tolv patienter, däribland:
1. Kardiologi, inlagd avd 72 med förmaksflimmer och hjärtsvikt. Waran, Metoprolol, Furosemid. Penicillinöverkänslighet (J01C). Migrerad historik från VAS 2014 och Cosmic 2023.
2. Akutmottagningen, medvetslös vid ankomst, ingen tidigare vårdrelation med akuten: visar nödåtkomst.
3. Skyddade personuppgifter, besök på Vårdcentralen Tybble och i väntrummet på akuten.
4. Spärrade uppgifter från Allmänpsykiatriska kliniken, inlagd på kardiologen.
5. Listad på Vårdcentralen Kumla, remitterad till kardiologen, remissen saknar mottagningskvittens (larm).
6. Diabetes med nedsatt njurfunktion och metformin (interaktionsvarning).
7. Ortopedi Karlskoga, höftfraktur, omvårdnadsanteckningar.
8. Infektion, pneumoni, antibiotika, labbvärden (CRP).
9. Ett barn (född 2010-talet) på vårdcentralen.
10. Äldre patient på Lindesberg med många läkemedel och en NLL-avvikelse (timeout som väntar på avstämning).
11. Patient med remissvar som inte kvitterats av avsändaren.
12. Patient utan vårdrelation till någon demoroll (för att visa nekad åtkomst).

Varje patient har vårdkontakter, minst tre signerade anteckningar med realistiskt men kort kliniskt innehåll på svenska, diagnoser med ICD-10-SE, mätvärden över tid och läkemedel med ordinationsorsak och uppföljningsdatum.

## Min journal (patientvy.js)

Min journal är Vårdkällans egen e-tjänst för invånare: patienten läser sin journal och ser vem som har läst den. Den har eget namn och samma utseende som resten av Vårdkällan och efterliknar inte någon annan tjänst. Den är byggd för att visa att ett öppet system kan ge patienten direkt insyn, särskilt i åtkomstloggen.

### Rättslig grund

- En vårdgivare får ge en enskild direktåtkomst eller annat elektroniskt utlämnande av uppgifter om sig själv som får lämnas ut till honom eller henne, och av dokumentationen av åtkomsten (patientdatalagen 2008:355, 5 kap. 5 §). Vad som visas är alltså vårdgivarens val, och uppgifter som omfattas av sekretess mot patienten själv (offentlighets- och sekretesslagen 25 kap. 6 §) visas inte.
- Vårdgivaren ska på begäran lämna information om den direktåtkomst och elektroniska åtkomst som har förekommit (patientdatalagen 8 kap. 5 §). Av informationen ska det framgå från vilken vårdenhet och vid vilken tidpunkt någon har tagit del av uppgifterna, utformat så att patienten kan bedöma om åtkomsten var befogad (HSLF-FS 2016:40 4 kap. 10 §, i lydelse till och med HSLF-FS 2025:57).
- Den enskildes elektroniska tillgång får bara medges efter flerfaktorsautentisering (HSLF-FS 2016:40 4 kap. 11 § och 3 kap. 15 §). Om tillgången är begränsad ska den enskilde få veta det, och vart han eller hon kan vända sig för hjälp att förstå dokumentationen (4 kap. 12 §).
- Patienten kan motsätta sig att uppgifter görs tillgängliga för andra vårdenheter, och då ska de spärras. En vårdnadshavare har inte rätt att spärra barnets uppgifter (patientdatalagen 4 kap. 4 §). Patienten har rätt att få information om rätten att begära spärr och om rätten till information om åtkomsten (8 kap. 6 §).
- Ineras beskrivning av 1177 journal (Beskrivning och tjänstespecifika villkor, version 1.8, 2026-06-09, avsnitt 6.2) beskriver hur vårdgivare styr vad som visas: vårdgivaren väljer vilka informationsmängder som visas och kan filtrera på sökord, enhet eller journalmall, vårdnadshavare har tillgång till barnets journal tills barnet fyller 13 år, vårdnadshavare nekas för barn med skyddade personuppgifter, tjänsten kan vara öppen från 16 år och vårdgivaren ska kunna informera invånaren om att viss information inte är tillgänglig. Min journal följer samma upplägg men är inte kopplad till 1177.

### Inloggning och behörighet

- Inloggningssidan har två val, Personal och Patient. Patienten väljer en av de påhittade personerna. E-legitimationen är simulerad och kopplad till ingen extern tjänst, och det står på sidan. Listan före inloggning visar en patient med skyddade personuppgifter som "Skyddad identitet" med maskerat personnummer.
- Invånarens session är skild från personalens: samma sessionskaka och sandlåda, men aldrig båda inloggade. Inloggning som invånare nollställer personalens inloggning, aktiva val och läskopia och byter sessionskaka, och omvänt. Personalens API:er svarar 401 för en invånare, och Min journal svarar 401 för personal.
- Behörigheten prövas i servern i varje anrop med `provaInvanare` i atkomst.js, en ren funktion som `prova`. Egen journal: från 16 år. Vårdnadshavare: barnets journal tills barnet fyller 13 år, aldrig för ett barn med skyddade personuppgifter. Mellan 13 och 16 år läser varken barnet eller vårdnadshavaren journalen i Min journal. Ineras villkor låter vårdgivaren förlänga eller förkorta vårdnadshavarens tillgång i enskilda fall; det är inte byggt.
- En journal som invånaren saknar koppling till svarar 404, oavsett om den finns, så att det inte går att pröva sig fram till andras patient-id. En journal med koppling som inte får läsas nu (barnet har fyllt 13) svarar 403 med skälet. Nekade försök mot en journal som finns loggas på den journalen.
- En invånare får göra högst 20 nekade försök i en sandlåda. Därefter stoppas försöken utan att loggas, så att ingen kan fylla en annan patients logglista med försök. Ett anrop till Min journal eller FHIR som webbläsaren märker som en navigering från en annan webbplats avvisas, eftersom sessionskakan är SameSite=Lax och en annan sida annars kunde få invånaren att göra åtkomster i sitt namn.
- Min journal har ingen läskopia och inget läsläge vid avbrott. Läsläget (D4) gäller personalen.

### Vad som visas

| Uppgift | Regel |
|---|---|
| Anteckningar | Bara signerade, i senaste versionen med äldre versioner överstrukna. Därtill vårdgivarens visningsregler per vårdenhet och anteckningstyp i tabellen `visningsregler` (seed/invanare.js): `direkt`, `fordrojd` (ett antal dagar efter signering) eller `visas_inte`. Den mest specifika regeln gäller. I demon: Allmänpsykiatriska klinikens mottagningsanteckningar visas 14 dagar efter signering, och klinikens omvårdnadsanteckningar visas inte. Det som inte visas räknas och redovisas med vårdgivarens motivering, men innehållet lämnas inte ut. |
| Provsvar | Labbvärden visas när ansvarig läkare har vidimerat dem (kolumnen `vidimerad`), dock senast 14 dagar efter provtagningen. Det som väntar redovisas med provets namn och datum då det senast visas. Vitalparametrar och PEF visas direkt. |
| Diagnoser, läkemedel, överkänslighet, remisser, vårdkontakter | Direkt. Remisser visas med status, frågeställning, svar och motivering vid avvisning. |
| Spärrade uppgifter | Visas för patienten själv. Spärren gäller vårdenheter emellan. Patienten ser vilka spärrar som finns. |
| Vaccinationer, tidbokningar, intyg | Finns inte i journalen i demon och visas därför inte. Det står i tjänsten. |

Att bara signerade anteckningar visas är ett val. Regioner som följer det nationella ramverket för 1177 journal visar i dag ofta också osignerade anteckningar, tydligt markerade, och låter patienten välja att inte se det som är nyare än 14 dagar (till exempel Region Gotlands rutin för 1177 Journalen, STY-09706, version 18.0, avsnitt 3.1). Regeln för osignerade anteckningar och fördröjningen av provsvar är inte konfigurerbara i demon; visningsreglerna för anteckningstyper är det.

Den som har skrivit och signerat en anteckning visas med namn och titel, eftersom det är en del av journalen. Svaren innehåller inte personalens id eller HSA-id, inga NLL-meddelanden, inga varningskvittenser, inga larm och inga kontaktuppgifter.

### Vem har läst min journal

- Logglistan är patientens rader ur samma åtkomstlogg som logguppföljningen. Varje rad har vårdgivare, vårdenhet (och avdelning eller mottagning), yrkesroll, tid, typ av åtkomst och grund (vårdrelation, aktivt val, nödåtkomst, samtycke till spärrade uppgifter, administrativ uppgift, logggranskning, nekad). Nödåtkomst, samtycke och nekade försök är markerade. Loggkedjans kontroll visas. Vårdens rader, invånarens egna och andra invånares hämtas med var sin gräns, så att många läsningar i Min journal aldrig tränger undan vårdens åtkomster ur listan. Logguppföljningen har filtret Vårdens åtkomster av samma skäl.
- **Personalens namn visas inte.** HSLF-FS 2016:40 4 kap. 10 § kräver vårdenhet och tidpunkt men inte användarens identitet, som bara ska finnas i själva loggen (4 kap. 9 a §). Rätten till tillgång enligt dataskyddsförordningen artikel 15 omfattar i regel inte identiteten på de anställda som har behandlat uppgifterna, utom när den är nödvändig för att den registrerade ska kunna utöva sina rättigheter (EU-domstolens dom den 22 juni 2023, C-579/21, Pankki S). Patienten kan i tjänsten begära ett loggutdrag med namn, som vårdgivaren då prövar. Loggens fritext (syftet med ett aktivt val eller en nödåtkomst) visas inte heller, eftersom den skrivs för uppföljningen och inte är prövad för utlämnande.
- Patientens egen läsning loggas med grunden `egen_atkomst` (vårdnadshavarens med `vardnadshavare`), utan personal och vårdenhet och med invånaren i kolumnen `invanare_id`. Raderna syns i patientens logglista, där de är dolda tills patienten väljer att visa dem, och i logguppföljningen som "Patienten själv" respektive vårdnadshavarens namn. De flaggas inte, eftersom de inte är vårdens åtkomst.

### Begäranden till vården

Patienten kan begära att uppgifter från en vårdenhet spärras, att en spärr hävs, och ett loggutdrag med namn. En begäran sparas i tabellen `begaran` med status `skickad`, loggas och visas för patienten. Den ändrar ingenting i journalen eller i spärrarna: vården ska pröva och registrera den. Handläggningen hos vården är inte byggd i demon. En vårdnadshavare kan inte begära spärr eller hävning (patientdatalagen 4 kap. 4 §), men kan begära loggutdrag.

### FHIR

Med sessionen från Min journal når invånaren `/fhir/Patient/{egen}`, `Patient/{egen}/$everything` och sökningar med `patient=` eller `subject=` för de egna journalerna, med samma visningsregler och samma loggning. FHIR-vägen lämnar inte ut mer än Min journal: egna mappningar tar bort kontaktuppgifter, remissens anamnes och remitterande läkare, NLL-status, katalogens id och personalens id, och en äldre version av en anteckning visas bara när den senaste versionen visas. En resurs i en annan journal svarar som en som inte finns. `Practitioner` och `AuditEvent` nekas, `Organization` går att läsa.

## Identiteter och sammanslagning (identitet.js, Sussa 3.1.1)

En patient identifieras med personnummer, samordningsnummer, reservnummer eller en annan identitet med OID. Varje patient har exakt en gällande identitet och sin historik i tabellen `identiteter` (status `gallande`, `tidigare` eller `ovrig` för en extra identitet bredvid den gällande). `patienter.personnummer` har den gällande identitetens värde och `patienter.id_typ` dess typ, så att listor, huvud och logg visar rätt nummer utan att fråga identitetstabellen.

Systemet är experten. Ett nummer skrivs eller klistras in i valfritt format, och `tolka()` avgör självt vad det är:

- Personnummer och samordningsnummer med 10 eller 12 siffror, med eller utan bindestreck och mellanslag. Med tio siffror väljs det sekel som inte ger ett födelsedatum i framtiden, och plustecknet betyder att personen har fyllt 100 år. Dag 61 till 91 betyder samordningsnummer. Kontrollsiffran räknas med Luhn-algoritmen.
- Reservnummer: VK, födelsedatumet med åtta siffror, ett löpnummer med tre siffror (sista siffran udda för man och jämn för kvinna) och en kontrollsiffra med samma algoritm, till exempel VK19650509-0023. Formatet är påhittat för demon.
- OID och nummer, med mellanslag, kolon eller lodstreck mellan, eller som `urn:oid:<rot>|<nummer>`. De nationella OID:erna för personnummer (1.2.752.129.2.1.3.1) och samordningsnummer (1.2.752.129.2.1.3.3) och FHIR-systemen från HL7 Sweden känns igen, och då prövas numret som personnummer eller samordningsnummer.

Är något fel säger systemet vad på vanlig svenska: att kontrollsiffran inte stämmer, vilken månad eller dag som inte finns, att födelsedatumet ligger i framtiden, hur många siffror numret har eller att det saknas ett nummer efter en OID. Det finns ingen lista att välja typ i. Gränssnittet visar tolkningen medan numret skrivs (`GET /api/identitet/tolka`).

OID-roten 1.3.6.1.4.1.32473 är IANA:s nummer för dokumentation och exempel (RFC 5612) och tillhör ingen verklig organisation. Demon använder grenen 1.3.6.1.4.1.32473.1: `.1.1` för Vårdkällans reservnummer och `.1.2` för ett påhittat utländskt id-system som en av seedens patienter identifieras med. Vårdkällan utger sig inte för att vara Region Örebro län eller någon annan vårdgivare.

I demon går bara Skatteverkets testpersonnummer att använda (kopia i `seed/testpersonnummer.json`), så att inga riktiga personnummer hamnar i sandlådorna. Skatteverket publicerar inga testsamordningsnummer. Demons samordningsnummer är därför påhittade och byggda på ett testpersonnummer: samma datum och löpnummer, dag plus 60 och en ny kontrollsiffra. Bara sådana samordningsnummer tas emot. Det går inte att kontrollera mot Skatteverket att ett sådant nummer aldrig har delats ut.

### Registrering och ny identitet

- En ny patient registreras från sökvyn. Med ett känt nummer ger numret typ, födelsedatum och kön, och bara namnet behövs (det finns ingen koppling till folkbokföringen i demon). Utan nummer skapar systemet ett reservnummer av kön och födelsedatum, eller av den ungefärliga åldern (då 1 januari det året). Födelsedatum och ålder skrivs i samma fält och systemet avgör vilket det är. Namnet kan saknas och blir då Okänd man eller Okänd kvinna. Den nya patienten får en pågående vårdkontakt på den enhet som registrerade (akut på akutmottagningen, annars öppenvård), så att vården kan dokumentera direkt.
- När personnummer eller samordningsnummer blir känt skrivs det in under fliken Identitet. Ett nummer med samma eller högre rang än det gällande (personnummer, samordningsnummer, OID, reservnummer i den ordningen) blir det gällande, och det gamla blir en tidigare identitet som går att söka på. Ett nummer med lägre rang läggs till som extra identitet. Födelsedatum och kön räknas om från ett personnummer eller samordningsnummer.
- Läkare, sjuksköterskor och vårdadministratörer registrerar patienter och nya identiteter (`registrera_patient`, `andra_identitet`). En ny identitet kräver vårdrelation som all annan åtkomst till patienten.

### Dubbletter och sammanslagning

Systemet hittar själv troliga dubbletter:

- samma namn, födelsedatum och kön när minst en av journalerna saknar personnummer (två olika personnummer är två olika personer), och
- när ett nummer som skrivs in redan tillhör en annan journal. Då sparas ett förslag i `dubblettforslag` i stället för att numret läggs till.

En patient med skyddad identitet föreslås aldrig på namn, bara när någon har skrivit in hela numret. Ett avfärdat förslag (Inte samma person) kommer inte tillbaka.

Vårdadministratören (`sla_samman`) ser förslagen i inkorgen och i patienthuvudet, öppnar journalerna sida vid sida under fliken Identitet och bekräftar. Systemet avgör vilken journal som blir kvar: den med den mest gällande identiteten, och vid lika den som skapades först. Vid ett förslag från ett inskrivet nummer blir journalen som har numret kvar. Två journaler slås bara samman när systemet har ett förslag om dem, och vårdadministratören måste ha vårdrelation till den journal förslaget öppnas från.

`slaSamman()` gör allt i en transaktion:

- Alla rader med `patient_id` i alla tabeller flyttas till den journal som blir kvar, också tabeller som läggs till senare: vårdkontakter, anteckningar, diagnoser, mätvärden, överkänslighet, ordinationer, remisser, väntrum, spärrar, begäranden och invånarens koppling i Min journal. Listningen flyttas bara om den gällande journalen saknar en. Signerade anteckningar flyttas utan att ändras: triggern som skyddar dem gäller alla kolumner utom `patient_id`.
- Den gamla journalens identiteter blir tidigare identiteter i den gällande journalen och går att söka på. Den gamla journalen finns kvar som historik med `sammanslagen_till`, och varje anrop på den leder till den gällande journalen (`patientRad` i servern, `gallandeId` i FHIR).
- Skyddad identitet följer med: är någon av journalerna skyddad blir den sammanslagna det. Saknade kontaktuppgifter fylls i från den gamla journalen.
- Åtkomstloggen ändras aldrig. Logglistan, både logggranskarens och patientens i Min journal, visar raderna för den gällande journalen och alla journaler som har slagits samman med den.
- Sammanslagningen loggas på båda journalerna (`sla_samman`) och sparas i `sammanslagningar` med vem, när, varför och vilka rader som flyttades. Tabellen kan inte ändras eller raderas. Att ett förslag visas loggas på den andra journalen (`dubblettkontroll`).

En sammanslagning går inte att ångra i demon.

### FHIR

`Patient.identifier` har alla identiteter: personnummer och samordningsnummer med HL7 Swedens system (`http://electronichealth.se/identifier/personnummer` och `.../samordningsnummer`, slices i SEBasePatient), reservnummer med `urn:oid:1.3.6.1.4.1.32473.1.1` och andra identiteter med sin OID. Den gällande har `use: official`, tidigare `old` och extra `secondary`. Basprofilen tillåter högst ett personnummer och ett samordningsnummer, så en tidigare identitet med samma system som en annan tas inte med i resursen, men den går att söka på. Den gällande journalen har `Patient.link` med `type: replaces` till varje sammanslagen journal, och den gamla journalen är `active: false` med `type: replaced-by`. `GET /fhir/Patient?identifier=` söker på alla identiteter, också tidigare, med eller utan system.

### Seed

Fyra påhittade patienter i `seed/identiteter.js`: Annika Holmgren med personnummer på Vårdcentralen Kumla (16) och samma person med reservnummer, inlagd på kardiologen i natt utan legitimation (17), en dubblett att slå samman. En säsongsarbetare med samordningsnummer på Vårdcentralen Tybble som först hade ett reservnummer (18), och en turist som identifieras med en identitet i det påhittade utländska id-systemet (19).

## Kravregistret (krav.js)

Varje post: `{ id, rubrik, kalla, status: "uppfyllt_demo" | "delvis" | "planerat", var: "sökväg i gränssnittet", tester: ["exakt testnamn"] }`. Vid bygget körs `bun test` och resultatet skrivs till `app/test-resultat.json`, som `/api/krav` läser in. Ett krav får status `uppfyllt_demo` bara om alla dess tester finns och är gröna. Det egna ramverket visas på kravsidan under fliken Eget ramverk (`#/krav?vy=egna`).

## Sussa-registret (sussa/)

Källa: Kravspecifikation lösning, Framtidens vårdinformationsstöd, Sussa samverkan, dnr 16RS2022, utdrag i Konkurrensverkets dnr 883/2023 aktbilaga 3, utlämnad 2026-11-03. Utdraget innehåller kapitel 1 till 6 och 11 med 305 poster i originalnumreringen: 50 krav vid anbud, 90 krav vid leverans och 165 utvärderingskriterier. Kapitel 7 (ekonomi), 8 (användbarhet och tillgänglighet), 9 (styrning och samverkan), 10 (utbildning) och 12 (underhåll och support) ingår inte i utdraget, och kapitel 1 har inga krav. Texterna är avskrivna från de skannade sidorna med rättad stavning, och tankstreck är ersatta med kommatecken.

- `app/src/sussa/kravspec.json`: posterna med `id`, `typ`, `rubrik`, `avsnitt`, `kapitel`, `sida`, `text`, `mervarden` och `kompletterar`, avsnitten med rubrik och sammanfattning, kapitlen och vilka som saknas.
- `app/src/sussa/mappning/<avsnitt>.js`: en fil per avsnitt med poster (61 filer), så att ett avsnitt kan ändras utan att röra de andra. Varje post har `id`, `kategori` (`system`, `nationell` när kravet kräver en nationell tjänst eller extern part, `leverantor` när det gäller leverantören, driften eller projektet), `egna` (kopplade krav i K, D, L och M), `tester`, `avsedd`, `losning` (vad Vårdkällan har i dag), `expert` (hur systemet tar expertrollen) och `anmarkning` (vad som saknas eller är simulerat).
- `app/src/sussa/index.js` samlar filerna och räknar status som för de egna kraven: `uppfyllt_demo` bara när alla tester finns och är gröna, annars `delvis`. En post utan tester är `planerat`. Bygget (`scripts/kor-tester.js`) stoppas om en post pekar på ett test som inte finns.
- Servertesterna i `app/test/sussa.test.js` kontrollerar att alla 305 id finns exakt en gång och har en mappning, att kategorierna är giltiga, att `uppfyllt_demo` kräver gröna tester, att varje system-post som inte är planerad har en expert-text och att källan och de saknade kapitlen anges.

Mappningen är gjord post för post mot testerna i `app/test` och `test/*.cjs`. En post har bara tester som verkligen visar det posten kräver, och hellre `delvis` än en överdriven status. Första mappningen (2026-11-03) gav 10 poster som avses vara uppfyllda i demon, 59 delvis och 236 planerade. Det mesta som är planerat är specialområden (kapitel 4), planering och bokning, nationella tjänstekontrakt och leverantörens åtaganden. Nationella poster och leverantörsposter visas med sin kategori. Simulerat: NLL, inloggningen med SITHS och e-legitimation, och all anslutning till nationella tjänster. Inga nationella tjänstekontrakt är anslutna.

Vyn `#/krav` visar Sussas krav som standard: en sammanställning per kategori och status, filter på kapitel, status och kategori, sökning på id eller text och, när en post öppnas, kravtexten, mervärdena, Vårdkällans lösning, hur systemet är experten, testerna med status och de kopplade egna kraven. Filtret sparas i adressen (`#/krav?kapitel=3&status=delvis`), och `#/krav?post=3.5.2.6` öppnar en post. Data kommer från `GET /api/krav/sussa`.

## Godkännandekriterier för första versionen

- `bun test` grönt, med tester för varje regel i behörighetsmotorn, loggkedjan och triggrarna, signering och rättelse, obligatoriska fält och varningar i läkemedel, NLL-timeout och avstämning, remissens statuskedja och larm, FHIR-svarens form.
- En Playwright-genomgång av varje demoroll utan konsolfel.
- Publik på https://vardkallan.404haven.se, verifierad utifrån.
