# Vårdkällan: design för första versionen

Vårdkällan är ett öppet och komplett vårdinformationssystem, byggt från grunden på öppna standarder. Det är inte en kopia av Cosmic. Första versionen är en publik demo på https://vardkallan.404haven.se med påhittade patienter i Region Örebro läns verksamheter. Den ska visa att kärnan i ett journalsystem går att bygga öppet, och att de fel som drabbade Cosmic i Sussa går att konstruera bort.

Underlag: en sammanställning av offentliga källor om upphandlingen av Cosmic och kritiken mot systemet (Konkurrensverkets ansökningar, förvaltningsrättens och kammarrättens domar, revisionsrapporter och regionernas egna handlingar). Krav-id nedan (K1 till K5, D1 till D12, L1 till L13) kommer därifrån. Dessutom finns Sussas egen kravspecifikation med originalnummer för kapitel 1 till 6 och 11, som Konkurrensverket lämnade ut 2026-11-03 (se avsnittet Sussa-registret).

## Grundprincip: systemet är experten

Grundprincipen formulerades den 3 november 2026:

"Hela grundtanken är att det ska vara systemet som är experten, inte användaren. Alla flöden måste vara superenkla för användarna, oavsett vilken roll de har. Självklart ska kravspecifikationen uppfyllas, men om den lösning som Cosmic har valt inte uppfyller principen om att systemet ska vara experten ska den skrivas om så att principen alltid gäller."

Sussas krav är mest skrivna som "beskriv hur ni stödjer X". De säger vad vården behöver, inte hur det ska lösas. Vårdkällan uppfyller behovet, men på ett sätt där systemet bär kunskapen om regler, kodverk och lagar. I praktiken betyder det i varje funktion:

- Systemet fyller i allt det kan räkna ut ur sammanhanget: vårdkontakt, enhet, tid, patientens uppgifter och förval.
- Det finns inga fält eller val som systemet kan avgöra själv. Användaren ska aldrig behöva kunna kodverk, regler eller lagtext.
- Systemet föreslår nästa steg, kontrollerar mot regler och kodverk och förklarar på vanlig svenska varför något inte går eller varför det varnar.
- Varje roll ser det rollen behöver just då, och inget annat.
- Flödet ska klara en klickbudget (`app/src/klickbudget.js`, mätt med `test/klickbudget.cjs`). Nya vanliga flöden får en egen post i `FLODEN` med budget och motivering.
- För varje Sussa-post som byggs står det i Sussa-registret hur systemet tar expertrollen (fältet `expert`).

Exempel som redan finns: aktivt val och samtycke frågas efter bara när behörighetsmotorn kräver det och med förslag på grund, ordinationen kontrolleras mot överkänslighet och andra läkemedel innan den sparas, koder för diagnoser, läkemedel och mätvärden sätts av systemet, skyddad identitet maskeras överallt utan att någon behöver komma ihåg det, och remissens och NLL:s kvittenser bevakas av systemet och hamnar i inkorgen när något uteblir.

## Mål

1. Patientöversikt, journalanteckningar, läkemedelslista, remiss och svar, mätvärden och diagnoser för en patient.
2. Behörighet enligt patientdatalagen och HSLF-FS 2016:40 4 kap.: vårdrelation, inre sekretess med aktivt val, spärr med spärrmarkering, nödåtkomst, minsta nödvändiga åtkomst per yrkesroll.
3. Skyddade personuppgifter skyddas i hela kedjan, även i väntrum och uppropning.
4. Varje åtkomst loggas i en logg som inte går att ändra (hashkedja och databastriggrar). Logglista till patienten och logguppföljning för granskare.
5. Läkemedelslistan är byggd för Nationella läkemedelslistan: ordinationsorsak och uppföljningsdatum är obligatoriska, och varje överföring har kvittens. En timeout döljer aldrig en lyckad förskrivning (D1).
6. Remisser har mottagningskvittens, bedömning, svar och kvittens av svaret, med larm när något uteblir (D1).
7. Migrerad historik från VAS och Cosmic visas i samma kronologi som ny dokumentation, med källa utskriven, och en avstämningsrapport för migreringen (D2, D3).
8. Öppet FHIR R4-API för alla resurser, med samma behörighetskontroll och loggning som gränssnittet (D9).
9. Kravspårbarhet: en sida som visar varje krav, var det uppfylls och vilka automatiska tester som visar det, med testresultat från bygget (K1, K4). Sussas kravspecifikation med originalnummer visas på samma sida, mappad post för post till Vårdkällan.
10. Svarstid mäts för varje anrop och visas (D5).
11. Patienten läser sin egen journal och ser vem som har läst den i Min journal, Vårdkällans egen e-tjänst för invånare (se avsnittet Min journal).

## Icke-mål i första versionen

Tidbok och kassa, specialområdena (anestesi och IVA, cytostatika, operation, förlossning, BVC), riktiga integrationer mot NLL, NPÖ, 1177 och e-remiss, diktat, mobilklient, BI. De visas på modulsidan som planerade, aldrig som klara.

## Det som får demon att misslyckas även om den fungerar

- Riktiga personuppgifter. Bara testpersonnummer från Skatteverket (`research/testpersonnummer.json`) och påhittade namn.
- Att se ut som en tjänst från Region Örebro län. Verksamheternas namn får användas, men inte regionens logotyp eller grafiska profil, och sidfoten säger att det är ett fristående demoprojekt.
- Att påstå att demon uppfyller Cosmic-kraven eller är CE-märkt. Läkemedelsvarningarna är märkta som demoregler, inte kliniskt beslutsstöd (D10).
- Att behörighetsregler bara finns i gränssnittet. All kontroll sker på servern.

## Teknik (mitt val)

- Bun 1.3 (image `oven/bun:1.3.14-alpine`), inga externa beroenden om det går att undvika. `bun:sqlite`.
- Varje besökare får en egen sandlåda: en SQLite-databas i minnet, skapad genom `Database.deserialize` av en seedad mall. Max 400 sandlådor, 8 timmar. Samma mönster som `~/Projekt/motionsportalen/app/src/server.js` och `db.js`, där sandlådorna sparas till `/data/sessioner.json` vid SIGTERM och läses in vid start.
- Alla datum i seeden räknas relativt till dagens datum när sandlådan skapas, så att demon alltid ser aktuell ut.
- Frontend: vanilla JavaScript-moduler utan byggsteg, i `app/public/`. Svenska genomgående.
- Container `vardkallan` på proxy-net bakom Caddy och cloudflared, read_only, cap_drop ALL, som motioner.

## Katalogstruktur

```
~/Projekt/vardkallan/
  docs/design.md
  research/testpersonnummer.json
  app/
    Dockerfile  package.json
    src/server.js      HTTP, sessioner, routning, svarstidsmätning
    src/db.js          schema, triggrar, seed-mall, serialisering
    src/seed/          enheter.js personal.js lakemedel-katalog.js patienter.js (journalhistorik per patient)
    src/atkomst.js     behörighetsmotorn (ren funktion, testas utförligt)
    src/logg.js        åtkomstlogg med hashkedja
    src/journal.js     anteckningar, signering, rättelse
    src/lakemedel.js   ordination, utsättning, varningar, NLL-simulering
    src/remiss.js      remissflödet och larm
    src/vardkontakt.js vårdkontakt, vårdtillfälle, hälsoärende och patientavgift
    src/vardstruktur.js schema för vårdstrukturen och knytning av befintlig historik
    src/fhir.js        FHIR R4-mappning och /fhir-routning
    src/krav.js        kravregistret med koppling till tester
    src/sussa/         Sussas kravspecifikation (kravspec.json), mappning per avsnitt (mappning/) och index.js
    public/            index.html, app.css, js/
    test/              bun test, en fil per modul
```

## Verksamheter (Organization)

Vårdgivare: Region Örebro län (påhittat HSA-id `SE2321000164-VK0000`). Vårdenheter med påhittade HSA-id av formen `SE2321000164-VKnnnn`:

- Universitetssjukhuset Örebro (USÖ): Akutmottagningen, Kardiologiska kliniken (avdelning 72, hjärtintensiven och mottagning), Medicinska kliniken, Infektionskliniken, Ortopediska kliniken, Allmänpsykiatriska kliniken.
- Lindesbergs lasarett: Medicinkliniken.
- Karlskoga lasarett: Ortopediska kliniken.
- Vårdcentralen Tybble och Vårdcentralen Kumla (primärvård, listning).

## Personal och demoroller

Inloggning sker med ett simulerat SITHS-kort: besökaren väljer person och den enhet personen arbetar på. Påhittade namn.

| Id | Namn | Yrke | Enhet |
|---|---|---|---|
| lak-kard | Sara Lindqvist | Läkare | Kardiologiska kliniken USÖ |
| ssk-kard | Johan Ek | Sjuksköterska | Kardiologiska kliniken USÖ, avd 72 |
| usk-kard | Amira Haddad | Undersköterska | Kardiologiska kliniken USÖ, avd 72 |
| lak-akut | Erik Nyström | Läkare | Akutmottagningen USÖ |
| lak-vc | Per Holm | Läkare (distriktsläkare) | Vårdcentralen Tybble |
| lak-psyk | Lena Ström | Läkare | Allmänpsykiatriska kliniken USÖ |
| adm-kard | Karin Berg | Vårdadministratör | Kardiologiska kliniken USÖ |
| logg | Mats Wall | Logggranskare (informationssäkerhet) | Regionkansliet |

Patienterna loggar in i Min journal med simulerad e-legitimation. Varje patient med personnummer i `seed/patienter.js` är också en invånare (`inv-p01` till `inv-p15`), och därtill finns vårdnadshavaren Johanna Bergström (`inv-vh01`, testpersonnummer 19861214-2383) till barnet Leo Bergström (p09), utan egen journal i demon. Barnet kan inte logga in självt.

## Behörighetsmotorn (atkomst.js)

En ren funktion `prova(db, { personal, patient, handling, resurs, val })` som returnerar `{ tillaten, grund, krav, spärrade, skal }`. Regler:

1. **Yrkesroll** bestämmer vilka handlingar som alls är möjliga (minsta åtkomst, D8):
   - Läkare: läsa och skriva journal, ordinera, remittera, svara på remiss.
   - Sjuksköterska: läsa journal, skriva omvårdnadsanteckning, registrera mätvärden, ge och kvittera, inte ordinera.
   - Undersköterska: läsa översikt (läkemedel, mätvärden, överkänslighet, omvårdnadsanteckningar), registrera mätvärden. Inte läkaranteckningar.
   - Vårdadministratör: administrativa uppgifter (namn, kontakter, remissernas status, vårdkontakter), ingen journaltext, inga läkemedel.
   - Logggranskare: åtkomstloggen för alla patienter, ingen journal.
   - Patientidentitet (Sussa 3.1.1): läkare, sjuksköterskor och vårdadministratörer registrerar nya patienter och nya identiteter. Bara vårdadministratören bekräftar att två journaler slås samman.
2. **Vårdrelation** krävs för journalåtkomst. Den finns om patienten har en pågående eller nyligen avslutad (90 dagar) vårdkontakt, inskrivning eller listning på personalens enhet, eller en remiss till enheten. En vårdkontakt som skapades under nödåtkomst räknas inte, och en kontakt som systemet skapade när någon dokumenterade räknas i 90 dagar från dagen den skapades (se Vårdkontakt och vårdtillfälle).
3. **Inre sekretess**: personalen ser utan vidare sin egen enhets uppgifter. Andra enheters uppgifter inom vårdgivaren visas först efter ett aktivt val ("Visa uppgifter från andra vårdenheter") med angivet syfte. Valet loggas och gäller sessionen för den patienten.
4. **Spärr**: en patient kan ha spärrat uppgifter från en enhet (i demon: Allmänpsykiatriska kliniken för en patient). Andra enheter ser en spärrmarkering, "Det finns spärrade uppgifter", men inte innehållet eller enhetens namn. Spärren kan tillfälligt hävas bara med patientens samtycke i stunden, vilket registreras och loggas. Nödåtkomst häver aldrig en spärr.
5. **Nödåtkomst**: utan vårdrelation kan en läkare eller sjuksköterska öppna journalen om patienten inte kan samtycka och det behövs för vården. Motivering är obligatorisk, åtkomsten flaggas i loggen och syns i logguppföljningen.
6. **Utan grund** nekas åtkomsten, och försöket loggas som nekat.
7. **Skyddade personuppgifter**: patienten har markering. Namn ersätts av "Skyddad identitet" i listor, adressen visas aldrig, personnumret visas maskerat (`19800101-****`) tills personalen väljer "Visa identitet" med syfte (loggas). I väntrums- och uppropningsvyn visas bara könummer för alla patienter, och aldrig namn för en skyddad patient.

Servern anropar motorn i varje API- och FHIR-anrop. Gränssnittet döljer bara knappar för det som motorn ändå nekar.

## Loggen (logg.js)

Tabell `atkomstlogg` med `id, tid, personal_id, enhet_id, patient_id, handling, resurs, grund, syfte, resultat, prev_hash, hash`. `hash = sha256(prev_hash + kanonisk JSON av raden)`. SQLite-triggrar `BEFORE UPDATE` och `BEFORE DELETE` gör `RAISE(ABORT, ...)`. En funktion `verifiera(db)` kontrollerar hela kedjan. Grund är en av `egen_enhet`, `vardrelation`, `aktivt_val`, `samtycke_sparr`, `nodatkomst`, `administrativ`, `logggranskning`, `nekad`, och för invånarens läsning i Min journal `egen_atkomst` och `vardnadshavare`. En rad från Min journal har `invanare_id` i stället för `personal_id`; fältet tas med i den kanoniska JSON:en bara när det är satt, så att hashen för personalens rader är oförändrad.

## Journal (journal.js)

Anteckning = typ, sökord (lista av `{ sokord, text }`), enhet, vårdkontakt, författare, status `utkast | signerad`. En signerad anteckning ändras aldrig. Rättelse skapar en ny version med `ersatter_id` och obligatorisk orsak, och den gamla versionen visas överstruken men läsbar (HSLF-FS 2016:40 6 kap.). Mallar per typ: Inskrivningsanteckning, Daganteckning, Mottagningsanteckning, Omvårdnadsanteckning, Epikris, Akutanteckning. Källa: `vardkallan`, `migrerad:VAS` eller `migrerad:Cosmic`.

## Läkemedel (lakemedel.js)

- Katalog med cirka 40 vanliga läkemedel: namn, styrka, form, ATC-kod, påhittat NPL-id.
- Ordination: läkemedel, dosering (text plus strukturerat: dos, enhet, tider, vid behov), **ordinationsorsak (obligatorisk)**, **uppföljningsdatum (obligatoriskt)**, start, eventuellt slut, typ `staende | vid_behov | tillfallig`.
- Varningar före sparande (demoregler, märkta så): överkänslighet där ATC-prefixet matchar, dubbelordination av samma substans eller grupp (ATC 5 tecken), ett fåtal interaktioner (warfarin med NSAID, två antikoagulantia, metformin vid lågt eGFR). En allvarlig varning måste kvitteras med motivering.
- Utsättning med orsak. Inget raderas.
- NLL-simulering: varje ändring skapar ett meddelande med status `skickad → kvitterad` eller `fel` eller `timeout`. Vid timeout blir ordinationen `nll_status = okand_kontrolleras`, och en avstämning frågar NLL igen och hittar att den faktiskt registrerades. Ordinationen syns hela tiden i listan. Demoknapp "Simulera timeout mot NLL" för nästa överföring.

## Remiss (remiss.js)

Statuskedja: `skickad → mottagen (kvittens) → bedomd (accepterad | avvisad med motivering) → besvarad → svar_kvitterat`. Larm i inkorgen när mottagningskvittens saknas efter 2 timmar, när svar saknas efter sista svarsdatum, och när ett svar inte har kvitterats av avsändaren efter 3 dagar. Seeden innehåller remisser i varje läge, även ett som har larm.

## Vårdkontakt och vårdtillfälle (vardkontakt.js, Sussa 6.1.1, 3.4.4 och 3.1.7)

Vårdkontakten är den bärande strukturen. Allt som dokumenteras, anteckningar, diagnoser, mätvärden, ordinationer och remisser, hör till en vårdkontakt. En vårdkontakt har vårdform (öppenvård, akut eller slutenvård), kontaktsätt i öppenvård och akut (besök, telefon, video eller hembesök), vårdenhet, plats, orsak, start och slut, och för en planerad kontakt den faktiska ankomsttiden. Den visar vem som registrerade den och när, och vem som senast ändrade den. Schemat och knytningen av befintlig historik finns i `vardstruktur.js`, flödena i `vardkontakt.js`.

**Systemet väljer kontakten.** Den som dokumenterar, ordinerar, mäter eller remitterar väljer aldrig en vårdkontakt i en lista. Servern knyter uppgiften till en kontakt efter att den har sparats, så att en nekad eller ogiltig åtgärd aldrig skapar en kontakt:

1. Pågår ett vårdtillfälle på den egna vårdenheten, eller ett där vårdenheten har det medicinska ansvaret, hamnar uppgiften på avdelningens pågående kontakt.
2. Annars ett pågående akutbesök, eller en kontakt i dag på den egna vårdenheten.
3. Finns ingen skapar systemet en: akutbesök på akutmottagningen, annars ett besök på vårdenhetens mottagning. En öppen remiss till vårdenheten blir kontaktorsak och knyts till kontakten. Annars blir kontaktorsaken anteckningens sökord Kontaktorsak, eller kontaktsättet.

Formulären för anteckning, mätvärde, ordination och remiss visar före sparandet vilken kontakt det blir, eller att en ny skapas, och den kan ändras till ett annat kontaktsätt och en annan orsak. Efteråt syns kontakten i översikten, där den egna vårdenhetens kontakter kan ändras och avslutas.

**Registrering.** Vårdadministratören registrerar en vårdkontakt från patientens översikt. Förvalen är besök, nu och vårdenhetens mottagning, och finns en remiss till vårdenheten blir kontaktorsaken "Enligt remiss från" avsändaren, aldrig frågeställningen, eftersom vårdadministratören inte läser journaltext. En planerad kontakt får en tid, med nästa vardag klockan 9 förvald. När patienten kommer till en planerad kontakt i dag registreras ankomsten på den i stället för en ny kontakt, och samma kontakt kan inte registreras två gånger samma dag. Kontaktorsak behöver bara anges när systemet inte kan föreslå den.

**Patientavgift (demoregler).** Systemet räknar avgiften ur kontakttyp och kontaktsätt: 200 kronor för besök, video och hembesök, 0 för telefon, 400 för akutmottagningen och 100 kronor per påbörjat vårddygn i slutenvård. Patienter under 20 år och från 85 år betalar inget, och högkostnadsskyddet på 1 450 kronor räknas över tolv månader. Beloppen är påhittade och märkta som demoregler. Betalning, kvitto, återbetalning, LMA-kort och patienter från andra län är inte byggda.

**Vårdtillfälle.** Ett vårdtillfälle i slutenvård håller samman vistelserna på de avdelningar patienten ligger på. Vid inskrivning föreslår systemet avdelningen (den egna, eller vårdenhetens första avdelning) och tar orsaken från ett pågående akutbesök eller en öppen remiss. Akutbesöket avslutas och blir den föregående kontakten, så att övergången mellan vårdformer går att följa. Vid flytt avslutas kontakten på den gamla avdelningen och en ny börjar i samma vårdtillfälle. Det som redan är dokumenterat ligger kvar på sin kontakt, och nästa uppgift hamnar på den nya avdelningens kontakt, så inget registreras om. Ett sängbyte på samma avdelning ändrar bara platsen. Medicinskt ansvar (vårdtillfällets vårdenhet) och produktionsansvar (avdelningens vårdenhet) hålls isär: vid flytt till en annan klinik följer ansvaret med, utom när den gamla kliniken behåller det. Permission har ett datum för återkomst, och under permissionen går patienten inte att flytta. Vid utskrivning påminner systemet om osignerade anteckningar och saknad epikris utan att stoppa utskrivningen. Inskrivning, sängbyte, flytt, ändrat ansvar, permission, återkomst och utskrivning sparas som händelser med vem, var och när, och händelserna kan inte ändras eller raderas (databastriggrar). Bara avdelningens vårdenhet eller vårdenheten med det medicinska ansvaret kan flytta, ge permission och skriva ut.

**Hälsoärende.** Ett hälsoärende håller samman vårdkontakter över tid och vårdenheter. Systemet föreslår ärenden bland de kontakter användaren får se: samma diagnoskategori (de tre första tecknen i ICD-10-SE-koden) vid flera kontakter, en remisskedja (kontakten som skickade remissen och kontakten hos mottagaren som var svaret på den) och övergångar mellan vårdformer och flyttar inom ett vårdtillfälle. Förslaget visar skälet, bekräftas med ett klick och kan avvisas, och ett avvisat förslag visas inte igen. Nya kontakter i samma vårdtillfälle och efter ett akutbesök följer med ärendet. Ett ärende kan inte avslutas, delas eller slås ihop i demon.

**Översikt och tidslinje.** Översikten visar pågående vårdtillfälle med händelser och åtgärder, kontakterna med kontaktsätt, hälsoärende, vem som registrerade dem och, per kontakt, hur många anteckningar, mätvärden, ordinationer och remisser som hör till den. Tidslinjen kan visas i tidsordning, per vårdtillfälle och vårdkontakt eller per hälsoärende, och vårdtillfällets händelser finns med. `GET /api/vardkontakt/:id` ger allt som hör till en kontakt. Allt bygger på det som redan är filtrerat för användaren, så inre sekretess, spärr och yrkesroll gäller som i resten av journalen.

**Behörighet och loggning.** Nya handlingar i behörighetsmotorn: `registrera_vardkontakt` (läkare, sjuksköterska och vårdadministratör), `vardtillfalle` (läkare och sjuksköterska) och `halsoarende` (läkare och sjuksköterska). Varje anrop prövas och loggas på patienten som de andra anropen, och nekade försök loggas som nekade.

**En kontakt skapar aldrig behörighet som användaren inte hade.** Eftersom systemet skapar vårdkontakten själv när någon dokumenterar, och vårdkontakten är en grund för vårdrelation, skulle en nödåtkomst annars bli en bestående vårdrelation till hela journalen så fort läkaren skrev ett mätvärde. Lösningen är att varje kontakt får veta om den ger vårdrelation (`ger_vardrelation`). En kontakt som någon skapar, när systemet knyter dokumentation, när en kontakt registreras, vid inskrivning och vid flytt, ger vårdrelation bara om den som skapar den redan hade vårdrelation till patienten på sin vårdenhet. Under nödåtkomst skapas kontakten som vanligt, så användaren väljer fortfarande aldrig någon kontakt och nästa uppgift samma dag hamnar på samma kontakt, men behörighetsmotorn räknar den inte. Nästa gång krävs ny nödåtkomst, som flaggas i logguppföljningen igen. Ett aktivt val ger ingen skrivrätt utan vårdrelation, så det fallet täcks av samma regel. Vi valde detta framför att låta kontakten sluta vid dagens slut, eftersom nödåtkomsten då ändå hade blivit en vårdrelation i 90 dagar, och framför att inte räkna automatiska kontakter alls, eftersom den som har vårdrelation genom en remiss då hade förlorat den efter sitt eget besök. Dessutom räknas en kontakt som systemet skapade i 90 dagar från dagen den skapades, som ett avslutat besök, även om ingen avslutar den, så att en enstaka dokumentation inte blir en vårdrelation för alltid. Vid flytt får den nya avdelningen vårdrelation genom den nya vistelsen när den som flyttar har vårdrelation, eftersom patienten då faktiskt vårdas där.

**Inskrivning, flytt och utskrivning prövas mot den egna vårdenheten.** Inskrivningen avslutar bara ett akutbesök på den egna vårdenheten, samma prövning som när en kontakt avslutas. Ett akutbesök på en annan vårdenhet lämnas orört, och dess orsak används inte som förval. Patienten kan skrivas in på den egna vårdenhetens avdelningar, och från ett akutbesök på den egna vårdenheten på vilken avdelning som helst, som när den som vårdar patienten flyttar den. Annars svarar servern 403 och försöket loggas som nekat. Meddelandet om att patienten redan är inskriven nämner avdelningen bara om användaren får se den. Flytt, permission och utskrivning kräver som förut att patienten vårdas på den egna vårdenheten eller att den har det medicinska ansvaret.

**Vårdtillfället visar bara det användaren får se.** Vistelserna i ett vårdtillfälle prövas i behörighetsmotorn per vårdkontakt, med inre sekretess, aktivt val och spärr, i `GET /api/vardtillfalle/:id`, i översikten och tidslinjen, i `GET /api/vardkontakt/:id` och i FHIR. Händelser visas bara på vårdenheter där användaren får se en vistelse, och en flytt eller inskrivning nämner avdelningen som patienten kom från bara när den också syns. Avdelning, plats och produktionsansvar visas när den aktuella vistelsen syns. Utskrivningskontrollen räknas på de synliga vistelserna och visas bara för den som skriver in och ut, och innehållet räknas på det användaren får läsa (`null` för det rollen inte får läsa). Den som inte får se någon vistelse nekas och nekandet loggas. Vårdenheten med det medicinska ansvaret dokumenterar på vistelsen där patienten ligger, men ser utan aktivt val bara att det är vårdtillfället under dess ansvar, inte var patienten ligger. Hälsoärendet visar bara de kontakter användaren får se, och i en vårdkontakt visas hälsoärendet bara om användaren får se ärendet.

**Seed och migrerad historik.** Varje slutenvårdskontakt i seeden blev ett vårdtillfälle, och ett akutbesök som slutade strax före inskrivningen blev den föregående kontakten. Uppgifter som saknade vårdkontakt knöts till kontakten på samma vårdenhet och från samma källa vid samma tid. Fanns ingen skapades en, en per vårdenhet och dag, märkt som skapad av systemet och med uppgiftens källa, så att migrerad historik förblir märkt som migrerad. Sådana kontakter räknas inte som överförda i migreringsavstämningen. En remiss knöts till kontakten hos mottagaren som var svaret på den. En sandlåda från en äldre version får samma knytning när den läses in. P01 har ett sängbyte, p11 ett bekräftat hälsoärende över remisskedjan, och Kardiologiska kliniken har fått arbetsplatsen Hjärtintensivvårdsavdelningen (HIA).

**FHIR.** Vårdkontakten är ett `Encounter`, vårdtillfället ett eget `Encounter` (`vt-<nummer>`) som vårdkontakterna är `partOf`, med varje plats som `location`, och hälsoärendet är `EpisodeOfCare`. Samma behörighet och loggning som gränssnittet: vårdtillfället syns när användaren får se någon av vistelserna och har bara platserna på de vårdenheterna, och hälsoärendets period börjar med den första kontakt användaren får se. Validerat utan fel med HL7:s validator 2026-11-03 (`docs/fhir-validering.md`). Min journal visar vårdkontakter men inte vårdtillfällen och hälsoärenden, så invånaren får inte dem i FHIR heller.

**Klickbudget.** Sex nya flöden: bekräfta ett hälsoärende (budget 1), skriva in (4), flytta (5), skriva ut (2), registrera ett besök (3) och planera ett videobesök (5).

**Det som är simulerat eller saknas.** Avgifterna är demoregler. Tidbok och incheckning som patienten gör själv är inte byggda (Sussa 3.4.4.2 och 3.4.4.5); när tidboken byggs ska incheckningen registrera ankomsten på den planerade kontakten. Vårdplatser och sängar är fritext utan beläggningsöversikt. Målvärden för ledtider i subprocesser (6.1.1.4) och riktiga kringsystem (6.1.1.3) finns inte. Överkänslighet är uppmärksamhetsinformation om patienten och hör inte till en enskild vårdkontakt. En patient som kommer till en vårdenhet utan vårdrelation och utan remiss kan i demon bara få en vårdrelation genom att registreras som ny patient; en kontakt som en läkare registrerar under nödåtkomst ger ingen vårdrelation, så i det läget krävs nödåtkomst vid varje ny session.

## Läkemedelsprocessen (administrering.js, vidimering.js, Sussa 3.5.1, 3.5.2 och 3.5.3)

Läkemedelsprocessen hålls samman på läkemedelslistan: ordination, iordningsställande, administrering eller överlämnande, vidimering, utsättning och läkemedelsgenomgång görs på samma ordinationer och knyts till vårdkontakten och vårdtillfället. Schemat och seedens givna doser finns i `lakemedelsprocess.js`, flödena i `administrering.js` och `vidimering.js`, de fördefinierade ordinationerna i `ordinationsmallar.js` och alla varningsregler i `lakemedelsregler.js`.

**Dagens doser räknas fram ur ordinationerna.** Ingen bygger en administreringslista. För varje stående och tillfällig ordination räknar systemet fram dagens dostider ur ordinationens tider, utan tider före ordinationen och efter utsättningen. Vid behovsläkemedel visas med senaste dos, hur mycket som har getts det senaste dygnet av högsta dygnsdosen i doseringen och när nästa dos tidigast får ges. Ordinationer utan fasta tider (till exempel Waran enligt doseringsschema) visas för sig, och en ordination till en planerad vårdhändelse som inte har fått en tid visas som väntande. Varje dos har status kommande, att ge nu (från en timme före dostiden), försenad (mer än en timme efter), iordningsställd, given, överlämnad eller inte given. Listan finns per patient i läkemedelsfliken och per avdelning under Läkemedel att ge i menyn, för inneliggande patienter på den egna vårdenhetens avdelningar.

**Ge med ett klick.** Sjuksköterskan klickar Ge för dosen. Tid, vem som gav dosen, dos ur ordinationen och vårdkontakten (vårdtillfällets pågående vistelse, med samma regler som för annan dokumentation) sätts av systemet. Under Mer finns Iordningsställ, Given tidigare (registrering i efterhand med klockslag, upp till sju dagar bakåt) och Inte given (med orsak, som förslag eller fritext). En registrering visar både när dosen gavs, vem som gav den och när och av vem den registrerades. Den som gav dosen kan vara en annan sjuksköterska på samma vårdenhet.

**Varningar innan något sparas (demoregler).** Systemet kontrollerar dosen mot ordinationen och tidigare doser av samma substans de senaste två dygnen och förklarar varför: dubbel dos (dostiden är redan given, eller samma substans gavs för tätt inpå, med minsta intervall ur doseringen, halva det kortaste avståndet mellan tiderna eller fyra timmar för vid behov), för tidig dos (mer än en timme före dostiden), dos utan ordination (ingen ordination, eller en ordination som inte gällde vid tiden, till exempel utsatt) och högsta dygnsdos för vid behov. En allvarlig varning måste kvitteras med motivering, som för ordinationer. Att iordningsställa en dos i förväg eller lämna över den inför permission räknas mot dostiden och ger ingen varning för för tidig dos.

**Iordningsställande och kontrollkod.** En iordningsställd dos får en kontrollkod (`VK-ADM-<nummer>-<journal>`) för etiketten. När dosen ges kontrollerar servern att koden hör till samma patient och ordination, och en etikett för en annan patient stoppas. Koden är förberedd för patientnära skanning, men ingen streckkodsläsare och ingen etikettutskrift finns.

**Permission (3.5.2.5).** När vårdtillfället har permission märks doserna från permissionen till och med återkomstdagen, och systemet föreslår Lämna över i stället för Ge. Överlämnandet registreras med vem och när och märks som permission.

**Vidimering (3.5.2.9).** Läkaren ser i läkemedelsfliken vad som har ändrats sedan den senaste vidimeringen: nya, ändrade och utsatta ordinationer med vem, var och när. Ett klick vidimerar hela listan. Vidimeringen sparas som en ögonblicksbild av ordinationerna och ändras eller raderas aldrig (databastriggrar), och varje ordination får händelsen Vidimerad i sin historik. Seeden har en vidimering av patient 1 vid inskrivningen, före dosökningarna.

**Utsättning med särskilda observationer (3.5.2.8).** Innan utsättningsdialogen öppnas kontrollerar systemet läkemedlet mot reglerna i `lakemedelsregler.js`: betablockerare efter mer än sju dagar, kortison efter tre veckor, trombocythämmare efter PCI under det första året, basinsulin och antiepileptika är allvarliga, och antikoagulantia, antidepressiva, opioider och sömnmedel är observationer. Behandlingstiden räknas över dosändringar, från den första av de ordinationer av samma substans som följer på varandra. Varningen visas med ett förslag på nedtrappning, och en allvarlig varning bekräftas med knappen Sätt ut trots varningen. Orsaken till utsättningen är motiveringen och sparas i historiken.

**Fördefinierade ordinationer och planerad vårdhändelse (3.5.1.3, 3.5.2.7).** När förskrivaren väljer en produkt fyller systemet i dosering, dos, administrationssätt, tider, typ och uppföljningsdatum ur en mall för substansen, anpassat efter patienten: lägre högsta dygnsdos av paracetamol och lägre startdos av morfin och zopiklon från 75 år, halverad dos enoxaparin vid eGFR under 30. Utan mall föreslås produktens styrka och administrationssättet ur läkemedelsformen. Ett fält som förskrivaren redan har ändrat skrivs inte över. En ordination kan göras till en planerad vårdhändelse som inte har fått en tid, med antal timmar före. Den får inga fasta tider, och när vårdhändelsen får en tid (`POST /api/ordination/:id/vardhandelse`) räknas administrationstiden fram. Tilläggen sparas i `ordination_tillagg`, så att ordinationen och NLL-överföringen är oförändrade.

**Läkemedelsgenomgång och läkemedelsberättelse (3.5.1.6, 3.5.1.11).** Systemet tar fram de pågående läkemedlen med indikation och fynd: dubbelmedicinering i samma ATC-grupp, interaktioner och överkänslighet med samma demoregler som vid ordination, passerade uppföljningar, saknad indikation, läkemedel som är olämpliga för äldre och polyfarmaci från tio läkemedel. Läkemedelsberättelsen skrivs ur ordinationernas historik under vårdtillfället, annars de senaste 30 dagarna: ändrade doser (en utsättning och en ny ordination av samma substans inom en timme), insatta och utsatta läkemedel med orsak, oförändrade läkemedel, givna vid behovsdoser och uppföljningar de närmaste 14 dagarna. Läkaren kan ändra texten och spara genomgången med en bedömning.

**Vätskebalans (3.5.3.1, 3.5.2.21).** Intag och förluster per dygn med summa in, summa ut och balans. Dygnsbrytningen väljs i API:t. En ordination kan ha en volym per dos för vätskebalansen, och mallen för intravenöst bensylpenicillin har 100 ml. Utan volym räknas en lösning i mg/ml som ges som injektion eller infusion om till volym ur dosen. När dosen ges förs volymen in i vätskebalansen av systemet, märkt som från administrering.

**Behörighet och loggning.** Att ge, iordningsställa och lämna över kräver handlingen `ge_lakemedel` (sjuksköterska), vidimering och läkemedelsgenomgång `ordinera` (läkare) och vätskebalans `registrera_matvarde`. Alla dessa kräver dessutom vårdrelation till patienten på den egna vårdenheten: nödåtkomst och aktivt val ger bara läsning, och ett försök nekas med 403 och loggas som nekat innan något sparas, så att ingen vårdkontakt skapas. En dos av en ordination från en spärrad enhet kan bara ges med patientens samtycke, som när ordinationen visas. Administreringarna är gemensamma som läkemedelslistan, men en dos av en ordination som användaren inte får se, eller som har getts på en spärrad enhet, visas inte. Vidimering och läkemedelsgenomgång omfattar aldrig spärrade enheters ordinationer, inte ens med samtycke. Avdelningens lista visar bara patienter som användaren får se, med namn och personnummer maskerade för skyddad identitet som i arbetslistan, och varje patient i listan loggas. Varje anrop loggas på patienten. Administreringar, vidimeringar, genomgångar och vätskebalans ändras och raderas aldrig; en dos går bara vidare från iordningsställd till given, överlämnad eller inte given.

**Läskopian och FHIR.** Administreringarna är en del i läskopians läkemedelsdel (`administreringar`, samma svar som `GET /api/patient/:id/administreringar` och samma tid som ordinationerna), så givna doser är högst 10 minuter gamla vid ett avbrott. En dos är `MedicationAdministration` med `request` till ordinationen, `performer`, `context` till vårdkontakten och `statusReason` för en dos som inte gavs. En vidimering är en `List` (snapshot) av `MedicationRequest`, där den senaste är `current`. Samma behörighet och loggning som gränssnittet, och en administrering prövas också mot ordinationens vårdenhet. Invånaren får dem inte, eftersom Min journal inte visar dem. Resurserna är kontrollerade med strukturtesterna i bygget, inte med HL7:s validator.

**Klickbudget.** Tre nya flöden: ge en dos (budget 2), vidimera pågående ordinationer (2) och sätta ut ett läkemedel med varning (4). Ordinera behöver färre steg när doseringen kommer ur mallen.

**Det som är simulerat eller saknas.** Alla varningar och mallar är demoregler, inte granskade av farmaceut eller läkare. Spädning och tillsatser, beredning, etikettutskrift, streckkodsskanning, slutenvårdsdos, automatiska doser från pumpar, upp- och nedtrappningsschema, mallar med flera ordinationer och generella direktiv är inte byggda. En felaktig registrering kan inte makuleras. Vårdhändelsen är fritext och tidsätts i läkemedelsprocessen, eftersom tidbok och operationsplanering saknas. Läkemedelsberättelsen följer inte med epikrisen. Gränssnittet visar vätskebalansen för i dag. Lösningen för läkemedelsdelen i läskopian (Sussa 11.2.1.8) är inte framtagen tillsammans med beställaren.

## Kronologi och migrering

Översikten visar en tidslinje över vårdkontakter, anteckningar, ordinationer och remisser där migrerade poster har en etikett ("Migrerad från VAS 2014") men samma vikt i övrigt. Sidan Migreringsavstämning visar per datatyp antal i källan, antal överförda och antal verifierade. Ett avvikelsefall i seeden (en överkänslighet som inte var strukturerad i källan) visas som öppen avvikelse med åtgärd.

## Läsläge vid avbrott och reservinloggning (D4)

Den som arbetar ska kunna läsa det hen behöver när servern inte svarar, och inloggningen ska inte falla med en extern tjänst. Under avbrottet går inget att spara, eftersom det inte skulle nå journalen, och varje läsning hamnar i åtkomstloggen i efterhand. API:t står i `docs/api-avvikelser.md`.

**Läskopian.** När någon är inloggad bygger servern en läskopia med samma funktioner och samma behörighetskontroll som de vanliga anropen: arbetslistan och, för patienterna på den och de patienter personen har öppnat, patienthuvudet, översikten, läkemedlen och de fem senaste anteckningarna. Spärrar, inre sekretess och skyddad identitet gäller som i journalen. Att uppgifterna lämnas ut loggas. Webbläsaren krypterar kopian med AES-GCM och en nyckel som servern skapar vid varje inloggning och som gäller i 8 timmar, och sparar chiffertexten i IndexedDB. Nyckeln finns i fliken (sessionStorage), så läsläget fungerar i samma flik även om sidan laddas om.

**Läkemedelsdelen och förnyelsen (Sussa 11.2.1.8).** När systemet är otillgängligt ska uppgifterna om ordinerade och administrerade läkemedel vara högst 10 minuter gamla. Webbläsaren förnyar därför läskopian av sig själv medan personen är inloggad, utan att den som arbetar gör något: fliken kontrollerar var 30:e sekund, när den syns igen och när nätet kommer tillbaka om kopian har hunnit bli fyra minuter gammal, och hämtar i så fall en ny. Servern bestämmer intervallet och skickar det med kopian (`fornyas`). Fyra minuter ger marginal för att webbläsaren stryper timrarna i en flik i bakgrunden till en gång i minuten, och för ett misslyckat försök som görs om efter 30 sekunder. Kopian förnyas också direkt efter varje ändring som görs i fliken.

Varje patient i kopian har en läkemedelsdel med en egen tidpunkt, när uppgifterna lästes ur journalen. Delarna står i en tabell i servern (`LASKOPIA_LAKEMEDEL` i `server.js`) med namn, läshandling och den funktion som ger samma svar som det vanliga anropet. Det finns två delar: `lakemedel` (läkemedelslistan med ordinationerna) och `administreringar` (dagens doser och de senast givna, se Läkemedelsprocessen). Båda har samma behörighetskontroll och samma tidpunkt, läsläget svarar på `GET /api/patient/:id/lakemedel` och `GET /api/patient/:id/administreringar` ur kopian och loggar läsningen med delens handling, och servertestet av läkemedelsdelen jämför varje del med det vanliga anropet. En ny del läggs till med en rad i tabellen. Namnet måste vara samma som sista delen av sökvägen till det vanliga anropet.

Läsläget visar för varje patient, i läkemedelslistan och i översikten, när läkemedelsuppgifterna hämtades och hur många minuter sedan det var, och avbrottsraden visar det för hela kopian. Åldern mäts med datorns klocka från när kopian hämtades, så den blir rätt även om datorns klocka går fel mot serverns, och texten uppdateras var 30:e sekund under avbrottet. När uppgifterna är äldre än 10 minuter blir raden en tydlig varning som säger att ändringar efter den tiden inte syns och att man ska fråga den som är ansvarig för patientens läkemedel innan man ger något som kan ha ändrats.

**Loggningen av förnyelsen.** Loggen ska visa vilka åtgärder som har vidtagits med uppgifter om en patient, vid vilken vårdenhet, när, och användarens och patientens identitet (HSLF-FS 2016:40 4 kap.). En rad var fjärde minut per patient skulle inte säga något mer: det är samma person, samma patient, samma enhet och samma grund. Därför loggas utlämnandet till läskopian som en period med två rader per patient. Den första skrivs när patienten lämnas ut första gången under inloggningen (resurs `lasekopia`), och en ny sådan rad skrivs om grunden ändras, till exempel efter ett aktivt val eller en nödåtkomst. Den andra skrivs när utlämnandet slutar (resurs `lasekopia:slut`): vid utloggning, vid en ny inloggning i samma webbläsare, när någon loggar in i Min journal i samma webbläsare, när läskopian går ut eller när patienten inte längre hör till kopian. Den raden har tiden för det senaste utlämnandet och säger i syftet hur många gånger uppgifterna förnyades och varför förnyelsen slutade. Mellan raderna lämnades uppgifterna ut till läskopian, och inga uppgifter om patienten lämnades ut till den efter den sista radens tid. Det personen läser i läsläget loggas som förut, en rad per läsning. Logguppföljningen och patientens logglista i Min journal visar båda raderna som utlämnande till läskopian.

**Läsläget.** Svarar inte servern läser gränssnittet ur kopian. Allt skrivande stängs av med en förklaring, och läget och kopians tidpunkt syns överst. Service workern cachar gränssnittets filer så att appen startar utan nät, men aldrig `/api` eller `/fhir`.

**Reservinloggning.** Stängs fliken eller startas webbläsaren om under avbrottet är flikens nyckel borta. För det fallet kan den inloggade välja en reservkod, minst sex siffror eller en lösenfras på minst tolv tecken, i sidhuvudet eller i avbrottsraden. Webbläsaren härleder en nyckel ur koden med PBKDF2 (SHA-256, 600 000 iterationer, slumpat salt på 16 byte), slår in läskopians nyckel med AES-GCM och sparar den inslagna nyckeln, saltet och den krypterade kopian i IndexedDB. Den inslagna nyckeln är bunden till personen, läskopian, giltighetstiden, saltet och antalet iterationer. Koden och den råa nyckeln sparas aldrig, och nyckeln som koden packar upp kan inte exporteras ur webbläsaren. Reservkopian förnyas tillsammans med läskopian under inloggningen, utan koden.

Vid avbrott i en ny flik eller efter en omstart visar appen, från service workern, vilka personer som har en reservkopia på datorn och när den går ut. Personen väljer sig själv och anger koden, och läsläget öppnas med samma innehåll och samma regler som läskopian. Fel kod ger ökande väntetid (2, 5, 15 och 30 sekunder), och det femte felet raderar reservkopian från datorn. Väntetiden kontrolleras och försöket räknas i samma transaktion, så flera flikar kan inte pröva samtidigt. En omladdning av sidan kräver koden igen.

Reservkopian är per person och per webbläsarprofil, så flera som delar dator har var sin, och inloggningssidan visar vilka som finns och när de går ut. Den gäller lika länge som läskopian, 8 timmar från inloggningen. En ny inloggning av samma person tar bort den gamla, eftersom den inte går att förnya utan koden. Utloggning raderar personens reservkopia, den inslagna nyckeln och läskopian, efter att loggen från läsläget har förts över. Webbläsarens andra flikar får veta det och avslutar sitt läsläge.

**Loggen från läsläget.** Varje läsning sparas som en egen rad, krypterad med läskopians nyckel och med läskopians id, personen och radens id som additional data. Raden kan skickas till servern utan nyckel och utan inloggning, eftersom servern har nyckeln och själv dekrypterar och kontrollerar den. Därför överlever loggen att fliken stängs, och den förs över så snart servern svarar: när läsläget slutar, när appen startar eller före en utloggning. Servern loggar raden på den person läskopian lämnades ut till och i den sandlåda som lämnade ut den, bara för patienter i kopian, bara läshandlingar som rollen har, bara inom kopians giltighet och bara en gång per rad. Bara den som har läskopians nyckel kan skapa en rad, så ingen kan föra in rader på någon annan. Servern behåller nyckeln tills läskopian går ut, även efter utloggning, för att kunna ta emot loggen, men lämnar aldrig ut den igen. Vid utloggningen stängs läskopian: läsningar före utloggningen tas emot, senare läsningar inte. Går datorns klocka fel rättar servern radernas tider med skillnaden mellan klockorna när raderna skickas, och det syns i loggen.

**När servern svarar igen** skickas loggen, och fliken fortsätter som samma person om samma person är inloggad i webbläsarens session. Var fliken inloggad med reservkod och någon annan, eller ingen, är inloggad i webbläsaren visas inloggningen i stället.

**Demon.** Knappen "Simulera avbrott" gör att just den fliken beter sig som om servern var nere. Under det simulerade avbrottet går det att välja reservkod och att simulera att fliken stängs, så att reservinloggningen syns. "Avsluta simulerat avbrott" för över loggen.

**Det som är simulerat, och begränsningarna.**

- I vården låser SITHS-kortet upp en privat nyckel med PIN-koden, även utan nät, och kortets hårdvara håller nyckeln och räknar felaktiga försök. I demon är kortet simulerat med reservkoden, och räknaren ligger i webbläsaren. Den kan kringgås av den som har datorn: den som kopierar IndexedDB kan pröva koder utan räknare och utan väntetid. En kod med sex siffror står då bara emot en kort stund, en lång lösenfras betydligt längre. Det är bara kortets hårdvara som skyddar på riktigt.
- En riktig reservväg för inloggningen när Ineras tjänster (SITHS, HSA och inloggningstjänsten) inte svarar är inte byggd. Inloggningen i demon beror inte på någon extern tjänst eftersom kortet är simulerat.
- Läskopian innehåller arbetslistan och de patienter som personen har öppnat, inte hela journalen, och ersätter inte en reservrutin med utskrifter eller ett separat reservsystem för läsning.
- Läkemedelsuppgifterna är högst 10 minuter gamla när ett avbrott börjar, så länge fliken är öppen och datorn är vaken. Under ett avbrott som varar längre blir de äldre, och läsläget varnar då. Har datorn sovit eller fliken varit stängd är kopian äldre, och läsläget visar hur gammal. Läkemedelsdelen innehåller ordinationerna och de administrerade doserna, men statusen för en dos (att ge nu, försenad) räknades när kopian hämtades och uppdateras inte under avbrottet. Kravet säger att lösningen ska tas fram tillsammans med beställaren, och det är inte gjort.
- Raden som avslutar utlämnandet skrivs när servern märker att det har slutat. Stängs fliken utan utloggning skrivs den när läskopian går ut, och glömmer servern sandlådan innan dess (i demon efter 8 timmar utan användning) skrivs den aldrig. Den första raden säger då fortfarande att kopian förnyas medan inloggningen pågår.
- Reservkoden måste ha valts medan personen var inloggad på samma dator och i samma webbläsare. Det kräver ingen ny inloggning, så den som kommer åt en olåst, inloggad flik kan välja en reservkod och få läsåtkomst som finns kvar efter att webbläsaren stängts, tills personen loggar ut eller i högst 8 timmar. Sidhuvudet visar när en reservkopia finns. Ett riktigt kort kräver sin PIN-kod.
- Den som kan reservkoden kan också skapa loggrader på personen för patienterna i läskopian, så länge den gäller. Det ger inte mer än koden redan ger: att läsa samma uppgifter.
- Webbläsaren kan erbjuda att spara reservkoden i sin lösenordshanterare. Dialogen ber användaren att inte göra det.
- Återställer webbläsaren en stängd flik eller session kan flikens nyckel komma tillbaka, och läsläget öppnas då utan reservkod, precis som sessionen gör när servern svarar.
- Skadlig kod i sidan eller i webbläsaren medan läsläget pågår kan använda nyckeln, precis som den kan läsa det som visas. Webbläsaren kan skriva sessionStorage till disken för att kunna återställa flikar. Kopian ersätter inte diskkryptering och en låst skärm.
- De lokala tidskontrollerna av läskopians giltighet går att kringgå genom att ändra datorns klocka, men servern tar bara emot loggrader inom kopians giltighet.
- Loggen från läsläget går inte att förfalska, men den som har datorn kan radera rader innan de har förts över. Att uppgifterna lämnades ut till läskopian loggas alltid på servern, så logguppföljningen ser vem som hade en läskopia och vilka patienter den gällde.
- I demon har varje besökare en egen sandlåda. Har servern glömt sandlådan (efter 8 timmar utan användning eller en omstart utan sparade sandlådor) går loggen inte att föra över, och det visas för den som är vid datorn.

## API-kontrakt (JSON, sessionskaka `vk_sid`, HttpOnly, SameSite=Lax)

Alla svar har rubriken `Server-Timing: app;dur=<ms>`. Fel: `{ fel: "text", kod: "nekad" | "saknas" | "ogiltig" | "kraver_val" | "kraver_samtycke" }` med 400, 403 eller 404. `kraver_val` och `kraver_samtycke` betyder att åtgärden blir möjlig med ett aktivt val respektive samtycke och att gränssnittet ska fråga.

- `GET /api/health` → `{ ok, sandladar }` (se api-avvikelser.md för tillagda fält)
- `GET /api/session` → `{ inloggad, personal?, enhet?, demoDatum }`
- `GET /api/demo/personal` → lista över demoroller `{ id, namn, yrke, enhet: { id, namn } }`
- `POST /api/login { personalId }` → session. `POST /api/logout`. `POST /api/reset` ger ny sandlåda.
- `GET /api/enheter` → vårdenhetsträd.
- `GET /api/arbetslista` → patienter med vårdrelation på min enhet: `{ id, namn, personnummer, alder, kon, plats, orsak, skyddad, larm }` (namn och personnummer maskerade för skyddade).
- `GET /api/sok?q=` → sök på namn eller identitet (personnummer, samordningsnummer, reservnummer eller OID, också tidigare identiteter) i hela regionen. Träffar visas med maskering. Sökningen loggas.
- Identiteter (Sussa 3.1.1): `GET /api/identitet/tolka?q=`, `POST /api/patienter`, `GET /api/patient/:id/identiteter`, `POST /api/patient/:id/identitet`, `POST /api/patient/:id/sammanslagning`, `POST /api/patient/:id/dubblett/avfarda`. Fälten beskrivs i `docs/api-avvikelser.md`.
- `GET /api/vantrum` → akutmottagningens väntrum: `{ konummer, ankomst, prioritet, ... }` aldrig namn för skyddade.
- `GET /api/patient/:id` → huvud: `{ id, namn, personnummer, alder, kon, skyddad, identitetVisad, overkanslighet: [...], sparrmarkering: bool, grund, harAndraEnheter, andraEnheterVisade }`. Kan svara 403 `kraver_val` (nödåtkomst behövs).
- `POST /api/patient/:id/val { typ: "andra_enheter" | "nodatkomst" | "samtycke_sparr" | "visa_identitet", syfte }` → registrerar valet i sessionen och loggar.
- `GET /api/patient/:id/oversikt` → `{ lakemedel, diagnoser, matvarden (senaste per typ), anteckningar (senaste 5), remisser (pågående), tidslinje }`
- `GET /api/patient/:id/anteckningar` → lista. `GET /api/anteckning/:id` → full med versioner.
- `POST /api/patient/:id/anteckningar { typ, vardkontaktId?, sokord: [{sokord, text}] }` → utkast. `PUT /api/anteckning/:id` (bara utkast, bara författaren). `POST /api/anteckning/:id/signera`. `POST /api/anteckning/:id/ratta { orsak, sokord }`.
- `GET /api/mallar` → anteckningstyper med sökord.
- `GET /api/patient/:id/lakemedel` → ordinationer med `nll_status` och historik. `GET /api/lakemedel/katalog?q=`.
- `POST /api/patient/:id/lakemedel/kontroll { ...ordination }` → `{ varningar: [{ niva: "allvarlig" | "observera", text, regel }] }`.
- `POST /api/patient/:id/lakemedel { ...ordination, kvitteradeVarningar?: [{ regel, motivering }] }`. `POST /api/ordination/:id/utsatt { orsak }`. `POST /api/demo/nll-timeout` (nästa överföring får timeout). `POST /api/ordination/:id/nll-avstam`.
- `GET /api/patient/:id/matvarden`, `POST /api/patient/:id/matvarden { typ, varde, enhet, tid? }`.
- `GET /api/patient/:id/remisser`, `POST /api/patient/:id/remisser { tillEnhetId, fragestallning, anamnes, prioritet, svarSenast }`.
- `GET /api/remisser?riktning=inkommande|utgaende`. `POST /api/remiss/:id/mottag`, `/bedom { beslut, motivering }`, `/svara { svar }`, `/kvittera-svar`.
- `GET /api/inkorg` → `{ osigneradeAnteckningar, okvitteradeSvar, larm, nllAvvikelser }`.
- `GET /api/patient/:id/logglista` → åtkomster för patienten, för logggranskaren. Patienten ser sina åtkomster i Min journal.
- Min journal (invånarens session): `POST /api/login/invanare { invanareId }`, `GET /api/demo/invanare`, `GET /api/min/journal/:id` och `/:id/{oversikt|anteckningar|diagnoser|lakemedel|provsvar|remisser|vardkontakter|logglista|sparrar}`, `GET /api/min/journal/:id/anteckning/:aid`, `POST /api/min/journal/:id/begaran`. Fälten beskrivs i `docs/api-avvikelser.md`.
- `GET /api/logg?flagga=nodatkomst|nekad|samtycke|alla&fran&till` (bara logggranskare) → rader plus `{ kedjaHel: bool }`.
- `GET /api/migrering` → avstämningen.
- `GET /api/krav` → kravregistret med status och testresultat.
- `GET /api/drift` → svarstider per endpoint (p50, p95, antal) för sandlådan och servern.
- `GET /fhir/metadata`, `GET /fhir/{Patient|Encounter|Condition|Observation|MedicationRequest|MedicationAdministration|List|AllergyIntolerance|Flag|ServiceRequest|Composition|Organization|Practitioner}?patient=...`, `GET /fhir/{typ}/{id}`, `GET /fhir/AuditEvent?patient=` (logggranskare). Svar `application/fhir+json`, sökningar som `Bundle` av typen `searchset`. Personnummer med systemet `http://electronichealth.se/identifier/personnummer`, ICD-10-SE `http://hl7.org/fhir/sid/icd-10-se`, ATC `http://www.whocc.no/atc`. Samma behörighet och loggning som `/api`.

## Seed: patienter (påhittade namn, testpersonnummer)

Minst tolv patienter, däribland:
1. Kardiologi, inlagd avd 72 med förmaksflimmer och hjärtsvikt. Waran, Metoprolol, Furosemid. Penicillinöverkänslighet (J01C). Migrerad historik från VAS 2014 och Cosmic 2023.
2. Akutmottagningen, medvetslös vid ankomst, ingen tidigare vårdrelation med akuten: visar nödåtkomst.
3. Skyddade personuppgifter, besök på Vårdcentralen Tybble och i väntrummet på akuten.
4. Spärrade uppgifter från Allmänpsykiatriska kliniken, inlagd på kardiologen.
5. Listad på Vårdcentralen Kumla, remitterad till kardiologen, remissen saknar mottagningskvittens (larm).
6. Diabetes med nedsatt njurfunktion och metformin (interaktionsvarning).
7. Ortopedi Karlskoga, höftfraktur, omvårdnadsanteckningar.
8. Infektion, pneumoni, antibiotika, labbvärden (CRP).
9. Ett barn (född 2010-talet) på vårdcentralen.
10. Äldre patient på Lindesberg med många läkemedel och en NLL-avvikelse (timeout som väntar på avstämning).
11. Patient med remissvar som inte kvitterats av avsändaren.
12. Patient utan vårdrelation till någon demoroll (för att visa nekad åtkomst).

Varje patient har vårdkontakter, minst tre signerade anteckningar med realistiskt men kort kliniskt innehåll på svenska, diagnoser med ICD-10-SE, mätvärden över tid och läkemedel med ordinationsorsak och uppföljningsdatum.

## Min journal (patientvy.js)

Min journal är Vårdkällans egen e-tjänst för invånare: patienten läser sin journal och ser vem som har läst den. Den har eget namn och samma utseende som resten av Vårdkällan och efterliknar inte någon annan tjänst. Den är byggd för att visa att ett öppet system kan ge patienten direkt insyn, särskilt i åtkomstloggen.

### Rättslig grund

- En vårdgivare får ge en enskild direktåtkomst eller annat elektroniskt utlämnande av uppgifter om sig själv som får lämnas ut till honom eller henne, och av dokumentationen av åtkomsten (patientdatalagen 2008:355, 5 kap. 5 §). Vad som visas är alltså vårdgivarens val, och uppgifter som omfattas av sekretess mot patienten själv (offentlighets- och sekretesslagen 25 kap. 6 §) visas inte.
- Vårdgivaren ska på begäran lämna information om den direktåtkomst och elektroniska åtkomst som har förekommit (patientdatalagen 8 kap. 5 §). Av informationen ska det framgå från vilken vårdenhet och vid vilken tidpunkt någon har tagit del av uppgifterna, utformat så att patienten kan bedöma om åtkomsten var befogad (HSLF-FS 2016:40 4 kap. 10 §, i lydelse till och med HSLF-FS 2025:57).
- Den enskildes elektroniska tillgång får bara medges efter flerfaktorsautentisering (HSLF-FS 2016:40 4 kap. 11 § och 3 kap. 15 §). Om tillgången är begränsad ska den enskilde få veta det, och vart han eller hon kan vända sig för hjälp att förstå dokumentationen (4 kap. 12 §).
- Patienten kan motsätta sig att uppgifter görs tillgängliga för andra vårdenheter, och då ska de spärras. En vårdnadshavare har inte rätt att spärra barnets uppgifter (patientdatalagen 4 kap. 4 §). Patienten har rätt att få information om rätten att begära spärr och om rätten till information om åtkomsten (8 kap. 6 §).
- Ineras beskrivning av 1177 journal (Beskrivning och tjänstespecifika villkor, version 1.8, 2026-06-09, avsnitt 6.2) beskriver hur vårdgivare styr vad som visas: vårdgivaren väljer vilka informationsmängder som visas och kan filtrera på sökord, enhet eller journalmall, vårdnadshavare har tillgång till barnets journal tills barnet fyller 13 år, vårdnadshavare nekas för barn med skyddade personuppgifter, tjänsten kan vara öppen från 16 år och vårdgivaren ska kunna informera invånaren om att viss information inte är tillgänglig. Min journal följer samma upplägg men är inte kopplad till 1177.

### Inloggning och behörighet

- Inloggningssidan har två val, Personal och Patient. Patienten väljer en av de påhittade personerna. E-legitimationen är simulerad och kopplad till ingen extern tjänst, och det står på sidan. Listan före inloggning visar en patient med skyddade personuppgifter som "Skyddad identitet" med maskerat personnummer.
- Invånarens session är skild från personalens: samma sessionskaka och sandlåda, men aldrig båda inloggade. Inloggning som invånare nollställer personalens inloggning, aktiva val och läskopia och byter sessionskaka, och omvänt. Personalens API:er svarar 401 för en invånare, och Min journal svarar 401 för personal.
- Behörigheten prövas i servern i varje anrop med `provaInvanare` i atkomst.js, en ren funktion som `prova`. Egen journal: från 16 år. Vårdnadshavare: barnets journal tills barnet fyller 13 år, aldrig för ett barn med skyddade personuppgifter. Mellan 13 och 16 år läser varken barnet eller vårdnadshavaren journalen i Min journal. Ineras villkor låter vårdgivaren förlänga eller förkorta vårdnadshavarens tillgång i enskilda fall; det är inte byggt.
- En journal som invånaren saknar koppling till svarar 404, oavsett om den finns, så att det inte går att pröva sig fram till andras patient-id. En journal med koppling som inte får läsas nu (barnet har fyllt 13) svarar 403 med skälet. Nekade försök mot en journal som finns loggas på den journalen.
- En invånare får göra högst 20 nekade försök i en sandlåda. Därefter stoppas försöken utan att loggas, så att ingen kan fylla en annan patients logglista med försök. Ett anrop till Min journal eller FHIR som webbläsaren märker som en navigering från en annan webbplats avvisas, eftersom sessionskakan är SameSite=Lax och en annan sida annars kunde få invånaren att göra åtkomster i sitt namn.
- Min journal har ingen läskopia och inget läsläge vid avbrott. Läsläget (D4) gäller personalen.

### Vad som visas

| Uppgift | Regel |
|---|---|
| Anteckningar | Bara signerade, i senaste versionen med äldre versioner överstrukna. Därtill vårdgivarens visningsregler per vårdenhet och anteckningstyp i tabellen `visningsregler` (seed/invanare.js): `direkt`, `fordrojd` (ett antal dagar efter signering) eller `visas_inte`. Den mest specifika regeln gäller. I demon: Allmänpsykiatriska klinikens mottagningsanteckningar visas 14 dagar efter signering, och klinikens omvårdnadsanteckningar visas inte. Det som inte visas räknas och redovisas med vårdgivarens motivering, men innehållet lämnas inte ut. |
| Provsvar | Labbvärden visas när ansvarig läkare har vidimerat dem (kolumnen `vidimerad`), dock senast 14 dagar efter provtagningen. Det som väntar redovisas med provets namn och datum då det senast visas. Vitalparametrar och PEF visas direkt. |
| Diagnoser, läkemedel, överkänslighet, remisser, vårdkontakter | Direkt. Remisser visas med status, frågeställning, svar och motivering vid avvisning. |
| Spärrade uppgifter | Visas för patienten själv. Spärren gäller vårdenheter emellan. Patienten ser vilka spärrar som finns. |
| Vaccinationer, tidbokningar, intyg | Finns inte i journalen i demon och visas därför inte. Det står i tjänsten. |

Att bara signerade anteckningar visas är ett val. Regioner som följer det nationella ramverket för 1177 journal visar i dag ofta också osignerade anteckningar, tydligt markerade, och låter patienten välja att inte se det som är nyare än 14 dagar (till exempel Region Gotlands rutin för 1177 Journalen, STY-09706, version 18.0, avsnitt 3.1). Regeln för osignerade anteckningar och fördröjningen av provsvar är inte konfigurerbara i demon; visningsreglerna för anteckningstyper är det.

Den som har skrivit och signerat en anteckning visas med namn och titel, eftersom det är en del av journalen. Svaren innehåller inte personalens id eller HSA-id, inga NLL-meddelanden, inga varningskvittenser, inga larm och inga kontaktuppgifter.

### Vem har läst min journal

- Logglistan är patientens rader ur samma åtkomstlogg som logguppföljningen. Varje rad har vårdgivare, vårdenhet (och avdelning eller mottagning), yrkesroll, tid, typ av åtkomst och grund (vårdrelation, aktivt val, nödåtkomst, samtycke till spärrade uppgifter, administrativ uppgift, logggranskning, nekad). Nödåtkomst, samtycke och nekade försök är markerade. Loggkedjans kontroll visas. Vårdens rader, invånarens egna och andra invånares hämtas med var sin gräns, så att många läsningar i Min journal aldrig tränger undan vårdens åtkomster ur listan. Logguppföljningen har filtret Vårdens åtkomster av samma skäl.
- **Personalens namn visas inte.** HSLF-FS 2016:40 4 kap. 10 § kräver vårdenhet och tidpunkt men inte användarens identitet, som bara ska finnas i själva loggen (4 kap. 9 a §). Rätten till tillgång enligt dataskyddsförordningen artikel 15 omfattar i regel inte identiteten på de anställda som har behandlat uppgifterna, utom när den är nödvändig för att den registrerade ska kunna utöva sina rättigheter (EU-domstolens dom den 22 juni 2023, C-579/21, Pankki S). Patienten kan i tjänsten begära ett loggutdrag med namn, som vårdgivaren då prövar. Loggens fritext (syftet med ett aktivt val eller en nödåtkomst) visas inte heller, eftersom den skrivs för uppföljningen och inte är prövad för utlämnande.
- Patientens egen läsning loggas med grunden `egen_atkomst` (vårdnadshavarens med `vardnadshavare`), utan personal och vårdenhet och med invånaren i kolumnen `invanare_id`. Raderna syns i patientens logglista, där de är dolda tills patienten väljer att visa dem, och i logguppföljningen som "Patienten själv" respektive vårdnadshavarens namn. De flaggas inte, eftersom de inte är vårdens åtkomst.

### Begäranden till vården

Patienten kan begära att uppgifter från en vårdenhet spärras, att en spärr hävs, och ett loggutdrag med namn. En begäran sparas i tabellen `begaran` med status `skickad`, loggas och visas för patienten. Den ändrar ingenting i journalen eller i spärrarna: vården ska pröva och registrera den. Handläggningen hos vården är inte byggd i demon. En vårdnadshavare kan inte begära spärr eller hävning (patientdatalagen 4 kap. 4 §), men kan begära loggutdrag.

### FHIR

Med sessionen från Min journal når invånaren `/fhir/Patient/{egen}`, `Patient/{egen}/$everything` och sökningar med `patient=` eller `subject=` för de egna journalerna, med samma visningsregler och samma loggning. FHIR-vägen lämnar inte ut mer än Min journal: egna mappningar tar bort kontaktuppgifter, remissens anamnes och remitterande läkare, NLL-status, katalogens id och personalens id, och en äldre version av en anteckning visas bara när den senaste versionen visas. En resurs i en annan journal svarar som en som inte finns. `Practitioner` och `AuditEvent` nekas, `Organization` går att läsa.

## Uppmärksamhetsinformation (Sussa 3.1.5)

Uppmärksamhetsinformation är uppgifter i journalen som vården behöver se direkt för att inte skada patienten, till exempel en överkänslighet som gör att ett annat läkemedel ska väljas. Sussa 3.1.5.1 kräver att den dokumenteras strukturerat enligt Socialstyrelsens nationella rekommendation, 3.1.5.2 att en symbol visas i vyer med patientinformation, och 3.1.5.3 frågar efter omfattning, enkel registrering, säkerhet kring patientens identitet, spårbarhet och enhetlig presentation.

### Källor och vad som är verifierat

| Källa | Vad den används till | Verifierat |
|---|---|---|
| Socialstyrelsen, Instruktion för ändringsförslag gällande Uppmärksamhetsinformation, 2025-09-30, dnr 1015/2025 (socialstyrelsen.se, globalassets/sharepoint-dokument/dokument-webb/ovrigt/instruktion-for-andringsforslag-gallande-uppmarksamhetsinformation.pdf, hämtad 2026-11-03) | Tabell 1 med huvudgrupperna enligt symbolen och undergrupperna, de tre graderna av överkänslighet, symbolens utseende och kriterierna för uppmärksamhetsinformation (bland annat att tillståndet ska vara bestående, åtminstone månader eller år, och att fritext och breda begrepp inte tas med) | Ja, läst i dokumentet. Symbolen är läst från bilden i tabellen |
| Socialstyrelsen, Förvalta och stödja implementering av uppmärksamhetsinformation 2026 (delredovisning, maj 2026, publicerad av E-hälsomyndigheten) | Att specifikationen bygger på nationell informationsstruktur, Snomed CT, ICD-10-SE och ATC, att den har en begreppsmodell, en informationsmodell och en kodverkslista, att den är en fastställd nationell gemensam specifikation i NGS sedan 2021, att patienten kan se uppmärksamhetsinformationen i 1177 journal via Ineras tjänstekontrakt, och att förvaltningen gick över till E-hälsomyndigheten den 1 juni 2026 | Ja, läst i dokumentet |
| E-hälsomyndigheten, nyhet 2025-01-24, Ny version av Informationsspecifikation för uppmärksamhetsinformation | Att version 6.1 publicerades i januari 2025 med ändringar i kodverkslistan | Ja, läst på sidan |
| Region Västmanland, Uppmärksamhetssignalen, nyheter i version 5.1 (regionens användarstöd) | Termerna Läkarbeslut finns från brytpunktssamtal, Sällsynt hälsotillstånd som behöver uppmärksammas särskilt och Artificiell uretrasfinkter, och att regioner i dag kallar huvudgruppen särskild vårdrutin för vårdrutinavvikelse | Ja, läst i dokumentet |
| Socialstyrelsens informationsspecifikation (version 6.1.1 och senare) med kodverkslistan | Den fullständiga listan över termer, Snomed CT-koder och motiveringar | Nej. Länkarna på socialstyrelsen.se svarade med sidan finns inte när de söktes 2026-11-03, troligen efter flytten till E-hälsomyndigheten |

Inte verifierat och därför inte byggt som påstående: exakt vilka termer och koder som ingår i kodverkslistan, hur historisk information som inte är strukturanpassad ska markeras i symbolen, och detaljerna i Ineras tjänstekontrakt för uppmärksamhetsinformation i NPÖ. HSLF-FS 2016:40 innehåller enligt Socialstyrelsens delredovisning viss reglering om uppmärksamhetsinformation; vilka paragrafer det gäller är inte kontrollerat här.

### Strukturen

Tabellen `uppmarksamhet` (`app/src/seed/uppmarksamhet.js`) och modulen `app/src/uppmarksamhet.js` följer tabell 1:

| Huvudgrupp | Undergrupper | Del av symbolen |
|---|---|---|
| Medicinska tillstånd och behandlingar | Annat medicinskt tillstånd, Behandling, Förekomst av implantat, Förekomst av transplantat | Armen uppe till höger, röd |
| Smitta | Förekomst av smittämne, Förekomst av smittsam sjukdom | Armen nere till vänster, gul |
| Överkänslighet (livshotande, skadlig, besvärande) | Kemikalie, Aktiv substans, Hjälpämne läkemedel, Läkemedelsprodukt | Stapeln i mitten, fylld efter graden |
| Särskild vårdrutin | Information som kan leda till särskild vårdrutin, Beslut som kan leda till särskild vårdrutin | Armen nere till höger, blå |

Överkänsligheterna som redan finns i tabellen `overkanslighet` är uppmärksamhetsinformation direkt, så att ingen behöver registrera dem igen. Raden i `uppmarksamhet` bär bara den bekräftade graden. En överkänslighet mot ett födoämne (jordnöt hos patient 9) ryms inte i någon av undergrupperna i tabellen och visas som övrig överkänslighet; Socialstyrelsens delredovisning beskriver ett ändringsförslag om en Övrigt-kod med fritext, som var ute på remiss i maj 2026. Koderna är ATC och ICD-10-SE. Snomed CT används inte i demon.

Varje uppgift har huvudgrupp, undergrupp, term, motivering, kod, vårdenhet, vem som registrerade den och när, och vilken uppgift i journalen den kommer från (ordination eller diagnos). En uppgift avslutas med orsak, och raden finns kvar. En databastrigger stoppar radering.

### Systemet är experten

Förslagsreglerna ligger i `app/src/uppmarksamhet-regler.js` och är märkta som demoregler, inte kliniskt beslutsstöd (D10):

- Antikoagulantia (ATC B01AA, B01AB, B01AE, B01AF) i läkemedelslistan ger Antikoagulantiabehandling. Immunsuppressiva medel (L04) ger Immunsuppressiv behandling, och en stående ordination av glukokortikoider (H02AB) ger Långvarig kortisonbehandling. En tillfällig ordination föreslås inte, eftersom uppmärksamhetsinformation enligt Socialstyrelsens kriterium ska vara bestående; Fragmin efter höftfrakturen hos patient 7 blir därför inget förslag.
- Bärarskap (ICD-10-SE Z22) ger smitta, och tillsammans med U82.1 Resistens mot meticillin blir termen Bärare av MRSA. Tuberkulos (A15, A16), kronisk virushepatit (B18) och hivinfektion (B20 till B24) ger smittsam sjukdom. Implantat (Z95 till Z97) och transplantat (Z94) ger medicinska tillstånd.
- En överkänslighet utan bekräftad grad får en föreslagen grad: anafylaxi i reaktionen ger livshotande, allvarlig ger skadlig och annan besvärande.
- När ordinationen som en uppgift bygger på sätts ut, och ingen annan ordination ger samma uppgift, föreslår systemet att uppgiften avslutas.

Förslagen räknas fram ur det läkaren själv får se i journalen och visas under patienthuvudet med en förklaring. Läkaren bekräftar med ett klick, väljer en annan grad för en överkänslighet, eller trycker Inte aktuellt; ett avfärdat förslag sparas och kommer inte tillbaka. Det som systemet inte kan räkna ut (särskild vårdrutin och vissa tillstånd) registreras genom ett val i en kort lista, aldrig som fritext, som Socialstyrelsens kriterier säger. Flödet att bekräfta ett förslag har en klickbudget på ett klick.

### Symbolen och behörigheten

Symbolen står i patienthuvudet, som är detsamma i alla patientens vyer, och ett klick visar innehållet med när, var och av vem varje uppgift registrerades. Arbetslistan och akutens väntrum visar bara symbolen, med en textbeskrivning för skärmläsare; innehållet är ett klick bort i journalen, som loggas. Symbolen är ritad för Vårdkällan efter samma princip som den nationella symbolen och är inte den nationella bilden.

- Läsa kräver `las_oversikt` (läkare, sjuksköterska och undersköterska). Vårdadministratören ser varken symbol eller innehåll. Bekräfta, registrera, avfärda och avsluta kräver `skriv_journal` (läkare) och vårdrelation, och loggas som `skriv_journal`.
- Uppgifterna är gemensamma som läkemedelslistan och överkänsligheten: de kräver inget aktivt val mellan vårdenheter, men spärrar gäller. En uppgift från en spärrad vårdenhet syns inte i symbolen förrän patienten samtycker.
- Väntrummet visar symbolen bara för akutens personal och aldrig namnet på en patient med skyddade personuppgifter. Symbolen i listorna kräver samma grund som journalen.
- Uppgifterna följer med i läskopian vid avbrott. Under avbrottet går inget att bekräfta.
- Patienten ser sin uppmärksamhetsinformation i Min journal, utan förslag och utan personalens namn.
- FHIR: överkänslighet är `AllergyIntolerance` och övrig uppmärksamhetsinformation `Flag`, med samma behörighet och loggning (se `docs/api-avvikelser.md`). `Flag` validerades 2026-11-03 med HL7:s validator 7.0.3 utan fel.

### Seeden

Patient 1 har penicillinöverkänslighet (skadlig) och står på Waran, som systemet föreslår som Antikoagulantiabehandling. Patient 3 (skyddad identitet, i akutens väntrum) avböjer blodtransfusion. Patient 8 är bärare av MRSA efter vården på infektionskliniken. Patient 9 har livshotande jordnötsallergi. Patient 10 har bekräftad Antikoagulantiabehandling (Eliquis). Allt är påhittat.

### Det som saknas

Kodverkslistan med Snomed CT, överföring till och hämtning från NPÖ, registrering och ändring av själva överkänsligheten (den finns bara i seeden), och klinisk granskning av förslagsreglerna. Söksidan och inkorgen visar ingen symbol.
## Identiteter och sammanslagning (identitet.js, Sussa 3.1.1)

En patient identifieras med personnummer, samordningsnummer, reservnummer eller en annan identitet med OID. Varje patient har exakt en gällande identitet och sin historik i tabellen `identiteter` (status `gallande`, `tidigare` eller `ovrig` för en extra identitet bredvid den gällande). `patienter.personnummer` har den gällande identitetens värde och `patienter.id_typ` dess typ, så att listor, huvud och logg visar rätt nummer utan att fråga identitetstabellen.

Systemet är experten. Ett nummer skrivs eller klistras in i valfritt format, och `tolka()` avgör självt vad det är:

- Personnummer och samordningsnummer med 10 eller 12 siffror, med eller utan bindestreck och mellanslag. Med tio siffror väljs det sekel som inte ger ett födelsedatum i framtiden, och plustecknet betyder att personen har fyllt 100 år. Dag 61 till 91 betyder samordningsnummer. Kontrollsiffran räknas med Luhn-algoritmen.
- Reservnummer: VK, födelsedatumet med åtta siffror, ett löpnummer med tre siffror (sista siffran udda för man och jämn för kvinna) och en kontrollsiffra med samma algoritm, till exempel VK19650509-0023. Formatet är påhittat för demon.
- OID och nummer, med mellanslag, kolon eller lodstreck mellan, eller som `urn:oid:<rot>|<nummer>`. De nationella OID:erna för personnummer (1.2.752.129.2.1.3.1) och samordningsnummer (1.2.752.129.2.1.3.3) och FHIR-systemen från HL7 Sweden känns igen, och då prövas numret som personnummer eller samordningsnummer.

Är något fel säger systemet vad på vanlig svenska: att kontrollsiffran inte stämmer, vilken månad eller dag som inte finns, att födelsedatumet ligger i framtiden, hur många siffror numret har eller att det saknas ett nummer efter en OID. Det finns ingen lista att välja typ i. Gränssnittet visar tolkningen medan numret skrivs (`GET /api/identitet/tolka`).

OID-roten 1.3.6.1.4.1.32473 är IANA:s nummer för dokumentation och exempel (RFC 5612) och tillhör ingen verklig organisation. Demon använder grenen 1.3.6.1.4.1.32473.1: `.1.1` för Vårdkällans reservnummer och `.1.2` för ett påhittat utländskt id-system som en av seedens patienter identifieras med. Vårdkällan utger sig inte för att vara Region Örebro län eller någon annan vårdgivare.

I demon går bara Skatteverkets testpersonnummer att använda (kopia i `seed/testpersonnummer.json`), så att inga riktiga personnummer hamnar i sandlådorna. Skatteverket publicerar inga testsamordningsnummer. Demons samordningsnummer är därför påhittade och byggda på ett testpersonnummer: samma datum och löpnummer, dag plus 60 och en ny kontrollsiffra. Bara sådana samordningsnummer tas emot. Det går inte att kontrollera mot Skatteverket att ett sådant nummer aldrig har delats ut.

### Registrering och ny identitet

- En ny patient registreras från sökvyn. Med ett känt nummer ger numret typ, födelsedatum och kön, och bara namnet behövs (det finns ingen koppling till folkbokföringen i demon). Utan nummer skapar systemet ett reservnummer av kön och födelsedatum, eller av den ungefärliga åldern (då 1 januari det året). Födelsedatum och ålder skrivs i samma fält och systemet avgör vilket det är. Namnet kan saknas och blir då Okänd man eller Okänd kvinna. Den nya patienten får en pågående vårdkontakt på den enhet som registrerade (akut på akutmottagningen, annars öppenvård), så att vården kan dokumentera direkt.
- När personnummer eller samordningsnummer blir känt skrivs det in under fliken Identitet. Ett nummer med samma eller högre rang än det gällande (personnummer, samordningsnummer, OID, reservnummer i den ordningen) blir det gällande, och det gamla blir en tidigare identitet som går att söka på. Ett nummer med lägre rang läggs till som extra identitet. Födelsedatum och kön räknas om från ett personnummer eller samordningsnummer.
- Läkare, sjuksköterskor och vårdadministratörer registrerar patienter och nya identiteter (`registrera_patient`, `andra_identitet`). En ny identitet kräver vårdrelation som all annan åtkomst till patienten.

### Dubbletter och sammanslagning

Systemet hittar själv troliga dubbletter:

- samma namn, födelsedatum och kön när minst en av journalerna saknar personnummer (två olika personnummer är två olika personer), och
- när ett nummer som skrivs in redan tillhör en annan journal. Då sparas ett förslag i `dubblettforslag` i stället för att numret läggs till.

En patient med skyddad identitet föreslås aldrig på namn, bara när någon har skrivit in hela numret. Ett avfärdat förslag (Inte samma person) kommer inte tillbaka.

Vårdadministratören (`sla_samman`) ser förslagen i inkorgen och i patienthuvudet, öppnar journalerna sida vid sida under fliken Identitet och bekräftar. Systemet avgör vilken journal som blir kvar: den med den mest gällande identiteten, och vid lika den som skapades först. Vid ett förslag från ett inskrivet nummer blir journalen som har numret kvar. Två journaler slås bara samman när systemet har ett förslag om dem, och vårdadministratören måste ha vårdrelation till båda journalerna. Ett förslag är ingen behörighet: annars kunde den som skriver in en annan patients nummer få tillgång till den patientens journal genom sammanslagningen. Saknas vårdrelationen till den andra journalen nekas sammanslagningen och försöket loggas på den journalen. Aktiva val och samtycken följer inte med till den gällande journalen. I seeden har kardiologen vårdrelation till Annika Holmgrens båda journaler, genom remissen från Vårdcentralen Kumla och vårdtillfället på avdelning 72.

`slaSamman()` gör allt i en transaktion:

- Alla rader med `patient_id` i alla tabeller flyttas till den journal som blir kvar, också tabeller som läggs till senare: vårdkontakter, anteckningar, diagnoser, mätvärden, överkänslighet, ordinationer, remisser, väntrum, spärrar, begäranden och invånarens koppling i Min journal. Listningen flyttas bara om den gällande journalen saknar en. Signerade anteckningar flyttas utan att ändras: triggern som skyddar dem gäller alla kolumner utom `patient_id`.
- Den gamla journalens identiteter blir tidigare identiteter i den gällande journalen och går att söka på. Den gamla journalen finns kvar som historik med `sammanslagen_till`, och varje anrop på den leder till den gällande journalen (`patientRad` i servern, `gallandeId` i FHIR).
- Skyddad identitet följer med: är någon av journalerna skyddad blir den sammanslagna det. Saknade kontaktuppgifter fylls i från den gamla journalen.
- Åtkomstloggen ändras aldrig. Logglistan, både logggranskarens och patientens i Min journal, visar raderna för den gällande journalen och alla journaler som har slagits samman med den.
- Sammanslagningen loggas på båda journalerna (`sla_samman`) och sparas i `sammanslagningar` med vem, när, varför och vilka rader som flyttades. Tabellen kan inte ändras eller raderas. Att ett förslag visas loggas på den andra journalen (`dubblettkontroll`).

En sammanslagning går inte att ångra i demon.

### FHIR

`Patient.identifier` har alla identiteter: personnummer och samordningsnummer med HL7 Swedens system (`http://electronichealth.se/identifier/personnummer` och `.../samordningsnummer`, slices i SEBasePatient), reservnummer med `urn:oid:1.3.6.1.4.1.32473.1.1` och andra identiteter med sin OID. Den gällande har `use: official`, tidigare `old` och extra `secondary`. Basprofilen tillåter högst ett personnummer och ett samordningsnummer, så en tidigare identitet med samma system som en annan tas inte med i resursen, men den går att söka på. Den gällande journalen har `Patient.link` med `type: replaces` till varje sammanslagen journal, och den gamla journalen är `active: false` med `type: replaced-by`. `GET /fhir/Patient?identifier=` söker på alla identiteter, också tidigare, med eller utan system.

### Seed

Fyra påhittade patienter i `seed/identiteter.js`: Annika Holmgren med personnummer på Vårdcentralen Kumla (16) och samma person med reservnummer, inlagd på kardiologen i natt utan legitimation (17), en dubblett att slå samman. En säsongsarbetare med samordningsnummer på Vårdcentralen Tybble som först hade ett reservnummer (18), och en turist som identifieras med en identitet i det påhittade utländska id-systemet (19).

## Kravregistret (krav.js)

Varje post: `{ id, rubrik, kalla, status: "uppfyllt_demo" | "delvis" | "planerat", var: "sökväg i gränssnittet", tester: ["exakt testnamn"] }`. Vid bygget körs `bun test` och resultatet skrivs till `app/test-resultat.json`, som `/api/krav` läser in. Ett krav får status `uppfyllt_demo` bara om alla dess tester finns och är gröna. Det egna ramverket visas på kravsidan under fliken Eget ramverk (`#/krav?vy=egna`).

## Sussa-registret (sussa/)

Källa: Kravspecifikation lösning, Framtidens vårdinformationsstöd, Sussa samverkan, dnr 16RS2022, utdrag i Konkurrensverkets dnr 883/2023 aktbilaga 3, utlämnad 2026-11-03. Utdraget innehåller kapitel 1 till 6 och 11 med 305 poster i originalnumreringen: 50 krav vid anbud, 90 krav vid leverans och 165 utvärderingskriterier. Kapitel 7 (ekonomi), 8 (användbarhet och tillgänglighet), 9 (styrning och samverkan), 10 (utbildning) och 12 (underhåll och support) ingår inte i utdraget, och kapitel 1 har inga krav. Texterna är avskrivna från de skannade sidorna med rättad stavning, och tankstreck är ersatta med kommatecken.

- `app/src/sussa/kravspec.json`: posterna med `id`, `typ`, `rubrik`, `avsnitt`, `kapitel`, `sida`, `text`, `mervarden` och `kompletterar`, avsnitten med rubrik och sammanfattning, kapitlen och vilka som saknas.
- `app/src/sussa/mappning/<avsnitt>.js`: en fil per avsnitt med poster (61 filer), så att ett avsnitt kan ändras utan att röra de andra. Varje post har `id`, `kategori` (`system`, `nationell` när kravet kräver en nationell tjänst eller extern part, `leverantor` när det gäller leverantören, driften eller projektet), `egna` (kopplade krav i K, D, L och M), `tester`, `avsedd`, `losning` (vad Vårdkällan har i dag), `expert` (hur systemet tar expertrollen) och `anmarkning` (vad som saknas eller är simulerat).
- `app/src/sussa/index.js` samlar filerna och räknar status som för de egna kraven: `uppfyllt_demo` bara när alla tester finns och är gröna, annars `delvis`. En post utan tester är `planerat`. Bygget (`scripts/kor-tester.js`) stoppas om en post pekar på ett test som inte finns.
- Servertesterna i `app/test/sussa.test.js` kontrollerar att alla 305 id finns exakt en gång och har en mappning, att kategorierna är giltiga, att `uppfyllt_demo` kräver gröna tester, att varje system-post som inte är planerad har en expert-text och att källan och de saknade kapitlen anges.

Mappningen är gjord post för post mot testerna i `app/test` och `test/*.cjs`. En post har bara tester som verkligen visar det posten kräver, och hellre `delvis` än en överdriven status. Första mappningen (2026-11-03) gav 10 poster som avses vara uppfyllda i demon, 59 delvis och 236 planerade. Det mesta som är planerat är specialområden (kapitel 4), planering och bokning, nationella tjänstekontrakt och leverantörens åtaganden. Nationella poster och leverantörsposter visas med sin kategori. Simulerat: NLL, inloggningen med SITHS och e-legitimation, och all anslutning till nationella tjänster. Inga nationella tjänstekontrakt är anslutna.

Vyn `#/krav` visar Sussas krav som standard: en sammanställning per kategori och status, filter på kapitel, status och kategori, sökning på id eller text och, när en post öppnas, kravtexten, mervärdena, Vårdkällans lösning, hur systemet är experten, testerna med status och de kopplade egna kraven. Filtret sparas i adressen (`#/krav?kapitel=3&status=delvis`), och `#/krav?post=3.5.2.6` öppnar en post. Data kommer från `GET /api/krav/sussa`.

## Godkännandekriterier för första versionen

- `bun test` grönt, med tester för varje regel i behörighetsmotorn, loggkedjan och triggrarna, signering och rättelse, obligatoriska fält och varningar i läkemedel, NLL-timeout och avstämning, remissens statuskedja och larm, FHIR-svarens form.
- En Playwright-genomgång av varje demoroll utan konsolfel.
- Publik på https://vardkallan.404haven.se, verifierad utifrån.
