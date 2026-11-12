// Runda 14, r5: incidentregistret, servicenivårapporten och incidentrapporten till beställaren (Sussa KD1.2.1.1 till
// KD1.2.1.4, KD1.3.2.2, KD1.3.2.3 och 5.3.1.14). Processerna finns i docs/drift/processhandbok.md,
// docs/drift/servicenivaer.md och docs/drift/incidentrapportering.md.
//
// Systemet är experten: systemförvaltaren svarar på två frågor på vanlig svenska, och systemet sätter prioriteten enligt
// prioritetsmodellen i upphandlingens bilaga DU2, räknar åtgärdstiden mot gränsvärdet, säger när beställaren ska ha
// rapporten och när processen för en större incident ska startas, och räknar månadsrapporten ur registret och systemets
// egna mått. En incident har inga patientuppgifter: texter som ser ut att innehålla ett personnummer tas inte emot.
// Inget här rör en enskild patient, och systemförvaltaren läser inte journalen.
import { Fel, datumAv, lokalTid, giltigtDatum, addDagar } from './db.js';
import { kanRoll } from './atkomst.js';
import * as sakerhet from './sakerhetslogg.js';

const MIN = 60_000;
const TIMME = 60 * MIN;

// Prioritetsmodellen och gränsvärdena i produktionsmiljön, alla dagar 00 till 24 (bilaga DU2, avsnitt 2 och 2.1).
// rapportera är förslaget till anvisning för rapportering till beställaren (5.3.1.14), tills beställaren har gett sin.
export const PRIORITETER = {
  1: { namn: 'Kritisk', atgardTimmar: 2, maxPerAr: 3, maxTimmarPerAr: 4, rapporteraMinuter: 30,
    text: 'Akut incident med mycket stor påverkan på verksamheten eller på möjligheten att använda systemet. En väsentlig del av användarna eller en kritisk del av verksamheten berörs.' },
  2: { namn: 'Hög', atgardTimmar: 4, maxPerAr: 8, maxTimmarPerAr: 16, rapporteraMinuter: 120,
    text: 'Brådskande incident med stor påverkan på verksamheten eller på möjligheten att använda systemet. En väsentlig del av användarna eller en kritisk del av verksamheten berörs.' },
  3: { namn: 'Medel', atgardTimmar: 12, maxPerAr: null, maxTimmarPerAr: null, rapporteraMinuter: 24 * 60,
    text: 'Incident som inte är brådskande och som påverkar ett fåtal användare eller har en begränsad påverkan på verksamheten.' },
  4: { namn: 'Låg', atgardTimmar: null, maxPerAr: null, maxTimmarPerAr: null, rapporteraMinuter: null,
    text: 'Mindre avvikelse eller skönhetsfel. Åtgärdstiden överenskoms från fall till fall.' },
};
// En personuppgiftsincident ska vårdgivaren som personuppgiftsansvarig anmäla till IMY inom 72 timmar
// (dataskyddsförordningen artikel 33). Driften rapporterar därför till beställaren inom 24 timmar.
export const PERSONUPPGIFT_RAPPORTERA_MINUTER = 24 * 60;
// Prioritet 1 som inte är löst inom 2 timmar startar processen för en större incident (KD1.3.2.3).
export const MAJOR_TIMMAR = 2;

export const KATEGORIER = { drift: 'Driftstörning', sakerhet: 'Säkerhetsincident', redundans: 'Avtalad redundans saknas' };
export const OMFATTNING = {
  alla: 'Alla eller en väsentlig del av användarna',
  kritisk: 'En kritisk del av verksamheten, till exempel en akutmottagning eller läkemedelshanteringen',
  fatal: 'Ett fåtal användare',
  ingen: 'Ingen märker det ännu, eller det är ett skönhetsfel',
};
export const PAVERKAN = {
  stoppar: 'Nej, systemet eller en kritisk funktion går inte att använda',
  begransar: 'Ja, men mycket begränsat eller långsamt',
  vag_runt: 'Ja, med en enkel väg runt felet',
};

const kravRoll = (personal) => { if (!kanRoll(personal, 'servicenivaer')) throw new Fel(403, 'Bara systemförvaltningen följer upp servicenivåer och incidenter.', 'nekad'); };
const fel = (text) => new Fel(400, text, 'ogiltig');

// Prioriteten ur svaren, med skälet på vanlig svenska.
export function prioritet({ kategori = 'drift', omfattning, paverkan } = {}) {
  if (kategori === 'redundans') return { prioritet: 2, skal: 'Avtalad redundans saknas utan att någon incident har inträffat. Det hanteras som en incident med prioritet 2 (KD1.2.1.4). Har bristen redan lett till en störning, registrera störningen som en driftstörning.' };
  if (!Object.hasOwn(OMFATTNING, omfattning ?? '')) throw fel('Välj hur många som berörs.');
  if (omfattning === 'ingen') return { prioritet: 4, skal: 'Ingen användare berörs ännu, eller det är ett skönhetsfel. Det är prioritet 4 (Låg).' };
  if (!Object.hasOwn(PAVERKAN, paverkan ?? '')) throw fel('Välj om vården kan arbeta.');
  if (omfattning === 'fatal') return { prioritet: 3, skal: 'Ett fåtal användare berörs. Det är prioritet 3 (Medel).' };
  const vem = omfattning === 'alla' ? 'En väsentlig del av användarna berörs' : 'En kritisk del av verksamheten berörs';
  if (paverkan === 'stoppar') return { prioritet: 1, skal: `${vem} och kan inte använda systemet. Det är prioritet 1 (Kritisk).` };
  if (paverkan === 'begransar') return { prioritet: 2, skal: `${vem}, och vården kan bara arbeta mycket begränsat. Det är prioritet 2 (Hög).` };
  return { prioritet: 3, skal: `${vem}, men det finns en enkel väg runt felet. Det är prioritet 3 (Medel).` };
}

// En incident har inga patientuppgifter. Ett personnummer, samordningsnummer eller reservnummer tas inte emot.
const PNR = /(?<!\d)(?:\d{2})?\d{6}[-+ ]?\d{4}(?!\d)/;
function text(v, namn, { min = 0, max = 1000 } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw fel(`${namn} ska vara text.`);
  const t = v.normalize('NFC').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim();
  if (t.length < min) throw fel(min > 1 ? `Skriv ${namn.toLowerCase()} med minst ${min} tecken.` : `Skriv ${namn.toLowerCase()}.`);
  if (t.length > max) throw fel(`${namn} får vara högst ${max} tecken.`);
  if (PNR.test(t)) throw fel(`Skriv inga patientuppgifter i incidenten. ${namn} ser ut att innehålla ett personnummer.`);
  return t;
}
function tidpunkt(v, nu, namn, { tidigast = null } = {}) {
  if (v === undefined || v === null || v === '') return nu.toISOString();
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw fel(`${namn} är inte en tidpunkt.`);
  const t = new Date(v);
  if (t.getTime() > nu.getTime() + MIN) throw fel(`${namn} kan inte ligga i framtiden.`);
  if (t.getTime() < nu.getTime() - 90 * 24 * TIMME) throw fel(`${namn} får ligga högst 90 dagar bakåt.`);
  if (tidigast && t.getTime() < Date.parse(tidigast)) throw fel(`${namn} kan inte ligga före när incidenten började.`);
  return t.toISOString();
}

export function sakra(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS incidenter (
    id INTEGER PRIMARY KEY AUTOINCREMENT, rubrik TEXT NOT NULL, beskrivning TEXT NOT NULL DEFAULT '', kategori TEXT NOT NULL,
    omfattning TEXT, paverkan TEXT, personuppgifter INTEGER NOT NULL DEFAULT 0, prioritet INTEGER NOT NULL, skal TEXT NOT NULL,
    borjade TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL,
    avslutad TEXT, avslutad_av TEXT, orsak TEXT, konsekvens TEXT, atgard TEXT, forebyggande TEXT,
    uppfoljningsmote TEXT, uppfoljning_av TEXT, rapporterad TEXT
  )`);
  return db;
}

const datumTid = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const minuter = (fran, till) => Math.max(0, Math.round((Date.parse(till) - Date.parse(fran)) / MIN));
export const timmarText = (min) => (min < 60 ? `${min} minuter` : `${Math.floor(min / 60)} timmar${min % 60 ? ` och ${min % 60} minuter` : ''}`).replace(/^1 timmar/, '1 timme').replace(/ 1 minuter$/, ' 1 minut');

// När beställaren senast ska ha fått rapporten om incidenten, eller null när den räcker i månadsrapporten.
export function rapporteraSenast(r) {
  const gr = [PRIORITETER[r.prioritet].rapporteraMinuter, r.personuppgifter ? PERSONUPPGIFT_RAPPORTERA_MINUTER : null].filter(x => x !== null);
  return gr.length ? new Date(Date.parse(r.registrerad) + Math.min(...gr) * MIN).toISOString() : null;
}

export function incidentUt(r, nu = new Date()) {
  const p = PRIORITETER[r.prioritet];
  const slut = r.avslutad ?? nu.toISOString();
  const atgardMin = minuter(r.borjade, slut);
  const malMin = p.atgardTimmar ? p.atgardTimmar * 60 : null;
  const senast = rapporteraSenast(r);
  const major = r.prioritet === 1 && atgardMin > MAJOR_TIMMAR * 60;
  const kravsUppfoljning = r.prioritet <= 2;
  let nasta;
  if (!r.avslutad && major) nasta = `Starta processen för en större incident (Major Incident): prioritet 1 har pågått i ${timmarText(atgardMin)}, mer än ${MAJOR_TIMMAR} timmar.`;
  else if (senast && !r.rapporterad) nasta = Date.parse(senast) < nu.getTime() ? `Rapportera till beställaren nu. Tidsgränsen var ${datumTid(senast)}.` : `Rapportera till beställaren senast ${datumTid(senast)}.`;
  else if (!r.avslutad) nasta = kravsUppfoljning ? 'Avsluta incidenten när felet är åtgärdat, med orsak, konsekvens, åtgärd och vad som görs för att det inte ska hända igen.' : 'Avsluta incidenten när felet är åtgärdat.';
  else if (kravsUppfoljning && !r.uppfoljningsmote) nasta = 'Håll incidentuppföljningsmötet med beställaren och registrera det. Underlaget är det som skrevs när incidenten avslutades.';
  else nasta = null;
  return {
    id: r.id, rubrik: r.rubrik, beskrivning: r.beskrivning, kategori: r.kategori, kategoriText: KATEGORIER[r.kategori],
    omfattning: r.omfattning, omfattningText: OMFATTNING[r.omfattning] ?? null, paverkan: r.paverkan, paverkanText: PAVERKAN[r.paverkan] ?? null,
    personuppgifter: Boolean(r.personuppgifter), prioritet: r.prioritet, prioritetNamn: p.namn, prioritetText: p.text, skal: r.skal,
    borjade: r.borjade, registrerad: r.registrerad, avslutad: r.avslutad, pagar: !r.avslutad,
    atgardstid: { minuter: atgardMin, text: timmarText(atgardMin), malMinuter: malMin, inomMal: malMin === null ? null : atgardMin <= malMin },
    major: { aktiv: major && !r.avslutad, intraffade: major },
    rapportering: { senast, rapporterad: r.rapporterad, iTid: senast ? (r.rapporterad ? Date.parse(r.rapporterad) <= Date.parse(senast) : (Date.parse(senast) < nu.getTime() ? false : null)) : null,
      text: senast ? `Beställaren ska ha rapporten senast ${datumTid(senast)}.` : 'Redovisas i månadsrapporten.' },
    uppfoljning: { kravs: kravsUppfoljning, orsak: r.orsak, konsekvens: r.konsekvens, atgard: r.atgard, forebyggande: r.forebyggande, mote: r.uppfoljningsmote },
    nasta,
  };
}

const hamta = (db, id) => {
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM incidenter WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Incidenten finns inte.');
  return r;
};

export function registrera(db, personal, body = {}, nu = new Date()) {
  kravRoll(personal);
  const kategori = body.kategori ?? 'drift';
  if (!Object.hasOwn(KATEGORIER, kategori)) throw fel('Okänd kategori.');
  const rubrik = text(body.rubrik, 'Rubriken', { min: 3, max: 120 });
  const beskrivning = text(body.beskrivning, 'Beskrivningen', { max: 1000 });
  const { prioritet: prio, skal } = prioritet({ kategori, omfattning: body.omfattning, paverkan: body.paverkan });
  if (body.personuppgifter !== undefined && typeof body.personuppgifter !== 'boolean') throw fel('Personuppgiftsincident ska vara ja eller nej.');
  const personuppgifter = kategori === 'sakerhet' && body.personuppgifter === true;
  const borjade = tidpunkt(body.borjade, nu, 'Starttiden');
  const r = db.query(`INSERT INTO incidenter (rubrik, beskrivning, kategori, omfattning, paverkan, personuppgifter, prioritet, skal, borjade, registrerad, registrerad_av)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(rubrik, beskrivning, kategori, kategori === 'redundans' ? null : body.omfattning,
    kategori === 'redundans' || body.omfattning === 'ingen' ? null : body.paverkan, personuppgifter ? 1 : 0, prio, skal, borjade, nu.toISOString(), personal.id);
  sakerhet.logga(db, { typ: 'incident', personal_id: personal.id, tid: nu.toISOString(), beskrivning: `Incident ${r.id} registrerades: ${KATEGORIER[kategori].toLowerCase()} med prioritet ${prio}${personuppgifter ? ', personuppgiftsincident' : ''}.` });
  return incidentUt(r, nu);
}

export function avsluta(db, personal, id, body = {}, nu = new Date()) {
  kravRoll(personal);
  const r = hamta(db, id);
  if (r.avslutad) throw new Fel(409, 'Incidenten är redan avslutad.', 'konflikt');
  const tid = tidpunkt(body.tid, nu, 'Sluttiden', { tidigast: r.borjade });
  // Prioritet 1 och 2: underlaget till incidentuppföljningsmötet (KD1.3.2.2).
  const min = r.prioritet <= 2 ? 5 : 0;
  if (min) {
    const saknas = [['orsak', 'orsaken'], ['konsekvens', 'konsekvensen'], ['atgard', 'åtgärden'], ['forebyggande', 'vad som görs för att det inte ska hända igen']]
      .filter(([k]) => typeof body[k] !== 'string' || body[k].trim().length < min).map(([, t]) => t);
    if (saknas.length) throw fel(`Skriv ${saknas.join(', ').replace(/, ([^,]*)$/, ' och $1')}. En incident med prioritet ${r.prioritet} avslutas med underlaget till incidentuppföljningsmötet.`);
  }
  const f = {
    orsak: text(body.orsak, 'Orsaken', { min }), konsekvens: text(body.konsekvens, 'Konsekvensen', { min }),
    atgard: text(body.atgard, 'Åtgärden', { min }), forebyggande: text(body.forebyggande, 'Det som görs för att det inte ska hända igen', { min }),
  };
  const ut = db.query(`UPDATE incidenter SET avslutad = ?, avslutad_av = ?, orsak = ?, konsekvens = ?, atgard = ?, forebyggande = ? WHERE id = ? RETURNING *`)
    .get(tid, personal.id, f.orsak, f.konsekvens, f.atgard, f.forebyggande, r.id);
  sakerhet.logga(db, { typ: 'incident', personal_id: personal.id, tid: nu.toISOString(), beskrivning: `Incident ${r.id} avslutades efter ${timmarText(minuter(r.borjade, tid))}.` });
  return incidentUt(ut, nu);
}

export function uppfoljning(db, personal, id, body = {}, nu = new Date()) {
  kravRoll(personal);
  const r = hamta(db, id);
  if (r.prioritet > 2) throw fel('Incidentuppföljningsmöten hålls för prioritet 1 och 2.');
  if (!r.avslutad) throw fel('Avsluta incidenten först, så att underlaget till mötet finns.');
  const datum = body.datum ?? datumAv(nu);
  if (!giltigtDatum(datum)) throw fel('Datumet för mötet är inte ett datum.');
  if (datum > datumAv(nu)) throw fel('Mötet kan inte registreras innan det har hållits.');
  if (datum < datumAv(new Date(r.avslutad))) throw fel('Mötet kan inte ha hållits innan incidenten avslutades.');
  const ut = db.query('UPDATE incidenter SET uppfoljningsmote = ?, uppfoljning_av = ? WHERE id = ? RETURNING *').get(datum, personal.id, r.id);
  sakerhet.logga(db, { typ: 'incident', personal_id: personal.id, tid: nu.toISOString(), beskrivning: `Incidentuppföljningsmötet för incident ${r.id} hölls ${datum}.` });
  return incidentUt(ut, nu);
}

export function lista(db, personal, nu = new Date()) {
  kravRoll(personal);
  const rader = db.query('SELECT * FROM incidenter ORDER BY (avslutad IS NULL) DESC, borjade DESC LIMIT 200').all().map(r => incidentUt(r, nu));
  return {
    incidenter: rader, pagar: rader.filter(r => r.pagar).length,
    val: { kategorier: KATEGORIER, omfattning: OMFATTNING, paverkan: PAVERKAN },
    prioriteter: Object.entries(PRIORITETER).map(([k, p]) => ({ prioritet: Number(k), ...p })),
  };
}

// Månadens gränser i svensk tid, som ISO i UTC.
export function manadGranser(manad) {
  if (typeof manad !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(manad)) throw fel('Månaden ska skrivas som ÅÅÅÅ-MM.');
  const [y, m] = manad.split('-').map(Number);
  const nasta = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { fran: lokalTid(`${manad}-01`, '00:00'), till: lokalTid(`${nasta}-01`, '00:00'), nasta, forra: m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` };
}
const overlapp = (a0, a1, b0, b1) => Math.max(0, Math.min(Date.parse(a1), Date.parse(b1)) - Math.max(Date.parse(a0), Date.parse(b0)));
const procent = (x) => Math.round(x * 100000) / 1000;

// Servicenivårapporten för en månad (KD1.2.1.2), räknad ur incidentregistret och systemets egna mått. matning är
// serverns svarstider per adress med inomMal, och kopior är säkerhetskopiornas översikt (sakerhetskopior.oversikt).
export function rapport(db, personal, { manad = null, nu = new Date(), matning = [], malP95 = 200, kopior = null } = {}) {
  kravRoll(personal);
  const m = manad ?? datumAv(nu).slice(0, 7);
  const g = manadGranser(m);
  if (Date.parse(g.fran) > nu.getTime()) throw fel('Månaden har inte börjat än.');
  const slut = new Date(Math.min(Date.parse(g.till), nu.getTime())).toISOString();
  const pagar = Date.parse(g.till) > nu.getTime();
  const alla = db.query('SELECT * FROM incidenter ORDER BY borjade').all();
  const iManad = alla.filter(r => Date.parse(r.borjade) < Date.parse(g.till) && Date.parse(r.avslutad ?? nu.toISOString()) > Date.parse(g.fran)).map(r => incidentUt(r, nu));
  const ar = m.slice(0, 4);
  const arFran = lokalTid(`${ar}-01-01`, '00:00');
  const prioriteter = Object.entries(PRIORITETER).map(([k, p]) => {
    const n = Number(k);
    const egna = iManad.filter(r => r.prioritet === n);
    const iAr = alla.filter(r => r.prioritet === n && Date.parse(r.borjade) >= Date.parse(arFran) && Date.parse(r.borjade) < Date.parse(g.till)).map(r => incidentUt(r, nu));
    const arMin = iAr.reduce((s, r) => s + r.atgardstid.minuter, 0);
    return {
      prioritet: n, namn: p.namn, antal: egna.length, pagar: egna.filter(r => r.pagar).length,
      overskridna: egna.filter(r => r.atgardstid.inomMal === false).length, malTimmar: p.atgardTimmar,
      langst: egna.length ? timmarText(Math.max(...egna.map(r => r.atgardstid.minuter))) : null,
      aretHittills: { antal: iAr.length, maxAntal: p.maxPerAr, minuter: arMin, text: timmarText(arMin), maxTimmar: p.maxTimmarPerAr,
        overAntal: p.maxPerAr !== null && iAr.length > p.maxPerAr, overTid: p.maxTimmarPerAr !== null && arMin > p.maxTimmarPerAr * 60 },
    };
  });
  // Tillgängligheten: andelen av månadens minuter hittills utan pågående incident av prioritet 1.
  const periodMs = Date.parse(slut) - Date.parse(g.fran);
  const stoppMs = alla.filter(r => r.prioritet === 1).reduce((s, r) => s + overlapp(r.borjade, r.avslutad ?? nu.toISOString(), g.fran, slut), 0);
  const tillganglighet = { utfall: periodMs > 0 ? procent(1 - stoppMs / periodMs) : 100, avbrott: timmarText(Math.round(stoppMs / MIN)), avbrottMinuter: Math.round(stoppMs / MIN),
    text: 'Andelen av månadens minuter utan pågående incident av prioritet 1. Planerat underhåll som beställaren har godkänt räknas inte som incident.' };
  const rapportering = iManad.filter(r => r.rapportering.senast);
  const sen = rapportering.filter(r => r.rapportering.iTid === false);
  const svarstider = { malP95Ms: malP95, adresser: matning.length, overMal: matning.filter(x => !x.inomMal).length,
    hogstaP95Ms: matning.length ? Math.max(...matning.map(x => x.p95)) : null,
    text: 'Serverns svarstider per adress i API:t sedan servern startade (de senaste 1 000 anropen per adress), inte per månad. Mätpunkten är servern. Svarstiden vid beställarens anslutningspunkt mäts av driften.' };
  const kopiorIManad = (kopior?.kopior ?? []).filter(k => Date.parse(k.tid) >= Date.parse(g.fran) && Date.parse(k.tid) < Date.parse(g.till));
  const sakerhetskopior = kopior ? { antal: kopiorIManad.length, verifierade: kopiorIManad.filter(k => k.verifierad).length,
    senasteVerifierade: kopior.senasteVerifierade?.tid ?? null, platser: (kopior.platser ?? []).length } : null;
  const handelser = db.query('SELECT typ, COUNT(*) AS antal FROM sakerhetslogg WHERE tid >= ? AND tid < ? GROUP BY typ ORDER BY typ').all(g.fran, g.till)
    .map(x => ({ typ: x.typ, typText: sakerhet.TYPER[x.typ] ?? x.typ, antal: x.antal }));
  const kedja = sakerhet.verifiera(db);
  const avvikelser = [];
  for (const p of prioriteter) {
    if (p.overskridna) avvikelser.push(`${p.overskridna} ${p.overskridna === 1 ? 'incident' : 'incidenter'} med prioritet ${p.prioritet} åtgärdades inte inom ${p.malTimmar} timmar.`);
    if (p.aretHittills.overAntal) avvikelser.push(`Året hittills har ${p.aretHittills.antal} incidenter med prioritet ${p.prioritet} inträffat. Gränsvärdet är ${p.aretHittills.maxAntal} per år.`);
    if (p.aretHittills.overTid) avvikelser.push(`Den sammanlagda åtgärdstiden för prioritet ${p.prioritet} är ${p.aretHittills.text} året hittills. Gränsvärdet är ${p.aretHittills.maxTimmar} timmar per år.`);
  }
  if (sen.length) avvikelser.push(`${sen.length} ${sen.length === 1 ? 'incident' : 'incidenter'} rapporterades inte till beställaren i tid.`);
  for (const r of iManad.filter(x => x.major.intraffade)) avvikelser.push(`Incident ${r.id} med prioritet 1 pågick i ${r.atgardstid.text} och krävde processen för en större incident.`);
  for (const r of iManad.filter(x => x.uppfoljning.kravs && x.avslutad && !x.uppfoljning.mote)) avvikelser.push(`Incidentuppföljningsmötet för incident ${r.id} är inte registrerat.`);
  if (svarstider.overMal) avvikelser.push(`${svarstider.overMal} av ${svarstider.adresser} adresser i API:t har p95 över målet ${malP95} ms.`);
  if (sakerhetskopior && !sakerhetskopior.senasteVerifierade) avvikelser.push('Det finns ingen verifierad säkerhetskopia.');
  if (!kedja.hel) avvikelser.push(`Säkerhetsloggens kedja håller inte: ${kedja.orsak.toLowerCase()} vid rad ${kedja.felRad}.`);
  return {
    manad: m, fran: g.fran, till: g.till, forra: g.forra, nasta: pagar ? null : g.nasta, pagar, skapad: nu.toISOString(),
    sammanfattning: avvikelser.length
      ? `${avvikelser.length} ${avvikelser.length === 1 ? 'avvikelse' : 'avvikelser'} mot servicenivåerna ${pagar ? 'hittills i månaden' : 'under månaden'}.`
      : `Inga avvikelser mot servicenivåerna ${pagar ? 'hittills i månaden' : 'under månaden'}.`,
    avvikelser, tillganglighet, prioriteter, svarstider, sakerhetskopior,
    rapportering: { antal: rapportering.length, iTid: rapportering.filter(r => r.rapportering.iTid === true).length, sena: sen.length, vantar: rapportering.filter(r => r.rapportering.iTid === null).length },
    sakerhetslogg: { handelser, kedjanHel: kedja.hel },
    incidenter: iManad,
    kalla: 'Gränsvärdena är servicenivåerna i produktionsmiljön enligt upphandlingens bilaga DU2. Värdena ska överenskommas med beställaren och kan då ändras.',
  };
}

// Incidentrapporten till beställaren (5.3.1.14) för en period: incidenterna med underlaget och säkerhetsloggens
// händelser räknade per typ. Ingen person och ingen patient finns med. Incidenterna markeras som rapporterade.
export function exportera(db, personal, body = {}, nu = new Date()) {
  kravRoll(personal);
  const idag = datumAv(nu);
  const till = body.till ?? idag;
  const fran = body.fran ?? addDagar(till, -30);
  if (!giltigtDatum(fran) || !giltigtDatum(till)) throw fel('Perioden ska skrivas som ÅÅÅÅ-MM-DD.');
  if (fran > till) throw fel('Periodens början ligger efter dess slut.');
  if (till > idag) throw fel('Perioden kan inte sluta i framtiden.');
  if (addDagar(fran, 366) < till) throw fel('Perioden får vara högst ett år.');
  const g0 = lokalTid(fran, '00:00');
  const g1 = lokalTid(addDagar(till, 1), '00:00');
  const rader = db.query('SELECT * FROM incidenter WHERE borjade < ? AND (avslutad IS NULL OR avslutad >= ?) ORDER BY borjade').all(g1, g0);
  const nyRapporterade = rader.filter(r => !r.rapporterad).map(r => r.id);
  const tid = nu.toISOString();
  const markera = db.query('UPDATE incidenter SET rapporterad = ? WHERE id = ? AND rapporterad IS NULL');
  for (const id of nyRapporterade) markera.run(tid, id);
  const efter = rader.map(r => (nyRapporterade.includes(r.id) ? { ...r, rapporterad: tid } : r));
  const handelser = db.query('SELECT typ, COUNT(*) AS antal FROM sakerhetslogg WHERE tid >= ? AND tid < ? GROUP BY typ ORDER BY typ').all(g0, g1)
    .map(x => ({ typ: x.typ, typText: sakerhet.TYPER[x.typ] ?? x.typ, antal: x.antal }));
  const kedja = sakerhet.verifiera(db);
  const ut = {
    typ: 'Incidentrapport till beställaren', skapad: tid, period: { fran, till }, demodata: true,
    text: 'Incidenterna under perioden med prioritet, tider, rapportering och underlaget till uppföljningen, och säkerhetsloggens händelser räknade per typ. Rapporten har inga patientuppgifter, och systemet lägger inte till några personers namn eller id.',
    incidenter: efter.map((r) => {
      const x = incidentUt(r, nu);
      return { id: x.id, rubrik: x.rubrik, beskrivning: x.beskrivning, kategori: x.kategoriText, prioritet: x.prioritet, prioritetNamn: x.prioritetNamn, skal: x.skal,
        personuppgiftsincident: x.personuppgifter, borjade: x.borjade, avslutad: x.avslutad, atgardstid: x.atgardstid, storreIncident: x.major.intraffade,
        rapporteraSenast: x.rapportering.senast, rapporterad: x.rapportering.rapporterad, rapporteradITid: x.rapportering.iTid,
        uppfoljning: { orsak: x.uppfoljning.orsak, konsekvens: x.uppfoljning.konsekvens, atgard: x.uppfoljning.atgard, forebyggande: x.uppfoljning.forebyggande, mote: x.uppfoljning.mote } };
    }),
    sakerhetslogg: { handelser, kedjanHel: kedja.hel, antalRader: kedja.antal },
  };
  sakerhet.logga(db, { typ: 'incidentrapport', personal_id: personal.id, tid, beskrivning: `Incidentrapporten till beställaren togs ut för ${fran} till ${till} med ${rader.length} ${rader.length === 1 ? 'incident' : 'incidenter'}.` });
  return { fil: `incidentrapport-${fran}-${till}.json`, rapport: ut, nyRapporterade: nyRapporterade.length };
}
