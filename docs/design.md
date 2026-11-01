# Vårdkällan: design för första versionen

Vårdkällan är ett öppet och komplett vårdinformationssystem, byggt från grunden på öppna standarder. Det är inte en kopia av Cosmic. Första versionen är en publik demo på https://vardkallan.404haven.se med påhittade patienter i Region Örebro läns verksamheter. Den ska visa att kärnan i ett journalsystem går att bygga öppet, och att de fel som drabbade Cosmic i Sussa går att konstruera bort.

Underlag: en sammanställning av offentliga källor om upphandlingen av Cosmic och kritiken mot systemet (Konkurrensverkets ansökningar, förvaltningsrättens och kammarrättens domar, revisionsrapporter och regionernas egna handlingar). Krav-id nedan (K1 till K5, D1 till D12, L1 till L13) kommer därifrån.

## Mål

1. Patientöversikt, journalanteckningar, läkemedelslista, remiss och svar, mätvärden och diagnoser för en patient.
2. Behörighet enligt patientdatalagen och HSLF-FS 2016:40 4 kap.: vårdrelation, inre sekretess med aktivt val, spärr med spärrmarkering, nödåtkomst, minsta nödvändiga åtkomst per yrkesroll.
3. Skyddade personuppgifter skyddas i hela kedjan, även i väntrum och uppropning.
4. Varje åtkomst loggas i en logg som inte går att ändra (hashkedja och databastriggrar). Logglista till patienten och logguppföljning för granskare.
5. Läkemedelslistan är byggd för Nationella läkemedelslistan: ordinationsorsak och uppföljningsdatum är obligatoriska, och varje överföring har kvittens. En timeout döljer aldrig en lyckad förskrivning (D1).
6. Remisser har mottagningskvittens, bedömning, svar och kvittens av svaret, med larm när något uteblir (D1).
7. Migrerad historik från VAS och Cosmic visas i samma kronologi som ny dokumentation, med källa utskriven, och en avstämningsrapport för migreringen (D2, D3).
8. Öppet FHIR R4-API för alla resurser, med samma behörighetskontroll och loggning som gränssnittet (D9).
9. Kravspårbarhet: en sida som visar varje krav, var det uppfylls och vilka automatiska tester som visar det, med testresultat från bygget (K1, K4).
10. Svarstid mäts för varje anrop och visas (D5).

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

## Behörighetsmotorn (atkomst.js)

En ren funktion `prova(db, { personal, patient, handling, resurs, val })` som returnerar `{ tillaten, grund, krav, spärrade, skal }`. Regler:

1. **Yrkesroll** bestämmer vilka handlingar som alls är möjliga (minsta åtkomst, D8):
   - Läkare: läsa och skriva journal, ordinera, remittera, svara på remiss.
   - Sjuksköterska: läsa journal, skriva omvårdnadsanteckning, registrera mätvärden, ge och kvittera, inte ordinera.
   - Undersköterska: läsa översikt (läkemedel, mätvärden, överkänslighet, omvårdnadsanteckningar), registrera mätvärden. Inte läkaranteckningar.
   - Vårdadministratör: administrativa uppgifter (namn, kontakter, remissernas status, vårdkontakter), ingen journaltext, inga läkemedel.
   - Logggranskare: åtkomstloggen för alla patienter, ingen journal.
2. **Vårdrelation** krävs för journalåtkomst. Den finns om patienten har en pågående eller nyligen avslutad (90 dagar) vårdkontakt, inskrivning eller listning på personalens enhet, eller en remiss till enheten.
3. **Inre sekretess**: personalen ser utan vidare sin egen enhets uppgifter. Andra enheters uppgifter inom vårdgivaren visas först efter ett aktivt val ("Visa uppgifter från andra vårdenheter") med angivet syfte. Valet loggas och gäller sessionen för den patienten.
4. **Spärr**: en patient kan ha spärrat uppgifter från en enhet (i demon: Allmänpsykiatriska kliniken för en patient). Andra enheter ser en spärrmarkering, "Det finns spärrade uppgifter", men inte innehållet eller enhetens namn. Spärren kan tillfälligt hävas bara med patientens samtycke i stunden, vilket registreras och loggas. Nödåtkomst häver aldrig en spärr.
5. **Nödåtkomst**: utan vårdrelation kan en läkare eller sjuksköterska öppna journalen om patienten inte kan samtycka och det behövs för vården. Motivering är obligatorisk, åtkomsten flaggas i loggen och syns i logguppföljningen.
6. **Utan grund** nekas åtkomsten, och försöket loggas som nekat.
7. **Skyddade personuppgifter**: patienten har markering. Namn ersätts av "Skyddad identitet" i listor, adressen visas aldrig, personnumret visas maskerat (`19800101-****`) tills personalen väljer "Visa identitet" med syfte (loggas). I väntrums- och uppropningsvyn visas bara könummer för alla patienter, och aldrig namn för en skyddad patient.

Servern anropar motorn i varje API- och FHIR-anrop. Gränssnittet döljer bara knappar för det som motorn ändå nekar.

## Loggen (logg.js)

Tabell `atkomstlogg` med `id, tid, personal_id, enhet_id, patient_id, handling, resurs, grund, syfte, resultat, prev_hash, hash`. `hash = sha256(prev_hash + kanonisk JSON av raden)`. SQLite-triggrar `BEFORE UPDATE` och `BEFORE DELETE` gör `RAISE(ABORT, ...)`. En funktion `verifiera(db)` kontrollerar hela kedjan. Grund är en av `egen_enhet`, `vardrelation`, `aktivt_val`, `samtycke_sparr`, `nodatkomst`, `administrativ`, `logggranskning`, `nekad`.

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
- `GET /api/sok?q=` → sök på personnummer eller namn i hela regionen. Träffar visas med maskering. Sökningen loggas.
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
- `GET /api/patient/:id/logglista` → åtkomster för patienten (för patientens rätt till logginformation, och för logggranskaren).
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

## Kravregistret (krav.js)

Varje post: `{ id, rubrik, kalla, status: "uppfyllt_demo" | "delvis" | "planerat", var: "sökväg i gränssnittet", tester: ["exakt testnamn"] }`. Vid bygget körs `bun test` och resultatet skrivs till `app/test-resultat.json`, som `/api/krav` läser in. Ett krav får status `uppfyllt_demo` bara om alla dess tester finns och är gröna.

## Godkännandekriterier för första versionen

- `bun test` grönt, med tester för varje regel i behörighetsmotorn, loggkedjan och triggrarna, signering och rättelse, obligatoriska fält och varningar i läkemedel, NLL-timeout och avstämning, remissens statuskedja och larm, FHIR-svarens form.
- En Playwright-genomgång av varje demoroll utan konsolfel.
- Publik på https://vardkallan.404haven.se, verifierad utifrån.
