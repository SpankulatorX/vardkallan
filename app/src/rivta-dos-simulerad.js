// Runda 14, r3: ett simulerat dosapotek för dosdispenseringens tjänstekontrakt (riv.druglogistics.dosedispensing,
// RIVTA Basic Profile 2.0). Det tar emot SkapaVardtagare och svarar på HamtaVardtagareinformation genom samma kuvert och
// validering som en riktig tjänst. Det är påhittat och märkt som simulerat.
import { iso } from './db.js';
import * as r3 from './rivta-r3.js';
import * as dos from './rivta-dos.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sim_dosapotek (personid TEXT PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, uppgifter TEXT NOT NULL, tid TEXT NOT NULL);
`;
export const sakra = (db) => db.exec(SCHEMA);
let nr = 100000;
const svar = (kod, text) => ({ resultatkod: kod, meddelandetext: text, meddelandeid: (nr = nr >= 999999 ? 100000 : nr + 1) });

export const tjanst = r3.simuleradTjanst(dos.DOSAPOTEK.namn, [dos.DOSAPOTEK.gln]);
tjanst.registrera(dos.DEF.skapa(), (ctx, { begaran }) => {
  const v = begaran.Vardtagarinformation;
  const personid = v.Patientinformation.personid;
  const p = ctx.db.query('SELECT id FROM patienter WHERE personnummer = ?').get(personid);
  const e = ctx.db.query("SELECT id FROM enheter WHERE hsa_id = ? AND typ = 'vardenhet'").get(v.Kontaktinformation?.vardandeenhetid ?? '');
  if (!p || !e) return svar('3', 'Personen eller den vårdande enheten är okänd.');
  if (ctx.db.query('SELECT 1 FROM sim_dosapotek WHERE personid = ?').get(personid)) return svar('2', 'Personen är redan dospatient.');
  ctx.db.query('INSERT INTO sim_dosapotek (personid, patient_id, enhet_id, uppgifter, tid) VALUES (?, ?, ?, ?, ?)').run(personid, p.id, e.id, JSON.stringify(v), iso());
  return { ...svar('1', 'Vårdtagaren är registrerad (simulerat).'), Patientinformation: v.Patientinformation };
});
tjanst.registrera(dos.DEF.hamta(), (ctx, { begaran }) => {
  const r = ctx.db.query('SELECT * FROM sim_dosapotek WHERE personid = ?').get(begaran.personid);
  return r ? { ...svar('1', 'Vårdtagaren finns.'), Vardtagarinformation: JSON.parse(r.uppgifter) } : svar('1', 'Personen är inte dospatient.');
});
dos.sattTransport((db) => r3.tillMotpart(db, tjanst));
