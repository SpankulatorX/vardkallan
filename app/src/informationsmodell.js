// Informationsmodellen (runda 9, r4, Sussa 5.1.3.1 och 5.1.3.3): hur Vårdkällans uppgifter, tabeller och FHIR-resurser
// motsvarar Nationell informationsstruktur (NI). NI är Socialstyrelsens modell för hur uppgifter i vård och omsorg
// struktureras: en processmodell, en begreppsmodell med begreppen ur Socialstyrelsens termbank och en informationsmodell
// med informationsklasser. Klasserna och deras definitioner här är ordagranna ur Nationell informationsstruktur 2023:2,
// Modeller för hälso- och sjukvård, den senaste utgåvan av modellen för hälso- och sjukvård som är kontrollerad här
// (se docs/kodkontroll.md). Ansvaret för NI flyttas från Socialstyrelsen till E-hälsomyndigheten.
//
// Systemet är experten: varje tabell med patientuppgifter klassas, och en ny tabell som ingen har klassat får NI:s
// allmänna klass Uppgift i patientjournal och visas som allmänt klassad, så att informationsstrukturen aldrig har en
// lucka. En ny utgåva av NI läggs in som en ny version av modellen, och testerna visar vilka klasser som har ändrats.

// Klasserna och begreppen står ordagrant i informationsmodell-ni.json, eftersom termbankens definitioner citeras.
import NI_DATA from './informationsmodell-ni.json' with { type: 'json' };

export const NI = {
  namn: 'Nationell informationsstruktur',
  version: '2023:2',
  dokument: 'Nationell informationsstruktur 2023:2 Modeller för hälso- och sjukvård',
  utgivare: 'Socialstyrelsen',
  anmarkning: 'Ansvaret för Nationell informationsstruktur, Snomed CT och klassifikationerna flyttas från Socialstyrelsen till E-hälsomyndigheten enligt regeringens beslut den 19 december 2024.',
};

// Informationsklasserna i NI 2023:2 för hälso- och sjukvård. definition är den första meningen i klassens beskrivning.
export const KLASSER = NI_DATA.klasser;

// NI:s allmänna klass för allt som dokumenteras i patientjournalen. En tabell med patientuppgifter som inte är klassad
// får den, och visas som allmänt klassad.
export const ALLMAN = 'Uppgift i patientjournal';

// Begreppen i NI:s begreppsmodell med definitionen ur Socialstyrelsens termbank, ordagrant, och klassen begreppet
// motsvaras av i informationsmodellen. Bara begrepp som Vårdkällan använder i gränssnittet finns med.
export const BEGREPP = NI_DATA.begrepp;

const m = (klass, uppgift, begrepp = null, falt = null) => ({ klass, uppgift, begrepp, falt });

// Vårdkällans tabeller och den NI-klass varje rad motsvarar. falt pekar NI:s attribut på de kolumner i tabellen som bär dem, för de
// klasser där attributen används. Tabellerna som inte finns här och har en patientkolumn får den allmänna klassen.
export const TABELLER = {
  patienter: m('Patient', 'Patienten', 'patient'),
  identiteter: m('Person', 'Personnummer, samordningsnummer, reservnummer och tidigare identiteter'),
  personal: m('Hälso- och sjukvårdspersonal', 'Personalen', 'personal'),
  enheter: m('Organisation', 'Vårdgivare, sjukhus, vårdenheter och arbetsplatser', 'vardgivare'),
  vardkontakter: m('Vårdkontakt', 'Besök, vårdtillfällen och distanskontakter', 'vardkontakt', { typ: ['typ'], tid: ['start', 'slut'] }),
  vardtillfallen: m('Vårdkontakt', 'Vårdtillfällen på avdelning', 'vardkontakt', { tid: ['inskriven', 'utskriven'] }),
  bokningar: m('Vårdkontakt', 'Bokade besök, som en planerad vårdkontakt', 'vardkontakt', { status: ['status'] }),
  kallelser: m('Dokument', 'Kallelser till bokade besök'),
  anteckningar: m('Dokument', 'Journalanteckningar med sökord, som journalhandlingar', 'patientjournal'),
  diagnoser: m('Observation', 'Diagnoser med ICD-10-SE, med huvud- eller bidiagnos som typ', 'diagnos', { typ: ['typ'], 'värde': ['kod', 'text'] }),
  matvarden: m('Observation', 'Mätvärden och provsvar, där typen är mätningen och värdet resultatet', null, { typ: ['typ'], 'värde': ['varde', 'varde_num'], skala: ['matt_enhet'] }),
  hemmatningar: m('Observation', 'Patientens egna mätningar hemma'),
  overkanslighet: m('Observation', 'Överkänslighet och allergier'),
  uppmarksamhet: m('Observation', 'Uppmärksamhetsinformation'),
  tillvaxt_uppgifter: m('Observation', 'Tillväxt i barnhälsovården'),
  ordinationer: m('Beslut', 'Läkemedelsordinationer', 'ordination'),
  kontrollordinationer: m('Beslut', 'Ordinerade kontroller'),
  administreringar: m('Aktivitet', 'Givna och inte givna läkemedelsdoser, som utförd aktivitet', null, { status: ['status'], tid: ['tid'] }),
  atgarder: m('Aktivitet', 'Åtgärder med KVÅ', 'bedomning', { kod: ['kod'], tid: ['tid'] }),
  vaccinationer: m('Aktivitet', 'Vaccinationer'),
  lakemedelsgenomgangar: m('Aktivitet', 'Läkemedelsgenomgångar'),
  planerade_uppgifter: m('Aktivitet', 'Planerade uppgifter på avdelningen, som planerad aktivitet'),
  labb_bestallningar: m('Aktivitet', 'Beställningar till laboratoriet, som begärd aktivitet', null, { tid: ['planerad'] }),
  labb_analyser: m('Aktivitet', 'Beställda analyser'),
  labb_prov: m('Resurs', 'Provrör och prover, som det som produceras i provtagningen'),
  labb_svar: m('Observation', 'Laboratoriets svar och fynd'),
  remisser: m('Remiss', 'Remisser mellan vårdenheter', 'remiss', { prioritet: ['prioritet'], tidpunkt: ['skickad_tid'], orsak: ['fragestallning'] }),
  egen_vardbegaran: m('Vårdbegäran för egen räkning eller från tredje part', 'Patientens egna vårdbegäranden från Min journal', 'sokorsak', { tidpunkt: ['skapad'], orsak: ['skal'] }),
  halsoarenden: m('Vårdbegäran för egen räkning eller från tredje part', 'Hälsoärenden', 'vardbegaran'),
  vantelista: m('Beslut', 'Väntelistan efter beslutet att ta emot patienten', 'vardatagande'),
  vardplaner: m('Dokument', 'Vårdplaner med mål och åtgärder', 'vardprocess'),
  samordningar: m('Individanpassad vårdprocess', 'Samordnad individuell planering'),
  tvangsvard_perioder: m('Beslut', 'Beslut om tvångsvård'),
  tvangsvard_handelser: m('Beslut', 'Händelser och beslut i tvångsvården'),
  sparrar: m('Beslut', 'Patientens spärrar, som patientens beslut', 'samtycke'),
  kanalval: m('Kommunikationssätt', 'Hur patienten vill få kallelser och meddelanden'),
  sprakval: m('Kommunikationssätt', 'Patientens språk'),
  vardnadshavare: m('Annan person', 'Vårdnadshavare'),
  vantrum: m('Plats', 'Väntrummet på akuten'),
  resurser: m('Resurs', 'Rum, utrustning och andra resurser i tidboken'),
  katalog: m('Resurs', 'Läkemedelskatalogen'),
  transportbehov: m('Observation', 'Patientens behov av transport'),
  hjalpmedel_utlamnade: m('Resurs', 'Hjälpmedel som har lämnats ut'),
  vidimeringar: m('Aktivitet', 'Vidimering av provsvar och anteckningar'),
  kontrasigneringar: m('Aktivitet', 'Kontrasignering av anteckningar'),
};

// FHIR R4-resurserna i API:t och NI-klassen de bär. Konformitetsresurserna (kodverk och definitioner) beskriver
// strukturen och motsvaras av en tillämpad modell, inte av uppgifter om patienten.
export const FHIR = {
  Patient: 'Patient',
  Practitioner: 'Hälso- och sjukvårdspersonal',
  Organization: 'Organisation',
  Encounter: 'Vårdkontakt',
  EpisodeOfCare: 'Individanpassad vårdprocess',
  Condition: 'Observation',
  Observation: 'Observation',
  AllergyIntolerance: 'Observation',
  Flag: 'Observation',
  MedicationRequest: 'Beslut',
  MedicationAdministration: 'Aktivitet',
  Procedure: 'Aktivitet',
  Immunization: 'Aktivitet',
  ServiceRequest: 'Remiss',
  DiagnosticReport: 'Observation',
  Specimen: 'Resurs',
  Composition: 'Dokument',
  CarePlan: 'Dokument',
  List: 'Dokument',
  AuditEvent: 'Uppgift i patientjournal',
  Appointment: 'Vårdkontakt',
  Schedule: 'Resurs',
  Slot: 'Resurs',
  ChargeItem: 'Uppgift i patientjournal',
  Subscription: 'Tillämpad modell',
  StructureDefinition: 'Tillämpad modell',
  CodeSystem: 'Tillämpad modell',
  ValueSet: 'Tillämpad modell',
};

// Klassar alla tabeller i en databas. En tabell med patientuppgifter som inte är klassad får den allmänna klassen.
// Tabeller utan patientuppgifter och utan klassning är systemets egna (loggar, inställningar, kopplingar) och tas inte med.
export function klassaTabeller(db) {
  const tabeller = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
  const ut = [];
  for (const t of tabeller) {
    const k = Object.hasOwn(TABELLER, t) ? TABELLER[t] : null;
    const kolumner = db.query(`PRAGMA table_info("${t}")`).all().map(c => c.name);
    const patient = kolumner.some(c => /patient_id$/.test(c));
    if (k) ut.push({ tabell: t, klass: k.klass, uppgift: k.uppgift, begrepp: k.begrepp, falt: k.falt, allman: false, patientuppgifter: patient });
    else if (patient) ut.push({ tabell: t, klass: ALLMAN, uppgift: null, begrepp: null, falt: null, allman: true, patientuppgifter: true });
  }
  return ut;
}

// Klassar FHIR-resurstyperna i CapabilityStatement. En typ utan klassning får den allmänna klassen.
export function klassaFhir(typer) {
  return [...new Set(typer)].sort().map(t => (Object.hasOwn(FHIR, t) ? { typ: t, klass: FHIR[t], allman: false } : { typ: t, klass: ALLMAN, allman: true }));
}

// Hela modellen för API:t och dokumentationen: versionen, klasserna med definition, begreppen, tabellerna och
// FHIR-resurserna, och per klass vilka tabeller och resurser som bär den. Inga patientuppgifter.
export function modell(db, fhirTyper) {
  const tabeller = klassaTabeller(db);
  const fhir = klassaFhir(fhirTyper);
  const klasser = Object.entries(KLASSER).map(([namn, definition]) => ({
    namn, definition,
    tabeller: tabeller.filter(t => t.klass === namn).map(t => t.tabell),
    fhir: fhir.filter(f => f.klass === namn).map(f => f.typ),
    begrepp: Object.values(BEGREPP).filter(b => b.klass === namn).map(b => b.term),
  }));
  return {
    ni: NI, klasser, begrepp: Object.values(BEGREPP), tabeller, fhir,
    sammanfattning: {
      klasser: klasser.length, anvandaKlasser: klasser.filter(k => k.tabeller.length || k.fhir.length).length,
      tabeller: tabeller.length, allmantKlassade: tabeller.filter(t => t.allman).map(t => t.tabell),
      fhirTyper: fhir.length, allmantKlassadeFhir: fhir.filter(f => f.allman).map(f => f.typ),
    },
  };
}
