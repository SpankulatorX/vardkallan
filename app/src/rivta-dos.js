// Runda 14, r3: dosdispensering (Sussa 5.1.4.3) med tjänstekontrakten i riv.druglogistics.dosedispensing 1.1.0
// (gränssnittet mellan vårdsystem och dosapotek, Pascal), RIVTA Basic Profile 2.0. Vårdkällan är konsument:
//   SkapaVardtagare              läkaren anmäler patienten som ny dospatient till dosapoteket, med patientens samtycke;
//   HamtaVardtagareinformation   journalen hämtar dosapotekets uppgifter om patienten.
// Själva ordinationen av dosdispenserade läkemedel görs i det nationella verktyget, som inte går att ansluta i demon.
// Systemet är experten: läkaren, arbetsplatskoden, patienten, adressen, den patientansvariga läkaren och första dosdagen
// (nästa måndag) fyller systemet i, och läkaren bekräftar bara samtycket. Dosapoteket är simulerat (rivta-dos-simulerad.js).
import { Fel, iso, datumAv, addDagar } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import * as r3 from './rivta-r3.js';

const DOMAN = 'riv.druglogistics.dosedispensing';
export const DEF = { skapa: () => r3.def(DOMAN, 'SkapaVardtagare', '1.0'), hamta: () => r3.def(DOMAN, 'HamtaVardtagareinformation', '1.0') };
// Det simulerade dosapoteket. GLN-koden och arbetsplatskoden är påhittade och märkta som demo.
export const DOSAPOTEK = { gln: '7350000000009', id: 'DEMO-DOSAPOTEK', namn: 'Dosapoteket (simulerat)' };
const ARBETSPLATSKOD = 'DEMO0000';
const forskrivarkod = (hsa) => `DEMO${String(hsa).replace(/\D/g, '').slice(-5).padStart(5, '0')}`;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS dospatienter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, forsta_dosdag TEXT NOT NULL, status TEXT NOT NULL,
  meddelande_id INTEGER, anmald_av TEXT NOT NULL, anmald TEXT NOT NULL
);
`;
export const sakra = (db) => db.exec(SCHEMA);

let transportTill = () => { throw new r3.RivtaFel('transport', 'Inget dosapotek är anslutet.'); };
export const sattTransport = (fn) => { transportTill = fn; };

const identitet = (p) => {
  const nr = String(p.personnummer ?? '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(nr) || /^vk/i.test(String(p.personnummer))) return null;
  return { identitetstyp: Number(nr.slice(6, 8)) > 60 ? 'S' : 'P', personid: nr };
};
const behorighet = (pers) => ({ fornamn: pers.namn.split(' ')[0], efternamn: pers.namn.split(' ').slice(1).join(' ') || pers.namn, forskrivarkod: forskrivarkod(pers.hsa_id), yrkeskod: 'LK', arbetsplatskod: ARBETSPLATSKOD, hsaid: pers.hsa_id });
// Första dosdagen: nästa måndag minst en vecka fram, så att dosapoteket hinner.
export function forstaDosdag(nu = new Date()) {
  const d = datumAv(nu);
  const veckodag = new Date(`${d}T12:00:00Z`).getUTCDay();
  return addDagar(d, 7 + ((8 - veckodag) % 7 || 7));
}

export async function anmal(atk, p, body = {}, nu = new Date()) {
  atk.krav('ordinera');
  if (body.samtycke !== true) throw new Fel(400, 'Patienten ska ha samtyckt till dosdispensering. Bekräfta samtycket.', 'ogiltig', { falt: ['samtycke'] });
  const id = identitet(p);
  if (!id) throw new Fel(400, 'Patienten har inget personnummer eller samordningsnummer. Dosapoteket tar bara emot dem.', 'ogiltig');
  const db = atk.db;
  if (db.query("SELECT 1 FROM dospatienter WHERE patient_id = ? AND status = 'anmald'").get(p.id)) throw new Fel(409, 'Patienten är redan anmäld till dosapoteket.', 'konflikt');
  const pers = db.query('SELECT * FROM personal WHERE id = ?').get(atk.personal.id);
  const enhet = db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, atk.personal.enhet_id));
  const forsta = forstaDosdag(nu);
  const b = behorighet(pers);
  const begaran = {
    glnkod: DOSAPOTEK.gln, Behorighetsinformation: b,
    forskrivaresamtyckefornamn: b.fornamn, forskrivaresamtyckeefternamn: b.efternamn, forskrivaresamtyckeforskrivarkod: b.forskrivarkod,
    forskrivaresamtyckearbetsplatskod: b.arbetsplatskod, forskrivaresamtyckeyrkeskod: 'LK',
    Vardtagarinformation: {
      hemmaboende: true, dosapoteksid: DOSAPOTEK.id, dosapoteknamn: DOSAPOTEK.namn, forstadosdag: `${forsta}T00:00:00`, avvikandedosschema: false,
      Patientinformation: { fornamn: p.fornamn, efternamn: p.efternamn, ...id },
      // Adressen skickas inte för en patient med skyddade personuppgifter.
      Hemmaboendeinformation: p.skyddad ? null : { adress: p.adress ?? null, postnummer: p.postnr ?? null, ort: p.ort ?? null },
      Kontaktinformation: { PALforskrivarkod: b.forskrivarkod, PALfornamn: b.fornamn, PALefternamn: b.efternamn, vardandeenhetid: enhet.hsa_id, vardandeenhetnamn: enhet.namn },
    },
    meddelandetillapotek: 'Ny dospatient anmäld från Vårdkällan (demo).',
  };
  let svar;
  try { svar = await r3.anropa(db, DEF.skapa(), { logiskAdress: DOSAPOTEK.gln, begaran, transport: transportTill(db) }); } catch (x) {
    if (!(x instanceof r3.RivtaFel)) throw x;
    atk.logga('ordinera', atk.grund(), 'dosdispensering');
    throw new Fel(502, `Dosapoteket tog inte emot anmälan. ${x.message}`, 'motpart');
  }
  atk.logga('ordinera', atk.grund(), 'dosdispensering');
  if (svar.resultatkod === '3') throw new Fel(502, `Dosapoteket tog inte emot anmälan: ${svar.meddelandetext}`, 'motpart');
  db.query("INSERT INTO dospatienter (patient_id, enhet_id, forsta_dosdag, status, meddelande_id, anmald_av, anmald) VALUES (?, ?, ?, 'anmald', ?, ?, ?)").run(p.id, enhet.id, forsta, svar.meddelandeid, pers.id, iso());
  return { forstaDosdag: forsta, text: `Patienten är anmäld till ${DOSAPOTEK.namn}. Första dosdag är ${forsta}. Ordinationen görs i det nationella verktyget för dosdispensering.` };
}

export async function hamta(atk, p) {
  atk.krav('las_lakemedel');
  const id = identitet(p);
  if (!id) return { dospatient: false, text: 'Patienten har inget personnummer eller samordningsnummer.' };
  const pers = atk.db.query('SELECT * FROM personal WHERE id = ?').get(atk.personal.id);
  let svar;
  try { svar = await r3.anropa(atk.db, DEF.hamta(), { logiskAdress: DOSAPOTEK.gln, begaran: { glnkod: DOSAPOTEK.gln, Behorighetsinformation: behorighet(pers), ...id }, transport: transportTill(atk.db) }); } catch (x) {
    if (!(x instanceof r3.RivtaFel)) throw x;
    return { dospatient: null, text: 'Dosapoteket svarade inte.' };
  }
  atk.logga('las_lakemedel', atk.grund(), 'dosdispensering');
  const v = svar.Vardtagarinformation;
  return v ? { dospatient: true, forstaDosdag: String(v.forstadosdag).slice(0, 10), dosapotek: v.dosapoteknamn, text: `Patienten är dospatient hos ${v.dosapoteknamn}.` } : { dospatient: false, text: 'Patienten är inte dospatient.' };
}

export const kan = (personal) => kanRoll(personal, 'ordinera');
