# Drift, processer och leverantörens åtaganden

Sussas kravspecifikation har ett sextiotal skallkrav som gäller leverantören och inte systemets funktion: drift, datahallar, servicenivåer, processer enligt ITIL, informationssäkerhet hos leverantören, support, utbildning, projekt och test. Ett öppet projekt kan inte själv åta sig att driva systemet. Dokumenten här är det som en region eller en driftleverantör behöver för att kunna uppfylla kraven: processer, mallar och kravlistor som går att ta över och fylla i, med hänvisningar till det systemet redan har som stöd.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

Systemet ger stöd där det går utan någon motpart: servicenivårapporten räknas ur systemets egna mått och incidentregistret, och incidentrapporten till beställaren tas ut som fil (vyn Servicenivåer och incidenter, för systemförvaltaren). Kravsidan i demon visar för varje krav vad som är byggt och vad som återstår.

## Dokumenten

| Dokument | Innehåll | Sussa |
| --- | --- | --- |
| [Processhandbok](processhandbok.md) | Processerna för incidenter, problem, ändringar, releaser och beställningar enligt ITIL, med roller för driftleverantören och beställaren, att ta över och komma överens om. | KD1.3.1.1, KD1.3.1.2, KD1.3.1.3, KD1.3.2.1, KD1.3.2.2, KD1.3.2.3, KD1.3.2.4, KD1.3.3.1, KD1.3.3.2, KD1.3.4.1, KD1.3.4.2, KD1.3.5.1, KD1.3.5.2, KD1.3.6.1, KD1.3.6.2, KD1.3.7.1, KD1.2.1.4, 12.1.1.2 |
| [Servicenivåer](servicenivaer.md) | Regler och anvisningar för servicenivåhantering, mall för servicenivåavtal och månadsrapport, och hur referensnivån för svarstider tas fram och följs upp. | KD1.2.1.1, KD1.2.1.2, KD1.2.1.3, KD1.2.1.5 |
| [Incidentrapportering](incidentrapportering.md) | Rutin för hur incidenter rapporteras till beställaren, med ett förslag till anvisning, vad exporten innehåller och vem som gör vad. | 5.3.1.14 |
| [Kontinuitetsplan](kontinuitetsplan.md) | Hur tillgången till informationen säkras för vården vid avbrott: läsläget, skrivkön, säkerhetskopiorna och systemets beteende när integrerade system inte svarar, med riskanalys, scenarier, roller och övningar. | 5.3.1.15, KD1.1.1.11 |
| [Återställning efter haveri](aterstallning.md) | Plan, process och verktyg för att återställa systemet efter ett haveri, med säkerhetskopiering, provåterläsning och förslag till återställningstid och högsta dataförlust. | 5.3.1.16, KD1.1.3.1, KD1.1.3.2 |
| [Säkerhetsuppdateringar och underhåll](sakerhetsuppdateringar.md) | Hur systemet och plattformen hålls säkerhetsuppdaterade, hur planerat underhåll görs med så lite avbrott som möjligt, och hur uppdateringarna förhåller sig till CE-märkningen. | 5.3.1.11, KD1.1.1.6, KD1.1.1.12 |
| [Support](support.md) | Upplägg för support dygnet runt i nivåer, ärendehantering och beställarens åtkomst, språkkrav och servicenivåerna för support, och vad systemet har som stöd. | 12.3.1.1, 12.3.1.2, 12.3.1.3, 12.3.1.4, 12.3.1.5 |
| [Samverkansmodell](samverkansmodell.md) | Samverkansmodell och samverkansorganisation på strategisk, taktisk och operativ nivå, landstingsgemensamt och per region, med forum, roller och förändringsarbetet i samarbete. | 9.1.1.1, 9.1.1.2, 9.1.1.3, 11.1.1.1, 11.1.1.2, 11.2.1.2, 11.2.1.3 |
| [Krav på datahallar och drift](datahallar.md) | Kravlista och mall för den som driver Vårdkällan: drift som helhetsåtagande, datahallar, maskinvara, programvara, datakommunikation fram till överlämningspunkten, självständighet, miljö och energi och övriga miljöer. | KD1.1.1.1, KD1.1.1.2, KD1.1.1.3, KD1.1.1.4, KD1.1.1.7, KD1.1.1.8, KD1.1.1.9, KD1.1.1.13, KD1.1.2.1, KD1.1.2.2 |
| [Fysiskt skydd för IT-utrymmen](fysiskt-skydd.md) | Kravlista och checklista för det fysiska skyddet av datahallar, IT-utrymmen och utvecklingsplatser, ordnad efter MSB:s vägledning för fysisk informationssäkerhet i IT-utrymmen. | 5.3.1.9 |
| [Skydd mot skadlig kod och intrång](skydd-mot-skadlig-kod-och-intrang.md) | Vad Vårdkällan själv gör för att förhindra, upptäcka och logga angrepp, och vad driften ska ha för skydd mot skadlig kod, intrångsskydd, intrångsdetektering, larm och åtgärd. | 5.3.1.10, 5.3.1.13 |
| [Åtkomst för drift- och supportpersonal](atkomst-for-drift-och-support.md) | Hur behörigheter för drift- och supportpersonal tilldelas, följs upp och begränsas, och hur systemets egna roller hjälper till att hålla dem borta från journalen. | 5.2.1.5 |
| [Kryptering och signering](kryptering.md) | Vilka algoritmer och nyckellängder Vårdkällan använder vid signering, inloggning och lagring, och vad driften ska ha för kryptering av trafik, lagring och säkerhetskopior och för nyckelhantering. | 5.3.1.4 |
| [Systematiskt informationssäkerhetsarbete](informationssakerhet.md) | Mall för den driftansvariges ledningssystem för informationssäkerhet i tjänsteleveransen, och en beskrivning av det säkerhetsarbete som projektet gör i utvecklingen av Vårdkällan. | 5.3.1.1, 5.3.1.17 |
| [Klienter och klientplattform](klienter.md) | Vilka klienter Vårdkällan kräver och är prövat i, hur klienten uppdateras och hur systemet förhåller sig till eKlients livscykelplaner, mobilstandard och paketeringspolicy. | KD1.1.4.1, KD1.1.4.2, KD1.1.4.4, KD1.1.4.5, KD1.1.4.6, KD1.1.4.7, KD1.1.4.8, KD1.1.4.9 |
| [Införande, utbildning och test](inforande.md) | Mall för projektplan, utbildningsplan och planer för specialområden vid införandet av Vårdkällan, och hur testerna fram till beställarens acceptanstest görs med projektets testmetod. | 11.2.1.1, 11.2.1.6, 11.2.1.9, 11.2.1.10, 11.2.1.11, 11.2.1.12, 12.2.1.1, 12.2.1.2, 12.2.1.3, 11.3.1.1 |

## Från krav till dokument

| Id | Krav | Dokument |
| --- | --- | --- |
| 5.2.1.5 | Begränsad åtkomst för leverantörens drift- och supportpersonal | [Åtkomst för drift- och supportpersonal](atkomst-for-drift-och-support.md) |
| 5.3.1.1 | Dokumenterat systematiskt informationssäkerhetsarbete | [Systematiskt informationssäkerhetsarbete](informationssakerhet.md) |
| 5.3.1.4 | Kryptering av datatrafik | [Kryptering och signering](kryptering.md) |
| 5.3.1.9 | Fysiskt skydd enligt MSB:s vägledning | [Fysiskt skydd för IT-utrymmen](fysiskt-skydd.md) |
| 5.3.1.10 | Skydd mot skadlig kod | [Skydd mot skadlig kod och intrång](skydd-mot-skadlig-kod-och-intrang.md) |
| 5.3.1.11 | Kontinuerliga säkerhetsuppdateringar | [Säkerhetsuppdateringar och underhåll](sakerhetsuppdateringar.md) |
| 5.3.1.13 | Intrångsskydd och intrångsdetektering | [Skydd mot skadlig kod och intrång](skydd-mot-skadlig-kod-och-intrang.md) |
| 5.3.1.14 | Incidentrapportering till beställaren | [Incidentrapportering](incidentrapportering.md) |
| 5.3.1.15 | Kontinuitetsplanering | [Kontinuitetsplan](kontinuitetsplan.md) |
| 5.3.1.16 | Återställning efter systemhaveri | [Återställning efter haveri](aterstallning.md) |
| 5.3.1.17 | Informationssäkerhetsarbete kopplat till tjänsteleveransen | [Systematiskt informationssäkerhetsarbete](informationssakerhet.md) |
| 9.1.1.1 | Generellt under avtalsperioden | [Samverkansmodell](samverkansmodell.md) |
| 9.1.1.2 | Samverkan landstingsgemensamt | [Samverkansmodell](samverkansmodell.md) |
| 9.1.1.3 | Samverkan enskilda myndigheter | [Samverkansmodell](samverkansmodell.md) |
| 11.1.1.1 | Förslag på förändringsarbete i samarbete | [Samverkansmodell](samverkansmodell.md) |
| 11.1.1.2 | Förändringsarbete | [Samverkansmodell](samverkansmodell.md) |
| 11.2.1.1 | Grundimplementation i projektform | [Införande, utbildning och test](inforande.md) |
| 11.2.1.2 | En ansvarig person för helheten | [Samverkansmodell](samverkansmodell.md) |
| 11.2.1.3 | Samverkansorganisation och mötesfora | [Samverkansmodell](samverkansmodell.md) |
| 11.2.1.6 | Ansvar för tester fram till acceptanstest | [Införande, utbildning och test](inforande.md) |
| 11.2.1.9 | Projektplan för grundimplementationen | [Införande, utbildning och test](inforande.md) |
| 11.2.1.10 | Plan för grundimplementation | [Införande, utbildning och test](inforande.md) |
| 11.2.1.11 | Utbildningsplan för grundimplementationen | [Införande, utbildning och test](inforande.md) |
| 11.2.1.12 | Utbildning | [Införande, utbildning och test](inforande.md) |
| 11.3.1.1 | Planer för implementation av specialområden | [Införande, utbildning och test](inforande.md) |
| 12.1.1.2 | Applikationskonfiguration | [Processhandbok](processhandbok.md) |
| 12.2.1.1 | Test | [Införande, utbildning och test](inforande.md) |
| 12.2.1.2 | Test | [Införande, utbildning och test](inforande.md) |
| 12.2.1.3 | Testmetod och process | [Införande, utbildning och test](inforande.md) |
| 12.3.1.1 | Support | [Support](support.md) |
| 12.3.1.2 | Support | [Support](support.md) |
| 12.3.1.3 | Support | [Support](support.md) |
| 12.3.1.4 | Support | [Support](support.md) |
| 12.3.1.5 | Ärendehantering | [Support](support.md) |
| KD1.1.1.1 | Krav på drift samt maskin- och programvara | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.2 | Krav på drift samt maskin- och programvara | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.3 | Krav på drift samt maskin- och programvara | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.4 | Krav på drift samt maskin- och programvara | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.6 | Krav på drift samt maskin- och programvara | [Säkerhetsuppdateringar och underhåll](sakerhetsuppdateringar.md) |
| KD1.1.1.7 | Krav på drift samt maskin- och programvara | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.8 | Krav på drift samt maskin- och programvara | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.9 | Helhetsåtagande | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.1.11 | Kärnsystemets autonomitet | [Kontinuitetsplan](kontinuitetsplan.md) |
| KD1.1.1.12 | Underhåll och tillgänglighet | [Säkerhetsuppdateringar och underhåll](sakerhetsuppdateringar.md) |
| KD1.1.1.13 | Miljövänlighet och energieffektivitet | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.2.1 | Krav på datakommunikation | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.2.2 | Datakommunikation | [Krav på datahallar och drift](datahallar.md) |
| KD1.1.3.1 | Krav på datalagring | [Återställning efter haveri](aterstallning.md) |
| KD1.1.3.2 | Krav på datalagring | [Återställning efter haveri](aterstallning.md) |
| KD1.1.4.1 | Krav på följsamhet mot klient och klientplattform | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.2 | Krav på följsamhet mot klient och klientplattform | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.4 | Klient och klientplattform | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.5 | eKlient | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.6 | Plug-ins | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.7 | Klientvirtualisering | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.8 | Tredjepartsprodukter | [Klienter och klientplattform](klienter.md) |
| KD1.1.4.9 | Klientuppgradering | [Klienter och klientplattform](klienter.md) |
| KD1.2.1.1 | Krav på tillgänglighet och servicenivå | [Servicenivåer](servicenivaer.md) |
| KD1.2.1.2 | Krav på tillgänglighet och servicenivå | [Servicenivåer](servicenivaer.md) |
| KD1.2.1.3 | Krav på tillgänglighet och servicenivå | [Servicenivåer](servicenivaer.md) |
| KD1.2.1.4 | Krav på tillgänglighet och servicenivå | [Processhandbok](processhandbok.md) |
| KD1.2.1.5 | SLA-uppföljning | [Servicenivåer](servicenivaer.md) |
| KD1.3.1.1 | Krav på processhandbok | [Processhandbok](processhandbok.md) |
| KD1.3.1.2 | Krav på processhandbok | [Processhandbok](processhandbok.md) |
| KD1.3.1.3 | Processhandbok | [Processhandbok](processhandbok.md) |
| KD1.3.2.1 | Krav på incidenthantering | [Processhandbok](processhandbok.md) |
| KD1.3.2.2 | Krav på incidenthantering | [Processhandbok](processhandbok.md) |
| KD1.3.2.3 | Krav på incidenthantering | [Processhandbok](processhandbok.md) |
| KD1.3.2.4 | Krav på incidenthantering | [Processhandbok](processhandbok.md) |
| KD1.3.3.1 | Krav på problemhantering | [Processhandbok](processhandbok.md) |
| KD1.3.3.2 | Krav på problemhantering | [Processhandbok](processhandbok.md) |
| KD1.3.4.1 | Krav på ändringshantering | [Processhandbok](processhandbok.md) |
| KD1.3.4.2 | Krav på ändringshantering | [Processhandbok](processhandbok.md) |
| KD1.3.5.1 | Krav på releasehanteringsprocess | [Processhandbok](processhandbok.md) |
| KD1.3.5.2 | Krav på releasehanteringsprocess | [Processhandbok](processhandbok.md) |
| KD1.3.6.1 | Krav på beställningshantering | [Processhandbok](processhandbok.md) |
| KD1.3.6.2 | Krav på beställningshantering | [Processhandbok](processhandbok.md) |
| KD1.3.7.1 | Krav på övriga processer | [Processhandbok](processhandbok.md) |

Dokumenten skrivs ur Vårdkällans källkod (app/src/driftdokument.js) med app/scripts/dokument-md.js, och ett test i bygget prövar att varje krav och varje fil de hänvisar till finns.
