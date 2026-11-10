# Kodkontroll

Kontroll av varje kod i seeden, läkemedelskatalogen och FHIR-API:t mot primärkällan, gjord 2026-10-31. De kontrollerade värdena står i `app/src/kodverk.js`, och testerna i `app/test/kodverk.test.js` stoppar bygget om seeden avviker från dem.

Läkemedelskatalogens produkter (namn, styrka, form, substans och NPL-id) och ordinationernas doser kontrollerades 2026-11-01 mot Läkemedelsverkets NPL och NSL. Den kontrollen står i `docs/lakemedelskontroll.md`.

## Sammanfattning

| Kodverk | Kontrollerade | Rätt | Rättade | Borttagna |
|---|---|---|---|---|
| ICD-10-SE (diagnoser) | 36 | 17 | 19 (benämning) | 0 |
| ATC (katalog, överkänslighet, regelprefix) | 56 | 56 | 0 | 0 |
| Labbkoder, förut LOINC, nu NPU | 11 | 0 | 10 (bytt till NPU) | 1 (eGFR) |
| Vitalparametrar och PEF, LOINC | 10 | 10 | 1 tillagd kod (2708-6) | 0 |
| UCUM-enheter (nya i FHIR) | 16 | 16 | | |
| KVÅ (runda 6) | 3 | 3 | | |
| LOINC för eGFR, skalor och NEWS2 (runda 6) | 8 | 7 | 1 (en kod för NEWS2 som visade sig gälla något annat byttes före bygget) | 0 |
| LOINC-svarskoder för medvetandegrad (runda 6) | 5 | 5 | | |
| NPL (läkemedelsprodukter), se `docs/lakemedelskontroll.md` | 50 | 3 | 47 | 0 |

Totalt 113 kodposter och 16 enhetskoder. Varje labbvärde räknas en gång, men både den gamla LOINC-koden och den nya NPU-koden är kontrollerade.

De viktigaste felen:

1. **19 av 36 diagnoser hade en egen benämning** i stället för Socialstyrelsens. Koderna var giltiga, men texterna var omskrivna, till exempel `E78.0 Ren hyperkolesterolemi` (titeln är Isolerad hyperkolesterolemi), `I50.1 Vänsterkammarsvikt` (Vänsterhjärtsvikt) och `N18.3 Kronisk njursjukdom, stadium 3` (Kronisk njursvikt, stadium 3).
2. **`I50.0` hade texten "Hjärtsvikt med stas"**, men koden betyder Högerhjärtsvikt. ICD-10-SE räknar "Congestive heart failure" till I50.0, så koden står kvar och texten är nu Socialstyrelsens. Om patient 1:s hjärtsvikt kliniskt är en vänstersvikt med lungstas (journalen har basala rassel och EF 40 procent) vore I50.1 rimligare; efter kontrollen ändrades diagnosen till I50.1 Vänsterhjärtsvikt (2026-10-31).
3. **Glukos hade LOINC 2339-0**, som är glukos i masskoncentration (mg/dL), medan demon anger mmol/L. Nu NPU02192 (P, Glucose; subst.c. = ? mmol/L).
4. **eGFR hade LOINC 62238-1**, som anger CKD-EPI-formeln, utan stöd i data för vilken formel som används. NPU har ingen kod för skattad glomerulär filtration, så koden togs bort. Sedan runda 6 räknar demons laboratorium eGFR ur kreatinin med CKD-EPI 2021, och eGFR har LOINC 98979-8, se avsnittet Runda 6 nedan.
5. **Syremättnad saknade 2708-6**, som FHIR R4:s profil för syremättnad kräver. Båda koderna finns nu.
6. Codings i FHIR hade svenska ord som `display` för LOINC och ATC (till exempel "Puls" och "furosemid"). `display` måste vara kodverkets egen benämning, så den svenska texten står nu i `text`. Det är ett formatfel, inte ett kodfel, och redovisas i `docs/fhir-validering.md`.

## Källor

Nedladdade filer lästes som data med `python3 -I` i egna kataloger under `$TMPDIR`, och kördes aldrig.

| Kodverk | Källa | Hämtad | Version och kontrollsumma |
|---|---|---|---|
| ICD-10-SE | https://www.socialstyrelsen.se/globalassets/sharepoint-dokument/dokument-webb/klassifikationer-och-koder/icd-10-se.tsv (beskrivning: beskrivning-filinnehall-icd-10-se.pdf i samma katalog) | 2026-10-31 | Hela klassifikationen giltig från 2026-01-01, 82 490 rader, OID 1.2.752.116.1.1.1, sha256 696c0c02178dabce2c99802898e98cb5c7c4a3af1f78c5cc1c2ad29f5eaabae8 |
| ICD-10-SE, jämförelse | Systematisk förteckning svensk version 2026, del 1 till 3 (pdf), https://www.ehalsomyndigheten.se/verksamhet/ndi/interoperabilitet/klassifikationer/klassifikationen-icd-10/, och Socialstyrelsens söktjänst https://klassifikationer.socialstyrelsen.se/ (JSON-API) | 2026-10-31 | Samma titlar som tsv-filen för alla 36 koder |
| ATC | WHO Collaborating Centre, ATC/DDD-index, https://atcddd.fhi.no/atc_ddd_index/?code=KOD | 2026-10-31 | Senast uppdaterat 2026-01-20. Alla 56 koder med benämning också godkända av tx.fhir.org (`CodeSystem/$validate-code`, system `http://www.whocc.no/atc`) |
| NPU | IFCC, https://cms.ifcc.org/wp-content/uploads/npu-codes-latest.csv, länkad från https://npu-terminology.org/npu-database/ | 2026-10-31 | Senaste ändring i filen 2026-09-22, 25 699 aktiva koder, sha256 3aef05383e918cc1304c53c5ca6f8a9467b6d700fc3ba18563744c1fbe904353. Systemadress `http://npu-terminology.org` enligt HL7 Terminology, NamingSystem NPU |
| LOINC | HL7:s terminologiserver, https://tx.fhir.org/r4/CodeSystem/$lookup?system=http://loinc.org&code=KOD och `$validate-code` | 2026-10-31 | LOINC 2.83. loinc.org svarade 403 på hämtning med skript och användes inte |
| UCUM | https://tx.fhir.org/r4/CodeSystem/$validate-code?url=http://unitsofmeasure.org | 2026-10-31 | Alla 16 enhetskoder giltiga |

Socialstyrelsens webbsida för ICD-10 leder numera till E-hälsomyndigheten, som publicerar pdf-utgåvan. Kodfilen ligger kvar hos Socialstyrelsen.

## ICD-10-SE

Alla koder finns i ICD-10-SE 2026 och är giltiga. Två koder kan se konstiga ut men är rätt: `I10.9` och `J13.9`. ICD-10-SE säger i inledningen till del 1 att en treställig kategori utan uppdelning ska kompletteras med decimalen 9, och båda finns i kodfilen. `S72.00` är en femställig kod för sluten fraktur. Inga koder har markeringen "Ej huvuddiagnos". `E10.0` har frivilliga fördjupningskoder; för patient 2 (hypoglykemiskt koma) hade `E10.0C` varit mer precis, men `E10.0` är giltig och står kvar.

| Kod | Benämning före | Socialstyrelsens titel (2026) | Antal i seeden | Resultat |
|---|---|---|---|---|
| E03.9 | Hypotyreos, ospecificerad | Hypotyreos, ospecificerad | 2 | rätt |
| E10.0 | Diabetes mellitus typ 1 med koma | Diabetes mellitus typ 1 - med koma | 1 | rättad (benämning) |
| E10.9 | Diabetes mellitus typ 1 utan komplikationer | Diabetes mellitus typ 1 - utan komplikationer | 1 | rättad (benämning) |
| E11.9 | Diabetes mellitus typ 2 utan komplikationer | Diabetes mellitus typ 2 - utan komplikationer | 1 | rättad (benämning) |
| E78.0 | Ren hyperkolesterolemi | Isolerad hyperkolesterolemi | 2 | rättad (benämning) |
| F32.1 | Medelsvår depressiv episod | Medelsvår depressiv episod | 1 | rätt |
| F33.1 | Recidiverande depression, medelsvår episod | Recidiverande depression, medelsvår episod | 1 | rätt |
| F41.1 | Generaliserat ångestsyndrom | Generaliserat ångestsyndrom | 1 | rätt |
| G30.1 | Alzheimers sjukdom med sen debut | Alzheimers sjukdom med sen debut | 1 | rätt |
| H66.9 | Mediaotit, ospecificerad | Mellanöreinflammation, ej specificerad som varig eller icke varig | 1 | rättad (benämning) |
| I10.9 | Essentiell hypertoni, ospecificerad | Essentiell hypertoni (högt blodtryck utan känd orsak) | 5 | rättad (benämning) |
| I20.9 | Angina pectoris, ospecificerad | Angina pectoris, ospecificerad | 1 | rätt |
| I21.4 | Akut subendokardiell hjärtinfarkt | Akut subendokardiell infarkt | 1 | rättad (benämning) |
| I48.0 | Paroxysmalt förmaksflimmer | Paroxysmalt förmaksflimmer | 1 | rätt |
| I48.1 | Persisterande förmaksflimmer | Persisterande förmaksflimmer | 1 | rätt |
| I48.2 | Kroniskt förmaksflimmer | Kroniskt förmaksflimmer | 1 | rätt |
| I49.1 | Förmaksextrasystolier | Prematur depolarisation av förmaket | 1 | rättad (benämning) |
| I50.0 | Hjärtsvikt med stas | Högerhjärtsvikt | 1 | rättad (benämning) |
| I50.1 | Vänsterkammarsvikt | Vänsterhjärtsvikt | 1 | rättad (benämning) |
| I50.9 | Hjärtsvikt, ospecificerad | Hjärtinsufficiens, ospecificerad | 1 | rättad (benämning) |
| J02.9 | Akut faryngit, ospecificerad | Akut faryngit, ospecificerad | 1 | rätt |
| J13.9 | Pneumoni orsakad av Streptococcus pneumoniae | Pneumoni orsakad av Streptococcus pneumoniae | 1 | rätt |
| J18.9 | Pneumoni, ospecificerad | Pneumoni, ospecificerad | 1 | rätt |
| J45.9 | Astma, ospecificerad | Astma, ospecificerad | 1 | rätt |
| K21.9 | Gastroesofageal refluxsjukdom utan esofagit | Gastroesofageal refluxsjukdom utan esofagit | 1 | rätt |
| M81.9 | Osteoporos, ospecificerad | Osteoporos, ospecificerad | 1 | rätt |
| N18.3 | Kronisk njursjukdom, stadium 3 | Kronisk njursvikt, stadium 3 | 1 | rättad (benämning) |
| N18.4 | Kronisk njursjukdom, stadium 4 | Kronisk njursvikt, stadium 4 | 1 | rättad (benämning) |
| N20.1 | Uretärsten | Uretärsten | 1 | rätt |
| N30.0 | Akut cystit | Akut cystit (urinvägsinfektion lokaliserad till urinblåsan) | 1 | rättad (benämning) |
| R00.2 | Hjärtklappning | Hjärtklappning | 2 | rätt |
| R29.6 | Fallbenägenhet | Fallbenägenhet, som ej klassificeras på annan plats | 1 | rättad (benämning) |
| S72.00 | Fraktur på lårbenshalsen, sluten | Kollumfraktur - sluten | 1 | rättad (benämning) |
| S83.5 | Stukning och sträckning av korsband i knäleden | Distorsion engagerande knäets (främre) (bakre) korsband | 1 | rättad (benämning) |
| Z30.4 | Övervakning av antikonception med läkemedel | Övervakning av förskrivna preventivläkemedel | 1 | rättad (benämning) |
| Z91.0 | Allergi i den egna sjukhistorien, utom mot läkemedel och biologiska substanser | Allergi och annan överkänslighet som inte beror på läkemedel och biologiska substanser i den egna sjukhistorien | 1 | rättad (benämning) |

## ATC

Alla ATC-koder i katalogen stämmer med substansen i WHO:s register. Den svenska substansen i katalogen är den svenska formen av WHO:s namn (till exempel levotyroxin för levothyroxine sodium). I FHIR är `display` nu WHO:s benämning. Varningsreglerna använder rätt prefix: penicilliner `J01C`, NSAID `M01A` och antikoagulantia `B01AA`, `B01AB`, `B01AE` och `B01AF`. Testet `Kodverk > varningsreglernas ATC-prefix stämmer med WHO:s register` kontrollerar också att prefixen fångar exakt katalogens penicilliner och NSAID. Läkemedelsnamn, styrka, form och NPL-id kontrollerades efteråt mot Läkemedelsverkets NPL, se `docs/lakemedelskontroll.md`; tabellen nedan visar katalogen som den såg ut vid ATC-kontrollen. Alla ATC-koder stämde också med NPL.

| Kod | Läkemedel i katalogen | Substans i katalogen | WHO:s benämning | Resultat |
|---|---|---|---|---|
| A02BC01 | Omeprazol | omeprazol | omeprazole | rätt |
| A10AB05 | NovoRapid | insulin aspart | insulin aspart | rätt |
| A10AE04 | Lantus | insulin glargin | insulin glargine | rätt |
| A10BA02 | Metformin | metformin | metformin | rätt |
| A10BK03 | Jardiance | empagliflozin | empagliflozin | rätt |
| A12AX | Kalcium och D-vitamin | kalciumkarbonat och kolekalciferol | Calcium, combinations with vitamin D and/or other drugs | rätt |
| B01AA03 | Waran | warfarin | warfarin | rätt |
| B01AB04 | Fragmin | dalteparin | dalteparin | rätt |
| B01AB05 | Klexane | enoxaparin | enoxaparin | rätt |
| B01AC06 | Trombyl | acetylsalicylsyra | acetylsalicylic acid | rätt |
| B01AC24 | Brilique | tikagrelor | ticagrelor | rätt |
| B01AF01 | Xarelto | rivaroxaban | rivaroxaban | rätt |
| B01AF02 | Eliquis | apixaban | apixaban | rätt |
| C01AA05 | Digoxin | digoxin | digoxin | rätt |
| C01CA24 | EpiPen Jr | adrenalin | epinephrine | rätt |
| C01DA02 | Nitrolingual | glyceryltrinitrat | glyceryl trinitrate | rätt |
| C03CA01 | Furosemid | furosemid | furosemide | rätt |
| C03DA01 | Spironolakton | spironolakton | spironolactone | rätt |
| C07AB02 | Metoprolol depot | metoprolol | metoprolol | rätt |
| C07AB07 | Bisoprolol | bisoprolol | bisoprolol | rätt |
| C08CA01 | Amlodipin | amlodipin | amlodipine | rätt |
| C09AA02 | Enalapril | enalapril | enalapril | rätt |
| C09AA05 | Ramipril | ramipril | ramipril | rätt |
| C09CA01 | Losartan | losartan | losartan | rätt |
| C10AA01 | Simvastatin | simvastatin | simvastatin | rätt |
| C10AA05 | Atorvastatin | atorvastatin | atorvastatin | rätt |
| G03AC09 | Desogestrel | desogestrel | desogestrel | rätt |
| H02AB06 | Prednisolon | prednisolon | prednisolone | rätt |
| H03AA01 | Levaxin | levotyroxin | levothyroxine sodium | rätt |
| J01AA02 | Doxycyklin | doxycyklin | doxycycline | rätt |
| J01CA04 | Amoxicillin | amoxicillin | amoxicillin | rätt |
| J01CA08 | Selexid | pivmecillinam | pivmecillinam | rätt |
| J01CE01 | Bensylpenicillin | bensylpenicillin | benzylpenicillin | rätt |
| J01CE02 | Kåvepenin | fenoximetylpenicillin | phenoxymethylpenicillin | rätt |
| J01XE01 | Nitrofurantoin | nitrofurantoin | nitrofurantoin | rätt |
| M01AB05 | Diklofenak | diklofenak | diclofenac | rätt |
| M01AE01 | Ibuprofen | ibuprofen | ibuprofen | rätt |
| M01AE02 | Naproxen | naproxen | naproxen | rätt |
| M05BA04 | Alendronat | alendronsyra | alendronic acid | rätt |
| N02AA01 | Morfin | morfin | morphine | rätt |
| N02AA05 | Oxikodon | oxikodon | oxycodone | rätt |
| N02BE01 | Alvedon | paracetamol | paracetamol | rätt |
| N05CF01 | Zopiklon | zopiklon | zopiclone | rätt |
| N05CH01 | Melatonin | melatonin | melatonin | rätt |
| N06AB06 | Sertralin | sertralin | sertraline | rätt |
| N06AB10 | Escitalopram | escitalopram | escitalopram | rätt |
| N06AX11 | Mirtazapin | mirtazapin | mirtazapine | rätt |
| N06DA02 | Donepezil | donepezil | donepezil | rätt |
| R03AC02 | Airomir | salbutamol | salbutamol | rätt |
| R03BA02 | Pulmicort | budesonid | budesonide | rätt |
| J01C | Överkänslighet (penicilliner), regeln overkanslighet | | BETA-LACTAM ANTIBACTERIALS, PENICILLINS | rätt |
| M01A | Regeln warfarin_nsaid | | ANTIINFLAMMATORY AND ANTIRHEUMATIC PRODUCTS, NON-STEROIDS | rätt |
| B01AA | Regeln dubbel_antikoagulantia | | Vitamin K antagonists | rätt |
| B01AB | Regeln dubbel_antikoagulantia | | Heparin group | rätt |
| B01AE | Regeln dubbel_antikoagulantia | | Direct thrombin inhibitors | rätt |
| B01AF | Regeln dubbel_antikoagulantia | | Direct factor Xa inhibitors | rätt |

## Labbkoder

Svenska laboratorier använder NPU, så labbresultaten har nu NPU i stället för LOINC. LOINC-koderna som fanns var korrekta utom glukos och eGFR (se ovan), men de ersattes för att använda det svenska kodverket. Alla valda koder är aktiva och har samma enhet som demon. NPU skriver ett långt tankstreck mellan system och komponent; här står ett kommatecken i stället.

| Mätvärde | Enhet i demon | Förut (LOINC) | NPU-kod | NPU-definition | UCUM | Resultat |
|---|---|---|---|---|---|---|
| CRP | mg/L | 1988-5 | NPU19748 | P, C-reactive protein; mass c. = ? mg/L | mg/L | rättad (NPU) |
| Kreatinin | µmol/L | 14682-9 | NPU18016 | P, Creatininium; subst.c. = ? µmol/L | umol/L | rättad (NPU) |
| HbA1c | mmol/mol | 59261-8 | NPU27300 | Haemoglobin beta chain(B), N-(1-deoxyfructos-1-yl)haemoglobin beta chain; subst.fr. = ? mmol/mol | mmol/mol | rättad (NPU) |
| PK (INR) | INR | 6301-6 | NPU01685 | P, Coagulation, tissue factor-induced; rel.time(actual/norm;INR;IRP 67/40;proc.) = ? | {INR} | rättad (NPU) |
| NT-proBNP | ng/L | 33762-6 | NPU21571 | P, Pro-brain natriuretic peptide(1-76); mass c. = ? ng/L | ng/L | rättad (NPU) |
| Hemoglobin | g/L | 718-7 | NPU28309 | B, Haemoglobin; mass c. = ? g/L | g/L | rättad (NPU) |
| Glukos | mmol/L | 2339-0 (fel: masskoncentration) | NPU02192 | P, Glucose; subst.c. = ? mmol/L | mmol/L | rättad |
| Kalium | mmol/L | 2823-3 | NPU03230 | P, Potassium ion; subst.c. = ? mmol/L | mmol/L | rättad (NPU) |
| Troponin T | ng/L | 67151-1 | NPU27501 | P, Troponin T, cardiac muscle; mass c. = ? ng/L | ng/L | rättad (NPU) |
| TSH | mIE/L | 3016-3 | NPU03577 | P, Thyrotropin; arb.subst.c.(IRP 80/558;proc.) = ? × 10-3 IU/L | m[IU]/L | rättad (NPU) |
| eGFR | mL/min/1,73 m² | 62238-1 (CKD-EPI, ej belagt) | ingen | NPU28811 (Kidn., Glomerular filtration; vol.rate(surf.=1.73 m²) = ? mL/min) anger inte skattning från kreatinin och valdes bort | mL/min/{1.73_m2} | borttagen, text kvar |

Två antaganden: provmaterialet är plasma (P) för kemiska analyser och blod (B) för Hb, som är standard i svenska laboratorier, eftersom seeden inte anger provmaterial. INR-koden förutsätter WHO:s internationella referenstromboplastin (IRP 67/40), vilket är definitionen av INR.

## Vitalparametrar och PEF (LOINC)

FHIR R4:s vitalparameterprofiler kräver LOINC, så vitalparametrarna behåller LOINC. Alla koder finns i LOINC 2.83 med status ACTIVE, och benämningen nedan är den som tx.fhir.org godkänner.

| Mätvärde | LOINC | LOINC-benämning | UCUM | FHIR-profil | Resultat |
|---|---|---|---|---|---|
| Blodtryck | 85354-9 | Blood pressure panel with all children optional | | bp | rätt |
| Systoliskt | 8480-6 | Systolic blood pressure | mm[Hg] | bp | rätt |
| Diastoliskt | 8462-4 | Diastolic blood pressure | mm[Hg] | bp | rätt |
| Puls | 8867-4 | Heart rate | /min | heartrate | rätt |
| Temperatur | 8310-5 | Body temperature | Cel | bodytemp | rätt |
| Syremättnad | 59408-5 | Oxygen saturation in Arterial blood by Pulse oximetry | % | oxygensat | rätt, 2708-6 tillagd |
| Syremättnad | 2708-6 | Oxygen saturation in Arterial blood | % | oxygensat | tillagd, krävs av profilen |
| Andningsfrekvens | 9279-1 | Respiratory rate | /min | resprate | rätt |
| Vikt | 29463-7 | Body weight | kg | bodyweight | rätt |
| Längd | 8302-2 | Body height | cm | bodyheight | rätt |
| PEF | 19935-6 | Maximum expiratory gas flow Respiratory system airway by Peak flow meter | L/min | ingen | rätt (NPU har ingen PEF-kod) |

## Tillägg 2026-11-03

Två ICD-10-SE-koder lades till för uppmärksamhetsinformation (bärarskap hos patient 8): `Z22.3 Bärare av andra specificerade patogena bakterier` och `U82.1 Resistens mot meticillin`. Titlarna är kontrollerade ordagrant mot samma `icd-10-se.tsv` (hämtad igen 2026-11-03, samma sha256 696c0c02178dabce2c99802898e98cb5c7c4a3af1f78c5cc1c2ad29f5eaabae8). U82.1 är en tilläggskod som enligt filen inte ska användas som huvuddiagnos, och den är bidiagnos i seeden. Den femställiga koden Z22.3C (Bärare av stafylokocker) finns i filen men används inte, eftersom seedens koder följer formatet bokstav, två siffror, punkt och en eller två siffror.

## KVÅ

KVÅ förekommer inte i seeden eller koden. Inga åtgärder registreras i första versionen.

## Det som inte gick att verifiera

- Att svenska laboratorier i Region Örebro län använder exakt dessa NPU-koder. Koderna är de generella NPU-koderna för analyserna; regionala laboratorier kan ha egna eller svenska lokala koder, som inte finns i IFCC:s fil.
- Läkemedlens förpackningar (NPL-pack-id), varunummer och förmånsstatus. Produkterna är kontrollerade mot NPL (`docs/lakemedelskontroll.md`), men VARA är inte öppet nedladdningsbart.
- ICD-10-SE, NPU och NPL-id kontrolleras inte av HL7:s validator, eftersom terminologiservern saknar dem. Kontrollen av dem är den här rapporten och testerna.

## Runda 6: eGFR, skalor, NEWS2 och KVÅ (2026-11-03)

### eGFR

NPU-filen (IFCC, https://cms.ifcc.org/wp-content/uploads/npu-codes-latest.csv, hämtad 2026-11-03, sha256 6c64b2208917ce072b8419b014781fcd7d12d30163c832486e675571877e9afc, 25 788 rader) har fortfarande ingen kod för skattad glomerulär filtration: bara NPU28811 (Kidn., Glomerular filtration; vol.rate(surf.=1.73 m²)) och NPU28812, som inte anger att värdet är skattat ur kreatinin. LOINC 2.83 (tx.fhir.org, `CodeSystem/$lookup`) har koder per formel. Demons laboratorium räknar eGFR ur P-kreatinin, ålder och kön med CKD-EPI 2021 (`app/src/skalor.js`, `ckdEpi2021`), också för seedens värden, och därför har eGFR koden för den formeln.

| Kod | LOINC:s benämning | Använd |
|---|---|---|
| 98979-8 | Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI 2021)/1.73 sq M | ja, för eGFR |
| 62238-1 | Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI)/1.73 sq M | nej, äldre CKD-EPI |
| 69405-9 | Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by based on 1.73 sq M | nej, anger inte att värdet är skattat ur kreatinin |

Testet `Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning` kontrollerar formeln mot två räknade exempel och att varje eGFR i seeden har ett kreatinin vid samma provtagning och är räknat ur det.

### Skalor och NEWS2

Kontrollerade mot LOINC 2.83 via tx.fhir.org (`CodeSystem/$lookup` och `ValueSet/$expand`), 2026-11-03.

| Kod | LOINC:s benämning | Används för |
|---|---|---|
| 67775-7 | Level of responsiveness | Medvetandegrad (ACVPU) |
| 3151-8 | Inhaled oxygen flow rate | Syrgas, liter per minut |
| 72514-3 | Pain severity - 0-10 verbal numeric rating [Score] - Reported | Smärta med NRS |
| 9269-2 | Glasgow coma score total | GCS, summan |
| 9267-6 | Glasgow coma score eye opening | GCS, ögonöppning |
| 9270-0 | Glasgow coma score verbal | GCS, verbalt svar |
| 9268-4 | Glasgow coma score motor | GCS, motoriskt svar |
| 115635-5 | Early warning score EWS | NEWS2, med texten NEWS2 |

LOINC har ingen egen kod för NEWS2. Koden 88330-6, som först antogs vara NEWS2, är enligt LOINC Mobility - admission performance during 3 day assessment period [CMS Assessment] och används inte. NEWS2 får därför den allmänna koden för en tidig varningspoäng.

Medvetandegradens svar har LOINC:s svarskoder. A, V, P och U finns i svarslistan LL1845-8 för 67775-7: LA9340-6 Alert, LA17108-4 Verbal, LA17107-6 Painful och LA9343-0 Unresponsive. C, nytillkommen förvirring, har LA6560-2 Confused, som finns i LOINC men inte ingår i den svarslistan.

### KVÅ

Källa: Klassifikation av vårdåtgärder (KVÅ) 2026, giltig från 2026-01-01, version 1.0 2025-10-24, filen kva-inkl-beskrivningstexter-2026.xlsx från E-hälsomyndighetens sida om KVÅ (https://www.ehalsomyndigheten.se/verksamhet/ndi/interoperabilitet/klassifikationer/klassifikation-av-vardatgarder-kva/), hämtad 2026-11-03, sha256 e02d1f7239fb8919dcb02c10773c44fe320e199fdae7e0154a33d89635450d36, 11 915 rader med femställiga koder. Socialstyrelsens sida om KVÅ leder numera till E-hälsomyndigheten. Filen lästes som data med standardbiblioteket i Python.

| Kod | Titel i KVÅ 2026 | Sätts av systemet när |
|---|---|---|
| QD008 | Övervakning av vitala tecken | en hel NEWS2-kontroll registreras |
| PA001 | Bedömning av medvetandefunktioner | GCS registreras |
| XV015 | Läkemedelsgenomgång, enkel, enligt Socialstyrelsens föreskrift och allmänna råd | en läkemedelsgenomgång sparas |
| DV111 | Enkla råd om tobaks- och nikotinbruk | en anteckning om tobaksvanor signeras med enkla råd givna vid besöket (runda 8) |
| DV112 | Rådgivande samtal om tobaks- och nikotinbruk | som ovan, rådgivande samtal |
| DV113 | Kvalificerat rådgivande samtal om tobaks- och nikotinbruk | som ovan, kvalificerat rådgivande samtal |
| JKA21 | Laparoskopisk kolecystektomi | operationen är slut (runda 9, ingreppet i operationsanmälan) |
| JEA01 | Laparoskopisk appendektomi | som ovan |
| NFB49 | Primär total höftledsplastik med cement | som ovan |
| NGB49 | Primär totalprotes i knäled med cement | som ovan |

Runda 9, r3: de fyra operationerna kontrollerades 2026-11-08 mot samma fil (samma sha256), bladet med kirurgiska åtgärder (KKÅ). JEA00 är öppen appendektomi och JEA01 den laparoskopiska. Medicinskt verksamhetsområde 451 Obstetrisk och gynekologisk vård, som kvinnokliniken i demon har, fanns redan i den kontrollerade kodlistan över verksamhetsområden.

OID: urn:oid:1.2.752.116.1.3.2.1.4, som står som aktiv för Klassifikation av vårdåtgärder (KVÅ) i Socialstyrelsens OID-serie (socialstyrelsens-oid-serie-2025-10-17.xlsx, länkad från socialstyrelsen.se/statistik-och-data/klassifikationer-och-koder/andra-kodverk/oid/, hämtad 2026-11-03, sha256 169cc3108f2469a576478922fe4e3e09590dbf1762b9b5507075c795616aaa44). Äldre OID:er för filerna med koder och kodtexter (till exempel 1.2.752.116.1.3.2.3.4) står som inaktiva i samma fil. HL7:s terminologiserver har inte KVÅ, så validatorn kan inte kontrollera koderna.

DV111 till DV113 kontrollerades 2026-11-08 i samma fil (samma sha256). Socialstyrelsens Indikatorer för vård vid ohälsosamma levnadsvanor 2024 (2024-11-9207, sha256 2473b19a6ac87853a547c89f49c4d13c5a13901e21abb7a996001c8028a72a70) anger samma tre koder för indikatorn rådgivning vid daglig rökning. Rekommendationerna som förslaget följer är ur Nationella riktlinjer 2024, Vård vid ohälsosamma levnadsvanor, prioriteringsstöd (2024-11-9272, sha256 df59fc17fee6bde8aaa455158842787a4b6ae92b014cb47beb9eaf26256dc3a0), avsnittet Tobaks- och nikotinbruk. Frågorna är ur Vägledning för enhetlig dokumentation av en persons levnadsvanor, version 3 (2026-01-14, sha256 6e99cb59922b121d74414b8cf90e05e4e7dda1921f702e3dc0fd31e9df131d1b), och Snomed CT-koderna för produkterna och användningen ur Struktur och kodning för svar på frågor om en persons levnadsvanor, version 1.2 (sha256 421ae073b9c3caa0165573b97670c013f726bc515cac697090e01a11be73f399), båda från kunskapsstyrningvard.se. Snomed CT-koderna är inte kontrollerade mot den gällande utgåvan av Snomed CT, som kräver licens.

Andra koder som passar men inte används än: AW042 Uppföljning av åtgärd vid tobaks- och nikotinbruk, DF026 Elkonvertering, defibrillering av förmaksflimmer, planerat (för vårdhändelsen elkonvertering), XV016 Läkemedelsgenomgång, fördjupad och XV017 Läkemedelsberättelse.

## Rapportering till myndigheter och register (runda 7, r5, 2026-11-08)

Formaten och koderna för rapporteringen (`app/src/myndighetsrapport.js` och `app/src/rapportkoder.js`) är hämtade från Socialstyrelsen 2026-11-08. Filerna lästes som data med `pdftotext` och `python3 -I`.

| Rapport eller kodverk | Källa | Version och kontrollsumma |
|---|---|---|
| Patientregistret, föreskrifterna | HSLF-FS 2023:33, https://www.socialstyrelsen.se/contentassets/8d1ca5d2feee419b8303010206aa9302/2023-6-8667.pdf | Beslutad 2023-06-20, gäller uppgifter från 2024, sha256 020c7ead00e3e071021b0c29455494464a8a4f3d41ae283b8824fbfdd2ae39eb. Bilaga 3 (TV-filen) gäller i den här lydelsen. |
| Patientregistret, bilaga 1 och 2 i gällande lydelse | HSLF-FS 2025:44, https://www.socialstyrelsen.se/contentassets/1d37266011034f8f926a4e59dec6235d/2025-6-9550.pdf | Beslutad 2025-05-27, gäller från 2025-07-01, sha256 18d28a0d47c0f56d10e87eb9ca29fe3078e28f0b7ec76838311b97f22be45f98. Fem filer för slutenvård (AD, DI, YO, AT och LT) och sex för öppenvård (AD, DI, YO, AT, LT och YK). Diagnoskoder med fyra eller fem tecken utan punkt. |
| Patientregistret, kommande ändring | HSLF-FS 2026:27, https://www.socialstyrelsen.se/contentassets/797a75839e994a38a1d7b09319a35d5b/2026-6-10367.pdf | Gäller från 2027-01-01 och lägger till ett id för vårdformsperioden i TV-filen, sha256 b3111c6fd7ac0d949e34aaac5155d65d2daf22c9877081e00713e0382237111f. Inte byggd än. |
| Väntetider i vården | Filspecifikation för uppgifter om väntande i specialiserad vård, https://www.socialstyrelsen.se/globalassets/sharepoint-dokument/dokument-webb/statistik/register-vantetider-filspecifikation_vantande_specialiserad_vard-ny.pdf | Version 1.2, 2025-10-01, sha256 404e8810b30b729c6ac01dec953fd71f2a2001ebee35c2a998e42f79e16d21c6. Rapporteringen gick från SKR till Socialstyrelsen den 1 juli 2025 (sidan Lämna uppgifter om väntetider). |
| Väntetider, vårdutbudsförteckningen | register-vantetider-aktiviteter-vantetidsdatabasen.xlsx på samma sida | Version 1.0, sha256 64deb0e11bee5a2e16f30e46947aaa70a81cc102c81d611f2e293a74803aa950. Elkonvertering är aktivitet 23102 (verksamhetsområde 231, KVÅ DF010 och DF026). |
| Medicinska födelseregistret | HSLF-FS 2024:5, https://www.socialstyrelsen.se/contentassets/4a76524997314430ac7fc5a42b0fb597/2024-3-8995.pdf, och rättelsebladet i samma katalog | Beslutad 2024-03-05, gäller från 2025-07-01, sha256 72d0c2d42981afd69fe3646b9cc8bf966e51fef014a1b154a1587adf48d22087 (rättelsebladet c66d4147226eecc27eb8d0795032bdcbbe0a3e8240511033fc2a41c446a82004). FV1 har 66 frågor. |
| Vårdtillfällesdatabasen | Ingen gällande teknisk beskrivning hittades hos Socialstyrelsen eller SKR. Vårdtillfällen rapporteras i dag till patientregistret. | Formatet i Vårdkällan är ett antagande och märkt så. |
| Sjukhuskoder | koder-for-sjukhus-patientregister-2026.xlsx, https://socialstyrelsen.se/statistik-och-data/klassifikationer-och-koder/andra-kodverk/sjukhuskoder/ | Koder till och med juni 2026, sha256 7fcc865f6c6b30f5de443ea875c366ecd99d0514a6e59967cd06c0a63f1de722. Universitetssjukhuset Örebro 55010, Karlskoga lasarett 55011 och Lindesbergs lasarett 55012. |
| Verksamhetsområden (MVO) | sjukhuskoder-kodlista-verksamhetsomraden-2006.pdf på samma sida | sha256 11ce6a97e81a253657c45cd1ff6da2d9dd0de536b63c8fed5e7ebb7e1404c4d0. Koderna 011, 100, 101, 121, 231, 311, 441, 451, 731 och 901 kontrollerade (731 Medicinsk radiologisk vård för röntgenkliniken i runda 11). Akutmottagningen har 100 Akutklinik. Ingen kod i listan har texten akutsjukvård: de enda koderna för akut är 046 Intagnings-/Akutverksamhet och 100 Akutklinik. 100 valdes eftersom Akutmottagningen USÖ är en egen klinik och 046 avser intagning. Inte heller väntetidsdatabasens vårdutbudsförteckning (sha256 64deb0e1...) eller dess samlade filspecifikationer (register-vantetider-filspecifikationer-vantetidsdatabasen.xlsx, sha256 88279770e7245195095b64408a8dc1e3c8479812478f9303b92a1a314cd530af) har texten. |
| SOSNYK | sosnyk-2027.xlsx, https://www.socialstyrelsen.se/statistik-och-data/klassifikationer-och-koder/andra-kodverk/sosnyk/ | Version 1.0, sha256 2bb19bd4df628162d8c6fb3339e7e418a0193df981f49f3d39242993303868ed. Läkare 11000, sjuksköterska 31000, undersköterska 52800, oförändrade sedan 2024. |
| Yttre orsaker och förlossning, ICD-10-SE | icd-10-se.tsv (samma fil som ovan, sha256 696c0c02178dabce2c99802898e98cb5c7c4a3af1f78c5cc1c2ad29f5eaabae8) | Alla 280 kombinationer av W01, W10, W19 och X59 med plats 0 till 9 och aktivitet 0 till 4, 8 och 9 har exakt den titel som systemet sätter ihop. O80 till O84 och Z37.0 till Z37.9 kontrollerade. Yttre orsaker och Z37 har markeringen att de inte ska användas som huvuddiagnos. |
| Länskod och kommunkoder | SCB:s förteckning över läns- och kommunkoder | Örebro län 18, Örebro 1880, Kumla 1881, Askersund 1882, Karlskoga 1883, Nora 1884 och Lindesberg 1885. Inte omkontrollerade mot en nedladdad fil. |
| Tjänstekontrakten | Bilaga K10, Nationella tjänster v2 (xlsx i regionens förfrågningsunderlag), läst cell för cell | 81 rader, GetAllCareTypes står två gånger. Kolumnerna Producent och Konsument och de nationella tjänsterna är tagna ur cellernas plats, eftersom textutdraget tappar tomma celler. |

Sjukhusförteckningen innehåller namn på enskilda privatpraktiker. Inga av dem används i Vårdkällan.
## Tillväxt och barnhälsovård (runda 7, r6)

### Referensvärden för tillväxt

Barnhälsovården i Sverige använder svenska referenser: Göteborg 1974 (kurvorna i BHV-journal 2000 och 2006), Sverige 1981 och nyare referenser från 2020 och 2021 (Rikshandboken i barnhälsovård, Tillväxtkurvor och tillväxtreferenser, godkänd 2022-08-08, läst 2026-11-08). Referensvärdena är publicerade i vetenskapliga artiklar och i kurvblad som säljs, men ingen av dem finns utgiven under en fri licens, och Rikshandboken säger inget om villkoren för att använda dem i ett it-system. De används därför inte i Vårdkällan.

Vårdkällan använder WHO:s tillväxtstandard 0 till 5 år (WHO Child Growth Standards, 2006). Rikshandboken nämner den som den tredje referensen och att NEXT-gruppen 2011 rekommenderade att journalsystem har en svensk referens och WHO:s. Rikshandboken rekommenderar inte WHO:s kurvor för huvudomfång i Norden, och det står under kurvorna.

Licens: WHO:s publikationer ges ut under CC BY-NC-SA 3.0 IGO, och kommersiell användning kräver WHO:s tillstånd (who.int, Copyright, läst 2026-11-08). WHO:s R-paket anthro, som har samma tabeller, har licensen GPL-3.0 (github.com/WorldHealthOrganization/anthro). Vårdkällan är ett demoprojekt utan kommersiellt syfte och använder tabellen med angiven källa. Tabellen ligger i en egen fil (`app/src/seed/who-tillvaxt.js`) och omfattas inte av Vårdkällans licens EUPL 1.2.

Källa: WHO:s tabeller med z-värden, hämtade från cdn.who.int 2026-11-08. L, M och S per månad, 0 till 60 månader, för pojkar och flickor. Längden är liggande längd till 24 månader och stående från 25 månader.

| Fil | SHA-256 |
|---|---|
| wfa_boys_0-to-5-years_zscores.xlsx | f8f5a77b944ff7a8c1524e76f9d33f8a93cc423d23c2e7f2b10ba6b96a428e69 |
| wfa_girls_0-to-5-years_zscores.xlsx | 01e9a6fda2f3723dbc74d3c86bfbfcb9f6d474367d1d7b4a804501a2debd2ef1 |
| lhfa_boys_0-to-2-years_zscores.xlsx | ccfd8e455141c9a39dd728d99b7d7e080a925b06ea4a4d7592229665713dba54 |
| lhfa_boys_2-to-5-years_zscores.xlsx | a44ed06039e0a9dd6920e4a4d928395c541c9732662e49eacd489d2194ccc80d |
| lhfa_girls_0-to-2-years_zscores.xlsx | 6757f5eb96b51ab5cdb4828105929c78b1fb3d73b0fd8fa65682ad9f60f8c083 |
| lhfa_girls_2-to-5-years_zscores.xlsx | a976c56a6d36885cc32bf77c5539ca066e396ef2adad06011cd71d9eb0f0eb5c |
| hcfa-boys-0-5-zscores.xlsx | 296038a15de807ee74940627bd1ddc638e68b223b410b4ca3ccf1ff4a8b5770a |
| hcfa-girls-0-5-zscores.xlsx | 134cd53ca39f0f55b0b3c2bc6c94278c83d9945842bc64088464f73effcd12e7 |
| bmi_boys_0-to-2-years_zcores.xlsx | 1d5e9e0062795ec5e7b06f1e36c23bea32d6f554840bef5a755cc0b47858e1b0 |
| bmi_boys_2-to-5-years_zscores.xlsx | 874063e82b4592e4d2dc8b7534861d759541548abe38269fba50ba3861e9aff1 |
| bmi_girls_0-to-2-years_zscores.xlsx | daf06e553ef31c7100cbb7f27fa9ddc8a9e9326167865b07ee8c1268931e1eb6 |
| bmi_girls_2-to-5-years_zscores.xlsx | 9e27264b319e9290fc32b7896894da6c5b41b4f471695f2e13016cae8f329973 |

Ett test räknar om värdet vid +2 SD för vikt hos flickor vid 12 månader, -2 SD för längd hos flickor vid 24 månader, medianen för huvudomfång hos pojkar vid 6 månader och +1 SD för BMI hos flickor vid 36 månader ur L, M och S och jämför med kolumnerna SD2, SD2neg, SD0 och SD1 i samma filer (11,5 kg, 80,0 cm, 43,3 cm och 16,8).

### Besöksprogram och vaccinationer

| Del | Källa | Läst |
|---|---|---|
| Hälsobesöken | Region Örebro län, Kravspecifikation barnhälsovård Hälsoval 2026, bilaga 1 (översikt) och bilaga 2 (för alla), Dnr 25RS8809, vardgivare.regionorebrolan.se, som bygger på Rikshandboken i barnhälsovård | 2026-11-08 |
| Vaccinationerna | Folkhälsomyndigheten, Barnvaccinationsprogram, uppdaterad 2026-04-16, folkhalsomyndigheten.se | 2026-11-08 |
| Rotavirus | Folkhälsomyndigheten, För personal inom barnhälsovården om vaccination mot rotavirus: två doser vid 6 veckor och 3 månader, eller tre doser till 5 månader, minst 4 veckor mellan doserna, och vaccinationen påbörjas inte efter 12 veckors ålder | 2026-11-08 |
| Vattkoppor | Regeringen, pressmeddelanden 2025-09 och 2026-07: vaccinationen ingår i barnvaccinationsprogrammet, förordningen gäller från 1 november 2026 och vaccinet erbjuds från 1 januari 2027 för barn födda 1 juli 2025 eller senare (1177). Åldern för dosen stod inte på Folkhälsomyndighetens sida, så vaccinet finns inte med i demon | 2026-11-08 |

Vaccinerna kodas med ATC, kontrollerade mot WHO:s ATC/DDD-index (atcddd.fhi.no) 2026-11-08: J07BH01 rota virus, live attenuated, J07CA09 diphtheria-haemophilus influenzae B-pertussis-poliomyelitis-tetanus-hepatitis B, J07AL02 pneumococcus, purified polysaccharides antigen conjugated, J07BD52 measles, combinations with mumps and rubella, live attenuated, J07CA02 diphtheria-pertussis-poliomyelitis-tetanus och J07AN01 tuberculosis, live attenuated.

### Bilaga K11 och övriga koder

Koderna för Svenska barnhälsovårdsregistret står ordagrant som i bilaga K11 till förfrågningsunderlaget (Informationsspecifikation Svenska barnhälsovårdsregistret, Formulär Bedömningar, version 1.7, 2017-04-11) i `app/src/kodverk.js` (`K11`): Snomed CT för tillväxtens observationer (till exempel 27113001 kroppsvikt, 248334005 kroppslängd, 363812007 huvudomfång, 364589006 födelsevikt, 412726003 graviditetslängd vid födelse och 53851000052106 längd hos biologisk mor), kontakttyp 2 och 3 ur V-TIM 2.2 och befattningskoderna ur KV_befattning, med OID:erna i bilagans sammanställning. Koderna är inte kontrollerade mot den gällande utgåvan av Snomed CT, som kräver licens, och en kod kan ha ersatts sedan 2017. Sitthöjd (248335006) registreras inte.

Huvudomfång har LOINC 9843-4 Head Occipital-frontal circumference, kontrollerad via tx.fhir.org 2026-11-08, och FHIR R4:s vitalparameterprofil headcircum. ICD-10-SE Z00.1 Rutinmässig hälsoundersökning av barn utan besvär eller utan att diagnos registrerats står ordagrant som i Socialstyrelsens icd-10-se.tsv (samma fil som ovan, sha256 696c0c02178dabce2c99802898e98cb5c7c4a3af1f78c5cc1c2ad29f5eaabae8).
## Runda 7: läkemedelskatalogen utökad till 103 produkter (2026-11-08)

Sussas användbarhetstester kräver en läkemedelskatalog med minst 100 läkemedel, varav 22 namngivna (Bilaga F1:3 tabell 6). Katalogen hade 50 produkter. 53 nya är tillagda, alla kontrollerade mot Läkemedelsverkets NPL och med förpackningar som i runda 6.

| Källa | Version och kontrollsumma | Användning |
|---|---|---|
| NPL, Nationellt produktregister för läkemedel (Läkemedelsverket), totalfil `2026-11-03_Total_NPL.zip` från npl.mpa.se/MpaProductExport/4.5/ | NPL 4.5, schema `npl-schema_12.2`, 44 444 produkter, 63 185 679 byte, sha256 06b74dd8e01c20f0237dca98db187ffb59095727cb0e0dab25c3380686465fc9 | Namn (`medprodnamelegal`), styrka, beredningsform och substansbeskrivning med NPL:s svenska text, ATC-kod, administrationsvägar, godkännandedatum, avregistreringsdatum, stoppad försäljning och förpackningar |
| WHO:s ATC/DDD-index (atcddd.fhi.no), hämtat 2026-11-08 | En sida per kod | ATC-benämningen för de sex nya koderna |

Kontrollen gjordes med tre skript som läser filerna som data (`python3 -I`, filerna i en egen katalog under `$TMPDIR`):

1. `research/lakemedel/npl-index.py` bygger ett index över alla produkter i totalfilen.
2. `research/lakemedel/katalog-runda7.py` väljer varje ny produkt på namn, styrka och form och stoppar om produkten inte finns exakt en gång, är avregistrerad, har stoppad försäljning eller saknar en förpackning som inte är avregistrerad eller parallelldistribuerad.
3. `research/lakemedel/katalog-runda7-js.py` skriver produkterna i `app/src/seed/lakemedel-katalog.js` och facit i `app/src/kodverk.js` (`NPL`), och `forpackningar.py` och `forpackningar-seed.py` skriver förpackningarna som förut.

Testerna i `app/test/kodverk.test.js` jämför varje produkt i katalogen med facit (namn, styrka, form, substans och ATC-kod) och kräver en ATC-kod ur WHO:s register, och testerna i `app/test/lakemedelsstod.test.js` kräver förpackningar för varje produkt.

**Sussas 22 läkemedel.** Sex fanns redan (Alvedon 500 mg, Metformin 500 mg, Morfin injektionsvätska 10 mg/ml, Sertralin 50 mg, Waran 2,5 mg och Zopiklon 5 mg). Sexton är nya: Addex-Magnesium 1 mmol/ml, Alvedon forte 1 g, Atrovent 20 mikrogram/dos inhalationsspray, Atrovent 0,25 mg/ml och 0,5 mg/ml för nebulisator, Kloramfenikol Santen ögondroppar 5 mg/ml och ögonsalva 10 mg/g, Metformin Teva 850 mg, Morfin Alternova 10 mg tablett, Sertralin Teva Pharma 100 mg, Stesolid 5 mg och 10 mg, Zopiklon Pilum 7,5 mg och tre ersättare:

- Atrovent Nasal 21 mikrogram/dos finns inte längre i NPL. Samma substans, styrka och form heter i dag Rinivent (19960412000037).
- Paracetamol Panpharma infusion finns inte i NPL. Paracetamol Fresenius Kabi 10 mg/ml infusionsvätska (20090718000014) har samma substans, styrka och form.
- Glukos 25 mg/ml buffrad är Glucos Baxter 25 mg/ml buffrad (19930122000023). NPL anger ingen styrka för den, eftersom styrkan står i namnet, så styrkan är tom i katalogen och i facit.

**Fler styrkor.** 37 produkter är fler styrkor av substanser som redan fanns, till exempel Metoprolol Sandoz 100 mg, Atorvastatin Krka 10 och 20 mg och Eliquis 2,5 mg, så att katalogen har minst 100 produkter utan fler nya ATC-koder. Ramipril fick ingen ny styrka, eftersom en ordination via FHIR med bara ATC-koden C09AA05 annars skulle bli tvetydig.

**ATC.** Sex nya koder med WHO:s benämning: B05BA03 carbohydrates, B05XA05 magnesium sulfate, N05BA01 diazepam, R01AX03 ipratropium bromide, R03BB01 ipratropium bromide och S01AA01 chloramphenicol. Två nya administrationsvägar: OCUL (ögat) och NASA (näsan).

## Runda 8: beställning och svar (2026-11-08)

**NPU.** Sex nya mätvärdestyper för svaren från det simulerade laboratoriet och SR, kontrollerade mot IFCC:s NPU-fil (npu-codes-latest.csv, hämtad 2026-11-08, sha256 6c64b2208917ce072b8419b014781fcd7d12d30163c832486e675571877e9afc, samma fil som 2026-11-03). Alla är aktiva.

| Mätvärde | Enhet i demon | NPU-kod | NPU-definition | UCUM |
|---|---|---|---|---|
| Leukocyter (LPK) | ×10⁹/L | NPU02593 | B, Leukocytes; num.c. = ? × 10⁹/L | 10*9/L |
| Trombocyter (TPK) | ×10⁹/L | NPU03568 | B, Thrombocytes; num.c. = ? × 10⁹/L | 10*9/L |
| Natrium | mmol/L | NPU03429 | P, Sodium ion; subst.c. = ? mmol/L | mmol/L |
| Kobalamin (B12) | pmol/L | NPU01700 | P, Cobalamin; subst.c. = ? pmol/L | pmol/L |
| Folat | nmol/L | NPU02070 | P, Folate; subst.c. = ? nmol/L | nmol/L |
| SR | mm | NPU03404 | B, Sedimentation reaction; length(proc.) = ? mm | mm |

Enheterna är kontrollerade mot UCUM via tx.fhir.org (`CodeSystem/$validate-code`): alla giltiga.

**Snomed CT** (SNOMED CT International via tx.fhir.org, `CodeSystem/$lookup`, 2026-11-08): 108252007 Laboratory procedure (kategori för labbeställningar), 119297000 Blood specimen, 122575003 Urine specimen, 119376003 Tissue specimen, 264868006 No growth, 112283007 Escherichia coli och 3092008 Staphylococcus aureus (odlingarnas fynd).

**HL7 Terminology** (tx.fhir.org): v2-0487 BLD, SER, PLAS, UR och TISS (provets typ), v2-0074 LAB, MB och SP (kategori för svaret) och v3-ObservationInterpretation H, L, HH, LL och N (tolkning). LOINC 11502-2 Laboratory report är koden för svaret.

**Code 128.** Streckkoden på etiketterna (app/src/streckkod.js, kodtabell B) är jämförd bit för bit med zint 2.x (`zint -b 20 --dump`) för fem texter med bokstäver, siffror och specialtecken: samma mönster.

## Runda 9: Snomed CT och Nationell informationsstruktur (2026-11-08)

Delmängden av Snomed CT i `app/src/fackssprak.js` (sökorden i journalens mallar, åtgärderna med KVÅ och sökordet Tobak och nikotin) slogs upp en kod i taget med `CodeSystem/$lookup` på tx.fhir.org mot SNOMED CT International Edition, version `http://snomed.info/sct/900000000000207008/version/20250201`. Alla begrepp är aktiva, och den engelska föredragna termen står som display. Kandidaterna söktes fram med `ValueSet/$expand` med ett filter på termen. Sökord där inget begrepp motsvarar innehållet exakt (Andning/cirkulation, Hud/vävnad, Stöd och Kommentar) fick ingen kod. Provtyperna och fynden i beställning och svar kontrollerades i runda 8.

Den svenska utgåvan (modul 45991000052106) finns inte på tx.fhir.org och kräver licens, så de svenska termerna och koderna ur bilaga K11 är inte kontrollerade mot den. I bygget kontrolleras varje identitet med Snomed CT:s kontrollsiffra (Verhoeff) och partitionen, 00 för den internationella utgåvan och 10 för en nationell.

Informationsklasserna och begreppen i `app/src/informationsmodell-ni.json` är ordagranna ur Socialstyrelsens dokument Nationell informationsstruktur 2023:2 Modeller för hälso- och sjukvård (informationsstruktur.socialstyrelsen.se, hämtat via webbarkivet 2026-11-08, eftersom webbplatsen inte svarade). Begreppens definitioner står i dokumentet som definitioner enligt Socialstyrelsens termbank. Ansvaret för NI, Snomed CT och klassifikationerna flyttas till E-hälsomyndigheten.

## Runda 10, r4: in- och utfarter, donation, skala 2 och uppmärksamhetsinformation (2026-11-08)

KVÅ-koderna för in- och utfarterna och donationen kontrollerades i E-hälsomyndighetens fil kva-inkl-beskrivningstexter-2026.xlsx (samma sha256 som ovan, e02d1f7239fb8919dcb02c10773c44fe320e199fdae7e0154a33d89635450d36), bladen med medicinska och kirurgiska åtgärder: SP021 Inläggning av perifer venkateter, DP028 Byte av perifer venkateter, DP029 Avlägsnande av perifer venkateter, SP105 Inläggning av perifert insatt central kateter (PICC), DF007 Avlägsnande av central venkateter (CVK) UNS, TKC20 Kateterisering av urinblåsa genom urinröret, DK021 Avlägsnande av urinkateter inlagd genom urinröret, DK010 Inläggande av suprapubisk kateter, DK023 Avlägsnande av suprapubisk kateter/cystostomikateter, TJD00 Nasogastrisk eller nasogastroduodenal sond, DV005 Avlägsnande av dränage och AV124 Undersökning av potentiell donator. Skötselkoderna QD004, QD005, DK028 och DV150 från runda 9 finns i samma fil. Insättningen av en central venkateter har i KVÅ en kod per kärl och antal lumen (SP111 och följande), så den får ingen kod av systemet.

ICD-10-SE-koderna Z94.0 till Z94.4, Z94.7 och Z94.8 (transplantationerna) och J96.01, J96.11 och J96.91 (andningssvikt med hyperkapné, som ger förslaget om skala 2) kontrollerades i icd-10-se.tsv, samma fil och sha256 som ovan (696c0c02178dabce2c99802898e98cb5c7c4a3af1f78c5cc1c2ad29f5eaabae8).

Kodverkslistan för uppmärksamhetsinformation är bilagan 2025-12-9984-bilaga-kodverkslista.xlsx till Informationsspecifikation för uppmärksamhetsinformation version 6.1.2, publicerad 2025-12-15 på E-hälsomyndighetens sida om uppmärksamhetsinformation (https://www.ehalsomyndigheten.se/verksamhet/ndi/interoperabilitet/uppmarksamhetsinformation/), hämtad 2026-11-08, sha256 deb89adce3e87447e1b5aba11a6be716326a69a37aa598b884be21eb7c048db9. Socialstyrelsens gamla länkar till specifikationen leder inte längre fram. Filen lästes som data med standardbiblioteket i Python, blad för blad, till `app/src/seed/umi-kodverkslista.json`: 94 termer med ICD-10-SE, ATC, Snomed CT och motivering, och reaktionerna vid överkänslighet. Termerna och motiveringarna är ordagranna, utom att blanktecken är sammanslagna och att tankstrecket i termen för implanterbar defibrillator är ersatt med ett kommatecken. Bladet Ändringar är inte inläst. Snomed CT-begreppen är inlästa bara som id, utan listans svenska beskrivningar ur Snomed CT, eftersom Snomed CT kräver licens. Varje Snomed CT-identitet i listan klarar kontrollsiffran och partitionen i bygget. Begreppen är inte uppslagna mot den svenska utgåvan, som kräver licens.
