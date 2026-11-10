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
  // Runda 9, r3: blodgruppering, bastest och blodprodukter till blodcentralen (blod.js, Sussa 4.4.2.12).
  transfusionsmedicin: { namn: 'Transfusionsmedicin', fhir: 'BLB' },
  // Runda 10, r6: klinisk immunologi och klinisk genetik, med svar i text från producentsystemen (produktionssystem.js,
  // Sussa 5.1.4.5). fhir är avdelningen i HL7 v2 tabell 0074.
  klinisk_immunologi: { namn: 'Klinisk immunologi', fhir: 'IMM' },
  klinisk_genetik: { namn: 'Klinisk genetik', fhir: 'GE' },
  // Runda 10, r6: undersökningar utan provtagning, där den utförande enheten kallar patienten och svarar med ett
  // utlåtande: klinisk fysiologi, klinisk neurofysiologi och radiologi.
  klinisk_fysiologi: { namn: 'Klinisk fysiologi', fhir: 'EC' },
  klinisk_neurofysiologi: { namn: 'Klinisk neurofysiologi', fhir: 'EN' },
  radiologi: { namn: 'Radiologi', fhir: 'RAD' },
  // Runda 11, r6: patientnära analyser, som görs med ett instrument på avdelningen (Sussa 4.4.2.14).
  patientnara: { namn: 'Patientnära analys', fhir: 'LAB' },
});

// De simulerade laboratorierna. Klinisk kemi har tre utförande laboratorier (Sussa 4.4.1.2), och systemet väljer det
// som hör till sjukhuset där beställningen görs. sjukhus är enhetens sjukhus i enhetsträdet (seed/enheter.js).
export const LABORATORIER = [
  { id: 'lab-kem-uso', hsa: 'SE2321000164-VKL101', namn: 'Klinisk kemi USÖ (simulerat laboratorium)', kort: 'Klinisk kemi USÖ', disciplin: 'klinisk_kemi', sjukhus: ['uso', 'primarvard'] },
  { id: 'lab-kem-lind', hsa: 'SE2321000164-VKL201', namn: 'Klinisk kemi Lindesberg (simulerat laboratorium)', kort: 'Klinisk kemi Lindesberg', disciplin: 'klinisk_kemi', sjukhus: ['lind'] },
  { id: 'lab-kem-kkoga', hsa: 'SE2321000164-VKL301', namn: 'Klinisk kemi Karlskoga (simulerat laboratorium)', kort: 'Klinisk kemi Karlskoga', disciplin: 'klinisk_kemi', sjukhus: ['kkoga'] },
  { id: 'lab-mikro-uso', hsa: 'SE2321000164-VKL102', namn: 'Klinisk mikrobiologi USÖ (simulerat laboratorium)', kort: 'Klinisk mikrobiologi', disciplin: 'mikrobiologi', sjukhus: [] },
  { id: 'lab-pat-uso', hsa: 'SE2321000164-VKL103', namn: 'Klinisk patologi USÖ (simulerat laboratorium)', kort: 'Klinisk patologi', disciplin: 'patologi', sjukhus: [] },
  // Runda 9, r3: den simulerade blodcentralen.
  { id: 'lab-blod-uso', hsa: 'SE2321000164-VKL104', namn: 'Blodcentralen USÖ (simulerad)', kort: 'Blodcentralen', disciplin: 'transfusionsmedicin', sjukhus: [] },
  // Runda 10, r6: de simulerade laboratorierna för klinisk immunologi och klinisk genetik.
  { id: 'lab-imm-uso', hsa: 'SE2321000164-VKL105', namn: 'Klinisk immunologi USÖ (simulerat laboratorium)', kort: 'Klinisk immunologi', disciplin: 'klinisk_immunologi', sjukhus: [] },
  { id: 'lab-gen-uso', hsa: 'SE2321000164-VKL106', namn: 'Klinisk genetik USÖ (simulerat laboratorium)', kort: 'Klinisk genetik', disciplin: 'klinisk_genetik', sjukhus: [] },
  { id: 'lab-fys-uso', hsa: 'SE2321000164-VKL107', namn: 'Klinisk fysiologi USÖ (simulerad)', kort: 'Klinisk fysiologi', disciplin: 'klinisk_fysiologi', sjukhus: [] },
  { id: 'lab-nfys-uso', hsa: 'SE2321000164-VKL108', namn: 'Klinisk neurofysiologi USÖ (simulerad)', kort: 'Klinisk neurofysiologi', disciplin: 'klinisk_neurofysiologi', sjukhus: [] },
  { id: 'lab-rad-uso', hsa: 'SE2321000164-VKL109', namn: 'Röntgenkliniken USÖ (simulerad)', kort: 'Röntgen', disciplin: 'radiologi', sjukhus: [] },
];
// Runda 11, r6: ultraljudet är ett eget specialistsystem på röntgenkliniken, så att en beställning av röntgen och ultraljud
// blir två beställningar (Sussa 4.4.2.8). De patientnära instrumenten på avdelningarna ansluts genom det öppna
// gränssnittet som ett producentsystem (Sussa 4.4.2.14). Enheten är vårdenheten som utför undersökningarna.
LABORATORIER.push(
  { id: 'lab-ul-uso', hsa: 'SE2321000164-VKL110', namn: 'Ultraljud, Röntgenkliniken USÖ (simulerad)', kort: 'Ultraljud', disciplin: 'radiologi', sjukhus: [], enhet: 'uso-rtg' },
  { id: 'lab-pn-uso', hsa: 'SE2321000164-VKL111', namn: 'Patientnära instrument på avdelningen (simulerat)', kort: 'Patientnära instrument', disciplin: 'patientnara', sjukhus: [], instrument: true },
);
for (const l of LABORATORIER) if (l.id === 'lab-rad-uso') l.enhet = 'uso-rtg';
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
  // Runda 10, r6: en undersökning har inget prov. Systemet skickar beställningen direkt, och den utförande enheten
  // kallar patienten. utanProv gör att den inte står på provtagningslistan och inte blir en Specimen.
  undersokning: { namn: 'Undersökning', beskrivning: 'ingen provtagning, den utförande enheten kallar patienten', farg: 'ingen', ordning: 8, material: 'Undersökning', utanProv: true },
  // Runda 11, r6: ett kapillärprov för en patientnära analys, som mäts direkt i instrumentet vid sängen (Sussa 4.4.2.14).
  // Snomed CT 122554006 Capillary blood specimen, kontrollerad mot tx.fhir.org 2026-11-10.
  kapillart: { namn: 'Kapillärprov vid sängen', beskrivning: 'stick i fingret, provet mäts direkt i instrumentet', farg: 'ingen', ordning: 0, material: 'Kapillärblod', fhir: 'BLD', snomed: '122554006', snomedText: 'Capillary blood specimen', instrument: true },
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
  // Runda 9, r3: blodgruppering och bastest (antikroppsscreening) till blodcentralen. Bastestet gäller i tre dygn inför en
  // transfusion (BASTEST_TIMMAR, demoregel), och blodgrupperingen behöver bara göras om när den saknas.
  a('blodgruppering', 'B-Blodgruppering (AB0 och RhD)', 'transfusionsmedicin', 'edta', { transfusion: true, dubblettTimmar: 24 * 365, ord: ['blodgruppering', 'blodgrupp', 'ab0', 'rhd'] }),
  a('bastest', 'B-Bastest (antikroppsscreening)', 'transfusionsmedicin', 'edta', { transfusion: true, dubblettTimmar: 72, ord: ['bastest', 'antikroppsscreening', 'blodbeställning', 'transfusion'] }),
  // Runda 10, r6: analyser med svar i text. utlatande är det simulerade laboratoriets svar, och laboratoriets eget svar
  // kommer genom producentsystemet (produktionssystem.js).
  a('ana', 'S-ANA (antinukleära antikroppar)', 'klinisk_immunologi', 'serum', { utlatande: 'ANA negativ. Inga antinukleära antikroppar påvisade.', dubblettTimmar: 24 * 30, ord: ['ana', 'antinukleära antikroppar', 'reumatisk sjukdom', 'sle', 'ledvärk'] }),
  a('ekg', 'Vilo-EKG', 'klinisk_fysiologi', 'undersokning', { utlatande: 'Sinusrytm 68 per minut. Normalt vilo-EKG.', dubblettTimmar: 24, ord: ['ekg', 'vilo-ekg', 'hjärtklappning', 'arytmi', 'bröstsmärta'] }),
  a('eeg', 'EEG', 'klinisk_neurofysiologi', 'undersokning', { utlatande: 'Normal bakgrundsaktivitet. Ingen epileptiform aktivitet.', anamnes: true, dubblettTimmar: 24 * 30, ord: ['eeg', 'kramp', 'epilepsi', 'medvetandeförlust'] }),
  a('rtg_lungor', 'Röntgen lungor', 'radiologi', 'undersokning', { utlatande: 'Inga infiltrat. Normal hjärtstorlek. Ingen pleuravätska.', anamnes: true, dubblettTimmar: 24, ord: ['röntgen', 'lungröntgen', 'lunginflammation', 'pneumoni', 'hosta'] }),
  a('hfe', 'B-HFE-genotyp (hemokromatos)', 'klinisk_genetik', 'edta', { utlatande: 'Ingen av varianterna C282Y och H63D i HFE-genen påvisad.', anamnes: true, dubblettTimmar: 24 * 365, ord: ['hfe', 'hemokromatos', 'järninlagring', 'ferritin'] }),
];
// Runda 11, r6: radiologi, ultraljud, klinisk fysiologi och klinisk neurofysiologi i samma flöde som laboratoriet
// (undersokningar.js, Sussa 4.4.2.2, 4.4.2.7, 4.4.2.8 och 4.4.2.11), och patientnära analyser med instrument
// (patientnara.js, Sussa 4.4.2.14).
//   kva        åtgärden i KVÅ 2026, som svaret har och som systemet sätter själv (kodverk.js KVA, docs/kodkontroll.md)
//   modalitet  DICOM-modaliteten: DX röntgen, CT datortomografi, MR magnetkamera, US ultraljud, ECG och EEG
//   stralning  joniserande strålning, så att systemet frågar om graviditet
//   kontrast   jodkontrast, så att systemet kontrollerar njurfunktionen och överkänslighet
//   buk        strålning mot buken eller bäckenet, som systemet stoppar vid graviditet
//   magnet     magnetkamera, så att systemet kontrollerar implantat
//   arkiv      undersökningen i multimediaarkivet (bilder.js UNDERSOKNINGAR), som utlåtandet länkar till
//   fynd       det simulerade utlåtandets fynd i Snomed CT, kontrollerat mot tx.fhir.org 2026-11-10
//   minuter    hur lång tid undersökningen tar på den simulerade enheten, för bokningen
// Utlåtandena och tiderna är demons, inte en klinisk fysiologis eller röntgenklinikens.
const u = (id, namn, disciplin, rest) => a(id, namn, disciplin, 'undersokning', { anamnes: true, dubblettTimmar: 24, ...rest });
ANALYSER.push(
  u('rtg_hoft', 'Röntgen höftled', 'radiologi', { kva: 'AN062', modalitet: 'DX', stralning: true, buk: true, arkiv: 'hoftled', minuter: 15, utlatande: 'Normal ledspringa i höftleden. Ingen fraktur.', ord: ['höft', 'höftsmärta', 'höftfraktur', 'artros', 'fall'] }),
  u('rtg_kna', 'Röntgen knäled', 'radiologi', { kva: 'AN063', modalitet: 'DX', stralning: true, minuter: 15, utlatande: 'Normal ledspringa. Ingen fraktur eller ledvätska.', ord: ['knä', 'knäsmärta', 'knäskada', 'artros'] }),
  u('dt_hjarna', 'DT hjärna', 'radiologi', { kva: 'AA014', modalitet: 'CT', stralning: true, arkiv: 'dt_hjarna', minuter: 20, utlatande: 'Ingen blödning eller expansivitet. Normal ventrikelvidd.', ord: ['huvudvärk', 'stroke', 'skalltrauma', 'förvirring', 'dt hjärna'] }),
  u('dt_buk', 'DT buk med kontrast', 'radiologi', { kva: 'AJ004', modalitet: 'CT', stralning: true, buk: true, kontrast: true, minuter: 20, utlatande: 'Inga tecken till tumör eller abscess. Normala parenkymatösa organ.', ord: ['buksmärta', 'ileus', 'divertikulit', 'viktnedgång', 'dt buk'] }),
  u('dt_torax', 'DT torax med kontrast', 'radiologi', { kva: 'AG009', modalitet: 'CT', stralning: true, kontrast: true, minuter: 20, fynd: '309529002', utlatande: 'Rundhärd 18 mm i höger överlob, förenlig med tumör. Inga förstorade lymfkörtlar.', ord: ['hemoptys', 'lungcancer', 'rundhärd', 'blodig hosta', 'dt torax'] }),
  u('mr_hjarna', 'MR hjärna', 'radiologi', { kva: 'AA045', modalitet: 'MR', magnet: true, minuter: 40, utlatande: 'Inga vitsubstansförändringar. Ingen expansivitet.', ord: ['ms', 'multipel skleros', 'yrsel', 'mr hjärna'] }),
  u('mr_kna', 'MR knäled', 'radiologi', { kva: 'AN042', modalitet: 'MR', magnet: true, minuter: 30, utlatande: 'Ingen menisk- eller korsbandsskada.', ord: ['knäskada', 'menisk', 'korsband', 'mr knä'] }),
  u('ul_buk', 'Ultraljud buk', 'radiologi', { lab: 'lab-ul-uso', kva: 'AJ084', modalitet: 'US', minuter: 30, utlatande: 'Gallblåsa utan konkrement. Normal lever och mjälte.', ord: ['gallsten', 'gallbesvär', 'buksmärta', 'lever', 'ultraljud'] }),
  u('ul_njurar', 'Ultraljud njurar', 'radiologi', { lab: 'lab-ul-uso', kva: 'AK044', modalitet: 'US', minuter: 20, utlatande: 'Normalstora njurar utan avflödeshinder.', ord: ['njursvikt', 'njursten', 'hydronefros', 'ultraljud'] }),
  u('arbetsprov', 'Arbetsprov (arbets-EKG)', 'klinisk_fysiologi', { kva: 'AF012', modalitet: 'ECG', minuter: 45, dubblettTimmar: 24 * 30, utlatande: 'Ingen ischemi upp till 200 W. Normalt blodtryckssvar.', ord: ['arbetsprov', 'arbets-ekg', 'angina', 'kärlkramp', 'ansträngningsutlöst bröstsmärta'] }),
  u('eko', 'Ekokardiografi', 'klinisk_fysiologi', { kva: 'AF020', modalitet: 'US', minuter: 30, dubblettTimmar: 24 * 30, utlatande: 'Normal vänsterkammarfunktion, ejektionsfraktion 60 procent. Inga klaffel.', ord: ['ekokardiografi', 'hjärteko', 'blåsljud', 'hjärtsvikt'] }),
  u('neurografi', 'Neurografi', 'klinisk_neurofysiologi', { kva: 'AA058', modalitet: 'EMG', minuter: 45, dubblettTimmar: 24 * 30, utlatande: 'Normala ledningshastigheter i undersökta nerver.', ord: ['neurografi', 'domningar', 'karpaltunnel', 'polyneuropati'] }),
  // Patientnära analyser: mäts i instrumentet på avdelningen och skickas genom det öppna gränssnittet. Samma mätvärden
  // som laboratoriets, så att kurvorna och kontrollerna är gemensamma.
  a('crp_pn', 'P-CRP, patientnära', 'patientnara', 'kapillart', { matvarden: ['crp'], lab: 'lab-pn-uso', patientnara: true, dubblettTimmar: 4, ord: ['crp', 'patientnära', 'snabb-crp'] }),
  a('glukos_pn', 'P-Glukos, patientnära', 'patientnara', 'kapillart', { matvarden: ['glukos'], lab: 'lab-pn-uso', patientnara: true, dubblettTimmar: 1, ord: ['glukos', 'blodsocker', 'patientnära'] }),
  a('hb_pn', 'B-Hb, patientnära', 'patientnara', 'kapillart', { matvarden: ['hb'], lab: 'lab-pn-uso', patientnara: true, dubblettTimmar: 4, ord: ['hb', 'hemoglobin', 'patientnära'] }),
  a('inr_pn', 'P-PK(INR), patientnära', 'patientnara', 'kapillart', { matvarden: ['inr'], lab: 'lab-pn-uso', patientnara: true, dubblettTimmar: 20, ord: ['pk', 'inr', 'patientnära', 'waran'] }),
);
// Undersökningarna som fanns sedan runda 10 får sin åtgärd i KVÅ, modalitet och tid.
const tillagg = { ekg: { kva: 'AF022', modalitet: 'ECG', minuter: 15 }, eeg: { kva: 'AA024', modalitet: 'EEG', minuter: 60 }, rtg_lungor: { kva: 'AF053', modalitet: 'DX', stralning: true, arkiv: 'lungrontgen', minuter: 15, fynd: '281900007' } };
for (const x of ANALYSER) if (Object.hasOwn(tillagg, x.id)) Object.assign(x, tillagg[x.id]);
for (const x of ANALYSER) if (x.ror === 'undersokning' && !x.fynd) x.fynd = '281900007';
// Varje radiologisk undersökning blir en studie i multimediaarkivet (bilder.js UNDERSOKNINGAR) med samma nyckel.
for (const x of ANALYSER) if (x.disciplin === 'radiologi' && !x.arkiv) x.arkiv = x.id;
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

// Runda 9, r3: den simulerade blodcentralens svar. Blodgruppen räknas ur patientens id med ungefär den fördelning som
// finns i Sverige, så att samma patient alltid får samma blodgrupp. Bastestet är negativt utom när demon säger annat.
export const BASTEST_TIMMAR = 72;
const BLODGRUPPER = [['A+', 37], ['O+', 32], ['B+', 10], ['AB+', 5], ['A-', 7], ['O-', 6], ['B-', 2], ['AB-', 1]];
export function blodgruppFor(patientId) {
  let h = 2166136261;
  for (const c of String(patientId)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let x = (h >>> 0) % 100;
  for (const [g, andel] of BLODGRUPPER) { if (x < andel) return g; x -= andel; }
  return 'O+';
}
export const blodgruppText = (g) => `Blodgrupp ${g.replace(/[+-]$/, '')} RhD ${g.endsWith('+') ? 'positiv' : 'negativ'}`;
