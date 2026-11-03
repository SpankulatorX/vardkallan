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

OID: urn:oid:1.2.752.116.1.3.2.1.4, som står som aktiv för Klassifikation av vårdåtgärder (KVÅ) i Socialstyrelsens OID-serie (socialstyrelsens-oid-serie-2025-10-17.xlsx, länkad från socialstyrelsen.se/statistik-och-data/klassifikationer-och-koder/andra-kodverk/oid/, hämtad 2026-11-03, sha256 169cc3108f2469a576478922fe4e3e09590dbf1762b9b5507075c795616aaa44). Äldre OID:er för filerna med koder och kodtexter (till exempel 1.2.752.116.1.3.2.3.4) står som inaktiva i samma fil. HL7:s terminologiserver har inte KVÅ, så validatorn kan inte kontrollera koderna.

Andra koder som passar men inte används än: DF026 Elkonvertering, defibrillering av förmaksflimmer, planerat (för vårdhändelsen elkonvertering), XV016 Läkemedelsgenomgång, fördjupad och XV017 Läkemedelsberättelse.
