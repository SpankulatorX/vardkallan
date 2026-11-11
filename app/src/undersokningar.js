// Röntgen, ultraljud, klinisk fysiologi och klinisk neurofysiologi i beställning och svar (runda 11, r6, Sussa 4.4.2.2,
// 4.4.2.5 till 4.4.2.8 och 4.4.2.11). Läkaren beställer undersökningar i samma flöde som laboratorieprover, och en
// beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma
// beställnings-id. Röntgenkliniken tar emot, prioriterar och bokar i sin arbetslista, registrerar när undersökningen är
// gjord och lägger studien i multimediaarkivet. Radiologens utlåtande kommer som svar med åtgärden i KVÅ, fyndet i
// Snomed CT och studiens id, och den ansvariga läkaren vidimerar det.
//
// Systemet är experten:
//   - Det kontrollerar före beställningen det som annars kontrolleras för sent: njurfunktionen före jodkontrast (och
//     lägger själv till P-Kreatinin när ett aktuellt värde saknas), graviditet före strålning, implantat före
//     magnetkamera och känd överkänslighet mot kontrastmedel. Det frågar bara det som systemet inte kan veta, och bara
//     när undersökningen kräver det.
//   - Det föreslår prioriteten ur vårdkontakten och ett standardiserat vårdförlopp ur orsaken, sätter senaste dag för
//     undersökningen och föreslår röntgenkliniken den första lediga tiden inom den.
//   - En upprepad beställning blir en serie beställningar med rätt tider, utan att någon räknar datum.
//   - Säkerhetskontrollerna räknar på det beställaren får se och på det som visas efter ett aktivt val. En uppgift som
//     inte kan avgöras stoppar inte i tysthet: saknas ett aktuellt njurfunktionsvärde som beställaren får se beställer
//     systemet ett nytt, och vid magnetkamera och strålning frågar systemet. Röntgenkliniken gör sin egen kontroll vid
//     besöket.
//
// Röntgenkliniken, klinisk fysiologi, klinisk neurofysiologi, radiologens utlåtanden och tiderna är simulerade.
import { Fel, iso, datumAv, addDagar, lokalTid } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, alder, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as labb from './labb.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as vardkontakt from './vardkontakt.js';
import * as uppmarksamhet from './uppmarksamhet.js';
import * as bilder from './bilder.js';
import { OID_ROT } from './identitet.js';
import { pdf } from './filformat.js';
import { ANALYS, LAB, LABORATORIER, DISCIPLINER, PAKETEN, ROR, finns as iKatalog } from './labb-katalog.js';
import { KVA } from './kodverk.js';
import * as versioner from './labb-svarsversioner.js';
import * as underlag from './labb-underlag.js';
import { varde as konfig } from './konfiguration.js';

const tabell = (o) => Object.freeze(Object.assign(Object.create(null), o));
const MIN = 60_000;
const TIMME = 60 * MIN;
const DAG = 24 * TIMME;
export const DEMOREGEL = 'Demoregel, inte röntgenklinikens eller den kliniska fysiologins egna rutiner.';
export const SIMULERAT = 'Röntgenkliniken, klinisk fysiologi och klinisk neurofysiologi är simulerade. Utlåtandena och tiderna räknas fram av demon.';

// Prioriteten och senaste tid för undersökningen räknat från beställningen.
export const PRIORITET = tabell({
  akut: { namn: 'Akut', text: 'inom två timmar', timmar: 2, ordning: 1 },
  svf: { namn: 'Standardiserat vårdförlopp', text: 'inom tre dygn', timmar: 72, ordning: 2 },
  snart: { namn: 'Förtur', text: 'inom två veckor', timmar: 14 * 24, ordning: 3 },
  rutin: { namn: 'Rutin', text: 'inom sex veckor', timmar: 42 * 24, ordning: 4 },
});
// De standardiserade vårdförloppen som en beställning kan höra till, med starten i KVÅ (kodverk.js) och orden i
// vårdkontaktens orsak som systemet föreslår vårdförloppet ur.
export const SVF = tabell({
  lungcancer: { namn: 'Lungcancer', kod: 'VC010', ord: ['lungcancer', 'hemoptys', 'blodig hosta', 'rundhärd'] },
  kolorektal: { namn: 'Tjock- och ändtarmscancer', kod: 'VB210', ord: ['tjocktarmscancer', 'ändtarmscancer', 'blod i avföringen', 'ändrade avföringsvanor'] },
  brost: { namn: 'Bröstcancer', kod: 'VG910', ord: ['bröstcancer', 'knöl i bröstet'] },
  ospecifika: { namn: 'Allvarliga ospecifika symtom', kod: 'VP810', ord: ['ospecifika symtom', 'oklar viktnedgång', 'viktnedgång'] },
});
export const FRAGOR = tabell({ ja: 'Ja', nej: 'Nej', vet_inte: 'Vet inte' });
// Demoreglerna för njurfunktionen före jodkontrast.
export const EGFR = { stopp: 30, varning: 45, dagar: 90, dagarInneliggande: 7 };

export const arUndersokning = (id) => ANALYS[id]?.ror === 'undersokning';
export const labFor = (db, enhetId, id) => (ANALYS[id]?.lab ?? labb.labFor(db, enhetId, ANALYS[id].disciplin).id);
// Enheten som utför undersökningar för laboratoriet: röntgenkliniken. Klinisk fysiologi och neurofysiologi har ingen
// personal i demon och bokar och utför själva (simulerat).
const harArbetslista = (labId) => Boolean(LAB[labId]?.enhet);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS bestallning_tillagg (
  bestallning_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, prioritet TEXT, svf TEXT, graviditet TEXT, implantat TEXT,
  kontroller TEXT NOT NULL DEFAULT '[]', serie_id INTEGER, serie_nr INTEGER, serie_antal INTEGER, intervall_dagar INTEGER
);
CREATE TABLE IF NOT EXISTS undersokning_bokningar (
  analys_rad_id INTEGER PRIMARY KEY, bestallning_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, lab_id TEXT NOT NULL,
  modalitet TEXT, bokad_tid TEXT, bokad_av TEXT, bokad_registrerad TEXT, mr_kontrollerad TEXT, utford_tid TEXT, utford_av TEXT, studie_id INTEGER, studie_uid TEXT
);
`;
const har = new WeakSet();
export function sakra(db) {
  if (har.has(db)) return;
  labb.sakraLabb(db); versioner.sakra(db); underlag.sakra(db); bilder.sakra(db);
  db.exec(SCHEMA);
  har.add(db);
}
const finns = (db) => har.has(db) || Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'undersokning_bokningar'").get() && (har.add(db), true));
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const tal = (v) => String(Math.round(v)).replace('.', ',');
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const tidText = (t) => `${datumAv(new Date(t))} kl. ${klocka(t)}`;
export const tillagg = (db, bestallningId) => (finns(db) ? db.query('SELECT * FROM bestallning_tillagg WHERE bestallning_id = ?').get(bestallningId) ?? null : null);
export const bokning = (db, analysId) => (finns(db) ? db.query('SELECT * FROM undersokning_bokningar WHERE analys_rad_id = ?').get(analysId) ?? null : null);

// ---- Förslag och säkerhetskontroller ------------------------------------------------------------------------------

const inneliggande = (db, pid) => Boolean(db.query('SELECT 1 FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(pid));
export function fragorFor(db, p, ids, nu = new Date()) {
  const defs = ids.map(id => ANALYS[id]).filter(Boolean);
  const fertil = ['kvinna', 'K'].includes(p.kon) && (() => { const a = alder(p.fodd, datumAv(nu)); return a >= 12 && a <= 55; })();
  return { graviditet: fertil && defs.some(d => d.stralning), implantat: defs.some(d => d.magnet) };
}

// Förslaget för undersökningarna i beställningsformuläret: prioriteten, vårdförloppet och frågorna. Räknas bara på det
// beställaren får se: vårdkontakten på den egna vårdenheten.
export function forslag(atk, p, nu = new Date()) {
  const db = atk.db;
  const v = vardkontakt.pagandeFor(db, atk.personal, p.id, nu.getTime());
  const orsak = (v?.orsak ?? '').toLocaleLowerCase('sv');
  const svf = Object.entries(SVF).find(([, s]) => s.ord.some(o => orsak.includes(o)));
  const akut = v?.typ === 'akut' || vardenhetFor(db, atk.personal.enhet_id) === 'uso-akut';
  const prioritet = akut ? 'akut' : svf ? 'svf' : 'rutin';
  const skal = akut ? 'Patienten har en pågående akut vårdkontakt.' : svf ? `Vårdkontaktens orsak passar standardiserat vårdförlopp för ${svf[1].namn.toLocaleLowerCase('sv')}.` : 'Ingen akut vårdkontakt och inget vårdförlopp.';
  const egfr = njurfunktion(atk, nu);
  return {
    prioriteter: Object.entries(PRIORITET).map(([id, x]) => ({ id, namn: x.namn, text: x.text })),
    prioritet, prioritetSkal: skal,
    vardforlopp: Object.entries(SVF).map(([id, x]) => ({ id, namn: x.namn, kod: x.kod, text: KVA[x.kod] })), svf: svf?.[0] ?? null,
    fragorFor: fragorFor(db, p, Object.keys(ANALYS), nu), fragor: Object.entries(FRAGOR).map(([id, text]) => ({ id, text })),
    njurfunktion: egfr.synligt ? { varde: egfr.synligt.varde, tid: egfr.synligt.tid } : null,
    upprepning: { maxAntal: 12, maxDagar: 60, text: 'En upprepad beställning blir en beställning per tillfälle, högst 60 dagar framåt.' },
    simulerat: SIMULERAT, demoregel: DEMOREGEL,
  };
}

// Njurfunktionen: det senaste eGFR som beställaren får se, och om det finns ett nyare som visas efter ett aktivt val. Ett
// värde på en spärrad vårdenhet räknas inte och nämns inte. Ett aktuellt värde är högst 90 dagar gammalt, eller 7 dagar
// för en inneliggande patient (demoregel).
function njurfunktion(atk, nu) {
  const db = atk.db;
  const dagar = inneliggande(db, atk.patientId) ? EGFR.dagarInneliggande : EGFR.dagar;
  const grans = new Date(nu.getTime() - dagar * DAG).toISOString();
  const mAtk = new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
  const alla = db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ = 'egfr' AND tid >= ? AND tid <= ? ORDER BY tid DESC, id DESC").all(atk.patientId, grans, new Date(nu.getTime() + 5 * MIN).toISOString());
  const synliga = kanRoll(atk.personal, 'las_matvarden') ? new Set(journal.synligaMatvarden(mAtk).map(m => m.id)) : new Set();
  const senaste = alla[0];
  const synligt = alla.find(m => synliga.has(m.id));
  const nyareAnnan = senaste && !synliga.has(senaste.id) && mAtk.prova('las_matvarden', { enhet_id: senaste.enhet_id }).krav === 'kraver_val' && (!synligt || senaste.tid > synligt.tid);
  return { synligt: synligt ? { varde: synligt.varde_num, tid: synligt.tid, enhet: enhetsnamn(db, synligt.enhet_id) } : null, nyareAnnan: Boolean(nyareAnnan), dagar };
}

// Kontrollerna för undersökningarna i en beställning. Returnerar { kontroller, laggTill, stopp, kvittens, fraga }.
// niva: stopp (beställningen görs inte), varning (kräver kvittens), info (följer med till röntgen) eller tillagd.
export function kontrollera(atk, p, ids, { graviditet = null, implantat = null } = {}, nu = new Date()) {
  const db = atk.db;
  const defs = ids.filter(arUndersokning).map(id => ANALYS[id]);
  const ut = { kontroller: [], laggTill: [], fraga: null };
  if (!defs.length) return { ...ut, stopp: false, kvittens: false };
  const k = (niva, typ, text) => ut.kontroller.push({ niva, typ, text });
  const namn = (lista) => lista.map(d => d.namn).join(' och ');
  const huvud = kanRoll(atk.personal, 'las_oversikt') ? uppmarksamhet.forHuvud(new Atkomst(db, atk.personal, p.id, atk.val, 'las_oversikt')) : null;
  const poster = huvud?.poster ?? [];
  // Jodkontrast: njurfunktion, överkänslighet och metformin.
  const kontrast = defs.filter(d => d.kontrast);
  if (kontrast.length) {
    const n = njurfunktion(atk, nu);
    if (!n.synligt || n.nyareAnnan) {
      ut.laggTill.push('kreatinin');
      k('tillagd', 'njurfunktion', n.nyareAnnan
        ? `Det senaste värdet för njurfunktionen kommer från en annan vårdenhet och visas inte. Systemet lägger till P-Kreatinin, och röntgen bokar ${namn(kontrast)} när svaret har kommit.`
        : `Det finns inget eGFR från de senaste ${n.dagar} dagarna. Systemet lägger till P-Kreatinin, och röntgen bokar ${namn(kontrast)} när svaret har kommit.`);
    } else if (n.synligt.varde < EGFR.stopp) {
      k('stopp', 'njurfunktion', `eGFR är ${tal(n.synligt.varde)} (${datumAv(new Date(n.synligt.tid))}). Jodkontrast ges inte vid eGFR under ${EGFR.stopp} utan att radiologen har bedömt nyttan. Välj en undersökning utan kontrast, till exempel ultraljud, eller kontakta röntgen.`);
    } else if (n.synligt.varde < EGFR.varning) {
      k('varning', 'njurfunktion', `eGFR är ${tal(n.synligt.varde)} (${datumAv(new Date(n.synligt.tid))}). Patienten behöver extra vätska före och efter kontrasten. Röntgen får uppgiften med beställningen.`);
    } else k('info', 'njurfunktion', `eGFR är ${tal(n.synligt.varde)} (${datumAv(new Date(n.synligt.tid))}), och jodkontrast kan ges.`);
    if (poster.some(x => x.kategori === 'overkanslighet' && /kontrast/i.test(`${x.term ?? ''} ${x.text ?? ''} ${x.beskrivning ?? ''}`))) {
      k('varning', 'overkanslighet', 'Patienten har en registrerad överkänslighet mot kontrastmedel. Röntgen behöver veta det, och radiologen väljer kontrastmedel och förbehandling.');
    }
    if (kanRoll(atk.personal, 'las_lakemedel')) {
      const lm = lakemedel.synligaOrdinationer(new Atkomst(db, atk.personal, p.id, atk.val, 'las_lakemedel')).filter(lakemedel.aktuell)
        .some(o => db.query('SELECT atc FROM katalog WHERE id = ?').get(o.lakemedel_id)?.atc?.startsWith('A10BA02'));
      if (lm && (!n.synligt || n.synligt.varde < EGFR.varning)) k('info', 'metformin', 'Patienten står på metformin. Metformin sätts ut på undersökningsdagen och sätts in igen efter två dygn om njurfunktionen är oförändrad.');
    }
  }
  // Strålning: graviditet hos kvinnor 12 till 55 år. En graviditet som beställaren ser i journalen räknas som ja.
  const fr = fragorFor(db, p, ids, nu);
  const stralning = defs.filter(d => d.stralning);
  if (fr.graviditet) {
    const gAtk = new Atkomst(db, atk.personal, p.id, atk.val, 'las_graviditet');
    let g = Object.hasOwn(FRAGOR, graviditet ?? '') ? graviditet : null;
    let registrerad = false;
    try {
      if (kanRoll(atk.personal, 'las_graviditet') && gAtk.filtrera(db.query("SELECT * FROM graviditeter WHERE patient_id = ? AND status = 'pagaende'").all(p.id), 'las_graviditet').length) { g = 'ja'; registrerad = true; }
    } catch { /* ingen graviditetsjournal i sandlådan */ }
    const buk = stralning.filter(d => d.buk);
    if (!g) ut.fraga = { id: 'graviditet', text: `Kan patienten vara gravid? ${namn(stralning)} ger strålning, och systemet behöver veta det före beställningen.` };
    else if (g === 'ja' && buk.length) k('stopp', 'graviditet', `${registrerad ? 'Patienten har en pågående graviditet i journalen.' : 'Patienten kan vara gravid.'} ${namn(buk)} ger strålning mot buken och görs inte under graviditet utan radiologens bedömning. Välj ultraljud eller magnetkamera, eller kontakta röntgen.`);
    else if (g === 'vet_inte' && buk.length) k('stopp', 'graviditet', `Graviditet behöver uteslutas före ${namn(buk)}, som ger strålning mot buken. Gör ett graviditetstest och beställ sedan.`);
    else if (g !== 'nej') k('varning', 'graviditet', `${registrerad ? 'Patienten har en pågående graviditet i journalen.' : g === 'ja' ? 'Patienten kan vara gravid.' : 'Det är inte känt om patienten är gravid.'} Röntgen skyddar fostret och använder lägsta möjliga stråldos.`);
    else k('info', 'graviditet', 'Patienten är inte gravid enligt beställaren. Röntgen frågar igen vid besöket.');
    ut.graviditet = g;
  }
  // Magnetkamera: implantat. Pacemaker, defibrillator eller annat implantat i uppmärksamhetsinformationen räknas som ja.
  const magnet = defs.filter(d => d.magnet);
  if (magnet.length) {
    const impl = poster.filter(x => x.undergrupp === 'implantat' || /pacemaker|defibrillator|implantat|klaffprotes|clips|coils/i.test(x.term ?? ''));
    let i = Object.hasOwn(FRAGOR, implantat ?? '') ? implantat : null;
    if (impl.length) i = 'ja';
    if (!i) ut.fraga = ut.fraga ?? { id: 'implantat', text: `Har patienten pacemaker, defibrillator eller annat implantat? ${namn(magnet)} görs i magnetkamera.` };
    else if (i === 'nej') k('info', 'implantat', 'Inga implantat enligt beställaren. Röntgen gör MR-säkerhetskontrollen vid besöket.');
    else k('varning', 'implantat', `${impl.length ? `Patienten har ${impl.map(x => x.term.toLocaleLowerCase('sv')).join(' och ')} enligt uppmärksamhetsinformationen.` : i === 'ja' ? 'Patienten har ett implantat enligt beställaren.' : 'Det är inte känt om patienten har implantat.'} ${namn(magnet)} bokas först när röntgen har kontrollerat att implantatet tål magnetkameran.`);
    ut.implantat = i;
  }
  return { ...ut, stopp: ut.kontroller.some(x => x.niva === 'stopp'), kvittens: ut.kontroller.some(x => x.niva === 'varning') };
}

// ---- Beställningen ------------------------------------------------------------------------------------------------

// Analyserna i anropet, som labb.bestall läser dem.
function analysIds(db, body, nu) {
  const lista = Array.isArray(body.analyser) ? body.analyser : body.paket != null && iKatalog(PAKETEN, body.paket) ? labb.paketAnalyser(db, body.paket, nu) : [];
  return lista.map(x => (typeof x === 'string' ? x : x?.analys)).filter(x => typeof x === 'string');
}

// Beställer prover och undersökningar. Utöver labb.bestall: { prioritet, svf, graviditet, implantat,
// kvitteraKontroller, upprepning: { antal, intervallDagar }, underlag: [{ namn, data }] }.
export function bestall(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  // Behörigheten prövas först, som i labb.bestall.
  atk.krav(kanRoll(atk.personal, 'bestalla_prov') ? 'bestalla_prov' : 'bestalla_prov_uppdrag');
  const ids = analysIds(db, body, nu);
  const undersokningar = ids.filter(arUndersokning);
  const prioritet = body.prioritet ?? null;
  if (prioritet != null && !Object.hasOwn(PRIORITET, prioritet)) throw new Fel(400, 'Välj prioritet akut, standardiserat vårdförlopp, förtur eller rutin.', 'ogiltig', { falt: ['prioritet'] });
  const svf = body.svf ?? null;
  if (svf != null && !Object.hasOwn(SVF, svf)) throw new Fel(400, 'Vårdförloppet finns inte.', 'ogiltig', { falt: ['svf'] });
  const upp = body.upprepning ?? null;
  let antal = 1, intervall = 0;
  if (upp != null) {
    antal = upp.antal; intervall = upp.intervallDagar;
    if (!Number.isInteger(antal) || antal < 2 || antal > 12) throw new Fel(400, 'En upprepad beställning har 2 till 12 tillfällen.', 'ogiltig', { falt: ['upprepning'] });
    if (!Number.isInteger(intervall) || intervall < 1 || intervall > 30) throw new Fel(400, 'Tiden mellan tillfällena är 1 till 30 dagar.', 'ogiltig', { falt: ['upprepning'] });
    if ((antal - 1) * intervall > 60) throw new Fel(400, `Det sista tillfället blir om ${(antal - 1) * intervall} dagar. En upprepad beställning sträcker sig högst 60 dagar framåt. Beställ färre tillfällen eller en ny serie senare.`, 'ogiltig', { falt: ['upprepning'] });
  }
  const filer = underlag.provaAlla(db, body.underlag);
  const k = kontrollera(atk, p, ids, { graviditet: body.graviditet, implantat: body.implantat }, nu);
  if (k.fraga) throw new Fel(409, k.fraga.text, 'fraga', { fraga: k.fraga, fragor: Object.entries(FRAGOR).map(([id, text]) => ({ id, text })), kontroller: k.kontroller });
  if (k.stopp) throw new Fel(409, k.kontroller.find(x => x.niva === 'stopp').text, 'kontroll', { kontroller: k.kontroller });
  if (k.kvittens && body.kvitteraKontroller !== true) throw new Fel(409, k.kontroller.filter(x => x.niva === 'varning').map(x => x.text).join(' '), 'kontroll_kvittens', { kontroller: k.kontroller });
  const forslagP = undersokningar.length ? forslag(atk, p, nu).prioritet : null;
  const prio = undersokningar.length ? prioritet ?? (svf ? 'svf' : forslagP) : null;
  // Analyserna med P-Kreatinin när systemet har lagt till det, och i den form labb.bestall tar emot.
  const lista = (Array.isArray(body.analyser) ? body.analyser : ids).map(x => (typeof x === 'string' ? { analys: x } : { analys: x?.analys, planerad: x?.planerad }));
  for (const id of k.laggTill) if (!lista.some(x => x.analys === id)) lista.push({ analys: id });
  const bas = body.planerad != null && body.planerad !== '' && body.planerad !== 'nu' ? Date.parse(body.planerad) : nu.getTime();
  const resultat = [];
  let serie = null;
  for (let i = 0; i < antal; i++) {
    const forskjut = (t) => (i ? new Date((Number.isFinite(t) ? t : bas) + i * intervall * DAG).toISOString() : t);
    const delBody = {
      paket: body.paket, anamnes: body.anamnes, kommentar: body.kommentar, lakareId: body.lakareId, laboratorier: body.laboratorier,
      kvitteraDubbletter: body.kvitteraDubbletter, planerad: i ? new Date(bas + i * intervall * DAG).toISOString() : body.planerad,
      analyser: lista.map(x => ({ analys: x.analys, ...(x.planerad != null ? { planerad: i ? forskjut(Date.parse(x.planerad)) : x.planerad } : {}) })),
      vardkontaktId: body.vardkontaktId,
    };
    if (i) delBody[labb.SERIE] = true;
    const r = labb.bestall(atk, delBody, nu);
    const b = labb.bestallningRad(db, r.bestallning.id);
    serie ??= b.id;
    db.query(`INSERT INTO bestallning_tillagg (bestallning_id, patient_id, enhet_id, prioritet, svf, graviditet, implantat, kontroller, serie_id, serie_nr, serie_antal, intervall_dagar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(b.id, b.patient_id, b.enhet_id, prio, svf, k.graviditet ?? null, k.implantat ?? null, JSON.stringify(k.kontroller),
      antal > 1 ? serie : null, antal > 1 ? i + 1 : null, antal > 1 ? antal : null, antal > 1 ? intervall : null);
    if (!i && filer.length) {
      underlag.spara(db, b, filer, { av: atk.personal.id, nu });
      labb.historikRad(db, b, atk.personal.id, 'Underlag bifogat', filer.map(f => f.namn).join(', '), iso(nu));
    }
    if (k.kontroller.length && !i) labb.historikRad(db, b, null, 'Kontroller före undersökningen', k.kontroller.map(x => x.text).join(' '), iso(nu));
    if (antal > 1) labb.historikRad(db, b, null, 'Upprepad beställning', `Tillfälle ${i + 1} av ${antal}, var ${intervall === 1 ? 'dag' : `${intervall}:e dag`}.`, iso(nu));
    // Klinisk fysiologi och neurofysiologi bokar själva (simulerat). Röntgen bokar i sin arbetslista.
    simuleradBokning(db, b, nu);
    resultat.push(r);
  }
  const forsta = resultat[0];
  const b = labb.bestallningRad(db, forsta.bestallning.id);
  const ut = labb.bestallningUt(db, b, atk.personal, nu);
  const extra = [k.kontroller.some(x => x.niva === 'tillagd') ? ' P-Kreatinin är tillagt före kontrasten.' : '', antal > 1 ? ` Beställningen upprepas ${antal} gånger, var ${intervall === 1 ? 'dag' : `${intervall}:e dag`}.` : '',
    undersokningar.length ? ` Prioritet ${PRIORITET[prio].namn.toLocaleLowerCase('sv')}, ${PRIORITET[prio].text}.` : ''].join('');
  return { bestallning: ut, serie: resultat.map(r => ({ id: r.bestallning.id, nummer: r.bestallning.nummer, planerad: r.bestallning.planerad })), kontroller: k.kontroller, text: `${forsta.text}${extra}` };
}

// ---- Bokning, utförande och utlåtande -----------------------------------------------------------------------------

const vardag = (datum) => { const d = new Date(`${datum}T12:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; };
// Den första lediga tiden för en undersökning på den simulerade enheten. Vardagar 08.00 till 16.00, och för akut
// prioritet dygnet runt från nu. Tiden är upptagen när en annan bokning med samma modalitet på samma enhet överlappar.
export function ledigTid(db, labId, analysId, { fran, akut = false, utom = null } = {}) {
  const def = ANALYS[analysId];
  const langd = (def.minuter ?? 20) * MIN;
  const upptagna = finns(db) ? db.query('SELECT b.bokad_tid, b.analys_rad_id, a.analys FROM undersokning_bokningar b JOIN labb_analyser a ON a.id = b.analys_rad_id WHERE b.lab_id = ? AND b.modalitet = ? AND b.bokad_tid IS NOT NULL AND b.utford_tid IS NULL AND a.status NOT IN (\'makulerad\', \'borttagen\')').all(labId, def.modalitet ?? '')
    .filter(x => x.analys_rad_id !== utom).map(x => [Date.parse(x.bokad_tid), Date.parse(x.bokad_tid) + (ANALYS[x.analys]?.minuter ?? 20) * MIN]) : [];
  const ledig = (t) => !upptagna.some(([s, e]) => t < e && t + langd > s);
  const steg = 5 * MIN;
  let t = Math.ceil(fran / steg) * steg;
  if (akut) { for (let i = 0; i < 400; i++, t += steg) if (ledig(t)) return new Date(t).toISOString(); return null; }
  let datum = datumAv(new Date(t));
  for (let d = 0; d < 90; d++, datum = addDagar(datum, 1)) {
    if (!vardag(datum)) continue;
    const start = Math.max(Date.parse(lokalTid(datum, '08:00')), t);
    const slut = Date.parse(lokalTid(datum, '16:00'));
    for (let x = Math.ceil(start / steg) * steg; x + langd <= slut; x += steg) if (ledig(x)) return new Date(x).toISOString();
  }
  return null;
}
const forstaFor = (db, b, prio, nu) => {
  if (prio === 'akut') return nu.getTime();
  const imorgon = Date.parse(lokalTid(addDagar(datumAv(nu), 1), '08:00'));
  return Math.max(Date.parse(b.planerad), imorgon);
};
const senastFor = (b, prio) => (prio ? new Date(Date.parse(b.skapad) + PRIORITET[prio].timmar * TIMME).toISOString() : null);

// Väntar undersökningen på något innan den kan bokas: P-Kreatinin före kontrasten, eller MR-säkerhetskontrollen.
function vantarPa(db, b, a) {
  const def = ANALYS[a.analys];
  const t = tillagg(db, b.id);
  const kontroller = JSON.parse(t?.kontroller ?? '[]');
  const ut = [];
  if (def.kontrast && kontroller.some(x => x.typ === 'njurfunktion' && x.niva === 'tillagd')) {
    const k = db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND analys = 'kreatinin' AND status <> 'borttagen'").get(b.id);
    if (k?.status !== 'besvarad') ut.push({ typ: 'njurfunktion', text: 'Väntar på P-Kreatinin före kontrasten.' });
    else {
      const egfr = db.query("SELECT m.varde_num FROM labb_svar s JOIN matvarden m ON m.id = s.matvarde_id WHERE s.analys_rad_id = ? AND m.typ = 'egfr'").get(k.id)?.varde_num;
      if (egfr != null && egfr < EGFR.stopp) ut.push({ typ: 'njurfunktion', stopp: true, text: `eGFR är ${tal(egfr)} enligt beställningens P-Kreatinin. Kontrasten ges inte utan radiologens bedömning. Kontakta ${personNamn(db, b.ansvarig_id)}.` });
    }
  }
  return ut;
}

function utforare(db, personal, a) {
  if (!kanRoll(personal, 'undersokning_utfora')) throw new Fel(403, 'Undersökningarna bokas och registreras av personalen på röntgenkliniken.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!a || LAB[a.lab_id]?.enhet !== ve) throw new Fel(404, 'Undersökningen finns inte i din arbetslista.', 'saknas');
}
const analysRad = (db, id) => (/^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM labb_analyser WHERE id = ?').get(Number(id)) : null);
const loggaUtforande = (db, personal, a, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: a.patient_id, handling: 'undersokning_utfora', resurs, grund: 'utforande', syfte: `Beställd undersökning till ${LAB[a.lab_id]?.kort ?? a.lab_id}` });

function sparaBokning(db, b, a, { tid, av, nu }) {
  const def = ANALYS[a.analys];
  db.query(`INSERT INTO undersokning_bokningar (analys_rad_id, bestallning_id, patient_id, enhet_id, lab_id, modalitet, bokad_tid, bokad_av, bokad_registrerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (analys_rad_id) DO UPDATE SET bokad_tid = excluded.bokad_tid, bokad_av = excluded.bokad_av, bokad_registrerad = excluded.bokad_registrerad`)
    .run(a.id, b.id, b.patient_id, b.enhet_id, a.lab_id, def.modalitet ?? null, tid, av, iso(nu));
}

// Klinisk fysiologi och neurofysiologi har ingen personal i demon: de bokar den första lediga tiden själva när
// beställningen kommer (simulerat).
function simuleradBokning(db, b, nu) {
  const prio = tillagg(db, b.id)?.prioritet ?? 'rutin';
  for (const a of db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND status = 'mottagen'").all(b.id)) {
    if (!arUndersokning(a.analys) || harArbetslista(a.lab_id) || bokning(db, a.id)?.bokad_tid) continue;
    const tid = ledigTid(db, a.lab_id, a.analys, { fran: forstaFor(db, b, prio, nu), akut: prio === 'akut' });
    if (!tid) continue;
    sparaBokning(db, b, a, { tid, av: null, nu });
    labb.historikRad(db, b, null, 'Bokad', `${ANALYS[a.analys].namn} ${tidText(tid)} på ${LAB[a.lab_id].kort}.`, iso(nu));
  }
}

// Röntgenkliniken bokar. Utan tid bokas den tid som systemet föreslår.
export function boka(db, personal, analysId, body = {}, nu = new Date()) {
  sakra(db);
  const a = analysRad(db, analysId);
  utforare(db, personal, a);
  const b = labb.bestallningRad(db, a.bestallning_id);
  if (b.makulerad_tid || a.status === 'makulerad' || a.status === 'borttagen') throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  if (a.status === 'besvarad') throw new Fel(409, 'Undersökningen är redan besvarad.', 'ogiltig');
  const bk = bokning(db, a.id);
  if (bk?.utford_tid) throw new Fel(409, 'Undersökningen är redan gjord.', 'ogiltig');
  const v = vantarPa(db, b, a);
  if (v.length) throw new Fel(409, `${v.map(x => x.text).join(' ')} Undersökningen bokas när det är klart.`, 'ogiltig');
  const t = tillagg(db, b.id);
  if (ANALYS[a.analys].magnet && t?.implantat !== 'nej' && body.mrKontrollerad !== true && !bk?.mr_kontrollerad) {
    throw new Fel(409, 'Kontrollera först att implantatet tål magnetkameran, med patienten och implantatets dokumentation, och bekräfta det i bokningen.', 'mr_kontroll');
  }
  const prio = t?.prioritet ?? 'rutin';
  let tid;
  if (body.tid == null || body.tid === '') tid = ledigTid(db, a.lab_id, a.analys, { fran: forstaFor(db, b, prio, nu), akut: prio === 'akut', utom: a.id });
  else {
    const ms = typeof body.tid === 'string' ? Date.parse(body.tid) : NaN;
    if (!Number.isFinite(ms) || ms < nu.getTime() - 5 * MIN || ms > nu.getTime() + 90 * DAG) throw new Fel(400, 'Välj en tid från nu och högst 90 dagar framåt.', 'ogiltig', { falt: ['tid'] });
    if (ledigTid(db, a.lab_id, a.analys, { fran: ms, akut: true, utom: a.id }) !== new Date(Math.ceil(ms / (5 * MIN)) * 5 * MIN).toISOString()) throw new Fel(409, 'Tiden är redan bokad för en annan undersökning i samma rum. Välj den tid som systemet föreslår.', 'ogiltig', { falt: ['tid'] });
    tid = new Date(Math.ceil(ms / (5 * MIN)) * 5 * MIN).toISOString();
  }
  if (!tid) throw new Fel(409, 'Det finns ingen ledig tid de närmaste 90 dagarna.', 'ogiltig');
  sparaBokning(db, b, a, { tid, av: personal.id, nu });
  if (body.mrKontrollerad === true) db.query('UPDATE undersokning_bokningar SET mr_kontrollerad = ? WHERE analys_rad_id = ?').run(iso(nu), a.id);
  labb.historikRad(db, b, personal.id, bk?.bokad_tid ? 'Ombokad' : 'Bokad', `${ANALYS[a.analys].namn} ${tidText(tid)} på ${LAB[a.lab_id].kort}.${body.mrKontrollerad === true ? ' MR-säkerheten är kontrollerad.' : ''}`, iso(nu));
  loggaUtforande(db, personal, a, `undersokning:boka:${a.id}`);
  const senast = senastFor(b, prio);
  return { tid, text: `${ANALYS[a.analys].namn} är bokad ${tidText(tid)}.${senast && tid > senast ? ` Tiden är efter senaste dag för prioriteten ${PRIORITET[prio].namn.toLocaleLowerCase('sv')}.` : ''}` };
}

// Undersökningen är gjord: studien läggs i multimediaarkivet med ett eget id, och utlåtandet länkar till det.
function utfor(db, b, a, personalId, nu) {
  const def = ANALYS[a.analys];
  let studieId = null, uid = null;
  if (def.arkiv && iKatalog(bilder.UNDERSOKNINGAR, def.arkiv)) {
    const u = bilder.UNDERSOKNINGAR[def.arkiv];
    studieId = Number(db.query("INSERT INTO media_studier (patient_id, enhet_id, vardkontakt_id, undersokning, arkiv, fragestallning, bestalld_av, bestalld, utford, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'besvarad')")
      .run(b.patient_id, b.enhet_id, b.vardkontakt_id ?? null, def.arkiv, u.arkiv, b.anamnes ?? def.namn, b.ansvarig_id, b.skapad, iso(nu)).lastInsertRowid);
    uid = `${OID_ROT}.9.${studieId}`;
    db.query('UPDATE media_studier SET uid = ? WHERE id = ?').run(uid, studieId);
  }
  db.query('UPDATE undersokning_bokningar SET utford_tid = ?, utford_av = ?, studie_id = ?, studie_uid = ? WHERE analys_rad_id = ?').run(iso(nu), personalId, studieId, uid, a.id);
  labb.historikRad(db, b, personalId, 'Undersökningen gjord', `${def.namn} på ${LAB[a.lab_id].kort}.${uid ? ` Bilderna finns i multimediaarkivet, studie ${uid}.` : ''}`, iso(nu));
}
// Runda 13, r3 (E2-45): en undersökning som är bokad längre fram registreras inte som gjord, och patientens identitet
// bekräftas med armbandet eller uttryckligen med hur den kontrollerades. Bekräftelsen sparas i beställningens historik.
export const IDENTITET_ORSAKER = {
  muntligt: 'Patienten uppgav namn och personnummer, och de stämmer med remissen',
  armband_last: 'Armbandet går inte att skanna, och jag har läst det mot remissen',
};
export const TIDIGT_MIN = 60;
function provaIdentitet(db, patientId, identitet) {
  if (typeof identitet?.armband === 'string' && identitet.armband.trim()) {
    // Säkerhetsgranskningen: koden slås upp i armbandstabellen med den gemensamma kontrollen (skanning.js).
    if (!require('./skanning.js').armbandHorTill(db, identitet.armband, patientId)) {
      throw new Fel(400, 'Armbandet hör inte till patienten i beställningen, eller har ersatts av ett nytt. Gör inte undersökningen. Kontrollera att det är rätt patient.', 'ogiltig', { falt: ['armband'] });
    }
    return 'Armbandet skannades och hör till patienten.';
  }
  if (Object.hasOwn(IDENTITET_ORSAKER, identitet?.orsak ?? '')) return `Identiteten bekräftades utan skanning: ${IDENTITET_ORSAKER[identitet.orsak].toLocaleLowerCase('sv')}.`;
  throw new Fel(400, 'Bekräfta patientens identitet: skanna armbandet, eller välj hur du har kontrollerat identiteten.', 'identitet', { falt: ['identitet'], orsaker: IDENTITET_ORSAKER });
}

export function registreraUtford(db, personal, analysId, nu = new Date(), body = {}) {
  sakra(db);
  const a = analysRad(db, analysId);
  utforare(db, personal, a);
  const b = labb.bestallningRad(db, a.bestallning_id);
  const bk = bokning(db, a.id);
  if (b.makulerad_tid || a.status === 'makulerad') throw new Fel(409, 'Beställningen är makulerad.', 'ogiltig');
  if (!bk?.bokad_tid) throw new Fel(409, 'Boka undersökningen först.', 'ogiltig');
  if (bk.utford_tid) throw new Fel(409, 'Undersökningen är redan registrerad som gjord.', 'ogiltig');
  const tidig = Date.parse(bk.bokad_tid) - nu.getTime() > TIDIGT_MIN * MIN;
  if (tidig && body.flyttaTillNu !== true) {
    throw new Fel(409, `Undersökningen är bokad ${tidText(bk.bokad_tid)}. Den registreras som gjord när patienten är på plats. Är patienten här nu, flytta tiden till nu, eller boka om tiden.`, 'tidig', { bokad: bk.bokad_tid });
  }
  const id = provaIdentitet(db, b.patient_id, body.identitet);
  // Patienten är här tidigare än den bokade tiden: tiden flyttas till nu, och flytten står i historiken.
  if (tidig) {
    db.query('UPDATE undersokning_bokningar SET bokad_tid = ? WHERE analys_rad_id = ?').run(iso(nu), a.id);
    labb.historikRad(db, b, personal.id, 'Tiden flyttad', `Patienten kom före den bokade tiden ${tidText(bk.bokad_tid)}, och tiden flyttades till nu.`, iso(nu));
  }
  utfor(db, b, a, personal.id, nu);
  labb.historikRad(db, b, personal.id, 'Identiteten kontrollerad', id, iso(nu));
  loggaUtforande(db, personal, a, `undersokning:utford:${a.id}`);
  return { text: `${ANALYS[a.analys].namn} är gjord. Radiologen skriver utlåtandet, och det kommer till ${personNamn(db, b.ansvarig_id)} för vidimering.` };
}
// Demoknappen i arbetslistan: den simulerade radiologen skriver utlåtandet direkt.
export function simuleraUtlatande(db, personal, analysId, nu = new Date()) {
  sakra(db);
  const a = analysRad(db, analysId);
  utforare(db, personal, a);
  if (!bokning(db, a.id)?.utford_tid) throw new Fel(409, 'Registrera först att undersökningen är gjord.', 'ogiltig');
  const n = labb.forfallnaSvar(db, nu, { bestallningId: a.bestallning_id, alla: true });
  if (!n || db.query('SELECT status FROM labb_analyser WHERE id = ?').get(a.id).status !== 'besvarad') throw new Fel(409, 'Utlåtandet kunde inte skrivas nu.', 'ogiltig');
  loggaUtforande(db, personal, a, `undersokning:utlatande:${a.id}`);
  return { text: `Utlåtandet för ${ANALYS[a.analys].namn} är skickat och väntar på vidimering (simulerat).` };
}

// ---- Krokar i labb.js -----------------------------------------------------------------------------------------------

// En undersökning på det simulerade laboratoriet besvaras när den är gjord och svarstiden har gått.
function vantar(db, a, nu, alla) {
  if (!arUndersokning(a.analys)) return false;
  const bk = bokning(db, a.id);
  if (!bk?.utford_tid) return true;
  if (alla) return false;
  let min = 20;
  try { min = konfig(db, 'labb.svar_minuter', nu); } catch { /* standardvärdet */ }
  return Date.parse(bk.utford_tid) + min * MIN > nu.getTime();
}
// Före svaren: klinisk fysiologi och neurofysiologi utför bokade undersökningar när tiden har kommit (simulerat).
function foreSvar(db, nu) {
  if (!finns(db)) return;
  for (const r of db.query("SELECT u.*, a.status AS astatus FROM undersokning_bokningar u JOIN labb_analyser a ON a.id = u.analys_rad_id WHERE u.utford_tid IS NULL AND u.bokad_tid <= ? AND a.status = 'mottagen'").all(iso(nu))) {
    if (harArbetslista(r.lab_id)) continue;
    const a = analysRad(db, r.analys_rad_id);
    utfor(db, labb.bestallningRad(db, a.bestallning_id), a, null, new Date(r.bokad_tid));
  }
}
// Demoknappen Simulera svar: en undersökning som inte är gjord bokas och görs direkt.
function foreSimulering(db, b, personalId, nu) {
  if (!finns(db)) return;
  for (const a of db.query("SELECT * FROM labb_analyser WHERE bestallning_id = ? AND status = 'mottagen'").all(b.id)) {
    // Säkerhetsgranskningen i runda 11: röntgenklinikens undersökningar bokas och görs bara i arbetslistan, där
    // kontrollerna före undersökningen gäller. Demoknappen simulerar bara enheter utan egen personal i demon.
    if (!arUndersokning(a.analys) || ps(db, a.lab_id) || harArbetslista(a.lab_id)) continue;
    const bk = bokning(db, a.id);
    if (bk?.utford_tid) continue;
    if (!bk?.bokad_tid) sparaBokning(db, b, a, { tid: iso(nu), av: null, nu });
    utfor(db, b, a, null, nu);
  }
}
const ps = (db, labId) => { try { return Boolean(db.query('SELECT 1 FROM ps_anslutningar WHERE lab_id = ? AND aktiv = 1').get(labId)); } catch { return false; } };

// Efter ett svar: koderna, studien och kurvan för undersökningar, och instrumentet för patientnära analyser.
function efterSvar(db, b, a, svar, nu) {
  sakra(db);
  const def = ANALYS[a.analys];
  const t = tillagg(db, b.id);
  let koder = svar.koder ?? null;
  if (!koder && arUndersokning(a.analys)) {
    koder = [];
    if (def.kva) koder.push({ system: 'kva', kod: def.kva, text: KVA[def.kva], kand: true });
    if (def.fynd) koder.push({ system: 'snomed', kod: def.fynd, text: versioner.UTLATANDE_FYND[def.fynd]?.text ?? def.fynd, kand: true });
    if (t?.svf) koder.push({ system: 'svf', kod: SVF[t.svf].kod, text: KVA[SVF[t.svf].kod], kand: true });
  }
  const bk = bokning(db, a.id);
  versioner.sparaInfo(db, b, a, { koder, instrument: svar.instrument ?? null, studieId: bk?.studie_id ?? null, studieUid: bk?.studie_uid ?? null });
  if (bk?.studie_id) db.query('UPDATE media_studier SET utlatande = ? WHERE id = ? AND utlatande IS NULL').run(svar.text ?? null, bk.studie_id);
  // Klinisk fysiologi och neurofysiologi bifogar kurvan till svaret (simulerad PDF).
  if (arUndersokning(a.analys) && ['klinisk_fysiologi', 'klinisk_neurofysiologi'].includes(def.disciplin) && !svar.underlag) {
    const kurva = pdf([{ text: `${def.namn}, ${b.nummer}`, fet: true, storlek: 14 }, { text: `${LAB[a.lab_id].namn}` }, { text: '' },
      { text: 'Simulerad kurva från demon. Ingen riktig registrering.' }, { text: '' }, { text: svar.text ?? '' }, { text: '' }, { text: DEMOREGEL, storlek: 9 }], { titel: `${def.namn} ${b.nummer}` });
    underlag.spara(db, b, [{ namn: `${def.namn.toLocaleLowerCase('sv').replace(/[^a-zåäö0-9]+/g, '-')}-kurva.pdf`, typ: 'application/pdf', buf: Buffer.from(kurva) }], { riktning: 'svar', analysId: a.id, kalla: LAB[a.lab_id].kort, nu });
  }
  if (svar.underlag?.length) underlag.spara(db, b, svar.underlag, { riktning: 'svar', analysId: a.id, kalla: LAB[a.lab_id]?.kort ?? a.lab_id, nu });
}

// Beställningen som den visas: prioritet, vårdförlopp, serie, kontroller, bokning, senaste dag och studie.
function utoka(db, b, ut, personal, nu) {
  if (!finns(db)) return;
  const t = tillagg(db, b.id);
  if (t) {
    ut.prioritet = t.prioritet ? { id: t.prioritet, namn: PRIORITET[t.prioritet].namn, text: PRIORITET[t.prioritet].text, senast: senastFor(b, t.prioritet) } : null;
    ut.svf = t.svf ? { id: t.svf, namn: SVF[t.svf].namn, kod: SVF[t.svf].kod, text: KVA[SVF[t.svf].kod] } : null;
    ut.serie = t.serie_id ? { id: t.serie_id, nr: t.serie_nr, antal: t.serie_antal, intervallDagar: t.intervall_dagar } : null;
    ut.kontroller = JSON.parse(t.kontroller);
  }
  const egen = personal && vardenhetFor(db, personal.enhet_id) === vardenhetFor(db, b.enhet_id);
  for (const x of ut.analyser) {
    // Demoknapparna: instrumentet mäter ett taget patientnära prov, och det simulerade laboratoriet rättar ett svar.
    if (LAB[x.lab?.id]?.instrument && x.status === 'skickad' && personal && kanRoll(personal, 'ta_prov')) x.kanMata = true;
    if (x.status === 'besvarad' && egen && kanRoll(personal, 'bestalla_prov') && !LAB[x.lab?.id]?.instrument && !ps(db, x.lab?.id)) x.kanSimuleraRattelse = true;
    if (!arUndersokning(x.analys)) continue;
    const def = ANALYS[x.analys];
    const bk = bokning(db, x.id);
    x.undersokning = {
      modalitet: def.modalitet ?? null, kva: def.kva ? { kod: def.kva, text: KVA[def.kva] } : null,
      bokad: bk?.bokad_tid ? { tid: bk.bokad_tid, av: personNamn(db, bk.bokad_av) ?? LAB[x.lab.id]?.kort } : null,
      utford: bk?.utford_tid ? { tid: bk.utford_tid, av: personNamn(db, bk.utford_av) } : null,
      vantar: x.status === 'besvarad' ? [] : vantarPa(db, b, db.query('SELECT * FROM labb_analyser WHERE id = ?').get(x.id)),
      forberedelse: forberedelse(db, x.analys, nu),
    };
    if (x.status !== 'besvarad' && x.status !== 'makulerad') {
      const steg = x.undersokning.utford ? 'Gjord, väntar på utlåtande' : x.undersokning.bokad ? `Bokad ${tidText(x.undersokning.bokad.tid)}` : x.undersokning.vantar.length ? x.undersokning.vantar[0].text : `Hos ${x.lab?.kort ?? 'den utförande enheten'}, väntar på tid`;
      x.statusText = steg;
    }
  }
  // Demoknappen Simulera svar visas bara när det simulerade laboratoriet har något att svara på direkt: inte för
  // röntgenklinikens undersökningar innan de är gjorda, och inte för ett patientnära instrument.
  if (ut.kan?.simuleraSvar) {
    ut.kan.simuleraSvar = ut.analyser.some(x => x.status === 'mottagen' && !ps(db, x.lab?.id) && !LAB[x.lab?.id]?.instrument && (!x.undersokning || !harArbetslista(x.lab?.id) || x.undersokning.utford));
  }
  // Fynd som kan ge välgrundad misstanke om cancer: systemet påminner om vårdförloppet.
  const misstanke = ut.analyser.find(x => x.status === 'besvarad' && (x.koder ?? []).some(k => k.system === 'snomed' && k.kod !== '281900007'));
  if (misstanke && ut.svf) ut.svfForslag = `Svaret på ${misstanke.namn} har ett fynd. Ta ställning till om det ger välgrundad misstanke om cancer och i så fall starta vårdförloppet (${ut.svf.kod}, ${ut.svf.text}).`;
}

// Förberedelsen för patienten inför undersökningen, som systemförvaltningen kan ändra (konfiguration.js).
export function forberedelse(db, analysId, nu = new Date()) {
  try { const v = konfig(db, `labb.anvisning.${analysId}`, nu); return v || null; } catch { return null; }
}

labb.KROKAR.vantar.push(vantar);
labb.KROKAR.foreSvar.push(foreSvar);
labb.KROKAR.foreSimulering.push(foreSimulering);
labb.KROKAR.efterSvar.push(efterSvar);
labb.KROKAR.bestallningUt.push((db, b, ut, personal, nu) => { versioner.utoka(db, b, ut, personal); underlag.utoka(db, b, ut); utoka(db, b, ut, personal, nu); });
labb.KROKAR.innehall.push(versioner.innehallFor);

// ---- Röntgenklinikens arbetslista ---------------------------------------------------------------------------------

// Inkomna undersökningar till röntgenkliniken: de som inte är bokade först, efter prioritet och senaste dag, sedan de
// bokade i tidsordning, och de som är gjorda i dag. Raden innehåller det som beställningen skickar till den utförande
// enheten: patientens identitet, frågeställningen, prioriteten och kontrollerna. En patient med skyddade
// personuppgifter visas med beställnings-id men utan namn och fullständigt personnummer. Varje patient loggas en gång
// per session och dag med grunden utförande.
export function arbetslista(db, personal, nu = new Date(), loggade = new Set()) {
  if (!kanRoll(personal, 'undersokning_utfora')) throw new Fel(403, 'Arbetslistan för undersökningar är för personalen på röntgenkliniken.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const labs = LABORATORIER.filter(l => l.enhet === ve);
  if (!labs.length) throw new Fel(403, 'Arbetslistan för undersökningar är för personalen på röntgenkliniken.', 'nekad');
  sakra(db);
  labb.forfallnaSvar(db, nu);
  const ph = labs.map(() => '?').join(', ');
  const dag = datumAv(nu);
  const rader = db.query(`SELECT a.* FROM labb_analyser a JOIN labb_bestallningar b ON b.id = a.bestallning_id WHERE a.lab_id IN (${ph}) AND b.makulerad_tid IS NULL
      AND (a.status IN ('mottagen', 'skickad') OR (a.status = 'besvarad' AND a.besvarad_tid >= ?)) ORDER BY a.id`).all(...labs.map(l => l.id), lokalTid(dag, '00:00'));
  const ut = [];
  for (const a of rader) {
    const b = labb.bestallningRad(db, a.bestallning_id);
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(b.patient_id);
    const t = tillagg(db, b.id);
    const bk = bokning(db, a.id);
    const prio = t?.prioritet ?? 'rutin';
    const v = a.status === 'besvarad' ? [] : vantarPa(db, b, a);
    const resurs = `undersokningar:${ve}:${dag}:${p.id}`;
    if (!loggade.has(resurs)) { loggade.add(resurs); loggaUtforande(db, personal, a, `undersokningar:${dag}`); }
    const def = ANALYS[a.analys];
    const mrKontroll = Boolean(def.magnet && t?.implantat !== 'nej' && !bk?.mr_kontrollerad);
    ut.push({
      id: a.id, nummer: b.nummer, undersokning: def.namn, modalitet: def.modalitet, lab: { id: a.lab_id, kort: LAB[a.lab_id].kort },
      patient: { namn: visningsnamn(p, false), personnummer: visningsPnr(p, false), skyddad: Boolean(p.skyddad), kon: p.skyddad ? null : p.kon, alder: alder(p.fodd, dag) },
      fragestallning: b.anamnes, kommentar: b.kommentar, bestallare: { namn: personNamn(db, b.ansvarig_id), vardenhet: enhetsnamn(db, b.enhet_id) }, bestalld: b.skapad,
      prioritet: { id: prio, namn: PRIORITET[prio].namn, text: PRIORITET[prio].text, ordning: PRIORITET[prio].ordning }, senast: senastFor(b, prio),
      svf: t?.svf ? { namn: SVF[t.svf].namn, kod: SVF[t.svf].kod } : null,
      kontroller: JSON.parse(t?.kontroller ?? '[]').filter(x => x.niva !== 'info' || ['implantat', 'graviditet'].includes(x.typ)),
      vantar: v, mrKontroll,
      bokad: bk?.bokad_tid ?? null, utford: bk?.utford_tid ?? null, besvarad: a.status === 'besvarad' ? a.besvarad_tid : null,
      studie: bk?.studie_uid ? { id: bk.studie_id, uid: bk.studie_uid } : null,
      forslag: !bk?.bokad_tid && !v.length && a.status !== 'besvarad' ? ledigTid(db, a.lab_id, a.analys, { fran: forstaFor(db, b, prio, nu), akut: prio === 'akut', utom: a.id }) : null,
      sen: !bk?.utford_tid && a.status !== 'besvarad' && Date.parse(senastFor(b, prio)) < (bk?.bokad_tid ? Date.parse(bk.bokad_tid) : nu.getTime()),
      underlag: underlag.forBestallning(db, b.id).filter(u => u.riktning === 'bestallning').map(u => ({ id: u.id, namn: u.namn, url: `/api/undersokningar/${a.id}/underlag/${u.id}` })),
    });
  }
  const steg = (r) => (r.besvarad ? 3 : r.utford ? 2 : r.bokad ? 1 : 0);
  ut.sort((x, y) => steg(x) - steg(y) || (steg(x) === 0 ? x.prioritet.ordning - y.prioritet.ordning || x.senast.localeCompare(y.senast) : String(x.bokad ?? x.utford ?? '').localeCompare(String(y.bokad ?? y.utford ?? ''))));
  return {
    vardenhet: { id: ve, namn: enhetsnamn(db, ve) }, datum: dag, laboratorier: labs.map(l => ({ id: l.id, kort: l.kort })),
    rader: ut, antal: { attBoka: ut.filter(r => steg(r) === 0).length, bokade: ut.filter(r => steg(r) === 1).length, gjorda: ut.filter(r => steg(r) >= 2).length },
    simulerat: SIMULERAT, demoregel: DEMOREGEL,
  };
}
// Ett underlag till en beställning som röntgenkliniken har fått, med samma prövning som arbetslistan.
export function underlagForUtforare(db, personal, analysId, underlagId) {
  const a = analysRad(db, analysId);
  utforare(db, personal, a);
  const u = underlag.rad(db, underlagId);
  if (u.bestallning_id !== a.bestallning_id || u.riktning !== 'bestallning') throw new Fel(404, 'Underlaget finns inte.', 'saknas');
  loggaUtforande(db, personal, a, `labb:underlag:${u.id}`);
  return underlag.fil(u);
}

// ---- Planerat för patienten (Sussa 4.4.2.2 och 4.4.2.7) -----------------------------------------------------------

// Allt som är planerat för patienten i alla vårdprocesser som den inloggade får se: prover som inte är tagna,
// undersökningar med bokad tid eller som väntar på tid, och de ordinerade kontrollerna, i tidsordning.
export function planerat(bestallningar, kontroller) {
  const ut = [];
  for (const b of bestallningar) {
    if (b.status === 'makulerad') continue;
    for (const p of b.prov.filter(x => !x.provtagen && !ROR[x.ror]?.utanProv)) {
      ut.push({ typ: 'prov', tid: p.planerad, rubrik: p.analyser.join(', '), text: `${p.rorNamn}, ${p.lab?.kort ?? ''}`, vardenhet: b.vardenhet.namn, nummer: b.nummer, forsenad: p.forsenad, status: p.forsenad ? 'Försenad' : 'Planerad' });
    }
    for (const a of b.analyser.filter(x => x.undersokning && x.status !== 'besvarad' && x.status !== 'borttagen' && x.status !== 'makulerad')) {
      ut.push({ typ: 'undersokning', tid: a.undersokning.bokad?.tid ?? b.prioritet?.senast ?? b.planerad, rubrik: a.namn, text: a.statusText ?? '', vardenhet: b.vardenhet.namn, nummer: b.nummer,
        bokad: Boolean(a.undersokning.bokad), status: a.undersokning.utford ? 'Gjord' : a.undersokning.bokad ? 'Bokad' : 'Väntar på tid', senast: b.prioritet?.senast ?? null });
    }
  }
  for (const k of kontroller ?? []) if (k.aktiv && k.nasta) ut.push({ typ: 'kontroll', tid: k.nasta.tid, rubrik: k.namn, text: k.frekvensText, vardenhet: k.enhet?.namn ?? '', status: k.nasta.status === 'forsenad' ? 'Försenad' : 'Planerad', forsenad: k.nasta.status === 'forsenad' });
  return ut.sort((a, b) => String(a.tid).localeCompare(String(b.tid)));
}

// ---- Min journal (Sussa 4.4.2.5) ------------------------------------------------------------------------------------

// Patientens beställningar med status, efter vårdgivarens visningsregler: en vårdenhet vars anteckningar inte visas i
// Min journal visar inte heller beställningarna, och en fördröjd visning gäller också dem. Svaren visas som i Min
// journal i övrigt: när läkaren har vidimerat dem, och senast 14 dagar efter provtagningen. Inga namn på personalen,
// inga id och inga interna anteckningar.
export const MIN_STATUS = { bestalld: 'Beställd', delvis_provtagen: 'Provtagning pågår', skickad: 'Hos laboratoriet', delvis_besvarad: 'Delvis besvarad',
  besvarad: 'Besvarad, läkaren går igenom svaret', vidimerad: 'Klar', makulerad: 'Makulerad' };
export function minBestallningar(atk, nu = new Date(), { PROVSVAR_SENAST_DAGAR = 14 } = {}) {
  const db = atk.db;
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'labb_bestallningar'").get()) return { bestallningar: [], regel: MIN_REGEL };
  sakra(db);
  const regler = db.query('SELECT * FROM visningsregler WHERE anteckningstyp IS NULL AND enhet_id IS NOT NULL').all();
  const rader = db.query('SELECT * FROM labb_bestallningar WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId);
  const ut = [];
  for (const b of rader) {
    const ve = vardenhetFor(db, b.enhet_id);
    const regel = regler.find(r => r.enhet_id === ve);
    if (regel?.visning === 'visas_inte') continue;
    if (regel?.visning === 'fordrojd' && Date.parse(b.skapad) + regel.dagar * DAG > nu.getTime()) continue;
    const x = labb.bestallningUt(db, b, null, nu);
    const svarVisas = (a) => Boolean(a.vidimerad) || (a.besvarad && Date.parse(a.besvarad) + PROVSVAR_SENAST_DAGAR * DAG <= nu.getTime());
    ut.push({
      skapad: b.skapad, vardenhet: enhetsnamn(db, ve), status: minStatus(x), klar: x.status === 'vidimerad',
      analyser: x.analyser.filter(a => a.status !== 'borttagen').map(a => ({
        namn: a.namn, status: a.status === 'makulerad' ? 'Makulerad' : a.status === 'besvarad' ? (svarVisas(a) ? 'Svaret finns' : 'Läkaren går igenom svaret') : a.undersokning ? (a.undersokning.utford ? 'Undersökningen är gjord' : a.undersokning.bokad ? 'Tid bokad' : 'Väntar på tid') : a.status === 'bestalld' ? 'Provet är inte taget än' : 'Hos laboratoriet',
        tid: a.undersokning?.bokad && !a.undersokning.utford ? a.undersokning.bokad.tid : null, plats: a.undersokning?.bokad && !a.undersokning.utford ? LAB[a.lab.id]?.namn.replace(/ \(simulerad\)$/, '') : null,
        forberedelse: a.undersokning && !a.undersokning.utford ? a.undersokning.forberedelse : null,
        utlatande: a.undersokning && a.status === 'besvarad' && svarVisas(a) ? a.text : null,
        rattat: (a.version ?? 1) > 1 && svarVisas(a),
      })),
      steg: x.steg.filter(s => s.steg !== 'signerad').map(s => ({ steg: s.steg, klar: s.klar, tid: s.tid })),
    });
  }
  return { bestallningar: ut, regel: MIN_REGEL, simulerat: SIMULERAT };
}
// Statusen som patienten förstår: en undersökning har inget prov att ta, så den räknas inte som provtagning.
function minStatus(x) {
  if (!['bestalld', 'delvis_provtagen', 'skickad'].includes(x.status)) return MIN_STATUS[x.status];
  const ror = x.prov.filter(p => !ROR[p.ror]?.utanProv);
  if (ror.some(p => !p.provtagen)) return ror.some(p => p.provtagen) ? 'Provtagning pågår' : 'Beställd';
  return ror.length ? 'Hos laboratoriet' : 'Beställd';
}
export const MIN_REGEL = 'Beställningarna visas direkt med status. Svaren visas när läkaren har gått igenom dem, och senast 14 dagar efter provtagningen. En vårdenhet som inte visar sina anteckningar i Min journal visar inte heller sina beställningar.';

// ---- Demons undersökningar ----------------------------------------------------------------------------------------

// Läggs i mallen för nya sandlådor (db.js mallen), inte i byggSeed: Gunnar Åkesson (p01) på avdelning 72 har en
// röntgen av höftleden som väntar på tid och ett ultraljud av buken som är bokat, så att röntgenklinikens arbetslista och
// fliken Prover visar undersökningar från början. Allt är påhittat och röntgenkliniken är simulerad.
export function seedaDemo(db, bas = new Date()) {
  const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);
  if (!pers('lak-kard') || !pers('rtg-ssk') || !db.query("SELECT 1 FROM patienter WHERE id = 'p01'").get()) return;
  sakra(db);
  const a = new Atkomst(db, pers('lak-kard'), 'p01', {}, 'bestalla_prov');
  const t = (min) => new Date(bas.getTime() + min * MIN);
  bestall(a, { analyser: ['rtg_hoft'], anamnes: 'Smärta i höger höft efter fall i går. Fraktur?', prioritet: 'snart', kvitteraDubbletter: true }, t(-90));
  const ul = bestall(a, { analyser: ['ul_buk'], anamnes: 'Återkommande smärta under höger revbensbåge. Gallsten?', kvitteraDubbletter: true }, t(-26 * 60)).bestallning;
  boka(db, pers('rtg-ssk'), ul.analyser[0].id, {}, t(-25 * 60));
}

export { DISCIPLINER };
