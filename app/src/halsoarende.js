// Hälsoärenden som ändras (Sussa 6.1.1.2): ett ärende kan avslutas och öppnas igen, delas och slås ihop med ett annat,
// och en vårdkontakt kan flyttas mellan ärenden. Varje ändring sparas i ärendets historik, som aldrig ändras.
//
// Systemet är experten. Det föreslår att två ärenden med samma diagnoskategori slås ihop och att ett ärende utan
// kontakter det senaste halvåret avslutas (demoregel), med skälet utskrivet, och användaren bekräftar med ett klick.
// Vid delning och flytt väljer användaren bara bland de kontakter som systemet visar.
//
// Behörighet. Läkare och sjuksköterskor ändrar hälsoärenden (handlingen halsoarende), bara ärenden som de får se och
// bara de vårdkontakter som de får se. En kontakt som användaren inte får se, bakom inre sekretess eller spärr, ligger
// alltid kvar i sitt ärende och nämns inte. Ett ärende med en kontakt som användaren inte får se slås inte ihop och
// avslutas inte av den användaren, så att ingen ändrar det som någon annan vårdenhet har dokumenterat utan att se det.
// Nödåtkomst ger bara läsning. Varje ändring loggas på patienten.
import { Fel, iso } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
// Runda 7, r4: parametrar som systemförvaltningen kan ändra.
import * as konfiguration from './konfiguration.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS halsoarende_historik (
  id INTEGER PRIMARY KEY, halsoarende_id INTEGER NOT NULL, patient_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, enhet_id TEXT,
  typ TEXT NOT NULL, text TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS ha_historik_andras_ej BEFORE UPDATE ON halsoarende_historik BEGIN SELECT RAISE(ABORT, 'Hälsoärendets historik ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS ha_historik_raderas_ej BEFORE DELETE ON halsoarende_historik BEGIN SELECT RAISE(ABORT, 'Hälsoärendets historik raderas inte'); END;
`;
export function sakraSchema(db) {
  db.exec(SCHEMA);
  const kol = db.query('PRAGMA table_info(halsoarenden)').all().map(k => k.name);
  if (kol.length && !kol.includes('sammanslaget_med')) db.exec('ALTER TABLE halsoarenden ADD COLUMN sammanslaget_med INTEGER');
  if (kol.length && !kol.includes('avslutat')) db.exec('ALTER TABLE halsoarenden ADD COLUMN avslutat TEXT');
}
export const DEMOREGEL_AVSLUTA_DAGAR = 180;

const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const synligKontakt = (atk, v) => atk.prova('las_admin', { enhet_id: v.enhet_id }).tillaten;
const kontakter = (db, id) => db.query('SELECT * FROM vardkontakter WHERE halsoarende_id = ? ORDER BY start, id').all(id);

export function historik(db, id) {
  return db.query('SELECT * FROM halsoarende_historik WHERE halsoarende_id = ? ORDER BY tid DESC, id DESC').all(id)
    .map(h => ({ id: h.id, tid: h.tid, typ: h.typ, text: h.text, av: personKort(db, h.av), enhet: enhetKort(db, h.enhet_id) }));
}
const logg = (db, atk, id, typ, t, detalj = null) => db.query('INSERT INTO halsoarende_historik (halsoarende_id, patient_id, tid, av, enhet_id, typ, text, detalj) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .run(id, atk.patientId, iso(), atk.personal.id, atk.personal.enhet_id, typ, t, detalj ? JSON.stringify(detalj) : null);

// Ärendet om användaren får se det, annars 404 som om det inte fanns.
function arende(atk, id) {
  const h = atk.db.query('SELECT * FROM halsoarenden WHERE id = ? AND patient_id = ?').get(Number(id), atk.patientId);
  if (!h || !atk.prova('las_admin', { enhet_id: h.enhet_id }).tillaten) throw new Fel(404, 'Hälsoärendet finns inte.', 'saknas');
  return h;
}
function kravAndra(atk) {
  const r = atk.krav('halsoarende', { beskrivning: 'halsoarende' });
  if (r.grund === 'nodatkomst') {
    atk.logga('halsoarende', 'nekad', 'halsoarende', 'nekad');
    throw new Fel(403, 'Att ändra hälsoärenden kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
}
const alltSynligt = (atk, h) => kontakter(atk.db, h.id).every(v => synligKontakt(atk, v));

// Systemets förslag på ändringar: slå ihop ärenden med samma diagnoskategori och avsluta ärenden utan kontakter det
// senaste halvåret. Bara ärenden som användaren får se helt.
export function forslag(atk, nu = Date.now()) {
  if (!kanRoll(atk.personal, 'halsoarende')) return [];
  const db = atk.db;
  const synliga = db.query("SELECT * FROM halsoarenden WHERE patient_id = ? AND status = 'aktivt'").all(atk.patientId)
    .filter(h => atk.prova('las_admin', { enhet_id: h.enhet_id }).tillaten && alltSynligt(atk, h));
  const ut = [];
  const perKod = new Map();
  for (const h of synliga) if (h.kod) { const k = h.kod.slice(0, 3); perKod.set(k, [...(perKod.get(k) ?? []), h]); }
  for (const [k, lista] of perKod) {
    if (lista.length < 2) continue;
    const [forsta, ...ovriga] = lista.sort((a, b) => a.id - b.id);
    for (const o of ovriga) ut.push({ typ: 'sla_ihop', halsoarendeId: forsta.id, med: o.id, text: `Ärendena ${forsta.rubrik} och ${o.rubrik} har samma diagnoskategori (${k}). Slå ihop dem?` });
  }
  // Runda 7, r4: dagarna kan ändras av systemförvaltningen (konfiguration.js). DEMOREGEL_AVSLUTA_DAGAR är standardvärdet.
  const avslutaDagar = konfiguration.varde(db, 'halsoarende.avsluta_dagar', new Date(nu));
  const grans = new Date(nu - avslutaDagar * 86400_000).toISOString();
  for (const h of synliga) {
    const vk = kontakter(db, h.id);
    if (vk.length && vk.every(v => v.slut && v.slut < grans)) ut.push({ typ: 'avsluta', halsoarendeId: h.id, text: `Ärendet ${h.rubrik} har inga vårdkontakter de senaste ${avslutaDagar} dagarna. Avsluta det? (demoregel)` });
  }
  return ut;
}

// Ändringen. atgard är avsluta, oppna, dela, sla-ihop eller flytta (en kontakt till ett annat ärende).
export function andra(atk, id, atgard, body = {}) {
  kravAndra(atk);
  const db = atk.db;
  const h = arende(atk, id);
  const t = iso();
  let svar = h.id;
  switch (atgard) {
    case 'avsluta':
      if (h.status !== 'aktivt') throw new Fel(400, 'Ärendet är inte aktivt.', 'ogiltig');
      if (!alltSynligt(atk, h)) throw new Fel(400, 'Ärendet har vårdkontakter från en annan vårdenhet som du inte ser. Det avslutas av den vårdenheten.', 'ogiltig');
      db.query("UPDATE halsoarenden SET status = 'avslutat', avslutat = ? WHERE id = ?").run(t, h.id);
      logg(db, atk, h.id, 'avslutat', `Ärendet avslutades.${text(body.orsak) ? ` ${text(body.orsak)}` : ''}`);
      break;
    case 'oppna':
      if (h.status !== 'avslutat') throw new Fel(400, 'Ärendet är inte avslutat.', 'ogiltig');
      db.query("UPDATE halsoarenden SET status = 'aktivt', avslutat = NULL WHERE id = ?").run(h.id);
      logg(db, atk, h.id, 'oppnat', 'Ärendet öppnades igen.');
      break;
    case 'dela': {
      const ids = (Array.isArray(body.kontakter) ? body.kontakter : []).map(Number);
      const egna = kontakter(db, h.id).filter(v => synligKontakt(atk, v));
      const valda = egna.filter(v => ids.includes(v.id));
      if (!valda.length || valda.length !== ids.length) throw new Fel(400, 'Välj de vårdkontakter i ärendet som ska bli ett eget ärende.', 'ogiltig', { falt: ['kontakter'] });
      if (valda.length === kontakter(db, h.id).length) throw new Fel(400, 'Minst en vårdkontakt ska ligga kvar i ärendet.', 'ogiltig', { falt: ['kontakter'] });
      const rubrik = text(body.rubrik, 120) || `Del av ${h.rubrik}`;
      const nytt = Number(db.query('INSERT INTO halsoarenden (patient_id, enhet_id, rubrik, kod, grund, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(atk.patientId, atk.personal.enhet_id, rubrik, h.kod, 'delning', t, atk.personal.id).lastInsertRowid);
      db.query(`UPDATE vardkontakter SET halsoarende_id = ? WHERE halsoarende_id = ? AND id IN (${valda.map(() => '?').join(', ')})`).run(nytt, h.id, ...valda.map(v => v.id));
      logg(db, atk, h.id, 'delat', `${valda.length === 1 ? 'En vårdkontakt' : `${valda.length} vårdkontakter`} flyttades till det nya ärendet ${rubrik}.`, { till: nytt, kontakter: valda.map(v => v.id) });
      logg(db, atk, nytt, 'skapat', `Skapat genom delning av ärendet ${h.rubrik}.`, { fran: h.id, kontakter: valda.map(v => v.id) });
      svar = nytt;
      break;
    }
    case 'sla-ihop': {
      const o = arende(atk, body.med);
      if (o.id === h.id || o.status === 'sammanslaget' || h.status === 'sammanslaget') throw new Fel(400, 'Välj ett annat ärende att slå ihop med.', 'ogiltig', { falt: ['med'] });
      if (!alltSynligt(atk, o) || !alltSynligt(atk, h)) throw new Fel(400, 'Ärendena har vårdkontakter från en annan vårdenhet som du inte ser. De slås ihop av den vårdenheten.', 'ogiltig');
      const n = kontakter(db, o.id).length;
      db.query('UPDATE vardkontakter SET halsoarende_id = ? WHERE halsoarende_id = ?').run(h.id, o.id);
      db.query("UPDATE halsoarenden SET status = 'sammanslaget', sammanslaget_med = ? WHERE id = ?").run(h.id, o.id);
      if (h.status === 'avslutat') db.query("UPDATE halsoarenden SET status = 'aktivt', avslutat = NULL WHERE id = ?").run(h.id);
      logg(db, atk, h.id, 'sammanslaget', `Ärendet ${o.rubrik} slogs ihop med det här, med ${n === 1 ? 'en vårdkontakt' : `${n} vårdkontakter`}.`, { med: o.id });
      logg(db, atk, o.id, 'sammanslaget', `Slogs ihop med ärendet ${h.rubrik}.`, { till: h.id });
      break;
    }
    case 'flytta': {
      const v = db.query('SELECT * FROM vardkontakter WHERE id = ? AND patient_id = ? AND halsoarende_id = ?').get(Number(body.kontakt), atk.patientId, h.id);
      if (!v || !synligKontakt(atk, v)) throw new Fel(400, 'Vårdkontakten finns inte i ärendet.', 'ogiltig', { falt: ['kontakt'] });
      let till = null;
      if (body.till != null) {
        const m = arende(atk, body.till);
        if (m.id === h.id || m.status === 'sammanslaget') throw new Fel(400, 'Välj ett annat ärende.', 'ogiltig', { falt: ['till'] });
        till = m;
      }
      db.query('UPDATE vardkontakter SET halsoarende_id = ? WHERE id = ?').run(till?.id ?? null, v.id);
      const vad = `vårdkontakten ${v.orsak ?? ''} ${new Date(v.start).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })}`.replace(/\s+/g, ' ').trim();
      logg(db, atk, h.id, 'kontakt_ut', till ? `Flyttade ${vad} till ärendet ${till.rubrik}.` : `Tog bort ${vad} ur ärendet.`, { kontakt: v.id, till: till?.id ?? null });
      if (till) logg(db, atk, till.id, 'kontakt_in', `Fick ${vad} från ärendet ${h.rubrik}.`, { kontakt: v.id, fran: h.id });
      break;
    }
    default: throw new Fel(404, 'Okänd ändring av hälsoärendet.', 'saknas');
  }
  atk.logga('halsoarende', atk.grund(), `halsoarende:${h.id}:${atgard}`);
  const ut = db.query('SELECT * FROM halsoarenden WHERE id = ?').get(svar);
  return { id: ut.id, rubrik: ut.rubrik, status: ut.status, kontakter: kontakter(db, ut.id).filter(x => synligKontakt(atk, x)).map(x => x.id), historik: historik(db, ut.id) };
}

// Historik och förslag för ett ärende som användaren får se.
export function detalj(atk, id) {
  atk.krav('las_admin');
  const h = arende(atk, id);
  return { id: h.id, rubrik: h.rubrik, status: h.status, sammanslagetMed: h.sammanslaget_med ?? null, historik: historik(atk.db, h.id), kanAndra: kanRoll(atk.personal, 'halsoarende') && atk.prova('halsoarende').grund !== 'nodatkomst' };
}
