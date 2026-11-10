# Läkemedelskontroll

Runda 7: katalogen har utökats till 103 produkter, kontrollerade mot NPL:s totalfil 2026-11-03. Kontrollen beskrivs i `docs/kodkontroll.md` (avsnittet Runda 7).

Runda 11, r7: fyra produkter för intensivvården (Noradrenalin Abcur, Propofol-Lipuro, Midazolam Panpharma och Furix) är inlästa ur NPL:s totalfil 2026-11-10 med förpackningar, på samma sätt. Källorna och kontrollen står i `research/r7-npl/RESULTAT.md` och i `docs/kodkontroll.md` (avsnittet Runda 11, r7).

Kontroll av läkemedelskatalogen och ordinationerna i seeden mot Läkemedelsverkets öppna register, gjord 2026-11-01. Kontrollen hör till kodkontrollen i `docs/kodkontroll.md`. Facit står i `app/src/kodverk.js` (`NPL`), katalogen i `app/src/seed/lakemedel-katalog.js`, och testerna i `app/test/kodverk.test.js` stoppar bygget om katalogen eller ordinationerna avviker.

## Sammanfattning

| Del | Kontrollerade | Rätt | Rättade |
|---|---|---|---|
| Produkter i katalogen | 50 | 3 (Waran, Trombyl, Nitrolingual) | 47 |
| varav namn | 50 | 14 | 36: 32 substansnamn bytta mot en verklig produkt, 4 namn skrivna som i NPL (NovoRapid FlexPen, Lantus (SoloStar), Pulmicort Turbuhaler, EpiPen jr) |
| varav beredningsform | 50 | 20 | 30 |
| varav styrka (skrivsätt) | 50 | 44 | 6 |
| varav substans | 50 | 49 | 1 |
| ATC-kod | 50 | 50 | 0 |
| NPL-id | 50 | 0 | 50 (påhittade ersatta med riktiga) |
| Ordinationer i seeden | 55 | 53 | 2 |

De viktigaste felen:

1. **Inget NPL-id var riktigt.** Katalogen hade påhittade id (`VK-NPL-0001` och så vidare) och FHIR-API:t angav dem med ett eget system. Nu har varje post produktens NPL-id, och FHIR anger det med E-hälsomyndighetens system `http://electronichealth.se/fhir/NamingSystem/nplid`. Vårdkällans egen katalognyckel (`id`) är kvar, eftersom ordinationer, tester och klienten använder den.
2. **32 namn var substansnamn som inte är någon produkt**, till exempel "Metoprolol depot", "Furosemid" och "Kalcium och D-vitamin". I NPL heter produkterna till exempel Metoprolol Sandoz, Furosemid Teva och Kalcipos-D. Varje sådan post har nu en verklig produkt med just den styrkan och beredningsformen, och namnet som i NPL.
3. **Ramipril 5 mg kapsel finns inte längre.** NPL har ramiprilkapslar (till exempel Ramipril Arrow 5 mg kapsel, hård, godkänd 2006 till 2013), men alla är avregistrerade. Posten är nu Ramipril Krka 5 mg tablett.
4. **30 beredningsformer var förenklade**, till exempel "tablett" för en filmdragerad tablett (Eliquis, Xarelto, Brilique, Alvedon och fler) och "injektionsvätska" för en förfylld spruta eller penna. Formen är nu NPL:s.
5. **Två produkter som först valdes visade sig avregistrerade** i NPL trots att de fanns i Läkemedelsfaktas dokumentlista: Diklofenak Sandoz 50 mg enterotablett (avregistrerad 2025-12-16) och Desogestrel STADA 75 mikrogram tablett (avregistrerad 2025-07-17). De byttes mot Diklofenak Orifarm och Desogestrel Sandoz, som är godkända.
6. **Två ordinationer passade inte produkten eller produktresumén**: pivmecillinam 200 mg tre gånger dagligen i tre dagar (produktresumén anger fem dagar för den dosen) och paracetamol 500 mg högst fyra gånger per dygn till ett barn på 27,9 kg (över 60 mg/kg och dygn). Se avsnittet om ordinationerna.

## Källor

Nedladdade filer lästes som data med `python3 -I` i egna kataloger under `$TMPDIR` och kördes aldrig. Alla hämtningar gjordes 2026-11-01, en fil eller sida i taget.

| Källa | Adress | Version och kontrollsumma | Användning |
|---|---|---|---|
| NPL, Nationellt produktregister för läkemedel (Läkemedelsverket), totalfil | https://npl.mpa.se/MpaProductExport/4.5/2026-11-01_Total_NPL.zip, länkad från https://www.lakemedelsverket.se/sv/e-tjanster-och-hjalpmedel/substans-och-produktregister/npl | NPL 4.5, schema `npl-schema_12.2`, skapad 2026-11-01 02:46, 63 184 862 byte, 44 443 produkter, sha256 777f48c22aa766eb6c2ee3e9051e04522b5c83b95bd8d75a1998ba2cb848e438 | Primärkälla: NPL-id, namn (`medprodnamelegal`), styrka, beredningsform, substansbeskrivning, ATC-kod, administrationsvägar, godkännande- och avregistreringsdatum, försäljningsstopp |
| NSL, Nationellt substansregister för läkemedel (Läkemedelsverket) | https://nsl.mpa.se/sensl-v2.0.zip, länkad från https://www.lakemedelsverket.se/sv/e-tjanster-och-hjalpmedel/substans-och-produktregister/nsl | NSL 2.0, filerna daterade 2026-11-01, 1 743 512 byte, sha256 6a8a87249042eb091aaa7f39f89918fa73cbc52f4cedd788dbfe4c1c68246f66 | Svenska substansnamn och ATC-koder för produkternas aktiva beståndsdelar |
| Läkemedelsfakta (Läkemedelsverket), produktsidor | https://www.lakemedelsverket.se/sv/sok-lakemedelsfakta/lakemedel?id=NPL-ID, en sida per produkt med två sekunders paus | 50 sidor | Andra källa för produktens namn, styrka och form (sidans titel) och ATC-kod (sidans beskrivning) |
| Läkemedelsfaktas lista över produktdokument (öppna data) | https://docetp.mpa.se/LMF/Reports/Lakemedelsfakta%20produktdokument-1.1.xml, länkad från https://www.lakemedelsverket.se/sv/om-webbplatsen/oppna-data/produktdokument-for-lakemedel-som-oppen-data | Ändrad 2026-11-01 03:45 GMT, 30 253 301 byte, 17 423 produkter, sha256 75d15ff55d42b2cba3b326468efeeb808ad5db3a9ffad0f952fdb5636317b053 | Att hitta kandidater (produktnamn med styrka och form och NPL-id) |
| Produktresumé Alvedon | https://docetp.mpa.se/LMF/Alvedon%20tablet%2C%20effervescent%20tablet%2C%20powder%20for%20oral%20solution%20SmPC_09001bee807a24ab.pdf | sha256 14e32ca1317bf4fb6990eea5446e855411f629cc39b3383398b2008e7de758a3 | Dosering till barn, avsnitt 4.2 |
| Produktresumé Selexid | https://docetp.mpa.se/LMF/Selexid%20film-coated%20tablet%20SmPC_09001bee807a6d20.pdf | sha256 27dd6950f73a302381955aaaca0c2e4d84ea986ce52ab86a40b8d5029151e4f0 | Dosering, avsnitt 4.2 |
| E-hälsomyndighetens FHIR-profiler för Nationella läkemedelslistan | https://packages.fhir.org/se.electronichealth.fhir.nll.r4/1.3.1 | `se.electronichealth.fhir.nll.r4` 1.3.1, sha256 adab13561fc2e7f6881d8bf7c3e0f0f174c4fd41bbd55f3b7b678f8888f1e428 | Systemadress för NPL-id (`NLLMedicationRequest`, delen `coding:nplid`) |
| HL7 Swedens basprofiler | https://packages.fhir.org/hl7se.fhir.base/1.1.0 | `hl7se.fhir.base` 1.1.0, sha256 3d31a95de3a67a0deba8e2cd3a9a6582d51464a6028e66e35063024bd18372b7 | Innehåller ingen systemadress för NPL |
| WHO:s ATC-register | Samma som i `docs/kodkontroll.md` | | ATC-koderna och WHO:s benämningar |

Läkemedelsverket publicerar NPL och NSL som öppna data. NPL är enligt Läkemedelsverkets sida öppet för alla besökare från Sverige utan registrering. Ett utdrag med de 50 produkternas fält ur NPL, Läkemedelsfakta och NSL finns i `research/lakemedel/kontroll-2026-11-01.json`. NSL:s Snomed CT-koder, som har egna villkor, finns inte med i utdraget. Hela filerna finns inte i repot.

Källor som inte användes:

- **VARA** (E-hälsomyndighetens nationella produkt- och artikelregister). XML-filen lämnas ut efter förfrågan med e-post till E-hälsomyndigheten (https://www.ehalsomyndigheten.se/verksamhet/tjanster/vara--produkt--och-artikelregister/), så den är inte öppet nedladdningsbar och användes inte. Varunummer och förmånsstatus är därför inte kontrollerade.
- **FASS** användes inte. Allt som behövdes fanns i Läkemedelsverkets egna källor.

## Så gjordes kontrollen

1. För varje katalogpost söktes kandidater med samma substans, styrka och beredningsform i Läkemedelsfaktas dokumentlista. Där katalogen hade ett varumärke (Waran, Eliquis, Selexid och så vidare) behölls det. Där katalogen hade ett substansnamn valdes en godkänd generisk produkt vars namn börjar med substansnamnet (till exempel Furosemid Teva), så att sökning och visning ser ut ungefär som förut. Parallellimporterade produkter (samma namn med en annan innehavare, till exempel Nitrolingual från Abacus Medicine) valdes inte.
2. Varje vald produkt lästes ur NPL:s totalfil: namn, styrka, beredningsform (NPL:s lexikon `pharmaceutical-form-lx`, svensk text), substansbeskrivning (`substance-description-lx`), ATC-kod, administrationsvägar, godkännandedatum, avregistreringsdatum och försäljningsstopp. Alla 50 är humanläkemedel (produktklass MEP), ingen är avregistrerad och ingen har stoppad försäljning.
3. Läkemedelsfaktas produktsida för samma NPL-id hämtades. För alla 50 är sidans titel exakt `namn styrka form` som i NPL (med liten bokstav i formen), och sidans ATC-kod är NPL:s.
4. Produktens aktiva beståndsdelar i NPL (rollerna aktiv beståndsdel och aktiv motsvarande) slogs upp i NSL. För 49 av 50 finns katalogens ATC-kod bland de ATC-koder som NSL anger för substansen. Undantaget är Kalcipos-D med `A12AX` (kalcium i kombination med vitamin D), en kombinationskod som NSL inte knyter till kalciumkarbonat eller kolekalciferol var för sig. NPL och Läkemedelsfakta anger båda `A12AX` för produkten.
5. Katalogens substans är NPL:s substansbeskrivning med liten begynnelsebokstav (till exempel warfarin för Waran, vars aktiva beståndsdel är warfarinnatrium). ATC-koden är kontrollerad mot WHO som tidigare.
6. Ordinationerna i seeden gicks igenom mot produktens styrka, form och administrationsvägar (se nedan), och de två som avvek kontrollerades mot produktresumén.
7. Svaren från FHIR-API:t validerades igen med HL7:s validator, se `docs/fhir-validering.md`.

## Produkterna

Före är katalogens tidigare namn, styrka och form. Efter är produkten i NPL, skriven som Läkemedelsfakta skriver den.

| Nr | Före | Efter (NPL) | NPL-id | ATC | Rättat |
|---|---|---|---|---|---|
| 1 | Waran 2,5 mg tablett | Waran 2,5 mg tablett | 19640101000028 | B01AA03 | rätt |
| 2 | Eliquis 5 mg tablett | Eliquis 5 mg filmdragerad tablett | 20111026000050 | B01AF02 | form |
| 3 | Xarelto 20 mg tablett | Xarelto 20 mg filmdragerad tablett | 20101127000035 | B01AF01 | form |
| 4 | Fragmin 5000 IE injektionsvätska | Fragmin 5000 IE injektionsvätska, lösning i förfylld spruta | 19880318000057 | B01AB04 | form |
| 5 | Klexane 40 mg injektionsvätska | Klexane 4 000 IE (40 mg)/0,4 ml injektionsvätska, lösning i förfylld spruta | 20170530000130 | B01AB05 | styrka (skrivsätt), form |
| 6 | Trombyl 75 mg tablett | Trombyl 75 mg tablett | 19910906000043 | B01AC06 | rätt |
| 7 | Brilique 90 mg tablett | Brilique 90 mg filmdragerad tablett | 20100114000225 | B01AC24 | form |
| 8 | Metoprolol depot 50 mg depottablett | Metoprolol Sandoz 50 mg depottablett | 20041011000027 | C07AB02 | namn |
| 9 | Bisoprolol 5 mg tablett | Bisoprolol Teva 5 mg tablett | 20001201000015 | C07AB07 | namn |
| 10 | Furosemid 40 mg tablett | Furosemid Teva 40 mg tablett | 19900615000168 | C03CA01 | namn |
| 11 | Spironolakton 25 mg tablett | Spironolakton Pfizer 25 mg tablett | 19820205000142 | C03DA01 | namn |
| 12 | Enalapril 10 mg tablett | Enalapril Krka 10 mg tablett | 20041208000021 | C09AA02 | namn |
| 13 | Ramipril 5 mg kapsel | Ramipril Krka 5 mg tablett | 20100615000052 | C09AA05 | namn, form |
| 14 | Losartan 50 mg tablett | Losartan Krka 50 mg filmdragerad tablett | 20090220000106 | C09CA01 | namn, form |
| 15 | Amlodipin 5 mg tablett | Amlodipin Krka 5 mg tablett | 20060518000033 | C08CA01 | namn |
| 16 | Digoxin 0,13 mg tablett | Digoxin Evolan 0,13 mg tablett | 19741206000095 | C01AA05 | namn |
| 17 | Nitrolingual 0,4 mg/dos sublingualspray | Nitrolingual 0,4 mg/dos sublingualspray | 19931008000069 | C01DA02 | rätt |
| 18 | Atorvastatin 40 mg tablett | Atorvastatin Krka 40 mg filmdragerad tablett | 20070404000061 | C10AA05 | namn, form |
| 19 | Simvastatin 20 mg tablett | Simvastatin Krka 20 mg filmdragerad tablett | 20041018000303 | C10AA01 | namn, form |
| 20 | Metformin 500 mg tablett | Metformin Sandoz 500 mg filmdragerad tablett | 20070911000042 | A10BA02 | namn, form |
| 21 | Jardiance 10 mg tablett | Jardiance 10 mg filmdragerad tablett | 20140528000015 | A10BK03 | form |
| 22 | NovoRapid 100 E/ml injektionsvätska | NovoRapid FlexPen 100 E/ml injektionsvätska, lösning i förfylld injektionspenna | 20010115000066 | A10AB05 | namn, form |
| 23 | Lantus 100 E/ml injektionsvätska | Lantus (SoloStar) 100 enheter/ml injektionsvätska, lösning i förfylld injektionspenna | 20000609000061 | A10AE04 | namn, styrka (skrivsätt), form |
| 24 | Levaxin 100 mikrog tablett | Levaxin 100 mikrogram tablett | 19541213000015 | H03AA01 | styrka (skrivsätt) |
| 25 | Omeprazol 20 mg enterokapsel | Omeprazol Sandoz 20 mg enterokapsel, hård | 20090716000061 | A02BC01 | namn, form |
| 26 | Alvedon 500 mg tablett | Alvedon 500 mg filmdragerad tablett | 19581115000027 | N02BE01 | form |
| 27 | Ibuprofen 400 mg tablett | Ibuprofen Orifarm 400 mg filmdragerad tablett | 20060817000079 | M01AE01 | namn, form |
| 28 | Naproxen 250 mg tablett | Naproxen Orifarm 250 mg tablett | 20040607002797 | M01AE02 | namn |
| 29 | Diklofenak 50 mg enterotablett | Diklofenak Orifarm 50 mg enterotablett | 20040607002094 | M01AB05 | namn |
| 30 | Oxikodon 5 mg kapsel | Oxikodon Actavis 5 mg kapsel, hård | 20111221000060 | N02AA05 | namn, form |
| 31 | Morfin 10 mg/ml injektionsvätska | Morfin Abcur 10 mg/ml injektionsvätska, lösning | 20110104000104 | N02AA01 | namn, form |
| 32 | Bensylpenicillin 3 g pulver till injektionsvätska | Bensylpenicillin Noridem 3 g pulver till injektions-/infusionsvätska, lösning | 20230703000333 | J01CE01 | namn, form |
| 33 | Kåvepenin 1 g tablett | Kåvepenin 1 g filmdragerad tablett | 19790831000024 | J01CE02 | form |
| 34 | Amoxicillin 750 mg tablett | Amoxicillin Sandoz 750 mg filmdragerad tablett | 20070919000044 | J01CA04 | namn, form |
| 35 | Selexid 200 mg tablett | Selexid 200 mg filmdragerad tablett | 19771216000013 | J01CA08 | form |
| 36 | Doxycyklin 100 mg tablett | Doxycyklin EQL Pharma 100 mg tablett | 20111018000013 | J01AA02 | namn |
| 37 | Nitrofurantoin 50 mg tablett | Nitrofurantoin Alternova 50 mg tablett | 20140906000019 | J01XE01 | namn |
| 38 | Airomir 0,1 mg/dos inhalationsspray | Airomir 0,1 mg/dos inhalationsspray, suspension | 19960403000015 | R03AC02 | form |
| 39 | Pulmicort 200 mikrog/dos inhalationspulver | Pulmicort Turbuhaler 200 mikrogram/dos inhalationspulver | 19881209000118 | R03BA02 | namn, styrka (skrivsätt) |
| 40 | EpiPen Jr 150 mikrog injektionsvätska i förfylld injektor | EpiPen jr 150 mikrogram injektionsvätska, lösning i förfylld injektionspenna | 19961025000032 | C01CA24 | namn, styrka (skrivsätt), form |
| 41 | Sertralin 50 mg tablett | Sertralin Teva 50 mg filmdragerad tablett | 20060510000031 | N06AB06 | namn, form |
| 42 | Escitalopram 10 mg tablett | Escitalopram Krka 10 mg filmdragerad tablett | 20130410000049 | N06AB10 | namn, form |
| 43 | Mirtazapin 15 mg tablett | Mirtazapin Krka 15 mg filmdragerad tablett | 20040916002945 | N06AX11 | namn, form |
| 44 | Zopiklon 5 mg tablett | Zopiklon Pilum 5 mg filmdragerad tablett | 20110326000029 | N05CF01 | namn, form |
| 45 | Melatonin 2 mg depottablett | Melatonin Bluefish 2 mg depottablett | 20221130000058 | N05CH01 | namn |
| 46 | Donepezil 5 mg tablett | Donepezil Krka 5 mg filmdragerad tablett | 20110113000041 | N06DA02 | namn, form |
| 47 | Alendronat 70 mg tablett | Alendronat Teva Veckotablett 70 mg tablett | 20050805000013 | M05BA04 | namn |
| 48 | Kalcium och D-vitamin 500 mg/400 IE tuggtablett | Kalcipos-D 500 mg/400 IE tuggtablett | 20030905000052 | A12AX | namn, substans |
| 49 | Prednisolon 5 mg tablett | Prednisolon Pfizer 5 mg tablett | 19730831000037 | H02AB06 | namn |
| 50 | Desogestrel 75 mikrog tablett | Desogestrel Sandoz 75 mikrogram filmdragerad tablett | 20100621000022 | G03AC09 | namn, styrka (skrivsätt), form |

Kommentarer till enskilda poster:

- Waran, Trombyl och Nitrolingual stämde redan. Nitrolingual finns i NPL också som parallellimport med andra NPL-id; katalogen har den svenska godkännandeinnehavarens produkt.
- Klexane 40 mg heter i NPL 4 000 IE (40 mg)/0,4 ml. Enoxaparin anges i internationella enheter och milligram.
- NovoRapid och Lantus är nu förfyllda pennor (NovoRapid FlexPen, Lantus i SoloStar-penna), som är den vanliga formen för en patient med diabetes typ 1 eller 2 i öppenvård. NPL skriver "100 enheter/ml" för Lantus och "100 E/ml" för NovoRapid, och katalogen följer NPL.
- Substansen för Kalcipos-D är NPL:s beskrivning "kalcium + kolekalciferol (vitamin D3)". Den aktiva beståndsdelen är kalciumkarbonat (motsvarande 500 mg kalcium) och kolekalciferol.
- Ordinationernas startdatum ligger inte före produktens godkännande i NPL, vilket testet `Kodverk > ingen ordination i seeden börjar före produktens godkännande i NPL` håller fast. Bensylpenicillin Noridem är godkänd 2025-04-10 och ordineras bara i det pågående förloppet.

## Ordinationerna i seeden

Alla 55 ordinationer (35 olika produkter) gicks igenom: dosen jämfört med produktens styrka, doseringstexten jämfört med beredningsformen, och administrationsvägen i texten (intravenöst, subkutant, under tungan, inhalation, i låret) jämfört med NPL:s administrationsvägar för produkten. Testet `Kodverk > ordinationerna i seeden har dos och administrationsväg som passar produktens styrka och form` kontrollerar att en dos i samma enhet som styrkan är ett helt antal tabletter, kapslar eller sprutor (1 till 4), att antalet i doseringstexten är detsamma, att insulin doseras i enheter mot en styrka i enheter per ml, att doser från sprayer och inhalatorer har en styrka per dos, och att texten inte nämner en form eller väg som produkten saknar. En kontroll med avsiktligt fel (3 tabletter sertralin 50 mg som dos 100 mg, och morfin som subkutan injektion i IE) fick testet att fallera.

Rättade ordinationer:

| Patient | Ordination före | Efter | Skäl |
|---|---|---|---|
| p03 | Selexid 200 mg, 1 tablett 3 gånger dagligen i 3 dagar | 1 tablett 3 gånger dagligen i 5 dagar (slutdatum två dagar senare, journalanteckningen säger fem dagar) | Produktresumén för Selexid anger 200 mg 2 gånger dagligen i 7 dagar, 200 mg 3 gånger dagligen i 5 dagar eller 400 mg 2 till 3 gånger dagligen i 3 dagar. Tre dagar med 200 mg tre gånger dagligen finns inte. |
| p09 (barn, 27,9 kg) | Alvedon 500 mg, 1 tablett vid behov, högst 4 per dygn | 1 tablett vid behov, minst 6 timmar mellan doserna, högst 3 per dygn | Produktresumén för Alvedon 500 mg filmdragerad tablett anger för barn 25 till 40 kg ½ till 1 tablett var 4 till 6 timme, högst 4 gånger per dygn, och en maximal dygnsdos på 60 mg/kg. Fyra tabletter är 2 000 mg, 72 mg/kg för barnet. Tre tabletter är 1 500 mg, 54 mg/kg. |

Inget annat avvek. Några kontroller som gjordes:

- Metoprolol 2 depottabletter à 50 mg (100 mg), Furosemid 40 mg morgon och kl 14, Atorvastatin 2 tabletter à 40 mg (80 mg) och Sertralin 2 tabletter à 50 mg (100 mg) går jämnt upp i produktens styrka.
- Fragmin 5000 IE subkutant är en förfylld spruta, Bensylpenicillin 3 g intravenöst är en injektionsflaska, Nitrolingual under tungan är sublingual, EpiPen jr i lårets utsida är intramuskulär, och Airomir och Pulmicort Turbuhaler är inhalation, som i NPL.
- Eliquis 5 mg två gånger dagligen till p10 (80 år, 85 kg, kreatinin 118 µmol/L) uppfyller bara ett av kriterierna för dosminskning till 2,5 mg (ålder minst 80, vikt högst 60 kg, kreatinin minst 133 µmol/L), så 5 mg är rätt dos. Kriterierna är de allmänt kända för apixaban vid förmaksflimmer och är inte kontrollerade mot produktresumén i den här kontrollen.
- Metformin 500 mg två gånger dagligen till p06 (eGFR 33) är 1 000 mg per dygn, och läkemedelsvarningen för eGFR 30 till 44 visas fortfarande.
- EpiPen jr 150 mikrogram passar barnets vikt (27,9 kg).

Läkemedelsvarningarna i `app/src/lakemedel.js` bygger på ATC-koder, som inte ändrades, och testerna för varningarna (`app/test/lakemedel.test.js`) är gröna.

## NPL-id i FHIR

E-hälsomyndighetens FHIR-profiler för Nationella läkemedelslistan anger NPL-id i `MedicationRequest.medicationCodeableConcept.coding` med systemet `http://electronichealth.se/fhir/NamingSystem/nplid` (delen `nplid` i profilen `NLLMedicationRequest`, version 1.3.1). Enligt profilen omfattar systemet både Läkemedelsverkets NPL-id och E-hälsomyndighetens SB-id. Profilens exempel har ingen `display` för NPL-id, och det har inte Vårdkällan heller. HL7 Swedens basprofiler har ingen systemadress för NPL. Vårdkällan påstår inte att den följer NLL-profilen.

```json
"medicationCodeableConcept": {
  "coding": [
    { "system": "http://www.whocc.no/atc", "code": "B01AA03", "display": "warfarin" },
    { "system": "http://electronichealth.se/fhir/NamingSystem/nplid", "code": "19640101000028" }
  ],
  "text": "Waran 2,5 mg tablett"
}
```

`GET /api/lakemedel/katalog` och läkemedlet i en ordination har fältet `npl` med NPL-id.

## Det som inte gick att kontrollera

- **Förpackning och förmån.** Vårdkällan väljer ingen förpackning, så NPL-pack-id saknas. E-hälsomyndighetens profiler för NLL kräver NPL-pack-id eller varunummer vid förskrivning (felkod 2-25-1370). Varunummer och förmånsstatus finns i VARA, som inte är öppet nedladdningsbart.
- **Att produkterna faktiskt säljs.** NPL anger godkännande, avregistrering och försäljningsstopp, och ingen produkt är avregistrerad eller stoppad. Om produkten marknadsförs just nu står i VARA och är inte kontrollerat.
- **Klinisk dosering i övrigt.** Doserna är kontrollerade mot produktens styrka och form, och de två avvikande mot produktresumén. Övriga doser, indikationer och interaktioner är inte kontrollerade mot respektive produktresumé.
- **Fri text i journalanteckningarna** (till exempel "Metoprolol depot 50 mg 1x1" och "Furosemid 40 mg iv") är skriven som en läkare skriver och nämner substanser, inte produkter. Den är inte ändrad, utom att Selexid-anteckningen nu säger fem dagar.
- **Validering av NPL-id i HL7:s validator.** Terminologiservern har inte NPL, så validatorn kan inte kontrollera koderna, se `docs/fhir-validering.md`. Kontrollen av dem är den här rapporten och testerna.

## Förpackningar (runda 6, 2026-11-03)

Förpackningarna med NPL-pack-id lästes ur NPL:s totalfil https://npl.mpa.se/MpaProductExport/4.5/2026-11-03_Total_NPL.zip (63 185 679 byte, sha256 06b74dd8e01c20f0237dca98db187ffb59095727cb0e0dab25c3380686465fc9), som data med `python3 -I research/lakemedel/forpackningar.py` i en egen katalog under `$TMPDIR`. Utdraget med alla förpackningar för de 50 produkterna, med avregistreringsdatum och om förpackningen är parallelldistribuerad, finns i `research/lakemedel/forpackningar-2026-11-03.json`.

`research/lakemedel/forpackningar-seed.py` skriver `app/src/seed/forpackningar.js` och facit `app/test/data/npl-forpackningar.json`. Bara förpackningar som inte är avregistrerade och inte parallelldistribuerade tas med, högst fyra per produkt, och en endosförpackning är förval när produkten har en. Det gav 175 förpackningar i katalogen av 446 giltiga i NPL. Testet `Förpackning med NPL-pack-id > katalogens förpackningar finns i NPL under samma produkt och är inte avregistrerade` jämför varje förpackning med facit.

Systemadressen för NPL-pack-id i FHIR är `http://electronichealth.se/fhir/NamingSystem/nplpackid`, som delen `coding:nplpackid` i `NLLMedicationRequest` i `se.electronichealth.fhir.nll.r4` 1.3.1 (samma paket och kontrollsumma som ovan).

Läkemedelstyperna utanför NPL (`app/src/seed/produkttyper.js`) är påhittade demoposter. Deras ATC-koder (A11DA01, B05AX01, B05AX03, B05XA01, B05XA03 och V06DB) och WHO:s benämningar är kontrollerade i WHO:s ATC/DDD-index (atcddd.fhi.no, senast uppdaterat 2026-01-20) den 2026-11-03.
