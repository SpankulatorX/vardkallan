// Runda 14, r2: organisationer som är anslutna som tjänstekonsumenter till Vårdkällans producenter, och deras
// behörighet. Det motsvarar anropsbehörigheterna i tjänsteplattformens adressering (TAK): en organisation med ett
// HSA-id får anropa vissa kontrakt hos en logisk adress. Varje ansluten organisation har ett systemkonto
// (systemkonton.js), och producenterna läser med kontot, så att behörighetsmotorn prövar varje uppgift: bara kontots
// vårdenheter och informationsmängder, aldrig skyddade personuppgifter och aldrig uppgifter som patienten har spärrat.
//
// Organisationens HSA-id kommer från transporten: serialNumber i det prövade funktionscertifikatet när organisationen
// anropar direkt, eller huvudet x-rivta-original-serviceconsumer-hsaid när anropet kommer genom en tjänsteplattform vars
// certifikat Vårdkällan litar på. Ett HSA-id som klienten själv skriver i meddelandet räknas aldrig.
//
// I demon finns tre simulerade konsumenter. De är inte de nationella tjänsterna, och deras HSA-id är påhittade.
import { iso } from '../db.js';
import { registreraForTjanstekontrakt } from '../systemkonton.js';

export const NPO = 'SE0000000000-SIMNPO';
export const JOURNALEN = 'SE0000000000-SIMJOURNALEN';
export const SJF = 'SE0000000000-SIMSJF';

const JOURNALKONTRAKT = ['GetCareDocumentation', 'GetDiagnosis', 'GetAlertInformation', 'GetCareContacts', 'GetObservations', 'GetActivities',
  'GetLaboratoryOrderOutcome', 'GetReferralOutcome', 'GetMedicationHistory'];
const MANGDER = ['anteckningar', 'diagnoser', 'uppmarksamhet', 'overkanslighet', 'vardkontakter', 'matvarden', 'lakemedel', 'atgarder'];

export const DEMO = [
  { hsaId: NPO, namn: 'NPÖ, simulerad konsument i demon', syfte: 'Nationell patientöversikt: vårdpersonal hos andra vårdgivare läser journaluppgifter vid sammanhållen journalföring.', kontrakt: JOURNALKONTRAKT, mangder: MANGDER },
  { hsaId: JOURNALEN, namn: 'Journalen, simulerad konsument i demon', syfte: 'Invånarens egen journal: patienten läser uppgifter som vårdgivaren har gjort tillgängliga för patienten.', kontrakt: JOURNALKONTRAKT, mangder: MANGDER },
  { hsaId: SJF, namn: 'Aggregerande tjänst, simulerad konsument i demon', syfte: 'Sammanhållen journalföring: den aggregerande tjänsten hämtar uppgifter från varje källsystem för en patient.', kontrakt: JOURNALKONTRAKT, mangder: MANGDER },
];
// Runda 14, r3: de simulerade konsumenterna läser också vaccinationer (GetVaccinationHistory, rivta-vaccination.js).
JOURNALKONTRAKT.push('GetVaccinationHistory');
MANGDER.push('vaccinationer');

export function sakraSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS rivta_konsumenter (
    hsa_id TEXT PRIMARY KEY, namn TEXT NOT NULL, systemkonto_id TEXT NOT NULL, kontrakt TEXT NOT NULL, simulerad INTEGER NOT NULL DEFAULT 1, registrerad TEXT NOT NULL)`);
}

// De simulerade konsumenterna finns i varje sandlåda. De läggs in första gången något i RIVTA behöver dem, med alla
// vårdenheter hos vårdgivaren.
export function sakraDemo(db) {
  sakraSchema(db);
  const vardenheter = db.query("SELECT id FROM enheter WHERE typ = 'vardenhet' ORDER BY id").all().map(r => r.id);
  for (const k of DEMO) {
    if (db.query('SELECT 1 FROM rivta_konsumenter WHERE hsa_id = ?').get(k.hsaId)) continue;
    const id = registreraForTjanstekontrakt(db, { namn: k.namn, syfte: k.syfte, vardenheter, mangder: k.mangder, hsaId: k.hsaId });
    db.query('INSERT INTO rivta_konsumenter (hsa_id, namn, systemkonto_id, kontrakt, simulerad, registrerad) VALUES (?, ?, ?, ?, 1, ?)').run(k.hsaId, k.namn, id, JSON.stringify(k.kontrakt), iso());
  }
}

// Vårdkällans egna logiska adresser: vårdgivarens HSA-id.
export function egnaAdresser(db) {
  return db.query("SELECT hsa_id FROM enheter WHERE typ = 'vardgivare' AND hsa_id IS NOT NULL ORDER BY id").all().map(r => r.hsa_id);
}

export const vardgivare = (db) => egnaAdresser(db)[0] ?? null;

export function lista(db) {
  sakraDemo(db);
  return db.query('SELECT * FROM rivta_konsumenter ORDER BY hsa_id').all().map(r => ({ hsaId: r.hsa_id, namn: r.namn, kontrakt: JSON.parse(r.kontrakt), simulerad: Boolean(r.simulerad), systemkontoId: r.systemkonto_id }));
}

// Prövar den anropande organisationen. Ger { tillaten, konsument, skal }. konsument har personalraden för systemkontot.
export function prova(db, avsandare, def) {
  sakraDemo(db);
  const hsaId = typeof avsandare?.hsaId === 'string' ? avsandare.hsaId : null;
  if (!hsaId) return { tillaten: false, skal: 'Den anropande organisationen kunde inte fastställas ur certifikatet.' };
  const r = db.query('SELECT * FROM rivta_konsumenter WHERE hsa_id = ?').get(hsaId);
  if (!r || !JSON.parse(r.kontrakt).includes(def.namn)) {
    return { tillaten: false, skal: `Den anropande organisationen ${hsaId} har ingen anropsbehörighet till ${def.namn} hos Vårdkällan.` };
  }
  const personal = db.query("SELECT * FROM personal WHERE id = ? AND yrke = 'systemkonto' AND aktiv = 1").get(r.systemkonto_id);
  if (!personal) return { tillaten: false, skal: `Anslutningen för ${hsaId} är återkallad.` };
  return { tillaten: true, konsument: { hsaId, namn: r.namn, personal, kontoId: r.systemkonto_id } };
}
