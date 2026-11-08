// Runda 9, r7: textfri inmatning med streckkodsläsare (Sussa 3.1.3.6).
//
// En streckkodsläsare i tangentbordsläge skriver koden som tecken följda av Enter. Gränssnittet skickar koden hit, och
// systemet avgör själv vad den är: Vårdkällans armband (VKA och åtta siffror), ett personnummer, samordningsnummer eller
// reservnummer från ett armband i en annan form, en provetikett (VKP och åtta siffror, labb.js), etiketten på en
// iordningställd dos (VK-ADM-, administrering.js) eller en läkemedelsförpackning med GS1-koder (01 artikelnummer, 17
// utgångsdatum, 10 batch och 21 serienummer, som i GS1 DataMatrix på läkemedelsförpackningar). I demon är
// artikelnumret förpackningens NPL-pack-id, som också har 14 siffror, eftersom katalogen saknar GTIN.
//
// Systemet är experten: den som skannar väljer aldrig vad koden är, och systemet kontrollerar själv att röret, dosen
// eller förpackningen hör till patienten som är öppen. Ett rör eller en dos som hör till en annan patient stoppas utan
// att något om den andra patienten visas. Varje skanning sparas i tabellen skanningar med vem, var, när, vad och
// resultatet, så att informationen för spårbarhet skapas vid inmatningen. Ett skannat personnummer sparas aldrig, bara
// att det var en identitet och vilken patient den ledde till.
//
// Behörigheten är densamma som för det skanningen gör: att öppna en patient kräver rätten att söka patienter, att ta
// ett prov rätten att ta prov för patienten och att kontrollera en förpackning rätten att läsa läkemedelslistan.
import { Fel, iso, idag } from './db.js';
import { kanRoll, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as identitet from './identitet.js';
import { svg } from './streckkod.js';

export const SCHEMA = `
-- Patientens armband. kod står i streckkoden och innehåller inga personuppgifter. Ett armband ersätts av ett nytt när
-- det skrivs ut igen efter att ha återkallats, och raderas aldrig.
CREATE TABLE IF NOT EXISTS armband (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kod TEXT UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, skapad TEXT NOT NULL,
  skapad_av TEXT, aterkallad TEXT
);
CREATE INDEX IF NOT EXISTS ix_armband_patient ON armband (patient_id);
CREATE TRIGGER IF NOT EXISTS armband_raderas_ej BEFORE DELETE ON armband BEGIN SELECT RAISE(ABORT, 'Ett armband raderas inte'); END;
-- Varje skanning: vem, var, när, vilken sorts kod, vilken patient den gällde och vad som hände. objekt pekar på det som
-- skannades (labb_prov:6, administreringar:12, forpackningar:<NPL-pack-id>), batch och utgang från förpackningen.
CREATE TABLE IF NOT EXISTS skanningar (
  id INTEGER PRIMARY KEY, tid TEXT NOT NULL, personal_id TEXT NOT NULL, enhet_id TEXT NOT NULL, patient_id TEXT, kodtyp TEXT NOT NULL,
  sammanhang TEXT NOT NULL, resultat TEXT NOT NULL, objekt TEXT, batch TEXT, utgang TEXT
);
CREATE TRIGGER IF NOT EXISTS skanningar_andras_ej BEFORE UPDATE ON skanningar BEGIN SELECT RAISE(ABORT, 'En skanning ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS skanningar_raderas_ej BEFORE DELETE ON skanningar BEGIN SELECT RAISE(ABORT, 'En skanning raderas inte'); END;
`;

export const armbandFor = (id) => `VKA${String(id).padStart(8, '0')}`;
export const SAMMANHANG = ['oppna', 'provtagning', 'administrering'];

// Tabellerna, och armband för de patienter som är inskrivna när sandlådan byggs eller läses in.
export function sakra(db) {
  db.exec(SCHEMA);
  if (db.query('SELECT 1 FROM armband LIMIT 1').get()) return;
  const inskrivna = db.query("SELECT patient_id, enhet_id, min(start) AS start FROM vardkontakter WHERE typ = 'slutenvard' AND slut IS NULL GROUP BY patient_id ORDER BY patient_id").all();
  for (const v of inskrivna) nyttArmband(db, v.patient_id, v.enhet_id, null, v.start);
}

function nyttArmband(db, patientId, enhetId, av, tid = iso()) {
  const r = db.query('INSERT INTO armband (patient_id, enhet_id, skapad, skapad_av) VALUES (?, ?, ?, ?)').run(patientId, enhetId, tid, av);
  const id = Number(r.lastInsertRowid);
  db.query('UPDATE armband SET kod = ? WHERE id = ?').run(armbandFor(id), id);
  return db.query('SELECT * FROM armband WHERE id = ?').get(id);
}

// POST /api/patient/:id/armband: patientens armband med streckkod, samma kod varje gång det skrivs ut. Namn och
// personnummer på armbandet följer samma maskering som patienthuvudet.
export function armband(atk, p) {
  atk.krav(kanRoll(atk.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin');
  const db = atk.db;
  let a = db.query('SELECT * FROM armband WHERE patient_id = ? AND aterkallad IS NULL ORDER BY id DESC LIMIT 1').get(p.id);
  if (!a) a = nyttArmband(db, p.id, atk.personal.enhet_id, atk.personal.id);
  return { kod: a.kod, skapad: a.skapad, svg: svg(a.kod, { hojd: 36, modul: 1.4 }), patient: { namn: visningsnamn(p, atk.val.visa_identitet), personnummer: visningsPnr(p, atk.val.visa_identitet) } };
}

// GS1: tillämpningsidentifierare med fast längd och de med varierande längd, som slutar med gruppseparatorn.
const GS = '\u001d';
const FAST = { '01': 14, '17': 6 };
const VARIERANDE = ['10', '21'];
function gs1(s) {
  let t = s.replace(/^\]d2|^\]C1|^\]Q3/, '');
  // Klartextformen (01)...(17)...(10)...
  if (t.startsWith('(')) {
    const ut = {};
    for (const m of t.matchAll(/\((\d{2})\)([^(]*)/g)) ut[m[1]] = m[2].replaceAll(GS, '');
    return ut['01'] ? ut : null;
  }
  if (!/^01\d{14}/.test(t)) return null;
  const ut = {};
  while (t.length) {
    if (t.startsWith(GS)) { t = t.slice(1); continue; }
    const ai = t.slice(0, 2);
    if (FAST[ai]) {
      const v = t.slice(2, 2 + FAST[ai]);
      if (!/^\d+$/.test(v) || v.length !== FAST[ai]) return null;
      ut[ai] = v;
      t = t.slice(2 + FAST[ai]);
    } else if (VARIERANDE.includes(ai)) {
      const slut = t.indexOf(GS, 2);
      ut[ai] = slut < 0 ? t.slice(2) : t.slice(2, slut);
      t = slut < 0 ? '' : t.slice(slut + 1);
    } else return ut['01'] ? ut : null;
  }
  return ut;
}
// Utgångsdatum ÅÅMMDD. Dagen 00 betyder sista dagen i månaden.
function utgangsdatum(v) {
  if (!/^\d{6}$/.test(v ?? '')) return null;
  const ar = 2000 + Number(v.slice(0, 2));
  const man = Number(v.slice(2, 4));
  let dag = Number(v.slice(4, 6));
  if (man < 1 || man > 12) return null;
  if (dag === 0) dag = new Date(Date.UTC(ar, man, 0)).getUTCDate();
  return `${ar}-${String(man).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
}

// Vad koden är. En ren funktion av koden: läser inget och sparar inget.
export function tolka(kod) {
  const s = String(kod ?? '').replace(/[\r\n]+$/g, '').trim();
  if (/^VKA\d{8}$/i.test(s)) return { typ: 'armband', kod: s.toUpperCase() };
  if (/^VKP\d{8}$/i.test(s)) return { typ: 'etikett', kod: s.toUpperCase() };
  const dos = s.match(/^VK-ADM-(\d{6})-([A-Z0-9]{1,10})$/i);
  if (dos) return { typ: 'dos', administreringId: Number(dos[1]), patient: dos[2].toLowerCase(), kod: s.toUpperCase() };
  const g = gs1(s) ?? (/^\d{13,14}$/.test(s) ? { '01': s.padStart(14, '0') } : null);
  if (g) return { typ: 'forpackning', gtin: g['01'], utgang: utgangsdatum(g['17']), batch: g['10'] || null, serienummer: g['21'] || null };
  const id = identitet.tolka(s);
  if (id.arIdentitet && id.ok) return { typ: 'identitet', identitet: id };
  return { typ: 'okand', text: 'Systemet känner inte igen koden. Den är varken ett armband, en provetikett, en iordningställd dos eller en läkemedelsförpackning. Skanna igen eller skriv in uppgiften.' };
}

function spara(c, rad) {
  c.db.query('INSERT INTO skanningar (tid, personal_id, enhet_id, patient_id, kodtyp, sammanhang, resultat, objekt, batch, utgang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(iso(), c.personal.id, c.personal.enhet_id, rad.patient ?? null, rad.kodtyp, rad.sammanhang, rad.resultat, rad.objekt ?? null, rad.batch ?? null, rad.utgang ?? null);
}

const ANNAN_PATIENT = 'tillhör en annan patient än den som är öppen';

// POST /api/skanna { kod, patientId?, sammanhang? }. medPatient är serverns kontext för en patient, som prövar och loggar.
export function skanna(c, body, { medPatient }) {
  const db = c.db;
  const t = tolka(typeof body.kod === 'string' ? body.kod.slice(0, 200) : '');
  const sammanhang = SAMMANHANG.includes(body.sammanhang) ? body.sammanhang : 'oppna';
  const oppen = typeof body.patientId === 'string' && /^[\w-]{1,40}$/.test(body.patientId) ? identitet.gallandeId(db, body.patientId) : null;
  const rad = (r) => spara(c, { kodtyp: t.typ, sammanhang, ...r });
  if (t.typ === 'okand') { rad({ resultat: 'okand' }); throw new Fel(400, t.text, 'ogiltig', { falt: ['kod'] }); }

  if (t.typ === 'armband' || t.typ === 'identitet') {
    if (!kanRoll(c.personal, 'sok')) {
      loggaRad(db, { personal_id: c.personal.id, enhet_id: c.personal.enhet_id, handling: 'sok', resurs: `skanning:${t.typ}`, grund: 'nekad', resultat: 'nekad' });
      throw new Fel(403, 'Yrkesrollen får inte söka patienter, och därför inte heller öppna en patient från ett armband.', 'nekad');
    }
    let pid = null;
    if (t.typ === 'armband') pid = db.query('SELECT patient_id FROM armband WHERE kod = ? AND aterkallad IS NULL').get(t.kod)?.patient_id ?? null;
    else pid = identitet.hittaPaIdentitet(db, t.identitet)?.patientId ?? null;
    if (!pid) {
      rad({ resultat: 'saknas' });
      throw new Fel(404, t.typ === 'armband' ? 'Armbandet finns inte i Vårdkällan, eller har ersatts av ett nytt. Skriv ut ett nytt armband från patientens journal.' : 'Det finns ingen patient med det numret i Vårdkällan.', 'saknas');
    }
    pid = identitet.gallandeId(db, pid);
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
    const kort = { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) };
    const samma = oppen ? oppen === pid : null;
    loggaRad(db, { personal_id: c.personal.id, enhet_id: c.personal.enhet_id, patient_id: pid, handling: 'sok', resurs: `skanning:${t.typ}`, grund: 'administrativ', resultat: 'tillaten' });
    rad({ patient: pid, resultat: samma === null ? 'oppna' : samma ? 'kontrollerad' : 'annan_patient', objekt: t.typ === 'armband' ? `armband:${t.kod}` : null });
    const ut = { typ: 'patient', kalla: t.typ, patient: kort, sammaPatient: samma, oppna: `#/patient/${encodeURIComponent(pid)}` };
    if (samma === true) ut.text = 'Armbandet stämmer med patienten som är öppen.';
    if (samma === false) ut.varning = `Armbandet ${ANNAN_PATIENT}. Kontrollera patientens identitet innan du fortsätter.`;
    return ut;
  }

  if (t.typ === 'etikett') {
    const prov = db.query("SELECT * FROM labb_prov WHERE etikett = ?").get(t.kod);
    if (!prov) { rad({ patient: oppen, resultat: 'saknas' }); throw new Fel(404, 'Etiketten finns inte. Skriv ut etiketterna igen från beställningen.', 'saknas'); }
    if (!oppen) {
      rad({ resultat: 'utan_patient', objekt: `labb_prov:${prov.id}` });
      throw new Fel(400, 'Skanna patientens armband först, så att systemet kan kontrollera att röret hör till rätt patient.', 'ogiltig');
    }
    if (oppen !== prov.patient_id) {
      rad({ patient: oppen, resultat: 'annan_patient', objekt: `labb_prov:${prov.id}` });
      throw new Fel(409, `Röret ${ANNAN_PATIENT}. Ta inte provet. Kontrollera armbandet och etiketten.`, 'ogiltig', { annanPatient: true });
    }
    if (sammanhang === 'provtagning') {
      const labb = require('./labb.js');
      const r = medPatient(c, prov.patient_id, 'ta_prov', (atk) => labb.taProv(atk, labb.provRad(db, prov.id)));
      rad({ patient: prov.patient_id, resultat: 'provtagen', objekt: `labb_prov:${prov.id}` });
      return { typ: 'etikett', etikett: t.kod, tagen: true, text: r.text ?? `Röret ${t.kod} är registrerat som taget.`, bestallning: r.bestallning };
    }
    return medPatient(c, prov.patient_id, 'las_prover', (atk) => {
      const b = db.query('SELECT * FROM labb_bestallningar WHERE id = ?').get(prov.bestallning_id);
      atk.krav('las_prover', { resurs: { enhet_id: b.enhet_id } });
      rad({ patient: prov.patient_id, resultat: 'visad', objekt: `labb_prov:${prov.id}` });
      return { typ: 'etikett', etikett: t.kod, tagen: Boolean(prov.provtagen_tid), bestallningId: b.id, text: prov.provtagen_tid ? 'Röret är redan taget.' : 'Röret är inte taget. Öppna fliken Prover för att ta det.' };
    });
  }

  if (t.typ === 'dos') {
    const a = db.query('SELECT * FROM administreringar WHERE id = ?').get(t.administreringId);
    if (!a || a.kontrollkod?.toUpperCase() !== t.kod) { rad({ patient: oppen, resultat: 'saknas' }); throw new Fel(404, 'Dosen finns inte. Etiketten kan höra till en dos som redan är registrerad.', 'saknas'); }
    if (!oppen) { rad({ resultat: 'utan_patient', objekt: `administreringar:${a.id}` }); throw new Fel(400, 'Skanna patientens armband först, så att systemet kan kontrollera att dosen hör till rätt patient.', 'ogiltig'); }
    if (oppen !== a.patient_id) {
      rad({ patient: oppen, resultat: 'annan_patient', objekt: `administreringar:${a.id}` });
      throw new Fel(409, `Dosen ${ANNAN_PATIENT}. Ge inte läkemedlet. Kontrollera armbandet och etiketten.`, 'ogiltig', { annanPatient: true });
    }
    return medPatient(c, a.patient_id, 'ge_lakemedel', (atk) => {
      atk.krav('ge_lakemedel', { resurs: { enhet_id: a.enhet_id, gemensam: true } });
      const lm = db.query('SELECT namn, styrka FROM katalog WHERE id = ?').get(a.lakemedel_id);
      rad({ patient: a.patient_id, resultat: 'kontrollerad', objekt: `administreringar:${a.id}` });
      return { typ: 'dos', administreringId: a.id, status: a.status, lakemedel: lm ? `${lm.namn} ${lm.styrka ?? ''}`.trim() : a.lakemedel_id, planerad: a.planerad,
        text: a.status === 'iordningstalld' ? 'Dosen är iordningställd för patienten. Registrera den som given när den är given.' : 'Dosen är redan registrerad.' };
    });
  }

  // Läkemedelsförpackning.
  const f = db.query('SELECT * FROM forpackningar WHERE nplpackid = ?').get(t.gtin);
  if (!f) { rad({ patient: oppen, resultat: 'saknas', batch: t.batch, utgang: t.utgang }); throw new Fel(404, 'Förpackningen finns inte i läkemedelskatalogen.', 'saknas'); }
  const lm = db.query('SELECT * FROM katalog WHERE id = ?').get(f.lakemedel_id);
  const namn = `${lm.namn}${lm.styrka ? ` ${lm.styrka}` : ''}`;
  const varningar = [];
  if (t.utgang && t.utgang < idag()) varningar.push({ niva: 'allvarlig', regel: 'utgangen', text: `Förpackningen gick ut ${t.utgang}. Ge inte läkemedlet ur den.` });
  const ut = { typ: 'forpackning', lakemedel: { id: lm.id, namn, atc: lm.atc }, forpackning: f.text, nplpackid: f.nplpackid, batch: t.batch, utgang: t.utgang, serienummer: t.serienummer, varningar, ordinationer: [] };
  if (!oppen) {
    rad({ resultat: 'visad', objekt: `forpackningar:${f.nplpackid}`, batch: t.batch, utgang: t.utgang });
    return { ...ut, text: `${namn}, ${f.text}.` };
  }
  return medPatient(c, oppen, 'las_lakemedel', (atk) => {
    atk.krav('las_lakemedel');
    const { synligaOrdinationer } = require('./lakemedel.js');
    const nu = idag();
    const aktiva = synligaOrdinationer(atk).filter(o => o.status === 'aktiv' && (!o.slut || o.slut >= nu));
    const samma = aktiva.filter(o => o.lakemedel_id === lm.id);
    ut.ordinationer = samma.map(o => ({ id: o.id, dosering: o.dosering }));
    if (!samma.length) {
      const substans = aktiva.filter(o => db.query('SELECT substans FROM katalog WHERE id = ?').get(o.lakemedel_id)?.substans === lm.substans);
      varningar.push(substans.length
        ? { niva: 'allvarlig', regel: 'annan_styrka', text: `${namn} är inte ordinerat till patienten, men samma substans finns i en annan styrka eller form. Kontrollera ordinationen.` }
        : { niva: 'allvarlig', regel: 'ej_ordinerad', text: `${namn} är inte ordinerat till patienten. Kontrollera ordinationen innan du ger något.` });
    }
    rad({ patient: oppen, resultat: varningar.length ? 'varning' : 'kontrollerad', objekt: `forpackningar:${f.nplpackid}`, batch: t.batch, utgang: t.utgang });
    return { ...ut, text: varningar.length ? varningar[0].text : `${namn} stämmer med ordinationen${t.batch ? `. Batch ${t.batch} registreras vid skanningen` : ''}.` };
  });
}
