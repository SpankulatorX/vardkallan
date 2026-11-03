// Planering och tidbok, del 2 (runda 6, r4, Sussa 3.4.1.3, 3.4.1.6, 3.4.1.7, 3.4.1.8 och 3.4.3.3): egna bevakningar,
// anpassningsbara vyer, väntetidsstatistik, kallelse utan förbokad tid, kallelsens språk och kallelsen som PDF och
// iCalendar.
//
// Systemet är experten:
//   - En bevakning har datum och ansvarig ifyllt (om en vecka, den som lägger upp den) och förslag på vanliga texter.
//   - Vyerna har ett förval efter rollen: vårdadministratören ser hela mottagningen och resurserna, läkaren och
//     sjuksköterskan sitt eget schema. Det användaren väljer sparas på servern.
//   - Väntetiderna räknas av systemet per tidstyp och yrkesroll, utan personuppgifter.
//   - En kallelse utan förbokad tid får sin ram av systemet: från i morgon till gränsen för posten. Patienten får samma
//     förslag som vårdadministratören, bara inom ramen.
//   - Kallelsen skrivs på patientens språk och kan hämtas som PDF och för kalendern, med samma behörighet och loggning.
import { Fel, iso, idag, addDagar, lokalTid, giltigtDatum, datumAv } from './db.js';
import { vardenhetFor, harVardrelation, kanRoll, Atkomst } from './atkomst.js';
import * as tidbok from './tidbok.js';
import * as plan from './planering-bas.js';
import { ramTextEngelska, RUBRIK_ENGELSKA } from './kallelse-engelska.js';
import { pdf, ics } from './filformat.js';

const MIN = 60_000;
const DAG = 24 * 60 * MIN;
const enhetKort = (db, id) => { const e = db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => { const p = id ? db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id) : null; return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };

// ---------------------------------------------------------------------------------------------------------------
// Egna bevakningar (Sussa 3.4.1.3)

const TEXTER = {
  vardadministrator: ['Ring patienten och erbjud en tid.', 'Erbjud en tidigare tid om en blir ledig.', 'Kontrollera att kallelsen har kommit fram.', 'Följ upp att remissen har besvarats.'],
  klinisk: ['Kontrollera att provsvaren har kommit.', 'Ring patienten om provsvaren.', 'Följ upp effekten av behandlingen.', 'Följ upp att remissen har besvarats.'],
};
const ENHETEN = { id: 'enheten', namn: 'Hela vårdenheten', titel: null };

// Personal på samma vårdenhet som kan vara ansvarig.
function ansvariga(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query("SELECT id, namn, titel, enhet_id, yrke FROM personal WHERE aktiv = 1 AND yrke IN ('lakare', 'sjukskoterska', 'vardadministrator', 'underskoterska') ORDER BY namn").all()
    .filter(p => vardenhetFor(db, p.enhet_id) === ve).map(p => ({ id: p.id, namn: p.namn, titel: p.titel }));
}

export function bevakningForslag(db, personal) {
  return {
    datum: addDagar(idag(), 7), ansvarig: personKort(db, personal.id), ansvariga: [...ansvariga(db, personal), ENHETEN],
    texter: TEXTER[personal.yrke === 'vardadministrator' ? 'vardadministrator' : 'klinisk'],
  };
}

// Skapar en bevakning. atk är satt när bevakningen gäller en patient (handlingen bevaka, med vårdrelation), annars är
// bevakningen för vårdenheten (bevaka_enhet).
export function skapaBevakning(db, personal, body = {}, atk = null) {
  if (atk) atk.krav('bevaka');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 3 || text.length > 300) throw new Fel(400, 'Skriv vad som ska bevakas.', 'ogiltig', { falt: ['text'] });
  const datum = body.datum ?? addDagar(idag(), 7);
  if (!giltigtDatum(datum) || datum < idag() || datum > addDagar(idag(), 366)) throw new Fel(400, 'Välj ett datum från i dag och högst ett år fram.', 'ogiltig', { falt: ['datum'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  let ansvarig = personal.id;
  if (body.ansvarigId === 'enheten') ansvarig = null;
  else if (body.ansvarigId !== undefined && body.ansvarigId !== null) {
    if (!ansvariga(db, personal).some(a => a.id === body.ansvarigId)) throw new Fel(400, 'Den ansvariga ska arbeta på din vårdenhet.', 'ogiltig', { falt: ['ansvarigId'] });
    ansvarig = body.ansvarigId;
  }
  const id = Number(db.query('INSERT INTO egna_bevakningar (enhet_id, patient_id, text, datum, ansvarig_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ve, atk?.patientId ?? null, text, datum, ansvarig, iso(), personal.id).lastInsertRowid);
  if (atk) atk.logga('bevaka', atk.grund(), `egen_bevakning:${id}`);
  return [201, tidbok.egenBevakningUt(db, db.query('SELECT * FROM egna_bevakningar WHERE id = ?').get(id))];
}

export function egenBevakningRad(db, id) {
  const b = db.query('SELECT * FROM egna_bevakningar WHERE id = ?').get(Number(id));
  if (!b) throw new Fel(404, 'Bevakningen finns inte.', 'saknas');
  return b;
}

// Klar. Bara på den egna vårdenheten, och för en patient med vårdrelation (atk).
export function bevakningKlar(db, personal, b, atk = null) {
  if (vardenhetFor(db, personal.enhet_id) !== b.enhet_id) {
    if (atk) atk.logga('bevaka', 'nekad', `egen_bevakning:${b.id}:klar`, 'nekad');
    throw new Fel(403, 'Bevakningen hör till en annan vårdenhet.', 'nekad');
  }
  if (atk) atk.krav('bevaka');
  if (b.klar) throw new Fel(400, 'Bevakningen är redan klar.', 'ogiltig');
  db.query('UPDATE egna_bevakningar SET klar = ?, klar_av = ? WHERE id = ?').run(iso(), personal.id, b.id);
  if (atk) atk.logga('bevaka', atk.grund(), `egen_bevakning:${b.id}:klar`);
  return { ok: true };
}

// Inkorgen: den inloggades och vårdenhetens bevakningar som har löpt ut. En rad med en patient loggas på patienten en
// gång per session, som de andra raderna i inkorgen, och visas bara med vårdrelation.
export function bevakningarIInkorg(db, personal, loggade = new Set()) {
  if (!kanRoll(personal, 'bevaka_enhet')) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  return plan.egnaBevakningar(db, personal, idag()).filter(b => !b.patient_id || harVardrelation(db, b.patient_id, ve)).map(b => {
    if (b.patient_id && !loggade.has(b.id)) {
      loggade.add(b.id);
      const a = new Atkomst(db, personal, b.patient_id, {}, 'bevaka');
      a.logga('bevaka', a.prova('bevaka').grund, `inkorg:egen_bevakning:${b.id}`);
    }
    return tidbok.egenBevakningUt(db, b);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Anpassningsbara vyer (Sussa 3.4.1.6)

export const SEKTIONER = [['dagens', 'Patienter'], ['remisser', 'Remisser som väntar på tid'], ['vantelista', 'Väntelistan'], ['kallelser', 'Kallelser som behöver gå ut'], ['bevakningar', 'Bevakningar']];
const harSchema = (db, personal) => Boolean(db.query('SELECT 1 FROM scheman WHERE personal_id = ?').get(personal.id));
const VYER = {
  idag: {
    handling: 'boka',
    forval: () => ({ sektioner: SEKTIONER.map(s => s[0]) }),
    alternativ: () => ({ sektioner: SEKTIONER.map(([id, text]) => ({ id, text })) }),
    validera(_db, _p, inst) {
      const s = inst?.sektioner;
      if (!Array.isArray(s) || !s.length || new Set(s).size !== s.length || s.some(x => !SEKTIONER.some(k => k[0] === x))) throw new Fel(400, 'Välj minst en av delarna i Dagens arbete.', 'ogiltig', { falt: ['sektioner'] });
      return { sektioner: SEKTIONER.map(k => k[0]).filter(k => s.includes(k)) };
    },
  },
  tidbok: {
    handling: 'las_tidbok',
    // Förval efter rollen: vårdadministratören hela mottagningen med resurserna, den som har ett eget schema sitt schema.
    forval: (db, p) => (p.yrke === 'vardadministrator' || !harSchema(db, p) ? { vardgivare: 'alla', resurser: p.yrke === 'vardadministrator' } : { vardgivare: 'mina', resurser: false }),
    alternativ(db, p) {
      const ve = vardenhetFor(db, p.enhet_id);
      const scheman = db.query('SELECT s.*, pe.namn FROM scheman s JOIN personal pe ON pe.id = s.personal_id ORDER BY s.yrkesroll, pe.namn').all().filter(s => vardenhetFor(db, s.enhet_id) === ve);
      return { vardgivare: scheman.map(s => ({ id: s.id, namn: s.namn, yrkesrollText: tidbok.YRKESROLL[s.yrkesroll], mitt: s.personal_id === p.id })) };
    },
    validera(db, p, inst) {
      const v = inst?.vardgivare;
      const ok = this.alternativ(db, p).vardgivare.map(x => x.id);
      if (!(v === 'alla' || v === 'mina' || (Array.isArray(v) && v.length && v.length <= 30 && v.every(x => ok.includes(x))))) {
        throw new Fel(400, 'Välj vårdgivare på din vårdenhet.', 'ogiltig', { falt: ['vardgivare'] });
      }
      return { vardgivare: Array.isArray(v) ? [...new Set(v)] : v, resurser: inst.resurser === undefined ? this.forval(db, p).resurser : Boolean(inst.resurser) };
    },
  },
};

function vyDef(personal, vy) {
  const d = VYER[vy];
  if (!d) throw new Fel(404, 'Vyn finns inte.', 'saknas');
  if (!kanRoll(personal, d.handling)) throw new Fel(403, 'Din yrkesroll har inte den här vyn.', 'nekad');
  return d;
}

export function vyFor(db, personal, vy) {
  const d = vyDef(personal, vy);
  const rad = db.query('SELECT data FROM vyinstallningar WHERE personal_id = ? AND vy = ?').get(personal.id, vy);
  if (rad) { try { return { installning: d.validera(db, personal, JSON.parse(rad.data)), sparad: true }; } catch { /* en sparad vy som inte längre gäller ersätts av förvalet */ } }
  return { installning: d.forval(db, personal), sparad: false };
}

export function hamtaVy(db, personal, vy) {
  const d = vyDef(personal, vy);
  return { vy, ...vyFor(db, personal, vy), forval: d.forval(db, personal), alternativ: d.alternativ(db, personal) };
}
export function sparaVy(db, personal, vy, body = {}) {
  const d = vyDef(personal, vy);
  const inst = d.validera(db, personal, body.installning);
  db.query('INSERT OR REPLACE INTO vyinstallningar (personal_id, vy, data, andrad) VALUES (?, ?, ?, ?)').run(personal.id, vy, JSON.stringify(inst), iso());
  return hamtaVy(db, personal, vy);
}
export function aterstallVy(db, personal, vy) {
  vyDef(personal, vy);
  db.query('DELETE FROM vyinstallningar WHERE personal_id = ? AND vy = ?').run(personal.id, vy);
  return hamtaVy(db, personal, vy);
}

// ---------------------------------------------------------------------------------------------------------------
// Väntetidsstatistik utan personuppgifter (Sussa 3.4.1.7)

// Så få patienter visas bara som antal på regionnivå, utan väntetider, så att ingen enskild går att känna igen.
export const MINSTA_ANTAL = 3;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const dagarMellan = (fran, till) => Math.round((Date.parse(`${till}T12:00:00Z`) - Date.parse(`${fran}T12:00:00Z`)) / DAG);

function statistikFor(db, ve, { skydda = false } = {}) {
  const dag = idag();
  const dolj = (n, v) => (skydda && n < MINSTA_ANTAL ? null : v);
  const vantar = db.query("SELECT * FROM vantelista WHERE enhet_id = ? AND status = 'vantar'").all(ve);
  const grupper = new Map();
  for (const p of vantar) {
    const nyckel = `${p.tidstyp}:${p.yrkesroll}`;
    if (!grupper.has(nyckel)) grupper.set(nyckel, { tidstyp: p.tidstyp, yrkesroll: p.yrkesroll, dagar: [], nara: 0, passerat: 0 });
    const g = grupper.get(nyckel);
    g.dagar.push(dagarMellan(p.fran, dag));
    const gr = tidbok.gransFor(p, dag);
    if (gr?.risk === 'risk') g.nara++;
    if (gr?.risk === 'passerad') g.passerat++;
  }
  const allaDagar = vantar.map(p => dagarMellan(p.fran, dag));
  // Bokade de senaste 90 dagarna: väntetiden från att väntan började till besöket, och om besöket låg före gränsen.
  const sedan = new Date(Date.now() - 90 * DAG).toISOString();
  const bokade = db.query(`SELECT v.*, t.start FROM vantelista v JOIN bokningar b ON b.id = v.bokning_id JOIN tider t ON t.id = b.tid_id
    WHERE v.enhet_id = ? AND v.status = 'bokad' AND b.bokad >= ?`).all(ve, sedan);
  const bDagar = bokade.map(p => dagarMellan(p.fran, datumAv(new Date(p.start))));
  const inom = bokade.filter(p => { const g = tidbok.gransFor(p, datumAv(new Date(p.start))); return !g || g.dagarKvar >= 0; }).length;
  return {
    vardenhet: enhetKort(db, ve), datum: dag,
    totalt: { vantar: vantar.length, naraGransen: [...grupper.values()].reduce((a, g) => a + g.nara, 0), passerat: [...grupper.values()].reduce((a, g) => a + g.passerat, 0),
      medianDagar: dolj(allaDagar.length, median(allaDagar)), langstDagar: dolj(allaDagar.length, allaDagar.length ? Math.max(...allaDagar) : null) },
    grupper: [...grupper.values()].sort((a, b) => b.dagar.length - a.dagar.length).map(g => ({
      tidstyp: g.tidstyp, tidstypText: tidbok.TIDSTYPER[g.tidstyp]?.text, yrkesroll: g.yrkesroll, yrkesrollText: tidbok.YRKESROLL[g.yrkesroll],
      vantar: g.dagar.length, medianDagar: dolj(g.dagar.length, median(g.dagar)), langstDagar: dolj(g.dagar.length, Math.max(...g.dagar)), naraGransen: g.nara, passerat: g.passerat,
    })),
    bokade: { dagar: 90, antal: bokade.length, medianDagar: dolj(bokade.length, median(bDagar)), inomGransen: bokade.length ? dolj(bokade.length, Math.round((100 * inom) / bokade.length)) : null },
  };
}

const STATISTIK_TEXT = `${tidbok.DEMOREGLER.text} Statistiken räknas av systemet ur väntelistan och innehåller inga personuppgifter.`;
export function vantetider(db, personal, niva = 'enhet') {
  if (niva === 'region') {
    if (!kanRoll(personal, 'statistik_region')) throw new Fel(403, 'Statistiken för regionen är för uppföljningen.', 'nekad');
    const enheter = [...new Set([
      ...db.query('SELECT DISTINCT enhet_id FROM vantelista').all().map(r => vardenhetFor(db, r.enhet_id)),
      ...db.query('SELECT DISTINCT enhet_id FROM scheman').all().map(r => vardenhetFor(db, r.enhet_id)),
    ])].sort();
    return { niva, datum: idag(), minstaAntal: MINSTA_ANTAL, vardenheter: enheter.map(ve => statistikFor(db, ve, { skydda: true })), demoregler: STATISTIK_TEXT };
  }
  if (!kanRoll(personal, 'statistik') || !kanRoll(personal, 'vantelista')) throw new Fel(403, 'Din yrkesroll har inte väntetidsstatistiken.', 'nekad');
  return { niva: 'enhet', ...statistikFor(db, vardenhetFor(db, personal.enhet_id)), demoregler: STATISTIK_TEXT };
}

// ---------------------------------------------------------------------------------------------------------------
// Kallelse utan förbokad tid (Sussa 3.4.3.3)

const ramTextSv = (p, v, ve, ram) => [`Hej ${p.fornamn},`,
  `Du har fått en kallelse till ${tidbok.TIDSTYPER[v.tidstyp].text.toLowerCase()} hos ${tidbok.YRKESROLL[v.yrkesroll]} på ${ve}.`,
  `Välj en tid i Min journal mellan ${ram.fran} och ${ram.till}. Systemet visar de tider som passar.`,
  'Väljer du ingen tid ringer mottagningen dig.'].join('\n');

export function kallaUtanTid(atk, post) {
  atk.krav('kalla');
  const db = atk.db;
  tidbok.kravEgenVardenhet(atk, post.enhet_id, `vantelista:${post.id}`);
  if (post.status !== 'vantar') throw new Fel(400, 'Patienten har redan fått en tid.', 'ogiltig');
  if (!tidbok.EGENBOKNING_TIDSTYPER.includes(post.tidstyp)) {
    const t = tidbok.TIDSTYPER[post.tidstyp]?.text.toLowerCase() ?? 'besök';
    throw new Fel(400, `Ett ${t} bokar mottagningen själv, så patienten kan inte välja tid i Min journal (beslut 2026-11-03). Boka tiden åt patienten.`, 'ogiltig');
  }
  if (plan.ramForPost(db, post.id)) throw new Fel(400, 'Patienten har redan fått en kallelse att välja tid.', 'ogiltig');
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(post.patient_id);
  const mj = tidbok.minJournalFor(db, p);
  if (!mj) throw new Fel(400, 'Patienten kan inte nås i Min journal och kan därför inte välja tid själv. Boka tiden åt patienten.', 'ogiltig');
  // Ramen: från i morgon, eftersom en egen bokning ska ligga minst ett dygn fram, till gränsen för posten, eller tre
  // veckor när gränsen ligger för nära.
  const fran = addDagar(idag(), 1);
  const g = tidbok.gransFor(post);
  const till = g && g.datum > addDagar(fran, 3) ? g.datum : addDagar(fran, 21);
  const ve = enhetKort(db, post.enhet_id)?.namn ?? '';
  const sprak = plan.sprakFor(db, p.id);
  const text = (sprak === 'en' ? ramTextEngelska : ramTextSv)(p, post, ve, { fran, till });
  const id = Number(db.query(`INSERT INTO kallelser_ram (vantelista_id, patient_id, enhet_id, fran, till, kanal, mottagare, text, sprak, status, skapad, skapad_av, forklaring)
    VALUES (?, ?, ?, ?, ?, 'min_journal', ?, ?, ?, 'skickad', ?, ?, ?)`).run(post.id, p.id, post.enhet_id, fran, till, mj.mottagare, text, sprak, iso(), atk.personal.id,
    p.skyddad ? 'Patienten har skyddade personuppgifter. Kallelsen finns bara i Min journal.' : null).lastInsertRowid);
  tidbok.vlHandelse(db, post.id, 'kallad', { av: atk.personal.id, detalj: `Patienten fick en kallelse att välja tid i Min journal till och med ${till}.` });
  atk.logga('kalla', atk.grund(), `vantelista:${post.id}:kallelse_ram:${id}`);
  const r = db.query('SELECT * FROM kallelser_ram WHERE id = ?').get(id);
  return [201, { id: r.id, fran: r.fran, till: r.till, kanal: r.kanal, kanalText: 'Min journal', status: r.status, text: p.skyddad && !atk.val?.visa_identitet ? null : r.text, sprak: r.sprak }];
}

function minRam(atk, rid) {
  const r = atk.db.query("SELECT * FROM kallelser_ram WHERE id = ? AND status = 'skickad'").get(Number(rid));
  if (!r || r.patient_id !== atk.patient.id) throw new Fel(404, 'Kallelsen finns inte.', 'saknas');
  const post = tidbok.vantelistaRad(atk.db, r.vantelista_id);
  if (post.status !== 'vantar') throw new Fel(400, 'Du har redan fått en tid.', 'ogiltig');
  return { r, post };
}
// Förslagen inom ramen: samma förslag som vårdadministratören får, från tidigast ett dygn fram.
function ramForslag(db, r, post) {
  const fran = new Date(Math.max(Date.parse(lokalTid(r.fran, '00:00')), Date.now() + tidbok.DEMOREGLER.egenGransTimmar * 3600_000)).toISOString();
  return tidbok.foreslaTider(db, { ...tidbok.behovForPost(db, post), fran, till: lokalTid(addDagar(r.till, 1), '00:00') });
}
export function minRamForslag(atk, rid) {
  const { r, post } = minRam(atk, rid);
  return { kallelse: tidbok.ramUt(atk.db, r), forslag: ramForslag(atk.db, r, post) };
}
export function minRamBoka(atk, rid, body = {}) {
  const db = atk.db;
  const { r, post } = minRam(atk, rid);
  const forslag = ramForslag(db, r, post);
  if (!forslag.some(f => f.tidId === Number(body.tidId))) throw new Fel(400, 'Välj en av de föreslagna tiderna.', 'ogiltig', { falt: ['tidId'] });
  const tid = tidbok.tidRad(db, body.tidId);
  if (!tidbok.arLedig(db, tid)) throw new Fel(400, 'Tiden har just bokats av någon annan. Välj en annan.', 'ogiltig', { falt: ['tidId'] });
  const { b } = tidbok.bokaPostRad(db, post, tid, { avInvanare: atk.invanare.id, relation: 1 });
  db.query("UPDATE kallelser_ram SET status = 'bokad', bokning_id = ? WHERE id = ?").run(b.id, r.id);
  atk.logga(`min:kallelse-ram:${r.id}:bokad:${b.id}`, { handling: 'boka' });
  return [201, tidbok.minBokningUt(db, tidbok.bokningRad(db, b.id))];
}

// ---------------------------------------------------------------------------------------------------------------
// Kallelsens språk (Sussa 3.4.3.3)

const sprakUt = (db, pid) => { const s = plan.sprakFor(db, pid); return { sprak: s, text: plan.SPRAK[s], alternativ: Object.entries(plan.SPRAK).map(([id, text]) => ({ id, text })) }; };
export const minSprak = (atk) => sprakUt(atk.db, atk.patient.id);
export function minSattSprak(atk, body = {}) {
  if (!Object.hasOwn(plan.SPRAK, body.sprak ?? '')) throw new Fel(400, 'Välj svenska eller engelska.', 'ogiltig', { falt: ['sprak'] });
  atk.db.query('INSERT OR REPLACE INTO sprakval (patient_id, sprak, andrad, andrad_av_invanare) VALUES (?, ?, ?, ?)').run(atk.patient.id, body.sprak, iso(), atk.invanare.id);
  return sprakUt(atk.db, atk.patient.id);
}

// ---------------------------------------------------------------------------------------------------------------
// Kallelsen som PDF och iCalendar (Sussa 3.4.3.3)

const RUBRIK = { kallelse: 'Kallelse', paminnelse: 'Påminnelse', ombokning: 'Kallelse, ny tid', avbokning: 'Avbokning' };

const DEMO = 'Demo: påhittad kallelse från Vårdkällan, ett öppet journalsystem. Den kommer inte från någon region och gäller ingen riktig tid.';

// Radbrytning för PDF:en, ungefär 88 tecken per rad i 11 punkter.
function bryt(text, max = 88) {
  const ut = [];
  for (const stycke of String(text).split('\n')) {
    let rad = '';
    for (const ord of stycke.split(' ')) {
      if ((rad + ' ' + ord).trim().length > max) { ut.push(rad); rad = ord; } else rad = (rad + ' ' + ord).trim();
    }
    ut.push(rad);
  }
  return ut;
}
// PDF och iCalendar byggs i filformat.js.
// Underlaget för en kallelse: rubrik, tid, plats och text. Adress och telefonnummer finns aldrig med.
function underlag(db, k) {
  const b = tidbok.bokningRad(db, k.bokning_id);
  const t = tidbok.tidRad(db, b.tid_id);
  const s = tidbok.schemaRad(db, t.schema_id);
  const mott = enhetKort(db, s.enhet_id);
  const ve = enhetKort(db, vardenhetFor(db, s.enhet_id));
  const sprak = plan.kallelsensSprak(db, k.id);
  const ingrepp = plan.behovForPost(db, b.vantelista_id)?.ingrepp;
  const lokal = plan.resurserForBokning(db, b.id).find(r => r.typ === 'lokal')?.namn;
  const kedja = plan.kedjaFor(db, b.id);
  const fore = kedja?.roll === 'huvud' ? tidbok.tidRad(db, tidbok.bokningRad(db, kedja.foreId).tid_id) : null;
  return {
    b, t, k, sprak, rubrik: `${ingrepp ? plan.INGREPP[ingrepp].text : tidbok.TIDSTYPER[t.tidstyp].text}, ${mott?.namn ?? ''}`, plats: [lokal, mott?.namn, ve?.id !== mott?.id ? ve?.namn : null].filter(Boolean).join(', '),
    fore: fore ? { start: fore.start, slut: fore.slut, rubrik: `${tidbok.TIDSTYPER[fore.tidstyp].text}, ${enhetKort(db, tidbok.schemaRad(db, fore.schema_id).enhet_id)?.namn ?? ''}` } : null,
    vardenhet: ve?.namn ?? '',
  };
}

function fil(u, format) {
  if (format === 'pdf') {
    const rader = [
      { text: (u.sprak === 'en' ? RUBRIK_ENGELSKA : RUBRIK)[u.k.typ] ?? 'Kallelse', fet: true, storlek: 18 },
      { text: u.vardenhet, storlek: 11 },
      { text: `Skickad ${u.k.skickad ? new Date(u.k.skickad).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) : ''}`, storlek: 9 },
      { text: ' ', storlek: 11 },
      ...bryt(u.k.text).map(text => ({ text, storlek: 11 })),
      { text: ' ', storlek: 11 },
      ...bryt(DEMO, 100).map(text => ({ text, storlek: 8 })),
    ];
    return new Response(pdf(rader, { titel: RUBRIK[u.k.typ] ?? 'Kallelse' }), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="kallelse-${u.k.id}.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  const handelser = [{ uid: `kallelse-${u.k.id}-bokning-${u.b.id}@vardkallan.demo`, start: u.t.start, slut: u.t.slut, rubrik: u.rubrik, plats: u.plats, text: `${u.k.text}\n\n${DEMO}`, avbokad: u.b.status === 'avbokad' }];
  if (u.fore && u.b.status !== 'avbokad') handelser.unshift({ uid: `kallelse-${u.k.id}-kedja-${u.b.id}@vardkallan.demo`, start: u.fore.start, slut: u.fore.slut, rubrik: u.fore.rubrik, plats: u.plats, text: DEMO });
  return new Response(ics(handelser), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="kallelse-${u.k.id}.ics"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export const FORMAT = ['pdf', 'ics'];
// Personalen: handlingen kalla på den egna vårdenheten. En kallelse till en patient med skyddade personuppgifter
// lämnas ut först efter Visa identitet, eftersom texten har patientens förnamn.
export function kallelseFil(atk, k, format) {
  const db = atk.db;
  atk.krav('kalla');
  tidbok.kravEgenVardenhet(atk, tidbok.bokningensEnhet(db, tidbok.bokningRad(db, k.bokning_id)), `kallelse:${k.id}:${format}`);
  const p = db.query('SELECT skyddad FROM patienter WHERE id = ?').get(k.patient_id);
  if (p?.skyddad && !atk.val?.visa_identitet) {
    atk.logga('kalla', 'nekad', `kallelse:${k.id}:${format}`, 'nekad');
    throw new Fel(403, 'Patienten har skyddade personuppgifter. Välj Visa identitet först, så att det loggas varför kallelsen behövs.', 'nekad');
  }
  if (k.status !== 'skickad' && k.status !== 'klar') throw new Fel(400, 'Kallelsen är inte skickad ännu.', 'ogiltig');
  atk.logga('kalla', atk.grund(), `kallelse:${k.id}:${format}`);
  return fil(underlag(db, k), format);
}
// Patienten i Min journal: bara egna kallelser som har skickats.
export function minKallelseFil(atk, kid, format) {
  const k = atk.db.query("SELECT * FROM kallelser WHERE id = ? AND status = 'skickad'").get(Number(kid));
  if (!k || k.patient_id !== atk.patient.id) throw new Fel(404, 'Kallelsen finns inte.', 'saknas');
  return fil(underlag(atk.db, k), format);
}
