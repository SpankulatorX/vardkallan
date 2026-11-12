// Schemalagda säkerhetskopior av sandlådorna (runda 12, r2, Sussa KD1.1.3.6 Dataförlust). Varje kopia är en konsistent
// ögonblicksbild av sandlådans databas (SQLite serialize), som skrivs på två platser och verifieras på båda: samma
// kontrollsumma som ögonblicksbilden, och kopian läst från disken är hel, har alla tabeller och har loggar vars
// hashkedjor håller. Systemförvaltaren kan återställa sandlådan till en vald tidpunkt: systemet tar den senaste
// verifierade kopian före tidpunkten, tar först en kopia av läget som det är, och läser från den andra platsen om den
// första är skadad.
//
// Kopiorna hör till sandlådans stabila id (kopieId), som skapas med sandlådan och aldrig byts, och inte till
// sessionskakan. Id:t används aldrig som namn: kopiorna hålls under en HMAC av id:t med en hemlig nyckel. Demoregel: de två platserna är två kataloger på samma server (eller två lager i minnet när
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
// Runda 13, r2: kopiorna komprimeras med zstd på platserna (omkring en tiondel av storleken). En kopia från version 1.2
// är okomprimerad och läses som den är.
const ZSTD = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const packa = (data) => Buffer.from(Bun.zstdCompressSync(data, { level: 3 }));
const packaUpp = (b) => {
  if (!b) return null;
  if (!Buffer.from(b.subarray(0, 4)).equals(ZSTD)) return b;
  try { return Buffer.from(Bun.zstdDecompressSync(b)); } catch { return null; }
};

// Ett lager för en plats: en katalog på disken eller en karta i minnet.
function plats(katalog) {
  if (!katalog) {
    const m = new Map();
    return {
      typ: 'minne', namn: null,
      skriv: (k, fil, data) => { const b = fil.endsWith('.sqlite') ? packa(data) : Buffer.from(data); m.set(`${k}/${fil}`, b); return b.byteLength; },
      las: (k, fil) => { const b = m.get(`${k}/${fil}`) ?? null; return fil.endsWith('.sqlite') ? packaUpp(b) : b; },
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
      const b = fil.endsWith('.sqlite') ? packa(data) : data;
      writeFileSync(join(katalog, k, fil + '.tmp'), b, { mode: 0o600 });
      renameSync(join(katalog, k, fil + '.tmp'), join(katalog, k, fil));
      return b.byteLength;
    },
    las: (k, fil) => { let b; try { b = readFileSync(join(katalog, k, fil)); } catch { return null; } return fil.endsWith('.sqlite') ? packaUpp(b) : b; },
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
// Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 1): högst åtta kopior per sandlåda i demon, ett tak för
// diskutrymmet för alla sandlådors kopior tillsammans (maxByte, de äldsta kopiorna tas bort först) och ett tak för hur
// stor en sandlåda får vara för att kopieras (maxKopiaByte).
export const BEHALL = 8;
export const MAX_KOPIA_BYTE = 32 * 1048576;
export function skapaKopielager({ katalog = null, andraKatalog = null, hemlighet = randomBytes(32), behall = BEHALL, intervallMinuter = 15, maxByte = Infinity, maxKopiaByte = MAX_KOPIA_BYTE } = {}) {
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
  // Runda 13, r2: kopiornas storlek på disken per sandlåda, så att servern kan räkna diskutrymmet mot sitt tak.
  const storlek = new Map();
  const raknaStorlek = (k) => { const l = index.get(k) ?? []; storlek.set(k, l.reduce((s, x) => s + (x.lagrat ?? x.byte ?? 0), 0) * platser.length); };
  const sparaIndex = (k) => { const b = Buffer.from(JSON.stringify(index.get(k) ?? [])); for (const p of platser) p.skriv(k, 'index.json', b); raknaStorlek(k); };
  for (const k of platser[0].nycklar()) { lasIndex(k); raknaStorlek(k); }

  // Tar en kopia av en sandlåda. Ögonblicksbilden skrivs på båda platserna och verifieras på var och en.
  // Runda 13, r2: db kan också vara databasen som den redan är serialiserad (en sandlåda som vilar på disk).
  function ta(sid, db, { orsak = 'manuell', nu = new Date(), av = null } = {}) {
    if (!ORSAKER[orsak]) throw new Error(`Okänd orsak: ${orsak}`);
    const k = nyckel(sid);
    // Storleken prövas innan databasen serialiseras, så att en uppblåst sandlåda inte läses in i minnet en gång till.
    const storleken = db instanceof Uint8Array ? db.byteLength : db.query('PRAGMA page_count').get().page_count * db.query('PRAGMA page_size').get().page_size;
    if (storleken > maxKopiaByte) throw new Fel(413, `Sandlådan är för stor för en säkerhetskopia (${Math.round(storleken / 1048576)} MB, högst ${Math.round(maxKopiaByte / 1048576)} MB). Återställ demon för att börja om med en sandlåda av normal storlek.`, 'ogiltig');
    const data = db instanceof Uint8Array ? db : db.serialize();
    const summa = sha256(data);
    const id = `${iso(nu).replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
    const fil = `${id}.sqlite`;
    let lagrat = null;
    let forsta = null;
    const per = platser.map((p, i) => {
      try {
        lagrat = p.skriv(k, fil, data);
        // Runda 13, r2: kopian på den första platsen läses in som en databas och kontrolleras helt. På den andra räcker
        // kontrollsumman, eftersom samma byte då är kontrollerade, så att databasen inte läses in i minnet flera gånger.
        if (i === 0 || !forsta?.ok) { forsta = verifieraKopia(p.las(k, fil), summa); return { plats: i + 1, ok: forsta.ok, kontroller: forsta.kontroller }; }
        const b = p.las(k, fil);
        const ok = Boolean(b) && sha256(b) === summa;
        return { plats: i + 1, ok, kontroller: [{ id: 'summa', text: 'Kontrollsumman är densamma som för ögonblicksbilden', ok }, ...forsta.kontroller.filter(x => x.id !== 'summa')] };
      } catch (e) { return { plats: i + 1, ok: false, kontroller: [{ id: 'skriv', text: 'Kopian kunde inte skrivas', ok: false }] }; }
    });
    const post = { id, fil, tid: iso(nu), orsak, av, byte: data.byteLength, lagrat, sha256: summa, platser: per.map(({ plats: pl, ok }) => ({ plats: pl, ok })), verifierad: per.every(x => x.ok), kontroller: per[0].kontroller };
    const lista = lasIndex(k);
    lista.unshift(post);
    // De äldsta kopiorna tas bort.
    while (lista.length > behall) {
      const ut = lista.pop();
      for (const p of platser) p.radera(k, ut.fil);
    }
    sparaIndex(k);
    hallTak(k);
    return post;
  }
  // Tar bort de äldsta kopiorna över alla sandlådor tills kopiorna ryms i taket. Den kopia som just togs tas aldrig bort.
  function hallTak(skydda) {
    while (byte() > maxByte) {
      let aldst = null;
      for (const [k, l] of index) {
        const x = l[l.length - 1];
        if (!x || (k === skydda && l.length === 1)) continue;
        if (!aldst || x.tid < aldst.x.tid) aldst = { k, x };
      }
      if (!aldst) return;
      const l = index.get(aldst.k);
      l.pop();
      for (const p of platser) p.radera(aldst.k, aldst.x.fil);
      if (l.length) sparaIndex(aldst.k); else { index.delete(aldst.k); storlek.delete(aldst.k); for (const p of platser) p.radera(aldst.k); }
    }
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

  const radera = (sid) => { const k = nyckel(sid); index.delete(k); storlek.delete(k); for (const p of platser) p.radera(k); };
  // Tar bort kopiorna för varje sandlåda som inte finns. levande är id:n för sandlådorna som finns.
  function stada(levande) {
    const behall = new Set([...levande].filter(Boolean).map(nyckel));
    let n = 0;
    for (const p of platser) for (const k of p.nycklar()) if (!behall.has(k)) { p.radera(k); index.delete(k); storlek.delete(k); n++; }
    return n;
  }
  function byte() { let s = 0; for (const v of storlek.values()) s += v; return s; }

  // Bara för testerna.
  const skada = (sid, id, platsNr) => { const k = nyckel(sid); const post = lasIndex(k).find(x => x.id === id); platser[platsNr - 1].skada(k, post.fil); };

  return {
    ta, lista, las, radera, stada, skada, nyckel, intervallMinuter, behall, byte,
    platser: platser.map((p, i) => ({ plats: i + 1, typ: p.typ })),
  };
}

// Den schemalagda körningen: en kopia av varje sandlåda som har ändrats sedan sin senaste kopia. sist är när
// sandlådan senast användes (millisekunder). Returnerar antalet kopior.
// Runda 13, r2: vilande(s) ger databasen för en sandlåda som vilar på disk, så att den inte läses in i minnet för kopian.
export function schemalagda(lager, sessioner, nu = new Date(), { vilande = null } = {}) {
  let n = 0;
  for (const [sid, s] of sessioner) {
    // Sandlådans stabila id, som inte byts när sessionskakan byts.
    const id = s.kopieId ?? sid;
    const senaste = lager.lista(id)[0];
    if (senaste && Date.parse(senaste.tid) >= (s.aktiv ?? s.sist ?? 0)) continue;
    try {
      const kalla = s.vilar && vilande ? vilande(s) : s.db;
      if (!kalla) continue;
      lager.ta(id, kalla, { orsak: 'schema', nu }); n++;
    } catch (e) { console.error('Säkerhetskopian kunde inte tas:', e.message); }
  }
  return n;
}

// Runda 13, r2 (fynd 1): samma körning i servern, en sandlåda i taget med en paus emellan, så att andra anrop släpps
// fram och servern inte står still medan alla ändrade sandlådor kopieras.
export async function schemalagdaStegvis(lager, sessioner, nu = new Date(), { vilande = null } = {}) {
  let n = 0;
  for (const [sid, s] of [...sessioner]) {
    await new Promise(r => setTimeout(r, 0));
    // En sandlåda som har försvunnit under tiden kopieras inte.
    if (sessioner.get(sid) !== s) continue;
    n += schemalagda(lager, new Map([[sid, s]]), nu, { vilande });
  }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------
// Systemförvaltarens sida och återställningen.

const kravRoll = (personal) => { if (!kanRoll(personal, 'lagring')) throw new Fel(403, 'Bara systemförvaltningen sköter säkerhetskopiorna.', 'nekad'); };
const namn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const postUt = (db, p) => ({ id: p.id, tid: p.tid, orsak: p.orsak, orsakText: ORSAKER[p.orsak] ?? p.orsak, av: namn(db, p.av), byte: p.byte, sha256: p.sha256, platser: p.platser, verifierad: p.verifierad, kontroller: p.kontroller });

export function oversikt(lager, sid, db, personal, vantande = null) {
  kravRoll(personal);
  const lista = lager.lista(sid);
  const senaste = lista[0] ?? null;
  return {
    // Runda 13, r2 (fynd 4): ett förslag om inläsning som väntar på en andra systemförvaltare.
    vantande: (v => (v ? { ...v, egen: v.avId === personal.id } : null))(vantandeUt(db, vantande)),
    intervallMinuter: lager.intervallMinuter, behall: lager.behall, platser: lager.platser,
    senaste: senaste ? postUt(db, senaste) : null,
    senasteVerifierade: lista.find(x => x.verifierad) ? postUt(db, lista.find(x => x.verifierad)) : null,
    kopior: lista.slice(0, 20).map(p => postUt(db, p)),
    rutin: [
      `En kopia av sandlådan tas var ${lager.intervallMinuter}:e minut när något har ändrats, och före varje återställning och återgång till en tidigare version.`,
      'Varje kopia skrivs på två platser. Båda verifieras: kontrollsumman ska vara densamma som för ögonblicksbilden, och kopian läst från platsen ska vara en hel databas med alla tabeller och loggar vars hashkedjor håller.',
      'Vid en återställning väljer systemförvaltaren en tidpunkt. Systemet tar den senaste verifierade kopian före tidpunkten och läser den från den andra platsen om den första är skadad.',
      'En återställning görs med fyra ögon: systemet visar vad som går förlorat, och en andra systemförvaltare godkänner i sin egen inloggning. En spärr som har registrerats eller hävts efter kopian stoppar återställningen. Flerfaktorn och loggarna följer med som de är, och alla loggas ut, så att varje person loggar in på nytt med sin andra faktor.',
      `De ${lager.behall} senaste kopiorna sparas.`,
    ],
    demoregel: lager.platser.every(p => p.typ === 'minne')
      ? 'Demoregel: servern sparar inte till disk, så de två platserna är två lager i minnet. I driften är den andra platsen en annan volym på en annan ort.'
      : 'Demoregel: de två platserna är två kataloger på samma server. I driften är den andra platsen en annan volym på en annan ort.',
  };
}

// Runda 13, r2 (fynd 1): tak för manuella kopior per sandlåda. tak är sandlådans lista med tider för manuella kopior,
// som servern håller i sessionen, så att taket gäller också efter en ny inloggning och när sandlådan har vilat.
export const TAK_MANUELLA = { perMinut: 1, perTimme: 10 };
export function taNu(lager, sid, db, personal, nu = new Date(), tak = null) {
  kravRoll(personal);
  if (tak) {
    const t = nu.getTime();
    while (tak.length && tak[0] <= t - 3600_000) tak.shift();
    if (tak.filter(x => x > t - 60_000).length >= TAK_MANUELLA.perMinut) throw new Fel(429, 'Systemet tar högst en kopia i minuten när du ber om det. Den schemalagda kopian tas ändå var femtonde minut när något har ändrats.', 'for_manga');
    if (tak.length >= TAK_MANUELLA.perTimme) throw new Fel(429, 'Du har bett om tio kopior den senaste timmen, som är taket i demon. Den schemalagda kopian tas ändå var femtonde minut när något har ändrats.', 'for_manga');
  }
  const p = lager.ta(sid, db, { orsak: 'manuell', nu, av: personal.id });
  if (tak) tak.push(nu.getTime());
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
  // Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 3): en inläsning tar aldrig bort ett skydd. Faktorerna i
  // kopian finns kvar, och faktorer som har registrerats efter kopian förs över till den inlästa sandlådan.
  try {
    const finns = new Set(ny.query('SELECT agare_typ, agare_id, typ, credential_id, hemlighet FROM flerfaktorer').all().map(r => JSON.stringify(r)));
    for (const x of db.query('SELECT * FROM flerfaktorer').all()) {
      const { id, ...rad } = x;
      if (finns.has(JSON.stringify({ agare_typ: x.agare_typ, agare_id: x.agare_id, typ: x.typ, credential_id: x.credential_id, hemlighet: x.hemlighet }))) continue;
      const kol = Object.keys(rad);
      ny.query(`INSERT INTO flerfaktorer (${kol.map(c => `"${c}"`).join(', ')}) VALUES (${kol.map(() => '?').join(', ')})`).run(...kol.map(c => rad[c]));
    }
  } catch { /* en sandlåda utan flerfaktor */ }
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

// ---------------------------------------------------------------------------------------------------------------
// Runda 13, r2 (säkerhetsgranskningen av runda 12, fynd 4): inläsning av en kopia med fyra ögon. En systemförvaltare
// föreslår tidpunkten och ser vad som går förlorat, och en andra systemförvaltare godkänner i sin egen inloggning.
// En spärr som har registrerats eller hävts efter kopian stoppar inläsningen, eftersom en systemhändelse aldrig får
// häva eller lägga tillbaka en spärr.

// Det som har tillkommit efter kopian och som försvinner vid inläsningen: antal rader nu minus antal i kopian.
const FORLUST = [
  ['signerade anteckningar', 'SELECT count(*) AS n FROM anteckningar WHERE signerad_tid IS NOT NULL'],
  ['anteckningar som inte är signerade', 'SELECT count(*) AS n FROM anteckningar WHERE signerad_tid IS NULL'],
  ['mätvärden', 'SELECT count(*) AS n FROM matvarden'],
  ['ordinationer', 'SELECT count(*) AS n FROM ordinationer'],
  ['samtycken till sammanhållen journalföring', 'SELECT count(*) AS n FROM sammanhallen_samtycken'],
  ['beslut om regler, parametrar och undantag', 'SELECT count(*) AS n FROM konfig_andringar'],
  ['versioner av journalens struktur', 'SELECT count(*) AS n FROM struktur_versioner'],
  ['uppgraderingar', 'SELECT count(*) AS n FROM uppgraderingar'],
];
const rakna = (db, sql) => { try { return db.query(sql).get().n; } catch { return 0; } };
export function forlust(dbNu, dbKopia) {
  return FORLUST.map(([text, sql]) => ({ text, antal: rakna(dbNu, sql) - rakna(dbKopia, sql) })).filter(x => x.antal > 0);
}
// Antalet spärrar som har registrerats, hävts eller tagits bort efter kopian.
export function andradeSparrar(dbNu, dbKopia) {
  const karta = (db) => new Map(db.query('SELECT id, aktiv FROM sparrar').all().map(r => [r.id, r.aktiv]));
  const nu = karta(dbNu);
  const da = karta(dbKopia);
  let n = 0;
  for (const [id, aktiv] of nu) if (da.get(id) !== aktiv) n++;
  for (const id of da.keys()) if (!nu.has(id)) n++;
  return n;
}
const FORSLAG_MINUTER = 30;
function provaKopia(lager, sid, db, tid) {
  const t = typeof tid === 'string' ? Date.parse(tid) : NaN;
  if (!Number.isFinite(t)) throw new Fel(400, 'Välj tidpunkten som sandlådan ska återställas till.', 'ogiltig', { falt: ['tid'] });
  const kandidat = lager.lista(sid).find(p => p.verifierad && Date.parse(p.tid) <= t);
  if (!kandidat) throw new Fel(409, 'Det finns ingen verifierad kopia från före den tidpunkten. Välj en senare tidpunkt.', 'ogiltig');
  const r = lager.las(sid, kandidat.id);
  if (!r?.data) throw new Fel(409, 'Kopian från den tidpunkten är skadad på båda platserna. Välj en tidigare kopia.', 'ogiltig');
  const kopia = Database.deserialize(r.data);
  try {
    const sparrar = andradeSparrar(db, kopia);
    if (sparrar) throw new Fel(409, `${sparrar === 1 ? 'En spärr har' : `${sparrar} spärrar har`} registrerats eller hävts efter kopian. En inläsning skulle ändra spärrarna utan patientens begäran, så den görs inte. Välj en kopia som är tagen efter den senaste ändringen av spärrarna.`, 'ogiltig');
    return { kandidat, forlust: forlust(db, kopia) };
  } finally { kopia.close(); }
}
// Förslaget sparas i sessionen (sandlådans), så att den andra systemförvaltaren hittar det i samma sandlåda.
export function foresla(lager, sid, db, personal, { tid } = {}, nu = new Date()) {
  kravRoll(personal);
  const { kandidat, forlust: fl } = provaKopia(lager, sid, db, tid);
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id, beskrivning: `Föreslog att sandlådan läses in från kopian från ${kandidat.tid}. En andra systemförvaltare godkänner.`, tid: iso(nu) });
  return { forslag: { tid: kandidat.tid, kopiaId: kandidat.id, av: personal.id, skapad: iso(nu) }, forlust: fl };
}
export function vantandeUt(db, f, nu = new Date()) {
  if (!f || Date.parse(f.skapad) + FORSLAG_MINUTER * 60_000 < nu.getTime()) return null;
  return { tid: f.tid, av: namn(db, f.av), avId: f.av, skapad: f.skapad, forlust: f.forlust ?? [] };
}
export function godkann(lager, sid, db, personal, f, { migrera = (x) => x, nu = new Date() } = {}) {
  kravRoll(personal);
  if (!vantandeUt(db, f, nu)) throw new Fel(404, 'Det finns inget förslag om att läsa in en kopia, eller så har det gått ut efter 30 minuter. Föreslå inläsningen igen.', 'saknas');
  if (f.av === personal.id) throw new Fel(403, 'Du föreslog själv inläsningen. En andra systemförvaltare godkänner den i sin egen inloggning.', 'nekad');
  const { kandidat } = provaKopia(lager, sid, db, f.tid);
  if (kandidat.id !== f.kopiaId) throw new Fel(409, 'Kopian i förslaget finns inte längre. Föreslå inläsningen igen.', 'ogiltig');
  const r = aterstall(lager, sid, db, personal, { tid: f.tid }, { migrera, nu });
  sakerhetslogg.logga(r.db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id, beskrivning: `Godkände inläsningen som ${namn(db, f.av) ?? f.av} föreslog. Alla inloggningar i sandlådan avslutades, så att varje person loggar in på nytt mot den inlästa sandlådan med sin andra faktor.`, tid: iso(nu) });
  return r;
}
