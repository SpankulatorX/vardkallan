// Schemalagda säkerhetskopior av sandlådorna (runda 12, r2, Sussa KD1.1.3.6 Dataförlust). Varje kopia är en konsistent
// ögonblicksbild av sandlådans databas (SQLite serialize), som skrivs på två platser och verifieras på båda: samma
// kontrollsumma som ögonblicksbilden, och kopian läst från disken är hel, har alla tabeller och har loggar vars
// hashkedjor håller. Systemförvaltaren kan återställa sandlådan till en vald tidpunkt: systemet tar den senaste
// verifierade kopian före tidpunkten, tar först en kopia av läget som det är, och läser från den andra platsen om den
// första är skadad.
//
// Sandlådans id är hemligt (det är sessionskakan) och används aldrig som namn. Kopiorna hålls under en HMAC av id:t
// med en hemlig nyckel. Demoregel: de två platserna är två kataloger på samma server (eller två lager i minnet när
// servern inte sparar till disk). I driften är den andra platsen en annan volym på en annan ort.
import { Database } from 'bun:sqlite';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Fel, iso } from './db.js';
import { kanRoll } from './atkomst.js';
import { loggaRad, verifiera as verifieraLogg } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';

export const ORSAKER = {
  schema: 'Schemalagd', manuell: 'Tagen av systemförvaltaren', fore_aterstallning: 'Före en återställning', fore_atergang: 'Före en återgång till förra versionen',
};
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// Ett lager för en plats: en katalog på disken eller en karta i minnet.
function plats(katalog) {
  if (!katalog) {
    const m = new Map();
    return {
      typ: 'minne', namn: null,
      skriv: (k, fil, data) => m.set(`${k}/${fil}`, Buffer.from(data)),
      las: (k, fil) => m.get(`${k}/${fil}`) ?? null,
      radera: (k, fil = null) => { for (const x of [...m.keys()]) if (fil ? x === `${k}/${fil}` : x.startsWith(`${k}/`)) m.delete(x); },
      // Bara för testerna: skadar en kopia på platsen.
      skada: (k, fil) => { const b = m.get(`${k}/${fil}`); if (b) b[Math.floor(b.length / 2)] ^= 0xff; },
      nycklar: () => [...new Set([...m.keys()].map(x => x.split('/')[0]))],
    };
  }
  mkdirSync(katalog, { recursive: true, mode: 0o700 });
  return {
    typ: 'katalog', namn: katalog,
    skriv: (k, fil, data) => {
      mkdirSync(join(katalog, k), { recursive: true, mode: 0o700 });
      writeFileSync(join(katalog, k, fil + '.tmp'), data, { mode: 0o600 });
      renameSync(join(katalog, k, fil + '.tmp'), join(katalog, k, fil));
    },
    las: (k, fil) => { try { return readFileSync(join(katalog, k, fil)); } catch { return null; } },
    radera: (k, fil = null) => rmSync(fil ? join(katalog, k, fil) : join(katalog, k), { recursive: true, force: true }),
    skada: (k, fil) => { const b = readFileSync(join(katalog, k, fil)); b[Math.floor(b.length / 2)] ^= 0xff; writeFileSync(join(katalog, k, fil), b); },
    nycklar: () => (existsSync(katalog) ? readdirSync(katalog).filter(x => /^[0-9a-f]{32}$/.test(x)) : []),
  };
}

// Kontrollen av en kopia: kontrollsumman, och att databasen läst från kopian är hel och har loggar som håller.
export function verifieraKopia(data, forvantad) {
  const kontroller = [];
  const summa = data ? sha256(data) : null;
  kontroller.push({ id: 'summa', text: 'Kontrollsumman är densamma som för ögonblicksbilden', ok: summa === forvantad });
  if (summa !== forvantad) return { ok: false, kontroller };
  let db;
  try {
    db = Database.deserialize(data);
    const hel = db.query('PRAGMA integrity_check').get().integrity_check;
    kontroller.push({ id: 'integritet', text: 'Databasen är hel (SQLite integrity_check)', ok: hel === 'ok' });
    const lg = verifieraLogg(db);
    kontroller.push({ id: 'atkomstlogg', text: `Åtkomstloggens hashkedja håller (${lg.antal} rader)`, ok: lg.hel === true });
    try {
      const sl = sakerhetslogg.verifiera(db);
      kontroller.push({ id: 'sakerhetslogg', text: `Säkerhetsloggens hashkedja håller (${sl.antal} rader)`, ok: sl.hel === true });
    } catch { /* en äldre sandlåda utan säkerhetslogg */ }
    const n = db.query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get().n;
    kontroller.push({ id: 'tabeller', text: `Kopian har ${n} tabeller`, ok: n > 0 });
  } catch (e) {
    kontroller.push({ id: 'las', text: 'Kopian går att läsa in som en databas', ok: false });
  } finally { db?.close(); }
  return { ok: kontroller.every(k => k.ok), kontroller };
}

// Lagret med kopior för servern. katalog och andraKatalog är de två platserna, eller null för minnet.
export function skapaKopielager({ katalog = null, andraKatalog = null, hemlighet = randomBytes(32), behall = 48, intervallMinuter = 15 } = {}) {
  const platser = [plats(katalog), plats(andraKatalog)];
  // Index per sandlåda: kopiorna med tid, storlek, kontrollsumma och verifiering per plats. Sparas på båda platserna.
  const index = new Map();
  const nyckel = (sid) => createHmac('sha256', hemlighet).update(String(sid)).digest('hex').slice(0, 32);
  const lasIndex = (k) => {
    if (index.has(k)) return index.get(k);
    for (const p of platser) {
      const b = p.las(k, 'index.json');
      if (b) { try { const x = JSON.parse(b.toString('utf8')); index.set(k, x); return x; } catch { /* nästa plats */ } }
    }
    const x = [];
    index.set(k, x);
    return x;
  };
  const sparaIndex = (k) => { const b = Buffer.from(JSON.stringify(index.get(k) ?? [])); for (const p of platser) p.skriv(k, 'index.json', b); };

  // Tar en kopia av en sandlåda. Ögonblicksbilden skrivs på båda platserna och verifieras på var och en.
  function ta(sid, db, { orsak = 'manuell', nu = new Date(), av = null } = {}) {
    if (!ORSAKER[orsak]) throw new Error(`Okänd orsak: ${orsak}`);
    const k = nyckel(sid);
    const data = db.serialize();
    const summa = sha256(data);
    const id = `${iso(nu).replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
    const fil = `${id}.sqlite`;
    const per = platser.map((p, i) => {
      try {
        p.skriv(k, fil, data);
        const v = verifieraKopia(p.las(k, fil), summa);
        return { plats: i + 1, ok: v.ok, kontroller: v.kontroller };
      } catch (e) { return { plats: i + 1, ok: false, kontroller: [{ id: 'skriv', text: 'Kopian kunde inte skrivas', ok: false }] }; }
    });
    const post = { id, fil, tid: iso(nu), orsak, av, byte: data.byteLength, sha256: summa, platser: per.map(({ plats: pl, ok }) => ({ plats: pl, ok })), verifierad: per.every(x => x.ok), kontroller: per[0].kontroller };
    const lista = lasIndex(k);
    lista.unshift(post);
    // De äldsta kopiorna tas bort.
    while (lista.length > behall) {
      const ut = lista.pop();
      for (const p of platser) p.radera(k, ut.fil);
    }
    sparaIndex(k);
    return post;
  }

  const lista = (sid) => lasIndex(nyckel(sid));

  // Läser en kopia: från den första platsen om den håller, annars från den andra.
  function las(sid, id) {
    const k = nyckel(sid);
    const post = lasIndex(k).find(x => x.id === id);
    if (!post) return null;
    const forsok = [];
    for (let i = 0; i < platser.length; i++) {
      const data = platser[i].las(k, post.fil);
      const v = verifieraKopia(data, post.sha256);
      forsok.push({ plats: i + 1, ok: v.ok });
      if (v.ok) return { post, data, plats: i + 1, forsok };
    }
    return { post, data: null, plats: null, forsok };
  }

  const radera = (sid) => { const k = nyckel(sid); index.delete(k); for (const p of platser) p.radera(k); };

  // Bara för testerna.
  const skada = (sid, id, platsNr) => { const k = nyckel(sid); const post = lasIndex(k).find(x => x.id === id); platser[platsNr - 1].skada(k, post.fil); };

  return {
    ta, lista, las, radera, skada, nyckel, intervallMinuter, behall,
    platser: platser.map((p, i) => ({ plats: i + 1, typ: p.typ })),
  };
}

// Den schemalagda körningen: en kopia av varje sandlåda som har ändrats sedan sin senaste kopia. sist är när
// sandlådan senast användes (millisekunder). Returnerar antalet kopior.
export function schemalagda(lager, sessioner, nu = new Date()) {
  let n = 0;
  for (const [sid, s] of sessioner) {
    const senaste = lager.lista(sid)[0];
    if (senaste && Date.parse(senaste.tid) >= (s.aktiv ?? s.sist ?? 0)) continue;
    try { lager.ta(sid, s.db, { orsak: 'schema', nu }); n++; } catch (e) { console.error('Säkerhetskopian kunde inte tas:', e.message); }
  }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------
// Systemförvaltarens sida och återställningen.

const kravRoll = (personal) => { if (!kanRoll(personal, 'lagring')) throw new Fel(403, 'Bara systemförvaltningen sköter säkerhetskopiorna.', 'nekad'); };
const namn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const postUt = (db, p) => ({ id: p.id, tid: p.tid, orsak: p.orsak, orsakText: ORSAKER[p.orsak] ?? p.orsak, av: namn(db, p.av), byte: p.byte, sha256: p.sha256, platser: p.platser, verifierad: p.verifierad, kontroller: p.kontroller });

export function oversikt(lager, sid, db, personal) {
  kravRoll(personal);
  const lista = lager.lista(sid);
  const senaste = lista[0] ?? null;
  return {
    intervallMinuter: lager.intervallMinuter, behall: lager.behall, platser: lager.platser,
    senaste: senaste ? postUt(db, senaste) : null,
    senasteVerifierade: lista.find(x => x.verifierad) ? postUt(db, lista.find(x => x.verifierad)) : null,
    kopior: lista.slice(0, 20).map(p => postUt(db, p)),
    rutin: [
      `En kopia av sandlådan tas var ${lager.intervallMinuter}:e minut när något har ändrats, och före varje återställning och återgång till en tidigare version.`,
      'Varje kopia skrivs på två platser. Båda verifieras: kontrollsumman ska vara densamma som för ögonblicksbilden, och kopian läst från platsen ska vara en hel databas med alla tabeller och loggar vars hashkedjor håller.',
      'Vid en återställning väljer systemförvaltaren en tidpunkt. Systemet tar den senaste verifierade kopian före tidpunkten och läser den från den andra platsen om den första är skadad.',
      `De ${lager.behall} senaste kopiorna sparas.`,
    ],
    demoregel: lager.platser.every(p => p.typ === 'minne')
      ? 'Demoregel: servern sparar inte till disk, så de två platserna är två lager i minnet. I driften är den andra platsen en annan volym på en annan ort.'
      : 'Demoregel: de två platserna är två kataloger på samma server. I driften är den andra platsen en annan volym på en annan ort.',
  };
}

export function taNu(lager, sid, db, personal, nu = new Date()) {
  kravRoll(personal);
  const p = lager.ta(sid, db, { orsak: 'manuell', nu, av: personal.id });
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'lagring', resurs: 'sakerhetskopia', grund: 'administrativ', tid: iso(nu) });
  return { kopia: postUt(db, p) };
}

// Återställer sandlådan till en tidpunkt. Returnerar den nya databasen; anroparen byter sandlådans databas mot den.
export function aterstall(lager, sid, db, personal, { tid } = {}, { migrera = (x) => x, nu = new Date() } = {}) {
  kravRoll(personal);
  const t = typeof tid === 'string' ? Date.parse(tid) : NaN;
  if (!Number.isFinite(t)) throw new Fel(400, 'Välj tidpunkten som sandlådan ska återställas till.', 'ogiltig', { falt: ['tid'] });
  const kandidat = lager.lista(sid).find(p => p.verifierad && Date.parse(p.tid) <= t);
  if (!kandidat) throw new Fel(409, 'Det finns ingen verifierad kopia från före den tidpunkten. Välj en senare tidpunkt.', 'ogiltig');
  const r = lager.las(sid, kandidat.id);
  if (!r?.data) throw new Fel(409, 'Kopian från den tidpunkten är skadad på båda platserna. Välj en tidigare kopia.', 'ogiltig');
  // Läget som det är nu sparas först, så att återställningen går att göra ogjord.
  const fore = lager.ta(sid, db, { orsak: 'fore_aterstallning', nu, av: personal.id });
  const ny = migrera(Database.deserialize(r.data));
  ny.exec('PRAGMA foreign_keys = OFF');
  // Loggarna går aldrig förlorade: raderna som har skrivits efter kopian förs över till den återställda databasen. Loggen
  // ändras aldrig, bara läggs till, så raderna fortsätter kedjan där kopian slutar.
  for (const t of ['atkomstlogg', 'sakerhetslogg']) {
    try {
      const max = ny.query(`SELECT coalesce(max(id), 0) AS m FROM "${t}"`).get().m;
      const rader = db.query(`SELECT * FROM "${t}" WHERE id > ? ORDER BY id`).all(max);
      if (!rader.length) continue;
      const kol = Object.keys(rader[0]);
      const ins = ny.query(`INSERT INTO "${t}" (${kol.map(c => `"${c}"`).join(', ')}) VALUES (${kol.map(() => '?').join(', ')})`);
      for (const x of rader) ins.run(...kol.map(c => x[c]));
    } catch (e) { /* en äldre sandlåda utan säkerhetslogg */ }
  }
  const text = `Sandlådan återställdes till kopian från ${kandidat.tid}, läst från plats ${r.plats}. Läget före återställningen finns i kopian från ${fore.tid}.`;
  loggaRad(ny, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'lagring', resurs: 'aterstallning', grund: 'administrativ', tid: iso(nu) });
  sakerhetslogg.logga(ny, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id, beskrivning: text, tid: iso(nu) });
  return { db: ny, aterstalldTill: postUt(db, kandidat), plats: r.plats, forsok: r.forsok, fore: postUt(db, fore), text };
}
