# Källor för tillväxtreferenser (r7)

Underlaget hämtades 2026-11-10. De nedladdade filerna sparas inte i repot, eftersom de är andras verk. `manifest.json` har URL, slutlig URL efter omdirigering, hämttid (UTC), HTTP-status, storlek och sha256 för varje fil. Tabellen i slutet av dokumentet listar samma uppgifter. Hjälpskripten ligger i `verktyg/`.

## 1. WHO Growth Reference 2007, 5 till 19 år

Hämtat: tabellerna med z-värden per månad ("expanded tables") för BMI efter ålder (5 till 19 år), längd efter ålder (5 till 19 år) och vikt efter ålder (5 till 10 år), pojkar och flickor, sex xlsx-filer. URL:erna togs från WHO:s sidor för varje mått under https://www.who.int/tools/growth-reference-data-for-5to19-years. Filerna för vikt heter hfa-boys-z-who-2007-exp_<id>.xlsx och hfa-girls-z-who-2007-exp_<id>.xlsx på cdn.who.int men innehåller vikt (M = 18,5057 kg vid 61 månader för pojkar).

Filer:

- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-boys-z-who-2007-exp.xlsx, sha256 0a60849673f34a06b8e2fe4defe5d00348de687b6c9fce0278f1525fff89eb6d
- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-girls-z-who-2007-exp.xlsx, sha256 66f5c6284b44579ad6135fc639f22c09e36fe5a695b04390377113f6a00deb72
- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-boys-z-who-2007-exp.xlsx, sha256 d78fa8cafcab77dcb5f03d71506d92bdcb28f89c642816b6bb0eef466b007466
- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-girls-z-who-2007-exp.xlsx, sha256 df07ee16d3d2916569f1d869b7c874d7b880a41321d871215ed0254cb16679b3
- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-boys-z-who-2007-exp_0ff9c43c-8cc0-4c23-9fc6-81290675e08b.xlsx, sha256 a6ed0d9f3cfa209747afe49f7503b7cc24a1be6b6a8e7222e85a36b7850cb99f
- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-girls-z-who-2007-exp_7ea58763-36a2-436d-bef0-7fcfbadd2820.xlsx, sha256 d747e068fcef4238cbaf1c201dd7788f266d9903685f4495360614eed0153562

Filerna lästes med standardbiblioteket i Python (`verktyg/xlsx.py`, zipfile och xml). Kolumnerna Month, L, M och S skrevs till `who2007-tillvaxt.js` av `verktyg/bygg_who2007.py`, avrundade till fyra decimaler för L och M och fem för S. Intervall: BMI och längd 61 till 228 månader, vikt 61 till 120 månader, utan luckor.

Kontroll: WHO ger ut samma tabeller i R-paketet anthroplus (github.com/WorldHealthOrganization/anthroplus, commit 7cfcdb39026e9a55de55732bc3cf14c82261bcf7, filerna data-raw/growthstandards/bfawho2007.txt, hfawho2007.txt och wfawho2007.txt). Alla 792 rader i datafilen är lika med anthroplus (`verktyg/jamfor_anthroplus.mjs`, 0 avvikelser). anthroplus har också raderna 60 och 229 (vikt 60 och 121), som inte finns i WHO:s xlsx och inte är med i datafilen.

Licens:

- WHO:s upphovsrättssida (https://www.who.int/about/policies/publishing/copyright): "WHO's open access applies to: all publications published by WHO CC BY-NC-SA 3.0 IGO". Och: "Permission from WHO is not required for the use of WHO materials issued under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Intergovernmental Organization (CC BY-NC-SA 3.0 IGO) licence." Samma sida säger också: "The use of WHO materials that are not available under the CC BY-NC-SA 3.0 IGO licence is subject to permission being granted by WHO", bland annat för "licensing of materials or other technical information in electronic database products and services".
- WHO:s villkor för webbplatsen (https://www.who.int/about/policies/terms-of-use): "Extracts of the information in the web site may be reviewed, reproduced or translated for research or private study but not for sale or for use in conjunction with commercial purposes. Any use of information in the web site should be accompanied by an acknowledgment of WHO as the source, citing the uniform resource locator (URL) of the article. Reproduction or translation of substantial portions of the web site, or any use other than for educational or other non-commercial purposes, require explicit, prior authorization in writing."
- Sidorna för 2007 års referens anger ingen egen licens. Artikeln (de Onis m.fl., Bull World Health Organ 2007;85:660-7, PMC2636412) är märkt "© World Health Organization (WHO) 2007. All rights reserved."
- anthroplus: DESCRIPTION anger "License: GPL (>= 3)" och World Health Organization som upphovsrättsinnehavare (role "cph"); LICENSE.md är GNU GPL version 3.

Slutsats: får användas i ett icke-kommersiellt öppet demoprojekt med WHO som källa, på samma villkor som WHO:s standard 0 till 5 år. Tabellerna på who.int har ingen uttrycklig CC-märkning, men webbplatsens villkor tillåter icke-kommersiell användning med angiven källa, och WHO ger själv ut exakt samma tal under GPL-3.0 i anthroplus. Vid kommersiell användning är GPL-3.0 via anthroplus den väg som ska prövas, annars tillstånd från WHO.

## 2. Prematurkurvor

### a) Fenton 2013

Hämtat: artikeln i PMC (PMC3637477), Crossref-posten och Fentons sida på ucalgary.ca.

- Artikeln: "Copyright © 2013 Fenton and Kim; licensee BioMed Central Ltd. This is an Open Access article distributed under the terms of the Creative Commons Attribution License (http://creativecommons.org/licenses/by/2.0)". Crossref anger samma licens.
- Artikeln publicerar inte LMS-värdena. Den säger: "Exact z-score and centile calculators for the revised charts are available for download: http://ucalgary.ca/fenton. Data is available for research upon request."
- Fentons sida (https://ucalgary.ca/resource/preterm-growth-chart): "Commercial Use: To obtain the Growth Chart Data for commercial use, please contact [kontaktperson på Innovate Calgary]" och "Research or Individual Use: To obtain the data for research or individual institution/hospital use, please send me an email at: tfenton@ucalgary.ca". Sidan säger inget om fri licens för data. Sidan visar nu också Fenton 2025.

Slutsats: får inte användas. Artikeln är CC BY men innehåller inga koefficienter, och data lämnas bara ut på begäran (forskning) eller mot avtal (kommersiellt).

### b) INTERGROWTH-21st

Hämtat: Crossref- och Europe PMC-posterna för Villar 2015 (Lancet Glob Health 2015;3:e681-91) och Villar 2014 (Lancet 2014), sidorna på intergrowth21.com och intergrowth21.ndog.ox.ac.uk, och en z-värdestabell (pojkar, vikt) som PDF.

- Villar 2015: Crossref anger licensen http://creativecommons.org/licenses/by-nc-nd/4.0/ för den publicerade versionen (vor), och Europe PMC anger "cc by-nc-nd". Artikeln finns inte i PMC.
- Villar 2014 (newborn size): Crossref anger bara Elseviers TDM-användarlicens (https://www.elsevier.com/tdm/userlicense/1.0/). Europe PMC anger ingen licens och isOpenAccess N.
- Tabellen grow_preterm-zs-boys_bw_table.pdf är märkt "© University of Oxford".
- intergrowth21.com (sidan med verktyg): "Practitioners can download and use these charts freely." De hämtade sidorna (startsidan, verktygssidan, sidan för prematurer, sidan för nyföddas storlek och sidan med appar, samt intergrowth21.ndog.ox.ac.uk) anger ingen licens och inga villkor för användning i it-system. Frågor hänvisas till intergrowth@wrh.ox.ac.uk.

Slutsats: får inte användas fritt. Den artikel som har ekvationerna för prematurer är CC BY-NC-ND 4.0, som förbjuder bearbetningar, och tabellerna är © University of Oxford utan licens. Fri användning av sjukvårdspersonal gäller kurvbladen, inte inbyggnad i ett system.

### c) Ekvationerna i en CC BY-artikel

Ingen av artiklarna med INTERGROWTH-ekvationerna är CC BY (se b), och Fenton 2013 publicerar inga ekvationer eller LMS-värden. Artikeltexten för Villar 2015 gick inte att hämta: thelancet.com och sciencedirect.com svarade 403, och api.elsevier.com svarade 403 utan API-nyckel. Ekvationerna är därför inte lästa, och ingen datafil är skriven. `prematur-tillvaxt.js` finns inte.

## 3. Kurvor för syndrom

### Downs syndrom (CDC, Zemel m.fl. 2015)

Hämtat: CDC:s sida (https://www.cdc.gov/ncbddd/birthdefects/downsyndrome/growth-charts.html, omdirigerad till https://www.cdc.gov/birth-defects/hcp/down-syndrome-growth-charts/), två av kurvbladen som PDF, CDC:s policy för myndighetens material, en arkiverad version av sidan från 2018 (web.archive.org), artikeln i PMC (PMC5451269) och Crossref-posten.

- CDC:s sida har bara kurvblad som PDF (vikt, längd/höjd, huvudomfång, vikt för längd 0 till 36 månader; vikt, höjd, huvudomfång 2 till 20 år). Sidan har inga datafiler med LMS-värden, och det hade inte heller sidan 2018. BMI hänvisas till artikeln.
- Kurvbladen anger "Published October 2015. Source: Zemel BS, Pipan M, Stallings VA, Hall W, Schgadt K, Freedman DS, Thorpe P. Growth Charts for Children with Down Syndrome in the U.S. Pediatrics, 2015." och ingen upphovsrättsmärkning.
- CDC:s policy (https://www.cdc.gov/other/agencymaterials.html): "Most of the information on the CDC and ATSDR websites is not subject to copyright, is in the public domain, and may be freely used or reproduced without obtaining copyright permission." Med undantag: "First, some resources, as well as images, on the CDC and ATSDR websites are restricted in their use because they were developed by government contractors or grantees, or have been licensed by a third party", och "Copyright-protected materials featured on the CDC and ATSDR websites should include a copyright statement."
- LMS-värdena står i artikelns tilläggstabeller 4 till 19: "Supplemental Tables 4 through 19 provide the sex- and age-specific L, M, and S values and selected centiles for weight, length/height, weight-for-length, BMI and head circumference". Artikeln är märkt "Copyright © 2015 by the American Academy of Pediatrics". Huvudförfattarna är från Children's Hospital of Philadelphia och två från CDC. Länken till tilläggsfilen i PMC gav en sida som kräver JavaScript i stället för filen, och den hämtades inte.

Slutsats: får inte användas som datafil. Kurvbladen på cdc.gov är troligen public domain, men de innehåller bara kurvor, inga tal att läsa ut utan att mäta i bilder. LMS-tabellerna finns bara i tillägget till en artikel med AAP:s upphovsrätt. `down-tillvaxt.js` finns inte.

### Turners syndrom

Hämtat: Crossref-poster och PMC-versioner för tre kandidater.

- Darendeliler m.fl., Growth curves for Turkish girls with Turner syndrome, J Clin Res Pediatr Endocrinol 2015;7(3):183-191 (PMC4677552): "This is an open-access article distributed under the terms of the Creative Commons Attribution License, which permits unrestricted use, distribution, and reproduction in any medium, provided the original work is properly cited." Artikeln anger L, M och S för höjd (tabell 2) och vikt (tabell 3) och centiler för BMI (tabell 4), 842 turkiska flickor. Tabellerna är bilder i PMC och lästes inte ut.
- Isojima m.fl., Proposal of new auxological standards for Japanese girls with Turner syndrome, Clin Pediatr Endocrinol 2010;19(3):69-82 (PMC3687623): "2010©The Japanese Society for Pediatric Endocrinology. This is an open-access article distributed under the terms of the Creative Commons Attribution Non-Commercial No Derivatives (by-nc-nd) License."
- Isojima och Yokoya, Growth in girls with Turner syndrome, Front Endocrinol 2023 (doi 10.3389/fendo.2022.1068128): CC BY 4.0 enligt Crossref. Det är en översikt, inte en referens med egna tal.

Slutsats: den turkiska referensen är CC BY och är den enda fritt licensierade Turnerreferens som hittades. Tabellerna finns bara som bilder, och ingen datafil är skriven. Den japanska är CC BY-NC-ND och får inte bearbetas.

## 4. Snomed CT

Alla koder slogs upp med `CodeSystem/$lookup` på https://tx.fhir.org/r4 (`verktyg/snomed.py` och `verktyg/snomed_fsn.py`). Svaren ligger i `original/snomed/` med sha256 i `manifest.json`. Version: http://snomed.info/sct/900000000000207008/version/20250201 (International Edition). Resultatet står i `snomed-uppslag.json` (en post per kod med kod, display, aktiv, version, fsn, modul, effectiveTime och föräldrar, eller fel).

- Aktiva: 364589006 Birth weight, 169886007 Birth length, 169876006 Birth head circumference, 412726003 Length of gestation at birth, 27113001 Body weight, 363812007 Head circumference, 248335006 Sitting height, 80943009 Risk factor, 707085002 At high risk of tuberculosis infection, 408864009 Vaccination status, 473170005 History of bacillus Calmette-Guerin vaccination.
- Inaktiv: 248334005 Length of body (inaktiv sedan 2021-07-31). Uppslaget anger ingen ersättare. Aktiva begrepp i samma område är 1153637007 Body height och 1149101003 Recumbent body height.
- Finns inte: 53851000052106 och 53861000052109 (svensk utgåva), "Unknown code '53851000052106' in the CodeSystem 'http://snomed.info/sct' version 'http://snomed.info/sct/900000000000207008/version/20250201' (International Edition)" och motsvarande för 53861000052109, HTTP 404.
- Sökningen gav också 70931000052102 Body height of biological father och 70941000052108 Body height of biological mother, med svenskt namnrymdsid men i International Edition (modul 900000000000207008, effectiveTime 2024-03-01).

Tanners pubertetsstadier (sökning med `ValueSet/$expand` och filtren Tanner och pubic hair stage, alla aktiva):

- Bröst, flickor: observation 251811005 Tanner girls breast development stage; stadium 1 till 5: 251812003, 251813008, 251814002, 251815001, 251816000 (Breasts Tanner Stage 1 till 5).
- Genitalia, pojkar: observation 251805007 Tanner boys genital development stage; stadium 1 till 5: 251806008, 251807004, 251808009, 251809001, 251810006.
- Pubesbehåring: observation 251817009 Pubic hair stage; stadium 1 till 5: 251818004, 251819007, 251820001, 251821002, 251822009 (beskrivande namn, inte "Tanner Stage n"; ordningen följer Tanners beskrivning); dessutom 251823004 Hair spread to linea alba.
- Axillbehåring: observation 251824005 Tanner axillary hair stage; stadium 1 till 5: 251825006, 251826007, 251827003, 302086000, 302087009.

Svarsbegreppen är fynd (finding) under 365402005, 365401003, 365403000 och 365404006. Den svenska utgåvan (modul 45991000052106) kräver licens och är inte kontrollerad.

## Sammanfattning

| Referens | Får användas fritt i ett icke-kommersiellt öppet demoprojekt | Datafil |
|---|---|---|
| WHO Growth Reference 2007 | Ja, med WHO som källa (webbplatsens villkor, CC BY-NC-SA 3.0 IGO, samma tal under GPL-3.0 i anthroplus) | who2007-tillvaxt.js |
| Fenton 2013 | Nej, data bara på begäran eller mot avtal | ingen |
| INTERGROWTH-21st prematurer | Nej, artikeln CC BY-NC-ND 4.0, tabellerna © University of Oxford | ingen |
| CDC Downs syndrom | Kurvbladen ja, men inga tal; LMS bara i AAP:s tillägg | ingen |
| Turner, turkisk referens 2015 | Ja, CC BY, men tabellerna är bilder | ingen |
| Turner, japansk referens 2010 | Nej, CC BY-NC-ND | ingen |

## Nedladdade filer

Fil i original/, hämtad (UTC), HTTP-status, sha256 och URL.

| Fil | Hämtad | Status | sha256 | URL |
|---|---|---|---|---|
| anthroplus-DESCRIPTION | 2026-11-10T09:09:10Z | 200 | e65923b9ce67b118e29c28077161ed47f557a2c04cc62543daa4c39a63f906c5 | https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/DESCRIPTION |
| anthroplus-LICENSE.md | 2026-11-10T09:09:10Z | 200 | 585e25ef8f5946a52bf2aed68d5becfc38be94a8663aa01c1b31d88aa57f1de3 | https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/LICENSE.md |
| anthroplus-bfawho2007.txt | 2026-11-10T09:09:09Z | 200 | 70ef3260df08e48ce560c28cff4e733db78fb952cbd881eba63c9d3a15f38a6a | https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/bfawho2007.txt |
| anthroplus-hfawho2007.txt | 2026-11-10T09:09:09Z | 200 | 9ac02aa4908f8ec3c6ba2362a4c7e1356043408b2873548ca22eedc016c235ad | https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/hfawho2007.txt |
| anthroplus-wfawho2007.txt | 2026-11-10T09:09:10Z | 200 | 9234dc640ba54001a9afd42ef15ab675b211a721c8f3c0a07c3431fd9cea0e1c | https://raw.githubusercontent.com/WorldHealthOrganization/anthroplus/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/wfawho2007.txt |
| cdc-ds-boys-weight-0-36mo.pdf | 2026-11-10T09:13:24Z | 200 | e107e0e8eb6696d0bf750a0086a254dab3a5e941bafbe01fa47ede8434111d53 | https://www.cdc.gov/birth-defects/media/pdfs/DS_Boys_Weight_Birthto36mo.pdf |
| cdc-ds-girls-height-2-20y.pdf | 2026-11-10T09:13:24Z | 200 | c92764dbbc003eecf7588bd3085f5a8f5d8ce9f0e6b069a6e0fa95971371cd0c | https://www.cdc.gov/birth-defects/media/pdfs/DS_Girls_Height_2to20years.pdf |
| cdc-ds-growth-charts.html | 2026-11-10T09:12:51Z | 200 | b6db9a81ad52951126f6390634cee187d808697c7c9b600f6e6dacbd07774519 | https://www.cdc.gov/ncbddd/birthdefects/downsyndrome/growth-charts.html |
| cdc-policy-agencymaterials.html | 2026-11-10T09:13:25Z | 200 | 421e5a7aba5b8dbe41aa1d89c5499e24484adf0239a1879d3e0fccc1751fd838 | https://www.cdc.gov/other/agencymaterials.html |
| crossref-fenton2013.json | 2026-11-10T09:10:45Z | 200 | 0fe7585c9aa333ff3624d11aa34c9c4a6fad58b323e80716e1b4e9b5c6659a9d | https://api.crossref.org/works/10.1186/1471-2431-13-59 |
| crossref-turner-jp2010.json | 2026-11-10T09:14:22Z | 200 | 48679fae0df61c311df13bc3cc2bb86f31dbd803cd4819b058de84c69aef72ca | https://api.crossref.org/works/10.1297/cpe.19.69 |
| crossref-turner-review2023.json | 2026-11-10T09:14:22Z | 200 | 00477235c97bca2afa5389ddb85a8f0816f27f7a5bdd5c5395f407398f5254ec | https://api.crossref.org/works/10.3389/fendo.2022.1068128 |
| crossref-turner-tr2015.json | 2026-11-10T09:14:21Z | 200 | 33c22b708969c6da53be580333e282604c75bb5d0094203f5dcc3a45f5739565 | https://api.crossref.org/works/10.4274/jcrpe.2023 |
| crossref-villar2014.json | 2026-11-10T09:10:44Z | 200 | a2cb5d2fe0d7442229f0923143cf599fe7920a1c17b2569599bb60087d2faa56 | https://api.crossref.org/works/10.1016/S0140-6736(14)60932-6 |
| crossref-villar2015.json | 2026-11-10T09:10:44Z | 200 | 1d27f672e21cec7b8710b5e15602fbac35d93918dc556d7f6e7fb966f3c1c4a5 | https://api.crossref.org/works/10.1016/S2214-109X(15)00163-1 |
| crossref-zemel2015.json | 2026-11-10T09:10:45Z | 200 | fb33b49f19d61b2aaa750b448c1fa92035fc0a1adb01272082dcb98c0aa4f1b2 | https://api.crossref.org/works/10.1542/peds.2015-1652 |
| deonis2007-pmc.html | 2026-11-10T09:08:34Z | 200 | 42a0de35d66402a3e642585a212ab3298e1ed3a0d72109c8c292d9d7b6e1b87e | https://pmc.ncbi.nlm.nih.gov/articles/PMC2636412/ |
| europepmc-villar2014.json | 2026-11-10T09:12:26Z | 200 | d7d04e2fadb23570b81ec096604bea2b668204e7ea955fe85eb9af504f88b35d | https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%2210.1016/S0140-6736(14)60932-6%22&format=json&resultType=core |
| europepmc-villar2015.json | 2026-11-10T09:12:25Z | 200 | fd416da1915e94d8978b7d5d3144e0dccbd0f3d3ee8844c176592cb48cde4e9b | https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%2210.1016/S2214-109X(15)00163-1%22&format=json&resultType=core |
| fenton-ucalgary.html | 2026-11-10T09:10:20Z | 200 | 3e56980b26789d1303497b21dc3e261b828e3d26849ffffc87d1ed3987faaa59 | https://ucalgary.ca/resource/preterm-growth-chart |
| fenton2013-pmc.html | 2026-11-10T09:10:16Z | 200 | 615da7820578c9e0646ffa570cb7f6c63e70f96470fb0cc3e0d2a8f62747ab40 | https://pmc.ncbi.nlm.nih.gov/articles/PMC3637477/ |
| intergrowth-apps.html | 2026-11-10T09:11:31Z | 200 | c225041758b2f4aaba4a38e4673a7224ab4f406aa92e0445a6bef0f6016617a8 | https://intergrowth21.com/tools-resources/intergrowth-21st-applications-and-calculators |
| intergrowth-com-implementation.html | 2026-11-10T09:11:09Z | 200 | 6d9288c649c4fd415f3a0ef2204534495d4b5b461780f8de4b734aeea0c2c809 | https://intergrowth21.com/implementation |
| intergrowth-com-tools.html | 2026-11-10T09:11:09Z | 200 | 29ac46a7b4e0f415681f33fc5b0e981d10f6288de8b2addcc17a08d7639dc0b1 | https://intergrowth21.com/intergrowth-21st-applications-calculators |
| intergrowth-com.html | 2026-11-10T09:10:21Z | 200 | 9bcbb4f70d28e87dbc995a082506fefca4e16b02a24297fa3009f6d16b28e3ee | https://intergrowth21.com/ |
| intergrowth-ndog.html | 2026-11-10T09:10:20Z | 200 | 3cde70cc9462ba844862da2cc20a3de492787256ed00e9f239093d0882cf7fee | https://intergrowth21.ndog.ox.ac.uk/ |
| intergrowth-newborn-size.html | 2026-11-10T09:11:30Z | 200 | e242f9c68150b0364f8fac24823590a890d793a4e9a29fbcf1dd2d9cf204ca16 | https://intergrowth21.com/tools-resources/newborn-size |
| intergrowth-node142.html | 2026-11-10T09:12:00Z | 200 | 3e88e53f07cf695078a6234ae56e826c48fa27e05b433c3bd140c3f66eee4e17 | https://intergrowth21.com/node/142 |
| intergrowth-postnatal-preterm.html | 2026-11-10T09:11:30Z | 200 | 27ea9e6377fb5216e5b0359e8b7c147e2258f677a9f0fad92a64e7f328dd1ea1 | https://intergrowth21.com/tools-resources/postnatal-growth-preterm-infants |
| intergrowth-preterm-zs-boys-bw-table.pdf | 2026-11-10T09:12:00Z | 200 | 9092b6b5409c01e40fae424ed489053e707f31a465b646f157ef3d6b324d5d54 | https://intergrowth21.com/sites/default/files/2023-02/grow_preterm-zs-boys_bw_table.pdf |
| intergrowth-tghn.html | 2026-11-10T09:11:10Z | 200 | 49d32f5a7d7b314ee31941c01ccc39060ba74bfb30bb791d83335701bc08c9d2 | https://intergrowth21.tghn.org/ |
| snomed/expand-Tanner.json | 2026-11-10T09:15:31Z | 200 | 952d6a3a5d793fc0860c37748a644df74e5a55da28e9edf614dc8cd3eaec8545 | https://tx.fhir.org/r4/ValueSet/$expand?url=http%3A%2F%2Fsnomed.info%2Fsct%3Ffhir_vs&filter=Tanner&count=100&_format=json |
| snomed/expand-body_height.json | 2026-11-10T09:15:39Z | 200 | 9114bb4a961ada70af92f8939572d288f3a729eb1ccba6102ab23ed67d9d34d7 | https://tx.fhir.org/r4/ValueSet/$expand?url=http%3A%2F%2Fsnomed.info%2Fsct%3Ffhir_vs&filter=body+height&count=100&_format=json |
| snomed/expand-body_length.json | 2026-11-10T09:15:39Z | 200 | 99ccf8fe226f646c4cb093c934c64aa91609ac5064abfcea88b4ded84fbafbe2 | https://tx.fhir.org/r4/ValueSet/$expand?url=http%3A%2F%2Fsnomed.info%2Fsct%3Ffhir_vs&filter=body+length&count=100&_format=json |
| snomed/expand-pubic_hair_stage.json | 2026-11-10T09:15:38Z | 200 | 4483e1cf16b465b091bb7eb61fb729e2d7e212ab8f6074446fb59c7099eb950d | https://tx.fhir.org/r4/ValueSet/$expand?url=http%3A%2F%2Fsnomed.info%2Fsct%3Ffhir_vs&filter=pubic+hair+stage&count=100&_format=json |
| snomed/lookup-1149101003.json | 2026-11-10T09:15:49Z | 200 | e5e5025e925cd1e1a80910c60f9e27420647a20ce11dccba0b8fecc07cb8288b | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=1149101003&_format=json&property=inactive |
| snomed/lookup-1153637007.json | 2026-11-10T09:15:48Z | 200 | c61fc2a99a28e908a257c9fa97a252517f43f2a26e2c1bdace74039d10901b21 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=1153637007&_format=json&property=inactive |
| snomed/lookup-169876006.json | 2026-11-10T09:15:10Z | 200 | 918159438fbea2e53268963a533b1ddeb6fd1528cf5821f9f04e10debb591747 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=169876006&_format=json&property=inactive |
| snomed/lookup-169886007.json | 2026-11-10T09:15:09Z | 200 | 175d1b1d6d1deff8d4e9d4f27d82a730c107e27399888932de8427cce5f22434 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=169886007&_format=json&property=inactive |
| snomed/lookup-248334005.json | 2026-11-10T09:15:11Z | 200 | 931cba1b659b8379bbeffa7b9c2ff164e43069e56be5fe669c9edc7958509e5f | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=248334005&_format=json&property=inactive |
| snomed/lookup-248335006.json | 2026-11-10T09:15:12Z | 200 | 1e6516ed96ab54056ac37be7ba36f7e8fcb15d1e91832d9f4933d6763ecc7c9e | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=248335006&_format=json&property=inactive |
| snomed/lookup-251805007.json | 2026-11-10T09:15:51Z | 200 | 5788801e160925a1e8731966e1592743b576cf6168a82a417ca2f78806a1b1c5 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251805007&_format=json&property=inactive |
| snomed/lookup-251806008.json | 2026-11-10T09:15:57Z | 200 | 3a332de3927efaabda3a125f5a43dabb52383e35d9e5e014ce3c17ceef6fa53b | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251806008&_format=json&property=inactive |
| snomed/lookup-251807004.json | 2026-11-10T09:15:58Z | 200 | 7cb845ecb83d80202813023358432c56d861211e3c3317df19a8b137b68f92da | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251807004&_format=json&property=inactive |
| snomed/lookup-251808009.json | 2026-11-10T09:15:58Z | 200 | 757e627db1c566f7ac2f15525ee079ab88bfd56b3176bfcb4d0db575b7528a29 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251808009&_format=json&property=inactive |
| snomed/lookup-251809001.json | 2026-11-10T09:15:59Z | 200 | 843526cdeb23e4a24402e51a24674a1046adb6ba55020b876db0ae9c704cb82a | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251809001&_format=json&property=inactive |
| snomed/lookup-251810006.json | 2026-11-10T09:15:59Z | 200 | 39f16af40c513701147cdc7ac6a9edda1979dcbfec0ab77d75aa99d1b2c6cc1f | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251810006&_format=json&property=inactive |
| snomed/lookup-251811005.json | 2026-11-10T09:15:51Z | 200 | 34fcfdaf1dc64dc6841b772ef700234c73e585450b1ccdd23d3150c8e6494ac6 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251811005&_format=json&property=inactive |
| snomed/lookup-251812003.json | 2026-11-10T09:15:55Z | 200 | a52e40a697156f9683995d8d9d27c84ead5c0b86520d7c909eb40c6479a79fcd | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251812003&_format=json&property=inactive |
| snomed/lookup-251813008.json | 2026-11-10T09:15:56Z | 200 | 6d2c7ba8abac35f0514253d4c40aba6eb651642f47f4bbda91bd249bf567cfd0 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251813008&_format=json&property=inactive |
| snomed/lookup-251814002.json | 2026-11-10T09:15:56Z | 200 | 27b1eee558032e037d114f4b382cc1aa7276adb815be22616f0066f166cf2c20 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251814002&_format=json&property=inactive |
| snomed/lookup-251815001.json | 2026-11-10T09:15:56Z | 200 | e1a7d972841a291244cdc285265b465ef02b7877ba667a17ef8ce48ce4851d2c | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251815001&_format=json&property=inactive |
| snomed/lookup-251816000.json | 2026-11-10T09:15:57Z | 200 | e478dafe7e856dcb15f476358ce20d7e34aa02f779f5f7087874219b84529f63 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251816000&_format=json&property=inactive |
| snomed/lookup-251817009.json | 2026-11-10T09:15:52Z | 200 | 03a617487ae00e033cebf7a770a8a74712b5ade2a5efa58f8abf382d50bbd5d8 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251817009&_format=json&property=inactive |
| snomed/lookup-251818004.json | 2026-11-10T09:16:00Z | 200 | 20030b29caa8969cc6821b2eb1b150f8f2a2ec991e49c23a150f980a31f48df4 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251818004&_format=json&property=inactive |
| snomed/lookup-251819007.json | 2026-11-10T09:16:00Z | 200 | a7a7fe300bbfb8299b52991c9ff7189620ceefaa869b3d93a8e9285ce87625c7 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251819007&_format=json&property=inactive |
| snomed/lookup-251820001.json | 2026-11-10T09:16:01Z | 200 | e68c2619bb0837504f93cb9c2c6db00ac21eb32e1de0328c8bc79a1d9992a585 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251820001&_format=json&property=inactive |
| snomed/lookup-251821002.json | 2026-11-10T09:16:01Z | 200 | 704bb3cd4ecfaeb38c15162c560602b057e864bf5c3467f6b6623bada37a91a1 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251821002&_format=json&property=inactive |
| snomed/lookup-251822009.json | 2026-11-10T09:16:02Z | 200 | fc7e55fd0cd3e40fb0a129ef57dbb3aa21b72f9a32033d812b348e608493eb58 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251822009&_format=json&property=inactive |
| snomed/lookup-251823004.json | 2026-11-10T09:16:02Z | 200 | 47b6de67874378d2725387f2f0e3ddbc00baec3c5ec66603ef60cf61e970f7d6 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251823004&_format=json&property=inactive |
| snomed/lookup-251824005.json | 2026-11-10T09:15:52Z | 200 | 438f6b83c5381de4e7cb2c63559ddbf1a26927afc6889ea851560219ef469493 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251824005&_format=json&property=inactive |
| snomed/lookup-251825006.json | 2026-11-10T17:10:04Z | 200 | 26b8008c9d52a4bd2d69af3aa12cd1560a1e110a7d385bc546885f4b2280c9ef | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251825006&_format=json&property=inactive |
| snomed/lookup-251826007.json | 2026-11-10T17:10:04Z | 200 | 2fab4c9f89396ba05c43b382a6b62ba7066d3306fd8df701bae2338ee3495fbf | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251826007&_format=json&property=inactive |
| snomed/lookup-251827003.json | 2026-11-10T17:10:05Z | 200 | 56e8622274b42f712a632a8b56ab2166bdfc2b60733c4a6b4604cf6a8ab8133e | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251827003&_format=json&property=inactive |
| snomed/lookup-27113001.json | 2026-11-10T09:15:11Z | 200 | e5c8038dd32cda558c45be7bd2bc0468b279d1dd9ded9907f4ed1bd59eca258b | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=27113001&_format=json&property=inactive |
| snomed/lookup-302086000.json | 2026-11-10T17:10:05Z | 200 | 390ba444e3477c4a81717e49e165dcbf2f91e5f1c6804a5615fda1ca50013d58 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=302086000&_format=json&property=inactive |
| snomed/lookup-302087009.json | 2026-11-10T17:10:06Z | 200 | 76a38fbe0e0026aa9a911850f6658ff38cfc7ba064a5382dd8f344d9b678a52b | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=302087009&_format=json&property=inactive |
| snomed/lookup-363812007.json | 2026-11-10T09:15:12Z | 200 | 1c41b801f17fe27de508fe6f9e7f9702c16de6041d4feeae3f79867db8703df4 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=363812007&_format=json&property=inactive |
| snomed/lookup-364589006.json | 2026-11-10T09:15:09Z | 200 | a3e39976dd236e8498bfbff37d8e7cad08600b5628df1bd62bd2daba28cb38fc | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=364589006&_format=json&property=inactive |
| snomed/lookup-365401003.json | 2026-11-10T09:15:53Z | 200 | a28098cfa86ffec3008c955c39d1c1970e88bdfef6f0672183664b712d8ad1fe | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365401003&_format=json&property=inactive |
| snomed/lookup-365402005.json | 2026-11-10T09:15:53Z | 200 | ff0675c01b01801d512d82dae49b4eed6cdf0720a630f34aa5deb0a2496b2b4e | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365402005&_format=json&property=inactive |
| snomed/lookup-365403000.json | 2026-11-10T09:15:54Z | 200 | ec9a84a2bf4fdb550d40b2ac34a2bfb2cb459702d00567e6e127ced42d52c621 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365403000&_format=json&property=inactive |
| snomed/lookup-365404006.json | 2026-11-10T09:15:54Z | 200 | 5e43e685502c812579fb109654bc4a9c912f8dafabe81c788c457ef224163e44 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365404006&_format=json&property=inactive |
| snomed/lookup-408864009.json | 2026-11-10T09:15:14Z | 200 | ff5838f40fbea97bdb6eb4d220ff61997c40723431029aa70c44c331f073f8b9 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=408864009&_format=json&property=inactive |
| snomed/lookup-412726003.json | 2026-11-10T09:15:10Z | 200 | 9f536c854b8cbb321cae2ecfca4f9e819e16bcdb25ffa522767bbe1abf7bacad | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=412726003&_format=json&property=inactive |
| snomed/lookup-473170005.json | 2026-11-10T09:15:14Z | 200 | 8dbfde73ff13a00f22a0cae0b0c27d75a5e70ecb0190d8575c6a1824c1ef5aed | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=473170005&_format=json&property=inactive |
| snomed/lookup-50373000.json | 2026-11-10T09:15:49Z | 200 | 0ab3194cd21977ad9a21f1dfbf0cb2a3363e5a0940abdd7d2bd8c8d85f4975ce | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=50373000&_format=json&property=inactive |
| snomed/lookup-53851000052106.json | 2026-11-10T09:15:15Z | 404 | 09e97ec7ecfb1917d08ad67b3d0ea086b46e13598e278c2f5a9e88bb3533952d | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=53851000052106&_format=json&property=inactive |
| snomed/lookup-53861000052109.json | 2026-11-10T09:15:15Z | 404 | 8a3e1aa6370daabab7e1a4c9129a82cc33192d0074d731e07f294d2b2f0ef285 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=53861000052109&_format=json&property=inactive |
| snomed/lookup-707085002.json | 2026-11-10T09:15:13Z | 200 | f152a799c2e0e7373a4b32747a65fda96ae81cd4f46dcc761b884fe255c30ccf | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=707085002&_format=json&property=inactive |
| snomed/lookup-70711000052105.json | 2026-11-10T09:15:50Z | 200 | 3ba81e217094e3f12f91ca0a5e02273b868e5667f4d5f6edec44ad3fb73e65d3 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=70711000052105&_format=json&property=inactive |
| snomed/lookup-70931000052102.json | 2026-11-10T09:15:50Z | 200 | 19c9c1039ee0a58c5b0bb9c7599b6a7307e7563121d946da536cc86d006bfd36 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=70931000052102&_format=json&property=inactive |
| snomed/lookup-70941000052108.json | 2026-11-10T09:15:50Z | 200 | f3462753ce98fe768eabbb291a36ea4faf8eb1239ca670900f09c63d1e86f981 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=70941000052108&_format=json&property=inactive |
| snomed/lookup-80943009.json | 2026-11-10T09:15:13Z | 200 | 741ef6aca5606125cece069cbe306371f61f5343b4dab8d21a34a79589aea3e5 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=80943009&_format=json&property=inactive |
| snomed/lookup-full-1149101003.json | 2026-11-10T09:17:43Z | 200 | 7021d3ee24c1037c61c45c7932e6e52ebeee6f1d12152ec5a1394a2ed4e8e50e | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=1149101003&_format=json&property=%2A |
| snomed/lookup-full-1153637007.json | 2026-11-10T09:17:41Z | 200 | cb71861fbe0f6d4604d7fe39819196567120e31b36a55a5e17b2e9a1c1dadfb5 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=1153637007&_format=json&property=%2A |
| snomed/lookup-full-169876006.json | 2026-11-10T09:16:20Z | 200 | 89d3161adb0515fbbf02794b0c83072bd5e4f9f077d30f7b7d3369ba7d7ca72f | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=169876006&_format=json&property=%2A |
| snomed/lookup-full-169886007.json | 2026-11-10T09:16:19Z | 200 | 7a39657591dc9a18f7ae60a29e9eae50c3dbdcf752619b3ecf926998fdb1e515 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=169886007&_format=json&property=%2A |
| snomed/lookup-full-248334005.json | 2026-11-10T09:16:44Z | 200 | 4a87195e7b564dc88789d93eb7c20cdb5c60e5d84c860edd37b7778f6b8c9932 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=248334005&_format=json&property=%2A |
| snomed/lookup-full-248335006.json | 2026-11-10T09:16:53Z | 200 | d5c4cc8cfbbc887e319e8622add02a876c271e9fa6c44acd07f291d21ac67473 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=248335006&_format=json&property=%2A |
| snomed/lookup-full-251805007.json | 2026-11-10T09:18:20Z | 200 | acbda4865553bf0ccced5be29be3bddfcf1cf29225deb4e7aad16279b82c1f3e | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251805007&_format=json&property=%2A |
| snomed/lookup-full-251806008.json | 2026-11-10T09:18:30Z | 200 | dbd22046626c57aef2e7eaab2f4dc7e8e881c6e18e4f26043d430d23cc7149a6 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251806008&_format=json&property=%2A |
| snomed/lookup-full-251807004.json | 2026-11-10T09:18:31Z | 200 | 3b6aeab3ba183348583f92f32dbd4a0228863160e80eec41c6e0b930e8bf007f | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251807004&_format=json&property=%2A |
| snomed/lookup-full-251808009.json | 2026-11-10T09:18:32Z | 200 | db20737c7efaf3d97c6b4c119c2dfa8cb24916938937e9cb4028db2677aa261a | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251808009&_format=json&property=%2A |
| snomed/lookup-full-251809001.json | 2026-11-10T09:18:32Z | 200 | fca7195bc899e0cd3945b04fb0ef2252431817252d13d4d8bc653c3680ad82dc | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251809001&_format=json&property=%2A |
| snomed/lookup-full-251810006.json | 2026-11-10T09:18:33Z | 200 | 878dcae72b15509bf6fde40200bd11d157baf34a2f03c4d5cfdfae1232ec7f4b | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251810006&_format=json&property=%2A |
| snomed/lookup-full-251811005.json | 2026-11-10T09:18:10Z | 200 | 02a7526135cb25fd9ef21ebface0b12661452af89be9f93050fb37c202ae784f | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251811005&_format=json&property=%2A |
| snomed/lookup-full-251812003.json | 2026-11-10T09:18:26Z | 200 | e130f4dd39e0743e0fc2846271ecf5c28573182e99c90861c729dcd8a0218efe | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251812003&_format=json&property=%2A |
| snomed/lookup-full-251813008.json | 2026-11-10T09:18:27Z | 200 | 595921f1017231c8b63089cb773516b2178ac0f5e3051f2ab374e5238bdebf5a | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251813008&_format=json&property=%2A |
| snomed/lookup-full-251814002.json | 2026-11-10T09:18:28Z | 200 | 1f28425689b338699d06c9e92df74479962c27b8c6ef6259aea333adfd9c27fc | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251814002&_format=json&property=%2A |
| snomed/lookup-full-251815001.json | 2026-11-10T09:18:29Z | 200 | 2458f0c513d60905c622407240c0b14ff5cf0d5db1b31e1701d7608156ce37f6 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251815001&_format=json&property=%2A |
| snomed/lookup-full-251816000.json | 2026-11-10T09:18:30Z | 200 | 3d4bde55e17bf9709c0edba563f6bfda4571abb4c963fdfdd5a569b45136720b | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251816000&_format=json&property=%2A |
| snomed/lookup-full-251817009.json | 2026-11-10T09:18:22Z | 200 | 7ff1d960a643caced77ff2ec54a15cd01e0c85c7c3031049934ed455c583cd28 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251817009&_format=json&property=%2A |
| snomed/lookup-full-251818004.json | 2026-11-10T09:18:34Z | 200 | 7104c364d215caef9fbb6ab0a104da064c46e76c032c89fe8fa270c0dc35bc8d | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251818004&_format=json&property=%2A |
| snomed/lookup-full-251819007.json | 2026-11-10T09:18:34Z | 200 | d8b02392508f47d67f58b98be51bf2ecda1521a120db073cb29246a7c44d2e1c | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251819007&_format=json&property=%2A |
| snomed/lookup-full-251820001.json | 2026-11-10T09:18:35Z | 200 | 7ad1b018c00cbfe024841a62b0971e36062d6b7ebc5dfd4b2b935fa416b0cafe | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251820001&_format=json&property=%2A |
| snomed/lookup-full-251821002.json | 2026-11-10T09:18:36Z | 200 | a51ec50b46e6d8e9369bf940cf29f27aa70db7d9fddda50b1b935453aa2429c2 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251821002&_format=json&property=%2A |
| snomed/lookup-full-251822009.json | 2026-11-10T09:18:36Z | 200 | 2b041dff3aa42853fda367701dc1359a3d3aa1b9530b614408c8f018d072b4b9 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251822009&_format=json&property=%2A |
| snomed/lookup-full-251823004.json | 2026-11-10T09:18:37Z | 200 | 521bae7764057cd4fad895bb898e6cea50d0b6cb5fad0cd415c515bb498b445c | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251823004&_format=json&property=%2A |
| snomed/lookup-full-251824005.json | 2026-11-10T09:18:23Z | 200 | f73766906beaf5780abc498798e2cbb8d120d85f624e1bba20f86cbdc0af20d4 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=251824005&_format=json&property=%2A |
| snomed/lookup-full-27113001.json | 2026-11-10T09:16:21Z | 200 | 50527be3e4a799a1c358891d9c0892fb1e97ab5c07746f819f42c64ed7a6124c | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=27113001&_format=json&property=%2A |
| snomed/lookup-full-363812007.json | 2026-11-10T09:16:48Z | 200 | ffddc7db394486f3619ca878675fbec833a8d30a277d5a42c267055a63df83b6 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=363812007&_format=json&property=%2A |
| snomed/lookup-full-364589006.json | 2026-11-10T09:16:19Z | 200 | ff50b2907ffaf63049ed20527e098d2db7d44573e874f4604d20684539eab21c | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=364589006&_format=json&property=%2A |
| snomed/lookup-full-365401003.json | 2026-11-10T09:18:25Z | 200 | 6e3e6cf334d505f3506d77b1956b5a7d02232b689729fa1cb90923126aed3e5a | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365401003&_format=json&property=%2A |
| snomed/lookup-full-365402005.json | 2026-11-10T09:18:24Z | 200 | ec021f970a3f4a9a969c118560152a14b8a8e141e0f328ef30d87116236b8699 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365402005&_format=json&property=%2A |
| snomed/lookup-full-365403000.json | 2026-11-10T09:18:25Z | 200 | cb82e5997dda539f2c6957d9aaacb98b79f85d8df4345bfa98e58989bfe4b313 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365403000&_format=json&property=%2A |
| snomed/lookup-full-365404006.json | 2026-11-10T09:18:26Z | 200 | 9867aa10809da42119c48f878d983e60415f7a49c86299bb8cefbd4017b9978a | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=365404006&_format=json&property=%2A |
| snomed/lookup-full-408864009.json | 2026-11-10T09:17:27Z | 200 | 1a726f044af21d8b13f6fe948ce7bf785abcff6fa16251063db63e9e9b896c03 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=408864009&_format=json&property=%2A |
| snomed/lookup-full-412726003.json | 2026-11-10T09:16:20Z | 200 | 0d6452a1d4858cda790b697db55522883baf38030af57e59f18aab5c6b95ffa2 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=412726003&_format=json&property=%2A |
| snomed/lookup-full-473170005.json | 2026-11-10T09:17:35Z | 200 | 4fdfbc6d4567941487f146d66a499e87c4aaa457b85a5b970fff7d03dc8c0223 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=473170005&_format=json&property=%2A |
| snomed/lookup-full-50373000.json | 2026-11-10T09:17:45Z | 200 | 75279acfe15b6a9484e52883fcaf74f26f5039fbbc25fd85aa55c811dd9b2095 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=50373000&_format=json&property=%2A |
| snomed/lookup-full-707085002.json | 2026-11-10T09:17:22Z | 200 | 14b16a8f517de7e50db47878899856d328027d89ce2d268bb507a43eba0c33c4 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=707085002&_format=json&property=%2A |
| snomed/lookup-full-70711000052105.json | 2026-11-10T09:18:08Z | 200 | 3a20462220ec613a6e2b52482535ebb6963a974d93ddd802c60d5685f8ac6e30 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=70711000052105&_format=json&property=%2A |
| snomed/lookup-full-70931000052102.json | 2026-11-10T09:17:50Z | 200 | 717472727b0d2cd090bcc5b0c6eb09592f20c73066968264031f41eccdfffb54 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=70931000052102&_format=json&property=%2A |
| snomed/lookup-full-70941000052108.json | 2026-11-10T09:17:57Z | 200 | 9a6bd865c5cd3078ca53e554bc2f2452ca62e9dc349defc4f6d8161a5505f211 | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=70941000052108&_format=json&property=%2A |
| snomed/lookup-full-80943009.json | 2026-11-10T09:17:06Z | 200 | 046e0af96e210926c606af051fc79f34dfeb09ce45d29f1546c4c7bb6a3ff79a | https://tx.fhir.org/r4/CodeSystem/$lookup?system=http%3A%2F%2Fsnomed.info%2Fsct&code=80943009&_format=json&property=%2A |
| turner-jp2010-pmc.html | 2026-11-10T09:14:33Z | 200 | 7571a0de292bdb2367eb5dd99a440155815e17aaeff288298e1c2cb81e561371 | https://pmc.ncbi.nlm.nih.gov/articles/PMC3687623/ |
| turner-tr2015-pmc.html | 2026-11-10T09:14:32Z | 200 | 48280af4ee091dc37f5a556715a722e84b6c8c7e82704ce51017079ac77cefbc | https://pmc.ncbi.nlm.nih.gov/articles/PMC4677552/ |
| wayback-cdc-ds-2018.html | 2026-11-10T09:13:54Z | 200 | 8e84f1f6a0f30a454ec61f002d8fdcd668992d035083a06b5d359e839aa32027 | https://web.archive.org/web/2018id_/https://www.cdc.gov/ncbddd/birthdefects/downsyndrome/growth-charts.html |
| who-copyright.html | 2026-11-10T09:07:40Z | 200 | 81fb4a2b3ce24e149aca9f82fdcc290ce4111465ae8f1539ee99b92665c62dfc | https://www.who.int/about/policies/publishing/copyright |
| who-open-access.html | 2026-11-10T09:08:34Z | 200 | 70a2b588e5d053e86d5e77a29810c27b7f58a0501397e1de8ecec38c49fcd4cf | https://www.who.int/about/policies/publishing/open-access |
| who-terms-of-use.html | 2026-11-10T09:08:33Z | 200 | 05edb9503bfd3fb46787a47ea806e6e29df7e5f3f31c8111a55eb5c08414cf44 | https://www.who.int/about/policies/terms-of-use |
| who2007-bmi-boys-z-exp.xlsx | 2026-11-10T09:07:39Z | 200 | 0a60849673f34a06b8e2fe4defe5d00348de687b6c9fce0278f1525fff89eb6d | https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-boys-z-who-2007-exp.xlsx |
| who2007-bmi-girls-z-exp.xlsx | 2026-11-10T09:07:39Z | 200 | 66f5c6284b44579ad6135fc639f22c09e36fe5a695b04390377113f6a00deb72 | https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-girls-z-who-2007-exp.xlsx |
| who2007-hfa-boys-z-exp.xlsx | 2026-11-10T09:07:39Z | 200 | d78fa8cafcab77dcb5f03d71506d92bdcb28f89c642816b6bb0eef466b007466 | https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-boys-z-who-2007-exp.xlsx |
| who2007-hfa-girls-z-exp.xlsx | 2026-11-10T09:07:39Z | 200 | df07ee16d3d2916569f1d869b7c874d7b880a41321d871215ed0254cb16679b3 | https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-girls-z-who-2007-exp.xlsx |
| who2007-sida-bmi-for-age.html | 2026-11-10T09:07:40Z | 200 | 568b6529e7114bceb6d1cb3fc3be7ad693d9e9d60b23cce3df946ff3066d9d82 | https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age |
| who2007-sida-height-for-age.html | 2026-11-10T09:07:40Z | 200 | 72419898c038b2b23bc613664b040ec4836dffe9b439927438ce2ff0dc99d4b2 | https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/height-for-age |
| who2007-sida-start.html | 2026-11-10T09:07:41Z | 200 | 1858311b6d80833aabcd08f3c0df032e806a7b00c694dad331474c495765ab80 | https://www.who.int/tools/growth-reference-data-for-5to19-years |
| who2007-sida-weight-for-age.html | 2026-11-10T09:07:40Z | 200 | 5b52dbe650019863c65783fd8b325aceb6ac5f514915eb9084522b9829c5216e | https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/weight-for-age-5to10-years |
| who2007-wfa-boys-z-exp.xlsx | 2026-11-10T09:07:39Z | 200 | a6ed0d9f3cfa209747afe49f7503b7cc24a1be6b6a8e7222e85a36b7850cb99f | https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-boys-z-who-2007-exp_0ff9c43c-8cc0-4c23-9fc6-81290675e08b.xlsx |
| who2007-wfa-girls-z-exp.xlsx | 2026-11-10T09:07:40Z | 200 | d747e068fcef4238cbaf1c201dd7788f266d9903685f4495360614eed0153562 | https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-girls-z-who-2007-exp_7ea58763-36a2-436d-bef0-7fcfbadd2820.xlsx |
| zemel2015-pmc.html | 2026-11-10T09:10:16Z | 200 | 9ca68e3b7550b871fc9c24351e499e3be559d2429642934949a4bb1b9ff50a74 | https://pmc.ncbi.nlm.nih.gov/articles/PMC5451269/ |

Filen original/snomed/lookup-248334005-full.json hämtades med curl och står inte i manifest.json, sha256 a04157b72724ef5bda21f013f8f12ab6a1b69b79d79d49d56bb369c0af93be6b.
