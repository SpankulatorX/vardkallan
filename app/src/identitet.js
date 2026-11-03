// Patientens identitet (Sussa 3.1.1): personnummer, samordningsnummer, reservnummer och annan identitet med OID, och
// sammanslagning av tidigare identiteter med den senast gällande.
//
// Systemet är experten. Användaren skriver eller klistrar in ett nummer i vilket format som helst, och tolka() avgör
// själv vilken typ det är: kontrollsiffran, födelsedatumet (dag plus 60 för samordningsnummer), sekelsiffrorna och
// plustecknet för den som fyllt 100, reservnumrets format och en OID med ett nummer efter. Är något fel säger
// systemet vad på vanlig svenska. Användaren väljer aldrig typ ur en lista.
//
// Reservnumret är påhittat för demon: VK, födelsedatumet med åtta siffror, ett löpnummer med tre siffror (den sista
// udda för man och jämn för kvinna, som i personnumret) och en kontrollsiffra enligt samma algoritm som personnumret.
// OID-roten 1.3.6.1.4.1.32473 är IANA:s nummer för dokumentation och exempel (RFC 5612) och tillhör ingen
// verklig organisation. Vårdkällan använder grenen 1.3.6.1.4.1.32473.1 i demon, se docs/design.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Fel } from './db.js';
import { loggaRad } from './logg.js';

export const OID_ROT = '1.3.6.1.4.1.32473.1';
export const OID_RESERVNUMMER = `${OID_ROT}.1`;
// Ett påhittat utländskt id-system i demon, för patienten som identifieras med en annan identitet med OID.
export const OID_DEMO_UTLANDSK = `${OID_ROT}.2`;
// De nationella OID:erna för personnummer och samordningsnummer. Ett nummer som klistras in med dem känns igen.
export const OID_PERSONNUMMER = '1.2.752.129.2.1.3.1';
export const OID_SAMORDNINGSNUMMER = '1.2.752.129.2.1.3.3';

// HL7 Swedens basprofil (hl7se.fhir.base 1.1.0, SEBasePatient) har systemen för personnummer och samordningsnummer.
export const FHIR_SYSTEM = {
  personnummer: 'http://electronichealth.se/identifier/personnummer',
  samordningsnummer: 'http://electronichealth.se/identifier/samordningsnummer',
  reservnummer: `urn:oid:${OID_RESERVNUMMER}`,
};
// Kända id-system för OID-identiteter. Okända OID:er går också att använda; då visas bara OID:n.
export const OID_NAMN = { [OID_DEMO_UTLANDSK]: 'Påhittat utländskt id-system (demo)', [OID_RESERVNUMMER]: 'Vårdkällans reservnummer (demo)' };

// rang avgör vilken identitet som är den gällande när två journaler slås samman: den med högst rang.
export const TYPER = {
  personnummer: { text: 'Personnummer', rang: 4 },
  samordningsnummer: { text: 'Samordningsnummer', rang: 3 },
  oid: { text: 'Annan identitet (OID)', rang: 2 },
  reservnummer: { text: 'Reservnummer', rang: 1 },
};

// Skatteverkets testpersonnummer (kopia av research/testpersonnummer.json). I demon går bara de att registrera.
let testpnr = null;
const testpersonnummer = () => (testpnr ??= new Set(JSON.parse(readFileSync(join(import.meta.dir, 'seed', 'testpersonnummer.json'), 'utf8'))));
// Skatteverkets testsamordningsnummer (öppna data, datamängden Testsamordningsnummer, hämtad 2026-11-03).
let testsamnr;
const testsamordningsnummer = () => (testsamnr ??= new Set(JSON.parse(readFileSync(join(import.meta.dir, 'seed', 'testsamordningsnummer.json'), 'utf8'))));

// Kontrollsiffran enligt Luhn-algoritmen (modulus 10), som för personnummer: varannan siffra från höger dubbleras.
export function kontrollsiffra(siffror) {
  let summa = 0;
  for (let i = 0; i < siffror.length; i++) {
    let v = Number(siffror[siffror.length - 1 - i]) * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    summa += v;
  }
  return String((10 - (summa % 10)) % 10);
}

const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const datumText = (d) => `${Number(d.slice(8, 10))} ${MANADER[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const giltigtDatum = (y, m, d) => {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const konAvSiffra = (s) => (Number(s) % 2 === 1 ? 'man' : 'kvinna');
const idagSv = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

// Visning: personnummer och samordningsnummer som ÅÅÅÅMMDD-NNNN, reservnummer som VKÅÅÅÅMMDD-NNNN och en OID-identitet
// som numret följt av OID:n. Masken för skyddad identitet visar bara födelsedatumet.
export function formatera(typ, varde) {
  if (typ === 'reservnummer') return `${varde.slice(0, 10)}-${varde.slice(10)}`;
  if (typ === 'oid') { const { rot, nummer } = delaOid(varde); return `${nummer} (OID ${rot})`; }
  return `${varde.slice(0, 8)}-${varde.slice(8)}`;
}
export function maskera(typ, varde) {
  if (typ === 'reservnummer') return `${varde.slice(0, 10)}-****`;
  if (typ === 'oid') return '****';
  return `${varde.slice(0, 8)}-****`;
}
// En OID-identitet lagras som urn:oid:<rot>|<nummer>, samma form som en sökparameter i FHIR.
export const oidVarde = (rot, nummer) => `urn:oid:${rot}|${nummer}`;
export function delaOid(varde) {
  const [rot, ...rest] = varde.replace(/^urn:oid:/, '').split('|');
  return { rot, nummer: rest.join('|') };
}

function beskriv(t) {
  const vem = t.kon ? `${t.kon === 'man' ? 'Man' : 'Kvinna'}, född ${datumText(t.fodd)}` : null;
  if (t.typ === 'oid') return `${TYPER.oid.text}: ${t.nummer} i id-systemet ${OID_NAMN[t.rot] ?? t.rot}.`;
  return `${TYPER[t.typ].text}${t.typ === 'samordningsnummer' ? ' (dagen i födelsedatumet är plus 60)' : ''}. ${vem}.`;
}

const fel = (text, typ = null) => ({ ok: false, arIdentitet: true, typ, fel: text });
const lyckad = (t) => ({ ok: true, arIdentitet: true, ...t, typText: TYPER[t.typ].text, visning: formatera(t.typ, t.varde), beskrivning: beskriv(t) });

// Personnummer och samordningsnummer med 10 eller 12 siffror. plus: numret skrevs med + (personen har fyllt 100).
function tolkaSiffror(siffror, plus, idag, forvantad = null) {
  if (siffror.length !== 10 && siffror.length !== 12) {
    return fel(`Ett personnummer eller samordningsnummer har 10 eller 12 siffror. Numret har ${siffror.length} siffror.`);
  }
  const tio = siffror.slice(-10);
  let ar;
  const yy = Number(tio.slice(0, 2));
  const iar = Number(idag.slice(0, 4));
  if (siffror.length === 12) ar = Number(siffror.slice(0, 4));
  else {
    // Tio siffror: det senaste sekel som inte ger ett födelseår i framtiden, och ett sekel tidigare med plustecken.
    ar = Math.floor(iar / 100) * 100 + yy;
    if (ar > iar) ar -= 100;
    if (plus) ar -= 100;
  }
  const manad = Number(tio.slice(2, 4));
  let dag = Number(tio.slice(4, 6));
  let typ = 'personnummer';
  if (dag > 60) { typ = 'samordningsnummer'; dag -= 60; }
  if (forvantad && forvantad !== typ) {
    return fel(forvantad === 'samordningsnummer'
      ? 'Numret kom med samordningsnumrets id-system, men dagen i födelsedatumet är inte plus 60. Kontrollera numret.'
      : 'Numret kom med personnumrets id-system, men dagen i födelsedatumet är plus 60 som i ett samordningsnummer. Kontrollera numret.', forvantad);
  }
  const namn = typ === 'personnummer' ? 'personnumret' : 'samordningsnumret';
  if (manad < 1 || manad > 12) return fel(`Månaden i ${namn} är ${tio.slice(2, 4)}. Den ska vara 01 till 12.`, typ);
  if (!giltigtDatum(ar, manad, dag)) {
    return fel(typ === 'samordningsnummer'
      ? `Dagen i samordningsnumret är ${tio.slice(4, 6)}, alltså dag ${dag} när 60 dras av. Den dagen finns inte i ${MANADER[manad - 1]}.`
      : `Dagen i personnumret är ${tio.slice(4, 6)}. Den dagen finns inte i ${MANADER[manad - 1]}. Ett samordningsnummer har dag 61 till 91.`, typ);
  }
  const fodd = `${String(ar).padStart(4, '0')}-${String(manad).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
  if (fodd > idag) return fel(`Födelsedatumet i ${namn} (${datumText(fodd)}) ligger i framtiden.`, typ);
  if (kontrollsiffra(tio.slice(0, 9)) !== tio[9]) {
    return fel(`Kontrollsiffran stämmer inte. Den sista siffran räknas fram ur de andra, så någon siffra i ${namn} är troligen fel skriven.`, typ);
  }
  return lyckad({ typ, varde: `${String(ar).padStart(4, '0')}${tio.slice(2)}`, fodd, kon: konAvSiffra(tio[8]) });
}

function tolkaReservnummer(text) {
  const rest = text.replace(/^vk/i, '');
  if (!/^\d+$/.test(rest) || rest.length !== 12) {
    return fel('Ett reservnummer i Vårdkällan är VK följt av födelsedatumet med åtta siffror och fyra siffror till, som VKÅÅÅÅMMDD-NNNN. Kontrollera numret.', 'reservnummer');
  }
  const [ar, manad, dag] = [Number(rest.slice(0, 4)), Number(rest.slice(4, 6)), Number(rest.slice(6, 8))];
  if (!giltigtDatum(ar, manad, dag)) return fel('Datumet i reservnumret finns inte. De första åtta siffrorna efter VK är födelsedatumet.', 'reservnummer');
  if (kontrollsiffra(rest.slice(0, 11)) !== rest[11]) {
    return fel('Kontrollsiffran i reservnumret stämmer inte. Någon siffra är troligen fel skriven.', 'reservnummer');
  }
  return lyckad({ typ: 'reservnummer', varde: `VK${rest}`, fodd: `${rest.slice(0, 4)}-${rest.slice(4, 6)}-${rest.slice(6, 8)}`, kon: konAvSiffra(rest[10]) });
}

const OID_MONSTER = /^(?:urn:oid:)?([0-2](?:\.(?:0|[1-9]\d*)){2,})(?:\s*[|:#/\s^]\s*(.*))?$/i;
const SYSTEM_MONSTER = /^(https?:\/\/electronichealth\.se\/identifier\/(personnummer|samordningsnummer))\s*\|\s*(.*)$/i;

// Tolkar ett inskrivet eller inklistrat nummer. Returnerar
//   { ok: true, typ, typText, varde, visning, fodd, kon, beskrivning }   (fodd och kon saknas för OID)
//   { ok: false, arIdentitet: true, typ, fel }                            numret är en identitet men något är fel
//   { ok: false, arIdentitet: false }                                     texten är inget nummer, till exempel ett namn
export function tolka(text, { idag = idagSv() } = {}) {
  const s = String(text ?? '').trim().replace(/[‐-―−]/g, '-');
  if (!s) return fel('Skriv ett nummer.');
  const sys = s.match(SYSTEM_MONSTER);
  if (sys) {
    const t = tolka(sys[3], { idag });
    if (t.ok && t.typ !== sys[2].toLowerCase()) return tolkaSiffror(t.varde, false, idag, sys[2].toLowerCase());
    return t;
  }
  const oid = s.match(OID_MONSTER);
  if (oid && (s.toLowerCase().startsWith('urn:oid:') || oid[1].split('.').length >= 4)) {
    const rot = oid[1];
    const nummer = (oid[2] ?? '').trim();
    if (!nummer) return fel(`Det saknas ett nummer efter OID:n ${rot}. Skriv OID:n och sedan numret, till exempel ${OID_DEMO_UTLANDSK} UT-4471-0921.`, 'oid');
    if (rot === OID_PERSONNUMMER || rot === OID_SAMORDNINGSNUMMER) {
      const t = tolka(nummer, { idag });
      const vantad = rot === OID_PERSONNUMMER ? 'personnummer' : 'samordningsnummer';
      if (t.ok && t.typ !== vantad) return tolkaSiffror(t.varde, false, idag, vantad);
      return t;
    }
    if (rot === OID_RESERVNUMMER) return tolkaReservnummer(nummer.replace(/[\s-]/g, ''));
    if (!/^[A-Za-z0-9][A-Za-z0-9.\- ]{0,38}[A-Za-z0-9]$|^[A-Za-z0-9]$/.test(nummer)) {
      return fel('Numret efter OID:n får bara innehålla bokstäver, siffror, punkt och bindestreck, högst 40 tecken.', 'oid');
    }
    const n = nummer.replace(/\s+/g, '');
    return lyckad({ typ: 'oid', varde: oidVarde(rot, n), rot, nummer: n, fodd: null, kon: null });
  }
  const kompakt = s.replace(/[\s-]/g, '');
  if (/^vk/i.test(kompakt)) return tolkaReservnummer(kompakt);
  if (/^[\d+]+$/.test(kompakt) && /\d/.test(kompakt)) {
    const plus = kompakt.includes('+');
    if ((kompakt.match(/\+/g) ?? []).length > 1) return fel('Numret har mer än ett plustecken. Plustecknet skrivs bara före de fyra sista siffrorna, för den som har fyllt 100 år.');
    const siffror = kompakt.replace('+', '');
    if (plus && siffror.length !== 10) return fel('Plustecknet används bara med tio siffror, för den som har fyllt 100 år. Med tolv siffror behövs det inte.');
    return tolkaSiffror(siffror, plus, idag);
  }
  if (/^\d[\d.]*\.\d/.test(s)) return fel('Det ser ut som en OID, men den har för få delar. En OID har minst fyra tal med punkt mellan, till exempel 1.2.752.129.', 'oid');
  return { ok: false, arIdentitet: false };
}

// Det som inte får registreras i demon, eller null. Personnummer och samordningsnummer bara från Skatteverkets
// testpersonnummer och testsamordningsnummer, så att inget nummer i demon kan tillhöra en verklig person.
export function demoKontroll(t) {
  if (!t?.ok) return null;
  if (t.typ === 'personnummer' && !testpersonnummer().has(t.varde)) {
    return 'Numret är ett giltigt personnummer men inte ett av Skatteverkets testpersonnummer. I demon går bara testpersonnummer att använda, så att inga riktiga personnummer hamnar här.';
  }
  if (t.typ === 'samordningsnummer' && !testsamordningsnummer().has(t.varde)) {
    return 'Numret är ett giltigt samordningsnummer men inte ett av Skatteverkets testsamordningsnummer. I demon går bara testsamordningsnummer att använda, så att inga riktiga samordningsnummer hamnar här.';
  }
  return null;
}

// Nytt reservnummer: VK, födelsedatumet och ett ledigt löpnummer med rätt könssiffra, och kontrollsiffran.
export function nyttReservnummer(db, { fodd, kon }) {
  const datum = fodd.replace(/-/g, '');
  for (let n = 1; n < 1000; n++) {
    if (konAvSiffra(String(n % 10)) !== kon) continue;
    const borjan = `${datum}${String(n).padStart(3, '0')}`;
    const varde = `VK${borjan}${kontrollsiffra(borjan)}`;
    if (!db.query("SELECT 1 FROM identiteter WHERE typ = 'reservnummer' AND varde = ?").get(varde)) return varde;
  }
  throw new Fel(409, 'Det finns inga lediga reservnummer för det födelsedatumet.', 'ogiltig');
}

// Schemat. IF NOT EXISTS, så att det också kan läggas till i en sandlåda som sparades före identiteterna.
//   identiteter       varje identitet patienten har haft. status: gallande (en per patient), tidigare eller ovrig
//                     (en extra identitet, till exempel en utländsk, bredvid den gällande). ursprung är journalen där
//                     identiteten först fanns, så att historiken visar var den kom ifrån efter en sammanslagning.
//   sammanslagningar  vilka journaler som slogs samman, av vem, varför och vilka uppgifter som flyttades. Ändras aldrig.
//   dubblettforslag   ett förslag om sammanslagning som systemet har hittat, eller en kollision när någon skrev in ett
//                     nummer som redan tillhör en annan journal. status: oppen, genomford eller avfardad.
export const SCHEMA_IDENTITET = `
CREATE TABLE IF NOT EXISTS identiteter (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, typ TEXT NOT NULL, varde TEXT NOT NULL, status TEXT NOT NULL,
  fran TEXT NOT NULL, till TEXT, orsak TEXT, av TEXT, ursprung TEXT NOT NULL,
  UNIQUE (typ, varde), CHECK (status IN ('gallande', 'tidigare', 'ovrig'))
);
CREATE INDEX IF NOT EXISTS ix_identitet_patient ON identiteter (patient_id);
CREATE TABLE IF NOT EXISTS sammanslagningar (
  id INTEGER PRIMARY KEY, fran_patient_id TEXT NOT NULL, till_patient_id TEXT NOT NULL, tid TEXT NOT NULL,
  personal_id TEXT NOT NULL, enhet_id TEXT, grund TEXT NOT NULL, flyttade TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dubblettforslag (
  id INTEGER PRIMARY KEY, fran_patient_id TEXT NOT NULL, till_patient_id TEXT NOT NULL, grund TEXT NOT NULL,
  skapad TEXT NOT NULL, av TEXT, status TEXT NOT NULL DEFAULT 'oppen', avgjord TEXT, avgjord_av TEXT
);
CREATE TRIGGER IF NOT EXISTS sammanslagning_andras_ej BEFORE UPDATE ON sammanslagningar
  BEGIN SELECT RAISE(ABORT, 'En sammanslagning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS sammanslagning_raderas_ej BEFORE DELETE ON sammanslagningar
  BEGIN SELECT RAISE(ABORT, 'En sammanslagning raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS identitet_raderas_ej BEFORE DELETE ON identiteter
  BEGIN SELECT RAISE(ABORT, 'En identitet raderas inte, den blir en tidigare identitet'); END;
`;

// Lägger till schemat och kolumnerna i patienter, och ger varje patient som saknar identitet sin gällande identitet.
export function sakraIdentitetsschema(db, tid = new Date().toISOString()) {
  const kol = db.query('PRAGMA table_info(patienter)').all().map(k => k.name);
  if (!kol.includes('id_typ')) db.exec("ALTER TABLE patienter ADD COLUMN id_typ TEXT NOT NULL DEFAULT 'personnummer'");
  if (!kol.includes('sammanslagen_till')) db.exec('ALTER TABLE patienter ADD COLUMN sammanslagen_till TEXT');
  db.exec(SCHEMA_IDENTITET);
  // En signerad anteckning ändras aldrig. Vid en sammanslagning flyttas den ändå till den gällande journalen. Triggern
  // släpper bara igenom att patient_id ändras, och bara medan slaSamman flyttar just de två journalerna (raden
  // sammanslagning_pagar i installningar). Alla andra kolumner ska vara oförändrade.
  const t = db.query("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'anteckning_signerad_andras_ej'").get();
  if (t && !/sammanslagning_pagar/.test(t.sql)) {
    const lika = db.query('PRAGMA table_info(anteckningar)').all().map(k => k.name).filter(k => k !== 'patient_id').map(k => `NEW.${k} IS OLD.${k}`).join(' AND ');
    db.exec('DROP TRIGGER anteckning_signerad_andras_ej');
    db.exec(`CREATE TRIGGER anteckning_signerad_andras_ej BEFORE UPDATE ON anteckningar WHEN OLD.status = 'signerad' AND NOT (
        NEW.patient_id IS NOT OLD.patient_id AND ${lika}
        AND EXISTS (SELECT 1 FROM installningar WHERE nyckel = 'sammanslagning_pagar' AND varde = OLD.patient_id || '>' || NEW.patient_id))
      BEGIN SELECT RAISE(ABORT, 'En signerad anteckning kan inte ändras'); END`);
  }
  const ins = db.query('INSERT INTO identiteter (patient_id, typ, varde, status, fran, ursprung) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of db.query('SELECT * FROM patienter WHERE id NOT IN (SELECT patient_id FROM identiteter) AND sammanslagen_till IS NULL').all()) {
    ins.run(p.id, p.id_typ, p.personnummer, 'gallande', tid, p.id);
  }
}

// Seedens identitet för en patient: personnummer (pnr), samordningsnummer (samnr), reservnummer eller OID.
export function seedIdentitet(p) {
  if (p.pnr) return { typ: 'personnummer', varde: p.pnr, fodd: `${p.pnr.slice(0, 4)}-${p.pnr.slice(4, 6)}-${p.pnr.slice(6, 8)}`, kon: konAvSiffra(p.pnr[10]) };
  const t = p.samnr ? tolka(p.samnr) : p.reservnummer ? tolka(p.reservnummer) : tolka(`${p.oid.rot} ${p.oid.nummer}`);
  if (!t.ok) throw new Error(`Ogiltig identitet i seeden för ${p.id}: ${t.fel}`);
  return { typ: t.typ, varde: t.varde, fodd: t.fodd ?? p.fodd, kon: t.kon ?? p.kon };
}

// Följer en sammanslagning till den gällande journalen.
export function gallandeId(db, id) {
  let nu = id;
  for (let i = 0; i < 10; i++) {
    const r = db.query('SELECT sammanslagen_till FROM patienter WHERE id = ?').get(nu);
    if (!r?.sammanslagen_till) return nu;
    nu = r.sammanslagen_till;
  }
  return nu;
}
// Patienten och alla journaler som har slagits samman med den. Loggen ändras aldrig, så åtkomster som loggades på en
// tidigare journal hämtas med dess id.
export function allaPatientIdn(db, id) {
  return [id, ...db.query('SELECT id FROM patienter WHERE sammanslagen_till = ? ORDER BY id').all(id).map(r => r.id)];
}

// Söker en patient på en tolkad identitet, också tidigare identiteter. Returnerar { patientId, identitet } eller null.
export function hittaPaIdentitet(db, t) {
  if (!t?.ok) return null;
  const r = db.query('SELECT * FROM identiteter WHERE typ = ? AND varde = ?').get(t.typ, t.varde);
  if (!r) return null;
  return { patientId: gallandeId(db, r.patient_id), identitet: r };
}

// Söker på en FHIR-token (system|värde eller bara värde). Returnerar patientens id eller null.
export function hittaPaToken(db, token) {
  const s = String(token ?? '');
  let t;
  if (s.includes('|')) {
    const [system, ...rest] = s.split('|');
    const varde = rest.join('|');
    if (system === FHIR_SYSTEM.personnummer || system === FHIR_SYSTEM.samordningsnummer) {
      t = tolka(`${system}|${varde}`);
    } else if (system.startsWith('urn:oid:')) t = tolka(`${system} ${varde}`);
    else return null;
  } else t = tolka(s);
  return hittaPaIdentitet(db, t)?.patientId ?? null;
}

const identitetUt = (db, r, visad) => ({
  id: r.id, typ: r.typ, typText: TYPER[r.typ].text, status: r.status, visning: visad ? formatera(r.typ, r.varde) : maskera(r.typ, r.varde),
  system: r.typ === 'oid' ? delaOid(r.varde).rot : null, systemNamn: r.typ === 'oid' ? OID_NAMN[delaOid(r.varde).rot] ?? null : null,
  fran: r.fran, till: r.till, orsak: r.orsak, franAnnanJournal: r.ursprung !== r.patient_id,
});

// Alla identiteter, den gällande först.
export function identiteterFor(db, patientId) {
  const ordning = { gallande: 0, ovrig: 1, tidigare: 2 };
  return db.query('SELECT * FROM identiteter WHERE patient_id = ? ORDER BY id').all(patientId)
    .sort((a, b) => ordning[a.status] - ordning[b.status] || String(b.fran).localeCompare(String(a.fran)));
}
export const identiteterUt = (db, patientId, visad) => identiteterFor(db, patientId).map(r => identitetUt(db, r, visad));

const sv = (s) => String(s ?? '').toLocaleLowerCase('sv-SE').trim();
const namnet = (p) => `${sv(p.fornamn)} ${sv(p.efternamn)}`;

// Troliga dubbletter till en patient. Systemet letar själv: samma namn, födelsedatum och kön när minst en av
// journalerna saknar personnummer (två olika personnummer är två olika personer), och de kollisioner som har
// registrerats när någon skrev in ett nummer som redan fanns. En patient med skyddad identitet föreslås aldrig på namn,
// bara när någon har skrivit in hela numret. Avfärdade förslag kommer inte tillbaka.
// Returnerar [{ annan, fran, till, grund, forslagId }] där till är den journal som blir kvar.
export function dubbletterFor(db, patientId) {
  const p = db.query('SELECT rowid AS rad, * FROM patienter WHERE id = ?').get(patientId);
  if (!p || p.sammanslagen_till) return [];
  const avgjorda = new Set(db.query("SELECT fran_patient_id || '>' || till_patient_id AS k FROM dubblettforslag WHERE status = 'avfardad'").all().map(r => r.k));
  const avfardad = (a, b) => avgjorda.has(`${a}>${b}`) || avgjorda.has(`${b}>${a}`);
  const ut = new Map();
  for (const f of db.query("SELECT * FROM dubblettforslag WHERE status = 'oppen' AND (fran_patient_id = ?1 OR till_patient_id = ?1)").all(patientId)) {
    const annan = f.fran_patient_id === patientId ? f.till_patient_id : f.fran_patient_id;
    const ap = db.query('SELECT * FROM patienter WHERE id = ?').get(annan);
    if (!ap || ap.sammanslagen_till) continue;
    ut.set(annan, { annan, fran: f.fran_patient_id, till: f.till_patient_id, grund: f.grund, forslagId: f.id });
  }
  if (!p.skyddad) {
    for (const ap of db.query('SELECT rowid AS rad, * FROM patienter WHERE id <> ? AND sammanslagen_till IS NULL AND skyddad = 0 AND fodd = ? AND kon = ?').all(p.id, p.fodd, p.kon)) {
      if (ut.has(ap.id) || namnet(ap) !== namnet(p) || avfardad(p.id, ap.id)) continue;
      if (p.id_typ === 'personnummer' && ap.id_typ === 'personnummer') continue;
      const [fran, till] = ordnaPar(p, ap);
      ut.set(ap.id, { annan: ap.id, fran: fran.id, till: till.id, grund: 'samma_namn_fodd', forslagId: null });
    }
  }
  return [...ut.values()];
}
// Den journal som blir kvar är den med den mest gällande identiteten (personnummer före samordningsnummer, OID och
// reservnummer). Vid lika den som skapades först.
function ordnaPar(a, b) {
  const ra = TYPER[a.id_typ].rang;
  const rb = TYPER[b.id_typ].rang;
  if (ra !== rb) return ra > rb ? [b, a] : [a, b];
  return a.rad <= b.rad ? [b, a] : [a, b];
}

export const GRUNDTEXT = {
  samma_namn_fodd: 'Samma namn, födelsedatum och kön, och minst en av journalerna saknar personnummer.',
  samma_nummer: 'Numret som skrevs in tillhör redan den andra journalen.',
};

// Tabeller med patient_id som följer med vid en sammanslagning. Alla tabeller med kolumnen tas med, också sådana som
// läggs till senare, utom loggen (som aldrig ändras) och identitetens egna tabeller.
const UTAN = new Set(['atkomstlogg', 'identiteter', 'sammanslagningar', 'dubblettforslag', 'patienter']);
function patientTabeller(db) {
  return db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name)
    .filter(t => !UTAN.has(t) && db.query(`PRAGMA table_info(${t})`).all().some(k => k.name === 'patient_id'));
}

// Slår samman journalen fran med till, som blir kvar med den gällande identiteten. All journalinformation, spärrar,
// vårdrelationer (vårdkontakter, listning och remisser) och Min journal följer med. Den gamla journalen finns kvar
// som historik och pekar på den gällande, och dess identitet blir en tidigare identitet som går att söka på. Skyddad
// identitet följer med: är någon av journalerna skyddad blir den sammanslagna det. Åtkomstloggen ändras inte, men
// logglistan visar raderna för båda journalerna. Allt sker i en transaktion, och sammanslagningen loggas på båda.
export function slaSamman(db, { fran, till, personal, grund, tid = new Date().toISOString(), loggGrund = 'administrativ' }) {
  const a = db.query('SELECT * FROM patienter WHERE id = ?').get(fran);
  const b = db.query('SELECT * FROM patienter WHERE id = ?').get(till);
  if (!a || !b) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  if (a.sammanslagen_till || b.sammanslagen_till) throw new Fel(409, 'Journalen är redan sammanslagen.', 'ogiltig');
  const flyttade = {};
  db.transaction(() => {
    db.query("INSERT OR REPLACE INTO installningar VALUES ('sammanslagning_pagar', ?)").run(`${fran}>${till}`);
    for (const t of patientTabeller(db)) {
      const har = db.query(`PRAGMA table_info(${t})`).all().some(k => k.name === 'id');
      const rader = db.query(`SELECT ${har ? 'id' : 'rowid'} AS id FROM ${t} WHERE patient_id = ?`).all(fran).map(r => r.id);
      if (!rader.length) continue;
      if (t === 'listningar') {
        // En patient är listad på en vårdcentral. Den gällande journalens listning gäller, annars följer den andra med.
        if (db.query('SELECT 1 FROM listningar WHERE patient_id = ?').get(till)) {
          flyttade.listningar_ersatta = db.query('SELECT enhet_id, fran FROM listningar WHERE patient_id = ?').all(fran);
          db.query('DELETE FROM listningar WHERE patient_id = ?').run(fran);
          continue;
        }
      }
      // Rader som aldrig får ändras (givna doser, beslut, historik) skyddas av triggrar. De som inte själva släpper
      // igenom sammanslagningen (sammanslagning_pagar) tas bort under flytten och läggs tillbaka med exakt samma
      // definition i samma transaktion. Bara patient_id ändras.
      const skydd = db.query("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? AND sql LIKE '%UPDATE%' AND sql NOT LIKE '%sammanslagning_pagar%'").all(t);
      for (const x of skydd) db.exec(`DROP TRIGGER "${x.name}"`);
      try {
        db.query(`UPDATE ${t} SET patient_id = ? WHERE patient_id = ?`).run(till, fran);
      } finally {
        for (const x of skydd) db.exec(x.sql);
      }
      flyttade[t] = rader;
    }
    if (db.query("SELECT 1 FROM sqlite_master WHERE name = 'vardnadshavare'").get()) {
      db.query('UPDATE OR IGNORE vardnadshavare SET barn_id = ? WHERE barn_id = ?').run(till, fran);
      db.query('DELETE FROM vardnadshavare WHERE barn_id = ?').run(fran);
    }
    db.query("UPDATE identiteter SET patient_id = ?, status = CASE status WHEN 'gallande' THEN 'tidigare' ELSE status END, till = CASE status WHEN 'gallande' THEN ? ELSE till END, orsak = CASE status WHEN 'gallande' THEN 'sammanslagen' ELSE orsak END WHERE patient_id = ?")
      .run(till, tid, fran);
    const fyll = ['adress', 'postnr', 'ort', 'telefon', 'kontaktperson'].filter(k => b[k] == null && a[k] != null);
    for (const k of fyll) db.query(`UPDATE patienter SET ${k} = ? WHERE id = ?`).run(a[k], till);
    if (a.skyddad && !b.skyddad) db.query('UPDATE patienter SET skyddad = 1 WHERE id = ?').run(till);
    db.query('UPDATE patienter SET sammanslagen_till = ? WHERE id = ? OR sammanslagen_till = ?').run(till, fran, fran);
    db.query("UPDATE dubblettforslag SET status = 'genomford', avgjord = ?, avgjord_av = ? WHERE status = 'oppen' AND ((fran_patient_id = ?3 AND till_patient_id = ?4) OR (fran_patient_id = ?4 AND till_patient_id = ?3))")
      .run(tid, personal.id, fran, till);
    db.query('INSERT INTO sammanslagningar (fran_patient_id, till_patient_id, tid, personal_id, enhet_id, grund, flyttade) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(fran, till, tid, personal.id, personal.enhet_id, grund, JSON.stringify(flyttade));
    for (const pid of [fran, till]) {
      loggaRad(db, { tid, personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: 'sla_samman', resurs: `sammanslagning:${fran}>${till}`, grund: loggGrund });
    }
    db.query("DELETE FROM installningar WHERE nyckel = 'sammanslagning_pagar'").run();
  })();
  const antal = Object.entries(flyttade).filter(([k]) => k !== 'listningar_ersatta').reduce((s, [, v]) => s + v.length, 0);
  return { fran, till, antal, flyttade };
}

export function sammanslagningarFor(db, patientId) {
  return db.query('SELECT s.*, p.namn AS personal_namn FROM sammanslagningar s LEFT JOIN personal p ON p.id = s.personal_id WHERE s.till_patient_id = ? OR s.fran_patient_id = ? ORDER BY s.id')
    .all(patientId, patientId).map(s => {
      const f = JSON.parse(s.flyttade);
      const antal = Object.entries(f).filter(([k]) => k !== 'listningar_ersatta').reduce((n, [, v]) => n + v.length, 0);
      return { id: s.id, fran: s.fran_patient_id, till: s.till_patient_id, tid: s.tid, av: s.personal_namn, grund: s.grund, grundText: GRUNDTEXT[s.grund] ?? s.grund, antal };
    });
}

// Ny identitet för en patient. Ett nummer med samma eller högre rang än det gällande blir det gällande, och det gamla
// blir en tidigare identitet. Ett nummer med lägre rang läggs till bredvid. Personnummer och samordningsnummer ger
// födelsedatum och kön. Tillhör numret redan en annan journal blir det ett förslag om sammanslagning i stället.
// Returnerar { utfall: 'bytt' | 'tillagd' | 'samma' } eller kastar Fel 409 med kod dubblett.
export function nyIdentitet(db, p, t, { personal, tid = new Date().toISOString() }) {
  const finns = hittaPaIdentitet(db, t);
  if (finns && finns.patientId === p.id) return { utfall: 'samma', identitet: t };
  if (finns) {
    const annan = db.query('SELECT * FROM patienter WHERE id = ?').get(finns.patientId);
    if (!db.query("SELECT 1 FROM dubblettforslag WHERE status = 'oppen' AND fran_patient_id = ? AND till_patient_id = ?").get(p.id, annan.id)) {
      db.query('INSERT INTO dubblettforslag (fran_patient_id, till_patient_id, grund, skapad, av) VALUES (?, ?, ?, ?, ?)').run(p.id, annan.id, 'samma_nummer', tid, personal.id);
    }
    throw new Fel(409, 'Numret tillhör redan en annan journal i systemet. Det är troligen samma person. Journalerna ska slås samman, och den andra journalen blir kvar eftersom den har numret.', 'dubblett', { annanId: annan.id });
  }
  if (t.typ === 'reservnummer') throw new Fel(400, 'Reservnumret finns inte i systemet. Ett reservnummer skapas av systemet när en patient registreras utan känd identitet.', 'ogiltig', { falt: ['identitet'] });
  const gallande = db.query("SELECT * FROM identiteter WHERE patient_id = ? AND status = 'gallande'").get(p.id);
  const ersatter = !gallande || TYPER[t.typ].rang >= TYPER[gallande.typ].rang;
  db.transaction(() => {
    if (ersatter) {
      if (gallande) db.query("UPDATE identiteter SET status = 'tidigare', till = ?, orsak = ? WHERE id = ?").run(tid, `ersatt av ${TYPER[t.typ].text.toLowerCase()}`, gallande.id);
      db.query('INSERT INTO identiteter (patient_id, typ, varde, status, fran, av, ursprung) VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.id, t.typ, t.varde, 'gallande', tid, personal.id, p.id);
      db.query('UPDATE patienter SET personnummer = ?, id_typ = ? WHERE id = ?').run(t.varde, t.typ, p.id);
      if (t.fodd && t.kon) db.query('UPDATE patienter SET fodd = ?, kon = ? WHERE id = ?').run(t.fodd, t.kon, p.id);
    } else {
      db.query('INSERT INTO identiteter (patient_id, typ, varde, status, fran, av, ursprung) VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.id, t.typ, t.varde, 'ovrig', tid, personal.id, p.id);
    }
  })();
  return { utfall: ersatter ? 'bytt' : 'tillagd', identitet: t };
}

// Registrerar en ny patient. Med ett känt nummer ger numret typ, födelsedatum och kön. Utan nummer skapar systemet ett
// reservnummer av födelsedatumet (eller den ungefärliga åldern) och könet. Namnet kan saknas: då blir det Okänd man
// eller Okänd kvinna, som går att ändra när patienten är identifierad.
export function registrera(db, { identitet, fornamn, efternamn, kon, fodd, alder }, { idag = idagSv(), tid = new Date().toISOString(), av = null } = {}) {
  let t = null;
  const text = typeof identitet === 'string' ? identitet.trim() : '';
  if (text) {
    t = tolka(text, { idag });
    if (!t.arIdentitet) throw new Fel(400, 'Det går inte att tolka som ett nummer. Lämna fältet tomt om identiteten är okänd, så skapar systemet ett reservnummer.', 'ogiltig', { falt: ['identitet'] });
    if (!t.ok) throw new Fel(400, t.fel, 'ogiltig', { falt: ['identitet'] });
    const demo = demoKontroll(t);
    if (demo) throw new Fel(400, demo, 'ogiltig', { falt: ['identitet'] });
    if (t.typ === 'reservnummer') throw new Fel(400, 'Ett reservnummer skapas av systemet. Lämna fältet tomt, så skapas ett.', 'ogiltig', { falt: ['identitet'] });
    const finns = hittaPaIdentitet(db, t);
    if (finns) throw new Fel(409, 'Patienten finns redan i systemet.', 'finns', { patientId: finns.patientId });
  }
  const k = t?.kon ?? (['man', 'kvinna'].includes(kon) ? kon : null);
  if (!k) throw new Fel(400, 'Ange om patienten är man eller kvinna. Det behövs för reservnumret.', 'ogiltig', { falt: ['kon'] });
  let f = t?.fodd ?? null;
  if (!f) {
    if (typeof fodd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fodd) && giltigtDatum(...fodd.split('-').map(Number)) && fodd <= idag) f = fodd;
    else if (fodd) throw new Fel(400, 'Födelsedatumet ska skrivas som ÅÅÅÅ-MM-DD och får inte ligga i framtiden.', 'ogiltig', { falt: ['fodd'] });
    else if (alder !== undefined && alder !== null && alder !== '' && Number.isInteger(Number(alder)) && Number(alder) >= 0 && Number(alder) <= 120) {
      f = `${Number(idag.slice(0, 4)) - Number(alder)}-01-01`;
    } else throw new Fel(400, 'Ange födelsedatum eller ungefärlig ålder. Det behövs för reservnumret.', 'ogiltig', { falt: ['alder'] });
  }
  const namn = (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
  const fn = namn(fornamn) || 'Okänd';
  const en = namn(efternamn) || (k === 'man' ? 'man' : 'kvinna');
  if (t && (!namn(fornamn) || !namn(efternamn))) throw new Fel(400, 'Skriv patientens för- och efternamn. I demon finns ingen koppling till folkbokföringen som hämtar namnet.', 'ogiltig', { falt: [namn(fornamn) ? 'efternamn' : 'fornamn'] });
  const typ = t?.typ ?? 'reservnummer';
  const varde = t?.varde ?? nyttReservnummer(db, { fodd: f, kon: k });
  const nr = db.query("SELECT count(*) AS n FROM patienter WHERE id LIKE 'n%'").get().n + 1;
  const id = `n${String(nr).padStart(3, '0')}`;
  db.query('INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, skyddad, id_typ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').run(id, varde, fn, en, k, f, typ);
  db.query('INSERT INTO identiteter (patient_id, typ, varde, status, fran, av, ursprung) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, typ, varde, 'gallande', tid, av, id);
  return { id, typ, varde, skapatReservnummer: !t };
}
