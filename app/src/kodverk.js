// Kodverk som Vårdkällan använder, kontrollerade mot primärkällan. Kontrollen beskrivs i docs/kodkontroll.md.
// Varje tabell här är facit för seeden och för FHIR-API:t, och testerna i test/kodverk.test.js håller ihop dem.

export const SYSTEM = {
  // Socialstyrelsens OID för ICD-10-SE (filbeskrivningen till icd-10-se.tsv). HL7 har ingen registrerad URI för ICD-10-SE.
  icd10se: 'urn:oid:1.2.752.116.1.1.1',
  atc: 'http://www.whocc.no/atc',
  loinc: 'http://loinc.org',
  // NPU enligt HL7 Terminology (NamingSystem NPU, föredragen URI sedan 2024-11-06).
  npu: 'http://npu-terminology.org',
  ucum: 'http://unitsofmeasure.org',
};

// ICD-10-SE 2026, titel ordagrant ur Socialstyrelsens icd-10-se.tsv (giltig från 2026-01-01).
// Treställiga kategorier utan uppdelning kompletteras med decimalen 9 (ICD-10-SE Del 1, inledningen), därav I10.9 och J13.9.
export const ICD10SE = {
  'E03.9': 'Hypotyreos, ospecificerad',
  'E10.0': 'Diabetes mellitus typ 1 - med koma',
  'E10.9': 'Diabetes mellitus typ 1 - utan komplikationer',
  'E11.9': 'Diabetes mellitus typ 2 - utan komplikationer',
  'E78.0': 'Isolerad hyperkolesterolemi',
  'F32.1': 'Medelsvår depressiv episod',
  'F33.1': 'Recidiverande depression, medelsvår episod',
  'F41.1': 'Generaliserat ångestsyndrom',
  'G30.1': 'Alzheimers sjukdom med sen debut',
  'H66.9': 'Mellanöreinflammation, ej specificerad som varig eller icke varig',
  'I10.9': 'Essentiell hypertoni (högt blodtryck utan känd orsak)',
  'I20.9': 'Angina pectoris, ospecificerad',
  'I21.4': 'Akut subendokardiell infarkt',
  'I48.0': 'Paroxysmalt förmaksflimmer',
  'I48.1': 'Persisterande förmaksflimmer',
  'I48.2': 'Kroniskt förmaksflimmer',
  'I49.1': 'Prematur depolarisation av förmaket',
  'I50.0': 'Högerhjärtsvikt',
  'I50.1': 'Vänsterhjärtsvikt',
  'I50.9': 'Hjärtinsufficiens, ospecificerad',
  'J02.9': 'Akut faryngit, ospecificerad',
  'J13.9': 'Pneumoni orsakad av Streptococcus pneumoniae',
  'J18.9': 'Pneumoni, ospecificerad',
  'J45.9': 'Astma, ospecificerad',
  'K21.9': 'Gastroesofageal refluxsjukdom utan esofagit',
  'M81.9': 'Osteoporos, ospecificerad',
  'N18.3': 'Kronisk njursvikt, stadium 3',
  'N18.4': 'Kronisk njursvikt, stadium 4',
  'N20.1': 'Uretärsten',
  'N30.0': 'Akut cystit (urinvägsinfektion lokaliserad till urinblåsan)',
  'R00.2': 'Hjärtklappning',
  'R29.6': 'Fallbenägenhet, som ej klassificeras på annan plats',
  'S72.00': 'Kollumfraktur - sluten',
  'S83.5': 'Distorsion engagerande knäets (främre) (bakre) korsband',
  'Z30.4': 'Övervakning av förskrivna preventivläkemedel',
  'Z91.0': 'Allergi och annan överkänslighet som inte beror på läkemedel och biologiska substanser i den egna sjukhistorien',
};

// ATC-benämning ordagrant ur WHO:s ATC/DDD-index 2026 (atcddd.fhi.no, senast uppdaterat 2026-01-20).
// Används som display i FHIR. Den svenska substansen står i läkemedelskatalogen.
export const ATC = {
  'A02BC01': 'omeprazole', 'A10AB05': 'insulin aspart', 'A10AE04': 'insulin glargine', 'A10BA02': 'metformin',
  'A10BK03': 'empagliflozin', 'A12AX': 'Calcium, combinations with vitamin D and/or other drugs',
  'B01AA03': 'warfarin', 'B01AB04': 'dalteparin', 'B01AB05': 'enoxaparin', 'B01AC06': 'acetylsalicylic acid',
  'B01AC24': 'ticagrelor', 'B01AF01': 'rivaroxaban', 'B01AF02': 'apixaban',
  'C01AA05': 'digoxin', 'C01CA24': 'epinephrine', 'C01DA02': 'glyceryl trinitrate', 'C03CA01': 'furosemide',
  'C03DA01': 'spironolactone', 'C07AB02': 'metoprolol', 'C07AB07': 'bisoprolol', 'C08CA01': 'amlodipine',
  'C09AA02': 'enalapril', 'C09AA05': 'ramipril', 'C09CA01': 'losartan', 'C10AA01': 'simvastatin', 'C10AA05': 'atorvastatin',
  'G03AC09': 'desogestrel', 'H02AB06': 'prednisolone', 'H03AA01': 'levothyroxine sodium',
  'J01AA02': 'doxycycline', 'J01CA04': 'amoxicillin', 'J01CA08': 'pivmecillinam', 'J01CE01': 'benzylpenicillin',
  'J01CE02': 'phenoxymethylpenicillin', 'J01XE01': 'nitrofurantoin',
  'M01AB05': 'diclofenac', 'M01AE01': 'ibuprofen', 'M01AE02': 'naproxen', 'M05BA04': 'alendronic acid',
  'N02AA01': 'morphine', 'N02AA05': 'oxycodone', 'N02BE01': 'paracetamol', 'N05CF01': 'zopiclone', 'N05CH01': 'melatonin',
  'N06AB06': 'sertraline', 'N06AB10': 'escitalopram', 'N06AX11': 'mirtazapine', 'N06DA02': 'donepezil',
  'R03AC02': 'salbutamol', 'R03BA02': 'budesonide',
  // Grupper som överkänslighet och varningsregler använder.
  'J01C': 'BETA-LACTAM ANTIBACTERIALS, PENICILLINS', 'M01A': 'ANTIINFLAMMATORY AND ANTIRHEUMATIC PRODUCTS, NON-STEROIDS',
  'B01AA': 'Vitamin K antagonists', 'B01AB': 'Heparin group', 'B01AE': 'Direct thrombin inhibitors', 'B01AF': 'Direct factor Xa inhibitors',
};

// Mätvärden. Labbresultat kodas med NPU (används av svenska laboratorier), kontrollerat mot IFCC:s NPU-fil
// npu-codes-latest.csv (senaste ändring 2026-09-22). Vitalparametrar kodas med LOINC eftersom FHIR R4:s
// vitalparameterprofiler kräver de koderna, kontrollerat mot LOINC 2.83 via tx.fhir.org. NPU har ingen kod för PEF,
// så PEF har LOINC. ucum är enhetens kod i UCUM, enheten som visas står i db.js (MATTYPER_ENHET).
// Display för NPU anges inte i FHIR: tx.fhir.org har inte NPU:s innehåll och den svenska texten står i code.text.
const vp = (code, display, ucum, profil) => ({ kategori: 'vital-signs', coding: [{ system: SYSTEM.loinc, code, display }], ucum, profil });
const npu = (code, ucum) => ({ kategori: 'laboratory', coding: [{ system: SYSTEM.npu, code }], ucum });
export const MATKOD = {
  blodtryck: { ...vp('85354-9', 'Blood pressure panel with all children optional', 'mm[Hg]', 'bp'),
    komponenter: [{ code: '8480-6', display: 'Systolic blood pressure' }, { code: '8462-4', display: 'Diastolic blood pressure' }] },
  puls: vp('8867-4', 'Heart rate', '/min', 'heartrate'),
  temp: vp('8310-5', 'Body temperature', 'Cel', 'bodytemp'),
  // Vitalparameterprofilen för syremättnad kräver 2708-6. 59408-5 anger att värdet är mätt med pulsoximeter.
  saturation: { ...vp('2708-6', 'Oxygen saturation in Arterial blood', '%', 'oxygensat'),
    coding: [{ system: SYSTEM.loinc, code: '2708-6', display: 'Oxygen saturation in Arterial blood' }, { system: SYSTEM.loinc, code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' }] },
  andningsfrekvens: vp('9279-1', 'Respiratory rate', '/min', 'resprate'),
  vikt: vp('29463-7', 'Body weight', 'kg', 'bodyweight'),
  langd: vp('8302-2', 'Body height', 'cm', 'bodyheight'),
  pef: { kategori: 'exam', coding: [{ system: SYSTEM.loinc, code: '19935-6', display: 'Maximum expiratory gas flow Respiratory system airway by Peak flow meter' }], ucum: 'L/min' },
  crp: npu('NPU19748', 'mg/L'), // P, C-reactive protein; mass c. = ? mg/L
  // eGFR har ingen kod: NPU28811 (Kidn., Glomerular filtration; vol.rate(surf.=1.73 m²)) anger inte att värdet är skattat
  // från kreatinin, och NPU-filen har ingen kod för skattat GFR. Texten och enheten finns kvar.
  egfr: { kategori: 'laboratory', coding: [], ucum: 'mL/min/{1.73_m2}' },
  kreatinin: npu('NPU18016', 'umol/L'), // P, Creatininium; subst.c. = ? µmol/L
  hba1c: npu('NPU27300', 'mmol/mol'), // Haemoglobin beta chain(B), N-(1-deoxyfructos-1-yl)haemoglobin beta chain; subst.fr. = ? mmol/mol
  inr: npu('NPU01685', '{INR}'), // P, Coagulation, tissue factor-induced; rel.time(actual/norm;INR;IRP 67/40;proc.) = ?
  ntprobnp: npu('NPU21571', 'ng/L'), // P, Pro-brain natriuretic peptide(1-76); mass c. = ? ng/L
  hb: npu('NPU28309', 'g/L'), // B, Haemoglobin; mass c. = ? g/L
  glukos: npu('NPU02192', 'mmol/L'), // P, Glucose; subst.c. = ? mmol/L
  kalium: npu('NPU03230', 'mmol/L'), // P, Potassium ion; subst.c. = ? mmol/L
  troponin: npu('NPU27501', 'ng/L'), // P, Troponin T, cardiac muscle; mass c. = ? ng/L
  tsh: npu('NPU03577', 'm[IU]/L'), // P, Thyrotropin; arb.subst.c.(IRP 80/558;proc.) = ? × 10-3 IU/L
};
