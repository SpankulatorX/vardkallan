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
  // NPL-id enligt E-hälsomyndighetens FHIR-profiler för Nationella läkemedelslistan (se.electronichealth.fhir.nll.r4 1.3.1).
  nplid: 'http://electronichealth.se/fhir/NamingSystem/nplid',
  // NPL-pack-id enligt samma profiler (NLLMedicationRequest, delen coding:nplpackid), runda 6, r2.
  nplpackid: 'http://electronichealth.se/fhir/NamingSystem/nplpackid',
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
  'U82.1': 'Resistens mot meticillin',
  'Z22.3': 'Bärare av andra specificerade patogena bakterier',
  'Z30.4': 'Övervakning av förskrivna preventivläkemedel',
  // Runda 7, r6: hälsobesöken i barnhälsovården.
  'Z00.1': 'Rutinmässig hälsoundersökning av barn utan besvär eller utan att diagnos registrerats',
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
  // Runda 7, r1: Sussas läkemedel i användbarhetstesterna, kontrollerade mot WHO:s ATC/DDD-index 2026-11-08.
  'B05BA03': 'carbohydrates', 'B05XA05': 'magnesium sulfate', 'N05BA01': 'diazepam', 'R01AX03': 'ipratropium bromide',
  'R03BB01': 'ipratropium bromide', 'S01AA01': 'chloramphenicol',
  // Runda 6, r2: läkemedelstyperna utanför NPL (seed/produkttyper.js), kontrollerade mot WHO:s ATC/DDD-index 2026-11-03.
  'A11DA01': 'thiamine (vit B1)', 'B05AX01': 'erythrocytes', 'B05AX03': 'blood plasma', 'B05XA01': 'potassium chloride',
  'B05XA03': 'sodium chloride', 'V06DB': 'Fat/carbohydrates/proteins/minerals/vitamins, combinations',
  // Runda 9, r1: syrgas (seed/produkttyper.js), kontrollerad mot WHO:s ATC/DDD-index.
  'V03AN01': 'oxygen', 'C03DA05': 'finerenone',
  // Grupper som överkänslighet och varningsregler använder.
  'J01C': 'BETA-LACTAM ANTIBACTERIALS, PENICILLINS', 'M01A': 'ANTIINFLAMMATORY AND ANTIRHEUMATIC PRODUCTS, NON-STEROIDS',
  'B01AA': 'Vitamin K antagonists', 'B01AB': 'Heparin group', 'B01AE': 'Direct thrombin inhibitors', 'B01AF': 'Direct factor Xa inhibitors',
  // Runda 7, r6: vaccinerna i barnvaccinationsprogrammet, kontrollerade mot WHO:s ATC/DDD-index 2026-11-08.
  'J07BH01': 'rota virus, live attenuated', 'J07CA09': 'diphtheria-haemophilus influenzae B-pertussis-poliomyelitis-tetanus-hepatitis B',
  'J07AL02': 'pneumococcus, purified polysaccharides antigen conjugated', 'J07BD52': 'measles, combinations with mumps and rubella, live attenuated',
  'J07CA02': 'diphtheria-pertussis-poliomyelitis-tetanus', 'J07AN01': 'tuberculosis, live attenuated',
};

// Läkemedelsprodukter ordagrant ur Läkemedelsverkets NPL, totalfilen 2026-11-01_Total_NPL.zip (NPL 4.5): namn
// (medprodnamelegal), styrka, beredningsform och substansbeskrivning med NPL:s svenska text, ATC-kod,
// administrationsvägar och godkännandedatum. Ingen av produkterna är avregistrerad eller har stoppad försäljning.
// Administrationsvägarnas koder: ORAL oral, SUCU subkutan, INVE intravenös, INMU intramuskulär, SL sublingual,
// IH inhalation, GAST gastrisk, EXCO extrakorporal. Nyckeln är NPL-id.
export const NPL = {
  '19640101000028': { namn: 'Waran', styrka: '2,5 mg', form: 'Tablett', substans: 'Warfarin', atc: 'B01AA03', vagar: ['ORAL'], godkand: '1964-01-01' },
  '20111026000050': { namn: 'Eliquis', styrka: '5 mg', form: 'Filmdragerad tablett', substans: 'Apixaban', atc: 'B01AF02', vagar: ['GAST', 'ORAL'], godkand: '2012-11-19' },
  '20101127000035': { namn: 'Xarelto', styrka: '20 mg', form: 'Filmdragerad tablett', substans: 'Rivaroxaban', atc: 'B01AF01', vagar: ['ORAL'], godkand: '2011-12-14' },
  '19880318000057': { namn: 'Fragmin', styrka: '5000 IE', form: 'Injektionsvätska, lösning i förfylld spruta', substans: 'Dalteparin', atc: 'B01AB04', vagar: ['EXCO', 'INVE', 'SUCU'], godkand: '1988-03-18' },
  '20170530000130': { namn: 'Klexane', styrka: '4 000 IE (40 mg)/0,4 ml', form: 'Injektionsvätska, lösning i förfylld spruta', substans: 'Enoxaparin', atc: 'B01AB05', vagar: ['INVE', 'SUCU'], godkand: '1989-12-08' },
  '19910906000043': { namn: 'Trombyl', styrka: '75 mg', form: 'Tablett', substans: 'Acetylsalicylsyra', atc: 'B01AC06', vagar: ['ORAL'], godkand: '1991-09-06' },
  '20100114000225': { namn: 'Brilique', styrka: '90 mg', form: 'Filmdragerad tablett', substans: 'Tikagrelor', atc: 'B01AC24', vagar: ['GAST', 'ORAL'], godkand: '2010-12-03' },
  '20041011000027': { namn: 'Metoprolol Sandoz', styrka: '50 mg', form: 'Depottablett', substans: 'Metoprolol', atc: 'C07AB02', vagar: ['ORAL'], godkand: '2005-04-29' },
  '20001201000015': { namn: 'Bisoprolol Teva', styrka: '5 mg', form: 'Tablett', substans: 'Bisoprolol', atc: 'C07AB07', vagar: ['ORAL'], godkand: '2000-12-01' },
  '19900615000168': { namn: 'Furosemid Teva', styrka: '40 mg', form: 'Tablett', substans: 'Furosemid', atc: 'C03CA01', vagar: ['ORAL'], godkand: '1990-06-15' },
  '19820205000142': { namn: 'Spironolakton Pfizer', styrka: '25 mg', form: 'Tablett', substans: 'Spironolakton', atc: 'C03DA01', vagar: ['ORAL'], godkand: '1982-02-05' },
  '20041208000021': { namn: 'Enalapril Krka', styrka: '10 mg', form: 'Tablett', substans: 'Enalapril', atc: 'C09AA02', vagar: ['ORAL'], godkand: '2005-04-22' },
  '20100615000052': { namn: 'Ramipril Krka', styrka: '5 mg', form: 'Tablett', substans: 'Ramipril', atc: 'C09AA05', vagar: ['ORAL'], godkand: '2010-11-26' },
  '20090220000106': { namn: 'Losartan Krka', styrka: '50 mg', form: 'Filmdragerad tablett', substans: 'Losartan', atc: 'C09CA01', vagar: ['ORAL'], godkand: '2009-10-23' },
  '20060518000033': { namn: 'Amlodipin Krka', styrka: '5 mg', form: 'Tablett', substans: 'Amlodipin', atc: 'C08CA01', vagar: ['ORAL'], godkand: '2006-12-15' },
  '19741206000095': { namn: 'Digoxin Evolan', styrka: '0,13 mg', form: 'Tablett', substans: 'Digoxin', atc: 'C01AA05', vagar: ['ORAL'], godkand: '1974-12-06' },
  '19931008000069': { namn: 'Nitrolingual', styrka: '0,4 mg/dos', form: 'Sublingualspray', substans: 'Glyceryltrinitrat', atc: 'C01DA02', vagar: ['SL'], godkand: '1993-10-08' },
  '20070404000061': { namn: 'Atorvastatin Krka', styrka: '40 mg', form: 'Filmdragerad tablett', substans: 'Atorvastatin', atc: 'C10AA05', vagar: ['ORAL'], godkand: '2008-08-29' },
  '20041018000303': { namn: 'Simvastatin Krka', styrka: '20 mg', form: 'Filmdragerad tablett', substans: 'Simvastatin', atc: 'C10AA01', vagar: ['ORAL'], godkand: '2005-04-14' },
  '20070911000042': { namn: 'Metformin Sandoz', styrka: '500 mg', form: 'Filmdragerad tablett', substans: 'Metformin', atc: 'A10BA02', vagar: ['ORAL'], godkand: '2009-02-13' },
  '20140528000015': { namn: 'Jardiance', styrka: '10 mg', form: 'Filmdragerad tablett', substans: 'Empagliflozin', atc: 'A10BK03', vagar: ['ORAL'], godkand: '2014-05-22' },
  '20010115000066': { namn: 'NovoRapid FlexPen', styrka: '100 E/ml', form: 'Injektionsvätska, lösning i förfylld injektionspenna', substans: 'Insulin aspart', atc: 'A10AB05', vagar: ['SUCU'], godkand: '2001-01-15' },
  '20000609000061': { namn: 'Lantus (SoloStar)', styrka: '100 enheter/ml', form: 'Injektionsvätska, lösning i förfylld injektionspenna', substans: 'Insulin glargin', atc: 'A10AE04', vagar: ['SUCU'], godkand: '2000-06-09' },
  '19541213000015': { namn: 'Levaxin', styrka: '100 mikrogram', form: 'Tablett', substans: 'Levotyroxin', atc: 'H03AA01', vagar: ['ORAL'], godkand: '1954-12-13' },
  '20090716000061': { namn: 'Omeprazol Sandoz', styrka: '20 mg', form: 'Enterokapsel, hård', substans: 'Omeprazol', atc: 'A02BC01', vagar: ['ORAL'], godkand: '2010-12-16' },
  '19581115000027': { namn: 'Alvedon', styrka: '500 mg', form: 'Filmdragerad tablett', substans: 'Paracetamol', atc: 'N02BE01', vagar: ['ORAL'], godkand: '1958-11-15' },
  '20060817000079': { namn: 'Ibuprofen Orifarm', styrka: '400 mg', form: 'Filmdragerad tablett', substans: 'Ibuprofen', atc: 'M01AE01', vagar: ['ORAL'], godkand: '2009-10-30' },
  '20040607002797': { namn: 'Naproxen Orifarm', styrka: '250 mg', form: 'Tablett', substans: 'Naproxen', atc: 'M01AE02', vagar: ['ORAL'], godkand: '2005-07-01' },
  '20040607002094': { namn: 'Diklofenak Orifarm', styrka: '50 mg', form: 'Enterotablett', substans: 'Diklofenak', atc: 'M01AB05', vagar: ['ORAL'], godkand: '2005-05-27' },
  '20111221000060': { namn: 'Oxikodon Actavis', styrka: '5 mg', form: 'Kapsel, hård', substans: 'Oxikodon', atc: 'N02AA05', vagar: ['ORAL'], godkand: '2013-01-10' },
  '20110104000104': { namn: 'Morfin Abcur', styrka: '10 mg/ml', form: 'Injektionsvätska, lösning', substans: 'Morfin', atc: 'N02AA01', vagar: ['INMU', 'INVE', 'SUCU'], godkand: '2012-06-14' },
  '20230703000333': { namn: 'Bensylpenicillin Noridem', styrka: '3 g', form: 'Pulver till injektions-/infusionsvätska, lösning', substans: 'Bensylpenicillin', atc: 'J01CE01', vagar: ['INMU', 'INVE'], godkand: '2025-04-10' },
  '19790831000024': { namn: 'Kåvepenin', styrka: '1 g', form: 'Filmdragerad tablett', substans: 'Fenoximetylpenicillin', atc: 'J01CE02', vagar: ['ORAL'], godkand: '1979-08-31' },
  '20070919000044': { namn: 'Amoxicillin Sandoz', styrka: '750 mg', form: 'Filmdragerad tablett', substans: 'Amoxicillin', atc: 'J01CA04', vagar: ['ORAL'], godkand: '2009-12-11' },
  '19771216000013': { namn: 'Selexid', styrka: '200 mg', form: 'Filmdragerad tablett', substans: 'Pivmecillinam', atc: 'J01CA08', vagar: ['ORAL'], godkand: '1977-12-16' },
  '20111018000013': { namn: 'Doxycyklin EQL Pharma', styrka: '100 mg', form: 'Tablett', substans: 'Doxycyklin', atc: 'J01AA02', vagar: ['ORAL'], godkand: '2013-01-24' },
  '20140906000019': { namn: 'Nitrofurantoin Alternova', styrka: '50 mg', form: 'Tablett', substans: 'Nitrofurantoin', atc: 'J01XE01', vagar: ['ORAL'], godkand: '2015-07-16' },
  '19960403000015': { namn: 'Airomir', styrka: '0,1 mg/dos', form: 'Inhalationsspray, suspension', substans: 'Salbutamol', atc: 'R03AC02', vagar: ['IH'], godkand: '1996-04-03' },
  '19881209000118': { namn: 'Pulmicort Turbuhaler', styrka: '200 mikrogram/dos', form: 'Inhalationspulver', substans: 'Budesonid', atc: 'R03BA02', vagar: ['IH'], godkand: '1988-12-09' },
  '19961025000032': { namn: 'EpiPen jr', styrka: '150 mikrogram', form: 'Injektionsvätska, lösning i förfylld injektionspenna', substans: 'Adrenalin', atc: 'C01CA24', vagar: ['INMU'], godkand: '1996-10-25' },
  '20060510000031': { namn: 'Sertralin Teva', styrka: '50 mg', form: 'Filmdragerad tablett', substans: 'Sertralin', atc: 'N06AB06', vagar: ['ORAL'], godkand: '2007-01-26' },
  '20130410000049': { namn: 'Escitalopram Krka', styrka: '10 mg', form: 'Filmdragerad tablett', substans: 'Escitalopram', atc: 'N06AB10', vagar: ['ORAL'], godkand: '2014-03-28' },
  '20040916002945': { namn: 'Mirtazapin Krka', styrka: '15 mg', form: 'Filmdragerad tablett', substans: 'Mirtazapin', atc: 'N06AX11', vagar: ['ORAL'], godkand: '2005-04-08' },
  '20110326000029': { namn: 'Zopiklon Pilum', styrka: '5 mg', form: 'Filmdragerad tablett', substans: 'Zopiklon', atc: 'N05CF01', vagar: ['ORAL'], godkand: '2012-03-29' },
  '20221130000058': { namn: 'Melatonin Bluefish', styrka: '2 mg', form: 'Depottablett', substans: 'Melatonin', atc: 'N05CH01', vagar: ['ORAL'], godkand: '2023-12-08' },
  '20110113000041': { namn: 'Donepezil Krka', styrka: '5 mg', form: 'Filmdragerad tablett', substans: 'Donepezil', atc: 'N06DA02', vagar: ['ORAL'], godkand: '2011-11-03' },
  '20050805000013': { namn: 'Alendronat Teva Veckotablett', styrka: '70 mg', form: 'Tablett', substans: 'Alendronsyra', atc: 'M05BA04', vagar: ['ORAL'], godkand: '2006-02-10' },
  '20030905000052': { namn: 'Kalcipos-D', styrka: '500 mg/400 IE', form: 'Tuggtablett', substans: 'Kalcium + kolekalciferol (vitamin D3)', atc: 'A12AX', vagar: ['ORAL'], godkand: '2003-09-05' },
  '19730831000037': { namn: 'Prednisolon Pfizer', styrka: '5 mg', form: 'Tablett', substans: 'Prednisolon', atc: 'H02AB06', vagar: ['ORAL'], godkand: '1973-08-31' },
  '20100621000022': { namn: 'Desogestrel Sandoz', styrka: '75 mikrogram', form: 'Filmdragerad tablett', substans: 'Desogestrel', atc: 'G03AC09', vagar: ['ORAL'], godkand: '2011-11-24' },
  // Runda 7, r1: ur totalfilen 2026-11-03 (npl-schema_12.2). NPL anger ingen styrka för den buffrade glukosen, där
  // styrkan står i namnet. Administrationsvägarna OCUL (ögat) och NASA (näsan) är nya.
  '19660112000039': { namn: 'Addex-Magnesium', styrka: '1 mmol/ml', form: 'Koncentrat till infusionsvätska, lösning', substans: 'Magnesiumsulfat', atc: 'B05XA05', vagar: ['INVE'], godkand: '1966-01-12' },
  '19880617000116': { namn: 'Alvedon forte', styrka: '1 g', form: 'Filmdragerad tablett', substans: 'Paracetamol', atc: 'N02BE01', vagar: ['ORAL'], godkand: '1988-06-17' },
  '20120904000099': { namn: 'Atrovent', styrka: '20 mikrogram/dos', form: 'Inhalationsspray, lösning', substans: 'Ipratropium', atc: 'R03BB01', vagar: ['IH'], godkand: '2013-05-08' },
  '19870213000054': { namn: 'Atrovent', styrka: '0,25 mg/ml', form: 'Lösning för nebulisator', substans: 'Ipratropium', atc: 'R03BB01', vagar: ['IH'], godkand: '1987-02-13' },
  '19990604000040': { namn: 'Atrovent', styrka: '0,5 mg/ml', form: 'Lösning för nebulisator', substans: 'Ipratropium', atc: 'R03BB01', vagar: ['IH'], godkand: '1999-06-04' },
  '19960412000037': { namn: 'Rinivent', styrka: '21 mikrogram/dos', form: 'Nässpray, lösning', substans: 'Ipratropium', atc: 'R01AX03', vagar: ['NASA'], godkand: '1996-04-12' },
  '19930122000023': { namn: 'Glucos Baxter 25 mg/ml buffrad', styrka: '', form: 'Infusionsvätska, lösning', substans: 'Näringslösning: Glukos + elektrolyter', atc: 'B05BA03', vagar: ['INVE'], godkand: '1993-01-22' },
  '20141125000095': { namn: 'Kloramfenikol Santen', styrka: '5 mg/ml', form: 'Ögondroppar, lösning', substans: 'Kloramfenikol', atc: 'S01AA01', vagar: ['OCUL'], godkand: '2015-11-26' },
  '20141125000118': { namn: 'Kloramfenikol Santen', styrka: '10 mg/g', form: 'Ögonsalva', substans: 'Kloramfenikol', atc: 'S01AA01', vagar: ['OCUL'], godkand: '2015-11-26' },
  '20050409000020': { namn: 'Metformin Teva', styrka: '850 mg', form: 'Filmdragerad tablett', substans: 'Metformin', atc: 'A10BA02', vagar: ['ORAL'], godkand: '2005-09-02' },
  '20130713000050': { namn: 'Morfin Alternova', styrka: '10 mg', form: 'Tablett', substans: 'Morfin', atc: 'N02AA01', vagar: ['ORAL'], godkand: '2014-06-19' },
  '20090718000014': { namn: 'Paracetamol Fresenius Kabi', styrka: '10 mg/ml', form: 'Infusionsvätska, lösning', substans: 'Paracetamol', atc: 'N02BE01', vagar: ['INVE'], godkand: '2010-12-10' },
  '20040416000250': { namn: 'Sertralin Teva Pharma', styrka: '100 mg', form: 'Filmdragerad tablett', substans: 'Sertralin', atc: 'N06AB06', vagar: ['ORAL'], godkand: '2004-04-16' },
  '19670228000021': { namn: 'Stesolid', styrka: '5 mg', form: 'Tablett', substans: 'Diazepam', atc: 'N05BA01', vagar: ['ORAL'], godkand: '1967-02-28' },
  '19670228000038': { namn: 'Stesolid', styrka: '10 mg', form: 'Tablett', substans: 'Diazepam', atc: 'N05BA01', vagar: ['ORAL'], godkand: '1967-02-28' },
  '20081114000012': { namn: 'Zopiklon Pilum', styrka: '7,5 mg', form: 'Filmdragerad tablett', substans: 'Zopiklon', atc: 'N05CF01', vagar: ['ORAL'], godkand: '2009-12-04' },
  '20041011000034': { namn: 'Metoprolol Sandoz', styrka: '100 mg', form: 'Depottablett', substans: 'Metoprolol', atc: 'C07AB02', vagar: ['ORAL'], godkand: '2005-04-29' },
  '20100610000095': { namn: 'Bisoprolol Teva', styrka: '2,5 mg', form: 'Tablett', substans: 'Bisoprolol', atc: 'C07AB07', vagar: ['ORAL'], godkand: '2010-11-26' },
  '20001201000022': { namn: 'Bisoprolol Teva', styrka: '10 mg', form: 'Tablett', substans: 'Bisoprolol', atc: 'C07AB07', vagar: ['ORAL'], godkand: '2000-12-01' },
  '19821217000083': { namn: 'Spironolakton Pfizer', styrka: '50 mg', form: 'Tablett', substans: 'Spironolakton', atc: 'C03DA01', vagar: ['ORAL'], godkand: '1982-12-17' },
  '19821217000090': { namn: 'Spironolakton Pfizer', styrka: '100 mg', form: 'Tablett', substans: 'Spironolakton', atc: 'C03DA01', vagar: ['ORAL'], godkand: '1982-12-17' },
  '20041208000014': { namn: 'Enalapril Krka', styrka: '5 mg', form: 'Tablett', substans: 'Enalapril', atc: 'C09AA02', vagar: ['ORAL'], godkand: '2005-04-22' },
  '20041208000038': { namn: 'Enalapril Krka', styrka: '20 mg', form: 'Tablett', substans: 'Enalapril', atc: 'C09AA02', vagar: ['ORAL'], godkand: '2005-04-22' },
  '20111221000084': { namn: 'Oxikodon Actavis', styrka: '20 mg', form: 'Kapsel, hård', substans: 'Oxikodon', atc: 'N02AA05', vagar: ['ORAL'], godkand: '2013-01-10' },
  '20040916002969': { namn: 'Mirtazapin Krka', styrka: '45 mg', form: 'Filmdragerad tablett', substans: 'Mirtazapin', atc: 'N06AX11', vagar: ['ORAL'], godkand: '2005-04-08' },
  '20090220000083': { namn: 'Losartan Krka', styrka: '12,5 mg', form: 'Filmdragerad tablett', substans: 'Losartan', atc: 'C09CA01', vagar: ['ORAL'], godkand: '2009-10-23' },
  '20090220000113': { namn: 'Losartan Krka', styrka: '100 mg', form: 'Filmdragerad tablett', substans: 'Losartan', atc: 'C09CA01', vagar: ['ORAL'], godkand: '2009-10-23' },
  '20060518000040': { namn: 'Amlodipin Krka', styrka: '10 mg', form: 'Tablett', substans: 'Amlodipin', atc: 'C08CA01', vagar: ['ORAL'], godkand: '2006-12-15' },
  '20070404000047': { namn: 'Atorvastatin Krka', styrka: '10 mg', form: 'Filmdragerad tablett', substans: 'Atorvastatin', atc: 'C10AA05', vagar: ['ORAL'], godkand: '2008-08-29' },
  '20070404000054': { namn: 'Atorvastatin Krka', styrka: '20 mg', form: 'Filmdragerad tablett', substans: 'Atorvastatin', atc: 'C10AA05', vagar: ['ORAL'], godkand: '2008-08-29' },
  '20041018000297': { namn: 'Simvastatin Krka', styrka: '10 mg', form: 'Filmdragerad tablett', substans: 'Simvastatin', atc: 'C10AA01', vagar: ['ORAL'], godkand: '2005-04-14' },
  '20041018000310': { namn: 'Simvastatin Krka', styrka: '40 mg', form: 'Filmdragerad tablett', substans: 'Simvastatin', atc: 'C10AA01', vagar: ['ORAL'], godkand: '2005-04-14' },
  '20130409000111': { namn: 'Jardiance', styrka: '25 mg', form: 'Filmdragerad tablett', substans: 'Empagliflozin', atc: 'A10BK03', vagar: ['ORAL'], godkand: '2014-05-22' },
  '19740301000047': { namn: 'Levaxin', styrka: '50 mikrogram', form: 'Tablett', substans: 'Levotyroxin', atc: 'H03AA01', vagar: ['ORAL'], godkand: '1974-03-01' },
  '20000407000102': { namn: 'Levaxin', styrka: '25 mikrogram', form: 'Tablett', substans: 'Levotyroxin', atc: 'H03AA01', vagar: ['ORAL'], godkand: '2000-04-07' },
  '20090716000078': { namn: 'Omeprazol Sandoz', styrka: '40 mg', form: 'Enterokapsel, hård', substans: 'Omeprazol', atc: 'A02BC01', vagar: ['ORAL'], godkand: '2010-12-16' },
  '20060817000055': { namn: 'Ibuprofen Orifarm', styrka: '200 mg', form: 'Filmdragerad tablett', substans: 'Ibuprofen', atc: 'M01AE01', vagar: ['ORAL'], godkand: '2009-10-30' },
  '20060817000086': { namn: 'Ibuprofen Orifarm', styrka: '600 mg', form: 'Filmdragerad tablett', substans: 'Ibuprofen', atc: 'M01AE01', vagar: ['ORAL'], godkand: '2009-10-30' },
  '20040607002803': { namn: 'Naproxen Orifarm', styrka: '500 mg', form: 'Tablett', substans: 'Naproxen', atc: 'M01AE02', vagar: ['ORAL'], godkand: '2005-07-01' },
  '20111221000077': { namn: 'Oxikodon Actavis', styrka: '10 mg', form: 'Kapsel, hård', substans: 'Oxikodon', atc: 'N02AA05', vagar: ['ORAL'], godkand: '2013-01-10' },
  '20130410000032': { namn: 'Escitalopram Krka', styrka: '5 mg', form: 'Filmdragerad tablett', substans: 'Escitalopram', atc: 'N06AB10', vagar: ['ORAL'], godkand: '2014-03-28' },
  '20130410000063': { namn: 'Escitalopram Krka', styrka: '20 mg', form: 'Filmdragerad tablett', substans: 'Escitalopram', atc: 'N06AB10', vagar: ['ORAL'], godkand: '2014-03-28' },
  '20040916002952': { namn: 'Mirtazapin Krka', styrka: '30 mg', form: 'Filmdragerad tablett', substans: 'Mirtazapin', atc: 'N06AX11', vagar: ['ORAL'], godkand: '2005-04-08' },
  '20110113000058': { namn: 'Donepezil Krka', styrka: '10 mg', form: 'Filmdragerad tablett', substans: 'Donepezil', atc: 'N06DA02', vagar: ['ORAL'], godkand: '2011-11-03' },
  '19840309000053': { namn: 'Prednisolon Pfizer', styrka: '10 mg', form: 'Tablett', substans: 'Prednisolon', atc: 'H02AB06', vagar: ['ORAL'], godkand: '1984-03-09' },
  '20100501000012': { namn: 'Eliquis', styrka: '2,5 mg', form: 'Filmdragerad tablett', substans: 'Apixaban', atc: 'B01AF02', vagar: ['GAST', 'ORAL'], godkand: '2011-05-18' },
  '20101127000028': { namn: 'Xarelto', styrka: '15 mg', form: 'Filmdragerad tablett', substans: 'Rivaroxaban', atc: 'B01AF01', vagar: ['ORAL'], godkand: '2011-12-14' },
  '20071124000010': { namn: 'Xarelto', styrka: '10 mg', form: 'Filmdragerad tablett', substans: 'Rivaroxaban', atc: 'B01AF01', vagar: ['ORAL'], godkand: '2008-09-30' },
  '20150304000108': { namn: 'Brilique', styrka: '60 mg', form: 'Filmdragerad tablett', substans: 'Tikagrelor', atc: 'B01AC24', vagar: ['GAST', 'ORAL'], godkand: '2016-02-18' },
  '19891208000279': { namn: 'Trombyl', styrka: '160 mg', form: 'Tablett', substans: 'Acetylsalicylsyra', atc: 'B01AC06', vagar: ['ORAL'], godkand: '1989-12-08' },
  '20040607008683': { namn: 'Levaxin', styrka: '75 mikrogram', form: 'Tablett', substans: 'Levotyroxin', atc: 'H03AA01', vagar: ['ORAL'], godkand: '2005-09-16' },
  '20151002000087': { namn: 'Metformin Sandoz', styrka: '1000 mg', form: 'Filmdragerad tablett', substans: 'Metformin', atc: 'A10BA02', vagar: ['ORAL'], godkand: '2017-09-29' },
  '20070919000037': { namn: 'Amoxicillin Sandoz', styrka: '500 mg', form: 'Filmdragerad tablett', substans: 'Amoxicillin', atc: 'J01CA04', vagar: ['ORAL'], godkand: '2009-12-11' },
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
  // eGFR (runda 6, r1): NPU har ingen kod för skattat GFR (NPU28811 anger inte att värdet är skattat ur kreatinin), så
  // eGFR har LOINC. Demons laboratorium räknar eGFR ur P-kreatinin med CKD-EPI 2021 (skalor.js, ckdEpi2021), och det är
  // precis vad 98979-8 anger. Kontrollerat mot LOINC 2.83 via tx.fhir.org 2026-11-03, se docs/kodkontroll.md.
  egfr: { kategori: 'laboratory', coding: [{ system: SYSTEM.loinc, code: '98979-8', display: 'Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI 2021)/1.73 sq M' }], ucum: 'mL/min/{1.73_m2}' },
  kreatinin: npu('NPU18016', 'umol/L'), // P, Creatininium; subst.c. = ? µmol/L
  hba1c: npu('NPU27300', 'mmol/mol'), // Haemoglobin beta chain(B), N-(1-deoxyfructos-1-yl)haemoglobin beta chain; subst.fr. = ? mmol/mol
  inr: npu('NPU01685', '{INR}'), // P, Coagulation, tissue factor-induced; rel.time(actual/norm;INR;IRP 67/40;proc.) = ?
  ntprobnp: npu('NPU21571', 'ng/L'), // P, Pro-brain natriuretic peptide(1-76); mass c. = ? ng/L
  hb: npu('NPU28309', 'g/L'), // B, Haemoglobin; mass c. = ? g/L
  glukos: npu('NPU02192', 'mmol/L'), // P, Glucose; subst.c. = ? mmol/L
  kalium: npu('NPU03230', 'mmol/L'), // P, Potassium ion; subst.c. = ? mmol/L
  troponin: npu('NPU27501', 'ng/L'), // P, Troponin T, cardiac muscle; mass c. = ? ng/L
  tsh: npu('NPU03577', 'm[IU]/L'), // P, Thyrotropin; arb.subst.c.(IRP 80/558;proc.) = ? × 10-3 IU/L
  // Runda 6, r1: medvetandegrad (ACVPU), syrgas, smärta (NRS) och GCS, kontrollerade mot LOINC 2.83 via tx.fhir.org
  // 2026-11-03. Medvetandegraden är ett kodat värde (varde: 'kod') med LOINC:s svarskoder, och GCS har sina tre delar.
  medvetande: { kategori: 'exam', coding: [{ system: SYSTEM.loinc, code: '67775-7', display: 'Level of responsiveness' }], ucum: null, varde: 'kod' },
  syrgas: { kategori: 'therapy', coding: [{ system: SYSTEM.loinc, code: '3151-8', display: 'Inhaled oxygen flow rate' }], ucum: 'L/min' },
  smarta: { kategori: 'survey', coding: [{ system: SYSTEM.loinc, code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating [Score] - Reported' }], ucum: '{score}' },
  gcs: { kategori: 'survey', coding: [{ system: SYSTEM.loinc, code: '9269-2', display: 'Glasgow coma score total' }], ucum: '{score}',
    komponenter: [{ del: 'e', code: '9267-6', display: 'Glasgow coma score eye opening' }, { del: 'v', code: '9270-0', display: 'Glasgow coma score verbal' }, { del: 'm', code: '9268-4', display: 'Glasgow coma score motor' }] },
  // Runda 7, r6: huvudomfång i barnhälsovården, med vitalparameterprofilen för huvudomfång. Kontrollerat mot LOINC via
  // tx.fhir.org 2026-11-08.
  huvudomfang: vp('9843-4', 'Head Occipital-frontal circumference', 'cm', 'headcircum'),
  // Runda 8, r1: svaren från det simulerade laboratoriet (beställning och svar, Sussa 4.4) och SR som intern analys på
  // avdelningen. Kontrollerade mot IFCC:s NPU-fil npu-codes-latest.csv (hämtad 2026-11-08, samma sha256 som 2026-11-03)
  // och enheterna mot UCUM via tx.fhir.org, se docs/kodkontroll.md.
  lpk: npu('NPU02593', '10*9/L'), // B, Leukocytes; num.c. = ? × 10⁹/L
  tpk: npu('NPU03568', '10*9/L'), // B, Thrombocytes; num.c. = ? × 10⁹/L
  natrium: npu('NPU03429', 'mmol/L'), // P, Sodium ion; subst.c. = ? mmol/L
  kobalamin: npu('NPU01700', 'pmol/L'), // P, Cobalamin; subst.c. = ? pmol/L
  folat: npu('NPU02070', 'nmol/L'), // P, Folate; subst.c. = ? nmol/L
  sr: npu('NPU03404', 'mm'), // B, Sedimentation reaction; length(proc.) = ? mm
};

// Svarskoderna för medvetandegraden. A, V, P och U finns i LOINC:s svarslista LL1845-8 för 67775-7. C, nytillkommen
// förvirring, har LOINC:s svarskod Confused, som inte ingår i den listan. Kontrollerat via tx.fhir.org 2026-11-03.
export const ACVPU_KOD = {
  A: { code: 'LA9340-6', display: 'Alert' }, C: { code: 'LA6560-2', display: 'Confused' }, V: { code: 'LA17108-4', display: 'Verbal' },
  P: { code: 'LA17107-6', display: 'Painful' }, U: { code: 'LA9343-0', display: 'Unresponsive' },
};

// NEWS2 räknas av systemet ur vitalparametrarna och lämnas ut som en härledd Observation. LOINC har ingen egen kod för
// NEWS2, så koden är den allmänna för en tidig varningspoäng (Early warning score), och texten säger NEWS2.
export const NEWS2_KOD = { system: SYSTEM.loinc, code: '115635-5', display: 'Early warning score EWS' };

// KVÅ, Klassifikation av vårdåtgärder 2026 (giltig från 2026-01-01, version 1.0 2025-10-24), titlarna ordagrant ur
// E-hälsomyndighetens fil kva-inkl-beskrivningstexter-2026.xlsx, hämtad 2026-11-03. Systemet sätter koden själv när
// åtgärden registreras, så ingen behöver välja den. OID:n står som aktiv för Klassifikation av vårdåtgärder (KVÅ) i
// Socialstyrelsens OID-serie (socialstyrelsens-oid-serie-2025-10-17.xlsx), se docs/kodkontroll.md.
SYSTEM.kva = 'urn:oid:1.2.752.116.1.3.2.1.4';
export const KVA = {
  QD008: 'Övervakning av vitala tecken',
  PA001: 'Bedömning av medvetandefunktioner',
  XV015: 'Läkemedelsgenomgång, enkel, enligt Socialstyrelsens föreskrift och allmänna råd',
  // Runda 8, r5: stöd vid tobaks- och nikotinbruk, som systemet föreslår ur mallen för tobaksvanor (tobak-regler.js).
  DV111: 'Enkla råd om tobaks- och nikotinbruk',
  DV112: 'Rådgivande samtal om tobaks- och nikotinbruk',
  DV113: 'Kvalificerat rådgivande samtal om tobaks- och nikotinbruk',
  // Runda 9, r3: operationerna i demon (operation.js), kontrollerade mot KVÅ 2026 (docs/kodkontroll.md).
  JKA21: 'Laparoskopisk kolecystektomi', JEA01: 'Laparoskopisk appendektomi', NFB49: 'Primär total höftledsplastik med cement',
  NGB49: 'Primär totalprotes i knäled med cement',
  // Runda 9, r7: stöd vid alkohol, fysisk aktivitet och matvanor (levnadsvanor-regler.js), och skötseln av in- och
  // utfarter (infarter.js), ordagrant ur samma fil.
  DV121: 'Enkla råd om alkoholvanor',
  DV122: 'Rådgivande samtal om alkoholvanor',
  DV123: 'Kvalificerat rådgivande samtal om alkoholvanor',
  DV131: 'Enkla råd om fysisk aktivitet',
  DV132: 'Rådgivande samtal om fysisk aktivitet',
  DV133: 'Kvalificerat rådgivande samtal om fysisk aktivitet',
  DV141: 'Enkla råd om matvanor',
  DV142: 'Rådgivande samtal om matvanor',
  DV143: 'Kvalificerat rådgivande samtal om matvanor',
  DV200: 'Utfärdande av recept på fysisk aktivitet (FaR)',
  QD004: 'Skötsel av central venkateter',
  QD005: 'Skötsel av perifer venkateter',
  DK028: 'Skötsel av urinkateter',
  DV150: 'Skötsel av dränage',
  DV065: 'Sondmatning',
};

// Runda 7, r6: koderna för Svenska barnhälsovårdsregistret ordagrant ur bilaga K11 till Sussas förfrågningsunderlag,
// Informationsspecifikation Svenska barnhälsovårdsregistret, Formulär Bedömningar, version 1.7 (2017-04-11). Snomed CT
// i svensk version. Koderna är inte kontrollerade mot den gällande utgåvan av Snomed CT, som kräver licens (se
// docs/kodkontroll.md). OID:n står i bilagans sammanställning av kodverk.
export const K11 = {
  oid: {
    snomed: '1.2.752.116.2.1.1', personnummer: '1.2.752.129.2.1.3.1', atc: '1.2.752.129.2.2.3.1.1', kvalitetsregister: '1.2.752.129.2.2.3.23',
    kontakttyp: '1.2.752.129.2.2.2.25', befattning: '1.2.752.129.2.2.1.4',
  },
  // Tillväxt: Observation. format är registrets format (N är en siffra).
  tillvaxt: {
    fodelsevikt: { kod: '364589006', text: 'födelsevikt', enhet: 'kg', format: 'N,NNN', decimaler: 3, max: 9.999 },
    fodelselangd: { kod: '169886007', text: 'födelselängd', enhet: 'cm', format: 'NN,N', decimaler: 1, max: 99.9 },
    fodelse_huvudomfang: { kod: '169876006', text: 'huvudomfång vid födsel', enhet: 'cm', format: 'NN,N', decimaler: 1, max: 99.9 },
    graviditetslangd: { kod: '412726003', text: 'graviditetslängd vid födelse', enhet: 'veckor', format: 'NN', decimaler: 0, max: 99 },
    vikt: { kod: '27113001', text: 'kroppsvikt', enhet: 'kg', format: 'NNN,NNN', decimaler: 3, max: 999.999 },
    langd: { kod: '248334005', text: 'kroppslängd', enhet: 'cm', format: 'NNN,N', decimaler: 1, max: 999.9 },
    huvudomfang: { kod: '363812007', text: 'huvudomfång', enhet: 'cm', format: 'NN,N', decimaler: 1, max: 99.9 },
    langd_mor: { kod: '53851000052106', text: 'längd hos biologisk mor', enhet: 'cm', format: 'NNN', decimaler: 0, max: 999 },
    langd_far: { kod: '53861000052109', text: 'längd hos biologisk far', enhet: 'cm', format: 'NNN', decimaler: 0, max: 999 },
  },
  // Besök: Vårdkontakt, kontakttyp ur V-TIM 2.2.
  besok: { mottagning: { kod: '2', text: 'öppenvårdsbesök' }, hem: { kod: '3', text: 'hembesök' } },
  // Mottagningsbesök: Hälso- och sjukvårdspersonal, befattning ur KV_befattning.
  befattning: {
    sjukskoterska: { kod: '206018', text: 'Sjuksköterska, barn och ungdom' }, barnlakare: { kod: '201010', text: 'överläkare' },
    allmanlakare: { kod: '201011', text: 'Distriktsläkare/Specialist allmänmedicin' },
  },
  // Vaccination: Observation. Registret tar emot ökad risk för tuberkulos och BCG-vaccination.
  vaccination: {
    risk: { typ: { kod: '80943009', text: 'riskfaktor' }, varde: { kod: '707085002', text: 'Hög risk för tuberkulos' } },
    bcg: { typ: { kod: '408864009', text: 'vaccinationsstatus' }, varde: { kod: '473170005', text: 'anamnes på BCG-vaccination' } },
  },
};

// Runda 9, r4: Snomed CT, begreppssystemet i Nationellt fackspråk. Delmängden som Vårdkällan använder och kontrollen av
// koderna finns i fackssprak.js, och förvaltningen av kodverkens utgåvor över tid i kodverksforvaltning.js.
SYSTEM.snomed = 'http://snomed.info/sct';
