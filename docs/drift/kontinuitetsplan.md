# Kontinuitetsplan

Hur tillgången till informationen säkras för vården vid avbrott: läsläget, skrivkön, säkerhetskopiorna och systemets beteende när integrerade system inte svarar, med riskanalys, scenarier, roller och övningar.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.15 | Kontinuitetsplanering | Skallkrav vid leverans |
| KD1.1.1.11 | Kärnsystemets autonomitet | Utvärderingskriterium |

## Syfte

Kontinuitetsplanen ska säkerställa att vården har tillgång till informationen också när tjänsten störs (5.3.1.15). Planen beskriver vad systemet gör själv, vad den som driver systemet ska göra och vad verksamheten gör. Den ska övas och hållas aktuell.

## Det som skyddar informationen när servern inte svarar

**Läsläget.** När någon är inloggad bygger servern en läskopia med arbetslistan och, för patienterna på den och de patienter personen har öppnat, patienthuvudet, översikten, läkemedlen, mätvärdena, remisserna och de senaste anteckningarna. Kopian har samma behörighetskontroll som de vanliga anropen, och spärrar, inre sekretess och skyddad identitet gäller. Webbläsaren sparar kopian krypterad. Kopian förnyas av sig själv medan personen är inloggad, så att läkemedelsuppgifterna är högst 10 minuter gamla när ett avbrott börjar. Svarar inte servern läser gränssnittet ur kopian, visar hur gamla uppgifterna är och varnar när läkemedelsuppgifterna är äldre än 10 minuter. Varje läsning i läsläget loggas och förs över till åtkomstloggen när servern svarar igen ([`app/public/js/lasekopia.js`](../../app/public/js/lasekopia.js), `GET /api/lasekopia`, [`docs/design.md`](../design.md) avsnittet Läsläge vid avbrott).

**Reservinloggning.** Den inloggade kan välja en reservkod, så att läsläget kan öppnas också i en ny flik eller efter en omstart av webbläsaren under avbrottet. Reservkopian gäller högst 8 timmar från inloggningen.

**Skrivkön.** Under avbrottet kan personalen ge en ordinerad dos och registrera ett mätvärde för patienterna i läskopian. Registreringen sparas krypterad i webbläsaren, märks som inte sparad i journalen och skickas när servern svarar igen. Servern sparar den med samma kontroller som vanligt och med tiden då den gjordes. Har någon annan gett samma dos eller har ordinationen ändrats blir det en konflikt som personen löser ([`app/src/skrivko.js`](../../app/src/skrivko.js)).

**Säkerhetskopiorna.** Systemet tar en kopia av databasen var femtonde minut när något har ändrats och skriver den på två platser, där den verifieras. Se Återställning efter haveri.

Begränsningar: läskopian innehåller inte hela journalen, under avbrottet går bara doser och mätvärden att registrera, och läsläget förutsätter att personen var inloggad på datorn innan avbrottet. Läsläget ersätter inte en reservrutin på papper för längre avbrott.

## Systemet när integrerade system inte svarar

Kärnsystemet ska fungera med begränsad funktionalitet när integrerade system är otillgängliga, med särskild hänsyn till felhanteringen i synkrona integrationer (KD1.1.1.11). Det här är vad koden gör i dag:

| Integration | När den inte svarar | Fil |
| --- | --- | --- |
| Nationella läkemedelslistan (NLL) | Ordinationen sparas och gäller i journalen. Får överföringen inget svar i tid blir statusen okänd och kontrolleras genom avstämning, som frågar igen eller skickar på nytt. Ett felsvar visas och avstämningen skickar ordinationen igen. En lyckad förskrivning döljs aldrig. | [`app/src/lakemedel.js`](../../app/src/lakemedel.js) |
| Prenumerationer till externa system | Meddelandet sparas som väntande när ändringen har sparats och skickas sedan med en tidsgräns på 5 sekunder. En mottagare som inte svarar påverkar inte journalen, och meddelandet sparas som misslyckat. | [`app/src/prenumeration.js`](../../app/src/prenumeration.js) |
| Laboratoriernas system | Beställningarna läggs i laboratoriets utkorg och hämtas av laboratoriets system. Ett laboratorium som inte svarar stoppar inte beställningen i journalen. | [`app/src/produktionssystem.js`](../../app/src/produktionssystem.js) |
| Masterdata från externa källor | En källa som inte svarar ändrar ingenting. De senast giltiga uppgifterna används, och översikten säger från när de är. | [`app/src/masterdata.js`](../../app/src/masterdata.js) |
| Inloggningstjänsten | Inloggningen i systemet beror inte på en extern tjänst i dag, eftersom kortet är simulerat. En reservväg för inloggning när den nationella inloggningstjänsten inte svarar är inte byggd och ska finnas i driftens plan. | [`docs/design.md`](../design.md) |

I demon är överföringarna till NLL och prenumerationerna simulerade. Felhanteringen är densamma som för en riktig överföring.

## Riskanalys

| Risk | Sannolikhet | Konsekvens | Det som finns | Åtgärd hos den som driver systemet |
| --- | --- | --- | --- | --- |
| Servern eller dess värd går ner | [fyll i] | Ingen kan spara i journalen | Läsläget, skrivkön, hälsokontrollen i avbildningen | Övervakning, omstart, andra server |
| Nätet mellan vården och driften bryts | [fyll i] | Som ovan för de berörda enheterna | Läsläget, skrivkön | Redundanta förbindelser fram till överlämningspunkten |
| Databasen skadas | [fyll i] | Data kan gå förlorad | Kopior på två platser, verifiering, återställning till en tidpunkt | Kopior på annan ort, övad återställning |
| En ny version ger fel | [fyll i] | Fel i vården | Återgång till förra versionen, migreringar som går att backa | Releasehanteringen |
| Integrerat system är nere | [fyll i] | Begränsad funktion | Se tabellen ovan | Avtal med systemets ägare |
| Säkerhetsincident, till exempel intrång | [fyll i] | Röjda eller ändrade uppgifter | Säkerhetsloggen och åtkomstloggen med hashkedjor | Incidentrapportering, informationssäkerhetsprocessen |
| Personal saknas hos driftleverantören | [fyll i] | Långsammare åtgärder | Dokumenterade processer | Bemanning och beredskap |

## Scenarier och åtgärder

| Scenario | Verksamheten | Driftleverantören |
| --- | --- | --- |
| Avbrott under 30 minuter | Fortsätter i läsläget. Ger doser och registrerar mätvärden i skrivkön. | Incident prioritet 1, åtgärd, rapport till beställaren. |
| Avbrott 30 minuter till 4 timmar | Läsläget och skrivkön. Nya anteckningar, ordinationer och remisser på papper enligt reservrutinen. | Större incident, lägesrapporter, beslut om återställning. |
| Avbrott längre än 4 timmar | Reservrutin på papper, utskrifter av läkemedelslistor från läsläget innan kopian blir för gammal. | Återställning efter haveri, se det dokumentet. |
| Avbrott hos integrerat system | Arbetar som vanligt i Vårdkällan, följer avstämningen mot NLL. | Incident hos rätt part, uppföljning av avstämning. |
| Efter avbrottet | Skrivkön skickas, konflikter löses. Papper förs in i journalen. | Kontroll att loggarna från läsläget har förts över, uppföljningsmöte. |

## Roller

| Roll | Uppgift |
| --- | --- |
| Driftleverantörens kontinuitetsansvarig | Äger planen, leder övningarna och håller planen aktuell. |
| Beställarens kontinuitetsansvarig | Äger verksamhetens reservrutiner och beslutar om övergång till papper. |
| Incidentansvarig | Leder vid avbrottet enligt processhandboken. |
| Systemförvaltare | Följer skrivkön och avstämningen efter avbrottet. |

## Övning av planen

1. Läsläget övas på varje enhet [fyll i: hur ofta, förslag två gånger per år], med knappen som simulerar avbrott i en flik, också reservinloggningen.
2. En återställning från säkerhetskopiorna övas i acceptanstestmiljön [fyll i: hur ofta, förslag varje kvartal], se Återställning efter haveri.
3. Ett avbrott hos ett integrerat system övas tillsammans med systemets ägare en gång per år.
4. Varje övning dokumenteras med vad som fungerade och vad som ändras i planen.

## Det systemet redan har som stöd

- Läsläget med krypterad läskopia, reservinloggning och loggning av läsningarna ([`app/public/js/lasekopia.js`](../../app/public/js/lasekopia.js), [`docs/api-avvikelser.md`](../api-avvikelser.md)).
- Skrivkön för doser och mätvärden under avbrott ([`app/src/skrivko.js`](../../app/src/skrivko.js)).
- Säkerhetskopior på två platser med verifiering och återställning till en tidpunkt ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)).
- Felhanteringen mot NLL, prenumerationerna, laboratoriernas system och masterdata ([`app/src/lakemedel.js`](../../app/src/lakemedel.js), [`app/src/prenumeration.js`](../../app/src/prenumeration.js), [`app/src/produktionssystem.js`](../../app/src/produktionssystem.js), [`app/src/masterdata.js`](../../app/src/masterdata.js)).
- Återgång till förra versionen ([`app/src/releaser.js`](../../app/src/releaser.js)).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Kontinuitetsansvarig hos driftleverantören | [fyll i: roll] |
| Kontinuitetsansvarig hos beställaren | [fyll i: roll] |
| Verksamhetens reservrutin på papper | [fyll i: hänvisning till beställarens rutin] |
| Reservväg för inloggning | [fyll i: lösning när den nationella inloggningstjänsten inte svarar] |
| Andra server och växling | [fyll i: hur och var] |
| Sannolikhet och konsekvens i riskanalysen | [fyll i: bedömning per risk] |
| Övningsplan | [fyll i: datum för nästa övningar] |
| Planen senast granskad | [fyll i: datum] |

## Förkortningar

- NLL: Nationella läkemedelslistan, E-hälsomyndighetens register över förskrivna läkemedel

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
