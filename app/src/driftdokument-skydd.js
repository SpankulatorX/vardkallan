// Runda 14, r5: driftdokumenten, del 2: datahallar, skydd, kryptering, klienter och införande (docs/drift/). Skrivs till
// docs/drift/ av scripts/dokument-md.js genom driftdokument.js.
export const DOKUMENT = [
  {
    fil: 'datahallar.md',
    rubrik: 'Krav på datahallar och drift',
    sammanfattning: 'Kravlista och mall för den som driver Vårdkällan: drift som helhetsåtagande, datahallar, maskinvara, programvara, datakommunikation fram till överlämningspunkten, självständighet, miljö och energi och övriga miljöer.',
    sussa: ['KD1.1.1.1', 'KD1.1.1.2', 'KD1.1.1.3', 'KD1.1.1.4', 'KD1.1.1.7', 'KD1.1.1.8', 'KD1.1.1.9', 'KD1.1.1.13', 'KD1.1.2.1', 'KD1.1.2.2'],
    text: `## Syfte och ansvar

Kraven i det här dokumentet är leverantörens åtaganden i upphandlingen och inte funktioner i systemet. Den som driver Vårdkällan, en region eller en driftleverantör som regionen anlitar, ansvarar för hela driften som ett helhetsåtagande (KD1.1.1.1): lokaler, maskinvara, nät, övervakning, säkerhetskopior, uppgraderingar och support, så att avtalade servicenivåer hålls. Dokumentet beskriver vad systemet kräver av driften och vad driften ska kunna visa.

Vårdkällan är i dag en demo med påhittade patienter, där varje besökare får en egen databas (en sandlåda). En driftsättning i vården kräver en driftmodell med vårdgivarens egna databaser, riktiga integrationer och en driftorganisation (se «docs/design.md»). Det som står här om systemets egenskaper gäller koden som den ser ut i dag.

## Det systemet redan har som stöd

### Programvara som systemet kräver (KD1.1.1.8)

| Del | Vad som gäller | Var det står |
| --- | --- | --- |
| Körmiljö | Bun 1.3 i en container byggd på «oven/bun:1.3.14-alpine» | «app/Dockerfile» |
| Databas | SQLite inbyggd i Bun («bun:sqlite»), inga separata databasservrar | «app/src/db.js» |
| Beroenden | Inga externa paket. Filen har inga beroenden att installera | «app/package.json» |
| Andra tjänster | Inga. Ingen meddelandekö, ingen cache och ingen sökmotor behövs | «app/src/server.js» |
| Klienter | En vanlig webbläsare, se dokumentet om klienter | «docs/tillganglighet.md» |

Bygget kör alla servertester i ett eget steg, och bygget stoppas om något test är rött (se «app/Dockerfile» och «app/scripts/kor-tester.js»). Containern kör som en användare utan särskilda rättigheter, lyssnar på port 8080, skriver data under «/data» och har en hälsokontroll mot «GET /api/health».

Driften ställer in systemet med miljövariabler i containern, bland annat «ORIGIN» (den publika adressen, som styr att sessionskakan får Secure), «SESSION_FIL», «KOPIOR_KATALOG» och «KOPIOR_ANDRA» (de två platserna för säkerhetskopior), «KOPIOR_MINUTER» (hur ofta en kopia tas, 15 minuter om inget annat sätts), «FLERFAKTOR_NYCKEL» och taken för minne och disk. Värdena står i början av «app/src/server.js».

### Mått för kapacitet och svarstider

«GET /api/drift» visar sandlådor i minnet och på disk, taken, minnet och svarstiderna per anrop (median och 95:e percentil) mot målet 200 ms för 95:e percentilen. Varje svar har rubriken «Server-Timing» med serverns egen tid. Lasttestet för 100 och 500 samtidiga användare och dess resultat finns i «app/lasttest.json». Måtten gäller en enda process. Hur systemet skalas ut över flera servrar för en hel region är inte prövat.

### Självständighet mot andra regioner (KD1.1.1.3)

Varje installation är fristående och delar ingen databas, inga nycklar och ingen tjänst med andra installationer. En region kan därför ha en egen installation och styra sina egna uppgraderingar, integrationer och sin egen exit:

- En uppgradering används först när två systemförvaltare har godkänt den, var och en i sin egen inloggning, och bara när alla tester i bygget är gröna. Varje ändring av databasen har en återställning, så att en äldre version kan backa databasen själv («app/src/releaser.js»).
- Uppgifterna hör till en huvudman genom den enhet de registrerades på, och uttag och säkerhetskopior kan göras per huvudman («app/src/lagring.js»).
- Journalen kan tas ut i öppna format (HL7 FHIR R4 och e-arkivpaket), se «app/src/arkiv.js».

### Miljö och energi (KD1.1.1.7, KD1.1.1.13)

Systemet håller själv nere resursbehovet:

- En sandlåda som inte har använts på tio minuter skrivs till disk komprimerad med zstd och släpps ur minnet. En sandlåda på 3,3 MB blir omkring 0,3 MB på disken («app/src/sandlada-vila.js»).
- En sandlåda där ingen har loggat in försvinner efter en timme utan användning.
- Hur många sandlådor som får finnas i minnet räknas ur containerns minnesgräns, och varje sandlåda och varje adress har en tidsbudget per minut («app/src/server.js»).
- Allt körs i en process utan andra tjänster, och gränssnittet är statiska filer som webbläsaren cachar.

Det systemet inte kan påverka är datahallens effektivitet (PUE, Power Usage Effectiveness), elens ursprung och maskinvarans miljömärkning. De fylls i nedan.

### Övriga miljöer

Systemförvaltaren skapar en acceptanstestmiljö med avidentifierade patientuppgifter och en utbildnings- och testmiljö med fiktiva data, var och en märkt överst på varje sida («app/src/miljoer.js», KD1.1.1.5). Driften dimensionerar dem.

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

Säkerhetskopiorna skrivs till två platser och verifieras på båda («app/src/sakerhetskopior.js»). I drift ska den andra platsen vara en annan volym i den andra datahallen: [fyll i: var den andra platsen finns].

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
`,
  },
  {
    fil: 'fysiskt-skydd.md',
    rubrik: 'Fysiskt skydd för IT-utrymmen',
    sammanfattning: 'Kravlista och checklista för det fysiska skyddet av datahallar, IT-utrymmen och utvecklingsplatser, ordnad efter MSB:s vägledning för fysisk informationssäkerhet i IT-utrymmen.',
    sussa: ['5.3.1.9'],
    text: `## Syfte och ansvar

Driften ska ha ett fysiskt skydd för informationsbehandlingsresurserna som motsvarar MSB:s vägledning för fysisk informationssäkerhet i IT-utrymmen (bilaga K4), och beskriva skyddet kring utvecklingsplatser och drift mot både avsiktliga och miljörelaterade hot (5.3.1.9). Ett öppet projekt har inga egna IT-utrymmen. Dokumentet är därför en kravlista och checklista för den som driver systemet, i egen datahall eller hos en leverantör av datahallar.

Vägledningen är från 2013 och anger skyddet som exempel på tre skyddsnivåer: nivå 3 (datorhall), nivå 2 (datorrum) och nivå 1 (kommunikationsrum). Det är informationens skyddsvärde som avgör nivån, med informationsklassning och riskanalys som underlag. Journalinformation har högt skyddsvärde, så tabellerna nedan utgår från nivå 3 för datahallarna. Beslutet om nivå fattas av den driftansvarige tillsammans med beställaren.

## Det systemet redan har som stöd

Systemet kan inte skydda lokalerna, men det minskar följderna av ett fysiskt angrepp eller en skada:

- Säkerhetskopiorna skrivs till två platser och verifieras på båda, och en återställning tar den senaste verifierade kopian före vald tidpunkt och läser från den andra platsen om den första är skadad («app/src/sakerhetskopior.js»). Vägledningen säger att säkerhetskopior aldrig ska förvaras i samma utrymme som IT-utrustningen.
- Åtkomstloggen och säkerhetsloggen kedjas med SHA-256, så att en ändring i efterhand syns även om någon har kommit åt databasfilen («app/src/logg.js», «app/src/sakerhetslogg.js»).
- Läsläget vid avbrott ger personalen en krypterad läskopia av det de behöver medan servern inte svarar («app/public/js/lasekopia.js»).
- Hotmodellen med yttre och inre hot finns i «docs/sakerhetsarkitektur.md».

### Utvecklingsplatser

Utvecklingen av Vårdkällan görs med påhittade patienter och Skatteverkets testpersonnummer («app/src/seed», «docs/testmetod.md»). Inga patientuppgifter finns på utvecklingsplatserna, och källkoden är öppen. Den som anpassar eller vidareutvecklar systemet för en vårdgivare och då hanterar riktiga uppgifter, till exempel vid felsökning eller migrering, ska ha utvecklingsplatser med samma skydd som driften för de uppgifterna.

## Att fylla i för den som driver systemet

### Utrymmen och skyddsnivå

| Utrymme | Plats | Skyddsnivå enligt vägledningen | Skäl |
| --- | --- | --- | --- |
| Datahall 1 | [fyll i] | [fyll i: nivå] | [fyll i: informationsklassning och riskanalys] |
| Datahall 2 | [fyll i] | [fyll i: nivå] | [fyll i] |
| Kommunikationsrum | [fyll i] | [fyll i: nivå] | [fyll i] |
| Utvecklingsplatser med riktiga uppgifter | [fyll i] | [fyll i] | [fyll i] |

### Placering och skalskydd

| Krav enligt vägledningen för nivå 3 | Uppfyllt | Beskrivning |
| --- | --- | --- |
| Riskanalys för placeringen är gjord | [fyll i: ja eller nej] | [fyll i] |
| Utrymmet ligger ovan mark, inte mot yttervägg och långt från vatten, brandfarligt material och starka elektromagnetiska källor | [fyll i] | [fyll i] |
| Utrymmet är en egen inre säkerhetszon inom skalskyddet | [fyll i] | [fyll i] |
| Mekaniskt skydd minst skyddsklass 3 enligt SSF 200 | [fyll i] | [fyll i] |
| Väggarna ansluter tätt mot golv och bjälklag, inga fönster | [fyll i] | [fyll i] |
| Obrännbart material, inga undertak eller ljudabsorbenter | [fyll i] | [fyll i] |
| Ingen skyltning utåt som visar vad utrymmet är | [fyll i] | [fyll i] |

### Dörrar, lås och tillträde

| Krav | Uppfyllt | Beskrivning |
| --- | --- | --- |
| Sluss med två dörrar | [fyll i] | [fyll i] |
| Ståldörrar minst motståndsklass 4 enligt SS-EN 1627 och utrymmets brandklass, som öppnas utåt och har panikregel på insidan | [fyll i] | [fyll i] |
| Lås enligt SS 3522 i verksamhetens eget låssystem, i en egen behörighetsgrupp | [fyll i] | [fyll i] |
| Mekanisk reservnyckel som går att hitta om passersystemet slutar fungera | [fyll i: var den förvaras och vem som har tillgång] | [fyll i] |
| Passersystem med egen behörighetszon och loggning av varje passage | [fyll i] | [fyll i] |
| Minst två faktorer vid passage, till exempel kort och kod | [fyll i] | [fyll i] |
| Tillträde bara för den som har ett fastställt behov, med beslut och genomgång | [fyll i: hur ofta behörigheterna ses över] | [fyll i] |

### Besökare och extern personal

- [ ] Väktare, servicetekniker och städpersonal har inte fritt tillträde utan följs av egen personal: [fyll i]
- [ ] Besök registreras med namn, organisation, ärende, tid och vem som följde besökaren: [fyll i]
- [ ] Rutinen skiljer på egen och extern personal: [fyll i]
- [ ] Loggen från passersystemet sparas i [fyll i: tid] och granskas [fyll i: hur ofta och av vem]

### Larm och bevakning

| Krav | Uppfyllt | Beskrivning |
| --- | --- | --- |
| Inbrottslarm enligt SSF 130, eget larmområde, minst larmklass 2 och helst 3 | [fyll i] | [fyll i] |
| Alla dörrar larmade och kopplade till larmövervakning | [fyll i] | [fyll i] |
| Driftlarm för temperatur, fukt, kyla, reservkraft och avbrottsfri kraft (UPS) går till en bevakningsorganisation, med egna batterier | [fyll i] | [fyll i] |
| Larmhantering och åtgärder regleras i avtal med bevakningen | [fyll i] | [fyll i] |
| Utrymmet ingår i ronderingar | [fyll i] | [fyll i] |

### Brand

| Krav | Uppfyllt | Beskrivning |
| --- | --- | --- |
| Utrymmet är en egen brandcell, minst EI60 och helst EI120 | [fyll i] | [fyll i] |
| Brandlarm installerat av certifierad anläggarfirma enligt SBF 110, med aspirerande detektering | [fyll i] | [fyll i] |
| Automatisk gassläckning, och brandspjäll i ventilationen kopplade till brandlarmet | [fyll i] | [fyll i] |
| Handbrandsläckare för elbrand med minst 5 kg kolsyra både utanför och inne i utrymmet | [fyll i] | [fyll i] |
| Insatsplan för brand, vätskeläckage och sabotage | [fyll i: datum för senaste uppdatering] | [fyll i] |

### El och kyla

| Krav | Uppfyllt | Beskrivning |
| --- | --- | --- |
| Egen elmatning skild från allmänkraften, med två separata elmatningar och två grupper per stativ | [fyll i] | [fyll i] |
| Redundanta nätaggregat sitter inte i samma säkringsgrupp | [fyll i] | [fyll i] |
| Överspänningsskydd | [fyll i] | [fyll i] |
| Avbrottsfri kraft som alltid är inkopplad, dimensionerad för 10 till 30 minuter | [fyll i: belastning och batteritid] | [fyll i] |
| Reservkraft som startar inom 20 till 30 sekunder och också försörjer kyla och belysning, med bränsle för den tid riskanalysen ger | [fyll i: antal dygn] | [fyll i] |
| Precisionskyla med redundans och nödkyla, temperatur 18 till 23 grader där utrustningen tar in luft och relativ fuktighet omkring 50 procent | [fyll i] | [fyll i] |

### Vatten och kablage

- [ ] Inga vätskerör i utrymmet utom för kylan, inga rör över utrustningen: [fyll i]
- [ ] Fuktlarm kopplat till övervakningen: [fyll i]
- [ ] Kablar för data och el på skilda kabelstegar, med reservutrymme och märkning: [fyll i]
- [ ] Genomföringar har samma brandklass som väggen: [fyll i]
- [ ] Kabelbrunnar utanför skalskyddet är låsta: [fyll i]

### Säkerhetskopior och media

- [ ] Säkerhetskopiorna förvaras i en annan brandcell än servrarna, i den andra datahallen: [fyll i]
- [ ] Media som lämnar utrymmet är krypterade och transporteras med kvittens: [fyll i]
- [ ] Uttjänta diskar förstörs med intyg: [fyll i]

### Kontroller och uppföljning

| Kontroll | Hur ofta enligt vägledningen | Senast gjord | Ansvarig |
| --- | --- | --- | --- |
| Prov av reservkraften i hela kedjan | Minst en gång per kvartal | [fyll i] | [fyll i] |
| Prov av reservkyla och nödkyla | Minst en gång per halvår | [fyll i] | [fyll i] |
| Rökprov av brandlarmet | Minst en gång per år | [fyll i] | [fyll i] |
| Prov av fuktlarm och temperaturlarm | Minst en gång per år | [fyll i] | [fyll i] |
| Prov av inbrottslarmets kedja till bevakningen | Vartannat år | [fyll i] | [fyll i] |
| Kontroll av avbrottsfri kraft, släckanläggning och handbrandsläckare | Enligt egen rutin | [fyll i] | [fyll i] |
| Extern granskning av det fysiska skyddet av opartisk expertis | Minst vartannat år | [fyll i] | [fyll i] |
| Övning av insatsplanen | Löpande | [fyll i] | [fyll i] |

Avvikelser som påverkar tjänsten registreras som incidenter i vyn Servicenivåer och incidenter («#/servicenivaer»).
`,
  },
  {
    fil: 'skydd-mot-skadlig-kod-och-intrang.md',
    rubrik: 'Skydd mot skadlig kod och intrång',
    sammanfattning: 'Vad Vårdkällan själv gör för att förhindra, upptäcka och logga angrepp, och vad driften ska ha för skydd mot skadlig kod, intrångsskydd, intrångsdetektering, larm och åtgärd.',
    sussa: ['5.3.1.10', '5.3.1.13'],
    text: `## Syfte och ansvar

Sussa kräver skydd mot skadlig kod med övervakning, larm och plan för åtgärd (5.3.1.10) och säkerhetsfunktioner för intrångsskydd och intrångsdetektering som upptäcker, förhindrar och larmar (5.3.1.13). Systemet har skydd i sin egen kod, men övervakning dygnet runt, larm till en jourhavande och åtgärder kräver en driftansvarig organisation.

## Det systemet redan har som stöd

### Förhindra

| Skydd | Vad det gör | Var det finns |
| --- | --- | --- |
| Policy för innehåll (CSP) | «default-src 'self'», «object-src 'none'», «base-uri 'self'» och «frame-ancestors 'none'». Webbläsaren kör bara skript från systemet självt, och sidan kan inte ramas in av en annan webbplats | «app/src/server.js» |
| Andra säkerhetsrubriker | «X-Content-Type-Options: nosniff», «X-Frame-Options: DENY» och «Referrer-Policy: same-origin» på statiska filer | «app/src/server.js» |
| Sessionen | Kakan är HttpOnly och SameSite=Lax, får Secure när den publika adressen är HTTPS, och byts vid varje inloggning. Skrivande anrop med fel ursprung avvisas | «app/src/server.js» |
| Tak på anrop | En förfrågan får vara högst 64 kB. Varje sandlåda och varje adress har tak och tidsbudgetar | «app/src/server.js» |
| Filer som laddas upp | Typen avgörs ur filens innehåll och inte ur namnet. Bara bilder, film, ljud och PDF tas emot, med tak på storlek (1 MB för bild, ljud och dokument och 2 MB för film), på antal pixlar, på antal delar som läses och på hur mycket som packas upp | «app/src/bilder.js», «app/src/bildkodek.js» |
| Inloggning | Bara biljetter från betrodda utfärdare med rätt algoritm, nyckel, mottagare och giltighetstid, och varje biljett används en gång | «app/src/idp.js» |
| Flerfaktor | Passkey eller engångskoder, högst fem felaktiga försök per inloggning och tio per användare under en kvart | «app/src/flerfaktor.js» |
| Prenumerationer | Bara godkända mottagare, utan omdirigeringar och interna adresser | «docs/sakerhetsarkitektur.md» |

Hotmodellen med varje hot, kontrollen och testerna som visar att kontrollen fungerar finns i «app/src/hotmodell.js» och beskrivs i «docs/sakerhetsarkitektur.md».

### Upptäcka

- Säkerhetsloggen registrerar inloggning, utloggning, misslyckad inloggning, anrop som avvisas med 401 eller 403, ändrade behörigheter och inställningar, flerfaktor, export av loggen och stickprov («app/src/sakerhetslogg.js»).
- Åtkomstloggen registrerar varje läsning och skrivning i journalen med grund, och nödåtkomst och nekade försök flaggas i logguppföljningen («app/src/logg.js», «app/src/logguppfoljning.js»).
- Båda loggarna kedjas med SHA-256 och skyddas av databastriggrar mot ändring och radering. En rad som ändras i efterhand bryter kedjan, och kontrollen visar var. Kedjorna prövas också när en säkerhetskopia provåterläses («app/src/sakerhetskopior.js»).
- Signerade anteckningar och meddelanden kan kontrolleras när som helst, så att ändrat innehåll syns («app/src/anteckningssignatur.js», «app/src/signering.js»).

### Det systemet inte gör

Systemet söker inte igenom filer efter virus, har ingen egen intrångsdetektering på nätnivå och skickar inga larm till en jourhavande. Det finns ingen extern säkerhetsgranskning eller penetrationstest av koden. Säkerhetsloggen kan läsas och exporteras av logggranskaren, men driften behöver föra över händelserna till sin egen övervakning för att få larm.

## Att fylla i för den som driver systemet

### Skydd mot skadlig kod (5.3.1.10)

| Område | Beskrivning |
| --- | --- |
| Skydd på servrarna | [fyll i: produkt eller metod för servrar och containerbilder] |
| Granskning av filer som laddas upp, utöver systemets egen typkontroll | [fyll i: till exempel en virusskanner framför systemet] |
| Sårbarhetsbevakning av containerbild, operativsystem och Bun | [fyll i: verktyg, hur ofta och vem som läser resultatet] |
| Säkerhetsuppdateringar | [fyll i: tid från publicering till installation, per allvarlighetsgrad] |
| Klienterna | Beställarens ansvar enligt eKlient. [fyll i: hur ansvaret avtalas] |

### Intrångsskydd och intrångsdetektering (5.3.1.13)

| Funktion | Beskrivning |
| --- | --- |
| Brandvägg och segmentering | [fyll i: zoner, vilka portar som är öppna] |
| Skydd för webbtrafiken framför systemet | [fyll i: till exempel ett filter för webbtrafik (web application firewall) och skydd mot överbelastning] |
| Intrångsdetektering på nät och servrar | [fyll i: produkt och vad som övervakas] |
| Insamling av loggar | [fyll i: hur säkerhetsloggen, serverns loggar och nätets loggar samlas på ett ställe] |
| Mönster som ger larm | [fyll i: till exempel många misslyckade inloggningar, många avvisade anrop från samma adress, en bruten hashkedja] |
| Jour och larmväg | [fyll i: vem som tar emot larmet dygnet runt och inom vilken tid] |

### Plan för åtgärd

1. Larmet bedöms av jourhavande inom [fyll i: tid].
2. En säkerhetsincident registreras i incidentregistret i vyn Servicenivåer och incidenter («#/servicenivaer», «servicenivaer.js»).
3. Begränsa: [fyll i: till exempel stänga en adress, stänga av ett konto eller ta systemet till läsläge].
4. Utreda med säkerhetsloggen, åtkomstloggen och serverns loggar. Hashkedjorna visar om en logg har ändrats.
5. Återställa vid behov från en verifierad säkerhetskopia, med fyra ögon («app/src/sakerhetskopior.js»).
6. Rapportera till beställaren. Incidentrapporten tas ut med «POST /api/servicenivaer/export» (5.3.1.14).
7. Följa upp och förbättra: [fyll i: hur lärdomar förs in i rutiner och i koden].

- [ ] Planen övas minst [fyll i: hur ofta].
- [ ] Rapportering till myndigheter enligt gällande regler: [fyll i: vem som rapporterar och till vem].
`,
  },
  {
    fil: 'atkomst-for-drift-och-support.md',
    rubrik: 'Åtkomst för drift- och supportpersonal',
    sammanfattning: 'Hur behörigheter för drift- och supportpersonal tilldelas, följs upp och begränsas, och hur systemets egna roller hjälper till att hålla dem borta från journalen.',
    sussa: ['5.2.1.5'],
    text: `## Syfte och ansvar

Leverantören ska begränsa åtkomsten till information och funktioner för sin drift- och supportpersonal till det som är absolut nödvändigt, och beskriva hur behörigheter tilldelas, följs upp och begränsas och vilken segmentering och separering av uppgifter som finns (5.2.1.5). Systemet ger stöd inne i applikationen. Åtkomsten till servrar, databaser och nät utanför applikationen styrs av driften.

## Det systemet redan har som stöd

### Behörighet i applikationen

- Behörighetsmotorn räknar åtkomsten ur yrkesroll, vårdenhet och vårdrelation i varje anrop. Ingen behörighet tilldelas för hand («app/src/atkomst.js»).
- Varje roll, dess behov, risker och handlingar står i behörighetsanalysen («docs/behorighetsanalys.md»).
- Systemförvaltaren konfigurerar regler och parametrar, förbereder omorganisationer, beslutar om undantag, följer upp lagringen och förvaltar det öppna API:t, men har inga handlingar som läser journalen. Rollen får inte läsa journalen eller översikten och får inte ordinera.
- Ändringar som systemförvaltaren gör kräver fyra ögon: en andra systemförvaltare godkänner i sin egen inloggning. Det gäller bland annat parametrar, uppgraderingar («app/src/releaser.js») och återställning av säkerhetskopior («app/src/sakerhetskopior.js»).
- Logggranskaren läser loggarna och drar stickprov, men varje export, varje stickprov och varje granskad rad loggas («app/src/logguppfoljning.js»).
- Nödåtkomsten i journalen gäller vårdpersonal som vårdar patienten. Den loggas och flaggas och häver aldrig en spärr. Systemförvaltaren har ingen nödåtkomst.
- Inloggningen tas ur biljettens attribut och prövas mot masterdata i varje anrop, så att en person som slutar förlorar åtkomsten direkt («app/src/idp.js»).

### Loggar som inte går att ändra

Åtkomstloggen och säkerhetsloggen kedjas med SHA-256 och skyddas av databastriggrar («app/src/logg.js», «app/src/sakerhetslogg.js»). Den som har skrivrätt till databasfilen kan ändå ändra den utan att gå genom systemet. En ändrad rad bryter då kedjan, men det upptäcks först när kedjan kontrolleras. Därför ska direktåtkomst till servern och databasen loggas utanför systemet, se nedan.

### Det systemet inte gör

Databasen och säkerhetskopiorna är inte krypterade av systemet. Filnamnen för kopior och vilande sandlådor är en HMAC av sandlådans id, men innehållet ligger okrypterat. Kryptering av lagringen ska därför göras av driften (se dokumentet om kryptering).

## Att fylla i för den som driver systemet

### Roller i driften

| Roll | Uppgifter | Åtkomst | Får inte |
| --- | --- | --- | --- |
| Drifttekniker | [fyll i] | Servrar och containrar, inte databasens innehåll | Läsa journalen |
| Databasansvarig | [fyll i] | Säkerhetskopior och återställning med fyra ögon | Läsa journalen utanför en återställning |
| Nätansvarig | [fyll i] | Nät och brandväggar | Logga in på servrarna |
| Supportpersonal | [fyll i] | Ärenden och systemets mått («GET /api/drift»), ingen inloggning i journalen | Logga in som en användare |
| Systemförvaltare hos beställaren | Regler, parametrar och uppgraderingar i systemet | Rollen systemförvaltare | Läsa journalen |

### Tilldelning, uppföljning och borttagning

- [ ] Behörighet ges efter beslut av: [fyll i: roll hos driften och hos beställaren]
- [ ] Personlig inloggning med flerfaktor för all driftåtkomst, inga gemensamma konton: [fyll i]
- [ ] Åtkomsten gäller bara så länge uppdraget gäller och tas bort samma dag som det upphör: [fyll i: rutin]
- [ ] Genomgång av alla behörigheter minst [fyll i: hur ofta], med protokoll
- [ ] Personalen är kontrollerad och har tystnadsplikt eller sekretessförbindelse: [fyll i]

### Segmentering och separering

- [ ] Produktion, acceptanstest, utbildning och test är skilda åt i nät och behörigheter: [fyll i]
- [ ] Administration av servrarna sker bara från ett eget administrationsnät eller via en bevakad hoppserver: [fyll i]
- [ ] Ingen person kan ensam både ändra och godkänna en ändring i produktionen: [fyll i]

### Direktåtkomst till server och databas

- [ ] Varje inloggning på servrarna loggas utanför systemet, i en logg som driftpersonalen inte kan ändra: [fyll i: var loggen finns]
- [ ] Databasfilerna och säkerhetskopiorna ligger på krypterade volymer: [fyll i]
- [ ] Åtkomst till databasens innehåll, till exempel vid felsökning, kräver ett ärende och ett godkännande av beställaren: [fyll i]

### Nödåtkomst för drift

Ibland behövs åtkomst som går utöver det vanliga, till exempel vid ett allvarligt fel nattetid.

1. Åtkomsten begärs i ett ärende med skälet: [fyll i: ärendesystem].
2. En andra person godkänner innan åtkomsten öppnas (fyra ögon): [fyll i: vem].
3. Åtkomsten gäller en begränsad tid: [fyll i: hur länge].
4. Allt som görs loggas, och beställaren får en rapport efteråt.
5. Händelsen registreras i incidentregistret i vyn Servicenivåer och incidenter («#/servicenivaer»).
`,
  },
  {
    fil: 'kryptering.md',
    rubrik: 'Kryptering och signering',
    sammanfattning: 'Vilka algoritmer och nyckellängder Vårdkällan använder vid signering, inloggning och lagring, och vad driften ska ha för kryptering av trafik, lagring och säkerhetskopior och för nyckelhantering.',
    sussa: ['5.3.1.4'],
    text: `## Syfte och ansvar

Trafiken till och från systemet ska krypteras med publikt erkända algoritmer och nyckellängder som i dag inte kan knäckas med uttömmande sökning, och säkerhetskänsliga uppgifter som loggar och autentiseringsuppgifter ska krypteras vid lagring (5.3.1.4). Systemet krypterar och signerar på flera ställen i sin egen kod. Kryptering av trafiken (TLS) och av lagringen görs av driften.

## Det systemet redan har som stöd

### Signering och integritet

| Användning | Algoritm och nyckel | Var det finns |
| --- | --- | --- |
| Certifikat för instanser och delsystem | X.509 med ECDSA P-256 och SHA-256, kedja från rot via mellanliggande utfärdare, spärrlista | «app/src/pki.js» |
| Meddelanden till andra organisationer och kvittenser | ECDSA P-256 och SHA-256 över ett huvud med SHA-256 av innehållet | «app/src/signering.js» |
| Id-biljett vid inloggning | JWT signerad med ES256 (ECDSA P-256 och SHA-256), giltig i 300 sekunder och bara en gång | «app/src/idp.js» |
| Signerade anteckningar | Ed25519 med en nyckel som härleds med HMAC-SHA256 ur en serverhemlighet som inte ligger i databasen (simulerat SITHS-kort) | «app/src/anteckningssignatur.js» |
| Åtkomstloggen och säkerhetsloggen | Hashkedja med SHA-256 | «app/src/logg.js», «app/src/sakerhetslogg.js» |
| Säkerhetskopior och e-arkivpaket | Kontrollsumma med SHA-256 | «app/src/sakerhetskopior.js», «app/src/arkiv.js» |

I demon är rotutfärdaren en test-utfärdare som skapas när servern startar. I drift används certifikat från en utfärdare som är publikt erkänd, och listan över betrodda utfärdare innehåller den.

### Kryptering vid lagring

| Uppgift | Skydd | Var det finns |
| --- | --- | --- |
| Hemlig nyckel för engångskoder (TOTP) | AES-256-GCM med användaren som tilläggsdata. Nyckeln kommer från «FLERFAKTOR_NYCKEL» (64 hextecken) eller en fil med rättigheten 0600, aldrig från databasen | «app/src/flerfaktor.js» |
| Passkeys | Bara den publika nyckeln sparas. Servern godtar ES256 och RS256 | «app/src/flerfaktor.js» |
| Läskopian för avbrott i webbläsaren | AES-GCM med 256 bitars nyckel genom webbläsarens kryptering (Web Crypto). Nyckeln skapas av servern vid inloggningen, gäller i 8 timmar och kan inte exporteras ur webbläsaren | «app/public/js/lasekopia.js» |
| Reservkopian av läskopian | Nyckeln slås in med AES-GCM och en nyckel som härleds ur reservkoden med PBKDF2 (SHA-256, 600 000 iterationer, slumpat salt på 16 byte) | «app/public/js/reservkopia.js» |
| Nycklar för utrustning och kalenderprenumerationer | Sparas bara som HMAC-SHA256 | «app/src/medicinteknik.js», «app/src/kontorsstod.js» |
| Sessionen | Slumpat id på 24 byte, kakan är HttpOnly, SameSite=Lax och Secure när den publika adressen är HTTPS | «app/src/server.js» |

### Det systemet inte gör

- Systemet terminerar inte TLS själv. Det lyssnar på HTTP i containern och förutsätter att driften har en TLS-terminering framför.
- Systemet sätter inte rubriken för strikt HTTPS (HSTS). Den ska sättas där TLS termineras.
- Databasen, de vilande sandlådorna och säkerhetskopiorna krypteras inte av systemet. De skyddas mot ändring med triggrar och kontrollsummor men inte mot läsning.
- Systemets nycklar (för engångskoder, kopiornas namn och signeringen) skapas eller läses från filer och miljövariabler. Det finns ingen koppling till en hårdvarumodul för nycklar.

## Att fylla i för den som driver systemet

### Trafiken

| Krav | Beskrivning |
| --- | --- |
| TLS-versioner | TLS 1.2 och TLS 1.3, inga äldre. [fyll i: var TLS termineras] |
| Chiffersviter | Bara publikt erkända chiffer med framåtsekretess, till exempel AES-GCM och ChaCha20-Poly1305 med ECDHE. [fyll i: konfigurationen] |
| Certifikat för den publika adressen | [fyll i: utfärdare, nyckeltyp och längd, giltighet och hur certifikatet förnyas] |
| HSTS | [fyll i: rubriken och dess maximala ålder] |
| Trafiken mellan TLS-termineringen och containern | [fyll i: samma server, eget nät eller krypterad] |
| Trafiken till nationella tjänster och andra organisationer | [fyll i: till exempel ömsesidig TLS med SITHS-certifikat] |

### Lagringen

- [ ] Volymerna för databas, vilande sandlådor och säkerhetskopior är krypterade med AES med 256 bitars nyckel eller motsvarande: [fyll i: metod]
- [ ] Säkerhetskopior som lämnar servern krypteras före överföringen: [fyll i]
- [ ] Serverns och nätets loggar krypteras vid lagring: [fyll i]
- [ ] Utrustning med lagring raderas eller förstörs säkert när den tas ur bruk: [fyll i]

### Nyckelhantering

| Nyckel | Var den förvaras | Vem som har tillgång | Byte |
| --- | --- | --- | --- |
| «FLERFAKTOR_NYCKEL» | [fyll i] | [fyll i] | [fyll i: hur ofta och hur befintliga koder krypteras om] |
| Nyckeln för kopiornas namn | [fyll i] | [fyll i] | [fyll i] |
| Serverhemligheten för signering | [fyll i] | [fyll i] | [fyll i] |
| Instansens certifikat och nyckel | [fyll i] | [fyll i] | [fyll i] |
| TLS-certifikatets nyckel | [fyll i] | [fyll i] | [fyll i] |
| Nycklar för krypterade volymer | [fyll i] | [fyll i] | [fyll i] |

- [ ] Nycklar förvaras skilda från de data de skyddar, gärna i en hårdvarumodul för nycklar: [fyll i]
- [ ] Rutin om en nyckel kan ha röjts: [fyll i]
- [ ] Genomgång av algoritmer och nyckellängder mot gällande rekommendationer minst en gång om året: [fyll i: vem]
`,
  },
  {
    fil: 'informationssakerhet.md',
    rubrik: 'Systematiskt informationssäkerhetsarbete',
    sammanfattning: 'Mall för den driftansvariges ledningssystem för informationssäkerhet i tjänsteleveransen, och en beskrivning av det säkerhetsarbete som projektet gör i utvecklingen av Vårdkällan.',
    sussa: ['5.3.1.1', '5.3.1.17'],
    text: `## Syfte och ansvar

Leverantören ska ha ett dokumenterat systematiskt arbete med informationssäkerhet för tjänsteleveransen (5.3.1.1) och beskriva det utifrån standarder, processer och kontroller, personalens kompetens och lämplighet, certifieringar, riskminimering och ständiga förbättringar (5.3.1.17). Arbetet hör till den organisation som driver systemet. Projektet bakom Vårdkällan har ett säkerhetsarbete i utvecklingen, som beskrivs först, och som den driftansvarige kan bygga vidare på.

## Det systemet redan har som stöd

### Säkerhetsarbetet i utvecklingen

| Del | Vad som görs | Var det finns |
| --- | --- | --- |
| Hotmodell | Yttre och inre hot, kontrollen för varje hot, principen den följer och testerna som visar att den fungerar. Bygget stoppas om ett test saknas eller är rött | «app/src/hotmodell.js», «docs/sakerhetsarkitektur.md» |
| Behörighetsanalys | Varje roll med behov, risker och vad rollen inte får | «docs/behorighetsanalys.md» |
| Skyddsbehov | Varje informationstyp har en klassning som styr stickprov och urval | «app/src/skyddsbehov.js» |
| Säkerhetsgranskning | Ändringarna granskas, och fynden läggs i en lista tills de är rättade och testade. Ett villkor för version 1.0 är att listan är tom | «app/src/sakerhetsfynd.json», «app/src/version.js», «docs/design.md» |
| Tester | Varje krav pekar på de automatiska tester som visar det. Det finns tester för att uppgifter inte lämnas ut till fel person, till exempel att en extern tillämpning aldrig får mer än personen och att invånaren inte får mer än i Min journal | «app/src/sussa/index.js», «app/test/oppet-api.test.js», «app/test/patientvy.test.js» |
| Bygget | Servertesterna körs i bygget, och bygget stoppas vid ett rött test | «app/Dockerfile», «app/scripts/kor-tester.js» |
| Kontroll av koder | Koder i seeden och FHIR-API:t kontrolleras mot primärkällan | «docs/kodkontroll.md» |
| Beroenden | Inga externa paket, vilket minskar risken i leveranskedjan | «app/package.json» |
| Testmetod | Testerna följer dokumentstrukturen i ISO/IEC/IEEE 29119-3 | «docs/testmetod.md» |
| Medicinteknisk bedömning | Bedömning mot förordningen om medicintekniska produkter | «docs/mdr-bedomning.md» |

### Det projektet inte har

Projektet har inget certifierat ledningssystem, ingen extern säkerhetsgranskning och inget penetrationstest. Projektet driver inte systemet för någon vårdgivare. Kontroller av personal, avtal med underleverantörer och uppföljning av driften är därför den driftansvariges.

## Att fylla i för den som driver systemet

### Grund för arbetet

| Område | Beskrivning |
| --- | --- |
| Standarder | Ledningssystem enligt ISO/IEC 27001 med åtgärder enligt ISO/IEC 27002. [fyll i: version och omfattning] |
| Certifiering | [fyll i: certifikat, certifieringsorgan och giltighet, eller plan för certifiering] |
| Informationssäkerhetspolicy | [fyll i: dokument och vem som har beslutat den] |
| Ansvarig för informationssäkerheten | [fyll i: roll] |
| Omfattning | Driften av Vårdkällan med produktion och övriga miljöer, datahallar, nät och support. [fyll i: avgränsningar] |

### Riskanalys och riskminimering

- [ ] Riskanalys för tjänsteleveransen med hotmodellen i «docs/sakerhetsarkitektur.md» som underlag: [fyll i: datum och nästa översyn]
- [ ] Klassning av informationen tillsammans med beställaren, med systemets klassning som utgångspunkt: [fyll i]
- [ ] Plan för de risker som inte accepteras, med ansvarig och tidpunkt: [fyll i]
- [ ] Ny riskanalys vid större ändringar, till exempel en ny integration eller en ny datahall: [fyll i: rutin]

### Processer och kontroller

| Process | Kontroll | Uppföljning |
| --- | --- | --- |
| Behörigheter för driften | Se dokumentet om åtkomst för drift och support | [fyll i: hur ofta] |
| Ändringar i produktionen | Fyra ögon och gröna tester («app/src/releaser.js») | [fyll i] |
| Säkerhetsuppdateringar | [fyll i] | [fyll i] |
| Säkerhetskopior och provåterläsning | Verifiering på två platser («app/src/sakerhetskopior.js») | [fyll i] |
| Logguppföljning | Stickprov i systemet («app/src/logguppfoljning.js») och driftens egna loggar | [fyll i] |
| Incidenter | Incidentregistret i vyn Servicenivåer och incidenter («#/servicenivaer») | [fyll i] |
| Fysiskt skydd | Se dokumentet om fysiskt skydd | [fyll i] |
| Kontinuitet | [fyll i: kontinuitetsplan och övningar] | [fyll i] |

### Personal, kompetens och lämplighet

- [ ] Bakgrundskontroll och säkerhetsprövning före anställning eller uppdrag: [fyll i: vilka roller och hur]
- [ ] Tystnadsplikt eller sekretessförbindelse: [fyll i]
- [ ] Utbildning i informationssäkerhet vid start och därefter minst en gång om året: [fyll i]
- [ ] Krav på kompetens för varje roll i driften: [fyll i]
- [ ] Rutin när någon slutar, med borttagen åtkomst samma dag: [fyll i]

### Leverantörer och underleverantörer

- [ ] Förteckning över underleverantörer med vad de har tillgång till: [fyll i]
- [ ] Personuppgiftsbiträdesavtal och krav på informationssäkerhet i varje avtal: [fyll i]
- [ ] Uppföljning av underleverantörerna: [fyll i: hur ofta och hur]
- [ ] Var uppgifterna behandlas och lagras geografiskt: [fyll i]

### Ständiga förbättringar

- [ ] Intern revision av ledningssystemet: [fyll i: hur ofta]
- [ ] Ledningens genomgång: [fyll i: hur ofta]
- [ ] Lärdomar från incidenter och granskningar förs in i rutinerna och, när det gäller systemet, som fynd och tester i koden: [fyll i: hur ärendet lämnas till projektet]
`,
  },
  {
    fil: 'klienter.md',
    rubrik: 'Klienter och klientplattform',
    sammanfattning: 'Vilka klienter Vårdkällan kräver och är prövat i, hur klienten uppdateras och hur systemet förhåller sig till eKlients livscykelplaner, mobilstandard och paketeringspolicy.',
    sussa: ['KD1.1.4.1', 'KD1.1.4.2', 'KD1.1.4.4', 'KD1.1.4.5', 'KD1.1.4.6', 'KD1.1.4.7', 'KD1.1.4.8', 'KD1.1.4.9'],
    text: `## Syfte och ansvar

Beställaren tillhandahåller klienter enligt eKlient, och systemet ska kunna användas på dem (KD1.1.4.1). Vårdkällan är en webbapplikation som körs i en vanlig webbläsare. Här står vad systemet kräver av klienten, vad som är prövat och vad driften och beställaren behöver pröva och fylla i.

## Det systemet redan har som stöd

### Klienter som stöds (KD1.1.4.4)

| Klient | Vad som gäller | Prövat |
| --- | --- | --- |
| Webbläsare på dator | Gränssnittet är vanlig HTML, CSS och JavaScript utan ramverk | Automatiskt i Chromium 147 vid varje ändring av gränssnittet («app/klienttest-resultat.json») |
| Webbläsare i mobil och surfplatta | De flöden som är gjorda för mobilen prövas i en skärm som är 360 px bred: sidan ska inte rulla i sidled och knapparna ska gå att träffa | Automatiskt i Chromium («app/src/mobil.js», «test/mobil.cjs») |
| Flera skärmar | Fönster i samma webbläsare följer samma patient, och ett fönster kan låsas till sin patient | «app/public/js/flera-fonster.js» |
| Tillgänglighet | Prövad mot EN 301 549 | «docs/tillganglighet.md» |
| Tjock klient eller egen app | Finns inte och behövs inte | |

Den automatiska prövningen görs inte i Microsoft Edge, Firefox eller Safari och inte på riktiga mobiler. Systemet ska därför prövas i beställarens webbläsare och enheter innan det tas i bruk.

### Inga insticksprogram och ingen klientvirtualisering (KD1.1.4.6, KD1.1.4.7)

Systemet kräver inga insticksprogram (plug-ins), ingen Java, inga ActiveX-komponenter och ingen läsare för PDF utöver webbläsarens egen. Policyn för innehåll («object-src 'none'») stoppar inbäddade objekt. Ingen klientvirtualisering behövs, eftersom allt körs i webbläsaren.

### Tredjepartsprodukter i klienten (KD1.1.4.8)

Inga. Gränssnittet laddar inga skript, typsnitt eller stilmallar från andra webbplatser. Policyn för innehåll är «default-src 'self'», så webbläsaren kör bara skript från systemet självt («app/src/server.js»). Typsnittet Noto Sans levereras av systemet med sin licens. Kameran och mikrofonen används för bilder, film och ljud i journalen genom webbläsarens egna gränssnitt när användaren väljer det. Röstinmatningen använder webbläsarens inbyggda taligenkänning («app/public/js/rostinmatning.js»), och hur ljudet behandlas beror på webbläsaren, så det ska bedömas av beställaren. Streckkodsläsare används i tangentbordsläge och kräver inget i webbläsaren («app/public/js/skanner.js»).

### Uppdatering av klienten (KD1.1.4.2, KD1.1.4.9)

Det finns inget klientpaket. När servern uppgraderas får alla användare den nya versionen av gränssnittet nästa gång sidan laddas. En bakgrundstjänst i webbläsaren (service worker, «app/public/sw.js») cachar bara gränssnittets statiska filer, så att läsläget fungerar vid avbrott. Den hämtar alltid filerna från servern först och använder cachen bara när servern inte svarar inom fyra sekunder eller svarar med ett serverfel. Den rör aldrig «/api» eller «/fhir», så patientuppgifter cachas inte där. Läskopian för avbrott är krypterad (se dokumentet om kryptering). En ny version av bakgrundstjänsten tar över direkt när den har installerats.

## Följsamhet mot eKlient (KD1.1.4.5)

Bilagorna KD1 till KD4 är skrivna 2015 till 2017 och nämner de produkter och versioner som gällde då.

| Bilaga och regel | Vårdkällan | Prövat |
| --- | --- | --- |
| KD1 och KD2, livscykelplan för webbläsare: webbapplikationer ska i första hand vara oberoende av webbläsarens produkt och version | Bara standarder i webbläsaren, ingen kod för en viss webbläsare | Bara i Chromium. Microsoft Edge, som numera bygger på Chromium, och Chrome är inte prövade för sig |
| KD1 och KD2, inga webbkomponenter på klienten (Flash, Silverlight, Java i webbläsaren) | Inga | Ja, policyn för innehåll stoppar dem |
| KD1 och KD2, inget kompatibilitetsläge i webbläsaren | Behövs inte | Nej, inte prövat i regionens klientmiljö |
| KD1 och KD2, tilläggsapplikationer på klienten (Java, PDF-läsare, .NET, Office) ska motiveras och bör avvecklas | Inga. Kallelser tas ut som PDF som webbläsaren visar | Ja |
| KD1 och KD2, livscykelplan för operativsystem | Systemet beror inte på operativsystemet, bara på webbläsaren | Nej, inte prövat på regionens operativsystem |
| KD3, mobila enheter: webbappen är det första alternativet och kräver bara en webbläsare | Ingen app att distribuera med MDM | Ja, i Chromium med en smal skärm |
| KD3, data som lagras lokalt ska krypteras och trafiken ska krypteras | Läskopian krypteras med AES-GCM. Trafiken krypteras med TLS av driften | Läskopian ja, TLS i driften nej |
| KD3, inloggning med två faktorer | Flerfaktor med passkey eller engångskoder («app/src/flerfaktor.js»). SITHS-kortet är simulerat | Inte med riktiga SITHS-kort |
| KD4, paketeringspolicy 2.61: program som installeras ska paketeras som MSI | Ingenting installeras. Enligt policyn ska genvägar till webbapplikationer inte paketeras | Ej tillämpligt |

## Att fylla i för den som driver systemet

### Klientmiljön hos beställaren

| Fråga | Svar |
| --- | --- |
| Webbläsare och versioner som ska stödjas | [fyll i: enligt beställarens aktuella livscykelplan] |
| Operativsystem på datorerna | [fyll i] |
| Mobila enheter och hur de förvaltas | [fyll i: plattformar och MDM] |
| Inloggning med SITHS i webbläsaren | [fyll i: hur kortet eller e-legitimationen når webbläsaren] |
| Regler för bakgrundstjänster i webbläsaren och lokal lagring | [fyll i: om beställarens policy tillåter dem, eftersom läsläget kräver det] |

### Prövning före start

- [ ] Hela klickbudgeten och läsläget prövas i varje webbläsare som beställaren stödjer: [fyll i: webbläsare, version och resultat]
- [ ] Prövning på beställarens mobila enheter: [fyll i]
- [ ] Prövning med beställarens hjälpmedel för tillgänglighet: [fyll i]
- [ ] Ny prövning när beställaren byter primär webbläsare eller version: [fyll i: rutin]

### Uppgradering av klienten (KD1.1.4.9)

| Roll | Uppgift |
| --- | --- |
| Driften | Uppgraderar servern efter beslut med fyra ögon («app/src/releaser.js») och meddelar beställaren i förväg |
| Beställarens systemförvaltare | Godkänner uppgraderingen och läser nyheterna och ändringsloggen för API:t |
| Beställarens klientförvaltning | [fyll i: om något behöver göras i klienterna, till exempel en genväg på skrivbordet] |
| Användarna | Laddar om sidan. [fyll i: hur användarna informeras] |
`,
  },
  {
    fil: 'inforande.md',
    rubrik: 'Införande, utbildning och test',
    sammanfattning: 'Mall för projektplan, utbildningsplan och planer för specialområden vid införandet av Vårdkällan, och hur testerna fram till beställarens acceptanstest görs med projektets testmetod.',
    sussa: ['11.2.1.1', '11.2.1.6', '11.2.1.9', '11.2.1.10', '11.2.1.11', '11.2.1.12', '12.2.1.1', '12.2.1.2', '12.2.1.3', '11.3.1.1'],
    text: `## Syfte och ansvar

Grundimplementationen ska drivas i projektform (11.2.1.1) med en projektplan som beställaren godkänner (11.2.1.9, 11.2.1.10), en utbildningsplan (11.2.1.11, 11.2.1.12) och planer för specialområdena (11.3.1.1). Leverantören ansvarar för tester fram till beställarens acceptanstest (11.2.1.6, 12.2.1.2) och arbetar efter en beprövad och standardiserad testmetod (12.2.1.1, 12.2.1.3). Planerna nedan är mallar för den organisation som inför systemet. Projektet bakom Vårdkällan bidrar med testmetoden, kravregistret, testerna och utbildningsmiljön.

## Det systemet redan har som stöd

| Stöd | Vad det ger | Var det finns |
| --- | --- | --- |
| Kravregistret | Sussas 389 poster med status och de tester som visar varje krav | «app/src/sussa/index.js», «app/src/krav.js» |
| Testmetoden | Dokumentstrukturen i ISO/IEC/IEEE 29119-3 med vad som motsvarar varje dokument (11.2.1.5) | «docs/testmetod.md», «app/src/testmetod.js» |
| Testresultat | Resultatet per test från det senaste bygget, och för gränssnittet med en hash av gränssnittet | «app/klienttest-resultat.json», «app/src/klientresultat.js» |
| Spårbarhet från krav till test | Kravsidan visar testerna och deras status för varje krav (11.2.1.7) | «app/src/sussa/index.js» |
| Miljöer | Acceptanstestmiljö med avidentifierade data och utbildnings- och testmiljö med fiktiva data (KD1.1.1.5) | «app/src/miljoer.js» |
| Utbildning | Övningar per yrkesroll med intyg i utbildningsmiljön, och utbildare med eget intyg | «app/src/utbildning.js» |
| Användartest | Protokoll och sammanställning för test med personer som arbetar i vården | «docs/anvandartest.md» |
| Klickbudget | Hur många klick varje vanligt arbetsflöde får ta | «app/src/klickbudget.js» |
| Uppgraderingar | Versioner med återgång, godkända med fyra ögon | «app/src/releaser.js» |

Utbildningsmaterialet för grundimplementationen skrivs som en egen del av projektet.

## Att fylla i för den som driver systemet

### Projektplan för grundimplementationen (11.2.1.9, 11.2.1.10)

Beställaren ska kunna börja arbetet med integrationer i kategori B och C senast sex månader efter att avtalet har tecknats.

| Del i planen | Innehåll |
| --- | --- |
| Organisation och kompetens | [fyll i: projektledning, en person med ansvar för helheten, roller och kompetens] |
| Leveransobjekt | [fyll i: produktionsmiljö, övriga miljöer, integrationer, migrering, utbildning, dokument] |
| Tid- och aktivitetsplan | [fyll i: aktiviteter med start och slut] |
| Mötesforum | [fyll i: styrgrupp, projektgrupp, samverkan med beställaren och hur ofta de möts] |
| Milstolpar | Se tabellen nedan |
| Utbildningsaktiviteter | Se utbildningsplanen nedan |
| Roller och ansvar | [fyll i: leverantörens och beställarens roller] |
| Testaktiviteter | Se avsnittet om test nedan |
| Övergripande risker | Se tabellen över risker nedan |
| Ändringshantering | [fyll i: hur ändringar i omfattning, tid och kostnad beslutas] |
| Förväntningar på beställaren | [fyll i: till exempel resurser för konfiguration, integrationer, förändringsledning och acceptanstest] |
| Beställarens aktiviteter | [fyll i: till exempel klientmiljö, nät efter överlämningspunkten och förändringsarbete i verksamheten] |

| Milstolpe | Tidpunkt | Kriterium för att den är nådd |
| --- | --- | --- |
| Projektet startat | [fyll i] | Projektplanen är godkänd av beställaren |
| Driftmiljön klar | [fyll i] | Produktion och övriga miljöer finns, med säkerhetskopior som provåterläses |
| Integrationer i kategori B och C kan påbörjas | Senast sex månader efter avtal | Testmiljö och dokumentation av API:t finns för beställaren |
| Utbildningsmaterial klart | Senast vid start av acceptanstest | Material och övningar finns i utbildningsmiljön |
| Leverantörens tester klara | [fyll i] | Testprotokoll med spårbarhet till kraven är överlämnat |
| Acceptanstest godkänt | [fyll i] | Beställaren har godkänt |
| Driftstart | [fyll i] | [fyll i] |

| Risk | Sannolikhet | Konsekvens | Åtgärd |
| --- | --- | --- | --- |
| Riktiga integrationer (till exempel nationell patientöversikt, läkemedelslistan och laboratorier) saknas i dag och är simulerade | Hög | Hög | [fyll i] |
| Migrering från dagens journalsystem | [fyll i] | [fyll i] | [fyll i] |
| Systemet är inte prövat i alla webbläsare som beställaren stödjer | [fyll i] | [fyll i] | Se dokumentet om klienter |
| Bedömning som medicinteknisk produkt («docs/mdr-bedomning.md») | [fyll i] | [fyll i] | [fyll i] |
| [fyll i: fler risker] | [fyll i] | [fyll i] | [fyll i] |

### Utbildningsplan för grundimplementationen (11.2.1.11, 11.2.1.12)

| Kategori | Utbildningsform | Verktyg och metod | Tidpunkt | Anpassning |
| --- | --- | --- | --- | --- |
| Beställarens projektdeltagare och förändringsledare | [fyll i: till exempel lärarledda pass och arbete i utbildningsmiljön] | Utbildningsmiljön med fiktiva patienter och övningarna per yrkesroll | [fyll i] | [fyll i] |
| Förvaltningsresurser, till exempel systemförvaltare | [fyll i] | Rollen systemförvaltare i utbildningsmiljön: regler och parametrar, uppgraderingar och återställning med fyra ögon | [fyll i] | [fyll i] |
| Utbildare | [fyll i] | Utbildarintyget, som verksamhetschefen utfärdar, och ändring av övningar med versioner («app/src/utbildning.js») | [fyll i] | [fyll i] |

- [ ] Metod för kvalitetssäkring och uppföljning: intygen per vårdenhet visar vem som har ett giltigt intyg, och [fyll i: utvärdering efter utbildningen]
- [ ] Planen är godkänd av beställaren: [fyll i: datum]

### Test fram till acceptanstest (11.2.1.6, 12.2.1.1, 12.2.1.2, 12.2.1.3)

| Testnivå | Ansvar | Hur det görs |
| --- | --- | --- |
| Enhets- och integrationstester i koden | Projektet och den som ändrar koden | Automatiskt i varje bygge enligt «docs/testmetod.md» |
| Gränssnittstester, klickbudget och mobil | Projektet | Automatiskt i en riktig webbläsare, resultat i «app/klienttest-resultat.json» |
| Test av integrationer som leverantören ansvarar för | Driften | [fyll i: miljö och testfall] |
| Test i beställarens klientmiljö | Driften med beställaren | [fyll i] |
| Prestanda och belastning | Driften | Lasttestet för 100 och 500 användare («app/lasttest.json») och [fyll i: mätning i den egna miljön] |
| Testprotokoll med spårbarhet till kraven | Driften | Ur kravregistret och testresultaten, [fyll i: format] |
| Acceptanstest | Beställaren | I acceptanstestmiljön med avidentifierade data |

### Planer för specialområden (11.3.1.1)

En plan med samma delar som projektplanen tas fram för varje specialområde som ska införas (11.3.1.2 till 11.3.1.9): Beställning och svar, SIP och SPU, Bildhantering, Tillväxt, Operationsplanering, Anestesi och intensivvård, Obstetrik och förlossning och Cytostatika.

| Specialområde | Organisation | Leveransobjekt | Milstolpar | Test | Utbildning | Risker | Beställarens aktiviteter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [fyll i: område] | [fyll i] | [fyll i] | [fyll i] | [fyll i] | [fyll i] | [fyll i] | [fyll i] |
`,
  },
];
// Förkortningar som används i texterna, med förklaring på svenska.
export const FORKORTNINGAR = {
  AES: 'standard för symmetrisk kryptering (Advanced Encryption Standard)',
  API: 'gränssnitt för program (application programming interface)',
  CPE: 'utrustning hos kunden som är överlämningspunkt för datakommunikationen (customer-premises equipment)',
  CSP: 'policy för innehåll (Content Security Policy) som talar om för webbläsaren vad en sida får ladda och köra',
  CSS: 'stilmallar för webbsidor (Cascading Style Sheets)',
  ECDHE: 'nyckelutbyte med elliptiska kurvor och tillfälliga nycklar, som ger framåtsekretess',
  ECDSA: 'digital signatur med elliptiska kurvor (Elliptic Curve Digital Signature Algorithm)',
  EN: 'europeisk standard (europeisk norm)',
  FHIR: 'HL7:s standard för utbyte av vårdinformation (Fast Healthcare Interoperability Resources)',
  HMAC: 'kontrollsumma med en hemlig nyckel (hash-based message authentication code)',
  HSTS: 'rubrik som säger åt webbläsaren att bara använda HTTPS mot webbplatsen (HTTP Strict Transport Security)',
  HTML: 'märkspråket för webbsidor (HyperText Markup Language)',
  HTTP: 'protokollet för webben (Hypertext Transfer Protocol)',
  HTTPS: 'HTTP krypterat med TLS',
  IEC: 'Internationella elektrotekniska kommissionen, som ger ut standarder tillsammans med ISO',
  IEEE: 'en internationell organisation för ingenjörer inom elektroteknik och elektronik som ger ut standarder (Institute of Electrical and Electronics Engineers)',
  ISO: 'Internationella standardiseringsorganisationen',
  JWT: 'en signerad biljett i JSON-format med standarden JWT (JSON Web Token)',
  MDM: 'system för att förvalta mobila enheter (mobile device management)',
  MSB: 'Myndigheten för samhällsskydd och beredskap',
  MSI: 'installationspaket för Windows (Windows Installer)',
  PBKDF2: 'härledning av en nyckel ur ett lösenord eller en kod (Password-Based Key Derivation Function 2)',
  PDF: 'dokumentformatet Portable Document Format',
  PUE: 'mått på en datahalls energieffektivitet: all energi delad med energin till IT-utrustningen (Power Usage Effectiveness)',
  QoS: 'prioritering av trafik i nätet (Quality of Service)',
  SHA: 'en familj av hashfunktioner (Secure Hash Algorithm), här SHA-256 med 256 bitar',
  SIP: 'samordnad individuell plan',
  SITHS: 'e-legitimation för personal i vård och omsorg, på kort eller i mobil',
  SPU: 'samordnad planering vid utskrivning från sluten vård',
  SBF: 'Brandskyddsföreningens normer, till exempel SBF 110 för brandlarm',
  SS: 'svensk standard från Svenska institutet för standarder',
  SSF: 'Stöldskyddsföreningens normer, till exempel SSF 200 för mekaniskt inbrottsskydd',
  TLS: 'kryptering av trafiken på nätet (Transport Layer Security)',
  TOTP: 'engångskoder som räknas ur tiden (Time-based One-Time Password, RFC 6238)',
  UPS: 'avbrottsfri kraftförsörjning (uninterruptible power supply)',
};
