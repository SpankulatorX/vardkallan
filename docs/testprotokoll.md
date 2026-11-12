# Testprotokoll

Testprotokoll med spårbarhet till krav, Sussa 11.2.1.7. Version 1.3.1, kod c13448a4414d, inga servertester körda.

Inget acceptanstest med en beställare är gjort. Protokollet visar resultatet av Vårdkällans egna automatiska tester i det senaste bygget och är underlaget inför ett acceptanstest, inte resultatet av ett.

Protokollet skrivs av `app/scripts/testprotokoll-md.js` ur kravregistret (`app/src/krav.js`), Sussa-registret (`app/src/sussa/`) och resultaten från bygget, med `app/src/testprotokoll.js`. Samma protokoll visas på sidan Testprotokoll i demon (`#/testprotokoll`), räknat ur bygget som körs där. Kodhashen är sha256 över `app/src/` och `app/public/` och visar vilken byggd kod resultaten gäller.

## Sammanfattning

Krav och poster med testfall: 306, varav 0 med alla testfall godkända. Testfall: 3259, varav 0 godkänt, 0 ej godkänt, 0 hoppades över, 2628 inte kört, 631 inaktuellt, gränssnittet har ändrats sedan testet kördes. Krav utan testfall: 10 i det egna ramverket och 116 i Sussas kravspecifikation.

## Körningar

| Körning | Tid | Testfall | Godkända | Ej godkända |
| --- | --- | --- | --- | --- |
| Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC | 84 | 84 | 0 |
| Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC | 117 | 117 | 0 |
| Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC | 56 | 56 | 0 |
| Lasttest | 2026-11-12 kl. 15:06 UTC | 3 | 3 | 0 |
| Validering med HL7:s validator | 2026-11-12 kl. 11:25 UTC | 1 | 1 | 0 |

## Eget ramverk

### K1 Kravregister med id, källa, status och koppling till tester

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > alla krav K1 till K5, D1 till D12, L1 till L13 och M1 till M13 finns | Inte kört | inte kört | inte kört |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |
| API > krav visar kravregistret | Inte kört | inte kört | inte kört |
| Sussa-registret > alla 389 id finns exakt en gång, och varje post har en mappning | Inte kört | inte kört | inte kört |
| Sussa-registret > uppfyllt_demo kräver gröna tester | Inte kört | inte kört | inte kört |
| Sussa-registret > källan anges och alla kapitel ingår | Inte kört | inte kört | inte kört |
| Sussa-registret > API: krav/sussa ger registret utan inloggning, med egna krav och testernas status | Inte kört | inte kört | inte kört |
| Version 1.0 > villkoren räknas ur registret, testfallen och säkerhetsfynden, och 1.0 nås bara när alla fyra är uppfyllda | Inte kört | inte kört | inte kört |
| Version 1.0 > API: krav/version ger versionen ur package.json och de fyra villkoren utan inloggning, och listan med säkerhetsfynd är tom | Inte kört | inte kört | inte kört |

### K2 Svarsmappning från kriterier till leverantörens FVIS-krav

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussa-avtalet > varje post har Cambios svar med källa, och maskerade svar är märkta som maskerade | Inte kört | inte kört | inte kört |
| Sussa-avtalet > viktningen stämmer med utvärderingsmodellen och Cambios prispåslag | Inte kört | inte kört | inte kört |
| Sussa-avtalet > registret visar vikt, rang och betyg per kriterium så att det går att sortera på vad Sussa värderade högst | Inte kört | inte kört | inte kört |
| Sussa-avtalet > API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Visa de tio högst viktade kriterierna som inte är uppfyllda inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### K3 Prioritetssignal för krav som exkluderades eller sköts upp

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussa-avtalet > poster som exkluderades ur avtalet eller sköts upp 2022 har en signal med skäl och källa | Inte kört | inte kört | inte kört |
| Sussa-avtalet > API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven | Inte kört | inte kört | inte kört |
| Sussa-avtalet > datafilerna har inga tankstreck, ellipser eller personnamn ur handlingarna | Inte kört | inte kört | inte kört |

### K4 Varje krav bryts ned till automatiserade testfall och ett användarscenario

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > saknade eller röda tester ger delvis | Inte kört | inte kört | inte kört |
| Kravregistret > planerade krav förblir planerade | Inte kört | inte kört | inte kört |
| Sussas testfall > registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass | Inte kört | inte kört | inte kört |
| Sussas testfall > tidspoängen följer tabellen i Bilaga F1:2 för de fyra tidsklasserna | Inte kört | inte kört | inte kört |
| Sussas testfall > måluppfyllelsen ger 10, 5, 2 eller 0 efter slutvillkoret och klickbudgeten | Inte kört | inte kört | inte kört |
| Sussas testfall > omvandlingen till utvärderingspoäng följer Bilaga F1:2 avsnitt 5 | Inte kört | inte kört | inte kört |
| Sussas testfall > tidsuppskattningen följer keystroke-level model med den uppmätta svarstiden | Inte kört | inte kört | inte kört |
| Sussas testfall > sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget | Inte kört | inte kört | inte kört |
| Sussas testfall > demoläget lägger in testpatienterna med Skatteverkets testpersonnummer och datan som testfallen behöver | Inte kört | inte kört | inte kört |
| Sussas testfall > tema 1 genomförs med Sussas läkemedel i en katalog med minst 100 produkter | Inte kört | inte kört | inte kört |
| Gränssnitt > Sussas testfall > 1.1 Förskriva läkemedel (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.2 Ordinera läkemedel (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.3 Ordinera läkemedel på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.4 Administrera läkemedel (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.4 Signera (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.4 Omboka besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.5 Ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.6 Överblicka ankomstregistrering (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.7 Oplanerad ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.8 Väntelista (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### K5 Bör-krav och målbild som separat backlogg

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussa-avtalet > bör-krav och målbild är en egen lista kopplad till posterna, med status från posterna | Inte kört | inte kört | inte kört |
| Sussa-avtalet > API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven | Inte kört | inte kört | inte kört |

### D1 Kvitterade meddelanden med larm, och när NLL inte svarar i tid döljs aldrig en lyckad förskrivning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat | Inte kört | inte kört | inte kört |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Inte kört | inte kört | inte kört |
| Remiss > larm: svar saknas efter sista svarsdatum | Inte kört | inte kört | inte kört |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Inte kört | inte kört | inte kört |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Inte kört | inte kört | inte kört |

### D2 Kronologisk helhetsbild där migrerad historik syns likvärdigt med ny

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Inte kört | inte kört | inte kört |

### D3 Verifierad migrering med avstämningsrapport

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > migreringsavstämningen visar avvikelsen | Inte kört | inte kört | inte kört |

### D4 Läsåtkomst vid avbrott och inloggning som inte faller med en extern tjänst

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läskopia > nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning | Inte kört | inte kört | inte kört |
| Läskopia > innehåller bara det servern redan lämnar ut till den inloggade | Inte kört | inte kört | inte kört |
| Läskopia > spärrade uppgifter och skyddad identitet följer samma regler i läskopian | Inte kört | inte kört | inte kört |
| Läskopia > yrkesrollen styr vad läskopian innehåller | Inte kört | inte kört | inte kört |
| Läskopia > utan inloggning lämnas ingen läskopia ut | Inte kört | inte kört | inte kört |
| Läskopia > att uppgifterna lämnas ut till läskopian loggas en gång per patient och grund | Inte kört | inte kört | inte kört |
| Läskopia > åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka | Inte kört | inte kört | inte kört |
| Läskopia > åtkomster utanför läskopian, med fel handling eller fel tid avvisas | Inte kört | inte kört | inte kört |
| Läskopia > en rad som skickas två gånger loggas en gång | Inte kört | inte kört | inte kört |
| Läskopia > läskopians nyckel och kopplingar överlever omstart av servern | Inte kört | inte kört | inte kört |
| Läskopia > service workern cachar alla statiska filer | Inte kört | inte kört | inte kört |
| Läskopia > krypterade åtkomster från läsläget tas emot utan inloggning och loggas på personen som hade läskopian | Inte kört | inte kört | inte kört |
| Läskopia > krypterade rader som inte går att verifiera eller gäller fel person eller kopia avvisas | Inte kört | inte kört | inte kört |
| Läskopia > läskopian tar emot loggen från före utloggningen men inga senare läsningar, och nyckeln lämnas inte ut igen | Inte kört | inte kört | inte kört |
| Läskopia > en läsning efter utloggningen tas inte emot | Inte kört | inte kört | inte kört |
| Läskopia > tiderna rättas när webbläsarens klocka går fel | Inte kört | inte kört | inte kört |
| Läskopia > en krypterad rad loggas en gång, också efter omstart av servern, och inte efter att läskopian gått ut | Inte kört | inte kört | inte kört |
| Läskopia > en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något | Inte kört | inte kört | inte kört |
| Läskopia > varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient | Inte kört | inte kört | inte kört |
| Läskopia > förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar | Inte kört | inte kört | inte kört |
| Gränssnitt > Avbrott > läskopian förnyas av sig själv medan personen är inloggad | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > appen startar utan nät från service workern och visar läsläget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > läskopian i webbläsaren är krypterad och nyckeln ligger inte i IndexedDB | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > skrivande är avstängt i läsläget med en förklaring | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > simulerat avbrott ger läsläge medan servern svarar andra besökare | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > åtkomster i läsläget når åtkomstloggen när servern svarar igen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > läskopian rensas vid utloggning | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > läskopian används inte efter 8 timmar | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > reservkoden väljs när webbläsaren är uppkopplad och bara den inslagna nyckeln sparas | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > efter omstart av webbläsaren utan nät visas vilka som har en reservkopia på datorn och när den går ut | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > fel reservkod ger väntetid och rätt reservkod öppnar läsläget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > åtkomster med reservkod loggas krypterat och överlever att fliken stängs | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > när servern svarar igen mitt i läsläget med reservkod når åtkomsterna åtkomstloggen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > utloggning raderar reservkopian, den inslagna nyckeln och loggen efter att loggen förts över | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > utloggning i en flik avslutar läsläget i webbläsarens andra flikar | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > en navigering direkt till en fil ersätter inte appen i service workerns cache | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > fem fel reservkoder raderar reservkopian och flikar kan inte pröva samtidigt | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > två personer på samma dator har var sin reservkopia som bara öppnas med egen kod | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > simulerat avbrott visar reservinloggningen när fliken stängs i demon | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Min journal > patientvyn får ingen läskopia | Inte kört | inte kört | inte kört |

### D5 Svarstidsmål per vanlig åtgärd, mätta i drift och publicerade

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > hälsa och Server-Timing på alla svar | Inte kört | inte kört | inte kört |
| API > drift visar p50 och p95 per adress i API:t | Inte kört | inte kört | inte kört |

### D6 Klickbudget per vanligt arbetsflöde, mätt med verkliga användare

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Öppna patient från arbetslistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Läsa senaste anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva och signera en daganteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ordinera ett läkemedel utan varning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Bekräfta föreslagen uppmärksamhetsinformation inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera blodtryck inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skicka remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Kvittera remissvar inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Nödåtkomst inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera patient utan känd identitet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Slå samman en dubblett inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Bekräfta ett hälsoärende inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva in en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Flytta en patient till en annan avdelning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva ut en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera ett besök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Planera ett videobesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ge en dos inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Vidimera pågående ordinationer inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel med varning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Sätta ut Waran med plan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva ut läkemedelslistan vid utskrivning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Begära kontrasignering av en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Kontrasignera en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ge en dos med delegering inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en delegering inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Checka in en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skicka en gruppkallelse inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka om en tid inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Patienten bokar om sin tid i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Sätta upp ett återbesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Sätta in Waran igen efter ett uppehåll inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Avsluta behandlingen efter ett uppehåll inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Avvisa en remiss och sätta ut läkemedlet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera ett intagningsbeslut inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Söka i journalen och öppna träffen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en NEWS2-kontroll inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ordinera från en mall med flera ordinationer inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en dos i efterhand inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Utse en medicinskt ansvarig läkare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna en ändrad läkemedelsmall inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka elkonvertering med rum och utrustning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka provtagning före läkarbesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Granska och skicka månadens rapport till patientregistret inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Visa de tio högst viktade kriterierna som inte är uppfyllda inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Exportera faktureringsunderlag för en månad inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lämna ut ett hjälpmedel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Förbereda ett namnbyte för en enhet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ändra dosen i en pågående ordination inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Läsa nyheterna och stänga dem inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka en patient fritt inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka ett teambesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lägga till en patient i en gruppträff inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Överblicka dagens händelser på avdelningen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Fortsätta arbeta när inloggningen snart går ut inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Fylla i tobaksmallen i en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva och signera en epikris inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera längd, vikt, blodtryck och puls inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva en remiss på uppdrag av en läkare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Fördela en remiss till en läkare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en pappersremiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Beställa ett standardpaket med prover inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera provtagning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Koppla en patientmonitor till patienten inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna värden från monitorn inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Öppna intensivvårdens översikt och övervakningen av en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lämna en egen mätning i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Förskriva förbrukningsartiklar ur en mall inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Öppna patienten genom att skanna armbandet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Visa en färdig patientgrupp inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva ut en enskild anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en överkänslighet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Söka bland vårdenhetens patienter på en diagnos inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skicka en konsultation inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skicka läkemedelsberättelsen till nästa vårdgivare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Ge en vaccination i programmet för riskgrupper inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Hämta uppgifter från en annan vårdgivare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en ankomst på akutmottagningen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Diktera och signera en daganteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Rätta en felstavad medicinsk term i en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Bygga ett formulär och föreslå det inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en perifer venkateter inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skanna in en restjournal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Pröva donation efter ett dödsfall på intensivvården inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Förnya ett recept som patienten har bett om i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lägga in sin tidbok i kalenderprogrammet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Svara på ett meddelande från en patient och avsluta inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Se vårdenhetens kapacitet och prognos för väntelistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Göra dagsavslut i kassan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva ett meddelande till vården i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Planera en operation från väntelistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera att patienten kommer in på salen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka en tid för patienten som ombud inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera ett besök i graviditetsjournalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Bedöma CTG under en förlossning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Jämföra bilder av ett kroppsställe över tid inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Hämta en bild från en apparat och föra in den i journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Visa en röntgenstudie ur arkivet med ett annat fönster inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Beställa en röntgenundersökning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka en inkommen undersökning på röntgenkliniken inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera vårdtyngden enligt NEMS för en patient på intensivvården inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Läsa in ett barns tillväxtdata från ett annat journalsystem inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna en cytostatikakur inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna en ny version av en cytostatikaregim inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Beställa blod inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Bereda en cytostatikados på beredningsenheten inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Rapportera dagens tabletter i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lämna en synpunkt inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Välja yrkesroll och starta första uppdraget inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Användartest > räkningen: klick på knappar och länkar, inte i fält som gränssnittet har satt fokus i | Inte kört | inte kört | inte kört |
| Användartest > SUS-poängen räknas med standardformeln | Inte kört | inte kört | inte kört |
| Användartest > uppgifterna följer flödena i klickbudgeten | Inte kört | inte kört | inte kört |
| Användartest > sammanställningen ger median, spridning, andel slutförda och SUS per flöde | Inte kört | inte kört | inte kört |
| Gränssnitt > Användartest > testläget räknar klick, fältbyten och tangenter som klickbudgetskriptet för samma flöden | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Användartest > enkäten ger SUS-poäng enligt standardformeln | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Användartest > resultatfilen laddas ner med datum, version, deltagarkod, uppgifter och SUS-poäng | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Användartest > inget anrop skickar testresultat till servern | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Användartest > testläget rensas när testet avslutas | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### D7 Små releaser med automatiserad regressionstest och återgång

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |
| Releaser > varje migrering har en återställning, och upp och sedan ned ger samma schema som före | Inte kört | inte kört | inte kört |
| Releaser > schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen | Inte kört | inte kört | inte kört |
| Releaser > en sparad sandlåda som läses in får sitt schema kontrollerat, och versionen i drift gäller efter en återgång | Inte kört | inte kört | inte kört |
| Releaser > uppgraderingen visar nyheterna, API:ts ändringslogg och migreringarna för versionen | Inte kört | inte kört | inte kört |
| Releaser > en uppgradering vars tester inte är gröna stoppas och kan inte godkännas | Inte kört | inte kört | inte kört |
| Releaser > återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den | Inte kört | inte kört | inte kört |
| Releaser > bara systemförvaltningen ser och gör uppgraderingar | Inte kört | inte kört | inte kört |
| Releaser > API: återgång och godkännande av två systemförvaltare i var sin inloggning, och servern visar schemaversionen | Inte kört | inte kört | inte kört |

### D8 Behörighetsmodell som tvingar minsta åtkomst, testad mot roller

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: logggranskare får läsa loggen men inte journalen | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nekad: utan grund nekas åtkomst utan erbjudande om val | Inte kört | inte kört | inte kört |
| API > nekad åtkomst ger 403 kraver_val och loggas som nekad | Inte kört | inte kört | inte kört |
| Vårdkontakt > inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får | Inte kört | inte kört | inte kört |
| Vårdkontakt > vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se | Inte kört | inte kört | inte kört |

### D9 Öppna format: FHIR R4, ICD-10-SE och ATC

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > metadata är ett CapabilityStatement | Inte kört | inte kört | inte kört |
| FHIR > sökning ger Bundle searchset | Inte kört | inte kört | inte kört |
| FHIR > Patient har personnummer med rätt identifier-system | Inte kört | inte kört | inte kört |
| FHIR > Condition använder ICD-10-SE | Inte kört | inte kört | inte kört |
| FHIR > MedicationRequest använder ATC och har uppföljningsdatum | Inte kört | inte kört | inte kört |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Inte kört | inte kört | inte kört |
| Kodverk > varje läkemedel i katalogen har en ATC-kod ur WHO:s register | Inte kört | inte kört | inte kört |
| Kodverk > varningsreglernas ATC-prefix stämmer med WHO:s register | Inte kört | inte kört | inte kört |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Inte kört | inte kört | inte kört |
| FHIR-struktur > inga tomma listor, tomma strängar eller tomma värden, och varje kodning har system och kod | Inte kört | inte kört | inte kört |
| FHIR-struktur > vitalparametrar följer FHIR R4:s vitalparameterprofiler | Inte kört | inte kört | inte kört |
| FHIR-struktur > labbvärden har NPU-kod och UCUM-enhet | Inte kört | inte kört | inte kört |
| FHIR-struktur > meta.profile bara för profiler som validerats | Inte kört | inte kört | inte kört |
| FHIR-struktur > Patient, Organization och Practitioner följer HL7 Swedens basprofiler | Inte kört | inte kört | inte kört |
| FHIR-struktur > varje tillägg och eget kodsystem har en publicerad definition | Inte kört | inte kört | inte kört |
| FHIR-struktur > Condition och MedicationRequest har display ur kodverket | Inte kört | inte kört | inte kört |
| FHIR-struktur > MedicationRequest har NPL-id med E-hälsomyndighetens system | Inte kört | inte kört | inte kört |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Inte kört | inte kört | inte kört |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Inte kört | inte kört | inte kört |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Inte kört | inte kört | inte kört |
| Min journal > FHIR för invånaren: id i fel journal ger alltid 404, och identifier eller fritext i adressen loggas aldrig | Inte kört | inte kört | inte kört |
| Administrering via API > FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen | Inte kört | inte kört | inte kört |
| Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning | Inte kört | inte kört | inte kört |
| Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie | Inte kört | inte kört | inte kört |
| Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet | Inte kört | inte kört | inte kört |
| FHIR-validering > HL7:s validator ger inga fel för någon resurstyp, också MedicationAdministration och List, i den FHIR-kod som byggs | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Validering med HL7:s validator | 2026-11-12 kl. 11:25 UTC |

### D10 Beslutsstöd i separata moduler, journalkärnan utanför MDR

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varningarna är märkta som demoregler | Inte kört | inte kört | inte kört |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Inte kört | inte kört | inte kört |
| Skalor > NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4 | Inte kört | inte kört | inte kört |
| MDR-bedömning > varje beslutsstödsmodul har en bedömning enligt MDCG 2019-11 med alla steg, och slutsatsen och klassen följer av stegen | Inte kört | inte kört | inte kört |
| MDR-bedömning > modulerna som varningsreglerna och skalorna ligger i är bedömda | Inte kört | inte kört | inte kört |

### D11 Styrd lokal anpassning av mallar inom fastställda ramar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Godkännande av läkemedelsmallar > mallansvarig läkare godkänner en ändrad mall från inkorgen: den gamla används tills den nya är godkänd, och historiken sparas | Inte kört | inte kört | inte kört |
| Godkännande av läkemedelsmallar > säkerhet: bara den mallansvariga läkaren på vårdenheten godkänner, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Godkännande av läkemedelsmallar > en ändrad läkemedelsmall per substans kräver nytt godkännande per vårdenhet, och förslaget använder den godkända versionen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Godkänna en ändrad läkemedelsmall inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Ansvarsuppdrag för läkemedel > verksamhetschefen ser vårdenhetens uppdrag, och systemet påminner om det som saknas och föreslår vem som ska få uppdraget | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > verksamhetschefen utser en medicinskt ansvarig läkare med ett år förifyllt, och det loggas och syns i säkerhetsloggen | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > säkerhet: bara vårdenhetens verksamhetschef utser och avslutar uppdrag, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > verksamhetschefens eget ansvar går inte att lämna över, och systemet förklarar varför en person inte kan få uppdraget | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > samma sjuksköterska beställer inte och kontrollerar narkotika, och reserven är en annan än den ordinarie | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > ett nytt uppdrag som medicinskt ansvarig läkare avslutar det förra, och ett uppdrag ändras och raderas aldrig | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > påminnelsen kommer när ett uppdrag går ut inom 30 dagar, uppdraget upphör när personen slutar och genomgången av ansvarsdokumentet sparas | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > säkerhet: verksamhetschefen läser inte journalen och har ingen arbetslista | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Utse en medicinskt ansvarig läkare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Journalens struktur > ram: vårdgivarens ram anger sökord som måste finnas och sökord som får läggas till lokalt | Inte kört | inte kört | inte kört |
| Journalens struktur > lokal: en vårdenhets anpassning inom ramen gäller bara på vårdenheten, och en anpassning utanför ramen stoppas | Inte kört | inte kört | inte kört |
| Journalens struktur > ram: en ny ram visar vilka lokala anpassningar som slutar gälla, och de slutar gälla när den godkänns | Inte kört | inte kört | inte kört |
| Läkemedelsmallar i gränssnittet > en läkare bygger en ny läkemedelsmall med systemets förslag, och den används först när den mallansvariga läkaren har godkänt den | Inte kört | inte kört | inte kört |
| Läkemedelsmallar i gränssnittet > API: en läkare ändrar en läkemedelsmall i gränssnittet och ser vem som ska godkänna den | Inte kört | inte kört | inte kört |
| Journalens struktur > mall: en ny mall med ett nytt sökord godkänns av en annan systemförvaltare och används direkt i journalen | Inte kört | inte kört | inte kört |
| Journalens struktur > mall: en ny version visar vad som påverkas, och skrivna anteckningar ändras inte | Inte kört | inte kört | inte kört |
| Journalens struktur > fyra ögon: en beslutad version ändras eller raderas inte, ett godkännande prövas igen och allt loggas | Inte kört | inte kört | inte kört |

### L1 En journal per patient, signatur och tidpunkt, ingen ändring eller utplåning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte raderas (trigger) | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning flyttas till en annan patient bara under en sammanslagning av just de journalerna (trigger) | Inte kört | inte kört | inte kört |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Inte kört | inte kört | inte kört |
| API > helflöde: anteckning skapas, signeras och rättas | Inte kört | inte kört | inte kört |
| Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan | Inte kört | inte kört | inte kört |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Inte kört | inte kört | inte kört |
| Kontrasignering > den som har signerat kan inte kontrasignera själv | Inte kört | inte kört | inte kört |

### L2 Behörighet efter behovs- och riskanalys, minsta nödvändiga åtkomst

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel | Inte kört | inte kört | inte kört |
| Behörighetsanalys > varje roll i behörighetsmotorn har en behovs- och riskanalys, och analysen säger samma sak som koden | Inte kört | inte kört | inte kört |

### L3 Spärr, aktivt val, synlig spärrmarkering och nödåtkomst

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: spärrmarkering syns men innehållet döljs | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: samtycke i stunden visar spärrade uppgifter | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nödåtkomst: häver aldrig en spärr | Inte kört | inte kört | inte kört |
| API > spärrmarkering och samtycke via API | Inte kört | inte kört | inte kört |
| API > nödåtkomst via API flaggas i logguppföljningen | Inte kört | inte kört | inte kört |
| Min journal > spärrade uppgifter visas för patienten själv och spärren redovisas | Inte kört | inte kört | inte kört |
| Min journal > begäran om spärr ändrar inte spärren och registreras som begäran till vården | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > en bekräftad uppgift ur spärrade uppgifter följer källans spärr, och utsättningen röjs inte i förslagen | Inte kört | inte kört | inte kört |
| Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras | Inte kört | inte kört | inte kört |
| Vårdkontakt > en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades | Inte kört | inte kört | inte kört |
| Vårdkontakt > hälsoärendet visar bara de vårdkontakter som användaren får se | Inte kört | inte kört | inte kört |
| Vårdkontakt > FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se | Inte kört | inte kört | inte kört |

### L4 Loggning av varje åtkomst, logguppföljning och logginformation till patienten

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Inte kört | inte kört | inte kört |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Åtkomstloggen > verifiera upptäcker ändrad rad när triggern släppts i en kopia | Inte kört | inte kört | inte kört |
| API > logggranskaren ser logg med hel kedja, andra roller nekas | Inte kört | inte kört | inte kört |
| FHIR > FHIR-anrop loggas | Inte kört | inte kört | inte kört |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Inte kört | inte kört | inte kört |
| Min journal > nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista | Inte kört | inte kört | inte kört |
| Min journal > patientens egen läsning loggas som egen åtkomst och flaggas inte i logguppföljningen | Inte kört | inte kört | inte kört |
| Min journal > nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan | Inte kört | inte kört | inte kört |
| Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra | Inte kört | inte kört | inte kört |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Inte kört | inte kört | inte kört |
| Datauttag > bara uppföljningsrollen når datauttaget, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Export av loggen > åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Inte kört | inte kört | inte kört |
| Stickprovskontroll > systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår | Inte kört | inte kört | inte kört |
| Stickprovskontroll > en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas | Inte kört | inte kört | inte kört |

### L5 Flerfaktorsautentisering vid direktåtkomst och patientens e-åtkomst

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter | Inte kört | inte kört | inte kört |
| Min journal > patienten når sin egen journal men inte någon annans, oavsett id i adressen | Inte kört | inte kört | inte kört |
| Min journal > patientsessionen når inga av personalens API:er | Inte kört | inte kört | inte kört |
| Min journal > personalens session når inte Min journal | Inte kört | inte kört | inte kört |
| Min journal > utloggning och byte av roll i samma webbläsare nollställer sessionen | Inte kört | inte kört | inte kört |
| Min journal > anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas | Inte kört | inte kört | inte kört |
| Min journal > en äldre version av en anteckning som har ersatts av en version som inte visas går inte att nå, varken i Min journal eller i FHIR | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > invånare: egen journal från 16 år, vårdnadshavare till 13 år och aldrig för ett barn med skyddad identitet | Inte kört | inte kört | inte kört |
| Flerfaktor > utan registrerad faktor loggar demorollen in som förut, och flerfaktor är av | Inte kört | inte kört | inte kört |
| Flerfaktor > en passkey registreras med WebAuthn, och bara den publika nyckeln sparas | Inte kört | inte kört | inte kört |
| Flerfaktor > med en passkey väntar inloggningen på den andra faktorn och ger varken behörighet eller läskopia förrän den är godkänd | Inte kört | inte kört | inte kört |
| Flerfaktor > en signatur från fel nyckel, fel ursprung, en gammal utmaning eller utan användarverifiering godtas inte | Inte kört | inte kört | inte kört |
| Flerfaktor > en app för engångskoder enligt RFC 6238 registreras med en kod, nyckeln sparas krypterad och varje kod godtas en gång | Inte kört | inte kört | inte kört |
| Flerfaktor > invånaren i Min journal kan slå på flerfaktor och loggar sedan in med engångskod | Inte kört | inte kört | inte kört |
| Flerfaktor > för många felaktiga koder avbryter inloggningen, och återställd sandlåda tar bort faktorn så att ingen låses ute | Inte kört | inte kört | inte kört |
| Flerfaktor > TOTP stämmer med testvektorerna i RFC 6238 | Inte kört | inte kört | inte kört |
| Flerfaktor > säkerhetsloggen visar registrering, väntande inloggning, misslyckad och lyckad andra faktor | Inte kört | inte kört | inte kört |
| Gränssnitt > Avbrott > flerfaktor: en passkey i Chromes virtuella autentiserare slår på flerfaktor, bekräftar nästa inloggning, och läsläget vid avbrott fungerar efter den andra faktorn | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > flerfaktor: invånaren slår på en app för engångskoder i Min journal och loggar sedan in med en kod från appen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Flerfaktor som krav > parametern Flerfaktor krävs vid inloggning är en demoregel som står på nej och ändras med fyra ögon | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > med kravet på ja leds den som saknar faktor till att registrera en, och får ingen behörighet eller läskopia förrän den är bekräftad | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > med kravet på ja ger en felaktig kod vid registreringen ingen inloggning, och för många försök avbryter | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > den som redan är inloggad loggas inte ut när kravet slås på, utan får frågan vid nästa inloggning | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > med kravet på ja leds invånaren i Min journal till att registrera en faktor innan journalen visas | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > med kravet på ja går den sista faktorn inte att ta bort, och säkerhetsloggen visar inloggningen med den nya faktorn | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > en väntande registrering slutför inte inloggningen när kontot har fått en faktor under tiden, och tar aldrig bort faktorer | Inte kört | inte kört | inte kört |
| Flerfaktor som krav > en väntande registrering kan aldrig ta bort en faktor | Inte kört | inte kört | inte kört |

### L6 Skyddade personuppgifter hanteras i hela kedjan, även uppropning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Inte kört | inte kört | inte kört |
| API > arbetslista maskerar skyddad identitet | Inte kört | inte kört | inte kört |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Inte kört | inte kört | inte kört |
| API > väntrummet visar aldrig namn för skyddad patient | Inte kört | inte kört | inte kört |
| API > visa identitet kräver syfte och loggas | Inte kört | inte kört | inte kört |
| FHIR > skyddad patient maskeras i FHIR | Inte kört | inte kört | inte kört |
| Min journal > skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter | Inte kört | inte kört | inte kört |

### L7 NLL: ordinationsorsak och uppföljningsdatum, kvittens för varje överföring

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Inte kört | inte kört | inte kört |
| Läkemedel > uppföljningsdatum är obligatoriskt | Inte kört | inte kört | inte kört |
| Läkemedel > databasen vägrar ordination utan orsak (CHECK) | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: normal överföring kvitteras | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Inte kört | inte kört | inte kört |
| Seed > alla ordinationer har orsak och uppföljningsdatum | Inte kört | inte kört | inte kört |
| Kodverk > ordinationerna i seeden har dos och administrationsväg som passar produktens styrka och form | Inte kört | inte kört | inte kört |
| FHIR-struktur > MedicationRequest har NPL-id med E-hälsomyndighetens system | Inte kört | inte kört | inte kört |
| Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick | Inte kört | inte kört | inte kört |
| Förpackning med NPL-pack-id > katalogens förpackningar finns i NPL under samma produkt och är inte avregistrerade | Inte kört | inte kört | inte kört |
| Förpackning med NPL-pack-id > systemet väljer förpackningen när förskrivaren inte väljer, och överföringen till NLL har NPL-pack-id | Inte kört | inte kört | inte kört |
| Muntlig ordination > sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar | Inte kört | inte kört | inte kört |

### L9 HSA, SITHS, Säker digital kommunikation, patientregistret och kvalitetsregister

Inte alla testfall godkända. Status i registret: planerat.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Inte kört | inte kört | inte kört |

### L10 EHDS: CE-märkning, interoperabilitets- och loggningskomponent

Inte alla testfall godkända. Status i registret: planerat.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR-struktur > inga tomma listor, tomma strängar eller tomma värden, och varje kodning har system och kod | Inte kört | inte kört | inte kört |
| FHIR-struktur > Patient, Organization och Practitioner följer HL7 Swedens basprofiler | Inte kört | inte kört | inte kört |

### L13 GDPR, arkivlagen, säkerhetsskyddslagen och tillgänglighetslagen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Inte kört | inte kört | inte kört |
| Läskopia > spärrade uppgifter och skyddad identitet följer samma regler i läskopian | Inte kört | inte kört | inte kört |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Inte kört | inte kört | inte kört |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Inte kört | inte kört | inte kört |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Inte kört | inte kört | inte kört |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Inte kört | inte kört | inte kört |
| Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat | Inte kört | inte kört | inte kört |
| Gränssnitt > Tillgänglighet > varje formulärfält, knapp och länk har ett namn som beskriver syftet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### M2 Krav utvärderade på papper: krav som testfall och spårbar bedömning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |

### M4 Tappade meddelanden mellan vårdnivåer: kvittens, larm och test av felvägar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Inte kört | inte kört | inte kört |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Inte kört | inte kört | inte kört |

### M5 Migrerad historik blev osynlig: avstämd migrering och kronologisk vy

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| API > migreringsavstämningen visar avvikelsen | Inte kört | inte kört | inte kört |

### M6 För bred åtkomst och svaga spärrar: behörighet som testat krav

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nödåtkomst: häver aldrig en spärr | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Inte kört | inte kört | inte kört |
| Min journal > patientsessionen når inga av personalens API:er | Inte kört | inte kört | inte kört |
| Min journal > svaren innehåller inga id, interna anteckningar eller uppgifter om andra patienter | Inte kört | inte kört | inte kört |
| Min journal > ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas | Inte kört | inte kört | inte kört |

### M8 Uppgraderingar skapar nya fel: små releaser och automatiserade tester

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |
| Releaser > varje migrering har en återställning, och upp och sedan ned ger samma schema som före | Inte kört | inte kört | inte kört |
| Releaser > schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen | Inte kört | inte kört | inte kört |
| Releaser > en sparad sandlåda som läses in får sitt schema kontrollerat, och versionen i drift gäller efter en återgång | Inte kört | inte kört | inte kört |
| Releaser > uppgraderingen visar nyheterna, API:ts ändringslogg och migreringarna för versionen | Inte kört | inte kört | inte kört |
| Releaser > en uppgradering vars tester inte är gröna stoppas och kan inte godkännas | Inte kört | inte kört | inte kört |
| Releaser > återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den | Inte kört | inte kört | inte kört |
| Releaser > bara systemförvaltningen ser och gör uppgraderingar | Inte kört | inte kört | inte kört |
| Releaser > API: återgång och godkännande av två systemförvaltare i var sin inloggning, och servern visar schemaversionen | Inte kört | inte kört | inte kört |

### M9 Fler klick och långsamhet: klickbudget och svarstidsmål

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > drift visar p50 och p95 per adress i API:t | Inte kört | inte kört | inte kört |
| Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden | Inte kört | inte kört | inte kört |

### M12 Inlåsning: regionägd kod och data i öppna format

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > sökning ger Bundle searchset | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Inte kört | inte kört | inte kört |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Inte kört | inte kört | inte kört |
| Arkiv > återföringen av all data tar med varje tabell med vårdgivarens uppgifter och de gemensamma tabellerna som NDJSON och databasens schema, också tabeller som inte hör till journalen | Inte kört | inte kört | inte kört |
| Arkiv > paketet har XML-schemana i mappen schemas och bara registrerade medietyper i METS.xml, som E-ARK:s validator kräver | Inte kört | inte kört | inte kört |
| Arkiv > varje tabell är klassad för återföringen, och inga nycklar eller hemligheter följer med i paketet | Inte kört | inte kört | inte kört |
| Arkiv > rader med hemligheter i tabeller med nyckel och värde följer inte med, och bara kända inställningar följer med | Inte kört | inte kört | inte kört |

## Sussas kravspecifikation

### 2.1.1.1 Systemuppbyggnad

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > hälsa och Server-Timing på alla svar | Inte kört | inte kört | inte kört |
| API > drift visar p50 och p95 per adress i API:t | Inte kört | inte kört | inte kört |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |
| Systemuppbyggnad > förteckningen har varje modul i src och public med skikt, tillverkare, beskrivning och kraven den stödjer | Inte kört | inte kört | inte kört |
| Systemuppbyggnad > de fem perspektiven i kravtexten finns och pekar på moduler som finns | Inte kört | inte kört | inte kört |
| Systemuppbyggnad > lastmätning: 20 samtidiga användare med var sin sandlåda läser journalen med p95 under 500 ms | Inte kört | inte kört | inte kört |
| Systemuppbyggnad > totalkostnaden räknas ur mätningen och antagandena, och antagandena står i svaret | Inte kört | inte kört | inte kört |

### 2.2.1.7 Stöd för Journalen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tjänstekontrakt > tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR | Inte kört | inte kört | inte kört |

### 2.2.1.8 Producent till NPÖ

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tjänstekontrakt > GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > producenten nekar fel roll och visar inte spärrade uppgifter | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > okänt kontrakt, patient eller logisk adress ger ett fel på svenska | Inte kört | inte kört | inte kört |

### 2.3.1.1 Stöd för mobilt arbetssätt

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Mobil > varje roll har sin startsida och menyn i 360 px utan sidledsrullning och med knappar på minst 40 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Ge en dos går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Ge en dos med delegering går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera en dos i efterhand går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera blodtryck går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera en NEWS2-kontroll går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera längd, vikt, blodtryck och puls går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera provtagning går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > vid sängen identifierar armbandet patienten i Läkemedel att ge, och bara patientens doser visas | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Mobilt arbetssätt > varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden | Inte kört | inte kört | inte kört |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 2.3.1.2 Mobilt arbetssätt

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Mobilt arbetssätt > varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden | Inte kört | inte kört | inte kört |
| Gränssnitt > Mobil > varje roll har sin startsida och menyn i 360 px utan sidledsrullning och med knappar på minst 40 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Ge en dos går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Ge en dos med delegering går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Öppna patient från arbetslistan går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Läsa senaste anteckning går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Patienten bokar om sin tid i Min journal går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > patienten läser sin journal, sina tider och vem som läst journalen i Min journal i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > förbindelsen bryts och kommer tillbaka från en annan adress utan att inloggningen tappas | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 2.3.1.3 Mobila tillämpningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Mobilt arbetssätt > varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden | Inte kört | inte kört | inte kört |
| Mobilt arbetssätt > uppställningen per funktionellt krav i kapitel 3 och 4 räknas ur registret och anger bara flöden som prövas i 360 px | Inte kört | inte kört | inte kört |
| Mobila tillämpningar > varje funktionellt krav i kapitel 3 och 4 finns i uppställningen, med mobila flöden, skrivbordets flöden, vyer i 360 px eller som inte byggt | Inte kört | inte kört | inte kört |
| Gränssnitt > Mobil > varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Ge en dos går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Ge en dos med delegering går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera en dos i efterhand går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera blodtryck går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera en NEWS2-kontroll går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera längd, vikt, blodtryck och puls går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Registrera provtagning går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Öppna patient från arbetslistan går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Läsa senaste anteckning går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Överblicka dagens händelser på avdelningen går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Kvittera remissvar går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Söka i journalen och öppna träffen går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > Patienten bokar om sin tid i Min journal går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 2.3.1.4 Tillgänglighet och robusthet

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Avbrott > appen startar utan nät från service workern och visar läsläget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > simulerat avbrott ger läsläge medan servern svarar andra besökare | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > skrivande är avstängt i läsläget med en förklaring | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > åtkomster i läsläget når åtkomstloggen när servern svarar igen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Läskopia > åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka | Inte kört | inte kört | inte kört |
| Gränssnitt > Mobil > förbindelsen bryts och kommer tillbaka från en annan adress utan att inloggningen tappas | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Skrivkön efter avbrott > ett mätvärde och en dos från kön sparas med tiden då de gjordes, och en rad som skickas igen sparas inte två gånger | Inte kört | inte kört | inte kört |
| Skrivkön efter avbrott > en dos som någon annan gav under avbrottet blir en konflikt som personen avgör, och ingen dos sparas två gånger | Inte kört | inte kört | inte kört |
| Skrivkön efter avbrott > kön tas bara emot från den som gjorde registreringarna, med en rad som är krypterad med läskopians nyckel och inom läskopians giltighet | Inte kört | inte kört | inte kört |
| Skrivkön efter avbrott > läskopian har mätvärdena och remisserna för patienterna, för de roller som får läsa dem | Inte kört | inte kört | inte kört |
| Gränssnitt > Avbrott > en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > en dos som någon annan gav under avbrottet blir en konflikt som sjuksköterskan avgör, och dosen sparas inte två gånger | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 2.5.1.1 Öppet integrationsgränssnitt under hela avtalstiden

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > metadata är ett CapabilityStatement | Inte kört | inte kört | inte kört |
| FHIR > sökning ger Bundle searchset | Inte kört | inte kört | inte kört |
| API > FHIR via HTTP har application/fhir+json och kräver inloggning | Inte kört | inte kört | inte kört |
| FHIR-skrivning > Observation: blodtryck registreras med samma funktion som gränssnittet och loggas | Inte kört | inte kört | inte kört |
| FHIR-skrivning > MedicationRequest: samma varningar som läkemedelslistan, och en allvarlig varning kvitteras med motivering | Inte kört | inte kört | inte kört |
| SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas | Inte kört | inte kört | inte kört |
| Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > Condition: läkaren registrerar en diagnos på vårdkontakten med samma funktion som gränssnittet, och den loggas | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > Condition: fel roll, en vårdkontakt på en annan patient, en annan vårdenhet, en okänd kod och ett annat kodverk nekas med en förklaring | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > CapabilityStatement har versionen och listar varje resurstyp och operation som servern har, och inget annat | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad | Inte kört | inte kört | inte kört |
| Gränssnitt > Öppet API > ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Fler skrivningar via API:t > Överkänslighet: läkarens registrering blir uppmärksamhetsinformation med bekräftad grad och ATC-kod och varnar för läkemedel i listan som omfattas, bara bland ordinationer som läkaren får se | Inte kört | inte kört | inte kört |
| Fler skrivningar via API:t > AllergyIntolerance: överkänsligheten registreras via API:t med samma funktion som gränssnittet, och fel roll och dubblett nekas | Inte kört | inte kört | inte kört |
| Fler skrivningar via API:t > Patient: en ny patient registreras via API:t med samma tolkning av numret och dubblettkontroll som gränssnittet | Inte kört | inte kört | inte kört |
| Fler skrivningar via API:t > Patient/$everything för personalen: varje resurstyp prövas och loggas för sig, och bara det personen får se kommer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Uppmärksamhet > läkaren registrerar en överkänslighet med ämnet och reaktionen, och den syns i patienthuvudet med graden | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Systemkonton > SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas | Inte kört | inte kört | inte kört |
| Systemkonton > prenumeration på en population: varje ny diagnos på vårdenheten meddelas med bara id, och bara det som systemkontot får läsa | Inte kört | inte kört | inte kört |
| Skrivning för systemkonton > ett systemkonto kan inte registrera överkänslighet eller annat som kontot inte får skriva, och inget sparas | Inte kört | inte kört | inte kört |

### 2.5.1.2 Funktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > sökning ger Bundle searchset | Inte kört | inte kört | inte kört |
| FHIR > FHIR följer samma behörighet: nekad utan vårdrelation | Inte kört | inte kört | inte kört |
| FHIR > FHIR följer inre sekretess och spärr | Inte kört | inte kört | inte kört |
| FHIR > FHIR-anrop loggas | Inte kört | inte kört | inte kört |
| FHIR-skrivning > Composition: final skapar och signerar, preliminary sparar ett utkast med samma mall som gränssnittet | Inte kört | inte kört | inte kört |
| FHIR-skrivning > MedicationRequest: utsättning med status stopped, och antikoagulantia sätts bara ut med en plan | Inte kört | inte kört | inte kört |
| FHIR-skrivning > nekad: fel roll, ingen vårdrelation och Min journal nekas och nekandet loggas | Inte kört | inte kört | inte kört |
| FHIR-skrivning > inget går att göra via API:t som gränssnittet inte tillåter: ändrad överkänslighet, borttagning och ändrade mätvärden | Inte kört | inte kört | inte kört |
| Prenumerationer > Subscription skapas med samma behörighet som läsningen och bara till adresser som administratören har godkänt | Inte kört | inte kört | inte kört |
| Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet | Inte kört | inte kört | inte kört |
| Prenumerationer > inget meddelande om det som prenumeranten inte får läsa: spärrad vårdenhet, annan vårdenhet och osignerade utkast | Inte kört | inte kört | inte kört |
| Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > Condition: läkaren registrerar en diagnos på vårdkontakten med samma funktion som gränssnittet, och den loggas | Inte kört | inte kört | inte kört |
| Fler flöden via API:t > Appointment: en remiss på väntelistan bokas via API:t med systemets förslag, med samma kontroller och loggning som i gränssnittet | Inte kört | inte kört | inte kört |
| Fler flöden via API:t > Encounter: inskrivning via API:t med samma förslag på avdelning och orsak som knappen Skriv in | Inte kört | inte kört | inte kört |
| Tillämpningar och mottagare > systemförvaltaren godkänner en mottagare, en prenumeration till den kan skapas, och när mottagaren återkallas avslutas prenumerationen | Inte kört | inte kört | inte kört |
| Tillämpningar och mottagare > bara systemförvaltaren registrerar, och adresser, omfång och namn prövas | Inte kört | inte kört | inte kört |
| Systemkonton > systemförvaltaren registrerar ett systemkonto, systemet räknar fram omfånget ur informationsmängderna och en privat nyckel sparas aldrig | Inte kört | inte kört | inte kört |
| Systemkonton > SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas | Inte kört | inte kört | inte kört |
| Systemkonton > systemkontot läser bara sina vårdenheters poster ur sina informationsmängder, aldrig skyddad identitet eller spärrade uppgifter, och varje läsning loggas | Inte kört | inte kört | inte kört |
| Systemkonton > prenumeration på en population: varje ny diagnos på vårdenheten meddelas med bara id, och bara det som systemkontot får läsa | Inte kört | inte kört | inte kört |
| Systemkonton > ett återkallat systemkonto får ingen biljett, dess biljetter slutar gälla och dess prenumerationer avslutas | Inte kört | inte kört | inte kört |
| Gränssnitt > Öppet API > systemförvaltaren registrerar ett systemkonto för vårddatalagret, ser vad det får och kan återkalla det | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Fler skrivningar via API:t > AllergyIntolerance: överkänsligheten registreras via API:t med samma funktion som gränssnittet, och fel roll och dubblett nekas | Inte kört | inte kört | inte kört |
| Fler skrivningar via API:t > Patient: en ny patient registreras via API:t med samma tolkning av numret och dubblettkontroll som gränssnittet | Inte kört | inte kört | inte kört |
| Makulering via API:t > DELETE och $makulera makulerar en dos med samma regler som gränssnittet: orsak krävs, historiken står kvar och makuleringen loggas | Inte kört | inte kört | inte kört |
| Makulering via API:t > makuleringen prövas som i gränssnittet: fel roll och en annan vårdenhet nekas, och en dos som inte finns ger 404 | Inte kört | inte kört | inte kört |
| Makulering via API:t > en provbeställning makuleras via API:t, och en resurs som inte går att makulera ger 405 med vad man gör i stället | Inte kört | inte kört | inte kört |
| Makulering via API:t > ett systemkonto får bara makulera det som kontot självt har skrivit | Inte kört | inte kört | inte kört |
| Identitet för systemkonton > förvalet är pseudonym: kontot ser aldrig patientens namn eller personnummer i resurser, sökningar eller prenumerationer | Inte kört | inte kört | inte kört |
| Identitet för systemkonton > namn och personnummer kräver att systemförvaltaren väljer det med en motivering, och då får kontot dem | Inte kört | inte kört | inte kört |

### 2.5.1.3 Omfattning av information

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form | Inte kört | inte kört | inte kört |
| FHIR > MedicationRequest använder ATC och har uppföljningsdatum | Inte kört | inte kört | inte kört |
| FHIR-struktur > Patient, Organization och Practitioner följer HL7 Swedens basprofiler | Inte kört | inte kört | inte kört |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Inte kört | inte kört | inte kört |
| API-täckning > varje flöde i klickbudgeten är bedömt för API:t, och bedömningen gäller flöden som finns | Inte kört | inte kört | inte kört |
| API-täckning > varje flöde som står som ja görs via det öppna API:t | Inte kört | inte kört | inte kört |
| API-täckning > API: täckningen kan läsas utan inloggning | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > producenten nekar fel roll och visar inte spärrade uppgifter | Inte kört | inte kört | inte kört |
| Tjänstekontrakt > okänt kontrakt, patient eller logisk adress ger ett fel på svenska | Inte kört | inte kört | inte kört |
| Fler flöden via API:t > Appointment: en remiss på väntelistan bokas via API:t med systemets förslag, med samma kontroller och loggning som i gränssnittet | Inte kört | inte kört | inte kört |
| Fler flöden via API:t > Appointment: fel roll, en annan patient och en tid som inte passar remissen nekas med en förklaring | Inte kört | inte kört | inte kört |
| Fler flöden via API:t > Encounter: inskrivning via API:t med samma förslag på avdelning och orsak som knappen Skriv in | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad | Inte kört | inte kört | inte kört |
| Ärenden om API:t > en begäran om ny information går från inkommen till levererad, och levererad kräver en version i ändringsloggen | Inte kört | inte kört | inte kört |
| Ärenden om API:t > systemet svarar direkt när det begärda redan finns, och ett ärende med ett personnummer avvisas | Inte kört | inte kört | inte kört |

### 2.6.1.2 Innovationsramverk

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas | Inte kört | inte kört | inte kört |
| SMART on FHIR > standalone launch: personen väljer patienten bland sina patienter på arbetslistan | Inte kört | inte kört | inte kört |
| SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Tillämpningar och mottagare > systemförvaltaren registrerar en tillämpning, systemet föreslår behörighet och text ur omfånget, och den startas från journalen | Inte kört | inte kört | inte kört |
| Tillämpningar och mottagare > en återkallad tillämpning kan inte startas, och dess åtkomstbiljetter återkallas direkt | Inte kört | inte kört | inte kört |
| Tillämpningar och mottagare > bara systemförvaltaren registrerar, och adresser, omfång och namn prövas | Inte kört | inte kört | inte kört |
| Ärenden om API:t > en begäran om ny information går från inkommen till levererad, och levererad kräver en version i ändringsloggen | Inte kört | inte kört | inte kört |
| Ärenden om API:t > systemet svarar direkt när det begärda redan finns, och ett ärende med ett personnummer avvisas | Inte kört | inte kört | inte kört |
| Öppet API hålls aktuellt > ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad | Inte kört | inte kört | inte kört |
| Gränssnitt > Öppet API > systemförvaltaren registrerar en tillämpning, ser vad den får och kan återkalla den | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Öppet API > ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Innovationsramverket > en tillämpning registreras med källkoden, licensen och versionen, och öppen källkod kräver adressen till källkoden | Inte kört | inte kört | inte kört |
| Systemkonton > SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas | Inte kört | inte kört | inte kört |
| Gränssnitt > Öppet API > systemförvaltaren registrerar ett systemkonto för vårddatalagret, ser vad det får och kan återkalla det | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter | Inte kört | inte kört | inte kört |
| Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön | Inte kört | inte kört | inte kört |

### 2.7.1.2 Uppfylla relevanta lagar och föreskrifter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > helflöde: anteckning skapas, signeras och rättas | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte raderas (trigger) | Inte kört | inte kört | inte kört |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Inte kört | inte kört | inte kört |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Inte kört | inte kört | inte kört |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Inte kört | inte kört | inte kört |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Stickprovskontroll > systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: samtycke i stunden visar spärrade uppgifter | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den | Inte kört | inte kört | inte kört |
| Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan | Inte kört | inte kört | inte kört |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Inte kört | inte kört | inte kört |
| Min journal > nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista | Inte kört | inte kört | inte kört |
| Min journal > inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter | Inte kört | inte kört | inte kört |
| Min journal > personalens session når inte Min journal | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: logggranskare får läsa loggen men inte journalen | Inte kört | inte kört | inte kört |
| Stickprovskontroll > en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas | Inte kört | inte kört | inte kört |
| API > nödåtkomst via API flaggas i logguppföljningen | Inte kört | inte kört | inte kört |
| Min journal > anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas | Inte kört | inte kört | inte kört |
| Journal > rättelse kräver orsak | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nödåtkomst: häver aldrig en spärr | Inte kört | inte kört | inte kört |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Inte kört | inte kört | inte kört |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Inte kört | inte kört | inte kört |
| Min journal > patienten når sin egen journal men inte någon annans, oavsett id i adressen | Inte kört | inte kört | inte kört |
| Min journal > patientsessionen når inga av personalens API:er | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Inte kört | inte kört | inte kört |
| API > väntrummet visar aldrig namn för skyddad patient | Inte kört | inte kört | inte kört |
| API > visa identitet kräver syfte och loggas | Inte kört | inte kört | inte kört |
| FHIR > skyddad patient maskeras i FHIR | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Inte kört | inte kört | inte kört |
| Läskopia > spärrade uppgifter och skyddad identitet följer samma regler i läskopian | Inte kört | inte kört | inte kört |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Inte kört | inte kört | inte kört |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Inte kört | inte kört | inte kört |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Inte kört | inte kört | inte kört |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Inte kört | inte kört | inte kört |
| Läkemedel > ordinationsorsak är obligatorisk | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: normal överföring kvitteras | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Inte kört | inte kört | inte kört |
| Delegering > undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR | Inte kört | inte kört | inte kört |
| Delegering > undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras | Inte kört | inte kört | inte kört |
| Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat | Inte kört | inte kört | inte kört |
| Gränssnitt > Tillgänglighet > varje formulärfält, knapp och länk har ett namn som beskriver syftet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Inte kört | inte kört | inte kört |
| Läkemedel > varningarna är märkta som demoregler | Inte kört | inte kört | inte kört |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Inte kört | inte kört | inte kört |
| Lagkravsmatris > varje relevant lag finns, och varje rad har tester eller en avgränsning med en förklaring | Inte kört | inte kört | inte kört |
| Lagkravsmatris > matrisens tester räknas in i 2.7.1.2, och statusen per rad följer testerna | Inte kört | inte kört | inte kört |
| Lagkravsmatris > API: krav/sussa ger matrisen under 2.7.1.2 med status per rad | Inte kört | inte kört | inte kört |

### 2.7.1.3 Användargränssnitt på svenska

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Språk > gränssnittets texter är svenska, utan engelska ord, tankstreck, ellipser och interna anteckningar | Inte kört | inte kört | inte kört |
| Språk > serverns felmeddelanden och varningar är svenska | Inte kört | inte kört | inte kört |
| Språk > inga tankstreck, ellipser eller interna anteckningar någonstans i public/ och src/, inte heller i kommentarer | Inte kört | inte kört | inte kört |
| Språk > kontrollen hittar engelska ord, okända förkortningar, tankstreck, ellipser och interna anteckningar | Inte kört | inte kört | inte kört |
| Språk > kontrollen hittar å, ä och ö som saknas | Inte kört | inte kört | inte kört |

### 3.1.1.1 Stöd för fyra typer av identitetsnummer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > typbestämning: personnummer, samordningsnummer, reservnummer och OID känns igen i alla vanliga skrivsätt | Inte kört | inte kört | inte kört |
| Identitet > tio siffror och plustecken ger rätt sekel | Inte kört | inte kört | inte kört |
| Identitet > kontrollsiffror: fel kontrollsiffra, datum och längd förklaras på svenska | Inte kört | inte kört | inte kört |
| Identitet > demon tar bara Skatteverkets testpersonnummer och testsamordningsnummer | Inte kört | inte kört | inte kört |
| Identitet > reservnummer skapas av systemet med påhittat format, OID-rot för dokumentation och rätt könssiffra | Inte kört | inte kört | inte kört |
| Identitet > seed: samordningsnummer, reservnummer, OID och en dubblett | Inte kört | inte kört | inte kört |
| Identitet > API: sök hittar patienten på varje identitetstyp, i valfritt format, och på en tidigare identitet | Inte kört | inte kört | inte kört |
| Identitet > API: registrera patient utan känd identitet ger reservnummer och vårdkontakt | Inte kört | inte kört | inte kört |
| Identitet > behörighet: registrering och ny identitet kräver rätt yrkesroll och vårdrelation, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Inte kört | inte kört | inte kört |
| FHIR > Patient har personnummer med rätt identifier-system | Inte kört | inte kört | inte kört |
| Seed > personnummer kommer från Skatteverkets testpersonnummer | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera patient utan känd identitet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.1.2 Koppla samman tidigare identiteter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > systemet hittar dubbletten på namn och födelsedatum, men aldrig för skyddad identitet eller två personnummer | Inte kört | inte kört | inte kört |
| Identitet > API: nytt personnummer ersätter reservnumret, och det gamla finns kvar som tidigare identitet | Inte kört | inte kört | inte kört |
| Identitet > API: ett nummer som tillhör en annan journal blir ett förslag om sammanslagning | Inte kört | inte kört | inte kört |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Inte kört | inte kört | inte kört |
| Identitet > API: sammanslagning flyttar journalen, och sök, logglista och huvud leder till den gällande journalen | Inte kört | inte kört | inte kört |
| Identitet > behörighet: bara vårdadministratören slår samman, och bara journaler som systemet har föreslagit | Inte kört | inte kört | inte kört |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Slå samman en dubblett inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.1.3 Identifikation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > typbestämning: personnummer, samordningsnummer, reservnummer och OID känns igen i alla vanliga skrivsätt | Inte kört | inte kört | inte kört |
| Identitet > tio siffror och plustecken ger rätt sekel | Inte kört | inte kört | inte kört |
| Identitet > kontrollsiffror: fel kontrollsiffra, datum och längd förklaras på svenska | Inte kört | inte kört | inte kört |
| Identitet > demon tar bara Skatteverkets testpersonnummer och testsamordningsnummer | Inte kört | inte kört | inte kört |
| Identitet > reservnummer skapas av systemet med påhittat format, OID-rot för dokumentation och rätt könssiffra | Inte kört | inte kört | inte kört |
| Identitet > seed: samordningsnummer, reservnummer, OID och en dubblett | Inte kört | inte kört | inte kört |
| Identitet > API: sök hittar patienten på varje identitetstyp, i valfritt format, och på en tidigare identitet | Inte kört | inte kört | inte kört |
| Identitet > API: registrera patient utan känd identitet ger reservnummer och vårdkontakt | Inte kört | inte kört | inte kört |
| Identitet > behörighet: registrering och ny identitet kräver rätt yrkesroll och vårdrelation, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Inte kört | inte kört | inte kört |
| FHIR > Patient har personnummer med rätt identifier-system | Inte kört | inte kört | inte kört |
| Seed > personnummer kommer från Skatteverkets testpersonnummer | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera patient utan känd identitet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Identitet > API: sök förklarar ett felskrivet nummer | Inte kört | inte kört | inte kört |

### 3.1.1.4 Koppla samman identiteter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > systemet hittar dubbletten på namn och födelsedatum, men aldrig för skyddad identitet eller två personnummer | Inte kört | inte kört | inte kört |
| Identitet > API: nytt personnummer ersätter reservnumret, och det gamla finns kvar som tidigare identitet | Inte kört | inte kört | inte kört |
| Identitet > API: ett nummer som tillhör en annan journal blir ett förslag om sammanslagning | Inte kört | inte kört | inte kört |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Inte kört | inte kört | inte kört |
| Identitet > API: sammanslagning flyttar journalen, och sök, logglista och huvud leder till den gällande journalen | Inte kört | inte kört | inte kört |
| Identitet > behörighet: bara vårdadministratören slår samman, och bara journaler som systemet har föreslagit | Inte kört | inte kört | inte kört |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Slå samman en dubblett inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.2.1 Standardiserade och anpassningsbara vyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Inte kört | inte kört | inte kört |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Inte kört | inte kört | inte kört |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Inte kört | inte kört | inte kört |
| Planering > anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut | Inte kört | inte kört | inte kört |

### 3.1.2.2 Presentationsvyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Inte kört | inte kört | inte kört |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Inte kört | inte kört | inte kört |
| Avdelningens planering > dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2) | Inte kört | inte kört | inte kört |
| Avdelningens planering > patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4) | Inte kört | inte kört | inte kört |
| Uppföljningsvyn > uppföljningsvyn samlar vårdplanernas mål och avvikelser, passerade uppföljningsdatum och remisser med när, var och vem | Inte kört | inte kört | inte kört |
| Uppföljningsvyn > uppföljningsvyn visar var i vårdprocessen patienten är och den samordnade planeringen med kommunen, och översikten sammanfattar den | Inte kört | inte kört | inte kört |
| Uppföljningsvyn > uppföljningsvyn följer behörigheten: spärrad vårdenhet, annan vårdenhet utan aktivt val och fel roll | Inte kört | inte kört | inte kört |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Inte kört | inte kört | inte kört |

### 3.1.2.3 Anpassningsbar presentationsvy

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Planering > anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen | Inte kört | inte kört | inte kört |
| Anpassningsbara vyer > anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut | Inte kört | inte kört | inte kört |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Inte kört | inte kört | inte kört |

### 3.1.2.4 Vyer utan personuppgifter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > väntrummet visar aldrig namn för skyddad patient | Inte kört | inte kört | inte kört |
| Planering > väntetidsstatistik per vårdenhet utan personuppgifter, med vårdgarantin som demoregel | Inte kört | inte kört | inte kört |
| Remiss, del 2 > ledtider och avvikelser per vårdenhet och för regionen, utan personuppgifter | Inte kört | inte kört | inte kört |
| Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter | Inte kört | inte kört | inte kört |
| Vyer utan personuppgifter > beläggningsöversikten visar platser, belagda och lediga per avdelning utan namn, personnummer eller sal | Inte kört | inte kört | inte kört |
| Vyer utan personuppgifter > utbildningsläget visar journalen pseudonymiserad och säger vilka uppgifter som aldrig visas | Inte kört | inte kört | inte kört |
| Vyer utan personuppgifter > utbildningsläget följer behörigheten och visar aldrig en patient med skyddade personuppgifter eller spärrade uppgifter | Inte kört | inte kört | inte kört |

### 3.1.3.1 Formulärstöd för text och bilder

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mallar finns för alla anteckningstyper | Inte kört | inte kört | inte kört |
| Journal > utkast kan ändras av författaren | Inte kört | inte kört | inte kört |
| Journal > sjuksköterska kan skriva omvårdnadsanteckning men inte läkaranteckning | Inte kört | inte kört | inte kört |
| Tobaksvanor > systemet sätter själv att patienten använder tobak, och föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer | Inte kört | inte kört | inte kört |
| Tobaksvanor > systemet förklarar på vanlig svenska när svaren inte går ihop | Inte kört | inte kört | inte kört |
| Tobaksvanor > anteckningen får text som systemet skriver ur svaren, och svaren sparas strukturerat bredvid | Inte kört | inte kört | inte kört |
| Tobaksvanor > hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig | Inte kört | inte kört | inte kört |
| Tobaksvanor > API: rollerna som skriver omvårdnadsanteckningar dokumenterar tobaksvanor, och översikten visar den senaste | Inte kört | inte kört | inte kört |
| Tobaksvanor > en anteckning om tobaksvanor på en spärrad vårdenhet varken visas eller ändrar svaret i översikten | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Fylla i tobaksmallen i en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Formulär > fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren | Inte kört | inte kört | inte kört |
| Formulär > frågor visas och krävs efter regler, och reglerna ger varningar på vanlig svenska | Inte kört | inte kört | inte kört |
| Formulär > kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån | Inte kört | inte kört | inte kört |
| Formulär > ett formulär byggs som en ny version och används först när en annan systemförvaltare har godkänt det | Inte kört | inte kört | inte kört |
| Formulär > svaren i en signerad anteckning ändras aldrig, och en rättelse blir en ny version med egna svar | Inte kört | inte kört | inte kört |
| Formulär > API: systemförvaltaren bygger, förhandsvisar och föreslår formulär, och den som dokumenterar får aktiva formulär bland mallarna | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Bygga ett formulär och föreslå det inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.3.2 Röstinmatning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Röstinmatning > röstkommandon: skiljetecken, ny rad och byte av sökord tolkas, och systemet sätter stor bokstav i början av meningen | Inte kört | inte kört | inte kört |
| Röstinmatning > signering och andra beslut görs aldrig med rösten: kommandot signera ger en förklaring och inget händer | Inte kört | inte kört | inte kört |
| Röstinmatning > dikterad text märks i anteckningen och blir journal för andra först när den är signerad | Inte kört | inte kört | inte kört |
| Röstinmatning > igenkänning på enheten används när den finns, och annars krävs att användaren har valt webbläsarens tjänst, ett val som sparas per användare | Inte kört | inte kört | inte kört |
| Gränssnitt > Tillgänglighet > röstinmatningen frågar i en dialog innan ljudet går till webbläsarens tjänst när igenkänning på enheten saknas, valet sparas per användare, och med igenkänning på enheten kommer ingen fråga | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Klickbudget > Diktera och signera en daganteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Mobil > Diktera och signera en daganteckning går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 3.1.3.3 Registrera in- och utfarter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| In- och utfarter > typen avgör storlek, KVÅ-kod och nästa skötsel, och registreringen knyts till den pågående vårdkontakten | Inte kört | inte kört | inte kört |
| In- och utfarter > skötseln står i avdelningens planering, och en försenad skötsel markeras | Inte kört | inte kört | inte kört |
| In- och utfarter > en infart följs över tid: skötsel, byte och avveckling med KVÅ, och raderna ändras aldrig | Inte kört | inte kört | inte kört |
| In- och utfarter > systemet stoppar en andra urinkateter och förklarar fel storlek på vanlig svenska | Inte kört | inte kört | inte kört |
| In- och utfarter > vid sängen kontrolleras armbandet mot patienten och förpackningens utgångsdatum | Inte kört | inte kört | inte kört |
| In- och utfarter > behörighet: undersköterskan läser men registrerar inte, och en annan vårdenhet ändrar inte | Inte kört | inte kört | inte kört |
| In- och utfarter > spärr och inre sekretess: en spärrad vårdenhets infart syns inte och röjs inte, varken i listan, tidslinjen eller planeringen | Inte kört | inte kört | inte kört |
| In- och utfarter > FHIR: insättning, skötsel och avveckling är Procedure med KVÅ och samma behörighet | Inte kört | inte kört | inte kört |
| In- och utfarter > tidslinjen i översikten har insättning och avveckling | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en perifer venkateter inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.3.4 Manuell registrering av mätvärden

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mätvärden valideras och registreras | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera blodtryck inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Inte kört | inte kört | inte kört |
| Epikris och mätvärden > längd, vikt, blodtryck och puls registreras på en gång med samma tid och vårdkontakt, och systemet räknar BMI | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera längd, vikt, blodtryck och puls inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 3.1.3.5 Stöd vid dokumentation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mallar finns för alla anteckningstyper | Inte kört | inte kört | inte kört |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Inte kört | inte kört | inte kört |
| Journal > mätvärden valideras och registreras | Inte kört | inte kört | inte kört |
| Skalor > NEWS2: varje parameter ger poäng enligt Chart 1 i RCP 2017 | Inte kört | inte kört | inte kört |
| Skalor > NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4 | Inte kört | inte kört | inte kört |
| Skalor > GCS: systemet räknar summan och skriver texten, och fel delvärden avvisas | Inte kört | inte kört | inte kört |
| Skalor > NRS och ACVPU: systemet skriver texten | Inte kört | inte kört | inte kört |
| Mätvärden och NEWS2 > medvetandegrad, GCS, smärta och syrgas registreras, valideras och får text av systemet | Inte kört | inte kört | inte kört |
| Tobaksvanor > systemet sätter själv att patienten använder tobak, och föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer | Inte kört | inte kört | inte kört |
| Tobaksvanor > systemet förklarar på vanlig svenska när svaren inte går ihop | Inte kört | inte kört | inte kört |
| Tobaksvanor > anteckningen får text som systemet skriver ur svaren, och svaren sparas strukturerat bredvid | Inte kört | inte kört | inte kört |
| Tobaksvanor > hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig | Inte kört | inte kört | inte kört |
| Tobaksvanor > API: rollerna som skriver omvårdnadsanteckningar dokumenterar tobaksvanor, och översikten visar den senaste | Inte kört | inte kört | inte kört |
| Tobaksvanor > en anteckning om tobaksvanor på en spärrad vårdenhet varken visas eller ändrar svaret i översikten | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Fylla i tobaksmallen i en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Epikris och mätvärden > epikrisen får Orsak till vård ur vårdtillfället och diagnoserna, och läkaren skriver bara förloppet och uppföljningen | Inte kört | inte kört | inte kört |
| Epikris och mätvärden > epikrisens förslag bygger bara på det läkaren får se: en spärrad eller annan vårdenhets diagnos ändrar inte förslaget | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva och signera en epikris inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Formulär > fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren | Inte kört | inte kört | inte kört |
| Formulär > kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån | Inte kört | inte kört | inte kört |
| Formulär > förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer | Inte kört | inte kört | inte kört |
| Formulär > ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.3.6 Textfri informationsinmatning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Skanning > systemet känner själv igen armband, personnummer, provetikett, iordningställd dos och läkemedelsförpackning | Inte kört | inte kört | inte kört |
| Skanning > armbandet öppnar patienten, och i en öppen journal kontrollerar systemet att armbandet hör till patienten | Inte kört | inte kört | inte kört |
| Skanning > provetiketten bockar av röret vid provtagningen, och en etikett för en annan patient stoppas | Inte kört | inte kört | inte kört |
| Skanning > läkemedelsförpackningen kontrolleras mot patientens ordinationer, utgångsdatum och batch | Inte kört | inte kört | inte kört |
| Skanning > skanningen ger aldrig mer än behörigheten: utan vårdrelation och utan rätt roll nekas den | Inte kört | inte kört | inte kört |
| Skanning > armbandskoden är slumpmässig, och utan åtkomst till patienten är svaret detsamma som för en kod som inte finns | Inte kört | inte kört | inte kört |
| Skanning > misslyckade uppslag har ett tak per session | Inte kört | inte kört | inte kört |
| Skanning > seeden har armband för de inskrivna patienterna | Inte kört | inte kört | inte kört |

### 3.1.3.7 Röstinmatning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Röstinmatning > röstkommandon: skiljetecken, ny rad och byte av sökord tolkas, och systemet sätter stor bokstav i början av meningen | Inte kört | inte kört | inte kört |
| Röstinmatning > signering och andra beslut görs aldrig med rösten: kommandot signera ger en förklaring och inget händer | Inte kört | inte kört | inte kört |
| Röstinmatning > dikterad text märks i anteckningen och blir journal för andra först när den är signerad | Inte kört | inte kört | inte kört |
| Röstinmatning > igenkänning på enheten används när den finns, och annars krävs att användaren har valt webbläsarens tjänst, ett val som sparas per användare | Inte kört | inte kört | inte kört |
| Gränssnitt > Tillgänglighet > röstinmatningen frågar i en dialog innan ljudet går till webbläsarens tjänst när igenkänning på enheten saknas, valet sparas per användare, och med igenkänning på enheten kommer ingen fråga | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Klickbudget > Diktera och signera en daganteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Mobil > Diktera och signera en daganteckning går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 3.1.3.8 In- och utfarter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| In- och utfarter > typen avgör storlek, KVÅ-kod och nästa skötsel, och registreringen knyts till den pågående vårdkontakten | Inte kört | inte kört | inte kört |
| In- och utfarter > skötseln står i avdelningens planering, och en försenad skötsel markeras | Inte kört | inte kört | inte kört |
| In- och utfarter > en infart följs över tid: skötsel, byte och avveckling med KVÅ, och raderna ändras aldrig | Inte kört | inte kört | inte kört |
| In- och utfarter > systemet stoppar en andra urinkateter och förklarar fel storlek på vanlig svenska | Inte kört | inte kört | inte kört |
| In- och utfarter > vid sängen kontrolleras armbandet mot patienten och förpackningens utgångsdatum | Inte kört | inte kört | inte kört |
| In- och utfarter > behörighet: undersköterskan läser men registrerar inte, och en annan vårdenhet ändrar inte | Inte kört | inte kört | inte kört |
| In- och utfarter > spärr och inre sekretess: en spärrad vårdenhets infart syns inte och röjs inte, varken i listan, tidslinjen eller planeringen | Inte kört | inte kört | inte kört |
| In- och utfarter > FHIR: insättning, skötsel och avveckling är Procedure med KVÅ och samma behörighet | Inte kört | inte kört | inte kört |
| In- och utfarter > tidslinjen i översikten har insättning och avveckling | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en perifer venkateter inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.3.9 Mätvärden

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mätvärden valideras och registreras | Inte kört | inte kört | inte kört |
| FHIR-struktur > vitalparametrar följer FHIR R4:s vitalparameterprofiler | Inte kört | inte kört | inte kört |
| FHIR-struktur > labbvärden har NPU-kod och UCUM-enhet | Inte kört | inte kört | inte kört |
| Min journal > provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt | Inte kört | inte kört | inte kört |
| Mätvärden och NEWS2 > kurvorna har referensintervall och markerar värden utanför | Inte kört | inte kört | inte kört |
| Mätvärden och NEWS2 > NEWS2 räknas av systemet ur vitalparametrarna, med serie, vad som ska göras och nästa kontroll | Inte kört | inte kört | inte kört |
| Mätvärden och NEWS2 > en hel NEWS2-omgång registreras på en gång, med samma tid och vårdkontakt och åtgärden QD008 | Inte kört | inte kört | inte kört |
| Mätvärden och NEWS2 > NEWS2-omgången sparas inte alls när ett värde saknas eller är fel | Inte kört | inte kört | inte kört |
| Mätvärden och NEWS2 > FHIR: NEWS2 som härledd Observation med samma behörighet som mätvärdena | Inte kört | inte kört | inte kört |
| NEWS2-larm i inkorgen > larmet syns för sjuksköterskan och läkaren på vårdenheten, med vad som ska göras, men inte för andra roller eller vårdenheter | Inte kört | inte kört | inte kört |
| NEWS2-larm i inkorgen > larmet bygger bara på den egna vårdenhetens värden: en spärrad vårdenhets värden larmar inte och nämns inte | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en NEWS2-kontroll inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Mätvärden, skala 2 och inmatning > SpO2 skala 2: poängen följer Chart 1, och utan uppgift om luft eller syrgas räknas syremättnaden inte | Inte kört | inte kört | inte kört |
| Mätvärden, skala 2 och inmatning > systemet föreslår skala 2 vid andningssvikt med hyperkapné, läkaren beslutar med ett klick och NEWS2 räknas med skala 2 | Inte kört | inte kört | inte kört |
| Mätvärden, skala 2 och inmatning > skala 2 gäller bara där beslutet syns: en spärrad vårdenhets beslut räknas inte och röjs inte | Inte kört | inte kört | inte kört |
| Mätvärden, skala 2 och inmatning > varje mätvärde visar om det är manuellt eller maskinellt inmatat, och listan kan väljas ut efter typ, inmatning och period | Inte kört | inte kört | inte kört |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Inte kört | inte kört | inte kört |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Inte kört | inte kört | inte kört |
| Medicinteknik > patientens egna mätningar visas skilda från vårdens värden och räknas inte i NEWS2, larm eller vikt förrän de är bedömda | Inte kört | inte kört | inte kört |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Inte kört | inte kört | inte kört |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Inte kört | inte kört | inte kört |
| Epikris och mätvärden > längd, vikt, blodtryck och puls registreras på en gång med samma tid och vårdkontakt, och systemet räknar BMI | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera längd, vikt, blodtryck och puls inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 3.1.3.10 Rättstavning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rättstavning > en felstavad medicinsk term får förslag ur den medicinska ordlistan, och vanliga ord och rätt stavade termer markeras inte | Inte kört | inte kört | inte kört |
| Rättstavning > grammatik: upprepade ord, stor bokstav efter punkt, mellanslag och särskrivning av medicinska termer | Inte kört | inte kört | inte kört |
| Rättstavning > den personliga ordlistan: ett ord som personen lägger till markeras inte längre för personen, men för andra | Inte kört | inte kört | inte kört |
| Rättstavning > engelska: medicinska termer på engelska kontrolleras när texten är på engelska | Inte kört | inte kört | inte kört |
| Rättstavning > ordlistan har källor och utgåvor: kodverken, läkemedelskatalogen och den medicinska ordlistan | Inte kört | inte kört | inte kört |
| Rättstavning > API: kontrollen tar emot text utan att spara eller logga den, och kräver inloggning | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Rätta en felstavad medicinsk term i en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.5.1 Strukturerad uppmärksamhetsinformation enligt Socialstyrelsen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Uppmärksamhetsinformation > strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > överkänsligheterna som redan finns ingår, med grad, och syns i symbolen | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > förslag ur läkemedelslistan: antikoagulantia blir behandling, men inte tillfällig behandling | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > förslag ur diagnoserna: bärarskap blir smitta, implantat och transplantat blir medicinska tillstånd | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > FHIR: Flag och AllergyIntolerance med samma behörighet och loggning | Inte kört | inte kört | inte kört |
| FHIR-struktur > varje tillägg och eget kodsystem har en publicerad definition | Inte kört | inte kört | inte kört |
| Läkemedel > varning: överkänslighet med matchande ATC-prefix | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > kodverkslistan är Socialstyrelsens version 6.1.2 med Snomed CT, ICD-10-SE, ATC och motivering för termerna | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > registrerad uppmärksamhetsinformation har termen ur kodverkslistan med koder och motivering | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > förslag ur läkemedelslistan: immunmodulerande behandling och cytostatika enligt kodverkslistan | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > manuell registrering bara ur listan, och samma term inte två gånger | Inte kört | inte kört | inte kört |

### 3.1.5.2 Uppmärksamhetssymbol i patientvyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Uppmärksamhetsinformation > överkänsligheterna som redan finns ingår, med grad, och syns i symbolen | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > arbetslistan visar bara kategorierna, utan innehåll | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > spärrade uppgifter syns inte i symbolen förrän patienten samtycker | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > läskopian har uppmärksamhetsinformationen och symbolen | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > Min journal visar patientens uppmärksamhetsinformation, utan förslag och personalens id | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Bekräfta föreslagen uppmärksamhetsinformation inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Uppmärksamhetssymbolen i sök och inkorg > patientsök visar symbolen med samma regler som i patienthuvudet | Inte kört | inte kört | inte kört |
| Uppmärksamhetssymbolen i sök och inkorg > inkorgen visar symbolen på raderna med patient, bara när översikten får läsas | Inte kört | inte kört | inte kört |

### 3.1.5.3 Uppmärksamhetsinformation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Uppmärksamhetsinformation > strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > förslagsreglerna ligger i en egen modul och är märkta som demoregler | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > läkaren bekräftar ett förslag med ett klick, och det loggas med vem, var och när | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > manuell registrering bara ur listan, och samma term inte två gånger | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > ett avfärdat förslag kommer inte tillbaka, och avfärdandet loggas | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > när behandlingen sätts ut föreslår systemet att uppgiften avslutas, och den avslutas aldrig utan orsak | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > sjuksköterska och undersköterska ser informationen men bekräftar inte, vårdadministratören ser den inte | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet | Inte kört | inte kört | inte kört |
| Uppmärksamhetsinformation > FHIR: Flag och AllergyIntolerance med samma behörighet och loggning | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Bekräfta föreslagen uppmärksamhetsinformation inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.6.1 Strukturerade och enhetligt åtkomliga basfakta

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Basfakta > basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem | Inte kört | inte kört | inte kört |
| Basfakta > basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet | Inte kört | inte kört | inte kört |

### 3.1.6.2 Basfakta

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Basfakta > basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem | Inte kört | inte kört | inte kört |
| Basfakta > basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet | Inte kört | inte kört | inte kört |
| Journal > mätvärden valideras och registreras | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > systemet slår upp ATC-koden och föreslår allvarlighetsgraden ur ämnet och reaktionen | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > nyregistrering: basfakta, uppmärksamhetssymbolen och varningen vid ordination uppdateras, med när, var och av vem | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > ändring blir en ny version med orsak, och den tidigare versionen finns kvar i historiken | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > avslut med orsak tar bort överkänsligheten ur basfakta och symbolen, men historiken visar den med vem och varför | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > fel roll, en spärrad vårdenhets rad och en rad som inte finns nekas, utan att något röjs | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > skyddad identitet: svaret innehåller varken namn eller personnummer | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > en annan vårdenhets rad hos samma vårdgivare får ändras och avslutas, och avslutet lämnar raden kvar med historiken | Inte kört | inte kört | inte kört |
| Basfakta, överkänslighet > en rad hos en annan vårdgivare och en spärrad vårdenhets rad kan inte ändras eller avslutas, och felet röjer inget | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en överkänslighet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.7.1 Dubbeldokumentation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > NLL: normal överföring kvitteras | Inte kört | inte kört | inte kört |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Inte kört | inte kört | inte kört |
| Vårdkontakt > finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag | Inte kört | inte kört | inte kört |
| Vårdkontakt > vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om | Inte kört | inte kört | inte kört |
| Vårdkontakt > inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket | Inte kört | inte kört | inte kört |
| Vårdkontakt > planerad kontakt på distans, och ankomsten registreras på den planerade | Inte kört | inte kört | inte kört |
| Formulär > förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer | Inte kört | inte kört | inte kört |
| Formulär > förifyllnad bygger bara på det som den som fyller i får se: en spärrad vårdenhets mätvärde ändrar inte svaret | Inte kört | inte kört | inte kört |
| Formulär > förifyllnaden använder bara den egna vårdenhetens uppgifter utan aktiva val, texten har ingen vårdenhet, och källan visas bara för den som får se den | Inte kört | inte kört | inte kört |
| Formulär > ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen | Inte kört | inte kört | inte kört |

### 3.1.8.1 Sökfunktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Inte kört | inte kört | inte kört |
| API > sök på namn hittar namn med å, ä och ö oavsett skiftläge | Inte kört | inte kört | inte kört |
| API > sökningen loggas | Inte kört | inte kört | inte kört |
| Sökning i journalen > blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning | Inte kört | inte kört | inte kört |
| Sökning i journalen > en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen | Inte kört | inte kört | inte kört |
| Sökning i journalen > spärrade uppgifter: inga träffar, och svaret röjer inte att de finns, inte heller med nödåtkomst | Inte kört | inte kört | inte kört |
| Sökning i journalen > andra vårdenheters uppgifter söks först efter ett aktivt val, och svaret nämner dem inte per träff | Inte kört | inte kört | inte kört |
| Sökning i journalen > sökningen loggas som läsning med söktermen och antalet synliga träffar i syftet | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Söka i journalen och öppna träffen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.8.2 Sökmöjligheter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Inte kört | inte kört | inte kört |
| API > sök på namn hittar namn med å, ä och ö oavsett skiftläge | Inte kört | inte kört | inte kört |
| Sökning i journalen > blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning | Inte kört | inte kört | inte kört |
| Sökning i journalen > en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen | Inte kört | inte kört | inte kört |
| Sökning i journalen > en läkemedelsgrupp hittar ordinationen och anteckningar som nämner läkemedlet | Inte kört | inte kört | inte kört |
| Sökning i journalen > yrkesrollen: undersköterskan hittar omvårdnad men inte läkaranteckningar eller diagnoser, vårdadministratören nekas | Inte kört | inte kört | inte kört |
| Sökning i journalen > skyddad identitet: svaret innehåller varken namn eller personnummer | Inte kört | inte kört | inte kört |
| Sökning, filter och flera patienter > sökträffarna filtreras på typ, tid och vårdenhet, och filtren räknas bara på det som syns | Inte kört | inte kört | inte kört |
| Sökning, filter och flera patienter > ett filter på en spärrad vårdenhet ger samma svar som en vårdenhet utan träffar | Inte kört | inte kört | inte kört |
| Sökning, filter och flera patienter > samma sökfält söker över vårdenhetens patienter: en diagnos, ett läkemedel eller en grupp blir villkor | Inte kört | inte kört | inte kört |
| Sökning, filter och flera patienter > en patient utan vårdrelation, en spärrad vårdenhets uppgift och skyddad identitet följer behörigheten i sökningen över patienter | Inte kört | inte kört | inte kört |
| Sökning, filter och flera patienter > på vårdgivarnivå får uppföljningen antal utan personuppgifter, och andra roller nekas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Söka i journalen och öppna träffen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Söka bland vårdenhetens patienter på en diagnos inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.9.1 Utskriftsfunktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > utskriften har samma innehåll som gränssnittet, med utskrifts-id, syfte, vem och när | Inte kört | inte kört | inte kört |
| Utskrift > en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva ut läkemedelslistan vid utskrivning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.9.2 Spårbara och loggade utskrifter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra | Inte kört | inte kört | inte kört |
| Utskrift > spärrade uppgifter och andra vårdenheters uppgifter kommer inte med utan aktivt val eller samtycke, och utelämnandet sägs men röjs inte | Inte kört | inte kört | inte kört |

### 3.1.9.3 Utlämnande och återlämnande av journalhandlingar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet | Inte kört | inte kört | inte kört |
| Utskrift > ett utlämnande som inte har kommit tillbaka i tid hamnar i vårdenhetens inkorg | Inte kört | inte kört | inte kört |

### 3.1.9.4 Utskrifter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > syftet och delarna föreslås ur sammanhanget | Inte kört | inte kört | inte kört |
| Utskrift > skyddad identitet maskeras i utskriften och en avidentifierad utskrift saknar namn och personnummer | Inte kört | inte kört | inte kört |
| Utskrift > en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med | Inte kört | inte kört | inte kört |
| Utskrift, urval > ett datumintervall tar bara med poster från intervallet, och urvalet står i utskriften | Inte kört | inte kört | inte kört |
| Utskrift, urval > en enskild anteckning skrivs ut för sig, och loggen, posterna och kontrollsumman gäller just urvalet | Inte kört | inte kört | inte kört |
| Utskrift, urval > valda poster ur flera delar skrivs ut, och en post som inte syns för den inloggade avvisas utan att röja den | Inte kört | inte kört | inte kört |
| Utskrift, urval > förslaget erbjuder datumintervall och de poster som går att välja, och bara de som rollen får läsa | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva ut en enskild anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.9.5 Loggning och spårbarhet

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra | Inte kört | inte kört | inte kört |
| Utskrift > utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet | Inte kört | inte kört | inte kört |
| Utskrift, menprövning > menprövningen registreras strukturerat med beslut, grund och vem, och systemet föreslår grunden ur mottagaren | Inte kört | inte kört | inte kört |
| Utskrift, menprövning > logggranskaren söker utlämnanden på mottagare över alla patienter, och sökningen loggas | Inte kört | inte kört | inte kört |
| Utskrift, menprövning > sökningen på mottagare maskerar skyddad identitet | Inte kört | inte kört | inte kört |

### 3.1.10.1 Skanning och presentation av restjournaler

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Skannade restjournaler > systemet läser textlagret och föreslår dokumenttyp och period, och kontrollerar personnumret | Inte kört | inte kört | inte kört |
| Skannade restjournaler > skanningen sparar dokumentet med metadata, och samma fil eller fel patient stoppas | Inte kört | inte kört | inte kört |
| Skannade restjournaler > restjournalen visas i kronologin tillsammans med migrerad historik och ny dokumentation, och filen loggas | Inte kört | inte kört | inte kört |
| Skannade restjournaler > texten i restjournalen är sökbar i sökfältet i journalen | Inte kört | inte kört | inte kört |
| Skannade restjournaler > vårdadministratören skannar men läser inte, och fel roll och fel vårdenhet nekas | Inte kört | inte kört | inte kört |
| Skannade restjournaler > en spärrad vårdenhets restjournal syns inte och röjs inte, varken i listan, tidslinjen eller sökningen | Inte kört | inte kört | inte kört |
| Skannade restjournaler > ett dokument som skannats till fel patient makuleras med orsak, raderas inte och försvinner ur kronologin | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skanna in en restjournal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.10.2 Presentation skanning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Skannade restjournaler > systemet läser textlagret och föreslår dokumenttyp och period, och kontrollerar personnumret | Inte kört | inte kört | inte kört |
| Skannade restjournaler > skanningen sparar dokumentet med metadata, och samma fil eller fel patient stoppas | Inte kört | inte kört | inte kört |
| Skannade restjournaler > restjournalen visas i kronologin tillsammans med migrerad historik och ny dokumentation, och filen loggas | Inte kört | inte kört | inte kört |
| Skannade restjournaler > texten i restjournalen är sökbar i sökfältet i journalen | Inte kört | inte kört | inte kört |
| Skannade restjournaler > vårdadministratören skannar men läser inte, och fel roll och fel vårdenhet nekas | Inte kört | inte kört | inte kört |
| Skannade restjournaler > en spärrad vårdenhets restjournal syns inte och röjs inte, varken i listan, tidslinjen eller sökningen | Inte kört | inte kört | inte kört |
| Skannade restjournaler > ett dokument som skannats till fel patient makuleras med orsak, raderas inte och försvinner ur kronologin | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skanna in en restjournal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.11.1 Signeringsfunktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > signerad anteckning kan inte ändras via API-funktionen | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte raderas (trigger) | Inte kört | inte kört | inte kört |
| Journal > annan än författaren kan inte ändra eller signera utkast | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva och signera en daganteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.11.2 Signering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > signerad anteckning kan inte ändras via API-funktionen | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte raderas (trigger) | Inte kört | inte kört | inte kört |
| Journal > annan än författaren kan inte ändra eller signera utkast | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva och signera en daganteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Inte kört | inte kört | inte kört |
| Sussas testfall > Granska och signera alla: varje utkast signeras för sig och bara av författaren | Inte kört | inte kört | inte kört |
| Signering > en signering sparar en signatur över anteckningens innehåll med det simulerade SITHS-kortet, och den går att kontrollera | Inte kört | inte kört | inte kört |
| Signering > signeringslistan visar vårdenhetens osignerade poster per författare utan patientuppgifter | Inte kört | inte kört | inte kört |

### 3.1.11.3 Kontrasignering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontrasignering > systemet föreslår överläkaren och aldrig den som signerade, den som begär eller en underläkare | Inte kört | inte kört | inte kört |
| Kontrasignering > begäran hamnar i inkorgen och kontrasigneras med ett klick, och syns i FHIR | Inte kört | inte kört | inte kört |
| Kontrasignering > den som har signerat kan inte kontrasignera själv | Inte kört | inte kört | inte kört |
| Kontrasignering > en roll eller enhet utan behörighet nekas, och begäran ger ingen åtkomst utöver posten | Inte kört | inte kört | inte kört |
| Kontrasignering > spärrade uppgifter och andra vårdenheters uppgifter kan inte begäras kontrasignerade | Inte kört | inte kört | inte kört |
| Kontrasignering > ett provsvar kan begäras kontrasignerat, och en kontrasignering kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Begära kontrasignering av en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Kontrasignera en anteckning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.1.12.1 Dokumentation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Donation och transplantation > ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen att pröva donation | Inte kört | inte kört | inte kört |
| Donation och transplantation > checklistan bockas av där systemet kan, och den medicinska bedömningen får sitt underlag ur journalen | Inte kört | inte kört | inte kört |
| Donation och transplantation > närståendes uppgift om inställningen, checklistan klar, KVÅ för bedömningen och underlag till kvalitetsregistret | Inte kört | inte kört | inte kört |
| Donation och transplantation > donationsanteckningen skrivs av systemet ur checklistan, och läkaren signerar den | Inte kört | inte kört | inte kört |
| Donation och transplantation > en transplantation ger bidiagnos ur ICD-10-SE och uppmärksamhetsinformationen föreslår transplantat | Inte kört | inte kört | inte kört |
| Donation och transplantation > behörighet: fel roll, fel vårdenhet och spärr, och tidslinjen visar bara det som får ses | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Pröva donation efter ett dödsfall på intensivvården inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Donationsansvariga och avliden patient > förslaget går till de donationsansvariga som verksamhetschefen har utsett, och ett byte av uppdraget ändrar mottagaren | Inte kört | inte kört | inte kört |
| Donationsansvariga och avliden patient > dödsfallet märker patienten som avliden med datum i huvudet och i sökningen, och den simulerade folkbokföringen meddelas | Inte kört | inte kört | inte kört |
| Donationsansvariga och avliden patient > kommande tider avbokas med orsak och utan besked till patienten, och posterna på väntelistan avslutas | Inte kört | inte kört | inte kört |
| Donationsansvariga och avliden patient > nya bokningar, kallelser, påminnelser och sms till en avliden patient stoppas | Inte kört | inte kört | inte kört |
| Donationsansvariga och avliden patient > journalen för en avliden patient går fortfarande att läsa och dokumentera i | Inte kört | inte kört | inte kört |

### 3.2.1.1 Processtöd med integrerat kunskaps- och beslutsstöd

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varningarna är märkta som demoregler | Inte kört | inte kört | inte kört |
| Läkemedel > allvarlig varning måste kvitteras med motivering | Inte kört | inte kört | inte kört |
| Läkemedel > varning: warfarin och NSAID | Inte kört | inte kört | inte kört |
| Läkemedel > varning: metformin vid lågt eGFR | Inte kört | inte kört | inte kört |
| Kunskapsstöd > vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna | Inte kört | inte kört | inte kört |
| Kunskapsstöd > förslaget på standardplan har vårdförloppet och källan innan planen sätts upp | Inte kört | inte kört | inte kört |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Inte kört | inte kört | inte kört |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Inte kört | inte kört | inte kört |
| Kunskapsstöd > NEWS2 visas med vad poängen betyder och källan | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås | Inte kört | inte kört | inte kört |
| Vårdplan > systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.2.1.2 Processtöd med integrerat kunskaps- och kliniskt beslutsstöd

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varningarna är märkta som demoregler | Inte kört | inte kört | inte kört |
| Läkemedel > allvarlig varning måste kvitteras med motivering | Inte kört | inte kört | inte kört |
| Kunskapsstöd > vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna | Inte kört | inte kört | inte kört |
| Kunskapsstöd > förslaget på standardplan har vårdförloppet och källan innan planen sätts upp | Inte kört | inte kört | inte kört |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Inte kört | inte kört | inte kört |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Inte kört | inte kört | inte kört |
| Kunskapsstöd > NEWS2 visas med vad poängen betyder och källan | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > vid varningen visar systemet hur ofta den har kvitterats på vårdenheten | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > systemet avgör själv vilka doser en kollega kontrollerar: koncentrerade elektrolyter och Addex, opioider, insulin- och heparininfusion och cytostatika | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.2.1.3 Beslutsstödstrappan

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varning: överkänslighet med matchande ATC-prefix | Inte kört | inte kört | inte kört |
| Läkemedel > varning: metformin vid lågt eGFR | Inte kört | inte kört | inte kört |
| Läkemedel > varningarna är märkta som demoregler | Inte kört | inte kört | inte kört |
| Kunskapsstöd > vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna | Inte kört | inte kört | inte kört |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Inte kört | inte kört | inte kört |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > små tal visas aldrig, inte heller som skillnaden mellan två tal, och andra vårdenheters planer räknas inte | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > vid varningen visar systemet hur ofta den har kvitterats på vårdenheten | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > läkemedelsinformationen visar hur ofta substansen sätts ut inom 30 dagar på vårdenheten | Inte kört | inte kört | inte kört |

### 3.2.2.1 Standardiserade och individuella vårdplaner

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdplan > systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick | Inte kört | inte kört | inte kört |
| Vårdplan > en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas | Inte kört | inte kört | inte kört |
| Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.2.2.2 Stöd för vårdplaner

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdplan > systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick | Inte kört | inte kört | inte kört |
| Vårdplan > en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas | Inte kört | inte kört | inte kört |
| Vårdplan > åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena | Inte kört | inte kört | inte kört |
| Vårdplan > uppehåll, återupptagning, uppföljning och avslutning sparas i historiken, som inte kan ändras | Inte kört | inte kört | inte kört |
| Vårdplan > avvikelser från planen visas i översikten och uppföljningen bevakas i inkorgen | Inte kört | inte kört | inte kört |
| Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna | Inte kört | inte kört | inte kört |
| Vårdplan > tvångsvården föreslår vårdplanen enligt 16 § och uppgiften försvinner när planen finns | Inte kört | inte kört | inte kört |
| Vårdplan > FHIR: vårdplanen är en CarePlan med samma behörighet och loggning, och invånaren får den inte | Inte kört | inte kört | inte kört |

### 3.2.2.3 Följa patientens vårdprocess

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > migreringsavstämningen visar avvikelsen | Inte kört | inte kört | inte kört |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Inte kört | inte kört | inte kört |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| Sammanhållen journalföring > uppgifter från en annan vårdgivare hämtas först efter vårdrelation, samtycke och ett aktivt val | Inte kört | inte kört | inte kört |
| Sammanhållen journalföring > de hämtade uppgifterna visas i samma kronologi med vårdgivare, vårdenhet, yrkesroll och tid utskrivna, och kan sorteras och väljas | Inte kört | inte kört | inte kört |
| Sammanhållen journalföring > uppgifter som är spärrade hos den andra vårdgivaren hämtas aldrig, och systemet säger bara att det finns spärrade uppgifter hos en annan vårdgivare | Inte kört | inte kört | inte kört |
| Sammanhållen journalföring > nödåtkomst utan samtycke hämtar uppgifterna och loggas som nödåtkomst, men aldrig spärrade | Inte kört | inte kört | inte kört |
| Sammanhållen journalföring > valet gäller bara den person och vårdenhet som gjorde det och följer aldrig med till nästa inloggning eller uppdrag | Inte kört | inte kört | inte kört |
| Sammanhållen journalföring > varje hämtning loggas på patienten med vårdgivaren, och samtycket kan återkallas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Hämta uppgifter från en annan vårdgivare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.2.3.1 Dokumentation och uppföljning av psykiatrisk tvångsvård

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > fristerna räknas ur lagen: intagning inom 24 timmar, vårdintyg högst fyra dagar, ansökan före fyra veckor och vård i högst fyra månader | Inte kört | inte kört | inte kört |
| Tvångsvård > övergång från frivillig vård: beslut inom 24 timmar, underställning dagen efter och ansökan inom fyra dagar (11 och 12 §§) | Inte kört | inte kört | inte kört |
| Tvångsvård > utan ansökan i tid upphör tvångsvården av sig själv (28 §), och 26 a § låter den öppna vården kvarstå | Inte kört | inte kört | inte kört |
| Tvångsvård > tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO | Inte kört | inte kört | inte kört |
| Tvångsvård > rättspsykiatrisk vård: fyra månader utan särskild utskrivningsprövning och anmälan inom fyra månader med | Inte kört | inte kört | inte kört |
| Tvångsvård > läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten | Inte kört | inte kört | inte kört |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Inte kört | inte kört | inte kört |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera ett intagningsbeslut inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.2.3.2 Stöd för dokumentation av psykiatrisk tvångsvård

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten | Inte kört | inte kört | inte kört |
| Tvångsvård > beslutet nekas för den som saknar chefsöverläkarens uppdrag, och tvångsåtgärder kräver uppdraget utom under kvarhållningen | Inte kört | inte kört | inte kört |
| Tvångsvård > vårdintyget skickas av systemet till den psykiatriska vårdenheten och svaret röjer inget om andra uppgifter där | Inte kört | inte kört | inte kört |
| Tvångsvård > beslutsjournalen kan inte ändras eller raderas (trigger) | Inte kört | inte kört | inte kört |
| Tvångsvård > kontrollerna före intagningen: vårdintygets ålder, vem som utfärdade det och chefsöverläkarens uppdrag (6 b och 39 §§) | Inte kört | inte kört | inte kört |
| Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar | Inte kört | inte kört | inte kört |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Inte kört | inte kört | inte kört |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera ett intagningsbeslut inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.2.3.3 Psykiatrisk tvångsvård med parallella vårdprocesser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > parallella processer: den somatiska vården visas medan tvångsvården fortsätter | Inte kört | inte kört | inte kört |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Inte kört | inte kört | inte kört |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Inte kört | inte kört | inte kört |

### 3.2.3.4 Uppföljning av psykiatrisk tvångsvård

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > bevakningen på enhetsnivå sorterar på fristen och uppföljningen innehåller inga personuppgifter | Inte kört | inte kört | inte kört |
| Tvångsvård > inkorgen visar fristen för ansökan och uppgifterna för läkaren på den psykiatriska vårdenheten | Inte kört | inte kört | inte kört |
| Tvångsvård > tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO | Inte kört | inte kört | inte kört |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Inte kört | inte kört | inte kört |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Inte kört | inte kört | inte kört |

### 3.2.3.5 Högflödesmottagning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > väntrummet visar aldrig namn för skyddad patient | Inte kört | inte kört | inte kört |
| Akutmottagningen > ankomsten registreras med ett klick: könummer, akutbesök och tid sätts av systemet | Inte kört | inte kört | inte kört |
| Akutmottagningen > triagen räknar prioriteten ur vitalparametrarna och kontaktorsaken och förklarar varför | Inte kört | inte kört | inte kört |
| Akutmottagningen > flödestavlan visar patientens steg, planerade och utförda aktiviteter och ledtider, sorterade på prioritet och väntetid | Inte kört | inte kört | inte kört |
| Akutmottagningen > en aktivitet planeras och registreras som utförd med vem och när | Inte kört | inte kört | inte kört |
| Akutmottagningen > utregistreringen avslutar besöket, och överföringen till slutenvård skriver in patienten | Inte kört | inte kört | inte kört |
| Akutmottagningen > flödestavlan visar aldrig namn för en skyddad patient och bara könummer utanför akutmottagningen | Inte kört | inte kört | inte kört |
| Akutmottagningen > ledtiderna följs upp per prioritet utan patientuppgifter | Inte kört | inte kört | inte kört |
| Akutmottagningen > en förvarning från ambulansen tas emot och blir en ankomst med prehospitala uppgifter | Inte kört | inte kört | inte kört |
| Akutmottagningen > den direkta ankomsten tar bara patient och kontaktorsak från anropet, och ankomstsätt, prioritet, triage och prehospitala uppgifter ignoreras | Inte kört | inte kört | inte kört |
| Akutmottagningen > vårdrelationen uppstår bara när en annan person bekräftar den, också efter en förvarning, och bekräftelsen loggas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en ankomst på akutmottagningen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.3.1.1 Funktion för vårdbegäran

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat | Inte kört | inte kört | inte kört |
| Remiss > steg kan inte hoppas över | Inte kört | inte kört | inte kört |
| Remiss > ny remiss valideras | Inte kört | inte kört | inte kört |
| API > helflöde: remiss genom hela statuskedjan | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skicka remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.3.1.2 Vårdbegäran till och från externa vårdgivare

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss, del 3 > extern pappersremiss: registreras från en inskannad remiss med avsändare ur den simulerade HSA-katalogen eller som fritext och går in i samma flöde | Inte kört | inte kört | inte kört |
| Remiss, del 3 > extern pappersremiss: registreringen ger ingen läsrätt, den som registrerade tar inte emot och bedömer inte, och vårdrelationen uppstår när någon annan tar emot | Inte kört | inte kört | inte kört |
| Remiss, del 3 > extern pappersremiss: skyddad identitet maskeras och en spärr röjs inte, och registreringen ger ingen åtkomst till de spärrade uppgifterna | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en pappersremiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 3.3.1.3 Presentation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > seeden har remisser i varje läge och larm | Inte kört | inte kört | inte kört |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Inte kört | inte kört | inte kört |
| Remiss > vårdadministratör ser status men inte klinisk text | Inte kört | inte kört | inte kört |
| Remiss, del 2 > bilagor: typen avgörs ur innehållet, storleken kontrolleras, filen lagras på servern och varje hämtning loggas | Inte kört | inte kört | inte kört |
| Remiss, del 2 > vidarebefordran till en annan vårdenhet med motivering: systemet kvitterar mottagningen och avsändaren ser var remissen är | Inte kört | inte kört | inte kört |
| Egen vårdbegäran > invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten | Inte kört | inte kört | inte kört |
| Remiss, del 3 > på uppdrag: den som skriver ser aldrig remissens text eller läkarens anteckning, och bara den namngivna läkaren signerar | Inte kört | inte kört | inte kört |
| Remiss, del 3 > fördelning: en inkommande remiss fördelas till en namngiven läkare med två klick, systemet kvitterar mottagningen och läkaren får den i inkorgen | Inte kört | inte kört | inte kört |
| Remiss, del 3 > remisskonferens: systemet sätter remissen på nästa konferens, läkaren bedömer i följd och vårdadministratören registrerar beslut på uppdrag med läkaren som ansvarig | Inte kört | inte kört | inte kört |
| Remiss, del 3 > extern pappersremiss: registreras från en inskannad remiss med avsändare ur den simulerade HSA-katalogen eller som fritext och går in i samma flöde | Inte kört | inte kört | inte kört |
| Remiss, del 4 > konsultation: typen väljs när remissen skapas och följer med utkast, återanvändning, på uppdrag och vidarebefordran | Inte kört | inte kört | inte kört |
| Remiss, del 4 > konsultation: mottagaren svarar direkt med ett konsultationssvar, systemet kvitterar mottagning och bedömning och vårdansvaret stannar hos remittenten | Inte kört | inte kört | inte kört |
| Remiss, del 4 > översikt: remisserna filtreras på typ, status, prioritet och tid, och antalet per val räknar bara det som visas för den egna vårdenheten | Inte kört | inte kört | inte kört |
| Remiss, del 4 > översikt: perioden räknas från en fast tid och intervallet följer svensk tid | Inte kört | inte kört | inte kört |
| Remiss, del 4 > beslut på uppdrag: hamnar i den ansvariga läkarens inkorg och kvitteras av läkaren i egen inloggning | Inte kört | inte kört | inte kört |

### 3.3.1.4 Upprättande

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > ny remiss valideras | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skicka remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| API > helflöde: remiss genom hela statuskedjan | Inte kört | inte kört | inte kört |
| Remiss, del 2 > ett utkast fylls i av systemet, kan sparas och ändras av den som skrev det och skickas när det är klart | Inte kört | inte kört | inte kört |
| Remiss, del 2 > ett utkast kan återanvända en tidigare remiss som användaren får läsa | Inte kört | inte kört | inte kört |
| Remiss, del 2 > bilagor: typen avgörs ur innehållet, storleken kontrolleras, filen lagras på servern och varje hämtning loggas | Inte kört | inte kört | inte kört |
| Remiss, del 2 > avsändaren kompletterar en skickad remiss med en bilaga, men inte efter svaret och inte från en annan vårdenhet | Inte kört | inte kört | inte kört |
| Remiss, del 3 > på uppdrag: vårdadministratören skriver remissen med en läkare som remittent, systemet föreslår läkaren och remissen skickas när läkaren har signerat i inkorgen | Inte kört | inte kört | inte kört |
| Remiss, del 3 > på uppdrag: den som skriver ser aldrig remissens text eller läkarens anteckning, och bara den namngivna läkaren signerar | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva en remiss på uppdrag av en läkare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Remiss, del 4 > konsultation: typen väljs när remissen skapas och följer med utkast, återanvändning, på uppdrag och vidarebefordran | Inte kört | inte kört | inte kört |
| Remiss, del 4 > konsultation: en ServiceRequest med kategorin konsultation skapar en konsultation genom FHIR, och utan kategori blir det en remiss | Inte kört | inte kört | inte kört |
| Remiss, del 4 > bilagor: storleken och antalet är parametrar som systemförvaltaren sätter, med demons gränser som förval | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skicka en konsultation inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.3.1.5 Mottagande och svar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > bara mottagande enhet kan kvittera, bedöma och svara | Inte kört | inte kört | inte kört |
| Remiss > avvisning kräver motivering och avslutar kedjan | Inte kört | inte kört | inte kört |
| Remiss > bara avsändaren kan kvittera svaret | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Kvittera remissvar inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Remiss, del 2 > vidarebefordran till en annan vårdenhet med motivering: systemet kvitterar mottagningen och avsändaren ser var remissen är | Inte kört | inte kört | inte kört |
| Remiss, del 2 > avsändaren kompletterar en skickad remiss med en bilaga, men inte efter svaret och inte från en annan vårdenhet | Inte kört | inte kört | inte kört |
| Remiss, del 3 > fördelning: en inkommande remiss fördelas till en namngiven läkare med två klick, systemet kvitterar mottagningen och läkaren får den i inkorgen | Inte kört | inte kört | inte kört |
| Remiss, del 3 > besök inom: en accepterad remiss hamnar på väntelistan med den tidsram som läkaren väljer | Inte kört | inte kört | inte kört |
| Remiss, del 3 > remisskonferens: nästa konferens är tisdag eller torsdag klockan 8 och räknas från en fast tid | Inte kört | inte kört | inte kört |
| Remiss, del 3 > remisskonferens: systemet sätter remissen på nästa konferens, läkaren bedömer i följd och vårdadministratören registrerar beslut på uppdrag med läkaren som ansvarig | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Fördela en remiss till en läkare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Remiss, del 4 > konsultation: mottagaren svarar direkt med ett konsultationssvar, systemet kvitterar mottagning och bedömning och vårdansvaret stannar hos remittenten | Inte kört | inte kört | inte kört |
| Remiss, del 4 > beslut på uppdrag: hamnar i den ansvariga läkarens inkorg och kvitteras av läkaren i egen inloggning | Inte kört | inte kört | inte kört |
| Remiss, del 4 > beslut på uppdrag: läkaren som inte håller med öppnar remissen igen för egen bedömning, och väntelistans post avslutas | Inte kört | inte kört | inte kört |

### 3.3.1.6 Uppföljning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Inte kört | inte kört | inte kört |
| Remiss > larm: svar saknas efter sista svarsdatum | Inte kört | inte kört | inte kört |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Inte kört | inte kört | inte kört |
| Remiss, del 2 > ledtider och avvikelser per vårdenhet och för regionen, utan personuppgifter | Inte kört | inte kört | inte kört |

### 3.3.2.1 Egen vårdbegäran

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Egen vårdbegäran > invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten | Inte kört | inte kört | inte kört |
| Egen vårdbegäran > vid tecken på akuta besvär hänvisar systemet till 112, och en invånare kan ha högst tre öppna vårdbegäranden | Inte kört | inte kört | inte kört |

### 3.4.1.1 Patientplanering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > en accepterad remiss hamnar på väntelistan av sig själv med tidstyp, yrkesroll, prioritet och vårdgaranti som demoregel | Inte kört | inte kört | inte kört |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Inte kört | inte kört | inte kört |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Inte kört | inte kört | inte kört |
| Tidbok > väntelistan lyfter den som riskerar att passera gränsen, och omprioritering kräver orsak och sparas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Återbesök > planeringen i texten tolkas: tidstyp, yrkesroll och tidsram | Inte kört | inte kört | inte kört |
| Återbesök > systemet föreslår återbesöket ur anteckningens planering, och läkaren sätter upp det med ett klick | Inte kört | inte kört | inte kört |
| Återbesök > utan planering i texten föreslår systemet ur diagnosen och den senaste kontakten, och läkaren kan ändra förslaget | Inte kört | inte kört | inte kört |
| Återbesök > säkerhet: skriv_journal och vårdrelation på egen vårdenhet krävs, och anteckningar som inte får läsas används inte | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta upp ett återbesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Vårdhändelse i tidboken > utan bokning hamnar vårdhändelsen på väntelistan, och vårdadministratören bokar den som vanligt i Dagens arbete | Inte kört | inte kört | inte kört |

### 3.4.1.2 Resursplanering kopplad till patient

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > seeden har scheman per mottagning och vårdgivare med tidstyper, och dagens patienter på kardiologiska mottagningen | Inte kört | inte kört | inte kört |
| Tidbok > tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn | Inte kört | inte kört | inte kört |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Inte kört | inte kört | inte kört |
| Planering > seeden har lokaler, utrustning och en simulerad sjukresa som resurser, och tidstypen ingrepp med vad den kräver | Inte kört | inte kört | inte kört |
| Planering > systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt | Inte kört | inte kört | inte kört |
| Planering > ombokning flyttar rum, utrustning och sjukresa, och avbokning släpper dem | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka elkonvertering med rum och utrustning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Bokning, del 3 > teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna | Inte kört | inte kört | inte kört |
| Bokning, del 3 > teambesök: färre än två vårdgivare eller en vårdgivare från en annan vårdenhet nekas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka ett teambesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.1.3 Åtgärder och bevakningar på individ- och enhetsnivå

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Inte kört | inte kört | inte kört |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Inte kört | inte kört | inte kört |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Inte kört | inte kört | inte kört |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Inte kört | inte kört | inte kört |
| Planering > egna bevakningar på individ- och enhetsnivå med datum och ansvarig syns i Dagens arbete och inkorgen | Inte kört | inte kört | inte kört |
| Planering > egna bevakningar: utan vårdrelation, med fel ansvarig eller på en annan vårdenhet nekas, och skyddad identitet maskeras | Inte kört | inte kört | inte kört |

### 3.4.1.4 Patientplanering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Inte kört | inte kört | inte kört |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Inte kört | inte kört | inte kört |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Återbesök > systemet föreslår återbesöket ur anteckningens planering, och läkaren sätter upp det med ett klick | Inte kört | inte kört | inte kört |
| Återbesök > utan planering i texten föreslår systemet ur diagnosen och den senaste kontakten, och läkaren kan ändra förslaget | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta upp ett återbesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Planering > provtagning före läkarbesök: systemet föreslår tiderna i följd med rätt mellanrum och bokar båda med ett klick | Inte kört | inte kört | inte kört |
| Planering > tider i följd: ombokning flyttar provtagningen med, och avbokning avbokar båda | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka provtagning före läkarbesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Arbetsdagen på mottagningarna (runda 13, r4) > mitt på dagen har några patienter kommit och några väntas | Inte kört | inte kört | inte kört |
| Arbetsdagen på mottagningarna (runda 13, r4) > en ankomst som registreras i efterhand räknas från den bokade tiden | Inte kört | inte kört | inte kört |

### 3.4.1.5 Kapacitets- och resursplanering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn | Inte kört | inte kört | inte kört |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Inte kört | inte kört | inte kört |
| Planering > systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt | Inte kört | inte kört | inte kört |
| Planering > tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter | Inte kört | inte kört | inte kört |
| Planering > seeden har lokaler, utrustning och en simulerad sjukresa som resurser, och tidstypen ingrepp med vad den kräver | Inte kört | inte kört | inte kört |
| Bokning, del 3 > teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna | Inte kört | inte kört | inte kört |
| Bokning, del 3 > gruppträff: platser kvar, kallelser som går ut för hela gruppen och direkt för den som läggs till efteråt | Inte kört | inte kört | inte kört |
| Bokning, del 3 > gruppträff: en full träff ger plats på gruppens väntelista, och systemet föreslår den som har väntat längst | Inte kört | inte kört | inte kört |
| Avdelningens planering > patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4) | Inte kört | inte kört | inte kört |
| Kapacitet och prognos > veckor med lediga tider, väntelistan och inkomna remisser ger en prognos för när kön är borta | Inte kört | inte kört | inte kört |
| Kapacitet och prognos > patienter som riskerar att passera gränsen ger förslag på fler tider, och lokaler och utrustning visas per vecka | Inte kört | inte kört | inte kört |
| Kapacitet och prognos > översikten har inga patientuppgifter och är bara för vårdadministratören | Inte kört | inte kört | inte kört |
| Kontorsstöd > rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Se vårdenhetens kapacitet och prognos för väntelistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.1.6 Presentation av planering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn | Inte kört | inte kört | inte kört |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Inte kört | inte kört | inte kört |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Inte kört | inte kört | inte kört |
| Planering > anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen | Inte kört | inte kört | inte kört |
| Planering > Dagens arbete visar en fritt vald tidsperiod | Inte kört | inte kört | inte kört |
| Planering > tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter | Inte kört | inte kört | inte kört |
| Avdelningens planering > dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2) | Inte kört | inte kört | inte kört |
| Avdelningens planering > patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4) | Inte kört | inte kört | inte kört |
| Avdelningens planering > en bokad tid på en annan vårdenhet syns inte utan aktivt val, och svaret är detsamma med och utan den | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Överblicka dagens händelser på avdelningen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 3.4.1.7 Hantering av väntelista

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > väntelistan lyfter den som riskerar att passera gränsen, och omprioritering kräver orsak och sparas | Inte kört | inte kört | inte kört |
| Tidbok > en accepterad remiss hamnar på väntelistan av sig själv med tidstyp, yrkesroll, prioritet och vårdgaranti som demoregel | Inte kört | inte kört | inte kört |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Inte kört | inte kört | inte kört |
| Planering > väntetidsstatistik per vårdenhet utan personuppgifter, med vårdgarantin som demoregel | Inte kört | inte kört | inte kört |
| Väntelistan (runda 13, r4, E3-8 och E3-9) > vårdgarantin har en egen kolumn, och väntan som patienten väljer eller som har medicinska skäl räknas inte | Inte kört | inte kört | inte kört |
| Väntelistan (runda 13, r4, E3-8 och E3-9) > en post tas bort från väntelistan med en orsak, och bara av vårdenheten själv | Inte kört | inte kört | inte kört |

### 3.4.1.8 Aktivitetslista

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > arbetslista maskerar skyddad identitet | Inte kört | inte kört | inte kört |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Öppna patient från arbetslistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Checka in en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Planering > Dagens arbete visar en fritt vald tidsperiod | Inte kört | inte kört | inte kört |
| Planering > egna bevakningar på individ- och enhetsnivå med datum och ansvarig syns i Dagens arbete och inkorgen | Inte kört | inte kört | inte kört |
| Avdelningens planering > dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2) | Inte kört | inte kört | inte kört |
| Avdelningens planering > systemet avgör typ, yrkesroll, längd och tid ur texten när en uppgift planeras, och undersköterskan registrerar att den är utförd | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Överblicka dagens händelser på avdelningen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.2.1 Bokning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Inte kört | inte kört | inte kört |
| Tidbok > ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse | Inte kört | inte kört | inte kört |
| Tidbok > avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten | Inte kört | inte kört | inte kört |
| Tidbok > behörighet: bara vårdadministratören bokar, kallar, checkar in och hanterar väntelistan | Inte kört | inte kört | inte kört |
| Tidbok > utan vårdrelation eller remiss nekas bokningen, och en annan vårdenhets tidbok går inte att använda | Inte kört | inte kört | inte kört |
| Tidbok, säkerhetsgranskning > en bokning ger inte bestående vårdrelation när remissen avvisas: tiden avbokas och patienten får besked | Inte kört | inte kört | inte kört |
| Tidbok, säkerhetsgranskning > en planerad kontakt ger vårdrelation bara till 90 dagar efter tiden | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka om en tid inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Bokning, del 3 > fri bokning: systemet väljer besökstyp, vårdgivare och tider, och bokningen skapar vårdkontakten och kallelsen | Inte kört | inte kört | inte kört |
| Bokning, del 3 > fri bokning: utan vårdrelation, fel roll, en annan vårdenhets tid och en gruppträff nekas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka en patient fritt inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 3.4.2.2 Bokning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Inte kört | inte kört | inte kört |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Inte kört | inte kört | inte kört |
| Tidbok > ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse | Inte kört | inte kört | inte kört |
| Tidbok > avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten | Inte kört | inte kört | inte kört |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka om en tid inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Planering > systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt | Inte kört | inte kört | inte kört |
| Planering > provtagning före läkarbesök: systemet föreslår tiderna i följd med rätt mellanrum och bokar båda med ett klick | Inte kört | inte kört | inte kört |
| Planering > tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka elkonvertering med rum och utrustning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka provtagning före läkarbesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Bokning, del 3 > fri bokning: systemet väljer besökstyp, vårdgivare och tider, och bokningen skapar vårdkontakten och kallelsen | Inte kört | inte kört | inte kört |
| Bokning, del 3 > teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna | Inte kört | inte kört | inte kört |
| Bokning, del 3 > gruppträff: platser kvar, kallelser som går ut för hela gruppen och direkt för den som läggs till efteråt | Inte kört | inte kört | inte kört |
| Bokning, del 3 > gruppträff: en full träff ger plats på gruppens väntelista, och systemet föreslår den som har väntat längst | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka en patient fritt inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Boka ett teambesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lägga till en patient i en gruppträff inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > en inskriven patient får förslag från några dagar efter i dag, med hans kommande tider på vårdenheten | Inte kört | inte kört | inte kört |
| Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > systemet föreslår inte en tid som ett brev inte hinner fram till, och ett brev till en för nära tid skickas inte | Inte kört | inte kört | inte kört |

### 3.4.2.3 Egenbokning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Inte kört | inte kört | inte kört |
| Tidbok > egenbokning stängs 24 timmar före tiden och för tidstyper som mottagningen inte öppnar | Inte kört | inte kört | inte kört |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Patienten bokar om sin tid i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Tidbok, egenbokning > patientens egenbokning gäller bara återbesök, telefon och video, aldrig nybesök | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > en tid som styr en läkemedelsdos kan patienten inte boka om själv i Min journal | Inte kört | inte kört | inte kört |
| Ombud > patienten ger fullmakt i Min journal, och ombudet bokar, bokar om och avbokar patientens tider med loggning på patienten | Inte kört | inte kört | inte kört |
| Ombud > ombudet når aldrig journalen, och en återkallad eller utgången fullmakt ger ingen åtkomst | Inte kört | inte kört | inte kört |
| Ombud > vårdadministratören registrerar en skriftlig fullmakt, och fullmakten prövas mot ålder, dubbletter och tak | Inte kört | inte kört | inte kört |
| Ombud > patientens logglista visar ombudets åtgärder som ombud, och vården ser vem som bokade | Inte kört | inte kört | inte kört |
| Ombud > meddelanden för ett ombud visar och tar aldrig emot läkemedel, vårdplaner eller vad en tråd gäller ur journalen | Inte kört | inte kört | inte kört |
| Ombud > trådar som gäller en ordination eller en vårdplan finns inte för ombudet, inte heller i räknare, läsmarkering och svar | Inte kört | inte kört | inte kört |
| Ombud > en fullmakt i Min journal röjer aldrig vem ett personnummer tillhör, skyddad identitet registreras bara av personal, och försöken har ett tak | Inte kört | inte kört | inte kört |
| Ombud > en fullmakt från Min journal gäller först när ombudet har godkänt den, och svaret är detsamma för alla nummer som inte kan bli ombud | Inte kört | inte kört | inte kört |
| Ombud > registreringar och återkallelser har ett tak per dygn, ett ombud kan avböja och en skriftlig fullmakt hos vården gäller direkt | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka en tid för patienten som ombud inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.3.1 Kommunikationsalternativ för kallelse och påminnelse

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Inte kört | inte kört | inte kört |
| Tidbok > påminnelsen skickas automatiskt två dagar före tiden | Inte kört | inte kört | inte kört |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Inte kört | inte kört | inte kört |
| Tidbok, säkerhetsgranskning > kallelsetexten och adressen för en patient med skyddade personuppgifter visas inte för personalen | Inte kört | inte kört | inte kört |
| Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > systemet föreslår inte en tid som ett brev inte hinner fram till, och ett brev till en för nära tid skickas inte | Inte kört | inte kört | inte kört |

### 3.4.3.2 Kallelse och påminnelse på individ- och gruppnivå

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Inte kört | inte kört | inte kört |
| Tidbok > gruppkallelse skickar en kallelse till varje deltagare och loggas per patient | Inte kört | inte kört | inte kört |
| Tidbok > exemplet på gruppkallelsen skrivs ur en mall och aldrig ur en sparad kallelse till en patient | Inte kört | inte kört | inte kört |
| Tidbok > påminnelsen skickas automatiskt två dagar före tiden | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skicka en gruppkallelse inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.3.3 Kallelse och påminnelse

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Inte kört | inte kört | inte kört |
| Tidbok > påminnelsen skickas automatiskt två dagar före tiden | Inte kört | inte kört | inte kört |
| Tidbok > ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse | Inte kört | inte kört | inte kört |
| Tidbok > avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten | Inte kört | inte kört | inte kört |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Inte kört | inte kört | inte kört |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Inte kört | inte kört | inte kört |
| Tidbok > gruppkallelse skickar en kallelse till varje deltagare och loggas per patient | Inte kört | inte kört | inte kört |
| Kallelser, del 2 > kallelsen skrivs på patientens språk, och patienten väljer språk i Min journal | Inte kört | inte kört | inte kört |
| Kallelser, del 2 > kallelsen som PDF och iCalendar för personalen och för patienten i Min journal, och varje hämtning loggas | Inte kört | inte kört | inte kört |
| Kallelser, del 2 > kallelsen som PDF för en patient med skyddade personuppgifter kräver Visa identitet och har aldrig adress | Inte kört | inte kört | inte kört |
| Kallelser, del 2 > kallelse utan förbokad tid: patienten väljer själv en tid i Min journal inom ramen som systemet sätter | Inte kört | inte kört | inte kört |

### 3.4.4.1 Registrering av vårdkontakt och betalning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget | Inte kört | inte kört | inte kört |
| Vårdkontakt > patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera ett besök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Tidbok > incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften | Inte kört | inte kört | inte kört |
| Tidbok > betalningen räknas av systemet: kort, faktura, frikort och avgiftsfrihet, simulerad och märkt | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Checka in en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Kassan > betalning i den simulerade terminalen och återbetalning med kvitto samma väg, en gång | Inte kört | inte kört | inte kört |
| Kassan > kassaredovisning per kassör och betalsätt och dagsavslut som inte kan ändras, med avstämning mot terminalen | Inte kört | inte kört | inte kört |
| Kassan > fel roll och en annan vårdenhet nekas, avgifter för tjänster finns inte i kassan, och redovisningen har inga patientuppgifter | Inte kört | inte kört | inte kört |
| Kontorsstöd > rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Göra dagsavslut i kassan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.4.2 Incheckning som patienten gör själv

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Inte kört | inte kört | inte kört |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Inte kört | inte kört | inte kört |
| Tidbok > incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften | Inte kört | inte kört | inte kört |
| Tidbok, säkerhetsgranskning > incheckningsskärmen visar inte avgiften och stoppar många försök | Inte kört | inte kört | inte kört |

### 3.4.4.3 Registrering av vårdkontakt/er

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget | Inte kört | inte kört | inte kört |
| Vårdkontakt > planerad kontakt på distans, och ankomsten registreras på den planerade | Inte kört | inte kört | inte kört |
| Vårdkontakt > kontaktorsak krävs bara när systemet inte kan föreslå den | Inte kört | inte kört | inte kört |
| Vårdkontakt > den som dokumenterar kan ändra kontakten som systemet skapade, men inte en annan enhets | Inte kört | inte kört | inte kört |
| Vårdkontakt > yrkesrollen avgör vem som registrerar kontakter och vem som skriver in och ut | Inte kört | inte kört | inte kört |
| Vårdkontakt > vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera ett besök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Planera ett videobesök inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva in en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Arbetsdagen på mottagningarna (runda 13, r4) > en ankomst som registreras i efterhand räknas från den bokade tiden | Inte kört | inte kört | inte kört |

### 3.4.4.4 Stöd vid betalning av patientavgifter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler | Inte kört | inte kört | inte kört |
| Tidbok > betalningen räknas av systemet: kort, faktura, frikort och avgiftsfrihet, simulerad och märkt | Inte kört | inte kört | inte kört |
| Tidbok > incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften | Inte kört | inte kört | inte kört |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras | Inte kört | inte kört | inte kört |
| Ekonomi: avgiften visas som e-frikortet > i vårdkontaktslistan och tidbokens betalning skiljer sig svaret med och utan dolda besök bara i beloppet och frikortsstatusen | Inte kört | inte kört | inte kört |
| Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det | Inte kört | inte kört | inte kört |
| Kassan > avgiften för receptförnyelse och intyg räknas av systemet ur ålder, LMA-kort, frikort och intygstyp | Inte kört | inte kört | inte kört |
| Kassan > om receptförnyelse och intyg ingår i högkostnadsskyddet är en parameter per avgiftstyp som systemförvaltaren sätter, med nej som förval | Inte kört | inte kört | inte kört |
| Kassan > personalens svar i meddelandet, kassan, återbetalningen och dagsavslutet är desamma med och utan en dold avgift, och patienten ser och betalar det riktiga beloppet | Inte kört | inte kört | inte kört |
| Kassan > betalning i den simulerade terminalen och återbetalning med kvitto samma väg, en gång | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten | Inte kört | inte kört | inte kört |
| Kassan > patienten betalar en avgift för en tjänst i Min journal, och ett ombud ser den inte | Inte kört | inte kört | inte kört |
| Kassan > fel roll och en annan vårdenhet nekas, avgifter för tjänster finns inte i kassan, och redovisningen har inga patientuppgifter | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Förnya ett recept som patienten har bett om i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.4.4.5 Incheckning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Inte kört | inte kört | inte kört |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Inte kört | inte kört | inte kört |
| Tidbok > FHIR: Schedule, Slot och Appointment med status för incheckning och samma behörighet och loggning | Inte kört | inte kört | inte kört |
| Tidbok > FHIR: invånaren ser bara sina egna Appointment | Inte kört | inte kört | inte kört |
| FHIR-incheckning > personalen checkar in med PATCH på Appointment med samma behörighet som gränssnittet, och det loggas | Inte kört | inte kört | inte kört |
| FHIR-incheckning > invånaren checkar in sin egen tid med PATCH, bara när incheckningen är öppen | Inte kört | inte kört | inte kört |
| FHIR-incheckning > Encounter-status arrived registrerar ankomsten på den planerade vårdkontakten | Inte kört | inte kört | inte kört |
| FHIR-incheckning > fel roll, en annan vårdenhet och andra ändringar än status nekas | Inte kört | inte kört | inte kört |

### 3.5.1.1 Läkemedelsbehandling genom vårdprocesser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Inte kört | inte kört | inte kört |
| Läkemedel > utsättning kräver orsak och inget raderas | Inte kört | inte kört | inte kört |
| API > helflöde: ordination med varning, kvittens och NLL som inte svarar i tid, med avstämning | Inte kört | inte kört | inte kört |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Inte kört | inte kört | inte kört |
| Administrering > permission: doser under permission lämnas över till patienten | Inte kört | inte kört | inte kört |
| Läkemedelsöverföring > systemet väljer mottagarna själv: vårdcentralen där patienten är listad och kommunen när en samordnad planering pågår | Inte kört | inte kört | inte kört |
| Läkemedelsöverföring > läkemedelsberättelsen, läkemedelslistan och epikrisen skickas med ett klick, och mottagaren ser och kvitterar dem | Inte kört | inte kört | inte kört |
| Läkemedelsöverföring > spärrade ordinationer skickas aldrig, och en spärr på den egna vårdenheten kräver patientens samtycke innan något skickas | Inte kört | inte kört | inte kört |
| Läkemedelsöverföring > bara en läkare med vårdrelation skickar, och bara mottagaren och avsändaren ser överföringen | Inte kört | inte kört | inte kört |
| Läkemedelsöverföring > kommunen ser bara läkemedelslistan och berättelsen som har skickats till den | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > en opioid iordningsställs, kontrolleras av en kollega i sin egen inloggning och ges, och en dos som inte är kontrollerad stoppas med en förklaring | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > den som iordningsställde kan inte kontrollera själv, och en undersköterska eller en annan vårdenhet kan inte kontrollera | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > en infusion med Addex-tillsats bereds och kontrolleras av en kollega innan den ges | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > systemförvaltaren styr grupperna som parametrar med fyra ögon, och en avstängd grupp kontrolleras inte | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > den sparade kontrollen avgör: ett annat läkemedel eller en annan ordination i anropet, eller en avstängd parameter, öppnar inte en okontrollerad dos | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > inkorgen visar antalet doser som väntar på kontroll utan patientuppgifter, och aldrig den egna dosen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skicka läkemedelsberättelsen till nästa vårdgivare inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.1.2 Läkemedelsinformation i vyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Inte kört | inte kört | inte kört |
| Läkemedel > spärrade enheters ordinationer visas inte i läkemedelslistan | Inte kört | inte kört | inte kört |
| Administrering > dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider | Inte kört | inte kört | inte kört |
| Vyer för läkemedel > dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag | Inte kört | inte kört | inte kört |
| Vyer för läkemedel > läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning | Inte kört | inte kört | inte kört |

### 3.5.1.3 Fördefinierade ordinationer och förskrivningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Fördefinierade ordinationer > fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient | Inte kört | inte kört | inte kört |
| Mallar med flera ordinationer > läkaren ordinerar ur en mall: systemet fyller i allt, varnar per ordination och tar själv bort ett läkemedel som patienten redan har | Inte kört | inte kört | inte kört |
| Mallar med flera ordinationer > ordinationerna i mallen knyts till samma planerade vårdhändelse och en annan allvarlig varning kräver motivering | Inte kört | inte kört | inte kört |
| Mallar med flera ordinationer > säkerhet: mallen gäller bara sin vårdenhet, sjuksköterskan ordinerar inte ur mallar, bara läkare upprättar en mall och den används först när den är godkänd | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ordinera från en mall med flera ordinationer inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Godkännande av läkemedelsmallar > mallansvarig läkare godkänner en ändrad mall från inkorgen: den gamla används tills den nya är godkänd, och historiken sparas | Inte kört | inte kört | inte kört |
| Godkännande av läkemedelsmallar > säkerhet: bara den mallansvariga läkaren på vårdenheten godkänner, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Godkännande av läkemedelsmallar > en ändrad läkemedelsmall per substans kräver nytt godkännande per vårdenhet, och förslaget använder den godkända versionen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Godkänna en ändrad läkemedelsmall inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Doseringsmallar per produkt > Alvedon forte 1 g och paracetamol som infusion får egna förslag ur produkten, inte tablettdosen för 500 mg | Inte kört | inte kört | inte kört |
| Doseringsmallar per produkt > en annan styrka i samma form får samma antal tabletter och dosen ur styrkan, och en annan form får inte substansens mall | Inte kört | inte kört | inte kört |

### 3.5.1.4 Korrekt spädning och tillsatser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Spädning och tillsatser > systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet | Inte kört | inte kört | inte kört |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Inte kört | inte kört | inte kört |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Inte kört | inte kört | inte kört |
| Tillsatser i infusion > glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans | Inte kört | inte kört | inte kört |
| Beredning med kontroll och etikett > en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges | Inte kört | inte kört | inte kört |
| Beredning med kontroll och etikett > beredningen följer ordinationen: fel lösning, gången förpackning och passerad hållbarhet stoppas med en förklaring, och en skannad förpackning fyller i batch och utgångsdatum | Inte kört | inte kört | inte kört |
| Beredning och skanning via API > API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning | Inte kört | inte kört | inte kört |

### 3.5.1.5 Kunskaps- och kliniskt beslutsstöd vid läkemedelshantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varning: överkänslighet med matchande ATC-prefix | Inte kört | inte kört | inte kört |
| Läkemedel > varning: dubbelordination av samma substans | Inte kört | inte kört | inte kört |
| Läkemedel > varning: samma ATC-grupp ger observera | Inte kört | inte kört | inte kört |
| Läkemedel > varning: warfarin och NSAID | Inte kört | inte kört | inte kört |
| Läkemedel > varning: två antikoagulantia | Inte kört | inte kört | inte kört |
| Läkemedel > varning: metformin vid lågt eGFR | Inte kört | inte kört | inte kört |
| Läkemedel > allvarlig varning måste kvitteras med motivering | Inte kört | inte kört | inte kört |
| Läkemedel > varningarna är märkta som demoregler | Inte kört | inte kört | inte kört |
| Administrering > varning: dubbel dos | Inte kört | inte kört | inte kört |
| Administrering > varning: given dos utan ordination | Inte kört | inte kört | inte kört |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Inte kört | inte kört | inte kört |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Inte kört | inte kört | inte kört |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Inte kört | inte kört | inte kört |
| Kunskapsstöd > läkemedelsinformationen räknar inte med ett eGFR från en spärrad vårdenhet och kräver behörighet att läsa läkemedel | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > vid varningen visar systemet hur ofta den har kvitterats på vårdenheten | Inte kört | inte kört | inte kört |
| Kunskapsgenererande stöd > läkemedelsinformationen visar hur ofta substansen sätts ut inom 30 dagar på vårdenheten | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > systemet avgör själv vilka doser en kollega kontrollerar: koncentrerade elektrolyter och Addex, opioider, insulin- och heparininfusion och cytostatika | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > en opioid iordningsställs, kontrolleras av en kollega i sin egen inloggning och ges, och en dos som inte är kontrollerad stoppas med en förklaring | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > systemförvaltaren styr grupperna som parametrar med fyra ögon, och en avstängd grupp kontrolleras inte | Inte kört | inte kört | inte kört |
| Kollegakontroll av högriskläkemedel > den sparade kontrollen avgör: ett annat läkemedel eller en annan ordination i anropet, eller en avstängd parameter, öppnar inte en okontrollerad dos | Inte kört | inte kört | inte kört |

### 3.5.1.6 Läkemedelsgenomgång

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedelsgenomgång > läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken | Inte kört | inte kört | inte kört |
| Fördjupad läkemedelsgenomgång > läkaren startar, farmaceuten föreslår åtgärder, patientens medverkan registreras och läkaren beslutar med det som 11 kap. kräver | Inte kört | inte kört | inte kört |
| Fördjupad läkemedelsgenomgång > säkerhet: sjuksköterskan startar inte, nödåtkomst ger ingen genomgång och patientens frånvaro ska motiveras | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av läkemedelsprocessen del 2 > en fördjupad genomgång och en utvärdering sparar aldrig en spärrad vårdenhets läkemedel, inte ens med samtycke | Inte kört | inte kört | inte kört |

### 3.5.1.7 Nationella vaccinationsprogram

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Barnhälsovårdens program > besöken och vaccinationerna följer barnets ålder, och systemet säger varför en dos inte kan ges | Inte kört | inte kört | inte kört |
| Barnhälsovårdens program > vaccinationen prövas mot programmet och får ATC och dos av systemet | Inte kört | inte kört | inte kört |
| Barnhälsovårdens program > före varje dos frågar systemet alltid om vaccinationer som har getts någon annanstans | Inte kört | inte kört | inte kört |
| Barnhälsovårdens program > en vaccination som kräver aktivt val ger en varning utan vårdenhet, vaccin eller datum, och dosen kan ges efter en bekräftelse som loggas | Inte kört | inte kört | inte kört |
| Barnhälsovårdens program > en vaccination bakom en spärr röjs aldrig: ingen varning, bara den vanliga frågan som alla barn får | Inte kört | inte kört | inte kört |
| API för barnhälsovården > FHIR: vaccinationerna är Immunization med ATC och dos, med samma behörighet och loggning, och invånaren ser dem utan personal | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > programmet för barn fortsätter med elevhälsans doser och vattkoppor, och vuxna föreslås influensa och pneumokocker efter ålder och riskgrupp | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > riskgruppen räknas bara ur diagnoser som användaren får se | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > en dos ges med prövning mot programmet, och en dos som har getts någon annanstans registreras med källan | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > varje dos som ges rapporteras till det simulerade vaccinationsregistret med kvittens | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > vaccinationerna kräver vårdrelation, och nödåtkomst ger bara läsning | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > barnhälsovården registrerar bara vaccin i sitt eget program och hänvisar andra vacciner till vaccinationsprogrammens flöde, som prövar dem | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > åldern för vattkoppor, åldersgränsen och riskgrupperna är parametrar som systemförvaltaren sätter med fyra ögon, och programmet följer dem | Inte kört | inte kört | inte kört |
| Vaccinationsprogram > FHIR: vaccinationerna i programmen är Immunization med samma behörighet | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ge en vaccination i programmet för riskgrupper inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Vaccinationer (runda 13, r4, E2-38 och E2-39) > barnhälsovårdens doser står i fliken Vaccinationer, och åldern räknas från födelsedagen | Inte kört | inte kört | inte kört |
| Vaccinationer (runda 13, r4, E2-38 och E2-39) > en dos ges bara när patienten är frisk i dag, och batch, utgångsdatum och injektionsställe sparas | Inte kört | inte kört | inte kört |

### 3.5.1.8 Presentationsvyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: normal överföring kvitteras | Inte kört | inte kört | inte kört |
| Administrering > per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda | Inte kört | inte kört | inte kört |
| Utsättning > utsättning av betablockerare ger varning och kräver bekräftelse | Inte kört | inte kört | inte kört |
| Vyer för läkemedel > dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag | Inte kört | inte kört | inte kört |
| Vyer för läkemedel > läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning | Inte kört | inte kört | inte kört |
| Uppföljning av läkemedel > en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning | Inte kört | inte kört | inte kört |
| Identitet > sammanslagning: rader som aldrig får ändras, till exempel en given dos, följer med, och skyddet gäller efteråt | Inte kört | inte kört | inte kört |
| Sammanslagning av journaler med beredning och skanning > en beredning och en skanning följer med när journalerna slås samman, och skyddet mot ändring gäller efteråt | Inte kört | inte kört | inte kört |

### 3.5.1.9 Användning av nationella läkemedelstjänster

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > NLL: normal överföring kvitteras | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: felsvar syns och avstämning skickar igen | Inte kört | inte kört | inte kört |

### 3.5.1.11 Läkemedelsgenomgång

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedelsgenomgång > läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken | Inte kört | inte kört | inte kört |
| Läkemedelsberättelsen i epikrisen > epikrisens förslag har läkemedelsberättelsen under Läkemedelsförändringar, och den som läkaren har sparat vid läkemedelsgenomgången går först | Inte kört | inte kört | inte kört |

### 3.5.2.1 Gemensam funktionalitet för läkemedelsprocessen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Inte kört | inte kört | inte kört |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Inte kört | inte kört | inte kört |
| Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick | Inte kört | inte kört | inte kört |
| Spädning och tillsatser > systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet | Inte kört | inte kört | inte kört |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Inte kört | inte kört | inte kört |
| Tillsatser i infusion > glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans | Inte kört | inte kört | inte kört |
| Dosändring > dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning | Inte kört | inte kört | inte kört |

### 3.5.2.2 Registrering i efterhand

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > registrering i efterhand med tidpunkt och den som utförde det | Inte kört | inte kört | inte kört |
| Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras | Inte kört | inte kört | inte kört |
| Registrering i efterhand och makulering > en felaktig registrering makuleras med orsak och historik och raderas aldrig, och dosen blir att ge igen | Inte kört | inte kört | inte kört |
| Registrering i efterhand och makulering > säkerhet: en annan vårdenhet, nödåtkomst och en spärrad dos kan inte makuleras, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av läkemedelsprocessen del 2 > en muntlig ordination prövas mot när registreringen görs: en bakdaterad dos efter fönstret stoppas | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av läkemedelsprocessen del 2 > ett iordningsställande i efterhand får inte ligga före ordinationen eller i framtiden | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera en dos i efterhand inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.3 Vätskebalans i läkemedelsprocessen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Inte kört | inte kört | inte kört |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Inte kört | inte kört | inte kört |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Inte kört | inte kört | inte kört |
| Vätskebalans framåt > inre sekretess: vätskebalansen från en annan vårdenhet syns inte utan aktivt val, och en spärrad dos räknas aldrig in i prognosen | Inte kört | inte kört | inte kört |

### 3.5.2.4 Godkända, icke godkända och egendefinierade läkemedel, blodprodukter och nutrition

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Inte kört | inte kört | inte kört |
| Läkemedelstyper > extempore, licens, egendefinierade läkemedel, blodprodukter och nutrition finns i katalogen, märkta som demo och utan NPL-id | Inte kört | inte kört | inte kört |
| Läkemedelstyper > systemet bevakar licensen: varning vid ordination, stopp vid dos efter att den gått ut och en rad i läkarens inkorg | Inte kört | inte kört | inte kört |
| Läkemedelstyper > en blodprodukt ges bara med kontrollen vid sängen, och skickas inte till NLL | Inte kört | inte kört | inte kört |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Inte kört | inte kört | inte kört |
| Beställning av extempore, licens och blodprodukter > extempore beställs från det simulerade apoteket och blodprodukter från den simulerade blodcentralen, med mängd ur ordinationen och status till leveransen | Inte kört | inte kört | inte kört |
| Beställning av extempore, licens och blodprodukter > en licensansökan till det simulerade Läkemedelsverket kräver motivering, och en beviljad licens bevakas av systemet | Inte kört | inte kört | inte kört |

### 3.5.2.5 Administrering under permission

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > permission: doser under permission lämnas över till patienten | Inte kört | inte kört | inte kört |
| Administrering > iordningsställande med kontrollkod och sedan administrering av samma dos | Inte kört | inte kört | inte kört |

### 3.5.2.6 Förskrivning/ordination med ordinationsorsak

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Inte kört | inte kört | inte kört |
| Läkemedel > databasen vägrar ordination utan orsak (CHECK) | Inte kört | inte kört | inte kört |
| Seed > alla ordinationer har orsak och uppföljningsdatum | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ordinera ett läkemedel utan varning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.7 Ordination kopplad till planerad vårdhändelse

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Fördefinierade ordinationer > ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > systemet föreslår patientens bokningar på den egna vårdenheten och den som passar ordinationen först | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > ordinationen får sin tid från bokningen med ett klick, och sjuksköterskan ser när läkemedlet ges | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > ombokning och avbokning räknar om dosen utan att någon gör något, och sjuksköterskan får en förklaring | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > utan bokning hamnar vårdhändelsen på väntelistan, och vårdadministratören bokar den som vanligt i Dagens arbete | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > den manuella tidsättningen finns kvar som reserv, slutar följa tidboken och sparas i historiken | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > säkerhet: ordinera och vårdrelation på egen vårdenhet krävs, och inget sparas när kopplingen nekas | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > säkerhet: spärrad vårdenhet och skyddad identitet läcker inte via förslagen eller väntelistan | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > när tiden avbokas sätter systemet upp vårdhändelsen på den ordinerande vårdenhetens väntelista igen, utan ny vårdrelation | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > när ordinationen är utsatt eller tiden är satt för hand sätter avbokningen inte upp vårdhändelsen igen | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > när en remiss avvisas och tiden avbokas sätts vårdhändelsen inte upp igen, dosen säger varför och den ordinerande läkaren får en rad i inkorgen | Inte kört | inte kört | inte kört |
| Vårdhändelse i tidboken > raden om den avbokade vårdhändelsen försvinner när ordinationen sätts ut, och visar inte spärrade uppgifter | Inte kört | inte kört | inte kört |
| Avvisad remiss med vårdhändelse > avvisningen som tar bort den sista vårdrelationen kräver ett beslut innan den sparas, och inget sparas utan det | Inte kört | inte kört | inte kört |
| Avvisad remiss med vårdhändelse > Sätt ut: ordinationen sätts ut med orsaken som systemet föreslår, remissen avvisas och ingen rad hamnar i inkorgen | Inte kört | inte kört | inte kört |
| Avvisad remiss med vårdhändelse > Behåll finns bara när den ordinerande läkaren eller en annan vårdenhet har grund, och sätter då upp vårdhändelsen igen | Inte kört | inte kört | inte kört |
| Avvisad remiss med vårdhändelse > säkerhet: ett läkemedel som den som avvisar inte får se sätts inte ut, och vårdenhetens läkare får besked utan patientuppgifter | Inte kört | inte kört | inte kört |
| Avvisad remiss med vårdhändelse > säkerhet: bara vårdenhetens läkare som remissen är ställd till kan förhandsvisa och avvisa, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Avvisa en remiss och sätta ut läkemedlet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Avbokad vårdhändelse utan grund > raden går till den ordinerande läkaren, annars till den medicinskt ansvariga läkaren och annars till alla läkare, och verksamhetschefen påminns | Inte kört | inte kört | inte kört |

### 3.5.2.8 Varning vid utsättning av läkemedel med särskilda observationer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utsättning > utsättning av betablockerare ger varning och kräver bekräftelse | Inte kört | inte kört | inte kört |
| Utsättning > utsättning utan särskilda observationer ger ingen varning, och antikoagulantia kräver en plan | Inte kört | inte kört | inte kört |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel med varning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Utsättning av antikoagulantia > utsättning av Waran kräver en plan, som sparas med utsättningen och syns i listan och i FHIR | Inte kört | inte kört | inte kört |
| Utsättning av antikoagulantia > vid byte föreslår systemet det nya antikoagulantia som redan är ordinerat | Inte kört | inte kört | inte kört |
| Utsättning av antikoagulantia > plan via API, och läkemedel utan antikoagulantia sätts ut utan plan | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta ut Waran med plan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Återinsättning efter uppehåll > dagen före och på dagen får läkaren en rad i inkorgen med läkemedlet, planen och en knapp till läkemedelslistan | Inte kört | inte kört | inte kört |
| Återinsättning efter uppehåll > raden går till den ordinerande läkaren, den som beslutade om uppehållet och vårdenhetens läkare, aldrig till andra roller | Inte kört | inte kört | inte kört |
| Återinsättning efter uppehåll > raden försvinner när läkemedlet är insatt igen eller ordinationen ändras, men inte av en bryggbehandling | Inte kört | inte kört | inte kört |
| Återinsättning efter uppehåll > säkerhet: bara patienter som användaren får se, och aldrig uppgifter från en spärrad vårdenhet | Inte kört | inte kört | inte kört |
| Återinsättning i inkorgen via API > API: inkorgen visar raden med skyddad identitet maskerad, loggar åtkomsten och leder till läkemedelslistan | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta in Waran igen efter ett uppehåll inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Avslutad behandling efter uppehåll > läkaren avslutar behandlingen med en orsak som systemet föreslår, sparat i historiken och i FHIR, och raden försvinner för alla mottagare | Inte kört | inte kört | inte kört |
| Avslutad behandling efter uppehåll > säkerhet: bara en läkare som är mottagare och får se patienten, aldrig från en spärrad vårdenhet, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Avsluta behandlingen efter ett uppehåll inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.9 Vidimering av samlade pågående ordinationer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick | Inte kört | inte kört | inte kört |
| Vidimering > vidimering kräver läkare med vårdrelation och omfattar inte spärrade ordinationer, inte ens med samtycke | Inte kört | inte kört | inte kört |
| Administrering via API > FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Vidimera pågående ordinationer inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.10 Läkemedelsprocess

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > utsättning kräver orsak och inget raderas | Inte kört | inte kört | inte kört |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Inte kört | inte kört | inte kört |
| Administrering > administreringar raderas inte och en given dos ändras inte (trigger) | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ge en dos inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Uppföljning av läkemedel > en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning | Inte kört | inte kört | inte kört |
| Registrering i efterhand och makulering > en felaktig registrering makuleras med orsak och historik och raderas aldrig, och dosen blir att ge igen | Inte kört | inte kört | inte kört |
| Vyer för läkemedel > dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag | Inte kört | inte kört | inte kört |
| Vyer för läkemedel > läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning | Inte kört | inte kört | inte kört |
| Beredning med kontroll och etikett > en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges | Inte kört | inte kört | inte kört |
| Sammanslagning av journaler med beredning och skanning > en beredning och en skanning följer med när journalerna slås samman, och skyddet mot ändring gäller efteråt | Inte kört | inte kört | inte kört |

### 3.5.2.11 Förskrivning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Dosändring > dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning | Inte kört | inte kört | inte kört |
| Dosändring > en ny dosering från ett senare datum gäller av sig själv när dagen kommer, också i Läkemedel att ge | Inte kört | inte kört | inte kört |
| Dosändring > säkerhet: dosändring kräver ordinationsrätt och vårdrelation, inte trappschema, och en spärrad enhets ordination röjs inte | Inte kört | inte kört | inte kört |
| Dosändring > API: dosändring med loggning och FHIR | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra dosen i en pågående ordination inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.12 Ordination

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Inte kört | inte kört | inte kört |
| Läkemedel > uppföljningsdatum är obligatoriskt | Inte kört | inte kört | inte kört |
| Läkemedel > sjuksköterska kan inte ordinera | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ordinera ett läkemedel utan varning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Mallar med flera ordinationer > läkaren ordinerar ur en mall: systemet fyller i allt, varnar per ordination och tar själv bort ett läkemedel som patienten redan har | Inte kört | inte kört | inte kört |
| Upp- och nedtrappning > systemet föreslår ett nedtrappningsschema för kortison och räknar dosen för varje dag i Läkemedel att ge | Inte kört | inte kört | inte kört |
| Upp- och nedtrappning > upptrappning fortsätter med slutdosen, och en dos som inte går att ge med produkten förklaras | Inte kört | inte kört | inte kört |
| Muntlig ordination > sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar | Inte kört | inte kört | inte kört |
| Muntlig ordination > säkerhet: läkaren ska vara på samma vårdenhet, orsaken till omedelbar behandling krävs och undersköterskan och läkaren dokumenterar inte muntligt | Inte kört | inte kört | inte kört |
| Spädning och tillsatser > systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet | Inte kört | inte kört | inte kört |
| Administrationssätt ur beredningsformen > ögondroppar, ögonsalva, nässpray och nebulisator får sitt administrationssätt, och ögondroppar sparas aldrig som peroralt | Inte kört | inte kört | inte kört |
| Doseringsmallar per produkt > Alvedon forte 1 g och paracetamol som infusion får egna förslag ur produkten, inte tablettdosen för 500 mg | Inte kört | inte kört | inte kört |
| Dosändring > dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning | Inte kört | inte kört | inte kört |
| Dosändring > en ny dosering från ett senare datum gäller av sig själv när dagen kommer, också i Läkemedel att ge | Inte kört | inte kört | inte kört |
| Dosändring > säkerhet: dosändring kräver ordinationsrätt och vårdrelation, inte trappschema, och en spärrad enhets ordination röjs inte | Inte kört | inte kört | inte kört |
| Muntlig ordination i följd > läkaren och skälet föreslås från sjuksköterskans förra muntliga ordination, bara för samma patient och inom två timmar | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra dosen i en pågående ordination inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Egenadministrering i slutenvården > en ordination som patienten sköter själv kommer inte med bland doserna att ge, och sjuksköterskan kvitterar intaget per dostid | Inte kört | inte kört | inte kört |
| Egenadministrering i slutenvården > systemet förklarar varför en blodprodukt, en infusion och narkotika inte kan skötas av patienten själv | Inte kört | inte kört | inte kört |
| Doser i flytande form och gasform > syrgas ordineras i liter per minut med utrustning och mål för saturationen, och systemet stoppar ett flöde som utrustningen inte ger | Inte kört | inte kört | inte kört |

### 3.5.2.13 Ordinations- och utsättningsorsak

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Inte kört | inte kört | inte kört |
| Läkemedel > databasen vägrar ordination utan orsak (CHECK) | Inte kört | inte kört | inte kört |
| Läkemedel > utsättning kräver orsak och inget raderas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.14 Ordination inför planerad vårdhändelse

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Fördefinierade ordinationer > ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts | Inte kört | inte kört | inte kört |
| Mallar med flera ordinationer > ordinationerna i mallen knyts till samma planerade vårdhändelse och en annan allvarlig varning kräver motivering | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ordinera från en mall med flera ordinationer inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.2.15 Ordination enligt generella direktiv

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Generella direktiv > sjuksköterskan ser vårdenhetens direktiv prövade mot patienten, och systemet förklarar varför ett direktiv inte ryms | Inte kört | inte kört | inte kört |
| Generella direktiv > sjuksköterskan ordinerar inom direktivet med bedömning, och antalet tillfällen utan läkarkontakt räknas | Inte kört | inte kört | inte kört |
| Generella direktiv > bara den medicinskt ansvariga läkaren fastställer och upphäver ett direktiv för sin vårdenhet, med det som 6 kap. 6 § kräver | Inte kört | inte kört | inte kört |
| Läkemedelsprocessen del 2 via API > API: mall, muntlig ordination, direktiv, makulering, utvärdering, fördjupad genomgång och dosering över flera dygn, med loggning och inkorg | Inte kört | inte kört | inte kört |
| Ansvarsuppdrag för läkemedel > verksamhetschefen utser en medicinskt ansvarig läkare med ett år förifyllt, och det loggas och syns i säkerhetsloggen | Inte kört | inte kört | inte kört |
| Generella direktiv på vårdgivarens nivå > den läkare som vårdgivaren har utsett fastställer ett direktiv som gäller alla vårdenheter, och andra får en förklaring | Inte kört | inte kört | inte kört |

### 3.5.2.17 Iordningsställande

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > iordningsställande med kontrollkod och sedan administrering av samma dos | Inte kört | inte kört | inte kört |
| Administrering > varning: för tidig dos | Inte kört | inte kört | inte kört |
| Tillsatser i infusion > glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans | Inte kört | inte kört | inte kört |
| Beredning med kontroll och etikett > en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges | Inte kört | inte kört | inte kört |
| Beredning med kontroll och etikett > beredningen följer ordinationen: fel lösning, gången förpackning och passerad hållbarhet stoppas med en förklaring, och en skannad förpackning fyller i batch och utgångsdatum | Inte kört | inte kört | inte kört |
| Doser i flytande form och gasform > flytande dos: systemet räknar volymen i ml ur styrkan och visar den vid iordningsställandet, och en uppmätt volym som avviker varnar | Inte kört | inte kört | inte kört |
| Doser i flytande form och gasform > syrgas ordineras i liter per minut med utrustning och mål för saturationen, och systemet stoppar ett flöde som utrustningen inte ger | Inte kört | inte kört | inte kört |
| Patientnära skanning > etiketten och armbandet kontrolleras mot dosen, och ett armband eller en etikett för en annan patient stoppas utan att röja den andra patienten | Inte kört | inte kört | inte kört |
| Beredning och skanning via API > API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning | Inte kört | inte kört | inte kört |

### 3.5.2.18 Administrering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider | Inte kört | inte kört | inte kört |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Inte kört | inte kört | inte kört |
| Administrering > varning: dubbel dos | Inte kört | inte kört | inte kört |
| Administrering > varning: för tidig dos | Inte kört | inte kört | inte kört |
| Administrering > varning: given dos utan ordination | Inte kört | inte kört | inte kört |
| Administrering > vid behov: varnar när högsta dygnsdosen är nådd och när doserna kommer för tätt | Inte kört | inte kört | inte kört |
| Administrering > registrering i efterhand med tidpunkt och den som utförde det | Inte kört | inte kört | inte kört |
| Administrering > permission: doser under permission lämnas över till patienten | Inte kört | inte kört | inte kört |
| Administrering > nekas: nödåtkomst och aktivt val ger inte rätt att ge läkemedel | Inte kört | inte kört | inte kört |
| Administrering > per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda | Inte kört | inte kört | inte kört |
| Administrering via API > Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ge en dos inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Läkare ger läkemedel > läkare får ge en dos med samma kontroller och loggning som sjuksköterskan | Inte kört | inte kört | inte kört |
| Delegering > undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR | Inte kört | inte kört | inte kört |
| Delegering > undersköterska: en dos som delegeringen inte omfattar nekas och förklaras, och knappen visas inte | Inte kört | inte kört | inte kört |
| Delegering > sjuksköterskan registrerar en dos som undersköterskan gav: delegeringen prövas för den som gav dosen | Inte kört | inte kört | inte kört |
| Delegering > undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras | Inte kört | inte kört | inte kört |
| Delegering > undersköterska: delegeringen gäller bara den vårdenhet den är utfärdad för | Inte kört | inte kört | inte kört |
| Delegering > undersköterska: spärr och skyddad identitet gäller som för sjuksköterskan, också med delegering | Inte kört | inte kört | inte kört |
| Delegering > registrera delegering: sjuksköterska på samma vårdenhet, tidsbegränsad till högst ett år, med kontroll av kunskaperna | Inte kört | inte kört | inte kört |
| Delegering > registrera delegering: fel roll och fel vårdenhet nekas och loggas | Inte kört | inte kört | inte kört |
| Delegering > återkallad delegering ger ingen rätt, och återkallas bara en gång med orsak | Inte kört | inte kört | inte kört |
| Delegering > påminnelse i inkorgen när en delegering går ut inom 30 dagar, bara på samma vårdenhet och borta efter förnyelse | Inte kört | inte kört | inte kört |
| Delegering via API > API: sjuksköterskan registrerar en delegering och ser påminnelsen i inkorgen, undersköterskan ger med den | Inte kört | inte kört | inte kört |
| Delegering via API > API: undersköterska utan giltig delegering har inte behörigheten att ge läkemedel i sessionen | Inte kört | inte kört | inte kört |
| Dos som avviker från ordinationen > en annan dos än ordinationens varnar och måste kvitteras med motivering, allvarlig vid mer än dubbelt eller mindre än hälften | Inte kört | inte kört | inte kört |
| Dos som avviker från ordinationen > en dos inom ordinationens intervall ("1 till 2 tabletter") varnar inte | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av delegering och dos > en delegering kan inte registreras flera år fram: från högst 30 dagar fram och till högst ett år efter beslutsdagen | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av delegering och dos > påminnelsen räknas från beslutet som gäller i dag, och ett senare beslut tystar den bara om det tar vid utan glapp | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av delegering och dos > avvikande dos räknas som dos gånger antal, så antal kringgår inte varningen | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av delegering och dos > administrationssättet ska passa läkemedelsformen, och delegeringens kategori bestäms av formen | Inte kört | inte kört | inte kört |
| Säkerhetsgranskning av delegering och dos > en delegering ska gälla både när en dos iordningsställs och för dostiden | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ge en dos med delegering inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera en delegering inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Delegering av läkare > läkaren registrerar och återkallar delegering på samma villkor som sjuksköterskan: samma vårdenhet, inte för sig själv och samma gränser för giltighet | Inte kört | inte kört | inte kört |
| Delegering av läkare > läkaren påminns bara om de delegeringar som läkaren själv har utfärdat, sjuksköterskan som förut | Inte kört | inte kört | inte kört |
| Delegering via API > API: läkaren registrerar en delegering under Delegeringar, och undersköterskan ger med den | Inte kört | inte kört | inte kört |
| Administrationssätt ur beredningsformen > ögondroppar, ögonsalva, nässpray och nebulisator får sitt administrationssätt, och ögondroppar sparas aldrig som peroralt | Inte kört | inte kört | inte kört |
| Patientnära skanning > etiketten och armbandet kontrolleras mot dosen, och ett armband eller en etikett för en annan patient stoppas utan att röja den andra patienten | Inte kört | inte kört | inte kört |
| Patientnära skanning > en etikett för en dos av en spärrad vårdenhets ordination behandlas som en okänd etikett | Inte kört | inte kört | inte kört |
| Beredning och skanning via API > API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning | Inte kört | inte kört | inte kört |

### 3.5.2.19 Automatgenererad administrering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik, infusionspump > en infusionspump rapporterar pågående dos, och systemet registrerar given dos med källan utrustning och kontrollerar den mot ordinationen och dygnsdosen | Inte kört | inte kört | inte kört |
| Medicinteknik, infusionspump > pumparna i Läkemedel att ge visas bara för vårdenheten, och en pump kopplas bara till en aktiv infusion | Inte kört | inte kört | inte kört |
| Medicinteknik, infusionspump > den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen | Inte kört | inte kört | inte kört |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Inte kört | inte kört | inte kört |
| Intensivvård > infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen | Inte kört | inte kört | inte kört |

### 3.5.2.20 Uppföljning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > uppföljningsdatum är obligatoriskt | Inte kört | inte kört | inte kört |
| Uppföljning av läkemedel > en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning | Inte kört | inte kört | inte kört |
| Uppföljning av läkemedel > uppföljningen på vårdenhetens nivå visar antal per läkemedel utan patientuppgifter, och bara för läkaren | Inte kört | inte kört | inte kört |
| Läkemedelsprocessen del 2 via API > API: mall, muntlig ordination, direktiv, makulering, utvärdering, fördjupad genomgång och dosering över flera dygn, med loggning och inkorg | Inte kört | inte kört | inte kört |
| Uppföljning av läkemedel på vårdgivarens nivå > förskrivning, administrering och utvärdering per läkemedel över alla vårdenheter, utan personuppgifter och bara för uppföljningen | Inte kört | inte kört | inte kört |

### 3.5.2.21 Läkemedelsprocess och vätskebalans

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Inte kört | inte kört | inte kört |
| Fördefinierade ordinationer > fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient | Inte kört | inte kört | inte kört |

### 3.5.3.1 Samlad funktionalitet för vätskebalans

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Inte kört | inte kört | inte kört |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Inte kört | inte kört | inte kört |
| Vätskebalans framåt > inre sekretess: vätskebalansen från en annan vårdenhet syns inte utan aktivt val, och en spärrad dos räknas aldrig in i prognosen | Inte kört | inte kört | inte kört |
| Vätskebalansen (runda 13, r4, E2-14 och E2-51) > en urinmätning har tid och period, och timmar utan registrering räknas inte som noll och ger ingen oliguri | Inte kört | inte kört | inte kört |

### 3.5.3.2 Presentationsvyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Inte kört | inte kört | inte kört |
| Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras | Inte kört | inte kört | inte kört |

### 3.5.3.3 Framtida vätskebalans

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Inte kört | inte kört | inte kört |
| Vätskebalans framåt i flera dygn > den förväntade vätskebalansen visas 24, 48 eller 72 timmar framåt, med ackumulerad mängd in och förlusterna för hela perioden | Inte kört | inte kört | inte kört |

### 3.5.4.1 Förskrivna förbrukningsartiklar i vyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > presentation: filtrering på grupp, sortering och uppföljning med vem och när | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > behörighet: undersköterskan och nödåtkomst förskriver inte, en annan vårdenhet ändrar inte, och en spärrad vårdenhets förskrivning röjs inte | Inte kört | inte kört | inte kört |

### 3.5.4.2 Förskrivning och ändring av förbrukningsartiklar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > kontroller: en dubbelförskrivning stoppas med förslag om förnyelse, en stor mängd kräver motivering och en artikel som inte passar listan ger en observation | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > behörighet: undersköterskan och nödåtkomst förskriver inte, en annan vårdenhet ändrar inte, och en spärrad vårdenhets förskrivning röjs inte | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > API: lista, mall, ändring, förnyelse, utsättning och återinsättning med loggning, och sjuksköterskan förskriver | Inte kört | inte kört | inte kört |

### 3.5.4.3 Presentationsvyer

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > presentation: filtrering på grupp, sortering och uppföljning med vem och när | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Inte kört | inte kört | inte kört |

### 3.5.4.4 Förbrukningsartiklar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > mall för den som tar insulin med penna: systemet föreslår pennkanyler, teststickor, lansetter och kanylburk med mängd ur läkemedelslistan och tar bort det som redan är förskrivet | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > kontroller: en dubbelförskrivning stoppas med förslag om förnyelse, en stor mängd kräver motivering och en artikel som inte passar listan ger en observation | Inte kört | inte kört | inte kört |
| Förbrukningsartiklar > en förskrivning från en annan förskrivare registreras med vem och när, utan att skickas till NLL | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Förskriva förbrukningsartiklar ur en mall inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.5.5.1 Klinisk prövning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Klinisk läkemedelsprövning > prövaren inkluderar en patient, systemet registrerar uppmärksamhetsinformationen och varnar vid ordination utanför studien och vid ett läkemedel som protokollet inte tillåter | Inte kört | inte kört | inte kört |
| Klinisk läkemedelsprövning > ett deltagande på en spärrad vårdenhet syns inte och ger ingen varning som röjer det | Inte kört | inte kört | inte kört |

### 3.6.1.1 Standardiserade gränssnitt mot medicinteknisk utrustning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Inte kört | inte kört | inte kört |
| Medicinteknik > HL7 v2 ORU^R01 enligt IHE PCD-01 tas emot med MDC-koder och ger ett ACK | Inte kört | inte kört | inte kört |
| Medicinteknik > utan giltig nyckel avvisas meddelandet, och nyckeln sparas bara som HMAC och ersätts av en ny | Inte kört | inte kört | inte kört |
| Medicinteknik > värden utan gällande koppling avvisas, och efter att kopplingen avslutats tas inga fler emot | Inte kört | inte kört | inte kört |
| Medicinteknik > ett meddelande som anger en annan patient än kopplingen avvisas | Inte kört | inte kört | inte kört |
| Medicinteknik, infusionspump > den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen | Inte kört | inte kört | inte kört |
| Medicinteknik > ett meddelande i fel format nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken | Inte kört | inte kört | inte kört |

### 3.6.1.2 Presentation av data från medicinteknisk utrustning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Inte kört | inte kört | inte kört |
| Intensivvård > övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta | Inte kört | inte kört | inte kört |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Koppla en patientmonitor till patienten inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna värden från monitorn inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.6.1.3 Dokumentation av gränssnitt för egen utveckling och förvaltning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitten för informationsutbyte > varje adressprefix som servern skickar vidare hör till ett gränssnitt i registret eller är internt med motivering | Inte kört | inte kört | inte kört |
| Gränssnitten för informationsutbyte > varje rutt i API:t som tyder på informationsutbyte hör till ett gränssnitt i registret | Inte kört | inte kört | inte kört |
| Gränssnitten för informationsutbyte > varje fil i src/rivta och varje fil som bygger SOAP eller RIV-TA hör till ett gränssnitt i registret | Inte kört | inte kört | inte kört |
| Gränssnitten för informationsutbyte > varje adress, fil och dokument som registret nämner finns, och varje gränssnitt har ett avsnitt | Inte kört | inte kört | inte kört |
| Gränssnitten för informationsutbyte > dokumentet räknar FHIR-resurserna och tjänstekontrakten ur koden och är skrivet ur registret | Inte kört | inte kört | inte kört |

### 3.6.1.4 Format och profiler

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > formaten och profilerna står i CapabilityStatement och på sidan Öppet API | Inte kört | inte kört | inte kört |
| Medicinteknik > ett meddelande i fel format nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken | Inte kört | inte kört | inte kört |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Inte kört | inte kört | inte kört |
| Medicinteknik > HL7 v2 ORU^R01 enligt IHE PCD-01 tas emot med MDC-koder och ger ett ACK | Inte kört | inte kört | inte kört |

### 3.6.1.5 Spårbarhet och säkerhet

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > kopplingen görs genom att skanna utrustningens streckkod, armbandet kontrolleras mot patienten och varje koppling loggas | Inte kört | inte kört | inte kört |
| Medicinteknik > värden utan gällande koppling avvisas, och efter att kopplingen avslutats tas inga fler emot | Inte kört | inte kört | inte kört |
| Medicinteknik > när utrustningen flyttas till en annan patient avslutas den förra kopplingen utan att den patienten röjs | Inte kört | inte kört | inte kört |
| Medicinteknik > ett meddelande som anger en annan patient än kopplingen avvisas | Inte kört | inte kört | inte kört |
| Medicinteknik > fel roll och fel vårdenhet får inte koppla utrustning, och logggranskaren når inte utrustningen | Inte kört | inte kört | inte kört |
| Medicinteknik > utan giltig nyckel avvisas meddelandet, och nyckeln sparas bara som HMAC och ersätts av en ny | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Koppla en patientmonitor till patienten inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.6.1.6 Klassificering och visualisering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Inte kört | inte kört | inte kört |
| Medicinteknik > bara behörig personal på vårdenheten godkänner, och ett bedömt värde kan inte bedömas igen eller ändras | Inte kört | inte kört | inte kört |
| Medicinteknik > ett värde från utrustning på en spärrad vårdenhet syns inte och röjs inte i svaret | Inte kört | inte kört | inte kört |
| Intensivvård > analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Godkänna värden från monitorn inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.6.1.7 Egenmätning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > patienten registrerar egna mätningar i Min journal, och de skickas till vårdenheten som vårdar patienten märkta som inte kvalitetssäkrade | Inte kört | inte kört | inte kört |
| Medicinteknik > patientens egna mätningar visas skilda från vårdens värden och räknas inte i NEWS2, larm eller vikt förrän de är bedömda | Inte kört | inte kört | inte kört |
| Medicinteknik > egna mätningar har ett tak per dygn, och fel typ eller värde förklaras | Inte kört | inte kört | inte kört |
| Medicinteknik > bara behörig personal på vårdenheten godkänner, och ett bedömt värde kan inte bedömas igen eller ändras | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Lämna en egen mätning i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.7.1.1 Olika former för kommunikation med invånare/patient/ombud

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter | Inte kört | inte kört | inte kört |
| Min journal > patienten når sin egen journal men inte någon annans, oavsett id i adressen | Inte kört | inte kört | inte kört |
| Min journal > anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas | Inte kört | inte kört | inte kört |
| Min journal > begäran om spärr ändrar inte spärren och registreras som begäran till vården | Inte kört | inte kört | inte kört |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > patienten skriver till vårdenheten, och systemet väljer vårdenhet och yrkesroll | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > vården läser i sin egen inloggning med vårdrelation, svarar och avslutar, och allt loggas på patienten | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > listan visar ingen text, en annan vårdenhet och fel roll når inte meddelandet, och ord som tyder på något akut ger rådet att ringa 112 | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > ombudet skriver för patienten och vårdnadshavaren för barnet, och vården ser vem som skrev | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > en begäran om spärr, om att häva en spärr och om loggutdrag handläggs av rätt roll och patienten får beskedet | Inte kört | inte kört | inte kört |
| Ombud > patienten ger fullmakt i Min journal, och ombudet bokar, bokar om och avbokar patientens tider med loggning på patienten | Inte kört | inte kört | inte kört |
| Ombud > ombudet når aldrig journalen, och en återkallad eller utgången fullmakt ger ingen åtkomst | Inte kört | inte kört | inte kört |
| Ombud > patientens logglista visar ombudets åtgärder som ombud, och vården ser vem som bokade | Inte kört | inte kört | inte kört |
| Ombud > meddelanden för ett ombud visar och tar aldrig emot läkemedel, vårdplaner eller vad en tråd gäller ur journalen | Inte kört | inte kört | inte kört |
| Ombud > trådar som gäller en ordination eller en vårdplan finns inte för ombudet, inte heller i räknare, läsmarkering och svar | Inte kört | inte kört | inte kört |
| Ombud > en fullmakt i Min journal röjer aldrig vem ett personnummer tillhör, skyddad identitet registreras bara av personal, och försöken har ett tak | Inte kört | inte kört | inte kört |
| Ombud > en fullmakt från Min journal gäller först när ombudet har godkänt den, och svaret är detsamma för alla nummer som inte kan bli ombud | Inte kört | inte kört | inte kört |
| Ombud > registreringar och återkallelser har ett tak per dygn, ett ombud kan avböja och en skriftlig fullmakt hos vården gäller direkt | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva ett meddelande till vården i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Svara på ett meddelande från en patient och avsluta inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 3.7.1.3 Övrigt stöd för partnerskap

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > spärrade uppgifter visas för patienten själv och spärren redovisas | Inte kört | inte kört | inte kört |
| Min journal > begäran om spärr ändrar inte spärren och registreras som begäran till vården | Inte kört | inte kört | inte kört |
| Min journal > vårdnadshavare läser barnets journal under 13 år men inte från 13 år eller för ett barn med skyddad identitet | Inte kört | inte kört | inte kört |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Inte kört | inte kört | inte kört |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Patienten bokar om sin tid i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Egen vårdbegäran > invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten | Inte kört | inte kört | inte kört |
| Egen vårdbegäran > vid tecken på akuta besvär hänvisar systemet till 112, och en invånare kan ha högst tre öppna vårdbegäranden | Inte kört | inte kört | inte kört |
| Vårdplanen i Min journal > patienten ser mål, åtgärder och uppföljningar och kommenterar, och kommentaren går till vårdenheten som har planen | Inte kört | inte kört | inte kört |
| Vårdplanen i Min journal > ombudet ser inte vårdplanen, och vårdnadshavaren ser barnets | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > patienten skriver till vårdenheten, och systemet väljer vårdenhet och yrkesroll | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > vården läser i sin egen inloggning med vårdrelation, svarar och avslutar, och allt loggas på patienten | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten | Inte kört | inte kört | inte kört |
| Meddelanden från invånare > en begäran om spärr, om att häva en spärr och om loggutdrag handläggs av rätt roll och patienten får beskedet | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva ett meddelande till vården i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.1.1.1 Funktionalitet för tillväxtmonitorering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > kurvorna, analysen och larmet för barnet byggs av det användaren får se | Inte kört | inte kört | inte kört |
| Tillväxt > mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort | Inte kört | inte kört | inte kört |
| API för barnhälsovården > läkaren på barnavårdscentralen ser tillväxten och registrerar vikt och längd | Inte kört | inte kört | inte kört |
| API för barnhälsovården > personal utan vårdrelation nekas, och sjuksköterskan på kardiologen har ingen barnhälsovård | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.1.1.2 Tillväxt baserad på referensmaterial

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > z-värden och referenslinjer räknas enligt WHO:s tabeller | Inte kört | inte kört | inte kört |
| Tillväxt > korrigerad ålder för för tidigt födda till två år, och målängd ur föräldrarnas längd | Inte kört | inte kört | inte kört |
| Licens för tillväxtreferensen > WHO-tabellen har en egen licensfil och omfattas inte av EUPL | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > WHO:s referens 5 till 19 år räknas ur tabellen, och systemet väljer referens efter åldern | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna | Inte kört | inte kört | inte kört |

### 4.1.1.3 Referensmaterial

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > z-värden och referenslinjer räknas enligt WHO:s tabeller | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > WHO:s referens 5 till 19 år räknas ur tabellen, och systemet väljer referens efter åldern | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna | Inte kört | inte kört | inte kört |

### 4.1.1.4 Inmatning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort | Inte kört | inte kört | inte kört |
| Tillväxt > födelseuppgifter, föräldrarnas längd och händelser kontrolleras, och en ny uppgift ersätter den förra | Inte kört | inte kört | inte kört |
| Kodverk och FHIR för tillväxt > huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns | Inte kört | inte kört | inte kört |
| Rapportering till Svenska barnhälsovårdsregistret > systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren | Inte kört | inte kört | inte kört |
| Mätningar hemma och Min journal > vårdnadshavaren registrerar en mätning som väntar tills barnavårdscentralen bekräftar den | Inte kört | inte kört | inte kört |
| Barnhälsovårdens program > sjuksköterskor gör barnhälsovårdens flöde med ett uppdrag på barnavårdscentralen, och utan uppdrag nekas det | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Tillväxt, version 1.1 > sitthöjd registreras med K11:s kod och visas som kurva utan referens, och K11:s koder är kontrollerade mot Snomed CT | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > pubertet registreras med de stadier som gäller barnets kön, och systemet räknar starten och varnar för tidig pubertet | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > en pubertetsregistrering på en spärrad vårdenhet syns inte och ändrar inte bedömningen | Inte kört | inte kört | inte kört |

### 4.1.1.5 Beräkningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > kurvorna, analysen och larmet för barnet byggs av det användaren får se | Inte kört | inte kört | inte kört |
| Tillväxt > larmar när kurvor korsas, när huvudomfånget växer för snabbt, utanför två SD och för nyfödda | Inte kört | inte kört | inte kört |

### 4.1.1.6 Presentation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > kurvorna, analysen och larmet för barnet byggs av det användaren får se | Inte kört | inte kört | inte kört |
| Mätningar hemma och Min journal > Min journal visar kurvorna och vaccinationerna utan larm, id eller personal | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Tillväxt, version 1.1 > referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > sitthöjd registreras med K11:s kod och visas som kurva utan referens, och K11:s koder är kontrollerade mot Snomed CT | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > pubertet registreras med de stadier som gäller barnets kön, och systemet räknar starten och varnar för tidig pubertet | Inte kört | inte kört | inte kört |

### 4.1.1.7 Export och import

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rapportering till Svenska barnhälsovårdsregistret > systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren | Inte kört | inte kört | inte kört |
| Rapportering till Svenska barnhälsovårdsregistret > ett orimligt värde hålls kvar med en förklaring och en länk, och undantagen räknas | Inte kört | inte kört | inte kört |
| Licens för tillväxtreferensen > barn med skyddade personuppgifter undantas från registret enligt en konstant | Inte kört | inte kört | inte kört |
| API för barnhälsovården > FHIR: vaccinationerna är Immunization med ATC och dos, med samma behörighet och loggning, och invånaren ser dem utan personal | Inte kört | inte kört | inte kört |
| Kodverk och FHIR för tillväxt > huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > en fil förhandsgranskas innan något sparas, och en fil för en annan patient, orimliga värden och för stora filer avvisas | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > inläsningen sparar ursprunget som det var, och den som läser in står aldrig som den som mätte | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > det simulerade journalsystemet svarar på GetObservations, och svaret granskas och läses in som en fil | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > GetObservations och GetActivities svarar med samma behörighet som FHIR | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Läsa in ett barns tillväxtdata från ett annat journalsystem inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.1.1.8 Uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rapportering till Svenska barnhälsovårdsregistret > en annan vårdenhet ser inget och en roll utan behörighet nekas | Inte kört | inte kört | inte kört |
| Tillväxt, version 1.1 > barnavårdscentralen väljer sina indikatorer, och regionen ser dem med varje liten cell spärrad för sig | Inte kört | inte kört | inte kört |

### 4.2.1.1 Funktionalitet för bildhantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen | Inte kört | inte kört | inte kört |
| Bilder och media > jämförelse över tid: bilder av samma kroppsställe ställs i tidsordning med dagarna mellan dem | Inte kört | inte kört | inte kört |
| Bilder och media > en remissbilaga förs in i journalen med källan märkt, och en textbilaga stannar i remissen | Inte kört | inte kört | inte kört |
| Bilder och media > patientens uppladdning i Min journal går till en vårdenhet där patienten har kontakt och kommer in i journalen först efter granskning | Inte kört | inte kört | inte kört |
| Bilder och media > multimediaarkivet: undersökningen beställs med frågeställning, arkivet svarar med utlåtande och bildlänk, och bilden visas genom arkivet med behörighet och loggning | Inte kört | inte kört | inte kört |
| Bilder och media > behörighet: en bild från en annan vårdenhet kräver aktivt val, en spärrad syns inte alls, och undersköterskan ser bara omvårdnadens bilder | Inte kört | inte kört | inte kört |
| Bilder och media > taket: en patient har högst 40 bilder, en bild högst 1 MB och en film högst 2 MB i demon | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: patientens bild granskas bara av vårdenheten som den skickades till, inte av en annan vårdenhet med aktivt val | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: en remissbilaga behåller avsändarens vårdenhet, så att en spärr gäller också i journalen, och patientens egen bilaga granskas först | Inte kört | inte kört | inte kört |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > annoteringar sparas som ett eget lager med författare, originalet ändras inte, och bara den som gjorde annoteringen tar bort den | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb | Inte kört | inte kört | inte kört |
| API för bilder och media 1.1 > bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Jämföra bilder av ett kroppsställe över tid inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.2.1.2 Bildhantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen | Inte kört | inte kört | inte kört |
| Bilder och media > jämförelse över tid: bilder av samma kroppsställe ställs i tidsordning med dagarna mellan dem | Inte kört | inte kört | inte kört |
| Bilder och media > behörighet: en bild från en annan vårdenhet kräver aktivt val, en spärrad syns inte alls, och undersköterskan ser bara omvårdnadens bilder | Inte kört | inte kört | inte kört |
| Bilder och media > taket: en patient har högst 40 bilder, en bild högst 1 MB och en film högst 2 MB i demon | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Inte kört | inte kört | inte kört |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Inte kört | inte kört | inte kört |
| Bildkodek > typen avgörs ur innehållet för bilder, filmer, ljud och PDF, och annat stöds inte | Inte kört | inte kört | inte kört |
| Bildkodek > filmens och ljudets längd och bildstorlek läses ur filen, med tak på antalet delar | Inte kört | inte kört | inte kört |
| Bildkodek > EXIF ger tiden när bilden togs, kameran, orienteringen och om bilden bär platsuppgifter | Inte kört | inte kört | inte kört |
| Bildkodek > servern gör miniatyren, vrider den efter EXIF och förstorar aldrig, och en bomb med för många pixlar avvisas | Inte kört | inte kört | inte kört |
| Bildkodek > servern ritar miniatyren för film, ljud och dokument, och ljudkurvan ur ett ljud i WAV | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > uppladdningen i delar har tak per person, patient och sandlåda, delar med fel storlek avvisas och en bild som inte går att avkoda kommer inte in | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > tiden när bilden togs och kameran läses ur EXIF, och platsuppgifter följer inte med till miniatyren | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > annoteringar sparas som ett eget lager med författare, originalet ändras inte, och bara den som gjorde annoteringen tar bort den | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > säkerhet: en annotering från en spärrad vårdenhet syns inte, och svaret är detsamma som utan den | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb | Inte kört | inte kört | inte kört |
| API för bilder och media 1.1 > bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb | Inte kört | inte kört | inte kört |
| Simulerat multimediaarkiv med DICOMweb > den renderade bilden är en PNG med fönstret, bilderna är desamma varje gång, och ett ogiltigt fönster avvisas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Jämföra bilder av ett kroppsställe över tid inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Visa en röntgenstudie ur arkivet med ett annat fönster inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.2.1.3 Integration mot externt multimediaarkiv

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > multimediaarkivet: undersökningen beställs med frågeställning, arkivet svarar med utlåtande och bildlänk, och bilden visas genom arkivet med behörighet och loggning | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Inte kört | inte kört | inte kört |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Inte kört | inte kört | inte kört |
| Simulerat multimediaarkiv med DICOMweb > en instans är en DICOM-fil i explicit VR little endian med patienten ur journalen och pixeldata i rätt storlek | Inte kört | inte kört | inte kört |
| Simulerat multimediaarkiv med DICOMweb > en patient med skyddad identitet är skyddad också i DICOM tills identiteten har visats | Inte kört | inte kört | inte kört |
| Simulerat multimediaarkiv med DICOMweb > DICOM JSON för sökning och metadata följer DICOMwebs format, och pixeldatan är en BulkDataURI | Inte kört | inte kört | inte kört |
| Simulerat multimediaarkiv med DICOMweb > den renderade bilden är en PNG med fönstret, bilderna är desamma varje gång, och ett ogiltigt fönster avvisas | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > DICOMweb: QIDO-RS söker patientens studier, WADO-RS hämtar instansen som DICOM-fil och den renderade bilden med fönster, med behörighet och loggning | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > säkerhet: DICOMweb visar inte en studie på en spärrad vårdenhet, en patient utan åtkomst ger en tom lista, och en studie för en annan patient finns inte | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > säkerhet: en sökning i DICOMweb på en patient utan åtkomst ger en tom lista och loggas som nekad | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > demons mall har trycksårsbilderna och en besvarad lungröntgen för Gunnar Åkesson, men inte seeden som testerna bygger på | Inte kört | inte kört | inte kört |
| API för bilder och media 1.1 > bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Visa en röntgenstudie ur arkivet med ett annat fönster inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.2.1.4 Import av media

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen | Inte kört | inte kört | inte kört |
| Bilder och media > en remissbilaga förs in i journalen med källan märkt, och en textbilaga stannar i remissen | Inte kört | inte kört | inte kört |
| Bilder och media > patientens uppladdning i Min journal går till en vårdenhet där patienten har kontakt och kommer in i journalen först efter granskning | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: patientens bild granskas bara av vårdenheten som den skickades till, inte av en annan vårdenhet med aktivt val | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: en remissbilaga behåller avsändarens vårdenhet, så att en spärr gäller också i journalen, och patientens egen bilaga granskas först | Inte kört | inte kört | inte kört |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Inte kört | inte kört | inte kört |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Inte kört | inte kört | inte kört |
| Bildkodek > typen avgörs ur innehållet för bilder, filmer, ljud och PDF, och annat stöds inte | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > tiden när bilden togs och kameran läses ur EXIF, och platsuppgifter följer inte med till miniatyren | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > en bild från en medicinteknisk apparat väntar på granskning med apparatens serienummer, och en bild som enligt apparaten gäller en annan patient kan inte föras in | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > bilder från en annan vårdgivare hämtas bara med patientens samtycke, behåller sitt ursprung och kommer in i journalen efter granskning | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > säkerhet: bilder från en annan vårdgivare kräver ett aktivt val med syfte i sessionen för samma person och patient, som sammanhållen journalföring | Inte kört | inte kört | inte kört |
| Bilder och media 1.1 > säkerhet: granskningen kräver skrivrätten för bildens kategori, så en roll med bara omvårdnadens skrivrätt för inte in en bild i journalens kategori | Inte kört | inte kört | inte kört |
| API för bilder och media 1.1 > bilder 1.1: sjuksköterskan hämtar från apparaten och granskar, och läkaren hämtar bilder från en annan vårdgivare med samtycke | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Hämta en bild från en apparat och föra in den i journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.3.1.1 Funktionalitet för SIP och SPU

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Samordnad planering > systemet föreslår SPU och skickar inskrivningsmeddelandet med lagens uppgifter till kommunen och vårdcentralen | Inte kört | inte kört | inte kört |
| Samordnad planering > utskrivningsklar: underrättelsen går ut, kallelsen ska ske inom tre dagar och betalningsansvaret räknas med villkoren | Inte kört | inte kört | inte kört |
| Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar | Inte kört | inte kört | inte kört |
| Samordnad planering > skyddad identitet: ingen adress skickas och kommunen ser inte namnet | Inte kört | inte kört | inte kört |
| Samordnad planering > kommunen får aldrig adress, namn eller personnummer för en patient med skyddad identitet, inte heller när skyddet tillkommer efter inskrivningsmeddelandet | Inte kört | inte kört | inte kört |
| Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal | Inte kört | inte kört | inte kört |

### 4.3.1.2 Funktionalitet för SIP och SPU

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Samordnad planering > vårdcentralen utser fast vårdkontakt och kallar till samordnad individuell planering | Inte kört | inte kört | inte kört |
| Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar | Inte kört | inte kört | inte kört |
| Samordnad planering > informationen förs över när patienten skrivs ut, och en spärrad vårdenhets planering syns inte för andra | Inte kört | inte kört | inte kört |
| Samordnad planering > skyddad identitet: ingen adress skickas och kommunen ser inte namnet | Inte kört | inte kört | inte kört |
| Samordnad planering > kommunen får aldrig adress, namn eller personnummer för en patient med skyddad identitet, inte heller när skyddet tillkommer efter inskrivningsmeddelandet | Inte kört | inte kört | inte kört |
| Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal | Inte kört | inte kört | inte kört |

### 4.3.1.3 Uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Samordnad planering > uppföljningen av SIP och SPU räknar per vårdenhet utan personuppgifter | Inte kört | inte kört | inte kört |

### 4.4.1.1 Patient- och provbunden elektronisk beställning och svar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Inte kört | inte kört | inte kört |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Inte kört | inte kört | inte kört |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| Beställning och svar > vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter | Inte kört | inte kört | inte kört |
| API för beställning och svar > läkaren beställer, sjuksköterskan tar proverna, demoknappen ger svaret och läkaren vidimerar från inkorgen | Inte kört | inte kört | inte kört |
| Beställning och svar > nycklar som constructor, __proto__ och toString är aldrig analyser, paket, laboratorier, kontroller eller frekvenser | Inte kört | inte kört | inte kört |
| Min journal > provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt | Inte kört | inte kört | inte kört |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 4.4.1.2 Flera utförande laboratorier inom samma disciplin

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > klinisk kemi har flera utförande laboratorier, och systemet väljer det som hör till sjukhuset | Inte kört | inte kört | inte kört |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Inte kört | inte kört | inte kört |

### 4.4.1.3 Unikt beställnings-ID

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering | Inte kört | inte kört | inte kört |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Inte kört | inte kört | inte kört |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Inte kört | inte kört | inte kört |

### 4.4.1.4 Tolkningssäkerhet i beställning och svar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Inte kört | inte kört | inte kört |
| Beställning och svar > katalogen: varje analys har rör och disciplin, varje labbvärde har NPU-kod och varje paket har kända analyser | Inte kört | inte kört | inte kört |
| FHIR-struktur > labbvärden har NPU-kod och UCUM-enhet | Inte kört | inte kört | inte kört |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Inte kört | inte kört | inte kört |

### 4.4.1.5 Swedacs ackrediteringsföreskrifter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Inte kört | inte kört | inte kört |
| Beställning och svar > beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering | Inte kört | inte kört | inte kört |
| Beställning och svar > etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val | Inte kört | inte kört | inte kört |
| Rättade svar > ett rättat svar ersätter mätvärdet, den tidigare versionen finns kvar oförändrad och svaret vidimeras på nytt | Inte kört | inte kört | inte kört |
| Rättade svar > producentsystemet skickar ett rättat svar med status corrected, och varje version har ett signerat bevis som stämmer | Inte kört | inte kört | inte kört |
| Patientnära analyser > instrumentets svar med fel etikett avvisas, och svaret bockar av kontrollen av samma mätvärde | Inte kört | inte kört | inte kört |
| Parametrar för beställning och svar > vad som förs över till det mottagande systemet, etikettskrivarna och anvisningarna ändras med fyra ögon och slår igenom | Inte kört | inte kört | inte kört |
| Koder i svar > koder i svaret från ett specialistsystem: KVÅ, Snomed CT och vårdförlopp tas emot med text, och en kod i fel form avvisas | Inte kört | inte kört | inte kört |

### 4.4.2.1 Följa beställnings- och svarsprocessen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Inte kört | inte kört | inte kört |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Inte kört | inte kört | inte kört |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| Beställning och svar > vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter | Inte kört | inte kört | inte kört |
| API för beställning och svar > läkaren beställer, sjuksköterskan tar proverna, demoknappen ger svaret och läkaren vidimerar från inkorgen | Inte kört | inte kört | inte kört |

### 4.4.2.2 Visa alla planerade prover och undersökningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR för beställning och svar > samma behörighet som i gränssnittet: en annan vårdenhets beställning kräver aktivt val och en spärrad syns inte alls | Inte kört | inte kört | inte kört |
| Kontroller till avdelningen > de planerade uppgifterna per vårdenhet och dag har formatet i docs/design.md och visar bara det som den inloggade får se | Inte kört | inte kört | inte kört |
| Kontroller till avdelningen > kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > planerat: patientens alla planerade prover, undersökningar och kontroller från alla vårdenheter som användaren får se | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > en beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma beställnings-id | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret | Inte kört | inte kört | inte kört |
| API för undersökningar > läkaren beställer röntgen med frågan om graviditet, röntgensjuksköterskan bokar och registrerar, och Min journal visar statusen | Inte kört | inte kört | inte kört |

### 4.4.2.3 Överlåta ansvar till annan remittent

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ansvaret överlåts till en annan läkare, som får svaren att vidimera, men bara om läkaren har vårdrelation till patienten | Inte kört | inte kört | inte kört |
| API för beställning och svar > en spärrad beställning som har överlåtits till en annan vårdenhets läkare röjs inte i inkorgen | Inte kört | inte kört | inte kört |

### 4.4.2.4 Avvikelser från svar visas

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| Beställning och svar > ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan | Inte kört | inte kört | inte kört |

### 4.4.2.5 Presentationsvy

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Inte kört | inte kört | inte kört |
| Beställning och svar > beställningarna följer med när två journaler slås samman, så att allt för patienten visas samlat | Inte kört | inte kört | inte kört |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| Beställning och svar > ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan | Inte kört | inte kört | inte kört |
| Beställning och svar > en beställning trots dubblettvarning sparar bara analysnamnen, så att historiken inte röjer ett svar som en kollega inte får se | Inte kört | inte kört | inte kört |
| Status i Min journal > patienten ser beställningarnas status, bokad tid och förberedelse, och svaret först när det är vidimerat | Inte kört | inte kört | inte kört |
| Status i Min journal > en vårdenhet vars anteckningar inte visas i Min journal visar inte heller sina beställningar | Inte kört | inte kört | inte kört |
| Rättade svar > den som läste den tidigare versionen får det rättade svaret i inkorgen, och ingen annan | Inte kört | inte kört | inte kört |

### 4.4.2.6 Beställning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Underlag i beställning och svar > underlag bifogas till beställningen, typen avgörs ur innehållet, med tak per fil och beställning, och visas med beställningens behörighet | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > upprepad beställning: en serie beställningar med rätt tider, utan dubblettvarning för de egna delarna och högst 60 dagar framåt | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > jodkontrast: utan aktuellt eGFR lägger systemet till P-Kreatinin, och röntgen bokar först när svaret har kommit | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > jodkontrast: eGFR under 30 stoppar, 30 till 44 kräver kvittens, och ett värde på en spärrad vårdenhet varken räknas eller nämns | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > graviditet: systemet frågar bara kvinnor 12 till 55 år före strålning, stoppar strålning mot buken och tar en registrerad graviditet som ja | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > magnetkamera: implantat i uppmärksamhetsinformationen eller enligt beställaren kräver MR-säkerhetskontroll innan röntgen bokar | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Beställa en röntgenundersökning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Inte kört | inte kört | inte kört |
| Beställning och svar > ett prov som nyss är taget eller redan är beställt tas bort ur paketet med en förklaring, och en ny beställning kräver kvittens | Inte kört | inte kört | inte kört |
| Beställning och svar > dubblettvarningen räknas bara på det läkaren får se: en dold rad på en spärrad enhet ändrar inget i svaret | Inte kört | inte kört | inte kört |
| Beställning och svar > provtagningsanvisningen har rören i provtagningsordning och förberedelserna för patienten | Inte kört | inte kört | inte kört |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Inte kört | inte kört | inte kört |
| Beställning och svar > sjuksköterskan och undersköterskan beställer på uppdrag av en läkare på vårdenheten, som signerar i inkorgen | Inte kört | inte kört | inte kört |
| Beställning och svar > signeringen prövar behörigheten först och nämner inte den ansvariga läkaren för den som inte får se beställningen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Beställa ett standardpaket med prover inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera provtagning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |

### 4.4.2.7 Planerade beställningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontroller till avdelningen > de planerade uppgifterna per vårdenhet och dag har formatet i docs/design.md och visar bara det som den inloggade får se | Inte kört | inte kört | inte kört |
| Kontroller till avdelningen > kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer | Inte kört | inte kört | inte kört |
| API för kontroller och planerade uppgifter > läkaren ordinerar kontroller och sjuksköterskan hämtar avdelningens planerade uppgifter, och varje patient loggas | Inte kört | inte kört | inte kört |
| API för beställning och svar > provtagningslistan visar vårdenhetens prover att ta, med skyddad identitet maskerad, och loggar varje patient | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > planerat: patientens alla planerade prover, undersökningar och kontroller från alla vårdenheter som användaren får se | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > röntgenklinikens arbetslista: prioritet och senaste dag, föreslagen tid, bokning, utförande med studie i arkivet och loggning med grunden utförande | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > upprepad beställning: en serie beställningar med rätt tider, utan dubblettvarning för de egna delarna och högst 60 dagar framåt | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Boka en inkommen undersökning på röntgenkliniken inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.4.2.8 Flera beställningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Inte kört | inte kört | inte kört |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > en beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma beställnings-id | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > jodkontrast: utan aktuellt eGFR lägger systemet till P-Kreatinin, och röntgen bokar först när svaret har kommit | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > standardiserat vårdförlopp föreslås ur vårdkontakten och följer med i beställningen, svaret och till producentsystemet | Inte kört | inte kört | inte kört |

### 4.4.2.9 Justering av beställning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > makulering kräver orsak och går inte efter svar, och en analys tas bort eller läggs till innan röret är taget | Inte kört | inte kört | inte kört |
| Beställning och svar > beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering | Inte kört | inte kört | inte kört |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Inte kört | inte kört | inte kört |

### 4.4.2.10 Överlåtelse

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ansvaret överlåts till en annan läkare, som får svaren att vidimera, men bara om läkaren har vårdrelation till patienten | Inte kört | inte kört | inte kört |
| API för beställning och svar > en spärrad beställning som har överlåtits till en annan vårdenhets läkare röjs inte i inkorgen | Inte kört | inte kört | inte kört |

### 4.4.2.11 Kodverk

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Inte kört | inte kört | inte kört |
| Beställning och svar > katalogen: varje analys har rör och disciplin, varje labbvärde har NPU-kod och varje paket har kända analyser | Inte kört | inte kört | inte kört |
| Koder i svar > koder i svaret från ett specialistsystem: KVÅ, Snomed CT och vårdförlopp tas emot med text, och en kod i fel form avvisas | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > utlåtandet har KVÅ, fynd i Snomed CT, vårdförloppet och studiens id, och den ansvariga läkaren vidimerar det | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > standardiserat vårdförlopp föreslås ur vårdkontakten och följer med i beställningen, svaret och till producentsystemet | Inte kört | inte kört | inte kört |
| Underlag i beställning och svar > underlag i svaret från producentsystemet (presentedForm) sparas och visas i beställningen och i FHIR | Inte kört | inte kört | inte kört |

### 4.4.2.12 Blodprodukter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Blodprodukter > blodgruppering och bastest beställs till blodcentralen som prover och besvaras med blodgrupp och antikroppsscreening | Inte kört | inte kört | inte kört |
| Blodprodukter > beställningen av blod beställer själv blodgruppering och bastest som saknas och väntar på svaren innan blodcentralen bereder | Inte kört | inte kört | inte kört |
| Blodprodukter > blodcentralen förenlighetsprövar och bereder enheter med patientens blodgrupp, och beställningen kan följas från upprättad till avslutad | Inte kört | inte kört | inte kört |
| Blodprodukter > vid sängen kontrollerar systemet id-bandet, enhetsnumret, blodgruppen och den andra personen, och blod som inte startats inom 30 minuter återlämnas | Inte kört | inte kört | inte kört |
| Blodprodukter > dubbelkontrollen vid sängen: den andra personen bekräftar i sin egen session, den som förberedde kan inte kontrollera själv och ett id i anropet räcker inte | Inte kört | inte kört | inte kört |
| Blodprodukter > säkerhet: en blodbeställning eller enhet för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Blodprodukter > förenligheten: erytrocyter efter AB0 och RhD, plasma åt andra hållet och trombocyter AB0-lika | Inte kört | inte kört | inte kört |
| Blodprodukter > ett positivt bastest stoppar beställningen hos blodcentralen med en förklaring | Inte kört | inte kört | inte kört |
| Blodprodukter > behörighet: sjuksköterskan beställer inte blod, en annan vårdenhet hanterar inte blodet och en spärrad beställning syns inte | Inte kört | inte kört | inte kört |
| API för specialistområdena > blod: läkaren beställer, proverna besvaras och sjuksköterskan och läkaren kontrollerar vid sängen i var sin inloggning | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 > transfusionen blir en ordination och en administrering i läkemedelslistan, med enhetsnumret och de två som kontrollerade | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 > en blodprodukt i läkemedelslistan ges bara från blodbeställningen, aldrig med en vanlig administrering | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 > kontrollen vid sängen går genom den gemensamma transfusionskontrollen: ett bastest som har gått ut sedan blodet bereddes stoppar transfusionen | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 > hemovigilans: en transfusionsreaktion är en egen rapport som systemet klassar, transfusionen stoppas och proverna beställs med ett klick | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 > säkerhet: en reaktion eller dess prover för en annan patient eller vårdenhet ges inte, och en spärrad reaktion syns inte i blodcentralens vy | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 > blodcentralens vy visar vårdenhetens beställningar i kedjan, enheterna på avdelningen och lagret per blodgrupp, och varje patient loggas | Inte kört | inte kört | inte kört |
| Blodprodukter i version 1.1 via API > API: blodcentralens vy, journalens markering och reaktionen rapporteras med proverna i två anrop | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Beställa blod inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.4.2.13 Svar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rättade svar > ett rättat svar ersätter mätvärdet, den tidigare versionen finns kvar oförändrad och svaret vidimeras på nytt | Inte kört | inte kört | inte kört |
| Rättade svar > den som läste den tidigare versionen får det rättade svaret i inkorgen, och ingen annan | Inte kört | inte kört | inte kört |
| Rättade svar > producentsystemet skickar ett rättat svar med status corrected, och varje version har ett signerat bevis som stämmer | Inte kört | inte kört | inte kört |
| Rättade svar > demoknappen för ett rättat svar kräver beställningsrätt på den beställande vårdenheten och gäller inte anslutna producentsystem eller instrument | Inte kört | inte kört | inte kört |
| Underlag i beställning och svar > underlag i svaret från producentsystemet (presentedForm) sparas och visas i beställningen och i FHIR | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret | Inte kört | inte kört | inte kört |
| Undersökningar i beställning och svar > utlåtandet har KVÅ, fynd i Snomed CT, vårdförloppet och studiens id, och den ansvariga läkaren vidimerar det | Inte kört | inte kört | inte kört |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Inte kört | inte kört | inte kört |
| Beställning och svar > vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter | Inte kört | inte kört | inte kört |
| Beställning och svar > ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan | Inte kört | inte kört | inte kört |
| Beställning och svar > ett mätvärde som är undantaget från visning visas inte som svar i beställningen eller i inkorgen | Inte kört | inte kört | inte kört |
| Min journal > provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt | Inte kört | inte kört | inte kört |

### 4.4.2.14 Patientnära analyser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontroller till avdelningen > läkaren ordinerar puls, blodtryck, SR, temperatur, vikt och vätskebalans till i morgon klockan 7, och systemet lägger dem på avdelningen där patienten ligger | Inte kört | inte kört | inte kört |
| Kontroller till avdelningen > kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer | Inte kört | inte kört | inte kört |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Patientnära analyser > en patientnära analys beställs, provet tas och instrumentet skickar svaret genom det öppna gränssnittet med etiketten | Inte kört | inte kört | inte kört |
| Patientnära analyser > instrumentets svar med fel etikett avvisas, och svaret bockar av kontrollen av samma mätvärde | Inte kört | inte kört | inte kört |

### 4.4.2.15 Uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter | Inte kört | inte kört | inte kört |

### 4.4.3.1 Skapa och skriva ut provtagningsetiketter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Streckkod och etikett > etiketterna som PDF: en sida per etikett för etikettskrivaren och ett A4-ark för en vanlig skrivare | Inte kört | inte kört | inte kört |
| Beställning och svar > etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val | Inte kört | inte kört | inte kört |
| Streckkod och etikett > Code 128 B: varje mönster är 11 moduler, kontrollsiffran räknas enligt standarden och stoppkoden avslutar | Inte kört | inte kört | inte kört |

### 4.4.3.2 Utskrift etikett

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val | Inte kört | inte kört | inte kört |
| Streckkod och etikett > etiketterna som PDF: en sida per etikett för etikettskrivaren och ett A4-ark för en vanlig skrivare | Inte kört | inte kört | inte kört |
| Streckkod och etikett > Code 128 B: varje mönster är 11 moduler, kontrollsiffran räknas enligt standarden och stoppkoden avslutar | Inte kört | inte kört | inte kört |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Inte kört | inte kört | inte kört |

### 4.5.1.1 Funktionalitet för operationsplanering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > läkaren anmäler till operation med ingrepp och sida, och systemet sätter KVÅ, operationstid, anestesi och målet för väntetiden ur prioriteten | Inte kört | inte kört | inte kört |
| Operationsplanering > förberedelserna: systemet listar proverna som saknas, med blodgruppering och bastest vid risk för blödning, och beställer dem med ett klick | Inte kört | inte kört | inte kört |
| Operationsplanering > väntelistan för operation står i ordning efter målet för väntetiden och visar bara patienter som den inloggade får se | Inte kört | inte kört | inte kört |
| Operationsplanering > systemet föreslår första lediga tid i en sal på sjukhuset med operatör och operationssjuksköterska, och nekar en dubbelbokning av sal eller team | Inte kört | inte kört | inte kört |
| Operationsplanering > planeringen skriver kallelsen med förberedelserna, och en struken operation får orsak och står kvar på väntelistan | Inte kört | inte kört | inte kört |
| Operationsplanering > under operationen sätter systemet tiderna i ordning, och WHO:s checklista måste vara klar före anestesi, snitt och utflyttning | Inte kört | inte kört | inte kört |
| Operationsplanering > ingreppet registreras som åtgärd med KVÅ när operationen är slut, och implantatet med lot krävs innan patienten lämnar salen | Inte kört | inte kört | inte kört |
| Operationsplanering > uppvakningen prövar kriterierna för utskrivning mot kontrollerna och förklarar vad som saknas | Inte kört | inte kört | inte kört |
| Operationsplanering > utskrivningen från uppvakningen skriver överrapporteringen och ordinerar de postoperativa kontrollerna till avdelningen | Inte kört | inte kört | inte kört |
| Operationsplanering > dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid | Inte kört | inte kört | inte kört |
| Operationsplanering > uppföljningen räknar väntetider, strukna operationer, salsutnyttjande och produktion per ingrepp utan personuppgifter | Inte kört | inte kört | inte kört |
| Operationsplanering > behörighet: undersköterskan läser men anmäler inte, och en spärrad vårdenhets operation syns inte i journalen | Inte kört | inte kört | inte kört |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Inte kört | inte kört | inte kört |
| Operation 1.1 > salsblocken fördelar salarna mellan vårdenheterna, också på andra sjukhus, och ett block kan släppas och tas av en annan vårdenhet | Inte kört | inte kört | inte kört |
| Operation 1.1 > ett block som vårdenheten inte har fyllt släpps för andra vårdenheter på sjukhuset två dagar före | Inte kört | inte kört | inte kört |
| Operation 1.1 > teamet planeras med anestesiläkare och anestesisjuksköterska, och utrustning och instrumentgaller bokas och prövas mot krockar | Inte kört | inte kört | inte kört |
| Operation 1.1 > vårdhändelser som kan påverka ett planerat ingrepp visas med anmälan, och bara det som den inloggade får se räknas | Inte kört | inte kört | inte kört |
| Operation 1.1 > identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt | Inte kört | inte kört | inte kört |
| Operation 1.1 > sessionen säger om vårdenheten opererar, och dagens program räknar ut när nästa operation kan börja när en operation drar ut på tiden | Inte kört | inte kört | inte kört |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > uppföljningen räknar inflöde, utrustning, punktlighet och tid på uppvakningen, och datauttaget har operationerna utan personuppgifter | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > säkerhet och behörighet: anestesijournalen, sterilgodset och materialet ger 404 för en annan patient, ändras bara av den anmälande vårdenheten och syns inte bakom en spärr | Inte kört | inte kört | inte kört |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Planera en operation från väntelistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Registrera att patienten kommer in på salen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.5.1.2 Preoperativ fas

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > läkaren anmäler till operation med ingrepp och sida, och systemet sätter KVÅ, operationstid, anestesi och målet för väntetiden ur prioriteten | Inte kört | inte kört | inte kört |
| Operationsplanering > förberedelserna: systemet listar proverna som saknas, med blodgruppering och bastest vid risk för blödning, och beställer dem med ett klick | Inte kört | inte kört | inte kört |
| Operationsplanering > väntelistan för operation står i ordning efter målet för väntetiden och visar bara patienter som den inloggade får se | Inte kört | inte kört | inte kört |
| Operationsplanering > systemet föreslår första lediga tid i en sal på sjukhuset med operatör och operationssjuksköterska, och nekar en dubbelbokning av sal eller team | Inte kört | inte kört | inte kört |
| Operationsplanering > planeringen skriver kallelsen med förberedelserna, och en struken operation får orsak och står kvar på väntelistan | Inte kört | inte kört | inte kört |
| Operationsplanering > dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid | Inte kört | inte kört | inte kört |
| Operationsplanering > behörighet: undersköterskan läser men anmäler inte, och en spärrad vårdenhets operation syns inte i journalen | Inte kört | inte kört | inte kört |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Inte kört | inte kört | inte kört |
| Operation 1.1 > salsblocken fördelar salarna mellan vårdenheterna, också på andra sjukhus, och ett block kan släppas och tas av en annan vårdenhet | Inte kört | inte kört | inte kört |
| Operation 1.1 > ett block som vårdenheten inte har fyllt släpps för andra vårdenheter på sjukhuset två dagar före | Inte kört | inte kört | inte kört |
| Operation 1.1 > teamet planeras med anestesiläkare och anestesisjuksköterska, och utrustning och instrumentgaller bokas och prövas mot krockar | Inte kört | inte kört | inte kört |
| Operation 1.1 > vårdhändelser som kan påverka ett planerat ingrepp visas med anmälan, och bara det som den inloggade får se räknas | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten | Inte kört | inte kört | inte kört |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Inte kört | inte kört | inte kört |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Planera en operation från väntelistan inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat | Inte kört | inte kört | inte kört |
| Arbetsdagen på mottagningarna (runda 13, r4) > operationsprogrammet: mitt på förmiddagen är den första operationen gjord eller pågår och den andra väntar | Inte kört | inte kört | inte kört |
| Anestesiläkaren (runda 13, r4, E1-32) > ser de operationer som är beställda till anestesienheten i programmet, och inte andra sjukhus operationer | Inte kört | inte kört | inte kört |
| Anestesiläkaren, säkerhetsgranskningen (runda 13, r4) > en avslutad operation (klar) visas inte för anestesienheten i programmet, bara som upptagen tid | Inte kört | inte kört | inte kört |

### 4.5.1.3 Perioperativ fas

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > under operationen sätter systemet tiderna i ordning, och WHO:s checklista måste vara klar före anestesi, snitt och utflyttning | Inte kört | inte kört | inte kört |
| Operationsplanering > ingreppet registreras som åtgärd med KVÅ när operationen är slut, och implantatet med lot krävs innan patienten lämnar salen | Inte kört | inte kört | inte kört |
| Operationsplanering > dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid | Inte kört | inte kört | inte kört |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Inte kört | inte kört | inte kört |
| Operation 1.1 > identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt | Inte kört | inte kört | inte kört |
| Operation 1.1 > sessionen säger om vårdenheten opererar, och dagens program räknar ut när nästa operation kan börja när en operation drar ut på tiden | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > säkerhet och behörighet: anestesijournalen, sterilgodset och materialet ger 404 för en annan patient, ändras bara av den anmälande vårdenheten och syns inte bakom en spärr | Inte kört | inte kört | inte kört |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Inte kört | inte kört | inte kört |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera att patienten kommer in på salen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare | Inte kört | inte kört | inte kört |

### 4.5.1.4 Postoperativ fas

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > uppvakningen prövar kriterierna för utskrivning mot kontrollerna och förklarar vad som saknas | Inte kört | inte kört | inte kört |
| Operationsplanering > utskrivningen från uppvakningen skriver överrapporteringen och ordinerar de postoperativa kontrollerna till avdelningen | Inte kört | inte kört | inte kört |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt | Inte kört | inte kört | inte kört |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Inte kört | inte kört | inte kört |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Inte kört | inte kört | inte kört |

### 4.5.1.5 Uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > uppföljningen räknar väntetider, strukna operationer, salsutnyttjande och produktion per ingrepp utan personuppgifter | Inte kört | inte kört | inte kört |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > uppföljningen räknar inflöde, utrustning, punktlighet och tid på uppvakningen, och datauttaget har operationerna utan personuppgifter | Inte kört | inte kört | inte kört |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Inte kört | inte kört | inte kört |

### 4.6.1.1 Funktionalitet för anestesi och intensivvård

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > översikten visar alla patienter på intensivvårdsavdelningen med senaste värden, larm, utrustning och vätskebalans | Inte kört | inte kört | inte kört |
| Intensivvård > övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta | Inte kört | inte kört | inte kört |
| Intensivvård > analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag | Inte kört | inte kört | inte kört |
| Intensivvård > anestesibedömningen hämtar läkemedel, överkänslighet, diagnoser och tidigare anestesier ur journalen och föreslår ASA-klass och fasta | Inte kört | inte kört | inte kört |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Inte kört | inte kört | inte kört |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Inte kört | inte kört | inte kört |
| Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > läkaren sätter patientens egna gränser, servern prövar typ och gräns, och en ny regel avslutar den förra | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > läkaren sätter mål för vätska, energi och vikt, och systemet visar aktuellt underskott och rekommendationer, också för elektrolyterna | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > NEMS föreslås ur journalen med orsak för varje post, sjuksköterskan bekräftar, och servern räknar poängen | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > nyheterna i version 1.1 för intensivvården och tillväxten visas för rätt roller | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Inte kört | inte kört | inte kört |

### 4.6.1.2 Översikt och övervakning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > översikten visar alla patienter på intensivvårdsavdelningen med senaste värden, larm, utrustning och vätskebalans | Inte kört | inte kört | inte kört |
| Intensivvård > övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta | Inte kört | inte kört | inte kört |
| Medicinteknik, infusionspump > den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen | Inte kört | inte kört | inte kört |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Öppna intensivvårdens översikt och övervakningen av en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Intensivvård, version 1.1 > realtidsvisningen har vågformer som följer pulsen, blodtrycket och andningen, och samma tid ger samma kurva | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Inte kört | inte kört | inte kört |

### 4.6.1.3 Analys och beslut

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag | Inte kört | inte kört | inte kört |
| Intensivvård > parametrarna för analysen finns i konfigurationen med samma standardvärden som modulen | Inte kört | inte kört | inte kört |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Inte kört | inte kört | inte kört |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > patientens egen gräns prövas i analysen, och en mildare gräns gör avdelningens larm till en observation i stället för att tysta det | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > läkaren sätter patientens egna gränser, servern prövar typ och gräns, och en ny regel avslutar den förra | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > överrapporteringen röjer varken orsak eller tid för en vårdkontakt på en spärrad vårdenhet eller på en annan vårdenhet utan aktivt val | Inte kört | inte kört | inte kört |

### 4.6.1.4 Anestesibedömning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > anestesibedömningen hämtar läkemedel, överkänslighet, diagnoser och tidigare anestesier ur journalen och föreslår ASA-klass och fasta | Inte kört | inte kört | inte kört |
| Intensivvård > anestesibedömningen räknar bara det som läkaren får se, så en spärrad vårdenhets diagnoser röjs inte | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesi och material > anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten | Inte kört | inte kört | inte kört |
| Operation 1.1 > identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt | Inte kört | inte kört | inte kört |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Inte kört | inte kört | inte kört |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt | Inte kört | inte kört | inte kört |
| Operation 1.1, anestesienheten > säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat | Inte kört | inte kört | inte kört |

### 4.6.1.5 Utökat stöd för läkemedelshantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Inte kört | inte kört | inte kört |
| Intensivvård > en infusion ordineras inte utan godkänd vikt, och en vikt som patienten själv har mätt räknas inte | Inte kört | inte kört | inte kört |
| Intensivvård > infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen | Inte kört | inte kört | inte kört |
| Medicinteknik, infusionspump > en infusionspump rapporterar pågående dos, och systemet registrerar given dos med källan utrustning och kontrollerar den mot ordinationen och dygnsdosen | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > infusionerna har en sammanräkning av givna doser det senaste dygnet och sedan starten | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > noradrenalin ordineras i µg/kg/min och titreras mot målet för medelartärtrycket, patientens eget mål när läkaren har satt ett | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > propofol och midazolam ordineras med dosintervall utan automatisk titrering, och utdelningen visar varje dos med tid, vem och ml/h | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > en dosändring prövar armbandet mot patientens identitet, och ett armband som inte hör till patienten nekas och loggas | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > utdelningen röjer varken grund eller namn för en titrering på en spärrad vårdenhet, men dosen räknas med i summan | Inte kört | inte kört | inte kört |

### 4.6.1.6 Utökat stöd för vätskebalans

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Inte kört | inte kört | inte kört |
| Intensivvård > infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen | Inte kört | inte kört | inte kört |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Inte kört | inte kört | inte kört |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Inte kört | inte kört | inte kört |
| Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > perspiratio räknas ur vikten, febern och andningsstödet, och dygnsbrytningen kl. 06 följer svensk tid också vid omställningen | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > läkaren sätter mål för vätska, energi och vikt, och systemet visar aktuellt underskott och rekommendationer, också för elektrolyterna | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Inte kört | inte kört | inte kört |

### 4.6.1.7 Uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter | Inte kört | inte kört | inte kört |
| Intensivvård, version 1.1 > NEMS föreslås ur journalen med orsak för varje post, sjuksköterskan bekräftar, och servern räknar poängen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Registrera vårdtyngden enligt NEMS för en patient på intensivvården inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Inte kört | inte kört | inte kört |

### 4.7.1.1 Funktionalitet för mödrahälsovård, graviditet och förlossning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > graviditetsjournalen: systemet räknar beräknad partus ur sista mens och väljer ultraljudet när det skiljer mer än sju dagar | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > besöksprogrammet och provschemat räknas ur graviditetsveckan, och systemet beställer proverna vid nästa besök | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, och flerbörd ger tätare besök | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > vid besöket varnar systemet för förhöjt blodtryck med protein i urinen, avvikande symfys-fundusmått och fosterljud, och blodtrycket blir ett mätvärde | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > partogrammet: systemet räknar varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > vid tvillingfödsel får varje barn en egen journal med reservnummer kopplad till modern, och födelseuppgifterna förs vidare till barnhälsovården | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > behörighet: undersköterskan för inte graviditetsjournalen, och en graviditet på en spärrad vårdenhet syns inte för förlossningen | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > IVF-graviditeten: beräknad partus räknas från embryoöverföringen, ultraljudet ändrar den inte och IVF ingår i riskbedömningen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > ultraljudsjournalen: ett ultraljud till vecka 22 daterar graviditeten, och tillväxtultraljudet jämför den skattade vikten och varnar för liten för tiden och viktskillnad mellan tvillingar | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > inskrivningssamtalet: levnadsvanorna blir en signerad anteckning, och tobak och anamnes ger råd och beslutsstöd för graviditetsdiabetes och havandeskapsförgiftning | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > frågorna om våld: svaren lämnas aldrig ut i graviditetsjournalen, uppföljningen eller registret och läses bara på den vårdenhet som ställde dem, med logg | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > frågorna om våld ställs bara när kvinnan är ensam, och annars påminner systemet vid nästa besök | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > CTG från simulerad utrustning: systemet klassar kurvan som normal, avvikande eller patologisk, och barnmorskan bekräftar eller motiverar en annan bedömning | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > CTG vid tvillingar har en kanal och en analys per foster | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > smärtlindring: före EDA kontrollerar systemet trombocyterna bland det som den inloggade får se | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > födelseanmälan till Skatteverket (simulerad): barnet får ett av Skatteverkets testpersonnummer i stället för reservnumret, och en mor utan personnummer får förklaringen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > BB-journalen: systemet räknar viktnedgången, varnar för feber och blödning, säger när PKU tas och prövar utskrivningskriterierna för mor och barn | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > uppföljningen räknar inskrivning, ultraljud, smärtlindring, CTG, födelseanmälan och efterkontroll utan personuppgifter | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > API: barnmorskan på förlossningen kopplar CTG, bedömer, registrerar smärtlindring, födelse, födelseanmälan och BB i gränssnittets anrop | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > datauttaget har tabellerna Graviditet och Forlossning utan personuppgifter och utan svaren om våld | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter visas utan namn och personnummer i förlossningen, BB och födelseanmälan, och ett barn utan åtkomst syns inte i moderns vy | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > samtycke: svaren om våld visas för en annan enhet bara med kvinnans samtycke, som bara den enhet som ställde frågorna ger och återkallar, och ett återkallat eller utgånget samtycke stänger direkt | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > Min journal: graviditeten visas med besöksprogram, beräknad partus, ultraljud och provsvar efter visningsreglerna, och svaren om våld och samtycket syns aldrig, inte heller för ombud eller i loggutdraget | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > demopatienterna läggs in av sig själva första gången barnmorskan på förlossningen loggar in i en sandlåda, och bara en gång | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid | Inte kört | inte kört | inte kört |

### 4.7.1.2 Mödrahälsovård och handläggning under graviditet

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > graviditetsjournalen: systemet räknar beräknad partus ur sista mens och väljer ultraljudet när det skiljer mer än sju dagar | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > besöksprogrammet och provschemat räknas ur graviditetsveckan, och systemet beställer proverna vid nästa besök | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, och flerbörd ger tätare besök | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > vid besöket varnar systemet för förhöjt blodtryck med protein i urinen, avvikande symfys-fundusmått och fosterljud, och blodtrycket blir ett mätvärde | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > behörighet: undersköterskan för inte graviditetsjournalen, och en graviditet på en spärrad vårdenhet syns inte för förlossningen | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > IVF-graviditeten: beräknad partus räknas från embryoöverföringen, ultraljudet ändrar den inte och IVF ingår i riskbedömningen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > ultraljudsjournalen: ett ultraljud till vecka 22 daterar graviditeten, och tillväxtultraljudet jämför den skattade vikten och varnar för liten för tiden och viktskillnad mellan tvillingar | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > inskrivningssamtalet: levnadsvanorna blir en signerad anteckning, och tobak och anamnes ger råd och beslutsstöd för graviditetsdiabetes och havandeskapsförgiftning | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > frågorna om våld: svaren lämnas aldrig ut i graviditetsjournalen, uppföljningen eller registret och läses bara på den vårdenhet som ställde dem, med logg | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > frågorna om våld ställs bara när kvinnan är ensam, och annars påminner systemet vid nästa besök | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter visas utan namn och personnummer i förlossningen, BB och födelseanmälan, och ett barn utan åtkomst syns inte i moderns vy | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > samtycke: svaren om våld visas för en annan enhet bara med kvinnans samtycke, som bara den enhet som ställde frågorna ger och återkallar, och ett återkallat eller utgånget samtycke stänger direkt | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > Min journal: graviditeten visas med besöksprogram, beräknad partus, ultraljud och provsvar efter visningsreglerna, och svaren om våld och samtycket syns aldrig, inte heller för ombud eller i loggutdraget | Inte kört | inte kört | inte kört |

### 4.7.1.3 Handläggning vid förlossning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > partogrammet: systemet räknar varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > vid tvillingfödsel får varje barn en egen journal med reservnummer kopplad till modern, och födelseuppgifterna förs vidare till barnhälsovården | Inte kört | inte kört | inte kört |
| Graviditet och förlossning > säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val | Inte kört | inte kört | inte kört |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > CTG från simulerad utrustning: systemet klassar kurvan som normal, avvikande eller patologisk, och barnmorskan bekräftar eller motiverar en annan bedömning | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > CTG vid tvillingar har en kanal och en analys per foster | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > smärtlindring: före EDA kontrollerar systemet trombocyterna bland det som den inloggade får se | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > födelseanmälan till Skatteverket (simulerad): barnet får ett av Skatteverkets testpersonnummer i stället för reservnumret, och en mor utan personnummer får förklaringen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > BB-journalen: systemet räknar viktnedgången, varnar för feber och blödning, säger när PKU tas och prövar utskrivningskriterierna för mor och barn | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > API: barnmorskan på förlossningen kopplar CTG, bedömer, registrerar smärtlindring, födelse, födelseanmälan och BB i gränssnittets anrop | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter visas utan namn och personnummer i förlossningen, BB och födelseanmälan, och ett barn utan åtkomst syns inte i moderns vy | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > samtycke: svaren om våld visas för en annan enhet bara med kvinnans samtycke, som bara den enhet som ställde frågorna ger och återkallar, och ett återkallat eller utgånget samtycke stänger direkt | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > demopatienterna läggs in av sig själva första gången barnmorskan på förlossningen loggar in i en sandlåda, och bara en gång | Inte kört | inte kört | inte kört |

### 4.7.1.4 Planering och uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter | Inte kört | inte kört | inte kört |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > uppföljningen räknar inskrivning, ultraljud, smärtlindring, CTG, födelseanmälan och efterkontroll utan personuppgifter | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > datauttaget har tabellerna Graviditet och Forlossning utan personuppgifter och utan svaren om våld | Inte kört | inte kört | inte kört |
| Graviditet, förlossning och BB > Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster | Inte kört | inte kört | inte kört |

### 4.8.1.1 Ordination av cytostatika

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > ordination ur behandlingsregim: systemet hämtar längd och vikt, räknar kroppsytan och varje dos och lägger ut cyklerna | Inte kört | inte kört | inte kört |
| Cytostatika > karboplatin doseras med Calverts formel ur njurfunktionen som systemet räknar med Cockcroft-Gault | Inte kört | inte kört | inte kört |
| Cytostatika > före kuren prövar systemet provsvaren mot regimens gränser, beställer det som saknas och låter läkaren skjuta upp cykeln | Inte kört | inte kört | inte kört |
| Cytostatika > dosjustering: läkaren väljer andel av full dos med orsak, och systemet räknar om doserna | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > regimbiblioteket: en ändrad regim är en ny version som en regimansvarig läkare godkänner i sin egen inloggning, och nya ordinationer får den godkända versionen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kumulativ dos: systemet räknar den kumulativa antracyklindosen per kvadratmeter och stoppar kuren som skulle passera gränsen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kumulativ dos följer läkemedelslistan: en kur på en annan vårdenhet räknas utan aktivt val, en spärrad vårdenhet som i läkemedelslistan, och utan svar om tidigare behandling stoppar systemet | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Godkänna en cytostatikakur inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna en ny version av en cytostatikaregim inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.8.1.2 Beredning av cytostatika

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > beredningsordern till beredningsenheten har volym ur stamlösningen, bärarlösning, total volym och etikett med streckkod | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > beredningsenheten: arbetslistan visar de godkända kurerna med beräkning och föreslagen batch, och beredningen signeras med batch och kontrollmätt volym | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > lagret: batcher tas emot, utgångna kasseras och systemet säger om lagret räcker till de planerade kurerna | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > säkerhet: beredningsenheten ser bara beställningen och aldrig journalen, en farmaceut på en vårdenhet bereder inte, och varje patient i arbetslistan loggas | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Bereda en cytostatikados på beredningsenheten inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.8.1.3 Iordningställande och administrering av cytostatika

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > vid sängen kontrollerar systemet id-band, etikett och att läkemedlen ges i regimens ordning, och nästa cykel räknas om efter vikten | Inte kört | inte kört | inte kört |
| Cytostatika > dubbelkontrollen: den andra personen bekräftar i sin egen session, den som iordningställde kan inte kontrollera själv och ett id i anropet räcker inte | Inte kört | inte kört | inte kört |
| Cytostatika > peroral behandling: systemet räknar tabletterna för cykeln och skriver instruktionen när kuren överlämnas till patienten | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > infusionen: systemet räknar takten, och start, avbrott, ny takt och slut registreras med vem och när | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > Min journal: patienten ser den överlämnade behandlingen och rapporterar intag och mående, och systemet säger när patienten ska ringa | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Rapportera dagens tabletter i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.8.1.4 Ordination

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > ordination ur behandlingsregim: systemet hämtar längd och vikt, räknar kroppsytan och varje dos och lägger ut cyklerna | Inte kört | inte kört | inte kört |
| Cytostatika > karboplatin doseras med Calverts formel ur njurfunktionen som systemet räknar med Cockcroft-Gault | Inte kört | inte kört | inte kört |
| Cytostatika > före kuren prövar systemet provsvaren mot regimens gränser, beställer det som saknas och låter läkaren skjuta upp cykeln | Inte kört | inte kört | inte kört |
| Cytostatika > dosjustering: läkaren väljer andel av full dos med orsak, och systemet räknar om doserna | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > regimbiblioteket: en ändrad regim är en ny version som en regimansvarig läkare godkänner i sin egen inloggning, och nya ordinationer får den godkända versionen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kumulativ dos: systemet räknar den kumulativa antracyklindosen per kvadratmeter och stoppar kuren som skulle passera gränsen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kumulativ dos följer läkemedelslistan: en kur på en annan vårdenhet räknas utan aktivt val, en spärrad vårdenhet som i läkemedelslistan, och utan svar om tidigare behandling stoppar systemet | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Godkänna en cytostatikakur inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Godkänna en ny version av en cytostatikaregim inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.8.1.5 Beredning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > beredningsordern till beredningsenheten har volym ur stamlösningen, bärarlösning, total volym och etikett med streckkod | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > beredningsenheten: arbetslistan visar de godkända kurerna med beräkning och föreslagen batch, och beredningen signeras med batch och kontrollmätt volym | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > lagret: batcher tas emot, utgångna kasseras och systemet säger om lagret räcker till de planerade kurerna | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > säkerhet: beredningsenheten ser bara beställningen och aldrig journalen, en farmaceut på en vårdenhet bereder inte, och varje patient i arbetslistan loggas | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Bereda en cytostatikados på beredningsenheten inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.8.1.6 Iordningställande och administrering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > vid sängen kontrollerar systemet id-band, etikett och att läkemedlen ges i regimens ordning, och nästa cykel räknas om efter vikten | Inte kört | inte kört | inte kört |
| Cytostatika > dubbelkontrollen: den andra personen bekräftar i sin egen session, den som iordningställde kan inte kontrollera själv och ett id i anropet räcker inte | Inte kört | inte kört | inte kört |
| Cytostatika > peroral behandling: systemet räknar tabletterna för cykeln och skriver instruktionen när kuren överlämnas till patienten | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Inte kört | inte kört | inte kört |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > infusionen: systemet räknar takten, och start, avbrott, ny takt och slut registreras med vem och när | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > Min journal: patienten ser den överlämnade behandlingen och rapporterar intag och mående, och systemet säger när patienten ska ringa | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Rapportera dagens tabletter i Min journal inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 4.8.1.7 Uppföljning av kvalitet och produktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > uppföljningen per vårdenhet räknar behandlingar, planerade och givna kurer, beredningar, dosjusteringar och uppskjutna cykler utan personuppgifter | Inte kört | inte kört | inte kört |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > uppföljningen finns i datauttaget med regim, cykel, beredning och batch, och i beredningsenhetens uppföljning, utan personuppgifter | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se | Inte kört | inte kört | inte kört |
| Cytostatika i version 1.1 > spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen | Inte kört | inte kört | inte kört |

### 5.1.1.1 Kontorsinformationsstöd

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontorsstöd > journaltexten som Word-dokument efter samma prövning som journalen, loggad på patienten | Inte kört | inte kört | inte kört |
| Kontorsstöd > rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter | Inte kört | inte kört | inte kört |
| Kontorsstöd > kalenderprenumerationen med hemlig länk visar tid och typ men aldrig patienten, och kan återkallas | Inte kört | inte kört | inte kört |
| Kontorsstöd > möteslänk för videobesök, uppringning vid telefontid och inbjudan som kalenderfil och e-post | Inte kört | inte kört | inte kört |
| Kontorsstöd > arkitekturen beskriver ordbehandling, rapporter, kalender, SharePoint, e-post, telefoni och video | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Lägga in sin tidbok i kalenderprogrammet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 5.1.1.2 Migrering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > migreringsavstämningen visar avvikelsen | Inte kört | inte kört | inte kört |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Inte kört | inte kört | inte kört |
| API > översikten har tidslinje med migrerade poster märkta | Inte kört | inte kört | inte kört |
| Migrering > en migreringsfil valideras, läses in med källa och stäms av mot antalet i filen | Inte kört | inte kört | inte kört |
| Migrering > en post som inte går att läsa in blir en avvikelse med orsak, och samma fil två gånger läses inte in igen | Inte kört | inte kört | inte kört |
| Migrering > bara systemförvaltningen läser in, posterna märks som migrerade och syns i patientens tidslinje | Inte kört | inte kört | inte kört |
| Migrering > en förhandsvisad fil skrivs i journalerna först när en annan systemförvaltare har godkänt den | Inte kört | inte kört | inte kört |
| Migrering > en migrerad anteckning får aldrig en nuvarande personal som författare eller signerande, och källans författare följer med märkt | Inte kört | inte kört | inte kört |

### 5.1.1.3 Formulärhantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Formulär > definitionen har fördefinierade datatyper med validering, och systemet förklarar varje fel på vanlig svenska | Inte kört | inte kört | inte kört |
| Formulär > fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren | Inte kört | inte kört | inte kört |
| Formulär > frågor visas och krävs efter regler, och reglerna ger varningar på vanlig svenska | Inte kört | inte kört | inte kört |
| Formulär > kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån | Inte kört | inte kört | inte kört |
| Formulär > svarsalternativ och tolkningar kan ha koder i ICD-10-SE, KVÅ och Snomed CT, som systemet kontrollerar och föreslår | Inte kört | inte kört | inte kört |
| Formulär > ett formulär byggs som en ny version och används först när en annan systemförvaltare har godkänt det | Inte kört | inte kört | inte kört |
| Formulär > förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer | Inte kört | inte kört | inte kört |
| Formulär > förifyllnad bygger bara på det som den som fyller i får se: en spärrad vårdenhets mätvärde ändrar inte svaret | Inte kört | inte kört | inte kört |
| Formulär > förifyllnaden använder bara den egna vårdenhetens uppgifter utan aktiva val, texten har ingen vårdenhet, och källan visas bara för den som får se den | Inte kört | inte kört | inte kört |
| Formulär > ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen | Inte kört | inte kört | inte kört |
| Formulär > behörighet per formulär: kategori, yrken och vårdenheter prövas på servern | Inte kört | inte kört | inte kört |
| Formulär > svaren i en signerad anteckning ändras aldrig, och en rättelse blir en ny version med egna svar | Inte kört | inte kört | inte kört |
| Formulär > API: systemförvaltaren bygger, förhandsvisar och föreslår formulär, och den som dokumenterar får aktiva formulär bland mallarna | Inte kört | inte kört | inte kört |
| Formulär > FHIR: formuläret som Questionnaire och svaren som QuestionnaireResponse med samma behörighet som anteckningen | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Bygga ett formulär och föreslå det inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Mobil > Dokumentera ett sår med kroppsbilden går i 360 px | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 5.1.1.4 Externa tillämpningar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas | Inte kört | inte kört | inte kört |
| SMART on FHIR > biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med | Inte kört | inte kört | inte kört |
| SMART on FHIR > PKCE krävs, koden går att använda en gång och fel adress eller okänd tillämpning avvisas utan omdirigering | Inte kört | inte kört | inte kört |
| SMART on FHIR > biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 5.1.2.1 Nyttja externt förvaltad masterdata

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Inte kört | inte kört | inte kört |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Inte kört | inte kört | inte kört |
| Kodverk > varje läkemedel i katalogen har en ATC-kod ur WHO:s register | Inte kört | inte kört | inte kört |
| Masterdata > organisation och personal i sandlådan kommer från filadaptern | Inte kört | inte kört | inte kört |
| Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats | Inte kört | inte kört | inte kört |
| Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt | Inte kört | inte kört | inte kört |
| Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del | Inte kört | inte kört | inte kört |
| Masterdata > en ny utgåva av ett kodverk från källan läses in och läggs fram för godkännande med jämförelsen färdig | Inte kört | inte kört | inte kört |
| Masterdata > läkemedelskatalogen läses från källan: nya och ändrade produkter förs in och en produkt som saknas står kvar | Inte kört | inte kört | inte kört |
| Masterdata > masterdatan läses in efter ett schema som systemförvaltningen ändrar, och en ny sandlåda räknar seeden som första inläsningen | Inte kört | inte kört | inte kört |
| Masterdata > en källa som inte svarar ändrar ingenting, de senast giltiga uppgifterna används och avvikelsen visas | Inte kört | inte kört | inte kört |

### 5.1.2.2 Information

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > vårdrelation: listning och remiss till enheten ger vårdrelation | Inte kört | inte kört | inte kört |
| Masterdata > organisation och personal i sandlådan kommer från filadaptern | Inte kört | inte kört | inte kört |
| Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats | Inte kört | inte kört | inte kört |
| Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt | Inte kört | inte kört | inte kört |
| Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del | Inte kört | inte kört | inte kört |
| Masterdata > en ny utgåva av ett kodverk från källan läses in och läggs fram för godkännande med jämförelsen färdig | Inte kört | inte kört | inte kört |
| Masterdata > läkemedelskatalogen läses från källan: nya och ändrade produkter förs in och en produkt som saknas står kvar | Inte kört | inte kört | inte kört |
| Masterdata > listningen läses från källan, och en omlistning flyttar vårdrelationen till den nya vårdcentralen | Inte kört | inte kört | inte kört |
| Masterdata > arbetsscheman, prislistor, beställarregistret och tillgängligheten i förrådet följer samma kontrakt och synkronisering | Inte kört | inte kört | inte kört |
| Masterdata > API: systemförvaltaren läser in en del direkt, och andra roller får inte | Inte kört | inte kört | inte kört |

### 5.1.2.3 Arkitektur för masterdatahantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Masterdata > organisation och personal i sandlådan kommer från filadaptern | Inte kört | inte kört | inte kört |
| Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats | Inte kört | inte kört | inte kört |
| Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt | Inte kört | inte kört | inte kört |
| Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del | Inte kört | inte kört | inte kört |
| Masterdata > masterdatan läses in efter ett schema som systemförvaltningen ändrar, och en ny sandlåda räknar seeden som första inläsningen | Inte kört | inte kört | inte kört |
| Masterdata > vilka delar som är masterdata är parametrar: en del som förvaltas i Vårdkällan läses inte in | Inte kört | inte kört | inte kört |
| Masterdata > en källa som inte svarar ändrar ingenting, de senast giltiga uppgifterna används och avvikelsen visas | Inte kört | inte kört | inte kört |
| Masterdata > API: systemförvaltaren läser in en del direkt, och andra roller får inte | Inte kört | inte kört | inte kört |

### 5.1.3.1 Stöd för aktuell version av NI

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Informationsstruktur > modellen har NI 2023:2:s informationsklasser och begrepp med termbankens definitioner, och varje klass som används finns i NI | Inte kört | inte kört | inte kört |
| Informationsstruktur > varje tabell med patientuppgifter har en NI-klass, och en tabell som ingen har klassat får NI:s allmänna klass och visas | Inte kört | inte kört | inte kört |
| Informationsstruktur > varje FHIR-resurs i API:t har en NI-klass, och NI:s attribut pekar på kolumner som finns | Inte kört | inte kört | inte kört |
| Informationsstruktur > API: informationsmodellen visar klasserna med tabeller och FHIR-resurser för inloggad personal, utan patientuppgifter | Inte kört | inte kört | inte kört |

### 5.1.3.2 Stöd för nationellt fackspråk (NF)

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Nationellt fackspråk > varje Snomed-kod i delmängden har rätt kontrollsiffra och partition och en kontrollerad engelsk term | Inte kört | inte kört | inte kört |
| Nationellt fackspråk > varje sökord i journalens mallar har en Snomed-kod eller en förklaring, och anteckningen får koden i FHIR | Inte kört | inte kört | inte kört |
| Nationellt fackspråk > NF:s delar är Snomed CT, ICD-10-SE, KVÅ och termbanken, och API:t visar hur var och en används | Inte kört | inte kört | inte kört |
| Nationellt fackspråk > åtgärder med KVÅ har samma åtgärd i Snomed CT, och fynd och provtyper i beställning och svar ingår i delmängden | Inte kört | inte kört | inte kört |

### 5.1.3.3 Stödjer Nationell informationsstruktur

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Informationsstruktur > modellen har NI 2023:2:s informationsklasser och begrepp med termbankens definitioner, och varje klass som används finns i NI | Inte kört | inte kört | inte kört |
| Informationsstruktur > varje tabell med patientuppgifter har en NI-klass, och en tabell som ingen har klassat får NI:s allmänna klass och visas | Inte kört | inte kört | inte kört |
| Informationsstruktur > varje FHIR-resurs i API:t har en NI-klass, och NI:s attribut pekar på kolumner som finns | Inte kört | inte kört | inte kört |
| Informationsstruktur > API: informationsmodellen visar klasserna med tabeller och FHIR-resurser för inloggad personal, utan patientuppgifter | Inte kört | inte kört | inte kört |

### 5.1.3.4 Stöd för Nationellt fackspråk

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Nationellt fackspråk > varje Snomed-kod i delmängden har rätt kontrollsiffra och partition och en kontrollerad engelsk term | Inte kört | inte kört | inte kört |
| Nationellt fackspråk > varje sökord i journalens mallar har en Snomed-kod eller en förklaring, och anteckningen får koden i FHIR | Inte kört | inte kört | inte kört |
| Nationellt fackspråk > NF:s delar är Snomed CT, ICD-10-SE, KVÅ och termbanken, och API:t visar hur var och en används | Inte kört | inte kört | inte kört |
| Nationellt fackspråk > åtgärder med KVÅ har samma åtgärd i Snomed CT, och fynd och provtyper i beställning och svar ingår i delmängden | Inte kört | inte kört | inte kört |

### 5.1.3.5 Stöd för kodverk

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Inte kört | inte kört | inte kört |
| Kodverk > varje läkemedel i katalogen har en ATC-kod ur WHO:s register | Inte kört | inte kört | inte kört |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Inte kört | inte kört | inte kört |
| FHIR > Condition använder ICD-10-SE | Inte kört | inte kört | inte kört |
| FHIR-struktur > Condition och MedicationRequest har display ur kodverket | Inte kört | inte kört | inte kört |
| Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning | Inte kört | inte kört | inte kört |
| Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie | Inte kört | inte kört | inte kört |
| Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > varje kodverk har version, giltighet, utgivare och källa, och Vårdkällans egna kodverk finns med som lokala | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > en ny utgåva kontrolleras och jämförs med den som gäller: nya, ändrade och borttagna koder och hur många diagnoser som berörs | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > en utgåva gäller först när en annan systemförvaltare har godkänt den, och aldrig bakåt i tiden | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > en diagnos prövas mot den utgåva som gäller den dagen, och en kod som har tagits bort förklaras | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > ett lokalt kodverk från verksamheten skapas med fyra ögon och dess koder går att hämta i API:t | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > API: bara systemförvaltningen förvaltar kodverken, och historiken visar vem som lade in och godkände | Inte kört | inte kört | inte kört |

### 5.1.4.1 Integration med eHälsomyndighetens e-recepttjänst

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > NLL: normal överföring kvitteras | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Inte kört | inte kört | inte kört |
| Läkemedel > NLL: felsvar syns och avstämning skickar igen | Inte kört | inte kört | inte kört |

### 5.1.4.5 Integration Beställning och svar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Integration med produktionssystem > disciplinerna: klinisk kemi, klinisk fysiologi, klinisk neurofysiologi, mikrobiologi, immunologi, patologi, genetik, radiologi och transfusionsmedicin har laboratorier och analyser | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > anslutning: systemförvaltaren ansluter laboratoriet, nyckeln visas en gång och sparas som HMAC, och andra roller får inte | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > beställning ut: proverna går till utkorgen som Patient, ServiceRequest och Specimen, hämtningen loggas på patienten och det simulerade laboratoriet svarar inte | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > status och svar in: mottagen och svar med NPU-kod blir mätvärden som väntar på vidimering, och ett kritiskt värde larmar efter Vårdkällans egna gränser | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > svar in: ett meddelande som inte går att ta emot får en förklaring på svenska och ändrar ingenting | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > svar in för mikrobiologi, immunologi och genetik: fynd i Snomed CT och utlåtanden i text | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > transfusionsmedicin: blodgruppering, bastest och blodkomponenter går mellan Vårdkällan och blodcentralens producentsystem | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: giltig blodgruppering och färskt negativt bastest ger reserverade enheter | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: bastest saknas | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: bastestet är äldre än giltighetstiden | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: ett positivt bastest stoppar när beställningen inte utreds | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: en makulerad beställning med blodgruppering räknas inte | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: en borttagen blodgruppering räknas inte | Inte kört | inte kört | inte kört |
| Transfusionskontroll > producentsystemet: fel blodgrupp | Inte kört | inte kört | inte kört |
| Transfusionskontroll > avvikelsen kvitteras av den som beställde, och en annan läkare ser den inte | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > undersökningar: klinisk fysiologi, neurofysiologi och radiologi skickas direkt utan provtagning och besvaras med ett utlåtande | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > katalog in: laboratoriets katalog kopplas till Vårdkällans analyser, och en analys som inte erbjuds kan inte beställas | Inte kört | inte kört | inte kört |
| Integration med produktionssystem > det simulerade producentsystemet hämtar, kvitterar och svarar genom samma gränssnitt, för systemförvaltningen | Inte kört | inte kört | inte kört |

### 5.2.1.2 Spårbarhet för åtkomst och aktiviteter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Inte kört | inte kört | inte kört |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| API > sökningen loggas | Inte kört | inte kört | inte kört |
| FHIR > FHIR-anrop loggas | Inte kört | inte kört | inte kört |
| API > logggranskaren ser logg med hel kedja, andra roller nekas | Inte kört | inte kört | inte kört |
| API > nödåtkomst via API flaggas i logguppföljningen | Inte kört | inte kört | inte kört |

### 5.2.1.3 Export av loggposter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > AuditEvent bara för logggranskare | Inte kört | inte kört | inte kört |
| Export av loggen > åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas | Inte kört | inte kört | inte kört |
| Export av loggen > CSV har rubriker, semikolon och skydd mot formler, och säkerhetsloggen kan också exporteras | Inte kört | inte kört | inte kört |
| Export av loggen > bara logggranskaren exporterar, och ett nekat försök loggas | Inte kört | inte kört | inte kört |

### 5.2.1.4 Utloggningsfunktion

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > utloggning och byte av roll i samma webbläsare nollställer sessionen | Inte kört | inte kört | inte kört |
| Läskopia > nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning | Inte kört | inte kört | inte kört |
| Gränssnitt > Avbrott > läskopian rensas vid utloggning | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > utloggning i en flik avslutar läsläget i webbläsarens andra flikar | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Parametrar för utloggning och rapportering > utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen | Inte kört | inte kört | inte kört |

### 5.2.1.6 Åtkomstkontroll

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Inte kört | inte kört | inte kört |
| API > nekad åtkomst ger 403 kraver_val och loggas som nekad | Inte kört | inte kört | inte kört |
| Min journal > patientsessionen når inga av personalens API:er | Inte kört | inte kört | inte kört |
| Min journal > personalens session når inte Min journal | Inte kört | inte kört | inte kört |
| SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas | Inte kört | inte kört | inte kört |
| SMART on FHIR > biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med | Inte kört | inte kört | inte kört |
| SMART on FHIR > biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas | Inte kört | inte kört | inte kört |
| Inloggning med biljett > inloggningen går genom den simulerade autentiseringstjänsten, och personen, uppdraget och behörigheten tas ur biljettens attribut | Inte kört | inte kört | inte kört |
| Inloggning med biljett > en biljett med fel utfärdare, fel nyckel, ändrad signatur, fel mottagare, fel algoritm eller som har gått ut avvisas, och orsaken loggas i säkerhetsloggen | Inte kört | inte kört | inte kört |
| Inloggning med biljett > en biljett kan bara användas en gång | Inte kört | inte kört | inte kört |
| Inloggning med biljett > ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring | Inte kört | inte kört | inte kört |
| Inloggning med biljett > autentiseringstjänstens publika nyckel och konfiguration för OpenID Connect kan läsas utan inloggning | Inte kört | inte kört | inte kört |

### 5.2.1.7 Aktiva val och samtycke

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: spärrmarkering syns men innehållet döljs | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: samtycke i stunden visar spärrade uppgifter | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst | Inte kört | inte kört | inte kört |
| API > aktivt val för andra enheter via API | Inte kört | inte kört | inte kört |
| API > spärrmarkering och samtycke via API | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Nödåtkomst inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 5.2.1.8 Behörighetshantering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > vårdrelation: inskriven patient ger åtkomst på egen enhet | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > vårdrelation: listning och remiss till enheten ger vårdrelation | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > vårdrelation: kontakt avslutad för mer än 90 dagar sedan ger ingen vårdrelation | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > vårdrelation: avvisad remiss ger ingen vårdrelation | Inte kört | inte kört | inte kört |
| Behörighet ur masterdata > en ny person i källan får behörighet ur yrke och vårdenhet utan administration och kan logga in med biljett | Inte kört | inte kört | inte kört |
| Behörighet ur masterdata > en ändrad person i källan får den nya behörigheten: byte av yrkesroll och av vårdenhet avslutar den gamla inloggningen och en ny inloggning ger den nya | Inte kört | inte kört | inte kört |
| Behörighet ur masterdata > en person som synkroniseringen gör inaktiv nekas inloggning och förlorar åtkomsten i en pågående session | Inte kört | inte kört | inte kört |
| Inloggning med biljett > ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring | Inte kört | inte kört | inte kört |

### 5.3.1.2 Urskilja och skydda information efter skyddsbehov

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > inre sekretess: arbetsplats räknas till sin vårdenhet | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: spärrmarkering syns men innehållet döljs | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Inte kört | inte kört | inte kört |
| Skyddsbehov > varje informationstyp har en skyddsnivå, och informationsstrukturen skiljer uppgifterna efter vårdenhet, process och plan | Inte kört | inte kört | inte kört |
| Skyddsbehov > logggranskaren tar fram alla åtkomster till uppgifter med mycket högt skyddsbehov | Inte kört | inte kört | inte kört |
| Skyddsbehov > stickprovet tar alltid med åtkomster till uppgifter med mycket högt skyddsbehov | Inte kört | inte kört | inte kört |
| Vårdplan > åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena | Inte kört | inte kört | inte kört |
| Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna | Inte kört | inte kört | inte kört |
| Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal | Inte kört | inte kört | inte kört |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Inte kört | inte kört | inte kört |
| Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras | Inte kört | inte kört | inte kört |

### 5.3.1.3 Skydd av personer med särskilda skyddsbehov

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Inte kört | inte kört | inte kört |
| API > arbetslista maskerar skyddad identitet | Inte kört | inte kört | inte kört |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Inte kört | inte kört | inte kört |
| API > väntrummet visar aldrig namn för skyddad patient | Inte kört | inte kört | inte kört |
| API > visa identitet kräver syfte och loggas | Inte kört | inte kört | inte kört |
| FHIR > skyddad patient maskeras i FHIR | Inte kört | inte kört | inte kört |
| Min journal > skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > invånare: egen journal från 16 år, vårdnadshavare till 13 år och aldrig för ett barn med skyddad identitet | Inte kört | inte kört | inte kört |

### 5.3.1.5 Oavvislighet genom kryptografiska metoder

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Signerade meddelanden > en förskrivning till läkemedelslistan signeras med Vårdkällans certifikat och kvitteras med läkemedelslistans signatur, och beviset sparas | Inte kört | inte kört | inte kört |
| Signerade meddelanden > ändrat innehåll upptäcks: i ett meddelande på vägen, i kvittensen och i journalen efteråt | Inte kört | inte kört | inte kört |
| Signerade meddelanden > ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar | Inte kört | inte kört | inte kört |
| Signerade meddelanden > bevisen kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Signerade meddelanden > API: systemförvaltaren ser certifikaten och bevisen utan patientuppgifter och kontrollerar ett bevis, andra roller nekas | Inte kört | inte kört | inte kört |
| E-arkiv > leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen | Inte kört | inte kört | inte kört |

### 5.3.1.6 Ändringshistorik i journalen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Inte kört | inte kört | inte kört |
| Journal > rättelse kräver orsak | Inte kört | inte kört | inte kört |
| Journal > bara senaste versionen kan rättas | Inte kört | inte kört | inte kört |
| API > helflöde: anteckning skapas, signeras och rättas | Inte kört | inte kört | inte kört |
| Läkemedel > utsättning kräver orsak och inget raderas | Inte kört | inte kört | inte kört |

### 5.3.1.7 Radering av poster eller hela journalen

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan | Inte kört | inte kört | inte kört |
| Arkiv > radering av hela journalen behåller identiteten, utskrifterna, utlämnandena och loggen | Inte kört | inte kört | inte kört |
| Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Arkiv > export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i | Inte kört | inte kört | inte kört |
| Arkiv > arkivariens postförteckning visar inget innehåll och nämner inte en spärrad vårdenhet | Inte kört | inte kört | inte kört |

### 5.3.1.8 Publikt erkända certifikat mellan instanser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Certifikat mellan instanser > kedjan kontrolleras mot listan över betrodda utfärdare, och en egen utfärdare eller en instans som utfärdar certifikat godtas inte | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > ett utgånget, ännu inte giltigt eller återkallat certifikat avvisas | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > ett certifikat för en annan instans godtas inte som avsändare | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > när systemförvaltaren återkallar laboratoriets certifikat i sandlådan tas svaren inte emot, och det gäller bara den sandlådan | Inte kört | inte kört | inte kört |
| Signerade meddelanden > ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar | Inte kört | inte kört | inte kört |

### 5.3.1.12 Loggning av säkerhetspåverkande händelser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > nekad åtkomst ger 403 kraver_val och loggas som nekad | Inte kört | inte kört | inte kört |
| API > nödåtkomst via API flaggas i logguppföljningen | Inte kört | inte kört | inte kört |
| Åtkomstloggen > okänd grund vägras | Inte kört | inte kört | inte kört |
| Min journal > nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > ändrade behörigheter och inställningar blir säkerhetshändelser | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Inte kört | inte kört | inte kört |

### 5.3.1.18 Säkerhetsarkitektur

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > nekad: utan grund nekas åtkomst utan erbjudande om val | Inte kört | inte kört | inte kört |
| API > skrivande anrop med fel Origin avvisas | Inte kört | inte kört | inte kört |
| API > sessionskakan är HttpOnly och SameSite=Lax | Inte kört | inte kört | inte kört |
| API > för stor kropp avvisas | Inte kört | inte kört | inte kört |
| Min journal > ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas | Inte kört | inte kört | inte kört |
| Säkerhetsarkitektur > hotmodellen har yttre och inre hot, och varje hot pekar på en kontroll, en princip och tester | Inte kört | inte kört | inte kört |
| Säkerhetsarkitektur > varje princip i Sussas kravtext möts av minst ett hot i hotmodellen | Inte kört | inte kört | inte kört |
| Inloggning med biljett > en biljett med fel utfärdare, fel nyckel, ändrad signatur, fel mottagare, fel algoritm eller som har gått ut avvisas, och orsaken loggas i säkerhetsloggen | Inte kört | inte kört | inte kört |
| Inloggning med biljett > en biljett kan bara användas en gång | Inte kört | inte kört | inte kört |
| Inloggning med biljett > autentiseringstjänstens publika nyckel och konfiguration för OpenID Connect kan läsas utan inloggning | Inte kört | inte kört | inte kört |
| Min journal > nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan | Inte kört | inte kört | inte kört |
| Signerade meddelanden > ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > kedjan kontrolleras mot listan över betrodda utfärdare, och en egen utfärdare eller en instans som utfärdar certifikat godtas inte | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > ett utgånget, ännu inte giltigt eller återkallat certifikat avvisas | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > ett certifikat för en annan instans godtas inte som avsändare | Inte kört | inte kört | inte kört |
| Certifikat mellan instanser > när systemförvaltaren återkallar laboratoriets certifikat i sandlådan tas svaren inte emot, och det gäller bara den sandlådan | Inte kört | inte kört | inte kört |
| Signerade meddelanden > en förskrivning till läkemedelslistan signeras med Vårdkällans certifikat och kvitteras med läkemedelslistans signatur, och beviset sparas | Inte kört | inte kört | inte kört |
| Signerade meddelanden > ändrat innehåll upptäcks: i ett meddelande på vägen, i kvittensen och i journalen efteråt | Inte kört | inte kört | inte kört |
| Signerade meddelanden > bevisen kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| E-arkiv > leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen | Inte kört | inte kört | inte kört |
| Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas | Inte kört | inte kört | inte kört |
| SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas | Inte kört | inte kört | inte kört |
| API > nödåtkomst via API flaggas i logguppföljningen | Inte kört | inte kört | inte kört |
| Skyddsbehov > stickprovet tar alltid med åtkomster till uppgifter med mycket högt skyddsbehov | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Inte kört | inte kört | inte kört |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Inte kört | inte kört | inte kört |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Inte kört | inte kört | inte kört |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Inte kört | inte kört | inte kört |
| Behörighet ur masterdata > en person som synkroniseringen gör inaktiv nekas inloggning och förlorar åtkomsten i en pågående session | Inte kört | inte kört | inte kört |
| Behörighet ur masterdata > en ändrad person i källan får den nya behörigheten: byte av yrkesroll och av vårdenhet avslutar den gamla inloggningen och en ny inloggning ger den nya | Inte kört | inte kört | inte kört |
| Inloggning med biljett > ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring | Inte kört | inte kört | inte kört |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Inte kört | inte kört | inte kört |
| Skyddsbehov > varje informationstyp har en skyddsnivå, och informationsstrukturen skiljer uppgifterna efter vårdenhet, process och plan | Inte kört | inte kört | inte kört |
| Skyddsbehov > logggranskaren tar fram alla åtkomster till uppgifter med mycket högt skyddsbehov | Inte kört | inte kört | inte kört |
| Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter | Inte kört | inte kört | inte kört |
| Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser | Inte kört | inte kört | inte kört |
| Säkerhetsloggen > ändrade behörigheter och inställningar blir säkerhetshändelser | Inte kört | inte kört | inte kört |

### 5.4.2.1 Export till e-arkiv för långsiktigt bevarande

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Arkiv > export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Inte kört | inte kört | inte kört |

### 5.4.2.3 Export av information

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Inte kört | inte kört | inte kört |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Inte kört | inte kört | inte kört |
| E-arkiv > paketet har ett index med e-arkivets dataelement för varje journalhandling, och mappningen står i dokumentationen | Inte kört | inte kört | inte kört |
| E-arkiv > leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen | Inte kört | inte kört | inte kört |
| E-arkiv > ett paket som ändras på vägen eller saknar en fil avvisas av mottagningskontrollen med orsaken | Inte kört | inte kört | inte kört |
| E-arkiv > journalhandlingar och åtkomstloggen ligger skilda åt, och indexet tar bara med journalhandlingarna | Inte kört | inte kört | inte kört |

### 5.4.2.4 Gallring

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Inte kört | inte kört | inte kört |
| Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Gallringsregler > reglerna per informationsmängd är parametrar med lagens lägsta gräns, som systemförvaltaren ändrar med fyra ögon, och arkivarien ser dem | Inte kört | inte kört | inte kört |
| Gallringsregler > ett gallringsbeslut gallrar mätvärden och kallelser som är äldre än regeln i journaler som finns kvar, och resten av journalen är orörd | Inte kört | inte kört | inte kört |
| Gallringsregler > gallringen av delar loggas per journal utan innehåll, åtkomstloggen är hel och beslutet kan bara verkställas en gång | Inte kört | inte kört | inte kört |

### 6.1.1.1 All vårdinformation hålls samman per vårdkontakt

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient | Inte kört | inte kört | inte kört |
| Vårdkontakt > migrerad historik får vårdkontakter med samma källa, märkta som skapade av systemet | Inte kört | inte kört | inte kört |
| Vårdkontakt > anteckningen knyts till den pågående vårdkontakten utan att någon väljer den | Inte kört | inte kört | inte kört |
| Vårdkontakt > finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag | Inte kört | inte kört | inte kört |
| Vårdkontakt > vårdkontakten visar allt som hör till den, med samma behörighet och loggning | Inte kört | inte kört | inte kört |
| Vårdkontakt > översikten och tidslinjen visar informationen per vårdkontakt och per vårdtillfälle | Inte kört | inte kört | inte kört |
| Vårdkontakt > ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt | Inte kört | inte kört | inte kört |
| Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras | Inte kört | inte kört | inte kört |
| Vårdkontakt > en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades | Inte kört | inte kört | inte kört |

### 6.1.1.2 Spårbarhet hälsoärende

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Hälsoärende > ett hälsoärende kan avslutas och öppnas igen, med historik | Inte kört | inte kört | inte kört |
| Hälsoärende > ett hälsoärende delas, och kontakterna följer med till det nya ärendet | Inte kört | inte kört | inte kört |
| Hälsoärende > två ärenden slås ihop, och det sammanslagna visas inte längre | Inte kört | inte kört | inte kört |
| Hälsoärende > en vårdkontakt flyttas mellan ärenden, med historik i båda | Inte kört | inte kört | inte kört |
| Hälsoärende > kontakter och ärenden som användaren inte får se rörs inte, och nödåtkomst ger bara läsning | Inte kört | inte kört | inte kört |
| Hälsoärende > historiken kan inte ändras eller raderas (trigger) | Inte kört | inte kört | inte kört |
| Vårdkontakt > hälsoärende föreslås ur samma diagnos och bekräftas med ett klick | Inte kört | inte kört | inte kört |
| Vårdkontakt > hälsoärende föreslås ur en remisskedja | Inte kört | inte kört | inte kört |
| Vårdkontakt > förslagen bygger bara på kontakter som användaren får se, och ett förslag kan avvisas | Inte kört | inte kört | inte kört |
| Vårdkontakt > hälsoärendet visar bara de vårdkontakter som användaren får se | Inte kört | inte kört | inte kört |
| Vårdkontakt > seedens hälsoärende håller samman remisskedjan för patient 11 | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Bekräfta ett hälsoärende inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 6.1.1.3 Spårbarhet kringsystem

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt | Inte kört | inte kört | inte kört |
| Spårbarhet > en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id | Inte kört | inte kört | inte kört |
| Spårbarhet > överföringen till NLL och svaret från NLL syns i händelsekedjan, och varje del följer sin behörighet | Inte kört | inte kört | inte kört |
| Spårbarhet > en ordination eller kontakt på en spärrad vårdenhet röjs aldrig, inte heller genom en prenumerationsnotis | Inte kört | inte kört | inte kört |

### 6.1.1.4 Spårbarhet subprocesser

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat | Inte kört | inte kört | inte kört |
| Vårdkontakt > hälsoärende föreslås ur en remisskedja | Inte kört | inte kört | inte kört |
| Subprocesser > målvärdena för ledtiderna är parametrar som systemförvaltaren sätter, med samma standard som modulen | Inte kört | inte kört | inte kört |
| Subprocesser > remiss, provtagning och läkemedelsöverföring följs upp per steg mot målvärdena, utan personuppgifter | Inte kört | inte kört | inte kört |
| Beställning och svar > uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter | Inte kört | inte kört | inte kört |
| Spårbarhet > en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id | Inte kört | inte kört | inte kört |

### 6.1.1.5 Spårbarhet vårdtillfälle

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om | Inte kört | inte kört | inte kört |
| Vårdkontakt > medicinskt ansvar följer med vid flytt till en annan klinik, eller stannar kvar | Inte kört | inte kört | inte kört |
| Vårdkontakt > inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket | Inte kört | inte kört | inte kört |
| Vårdkontakt > utskrivningen avslutar vårdtillfället och påminner om osignerade anteckningar och epikris | Inte kört | inte kört | inte kört |
| Vårdkontakt > FHIR: Encounter med vårdtillfälle, kontaktsätt och hälsoärende, och EpisodeOfCare med samma behörighet | Inte kört | inte kört | inte kört |
| Vårdkontakt > inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får | Inte kört | inte kört | inte kört |
| Vårdkontakt > vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se | Inte kört | inte kört | inte kört |
| Vårdkontakt > FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Skriva in en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Flytta en patient till en annan avdelning inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Skriva ut en patient inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 6.1.1.6 Enhetlig hantering av vårdkontakter

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket | Inte kört | inte kört | inte kört |
| Vårdkontakt > planerad kontakt på distans, och ankomsten registreras på den planerade | Inte kört | inte kört | inte kört |
| Vårdkontakt > all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient | Inte kört | inte kört | inte kört |
| Vårdformer > utskrivning till hemsjukvård görs i ett steg, med föregående kontakt och samma hälsoärende | Inte kört | inte kört | inte kört |
| Vårdformer > en dagkirurgisk kontakt där patienten blir kvar skrivs in i samma hälsoärende | Inte kört | inte kört | inte kört |
| Vårdformer > den faktiska besökstiden registreras utan att kontakten avslutas | Inte kört | inte kört | inte kört |
| Vårdformer > en dagkirurgisk kontakt eller uppföljning kan inte bakdateras eller läggas mer än ett år fram | Inte kört | inte kört | inte kört |

### 6.2.1.1 Statistikuttag i kärnsystemet

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Statistik och analys > uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter | Inte kört | inte kört | inte kört |
| Statistik och analys > vårdenhetens statistik räknas bara på den egna vårdenhetens uppgifter, och en annan vårdenhet nekas | Inte kört | inte kört | inte kört |
| Statistik och analys > urval och resultat sparas, återanvänds och delas med vårdenheten, och prövas med den egna behörigheten | Inte kört | inte kört | inte kört |
| Patientgruppering > ett sparat resultat läses bara av en roll som får se statistik, och svaret är detsamma oavsett om det finns | Inte kört | inte kört | inte kört |
| Patientgruppering > en roll utan behörighet att gruppera nekas och loggas | Inte kört | inte kört | inte kört |

### 6.2.1.2 Patientgruppering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Patientgruppering > villkoren kontrolleras och skrivs på vanlig svenska, och färdiga grupper har målvärden ur riktlinjerna | Inte kört | inte kört | inte kört |
| Patientgruppering > läkaren grupperar sina patienter på diagnos, mätvärde, läkemedel, besök och demografi och får en lista som loggas | Inte kört | inte kört | inte kört |
| Patientgruppering > gruppen räknas bara på uppgifter som läkaren får se utan aktivt val, och aldrig på spärrade uppgifter | Inte kört | inte kört | inte kört |
| Patientgruppering > en patient utan vårdrelation på vårdenheten kommer aldrig med i läkarens grupp | Inte kört | inte kört | inte kört |
| Patientgruppering > uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter | Inte kört | inte kört | inte kört |
| Patientgruppering > en roll utan behörighet att gruppera nekas och loggas | Inte kört | inte kört | inte kört |
| Folkhälsa > en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet | Inte kört | inte kört | inte kört |
| Statistik och analys > uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter | Inte kört | inte kört | inte kört |

### 6.2.2.1 Folkhälsa

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Levnadsvanor > systemet räknar risken för alkohol, fysisk aktivitet och matvanor och föreslår stöd med KVÅ-kod | Inte kört | inte kört | inte kört |
| Levnadsvanor > anteckningen får text som systemet skriver, och samtalet registreras som åtgärd när den signeras | Inte kört | inte kört | inte kört |
| Folkhälsa > en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet | Inte kört | inte kört | inte kört |
| Folkhälsa > patientlistan i en insats prövar varje patient i behörighetsmotorn, och en patient utan åtkomst syns inte alls | Inte kört | inte kört | inte kört |
| Folkhälsa > rekommendationen syns i patientens översikt för den som kan ge stödet | Inte kört | inte kört | inte kört |
| Folkhälsa > insatserna följer behörigheten: kardiologen ser inte vårdcentralens insats, och uppföljningen ser bara antal | Inte kört | inte kört | inte kört |
| Patientgruppering > uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter | Inte kört | inte kört | inte kört |

### 6.3.1.1 Accesspunkt för datauttag

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > bara uppföljningsrollen når datauttaget, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Inte kört | inte kört | inte kört |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Inte kört | inte kört | inte kört |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Inte kört | inte kört | inte kört |

### 6.3.1.2 Accesspunkten uppdateras minst en gång per dygn

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt | Inte kört | inte kört | inte kört |
| Datauttag > drift-vyn visar när datauttaget senast uppdaterades och när nästa uppdatering sker | Inte kört | inte kört | inte kört |

### 6.3.1.3 Omfattning av tillgång till data

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Inte kört | inte kört | inte kört |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Inte kört | inte kört | inte kört |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Inte kört | inte kört | inte kört |
| Datauttag, runda 9 > mätvärden, anteckningar utan text, vårdtillfällen och patientavgifter följer samma regler som de andra tabellerna | Inte kört | inte kört | inte kört |
| Datauttag, runda 9 > patientavgiften röjer varken kontakter på en spärrad vårdenhet eller ett LMA-kort | Inte kört | inte kört | inte kört |

### 6.3.1.4 Accesspunktens uppdateringsfrekvens

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt | Inte kört | inte kört | inte kört |
| Datauttag > drift-vyn visar när datauttaget senast uppdaterades och när nästa uppdatering sker | Inte kört | inte kört | inte kört |

### 6.3.1.5 Accesspunkt för datauttag

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt | Inte kört | inte kört | inte kört |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Inte kört | inte kört | inte kört |
| Datauttag, runda 9 > kontrollreglerna per rad står i manifestet och pekar ut rader som inte klarar dem | Inte kört | inte kört | inte kört |
| Datauttag, runda 9 > en vecka av uppdateringar sparas, och ändringarna kan läsas sedan vilken av dem som helst | Inte kört | inte kört | inte kört |

### 6.3.2.1 Kvalitetsregister

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Myndighetsrapportering > kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > kvalitetsregistrets återkoppling sparas och kan läsas | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > läkaren och sjuksköterskan registrerar och ångrar patientens invändning mot kvalitetsregistret, och det loggas | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient | Inte kört | inte kört | inte kört |

### 6.3.2.2 Myndighetsrapportering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Myndighetsrapportering > patientregistrets filer följer HSLF-FS 2023:33 med semikolon, rätt antal fält och filnamn med länskod och period | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > diagnoser rapporteras utan punkt, yttre orsaker i egen fil och åtgärder och givna läkemedel med datum | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > en vårdkontakt med fel hålls kvar, och felet beskrivs på svenska med vem som rättar | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > primärvård och kontakter utan läkare rapporteras inte till patientregistret och räknas med bestämmelse | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > skyddade personuppgifter och spärrade uppgifter rapporteras till patientregistret enligt lag och redovisas som antal | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > psykiatrisk vårdform enligt LPT räknas fram ur beslutsjournalen | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > väntande i specialiserad vård följer filspecifikationen med fas, aktivitet, remiss och måldatum | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > medicinska födelseregistret tar förlossningar ur diagnoserna, och utan utfall är det ett fel | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > Vårdtillfällesdatabasen har ett antaget format som är märkt som antagande | Inte kört | inte kört | inte kört |
| Myndighetsrapportering > en yttre orsak sätts ihop ur tre frågor och kontrolleras mot ICD-10-SE | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > bara uppföljningsrollen granskar och skickar, och nekade försök loggas | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > granskningen visar fel och fältens ifyllnad utan patientuppgifter | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > läkaren får felet i inkorgen bara för sin vårdenhet och rättar det med systemets förslag, och vårdkontakten följer med i nästa rapport | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > en yttre orsak registreras i inkorgen ur svaren, och en kod som systemet inte känner till nekas | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > en diagnos som registreras via rapportfelet röjer inte dolda diagnoser, och två huvuddiagnoser rättas av den som får se båda | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > demoläget ger ett fel på kardiologen och ett på akutmottagningen i rätt inkorg | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > väntelistans fritext visas inte för uppföljningsrollen, bara för vårdadministratören efter prövningen | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > inkorgen följer det aktuella läget när en vårdkontakt flyttas eller personalen byter enhet efter att sammanställningen har sparats | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > den sparade sammanställningen görs om när en spärr eller en vårdenhet ändras | Inte kört | inte kört | inte kört |
| Myndighetsrapportering i API:t > ett fel för ett vårdtillfälle syns bara när behörigheten gäller vårdtillfällets och varje kontakts vårdenhet, utan och med samtycke | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Granska och skicka månadens rapport till patientregistret inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 6.3.3.1 Forskningsunderlag

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Forskningsuttag > beställningen får diarienummer, etikprövningen kontrolleras och urvalet hämtas ur datauttaget | Inte kört | inte kört | inte kört |
| Forskningsuttag > två andra personer godkänner, den som registrerade kan inte, och utlämnandet loggas och kan inte ändras | Inte kört | inte kört | inte kört |
| Forskningsuttag > en avslagen beställning kan inte lämnas ut, och roller utan behörighet nekas | Inte kört | inte kört | inte kört |
| Forskningsuttag > verksamhetschefen godkänner bara för sin egen vårdenhet, och uttaget får bara med vårdenheter som har godkänt | Inte kört | inte kört | inte kört |

### 7.1.1.1 Faktureringsunderlag

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Ekonomi: faktureringsunderlag > systemet skapar transaktionsposter ur vårdtillfället med vårddygn, material, DRG och sammanhållande id utan att någon registrerar dem | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > läkemedel som gavs på enheten och åtgärder med KVÅ blir poster med pris ur prislistan och materialschablon | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > översikten per vårdenhet visar antal, summa och varningar utan personuppgifter, och förra månaden är förvald | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > skyddad identitet: underlaget innehåller aldrig adressen eller namnet | Inte kört | inte kört | inte kört |
| Ekonomi: skydd i underlaget och högkostnadsskyddet > ett barn med skyddade personuppgifter: varken vårdnadshavarens namn och identitet eller adressen finns i underlaget | Inte kört | inte kört | inte kört |
| Ekonomi: skydd i underlaget och högkostnadsskyddet > en vårdnadshavare med skyddade personuppgifter: namn, identitet och barnets adress lämnas inte ut | Inte kört | inte kört | inte kört |
| Ekonomi: sandlådor och roller > en sandlåda från före runda 7 får tabellerna, prislistorna och ekonomen | Inte kört | inte kört | inte kört |
| Ekonomi: export för en spärrad vårdenhet > underlaget för en vårdenhet som patienten har spärrat har minsta möjliga uppgifter och inget om andra vårdenheter | Inte kört | inte kört | inte kört |
| Ekonomi: ChargeItem i FHIR > ChargeItem med samma behörighet och loggning som kostnadsrutan | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Exportera faktureringsunderlag för en månad inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Gränssnitt > Klickbudget > Lämna ut ett hjälpmedel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 7.1.1.2 Faktureringsunderlag

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Ekonomi: prislistor > varje vårdenhet har en prislista med version, giltighetstid och demopriser, och kardiologin har en historik | Inte kört | inte kört | inte kört |
| Ekonomi: prislistor > bara ekonomen ändrar en prislista, som blir en ny version från ett datum som inte har passerat, och ändringen loggas | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > när reservnumret ersätts av personnumret följer underlaget med och betalningsmottagaren blir känd | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > utomlänsvård: underlaget har en del per hemregion med de uppgifter som den nationella tjänsten för utomlänsvård behöver (simulerad) | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > DRG: vårdtillfället grupperas med en demoregel ur den ansvariga vårdenhetens huvuddiagnos, och utan huvuddiagnos förklarar systemet varför | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > medicinskt färdigbehandlad registreras av läkaren på vårdtillfället och ingår i underlaget | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > i en samordnad planering vid utskrivning är underrättelsen om utskrivningsklar registreringen, och kommunens betalningsansvar kommer med | Inte kört | inte kört | inte kört |
| Ekonomi: faktureringsunderlag > export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna | Inte kört | inte kört | inte kört |

### 7.1.2.1 Ekonomisk visualisering

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Ekonomi: kostnader i vårdprocessen > läkaren ser kostnaden hittills för vårdtillfället per kategori enligt prislistan, med DRG och högkostnadsskyddet | Inte kört | inte kört | inte kört |
| Ekonomi: kostnader i vårdprocessen > vårdadministratören ser bara patientavgifterna och högkostnadsskyddet, och undersköterskan ser inga kostnader | Inte kört | inte kört | inte kört |
| Ekonomi: kostnader i vårdprocessen > spärr och inre sekretess: kostnader från en spärrad eller annan vårdenhet syns inte och nämns inte | Inte kört | inte kört | inte kört |
| Ekonomi: kostnader i vårdprocessen > en öppenvårdskontakt i dag har en egen kostnadsruta | Inte kört | inte kört | inte kört |
| Ekonomi: skydd i underlaget och högkostnadsskyddet > högkostnadsskyddet räknas bara på de kontakter användaren får se: en spärrad enhet utan och med samtycke | Inte kört | inte kört | inte kört |
| Ekonomi: avgifter som taket har påverkat > en dold kontakt som gör nästa synliga avgift nedsatt men inte noll ändrar inte svaret i kostnadsrutan | Inte kört | inte kört | inte kört |
| Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det | Inte kört | inte kört | inte kört |
| Ekonomi: kostnader i vårdprocessen > rabatter: en avgiftsfri patientavgift visar ordinarie avgift, rabatten och skälet, och rutan summerar rabatterna | Inte kört | inte kört | inte kört |

### 8.4.1.1 Fokus på verksamhets- och patientnytta samt att stödja användarnas behov

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussas testfall > registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass | Inte kört | inte kört | inte kört |
| Sussas testfall > tidspoängen följer tabellen i Bilaga F1:2 för de fyra tidsklasserna | Inte kört | inte kört | inte kört |
| Sussas testfall > måluppfyllelsen ger 10, 5, 2 eller 0 efter slutvillkoret och klickbudgeten | Inte kört | inte kört | inte kört |
| Sussas testfall > omvandlingen till utvärderingspoäng följer Bilaga F1:2 avsnitt 5 | Inte kört | inte kört | inte kört |
| Sussas testfall > tidsuppskattningen följer keystroke-level model med den uppmätta svarstiden | Inte kört | inte kört | inte kört |
| Sussas testfall > sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget | Inte kört | inte kört | inte kört |
| Sussas testfall > demoläget lägger in testpatienterna med Skatteverkets testpersonnummer och datan som testfallen behöver | Inte kört | inte kört | inte kört |
| Sussas testfall > tema 1 genomförs med Sussas läkemedel i en katalog med minst 100 produkter | Inte kört | inte kört | inte kört |
| Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden | Inte kört | inte kört | inte kört |
| Gränssnitt > Sussas testfall > 1.1 Förskriva läkemedel (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.2 Ordinera läkemedel (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.3 Ordinera läkemedel på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.4 Administrera läkemedel (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.4 Signera (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.4 Omboka besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.5 Ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.6 Överblicka ankomstregistrering (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.7 Oplanerad ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.8 Väntelista (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Testinbjudan > varje yrkesroll har 6 till 12 uppdrag, och tillsammans täcker uppdragen alla Sussas 34 testfall | Inte kört | inte kört | inte kört |
| Testinbjudan > inget uppdrag är avbockat när det startar, för någon roll, så att seedens och Sussas testdata aldrig räknas | Inte kört | inte kört | inte kört |
| Testinbjudan > ett uppdrag bockas av när rollen gör det på riktigt, och tiden till uppdraget räknas | Inte kört | inte kört | inte kört |
| Testinbjudan > bara rollens egen demoperson räknas: samma sak gjord av en annan roll i sandlådan bockar inte av uppdraget | Inte kört | inte kört | inte kört |
| Testinbjudan > ett uppdrag som går ut på att hitta något prövas mot Sussas rätta svar på servern | Inte kört | inte kört | inte kört |
| Testinbjudan > jämförelsen efter ett uppdrag sparas en gång, med testarens profil, och syns per uppdrag och journalsystem hos testledaren | Inte kört | inte kört | inte kört |
| Testinbjudan > panelens svar innehåller inga personnummer eller andra uppgifter ur sandlådans journaler | Inte kört | inte kört | inte kört |

### 8.4.1.2 Användarcentrerad design

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussas testfall > registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass | Inte kört | inte kört | inte kört |
| Sussas testfall > sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget | Inte kört | inte kört | inte kört |
| Sussas testfall > SUS-formuläret har de tio påståendena i Sussas formulering och poängen räknas med standardformeln | Inte kört | inte kört | inte kört |
| Sussas testfall > expertgranskningen har de sju dialogprinciperna i ISO 9241-110 och summan omvandlas till utvärderingspoäng | Inte kört | inte kört | inte kört |
| Användartestens svar > sparas på servern med roll, pseudonym, datum, testfall och svar, och poängen räknas av servern | Inte kört | inte kört | inte kört |
| Användartestens svar > inga patientuppgifter eller namn: pseudonym med siffror som ett personnummer, kommentar med personnummer och okända fält avvisas | Inte kört | inte kört | inte kört |
| Användartestens svar > läsning och export kräver både testledarens roll och koden för just det tillfället, så att ingen ser andras tillfällen | Inte kört | inte kört | inte kört |
| Användartestens svar > skrivningen är begränsad per tillfälle och per session och minut, och ett fullt tillfälle stoppar bara sig självt | Inte kört | inte kört | inte kört |
| Användartestens svar > tillfällen utan aktivitet på 90 dagar raderas med sina svar | Inte kört | inte kört | inte kört |
| Användartestens svar > skapandet är begränsat per session och timme och per skapare, så att ingen kan fylla det globala taket | Inte kört | inte kört | inte kört |
| Användartestens svar > tomma tillfällen utan svar raderas efter 24 timmar och räknas då inte längre mot skaparen | Inte kört | inte kört | inte kört |
| Gränssnitt > Sussas testfall > 1.1 Förskriva läkemedel (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.2 Ordinera läkemedel (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.3 Ordinera läkemedel på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 1.4 Administrera läkemedel (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 4.4 Signera (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.4 Omboka besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.5 Ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.6 Överblicka ankomstregistrering (läkare öppenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.7 Oplanerad ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 5.8 Väntelista (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Sussas testfall i webbläsaren | 2026-11-12 kl. 11:41 UTC |
| Testinbjudan > varje yrkesroll har 6 till 12 uppdrag, och tillsammans täcker uppdragen alla Sussas 34 testfall | Inte kört | inte kört | inte kört |
| Testinbjudan > inget uppdrag är avbockat när det startar, för någon roll, så att seedens och Sussas testdata aldrig räknas | Inte kört | inte kört | inte kört |
| Testinbjudan > ett uppdrag bockas av när rollen gör det på riktigt, och tiden till uppdraget räknas | Inte kört | inte kört | inte kört |
| Testinbjudan > bara rollens egen demoperson räknas: samma sak gjord av en annan roll i sandlådan bockar inte av uppdraget | Inte kört | inte kört | inte kört |
| Testinbjudan > ett uppdrag som går ut på att hitta något prövas mot Sussas rätta svar på servern | Inte kört | inte kört | inte kört |
| Testinbjudan > jämförelsen efter ett uppdrag sparas en gång, med testarens profil, och syns per uppdrag och journalsystem hos testledaren | Inte kört | inte kört | inte kört |
| Testinbjudan > panelens svar innehåller inga personnummer eller andra uppgifter ur sandlådans journaler | Inte kört | inte kört | inte kört |
| Synpunkter > en testare lämnar en synpunkt utan inloggning och får ett kort nummer, och systemet fyller i version, gränssnitt, webbläsare och tid | Inte kört | inte kört | inte kört |
| Synpunkter > ett riktigt personnummer tas inte emot i texten eller kontaktfältet, men testpersonnummer och demons patienter går bra | Inte kört | inte kört | inte kört |
| Synpunkter > läsningen kräver en giltig läskod, och fel kod ger samma svar varje gång med ett tak på försöken | Inte kört | inte kört | inte kört |
| Synpunkter > tak per session och minut, per session och timme, per adress och dygn och totalt | Inte kört | inte kört | inte kört |
| Synpunkter > export som CSV och Markdown, utan klickbara länkar, utan formler och utan HTML | Inte kört | inte kört | inte kört |

### 8.4.1.3 Användbarhet och tillgänglighet

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Tillgänglighet > inget ljud, ingen video, inga bilder av text och inget som blinkar eller rör sig av sig självt | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > varje bild och symbol har ett textalternativ eller är dold för hjälpmedel | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > varje formulärfält, knapp och länk har ett namn som beskriver syftet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > varje vy har en rubrik på nivå 1 och rubrikerna hoppar inte över någon nivå | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > allt innehåll ligger i landmärken: sidhuvud, meny, huvudinnehåll och sidfot | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > sidan har språket svenska och varje vy har en egen sidtitel | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > fältens ramar och fokusmarkeringen har minst 3:1 mot bakgrunden | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > status, larm, uppmärksamhetssymbolen och kurvorna har text eller form utöver färgen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > texten går att förstora till 200 procent utan att innehåll eller funktion försvinner | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > vid 320 px bredd behövs ingen rullning i sidled | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > allt som går att klicka på går att nå med tangentbordet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > tabbordningen följer sidans ordning, utan positivt tabindex och utan tangentbordsfälla | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > varje element som får fokus med tabb har en synlig fokusmarkering | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > inloggning, att öppna en patient, byta flik och stänga nyheterna går med bara tangentbordet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > att ett element får fokus byter inte sida och öppnar inget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > ett fel i ett formulär markeras vid fältet och beskrivs med text | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > högkontrastläget ger minst 7:1 i kontrast och följer datorns inställning | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > med minskade rörelser i datorn finns inga animationer eller övergångar | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat | Inte kört | inte kört | inte kört |
| Tillgänglighetsredogörelse > ett krav är uppfyllt bara när alla dess tester är gröna, och det som bara kan bedömas av människor är märkt | Inte kört | inte kört | inte kört |
| Tillgänglighetsredogörelse > API: tillganglighet går att läsa utan inloggning | Inte kört | inte kört | inte kört |
| Tillgänglighetsredogörelse > docs/tillganglighet.md skrivs ur samma register som sidan och tar upp varje krav | Inte kört | inte kört | inte kört |
| Gränssnitt > Tillgänglighet > fem minuter före utloggningen läser skärmläsare upp en varning, Fortsätt arbeta förlänger inloggningen och osparad text finns kvar som utkast efter en ny inloggning | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Klickbudget > Fortsätta arbeta när inloggningen snart går ut inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Inloggningens tidsgräns > inloggningen går ut efter en tid utan aktivitet, men sandlådan och utkasten finns kvar efter en ny inloggning | Inte kört | inte kört | inte kört |
| Inloggningens tidsgräns > anrop i bakgrunden förlänger inte inloggningen, och Fortsätt arbeta gör det | Inte kört | inte kört | inte kört |
| Inloggningens tidsgräns > varje svar till en inloggad säger när inloggningen går ut, och utloggningen står i säkerhetsloggen | Inte kört | inte kört | inte kört |

### 10.1.1.2 Kontinuerlig kompetensutveckling

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Utbildning > hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Övningar och intyg > övningarna och nyheterna innehåller inga patientuppgifter utom demopatienternas namn, och texterna är svenska | Inte kört | inte kört | inte kört |

### 10.1.1.3 Utbildning användare

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Utbildning > hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Utbildning > övningarna ger ett intyg med giltighetstid, och verksamhetschefen ser vårdenhetens intyg | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Övningar och intyg > varje yrkesroll har övningar, och rätt svar lämnas inte ut före rättningen | Inte kört | inte kört | inte kört |
| Övningar och intyg > alla rätt ger ett intyg som gäller i ett år, och ett fel ger förklaringar men inget intyg | Inte kört | inte kört | inte kört |
| Övningar och intyg > verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, och ingen annan gör det | Inte kört | inte kört | inte kört |

### 10.1.1.4 Förändrat gränssnitt

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Nyheter > nyheterna har version, datum och roller, och den senaste versionen är den som körs | Inte kört | inte kört | inte kört |
| Nyheter > rutan visar bara den aktuella versionens nyheter för användarens roll, och historiken går att läsa igen | Inte kört | inte kört | inte kört |
| Nyheter > rutan stängs per användare och version och kommer tillbaka vid nästa version | Inte kört | inte kört | inte kört |
| Nyheter > API: nyheter kräver inloggning, och invånaren får sina egna | Inte kört | inte kört | inte kört |
| Gränssnitt > Utbildning > nyhetsrutan visar rollens nyheter efter inloggning, stängs med ett klick och går att läsa igen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Klickbudget > Läsa nyheterna och stänga dem inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 10.1.1.5 Certifierade användare

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Övningar och intyg > varje yrkesroll har övningar, och rätt svar lämnas inte ut före rättningen | Inte kört | inte kört | inte kört |
| Övningar och intyg > alla rätt ger ett intyg som gäller i ett år, och ett fel ger förklaringar men inget intyg | Inte kört | inte kört | inte kört |
| Övningar och intyg > intyget går ut efter ett år, och systemet varnar 30 dagar innan | Inte kört | inte kört | inte kört |
| Övningar och intyg > verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, och ingen annan gör det | Inte kört | inte kört | inte kört |
| Övningar och intyg > övningarna och nyheterna innehåller inga patientuppgifter utom demopatienternas namn, och texterna är svenska | Inte kört | inte kört | inte kört |
| Övningar och intyg > ett intyg ändras och raderas aldrig | Inte kört | inte kört | inte kört |
| Övningar och intyg > verksamhetschefen och en utbildare ändrar övningarna som en ny version med historik, och ingen annan gör det | Inte kört | inte kört | inte kört |
| Övningar och intyg > en ändrad övning prövas innan den sparas, och systemet säger vad som saknas | Inte kört | inte kört | inte kört |
| Övningar och intyg > verksamhetschefen utfärdar utbildarintyg bara till någon på vårdenheten med giltigt intyg | Inte kört | inte kört | inte kört |
| Gränssnitt > Utbildning > övningarna ger ett intyg med giltighetstid, och verksamhetschefen ser vårdenhetens intyg | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Utbildning > verksamhetschefen utser en utbildare, och utbildaren ändrar en övning som sparas som en ny version med historik | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Utbildning > hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Övningar per vårdenhet > personalen gör vårdgivarens och den egna vårdenhetens övningar, och de egna har ett eget prefix | Inte kört | inte kört | inte kört |
| Övningar per vårdenhet > vårdenhetens verksamhetschef och utbildare ändrar de egna övningarna som en ny version med egen historik | Inte kört | inte kört | inte kört |
| Praktiska prov > utbildaren och verksamhetschefen skapar praktiska prov för vårdenheten, och den som inte är utbildare får inte | Inte kört | inte kört | inte kört |
| Praktiska prov > läkaren gör provet i en övningsjournal som systemet väljer, och systemet kontrollerar ordinationen i journalen | Inte kört | inte kört | inte kört |
| Praktiska prov > en anteckning som inte är signerad godkänns inte, och en signerad anteckning godkänns | Inte kört | inte kört | inte kört |
| Praktiska prov > utbildaren följer upp vem som har klarat provet utan att se vilken patient provet gjordes på | Inte kört | inte kört | inte kört |
| Praktiska prov > systemet väljer en övningsjournal som personen har vårdrelation till, aldrig en skyddad patient, och ett godkänt prov gäller i ett år | Inte kört | inte kört | inte kört |
| Gränssnitt > Utbildning > utbildaren skapar ett praktiskt prov, läkaren gör det i övningsjournalen och systemet kontrollerar resultatet | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 11.2.1.5 Beprövad och standardiserad testmetod

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |
| Kravregistret > saknade eller röda tester ger delvis | Inte kört | inte kört | inte kört |
| Testmetod > testmetoden beskrivs efter ISO/IEC/IEEE 29119-3 med testplan, testdesign, testfall, testprocedurer och testrapporter, och allt den pekar på finns | Inte kört | inte kört | inte kört |

### 11.2.1.7 Testprotokoll med spårbarhet till krav

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Inte kört | inte kört | inte kört |
| Sussa-registret > alla 389 id finns exakt en gång, och varje post har en mappning | Inte kört | inte kört | inte kört |
| Sussa-registret > uppfyllt_demo kräver gröna tester | Inte kört | inte kört | inte kört |
| API > krav visar kravregistret | Inte kört | inte kört | inte kört |
| Testprotokoll > varje krav och varje Sussa-post med tester finns med sina testfall, resultat, datum och version | Inte kört | inte kört | inte kört |
| Testprotokoll > ett test som saknas, är rött eller inaktuellt syns som det, och summan räknas ur testfallen | Inte kört | inte kört | inte kört |
| Testprotokoll > protokollet säger att inget acceptanstest med en beställare är gjort, också i markdown | Inte kört | inte kört | inte kört |
| Testprotokoll > källan och datumet för varje testfall kommer från filen som testet kördes i | Inte kört | inte kört | inte kört |
| Testprotokoll > docs/testprotokoll.md är skrivet av skriptet med version, kodhash och acceptanstestet | Inte kört | inte kört | inte kört |
| Testprotokoll i API:t > GET /api/krav/testprotokoll är öppen utan inloggning och skapar ingen sandlåda | Inte kört | inte kört | inte kört |

### 11.2.1.8 Reservlösning för läkemedelsinformation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läskopia > en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något | Inte kört | inte kört | inte kört |
| Administrering via API > Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet | Inte kört | inte kört | inte kört |
| Läskopia > varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient | Inte kört | inte kört | inte kört |
| Läskopia > förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar | Inte kört | inte kört | inte kört |
| Läskopia > innehåller bara det servern redan lämnar ut till den inloggade | Inte kört | inte kört | inte kört |
| Läskopia > yrkesrollen styr vad läskopian innehåller | Inte kört | inte kört | inte kört |
| Gränssnitt > Avbrott > läskopian förnyas av sig själv medan personen är inloggad | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > appen startar utan nät från service workern och visar läsläget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Avbrott > fel reservkod ger väntetid och rätt reservkod öppnar läsläget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### 11.3.1.5 Plan för implementation av Tillväxt

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Plan för införande av tillväxt > planen har alla delar som Sussa 11.3.1.1 kräver och visas på barnavårdscentralens sida | Inte kört | inte kört | inte kört |

### 12.1.1.1 Applikationskonfiguration

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > omorganisation: namnbyte förbereds med datum och förhandsvisning, och på dagen byter enheten namn medan det som redan är skrivet visar det gamla namnet | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: förhandsvisningen av en sammanslagning visar allt som påverkas med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: sammanslagning på dagen flyttar det som pågår och ligger framåt, och historiken stannar på den gamla vårdenheten | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: efter en sammanslagning gäller spärren mot den gamla vårdenhetens uppgifter som förut, också för personalen på den nya, och de gamla uppgifterna kräver ett aktivt val | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: vid namnbyte är det samma enhet, och spärren gäller som förut | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: en omorganisation som ändrar åtkomsten kräver fyra ögon och genomförs först när en annan systemförvaltare har godkänt den | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: en mottagare hos en annan vårdgivare avvisas med en förklaring | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: ett namnbyte kräver inte fyra ögon, loggas och kan ångras fram till datumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: personalen som registrerar spärrar ser att patienten kan tillfrågas om spärren ska gälla den nya vårdenheten, utan att något röjs för andra, och ingen spärr sätts automatiskt | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: nedläggning stänger vårdenheten, mottagaren tar över det som pågår, och en stängd vårdenhet tar inte emot remisser | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: delning fördelar arbetsplatserna och personalen på de nya vårdenheterna och flyttar tidbokens tider framåt | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: systemet stoppar ett namn som redan finns, ett datum bakåt i tiden och en enhet som redan ingår i en förberedd förändring | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: API: förbereda, avbryta och se förändringarna, utan patientuppgifter, och en förändring som gäller i dag genomförs vid nästa anrop | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Förbereda ett namnbyte för en enhet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Inte kört | inte kört | inte kört |

### 12.1.1.3 Applikationskonfiguration

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade | Inte kört | inte kört | inte kört |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten | Inte kört | inte kört | inte kört |

### 12.1.1.4 Omorganisation

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > omorganisation: namnbyte förbereds med datum och förhandsvisning, och på dagen byter enheten namn medan det som redan är skrivet visar det gamla namnet | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: förhandsvisningen av en sammanslagning visar allt som påverkas med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: sammanslagning på dagen flyttar det som pågår och ligger framåt, och historiken stannar på den gamla vårdenheten | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: efter en sammanslagning gäller spärren mot den gamla vårdenhetens uppgifter som förut, också för personalen på den nya, och de gamla uppgifterna kräver ett aktivt val | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: vid namnbyte är det samma enhet, och spärren gäller som förut | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: en omorganisation som ändrar åtkomsten kräver fyra ögon och genomförs först när en annan systemförvaltare har godkänt den | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: en mottagare hos en annan vårdgivare avvisas med en förklaring | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: ett namnbyte kräver inte fyra ögon, loggas och kan ångras fram till datumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: personalen som registrerar spärrar ser att patienten kan tillfrågas om spärren ska gälla den nya vårdenheten, utan att något röjs för andra, och ingen spärr sätts automatiskt | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: nedläggning stänger vårdenheten, mottagaren tar över det som pågår, och en stängd vårdenhet tar inte emot remisser | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: delning fördelar arbetsplatserna och personalen på de nya vårdenheterna och flyttar tidbokens tider framåt | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: systemet stoppar ett namn som redan finns, ett datum bakåt i tiden och en enhet som redan ingår i en förberedd förändring | Inte kört | inte kört | inte kört |
| Systemförvaltning > omorganisation: API: förbereda, avbryta och se förändringarna, utan patientuppgifter, och en förändring som gäller i dag genomförs vid nästa anrop | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Förbereda ett namnbyte för en enhet inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |

### 12.1.1.5 Applikationskonfiguration

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen | Inte kört | inte kört | inte kört |

### 12.1.1.6 Administration

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Inte kört | inte kört | inte kört |
| Administration som konfiguration > tidboken och vårdgarantin: reglerna är parametrar med samma standardvärden, och väntelistan räknar gränsen ur det godkända värdet | Inte kört | inte kört | inte kört |
| Administration som konfiguration > avgifterna och högkostnadsskyddet: parametrar med fyra ögon som avgiften räknas ur, och sidan säger vad som inte går att ändra | Inte kört | inte kört | inte kört |
| Lagrum för avgifter och vårdgaranti > taken för högkostnadsskyddet och slutenvården räknas ur prisbasbeloppet för året | Inte kört | inte kört | inte kört |
| Lagrum för avgifter och vårdgaranti > avgiften per vårddag kan inte sättas över lagens tak för det år ändringen gäller | Inte kört | inte kört | inte kört |
| Lagrum för avgifter och vårdgaranti > högkostnadsskyddet och åldersgränserna har paragrafen i texten, och avgiftsfriheten för barn är regionens beslut | Inte kört | inte kört | inte kört |
| Lagrum för avgifter och vårdgaranti > rabatten följer vårdgivarens godkända avgifter och åldersgränser, inte standardvärdena | Inte kört | inte kört | inte kört |
| Lagrum för avgifter och vårdgaranti > vårdgarantin räknas från att remissen utfärdades, med lagrummet i hälso- och sjukvårdsförordningen | Inte kört | inte kört | inte kört |
| Lagrum för avgifter och vårdgaranti > i primärvården gäller bedömningsgarantin i tre dagar för en egen vårdbegäran, och inte de 90 dagarna för specialiserad vård | Inte kört | inte kört | inte kört |
| Parametrar för utloggning och rapportering > undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten | Inte kört | inte kört | inte kört |
| Nivå 2 (runda 13, r4) > E3-27: allt som väntar på godkännande står samlat, och bara det någon annan har föreslagit räknas som att godkänna | Inte kört | inte kört | inte kört |

### 12.1.1.7 Strukturerad information

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Inte kört | inte kört | inte kört |
| Journalens struktur > mall: en ny mall med ett nytt sökord godkänns av en annan systemförvaltare och används direkt i journalen | Inte kört | inte kört | inte kört |
| Journalens struktur > mall: systemet sätter koden för ett känt sökord, kontrollerar Snomed CT:s kontrollsiffra och stoppar en kod som redan har ett annat namn | Inte kört | inte kört | inte kört |
| Journalens struktur > mall: FHIR lämnar ut anteckningen med anteckningstypens och sökordens koder | Inte kört | inte kört | inte kört |
| Journalens struktur > mall: en ny version visar vad som påverkas, och skrivna anteckningar ändras inte | Inte kört | inte kört | inte kört |
| Journalens struktur > mattyp: en ny mätvärdestyp kontrolleras mot NPU, LOINC och UCUM, och en kod som redan används stoppas | Inte kört | inte kört | inte kört |
| Journalens struktur > mattyp: efter godkännandet går den att registrera inom de rimliga värdena, och FHIR lämnar ut den med kod och UCUM | Inte kört | inte kört | inte kört |
| Journalens struktur > mattyp: koden och enheten kan inte ändras när värden finns, men gränserna kan | Inte kört | inte kört | inte kört |
| Journalens struktur > fyra ögon: en beslutad version ändras eller raderas inte, ett godkännande prövas igen och allt loggas | Inte kört | inte kört | inte kört |
| Journalens struktur > behörighet: bara systemförvaltningen ändrar journalens struktur, och svaren innehåller inga patientuppgifter | Inte kört | inte kört | inte kört |
| Journalens struktur > API: systemförvaltaren föreslår en mall och en mätvärdestyp, kollegan godkänner i sin egen inloggning, och konfigurationen stannar i sandlådan | Inte kört | inte kört | inte kört |
| Journalens struktur > ram: vårdgivarens ram anger sökord som måste finnas och sökord som får läggas till lokalt | Inte kört | inte kört | inte kört |
| Journalens struktur > lokal: en vårdenhets anpassning inom ramen gäller bara på vårdenheten, och en anpassning utanför ramen stoppas | Inte kört | inte kört | inte kört |
| Journalens struktur > ram: en ny ram visar vilka lokala anpassningar som slutar gälla, och de slutar gälla när den godkänns | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > ett lokalt kodverk från verksamheten skapas med fyra ögon och dess koder går att hämta i API:t | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > en utgåva gäller först när en annan systemförvaltare har godkänt den, och aldrig bakåt i tiden | Inte kört | inte kört | inte kört |
| Förvaltning av kodverk > en ny utgåva kontrolleras och jämförs med den som gäller: nya, ändrade och borttagna koder och hur många diagnoser som berörs | Inte kört | inte kört | inte kört |
| Tobaksvanor > hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig | Inte kört | inte kört | inte kört |

### 12.1.1.8 Läkemedel

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Inte kört | inte kört | inte kört |
| Läkemedelsregler som konfiguration > interaktioner: vårdgivarens lista är en demoregel med fyra ögon, och en ny interaktion ger en varning vid ordination | Inte kört | inte kört | inte kört |
| Läkemedelsregler som konfiguration > maxdoser och njurfunktion: högsta dygnsdosen och gränserna för metformin är parametrar som läses vid varje ordination | Inte kört | inte kört | inte kört |
| Läkemedelsregler som konfiguration > ordinationsorsak och uppföljningsdatum: frivilliga där NLL inte berörs om vårdgivaren väljer det, och alltid krav vid förskrivning | Inte kört | inte kört | inte kört |
| Läkemedelsvarningar vid ordination > NSAID till en äldre patient med apixaban, furosemid och spironolakton ger varningar som nämner varje interaktion | Inte kört | inte kört | inte kört |
| Läkemedelsvarningar vid ordination > warfarin till en patient med tikagrelor och acetylsalicylsyra ger en varning för trippelbehandling | Inte kört | inte kört | inte kört |
| Läkemedelsvarningar vid ordination > läkemedel i Nationella läkemedelslistan från en spärrad vårdenhet ingår i interaktionskontrollen när ordinationen sparas, utan att läkemedlet röjs och med loggning | Inte kört | inte kört | inte kört |
| Läkemedelsmallar i gränssnittet > en läkare bygger en ny läkemedelsmall med systemets förslag, och den används först när den mallansvariga läkaren har godkänt den | Inte kört | inte kört | inte kört |
| Läkemedelsmallar i gränssnittet > API: en läkare ändrar en läkemedelsmall i gränssnittet och ser vem som ska godkänna den | Inte kört | inte kört | inte kört |

### 12.1.1.9 Beställning och svar

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Inte kört | inte kört | inte kört |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Inte kört | inte kört | inte kört |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Klickbudget i webbläsaren | 2026-11-12 kl. 11:24 UTC |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Inte kört | inte kört | inte kört |
| Beställning och svar > paketens innehåll och laboratoriets svarstid ändras på ett ställe och slår igenom i förslagen och svaren | Inte kört | inte kört | inte kört |
| Parametrar för beställning och svar > vad som förs över till det mottagande systemet, etikettskrivarna och anvisningarna ändras med fyra ögon och slår igenom | Inte kört | inte kört | inte kört |
| Parametrar för beställning och svar > etikettformatet följer parametern för arbetsplatsen där den som skriver ut arbetar | Inte kört | inte kört | inte kört |

### 12.1.1.10 Undantas från visning

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > undantag: en anteckningstyp undantas från visning med fyra ögon, och journalen säger hur många som inte visas och varför | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: undantaget gäller aldrig Min journal | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: undantaget ändrar inte spärrar, och en spärrad uppgift varken visas eller räknas | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: FHIR för externa tillämpningar får inte undantagna uppgifter | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: publiceringen till nationella tjänster (simulerad) räknar bort det undantagna | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: systemet stoppar ett undantag som skulle dölja uppgifter i pågående vård och förklarar varför | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: översikten visar tydligt vad som är undantaget, och ett undantag kan avslutas | Inte kört | inte kört | inte kört |
| Systemförvaltning > undantag: ett undantag som inte längre är tillåtet kan varken godkännas eller avslutas via konfigurationens väg, och varje väg prövar samma sak | Inte kört | inte kört | inte kört |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Inte kört | inte kört | inte kört |
| Undantag av en enskild anteckning > en enskild anteckning undantas från visning med fyra ögon, och journalen, sökningen och direktläsningen visar den inte | Inte kört | inte kört | inte kört |
| Undantag av en enskild anteckning > en rättelse av en undantagen anteckning är också undantagen, och ett undantag på en anteckning i pågående vård stoppas | Inte kört | inte kört | inte kört |
| Undantag av en enskild anteckning > ett undantag på en spärrad vårdenhets anteckning röjer inget: svaret är detsamma med och utan undantaget | Inte kört | inte kört | inte kört |
| Undantag av en enskild anteckning > FHIR, publiceringen och producenten för tjänstekontrakt prövar samma undantag, och Min journal visar anteckningen | Inte kört | inte kört | inte kört |
| Begäran om undantag av en anteckning > journalen visar anteckningens nummer, och den som skrev anteckningen begär undantag med kanal och skäl | Inte kört | inte kört | inte kört |
| Begäran om undantag av en anteckning > bara den som skrev anteckningen eller en läkare på dess vårdenhet kan begära undantag | Inte kört | inte kört | inte kört |
| Begäran om undantag av en anteckning > systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som begär, men inte innehållet, och godkänner med en andra systemförvaltare | Inte kört | inte kört | inte kört |
| Begäran om undantag av en anteckning > systemförvaltaren kan avslå en begäran med en kommentar, och den som begärde ser det | Inte kört | inte kört | inte kört |
| Begäran om undantag av en anteckning > förhandsvisningen av ett nummer utan begäran ger samma svar för en befintlig, en spärrad, en skyddad och en obefintlig anteckning | Inte kört | inte kört | inte kört |
| Begäran om undantag av en anteckning > en undantagen anteckning syns inte i händelsekedjan, och direkt öppning ger samma svar som en anteckning som inte finns | Inte kört | inte kört | inte kört |

### KD1.1.1.5 Krav på drift samt maskin- och programvara

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter | Inte kört | inte kört | inte kört |
| Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön | Inte kört | inte kört | inte kört |
| Miljöer > miljön är märkt i varje svar om sessionen och går inte att återställa, och det går att gå tillbaka till produktionsmiljön | Inte kört | inte kört | inte kört |
| Miljöer > bara systemförvaltaren skapar miljöer, högst tre per sandlåda och inte ur en annan miljö | Inte kört | inte kört | inte kört |
| Lasttest > 100 samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Lasttest | 2026-11-12 kl. 15:06 UTC |
| Lasttest > 500 samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Lasttest | 2026-11-12 kl. 15:06 UTC |
| Vilande sandlådor i servern > en sandlåda som inte har använts på tio minuter skrivs till disk och släpps ur minnet, och nästa anrop läser in den med allt kvar | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > en aktiv sandlåda tas aldrig bort för att ge plats åt en ny: med plats för tre i minnet finns alla åtta kvar | Inte kört | inte kört | inte kört |
| När demon är full > en ny besökare får 503 med en förklaring på svenska och när det är lönt att försöka igen, och de som redan arbetar märker inget | Inte kört | inte kört | inte kört |

### KD1.1.1.10 Monitorera kapacitetsbrister

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vilande sandlådor: lagret > en sandlåda skrivs komprimerad till disk under ett namn som inte röjer id:t och läses in oförändrad | Inte kört | inte kört | inte kört |
| Vilande sandlådor: lagret > taket i minnet räknas ur containerns minnesgräns, och utan gräns gäller standardvärdet | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > en sandlåda som inte har använts på tio minuter skrivs till disk och släpps ur minnet, och nästa anrop läser in den med allt kvar | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > en aktiv sandlåda tas aldrig bort för att ge plats åt en ny: med plats för tre i minnet finns alla åtta kvar | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > sidan om systemets uppbyggnad och driftsidan väcker inga andra sandlådor | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > läskopians logg från läsläget tas emot för en sandlåda som vilar, utan inloggning | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > flerfaktor: en inloggning som väntar på engångskoden fortsätter efter att sandlådan har vilat | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > prenumerationer ger meddelanden också efter att sandlådan har vilat | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > intensivvårdens realtidsvisning från den kopplade monitorn fortsätter efter att sandlådan har vilat | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > miljöer för acceptanstest: miljön och produktionsmiljön hittar varandra efter att båda har vilat | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > kalenderlänken fungerar för en sandlåda som vilar, och en okänd länk väcker inga sandlådor | Inte kört | inte kört | inte kört |
| När demon är full > en ny besökare får 503 med en förklaring på svenska och när det är lönt att försöka igen, och de som redan arbetar märker inget | Inte kört | inte kört | inte kört |
| När demon är full > när alla platser i minnet används just nu får en ny besökare vänta, men en besökare vars sandlåda vilar kommer alltid in | Inte kört | inte kört | inte kört |
| Omstart med vilande sandlådor > vid stopp skrivs sandlådorna till disk, sessionsfilen har inga databaser, och efter start vilar de tills de används | Inte kört | inte kört | inte kört |
| Missbruk från många besökare > en uppblåst sandlåda tar fler platser i minnet, så att minnet håller sig inom budgeten | Inte kört | inte kört | inte kört |
| Missbruk från många besökare > en sandlåda kan inte växa över taket för databasen, och anropet som skulle göra det får ett begripligt fel | Inte kört | inte kört | inte kört |

### KD1.1.3.3 Krav på datalagring

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: säkerhetskopia till fil med VACUUM INTO och återläsning ger ett konsistent läge med alla tabeller, rader och triggrar | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: en kopia som skiljer sig från originalet underkänns | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Inte kört | inte kört | inte kört |

### KD1.1.3.4 Krav på datalagring

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: varje tabell klassas efter huvudman, och ingen tabell är oklassad | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: uttaget för en huvudman har bara dess egna uppgifter, och en annan huvudmans uppgifter finns inte med | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: uttaget har samma tabeller, index och triggrar som originalet | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: uttaget som fil kräver ett beslut med diarienummer och skäl, och fyra ögon | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: filen har bara huvudmannens uppgifter, ett manifest med kontrollsummor, NDJSON per tabell och FHIR per patient, och är märkt som demodata | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: varje patient i uttaget loggas, och filen hämtas genom API:t bara av systemförvaltaren | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Inte kört | inte kört | inte kört |

### KD1.1.3.5 Datalagring

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: varje tabell klassas efter huvudman, och ingen tabell är oklassad | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: uttaget för en huvudman har bara dess egna uppgifter, och en annan huvudmans uppgifter finns inte med | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: uttaget har samma tabeller, index och triggrar som originalet | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Inte kört | inte kört | inte kört |
| Lagringsprognos > prognosen räknar tillväxten det senaste året och skriver fram storleken, också med fördubblad aktivitet | Inte kört | inte kört | inte kört |
| Lagringsprognos > lagringsklasserna delar upp volymen efter ålder och visar kostnaden per månad med och utan klasser | Inte kört | inte kört | inte kört |

### KD1.1.3.6 Dataförlust

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: säkerhetskopia till fil med VACUUM INTO och återläsning ger ett konsistent läge med alla tabeller, rader och triggrar | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: en kopia som skiljer sig från originalet underkänns | Inte kört | inte kört | inte kört |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Inte kört | inte kört | inte kört |
| Säkerhetskopior > varje kopia skrivs på två platser och verifieras på båda, och sandlådans id syns inte i något filnamn | Inte kört | inte kört | inte kört |
| Säkerhetskopior > en skadad kopia underkänns, och återläsningen tar den från den andra platsen | Inte kört | inte kört | inte kört |
| Säkerhetskopior > schemaläggningen tar en kopia av varje sandlåda som har ändrats sedan sin senaste kopia, och sparar ett begränsat antal | Inte kört | inte kört | inte kört |
| Säkerhetskopior > återställning till en tidpunkt tar den senaste verifierade kopian före tidpunkten, sparar läget före och behåller loggarna | Inte kört | inte kört | inte kört |
| Säkerhetskopior > bara systemförvaltningen ser och återställer kopiorna | Inte kört | inte kört | inte kört |
| Säkerhetskopior > API: systemförvaltaren ser när den senaste kopian togs och om den är verifierad, och återställer sandlådan till en tidpunkt | Inte kört | inte kört | inte kört |
| Releaser > varje migrering har en återställning, och upp och sedan ned ger samma schema som före | Inte kört | inte kört | inte kört |
| Releaser > schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen | Inte kört | inte kört | inte kört |
| Releaser > återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 1: säkerhetskopiorna har tak > en manuell kopia per minut och tio per timme per sandlåda, sedan 429 med en förklaring | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 1: säkerhetskopiorna har tak > ett tak för diskutrymmet över alla sandlådor, där de äldsta kopiorna tas bort först | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 1: säkerhetskopiorna har tak > det schemalagda jobbet tar en sandlåda i taget och släpper fram andra anrop emellan | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 4: en ensam systemförvaltare kan inte läsa in en kopia, och förslaget säger vad som går förlorat | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 4: en spärr som har registrerats efter kopian stoppar inläsningen med en förklaring, också mellan förslag och godkännande | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 3: en faktor som registrerades efter kopian finns kvar efter inläsningen | Inte kört | inte kört | inte kört |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 3: efter inläsning av en kopia är sessionen utloggad, och en roll med faktor i kopian kräver faktorn | Inte kört | inte kört | inte kört |
| Vilande sandlådor i servern > en sandlåda som inte har använts på åtta timmar försvinner, också från disk och med sina säkerhetskopior | Inte kört | inte kört | inte kört |

### KD1.1.4.3 Krav på följsamhet mot klient och klientplattform

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Tillgänglighet > alla vyer fungerar på mobil, platta och stor skärm utan rullning i sidled och utan för långa textrader | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > vid 320 px bredd behövs ingen rullning i sidled | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > texten går att förstora till 200 procent utan att innehåll eller funktion försvinner | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

### KD1.1.4.10 Bildskärm

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Tillgänglighet > alla vyer fungerar på mobil, platta och stor skärm utan rullning i sidled och utan för långa textrader | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > vid 320 px bredd behövs ingen rullning i sidled | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > texten går att förstora till 200 procent utan att innehåll eller funktion försvinner | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > högkontrastläget ger minst 7:1 i kontrast och följer datorns inställning | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |
| Gränssnitt > Tillgänglighet > flera skärmar: en del av journalen öppnas i ett nytt fönster som följer patientbytet, och ett låst fönster visar tydligt att en annan patient är öppen | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Gränssnittstest i webbläsaren | 2026-11-12 kl. 11:58 UTC |

## Krav utan testfall

Eget ramverk: D12, L8, L11, L12, M1, M3, M7, M10, M11, M13.

Sussas kravspecifikation: 2.2.1.1, 2.2.1.2, 2.2.1.3, 2.2.1.4, 2.2.1.5, 2.2.1.6, 2.2.1.9, 2.2.1.10, 2.2.1.11, 2.2.1.12, 2.2.1.13, 2.2.1.14, 2.4.1.1, 2.6.1.1, 2.6.1.3, 2.7.1.1, 3.1.4.1, 3.1.4.2, 3.5.1.10, 3.5.2.16, 3.5.4.5, 3.7.1.2, 5.1.4.2, 5.1.4.3, 5.1.4.4, 5.1.4.6, 5.2.1.1, 5.2.1.5, 5.3.1.1, 5.3.1.4, 5.3.1.9, 5.3.1.10, 5.3.1.11, 5.3.1.13, 5.3.1.14, 5.3.1.15, 5.3.1.16, 5.3.1.17, 5.4.2.2, 9.1.1.1, 9.1.1.2, 9.1.1.3, 10.1.1.1, 11.1.1.1, 11.1.1.2, 11.2.1.1, 11.2.1.2, 11.2.1.3, 11.2.1.4, 11.2.1.6, 11.2.1.9, 11.2.1.10, 11.2.1.11, 11.2.1.12, 11.3.1.1, 11.3.1.2, 11.3.1.3, 11.3.1.4, 11.3.1.6, 11.3.1.7, 11.3.1.8, 11.3.1.9, 11.3.1.10, 12.1.1.2, 12.2.1.1, 12.2.1.2, 12.2.1.3, 12.3.1.1, 12.3.1.2, 12.3.1.3, 12.3.1.4, 12.3.1.5, KD1.1.1.1, KD1.1.1.2, KD1.1.1.3, KD1.1.1.4, KD1.1.1.6, KD1.1.1.7, KD1.1.1.8, KD1.1.1.9, KD1.1.1.11, KD1.1.1.12, KD1.1.1.13, KD1.1.2.1, KD1.1.2.2, KD1.1.3.1, KD1.1.3.2, KD1.1.4.1, KD1.1.4.2, KD1.1.4.4, KD1.1.4.5, KD1.1.4.6, KD1.1.4.7, KD1.1.4.8, KD1.1.4.9, KD1.2.1.1, KD1.2.1.2, KD1.2.1.3, KD1.2.1.4, KD1.2.1.5, KD1.3.1.1, KD1.3.1.2, KD1.3.1.3, KD1.3.2.1, KD1.3.2.2, KD1.3.2.3, KD1.3.2.4, KD1.3.3.1, KD1.3.3.2, KD1.3.4.1, KD1.3.4.2, KD1.3.5.1, KD1.3.5.2, KD1.3.6.1, KD1.3.6.2, KD1.3.7.1.
