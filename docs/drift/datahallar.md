# Krav på datahallar och drift

Kravlista och mall för den som driver Vårdkällan: drift som helhetsåtagande, datahallar, maskinvara, programvara, datakommunikation fram till överlämningspunkten, självständighet, miljö och energi och övriga miljöer.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| KD1.1.1.1 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.2 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.3 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.4 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.7 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.8 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.9 | Helhetsåtagande | Utvärderingskriterium |
| KD1.1.1.13 | Miljövänlighet och energieffektivitet | Utvärderingskriterium |
| KD1.1.2.1 | Krav på datakommunikation | Skallkrav vid leverans |
| KD1.1.2.2 | Datakommunikation | Utvärderingskriterium |

## Syfte och ansvar

Kraven i det här dokumentet är leverantörens åtaganden i upphandlingen och inte funktioner i systemet. Den som driver Vårdkällan, en region eller en driftleverantör som regionen anlitar, ansvarar för hela driften som ett helhetsåtagande (KD1.1.1.1): lokaler, maskinvara, nät, övervakning, säkerhetskopior, uppgraderingar och support, så att avtalade servicenivåer hålls. Dokumentet beskriver vad systemet kräver av driften och vad driften ska kunna visa.

Vårdkällan är i dag en demo med påhittade patienter, där varje besökare får en egen databas (en sandlåda). En driftsättning i vården kräver en driftmodell med vårdgivarens egna databaser, riktiga integrationer och en driftorganisation (se [`docs/design.md`](../design.md)). Det som står här om systemets egenskaper gäller koden som den ser ut i dag.

## Det systemet redan har som stöd

### Programvara som systemet kräver (KD1.1.1.8)

| Del | Vad som gäller | Var det står |
| --- | --- | --- |
| Körmiljö | Bun 1.3 i en container byggd på `oven/bun:1.3.14-alpine` | [`app/Dockerfile`](../../app/Dockerfile) |
| Databas | SQLite inbyggd i Bun (`bun:sqlite`), inga separata databasservrar | [`app/src/db.js`](../../app/src/db.js) |
| Beroenden | Inga externa paket. Filen har inga beroenden att installera | [`app/package.json`](../../app/package.json) |
| Andra tjänster | Inga. Ingen meddelandekö, ingen cache och ingen sökmotor behövs | [`app/src/server.js`](../../app/src/server.js) |
| Klienter | En vanlig webbläsare, se dokumentet om klienter | [`docs/tillganglighet.md`](../tillganglighet.md) |

Bygget kör alla servertester i ett eget steg, och bygget stoppas om något test är rött (se [`app/Dockerfile`](../../app/Dockerfile) och [`app/scripts/kor-tester.js`](../../app/scripts/kor-tester.js)). Containern kör som en användare utan särskilda rättigheter, lyssnar på port 8080, skriver data under `/data` och har en hälsokontroll mot `GET /api/health`.

Driften ställer in systemet med miljövariabler i containern, bland annat `ORIGIN` (den publika adressen, som styr att sessionskakan får Secure), `SESSION_FIL`, `KOPIOR_KATALOG` och `KOPIOR_ANDRA` (de två platserna för säkerhetskopior), `KOPIOR_MINUTER` (hur ofta en kopia tas, 15 minuter om inget annat sätts), `FLERFAKTOR_NYCKEL` och taken för minne och disk. Värdena står i början av [`app/src/server.js`](../../app/src/server.js).

### Mått för kapacitet och svarstider

`GET /api/drift` visar sandlådor i minnet och på disk, taken, minnet och svarstiderna per anrop (median och 95:e percentil) mot målet 200 ms för 95:e percentilen. Varje svar har rubriken `Server-Timing` med serverns egen tid. Lasttestet för 100 och 500 samtidiga användare och dess resultat finns i [`app/lasttest.json`](../../app/lasttest.json). Måtten gäller en enda process. Hur systemet skalas ut över flera servrar för en hel region är inte prövat.

### Självständighet mot andra regioner (KD1.1.1.3)

Varje installation är fristående och delar ingen databas, inga nycklar och ingen tjänst med andra installationer. En region kan därför ha en egen installation och styra sina egna uppgraderingar, integrationer och sin egen exit:

- En uppgradering används först när två systemförvaltare har godkänt den, var och en i sin egen inloggning, och bara när alla tester i bygget är gröna. Varje ändring av databasen har en återställning, så att en äldre version kan backa databasen själv ([`app/src/releaser.js`](../../app/src/releaser.js)).
- Uppgifterna hör till en huvudman genom den enhet de registrerades på, och uttag och säkerhetskopior kan göras per huvudman ([`app/src/lagring.js`](../../app/src/lagring.js)).
- Journalen kan tas ut i öppna format (HL7 FHIR R4 och e-arkivpaket), se [`app/src/arkiv.js`](../../app/src/arkiv.js).

### Miljö och energi (KD1.1.1.7, KD1.1.1.13)

Systemet håller själv nere resursbehovet:

- En sandlåda som inte har använts på tio minuter skrivs till disk komprimerad med zstd och släpps ur minnet. En sandlåda på 3,3 MB blir omkring 0,3 MB på disken ([`app/src/sandlada-vila.js`](../../app/src/sandlada-vila.js)).
- En sandlåda där ingen har loggat in försvinner efter en timme utan användning.
- Hur många sandlådor som får finnas i minnet räknas ur containerns minnesgräns, och varje sandlåda och varje adress har en tidsbudget per minut ([`app/src/server.js`](../../app/src/server.js)).
- Allt körs i en process utan andra tjänster, och gränssnittet är statiska filer som webbläsaren cachar.

Det systemet inte kan påverka är datahallens effektivitet (PUE, Power Usage Effectiveness), elens ursprung och maskinvarans miljömärkning. De fylls i nedan.

### Övriga miljöer

Systemförvaltaren skapar en acceptanstestmiljö med avidentifierade patientuppgifter och en utbildnings- och testmiljö med fiktiva data, var och en märkt överst på varje sida ([`app/src/miljoer.js`](../../app/src/miljoer.js), KD1.1.1.5). Driften dimensionerar dem.

## Att fylla i för den som driver systemet

### Helhetsåtagandet (KD1.1.1.1, KD1.1.1.9)

| Område | Beskrivning |
| --- | --- |
| Driftansvarig organisation | [fyll i: organisationens namn och vem som har helhetsansvaret] |
| Infrastrukturell design | [fyll i: servrar, containrar, lastbalansering, hur produktion och övriga miljöer är åtskilda] |
| Leveransorganisation | [fyll i: roller, bemanning dygnet runt, kontaktvägar till beställaren] |
| Ansvarsfördelning mot beställaren | [fyll i: vad driften gör och vad beställaren gör, till exempel klienter och nät efter överlämningspunkten] |
| Tekniska krav på omgivande infrastruktur | [fyll i: till exempel namnuppslag, tidssynkronisering, certifikat och anslutningar till nationella tjänster] |

### Datahallar (KD1.1.1.2)

Kraven gäller över hela avtalstiden. Datahallarna ska ha funktion, tillgänglighet och prestanda för avtalade servicenivåer.

| Krav | Datahall 1 | Datahall 2 |
| --- | --- | --- |
| Ort och avstånd mellan hallarna | [fyll i: ort] | [fyll i: ort och avstånd till hall 1] |
| Ägare och driftform | [fyll i: egen eller hyrd] | [fyll i: egen eller hyrd] |
| Ström med dubbla elmatningar | [fyll i] | [fyll i] |
| Reservkraft och avbrottsfri kraft (UPS) med drifttid | [fyll i] | [fyll i] |
| Kyla med redundans | [fyll i] | [fyll i] |
| Fysiskt skydd, se dokumentet om fysiskt skydd | [fyll i] | [fyll i] |
| Fastighetsskötsel och underhåll | [fyll i] | [fyll i] |
| Hur produktionen flyttas till den andra hallen och hur lång tid det tar | [fyll i] | [fyll i] |

Säkerhetskopiorna skrivs till två platser och verifieras på båda ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)). I drift ska den andra platsen vara en annan volym i den andra datahallen: [fyll i: var den andra platsen finns].

### Maskinvara och livscykel (KD1.1.1.4)

- [ ] Maskinvara för produktion och övriga miljöer: [fyll i: typ, antal, minne och disk]
- [ ] Livscykelplan med utbytesintervall: [fyll i: intervall och vem som beslutar]
- [ ] Säkerhetsuppdateringar av operativsystem och containerbild: [fyll i: rutin och hur ofta]
- [ ] Övervakning av kapacitet, med larm innan taken nås: [fyll i: verktyg och gränser]

### Datakommunikation fram till överlämningspunkten (KD1.1.2.1, KD1.1.2.2)

Driften ansvarar för kommunikationen fram till den avtalade överlämningspunkten hos beställaren (CPE). Efter den ansvarar beställaren.

| Område | Beskrivning |
| --- | --- |
| Överlämningspunkter per beställare | [fyll i: adresser och utrustning] |
| Förbindelser och skilda framföringsvägar | [fyll i: antal länkar, operatörer och vägar] |
| Redundanta nätkomponenter | [fyll i] |
| Prioritering av trafik (QoS) | [fyll i] |
| Stöd för IPv6 | [fyll i] |
| Övervakning och mätning av prestanda vid överlämningspunkten | [fyll i: hur svarstiden mäts från en klient vid överlämningspunkten] |
| Kryptering av trafiken | Se dokumentet om kryptering |

### Miljö och energi (KD1.1.1.13)

| Mått | Värde |
| --- | --- |
| Datahallens PUE | [fyll i: värde och hur det mäts] |
| Elens ursprung | [fyll i: avtal och andel förnybar el] |
| Miljömärkning av maskinvaran | [fyll i] |
| Återvinning av uttjänt maskinvara | [fyll i] |

### Självständighet och exit (KD1.1.1.3)

- [ ] Installationen för beställaren är skild från andra regioners: [fyll i: hur, till exempel egna servrar eller egna containrar och volymer]
- [ ] Beställaren bestämmer tidpunkterna för service och uppgraderingar: [fyll i: hur det avtalas]
- [ ] Integrationer i kategori B och C kan göras utan att påverka andra regioner: [fyll i]
- [ ] Plan för exit med uttag per huvudman: [fyll i: format, tidsplan och vem som tar emot]

## Förkortningar

- CPE: utrustning hos kunden som är överlämningspunkt för datakommunikationen (customer-premises equipment)
- FHIR: HL7:s standard för utbyte av vårdinformation (Fast Healthcare Interoperability Resources)
- PUE: mått på en datahalls energieffektivitet: all energi delad med energin till IT-utrustningen (Power Usage Effectiveness)
- QoS: prioritering av trafik i nätet (Quality of Service)
- UPS: avbrottsfri kraftförsörjning (uninterruptible power supply)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
