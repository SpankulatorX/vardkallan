# Lagrum i Vårdkällan

Den här sidan samlar de lagrum som Vårdkällan hänvisar till i parametrar, hjälptexter, felmeddelanden och kravregistret,
och om de är kontrollerade mot primärkällan. Kontrollen gjordes 2026-11-11 mot Riksdagens författningstext
(SFS i lydelse enligt Riksdagens databas, data.riksdagen.se) och Socialstyrelsens konsoliderade föreskrifter. Det som
inte är kontrollerat står sist.

Vårdkällan är en demo. Lagrummen beskriver vad lagen säger. Hur en region tillämpar dem, till exempel vilka avgifter den
tar ut, är regionens beslut och märks som demoregel i systemet.

## Patientavgifter och vårdgaranti

| Lagrum | Vad det säger | Hur Vårdkällan använder det | Källa |
|---|---|---|---|
| Hälso- och sjukvårdslagen (2017:30) 17 kap. 2 § | Avgiften för sluten vård är högst 0,0023 prisbasbelopp per vårddag. | Taket för parametern Patientavgift per vårddygn räknas ur prisbasbeloppet för det år ändringen gäller: 136 kronor 2026 och 137 kronor 2027. Demons avgift är 100 kronor. | SFS 2017:30 ändrad t.o.m. 2026:1312 |
| Hälso- och sjukvårdslagen (2017:30) 17 kap. 3 § | Patienter som har fyllt 85 år betalar inte vårdavgifter eller avgifter för förbrukningsartiklar i öppen vård. Regionen får sänka gränsen men inte höja den. | Parametern Avgiftsfritt för patienter från har 85 år som högsta värde. | SFS 2017:30 |
| Hälso- och sjukvårdslagen (2017:30) 17 kap. 6 § | Högkostnadsskyddet för öppen vård är högst 0,025 prisbasbelopp, avrundat nedåt till närmaste femtiotal kronor, eller det lägre belopp regionen bestämmer. | Taket för parametern Högkostnadsskyddet räknas ur prisbasbeloppet för året: 1 450 kronor både 2026 och 2027. | SFS 2017:30 |
| Prisbasbeloppet | 58 800 kronor 2025, 59 200 kronor 2026 och 59 600 kronor 2027, enligt regeringens beslut. | Tabellen i `app/src/prisbasbelopp.js`. Ett år som saknas räknas med närmaste kända år, och texten säger det. | Regeringens beslut om prisbasbelopp |
| Avgiftsfrihet för barn och unga | Står inte i lagen. Det är regionens beslut. | Parametern Avgiftsfritt för patienter under är en demoregel, och texten säger att det är regionens beslut. | |
| Hälso- och sjukvårdsförordningen (2017:80) 6 kap. 1 § | Kontakt med primärvården samma dag, medicinsk bedömning i primärvården inom tre dagar, besök i den specialiserade vården inom 90 dagar från att remissen utfärdades (eller från att patienten sökte kontakt när remiss inte behövs), och planerad vård inom 90 dagar från beslutet. | Väntelistan räknar vårdgarantin från remissens utfärdande, inte från mottagandet, och bara i den specialiserade vården. En egen vårdbegäran till en vårdcentral ska vara bedömd inom tre dagar. En anmälan till operation visar behandlingsgarantin 90 dagar från anmälan. | SFS 2017:80 |
| Hälso- och sjukvårdsförordningen (2017:80) 6 kap. 2 § | Tiden räknas inte när patienten av medicinska skäl inte kan ges vård, har valt vård i en annan region eller frivilligt avstår. | Patientvald väntan på väntelistan räknar inte vårdgarantin. Att tiden står still och fortsätter efteråt är inte byggt, och inte heller vård i en annan region. | SFS 2017:80 |

Det som saknas för vårdgarantin: kontakten med primärvården samma dag har inget flöde, eftersom Vårdkällan inte har
telefoni eller ett kontaktärende för primärvården. Behandlingsgarantin visas för operationer men inte för annan planerad
vård, till exempel en behandling som beslutas på en mottagning.

## Journal, behörighet och logg

| Lagrum | Vad det säger | Rättat 2026-11-11 | Källa |
|---|---|---|---|
| Patientdatalagen (2008:355) 3 kap. 1 och 10 §§ | Journal för varje patient, och uppgifterna signeras. | Kravregistret sade 3 kap. 1 till 6 §§ om vem och när. | SFS 2008:355 |
| Patientdatalagen 3 kap. 14 och 17 §§ | En uppgift får inte utplånas annat än enligt lag (14 §). Journalen bevaras minst tio år efter den senaste uppgiften (17 §). | Kravregistret sade 16 och 17 §§; 16 § handlar om intyg. Texten om mätvärden säger nu att tiden räknas från den senaste uppgiften i handlingen. | SFS 2008:355 |
| Patientdatalagen 4 kap. 1 till 3 §§ | Inre sekretess och behörighet. | Stämmer. | SFS 2008:355 |
| Patientdatalagen 4 kap. 4 och 5 §§ | Spärr (4 §) och hävning av spärr (5 §). En vårdnadshavare får inte spärra. | Texterna om vårdnadshavare hänvisade bara till 4 §. Lagen tillåter också hävning utan samtycke när samtycke inte kan inhämtas och uppgiften behövs för vård som patienten oundgängligen behöver. Vårdkällan häver bara med samtycke, och det är ett val i Vårdkällan, inte lagens innehåll. | SFS 2008:355 |
| Patientdatalagen 5 kap. 5 § | Direktåtkomst för den enskilde till sina egna uppgifter. | Stämmer. | SFS 2008:355 |
| Patientdatalagen 7 kap. 2 och 3 §§, 8 kap. 4 och 5 §§ | Kvalitetsregister, förstöring efter beslut av IVO, och rätten att få veta vem som har tagit del av uppgifterna. | Stämmer. | SFS 2008:355 |
| Lag (2022:913) om sammanhållen vård- och omsorgsdokumentation 3 kap. 1, 3, 5 och 6 §§ | Direktåtkomst till andra vårdgivares uppgifter med patientrelation och samtycke, när patienten inte kan samtycka, och vid fara för liv eller hälsa. | Koden hänvisade till patientdatalagen 6 kap., som är upphävt, och lagmatrisen till 4 kap. i 2022:913. | SFS 2022:913 |
| HSLF-FS 2016:40 3 kap. 15 § | Flerfaktorsautentisering vid elektronisk överföring och direktåtkomst. | Stämmer. | HSLF-FS 2016:40 ändrad t.o.m. 2025:57 |
| HSLF-FS 2016:40 4 kap. 2, 2 a och 3 §§ | Behovs- och riskanalys, och att den dokumenteras (2 a §). | 2 a § är tillagd i lagmatrisen. | HSLF-FS 2016:40 |
| HSLF-FS 2016:40 4 kap. 4 och 5 §§ | Spärr och aktivt val inom vårdgivaren. | Kravregistret sade 4 till 8 §§. 6 § har upphört, och 7 och 8 §§ gäller sammanhållen dokumentation. | HSLF-FS 2016:40 |
| HSLF-FS 2016:40 4 kap. 9 och 9 b §§ | Varje åtkomst loggas (9 §), loggarna kontrolleras systematiskt och sparas minst fem år (9 b §). | Sidan Regler och parametrar sade att 9 § förbjuder att loggarna ändras. Att de inte går att ändra är Vårdkällans eget skydd. | HSLF-FS 2016:40 |
| HSLF-FS 2016:40 4 kap. 10 till 12 §§ | Patientens rätt till logguppgifter och Min journal. | Stämmer. | HSLF-FS 2016:40 |
| Offentlighets- och sekretesslagen (2009:400) 10 kap. 14, 23 och 28 §§, 12 kap. 1 §, 21 kap. 3 §, 25 kap. 1 och 6 §§ | Sekretessbrytande bestämmelser och sekretess i hälso- och sjukvården. | 10 kap. 23 § kräver nu ett brott med lägst sex månaders fängelse i straffskalan (lag 2025:179). Texten i menprövningen sade ett år. | SFS 2009:400 |
| Patientlagen (2014:821) 3 kap. | Information till patienten. | Lagmatrisen hänvisade också till 8 kap., som handlar om ny medicinsk bedömning. Rätten att ta del av journalen står i OSL 12 kap. 1 § och patientdatalagen 8 kap. 1 §. | SFS 2014:821 |
| Lag (2018:1937) om tillgänglighet till digital offentlig service 10 till 13 §§ | Tillgänglighetskraven (10 till 12 §§) och tillgänglighetsredogörelsen (13 §). | Lagmatrisen sade 9 till 12 §§. | SFS 2018:1937 |

## Läkemedel och ledning

| Lagrum | Vad det säger | Rättat 2026-11-11 | Källa |
|---|---|---|---|
| HSLF-FS 2017:37 6 kap. 6 och 17 §§ | Bara läkare får utfärda generella direktiv. Vilka läkare framgår av vårdgivarens rutiner. | Texterna sade att föreskriften ger verksamhetschefen eller den medicinskt ansvariga läkaren rätten. Det kommer från Gröna häftet. Se Ej rättat i koden nedan. | HSLF-FS 2017:37 ändrad t.o.m. 2025:61 |
| HSLF-FS 2017:37 4 kap. 2 §, 6 kap. 7 och 13 till 15 §§, 8 kap. 3 §, 9 kap. 2 till 9 §§, 11 kap. | Ordination, delegering och iordningställande. | Stämmer. | HSLF-FS 2017:37 |
| Hälso- och sjukvårdslagen 4 kap. 2 § och hälso- och sjukvårdsförordningen 4 kap. 5 § | Det ska finnas en verksamhetschef (HSL). Verksamhetschefen får uppdra åt andra att fullgöra ledningsuppgifter (HSF). | Texten om ledningsansvaret hänvisade bara till HSL 4 kap. 2 §. | SFS 2017:30, 2017:80 |

## Tvångsvård och övrigt

| Lagrum | Vad det säger | Utslag | Källa |
|---|---|---|---|
| LPT (1991:1128) 2 a till 39 §§ som citeras | Intagning, vårdintyg, tvångsåtgärder och tider. | Stämmer, utom 6 a § nedan. | SFS 1991:1128 |
| LRV (1991:1129) 4, 12, 12 a, 13 till 16 a §§ | Rättspsykiatrisk vård. | Stämmer. | SFS 1991:1129 |
| Lag (2017:612) om samverkan vid utskrivning | Tider för underrättelser och planering. | Stämmer. | SFS 2017:612 |
| HSLF-FS 2023:33 och 2024:5 | Uppgiftsskyldighet till patientregistret och det medicinska födelseregistret. | Stämmer. | Socialstyrelsen |
| Lag (1998:543) om hälsodataregister 6 §, patientsäkerhetslagen 3 kap. 1 och 2 §§, arkivlagen 3 till 6 och 10 §§ | | Stämmer. | |

## Ej rättat i koden

Det här är fel som styr en regel i koden och inte bara en text. De är inte ändrade, eftersom ändringen påverkar hur
systemet beter sig och behöver ett beslut.

- **LPT 6 a §** (`app/src/tvangsvard.js`). Koden säger att lagen före intagningen bara medger kortvarig fastspänning eller
  avskiljande, och nekar annat. 6 a § andra stycket tillåter också nödvändig behandling vid överhängande fara för liv
  eller hälsa, och 6 § andra stycket kroppsvisitation och ytlig kroppsbesiktning av den som hålls kvar.
- **HSLF-FS 2016:40 4 kap. 7 §** (`app/src/sammanhallen.js`). Vid sammanhållen journalföring ska det framgå att det finns
  spärrade uppgifter hos en annan vårdgivare, och lagen (2022:913) 3 kap. 5 § ger vid fara rätt att se vilka vårdgivare
  som har spärrat. Vårdkällan visar i dag inget om dem.
- **HSLF-FS 2017:37 6 kap. 6 §** (`app/src/lakemedelsansvar.js`, `app/src/ordinationsvagar.js`). Verksamhetschefen kan
  fastställa ett generellt direktiv i demon också när verksamhetschefen inte är läkare.

## Ej kontrollerat

- Dataskyddsförordningen artiklarna 5.1 f, 15, 20, 25, 30, 32 och 35.
- Lagen (2018:1212) om nationell läkemedelslista 3 kap. Bedömningen för läkemedel från en spärrad enhet i
  interaktionskontrollen står i docs/design.md.
- Cybersäkerhetslagen (2025:1506) 3 och 4 kap.
- MDR (EU) 2017/745 artiklarna 2, 5 och 10.
- HSLF-FS 2016:40 5 kap. och 6 kap., utom 6 kap. 6 §.
- Socialstyrelsens föreskrifter om psykiatrisk tvångsvård.
- Var det står att regeringen fastställer prisbasbeloppet. Socialförsäkringsbalken 2 kap. 6 och 7 §§ beskriver hur det
  räknas.
