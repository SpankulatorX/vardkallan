// Beredning, etikett, patientnära skanning och doser i flytande form och gasform (runda 9, r1, Sussa 3.5.1.4, 3.5.2.17
// och 3.5.2.18).
//
// Systemet är experten. Ur ordinationen vet systemet om dosen ska beredas: ett läkemedel som späds, eller en basvätska
// som får en tillsats. Den som bereder ser vad som ska göras (lösningen, volymen, hur mycket som dras upp och
// tillsatserna) och skriver bara batchnumret, eller skannar förpackningen, så fyller systemet i batch och utgångsdatum.
// Systemet avgör själv när en annan sjuksköterska eller läkare ska kontrollera beredningen innan den ges (demoregler för
// kaliumklorid och morfin), räknar ut hur länge beredningen håller och stoppar en dos med en förklaring på vanlig
// svenska när kontrollen saknas, förpackningen har gått ut eller beredningen inte längre håller. Varje iordningsställd
// dos får en etikett med streckkod (Code 128, streckkod.js) som bara innehåller dosens kontrollkod.
//
// En oral lösning ordineras i mg, och systemet räknar volymen i ml ur styrkan. Syrgas ordineras i liter per minut med
// utrustning och mål för saturationen, och systemet väljer utrustningen ur flödet och stoppar ett flöde som utrustningen
// inte ger.
//
// Patientnära skanning: en streckkodsläsare skriver som ett tangentbord. Systemet tar emot etikettens och armbandets
// kod och kontrollerar att etiketten hör till en iordningsställd dos för just den här patienten. Ett armband som hör
// till en annan patient stoppas utan att den andra patienten röjs.
//
// Behörighet. Beredning och kontroll kräver handlingen ge_lakemedel med vårdrelation på den egna vårdenheten
// (administrering.kravVardande). Kontrollen görs av en sjuksköterska eller läkare, aldrig av den som beredde.
// Etiketten och armbandet läses med las_lakemedel. Allt loggas på patienten.
import { Fel, iso, idag, giltigtDatum } from './db.js';
import { vardenhetFor, visningsnamn, visningsPnr, Atkomst } from './atkomst.js';
import { SPADNINGSREGLER } from './lakemedelsstod.js';
import { synligaAdministreringar, kravVardande } from './administrering.js';
import { synligaMatvarden } from './journal.js';

export const DEMOREGLER_BEREDNING = 'Vilka beredningar som kontrolleras av en annan person, hur länge en beredning håller och gränserna för syrgas är demoregler, inte en vårdgivares rutin.';
const TIMME = 3600_000;

const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const tal = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const klockText = (t) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' }).replace(':', '.');

// ---- Beredning ---------------------------------------------------------------------------------------------------

// Beredningar som en annan sjuksköterska eller läkare kontrollerar innan dosen ges (demoregler): koncentrerad
// kaliumklorid som tillsats, och morfin som späds från en stamlösning.
export const DUBBELKONTROLL = {
  tillsatser: { 'VK-EGEN-0001': 'Kaliumklorid är ett koncentrat som kan ge allvarlig hjärtpåverkan vid fel mängd.' },
  substanser: { N02AA01: 'Morfin är narkotika och späds från en stamlösning, så ett räknefel ger tio gånger för stark dos.' },
};
// Hur länge en beredning håller efter att den är gjord, i timmar (demoregler). Bensylpenicillin späds strax före.
export const HALLBARHET_TIMMAR = { J01CE01: 4, standard: 24 };

// Ska dosen beredas? Ett läkemedel som späds, och en basvätska bara när den får en tillsats.
export function kravsBeredning(lm, spadning) {
  if (!lm || !spadning) return false;
  const r = SPADNINGSREGLER[lm.atc];
  return !r?.basvatska || (spadning.tillsatser ?? []).length > 0;
}

// Kontrollen som systemet kräver för beredningen, med varför.
export function kontrollFor(lm, spadning) {
  const skal = [];
  for (const t of spadning?.tillsatser ?? []) if (DUBBELKONTROLL.tillsatser[t.lakemedelId]) skal.push(DUBBELKONTROLL.tillsatser[t.lakemedelId]);
  if (DUBBELKONTROLL.substanser[lm?.atc]) skal.push(DUBBELKONTROLL.substanser[lm.atc]);
  return skal.length ? { kravs: true, varfor: `${skal.join(' ')} En annan sjuksköterska eller läkare kontrollerar beredningen innan den ges.` } : { kravs: false, varfor: null };
}

// Det som dosen i listan visar om beredningen: att den ska beredas och om en annan person kontrollerar.
export function beredningsinfo(lm, spadning) {
  if (!kravsBeredning(lm, spadning)) return null;
  const k = kontrollFor(lm, spadning);
  return { kravs: true, dubbelkontroll: k.kravs, varfor: k.varfor, hallbarTimmar: HALLBARHET_TIMMAR[lm.atc] ?? HALLBARHET_TIMMAR.standard };
}

// Förpackningens kod som GS1 (till exempel en Data Matrix-kod på en ampull, skannad som text): (01) GTIN med 14
// siffror, (17) utgångsdatum ÅÅMMDD och (10) batch. Både med parenteser och utan, med gruppseparator.
export function lasForpackningskod(text) {
  if (typeof text !== 'string' || text.length > 80) return null;
  const s = text.trim();
  const ut = {};
  const paren = [...s.matchAll(/\((\d{2})\)([^()]+)/g)];
  const falt = paren.length ? paren.map(m => [m[1], m[2].trim()]) : (() => {
    const r = [];
    let x = s.replace(/^\]d2/, '');
    while (x.length) {
      if (x[0] === '\u001d') { x = x.slice(1); continue; }
      const ai = x.slice(0, 2);
      if (ai === '01') { r.push([ai, x.slice(2, 16)]); x = x.slice(16); } else if (ai === '17') { r.push([ai, x.slice(2, 8)]); x = x.slice(8); } else if (ai === '10') {
        const slut = x.indexOf('\u001d', 2);
        r.push([ai, slut < 0 ? x.slice(2) : x.slice(2, slut)]);
        x = slut < 0 ? '' : x.slice(slut + 1);
      } else return [];
    }
    return r;
  })();
  for (const [ai, v] of falt) {
    if (ai === '01' && /^\d{14}$/.test(v)) ut.gtin = v;
    if (ai === '17' && /^\d{6}$/.test(v)) {
      const dag = v.slice(4) === '00' ? '28' : v.slice(4);
      const d = `20${v.slice(0, 2)}-${v.slice(2, 4)}-${dag}`;
      if (giltigtDatum(d)) ut.utgang = d;
    }
    if (ai === '10' && /^[A-Za-z0-9-]{1,20}$/.test(v)) ut.batch = v;
  }
  return ut.batch || ut.utgang ? ut : null;
}

const BATCH = /^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/;

// Kontrollerar beredningen innan dosen iordningsställs. Ger null när dosen inte bereds, annars det som sparas.
// inp: { batch, utgang, forpackningskod, losning, volymMl }. Lösningen och volymen följer ordinationen: anger den som
// bereder något annat stoppas det med en förklaring.
export function forbered(db, { lm, spadning, nu = Date.now() }, inp) {
  if (!kravsBeredning(lm, spadning)) return null;
  const b = inp && typeof inp === 'object' ? inp : {};
  const kod = b.forpackningskod != null ? lasForpackningskod(String(b.forpackningskod)) : null;
  if (b.forpackningskod != null && !kod) throw new Fel(400, 'Förpackningens kod gick inte att läsa. Skanna igen, eller skriv batchnumret och utgångsdatumet.', 'ogiltig', { falt: ['forpackningskod'] });
  const batch = String(kod?.batch ?? b.batch ?? '').trim().toUpperCase();
  const utgang = kod?.utgang ?? (b.utgang ? String(b.utgang) : null);
  const ord = `${lm.namn} ska beredas innan dosen ges`;
  if (!BATCH.test(batch)) throw new Fel(400, `${ord}. Ange batchnumret från förpackningen, 3 till 20 bokstäver och siffror, eller skanna förpackningen.`, 'ogiltig', { falt: ['batch'] });
  if (utgang != null && !giltigtDatum(utgang)) throw new Fel(400, 'Ange förpackningens utgångsdatum som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['utgang'] });
  if (utgang && utgang < idag()) throw new Fel(400, `Förpackningen gick ut ${utgang}. Ta en ny förpackning och bered dosen med den.`, 'ogiltig', { falt: ['utgang'] });
  if (b.losning != null && spadning.losning && b.losning !== spadning.losning) {
    throw new Fel(400, `Ordinationen säger att ${lm.namn} späds i ${spadning.losning}. Bered med den lösningen, eller be läkaren ändra ordinationen.`, 'ogiltig', { falt: ['losning'] });
  }
  if (b.volymMl != null && Math.abs(Number(b.volymMl) - spadning.totalVolymMl) > 0.5) {
    throw new Fel(400, `Ordinationen ger ${tal(spadning.totalVolymMl)} ml färdig lösning. Bered till den volymen, eller be läkaren ändra ordinationen.`, 'ogiltig', { falt: ['volymMl'] });
  }
  const timmar = HALLBARHET_TIMMAR[lm.atc] ?? HALLBARHET_TIMMAR.standard;
  return { underlag: spadning, batch, utgang, kontroll: kontrollFor(lm, spadning), hallbarTill: new Date(nu + timmar * TIMME).toISOString(), timmar };
}

// Sparar beredningen för den iordningsställda dosen.
export function spara(db, personal, patientId, administreringId, ordinationId, f, tid) {
  if (!f) return;
  db.query(`INSERT INTO beredningar (administrering_id, patient_id, enhet_id, ordination_id, underlag, batch, utgang, hallbar_till, beredd_av, beredd_tid, kontroll_kravs, kontroll_varfor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(administreringId, patientId, personal.enhet_id, ordinationId, JSON.stringify(f.underlag), f.batch, f.utgang, f.hallbarTill,
    personal.id, tid, f.kontroll.kravs ? 1 : 0, f.kontroll.varfor);
}

const beredningRad = (db, administreringId) => db.query('SELECT * FROM beredningar WHERE administrering_id = ?').get(administreringId);

export function beredningUt(db, b) {
  if (!b) return null;
  const u = JSON.parse(b.underlag);
  return {
    id: b.id, batch: b.batch, utgang: b.utgang, hallbarTill: b.hallbar_till, text: u.text, losning: u.losning, totalVolymMl: u.totalVolymMl,
    koncentrationMgMl: u.koncentrationMgMl, hastighetMlH: u.hastighetMlH, tillsatser: (u.tillsatser ?? []).map(t => ({ namn: t.namn, mangd: t.mangd, enhet: t.enhet })),
    bereddAv: { id: b.beredd_av, namn: personNamn(db, b.beredd_av) }, bereddTid: b.beredd_tid,
    kontroll: { kravs: Boolean(b.kontroll_kravs), varfor: b.kontroll_varfor, av: b.kontrollerad_av ? { id: b.kontrollerad_av, namn: personNamn(db, b.kontrollerad_av) } : null, tid: b.kontrollerad_tid },
  };
}
export const forAdministrering = (db, administreringId) => beredningUt(db, beredningRad(db, administreringId));

// Innan en dos ges. Ett iordningsställande med beredning ges bara när kontrollen är gjord och beredningen håller. En dos
// som ska beredas ges inte utan iordningsställande, utom när den registreras i efterhand.
export function provaGe(db, { lm, spadning, ior, efterhand, nu = Date.now() }) {
  if (ior) {
    const b = beredningRad(db, ior.id);
    if (!b) {
      if (kravsBeredning(lm, spadning)) throw new Fel(400, `${lm.namn} är iordningsställd utan beredning. Makulera iordningsställandet och bered dosen igen.`, 'ogiltig', { beredning: true });
      return;
    }
    if (b.kontroll_kravs && !b.kontrollerad_tid) {
      throw new Fel(400, `Beredningen av ${lm.namn} väntar på kontroll. ${b.kontroll_varfor} Be en kollega välja Kontrollera beredning.`, 'ogiltig', { beredning: true, kontroll: true });
    }
    if (nu > Date.parse(b.hallbar_till)) {
      throw new Fel(400, `Beredningen gjordes ${klockText(b.beredd_tid)} och höll till ${klockText(b.hallbar_till)}. Makulera iordningsställandet och bered en ny dos.`, 'ogiltig', { beredning: true });
    }
    return;
  }
  if (kravsBeredning(lm, spadning) && !efterhand) {
    throw new Fel(400, `${lm.namn} ska beredas innan den ges. Välj Iordningsställ, så visar systemet vad som ska göras och skriver ut etiketten.`, 'ogiltig', { beredning: true });
  }
}

// Kontrollen av en beredning, av en annan sjuksköterska eller läkare med vårdrelation på samma vårdenhet. Den som
// kontrollerar kan skriva batchnumret den läser på förpackningen, och då ska det stämma.
export function kontrollera(atk, beredningId, inp = {}) {
  const db = atk.db;
  const b = db.query('SELECT * FROM beredningar WHERE id = ? AND patient_id = ?').get(Number(beredningId), atk.patientId);
  // En beredning till en dos som användaren inte får se behandlas som om den inte finns.
  if (!b || !synligaAdministreringar(atk).some(a => a.id === b.administrering_id)) throw new Fel(404, 'Beredningen finns inte.', 'saknas');
  kravVardande(atk, 'ge_lakemedel', { enhet_id: b.enhet_id }, `beredning:${b.id}:kontroll`);
  if (!['sjukskoterska', 'lakare'].includes(atk.personal.yrke)) {
    atk.logga('ge_lakemedel', 'nekad', `beredning:${b.id}:kontroll`, 'nekad');
    throw new Fel(403, 'En beredning kontrolleras av en sjuksköterska eller läkare.', 'nekad');
  }
  if (vardenhetFor(db, b.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) {
    atk.logga('ge_lakemedel', 'nekad', `beredning:${b.id}:kontroll`, 'nekad');
    throw new Fel(403, 'En beredning kontrolleras på den vårdenhet där den gjordes.', 'nekad');
  }
  if (!b.kontroll_kravs) throw new Fel(400, 'Den här beredningen behöver ingen kontroll av en annan person.', 'ogiltig');
  if (b.kontrollerad_tid) throw new Fel(400, `Beredningen är redan kontrollerad av ${personNamn(db, b.kontrollerad_av)}.`, 'ogiltig');
  if (b.beredd_av === atk.personal.id) throw new Fel(400, 'Du beredde dosen själv. En annan sjuksköterska eller läkare kontrollerar beredningen.', 'ogiltig');
  if (inp.batch != null && String(inp.batch).trim().toUpperCase() !== b.batch) {
    throw new Fel(400, 'Batchnumret på förpackningen stämmer inte med beredningen. Ge inte dosen. Makulera iordningsställandet och bered en ny dos.', 'ogiltig', { falt: ['batch'] });
  }
  db.query('UPDATE beredningar SET kontrollerad_av = ?, kontrollerad_tid = ? WHERE id = ?').run(atk.personal.id, iso(), b.id);
  atk.logga('ge_lakemedel', atk.grund(), `beredning:${b.id}:kontroll`);
  return { beredning: beredningUt(db, db.query('SELECT * FROM beredningar WHERE id = ?').get(b.id)) };
}

// Beredningar på den egna vårdenheten som väntar på kontroll av den inloggade, för inkorgen: bara antal, utan
// patientuppgifter, och aldrig den inloggades egna.
export function vantarPaKontroll(db, personal) {
  if (!['sjukskoterska', 'lakare'].includes(personal?.yrke)) return 0;
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT enhet_id, beredd_av FROM beredningar WHERE kontroll_kravs = 1 AND kontrollerad_tid IS NULL AND hallbar_till > ?').all(iso())
    .filter(b => b.beredd_av !== personal.id && vardenhetFor(db, b.enhet_id) === ve).length;
}

// ---- Flytande form och gasform ------------------------------------------------------------------------------------

const FLYTANDE = /oral lösning|oral suspension|mixtur|orala droppar|lösning för oral/i;
const mgMl = (lm) => { const m = /^([\d,]+)\s*mg\/ml$/.exec(lm?.styrka ?? ''); return m ? Number(m[1].replace(',', '.')) : null; };
export const arGas = (lm) => /medicinsk gas/i.test(lm?.form ?? '');

// En dos i flytande form: volymen i ml ur dosen och styrkan, med hur den mäts upp.
export function flytande(lm, dos, dosEnhet) {
  if (!FLYTANDE.test(lm?.form ?? '') || dos == null) return null;
  const k = mgMl(lm);
  const mg = dosEnhet === 'mg' ? dos : dosEnhet === 'g' ? dos * 1000 : dosEnhet === 'ml' && k ? dos * k : null;
  const ml = dosEnhet === 'ml' ? dos : k && mg != null ? mg / k : null;
  if (ml == null) return null;
  const volymMl = Math.round(ml * 100) / 100;
  const forLiten = volymMl < 0.1;
  return {
    volymMl, mg, styrka: lm.styrka, spruta: volymMl <= 1 ? 'oral spruta 1 ml' : volymMl <= 5 ? 'oral spruta 5 ml' : volymMl <= 10 ? 'oral spruta 10 ml' : 'medicinbägare',
    text: forLiten ? `Dosen blir ${tal(volymMl)} ml, mindre än vad som går att mäta upp säkert. Be läkaren ordinera en annan styrka.`
      : `Mät upp ${tal(volymMl)} ml${mg != null ? ` (${tal(mg)} mg)` : ''} med ${volymMl <= 10 ? `en ${volymMl <= 1 ? 'oral spruta på 1 ml' : volymMl <= 5 ? 'oral spruta på 5 ml' : 'oral spruta på 10 ml'}` : 'en medicinbägare'}. En oral lösning dras aldrig upp i en spruta för injektion.`,
    forLiten,
  };
}

// Utrustningen för syrgas och vilket flöde den ger, i liter per minut (demoregler).
export const UTRUSTNING = {
  grimma: { namn: 'grimma', min: 0.5, max: 4 },
  mask: { namn: 'syrgasmask', min: 5, max: 10 },
  reservoarmask: { namn: 'mask med reservoarpåse', min: 10, max: 15 },
};
export const MAL_STANDARD = { min: 92, max: 96 };
const utrustningFor = (flode) => (flode <= 4 ? 'grimma' : flode <= 10 ? 'mask' : 'reservoarmask');
const flodeText = (x) => `${tal(x)} liter per minut`;
const passar = (u, flode) => flode >= UTRUSTNING[u].min && flode <= UTRUSTNING[u].max;
const utrustningSkal = (u, flode) => `${UTRUSTNING[u].namn[0].toUpperCase()}${UTRUSTNING[u].namn.slice(1)} ger ${tal(UTRUSTNING[u].min)} till ${tal(UTRUSTNING[u].max)} liter per minut, och ${flodeText(flode)} passar ${UTRUSTNING[utrustningFor(flode)].namn}.`;

export function gasText(g, flode) {
  return `Syrgas ${flodeText(flode)} via ${UTRUSTNING[g.utrustning].namn}. Mål för saturationen ${g.malMin} till ${g.malMax} procent.`;
}

// Kontroll av en ordination av gas: flödet i liter per minut, utrustningen och målet. Systemet väljer utrustningen ur
// flödet när den inte anges. Ger { gas, kropp } eller kastar Fel.
export function forberedGas(lm, kropp, inp = {}) {
  if (!arGas(lm)) {
    if (inp.gas != null) throw new Fel(400, `${lm.namn} är ingen gas. Ta bort utrustningen och målet för saturationen.`, 'ogiltig', { falt: ['gas'] });
    return null;
  }
  const flode = Number(kropp.dos);
  if (!Number.isFinite(flode) || flode < 0.5 || flode > 15) throw new Fel(400, 'Ange flödet för syrgasen, från 0,5 till 15 liter per minut.', 'ogiltig', { falt: ['dos'] });
  const g = inp.gas && typeof inp.gas === 'object' ? inp.gas : {};
  const utrustning = g.utrustning == null || g.utrustning === '' ? utrustningFor(flode) : String(g.utrustning);
  if (!Object.hasOwn(UTRUSTNING, utrustning)) throw new Fel(400, 'Välj grimma, syrgasmask eller mask med reservoarpåse.', 'ogiltig', { falt: ['gas'] });
  if (!passar(utrustning, flode)) throw new Fel(400, `${utrustningSkal(utrustning, flode)} Ändra flödet eller utrustningen.`, 'ogiltig', { falt: ['gas'] });
  const malMin = g.malMin == null || g.malMin === '' ? MAL_STANDARD.min : Number(g.malMin);
  const malMax = g.malMax == null || g.malMax === '' ? MAL_STANDARD.max : Number(g.malMax);
  if (![malMin, malMax].every(Number.isInteger) || malMin < 80 || malMax > 100 || malMin >= malMax) throw new Fel(400, 'Ange målet för saturationen i hela procent, till exempel 92 till 96.', 'ogiltig', { falt: ['gas'] });
  const gas = { utrustning, malMin, malMax };
  return { gas, kropp: { dosEnhet: 'l/min', dosering: !kropp.dosering?.trim() || /^Syrgas [\d,]+ liter per minut via /.test(kropp.dosering) ? gasText(gas, flode) : kropp.dosering } };
}

// Förslaget i ordinationsformuläret: 2 liter per minut via grimma och standardmålet, med utrustningarna att välja.
export function gasForslag() {
  const gas = { utrustning: 'grimma', malMin: MAL_STANDARD.min, malMax: MAL_STANDARD.max };
  return {
    gas: { ...gas, utrustningar: Object.entries(UTRUSTNING).map(([id, u]) => ({ id, namn: u.namn, min: u.min, max: u.max })),
      text: 'Syrgas ordineras i liter per minut. Systemet väljer utrustningen ur flödet om du inte väljer själv, och kontrollerar att utrustningen ger flödet.' },
    dos: 2, dosEnhet: 'l/min', dosering: gasText(gas, 2), tider: [], typ: 'staende',
  };
}

export function sparaGas(db, ordinationId, gas) {
  if (gas) db.query('INSERT INTO ordination_gas (ordination_id, utrustning, mal_min, mal_max) VALUES (?, ?, ?, ?)').run(ordinationId, gas.utrustning, gas.malMin, gas.malMax);
}
export function gasFor(db, ordinationId) {
  const g = db.query('SELECT * FROM ordination_gas WHERE ordination_id = ?').get(ordinationId);
  return g ? { utrustning: g.utrustning, utrustningText: UTRUSTNING[g.utrustning]?.namn ?? g.utrustning, malMin: g.mal_min, malMax: g.mal_max } : null;
}

// Dosens form, för listan, etiketten och iordningsställandet.
export function dosform(db, o, lm) {
  const g = arGas(lm) ? gasFor(db, o.id) : null;
  if (g) return { gas: { ...g, flode: o.dos, text: gasText(g, o.dos) } };
  const f = flytande(lm, o.dos, o.dos_enhet ?? o.dosEnhet);
  return f ? { flytande: f } : {};
}

// Kontrollerna för en dos i flytande form eller gasform när den ges. Ger varningar, eller kastar Fel för ett flöde som
// utrustningen inte ger. volymMl är den uppmätta volymen när sjuksköterskan anger den.
export function dosvarningar(atk, { orad, lm, dos, volymMl }) {
  const ut = [];
  if (!orad || !lm) return ut;
  const db = atk.db;
  if (arGas(lm)) {
    const g = gasFor(db, orad.id);
    const flode = dos ?? orad.dos;
    if (g && flode != null && !passar(g.utrustning, flode)) throw new Fel(400, `${utrustningSkal(g.utrustning, flode)} Ordinationen är ${flodeText(orad.dos)} via ${UTRUSTNING[g.utrustning].namn}. Fråga läkaren innan flödet ändras.`, 'ogiltig', { falt: ['dos'] });
    // Den senaste saturationen, bara bland de mätvärden som användaren får se.
    if (g) {
      const m = new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
      const sat = m.prova('las_matvarden').tillaten ? synligaMatvarden(m).find(x => x.typ === 'saturation' && Number.isFinite(Number(x.varde_num ?? x.varde))) : null;
      const v = sat ? Number(sat.varde_num ?? sat.varde) : null;
      if (v != null && v > g.malMax) ut.push({ niva: 'observation', regel: 'saturation_over_mal', text: `Senaste saturationen är ${v} procent, över målet ${g.malMin} till ${g.malMax}. Fråga läkaren om flödet kan sänkas.` });
      if (v != null && v < g.malMin) ut.push({ niva: 'observation', regel: 'saturation_under_mal', text: `Senaste saturationen är ${v} procent, under målet ${g.malMin} till ${g.malMax}. Kontakta läkaren om flödet behöver höjas.` });
    }
    return ut;
  }
  const f = flytande(lm, dos ?? orad.dos, orad.dos_enhet);
  if (f && volymMl != null && Number.isFinite(Number(volymMl)) && Math.abs(Number(volymMl) - f.volymMl) > Math.max(0.05, f.volymMl * 0.05)) {
    ut.push({ niva: 'varning', regel: 'avvikande_volym', kraverKvittens: true, text: `Uppmätt volym är ${tal(Number(volymMl))} ml, men dosen ${tal(f.mg ?? f.volymMl)} ${f.mg != null ? 'mg' : 'ml'} är ${tal(f.volymMl)} ml av ${lm.namn} ${lm.styrka}. Kontrollera innan dosen ges.` });
  }
  if (f?.forLiten) ut.push({ niva: 'allvarlig', regel: 'for_liten_volym', text: f.text });
  return ut;
}

// ---- Etikett och patientnära skanning -----------------------------------------------------------------------------

// Armbandets kod: patientens journalnummer i Vårdkällan, aldrig personnumret.
export const armbandskod = (patientId) => `VKA-${String(patientId).toUpperCase()}`;

// Armbandet för patienten, med namn och personnummer bara som i resten av journalen.
export function armband(atk) {
  atk.krav('las_lakemedel');
  const p = atk.db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const visad = Boolean(atk.val?.visa_identitet);
  atk.logga('las_lakemedel', atk.grund(), 'armband');
  return { kod: armbandskod(atk.patientId), patient: { namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad) }, skyddad: Boolean(p.skyddad && !visad) };
}

// Etiketten för en iordningsställd dos: patienten, läkemedlet, dosen, dostiden, beredningen och kontrollkoden som
// streckkod. Personnummer och namn för en patient med skyddad identitet bara när identiteten är vald att visas.
export function etikett(atk, administreringId) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const a = synligaAdministreringar(atk).find(x => x.id === Number(administreringId));
  if (!a || !a.kontrollkod) throw new Fel(404, 'Etiketten finns inte.', 'saknas');
  const lm = katalog(db, a.lakemedel_id);
  const o = a.ordination_id ? db.query('SELECT * FROM ordinationer WHERE id = ?').get(a.ordination_id) : null;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(a.patient_id);
  const visad = Boolean(atk.val?.visa_identitet);
  const b = forAdministrering(db, a.id);
  const form = o ? dosform(db, o, lm) : {};
  atk.logga('las_lakemedel', atk.grund(), `etikett:administrering:${a.id}`);
  return {
    kontrollkod: a.kontrollkod, administreringId: a.id, patient: { namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad), armband: armbandskod(a.patient_id) },
    skyddad: Boolean(p.skyddad && !visad), lakemedel: { namn: lm.namn, styrka: lm.styrka, form: lm.form }, dos: a.dos, dosEnhet: a.dos_enhet, planerad: a.planerad,
    dosering: o?.dosering ?? null, iordningstalld: { tid: a.iordningstalld_tid, av: personNamn(db, a.iordningstalld_av) }, beredning: b, ...form,
  };
}

// Raderna på etiketten, för utskriften.
export function etikettRader(e) {
  const r = [{ text: e.patient.namn, fet: true, storlek: 8 }, { text: e.patient.personnummer, storlek: 7 },
    { text: `${e.lakemedel.namn} ${e.lakemedel.styrka ?? ''}`.slice(0, 60), fet: true },
    { text: `${e.dos != null ? `${tal(e.dos)} ${e.dosEnhet ?? ''}` : ''}${e.planerad ? `, ges ${klockText(e.planerad)}` : ''}`.slice(0, 60) }];
  if (e.beredning) {
    r.push({ text: `${e.beredning.losning ? `${e.beredning.losning}, ` : ''}${tal(e.beredning.totalVolymMl)} ml${e.beredning.koncentrationMgMl != null ? `, ${tal(e.beredning.koncentrationMgMl)} mg/ml` : ''}`.slice(0, 60) });
    for (const t of e.beredning.tillsatser) r.push({ text: `Tillsats ${tal(t.mangd)} ${t.enhet ?? ''} ${t.namn}`.slice(0, 60) });
    r.push({ text: `Batch ${e.beredning.batch}. Håller till ${klockText(e.beredning.hallbarTill)}`.slice(0, 60) });
    r.push({ text: `Beredd ${klockText(e.beredning.bereddTid)} av ${e.beredning.bereddAv.namn}`.slice(0, 60) });
    if (e.beredning.kontroll.kravs) r.push({ text: e.beredning.kontroll.av ? `Kontrollerad av ${e.beredning.kontroll.av.namn}` : 'Kontroll av en annan person krävs' });
  } else if (e.flytande) r.push({ text: `${tal(e.flytande.volymMl)} ml, ${e.flytande.spruta}`.slice(0, 60) });
  else if (e.gas) r.push({ text: `${tal(e.gas.flode)} l/min via ${e.gas.utrustningText}`.slice(0, 60) });
  r.push({ text: `Iordningsställd ${klockText(e.iordningstalld.tid)} av ${e.iordningstalld.av}`.slice(0, 60) });
  return r;
}

// Skanningen före en dos: etiketten och armbandet. Ger dosen som etiketten hör till, eller kastar Fel med en
// förklaring. Ett armband som hör till en annan patient röjer aldrig vem.
export function skanna(atk, inp = {}) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  const etik = typeof inp.etikett === 'string' ? inp.etikett.trim() : '';
  const arm = typeof inp.armband === 'string' ? inp.armband.trim().toUpperCase() : '';
  if (!etik || !arm) throw new Fel(400, 'Skanna både etiketten på dosen och patientens armband.', 'ogiltig', { falt: [!etik ? 'etikett' : 'armband'] });
  if (arm !== armbandskod(atk.patientId)) {
    atk.logga('las_lakemedel', atk.grund(), 'skanning:fel_armband');
    throw new Fel(400, 'Armbandet hör inte till den här patienten. Ge inte dosen. Kontrollera att du står vid rätt patient.', 'ogiltig', { falt: ['armband'], skanning: 'armband' });
  }
  const a = synligaAdministreringar(atk).find(x => x.kontrollkod === etik && x.status === 'iordningstalld');
  if (!a) {
    atk.logga('las_lakemedel', atk.grund(), 'skanning:fel_etikett');
    throw new Fel(400, 'Etiketten hör inte till en iordningsställd dos för den här patienten. Ge inte dosen. Kontrollera läkemedlet och patienten.', 'ogiltig', { falt: ['etikett'], skanning: 'etikett' });
  }
  const lm = katalog(db, a.lakemedel_id);
  atk.logga('las_lakemedel', atk.grund(), `skanning:administrering:${a.id}`);
  return {
    ok: true, administreringId: a.id, ordinationId: a.ordination_id, planerad: a.planerad, kontrollkod: a.kontrollkod, armband: arm,
    lakemedel: { namn: lm.namn, styrka: lm.styrka }, dos: a.dos, dosEnhet: a.dos_enhet, beredning: forAdministrering(db, a.id),
    text: `Etiketten och armbandet stämmer: ${lm.namn} ${lm.styrka ?? ''}${a.planerad ? `, dosen ${klockText(a.planerad)}` : ''}.`,
  };
}

// Armbandet som skickas med en dos som ges efter skanning prövas på nytt i servern.
export function provaArmband(atk, armbandText, kontrollkod) {
  if (armbandText == null) return null;
  const arm = String(armbandText).trim().toUpperCase();
  if (arm !== armbandskod(atk.patientId)) throw new Fel(400, 'Armbandet hör inte till den här patienten. Ge inte dosen. Kontrollera att du står vid rätt patient.', 'ogiltig', { falt: ['armband'], skanning: 'armband' });
  if (!kontrollkod) throw new Fel(400, 'Skanna etiketten på dosen tillsammans med armbandet.', 'ogiltig', { falt: ['kontrollkod'] });
  return arm;
}
export function sparaSkanning(db, personal, patientId, administreringId, etikettKod, arm) {
  if (!arm) return;
  db.query('INSERT OR IGNORE INTO administrering_skanning (administrering_id, patient_id, enhet_id, etikett, armband, tid, av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(administreringId, patientId, personal.enhet_id, etikettKod, arm, iso(), personal.id);
}
export function skanningFor(db, administreringId) {
  const s = db.query('SELECT * FROM administrering_skanning WHERE administrering_id = ?').get(administreringId);
  return s ? { tid: s.tid, av: personNamn(db, s.av), etikett: s.etikett, armband: true } : null;
}

