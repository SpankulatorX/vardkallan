# FHIR-validering

Validering av Vårdkällans FHIR-svar mot FHIR R4 och HL7 Swedens basprofiler, gjord 2026-10-31 och för utskriften av alla resurser upprepad 2026-11-01 efter läkemedelskontrollen. Resultat: **inga fel** för någon resurstyp. Varningarna listas nedan.

Identiteterna (Sussa 3.1.1) validerades 2026-11-03 med samma validator och paket: alla 19 `Patient` mot `SEBasePatient`, däribland samordningsnummer med HL7 Swedens system, reservnummer och utländsk identitet med `urn:oid:` och en tidigare identitet med `use: old`, och dessutom två sammanslagna journaler med `Patient.link` (`replaces` och `replaced-by`, den gamla med `active: false`). Resultat: 0 fel och 23 varningar, samma slags varningar som i tabellen nedan (dom-6 och sekretessmarkeringen).

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

1. Alla resurser som demorollerna når, för alla 15 patienter och med alla aktiva val (andra vårdenheter, nödåtkomst, samtycke), skrevs ut med `test/fhir-validering/exportera.js`. Organization, Practitioner, AuditEvent, CapabilityStatement och de egna definitionerna kom med.
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

## Före rättningarna

Samma validering av svaren från koden före ändringarna (HTTP-urvalet: 252 unika resurser och 59 Bundle):

| Resurstyp | Fel före | Huvudsakliga fel |
|---|---|---|
| Observation | 258 | `display` på svenska för LOINC ("Puls", "Blodtryck"), UCUM saknades (`valueQuantity.system` och `code`) som vitalparameterprofilerna kräver, 2708-6 saknades för saturation |
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
- Omvalideringen 2026-11-01 (se nedan) gällde bara utskriften av alla resurser. Svaren över HTTP (Bundle) validerades inte om.
- Bara läsning och sökning med de parametrar som API:t har. Inga skrivande FHIR-anrop finns.
- Ingen nationell profil utöver basprofilerna (till exempel för läkemedel eller remiss) är validerad, eftersom HL7 Sweden inte publicerar sådana i `hl7se.fhir.base`.
