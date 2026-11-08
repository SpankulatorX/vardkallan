# Informationsmodell mot Nationell informationsstruktur

Vårdkällans uppgifter är mappade mot informationsklasserna i Nationell informationsstruktur (NI) 2023:2, Modeller för hälso- och sjukvård, från Socialstyrelsen. Ansvaret för NI flyttas till E-hälsomyndigheten. Mappningen finns i `app/src/informationsmodell.js` och `app/src/informationsmodell-ni.json`, och samma modell lämnas ut av `GET /api/informationsmodell`, räknad ur databasen och FHIR-API:ts CapabilityStatement.

Så läses tabellerna nedan:

- Varje tabell med patientuppgifter har en klass. En ny tabell som ingen har klassat får NI:s allmänna klass Uppgift i patientjournal och visas som allmänt klassad i API:t och på sidan Kodverk och masterdata.
- Diagnoser och mätvärden är Observation med typ och värde, som NI beskriver diagnosen: typen är huvud- eller bidiagnos och värdet diagnoskoden.
- En ordination är ett Beslut enligt termbankens definition av ordination, och givna doser är utförda Aktiviteter.
- FHIR-resurserna för kodverk och definitioner (CodeSystem, ValueSet, StructureDefinition) motsvaras av Tillämpad modell, eftersom de beskriver strukturen och inte uppgifter om patienten.
- För vårdkontakter, diagnoser, mätvärden, åtgärder, beställningar, remisser och egna vårdbegäranden pekar NI:s attribut (typ, tid, status, värde, kod, prioritet, orsak) på tabellernas kolumner. Övriga attribut är inte mappade.

Modellerna för vård och omsorg och för socialtjänst är inte mappade.

| Informationsklass i NI | Definition | Tabeller i Vårdkällan | FHIR-resurser |
|---|---|---|---|
| Aktivitet | Klassen aktivitet håller information om något som kan utföras av någon eller något inom hälso- och sjukvård och som är inriktat på visst resultat. | `administreringar`, `atgarder`, `vaccinationer`, `lakemedelsgenomgangar`, `planerade_uppgifter`, `labb_bestallningar`, `labb_analyser`, `vidimeringar`, `kontrasigneringar` | MedicationAdministration, Procedure, Immunization |
| Annan person | Klassen annan person håller information om en person som på något sätt är relaterad till patienten men som inte är patienten eller hälso- och sjukvårdspersonal. | `vardnadshavare` |  |
| Beslut | Klassen beslut håller information om avgörande i viss fråga inom hälso- och sjukvård. | `ordinationer`, `kontrollordinationer`, `vantelista`, `tvangsvard_perioder`, `tvangsvard_handelser`, `sparrar` | MedicationRequest |
| Beslutsstatus | Klassen beslutsstatus håller information om vilken status ett visst beslut har. |  |  |
| Deltagande | Klassen deltagande håller information om på vilket sätt exempelvis hälso- och sjukvårdspersonal, organisation, patient eller resurs deltar i ett visst givet sammanhang. |  |  |
| Dokument | Klassen dokument håller information om samling av information som behandlas och fungerar som en enhet. | `kallelser`, `anteckningar`, `vardplaner` | Composition, CarePlan, List |
| Hälso- och sjukvårdspersonal | Klassen hälso- och sjukvårdspersonal håller information om person som i sitt uppdrag för en hälso- och sjukvårdsorganisation utför hälso- och sjukvård. | `personal` | Practitioner |
| Individanpassad vårdprocess | Klassen individanpassad vårdprocess håller information om den vårdprocess som är anpassad för en enskild patient. | `samordningar` | EpisodeOfCare |
| Kommunikationssätt | Klassen kommunikationssätt håller information om en persons sätt att kommunicera med sin omgivning. | `kanalval`, `sprakval` |  |
| Kroppsstruktur | Klassen kroppsstruktur håller information om kroppens anatomiska delar såsom organ, lemmar och deras komponenter, inklusive sidoangivelse (lateralitet) och ytterligare precisering. |  |  |
| Observation | Klassen observation håller information om tillstånd, problem, behov och omgivningsfaktorer som har observerats eller som i framtiden skulle kunna observeras om en patient. | `diagnoser`, `matvarden`, `hemmatningar`, `overkanslighet`, `uppmarksamhet`, `tillvaxt_uppgifter`, `labb_svar`, `transportbehov` | Condition, Observation, AllergyIntolerance, Flag, DiagnosticReport |
| Organisation | Klassen organisation håller information om verksamhet med ansvar och befogenhet att tillvarata intressen som är gemensamma för de ingående medlemmarna eller intressenterna. | `enheter` | Organization |
| Patient | Klassen patient håller information om person som erhåller eller är registrerad för att erhålla hälso- och sjukvård. | `patienter` | Patient |
| Person | Klassen person håller information om den mänskliga individen. | `identiteter` |  |
| Plats | Klassen plats håller information om avgränsad geografisk eller fysisk yta med välbestämt läge. | `vantrum` |  |
| Position | Klassen position håller information om plats specificerat med longitud och latitud samt eventuellt altitud. |  |  |
| Remiss | Klassen remiss håller information om vårdbegäran från hälso- och sjukvårdspersonal som utgör beställning av tjänst eller begäran om övertagande av vårdansvar för en patient. | `remisser` | ServiceRequest |
| Resurs | Klassen resurs håller information om något som kan tas i anspråk för, krävs för genomförande av eller produceras i aktiviteter eller processer inom hälso- och sjukvård och som inte avser personer eller organisationer. | `labb_prov`, `resurser`, `katalog`, `hjalpmedel_utlamnade` | Specimen, Schedule, Slot |
| Samband | Klassen samband håller information om hur två företeelser dokumenterade som uppgifter i patientjournal är relaterade till varandra. |  |  |
| Tillämpad modell | Klassen tillämpad modell beskriver hur information om en specifik företeelse ska struktureras enligt en på förhand fastställd uppsättning uppgifter i patientjournal och tillhörande relationer. |  | Subscription, StructureDefinition, CodeSystem, ValueSet |
| Uppgift i patientjournal | Klassen uppgift i patientjournal håller information om uppgifter som dokumenteras i patientjournalen. |  | AuditEvent, ChargeItem |
| Vårdbegäran | Klassen vårdbegäran håller information om begäran om hälso- och sjukvård. |  |  |
| Vårdbegäran för egen räkning eller från tredje part | Klassen vårdbegäran för egen räkning eller från tredje part håller information om vårdbegäran från patient, företrädare för patient eller tredje part. | `egen_vardbegaran`, `halsoarenden` |  |
| Vårdkontakt | Klassen vårdkontakt innehåller information om kontakt mellan patient och hälso- och sjukvårdspersonal då hälso- och sjukvård utförs. | `vardkontakter`, `vardtillfallen`, `bokningar` | Encounter, Appointment |

| Begrepp | Definition enligt Socialstyrelsens termbank | Klass |
|---|---|---|
| bedömning | åtgärd i form av ett omdöme grundat på insamlad information | Aktivitet |
| diagnos | bestämning och benämning av sjukdom, skada, störning eller förändring i kroppsfunktion | Observation |
| hälso- och sjukvårdspersonal | person eller personer som i sitt yrke utför hälso- och sjukvård | Hälso- och sjukvårdspersonal |
| individanpassad vårdprocess | vårdprocess som är anpassad för en enskild patient | Individanpassad vårdprocess |
| ordination | beslut av behörig hälso- och sjukvårdspersonal som är avsett att påverka en patients hälsotillstånd genom en hälso- och sjukvårdsåtgärd | Beslut |
| patient | person som erhåller eller är registrerad för att erhålla hälso- och sjukvård | Patient |
| patientjournal | en eller flera journalhandlingar som rör samma patient | Uppgift i patientjournal |
| remiss | vårdbegäran från hälso- och sjukvårdspersonal som utgör beställning av tjänst eller begäran om övertagande av vårdansvar för en patient | Remiss |
| samtycke | frivillig, särskild och otvetydig viljeyttring genom vilken en person som tillfrågats om något, efter att ha fått information, godtar det frågan gäller | Beslut |
| sökorsak | orsak till vårdbegäran som anges av patient, företrädare för patient eller tredje part | Vårdbegäran för egen räkning eller från tredje part |
| vårdåtagande | beslut av mottagande vårdenhet att acceptera vårdbegäran | Beslut |
| vårdbegäran | begäran om hälso- och sjukvård | Vårdbegäran |
| vårdgivare | statlig myndighet, region, kommun, annan juridisk person eller enskild näringsidkare som bedriver hälso- och sjukvårdsverksamhet | Organisation |
| vårdkontakt | kontakt mellan patient och hälso- och sjukvårdspersonal då hälso- och sjukvård utförs | Vårdkontakt |

