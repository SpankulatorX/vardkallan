# Samverkansmodell

Samverkansmodell och samverkansorganisation på strategisk, taktisk och operativ nivå, landstingsgemensamt och per region, med forum, roller och förändringsarbetet i samarbete.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 9.1.1.1 | Generellt under avtalsperioden | Skallkrav vid anbud |
| 9.1.1.2 | Samverkan landstingsgemensamt | Utvärderingskriterium |
| 9.1.1.3 | Samverkan enskilda myndigheter | Utvärderingskriterium |
| 11.1.1.1 | Förslag på förändringsarbete i samarbete | Skallkrav vid anbud |
| 11.1.1.2 | Förändringsarbete | Utvärderingskriterium |
| 11.2.1.2 | En ansvarig person för helheten | Skallkrav vid anbud |
| 11.2.1.3 | Samverkansorganisation och mötesfora | Skallkrav vid anbud |

## Syfte

Samverkansmodellen beskriver hur den som levererar och driver Vårdkällan och beställarna styr, kontrollerar och utvecklar relationen, avtalet och leveransen under hela avtalsperioden (9.1.1.1). Den gäller både de landstingsgemensamma frågorna och varje regions egna. Beställarna arbetar i dag efter förvaltningsmodellen pm3 för förvaltningen och ITIL v3/2011 för det tekniknära arbetet, och modellen är byggd för att passa båda.

Ett öppet projekt ändrar en del: koden och dokumentationen är öppna för alla beställare, och förslag till förbättringar kan komma från vilken region som helst. Samverkan behöver därför också bestämma hur ändringar prioriteras mellan regionerna.

## Ansvarig för helheten

Leverantören har en person som ansvarar för helheten och för alla leverantörens åtaganden inför kundens programledning (11.2.1.2). Personen leder den strategiska samverkansgruppen från leverantörens sida och är den som beställaren vänder sig till när något inte fungerar.

## Organisation

| Nivå | Landstingsgemensamt | Per region |
| --- | --- | --- |
| Strategisk | Strategisk samverkansgrupp: beställarnas programledning och leverantörens ansvarig för helheten | Regionens förvaltningsledning och leverantörens kundansvarig |
| Taktisk | Gemensamt förvaltningsforum: objektägare och förvaltningsledare, leverantörens förvaltningsledare och ändringsrådet | Regionens förvaltningsgrupp och ändringsråd |
| Operativ | Gemensamt driftmöte: kontaktpunkter för incidenter, driftleverantörens driftansvarig | Regionens systemförvaltare, första linjen och supporten |

## Forum

| Forum | Nivå | Hur ofta | Agenda |
| --- | --- | --- | --- |
| Strategisk samverkansgrupp | Strategisk, gemensam | Två gånger per år | Avtalet och relationen, långsiktig plan för funktioner och teknik, innovation, ekonomi, risker |
| Regionens strategiska möte | Strategisk, per region | En gång per år | Regionens behov och plan, införande av nya specialområden, uppföljning av effektmål |
| Gemensamt förvaltningsforum | Taktisk, gemensam | Varje kvartal | Servicenivåer över tid, releaseplan, prioritering av förslag mellan regionerna, processhandboken |
| Regionens förvaltningsmöte | Taktisk, per region | Varje månad | Servicenivårapporten, regionens förslag och ändringar, utbildning |
| Ändringsrådet | Taktisk | Varje vecka | Beslut om normala ändringar, uppföljning av genomförda |
| Driftmöte | Operativ | Varje vecka | Incidenter, problem, kommande ändringar, svarstider |
| Incidentuppföljningsmöte | Operativ | Efter varje incident av prioritet 1 och 2 | Incidenten, orsak, konsekvens, åtgärd, förebyggande |

Inför varje möte skickar leverantören agenda och underlag, och efter mötet protokoll med beslut och åtgärder, inom de tider som står i processhandboken. Avvikelser mäts enligt DU2 avsnitt 3.5.

## Roller, processer och verktyg

| Roll | Hos | Uppgift |
| --- | --- | --- |
| Ansvarig för helheten | Leverantören | Se ovan |
| Kundansvarig per region | Leverantören | Kontakt i regionens strategiska och taktiska frågor |
| Förvaltningsledare | Båda | Leder förvaltningen enligt pm3 och processhandboken |
| Objektägare | Beställaren | Beslutar om regionens prioriteringar |
| Systemförvaltare | Beställaren | Konfiguration, miljöer, uppgraderingar och servicenivåer i systemet |
| Driftansvarig | Driftleverantören | Driften och processerna i processhandboken |

Processerna står i processhandboken. Verktygen är ärendehanteringssystemet, incidentregistret och servicenivårapporten, kravsidan och den öppna koden med dess ändringshistorik (9.1.1.2, 9.1.1.3).

## Samverkansorganisationen fastställs under implementationen

Samverkansorganisation, mötesforum och riktlinjer för mötena fastställs under implementationsfasen. Leverantören leder arbetet i nära samarbete och i överenskommelse med beställaren (11.2.1.3). Förslag till ordning:

1. Leverantören tar fram ett utkast utifrån detta dokument.
2. Utkastet stäms av med varje regions programledning.
3. Den strategiska samverkansgruppen fastställer organisationen och forumen.
4. Organisationen följs upp efter [fyll i: tid, förslag sex månader i förvaltning] och ändras vid behov.

## Förändringsarbete i samarbete

Beställaren har det övergripande ansvaret för förändringsarbetet i den egna verksamheten, med förändringsledare och förändringscoacher. Leverantören bidrar med kunskap om systemet och med stöd i arbetet (11.1.1.1).

| Del | Beställaren | Leverantören |
| --- | --- | --- |
| Förändringsledare och förändringscoacher | Utser och leder | Utbildar i systemet och arbetssätten |
| Superanvändare | Utser per enhet | Utbildar, ger tidig åtkomst till nya versioner i utbildningsmiljön |
| Verksamhetens deltagande i test | Ställer upp med testare från vården | Planerar och leder användartester, tar fram testfall ur vårdens flöden |
| Utbildning | Bestämmer vilka som utbildas och när | Tar fram övningar och material per roll |
| Nya arbetssätt | Beslutar om rutiner | Visar vad varje version ändrar för varje roll |
| Uppföljning | Följer effektmålen | Redovisar användning, synpunkter och svarstider |

Verksamheten deltar i varje release: superanvändare prövar versionen i acceptanstestmiljön, användartester görs med riktiga vårdflöden, och synpunkterna blir förslag till ändringar som prioriteras i förvaltningsforumet (11.1.1.2).

## Det systemet redan har som stöd

- Användartester och Sussas testfall som automatiska tester, och testinbjudan med synpunkter från varje vy ([`app/src/anvandartest.js`](../../app/src/anvandartest.js), [`app/src/synpunkter.js`](../../app/src/synpunkter.js)).
- Nyheterna per version och roll, som visar vad varje release ändrar för varje yrke ([`app/src/nyheter.json`](../../app/src/nyheter.json)).
- Övningar med intyg per roll ([`app/src/utbildning.js`](../../app/src/utbildning.js)).
- Utbildnings-, test- och acceptanstestmiljöer ur produktionsmiljön ([`app/src/miljoer.js`](../../app/src/miljoer.js)).
- Testmetoden ([`docs/testmetod.md`](../testmetod.md), [`app/src/testmetod.js`](../../app/src/testmetod.js)).
- Servicenivårapporten per månad som underlag till förvaltningsmötena (`servicenivaer.js`).
- Ärenden om det öppna API:t mellan kund och utvecklare ([`app/src/api-forvaltning.js`](../../app/src/api-forvaltning.js)).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Ansvarig för helheten | [fyll i: roll och kontaktväg] |
| Beställarnas programledning | [fyll i: roll per region] |
| Kundansvarig per region | [fyll i: roll] |
| Mötesdagar för forumen | [fyll i: kalender för året] |
| Hur förslag prioriteras mellan regionerna | [fyll i: överenskommen ordning] |
| Superanvändare per enhet | [fyll i: hänvisning till beställarens förteckning] |
| Datum då samverkansorganisationen fastställdes | [fyll i: datum och beslut] |

## Förkortningar

- API: gränssnitt för program (application programming interface)
- ITIL: ett ramverk för hantering av IT-tjänster (Information Technology Infrastructure Library)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
