# Processhandbok

Processerna för incidenter, problem, ändringar, releaser och beställningar enligt ITIL, med roller för driftleverantören och beställaren, att ta över och komma överens om.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| KD1.3.1.1 | Krav på processhandbok | Skallkrav vid leverans |
| KD1.3.1.2 | Krav på processhandbok | Skallkrav vid leverans |
| KD1.3.1.3 | Processhandbok | Utvärderingskriterium |
| KD1.3.2.1 | Krav på incidenthantering | Skallkrav vid leverans |
| KD1.3.2.2 | Krav på incidenthantering | Skallkrav vid leverans |
| KD1.3.2.3 | Krav på incidenthantering | Skallkrav vid leverans |
| KD1.3.2.4 | Krav på incidenthantering | Skallkrav vid leverans |
| KD1.3.3.1 | Krav på problemhantering | Skallkrav vid leverans |
| KD1.3.3.2 | Krav på problemhantering | Skallkrav vid leverans |
| KD1.3.4.1 | Krav på ändringshantering | Skallkrav vid leverans |
| KD1.3.4.2 | Krav på ändringshantering | Skallkrav vid leverans |
| KD1.3.5.1 | Krav på releasehanteringsprocess | Skallkrav vid leverans |
| KD1.3.5.2 | Krav på releasehanteringsprocess | Skallkrav vid leverans |
| KD1.3.6.1 | Krav på beställningshantering | Skallkrav vid leverans |
| KD1.3.6.2 | Krav på beställningshantering | Skallkrav vid leverans |
| KD1.3.7.1 | Krav på övriga processer | Skallkrav vid leverans |
| KD1.2.1.4 | Krav på tillgänglighet och servicenivå | Skallkrav vid leverans |
| 12.1.1.2 | Applikationskonfiguration | Skallkrav vid leverans |

## Syfte och omfattning

Processhandboken beskriver gränssnittet mellan den som driver Vårdkällan (driftleverantören, som kan vara regionens egen IT-förvaltning eller en upphandlad leverantör) och beställaren. Upphandlingen kräver att processerna följer ITIL, minst version 3/2011, och att handboken omfattar minst incidenthantering, problemhantering, ändringshantering, releasehantering och beställningshantering (KD1.3.1.1). Handboken nedan följer ITIL 4 och har en tabell över hur processerna i ITIL v3/2011 motsvarar praktikerna i ITIL 4, så att den kan bedömas mot båda.

Varje process har samma delar: vad den ska åstadkomma, vem som gör vad, hur ärendet går, vad beställaren får veta och när, och vilket stöd systemet ger.

## Roller

| Roll | Hos | Uppgift |
| --- | --- | --- |
| Ansvarig för helheten | Driftleverantören | En person som svarar för hela leveransen inför beställaren, se Samverkansmodell. |
| Incidentansvarig, kontaktpunkt för incidenter (SPOC) | Driftleverantören | Tar emot, prioriterar och leder incidenter, informerar beställarens kontaktpunkt vid prioritet 1 och 2. |
| Kontaktpunkt för incidenter (SPOC) | Beställaren | Tar emot information om allvarliga incidenter och sprider den i verksamheten. |
| Problemansvarig | Driftleverantören | För problemloggen och leder rotorsaksanalyser. |
| Ändringsansvarig | Beställaren | Godkänner standardändringar och leder ändringsrådet (Change Advisory Board, CAB). |
| Releaseansvarig | Driftleverantören | Planerar releaser, leder uppgraderingen och återgången. |
| Systemförvaltare | Beställaren eller driftleverantören enligt avtal | Arbetar i systemets vyer för uppgraderingar, lagring, regler och parametrar och servicenivåer. Två systemförvaltare behövs för det som kräver fyra ögon. |
| Behöriga beställare | Beställaren | De personer som beställaren skriftligen har utsett att få göra beställningar. |

## Prioritetsmodell

Incidenter prioriteras enligt bilaga DU2 i upphandlingen. Har parterna olika uppfattning om prioriteten gäller beställarens.

| Prioritet | Påverkan |
| --- | --- |
| 1 Kritisk | Akut, mycket stor påverkan på verksamheten eller på möjligheten att använda systemet. Alla eller en väsentlig del av användarna, eller en kritisk del av verksamheten, berörs. |
| 2 Hög | Brådskande, stor påverkan. Alla eller en väsentlig del av användarna, eller en kritisk del av verksamheten, berörs. |
| 3 Medel | Inte brådskande. Ett fåtal användare berörs eller påverkan på verksamheten är begränsad. |
| 4 Låg | Mindre avvikelser eller skönhetsfel. Felsökning efter överenskommelse. |

Saknas avtalad redundans utan att det har lett till en incident hanteras det som en incident av prioritet 2. Har en incident inträffat för att redundansen saknades prioriteras den som andra incidenter (KD1.2.1.4). Exempel på avtalad redundans är säkerhetskopiornas andra plats och en andra server.

## Incidenthantering

Processen följer incidenthantering (Incident Management) i ITIL 4 (KD1.3.2.1). Målet är att varje incident tas emot, hanteras och löses inom servicenivåerna.

### Så går en incident (KD1.3.2.4)

1. Incidenten kommer in från beställarens första linje, från driftleverantörens övervakning eller från en systemförvaltare. Den registreras i incidentregistret i vyn Servicenivåer och incidenter.
2. Den som registrerar svarar på två frågor: hur många som berörs och om vården kan arbeta. Systemet sätter prioriteten ur svaren enligt prioritetsmodellen. En säkerhetsincident som rör personuppgifter markeras som personuppgiftsincident.
3. Incidentansvarig tar ärendet, och vid prioritet 1 och 2 informeras beställarens kontaktpunkt enligt rutinen i Incidentrapportering.
4. Arbetet dokumenteras i ärendet med tider. Är felet hos en annan leverantör till beställaren hjälper driftleverantören till ändå: svarar på frågor om den egna miljön och deltar i incidentmöten.
5. Incidenten avslutas när tjänsten fungerar igen. Prioritet 1 och 2 kan bara avslutas med orsak, konsekvens, åtgärd och vad som görs för att det inte ska hända igen.
6. Vid prioritet 1 och 2 hålls ett incidentuppföljningsmöte och en problemrapport skapas.

Under allvarliga incidenter (prioritet 1 och 2) skickar driftleverantören minst en uppdaterad incidentrapport per dag till beställaren.

### Större incident

Är en incident av prioritet 1 inte löst inom 2 timmar startas processen för större incident (Major Incident) (KD1.3.2.3). Systemet säger själv i incidentregistret att processen ska startas när tiden har gått. Processen startas också direkt när en incident bedöms som särskilt allvarlig.

| Steg | Innehåll |
| --- | --- |
| Utse ledare | En ledare för den större incidenten, som inte själv felsöker. |
| Samla gruppen | De som behövs hos driftleverantören, beställarens kontaktpunkt och vid behov andra leverantörer. |
| Lägesrapporter | Till beställarens kontaktpunkt var [fyll i: intervall, förslag 30 minuter], också när inget nytt har hänt. |
| Beslut om reservrutiner | Tillsammans med beställaren: läsläget och skrivkön räcker eller verksamheten går över till reservrutin på papper. |
| Avslut | Ledaren avslutar när tjänsten fungerar och beställaren har bekräftat det. |
| Uppföljning | Uppföljningsmöte inom [fyll i: antal arbetsdagar, förslag 5]. |

### Incidentuppföljningsmöte (KD1.3.2.2)

Vid prioritet 1 och 2 redogör driftleverantören för incidenten, dess konsekvenser, orsaken och vad som har gjorts och ska göras för att samma typ av incident inte ska hända igen. Underlaget är det som skrevs när incidenten avslutades i incidentregistret. Mötet registreras sedan på incidenten i registret med datum, och deltagarna står i protokollet, så att servicenivårapporten visar att uppföljningen är gjord.

## Problemhantering

Processen följer problemhantering (Problem Management) i ITIL 4 (KD1.3.3.1). Målet är att incidenter inte upprepas och att risken för nya minskar.

1. Ett problem identifieras ur en problemrapport från en incident, ur en analys av incidenttrender i incidentregistret eller ur driftleverantörens egen övervakning.
2. Problemet förs in i problemloggen med klassificering och kategori enligt den standard parterna kommer överens om.
3. Rotorsaken analyseras. Finns en väg runt felet dokumenteras den som känt fel så att första linjen kan använda den.
4. Lösningen blir en ändring, se Ändringshantering.
5. Ligger problemet hos en annan leverantör till beställaren skickar driftleverantören det vidare till beställarens kontaktpunkt.

Problemloggen redovisas för beställaren [fyll i: hur ofta, förslag varje månad i servicenivårapporten och löpande i ärendehanteringssystemet] (KD1.3.3.2).

## Ändringshantering

Processen följer ändringsstyrning (Change Enablement) i ITIL 4 och ändringshantering (Change Management) i ITIL v3/2011 (KD1.3.4.1). Ändringar i produktionsmiljön och i de andra miljöerna hanteras i samma process.

| Kategori | Förklaring | Beslut |
| --- | --- | --- |
| Akut ändring | Ändringar som ska göras inom 24 timmar, till exempel en akut säkerhetsuppdatering. Begäran om ändring (RFC) registreras i förväg om det går, annars skyndsamt i efterhand. | Beställarens ändringsansvarig eller den som har utsetts för akuta beslut. |
| Standardändring | Enkel, beprövad och med liten risk. Förfarandet är överenskommet i förväg med en ifylld mall per ändringstyp. Registreras före driftsättning. | Beställarens ändringsansvarig. |
| Normal ändring | Alla andra. Behandlas i ändringsrådet (CAB) med ett beslutsunderlag i den mall som parterna har kommit överens om. | Ändringsrådet. |

Beslutsunderlaget till ändringsrådet innehåller vad som ändras, varför, risk och påverkan, test, plan för återgång och tidpunkt. För en ny version av systemet visar vyn Uppgraderingar vad versionen ändrar: nyheterna för användarna, ändringsloggen för API:t och migreringarna av databasen. Efter ändringen återkopplar driftleverantören hur den gick (KD1.3.4.2).

Applikationskonfigurationen är en del av ändringshanteringen. Upphandlingen lägger ansvaret för den på leverantören (12.1.1.2). I Vårdkällan görs regler och parametrar i vyn Regler och parametrar, där varje ändring har giltighetsdatum, förhandsvisning av effekten och godkännande av en andra systemförvaltare. Parterna kommer överens om vilka ändringar beställarens systemförvaltare får göra själva som standardändringar och vilka som går genom ändringsrådet.

## Releasehantering

Processen följer releasehantering (Release Management) och driftsättning (Deployment Management) i ITIL 4 (KD1.3.5.1). Driftleverantören planerar releaserna i nära kontakt med beställaren och informerar förvaltare av integrerade system, andra leverantörer och användargrupper.

1. Releasekalendern för [fyll i: period, förslag ett halvår framåt] överenskoms i ändringsrådet.
2. Versionen byggs, och bygget stoppas om ett test är rött. Versionen lämnas till beställarens acceptanstest i acceptanstestmiljön när de överenskomna villkoren för överlämning är uppfyllda.
3. Efter godkänt acceptanstest och beslut i ändringsrådet görs uppgraderingen i produktionsmiljön. Den används först när två systemförvaltare har godkänt den, var och en i sin egen inloggning, och bara när testerna i bygget är gröna.
4. Användarna får nyheterna för sin roll när de loggar in efter uppgraderingen.
5. Ger versionen fel i vården gör en systemförvaltare en återgång till förra versionen. En säkerhetskopia tas först.

Releaser ska vara små och gå att backa (KD1.3.5.2).

## Beställningshantering

Processen följer hantering av tjänstebeställningar (Service Request Management) i ITIL 4 och beställningshantering (Request Fulfilment) i ITIL v3/2011 (KD1.3.6.1).

1. Beställaren meddelar skriftligen vilka som är behöriga beställare. Driftleverantören tar inte emot beställningar från någon annan.
2. Beställningen görs i ärendehanteringssystemet med en mall per typ: ny eller uppdaterad övrig miljö, behörighetsändring, rapport eller uttag, utbildning.
3. Driftleverantören bekräftar, planerar och genomför, och återrapporterar när beställningen är klar.

Servicenivåer ur DU2: en uppdaterad övrig miljö inom 10 vardagar och en ny övrig miljö inom 30 vardagar från beställningen. I Vårdkällan skapar en systemförvaltare acceptanstest-, utbildnings- och testmiljöer ur produktionsmiljön, där acceptanstestmiljön har avidentifierade patientuppgifter (KD1.3.6.2).

## Övriga processer

Utöver de fem processerna föreslås att handboken innehåller följande, för att reglera gränsytan mellan parterna (KD1.3.7.1).

| Process | Varför |
| --- | --- |
| Tjänstenivåhantering (Service Level Management) | Servicenivåerna följs upp varje månad, se Servicenivåer. |
| Övervakning och händelsehantering (Monitoring and Event Management) | Larm från driftens övervakning blir incidenter med rätt prioritet. |
| Kapacitet och prestanda (Capacity and Performance Management) | Svarstider mot referensnivån och lagringsprognosen. |
| Tillgänglighet (Availability Management) | Tillgängligheten räknas varje månad ur incidentregistret. |
| Kontinuitet (Service Continuity Management) | Se Kontinuitetsplan och Återställning efter haveri. |
| Informationssäkerhet (Information Security Management) | Säkerhetsincidenter, personuppgiftsincidenter, säkerhetsloggen och säkerhetsuppdateringar. |
| Konfigurationshantering (Service Configuration Management) | Vilken version, vilka parametrar och vilka miljöer som finns. |
| Leverantörsstyrning (Supplier Management) | Underleverantörer för drift, nät och lagring. |
| Kunskapshantering (Knowledge Management) | Kända fel, vägar runt felen och svar till första linjen. |
| Ständig förbättring (Continual Improvement) | Förbättringar ur incidenttrender, synpunkter och uppföljningsmöten. |

## ITIL v3/2011 och ITIL 4

Kraven säger ITIL minst version 3/2011. ITIL v3/2011 beskriver processer i fem böcker om tjänstens livscykel, och ITIL 4 beskriver praktiker. Tabellen visar var processerna i handboken finns i båda.

| Bok i ITIL v3/2011 | Process i ITIL v3/2011 | Praktik i ITIL 4 | I handboken |
| --- | --- | --- | --- |
| Tjänstestrategi (Service Strategy) | Ekonomistyrning, portfölj, efterfrågan och affärsrelationer (Financial, Portfolio, Demand and Business Relationship Management) | Ekonomistyrning, portfölj och relationer (Service Financial, Portfolio and Relationship Management) | Samverkansmodell |
| Tjänstedesign (Service Design) | Tjänstenivåhantering (Service Level Management) | Tjänstenivåhantering (Service Level Management) | Servicenivåer |
| Tjänstedesign | Kapacitet (Capacity Management) | Kapacitet och prestanda (Capacity and Performance Management) | Övriga processer |
| Tjänstedesign | Tillgänglighet (Availability Management) | Tillgänglighet (Availability Management) | Servicenivåer |
| Tjänstedesign | Kontinuitet (IT Service Continuity Management) | Kontinuitet (Service Continuity Management) | Kontinuitetsplan |
| Tjänstedesign | Informationssäkerhet (Information Security Management) | Informationssäkerhet (Information Security Management) | Övriga processer |
| Tjänstedesign | Leverantörsstyrning (Supplier Management) | Leverantörsstyrning (Supplier Management) | Övriga processer |
| Tjänsteövergång (Service Transition) | Ändringshantering (Change Management) | Ändringsstyrning (Change Enablement) | Ändringshantering |
| Tjänsteövergång | Release och driftsättning (Release and Deployment Management) | Releasehantering och driftsättning (Release Management, Deployment Management) | Releasehantering |
| Tjänsteövergång | Konfiguration (Service Asset and Configuration Management) | Konfiguration och tillgångar (Service Configuration Management, IT Asset Management) | Övriga processer |
| Tjänsteövergång | Validering och test (Service Validation and Testing) | Validering och test (Service Validation and Testing) | Releasehantering |
| Tjänsteövergång | Kunskapshantering (Knowledge Management) | Kunskapshantering (Knowledge Management) | Övriga processer |
| Tjänstedrift (Service Operation) | Incidenthantering (Incident Management) | Incidenthantering (Incident Management) | Incidenthantering |
| Tjänstedrift | Problemhantering (Problem Management) | Problemhantering (Problem Management) | Problemhantering |
| Tjänstedrift | Beställningshantering (Request Fulfilment) | Tjänstebeställningar (Service Request Management) | Beställningshantering |
| Tjänstedrift | Händelsehantering (Event Management) | Övervakning och händelsehantering (Monitoring and Event Management) | Övriga processer |
| Tjänstedrift | Åtkomsthantering (Access Management) | Informationssäkerhet (Information Security Management) | Övriga processer |
| Tjänstedrift | Kundsupport som funktion (Service Desk) | Kundsupport som praktik (Service Desk) | Support |
| Ständig tjänsteförbättring (Continual Service Improvement) | Förbättring i sju steg (Seven-Step Improvement) | Ständig förbättring (Continual Improvement) | Övriga processer |

## Så hålls handboken uppdaterad

Driftleverantören ansvarar för att handboken hålls uppdaterad under hela avtalsperioden. Varje ändring överenskoms skriftligen med beställaren innan den börjar gälla (KD1.3.1.2).

1. Handboken tas fram under implementationsfasen i arbetsmöten med varje beställare, en process i taget, med utkast från driftleverantören. Beställarens insats begränsas till att granska och komma överens, eftersom utkastet utgår från detta dokument (KD1.3.1.3).
2. Varje process har en ägare hos driftleverantören och en kontaktperson hos beställaren.
3. Förslag till ändringar samlas löpande och tas upp på det taktiska förvaltningsmötet.
4. En ändring gäller från det datum som står i den skriftliga överenskommelsen. Versionen och ändringshistoriken står först i handboken.
5. Hela handboken granskas minst [fyll i: hur ofta, förslag en gång per år].

## Det systemet redan har som stöd

- Incidentregistret och servicenivårapporten i vyn Servicenivåer och incidenter (`#/servicenivaer`, `servicenivaer.js`): prioriteten ur två frågor, tidsgränser per prioritet, påminnelsen om större incident efter 2 timmar och kravet på orsak, konsekvens, åtgärd och förebyggande innan prioritet 1 och 2 kan avslutas. Rutterna är `GET /api/servicenivaer/incidenter`, `POST /api/servicenivaer/incidenter`, `POST /api/servicenivaer/incidenter/:id/avsluta` och `POST /api/servicenivaer/incidenter/:id/uppfoljning`.
- Uppgraderingar med migreringar som går att backa, godkännande av två systemförvaltare, stopp när testerna i bygget inte är gröna och återgång till förra versionen ([`app/src/releaser.js`](../../app/src/releaser.js), vyn `#/uppgraderingar`).
- Vad en version ändrar: nyheterna per version och roll ([`app/src/nyheter.json`](../../app/src/nyheter.json)) och ändringsloggen för API:t ([`app/src/api-andringar.js`](../../app/src/api-andringar.js)).
- Regler och parametrar med giltighetsdatum, förhandsvisning och fyra ögon ([`app/src/konfiguration.js`](../../app/src/konfiguration.js)).
- Acceptanstest-, utbildnings- och testmiljöer ur produktionsmiljön ([`app/src/miljoer.js`](../../app/src/miljoer.js)).
- Testmetoden och testerna som bygget kräver ([`app/src/testmetod.js`](../../app/src/testmetod.js), [`docs/testmetod.md`](../testmetod.md)).
- Åtkomstloggen och säkerhetsloggen med hashkedjor, där uppgraderingar, återgångar och ändrade inställningar loggas ([`app/src/logg.js`](../../app/src/logg.js), [`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js)).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Driftleverantör | [fyll i: organisation] |
| Beställare som handboken gäller | [fyll i: region eller regioner] |
| Ansvarig för helheten | [fyll i: roll och kontaktväg] |
| Driftleverantörens kontaktpunkt för incidenter | [fyll i: roll, telefon och funktionsadress, dygnet runt] |
| Beställarens kontaktpunkt för incidenter | [fyll i: roll och kontaktväg dygnet runt] |
| Ändringsansvarig hos beställaren | [fyll i: roll] |
| Ändringsrådets möten | [fyll i: veckodag och tid, förslag varje vecka] |
| Behöriga beställare | [fyll i: hänvisning till beställarens skriftliga förteckning] |
| Mallar för standardändringar | [fyll i: förteckning över ändringstyper] |
| Klassificering av problem | [fyll i: överenskommen standard] |
| Intervall för lägesrapporter vid större incident | [fyll i: minuter] |
| Ärendehanteringssystem | [fyll i: system och hur beställaren får åtkomst] |
| Handbokens version och datum för senaste överenskommelse | [fyll i: version och datum] |

## Förkortningar

- API: gränssnitt för program (application programming interface)
- CAB: ändringsrådet där beställaren och leverantören beslutar om ändringar (Change Advisory Board)
- IT: informationsteknik, datorer, nät och program
- ITIL: ett ramverk för hantering av IT-tjänster (Information Technology Infrastructure Library)
- RFC: en registrerad begäran om ändring (Request for Change)
- SPOC: en enda kontaktpunkt för en fråga, till exempel incidenter (Single Point of Contact)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
