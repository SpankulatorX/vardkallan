// Katalogen för beställning och svar (runda 8, r1, Sussa 4.4): de simulerade laboratorierna, provrören med
// provtagningsordning, analyserna med kod, rör, svarstid och tid för dubblettvarning, paketen som systemet föreslår och
// kontrollerna som läkaren ordinerar till avdelningen (Sussas testfall 3.5).
//
// Laboratorierna är simulerade och har påhittade HSA-id. Analysernas koder är NPU för labbvärdena (samma tabell som
// mätvärdena, kodverk.js MATKOD) och Snomed CT för odlingarnas fynd, kontrollerade mot tx.fhir.org 2026-11-08 (se
// docs/kodkontroll.md). Provtagningsordningen, svarstiderna, tiderna för dubblettvarning och de kritiska gränserna är
// demoregler, inte ett laboratoriums egna anvisningar.

export const DEMOREGEL = 'Demoregel, inte ett laboratoriums anvisning eller kliniskt beslutsstöd.';

// Uppslagstabellerna har ingen prototyp, så att en nyckel som constructor, __proto__ eller toString från en klient
// aldrig blir en analys, ett paket, ett laboratorium, en kontroll eller en frekvens.
const tabell = (o) => Object.freeze(Object.assign(Object.create(null), o));
export const finns = (t, nyckel) => typeof nyckel === 'string' && Object.hasOwn(t, nyckel);

export const DISCIPLINER = tabell({
  klinisk_kemi: { namn: 'Klinisk kemi', fhir: 'LAB' },
  mikrobiologi: { namn: 'Klinisk mikrobiologi', fhir: 'MB' },
  patologi: { namn: 'Klinisk patologi', fhir: 'SP' },
});

// De simulerade laboratorierna. Klinisk kemi har tre utförande laboratorier (Sussa 4.4.1.2), och systemet väljer det
// som hör till sjukhuset där beställningen görs. sjukhus är enhetens sjukhus i enhetsträdet (seed/enheter.js).
export const LABORATORIER = [
  { id: 'lab-kem-uso', hsa: 'SE2321000164-VKL101', namn: 'Klinisk kemi USÖ (simulerat laboratorium)', kort: 'Klinisk kemi USÖ', disciplin: 'klinisk_kemi', sjukhus: ['uso', 'primarvard'] },
  { id: 'lab-kem-lind', hsa: 'SE2321000164-VKL201', namn: 'Klinisk kemi Lindesberg (simulerat laboratorium)', kort: 'Klinisk kemi Lindesberg', disciplin: 'klinisk_kemi', sjukhus: ['lind'] },
  { id: 'lab-kem-kkoga', hsa: 'SE2321000164-VKL301', namn: 'Klinisk kemi Karlskoga (simulerat laboratorium)', kort: 'Klinisk kemi Karlskoga', disciplin: 'klinisk_kemi', sjukhus: ['kkoga'] },
  { id: 'lab-mikro-uso', hsa: 'SE2321000164-VKL102', namn: 'Klinisk mikrobiologi USÖ (simulerat laboratorium)', kort: 'Klinisk mikrobiologi', disciplin: 'mikrobiologi', sjukhus: [] },
  { id: 'lab-pat-uso', hsa: 'SE2321000164-VKL103', namn: 'Klinisk patologi USÖ (simulerat laboratorium)', kort: 'Klinisk patologi', disciplin: 'patologi', sjukhus: [] },
];
export const LAB = tabell(Object.fromEntries(LABORATORIER.map(l => [l.id, l])));

// Provrören och provmaterialet, i provtagningsordning (blododling först, sedan citrat, serum, heparin och EDTA, så att
// tillsatser inte förs över mellan rören). fhir är provets typ i HL7 v2 tabell 0487 och snomed provets typ i Snomed CT.
export const ROR = tabell({
  blododling: { namn: 'Blododlingsflaskor', beskrivning: 'två flaskor, aerob och anaerob', farg: 'blå och lila hätta', ordning: 1, material: 'Blod', fhir: 'BLD', snomed: '119297000', snomedText: 'Blood specimen' },
  citrat: { namn: 'Citratrör', beskrivning: 'fyll till markeringen', farg: 'ljusblå propp', ordning: 2, material: 'Plasma', fhir: 'PLAS', snomed: '119297000', snomedText: 'Blood specimen' },
  serum: { namn: 'Serumrör med gel', beskrivning: 'låt stå 30 minuter före centrifugering', farg: 'gul propp', ordning: 3, material: 'Serum', fhir: 'SER', snomed: '119297000', snomedText: 'Blood specimen' },
  heparin: { namn: 'Litiumheparinrör med gel', beskrivning: 'vänd röret försiktigt fem gånger', farg: 'ljusgrön propp', ordning: 4, material: 'Plasma', fhir: 'PLAS', snomed: '119297000', snomedText: 'Blood specimen' },
  edta: { namn: 'EDTA-rör', beskrivning: 'vänd röret försiktigt åtta gånger', farg: 'lila propp', ordning: 5, material: 'Helblod', fhir: 'BLD', snomed: '119297000', snomedText: 'Blood specimen' },
  urin: { namn: 'Urinodlingsrör med borsyra', beskrivning: 'mittstråleurin, helst morgonurin', farg: 'grön kork', ordning: 6, material: 'Urin', fhir: 'UR', snomed: '122575003', snomedText: 'Urine specimen' },
  vavnad: { namn: 'Burk med formalin', beskrivning: 'vävnaden ska täckas helt av formalinet', farg: 'vit kork', ordning: 7, material: 'Vävnad', fhir: 'TISS', snomed: '119376003', snomedText: 'Tissue specimen' },
});

// Analyserna. matvarden är de mätvärdestyper som svaret ger (journal.js MATTYPER), odling ett textsvar med fynd i
// Snomed CT och patologi ett utlåtande i text. dubblettTimmar är hur länge efter ett taget eller beställt prov systemet
// varnar för en ny beställning av samma analys. anamnes betyder att laboratoriet behöver en anamnes, som systemet
// fyller i ur vårdkontakten.
const a = (id, namn, disciplin, ror, rest) => ({ id, namn, disciplin, ror, dubblettTimmar: 12, ord: [], ...rest });
export const ANALYSER = [
  a('crp', 'P-CRP', 'klinisk_kemi', 'heparin', { matvarden: ['crp'], ord: ['crp', 'c-reaktivt protein', 'infektion'] }),
  a('blodstatus', 'B-Blodstatus', 'klinisk_kemi', 'edta', { matvarden: ['hb', 'lpk', 'tpk'], ord: ['blodstatus', 'hb', 'hemoglobin', 'lpk', 'tpk', 'blodvärde', 'leukocyter', 'trombocyter'] }),
  a('kreatinin', 'P-Kreatinin', 'klinisk_kemi', 'heparin', { matvarden: ['kreatinin', 'egfr'], dubblettTimmar: 24, ord: ['kreatinin', 'njurfunktion', 'egfr'] }),
  a('natrium', 'P-Natrium', 'klinisk_kemi', 'heparin', { matvarden: ['natrium'], ord: ['natrium', 'na', 'elstatus', 'elektrolyter'] }),
  a('kalium', 'P-Kalium', 'klinisk_kemi', 'heparin', { matvarden: ['kalium'], ord: ['kalium', 'k', 'elstatus', 'elektrolyter'] }),
  a('glukos', 'P-Glukos', 'klinisk_kemi', 'heparin', { matvarden: ['glukos'], dubblettTimmar: 4, ord: ['glukos', 'blodsocker', 'socker'] }),
  a('hba1c', 'B-HbA1c', 'klinisk_kemi', 'edta', { matvarden: ['hba1c'], dubblettTimmar: 24 * 60, ord: ['hba1c', 'långtidssocker', 'diabetes'] }),
  a('pk', 'P-PK(INR)', 'klinisk_kemi', 'citrat', { matvarden: ['inr'], dubblettTimmar: 20, ord: ['pk', 'inr', 'waran', 'koagulation'] }),
  a('ntprobnp', 'P-NT-proBNP', 'klinisk_kemi', 'heparin', { matvarden: ['ntprobnp'], dubblettTimmar: 24, ord: ['ntprobnp', 'nt-probnp', 'bnp', 'hjärtsvikt'] }),
  a('troponin', 'P-Troponin T', 'klinisk_kemi', 'heparin', { matvarden: ['troponin'], dubblettTimmar: 2, ord: ['troponin', 'tnt', 'hjärtinfarkt', 'bröstsmärta'] }),
  a('tsh', 'P-TSH', 'klinisk_kemi', 'serum', { matvarden: ['tsh'], dubblettTimmar: 24 * 30, ord: ['tsh', 'tyreoidea', 'sköldkörtel'] }),
  a('b12', 'P-Kobalamin (B12)', 'klinisk_kemi', 'serum', { matvarden: ['kobalamin'], dubblettTimmar: 24 * 30, ord: ['b12', 'kobalamin', 'vitamin b12'] }),
  a('folat', 'P-Folat', 'klinisk_kemi', 'serum', { matvarden: ['folat'], dubblettTimmar: 24 * 30, ord: ['folat', 'folsyra'] }),
  a('blododling', 'Blododling', 'mikrobiologi', 'blododling', { odling: true, anamnes: true, dubblettTimmar: 2, ord: ['blododling', 'odling', 'sepsis', 'bakterier i blodet'] }),
  a('urinodling', 'U-Odling', 'mikrobiologi', 'urin', { odling: true, anamnes: true, dubblettTimmar: 24, ord: ['urinodling', 'odling', 'urinvägsinfektion', 'uvi'] }),
  a('pad', 'PAD, vävnadsprov', 'patologi', 'vavnad', { patologi: true, anamnes: true, dubblettTimmar: 0, ord: ['pad', 'biopsi', 'vävnadsprov', 'patologi'] }),
];
export const ANALYS = tabell(Object.fromEntries(ANALYSER.map(x => [x.id, x])));

// Paketen. Systemet föreslår paket ur vårdkontaktens orsak (ord), patientens diagnoser (ICD-10-prefix) och tidigare
// beställningar på vårdenheten. Paketens innehåll kan systemförvaltningen ändra som parameter (konfiguration.js,
// Sussa 12.1.1.9). Feber och frossa är Sussas testfall 3.1: tre analyser till klinisk kemi och en blododling.
export const PAKET = [
  { id: 'feber', namn: 'Feber och frossa', analyser: ['crp', 'blodstatus', 'kreatinin', 'blododling'], ord: ['feber', 'frossa', 'sepsis', 'infektion'], diagnoser: ['A41', 'J18', 'N30'] },
  { id: 'anemi', namn: 'Anemiutredning', analyser: ['blodstatus', 'b12', 'folat'], ord: ['anemi', 'trötthet', 'blodbrist'], diagnoser: ['D50', 'D51', 'D52', 'D64'] },
  { id: 'hjartsvikt', namn: 'Hjärtsvikt, kontroll', analyser: ['ntprobnp', 'kreatinin', 'natrium', 'kalium', 'blodstatus'], ord: ['andfådd', 'andfåddhet', 'bensvullnad', 'hjärtsvikt'], diagnoser: ['I50'] },
  { id: 'brostsmarta', namn: 'Bröstsmärta', analyser: ['troponin', 'blodstatus', 'kreatinin', 'kalium'], ord: ['bröstsmärta', 'tryck över bröstet'], diagnoser: ['I20', 'I21'] },
  { id: 'diabetes', namn: 'Diabetes, årskontroll', analyser: ['hba1c', 'glukos', 'kreatinin'], ord: ['diabetes'], diagnoser: ['E10', 'E11'] },
  { id: 'waran', namn: 'Waran, kontroll', analyser: ['pk'], ord: ['waran', 'warfarin'], diagnoser: ['I48'], atc: ['B01AA03'] },
  { id: 'inskrivning', namn: 'Inskrivningsprover', analyser: ['blodstatus', 'crp', 'natrium', 'kalium', 'kreatinin', 'glukos'], ord: [], diagnoser: [], inskrivning: true },
];
export const PAKETEN = tabell(Object.fromEntries(PAKET.map(p => [p.id, p])));

// Svaren från det simulerade laboratoriet. normal är ett typiskt värde för en frisk vuxen och infektion värdet vid feber
// och frossa, så att demon ser ut som den ska. kritiskLag och kritiskHog är demons gränser för ett kritiskt svar, som
// larmar läkaren och sjuksköterskan direkt.
export const SVARSVARDEN = tabell({
  crp: { normal: 3, infektion: 86, decimaler: 0 },
  hb: { normal: 138, infektion: 131, kritiskLag: 70, decimaler: 0 },
  lpk: { normal: 6.4, infektion: 14.2, kritiskLag: 1.0, kritiskHog: 50, decimaler: 1 },
  tpk: { normal: 245, infektion: 312, kritiskLag: 20, decimaler: 0 },
  kreatinin: { normal: 78, infektion: 96, decimaler: 0 },
  natrium: { normal: 140, infektion: 136, kritiskLag: 120, kritiskHog: 160, decimaler: 0 },
  kalium: { normal: 4.1, infektion: 3.9, kritiskLag: 2.8, kritiskHog: 6.2, decimaler: 1 },
  glukos: { normal: 5.4, infektion: 6.8, kritiskLag: 2.5, kritiskHog: 25, decimaler: 1 },
  hba1c: { normal: 38, decimaler: 0 },
  inr: { normal: 1.0, kritiskHog: 5, decimaler: 1 },
  ntprobnp: { normal: 95, decimaler: 0 },
  troponin: { normal: 8, kritiskHog: 1000, decimaler: 0 },
  tsh: { normal: 1.8, decimaler: 1 },
  kobalamin: { normal: 310, decimaler: 0 },
  folat: { normal: 14, decimaler: 0 },
});

// Fynd i odlingar, med Snomed CT. Kontrollerade mot tx.fhir.org (SNOMED CT International) 2026-11-08.
export const FYND = tabell({
  ingen_vaxt: { snomed: '264868006', display: 'No growth', text: 'Ingen växt' },
  e_coli: { snomed: '112283007', display: 'Escherichia coli', text: 'Växt av Escherichia coli' },
  s_aureus: { snomed: '3092008', display: 'Staphylococcus aureus', text: 'Växt av Staphylococcus aureus' },
});

// Kontrollerna som läkaren ordinerar till avdelningen (Sussas testfall 3.5). matvarde är mätvärdestypen som
// sjuksköterskan registrerar, och systemet bockar av kontrollen när ett sådant värde registreras i tid. Vätskebalansen
// följs i läkemedelsprocessens vätskebalans. SR och blodsocker är interna analyser som tas på avdelningen.
export const KONTROLLER = [
  { id: 'puls', namn: 'Puls', matvarde: 'puls' },
  { id: 'blodtryck', namn: 'Blodtryck', matvarde: 'blodtryck' },
  { id: 'sr', namn: 'SR', matvarde: 'sr', intern: true },
  { id: 'temp', namn: 'Temperatur', matvarde: 'temp' },
  { id: 'vikt', namn: 'Vikt', matvarde: 'vikt' },
  { id: 'vatskebalans', namn: 'Vätskebalans', vatskebalans: true },
  { id: 'saturation', namn: 'Syremättnad', matvarde: 'saturation' },
  { id: 'andningsfrekvens', namn: 'Andningsfrekvens', matvarde: 'andningsfrekvens' },
  { id: 'glukos', namn: 'Blodsocker', matvarde: 'glukos', intern: true },
];
export const KONTROLL = tabell(Object.fromEntries(KONTROLLER.map(k => [k.id, k])));

// Hur ofta en kontroll görs. intervall i timmar. fore_maltid är före frukost, lunch och middag. vatskebalans följs
// över ett helt dygn från starten.
export const FREKVENSER = tabell({
  en_gang: { namn: 'En gång', tider: 'en' },
  var_4: { namn: 'Var fjärde timme', intervall: 4 },
  var_6: { namn: 'Var sjätte timme', intervall: 6 },
  var_8: { namn: 'Var åttonde timme', intervall: 8 },
  morgon_kvall: { namn: 'Morgon och kväll', klockslag: ['07:00', '19:00'] },
  fore_maltid: { namn: 'Före måltid', klockslag: ['07:30', '11:30', '16:30'] },
  dygnet: { namn: 'Under ett dygn', dygn: true },
});
