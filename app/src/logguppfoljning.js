// Logguppföljning (runda 6, r1): export av loggposter till fil (Sussa 5.2.1.3) och stickprovskontroller enligt
// HSLF-FS 2016:40 4 kap. 9 b § (eget krav L4). Bara logggranskaren når det här, och varje export, varje stickprov och
// varje granskad rad loggas.
//
// HSLF-FS 2016:40 4 kap. 9 b § (i lydelsen enligt HSLF-FS 2025:57): vårdgivaren ska ansvara för att systematiska och
// återkommande stickprovskontroller görs av den åtkomst som har förekommit, att kontroller görs vid misstanke om
// obehörig åtkomst, att kontrollerna av loggar dokumenteras och att loggar sparas minst fem år. Systemet drar
// stickprovet slumpvis, säger vad som ska kontrolleras för varje åtkomst och sparar granskningen, så att kontrollen
// är dokumenterad. Raderna i stickprovet går inte att ändra när de är granskade.
import { Fel } from './db.js';
import * as logg from './logg.js';
import * as sakerhet from './sakerhetslogg.js';
import { visningsnamn, visningsPnr } from './atkomst.js';
// Runda 9, r5: skyddsbehovet styr stickprovet (Sussa 5.3.1.2).
import * as skyddsbehov from './skyddsbehov.js';
// Runda 7, r4: parametrar som systemförvaltningen kan ändra.
import * as konfiguration from './konfiguration.js';

const MAX_EXPORT = 100000;
export const STICKPROV_ANTAL = 10;
export const STICKPROV_DAGAR = 7;
// Hur ofta systemet föreslår ett nytt stickprov. Allmänna råd till 9 b §: frekvensen anpassas efter antalet
// användare och behandlingens omfattning. I demon en gång i veckan.
export const STICKPROV_INTERVALL_DAGAR = 7;

const patientKort = (db, id, cache) => {
  if (!id) return null;
  if (!cache.has(id)) {
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(id);
    cache.set(id, p ? { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) } : null);
  }
  return cache.get(id);
};

// Ett värde i CSV: inom citattecken, och ett värde som börjar med =, +, - eller @ får en apostrof först, så att ett
// kalkylprogram inte tolkar det som en formel.
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (kolumner, rader) => `﻿${[kolumner.map(([, rubrik]) => csvCell(rubrik)).join(';'), ...rader.map(r => kolumner.map(([k]) => csvCell(r[k])).join(';'))].join('\r\n')}\r\n`;

const ATKOMST_KOLUMNER = [['id', 'Rad'], ['tid', 'Tid'], ['personal_id', 'Personal-id'], ['personal_namn', 'Personal'], ['yrke', 'Yrke'], ['enhet_id', 'Enhet-id'],
  ['enhet', 'Enhet'], ['invanare_id', 'Invånare-id'], ['patient_id', 'Patient-id'], ['patient_personnummer', 'Patientens identitet'], ['handling', 'Handling'],
  ['resurs', 'Resurs'], ['grund', 'Grund'], ['syfte', 'Syfte'], ['resultat', 'Resultat'], ['prev_hash', 'Föregående hash'], ['hash', 'Hash']];
const SAKERHET_KOLUMNER = [['id', 'Rad'], ['tid', 'Tid'], ['typ', 'Typ'], ['personal_id', 'Personal-id'], ['personal_namn', 'Personal'], ['invanare_id', 'Invånare-id'],
  ['enhet_id', 'Enhet-id'], ['metod', 'Metod'], ['vag', 'Sökväg'], ['status', 'Status'], ['beskrivning', 'Beskrivning'], ['prev_hash', 'Föregående hash'], ['hash', 'Hash']];

// Exporten. typ är atkomst eller sakerhet, format ndjson eller csv. Raderna kommer i kedjans ordning, äldst först, med
// hash och föregående hash, så att kedjan kan kontrolleras utanför systemet.
export function exportera(db, pers, { typ = 'atkomst', format = 'ndjson', flagga = 'alla', fran = null, till = null } = {}) {
  if (!['atkomst', 'sakerhet'].includes(typ)) throw new Fel(400, 'Välj åtkomstloggen eller säkerhetsloggen.', 'ogiltig', { falt: ['typ'] });
  if (!['ndjson', 'csv'].includes(format)) throw new Fel(400, 'Välj NDJSON eller CSV.', 'ogiltig', { falt: ['format'] });
  let rader;
  if (typ === 'atkomst') {
    const prev = new Map(db.query('SELECT id, prev_hash FROM atkomstlogg').all().map(r => [r.id, r.prev_hash]));
    const cache = new Map();
    rader = logg.lista(db, { flagga, fran, till, max: MAX_EXPORT }).reverse().map(r => {
      const p = patientKort(db, r.patientId, cache);
      return {
        id: r.id, tid: r.tid, personal_id: r.personal?.id ?? null, personal_namn: r.personal?.namn ?? null, yrke: r.personal?.yrke ?? null,
        enhet_id: r.enhet?.id ?? null, enhet: r.enhet?.namn ?? null, invanare_id: r.invanare?.id ?? null, patient_id: r.patientId,
        patient_personnummer: p?.personnummer ?? null, handling: r.handling, resurs: r.resurs, grund: r.grund, syfte: r.syfte, resultat: r.resultat,
        prev_hash: prev.get(r.id), hash: r.hash,
      };
    });
  } else {
    rader = sakerhet.lista(db, { fran, till, max: MAX_EXPORT, stigande: true }).map(r => ({
      id: r.id, tid: r.tid, typ: r.typ, personal_id: r.personal?.id ?? null, personal_namn: r.personal?.namn ?? null, invanare_id: r.invanare?.id ?? null,
      enhet_id: r.enhet?.id ?? null, metod: r.metod, vag: r.vag, status: r.status, beskrivning: r.beskrivning, prev_hash: r.prev_hash, hash: r.hash,
    }));
  }
  const datum = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const namn = `${typ === 'atkomst' ? 'atkomstlogg' : 'sakerhetslogg'}-${datum}.${format}`;
  const text = format === 'ndjson' ? rader.map(r => JSON.stringify(r)).join('\n') + (rader.length ? '\n' : '')
    : csv(typ === 'atkomst' ? ATKOMST_KOLUMNER : SAKERHET_KOLUMNER, rader);
  const kedja = typ === 'atkomst' ? logg.verifiera(db) : sakerhet.verifiera(db);
  // Exporten loggas i båda loggarna: i åtkomstloggen som logggranskning och i säkerhetsloggen som export.
  const urval = `${typ === 'atkomst' ? `urval ${flagga}` : 'alla typer'}${fran ? `, från ${fran.slice(0, 10)}` : ''}${till ? `, till ${till.slice(0, 10)}` : ''}`;
  logg.loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, handling: 'las_logg', resurs: `loggexport:${typ}:${format}`, grund: 'logggranskning',
    syfte: `Export av ${rader.length} rader ur ${typ === 'atkomst' ? 'åtkomstloggen' : 'säkerhetsloggen'} som ${format.toUpperCase()}, ${urval}.`, resultat: 'tillaten' });
  sakerhet.logga(db, { typ: 'loggexport', personal_id: pers.id, enhet_id: pers.enhet_id, metod: 'GET', vag: '/api/logg/export', status: 200,
    beskrivning: `${rader.length} rader ur ${typ === 'atkomst' ? 'åtkomstloggen' : 'säkerhetsloggen'} exporterades som ${format.toUpperCase()}.` });
  return { text, namn, contentType: format === 'ndjson' ? 'application/x-ndjson; charset=utf-8' : 'text/csv; charset=utf-8', antal: rader.length, kedjaHel: kedja.hel };
}

// Vad granskaren ska kontrollera för en åtkomst, efter grunden.
export const KONTROLLERA = {
  egen_enhet: 'Uppgifterna kommer från den egna vårdenheten. Kontrollera att personen deltog i patientens vård.',
  vardrelation: 'Åtkomst på grund av vårdrelation. Kontrollera att personen deltog i patientens vård.',
  aktivt_val: 'Uppgifter från en annan vårdenhet efter ett aktivt val. Kontrollera att syftet stämmer med vården.',
  nodatkomst: 'Nödåtkomst. Kontrollera att patienten inte kunde samtycka och att uppgifterna behövdes för vården.',
  samtycke_sparr: 'Spärrade uppgifter visades med patientens samtycke. Kontrollera att samtycket fanns.',
  administrativ: 'Administrativ åtkomst. Kontrollera att uppgiften behövdes för arbetet.',
};

// Drar ett stickprov: slumpvis valda åtkomster av vårdens personal till patientuppgifter under de senaste dagarna, som
// inte har funnits i ett tidigare stickprov. Logggranskningens egna läsningar och nekade försök (som redan flaggas)
// räknas inte.
// Runda 7, r4: antalet kan ändras av systemförvaltningen (konfiguration.js). STICKPROV_ANTAL är standardvärdet.
export function dra(db, pers, { antal = konfiguration.varde(db, 'logg.stickprov_antal'), dagar = STICKPROV_DAGAR, nu = new Date() } = {}) {
  const fran = new Date(nu.getTime() - dagar * 86400_000).toISOString();
  const till = nu.toISOString();
  const kandidater = db.query(`SELECT id FROM atkomstlogg WHERE personal_id IS NOT NULL AND patient_id IS NOT NULL AND invanare_id IS NULL
      AND resultat = 'tillaten' AND grund <> 'logggranskning' AND handling <> 'las_logg' AND tid >= ? AND tid <= ?
      AND id NOT IN (SELECT logg_id FROM stickprov_rader) ORDER BY id`).all(fran, till).map(r => r.id);
  if (!kandidater.length) throw new Fel(400, `Det finns inga åtkomster från de senaste ${dagar} dagarna som inte redan har kontrollerats.`, 'ogiltig');
  // Fisher och Yates med kryptografiskt slumptal, så att urvalet inte går att förutse.
  const blanda = (lista, n) => {
    const slump = new Uint32Array(n);
    crypto.getRandomValues(slump);
    for (let i = 0; i < n; i++) {
      const j = i + (slump[i] % (lista.length - i));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista.slice(0, n);
  };
  const n = Math.min(antal, kandidater.length);
  // Runda 9, r5 (Sussa 5.3.1.2): åtkomster till uppgifter med mycket högt skyddsbehov kontrolleras alltid. När sådana
  // finns dras minst en, och upp till en tredjedel av stickprovet, slumpvis bland dem. Resten dras bland alla andra.
  const hoga = new Set(db.query(`SELECT l.id FROM atkomstlogg l WHERE l.id IN (${kandidater.map(() => '?').join(', ')}) AND ${skyddsbehov.MYCKET_HOGT_SQL}`).all(...kandidater).map(r => r.id));
  const antalHoga = hoga.size ? Math.min(hoga.size, Math.max(1, Math.floor(n / 3))) : 0;
  const forsta = blanda([...hoga], antalHoga);
  const ovriga = kandidater.filter(id => !forsta.includes(id));
  const valda = [...forsta, ...blanda(ovriga, n - forsta.length)].sort((a, b) => a - b);
  const id = db.transaction(() => {
    const r = db.query('INSERT INTO stickprov (skapad, av, fran, till, antal, urval) VALUES (?, ?, ?, ?, ?, ?)').run(till, pers.id, fran, till, n, kandidater.length);
    const sid = Number(r.lastInsertRowid);
    valda.forEach((lid, i) => db.query('INSERT INTO stickprov_rader (stickprov_id, logg_id, ordning) VALUES (?, ?, ?)').run(sid, lid, i + 1));
    return sid;
  })();
  logg.loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, handling: 'las_logg', resurs: `stickprov:${id}`, grund: 'logggranskning',
    syfte: `Stickprov med ${n} av ${kandidater.length} åtkomster från de senaste ${dagar} dagarna (HSLF-FS 2016:40 4 kap. 9 b §).`, resultat: 'tillaten' });
  sakerhet.logga(db, { typ: 'stickprov', personal_id: pers.id, enhet_id: pers.enhet_id, metod: 'POST', vag: '/api/stickprov', status: 201,
    beskrivning: `Ett stickprov med ${n} åtkomster drogs slumpvis för kontroll.` });
  return stickprov(db, id);
}

export function stickprov(db, id) {
  const s = db.query('SELECT s.*, p.namn AS av_namn FROM stickprov s LEFT JOIN personal p ON p.id = s.av WHERE s.id = ?').get(Number(id));
  if (!s) throw new Fel(404, 'Stickprovet finns inte.', 'saknas');
  const rader = db.query('SELECT r.*, p.namn AS granskad_av_namn FROM stickprov_rader r LEFT JOIN personal p ON p.id = r.granskad_av WHERE r.stickprov_id = ? ORDER BY r.ordning').all(s.id);
  const loggrader = new Map(logg.lista(db, { max: MAX_EXPORT }).filter(r => rader.some(x => x.logg_id === r.id)).map(r => [r.id, r]));
  const cache = new Map();
  return {
    id: s.id, skapad: s.skapad, av: { id: s.av, namn: s.av_namn }, fran: s.fran, till: s.till, antal: s.antal, urval: s.urval,
    granskade: rader.filter(r => r.granskad).length, kvar: rader.filter(r => !r.granskad).length,
    rader: rader.map(r => {
      const l = loggrader.get(r.logg_id);
      return {
        loggId: r.logg_id, ordning: r.ordning, tid: l?.tid, personal: l?.personal, enhet: l?.enhet, patient: patientKort(db, l?.patientId, cache),
        handling: l?.handling, resurs: l?.resurs, grund: l?.grund, syfte: l?.syfte, kontrollera: KONTROLLERA[l?.grund] ?? 'Kontrollera att åtkomsten behövdes för vården.',
        // Runda 9, r5: skyddsnivån och varför den är mycket hög.
        skyddsniva: l?.skyddsniva ?? null, skyddsorsak: l?.skyddsniva === 3 ? skyddsbehov.orsakFor(l, Boolean(patientKort(db, l.patientId, cache)?.skyddad)) : null,
        granskad: r.granskad ? { tid: r.granskad, av: { id: r.granskad_av, namn: r.granskad_av_namn }, bedomning: r.bedomning, kommentar: r.kommentar } : null,
      };
    }),
  };
}

// Översikten: alla stickprov med hur många rader som återstår, det senaste i sin helhet och när nästa föreslås.
export function oversikt(db, { nu = new Date() } = {}) {
  const alla = db.query('SELECT id FROM stickprov ORDER BY id DESC').all().map(r => stickprov(db, r.id));
  const senaste = alla[0] ?? null;
  const nasta = senaste ? new Date(Date.parse(senaste.skapad) + STICKPROV_INTERVALL_DAGAR * 86400_000).toISOString() : nu.toISOString();
  return {
    stickprov: alla.map(({ rader: _r, ...rest }) => rest), aktuellt: senaste, kvarTotalt: alla.reduce((s, x) => s + x.kvar, 0),
    nastaForeslas: nasta, dags: Date.parse(nasta) <= nu.getTime(), antal: konfiguration.varde(db, 'logg.stickprov_antal', nu), dagar: STICKPROV_DAGAR, intervallDagar: STICKPROV_INTERVALL_DAGAR,
    regel: 'HSLF-FS 2016:40 4 kap. 9 b §: systematiska och återkommande stickprovskontroller av den åtkomst som har förekommit, och kontrollerna dokumenteras.',
  };
}

// Granskaren markerar en rad som granskad. Befogad är ett klick. Utreds kräver en kommentar och flaggar åtkomsten.
export function granska(db, pers, stickprovId, loggId, { bedomning = 'befogad', kommentar = null } = {}) {
  const r = db.query('SELECT * FROM stickprov_rader WHERE stickprov_id = ? AND logg_id = ?').get(Number(stickprovId), Number(loggId));
  if (!r) throw new Fel(404, 'Raden finns inte i stickprovet.', 'saknas');
  if (r.granskad) throw new Fel(400, 'Raden är redan granskad. En granskning ändras inte.', 'ogiltig');
  if (!['befogad', 'utreds'].includes(bedomning)) throw new Fel(400, 'Bedöm åtkomsten som befogad eller som att den ska utredas.', 'ogiltig', { falt: ['bedomning'] });
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 500) : '';
  if (bedomning === 'utreds' && k.length < 3) throw new Fel(400, 'Skriv varför åtkomsten ska utredas.', 'ogiltig', { falt: ['kommentar'] });
  const nu = new Date().toISOString();
  db.query('UPDATE stickprov_rader SET granskad = ?, granskad_av = ?, bedomning = ?, kommentar = ? WHERE stickprov_id = ? AND logg_id = ?')
    .run(nu, pers.id, bedomning, k || null, r.stickprov_id, r.logg_id);
  const l = db.query('SELECT patient_id FROM atkomstlogg WHERE id = ?').get(r.logg_id);
  logg.loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: l?.patient_id ?? null, handling: 'las_logg', resurs: `stickprov:${r.stickprov_id}:rad:${r.logg_id}`,
    grund: 'logggranskning', syfte: bedomning === 'befogad' ? 'Stickprovskontroll: åtkomsten bedömdes som befogad.' : `Stickprovskontroll: åtkomsten ska utredas. ${k}`, resultat: 'tillaten' });
  return stickprov(db, r.stickprov_id);
}
