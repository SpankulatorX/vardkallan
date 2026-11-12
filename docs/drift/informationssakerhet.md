# Systematiskt informationssäkerhetsarbete

Mall för den driftansvariges ledningssystem för informationssäkerhet i tjänsteleveransen, och en beskrivning av det säkerhetsarbete som projektet gör i utvecklingen av Vårdkällan.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.1 | Dokumenterat systematiskt informationssäkerhetsarbete | Skallkrav vid leverans |
| 5.3.1.17 | Informationssäkerhetsarbete kopplat till tjänsteleveransen | Utvärderingskriterium |

## Syfte och ansvar

Leverantören ska ha ett dokumenterat systematiskt arbete med informationssäkerhet för tjänsteleveransen (5.3.1.1) och beskriva det utifrån standarder, processer och kontroller, personalens kompetens och lämplighet, certifieringar, riskminimering och ständiga förbättringar (5.3.1.17). Arbetet hör till den organisation som driver systemet. Projektet bakom Vårdkällan har ett säkerhetsarbete i utvecklingen, som beskrivs först, och som den driftansvarige kan bygga vidare på.

## Det systemet redan har som stöd

### Säkerhetsarbetet i utvecklingen

| Del | Vad som görs | Var det finns |
| --- | --- | --- |
| Hotmodell | Yttre och inre hot, kontrollen för varje hot, principen den följer och testerna som visar att den fungerar. Bygget stoppas om ett test saknas eller är rött | [`app/src/hotmodell.js`](../../app/src/hotmodell.js), [`docs/sakerhetsarkitektur.md`](../sakerhetsarkitektur.md) |
| Behörighetsanalys | Varje roll med behov, risker och vad rollen inte får | [`docs/behorighetsanalys.md`](../behorighetsanalys.md) |
| Skyddsbehov | Varje informationstyp har en klassning som styr stickprov och urval | [`app/src/skyddsbehov.js`](../../app/src/skyddsbehov.js) |
| Säkerhetsgranskning | Ändringarna granskas, och fynden läggs i en lista tills de är rättade och testade. Ett villkor för version 1.0 är att listan är tom | [`app/src/sakerhetsfynd.json`](../../app/src/sakerhetsfynd.json), [`app/src/version.js`](../../app/src/version.js), [`docs/design.md`](../design.md) |
| Tester | Varje krav pekar på de automatiska tester som visar det. Det finns tester för att uppgifter inte lämnas ut till fel person, till exempel att en extern tillämpning aldrig får mer än personen och att invånaren inte får mer än i Min journal | [`app/src/sussa/index.js`](../../app/src/sussa/index.js), [`app/test/oppet-api.test.js`](../../app/test/oppet-api.test.js), [`app/test/patientvy.test.js`](../../app/test/patientvy.test.js) |
| Bygget | Servertesterna körs i bygget, och bygget stoppas vid ett rött test | [`app/Dockerfile`](../../app/Dockerfile), [`app/scripts/kor-tester.js`](../../app/scripts/kor-tester.js) |
| Kontroll av koder | Koder i seeden och FHIR-API:t kontrolleras mot primärkällan | [`docs/kodkontroll.md`](../kodkontroll.md) |
| Beroenden | Inga externa paket, vilket minskar risken i leveranskedjan | [`app/package.json`](../../app/package.json) |
| Testmetod | Testerna följer dokumentstrukturen i ISO/IEC/IEEE 29119-3 | [`docs/testmetod.md`](../testmetod.md) |
| Medicinteknisk bedömning | Bedömning mot förordningen om medicintekniska produkter | [`docs/mdr-bedomning.md`](../mdr-bedomning.md) |

### Det projektet inte har

Projektet har inget certifierat ledningssystem, ingen extern säkerhetsgranskning och inget penetrationstest. Projektet driver inte systemet för någon vårdgivare. Kontroller av personal, avtal med underleverantörer och uppföljning av driften är därför den driftansvariges.

## Att fylla i för den som driver systemet

### Grund för arbetet

| Område | Beskrivning |
| --- | --- |
| Standarder | Ledningssystem enligt ISO/IEC 27001 med åtgärder enligt ISO/IEC 27002. [fyll i: version och omfattning] |
| Certifiering | [fyll i: certifikat, certifieringsorgan och giltighet, eller plan för certifiering] |
| Informationssäkerhetspolicy | [fyll i: dokument och vem som har beslutat den] |
| Ansvarig för informationssäkerheten | [fyll i: roll] |
| Omfattning | Driften av Vårdkällan med produktion och övriga miljöer, datahallar, nät och support. [fyll i: avgränsningar] |

### Riskanalys och riskminimering

- [ ] Riskanalys för tjänsteleveransen med hotmodellen i [`docs/sakerhetsarkitektur.md`](../sakerhetsarkitektur.md) som underlag: [fyll i: datum och nästa översyn]
- [ ] Klassning av informationen tillsammans med beställaren, med systemets klassning som utgångspunkt: [fyll i]
- [ ] Plan för de risker som inte accepteras, med ansvarig och tidpunkt: [fyll i]
- [ ] Ny riskanalys vid större ändringar, till exempel en ny integration eller en ny datahall: [fyll i: rutin]

### Processer och kontroller

| Process | Kontroll | Uppföljning |
| --- | --- | --- |
| Behörigheter för driften | Se dokumentet om åtkomst för drift och support | [fyll i: hur ofta] |
| Ändringar i produktionen | Fyra ögon och gröna tester ([`app/src/releaser.js`](../../app/src/releaser.js)) | [fyll i] |
| Säkerhetsuppdateringar | [fyll i] | [fyll i] |
| Säkerhetskopior och provåterläsning | Verifiering på två platser ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)) | [fyll i] |
| Logguppföljning | Stickprov i systemet ([`app/src/logguppfoljning.js`](../../app/src/logguppfoljning.js)) och driftens egna loggar | [fyll i] |
| Incidenter | Incidentregistret i vyn Servicenivåer och incidenter (`#/servicenivaer`) | [fyll i] |
| Fysiskt skydd | Se dokumentet om fysiskt skydd | [fyll i] |
| Kontinuitet | [fyll i: kontinuitetsplan och övningar] | [fyll i] |

### Personal, kompetens och lämplighet

- [ ] Bakgrundskontroll och säkerhetsprövning före anställning eller uppdrag: [fyll i: vilka roller och hur]
- [ ] Tystnadsplikt eller sekretessförbindelse: [fyll i]
- [ ] Utbildning i informationssäkerhet vid start och därefter minst en gång om året: [fyll i]
- [ ] Krav på kompetens för varje roll i driften: [fyll i]
- [ ] Rutin när någon slutar, med borttagen åtkomst samma dag: [fyll i]

### Leverantörer och underleverantörer

- [ ] Förteckning över underleverantörer med vad de har tillgång till: [fyll i]
- [ ] Personuppgiftsbiträdesavtal och krav på informationssäkerhet i varje avtal: [fyll i]
- [ ] Uppföljning av underleverantörerna: [fyll i: hur ofta och hur]
- [ ] Var uppgifterna behandlas och lagras geografiskt: [fyll i]

### Ständiga förbättringar

- [ ] Intern revision av ledningssystemet: [fyll i: hur ofta]
- [ ] Ledningens genomgång: [fyll i: hur ofta]
- [ ] Lärdomar från incidenter och granskningar förs in i rutinerna och, när det gäller systemet, som fynd och tester i koden: [fyll i: hur ärendet lämnas till projektet]

## Förkortningar

- API: gränssnitt för program (application programming interface)
- FHIR: HL7:s standard för utbyte av vårdinformation (Fast Healthcare Interoperability Resources)
- IEC: Internationella elektrotekniska kommissionen, som ger ut standarder tillsammans med ISO
- IEEE: en internationell organisation för ingenjörer inom elektroteknik och elektronik som ger ut standarder (Institute of Electrical and Electronics Engineers)
- ISO: Internationella standardiseringsorganisationen

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
