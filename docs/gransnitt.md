# Gränssnitt för informationsutbyte

Den här beskrivningen samlar Vårdkällans gränssnitt för informationsutbyte med andra system och processen för hur en beställare själv utvecklar och förvaltar dem (Sussa 3.6.1.3). Den skrivs ur registret i `app/src/gransnitt-utbyte.js` med `bun scripts/dokument-md.js`, och ett test i bygget stoppar bygget om koden har ett gränssnitt som inte står här.

## Översikt

| Gränssnitt | Standard | Riktning |
| --- | --- | --- |
| [FHIR R4 för läsning och skrivning](#fhir-r4-för-läsning-och-skrivning) | HL7 FHIR R4 (4.0.1), JSON, med HL7 Swedens basprofiler för patient, organisation och personal | Externa tillämpningar och system anropar Vårdkällan |
| [SMART on FHIR och OAuth 2.0](#smart-on-fhir-och-oauth-20) | SMART App Launch (EHR launch och standalone launch) med OAuth 2.0, kod med PKCE (S256) | En extern tillämpning startas från journalen eller för sig och anropar FHIR-API:t med en åtkomstbiljett |
| [Systemkonton med SMART Backend Services](#systemkonton-med-smart-backend-services) | SMART Backend Services: OAuth 2.0 client_credentials med private_key_jwt | Ett system utan inloggad person, till exempel ett regionalt vårddatalager, hämtar från Vårdkällan |
| [Prenumerationer och webbhookar](#prenumerationer-och-webbhookar) | FHIR R4 Subscription med rest-hook | Vårdkällan skickar ett meddelande till en godkänd mottagare när något är nytt, ändrat eller borttaget |
| [Datauttag för uppföljning](#datauttag-för-uppföljning) | NDJSON med ett manifest i samma form som FHIR Bulk Data Access | Uppföljningens system hämtar från Vårdkällan |
| [Nationella tjänstekontrakt i bilaga K10](#nationella-tjänstekontrakt-i-bilaga-k10) | RIV-TA-liknande JSON med kontraktens huvud och kropp | Nationella tjänster anropar Vårdkällan som producent; konsumentrollerna är lokala funktioner |
| [RIVTA-kontrakt mot tjänsteplattformen](#rivta-kontrakt-mot-tjänsteplattformen) | RIVTA (SOAP och tjänstekontraktens scheman) | Vårdkällan som producent och konsument mot tjänsteplattformen |
| [Intyg, e-remiss och processkontrakt](#intyg-e-remiss-och-processkontrakt) | RIVTA-kontrakt för intyg, remiss, vaccination, läkemedel och register | Vårdkällan mot Intygstjänsten, Webcert och andra nationella tjänster |
| [Medicinteknisk utrustning](#medicinteknisk-utrustning) | FHIR R4 och HL7 v2.6 ORU^R01 (IHE PCD-01) | Utrustningen skickar till Vårdkällan med utrustningens nyckel, utan session |
| [Producentsystem för beställning och svar](#producentsystem-för-beställning-och-svar) | HL7 FHIR R4: Bundle, ServiceRequest, Specimen, Task, DiagnosticReport och ActivityDefinition | Laboratoriets system hämtar beställningar och skickar status, svar och katalog till Vårdkällan |
| [Bilder med DICOMweb](#bilder-med-dicomweb) | DICOMweb (QIDO-RS och WADO-RS) | Bildvisaren och andra system hämtar studier, serier och instanser från Vårdkällan |
| [Export till e-arkiv och återföring](#export-till-e-arkiv-och-återföring) | Riksarkivets FGS Paketstruktur 2.0 (E-ARK CSIP och SIP 2.1.0) med journalen i HL7 FHIR R4 | Vårdkällan levererar paket till e-arkivet och får en signerad kvittens |
| [Överföring till mellanarkiv och åtkomst från journalen](#överföring-till-mellanarkiv-och-åtkomst-från-journalen) | Riksarkivets FGS Paketstruktur 2.0 som exporten till e-arkivet, med journalhandlingarna i HL7 FHIR R4 | Vårdkällan för över paket till mellanarkivet, och journalen läser handlingarna därifrån |
| [Utskrift och utlämnande](#utskrift-och-utlämnande) | Utskriftsvänlig sida som webbläsaren skriver ut eller sparar som PDF | Vårdkällan lämnar ut en journalkopia på papper eller som fil |
| [Rapportering till myndigheter och kvalitetsregister](#rapportering-till-myndigheter-och-kvalitetsregister) | Mottagarnas egna filformat, sammanställda ur journalen | Vårdkällan skickar till myndigheter och register |
| [Masterdata](#masterdata) | Utbytbara adaptrar med ett gemensamt kontrakt för varje källa | Vårdkällan hämtar organisation, personal, befolkning, läkemedel och kodverk från sina källor |
| [Inloggning med biljett och flerfaktor](#inloggning-med-biljett-och-flerfaktor) | OpenID Connect: id-biljett som JWT signerad med ES256, JWKS och Discovery; WebAuthn och RFC 6238 för den andra faktorn | En autentiseringstjänst utfärdar biljetten och Vårdkällan kontrollerar den |
| [Inloggningstjänstens biljett](#inloggningstjänstens-biljett) | OpenID Connect med authorization code och PKCE (S256), id-biljett med asymmetrisk signatur och pinnade nycklar (RFC 7638) | Vårdkällan är förlitande part: användaren skickas till vårdgivarens inloggningstjänst och kommer tillbaka med en kod som Vårdkällan löser in mot en biljett |
| [Signerade meddelanden och certifikat](#signerade-meddelanden-och-certifikat) | ECDSA P-256 med SHA-256 över ett meddelandehuvud, med certifikatkedja och signerad kvittens | Vårdkällan och andra organisationer signerar och kvitterar meddelanden till varandra |
| [Kalenderprenumeration och inbjudningar](#kalenderprenumeration-och-inbjudningar) | iCalendar (RFC 5545) | Personalens kalenderprogram hämtar från Vårdkällan |
| [Läskopian vid avbrott](#läskopian-vid-avbrott) | JSON, krypterad i webbläsaren med AES-GCM | Vårdkällans webbgränssnitt hämtar en läskopia och skickar loggen från läsläget |

## Process för egen utveckling och förvaltning

1. **Läs den maskinläsbara beskrivningen.** Varje gränssnitt beskriver sig självt där det går: CapabilityStatement på /fhir/metadata, SMART-konfigurationen för FHIR-API:t, autentiseringstjänstens konfiguration och nycklar enligt OpenID Connect (adresserna står vid gränssnitten nedan), formaten för medicinteknik på /mt/format och tabellerna i datauttaget på /api/datauttag/schema. Informationsmodellen finns på /api/informationsmodell och i docs/informationsmodell.md.
2. **Anslut ett system.** Systemförvaltaren registrerar externa tillämpningar, systemkonton och mottagare för prenumerationer på sidan Öppet API och ansluter laboratorier på sidan för producentsystem. Systemet räknar fram omfång och behörigheter ur valen och visar nycklar en gång.
3. **Ändra eller lägg till ett gränssnitt.** Källkoden är öppen under EUPL 1.2. Varje gränssnitt nedan anger filerna det bygger på. Skriv testet först i app/test, och använd samma funktioner och samma behörighetsmotor som gränssnittet, så att behörighet och loggning blir desamma. All kontroll görs på servern.
4. **Versionera.** Versionen står i app/package.json och i CapabilityStatement. Varje ändring i API:t får en rad i ändringsloggen (app/src/api-andringar.js) under versionen, och sidan Öppet API visar ändringsloggen. Bygget stoppas om ändringsloggen och servern inte stämmer.
5. **Pröva.** Servertesterna körs med bun scripts/kor-tester.js och i varje bygge, och bygget stoppas om ett test är rött. FHIR-resurserna valideras med HL7:s validator (docs/fhir-validering.md), exportpaketet med E-ARK:s validator (docs/earkiv-validering.md) och RIVTA-kontrakten mot sina scheman (docs/rivta.md). Avvikelser från standarderna skrivs i docs/api-avvikelser.md.
6. **Dokumentera.** Lägg gränssnittet i registret app/src/gransnitt-utbyte.js och skriv om det här dokumentet med bun scripts/dokument-md.js. Ett test stoppar bygget om koden har ett gränssnitt mot andra system som inte står i registret, eller om dokumentet inte är skrivet ur registret.
7. **Förvalta.** Personal och utvecklare lämnar ärenden om information som saknas i API:t på sidan Öppet API, och systemförvaltaren svarar och följer upp dem där. Täckningen visar vilka vanliga flöden som går att göra genom API:t. Uppgraderingar godkänns av två systemförvaltare och kan backas.

## FHIR R4 för läsning och skrivning

Journalens information som FHIR-resurser. CapabilityStatement på /fhir/metadata anger versionen, resurserna, sökparametrarna och vad som går att skriva, och profilerna och operationerna kan läsas utan inloggning. Resurstyperna i dag: Patient, Encounter, EpisodeOfCare, Condition, Observation, MedicationRequest, AllergyIntolerance, Flag, ServiceRequest, Composition, Organization, Practitioner, AuditEvent, MedicationAdministration, List, CarePlan, Immunization, Schedule, Slot, Appointment, Procedure, ChargeItem, Questionnaire, QuestionnaireResponse, DiagnosticReport, Specimen, Media, ImagingStudy, StructureDefinition, CodeSystem, ValueSet, Subscription. Skrivning görs med samma funktioner som gränssnittet, så samma kontroller gäller. Fel svaras med OperationOutcome på svenska. Sidan Öppet API visar täckningen: vilka vanliga flöden som går att göra genom API:t.

Standard: HL7 FHIR R4 (4.0.1), JSON, med HL7 Swedens basprofiler för patient, organisation och personal.

Riktning: Externa tillämpningar och system anropar Vårdkällan.

Adresser: `/fhir/metadata`, `/fhir/Composition`, `/fhir/Observation`, `/fhir/MedicationRequest`.

Behörighet och loggning: Samma behörighetsmotor som gränssnittet: yrkesroll, vårdrelation, inre sekretess, spärr och skyddad identitet. Varje läsning och skrivning loggas på patienten.

Koden: `app/src/fhir.js`, `app/src/fhir-skrivning.js`, `app/src/fhir-definitioner.js`, `app/src/oppet-api.js`, `app/src/api-tackning.js`.

Dokumentation: `docs/fhir-validering.md`, `docs/api-avvikelser.md`, `docs/informationsmodell.md`.

## SMART on FHIR och OAuth 2.0

Tillämpningarna registreras av systemförvaltaren på sidan Öppet API med de omfång och adresser som de får använda. En biljett gäller den inloggade personen, begränsas av omfånget och ger aldrig mer än personen själv får. Den går ut efter 30 minuter och återkallas vid utloggning och när tillämpningen stängs. Demon har en registrerad tillämpning på samma server.

Standard: SMART App Launch (EHR launch och standalone launch) med OAuth 2.0, kod med PKCE (S256).

Riktning: En extern tillämpning startas från journalen eller för sig och anropar FHIR-API:t med en åtkomstbiljett.

Adresser: `/fhir/.well-known/smart-configuration`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`, `/tillampningar/`.

Behörighet och loggning: Varje anrop prövas och loggas som om personen gjorde det, utan aktiva val, nödåtkomst eller samtycke. Utfärdande, återkallelse och utgång loggas.

Koden: `app/src/smart.js`, `app/src/oppet-api.js`, `app/src/api-forvaltning.js`.

## Systemkonton med SMART Backend Services

Systemförvaltaren registrerar systemets offentliga nyckel och väljer informationsmängder och vårdenheter. Systemet räknar fram omfånget och skriver på vanlig svenska vad kontot får. Kontot byter ett klientintyg som det har signerat mot en åtkomstbiljett och läser sedan FHIR-API:t och prenumererar på nya poster.

Standard: SMART Backend Services: OAuth 2.0 client_credentials med private_key_jwt.

Riktning: Ett system utan inloggad person, till exempel ett regionalt vårddatalager, hämtar från Vårdkällan.

Adresser: `/oauth/token`, `/api/oppet-api/systemkonton`.

Behörighet och loggning: Kontot läser bara poster som har registrerats på dess vårdenheter och i dess informationsmängder, och kontot slås upp vid varje prövning så att en återkallelse gäller direkt. Varje läsning loggas.

Koden: `app/src/systemkonton.js`, `app/src/oppet-api.js`.

## Prenumerationer och webbhookar

Meddelandet innehåller bara id: prenumerationen, händelsens nummer och resursens adress, inga patientuppgifter. Mottagaren hämtar resursen med sin egen behörighet. Mottagaradressen ska vara godkänd av systemförvaltaren och vara https på port 443, namnet slås upp en gång och får inte peka på en intern adress, och omdirigeringar följs aldrig.

Standard: FHIR R4 Subscription med rest-hook.

Riktning: Vårdkällan skickar ett meddelande till en godkänd mottagare när något är nytt, ändrat eller borttaget.

Adresser: `/fhir/Subscription`, `/api/oppet-api/mottagare`.

Behörighet och loggning: Den som skapar prenumerationen måste få söka resurstypen, och före varje meddelande prövas att personen eller systemkontot fortfarande får läsa just den resursen. Det som inte får läsas ger inget meddelande.

Simulerat: I demon sparas meddelandena men skickas inte, om inte driften har slagit på utskick till de godkända mottagarna.

Koden: `app/src/prenumeration.js`, `app/src/oppet-api.js`.

## Datauttag för uppföljning

Fyra tabeller: vårdkontakter, diagnoser, ordinationer och remisser, pseudonymiserade och utan fritext. Uttaget byggs om varje natt och kan läsas inkrementellt med stabila radnycklar. Schemat för tabellerna finns på /api/datauttag/schema.

Standard: NDJSON med ett manifest i samma form som FHIR Bulk Data Access.

Riktning: Uppföljningens system hämtar från Vårdkällan.

Adresser: `/api/datauttag`, `/api/datauttag/schema`, `/api/datauttag/:typ`.

Behörighet och loggning: Bara rollen uppföljning. Varje uttag loggas utan patient. Spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade rader står i manifestet.

Koden: `app/src/datauttag.js`, `app/src/utdata-rutter.js`.

## Nationella tjänstekontrakt i bilaga K10

Tabellen över de 80 tjänstekontrakten i bilaga K10 visar för varje kontrakt vad bilagan anger och hur Vårdkällan svarar mot det. En simulerad producent finns för GetCareDocumentation, GetDiagnosis, GetAlertInformation, GetCareContacts, GetObservations, GetActivities. Producenten läser genom FHIR-API:t, så behörighet och loggning är desamma.

Standard: RIV-TA-liknande JSON med kontraktens huvud och kropp.

Riktning: Nationella tjänster anropar Vårdkällan som producent; konsumentrollerna är lokala funktioner.

Adresser: `/api/riv/:kontrakt`, `/api/tjanstekontrakt`.

Behörighet och loggning: Samma som FHIR-API:t. Varje anrop loggas med kontraktets namn i loggens resurs.

Simulerat: JSON i stället för SOAP och utan tjänsteplattformen. Inte anslutet till den nationella tjänsteplattformen.

Koden: `app/src/tjanstekontrakt.js`, `app/src/rapportering-rutter.js`.

## RIVTA-kontrakt mot tjänsteplattformen

Den gemensamma grunden för RIVTA och kontrakten för journalen, NPÖ, sammanhållen journalföring, spärr, samtycke, HSA och PU-tjänsten beskrivs i docs/rivta.md, med scheman, versioner och hur kontrakten valideras och prövas mot tjänsteplattformen.

Standard: RIVTA (SOAP och tjänstekontraktens scheman).

Riktning: Vårdkällan som producent och konsument mot tjänsteplattformen.

Behörighet och loggning: Se docs/rivta.md och docs/sakerhetsarkitektur.md.

Koden: `app/src/rivta/`.

Dokumentation: `docs/rivta.md`.

## Intyg, e-remiss och processkontrakt

Intyg och processkontrakten byggs på den gemensamma RIVTA-grunden och beskrivs i docs/rivta.md: Intygstjänsten och Webcert, e-remiss, vaccination, Infektionsverktyget, kvalitetsregister, formulärtjänsten, e-recept och dos.

Standard: RIVTA-kontrakt för intyg, remiss, vaccination, läkemedel och register.

Riktning: Vårdkällan mot Intygstjänsten, Webcert och andra nationella tjänster.

Behörighet och loggning: Se docs/rivta.md och docs/sakerhetsarkitektur.md.

Simulerat: Intygsapplikationen är simulerad och är inte Webcert, och mottagarna av e-remisser och de nationella tjänsterna är simulerade. Inget är anslutet till den nationella tjänsteplattformen.

Koden: `app/src/lakarintyg.js`, `app/src/intygsapplikation-simulerad.js`, `app/src/eremiss.js`, `app/src/eremiss-simulerad.js`, `app/src/r14r3-rutter.js`, `app/src/rivta-r3.js`, `app/src/rivta-vaccination.js`, `app/src/rivta-etjanster.js`, `app/src/rivta-etjanster-simulerade.js`, `app/src/rivta-dos.js`, `app/src/rivta-dos-simulerad.js`, `app/src/rivta-infektion.js`, `app/src/rivta-infektion-simulerad.js`.

Dokumentation: `docs/rivta.md`.

## Medicinteknisk utrustning

En Bundle av typen collection eller transaction med en Device (identifier med utrustningens nummer) och Observation för mätvärden eller MedicationAdministration för pumpens rapporter. Observation har status final eller preliminary, code med LOINC eller MDC, valueQuantity med UCUM-enhet (blodtryck som component med systoliskt och diastoliskt), effectiveDateTime och device som pekar på Device. subject får anges och måste då vara den kopplade patienten. MedicationAdministration har status in-progress, completed eller stopped, request till ordinationen, effectivePeriod och dosage.rateQuantity i mL/h och dosage.dose i mL. En bolus har kategorin bolus. Segmenten MSH, PID (valfritt), OBR och OBX med värdetypen NM, kod med MDC eller LOINC i OBX-3, enhet med MDC eller UCUM i OBX-6, status F eller R i OBX-11, tid i OBX-14 och utrustningens nummer i OBX-18. Blodtryck skickas som två OBX med systoliskt och diastoliskt. Svaret är ett ACK med MSA AA, AE eller AR och förklaringen i MSA-3. Formaten, koderna och enheterna finns som JSON på /mt/format. Ett meddelande i fel format, med okänd kod, fel enhet, orimligt värde eller fel tid nekas med en förklaring på svenska och sparas med orsaken. Värdena klassas som referens tills en läkare eller sjuksköterska har godkänt dem.

Standard: FHIR R4 och HL7 v2.6 ORU^R01 (IHE PCD-01).

Riktning: Utrustningen skickar till Vårdkällan med utrustningens nyckel, utan session.

Adresser: `/mt/fhir`, `/mt/hl7v2`, `/mt/format`, `/api/mt/utrustning`.

Behörighet och loggning: Utrustningen identifieras med en nyckel som visas en gång. Värden tas bara emot under en gällande koppling till patienten, och varje koppling loggas.

Simulerat: Utrustningen och dess nycklar är simulerade i demon.

Koden: `app/src/medicinteknik.js`, `app/src/medicinteknik-rutter.js`, `app/src/mt-klass.js`.

## Producentsystem för beställning och svar

Fyra flöden: beställning ut (GET /ps/bestallningar), status in (POST /ps/Task), svar in (POST /ps/DiagnosticReport), katalog in (PUT /ps/katalog). Ett meddelande som inte går att ta emot får svar i en OperationOutcome på svenska, och inget sparas förrän hela meddelandet är kontrollerat. Systemförvaltaren ansluter ett laboratorium på sidan för producentsystem och får nyckeln en gång.

Standard: HL7 FHIR R4: Bundle, ServiceRequest, Specimen, Task, DiagnosticReport och ActivityDefinition.

Riktning: Laboratoriets system hämtar beställningar och skickar status, svar och katalog till Vårdkällan.

Adresser: `/ps/bestallningar`, `/ps/Task`, `/ps/DiagnosticReport`, `/ps/katalog`, `/api/produktionssystem`.

Behörighet och loggning: Laboratoriet identifieras med sin nyckel, som sparas som HMAC. Varje svar som rör en patient loggas.

Simulerat: Laboratoriernas producentsystem är simulerade, men går genom samma gränssnitt och kontroller som ett riktigt.

Koden: `app/src/produktionssystem.js`, `app/src/labb-fhir.js`.

## Bilder med DICOMweb

Studier, serier och instanser med metadata, visningsbilder och miniatyrer, mot bildarkivet i demon.

Standard: DICOMweb (QIDO-RS och WADO-RS).

Riktning: Bildvisaren och andra system hämtar studier, serier och instanser från Vårdkällan.

Adresser: `/api/dicomweb/studies`.

Behörighet och loggning: Samma behörighet som journalen, prövad på bildens patient, och varje hämtning loggas.

Simulerat: Bildarkivet är simulerat i demon.

Koden: `app/src/bildmedia.js`, `app/src/r11r5-rutter.js`.

## Export till e-arkiv och återföring

Arkivarien registrerar ett beslut, och systemet bygger paketet med METS, PREMIS, SHA-256 för varje fil och mappningen mot e-arkivets dataelement. Paketet med alla journaler är återföringen av all data när avtalet upphör. Paketet är prövat med E-ARK:s validator.

Standard: Riksarkivets FGS Paketstruktur 2.0 (E-ARK CSIP och SIP 2.1.0) med journalen i HL7 FHIR R4.

Riktning: Vårdkällan levererar paket till e-arkivet och får en signerad kvittens.

Adresser: `/api/arkiv/beslut/:id/paket`, `/api/arkiv/beslut/:id/leverera`, `/api/arkiv/leverans/:id/kontroll`.

Behörighet och loggning: Bara arkivarien, med ett registrerat beslut. Varje journal i paketet loggas som utlämnad till e-arkivet.

Simulerat: E-arkivet är simulerat i demon, och paketet är inte prövat mot en verklig leveransöverenskommelse.

Koden: `app/src/arkiv.js`, `app/src/earkiv.js`, `app/src/zip.js`, `app/src/earkiv-scheman`.

Dokumentation: `docs/earkiv-validering.md`.

## Överföring till mellanarkiv och åtkomst från journalen

Arkivarien registrerar ett beslut om överföring, och systemet tar fram de äldre handlingarna, bygger ett paket per journal och låter mellanarkivet göra samma mottagningskontroll som e-arkivet innan något förs över. Anteckningarnas kategori och mätvärdenas typ följer med som taggar i FHIR-resurserna. Journalen visar handlingarna bland de andra, och varje handling kontrolleras mot sin SHA-256 när den läses.

Standard: Riksarkivets FGS Paketstruktur 2.0 som exporten till e-arkivet, med journalhandlingarna i HL7 FHIR R4.

Riktning: Vårdkällan för över paket till mellanarkivet, och journalen läser handlingarna därifrån.

Adresser: `/api/arkiv/beslut/:id/overfor`, `/api/patient/:id/mellanarkiv`, `/api/mellanarkiv/:id`.

Behörighet och loggning: Överföringen bara av arkivarien med ett registrerat beslut. Läsningen med samma behörighet som journalen, prövad på vårdenheten där handlingen skrevs, och varje läsning loggas.

Simulerat: Mellanarkivet är lokalt och simulerat i demon.

Koden: `app/src/mellanarkiv.js`, `app/src/mellanarkiv-rutter.js`, `app/src/arkiv.js`, `app/src/earkiv.js`.

## Utskrift och utlämnande

Systemet väljer syfte och delar ur sammanhanget. Varje utskrift sparas med id, delar, versioner och en kontrollsumma, och utskrifts-id:t står på varje sida.

Standard: Utskriftsvänlig sida som webbläsaren skriver ut eller sparar som PDF.

Riktning: Vårdkällan lämnar ut en journalkopia på papper eller som fil.

Adresser: `/api/patient/:id/utskrift`, `/api/utskrift/:id`, `/api/patient/:id/utskrifter`.

Behörighet och loggning: Samma behörighet som på skärmen. Utskriften loggas och utlämnandet registreras.

Simulerat: Det finns ingen central utskriftstjänst.

Koden: `app/src/utskrift.js`, `app/src/utdata-rutter.js`.

## Rapportering till myndigheter och kvalitetsregister

Systemet sammanställer det som är nytt sedan förra utskicket, kontrollerar varje post och förklarar felen på vanlig svenska innan något skickas.

Standard: Mottagarnas egna filformat, sammanställda ur journalen.

Riktning: Vårdkällan skickar till myndigheter och register.

Adresser: `/api/rapportering`, `/api/rapportering/:id/skicka`, `/api/graviditetsregistret/skicka`.

Behörighet och loggning: Varje patient som rapporteras loggas som ett utlämnande. Uppföljningsrollen ser antal och fel, inga patientuppgifter.

Simulerat: Mottagarna är simulerade, och inget skickas på riktigt.

Koden: `app/src/myndighetsrapport.js`, `app/src/rapportering-rutter.js`, `app/src/graviditetsregistret.js`, `app/src/bhvq.js`.

## Masterdata

Varje källa valideras innan något ändras, och synkroniseringen räknar själv ut vad som är nytt, ändrat och borta. Inget raderas.

Standard: Utbytbara adaptrar med ett gemensamt kontrakt för varje källa.

Riktning: Vårdkällan hämtar organisation, personal, befolkning, läkemedel och kodverk från sina källor.

Adresser: `/api/masterdata`, `/api/masterdata/:del/synkronisera`, `/api/hsa-katalog`.

Behörighet och loggning: Synkroniseringen görs av systemförvaltaren och loggas.

Simulerat: Bara filadaptern finns, och den läser seeden. Inga riktiga anslutningar till HSA, PU-tjänsten eller NPL finns.

Koden: `app/src/masterdata.js`.

## Inloggning med biljett och flerfaktor

Vårdkällan godtar bara biljetter från betrodda utfärdare, med rätt algoritm, nyckel, mottagare och giltighetstid, och bara en gång. Inloggningen tas helt ur biljettens attribut: person, medarbetaruppdrag och vårdenhet.

Standard: OpenID Connect: id-biljett som JWT signerad med ES256, JWKS och Discovery; WebAuthn och RFC 6238 för den andra faktorn.

Riktning: En autentiseringstjänst utfärdar biljetten och Vårdkällan kontrollerar den.

Adresser: `/api/login/biljett`, `/api/idp/jwks`, `/api/idp/.well-known/openid-configuration`, `/api/login/flerfaktor`.

Behörighet och loggning: Varje inloggning och varje misslyckat försök hamnar i säkerhetsloggen.

Simulerat: Autentiseringstjänsten och SITHS-kortet är simulerade.

Koden: `app/src/idp.js`, `app/src/flerfaktor.js`.

Dokumentation: `docs/sakerhetsarkitektur.md`.

## Inloggningstjänstens biljett

Inloggningen genom beställarens inloggningstjänst beskrivs i docs/sakerhetsarkitektur.md. Systemförvaltaren kopplar in en tjänst med utfärdare och klient-id, och en andra systemförvaltare godkänner varje ändring. Åtkomsten tas ur biljettens attribut: person, medarbetaruppdrag och vårdenhet, prövade mot masterdata.

Standard: OpenID Connect med authorization code och PKCE (S256), id-biljett med asymmetrisk signatur och pinnade nycklar (RFC 7638).

Riktning: Vårdkällan är förlitande part: användaren skickas till vårdgivarens inloggningstjänst och kommer tillbaka med en kod som Vårdkällan löser in mot en biljett.

Adresser: `/api/inloggning/tjanster`, `/api/inloggning/extern/:id`, `/api/inloggning/svar`, `/api/inloggning/resultat`, `/api/inloggning/rp-jwks`, `/api/inloggningstjanster`.

Behörighet och loggning: Varje inloggning och varje misslyckat försök hamnar i säkerhetsloggen, och varje ändring av en tjänst sparas med vem som föreslog och vem som godkände den. Se docs/sakerhetsarkitektur.md.

Simulerat: Demon har en simulerad övningstjänst. Ingen verklig vårdgivares inloggningstjänst är inkopplad.

Koden: `app/src/inloggningstjanster.js`, `app/src/inloggningstjanster-rutter.js`, `app/src/oidc-jwt.js`, `app/src/ovningstjanst-oidc.js`.

Dokumentation: `docs/sakerhetsarkitektur.md`.

## Signerade meddelanden och certifikat

Beviset för varje meddelande sparas och kan kontrolleras när som helst, så att ingen av parterna senare kan förneka vad som skickades och togs emot.

Standard: ECDSA P-256 med SHA-256 över ett meddelandehuvud, med certifikatkedja och signerad kvittens.

Riktning: Vårdkällan och andra organisationer signerar och kvitterar meddelanden till varandra.

Adresser: `/api/certifikat`, `/api/signerade/:id/kontroll`.

Behörighet och loggning: Mottagaren kontrollerar certifikatkedjan mot de betrodda utfärdarna, att certifikatet gäller och inte är återkallat och att signaturen och innehållets hash stämmer. Bevisen ändras och raderas aldrig.

Simulerat: Certifikaten är utfärdade av en test-CA som skapas när servern startar och inte är publikt erkänd.

Koden: `app/src/signering.js`, `app/src/pki.js`.

## Kalenderprenumeration och inbjudningar

Personen skapar en hemlig länk som läggs in som prenumeration i kalenderprogrammet. Länken visas en gång och kan återkallas.

Standard: iCalendar (RFC 5545).

Riktning: Personalens kalenderprogram hämtar från Vårdkällan.

Adresser: `/api/kalender/`, `/api/kalender/lank`, `/api/bokning/:id/inbjudan.ics`.

Behörighet och loggning: Länken sparas som HMAC, och kalendern hämtas utan inloggning och utan att någon sandlåda skapas. Den visar bara personens egna tider, med tid, typ och mottagning, och antalet hämtningar per timme har ett tak.

Koden: `app/src/kontorsstod.js`, `app/src/r10r7-rutter.js`.

## Läskopian vid avbrott

När servern inte svarar läser gränssnittet ur en krypterad läskopia, och loggen från läsläget förs över när servern svarar igen. Läskopian är ett gränssnitt mellan Vårdkällans server och dess egen klient, inte mot andra system, men den beskrivs här eftersom den lämnar ut journalinformation.

Standard: JSON, krypterad i webbläsaren med AES-GCM.

Riktning: Vårdkällans webbgränssnitt hämtar en läskopia och skickar loggen från läsläget.

Adresser: `/api/lasekopia`, `/api/lasekopia/logg`, `/api/lasekopia/krypterad-logg`.

Behörighet och loggning: Läskopian byggs med samma behörighetskontroll som de vanliga anropen, och utlämnandet loggas.

Koden: `app/src/server.js`, `app/public/js/lasekopia.js`, `app/public/js/reservkopia.js`.

## Det som inte är gränssnitt för informationsutbyte

- `/api`: Webbgränssnittets eget API. Det är inte ett gränssnitt för informationsutbyte och ändras med gränssnittet; adresserna och avvikelserna står i docs/design.md och docs/api-avvikelser.md.
- `/api/min`: Min journal, invånarens del av webbgränssnittet.
- `/api/health`: Driftens hälsokontroll, utan uppgifter om patienter.
