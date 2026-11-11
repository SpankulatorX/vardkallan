# Intensivvårdsläkemedel ur NPL, uttag 2026-11-10

Fyra godkända produkter för intensivvård, lästa ur Läkemedelsverkets NPL-totalfil för 2026-11-10 och kontrollerade mot NSL, Läkemedelsfaktas produktdokumentlista och Läkemedelsfaktas produktsidor. Kontrollen gjordes på samma sätt som i `docs/lakemedelskontroll.md`. Fälten i `produkter.json` står med NPL:s egen text (stor begynnelsebokstav i form och substans, som i facit `NPL` i `app/src/kodverk.js`). I katalogen `app/src/seed/lakemedel-katalog.js` skrivs form och substans med liten begynnelsebokstav.

## Källor

Nedladdade filer lästes som data med `python3 -I` i egna kataloger under `$TMPDIR` och kördes aldrig. Alla hämtningar gjordes 2026-11-10, en fil eller sida i taget. Totalfilen, NSL och dokumentlistan finns inte i repot.

| Källa | Adress | Version, storlek och kontrollsumma | Användning |
|---|---|---|---|
| NPL, totalfil | https://npl.mpa.se/MpaProductExport/4.5/2026-11-10_Total_NPL.zip | NPL 4.5, schema `npl-schema_12.2`, Last-Modified 2026-11-10 01:46:16 GMT, 63 233 889 byte, 44 471 produktfiler, sha256 b9ed4ac22572b41a62ee20ac87453f2059a4ef56d9254a77b0ec930a1babcdbd | Primärkälla: NPL-id, namn (`medprodnamelegal`), styrka, beredningsform, substansbeskrivning, ATC-kod, administrationsvägar, produktklass, innehavare, godkännande- och avregistreringsdatum, försäljningsstopp, förpackningar |
| NSL | https://nsl.mpa.se/sensl-v2.0.zip | NSL 2.0, Last-Modified 2026-11-10 00:40:15 GMT, 1 750 877 byte, sha256 3158d494c14787d972bb461c42bceeec6067a6f29fb7fd869a53fdb719d43437 | Svenska officiella namn och ATC-koder för de aktiva beståndsdelarna |
| Läkemedelsfaktas produktdokumentlista (öppna data) | https://docetp.mpa.se/LMF/Reports/Lakemedelsfakta%20produktdokument-1.1.xml | Last-Modified 2026-11-10 03:45:19 GMT, 30 254 643 byte, 43 697 dokument för 17 433 produkter, sha256 f675011eb9c8164e682d7dbc1e7e202dc4758bbbcae70ce51c378b8f5a57eaf9 | Om produkten har produktresumé och bipacksedel i Läkemedelsfakta |
| Läkemedelsfakta, produktsidor | https://www.lakemedelsverket.se/sv/sok-lakemedelsfakta/lakemedel?id=NPL-ID | 6 sidor, en i taget med två sekunders paus, alla HTTP 200 (kontrollsummor nedan) | Andra källa för namn, styrka och form (sidans titel) och ATC-kod (sidans beskrivning) |

Produktsidornas kontrollsummor (sha256):

| NPL-id | Byte | sha256 |
|---|---|---|
| 20070331000011 | 399 968 | 7c5142a1e43f89222328c36dbf06c8a0fc7ad2ab0df41111e4988fef39e3e284 |
| 20000825000258 | 399 968 | b132acd20ab68ebe1680e09b13e07b82c9ab4296b1a4d2786e0595cd3bfdd06f |
| 20051112000024 | 399 884 | 539bd88ff5837a806af3aa110e69fcb9bb657d401c401ed61f450b646e08416f |
| 19801003000053 | 399 806 | 3136a9466dfdaed84e3abdeffe6696d79dba3e394b183a9f12dc70abfa3c3604 |
| 20040921000028 | 399 938 | e03ee067694b30aa1904e9d5208d90c4f257b542be51c9c75670fcb4c7a82b8e |
| 20000225000223 | 399 930 | 344473568bd919ced6cfe0c52e5b9d91c53d72d55bbc4252c8a6a08f4bc97b5b |

Skripten i den här katalogen: `npl-detalj.py` (detaljer ur totalfilen), `visa.py` (rått produkthuvud), `nsl-namn.py` (NSL-namn och ATC), `lmf-dok.py` (dokumentlistan) och `lmf-sida.py` (produktsidorna). Kandidaterna söktes med `research/lakemedel/npl-index.py` och `research/lakemedel/npl-sok.py`.

## Så valdes produkterna

1. Totalfilen indexerades och alla produkter med substansen söktes fram. Bara produkter som inte är avregistrerade, inte har stoppad försäljning och har minst en förpackning som varken är avregistrerad eller parallelldistribuerad togs med.
2. Licensläkemedel (produktklass Licensläkemedel, utan godkännandedatum) valdes bort, till exempel Propofol 1% MCT/LCT Fresenius, Midazolam B. Braun och Furosemid Accord 20250717000013. Parallellimport valdes inte (till exempel Propofol-Lipuro 20240410000069 med innehavaren Ebb Medical AB, nationella proceduren).
3. Där uppdraget nämnde ett varumärke valdes det om det fanns med rätt styrka och form. För midazolam valdes Midazolam Panpharma eftersom dess form är exakt injektionsvätska, lösning. Midazolam hameln 5 mg/ml har formen injektions-/infusionsvätska, lösning och redovisas som alternativ.
4. Varje vald produkt kontrollerades mot NSL, dokumentlistan och produktsidan.

## 1. Noradrenalin Abcur 1 mg/ml

| Fält | Värde |
|---|---|
| NPL-id | 20070331000011 |
| Namn (NPL `medprodnamelegal`) | Noradrenalin Abcur (historiskt namn till 2009-07-05: Noradrenalin Abcur Sulfitfri) |
| Styrka | 1 mg/ml |
| Beredningsform | Koncentrat till infusionsvätska, lösning (kod COSINF) |
| Substans (NPL substansbeskrivning) | Noradrenalin |
| Aktiva beståndsdelar (NSL) | noradrenalintartrat (monohydrat), även norepinefrinbitartrat (aktiv beståndsdel, 2 mg/ml); norepinefrin (aktiv motsvarande, 1 mg/ml). NSL anger ATC C01CA03 för båda |
| ATC | C01CA03 |
| Administrationsväg | INVE (intravenös användning) |
| Produktklass och förfarande | Läkemedel (MEP), proceduren för ömsesidigt erkännande |
| Innehavare | Abcur AB |
| Godkänd | 2009-07-03 |
| Status | Inte avregistrerad, försäljning inte stoppad, receptbelagd, ingen narkotikaklass |
| Förpackningar | 24 av 24 giltiga (ampuller 1, 2, 4, 5, 8 och 10 ml) |
| Läkemedelsfaktas dokumentlista | Ja, 5 dokument: produktresumé (svensk 2019-12-11, engelsk 2019-09-26), bipacksedel (svensk och engelsk 2024-11-21) och PAR (engelsk 2013-02-11) |
| Läkemedelsfaktas produktsida | Titel "Noradrenalin Abcur 1 mg/ml koncentrat till infusionsvätska, lösning", ATC-kod C01CA03. Stämmer med NPL |

Andra godkända noradrenalinprodukter 1 mg/ml, koncentrat till infusionsvätska, lösning: Noradrenalin Pfizer (20090910000010), Noradrenaline Sintetica (20171222000032), Noradrenalin Kalceks (20190527000127), Noradrenalin Fresenius Kabi (20200414000083), Noradrenalin Noridem (20220203000018), Noradrenalin Zentiva (20231016000034) och Noradrenalin Laboratoire Aguettant (20240131000096).

## 2. Propofol-Lipuro 10 mg/ml

| Fält | Värde |
|---|---|
| NPL-id | 20000825000258 |
| Namn (NPL `medprodnamelegal`) | Propofol-Lipuro |
| Styrka | 10 mg/ml |
| Beredningsform | Injektionsvätska/infusionsvätska, emulsion |
| Substans (NPL substansbeskrivning) | Propofol |
| Aktiv beståndsdel (NSL) | propofol, ATC N01AX10 (och QN01AX10 för djur) |
| ATC | N01AX10 |
| Administrationsväg | INVE (intravenös användning) |
| Produktklass och förfarande | Läkemedel (MEP), proceduren för ömsesidigt erkännande |
| Innehavare | B. Braun Melsungen AG (ombud B. Braun Medical AB) |
| Godkänd | 2000-08-25 |
| Status | Inte avregistrerad, försäljning inte stoppad, receptbelagd, ingen narkotikaklass |
| Förpackningar | 7 av 8 giltiga (ampuller 10 och 20 ml, injektionsflaskor 20, 50 och 100 ml); glasflaskan 100 ml avregistrerades 2004-06-16 |
| Läkemedelsfaktas dokumentlista | Ja, 2 dokument: produktresumé och bipacksedel, svenska, 2024-09-03 |
| Läkemedelsfaktas produktsida | Titel "Propofol-Lipuro 10 mg/ml injektionsvätska/infusionsvätska, emulsion", ATC-kod N01AX10. Stämmer med NPL |

Alternativ: Propolipid 10 mg/ml (20040921000028, Fresenius Kabi AB, godkänd 2005-04-22, samma form, 11 av 11 giltiga förpackningar, produktresumé och bipacksedel 2024-10-14 i dokumentlistan). Produktsidan har titeln "Propolipid 10 mg/ml injektionsvätska/infusionsvätska, emulsion" och ATC-kod N01AX10. Även Profast 10 mg/ml (20090909000014, Baxter) är godkänd med samma form.

Uppdraget skrev formen som injektions-/infusionsvätska, emulsion. NPL skriver injektionsvätska/infusionsvätska, emulsion för alla godkända humanläkemedel med propofol 10 mg/ml utom den förfyllda sprutan (Propofol-Lipuro två gånger, Propolipid och Profast), och Läkemedelsfakta skriver likadant för de två produkter som kontrollerades. Formen injektions-/infusionsvätska, emulsion i förfylld spruta finns bara för Propolipid i förfylld spruta (20110917000056).

## 3. Midazolam Panpharma 5 mg/ml

| Fält | Värde |
|---|---|
| NPL-id | 20051112000024 |
| Namn (NPL `medprodnamelegal`) | Midazolam Panpharma |
| Styrka | 5 mg/ml |
| Beredningsform | Injektionsvätska, lösning |
| Substans (NPL substansbeskrivning) | Midazolam |
| Aktiv beståndsdel (NSL) | midazolam, ATC N05CD08 (och QN05CD08 för djur) |
| ATC | N05CD08 |
| Administrationsvägar | INMU (intramuskulär), INVE (intravenös), RECT (rektal användning) |
| Produktklass och förfarande | Läkemedel (MEP), proceduren för ömsesidigt erkännande |
| Innehavare | Panpharma SA (ombud Panpharma Nordic AS) |
| Godkänd | 2006-10-06 |
| Status | Inte avregistrerad, försäljning inte stoppad, receptbelagd, narkotikaklass IV (narkotika med medicinsk användning) |
| Förpackningar | 14 av 14 giltiga (ampuller 1 och 3 ml, injektionsflaskor 10 ml) |
| Läkemedelsfaktas dokumentlista | Ja, 2 dokument: bipacksedel (svensk 2023-09-11) och produktresumé (svensk 2026-03-16) |
| Läkemedelsfaktas produktsida | Titel "Midazolam Panpharma 5 mg/ml injektionsvätska, lösning", ATC-kod N05CD08. Stämmer med NPL |

Alternativ: Midazolam hameln 5 mg/ml (20000225000223, Hameln Pharma gmbh, godkänd 2000-02-25), formen injektions-/infusionsvätska, lösning, substansen i NSL midazolamhydroklorid (aktiv beståndsdel) med midazolam som aktiv motsvarande, 30 av 30 giltiga förpackningar, produktresumé (2025-11-28) och bipacksedel (2024-09-02) i dokumentlistan. Produktsidan har titeln "Midazolam hameln 5 mg/ml injektions-/infusionsvätska, lösning" och ATC-kod N05CD08. Andra godkända 5 mg/ml med samma form som hameln: Midazolam Accord (20070714000041), Midazolam Kalceks (20200406000091) och Midazolam Aguettant (20240731000120).

## 4. Furix 10 mg/ml

| Fält | Värde |
|---|---|
| NPL-id | 19801003000053 |
| Namn (NPL `medprodnamelegal`) | Furix |
| Styrka | 10 mg/ml |
| Beredningsform | Injektionsvätska, lösning |
| Substans (NPL substansbeskrivning) | Furosemid |
| Aktiv beståndsdel (NSL) | furosemid, ATC C03CA01 bland flera (C03CB01, C03EB01 och Q-koder) |
| ATC | C03CA01 |
| Administrationsvägar | INMU (intramuskulär), INVE (intravenös) |
| Produktklass och förfarande | Läkemedel (MEP), nationella proceduren |
| Innehavare | Orifarm Healthcare A/S (ombud Orifarm Healthcare) |
| Godkänd | 1980-10-03 |
| Status | Inte avregistrerad, försäljning inte stoppad, receptbelagd, ingen narkotikaklass |
| Förpackningar | 6 av 6 giltiga (ampuller 2, 4 och 25 ml, 5 eller 50 per förpackning) |
| Läkemedelsfaktas dokumentlista | Ja, 2 dokument: bipacksedel (svensk 2022-01-24) och produktresumé (svensk 2022-01-17) |
| Läkemedelsfaktas produktsida | Titel "Furix 10 mg/ml injektionsvätska, lösning", ATC-kod C03CA01. Stämmer med NPL |

Innehavaren Orifarm Healthcare A/S står som MAH i NPL och förpackningarna är inte parallelldistribuerade, så produkten är inte en parallellimport. Andra godkända furosemidprodukter 10 mg/ml för injektion: Furosemid Accord (20141212000014), Furosemide Kalceks (20201125000065) och Furosemide Noridem (20241205000035, godkänd 2026-11-06), alla med formen injektions-/infusionsvätska, lösning.

## Det som inte gick eller inte gjordes

- Läkemedelsfaktas produktsidor visar produktens data som titel och beskrivning i sidhuvudet. Godkännandedatum, status och innehavare fanns inte som läsbar text i den hämtade sidan (övrig text är allmän hjälptext som laddas med skript), så de är kontrollerade bara mot NPL.
- Varunummer, förmånsstatus och tillhandahållande är inte kontrollerade, eftersom VARA inte är öppet nedladdningsbart (se `docs/lakemedelskontroll.md`).
- NSL:s Snomed CT-koder är inte med i utdraget, eftersom de har egna villkor.
- Produktresuméerna lästes inte. Doseringen är alltså inte kontrollerad i det här uttaget.
