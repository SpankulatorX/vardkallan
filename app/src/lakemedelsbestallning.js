// Beställningar av läkemedel som inte är godkända produkter i NPL (runda 9, r1, Sussa 3.5.2.4): extempore från ett
// simulerat apotek, licensansökan till ett simulerat Läkemedelsverket och blodprodukter från en simulerad blodcentral,
// med status genom hela flödet.
//
// Systemet är experten. Ur ordinationen vet systemet vad som ska beställas och från vem: en extemporeberedning från
// apoteket, en blodprodukt från blodcentralen. Mängden räknar systemet ur ordinationen (extempore för sju dagar, blod
// i antal enheter ur dosen). En licens söks ur produkten, och systemet säger själv när en licens redan gäller och när den
// snart behöver förlängas. En beviljad licens registreras av systemet och bevakas sedan vid ordination och dos.
// Systemet stoppar en beställning som redan pågår för samma ordination och förklarar varför.
//
// De externa parterna är simulerade och märkta som simulerade. Svaret kommer när den demoknapp som simulerar parten
// används. Behörighet: att beställa extempore och blod kräver bestalla_lakemedel (läkare och sjuksköterska), en
// licensansökan kräver ordinationsrätt. Båda kräver vårdrelation på den egna vårdenheten. Allt loggas på patienten.
import { Fel, iso, idag, addDagar } from './db.js';
import { kanRoll } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
import { produkttyp, licensFor } from './lakemedelsstod.js';

export const PARTER = {
  extempore: { mottagare: 'Apoteket (simulerat)', text: 'Extemporeberedning' },
  licens: { mottagare: 'Läkemedelsverket (simulerat)', text: 'Licensansökan' },
  blod: { mottagare: 'Blodcentralen (simulerad)', text: 'Blodprodukt' },
};
// Statusarna i ordning för varje typ. Den simulerade parten flyttar beställningen ett steg i taget.
export const FLODE = {
  extempore: ['skickad', 'bekraftad', 'levererad'],
  licens: ['skickad', 'beviljad'],
  blod: ['skickad', 'bekraftad', 'levererad'],
};
export const STATUSTEXT = { skickad: 'Skickad', bekraftad: 'Bekräftad', levererad: 'Levererad', beviljad: 'Beviljad', makulerad: 'Makulerad' };
const EXTEMPORE_DAGAR = 7;
const TYP_FOR = { extempore: 'extempore', blodprodukt: 'blod', licens: 'licens' };

const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const tal = (x) => String(Math.round(x * 100) / 100).replace('.', ',');

export function synliga(atk) {
  const rader = atk.db.query('SELECT * FROM lakemedelsbestallningar WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, 'las_lakemedel', { gemensam: true });
}
export function bestallningUt(db, r) {
  const lm = katalog(db, r.lakemedel_id);
  return {
    id: r.id, typ: r.typ, typText: PARTER[r.typ].text, mottagare: PARTER[r.typ].mottagare, simulerad: true, lakemedel: lm ? { id: lm.id, namn: lm.namn, styrka: lm.styrka } : null,
    ordinationId: r.ordination_id, mangd: r.mangd, motivering: r.motivering, status: r.status, statusText: STATUSTEXT[r.status] ?? r.status, svar: r.svar,
    skapad: r.skapad, av: personNamn(db, r.av), licensId: r.licens_id,
    handelser: db.query('SELECT * FROM lakemedelsbestallning_handelser WHERE lakemedelsbestallning_id = ? ORDER BY tid, id').all(r.id).map(h => ({ status: h.status, statusText: STATUSTEXT[h.status] ?? h.status, tid: h.tid, text: h.text })),
  };
}

// Ordinationerna som behöver en beställning, och licensläkemedlen som behöver en ansökan, för att visa förslag.
export function forslag(atk) {
  const db = atk.db;
  const pagaende = new Set(synliga(atk).filter(b => !['levererad', 'beviljad', 'makulerad'].includes(b.status)).map(b => b.ordination_id ?? `lic:${b.lakemedel_id}`));
  const ut = [];
  for (const o of lakemedel.synligaOrdinationer(atk).filter(lakemedel.aktuell)) {
    const typ = TYP_FOR[produkttyp(db, o.lakemedel_id).typ];
    if (!typ || typ === 'licens' || pagaende.has(o.id)) continue;
    const lm = katalog(db, o.lakemedel_id);
    ut.push({ typ, ordinationId: o.id, lakemedel: lm.namn, mottagare: PARTER[typ].mottagare, mangd: mangdFor(db, typ, o, lm) });
  }
  return ut;
}
function mangdFor(db, typ, o, lm) {
  if (typ === 'blod') return `${tal(o.dos ?? 1)} ${(o.dos ?? 1) === 1 ? 'enhet' : 'enheter'}`;
  const k = /^([\d,]+)\s*mg\/ml$/.exec(lm.styrka ?? '');
  const perDag = o.vid_behov ? 4 : Math.max(1, o.tider ? JSON.parse(o.tider).length : 1);
  if (k && o.dos && o.dos_enhet === 'mg') return `${tal(o.dos / Number(k[1].replace(',', '.')) * perDag * EXTEMPORE_DAGAR)} ml för ${EXTEMPORE_DAGAR} dagar`;
  return `för ${EXTEMPORE_DAGAR} dagar`;
}

export function lista(atk) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  // Licensläkemedlen med licensens läge på den egna vårdenheten, för den som får söka licens.
  const licenser = kanRoll(atk.personal, 'ordinera') ? db.query("SELECT k.* FROM katalog k JOIN produkttyper p ON p.lakemedel_id = k.id WHERE p.typ = 'licens' ORDER BY k.namn").all()
    .map(lm => ({ id: lm.id, namn: lm.namn, licens: licensFor(db, lm.id, atk.patientId, atk.personal.enhet_id) })) : [];
  return { bestallningar: synliga(atk).map(r => bestallningUt(db, r)), forslag: kanBestalla(atk) ? forslag(atk) : [], licenser, simulerat: 'Apoteket, Läkemedelsverket och blodcentralen är simulerade i demon.' };
}
const kanBestalla = (atk) => kanRoll(atk.personal, 'bestalla_lakemedel') && atk.prova('bestalla_lakemedel').tillaten && atk.prova('bestalla_lakemedel').grund !== 'nodatkomst';
function krav(atk, handling, beskrivning) {
  const r = atk.krav(handling, { beskrivning });
  if (r.grund === 'nodatkomst' || r.grund === 'aktivt_val') {
    atk.logga(handling, 'nekad', beskrivning, 'nekad');
    throw new Fel(403, 'Det här kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
}

const handelse = (db, id, status, text) => db.query('INSERT INTO lakemedelsbestallning_handelser (lakemedelsbestallning_id, status, tid, text) VALUES (?, ?, ?, ?)').run(id, status, iso(), text);

// POST /api/patient/:id/lakemedelsbestallningar: { ordinationId } för extempore och blod, { lakemedelId, motivering,
// generell } för en licensansökan. Systemet bestämmer typen ur produkten.
export function bestall(atk, inp = {}) {
  const db = atk.db;
  if (inp.lakemedelId != null && inp.ordinationId == null) return ansokLicens(atk, inp);
  const o = lakemedel.synligaOrdinationer(atk).find(x => x.id === Number(inp.ordinationId));
  if (!o) throw new Fel(404, 'Ordinationen finns inte.', 'saknas');
  krav(atk, 'bestalla_lakemedel', `lakemedelsbestallning:ordination:${o.id}`);
  const lm = katalog(db, o.lakemedel_id);
  const typ = TYP_FOR[produkttyp(db, lm.id).typ];
  if (!typ || typ === 'licens') throw new Fel(400, `${lm.namn} beställs inte särskilt. ${typ === 'licens' ? 'Ett licensläkemedel behöver en licens, som söks för produkten.' : 'Godkända läkemedel tas från avdelningens förråd.'}`, 'ogiltig');
  if (synliga(atk).some(b => b.ordination_id === o.id && !['levererad', 'makulerad'].includes(b.status))) throw new Fel(400, `${lm.namn} är redan beställd och väntar på svar från ${PARTER[typ].mottagare.toLowerCase()}.`, 'ogiltig');
  const mangd = mangdFor(db, typ, o, lm);
  const r = db.query('INSERT INTO lakemedelsbestallningar (patient_id, enhet_id, typ, lakemedel_id, ordination_id, mangd, motivering, status, skapad, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, typ, lm.id, o.id, mangd, null, 'skickad', iso(), atk.personal.id);
  const id = Number(r.lastInsertRowid);
  handelse(db, id, 'skickad', `Skickad till ${PARTER[typ].mottagare.toLowerCase()}: ${lm.namn}, ${mangd}.`);
  atk.logga('bestalla_lakemedel', atk.grund(), `lakemedelsbestallning:${id}`);
  return { bestallning: bestallningUt(db, rad(db, id)) };
}

function ansokLicens(atk, inp) {
  const db = atk.db;
  krav(atk, 'ordinera', 'lakemedelsbestallning:licens');
  const lm = typeof inp.lakemedelId === 'string' ? katalog(db, inp.lakemedelId) : null;
  if (!lm || produkttyp(db, lm.id).typ !== 'licens') throw new Fel(400, 'Välj ett licensläkemedel. Andra läkemedel behöver ingen licens.', 'ogiltig', { falt: ['lakemedelId'] });
  const l = licensFor(db, lm.id, atk.patientId, atk.personal.enhet_id);
  if (l.giltig && l.licens.giltigTill > addDagar(idag(), 30)) throw new Fel(400, `Licensen ${l.licens.licensnummer} gäller till ${l.licens.giltigTill}. Ingen ny ansökan behövs förrän en månad innan den går ut.`, 'ogiltig');
  if (synliga(atk).some(b => b.typ === 'licens' && b.lakemedel_id === lm.id && b.status === 'skickad')) throw new Fel(400, `En licensansökan för ${lm.namn} väntar redan på beslut.`, 'ogiltig');
  const motivering = typeof inp.motivering === 'string' ? inp.motivering.trim().slice(0, 500) : '';
  if (motivering.length < 10) throw new Fel(400, 'Motivera varför ett godkänt läkemedel inte räcker för patienten, med minst tio tecken. Läkemedelsverket kräver det.', 'ogiltig', { falt: ['motivering'] });
  const r = db.query('INSERT INTO lakemedelsbestallningar (patient_id, enhet_id, typ, lakemedel_id, ordination_id, mangd, motivering, status, skapad, av) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, 'licens', lm.id, inp.generell ? 'Generell licens för vårdenheten' : 'Licens för patienten', motivering, 'skickad', iso(), atk.personal.id);
  const id = Number(r.lastInsertRowid);
  handelse(db, id, 'skickad', `${l.giltig ? 'Förlängning' : 'Ansökan'} skickad till Läkemedelsverket (simulerat).`);
  atk.logga('ordinera', atk.grund(), `lakemedelsbestallning:${id}`);
  return { bestallning: bestallningUt(db, rad(db, id)), forlangning: l.giltig };
}

const rad = (db, id) => db.query('SELECT * FROM lakemedelsbestallningar WHERE id = ?').get(id);
export function hamtaRad(db, id) {
  const r = rad(db, Number(id));
  if (!r) throw new Fel(404, 'Beställningen finns inte.', 'saknas');
  return r;
}

// Den simulerade parten svarar: beställningen går ett steg vidare. En beviljad licens registreras för patienten eller
// vårdenheten i ett år, och blodcentralen skickar enheter med påhittade enhetsnummer.
export function simuleraSvar(atk, id) {
  const db = atk.db;
  const r = synliga(atk).find(x => x.id === Number(id));
  if (!r) throw new Fel(404, 'Beställningen finns inte.', 'saknas');
  krav(atk, r.typ === 'licens' ? 'ordinera' : 'bestalla_lakemedel', `lakemedelsbestallning:${r.id}:svar`);
  const steg = FLODE[r.typ];
  const i = steg.indexOf(r.status);
  if (i < 0 || i === steg.length - 1) throw new Fel(400, `Beställningen är redan ${STATUSTEXT[r.status].toLowerCase()}.`, 'ogiltig');
  const nasta = steg[i + 1];
  const lm = katalog(db, r.lakemedel_id);
  let svar = null;
  let licensId = null;
  if (nasta === 'beviljad') {
    const nr = `DEMO-LIC-${String(1000 + r.id).padStart(4, '0')}`;
    const generell = r.mangd.startsWith('Generell');
    licensId = Number(db.query('INSERT INTO licenser (lakemedel_id, patient_id, enhet_id, licensnummer, giltig_fran, giltig_till, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(lm.id, generell ? null : r.patient_id, r.enhet_id, nr, idag(), addDagar(idag(), 365), iso()).lastInsertRowid);
    svar = `Licens ${nr} beviljad till ${addDagar(idag(), 365)}.`;
  } else if (nasta === 'bekraftad') svar = r.typ === 'blod' ? 'Blodcentralen har gjort förlikningen och reserverat enheterna.' : `Apoteket tillverkar beredningen och levererar ${addDagar(idag(), 1)}.`;
  else if (nasta === 'levererad') svar = r.typ === 'blod' ? `Levererad med det påhittade enhetsnumret ${String(500000 + r.id)}.` : 'Levererad till avdelningen.';
  db.query('UPDATE lakemedelsbestallningar SET status = ?, svar = ?, licens_id = coalesce(?, licens_id) WHERE id = ?').run(nasta, svar, licensId, r.id);
  handelse(db, r.id, nasta, svar);
  atk.logga(r.typ === 'licens' ? 'ordinera' : 'bestalla_lakemedel', atk.grund(), `lakemedelsbestallning:${r.id}:svar`);
  return { bestallning: bestallningUt(db, rad(db, r.id)) };
}
