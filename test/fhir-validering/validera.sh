#!/bin/sh
# Validerar exporterade FHIR-resurser med HL7:s validator i en Java-container. Se docs/fhir-validering.md.
# Argument: katalogen från exportera.js. Miljö: VALIDATOR (katalog med validator_cli.jar), FHIRHEM (paketcache),
# JAVABILD (Java-avbildningen, standard eclipse-temurin:21-jre).
set -eu
DATA=$(cd "$1" && pwd)
V=${VALIDATOR:?Ange VALIDATOR, katalogen med validator_cli.jar}
H=${FHIRHEM:-${TMPDIR:?}/fhir-hem}
BILD=${JAVABILD:-eclipse-temurin:21-jre}
mkdir -p "$H"
kor() { # namn, källor, extra argument
  namn=$1; shift; kallor=$1; shift
  docker run --rm --user "$(id -u):$(id -g)" -v "$H:/hem" -v "$V:/v:ro" -v "$DATA:/data" -w /hem "$BILD" \
    java -Duser.home=/hem -Xmx3g -jar /v/validator_cli.jar $kallor -version 4.0.1 -ig hl7se.fhir.base#1.1.0 -ig /data/def \
    -jurisdiction SE "$@" -output "/data/ut-$namn.json" > "$DATA/logg-$namn.txt" 2>&1 || true
  echo "klar $namn"
}
kor Patient /data/Patient -profile http://hl7.se/fhir/ig/base/StructureDefinition/SEBasePatient
kor Organization /data/Organization -profile http://hl7.se/fhir/ig/base/StructureDefinition/SEBaseOrganization
kor Practitioner /data/Practitioner -profile http://hl7.se/fhir/ig/base/StructureDefinition/SEBasePractitioner
ovriga=""
for t in def Encounter EpisodeOfCare Condition Observation MedicationRequest MedicationAdministration List AllergyIntolerance Flag ServiceRequest Procedure \
  Composition Schedule Slot Appointment AuditEvent CapabilityStatement Bundle CarePlan ChargeItem Immunization DiagnosticReport Specimen \
  Questionnaire QuestionnaireResponse; do
  [ -d "$DATA/$t" ] && ovriga="$ovriga /data/$t"
done
kor R4 "$ovriga"
# Runda 6, r5: prenumerationen och meddelandet följer FHIR Subscriptions R5 Backport för R4, och resurserna som en klient
# skickar in (Klient) valideras med Vårdkällans tillägg för kvitterad varning och rättelse. OperationOutcome valideras mot R4.
r5=""
for t in Subscription Notis Klient OperationOutcome; do [ -d "$DATA/$t" ] && r5="$r5 /data/$t"; done
[ -n "$r5" ] && kor R5 "$r5" -ig hl7.fhir.uv.subscriptions-backport.r4#1.1.0
