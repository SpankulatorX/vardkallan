# Behovs- och riskanalys per roll

Det här är Vårdkällans egen behovs- och riskanalys för tilldelningen av behörigheter, enligt patientdatalagen 4 kap. 2 § och HSLF-FS 2016:40 4 kap. 2 och 3 §§. För varje roll beskrivs vilket behov av uppgifter rollen har, vilka risker åtkomsten medför och hur risken begränsas, och vilka handlingar rollen har i behörighetsmotorn (`app/src/atkomst.js`). En vårdgivare som använder Vårdkällan gör sin egen analys utifrån sin verksamhet. Den här analysen är utgångspunkten och visar hur rollerna i systemet är tänkta.

Analysen och koden hänger ihop. Ett test i bygget (`app/test/behorighetsanalys.test.js`) stoppar bygget om en roll i koden saknar analys, om listan med handlingar här skiljer sig från koden eller om en handling som analysen säger att rollen inte ska ha finns i koden.

För alla roller gäller: all behörighet prövas på servern i varje anrop, varje åtkomst till patientuppgifter loggas i en logg som inte går att ändra, och handlingar som rollen saknar nekas och loggas som nekade.

## Läkare (lakare)

Behov: Utreder, diagnostiserar och behandlar. Behöver läsa och skriva hela journalen för patienter med vårdrelation, ordinera läkemedel och cytostatika, beställa prover och undersökningar, bedöma och besvara remisser, kontrasignera och använda nödåtkomst när patienten inte kan samtycka.

Risker: Bredast åtkomst av alla roller, och därmed störst risk för otillåten läsning (nyfikenhet, fel patient) och för felaktiga ordinationer.

Så begränsas risken: Åtkomst bara med vårdrelation på den egna vårdenheten. Andra vårdenheter kräver aktivt val, spärrar kräver patientens samtycke, och nödåtkomst häver aldrig en spärr, loggas och flaggas i logguppföljningen. Ordinationer kontrolleras mot varningsreglerna och kräver motiverad kvittens. Den som signerat kan inte kontrasignera själv.

Får inte: `las_logg`, `konfigurera`, `datauttag`, `faktureringsunderlag`, `sla_samman`, `gallra`.

Handlingar i koden (91): `las_oversikt`, `las_journal`, `las_omvardnad`, `skriv_journal`, `skriv_omvardnad`, `las_lakemedel`, `ordinera`, `las_matvarden`, `registrera_matvarde`, `las_diagnoser`, `las_remiss`, `remittera`, `mottag_remiss`, `bedom_remiss`, `svara_remiss`, `kvittera_svar`, `las_admin`, `sok`, `vantrum`, `nodatkomst`, `andra_enheter`, `samtycke_sparr`, `visa_identitet`, `registrera_patient`, `andra_identitet`, `registrera_vardkontakt`, `vardtillfalle`, `halsoarende`, `skriv_ut`, `utlamna`, `begara_kontrasignering`, `kontrasignera`, `ge_lakemedel`, `delegera`, `faststalla_direktiv`, `faststalla_mall`, `utvardera_lakemedel`, `lakemedelsgenomgang`, `las_vardplan`, `vardplan`, `vardplan_atgard`, `las_tvangsvard`, `tvangsvard`, `samordna`, `godkanna_mall`, `bevaka`, `bevaka_enhet`, `las_tidbok`, `statistik`, `las_kostnader`, `fardigbehandlad`, `hjalpmedel`, `registrera_diagnos`, `kvalitetsregister`, `utbildning`, `las_planering`, `utfora_uppgift`, `planera`, `fordela_remiss`, `remisskonferens`, `las_prover`, `bestalla_prov`, `ta_prov`, `vidimera_provsvar`, `ordinera_kontroll`, `koppla_utrustning`, `godkanna_matvarde`, `anestesibedomning`, `las_operation`, `operation_anmala`, `operation_planera`, `operation_registrera`, `las_graviditet`, `graviditet`, `las_cytostatika`, `ordinera_cytostatika`, `ge_cytostatika`, `forskriva_forbrukning`, `bestalla_lakemedel`, `rapportera_graviditetsregistret`, `undersokning_utfora`, `patientgrupp`, `infart`, `restjournal`, `signeringslista`, `registrera_overkanslighet`, `donation`, `meddelande_invanare`, `vaccinera`, `boka_bhv`, `rapportera_bhvq`.

## Sjuksköterska (sjukskoterska)

Behov: Planerar och ger omvårdnad, ger läkemedel, tar prover och registrerar mätvärden. Behöver läsa journalen och läkemedelslistan och skriva omvårdnadsanteckningar.

Risker: Läsning utan behov, och läkemedel som ges utan giltig ordination.

Så begränsas risken: Kan inte ordinera läkemedel annat än enligt generella direktiv och muntliga ordinationer som läkaren signerar. Samma regler för vårdrelation, aktivt val, spärr och nödåtkomst som för läkaren. Administreringen kontrollerar ordinationen.

Får inte: `ordinera`, `skriv_journal`, `kontrasignera`, `ordinera_cytostatika`, `las_logg`, `konfigurera`.

Handlingar i koden (70): `las_oversikt`, `las_journal`, `las_omvardnad`, `skriv_omvardnad`, `las_lakemedel`, `ge_lakemedel`, `las_matvarden`, `registrera_matvarde`, `las_diagnoser`, `las_remiss`, `las_admin`, `sok`, `vantrum`, `nodatkomst`, `andra_enheter`, `samtycke_sparr`, `visa_identitet`, `registrera_patient`, `andra_identitet`, `registrera_vardkontakt`, `vardtillfalle`, `halsoarende`, `skriv_ut`, `utlamna`, `begara_kontrasignering`, `delegera`, `ordinera_direktiv`, `registrera_muntlig_ordination`, `utvardera_lakemedel`, `las_vardplan`, `vardplan`, `vardplan_atgard`, `las_tvangsvard`, `samordna`, `bevaka`, `bevaka_enhet`, `las_tidbok`, `statistik`, `las_kostnader`, `hjalpmedel`, `kvalitetsregister`, `utbildning`, `las_planering`, `utfora_uppgift`, `planera`, `las_prover`, `bestalla_prov_uppdrag`, `ta_prov`, `koppla_utrustning`, `godkanna_matvarde`, `las_operation`, `operation_planera`, `operation_registrera`, `las_graviditet`, `graviditet`, `las_cytostatika`, `ge_cytostatika`, `forskriva_forbrukning`, `bestalla_lakemedel`, `rapportera_graviditetsregistret`, `undersokning_utfora`, `patientgrupp`, `infart`, `restjournal`, `registrera_overkanslighet`, `donation`, `meddelande_invanare`, `vaccinera`, `boka_bhv`, `rapportera_bhvq`.

## Undersköterska (underskoterska)

Behov: Omvårdnad, mätvärden och provtagning. Behöver se läkemedel, mätvärden, överkänslighet och omvårdnadsanteckningar.

Risker: Tillgång till känsliga läkaranteckningar och diagnoser som inte behövs för uppgiften.

Så begränsas risken: Läser inga läkaranteckningar och inga diagnoser. Ger läkemedel bara med en giltig delegering i dag. Ingen nödåtkomst.

Får inte: `las_journal`, `las_diagnoser`, `ordinera`, `nodatkomst`, `skriv_journal`.

Handlingar i koden (24): `las_oversikt`, `las_omvardnad`, `las_lakemedel`, `las_matvarden`, `registrera_matvarde`, `las_admin`, `sok`, `vantrum`, `andra_enheter`, `samtycke_sparr`, `visa_identitet`, `skriv_ut`, `ge_lakemedel`, `las_vardplan`, `vardplan_atgard`, `las_tvangsvard`, `utbildning`, `las_planering`, `utfora_uppgift`, `las_prover`, `bestalla_prov_uppdrag`, `ta_prov`, `koppla_utrustning`, `las_operation`.

## Vårdadministratör (vardadministrator)

Behov: Tar emot remisser, bokar, kallar, checkar in, registrerar vårdkontakter och patienter och hanterar kassan.

Risker: Insyn i journaltext eller läkemedel utan vårdbehov.

Så begränsas risken: Ser kontaktuppgifter, vårdkontakter och remissernas status men ingen journaltext och inga läkemedel. Åtkomsten grundas som administrativ uppgift.

Får inte: `las_journal`, `las_omvardnad`, `las_lakemedel`, `las_diagnoser`, `ordinera`.

Handlingar i koden (36): `las_admin`, `las_remiss_status`, `mottag_remiss`, `sok`, `vantrum`, `andra_enheter`, `visa_identitet`, `registrera_patient`, `andra_identitet`, `sla_samman`, `registrera_vardkontakt`, `skriv_ut`, `utlamna`, `boka`, `kalla`, `checka_in`, `vantelista`, `bevaka`, `bevaka_enhet`, `las_tidbok`, `statistik`, `las_kostnader`, `lma`, `registrera_sparr`, `utbildning`, `remittera_pa_uppdrag`, `fordela_remiss`, `remisskonferens`, `registrera_beslut_pa_uppdrag`, `registrera_extern_remiss`, `undersokning_utfora`, `restjournal`, `meddelande_invanare`, `fullmakt`, `kassa`, `kapacitet`.

## Logggranskare (logggranskare)

Behov: Följer upp åtkomstloggen och gör stickprovskontroller enligt HSLF-FS 2016:40 4 kap. 9 och 9 b §§.

Risker: Loggen visar vilka patienter som har vårdats var, och granskaren skulle kunna läsa journalen.

Så begränsas risken: Läser loggen men aldrig journalen. Loggen kan inte ändras, och granskningarna sparas.

Får inte: `las_journal`, `las_oversikt`, `las_lakemedel`.

Handlingar i koden (3): `las_logg`, `sok`, `utbildning`.

## Arkivarie (arkivarie)

Behov: Registrerar beslut, skapar exportpaket till e-arkiv och verkställer gallring och förstöring efter beslut.

Risker: Att journaler utplånas utan beslut.

Så begränsas risken: Läser inte journalen. Gallring tar bara journaler äldre än tio år efter den sista uppgiften, och allt loggas.

Får inte: `las_journal`, `las_oversikt`, `ordinera`.

Handlingar i koden (5): `registrera_arkivbeslut`, `arkivera`, `gallra`, `utbildning`, `forskning_godkann`.

## Analytiker (uppföljning) (uppfoljning)

Behov: Hämtar datauttag och statistik för verksamhetsuppföljning och rapporterar till myndigheter och register.

Risker: Att uppgifter går att knyta till enskilda patienter.

Så begränsas risken: Datauttaget saknar namn och personnummer och använder pseudonymer. Små tal spärras. Läser inte journalen.

Får inte: `las_journal`, `las_oversikt`, `sok`.

Handlingar i koden (6): `datauttag`, `statistik_region`, `myndighetsrapport`, `utbildning`, `anvandartest_las`, `forskning_bestall`.

## Farmaceut (farmaceut)

Behov: Gör farmaceutens bedömning i läkemedelsgenomgången och bereder cytostatika.

Risker: Tillgång till journaltext som inte behövs för läkemedelsbedömningen.

Så begränsas risken: Läser läkemedelslistan, mätvärden och diagnoser men inga journalanteckningar. Ordinerar inte.

Får inte: `las_journal`, `ordinera`, `skriv_journal`.

Handlingar i koden (12): `las_oversikt`, `las_lakemedel`, `las_matvarden`, `las_diagnoser`, `las_admin`, `sok`, `andra_enheter`, `samtycke_sparr`, `visa_identitet`, `lakemedelsgenomgang`, `utbildning`, `bereda_cytostatika`.

## Kommunens personal (simulerad) (kommun)

Behov: Samordnad planering inför utskrivning.

Risker: Att en annan huvudman läser regionens journal.

Så begränsas risken: Ser bara det regionen har skickat i samordnad planering och läser aldrig journalen.

Får inte: `las_journal`, `las_oversikt`, `sok`.

Handlingar i koden (2): `samverkan`, `utbildning`.

## Verksamhetschef (verksamhetschef)

Behov: Utser uppdrag i läkemedelshanteringen, fastställer direktiv, utfärdar utbildarintyg och följer vårdenhetens intyg och signeringslistan.

Risker: Att chefsrollen används för att läsa enskilda patienters journaler.

Så begränsas risken: Läser inte journalen. Uppgifterna gäller den egna vårdenheten.

Får inte: `las_journal`, `las_oversikt`, `ordinera`.

Handlingar i koden (7): `lakemedelsansvar`, `utbildning`, `intyg_enhet`, `forskning_godkann`, `signeringslista`, `godkanna_gallring`, `vyforval`.

## Ekonom (ekonom)

Behov: Hämtar faktureringsunderlag och ändrar prislistor.

Risker: Att ekonomiska underlag röjer vårdinnehåll eller skyddade personuppgifter.

Så begränsas risken: Läser inte journalen. Underlaget innehåller aldrig namn eller adress för en patient med skyddade personuppgifter.

Får inte: `las_journal`, `las_oversikt`, `sok`.

Handlingar i koden (3): `faktureringsunderlag`, `prislista`, `utbildning`.

## Systemförvaltare (systemforvaltare)

Behov: Ändrar regler och parametrar, förbereder omorganisationer, beslutar om undantag och förvaltar det öppna API:t.

Risker: Att ändringar i konfigurationen ger någon åtkomst eller ändrar regler utan kontroll.

Så begränsas risken: Läser inte journalen. Ändringar kräver fyra ögon, det vill säga en andra systemförvaltare i sin egen inloggning, och loggas.

Får inte: `las_journal`, `las_oversikt`, `ordinera`.

Handlingar i koden (7): `konfigurera`, `omorganisera`, `undanta`, `lagring`, `forvalta_api`, `utbildning`, `vyforval`.

## Fysioterapeut (fysioterapeut)

Behov: Läser journalen, skriver anteckningar, registrerar mätvärden och skickar, tar emot och besvarar remisser.

Risker: Läsning utan behov och läkemedel som ordineras utanför yrkets ansvar.

Så begränsas risken: Ordinerar och ger inga läkemedel. Samma regler för vårdrelation, aktivt val och spärr som för övrig vårdpersonal.

Får inte: `ordinera`, `ge_lakemedel`, `nodatkomst`.

Handlingar i koden (33): `las_oversikt`, `las_journal`, `las_omvardnad`, `skriv_omvardnad`, `las_lakemedel`, `las_matvarden`, `registrera_matvarde`, `las_diagnoser`, `las_remiss`, `remittera`, `mottag_remiss`, `bedom_remiss`, `svara_remiss`, `kvittera_svar`, `las_admin`, `sok`, `andra_enheter`, `samtycke_sparr`, `visa_identitet`, `skriv_ut`, `las_vardplan`, `vardplan_atgard`, `bevaka`, `bevaka_enhet`, `las_tidbok`, `statistik`, `utbildning`, `las_planering`, `utfora_uppgift`, `planera`, `fordela_remiss`, `remisskonferens`, `meddelande_invanare`.

## Systemkonto för en tillämpning (systemkonto)

Behov: En tillämpning utan inloggad person hämtar avgränsade uppgifter genom det öppna API:t (SMART Backend Services). En organisation som är ansluten via tjänstekontrakt i RIVTA (NPÖ, Journalen och sammanhållen journalföring) läser journalanteckningar och åtgärder för de vårdenheter den är ansluten för.

Risker: Att en tillämpning hämtar mer än den behöver, utan en person som ansvarar i stunden. Att journalanteckningar lämnas ut till en organisation som inte ska ha dem.

Så begränsas risken: Prövas mot kontots vårdenheter och informationsmängder, aldrig med vårdrelation, med pseudonymer som förval. Kan bara läsa. Journalanteckningar och åtgärder (las_journal) är informationsmängder som bara ett konto för en anslutning via tjänstekontrakt kan få, aldrig ett konto som registreras för det öppna API:t, och aldrig för patienter med skyddade personuppgifter eller spärrade uppgifter.

Får inte: `skriv_journal`, `ordinera`, `nodatkomst`.

Handlingar i koden (6): `las_oversikt`, `las_diagnoser`, `las_matvarden`, `las_lakemedel`, `las_admin`, `las_journal`.
