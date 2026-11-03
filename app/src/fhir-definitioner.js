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
  ]),
  kodsystem('uppmarksamhet', 'Uppmarksamhet', 'Uppmärksamhetsinformation', 'Huvudgrupper och undergrupper för uppmärksamhetsinformation enligt tabell 1 i Socialstyrelsens Instruktion för ändringsförslag gällande Uppmärksamhetsinformation (2025-09-30). Undergruppens kod är huvudgruppens kod, en punkt och undergruppen.', [
    ['medicinskt', 'Medicinska tillstånd och behandlingar'], ['medicinskt.annat_tillstand', 'Annat medicinskt tillstånd'], ['medicinskt.behandling', 'Behandling'],
    ['medicinskt.implantat', 'Förekomst av implantat'], ['medicinskt.transplantat', 'Förekomst av transplantat'],
    ['smitta', 'Smitta'], ['smitta.smittamne', 'Förekomst av smittämne'], ['smitta.smittsam_sjukdom', 'Förekomst av smittsam sjukdom'],
    ['vardrutin', 'Särskild vårdrutin'], ['vardrutin.information', 'Information som kan leda till särskild vårdrutin'], ['vardrutin.beslut', 'Beslut som kan leda till särskild vårdrutin'],
  ]),
  kodsystem('remisstatus', 'Remisstatus', 'Remisstatus', 'Remissens läge i statuskedjan.', [
    ['skickad', 'Skickad'], ['mottagen', 'Mottagen (kvittens)'], ['bedomd', 'Bedömd'], ['besvarad', 'Besvarad'], ['svar_kvitterat', 'Svar kvitterat'],
  ]),
];
export const VARDEMANGDER = KODSYSTEM.map(vardemangd);

export const TILLAGG = [
  tillagg('uppfoljningsdatum', 'Uppfoljningsdatum', 'Uppföljningsdatum', 'Datum då ordinationen ska följas upp. Obligatoriskt i Vårdkällan, som i Nationella läkemedelslistan.', 'MedicationRequest', 'date'),
  tillagg('nll-status', 'NllStatus', 'NLL-status', 'Status för överföringen till Nationella läkemedelslistan (simulerad i demon).', 'MedicationRequest', 'code', `${VS}/nll-status`),
  tillagg('utsattningsorsak', 'Utsattningsorsak', 'Utsättningsorsak', 'Orsaken till att ordinationen sattes ut.', 'MedicationRequest', 'string'),
  tillagg('remisstatus', 'Remisstatus', 'Remisstatus', 'Remissens läge i statuskedjan skickad, mottagen, bedömd, besvarad och svar kvitterat.', 'ServiceRequest', 'code', `${VS}/remisstatus`),
  tillagg('svar-senast', 'SvarSenast', 'Svar senast', 'Sista datum för svar på remissen.', 'ServiceRequest', 'date'),
  tillagg('hash', 'Hash', 'Hash i loggkedjan', 'sha256 av föregående rads hash och raden, i hexadecimal form. Kedjan gör att ändringar i loggen upptäcks.', 'AuditEvent', 'string'),
];

export const DEFINITIONER = { StructureDefinition: TILLAGG, CodeSystem: KODSYSTEM, ValueSet: VARDEMANGDER };
