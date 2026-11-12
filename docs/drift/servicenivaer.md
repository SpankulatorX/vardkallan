# Servicenivåer

Regler och anvisningar för servicenivåhantering, mall för servicenivåavtal och månadsrapport, och hur referensnivån för svarstider tas fram och följs upp.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| KD1.2.1.1 | Krav på tillgänglighet och servicenivå | Skallkrav vid leverans |
| KD1.2.1.2 | Krav på tillgänglighet och servicenivå | Skallkrav vid leverans |
| KD1.2.1.3 | Krav på tillgänglighet och servicenivå | Skallkrav vid leverans |
| KD1.2.1.5 | SLA-uppföljning | Utvärderingskriterium |

## Regler och anvisningar för servicenivåhantering

Driftleverantören tar fram och underhåller reglerna och anvisningarna, och beställaren godkänner dem innan de börjar användas (KD1.2.1.1). Verktygen är incidentregistret och servicenivårapporten i Vårdkällan, vyn Servicenivåer och incidenter för systemförvaltaren, och driftleverantörens ärendehanteringssystem.

1. Varje incident som påverkar produktionsmiljön registreras i incidentregistret, också när den kommer från driftens övervakning. Det som inte står i registret räknas inte i rapporten.
2. Prioriteten sätts av systemet ur två frågor: hur många som berörs (alla eller en väsentlig del, en kritisk del av verksamheten, ett fåtal, eller ingen märker det) och om vården kan arbeta (nej, mycket begränsat, eller ja med en enkel väg runt). Har parterna olika uppfattning gäller beställarens.
3. Åtgärdstiden räknas från att incidenten registreras till att den avslutas, alla dagar 00 till 24.
4. Saknas avtalad redundans registreras det som en incident av prioritet 2.
5. En negativ avvikelse från referensnivån för svarstider registreras som en incident.
6. Rapporten för en månad tas ut efter månadens slut och skickas till beställaren inom [fyll i: antal arbetsdagar, förslag 5].
7. Vitesavstämningen görs varje månad i efterhand ur samma rapport och redovisas skriftligen. Den årliga delen räknas i januari för föregående år.

## Mall för servicenivåavtal

Gränsvärdena nedan är de som gäller i produktionsmiljön enligt bilaga DU2 i upphandlingen. Vitena står i DU2 och tas in i avtalet som de är.

| Prioritet | Servicetid | Max åtgärdstid per incident | Max antal per år | Max total åtgärdstid per år |
| --- | --- | --- | --- | --- |
| 1 Kritisk | Alla dagar 00 till 24 | 2 timmar | 3 | 4 timmar |
| 2 Hög | Alla dagar 00 till 24 | 4 timmar | 8 | 16 timmar |
| 3 Medel | Alla dagar 00 till 24 | 12 timmar | Inget gränsvärde | Inget gränsvärde |
| 4 Låg | Alla dagar 07 till 18 | Enligt överenskommelse från fall till fall | Inget gränsvärde | Inget gränsvärde |

För övriga miljöer gäller DU2 avsnitt 2.2: aktiva miljöer har 8 timmar för prioritet 1 och 2 och 24 timmar för prioritet 3 vardagar 07 till 18, passiva miljöer 8 och 48 timmar.

| Övrigt mått ur DU2 | Gränsvärde |
| --- | --- |
| Svarstider | Referensnivån som fastställs under grundimplementationen, medelvärde per månad |
| Uppdaterad övrig miljö | 10 vardagar från beställning |
| Ny övrig miljö | 30 vardagar från beställning |
| Kundsupport | Se Support |
| Möten och rapporter | Deltagande, agendor, protokoll och incidentrapporter enligt processhandboken |
| Leveranskvalitet vid överlämning för test | Överenskomna villkor för överlämning uppfyllda |

## Mall för månadsrapporten

Driftleverantören övervakar och rapporterar servicenivåutfallet till beställaren varje månad (KD1.2.1.2). Systemet räknar rapporten med `GET /api/servicenivaer/rapport?manad=ÅÅÅÅ-MM`. Rubrikerna i rapporten och källan till varje mått:

| Rubrik | Mått | Källa i systemet |
| --- | --- | --- |
| Incidenter | Antal per prioritet, åtgärdstid per incident och total åtgärdstid per prioritet | Incidentregistret |
| Överskridanden | Incidenter över max åtgärdstid, och antal och total tid mot årets gränsvärden | Incidentregistret, året hittills |
| Uppföljning | Incidenter av prioritet 1 och 2 och om uppföljningsmötet är registrerat | Incidentregistret |
| Rapportering till beställaren | Om varje incident rapporterades inom sin tidsgräns | Incidentregistret, se Incidentrapportering |
| Tillgänglighet | Andelen av månadens minuter utan pågående incident av prioritet 1 | Incidentregistret |
| Svarstider | p95 per adress i API:t mot målet 200 ms | Mätningen i servern, `GET /api/drift` |
| Säkerhetskopior | Senaste kopian och om den är verifierad på båda platserna | [`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js) |
| Säkerhetsloggen | Om hashkedjan håller | [`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js) |
| Problem och ändringar | Öppna problem, genomförda ändringar och releaser | [fyll i: driftleverantörens ärendehanteringssystem] |
| Kundsupport | Medelsvarstid i telefon och webbportal, lösningsgrad | [fyll i: driftleverantörens telefoni och ärendehanteringssystem] |

Svarstiderna i servern mäts sedan servern startade, över de senaste svaren per adress. En omstart under månaden gör att mätningen börjar om. Driftleverantören sparar därför mätningen [fyll i: hur ofta, förslag varje dygn] eller mäter med en egen klient, se nedan.

## Referensnivå för svarstider

Driftleverantören och beställaren fastställer under grundimplementationen en referensnivå (baseline) för accepterade svarstider. Svarstiden mäts från och till en klient placerad vid överlämningspunkten (CPE), alltså där beställarens nät tar vid. Efter driftstart mäts och rapporteras svarstiderna varje månad, och en negativ avvikelse från referensnivån hanteras som en incident (KD1.2.1.3).

1. Välj mätobjekten: de vanliga åtgärderna i vården, till exempel inloggning, arbetslistan, sökning, översikten, journalen, läkemedlen och registrering av ett mätvärde. Lasttestet ([`app/scripts/lasttest.js`](../../app/scripts/lasttest.js)) spelar just de flödena och kan användas som mall.
2. Mät i servern: varje svar har rubriken `Server-Timing` med tiden i servern, och `GET /api/drift` visar p50 och p95 per adress och om målet 200 ms för p95 hålls.
3. Mät vid överlämningspunkten: en klient placerad vid överlämningspunkten kör samma flöden med jämna mellanrum och mäter hela tiden från klienten. Skillnaden mot tiden i servern är nätets och lastbalanseringens del.
4. Kör lasttestet med det antal samtidiga användare som avtalet gäller, i den driftmiljö som ska användas. Resultatet ([`app/lasttest.json`](../../app/lasttest.json)) gäller bara den kod som det kördes mot.
5. Referensnivån för varje mätobjekt är [fyll i: värde i sekunder per mätobjekt, förslag p95 mätt vid överlämningspunkten under två veckors acceptanstest plus en överenskommen marginal].
6. Referensnivån skrivs in i avtalet som gränsvärdet för svarstider i DU2 avsnitt 3.1.

## Uppföljningsmöten

Servicenivåerna följs upp strukturerat och återrapporteras (KD1.2.1.5).

| Möte | Hur ofta | Agenda |
| --- | --- | --- |
| Operativt driftmöte | Varje vecka | Öppna incidenter och problem, kommande ändringar, svarstider senaste veckan |
| Servicenivåmöte | Varje månad | Månadsrapporten, överskridanden och vite, incidenter av prioritet 1 och 2 med uppföljning, trender, åtgärder |
| Taktiskt förvaltningsmöte | Varje kvartal | Servicenivåerna över tid, referensnivån, förbättringar, ändringar i processhandboken |
| Årlig genomgång | En gång per år | Årets gränsvärden, årlig vitesdel, avtalets servicenivåer |

## Det systemet redan har som stöd

- Servicenivårapporten per månad, räknad ur incidentregistret, svarstiderna, säkerhetskopiorna och säkerhetsloggens kedja (`servicenivaer.js`, `GET /api/servicenivaer/rapport?manad=ÅÅÅÅ-MM`, vyn `#/servicenivaer`).
- Incidentregistret med prioritet ur två frågor och gränsvärdena ur DU2.
- Svarstider per adress med p95 mot målet 200 ms och rubriken `Server-Timing` på varje svar (`GET /api/drift`, [`app/src/server.js`](../../app/src/server.js)).
- Lasttestet för 100 och 500 samtidiga användare med realistiska flöden och betänketid ([`app/scripts/lasttest.js`](../../app/scripts/lasttest.js), [`docs/design.md`](../design.md) avsnittet om lasttest).
- Säkerhetskopior verifierade på två platser ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)) och säkerhetsloggens hashkedja ([`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js)).

Systemet mäter inte svarstiden vid överlämningspunkten och inte kundsupportens svarstider. Det kräver driftleverantörens egna verktyg.

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Godkännande av reglerna | [fyll i: beställarens beslut, datum] |
| Mätobjekt för svarstider | [fyll i: förteckning] |
| Referensnivå per mätobjekt | [fyll i: sekunder] |
| Klient vid överlämningspunkten | [fyll i: var den står och vem som förvaltar den] |
| Sparande av serverns mätvärden för svarstider | [fyll i: hur ofta och var] |
| Mottagare av månadsrapporten | [fyll i: roll hos beställaren] |
| Leveransdag för månadsrapporten | [fyll i: arbetsdag efter månadens slut] |
| Tjänstekostnad per månad som vitet räknas på | [fyll i: belopp ur avtalet] |

## Förkortningar

- API: gränssnitt för program (application programming interface)
- CPE: utrustning hos kunden som är överlämningspunkt för datakommunikationen (customer-premises equipment)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
