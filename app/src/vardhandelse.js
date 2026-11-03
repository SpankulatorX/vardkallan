// Planerad vårdhändelse i tidboken (Sussa 3.5.2.7 och 3.5.2.14). En ordination som ska ges före eller efter en
// vårdhändelse, till exempel en elkonvertering, får sin tid från tidboken.
//
// Systemet är experten:
//   - När läkaren ordinerar till en planerad vårdhändelse föreslår systemet patientens bokningar och väntande poster på
//     den egna vårdenheten, med den som passar ordinationen först. Läkaren väljer med ett klick.
//   - Finns ingen bokning sätter systemet upp vårdhändelsen på väntelistan, så att vårdadministratören ser den i Dagens
//     arbete och bokar den som vanligt.
//   - När tiden bokas, bokas om eller avbokas räknar systemet om när läkemedlet ska ges (synka), utan att någon gör
//     något, och skriver det i ordinationens historik. Sjuksköterskan ser tiden och förklaringen i Läkemedel att ge.
//   - Vårdadministratören ser bara att tiden styr en läkemedelsdos, aldrig läkemedlet.
//   - Den manuella tidsättningen (ordinationsmallar.tidsattHandelse) finns kvar som reserv. Då följer vårdhändelsen
//     inte längre tidboken.
//
// Behörighet. Att knyta en ordination till tidboken kräver handlingen ordinera och vårdrelation till patienten på den
// egna vårdenheten. Nödåtkomst ger bara läsning, och bara den egna vårdenhetens bokningar och väntelista kan användas,
// så att inget från en annan vårdenhet, bakom inre sekretess eller spärr, röjs. Kopplingen skapar ingen vårdkontakt och
// ingen vårdrelation: bokningen ger den vårdrelation som tidboken redan ger.
//
// Kopplingen sparas i en egen tabell. Vårdhändelsens tid finns i ordination_tillagg (handelse_tid), så att dostiderna
// räknas som förut.
import { Fel, iso, idag, addDagar } from './db.js';
import { vardenhetFor, enheterUnder } from './atkomst.js';
import * as tidbok from './tidbok.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS vardhandelse_kopplingar (
  ordination_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, bokning_id INTEGER, vantelista_id INTEGER,
  egen_post INTEGER NOT NULL DEFAULT 0, foljer INTEGER NOT NULL DEFAULT 1, lage TEXT NOT NULL, forklaring TEXT,
  skapad TEXT NOT NULL, skapad_av TEXT, andrad TEXT, egen_text INTEGER NOT NULL DEFAULT 0,
  CHECK (lage IN ('bokad', 'vantar', 'avbokad', 'avslutad', 'manuell', 'utan_tidbok'))
);
CREATE INDEX IF NOT EXISTS ix_vh_patient ON vardhandelse_kopplingar (patient_id);
`;
export function sakraSchema(db) {
  db.exec(SCHEMA);
  // egen_text: vårdhändelsens namn skrevs av läkaren och kommer inte från en bokning eller väntelistan.
  if (!db.query('PRAGMA table_info(vardhandelse_kopplingar)').all().some(k => k.name === 'egen_text')) db.exec('ALTER TABLE vardhandelse_kopplingar ADD COLUMN egen_text INTEGER NOT NULL DEFAULT 0');
}

// Det vårdadministratören ser i bokningsdialogen. Aldrig läkemedlet.
export const STYR_LAKEMEDEL = 'Tiden styr när en läkemedelsdos ska ges. Bokas tiden om eller avbokas räknar systemet om dosen av sig själv.';
// Hur långt fram en bokning föreslås, samma gräns som den manuella tidsättningen.
const FRAM_DAGAR = 60;
const MIN = 60_000;
const DAG = 86400_000;
const AKTIVA = ['bokad', 'incheckad'];

const finnsTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vardhandelse_kopplingar'").get());
const kopplingRad = (db, ordinationId) => (finnsTabell(db) ? db.query('SELECT * FROM vardhandelse_kopplingar WHERE ordination_id = ?').get(ordinationId) : null);
const tillaggRad = (db, ordinationId) => db.query('SELECT * FROM ordination_tillagg WHERE ordination_id = ?').get(ordinationId);
const bokning = (db, id) => (id ? db.query('SELECT * FROM bokningar WHERE id = ?').get(Number(id)) : null);
const post = (db, id) => (id ? db.query('SELECT * FROM vantelista WHERE id = ?').get(Number(id)) : null);
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const harTidbok = (db, ve) => Boolean(db.query(`SELECT 1 FROM scheman WHERE enhet_id IN (${enheterUnder(db, ve).map(() => '?').join(', ')})`).get(...enheterUnder(db, ve)));
const bokningensVardenhet = (db, b) => vardenhetFor(db, tidbok.bokningensEnhet(db, b));
const tidFor = (db, b) => tidbok.tidRad(db, b.tid_id);
const plus = (t, min) => new Date(Date.parse(t) + (min ?? 0) * MIN).toISOString();
const historik = (db, ordinationId, av, handelse, detalj) => db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)')
  .run(ordinationId, iso(), av, handelse, detalj);
const forsta = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

// Att knyta en ordination till tidboken: ordinera och vårdrelation på den egna vårdenheten. Nödåtkomst ger bara läsning.
// Nekade försök loggas.
function kravKoppla(atk, beskrivning) {
  const r = atk.krav('ordinera', { beskrivning });
  if (r.grund === 'nodatkomst') {
    atk.logga('ordinera', 'nekad', beskrivning, 'nekad');
    throw new Fel(403, 'Att knyta en ordination till en vårdhändelse kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
  return r;
}
const nekaAnnanEnhet = (atk, beskrivning) => {
  atk.logga('ordinera', 'nekad', beskrivning, 'nekad');
  throw new Fel(403, 'Ordinationen kan bara knytas till bokningar och väntelistan på din egen vårdenhet.', 'nekad');
};

// Ord som säger vad vårdhändelsen är, för att hitta den bokning som passar ordinationen.
const ord = (t) => new Set(String(t ?? '').toLowerCase().split(/[^a-zåäöé0-9]+/).filter(w => w.length >= 5));
const passar = (text, orsak) => { const a = ord(text); return [...ord(orsak)].some(w => a.has(w)); };

// Förslagen: patientens kommande bokningar och väntande poster på den egna vårdenheten, och en ny post på väntelistan.
// text är ordinationsorsaken eller det läkaren har skrivit, och den bokning som passar den föreslås först.
export function forslag(atk, { text = '' } = {}) {
  kravKoppla(atk, 'vardhandelse:forslag');
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const nu = Date.now();
  const bokningar = db.query(`SELECT b.*, t.start, t.tidstyp, s.personal_id, s.enhet_id AS mottagning FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id
    WHERE b.patient_id = ? AND s.enhet_id IN (${ph}) AND b.status IN ('bokad', 'incheckad') AND t.tidstyp <> 'grupp' AND t.start >= ? AND t.start <= ? ORDER BY t.start, b.id`)
    .all(atk.patientId, ...enheter, new Date(nu - 12 * 3600_000).toISOString(), new Date(nu + FRAM_DAGAR * DAG).toISOString())
    .map(b => ({
      id: b.id, start: b.start, text: b.orsak || tidbok.TIDSTYPER[b.tidstyp].text, tidstyp: b.tidstyp, tidstypText: tidbok.TIDSTYPER[b.tidstyp].text,
      vardgivare: personNamn(db, b.personal_id), mottagning: db.query('SELECT namn FROM enheter WHERE id = ?').get(b.mottagning)?.namn ?? null, rekommenderad: false,
    }));
  const poster = db.query("SELECT * FROM vantelista WHERE patient_id = ? AND enhet_id = ? AND status = 'vantar' ORDER BY mal, id").all(atk.patientId, ve)
    .map(p => ({ id: p.id, text: p.orsak, tidstypText: tidbok.TIDSTYPER[p.tidstyp]?.text, yrkesrollText: tidbok.YRKESROLL[p.yrkesroll], mal: p.mal, rekommenderad: false }));
  // Den bokning eller post som passar texten först, annars den första bokningen.
  const alla = [...bokningar, ...poster];
  const bast = alla.find(x => passar(text, x.text)) ?? bokningar[0] ?? null;
  if (bast) bast.rekommenderad = true;
  const kan = harTidbok(db, ve);
  return {
    bokningar, vantelista: poster,
    ny: { mojlig: kan, text: kan ? 'Vårdhändelsen sätts upp på väntelistan, och vårdadministratören bokar tiden. När den är bokad räknar systemet fram när läkemedlet ska ges.'
      : 'Din vårdenhet har ingen tidbok i demon. Ange tiden för vårdhändelsen när den är bestämd.' },
    hjalp: 'Vårdadministratören ser vårdhändelsens namn men aldrig läkemedlet. Skriv därför bara vad vårdhändelsen är, till exempel elkonvertering.',
  };
}

// Kontrollerar vårdhändelsen i en ny ordination innan något sparas, så att ett nekat försök inte lämnar en ordination.
// Servern bestämmer texten när en bokning eller en post väljs, aldrig klienten.
//   { bokningId }     en bokning på den egna vårdenheten
//   { vantelistaId }  en post på den egna vårdenhetens väntelista
//   { text }          en ny vårdhändelse, som systemet sätter upp på väntelistan om vårdenheten har en tidbok
export function forbered(atk, inp = {}) {
  const vh = inp.vardhandelse;
  if (vh == null || typeof vh !== 'object') return null;
  kravKoppla(atk, 'vardhandelse');
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  if (vh.bokningId != null) {
    const b = bokning(db, vh.bokningId);
    if (!b || b.patient_id !== atk.patientId) throw new Fel(404, 'Bokningen finns inte.', 'saknas');
    if (bokningensVardenhet(db, b) !== ve) nekaAnnanEnhet(atk, `bokning:${b.id}`);
    if (!AKTIVA.includes(b.status)) throw new Fel(400, 'Bokningen gäller inte längre. Välj en annan, eller sätt upp vårdhändelsen på väntelistan.', 'ogiltig', { falt: ['vardhandelse'] });
    return { typ: 'bokning', text: b.orsak || tidbok.TIDSTYPER[tidFor(db, b).tidstyp].text, bokningId: b.id, vantelistaId: b.vantelista_id ?? null, ve };
  }
  if (vh.vantelistaId != null) {
    const p = post(db, vh.vantelistaId);
    if (!p || p.patient_id !== atk.patientId) throw new Fel(404, 'Posten på väntelistan finns inte.', 'saknas');
    if (vardenhetFor(db, p.enhet_id) !== ve) nekaAnnanEnhet(atk, `vantelista:${p.id}`);
    if (p.status === 'avslutad') throw new Fel(400, 'Posten på väntelistan är avslutad. Välj en annan, eller sätt upp vårdhändelsen på väntelistan.', 'ogiltig', { falt: ['vardhandelse'] });
    return { typ: 'vantelista', text: p.orsak, bokningId: p.status === 'bokad' ? p.bokning_id : null, vantelistaId: p.id, ve };
  }
  const text = typeof vh.text === 'string' ? vh.text.trim().slice(0, 120) : '';
  return { typ: harTidbok(db, ve) ? 'ny' : 'utan_tidbok', text, bokningId: null, vantelistaId: null, ve };
}

// Knyter den sparade ordinationen till tidboken. En ny vårdhändelse sätts upp på väntelistan, som ett återbesök hos
// läkare på den egna vårdenheten, eftersom tidboken bara har personal som resurs.
export function knyt(atk, ordinationId, k) {
  if (!k) return null;
  const db = atk.db;
  const av = atk.personal.id;
  let vantelistaId = k.vantelistaId;
  if (k.typ === 'ny') {
    const o = db.query('SELECT slut FROM ordinationer WHERE id = ?').get(ordinationId);
    const mal = o?.slut && o.slut > idag() ? o.slut : addDagar(idag(), 30);
    const p = tidbok.laggPaVantelista(db, {
      patientId: atk.patientId, ve: k.ve, tidstyp: 'aterbesok', yrkesroll: 'lakare', orsak: k.text, mal, av,
      detalj: 'Läkaren planerade vårdhändelsen, och systemet satte upp den på väntelistan. Tiden styr när en läkemedelsdos ska ges.',
    });
    vantelistaId = p.id;
  }
  const utan = k.typ === 'utan_tidbok';
  db.query(`INSERT INTO vardhandelse_kopplingar (ordination_id, patient_id, enhet_id, bokning_id, vantelista_id, egen_post, egen_text, foljer, lage, forklaring, skapad, skapad_av)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ordinationId, atk.patientId, k.ve, k.bokningId, vantelistaId, k.typ === 'ny' ? 1 : 0, k.typ === 'ny' || utan ? 1 : 0, utan ? 0 : 1,
    utan ? 'utan_tidbok' : 'vantar', utan ? 'Vårdenheten har ingen tidbok i demon. Ange tiden när vårdhändelsen är bestämd.' : vantarText(k.text), iso(), av);
  if (!utan) {
    historik(db, ordinationId, av, 'Vårdhändelsen knöts till tidboken', k.typ === 'ny' ? `${k.text} sattes upp på väntelistan.` : 'Tiden kommer från tidboken.');
    synka(db, atk.patientId, { av });
  }
  return kopplingUt(db, ordinationId, { full: true });
}

const vantarText = (text) => `${text} står på väntelistan. När vårdadministratören har bokat tiden räknar systemet fram när läkemedlet ska ges.`;

// Den bokning som gäller för kopplingen just nu. Posten på väntelistan följer med när den bokas, och en ombokning följer
// kedjan av bokningar som ersätter varandra.
function aktuell(db, k) {
  const p = post(db, k.vantelista_id);
  if (p) {
    const b = p.status === 'bokad' ? bokning(db, p.bokning_id) : null;
    if (b && AKTIVA.includes(b.status)) return { bokning: b, lage: 'bokad' };
    if (p.status === 'vantar') return { lage: 'vantar', post: p };
    if (p.status === 'avslutad') return { lage: 'avslutad', post: p };
  }
  let b = bokning(db, k.bokning_id);
  for (let i = 0; b && b.status === 'ombokad' && i < 50; i++) b = db.query('SELECT * FROM bokningar WHERE ersatter_id = ? ORDER BY id DESC').get(b.id) ?? null;
  if (b && AKTIVA.includes(b.status)) return { bokning: b, lage: 'bokad' };
  return { lage: p ? 'vantar' : 'avbokad' };
}

// Räknar om vårdhändelsernas tider för patienten efter en ändring i tidboken. Anropas av tidbok.js när en tid bokas,
// bokas om eller avbokas. av är den som gjorde ändringen (null när patienten eller systemet gjorde den).
export function synka(db, patientId, { av = null } = {}) {
  if (!finnsTabell(db)) return [];
  const andrade = [];
  for (const k of db.query('SELECT * FROM vardhandelse_kopplingar WHERE patient_id = ? AND foljer = 1').all(patientId)) {
    const o = db.query('SELECT status FROM ordinationer WHERE id = ?').get(k.ordination_id);
    const t = tillaggRad(db, k.ordination_id);
    if (o?.status !== 'aktiv' || !t) continue;
    const a = aktuell(db, k);
    const ny = a.bokning ? tidFor(db, a.bokning).start : null;
    const fran = t.handelse_tid ?? null;
    const bokningId = a.bokning?.id ?? k.bokning_id;
    if (ny === fran && a.lage === k.lage) {
      if (bokningId !== k.bokning_id) db.query('UPDATE vardhandelse_kopplingar SET bokning_id = ? WHERE ordination_id = ?').run(bokningId, k.ordination_id);
      continue;
    }
    const text = t.vardhandelse;
    const adm = ny ? plus(ny, t.forskjutning_min) : null;
    let handelse;
    let forklaring;
    if (ny && !fran) {
      handelse = 'Vårdhändelsen fick en tid i tidboken';
      forklaring = `Tiden kommer från tidboken: ${forsta(text)} ${tidbok.tidText(ny)}. Läkemedlet ges ${tidbok.tidText(adm)}.`;
    } else if (ny) {
      handelse = 'Vårdhändelsen bokades om';
      forklaring = `${text} bokades om från ${tidbok.tidText(fran)} till ${tidbok.tidText(ny)}. Systemet har räknat om dosen, och läkemedlet ges nu ${tidbok.tidText(adm)}.`;
    } else if (fran) {
      handelse = 'Vårdhändelsen avbokades';
      forklaring = a.lage === 'vantar'
        ? `${text} ${tidbok.tidText(fran)} avbokades och står på väntelistan igen. Ge inte dosen förrän vårdhändelsen har fått en ny tid. Då räknar systemet fram när läkemedlet ska ges.`
        : a.lage === 'avslutad'
          ? `${text} ${tidbok.tidText(fran)} avbokades, och posten på väntelistan avslutades. Ge inte dosen. Fråga den läkare som ordinerade läkemedlet.`
          : `${text} ${tidbok.tidText(fran)} avbokades. Ge inte dosen förrän vårdhändelsen har fått en ny tid. Fråga den läkare som ordinerade läkemedlet om dosen ska ges ändå.`;
    } else {
      handelse = null;
      forklaring = a.lage === 'avslutad' ? `${text} togs bort från väntelistan. Ge inte dosen. Fråga den läkare som ordinerade läkemedlet.` : vantarText(text);
    }
    db.query('UPDATE ordination_tillagg SET handelse_tid = ?, handelse_satt_av = ?, handelse_satt = ? WHERE ordination_id = ?').run(ny, av, iso(), k.ordination_id);
    db.query('UPDATE vardhandelse_kopplingar SET bokning_id = ?, lage = ?, forklaring = ?, andrad = ? WHERE ordination_id = ?').run(bokningId, a.lage, forklaring, iso(), k.ordination_id);
    // Historiken syns i den gemensamma läkemedelslistan, så den säger bara när läkemedlet ges, aldrig bokningens namn
    // eller tid (säkerhetsgranskning runda 5).
    if (handelse) historik(db, k.ordination_id, av, handelse, adm ? `Läkemedlet ges ${tidbok.tidText(adm)}.` : 'Läkemedlet ges inte förrän vårdhändelsen har fått en ny tid.');
    andrade.push(k.ordination_id);
  }
  return andrade;
}

// När tiden sätts för hand följer vårdhändelsen inte längre tidboken. En post som systemet satte upp på väntelistan
// för ordinationen och som ännu inte är bokad avslutas, så att vårdhändelsen inte bokas två gånger.
// Bara den egna vårdenhetens post avslutas, och avslutningen loggas på patienten (säkerhetsgranskning runda 5).
export function efterHandTid(atk, ordinationId) {
  const db = atk.db;
  const personalId = atk.personal.id;
  const k = kopplingRad(db, ordinationId);
  if (!k) return;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const namn = personNamn(db, personalId) ?? 'någon';
  db.query("UPDATE vardhandelse_kopplingar SET foljer = 0, lage = 'manuell', forklaring = ?, andrad = ? WHERE ordination_id = ?")
    .run(`Tiden är satt för hand av ${namn} och följer inte tidboken.`, iso(), ordinationId);
  if (k.foljer) historik(db, ordinationId, personalId, 'Vårdhändelsen följer inte längre tidboken', 'Tiden sattes för hand.');
  const p = post(db, k.vantelista_id);
  if (k.egen_post && p?.status === 'vantar' && vardenhetFor(db, p.enhet_id) === ve) {
    db.query("UPDATE vantelista SET status = 'avslutad' WHERE id = ?").run(p.id);
    db.query("INSERT INTO vantelista_handelser (vantelista_id, tid, av, typ, detalj) VALUES (?, ?, ?, 'avslutad', ?)")
      .run(p.id, iso(), personalId, 'Tiden för vårdhändelsen sattes för hand i läkemedelsprocessen. Systemet avslutade posten.');
    atk.logga(atk.handling, atk.grund(), `vantelista:${p.id}:avslutad`);
  }
}

// Kopplingen i ordinationens utdata. Läkemedelslistan är gemensam för vårdgivaren, men bokningen hör till den
// ordinerande vårdenheten. full är sant när användaren får se den vårdenhetens uppgifter (egen vårdenhet eller aktivt
// val). Annars visas bara den text som läkaren själv skrev och när läkemedlet ska ges, aldrig bokningens orsak eller
// tid (säkerhetsgranskning runda 5). Utan uppgift om användaren visas den skyddade formen.
export function kopplingUt(db, ordinationId, { full = false } = {}) {
  const k = kopplingRad(db, ordinationId);
  if (!k) return { foljerTidbok: false, lage: 'manuell', forklaring: null };
  const ut = { foljerTidbok: Boolean(k.foljer), lage: k.lage, forklaring: k.forklaring, andrad: k.andrad };
  if (full) return ut;
  const t = tillaggRad(db, ordinationId);
  const adm = t?.handelse_tid ? plus(t.handelse_tid, t.forskjutning_min) : null;
  const kort = {
    bokad: adm ? `Tiden kommer från tidboken. Läkemedlet ges ${tidbok.tidText(adm)}.` : null,
    vantar: 'Vårdhändelsen har ingen tid än. Systemet räknar fram när läkemedlet ska ges när den är bokad.',
    avbokad: 'Vårdhändelsen är avbokad. Ge inte dosen förrän den har fått en ny tid. Fråga den läkare som ordinerade läkemedlet.',
    avslutad: 'Vårdhändelsen är avbokad. Ge inte dosen förrän den har fått en ny tid. Fråga den läkare som ordinerade läkemedlet.',
    manuell: 'Tiden för läkemedlet är satt för hand.',
    utan_tidbok: 'Vårdhändelsen har ingen tid i tidboken. Läkemedlet ges när tiden är satt.',
  }[k.lage];
  return { ...ut, forklaring: kort ?? 'Vårdhändelsen har ingen tid än.', andrad: null, skyddad: true, egenText: Boolean(k.egen_text) };
}

// Styr tiden en läkemedelsdos? För vårdadministratörens bokningsdialog. Ger aldrig läkemedlet.
export function styrDos(db, { bokningRad = null, postRad = null } = {}) {
  if (!finnsTabell(db)) return false;
  const bokningar = [];
  for (let b = bokningRad, i = 0; b && i < 50; i++) { bokningar.push(b.id); b = b.ersatter_id ? bokning(db, b.ersatter_id) : null; }
  const postId = postRad?.id ?? bokningRad?.vantelista_id ?? null;
  if (!bokningar.length && !postId) return false;
  return Boolean(db.query(`SELECT 1 FROM vardhandelse_kopplingar k JOIN ordinationer o ON o.id = k.ordination_id
    WHERE k.foljer = 1 AND o.status = 'aktiv' AND (k.vantelista_id = ? OR k.bokning_id IN (${bokningar.map(() => '?').join(', ') || 'NULL'})) LIMIT 1`).get(postId, ...bokningar));
}
