# Testprotokoll

Testprotokoll med spårbarhet till krav, Sussa 11.2.1.7. Version 1.4.0, kod 2869df751347, servertesterna körda 2026-11-12 kl. 20:02 svensk tid.

Inget acceptanstest med en beställare är gjort. Protokollet visar resultatet av Vårdkällans egna automatiska tester i det senaste bygget och är underlaget inför ett acceptanstest, inte resultatet av ett.

Protokollet skrivs av `app/scripts/testprotokoll-md.js` ur kravregistret (`app/src/krav.js`), Sussa-registret (`app/src/sussa/`) och resultaten från bygget, med `app/src/testprotokoll.js`. Samma protokoll visas på sidan Testprotokoll i demon (`#/testprotokoll`), räknat ur bygget som körs där. Kodhashen är sha256 över `app/src/` och `app/public/` och visar vilken byggd kod resultaten gäller.

## Sammanfattning

Krav och poster med testfall: 307, varav 305 med alla testfall godkända. Testfall: 3280, varav 3277 godkänt, 0 ej godkänt, 0 hoppades över, 0 inte kört, 3 inaktuellt, gränssnittet har ändrats sedan testet kördes. Krav utan testfall: 10 i det egna ramverket och 115 i Sussas kravspecifikation.

## Körningar

| Körning | Tid | Testfall | Godkända | Ej godkända |
| --- | --- | --- | --- | --- |
| Servertest | 2026-11-12 kl. 20:02 svensk tid | 1825 | 1825 | 0 |
| Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid | 84 | 84 | 0 |
| Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid | 120 | 120 | 0 |
| Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid | 56 | 56 | 0 |
| Lasttest | 2026-11-12 kl. 16:06 svensk tid | 3 | 3 | 0 |
| Validering med HL7:s validator | 2026-11-12 kl. 12:25 svensk tid | 1 | 1 | 0 |

## Eget ramverk

### K1 Kravregister med id, källa, status och koppling till tester

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > alla krav K1 till K5, D1 till D12, L1 till L13 och M1 till M13 finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > krav visar kravregistret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-registret > alla 389 id finns exakt en gång, och varje post har en mappning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-registret > uppfyllt_demo kräver gröna tester | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-registret > källan anges och alla kapitel ingår | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-registret > API: krav/sussa ger registret utan inloggning, med egna krav och testernas status | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Version 1.0 > villkoren räknas ur registret, testfallen och säkerhetsfynden, och 1.0 nås bara när alla fyra är uppfyllda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Version 1.0 > API: krav/version ger versionen ur package.json och de fyra villkoren utan inloggning, och listan med säkerhetsfynd är tom | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### K2 Svarsmappning från kriterier till leverantörens FVIS-krav

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussa-avtalet > varje post har Cambios svar med källa, och maskerade svar är märkta som maskerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-avtalet > viktningen stämmer med utvärderingsmodellen och Cambios prispåslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-avtalet > registret visar vikt, rang och betyg per kriterium så att det går att sortera på vad Sussa värderade högst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-avtalet > API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Visa de tio högst viktade kriterierna som inte är uppfyllda inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### K3 Prioritetssignal för krav som exkluderades eller sköts upp

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussa-avtalet > poster som exkluderades ur avtalet eller sköts upp 2022 har en signal med skäl och källa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-avtalet > API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-avtalet > datafilerna har inga tankstreck, ellipser eller personnamn ur handlingarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### K4 Varje krav bryts ned till automatiserade testfall och ett användarscenario

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > saknade eller röda tester ger delvis | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kravregistret > planerade krav förblir planerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > tidspoängen följer tabellen i Bilaga F1:2 för de fyra tidsklasserna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > måluppfyllelsen ger 10, 5, 2 eller 0 efter slutvillkoret och klickbudgeten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > omvandlingen till utvärderingspoäng följer Bilaga F1:2 avsnitt 5 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > tidsuppskattningen följer keystroke-level model med den uppmätta svarstiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > demoläget lägger in testpatienterna med Skatteverkets testpersonnummer och datan som testfallen behöver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > tema 1 genomförs med Sussas läkemedel i en katalog med minst 100 produkter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Sussas testfall > 1.1 Förskriva läkemedel (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.2 Ordinera läkemedel (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.3 Ordinera läkemedel på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.4 Administrera läkemedel (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.4 Signera (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.4 Omboka besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.5 Ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.6 Överblicka ankomstregistrering (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.7 Oplanerad ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.8 Väntelista (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### K5 Bör-krav och målbild som separat backlogg

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussa-avtalet > bör-krav och målbild är en egen lista kopplad till posterna, med status från posterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-avtalet > API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D1 Kvitterade meddelanden med larm, och när NLL inte svarar i tid döljs aldrig en lyckad förskrivning

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: svar saknas efter sista svarsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D2 Kronologisk helhetsbild där migrerad historik syns likvärdigt med ny

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D3 Verifierad migrering med avstämningsrapport

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > migreringsavstämningen visar avvikelsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D4 Läsåtkomst vid avbrott och inloggning som inte faller med en extern tjänst

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läskopia > nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > innehåller bara det servern redan lämnar ut till den inloggade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > spärrade uppgifter och skyddad identitet följer samma regler i läskopian | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > yrkesrollen styr vad läskopian innehåller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > utan inloggning lämnas ingen läskopia ut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > att uppgifterna lämnas ut till läskopian loggas en gång per patient och grund | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > åtkomster utanför läskopian, med fel handling eller fel tid avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > en rad som skickas två gånger loggas en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > läskopians nyckel och kopplingar överlever omstart av servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > service workern cachar alla statiska filer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > krypterade åtkomster från läsläget tas emot utan inloggning och loggas på personen som hade läskopian | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > krypterade rader som inte går att verifiera eller gäller fel person eller kopia avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > läskopian tar emot loggen från före utloggningen men inga senare läsningar, och nyckeln lämnas inte ut igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > en läsning efter utloggningen tas inte emot | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > tiderna rättas när webbläsarens klocka går fel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > en krypterad rad loggas en gång, också efter omstart av servern, och inte efter att läskopian gått ut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Avbrott > läskopian förnyas av sig själv medan personen är inloggad | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > appen startar utan nät från service workern och visar läsläget | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > läskopian i webbläsaren är krypterad och nyckeln ligger inte i IndexedDB | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > skrivande är avstängt i läsläget med en förklaring | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > simulerat avbrott ger läsläge medan servern svarar andra besökare | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > åtkomster i läsläget når åtkomstloggen när servern svarar igen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > läskopian rensas vid utloggning | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > läskopian används inte efter 8 timmar | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > reservkoden väljs när webbläsaren är uppkopplad och bara den inslagna nyckeln sparas | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > efter omstart av webbläsaren utan nät visas vilka som har en reservkopia på datorn och när den går ut | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > fel reservkod ger väntetid och rätt reservkod öppnar läsläget | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > åtkomster med reservkod loggas krypterat och överlever att fliken stängs | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > när servern svarar igen mitt i läsläget med reservkod når åtkomsterna åtkomstloggen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > utloggning raderar reservkopian, den inslagna nyckeln och loggen efter att loggen förts över | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > utloggning i en flik avslutar läsläget i webbläsarens andra flikar | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > en navigering direkt till en fil ersätter inte appen i service workerns cache | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > fem fel reservkoder raderar reservkopian och flikar kan inte pröva samtidigt | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > två personer på samma dator har var sin reservkopia som bara öppnas med egen kod | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > simulerat avbrott visar reservinloggningen när fliken stängs i demon | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Min journal > patientvyn får ingen läskopia | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D5 Svarstidsmål per vanlig åtgärd, mätta i drift och publicerade

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > hälsa och Server-Timing på alla svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > drift visar p50 och p95 per adress i API:t | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D6 Klickbudget per vanligt arbetsflöde, mätt med verkliga användare

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Öppna patient från arbetslistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Läsa senaste anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva och signera en daganteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ordinera ett läkemedel utan varning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Bekräfta föreslagen uppmärksamhetsinformation inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera blodtryck inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skicka remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Kvittera remissvar inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Nödåtkomst inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera patient utan känd identitet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Slå samman en dubblett inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Bekräfta ett hälsoärende inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva in en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Flytta en patient till en annan avdelning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva ut en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett besök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Planera ett videobesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ge en dos inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Vidimera pågående ordinationer inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel med varning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Sätta ut Waran med plan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva ut läkemedelslistan vid utskrivning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Begära kontrasignering av en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Kontrasignera en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ge en dos med delegering inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en delegering inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Checka in en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skicka en gruppkallelse inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka om en tid inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Patienten bokar om sin tid i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp ett återbesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Sätta in Waran igen efter ett uppehåll inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Avsluta behandlingen efter ett uppehåll inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Avvisa en remiss och sätta ut läkemedlet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett intagningsbeslut inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Söka i journalen och öppna träffen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en NEWS2-kontroll inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ordinera från en mall med flera ordinationer inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en dos i efterhand inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Utse en medicinskt ansvarig läkare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en ändrad läkemedelsmall inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka elkonvertering med rum och utrustning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka provtagning före läkarbesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Granska och skicka månadens rapport till patientregistret inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Visa de tio högst viktade kriterierna som inte är uppfyllda inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Exportera faktureringsunderlag för en månad inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lämna ut ett hjälpmedel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Förbereda ett namnbyte för en enhet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ändra dosen i en pågående ordination inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Läsa nyheterna och stänga dem inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka en patient fritt inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka ett teambesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lägga till en patient i en gruppträff inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Överblicka dagens händelser på avdelningen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Fortsätta arbeta när inloggningen snart går ut inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Fylla i tobaksmallen i en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva och signera en epikris inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd, vikt, blodtryck och puls inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva en remiss på uppdrag av en läkare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Fördela en remiss till en läkare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en pappersremiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Beställa ett standardpaket med prover inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera provtagning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Koppla en patientmonitor till patienten inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna värden från monitorn inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Öppna intensivvårdens översikt och övervakningen av en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lämna en egen mätning i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Förskriva förbrukningsartiklar ur en mall inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Öppna patienten genom att skanna armbandet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Visa en färdig patientgrupp inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva ut en enskild anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en överkänslighet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Söka bland vårdenhetens patienter på en diagnos inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skicka en konsultation inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skicka läkemedelsberättelsen till nästa vårdgivare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Ge en vaccination i programmet för riskgrupper inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Hämta uppgifter från en annan vårdgivare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en ankomst på akutmottagningen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Diktera och signera en daganteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Rätta en felstavad medicinsk term i en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Bygga ett formulär och föreslå det inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en perifer venkateter inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skanna in en restjournal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Pröva donation efter ett dödsfall på intensivvården inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Förnya ett recept som patienten har bett om i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lägga in sin tidbok i kalenderprogrammet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Svara på ett meddelande från en patient och avsluta inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Se vårdenhetens kapacitet och prognos för väntelistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Göra dagsavslut i kassan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva ett meddelande till vården i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Planera en operation från väntelistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera att patienten kommer in på salen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka en tid för patienten som ombud inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett besök i graviditetsjournalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Bedöma CTG under en förlossning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Jämföra bilder av ett kroppsställe över tid inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Hämta en bild från en apparat och föra in den i journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Visa en röntgenstudie ur arkivet med ett annat fönster inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Beställa en röntgenundersökning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka en inkommen undersökning på röntgenkliniken inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera vårdtyngden enligt NEMS för en patient på intensivvården inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Läsa in ett barns tillväxtdata från ett annat journalsystem inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en cytostatikakur inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en ny version av en cytostatikaregim inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Beställa blod inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Bereda en cytostatikados på beredningsenheten inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Rapportera dagens tabletter i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lämna en synpunkt inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Välja yrkesroll och starta första uppdraget inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Läsa en äldre anteckning ur mellanarkivet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > För över äldre journalhandlingar till mellanarkivet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Göra en dator till vårdenhetens reservdator för läkemedel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Användartest > räkningen: klick på knappar och länkar, inte i fält som gränssnittet har satt fokus i | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartest > SUS-poängen räknas med standardformeln | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartest > uppgifterna följer flödena i klickbudgeten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartest > sammanställningen ger median, spridning, andel slutförda och SUS per flöde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Användartest > testläget räknar klick, fältbyten och tangenter som klickbudgetskriptet för samma flöden | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Användartest > enkäten ger SUS-poäng enligt standardformeln | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Användartest > resultatfilen laddas ner med datum, version, deltagarkod, uppgifter och SUS-poäng | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Användartest > inget anrop skickar testresultat till servern | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Användartest > testläget rensas när testet avslutas | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### D7 Små releaser med automatiserad regressionstest och återgång

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > varje migrering har en återställning, och upp och sedan ned ger samma schema som före | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > en sparad sandlåda som läses in får sitt schema kontrollerat, och versionen i drift gäller efter en återgång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > uppgraderingen visar nyheterna, API:ts ändringslogg och migreringarna för versionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > en uppgradering vars tester inte är gröna stoppas och kan inte godkännas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > bara systemförvaltningen ser och gör uppgraderingar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > API: återgång och godkännande av två systemförvaltare i var sin inloggning, och servern visar schemaversionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D8 Behörighetsmodell som tvingar minsta åtkomst, testad mot roller

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: logggranskare får läsa loggen men inte journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nekad: utan grund nekas åtkomst utan erbjudande om val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nekad åtkomst ger 403 kraver_val och loggas som nekad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D9 Öppna format: FHIR R4, ICD-10-SE och ATC

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > metadata är ett CapabilityStatement | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > sökning ger Bundle searchset | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > Patient har personnummer med rätt identifier-system | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > Condition använder ICD-10-SE | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > MedicationRequest använder ATC och har uppföljningsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje läkemedel i katalogen har en ATC-kod ur WHO:s register | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varningsreglernas ATC-prefix stämmer med WHO:s register | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > inga tomma listor, tomma strängar eller tomma värden, och varje kodning har system och kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > vitalparametrar följer FHIR R4:s vitalparameterprofiler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > labbvärden har NPU-kod och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > meta.profile bara för profiler som validerats | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > Patient, Organization och Practitioner följer HL7 Swedens basprofiler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > varje tillägg och eget kodsystem har en publicerad definition | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > Condition och MedicationRequest har display ur kodverket | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > MedicationRequest har NPL-id med E-hälsomyndighetens system | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR för invånaren: id i fel journal ger alltid 404, och identifier eller fritext i adressen loggas aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering via API > FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-validering > HL7:s validator ger inga fel för någon resurstyp, också MedicationAdministration och List, i den FHIR-kod som byggs | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Validering med HL7:s validator | 2026-11-12 kl. 12:25 svensk tid |

### D10 Beslutsstöd i separata moduler, journalkärnan utanför MDR

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varningarna är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| MDR-bedömning > varje beslutsstödsmodul har en bedömning enligt MDCG 2019-11 med alla steg, och slutsatsen och klassen följer av stegen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| MDR-bedömning > modulerna som varningsreglerna och skalorna ligger i är bedömda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### D11 Styrd lokal anpassning av mallar inom fastställda ramar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Godkännande av läkemedelsmallar > mallansvarig läkare godkänner en ändrad mall från inkorgen: den gamla används tills den nya är godkänd, och historiken sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Godkännande av läkemedelsmallar > säkerhet: bara den mallansvariga läkaren på vårdenheten godkänner, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Godkännande av läkemedelsmallar > en ändrad läkemedelsmall per substans kräver nytt godkännande per vårdenhet, och förslaget använder den godkända versionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en ändrad läkemedelsmall inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Ansvarsuppdrag för läkemedel > verksamhetschefen ser vårdenhetens uppdrag, och systemet påminner om det som saknas och föreslår vem som ska få uppdraget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > verksamhetschefen utser en medicinskt ansvarig läkare med ett år förifyllt, och det loggas och syns i säkerhetsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > säkerhet: bara vårdenhetens verksamhetschef utser och avslutar uppdrag, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > verksamhetschefens eget ansvar går inte att lämna över, och systemet förklarar varför en person inte kan få uppdraget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > samma sjuksköterska beställer inte och kontrollerar narkotika, och reserven är en annan än den ordinarie | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > ett nytt uppdrag som medicinskt ansvarig läkare avslutar det förra, och ett uppdrag ändras och raderas aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > påminnelsen kommer när ett uppdrag går ut inom 30 dagar, uppdraget upphör när personen slutar och genomgången av ansvarsdokumentet sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > säkerhet: verksamhetschefen läser inte journalen och har ingen arbetslista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Utse en medicinskt ansvarig läkare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Journalens struktur > ram: vårdgivarens ram anger sökord som måste finnas och sökord som får läggas till lokalt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > lokal: en vårdenhets anpassning inom ramen gäller bara på vårdenheten, och en anpassning utanför ramen stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > ram: en ny ram visar vilka lokala anpassningar som slutar gälla, och de slutar gälla när den godkänns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsmallar i gränssnittet > en läkare bygger en ny läkemedelsmall med systemets förslag, och den används först när den mallansvariga läkaren har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsmallar i gränssnittet > API: en läkare ändrar en läkemedelsmall i gränssnittet och ser vem som ska godkänna den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mall: en ny mall med ett nytt sökord godkänns av en annan systemförvaltare och används direkt i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mall: en ny version visar vad som påverkas, och skrivna anteckningar ändras inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > fyra ögon: en beslutad version ändras eller raderas inte, ett godkännande prövas igen och allt loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L1 En journal per patient, signatur och tidpunkt, ingen ändring eller utplåning

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte raderas (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning flyttas till en annan patient bara under en sammanslagning av just de journalerna (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > helflöde: anteckning skapas, signeras och rättas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontrasignering > den som har signerat kan inte kontrasignera själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L2 Behörighet efter behovs- och riskanalys, minsta nödvändiga åtkomst

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsanalys > varje roll i behörighetsmotorn har en behovs- och riskanalys, och analysen säger samma sak som koden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L3 Spärr, aktivt val, synlig spärrmarkering och nödåtkomst

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: spärrmarkering syns men innehållet döljs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: samtycke i stunden visar spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nödåtkomst: häver aldrig en spärr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > spärrmarkering och samtycke via API | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nödåtkomst via API flaggas i logguppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > spärrade uppgifter visas för patienten själv och spärren redovisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > begäran om spärr ändrar inte spärren och registreras som begäran till vården | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > en bekräftad uppgift ur spärrade uppgifter följer källans spärr, och utsättningen röjs inte i förslagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > hälsoärendet visar bara de vårdkontakter som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L4 Loggning av varje åtkomst, logguppföljning och logginformation till patienten

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > verifiera upptäcker ändrad rad när triggern släppts i en kopia | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > logggranskaren ser logg med hel kedja, andra roller nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > FHIR-anrop loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patientens egen läsning loggas som egen åtkomst och flaggas inte i logguppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > bara uppföljningsrollen når datauttaget, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Export av loggen > åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Stickprovskontroll > systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Stickprovskontroll > en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L5 Flerfaktorsautentisering vid direktåtkomst och patientens e-åtkomst

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patienten når sin egen journal men inte någon annans, oavsett id i adressen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patientsessionen når inga av personalens API:er | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > personalens session når inte Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > utloggning och byte av roll i samma webbläsare nollställer sessionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > en äldre version av en anteckning som har ersatts av en version som inte visas går inte att nå, varken i Min journal eller i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > invånare: egen journal från 16 år, vårdnadshavare till 13 år och aldrig för ett barn med skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > utan registrerad faktor loggar demorollen in som förut, och flerfaktor är av | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > en passkey registreras med WebAuthn, och bara den publika nyckeln sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > med en passkey väntar inloggningen på den andra faktorn och ger varken behörighet eller läskopia förrän den är godkänd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > en signatur från fel nyckel, fel ursprung, en gammal utmaning eller utan användarverifiering godtas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > en app för engångskoder enligt RFC 6238 registreras med en kod, nyckeln sparas krypterad och varje kod godtas en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > invånaren i Min journal kan slå på flerfaktor och loggar sedan in med engångskod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > för många felaktiga koder avbryter inloggningen, och återställd sandlåda tar bort faktorn så att ingen låses ute | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > TOTP stämmer med testvektorerna i RFC 6238 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor > säkerhetsloggen visar registrering, väntande inloggning, misslyckad och lyckad andra faktor | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Avbrott > flerfaktor: en passkey i Chromes virtuella autentiserare slår på flerfaktor, bekräftar nästa inloggning, och läsläget vid avbrott fungerar efter den andra faktorn | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > flerfaktor: invånaren slår på en app för engångskoder i Min journal och loggar sedan in med en kod från appen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Flerfaktor som krav > parametern Flerfaktor krävs vid inloggning är en demoregel som står på nej och ändras med fyra ögon | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > med kravet på ja leds den som saknar faktor till att registrera en, och får ingen behörighet eller läskopia förrän den är bekräftad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > med kravet på ja ger en felaktig kod vid registreringen ingen inloggning, och för många försök avbryter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > den som redan är inloggad loggas inte ut när kravet slås på, utan får frågan vid nästa inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > med kravet på ja leds invånaren i Min journal till att registrera en faktor innan journalen visas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > med kravet på ja går den sista faktorn inte att ta bort, och säkerhetsloggen visar inloggningen med den nya faktorn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > en väntande registrering slutför inte inloggningen när kontot har fått en faktor under tiden, och tar aldrig bort faktorer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Flerfaktor som krav > en väntande registrering kan aldrig ta bort en faktor | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L6 Skyddade personuppgifter hanteras i hela kedjan, även uppropning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > arbetslista maskerar skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > väntrummet visar aldrig namn för skyddad patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > visa identitet kräver syfte och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > skyddad patient maskeras i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L7 NLL: ordinationsorsak och uppföljningsdatum, kvittens för varje överföring

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > uppföljningsdatum är obligatoriskt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > databasen vägrar ordination utan orsak (CHECK) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: normal överföring kvitteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > alla ordinationer har orsak och uppföljningsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > ordinationerna i seeden har dos och administrationsväg som passar produktens styrka och form | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > MedicationRequest har NPL-id med E-hälsomyndighetens system | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förpackning med NPL-pack-id > katalogens förpackningar finns i NPL under samma produkt och är inte avregistrerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förpackning med NPL-pack-id > systemet väljer förpackningen när förskrivaren inte väljer, och överföringen till NLL har NPL-pack-id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Muntlig ordination > sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L9 HSA, SITHS, Säker digital kommunikation, patientregistret och kvalitetsregister

Alla testfall godkända. Status i registret: planerat.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L10 EHDS: CE-märkning, interoperabilitets- och loggningskomponent

Alla testfall godkända. Status i registret: planerat.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR-struktur > inga tomma listor, tomma strängar eller tomma värden, och varje kodning har system och kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > Patient, Organization och Practitioner följer HL7 Swedens basprofiler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### L13 GDPR, arkivlagen, säkerhetsskyddslagen och tillgänglighetslagen

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > spärrade uppgifter och skyddad identitet följer samma regler i läskopian | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Tillgänglighet > varje formulärfält, knapp och länk har ett namn som beskriver syftet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### M2 Krav utvärderade på papper: krav som testfall och spårbar bedömning

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### M4 Tappade meddelanden mellan vårdnivåer: kvittens, larm och test av felvägar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### M5 Migrerad historik blev osynlig: avstämd migrering och kronologisk vy

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > migreringsavstämningen visar avvikelsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### M6 För bred åtkomst och svaga spärrar: behörighet som testat krav

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nödåtkomst: häver aldrig en spärr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patientsessionen når inga av personalens API:er | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > svaren innehåller inga id, interna anteckningar eller uppgifter om andra patienter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### M8 Uppgraderingar skapar nya fel: små releaser och automatiserade tester

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > varje migrering har en återställning, och upp och sedan ned ger samma schema som före | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > en sparad sandlåda som läses in får sitt schema kontrollerat, och versionen i drift gäller efter en återgång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > uppgraderingen visar nyheterna, API:ts ändringslogg och migreringarna för versionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > en uppgradering vars tester inte är gröna stoppas och kan inte godkännas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > bara systemförvaltningen ser och gör uppgraderingar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > API: återgång och godkännande av två systemförvaltare i var sin inloggning, och servern visar schemaversionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### M9 Fler klick och långsamhet: klickbudget och svarstidsmål

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > drift visar p50 och p95 per adress i API:t | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### M12 Inlåsning: regionägd kod och data i öppna format

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > sökning ger Bundle searchset | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > återföringen av all data tar med varje tabell med vårdgivarens uppgifter och de gemensamma tabellerna som NDJSON och databasens schema, också tabeller som inte hör till journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > paketet har XML-schemana i mappen schemas och bara registrerade medietyper i METS.xml, som E-ARK:s validator kräver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > varje tabell är klassad för återföringen, och inga nycklar eller hemligheter följer med i paketet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > rader med hemligheter i tabeller med nyckel och värde följer inte med, och bara kända inställningar följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

## Sussas kravspecifikation

### 2.1.1.1 Systemuppbyggnad

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > hälsa och Server-Timing på alla svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > drift visar p50 och p95 per adress i API:t | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemuppbyggnad > förteckningen har varje modul i src och public med skikt, tillverkare, beskrivning och kraven den stödjer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemuppbyggnad > de fem perspektiven i kravtexten finns och pekar på moduler som finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemuppbyggnad > lastmätning: 20 samtidiga användare med var sin sandlåda läser journalen med p95 under 500 ms | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemuppbyggnad > totalkostnaden räknas ur mätningen och antagandena, och antagandena står i svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.2.1.7 Stöd för Journalen

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tjänstekontrakt > tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.2.1.8 Producent till NPÖ

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tjänstekontrakt > GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > producenten nekar fel roll och visar inte spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > okänt kontrakt, patient eller logisk adress ger ett fel på svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.3.1.1 Stöd för mobilt arbetssätt

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Mobil > varje roll har sin startsida och menyn i 360 px utan sidledsrullning och med knappar på minst 40 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Ge en dos går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Ge en dos med delegering går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera en dos i efterhand går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera blodtryck går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera en NEWS2-kontroll går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera längd, vikt, blodtryck och puls går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera provtagning går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > vid sängen identifierar armbandet patienten i Läkemedel att ge, och bara patientens doser visas | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Mobilt arbetssätt > varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 2.3.1.2 Mobilt arbetssätt

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Mobilt arbetssätt > varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Mobil > varje roll har sin startsida och menyn i 360 px utan sidledsrullning och med knappar på minst 40 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Ge en dos går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Ge en dos med delegering går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Öppna patient från arbetslistan går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Läsa senaste anteckning går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Patienten bokar om sin tid i Min journal går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > patienten läser sin journal, sina tider och vem som läst journalen i Min journal i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > förbindelsen bryts och kommer tillbaka från en annan adress utan att inloggningen tappas | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 2.3.1.3 Mobila tillämpningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Mobilt arbetssätt > varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mobilt arbetssätt > uppställningen per funktionellt krav i kapitel 3 och 4 räknas ur registret och anger bara flöden som prövas i 360 px | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mobila tillämpningar > varje funktionellt krav i kapitel 3 och 4 finns i uppställningen, med mobila flöden, skrivbordets flöden, vyer i 360 px eller som inte byggt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Mobil > varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Ge en dos går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Ge en dos med delegering går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera en dos i efterhand går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera blodtryck går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera en NEWS2-kontroll går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera längd, vikt, blodtryck och puls går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Registrera provtagning går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Öppna patient från arbetslistan går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Läsa senaste anteckning går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Överblicka dagens händelser på avdelningen går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Kvittera remissvar går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Söka i journalen och öppna träffen går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > Patienten bokar om sin tid i Min journal går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 2.3.1.4 Tillgänglighet och robusthet

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Avbrott > appen startar utan nät från service workern och visar läsläget | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > simulerat avbrott ger läsläge medan servern svarar andra besökare | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > skrivande är avstängt i läsläget med en förklaring | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > åtkomster i läsläget når åtkomstloggen när servern svarar igen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Läskopia > åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Mobil > förbindelsen bryts och kommer tillbaka från en annan adress utan att inloggningen tappas | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Skrivkön efter avbrott > ett mätvärde och en dos från kön sparas med tiden då de gjordes, och en rad som skickas igen sparas inte två gånger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skrivkön efter avbrott > en dos som någon annan gav under avbrottet blir en konflikt som personen avgör, och ingen dos sparas två gånger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skrivkön efter avbrott > kön tas bara emot från den som gjorde registreringarna, med en rad som är krypterad med läskopians nyckel och inom läskopians giltighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skrivkön efter avbrott > läskopian har mätvärdena och remisserna för patienterna, för de roller som får läsa dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Avbrott > en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > en dos som någon annan gav under avbrottet blir en konflikt som sjuksköterskan avgör, och dosen sparas inte två gånger | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Mobil > i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 2.5.1.1 Öppet integrationsgränssnitt under hela avtalstiden

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > metadata är ett CapabilityStatement | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > sökning ger Bundle searchset | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > FHIR via HTTP har application/fhir+json och kräver inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-skrivning > Observation: blodtryck registreras med samma funktion som gränssnittet och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-skrivning > MedicationRequest: samma varningar som läkemedelslistan, och en allvarlig varning kvitteras med motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > Condition: läkaren registrerar en diagnos på vårdkontakten med samma funktion som gränssnittet, och den loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > Condition: fel roll, en vårdkontakt på en annan patient, en annan vårdenhet, en okänd kod och ett annat kodverk nekas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > CapabilityStatement har versionen och listar varje resurstyp och operation som servern har, och inget annat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Öppet API > ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Fler skrivningar via API:t > Överkänslighet: läkarens registrering blir uppmärksamhetsinformation med bekräftad grad och ATC-kod och varnar för läkemedel i listan som omfattas, bara bland ordinationer som läkaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler skrivningar via API:t > AllergyIntolerance: överkänsligheten registreras via API:t med samma funktion som gränssnittet, och fel roll och dubblett nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler skrivningar via API:t > Patient: en ny patient registreras via API:t med samma tolkning av numret och dubblettkontroll som gränssnittet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler skrivningar via API:t > Patient/$everything för personalen: varje resurstyp prövas och loggas för sig, och bara det personen får se kommer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Uppmärksamhet > läkaren registrerar en överkänslighet med ämnet och reaktionen, och den syns i patienthuvudet med graden | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Systemkonton > SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > prenumeration på en population: varje ny diagnos på vårdenheten meddelas med bara id, och bara det som systemkontot får läsa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skrivning för systemkonton > ett systemkonto kan inte registrera överkänslighet eller annat som kontot inte får skriva, och inget sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.5.1.2 Funktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > sökning ger Bundle searchset | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > FHIR följer samma behörighet: nekad utan vårdrelation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > FHIR följer inre sekretess och spärr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > FHIR-anrop loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-skrivning > Composition: final skapar och signerar, preliminary sparar ett utkast med samma mall som gränssnittet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-skrivning > MedicationRequest: utsättning med status stopped, och antikoagulantia sätts bara ut med en plan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-skrivning > nekad: fel roll, ingen vårdrelation och Min journal nekas och nekandet loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-skrivning > inget går att göra via API:t som gränssnittet inte tillåter: ändrad överkänslighet, borttagning och ändrade mätvärden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Prenumerationer > Subscription skapas med samma behörighet som läsningen och bara till adresser som administratören har godkänt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Prenumerationer > meddelandet innehåller bara id, och mottagaren hämtar resursen med sin egen behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Prenumerationer > inget meddelande om det som prenumeranten inte får läsa: spärrad vårdenhet, annan vårdenhet och osignerade utkast | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > Condition: läkaren registrerar en diagnos på vårdkontakten med samma funktion som gränssnittet, och den loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler flöden via API:t > Appointment: en remiss på väntelistan bokas via API:t med systemets förslag, med samma kontroller och loggning som i gränssnittet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler flöden via API:t > Encounter: inskrivning via API:t med samma förslag på avdelning och orsak som knappen Skriv in | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillämpningar och mottagare > systemförvaltaren godkänner en mottagare, en prenumeration till den kan skapas, och när mottagaren återkallas avslutas prenumerationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillämpningar och mottagare > bara systemförvaltaren registrerar, och adresser, omfång och namn prövas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > systemförvaltaren registrerar ett systemkonto, systemet räknar fram omfånget ur informationsmängderna och en privat nyckel sparas aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > systemkontot läser bara sina vårdenheters poster ur sina informationsmängder, aldrig skyddad identitet eller spärrade uppgifter, och varje läsning loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > prenumeration på en population: varje ny diagnos på vårdenheten meddelas med bara id, och bara det som systemkontot får läsa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > ett återkallat systemkonto får ingen biljett, dess biljetter slutar gälla och dess prenumerationer avslutas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Öppet API > systemförvaltaren registrerar ett systemkonto för vårddatalagret, ser vad det får och kan återkalla det | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Fler skrivningar via API:t > AllergyIntolerance: överkänsligheten registreras via API:t med samma funktion som gränssnittet, och fel roll och dubblett nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler skrivningar via API:t > Patient: en ny patient registreras via API:t med samma tolkning av numret och dubblettkontroll som gränssnittet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Makulering via API:t > DELETE och $makulera makulerar en dos med samma regler som gränssnittet: orsak krävs, historiken står kvar och makuleringen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Makulering via API:t > makuleringen prövas som i gränssnittet: fel roll och en annan vårdenhet nekas, och en dos som inte finns ger 404 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Makulering via API:t > en provbeställning makuleras via API:t, och en resurs som inte går att makulera ger 405 med vad man gör i stället | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Makulering via API:t > ett systemkonto får bara makulera det som kontot självt har skrivit | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet för systemkonton > förvalet är pseudonym: kontot ser aldrig patientens namn eller personnummer i resurser, sökningar eller prenumerationer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet för systemkonton > namn och personnummer kräver att systemförvaltaren väljer det med en motivering, och då får kontot dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.5.1.3 Omfattning av information

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > MedicationRequest använder ATC och har uppföljningsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > Patient, Organization och Practitioner följer HL7 Swedens basprofiler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API-täckning > varje flöde i klickbudgeten är bedömt för API:t, och bedömningen gäller flöden som finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API-täckning > varje flöde som står som ja görs via det öppna API:t | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API-täckning > API: täckningen kan läsas utan inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > tabellen har alla tjänstekontrakt i K10 med roll, motsvarighet och status | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > GetDiagnosis svarar med patientens diagnoser i kontraktets struktur och loggas som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > GetCareDocumentation, GetAlertInformation och GetCareContacts svarar med samma behörighet som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > producenten nekar fel roll och visar inte spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tjänstekontrakt > okänt kontrakt, patient eller logisk adress ger ett fel på svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler flöden via API:t > Appointment: en remiss på väntelistan bokas via API:t med systemets förslag, med samma kontroller och loggning som i gränssnittet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler flöden via API:t > Appointment: fel roll, en annan patient och en tid som inte passar remissen nekas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fler flöden via API:t > Encounter: inskrivning via API:t med samma förslag på avdelning och orsak som knappen Skriv in | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ärenden om API:t > en begäran om ny information går från inkommen till levererad, och levererad kräver en version i ändringsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ärenden om API:t > systemet svarar direkt när det begärda redan finns, och ett ärende med ett personnummer avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.6.1.2 Innovationsramverk

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > standalone launch: personen väljer patienten bland sina patienter på arbetslistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Tillämpningar och mottagare > systemförvaltaren registrerar en tillämpning, systemet föreslår behörighet och text ur omfånget, och den startas från journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillämpningar och mottagare > en återkallad tillämpning kan inte startas, och dess åtkomstbiljetter återkallas direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillämpningar och mottagare > bara systemförvaltaren registrerar, och adresser, omfång och namn prövas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ärenden om API:t > en begäran om ny information går från inkommen till levererad, och levererad kräver en version i ändringsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ärenden om API:t > systemet svarar direkt när det begärda redan finns, och ett ärende med ett personnummer avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Öppet API hålls aktuellt > ändringsloggen: den senaste versionen är CapabilityStatements, och varje resurstyp och skrivning har en rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Öppet API > systemförvaltaren registrerar en tillämpning, ser vad den får och kan återkalla den | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Öppet API > ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Innovationsramverket > en tillämpning registreras med källkoden, licensen och versionen, och öppen källkod kräver adressen till källkoden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemkonton > SMART Backend Services: tillämpningen får en åtkomstbiljett med ett signerat klientintyg, och fel intyg nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Öppet API > systemförvaltaren registrerar ett systemkonto för vårddatalagret, ser vad det får och kan återkalla det | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.7.1.2 Uppfylla relevanta lagar och föreskrifter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > helflöde: anteckning skapas, signeras och rättas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte raderas (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Stickprovskontroll > systemet drar slumpvis åtkomster, granskaren markerar dem med ett klick, och det syns vilka som återstår | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: samtycke i stunden visar spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > nödåtkomst och samtycke till spärrade uppgifter syns i patientens logglista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > personalens session når inte Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: logggranskare får läsa loggen men inte journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Stickprovskontroll > en granskad rad ändras inte, utreds kräver en kommentar, och varje granskning loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nödåtkomst via API flaggas i logguppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > rättelse kräver orsak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nödåtkomst: häver aldrig en spärr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patienten når sin egen journal men inte någon annans, oavsett id i adressen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patientsessionen når inga av personalens API:er | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > väntrummet visar aldrig namn för skyddad patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > visa identitet kräver syfte och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > skyddad patient maskeras i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > spärrade uppgifter och skyddad identitet följer samma regler i läskopian | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR med patientens session: egna resurser och $everything, inget annat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > ordinationsorsak är obligatorisk | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: normal överföring kvitteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Tillgänglighet > varje formulärfält, knapp och länk har ett namn som beskriver syftet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varningarna är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagkravsmatris > varje relevant lag finns, och varje rad har tester eller en avgränsning med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagkravsmatris > matrisens tester räknas in i 2.7.1.2, och statusen per rad följer testerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagkravsmatris > API: krav/sussa ger matrisen under 2.7.1.2 med status per rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 2.7.1.3 Användargränssnitt på svenska

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Språk > gränssnittets texter är svenska, utan engelska ord, tankstreck, ellipser och interna anteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Språk > serverns felmeddelanden och varningar är svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Språk > inga tankstreck, ellipser eller interna anteckningar någonstans i public/ och src/, inte heller i kommentarer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Språk > kontrollen hittar engelska ord, okända förkortningar, tankstreck, ellipser och interna anteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Språk > kontrollen hittar å, ä och ö som saknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.1.1 Stöd för fyra typer av identitetsnummer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > typbestämning: personnummer, samordningsnummer, reservnummer och OID känns igen i alla vanliga skrivsätt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > tio siffror och plustecken ger rätt sekel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > kontrollsiffror: fel kontrollsiffra, datum och längd förklaras på svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > demon tar bara Skatteverkets testpersonnummer och testsamordningsnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > reservnummer skapas av systemet med påhittat format, OID-rot för dokumentation och rätt könssiffra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > seed: samordningsnummer, reservnummer, OID och en dubblett | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: sök hittar patienten på varje identitetstyp, i valfritt format, och på en tidigare identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: registrera patient utan känd identitet ger reservnummer och vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > behörighet: registrering och ny identitet kräver rätt yrkesroll och vårdrelation, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > Patient har personnummer med rätt identifier-system | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > personnummer kommer från Skatteverkets testpersonnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera patient utan känd identitet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.1.2 Koppla samman tidigare identiteter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > systemet hittar dubbletten på namn och födelsedatum, men aldrig för skyddad identitet eller två personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: nytt personnummer ersätter reservnumret, och det gamla finns kvar som tidigare identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: ett nummer som tillhör en annan journal blir ett förslag om sammanslagning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: sammanslagning flyttar journalen, och sök, logglista och huvud leder till den gällande journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > behörighet: bara vårdadministratören slår samman, och bara journaler som systemet har föreslagit | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Slå samman en dubblett inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.1.3 Identifikation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > typbestämning: personnummer, samordningsnummer, reservnummer och OID känns igen i alla vanliga skrivsätt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > tio siffror och plustecken ger rätt sekel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > kontrollsiffror: fel kontrollsiffra, datum och längd förklaras på svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > demon tar bara Skatteverkets testpersonnummer och testsamordningsnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > reservnummer skapas av systemet med påhittat format, OID-rot för dokumentation och rätt könssiffra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > seed: samordningsnummer, reservnummer, OID och en dubblett | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: sök hittar patienten på varje identitetstyp, i valfritt format, och på en tidigare identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: registrera patient utan känd identitet ger reservnummer och vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > behörighet: registrering och ny identitet kräver rätt yrkesroll och vårdrelation, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > Patient har personnummer med rätt identifier-system | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > personnummer kommer från Skatteverkets testpersonnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera patient utan känd identitet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Identitet > API: sök förklarar ett felskrivet nummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.1.4 Koppla samman identiteter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Identitet > systemet hittar dubbletten på namn och födelsedatum, men aldrig för skyddad identitet eller två personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: nytt personnummer ersätter reservnumret, och det gamla finns kvar som tidigare identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: ett nummer som tillhör en annan journal blir ett förslag om sammanslagning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > API: sammanslagning flyttar journalen, och sök, logglista och huvud leder till den gällande journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > behörighet: bara vårdadministratören slår samman, och bara journaler som systemet har föreslagit | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Slå samman en dubblett inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.2.1 Standardiserade och anpassningsbara vyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.2.2 Presentationsvyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljningsvyn > uppföljningsvyn samlar vårdplanernas mål och avvikelser, passerade uppföljningsdatum och remisser med när, var och vem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljningsvyn > uppföljningsvyn visar var i vårdprocessen patienten är och den samordnade planeringen med kommunen, och översikten sammanfattar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljningsvyn > uppföljningsvyn följer behörigheten: spärrad vårdenhet, annan vårdenhet utan aktivt val och fel roll | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.2.3 Anpassningsbar presentationsvy

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Planering > anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anpassningsbara vyer > anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.2.4 Vyer utan personuppgifter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > väntrummet visar aldrig namn för skyddad patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > väntetidsstatistik per vårdenhet utan personuppgifter, med vårdgarantin som demoregel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > ledtider och avvikelser per vårdenhet och för regionen, utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer utan personuppgifter > beläggningsöversikten visar platser, belagda och lediga per avdelning utan namn, personnummer eller sal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer utan personuppgifter > utbildningsläget visar journalen pseudonymiserad och säger vilka uppgifter som aldrig visas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer utan personuppgifter > utbildningsläget följer behörigheten och visar aldrig en patient med skyddade personuppgifter eller spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.3.1 Formulärstöd för text och bilder

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mallar finns för alla anteckningstyper | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > utkast kan ändras av författaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > sjuksköterska kan skriva omvårdnadsanteckning men inte läkaranteckning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > systemet sätter själv att patienten använder tobak, och föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > systemet förklarar på vanlig svenska när svaren inte går ihop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > anteckningen får text som systemet skriver ur svaren, och svaren sparas strukturerat bredvid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > API: rollerna som skriver omvårdnadsanteckningar dokumenterar tobaksvanor, och översikten visar den senaste | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > en anteckning om tobaksvanor på en spärrad vårdenhet varken visas eller ändrar svaret i översikten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Fylla i tobaksmallen i en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Formulär > fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > frågor visas och krävs efter regler, och reglerna ger varningar på vanlig svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > ett formulär byggs som en ny version och används först när en annan systemförvaltare har godkänt det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > svaren i en signerad anteckning ändras aldrig, och en rättelse blir en ny version med egna svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > API: systemförvaltaren bygger, förhandsvisar och föreslår formulär, och den som dokumenterar får aktiva formulär bland mallarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Bygga ett formulär och föreslå det inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.3.2 Röstinmatning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Röstinmatning > röstkommandon: skiljetecken, ny rad och byte av sökord tolkas, och systemet sätter stor bokstav i början av meningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Röstinmatning > signering och andra beslut görs aldrig med rösten: kommandot signera ger en förklaring och inget händer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Röstinmatning > dikterad text märks i anteckningen och blir journal för andra först när den är signerad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Röstinmatning > igenkänning på enheten används när den finns, och annars krävs att användaren har valt webbläsarens tjänst, ett val som sparas per användare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Tillgänglighet > röstinmatningen frågar i en dialog innan ljudet går till webbläsarens tjänst när igenkänning på enheten saknas, valet sparas per användare, och med igenkänning på enheten kommer ingen fråga | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Klickbudget > Diktera och signera en daganteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Mobil > Diktera och signera en daganteckning går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 3.1.3.3 Registrera in- och utfarter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| In- och utfarter > typen avgör storlek, KVÅ-kod och nästa skötsel, och registreringen knyts till den pågående vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > skötseln står i avdelningens planering, och en försenad skötsel markeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > en infart följs över tid: skötsel, byte och avveckling med KVÅ, och raderna ändras aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > systemet stoppar en andra urinkateter och förklarar fel storlek på vanlig svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > vid sängen kontrolleras armbandet mot patienten och förpackningens utgångsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > behörighet: undersköterskan läser men registrerar inte, och en annan vårdenhet ändrar inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > spärr och inre sekretess: en spärrad vårdenhets infart syns inte och röjs inte, varken i listan, tidslinjen eller planeringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > FHIR: insättning, skötsel och avveckling är Procedure med KVÅ och samma behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > tidslinjen i översikten har insättning och avveckling | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en perifer venkateter inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.3.4 Manuell registrering av mätvärden

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mätvärden valideras och registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera blodtryck inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Epikris och mätvärden > längd, vikt, blodtryck och puls registreras på en gång med samma tid och vårdkontakt, och systemet räknar BMI | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd, vikt, blodtryck och puls inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 3.1.3.5 Stöd vid dokumentation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mallar finns för alla anteckningstyper | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > mätvärden valideras och registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > NEWS2: varje parameter ger poäng enligt Chart 1 i RCP 2017 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > GCS: systemet räknar summan och skriver texten, och fel delvärden avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > NRS och ACVPU: systemet skriver texten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden och NEWS2 > medvetandegrad, GCS, smärta och syrgas registreras, valideras och får text av systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > systemet sätter själv att patienten använder tobak, och föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > systemet förklarar på vanlig svenska när svaren inte går ihop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > anteckningen får text som systemet skriver ur svaren, och svaren sparas strukturerat bredvid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > API: rollerna som skriver omvårdnadsanteckningar dokumenterar tobaksvanor, och översikten visar den senaste | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > en anteckning om tobaksvanor på en spärrad vårdenhet varken visas eller ändrar svaret i översikten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Fylla i tobaksmallen i en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Epikris och mätvärden > epikrisen får Orsak till vård ur vårdtillfället och diagnoserna, och läkaren skriver bara förloppet och uppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Epikris och mätvärden > epikrisens förslag bygger bara på det läkaren får se: en spärrad eller annan vårdenhets diagnos ändrar inte förslaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva och signera en epikris inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Formulär > fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.3.6 Textfri informationsinmatning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Skanning > systemet känner själv igen armband, personnummer, provetikett, iordningställd dos och läkemedelsförpackning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > armbandet öppnar patienten, och i en öppen journal kontrollerar systemet att armbandet hör till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > provetiketten bockar av röret vid provtagningen, och en etikett för en annan patient stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > läkemedelsförpackningen kontrolleras mot patientens ordinationer, utgångsdatum och batch | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > skanningen ger aldrig mer än behörigheten: utan vårdrelation och utan rätt roll nekas den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > armbandskoden är slumpmässig, och utan åtkomst till patienten är svaret detsamma som för en kod som inte finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > misslyckade uppslag har ett tak per session | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skanning > seeden har armband för de inskrivna patienterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.3.7 Röstinmatning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Röstinmatning > röstkommandon: skiljetecken, ny rad och byte av sökord tolkas, och systemet sätter stor bokstav i början av meningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Röstinmatning > signering och andra beslut görs aldrig med rösten: kommandot signera ger en förklaring och inget händer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Röstinmatning > dikterad text märks i anteckningen och blir journal för andra först när den är signerad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Röstinmatning > igenkänning på enheten används när den finns, och annars krävs att användaren har valt webbläsarens tjänst, ett val som sparas per användare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Tillgänglighet > röstinmatningen frågar i en dialog innan ljudet går till webbläsarens tjänst när igenkänning på enheten saknas, valet sparas per användare, och med igenkänning på enheten kommer ingen fråga | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Klickbudget > Diktera och signera en daganteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Mobil > Diktera och signera en daganteckning går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 3.1.3.8 In- och utfarter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| In- och utfarter > typen avgör storlek, KVÅ-kod och nästa skötsel, och registreringen knyts till den pågående vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > skötseln står i avdelningens planering, och en försenad skötsel markeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > en infart följs över tid: skötsel, byte och avveckling med KVÅ, och raderna ändras aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > systemet stoppar en andra urinkateter och förklarar fel storlek på vanlig svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > vid sängen kontrolleras armbandet mot patienten och förpackningens utgångsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > behörighet: undersköterskan läser men registrerar inte, och en annan vårdenhet ändrar inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > spärr och inre sekretess: en spärrad vårdenhets infart syns inte och röjs inte, varken i listan, tidslinjen eller planeringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > FHIR: insättning, skötsel och avveckling är Procedure med KVÅ och samma behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| In- och utfarter > tidslinjen i översikten har insättning och avveckling | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en perifer venkateter inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.3.9 Mätvärden

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > mätvärden valideras och registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > vitalparametrar följer FHIR R4:s vitalparameterprofiler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > labbvärden har NPU-kod och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden och NEWS2 > kurvorna har referensintervall och markerar värden utanför | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden och NEWS2 > NEWS2 räknas av systemet ur vitalparametrarna, med serie, vad som ska göras och nästa kontroll | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden och NEWS2 > en hel NEWS2-omgång registreras på en gång, med samma tid och vårdkontakt och åtgärden QD008 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden och NEWS2 > NEWS2-omgången sparas inte alls när ett värde saknas eller är fel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden och NEWS2 > FHIR: NEWS2 som härledd Observation med samma behörighet som mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| NEWS2-larm i inkorgen > larmet syns för sjuksköterskan och läkaren på vårdenheten, med vad som ska göras, men inte för andra roller eller vårdenheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| NEWS2-larm i inkorgen > larmet bygger bara på den egna vårdenhetens värden: en spärrad vårdenhets värden larmar inte och nämns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en NEWS2-kontroll inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Mätvärden, skala 2 och inmatning > SpO2 skala 2: poängen följer Chart 1, och utan uppgift om luft eller syrgas räknas syremättnaden inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden, skala 2 och inmatning > systemet föreslår skala 2 vid andningssvikt med hyperkapné, läkaren beslutar med ett klick och NEWS2 räknas med skala 2 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden, skala 2 och inmatning > skala 2 gäller bara där beslutet syns: en spärrad vårdenhets beslut räknas inte och röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätvärden, skala 2 och inmatning > varje mätvärde visar om det är manuellt eller maskinellt inmatat, och listan kan väljas ut efter typ, inmatning och period | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > patientens egna mätningar visas skilda från vårdens värden och räknas inte i NEWS2, larm eller vikt förrän de är bedömda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Epikris och mätvärden > längd, vikt, blodtryck och puls registreras på en gång med samma tid och vårdkontakt, och systemet räknar BMI | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd, vikt, blodtryck och puls inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 3.1.3.10 Rättstavning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rättstavning > en felstavad medicinsk term får förslag ur den medicinska ordlistan, och vanliga ord och rätt stavade termer markeras inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättstavning > grammatik: upprepade ord, stor bokstav efter punkt, mellanslag och särskrivning av medicinska termer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättstavning > den personliga ordlistan: ett ord som personen lägger till markeras inte längre för personen, men för andra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättstavning > engelska: medicinska termer på engelska kontrolleras när texten är på engelska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättstavning > ordlistan har källor och utgåvor: kodverken, läkemedelskatalogen och den medicinska ordlistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättstavning > API: kontrollen tar emot text utan att spara eller logga den, och kräver inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Rätta en felstavad medicinsk term i en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.5.1 Strukturerad uppmärksamhetsinformation enligt Socialstyrelsen

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Uppmärksamhetsinformation > strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > överkänsligheterna som redan finns ingår, med grad, och syns i symbolen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > förslag ur läkemedelslistan: antikoagulantia blir behandling, men inte tillfällig behandling | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > förslag ur diagnoserna: bärarskap blir smitta, implantat och transplantat blir medicinska tillstånd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > FHIR: Flag och AllergyIntolerance med samma behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > varje tillägg och eget kodsystem har en publicerad definition | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: överkänslighet med matchande ATC-prefix | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > kodverkslistan är Socialstyrelsens version 6.1.2 med Snomed CT, ICD-10-SE, ATC och motivering för termerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > registrerad uppmärksamhetsinformation har termen ur kodverkslistan med koder och motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > förslag ur läkemedelslistan: immunmodulerande behandling och cytostatika enligt kodverkslistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > manuell registrering bara ur listan, och samma term inte två gånger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.5.2 Uppmärksamhetssymbol i patientvyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Uppmärksamhetsinformation > överkänsligheterna som redan finns ingår, med grad, och syns i symbolen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > arbetslistan visar bara kategorierna, utan innehåll | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > spärrade uppgifter syns inte i symbolen förrän patienten samtycker | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > läskopian har uppmärksamhetsinformationen och symbolen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > Min journal visar patientens uppmärksamhetsinformation, utan förslag och personalens id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Bekräfta föreslagen uppmärksamhetsinformation inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Uppmärksamhetssymbolen i sök och inkorg > patientsök visar symbolen med samma regler som i patienthuvudet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetssymbolen i sök och inkorg > inkorgen visar symbolen på raderna med patient, bara när översikten får läsas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.5.3 Uppmärksamhetsinformation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Uppmärksamhetsinformation > strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > förslagsreglerna ligger i en egen modul och är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > läkaren bekräftar ett förslag med ett klick, och det loggas med vem, var och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > manuell registrering bara ur listan, och samma term inte två gånger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > ett avfärdat förslag kommer inte tillbaka, och avfärdandet loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > när behandlingen sätts ut föreslår systemet att uppgiften avslutas, och den avslutas aldrig utan orsak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > sjuksköterska och undersköterska ser informationen men bekräftar inte, vårdadministratören ser den inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppmärksamhetsinformation > FHIR: Flag och AllergyIntolerance med samma behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Bekräfta föreslagen uppmärksamhetsinformation inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.6.1 Strukturerade och enhetligt åtkomliga basfakta

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Basfakta > basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta > basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.6.2 Basfakta

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Basfakta > basfakta är samma objekt i patienthuvudet och i API:t, med när, var och av vem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta > basfakta följer behörigheten: yrkesroll, spärr och skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > mätvärden valideras och registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > systemet slår upp ATC-koden och föreslår allvarlighetsgraden ur ämnet och reaktionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > nyregistrering: basfakta, uppmärksamhetssymbolen och varningen vid ordination uppdateras, med när, var och av vem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > ändring blir en ny version med orsak, och den tidigare versionen finns kvar i historiken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > avslut med orsak tar bort överkänsligheten ur basfakta och symbolen, men historiken visar den med vem och varför | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > fel roll, en spärrad vårdenhets rad och en rad som inte finns nekas, utan att något röjs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > skyddad identitet: svaret innehåller varken namn eller personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > en annan vårdenhets rad hos samma vårdgivare får ändras och avslutas, och avslutet lämnar raden kvar med historiken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Basfakta, överkänslighet > en rad hos en annan vårdgivare och en spärrad vårdenhets rad kan inte ändras eller avslutas, och felet röjer inget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en överkänslighet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.7.1 Dubbeldokumentation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > NLL: normal överföring kvitteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > FHIR för invånaren lämnar inte ut mer än Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > planerad kontakt på distans, och ankomsten registreras på den planerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnad bygger bara på det som den som fyller i får se: en spärrad vårdenhets mätvärde ändrar inte svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnaden använder bara den egna vårdenhetens uppgifter utan aktiva val, texten har ingen vårdenhet, och källan visas bara för den som får se den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.8.1 Sökfunktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sök på namn hittar namn med å, ä och ö oavsett skiftläge | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sökningen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > spärrade uppgifter: inga träffar, och svaret röjer inte att de finns, inte heller med nödåtkomst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > andra vårdenheters uppgifter söks först efter ett aktivt val, och svaret nämner dem inte per träff | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > sökningen loggas som läsning med söktermen och antalet synliga träffar i syftet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Söka i journalen och öppna träffen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.8.2 Sökmöjligheter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sök på namn hittar namn med å, ä och ö oavsett skiftläge | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > en läkemedelsgrupp hittar ordinationen och anteckningar som nämner läkemedlet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > yrkesrollen: undersköterskan hittar omvårdnad men inte läkaranteckningar eller diagnoser, vårdadministratören nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning i journalen > skyddad identitet: svaret innehåller varken namn eller personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning, filter och flera patienter > sökträffarna filtreras på typ, tid och vårdenhet, och filtren räknas bara på det som syns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning, filter och flera patienter > ett filter på en spärrad vårdenhet ger samma svar som en vårdenhet utan träffar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning, filter och flera patienter > samma sökfält söker över vårdenhetens patienter: en diagnos, ett läkemedel eller en grupp blir villkor | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning, filter och flera patienter > en patient utan vårdrelation, en spärrad vårdenhets uppgift och skyddad identitet följer behörigheten i sökningen över patienter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sökning, filter och flera patienter > på vårdgivarnivå får uppföljningen antal utan personuppgifter, och andra roller nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Söka i journalen och öppna träffen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Söka bland vårdenhetens patienter på en diagnos inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.9.1 Utskriftsfunktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > utskriften har samma innehåll som gränssnittet, med utskrifts-id, syfte, vem och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva ut läkemedelslistan vid utskrivning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.9.2 Spårbara och loggade utskrifter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > spärrade uppgifter och andra vårdenheters uppgifter kommer inte med utan aktivt val eller samtycke, och utelämnandet sägs men röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.9.3 Utlämnande och återlämnande av journalhandlingar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > ett utlämnande som inte har kommit tillbaka i tid hamnar i vårdenhetens inkorg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.9.4 Utskrifter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > syftet och delarna föreslås ur sammanhanget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > skyddad identitet maskeras i utskriften och en avidentifierad utskrift saknar namn och personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > en roll eller enhet utan behörighet nekas, och delar som rollen inte får läsa kommer inte med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, urval > ett datumintervall tar bara med poster från intervallet, och urvalet står i utskriften | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, urval > en enskild anteckning skrivs ut för sig, och loggen, posterna och kontrollsumman gäller just urvalet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, urval > valda poster ur flera delar skrivs ut, och en post som inte syns för den inloggade avvisas utan att röja den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, urval > förslaget erbjuder datumintervall och de poster som går att välja, och bara de som rollen får läsa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva ut en enskild anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.9.5 Loggning och spårbarhet

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utskrift > varje utskrift loggas och sparas med utskrifts-id, och sparade utskrifter går inte att ändra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift > utlämnande och återlämnande registreras, och utlämnandet går bara att komplettera med återlämnandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, menprövning > menprövningen registreras strukturerat med beslut, grund och vem, och systemet föreslår grunden ur mottagaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, menprövning > logggranskaren söker utlämnanden på mottagare över alla patienter, och sökningen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utskrift, menprövning > sökningen på mottagare maskerar skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.10.1 Skanning och presentation av restjournaler

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Skannade restjournaler > systemet läser textlagret och föreslår dokumenttyp och period, och kontrollerar personnumret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > skanningen sparar dokumentet med metadata, och samma fil eller fel patient stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > restjournalen visas i kronologin tillsammans med migrerad historik och ny dokumentation, och filen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > texten i restjournalen är sökbar i sökfältet i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > vårdadministratören skannar men läser inte, och fel roll och fel vårdenhet nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > en spärrad vårdenhets restjournal syns inte och röjs inte, varken i listan, tidslinjen eller sökningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > ett dokument som skannats till fel patient makuleras med orsak, raderas inte och försvinner ur kronologin | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skanna in en restjournal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.10.2 Presentation skanning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Skannade restjournaler > systemet läser textlagret och föreslår dokumenttyp och period, och kontrollerar personnumret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > skanningen sparar dokumentet med metadata, och samma fil eller fel patient stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > restjournalen visas i kronologin tillsammans med migrerad historik och ny dokumentation, och filen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > texten i restjournalen är sökbar i sökfältet i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > vårdadministratören skannar men läser inte, och fel roll och fel vårdenhet nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > en spärrad vårdenhets restjournal syns inte och röjs inte, varken i listan, tidslinjen eller sökningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skannade restjournaler > ett dokument som skannats till fel patient makuleras med orsak, raderas inte och försvinner ur kronologin | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skanna in en restjournal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.11.1 Signeringsfunktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > signerad anteckning kan inte ändras via API-funktionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte raderas (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > annan än författaren kan inte ändra eller signera utkast | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva och signera en daganteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.11.2 Signering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > signerad anteckning kan inte ändras via API-funktionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte raderas (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > annan än författaren kan inte ändra eller signera utkast | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva och signera en daganteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > Granska och signera alla: varje utkast signeras för sig och bara av författaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signering > en signering sparar en signatur över anteckningens innehåll med det simulerade SITHS-kortet, och den går att kontrollera | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signering > signeringslistan visar vårdenhetens osignerade poster per författare utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.1.11.3 Kontrasignering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontrasignering > systemet föreslår överläkaren och aldrig den som signerade, den som begär eller en underläkare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontrasignering > begäran hamnar i inkorgen och kontrasigneras med ett klick, och syns i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontrasignering > den som har signerat kan inte kontrasignera själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontrasignering > en roll eller enhet utan behörighet nekas, och begäran ger ingen åtkomst utöver posten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontrasignering > spärrade uppgifter och andra vårdenheters uppgifter kan inte begäras kontrasignerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontrasignering > ett provsvar kan begäras kontrasignerat, och en kontrasignering kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Begära kontrasignering av en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Kontrasignera en anteckning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.1.12.1 Dokumentation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Donation och transplantation > ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen att pröva donation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donation och transplantation > checklistan bockas av där systemet kan, och den medicinska bedömningen får sitt underlag ur journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donation och transplantation > närståendes uppgift om inställningen, checklistan klar, KVÅ för bedömningen och underlag till kvalitetsregistret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donation och transplantation > donationsanteckningen skrivs av systemet ur checklistan, och läkaren signerar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donation och transplantation > en transplantation ger bidiagnos ur ICD-10-SE och uppmärksamhetsinformationen föreslår transplantat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donation och transplantation > behörighet: fel roll, fel vårdenhet och spärr, och tidslinjen visar bara det som får ses | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Pröva donation efter ett dödsfall på intensivvården inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Donationsansvariga och avliden patient > förslaget går till de donationsansvariga som verksamhetschefen har utsett, och ett byte av uppdraget ändrar mottagaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donationsansvariga och avliden patient > dödsfallet märker patienten som avliden med datum i huvudet och i sökningen, och den simulerade folkbokföringen meddelas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donationsansvariga och avliden patient > kommande tider avbokas med orsak och utan besked till patienten, och posterna på väntelistan avslutas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donationsansvariga och avliden patient > nya bokningar, kallelser, påminnelser och sms till en avliden patient stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Donationsansvariga och avliden patient > journalen för en avliden patient går fortfarande att läsa och dokumentera i | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.2.1.1 Processtöd med integrerat kunskaps- och beslutsstöd

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varningarna är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > allvarlig varning måste kvitteras med motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: warfarin och NSAID | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: metformin vid lågt eGFR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > förslaget på standardplan har vårdförloppet och källan innan planen sätts upp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > NEWS2 visas med vad poängen betyder och källan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.2.1.2 Processtöd med integrerat kunskaps- och kliniskt beslutsstöd

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varningarna är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > allvarlig varning måste kvitteras med motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > förslaget på standardplan har vårdförloppet och källan innan planen sätts upp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > NEWS2 visas med vad poängen betyder och källan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > vid varningen visar systemet hur ofta den har kvitterats på vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > systemet avgör själv vilka doser en kollega kontrollerar: koncentrerade elektrolyter och Addex, opioider, insulin- och heparininfusion och cytostatika | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.2.1.3 Beslutsstödstrappan

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varning: överkänslighet med matchande ATC-prefix | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: metformin vid lågt eGFR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varningarna är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > små tal visas aldrig, inte heller som skillnaden mellan två tal, och andra vårdenheters planer räknas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > vid varningen visar systemet hur ofta den har kvitterats på vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > läkemedelsinformationen visar hur ofta substansen sätts ut inom 30 dagar på vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.2.2.1 Standardiserade och individuella vårdplaner

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdplan > systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp en standardvårdplan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.2.2.2 Stöd för vårdplaner

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdplan > systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > en individuell plan har mål, åtgärder, ansvarig yrkesroll och uppföljningsdatum, och planen kan anpassas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > uppehåll, återupptagning, uppföljning och avslutning sparas i historiken, som inte kan ändras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > avvikelser från planen visas i översikten och uppföljningen bevakas i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > tvångsvården föreslår vårdplanen enligt 16 § och uppgiften försvinner när planen finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > FHIR: vårdplanen är en CarePlan med samma behörighet och loggning, och invånaren får den inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.2.2.3 Följa patientens vårdprocess

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > migreringsavstämningen visar avvikelsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanhållen journalföring > uppgifter från en annan vårdgivare hämtas först efter vårdrelation, samtycke och ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanhållen journalföring > de hämtade uppgifterna visas i samma kronologi med vårdgivare, vårdenhet, yrkesroll och tid utskrivna, och kan sorteras och väljas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanhållen journalföring > uppgifter som är spärrade hos den andra vårdgivaren hämtas aldrig, och systemet säger bara att det finns spärrade uppgifter hos en annan vårdgivare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanhållen journalföring > nödåtkomst utan samtycke hämtar uppgifterna och loggas som nödåtkomst, men aldrig spärrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanhållen journalföring > valet gäller bara den person och vårdenhet som gjorde det och följer aldrig med till nästa inloggning eller uppdrag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanhållen journalföring > varje hämtning loggas på patienten med vårdgivaren, och samtycket kan återkallas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Hämta uppgifter från en annan vårdgivare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.2.3.1 Dokumentation och uppföljning av psykiatrisk tvångsvård

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > fristerna räknas ur lagen: intagning inom 24 timmar, vårdintyg högst fyra dagar, ansökan före fyra veckor och vård i högst fyra månader | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > övergång från frivillig vård: beslut inom 24 timmar, underställning dagen efter och ansökan inom fyra dagar (11 och 12 §§) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > utan ansökan i tid upphör tvångsvården av sig själv (28 §), och 26 a § låter den öppna vården kvarstå | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > rättspsykiatrisk vård: fyra månader utan särskild utskrivningsprövning och anmälan inom fyra månader med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett intagningsbeslut inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.2.3.2 Stöd för dokumentation av psykiatrisk tvångsvård

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > läkaren beslutar om intagning med ett klick, systemet kontrollerar vårdintyget och skriver in patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > beslutet nekas för den som saknar chefsöverläkarens uppdrag, och tvångsåtgärder kräver uppdraget utom under kvarhållningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > vårdintyget skickas av systemet till den psykiatriska vårdenheten och svaret röjer inget om andra uppgifter där | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > beslutsjournalen kan inte ändras eller raderas (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > kontrollerna före intagningen: vårdintygets ålder, vem som utfärdade det och chefsöverläkarens uppdrag (6 b och 39 §§) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett intagningsbeslut inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.2.3.3 Psykiatrisk tvångsvård med parallella vårdprocesser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > parallella processer: den somatiska vården visas medan tvångsvården fortsätter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.2.3.4 Uppföljning av psykiatrisk tvångsvård

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tvångsvård > bevakningen på enhetsnivå sorterar på fristen och uppföljningen innehåller inga personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > inkorgen visar fristen för ansökan och uppgifterna för läkaren på den psykiatriska vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > tvångsåtgärder: fastspänning och avskiljande med lagens tidsgränser för vuxna och barn, och underrättelse till IVO | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > skyddad identitet maskeras i bevakningen, och nödåtkomst ger bara läsning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.2.3.5 Högflödesmottagning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > väntrummet visar aldrig namn för skyddad patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > ankomsten registreras med ett klick: könummer, akutbesök och tid sätts av systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > triagen räknar prioriteten ur vitalparametrarna och kontaktorsaken och förklarar varför | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > flödestavlan visar patientens steg, planerade och utförda aktiviteter och ledtider, sorterade på prioritet och väntetid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > en aktivitet planeras och registreras som utförd med vem och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > utregistreringen avslutar besöket, och överföringen till slutenvård skriver in patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > flödestavlan visar aldrig namn för en skyddad patient och bara könummer utanför akutmottagningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > ledtiderna följs upp per prioritet utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > en förvarning från ambulansen tas emot och blir en ankomst med prehospitala uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > den direkta ankomsten tar bara patient och kontaktorsak från anropet, och ankomstsätt, prioritet, triage och prehospitala uppgifter ignoreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Akutmottagningen > vårdrelationen uppstår bara när en annan person bekräftar den, också efter en förvarning, och bekräftelsen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en ankomst på akutmottagningen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.3.1.1 Funktion för vårdbegäran

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > steg kan inte hoppas över | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > ny remiss valideras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > helflöde: remiss genom hela statuskedjan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skicka remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.3.1.2 Vårdbegäran till och från externa vårdgivare

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss, del 3 > extern pappersremiss: registreras från en inskannad remiss med avsändare ur den simulerade HSA-katalogen eller som fritext och går in i samma flöde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > extern pappersremiss: registreringen ger ingen läsrätt, den som registrerade tar inte emot och bedömer inte, och vårdrelationen uppstår när någon annan tar emot | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > extern pappersremiss: skyddad identitet maskeras och en spärr röjs inte, och registreringen ger ingen åtkomst till de spärrade uppgifterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en pappersremiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 3.3.1.3 Presentation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > seeden har remisser i varje läge och larm | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > vårdadministratör ser status men inte klinisk text | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > bilagor: typen avgörs ur innehållet, storleken kontrolleras, filen lagras på servern och varje hämtning loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > vidarebefordran till en annan vårdenhet med motivering: systemet kvitterar mottagningen och avsändaren ser var remissen är | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Egen vårdbegäran > invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > på uppdrag: den som skriver ser aldrig remissens text eller läkarens anteckning, och bara den namngivna läkaren signerar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > fördelning: en inkommande remiss fördelas till en namngiven läkare med två klick, systemet kvitterar mottagningen och läkaren får den i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > remisskonferens: systemet sätter remissen på nästa konferens, läkaren bedömer i följd och vårdadministratören registrerar beslut på uppdrag med läkaren som ansvarig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > extern pappersremiss: registreras från en inskannad remiss med avsändare ur den simulerade HSA-katalogen eller som fritext och går in i samma flöde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > konsultation: typen väljs när remissen skapas och följer med utkast, återanvändning, på uppdrag och vidarebefordran | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > konsultation: mottagaren svarar direkt med ett konsultationssvar, systemet kvitterar mottagning och bedömning och vårdansvaret stannar hos remittenten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > översikt: remisserna filtreras på typ, status, prioritet och tid, och antalet per val räknar bara det som visas för den egna vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > översikt: perioden räknas från en fast tid och intervallet följer svensk tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > beslut på uppdrag: hamnar i den ansvariga läkarens inkorg och kvitteras av läkaren i egen inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.3.1.4 Upprättande

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > ny remiss valideras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skicka remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| API > helflöde: remiss genom hela statuskedjan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > ett utkast fylls i av systemet, kan sparas och ändras av den som skrev det och skickas när det är klart | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > ett utkast kan återanvända en tidigare remiss som användaren får läsa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > bilagor: typen avgörs ur innehållet, storleken kontrolleras, filen lagras på servern och varje hämtning loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > avsändaren kompletterar en skickad remiss med en bilaga, men inte efter svaret och inte från en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > på uppdrag: vårdadministratören skriver remissen med en läkare som remittent, systemet föreslår läkaren och remissen skickas när läkaren har signerat i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > på uppdrag: den som skriver ser aldrig remissens text eller läkarens anteckning, och bara den namngivna läkaren signerar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva en remiss på uppdrag av en läkare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Remiss, del 4 > konsultation: typen väljs när remissen skapas och följer med utkast, återanvändning, på uppdrag och vidarebefordran | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > konsultation: en ServiceRequest med kategorin konsultation skapar en konsultation genom FHIR, och utan kategori blir det en remiss | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > bilagor: storleken och antalet är parametrar som systemförvaltaren sätter, med demons gränser som förval | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skicka en konsultation inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.3.1.5 Mottagande och svar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > bara mottagande enhet kan kvittera, bedöma och svara | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > avvisning kräver motivering och avslutar kedjan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > bara avsändaren kan kvittera svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Kvittera remissvar inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Remiss, del 2 > vidarebefordran till en annan vårdenhet med motivering: systemet kvitterar mottagningen och avsändaren ser var remissen är | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > avsändaren kompletterar en skickad remiss med en bilaga, men inte efter svaret och inte från en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > fördelning: en inkommande remiss fördelas till en namngiven läkare med två klick, systemet kvitterar mottagningen och läkaren får den i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > besök inom: en accepterad remiss hamnar på väntelistan med den tidsram som läkaren väljer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > remisskonferens: nästa konferens är tisdag eller torsdag klockan 8 och räknas från en fast tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 3 > remisskonferens: systemet sätter remissen på nästa konferens, läkaren bedömer i följd och vårdadministratören registrerar beslut på uppdrag med läkaren som ansvarig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Fördela en remiss till en läkare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Remiss, del 4 > konsultation: mottagaren svarar direkt med ett konsultationssvar, systemet kvitterar mottagning och bedömning och vårdansvaret stannar hos remittenten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > beslut på uppdrag: hamnar i den ansvariga läkarens inkorg och kvitteras av läkaren i egen inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 4 > beslut på uppdrag: läkaren som inte håller med öppnar remissen igen för egen bedömning, och väntelistans post avslutas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.3.1.6 Uppföljning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: svar saknas efter sista svarsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: svar inte kvitterat efter 3 dagar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss, del 2 > ledtider och avvikelser per vårdenhet och för regionen, utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.3.2.1 Egen vårdbegäran

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Egen vårdbegäran > invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Egen vårdbegäran > vid tecken på akuta besvär hänvisar systemet till 112, och en invånare kan ha högst tre öppna vårdbegäranden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.1.1 Patientplanering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > en accepterad remiss hamnar på väntelistan av sig själv med tidstyp, yrkesroll, prioritet och vårdgaranti som demoregel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > väntelistan lyfter den som riskerar att passera gränsen, och omprioritering kräver orsak och sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Återbesök > planeringen i texten tolkas: tidstyp, yrkesroll och tidsram | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återbesök > systemet föreslår återbesöket ur anteckningens planering, och läkaren sätter upp det med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återbesök > utan planering i texten föreslår systemet ur diagnosen och den senaste kontakten, och läkaren kan ändra förslaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återbesök > säkerhet: skriv_journal och vårdrelation på egen vårdenhet krävs, och anteckningar som inte får läsas används inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp ett återbesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Vårdhändelse i tidboken > utan bokning hamnar vårdhändelsen på väntelistan, och vårdadministratören bokar den som vanligt i Dagens arbete | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.1.2 Resursplanering kopplad till patient

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > seeden har scheman per mottagning och vårdgivare med tidstyper, och dagens patienter på kardiologiska mottagningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > seeden har lokaler, utrustning och en simulerad sjukresa som resurser, och tidstypen ingrepp med vad den kräver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > ombokning flyttar rum, utrustning och sjukresa, och avbokning släpper dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka elkonvertering med rum och utrustning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Bokning, del 3 > teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > teambesök: färre än två vårdgivare eller en vårdgivare från en annan vårdenhet nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka ett teambesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.1.3 Åtgärder och bevakningar på individ- och enhetsnivå

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Remiss > larm: mottagningskvittens saknas efter 2 timmar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > egna bevakningar på individ- och enhetsnivå med datum och ansvarig syns i Dagens arbete och inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > egna bevakningar: utan vårdrelation, med fel ansvarig eller på en annan vårdenhet nekas, och skyddad identitet maskeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.1.4 Patientplanering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Återbesök > systemet föreslår återbesöket ur anteckningens planering, och läkaren sätter upp det med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återbesök > utan planering i texten föreslår systemet ur diagnosen och den senaste kontakten, och läkaren kan ändra förslaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta upp ett återbesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Planering > provtagning före läkarbesök: systemet föreslår tiderna i följd med rätt mellanrum och bokar båda med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > tider i följd: ombokning flyttar provtagningen med, och avbokning avbokar båda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka provtagning före läkarbesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Arbetsdagen på mottagningarna (runda 13, r4) > mitt på dagen har några patienter kommit och några väntas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arbetsdagen på mottagningarna (runda 13, r4) > en ankomst som registreras i efterhand räknas från den bokade tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.1.5 Kapacitets- och resursplanering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > seeden har lokaler, utrustning och en simulerad sjukresa som resurser, och tidstypen ingrepp med vad den kräver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > gruppträff: platser kvar, kallelser som går ut för hela gruppen och direkt för den som läggs till efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > gruppträff: en full träff ger plats på gruppens väntelista, och systemet föreslår den som har väntat längst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kapacitet och prognos > veckor med lediga tider, väntelistan och inkomna remisser ger en prognos för när kön är borta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kapacitet och prognos > patienter som riskerar att passera gränsen ger förslag på fler tider, och lokaler och utrustning visas per vecka | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kapacitet och prognos > översikten har inga patientuppgifter och är bara för vårdadministratören | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontorsstöd > rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Se vårdenhetens kapacitet och prognos för väntelistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.1.6 Presentation av planering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > anpassningsbara vyer sparas per användare på servern med ett förval som systemet väljer efter rollen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > Dagens arbete visar en fritt vald tidsperiod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > en bokad tid på en annan vårdenhet syns inte utan aktivt val, och svaret är detsamma med och utan den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Överblicka dagens händelser på avdelningen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 3.4.1.7 Hantering av väntelista

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > väntelistan lyfter den som riskerar att passera gränsen, och omprioritering kräver orsak och sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > en accepterad remiss hamnar på väntelistan av sig själv med tidstyp, yrkesroll, prioritet och vårdgaranti som demoregel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > väntetidsstatistik per vårdenhet utan personuppgifter, med vårdgarantin som demoregel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Väntelistan (runda 13, r4, E3-8 och E3-9) > vårdgarantin har en egen kolumn, och väntan som patienten väljer eller som har medicinska skäl räknas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Väntelistan (runda 13, r4, E3-8 och E3-9) > en post tas bort från väntelistan med en orsak, och bara av vårdenheten själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.1.8 Aktivitetslista

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > arbetslista maskerar skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > inkorgen visar larm, okvitterade svar och NLL-avvikelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Öppna patient från arbetslistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Tidbok > startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Checka in en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Planering > Dagens arbete visar en fritt vald tidsperiod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > egna bevakningar på individ- och enhetsnivå med datum och ansvarig syns i Dagens arbete och inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avdelningens planering > systemet avgör typ, yrkesroll, längd och tid ur texten när en uppgift planeras, och undersköterskan registrerar att den är utförd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Överblicka dagens händelser på avdelningen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.2.1 Bokning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > behörighet: bara vårdadministratören bokar, kallar, checkar in och hanterar väntelistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > utan vårdrelation eller remiss nekas bokningen, och en annan vårdenhets tidbok går inte att använda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok, säkerhetsgranskning > en bokning ger inte bestående vårdrelation när remissen avvisas: tiden avbokas och patienten får besked | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok, säkerhetsgranskning > en planerad kontakt ger vårdrelation bara till 90 dagar efter tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka om en tid inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Bokning, del 3 > fri bokning: systemet väljer besökstyp, vårdgivare och tider, och bokningen skapar vårdkontakten och kallelsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > fri bokning: utan vårdrelation, fel roll, en annan vårdenhets tid och en gruppträff nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka en patient fritt inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 3.4.2.2 Bokning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka tid för en remiss inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka om en tid inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Planering > systemet föreslår bara ingreppstider där personal, behandlingsrum och defibrillator är lediga, och bokar allt samtidigt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > provtagning före läkarbesök: systemet föreslår tiderna i följd med rätt mellanrum och bokar båda med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Planering > tidboken visar resursernas arbetslista och bokningsmallarna, och utan namn inga patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka elkonvertering med rum och utrustning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka provtagning före läkarbesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Bokning, del 3 > fri bokning: systemet väljer besökstyp, vårdgivare och tider, och bokningen skapar vårdkontakten och kallelsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > gruppträff: platser kvar, kallelser som går ut för hela gruppen och direkt för den som läggs till efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning, del 3 > gruppträff: en full träff ger plats på gruppens väntelista, och systemet föreslår den som har väntat längst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka en patient fritt inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Boka ett teambesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lägga till en patient i en gruppträff inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > en inskriven patient får förslag från några dagar efter i dag, med hans kommande tider på vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > systemet föreslår inte en tid som ett brev inte hinner fram till, och ett brev till en för nära tid skickas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.2.3 Egenbokning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > egenbokning stängs 24 timmar före tiden och för tidstyper som mottagningen inte öppnar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Patienten bokar om sin tid i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Tidbok, egenbokning > patientens egenbokning gäller bara återbesök, telefon och video, aldrig nybesök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > en tid som styr en läkemedelsdos kan patienten inte boka om själv i Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > patienten ger fullmakt i Min journal, och ombudet bokar, bokar om och avbokar patientens tider med loggning på patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > ombudet når aldrig journalen, och en återkallad eller utgången fullmakt ger ingen åtkomst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > vårdadministratören registrerar en skriftlig fullmakt, och fullmakten prövas mot ålder, dubbletter och tak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > patientens logglista visar ombudets åtgärder som ombud, och vården ser vem som bokade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > meddelanden för ett ombud visar och tar aldrig emot läkemedel, vårdplaner eller vad en tråd gäller ur journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > trådar som gäller en ordination eller en vårdplan finns inte för ombudet, inte heller i räknare, läsmarkering och svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > en fullmakt i Min journal röjer aldrig vem ett personnummer tillhör, skyddad identitet registreras bara av personal, och försöken har ett tak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > en fullmakt från Min journal gäller först när ombudet har godkänt den, och svaret är detsamma för alla nummer som inte kan bli ombud | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > registreringar och återkallelser har ett tak per dygn, ett ombud kan avböja och en skriftlig fullmakt hos vården gäller direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka en tid för patienten som ombud inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.3.1 Kommunikationsalternativ för kallelse och påminnelse

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > påminnelsen skickas automatiskt två dagar före tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok, säkerhetsgranskning > kallelsetexten och adressen för en patient med skyddade personuppgifter visas inte för personalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > systemet föreslår inte en tid som ett brev inte hinner fram till, och ett brev till en för nära tid skickas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.3.2 Kallelse och påminnelse på individ- och gruppnivå

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > gruppkallelse skickar en kallelse till varje deltagare och loggas per patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > exemplet på gruppkallelsen skrivs ur en mall och aldrig ur en sparad kallelse till en patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > påminnelsen skickas automatiskt två dagar före tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skicka en gruppkallelse inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.3.3 Kallelse och påminnelse

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > påminnelsen skickas automatiskt två dagar före tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > gruppkallelse skickar en kallelse till varje deltagare och loggas per patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kallelser, del 2 > kallelsen skrivs på patientens språk, och patienten väljer språk i Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kallelser, del 2 > kallelsen som PDF och iCalendar för personalen och för patienten i Min journal, och varje hämtning loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kallelser, del 2 > kallelsen som PDF för en patient med skyddade personuppgifter kräver Visa identitet och har aldrig adress | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kallelser, del 2 > kallelse utan förbokad tid: patienten väljer själv en tid i Min journal inom ramen som systemet sätter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.4.1 Registrering av vårdkontakt och betalning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett besök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Tidbok > incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > betalningen räknas av systemet: kort, faktura, frikort och avgiftsfrihet, simulerad och märkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Checka in en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Kassan > betalning i den simulerade terminalen och återbetalning med kvitto samma väg, en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > kassaredovisning per kassör och betalsätt och dagsavslut som inte kan ändras, med avstämning mot terminalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > fel roll och en annan vårdenhet nekas, avgifter för tjänster finns inte i kassan, och redovisningen har inga patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontorsstöd > rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Göra dagsavslut i kassan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.4.2 Incheckning som patienten gör själv

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok, säkerhetsgranskning > incheckningsskärmen visar inte avgiften och stoppar många försök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.4.3 Registrering av vårdkontakt/er

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > vårdadministratören registrerar ett oplanerat besök med förval ur sammanhanget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > planerad kontakt på distans, och ankomsten registreras på den planerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > kontaktorsak krävs bara när systemet inte kan föreslå den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > den som dokumenterar kan ändra kontakten som systemet skapade, men inte en annan enhets | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > yrkesrollen avgör vem som registrerar kontakter och vem som skriver in och ut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera ett besök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Planera ett videobesök inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva in en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Arbetsdagen på mottagningarna (runda 13, r4) > en ankomst som registreras i efterhand räknas från den bokade tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.4.4.4 Stöd vid betalning av patientavgifter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > patientavgiften räknas ur kontakttyp och regler och är märkt som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > betalningen räknas av systemet: kort, faktura, frikort och avgiftsfrihet, simulerad och märkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: avgiften visas som e-frikortet > i vårdkontaktslistan och tidbokens betalning skiljer sig svaret med och utan dolda besök bara i beloppet och frikortsstatusen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > avgiften för receptförnyelse och intyg räknas av systemet ur ålder, LMA-kort, frikort och intygstyp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > om receptförnyelse och intyg ingår i högkostnadsskyddet är en parameter per avgiftstyp som systemförvaltaren sätter, med nej som förval | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > personalens svar i meddelandet, kassan, återbetalningen och dagsavslutet är desamma med och utan en dold avgift, och patienten ser och betalar det riktiga beloppet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > betalning i den simulerade terminalen och återbetalning med kvitto samma väg, en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > patienten betalar en avgift för en tjänst i Min journal, och ett ombud ser den inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kassan > fel roll och en annan vårdenhet nekas, avgifter för tjänster finns inte i kassan, och redovisningen har inga patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Förnya ett recept som patienten har bett om i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.4.4.5 Incheckning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tidbok > patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > FHIR: Schedule, Slot och Appointment med status för incheckning och samma behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > FHIR: invånaren ser bara sina egna Appointment | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-incheckning > personalen checkar in med PATCH på Appointment med samma behörighet som gränssnittet, och det loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-incheckning > invånaren checkar in sin egen tid med PATCH, bara när incheckningen är öppen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-incheckning > Encounter-status arrived registrerar ankomsten på den planerade vårdkontakten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-incheckning > fel roll, en annan vårdenhet och andra ändringar än status nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.1 Läkemedelsbehandling genom vårdprocesser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > utsättning kräver orsak och inget raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > helflöde: ordination med varning, kvittens och NLL som inte svarar i tid, med avstämning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > permission: doser under permission lämnas över till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsöverföring > systemet väljer mottagarna själv: vårdcentralen där patienten är listad och kommunen när en samordnad planering pågår | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsöverföring > läkemedelsberättelsen, läkemedelslistan och epikrisen skickas med ett klick, och mottagaren ser och kvitterar dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsöverföring > spärrade ordinationer skickas aldrig, och en spärr på den egna vårdenheten kräver patientens samtycke innan något skickas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsöverföring > bara en läkare med vårdrelation skickar, och bara mottagaren och avsändaren ser överföringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsöverföring > kommunen ser bara läkemedelslistan och berättelsen som har skickats till den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > en opioid iordningsställs, kontrolleras av en kollega i sin egen inloggning och ges, och en dos som inte är kontrollerad stoppas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > den som iordningsställde kan inte kontrollera själv, och en undersköterska eller en annan vårdenhet kan inte kontrollera | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > en infusion med Addex-tillsats bereds och kontrolleras av en kollega innan den ges | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > systemförvaltaren styr grupperna som parametrar med fyra ögon, och en avstängd grupp kontrolleras inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > den sparade kontrollen avgör: ett annat läkemedel eller en annan ordination i anropet, eller en avstängd parameter, öppnar inte en okontrollerad dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > inkorgen visar antalet doser som väntar på kontroll utan patientuppgifter, och aldrig den egna dosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skicka läkemedelsberättelsen till nästa vårdgivare inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.1.2 Läkemedelsinformation i vyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > spärrade enheters ordinationer visas inte i läkemedelslistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer för läkemedel > dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer för läkemedel > läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.3 Fördefinierade ordinationer och förskrivningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Fördefinierade ordinationer > fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mallar med flera ordinationer > läkaren ordinerar ur en mall: systemet fyller i allt, varnar per ordination och tar själv bort ett läkemedel som patienten redan har | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mallar med flera ordinationer > ordinationerna i mallen knyts till samma planerade vårdhändelse och en annan allvarlig varning kräver motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mallar med flera ordinationer > säkerhet: mallen gäller bara sin vårdenhet, sjuksköterskan ordinerar inte ur mallar, bara läkare upprättar en mall och den används först när den är godkänd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ordinera från en mall med flera ordinationer inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Godkännande av läkemedelsmallar > mallansvarig läkare godkänner en ändrad mall från inkorgen: den gamla används tills den nya är godkänd, och historiken sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Godkännande av läkemedelsmallar > säkerhet: bara den mallansvariga läkaren på vårdenheten godkänner, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Godkännande av läkemedelsmallar > en ändrad läkemedelsmall per substans kräver nytt godkännande per vårdenhet, och förslaget använder den godkända versionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en ändrad läkemedelsmall inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Doseringsmallar per produkt > Alvedon forte 1 g och paracetamol som infusion får egna förslag ur produkten, inte tablettdosen för 500 mg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Doseringsmallar per produkt > en annan styrka i samma form får samma antal tabletter och dosen ur styrkan, och en annan form får inte substansens mall | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.4 Korrekt spädning och tillsatser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Spädning och tillsatser > systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillsatser i infusion > glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning med kontroll och etikett > en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning med kontroll och etikett > beredningen följer ordinationen: fel lösning, gången förpackning och passerad hållbarhet stoppas med en förklaring, och en skannad förpackning fyller i batch och utgångsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning och skanning via API > API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.5 Kunskaps- och kliniskt beslutsstöd vid läkemedelshantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > varning: överkänslighet med matchande ATC-prefix | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: dubbelordination av samma substans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: samma ATC-grupp ger observera | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: warfarin och NSAID | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: två antikoagulantia | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varning: metformin vid lågt eGFR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > allvarlig varning måste kvitteras med motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > varningarna är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > varning: dubbel dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > varning: given dos utan ordination | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsstöd > läkemedelsinformationen räknar inte med ett eGFR från en spärrad vårdenhet och kräver behörighet att läsa läkemedel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > vid varningen visar systemet hur ofta den har kvitterats på vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kunskapsgenererande stöd > läkemedelsinformationen visar hur ofta substansen sätts ut inom 30 dagar på vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > systemet avgör själv vilka doser en kollega kontrollerar: koncentrerade elektrolyter och Addex, opioider, insulin- och heparininfusion och cytostatika | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > en opioid iordningsställs, kontrolleras av en kollega i sin egen inloggning och ges, och en dos som inte är kontrollerad stoppas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > systemförvaltaren styr grupperna som parametrar med fyra ögon, och en avstängd grupp kontrolleras inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kollegakontroll av högriskläkemedel > den sparade kontrollen avgör: ett annat läkemedel eller en annan ordination i anropet, eller en avstängd parameter, öppnar inte en okontrollerad dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.6 Läkemedelsgenomgång

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedelsgenomgång > läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fördjupad läkemedelsgenomgång > läkaren startar, farmaceuten föreslår åtgärder, patientens medverkan registreras och läkaren beslutar med det som 11 kap. kräver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fördjupad läkemedelsgenomgång > säkerhet: sjuksköterskan startar inte, nödåtkomst ger ingen genomgång och patientens frånvaro ska motiveras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av läkemedelsprocessen del 2 > en fördjupad genomgång och en utvärdering sparar aldrig en spärrad vårdenhets läkemedel, inte ens med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.7 Nationella vaccinationsprogram

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Barnhälsovårdens program > besöken och vaccinationerna följer barnets ålder, och systemet säger varför en dos inte kan ges | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Barnhälsovårdens program > vaccinationen prövas mot programmet och får ATC och dos av systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Barnhälsovårdens program > före varje dos frågar systemet alltid om vaccinationer som har getts någon annanstans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Barnhälsovårdens program > en vaccination som kräver aktivt val ger en varning utan vårdenhet, vaccin eller datum, och dosen kan ges efter en bekräftelse som loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Barnhälsovårdens program > en vaccination bakom en spärr röjs aldrig: ingen varning, bara den vanliga frågan som alla barn får | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för barnhälsovården > FHIR: vaccinationerna är Immunization med ATC och dos, med samma behörighet och loggning, och invånaren ser dem utan personal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > programmet för barn fortsätter med elevhälsans doser och vattkoppor, och vuxna föreslås influensa och pneumokocker efter ålder och riskgrupp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > riskgruppen räknas bara ur diagnoser som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > en dos ges med prövning mot programmet, och en dos som har getts någon annanstans registreras med källan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > varje dos som ges rapporteras till det simulerade vaccinationsregistret med kvittens | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > vaccinationerna kräver vårdrelation, och nödåtkomst ger bara läsning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > barnhälsovården registrerar bara vaccin i sitt eget program och hänvisar andra vacciner till vaccinationsprogrammens flöde, som prövar dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > åldern för vattkoppor, åldersgränsen och riskgrupperna är parametrar som systemförvaltaren sätter med fyra ögon, och programmet följer dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationsprogram > FHIR: vaccinationerna i programmen är Immunization med samma behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ge en vaccination i programmet för riskgrupper inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Vaccinationer (runda 13, r4, E2-38 och E2-39) > barnhälsovårdens doser står i fliken Vaccinationer, och åldern räknas från födelsedagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vaccinationer (runda 13, r4, E2-38 och E2-39) > en dos ges bara när patienten är frisk i dag, och batch, utgångsdatum och injektionsställe sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.8 Presentationsvyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: normal överföring kvitteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning > utsättning av betablockerare ger varning och kräver bekräftelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer för läkemedel > dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer för läkemedel > läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljning av läkemedel > en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Identitet > sammanslagning: rader som aldrig får ändras, till exempel en given dos, följer med, och skyddet gäller efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanslagning av journaler med beredning och skanning > en beredning och en skanning följer med när journalerna slås samman, och skyddet mot ändring gäller efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.9 Användning av nationella läkemedelstjänster

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > NLL: normal överföring kvitteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: felsvar syns och avstämning skickar igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.1.11 Läkemedelsgenomgång

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedelsgenomgång > läkemedelsgenomgång hittar fynd och ger en läkemedelsberättelse ur historiken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsberättelsen i epikrisen > epikrisens förslag har läkemedelsberättelsen under Läkemedelsförändringar, och den som läkaren har sparat vid läkemedelsgenomgången går först | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.1 Gemensam funktionalitet för läkemedelsprocessen

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > gemensam läkemedelslista: andra enheters ordinationer syns utan aktivt val men inte spärrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spädning och tillsatser > systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillsatser i infusion > glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.2 Registrering i efterhand

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > registrering i efterhand med tidpunkt och den som utförde det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Registrering i efterhand och makulering > en felaktig registrering makuleras med orsak och historik och raderas aldrig, och dosen blir att ge igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Registrering i efterhand och makulering > säkerhet: en annan vårdenhet, nödåtkomst och en spärrad dos kan inte makuleras, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av läkemedelsprocessen del 2 > en muntlig ordination prövas mot när registreringen görs: en bakdaterad dos efter fönstret stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av läkemedelsprocessen del 2 > ett iordningsställande i efterhand får inte ligga före ordinationen eller i framtiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera en dos i efterhand inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.3 Vätskebalans i läkemedelsprocessen

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt > inre sekretess: vätskebalansen från en annan vårdenhet syns inte utan aktivt val, och en spärrad dos räknas aldrig in i prognosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.4 Godkända, icke godkända och egendefinierade läkemedel, blodprodukter och nutrition

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelstyper > extempore, licens, egendefinierade läkemedel, blodprodukter och nutrition finns i katalogen, märkta som demo och utan NPL-id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelstyper > systemet bevakar licensen: varning vid ordination, stopp vid dos efter att den gått ut och en rad i läkarens inkorg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelstyper > en blodprodukt ges bara med kontrollen vid sängen, och skickas inte till NLL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning av extempore, licens och blodprodukter > extempore beställs från det simulerade apoteket och blodprodukter från den simulerade blodcentralen, med mängd ur ordinationen och status till leveransen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning av extempore, licens och blodprodukter > en licensansökan till det simulerade Läkemedelsverket kräver motivering, och en beviljad licens bevakas av systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.5 Administrering under permission

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > permission: doser under permission lämnas över till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > iordningsställande med kontrollkod och sedan administrering av samma dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.6 Förskrivning/ordination med ordinationsorsak

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > databasen vägrar ordination utan orsak (CHECK) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > alla ordinationer har orsak och uppföljningsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ordinera ett läkemedel utan varning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.7 Ordination kopplad till planerad vårdhändelse

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Fördefinierade ordinationer > ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > systemet föreslår patientens bokningar på den egna vårdenheten och den som passar ordinationen först | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > ordinationen får sin tid från bokningen med ett klick, och sjuksköterskan ser när läkemedlet ges | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > ombokning och avbokning räknar om dosen utan att någon gör något, och sjuksköterskan får en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > utan bokning hamnar vårdhändelsen på väntelistan, och vårdadministratören bokar den som vanligt i Dagens arbete | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > den manuella tidsättningen finns kvar som reserv, slutar följa tidboken och sparas i historiken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > säkerhet: ordinera och vårdrelation på egen vårdenhet krävs, och inget sparas när kopplingen nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > säkerhet: spärrad vårdenhet och skyddad identitet läcker inte via förslagen eller väntelistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > när tiden avbokas sätter systemet upp vårdhändelsen på den ordinerande vårdenhetens väntelista igen, utan ny vårdrelation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > när ordinationen är utsatt eller tiden är satt för hand sätter avbokningen inte upp vårdhändelsen igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > när en remiss avvisas och tiden avbokas sätts vårdhändelsen inte upp igen, dosen säger varför och den ordinerande läkaren får en rad i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdhändelse i tidboken > raden om den avbokade vårdhändelsen försvinner när ordinationen sätts ut, och visar inte spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avvisad remiss med vårdhändelse > avvisningen som tar bort den sista vårdrelationen kräver ett beslut innan den sparas, och inget sparas utan det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avvisad remiss med vårdhändelse > Sätt ut: ordinationen sätts ut med orsaken som systemet föreslår, remissen avvisas och ingen rad hamnar i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avvisad remiss med vårdhändelse > Behåll finns bara när den ordinerande läkaren eller en annan vårdenhet har grund, och sätter då upp vårdhändelsen igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avvisad remiss med vårdhändelse > säkerhet: ett läkemedel som den som avvisar inte får se sätts inte ut, och vårdenhetens läkare får besked utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avvisad remiss med vårdhändelse > säkerhet: bara vårdenhetens läkare som remissen är ställd till kan förhandsvisa och avvisa, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Avvisa en remiss och sätta ut läkemedlet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Avbokad vårdhändelse utan grund > raden går till den ordinerande läkaren, annars till den medicinskt ansvariga läkaren och annars till alla läkare, och verksamhetschefen påminns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.8 Varning vid utsättning av läkemedel med särskilda observationer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Utsättning > utsättning av betablockerare ger varning och kräver bekräftelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning > utsättning utan särskilda observationer ger ingen varning, och antikoagulantia kräver en plan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning > utsättningsreglerna ligger i en egen modul och är märkta som demoregler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel med varning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Utsättning av antikoagulantia > utsättning av Waran kräver en plan, som sparas med utsättningen och syns i listan och i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning av antikoagulantia > vid byte föreslår systemet det nya antikoagulantia som redan är ordinerat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Utsättning av antikoagulantia > plan via API, och läkemedel utan antikoagulantia sätts ut utan plan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta ut Waran med plan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Återinsättning efter uppehåll > dagen före och på dagen får läkaren en rad i inkorgen med läkemedlet, planen och en knapp till läkemedelslistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återinsättning efter uppehåll > raden går till den ordinerande läkaren, den som beslutade om uppehållet och vårdenhetens läkare, aldrig till andra roller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återinsättning efter uppehåll > raden försvinner när läkemedlet är insatt igen eller ordinationen ändras, men inte av en bryggbehandling | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återinsättning efter uppehåll > säkerhet: bara patienter som användaren får se, och aldrig uppgifter från en spärrad vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Återinsättning i inkorgen via API > API: inkorgen visar raden med skyddad identitet maskerad, loggar åtkomsten och leder till läkemedelslistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta in Waran igen efter ett uppehåll inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Avslutad behandling efter uppehåll > läkaren avslutar behandlingen med en orsak som systemet föreslår, sparat i historiken och i FHIR, och raden försvinner för alla mottagare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Avslutad behandling efter uppehåll > säkerhet: bara en läkare som är mottagare och får se patienten, aldrig från en spärrad vårdenhet, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Avsluta behandlingen efter ett uppehåll inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.9 Vidimering av samlade pågående ordinationer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vidimering > vidimering visar ändringar sedan senaste vidimeringen och vidimeras med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vidimering > vidimering kräver läkare med vårdrelation och omfattar inte spärrade ordinationer, inte ens med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering via API > FHIR > MedicationAdministration med samma behörighet som läkemedelslistan, och List för vidimeringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Vidimera pågående ordinationer inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.10 Läkemedelsprocess

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > utsättning kräver orsak och inget raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > administreringar raderas inte och en given dos ändras inte (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ge en dos inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Uppföljning av läkemedel > en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Registrering i efterhand och makulering > en felaktig registrering makuleras med orsak och historik och raderas aldrig, och dosen blir att ge igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer för läkemedel > dosering över flera dygn räknas fram ur ordinationerna, med status för givna doser och trappschemats dos per dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vyer för läkemedel > läkemedelslistan har flaggor för filtrering och sortering: särskild observation och passerad uppföljning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning med kontroll och etikett > en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sammanslagning av journaler med beredning och skanning > en beredning och en skanning följer med när journalerna slås samman, och skyddet mot ändring gäller efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.11 Förskrivning

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Dosändring > dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > en ny dosering från ett senare datum gäller av sig själv när dagen kommer, också i Läkemedel att ge | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > säkerhet: dosändring kräver ordinationsrätt och vårdrelation, inte trappschema, och en spärrad enhets ordination röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > API: dosändring med loggning och FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra dosen i en pågående ordination inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.12 Ordination

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > uppföljningsdatum är obligatoriskt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > sjuksköterska kan inte ordinera | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ordinera ett läkemedel utan varning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Mallar med flera ordinationer > läkaren ordinerar ur en mall: systemet fyller i allt, varnar per ordination och tar själv bort ett läkemedel som patienten redan har | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Upp- och nedtrappning > systemet föreslår ett nedtrappningsschema för kortison och räknar dosen för varje dag i Läkemedel att ge | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Upp- och nedtrappning > upptrappning fortsätter med slutdosen, och en dos som inte går att ge med produkten förklaras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Muntlig ordination > sjuksköterskan dokumenterar en muntlig ordination med läkarens namn och tid, dosen får ges direkt och läkaren signerar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Muntlig ordination > säkerhet: läkaren ska vara på samma vårdenhet, orsaken till omedelbar behandling krävs och undersköterskan och läkaren dokumenterar inte muntligt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spädning och tillsatser > systemet räknar koncentration, volym och hastighet ur ordinationen och visar dem vid iordningsställandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrationssätt ur beredningsformen > ögondroppar, ögonsalva, nässpray och nebulisator får sitt administrationssätt, och ögondroppar sparas aldrig som peroralt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Doseringsmallar per produkt > Alvedon forte 1 g och paracetamol som infusion får egna förslag ur produkten, inte tablettdosen för 500 mg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > dosen ändras i den pågående ordinationen med historik, NLL och vidimering, och styrkan byts mot en ny förskrivning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > en ny dosering från ett senare datum gäller av sig själv när dagen kommer, också i Läkemedel att ge | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dosändring > säkerhet: dosändring kräver ordinationsrätt och vårdrelation, inte trappschema, och en spärrad enhets ordination röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Muntlig ordination i följd > läkaren och skälet föreslås från sjuksköterskans förra muntliga ordination, bara för samma patient och inom två timmar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra dosen i en pågående ordination inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Egenadministrering i slutenvården > en ordination som patienten sköter själv kommer inte med bland doserna att ge, och sjuksköterskan kvitterar intaget per dostid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Egenadministrering i slutenvården > systemet förklarar varför en blodprodukt, en infusion och narkotika inte kan skötas av patienten själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Doser i flytande form och gasform > syrgas ordineras i liter per minut med utrustning och mål för saturationen, och systemet stoppar ett flöde som utrustningen inte ger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.13 Ordinations- och utsättningsorsak

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > ordinationsorsak är obligatorisk | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > databasen vägrar ordination utan orsak (CHECK) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > utsättning kräver orsak och inget raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Sätta ut ett läkemedel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.14 Ordination inför planerad vårdhändelse

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Fördefinierade ordinationer > ordination till planerad vårdhändelse får administrationstid när händelsen tidsätts | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mallar med flera ordinationer > ordinationerna i mallen knyts till samma planerade vårdhändelse och en annan allvarlig varning kräver motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ordinera från en mall med flera ordinationer inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.2.15 Ordination enligt generella direktiv

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Generella direktiv > sjuksköterskan ser vårdenhetens direktiv prövade mot patienten, och systemet förklarar varför ett direktiv inte ryms | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Generella direktiv > sjuksköterskan ordinerar inom direktivet med bedömning, och antalet tillfällen utan läkarkontakt räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Generella direktiv > bara den medicinskt ansvariga läkaren fastställer och upphäver ett direktiv för sin vårdenhet, med det som 6 kap. 6 § kräver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsprocessen del 2 via API > API: mall, muntlig ordination, direktiv, makulering, utvärdering, fördjupad genomgång och dosering över flera dygn, med loggning och inkorg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ansvarsuppdrag för läkemedel > verksamhetschefen utser en medicinskt ansvarig läkare med ett år förifyllt, och det loggas och syns i säkerhetsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Generella direktiv på vårdgivarens nivå > den läkare som vårdgivaren har utsett fastställer ett direktiv som gäller alla vårdenheter, och andra får en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.17 Iordningsställande

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > iordningsställande med kontrollkod och sedan administrering av samma dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > varning: för tidig dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillsatser i infusion > glukos med Addex-Magnesium är en ordination med tillsats som kontrolleras, iordningsställs och ges tillsammans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning med kontroll och etikett > en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning med kontroll och etikett > beredningen följer ordinationen: fel lösning, gången förpackning och passerad hållbarhet stoppas med en förklaring, och en skannad förpackning fyller i batch och utgångsdatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Doser i flytande form och gasform > flytande dos: systemet räknar volymen i ml ur styrkan och visar den vid iordningsställandet, och en uppmätt volym som avviker varnar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Doser i flytande form och gasform > syrgas ordineras i liter per minut med utrustning och mål för saturationen, och systemet stoppar ett flöde som utrustningen inte ger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientnära skanning > etiketten och armbandet kontrolleras mot dosen, och ett armband eller en etikett för en annan patient stoppas utan att röja den andra patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning och skanning via API > API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.18 Administrering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Administrering > dagens lista räknas fram ur ordinationerna med tider, vid behov och utan fasta tider | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > ge en dos: med tid och den som gav den, knuten till vårdtillfällets vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > varning: dubbel dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > varning: för tidig dos | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > varning: given dos utan ordination | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > vid behov: varnar när högsta dygnsdosen är nådd och när doserna kommer för tätt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > registrering i efterhand med tidpunkt och den som utförde det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > permission: doser under permission lämnas över till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > nekas: nödåtkomst och aktivt val ger inte rätt att ge läkemedel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering > per avdelning visar bara patienter som användaren får se, med skyddad identitet maskerad och spärrade ordinationer dolda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering via API > Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ge en dos inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Läkare ger läkemedel > läkare får ge en dos med samma kontroller och loggning som sjuksköterskan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska med giltig delegering ger en tablett, och delegeringen syns i dosen och i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska: en dos som delegeringen inte omfattar nekas och förklaras, och knappen visas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > sjuksköterskan registrerar en dos som undersköterskan gav: delegeringen prövas för den som gav dosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska: utgången delegering, och ingen delegering alls, ger ingen rätt och förklaras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska: delegeringen gäller bara den vårdenhet den är utfärdad för | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > undersköterska: spärr och skyddad identitet gäller som för sjuksköterskan, också med delegering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > registrera delegering: sjuksköterska på samma vårdenhet, tidsbegränsad till högst ett år, med kontroll av kunskaperna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > registrera delegering: fel roll och fel vårdenhet nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > återkallad delegering ger ingen rätt, och återkallas bara en gång med orsak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering > påminnelse i inkorgen när en delegering går ut inom 30 dagar, bara på samma vårdenhet och borta efter förnyelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering via API > API: sjuksköterskan registrerar en delegering och ser påminnelsen i inkorgen, undersköterskan ger med den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering via API > API: undersköterska utan giltig delegering har inte behörigheten att ge läkemedel i sessionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dos som avviker från ordinationen > en annan dos än ordinationens varnar och måste kvitteras med motivering, allvarlig vid mer än dubbelt eller mindre än hälften | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Dos som avviker från ordinationen > en dos inom ordinationens intervall ("1 till 2 tabletter") varnar inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av delegering och dos > en delegering kan inte registreras flera år fram: från högst 30 dagar fram och till högst ett år efter beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av delegering och dos > påminnelsen räknas från beslutet som gäller i dag, och ett senare beslut tystar den bara om det tar vid utan glapp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av delegering och dos > avvikande dos räknas som dos gånger antal, så antal kringgår inte varningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av delegering och dos > administrationssättet ska passa läkemedelsformen, och delegeringens kategori bestäms av formen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsgranskning av delegering och dos > en delegering ska gälla både när en dos iordningsställs och för dostiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ge en dos med delegering inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera en delegering inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Delegering av läkare > läkaren registrerar och återkallar delegering på samma villkor som sjuksköterskan: samma vårdenhet, inte för sig själv och samma gränser för giltighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering av läkare > läkaren påminns bara om de delegeringar som läkaren själv har utfärdat, sjuksköterskan som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Delegering via API > API: läkaren registrerar en delegering under Delegeringar, och undersköterskan ger med den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrationssätt ur beredningsformen > ögondroppar, ögonsalva, nässpray och nebulisator får sitt administrationssätt, och ögondroppar sparas aldrig som peroralt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientnära skanning > etiketten och armbandet kontrolleras mot dosen, och ett armband eller en etikett för en annan patient stoppas utan att röja den andra patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientnära skanning > en etikett för en dos av en spärrad vårdenhets ordination behandlas som en okänd etikett | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beredning och skanning via API > API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.19 Automatgenererad administrering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik, infusionspump > en infusionspump rapporterar pågående dos, och systemet registrerar given dos med källan utrustning och kontrollerar den mot ordinationen och dygnsdosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik, infusionspump > pumparna i Läkemedel att ge visas bara för vårdenheten, och en pump kopplas bara till en aktiv infusion | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik, infusionspump > den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.20 Uppföljning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > uppföljningsdatum är obligatoriskt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljning av läkemedel > en passerad uppföljning hamnar i läkarens inkorg, och en utvärdering med beslut sätter nästa uppföljning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljning av läkemedel > uppföljningen på vårdenhetens nivå visar antal per läkemedel utan patientuppgifter, och bara för läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsprocessen del 2 via API > API: mall, muntlig ordination, direktiv, makulering, utvärdering, fördjupad genomgång och dosering över flera dygn, med loggning och inkorg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Uppföljning av läkemedel på vårdgivarens nivå > förskrivning, administrering och utvärdering per läkemedel över alla vårdenheter, utan personuppgifter och bara för uppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.2.21 Läkemedelsprocess och vätskebalans

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Fördefinierade ordinationer > fördefinierad ordination föreslår dos, administrationssätt och tider ur produkt och patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.3.1 Samlad funktionalitet för vätskebalans

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt > inre sekretess: vätskebalansen från en annan vårdenhet syns inte utan aktivt val, och en spärrad dos räknas aldrig in i prognosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalansen (runda 13, r4, E2-14 och E2-51) > en urinmätning har tid och period, och timmar utan registrering räknas inte som noll och ger ingen oliguri | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.3.2 Presentationsvyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.3.3 Framtida vätskebalans

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vätskebalans framåt > beredd volym, kalorier från nutrition, vikt, ackumulerad balans och förväntad balans de närmaste 24 timmarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans framåt i flera dygn > den förväntade vätskebalansen visas 24, 48 eller 72 timmar framåt, med ackumulerad mängd in och förlusterna för hela perioden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.4.1 Förskrivna förbrukningsartiklar i vyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > presentation: filtrering på grupp, sortering och uppföljning med vem och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > behörighet: undersköterskan och nödåtkomst förskriver inte, en annan vårdenhet ändrar inte, och en spärrad vårdenhets förskrivning röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.4.2 Förskrivning och ändring av förbrukningsartiklar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > kontroller: en dubbelförskrivning stoppas med förslag om förnyelse, en stor mängd kräver motivering och en artikel som inte passar listan ger en observation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > behörighet: undersköterskan och nödåtkomst förskriver inte, en annan vårdenhet ändrar inte, och en spärrad vårdenhets förskrivning röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > API: lista, mall, ändring, förnyelse, utsättning och återinsättning med loggning, och sjuksköterskan förskriver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.4.3 Presentationsvyer

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > presentation: filtrering på grupp, sortering och uppföljning med vem och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.5.4.4 Förbrukningsartiklar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Förbrukningsartiklar > mall för den som tar insulin med penna: systemet föreslår pennkanyler, teststickor, lansetter och kanylburk med mängd ur läkemedelslistan och tar bort det som redan är förskrivet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > kontroller: en dubbelförskrivning stoppas med förslag om förnyelse, en stor mängd kräver motivering och en artikel som inte passar listan ger en observation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förbrukningsartiklar > en förskrivning från en annan förskrivare registreras med vem och när, utan att skickas till NLL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Förskriva förbrukningsartiklar ur en mall inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.5.5.1 Klinisk prövning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Klinisk läkemedelsprövning > prövaren inkluderar en patient, systemet registrerar uppmärksamhetsinformationen och varnar vid ordination utanför studien och vid ett läkemedel som protokollet inte tillåter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Klinisk läkemedelsprövning > ett deltagande på en spärrad vårdenhet syns inte och ger ingen varning som röjer det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.6.1.1 Standardiserade gränssnitt mot medicinteknisk utrustning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > HL7 v2 ORU^R01 enligt IHE PCD-01 tas emot med MDC-koder och ger ett ACK | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > utan giltig nyckel avvisas meddelandet, och nyckeln sparas bara som HMAC och ersätts av en ny | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > värden utan gällande koppling avvisas, och efter att kopplingen avslutats tas inga fler emot | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > ett meddelande som anger en annan patient än kopplingen avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik, infusionspump > den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > ett meddelande i fel format nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.6.1.2 Presentation av data från medicinteknisk utrustning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Koppla en patientmonitor till patienten inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna värden från monitorn inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.6.1.3 Dokumentation av gränssnitt för egen utveckling och förvaltning

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitten för informationsutbyte > varje adressprefix som servern skickar vidare hör till ett gränssnitt i registret eller är internt med motivering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitten för informationsutbyte > varje rutt i API:t som tyder på informationsutbyte hör till ett gränssnitt i registret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitten för informationsutbyte > varje fil i src/rivta och varje fil som bygger SOAP eller RIV-TA hör till ett gränssnitt i registret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitten för informationsutbyte > varje adress, fil och dokument som registret nämner finns, och varje gränssnitt har ett avsnitt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitten för informationsutbyte > dokumentet räknar FHIR-resurserna och tjänstekontrakten ur koden och är skrivet ur registret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.6.1.4 Format och profiler

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > formaten och profilerna står i CapabilityStatement och på sidan Öppet API | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > ett meddelande i fel format nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > HL7 v2 ORU^R01 enligt IHE PCD-01 tas emot med MDC-koder och ger ett ACK | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 3.6.1.5 Spårbarhet och säkerhet

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > kopplingen görs genom att skanna utrustningens streckkod, armbandet kontrolleras mot patienten och varje koppling loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > värden utan gällande koppling avvisas, och efter att kopplingen avslutats tas inga fler emot | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > när utrustningen flyttas till en annan patient avslutas den förra kopplingen utan att den patienten röjs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > ett meddelande som anger en annan patient än kopplingen avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > fel roll och fel vårdenhet får inte koppla utrustning, och logggranskaren når inte utrustningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > utan giltig nyckel avvisas meddelandet, och nyckeln sparas bara som HMAC och ersätts av en ny | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Koppla en patientmonitor till patienten inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.6.1.6 Klassificering och visualisering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > bara behörig personal på vårdenheten godkänner, och ett bedömt värde kan inte bedömas igen eller ändras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > ett värde från utrustning på en spärrad vårdenhet syns inte och röjs inte i svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Godkänna värden från monitorn inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.6.1.7 Egenmätning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Medicinteknik > patienten registrerar egna mätningar i Min journal, och de skickas till vårdenheten som vårdar patienten märkta som inte kvalitetssäkrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > patientens egna mätningar visas skilda från vårdens värden och räknas inte i NEWS2, larm eller vikt förrän de är bedömda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > egna mätningar har ett tak per dygn, och fel typ eller värde förklaras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > bara behörig personal på vårdenheten godkänner, och ett bedömt värde kan inte bedömas igen eller ändras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Lämna en egen mätning i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.7.1.1 Olika former för kommunikation med invånare/patient/ombud

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patienten når sin egen journal men inte någon annans, oavsett id i adressen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > begäran om spärr ändrar inte spärren och registreras som begäran till vården | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > patienten skriver till vårdenheten, och systemet väljer vårdenhet och yrkesroll | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > vården läser i sin egen inloggning med vårdrelation, svarar och avslutar, och allt loggas på patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > listan visar ingen text, en annan vårdenhet och fel roll når inte meddelandet, och ord som tyder på något akut ger rådet att ringa 112 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > ombudet skriver för patienten och vårdnadshavaren för barnet, och vården ser vem som skrev | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > en begäran om spärr, om att häva en spärr och om loggutdrag handläggs av rätt roll och patienten får beskedet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > patienten ger fullmakt i Min journal, och ombudet bokar, bokar om och avbokar patientens tider med loggning på patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > ombudet når aldrig journalen, och en återkallad eller utgången fullmakt ger ingen åtkomst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > patientens logglista visar ombudets åtgärder som ombud, och vården ser vem som bokade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > meddelanden för ett ombud visar och tar aldrig emot läkemedel, vårdplaner eller vad en tråd gäller ur journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > trådar som gäller en ordination eller en vårdplan finns inte för ombudet, inte heller i räknare, läsmarkering och svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > en fullmakt i Min journal röjer aldrig vem ett personnummer tillhör, skyddad identitet registreras bara av personal, och försöken har ett tak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > en fullmakt från Min journal gäller först när ombudet har godkänt den, och svaret är detsamma för alla nummer som inte kan bli ombud | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ombud > registreringar och återkallelser har ett tak per dygn, ett ombud kan avböja och en skriftlig fullmakt hos vården gäller direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva ett meddelande till vården i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Svara på ett meddelande från en patient och avsluta inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 3.7.1.3 Övrigt stöd för partnerskap

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > spärrade uppgifter visas för patienten själv och spärren redovisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > begäran om spärr ändrar inte spärren och registreras som begäran till vården | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > vårdnadshavare läser barnets journal under 13 år men inte från 13 år eller för ett barn med skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tidbok > patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Patienten bokar om sin tid i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Egen vårdbegäran > invånaren beskriver sitt besvär, systemet föreslår vårdenhet och begäran hamnar som en remiss hos vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Egen vårdbegäran > vid tecken på akuta besvär hänvisar systemet till 112, och en invånare kan ha högst tre öppna vårdbegäranden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplanen i Min journal > patienten ser mål, åtgärder och uppföljningar och kommenterar, och kommentaren går till vårdenheten som har planen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplanen i Min journal > ombudet ser inte vårdplanen, och vårdnadshavaren ser barnets | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > patienten skriver till vårdenheten, och systemet väljer vårdenhet och yrkesroll | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > vården läser i sin egen inloggning med vårdrelation, svarar och avslutar, och allt loggas på patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > läkaren förnyar receptet och systemet skapar avgiften och svaret till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Meddelanden från invånare > en begäran om spärr, om att häva en spärr och om loggutdrag handläggs av rätt roll och patienten får beskedet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva ett meddelande till vården i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.1.1.1 Funktionalitet för tillväxtmonitorering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > kurvorna, analysen och larmet för barnet byggs av det användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt > mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för barnhälsovården > läkaren på barnavårdscentralen ser tillväxten och registrerar vikt och längd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för barnhälsovården > personal utan vårdrelation nekas, och sjuksköterskan på kardiologen har ingen barnhälsovård | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.1.1.2 Tillväxt baserad på referensmaterial

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > z-värden och referenslinjer räknas enligt WHO:s tabeller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt > korrigerad ålder för för tidigt födda till två år, och målängd ur föräldrarnas längd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Licens för tillväxtreferensen > WHO-tabellen har en egen licensfil och omfattas inte av EUPL | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > WHO:s referens 5 till 19 år räknas ur tabellen, och systemet väljer referens efter åldern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.1.1.3 Referensmaterial

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > z-värden och referenslinjer räknas enligt WHO:s tabeller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > WHO:s referens 5 till 19 år räknas ur tabellen, och systemet väljer referens efter åldern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.1.1.4 Inmatning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > mätvärdena vid ett besök registreras på en gång med samma vårdkontakt, och besöket i programmet blir gjort | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt > födelseuppgifter, föräldrarnas längd och händelser kontrolleras, och en ny uppgift ersätter den förra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk och FHIR för tillväxt > huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rapportering till Svenska barnhälsovårdsregistret > systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätningar hemma och Min journal > vårdnadshavaren registrerar en mätning som väntar tills barnavårdscentralen bekräftar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Barnhälsovårdens program > sjuksköterskor gör barnhälsovårdens flöde med ett uppdrag på barnavårdscentralen, och utan uppdrag nekas det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Tillväxt, version 1.1 > sitthöjd registreras med K11:s kod och visas som kurva utan referens, och K11:s koder är kontrollerade mot Snomed CT | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > pubertet registreras med de stadier som gäller barnets kön, och systemet räknar starten och varnar för tidig pubertet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > en pubertetsregistrering på en spärrad vårdenhet syns inte och ändrar inte bedömningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.1.1.5 Beräkningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > kurvorna, analysen och larmet för barnet byggs av det användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt > larmar när kurvor korsas, när huvudomfånget växer för snabbt, utanför två SD och för nyfödda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.1.1.6 Presentation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Tillväxt > kurvorna, analysen och larmet för barnet byggs av det användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mätningar hemma och Min journal > Min journal visar kurvorna och vaccinationerna utan larm, id eller personal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera längd och vikt vid ett BHV-besök och se kurvan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Tillväxt, version 1.1 > referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > sitthöjd registreras med K11:s kod och visas som kurva utan referens, och K11:s koder är kontrollerade mot Snomed CT | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > pubertet registreras med de stadier som gäller barnets kön, och systemet räknar starten och varnar för tidig pubertet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.1.1.7 Export och import

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rapportering till Svenska barnhälsovårdsregistret > systemet sammanställer barnets uppgifter med koderna i K11 och skickar till den simulerade mottagaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rapportering till Svenska barnhälsovårdsregistret > ett orimligt värde hålls kvar med en förklaring och en länk, och undantagen räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Licens för tillväxtreferensen > barn med skyddade personuppgifter undantas från registret enligt en konstant | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för barnhälsovården > FHIR: vaccinationerna är Immunization med ATC och dos, med samma behörighet och loggning, och invånaren ser dem utan personal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk och FHIR för tillväxt > huvudomfång har LOINC och vitalparameterprofilen, och K11:s koder finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > en fil förhandsgranskas innan något sparas, och en fil för en annan patient, orimliga värden och för stora filer avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > inläsningen sparar ursprunget som det var, och den som läser in står aldrig som den som mätte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > det simulerade journalsystemet svarar på GetObservations, och svaret granskas och läses in som en fil | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > GetObservations och GetActivities svarar med samma behörighet som FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Läsa in ett barns tillväxtdata från ett annat journalsystem inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.1.1.8 Uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rapportering till Svenska barnhälsovårdsregistret > en annan vårdenhet ser inget och en roll utan behörighet nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillväxt, version 1.1 > barnavårdscentralen väljer sina indikatorer, och regionen ser dem med varje liten cell spärrad för sig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.2.1.1 Funktionalitet för bildhantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > jämförelse över tid: bilder av samma kroppsställe ställs i tidsordning med dagarna mellan dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > en remissbilaga förs in i journalen med källan märkt, och en textbilaga stannar i remissen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > patientens uppladdning i Min journal går till en vårdenhet där patienten har kontakt och kommer in i journalen först efter granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > multimediaarkivet: undersökningen beställs med frågeställning, arkivet svarar med utlåtande och bildlänk, och bilden visas genom arkivet med behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > behörighet: en bild från en annan vårdenhet kräver aktivt val, en spärrad syns inte alls, och undersköterskan ser bara omvårdnadens bilder | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > taket: en patient har högst 40 bilder, en bild högst 1 MB och en film högst 2 MB i demon | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: patientens bild granskas bara av vårdenheten som den skickades till, inte av en annan vårdenhet med aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: en remissbilaga behåller avsändarens vårdenhet, så att en spärr gäller också i journalen, och patientens egen bilaga granskas först | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > annoteringar sparas som ett eget lager med författare, originalet ändras inte, och bara den som gjorde annoteringen tar bort den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för bilder och media 1.1 > bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Jämföra bilder av ett kroppsställe över tid inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.2.1.2 Bildhantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > jämförelse över tid: bilder av samma kroppsställe ställs i tidsordning med dagarna mellan dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > behörighet: en bild från en annan vårdenhet kräver aktivt val, en spärrad syns inte alls, och undersköterskan ser bara omvårdnadens bilder | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > taket: en patient har högst 40 bilder, en bild högst 1 MB och en film högst 2 MB i demon | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bildkodek > typen avgörs ur innehållet för bilder, filmer, ljud och PDF, och annat stöds inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bildkodek > filmens och ljudets längd och bildstorlek läses ur filen, med tak på antalet delar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bildkodek > EXIF ger tiden när bilden togs, kameran, orienteringen och om bilden bär platsuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bildkodek > servern gör miniatyren, vrider den efter EXIF och förstorar aldrig, och en bomb med för många pixlar avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bildkodek > servern ritar miniatyren för film, ljud och dokument, och ljudkurvan ur ett ljud i WAV | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > uppladdningen i delar har tak per person, patient och sandlåda, delar med fel storlek avvisas och en bild som inte går att avkoda kommer inte in | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > tiden när bilden togs och kameran läses ur EXIF, och platsuppgifter följer inte med till miniatyren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > annoteringar sparas som ett eget lager med författare, originalet ändras inte, och bara den som gjorde annoteringen tar bort den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > säkerhet: en annotering från en spärrad vårdenhet syns inte, och svaret är detsamma som utan den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för bilder och media 1.1 > bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Simulerat multimediaarkiv med DICOMweb > den renderade bilden är en PNG med fönstret, bilderna är desamma varje gång, och ett ogiltigt fönster avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Jämföra bilder av ett kroppsställe över tid inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Visa en röntgenstudie ur arkivet med ett annat fönster inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.2.1.3 Integration mot externt multimediaarkiv

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > multimediaarkivet: undersökningen beställs med frågeställning, arkivet svarar med utlåtande och bildlänk, och bilden visas genom arkivet med behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Simulerat multimediaarkiv med DICOMweb > en instans är en DICOM-fil i explicit VR little endian med patienten ur journalen och pixeldata i rätt storlek | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Simulerat multimediaarkiv med DICOMweb > en patient med skyddad identitet är skyddad också i DICOM tills identiteten har visats | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Simulerat multimediaarkiv med DICOMweb > DICOM JSON för sökning och metadata följer DICOMwebs format, och pixeldatan är en BulkDataURI | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Simulerat multimediaarkiv med DICOMweb > den renderade bilden är en PNG med fönstret, bilderna är desamma varje gång, och ett ogiltigt fönster avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > DICOMweb: QIDO-RS söker patientens studier, WADO-RS hämtar instansen som DICOM-fil och den renderade bilden med fönster, med behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > säkerhet: DICOMweb visar inte en studie på en spärrad vårdenhet, en patient utan åtkomst ger en tom lista, och en studie för en annan patient finns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > säkerhet: en sökning i DICOMweb på en patient utan åtkomst ger en tom lista och loggas som nekad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > demons mall har trycksårsbilderna och en besvarad lungröntgen för Gunnar Åkesson, men inte seeden som testerna bygger på | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för bilder och media 1.1 > bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Visa en röntgenstudie ur arkivet med ett annat fönster inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.2.1.4 Import av media

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Bilder och media > en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > en remissbilaga förs in i journalen med källan märkt, och en textbilaga stannar i remissen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > patientens uppladdning i Min journal går till en vårdenhet där patienten har kontakt och kommer in i journalen först efter granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: patientens bild granskas bara av vårdenheten som den skickades till, inte av en annan vårdenhet med aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: en remissbilaga behåller avsändarens vårdenhet, så att en spärr gäller också i journalen, och patientens egen bilaga granskas först | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media > säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bildkodek > typen avgörs ur innehållet för bilder, filmer, ljud och PDF, och annat stöds inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > tiden när bilden togs och kameran läses ur EXIF, och platsuppgifter följer inte med till miniatyren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > en bild från en medicinteknisk apparat väntar på granskning med apparatens serienummer, och en bild som enligt apparaten gäller en annan patient kan inte föras in | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > bilder från en annan vårdgivare hämtas bara med patientens samtycke, behåller sitt ursprung och kommer in i journalen efter granskning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > säkerhet: bilder från en annan vårdgivare kräver ett aktivt val med syfte i sessionen för samma person och patient, som sammanhållen journalföring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Bilder och media 1.1 > säkerhet: granskningen kräver skrivrätten för bildens kategori, så en roll med bara omvårdnadens skrivrätt för inte in en bild i journalens kategori | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för bilder och media 1.1 > bilder 1.1: sjuksköterskan hämtar från apparaten och granskar, och läkaren hämtar bilder från en annan vårdgivare med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Lägga in en bild från datorn i journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Hämta en bild från en apparat och föra in den i journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.3.1.1 Funktionalitet för SIP och SPU

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Samordnad planering > systemet föreslår SPU och skickar inskrivningsmeddelandet med lagens uppgifter till kommunen och vårdcentralen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > utskrivningsklar: underrättelsen går ut, kallelsen ska ske inom tre dagar och betalningsansvaret räknas med villkoren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > skyddad identitet: ingen adress skickas och kommunen ser inte namnet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > kommunen får aldrig adress, namn eller personnummer för en patient med skyddad identitet, inte heller när skyddet tillkommer efter inskrivningsmeddelandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.3.1.2 Funktionalitet för SIP och SPU

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Samordnad planering > vårdcentralen utser fast vårdkontakt och kallar till samordnad individuell planering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > informationen förs över när patienten skrivs ut, och en spärrad vårdenhets planering syns inte för andra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > skyddad identitet: ingen adress skickas och kommunen ser inte namnet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > kommunen får aldrig adress, namn eller personnummer för en patient med skyddad identitet, inte heller när skyddet tillkommer efter inskrivningsmeddelandet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.3.1.3 Uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Samordnad planering > uppföljningen av SIP och SPU räknar per vårdenhet utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.1.1 Patient- och provbunden elektronisk beställning och svar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för beställning och svar > läkaren beställer, sjuksköterskan tar proverna, demoknappen ger svaret och läkaren vidimerar från inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > nycklar som constructor, __proto__ och toString är aldrig analyser, paket, laboratorier, kontroller eller frekvenser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 4.4.1.2 Flera utförande laboratorier inom samma disciplin

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > klinisk kemi har flera utförande laboratorier, och systemet väljer det som hör till sjukhuset | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.1.3 Unikt beställnings-ID

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.1.4 Tolkningssäkerhet i beställning och svar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > katalogen: varje analys har rör och disciplin, varje labbvärde har NPU-kod och varje paket har kända analyser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > labbvärden har NPU-kod och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.1.5 Swedacs ackrediteringsföreskrifter

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättade svar > ett rättat svar ersätter mätvärdet, den tidigare versionen finns kvar oförändrad och svaret vidimeras på nytt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättade svar > producentsystemet skickar ett rättat svar med status corrected, och varje version har ett signerat bevis som stämmer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientnära analyser > instrumentets svar med fel etikett avvisas, och svaret bockar av kontrollen av samma mätvärde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för beställning och svar > vad som förs över till det mottagande systemet, etikettskrivarna och anvisningarna ändras med fyra ögon och slår igenom | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Koder i svar > koder i svaret från ett specialistsystem: KVÅ, Snomed CT och vårdförlopp tas emot med text, och en kod i fel form avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.1 Följa beställnings- och svarsprocessen

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för beställning och svar > läkaren beställer, sjuksköterskan tar proverna, demoknappen ger svaret och läkaren vidimerar från inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.2 Visa alla planerade prover och undersökningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR för beställning och svar > samma behörighet som i gränssnittet: en annan vårdenhets beställning kräver aktivt val och en spärrad syns inte alls | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontroller till avdelningen > de planerade uppgifterna per vårdenhet och dag har formatet i docs/design.md och visar bara det som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontroller till avdelningen > kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > planerat: patientens alla planerade prover, undersökningar och kontroller från alla vårdenheter som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > en beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma beställnings-id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för undersökningar > läkaren beställer röntgen med frågan om graviditet, röntgensjuksköterskan bokar och registrerar, och Min journal visar statusen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.3 Överlåta ansvar till annan remittent

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ansvaret överlåts till en annan läkare, som får svaren att vidimera, men bara om läkaren har vårdrelation till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för beställning och svar > en spärrad beställning som har överlåtits till en annan vårdenhets läkare röjs inte i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.4 Avvikelser från svar visas

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.5 Presentationsvy

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > beställningarna följer med när två journaler slås samman, så att allt för patienten visas samlat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > en beställning trots dubblettvarning sparar bara analysnamnen, så att historiken inte röjer ett svar som en kollega inte får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Status i Min journal > patienten ser beställningarnas status, bokad tid och förberedelse, och svaret först när det är vidimerat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Status i Min journal > en vårdenhet vars anteckningar inte visas i Min journal visar inte heller sina beställningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättade svar > den som läste den tidigare versionen får det rättade svaret i inkorgen, och ingen annan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.6 Beställning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Underlag i beställning och svar > underlag bifogas till beställningen, typen avgörs ur innehållet, med tak per fil och beställning, och visas med beställningens behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > upprepad beställning: en serie beställningar med rätt tider, utan dubblettvarning för de egna delarna och högst 60 dagar framåt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > jodkontrast: utan aktuellt eGFR lägger systemet till P-Kreatinin, och röntgen bokar först när svaret har kommit | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > jodkontrast: eGFR under 30 stoppar, 30 till 44 kräver kvittens, och ett värde på en spärrad vårdenhet varken räknas eller nämns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > graviditet: systemet frågar bara kvinnor 12 till 55 år före strålning, stoppar strålning mot buken och tar en registrerad graviditet som ja | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > magnetkamera: implantat i uppmärksamhetsinformationen eller enligt beställaren kräver MR-säkerhetskontroll innan röntgen bokar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Beställa en röntgenundersökning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > ett prov som nyss är taget eller redan är beställt tas bort ur paketet med en förklaring, och en ny beställning kräver kvittens | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > dubblettvarningen räknas bara på det läkaren får se: en dold rad på en spärrad enhet ändrar inget i svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > provtagningsanvisningen har rören i provtagningsordning och förberedelserna för patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > sjuksköterskan och undersköterskan beställer på uppdrag av en läkare på vårdenheten, som signerar i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > signeringen prövar behörigheten först och nämner inte den ansvariga läkaren för den som inte får se beställningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Beställa ett standardpaket med prover inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera provtagning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |

### 4.4.2.7 Planerade beställningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontroller till avdelningen > de planerade uppgifterna per vårdenhet och dag har formatet i docs/design.md och visar bara det som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontroller till avdelningen > kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för kontroller och planerade uppgifter > läkaren ordinerar kontroller och sjuksköterskan hämtar avdelningens planerade uppgifter, och varje patient loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för beställning och svar > provtagningslistan visar vårdenhetens prover att ta, med skyddad identitet maskerad, och loggar varje patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > planerat: patientens alla planerade prover, undersökningar och kontroller från alla vårdenheter som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > röntgenklinikens arbetslista: prioritet och senaste dag, föreslagen tid, bokning, utförande med studie i arkivet och loggning med grunden utförande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > upprepad beställning: en serie beställningar med rätt tider, utan dubblettvarning för de egna delarna och högst 60 dagar framåt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Boka en inkommen undersökning på röntgenkliniken inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.4.2.8 Flera beställningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > en beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma beställnings-id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > jodkontrast: utan aktuellt eGFR lägger systemet till P-Kreatinin, och röntgen bokar först när svaret har kommit | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > standardiserat vårdförlopp föreslås ur vårdkontakten och följer med i beställningen, svaret och till producentsystemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.9 Justering av beställning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > makulering kräver orsak och går inte efter svar, och en analys tas bort eller läggs till innan röret är taget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > beställningen kan följas från upprättande till avslut med vem och när för varje steg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.10 Överlåtelse

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > ansvaret överlåts till en annan läkare, som får svaren att vidimera, men bara om läkaren har vårdrelation till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för beställning och svar > en spärrad beställning som har överlåtits till en annan vårdenhets läkare röjs inte i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.11 Kodverk

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR för beställning och svar > varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > katalogen: varje analys har rör och disciplin, varje labbvärde har NPU-kod och varje paket har kända analyser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Koder i svar > koder i svaret från ett specialistsystem: KVÅ, Snomed CT och vårdförlopp tas emot med text, och en kod i fel form avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > utlåtandet har KVÅ, fynd i Snomed CT, vårdförloppet och studiens id, och den ansvariga läkaren vidimerar det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > standardiserat vårdförlopp föreslås ur vårdkontakten och följer med i beställningen, svaret och till producentsystemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Underlag i beställning och svar > underlag i svaret från producentsystemet (presentedForm) sparas och visas i beställningen och i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.12 Blodprodukter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Blodprodukter > blodgruppering och bastest beställs till blodcentralen som prover och besvaras med blodgrupp och antikroppsscreening | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > beställningen av blod beställer själv blodgruppering och bastest som saknas och väntar på svaren innan blodcentralen bereder | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > blodcentralen förenlighetsprövar och bereder enheter med patientens blodgrupp, och beställningen kan följas från upprättad till avslutad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > vid sängen kontrollerar systemet id-bandet, enhetsnumret, blodgruppen och den andra personen, och blod som inte startats inom 30 minuter återlämnas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > dubbelkontrollen vid sängen: den andra personen bekräftar i sin egen session, den som förberedde kan inte kontrollera själv och ett id i anropet räcker inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > säkerhet: en blodbeställning eller enhet för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > förenligheten: erytrocyter efter AB0 och RhD, plasma åt andra hållet och trombocyter AB0-lika | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > ett positivt bastest stoppar beställningen hos blodcentralen med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter > behörighet: sjuksköterskan beställer inte blod, en annan vårdenhet hanterar inte blodet och en spärrad beställning syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > blod: läkaren beställer, proverna besvaras och sjuksköterskan och läkaren kontrollerar vid sängen i var sin inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 > transfusionen blir en ordination och en administrering i läkemedelslistan, med enhetsnumret och de två som kontrollerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 > en blodprodukt i läkemedelslistan ges bara från blodbeställningen, aldrig med en vanlig administrering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 > kontrollen vid sängen går genom den gemensamma transfusionskontrollen: ett bastest som har gått ut sedan blodet bereddes stoppar transfusionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 > hemovigilans: en transfusionsreaktion är en egen rapport som systemet klassar, transfusionen stoppas och proverna beställs med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 > säkerhet: en reaktion eller dess prover för en annan patient eller vårdenhet ges inte, och en spärrad reaktion syns inte i blodcentralens vy | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 > blodcentralens vy visar vårdenhetens beställningar i kedjan, enheterna på avdelningen och lagret per blodgrupp, och varje patient loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Blodprodukter i version 1.1 via API > API: blodcentralens vy, journalens markering och reaktionen rapporteras med proverna i två anrop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Beställa blod inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.4.2.13 Svar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Rättade svar > ett rättat svar ersätter mätvärdet, den tidigare versionen finns kvar oförändrad och svaret vidimeras på nytt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättade svar > den som läste den tidigare versionen får det rättade svaret i inkorgen, och ingen annan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättade svar > producentsystemet skickar ett rättat svar med status corrected, och varje version har ett signerat bevis som stämmer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Rättade svar > demoknappen för ett rättat svar kräver beställningsrätt på den beställande vårdenheten och gäller inte anslutna producentsystem eller instrument | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Underlag i beställning och svar > underlag i svaret från producentsystemet (presentedForm) sparas och visas i beställningen och i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undersökningar i beställning och svar > utlåtandet har KVÅ, fynd i Snomed CT, vårdförloppet och studiens id, och den ansvariga läkaren vidimerar det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > ett mätvärde som är undantaget från visning visas inte som svar i beställningen eller i inkorgen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.14 Patientnära analyser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontroller till avdelningen > läkaren ordinerar puls, blodtryck, SR, temperatur, vikt och vätskebalans till i morgon klockan 7, och systemet lägger dem på avdelningen där patienten ligger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontroller till avdelningen > kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Patientnära analyser > en patientnära analys beställs, provet tas och instrumentet skickar svaret genom det öppna gränssnittet med etiketten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientnära analyser > instrumentets svar med fel etikett avvisas, och svaret bockar av kontrollen av samma mätvärde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.2.15 Uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.3.1 Skapa och skriva ut provtagningsetiketter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Streckkod och etikett > etiketterna som PDF: en sida per etikett för etikettskrivaren och ett A4-ark för en vanlig skrivare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Streckkod och etikett > Code 128 B: varje mönster är 11 moduler, kontrollsiffran räknas enligt standarden och stoppkoden avslutar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.4.3.2 Utskrift etikett

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Beställning och svar > etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Streckkod och etikett > etiketterna som PDF: en sida per etikett för etikettskrivaren och ett A4-ark för en vanlig skrivare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Streckkod och etikett > Code 128 B: varje mönster är 11 moduler, kontrollsiffran räknas enligt standarden och stoppkoden avslutar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.5.1.1 Funktionalitet för operationsplanering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > läkaren anmäler till operation med ingrepp och sida, och systemet sätter KVÅ, operationstid, anestesi och målet för väntetiden ur prioriteten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > förberedelserna: systemet listar proverna som saknas, med blodgruppering och bastest vid risk för blödning, och beställer dem med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > väntelistan för operation står i ordning efter målet för väntetiden och visar bara patienter som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > systemet föreslår första lediga tid i en sal på sjukhuset med operatör och operationssjuksköterska, och nekar en dubbelbokning av sal eller team | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > planeringen skriver kallelsen med förberedelserna, och en struken operation får orsak och står kvar på väntelistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > under operationen sätter systemet tiderna i ordning, och WHO:s checklista måste vara klar före anestesi, snitt och utflyttning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > ingreppet registreras som åtgärd med KVÅ när operationen är slut, och implantatet med lot krävs innan patienten lämnar salen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > uppvakningen prövar kriterierna för utskrivning mot kontrollerna och förklarar vad som saknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > utskrivningen från uppvakningen skriver överrapporteringen och ordinerar de postoperativa kontrollerna till avdelningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > uppföljningen räknar väntetider, strukna operationer, salsutnyttjande och produktion per ingrepp utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > behörighet: undersköterskan läser men anmäler inte, och en spärrad vårdenhets operation syns inte i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > salsblocken fördelar salarna mellan vårdenheterna, också på andra sjukhus, och ett block kan släppas och tas av en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > ett block som vårdenheten inte har fyllt släpps för andra vårdenheter på sjukhuset två dagar före | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > teamet planeras med anestesiläkare och anestesisjuksköterska, och utrustning och instrumentgaller bokas och prövas mot krockar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > vårdhändelser som kan påverka ett planerat ingrepp visas med anmälan, och bara det som den inloggade får se räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > sessionen säger om vårdenheten opererar, och dagens program räknar ut när nästa operation kan börja när en operation drar ut på tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > uppföljningen räknar inflöde, utrustning, punktlighet och tid på uppvakningen, och datauttaget har operationerna utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > säkerhet och behörighet: anestesijournalen, sterilgodset och materialet ger 404 för en annan patient, ändras bara av den anmälande vårdenheten och syns inte bakom en spärr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Planera en operation från väntelistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Registrera att patienten kommer in på salen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.5.1.2 Preoperativ fas

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > läkaren anmäler till operation med ingrepp och sida, och systemet sätter KVÅ, operationstid, anestesi och målet för väntetiden ur prioriteten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > förberedelserna: systemet listar proverna som saknas, med blodgruppering och bastest vid risk för blödning, och beställer dem med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > väntelistan för operation står i ordning efter målet för väntetiden och visar bara patienter som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > systemet föreslår första lediga tid i en sal på sjukhuset med operatör och operationssjuksköterska, och nekar en dubbelbokning av sal eller team | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > planeringen skriver kallelsen med förberedelserna, och en struken operation får orsak och står kvar på väntelistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > behörighet: undersköterskan läser men anmäler inte, och en spärrad vårdenhets operation syns inte i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > salsblocken fördelar salarna mellan vårdenheterna, också på andra sjukhus, och ett block kan släppas och tas av en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > ett block som vårdenheten inte har fyllt släpps för andra vårdenheter på sjukhuset två dagar före | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > teamet planeras med anestesiläkare och anestesisjuksköterska, och utrustning och instrumentgaller bokas och prövas mot krockar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > vårdhändelser som kan påverka ett planerat ingrepp visas med anmälan, och bara det som den inloggade får se räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Planera en operation från väntelistan inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arbetsdagen på mottagningarna (runda 13, r4) > operationsprogrammet: mitt på förmiddagen är den första operationen gjord eller pågår och den andra väntar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anestesiläkaren (runda 13, r4, E1-32) > ser de operationer som är beställda till anestesienheten i programmet, och inte andra sjukhus operationer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Anestesiläkaren, säkerhetsgranskningen (runda 13, r4) > en avslutad operation (klar) visas inte för anestesienheten i programmet, bara som upptagen tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.5.1.3 Perioperativ fas

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > under operationen sätter systemet tiderna i ordning, och WHO:s checklista måste vara klar före anestesi, snitt och utflyttning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > ingreppet registreras som åtgärd med KVÅ när operationen är slut, och implantatet med lot krävs innan patienten lämnar salen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > sessionen säger om vårdenheten opererar, och dagens program räknar ut när nästa operation kan börja när en operation drar ut på tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > säkerhet och behörighet: anestesijournalen, sterilgodset och materialet ger 404 för en annan patient, ändras bara av den anmälande vårdenheten och syns inte bakom en spärr | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera att patienten kommer in på salen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.5.1.4 Postoperativ fas

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > uppvakningen prövar kriterierna för utskrivning mot kontrollerna och förklarar vad som saknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > utskrivningen från uppvakningen skriver överrapporteringen och ordinerar de postoperativa kontrollerna till avdelningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operationsplanering > säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.5.1.5 Uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Operationsplanering > uppföljningen räknar väntetider, strukna operationer, salsutnyttjande och produktion per ingrepp utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > uppföljningen räknar inflöde, utrustning, punktlighet och tid på uppvakningen, och datauttaget har operationerna utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.1 Funktionalitet för anestesi och intensivvård

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > översikten visar alla patienter på intensivvårdsavdelningen med senaste värden, larm, utrustning och vätskebalans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > anestesibedömningen hämtar läkemedel, överkänslighet, diagnoser och tidigare anestesier ur journalen och föreslår ASA-klass och fasta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > läkaren sätter patientens egna gränser, servern prövar typ och gräns, och en ny regel avslutar den förra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > läkaren sätter mål för vätska, energi och vikt, och systemet visar aktuellt underskott och rekommendationer, också för elektrolyterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > NEMS föreslås ur journalen med orsak för varje post, sjuksköterskan bekräftar, och servern räknar poängen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > nyheterna i version 1.1 för intensivvården och tillväxten visas för rätt roller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.2 Översikt och övervakning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > översikten visar alla patienter på intensivvårdsavdelningen med senaste värden, larm, utrustning och vätskebalans | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik, infusionspump > den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik > värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Öppna intensivvårdens översikt och övervakningen av en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Intensivvård, version 1.1 > realtidsvisningen har vågformer som följer pulsen, blodtrycket och andningen, och samma tid ger samma kurva | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.3 Analys och beslut

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > parametrarna för analysen finns i konfigurationen med samma standardvärden som modulen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > patientens egen gräns prövas i analysen, och en mildare gräns gör avdelningens larm till en observation i stället för att tysta det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > läkaren sätter patientens egna gränser, servern prövar typ och gräns, och en ny regel avslutar den förra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > överrapporteringen röjer varken orsak eller tid för en vårdkontakt på en spärrad vårdenhet eller på en annan vårdenhet utan aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.4 Anestesibedömning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > anestesibedömningen hämtar läkemedel, överkänslighet, diagnoser och tidigare anestesier ur journalen och föreslår ASA-klass och fasta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > anestesibedömningen räknar bara det som läkaren får se, så en spärrad vårdenhets diagnoser röjs inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesi och material > anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1 > identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > säkerhet: en spärr mot den opererande vårdenheten gäller också anestesienheten, i listan, i läsning och i ändring, och samtycke öppnar som vanligt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Operation 1.1, anestesienheten > säkerhet: en anestesienhet eller en enhet som inte opererar kan inte skapa sin egen vårdrelation, och relationen upphör när anmälan avbokas eller operationsdagen har passerat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.5 Utökat stöd för läkemedelshantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > en infusion ordineras inte utan godkänd vikt, och en vikt som patienten själv har mätt räknas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Medicinteknik, infusionspump > en infusionspump rapporterar pågående dos, och systemet registrerar given dos med källan utrustning och kontrollerar den mot ordinationen och dygnsdosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > infusionerna har en sammanräkning av givna doser det senaste dygnet och sedan starten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > noradrenalin ordineras i µg/kg/min och titreras mot målet för medelartärtrycket, patientens eget mål när läkaren har satt ett | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > propofol och midazolam ordineras med dosintervall utan automatisk titrering, och utdelningen visar varje dos med tid, vem och ml/h | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > en dosändring prövar armbandet mot patientens identitet, och ett armband som inte hör till patienten nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > utdelningen röjer varken grund eller namn för en titrering på en spärrad vårdenhet, men dosen räknas med i summan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.6 Utökat stöd för vätskebalans

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård > infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vätskebalans > vätskebalansen räknar in administrerad volym av sig själv | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spädning och tillsatser > en infusion med tillsats kontrolleras per liter och per timme, och volymen räknas in i vätskebalansen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Registrering i efterhand och makulering > ett iordningsställande och en vätskebalans registreras i efterhand med tiden då det gjordes, och en vätskepost makuleras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > perspiratio räknas ur vikten, febern och andningsstödet, och dygnsbrytningen kl. 06 följer svensk tid också vid omställningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > läkaren sätter mål för vätska, energi och vikt, och systemet visar aktuellt underskott och rekommendationer, också för elektrolyterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.6.1.7 Uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Intensivvård, version 1.1 > NEMS föreslås ur journalen med orsak för varje post, sjuksköterskan bekräftar, och servern räknar poängen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Registrera vårdtyngden enligt NEMS för en patient på intensivvården inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Intensivvård, version 1.1 > en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.7.1.1 Funktionalitet för mödrahälsovård, graviditet och förlossning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > graviditetsjournalen: systemet räknar beräknad partus ur sista mens och väljer ultraljudet när det skiljer mer än sju dagar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > besöksprogrammet och provschemat räknas ur graviditetsveckan, och systemet beställer proverna vid nästa besök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, och flerbörd ger tätare besök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > vid besöket varnar systemet för förhöjt blodtryck med protein i urinen, avvikande symfys-fundusmått och fosterljud, och blodtrycket blir ett mätvärde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > partogrammet: systemet räknar varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > vid tvillingfödsel får varje barn en egen journal med reservnummer kopplad till modern, och födelseuppgifterna förs vidare till barnhälsovården | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > behörighet: undersköterskan för inte graviditetsjournalen, och en graviditet på en spärrad vårdenhet syns inte för förlossningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > IVF-graviditeten: beräknad partus räknas från embryoöverföringen, ultraljudet ändrar den inte och IVF ingår i riskbedömningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > ultraljudsjournalen: ett ultraljud till vecka 22 daterar graviditeten, och tillväxtultraljudet jämför den skattade vikten och varnar för liten för tiden och viktskillnad mellan tvillingar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > inskrivningssamtalet: levnadsvanorna blir en signerad anteckning, och tobak och anamnes ger råd och beslutsstöd för graviditetsdiabetes och havandeskapsförgiftning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > frågorna om våld: svaren lämnas aldrig ut i graviditetsjournalen, uppföljningen eller registret och läses bara på den vårdenhet som ställde dem, med logg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > frågorna om våld ställs bara när kvinnan är ensam, och annars påminner systemet vid nästa besök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > CTG från simulerad utrustning: systemet klassar kurvan som normal, avvikande eller patologisk, och barnmorskan bekräftar eller motiverar en annan bedömning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > CTG vid tvillingar har en kanal och en analys per foster | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > smärtlindring: före EDA kontrollerar systemet trombocyterna bland det som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > födelseanmälan till Skatteverket (simulerad): barnet får ett av Skatteverkets testpersonnummer i stället för reservnumret, och en mor utan personnummer får förklaringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > BB-journalen: systemet räknar viktnedgången, varnar för feber och blödning, säger när PKU tas och prövar utskrivningskriterierna för mor och barn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > uppföljningen räknar inskrivning, ultraljud, smärtlindring, CTG, födelseanmälan och efterkontroll utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > API: barnmorskan på förlossningen kopplar CTG, bedömer, registrerar smärtlindring, födelse, födelseanmälan och BB i gränssnittets anrop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > datauttaget har tabellerna Graviditet och Forlossning utan personuppgifter och utan svaren om våld | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter visas utan namn och personnummer i förlossningen, BB och födelseanmälan, och ett barn utan åtkomst syns inte i moderns vy | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > samtycke: svaren om våld visas för en annan enhet bara med kvinnans samtycke, som bara den enhet som ställde frågorna ger och återkallar, och ett återkallat eller utgånget samtycke stänger direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > Min journal: graviditeten visas med besöksprogram, beräknad partus, ultraljud och provsvar efter visningsreglerna, och svaren om våld och samtycket syns aldrig, inte heller för ombud eller i loggutdraget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > demopatienterna läggs in av sig själva första gången barnmorskan på förlossningen loggar in i en sandlåda, och bara en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.7.1.2 Mödrahälsovård och handläggning under graviditet

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > graviditetsjournalen: systemet räknar beräknad partus ur sista mens och väljer ultraljudet när det skiljer mer än sju dagar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > besöksprogrammet och provschemat räknas ur graviditetsveckan, och systemet beställer proverna vid nästa besök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, och flerbörd ger tätare besök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > vid besöket varnar systemet för förhöjt blodtryck med protein i urinen, avvikande symfys-fundusmått och fosterljud, och blodtrycket blir ett mätvärde | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > behörighet: undersköterskan för inte graviditetsjournalen, och en graviditet på en spärrad vårdenhet syns inte för förlossningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > IVF-graviditeten: beräknad partus räknas från embryoöverföringen, ultraljudet ändrar den inte och IVF ingår i riskbedömningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > ultraljudsjournalen: ett ultraljud till vecka 22 daterar graviditeten, och tillväxtultraljudet jämför den skattade vikten och varnar för liten för tiden och viktskillnad mellan tvillingar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > inskrivningssamtalet: levnadsvanorna blir en signerad anteckning, och tobak och anamnes ger råd och beslutsstöd för graviditetsdiabetes och havandeskapsförgiftning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > frågorna om våld: svaren lämnas aldrig ut i graviditetsjournalen, uppföljningen eller registret och läses bara på den vårdenhet som ställde dem, med logg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > frågorna om våld ställs bara när kvinnan är ensam, och annars påminner systemet vid nästa besök | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter visas utan namn och personnummer i förlossningen, BB och födelseanmälan, och ett barn utan åtkomst syns inte i moderns vy | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > samtycke: svaren om våld visas för en annan enhet bara med kvinnans samtycke, som bara den enhet som ställde frågorna ger och återkallar, och ett återkallat eller utgånget samtycke stänger direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > Min journal: graviditeten visas med besöksprogram, beräknad partus, ultraljud och provsvar efter visningsreglerna, och svaren om våld och samtycket syns aldrig, inte heller för ombud eller i loggutdraget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.7.1.3 Handläggning vid förlossning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > partogrammet: systemet räknar varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > vid tvillingfödsel får varje barn en egen journal med reservnummer kopplad till modern, och födelseuppgifterna förs vidare till barnhälsovården | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet och förlossning > säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > CTG från simulerad utrustning: systemet klassar kurvan som normal, avvikande eller patologisk, och barnmorskan bekräftar eller motiverar en annan bedömning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > CTG vid tvillingar har en kanal och en analys per foster | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > smärtlindring: före EDA kontrollerar systemet trombocyterna bland det som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > födelseanmälan till Skatteverket (simulerad): barnet får ett av Skatteverkets testpersonnummer i stället för reservnumret, och en mor utan personnummer får förklaringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > BB-journalen: systemet räknar viktnedgången, varnar för feber och blödning, säger när PKU tas och prövar utskrivningskriterierna för mor och barn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > API: barnmorskan på förlossningen kopplar CTG, bedömer, registrerar smärtlindring, födelse, födelseanmälan och BB i gränssnittets anrop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > säkerhet: ett barn med skyddade personuppgifter visas utan namn och personnummer i förlossningen, BB och födelseanmälan, och ett barn utan åtkomst syns inte i moderns vy | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > samtycke: svaren om våld visas för en annan enhet bara med kvinnans samtycke, som bara den enhet som ställde frågorna ger och återkallar, och ett återkallat eller utgånget samtycke stänger direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > demopatienterna läggs in av sig själva första gången barnmorskan på förlossningen loggar in i en sandlåda, och bara en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.7.1.4 Planering och uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Graviditet och förlossning > planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > uppföljningen räknar inskrivning, ultraljud, smärtlindring, CTG, födelseanmälan och efterkontroll utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > datauttaget har tabellerna Graviditet och Forlossning utan personuppgifter och utan svaren om våld | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Graviditet, förlossning och BB > Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 4.8.1.1 Ordination av cytostatika

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > ordination ur behandlingsregim: systemet hämtar längd och vikt, räknar kroppsytan och varje dos och lägger ut cyklerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > karboplatin doseras med Calverts formel ur njurfunktionen som systemet räknar med Cockcroft-Gault | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > före kuren prövar systemet provsvaren mot regimens gränser, beställer det som saknas och låter läkaren skjuta upp cykeln | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > dosjustering: läkaren väljer andel av full dos med orsak, och systemet räknar om doserna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > regimbiblioteket: en ändrad regim är en ny version som en regimansvarig läkare godkänner i sin egen inloggning, och nya ordinationer får den godkända versionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kumulativ dos: systemet räknar den kumulativa antracyklindosen per kvadratmeter och stoppar kuren som skulle passera gränsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kumulativ dos följer läkemedelslistan: en kur på en annan vårdenhet räknas utan aktivt val, en spärrad vårdenhet som i läkemedelslistan, och utan svar om tidigare behandling stoppar systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en cytostatikakur inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en ny version av en cytostatikaregim inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.8.1.2 Beredning av cytostatika

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > beredningsordern till beredningsenheten har volym ur stamlösningen, bärarlösning, total volym och etikett med streckkod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > beredningsenheten: arbetslistan visar de godkända kurerna med beräkning och föreslagen batch, och beredningen signeras med batch och kontrollmätt volym | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > lagret: batcher tas emot, utgångna kasseras och systemet säger om lagret räcker till de planerade kurerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > säkerhet: beredningsenheten ser bara beställningen och aldrig journalen, en farmaceut på en vårdenhet bereder inte, och varje patient i arbetslistan loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Bereda en cytostatikados på beredningsenheten inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.8.1.3 Iordningställande och administrering av cytostatika

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > vid sängen kontrollerar systemet id-band, etikett och att läkemedlen ges i regimens ordning, och nästa cykel räknas om efter vikten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > dubbelkontrollen: den andra personen bekräftar i sin egen session, den som iordningställde kan inte kontrollera själv och ett id i anropet räcker inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > peroral behandling: systemet räknar tabletterna för cykeln och skriver instruktionen när kuren överlämnas till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > infusionen: systemet räknar takten, och start, avbrott, ny takt och slut registreras med vem och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > Min journal: patienten ser den överlämnade behandlingen och rapporterar intag och mående, och systemet säger när patienten ska ringa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Rapportera dagens tabletter i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.8.1.4 Ordination

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > ordination ur behandlingsregim: systemet hämtar längd och vikt, räknar kroppsytan och varje dos och lägger ut cyklerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > karboplatin doseras med Calverts formel ur njurfunktionen som systemet räknar med Cockcroft-Gault | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > före kuren prövar systemet provsvaren mot regimens gränser, beställer det som saknas och låter läkaren skjuta upp cykeln | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > dosjustering: läkaren väljer andel av full dos med orsak, och systemet räknar om doserna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > regimbiblioteket: en ändrad regim är en ny version som en regimansvarig läkare godkänner i sin egen inloggning, och nya ordinationer får den godkända versionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kumulativ dos: systemet räknar den kumulativa antracyklindosen per kvadratmeter och stoppar kuren som skulle passera gränsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kumulativ dos följer läkemedelslistan: en kur på en annan vårdenhet räknas utan aktivt val, en spärrad vårdenhet som i läkemedelslistan, och utan svar om tidigare behandling stoppar systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en cytostatikakur inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Godkänna en ny version av en cytostatikaregim inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.8.1.5 Beredning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > beredningsordern till beredningsenheten har volym ur stamlösningen, bärarlösning, total volym och etikett med streckkod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > beredningsenheten: arbetslistan visar de godkända kurerna med beräkning och föreslagen batch, och beredningen signeras med batch och kontrollmätt volym | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > lagret: batcher tas emot, utgångna kasseras och systemet säger om lagret räcker till de planerade kurerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > säkerhet: beredningsenheten ser bara beställningen och aldrig journalen, en farmaceut på en vårdenhet bereder inte, och varje patient i arbetslistan loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Bereda en cytostatikados på beredningsenheten inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.8.1.6 Iordningställande och administrering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > vid sängen kontrollerar systemet id-band, etikett och att läkemedlen ges i regimens ordning, och nästa cykel räknas om efter vikten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > dubbelkontrollen: den andra personen bekräftar i sin egen session, den som iordningställde kan inte kontrollera själv och ett id i anropet räcker inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > peroral behandling: systemet räknar tabletterna för cykeln och skriver instruktionen när kuren överlämnas till patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika > behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > infusionen: systemet räknar takten, och start, avbrott, ny takt och slut registreras med vem och när | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > Min journal: patienten ser den överlämnade behandlingen och rapporterar intag och mående, och systemet säger när patienten ska ringa | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 via API > API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Rapportera dagens tabletter i Min journal inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 4.8.1.7 Uppföljning av kvalitet och produktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Cytostatika > uppföljningen per vårdenhet räknar behandlingar, planerade och givna kurer, beredningar, dosjusteringar och uppskjutna cykler utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API för specialistområdena > cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > uppföljningen finns i datauttaget med regim, cykel, beredning och batch, och i beredningsenhetens uppföljning, utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Cytostatika i version 1.1 > spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.1.1 Kontorsinformationsstöd

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kontorsstöd > journaltexten som Word-dokument efter samma prövning som journalen, loggad på patienten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontorsstöd > rapporterna för kassan och kapaciteten som Word-dokument utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontorsstöd > kalenderprenumerationen med hemlig länk visar tid och typ men aldrig patienten, och kan återkallas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontorsstöd > möteslänk för videobesök, uppringning vid telefontid och inbjudan som kalenderfil och e-post | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kontorsstöd > arkitekturen beskriver ordbehandling, rapporter, kalender, SharePoint, e-post, telefoni och video | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Lägga in sin tidbok i kalenderprogrammet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 5.1.1.2 Migrering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > migreringsavstämningen visar avvikelsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Seed > migrerad historik från VAS och Cosmic finns för patient 1 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > översikten har tidslinje med migrerade poster märkta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Migrering > en migreringsfil valideras, läses in med källa och stäms av mot antalet i filen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Migrering > en post som inte går att läsa in blir en avvikelse med orsak, och samma fil två gånger läses inte in igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Migrering > bara systemförvaltningen läser in, posterna märks som migrerade och syns i patientens tidslinje | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Migrering > en förhandsvisad fil skrivs i journalerna först när en annan systemförvaltare har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Migrering > en migrerad anteckning får aldrig en nuvarande personal som författare eller signerande, och källans författare följer med märkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.1.3 Formulärhantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Formulär > definitionen har fördefinierade datatyper med validering, och systemet förklarar varje fel på vanlig svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > frågor visas och krävs efter regler, och reglerna ger varningar på vanlig svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > svarsalternativ och tolkningar kan ha koder i ICD-10-SE, KVÅ och Snomed CT, som systemet kontrollerar och föreslår | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > ett formulär byggs som en ny version och används först när en annan systemförvaltare har godkänt det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnad bygger bara på det som den som fyller i får se: en spärrad vårdenhets mätvärde ändrar inte svaret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > förifyllnaden använder bara den egna vårdenhetens uppgifter utan aktiva val, texten har ingen vårdenhet, och källan visas bara för den som får se den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > behörighet per formulär: kategori, yrken och vårdenheter prövas på servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > svaren i en signerad anteckning ändras aldrig, och en rättelse blir en ny version med egna svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > API: systemförvaltaren bygger, förhandsvisar och föreslår formulär, och den som dokumenterar får aktiva formulär bland mallarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Formulär > FHIR: formuläret som Questionnaire och svaren som QuestionnaireResponse med samma behörighet som anteckningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Bygga ett formulär och föreslå det inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Dokumentera ett sår med kroppsbilden inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Mobil > Dokumentera ett sår med kroppsbilden går i 360 px | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 5.1.1.4 Externa tillämpningar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| SMART on FHIR > EHR launch från journalen med PKCE ger en åtkomstbiljett för patienten, och varje anrop loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > PKCE krävs, koden går att använda en gång och fel adress eller okänd tillämpning avvisas utan omdirigering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Starta en extern tillämpning från journalen inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 5.1.2.1 Nyttja externt förvaltad masterdata

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje läkemedel i katalogen har en ATC-kod ur WHO:s register | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > organisation och personal i sandlådan kommer från filadaptern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en ny utgåva av ett kodverk från källan läses in och läggs fram för godkännande med jämförelsen färdig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > läkemedelskatalogen läses från källan: nya och ändrade produkter förs in och en produkt som saknas står kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > masterdatan läses in efter ett schema som systemförvaltningen ändrar, och en ny sandlåda räknar seeden som första inläsningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en källa som inte svarar ändrar ingenting, de senast giltiga uppgifterna används och avvikelsen visas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.2.2 Information

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > vårdrelation: listning och remiss till enheten ger vårdrelation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > organisation och personal i sandlådan kommer från filadaptern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en ny utgåva av ett kodverk från källan läses in och läggs fram för godkännande med jämförelsen färdig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > läkemedelskatalogen läses från källan: nya och ändrade produkter förs in och en produkt som saknas står kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > listningen läses från källan, och en omlistning flyttar vårdrelationen till den nya vårdcentralen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > arbetsscheman, prislistor, beställarregistret och tillgängligheten i förrådet följer samma kontrakt och synkronisering | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > API: systemförvaltaren läser in en del direkt, och andra roller får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.2.3 Arkitektur för masterdatahantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Masterdata > organisation och personal i sandlådan kommer från filadaptern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > källan kan bytas mot en annan adapter med samma kontrakt, och synkroniseringen räknar ut vad som ändrats | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en källa med fel ändrar ingenting, och befolkningen ger skyddad identitet direkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > API: masterdata visar källan, antalet och den senaste synkroniseringen per del | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > masterdatan läses in efter ett schema som systemförvaltningen ändrar, och en ny sandlåda räknar seeden som första inläsningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > vilka delar som är masterdata är parametrar: en del som förvaltas i Vårdkällan läses inte in | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > en källa som inte svarar ändrar ingenting, de senast giltiga uppgifterna används och avvikelsen visas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Masterdata > API: systemförvaltaren läser in en del direkt, och andra roller får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.3.1 Stöd för aktuell version av NI

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Informationsstruktur > modellen har NI 2023:2:s informationsklasser och begrepp med termbankens definitioner, och varje klass som används finns i NI | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Informationsstruktur > varje tabell med patientuppgifter har en NI-klass, och en tabell som ingen har klassat får NI:s allmänna klass och visas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Informationsstruktur > varje FHIR-resurs i API:t har en NI-klass, och NI:s attribut pekar på kolumner som finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Informationsstruktur > API: informationsmodellen visar klasserna med tabeller och FHIR-resurser för inloggad personal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.3.2 Stöd för nationellt fackspråk (NF)

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Nationellt fackspråk > varje Snomed-kod i delmängden har rätt kontrollsiffra och partition och en kontrollerad engelsk term | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nationellt fackspråk > varje sökord i journalens mallar har en Snomed-kod eller en förklaring, och anteckningen får koden i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nationellt fackspråk > NF:s delar är Snomed CT, ICD-10-SE, KVÅ och termbanken, och API:t visar hur var och en används | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nationellt fackspråk > åtgärder med KVÅ har samma åtgärd i Snomed CT, och fynd och provtyper i beställning och svar ingår i delmängden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.3.3 Stödjer Nationell informationsstruktur

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Informationsstruktur > modellen har NI 2023:2:s informationsklasser och begrepp med termbankens definitioner, och varje klass som används finns i NI | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Informationsstruktur > varje tabell med patientuppgifter har en NI-klass, och en tabell som ingen har klassat får NI:s allmänna klass och visas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Informationsstruktur > varje FHIR-resurs i API:t har en NI-klass, och NI:s attribut pekar på kolumner som finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Informationsstruktur > API: informationsmodellen visar klasserna med tabeller och FHIR-resurser för inloggad personal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.3.4 Stöd för Nationellt fackspråk

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Nationellt fackspråk > varje Snomed-kod i delmängden har rätt kontrollsiffra och partition och en kontrollerad engelsk term | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nationellt fackspråk > varje sökord i journalens mallar har en Snomed-kod eller en förklaring, och anteckningen får koden i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nationellt fackspråk > NF:s delar är Snomed CT, ICD-10-SE, KVÅ och termbanken, och API:t visar hur var och en används | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nationellt fackspråk > åtgärder med KVÅ har samma åtgärd i Snomed CT, och fynd och provtyper i beställning och svar ingår i delmängden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.3.5 Stöd för kodverk

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kodverk > varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje läkemedel i katalogen har en ATC-kod ur WHO:s register | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kodverk > varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > Condition använder ICD-10-SE | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR-struktur > Condition och MedicationRequest har display ur kodverket | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skalor > eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtgärder med KVÅ > koderna och titlarna stämmer med KVÅ 2026, och systemet har OID:n ur Socialstyrelsens OID-serie | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtgärder med KVÅ > FHIR: Procedure med KVÅ för NEWS2-omgångar, GCS och läkemedelsgenomgång, med samma behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > varje kodverk har version, giltighet, utgivare och källa, och Vårdkällans egna kodverk finns med som lokala | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > en ny utgåva kontrolleras och jämförs med den som gäller: nya, ändrade och borttagna koder och hur många diagnoser som berörs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > en utgåva gäller först när en annan systemförvaltare har godkänt den, och aldrig bakåt i tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > en diagnos prövas mot den utgåva som gäller den dagen, och en kod som har tagits bort förklaras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > ett lokalt kodverk från verksamheten skapas med fyra ögon och dess koder går att hämta i API:t | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > API: bara systemförvaltningen förvaltar kodverken, och historiken visar vem som lade in och godkände | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.4.1 Integration med eHälsomyndighetens e-recepttjänst

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läkemedel > NLL: normal överföring kvitteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: inget svar i tid döljer inte ordinationen och avstämning hittar registreringen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > NLL: felsvar syns och avstämning skickar igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.1.4.5 Integration Beställning och svar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Integration med produktionssystem > disciplinerna: klinisk kemi, klinisk fysiologi, klinisk neurofysiologi, mikrobiologi, immunologi, patologi, genetik, radiologi och transfusionsmedicin har laboratorier och analyser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > anslutning: systemförvaltaren ansluter laboratoriet, nyckeln visas en gång och sparas som HMAC, och andra roller får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > beställning ut: proverna går till utkorgen som Patient, ServiceRequest och Specimen, hämtningen loggas på patienten och det simulerade laboratoriet svarar inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > status och svar in: mottagen och svar med NPU-kod blir mätvärden som väntar på vidimering, och ett kritiskt värde larmar efter Vårdkällans egna gränser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > svar in: ett meddelande som inte går att ta emot får en förklaring på svenska och ändrar ingenting | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > svar in för mikrobiologi, immunologi och genetik: fynd i Snomed CT och utlåtanden i text | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > transfusionsmedicin: blodgruppering, bastest och blodkomponenter går mellan Vårdkällan och blodcentralens producentsystem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: giltig blodgruppering och färskt negativt bastest ger reserverade enheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: bastest saknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: bastestet är äldre än giltighetstiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: ett positivt bastest stoppar när beställningen inte utreds | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: en makulerad beställning med blodgruppering räknas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: en borttagen blodgruppering räknas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > producentsystemet: fel blodgrupp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Transfusionskontroll > avvikelsen kvitteras av den som beställde, och en annan läkare ser den inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > undersökningar: klinisk fysiologi, neurofysiologi och radiologi skickas direkt utan provtagning och besvaras med ett utlåtande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > katalog in: laboratoriets katalog kopplas till Vårdkällans analyser, och en analys som inte erbjuds kan inte beställas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Integration med produktionssystem > det simulerade producentsystemet hämtar, kvitterar och svarar genom samma gränssnitt, för systemförvaltningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.2.1.2 Spårbarhet för åtkomst och aktiviteter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sökningen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > FHIR-anrop loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > logggranskaren ser logg med hel kedja, andra roller nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nödåtkomst via API flaggas i logguppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.2.1.3 Export av loggposter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| FHIR > AuditEvent bara för logggranskare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Export av loggen > åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Export av loggen > CSV har rubriker, semikolon och skydd mot formler, och säkerhetsloggen kan också exporteras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Export av loggen > bara logggranskaren exporterar, och ett nekat försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.2.1.4 Utloggningsfunktion

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Min journal > utloggning och byte av roll i samma webbläsare nollställer sessionen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Avbrott > läskopian rensas vid utloggning | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > utloggning i en flik avslutar läsläget i webbläsarens andra flikar | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Parametrar för utloggning och rapportering > utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.2.1.6 Åtkomstkontroll

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nekad åtkomst ger 403 kraver_val och loggas som nekad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > patientsessionen når inga av personalens API:er | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > personalens session når inte Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > inloggningen går genom den simulerade autentiseringstjänsten, och personen, uppdraget och behörigheten tas ur biljettens attribut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > en biljett med fel utfärdare, fel nyckel, ändrad signatur, fel mottagare, fel algoritm eller som har gått ut avvisas, och orsaken loggas i säkerhetsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > en biljett kan bara användas en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > autentiseringstjänstens publika nyckel och konfiguration för OpenID Connect kan läsas utan inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.2.1.7 Aktiva val och samtycke

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: spärrmarkering syns men innehållet döljs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: samtycke i stunden visar spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > aktivt val för andra enheter via API | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > spärrmarkering och samtycke via API | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Nödåtkomst inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 5.2.1.8 Behörighetshantering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > vårdrelation: inskriven patient ger åtkomst på egen enhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > vårdrelation: listning och remiss till enheten ger vårdrelation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > vårdrelation: kontakt avslutad för mer än 90 dagar sedan ger ingen vårdrelation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > vårdrelation: avvisad remiss ger ingen vårdrelation | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighet ur masterdata > en ny person i källan får behörighet ur yrke och vårdenhet utan administration och kan logga in med biljett | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighet ur masterdata > en ändrad person i källan får den nya behörigheten: byte av yrkesroll och av vårdenhet avslutar den gamla inloggningen och en ny inloggning ger den nya | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighet ur masterdata > en person som synkroniseringen gör inaktiv nekas inloggning och förlorar åtkomsten i en pågående session | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.2 Urskilja och skydda information efter skyddsbehov

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > inre sekretess: arbetsplats räknas till sin vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: spärrmarkering syns men innehållet döljs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skyddsbehov > varje informationstyp har en skyddsnivå, och informationsstrukturen skiljer uppgifterna efter vårdenhet, process och plan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skyddsbehov > logggranskaren tar fram alla åtkomster till uppgifter med mycket högt skyddsbehov | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skyddsbehov > stickprovet tar alltid med åtkomster till uppgifter med mycket högt skyddsbehov | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.3 Skydd av personer med särskilda skyddsbehov

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > arbetslista maskerar skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sök maskerar skyddad patient och hittar den bara på fullständigt personnummer | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > väntrummet visar aldrig namn för skyddad patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > visa identitet kräver syfte och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| FHIR > skyddad patient maskeras i FHIR | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > skyddad identitet: listan före inloggning maskerar, patienten ser sina egna uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > invånare: egen journal från 16 år, vårdnadshavare till 13 år och aldrig för ett barn med skyddad identitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.5 Oavvislighet genom kryptografiska metoder

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Signerade meddelanden > en förskrivning till läkemedelslistan signeras med Vårdkällans certifikat och kvitteras med läkemedelslistans signatur, och beviset sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > ändrat innehåll upptäcks: i ett meddelande på vägen, i kvittensen och i journalen efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > bevisen kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > API: systemförvaltaren ser certifikaten och bevisen utan patientuppgifter och kontrollerar ett bevis, andra roller nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| E-arkiv > leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.6 Ändringshistorik i journalen

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Journal > rättelse skapar ny version och den gamla finns kvar oförändrad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > rättelse kräver orsak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > bara senaste versionen kan rättas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > helflöde: anteckning skapas, signeras och rättas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedel > utsättning kräver orsak och inget raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.7 Radering av poster eller hela journalen

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > radering efter beslut av Inspektionen för vård och omsorg tar bara de utpekade posterna med hela versionskedjan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > radering av hela journalen behåller identiteten, utskrifterna, utlämnandena och loggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > arkivariens postförteckning visar inget innehåll och nämner inte en spärrad vårdenhet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.8 Publikt erkända certifikat mellan instanser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Certifikat mellan instanser > kedjan kontrolleras mot listan över betrodda utfärdare, och en egen utfärdare eller en instans som utfärdar certifikat godtas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > ett utgånget, ännu inte giltigt eller återkallat certifikat avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > ett certifikat för en annan instans godtas inte som avsändare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > när systemförvaltaren återkallar laboratoriets certifikat i sandlådan tas svaren inte emot, och det gäller bara den sandlådan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.12 Loggning av säkerhetspåverkande händelser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| API > nekad åtkomst ger 403 kraver_val och loggas som nekad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nödåtkomst via API flaggas i logguppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > okänd grund vägras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > ändrade behörigheter och inställningar blir säkerhetshändelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.3.1.18 Säkerhetsarkitektur

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Behörighetsmotorn > nekad: utan grund nekas åtkomst utan erbjudande om val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > skrivande anrop med fel Origin avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > sessionskakan är HttpOnly och SameSite=Lax | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > för stor kropp avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsarkitektur > hotmodellen har yttre och inre hot, och varje hot pekar på en kontroll, en princip och tester | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsarkitektur > varje princip i Sussas kravtext möts av minst ett hot i hotmodellen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > en biljett med fel utfärdare, fel nyckel, ändrad signatur, fel mottagare, fel algoritm eller som har gått ut avvisas, och orsaken loggas i säkerhetsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > en biljett kan bara användas en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > autentiseringstjänstens publika nyckel och konfiguration för OpenID Connect kan läsas utan inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Min journal > nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > kedjan kontrolleras mot listan över betrodda utfärdare, och en egen utfärdare eller en instans som utfärdar certifikat godtas inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > ett utgånget, ännu inte giltigt eller återkallat certifikat avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > ett certifikat för en annan instans godtas inte som avsändare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Certifikat mellan instanser > när systemförvaltaren återkallar laboratoriets certifikat i sandlådan tas svaren inte emot, och det gäller bara den sandlådan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > en förskrivning till läkemedelslistan signeras med Vårdkällans certifikat och kvitteras med läkemedelslistans signatur, och beviset sparas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > ändrat innehåll upptäcks: i ett meddelande på vägen, i kvittensen och i journalen efteråt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Signerade meddelanden > bevisen kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| E-arkiv > leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > nödåtkomst via API flaggas i logguppföljningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skyddsbehov > stickprovet tar alltid med åtkomster till uppgifter med mycket högt skyddsbehov | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > inre sekretess: andra enheters uppgifter kräver aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > spärr: aktivt val häver inte spärren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > UPDATE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > DELETE på loggen avbryts av trigger | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Åtkomstloggen > varje rad kedjas med sha256 av föregående hash och raden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journal > signerad anteckning kan inte ändras i databasen (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighet ur masterdata > en person som synkroniseringen gör inaktiv nekas inloggning och förlorar åtkomsten i en pågående session | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighet ur masterdata > en ändrad person i källan får den nya behörigheten: byte av yrkesroll och av vårdenhet avslutar den gamla inloggningen och en ny inloggning ger den nya | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggning med biljett > ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Behörighetsmotorn > skyddad identitet: namn och personnummer maskeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skyddsbehov > varje informationstyp har en skyddsnivå, och informationsstrukturen skiljer uppgifterna efter vårdenhet, process och plan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Skyddsbehov > logggranskaren tar fram alla åtkomster till uppgifter med mycket högt skyddsbehov | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsloggen > ändrade behörigheter och inställningar blir säkerhetshändelser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.4.2.1 Export till e-arkiv för långsiktigt bevarande

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.4.2.2 Integrerad åtkomst till mellanarkiv

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Mellanarkiv > mellanarkivet har tagit emot ett FGS-paket med äldre uppgifter ur VAS, och mottagningskontrollen är utan fel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > journalen visar handlingarna med samma behörighet: egen vårdenhet direkt och andra vårdenheter efter ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > yrkesrollen styr vad som visas: inre sekretess för journal och omvårdnad som i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > en spärrad vårdenhet syns inte, svaret är detsamma med och utan den dolda handlingen, och med samtycke syns den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > utan vårdrelation är en handling som en som inte finns, och det nekade försöket loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > varje läsning loggas med handlingens id, innehållet är kontrollerat oförändrat, och handlingarna går inte att ändra eller radera | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > arkivarien registrerar ett beslut, systemet tar fram underlaget och för över äldre handlingar, som sedan visas i journalen som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > undantag från visning gäller handlingarna i mellanarkivet, och en undantagen anteckning förs inte över | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > mellanarkivet avvisar ett paket med fel, och då förs ingenting över | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > tidslinjen och sökningen i journalen tar med handlingarna, märkta Ur mellanarkivet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Mellanarkiv > handlingarna följer journalen vid en sammanslagning och raderas med hela journalen efter ett beslut om förstöring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Läsa en äldre anteckning ur mellanarkivet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > För över äldre journalhandlingar till mellanarkivet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 5.4.2.3 Export av information

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| E-arkiv > paketet har ett index med e-arkivets dataelement för varje journalhandling, och mappningen står i dokumentationen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| E-arkiv > leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| E-arkiv > ett paket som ändras på vägen eller saknar en fil avvisas av mottagningskontrollen med orsaken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| E-arkiv > journalhandlingar och åtkomstloggen ligger skilda åt, och indexet tar bara med journalhandlingarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 5.4.2.4 Gallring

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Arkiv > gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Arkiv > beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gallringsregler > reglerna per informationsmängd är parametrar med lagens lägsta gräns, som systemförvaltaren ändrar med fyra ögon, och arkivarien ser dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gallringsregler > ett gallringsbeslut gallrar mätvärden och kallelser som är äldre än regeln i journaler som finns kvar, och resten av journalen är orörd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gallringsregler > gallringen av delar loggas per journal utan innehåll, åtkomstloggen är hel och beslutet kan bara verkställas en gång | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.1.1.1 All vårdinformation hålls samman per vårdkontakt

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > migrerad historik får vårdkontakter med samma källa, märkta som skapade av systemet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > anteckningen knyts till den pågående vårdkontakten utan att någon väljer den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > finns ingen kontakt skapar systemet en med typ och enhet ur sammanhanget, en gång per dag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > vårdkontakten visar allt som hör till den, med samma behörighet och loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > översikten och tidslinjen visar informationen per vårdkontakt och per vårdtillfälle | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > en kontakt som systemet skapar räknas som vårdrelation i 90 dagar från dagen den skapades | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.1.1.2 Spårbarhet hälsoärende

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Hälsoärende > ett hälsoärende kan avslutas och öppnas igen, med historik | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Hälsoärende > ett hälsoärende delas, och kontakterna följer med till det nya ärendet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Hälsoärende > två ärenden slås ihop, och det sammanslagna visas inte längre | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Hälsoärende > en vårdkontakt flyttas mellan ärenden, med historik i båda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Hälsoärende > kontakter och ärenden som användaren inte får se rörs inte, och nödåtkomst ger bara läsning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Hälsoärende > historiken kan inte ändras eller raderas (trigger) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > hälsoärende föreslås ur samma diagnos och bekräftas med ett klick | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > hälsoärende föreslås ur en remisskedja | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > förslagen bygger bara på kontakter som användaren får se, och ett förslag kan avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > hälsoärendet visar bara de vårdkontakter som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > seedens hälsoärende håller samman remisskedjan för patient 11 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Bekräfta ett hälsoärende inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 6.1.1.3 Spårbarhet kringsystem

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > ordinationen, mätvärdet och remissen i FHIR pekar på sin vårdkontakt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spårbarhet > en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spårbarhet > överföringen till NLL och svaret från NLL syns i händelsekedjan, och varje del följer sin behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spårbarhet > en ordination eller kontakt på en spärrad vårdenhet röjs aldrig, inte heller genom en prenumerationsnotis | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.1.1.4 Spårbarhet subprocesser

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Remiss > statuskedjan skickad, mottagen, bedömd, besvarad, svar kvitterat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > hälsoärende föreslås ur en remisskedja | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Subprocesser > målvärdena för ledtiderna är parametrar som systemförvaltaren sätter, med samma standard som modulen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Subprocesser > remiss, provtagning och läkemedelsöverföring följs upp per steg mot målvärdena, utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Spårbarhet > en labbeställning kan följas från vårdkontakten till svaret med samma korrelations-id | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.1.1.5 Spårbarhet vårdtillfälle

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > vårdtillfället hålls samman vid sektionsbyte, sängbyte och permission utan att något registreras om | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > medicinskt ansvar följer med vid flytt till en annan klinik, eller stannar kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > utskrivningen avslutar vårdtillfället och påminner om osignerade anteckningar och epikris | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > FHIR: Encounter med vårdtillfälle, kontaktsätt och hälsoärende, och EpisodeOfCare med samma behörighet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > inskrivningen avslutar bara den egna akutkontakten och skriver bara in där den inloggade får | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > vårdtillfället visar bara de vistelser, händelser och det innehåll som användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > FHIR: vårdtillfällets Encounter och hälsoärendets EpisodeOfCare visar bara det användaren får se | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Skriva in en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Flytta en patient till en annan avdelning inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Skriva ut en patient inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 6.1.1.6 Enhetlig hantering av vårdkontakter

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vårdkontakt > inskrivning från akuten skapar ett vårdtillfälle och avslutar akutbesöket | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > planerad kontakt på distans, och ankomsten registreras på den planerade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdkontakt > all vårdinformation i seeden är knuten till en vårdkontakt hos samma patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdformer > utskrivning till hemsjukvård görs i ett steg, med föregående kontakt och samma hälsoärende | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdformer > en dagkirurgisk kontakt där patienten blir kvar skrivs in i samma hälsoärende | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdformer > den faktiska besökstiden registreras utan att kontakten avslutas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vårdformer > en dagkirurgisk kontakt eller uppföljning kan inte bakdateras eller läggas mer än ett år fram | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.2.1.1 Statistikuttag i kärnsystemet

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Statistik och analys > uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Statistik och analys > vårdenhetens statistik räknas bara på den egna vårdenhetens uppgifter, och en annan vårdenhet nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Statistik och analys > urval och resultat sparas, återanvänds och delas med vårdenheten, och prövas med den egna behörigheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > ett sparat resultat läses bara av en roll som får se statistik, och svaret är detsamma oavsett om det finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > en roll utan behörighet att gruppera nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.2.1.2 Patientgruppering

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Patientgruppering > villkoren kontrolleras och skrivs på vanlig svenska, och färdiga grupper har målvärden ur riktlinjerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > läkaren grupperar sina patienter på diagnos, mätvärde, läkemedel, besök och demografi och får en lista som loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > gruppen räknas bara på uppgifter som läkaren får se utan aktivt val, och aldrig på spärrade uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > en patient utan vårdrelation på vårdenheten kommer aldrig med i läkarens grupp | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > en roll utan behörighet att gruppera nekas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Folkhälsa > en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Statistik och analys > uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.2.2.1 Folkhälsa

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Levnadsvanor > systemet räknar risken för alkohol, fysisk aktivitet och matvanor och föreslår stöd med KVÅ-kod | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Levnadsvanor > anteckningen får text som systemet skriver, och samtalet registreras som åtgärd när den signeras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Folkhälsa > en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Folkhälsa > patientlistan i en insats prövar varje patient i behörighetsmotorn, och en patient utan åtkomst syns inte alls | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Folkhälsa > rekommendationen syns i patientens översikt för den som kan ge stödet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Folkhälsa > insatserna följer behörigheten: kardiologen ser inte vårdcentralens insats, och uppföljningen ser bara antal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Patientgruppering > uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.1.1 Accesspunkt för datauttag

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > bara uppföljningsrollen når datauttaget, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.1.2 Accesspunkten uppdateras minst en gång per dygn

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > drift-vyn visar när datauttaget senast uppdaterades och när nästa uppdatering sker | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.1.3 Omfattning av tillgång till data

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > datauttaget innehåller inga namn, personnummer, adresser eller fritext | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > spärrade uppgifter och patienter med skyddade personuppgifter kommer inte med, och antalet utelämnade står i manifestet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag, runda 9 > mätvärden, anteckningar utan text, vårdtillfällen och patientavgifter följer samma regler som de andra tabellerna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag, runda 9 > patientavgiften röjer varken kontakter på en spärrad vårdenhet eller ett LMA-kort | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.1.4 Accesspunktens uppdateringsfrekvens

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > drift-vyn visar när datauttaget senast uppdaterades och när nästa uppdatering sker | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.1.5 Accesspunkt för datauttag

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Datauttag > uttaget uppdateras varje natt, minst en gång per dygn, och kan läsas inkrementellt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag > manifestet följer FHIR Bulk Data och uttaget loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag, runda 9 > kontrollreglerna per rad står i manifestet och pekar ut rader som inte klarar dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Datauttag, runda 9 > en vecka av uppdateringar sparas, och ändringarna kan läsas sedan vilken av dem som helst | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.2.1 Kvalitetsregister

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Myndighetsrapportering > kvalitetsregistret utelämnar patienter som har motsatt sig, med skyddade personuppgifter och från spärrade enheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > kvalitetsregistrets återkoppling sparas och kan läsas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > läkaren och sjuksköterskan registrerar och ångrar patientens invändning mot kvalitetsregistret, och det loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > patienten anmäler själv sin invändning mot kvalitetsregistret i Min journal och kan ångra den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 6.3.2.2 Myndighetsrapportering

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Myndighetsrapportering > patientregistrets filer följer HSLF-FS 2023:33 med semikolon, rätt antal fält och filnamn med länskod och period | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > diagnoser rapporteras utan punkt, yttre orsaker i egen fil och åtgärder och givna läkemedel med datum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > en vårdkontakt med fel hålls kvar, och felet beskrivs på svenska med vem som rättar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > primärvård och kontakter utan läkare rapporteras inte till patientregistret och räknas med bestämmelse | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > skyddade personuppgifter och spärrade uppgifter rapporteras till patientregistret enligt lag och redovisas som antal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > psykiatrisk vårdform enligt LPT räknas fram ur beslutsjournalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > väntande i specialiserad vård följer filspecifikationen med fas, aktivitet, remiss och måldatum | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > medicinska födelseregistret tar förlossningar ur diagnoserna, och utan utfall är det ett fel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > Vårdtillfällesdatabasen har ett antaget format som är märkt som antagande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering > en yttre orsak sätts ihop ur tre frågor och kontrolleras mot ICD-10-SE | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > bara uppföljningsrollen granskar och skickar, och nekade försök loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > granskningen visar fel och fältens ifyllnad utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > att skicka sparar rapporten med kvittens från den simulerade mottagaren och loggar varje patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > läkaren får felet i inkorgen bara för sin vårdenhet och rättar det med systemets förslag, och vårdkontakten följer med i nästa rapport | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > en yttre orsak registreras i inkorgen ur svaren, och en kod som systemet inte känner till nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > en diagnos som registreras via rapportfelet röjer inte dolda diagnoser, och två huvuddiagnoser rättas av den som får se båda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > demoläget ger ett fel på kardiologen och ett på akutmottagningen i rätt inkorg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > väntelistans fritext visas inte för uppföljningsrollen, bara för vårdadministratören efter prövningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > inkorgen följer det aktuella läget när en vårdkontakt flyttas eller personalen byter enhet efter att sammanställningen har sparats | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > den sparade sammanställningen görs om när en spärr eller en vårdenhet ändras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Myndighetsrapportering i API:t > ett fel för ett vårdtillfälle syns bara när behörigheten gäller vårdtillfällets och varje kontakts vårdenhet, utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Granska och skicka månadens rapport till patientregistret inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 6.3.3.1 Forskningsunderlag

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Forskningsuttag > beställningen får diarienummer, etikprövningen kontrolleras och urvalet hämtas ur datauttaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Forskningsuttag > två andra personer godkänner, den som registrerade kan inte, och utlämnandet loggas och kan inte ändras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Forskningsuttag > en avslagen beställning kan inte lämnas ut, och roller utan behörighet nekas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Forskningsuttag > verksamhetschefen godkänner bara för sin egen vårdenhet, och uttaget får bara med vårdenheter som har godkänt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 7.1.1.1 Faktureringsunderlag

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Ekonomi: faktureringsunderlag > systemet skapar transaktionsposter ur vårdtillfället med vårddygn, material, DRG och sammanhållande id utan att någon registrerar dem | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > läkemedel som gavs på enheten och åtgärder med KVÅ blir poster med pris ur prislistan och materialschablon | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > översikten per vårdenhet visar antal, summa och varningar utan personuppgifter, och förra månaden är förvald | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > skyddad identitet: underlaget innehåller aldrig adressen eller namnet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: skydd i underlaget och högkostnadsskyddet > ett barn med skyddade personuppgifter: varken vårdnadshavarens namn och identitet eller adressen finns i underlaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: skydd i underlaget och högkostnadsskyddet > en vårdnadshavare med skyddade personuppgifter: namn, identitet och barnets adress lämnas inte ut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: sandlådor och roller > en sandlåda från före runda 7 får tabellerna, prislistorna och ekonomen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: export för en spärrad vårdenhet > underlaget för en vårdenhet som patienten har spärrat har minsta möjliga uppgifter och inget om andra vårdenheter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: ChargeItem i FHIR > ChargeItem med samma behörighet och loggning som kostnadsrutan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Exportera faktureringsunderlag för en månad inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Gränssnitt > Klickbudget > Lämna ut ett hjälpmedel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 7.1.1.2 Faktureringsunderlag

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Ekonomi: prislistor > varje vårdenhet har en prislista med version, giltighetstid och demopriser, och kardiologin har en historik | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: prislistor > bara ekonomen ändrar en prislista, som blir en ny version från ett datum som inte har passerat, och ändringen loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > när reservnumret ersätts av personnumret följer underlaget med och betalningsmottagaren blir känd | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > utomlänsvård: underlaget har en del per hemregion med de uppgifter som den nationella tjänsten för utomlänsvård behöver (simulerad) | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > DRG: vårdtillfället grupperas med en demoregel ur den ansvariga vårdenhetens huvuddiagnos, och utan huvuddiagnos förklarar systemet varför | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > medicinskt färdigbehandlad registreras av läkaren på vårdtillfället och ingår i underlaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > i en samordnad planering vid utskrivning är underrättelsen om utskrivningsklar registreringen, och kommunens betalningsansvar kommer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: faktureringsunderlag > export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 7.1.2.1 Ekonomisk visualisering

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Ekonomi: kostnader i vårdprocessen > läkaren ser kostnaden hittills för vårdtillfället per kategori enligt prislistan, med DRG och högkostnadsskyddet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: kostnader i vårdprocessen > vårdadministratören ser bara patientavgifterna och högkostnadsskyddet, och undersköterskan ser inga kostnader | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: kostnader i vårdprocessen > spärr och inre sekretess: kostnader från en spärrad eller annan vårdenhet syns inte och nämns inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: kostnader i vårdprocessen > en öppenvårdskontakt i dag har en egen kostnadsruta | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: skydd i underlaget och högkostnadsskyddet > högkostnadsskyddet räknas bara på de kontakter användaren får se: en spärrad enhet utan och med samtycke | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: avgifter som taket har påverkat > en dold kontakt som gör nästa synliga avgift nedsatt men inte noll ändrar inte svaret i kostnadsrutan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Ekonomi: kostnader i vårdprocessen > rabatter: en avgiftsfri patientavgift visar ordinarie avgift, rabatten och skälet, och rutan summerar rabatterna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 8.4.1.1 Fokus på verksamhets- och patientnytta samt att stödja användarnas behov

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussas testfall > registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > tidspoängen följer tabellen i Bilaga F1:2 för de fyra tidsklasserna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > måluppfyllelsen ger 10, 5, 2 eller 0 efter slutvillkoret och klickbudgeten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > omvandlingen till utvärderingspoäng följer Bilaga F1:2 avsnitt 5 | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > tidsuppskattningen följer keystroke-level model med den uppmätta svarstiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > demoläget lägger in testpatienterna med Skatteverkets testpersonnummer och datan som testfallen behöver | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > tema 1 genomförs med Sussas läkemedel i en katalog med minst 100 produkter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Klickbudget > klickbudget.json täcker alla flöden med budgetarna från koden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Sussas testfall > 1.1 Förskriva läkemedel (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.2 Ordinera läkemedel (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.3 Ordinera läkemedel på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.4 Administrera läkemedel (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.4 Signera (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.4 Omboka besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.5 Ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.6 Överblicka ankomstregistrering (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.7 Oplanerad ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.8 Väntelista (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Testinbjudan > varje yrkesroll har 6 till 12 uppdrag, och tillsammans täcker uppdragen alla Sussas 34 testfall | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > inget uppdrag är avbockat när det startar, för någon roll, så att seedens och Sussas testdata aldrig räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > ett uppdrag bockas av när rollen gör det på riktigt, och tiden till uppdraget räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > bara rollens egen demoperson räknas: samma sak gjord av en annan roll i sandlådan bockar inte av uppdraget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > ett uppdrag som går ut på att hitta något prövas mot Sussas rätta svar på servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > jämförelsen efter ett uppdrag sparas en gång, med testarens profil, och syns per uppdrag och journalsystem hos testledaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > panelens svar innehåller inga personnummer eller andra uppgifter ur sandlådans journaler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 8.4.1.2 Användarcentrerad design

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Sussas testfall > registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > SUS-formuläret har de tio påståendena i Sussas formulering och poängen räknas med standardformeln | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussas testfall > expertgranskningen har de sju dialogprinciperna i ISO 9241-110 och summan omvandlas till utvärderingspoäng | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > sparas på servern med roll, pseudonym, datum, testfall och svar, och poängen räknas av servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > inga patientuppgifter eller namn: pseudonym med siffror som ett personnummer, kommentar med personnummer och okända fält avvisas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > läsning och export kräver både testledarens roll och koden för just det tillfället, så att ingen ser andras tillfällen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > skrivningen är begränsad per tillfälle och per session och minut, och ett fullt tillfälle stoppar bara sig självt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > tillfällen utan aktivitet på 90 dagar raderas med sina svar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > skapandet är begränsat per session och timme och per skapare, så att ingen kan fylla det globala taket | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Användartestens svar > tomma tillfällen utan svar raderas efter 24 timmar och räknas då inte längre mot skaparen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Sussas testfall > 1.1 Förskriva läkemedel (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.2 Ordinera läkemedel (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.3 Ordinera läkemedel på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 1.4 Administrera läkemedel (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.1 Upprätta och skicka vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.2 Upprätta och skicka vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.3 Ta emot vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.4 Ta emot vårdbegäran på uppdrag (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.5 Registrera en extern vårdbegäran (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 2.6 Besvara en vårdbegäran (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.1 Upprätta en labbeställning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.2 Upprätta en labbeställning på uppdrag (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.3 Registrera provtagning (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.4 Överblicka provsvar (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 3.5 Upprätta en beställning eller ordination på intern analys eller mätvärde (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.1 Skapa anteckning (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.2 Registrera mätvärden (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.3 Skapa slutanteckning eller epikris (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 4.4 Signera (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.1 Boka patient till ett besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.2 Boka ett teambesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.3 Boka ett gruppbesök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.4 Omboka besök (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.5 Ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.6 Överblicka ankomstregistrering (läkare öppenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.7 Oplanerad ankomstregistrering (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 5.8 Väntelista (medicinsk sekreterare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.1 Akut inskrivning av patient på vårdavdelning (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.2 Överflyttning av patient mellan avdelningar med olika medicinsk specialitet (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 6.3 Hitta information från tidigare slutenvårdstillfälle (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.1 Överblicka dagens arbete för din arbetsplats (paramedicinare) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.2 Överblicka dagens händelser för en grupp patienter (undersköterska) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.3 Överblicka patientens planering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (läkare slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Gränssnitt > Sussas testfall > 7.4 Visualisera en specifik resurs arbetsplanering (sjuksköterska slutenvård) når slutvillkoret inom klickbudgeten | Godkänt | Sussas testfall i webbläsaren | 2026-11-12 kl. 19:22 svensk tid |
| Testinbjudan > varje yrkesroll har 6 till 12 uppdrag, och tillsammans täcker uppdragen alla Sussas 34 testfall | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > inget uppdrag är avbockat när det startar, för någon roll, så att seedens och Sussas testdata aldrig räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > ett uppdrag bockas av när rollen gör det på riktigt, och tiden till uppdraget räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > bara rollens egen demoperson räknas: samma sak gjord av en annan roll i sandlådan bockar inte av uppdraget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > ett uppdrag som går ut på att hitta något prövas mot Sussas rätta svar på servern | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > jämförelsen efter ett uppdrag sparas en gång, med testarens profil, och syns per uppdrag och journalsystem hos testledaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testinbjudan > panelens svar innehåller inga personnummer eller andra uppgifter ur sandlådans journaler | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Synpunkter > en testare lämnar en synpunkt utan inloggning och får ett kort nummer, och systemet fyller i version, gränssnitt, webbläsare och tid | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Synpunkter > ett riktigt personnummer tas inte emot i texten eller kontaktfältet, men testpersonnummer och demons patienter går bra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Synpunkter > läsningen kräver en giltig läskod, och fel kod ger samma svar varje gång med ett tak på försöken | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Synpunkter > tak per session och minut, per session och timme, per adress och dygn och totalt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Synpunkter > export som CSV och Markdown, utan klickbara länkar, utan formler och utan HTML | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 8.4.1.3 Användbarhet och tillgänglighet

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Tillgänglighet > inget ljud, ingen video, inga bilder av text och inget som blinkar eller rör sig av sig självt | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > varje bild och symbol har ett textalternativ eller är dold för hjälpmedel | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > varje formulärfält, knapp och länk har ett namn som beskriver syftet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > varje vy har en rubrik på nivå 1 och rubrikerna hoppar inte över någon nivå | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > allt innehåll ligger i landmärken: sidhuvud, meny, huvudinnehåll och sidfot | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > sidan har språket svenska och varje vy har en egen sidtitel | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > fältens ramar och fokusmarkeringen har minst 3:1 mot bakgrunden | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > status, larm, uppmärksamhetssymbolen och kurvorna har text eller form utöver färgen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > texten går att förstora till 200 procent utan att innehåll eller funktion försvinner | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > vid 320 px bredd behövs ingen rullning i sidled | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > allt som går att klicka på går att nå med tangentbordet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > tabbordningen följer sidans ordning, utan positivt tabindex och utan tangentbordsfälla | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > varje element som får fokus med tabb har en synlig fokusmarkering | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > inloggning, att öppna en patient, byta flik och stänga nyheterna går med bara tangentbordet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > att ett element får fokus byter inte sida och öppnar inget | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > ett fel i ett formulär markeras vid fältet och beskrivs med text | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > högkontrastläget ger minst 7:1 i kontrast och följer datorns inställning | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > med minskade rörelser i datorn finns inga animationer eller övergångar | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Tillgänglighetsredogörelse > redogörelsen har varje krav i bilaga K2 med status och hur det är testat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillgänglighetsredogörelse > ett krav är uppfyllt bara när alla dess tester är gröna, och det som bara kan bedömas av människor är märkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillgänglighetsredogörelse > API: tillganglighet går att läsa utan inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tillgänglighetsredogörelse > docs/tillganglighet.md skrivs ur samma register som sidan och tar upp varje krav | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Tillgänglighet > fem minuter före utloggningen läser skärmläsare upp en varning, Fortsätt arbeta förlänger inloggningen och osparad text finns kvar som utkast efter en ny inloggning | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Klickbudget > Fortsätta arbeta när inloggningen snart går ut inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Inloggningens tidsgräns > inloggningen går ut efter en tid utan aktivitet, men sandlådan och utkasten finns kvar efter en ny inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggningens tidsgräns > anrop i bakgrunden förlänger inte inloggningen, och Fortsätt arbeta gör det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Inloggningens tidsgräns > varje svar till en inloggad säger när inloggningen går ut, och utloggningen står i säkerhetsloggen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 10.1.1.2 Kontinuerlig kompetensutveckling

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Utbildning > hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Övningar och intyg > övningarna och nyheterna innehåller inga patientuppgifter utom demopatienternas namn, och texterna är svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 10.1.1.3 Utbildning användare

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Utbildning > hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Utbildning > övningarna ger ett intyg med giltighetstid, och verksamhetschefen ser vårdenhetens intyg | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Övningar och intyg > varje yrkesroll har övningar, och rätt svar lämnas inte ut före rättningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > alla rätt ger ett intyg som gäller i ett år, och ett fel ger förklaringar men inget intyg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, och ingen annan gör det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 10.1.1.4 Förändrat gränssnitt

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Nyheter > nyheterna har version, datum och roller, och den senaste versionen är den som körs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nyheter > rutan visar bara den aktuella versionens nyheter för användarens roll, och historiken går att läsa igen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nyheter > rutan stängs per användare och version och kommer tillbaka vid nästa version | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nyheter > API: nyheter kräver inloggning, och invånaren får sina egna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Utbildning > nyhetsrutan visar rollens nyheter efter inloggning, stängs med ett klick och går att läsa igen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Klickbudget > Läsa nyheterna och stänga dem inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 10.1.1.5 Certifierade användare

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Övningar och intyg > varje yrkesroll har övningar, och rätt svar lämnas inte ut före rättningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > alla rätt ger ett intyg som gäller i ett år, och ett fel ger förklaringar men inget intyg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > intyget går ut efter ett år, och systemet varnar 30 dagar innan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, och ingen annan gör det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > övningarna och nyheterna innehåller inga patientuppgifter utom demopatienternas namn, och texterna är svenska | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > ett intyg ändras och raderas aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > verksamhetschefen och en utbildare ändrar övningarna som en ny version med historik, och ingen annan gör det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > en ändrad övning prövas innan den sparas, och systemet säger vad som saknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar och intyg > verksamhetschefen utfärdar utbildarintyg bara till någon på vårdenheten med giltigt intyg | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Utbildning > övningarna ger ett intyg med giltighetstid, och verksamhetschefen ser vårdenhetens intyg | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Utbildning > verksamhetschefen utser en utbildare, och utbildaren ändrar en övning som sparas som en ny version med historik | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Utbildning > hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Övningar per vårdenhet > personalen gör vårdgivarens och den egna vårdenhetens övningar, och de egna har ett eget prefix | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Övningar per vårdenhet > vårdenhetens verksamhetschef och utbildare ändrar de egna övningarna som en ny version med egen historik | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Praktiska prov > utbildaren och verksamhetschefen skapar praktiska prov för vårdenheten, och den som inte är utbildare får inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Praktiska prov > läkaren gör provet i en övningsjournal som systemet väljer, och systemet kontrollerar ordinationen i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Praktiska prov > en anteckning som inte är signerad godkänns inte, och en signerad anteckning godkänns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Praktiska prov > utbildaren följer upp vem som har klarat provet utan att se vilken patient provet gjordes på | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Praktiska prov > systemet väljer en övningsjournal som personen har vårdrelation till, aldrig en skyddad patient, och ett godkänt prov gäller i ett år | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Utbildning > utbildaren skapar ett praktiskt prov, läkaren gör det i övningsjournalen och systemet kontrollerar resultatet | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### 11.2.1.5 Beprövad och standardiserad testmetod

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Kravregistret > saknade eller röda tester ger delvis | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testmetod > testmetoden beskrivs efter ISO/IEC/IEEE 29119-3 med testplan, testdesign, testfall, testprocedurer och testrapporter, och allt den pekar på finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 11.2.1.7 Testprotokoll med spårbarhet till krav

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Kravregistret > status uppfyllt_demo bara när alla tester är gröna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-registret > alla 389 id finns exakt en gång, och varje post har en mappning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Sussa-registret > uppfyllt_demo kräver gröna tester | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| API > krav visar kravregistret | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testprotokoll > varje krav och varje Sussa-post med tester finns med sina testfall, resultat, datum och version | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testprotokoll > ett test som saknas, är rött eller inaktuellt syns som det, och summan räknas ur testfallen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testprotokoll > protokollet säger att inget acceptanstest med en beställare är gjort, också i markdown | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testprotokoll > källan och datumet för varje testfall kommer från filen som testet kördes i | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testprotokoll > docs/testprotokoll.md är skrivet av skriptet med version, kodhash och acceptanstestet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Testprotokoll i API:t > GET /api/krav/testprotokoll är öppen utan inloggning och skapar ingen sandlåda | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 11.2.1.8 Reservlösning för läkemedelsinformation

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Läskopia > en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administrering via API > Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > innehåller bara det servern redan lämnar ut till den inloggade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läskopia > yrkesrollen styr vad läskopian innehåller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Avbrott > läskopian förnyas av sig själv medan personen är inloggad | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > appen startar utan nät från service workern och visar läsläget | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Avbrott > fel reservkod ger väntetid och rätt reservkod öppnar läsläget | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Reservdator för läkemedel > listan har alla inskrivna patienter på vårdenheten med aktuella ordinationer och dagens doser, ur samma svar som de vanliga anropen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Reservdator för läkemedel > bara sjuksköterskor och läkare använder reservdatorn, och bara för den egna vårdenhetens inskrivna patienter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Reservdator för läkemedel > en spärrad vårdenhets ordinationer finns inte med, och skyddad identitet är maskerad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Reservdator för läkemedel > utlämnandet till reservdatorn loggas som en period: en rad när patienten kommer med och en när det slutar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Göra en dator till vårdenhetens reservdator för läkemedel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 11.3.1.5 Plan för implementation av Tillväxt

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Plan för införande av tillväxt > planen har alla delar som Sussa 11.3.1.1 kräver och visas på barnavårdscentralens sida | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.1 Applikationskonfiguration

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > omorganisation: namnbyte förbereds med datum och förhandsvisning, och på dagen byter enheten namn medan det som redan är skrivet visar det gamla namnet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: förhandsvisningen av en sammanslagning visar allt som påverkas med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: sammanslagning på dagen flyttar det som pågår och ligger framåt, och historiken stannar på den gamla vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: efter en sammanslagning gäller spärren mot den gamla vårdenhetens uppgifter som förut, också för personalen på den nya, och de gamla uppgifterna kräver ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: vid namnbyte är det samma enhet, och spärren gäller som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: en omorganisation som ändrar åtkomsten kräver fyra ögon och genomförs först när en annan systemförvaltare har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: en mottagare hos en annan vårdgivare avvisas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: ett namnbyte kräver inte fyra ögon, loggas och kan ångras fram till datumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: personalen som registrerar spärrar ser att patienten kan tillfrågas om spärren ska gälla den nya vårdenheten, utan att något röjs för andra, och ingen spärr sätts automatiskt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: nedläggning stänger vårdenheten, mottagaren tar över det som pågår, och en stängd vårdenhet tar inte emot remisser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: delning fördelar arbetsplatserna och personalen på de nya vårdenheterna och flyttar tidbokens tider framåt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: systemet stoppar ett namn som redan finns, ett datum bakåt i tiden och en enhet som redan ingår i en förberedd förändring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: API: förbereda, avbryta och se förändringarna, utan patientuppgifter, och en förändring som gäller i dag genomförs vid nästa anrop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Förbereda ett namnbyte för en enhet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.3 Applikationskonfiguration

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.4 Omorganisation

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > omorganisation: namnbyte förbereds med datum och förhandsvisning, och på dagen byter enheten namn medan det som redan är skrivet visar det gamla namnet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: förhandsvisningen av en sammanslagning visar allt som påverkas med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: sammanslagning på dagen flyttar det som pågår och ligger framåt, och historiken stannar på den gamla vårdenheten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: efter en sammanslagning gäller spärren mot den gamla vårdenhetens uppgifter som förut, också för personalen på den nya, och de gamla uppgifterna kräver ett aktivt val | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: vid namnbyte är det samma enhet, och spärren gäller som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: en omorganisation som ändrar åtkomsten kräver fyra ögon och genomförs först när en annan systemförvaltare har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: en mottagare hos en annan vårdgivare avvisas med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: ett namnbyte kräver inte fyra ögon, loggas och kan ångras fram till datumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: personalen som registrerar spärrar ser att patienten kan tillfrågas om spärren ska gälla den nya vårdenheten, utan att något röjs för andra, och ingen spärr sätts automatiskt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: nedläggning stänger vårdenheten, mottagaren tar över det som pågår, och en stängd vårdenhet tar inte emot remisser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: delning fördelar arbetsplatserna och personalen på de nya vårdenheterna och flyttar tidbokens tider framåt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: systemet stoppar ett namn som redan finns, ett datum bakåt i tiden och en enhet som redan ingår i en förberedd förändring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > omorganisation: API: förbereda, avbryta och se förändringarna, utan patientuppgifter, och en förändring som gäller i dag genomförs vid nästa anrop | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Förbereda ett namnbyte för en enhet inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |

### 12.1.1.5 Applikationskonfiguration

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.6 Administration

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administration som konfiguration > tidboken och vårdgarantin: reglerna är parametrar med samma standardvärden, och väntelistan räknar gränsen ur det godkända värdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Administration som konfiguration > avgifterna och högkostnadsskyddet: parametrar med fyra ögon som avgiften räknas ur, och sidan säger vad som inte går att ändra | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagrum för avgifter och vårdgaranti > taken för högkostnadsskyddet och slutenvården räknas ur prisbasbeloppet för året | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagrum för avgifter och vårdgaranti > avgiften per vårddag kan inte sättas över lagens tak för det år ändringen gäller | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagrum för avgifter och vårdgaranti > högkostnadsskyddet och åldersgränserna har paragrafen i texten, och avgiftsfriheten för barn är regionens beslut | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagrum för avgifter och vårdgaranti > rabatten följer vårdgivarens godkända avgifter och åldersgränser, inte standardvärdena | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagrum för avgifter och vårdgaranti > vårdgarantin räknas från att remissen utfärdades, med lagrummet i hälso- och sjukvårdsförordningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagrum för avgifter och vårdgaranti > i primärvården gäller bedömningsgarantin i tre dagar för en egen vårdbegäran, och inte de 90 dagarna för specialiserad vård | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för utloggning och rapportering > undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Nivå 2 (runda 13, r4) > E3-27: allt som väntar på godkännande står samlat, och bara det någon annan har föreslagit räknas som att godkänna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.7 Strukturerad information

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > konfiguration: mallens sökord ändras på ett ställe och syns i anteckningsformuläret, och skrivna anteckningar är oförändrade | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mall: en ny mall med ett nytt sökord godkänns av en annan systemförvaltare och används direkt i journalen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mall: systemet sätter koden för ett känt sökord, kontrollerar Snomed CT:s kontrollsiffra och stoppar en kod som redan har ett annat namn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mall: FHIR lämnar ut anteckningen med anteckningstypens och sökordens koder | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mall: en ny version visar vad som påverkas, och skrivna anteckningar ändras inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mattyp: en ny mätvärdestyp kontrolleras mot NPU, LOINC och UCUM, och en kod som redan används stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mattyp: efter godkännandet går den att registrera inom de rimliga värdena, och FHIR lämnar ut den med kod och UCUM | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > mattyp: koden och enheten kan inte ändras när värden finns, men gränserna kan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > fyra ögon: en beslutad version ändras eller raderas inte, ett godkännande prövas igen och allt loggas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > behörighet: bara systemförvaltningen ändrar journalens struktur, och svaren innehåller inga patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > API: systemförvaltaren föreslår en mall och en mätvärdestyp, kollegan godkänner i sin egen inloggning, och konfigurationen stannar i sandlådan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > ram: vårdgivarens ram anger sökord som måste finnas och sökord som får läggas till lokalt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > lokal: en vårdenhets anpassning inom ramen gäller bara på vårdenheten, och en anpassning utanför ramen stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Journalens struktur > ram: en ny ram visar vilka lokala anpassningar som slutar gälla, och de slutar gälla när den godkänns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > ett lokalt kodverk från verksamheten skapas med fyra ögon och dess koder går att hämta i API:t | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > en utgåva gäller först när en annan systemförvaltare har godkänt den, och aldrig bakåt i tiden | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Förvaltning av kodverk > en ny utgåva kontrolleras och jämförs med den som gäller: nya, ändrade och borttagna koder och hur många diagnoser som berörs | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Tobaksvanor > hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.8 Läkemedel

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsregler som konfiguration > interaktioner: vårdgivarens lista är en demoregel med fyra ögon, och en ny interaktion ger en varning vid ordination | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsregler som konfiguration > maxdoser och njurfunktion: högsta dygnsdosen och gränserna för metformin är parametrar som läses vid varje ordination | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsregler som konfiguration > ordinationsorsak och uppföljningsdatum: frivilliga där NLL inte berörs om vårdgivaren väljer det, och alltid krav vid förskrivning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsvarningar vid ordination > NSAID till en äldre patient med apixaban, furosemid och spironolakton ger varningar som nämner varje interaktion | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsvarningar vid ordination > warfarin till en patient med tikagrelor och acetylsalicylsyra ger en varning för trippelbehandling | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsvarningar vid ordination > läkemedel i Nationella läkemedelslistan från en spärrad vårdenhet ingår i interaktionskontrollen när ordinationen sparas, utan att läkemedlet röjs och med loggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsmallar i gränssnittet > en läkare bygger en ny läkemedelsmall med systemets förslag, och den används först när den mallansvariga läkaren har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Läkemedelsmallar i gränssnittet > API: en läkare ändrar en läkemedelsmall i gränssnittet och ser vem som ska godkänna den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.9 Beställning och svar

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > konfiguration: varje parameter har samma standardvärde som modulen som använder den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: systemet kontrollerar att värdet är rimligt och förklarar varför det inte är det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: fyra ögon, den som föreslår kan inte godkänna, och ändringen gäller först från giltighetsdatumet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: en ändring gäller aldrig bakåt i tiden, och ett sent godkännande gäller från beslutsdagen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: förhandsvisningen räknar effekten i dag med bara antal, utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: historiken visar varje ändring med vem som föreslog och godkände, och en beslutad ändring kan inte ändras eller raderas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > konfiguration: API: systemförvaltaren godkänner kollegans ändring och mallarna i anteckningsformuläret följer med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Gränssnitt > Klickbudget > Ändra en demoregel inom budget | Godkänt | Klickbudget i webbläsaren | 2026-11-12 kl. 19:09 svensk tid |
| Systemförvaltning > konfiguration: remissernas larm, dosfönstret, påminnelsen före en tid, stickprovet, gallringsförslaget och hälsoärendena läser det godkända värdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Beställning och svar > paketens innehåll och laboratoriets svarstid ändras på ett ställe och slår igenom i förslagen och svaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för beställning och svar > vad som förs över till det mottagande systemet, etikettskrivarna och anvisningarna ändras med fyra ögon och slår igenom | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Parametrar för beställning och svar > etikettformatet följer parametern för arbetsplatsen där den som skriver ut arbetar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### 12.1.1.10 Undantas från visning

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > undantag: en anteckningstyp undantas från visning med fyra ögon, och journalen säger hur många som inte visas och varför | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: undantaget gäller aldrig Min journal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: undantaget ändrar inte spärrar, och en spärrad uppgift varken visas eller räknas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: FHIR för externa tillämpningar får inte undantagna uppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: publiceringen till nationella tjänster (simulerad) räknar bort det undantagna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: systemet stoppar ett undantag som skulle dölja uppgifter i pågående vård och förklarar varför | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: översikten visar tydligt vad som är undantaget, och ett undantag kan avslutas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > undantag: ett undantag som inte längre är tillåtet kan varken godkännas eller avslutas via konfigurationens väg, och varje väg prövar samma sak | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > roll: systemförvaltaren är en egen demoroll som inte läser journalen och inte har någon arbetslista | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undantag av en enskild anteckning > en enskild anteckning undantas från visning med fyra ögon, och journalen, sökningen och direktläsningen visar den inte | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undantag av en enskild anteckning > en rättelse av en undantagen anteckning är också undantagen, och ett undantag på en anteckning i pågående vård stoppas | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undantag av en enskild anteckning > ett undantag på en spärrad vårdenhets anteckning röjer inget: svaret är detsamma med och utan undantaget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Undantag av en enskild anteckning > FHIR, publiceringen och producenten för tjänstekontrakt prövar samma undantag, och Min journal visar anteckningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Begäran om undantag av en anteckning > journalen visar anteckningens nummer, och den som skrev anteckningen begär undantag med kanal och skäl | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Begäran om undantag av en anteckning > bara den som skrev anteckningen eller en läkare på dess vårdenhet kan begära undantag | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Begäran om undantag av en anteckning > systemförvaltaren ser begäran med nummer, typ, datum, vårdenhet och den som begär, men inte innehållet, och godkänner med en andra systemförvaltare | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Begäran om undantag av en anteckning > systemförvaltaren kan avslå en begäran med en kommentar, och den som begärde ser det | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Begäran om undantag av en anteckning > förhandsvisningen av ett nummer utan begäran ger samma svar för en befintlig, en spärrad, en skyddad och en obefintlig anteckning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Begäran om undantag av en anteckning > en undantagen anteckning syns inte i händelsekedjan, och direkt öppning ger samma svar som en anteckning som inte finns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.1.5 Krav på drift samt maskin- och programvara

Inte alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Miljöer > systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > miljön är märkt i varje svar om sessionen och går inte att återställa, och det går att gå tillbaka till produktionsmiljön | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Miljöer > bara systemförvaltaren skapar miljöer, högst tre per sandlåda och inte ur en annan miljö | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lasttest > 100 samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Lasttest | 2026-11-12 kl. 16:06 svensk tid |
| Lasttest > 500 samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel | Inaktuellt, gränssnittet har ändrats sedan testet kördes | Lasttest | 2026-11-12 kl. 16:06 svensk tid |
| Vilande sandlådor i servern > en sandlåda som inte har använts på tio minuter skrivs till disk och släpps ur minnet, och nästa anrop läser in den med allt kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > en aktiv sandlåda tas aldrig bort för att ge plats åt en ny: med plats för tre i minnet finns alla åtta kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| När demon är full > en ny besökare får 503 med en förklaring på svenska och när det är lönt att försöka igen, och de som redan arbetar märker inget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.1.10 Monitorera kapacitetsbrister

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Vilande sandlådor: lagret > en sandlåda skrivs komprimerad till disk under ett namn som inte röjer id:t och läses in oförändrad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor: lagret > taket i minnet räknas ur containerns minnesgräns, och utan gräns gäller standardvärdet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > en sandlåda som inte har använts på tio minuter skrivs till disk och släpps ur minnet, och nästa anrop läser in den med allt kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > en aktiv sandlåda tas aldrig bort för att ge plats åt en ny: med plats för tre i minnet finns alla åtta kvar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > sidan om systemets uppbyggnad och driftsidan väcker inga andra sandlådor | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > läskopians logg från läsläget tas emot för en sandlåda som vilar, utan inloggning | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > flerfaktor: en inloggning som väntar på engångskoden fortsätter efter att sandlådan har vilat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > prenumerationer ger meddelanden också efter att sandlådan har vilat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > intensivvårdens realtidsvisning från den kopplade monitorn fortsätter efter att sandlådan har vilat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > miljöer för acceptanstest: miljön och produktionsmiljön hittar varandra efter att båda har vilat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > kalenderlänken fungerar för en sandlåda som vilar, och en okänd länk väcker inga sandlådor | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| När demon är full > en ny besökare får 503 med en förklaring på svenska och när det är lönt att försöka igen, och de som redan arbetar märker inget | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| När demon är full > när alla platser i minnet används just nu får en ny besökare vänta, men en besökare vars sandlåda vilar kommer alltid in | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Omstart med vilande sandlådor > vid stopp skrivs sandlådorna till disk, sessionsfilen har inga databaser, och efter start vilar de tills de används | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Missbruk från många besökare > en uppblåst sandlåda tar fler platser i minnet, så att minnet håller sig inom budgeten | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Missbruk från många besökare > en sandlåda kan inte växa över taket för databasen, och anropet som skulle göra det får ett begripligt fel | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.3.3 Krav på datalagring

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: säkerhetskopia till fil med VACUUM INTO och återläsning ger ett konsistent läge med alla tabeller, rader och triggrar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: en kopia som skiljer sig från originalet underkänns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.3.4 Krav på datalagring

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: varje tabell klassas efter huvudman, och ingen tabell är oklassad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: uttaget för en huvudman har bara dess egna uppgifter, och en annan huvudmans uppgifter finns inte med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: uttaget har samma tabeller, index och triggrar som originalet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: uttaget som fil kräver ett beslut med diarienummer och skäl, och fyra ögon | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: filen har bara huvudmannens uppgifter, ett manifest med kontrollsummor, NDJSON per tabell och FHIR per patient, och är märkt som demodata | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: varje patient i uttaget loggas, och filen hämtas genom API:t bara av systemförvaltaren | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.3.5 Datalagring

Alla testfall godkända. Status i registret: delvis.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: varje tabell klassas efter huvudman, och ingen tabell är oklassad | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: uttaget för en huvudman har bara dess egna uppgifter, och en annan huvudmans uppgifter finns inte med | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: uttaget har samma tabeller, index och triggrar som originalet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagringsprognos > prognosen räknar tillväxten det senaste året och skriver fram storleken, också med fördubblad aktivitet | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Lagringsprognos > lagringsklasserna delar upp volymen efter ålder och visar kostnaden per månad med och utan klasser | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.3.6 Dataförlust

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Systemförvaltning > lagring: säkerhetskopia till fil med VACUUM INTO och återläsning ger ett konsistent läge med alla tabeller, rader och triggrar | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: en kopia som skiljer sig från originalet underkänns | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetskopior > varje kopia skrivs på två platser och verifieras på båda, och sandlådans id syns inte i något filnamn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetskopior > en skadad kopia underkänns, och återläsningen tar den från den andra platsen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetskopior > schemaläggningen tar en kopia av varje sandlåda som har ändrats sedan sin senaste kopia, och sparar ett begränsat antal | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetskopior > återställning till en tidpunkt tar den senaste verifierade kopian före tidpunkten, sparar läget före och behåller loggarna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetskopior > bara systemförvaltningen ser och återställer kopiorna | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetskopior > API: systemförvaltaren ser när den senaste kopian togs och om den är verifierad, och återställer sandlådan till en tidpunkt | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > varje migrering har en återställning, och upp och sedan ned ger samma schema som före | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Releaser > återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 1: säkerhetskopiorna har tak > en manuell kopia per minut och tio per timme per sandlåda, sedan 429 med en förklaring | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 1: säkerhetskopiorna har tak > ett tak för diskutrymmet över alla sandlådor, där de äldsta kopiorna tas bort först | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 1: säkerhetskopiorna har tak > det schemalagda jobbet tar en sandlåda i taget och släpper fram andra anrop emellan | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 4: en ensam systemförvaltare kan inte läsa in en kopia, och förslaget säger vad som går förlorat | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 4: en spärr som har registrerats efter kopian stoppar inläsningen med en förklaring, också mellan förslag och godkännande | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 3: en faktor som registrerades efter kopian finns kvar efter inläsningen | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > fynd 3: efter inläsning av en kopia är sessionen utloggad, och en roll med faktor i kopian kräver faktorn | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |
| Vilande sandlådor i servern > en sandlåda som inte har använts på åtta timmar försvinner, också från disk och med sina säkerhetskopior | Godkänt | Servertest | 2026-11-12 kl. 20:02 svensk tid |

### KD1.1.4.3 Krav på följsamhet mot klient och klientplattform

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Tillgänglighet > alla vyer fungerar på mobil, platta och stor skärm utan rullning i sidled och utan för långa textrader | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > vid 320 px bredd behövs ingen rullning i sidled | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > texten går att förstora till 200 procent utan att innehåll eller funktion försvinner | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

### KD1.1.4.10 Bildskärm

Alla testfall godkända. Status i registret: uppfyllt i demon.

| Testfall | Resultat | Körning | Tid |
| --- | --- | --- | --- |
| Gränssnitt > Tillgänglighet > alla vyer fungerar på mobil, platta och stor skärm utan rullning i sidled och utan för långa textrader | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > vid 320 px bredd behövs ingen rullning i sidled | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > texten går att förstora till 200 procent utan att innehåll eller funktion försvinner | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > högkontrastläget ger minst 7:1 i kontrast och följer datorns inställning | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |
| Gränssnitt > Tillgänglighet > flera skärmar: en del av journalen öppnas i ett nytt fönster som följer patientbytet, och ett låst fönster visar tydligt att en annan patient är öppen | Godkänt | Gränssnittstest i webbläsaren | 2026-11-12 kl. 19:52 svensk tid |

## Krav utan testfall

Eget ramverk: D12, L8, L11, L12, M1, M3, M7, M10, M11, M13.

Sussas kravspecifikation: 2.2.1.1, 2.2.1.2, 2.2.1.3, 2.2.1.4, 2.2.1.5, 2.2.1.6, 2.2.1.9, 2.2.1.10, 2.2.1.11, 2.2.1.12, 2.2.1.13, 2.2.1.14, 2.4.1.1, 2.6.1.1, 2.6.1.3, 2.7.1.1, 3.1.4.1, 3.1.4.2, 3.5.1.10, 3.5.2.16, 3.5.4.5, 3.7.1.2, 5.1.4.2, 5.1.4.3, 5.1.4.4, 5.1.4.6, 5.2.1.1, 5.2.1.5, 5.3.1.1, 5.3.1.4, 5.3.1.9, 5.3.1.10, 5.3.1.11, 5.3.1.13, 5.3.1.14, 5.3.1.15, 5.3.1.16, 5.3.1.17, 9.1.1.1, 9.1.1.2, 9.1.1.3, 10.1.1.1, 11.1.1.1, 11.1.1.2, 11.2.1.1, 11.2.1.2, 11.2.1.3, 11.2.1.4, 11.2.1.6, 11.2.1.9, 11.2.1.10, 11.2.1.11, 11.2.1.12, 11.3.1.1, 11.3.1.2, 11.3.1.3, 11.3.1.4, 11.3.1.6, 11.3.1.7, 11.3.1.8, 11.3.1.9, 11.3.1.10, 12.1.1.2, 12.2.1.1, 12.2.1.2, 12.2.1.3, 12.3.1.1, 12.3.1.2, 12.3.1.3, 12.3.1.4, 12.3.1.5, KD1.1.1.1, KD1.1.1.2, KD1.1.1.3, KD1.1.1.4, KD1.1.1.6, KD1.1.1.7, KD1.1.1.8, KD1.1.1.9, KD1.1.1.11, KD1.1.1.12, KD1.1.1.13, KD1.1.2.1, KD1.1.2.2, KD1.1.3.1, KD1.1.3.2, KD1.1.4.1, KD1.1.4.2, KD1.1.4.4, KD1.1.4.5, KD1.1.4.6, KD1.1.4.7, KD1.1.4.8, KD1.1.4.9, KD1.2.1.1, KD1.2.1.2, KD1.2.1.3, KD1.2.1.4, KD1.2.1.5, KD1.3.1.1, KD1.3.1.2, KD1.3.1.3, KD1.3.2.1, KD1.3.2.2, KD1.3.2.3, KD1.3.2.4, KD1.3.3.1, KD1.3.3.2, KD1.3.4.1, KD1.3.4.2, KD1.3.5.1, KD1.3.5.2, KD1.3.6.1, KD1.3.6.2, KD1.3.7.1.
