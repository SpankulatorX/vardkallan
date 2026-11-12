# Införande, utbildning och test

Mall för projektplan, utbildningsplan och planer för specialområden vid införandet av Vårdkällan, och hur testerna fram till beställarens acceptanstest görs med projektets testmetod.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 11.2.1.1 | Grundimplementation i projektform | Skallkrav vid anbud |
| 11.2.1.6 | Ansvar för tester fram till acceptanstest | Skallkrav vid anbud |
| 11.2.1.9 | Projektplan för grundimplementationen | Skallkrav vid anbud |
| 11.2.1.10 | Plan för grundimplementation | Utvärderingskriterium |
| 11.2.1.11 | Utbildningsplan för grundimplementationen | Skallkrav vid anbud |
| 11.2.1.12 | Utbildning | Utvärderingskriterium |
| 12.2.1.1 | Test | Skallkrav vid anbud |
| 12.2.1.2 | Test | Skallkrav vid anbud |
| 12.2.1.3 | Testmetod och process | Utvärderingskriterium |
| 11.3.1.1 | Planer för implementation av specialområden | Skallkrav vid anbud |

## Syfte och ansvar

Grundimplementationen ska drivas i projektform (11.2.1.1) med en projektplan som beställaren godkänner (11.2.1.9, 11.2.1.10), en utbildningsplan (11.2.1.11, 11.2.1.12) och planer för specialområdena (11.3.1.1). Leverantören ansvarar för tester fram till beställarens acceptanstest (11.2.1.6, 12.2.1.2) och arbetar efter en beprövad och standardiserad testmetod (12.2.1.1, 12.2.1.3). Planerna nedan är mallar för den organisation som inför systemet. Projektet bakom Vårdkällan bidrar med testmetoden, kravregistret, testerna och utbildningsmiljön.

## Det systemet redan har som stöd

| Stöd | Vad det ger | Var det finns |
| --- | --- | --- |
| Kravregistret | Sussas 389 poster med status och de tester som visar varje krav | [`app/src/sussa/index.js`](../../app/src/sussa/index.js), [`app/src/krav.js`](../../app/src/krav.js) |
| Testmetoden | Dokumentstrukturen i ISO/IEC/IEEE 29119-3 med vad som motsvarar varje dokument (11.2.1.5) | [`docs/testmetod.md`](../testmetod.md), [`app/src/testmetod.js`](../../app/src/testmetod.js) |
| Testresultat | Resultatet per test från det senaste bygget, och för gränssnittet med en hash av gränssnittet | [`app/klienttest-resultat.json`](../../app/klienttest-resultat.json), [`app/src/klientresultat.js`](../../app/src/klientresultat.js) |
| Spårbarhet från krav till test | Kravsidan visar testerna och deras status för varje krav (11.2.1.7) | [`app/src/sussa/index.js`](../../app/src/sussa/index.js) |
| Miljöer | Acceptanstestmiljö med avidentifierade data och utbildnings- och testmiljö med fiktiva data (KD1.1.1.5) | [`app/src/miljoer.js`](../../app/src/miljoer.js) |
| Utbildning | Övningar per yrkesroll med intyg i utbildningsmiljön, och utbildare med eget intyg | [`app/src/utbildning.js`](../../app/src/utbildning.js) |
| Användartest | Protokoll och sammanställning för test med personer som arbetar i vården | [`docs/anvandartest.md`](../anvandartest.md) |
| Klickbudget | Hur många klick varje vanligt arbetsflöde får ta | [`app/src/klickbudget.js`](../../app/src/klickbudget.js) |
| Uppgraderingar | Versioner med återgång, godkända med fyra ögon | [`app/src/releaser.js`](../../app/src/releaser.js) |

Utbildningsmaterialet för grundimplementationen skrivs som en egen del av projektet.

## Att fylla i för den som driver systemet

### Projektplan för grundimplementationen (11.2.1.9, 11.2.1.10)

Beställaren ska kunna börja arbetet med integrationer i kategori B och C senast sex månader efter att avtalet har tecknats.

| Del i planen | Innehåll |
| --- | --- |
| Organisation och kompetens | [fyll i: projektledning, en person med ansvar för helheten, roller och kompetens] |
| Leveransobjekt | [fyll i: produktionsmiljö, övriga miljöer, integrationer, migrering, utbildning, dokument] |
| Tid- och aktivitetsplan | [fyll i: aktiviteter med start och slut] |
| Mötesforum | [fyll i: styrgrupp, projektgrupp, samverkan med beställaren och hur ofta de möts] |
| Milstolpar | Se tabellen nedan |
| Utbildningsaktiviteter | Se utbildningsplanen nedan |
| Roller och ansvar | [fyll i: leverantörens och beställarens roller] |
| Testaktiviteter | Se avsnittet om test nedan |
| Övergripande risker | Se tabellen över risker nedan |
| Ändringshantering | [fyll i: hur ändringar i omfattning, tid och kostnad beslutas] |
| Förväntningar på beställaren | [fyll i: till exempel resurser för konfiguration, integrationer, förändringsledning och acceptanstest] |
| Beställarens aktiviteter | [fyll i: till exempel klientmiljö, nät efter överlämningspunkten och förändringsarbete i verksamheten] |

| Milstolpe | Tidpunkt | Kriterium för att den är nådd |
| --- | --- | --- |
| Projektet startat | [fyll i] | Projektplanen är godkänd av beställaren |
| Driftmiljön klar | [fyll i] | Produktion och övriga miljöer finns, med säkerhetskopior som provåterläses |
| Integrationer i kategori B och C kan påbörjas | Senast sex månader efter avtal | Testmiljö och dokumentation av API:t finns för beställaren |
| Utbildningsmaterial klart | Senast vid start av acceptanstest | Material och övningar finns i utbildningsmiljön |
| Leverantörens tester klara | [fyll i] | Testprotokoll med spårbarhet till kraven är överlämnat |
| Acceptanstest godkänt | [fyll i] | Beställaren har godkänt |
| Driftstart | [fyll i] | [fyll i] |

| Risk | Sannolikhet | Konsekvens | Åtgärd |
| --- | --- | --- | --- |
| Riktiga integrationer (till exempel nationell patientöversikt, läkemedelslistan och laboratorier) saknas i dag och är simulerade | Hög | Hög | [fyll i] |
| Migrering från dagens journalsystem | [fyll i] | [fyll i] | [fyll i] |
| Systemet är inte prövat i alla webbläsare som beställaren stödjer | [fyll i] | [fyll i] | Se dokumentet om klienter |
| Bedömning som medicinteknisk produkt ([`docs/mdr-bedomning.md`](../mdr-bedomning.md)) | [fyll i] | [fyll i] | [fyll i] |
| [fyll i: fler risker] | [fyll i] | [fyll i] | [fyll i] |

### Utbildningsplan för grundimplementationen (11.2.1.11, 11.2.1.12)

| Kategori | Utbildningsform | Verktyg och metod | Tidpunkt | Anpassning |
| --- | --- | --- | --- | --- |
| Beställarens projektdeltagare och förändringsledare | [fyll i: till exempel lärarledda pass och arbete i utbildningsmiljön] | Utbildningsmiljön med fiktiva patienter och övningarna per yrkesroll | [fyll i] | [fyll i] |
| Förvaltningsresurser, till exempel systemförvaltare | [fyll i] | Rollen systemförvaltare i utbildningsmiljön: regler och parametrar, uppgraderingar och återställning med fyra ögon | [fyll i] | [fyll i] |
| Utbildare | [fyll i] | Utbildarintyget, som verksamhetschefen utfärdar, och ändring av övningar med versioner ([`app/src/utbildning.js`](../../app/src/utbildning.js)) | [fyll i] | [fyll i] |

- [ ] Metod för kvalitetssäkring och uppföljning: intygen per vårdenhet visar vem som har ett giltigt intyg, och [fyll i: utvärdering efter utbildningen]
- [ ] Planen är godkänd av beställaren: [fyll i: datum]

### Test fram till acceptanstest (11.2.1.6, 12.2.1.1, 12.2.1.2, 12.2.1.3)

| Testnivå | Ansvar | Hur det görs |
| --- | --- | --- |
| Enhets- och integrationstester i koden | Projektet och den som ändrar koden | Automatiskt i varje bygge enligt [`docs/testmetod.md`](../testmetod.md) |
| Gränssnittstester, klickbudget och mobil | Projektet | Automatiskt i en riktig webbläsare, resultat i [`app/klienttest-resultat.json`](../../app/klienttest-resultat.json) |
| Test av integrationer som leverantören ansvarar för | Driften | [fyll i: miljö och testfall] |
| Test i beställarens klientmiljö | Driften med beställaren | [fyll i] |
| Prestanda och belastning | Driften | Lasttestet för 100 och 500 användare ([`app/lasttest.json`](../../app/lasttest.json)) och [fyll i: mätning i den egna miljön] |
| Testprotokoll med spårbarhet till kraven | Driften | Ur kravregistret och testresultaten, [fyll i: format] |
| Acceptanstest | Beställaren | I acceptanstestmiljön med avidentifierade data |

### Planer för specialområden (11.3.1.1)

En plan med samma delar som projektplanen tas fram för varje specialområde som ska införas (11.3.1.2 till 11.3.1.9): Beställning och svar, SIP och SPU, Bildhantering, Tillväxt, Operationsplanering, Anestesi och intensivvård, Obstetrik och förlossning och Cytostatika.

| Specialområde | Organisation | Leveransobjekt | Milstolpar | Test | Utbildning | Risker | Beställarens aktiviteter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [fyll i: område] | [fyll i] | [fyll i] | [fyll i] | [fyll i] | [fyll i] | [fyll i] | [fyll i] |

## Förkortningar

- API: gränssnitt för program (application programming interface)
- IEC: Internationella elektrotekniska kommissionen, som ger ut standarder tillsammans med ISO
- IEEE: en internationell organisation för ingenjörer inom elektroteknik och elektronik som ger ut standarder (Institute of Electrical and Electronics Engineers)
- ISO: Internationella standardiseringsorganisationen
- SIP: samordnad individuell plan
- SPU: samordnad planering vid utskrivning från sluten vård

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
