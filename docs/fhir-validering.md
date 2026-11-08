# FHIR-validering

Validering av Vårdkällans FHIR-svar mot FHIR R4 och HL7 Swedens basprofiler, gjord 2026-10-31 och för utskriften av alla resurser upprepad 2026-11-01 efter läkemedelskontrollen och 2026-11-03 med alla resurstyper efter runda 4 (se [Omvalidering 2026-11-03](#omvalidering-2026-11-03-alla-resurstyper-efter-runda-4)). Resultat: **inga fel** för någon resurstyp. Varningarna listas nedan.

Identiteterna (Sussa 3.1.1) validerades 2026-11-03 med samma validator och paket: alla 19 `Patient` mot `SEBasePatient`, däribland samordningsnummer med HL7 Swedens system, reservnummer och utländsk identitet med `urn:oid:` och en tidigare identitet med `use: old`, och dessutom två sammanslagna journaler med `Patient.link` (`replaces` och `replaced-by`, den gamla med `active: false`). Resultat: 0 fel och 23 varningar, samma slags varningar som i tabellen nedan (dom-6 och sekretessmarkeringen).

Vaccinationerna i barnhälsovården (`Immunization`) och huvudomfånget (`Observation` med vitalparameterprofilen headcircum) validerades 2026-11-08 med samma validator och paket: 16 Immunization (åtta för personalen och åtta för invånaren) och fyra Observation för huvudomfång. Resultat: 0 fel och en varning per resurs (dom-6, ingen narrativ text), som för de andra resurstyperna.

## Verktyg och paket

| Del | Version |
|---|---|
| Validator | HL7 FHIR Validation tool 7.0.3 (Git 28e9fac6d79d, byggd 2026-10-21), `validator_cli.jar` från https://github.com/hapifhir/org.hl7.fhir.core/releases/tag/7.0.3, sha256 57aa43fb40cec5de41def81c927725fd85908eeb71509b7f9313e04d9b8ec79b (samma som GitHubs digest) |
| Java | `eclipse-temurin:21-jre` (Java 21.0.13), `eclipse-temurin@sha256:0b99b3376fbb50dbf9c0af8535fdd5b8eb0d3fdfc8b1e4967f383b6919f6901a`, i en container, inte på värden |
| FHIR | `hl7.fhir.r4.core` 4.0.1 |
| Basprofiler | `hl7se.fhir.base` 1.1.0 (HL7 Sweden, Swedish Base Profiles Implementation Guide, byggd 2025-05-20), senaste versionen i både packages.fhir.org och packages.simplifier.net. Kanonisk adress `http://hl7.se/fhir/ig/base`. Paketet sha256 3d31a95de3a67a0deba8e2cd3a9a6582d51464a6028e66e35063024bd18372b7 |
| Beroenden som validatorn hämtade | `hl7.terminology.r4` 6.3.0 och 6.2.0, `hl7.fhir.uv.extensions.r4` 5.2.0, `hl7.terminology` 7.5.0, `hl7.fhir.uv.extensions` 5.4.0, `hl7.fhir.xver-extensions` 0.1.0 |
| Terminologi | https://tx.fhir.org (LOINC 2.83, ATC, UCUM) |
| Egna definitioner | `app/src/fhir-definitioner.js`: sex tillägg, fem kodsystem och fem värdemängder, version 0.2.0. Laddas med `-ig`. Version 0.3.0 (2026-11-01) lade till koderna `egen_atkomst` och `vardnadshavare` i kodsystemet `atkomstgrund` för Min journal; valideringen ovan gjordes med 0.2.0 |

Basprofilerna finns för Patient, Organization, Practitioner och PractitionerRole (och datatyperna HumanName och Address). Övriga resurstyper har ingen svensk basprofil och validerades mot FHIR R4.

## Så gjordes valideringen

1. Alla resurser som demorollerna når, för alla patienter och med alla aktiva val (andra vårdenheter, nödåtkomst, samtycke), skrevs ut med `test/fhir-validering/exportera.js`. Organization, Practitioner, AuditEvent, CapabilityStatement och de egna definitionerna kom med. Sedan 2026-11-03 skriver skriptet också tidbokens resurser (Schedule, Slot och Appointment), administreringen (MedicationAdministration), vidimeringen (List) och invånarnas resurser i Min journal, och det avslutar med felkod 1 om någon resurstyp som `fhir.js` och `tidbok-fhir.js` kan lämna ut saknas i utskriften, så att en ny resurstyp inte kan hamna utanför valideringen.
2. Dessutom hämtades svar över HTTP från en lokal server (`bun src/server.js` i `oven/bun:1.3.14-alpine`), inloggad som `lak-kard`, `lak-vc` och `logg`, för att validera själva sökresultaten (59 `Bundle` av typen `searchset`, också tomma).
3. `test/fhir-validering/validera.sh` kör validatorn med `-version 4.0.1 -ig hl7se.fhir.base#1.1.0 -ig <egna definitioner> -jurisdiction SE`. Patient, Organization och Practitioner valideras dessutom uttryckligen mot `SEBasePatient`, `SEBaseOrganization` och `SEBasePractitioner`. Resurser med `meta.profile` valideras också mot den profilen.
4. `test/fhir-validering/summera.py` räknar fel och varningar per resurstyp. Det avslutar med felkod 1 om något fel (`error` eller `fatal`) finns eller om en utdatafil saknas. Varningar ger ingen felkod.

```sh
docker run --rm --user $(id -u):$(id -g) -v "$PWD":/repo:ro -v "$UT":/ut -w /repo oven/bun:1.3.14-alpine bun test/fhir-validering/exportera.js /ut
VALIDATOR=<katalog med validator_cli.jar> test/fhir-validering/validera.sh "$UT"
python3 -I test/fhir-validering/summera.py "$UT"/ut-*.json
```

## Automatisk körning i GitHub Actions

Arbetsflödet `.github/workflows/test.yml` kör samma validering vid varje push och pull request, i jobbet FHIR-validering:

1. Resurserna exporteras med `exportera.js` i `oven/bun:1.3.14-alpine` (låst på digest), som i steg 1 ovan. HTTP-urvalet i steg 2 ingår inte.
2. `validator_cli.jar` 7.0.3 hämtas från HL7:s release på GitHub. Jobbet avbryts om sha256 inte är 57aa43fb40cec5de41def81c927725fd85908eeb71509b7f9313e04d9b8ec79b.
3. Jobbet kontrollerar att tx.fhir.org svarar innan valideringen startar, och efteråt att validatorn verkligen anslöt till servern i varje körning. Svarar servern inte blir jobbet rött med ett tydligt felmeddelande, aldrig grönt utan terminologikontroll.
4. `validera.sh` kör validatorn i `eclipse-temurin:21-jre` (Java 21, låst på digest genom `JAVABILD`). FHIR-paketen i `~/.fhir` cachas mellan körningarna, så att packages.fhir.org bara behövs när cachen saknas.
5. `summera.py` skriver sammanfattningen och fäller jobbet om något fel finns. Varningarna fäller inte jobbet. Sammanfattningen visas på körningens sida, och validatorns utdata och loggar laddas upp som artefakten `fhir-validering`, där varningarna går att läsa.

Jobbet Tester kör `bun scripts/kor-tester.js` med Bun 1.3.14. Alla externa actions är låsta på en fullständig commit-SHA. Valideringen körs inte i Docker-bygget av demon, som inte har Java.

## Resultat per resurstyp

Hela utskriften (alla resurser som går att nå):

| Resurstyp | Resurser | Fel | Varningar | Profil i meta.profile |
|---|---|---|---|---|
| Patient | 15 | 0 | 17 | SEBasePatient |
| Organization | 18 | 0 | 18 | SEBaseOrganization |
| Practitioner | 22 | 0 | 22 | SEBasePractitioner |
| Encounter | 43 | 0 | 43 | ingen |
| Condition | 43 | 0 | 86 | ingen |
| Observation | 136 | 0 | 144 | vitalparametrar: FHIR R4 bp, heartrate, resprate, bodytemp, bodyweight, bodyheight, oxygensat. Labb och PEF: ingen |
| MedicationRequest | 55 | 0 | 110 | ingen |
| AllergyIntolerance | 2 | 0 | 2 | ingen |
| ServiceRequest | 8 | 0 | 8 | ingen |
| Composition | 70 | 0 | 70 | ingen |
| AuditEvent | 486 | 0 | 972 | ingen |
| CapabilityStatement | 1 | 0 | 1 | |
| StructureDefinition, CodeSystem, ValueSet (egna) | 16 | 0 | 21 | |

Svar över HTTP: 59 Bundle med sammanlagt 250 poster, 0 fel och 271 varningar (samma slags varningar som ovan, för resurserna i Bundle).

### Vårdkontakt, vårdtillfälle och hälsoärende (2026-11-03)

Efter att vårdtillfällen (`Encounter` med id `vt-<nummer>`, `location` per plats och `partOf` från vårdkontakterna) och hälsoärenden (`EpisodeOfCare`) lades till, och `encounter` i `Observation`, `MedicationRequest` och `ServiceRequest`, kördes hela utskriften igen med samma validator, samma paket och samma skript (`exportera.js`, `validera.sh` och `summera.py`), med kontakt med tx.fhir.org. Resultat: 1 007 resurser och **inga fel**. Encounter 72 resurser (vårdkontakter och sju vårdtillfällen) med 0 fel och 72 varningar, EpisodeOfCare 1 resurs med 0 fel och 1 varning. Varningarna är desamma som i tabellen ovan (dom-6 för alla resurser). HTTP-urvalet i steg 2 kördes inte om.

Alla 19 mätvärdestyper fanns med bland Observation.

### Varningar

| Varning | Var | Bedömning |
|---|---|---|
| dom-6: resursen saknar narrativ (`text`) | alla resurstyper, en per resurs | Best practice. Resurserna har ingen genererad `text`. Kvar. |
| `A definition for CodeSystem 'urn:oid:1.2.752.116.1.1.1' could not be found` | Condition (43) | ICD-10-SE finns inte på HL7:s terminologiserver, så validatorn kan inte kontrollera koderna. De är kontrollerade mot Socialstyrelsens kodfil, se `docs/kodkontroll.md`. |
| `A definition for CodeSystem 'http://electronichealth.se/fhir/NamingSystem/nplid' could not be found` | MedicationRequest (55) | NPL-id är riktiga sedan 2026-11-01 och har E-hälsomyndighetens system ur deras FHIR-profiler för NLL. Terminologiservern har inte NPL, så validatorn kan inte kontrollera koderna. De är kontrollerade mot Läkemedelsverkets NPL, se `docs/lakemedelskontroll.md`. Kvar. |
| `None of the codings provided are in the value set 'PurposeOfUse'` | AuditEvent (486) | Bindningen är extensible. Åtkomstgrunderna (egen enhet, aktivt val, nödåtkomst och så vidare) är PDL-begrepp utan motsvarighet i v3-PurposeOfUse. Kvar. |
| `UCUM Codes that contain human readable annotations like {INR}` och `{1.73_m2}` | Observation (8) | Båda är giltig UCUM och den vanliga formen för INR och eGFR. Kvar. |
| `sekretessmarkering ... was not found in the value set 'SecurityLabels'` och `'R' was not found in ... 'SE ValueSet security labels'` | Patient med skyddad identitet (1) | Patienten har båda koderna: HL7 Swedens `sekretessmarkering` (som basprofilens extensible-bindning vill ha) och `R`, och varje kod ger en varning mot den andra värdemängden. Kvar med avsikt. |
| `multiple different potential matches for the url .../CodeSystem/...` | egna ValueSet (5) | Uppstår bara för att definitionerna både laddas med `-ig` och valideras som källor. |

### Kontroll av att valideringen biter

En kopia med avsiktliga fel validerades också: en puls utan UCUM-kod, ett labbvärde som påstår pulsprofilen, en Patient med två namn och en ordination med okänd NLL-status och fel ATC-benämning. Alla gav fel, bland annat `Patient.name: max allowed = 1, but found 2 (from SEBasePatient|1.1.0)`, `magic LOINC code 8867-4 required`, `The value provided ('okand_status') was not found in the value set 'NLL-status'` och `Wrong Display Name 'fel namn' for http://www.whocc.no/atc#B01AA03`. meta.profile, basprofilerna och de egna värdemängderna tillämpas alltså.

## Omvalidering 2026-11-01: riktiga NPL-id

Efter läkemedelskontrollen (`docs/lakemedelskontroll.md`) har `MedicationRequest` produktens riktiga NPL-id med systemet `http://electronichealth.se/fhir/NamingSystem/nplid` i stället för det påhittade id:t med Vårdkällans eget system, och `medicationCodeableConcept.text` har produktens namn, styrka och form som i NPL. Hela utskriften validerades igen med samma validator (7.0.3, sha256 kontrollerad vid nedladdningen), samma Java-container och samma paket. Resultat: **inga fel** för någon resurstyp, och samma antal resurser och varningar per resurstyp som i tabellen ovan. Varningen för NPL-id har det nya systemet. Svaren över HTTP (Bundle) validerades inte om, eftersom de innehåller samma resurser.

## Omvalidering 2026-11-03: alla resurstyper efter runda 4

Efter runda 4 kan API:t lämna ut fler resurstyper än `exportera.js` skrev ut: `MedicationAdministration` (administrering, överlämnande och dos som inte gavs), `List` (vidimeringen av pågående ordinationer), `Composition` med `attester` (kontrasignering), `Flag` (uppmärksamhetsinformation), `EpisodeOfCare` (hälsoärende), `Encounter` för vårdtillfälle (id `vt-<nummer>`) och tidbokens `Schedule`, `Slot` och `Appointment`. Skriptet skriver nu ut alla, också invånarens resurser i Min journal (`$everything` och bokningarna för varje journal som invånaren får läsa), som har färre uppgifter än personalens och därför valideras för sig. Den enda begäran om kontrasignering i demon görs av mottagaren i skriptet, med samma funktion som gränssnittet, så att `attester` kommer med.

Valideringen kördes som i avsnittet ovan: validatorn 7.0.3 med sha256 kontrollerad efter nedladdningen, i `eclipse-temurin:21-jre` låst på digest (Java 21.0.13, inte Java på värden), samma paket, `validera.sh` och `summera.py`, och validatorn anslöt till tx.fhir.org i alla fyra körningarna. Resultat: 4 082 resurser och **inga fel**. Ingen resurs behövde rättas.

| Resurstyp | Resurser (varav invånarens) | Fel | Varningar | Varningar utöver dom-6 |
|---|---|---|---|---|
| Patient | 35 (15) | 0 | 39 | sekretessmarkeringen (2 + 2) |
| Organization | 19 | 0 | 19 | |
| Practitioner | 28 | 0 | 28 | |
| Encounter, vårdkontakter och 9 vårdtillfällen | 166 (73) | 0 | 166 | |
| EpisodeOfCare | 1 | 0 | 1 | |
| Condition | 96 (45) | 0 | 192 | ICD-10-SE saknas på terminologiservern (96) |
| Observation | 284 (134) | 0 | 299 | UCUM-annotering `{INR}` och `{1.73_m2}` (15) |
| MedicationRequest | 117 (55) | 0 | 234 | NPL-id saknas på terminologiservern (117) |
| MedicationAdministration | 30 | 0 | 60 | NPL-id saknas på terminologiservern (30) |
| List (vidimering) | 1 | 0 | 1 | |
| AllergyIntolerance | 4 (2) | 0 | 4 | |
| Flag | 6 (3) | 0 | 8 | ICD-10-SE saknas på terminologiservern (2) |
| ServiceRequest | 17 (8) | 0 | 17 | |
| Composition, varav 2 med attester | 155 (68) | 0 | 155 | |
| Schedule | 5 | 0 | 5 | |
| Slot | 2 083 | 0 | 2 083 | |
| Appointment | 16 (8) | 0 | 16 | |
| AuditEvent | 1 000 | 0 | 2 000 | PurposeOfUse (1 000) |
| CapabilityStatement | 1 | 0 | 1 | |
| StructureDefinition, CodeSystem, ValueSet (egna) | 18 | 0 | 24 | flera möjliga träffar för egna kodsystem (6) |

Varningarna som finns kvar är samma slag som i tabellen [Varningar](#varningar): dom-6 (ingen narrativ `text`) för varje resurs, ICD-10-SE och NPL som terminologiservern inte har, PurposeOfUse för åtkomstgrunderna, UCUM-annoteringarna och sekretessmarkeringen för patienten med skyddad identitet. De nya resurstyperna gav inga andra varningar än dom-6, utom NPL-id i `MedicationAdministration` och ICD-10-SE i `Flag`.

En kopia med avsiktliga fel i de nya resurstyperna gav fel för varje ändring: `Slot.status` `ledig`, `Appointment` utan `participant`, `MedicationAdministration` utan `status`, `List.mode` `bild`, `Composition.attester.mode` `kontrasignerad`, `Schedule` utan `actor`, `Flag.status` `aktiv`, `EpisodeOfCare.status` `pagar` och ett vårdtillfälle med `Encounter.status` `inskriven`.

## Omvalidering 2026-11-03: runda 6 (Observation, Procedure, MedicationAdministration och List)

Efter runda 6 har `Observation` fler slag: eGFR med LOINC 98979-8, medvetandegrad som `valueCodeableConcept` med LOINC:s svarskoder, GCS med tre komponenter, smärta med NRS, syrgas och NEWS2 som härledd Observation (`news2-<id>`, `derivedFrom` till sju mätvärden). `Procedure` är ny, med KVÅ. `exportera.js` skriver ut dem och avslutar med felkod om Procedure, NEWS2, GCS, medvetandegrad eller eGFR saknas i utskriften, och `validera.sh` tar med Procedure.

Valideringen kördes lokalt med validatorn 7.0.3 (sha256 57aa43fb40cec5de41def81c927725fd85908eeb71509b7f9313e04d9b8ec79b, samma som HL7:s release), i `eclipse-temurin:21-jre`, med samma paket och `-ig hl7se.fhir.base#1.1.0`, mot ett urval av utskriften: alla Observation, Procedure, MedicationAdministration och List, CapabilityStatement och de egna definitionerna. Validatorn anslöt till tx.fhir.org. Resultat: 394 resurser och **inga fel**.

| Resurstyp | Resurser (personal och invånare) | Fel | Varningar | Varningar utöver dom-6 |
|---|---|---|---|---|
| Observation | 334 | 0 | 378 | UCUM-annoteringarna `{score}`, `{INR}` och `{1.73_m2}` (34), NEWS2 utan `performer` (5) och utan kod i `interpretation` (5) |
| Procedure | 7 | 0 | 14 | KVÅ:s OID finns inte på terminologiservern (7) |
| MedicationAdministration | 29 | 0 | 58 | NPL-id finns inte på terminologiservern (29) |
| List | 1 | 0 | 1 | |
| CapabilityStatement | 1 | 0 | 1 | |
| StructureDefinition, CodeSystem, ValueSet (egna) | 22 | 0 | 29 | flera möjliga träffar för egna kodsystem (7) |

NEWS2 är räknad av systemet och har därför ingen `performer`, och risken står som text i `interpretation`, eftersom HL7:s tolkningskoder (till exempel hög och låg) inte beskriver NEWS2:s risknivåer. Valideringen av hela utskriften i GitHub Actions omfattar också de nya resurserna från och med nästa körning.

## Omvalidering 2026-11-03: runda 6, r5 (skrivning, prenumerationer och SMART on FHIR)

Skrivning via FHIR, prenumerationer och SMART on FHIR lade till nya resurser och tillägg: `Subscription` med tillägget `backport-payload-content` (`id-only`) ur FHIR Subscriptions R5 Backport för R4, meddelandet som en `Bundle` av typen `history` med en `Parameters`, `OperationOutcome` från skrivningen (med svensk text, felkod, FHIRPath och en rad per varning), `CapabilityStatement` med `create`, `update`, Subscription och SMART:s OAuth-adresser, och Vårdkällans nya definitioner: det sammansatta tillägget `kvitterad-varning` (delarna `regel` och `motivering`), tillägget `rattelseorsak` och kodsystemet `varningsregel` (`content: not-present`, eftersom varningsreglerna är demoregler). `exportera.js` skriver ut en prenumeration, ett meddelande, tre OperationOutcome och tre resurser som en klient skickar in (en ordination med kvitterad varning, en rättelse med orsak och ett blodtryck), och `validera.sh` validerar dem i en egen körning med `-ig hl7.fhir.uv.subscriptions-backport.r4#1.1.0`.

Valideringen kördes lokalt med validatorn 7.0.3 (sha256 57aa43fb40cec5de41def81c927725fd85908eeb71509b7f9313e04d9b8ec79b) i `eclipse-temurin:21-jre`, med `-ig hl7se.fhir.base#1.1.0`, de egna definitionerna och Backport-paketet 1.1.0, mot ett urval: de egna definitionerna, CapabilityStatement och de nya resurserna. Validatorn anslöt till tx.fhir.org. Resultat: 34 resurser och **inga fel**.

| Resurstyp | Resurser | Fel | Varningar | Varningar utöver dom-6 |
|---|---|---|---|---|
| Subscription | 1 | 0 | 1 | |
| Bundle (meddelande, history) | 1 | 0 | 0 | |
| OperationOutcome | 3 | 0 | 5 | validatorn kan inte kontrollera koderna i kodsystemet `varningsregel`, som inte räknar upp dem (2) |
| Klientens resurser (MedicationRequest, Composition, Observation) | 3 | 0 | 5 | NPL-id saknas på terminologiservern (1), Observation utan `performer` (1) |
| CapabilityStatement | 1 | 0 | 1 | |
| StructureDefinition, CodeSystem, ValueSet (egna) | 25 | 0 | 32 | flera möjliga träffar för egna kodsystem (7) |

En kopia med avsiktliga fel gav fel för varje ändring: en kvitterad varning utan `motivering` (`Slice 'Extension.extension:motivering': a matching slice is required`), `backport-payload-content` med värdet `allt` och `Subscription.status` `aktiv`.

## Före rättningarna

Samma validering av svaren från koden före ändringarna (HTTP-urvalet: 252 unika resurser och 59 Bundle):

| Resurstyp | Fel före | Huvudsakliga fel |
|---|---|---|
| Observation | 258 | `display` på svenska för LOINC ("Puls", "Blodtryck"), UCUM saknades (`valueQuantity.system` och `code`) som vitalparameterprofilerna kräver, 2708-6 saknades för syremättnad |
| MedicationRequest | 92 | tilläggen `uppfoljningsdatum`, `nll-status` och `utsattningsorsak` var inte definierade, svensk substans som ATC-`display` |
| Condition | 24 | `http://hl7.org/fhir/sid/icd-10-se` är ingen känd adress |
| Composition | 28 | tom lista i `relatesTo` |
| ServiceRequest | 12 | tilläggen `remisstatus` och `svar-senast` var inte definierade |
| AuditEvent | 3 | tillägget `hash` var inte definierat |
| AllergyIntolerance | 2 | tom `coding`, svensk ATC-`display` för J01C |
| Bundle | 426 | samma fel i resurserna, och tom `entry` för sökningar utan träff |
| Patient, Organization, Practitioner, Encounter | 0 | |

## Rättningar i fhir.js

- `display` i varje coding är kodverkets benämning (LOINC, ATC, ICD-10-SE). Den svenska texten står i `code.text`.
- ICD-10-SE har systemet `urn:oid:1.2.752.116.1.1.1`, Socialstyrelsens OID.
- Observation: NPU för labb, LOINC för vitalparametrar och PEF, UCUM för alla värden, `meta.profile` med FHIR R4:s vitalparameterprofil för vitalparametrar.
- Egna tillägg, kodsystem och värdemängder är definierade och publiceras på `/fhir/StructureDefinition`, `/fhir/CodeSystem` och `/fhir/ValueSet` (utan inloggning). Tilläggen `nll-status` och `remisstatus` har obligatorisk bindning till sina värdemängder.
- Inga tomma listor: `relatesTo`, `coding`, `note`, `entity` och `Bundle.entry` utelämnas när de är tomma.
- Patient, Organization och Practitioner anger HL7 Swedens basprofiler. HSA-id har `type` `PRN`. Skyddad identitet har `sekretessmarkering`.

## Det som inte är validerat

- Validatorn körs i GitHub Actions vid varje push och pull request, men inte i Docker-bygget av demon, eftersom den kräver Java. I bygget kontrollerar testerna i `app/test/fhir-struktur.test.js` de viktigaste strukturkraven utan Java, och `app/test/kodverk.test.js` kontrollerar koderna mot de kontrollerade tabellerna.
- Den automatiska körningen validerar utskriften från `exportera.js`, inte sökresultaten över HTTP.
- ICD-10-SE-, NPU- och NPL-koder kontrolleras inte av validatorn (terminologiservern saknar dem).
- Omvalideringarna 2026-11-01 och 2026-11-03 gällde bara utskriften av alla resurser. Svaren över HTTP (Bundle) validerades inte om.
- Åtkomstloggen skrivs ut med de 1 000 senaste raderna, som är gränsen för en sökning.
- Sökningarna över HTTP och svaren på skrivande anrop valideras inte i GitHub Actions, utom de exempel som `exportera.js` skriver ut (se Omvalidering 2026-11-03: runda 6, r5). Svaren på skrivningar är samma mappning som läsningen.
- Ingen nationell profil utöver basprofilerna (till exempel för läkemedel eller remiss) är validerad, eftersom HL7 Sweden inte publicerar sådana i `hl7se.fhir.base`.
