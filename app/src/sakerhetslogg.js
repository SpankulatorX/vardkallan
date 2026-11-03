// Säkerhetsloggen (Sussa 5.3.1.12, runda 6, r1): händelser med säkerhetspåverkan som en egen loggtyp bredvid
// åtkomstloggen. Inloggning och utloggning, misslyckad inloggning, anrop som avvisas med 401 eller 403, ändrade
// behörigheter (delegering att ge läkemedel) och ändrade inställningar, export av loggen och stickprovskontroller.
// Raderna kedjas med sha256 som åtkomstloggen, och databastriggrar stoppar ändring och radering (schema-runda6-r1.js).
// Ingen fritext från adressen sparas: sökvägen sparas normaliserad, med :id i stället för patientens id.
import { createHash } from 'node:crypto';

const NOLL = '0'.repeat(64);
const FALT = ['id', 'tid', 'typ', 'personal_id', 'invanare_id', 'enhet_id', 'metod', 'vag', 'status', 'beskrivning'];

export const TYPER = {
  inloggning: 'Inloggning', utloggning: 'Utloggning', inloggning_misslyckad: 'Misslyckad inloggning', avvisat_anrop: 'Avvisat anrop',
  andrad_behorighet: 'Ändrad behörighet', andrad_installning: 'Ändrad inställning', loggexport: 'Export av loggen', stickprov: 'Stickprovskontroll',
};

const kanonisk = (r) => JSON.stringify(Object.fromEntries(FALT.map(f => [f, r[f] ?? null])));
const hashFor = (prev, r) => createHash('sha256').update(prev + kanonisk(r)).digest('hex');

export function logga(db, rad) {
  if (!TYPER[rad.typ]) throw new Error(`Okänd typ i säkerhetsloggen: ${rad.typ}`);
  const forra = db.query('SELECT id, hash FROM sakerhetslogg ORDER BY id DESC LIMIT 1').get();
  const r = {
    id: (forra?.id ?? 0) + 1, tid: rad.tid ?? new Date().toISOString(), typ: rad.typ, personal_id: rad.personal_id ?? null, invanare_id: rad.invanare_id ?? null,
    enhet_id: rad.enhet_id ?? null, metod: rad.metod ?? null, vag: rad.vag ?? null, status: rad.status ?? null, beskrivning: rad.beskrivning,
  };
  const prev = forra?.hash ?? NOLL;
  const hash = hashFor(prev, r);
  db.query(`INSERT INTO sakerhetslogg (id, tid, typ, personal_id, invanare_id, enhet_id, metod, vag, status, beskrivning, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.id, r.tid, r.typ, r.personal_id, r.invanare_id, r.enhet_id, r.metod, r.vag, r.status, r.beskrivning, prev, hash);
  return { ...r, prev_hash: prev, hash };
}

export function verifiera(db) {
  let prev = NOLL;
  let antal = 0;
  for (const r of db.query('SELECT * FROM sakerhetslogg ORDER BY id').iterate()) {
    antal++;
    if (r.id !== antal) return { hel: false, antal, felRad: r.id, orsak: 'En eller flera rader saknas' };
    if (r.prev_hash !== prev) return { hel: false, antal, felRad: r.id, orsak: 'Kedjan är bruten' };
    if (hashFor(prev, r) !== r.hash) return { hel: false, antal, felRad: r.id, orsak: 'Raden har ändrats' };
    prev = r.hash;
  }
  return { hel: true, antal, felRad: null, orsak: null };
}

export function lista(db, { typ = null, fran = null, till = null, max = 500, stigande = false } = {}) {
  const villkor = ['1 = 1'];
  const arg = [];
  if (typ && TYPER[typ]) { villkor.push('s.typ = ?'); arg.push(typ); }
  if (fran) { villkor.push('s.tid >= ?'); arg.push(fran); }
  if (till) { villkor.push('s.tid <= ?'); arg.push(till); }
  arg.push(max);
  return db.query(`SELECT s.*, p.namn AS personal_namn, p.yrke AS personal_yrke, e.namn AS enhet_namn FROM sakerhetslogg s
      LEFT JOIN personal p ON p.id = s.personal_id LEFT JOIN enheter e ON e.id = s.enhet_id
    WHERE ${villkor.join(' AND ')} ORDER BY s.id ${stigande ? 'ASC' : 'DESC'} LIMIT ?`).all(...arg).map(r => ({
    id: r.id, tid: r.tid, typ: r.typ, typText: TYPER[r.typ], personal: r.personal_id ? { id: r.personal_id, namn: r.personal_namn, yrke: r.personal_yrke } : null,
    invanare: r.invanare_id ? { id: r.invanare_id } : null, enhet: r.enhet_id ? { id: r.enhet_id, namn: r.enhet_namn } : null,
    metod: r.metod, vag: r.vag, status: r.status, beskrivning: r.beskrivning, prev_hash: r.prev_hash, hash: r.hash,
  }));
}

const KOD = { nekad: 'nekad', kraver_val: 'kräver ett aktivt val eller nödåtkomst', kraver_samtycke: 'kräver patientens samtycke', ej_inloggad: 'inte inloggad' };

// Vilka anrop som är säkerhetshändelser när de lyckas. Nyckeln är metoden och den normaliserade sökvägen.
const VID_LYCKAT = [
  ['POST', '/api/delegeringar', 'andrad_behorighet', 'En delegering att ge läkemedel registrerades. Undersköterskans behörighet ändrades.'],
  ['POST', '/api/delegering/:id/aterkalla', 'andrad_behorighet', 'En delegering att ge läkemedel återkallades. Undersköterskans behörighet ändrades.'],
  ['POST', '/api/demo/nll-timeout', 'andrad_installning', 'Inställningen för nästa överföring till NLL ändrades i demon.'],
  ['POST', '/api/reset', 'andrad_installning', 'Demon återställdes till en ny sandlåda.'],
  // Runda 6, r6: uppdragen i läkemedelshanteringen ger rätt att fastställa direktiv och godkänna mallar.
  ['POST', '/api/lakemedelsansvar/uppdrag', 'andrad_behorighet', 'Verksamhetschefen utsåg ett uppdrag i läkemedelshanteringen. Personens behörighet ändrades.'],
  ['POST', '/api/lakemedelsansvar/uppdrag/:id/avsluta', 'andrad_behorighet', 'Verksamhetschefen avslutade ett uppdrag i läkemedelshanteringen. Personens behörighet ändrades.'],
];
const INLOGGNING = ['/api/login', '/api/login/invanare'];
const UTLOGGNING = '/api/logout';
const ATERSTALL = '/api/reset';

// Anropas av servern efter varje anrop till /api och /fhir med en sandlåda. fore är den inloggade före anropet.
export function efterAnrop(db, { nyckel, status, kod = null, fore = {}, efter = {} }) {
  if (!db) return;
  const [metod, vag] = nyckel.split(' ');
  const vem = (x) => ({ personal_id: x.personal?.id ?? null, invanare_id: x.invanare?.id ?? null, enhet_id: x.personal?.enhet_id ?? null });
  const bas = { metod, vag, status };
  const ok = status < 400;
  if (metod === 'POST' && INLOGGNING.includes(vag)) {
    const invanare = vag === INLOGGNING[1];
    if (ok) logga(db, { ...bas, ...vem(efter), typ: 'inloggning', beskrivning: invanare ? 'Invånaren loggade in i Min journal med e-legitimation (simulerad).' : 'Inloggning med SITHS-kort (simulerat).' });
    else logga(db, { ...bas, ...vem(fore), typ: 'inloggning_misslyckad', beskrivning: invanare ? 'Inloggningen i Min journal misslyckades.' : 'Inloggningen misslyckades: personen finns inte bland demorollerna.' });
    return;
  }
  if (metod === 'POST' && vag === UTLOGGNING) {
    if (ok && (fore.personal || fore.invanare)) logga(db, { ...bas, ...vem(fore), typ: 'utloggning', beskrivning: fore.invanare ? 'Invånaren loggade ut ur Min journal.' : 'Utloggning.' });
    return;
  }
  if (status === 401 || status === 403) {
    logga(db, { ...bas, ...vem(fore), typ: 'avvisat_anrop', beskrivning: `Anropet avvisades med ${status}${KOD[kod] ? `, ${KOD[kod]}` : ''}.` });
    return;
  }
  const h = ok && VID_LYCKAT.find(([m, v]) => m === metod && v === vag);
  if (h) logga(db, { ...bas, ...vem(vag === ATERSTALL ? efter : fore), typ: h[2], beskrivning: h[3] });
}
