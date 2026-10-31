# Kodkontroll

Kontroll av varje kod i seeden, läkemedelskatalogen och FHIR-API:t mot primärkällan, gjord 2026-10-31. De kontrollerade värdena står i `app/src/kodverk.js`, och testerna i `app/test/kodverk.test.js` stoppar bygget om seeden avviker från dem.

## Sammanfattning

| Kodverk | Kontrollerade | Rätt | Rättade | Borttagna |
|---|---|---|---|---|
| ICD-10-SE (diagnoser) | 36 | 17 | 19 (benämning) | 0 |
| ATC (katalog, överkänslighet, regelprefix) | 56 | 56 | 0 | 0 |
| Labbkoder, förut LOINC, nu NPU | 11 | 0 | 10 (bytt till NPU) | 1 (eGFR) |
| Vitalparametrar och PEF, LOINC | 10 | 10 | 1 tillagd kod (2708-6) | 0 |
| UCUM-enheter (nya i FHIR) | 16 | 16 | | |
| KVÅ | 0 | | | |

Totalt 113 kodposter och 16 enhetskoder. Varje labbvärde räknas en gång, men både den gamla LOINC-koden och den nya NPU-koden är kontrollerade.

De viktigaste felen:

1. **19 av 36 diagnoser hade en egen benämning** i stället för Socialstyrelsens. Koderna var giltiga, men texterna var omskrivna, till exempel `E78.0 Ren hyperkolesterolemi` (titeln är Isolerad hyperkolesterolemi), `I50.1 Vänsterkammarsvikt` (Vänsterhjärtsvikt) och `N18.3 Kronisk njursjukdom, stadium 3` (Kronisk njursvikt, stadium 3).
2. **`I50.0` hade texten "Hjärtsvikt med stas"**, men koden betyder Högerhjärtsvikt. ICD-10-SE räknar "Congestive heart failure" till I50.0, så koden står kvar och texten är nu Socialstyrelsens. Om patient 1:s hjärtsvikt kliniskt är en vänstersvikt med lungstas (journalen har basala rassel och EF 40 procent) vore I50.1 rimligare; det är ett kliniskt val och har inte ändrats.
3. **Glukos hade LOINC 2339-0**, som är glukos i masskoncentration (mg/dL), medan demon anger mmol/L. Nu NPU02192 (P, Glucose; subst.c. = ? mmol/L).
4. **eGFR hade LOINC 62238-1**, som anger CKD-EPI-formeln, utan stöd i data för vilken formel som används. NPU har ingen kod för skattat GFR, så koden är borttagen och texten "eGFR" står kvar.
5. **Saturation saknade 2708-6**, som FHIR R4:s profil för syremättnad kräver. Båda koderna finns nu.
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

Alla ATC-koder i katalogen stämmer med substansen i WHO:s register. Den svenska substansen i katalogen är den svenska formen av WHO:s namn (till exempel levotyroxin för levothyroxine sodium). I FHIR är `display` nu WHO:s benämning. Varningsreglerna använder rätt prefix: penicilliner `J01C`, NSAID `M01A` och antikoagulantia `B01AA`, `B01AB`, `B01AE` och `B01AF`. Testet `Kodverk > varningsreglernas ATC-prefix stämmer med WHO:s register` kontrollerar också att prefixen fångar exakt katalogens penicilliner och NSAID. Läkemedelsnamn, styrka och form är inte kontrollerade mot FASS, och NPL-id är påhittade.

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
| Saturation | 59408-5 | Oxygen saturation in Arterial blood by Pulse oximetry | % | oxygensat | rätt, 2708-6 tillagd |
| Saturation | 2708-6 | Oxygen saturation in Arterial blood | % | oxygensat | tillagd, krävs av profilen |
| Andningsfrekvens | 9279-1 | Respiratory rate | /min | resprate | rätt |
| Vikt | 29463-7 | Body weight | kg | bodyweight | rätt |
| Längd | 8302-2 | Body height | cm | bodyheight | rätt |
| PEF | 19935-6 | Maximum expiratory gas flow Respiratory system airway by Peak flow meter | L/min | ingen | rätt (NPU har ingen PEF-kod) |

## KVÅ

KVÅ förekommer inte i seeden eller koden. Inga åtgärder registreras i första versionen.

## Det som inte gick att verifiera

- Att svenska laboratorier i Region Örebro län använder exakt dessa NPU-koder. Koderna är de generella NPU-koderna för analyserna; regionala laboratorier kan ha egna eller svenska lokala koder, som inte finns i IFCC:s fil.
- Läkemedlens namn, styrka och form mot FASS. ATC-koden och substansen är kontrollerade, produkterna inte.
- ICD-10-SE, NPU och NPL-id kontrolleras inte av HL7:s validator, eftersom terminologiservern saknar dem. Kontrollen av dem är den här rapporten och testerna.
