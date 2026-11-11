# Validering av exportpaketet mot E-ARK

Exportpaketet till e-arkiv och återföringen av all data följer Riksarkivets FGS Paketstruktur 2.0, som bygger på E-ARK
CSIP 2.1.0 och E-ARK SIP 2.1.0. Paketet prövades 2026-11-11 med E-ARK:s validator med öppen källkod, inte mot ett
verkligt e-arkiv.

## Verktyg

| Del | Version |
|---|---|
| Validator | commons-ip 2.12.1 (`commons-ip2-cli-2.12.1.jar` från https://github.com/keeps/commons-ip/releases/tag/2.12.1, sha256 8783b83d43763f068a081c66a084f8bfe05594ba24c56d3bf931ac4b6b639c5d), Apache 2.0 |
| Specifikation | E-ARK CSIP 2.1.0 (`--specification-version 2.1.0`), rapport i E-ARK:s format (`-r eark-validator`) |
| Java | `eclipse-temurin:21-jre` i en container, inte på värden |

## Så gjordes valideringen

1. Ett paket för en patient (p01) och återföringen av all data (beslut om leverans av alla journaler) skapades genom
   API:t som arkivarien i en ny sandlåda.
2. Validatorn kördes på båda ZIP-filerna:

```sh
docker run --rm -v "$PWD":/d -w /d eclipse-temurin:21-jre java -jar /d/commons-ip2-cli-2.12.1.jar \
  validate -i /d/paket.zip -o /d/rapport --specification-version 2.1.0 -r eark-validator
```

## Första körningen

Strukturen var välformad och METS.xml var giltig mot METS-schemat, men validatorns regler (schematron) gav tre fel:

| Regel | Fel | Rättning |
|---|---|---|
| CSIP68 | `application/x-ndjson` i MIMETYPE är ingen registrerad medietyp | Åtkomstloggen och tabellerna i NDJSON har `text/plain` i METS.xml |
| CSIP100 | Gruppen Schemas i structMap pekar inte på någon fil | XML-schemana för METS 1.12, XLink och E-ARK:s tillägg till METS ligger i mappen `schemas/` och i filgruppen Schemas |
| CSIP103 | Representationen saknar en `div` med LABEL `Representations` | Representationens `div` har LABEL `Representations` |

## Efter rättningen

Båda paketen: strukturen är välformad, METS.xml är giltig mot schemat och reglerna ger **inga fel**. Kvar är:

| Regel | Nivå | Bedömning |
|---|---|---|
| CSIPSTR12 och CSIPSTR13 | Varning | E-ARK rekommenderar en egen METS.xml och mappen metadata i varje representation. Paketet har en representation och beskriver den i rotens METS.xml. Kvar. |
| CSIP101 | Varning | Validatorn vill ha en filgrupp med USE `Representations`. Paketet använder `Representations/rep_1`, som CSIP och FGS anger för en namngiven representation. Kvar. |
| CSIP45 | Information | Rättigheter per representation kan anges i en METS.xml för representationen. Kvar. |

## Alla tabeller i återföringen

Återföringen av all data (beslut om leverans av alla journaler) tar med tabellerna i
`representations/rep_1/data/tabeller/`, en NDJSON-fil per tabell med en rad per post och binära värden som base64, och
`schema.sql` med tabellerna, indexen och triggrarna. Därmed följer också tabeller som inte hör till journalen med, till
exempel inställningarna, reglerna, mallarna och kodverken. Varje fil står i METS.xml med storlek och SHA-256.

Bara tabeller som `app/src/lagring.js` klassar som en huvudmans uppgifter (genom enhet, patient eller en annan rad) eller
som gemensamma följer med (`aterforingsurval` i `app/src/arkiv.js`). Systemets egna tabeller (till exempel systemkontona,
anslutningarna, schemaversionen och uppgraderingarna) och säkerhetsloggen följer inte med, och inte heller en tabell vars
namn visar att den innehåller nycklar eller hemligheter. Kolumner med nycklar, HMAC och hemligheter tas bort, till exempel
forskningsuttagets pseudonymnyckel, kalenderlänkarnas HMAC, utrustningens nyckel och videomötenas koder. I tabeller med nyckel och värde kan hemligheten ligga i
raderna: av inställningarna följer bara de med som står i en uttrycklig lista över ofarliga inställningar
(`ATERFORING_INSTALLNINGAR`), så att till exempel datauttagets pseudonymnyckel och varje ny inställning stannar kvar, och i
de andra tabellerna med en nyckelkolumn följer en rad inte med när nyckeln liknar en hemlighet. `urval.json` i samma mapp
säger vilka tabeller, kolumner och hur många rader som är utelämnade och varför. Skyddad identitet följer med som uppgift, som i
resten av paketet. Ett test fäller bygget om en ny tabell inte är klassad, och ett test lägger in kända hemliga värden och
kontrollerar att inget av dem finns någonstans i paketet.

## Det som återstår

Paketet är inte prövat mot ett verkligt e-arkiv eller en leveransöverenskommelse, och schemat för PREMIS ligger inte i
mappen schemas.
