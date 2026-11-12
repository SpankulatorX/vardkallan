// Psykiatrisk tvångsvård och rättspsykiatrisk vård (Sussa 3.2.3.1 till 3.2.3.4): tvångsvårdsperioder med en
// sammanhållen beslutsjournal, frister, tvångsåtgärder, bevakning och uppföljning på enhetsnivå.
//
// Systemet är experten. Läkaren registrerar det som har hänt (vårdintyg, beslut, ansökan, tvångsåtgärd) med ett klick,
// och systemet räknar alla frister ur lagen, varnar före dem, säger vad lagen kräver med paragraf och föreslår nästa
// steg (tvangsvard-regler.js). Systemet väljer själv den psykiatriska vårdenhet som vårdintyget skickas till, räknar
// ankomsten från när patienten kom till sjukhuset, prövar att den som beslutar får göra det (6 b och 39 §§) och skriver
// in patienten när intagningen är beslutad.
//
// Behörighet. Uppgifterna hör till den psykiatriska vårdenheten och har inre sekretess och spärr som all annan
// information därifrån: en annan vårdenhet ser dem bara efter aktivt val, och en spärrad vårdenhets uppgifter visas
// inte alls, och inget talar om att de finns. Bara läkare registrerar, och beslut som lagen lägger på chefsöverläkaren
// kräver chefsöverläkaren eller dennes uppdrag enligt 39 § (simulerat i demon). Nödåtkomst ger bara läsning. Varje
// åtkomst loggas på patienten, och nekade försök loggas som nekade.
//
// Händelserna och perioderna ändras och raderas aldrig (databastriggrar). Läget räknas fram ur händelserna varje gång.
import { Fel, iso, idag, addDagar, lokalTid, datumAv } from './db.js';
import { kanRoll, vardenhetFor, harVardrelation, visningsnamn, visningsPnr } from './atkomst.js';
import * as vardkontakt from './vardkontakt.js';
import { lage, provaIntagning, TYPER, ATGARDER, LAGAR, tidText } from './tvangsvard-regler.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS tvangsvard_perioder (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, skapad TEXT NOT NULL, skapad_av TEXT
);
CREATE TABLE IF NOT EXISTS tvangsvard_handelser (
  id INTEGER PRIMARY KEY, period_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL,
  tid TEXT NOT NULL, registrerad TEXT NOT NULL, av TEXT NOT NULL, registrerad_pa TEXT, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS tv_period_andras_ej BEFORE UPDATE ON tvangsvard_perioder BEGIN SELECT RAISE(ABORT, 'En tvångsvårdsperiod ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS tv_period_raderas_ej BEFORE DELETE ON tvangsvard_perioder BEGIN SELECT RAISE(ABORT, 'En tvångsvårdsperiod raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS tv_handelse_andras_ej BEFORE UPDATE ON tvangsvard_handelser BEGIN SELECT RAISE(ABORT, 'Beslutsjournalen ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS tv_handelse_raderas_ej BEFORE DELETE ON tvangsvard_handelser BEGIN SELECT RAISE(ABORT, 'Beslutsjournalen raderas inte'); END;
`;
export const sakraSchema = (db) => db.exec(SCHEMA);

// De psykiatriska vårdenheterna i demon, och läkarna med chefsöverläkarens uppdrag enligt 39 § (simulerat).
export const PSYKIATRI = ['uso-psyk'];
export const UPPDRAG = {
  'lak-psyk': 'Erfaren läkare med specialistkompetens i psykiatri och chefsöverläkarens uppdrag enligt 39 § (simulerat i demon)',
};
export const arPsykiatri = (db, personal) => Boolean(personal && PSYKIATRI.includes(vardenhetFor(db, personal.enhet_id)));
export const harUppdrag = (db, personal) => Boolean(UPPDRAG[personal?.id]) && arPsykiatri(db, personal);

const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const text = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const parse = (h) => ({ ...h, detalj: h.detalj ? JSON.parse(h.detalj) : {} });

const handelser = (db, periodId) => db.query('SELECT * FROM tvangsvard_handelser WHERE period_id = ? ORDER BY tid, id').all(periodId).map(parse);
const perioder = (db, patientId) => db.query('SELECT * FROM tvangsvard_perioder WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(patientId);
const patientRad = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);

// Läget för en period. harVardplan kommer från vardplan.js (16 §) och ges in av den som anropar.
export function periodLage(db, period, { nu = Date.now(), harVardplan = false } = {}) {
  const hs = handelser(db, period.id);
  return { hs, l: lage(hs, { nu, fodd: patientRad(db, period.patient_id)?.fodd ?? null, harVardplan }) };
}

// Perioderna som användaren får se. Uppgifterna hör till periodens vårdenhet, med inre sekretess och spärr.
export function synligaPerioder(atk) {
  if (!kanRoll(atk.personal, 'las_tvangsvard')) return [];
  return atk.filtrera(perioder(atk.db, atk.patientId), 'las_tvangsvard');
}

const FALT_BEKRAFTA = (t) => [{ namn: 'bekraftelse', typ: 'kryss', etikett: t, obligatorisk: true }];
// Nästa steg som systemet föreslår för en period, med fälten som behövs. Bara det som användaren får göra.
function nasta(db, personal, period, l, { harSamordnadVardplan = false } = {}) {
  const egen = vardenhetFor(db, personal.enhet_id) === period.enhet_id;
  if (!kanRoll(personal, 'tvangsvard') || !egen || l.status === 'upphord') return [];
  const upp = harUppdrag(db, personal);
  const ut = [];
  const steg = (typ, knapp, extra = {}) => ut.push({ typ, knapp, rubrik: extra.rubrik ?? knapp, paragraf: extra.paragraf ?? TYPER[typ]?.paragraf ?? null, falt: [], ...extra });
  if (l.status === 'vantar') {
    const p = provaIntagning(l, { beslutare: personal.id, harUppdrag: upp });
    const frivillig = l.vardintyg?.frivillig;
    if (upp) {
      steg(frivillig ? 'overgang11' : 'intagning', frivillig ? 'Besluta om tvångsvård' : 'Besluta om intagning', {
        primar: true, kontroller: p.kontroller, kan: p.ok, paragraf: frivillig ? '11 §' : '6 b §',
        falt: FALT_BEKRAFTA(frivillig
          ? 'Jag har undersökt patienten. Förutsättningarna för sluten tvångsvård i 3 § är uppfyllda, och patienten kan till följd av sin psykiska störning befaras allvarligt skada sig själv eller någon annan (11 §).'
          : 'Jag har undersökt patienten och bedömer att förutsättningarna för sluten psykiatrisk tvångsvård i 3 § är uppfyllda.'),
      });
    }
    if (!l.ankomst && !frivillig) steg('ankomst', 'Patienten har kommit', { forklaring: 'Fristen för beslutet om intagning räknas från ankomsten (6 b §).' });
    if (!l.kvarhallen) steg('kvarhallning', 'Håll kvar patienten', { forklaring: 'Sedan vårdintyget är utfärdat får patienten efter beslut av läkare hållas kvar tills frågan om intagning är avgjord (6 §).' });
  } else {
    const krav = l.frister.find(f => (f.id === 'ansokan' || f.id === 'anmalan') && f.status !== 'uppfylld');
    if (krav && upp) {
      steg(krav.id, krav.id === 'anmalan' ? 'Registrera anmälan till förvaltningsrätten' : 'Registrera ansökan till förvaltningsrätten', {
        primar: true, rubrik: krav.rubrik, paragraf: krav.paragraf, forklaring: `Senast ${tidText(krav.senast)}. ${krav.forklaring}`,
        falt: krav.id === 'ansokan' ? [{ namn: 'avser', typ: 'val', etikett: 'Ansökan avser', varde: l.form ?? 'sluten', alternativ: [['sluten', l.lag === 'LRV' ? 'Sluten rättspsykiatrisk vård' : 'Sluten psykiatrisk tvångsvård'], ['oppen', l.lag === 'LRV' ? 'Öppen rättspsykiatrisk vård' : 'Öppen psykiatrisk tvångsvård']] }] : [],
        kontroller: krav.id === 'ansokan' ? [{ ok: harSamordnadVardplan, text: harSamordnadVardplan ? 'Det finns en samordnad vårdplan att foga till en ansökan om öppen vård (7 a §).' : 'En ansökan om öppen vård ska ha en samordnad vårdplan (7 och 7 a §§). Den upprättas under Planer.', galler: 'oppen' }] : [],
      });
    }
    if (l.frister.some(f => f.id === 'understallning' && f.status !== 'uppfylld') && upp) steg('understallning', 'Registrera att beslutet är underställt', { paragraf: '12 § första stycket' });
    if (l.iAvvaktan) {
      steg('beslut_ratten', 'Registrera förvaltningsrättens beslut', {
        paragraf: l.lag === 'LRV' ? 'LRV 12 a §' : '8 och 9 §§', forklaring: l.iAvvaktan,
        falt: [{ namn: 'utfall', typ: 'val', etikett: 'Förvaltningsrätten', varde: 'sluten', alternativ: [['sluten', 'Medgav fortsatt sluten vård'], ['oppen', 'Medgav fortsatt öppen vård'], ['avslag', 'Avslog ansökan']] },
          { namn: 'beslutsdatum', typ: 'datum', etikett: 'Beslutsdatum', varde: idag(), obligatorisk: true }],
      });
    }
    if (upp) {
      steg('atgard', 'Registrera tvångsåtgärd', {
        paragraf: '17 till 23 §§', forklaring: 'Tvångsåtgärder får användas bara om de står i rimlig proportion till syftet, och mindre ingripande åtgärder ska användas om de räcker (2 a §).',
        falt: [{ namn: 'atgard', typ: 'val', etikett: 'Åtgärd', varde: 'fastspanning', alternativ: (l.form === 'oppen' ? ['behandling'] : ATGARDER).map(a => [a, TYPER[a].text]) },
          { namn: 'synnerliga', typ: 'kryss', etikett: 'Av synnerliga skäl längre tid än lagens huvudregel (19 och 20 §§)' }],
      });
      if (l.form === 'oppen') steg('ater_sluten', 'Besluta om sluten tvångsvård igen', { paragraf: '26 a §', falt: FALT_BEKRAFTA('Förutsättningarna i 3 § första stycket 1 är uppfyllda, och rättens beslut kan inte avvaktas med hänsyn till risken för patientens eller annans hälsa eller säkerhet (26 a §).') });
      steg('upphor', 'Besluta att tvångsvården upphör', { paragraf: l.lag === 'LRV' ? 'LRV 13 och 15 §§' : '27 §', falt: FALT_BEKRAFTA('Förutsättningarna för tvångsvård finns inte längre.') });
    }
  }
  return ut;
}

// Patientens somatiska vård som pågår samtidigt (Sussa 3.2.3.3): pågående vårdkontakter på andra vårdenheter som
// användaren får se.
function parallellt(atk, period) {
  const db = atk.db;
  const rader = db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND slut IS NULL AND coalesce(planerad, 0) = 0 ORDER BY start").all(atk.patientId)
    .filter(v => vardenhetFor(db, v.enhet_id) !== period.enhet_id);
  return atk.filtrera(rader, 'las_admin').map(v => ({ id: v.id, vardform: v.typ, start: v.start, plats: v.plats, orsak: v.orsak, enhet: enhetKort(db, v.enhet_id), vardenhet: enhetKort(db, vardenhetFor(db, v.enhet_id)) }));
}

const handelseUt = (db, h) => ({
  id: h.id, typ: h.typ, typText: TYPER[h.typ]?.text ?? h.typ, paragraf: TYPER[h.typ]?.paragraf ?? null, tid: h.tid, registrerad: h.registrerad,
  av: personKort(db, h.av), registreradPa: enhetKort(db, h.registrerad_pa), text: beskriv(db, h),
});
function beskriv(db, h) {
  const d = h.detalj ?? {};
  switch (h.typ) {
    case 'vardintyg': return `${d.redogorelse ?? ''}${d.utfardatPa ? ` Utfärdat på ${enhetKort(db, d.utfardatPa)?.namn}.` : ''}${d.frivillig ? ' Patienten vårdades frivilligt.' : ''}`.trim();
    case 'ankomst': return d.forklaring ? `Ankomst ${d.forklaring}.` : null;
    case 'ansokan': return d.avser === 'oppen' ? 'Avser öppen vård.' : 'Avser sluten vård.';
    case 'medgivande': return `${d.form === 'oppen' ? 'Öppen' : 'Sluten'} vård. Beslut ${d.beslutsdatum ?? ''}.`;
    case 'avslag': return `Beslut ${d.beslutsdatum ?? ''}. Vården upphörde omedelbart (10 §).`;
    case 'forlangning': case 'atgard_slut': case 'uppfoljningssamtal': return d.avser ? `Gäller åtgärden från ${tidText(db.query('SELECT tid FROM tvangsvard_handelser WHERE id = ?').get(Number(d.avser))?.tid ?? h.tid)}.` : null;
    case 'ivo': return d.text ?? null;
    case 'upphor': return d.orsak ?? null;
    default: return d.synnerliga ? 'Av synnerliga skäl.' : null;
  }
}

export function periodUt(atk, period, { harVardplan = false, harSamordnadVardplan = false, nu = Date.now() } = {}) {
  const db = atk.db;
  const { hs, l } = periodLage(db, period, { nu, harVardplan });
  return {
    id: period.id, enhet: enhetKort(db, period.enhet_id), lag: l.lag, lagText: l.lag ? LAGAR[l.lag].namn : null, ...l,
    atgarder: l.atgarder.map(a => ({ ...a, beslut: a.beslut.map(b => ({ id: b.id, tid: b.tid, av: personKort(db, b.av) })) })),
    beslutsjournal: hs.map(h => handelseUt(db, h)).reverse(),
    nasta: nasta(db, atk.personal, period, l, { harSamordnadVardplan }),
    parallellt: l.status === 'upphord' ? [] : parallellt(atk, period),
  };
}

// GET /api/patient/:id/tvangsvard. hjalp ger harVardplan och harSamordnadVardplan från de andra modulerna.
export function forPatient(atk, hjalp = {}) {
  atk.krav('las_tvangsvard');
  const db = atk.db;
  const synliga = synligaPerioder(atk);
  const ut = synliga.map(p => periodUt(atk, p, { harVardplan: hjalp.harVardplan?.(p) ?? false, harSamordnadVardplan: hjalp.harSamordnadVardplan?.() ?? false }));
  const pagar = ut.some(p => p.status !== 'upphord');
  const kan = kanRoll(atk.personal, 'tvangsvard') && atk.prova('tvangsvard').grund !== 'nodatkomst';
  return {
    perioder: ut,
    // Vårdintyg kan utfärdas av varje läkare med vårdrelation. Systemet väljer den psykiatriska vårdenheten.
    vardintyg: kan && !pagar ? {
      knapp: 'Utfärda vårdintyg', paragraf: '4 och 5 §§', mottagare: enhetKort(db, PSYKIATRI[0]),
      forklaring: `Vårdintyget grundas på en särskild läkarundersökning, utfärdas i omedelbar anslutning till den och skickas av systemet till ${enhetKort(db, PSYKIATRI[0]).namn}, där frågan om intagning prövas (4 och 5 §§). Den som utfärdar intyget får inte besluta om intagningen (6 b §).`,
      falt: [{ namn: 'redogorelse', typ: 'text', etikett: 'Den psykiska störningen och omständigheterna som ger upphov till vårdbehovet', obligatorisk: true },
        { namn: 'frivillig', typ: 'kryss', etikett: 'Patienten vårdas redan frivilligt på en psykiatrisk vårdenhet (11 §)' }],
    } : null,
    lrv: kan && !pagar && harUppdrag(db, atk.personal) ? {
      knapp: 'Registrera rättspsykiatrisk vård', paragraf: 'LRV 12 och 16 a §§',
      falt: [{ namn: 'sup', typ: 'kryss', etikett: 'Med särskild utskrivningsprövning' }, { namn: 'verkstallbar', typ: 'datum', etikett: 'Dagen då domen blev verkställbar', varde: idag(), obligatorisk: true }],
    } : null,
  };
}

// En tvångsvård som pågår eller väntar på beslut, för översikten och patienthuvudet. null när inget syns.
export function oversikt(atk, hjalp = {}) {
  if (!kanRoll(atk.personal, 'las_tvangsvard')) return null;
  const p = synligaPerioder(atk).map(x => periodUt(atk, x, { harVardplan: hjalp.harVardplan?.(x) ?? false })).find(x => x.status !== 'upphord');
  if (!p) return null;
  const nasta = p.frister.filter(f => f.status !== 'uppfylld')[0] ?? null;
  return { id: p.id, lag: p.lag, status: p.status, statusText: p.statusText, enhet: p.enhet, frist: nasta, steg: p.nasta.find(s => s.primar) ?? null,
    pagaende: p.atgarder.filter(a => a.pagar).map(a => ({ id: a.id, typText: a.typText, start: a.start })), uppgifter: p.uppgifter.filter(u => u.typ !== 'information').length,
    parallellt: p.parallellt };
}

// Registrera en händelse. POST /api/patient/:id/tvangsvard med { typ, period, avser, ...fälten }.
export function registrera(atk, body = {}, hjalp = {}) {
  const db = atk.db;
  const pers = atk.personal;
  const typ = String(body.typ ?? '');
  const r = atk.krav('tvangsvard', { beskrivning: `tvangsvard:${typ}` });
  const neka = (skal) => { atk.logga('tvangsvard', 'nekad', `tvangsvard:${typ}`, 'nekad'); throw new Fel(403, skal, 'nekad'); };
  if (r.grund === 'nodatkomst') neka('Att registrera i tvångsvården kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.');
  const t = iso();
  const ny = (periodId, enhet, typNy, detalj = {}, tid = t) => Number(db.query(`INSERT INTO tvangsvard_handelser (period_id, patient_id, enhet_id, typ, tid, registrerad, av, registrerad_pa, detalj)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(periodId, atk.patientId, enhet, typNy, tid, t, pers.id, pers.enhet_id, JSON.stringify(detalj)).lastInsertRowid);

  if (typ === 'vardintyg' || typ === 'lrv') {
    const mottagare = typ === 'lrv' ? vardenhetFor(db, pers.enhet_id) : PSYKIATRI[0];
    if (typ === 'lrv' && !harUppdrag(db, pers)) neka('Rättspsykiatrisk vård registreras av chefsöverläkaren eller den som har chefsöverläkarens uppdrag enligt LRV och 39 § LPT.');
    const synlig = synligaPerioder(atk);
    if (synlig.some(p => periodLage(db, p).l.status !== 'upphord' && periodLage(db, p).l.status !== 'vantar')) throw new Fel(400, 'Patienten vårdas redan enligt LPT eller LRV på den psykiatriska vårdenheten.', 'ogiltig');
    if (typ === 'vardintyg' && !text(body.redogorelse)) throw new Fel(400, 'Skriv vilken psykisk störning och vilka omständigheter som ger upphov till vårdbehovet. Vårdintyget ska innehålla det (5 §).', 'ogiltig', { falt: ['redogorelse'] });
    if (typ === 'lrv' && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.verkstallbar ?? ''))) throw new Fel(400, 'Ange dagen då domen blev verkställbar.', 'ogiltig', { falt: ['verkstallbar'] });
    // En period som väntar på beslut på samma vårdenhet och som användaren ser används igen.
    const vantande = synlig.find(p => p.enhet_id === mottagare && periodLage(db, p).l.status === 'vantar' && typ === 'vardintyg');
    const periodId = vantande?.id ?? Number(db.query('INSERT INTO tvangsvard_perioder (patient_id, enhet_id, skapad, skapad_av) VALUES (?, ?, ?, ?)').run(atk.patientId, mottagare, t, pers.id).lastInsertRowid);
    if (typ === 'lrv') {
      ny(periodId, mottagare, 'lrv', { sup: Boolean(body.sup), verkstallbar: body.verkstallbar });
    } else {
      const frivillig = Boolean(body.frivillig);
      ny(periodId, mottagare, 'vardintyg', { redogorelse: text(body.redogorelse), utfardatPa: vardenhetFor(db, pers.enhet_id), frivillig });
      // Ankomsten: när patienten redan är på samma sjukhus, på den egna vårdenhetens pågående kontakt, räknas den från när
      // patienten kom dit. Annars registreras den när patienten kommer till den psykiatriska vårdenheten.
      if (!frivillig) {
        const sjukhus = (id) => db.query('SELECT forald_id FROM enheter WHERE id = ?').get(vardenhetFor(db, id))?.forald_id;
        const min = vardenhetFor(db, pers.enhet_id);
        const v = db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND slut IS NULL AND typ IN ('akut', 'slutenvard') ORDER BY start").all(atk.patientId)
          .find(x => vardenhetFor(db, x.enhet_id) === min && sjukhus(x.enhet_id) === sjukhus(mottagare));
        if (v) ny(periodId, mottagare, 'ankomst', { forklaring: `till ${enhetKort(db, v.enhet_id).namn}, på samma sjukhus. Lagen räknar från ankomsten till vårdinrättningen, så Vårdkällan räknar från när patienten kom dit` }, v.start);
      }
    }
    atk.logga('tvangsvard', atk.grund(), `tvangsvard:${typ}:${periodId}`);
    // Svaret säger bara vad som registrerades, inget om andra uppgifter på den psykiatriska vårdenheten.
    const mott = enhetKort(db, mottagare);
    return [201, { ok: true, typ, mottagare: mott, text: typ === 'lrv' ? 'Den rättspsykiatriska vården är registrerad.' : `Vårdintyget är utfärdat och skickat till ${mott.namn}.` }];
  }

  const period = db.query('SELECT * FROM tvangsvard_perioder WHERE id = ? AND patient_id = ?').get(Number(body.period), atk.patientId);
  if (!period || !synligaPerioder(atk).some(p => p.id === period.id)) throw new Fel(404, 'Tvångsvårdsperioden finns inte.', 'saknas');
  if (vardenhetFor(db, pers.enhet_id) !== period.enhet_id) neka(`Det här registreras på ${enhetKort(db, period.enhet_id).namn}, där tvångsvården ges.`);
  const { l } = periodLage(db, period, { harVardplan: hjalp.harVardplan?.(period) ?? false });
  if (l.status === 'upphord') throw new Fel(400, 'Tvångsvårdsperioden har upphört. Ett nytt vårdintyg behövs för en ny period.', 'ogiltig');
  const upp = harUppdrag(db, pers);
  const kravUppdrag = (vad) => { if (!upp) neka(`${vad} beslutas av chefsöverläkaren eller av en erfaren läkare med specialistkompetens i psykiatri som har chefsöverläkarens uppdrag (39 §).`); };
  const bekraftat = () => { if (body.bekraftelse !== true && body.bekraftelse !== 'on' && body.bekraftelse !== 'true') throw new Fel(400, 'Bekräfta bedömningen innan beslutet sparas.', 'ogiltig', { falt: ['bekraftelse'] }); };
  const avser = (typer) => {
    const a = l.atgarder.find(x => x.id === Number(body.avser) && (!typer || typer.includes(x.typ)));
    if (!a) throw new Fel(400, 'Tvångsåtgärden finns inte i perioden.', 'ogiltig', { falt: ['avser'] });
    return a;
  };
  let id;
  switch (typ) {
    case 'ankomst':
      if (l.status !== 'vantar' || l.ankomst) throw new Fel(400, 'Ankomsten är redan registrerad.', 'ogiltig');
      id = ny(period.id, period.enhet_id, 'ankomst', {}); break;
    case 'kvarhallning':
      if (l.status !== 'vantar') throw new Fel(400, 'Patienten är redan intagen.', 'ogiltig');
      id = ny(period.id, period.enhet_id, 'kvarhallning', {}); break;
    case 'intagning': case 'overgang11': {
      if (l.status !== 'vantar') throw new Fel(400, 'Patienten är redan intagen.', 'ogiltig');
      if ((typ === 'overgang11') !== Boolean(l.vardintyg?.frivillig)) throw new Fel(400, l.vardintyg?.frivillig ? 'Patienten vårdas frivilligt. Beslutet fattas enligt 11 §.' : 'Beslutet fattas enligt 6 b §.', 'ogiltig');
      kravUppdrag('Intagning');
      const p = provaIntagning(l, { beslutare: pers.id, harUppdrag: upp });
      if (!p.ok) throw new Fel(400, p.kontroller.filter(k => !k.ok).map(k => k.text).join(' '), 'ogiltig', { kontroller: p.kontroller });
      bekraftat();
      id = ny(period.id, period.enhet_id, typ, {});
      // Systemet skriver in patienten på avdelningen om patienten inte redan ligger inne.
      if (!db.query('SELECT 1 FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(atk.patientId)) {
        try { vardkontakt.skrivIn(atk, { orsak: typ === 'intagning' ? 'Psykiatrisk tvångsvård enligt LPT' : 'Psykiatrisk tvångsvård enligt LPT, övergång från frivillig vård' }); } catch (e) { if (!(e instanceof Fel)) throw e; }
      }
      break;
    }
    case 'ansokan': case 'anmalan': case 'understallning':
      kravUppdrag(typ === 'ansokan' ? 'Ansökan till förvaltningsrätten' : 'Anmälan och underställning');
      if (typ === 'ansokan' && body.avser === 'oppen' && !(hjalp.harSamordnadVardplan?.() ?? false)) {
        throw new Fel(400, 'En ansökan om öppen vård ska ha en samordnad vårdplan fogad till sig (7 och 7 a §§). Upprätta den samordnade vårdplanen under Planer först.', 'ogiltig', { falt: ['avser'] });
      }
      id = ny(period.id, period.enhet_id, typ, typ === 'ansokan' ? { avser: body.avser === 'oppen' ? 'oppen' : 'sluten' } : {}); break;
    case 'beslut_ratten': {
      if (!l.iAvvaktan) throw new Fel(400, 'Det finns ingen ansökan som väntar på förvaltningsrättens beslut.', 'ogiltig');
      const datum = String(body.beslutsdatum ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum > idag()) throw new Fel(400, 'Ange dagen för förvaltningsrättens beslut.', 'ogiltig', { falt: ['beslutsdatum'] });
      if (body.utfall === 'avslag') id = ny(period.id, period.enhet_id, 'avslag', { beslutsdatum: datum });
      else id = ny(period.id, period.enhet_id, 'medgivande', { form: body.utfall === 'oppen' ? 'oppen' : 'sluten', beslutsdatum: datum });
      break;
    }
    case 'atgard': {
      const atgard = String(body.atgard ?? '');
      if (!ATGARDER.includes(atgard) || (l.form === 'oppen' && atgard !== 'behandling')) throw new Fel(400, 'Välj en tvångsåtgärd som lagen medger i den här vårdformen.', 'ogiltig', { falt: ['atgard'] });
      // Under kvarhållningen före intagningen beslutar legitimerad läkare om fastspänning och avskiljande (6 a §).
      const kvar = l.status === 'vantar';
      if (kvar && !['fastspanning', 'avskiljande'].includes(atgard)) throw new Fel(400, 'Före beslutet om intagning medger lagen bara kortvarig fastspänning eller avskiljande av en patient som hålls kvar (6 a §).', 'ogiltig');
      if (kvar && !l.kvarhallen) throw new Fel(400, 'Besluta först att patienten ska hållas kvar (6 §).', 'ogiltig');
      if (!kvar) kravUppdrag(TYPER[atgard].text);
      const synnerliga = body.synnerliga === true || body.synnerliga === 'on' || body.synnerliga === 'true';
      if (synnerliga && !upp) kravUppdrag('En längre tid av synnerliga skäl');
      id = ny(period.id, period.enhet_id, atgard, { synnerliga, ...(l.status === 'vantar' ? {} : { efterIntagning: true }) });
      break;
    }
    case 'forlangning': {
      const a = avser(['fastspanning', 'avskiljande', 'elektronisk', 'forsandelser']);
      if (!a.pagar) throw new Fel(400, 'Tvångsåtgärden är redan avslutad.', 'ogiltig');
      kravUppdrag('Förlängning');
      id = ny(period.id, period.enhet_id, 'forlangning', { avser: a.id, synnerliga: body.synnerliga === true || body.synnerliga === 'on' }); break;
    }
    case 'atgard_slut': {
      const a = avser(['fastspanning', 'avskiljande', 'elektronisk', 'forsandelser']);
      if (!a.pagar) throw new Fel(400, 'Tvångsåtgärden är redan avslutad.', 'ogiltig');
      id = ny(period.id, period.enhet_id, 'atgard_slut', { avser: a.id }); break;
    }
    case 'ivo': case 'uppfoljningssamtal': case 'stodperson': case 'socialtjanst': {
      const u = l.uppgifter.find(x => x.typ === typ && (typ !== 'ivo' || x.id === String(body.avser)) && (typ !== 'uppfoljningssamtal' || x.avser === Number(body.avser)));
      if (!u) throw new Fel(400, 'Uppgiften är redan gjord eller gäller inte perioden.', 'ogiltig', { falt: ['avser'] });
      id = ny(period.id, period.enhet_id, typ, typ === 'ivo' ? { avser: u.id, text: u.text } : typ === 'uppfoljningssamtal' ? { avser: u.avser } : {}); break;
    }
    case 'ater_sluten':
      if (l.form !== 'oppen') throw new Fel(400, 'Patienten ges inte öppen tvångsvård.', 'ogiltig');
      kravUppdrag('Sluten tvångsvård igen'); bekraftat();
      id = ny(period.id, period.enhet_id, 'ater_sluten', {}); break;
    case 'upphor':
      kravUppdrag('Att tvångsvården upphör'); bekraftat();
      id = ny(period.id, period.enhet_id, 'upphor', { orsak: text(body.orsak, 300) || null }); break;
    default: throw new Fel(400, 'Okänd händelse i tvångsvården.', 'ogiltig', { falt: ['typ'] });
  }
  atk.logga('tvangsvard', atk.grund(), `tvangsvard:${typ}:${period.id}:${id}`);
  return [201, periodUt(atk, period, { harVardplan: hjalp.harVardplan?.(period) ?? false, harSamordnadVardplan: hjalp.harSamordnadVardplan?.() ?? false })];
}

// Perioderna på personalens vårdenhet som inte har upphört, med patienter som personalen har vårdrelation till.
function enhetensPerioder(db, personal) {
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!PSYKIATRI.includes(ve)) return [];
  return db.query('SELECT * FROM tvangsvard_perioder WHERE enhet_id = ? ORDER BY skapad').all(ve)
    .filter(p => harVardrelation(db, p.patient_id, ve));
}

// Inkorgen: frister som är nära eller har passerat och uppgifter som återstår, för läkarna på den psykiatriska
// vårdenheten. Ger rader med patientId, som servern gör om till patientkort och loggar.
export function inkorg(db, personal, hjalp = {}) {
  if (!kanRoll(personal, 'tvangsvard') || !arPsykiatri(db, personal)) return [];
  const ut = [];
  for (const p of enhetensPerioder(db, personal)) {
    const { l } = periodLage(db, p, { harVardplan: hjalp.harVardplan?.(p) ?? false });
    if (l.status === 'upphord') continue;
    const frister = l.frister.filter(f => f.status === 'snart' || f.status === 'passerad');
    const uppgifter = l.uppgifter.filter(u => u.typ !== 'information');
    if (!frister.length && !uppgifter.length) continue;
    ut.push({ patientId: p.patient_id, periodId: p.id, statusText: l.statusText, frister, uppgifter: uppgifter.map(u => ({ id: u.id, text: u.text, paragraf: u.paragraf })) });
  }
  return ut;
}

// Bevakningen på enhetsnivå (Sussa 3.2.3.4): alla pågående perioder på vårdenheten med nästa frist, pågående
// tvångsåtgärder och uppgifter, sorterade efter den frist som kommer först. valFor ger patientens val i sessionen.
export function bevakning(db, personal, { valFor = () => ({}), harVardplan = () => false } = {}) {
  const ve = vardenhetFor(db, personal.enhet_id);
  if (!kanRoll(personal, 'las_tvangsvard') || !PSYKIATRI.includes(ve)) throw new Fel(403, 'Bevakningen av tvångsvården finns på de psykiatriska vårdenheterna.', 'nekad');
  const rader = [];
  for (const p of enhetensPerioder(db, personal)) {
    const { l } = periodLage(db, p, { harVardplan: harVardplan(p) });
    if (l.status === 'upphord') continue;
    const pat = patientRad(db, p.patient_id);
    const visad = valFor(pat.id).visa_identitet;
    const nasta = l.frister.find(f => f.status !== 'uppfylld') ?? null;
    rader.push({
      patientId: pat.id, periodId: p.id, namn: visningsnamn(pat, visad), personnummer: visningsPnr(pat, visad), skyddad: Boolean(pat.skyddad),
      lag: l.lag, status: l.status, statusText: l.statusText, intagning: l.intagning, giltigTill: l.giltigTill, frist: nasta,
      pagaende: l.atgarder.filter(a => a.pagar).map(a => ({ typText: a.typText, start: a.start, giltigTill: a.giltigTill })),
      uppgifter: l.uppgifter.filter(u => u.typ !== 'information').length,
    });
  }
  const vikt = { passerad: 0, snart: 1, kommande: 2 };
  rader.sort((a, b) => (vikt[a.frist?.status] ?? 3) - (vikt[b.frist?.status] ?? 3) || String(a.frist?.senast ?? '9').localeCompare(String(b.frist?.senast ?? '9')));
  return { vardenhet: enhetKort(db, ve), rader, statistik: statistik(db, [ve]) };
}

// Uppföljning utan personuppgifter (Sussa 3.2.3.4): antal perioder, tvångsåtgärder och frister per vårdenhet. Inga id,
// namn eller personnummer, och inga uppgifter som går att knyta till en patient: grupper med färre än tre perioder
// visas som "färre än 3".
export const MINSTA_GRUPP = 3;
export function statistik(db, enheter, { nu = Date.now(), dagar = 365 } = {}) {
  const fran = new Date(nu - dagar * 86400_000).toISOString();
  return enheter.map(ve => {
    const ps = db.query('SELECT * FROM tvangsvard_perioder WHERE enhet_id = ?').all(ve);
    const lagen = ps.map(p => periodLage(db, p, { nu }).l).filter(l => l.intagning && (l.slut == null || l.slut >= fran));
    const atg = {};
    for (const a of ATGARDER) atg[a] = 0;
    let passerade = 0;
    let langd = 0;
    let avslutade = 0;
    for (const l of lagen) {
      for (const a of l.atgarder) if (a.start >= fran) atg[a.typ]++;
      passerade += l.frister.filter(f => f.status === 'passerad').length + (l.upphordAvSigSjalv ? 1 : 0);
      if (l.slut) { avslutade++; langd += (Date.parse(l.slut) - Date.parse(l.intagning)) / 86400_000; }
    }
    const grupp = (n) => (n > 0 && n < MINSTA_GRUPP ? `färre än ${MINSTA_GRUPP}` : n);
    return {
      vardenhet: enhetKort(db, ve), period: { dagar },
      perioder: { pagaende: grupp(lagen.filter(l => l.status !== 'upphord').length), avslutade: grupp(avslutade), lpt: grupp(lagen.filter(l => l.lag === 'LPT').length), lrv: grupp(lagen.filter(l => l.lag === 'LRV').length) },
      medellangdDagar: avslutade >= MINSTA_GRUPP ? Math.round(langd / avslutade) : null,
      atgarder: Object.fromEntries(Object.entries(atg).map(([k, n]) => [k, { text: TYPER[k].text, antal: grupp(n) }])),
      passeradeFrister: grupp(passerade),
    };
  });
}

// Seeden (runda 6, r3). Två påhittade patienter på Allmänpsykiatriska kliniken, med testpersonnummer från Skatteverket:
//   p21 Sofia Hedlund har ett vårdintyg från akutmottagningen och väntar på beslut om intagning.
//   p22 Emil Sjölund har vårdats enligt LPT i 26 dagar, och ansökan till förvaltningsrätten ska in senast i morgon.
//      Han vårdas sedan två dagar på hjärtintensiven för förmaksflimmer medan tvångsvården fortsätter (parallella
//      processer), och har ett avslutat tvångsvårdsår bakom sig med en fastspänning.
export const TVANGSPATIENTER = [
  { id: 'p21', pnr: '199604052382', fornamn: 'Sofia', efternamn: 'Hedlund', kon: 'kvinna', fodd: '1996-04-05', adress: 'Rudbecksgatan 12', postnr: '702 23', ort: 'Örebro', telefon: '070-174 06 21' },
  { id: 'p22', pnr: '199604062399', fornamn: 'Emil', efternamn: 'Sjölund', kon: 'man', fodd: '1996-04-06', adress: 'Sörbyvägen 3', postnr: '702 25', ort: 'Örebro', telefon: '070-174 06 22' },
];
export function seeda(db, bas = new Date()) {
  sakraSchema(db);
  const dag = (d, klocka) => lokalTid(addDagar(datumAv(bas), d), klocka);
  for (const p of TVANGSPATIENTER) {
    db.query(`INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, adress, postnr, ort, telefon, kontaktperson, skyddad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`).run(p.id, p.pnr, p.fornamn, p.efternamn, p.kon, p.fodd, p.adress, p.postnr, p.ort, p.telefon);
  }
  const { vk, period, h, ant, mv, ord } = skrivare(db);
  // p22: tidigare period för drygt ett år sedan, och en pågående sedan 26 dagar med flytt till hjärtintensiven.
  const gammal = period('p22', dag(-400, '20:00'), 'lak-vc');
  h(gammal, 'p22', 'vardintyg', dag(-400, '20:00'), 'lak-vc', 'vc-tybble', { redogorelse: 'Recidiverande depression med psykotiska inslag och suicidrisk.', utfardatPa: 'vc-tybble' });
  h(gammal, 'p22', 'ankomst', dag(-400, '21:30'), 'lak-psyk', 'uso-psyk', {});
  h(gammal, 'p22', 'intagning', dag(-400, '22:40'), 'lak-psyk', 'uso-psyk', {});
  const fs = h(gammal, 'p22', 'fastspanning', dag(-398, '03:10'), 'lak-psyk', 'uso-psyk', { efterIntagning: true });
  h(gammal, 'p22', 'atgard_slut', dag(-398, '04:40'), 'lak-psyk', 'uso-psyk', { avser: fs });
  h(gammal, 'p22', 'uppfoljningssamtal', dag(-397, '11:00'), 'lak-psyk', 'uso-psyk', { avser: fs });
  h(gammal, 'p22', 'stodperson', dag(-399, '10:00'), 'lak-psyk', 'uso-psyk', {});
  h(gammal, 'p22', 'socialtjanst', dag(-396, '10:00'), 'lak-psyk', 'uso-psyk', {});
  h(gammal, 'p22', 'upphor', dag(-388, '10:00'), 'lak-psyk', 'uso-psyk', {});

  const ny = period('p22', dag(-27, '19:30'), 'lak-vc');
  h(ny, 'p22', 'vardintyg', dag(-27, '19:30'), 'lak-vc', 'vc-tybble', { redogorelse: 'Återfall i svår depression med psykotiska symtom, slutar äta och dricka. Motsätter sig vård.', utfardatPa: 'vc-tybble' });
  h(ny, 'p22', 'ankomst', dag(-26, '13:40'), 'lak-psyk', 'uso-psyk', {});
  h(ny, 'p22', 'intagning', dag(-26, '15:00'), 'lak-psyk', 'uso-psyk', {});
  h(ny, 'p22', 'stodperson', dag(-24, '10:00'), 'lak-psyk', 'uso-psyk', {});
  const fs2 = h(ny, 'p22', 'fastspanning', dag(-20, '02:15'), 'lak-psyk', 'uso-psyk', { efterIntagning: true });
  h(ny, 'p22', 'atgard_slut', dag(-20, '03:45'), 'lak-psyk', 'uso-psyk', { avser: fs2 });
  const vt = Number(db.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, orsak, inskriven_av) VALUES ('p22', 'uso-kard', ?, 'Psykiatrisk tvångsvård enligt LPT', 'lak-psyk')").run(dag(-26, '15:00')).lastInsertRowid);
  const psyk = vk('p22', 'uso-psyk', 'slutenvard', dag(-26, '15:00'), dag(-2, '10:00'), 'Allmänpsykiatriska kliniken, sal 2', 'Psykiatrisk tvångsvård enligt LPT', { av: 'lak-psyk', vt });
  const hia = vk('p22', 'uso-kard-hia', 'slutenvard', dag(-2, '10:00'), null, 'Hjärtintensiven, sal 3', 'Förmaksflimmer med snabb kammarfrekvens', { av: 'lak-kard', vt, fore: psyk });
  db.query("INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, 'inskrivning', ?, 'uso-psyk', 'Allmänpsykiatriska kliniken, sal 2', 'lak-psyk', NULL)").run(vt, dag(-26, '15:00'));
  db.query("INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, 'flytt', ?, 'uso-kard-hia', 'Hjärtintensiven, sal 3', 'lak-kard', 'Från Allmänpsykiatriska kliniken USÖ')").run(vt, dag(-2, '10:00'));
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES ('p22', 'uso-psyk', ?, 'F32.1', 'Medelsvår depressiv episod', 'huvud', ?, 'vardkallan')").run(psyk, dag(-26, '15:00').slice(0, 10));
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES ('p22', 'uso-kard-hia', ?, 'I48.0', 'Paroxysmalt förmaksflimmer', 'huvud', ?, 'vardkallan')").run(hia, dag(-2, '10:00').slice(0, 10));
  ant('p22', 'uso-psyk', psyk, 'Inskrivningsanteckning', 'lak-psyk', dag(-26, '15:30'), { Kontaktorsak: 'Återfall i svår depression med psykotiska symtom. Intagen enligt LPT efter vårdintyg från vårdcentralen.', Bedömning: 'Oundgängligt behov av psykiatrisk dygnetruntvård. Motsätter sig vård.', Åtgärd: 'Sertralin. Tät tillsyn. Vårdplan enligt 16 § LPT.' });
  ant('p22', 'uso-psyk', psyk, 'Daganteckning', 'lak-psyk', dag(-10, '11:00'), { Aktuellt: 'Äter och dricker bättre. Fortfarande nedstämd.', Bedömning: 'Långsam förbättring.', Åtgärd: 'Fortsatt sluten tvångsvård. Ansökan om fortsatt vård förbereds.' });
  ant('p22', 'uso-kard-hia', hia, 'Inskrivningsanteckning', 'lak-kard', dag(-2, '11:00'), { Kontaktorsak: 'Förmaksflimmer med snabb kammarfrekvens. Flyttad från Allmänpsykiatriska kliniken.', Bedömning: 'Behandlas på hjärtintensiven. Den psykiatriska tvångsvården fortsätter med chefsöverläkaren på Allmänpsykiatriska kliniken som ansvarig.', Åtgärd: 'Frekvensreglering och telemetri.' });
  mv('p22', 'uso-psyk', psyk, 'vikt', 74.5, 'kg', dag(-25, '07:30'), 'ssk-psyk');
  mv('p22', 'uso-kard-hia', hia, 'puls', 132, 'slag/min', dag(-2, '10:15'), null);
  ord('p22', 'uso-psyk', psyk, { lm: 'VK-NPL-0041', dosering: '2 tabletter på morgonen', dos: 100, dosEnhet: 'mg', tider: ['08'], typ: 'staende', orsak: 'Depression', av: 'lak-psyk' }, dag(-26, '15:40'));
  // Runda 13, r4: på hjärtintensiven har han frekvensreglering och blodförtunnande, och dygnets doser är givna fram till nu.
  ord('p22', 'uso-kard-hia', hia, { lm: 'VK-NPL-0008', dosering: '1 tablett morgon och kväll', dos: 50, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Förmaksflimmer, frekvensreglering', av: 'lak-kard' }, dag(-2, '11:10'));
  ord('p22', 'uso-kard-hia', hia, { lm: 'VK-NPL-0002', dosering: '1 tablett morgon och kväll', dos: 5, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', orsak: 'Förmaksflimmer, strokeprofylax', av: 'lak-kard' }, dag(-2, '11:12'));
  givnaDoserHia(db, 'p22', hia, bas);
}
const dagPlus = (isoTid, minuter) => new Date(Date.parse(isoTid) + minuter * 60_000).toISOString();
function skrivare(db) {
  const vk = (pid, enhet, typ, start, slut, plats, orsak, extra = {}) => Number(db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, plats, orsak, kalla, skapad, skapad_av, vardtillfalle_id, foregaende_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'vardkallan', ?, ?, ?, ?)`).run(pid, enhet, typ, start, slut, plats, orsak, start, extra.av ?? null, extra.vt ?? null, extra.fore ?? null).lastInsertRowid);
  const period = (pid, skapad, av) => Number(db.query("INSERT INTO tvangsvard_perioder (patient_id, enhet_id, skapad, skapad_av) VALUES (?, 'uso-psyk', ?, ?)").run(pid, skapad, av).lastInsertRowid);
  const h = (per, pid, typ, tid, av, pa, detalj = {}) => Number(db.query(`INSERT INTO tvangsvard_handelser (period_id, patient_id, enhet_id, typ, tid, registrerad, av, registrerad_pa, detalj)
    VALUES (?, ?, 'uso-psyk', ?, ?, ?, ?, ?, ?)`).run(per, pid, typ, tid, tid, av, pa, JSON.stringify(detalj)).lastInsertRowid);
  // Anteckningar, mätvärden och ordinationer, så att patienterna har en journal som de andra i demon.
  const ant = (pid, enhet, vkId, typ, av, tid, sokord) => db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'signerad', ?, ?, 1, 'vardkallan')`).run(pid, enhet, vkId, typ, typ === 'Omvårdnadsanteckning' ? 'omvardnad' : 'lakare',
    JSON.stringify(Object.entries(sokord).map(([sokord, text]) => ({ sokord, text }))), av, tid, dagPlus(tid, 5), av);
  const mv = (pid, enhet, vkId, typ, varde, enh, tid, av) => db.query(`INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla, vardkontakt_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vardkallan', ?)`).run(pid, enhet, typ, String(varde), typeof varde === 'number' ? varde : null, enh, tid, av, vkId);
  const ord = (pid, enhet, vkId, o, tid) => {
    const r = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, status, ordinerad_av, skapad, nll_status, kalla, vardkontakt_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', ?, ?, 'kvitterad', 'vardkallan', ?)`).run(pid, enhet, o.lm, o.dosering, o.dos, o.dosEnhet, o.tider ? JSON.stringify(o.tider) : null, o.vidBehov ? 1 : 0, o.typ,
      o.orsak, addDagar(datumAv(new Date(tid)), 30), datumAv(new Date(tid)), o.av, tid, vkId);
    const id = Number(r.lastInsertRowid);
    db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(id, tid, o.av, 'Ordinerad', o.dosering);
    db.query("INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, 'ny', ?, 'kvitterad', ?, ?, 1)").run(id, dagPlus(tid, 0.05), dagPlus(tid, 0.1), `NLL-R3${String(id).padStart(4, '0')}`);
    db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, NULL, ?, NULL)').run(id, dagPlus(tid, 0.1), 'Kvitterad av NLL');
  };
  return { vk, period, h, ant, mv, ord };
}

// p21 räknas från när sandlådan skapas, inte från när mallen byggdes, eftersom fristen för intagningen är 24 timmar.
// Anropas av nySessionsDb (db.js) och när en äldre sandlåda läses in. Gör inget när p21 redan har sina kontakter.
export function anpassaTillNu(db, nu = Date.now()) {
  sakraSchema(db);
  if (!db.query("SELECT 1 FROM patienter WHERE id = 'p21'").get() || db.query("SELECT 1 FROM vardkontakter WHERE patient_id = 'p21'").get()) return;
  const tim = (x) => new Date(nu + x * 3600_000).toISOString();
  const { vk, period, h, ant, mv, ord } = skrivare(db);
  // Akutbesök för fem timmar sedan, vårdintyg för fyra, och nu på psykiatrins akutmottagning.
  const ak = vk('p21', 'uso-akut', 'akut', tim(-5), tim(-3), 'Akutrum 6', 'Suicidtankar', { av: 'lak-akut' });
  const pak = vk('p21', 'uso-psyk', 'akut', tim(-3), null, 'Psykiatriska akutmottagningen', 'Psykiatrisk akutbedömning', { av: 'lak-psyk', fore: ak });
  ant('p21', 'uso-akut', ak, 'Akutanteckning', 'lak-akut', tim(-4.5), { Kontaktorsak: 'Suicidtankar sedan en vecka, kom med sin bror.', Status: 'Nedstämd, sluten. Har en konkret plan.', Bedömning: 'Svår depressiv episod med hög suicidrisk.', Åtgärd: 'Vårdintyg. Överförs till psykiatrins akutmottagning.' });
  ant('p21', 'uso-akut', ak, 'Omvårdnadsanteckning', 'ssk-akut', tim(-4.2), { Omvårdnad: 'Extravak i rummet. Patienten har inte ätit i dag.' });
  ant('p21', 'uso-psyk', pak, 'Akutanteckning', 'lak-psyk', tim(-2.5), { Kontaktorsak: 'Överförd från akutmottagningen med vårdintyg.', Bedömning: 'Bekräftar svår depression med suicidrisk. Motsätter sig vård.' });
  mv('p21', 'uso-akut', ak, 'puls', 96, 'slag/min', tim(-4.8), 'ssk-akut');
  mv('p21', 'uso-akut', ak, 'blodtryck', '124/78', 'mmHg', tim(-4.8), 'ssk-akut');
  ord('p21', 'uso-psyk', pak, { lm: 'VK-NPL-0045', dosering: '1 tablett 1 timme före sänggåendet vid behov', dos: 2, dosEnhet: 'mg', typ: 'vid_behov', vidBehov: true, orsak: 'Insomningssvårigheter vid depression', av: 'lak-psyk' }, tim(-2.4));
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES ('p21', 'uso-akut', ?, 'F32.1', 'Medelsvår depressiv episod', 'huvud', ?, 'vardkallan')").run(ak, datumAv(new Date(nu)));
  const p1 = period('p21', tim(-4), 'lak-akut');
  h(p1, 'p21', 'ankomst', tim(-5), 'lak-akut', 'uso-akut', { forklaring: 'till Akutmottagningen USÖ, på samma sjukhus. Lagen räknar från ankomsten till vårdinrättningen, så Vårdkällan räknar från när patienten kom dit' });
  h(p1, 'p21', 'vardintyg', tim(-4), 'lak-akut', 'uso-akut', { redogorelse: 'Svår depressiv episod med uttalade suicidtankar och plan. Motsätter sig inläggning och kan inte ta ställning till vård. Oundgängligt behov av psykiatrisk dygnetruntvård.', utfardatPa: 'uso-akut' });
  h(p1, 'p21', 'kvarhallning', dagPlus(tim(-4), 5), 'lak-akut', 'uso-akut', {});
  // Runda 13, r4: Emil Sjölunds värden på hjärtintensiven det senaste dygnet, så att övervakningen syns.
  const hia = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p22' AND enhet_id = 'uso-kard-hia' AND slut IS NULL").get()?.id;
  if (hia) {
    for (const [x, puls, bt, sat] of [[-9, 112, '124/78', 96], [-5, 104, '120/74', 97], [-1.5, 92, '118/72', 97]]) {
      mv('p22', 'uso-kard-hia', hia, 'puls', puls, 'slag/min', tim(x), 'ssk-hia');
      mv('p22', 'uso-kard-hia', hia, 'blodtryck', bt, 'mmHg', tim(x), 'ssk-hia');
      mv('p22', 'uso-kard-hia', hia, 'saturation', sat, '%', tim(x), 'ssk-hia');
    }
  }
}

// Runda 13, r4: de doser som skulle ha getts sedan flytten till hjärtintensiven och fram till en timme före bas är
// givna av sjuksköterskan på avdelningen, som för de andra inneliggande patienterna (lakemedelsprocess.js).
function givnaDoserHia(db, pid, hiaId, bas) {
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'administreringar'").get()) return;
  const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(hiaId);
  const ins = db.query(`INSERT INTO administreringar (patient_id, enhet_id, ordination_id, lakemedel_id, planerad, status, dos, dos_enhet, antal, tid, utford_av,
    registrerad, registrerad_av, vardkontakt_id) VALUES (?, ?, ?, ?, ?, 'given', ?, ?, 1, ?, 'ssk-hia', ?, 'ssk-hia', ?)`);
  const plus = (t, min) => new Date(Date.parse(t) + min * 60_000).toISOString();
  for (const o of db.query("SELECT * FROM ordinationer WHERE patient_id = ? AND status = 'aktiv' AND tider IS NOT NULL").all(pid)) {
    for (let d = -2; d <= 0; d++) {
      for (const k of JSON.parse(o.tider)) {
        const slot = lokalTid(addDagar(datumAv(bas), d), `${String(k).padStart(2, '0').slice(0, 2)}:00`);
        if (Date.parse(slot) < Math.max(Date.parse(v.start), Date.parse(o.skapad)) || Date.parse(slot) > bas.getTime() - 3600_000) continue;
        ins.run(pid, v.enhet_id, o.id, o.lakemedel_id, slot, o.dos, o.dos_enhet, plus(slot, 5), plus(slot, 6), v.id);
      }
    }
  }
}

// En sandlåda från före runda 6 får tabellerna, de nya patienterna och seeden relativt till i dag.
export function sakra(db) {
  const fanns = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tvangsvard_perioder'").get();
  sakraSchema(db);
  if (!fanns && !db.query("SELECT 1 FROM patienter WHERE id = 'p22'").get()) seeda(db, new Date());
  anpassaTillNu(db);
}
