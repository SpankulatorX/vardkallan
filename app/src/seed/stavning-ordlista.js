// Runda 10, r3: Vårdkällans medicinska ordlista för rättstavningen (../stavning.js), version 1 (2026-11-08). Termerna står i
// grundform, och stavningskontrollen känner själv igen de vanliga böjningarna och sammansättningarna. Listan kompletteras
// av termerna i kodverken (ICD-10-SE och KVÅ), läkemedelskatalogen, mätvärdena och sökorden, som läses in när
// ordlistan byggs. VANLIGA är ord i allmän svenska som ligger nära en medicinsk term och annars skulle markeras. Den
// allmänna svenska stavningen sköter webbläsarens egen kontroll, som fälten har på med språket svenska.

export const VERSION = { version: '1', datum: '2026-11-08' };

export const MEDICINSKA = `
abdomen abscess acidos adrenalin afasi agitation akut albumin alkalos allergi alveolit amputation analgetika anamnes anemi aneurysm
angina angiografi ankelödem anorexi antibiotika antibiotikum antikoagulantia antikoagulation anuri aorta aortastenos apati appendicit
arrytmi arteriell arterioskleros artrit artros ascites astma ataxi ateroskleros atrofi auskultation autism
bakteriemi bakterie balans benign bensår biopsi blodgas blodsocker blodtryck blodtrycksmätning blodtransfusion blåsljud borrelia bradykardi bronkit
bronkoskopi buksmärta bukspottkörtel
celiaki cellulit cerebral cirkulation cirrhos cyanos cystit cystoskopi cytostatika
datortomografi defibrillering dehydrering delirium demens depression dermatit desaturation diabetes diagnos dialys diarré diastolisk
differentialdiagnos diures diuretika divertikulit dosering dysartri dysfagi dyspepsi dyspné dysuri
ekg ekokardiografi eksem elektrolyt embolism emfysem endokardit endoskopi enterit epikris epilepsi erytem erytrocyt esofagit
etiologi exacerbation exantem extremitet
fallbenägenhet fallrisk feber fibrillering fibros flimmer frakt fraktur förmaksflimmer förstoppning förvirring
gastrit gastroenterit gastroskopi glukos granulation granulering gikt glaukom
hematom hematuri hemiplegi hemoglobin hemorragi heparin hepatit hjärtinfarkt hjärtinsufficiens hjärtsvikt hosta hydrering hyperglykemi
hyperkalemi hypertoni hypertyreos hyperventilation hypoglykemi hypokalemi hyponatremi hypotension hypotermi hypotoni hypotyreos hypovolemi hypoxi
ikterus ileus immunosuppression infarkt infektion inflammation influensa infusion inhalation injektion insulin insufficiens intubation ischemi
kakexi kalium kapillär karcinom kardiomyopati kardiovaskulär kardioversion kateter kateterisering kolecystit kolit koloskopi koma kontraktur
konfusion kreatinin kramp kräkning kyfos
laparoskopi laparotomi leukocyt leukocytos leukemi lunga lungemboli lungödem lymfom lymfödem
makula malabsorption malign mammografi mastektomi melena meningit metastas migrän mikroorganism mobilisering mobilisera myokardit myom
natrium nefrit nefropati nekros neuropati njursvikt nutrition
obstipation ocklusion ordination ordinera ortopné osteoporos otit ödem
palliativ palpation palpitation pankreatit paralys parenteral pares parkinson patogen perifer peritonit pleurit pneumoni pneumothorax polyneuropati
polyuri postoperativ preoperativ prognos proteinuri protes pyelonefrit
radiologi recidiv rehabilitering reflux remiss respiration respiratorisk resistens retention rodnad röntgen
saturation sepsis sjukgymnastik skleros smärta spasticitet spirometri stenos stent stroke subkutan suturer sutur symptom symtom syncope synkope systolisk
takykardi takypné tromb trombocyt trombocytopeni trombos trycksår tumör tyreoidea
ulcus ulcerös ultraljud urinretention urinvägsinfektion urtikaria
vaskulit venös ventrikelflimmer ventrikel vertigo vätskebalans
yrsel
`.trim().split(/\s+/);

// Medicinska termer på engelska, för fält som skrivs på engelska.
export const ENGELSKA = `
abdomen abscess acute allergy anaemia anemia aneurysm angina antibiotic antibiotics anticoagulation arrhythmia arterial arthritis asthma atrial
bacteria biopsy blood bradycardia bronchitis cardiac cardiomyopathy catheter cellulitis cerebral chronic cirrhosis confusion constipation cyanosis
dehydration delirium dementia depression diabetes diagnosis dialysis diarrhoea diarrhea diastolic dyspnoea dyspnea edema embolism emphysema
fever fibrillation fracture gastritis glucose haemoglobin hemoglobin hypertension hypoglycaemia hypoglycemia hypotension hypoxia
infarction infection inflammation influenza injection insufficiency insulin ischaemia ischemia kidney lung malignant medication myocardial
nausea necrosis neuropathy oedema pain palpitations pneumonia potassium pressure pulmonary renal respiratory sepsis sodium stenosis stroke
suspected syncope systolic tachycardia thrombosis ulcer vomiting wound
`.trim().split(/\s+/);

// Allmänna ord som ligger nära en medicinsk term och inte ska markeras.
export const VANLIGA = `
och att det som en på är för med till av den inte om har de jag ett vi men så kan ska från han hon nu var vid sig sin sitt sina
eller också efter under över innan sedan inga ingen inget när där här hur vad vem vilken vilket vilka mycket lite mer mindre
patient patienten patientens patienter mår bra bättre sämre ont ont lätt svår svårt ganska väl
dag dagen dagar natt natten vecka veckan veckor månad månader år året tid tiden igår idag imorgon morgon kväll
ses igen kommer går gick gått får fick fått ges gavs tas togs tagits tar tog ger gav vill vet tror kanske nog
höger vänster vänstra högra framsida baksida arm armen ben benet benen fot foten händer hand handen huvud huvudet mage magen rygg ryggen
underben underbenen lår låret knä knät höft höften bröst bröstet hals halsen
lunga lungor lungorna hjärta hjärtat njure njurar lever blod blodet urin
feber smärta ont trött tröt yr illamående kräks hostar
lindrig måttlig kraftig normal normalt opåverkad påverkad stabil oförändrad förbättrad försämrad
misstänkt misstanke bedöms bedömning åtgärd planering uppföljning kontroll kontroller kontakt kontaktar
remitteras remitterad remiss återbesök besök hem hemma avdelning avdelningen mottagning
vikt längd puls temperatur andning
`.trim().split(/\s+/);

// Förklaringarna när texten är på engelska.
export const ENGELSKA_TEXTER = {
  stor: 'A new sentence starts with a capital letter.',
  mellanslag: 'A space is needed after the punctuation mark.',
  term: (forslag) => `The word looks like a medical term but is not in the word list. Did you mean ${forslag}?`,
};

export const ENGELSKA_VANLIGA = `
the a an and or of in on at to for with without from by is are was were be been has have had not no yes this that these those
patient patients suspected possible likely known history left right with since day days week weeks today yesterday
`.trim().split(/\s+/);
