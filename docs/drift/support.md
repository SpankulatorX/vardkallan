# Support

Upplägg för support dygnet runt i nivåer, ärendehantering och beställarens åtkomst, språkkrav och servicenivåerna för support, och vad systemet har som stöd.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 12.3.1.1 | Support | Skallkrav vid leverans |
| 12.3.1.2 | Support | Skallkrav vid leverans |
| 12.3.1.3 | Support | Skallkrav vid leverans |
| 12.3.1.4 | Support | Utvärderingskriterium |
| 12.3.1.5 | Ärendehantering | Utvärderingskriterium |

## Support kräver en ansvarig organisation

Upphandlingen kräver support för handhavande, applikation, teknik och behörighet (utom HSA) dygnet runt alla dagar på året, enligt överenskomna servicenivåer (12.3.1.1). Det kan inte ett öppet projekt åta sig. Supporten kräver en organisation med bemanning, beredskap, telefoni och ett ärendehanteringssystem, hos regionen själv eller hos en driftleverantör. Dokumentet beskriver ett upplägg som den organisationen kan ta över.

## Ansvarsfördelning

| Ärende | Ansvarig |
| --- | --- |
| Verksamhetsrelaterat, till exempel rutiner för vilka enheter en patient får flyttas till | Beställaren dagtid. Nattetid tar supporten emot, registrerar och skickar vidare till beställarens systemförvaltning. |
| Handhavande, till exempel hur en patient flyttas i systemet | Supporten |
| Applikation, till exempel ett fel eller en ändring som kräver konfiguration | Supporten |
| Behörighet i systemet, utom HSA | Supporten |
| Teknik, till exempel en incident i infrastrukturen | Supporten |

## Nivåer

| Nivå | Vem | Uppgift |
| --- | --- | --- |
| Första linjen | Beställarens supportorganisation | Tar emot frågor från personalen, löser det som går och skickar resten vidare. |
| Andra linjen | Supporten hos den som driver systemet, dygnet runt | Handhavande, applikation, behörighet. Registrerar incidenter i incidentregistret. |
| Tredje linjen | Driftleverantörens tekniker och systemets utvecklare | Teknik, fel i koden, rotorsaker. Fel i koden blir ändringar i det öppna projektet. |

Mängden ärenden är mindre nattetid och av annat slag. Bemanningen nattetid kan därför vara mindre, med beredskap för tredje linjen.

## Kanaler

Telefon och webbportal, och e-post som registreras i ärendehanteringssystemet. Chatt kan läggas till. Supportens åtkomst till personuppgifter begränsas till det som är absolut nödvändigt: supporten löser handhavandefrågor i utbildningsmiljön med fiktiva patienter och öppnar journalen för en patient bara när ärendet kräver det, med den behörighet och loggning som gäller för all åtkomst.

## Servicenivåer för support

Ur bilaga DU2 avsnitt 3.4:

| Mått | Servicetid | Gränsvärde |
| --- | --- | --- |
| Medelsvarstid i telefon | Alla dagar 07 till 18 | 30 sekunder |
| Medelsvarstid i telefon | Alla dagar 18 till 07 | 45 sekunder |
| Medelsvarstid i webbportal och e-post, med bedömning och prioritering | Alla dagar 07 till 18 | 1 timme |
| Medelsvarstid i webbportal och e-post, med bedömning och prioritering | Alla dagar 18 till 07 | 2 timmar |
| Lösningsgrad för handhavandefrågor, löst vid första kontakten | Alla dagar 00 till 24 | 60 % |

Alla mäts per månad och redovisas i servicenivårapporten. Måtten kommer ur supportens telefoni och ärendehanteringssystem, inte ur Vårdkällan.

## Språk och kunskap

Supportens personal talar flytande svenska i tal och skrift, motsvarande nivå C1, och känner väl till systemets funktioner och uppbyggnad (12.3.1.3). Kunskapen byggs med systemets övningar och dokumentation, utbildningsmiljön och kunskapsbasen med kända fel.

## Ärendehantering

Supporten har ett ärendehanteringssystem som beställaren har åtkomst till (12.3.1.2).

1. Ärendet registreras med kanal, beskrivning, berörd enhet och kategori. Patientuppgifter skrivs inte i ärendet, bara en hänvisning som vårdgivaren kan följa upp.
2. Ärendet bedöms och prioriteras. En incident registreras också i incidentregistret i Vårdkällan, så att den räknas i servicenivårapporten.
3. Ärendet löses eller skickas till rätt nivå eller till beställaren.
4. Den som anmälde får besked när ärendet är löst och kan öppna det igen.
5. Återkommande ärenden blir problem eller förslag till förbättring.

Förväntningar på beställaren: en fungerande första linje, en förteckning över behöriga beställare, en kontaktpunkt för incidenter och deltagande i uppföljningen. Beställaren kan arbeta i ärendehanteringssystemet, se alla sina ärenden med status och historik, och få ärendena överförda till sitt eget system [fyll i: om och hur en integration görs] (12.3.1.5).

Upplägget, processen och verktygen ovan är svaret på utvärderingskriteriet om support (12.3.1.4).

## Det systemet redan har som stöd

- Synpunkter från varje vy, där systemet själv fyller i vy, roll, version och skärmbredd. Funktionen är byggd för testinbjudan och läses av testledaren ([`app/src/synpunkter.js`](../../app/src/synpunkter.js)). Den kan användas som kanal för förbättringsförslag, men den är inget ärendehanteringssystem.
- Ärenden om det öppna API:t mellan kund och utvecklare: begäran om ny informationsmängd, frågor och fel, med svar och statuskedja. Systemet säger själv om det som begärs redan finns i API:t ([`app/src/api-forvaltning.js`](../../app/src/api-forvaltning.js), `GET /api/oppet-api/arenden`, `POST /api/oppet-api/arenden`).
- Incidentregistret, som supporten registrerar incidenter i (`servicenivaer.js`, `POST /api/servicenivaer/incidenter`).
- Utbildningsmiljön med fiktiva patienter för att lösa handhavandefrågor utan att öppna riktiga journaler ([`app/src/miljoer.js`](../../app/src/miljoer.js)).
- Övningar med intyg och nyheterna per version och roll ([`app/src/utbildning.js`](../../app/src/utbildning.js), [`app/src/nyheter.json`](../../app/src/nyheter.json)).
- Åtkomstloggen, som visar varje gång supporten öppnar uppgifter om en patient ([`app/src/logg.js`](../../app/src/logg.js)).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Organisation för andra linjen | [fyll i: organisation och bemanning dag och natt] |
| Telefonnummer och webbportal | [fyll i: kontaktvägar] |
| Ärendehanteringssystem | [fyll i: system] |
| Beställarens åtkomst | [fyll i: konton och behörigheter] |
| Integration med beställarens ärendehanteringssystem | [fyll i: om och hur] |
| Beredskap för tredje linjen | [fyll i: hur och när] |
| Kontroll av språkkravet | [fyll i: hur nivå C1 visas] |

## Förkortningar

- API: gränssnitt för program (application programming interface)
- HSA: katalogtjänsten för personal och enheter i vården, som Inera förvaltar

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
