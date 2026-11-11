# Bedömning av beslutsstödet enligt MDR

Det här är Vårdkällans egen bedömning av om varje beslutsstödsmodul är en medicinteknisk produkt enligt förordningen (EU) 2017/745 om medicintekniska produkter (MDR). Den är inte gjord av ett anmält organ och ersätter inte den bedömning som en tillverkare måste göra innan systemet används i vården. Demon är inte CE-märkt, och alla regler i den är märkta som demoregler.

Metoden är beslutsträdet i MDCG 2019-11, vägledningen om kvalificering och klassificering av programvara, och klassificeringsregel 11 i bilaga VIII till MDR. Stegen är:

- Steg 1: Är det programvara enligt vägledningens definition?
- Steg 2: Är programvaran ett tillbehör till en medicinteknisk produkt eller driver eller påverkar den användningen av en sådan? Om ja omfattas den av den produkten och bedöms inte här.
- Steg 3: Utför programvaran något annat med data än lagring, arkivering, kommunikation, enkel sökning eller förlustfri komprimering?
- Steg 4: Görs det för enskilda patienters räkning?
- Steg 5: Har programvaran ett medicinskt ändamål enligt artikel 2.1 i MDR, till exempel diagnos, förebyggande, övervakning, prognos eller behandling?

En modul är en medicinteknisk produkt när steg 1, 3, 4 och 5 ger ja och steg 2 ger nej. Bedömningen är data i `app/src/mdr-bedomning.js`, och ett test i bygget stoppar bygget om en modul som bedöms inte finns i koden eller om slutsatsen inte följer av stegen.

## Sammanställning

| Modul | Filer | Medicinteknisk produkt | Klass |
| --- | --- | --- | --- |
| Journalkärnan | `src/journal.js`, `src/db.js`, `src/logg.js`, `src/atkomst.js` | Nej | Ej tillämpligt |
| Varningar vid ordination | `src/lakemedel.js` | Ja | IIa |
| Regler för administrering, utsättning och läkemedelsgenomgång | `src/lakemedelsregler.js` | Ja | IIa |
| Ordinationsmallar | `src/ordinationsmallar.js` | Nej | Ej tillämpligt |
| Skalor och beräkningar: NEWS2, GCS, NRS, referensintervall och eGFR | `src/skalor.js` | Ja | IIa |
| Kunskapsstöd vid läkemedel och vårdförlopp | `src/kunskapsstod.js` | Ja | IIa |
| Dosering av cytostatika | `src/cytostatika.js` | Ja | IIb |
| Larmregler i intensivvården | `src/iva-patientregler.js`, `src/iva.js` | Ja | IIb |
| Vaccinationsprogram | `src/vaccinationsprogram-regler.js` | Ja | IIa |
| Tillväxtkurvor och avvikelser | `src/tillvaxt.js`, `src/tillvaxt-r11.js` | Ja | IIa |
| Förslag till uppmärksamhetsinformation | `src/uppmarksamhet-regler.js` | Nej | Ej tillämpligt |

## Journalkärnan

Avsett ändamål: Lagra, visa och kommunicera journalanteckningar, diagnoser och mätvärden med behörighet och logg.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Nej
- Steg 4: Ja
- Steg 5: Nej

Slutsats: inte en medicinteknisk produkt. Journalkärnan lagrar, visar, söker och kommunicerar uppgifter utan att räkna fram ny information för ett medicinskt beslut. Steg 3 ger nej, och journalkärnan är därför inte en medicinteknisk produkt. Det är skälet till att beslutsstödet ligger i egna moduler.

## Varningar vid ordination

Avsett ändamål: Pröva en ny ordination mot patientens läkemedel, överkänslighet och njurfunktion och varna för interaktioner, dubbelordination och olämplig dos.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIa. Modulen räknar fram varningar för den enskilda patienten som läkaren använder för beslut om behandling. Enligt regel 11 är programvara som ger information för beslut om diagnos eller behandling minst klass IIa. Ett beslut som kan leda till allvarlig försämring eller ingrepp skulle ge klass IIb, men läkaren gör alltid sin egen bedömning och kvitterar varje varning, och modulen ordinerar inget själv.

## Regler för administrering, utsättning och läkemedelsgenomgång

Avsett ändamål: Kontrollera en administrering mot ordinationen och föreslå åtgärder vid utsättning och i läkemedelsgenomgången.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIa. Reglerna prövar data för en enskild patient och ger information för beslut om behandling. Regel 11 ger klass IIa.

## Ordinationsmallar

Avsett ändamål: Färdiga ordinationer som läkaren väljer och ändrar.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Nej
- Steg 4: Ja
- Steg 5: Nej

Slutsats: inte en medicinteknisk produkt. Mallarna är fastställda texter och värden som visas och kopieras utan beräkning för den enskilda patienten. De motsvarar en enkel sökning i ett bibliotek. Steg 3 ger nej. Kontrollen av ordinationen görs i modulen för varningar.

## Skalor och beräkningar: NEWS2, GCS, NRS, referensintervall och eGFR

Avsett ändamål: Räkna poäng, risknivå och vad som ska göras ur patientens mätvärden, och skatta njurfunktionen ur kreatinin.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIa. Beräkningarna ger information för beslut om övervakning och behandling av den enskilda patienten. Regel 11 ger klass IIa.

## Kunskapsstöd vid läkemedel och vårdförlopp

Avsett ändamål: Visa riktlinjens steg och substansens egenskaper, och pröva dosering vid nedsatt njurfunktion och olämplighet för äldre mot patientens eGFR och ålder.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIa. De allmänna texterna är inte i sig en medicinteknisk produkt, men prövningen mot patientens eGFR och ålder ger patientspecifik information för beslut om behandling. Regel 11 ger klass IIa.

## Dosering av cytostatika

Avsett ändamål: Räkna doser efter kroppsyta eller njurfunktion, premedicinering och kumulativ dos, och pröva provsvaren innan kuren godkänns.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIb. Fel dos av cytostatika kan leda till allvarlig försämring av patientens hälsa. Regel 11 ger då klass IIb för programvara som ger information för beslut om behandling.

## Larmregler i intensivvården

Avsett ändamål: Övervaka vitala parametrar mot avdelningens och patientens egna gränser och larma.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIb. Regel 11 säger att programvara för att övervaka vitala fysiologiska parametrar, där variationer kan innebära omedelbar fara för patienten, är klass IIb.

## Vaccinationsprogram

Avsett ändamål: Räkna fram vilka vaccinationer som står i tur för den enskilda patienten enligt programmet.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIa. Modulen ger information för beslut om förebyggande behandling av den enskilda patienten. Regel 11 ger klass IIa.

## Tillväxtkurvor och avvikelser

Avsett ändamål: Räkna standardavvikelser mot referenskurvor och flagga avvikande tillväxt.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Ja
- Steg 4: Ja
- Steg 5: Ja

Slutsats: medicinteknisk produkt, klass IIa. Beräkningen ger information för beslut om utredning och diagnos av det enskilda barnet. Regel 11 ger klass IIa.

## Förslag till uppmärksamhetsinformation

Avsett ändamål: Föreslå att en uppgift som redan finns i journalen, till exempel en överkänslighet, visas som uppmärksamhetsinformation.

- Steg 1: Ja
- Steg 2: Nej
- Steg 3: Nej
- Steg 4: Ja
- Steg 5: Nej

Slutsats: inte en medicinteknisk produkt. Förslagen pekar på uppgifter som redan finns i journalen och visar dem på ett annat ställe, utan att räkna fram ny medicinsk information. Steg 3 ger nej.

## Vad bedömningen betyder för arkitekturen

Journalkärnan är inte en medicinteknisk produkt och ligger skild från beslutsstödet. Varje beslutsstöd som är en medicinteknisk produkt ligger i en egen modul, så att den kan valideras, versioneras och CE-märkas för sig utan att journalkärnan omfattas. Innan beslutsstödet används i vården behöver tillverkaren ett kvalitetsledningssystem, en klinisk utvärdering och ett anmält organ för klass IIa och IIb.
