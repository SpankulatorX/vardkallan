// Runda 12, r1: läkemedelsmallar som läkaren bygger och ändrar i gränssnittet (vårt D11, Sussa 3.5.1.3). En ny mall för
// en substans och en ändrad mall blir en ny version i substansmallar, och den används på vårdenheten först när den
// läkare som verksamhetschefen har utsett som mallansvarig har godkänt den (mallgodkannande.js, Gröna häftet 688488 R5
// avsnitt 1.4.3). Godkännandet görs som förut i den mallansvarigas inkorg.
//
// Systemet är experten: det föreslår dos och enhet ur produktens styrka i katalogen, typ, tider och uppföljning, skriver
// vad som ändras mot den förra versionen och säger vem som ska godkänna mallen innan den används. Förslagen är
// demoregler och inte doseringsstöd.
import { Fel, iso } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import { gallande } from './lakemedelsansvar.js';
import { andraSubstansmall, skillnad } from './mallgodkannande.js';

const TYPER = { staende: 'stående', vid_behov: 'vid behov', tillfallig: 'tillfällig' };
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max + 1) : '');
const mgAv = (styrka) => { const m = /^([\d,]+)\s*(mg|g|mikrogram)$/.exec(styrka ?? ''); if (!m) return null; const v = Number(m[1].replace(',', '.')); return m[2] === 'g' ? v * 1000 : m[2] === 'mikrogram' ? v / 1000 : v; };

function kravLakare(db, personal) {
  if (personal?.yrke !== 'lakare' || !kanRoll(personal, 'faststalla_mall')) {
    if (personal) loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'godkanna_mall', resurs: 'mall:substans:ny', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'En läkemedelsmall byggs och ändras av en läkare, och godkänns sedan av den mallansvariga läkaren.', 'nekad');
  }
}

// Substanserna i katalogen, med och utan mall, och förslaget för en ny mall ur den första produkten med substansen.
function substanser(db) {
  const mallar = new Set(db.query('SELECT DISTINCT atc FROM substansmallar').all().map(r => r.atc));
  const ut = new Map();
  for (const lm of db.query('SELECT * FROM katalog ORDER BY substans, namn').all()) {
    if (ut.has(lm.atc)) continue;
    const mg = mgAv(lm.styrka);
    ut.set(lm.atc, { atc: lm.atc, substans: lm.substans, harMall: mallar.has(lm.atc),
      forslag: { namn: `${lm.substans}${lm.styrka ? ` ${lm.styrka}` : ''}`, dosering: /tablett|kapsel/i.test(lm.form ?? '') ? `1 ${/kapsel/i.test(lm.form) ? 'kapsel' : 'tablett'} på morgonen` : '', dos: mg ?? '', dosEnhet: mg ? 'mg' : '', tider: ['08'], typ: 'staende', uppfoljning: 14 } });
  }
  return [...ut.values()];
}

// Prövar fälten i en ny mall och ger mallens innehåll. Fel som en lista.
function provaNy(db, inp, fel) {
  const atc = text(inp.atc, 10);
  const s = substanser(db).find(x => x.atc === atc);
  if (!s) fel.push('Välj en substans ur läkemedelskatalogen.');
  else if (s.harMall) fel.push(`${s.substans} har redan en läkemedelsmall. Ändra den i stället, så att substansen inte får två mallar.`);
  const namn = text(inp.namn, 80);
  if (namn.length < 3 || namn.length > 80) fel.push('Ge mallen ett namn på 3 till 80 tecken, som förskrivaren ser.');
  const dosering = text(inp.dosering, 200);
  if (dosering.length < 3 || dosering.length > 200) fel.push('Skriv doseringen som förskrivaren ska få som förslag, högst 200 tecken.');
  const dos = Number(String(inp.dos ?? '').replace(',', '.'));
  if (!Number.isFinite(dos) || dos <= 0 || dos > 10000) fel.push('Ange dosen som ett tal större än 0 i produktens enhet.');
  const dosEnhet = text(inp.dosEnhet, 20);
  if (!dosEnhet) fel.push('Ange dosens enhet, till exempel mg.');
  const typ = inp.typ ?? 'staende';
  if (!Object.hasOwn(TYPER, typ)) fel.push('Typen ska vara stående, vid behov eller tillfällig.');
  const tider = (Array.isArray(inp.tider) ? inp.tider : String(inp.tider ?? '').split(/[,\s]+/)).map(String).map(t => t.trim()).filter(Boolean);
  const felTid = tider.find(t => !/^([01]\d|2[0-3])$/.test(t));
  if (felTid) fel.push(`${felTid} är inget klockslag. Skriv timmen med två siffror, till exempel 08 och 20.`);
  if (typ === 'staende' && !tider.length) fel.push('En stående ordination behöver minst en tid.');
  const uppfoljning = Number(inp.uppfoljning);
  if (!Number.isInteger(uppfoljning) || uppfoljning < 1 || uppfoljning > 365) fel.push('Uppföljningen anges i hela dagar, 1 till 365. Systemet sätter uppföljningsdatumet i ordinationen.');
  return { atc, namn, dosering, dos, dosEnhet, typ, ...(tider.length && typ !== 'vid_behov' ? { tider: tider.slice(0, 8) } : {}), uppfoljning };
}

const godkannsAv = (db, personal) => {
  const ve = vardenhetFor(db, personal.enhet_id);
  const a = gallande(db, ve, 'mallansvarig').map(u => personNamn(db, u.personal_id));
  return a.length ? `Mallen används på ${enhetsnamn(db, ve)} först när ${a.join(' eller ')} har godkänt den.` : `${enhetsnamn(db, ve)} har ingen läkare ansvarig för läkemedelsmallar, så mallen kan inte godkännas förrän verksamhetschefen har utsett en.`;
};

// Förhandsvisning av en ny mall (ingen mall för atc) eller en ändring. Inga patientuppgifter.
export function forhandsvisa(db, personal, inp = {}) {
  kravLakare(db, personal);
  const forra = db.query('SELECT * FROM substansmallar WHERE atc = ? ORDER BY version DESC LIMIT 1').get(text(inp.atc, 10));
  const fel = [];
  if (!forra) {
    const m = provaNy(db, inp, fel);
    return { ok: !fel.length, fel, ny: true, mall: m, andringar: fel.length ? [] : [`Ny läkemedelsmall för ${m.namn}: ${m.dosering}, ${TYPER[m.typ]}, uppföljning efter ${m.uppfoljning} dagar.`, godkannsAv(db, personal)] };
  }
  const gammal = JSON.parse(forra.innehall);
  const ny = provaAndring(gammal, inp, fel);
  const andringar = fel.length ? [] : skillnad(gammal, ny);
  if (!fel.length && !andringar.length) fel.push('Mallen är oförändrad. Ändra något innan den sparas som en ny version.');
  return { ok: !fel.length, fel, ny: false, version: forra.version + 1, andringar: fel.length ? [] : [...andringar, godkannsAv(db, personal)] };
}

// Samma prövning som när ändringen sparas (mallgodkannande.andraSubstansmall), som en lista med fel.
function provaAndring(gammal, inp, fel) {
  const ny = { ...gammal };
  for (const k of ['dosering', 'dosEnhet']) if (typeof inp[k] === 'string' && inp[k].trim()) ny[k] = inp[k].trim().slice(0, 200);
  if (inp.typ != null) { if (!Object.hasOwn(TYPER, inp.typ)) fel.push('Typen ska vara stående, vid behov eller tillfällig.'); else ny.typ = inp.typ; }
  for (const [k, namn] of [['dos', 'dosen'], ['uppfoljning', 'uppföljningen']]) {
    if (inp[k] == null || inp[k] === '') continue;
    const v = Number(String(inp[k]).replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0 || v > 10000) fel.push(`Kontrollera ${namn}.`); else ny[k] = v;
  }
  if (inp.tider != null) {
    const tider = (Array.isArray(inp.tider) ? inp.tider : String(inp.tider).split(/[,\s]+/)).map(String).filter(Boolean);
    const felTid = tider.find(t => !/^([01]\d|2[0-3])$/.test(t));
    if (felTid) fel.push(`${felTid} är inget klockslag. Skriv timmen med två siffror, till exempel 08 och 20.`); else ny.tider = tider.slice(0, 8);
  }
  return ny;
}

// Skapar en ny läkemedelsmall som version 1. Den väntar sedan på den mallansvarigas godkännande.
export function skapa(db, personal, inp = {}) {
  kravLakare(db, personal);
  const fel = [];
  const m = provaNy(db, inp, fel);
  if (fel.length) throw new Fel(400, fel[0], 'ogiltig', { fel });
  const { atc, ...innehall } = m;
  const r = db.query('INSERT INTO substansmallar (atc, namn, innehall, version, upprattad_av, upprattad, andring) VALUES (?, ?, ?, 1, ?, ?, ?)')
    .run(atc, m.namn, JSON.stringify(innehall), personal.id, iso(), `Ny läkemedelsmall, upprättad av ${personal.namn}.`);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'godkanna_mall', resurs: `mall:substans:${r.lastInsertRowid}:ny`, grund: 'administrativ' });
  return { id: Number(r.lastInsertRowid), atc, namn: m.namn, version: 1, status: 'vantar', text: godkannsAv(db, personal) };
}

// Ändrar en mall genom den befintliga vägen, med tiderna som en lista.
export function andra(db, personal, atc, inp = {}) {
  kravLakare(db, personal);
  const tider = typeof inp.tider === 'string' ? inp.tider.split(/[,\s]+/).filter(Boolean) : inp.tider;
  return { ...andraSubstansmall(db, personal, atc, { ...inp, tider }), text: godkannsAv(db, personal) };
}

// Substanserna som läkaren kan bygga en mall för, med systemets förslag.
export function byggstenar(db, personal) {
  kravLakare(db, personal);
  return { substanser: substanser(db).filter(s => !s.harMall), typer: TYPER, anmarkning: 'Förslagen är demoregler för att visa flödet. De är inte doseringsstöd.' };
}
