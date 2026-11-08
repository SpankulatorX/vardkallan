// Testpatienterna i Sussas användbarhetstester (Bilaga F1:3 tabell 1 och Bilaga F1:4), runda 7, r1. Namnen är Sussas,
// som själva är påhittade. Personnumren är Skatteverkets testpersonnummer (research/testpersonnummer.json). Inget av dem
// har samma födelsedatum som i Sussas testdata, så varje patient har fått ett testpersonnummer med samma kön och ett
// födelsedatum så nära Sussas som möjligt, och Sussas födelsedatum står med i fodd_sussa.
//
// Patienterna och den data testfallen behöver läggs in i sandlådan av sussa-demo.js (POST /api/demo/sussa-testfall),
// inte i seeden, så att resten av demon ser ut som förut. Id börjar med sus, så att de inte krockar med seedens.

export const SUSSA_PATIENTER = [
  { id: 'sus01', fornamn: 'Bertil', efternamn: 'Danielsson', pnr: '194502073416', foddSussa: '1944-06-20' },
  { id: 'sus02', fornamn: 'Gerda', efternamn: 'Ström', pnr: '196503184589', foddSussa: '1958-08-13' },
  { id: 'sus03', fornamn: 'Elin', efternamn: 'Arnström', pnr: '196506232880', foddSussa: '1958-08-20' },
  { id: 'sus04', fornamn: 'Trevis', efternamn: 'Ljung', pnr: '198909162391', foddSussa: '1990-01-01' },
  { id: 'sus05', fornamn: 'Berit', efternamn: 'Strandhall', pnr: '194502198429', foddSussa: '1940-05-27' },
  { id: 'sus06', fornamn: 'Sara', efternamn: 'Sandmark', pnr: '194503135883', foddSussa: '1939-05-20' },
  { id: 'sus07', fornamn: 'Anna', efternamn: 'Karlsson', pnr: '196604072667', foddSussa: '1967-12-12' },
  { id: 'sus08', fornamn: 'Henrik', efternamn: 'Lundin', pnr: '199901032392', foddSussa: '2000-01-05' },
  { id: 'sus09', fornamn: 'Hanna', efternamn: 'Korlen', pnr: '200610232381', foddSussa: '2007-04-06' },
  { id: 'sus10', fornamn: 'Sven', efternamn: 'Markström', pnr: '199901022393', foddSussa: '1999-10-12' },
  { id: 'sus11', fornamn: 'Helene', efternamn: 'Lund', pnr: '200104192380', foddSussa: '2001-01-10' },
  { id: 'sus12', fornamn: 'Anton', efternamn: 'Ekrot', pnr: '199412212392', foddSussa: '1995-06-02' },
  { id: 'sus13', fornamn: 'Susanne', efternamn: 'Svedin', pnr: '197701192382', foddSussa: '1975-12-11' },
  { id: 'sus14', fornamn: 'Inga', efternamn: 'Strand', pnr: '198108222384', foddSussa: '1981-01-05' },
  { id: 'sus15', fornamn: 'Ahmed', efternamn: 'Mohammad', pnr: '199308062398', foddSussa: '1993-02-20' },
  { id: 'sus16', fornamn: 'Fatima', efternamn: 'Baskar', pnr: '198508122382', foddSussa: '1985-03-18' },
  { id: 'sus17', fornamn: 'Mira', efternamn: 'Axelsson', pnr: '196507233721', foddSussa: '1956-01-31' },
  { id: 'sus18', fornamn: 'Laura', efternamn: 'August', pnr: '197805222382', foddSussa: '1977-12-01' },
  { id: 'sus19', fornamn: 'Hamid', efternamn: 'Burvall', pnr: '196601142976', foddSussa: '1966-01-18' },
  { id: 'sus20', fornamn: 'Jonas', efternamn: 'Brun', pnr: '194606233411', foddSussa: '1954-08-18' },
  { id: 'sus21', fornamn: 'Sofia', efternamn: 'Andersson', pnr: '197701202389', foddSussa: '1975-02-14' },
  { id: 'sus22', fornamn: 'Tomas', efternamn: 'Vik', pnr: '197910052393', foddSussa: '1979-11-11' },
  { id: 'sus23', fornamn: 'Einar', efternamn: 'Sten', pnr: '194502202395', foddSussa: '1937-09-11' },
  { id: 'sus24', fornamn: 'Anna', efternamn: 'Berg', pnr: '200105032387', foddSussa: '2001-11-21' },
  { id: 'sus25', fornamn: 'Fabian', efternamn: 'Ström', pnr: '196604072618', foddSussa: '1967-10-30' },
  { id: 'sus26', fornamn: 'Marianne', efternamn: 'Hägg', pnr: '196509273386', foddSussa: '1957-08-05' },
];

// Provsvaren för PK (INR) för Bertil Danielsson (Bilaga F1:3 tabell 10). Sussas provtagningar var i oktober 2017. Här
// ligger de i dagar före testet, med samma klockslag och värden. Vårdenheten för Sussas ortopedmottagning är
// Ortopediska kliniken USÖ och för vårdcentralen Vårdcentralen Tybble. Testfall 3.4 söker provet med 0,9.
export const BERTIL_PK = [
  { dag: -7, klocka: '11:00', enhet: 'uso-ort', varde: 1.1 },
  { dag: -6, klocka: '13:10', enhet: 'uso-ort', varde: 1.0 },
  { dag: -5, klocka: '11:36', enhet: 'vc-tybble', varde: 0.9 },
  { dag: -2, klocka: '13:36', enhet: 'vc-tybble', varde: 1.2 },
  { dag: -2, klocka: '17:04', enhet: 'uso-ort', varde: 1.1 },
];
export const PK_SVAR = { dag: -5, klocka: '11:36', varde: 0.9 };

// Epikrisen från Bertil Danielssons tidigare vårdtillfälle (Bilaga F1:3 tabell 16 och testfall 6.3), med de datum som
// Sussa rättade 2018-03-07.
export const BERTIL_EPIKRIS = {
  inskriven: '2016-03-22', utskriven: '2016-03-26',
  sokord: {
    'Orsak till vård': 'Sepsis. Inkom med feber och frossa.',
    'Förlopp': 'Infektionsparametrar visade kraftig infektion och vidare utredning visade sepsis. Behandlad med antibiotika intravenöst och därefter per os. Avsevärt förbättrad.',
    'Läkemedelsförändringar': 'Antibiotika per os i sju dagar.',
    'Uppföljning': 'Återgår till hemmet. Återbesök om tre veckor.',
  },
};

// Texterna i testfall 4.3 (Bilaga F1:4), som användaren skriver in.
export const ANNA_EPIKRIS = {
  orsak: 'Sepsis, A41.9',
  forlopp: 'Inkom med feber och frossa. Infektionsparametrar visar på kraftig infektion, vidare utredning visade sepsis. Behandlad med antibiotika intravenöst initialt, nu per os. Bedömning: Sepsis. Avsevärt förbättrad efter påbörjad antibiotikabehandling.',
  uppfoljning: 'Får återgå till hemmet. Planeras till ett återbesök om 3 veckor.',
};

// Runda 8, r5: kommentaren i Berit Strandhalls tobaksvanor (testfall 4.1, Bilaga F1:4).
export const BERIT_TOBAK = { antal: 25, kommentar: 'Hon röker endast varannan vecka, när hennes barn är hos sin pappa.' };

// Remissvaret i testfall 2.6 och remissen i testfall 2.1 (Bilaga F1:4).
export const SVAR_2_6 = 'Tack för remissen. Vi har träffat Sara och gett henne rätt behandling.';
export const REMISS_2_1 = {
  fragestallning: 'Hudförändring, malignt?',
  anamnes: 'Pat har en hudförändring på låret som har förändrats snabbt. Är det malignt?',
};

// De fem patienter som har kommit till läkarens mottagning i dag i testfall 5.6 (Bilaga F1:4, rätt svar för läkaren).
export const ANKOMNA_5_6 = ['sus22', 'sus06', 'sus23', 'sus12', 'sus19'];

// Testfall 4.4: 30 osignerade anteckningar för läkaren i öppenvården, tio för var och en av de tre patienterna
// (Bilaga F1:3 tabell 14).
export const OSIGNERADE_4_4 = { patienter: ['sus08', 'sus09', 'sus10'], perPatient: 10 };

// Runda 8, r2: de tio remisserna till Medicinkliniken, Mottagning 1, i testfall 2.3 och 2.4 (Bilaga F1:4). Sussa
// anger patienterna men inte remissernas innehåll, så frågeställningarna är påhittade.
export const REMISSER_2_3 = [
  { patient: 'sus05', fragestallning: 'Bröstsmärtor vid ansträngning. Bedömning?', anamnes: 'Kvinna med tryck över bröstet vid promenader sedan en månad.', prioritet: 'skyndsam' },
  { patient: 'sus02', fragestallning: 'Hjärtklappning. Bedömning och eventuell utredning?', anamnes: 'Episoder med hjärtklappning några gånger i veckan.' },
  { patient: 'sus03', fragestallning: 'Trötthet och lätt andfåddhet. Hjärtsjukdom?', anamnes: 'Ingen utredning i primärvården än.' },
  { patient: 'sus04', fragestallning: 'Konsultation: oro och sömnsvårigheter, hjärtklappning vid oro.', anamnes: 'Normalt EKG. Besvären verkar höra till det psykiska.' },
  { patient: 'sus01', fragestallning: 'Tilltagande bensvullnad. Hjärtsvikt?', anamnes: 'Man med ökande ödem och andfåddhet nattetid.', prioritet: 'skyndsam' },
  { patient: 'sus06', fragestallning: 'Blåsljud. Ekokardiografi?', anamnes: 'Nyupptäckt blåsljud vid hälsokontroll.' },
  { patient: 'sus07', fragestallning: 'Förmaksflimmer. Ställningstagande till elkonvertering?', anamnes: 'Förmaksflimmer sedan två månader, antikoagulerad.' },
  { patient: 'sus10', fragestallning: 'Svimning vid träning. Bedömning?', anamnes: 'Ung man som svimmade under fotbollsträning.' },
  { patient: 'sus19', fragestallning: 'Högt blodtryck trots tre läkemedel.', anamnes: 'Blodtryck omkring 160/100 trots behandling.' },
  { patient: 'sus18', fragestallning: 'Kontroll efter hjärtinfarkt för fem år sedan.', anamnes: 'Besvärsfri. Önskar kontroll.' },
];

// Runda 8, r2: pappersremissen i testfall 2.5 (Bilaga F1:4), redan inskannad. Avsändaren och texterna är Sussas.
export const SKANNAD_2_5 = {
  namn: 'Pappersremiss från Behandlingshemmet Löparen.pdf',
  rader: ['Remiss (pappersremiss, inskannad)', 'Påhittad remiss ur Sussas testdata.', 'Patient: Trevis Ljung', 'Remissdatum: 2017-12-07', 'Från: Behandlingshemmet Löparen',
    'Frågeställning: Psykossjukdom', 'Anamnes: Har bott här två år. Behandlingen har varit framgångsrik. Nu flyttar han hem och behöver följas upp.'],
  remiss: { patient: 'sus04', remissdatum: '2017-12-07', enhet: 'Behandlingshemmet Löparen', fragestallning: 'Psykossjukdom', anamnes: 'Har bott här två år. Behandlingen har varit framgångsrik. Nu flyttar han hem och behöver följas upp.' },
};

// Runda 8, r2: remissen på uppdrag i testfall 2.2 (Bilaga F1:4): samma texter som 2.1 och ortopedkliniken som mottagare.
export const UPPDRAG_2_2 = { tillEnhetId: 'uso-ort', uppdragsgivare: 'lak-kard' };

// Runda 8, r2: svarstexten när Elin Arnströms remiss avvisas och motiveringen när Trevis Ljungs remiss skickas vidare
// (testfall 2.3, Bilaga F1:4).
export const AVVISNING_2_3 = 'Tack för remissen. I första hand bör en initial utredning göras på primärvårdsnivå. Följ behandlingslinje som finns på intranätet.';
export const VIDAREBEFORDRAN_2_3 = 'Begäran om konsultation gäller psykiatrin.';
// Runda 8, r1: testfall 3.3 (Bilaga F1:4). Beställningen som läkaren gjorde dagen före testet, med Sussas fyra analyser,
// att ta på morgonen. Läkaren i Sussas testdata spelas av läkaren på kardiologen.
export const TREVIS_3_3 = { av: 'lak-kard', analyser: ['blodstatus', 'b12', 'folat', 'urinodling'], anamnes: 'Trötthet och sveda vid miktion.', klocka: '07:30' };
// Testfall 3.4: provsvaren från vårdcentralen är beställda av läkaren där, som spelar Sussas beställande läkare.
export const BERTIL_PK_BESTALLD_AV = 'lak-vc';
// Testfall 3.5: kontrollerna i morgon klockan 7 (Bilaga F1:4).
export const INGA_3_5 = { kontroller: ['puls', 'blodtryck', 'sr', 'temp', 'vikt', 'vatskebalans'] };

// Runda 8, r3: testfall 5.1 till 5.3 (Bilaga F1:3 tabell 15 och Bilaga F1:4). Patienterna har varit på mottagningen
// förut, hos läkaren och för Sven Markström också hos sjuksköterskan, så att systemet föreslår samma vårdgivare igen.
// Mottagningen motsvarar Vårdcentral Backen, Mottagning 1. Adresserna är påhittade och bara för demon.
export const TIDIGARE_BESOK_5 = [
  { patient: 'sus11', hos: ['lak-kard'] },
  { patient: 'sus10', hos: ['lak-kard', 'ssk-kardmott'] },
  { patient: 'sus08', hos: ['lak-kard'] },
  { patient: 'sus09', hos: ['lak-kard'] },
  { patient: 'sus12', hos: ['lak-kard'] },
];
// Gruppträffen i testfall 5.3: fysioterapeuten på mottagningen leder den, 60 minuter, åtta platser, klockan 11.45.
export const GRUPP_5_3 = { schema: 'sch-kard-jenny', personal: 'fys-kard', enhet: 'uso-kard-mott', rubrik: 'Hjärtrehabilitering i grupp', dag: 3, klocka: '11:45', minuter: 60, platser: 8,
  patienter: ['sus10', 'sus08', 'sus09', 'sus12', 'sus11'] };

// Runda 8, r3: tema 7, gemensamma vyer (Bilaga F1:3 tabell 17). De planerade händelserna på Medicinkliniken, Avdelning A,
// som här är Avdelning 72. dag är dagar från testet, klocka svensk tid. ansvarig är den personal som Sussa namnger: den
// slutenvårdsläkare som Sussa nämner motsvaras av överläkaren på kardiologen (ol-kard). Rader där Sussa bara anger
// yrkesroller får ingen namngiven ansvarig, och systemet tar yrkesrollen ur uppgiften.
export const INSKRIVNA_7 = [
  { patient: 'sus02', plats: 'Avd 72, sal 9', orsak: 'Utredning inför röntgen' },
  { patient: 'sus05', plats: 'Avd 72, sal 10', orsak: 'Utredning' },
  { patient: 'sus08', plats: 'Avd 72, sal 11', orsak: 'Bröstsmärta' },
  { patient: 'sus14', plats: 'Avd 72, sal 12', orsak: 'Feber och infektion' },
];
export const RESURS_7_4 = 'ol-kard';
const A = RESURS_7_4;
export const HANDELSER_7 = [
  { patient: 'sus01', text: 'Temperatur, puls, blodtryck', dag: -4, klocka: '07:00' },
  { patient: 'sus01', text: 'EKG', dag: 0, klocka: '15:00' },
  { patient: 'sus01', text: 'Kontroll b-glukos', dag: -4, klocka: '11:30' },
  { patient: 'sus01', text: 'Längd, vikt', dag: -3, klocka: '08:00' },
  { patient: 'sus01', text: 'Sutur ut', dag: -3, klocka: '13:00' },
  { patient: 'sus01', text: 'Omläggning', dag: -3, klocka: '08:00' },
  { patient: 'sus01', text: 'Deltagande i distansmöte med anhöriga', dag: -3, klocka: '10:00', ansvarig: A },
  { patient: 'sus01', text: 'Teamrond', dag: -2, klocka: '11:00' },
  { patient: 'sus01', text: 'Till röntgen', dag: -2, klocka: '14:00' },
  { patient: 'sus01', text: 'Kontroll blodsocker. Inspektion hudkostym', dag: -1, klocka: '07:30' },
  { patient: 'sus01', text: 'Provtagning, blodprover', dag: 0, klocka: '11:00' },
  { patient: 'sus01', text: 'Ultraljud, urinblåsa', dag: 0, klocka: '17:00' },
  { patient: 'sus01', text: 'Omläggning', dag: 0, klocka: '14:00' },
  { patient: 'sus01', text: 'Temperatur, puls, blodtryck', dag: 0, klocka: '13:00' },
  { patient: 'sus01', text: 'Distansmöte, ortopedkonsult på annat sjukhus', dag: 0, klocka: '17:00', ansvarig: A },
  { patient: 'sus02', text: 'Dricka kontrast', dag: 0, klocka: '11:00' },
  { patient: 'sus02', text: 'Till röntgen, labb 12', dag: -3, klocka: '12:00' },
  { patient: 'sus02', text: 'Sjukgymnastik', dag: -2, klocka: '12:00' },
  { patient: 'sus03', text: 'Börja fasta', dag: 0, klocka: '11:00' },
  { patient: 'sus03', text: 'Till röntgen, labb 3', dag: -1, klocka: '14:00' },
  { patient: 'sus03', text: 'Provtagning, elstatus med mera', dag: -1, klocka: '16:00' },
  { patient: 'sus04', text: 'Såromläggning', dag: 0, klocka: '11:00' },
  { patient: 'sus04', text: 'Sjukgymnastik', dag: -1, klocka: '16:00' },
  { patient: 'sus04', text: 'Hjärteko på fysiologen', dag: 0, klocka: '15:00' },
  { patient: 'sus05', text: 'Teamrond med onkologen', dag: 0, klocka: '11:00', ansvarig: A },
  { patient: 'sus05', text: 'Omläggning CVK', dag: -1, klocka: '14:00' },
  { patient: 'sus05', text: 'Samtal med läkaren', dag: 0, klocka: '14:00', ansvarig: A },
  { patient: 'sus08', text: 'Provtagning', dag: -3, klocka: '14:00' },
  { patient: 'sus08', text: 'EKG', dag: -2, klocka: '09:00' },
  { patient: 'sus08', text: 'Sjukgymnastik', dag: 0, klocka: '11:00' },
  { patient: 'sus08', text: 'Provtagning', dag: -1, klocka: '15:00' },
  { patient: 'sus08', text: 'Provtagning', dag: 0, klocka: '15:00' },
  { patient: 'sus14', text: 'Infektionskonsult med infektionsläkaren', dag: 0, klocka: '11:00', ansvarig: A },
  { patient: 'sus14', text: 'Sjukgymnastik', dag: 0, klocka: '16:00' },
  { patient: 'sus14', text: 'Teamrond med kirurgläkaren', dag: 0, klocka: '09:00', ansvarig: A },
  { patient: 'sus14', text: 'Slangbyte CVK', dag: 0, klocka: '12:00' },
  { patient: 'sus14', text: 'Anhöriga vill prata med läkaren', dag: 0, klocka: '14:00', ansvarig: A },
  { patient: 'sus16', text: 'Vikt, blodtryck, puls, temperatur', dag: -2, klocka: '09:00' },
  { patient: 'sus16', text: 'Dricka kontrast', dag: -1, klocka: '12:00' },
  { patient: 'sus16', text: 'Samtal med läkaren', dag: 0, klocka: '12:00', ansvarig: A },
];
