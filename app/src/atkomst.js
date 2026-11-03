// Behörighetsmotorn. prova() är en ren funktion av databasens innehåll och anropet: den ändrar inget
// och loggar inget. Servern anropar den i varje API- och FHIR-anrop och loggar utfallet.
import { Fel } from './db.js';
import { loggaRad } from './logg.js';
import { formatera, maskera } from './identitet.js';

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
};

// Handlingar som inte rör en enskild patient.
const UTAN_PATIENT = new Set(['sok', 'vantrum', 'las_logg', 'registrera_patient', 'registrera_arkivbeslut', 'arkivera', 'gallra', 'datauttag']);
// Grunden för handlingar utan patient. Arkivarien handlar på ett registrerat beslut, som arkiv.js kontrollerar, och
// uppföljningsrollen på sitt uppdrag. Ingen av dem får läsa journalen.
const GRUND_UTAN_PATIENT = { logggranskare: 'logggranskning', arkivarie: 'arkivbeslut', uppfoljning: 'uppfoljning' };
const RELATION_DAGAR = 90;

export const kanRoll = (personal, handling) => Boolean(ROLLER[personal?.yrke]?.includes(handling));

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
export function harVardrelation(db, patientId, vardenhet, nu = new Date()) {
  const enheter = enheterUnder(db, vardenhet);
  const ph = enheter.map(() => '?').join(', ');
  const grans = new Date(nu.getTime() - RELATION_DAGAR * 86400_000).toISOString();
  const vk = db.query(`SELECT 1 FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND coalesce(ger_vardrelation, 1) = 1
      AND (slut >= ? OR (slut IS NULL AND (coalesce(automatisk, 0) = 0 OR typ = 'slutenvard' OR start >= ?))) LIMIT 1`)
    .get(patientId, ...enheter, grans, grans);
  if (vk) return true;
  if (db.query(`SELECT 1 FROM listningar WHERE patient_id = ? AND enhet_id IN (${ph})`).get(patientId, ...enheter)) return true;
  const remiss = db.query(`SELECT 1 FROM remisser WHERE patient_id = ? AND (
      (till_enhet_id IN (${ph}) AND NOT (status = 'bedomd' AND beslut = 'avvisad') AND (status <> 'svar_kvitterat' OR svar_kvitterat_tid >= ?))
      OR (fran_enhet_id IN (${ph}) AND status <> 'svar_kvitterat' AND NOT (status = 'bedomd' AND beslut = 'avvisad'))
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

// Grunderna i den ordning de väger när ett anrop visar uppgifter på flera grunder.
const VIKT = ['samtycke_sparr', 'nodatkomst', 'aktivt_val', 'egen_enhet', 'vardrelation', 'administrativ'];
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
    return starkasteGrund(this.grunder, this.personal.yrke === 'vardadministrator' ? 'administrativ' : 'vardrelation');
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
