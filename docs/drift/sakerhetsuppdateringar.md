# Säkerhetsuppdateringar och underhåll

Hur systemet och plattformen hålls säkerhetsuppdaterade, hur planerat underhåll görs med så lite avbrott som möjligt, och hur uppdateringarna förhåller sig till CE-märkningen.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.11 | Kontinuerliga säkerhetsuppdateringar | Skallkrav vid leverans |
| KD1.1.1.6 | Krav på drift samt maskin- och programvara | Skallkrav vid leverans |
| KD1.1.1.12 | Underhåll och tillgänglighet | Utvärderingskriterium |

## Syfte

Säkerhetsuppdateringar ska göras kontinuerligt i systemet och tillåtas i de underliggande plattformarna med bibehållen CE-märkning (5.3.1.11). Tekniskt underhåll, releaser och versionsbyten ska göras så att otillgänglighet och andra störningar för användarna blir så korta och så sällan som möjligt (KD1.1.1.6), och planerat underhåll ska göras med bibehållen tillgänglighet och prestanda (KD1.1.1.12).

## Vad som behöver uppdateras

| Del | Vad den är | Hur den uppdateras |
| --- | --- | --- |
| Vårdkällans kod | Källkoden i [`app/src`](../../app/src) och [`app/public`](../../app/public) | Ny version genom releasehanteringen |
| Beroenden i koden | Systemet har inga externa paket. Koden använder bara det som körmiljön har inbyggt ([`app/package.json`](../../app/package.json)) | Ingen egen åtgärd utöver körmiljön |
| Körmiljön | Bun, i en bestämd version i avbildningen ([`app/Dockerfile`](../../app/Dockerfile)) | Ny version av Bun i Dockerfile, därefter en ny version av Vårdkällan |
| Operativsystemet i avbildningen | Basavbildningen som Bun levereras i | Byggs om med uppdaterad basavbildning |
| Värden, nätet och lagringen | Driftleverantörens plattform | Driftleverantörens egna rutiner |
| Webbläsarna hos användarna | Beställarens klienter | Beställarens klientförvaltning |

## Så görs en säkerhetsuppdatering

1. Driftleverantören bevakar säkerhetsmeddelanden för körmiljön, basavbildningen och plattformen [fyll i: källor och hur ofta].
2. Varje sårbarhet bedöms: berörs systemet, hur allvarlig är den och hur snabbt ska den åtgärdas. Förslag: kritiska inom [fyll i: tid, förslag 48 timmar], höga inom [fyll i: tid, förslag 14 dagar], övriga i nästa planerade release.
3. Uppdateringen görs som en ändring, akut eller normal enligt processhandboken. En akut säkerhetsuppdatering får registreras i efterhand om det inte går före.
4. Versionen byggs. Bygget kör alla tester och stoppas om ett test är rött, och samma tester körs i GitHub Actions vid varje ändring.
5. Versionen prövas i acceptanstestmiljön.
6. Uppgraderingen i produktionsmiljön godkänns av två systemförvaltare, var och en i sin egen inloggning, och används bara när testerna i bygget är gröna.
7. Ger versionen fel gör en systemförvaltare en återgång till förra versionen. En säkerhetskopia tas först, och databasen backas med de sparade återställningarna.

## Planerat underhåll med så lite avbrott som möjligt

Det här har systemet:

- Små releaser. Varje ändring av databasen är en migrering som går att backa, och en äldre version kan starta mot en databas som en nyare version har ändrat.
- Migreringarna tillämpas i en transaktion. Går kontrollen av schemat efteråt inte igenom backas allt, och förra versionen är kvar.
- Avbildningen har en hälsokontroll mot `GET /api/health`, så att driften ser när en ny version är redo.
- När servern inte svarar under en omstart arbetar användarna i läsläget och kan ge doser och registrera mätvärden i skrivkön, som skickas när servern svarar igen.
- Användarna får nyheterna för sin roll efter en uppgradering, så att ändrade arbetssätt syns direkt.

Det här har systemet inte: en växling mellan två servrar utan avbrott. Ett versionsbyte kräver i dag en omstart av servern, och under den svarar inte servern. Den som driver systemet ska

1. lägga planerat underhåll i ett servicefönster som beställaren godkänner, [fyll i: tid, förslag en natt mellan 01 och 04 när få arbetar],
2. meddela verksamheten [fyll i: antal dagar] i förväg,
3. mäta hur lång tid omstarten tar i den egna miljön och redovisa den i månadsrapporten,
4. pröva om en andra server med växling i lastbalanseringen behövs för att hålla tillgängligheten.

## CE-märkningen

Vissa moduler i Vårdkällan är enligt projektets egen bedömning medicintekniska produkter enligt förordningen om medicintekniska produkter (MDR), till exempel varningarna vid ordination och dosberäkningen av cytostatika. Bedömningen står i [`docs/mdr-bedomning.md`](../mdr-bedomning.md) med filerna per modul. Demon är inte CE-märkt. Den som släpper systemet för användning i vården blir tillverkare och ansvarar för CE-märkningen.

För att en säkerhetsuppdatering inte ska riskera märkningen:

1. Varje ändring jämförs med filerna för de medicintekniska modulerna i bedömningen. En uppdatering av körmiljön, basavbildningen eller plattformen som inte ändrar dessa filer eller deras funktion dokumenteras som en ändring utan påverkan på den medicinska funktionen.
2. En ändring i en medicinteknisk modul bedöms enligt tillverkarens kvalitetsledningssystem innan den släpps.
3. Testerna i bygget är en del av verifieringen. Testmetoden står i [`docs/testmetod.md`](../testmetod.md).
4. Tillverkaren dokumenterar i förväg vilka slags plattformsuppdateringar som är tillåtna utan ny bedömning.

## Det systemet redan har som stöd

- Uppgraderingar med migreringar som går att backa, godkännande av två systemförvaltare, stopp när testerna inte är gröna och återgång ([`app/src/releaser.js`](../../app/src/releaser.js), vyn `#/uppgraderingar`).
- Bygget som kör alla tester och stoppas om ett test är rött ([`app/Dockerfile`](../../app/Dockerfile), [`app/src/testmetod.js`](../../app/src/testmetod.js)).
- Inga externa paket i koden ([`app/package.json`](../../app/package.json)), så att sårbarheter i beroenden bara kan komma från körmiljön och plattformen.
- Läsläget och skrivkön under en omstart ([`app/public/js/lasekopia.js`](../../app/public/js/lasekopia.js), [`app/src/skrivko.js`](../../app/src/skrivko.js)).
- Nyheterna per version och ändringsloggen för API:t ([`app/src/nyheter.json`](../../app/src/nyheter.json), [`app/src/api-andringar.js`](../../app/src/api-andringar.js)).
- MDR-bedömningen per modul med filerna ([`app/src/mdr-bedomning.js`](../../app/src/mdr-bedomning.js)).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Källor för säkerhetsmeddelanden | [fyll i: förteckning] |
| Tidsgränser per allvarlighetsgrad | [fyll i: tider] |
| Servicefönster | [fyll i: dag och tid, godkänt av beställaren] |
| Uppmätt tid för omstart | [fyll i: sekunder] |
| Tillverkare enligt MDR | [fyll i: organisation] |
| Tillåtna plattformsuppdateringar utan ny bedömning | [fyll i: hänvisning till tillverkarens dokument] |

## Förkortningar

- API: gränssnitt för program (application programming interface)
- CE: märkningen som visar att en produkt uppfyller EU:s krav, här för medicintekniska produkter
- MDR: EU:s förordning 2017/745 om medicintekniska produkter

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
