// Runda 14, r5: driftdokumenten, del 1: processer, servicenivåer, kontinuitet och support (docs/drift/). Skrivs till
// docs/drift/ av scripts/dokument-md.js genom driftdokument.js.
export const DOKUMENT = [
  {
    fil: 'processhandbok.md',
    rubrik: 'Processhandbok',
    sammanfattning: 'Processerna för incidenter, problem, ändringar, releaser och beställningar enligt ITIL, med roller för driftleverantören och beställaren, att ta över och komma överens om.',
    sussa: ['KD1.3.1.1', 'KD1.3.1.2', 'KD1.3.1.3', 'KD1.3.2.1', 'KD1.3.2.2', 'KD1.3.2.3', 'KD1.3.2.4', 'KD1.3.3.1', 'KD1.3.3.2', 'KD1.3.4.1', 'KD1.3.4.2', 'KD1.3.5.1', 'KD1.3.5.2', 'KD1.3.6.1', 'KD1.3.6.2', 'KD1.3.7.1', 'KD1.2.1.4', '12.1.1.2'],
    text: `## Syfte och omfattning

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

Vid prioritet 1 och 2 redogör driftleverantören för incidenten, dess konsekvenser, orsaken och vad som har gjorts och ska göras för att samma typ av incident inte ska hända igen. Underlaget är det som skrevs när incidenten avslutades i incidentregistret. Mötet registreras sedan på incidenten i registret, med datum och deltagare, så att servicenivårapporten visar att uppföljningen är gjord.

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

- Incidentregistret och servicenivårapporten i vyn Servicenivåer och incidenter («#/servicenivaer», «servicenivaer.js»): prioriteten ur två frågor, tidsgränser per prioritet, påminnelsen om större incident efter 2 timmar och kravet på orsak, konsekvens, åtgärd och förebyggande innan prioritet 1 och 2 kan avslutas. Rutterna är «GET /api/servicenivaer/incidenter», «POST /api/servicenivaer/incidenter», «POST /api/servicenivaer/incidenter/:id/avsluta» och «POST /api/servicenivaer/incidenter/:id/uppfoljning».
- Uppgraderingar med migreringar som går att backa, godkännande av två systemförvaltare, stopp när testerna i bygget inte är gröna och återgång till förra versionen («app/src/releaser.js», vyn «#/uppgraderingar»).
- Vad en version ändrar: nyheterna per version och roll («app/src/nyheter.json») och ändringsloggen för API:t («app/src/api-andringar.js»).
- Regler och parametrar med giltighetsdatum, förhandsvisning och fyra ögon («app/src/konfiguration.js»).
- Acceptanstest-, utbildnings- och testmiljöer ur produktionsmiljön («app/src/miljoer.js»).
- Testmetoden och testerna som bygget kräver («app/src/testmetod.js», «docs/testmetod.md»).
- Åtkomstloggen och säkerhetsloggen med hashkedjor, där uppgraderingar, återgångar och ändrade inställningar loggas («app/src/logg.js», «app/src/sakerhetslogg.js»).

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
`,
  },
  {
    fil: 'servicenivaer.md',
    rubrik: 'Servicenivåer',
    sammanfattning: 'Regler och anvisningar för servicenivåhantering, mall för servicenivåavtal och månadsrapport, och hur referensnivån för svarstider tas fram och följs upp.',
    sussa: ['KD1.2.1.1', 'KD1.2.1.2', 'KD1.2.1.3', 'KD1.2.1.5'],
    text: `## Regler och anvisningar för servicenivåhantering

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

Driftleverantören övervakar och rapporterar servicenivåutfallet till beställaren varje månad (KD1.2.1.2). Systemet räknar rapporten med «GET /api/servicenivaer/rapport?manad=ÅÅÅÅ-MM». Rubrikerna i rapporten och källan till varje mått:

| Rubrik | Mått | Källa i systemet |
| --- | --- | --- |
| Incidenter | Antal per prioritet, åtgärdstid per incident och total åtgärdstid per prioritet | Incidentregistret |
| Överskridanden | Incidenter över max åtgärdstid, och antal och total tid mot årets gränsvärden | Incidentregistret, året hittills |
| Uppföljning | Incidenter av prioritet 1 och 2 och om uppföljningsmötet är registrerat | Incidentregistret |
| Rapportering till beställaren | Om varje incident rapporterades inom sin tidsgräns | Incidentregistret, se Incidentrapportering |
| Tillgänglighet | Andelen av månadens minuter utan pågående incident av prioritet 1 | Incidentregistret |
| Svarstider | p95 per adress i API:t mot målet 200 ms | Mätningen i servern, «GET /api/drift» |
| Säkerhetskopior | Senaste kopian och om den är verifierad på båda platserna | «app/src/sakerhetskopior.js» |
| Säkerhetsloggen | Om hashkedjan håller | «app/src/sakerhetslogg.js» |
| Problem och ändringar | Öppna problem, genomförda ändringar och releaser | [fyll i: driftleverantörens ärendehanteringssystem] |
| Kundsupport | Medelsvarstid i telefon och webbportal, lösningsgrad | [fyll i: driftleverantörens telefoni och ärendehanteringssystem] |

Svarstiderna i servern mäts sedan servern startade, över de senaste svaren per adress. En omstart under månaden gör att mätningen börjar om. Driftleverantören sparar därför mätningen [fyll i: hur ofta, förslag varje dygn] eller mäter med en egen klient, se nedan.

## Referensnivå för svarstider

Driftleverantören och beställaren fastställer under grundimplementationen en referensnivå (baseline) för accepterade svarstider. Svarstiden mäts från och till en klient placerad vid överlämningspunkten (CPE), alltså där beställarens nät tar vid. Efter driftstart mäts och rapporteras svarstiderna varje månad, och en negativ avvikelse från referensnivån hanteras som en incident (KD1.2.1.3).

1. Välj mätobjekten: de vanliga åtgärderna i vården, till exempel inloggning, arbetslistan, sökning, översikten, journalen, läkemedlen och registrering av ett mätvärde. Lasttestet («app/scripts/lasttest.js») spelar just de flödena och kan användas som mall.
2. Mät i servern: varje svar har rubriken «Server-Timing» med tiden i servern, och «GET /api/drift» visar p50 och p95 per adress och om målet 200 ms för p95 hålls.
3. Mät vid överlämningspunkten: en klient placerad vid överlämningspunkten kör samma flöden med jämna mellanrum och mäter hela tiden från klienten. Skillnaden mot tiden i servern är nätets och lastbalanseringens del.
4. Kör lasttestet med det antal samtidiga användare som avtalet gäller, i den driftmiljö som ska användas. Resultatet («app/lasttest.json») gäller bara den kod som det kördes mot.
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

- Servicenivårapporten per månad, räknad ur incidentregistret, svarstiderna, säkerhetskopiorna och säkerhetsloggens kedja («servicenivaer.js», «GET /api/servicenivaer/rapport?manad=ÅÅÅÅ-MM», vyn «#/servicenivaer»).
- Incidentregistret med prioritet ur två frågor och gränsvärdena ur DU2.
- Svarstider per adress med p95 mot målet 200 ms och rubriken «Server-Timing» på varje svar («GET /api/drift», «app/src/server.js»).
- Lasttestet för 100 och 500 samtidiga användare med realistiska flöden och betänketid («app/scripts/lasttest.js», «docs/design.md» avsnittet om lasttest).
- Säkerhetskopior verifierade på två platser («app/src/sakerhetskopior.js») och säkerhetsloggens hashkedja («app/src/sakerhetslogg.js»).

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
`,
  },
  {
    fil: 'incidentrapportering.md',
    rubrik: 'Incidentrapportering',
    sammanfattning: 'Rutin för hur incidenter rapporteras till beställaren, med ett förslag till anvisning, vad exporten innehåller och vem som gör vad.',
    sussa: ['5.3.1.14'],
    text: `## Bakgrund

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

Incidentrapporten till beställaren tas ut med «POST /api/servicenivaer/export», där kroppen har «fran» och «till» som ÅÅÅÅ-MM-DD. Exporten

- innehåller incidenterna i perioden med prioritet, om det är en säkerhetsincident eller personuppgiftsincident, tider, tidsgränsen för rapportering och om den hölls, och för avslutade incidenter orsak, konsekvens, åtgärd och vad som görs för att det inte ska hända igen,
- innehåller säkerhetsloggens händelser i perioden räknade per typ, inte raderna själva,
- har inga patientuppgifter och inga personers namn,
- markerar incidenterna som rapporterade, så att registret visar vad beställaren har fått,
- loggas i säkerhetsloggen med vem som tog ut den och för vilken period.

Exporten är en åtgärd och inte en läsning, eftersom den ändrar incidenternas status och loggas. Den som bara vill se registret läser det med «GET /api/servicenivaer/incidenter».

## Det beställaren behöver för en anmälan till IMY

Exporten ger underlaget om incidenten. För en anmälan behöver vårdgivaren också veta vilka patienter och vilka uppgifter som berörs. Det tas fram ur åtkomstloggen av vårdgivarens egen logggranskare, med den behörighet som krävs för det, och lämnas aldrig ut av driftleverantören.

## Det systemet redan har som stöd

- Incidentregistret med tidsgräns för rapportering per incident och markering av personuppgiftsincidenter («servicenivaer.js», «GET /api/servicenivaer/incidenter», «POST /api/servicenivaer/incidenter»).
- Exporten till beställaren utan patientuppgifter och personnamn, som markerar incidenterna som rapporterade och loggas («POST /api/servicenivaer/export»).
- Säkerhetsloggen med hashkedja, där inloggningar, misslyckade inloggningar, avvisade anrop, ändrade behörigheter och inställningar och export av loggen loggas («app/src/sakerhetslogg.js»).
- Åtkomstloggen med hashkedja för logggranskningen när en personuppgiftsincident ska utredas («app/src/logg.js»).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Beställarens anvisning | [fyll i: beslut och datum, eller att förslaget ovan gäller] |
| Beställarens kontaktpunkt för incidenter | [fyll i: telefon och funktionsadress dygnet runt] |
| Vårdgivarens dataskyddsombud | [fyll i: funktionsadress] |
| Driftleverantörens incidentansvarig | [fyll i: roll och kontaktväg] |
| Hur filen skickas | [fyll i: säker kanal till beställaren] |
| Tidsgränser som avviker från förslaget | [fyll i: prioritet och tid] |
`,
  },
  {
    fil: 'kontinuitetsplan.md',
    rubrik: 'Kontinuitetsplan',
    sammanfattning: 'Hur tillgången till informationen säkras för vården vid avbrott: läsläget, skrivkön, säkerhetskopiorna och systemets beteende när integrerade system inte svarar, med riskanalys, scenarier, roller och övningar.',
    sussa: ['5.3.1.15', 'KD1.1.1.11'],
    text: `## Syfte

Kontinuitetsplanen ska säkerställa att vården har tillgång till informationen också när tjänsten störs (5.3.1.15). Planen beskriver vad systemet gör själv, vad den som driver systemet ska göra och vad verksamheten gör. Den ska övas och hållas aktuell.

## Det som skyddar informationen när servern inte svarar

**Läsläget.** När någon är inloggad bygger servern en läskopia med arbetslistan och, för patienterna på den och de patienter personen har öppnat, patienthuvudet, översikten, läkemedlen, mätvärdena, remisserna och de senaste anteckningarna. Kopian har samma behörighetskontroll som de vanliga anropen, och spärrar, inre sekretess och skyddad identitet gäller. Webbläsaren sparar kopian krypterad. Kopian förnyas av sig själv medan personen är inloggad, så att läkemedelsuppgifterna är högst 10 minuter gamla när ett avbrott börjar. Svarar inte servern läser gränssnittet ur kopian, visar hur gamla uppgifterna är och varnar när läkemedelsuppgifterna är äldre än 10 minuter. Varje läsning i läsläget loggas och förs över till åtkomstloggen när servern svarar igen («app/public/js/lasekopia.js», «GET /api/lasekopia», «docs/design.md» avsnittet Läsläge vid avbrott).

**Reservinloggning.** Den inloggade kan välja en reservkod, så att läsläget kan öppnas också i en ny flik eller efter en omstart av webbläsaren under avbrottet. Reservkopian gäller högst 8 timmar från inloggningen.

**Skrivkön.** Under avbrottet kan personalen ge en ordinerad dos och registrera ett mätvärde för patienterna i läskopian. Registreringen sparas krypterad i webbläsaren, märks som inte sparad i journalen och skickas när servern svarar igen. Servern sparar den med samma kontroller som vanligt och med tiden då den gjordes. Har någon annan gett samma dos eller har ordinationen ändrats blir det en konflikt som personen löser («app/src/skrivko.js»).

**Säkerhetskopiorna.** Systemet tar en kopia av databasen var femtonde minut när något har ändrats och skriver den på två platser, där den verifieras. Se Återställning efter haveri.

Begränsningar: läskopian innehåller inte hela journalen, under avbrottet går bara doser och mätvärden att registrera, och läsläget förutsätter att personen var inloggad på datorn innan avbrottet. Läsläget ersätter inte en reservrutin på papper för längre avbrott.

## Systemet när integrerade system inte svarar

Kärnsystemet ska fungera med begränsad funktionalitet när integrerade system är otillgängliga, med särskild hänsyn till felhanteringen i synkrona integrationer (KD1.1.1.11). Det här är vad koden gör i dag:

| Integration | När den inte svarar | Fil |
| --- | --- | --- |
| Nationella läkemedelslistan (NLL) | Ordinationen sparas och gäller i journalen. Får överföringen inget svar i tid blir statusen okänd och kontrolleras genom avstämning, som frågar igen eller skickar på nytt. Ett felsvar visas och avstämningen skickar ordinationen igen. En lyckad förskrivning döljs aldrig. | «app/src/lakemedel.js» |
| Prenumerationer till externa system | Meddelandet sparas som väntande när ändringen har sparats och skickas sedan med en tidsgräns på 5 sekunder. En mottagare som inte svarar påverkar inte journalen, och meddelandet sparas som misslyckat. | «app/src/prenumeration.js» |
| Laboratoriernas system | Beställningarna läggs i laboratoriets utkorg och hämtas av laboratoriets system. Ett laboratorium som inte svarar stoppar inte beställningen i journalen. | «app/src/produktionssystem.js» |
| Masterdata från externa källor | En källa som inte svarar ändrar ingenting. De senast giltiga uppgifterna används, och översikten säger från när de är. | «app/src/masterdata.js» |
| Inloggningstjänsten | Inloggningen i systemet beror inte på en extern tjänst i dag, eftersom kortet är simulerat. En reservväg för inloggning när den nationella inloggningstjänsten inte svarar är inte byggd och ska finnas i driftens plan. | «docs/design.md» |

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

- Läsläget med krypterad läskopia, reservinloggning och loggning av läsningarna («app/public/js/lasekopia.js», «docs/api-avvikelser.md»).
- Skrivkön för doser och mätvärden under avbrott («app/src/skrivko.js»).
- Säkerhetskopior på två platser med verifiering och återställning till en tidpunkt («app/src/sakerhetskopior.js»).
- Felhanteringen mot NLL, prenumerationerna, laboratoriernas system och masterdata («app/src/lakemedel.js», «app/src/prenumeration.js», «app/src/produktionssystem.js», «app/src/masterdata.js»).
- Återgång till förra versionen («app/src/releaser.js»).

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
`,
  },
  {
    fil: 'aterstallning.md',
    rubrik: 'Återställning efter haveri',
    sammanfattning: 'Plan, process och verktyg för att återställa systemet efter ett haveri, med säkerhetskopiering, provåterläsning och förslag till återställningstid och högsta dataförlust.',
    sussa: ['5.3.1.16', 'KD1.1.3.1', 'KD1.1.3.2'],
    text: `## Syfte

Den som driver systemet ska ha en plan, en process och verktyg för att återställa efter ett systemhaveri (5.3.1.16), tillhandahålla den datalagring som krävs (KD1.1.3.1) och utföra och ansvara för säkerhetskopieringen (KD1.1.3.2). Dokumentet beskriver vad systemet gör själv och vad driften måste lägga till.

## Mål för återställningen

| Mål | Förslag | Grund för förslaget |
| --- | --- | --- |
| Längsta tid till återställd tjänst (RTO) | [fyll i: tid, förslag 2 timmar] | Max åtgärdstid för prioritet 1 i DU2 |
| Högsta dataförlust (RPO) | [fyll i: tid, förslag 15 minuter] | Systemet tar en kopia var femtonde minut när något har ändrats |
| Hur länge kopior sparas | [fyll i: tid, förslag 30 dagar för dygnskopior och 1 år för månadskopior] | Systemet sparar själv de åtta senaste kopiorna, alltså omkring två timmar bakåt när databasen ändras hela tiden |

Det som registreras i läsläget under ett avbrott (doser och mätvärden i skrivkön) finns kvar i webbläsarna och skickas när servern svarar, också efter en återställning.

## Säkerhetskopieringen i systemet

- Servern tar en konsistent ögonblicksbild av databasen var femtonde minut när något har ändrats («KOPIOR_MINUTER»), och före varje återställning och återgång. En systemförvaltare kan också ta en kopia när som helst.
- Kopian skrivs på två platser («KOPIOR_KATALOG» och «KOPIOR_ANDRA») och verifieras på båda: kontrollsumman ska vara densamma som för ögonblicksbilden, och kopian läst från platsen ska vara en hel databas med alla tabeller och med hela hashkedjor i åtkomstloggen och säkerhetsloggen.
- Kopiorna är komprimerade och ligger under en nyckel som inte avslöjar vilken databas de hör till. Nyckeln sparas bredvid kopiorna.
- I driften ska den andra platsen vara en annan volym på en annan ort. Det väljer den som driver systemet med «KOPIOR_ANDRA».

## Återställning till en tidpunkt

1. En systemförvaltare väljer en tidpunkt i vyn Lagring.
2. Systemet tar den senaste verifierade kopian före tidpunkten och läser den från den andra platsen om den första är skadad.
3. Systemet visar vad som går förlorat, och en andra systemförvaltare godkänner i sin egen inloggning (fyra ögon).
4. Läget före återställningen sparas först som en kopia, så att återställningen går att göra ogjord.
5. Raderna i åtkomstloggen och säkerhetsloggen som har skrivits efter kopian förs över till den återställda databasen, så att inga loggar går förlorade. Registrerade faktorer för inloggning förs också över.
6. Alla loggas ut och loggar in på nytt.

Det som gjordes mellan kopian och tidpunkten, högst femton minuter, återställs inte.

## Provåterläsning

En systemförvaltare kan göra en provåterläsning i vyn Lagring: systemet tar en kopia, läser in den i en ny databas och jämför tabeller, antal rader och loggarnas hashkedjor. Resultatet sparas utan patientuppgifter, med tid, storlek och kontrollsumma («app/src/lagring.js», «POST /api/lagring/prov»).

| Prov | Hur ofta | Vem |
| --- | --- | --- |
| Provåterläsning i systemet | [fyll i: förslag varje vecka] | Systemförvaltare |
| Återställning till en tidpunkt i acceptanstestmiljön | [fyll i: förslag varje kvartal] | Systemförvaltare och driftleverantören |
| Återuppbyggnad av hela tjänsten på en ny server | [fyll i: förslag en gång per år] | Driftleverantören |

## Haveri av hela servern

Systemets egna kopior skyddar mot skadad databas och fel i en version. Ett haveri av hela servern eller datahallen kräver driftens egen plan:

1. Bekräfta haveriet och starta processen för större incident.
2. Starta avbildningen av den version som var i drift på en ny server. Varje version är en egen avbildning, byggd ur samma källkod, och bygget stoppas om ett test är rött («app/Dockerfile»).
3. Gör kopiorna från den andra platsen och nyckeln till dem tillgängliga för den nya servern.
4. Läs in den senaste verifierade kopian och kontrollera den med en provåterläsning.
5. Kontrollera att versionen och schemaversionen stämmer i «GET /api/health» och vyn Uppgraderingar.
6. Låt användarna logga in. Skrivköerna i webbläsarna skickas och loggarna från läsläget förs över.
7. Rapportera till beställaren och boka ett uppföljningsmöte.

Att bygga upp hela tjänsten på en ny server från kopiorna på den andra platsen är inte prövat i systemets tester. Den som driver systemet ska ta fram de exakta stegen för sin miljö och öva dem.

## Datalagringen

Driftleverantören tillhandahåller lagringen: databasen, säkerhetskopiorna på två platser, driftens egna kopior med längre lagringstid och lagringen för bilder och media. Vyn Lagring visar storleken, en prognos ett, tre och tio år framåt och storleken på kopiorna, och kan ta ut en huvudmans uppgifter för sig.

## Det systemet redan har som stöd

- Säkerhetskopior på två platser med verifiering, återställning till en tidpunkt med fyra ögon och läsning från den andra platsen när den första är skadad («app/src/sakerhetskopior.js», «docs/design.md» avsnittet Uppgraderingar med återgång och säkerhetskopior).
- Provåterläsning och lagringsprognos («app/src/lagring.js»).
- Migreringar som går att backa, så att en äldre version kan starta mot databasen («app/src/releaser.js»).
- Loggarna med hashkedjor, som kontrolleras i varje kopia («app/src/logg.js», «app/src/sakerhetslogg.js»).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Längsta tid till återställd tjänst (RTO) | [fyll i: tid] |
| Högsta dataförlust (RPO) | [fyll i: tid] |
| Första platsen för kopiorna | [fyll i: volym] |
| Andra platsen för kopiorna | [fyll i: volym på annan ort] |
| Driftens egna kopior med längre lagringstid | [fyll i: hur ofta, var och hur länge] |
| Förvaring av nyckeln till kopiorna | [fyll i: var och vem som har åtkomst] |
| Reservserver | [fyll i: var och hur den startas] |
| Senaste övade återuppbyggnad | [fyll i: datum och resultat] |
`,
  },
  {
    fil: 'sakerhetsuppdateringar.md',
    rubrik: 'Säkerhetsuppdateringar och underhåll',
    sammanfattning: 'Hur systemet och plattformen hålls säkerhetsuppdaterade, hur planerat underhåll görs med så lite avbrott som möjligt, och hur uppdateringarna förhåller sig till CE-märkningen.',
    sussa: ['5.3.1.11', 'KD1.1.1.6', 'KD1.1.1.12'],
    text: `## Syfte

Säkerhetsuppdateringar ska göras kontinuerligt i systemet och tillåtas i de underliggande plattformarna med bibehållen CE-märkning (5.3.1.11). Tekniskt underhåll, releaser och versionsbyten ska göras så att otillgänglighet och andra störningar för användarna blir så korta och så sällan som möjligt (KD1.1.1.6), och planerat underhåll ska göras med bibehållen tillgänglighet och prestanda (KD1.1.1.12).

## Vad som behöver uppdateras

| Del | Vad den är | Hur den uppdateras |
| --- | --- | --- |
| Vårdkällans kod | Källkoden i «app/src» och «app/public» | Ny version genom releasehanteringen |
| Beroenden i koden | Systemet har inga externa paket. Koden använder bara det som körmiljön har inbyggt («app/package.json») | Ingen egen åtgärd utöver körmiljön |
| Körmiljön | Bun, i en bestämd version i avbildningen («app/Dockerfile») | Ny version av Bun i Dockerfile, därefter en ny version av Vårdkällan |
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
- Avbildningen har en hälsokontroll mot «GET /api/health», så att driften ser när en ny version är redo.
- När servern inte svarar under en omstart arbetar användarna i läsläget och kan ge doser och registrera mätvärden i skrivkön, som skickas när servern svarar igen.
- Användarna får nyheterna för sin roll efter en uppgradering, så att ändrade arbetssätt syns direkt.

Det här har systemet inte: en växling mellan två servrar utan avbrott. Ett versionsbyte kräver i dag en omstart av servern, och under den svarar inte servern. Den som driver systemet ska

1. lägga planerat underhåll i ett servicefönster som beställaren godkänner, [fyll i: tid, förslag en natt mellan 01 och 04 när få arbetar],
2. meddela verksamheten [fyll i: antal dagar] i förväg,
3. mäta hur lång tid omstarten tar i den egna miljön och redovisa den i månadsrapporten,
4. pröva om en andra server med växling i lastbalanseringen behövs för att hålla tillgängligheten.

## CE-märkningen

Vissa moduler i Vårdkällan är enligt projektets egen bedömning medicintekniska produkter enligt förordningen om medicintekniska produkter (MDR), till exempel varningarna vid ordination och dosberäkningen av cytostatika. Bedömningen står i «docs/mdr-bedomning.md» med filerna per modul. Demon är inte CE-märkt. Den som släpper systemet för användning i vården blir tillverkare och ansvarar för CE-märkningen.

För att en säkerhetsuppdatering inte ska riskera märkningen:

1. Varje ändring jämförs med filerna för de medicintekniska modulerna i bedömningen. En uppdatering av körmiljön, basavbildningen eller plattformen som inte ändrar dessa filer eller deras funktion dokumenteras som en ändring utan påverkan på den medicinska funktionen.
2. En ändring i en medicinteknisk modul bedöms enligt tillverkarens kvalitetsledningssystem innan den släpps.
3. Testerna i bygget är en del av verifieringen. Testmetoden står i «docs/testmetod.md».
4. Tillverkaren dokumenterar i förväg vilka slags plattformsuppdateringar som är tillåtna utan ny bedömning.

## Det systemet redan har som stöd

- Uppgraderingar med migreringar som går att backa, godkännande av två systemförvaltare, stopp när testerna inte är gröna och återgång («app/src/releaser.js», vyn «#/uppgraderingar»).
- Bygget som kör alla tester och stoppas om ett test är rött («app/Dockerfile», «app/src/testmetod.js»).
- Inga externa paket i koden («app/package.json»), så att sårbarheter i beroenden bara kan komma från körmiljön och plattformen.
- Läsläget och skrivkön under en omstart («app/public/js/lasekopia.js», «app/src/skrivko.js»).
- Nyheterna per version och ändringsloggen för API:t («app/src/nyheter.json», «app/src/api-andringar.js»).
- MDR-bedömningen per modul med filerna («app/src/mdr-bedomning.js»).

## Att fylla i för den som driver systemet

| Fält | Värde |
| --- | --- |
| Källor för säkerhetsmeddelanden | [fyll i: förteckning] |
| Tidsgränser per allvarlighetsgrad | [fyll i: tider] |
| Servicefönster | [fyll i: dag och tid, godkänt av beställaren] |
| Uppmätt tid för omstart | [fyll i: sekunder] |
| Tillverkare enligt MDR | [fyll i: organisation] |
| Tillåtna plattformsuppdateringar utan ny bedömning | [fyll i: hänvisning till tillverkarens dokument] |
`,
  },
  {
    fil: 'support.md',
    rubrik: 'Support',
    sammanfattning: 'Upplägg för support dygnet runt i nivåer, ärendehantering och beställarens åtkomst, språkkrav och servicenivåerna för support, och vad systemet har som stöd.',
    sussa: ['12.3.1.1', '12.3.1.2', '12.3.1.3', '12.3.1.4', '12.3.1.5'],
    text: `## Support kräver en ansvarig organisation

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

- Synpunkter från varje vy, där systemet själv fyller i vy, roll, version och skärmbredd. Funktionen är byggd för testinbjudan och läses av testledaren («app/src/synpunkter.js»). Den kan användas som kanal för förbättringsförslag, men den är inget ärendehanteringssystem.
- Ärenden om det öppna API:t mellan kund och utvecklare: begäran om ny informationsmängd, frågor och fel, med svar och statuskedja. Systemet säger själv om det som begärs redan finns i API:t («app/src/api-forvaltning.js», «GET /api/oppet-api/arenden», «POST /api/oppet-api/arenden»).
- Incidentregistret, som supporten registrerar incidenter i («servicenivaer.js», «POST /api/servicenivaer/incidenter»).
- Utbildningsmiljön med fiktiva patienter för att lösa handhavandefrågor utan att öppna riktiga journaler («app/src/miljoer.js»).
- Övningar med intyg och nyheterna per version och roll («app/src/utbildning.js», «app/src/nyheter.json»).
- Åtkomstloggen, som visar varje gång supporten öppnar uppgifter om en patient («app/src/logg.js»).

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
`,
  },
  {
    fil: 'samverkansmodell.md',
    rubrik: 'Samverkansmodell',
    sammanfattning: 'Samverkansmodell och samverkansorganisation på strategisk, taktisk och operativ nivå, landstingsgemensamt och per region, med forum, roller och förändringsarbetet i samarbete.',
    sussa: ['9.1.1.1', '9.1.1.2', '9.1.1.3', '11.1.1.1', '11.1.1.2', '11.2.1.2', '11.2.1.3'],
    text: `## Syfte

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

- Användartester och Sussas testfall som automatiska tester, och testinbjudan med synpunkter från varje vy («app/src/anvandartest.js», «app/src/synpunkter.js»).
- Nyheterna per version och roll, som visar vad varje release ändrar för varje yrke («app/src/nyheter.json»).
- Övningar med intyg per roll («app/src/utbildning.js»).
- Utbildnings-, test- och acceptanstestmiljöer ur produktionsmiljön («app/src/miljoer.js»).
- Testmetoden («docs/testmetod.md», «app/src/testmetod.js»).
- Servicenivårapporten per månad som underlag till förvaltningsmötena («servicenivaer.js»).
- Ärenden om det öppna API:t mellan kund och utvecklare («app/src/api-forvaltning.js»).

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
`,
  },
];
// Förkortningar som används i texterna, med förklaring på svenska.
export const FORKORTNINGAR = {
  ITIL: 'ett ramverk för hantering av IT-tjänster (Information Technology Infrastructure Library)',
  SLA: 'servicenivåavtal, de avtalade servicenivåerna (Service Level Agreement)',
  CPE: 'utrustningen vid överlämningspunkten där beställarens nät tar vid (Customer Premises Equipment)',
  IMY: 'Integritetsskyddsmyndigheten, tillsynsmyndighet för dataskyddsförordningen',
  IT: 'informationsteknik, datorer, nät och program',
  CAB: 'ändringsrådet där beställaren och leverantören beslutar om ändringar (Change Advisory Board)',
  SPOC: 'en enda kontaktpunkt för en fråga, till exempel incidenter (Single Point of Contact)',
  RFC: 'en registrerad begäran om ändring (Request for Change)',
  RTO: 'den längsta tid det får ta att återställa tjänsten efter ett haveri (Recovery Time Objective)',
  RPO: 'den största mängd data, mätt i tid, som får gå förlorad vid ett haveri (Recovery Point Objective)',
  API: 'programmeringsgränssnitt, det sätt som andra system hämtar och skickar uppgifter på',
  NLL: 'Nationella läkemedelslistan, E-hälsomyndighetens register över förskrivna läkemedel',
  HSA: 'katalogtjänsten för personal och enheter i vården, som Inera förvaltar',
  CE: 'märkningen som visar att en produkt uppfyller EU:s krav, här för medicintekniska produkter',
  MDR: 'EU:s förordning 2017/745 om medicintekniska produkter',
};
