// Runda 14, r3: utgående och inkommande meddelanden för del r3:s tjänstekontrakt, och en logg över dem.
//
// Tills den gemensamma grunden för RIVTA (src/rivta/, del r2) är inkopplad går meddelandena till de simulerade
// motparterna i samma process. Kroppen är alltid XML: den byggs ur journalens uppgifter, skrivs som text och tolkas av
// motparten, så att samma meddelande kan valideras mot schemat och skickas genom tjänsteplattformen utan att något
// annat ändras. Motparterna är simulerade och märkta som simulerade. Ingen av dem är en verklig nationell tjänst.
//
// Loggen innehåller inga patientuppgifter utöver patientens id i Vårdkällan och vårdenheten, så att den klassas och
// gallras som journalens övriga uppgifter. Kroppen sparas inte, bara dess sha256.
import { createHash } from 'node:crypto';
import { iso } from './db.js';
import { xml, tolka, XmlFel } from './rivta-r3-xml.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS rivta_r3_meddelanden (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, kontrakt TEXT NOT NULL, riktning TEXT NOT NULL, logisk_adress TEXT,
  motpart TEXT NOT NULL, patient_id TEXT, enhet_id TEXT, resultat TEXT NOT NULL, text TEXT, sha256 TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS rivta_r3_meddelande_andras_ej BEFORE UPDATE ON rivta_r3_meddelanden BEGIN SELECT RAISE(ABORT, 'En rad i meddelandeloggen ändras inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

// Motparterna per tjänstekontrakt: fn(db, kroppXml, { logiskAdress }) ger svarets XML.
const MOTPARTER = new Map();
export function registrera(kontrakt, motpart, fn) { MOTPARTER.set(kontrakt, { motpart, fn }); }
export const motpartFor = (kontrakt) => MOTPARTER.get(kontrakt)?.motpart ?? null;

// En motpart som ska meddela något efter sitt svar (till exempel intygsapplikationens statusuppdatering efter att ett
// utkast har skapats) lägger det i kön. Kön levereras när anroparen har sparat svaret, som när svaret har kommit fram
// över nätet. Kön finns bara i minnet: en händelse som går förlorad hittas av journalens egen avstämning.
const KO = new WeakMap();
export function ko(db, fn) { if (!KO.has(db)) KO.set(db, []); KO.get(db).push(fn); }
export function leverera(db) {
  const k = KO.get(db) ?? [];
  KO.delete(db);
  let n = 0;
  for (const fn of k) { try { fn(); n++; } catch (x) { console.error('Ett köat meddelande kunde inte levereras:', x.message); } }
  return n;
}

const sha = (s) => createHash('sha256').update(s).digest('hex');
export function logga(db, { kontrakt, riktning, logiskAdress = null, motpart, patientId = null, enhetId = null, resultat, text = null, kropp = '' }) {
  db.query('INSERT INTO rivta_r3_meddelanden (tid, kontrakt, riktning, logisk_adress, motpart, patient_id, enhet_id, resultat, text, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(iso(), kontrakt, riktning, logiskAdress, motpart, patientId, enhetId, resultat, text, sha(kropp));
}

// Skickar en kropp till motparten och ger svaret som tolkat träd. Ett fel hos motparten eller ett svar som inte går att
// tolka ger { fel } med en förklaring på svenska, och loggas, men kastar inte: den som anropar avgör vad felet betyder.
export function anropa(db, { kontrakt, logiskAdress, kropp, ns, patientId = null, enhetId = null }) {
  const m = MOTPARTER.get(kontrakt);
  const text = xml(kropp, ns);
  if (!m) {
    logga(db, { kontrakt, riktning: 'ut', logiskAdress, motpart: 'saknas', patientId, enhetId, resultat: 'fel', text: 'Ingen motpart', kropp: text });
    return { fel: 'Det finns ingen motpart för tjänstekontraktet.', xml: text };
  }
  let svarXml;
  try { svarXml = m.fn(db, text, { logiskAdress }); } catch (x) {
    logga(db, { kontrakt, riktning: 'ut', logiskAdress, motpart: m.motpart, patientId, enhetId, resultat: 'fel', text: String(x.message).slice(0, 200), kropp: text });
    return { fel: `${m.motpart} svarade inte: ${x.message}`, xml: text };
  }
  let svar;
  try { svar = tolka(svarXml); } catch (x) {
    logga(db, { kontrakt, riktning: 'ut', logiskAdress, motpart: m.motpart, patientId, enhetId, resultat: 'fel', text: 'Svaret gick inte att tolka', kropp: text });
    return { fel: x instanceof XmlFel ? `Svaret från ${m.motpart} gick inte att tolka: ${x.message}` : 'Svaret gick inte att tolka.', xml: text };
  }
  return { svar, xml: text, svarXml, motpart: m.motpart };
}
