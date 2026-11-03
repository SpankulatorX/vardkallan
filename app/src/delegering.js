// Delegering av iordningställande, administrering och överlämnande av läkemedel (HSLF-FS 2017:37 9 kap., i lydelsen
// från HSLF-FS 2025:6 som gäller från 2026-01-01). En undersköterska får ge läkemedel bara med ett giltigt
// delegeringsbeslut, och systemet prövar själv att beslutet gäller just den dosen: läkemedelsform och
// administrationssätt, datum och vårdenhet. Den som inte omfattas får en förklaring på vanlig svenska och ser ingen
// knapp för att ge dosen.
//
// Föreskriften, som den citeras här:
//   2 § "Endast läkare, tandläkare och sjuksköterskor får delegera iordningställande, administrering och överlämnande
//       av läkemedel till någon annan." I demon registrerar en sjuksköterska på samma vårdenhet.
//   3 och 4 §§ mottagaren ska ha dokumenterade kunskaper och den som delegerar ska kontrollera dem. Systemet kräver att
//       sjuksköterskan intygar kontrollen.
//   5 § "Delegeringsbeslutet ska vara tidsbegränsat." Beslutet är personligt och gäller en viss verksamhet.
//   6 § beslutet ska följas upp minst en gång per år och återkallas när det inte längre är förenligt med god och säker
//       vård. I demon gäller ett beslut därför högst ett år, och uppföljningen sätts till sista giltighetsdagen.
//   7 § beslutet ska vara skriftligt och innehålla vad som delegeras, för vilken verksamhet, vem som delegerat, till vem,
//       när det ska följas upp, giltighetstiden och datum då beslutet fattades. Alla sju uppgifterna sparas.
// Gränsen på ett år och vilka former som går att delegera är demoregler, inte en vårdgivares rutin enligt 8 och 9 §§.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder } from './atkomst.js';
import { loggaRad } from './logg.js';
import { administrationssatt as sattUrForm, tillatnaSatt } from './ordinationsmallar.js';
import { datumI } from './lakemedelsprocess.js';

export const FORESKRIFT = 'HSLF-FS 2017:37 9 kap.';
export const DEMOREGLER_DELEGERING = 'Vilka läkemedelsformer som kan delegeras och att ett beslut gäller högst ett år är demoregler. En vårdgivare fastställer sina egna rutiner för delegering efter en riskanalys (HSLF-FS 2017:37 9 kap. 8 och 9 §§).';
export const PAMINN_DAGAR = 30;
// Så långt fram kan ett beslut börja gälla.
export const START_SENAST_DAGAR = 30;

// Det som kan delegeras, med texten som visas. Nyckeln räknas fram ur dosens läkemedelsform och administrationssätt.
export const OMFATTNING = {
  tabletter_peroralt: { text: 'Tabletter och kapslar som sväljs', dos: 'en tablett eller kapsel som sväljs' },
  insulin_subkutant: { text: 'Insulin under huden', dos: 'insulin som ges under huden' },
  injektion_subkutant: { text: 'Andra injektioner under huden, till exempel blodförtunnande', dos: 'en injektion under huden' },
  inhalation: { text: 'Inhalationer', dos: 'en inhalation' },
  sublingualt: { text: 'Läkemedel under tungan', dos: 'ett läkemedel under tungan' },
};
// Det som systemet föreslår när någon får sin första delegering: det vanligaste.
export const STANDARD_OMFATTNING = ['tabletter_peroralt'];
const SATT_TEXT = { intravenost: 'ges i blodet (intravenöst)', intramuskulart: 'ges i en muskel', peroralt: 'sväljs men är inte en tablett eller kapsel' };

const personRad = (db, id) => (id ? db.query('SELECT * FROM personal WHERE id = ?').get(id) : null);
const personNamn = (db, id) => personRad(db, id)?.namn ?? id;
const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const omfattningText = (lista) => lista.map(k => OMFATTNING[k]?.text ?? k);
const listaText = (delar) => (delar.length < 2 ? delar.join('') : `${delar.slice(0, -1).join(', ')} och ${delar[delar.length - 1]}`).toLowerCase();
// Samma datum ett år senare: den längsta giltighetstiden.
export const ettAr = (datum) => {
  const [y, m, d] = datum.split('-').map(Number);
  const t = new Date(Date.UTC(y + 1, m - 1, d));
  return t.getUTCMonth() === m - 1 ? t.toISOString().slice(0, 10) : `${y + 1}-02-28`;
};

// Vilken delegering en dos kräver, ur läkemedlet och ordinationens administrationssätt. null betyder att dosen inte kan
// ges med delegering i demon (till exempel intravenöst).
// Kategorin bestäms av läkemedelsformen i NPL. Ordinationens administrationssätt räknas bara när det passar formen, och
// då bara för att skilja en injektion under huden från en i blodet eller en muskel. En injektionsvätska blir alltså
// aldrig "under tungan", hur den än har ordinerats (säkerhetsgranskningen av runda 5).
export function kategoriFor(lm, satt = null) {
  const form = lm?.form ?? '';
  const tillatna = tillatnaSatt(form);
  const s = satt && tillatna.includes(satt) ? satt : sattUrForm(form);
  if (/sublingual/i.test(form)) return 'sublingualt';
  if (/inhalation/i.test(form)) return 'inhalation';
  if (/injektion|infusion/i.test(form)) return s === 'subkutant' ? ((lm?.atc ?? '').startsWith('A10A') ? 'insulin_subkutant' : 'injektion_subkutant') : null;
  if (/tablett|kapsel/i.test(form)) return 'tabletter_peroralt';
  return null;
}

export function delegeringUt(db, d) {
  const omf = JSON.parse(d.omfattning);
  const dag = idag();
  return {
    id: d.id, personal: { id: d.personal_id, namn: personNamn(db, d.personal_id) }, vardenhet: enhetKort(db, d.vardenhet_id),
    omfattning: omf, omfattningText: omfattningText(omf), fran: d.fran, till: d.till, uppfoljning: d.uppfoljning,
    utfardadAv: { id: d.utfardad_av, namn: personNamn(db, d.utfardad_av) }, beslutad: d.beslutad, kunskapKontrollerad: Boolean(d.kunskap_kontrollerad),
    aterkallad: d.aterkallad_tid ? { tid: d.aterkallad_tid, av: personNamn(db, d.aterkallad_av), orsak: d.aterkallad_orsak } : null,
    status: d.aterkallad_tid ? 'aterkallad' : d.till < dag ? 'utgangen' : d.fran > dag ? 'kommande' : 'giltig',
    dagarKvar: Math.round((Date.parse(d.till) - Date.parse(dag)) / 86400_000),
  };
}
// Den korta formen i en dos: vem som utfärdade beslutet och vad och hur länge det gäller.
export function delegeringKort(db, id) {
  const d = id ? db.query('SELECT * FROM delegeringar WHERE id = ?').get(id) : null;
  if (!d) return null;
  const omf = JSON.parse(d.omfattning);
  return { id: d.id, utfardadAv: personNamn(db, d.utfardad_av), fran: d.fran, till: d.till, omfattningText: omfattningText(omf).join(', '), foreskrift: FORESKRIFT };
}

const giltigPa = (d, dag, ve) => !d.aterkallad_tid && d.fran <= dag && d.till >= dag && d.vardenhet_id === ve;

// Har personen ett giltigt delegeringsbeslut på sin vårdenhet i dag? Med en förklaring när det saknas.
export function giltigNu(db, personal, dag = idag()) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const alla = db.query('SELECT * FROM delegeringar WHERE personal_id = ? ORDER BY till DESC, id DESC').all(personal.id);
  const giltiga = alla.filter(d => giltigPa(d, dag, ve));
  if (giltiga.length) return { giltig: true, delegeringar: giltiga, varfor: null };
  return { giltig: false, delegeringar: [], varfor: utanGiltig(db, personal, alla, dag, ve, true) };
}

// Sammanfattningen som undersköterskan ser överst i Läkemedel att ge: vad hon får ge och hur länge.
export function sammanfattning(db, personal) {
  const g = giltigNu(db, personal);
  if (!g.giltig) return { giltig: false, varfor: g.varfor };
  const omf = [...new Set(g.delegeringar.flatMap(d => JSON.parse(d.omfattning)))];
  return { giltig: true, omfattning: listaText(omfattningText(omf)), till: g.delegeringar.map(d => d.till).sort().at(-1), varfor: null };
}

// Varför det inte finns något giltigt beslut den dagen: saknas, återkallat, utgånget, kommande eller annan vårdenhet.
function utanGiltig(db, personal, alla, dag, ve, du) {
  const vem = du ? 'Du' : personal.namn;
  const sjukskoterska = 'En sjuksköterska på vårdenheten kan registrera en ny delegering.';
  if (!alla.length) return `${vem} har ingen delegering att ge läkemedel. ${sjukskoterska}`;
  const har = alla.filter(d => d.vardenhet_id === ve);
  if (!har.length) {
    const annan = alla[0];
    return `Delegeringen för ${personal.namn} gäller ${enhetKort(db, annan.vardenhet_id)?.namn}, inte den vårdenhet ${du ? 'du' : 'personen'} är inloggad på. Ett delegeringsbeslut gäller en viss verksamhet.`;
  }
  const aterkallad = har.find(d => d.aterkallad_tid && d.fran <= dag && d.till >= dag);
  if (aterkallad) return `Delegeringen för ${personal.namn} återkallades ${aterkallad.aterkallad_tid.slice(0, 10)} av ${personNamn(db, aterkallad.aterkallad_av)}. ${sjukskoterska}`;
  const kommande = har.filter(d => !d.aterkallad_tid && d.fran > dag).sort((a, b) => a.fran.localeCompare(b.fran))[0];
  if (kommande) return `Delegeringen för ${personal.namn} börjar gälla ${kommande.fran}.`;
  const senaste = har.filter(d => !d.aterkallad_tid && d.till < dag).sort((a, b) => b.till.localeCompare(a.till))[0];
  if (senaste) return `Delegeringen för ${personal.namn} gällde till och med ${senaste.till}. ${sjukskoterska}`;
  return `${vem} har ingen giltig delegering att ge läkemedel. ${sjukskoterska}`;
}

// Prövar om personen får ge dosen med delegering. Bara undersköterskor behöver en delegering. underlag:
//   lm          läkemedlet (katalogens rad)
//   satt        ordinationens administrationssätt, annars räknas det ur läkemedelsformen
//   ms          när dosen ges eller gavs
//   ordination  ordinationen, eller null för en dos utan ordination
//   du          true när personen själv är inloggad, för texten
// Returnerar { kravs, omfattas, delegering, varfor }.
export function prova(db, personal, { lm, satt = null, ms = Date.now(), ordination = null, du = true }) {
  if (personal?.yrke !== 'underskoterska') return { kravs: false, omfattas: true, delegering: null, varfor: null };
  if (!ordination) return { kravs: true, omfattas: false, delegering: null, varfor: 'En dos utan ordination kan inte ges med delegering. Be en sjuksköterska eller läkare.' };
  const dag = datumI(ms);
  const ve = vardenhetFor(db, personal.enhet_id);
  const alla = db.query('SELECT * FROM delegeringar WHERE personal_id = ? ORDER BY till DESC, id DESC').all(personal.id);
  const giltiga = alla.filter(d => giltigPa(d, dag, ve));
  if (!giltiga.length) return { kravs: true, omfattas: false, delegering: null, varfor: utanGiltig(db, personal, alla, dag, ve, du) };
  const kat = kategoriFor(lm, satt);
  const traff = kat && giltiga.find(d => JSON.parse(d.omfattning).includes(kat));
  if (traff) return { kravs: true, omfattas: true, delegering: delegeringKort(db, traff.id), varfor: null };
  const omf = [...new Set(giltiga.flatMap(d => JSON.parse(d.omfattning)))];
  const s = satt ?? sattUrForm(lm?.form ?? '');
  const vad = kat ? OMFATTNING[kat].dos : SATT_TEXT[s] ? `ett läkemedel som ${SATT_TEXT[s]}` : 'ett läkemedel som inte kan ges med delegering här';
  return {
    kravs: true, omfattas: false, delegering: null,
    varfor: `${du ? 'Din delegering' : `Delegeringen för ${personal.namn}`} omfattar ${listaText(omfattningText(omf))}. ${lm?.namn} är ${vad}, som inte ingår. En sjuksköterska ger dosen.`,
  };
}

// Personal som kan få delegering av en sjuksköterska: undersköterskorna på samma vårdenhet.
function mottagare(db, ve) {
  const enheter = enheterUnder(db, ve);
  return db.query(`SELECT * FROM personal WHERE yrke = 'underskoterska' AND coalesce(aktiv, 1) = 1 AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY namn`).all(...enheter);
}

// GET /api/delegeringar. Sjuksköterskan ser undersköterskorna på sin vårdenhet med deras beslut och ett förslag på nästa,
// undersköterskan ser sina egna beslut. Inga andra vårdenheters personal visas.
export function oversikt(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  const bas = { vardenhet: enhetKort(db, ve), foreskrift: FORESKRIFT, demoregler: DEMOREGLER_DELEGERING, omfattningar: Object.entries(OMFATTNING).map(([id, o]) => ({ id, text: o.text })) };
  const beslut = (id) => db.query('SELECT * FROM delegeringar WHERE personal_id = ? AND vardenhet_id = ? ORDER BY till DESC, id DESC').all(id, ve).map(d => delegeringUt(db, d));
  if (kanRoll(personal, 'delegera')) {
    const dag = idag();
    return {
      ...bas, kan: true,
      personal: mottagare(db, ve).map(p => {
        const lista = beslut(p.id);
        const giltig = lista.filter(d => d.status === 'giltig').sort((a, b) => b.till.localeCompare(a.till))[0] ?? null;
        return {
          id: p.id, namn: p.namn, titel: p.titel, yrke: p.yrke, enhet: enhetKort(db, p.enhet_id), giltig, delegeringar: lista,
          forslag: { omfattning: giltig?.omfattning ?? lista[0]?.omfattning ?? STANDARD_OMFATTNING, fran: dag, franSenast: addDagar(dag, START_SENAST_DAGAR), till: addDagar(dag, 365), senast: ettAr(dag) },
        };
      }),
    };
  }
  if (personal.yrke === 'underskoterska') return { ...bas, kan: false, egna: beslut(personal.id) };
  throw new Fel(403, 'Din yrkesroll har inte behörighet till delegeringar.', 'nekad');
}

const nekad = (db, personal, resurs) => {
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: null, handling: 'delegera', resurs, grund: 'nekad', resultat: 'nekad' });
  return new Fel(403, 'Bara en sjuksköterska kan registrera och återkalla delegering av läkemedelshantering här (HSLF-FS 2017:37 9 kap. 2 §).', 'nekad');
};

// POST /api/delegeringar. inp: { personalId, omfattning, fran, till, kunskapKontrollerad }. Giltighetstid och uppföljning
// fylls i av systemet: från i dag, ett år, uppföljning sista giltighetsdagen.
export function registrera(db, personal, inp = {}) {
  if (!kanRoll(personal, 'delegera')) throw nekad(db, personal, 'delegering:ny');
  const ve = vardenhetFor(db, personal.enhet_id);
  const p = typeof inp.personalId === 'string' ? personRad(db, inp.personalId) : null;
  if (!p || p.aktiv === 0) throw new Fel(400, 'Välj den som ska få delegeringen.', 'ogiltig', { falt: ['personalId'] });
  if (p.yrke !== 'underskoterska') throw new Fel(400, `${p.namn} är ${p.yrke === 'lakare' ? 'läkare' : p.yrke === 'sjukskoterska' ? 'sjuksköterska' : 'inte undersköterska'} och behöver ingen delegering för att ge läkemedel. I demon kan undersköterskor få delegering.`, 'ogiltig', { falt: ['personalId'] });
  if (vardenhetFor(db, p.enhet_id) !== ve) throw new Fel(400, `${p.namn} arbetar inte på samma vårdenhet som du. En delegering registreras av en sjuksköterska på samma vårdenhet och gäller den verksamheten.`, 'ogiltig', { falt: ['personalId'] });
  const falt = [];
  const omf = Array.isArray(inp.omfattning) ? [...new Set(inp.omfattning)] : [];
  if (!omf.length || omf.some(k => !Object.hasOwn(OMFATTNING, k))) falt.push('omfattning');
  const dag = idag();
  // Beslutet gäller från i dag eller högst 30 dagar fram, och till högst ett år efter beslutsdagen, så att ingen
  // registrerar ett beslut långt fram och uppföljningen alltid kommer inom ett år från beslutet (9 kap. 6 §).
  const fran = inp.fran ?? dag;
  if (!giltigtDatum(fran) || fran < dag || fran > addDagar(dag, START_SENAST_DAGAR)) falt.push('fran');
  const till = inp.till ?? addDagar(dag, 365);
  if (!giltigtDatum(till) || till > ettAr(dag) || (giltigtDatum(fran) && till < fran)) falt.push('till');
  if (inp.kunskapKontrollerad !== true) falt.push('kunskapKontrollerad');
  if (falt.length) {
    const namn = {
      omfattning: 'vad delegeringen omfattar', fran: `från vilken dag den gäller (i dag eller högst ${START_SENAST_DAGAR} dagar fram)`, till: 'till vilken dag den gäller (högst ett år från i dag)',
      kunskapKontrollerad: `att du har kontrollerat att ${p.namn} har de kunskaper och den kompetens som uppgiften kräver`,
    };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.`, 'ogiltig', { falt });
  }
  const r = db.query(`INSERT INTO delegeringar (personal_id, vardenhet_id, omfattning, fran, till, uppfoljning, utfardad_av, beslutad, kunskap_kontrollerad)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(p.id, ve, JSON.stringify(omf), fran, till, till, personal.id, iso());
  const id = Number(r.lastInsertRowid);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: null, handling: 'delegera', resurs: `delegering:${id}`, grund: 'administrativ', resultat: 'tillaten' });
  return delegeringUt(db, db.query('SELECT * FROM delegeringar WHERE id = ?').get(id));
}

// POST /api/delegering/:id/aterkalla. inp: { orsak }. Beslutet finns kvar och visar vem som återkallade det och varför.
export function aterkalla(db, personal, id, inp = {}) {
  if (!kanRoll(personal, 'delegera')) throw nekad(db, personal, `delegering:${id}`);
  const d = db.query('SELECT * FROM delegeringar WHERE id = ?').get(Number(id));
  if (!d || d.vardenhet_id !== vardenhetFor(db, personal.enhet_id)) throw nekad(db, personal, `delegering:${id}`);
  if (d.aterkallad_tid) throw new Fel(400, 'Delegeringen är redan återkallad.', 'ogiltig');
  const orsak = typeof inp.orsak === 'string' ? inp.orsak.trim().slice(0, 300) : '';
  if (orsak.length < 3) throw new Fel(400, 'Ange varför delegeringen återkallas.', 'ogiltig', { falt: ['orsak'] });
  db.query('UPDATE delegeringar SET aterkallad_tid = ?, aterkallad_av = ?, aterkallad_orsak = ? WHERE id = ?').run(iso(), personal.id, orsak, d.id);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: null, handling: 'delegera', resurs: `delegering:${d.id}:aterkallad`, grund: 'administrativ', resultat: 'tillaten' });
  return delegeringUt(db, db.query('SELECT * FROM delegeringar WHERE id = ?').get(d.id));
}

// Påminnelser i sjuksköterskans inkorg: undersköterskor på vårdenheten vars sista giltiga delegering går ut inom 30
// dagar. En delegering som redan är förnyad (ett beslut som gäller längre) ger ingen påminnelse.
export function paminnelser(db, personal) {
  if (!kanRoll(personal, 'delegera')) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  const dag = idag();
  const ut = [];
  for (const p of mottagare(db, ve)) {
    // Kedjan börjar i de beslut som gäller i dag. Ett senare beslut förlänger den bara om det tar vid utan glapp.
    const aktuella = db.query('SELECT * FROM delegeringar WHERE personal_id = ? AND vardenhet_id = ? AND aterkallad_tid IS NULL AND till >= ? ORDER BY fran, id').all(p.id, ve, dag);
    const idag_ = aktuella.filter(d => d.fran <= dag);
    if (!idag_.length) continue;
    let sista = idag_.reduce((a, b) => (b.till > a.till ? b : a));
    for (let langre = true; langre;) {
      langre = false;
      for (const d of aktuella) if (d.fran <= addDagar(sista.till, 1) && d.till > sista.till) { sista = d; langre = true; }
    }
    const kvar = Math.round((Date.parse(sista.till) - Date.parse(dag)) / 86400_000);
    if (kvar > PAMINN_DAGAR) continue;
    ut.push({
      personalId: p.id, namn: p.namn, delegeringId: sista.id, till: sista.till, dagarKvar: kvar,
      text: `Delegeringen att ge läkemedel går ut ${kvar === 0 ? 'i dag' : kvar === 1 ? 'i morgon' : `om ${kvar} dagar`}, ${sista.till}. Följ upp den och registrera en ny om ${p.namn} ska fortsätta ge läkemedel.`,
    });
  }
  return ut;
}
