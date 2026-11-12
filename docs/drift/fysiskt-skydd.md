# Fysiskt skydd för IT-utrymmen

Kravlista och checklista för det fysiska skyddet av datahallar, IT-utrymmen och utvecklingsplatser, ordnad efter MSB:s vägledning för fysisk informationssäkerhet i IT-utrymmen.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.9 | Fysiskt skydd enligt MSB:s vägledning | Skallkrav vid leverans |

## Syfte och ansvar

Driften ska ha ett fysiskt skydd för informationsbehandlingsresurserna som motsvarar MSB:s vägledning för fysisk informationssäkerhet i IT-utrymmen (bilaga K4), och beskriva skyddet kring utvecklingsplatser och drift mot både avsiktliga och miljörelaterade hot (5.3.1.9). Ett öppet projekt har inga egna IT-utrymmen. Dokumentet är därför en kravlista och checklista för den som driver systemet, i egen datahall eller hos en leverantör av datahallar.

Vägledningen är från 2013 och anger skyddet som exempel på tre skyddsnivåer: nivå 3 (datorhall), nivå 2 (datorrum) och nivå 1 (kommunikationsrum). Det är informationens skyddsvärde som avgör nivån, med informationsklassning och riskanalys som underlag. Journalinformation har högt skyddsvärde, så tabellerna nedan utgår från nivå 3 för datahallarna. Beslutet om nivå fattas av den driftansvarige tillsammans med beställaren.

## Det systemet redan har som stöd

Systemet kan inte skydda lokalerna, men det minskar följderna av ett fysiskt angrepp eller en skada:

- Säkerhetskopiorna skrivs till två platser och verifieras på båda, och en återställning tar den senaste verifierade kopian före vald tidpunkt och läser från den andra platsen om den första är skadad ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)). Vägledningen säger att säkerhetskopior aldrig ska förvaras i samma utrymme som IT-utrustningen.
- Åtkomstloggen och säkerhetsloggen kedjas med SHA-256, så att en ändring i efterhand syns även om någon har kommit åt databasfilen ([`app/src/logg.js`](../../app/src/logg.js), [`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js)).
- Läsläget vid avbrott ger personalen en krypterad läskopia av det de behöver medan servern inte svarar ([`app/public/js/lasekopia.js`](../../app/public/js/lasekopia.js)).
- Hotmodellen med yttre och inre hot finns i [`docs/sakerhetsarkitektur.md`](../sakerhetsarkitektur.md).

### Utvecklingsplatser

Utvecklingen av Vårdkällan görs med påhittade patienter och Skatteverkets testpersonnummer ([`app/src/seed`](../../app/src/seed), [`docs/testmetod.md`](../testmetod.md)). Inga patientuppgifter finns på utvecklingsplatserna, och källkoden är öppen. Den som anpassar eller vidareutvecklar systemet för en vårdgivare och då hanterar riktiga uppgifter, till exempel vid felsökning eller migrering, ska ha utvecklingsplatser med samma skydd som driften för de uppgifterna.

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

Avvikelser som påverkar tjänsten registreras som incidenter i vyn Servicenivåer och incidenter (`#/servicenivaer`).

## Förkortningar

- EN: europeisk standard (europeisk norm)
- IT: informationsteknik, datorer, nät och program
- MSB: Myndigheten för samhällsskydd och beredskap
- SBF: Brandskyddsföreningens normer, till exempel SBF 110 för brandlarm
- SHA: en familj av hashfunktioner (Secure Hash Algorithm), här SHA-256 med 256 bitar
- SS: svensk standard från Svenska institutet för standarder
- SSF: Stöldskyddsföreningens normer, till exempel SSF 200 för mekaniskt inbrottsskydd
- UPS: avbrottsfri kraftförsörjning (uninterruptible power supply)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
