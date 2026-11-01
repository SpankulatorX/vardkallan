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

Patienterna loggar in i Min journal med simulerad e-legitimation. Varje patient i seeden är också en invånare (`inv-p01` till `inv-p15`), och därtill finns vårdnadshavaren Johanna Bergström (`inv-vh01`, testpersonnummer 19861214-2383) till barnet Leo Bergström (p09), utan egen journal i demon. Barnet kan inte logga in självt.

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

## API-kontrakt (JSON, sessionskaka `vk_sid`, HttpOnly, SameSite=Lax)

Alla svar har rubriken `Server-Timing: app;dur=<ms>`. Fel: `{ fel: "text", kod: "nekad" | "saknas" | "ogiltig" | "kraver_val" | "kraver_samtycke" }` med 400, 403 eller 404. `kraver_val` och `kraver_samtycke` betyder att åtgärden blir möjlig med ett aktivt val respektive samtycke och att gränssnittet ska fråga.

- `GET /api/health` → `{ ok, sandladar }`
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

- Logglistan är patientens rader ur samma åtkomstlogg som logguppföljningen. Varje rad har vårdgivare, vårdenhet (och avdelning eller mottagning), yrkesroll, tid, typ av åtkomst och grund (vårdrelation, aktivt val, nödåtkomst, samtycke till spärrade uppgifter, administrativ uppgift, logggranskning, nekad). Nödåtkomst, samtycke och nekade försök är markerade. Loggkedjans kontroll visas.
- **Personalens namn visas inte.** HSLF-FS 2016:40 4 kap. 10 § kräver vårdenhet och tidpunkt men inte användarens identitet, som bara ska finnas i själva loggen (4 kap. 9 a §). Rätten till tillgång enligt dataskyddsförordningen artikel 15 omfattar i regel inte identiteten på de anställda som har behandlat uppgifterna, utom när den är nödvändig för att den registrerade ska kunna utöva sina rättigheter (EU-domstolens dom den 22 juni 2023, C-579/21, Pankki S). Patienten kan i tjänsten begära ett loggutdrag med namn, som vårdgivaren då prövar. Loggens fritext (syftet med ett aktivt val eller en nödåtkomst) visas inte heller, eftersom den skrivs för uppföljningen och inte är prövad för utlämnande.
- Patientens egen läsning loggas med grunden `egen_atkomst` (vårdnadshavarens med `vardnadshavare`), utan personal och vårdenhet och med invånaren i kolumnen `invanare_id`. Raderna syns i patientens logglista, där de är dolda tills patienten väljer att visa dem, och i logguppföljningen som "Patienten själv" respektive vårdnadshavarens namn. De flaggas inte, eftersom de inte är vårdens åtkomst.

### Begäranden till vården

Patienten kan begära att uppgifter från en vårdenhet spärras, att en spärr hävs, och ett loggutdrag med namn. En begäran sparas i tabellen `begaran` med status `skickad`, loggas och visas för patienten. Den ändrar ingenting i journalen eller i spärrarna: vården ska pröva och registrera den. Handläggningen hos vården är inte byggd i demon. En vårdnadshavare kan inte begära spärr eller hävning (patientdatalagen 4 kap. 4 §), men kan begära loggutdrag.

### FHIR

Med sessionen från Min journal når invånaren `/fhir/Patient/{egen}`, `Patient/{egen}/$everything` och sökningar med `patient=` eller `subject=` för de egna journalerna, med samma visningsregler och samma loggning. En resurs i en annan journal svarar som en som inte finns. `Practitioner` och `AuditEvent` nekas, `Organization` går att läsa.

## Kravregistret (krav.js)

Varje post: `{ id, rubrik, kalla, status: "uppfyllt_demo" | "delvis" | "planerat", var: "sökväg i gränssnittet", tester: ["exakt testnamn"] }`. Vid bygget körs `bun test` och resultatet skrivs till `app/test-resultat.json`, som `/api/krav` läser in. Ett krav får status `uppfyllt_demo` bara om alla dess tester finns och är gröna.

## Godkännandekriterier för första versionen

- `bun test` grönt, med tester för varje regel i behörighetsmotorn, loggkedjan och triggrarna, signering och rättelse, obligatoriska fält och varningar i läkemedel, NLL-timeout och avstämning, remissens statuskedja och larm, FHIR-svarens form.
- En Playwright-genomgång av varje demoroll utan konsolfel.
- Publik på https://vardkallan.404haven.se, verifierad utifrån.
