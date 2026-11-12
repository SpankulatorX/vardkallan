# Incidentrapportering

Rutin för hur incidenter rapporteras till beställaren, med ett förslag till anvisning, vad exporten innehåller och vem som gör vad.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.14 | Incidentrapportering till beställaren | Skallkrav vid leverans |

## Bakgrund

Driftleverantören ska rapportera incidenter till beställaren enligt beställarens anvisning, som beställaren ger inför produktionssättningen (5.3.1.14). Förslaget nedan gäller tills beställaren har gett sin anvisning. Systemet visar tidsgränsen för varje incident och om den har hållits, så att tidsgränserna kan ändras när anvisningen kommer.

## Förslag till anvisning

| Incident | Rapporteras till beställaren | Hur |
| --- | --- | --- |
| Prioritet 1 | Inom 30 minuter från att incidenten registrerades | Telefon till beställarens kontaktpunkt, därefter skriftligt |
| Prioritet 2 | Inom 2 timmar | Skriftligt till beställarens kontaktpunkt |
| Prioritet 3 | Inom en arbetsdag, räknat som 24 timmar | Skriftligt i ärendehanteringssystemet |
| Prioritet 4 | I månadsrapporten | Servicenivårapporten |
| Personuppgiftsincident | Inom 24 timmar, oavsett prioritet | Skriftligt till beställarens kontaktpunkt och dataskyddsombud |

Tidsgränsen för personuppgiftsincidenter är kort eftersom vårdgivaren som personuppgiftsansvarig ska anmäla incidenten till Integritetsskyddsmyndigheten (IMY) inom 72 timmar från att den upptäcktes, enligt artikel 33 i dataskyddsförordningen. Driftleverantören är personuppgiftsbiträde och ska enligt samma artikel underrätta den personuppgiftsansvarige utan onödigt dröjsmål.

Under allvarliga incidenter (prioritet 1 och 2) skickas därefter minst en uppdaterad incidentrapport per dag, och under en större incident lägesrapporter med det intervall som står i processhandboken.

## Vem gör vad

| Steg | Vem | Vad |
| --- | --- | --- |
| 1 | Den som upptäcker | Registrerar incidenten i vyn Servicenivåer och incidenter och svarar på de två frågorna. Markerar en säkerhetsincident som personuppgiftsincident när personuppgifter kan ha röjts, ändrats eller gått förlorade. |
| 2 | Driftleverantörens incidentansvarig | Ser tidsgränsen i registret och rapporterar till beställarens kontaktpunkt innan den har gått. |
| 3 | Systemförvaltaren | Tar ut incidentrapporten till beställaren som fil för den period som ska rapporteras. |
| 4 | Beställarens kontaktpunkt | Tar emot rapporten och sprider den i verksamheten. Vid en personuppgiftsincident lämnar den rapporten till vårdgivarens dataskyddsombud. |
| 5 | Vårdgivaren | Bedömer om en personuppgiftsincident ska anmälas till IMY och gör anmälan. |
| 6 | Driftleverantören | Kompletterar med orsak, konsekvens och åtgärd när incidenten avslutas, och rapporterar avslutet. |

## Exporten

Incidentrapporten till beställaren tas ut med `POST /api/servicenivaer/export`, där kroppen har `fran` och `till` som ÅÅÅÅ-MM-DD. Exporten

- innehåller incidenterna i perioden med prioritet, om det är en säkerhetsincident eller personuppgiftsincident, tider, tidsgränsen för rapportering och om den hölls, och för avslutade incidenter orsak, konsekvens, åtgärd och vad som görs för att det inte ska hända igen,
- innehåller säkerhetsloggens händelser i perioden räknade per typ, inte raderna själva,
- har inga patientuppgifter och inga personers namn,
- markerar incidenterna som rapporterade, så att registret visar vad beställaren har fått,
- loggas i säkerhetsloggen med vem som tog ut den och för vilken period.

Exporten är en åtgärd och inte en läsning, eftersom den ändrar incidenternas status och loggas. Den som bara vill se registret läser det med `GET /api/servicenivaer/incidenter`.

## Det beställaren behöver för en anmälan till IMY

Exporten ger underlaget om incidenten. För en anmälan behöver vårdgivaren också veta vilka patienter och vilka uppgifter som berörs. Det tas fram ur åtkomstloggen av vårdgivarens egen logggranskare, med den behörighet som krävs för det, och lämnas aldrig ut av driftleverantören.

## Det systemet redan har som stöd

- Incidentregistret med tidsgräns för rapportering per incident och markering av personuppgiftsincidenter (`servicenivaer.js`, `GET /api/servicenivaer/incidenter`, `POST /api/servicenivaer/incidenter`).
- Exporten till beställaren utan patientuppgifter och personnamn, som markerar incidenterna som rapporterade och loggas (`POST /api/servicenivaer/export`).
- Säkerhetsloggen med hashkedja, där inloggningar, misslyckade inloggningar, avvisade anrop, ändrade behörigheter och inställningar och export av loggen loggas ([`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js)).
- Åtkomstloggen med hashkedja för logggranskningen när en personuppgiftsincident ska utredas ([`app/src/logg.js`](../../app/src/logg.js)).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Beställarens anvisning | [fyll i: beslut och datum, eller att förslaget ovan gäller] |
| Beställarens kontaktpunkt för incidenter | [fyll i: telefon och funktionsadress dygnet runt] |
| Vårdgivarens dataskyddsombud | [fyll i: funktionsadress] |
| Driftleverantörens incidentansvarig | [fyll i: roll och kontaktväg] |
| Hur filen skickas | [fyll i: säker kanal till beställaren] |
| Tidsgränser som avviker från förslaget | [fyll i: prioritet och tid] |

## Förkortningar

- IMY: Integritetsskyddsmyndigheten, tillsynsmyndighet för dataskyddsförordningen

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
