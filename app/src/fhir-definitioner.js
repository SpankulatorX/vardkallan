// Vårdkällans egna FHIR-definitioner: tillägg (StructureDefinition), kodsystem och värdemängder.
// De publiceras under /fhir/StructureDefinition, /fhir/CodeSystem och /fhir/ValueSet och laddas in i HL7:s validator
// när svaren valideras (docs/fhir-validering.md). Kanoniska adresser pekar alltid på den publika demon.
export const KANON = 'https://vardkallan.404haven.se/fhir';
export const EXT = `${KANON}/StructureDefinition`;
export const CS = `${KANON}/CodeSystem`;
export const VS = `${KANON}/ValueSet`;
const VERSION = '0.3.0';
const DATUM = '2026-11-01';
const gemensamt = { version: VERSION, status: 'active', experimental: true, date: DATUM, publisher: 'Vårdkällan (öppet demoprojekt)', jurisdiction: [{ coding: [{ system: 'urn:iso:std:iso:3166', code: 'SE' }] }] };

function tillagg(id, namn, titel, beskrivning, kontext, typ, bindning) {
  const url = `${EXT}/${id}`;
  return {
    resourceType: 'StructureDefinition', id, url, name: namn, title: titel, ...gemensamt, description: beskrivning,
    fhirVersion: '4.0.1', kind: 'complex-type', abstract: false, context: [{ type: 'element', expression: kontext }],
    type: 'Extension', baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension', derivation: 'constraint',
    differential: {
      element: [
        { id: 'Extension', path: 'Extension', short: titel, definition: beskrivning, min: 0, max: '1' },
        { id: 'Extension.extension', path: 'Extension.extension', max: '0' },
        { id: 'Extension.url', path: 'Extension.url', fixedUri: url },
        { id: 'Extension.value[x]', path: 'Extension.value[x]', min: 1, type: [{ code: typ }], ...(bindning ? { binding: { strength: 'required', valueSet: bindning } } : {}) },
      ],
    },
  };
}

function kodsystem(id, namn, titel, beskrivning, koncept) {
  return {
    resourceType: 'CodeSystem', id, url: `${CS}/${id}`, name: namn, title: titel, ...gemensamt, description: beskrivning,
    caseSensitive: true, valueSet: `${VS}/${id}`, content: 'complete', count: koncept.length,
    concept: koncept.map(([code, display, definition]) => ({ code, display, definition: definition ?? display })),
  };
}

function vardemangd(cs) {
  return {
    resourceType: 'ValueSet', id: cs.id, url: `${VS}/${cs.id}`, name: cs.name, title: cs.title, ...gemensamt,
    description: `Alla koder i kodsystemet ${cs.title}.`, compose: { include: [{ system: cs.url }] },
  };
}

export const KODSYSTEM = [
  kodsystem('kalla', 'Kalla', 'Källa', 'Systemet där uppgiften dokumenterades från början.', [
    ['vardkallan', 'Vårdkällan', 'Dokumenterad i Vårdkällan.'],
    ['migrerad:VAS', 'Migrerad från VAS', 'Migrerad historik från journalsystemet VAS.'],
    ['migrerad:Cosmic', 'Migrerad från Cosmic', 'Migrerad historik från journalsystemet Cosmic.'],
    // Runda 9, r2: mätvärden och doser från medicinteknisk utrustning och patientens egna mätningar.
    ['utrustning', 'Medicinteknisk utrustning', 'Mottagen från en kopplad medicinteknisk utrustning, till exempel en patientmonitor eller en infusionspump.'],
    ['patient', 'Patientens egen mätning', 'Registrerad av patienten i Min journal. Inte kvalitetssäkrad förrän vården har bedömt den.'],
  ]),
  kodsystem('felkod', 'Felkod', 'Felkod', 'Samma felkoder som Vårdkällans /api.', [
    ['kraver_val', 'Kräver aktivt val', 'Åtgärden blir möjlig efter ett aktivt val eller nödåtkomst.'],
    ['kraver_samtycke', 'Kräver samtycke', 'Uppgifterna är spärrade och visas bara med patientens samtycke i stunden.'],
    ['nekad', 'Nekad', 'Åtkomst saknas.'],
    ['saknas', 'Saknas', 'Resursen finns inte.'],
    ['ogiltig', 'Ogiltig', 'Anropet är ogiltigt.'],
    ['ej_inloggad', 'Ej inloggad', 'Ingen demoroll är vald.'],
  ]),
  kodsystem('atkomstgrund', 'Atkomstgrund', 'Åtkomstgrund', 'Grunden för en åtkomst i åtkomstloggen.', [
    ['egen_enhet', 'Egen vårdenhet'], ['vardrelation', 'Vårdrelation'], ['aktivt_val', 'Aktivt val, andra vårdenheter'],
    ['samtycke_sparr', 'Samtycke till att häva spärr'], ['nodatkomst', 'Nödåtkomst'], ['administrativ', 'Administrativ uppgift'],
    ['logggranskning', 'Logggranskning'], ['nekad', 'Nekad'],
    ['egen_atkomst', 'Egen åtkomst i Min journal', 'Patienten läste sin egen journal i e-tjänsten Min journal.'],
    ['vardnadshavare', 'Vårdnadshavare i Min journal', 'En vårdnadshavare läste journalen för ett barn under 13 år i e-tjänsten Min journal.'],
  ]),
  kodsystem('nll-status', 'NllStatus', 'NLL-status', 'Status för överföringen av en ordination till Nationella läkemedelslistan (simulerad).', [
    ['skickad', 'Skickad'], ['kvitterad', 'Kvitterad av NLL'], ['okand_kontrolleras', 'Okänd, kontrolleras genom avstämning'], ['fel', 'Fel från NLL'],
    // Runda 6, r2: en muntlig ordination skickas när läkaren har signerat, och blodprodukter, nutrition och
    // egendefinierade läkemedel skickas inte.
    ['vantar_signering', 'Väntar på läkarens signering', 'En muntlig ordination skickas till NLL när läkaren har signerat den.'],
    ['ej_aktuell', 'Skickas inte till NLL', 'Blodprodukter, nutrition och egendefinierade läkemedel skickas inte till Nationella läkemedelslistan.'],
  ]),
  kodsystem('uppmarksamhet', 'Uppmarksamhet', 'Uppmärksamhetsinformation', 'Huvudgrupper och undergrupper för uppmärksamhetsinformation enligt tabell 1 i Socialstyrelsens Instruktion för ändringsförslag gällande Uppmärksamhetsinformation (2025-09-30). Undergruppens kod är huvudgruppens kod, en punkt och undergruppen.', [
    ['medicinskt', 'Medicinska tillstånd och behandlingar'], ['medicinskt.annat_tillstand', 'Annat medicinskt tillstånd'], ['medicinskt.behandling', 'Behandling'],
    ['medicinskt.implantat', 'Förekomst av implantat'], ['medicinskt.transplantat', 'Förekomst av transplantat'],
    ['smitta', 'Smitta'], ['smitta.smittamne', 'Förekomst av smittämne'], ['smitta.smittsam_sjukdom', 'Förekomst av smittsam sjukdom'],
    ['vardrutin', 'Särskild vårdrutin'], ['vardrutin.information', 'Information som kan leda till särskild vårdrutin'], ['vardrutin.beslut', 'Beslut som kan leda till särskild vårdrutin'],
  ]),
  // Plan vid utsättning av antikoagulantia (runda 5).
  kodsystem('utsattningsplan', 'Utsattningsplan', 'Plan vid utsättning', 'Planen när antikoagulantia sätts ut.', [
    ['byte', 'Byte till annat medel'], ['uppehall', 'Uppehåll inför ingrepp', 'Uppehåll inför ett ingrepp, med datum för återinsättning.'], ['avslutad', 'Avslutad behandling'],
  ]),
  kodsystem('remisstatus', 'Remisstatus', 'Remisstatus', 'Remissens läge i statuskedjan.', [
    ['skickad', 'Skickad'], ['mottagen', 'Mottagen (kvittens)'], ['bedomd', 'Bedömd'], ['besvarad', 'Besvarad'], ['svar_kvitterat', 'Svar kvitterat'],
  ]),
  // Runda 10, r6: remiss eller konsultation (remiss-r10.js).
  kodsystem('remisstyp', 'Remisstyp', 'Remisstyp', 'Om vårdbegäran lämnar över vårdansvaret (remiss) eller ber om råd medan vårdansvaret stannar hos remittenten (konsultation).', [
    ['remiss', 'Remiss', 'Vårdansvaret för det remissen gäller går över till mottagaren när remissen accepteras.'],
    ['konsultation', 'Konsultation', 'Mottagaren svarar med råd, och vårdansvaret stannar hos remittenten.'],
  ]),
];
export const VARDEMANGDER = KODSYSTEM.map(vardemangd);

export const TILLAGG = [
  tillagg('uppfoljningsdatum', 'Uppfoljningsdatum', 'Uppföljningsdatum', 'Datum då ordinationen ska följas upp. Obligatoriskt i Vårdkällan, som i Nationella läkemedelslistan.', 'MedicationRequest', 'date'),
  tillagg('nll-status', 'NllStatus', 'NLL-status', 'Status för överföringen till Nationella läkemedelslistan (simulerad i demon).', 'MedicationRequest', 'code', `${VS}/nll-status`),
  tillagg('utsattningsorsak', 'Utsattningsorsak', 'Utsättningsorsak', 'Orsaken till att ordinationen sattes ut.', 'MedicationRequest', 'string'),
  // Plan vid utsättning av antikoagulantia (runda 5).
  tillagg('utsattningsplan', 'Utsattningsplan', 'Plan vid utsättning', 'Planen som läkaren bekräftade när antikoagulantia sattes ut: byte till annat medel, uppehåll inför ingrepp eller avslutad behandling.', 'MedicationRequest', 'code', `${VS}/utsattningsplan`),
  tillagg('aterinsattningsdatum', 'Aterinsattningsdatum', 'Datum för återinsättning', 'När behandlingen ska sättas in igen efter ett uppehåll inför ett ingrepp.', 'MedicationRequest', 'date'),
  tillagg('remisstatus', 'Remisstatus', 'Remisstatus', 'Remissens läge i statuskedjan skickad, mottagen, bedömd, besvarad och svar kvitterat.', 'ServiceRequest', 'code', `${VS}/remisstatus`),
  tillagg('svar-senast', 'SvarSenast', 'Svar senast', 'Sista datum för svar på remissen.', 'ServiceRequest', 'date'),
  tillagg('hash', 'Hash', 'Hash i loggkedjan', 'sha256 av föregående rads hash och raden, i hexadecimal form. Kedjan gör att ändringar i loggen upptäcks.', 'AuditEvent', 'string'),
];

// Runda 6, r5: skrivning via FHIR. Orsaken till en rättelse, en kvitterad varning med regel och motivering, och
// kodsystemet för varningsreglerna (som är demoregler och inte räknas upp här).
TILLAGG.push(tillagg('rattelseorsak', 'Rattelseorsak', 'Orsak till rättelse', 'Varför en signerad anteckning rättas. Den tidigare versionen står kvar och den nya ersätter den (HSLF-FS 2016:40 6 kap.).', 'Composition', 'string'));
TILLAGG.push((() => {
  const url = `${EXT}/kvitterad-varning`;
  const del = (namn, typ, titel) => [
    { id: `Extension.extension:${namn}`, path: 'Extension.extension', sliceName: namn, short: titel, definition: titel, min: 1, max: '1' },
    { id: `Extension.extension:${namn}.extension`, path: 'Extension.extension.extension', max: '0' },
    { id: `Extension.extension:${namn}.url`, path: 'Extension.extension.url', fixedUri: namn },
    { id: `Extension.extension:${namn}.value[x]`, path: 'Extension.extension.value[x]', min: 1, type: [{ code: typ }] },
  ];
  return {
    resourceType: 'StructureDefinition', id: 'kvitterad-varning', url, name: 'KvitteradVarning', title: 'Kvitterad varning', ...gemensamt,
    description: 'En allvarlig varning som förskrivaren har läst och kvitterat med en motivering när ordinationen sparades eller sattes ut. Regeln är koden som Vårdkällan gav i OperationOutcome.',
    fhirVersion: '4.0.1', kind: 'complex-type', abstract: false, context: [{ type: 'element', expression: 'MedicationRequest' }],
    type: 'Extension', baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension', derivation: 'constraint',
    differential: { element: [
      { id: 'Extension', path: 'Extension', short: 'Kvitterad varning', definition: 'En kvitterad varning.', min: 0, max: '*' },
      { id: 'Extension.extension', path: 'Extension.extension', slicing: { discriminator: [{ type: 'value', path: 'url' }], rules: 'closed' }, min: 2 },
      ...del('regel', 'code', 'Varningens regel'), ...del('motivering', 'string', 'Motiveringen'),
      { id: 'Extension.url', path: 'Extension.url', fixedUri: url },
      { id: 'Extension.value[x]', path: 'Extension.value[x]', max: '0' },
    ] },
  };
})());
KODSYSTEM.push({
  resourceType: 'CodeSystem', id: 'varningsregel', url: `${CS}/varningsregel`, name: 'Varningsregel', title: 'Varningsregel', ...gemensamt,
  description: 'Reglerna bakom Vårdkällans varningar vid ordination och utsättning, till exempel dubbel_substans. Reglerna är demoregler och räknas inte upp här.',
  caseSensitive: true, content: 'not-present',
});

export const DEFINITIONER = { StructureDefinition: TILLAGG, CodeSystem: KODSYSTEM, ValueSet: VARDEMANGDER };

// Runda 6, r5: FHIRPath till elementen i en skrivning, per fält i /api, för OperationOutcome.issue.expression
// (fhir-skrivning.js), och omfången som SMART-konfigurationen anger (smart.js).
export const UTTRYCK = {
  Observation: { typ: 'Observation.code', varde: 'Observation.value[x]', tid: 'Observation.effectiveDateTime', enhet: 'Observation.valueQuantity.code' },
  Composition: { typ: 'Composition.type', sokord: 'Composition.section', vardkontaktId: 'Composition.encounter', orsak: `Composition.extension('${EXT}/rattelseorsak')` },
  MedicationRequest: {
    lakemedelId: 'MedicationRequest.medicationCodeableConcept', dosering: 'MedicationRequest.dosageInstruction[0].text', dos: 'MedicationRequest.dosageInstruction[0].doseAndRate[0].doseQuantity',
    typ: 'MedicationRequest.dosageInstruction[0].asNeededBoolean', ordinationsorsak: 'MedicationRequest.reasonCode[0].text', start: 'MedicationRequest.dispenseRequest.validityPeriod.start',
    slut: 'MedicationRequest.dispenseRequest.validityPeriod.end', uppfoljningsdatum: `MedicationRequest.extension('${EXT}/uppfoljningsdatum')`, orsak: 'MedicationRequest.statusReason',
    plan: `MedicationRequest.extension('${EXT}/utsattningsplan')`, aterinsattning: `MedicationRequest.extension('${EXT}/aterinsattningsdatum')`,
  },
  ServiceRequest: { tillEnhetId: 'ServiceRequest.performer', fragestallning: 'ServiceRequest.reasonCode[0].text', prioritet: 'ServiceRequest.priority', svarSenast: `ServiceRequest.extension('${EXT}/svar-senast')` },
  // Runda 9, r6.
  Condition: { kod: 'Condition.code', vardkontaktId: 'Condition.encounter' },
  Appointment: { remissId: 'Appointment.basedOn', tidId: 'Appointment.slot', status: 'Appointment.status', patient: 'Appointment.participant' },
  Encounter: { klass: 'Encounter.class', enhetId: 'Encounter.serviceProvider', orsak: 'Encounter.reasonCode[0].text', plats: 'Encounter.location[0].location.display', status: 'Encounter.status' },
};
export const SMART_OMFANG = ['launch', 'launch/patient', 'patient/*.read', 'patient/*.rs', 'patient/*.write', 'user/*.read', 'user/*.rs', 'user/*.write', 'user/*.cruds',
  // Runda 10, r1: systemkonton (SMART Backend Services).
  'system/*.rs'];
export const BEARER_FEL = { ogiltig: 'Bearer error="invalid_token"', omfang: 'Bearer error="insufficient_scope"' };
