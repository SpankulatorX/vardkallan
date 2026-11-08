// De nationella vaccinationsprogrammen för barn och vuxna (runda 10, r5, Sussa 3.5.1.7).
//
// Systemet är experten. För varje patient räknar systemet ut vilka doser i programmen som gäller: barnens doser efter
// fem års ålder, som oftast ges av elevhälsan, vattkoppor för barn födda 1 juli 2025 eller senare och programmet för
// riskgrupper (influensa och pneumokocker) för den som är 65 år eller äldre eller har en diagnos som ger ökad risk.
// Systemet hittar riskgruppen själv i diagnoserna, föreslår dosen med skälet, prövar ålder, ordning, intervall och
// säsong och förklarar på vanlig svenska varför en dos inte kan ges. Före varje dos frågar systemet alltid om
// vaccinationer som har getts någon annanstans, och en sådan dos registreras med källan. Varje dos som ges här
// rapporteras av systemet till det simulerade vaccinationsregistret (vaccinationsregister.js).
//
// Behörighet. Programmet och vaccinationerna läses med las_oversikt, och bara det användaren får se räknas: en
// vaccination eller diagnos bakom inre sekretess eller spärr påverkar varken förslagen eller skälen, och en spärr röjs
// aldrig. En vaccination som bara kräver ett aktivt val varnar systemet för, som i barnhälsovården. Doser registreras av
// läkare och sjuksköterskor med vårdrelation (handlingen vaccinera), aldrig under nödåtkomst. Barnhälsovårdens doser
// till fem år ges på barnavårdscentralen (bhv.js).
import { Fel, iso, idag, giltigtDatum } from './db.js';
import { Atkomst } from './atkomst.js';
import * as R from './vaccinationsprogram-regler.js';
import * as register from './vaccinationsregister.js';
import { vaccinationUt as bhvVaccinationUt, FRAGA_ANDRA, VARNING_DOLDA } from './bhv.js';

export const { VACCINER, KALLOR, PROGRAM } = R;
export const program = R.program;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS vaccination_kalla (
  vaccination_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, text TEXT,
  registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, CHECK (typ IN ('elevhalsan', 'annan'))
);
CREATE TRIGGER IF NOT EXISTS vaccination_kalla_andras_ej BEFORE UPDATE ON vaccination_kalla BEGIN SELECT RAISE(ABORT, 'Källan för en vaccination ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vaccination_kalla_raderas_ej BEFORE DELETE ON vaccination_kalla BEGIN SELECT RAISE(ABORT, 'Källan för en vaccination raderas inte'); END;
`;
export function sakra(db) {
  db.exec(SCHEMA);
  register.sakra(db);
}

const KALLTEXT = { elevhalsan: 'Elevhälsan', annan: 'Annan vårdgivare eller utomlands' };
const BHV_DOSER = new Set(['rota1', 'rota2', 'hexa1', 'hexa2', 'hexa3', 'pcv1', 'pcv2', 'pcv3', 'mpr1', 'dtp4', 'bcg']);

// En vaccination med program, källa och rapport.
export function vaccinationUt(db, v) {
  const d = R.vaccinRad(v.vaccin_id);
  const k = db.query('SELECT * FROM vaccination_kalla WHERE vaccination_id = ?').get(v.id);
  return {
    ...bhvVaccinationUt(db, v), program: d ? PROGRAM[d.program] : PROGRAM.barn,
    kalla: k ? { typ: k.typ, typText: KALLTEXT[k.typ], text: k.text } : null, rapport: register.rapportFor(db, v.id),
  };
}
export const kallaFor = (db, vaccinationId) => {
  const k = db.query('SELECT typ, text FROM vaccination_kalla WHERE vaccination_id = ?').get(vaccinationId);
  return k ? { typ: k.typ, text: k.text ?? KALLTEXT[k.typ] } : null;
};

const las = (atk) => new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_oversikt');
const doldaKraverVal = (a, rader) => rader.some(r => { const x = a.prova('las_oversikt', { enhet_id: r.enhet_id }); return !x.tillaten && x.krav === 'kraver_val'; });
function underlag(atk) {
  const db = atk.db;
  const a = las(atk);
  const alla = db.query('SELECT * FROM vaccinationer WHERE patient_id = ? ORDER BY tid').all(atk.patientId);
  const synliga = a.filtrera(alla, 'las_oversikt');
  const diagnoser = a.filtrera(db.query('SELECT * FROM diagnoser WHERE patient_id = ?').all(atk.patientId), 'las_diagnoser');
  return { a, synliga, dolda: doldaKraverVal(a, alla), riskgrupper: R.riskgrupperFor(diagnoser) };
}

// GET /api/patient/:id/vaccinationsprogram
export function forPatient(atk, p, nu = Date.now()) {
  atk.krav('las_oversikt');
  const db = atk.db;
  const u = underlag(atk);
  const prog = R.program({ fodd: p.fodd, nu, givna: u.synliga.map(v => ({ vaccinId: v.vaccin_id, tid: v.tid })), riskgrupper: u.riskgrupper });
  const kan = atk.prova('vaccinera');
  return {
    program: prog, riskgrupper: u.riskgrupper, vaccinationer: u.synliga.map(v => vaccinationUt(db, v)).reverse(),
    doldaVaccinationer: { kraverVal: u.dolda, text: u.dolda ? VARNING_DOLDA : null }, fraga: FRAGA_ANDRA,
    kan: { vaccinera: kan.tillaten && kan.grund !== 'nodatkomst' }, register: register.MOTTAGARE, demoregel: R.DEMOREGEL, kallor: KALLOR,
  };
}

function kravVaccinera(atk) {
  const r = atk.krav('vaccinera', { beskrivning: 'vaccinationsprogram' });
  if (r.grund === 'nodatkomst') {
    atk.logga('vaccinera', 'nekad', 'vaccinationsprogram', 'nekad');
    throw new Fel(403, 'Vaccinationer registreras av den som har vårdrelation till patienten. Nödåtkomst ger bara läsning.', 'nekad');
  }
}
function vaccinFor(id) {
  if (BHV_DOSER.has(id)) throw new Fel(400, 'Dosen ges i barnhälsovården och registreras på barnavårdscentralen där barnet är inskrivet.', 'ogiltig', { falt: ['vaccinId'] });
  const v = R.vaccinRad(id);
  if (!v) throw new Fel(400, 'Okänt vaccin i programmen.', 'ogiltig', { falt: ['vaccinId'] });
  return v;
}

// POST /api/patient/:id/vaccinationsprogram/vaccination { vaccinId, batch?, andraVaccinationer, bekraftaDolda? }
export function vaccinera(atk, p, body = {}, knyt, nu = Date.now()) {
  kravVaccinera(atk);
  const db = atk.db;
  const v = vaccinFor(body.vaccinId);
  if (body.andraVaccinationer === 'ja') throw new Fel(400, 'Registrera inte dosen förrän du vet vilka vaccinationer patienten har fått. Registrera dem som givna någon annanstans först.', 'ogiltig', { falt: ['andraVaccinationer'] });
  if (body.andraVaccinationer !== 'nej') throw new Fel(400, 'Har patienten fått vaccinationer någon annanstans, till exempel av elevhälsan, på en annan vårdenhet eller utomlands? Fråga innan du ger dosen.', 'kraver_fraga', { falt: ['andraVaccinationer'] });
  const u = underlag(atk);
  if (u.dolda && body.bekraftaDolda !== true) throw new Fel(409, VARNING_DOLDA.replace('Barnet', 'Patienten'), 'kraver_bekraftelse');
  const pr = R.prova(v, { fodd: p.fodd, nu, givna: u.synliga.map(x => ({ vaccinId: x.vaccin_id, tid: x.tid })), riskgrupper: u.riskgrupper });
  if (!pr.ok) throw new Fel(400, pr.skal, 'ogiltig', { falt: ['vaccinId'] });
  const batch = typeof body.batch === 'string' && body.batch.trim() ? body.batch.trim().slice(0, 40) : null;
  const r = db.query('INSERT INTO vaccinationer (patient_id, enhet_id, vaccin_id, atc, dos, tid, givet_av, batch, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, atk.personal.enhet_id, v.id, v.atc, v.dos, new Date(nu).toISOString(), atk.personal.id, batch, iso());
  const id = Number(r.lastInsertRowid);
  register.rapportera(db, id);
  const ut = vaccinationUt(db, db.query('SELECT * FROM vaccinationer WHERE id = ?').get(id));
  knyt(atk, 'vaccinationer', ut, body);
  atk.logga('vaccinera', atk.grund(), `vaccination:${id}`, 'tillaten', u.dolda ? 'Dosen gavs utan aktivt val, efter bekräftelse att patienten har vaccinationer registrerade på en annan vårdenhet.' : null);
  return [201, { ...ut, text: `${v.text} är registrerad och rapporterad till vaccinationsregistret (simulerat).` }];
}

// POST /api/patient/:id/vaccinationsprogram/tidigare { vaccinId, datum, kalla, text? }: en dos som har getts någon
// annanstans, med källan. Den rapporteras inte av Vårdkällan.
export function tidigare(atk, p, body = {}) {
  kravVaccinera(atk);
  const db = atk.db;
  const v = R.vaccinRad(body.vaccinId) ?? (BHV_DOSER.has(body.vaccinId) ? null : null);
  if (!v) throw new Fel(400, 'Välj ett vaccin i programmen.', 'ogiltig', { falt: ['vaccinId'] });
  if (!giltigtDatum(body.datum) || body.datum > idag() || body.datum < p.fodd) throw new Fel(400, 'Ange dagen då dosen gavs, från födelsedagen till i dag.', 'ogiltig', { falt: ['datum'] });
  if (!Object.hasOwn(KALLTEXT, body.kalla ?? '')) throw new Fel(400, 'Ange var dosen gavs: elevhälsan eller en annan vårdgivare eller utomlands.', 'ogiltig', { falt: ['kalla'] });
  const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 200) : null;
  const t = iso();
  const id = Number(db.query("INSERT INTO vaccinationer (patient_id, enhet_id, vaccin_id, atc, dos, tid, givet_av, batch, registrerad, kalla) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'annan')")
    .run(p.id, atk.personal.enhet_id, v.id, v.atc, v.dos, `${body.datum}T12:00:00.000Z`, t).lastInsertRowid);
  db.query('INSERT INTO vaccination_kalla (vaccination_id, patient_id, enhet_id, typ, text, registrerad, registrerad_av) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, p.id, atk.personal.enhet_id, body.kalla, text, t, atk.personal.id);
  atk.logga('vaccinera', atk.grund(), `vaccination:${id}:tidigare`);
  return [201, { ...vaccinationUt(db, db.query('SELECT * FROM vaccinationer WHERE id = ?').get(id)), text: `${v.text} given ${body.datum} är registrerad med källan ${KALLTEXT[body.kalla].toLowerCase()}.` }];
}
