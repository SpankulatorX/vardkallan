// Kontorsinformationsstöd (runda 10, r7, Sussa 5.1.1.1). Vårdkällan lämnar ut och tar emot det som kontorsstödet behöver
// i öppna standardformat, så att regionen kan använda Microsoft 365 (eller en annan kontorsprogramvara) som komplement
// utan att journalen hamnar utanför journalsystemets behörighet och logg:
//   ordbehandling  journaltext och utskrifter som Word-dokument (DOCX, Office Open XML, ISO/IEC 29500)
//   rapporter      kassaredovisning och kapacitetsprognos som Word-dokument, utan patientuppgifter
//   kalender       personalens tidbok som kalenderprenumeration (iCalendar, RFC 5545) med en hemlig länk per person
//                  som kan återkallas, och en enskild tid som inbjudan
//   e-post         kalenderinbjudan som e-postmeddelande (iMIP, RFC 6047), simulerat: inget skickas
//   telefoni       ring upp patienten vid en telefontid (tel-URI, RFC 3966), som Teams eller en softphone öppnar
//   videosamtal    en möteslänk för varje videobesök, simulerad
//   SharePoint     dokumenten sparas där av användaren eller av en integration mot Microsoft Graph (beskriven, inte byggd)
// Microsofts tjänster simuleras. Inget anrop går till Microsoft.
//
// Säkerhet. Kalenderlänken ger aldrig patientuppgifter, bara tid, typ av uppgift och mottagning, och "Upptagen" för det
// personen inte ska se (en annan vårdenhet eller en patient med skyddade personuppgifter). Länken finns bara som HMAC i
// sandlådan och i minnet, med en hemlig nyckel, och kan återkallas. Varje dokument med patientuppgifter lämnas ut efter
// samma behörighetsprövning som i journalen och loggas på patienten.
import { createHmac, randomBytes } from 'node:crypto';
import { Fel, iso, idag, addDagar } from './db.js';
import { vardenhetFor, harVardrelation } from './atkomst.js';
import { zip } from './zip.js';
import { TIDSTYPER } from './tidbok.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kalenderlankar (
  id INTEGER PRIMARY KEY, personal_id TEXT NOT NULL, enhet_id TEXT NOT NULL, hmac TEXT NOT NULL UNIQUE, skapad TEXT NOT NULL,
  aterkallad TEXT, hamtad TEXT, antal INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS videomoten (
  id INTEGER PRIMARY KEY, bokning_id INTEGER NOT NULL UNIQUE, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, kod TEXT NOT NULL UNIQUE, skapad TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS videomote_andras_ej BEFORE UPDATE OF bokning_id, kod ON videomoten BEGIN SELECT RAISE(ABORT, 'En möteslänk ändras inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

// --- DOCX ----------------------------------------------------------------------------------------------------------
const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Tecken som XML 1.0 inte tillåter tas bort.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const run = (t, { fet = false } = {}) => String(t ?? '').split('\n').map((rad, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${fet ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xml(rad)}</w:t></w:r>`).join('');
function blockXml(b) {
  if (b.typ === 'rubrik') return `<w:p><w:pPr><w:pStyle w:val="Rubrik${b.niva ?? 1}"/></w:pPr>${run(b.text)}</w:p>`;
  if (b.typ === 'tabell') {
    const rad = (celler, fet) => `<w:tr>${celler.map(c => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p>${run(c, { fet })}</w:p></w:tc>`).join('')}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabell"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${rad(b.huvud, true)}${b.rader.map(r => rad(r, false)).join('')}</w:tbl><w:p/>`;
  }
  return `<w:p>${run(b.text, { fet: b.fet })}</w:p>`;
}
const STILAR = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="sv-SE"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Rubrik1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Rubrik2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="Tabell"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;

// docx({ titel, block, skapad }) ger en Buffer med ett Word-dokument. block: [{ typ: 'rubrik'|'stycke'|'tabell', ... }].
export function docx({ titel, block, skapad = new Date(), fot = 'Skapat i Vårdkällan, demo med påhittade uppgifter.' }) {
  const kropp = [...block, { typ: 'stycke', text: fot }].map(blockXml).join('');
  const dok = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${kropp}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const t = skapad.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return zip([
    { namn: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { namn: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { namn: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { namn: 'word/document.xml', data: dok },
    { namn: 'word/styles.xml', data: STILAR },
    { namn: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(titel)}</dc:title><dc:creator>Vårdkällan</dc:creator><dc:language>sv-SE</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${t}</dcterms:created></cp:coreProperties>` },
  ], skapad);
}
export const DOCX_TYP = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// En journalanteckning som Word-dokument. a är anteckningen som hamtaAnteckning gav, p patienten i visningsform.
export function anteckningDocx(a, p) {
  const sign = a.signerad ? `Signerad ${a.signerad.tid.slice(0, 16).replace('T', ' ')} av ${a.signerad.av?.namn ?? ''}${a.signerad.av?.titel ? `, ${a.signerad.av.titel}` : ''}` : 'Inte signerad (utkast)';
  return docx({
    titel: `${a.typ}, ${p.namn}`,
    block: [
      { typ: 'rubrik', text: a.typ },
      { typ: 'tabell', huvud: ['Uppgift', 'Värde'], rader: [['Patient', p.namn], ['Personnummer', p.personnummer], ['Vårdenhet', a.enhet?.namn ?? ''], ['Författare', `${a.forfattare?.namn ?? ''}${a.forfattare?.titel ? `, ${a.forfattare.titel}` : ''}`], ['Skapad', a.skapad.slice(0, 16).replace('T', ' ')], ['Signering', sign]] },
      ...(a.sokord ?? []).flatMap(s => [{ typ: 'rubrik', niva: 2, text: s.sokord }, { typ: 'stycke', text: s.text || 'Inget skrivet.' }]),
      { typ: 'stycke', text: 'Kopian är tagen ur journalen och är inte själv en journalhandling. Ändringar görs i journalen.' },
    ],
  });
}

// --- Kalenderprenumerationen ---------------------------------------------------------------------------------------
const TAK_PER_TIMME = 60;
// Tiden som kalendern visar: en vecka bakåt och åtta veckor framåt.
const BAKAT = 7;
const FRAMAT = 56;

export function skapaKalenderlager({ hemlighet = process.env.KALENDER_NYCKEL || randomBytes(32).toString('hex'), nu = () => Date.now() } = {}) {
  const lankar = new Map();
  const hmac = (t) => createHmac('sha256', hemlighet).update(`kalender:${t}`).digest('hex');
  const giltig = (t) => typeof t === 'string' && /^vkcal_[A-Za-z0-9_-]{32}$/.test(t);

  function skapa(s, personal) {
    const db = s.db;
    sakra(db);
    const t0 = iso();
    db.query('UPDATE kalenderlankar SET aterkallad = ? WHERE personal_id = ? AND aterkallad IS NULL').run(t0, personal.id);
    for (const [h, k] of lankar) if (k.s === s && k.personalId === personal.id) lankar.delete(h);
    const token = `vkcal_${randomBytes(24).toString('base64url')}`;
    const h = hmac(token);
    db.query('INSERT INTO kalenderlankar (personal_id, enhet_id, hmac, skapad) VALUES (?, ?, ?, ?)').run(personal.id, personal.enhet_id, h, t0);
    lankar.set(h, { s, personalId: personal.id, anrop: [] });
    return token;
  }
  function aterkalla(s, personal) {
    sakra(s.db);
    const r = s.db.query('UPDATE kalenderlankar SET aterkallad = ? WHERE personal_id = ? AND aterkallad IS NULL').run(iso(), personal.id);
    for (const [h, k] of lankar) if (k.s === s && k.personalId === personal.id) lankar.delete(h);
    return r.changes > 0;
  }
  // Sandlådan och personen bakom en länk, eller null. Efter en omstart finns länken bara i sandlådan, och då söks den
  // där med samma hemliga nyckel.
  function hitta(token, sessioner) {
    if (!giltig(token)) return null;
    const h = hmac(token);
    let k = lankar.get(h);
    if (k && !sessioner.includes(k.s)) { lankar.delete(h); k = null; }
    if (!k) {
      for (const s of sessioner) {
        // Runda 13, r2: en sandlåda som vilar på disk läses bara in om dess länkar finns i minnet (sandlada-vila.js).
        if (s.vilar && !(s.vilaIndex?.kalender ?? []).includes(h)) continue;
        try {
          const r = s.db.query("SELECT personal_id FROM kalenderlankar WHERE hmac = ? AND aterkallad IS NULL").get(h);
          if (r) { k = { s, personalId: r.personal_id, anrop: [] }; lankar.set(h, k); break; }
        } catch { /* sandlådan har inga kalenderlänkar */ }
      }
    }
    if (!k) return null;
    const rad = k.s.db.query('SELECT * FROM kalenderlankar WHERE hmac = ?').get(h);
    if (!rad || rad.aterkallad) { lankar.delete(h); return null; }
    const t = nu();
    k.anrop = k.anrop.filter(x => x > t - 3600_000);
    if (k.anrop.length >= TAK_PER_TIMME) return { ...k, tak: true };
    k.anrop.push(t);
    k.s.db.query('UPDATE kalenderlankar SET hamtad = ?, antal = antal + 1 WHERE id = ?').run(iso(), rad.id);
    return k;
  }
  const rensa = (s) => { for (const [h, k] of lankar) if (k.s === s) lankar.delete(h); };
  return { skapa, aterkalla, hitta, rensa, lankar };
}

export function kalenderStatus(db, personal) {
  sakra(db);
  const r = db.query('SELECT * FROM kalenderlankar WHERE personal_id = ? AND aterkallad IS NULL ORDER BY id DESC').get(personal.id);
  return {
    finns: Boolean(r), skapad: r?.skapad ?? null, hamtad: r?.hamtad ?? null, antal: r?.antal ?? 0,
    text: 'Kalendern visar dina bokade tider en vecka bakåt och åtta veckor framåt, med typ av besök och mottagning men aldrig vem patienten är. Länken är hemlig och personlig. Återkalla den om någon annan kan ha fått den.',
  };
}

// Personens händelser i kalendern. Tid, typ av uppgift och plats. "Upptagen" när personen inte ska se vad det är.
export function kalenderHandelser(db, personalId, dag = idag()) {
  const p = db.query('SELECT * FROM personal WHERE id = ?').get(personalId);
  if (!p) return [];
  const ve = vardenhetFor(db, p.enhet_id);
  const fran = new Date(`${addDagar(dag, -BAKAT)}T00:00:00Z`).toISOString();
  const till = new Date(`${addDagar(dag, FRAMAT)}T00:00:00Z`).toISOString();
  const rader = db.query(`SELECT t.*, s.enhet_id AS schema_enhet FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.personal_id = ? AND t.start >= ? AND t.start < ?
    AND EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id AND b.status IN ('bokad', 'incheckad')) ORDER BY t.start`).all(personalId, fran, till);
  const team = db.query("SELECT d.*, b.patient_id, b.tid_id FROM teambesok_deltagare d JOIN bokningar b ON b.id = d.bokning_id WHERE d.personal_id = ? AND b.status IN ('bokad', 'incheckad') AND d.start >= ? AND d.start < ?")
    .all(personalId, fran, till);
  const ut = [];
  for (const t of rader) {
    const bokningar = db.query("SELECT patient_id FROM bokningar WHERE tid_id = ? AND status IN ('bokad', 'incheckad')").all(t.id);
    const egen = vardenhetFor(db, t.schema_enhet) === ve;
    const skyddad = bokningar.some(b => db.query('SELECT skyddad FROM patienter WHERE id = ?').get(b.patient_id)?.skyddad);
    const synlig = egen && !skyddad && bokningar.every(b => harVardrelation(db, b.patient_id, ve));
    const plats = db.query('SELECT namn FROM enheter WHERE id = ?').get(t.schema_enhet)?.namn ?? '';
    ut.push({ uid: `tid-${t.id}`, start: t.start, slut: t.slut, titel: synlig ? (t.tidstyp === 'grupp' ? `${t.rubrik ?? 'Gruppträff'} (${bokningar.length} deltagare)` : TIDSTYPER[t.tidstyp]?.text ?? 'Bokad tid') : 'Upptagen', plats: synlig ? plats : '' });
  }
  for (const d of team) {
    if (ut.some(x => x.uid === `tid-${d.tid_id}`)) continue;
    const egen = vardenhetFor(db, d.enhet_id) === ve && !db.query('SELECT skyddad FROM patienter WHERE id = ?').get(d.patient_id)?.skyddad;
    ut.push({ uid: `team-${d.id}`, start: d.start, slut: d.slut, titel: egen ? 'Teambesök' : 'Upptagen', plats: egen ? db.query('SELECT namn FROM enheter WHERE id = ?').get(d.enhet_id)?.namn ?? '' : '' });
  }
  return ut.sort((a, b) => a.start.localeCompare(b.start));
}

const icsTid = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Rader längre än 75 oktetter viks (RFC 5545 3.1).
function vik(rad) {
  const b = Buffer.from(rad, 'utf8');
  if (b.length <= 75) return rad;
  const delar = [];
  let s = '';
  for (const tecken of rad) {
    if (Buffer.byteLength(s + tecken, 'utf8') > (delar.length ? 74 : 75)) { delar.push(s); s = ''; }
    s += tecken;
  }
  delar.push(s);
  return delar.join('\r\n ');
}
// En egenskap i iCalendar: namn, parametrar och värde.
const egenskap = (namn, varde, parametrar = '') => [namn, parametrar].filter(Boolean).join(';') + ':' + varde;
export function kalenderIcs(handelser, { namn = 'Vårdkällan', metod = 'PUBLISH', organisator = null, deltagare = null } = {}) {
  const stamp = icsTid(new Date());
  const rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vårdkällan//Kalender//SV', 'CALSCALE:GREGORIAN', egenskap('METHOD', metod), egenskap('X-WR-CALNAME', icsText(namn)), 'X-PUBLISHED-TTL:PT1H'];
  for (const h of handelser) {
    rader.push('BEGIN:VEVENT', egenskap('UID', h.uid + '@vardkallan.demo'), egenskap('DTSTAMP', stamp), egenskap('DTSTART', icsTid(h.start)), egenskap('DTEND', icsTid(h.slut)),
      egenskap('SUMMARY', icsText(h.titel)), 'CLASS:CONFIDENTIAL', 'TRANSP:OPAQUE');
    if (h.plats) rader.push(egenskap('LOCATION', icsText(h.plats)));
    if (h.beskrivning) rader.push(egenskap('DESCRIPTION', icsText(h.beskrivning)));
    if (organisator) rader.push(egenskap('ORGANIZER', 'mailto:' + organisator.adress, 'CN=' + icsText(organisator.namn)));
    if (deltagare) rader.push(egenskap('ATTENDEE', 'mailto:' + deltagare.adress, 'CN=' + icsText(deltagare.namn) + ';RSVP=TRUE'));
    rader.push('END:VEVENT');
  }
  rader.push('END:VCALENDAR');
  return rader.map(vik).join('\r\n') + '\r\n';
}

// --- En bokning i tidboken: möteslänk, uppringning, inbjudan och e-post ----------------------------------------------
const mote = (db, b) => {
  sakra(db);
  let m = db.query('SELECT * FROM videomoten WHERE bokning_id = ?').get(b.id);
  if (!m) {
    const kod = randomBytes(12).toString('base64url');
    db.query('INSERT INTO videomoten (bokning_id, patient_id, enhet_id, kod, skapad) VALUES (?, ?, ?, ?, ?)').run(b.id, b.patient_id, b.enhet ?? '', kod, iso());
    m = db.query('SELECT * FROM videomoten WHERE bokning_id = ?').get(b.id);
  }
  return m;
};
export const motesLank = (kod) => `#/videomote/${kod}`;

// Det kontorsstödet ger för en bokning. atk är prövad för patienten med handlingen las_tidbok eller boka.
export function forBokning(db, b, tid, p, { visad = false } = {}) {
  const typ = tid.tidstyp;
  const ut = { tidstyp: typ, tidstypText: TIDSTYPER[typ]?.text, ics: `/api/bokning/${b.id}/inbjudan.ics`, epost: `/api/bokning/${b.id}/inbjudan.eml` };
  if (typ === 'video') ut.video = { lank: motesLank(mote(db, { ...b, enhet: vardenhetFor(db, db.query('SELECT enhet_id FROM scheman WHERE id = ?').get(tid.schema_id)?.enhet_id) }).kod), text: 'Simulerad möteslänk. I en riktig installation skapas mötet i Microsoft Teams eller regionens videotjänst, och patienten får länken i kallelsen.' };
  if (typ === 'telefon') {
    const nr = String(p.telefon ?? '').replace(/[^\d+]/g, '');
    ut.telefon = p.skyddad && !visad ? { text: 'Patienten har skyddade personuppgifter. Numret visas efter ett aktivt val.' } : nr ? { uri: `tel:${nr.startsWith('0') ? `+46${nr.slice(1)}` : nr}`, text: 'Ringer upp patienten med regionens telefoni (Teams eller en softphone som öppnar tel-länkar).' } : { text: 'Patienten har inget telefonnummer registrerat.' };
  }
  return ut;
}

// Inbjudan för personalen: tid, typ och mottagning, utan patientuppgifter.
export function inbjudanHandelse(db, b, tid) {
  const s = db.query('SELECT * FROM scheman WHERE id = ?').get(tid.schema_id);
  return { uid: `bokning-${b.id}`, start: tid.start, slut: tid.slut, titel: TIDSTYPER[tid.tidstyp]?.text ?? 'Bokad tid', plats: db.query('SELECT namn FROM enheter WHERE id = ?').get(s.enhet_id)?.namn ?? '', beskrivning: 'Patientuppgifterna finns i Vårdkällans tidbok.' };
}

// Ett e-postmeddelande med inbjudan (iMIP). Simulerat: meddelandet lämnas ut som fil och skickas inte.
export function inbjudanEpost(handelse, personal) {
  const adress = `${personal.id}@personal.vardkallan.demo`;
  const ics = kalenderIcs([handelse], { metod: 'REQUEST', organisator: { namn: 'Vårdkällan', adress: 'tidbok@vardkallan.demo' }, deltagare: { namn: personal.namn, adress } });
  const grans = `vk-${randomBytes(8).toString('hex')}`;
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  // Rubrikerna i e-postmeddelandet. Namnen skiljer inte på stora och små bokstäver (RFC 5322), och namn med å, ä och ö
  // kodas (RFC 2047).
  const kodat = (t) => '=?UTF-8?B?' + Buffer.from(t, 'utf8').toString('base64') + '?=';
  const rubrik = (n, v) => n + ': ' + v;
  return [
    rubrik('from', kodat('Vårdkällan') + ' <tidbok@vardkallan.demo>'), rubrik('to', adress), rubrik('subject', kodat('Inbjudan: ' + handelse.titel)), rubrik('date', new Date().toUTCString()), 'MIME-Version: 1.0',
    'X-Vardkallan-Simulerad: ja, inget meddelande har skickats', `Content-Type: multipart/alternative; boundary="${grans}"`, '',
    `--${grans}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(`${handelse.titel} ${new Date(handelse.start).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}, ${handelse.plats}.\r\nPatientuppgifterna finns i Vårdkällans tidbok.\r\n`), '',
    `--${grans}`, 'Content-Type: text/calendar; charset=UTF-8; method=REQUEST', 'Content-Transfer-Encoding: base64', '', b64(ics), '',
    `--${grans}--`, '',
  ].join('\r\n');
}

// --- Arkitekturen mot kontorsstödet ----------------------------------------------------------------------------------
export function arkitektur() {
  const o = (id, namn, hur, standard, sakerhet, status) => ({ id, namn, hur, standard, sakerhet, status });
  return {
    princip: 'Journalen stannar i Vårdkällan. Kontorsstödet får bara det användaren aktivt tar ut, i öppna standardformat, efter samma behörighetsprövning och logg som i journalen. Inget i Vårdkällan beror på en viss version av Office: formaten är standarder som Microsoft 365, Office 2019 och senare, LibreOffice och webbversionerna läser.',
    omraden: [
      o('ordbehandling', 'Ordbehandling', 'Journalanteckningar och utskrifter tas ut som Word-dokument från anteckningen. Dokumentet har patientens namn och personnummer, så det lämnas ut först när behörigheten är prövad, och uttaget loggas på patienten.', 'Office Open XML (DOCX, ISO/IEC 29500)', 'Kopian är inte en journalhandling. Ändringar görs i journalen, och dokumentet säger det.', 'byggt'),
      o('rapporter', 'Rapporter', 'Kassaredovisningen och kapacitetsprognosen tas ut som Word-dokument, och faktureringsunderlaget som CSV för Excel.', 'DOCX och CSV (RFC 4180)', 'Rapporterna har inga patientuppgifter.', 'byggt'),
      o('kalender', 'Kalender', 'Personalens bokade tider som kalenderprenumeration med en hemlig länk per person, som Outlook och andra kalenderprogram läser. En enskild tid kan också läggas in som inbjudan.', 'iCalendar (RFC 5545)', 'Länken ger tid, typ av uppgift och mottagning, aldrig vem patienten är, och "Upptagen" för det personen inte ska se. Den sparas bara som HMAC och kan återkallas.', 'byggt'),
      o('epost', 'E-post', 'Inbjudan till en tid som e-postmeddelande med kalenderdel. I demon lämnas meddelandet ut som fil i stället för att skickas.', 'iMIP (RFC 6047) och MIME', 'E-posten innehåller inga patientuppgifter. Patienter nås genom Min journal, sms eller brev, aldrig med e-post med journaluppgifter.', 'simulerat'),
      o('telefoni', 'Telefoni', 'Vid en telefontid ringer vårdgivaren upp patienten med en länk som regionens telefoni öppnar.', 'tel-URI (RFC 3966)', 'Numret visas bara när behörigheten är prövad, och för skyddade personuppgifter först efter ett aktivt val.', 'byggt'),
      o('video', 'Videosamtal', 'Varje videobesök får en möteslänk av sig själv, så att ingen behöver skapa mötet för hand.', 'Länk till videotjänsten (Teams eller regionens egen)', 'Länken innehåller en slumpad kod och inga patientuppgifter. I demon öppnar den en simulerad mötessida.', 'simulerat'),
      o('sharepoint', 'SharePoint', 'Dokumenten från ordbehandling och rapporter sparas i SharePoint av användaren, eller av en integration mot Microsoft Graph som sparar rapporter utan patientuppgifter i ett dokumentbibliotek. Integrationen är beskriven men inte byggd.', 'Microsoft Graph (REST och OAuth 2.0) eller WebDAV', 'Dokument med patientuppgifter hör hemma i journalen och sparas inte i SharePoint av systemet.', 'beskrivet'),
    ],
    overlapp: 'När både Vårdkällan och kontorsstödet har en funktion, till exempel kalender och dokument, är Vårdkällan källan och kontorsstödet visar en kopia. Kalendern hämtar om sig själv varje timme, och ett dokument säger att journalen gäller.',
    simulerat: 'Microsofts tjänster simuleras. Ingen e-post skickas, inga möten skapas i Teams och inget sparas i SharePoint.',
  };
}
