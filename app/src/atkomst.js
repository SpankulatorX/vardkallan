// Behörighetsmotorn. prova() är en ren funktion av databasens innehåll och anropet: den ändrar inget
// och loggar inget. Servern anropar den i varje API- och FHIR-anrop och loggar utfallet.
import { Fel } from './db.js';
import { loggaRad } from './logg.js';
import { formatera, maskera } from './identitet.js';
// Runda 10, r1: systemkonton för externa tillämpningar utan inloggad person (systemkonton.js).
import * as systemkonton from './systemkonton.js';

// Minsta åtkomst per yrkesroll (D8, PDL 4 kap. 2 §).
export const ROLLER = {
  lakare: ['las_oversikt', 'las_journal', 'las_omvardnad', 'skriv_journal', 'skriv_omvardnad', 'las_lakemedel', 'ordinera',
    'las_matvarden', 'registrera_matvarde', 'las_diagnoser', 'las_remiss', 'remittera', 'mottag_remiss', 'bedom_remiss',
    'svara_remiss', 'kvittera_svar', 'las_admin', 'sok', 'vantrum', 'nodatkomst', 'andra_enheter', 'samtycke_sparr', 'visa_identitet',
    'registrera_patient', 'andra_identitet'],
  sjukskoterska: ['las_oversikt', 'las_journal', 'las_omvardnad', 'skriv_omvardnad', 'las_lakemedel', 'ge_lakemedel',
    'las_matvarden', 'registrera_matvarde', 'las_diagnoser', 'las_remiss', 'las_admin', 'sok', 'vantrum',
    'nodatkomst', 'andra_enheter', 'samtycke_sparr', 'visa_identitet', 'registrera_patient', 'andra_identitet'],
  underskoterska: ['las_oversikt', 'las_omvardnad', 'las_lakemedel', 'las_matvarden', 'registrera_matvarde', 'las_admin',
    'sok', 'vantrum', 'andra_enheter', 'samtycke_sparr', 'visa_identitet'],
  // Patientidentiteten (Sussa 3.1.1): läkare, sjuksköterskor och vårdadministratörer registrerar patienter och nya
  // identiteter. Att slå samman journaler bekräftas av en vårdadministratör.
  vardadministrator: ['las_admin', 'las_remiss_status', 'mottag_remiss', 'sok', 'vantrum', 'andra_enheter', 'visa_identitet',
    'registrera_patient', 'andra_identitet', 'sla_samman'],
  logggranskare: ['las_logg', 'sok'],
};
// Vårdkontakt, vårdtillfälle och hälsoärende (vardkontakt.js). Vårdadministratören registrerar vårdkontakter, läkare
// och sjuksköterskor skriver in, flyttar och skriver ut, och bekräftar hälsoärenden som systemet föreslår.
ROLLER.lakare.push('registrera_vardkontakt', 'vardtillfalle', 'halsoarende');
ROLLER.sjukskoterska.push('registrera_vardkontakt', 'vardtillfalle', 'halsoarende');
ROLLER.vardadministrator.push('registrera_vardkontakt');
// Utskrift, utlämnande och kontrasignering (Sussa 3.1.9 och 3.1.11.3, utskrift.js och kontrasignering.js). En utskrift
// innehåller bara det som rollen redan får se. Arkiv, gallring och radering (Sussa 5.4.2 och 5.3.1.7, arkiv.js) och
// datauttaget för uppföljning (Sussa 6.3.1, datauttag.js) har egna roller som inte läser journalen.
ROLLER.lakare.push('skriv_ut', 'utlamna', 'begara_kontrasignering', 'kontrasignera');
ROLLER.sjukskoterska.push('skriv_ut', 'utlamna', 'begara_kontrasignering');
ROLLER.underskoterska.push('skriv_ut');
ROLLER.vardadministrator.push('skriv_ut', 'utlamna');
ROLLER.arkivarie = ['registrera_arkivbeslut', 'arkivera', 'gallra'];
ROLLER.uppfoljning = ['datauttag'];
// Tidbok, väntelista, kallelser och incheckning (tidbok.js, Sussa 3.4.1 till 3.4.4). Vårdadministratören bokar, kallar,
// checkar in och hanterar väntelistan, med vårdrelation eller remiss till vårdenheten som grund.
ROLLER.vardadministrator.push('boka', 'kalla', 'checka_in', 'vantelista');
// Vem som får ge läkemedel (runda 5, Sussa 3.5.2.18). Läkaren ger med samma kontroller och loggning som
// sjuksköterskan. Undersköterskan ger bara med en giltig delegering (HSLF-FS 2017:37 9 kap.), som administrering.js
// prövar för varje dos med delegering.js. Delegeringen registreras av en sjuksköterska eller läkare på samma vårdenhet.
ROLLER.lakare.push('ge_lakemedel');
ROLLER.underskoterska.push('ge_lakemedel');
ROLLER.sjukskoterska.push('delegera');
// Läkare delegerar också (beslut 2026-11-03, HSLF-FS 2017:37 9 kap. 2 §), på samma villkor som sjuksköterskan.
ROLLER.lakare.push('delegera');
// Läkemedelsprocessen, del 2 (runda 6, r2). Läkaren fastställer generella direktiv och mallar med flera ordinationer
// (HSLF-FS 2017:37 6 kap. 6 §, Gröna häftet avsnitt 1.4.3), och sjuksköterskan ordinerar enligt ett direktiv och
// dokumenterar en muntlig ordination (6 kap. 7 och 15 §§). Läkaren och sjuksköterskan utvärderar behandlingen.
// Farmaceuten läser läkemedelslistan och mätvärdena och gör sin del av den fördjupade läkemedelsgenomgången, som
// läkaren ansvarar för (11 kap. 1 §). Farmaceuten läser inte journalanteckningar.
ROLLER.lakare.push('faststalla_direktiv', 'faststalla_mall', 'utvardera_lakemedel', 'lakemedelsgenomgang');
ROLLER.sjukskoterska.push('ordinera_direktiv', 'registrera_muntlig_ordination', 'utvardera_lakemedel');
ROLLER.farmaceut = ['las_oversikt', 'las_lakemedel', 'las_matvarden', 'las_diagnoser', 'las_admin', 'sok', 'andra_enheter', 'samtycke_sparr', 'visa_identitet', 'lakemedelsgenomgang'];

export const HANDLINGAR = {
  las_oversikt: 'läsa patientöversikten', las_journal: 'läsa journalanteckningar', las_omvardnad: 'läsa omvårdnadsanteckningar',
  skriv_journal: 'skriva journalanteckningar', skriv_omvardnad: 'skriva omvårdnadsanteckningar', las_lakemedel: 'läsa läkemedelslistan',
  ordinera: 'ordinera läkemedel', ge_lakemedel: 'ge läkemedel', las_matvarden: 'läsa mätvärden', registrera_matvarde: 'registrera mätvärden',
  las_diagnoser: 'läsa diagnoser', las_remiss: 'läsa remisser', las_remiss_status: 'se remissers status', remittera: 'skicka remisser',
  mottag_remiss: 'kvittera mottagna remisser', bedom_remiss: 'bedöma remisser', svara_remiss: 'svara på remisser',
  kvittera_svar: 'kvittera remissvar', las_admin: 'läsa administrativa uppgifter', sok: 'söka patienter', vantrum: 'se väntrummet',
  nodatkomst: 'använda nödåtkomst', andra_enheter: 'visa uppgifter från andra vårdenheter', samtycke_sparr: 'registrera samtycke till spärrade uppgifter',
  visa_identitet: 'visa skyddad identitet', las_logg: 'läsa åtkomstloggen',
  registrera_patient: 'registrera nya patienter', andra_identitet: 'registrera en ny identitet för en patient', sla_samman: 'slå samman journaler',
  registrera_vardkontakt: 'registrera vårdkontakter', vardtillfalle: 'skriva in, flytta och skriva ut patienter',
  halsoarende: 'bekräfta hälsoärenden',
  skriv_ut: 'skriva ut journalen', utlamna: 'registrera utlämnande och återlämnande av journalhandlingar',
  begara_kontrasignering: 'begära kontrasignering', kontrasignera: 'kontrasignera journalinformation',
  registrera_arkivbeslut: 'registrera beslut om arkivering, gallring och radering', arkivera: 'exportera till e-arkiv',
  gallra: 'gallra och radera efter beslut', datauttag: 'hämta datauttaget för uppföljning',
  boka: 'boka, boka om och avboka tider', kalla: 'skicka kallelser', checka_in: 'checka in patienter och ta betalt', vantelista: 'hantera väntelistan och bevakningar',
};

// Handlingar som inte rör en enskild patient.
const UTAN_PATIENT = new Set(['sok', 'vantrum', 'las_logg', 'registrera_patient', 'registrera_arkivbeslut', 'arkivera', 'gallra', 'datauttag']);
// Delegering av läkemedelshantering (runda 5) rör personalen, inte en patient.
HANDLINGAR.delegera = 'registrera och återkalla delegering av läkemedelshantering';
UTAN_PATIENT.add('delegera');
// Runda 6, r2: läkemedelsprocessen, del 2.
Object.assign(HANDLINGAR, {
  faststalla_direktiv: 'fastställa och upphäva generella direktiv', faststalla_mall: 'fastställa mallar med flera ordinationer',
  ordinera_direktiv: 'ordinera enligt generella direktiv', registrera_muntlig_ordination: 'dokumentera en muntlig ordination',
  utvardera_lakemedel: 'utvärdera läkemedelsbehandling', lakemedelsgenomgang: 'göra fördjupad läkemedelsgenomgång',
});
UTAN_PATIENT.add('faststalla_direktiv');
UTAN_PATIENT.add('faststalla_mall');
// Grunden för handlingar utan patient. Arkivarien handlar på ett registrerat beslut, som arkiv.js kontrollerar, och
// uppföljningsrollen på sitt uppdrag. Ingen av dem får läsa journalen.
const GRUND_UTAN_PATIENT = { logggranskare: 'logggranskning', arkivarie: 'arkivbeslut', uppfoljning: 'uppfoljning' };
const RELATION_DAGAR = 90;
// Runda 6, r3: vårdplaner (vardplan.js), psykiatrisk tvångsvård (tvangsvard.js), samordnad planering (samordnad.js) och
// ändringar i hälsoärenden (halsoarende.js). Läkare och sjuksköterskor upprättar och följer upp vårdplaner, och
// undersköterskan registrerar sina egna åtgärder. Bara läkare registrerar vårdintyg, beslut och tvångsåtgärder, och
// tvangsvard.js prövar dessutom vilken läkare lagen kräver. Kommunens personal (simulerad part) har ingen journalåtkomst
// alls: samordnad.js lämnar bara ut det som har skickats till kommunen i en samordnad planering.
HANDLINGAR.las_vardplan = 'läsa vårdplaner';
HANDLINGAR.vardplan = 'upprätta, ändra och följa upp vårdplaner';
HANDLINGAR.vardplan_atgard = 'registrera utförda åtgärder i vårdplaner';
HANDLINGAR.las_tvangsvard = 'läsa uppgifter om psykiatrisk tvångsvård';
HANDLINGAR.tvangsvard = 'registrera vårdintyg, beslut och tvångsåtgärder enligt LPT och LRV';
HANDLINGAR.samordna = 'upprätta samordnad individuell plan och samordnad planering vid utskrivning';
HANDLINGAR.samverkan = 'ta del av samordnad planering som kommunens part';
ROLLER.lakare.push('las_vardplan', 'vardplan', 'vardplan_atgard', 'las_tvangsvard', 'tvangsvard', 'samordna');
ROLLER.sjukskoterska.push('las_vardplan', 'vardplan', 'vardplan_atgard', 'las_tvangsvard', 'samordna');
ROLLER.underskoterska.push('las_vardplan', 'vardplan_atgard', 'las_tvangsvard');
ROLLER.kommun = ['samverkan'];
UTAN_PATIENT.add('samverkan');
GRUND_UTAN_PATIENT.kommun = 'samverkan';
// Runda 6, r6: ansvarsuppdrag för läkemedel (lakemedelsansvar.js) och godkännande av läkemedelsmallar
// (mallgodkannande.js). Verksamhetschefen utser uppdragen och fastställer generella direktiv, och läser inte journalen.
// Läkaren godkänner mallar och fastställer direktiv bara med ett gällande uppdrag, vilket modulerna prövar.
HANDLINGAR.lakemedelsansvar = 'utse och avsluta uppdrag i läkemedelshanteringen';
HANDLINGAR.godkanna_mall = 'godkänna läkemedelsmallar som mallansvarig läkare';
HANDLINGAR.faststalla_mall = 'upprätta och ändra läkemedelsmallar';
UTAN_PATIENT.add('lakemedelsansvar');
UTAN_PATIENT.add('godkanna_mall');
ROLLER.verksamhetschef = ['lakemedelsansvar', 'faststalla_direktiv'];
ROLLER.lakare.push('godkanna_mall');

// Runda 6, r4: planering och tidbok, del 2, och remiss, del 2. Läkare, sjuksköterskor och vårdadministratörer lägger
// upp egna bevakningar för en patient (bevaka, kräver vårdrelation) eller för vårdenheten (bevaka_enhet), läser
// tidboken (las_tidbok, läkare och sjuksköterskor utan att boka) och ser vårdenhetens statistik över väntetider och
// remisser utan personuppgifter (statistik). Uppföljningsrollen ser statistiken för regionen (statistik_region).
Object.assign(HANDLINGAR, {
  bevaka: 'lägga upp bevakningar för en patient', bevaka_enhet: 'lägga upp bevakningar för vårdenheten', las_tidbok: 'läsa tidboken',
  statistik: 'se vårdenhetens statistik utan personuppgifter', statistik_region: 'se regionens statistik utan personuppgifter',
});
for (const r of ['lakare', 'sjukskoterska', 'vardadministrator']) ROLLER[r].push('bevaka', 'bevaka_enhet', 'las_tidbok', 'statistik');
ROLLER.uppfoljning.push('statistik_region');
for (const h of ['bevaka_enhet', 'las_tidbok', 'statistik', 'statistik_region']) UTAN_PATIENT.add(h);

// Runda 7, r3: ekonomi (ekonomi.js, Sussa 7.1). Ekonomen exporterar faktureringsunderlag och ändrar prislistorna, och
// läser inte journalen. Läkare och sjuksköterskor ser kostnaderna i vårdprocessen, och vårdadministratören patientens
// avgifter och högkostnadsskydd i samma ruta. Läkaren registrerar medicinskt färdigbehandlad, läkare och sjuksköterskor
// lämnar ut hjälpmedel och vårdadministratören registrerar ett LMA-kort som patienten visar upp.
Object.assign(HANDLINGAR, {
  faktureringsunderlag: 'ta fram och exportera faktureringsunderlag', prislista: 'läsa och ändra prislistor',
  las_kostnader: 'se kostnaderna i vårdprocessen', fardigbehandlad: 'registrera att patienten är medicinskt färdigbehandlad',
  hjalpmedel: 'registrera utlämnade hjälpmedel', lma: 'registrera LMA-kort för asylsökande',
});
ROLLER.ekonom = ['faktureringsunderlag', 'prislista'];
for (const h of ['faktureringsunderlag', 'prislista']) UTAN_PATIENT.add(h);
GRUND_UTAN_PATIENT.ekonom = 'ekonomi';
ROLLER.lakare.push('las_kostnader', 'fardigbehandlad', 'hjalpmedel');
ROLLER.sjukskoterska.push('las_kostnader', 'hjalpmedel');
ROLLER.vardadministrator.push('las_kostnader', 'lma');
// Runda 7, r4: systemförvaltningen (systemforvaltning-rutter.js). Systemförvaltaren konfigurerar regler och parametrar,
// förbereder omorganisationer, beslutar om undantag från visning och publicering och följer upp lagringen. Ingen av
// handlingarna rör en enskild patient, och systemförvaltaren läser inte journalen.
Object.assign(HANDLINGAR, {
  konfigurera: 'föreslå och godkänna ändringar av regler och parametrar', omorganisera: 'förbereda omorganisationer',
  undanta: 'undanta uppgifter från visning och publicering', lagring: 'följa upp lagring, säkerhetskopiering och uttag per huvudman',
});
ROLLER.systemforvaltare = ['konfigurera', 'omorganisera', 'undanta', 'lagring'];
for (const h of ROLLER.systemforvaltare) UTAN_PATIENT.add(h);
// Runda 9, r6: systemförvaltaren registrerar tillämpningar och godkänner mottagare för det öppna API:t (api-forvaltning.js).
ROLLER.systemforvaltare.push('forvalta_api');
UTAN_PATIENT.add('forvalta_api');
// Efter en omorganisation kan patienten själv besluta att en spärr också ska gälla den nya vårdenheten. Vårdadministratören
// registrerar beslutet som en vanlig spärr (omorganisation.js, registreraSparr). Kräver vårdrelation.
HANDLINGAR.registrera_sparr = 'registrera en spärr som patienten själv har beslutat';
ROLLER.vardadministrator.push('registrera_sparr');
// Runda 7, r5: rapportering till myndigheter och register (myndighetsrapport.js). Uppföljningsrollen granskar och
// skickar rapporterna, som systemet sammanställer, och läser aldrig journalen. Läkaren registrerar en diagnos eller en
// yttre orsak på en vårdkontakt när en rapport saknar den, och vården registrerar att en patient motsätter sig
// registrering i ett kvalitetsregister (patientdatalagen 7 kap. 2 §).
Object.assign(HANDLINGAR, {
  myndighetsrapport: 'granska och skicka rapporter till myndigheter och register', registrera_diagnos: 'registrera diagnoser på en vårdkontakt',
  kvalitetsregister: 'registrera att patienten motsätter sig registrering i ett kvalitetsregister',
});
ROLLER.uppfoljning.push('myndighetsrapport');
UTAN_PATIENT.add('myndighetsrapport');
ROLLER.lakare.push('registrera_diagnos', 'kvalitetsregister');
ROLLER.sjukskoterska.push('kvalitetsregister');
// Runda 7, r2: övningar och intyg i utbildningsmiljön (utbildning.js, Sussa 10.1.1.5). All personal gör övningarna för
// sin yrkesroll, och verksamhetschefen ser intygen för sin vårdenhet. Inget av det rör en patient.
Object.assign(HANDLINGAR, { utbildning: 'göra övningar och få intyg', intyg_enhet: 'se intygen för vårdenheten' });
for (const r of Object.keys(ROLLER)) ROLLER[r].push('utbildning');
ROLLER.verksamhetschef.push('intyg_enhet');
UTAN_PATIENT.add('utbildning');
UTAN_PATIENT.add('intyg_enhet');
// Runda 7, r1: fysioterapeuten (paramedicinare i Sussas testfall) läser journalen och skriver i omvårdnadskategorin,
// registrerar mätvärden, skickar, tar emot, bedömer och besvarar remisser och läser tidboken (Bilaga F1:3 tabell 4).
// Inga läkemedel ordineras eller ges, och nödåtkomst finns inte.
ROLLER.fysioterapeut = ['las_oversikt', 'las_journal', 'las_omvardnad', 'skriv_omvardnad', 'las_lakemedel', 'las_matvarden', 'registrera_matvarde',
  'las_diagnoser', 'las_remiss', 'remittera', 'mottag_remiss', 'bedom_remiss', 'svara_remiss', 'kvittera_svar', 'las_admin', 'sok', 'andra_enheter',
  'samtycke_sparr', 'visa_identitet', 'skriv_ut', 'las_vardplan', 'vardplan_atgard', 'bevaka', 'bevaka_enhet', 'las_tidbok', 'statistik'];
// Rollen kom till efter utbildningens block ovan, så den får övningarna här (runda 7, r2: all personal gör övningarna).
ROLLER.fysioterapeut.push('utbildning');

// Runda 8, r3: avdelningens planerade händelser och en resurs planering (avdelningsplan.js). Läkare, sjuksköterskor,
// undersköterskor och fysioterapeuter ser vad som är planerat för patienterna och registrerar att en uppgift är utförd.
// Läkare, sjuksköterskor och fysioterapeuter planerar uppgifter. Varje patient prövas med vårdrelation, spärr och inre
// sekretess som all annan åtkomst.
Object.assign(HANDLINGAR, {
  las_planering: 'se planerade händelser på avdelningen', planera: 'planera uppgifter på avdelningen', utfora_uppgift: 'registrera att en planerad uppgift är utförd',
});
for (const r of ['lakare', 'sjukskoterska', 'underskoterska', 'fysioterapeut']) ROLLER[r].push('las_planering', 'utfora_uppgift');
for (const r of ['lakare', 'sjukskoterska', 'fysioterapeut']) ROLLER[r].push('planera');

// Runda 7, r1: testledaren för användartesterna är uppföljningsrollen, som läser och exporterar svaren utan patientuppgifter.
HANDLINGAR.anvandartest_las = 'läsa och exportera svaren från användartester';
ROLLER.uppfoljning.push('anvandartest_las');
UTAN_PATIENT.add('anvandartest_las');

// Runda 8, r2: remiss på uppdrag, fördelning, remisskonferens och extern pappersremiss (remiss-r8.js). Vårdadministratören
// skriver remisser på uppdrag av en läkare, som signerar dem, registrerar beslut som en läkare har fattat med läkaren
// som ansvarig och registrerar pappersremisser från vårdgivare utanför Vårdkällan. Läkare, fysioterapeuter och
// vårdadministratörer fördelar inkommande remisser till en läkare och sätter dem på remisskonferens. Registreringen av
// en pappersremiss är en handling med patient som loggas på patienten, men den ger ingen vårdrelation och ingen läsrätt:
// remiss-r8.js prövar den utan vårdrelation, och remissen ger vårdrelation först när någon annan än den som registrerade
// den har tagit emot den (beslut 2026-11-08).
Object.assign(HANDLINGAR, {
  remittera_pa_uppdrag: 'skriva remisser på uppdrag av en läkare', fordela_remiss: 'fördela remisser till en läkare för bedömning',
  remisskonferens: 'sätta remisser på remisskonferens', registrera_beslut_pa_uppdrag: 'registrera beslut om remisser på uppdrag av en läkare',
  registrera_extern_remiss: 'registrera remisser från vårdgivare utanför Vårdkällan',
});
ROLLER.vardadministrator.push('remittera_pa_uppdrag', 'fordela_remiss', 'remisskonferens', 'registrera_beslut_pa_uppdrag', 'registrera_extern_remiss');
ROLLER.lakare.push('fordela_remiss', 'remisskonferens');
ROLLER.fysioterapeut.push('fordela_remiss', 'remisskonferens');
// Runda 8, r1: beställning och svar (labb.js, Sussa 4.4) och kontroller till avdelningen (kontroller.js, Sussas testfall
// 3.5). Läkaren beställer prover, vidimerar svaren och ordinerar kontroller. Sjuksköterskan och undersköterskan
// beställer på uppdrag av en läkare, som signerar beställningen, och tar prover. Alla tre läser beställningarna och
// kontrollerna. Biomedicinsk analytiker har ingen egen roll i demon.
Object.assign(HANDLINGAR, {
  las_prover: 'läsa beställningar av prover och ordinerade kontroller', bestalla_prov: 'beställa prover',
  bestalla_prov_uppdrag: 'beställa prover på uppdrag av en läkare', ta_prov: 'registrera provtagning',
  vidimera_provsvar: 'vidimera provsvar', ordinera_kontroll: 'ordinera kontroller och mätvärden till avdelningen',
});
ROLLER.lakare.push('las_prover', 'bestalla_prov', 'ta_prov', 'vidimera_provsvar', 'ordinera_kontroll');
ROLLER.sjukskoterska.push('las_prover', 'bestalla_prov_uppdrag', 'ta_prov');
ROLLER.underskoterska.push('las_prover', 'bestalla_prov_uppdrag', 'ta_prov');
// Runda 9, r2: medicinteknisk utrustning, anestesi och intensivvård (medicinteknik.js och iva.js, Sussa 3.6.1 och 4.6).
// Läkare, sjuksköterskor och undersköterskor kopplar utrustning till patienten på den egna vårdenheten. Läkare och
// sjuksköterskor godkänner värden från utrustning och patientens egna mätningar för diagnostiskt bruk. Läkaren gör
// anestesibedömningen.
Object.assign(HANDLINGAR, {
  koppla_utrustning: 'koppla medicinteknisk utrustning till patienter',
  godkanna_matvarde: 'godkänna mätvärden från utrustning och patientens egna mätningar för diagnostiskt bruk',
  anestesibedomning: 'göra anestesibedömningar',
});
ROLLER.lakare.push('koppla_utrustning', 'godkanna_matvarde', 'anestesibedomning');
ROLLER.sjukskoterska.push('koppla_utrustning', 'godkanna_matvarde');
ROLLER.underskoterska.push('koppla_utrustning');

// Runda 9, r3: specialistområdena i Sussa kapitel 4. Operationsplanering (operation.js, Sussa 4.5): läkaren anmäler till
// operation, läkare och sjuksköterskor planerar sal, team och tid och registrerar förloppet och uppvakningen, och
// undersköterskan läser planeringen. Graviditet och förlossning (obstetrik.js, Sussa 4.7): läkare och sjuksköterskor
// (barnmorskan i demon) för graviditetsjournalen och förlossningsjournalen. Cytostatika (cytostatika.js, Sussa 4.8):
// läkaren ordinerar ur en behandlingsregim, och läkare och sjuksköterskor tar emot beredningen och ger kuren med
// dubbelkontroll. Bilder och media (bilder.js, Sussa 4.2) läses och skrivs med journalens handlingar, och blodprodukter
// (blod.js, Sussa 4.4.2.12) beställs och ges med provbeställningens och läkemedlens handlingar.
Object.assign(HANDLINGAR, {
  las_operation: 'läsa operationsanmälningar och operationsplaneringen', operation_anmala: 'anmäla patienter till operation',
  operation_planera: 'planera och stryka operationer', operation_registrera: 'registrera operationsförlopp och uppvakning',
  las_graviditet: 'läsa graviditetsjournalen och förlossningsjournalen', graviditet: 'föra graviditetsjournalen och förlossningsjournalen',
  las_cytostatika: 'läsa cytostatikabehandlingar', ordinera_cytostatika: 'ordinera cytostatika ur en behandlingsregim',
  ge_cytostatika: 'ta emot beredd cytostatika och ge den med dubbelkontroll',
});
ROLLER.lakare.push('las_operation', 'operation_anmala', 'operation_planera', 'operation_registrera', 'las_graviditet', 'graviditet', 'las_cytostatika', 'ordinera_cytostatika', 'ge_cytostatika');
ROLLER.sjukskoterska.push('las_operation', 'operation_planera', 'operation_registrera', 'las_graviditet', 'graviditet', 'las_cytostatika', 'ge_cytostatika');
ROLLER.underskoterska.push('las_operation');

// Runda 9, r1: förbrukningsartiklar (forbrukning.js, Sussa 3.5.4). Läkaren och sjuksköterskan förskriver artiklar för
// egenkontroll, tillförsel av läkemedel och stomi. I demon har alla sjuksköterskor förskrivningsrätt för förbrukningsartiklar, vilket är en
// demoregel: i verkligheten krävs förskrivningsrätt, till exempel som diabetes- eller stomisjuksköterska.
Object.assign(HANDLINGAR, { forskriva_forbrukning: 'förskriva förbrukningsartiklar' });
ROLLER.lakare.push('forskriva_forbrukning');
ROLLER.sjukskoterska.push('forskriva_forbrukning');
// Runda 9, r1: beställning av extempore och blodprodukter från de simulerade externa parterna (lakemedelsbestallning.js,
// Sussa 3.5.2.4). En licensansökan kräver ordinationsrätt.
Object.assign(HANDLINGAR, { bestalla_lakemedel: 'beställa extempore och blodprodukter' });
ROLLER.lakare.push('bestalla_lakemedel');
ROLLER.sjukskoterska.push('bestalla_lakemedel');

export const kanRoll = (personal, handling) => Boolean(ROLLER[personal?.yrke]?.includes(handling));

// Runda 7, r4: omorganisation (omorganisation.js, HSA:s regler för organisationsförändringar, bilaga K6). En vårdenhet
// som stängs vid en sammanslagning, delning eller nedläggning får en eller flera efterföljare inom samma vårdgivare.
// Bara vårdrelationen följer med till efterföljaren (harVardrelation), så att patienter som nyss har vårdats på den
// gamla enheten kan fortsätta vårdas. Uppgifterna stannar på den gamla vårdenheten och är för efterföljarens personal
// en annan vårdenhets uppgifter: de visas efter ett aktivt val, och en spärr mot den gamla enheten gäller som förut och
// kräver patientens samtycke. Föregångarens uppgifter blir aldrig fria för att man arbetar på efterföljaren. Raden läggs
// in först den dag förändringen gäller.
// Svaret sparas per databas tills nästa omorganisation genomförs (glomForegangare), eftersom prova() anropas för varje rad.
const foregangareCache = new WeakMap();
export const glomForegangare = (db) => foregangareCache.delete(db);
export function foregangare(db, vardenhet) {
  let c = foregangareCache.get(db);
  if (!c) { c = new Map(); foregangareCache.set(db, c); }
  if (!c.has(vardenhet)) c.set(vardenhet, raknaForegangare(db, vardenhet));
  return c.get(vardenhet);
}
function raknaForegangare(db, vardenhet) {
  const ut = new Set();
  let nya = [vardenhet];
  try {
    for (let i = 0; i < 6 && nya.length; i++) {
      const ph = nya.map(() => '?').join(', ');
      nya = db.query(`SELECT gammal_id FROM enhet_efterfoljare WHERE ny_id IN (${ph})`).all(...nya).map(r => r.gammal_id).filter(g => !ut.has(g) && g !== vardenhet);
      for (const g of nya) ut.add(g);
    }
  } catch { /* en sandlåda utan tabellen har inga omorganisationer */ }
  return ut;
}

// Den vårdenhet en enhet hör till. Inre sekretess gäller per vårdenhet.
export function vardenhetFor(db, enhetId) {
  let id = enhetId;
  for (let i = 0; i < 6 && id; i++) {
    const e = db.query('SELECT id, typ, forald_id FROM enheter WHERE id = ?').get(id);
    if (!e) return enhetId;
    if (e.typ !== 'arbetsplats') return e.id;
    id = e.forald_id;
  }
  return enhetId;
}

// Alla enheter som hör till en vårdenhet (vårdenheten och dess arbetsplatser).
export function enheterUnder(db, vardenhet) {
  const barn = db.query("SELECT id FROM enheter WHERE forald_id = ? AND typ = 'arbetsplats'").all(vardenhet).map(r => r.id);
  return [vardenhet, ...barn];
}

// Vårdrelation: pågående eller nyligen avslutad vårdkontakt, listning eller remiss till enheten.
// En vårdkontakt som skapades under nödåtkomst (ger_vardrelation = 0) räknas inte, och en kontakt som systemet skapade
// när någon dokumenterade räknas i 90 dagar från dagen den skapades, som ett avslutat besök, även om ingen avslutar den.
// Så blir varken en nödåtkomst eller en enstaka dokumentation en bestående vårdrelation till hela journalen.
// En planerad kontakt (en bokning i tidboken) räknas från bokningen till 90 dagar efter tiden, också efter en registrerad
// ankomst om ingen avslutar den, så att en bokning eller ett uteblivet besök aldrig blir en bestående vårdrelation.
// utanPlanerade räknar bort bokningarna, för att se om patienten har någon annan grund (tidbok.js efterAvvisning).
export function harVardrelation(db, patientId, vardenhet, nu = new Date(), { utanPlanerade = false } = {}) {
  // Runda 7, r4: vårdrelationen följer med till efterföljaren när en vårdenhet stängs vid en omorganisation.
  const enheter = [vardenhet, ...foregangare(db, vardenhet)].flatMap(v => enheterUnder(db, v));
  const ph = enheter.map(() => '?').join(', ');
  const grans = new Date(nu.getTime() - RELATION_DAGAR * 86400_000).toISOString();
  const vk = db.query(`SELECT 1 FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND coalesce(ger_vardrelation, 1) = 1
      ${utanPlanerade ? 'AND coalesce(planerad, 0) = 0' : ''}
      AND (slut >= ? OR (slut IS NULL AND (typ = 'slutenvard' OR start >= ? OR (coalesce(automatisk, 0) = 0 AND coalesce(planerad, 0) = 0)))) LIMIT 1`)
    .get(patientId, ...enheter, grans, grans);
  if (vk) return true;
  if (db.query(`SELECT 1 FROM listningar WHERE patient_id = ? AND enhet_id IN (${ph})`).get(patientId, ...enheter)) return true;
  // En vidarebefordrad remiss är inte längre ställd till vårdenheten (runda 6, r4), lika lite som en avvisad.
  const remiss = db.query(`SELECT 1 FROM remisser WHERE patient_id = ? AND (
      (till_enhet_id IN (${ph}) AND NOT (status = 'bedomd' AND beslut IN ('avvisad', 'vidarebefordrad')) AND (status <> 'svar_kvitterat' OR svar_kvitterat_tid >= ?)
        -- Runda 8, r2: en extern pappersremiss ger vårdrelation först när någon annan än den som registrerade den har
        -- tagit emot den (beslut 2026-11-08).
        AND NOT (fran_enhet_id = 'extern' AND (status = 'skickad' OR mottagen_av IS NULL
          OR mottagen_av = (SELECT x.registrerad_av FROM remiss_extern x WHERE x.remiss_id = remisser.id))))
      OR (fran_enhet_id IN (${ph}) AND status <> 'svar_kvitterat' AND NOT (status = 'bedomd' AND beslut IN ('avvisad', 'vidarebefordrad')))
    ) LIMIT 1`).get(patientId, ...enheter, grans, ...enheter);
  return Boolean(remiss);
}

export function aktivaSparrar(db, patientId) {
  return db.query('SELECT enhet_id FROM sparrar WHERE patient_id = ? AND aktiv = 1').all(patientId).map(r => vardenhetFor(db, r.enhet_id));
}

const svar = (tillaten, grund, krav = null, skal = '', sparrade = false) => ({ tillaten, grund, krav, spärrade: sparrade, skal });

// prova(db, { personal, patient, handling, resurs, val })
//   personal: rad ur personal (id, yrke, enhet_id)
//   patient:  patient-id eller rad ur patienter
//   handling: nyckel i HANDLINGAR
//   resurs:   { enhet_id, gemensam } för en enskild uppgift, annars null (patientnivå)
//   val:      { andra_enheter, nodatkomst, samtycke_sparr, visa_identitet } för sessionen och patienten
// Returnerar { tillaten, grund, krav, spärrade, skal }. krav är 'kraver_val' eller 'kraver_samtycke' när åtgärden
// blir möjlig efter ett aktivt val, nödåtkomst eller samtycke.
export function prova(db, { personal, patient, handling, resurs = null, val = {}, nu = new Date() }) {
  if (!personal) return svar(false, 'nekad', null, 'Ingen inloggad användare.');
  if (!HANDLINGAR[handling]) return svar(false, 'nekad', null, `Okänd handling: ${handling}`);
  if (!kanRoll(personal, handling)) {
    return svar(false, 'nekad', null, `Yrkesrollen får inte ${HANDLINGAR[handling]}.`);
  }
  // Runda 10, r1: ett systemkonto prövas mot sina vårdenheter och informationsmängder, aldrig med vårdrelation.
  if (personal.yrke === 'systemkonto') return provaSystemkonto(db, personal, patient, handling, resurs);
  if (handling === 'las_logg') return svar(true, 'logggranskning');
  if (UTAN_PATIENT.has(handling)) return svar(true, GRUND_UTAN_PATIENT[personal.yrke] ?? 'administrativ');

  const patientId = typeof patient === 'string' ? patient : patient?.id;
  if (!patientId) return svar(false, 'nekad', null, 'Patienten saknas.');
  const minEnhet = vardenhetFor(db, personal.enhet_id);
  const admin = personal.yrke === 'vardadministrator';
  const relation = harVardrelation(db, patientId, minEnhet, nu);

  let bas;
  if (relation) bas = admin ? 'administrativ' : 'vardrelation';
  else if (val.nodatkomst && kanRoll(personal, 'nodatkomst')) bas = 'nodatkomst';
  else if (kanRoll(personal, 'nodatkomst')) {
    return svar(false, 'nekad', 'kraver_val', 'Det finns ingen vårdrelation. Nödåtkomst kan användas om patienten inte kan samtycka och uppgifterna behövs för vården.');
  } else return svar(false, 'nekad', null, 'Det finns ingen vårdrelation till patienten.');

  // Spärrar från andra vårdenheter än min egen. Nödåtkomst häver aldrig en spärr.
  const sparrar = aktivaSparrar(db, patientId).filter(e => e !== minEnhet);
  const sparrade = sparrar.length > 0 && !val.samtycke_sparr;

  if (!resurs?.enhet_id) return svar(true, bas, null, '', sparrade);

  const resursEnhet = vardenhetFor(db, resurs.enhet_id);
  if (resursEnhet === minEnhet) return svar(true, bas === 'nodatkomst' ? 'nodatkomst' : admin ? 'administrativ' : 'egen_enhet', null, '', sparrade);
  if (sparrar.includes(resursEnhet)) {
    if (val.samtycke_sparr) return svar(true, 'samtycke_sparr', null, '', false);
    return svar(false, 'nekad', 'kraver_samtycke', 'Det finns spärrade uppgifter. De kan visas bara om patienten samtycker nu.', true);
  }
  if (bas === 'nodatkomst') return svar(true, 'nodatkomst', null, '', sparrade);
  // Gemensamma uppgifter (läkemedelslistan och överkänslighet) omfattas inte av aktivt val, men av spärr.
  if (resurs.gemensam) return svar(true, bas, null, '', sparrade);
  if (val.andra_enheter) return svar(true, 'aktivt_val', null, '', sparrade);
  return svar(false, 'nekad', 'kraver_val', 'Uppgifterna kommer från en annan vårdenhet. Gör ett aktivt val för att visa dem.', sparrade);
}

// Runda 10, r1: systemkontot slås upp i databasen vid varje prövning, så att en återkallelse gäller direkt. Inga aktiva
// val, ingen nödåtkomst och inget samtycke: det som inte är tillåtet är nekat.
function provaSystemkonto(db, personal, patient, handling, resurs) {
  const p = typeof patient === 'string' ? db.query('SELECT id, skyddad FROM patienter WHERE id = ?').get(patient) : patient;
  const r = systemkonton.prova(db, systemkonton.kontoFor(db, personal.id), { patient: p, handling, resurs });
  return r.tillaten ? svar(true, 'systemkonto') : svar(false, 'nekad', null, r.skal);
}

// Grunderna i den ordning de väger när ett anrop visar uppgifter på flera grunder.
const VIKT = ['samtycke_sparr', 'nodatkomst', 'aktivt_val', 'egen_enhet', 'vardrelation', 'administrativ', 'systemkonto'];
export function starkasteGrund(grunder, standard) {
  for (const g of VIKT) if (grunder.has(g)) return g;
  return standard;
}

// Kontext för ett anrop: vem, vilken patient och vilka val som gjorts. Samlar grunderna och loggar en rad.
export class Atkomst {
  constructor(db, personal, patientId, val = {}, handling = 'las_oversikt') {
    this.db = db;
    this.personal = personal;
    this.patientId = patientId;
    this.val = val;
    this.handling = handling;
    this.grunder = new Set();
    this.doldaVal = 0;
    this.doldaSparr = false;
    this.loggad = false;
  }

  prova(handling, resurs = null) {
    return prova(this.db, { personal: this.personal, patient: this.patientId, handling, resurs, val: this.val });
  }

  // Kräver åtkomst på patientnivå. Loggar och kastar Fel om den nekas.
  krav(handling = this.handling, { resurs = null, beskrivning = null } = {}) {
    const r = this.prova(handling, resurs);
    if (!r.tillaten) {
      this.logga(handling, 'nekad', beskrivning, 'nekad');
      const kod = r.krav ?? 'nekad';
      throw new Fel(403, r.skal, kod);
    }
    this.grunder.add(r.grund);
    if (r.spärrade) this.doldaSparr = true;
    return r;
  }

  // Filtrerar rader på enhet och kategori. Det som döljs räknas så att gränssnittet kan erbjuda val.
  filtrera(rader, handlingFor, { gemensam = false } = {}) {
    const ut = [];
    for (const rad of rader) {
      const handling = typeof handlingFor === 'function' ? handlingFor(rad) : handlingFor;
      if (!kanRoll(this.personal, handling)) continue;
      const r = this.prova(handling, { enhet_id: rad.enhet_id, gemensam });
      if (r.tillaten) { this.grunder.add(r.grund); ut.push(rad); }
      else if (r.krav === 'kraver_samtycke') this.doldaSparr = true;
      else if (r.krav === 'kraver_val') this.doldaVal++;
    }
    return ut;
  }

  grund() {
    return starkasteGrund(this.grunder, this.personal.yrke === 'vardadministrator' ? 'administrativ' : this.personal.yrke === 'systemkonto' ? 'systemkonto' : 'vardrelation');
  }

  logga(handling = this.handling, grund = this.grund(), resurs = null, resultat = 'tillaten', syfte = null) {
    this.loggad = true;
    return loggaRad(this.db, {
      personal_id: this.personal.id, enhet_id: this.personal.enhet_id, patient_id: this.patientId,
      handling, resurs, grund, syfte, resultat,
    });
  }
}

// Min journal, invånarens egen e-tjänst. En vårdgivare får ge en enskild direktåtkomst till uppgifter om sig själv och
// till loggarna över åtkomsten (patientdatalagen 5 kap. 5 §). Prövningen är en ren funktion som prova() och gäller i
// varje anrop. Den släpper aldrig igenom personalens handlingar: invånaren får bara läsa en journal.
//   Egen journal: från 16 år (Ineras villkor för 1177 journal, punkt 9).
//   Vårdnadshavare: barnets journal tills barnet fyller 13 år (samma villkor, punkt 4), aldrig för ett barn med skyddade
//   personuppgifter (punkt 8). Mellan 13 och 16 år läser varken barnet eller vårdnadshavaren journalen i demon.
// Spärrar gäller mellan vårdenheter (4 kap. 4 §) och påverkar inte patientens egen läsning.
export const EGEN_FRAN_ALDER = 16;
export const VARDNADSHAVARE_TILL_ALDER = 13;
const datumI = (nu) => nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

// prova för invånaren: { invanare, patient, nu } där invanare och patient är rader. Returnerar
// { tillaten, grund, relation, skal } där relation är egen, vardnadshavare eller null (ingen koppling alls).
export function provaInvanare(db, { invanare, patient, nu = new Date() }) {
  const nej = (relation, skal) => ({ tillaten: false, grund: 'nekad', relation, skal });
  if (!invanare) return nej(null, 'Ingen inloggad invånare.');
  if (!patient) return nej(null, 'Journalen finns inte.');
  const ar = alder(patient.fodd, datumI(nu));
  if (invanare.patient_id === patient.id) {
    if (ar < EGEN_FRAN_ALDER) return nej('egen', `Du kan läsa din journal i Min journal från ${EGEN_FRAN_ALDER} års ålder.`);
    return { tillaten: true, grund: 'egen_atkomst', relation: 'egen', skal: '' };
  }
  const vh = db.query('SELECT 1 FROM vardnadshavare WHERE invanare_id = ? AND barn_id = ?').get(invanare.id, patient.id);
  if (!vh) return nej(null, 'Du kan bara läsa din egen journal och journalen för ett barn under 13 år som du är vårdnadshavare för.');
  if (patient.skyddad) return nej('vardnadshavare', 'Barnet har skyddade personuppgifter. Journalen kan då inte läsas av vårdnadshavare i Min journal. Kontakta vården.');
  if (ar >= VARDNADSHAVARE_TILL_ALDER) return nej('vardnadshavare', `Som vårdnadshavare kan du läsa barnets journal tills barnet fyller ${VARDNADSHAVARE_TILL_ALDER} år. Därefter visas barnets journal inte för vårdnadshavare i Min journal.`);
  return { tillaten: true, grund: 'vardnadshavare', relation: 'vardnadshavare', skal: '' };
}

// Skyddade personuppgifter: maskering i listor och huvud.
export const maskeraPnr = (pnr) => `${pnr.slice(0, 8)}-****`;
export const formateraPnr = (pnr) => `${pnr.slice(0, 8)}-${pnr.slice(8)}`;
export const SKYDDAD_NAMN = 'Skyddad identitet';

export function visningsnamn(p, visad = false) {
  if (p.skyddad && !visad) return SKYDDAD_NAMN;
  return `${p.fornamn} ${p.efternamn}`;
}
// Patientens gällande identitet i visningsform: personnummer, samordningsnummer, reservnummer eller OID-identitet.
export function visningsPnr(p, visad = false) {
  const typ = p.id_typ ?? 'personnummer';
  return p.skyddad && !visad ? maskera(typ, p.personnummer) : formatera(typ, p.personnummer);
}
export function alder(fodd, idag) {
  const [y, m, d] = fodd.split('-').map(Number);
  const [ty, tm, td] = idag.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// Runda 9, r7: patientgruppering och folkhälsoinsatser (analys.js och folkhalsa.js, Sussa 6.2.1.2 och 6.2.2.1),
// forskningsuttag (forskning.js, Sussa 6.3.3.1), in- och utfarter (infarter.js, Sussa 3.1.3.3), skannade restjournaler
// (restjournal.js, Sussa 3.1.10.1) och signeringslistan (signering.js, Sussa 3.1.11.2). Läkare och sjuksköterskor
// grupperar patienter som de har vårdrelation till på den egna vårdenheten, och analysen räknas bara på uppgifter som
// de får se utan aktivt val. Uppföljningsrollen ser grupperna som antal för regionen (statistik_region). En beställning
// av forskningsuttag registreras av uppföljningsrollen och godkänns av två andra personer: arkivarien, som gör
// sekretessprövningen, och verksamhetschefen, som ansvarar för uppgifterna. Ingen av dem läser journalen. In- och
// utfarter registreras av läkare och sjuksköterskor och läses med omvårdnadsanteckningarna. En restjournal skannas in
// av vårdadministratören, läkaren eller sjuksköterskan och läses med journalen. Verksamhetschefen och läkaren ser
// vårdenhetens osignerade poster utan patientuppgifter.
Object.assign(HANDLINGAR, {
  patientgrupp: 'gruppera patienter med vårdrelation på vårdenheten', forskning_bestall: 'registrera och lämna ut beställningar av forskningsuttag',
  forskning_godkann: 'godkänna beställningar av forskningsuttag', infart: 'registrera och avveckla in- och utfarter',
  restjournal: 'skanna in restjournaler', signeringslista: 'se vårdenhetens osignerade poster',
});
for (const r of ['lakare', 'sjukskoterska']) ROLLER[r].push('patientgrupp', 'infart', 'restjournal');
ROLLER.vardadministrator.push('restjournal');
ROLLER.uppfoljning.push('forskning_bestall');
ROLLER.arkivarie.push('forskning_godkann');
ROLLER.verksamhetschef.push('forskning_godkann', 'signeringslista');
ROLLER.lakare.push('signeringslista');
for (const h of ['patientgrupp', 'forskning_bestall', 'forskning_godkann', 'signeringslista']) UTAN_PATIENT.add(h);

// Runda 10, r2: basfakta (overkanslighet.js, Sussa 3.1.6.2). Läkare och sjuksköterskor registrerar, ändrar och avslutar
// överkänslighet på sin egen vårdenhet med vårdrelation till patienten.
Object.assign(HANDLINGAR, { registrera_overkanslighet: 'registrera, ändra och avsluta överkänslighet' });
ROLLER.lakare.push('registrera_overkanslighet');
ROLLER.sjukskoterska.push('registrera_overkanslighet');
// Runda 10, r2: vårdenhetens förval för vyerna (presentationsvyer.js, Sussa 3.1.2.1 och 3.1.2.3). Systemförvaltningen
// sätter förvalet för alla vårdenheter och verksamhetschefen för sin egen. Förvalet ändrar bara vad som visas.
Object.assign(HANDLINGAR, { vyforval: 'sätta vårdenhetens förval för vyerna' });
ROLLER.systemforvaltare.push('vyforval');
ROLLER.verksamhetschef.push('vyforval');
UTAN_PATIENT.add('vyforval');
// Runda 10, r1: systemkonton för externa tillämpningar utan inloggad person, till exempel ett regionalt vårddatalager
// (systemkonton.js, Sussa 2.5.1.2). Rollen läser bara: vilka informationsmängder och vårdenheter ett visst konto får
// prövas i provaSystemkonto. Rollen kan aldrig logga in och är ingen personal, så den har inga övningar.
ROLLER.systemkonto = ['las_oversikt', 'las_diagnoser', 'las_matvarden', 'las_lakemedel', 'las_admin'];
// Runda 10, r4: dokumentation vid donation (donation.js, Sussa 3.1.12.1). Läkare och sjuksköterskor med vårdrelation
// dokumenterar donationsutredningen och den avlidnes inställning. Dödsfallet, transplantationen och
// donationsanteckningen kräver dessutom läkarens skriv_journal.
Object.assign(HANDLINGAR, { donation: 'dokumentera donationsutredningar och inställningen till donation' });
for (const r of ['lakare', 'sjukskoterska']) ROLLER[r].push('donation');
// Runda 10, r7: meddelanden från invånare, fullmakter för ombud, kassan och vårdenhetens kapacitet (invanarmeddelanden.js,
// ombud.js, kassa.js och kapacitetsprognos.js). Läkare, sjuksköterskor, fysioterapeuter och vårdadministratörer läser och
// besvarar meddelanden till sin vårdenhet, med vårdrelation som grund. Vårdadministratören registrerar skriftliga
// fullmakter, har kassan och ser kapaciteten och prognosen för vårdenheten, utan patientuppgifter.
Object.assign(HANDLINGAR, {
  meddelande_invanare: 'läsa och besvara meddelanden från invånare till vårdenheten', fullmakt: 'registrera och återkalla fullmakter för ombud',
  kassa: 'ta betalt, återbetala och göra dagsavslut i kassan', kapacitet: 'se vårdenhetens kapacitet och prognoser',
});
for (const r of ['lakare', 'sjukskoterska', 'fysioterapeut', 'vardadministrator']) ROLLER[r].push('meddelande_invanare');
ROLLER.vardadministrator.push('fullmakt', 'kassa', 'kapacitet');
for (const h of ['kassa', 'kapacitet']) UTAN_PATIENT.add(h);
