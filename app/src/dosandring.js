// Dosändring i en pågående ordination (runda 8, r4, Sussa 3.5.2.11 och 3.5.2.12, testfall 1.1). Läkaren ändrar dosen,
// doseringen, tiderna eller styrkan i en ordination som pågår, utan att sätta ut och ordinera på nytt. Den nya
// doseringen gäller från ett datum: i dag eller ett senare datum. Ordinationen är densamma, med samma orsak,
// uppföljning och historik, och ändringen skickas till NLL. Byts styrkan ersätts förskrivningen av en ny med den nya
// produktens förpackning.
//
// Systemet är experten. Det föreslår produkterna med samma substans och form, och när läkaren väljer en annan styrka
// fyller det i doseringen ur läkemedelsmallen för produkten, eller med samma antal tabletter och dosen räknad ur
// styrkan. Det kontrollerar den nya dosen med samma varningar som en ny ordination, säger på vanlig svenska vad som
// ändras och sparar före och efter i historiken. En ändring från ett senare datum gäller av sig själv när dagen kommer.
//
// Varje dosändring sparas och raderas eller ändras aldrig. Bara den tid då ändringen började gälla fylls i efteråt.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { vardenhetFor } from './atkomst.js';
import * as lakemedel from './lakemedel.js';
import { produktmall, formgrupp } from './ordinationsmallar.js';
import { substansmall } from './mallgodkannande.js';
import * as stod from './lakemedelsstod.js';
import { klocka } from './lakemedelsprocess.js';

// Tabellen och triggrarna finns i dosandring-schema.js, som db.js använder.
import { sakraDosandring, harTabell } from './dosandring-schema.js';
export { sakraDosandring };

// Så långt fram kan en ny dosering börja gälla.
export const FRAN_SENAST_DAGAR = 365;
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const tal = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
const doseringAv = (o) => ({ lakemedelId: o.lakemedel_id, dosering: o.dosering, dos: o.dos, dosEnhet: o.dos_enhet, tider: o.tider ? JSON.parse(o.tider) : [] });
const lmText = (lm) => (lm ? `${lm.namn} ${lm.styrka}` : '');
const mgAv = (s) => { const m = /^([\d,]+)\s*(mg|g)$/.exec(s ?? ''); return m ? Number(m[1].replace(',', '.')) * (m[2] === 'g' ? 1000 : 1) : null; };
// Vad som ändras, på vanlig svenska.
export function andringText(db, fore, efter) {
  const delar = [];
  if (fore.lakemedelId !== efter.lakemedelId) delar.push(`${lmText(katalog(db, fore.lakemedelId))} byts mot ${lmText(katalog(db, efter.lakemedelId))}`);
  if (fore.dosering !== efter.dosering) delar.push(`doseringen ändras från ${fore.dosering.toLowerCase()} till ${efter.dosering.toLowerCase()}`);
  if ((fore.dos ?? null) !== (efter.dos ?? null) || (fore.dosEnhet ?? null) !== (efter.dosEnhet ?? null)) {
    delar.push(`dosen ändras från ${fore.dos != null ? `${tal(fore.dos)} ${fore.dosEnhet ?? ''}`.trim() : 'ingen'} till ${efter.dos != null ? `${tal(efter.dos)} ${efter.dosEnhet ?? ''}`.trim() : 'ingen'}`);
  }
  // Tiderna jämförs som klockslag, så att 08 och 08:00 är samma tid.
  const kl = (t) => JSON.stringify((t ?? []).map(x => klocka(x) ?? x));
  if (kl(fore.tider) !== kl(efter.tider)) delar.push(`tiderna ändras från ${fore.tider.length ? `kl. ${fore.tider.join(', ')}` : 'inga'} till ${efter.tider.length ? `kl. ${efter.tider.join(', ')}` : 'inga'}`);
  const t = delar.join(', ');
  return t ? `${t[0].toUpperCase()}${t.slice(1)}.` : '';
}

// En dosändring kan bara göras i en ordination som pågår och vars dos går att ändra för sig. Kastar Fel med varför.
function provaOrdination(db, o) {
  if (o.status !== 'aktiv' || (o.slut && o.slut < idag())) throw new Fel(400, 'Ordinationen pågår inte längre, så dosen kan inte ändras. Ordinera läkemedlet på nytt.', 'ogiltig');
  const t = stod.tillaggUt(db, o);
  if (t.trappning) throw new Fel(400, 'Ordinationen följer ett trappschema, där systemet räknar dosen för varje dag. Sätt ut den och ordinera ett nytt schema för att ändra det.', 'ogiltig');
  if (t.spadning) throw new Fel(400, 'Ordinationen har en spädning eller tillsats som är räknad på dosen. Sätt ut den och ordinera på nytt för att ändra dosen.', 'ogiltig');
  if (t.muntlig && !t.muntlig.signerad) throw new Fel(400, 'Den muntliga ordinationen är inte signerad av läkaren. Den signeras först, och sedan kan dosen ändras.', 'ogiltig');
  if (t.direktiv) throw new Fel(400, 'Ordinationen är gjord enligt ett generellt direktiv, med direktivets dos. En läkare ordinerar en annan dos.', 'ogiltig');
  return t;
}

// Produkterna som ordinationen kan bytas till: samma substans (ATC-kod) och samma beredningsform, med systemets förslag
// på dosering för var och en. Den nuvarande produkten står först.
function alternativ(atk, o) {
  const db = atk.db;
  const lm = katalog(db, o.lakemedel_id);
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const sm = substansmall(db, lm.atc, ve);
  const nu = doseringAv(o);
  const forra = produktmall(sm?.mall ?? null, lm).mall;
  return db.query('SELECT * FROM katalog WHERE atc = ? ORDER BY namn, id').all(lm.atc)
    .filter(x => formgrupp(x.form) === formgrupp(lm.form))
    .sort((a, b) => (a.id === lm.id ? -1 : b.id === lm.id ? 1 : (mgAv(a.styrka) ?? 0) - (mgAv(b.styrka) ?? 0)))
    .map(x => ({ id: x.id, namn: x.namn, styrka: x.styrka, form: x.form, nuvarande: x.id === lm.id, forslag: x.id === lm.id ? null : forslagFor(lm, x, nu, forra, produktmall(sm?.mall ?? null, x).mall) }));
}
// Doseringen när styrkan byts. Har mallen en egen dosering för den nya produkten, och följde ordinationen mallen för
// den förra, föreslås den nya produktens mall. Annars samma dosering och tider, och dosen räknad ur styrkan, så att
// patienten får samma antal tabletter.
function forslagFor(lm, ny, nu, forra, nyMall) {
  const a = mgAv(lm.styrka);
  const b = mgAv(ny.styrka);
  if (nyMall && forra && nu.dosering === forra.dosering && nyMall.dosering) {
    return { dosering: nyMall.dosering, dos: nyMall.dos ?? null, dosEnhet: nyMall.dosEnhet ?? null, tider: nyMall.tider ?? [], varfor: `Doseringen ur läkemedelsmallen ${nyMall.namn}.` };
  }
  if (a && b && nu.dos != null && nu.dosEnhet === 'mg') {
    const dos = Math.round(nu.dos * b / a * 1000) / 1000;
    return { dosering: nu.dosering, dos, dosEnhet: 'mg', tider: nu.tider, varfor: `Samma antal tabletter som förut, så dosen blir ${tal(dos)} mg med ${ny.styrka}.` };
  }
  return { dosering: nu.dosering, dos: null, dosEnhet: nu.dosEnhet, tider: nu.tider, varfor: 'Ange dosen för den nya styrkan.' };
}

// GET /api/ordination/:id/dosandring: ordinationen, produkterna den kan bytas till och de planerade ändringarna.
export function underlag(atk, o) {
  atk.krav('ordinera', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  sakraDosandring(atk.db);
  provaOrdination(atk.db, o);
  return {
    ordination: lakemedel.ordinationUt(atk.db, o, { historik: false }), alternativ: alternativ(atk, o), fran: idag(), franSenast: addDagar(idag(), FRAN_SENAST_DAGAR),
    planerade: planerade(atk.db, o.id), demoregler: true, anmarkning: lakemedel.DEMOREGLER,
  };
}

// POST /api/ordination/:id/dosandring { lakemedelId?, dosering, dos?, dosEnhet?, tider?, fran?, orsak?, kvitteradeVarningar? }.
export function andra(atk, o, inp = {}) {
  atk.krav('ordinera', { resurs: { enhet_id: o.enhet_id, gemensam: true } });
  const db = atk.db;
  sakraDosandring(db);
  provaOrdination(db, o);
  const lm = katalog(db, o.lakemedel_id);
  const nyId = typeof inp.lakemedelId === 'string' && inp.lakemedelId ? inp.lakemedelId : o.lakemedel_id;
  const ny = katalog(db, nyId);
  if (!ny || ny.atc !== lm.atc || formgrupp(ny.form) !== formgrupp(lm.form)) {
    throw new Fel(400, `En dosändring behåller substansen och formen (${lm.substans}, ${lm.form}). Byt till ett annat läkemedel genom att sätta ut och ordinera det nya.`, 'ogiltig', { falt: ['lakemedelId'] });
  }
  const fran = inp.fran ?? idag();
  if (!giltigtDatum(fran) || fran < idag() || fran > addDagar(idag(), FRAN_SENAST_DAGAR) || (o.slut && fran > o.slut)) {
    throw new Fel(400, `Ange från vilket datum den nya doseringen gäller: i dag eller senare${o.slut ? `, och senast när ordinationen slutar (${o.slut})` : ', och inom ett år'}.`, 'ogiltig', { falt: ['fran'] });
  }
  // Samma kontroll av fälten som en ny ordination (lakemedel.validera), med ordinationens orsak och uppföljning.
  const v = lakemedel.validera(db, { lakemedelId: ny.id, dosering: inp.dosering, dos: inp.dos, dosEnhet: inp.dosEnhet, tider: inp.tider, typ: o.typ, vidBehov: Boolean(o.vid_behov),
    ordinationsorsak: o.orsak, uppfoljningsdatum: o.uppfoljning < o.start ? o.start : o.uppfoljning, start: o.start, slut: o.slut });
  if (o.vid_behov && v.tider.length) throw new Fel(400, 'En ordination vid behov har inga fasta tider.', 'ogiltig', { falt: ['tider'] });
  const fore = doseringAv(o);
  const efter = { lakemedelId: ny.id, dosering: v.dosering, dos: v.dos, dosEnhet: v.dosEnhet, tider: v.tider };
  const text = andringText(db, fore, efter);
  if (!text) throw new Fel(400, 'Doseringen är oförändrad. Ändra dosen, doseringen, tiderna eller styrkan.', 'ogiltig', { falt: ['dosering'] });
  // Samma varningar som vid en ny ordination, utan ordinationen själv bland de aktiva.
  const u = lakemedel.underlag(atk);
  const varningar = lakemedel.varningar(db, atk.patientId, ny, u.aktiva.filter(x => x.id !== o.id), u);
  const kvitterade = Array.isArray(inp.kvitteradeVarningar) ? inp.kvitteradeVarningar : [];
  const saknas = [...new Set(varningar.filter(x => x.niva === 'allvarlig').map(x => x.regel))]
    .filter(regel => !kvitterade.some(k => k?.regel === regel && typeof k.motivering === 'string' && k.motivering.trim().length >= 3));
  if (saknas.length) throw new Fel(400, 'Allvarliga varningar måste kvitteras med motivering innan dosen ändras.', 'ogiltig', { varningar, kraverKvittens: saknas, demoregler: true });
  const orsak = typeof inp.orsak === 'string' && inp.orsak.trim() ? inp.orsak.trim().slice(0, 300) : null;
  const r = db.query('INSERT INTO dosandringar (ordination_id, enhet_id, fran, fore, efter, orsak, av, tid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(o.id, atk.personal.enhet_id, fran, JSON.stringify(fore), JSON.stringify(efter), orsak, atk.personal.id, iso());
  const id = Number(r.lastInsertRowid);
  historik(db, o.id, atk.personal.id, fran > idag() ? `Dosändring från ${fran}` : 'Dosen ändrad', `${text}${orsak ? ` Orsak: ${orsak}.` : ''}`);
  for (const k of kvitterade.filter(k => varningar.some(x => x.regel === k.regel && x.niva === 'allvarlig'))) historik(db, o.id, atk.personal.id, 'Varning kvitterad', `${k.regel}: ${String(k.motivering).trim().slice(0, 500)}`);
  // NLL får ändringen när den görs, med datumet då den gäller. Ett byte av styrka är en ny förskrivning som ersätter den
  // förra (simulerat).
  const nll = stod.UTAN_NLL.has(stod.produkttyp(db, ny.id).typ) ? { status: o.nll_status } : lakemedel.overfor(db, o.id, ny.id !== o.lakemedel_id ? 'ny_forskrivning' : 'andring');
  if (fran <= idag()) tillampa(db, db.query('SELECT * FROM dosandringar WHERE id = ?').get(id));
  const rad = lakemedel.hamtaRad(db, o.id);
  return { ordination: lakemedel.ordinationUt(db, rad), dosandring: dosandringUt(db, db.query('SELECT * FROM dosandringar WHERE id = ?').get(id)), varningar, nll };
}

function historik(db, ordId, personalId, handelse, detalj) {
  db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(ordId, iso(), personalId, handelse, detalj);
}

// Den nya doseringen börjar gälla: ordinationen får den nya produkten, doseringen, dosen och tiderna.
function tillampa(db, d) {
  const o = db.query('SELECT * FROM ordinationer WHERE id = ?').get(d.ordination_id);
  const nu = iso();
  if (!o || o.status !== 'aktiv' || (o.slut && o.slut < d.fran)) {
    db.query('UPDATE dosandringar SET tillampad = ? WHERE id = ?').run(nu, d.id);
    return;
  }
  const e = JSON.parse(d.efter);
  db.query('UPDATE ordinationer SET lakemedel_id = ?, dosering = ?, dos = ?, dos_enhet = ?, tider = ? WHERE id = ?').run(e.lakemedelId, e.dosering, e.dos, e.dosEnhet, JSON.stringify(e.tider), o.id);
  db.query('UPDATE dosandringar SET tillampad = ? WHERE id = ?').run(nu, d.id);
  if (d.fran > o.start && d.tid.slice(0, 10) < d.fran) historik(db, o.id, null, `Den nya doseringen gäller från ${d.fran}`, e.dosering);
}

// Ändringar vars datum har kommit gäller av sig själva. Körs när patientens ordinationer läses (lakemedel.js), så att
// listan, administreringen och FHIR alltid visar den dosering som gäller i dag.
export function tillampaDosandringar(db, patientId, dag = idag()) {
  if (!harTabell(db)) return;
  const rader = db.query(`SELECT d.* FROM dosandringar d JOIN ordinationer o ON o.id = d.ordination_id WHERE o.patient_id = ? AND d.tillampad IS NULL AND d.fran <= ?
    ORDER BY d.fran, d.tid, d.id`).all(patientId, dag);
  for (const d of rader) tillampa(db, d);
}

export function dosandringUt(db, d) {
  const e = JSON.parse(d.efter);
  const lm = katalog(db, e.lakemedelId);
  return { id: d.id, fran: d.fran, dosering: e.dosering, dos: e.dos, dosEnhet: e.dosEnhet, tider: e.tider, lakemedel: lm ? { id: lm.id, namn: lm.namn, styrka: lm.styrka, form: lm.form } : null,
    text: andringText(db, JSON.parse(d.fore), e), orsak: d.orsak, av: personNamn(db, d.av), tid: d.tid, galler: Boolean(d.tillampad) };
}
// Ändringar som är gjorda men ännu inte gäller, i den ordning de börjar gälla.
export function planerade(db, ordinationId) {
  if (!harTabell(db)) return [];
  return db.query('SELECT * FROM dosandringar WHERE ordination_id = ? AND tillampad IS NULL ORDER BY fran, tid, id').all(ordinationId).map(d => dosandringUt(db, d));
}
// Alla dosändringar i ordinationen, för historiken och FHIR.
export function dosandringarFor(db, ordinationId) {
  if (!harTabell(db)) return [];
  return db.query('SELECT * FROM dosandringar WHERE ordination_id = ? ORDER BY fran, tid, id').all(ordinationId).map(d => dosandringUt(db, d));
}
