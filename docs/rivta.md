# Tjänstekontrakten i RIVTA

Vårdkällan bygger kopplingarna till de nationella tjänsterna mot de riktiga tjänstekontrakten i RIVTA (Sussa 2.2.1 och bilaga K10). Ett kontrakt som är byggt och validerat mot sitt schema, och testat lokalt, är fortfarande inte anslutet: en anslutning till den nationella tjänsteplattformen kräver avtal med Inera och SITHS-funktionscertifikat. Producenterna och konsumenterna i demon är lokala, och de nationella tjänsterna som Vårdkällan anropar är simulerade och märkta som simulerade.

## Grunden

Koden ligger i `app/src/rivta/` och används av alla kontrakt.

- **Säker XML** (`xml.js`). Tolken avvisar DOCTYPE, DTD:er och egna entiteter, så att varken externa entiteter eller entitetsbomber kan förekomma. Bara de fem fördefinierade entiteterna och teckenreferenser tolkas, bara UTF-8 tas emot, och inga instruktioner utom XML-deklarationen. Den läser aldrig något från nätverket eller disken. Taken är 2 MB, 48 nivåer, 60 000 element och 64 attribut per element.
- **Validering mot schemat** (`xsd.js`). Varje inkommande och utgående meddelande valideras mot kontraktets XML-schema innan något i det används eller skickas. Valideringen tar den del av XSD 1.0 som kontrakten använder (sequence, choice, grupper, xs:any med namespace och processContents, attribut, simpleContent och complexContent med extension, restriction med alla fasetter, union och list). En konstruktion som valideringen inte har ger ett fel när schemat läses, så att den aldrig tyst blir svagare än schemat. Samma modell bygger meddelandena ur vanliga objekt, med elementen i schemats ordning, och ett fält som schemat inte har är ett fel.
- **Samma svar som xmllint.** Testet `RIVTA-grunden > valideringen ger samma svar som xmllint för giltiga och ogiltiga meddelanden` prövar giltiga och ogiltiga meddelanden med både valideringen och xmllint (libxml2) mot samma schemafiler. Det körs där xmllint finns, till exempel i GitHub Actions. Docker-bygget har inte xmllint. Kör det i en container med `apk add libxml2-utils && bun test test/rivta-grund.test.js -t xmllint`.
- **SOAP 1.1 enligt RIVTA Basic Profile 2.1** (`soap.js`). Ett anrop är ett kuvert med den logiska adressen i huvudet (LogicalAddress i namnrymden urn:riv:itintegration:registry:1) och exakt ett element i kroppen, med HTTP POST, Content-Type text/xml och kontraktets SOAPAction. Fel är SOAP Fault med HTTP-status 500 och en text på svenska: soap:Client när anropet är fel, soap:Server när felet ligger hos producenten, VersionMismatch för SOAP 1.2 och MustUnderstand för ett huvudelement med mustUnderstand som tjänsten inte förstår. Logiska fel som kontraktet har en resultatkod för (till exempel INVALID_REQUEST) ges i svaret. Ingen av de pinnade domänerna definierar ActingOnBehalfOf i huvudet. Den ursprungliga konsumenten bakom en tjänsteplattform kommer i stället i HTTP-huvudet x-rivta-original-serviceconsumer-hsaid.
- **Kontrakten ur WSDL** (`kontrakt.js`). SOAPAction, begärans och svarets element, schemat och om den logiska adressen ska stå i huvudet läses ur kontraktets WSDL bland de pinnade filerna. `kontrakt('riv.clinicalprocess.healthcond.description', 'GetDiagnosis', '2.0')` ger allt som behövs för att bygga en producent eller konsument.
- **Producenten** (`tjanst.js`) tar emot ett anrop i den här ordningen: kuvertet tolkas, kontraktet bestäms av kroppens element och SOAPAction och adressen ska stämma, begäran valideras, den logiska adressen ska vara Vårdkällans vårdgivare, den anropande organisationen ska ha anropsbehörighet, producenten svarar, och svaret valideras innan det skickas. Ett svar som inte följer schemat skickas aldrig. `skapaTjanst()` ger en tjänst med samma steg för mockarna av de nationella tjänsterna.
- **Konsumenten** (`klient.js`) bygger begäran ur schemat, validerar den, skickar den och validerar svaret innan något i det används. Transporten är HTTPS med ömsesidig TLS (`https`) eller en tjänst i samma process (`iProcessen`, för mockarna i testerna).
- **Ömsesidig TLS** (`tls.js` och `testcertifikat.js`). Producentens transport kräver ett klientcertifikat med en giltig kedja till den CA som den litar på. Den anropande organisationens HSA-id är serialNumber i certifikatet, eller x-rivta-original-serviceconsumer-hsaid när anropet kommer genom en tjänsteplattform vars certifikat transporten litar på. Ett HSA-id i själva meddelandet räknas aldrig. Certifikaten i demon skapas när de behövs av en egen test-CA, är märkta som test och sparas aldrig i databasen eller i källkoden. De är aldrig SITHS-certifikat.
- **Anropsbehörighet och behörighet till uppgifterna** (`konsumenter.js`). En ansluten organisation har ett HSA-id, en lista med kontrakt som den får anropa (som anropsbehörigheterna i tjänsteplattformens adressering) och ett systemkonto. Producenterna läser genom FHIR-API:t med kontot, så att behörighetsmotorn prövar varje uppgift: bara kontots vårdenheter och informationsmängder, aldrig patienter med skyddade personuppgifter, aldrig spärrade uppgifter och aldrig det som systemförvaltningen har undantagit från nationella tjänster. Demon har tre simulerade konsumenter med påhittade HSA-id: NPÖ (SE0000000000-SIMNPO), Journalen (SE0000000000-SIMJOURNALEN) och en aggregerande tjänst för sammanhållen journalföring (SE0000000000-SIMSJF).
- **Loggning.** Varje anrop in och ut sparas i `rivta_anrop` med kontraktet, riktningen, den andra organisationen, den logiska adressen och resultatet, utan patientuppgifter. Varje läsning av patientuppgifter loggas dessutom på patienten i åtkomstloggen, med kontraktet och den anropande organisationen i loggens resurs.

## Kontrakten som är byggda

| Kontrakt | Version | Domän | Vårdkällans roll | Testat |
| --- | --- | --- | --- | --- |
| GetCareDocumentation | 2.1 | riv.clinicalprocess.healthcond.description | producent och konsument | i processen och genom den lokala tjänsteplattformen |
| GetDiagnosis | 2.0 | riv.clinicalprocess.healthcond.description | producent och konsument | i processen och genom den lokala tjänsteplattformen |
| GetAlertInformation | 2.0 | riv.clinicalprocess.healthcond.description | producent | i processen och genom den lokala tjänsteplattformen |
| GetCareContacts | 2.0 | riv.clinicalprocess.logistics.logistics | producent och konsument | i processen och genom den lokala tjänsteplattformen |
| GetMedicationHistory | 2.2 | riv.clinicalprocess.activityprescription.actoutcome | konsument | i processen |
| AssertCareEngagement | 1.0 | riv.ehr.accesscontrol | producent | i processen och genom den lokala tjänsteplattformen |
| CheckBlocks | 3.0 | riv.ehr.blocking | konsument | i processen |
| GetAllBlocksForPatient, GetBlocksForPatient | 2.0 | riv.ehr.blocking | konsument | i processen och genom den lokala tjänsteplattformen |
| RegisterTemporaryExtendedRevoke, CancelTemporaryExtendedRevoke | 2.0 | riv.ehr.blocking | konsument | i processen |
| CheckConsent, RegisterExtendedConsent, CancelExtendedConsent | 1.0 | riv.ehr.patientconsent | konsument | i processen och genom den lokala tjänsteplattformen |
| GetEmployeeIncludingProtectedPerson | 4.0 | riv.infrastructure.directory.employee | konsument | i processen och genom den lokala tjänsteplattformen |
| LookupResidentForFullProfile | 1.2 | riv.population.residentmaster | konsument | i processen och genom den lokala tjänsteplattformen |
| Update | 1.0 | riv.itintegration.engagementindex | konsument | i processen |

Status för alla: byggt och validerat mot tjänstekontraktet, testat lokalt, inte anslutet till den nationella tjänsteplattformen (kräver avtal med Inera och SITHS-funktionscertifikat). Där Vårdkällan är konsument är den andra parten simulerad (`app/src/rivta/nationella.js` och `register.js`), med påhittade HSA-id och demons påhittade uppgifter. De simulerade tjänsterna har en egen kopia av spärrar, samtycken, personalkatalogen och folkbokföringen i sandlådan, tagen första gången de används, så att skillnader mellan Vårdkällan och tjänsten syns.

K10 anger PU-tjänsten som LookupResidentsForProfile i masterdata:citizen:citizen. Den domänen finns inte bland de öppna domänerna på bitbucket.org/rivta-domains, så PU-tjänstens LookupResidentForFullProfile i riv.population.residentmaster är byggd i stället.

## Testa genom tjänsteplattformen

Testet `app/test/rivta-plattform.test.js` kör ett anrop från början till slut: konsumenten anropar en lokal tjänsteplattform med ömsesidig TLS, plattformen prövar anropsbehörigheten och vägvalet i en lokal TAK-tabell och skickar anropet vidare till producenten med sitt eget certifikat och den ursprungliga konsumenten i huvudet `x-rivta-original-serviceconsumer-hsaid`. Alla certifikat skapas av en test-CA när testet körs. Kör det med:

```
docker run --rm --memory=2g -v "$PWD:/w" -w /w/app oven/bun:1.3.14-alpine bun test test/rivta-plattform.test.js
```

Den lokala tjänsteplattformen (`app/src/rivta/plattform.js`) gör det som tjänsteplattformens virtualiseringstjänst gör med ett anrop (anropsbehörighet, vägval, felkoderna VP004 och VP007 och huvudet med den ursprungliga konsumenten), men den är inte Ineras tjänsteplattform. Ineras VP och TAK (github.com/skltp, LGPL-3.0) kördes inte: den nuvarande VP bygger på Camel och Spring Boot och beror på skltp:s egna bibliotek (till exempel takcache och hsa-cache) som inte finns på Maven Central och måste byggas från källkod ett i taget, och TAK behöver en egen databas och tjänst. VP och TAK behöver då köras samtidigt i var sin container. Att bygga dem och köra dem samtidigt ryms inte inom det minne som testdatorn har för hjälptjänster, högst 1 GB per container och en container åt gången. Testerna går därför mot den lokala plattformen och mockar som följer profilen.

## Schemana

Schemana ligger under `app/rivta/<domän>/` med `KALLA.json` (källa, tagg, commit och sha256 per fil). Licensen och versionerna står i `docs/kodkontroll.md`. Hämta om eller kontrollera dem med:

```
node app/scripts/rivta-scheman.js          # hämtar alla domäner vid sina pinnade commit
node app/scripts/rivta-scheman.js --prova  # kontrollerar filerna mot KALLA.json
```

## Bygga ett kontrakt på grunden

En producent:

```js
import { kontrakt } from './rivta/kontrakt.js';
import { vardkallan } from './rivta/tjanst.js';
const DEF = kontrakt('<domän>', '<Kontrakt>', '<version>');
vardkallan.registrera(DEF, (ctx, { begaran, konsument, logiskAdress }) => ({ /* svaret i schemats form */ }));
```

En konsument mot en tjänst:

```js
import { anropa, https } from './rivta/klient.js';
const svar = await anropa(DEF, { logiskAdress, begaran: { /* i schemats form */ }, transport: https({ bas, cert, key, ca }), db });
```

Ett objekt i schemats form har elementens lokala namn som nycklar, en lista för element som får förekomma flera gånger, `@namn` för attribut och `$` för texten i ett element med enkelt innehåll och attribut.
