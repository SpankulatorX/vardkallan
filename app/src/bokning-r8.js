// Bokning, del 3 (runda 8, r3, Sussa 3.4.1 och 3.4.2 och testfall 5.1 till 5.3): fri bokning, teambesök och gruppträffar.
//
// Systemet är experten. Den som bokar behöver inte leta i någon kalender:
//   - Fri bokning: en patient som inte står på väntelistan och inte har någon remiss bokas med systemets förslag. Systemet
//     väljer besökstyp (återbesök om patienten har varit på vårdenheten förut, annars nybesök), vårdgivare (den patienten
//     har träffat förut) och de lämpligaste tiderna. Bokningen skapar vårdkontakten och kallelsen som all annan bokning.
//   - Teambesök: systemet föreslår teamet (patientens läkare och sjuksköterska) och hittar tider där alla i teamet och ett
//     rum är lediga hela tiden. Teamets vårdgivare blir upptagna i sina scheman.
//   - Gruppträff: platser kvar räknas av systemet. När träffen är full hamnar patienten på gruppens väntelista, och när en
//     plats blir ledig föreslår systemet den som har väntat längst. Kallelserna skrivs när platsen bokas och går ut när
//     vårdadministratören skickar dem för hela gruppen (tidbok.js, kallaGrupp).
//
// Behörighet. Allt kräver handlingen boka i behörighetsmotorn och vårdrelation eller remiss till vårdenheten, som all
// annan bokning, och bara den egna vårdenhetens tidbok används. Varje åtgärd loggas på patienten.
import { Fel, iso, datumAv, lokalTid, addDagar } from './db.js';
import { vardenhetFor, enheterUnder, visningsnamn, visningsPnr, harVardrelation } from './atkomst.js';
import { gerVardrelation } from './vardkontakt.js';
import { synka as synkaVardhandelser } from './vardhandelse.js';
import * as tidbok from './tidbok.js';
import * as plan from './planering-bas.js';

const MIN = 60_000;
const TZ = 'Europe/Stockholm';
// Tidstyper som går att boka fritt. Gruppträffar och teambesök har egna flöden, och ingrepp och provtagning bokas från
// väntelistan med det de kräver.
export const FRIA_TIDSTYPER = ['nybesok', 'aterbesok', 'telefon', 'video'];
// Demoregler för teambesök: arbetsdagen och hur långt fram systemet letar.
export const TEAMREGLER = { dagStart: '08:00', dagSlut: '16:00', steg: 15, dagar: 30, minDeltagare: 2, maxDeltagare: 4,
  text: 'Demoregler: ett teambesök tar 60 minuter och läggs mellan klockan 8 och 16 på en dag då alla i teamet arbetar på mottagningen. Systemet letar 30 dagar framåt.' };

const personRad = (db, id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
const personKort = (db, id) => { const p = id && personRad(db, id); return p ? { id: p.id, namn: p.namn, titel: p.titel, yrke: p.yrke } : null; };
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const patientRad = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const patientKort = (p, visa = false) => ({ id: p.id, namn: visningsnamn(p, visa), personnummer: visningsPnr(p, visa), skyddad: Boolean(p.skyddad) });
const klock = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', '.');
const minVe = (atk) => vardenhetFor(atk.db, atk.personal.enhet_id);
const aktivStatus = "('bokad', 'incheckad')";

// Vårdgivarna med schema på vårdenheten, läkare först.
export function vardgivare(db, ve) {
  const enheter = enheterUnder(db, ve);
  const rader = db.query(`SELECT s.* FROM scheman s JOIN personal p ON p.id = s.personal_id WHERE s.enhet_id IN (${enheter.map(() => '?').join(', ')}) AND coalesce(p.aktiv, 1) = 1 ORDER BY s.yrkesroll, s.id`).all(...enheter);
  const ut = new Map();
  for (const s of rader) if (!ut.has(s.personal_id)) ut.set(s.personal_id, { ...personKort(db, s.personal_id), yrkesroll: s.yrkesroll, yrkesrollText: tidbok.YRKESROLL[s.yrkesroll], schemaId: s.id, mottagning: enhetKort(db, s.enhet_id) });
  return [...ut.values()];
}

// Har patienten varit på vårdenheten förut? Bara den egna vårdenheten räknas, så att inget röjs om andra vårdenheter.
const harVaritHar = (db, patientId, ve) => {
  const enheter = enheterUnder(db, ve);
  return Boolean(db.query(`SELECT 1 FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${enheter.map(() => '?').join(', ')}) AND start < ? LIMIT 1`).get(patientId, ...enheter, iso()));
};
// Bara tider som användaren själv får se påverkar förslagen (som i tidbok.js).
const synligFor = (atk) => (enhetId) => atk.prova('las_admin', { enhet_id: enhetId }).tillaten;

// ---------------------------------------------------------------------------------------------------------------
// Fri bokning (testfall 5.1)

// Systemets val för en fri bokning. tidstyp, yrkesroll och personalId från användaren ersätter systemets val.
export function friForslag(atk, q = {}) {
  atk.krav('boka');
  const db = atk.db;
  const ve = minVe(atk);
  const vg = vardgivare(db, ve);
  const tidigare = tidbok.tidigareVardgivare(db, atk.patientId, ve).find(id => vg.some(v => v.id === id)) ?? null;
  const varit = harVaritHar(db, atk.patientId, ve);
  const skal = [];
  const tidstyp = q.tidstyp ?? (varit ? 'aterbesok' : 'nybesok');
  if (!FRIA_TIDSTYPER.includes(tidstyp)) throw new Fel(400, 'Välj nybesök, återbesök, telefontid eller videobesök.', 'ogiltig', { falt: ['tidstyp'] });
  if (!q.tidstyp) skal.push(varit ? 'Återbesök, eftersom patienten har varit här förut.' : 'Nybesök, eftersom patienten inte har varit här förut.');
  let personalId = q.personalId || null;
  if (personalId && !vg.some(v => v.id === personalId)) throw new Fel(400, 'Vårdgivaren har inget schema på din vårdenhet.', 'ogiltig', { falt: ['personalId'] });
  if (!personalId && !q.yrkesroll && tidigare) { personalId = tidigare; skal.push(`${personRad(db, tidigare).namn}, som patienten har träffat förut.`); }
  const yrkesroll = personalId ? vg.find(v => v.id === personalId).yrkesroll : (q.yrkesroll ?? 'lakare');
  if (!tidbok.YRKESROLL[yrkesroll]) throw new Fel(400, 'Välj läkare, sjuksköterska eller fysioterapeut.', 'ogiltig', { falt: ['yrkesroll'] });
  const behov = { patientId: atk.patientId, ve, tidstyp, yrkesroll, onskad: personalId, prioritet: 'normal', grans: null, synlig: synligFor(atk),
    krav: plan.kravFor(db, { ve, patientId: atk.patientId, fysisk: tidbok.TIDSTYPER[tidstyp].fysisk }) };
  let forslag = tidbok.foreslaTider(db, behov, personalId ? 12 : 3);
  if (personalId) forslag = forslag.filter(f => f.vardgivare?.id === personalId).slice(0, 3);
  atk.logga('boka', atk.grund(), 'bokning:fri:forslag');
  return {
    patient: patientKort(patientRad(db, atk.patientId), atk.val?.visa_identitet), val: { tidstyp, tidstypText: tidbok.TIDSTYPER[tidstyp].text, yrkesroll, personalId }, skal,
    alternativ: { tidstyper: FRIA_TIDSTYPER.map(t => ({ id: t, text: tidbok.TIDSTYPER[t].text })), vardgivare: vg },
    forslag, demoregler: tidbok.DEMOREGLER.text,
  };
}

// Kontroller som gäller varje bokning härifrån: tiden på den egna vårdenheten, i framtiden och ledig.
function kravTid(db, tid, ve) {
  if (!tid) throw new Fel(404, 'Tiden finns inte.', 'saknas');
  if (tidbok.tidensVardenhet(db, tid) !== ve) throw new Fel(400, 'Tiden hör till en annan vårdenhet.', 'ogiltig', { falt: ['tidId'] });
  if (Date.parse(tid.start) < Date.now()) throw new Fel(400, 'Tiden har redan varit.', 'ogiltig', { falt: ['tidId'] });
  if (!tidbok.arLedig(db, tid)) throw new Fel(400, 'Tiden har just bokats av någon annan. Välj ett av de andra förslagen.', 'ogiltig', { falt: ['tidId'] });
}

// Kallelsens utfall på vanlig svenska, för notisen.
const kallelseBesked = (k) => (!k ? null : k.status === 'skickad' ? `Kallelsen är skickad via ${k.kanalText?.toLowerCase() ?? 'Min journal'}.` : k.status === 'vantar' ? 'Kallelsen är skriven och går ut när gruppens kallelser skickas.' : `Kallelsen kunde inte skickas. ${k.forklaring ?? ''}`.trim());

export function bokaFri(atk, body = {}) {
  atk.krav('boka');
  const db = atk.db;
  const ve = minVe(atk);
  const tid = tidbok.tidRad(db, Number(body.tidId));
  kravTid(db, tid, ve);
  if (!FRIA_TIDSTYPER.includes(tid.tidstyp)) throw new Fel(400, 'En gruppträff, ett teambesök, ett ingrepp eller en provtagning bokas på sitt eget sätt. Välj ett av förslagen.', 'ogiltig', { falt: ['tidId'] });
  const krav = plan.kravFor(db, { ve, patientId: atk.patientId, fysisk: tidbok.TIDSTYPER[tid.tidstyp].fysisk });
  const resurser = krav.length ? plan.valjResurser(db, ve, krav, tid.start, tid.slut) : [];
  if (!resurser) throw plan.resursFel();
  const relation = gerVardrelation(db, atk.personal, atk.patientId);
  const b = tidbok.skapaBokning(db, { patientId: atk.patientId, tid, orsak: null, av: atk.personal.id, relation });
  plan.reservera(db, b.id, resurser, tid.start, tid.slut);
  synkaVardhandelser(db, atk.patientId, { av: atk.personal.id });
  const k = tidbok.skickaKallelse(db, b, 'kallelse', { av: atk.personal.id });
  atk.logga('boka', atk.grund(), `bokning:${b.id}:fri`);
  const kallelse = tidbok.kallelseUt(k, tidbok.skydd(db, b.patient_id, atk.val?.visa_identitet));
  return [201, { ...tidbok.bokningUt(db, tidbok.bokningRad(db, b.id), { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), kallelse, kallelseBesked: kallelseBesked(kallelse) }];
}

// ---------------------------------------------------------------------------------------------------------------
// Teambesök (testfall 5.2)

// Är vårdgivaren upptagen under intervallet? En bokad tid i något av vårdgivarens scheman, en gruppträff eller ett
// teambesök. Bara tider och bokningar läses, inget om patienterna.
export function upptagen(db, personalId, start, slut) {
  const t = db.query(`SELECT 1 FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE s.personal_id = ? AND t.start < ? AND t.slut > ?
    AND (t.tidstyp = 'grupp' OR EXISTS (SELECT 1 FROM bokningar b WHERE b.tid_id = t.id AND b.status IN ${aktivStatus})) LIMIT 1`).get(personalId, slut, start);
  if (t) return true;
  return Boolean(db.query(`SELECT 1 FROM teambesok_deltagare d JOIN bokningar b ON b.id = d.bokning_id WHERE d.personal_id = ? AND b.status IN ${aktivStatus} AND d.start < ? AND d.slut > ? LIMIT 1`).get(personalId, slut, start));
}
// Arbetar vårdgivaren på vårdenheten den dagen? Ja om schemat har tider den dagen.
const arbetar = (db, schemaId, datum) => Boolean(db.query('SELECT 1 FROM tider WHERE schema_id = ? AND start >= ? AND start < ? LIMIT 1').get(schemaId, lokalTid(datum, '00:00'), lokalTid(addDagar(datum, 1), '00:00')));
// Krav på rum: ett behandlingsrum om vårdenheten har något, och sjukresa om patienten behöver det.
function teamKrav(db, ve, patientId) {
  const enheter = enheterUnder(db, ve);
  const rum = plan.harTabeller(db) && db.query(`SELECT 1 FROM resurser WHERE kategori = 'behandlingsrum' AND aktiv = 1 AND enhet_id IN (${enheter.map(() => '?').join(', ')}) LIMIT 1`).get(...enheter);
  return [...(rum ? ['behandlingsrum'] : []), ...plan.kravFor(db, { ve, patientId, fysisk: true })];
}

// Systemets förslag på team: den läkare och den sjuksköterska som patienten har träffat förut, annars den första
// läkaren och sjuksköterskan med schema.
function teamForval(db, ve, patientId, vg) {
  const ut = [];
  for (const roll of ['lakare', 'sjukskoterska']) {
    const id = tidbok.tidigareVardgivare(db, patientId, ve, roll).find(x => vg.some(v => v.id === x)) ?? vg.find(v => v.yrkesroll === roll)?.id;
    if (id && !ut.includes(id)) ut.push(id);
  }
  return ut;
}

function kontrolleraTeam(vg, ids) {
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (lista.length < TEAMREGLER.minDeltagare) throw new Fel(400, 'Ett teambesök har minst två vårdgivare. Välj en till.', 'ogiltig', { falt: ['personal'] });
  if (lista.length > TEAMREGLER.maxDeltagare) throw new Fel(400, `Ett teambesök har högst ${TEAMREGLER.maxDeltagare} vårdgivare.`, 'ogiltig', { falt: ['personal'] });
  for (const id of lista) if (!vg.some(v => v.id === id)) throw new Fel(400, 'Vårdgivaren har inget schema på din vårdenhet.', 'ogiltig', { falt: ['personal'] });
  // Läkaren först: teambesöket ligger i den första vårdgivarens schema.
  const rang = (id) => ['lakare', 'sjukskoterska', 'fysioterapeut'].indexOf(vg.find(v => v.id === id).yrkesroll);
  return lista.sort((x, y) => rang(x) - rang(y));
}

// Är tiden möjlig för teamet, patienten och ett rum? Returnerar resurserna, eller null.
function teamLedig(db, { ve, team, start, slut, patientId, upptagnaDagar, krav }) {
  const datum = datumAv(new Date(start));
  if (upptagnaDagar.has(datum)) return null;
  for (const v of team) if (!arbetar(db, v.schemaId, datum) || upptagen(db, v.id, start, slut)) return null;
  const resurser = krav.length ? plan.valjResurser(db, ve, krav, start, slut) : [];
  return resurser ?? null;
}

export function teamForslag(atk, q = {}) {
  atk.krav('boka');
  const db = atk.db;
  const ve = minVe(atk);
  const vg = vardgivare(db, ve);
  const forval = teamForval(db, ve, atk.patientId, vg);
  const ids = q.personal?.length ? kontrolleraTeam(vg, q.personal) : forval.length >= TEAMREGLER.minDeltagare ? kontrolleraTeam(vg, forval) : forval;
  const team = ids.map(id => vg.find(v => v.id === id));
  const min = tidbok.TIDSTYPER.team.min;
  const krav = teamKrav(db, ve, atk.patientId);
  const synlig = synligFor(atk);
  const upptagnaDagar = new Set(db.query(`SELECT t.start, s.enhet_id FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE b.patient_id = ? AND b.status IN ${aktivStatus}`)
    .all(atk.patientId).filter(r => synlig(r.enhet_id)).map(r => datumAv(new Date(r.start))));
  const forslag = [];
  if (team.length >= TEAMREGLER.minDeltagare) {
    // Runda 13, r4: samma regel som för väntelistan, så att ett brev hinner fram (tidbok.tidigastFor).
    const tidigast = Date.parse(tidbok.tidigastFor(db, atk.patientId, 'normal', new Date(Date.now() + 2 * 60 * MIN).toISOString()));
    for (let d = 0; d <= TEAMREGLER.dagar && forslag.length < 3; d++) {
      const datum = addDagar(datumAv(new Date()), d);
      const sista = Date.parse(lokalTid(datum, TEAMREGLER.dagSlut)) - min * MIN;
      for (let t = Date.parse(lokalTid(datum, TEAMREGLER.dagStart)); t <= sista; t += TEAMREGLER.steg * MIN) {
        if (t < tidigast) continue;
        const start = new Date(t).toISOString();
        const slut = new Date(t + min * MIN).toISOString();
        const resurser = teamLedig(db, { ve, team, start, slut, patientId: atk.patientId, upptagnaDagar, krav });
        if (!resurser) continue;
        forslag.push({ start, slut, minuter: min, deltagare: team.map(v => ({ id: v.id, namn: v.namn, yrkesrollText: v.yrkesrollText })), mottagning: team[0].mottagning, resurser: resurser.map(plan.resursKort),
          skal: [forslag.length ? 'Nästa dag då alla är lediga.' : 'Den tidigaste tiden då alla i teamet är lediga hela besöket.', ...(resurser.length ? [`${resurser.map(r => r.namn).join(' och ')} är ledigt.`] : [])] });
        break;
      }
    }
  }
  atk.logga('boka', atk.grund(), 'bokning:team:forslag');
  return {
    patient: patientKort(patientRad(db, atk.patientId), atk.val?.visa_identitet), forval, valda: ids, vardgivare: vg, minuter: min, forslag,
    skal: q.personal?.length ? [] : ['Systemet har valt patientens läkare och sjuksköterska. Ändra teamet om det behövs.'], demoregler: TEAMREGLER.text,
  };
}

export function bokaTeam(atk, body = {}) {
  atk.krav('boka');
  const db = atk.db;
  const ve = minVe(atk);
  const vg = vardgivare(db, ve);
  const ids = kontrolleraTeam(vg, body.personal);
  const team = ids.map(id => vg.find(v => v.id === id));
  const t = Date.parse(body.start ?? '');
  if (!Number.isFinite(t)) throw new Fel(400, 'Välj en av tiderna som systemet föreslår.', 'ogiltig', { falt: ['start'] });
  if (t < Date.now()) throw new Fel(400, 'Tiden har redan varit.', 'ogiltig', { falt: ['start'] });
  const start = new Date(t).toISOString();
  const slut = new Date(t + tidbok.TIDSTYPER.team.min * MIN).toISOString();
  const krav = teamKrav(db, ve, atk.patientId);
  const resurser = teamLedig(db, { ve, team, start, slut, patientId: atk.patientId, upptagnaDagar: new Set(), krav });
  if (!resurser) throw new Fel(400, 'Någon i teamet eller rummet har just blivit upptagen den tiden. Välj ett av de andra förslagen.', 'ogiltig', { falt: ['start'] });
  const huvud = team[0];
  const tidId = Number(db.query("INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES (?, ?, ?, 'team', 1, 'Teambesök', 0)").run(huvud.schemaId, start, slut).lastInsertRowid);
  const tid = tidbok.tidRad(db, tidId);
  const relation = gerVardrelation(db, atk.personal, atk.patientId);
  const b = tidbok.skapaBokning(db, { patientId: atk.patientId, tid, orsak: 'Teambesök', av: atk.personal.id, relation });
  for (const v of team) db.query('INSERT INTO teambesok_deltagare (bokning_id, enhet_id, personal_id, start, slut) VALUES (?, ?, ?, ?, ?)').run(b.id, ve, v.id, start, slut);
  plan.reservera(db, b.id, resurser, start, slut);
  synkaVardhandelser(db, atk.patientId, { av: atk.personal.id });
  const k = tidbok.skickaKallelse(db, b, 'kallelse', { av: atk.personal.id });
  atk.logga('boka', atk.grund(), `bokning:${b.id}:team`);
  const kallelse = tidbok.kallelseUt(k, tidbok.skydd(db, b.patient_id, atk.val?.visa_identitet));
  return [201, { ...tidbok.bokningUt(db, tidbok.bokningRad(db, b.id), { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), deltagare: team.map(v => ({ id: v.id, namn: v.namn, yrkesrollText: v.yrkesrollText })), kallelse, kallelseBesked: kallelseBesked(kallelse) }];
}

// Vårdgivarna i ett teambesök, för tidboken och resursens planering.
export const teamDeltagare = (db, bokningId) => db.query('SELECT personal_id FROM teambesok_deltagare WHERE bokning_id = ? ORDER BY id').all(bokningId).map(r => personKort(db, r.personal_id));

// ---------------------------------------------------------------------------------------------------------------
// Gruppträffar (testfall 5.3)

const aktiva = (db, tidId) => db.query(`SELECT * FROM bokningar WHERE tid_id = ? AND status IN ${aktivStatus} ORDER BY id`).all(tidId);
const vantande = (db, tidId) => db.query("SELECT * FROM gruppvantelista WHERE tid_id = ? AND status = 'vantar' ORDER BY id").all(tidId);

// Gruppträffarna på vårdenheten från i dag och 60 dagar framåt. Deltagare och väntande visas bara för patienter med
// vårdrelation på vårdenheten, som i tidboken. Antalet platser gäller hela träffen.
export function grupper(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const fran = lokalTid(datumAv(new Date()), '00:00');
  const till = lokalTid(addDagar(datumAv(new Date()), 60), '00:00');
  const tider = db.query(`SELECT t.* FROM tider t JOIN scheman s ON s.id = t.schema_id WHERE t.tidstyp = 'grupp' AND s.enhet_id IN (${enheter.map(() => '?').join(', ')}) AND t.start >= ? AND t.start < ? ORDER BY t.start`).all(...enheter, fran, till);
  return tider.map(t => {
    const bokade = aktiva(db, t.id);
    const vant = vantande(db, t.id);
    const med = (pid) => harVardrelation(db, pid, ve);
    const kvar = Math.max(0, t.platser - bokade.length);
    const forst = vant.find(v => med(v.patient_id));
    return {
      tid: tidbok.tidUt(db, t), platser: t.platser, bokade: bokade.length, kvar, full: kvar === 0,
      deltagare: bokade.filter(b => med(b.patient_id)).map(b => ({ bokningId: b.id, ...patientKort(patientRad(db, b.patient_id)) })),
      vantar: vant.filter(v => med(v.patient_id)).map(v => ({ id: v.id, ...patientKort(patientRad(db, v.patient_id)) })),
      // Systemets nästa steg: en ledig plats går till den som har väntat längst.
      forslag: kvar > 0 && forst ? { vantelistaId: forst.id, text: `En plats är ledig. ${visningsnamn(patientRad(db, forst.patient_id))} har väntat längst och kan få den.` } : null,
    };
  });
}

function kravGrupp(atk, tid) {
  if (!tid || tid.tidstyp !== 'grupp') throw new Fel(404, 'Gruppträffen finns inte.', 'saknas');
  tidbok.kravEgenVardenhet(atk, tidbok.schemaRad(atk.db, tid.schema_id).enhet_id, `tid:${tid.id}`);
  if (Date.parse(tid.start) < Date.now()) throw new Fel(400, 'Gruppträffen har redan varit.', 'ogiltig');
}

// Bokar en plats. Har gruppens kallelser redan skickats skickas den nya patientens kallelse direkt, annars skrivs den och
// går ut med de andras.
function bokaPlats(atk, tid) {
  const db = atk.db;
  const relation = gerVardrelation(db, atk.personal, atk.patientId);
  const b = tidbok.skapaBokning(db, { patientId: atk.patientId, tid, orsak: tid.rubrik ?? 'Gruppträff', av: atk.personal.id, relation });
  // Runda 13: utskicket räknas som gjort också när ett brev inte hann fram (kan_inte), och när en skriven kallelse har
  // gått ut eller patienten har fått tiden per telefon (klar), inte bara när en kallelse skickades. Annars väntar den
  // nya patientens kallelse på ett utskick som redan är gjort.
  const skickade = db.query("SELECT 1 FROM kallelser k JOIN bokningar b ON b.id = k.bokning_id WHERE b.tid_id = ? AND k.typ = 'kallelse' AND k.status IN ('skickad', 'kan_inte', 'klar') LIMIT 1").get(tid.id);
  let k;
  if (skickade) k = tidbok.skickaKallelse(db, b, 'kallelse', { av: atk.personal.id });
  else { tidbok.forberedKallelse(db, b); k = db.query("SELECT * FROM kallelser WHERE bokning_id = ? ORDER BY id DESC").get(b.id); }
  synkaVardhandelser(db, atk.patientId, { av: atk.personal.id });
  return { b, kallelse: tidbok.kallelseUt(k, tidbok.skydd(db, b.patient_id, atk.val?.visa_identitet)) };
}

export function laggTillGrupp(atk, tid) {
  atk.krav('boka');
  const db = atk.db;
  kravGrupp(atk, tid);
  const namn = visningsnamn(patientRad(db, atk.patientId), atk.val?.visa_identitet);
  if (aktiva(db, tid.id).some(b => b.patient_id === atk.patientId)) throw new Fel(400, `${namn} har redan en plats på ${tid.rubrik ?? 'gruppträffen'}.`, 'ogiltig');
  if (vantande(db, tid.id).some(v => v.patient_id === atk.patientId)) throw new Fel(400, `${namn} står redan på väntelistan till ${tid.rubrik ?? 'gruppträffen'}.`, 'ogiltig');
  const kvar = tid.platser - aktiva(db, tid.id).length;
  if (kvar <= 0) {
    const ve = minVe(atk);
    const id = Number(db.query('INSERT INTO gruppvantelista (tid_id, patient_id, enhet_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?)').run(tid.id, atk.patientId, ve, iso(), atk.personal.id).lastInsertRowid);
    atk.logga('boka', atk.grund(), `tid:${tid.id}:gruppvantelista:${id}`);
    const plats = vantande(db, tid.id).findIndex(v => v.id === id) + 1;
    return [201, { vantar: true, plats, text: `${tid.rubrik ?? 'Gruppträffen'} är full. ${namn} står på gruppens väntelista som nummer ${plats} och får en plats när någon avbokar.` }];
  }
  const { b, kallelse } = bokaPlats(atk, tid);
  atk.logga('boka', atk.grund(), `bokning:${b.id}:grupp`);
  const kvarNu = tid.platser - aktiva(db, tid.id).length;
  return [201, { bokad: true, bokning: tidbok.bokningUt(db, tidbok.bokningRad(db, b.id), { personal: atk.personal, visaIdentitet: atk.val?.visa_identitet }), kvar: kvarNu, kallelse,
    text: `${namn} har fått en plats på ${tid.rubrik ?? 'gruppträffen'}. ${kvarNu === 1 ? '1 plats kvar' : `${kvarNu} platser kvar`}. ${kallelseBesked(kallelse)}` }];
}

// Ger en ledig plats till en patient på gruppens väntelista.
export function gePlats(atk, rad) {
  atk.krav('boka');
  const db = atk.db;
  const tid = tidbok.tidRad(db, rad.tid_id);
  kravGrupp(atk, tid);
  if (rad.status !== 'vantar') throw new Fel(400, 'Patienten väntar inte längre på en plats.', 'ogiltig');
  if (tid.platser - aktiva(db, tid.id).length <= 0) throw new Fel(400, 'Det finns ingen ledig plats än. Systemet föreslår den som har väntat längst när en plats blir ledig.', 'ogiltig');
  const { b, kallelse } = bokaPlats(atk, tid);
  db.query("UPDATE gruppvantelista SET status = 'bokad', bokning_id = ? WHERE id = ?").run(b.id, rad.id);
  atk.logga('boka', atk.grund(), `bokning:${b.id}:grupp:fran-vantelista:${rad.id}`);
  return [201, { bokad: true, kallelse, text: `${visningsnamn(patientRad(db, atk.patientId), atk.val?.visa_identitet)} har fått platsen på ${tid.rubrik ?? 'gruppträffen'}. ${kallelseBesked(kallelse)}` }];
}
export const gruppvantelistaRad = (db, id) => {
  const r = db.query('SELECT * FROM gruppvantelista WHERE id = ?').get(id);
  if (!r) throw new Fel(404, 'Posten på gruppens väntelista finns inte.', 'saknas');
  return r;
};
export { klock };
