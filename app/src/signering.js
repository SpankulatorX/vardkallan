// Runda 9, r5: oavvislighet vid överföring till och från andra organisationer (Sussa 5.3.1.5) med signaturer från
// instansernas certifikat (pki.js, Sussa 5.3.1.8).
//
// Ett meddelande till en annan organisation signeras av avsändaren med ECDSA P-256 och SHA-256 över ett huvud med
// meddelandets id, typ, avsändare, mottagare, tid och SHA-256 av innehållet, och har avsändarens certifikatkedja med sig.
// Mottagaren kontrollerar kedjan mot listan över betrodda utfärdare, att certifikatet gäller och inte är återkallat, att
// certifikatet är avsändarens och att signaturen och innehållets hash stämmer, och svarar med en kvittens som mottagaren
// signerar med sitt certifikat. Avsändaren kontrollerar kvittensen på samma sätt. Så kan ingen av parterna senare förneka
// att meddelandet skickades eller togs emot, eller vad det innehöll.
//
// Beviset sparas i tabellen signerade_meddelanden: huvudet, signaturen, kedjan och kvittensen, men inte innehållet, som
// finns kvar i journalen. Raderna kan inte ändras eller raderas (triggrar). Beviset kan kontrolleras när som helst: då
// räknas hashen om ur innehållet som det ser ut i journalen nu, så att ett ändrat innehåll upptäcks.
//
// Systemet är experten: allt detta sker av sig självt när meddelandet skickas eller tas emot. Ingen användare signerar,
// väljer certifikat eller behöver veta vad en kvittens är.
import { createHash, sign, verify, randomUUID } from 'node:crypto';
import * as pki from './pki.js';
import { Fel } from './db.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS signerade_meddelanden (
  id TEXT PRIMARY KEY, riktning TEXT NOT NULL, typ TEXT NOT NULL, motpart TEXT NOT NULL, kalla TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL,
  innehall_hash TEXT NOT NULL, meddelande TEXT NOT NULL, kvittens TEXT, status TEXT NOT NULL, orsak TEXT,
  CHECK (riktning IN ('ut', 'in')), CHECK (status IN ('kvitterat', 'avvisat', 'mottaget'))
);
CREATE INDEX IF NOT EXISTS signerade_kalla ON signerade_meddelanden (kalla);
CREATE TRIGGER IF NOT EXISTS signerade_andras_ej BEFORE UPDATE ON signerade_meddelanden BEGIN SELECT RAISE(ABORT, 'Ett bevis om ett signerat meddelande ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS signerade_raderas_ej BEFORE DELETE ON signerade_meddelanden BEGIN SELECT RAISE(ABORT, 'Ett bevis om ett signerat meddelande raderas inte'); END;
`;
export const sakraSchema = (db) => db.exec(SCHEMA);

export const TYPER = {
  nll: { text: 'Förskrivning till läkemedelslistan', motpart: 'nll' },
  labbsvar: { text: 'Svar från laboratoriet', motpart: 'labb' },
  earkiv: { text: 'Leverans till e-arkivet', motpart: 'earkiv' },
};

// Kanonisk JSON: nycklarna i bokstavsordning på alla nivåer, så att samma innehåll alltid ger samma hash.
export function kanonisk(v) {
  if (Array.isArray(v)) return `[${v.map(kanonisk).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${kanonisk(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
export const hash = (innehall) => createHash('sha256').update(typeof innehall === 'string' || Buffer.isBuffer(innehall) ? innehall : kanonisk(innehall)).digest('hex');

const signeraHuvud = (part, huvud) => sign('sha256', Buffer.from(kanonisk(huvud)), pki.instans(part).privat).toString('base64url');

// Avsändarens signerade meddelande. innehall är ett objekt, en text eller en Buffer.
export function signera(avsandare, { typ, mottagare, innehall, nu = new Date() }) {
  const inst = pki.instans(avsandare);
  if (!inst) throw new Error(`Okänd instans: ${avsandare}`);
  const huvud = { id: randomUUID(), typ, avsandare, mottagare, tid: nu.toISOString(), innehallHash: hash(innehall) };
  return { huvud, signatur: signeraHuvud(avsandare, huvud), kedja: inst.kedja };
}

// Kontrollerar ett signerat meddelande eller en kvittens. Ger null när allt stämmer, annars orsaken på vanlig svenska.
// avsandare är den part som ska ha signerat. innehall räknas om när det finns.
export function kontrollera(m, { avsandare, innehall, nu = new Date(), aterkallade = new Set() }) {
  if (!m?.huvud || typeof m.signatur !== 'string') return 'Meddelandet är inte signerat.';
  const k = pki.verifieraKedja(m.kedja, { nu, aterkallade });
  if (!k.ok) return k.orsak;
  if (k.part !== avsandare || m.huvud.avsandare !== avsandare) return 'Certifikatet tillhör inte avsändaren.';
  let sig;
  try { sig = Buffer.from(m.signatur, 'base64url'); } catch { return 'Signaturen går inte att läsa.'; }
  if (!verify('sha256', Buffer.from(kanonisk(m.huvud)), k.publik, sig)) return 'Signaturen stämmer inte med meddelandet.';
  if (innehall !== undefined && hash(innehall) !== m.huvud.innehallHash) return 'Innehållet har ändrats efter att meddelandet signerades.';
  return null;
}

// Mottagarens kvittens: kontrollerar meddelandet och signerar en kvittens med sitt eget certifikat. En kvittens finns
// också för ett avvisat meddelande, så att avsändaren vet varför.
// kontroll är mottagarens egen kontroll av innehållet, till exempel e-arkivets mottagningskontroll, som ger orsaken eller null.
export function kvittera(mottagare, m, innehall, { nu = new Date(), aterkallade = new Set(), kontroll = null } = {}) {
  const fel = kontrollera(m, { avsandare: m?.huvud?.avsandare, innehall, nu, aterkallade }) ?? (kontroll ? kontroll(innehall) : null);
  const huvud = { id: randomUUID(), typ: 'kvittens', avsandare: mottagare, mottagare: m?.huvud?.avsandare ?? null, tid: nu.toISOString(),
    avser: m?.huvud?.id ?? null, innehallHash: m?.huvud?.innehallHash ?? null, resultat: fel ? 'avvisat' : 'mottaget', orsak: fel };
  return { huvud, signatur: signeraHuvud(mottagare, huvud), kedja: pki.instans(mottagare).kedja };
}

const spara = (db, rad) => {
  sakraSchema(db);
  db.query(`INSERT INTO signerade_meddelanden (id, riktning, typ, motpart, kalla, enhet_id, tid, innehall_hash, meddelande, kvittens, status, orsak)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(rad.id, rad.riktning, rad.typ, rad.motpart, rad.kalla, rad.enhet_id, rad.tid, rad.innehall_hash,
    JSON.stringify(rad.meddelande), rad.kvittens ? JSON.stringify(rad.kvittens) : null, rad.status, rad.orsak ?? null);
  return rad;
};

// Skickar till en annan organisation: Vårdkällan signerar, motparten kvitterar (simulerat i samma process) och Vårdkällan
// kontrollerar kvittensen. Beviset sparas. mottagaren är en funktion för testerna, som får meddelandet och ger kvittensen.
export function skicka(db, { typ, kalla, enhetId, innehall, nu = new Date(), mottagaren = null }) {
  const t = TYPER[typ];
  const at = pki.aterkallade(db);
  const m = signera('vardkallan', { typ, mottagare: t.motpart, innehall, nu });
  const kv = mottagaren ? mottagaren(m, innehall) : kvittera(t.motpart, m, innehall, { nu, aterkallade: at });
  const felKv = kontrollera(kv, { avsandare: t.motpart, nu, aterkallade: at });
  const status = !felKv && kv.huvud.resultat === 'mottaget' && kv.huvud.avser === m.huvud.id && kv.huvud.innehallHash === m.huvud.innehallHash ? 'kvitterat' : 'avvisat';
  const orsak = status === 'kvitterat' ? null : felKv ? `Kvittensen godtogs inte: ${felKv}` : kv.huvud.orsak ?? 'Kvittensen gäller ett annat meddelande.';
  return spara(db, { id: m.huvud.id, riktning: 'ut', typ, motpart: t.motpart, kalla, enhet_id: enhetId, tid: m.huvud.tid, innehall_hash: m.huvud.innehallHash, meddelande: m, kvittens: kv, status, orsak });
}

// Tar emot från en annan organisation: kontrollerar avsändarens signatur och certifikat innan innehållet godtas. Beviset
// sparas också för ett avvisat meddelande. Ger { godkant, orsak, bevis }.
export function taEmot(db, { typ, kalla, enhetId, meddelande, innehall, nu = new Date() }) {
  const t = TYPER[typ];
  const fel = kontrollera(meddelande, { avsandare: t.motpart, innehall, nu, aterkallade: pki.aterkallade(db) });
  // Beviset får ett eget id. Meddelandets id finns i huvudet, och ett meddelande som kommer två gånger sparas två gånger.
  const rad = spara(db, { id: randomUUID(), riktning: 'in', typ, motpart: t.motpart, kalla, enhet_id: enhetId, tid: nu.toISOString(), innehall_hash: hash(innehall),
    meddelande: meddelande ?? {}, kvittens: null, status: fel ? 'avvisat' : 'mottaget', orsak: fel });
  return { godkant: !fel, orsak: fel, bevis: rad.id };
}

// Kontrollerar ett sparat bevis i efterhand. innehallNu är innehållet som det ser ut i journalen nu, eller undefined när
// det inte finns kvar (till exempel efter gallring). Certifikaten prövas vid tiden för meddelandet.
export function kontrolleraBevis(db, id, innehallNu) {
  sakraSchema(db);
  const r = db.query('SELECT * FROM signerade_meddelanden WHERE id = ?').get(id);
  if (!r) throw new Fel(404, 'Beviset finns inte.', 'saknas');
  const m = JSON.parse(r.meddelande);
  const vid = new Date(r.tid);
  const avs = r.riktning === 'ut' ? 'vardkallan' : r.motpart;
  const signatur = kontrollera(m, { avsandare: avs, nu: vid });
  const kvittens = r.kvittens ? kontrollera(JSON.parse(r.kvittens), { avsandare: r.motpart, nu: vid }) : null;
  const innehall = innehallNu === undefined ? null : hash(innehallNu) === r.innehall_hash ? null : 'Innehållet i journalen stämmer inte längre med det som signerades.';
  return { id: r.id, status: r.status, signatur: signatur ?? 'Signaturen och certifikatet stämmer.', kvittens: r.kvittens ? kvittens ?? 'Kvittensen är signerad av mottagaren och stämmer.' : null,
    innehall: innehallNu === undefined ? 'Innehållet finns inte kvar i journalen.' : innehall ?? 'Innehållet är detsamma som när det signerades.', hel: !signatur && !kvittens && !innehall };
}

// Bevisen för en källa, för gränssnittet.
export function forKalla(db, kalla) {
  sakraSchema(db);
  return db.query('SELECT id, riktning, typ, motpart, tid, status, orsak FROM signerade_meddelanden WHERE kalla = ? ORDER BY tid').all(kalla)
    .map(r => ({ id: r.id, riktning: r.riktning, typText: TYPER[r.typ]?.text ?? r.typ, motpart: pki.PARTER[r.motpart]?.namn ?? r.motpart, tid: r.tid, status: r.status, orsak: r.orsak }));
}

// Översikten för systemförvaltaren, utan innehåll och utan patientuppgifter: antal per typ och status och de senaste.
export function oversikt(db) {
  sakraSchema(db);
  const per = db.query('SELECT typ, riktning, status, count(*) AS n FROM signerade_meddelanden GROUP BY typ, riktning, status').all()
    .map(r => ({ typText: TYPER[r.typ]?.text ?? r.typ, riktning: r.riktning, status: r.status, antal: r.n }));
  const senaste = db.query('SELECT id, typ, riktning, motpart, tid, status, orsak FROM signerade_meddelanden ORDER BY tid DESC LIMIT 20').all()
    .map(r => ({ id: r.id, typText: TYPER[r.typ]?.text ?? r.typ, riktning: r.riktning, motpart: pki.PARTER[r.motpart]?.namn ?? r.motpart, tid: r.tid, status: r.status, orsak: r.orsak }));
  return { per, senaste };
}
