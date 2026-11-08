// Läkemedelsprocessen, del 2 (runda 6, r2): fler vägar till en ordination. Mallar med flera ordinationer knutna till
// samma vårdhändelse (Sussa 3.5.1.3, 3.5.2.14), muntlig ordination som sjuksköterskan registrerar och läkaren signerar
// (3.5.2.12) och ordination enligt generella direktiv (3.5.2.15).
//
// Systemet är experten. Läkaren väljer en mall, och systemet fyller i varje ordination ur produktens mall och patienten,
// kontrollerar dem en och en som vid annan ordination, tar själv bort ett läkemedel som patienten redan har och
// förklarar varför, och läkaren bekräftar med ett klick. Sjuksköterskan ser bara de direktiv som gäller hennes
// vårdenhet, och systemet prövar ramarna (ålder, överkänslighet, njurfunktion, blodtryck, andra läkemedel och antal
// tillfällen) och förklarar på vanlig svenska varför ett direktiv inte går att använda. Det som systemet inte kan
// kontrollera själv bekräftar sjuksköterskan i samma steg.
//
// Vem som fastställer. Generella direktiv fastställs av verksamhetschefen eller den medicinskt ansvariga läkaren
// (HSLF-FS 2017:37 6 kap. 6 och 17 §§, Region Örebro läns Gröna häftet 688488 R5 avsnitt 1.4.2). Mallar upprättas av en
// läkare och godkänns av den läkare som verksamhetschefen har utsett som ansvarig för läkemedelsmallarna (1.4.3).
// Uppdragen finns i lakemedelsansvar.js och godkännandena i mallgodkannande.js (runda 6, r6).
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { vardenhetFor, alder, kanRoll } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as lakemedel from './lakemedel.js';
import * as mallar from './ordinationsmallar.js';
import * as vardhandelse from './vardhandelse.js';
import * as stod from './lakemedelsstod.js';
import { kravVardande } from './administrering.js';
// Runda 6, r6: mallarna godkänns av mallansvarig läkare, och direktiven fastställs av verksamhetschefen eller den
// medicinskt ansvariga läkaren (lakemedelsansvar.js och mallgodkannande.js).
import * as ansvar from './lakemedelsansvar.js';
import * as godkannande from './mallgodkannande.js';

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const lmKort = (lm) => (lm ? { id: lm.id, namn: lm.namn, styrka: lm.styrka, form: lm.form, atc: lm.atc } : null);
const text = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;

// Ett fastställt beslut gäller för vårdenheten eller en avdelning under den. Användaren omfattas när beslutet gäller
// hennes vårdenhet eller den avdelning hon arbetar på.
const omfattar = (db, enhetId, personal) => enhetId === personal.enhet_id || enhetId === vardenhetFor(db, personal.enhet_id);
const giltigt = (b, dag = idag()) => !b.upphavt && b.giltigt_till >= dag && (b.giltigt_fran ?? '0000') <= dag;
const loggaUtan = (db, personal, handling, resurs, resultat = 'tillaten') => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling, resurs, grund: resultat === 'nekad' ? 'nekad' : 'administrativ', resultat });

// Mallar med flera ordinationer -------------------------------------------------------------------------------------

function paketUt(db, p) {
  return { id: p.id, namn: p.namn, vardhandelse: p.vardhandelse, beskrivning: p.beskrivning, vardenhet: { id: p.enhet_id, namn: enhetsnamn(db, p.enhet_id) },
    faststalltAv: personNamn(db, p.faststallt_av), faststallt: p.faststallt, giltigtTill: p.giltigt_till,
    // Runda 6, r6: version, status och godkännande. faststalltAv är den som upprättade versionen.
    ...godkannande.paketInfo(db, p),
    poster: JSON.parse(p.innehall).map(x => ({ lakemedel: lmKort(katalog(db, x.lakemedelId)), orsak: x.orsak, vidHandelse: x.vidHandelse ?? null })) };
}

// Mallarna som gäller på användarens vårdenhet. Bara för den som får ordinera.
export function paketLista(atk) {
  atk.krav('ordinera');
  const db = atk.db;
  // Runda 6, r6: bara mallar som den mallansvariga läkaren har godkänt.
  return { paket: db.query('SELECT * FROM ordinationspaket ORDER BY namn').all().filter(p => giltigt(p) && omfattar(db, p.enhet_id, atk.personal) && godkannande.paketGodkand(db, p)).map(p => paketUt(db, p)), anmarkning: mallar.DEMO_MALLAR };
}

function hamtaPaket(atk, id) {
  const p = atk.db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(String(id));
  if (!p || !giltigt(p)) throw new Fel(404, 'Mallen finns inte eller gäller inte längre.', 'saknas');
  if (!omfattar(atk.db, p.enhet_id, atk.personal)) {
    atk.logga('ordinera', 'nekad', `ordinationspaket:${p.id}`, 'nekad');
    throw new Fel(403, `Mallen ${p.namn} är fastställd för ${enhetsnamn(atk.db, p.enhet_id)} och gäller inte på din vårdenhet.`, 'nekad');
  }
  // Runda 6, r6: en mall som inte är godkänd kan inte användas.
  if (!godkannande.paketGodkand(atk.db, p)) throw new Fel(400, `Mallen ${p.namn} är inte godkänd av den läkare som ansvarar för vårdenhetens läkemedelsmallar och kan inte användas än.`, 'ogiltig');
  return p;
}

// Ord i vårdhändelsens namn, för att hitta patientens bokning eller post på väntelistan som passar mallen.
const ord = (t) => new Set(String(t ?? '').toLowerCase().split(/[^a-zåäöé0-9]+/).filter(w => w.length >= 5));
function vardhandelseFor(atk, namn) {
  const f = vardhandelse.forslag(atk, { text: namn });
  const passar = (x) => [...ord(namn)].some(w => ord(x.text).has(w));
  const b = f.bokningar.find(passar);
  const tid = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  if (b) return { val: { bokningId: b.id }, text: `${b.text}, bokad ${tid(b.start)}`, typ: 'bokning' };
  const p = f.vantelista.find(passar);
  if (p) return { val: { vantelistaId: p.id }, text: `${p.text}, på väntelistan`, typ: 'vantelista' };
  return { val: { text: namn }, text: f.ny.text, typ: f.ny.mojlig ? 'ny' : 'utan_tidbok' };
}

// Förhandsvisningen: varje ordination ifylld av systemet, med varningarna. Ett läkemedel som patienten redan har tas
// inte med, och en ordination med en annan allvarlig varning tas bara med när läkaren skriver en motivering.
export function paketForslag(atk, id) {
  atk.krav('ordinera');
  const db = atk.db;
  const p = hamtaPaket(atk, id);
  const u = lakemedel.underlag(atk);
  const tidigare = [];
  const vh = p.vardhandelse && JSON.parse(p.innehall).some(x => x.vidHandelse != null) ? vardhandelseFor(atk, p.vardhandelse) : null;
  const poster = JSON.parse(p.innehall).map((x, i) => {
    const lm = katalog(db, x.lakemedelId);
    const f = mallar.forslag(atk, lm);
    const tillagg = stod.forslagTillagg(db, lm, { dos: x.dos ?? f.dos, dosEnhet: x.dosEnhet ?? f.dosEnhet });
    const ordination = {
      lakemedelId: lm.id, dosering: x.dosering ?? f.dosering, dos: x.dos ?? f.dos, dosEnhet: x.dosEnhet ?? f.dosEnhet, tider: x.vidHandelse != null ? [] : (x.tider ?? f.tider),
      typ: x.typ ?? f.typ, vidBehov: (x.typ ?? f.typ) === 'vid_behov', ordinationsorsak: x.orsak, uppfoljningsdatum: addDagar(idag(), x.uppfoljning ?? 7), start: idag(),
      administrationssatt: f.administrationssatt, mall: p.id, volymMl: f.volymMl,
      ...(tillagg.spadning ? { spadning: { losning: tillagg.spadning.losning, volymMl: tillagg.spadning.volymMl, tidMin: tillagg.spadning.tidMin, tillsatser: [] } } : {}),
    };
    const varningar = lakemedel.varningar(db, atk.patientId, lm, [...u.aktiva, ...tidigare], u);
    const dubbel = varningar.find(v => v.regel === 'dubbel_substans' && !tidigare.some(t => t.lakemedel_id === lm.id));
    const allvarliga = varningar.filter(v => v.niva === 'allvarlig');
    let lage = 'tas_med';
    let varfor = null;
    if (dubbel) { lage = 'utesluten'; varfor = `Tas inte med: ${dubbel.text} Den ordinationen fortsätter att gälla.`; }
    else if (allvarliga.length) { lage = 'kraver_motivering'; varfor = 'Tas med bara om du skriver en motivering för varningen.'; }
    if (lage === 'tas_med') tidigare.push({ lakemedel_id: lm.id, id: -1 - i });
    return {
      post: i, lakemedel: lmKort(lm), ordination, varningar, lage, varfor, vidHandelse: x.vidHandelse ?? null,
      // Systemets anpassningar efter patienten nämns bara när mallen inte har en egen dosering.
      sammanfattning: `${ordination.dosering}${x.vidHandelse != null && !/före/.test(ordination.dosering) ? `, ${x.vidHandelse} ${x.vidHandelse === 1 ? 'timme' : 'timmar'} före ${p.vardhandelse.toLowerCase()}` : ''}.${x.dosering ? '' : ` ${f.varfor.filter(v => !v.startsWith('Mallen')).join(' ')}`}`.trim(),
      ...(tillagg.spadning ? { spadning: stod.beraknaSpadning(db, lm, ordination.dos, ordination.dosEnhet, ordination.spadning) } : {}),
    };
  });
  return { paket: paketUt(db, p), poster, vardhandelse: vh ? { text: vh.text, typ: vh.typ } : null, demoregler: true, anmarkning: mallar.DEMO_MALLAR };
}

// POST /api/patient/:id/ordinationspaket/:paket { motiveringar?: { [post]: [{ regel, motivering }] }, uteslut?: [post] }.
// Alla ordinationer sparas tillsammans, eller ingen.
export function ordineraPaket(atk, id, inp = {}, { knytKontakt = (x) => x } = {}) {
  atk.krav('ordinera');
  const db = atk.db;
  const f = paketForslag(atk, id);
  const p = hamtaPaket(atk, id);
  const uteslut = new Set(Array.isArray(inp.uteslut) ? inp.uteslut.map(Number) : []);
  const motiveringar = inp.motiveringar && typeof inp.motiveringar === 'object' ? inp.motiveringar : {};
  const valda = f.poster.filter(x => !uteslut.has(x.post) && (x.lage === 'tas_med' || (x.lage === 'kraver_motivering' && Array.isArray(motiveringar[x.post]))));
  if (!valda.length) throw new Fel(400, 'Ingen ordination i mallen kan sparas. Läs varningarna, och skriv en motivering för de ordinationer som ska tas med.', 'ogiltig', { poster: f.poster });
  const grupp = `${p.id}:${iso()}`;
  const vh = f.vardhandelse ? vardhandelseFor(atk, p.vardhandelse) : null;
  const sparade = [];
  db.transaction(() => {
    let koppling = null;
    for (const x of valda) {
      let kropp = { ...x.ordination, kvitteradeVarningar: motiveringar[x.post] ?? [] };
      let k = null;
      if (x.vidHandelse != null && vh) {
        // Alla ordinationer i mallen hänger på samma vårdhändelse. Den första sätter upp den på väntelistan, och de
        // andra knyts till samma post.
        const val = koppling?.vantelista_id ? { vantelistaId: koppling.vantelista_id } : vh.val;
        kropp.vardhandelse = { ...val, forskjutningTimmar: -x.vidHandelse };
        k = vardhandelse.forbered(atk, kropp);
        kropp.vardhandelse = { ...kropp.vardhandelse, text: k.text };
      }
      const t = mallar.valideraTillagg(db, kropp);
      const sf = stod.forbered(db, kropp);
      kropp = sf.kropp;
      const ut = lakemedel.spara(atk, kropp);
      mallar.sparaTillagg(db, ut.ordination.id, t);
      stod.sparaTillagg(db, ut.ordination.id, sf.extra);
      if (k) {
        vardhandelse.knyt(atk, ut.ordination.id, k);
        koppling ??= db.query('SELECT * FROM vardhandelse_kopplingar WHERE ordination_id = ?').get(ut.ordination.id);
      }
      db.query('INSERT INTO paketordinationer (ordination_id, paket_id, grupp, post) VALUES (?, ?, ?, ?)').run(ut.ordination.id, p.id, grupp, x.post);
      db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(ut.ordination.id, iso(), atk.personal.id, 'Ordinerad ur mallen', p.namn);
      sparade.push(knytKontakt({ ordination: lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, ut.ordination.id), { fullVardhandelse: true }), nll: ut.nll, varningar: ut.varningar }));
    }
  })();
  return { paket: f.paket, grupp, ordinationer: sparade.map(s => ({ ...s.ordination, ...(s.vardkontakt ? { vardkontakt: s.vardkontakt } : {}) })), nll: sparade.map(s => s.nll), utelamnade: f.poster.filter(x => !valda.includes(x)).map(x => ({ post: x.post, lakemedel: x.lakemedel, varfor: x.varfor ?? 'Valdes bort.' })), vardkontakt: sparade[0]?.vardkontakt ?? null };
}

// En läkare upprättar en mall för sin vårdenhet (Gröna häftet 1.4.3). poster: [{ lakemedelId, orsak, dosering?,
// dos?, dosEnhet?, tider?, typ?, uppfoljning?, vidHandelse? }]. Runda 6, r6: mallen används först när den
// mallansvariga läkaren har godkänt den. ersatter är en tidigare version som mallen ändrar, och systemet skriver vad som
// ändrats.
export function faststallPaket(db, personal, inp = {}) {
  if (personal.yrke !== 'lakare' || !kanRoll(personal, 'faststalla_mall')) {
    loggaUtan(db, personal, 'faststalla_mall', 'ordinationspaket', 'nekad');
    throw new Fel(403, 'Mallar med flera ordinationer upprättas av en läkare och godkänns av den läkare som verksamhetschefen har utsett som ansvarig för läkemedelsmallarna.', 'nekad');
  }
  const forra = typeof inp.ersatter === 'string' ? db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(inp.ersatter) : null;
  if (inp.ersatter != null && (!forra || !giltigt(forra) || vardenhetFor(db, forra.enhet_id) !== vardenhetFor(db, personal.enhet_id))) {
    throw new Fel(400, 'Mallen som ska ändras finns inte, gäller inte längre eller hör till en annan vårdenhet.', 'ogiltig', { falt: ['ersatter'] });
  }
  const vantar = forra && db.query('SELECT o.* FROM paketversioner v JOIN ordinationspaket o ON o.id = v.paket_id WHERE v.ersatter = ?').all(forra.id).find(o => giltigt(o) && !godkannande.paketGodkand(db, o));
  if (vantar) throw new Fel(400, `Det finns redan en ändrad version av mallen ${forra.namn} som väntar på godkännande.`, 'ogiltig', { falt: ['ersatter'] });
  if (forra) { inp = { namn: forra.namn, vardhandelse: forra.vardhandelse, beskrivning: forra.beskrivning, enhetId: forra.enhet_id, ...inp }; }
  const namn = text(inp.namn, 80);
  const poster = Array.isArray(inp.poster) ? inp.poster.slice(0, 10) : [];
  const enhet = inp.enhetId ?? vardenhetFor(db, personal.enhet_id);
  if (namn.length < 3 || !poster.length) throw new Fel(400, 'Ge mallen ett namn och minst en ordination.', 'ogiltig', { falt: ['namn', 'poster'] });
  if (!omfattar(db, enhet, personal) && vardenhetFor(db, enhet) !== vardenhetFor(db, personal.enhet_id)) throw new Fel(403, 'En mall fastställs bara för din egen vårdenhet eller en avdelning under den.', 'nekad');
  const rena = poster.map(x => {
    const lm = typeof x?.lakemedelId === 'string' ? katalog(db, x.lakemedelId) : null;
    if (!lm || text(x.orsak).length < 3) throw new Fel(400, 'Varje ordination i mallen ska ha ett läkemedel ur katalogen och en ordinationsorsak.', 'ogiltig', { falt: ['poster'] });
    const r = { lakemedelId: lm.id, orsak: text(x.orsak) };
    for (const k of ['dosering', 'dosEnhet', 'typ']) if (typeof x[k] === 'string' && x[k].trim()) r[k] = text(x[k]);
    if (Number.isFinite(Number(x.dos)) && x.dos != null) r.dos = Number(x.dos);
    if (Array.isArray(x.tider)) r.tider = x.tider.map(String).slice(0, 8);
    if (Number.isFinite(Number(x.uppfoljning)) && x.uppfoljning != null) r.uppfoljning = Math.min(365, Math.max(1, Number(x.uppfoljning)));
    if (x.vidHandelse != null && Number.isFinite(Number(x.vidHandelse))) r.vidHandelse = Math.min(72, Math.max(0, Number(x.vidHandelse)));
    if (r.typ && !lakemedel.TYPER.includes(r.typ)) throw new Fel(400, 'Typen ska vara stående, vid behov eller tillfällig.', 'ogiltig', { falt: ['poster'] });
    return r;
  });
  const id = `${namn.toLowerCase().replace(/[^a-zåäö0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
  const andringar = forra ? godkannande.paketSkillnad(db, JSON.parse(forra.innehall), rena) : [];
  if (forra && !andringar.length) throw new Fel(400, 'Mallen är oförändrad. Ändra något innan den sparas som en ny version.', 'ogiltig', { falt: ['poster'] });
  db.transaction(() => {
    db.query(`INSERT INTO ordinationspaket (id, namn, enhet_id, vardhandelse, beskrivning, innehall, faststallt_av, faststallt, giltigt_till) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, namn, enhet, text(inp.vardhandelse, 80) || null, text(inp.beskrivning, 300) || namn, JSON.stringify(rena), personal.id, iso(), addDagar(idag(), 365));
    if (forra) db.query('INSERT INTO paketversioner (paket_id, ersatter, andring) VALUES (?, ?, ?)').run(id, forra.id, [...andringar, text(inp.andring)].filter(Boolean).join(' '));
  })();
  loggaUtan(db, personal, 'faststalla_mall', `ordinationspaket:${id}`);
  return paketUt(db, db.query('SELECT * FROM ordinationspaket WHERE id = ?').get(id));
}

// Muntlig ordination ------------------------------------------------------------------------------------------------

// Läkarna som kan ha lämnat ordinationen: läkare på samma vårdenhet som får ordinera för patienten. Förslaget ger ingen
// åtkomst som läkaren inte redan har. Först står den läkare som har ordinerat flest av patientens pågående läkemedel på
// vårdenheten, sedan överläkare och specialister, och underläkare sist.
export function muntligaLakare(atk) {
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const antal = new Map();
  for (const o of db.query("SELECT ordinerad_av, enhet_id FROM ordinationer WHERE patient_id = ? AND status = 'aktiv'").all(atk.patientId)) {
    if (vardenhetFor(db, o.enhet_id) === ve) antal.set(o.ordinerad_av, (antal.get(o.ordinerad_av) ?? 0) + 1);
  }
  const rang = (t) => (/överläkare/i.test(t ?? '') ? 0 : /specialist/i.test(t ?? '') ? 1 : /underläkare/i.test(t ?? '') ? 3 : 2);
  return db.query("SELECT * FROM personal WHERE yrke = 'lakare' AND aktiv = 1").all()
    .filter(p => vardenhetFor(db, p.enhet_id) === ve && kanRoll(p, 'ordinera'))
    .sort((a, b) => (antal.get(b.id) ?? 0) - (antal.get(a.id) ?? 0) || rang(a.titel) - rang(b.titel) || a.namn.localeCompare(b.namn, 'sv'))
    .map(p => ({ id: p.id, namn: p.namn, titel: p.titel }));
}

// Runda 8, r4: den muntliga ordination som sjuksköterskan själv dokumenterade senast för patienten, inom tiden då
// läkemedlet får ges utan signering. Läkaren ordinerar ofta flera läkemedel i samma samtal, så systemet föreslår samma
// läkare, sätt och skäl till nästa ordination (Sussas testfall 1.3). Bara en läkare som går att välja nu föreslås.
export function senasteMuntlig(atk, nu = Date.now()) {
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const fran = new Date(nu - stod.MUNTLIG_OMEDELBAR_TIMMAR * 3600_000).toISOString();
  const m = db.query(`SELECT m.*, o.enhet_id FROM muntliga_ordinationer m JOIN ordinationer o ON o.id = m.ordination_id
    WHERE o.patient_id = ? AND m.mottagen_av = ? AND m.mottagen >= ? ORDER BY m.mottagen DESC, m.ordination_id DESC LIMIT 1`).get(atk.patientId, atk.personal.id, fran);
  if (!m || vardenhetFor(db, m.enhet_id) !== ve || !muntligaLakare(atk).some(l => l.id === m.lakare_id)) return null;
  return { lakareId: m.lakare_id, satt: m.satt, omedelbar: m.omedelbar };
}

// POST /api/patient/:id/muntlig-ordination { ...ordination, lakareId, satt, omedelbar, kvitteradeVarningar? }.
// Sjuksköterskan dokumenterar namnet på den som ordinerade och tiden (6 kap. 15 §). Ordinationen får bara lämnas
// muntligt när patienten behöver omedelbar behandling (6 kap. 13 §), så det ska framgå varför.
export function registreraMuntlig(atk, inp = {}) {
  const db = atk.db;
  kravVardande(atk, 'registrera_muntlig_ordination', null, 'muntlig_ordination');
  const lakare = muntligaLakare(atk).find(l => l.id === inp.lakareId);
  if (!lakare) throw new Fel(400, 'Välj läkaren som lämnade ordinationen, en läkare på din vårdenhet.', 'ogiltig', { falt: ['lakareId'], lakare: muntligaLakare(atk) });
  const omedelbar = text(inp.omedelbar);
  if (omedelbar.length < 3) throw new Fel(400, 'En muntlig ordination får bara lämnas när patienten behöver omedelbar behandling. Skriv varför behandlingen inte kan vänta.', 'ogiltig', { falt: ['omedelbar'] });
  const satt = inp.satt === 'telefon' ? 'telefon' : 'muntligt';
  const lm = typeof inp.lakemedelId === 'string' ? katalog(db, inp.lakemedelId) : null;
  // Uppföljningen sätts av systemet till nästa dag, då läkaren har signerat och kan ta ställning till behandlingen.
  const kropp0 = { ...inp, uppfoljningsdatum: giltigtDatum(inp.uppfoljningsdatum) ? inp.uppfoljningsdatum : addDagar(idag(), 1), start: idag() };
  const t = mallar.valideraTillagg(db, kropp0);
  const { kropp, extra } = stod.forbered(db, kropp0);
  const ut = lakemedel.spara(atk, kropp, { handling: 'registrera_muntlig_ordination', ordineradAv: lakare.id, nll: false, nllStatus: 'vantar_signering', historikText: `Ordinerad ${satt === 'telefon' ? 'per telefon' : 'muntligt'} av ${lakare.namn}, dokumenterad av ${atk.personal.namn}` });
  mallar.sparaTillagg(db, ut.ordination.id, t);
  stod.sparaTillagg(db, ut.ordination.id, extra);
  db.query('INSERT INTO muntliga_ordinationer (ordination_id, lakare_id, mottagen_av, mottagen, satt, omedelbar) VALUES (?, ?, ?, ?, ?, ?)')
    .run(ut.ordination.id, lakare.id, atk.personal.id, iso(), satt, omedelbar);
  void lm;
  return { ...ut, ordination: lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, ut.ordination.id)) };
}

// Läkaren signerar sin muntliga ordination. Först då skickas den till NLL.
export function signeraMuntlig(atk, o) {
  const db = atk.db;
  const m = stod.muntligFor(db, o.id);
  if (!m) throw new Fel(404, 'Ordinationen är inte muntlig.', 'saknas');
  kravVardande(atk, 'ordinera', { enhet_id: o.enhet_id, gemensam: true }, `muntlig:${o.id}`);
  if (m.lakare.id !== atk.personal.id) {
    atk.logga('ordinera', 'nekad', `muntlig:${o.id}`, 'nekad');
    throw new Fel(403, `Ordinationen lämnades av ${m.lakare.namn}, och bara den som ordinerade signerar den.`, 'nekad');
  }
  if (m.signerad) throw new Fel(400, 'Ordinationen är redan signerad.', 'ogiltig');
  db.query('UPDATE muntliga_ordinationer SET signerad = ?, signerad_av = ? WHERE ordination_id = ?').run(iso(), atk.personal.id, o.id);
  db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(o.id, iso(), atk.personal.id, 'Muntlig ordination signerad', null);
  const nll = o.status === 'aktiv' && !stod.UTAN_NLL.has(stod.produkttyp(db, o.lakemedel_id).typ) ? lakemedel.overfor(db, o.id, 'ny') : { status: 'ej_aktuell' };
  if (nll.status === 'ej_aktuell') db.query("UPDATE ordinationer SET nll_status = 'ej_aktuell' WHERE id = ?").run(o.id);
  atk.logga('ordinera', atk.grund(), `muntlig:${o.id}:signerad`);
  return { ordination: lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, o.id)), nll };
}

// Läkarens inkorg: muntliga ordinationer som läkaren har lämnat och inte signerat, för patienter som läkaren får se.
export function muntligaAttSignera(db, personal, prova) {
  if (personal.yrke !== 'lakare') return [];
  return db.query('SELECT m.*, o.patient_id, o.enhet_id, o.lakemedel_id, o.dosering FROM muntliga_ordinationer m JOIN ordinationer o ON o.id = m.ordination_id WHERE m.lakare_id = ? AND m.signerad IS NULL ORDER BY m.mottagen').all(personal.id)
    .filter(r => prova(r.patient_id, r.enhet_id))
    .map(r => ({ ordinationId: r.ordination_id, patientId: r.patient_id, lakemedel: katalog(db, r.lakemedel_id)?.namn, dosering: r.dosering, mottagen: r.mottagen, mottagenAv: personNamn(db, r.mottagen_av), satt: r.satt }));
}

// Generella direktiv ------------------------------------------------------------------------------------------------

function direktivUt(db, d) {
  const inn = JSON.parse(d.innehall);
  return { id: d.id, lakemedel: lmKort(katalog(db, d.lakemedel_id)), vardenhet: { id: d.enhet_id, namn: enhetsnamn(db, d.enhet_id) }, ...inn,
    giltigtFran: d.giltigt_fran, giltigtTill: d.giltigt_till, faststalltAv: personNamn(db, d.faststallt_av), faststallt: d.faststallt,
    upphavt: d.upphavt ? { tid: d.upphavt, av: personNamn(db, d.upphavt_av), orsak: d.upphavt_orsak } : null };
}

// Direktiven för användarens vårdenhet (GET /api/direktiv), också upphävda och utgångna så att historiken syns.
export function direktivLista(db, personal) {
  if (!kanRoll(personal, 'ordinera_direktiv') && !kanRoll(personal, 'faststalla_direktiv')) throw new Fel(403, 'Din yrkesroll använder inte generella direktiv.', 'nekad');
  const ve = vardenhetFor(db, personal.enhet_id);
  const rader = db.query('SELECT * FROM generella_direktiv ORDER BY id').all().filter(d => vardenhetFor(db, d.enhet_id) === ve);
  loggaUtan(db, personal, kanRoll(personal, 'faststalla_direktiv') ? 'faststalla_direktiv' : 'ordinera_direktiv', 'generella_direktiv');
  // Runda 6, r6: verksamhetschefen och den medicinskt ansvariga läkaren fastställer, och systemet säger vem det är.
  const f = kanRoll(personal, 'faststalla_direktiv') ? ansvar.faststallaDirektiv(db, personal) : { kan: false, varfor: null };
  return { direktiv: rader.map(d => ({ ...direktivUt(db, d), giltigt: giltigt(d), galler: omfattar(db, d.enhet_id, personal) })), kanFaststalla: f.kan, faststallaText: f.varfor, anmarkning: stod.DEMO_STOD };
}

const KONTRA = ['alder_under', 'alder_fran', 'egfr_under', 'systoliskt_under', 'bekrafta'];
// En läkare fastställer ett direktiv för sin vårdenhet eller en avdelning under den (6 kap. 6 §). Det ska vara
// skriftligt och innehålla läkemedel, dosering, maxdos, administreringssätt, indikation, kontraindikationer och antal
// tillfällen utan läkarkontakt. Det gäller högst ett år och omprövas sedan.
export function faststallDirektiv(db, personal, inp = {}) {
  // Runda 6, r6: verksamhetschefen eller den medicinskt ansvariga läkaren på vårdenheten (Gröna häftet 1.4.2).
  const f = kanRoll(personal, 'faststalla_direktiv') ? ansvar.faststallaDirektiv(db, personal) : { kan: false };
  if (!f.kan) {
    loggaUtan(db, personal, 'faststalla_direktiv', 'generella_direktiv', 'nekad');
    throw new Fel(403, f.varfor ?? 'Generella direktiv fastställs av verksamhetschefen eller den medicinskt ansvariga läkaren (HSLF-FS 2017:37 6 kap. 6 §).', 'nekad');
  }
  const lm = typeof inp.lakemedelId === 'string' ? katalog(db, inp.lakemedelId) : null;
  const enhet = typeof inp.enhetId === 'string' ? inp.enhetId : vardenhetFor(db, personal.enhet_id);
  const e = db.query('SELECT * FROM enheter WHERE id = ?').get(enhet);
  const falt = [];
  if (!lm) falt.push('lakemedelId');
  if (!e || vardenhetFor(db, enhet) !== vardenhetFor(db, personal.enhet_id)) falt.push('enhetId');
  const inn = {
    indikation: text(inp.indikation, 200), dosering: text(inp.dosering), dos: Number(inp.dos), dosEnhet: text(inp.dosEnhet, 20),
    administrationssatt: inp.administrationssatt ?? (lm ? mallar.administrationssatt(lm.form) : null), maxPerDygn: Number(inp.maxPerDygn),
    minstaIntervallTimmar: Number(inp.minstaIntervallTimmar), maxTillfallen: Number(inp.maxTillfallen), maxdosText: text(inp.maxdosText, 200),
    kontraindikationer: Array.isArray(inp.kontraindikationer) ? inp.kontraindikationer.slice(0, 10).filter(k => KONTRA.includes(k?.typ)).map(k => ({ typ: k.typ, text: text(k.text, 200), ...(k.ar != null ? { ar: Number(k.ar) } : {}), ...(k.varde != null ? { varde: Number(k.varde) } : {}) })) : [],
  };
  if (inn.indikation.length < 3) falt.push('indikation');
  if (inn.dosering.length < 3 || !(inn.dos > 0) || !inn.dosEnhet) falt.push('dosering');
  if (lm && !mallar.tillatnaSatt(lm.form).includes(inn.administrationssatt)) falt.push('administrationssatt');
  if (!(inn.maxPerDygn >= 1 && inn.maxPerDygn <= 12)) falt.push('maxPerDygn');
  if (!(inn.minstaIntervallTimmar > 0 && inn.minstaIntervallTimmar <= 48)) falt.push('minstaIntervallTimmar');
  if (!(inn.maxTillfallen >= 1 && inn.maxTillfallen <= 10)) falt.push('maxTillfallen');
  if (!inn.kontraindikationer.length || inn.kontraindikationer.some(k => k.text.length < 3)) falt.push('kontraindikationer');
  const till = inp.giltigtTill ?? addDagar(idag(), 365);
  if (!giltigtDatum(till) || till < idag() || till > addDagar(idag(), 365)) falt.push('giltigtTill');
  if (falt.length) throw new Fel(400, 'Ett generellt direktiv ska vara skriftligt och innehålla läkemedel, dosering, maxdos, administreringssätt, indikation, kontraindikationer och antal tillfällen utan läkarkontakt, och gäller högst ett år innan det omprövas. Kontrollera det som är markerat.', 'ogiltig', { falt });
  // Doseringstexten säger maxdos och intervall, så att administreringens regler för vid behov gäller av sig själv.
  if (!/högst \d+ gånger per dygn/.test(inn.dosering)) inn.dosering = `${inn.dosering.replace(/\.$/, '')}, högst ${inn.maxPerDygn} gånger per dygn`;
  const r = db.query('INSERT INTO generella_direktiv (enhet_id, lakemedel_id, innehall, giltigt_fran, giltigt_till, faststallt_av, faststallt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(enhet, lm.id, JSON.stringify(inn), idag(), till, personal.id, iso());
  loggaUtan(db, personal, 'faststalla_direktiv', `generellt_direktiv:${r.lastInsertRowid}`);
  return direktivUt(db, db.query('SELECT * FROM generella_direktiv WHERE id = ?').get(Number(r.lastInsertRowid)));
}

export function upphavDirektiv(db, personal, id, { orsak } = {}) {
  const f = kanRoll(personal, 'faststalla_direktiv') ? ansvar.faststallaDirektiv(db, personal) : { kan: false };
  if (!f.kan) {
    loggaUtan(db, personal, 'faststalla_direktiv', `generellt_direktiv:${id}`, 'nekad');
    throw new Fel(403, f.varfor ?? 'Ett generellt direktiv upphävs av verksamhetschefen eller den medicinskt ansvariga läkaren.', 'nekad');
  }
  const d = db.query('SELECT * FROM generella_direktiv WHERE id = ?').get(Number(id));
  if (!d || vardenhetFor(db, d.enhet_id) !== vardenhetFor(db, personal.enhet_id)) throw new Fel(404, 'Direktivet finns inte på din vårdenhet.', 'saknas');
  if (d.upphavt) throw new Fel(400, 'Direktivet är redan upphävt.', 'ogiltig');
  const o = text(orsak);
  if (o.length < 3) throw new Fel(400, 'Ange varför direktivet upphävs.', 'ogiltig', { falt: ['orsak'] });
  db.query('UPDATE generella_direktiv SET upphavt = ?, upphavt_av = ?, upphavt_orsak = ? WHERE id = ?').run(iso(), personal.id, o, d.id);
  loggaUtan(db, personal, 'faststalla_direktiv', `generellt_direktiv:${d.id}:upphavt`);
  return direktivUt(db, db.query('SELECT * FROM generella_direktiv WHERE id = ?').get(d.id));
}

// Senaste systoliska blodtrycket det senaste dygnet som användaren får se.
function systoliskt(atk) {
  const t = new Date(Date.now() - 86400_000).toISOString();
  const rader = atk.filtrera(atk.db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ = 'blodtryck' AND tid >= ? ORDER BY tid DESC").all(atk.patientId, t), 'las_matvarden');
  return rader[0] ? Number(String(rader[0].varde).split('/')[0]) : null;
}

// Prövar direktivet mot patienten. Ger { ryms, varfor: [...], bekrafta: [...] }: varfor är det som gör att direktivet
// inte går att använda, bekrafta det som sjuksköterskan själv ska kontrollera.
function provaRamar(atk, d) {
  const db = atk.db;
  const inn = JSON.parse(d.innehall);
  const lm = katalog(db, d.lakemedel_id);
  const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const ar = pat ? alder(pat.fodd, idag()) : null;
  const u = lakemedel.underlag(atk);
  const varfor = [];
  if (!giltigt(d)) varfor.push(d.upphavt ? 'Direktivet är upphävt.' : `Direktivet gällde till och med ${d.giltigt_till} och behöver omprövas av läkaren.`);
  for (const k of inn.kontraindikationer) {
    if (k.typ === 'alder_under' && ar != null && ar < k.ar) varfor.push(`Patienten är ${ar} år. Direktivet gäller inte under ${k.ar} år.`);
    if (k.typ === 'alder_fran' && ar != null && ar >= k.ar) varfor.push(`Patienten är ${ar} år. Direktivet gäller inte från ${k.ar} år.`);
    if (k.typ === 'egfr_under' && u.egfr != null && u.egfr < k.varde) varfor.push(`eGFR är ${u.egfr}. Direktivet gäller inte under ${k.varde}.`);
    if (k.typ === 'systoliskt_under') {
      const s = systoliskt(atk);
      if (s == null) varfor.push('Blodtrycket är inte mätt det senaste dygnet. Mät blodtrycket först.');
      else if (s < k.varde) varfor.push(`Systoliskt blodtryck är ${s} mmHg. Direktivet gäller inte under ${k.varde} mmHg.`);
    }
  }
  // Samma kontroller som vid annan ordination. En allvarlig varning betyder att läkaren ska ordinera.
  for (const v of lakemedel.varningar(db, atk.patientId, lm, u.aktiva, u).filter(x => x.niva === 'allvarlig')) {
    varfor.push(v.regel === 'dubbel_substans' ? `${v.text} Ge enligt den ordinationen.` : `${v.text} Kontakta läkaren.`);
  }
  return { ryms: varfor.length === 0, varfor, bekrafta: inn.kontraindikationer.filter(k => k.typ === 'bekrafta').map(k => k.text) };
}

// GET /api/patient/:id/direktiv: direktiven som gäller där sjuksköterskan arbetar, prövade mot patienten.
export function direktivForPatient(atk) {
  atk.krav('las_lakemedel');
  const db = atk.db;
  if (!kanRoll(atk.personal, 'ordinera_direktiv')) return { direktiv: [], kan: { kan: false, varfor: null } };
  const rader = db.query('SELECT * FROM generella_direktiv ORDER BY id').all().filter(d => omfattar(db, d.enhet_id, atk.personal) && !d.upphavt && d.giltigt_till >= idag());
  return {
    direktiv: rader.map(d => ({ ...direktivUt(db, d), ...provaRamar(atk, d), bedomningForslag: `Patienten har ${JSON.parse(d.innehall).indikation.toLowerCase()}, bedömt av ${atk.personal.namn}.` })),
    demoregler: true, anmarkning: stod.DEMO_STOD,
  };
}

// POST /api/patient/:id/direktiv/:did { bedomning, bekraftade: [text], kvitteradeVarningar? }. Sjuksköterskan gör en
// bedömning av patientens behov och kontrollerar indikation och kontraindikationer (6 kap. 7 §). Ordinationen gäller
// till och med i morgon, med direktivets dosering, och följs upp i morgon.
export function ordineraEnligtDirektiv(atk, did, inp = {}) {
  const db = atk.db;
  kravVardande(atk, 'ordinera_direktiv', null, `generellt_direktiv:${did}`);
  const d = db.query('SELECT * FROM generella_direktiv WHERE id = ?').get(Number(did));
  if (!d || !omfattar(db, d.enhet_id, atk.personal)) {
    atk.logga('ordinera_direktiv', 'nekad', `generellt_direktiv:${did}`, 'nekad');
    throw new Fel(404, 'Direktivet gäller inte på din vårdenhet.', 'saknas');
  }
  const p = provaRamar(atk, d);
  if (!p.ryms) throw new Fel(400, `Direktivet kan inte användas för patienten. ${p.varfor.join(' ')}`, 'ogiltig', { varfor: p.varfor });
  const bekraftade = Array.isArray(inp.bekraftade) ? inp.bekraftade.map(String) : [];
  const saknas = p.bekrafta.filter(t => !bekraftade.includes(t));
  if (saknas.length) throw new Fel(400, `Kontrollera och bekräfta att patienten inte har: ${saknas.join(', ').toLowerCase()}.`, 'ogiltig', { falt: ['bekraftade'], bekrafta: saknas });
  const bedomning = text(inp.bedomning, 500);
  if (bedomning.length < 3) throw new Fel(400, 'Skriv din bedömning av patientens behov av läkemedlet. Den dokumenteras i journalen.', 'ogiltig', { falt: ['bedomning'] });
  const inn = JSON.parse(d.innehall);
  const kropp0 = {
    lakemedelId: d.lakemedel_id, dosering: inn.dosering, dos: inn.dos, dosEnhet: inn.dosEnhet, tider: [], typ: 'vid_behov', vidBehov: true,
    ordinationsorsak: `Enligt generellt direktiv: ${inn.indikation}`, uppfoljningsdatum: addDagar(idag(), 1), start: idag(), slut: addDagar(idag(), 1),
    administrationssatt: inn.administrationssatt, kvitteradeVarningar: inp.kvitteradeVarningar,
    ...(inn.spadning ? { spadning: { losning: inn.spadning.losning, volymMl: inn.dos / inn.spadning.koncentration } } : {}),
  };
  const t = mallar.valideraTillagg(db, kropp0);
  const { kropp, extra } = stod.forbered(db, kropp0);
  const ut = lakemedel.spara(atk, kropp, { handling: 'ordinera_direktiv', historikText: `Ordinerad enligt generellt direktiv av ${atk.personal.namn}` });
  mallar.sparaTillagg(db, ut.ordination.id, t);
  stod.sparaTillagg(db, ut.ordination.id, extra);
  db.query('INSERT INTO direktivordinationer (ordination_id, direktiv_id, bedomning, bekraftade) VALUES (?, ?, ?, ?)').run(ut.ordination.id, d.id, bedomning, JSON.stringify(p.bekrafta));
  return { ...ut, ordination: lakemedel.ordinationUt(db, lakemedel.hamtaRad(db, ut.ordination.id)) };
}
