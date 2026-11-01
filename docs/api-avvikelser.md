# API-avvikelser och tillägg i första versionen

Det här dokumentet beskriver var backend avviker från eller lägger till något i API-kontraktet i `docs/design.md`. Allt som inte nämns här följer designen ordagrant.

## Allmänt

- **Felkoder.** Utöver 400, 403 och 404 används 401 med `kod: "ej_inloggad"` när ingen demoroll är vald, 405 för fel metod, 413 för för stor kropp (över 64 kB), 415 när kroppen inte är JSON, 429 när en adress skapar för många nya sandlådor (standard 60 per timme, `NYA_PER_TIMME`) och 500 med `kod: "fel"`.
- **Extra fält i fel.** Ett 400-fel kan ha `falt` (lista med ogiltiga fält). En ordination som stoppas av varningar har också `varningar`, `kraverKvittens` (regler som måste kvitteras) och `demoregler: true`.
- **Listsvar är objekt.** Där designen säger "lista" svarar dessa endpoints med ett objekt, så att gränssnittet får veta vad som döljs:
  - `GET /api/patient/:id/anteckningar` ger `{ anteckningar, dolda: { kraverVal, sparrade } }`
  - `GET /api/patient/:id/lakemedel` ger `{ ordinationer, dolda: { sparrade } }`
  - `GET /api/patient/:id/matvarden` ger `{ matvarden, dolda }`
  - `GET /api/patient/:id/remisser` ger `{ remisser, dolda }`
  - `GET /api/remisser` ger `{ riktning, remisser }`
  - `dolda.kraverVal` är antalet poster från andra vårdenheter som visas efter aktivt val. `dolda.sparrade` är true när spärrade uppgifter finns.
- **Kodvärden är ASCII.** Exempel: `yrke` är `lakare | sjukskoterska | underskoterska | vardadministrator | logggranskare`, väntrummets `prioritet` är `rod | orange | gul | gron | bla`.
- **Tider och datum.** Tider är ISO 8601 i UTC (`2026-10-31T09:10:00.000Z`). Datum är `YYYY-MM-DD` i svensk tid.
- **Säkerhetsrubriker på statiska filer.** `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Gränssnittet får alltså inte använda inline-skript eller externa resurser. Inline-stil går bra. Dessutom `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` och `Referrer-Policy: same-origin`.
- **Fallback.** Okända sökvägar utan filändelse får `public/index.html`. Saknade filer med filändelse ger 404.
- **Origin.** När `ORIGIN` är satt måste skrivande anrop ha `Origin` lika med `ORIGIN`, eller sakna `Origin` och ha en `Referer` som börjar med `ORIGIN`. Annars 403 `nekad`.
- **Miljövariabler.** `PORT`, `ORIGIN`, `SESSION_FIL`, `TESTRESULTAT` (sökväg till test-resultat.json, standard `app/test-resultat.json`), `NYA_PER_TIMME`.

## Session och inloggning

- `GET /api/session` har också `personal.yrkeText`, `personal.titel`, `personal.hsaId`, `enhet.hsaId`, `enhet.vardenhet` (den vårdenhet inre sekretess räknas mot, till exempel `uso-kard` för avdelning 72) och `behorigheter` (de handlingar rollen får göra, för att dölja knappar).
- `GET /api/demo/personal` ger `{ id, namn, yrke, yrkeText, titel, enhet: { id, namn, hsaId } }`. `yrke` är koden, `yrkeText` och `titel` är text att visa.
- `POST /api/login` byter sessionskakan (ny nyckel, samma sandlåda) och svarar som `GET /api/session`. Personalen har en fast enhet, så inget enhetsval skickas.
- `POST /api/logout` och `POST /api/login` nollställer alla aktiva val (andra enheter, nödåtkomst, samtycke, visa identitet).
- `POST /api/reset` ger en ny sandlåda men behåller inloggningen. Svar: `{ ok, ...session }`.
- `GET /api/enheter` ger ett träd av `{ id, hsaId, namn, kortnamn, typ, barn }` där `typ` är `vardgivare | sjukhus | vardenhet | arbetsplats | forvaltning`.

## Arbetslista, sök och väntrum

- `GET /api/arbetslista` har också `pagaende` och `vardform` (`slutenvard | akut | oppenvard | null`). `larm` är ett antal. `plats` är vårdkontaktens plats, eller `Inkommande remiss`, `Listad` eller `Nyligen avslutad kontakt`. Logggranskaren får en tom lista. Arbetslistan loggas inte.
- `GET /api/sok?q=` kräver minst två tecken. Namnsökningen jämför med svensk gemenisering, så att Åkesson hittas på både åkesson och ÅKESSON (SQLite:s `lower()` hanterar bara ASCII). Svar: `[{ id, namn, personnummer, alder, kon, skyddad, vardrelation }]`, högst 20 träffar. En patient med skyddad identitet hittas aldrig på namn och bara på fullständigt personnummer (10 eller 12 siffror). Sökningen loggas med söksträngen i `resurs`.
- `GET /api/vantrum` ger `{ konummer, ankomst, prioritet, status, vantetidMin, uppropning }` för alla. `uppropning` är alltid `Nummer A09`, aldrig ett namn. Personal på akutmottagningen får också `patientId`, `skyddad`, `orsak` och `namn`, där `namn` är `null` för skyddade patienter.

## Patient

- `GET /api/patient/:id` har också `nodatkomst`, `samtyckeSparr`, `visad` och `listning`. `overkanslighet` är `null` för vårdadministratören. Vårdadministratören läser huvudet med handlingen `las_admin`.
- `POST /api/patient/:id/val` kräver `syfte` (3 till 300 tecken) för alla typer. Svar: `{ ok, val: { andra_enheter, nodatkomst, samtycke_sparr, visa_identitet } }`. 400 om nödåtkomst väljs fast vårdrelation finns, om samtycke väljs fast patienten inte har spärrade uppgifter och om visa identitet väljs för en patient utan skyddad identitet. Ett val kan inte ångras i v1, det gäller tills utloggning.
- Nödåtkomst visar alla ospärrade vårdenheters uppgifter utan ett separat aktivt val. Den häver aldrig en spärr.
- `GET /api/patient/:id/oversikt`: ett fält är `null` när rollen saknar rätt till det (till exempel `lakemedel` för vårdadministratören). Tillagt: `vardkontakter`, `kontakt` (`adress`, `postnr`, `ort`, `telefon`, `kontaktperson`, alltid `null` för skyddad patient) och `dolda`. `anteckningar` är de fem senaste i kortform med `sammanfattning` i stället för `sokord`. `remisser` är de pågående (inte kvitterade och inte avvisade). En post i `tidslinje` är `{ tid, typ: vardkontakt|anteckning|ordination|remiss, rubrik, text, enhet, kalla, kallaEtikett, ref: { typ, id } }`, sorterad nyast först.

## Anteckningar

- En anteckning är `{ id, patientId, typ, kategori: lakare|omvardnad, enhet, vardkontaktId, forfattare, skapad, andrad, status, signerad: { tid, av } | null, version, ersatterId, rattelseOrsak, ersattAvId, ersatt, kalla, kallaEtikett, sokord }`. `GET /api/anteckning/:id` har också `versioner`, hela kedjan från första till senaste version.
- Utkast syns bara för författaren. Andra får 404 vid läsning och 403 vid ändring eller signering.
- `PUT /api/anteckning/:id` tar `{ sokord?, vardkontaktId? }`. Signerad anteckning ger 400 `ogiltig`.
- `POST /api/anteckning/:id/ratta` svarar 201 med den nya versionen, som är signerad direkt. Bara den senaste versionen kan rättas, och bara av samma vårdenhet som skrev anteckningen.
- `POST /api/patient/:id/anteckningar` svarar 201.

## Läkemedel

- **Fältnamn för en ordination:** `{ lakemedelId, dosering, dos?, dosEnhet?, tider?: ["08", "20"], vidBehov?, typ: staende|vid_behov|tillfallig, ordinationsorsak, uppfoljningsdatum: "YYYY-MM-DD", start?: "YYYY-MM-DD" (standard i dag), slut? }`. Svaret på en ordination har samma namn plus `id, lakemedel, status: aktiv|utsatt, aktuell, utsatt, ordineradAv, vardenhet, nll_status, kvitteradeVarningar, historik, nll, kalla, kallaEtikett`.
- `POST /api/patient/:id/lakemedel/kontroll` ger `{ varningar, demoregler: true, anmarkning }`. Reglerna (`regel`) är `overkanslighet`, `dubbel_substans`, `dubbel_grupp`, `dubbel_antikoagulantia`, `warfarin_nsaid`, `metformin_egfr`.
- `POST /api/patient/:id/lakemedel` svarar 201 med `{ ordination, varningar, nll: { id, status, kvittens? } }`.
- `POST /api/ordination/:id/utsatt` ger `{ ordination, nll }`.
- `POST /api/ordination/:id/nll-avstam` ger `{ ordination, resultat: fanns_registrerad|skickad_igen, ... }`. 400 om ordinationen redan är kvitterad.
- `POST /api/demo/nll-timeout` tar valfritt `{ lage: "fel" }`, så att nästa överföring får ett felsvar i stället för timeout. Svar: `{ ok, nastaOverforing }`.
- **Katalogen.** Varje post i `GET /api/lakemedel/katalog` och `lakemedel` i en ordination har `id` (Vårdkällans katalognyckel, till exempel `VK-NPL-0001`, som `lakemedelId` anger), `npl` (produktens NPL-id hos Läkemedelsverket), `namn`, `substans`, `styrka`, `form` och `atc`. Designen säger cirka 40 läkemedel med påhittat NPL-id. Katalogen har 50 verkliga produkter med riktiga NPL-id, kontrollerade mot NPL, se `docs/lakemedelskontroll.md`.
- `nll_status` är `skickad` (bara under själva anropet), `kvitterad`, `okand_kontrolleras` eller `fel`.
- **Gemensam läkemedelslista.** Läkemedelslistan och överkänsligheterna är gemensamma för vårdgivaren och kräver inget aktivt val för andra vårdenheters poster. Spärrade enheters poster döljs ändå. Övriga uppgifter (anteckningar, diagnoser, mätvärden, vårdkontakter) följer inre sekretess.
- Metforminregeln använder senaste eGFR från alla ospärrade enheter.

## Mätvärden

- Typer och enheter: `blodtryck` (mmHg, anges `"120/80"`), `puls` (slag/min), `temp` (°C), `saturation` (%), `andningsfrekvens` (andetag/min), `vikt` (kg), `langd` (cm), `crp` (mg/L), `egfr` (mL/min/1,73 m²), `kreatinin` (µmol/L), `hba1c` (mmol/mol), `inr` (INR), `ntprobnp` (ng/L), `hb` (g/L), `glukos` (mmol/L), `kalium` (mmol/L), `pef` (L/min), `troponin` (ng/L), `tsh` (mIE/L). `enhet` i POST är valfritt men måste stämma. `tid` måste ligga inom de senaste 30 dagarna. POST svarar 201.

## Remisser

- `prioritet` är `akut | skyndsam | normal`. `svarSenast` är ett datum som inte passerat. `tillEnhetId` måste vara en annan vårdenhet (typ `vardenhet`, inte en avdelning).
- En remiss är `{ id, patientId, patient?, fran, till, avsandare, prioritet, svarSenast, status, beslut, tider: { skickad, mottagen, bedomd, besvarad, svarKvitterat }, av: {...}, larm, fragestallning, anamnes, motivering, svar, kalla, kallaEtikett }`. Vårdadministratören får `fragestallning`, `anamnes`, `motivering` och `svar` som `null`.
- En avvisad remiss har `status: "bedomd"` och `beslut: "avvisad"`, och kedjan slutar där.
- Mottagningskvittens görs av läkare eller vårdadministratör på mottagande vårdenhet. Bedömning och svar görs av läkare på mottagande vårdenhet. Kvittens av svaret görs av läkare på remitterande vårdenhet. Fel enhet ger 403.
- I `GET /api/inkorg` har posterna i `osigneradeAnteckningar` och `nllAvvikelser` också `patient` (`{ id, namn, personnummer, skyddad }`, maskerat för skyddad identitet), så att inkorgen kan visa vem raden gäller.
- Larm: `saknar_mottagningskvittens` och `svar_forsenat` syns för både avsändare och mottagare, `svar_ej_kvitterat` bara för avsändaren. Ett larm är `{ typ, text, sedan, remissId, patientId, patient, riktning }` i inkorgen.
- Vårdrelation via remiss: mottagande enhet har vårdrelation så länge remissen inte är avvisad och tills 90 dagar efter att svaret kvitterats. Remitterande enhet har vårdrelation tills svaret är kvitterat.

## Logg

- `GET /api/patient/:id/logglista` ger `{ patientId, patient, rader, kedjaHel }` och är bara öppen för logggranskaren. En vy för patienten själv finns inte i v1.
- `GET /api/logg` ger `{ flagga, rader, kedjaHel, verifiering: { hel, antal, felRad, orsak } }`, högst 500 rader, nyast först. `fran` och `till` kan vara datum eller ISO-tid.
- En loggrad i API:t är `{ id, tid, personal, enhet, patientId, patient, handling, resurs, grund, syfte, resultat, flaggad, hash }`. `patient` är `{ id, namn, personnummer, skyddad }` med namn och personnummer maskerade för skyddad identitet (även för logggranskaren), eller `null` när raden inte gäller en patient.
- Varje anrop som rör en patient ger en loggrad med den starkaste grunden som användes (samtycke_sparr före nodatkomst före aktivt_val före egen_enhet). Inkorg, arbetslista och remisslistor loggas inte i v1.

## Migrering, krav och drift

- `GET /api/migrering` ger `{ datatyper: [{ datatyp, kalla, antalKalla, antalOverforda, antalVerifierade, avvikelse }], avvikelser: [{ id, patientId, datatyp, kalla, beskrivning, atgard, status }], summa }`.
- `GET /api/krav` ger `{ testresultat, summa, krav }`. Varje krav har också `avsedd` (den status kravet är tänkt att nå) och `tester: [{ namn, status: grön|röd|hoppad|saknas }]`. Kraven och testresultatet kräver ingen inloggning.
- **Lagkraven är L1 till L13**, inte L1 till L8: rapportens tabell "Lagkrav och nationella tjänster" har 13 rader och varje rad blev ett krav. Dessutom finns **M1 till M13** från tabellen "Misstag att inte upprepa".
- `GET /api/drift` ger `{ startad, sandladar, mal: { p95Ms: 200 }, server: [{ endpoint, antal, p50, p95, inomMal }], sandlada: [...] }`. `endpoint` är normaliserad, till exempel `GET /api/patient/:id`. Mätningen gäller de senaste 1000 anropen per endpoint för servern och 200 för sandlådan.

## Läsläge vid avbrott (D4)

- `POST /api/login` och `GET /api/session` har `lasnyckel: { nyckel, giltigTill }` när någon är inloggad: en slumpad AES-nyckel på 256 bitar (base64url) som webbläsaren krypterar sin läskopia med. Den byts vid varje inloggning, glöms vid utloggning och gäller i 8 timmar.
- `GET /api/lasekopia` ger `{ skapad, giltigTill, session, enheter, mallar, arbetslista, patienter: { [id]: { handling, huvud, oversikt, lakemedel, anteckningar, anteckning: { [id]: full anteckning } } } }` för patienterna på arbetslistan och de patienter den inloggade har öppnat under sessionen. Varje del byggs med samma funktion och samma behörighetskontroll som det vanliga anropet, så den är identisk med vad `GET /api/patient/:id`, `/oversikt`, `/lakemedel` och `/api/anteckning/:id` ger. `anteckningar` har de fem senaste och `iLaskopian` och `totalt`. `session` har inte nyckeln. Logggranskaren får en tom kopia. Utlämnandet loggas en gång per patient och inloggning med resurs `lasekopia`, och igen om grunden ändras.
- `POST /api/lasekopia/logg { rader: [{ id, tid, patientId, handling, resurs }] }` tar emot åtkomster från läsläget när servern svarar igen. Högst 500 rader. En rad tas emot bara om patienten finns i den inloggades läskopia, handlingen är en läsning som rollen har (`las_oversikt`, `las_admin`, `las_lakemedel`, `las_journal`, `las_omvardnad`) och tiden ligger inom läskopians giltighet (fem minuters marginal för klockan). Raden loggas med webbläsarens tid, grunden från när kopian lämnades ut, resurs `laslage:<sökväg>` och syftet "Läsläge vid avbrott, läskopia i webbläsaren". Svar: `{ mottagna, avvisade: [{ id, orsak }] }`. Ett `id` som redan har tagits emot räknas som mottaget men loggas inte igen.
- Nyckeln, de öppnade patienterna och vilka patienter som lämnats ut sparas med sandlådan vid omstart.
- `public/sw.js` cachar de statiska filerna. `/api` och `/fhir` går aldrig via service workern.

## Krav och klickbudget (D6)

- `GET /api/krav` läser också `klickbudget.json` och `klienttest-resultat.json` (miljövariabler `KLICKBUDGET` och `KLIENTTESTER`), som skrivs av Playwright-skripten `test/klickbudget.cjs`, `test/avbrott.cjs` och `test/anvandartest.cjs`. De två senare skriver till samma fil och ersätter bara sina egna tester (`test/klienttester.cjs`). Tillagt i svaret: `klienttester: { tid, antal, godkanda, aktuell }` och för D6 `klickbudget: { tid, regler, floden, aktuell }`. Testerna av gränssnittet räknas som `inaktuell` när hashen av `public/` inte är densamma som när de kördes.
- `GET /api/health` ger också `version` (appens version ur `package.json`) och `gransnitt` (sha256 över alla filer i `public/`, samma hash som Playwright-skripten skriver). Användartestet märker sina resultatfiler med dem.
- Användartestet (`#/anvandartest`, `public/js/anvandartest.js`) skickar inget till servern utöver de vanliga anropen när deltagaren gör uppgifterna, och testläget loggar in rätt demoroll och återställer demon när rollen byts. Resultatet stannar i webbläsaren. Resultatfilerna sammanställs med `bun scripts/sammanstall-anvandartest.js`, se `docs/anvandartest.md`.

## FHIR

- Bara läsning. FHIR-anrop skapar ingen sandlåda: utan sessionskaka eller inloggning blir svaret 401 `OperationOutcome`, utom för `/fhir/metadata` och Vårdkällans egna definitioner (`/fhir/StructureDefinition`, `/fhir/CodeSystem` och `/fhir/ValueSet`, som kan sökas med `url` eller `_id`).
- En sökning utan träffar är en `Bundle` med `total: 0` och utan `entry`, eftersom FHIR inte tillåter tomma listor. Inga resurser innehåller tomma listor.
- Fel är `OperationOutcome` där `issue[0].details.coding[0]` har systemet `https://vardkallan.404haven.se/fhir/CodeSystem/felkod` och samma kod som `/api` (`kraver_val`, `kraver_samtycke`, `nekad`, `saknas`, `ogiltig`, `ej_inloggad`).
- `Patient` söks med `_id`, `identifier` (`system|värde` eller bara personnumret) eller `patient`. Patienter som användaren inte har behörighet till tas inte med i sökresultatet. Läsning av en sådan patient ger 403.
- Skyddad patient: `name` är `[{ text: "Skyddad identitet" }]`, personnumret maskeras som `19840416****` och `meta.security` har `sekretessmarkering` ur HL7 Swedens `http://hl7.se/fhir/ig/base/CodeSystem/SecurityLabel` och `R` ur `v3-Confidentiality`. Adress och telefon skickas aldrig, inte heller efter visa identitet.
- `Organization` och `Practitioner` kan listas utan patient. HSA-id har systemet `urn:oid:1.2.752.29.4.19` och `type` `PRN` ur `v2-0203`, som basprofilerna anger.
- **ICD-10-SE har systemet `urn:oid:1.2.752.116.1.1.1`**, inte `http://hl7.org/fhir/sid/icd-10-se` som designen säger. Den adressen är inte registrerad hos HL7 och ger fel i validatorn, och OID:n är den Socialstyrelsen anger för ICD-10-SE. `display` är Socialstyrelsens titel.
- `Observation`: labbvärden har NPU (`http://npu-terminology.org`), vitalparametrar och PEF har LOINC, och alla värden har UCUM-enhet (`system` och `code`) utöver den svenska `unit`. Vitalparametrarna följer FHIR R4:s vitalparameterprofiler och anger dem i `meta.profile`; saturation har både 2708-6 (som profilen kräver) och 59408-5. eGFR har bara text, eftersom NPU saknar kod för skattat GFR. Den svenska benämningen står i `code.text`, och `display` är kodverkets egen (engelska för LOINC). Koderna står i `app/src/kodverk.js`.
- `MedicationRequest` har ATC med WHO:s benämning som `display` och produktens riktiga NPL-id med E-hälsomyndighetens system `http://electronichealth.se/fhir/NamingSystem/nplid` (samma som i deras FHIR-profiler för Nationella läkemedelslistan, utan `display` som i deras exempel), och tilläggen `uppfoljningsdatum`, `nll-status` och `utsattningsorsak` under `https://vardkallan.404haven.se/fhir/StructureDefinition/`. `ServiceRequest` har tilläggen `remisstatus` och `svar-senast`, och `AuditEvent` tillägget `hash`. Alla tillägg och kodsystemen `kalla`, `felkod`, `atkomstgrund`, `nll-status` och `remisstatus` är definierade i `app/src/fhir-definitioner.js`. `AuditEvent.purposeOfEvent` har systemet `https://vardkallan.404haven.se/fhir/CodeSystem/atkomstgrund`.
- `Composition.status` är `final`, `amended` (en rättelse, med `relatesTo` av typen `replaces`) eller `preliminary` (eget utkast).
- Alla resurstyper är validerade med HL7:s validator mot FHIR R4 och HL7 Swedens basprofiler (`hl7se.fhir.base` 1.1.0) utan fel, se `docs/fhir-validering.md`. `Patient`, `Organization` och `Practitioner` anger basprofilerna i `meta.profile`. Övriga resurstyper påstår ingen profil utöver FHIR R4.

## Seed

- 15 patienter (`p01` till `p15`), inte 12. De tre extra behövs för väntrummet och psykiatrins arbetslista.
- Utöver de åtta demorollerna finns personal som inte går att logga in som, för att journalerna ska ha författare på andra enheter.

## POST /api/logout tar emot åtkomster från läsläget

`POST /api/logout { rader?: [...] }` med samma radformat som `POST /api/lasekopia/logg`. Raderna loggas med samma kontroller innan sessionen avslutas, och svaret får fältet `lasloggen: { mottagna, avvisade }`. Klienten raderar sin lokala logg först när servern har svarat. Utan rader fungerar utloggningen som förut.

Utloggningen avslutar alltid sessionen, även när raderna inte går att ta emot (då står felet i `lasloggen.fel`). Klienten skickar högst 200 rader per anrop, allt utom sista omgången via `POST /api/lasekopia/logg`, och loggar ut utan rader om servern svarar 400 eller 413.
