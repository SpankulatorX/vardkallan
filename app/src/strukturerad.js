// Runda 8, r5: strukturerad information med färre steg (Sussas tema 4, testfall 4.2 och 4.3).
//
// Epikrisen: systemet föreslår texten under Orsak till vård och Läkemedelsförändringar ur vårdtillfället, så att läkaren
// bara skriver förloppet och uppföljningen. Förslaget bygger bara på det läkaren själv får se: diagnoserna på de
// vårdkontakter i vårdtillfället som läkaren får se, och de ordinationer som läkaren får se. En diagnos eller ordination
// som är spärrad, kräver ett aktivt val eller är undantagen påverkar inte förslaget alls, inte heller valet av
// huvuddiagnos.
//
// Flera mätvärden på en gång: längd, vikt, blodtryck och puls (och de andra vanliga talvärdena) registreras i ett
// formulär med samma tid och vårdkontakt, och systemet räknar BMI ur längd och vikt. Allt eller inget sparas.
import { Fel, iso } from './db.js';
import { kanRoll } from './atkomst.js';
import * as journal from './journal.js';
import * as vardkontakt from './vardkontakt.js';
import * as lakemedel from './lakemedel.js';
// Runda 9, r1: läkemedelsberättelsen i epikrisens förslag (Sussa 3.5.1.11).
import * as vidimering from './vidimering.js';

const datumText = (t) => String(t ?? '').slice(0, 10);

// Förslaget till epikrisen för ett vårdtillfälle. vardtillfalleId är valfritt: utan det används patientens pågående
// vårdtillfälle på läkarens vårdenhet, och annars det senaste som läkaren får se.
export function epikrisForslag(atk, { vardtillfalleId = null } = {}) {
  atk.krav('skriv_journal');
  const db = atk.db;
  const rader = db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? ORDER BY (utskriven IS NULL) DESC, inskriven DESC').all(atk.patientId);
  const synliga = rader.map(vt => ({ vt, ut: vardkontakt.vardtillfalleUt(atk, vt) })).filter(x => x.ut.kontakter.length);
  const vald = vardtillfalleId == null ? synliga[0] : synliga.find(x => x.vt.id === Number(vardtillfalleId));
  if (!vald) {
    if (vardtillfalleId != null) throw new Fel(404, 'Vårdtillfället finns inte.', 'saknas');
    return { vardtillfalle: null, sokord: {}, text: 'Patienten har inget vårdtillfälle som du kan se. Skriv epikrisen utan förslag.' };
  }
  const { vt, ut } = vald;
  const kontakter = new Set(ut.kontakter.map(k => k.id));
  const orsak = [];
  if (vt.orsak) orsak.push(`${vt.orsak.replace(/\.$/, '')}.`);
  if (kanRoll(atk.personal, 'las_diagnoser')) {
    const dia = journal.synligaDiagnoser(atk).filter(d => kontakter.has(d.vardkontakt_id));
    const ordnade = [...dia.filter(d => d.typ === 'huvud'), ...dia.filter(d => d.typ !== 'huvud')];
    if (ordnade.length) orsak.push(`Diagnos: ${ordnade.map(d => `${d.text} (${d.kod})${d.typ === 'huvud' ? ', huvuddiagnos' : ''}`).join('. ')}.`);
  }
  const sokord = {};
  if (orsak.length) sokord['Orsak till vård'] = `${orsak.join(' ')} Inskriven ${datumText(vt.inskriven)}.`;
  if (kanRoll(atk.personal, 'las_lakemedel')) {
    const fran = vt.inskriven;
    const till = vt.utskriven ?? '9999';
    const lm = lakemedel.synligaOrdinationer(atk).map(o => ({ o, u: lakemedel.ordinationUt(db, o, { historik: false }) }));
    const nya = lm.filter(({ o }) => (o.skapad ?? '') >= fran && (o.skapad ?? '') <= till).map(({ u }) => `Insatt ${u.lakemedel?.namn ?? ''} ${u.lakemedel?.styrka ?? ''}, ${u.dosering}`.replace(/\s+,/, ','));
    const utsatta = lm.filter(({ o }) => o.utsatt_tid && o.utsatt_tid >= fran && o.utsatt_tid <= till).map(({ u, o }) => `Utsatt ${u.lakemedel?.namn ?? ''} ${u.lakemedel?.styrka ?? ''}${o.utsatt_orsak ? `, ${o.utsatt_orsak}` : ''}`.replace(/\s+,/, ','));
    const alla = [...nya, ...utsatta];
    if (alla.length) sokord['Läkemedelsförändringar'] = `${alla.join('. ')}.`;
    // Runda 9, r1: läkemedelsberättelsen under Läkemedelsförändringar. Den som läkaren har sparat vid en
    // läkemedelsgenomgång under vårdtillfället går först, annars den som systemet tar fram ur historiken för det
    // pågående vårdtillfället. Bara genomgångar som läkaren får se räknas.
    const genomgangar = atk.filtrera(db.query('SELECT * FROM lakemedelsgenomgangar WHERE patient_id = ? AND vardtillfalle_id = ? ORDER BY tid DESC, id DESC').all(atk.patientId, vt.id), 'las_lakemedel', { gemensam: true });
    if (genomgangar.length) {
      const g = genomgangar[0];
      const av = db.query('SELECT namn FROM personal WHERE id = ?').get(g.av)?.namn ?? '';
      sokord['Läkemedelsförändringar'] = `Ur läkemedelsgenomgången ${datumText(g.tid)} av ${av}:\n${g.berattelse}`;
    } else if (!vt.utskriven) {
      const b = vidimering.berattelse(atk);
      if (b.period.vardtillfalleId === vt.id && b.text.includes('\n')) sokord['Läkemedelsförändringar'] = b.text;
    }
  }
  return {
    vardtillfalle: { id: vt.id, inskriven: vt.inskriven, utskriven: vt.utskriven, orsak: vt.orsak },
    sokord,
    text: Object.keys(sokord).length ? 'Systemet har skrivit det som går att räkna ut ur vårdtillfället, diagnoserna och läkemedlen. Kontrollera texten och skriv förloppet och uppföljningen.' : 'Systemet hittade inget att föreslå ur vårdtillfället.',
  };
}

// Mätvärdena i formuläret för flera värden, i den ordning de visas.
export const FLERA = ['langd', 'vikt', 'blodtryck', 'puls'];

// BMI ur längd i cm och vikt i kg, med en decimal.
export const bmi = (langd, vikt) => (langd > 0 && vikt > 0 ? Math.round((vikt / ((langd / 100) ** 2)) * 10) / 10 : null);

export function registreraFlera(atk, body = {}) {
  atk.krav('registrera_matvarde');
  const varden = FLERA.filter(t => body[t] != null && String(body[t]).trim() !== '');
  if (!varden.length) throw new Fel(400, 'Fyll i minst ett mätvärde.', 'ogiltig', { falt: FLERA });
  const tid = body.tid != null ? body.tid : iso();
  const db = atk.db;
  return db.transaction(() => {
    const sparade = [];
    for (const typ of varden) {
      try { sparade.push(journal.registreraMatvarde(atk, { typ, varde: typeof body[typ] === 'string' ? body[typ].trim() : body[typ], tid })); } catch (e) {
        if (e instanceof Fel && e.status === 400) throw new Fel(400, e.message, 'ogiltig', { falt: [typ] });
        throw e;
      }
    }
    const forsta = vardkontakt.knyt(atk, 'matvarden', sparade[0], body);
    const vk = db.query('SELECT vardkontakt_id FROM matvarden WHERE id = ?').get(sparade[0].id).vardkontakt_id;
    for (const m of sparade.slice(1)) db.query('UPDATE matvarden SET vardkontakt_id = ? WHERE id = ?').run(vk, m.id);
    const per = Object.fromEntries(sparade.map(m => [m.typ, m]));
    const b = per.langd && per.vikt ? bmi(Number(per.langd.varde), Number(per.vikt.varde)) : null;
    const text = `${sparade.map(m => `${m.namn} ${m.varde} ${m.enhet}`).join(', ')} är registrerat.${b ? ` BMI ${String(b).replace('.', ',')}.` : ''}`;
    return { matvarden: sparade, vardkontakt: forsta.vardkontakt, bmi: b, text };
  })();
}
