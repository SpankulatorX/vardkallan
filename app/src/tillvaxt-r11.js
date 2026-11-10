// Runda 11, r7: tillväxten i version 1.1 (Sussa 4.1.1.4, 4.1.1.6, 4.1.1.7 och 4.1.1.8): pubertet enligt Tanners
// stadier, import av tillväxtdata från en fil eller från ett simulerat journalsystem genom tjänstekontraktet
// GetObservations, och valbara indikatorer med uppföljning för vårdenheten och regionen.
//
// Systemet är experten: för pubertet visas bara de mått som gäller barnets kön, och systemet räknar själv när
// puberteten började och säger till när den är tidig eller sen (demoregler). Vid import läser systemet filen, prövar
// varje värde mot rimliga gränser och mot barnets kurva, kontrollerar att filen gäller rätt patient och visar vilka
// värden som redan finns, innan något sparas. Ursprunget följer med som det var: den som läser in står som den som
// importerade, aldrig som den som mätte. Indikatorerna räknas ur det som redan är registrerat och visas utan
// personuppgifter, med varje liten cell spärrad för sig.
import { createHash } from 'node:crypto';
import { Fel, iso, datumAv } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder } from './atkomst.js';
import { kravVardande } from './administrering.js';
import { loggaRad } from './logg.js';
import * as journal from './journal.js';
import * as T from './tillvaxt.js';
import * as P from './bhv-program.js';
import { K11 } from './kodverk.js';

const DAG = 86400_000;
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
const harTabell = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));

export const SCHEMA = `
-- Pubertet enligt Tanners stadier (runda 11, r7, Sussa 4.1.1.4 och 4.1.1.6). Raden ändras aldrig.
CREATE TABLE IF NOT EXISTS tillvaxt_pubertet (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, brost INTEGER, genitalia INTEGER, pubes INTEGER,
  testikelvolym REAL, menarke TEXT, registrerad_av TEXT NOT NULL, registrerad TEXT NOT NULL,
  CHECK (brost IS NULL OR brost BETWEEN 1 AND 5), CHECK (genitalia IS NULL OR genitalia BETWEEN 1 AND 5), CHECK (pubes IS NULL OR pubes BETWEEN 1 AND 5)
);
CREATE TRIGGER IF NOT EXISTS tillvaxt_pubertet_andras_ej BEFORE UPDATE OF enhet_id, tid, brost, genitalia, pubes, testikelvolym, menarke, registrerad_av, registrerad ON tillvaxt_pubertet
  BEGIN SELECT RAISE(ABORT, 'En registrering av pubertet ändras inte. Registrera en ny.'); END;
CREATE TRIGGER IF NOT EXISTS tillvaxt_pubertet_raderas_ej BEFORE DELETE ON tillvaxt_pubertet BEGIN SELECT RAISE(ABORT, 'En registrering av pubertet raderas inte'); END;
-- Ursprunget för ett inläst mätvärde: källsystemet, vårdenheten och den som mätte där, och vem som läste in filen här.
-- Den som läste in står aldrig som den som registrerade mätvärdet.
CREATE TABLE IF NOT EXISTS tillvaxt_import (
  matvarde_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, kallsystem TEXT NOT NULL, ursprung_enhet TEXT, ursprung_av TEXT,
  fil_hash TEXT NOT NULL, importerad TEXT NOT NULL, importerad_av TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tillvaxt_import_pat ON tillvaxt_import (patient_id);
CREATE TRIGGER IF NOT EXISTS tillvaxt_import_andras_ej BEFORE UPDATE OF matvarde_id, enhet_id, kallsystem, ursprung_enhet, ursprung_av, fil_hash, importerad, importerad_av ON tillvaxt_import
  BEGIN SELECT RAISE(ABORT, 'Ursprunget för ett inläst värde ändras inte'); END;
-- Indikatorerna som barnavårdscentralen har valt. Varje val är en ny rad, och den senaste gäller.
CREATE TABLE IF NOT EXISTS bhv_indikatorval (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, indikatorer TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS bhv_indikatorval_andras_ej BEFORE UPDATE ON bhv_indikatorval BEGIN SELECT RAISE(ABORT, 'Ett val av indikatorer ändras inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

// Kontrollen av koderna i bilaga K11 mot Snomed CT (docs/kodkontroll.md, Runda 11): uppslagna en i taget på
// tx.fhir.org i SNOMED CT International Edition 20250201 den 2026-11-10. Kroppslängdens kod 248334005 Length of body är
// inaktiv sedan 2021-07-31 och står kvar ordagrant som i K11, eftersom registret tar emot K11:s koder. De aktiva
// begreppen är 1153637007 Body height och 1149101003 Recumbent body height. Koderna i den svenska utgåvans namnrymd finns
// inte i den internationella utgåvan och kontrolleras bara med kontrollsiffran och partitionen.
export const K11_KONTROLL = {
  utgava: 'http://snomed.info/sct/900000000000207008/version/20250201', datum: '2026-11-10',
  aktiva: ['364589006', '169886007', '169876006', '412726003', '27113001', '363812007', '248335006', '80943009', '707085002', '408864009', '473170005'],
  inaktiva: { '248334005': { text: 'Length of body', inaktivSedan: '2021-07-31', aktiva: ['1153637007', '1149101003'] } },
  svenska: ['53851000052106', '53861000052109'],
};

// ---------------------------------------------------------------------------------------------------------------
// Pubertet

export const TANNER_KALLA = 'Tanners stadier 1 till 5 (Marshall och Tanner 1969 och 1970). Snomed CT: 251811005 bröst, 251805007 genitalia och 251817009 pubesbehåring.';
export const PUBERTET = {
  brost: { namn: 'Bröst (B)', kon: 'kvinna', snomed: '251811005' },
  genitalia: { namn: 'Genitalia (G)', kon: 'man', snomed: '251805007' },
  pubes: { namn: 'Pubesbehåring (PH)', kon: null, snomed: '251817009' },
};
// Demoregler: pubertetens start är B2 för flickor och G2 eller testikelvolym minst 4 ml för pojkar. Tidig före 8 år
// (flickor) och 9 år (pojkar), sen om den inte har börjat vid 13 respektive 14 år.
export const PUBERTET_REGLER = { kvinna: { tidig: 8, sen: 13 }, man: { tidig: 9, sen: 14 } };
export const PUBERTET_DEMOREGEL = 'Gränserna för tidig och sen pubertet är demoregler, inte kliniskt beslutsstöd.';
const stadium = (v) => (v == null || v === '' ? null : (Number.isInteger(v) && v >= 1 && v <= 5 ? v : NaN));

export function pubertetFor(atk, p, nu = Date.now()) {
  if (!harTabell(atk.db, 'tillvaxt_pubertet') || !kanRoll(atk.personal, 'las_matvarden')) return null;
  const rader = atk.filtrera(atk.db.query('SELECT * FROM tillvaxt_pubertet WHERE patient_id = ? ORDER BY tid, id').all(p.id), 'las_matvarden');
  const ar = (t) => Math.round(T.alderManader(p.fodd, t) / 12 * 10) / 10;
  const poster = rader.map(r => ({
    id: r.id, tid: r.tid, alderAr: ar(r.tid), brost: r.brost, genitalia: r.genitalia, pubes: r.pubes, testikelvolym: r.testikelvolym, menarke: r.menarke, av: personNamn(atk.db, r.registrerad_av),
    text: [r.brost ? `B${r.brost}` : null, r.genitalia ? `G${r.genitalia}` : null, r.pubes ? `PH${r.pubes}` : null, r.testikelvolym ? `testiklar ${String(r.testikelvolym).replace('.', ',')} ml` : null, r.menarke ? `menarke ${r.menarke}` : null].filter(Boolean).join(', '),
  }));
  const kon = p.kon === 'kvinna' ? 'kvinna' : 'man';
  const borjat = (x) => (kon === 'kvinna' ? x.brost >= 2 : x.genitalia >= 2 || x.testikelvolym >= 4);
  const forsta = poster.find(borjat) ?? null;
  const alderNu = T.alderManader(p.fodd, nu) / 12;
  const g = PUBERTET_REGLER[kon];
  let bedomning = null;
  if (forsta && forsta.alderAr < g.tidig) bedomning = { niva: 'varning', text: `Puberteten började vid ${String(forsta.alderAr).replace('.', ',')} års ålder, före ${g.tidig} år. Det räknas som tidig pubertet.`, nastaSteg: 'Låt läkaren bedöma barnet och överväg remiss till barnläkare.' };
  else if (!forsta && alderNu >= g.sen) bedomning = { niva: 'varning', text: `Puberteten har inte börjat vid ${Math.floor(alderNu)} års ålder${poster.length ? ' enligt registreringarna' : ''}. Det räknas som sen pubertet.`, nastaSteg: poster.length ? 'Låt läkaren bedöma barnet och överväg remiss till barnläkare.' : 'Registrera pubertetsstadiet vid nästa besök.' };
  const mattFor = Object.entries(PUBERTET).filter(([, d]) => !d.kon || d.kon === kon).map(([id, d]) => ({ id, namn: d.namn }));
  return {
    poster, start: forsta ? { tid: forsta.tid, alderAr: forsta.alderAr, text: `Puberteten började vid ${String(forsta.alderAr).replace('.', ',')} år (${forsta.text}).` } : null,
    bedomning: bedomning ? { ...bedomning, demoregel: PUBERTET_DEMOREGEL } : null, matt: mattFor, testikelvolym: kon === 'man', menarke: kon === 'kvinna',
    visas: alderNu >= 7 || poster.length > 0, kalla: TANNER_KALLA,
  };
}

// POST /api/patient/:id/tillvaxt/pubertet { brost?, genitalia?, pubes?, testikelvolym?, menarke? }. Bara de mått som
// gäller barnets kön tas emot, så att ingen behöver veta vilka som ska fyllas i.
export function registreraPubertet(atk, p, body = {}, nu = new Date()) {
  kravVardande(atk, 'registrera_matvarde', null, 'tillvaxt:pubertet');
  const kon = p.kon === 'kvinna' ? 'kvinna' : 'man';
  const v = { brost: stadium(body.brost), genitalia: stadium(body.genitalia), pubes: stadium(body.pubes) };
  const fel = [];
  for (const [k, x] of Object.entries(v)) {
    if (Number.isNaN(x)) fel.push(`${PUBERTET[k].namn} anges som stadium 1 till 5.`);
    else if (x != null && PUBERTET[k].kon && PUBERTET[k].kon !== kon) fel.push(`${PUBERTET[k].namn} registreras inte för det här barnet.`);
  }
  let testikel = null;
  if (body.testikelvolym != null && body.testikelvolym !== '') {
    testikel = typeof body.testikelvolym === 'number' ? body.testikelvolym : typeof body.testikelvolym === 'string' && /^\d+([.,]\d)?$/.test(body.testikelvolym.trim()) ? Number(body.testikelvolym.trim().replace(',', '.')) : NaN;
    if (kon !== 'man') fel.push('Testikelvolym registreras inte för det här barnet.');
    else if (!(testikel >= 1 && testikel <= 25)) fel.push('Testikelvolymen anges i ml, 1 till 25.');
  }
  let menarke = null;
  if (body.menarke != null && body.menarke !== '') {
    menarke = typeof body.menarke === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.menarke) ? body.menarke : null;
    if (kon !== 'kvinna') fel.push('Menarke registreras inte för det här barnet.');
    else if (!menarke || menarke < p.fodd || menarke > datumAv(nu)) fel.push('Datumet för menarke ska ligga mellan födelsen och i dag.');
  }
  if (!fel.length && v.brost == null && v.genitalia == null && v.pubes == null && testikel == null && menarke == null) fel.push('Fyll i minst ett stadium.');
  if (fel.length) throw new Fel(400, fel.join(' '), 'ogiltig', { falt: ['pubertet'] });
  const id = Number(atk.db.query('INSERT INTO tillvaxt_pubertet (patient_id, enhet_id, tid, brost, genitalia, pubes, testikelvolym, menarke, registrerad_av, registrerad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, atk.personal.enhet_id, nu.toISOString(), v.brost, v.genitalia, v.pubes, testikel, menarke, atk.personal.id, nu.toISOString()).lastInsertRowid);
  atk.logga('registrera_matvarde', atk.grund(), `tillvaxt:pubertet:${id}`);
  const ut = pubertetFor(atk, p, nu.getTime());
  return [201, { pubertet: ut, text: `Pubertetsstadiet är registrerat${ut.start ? `. ${ut.start.text}` : ''}.` }];
}

// ---------------------------------------------------------------------------------------------------------------
// Import

export const MAX_TECKEN = 48_000;
export const MAX_RADER = 200;
const PNR = (s) => String(s ?? '').replace(/\D/g, '');
// Koderna som läses: LOINC och Snomed CT, med de aktiva Snomed-begreppen för längd (docs/kodkontroll.md).
const KODER = new Map([
  ['http://loinc.org|29463-7', 'vikt'], ['http://loinc.org|8302-2', 'langd'], ['http://loinc.org|9843-4', 'huvudomfang'],
  ['http://snomed.info/sct|27113001', 'vikt'], ['http://snomed.info/sct|248334005', 'langd'], ['http://snomed.info/sct|1153637007', 'langd'], ['http://snomed.info/sct|1149101003', 'langd'],
  ['http://snomed.info/sct|363812007', 'huvudomfang'], ['http://snomed.info/sct|248335006', 'sitthojd'],
  // RIV-TA anger kodsystemet med OID: Snomed CT i Sverige 1.2.752.116.2.1.1 (K11).
  [`${K11.oid.snomed}|27113001`, 'vikt'], [`${K11.oid.snomed}|248334005`, 'langd'], [`${K11.oid.snomed}|1153637007`, 'langd'], [`${K11.oid.snomed}|363812007`, 'huvudomfang'], [`${K11.oid.snomed}|248335006`, 'sitthojd'],
]);
const MATT_CSV = { vikt: 'vikt', langd: 'langd', 'längd': 'langd', huvudomfang: 'huvudomfang', 'huvudomfång': 'huvudomfang', sitthojd: 'sitthojd', 'sitthöjd': 'sitthojd' };
const ENHETER = { vikt: { kg: 1, g: 0.001 }, langd: { cm: 1, m: 100, mm: 0.1 }, huvudomfang: { cm: 1, mm: 0.1 }, sitthojd: { cm: 1, m: 100, mm: 0.1 } };
export const FORMAT = { fhir: 'FHIR R4 Bundle (JSON) med Observation', csv: 'CSV med kolumnerna personnummer, datum, mått, värde, enhet och vårdenhet, åtskilda med semikolon', riv: 'Svar från tjänstekontraktet GetObservations (JSON)' };
export const SIMULERAT_SYSTEM = 'Barnavårdscentralen Norrby (simulerat journalsystem i en annan region)';

// Raderna i en fil som { pnr, typ, tid, varde, enhet, ursprungEnhet, ursprungAv }, eller ett fel som gäller hela filen.
function lasRader(format, innehall) {
  if (typeof innehall !== 'string' || !innehall.trim()) throw new Fel(400, 'Filen är tom.', 'ogiltig', { falt: ['innehall'] });
  if (innehall.length > MAX_TECKEN) throw new Fel(400, `Filen är för stor. Högst ${MAX_TECKEN.toLocaleString('sv-SE')} tecken läses in åt gången.`, 'ogiltig', { falt: ['innehall'] });
  if (format === 'csv') {
    const rader = innehall.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const NAMN = { 'mått': 'matt', 'värde': 'varde', 'vårdenhet': 'vardenhet' };
    const huvud = rader[0].toLowerCase().split(/[;,\t]/).map(x => x.trim()).map(x => NAMN[x] ?? x);
    const kol = (n) => huvud.indexOf(n);
    if (kol('personnummer') < 0 || kol('datum') < 0 || kol('matt') < 0 || kol('varde') < 0) throw new Fel(400, 'Första raden ska ha kolumnerna personnummer, datum, mått och värde, och gärna enhet och vårdenhet.', 'ogiltig', { falt: ['innehall'] });
    return rader.slice(1).map(r => {
      const c = r.split(/[;\t]/).map(x => x.trim());
      return { pnr: PNR(c[kol('personnummer')]), typ: MATT_CSV[(c[kol('matt')] ?? '').toLowerCase()] ?? null, tid: c[kol('datum')], varde: c[kol('varde')], enhet: kol('enhet') >= 0 ? c[kol('enhet')] : null, ursprungEnhet: kol('vardenhet') >= 0 ? c[kol('vardenhet')] || null : null, ursprungAv: null };
    });
  }
  let j;
  try { j = JSON.parse(innehall); } catch { throw new Fel(400, 'Filen går inte att läsa som JSON.', 'ogiltig', { falt: ['innehall'] }); }
  if (format === 'riv') {
    if (!Array.isArray(j?.observation)) throw new Fel(400, 'Svaret från GetObservations saknar listan observation.', 'ogiltig', { falt: ['innehall'] });
    return j.observation.map(o => {
      const c = o?.body?.observationCode ?? {};
      const t = String(o?.body?.observationTime ?? '');
      return { pnr: PNR(o?.header?.patientId?.id), typ: KODER.get(`${c.codeSystem}|${c.code}`) ?? null, tid: /^\d{8}/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : t, varde: o?.body?.value?.pq?.value, enhet: o?.body?.value?.pq?.unit ?? null,
        ursprungEnhet: o?.header?.accountableHealthcareProfessional?.healthcareProfessionalCareUnitName ?? null, ursprungAv: o?.header?.accountableHealthcareProfessional?.healthcareProfessionalName ?? null };
    });
  }
  if (j?.resourceType !== 'Bundle' || !Array.isArray(j.entry)) throw new Fel(400, 'Filen ska vara en FHIR Bundle med Observation.', 'ogiltig', { falt: ['innehall'] });
  return j.entry.map(e => e?.resource).filter(r => r?.resourceType === 'Observation').map(r => {
    const typ = (r.code?.coding ?? []).map(c => KODER.get(`${c.system}|${c.code}`)).find(Boolean) ?? null;
    return { pnr: PNR(r.subject?.identifier?.value), typ, tid: r.effectiveDateTime ?? null, varde: r.valueQuantity?.value, enhet: r.valueQuantity?.code ?? r.valueQuantity?.unit ?? null,
      ursprungEnhet: r.performer?.find?.(x => x?.reference?.startsWith?.('Organization'))?.display ?? null, ursprungAv: r.performer?.find?.(x => x?.reference?.startsWith?.('Practitioner'))?.display ?? null };
  });
}

// Förhandsgranskningen: varje rad med status ny, finns (samma mått samma dag finns redan bland det användaren ser) eller
// fel med orsaken. Gäller filen en annan patient avvisas hela filen, med samma svar oavsett vilken patient den gäller.
export function granska(atk, p, { format, innehall, kalla = null }, nu = Date.now()) {
  if (!Object.hasOwn(FORMAT, format)) throw new Fel(400, 'Välj filens format: FHIR, CSV eller svaret från GetObservations.', 'ogiltig', { falt: ['format'] });
  const rader = lasRader(format, innehall);
  if (!rader.length) throw new Fel(400, 'Filen har inga mätvärden.', 'ogiltig', { falt: ['innehall'] });
  if (rader.length > MAX_RADER) throw new Fel(400, `Filen har ${rader.length} mätvärden. Högst ${MAX_RADER} läses in åt gången.`, 'ogiltig', { falt: ['innehall'] });
  // Patientens identitet: varje rad ska ange barnets personnummer. Annars läses inget in.
  if (rader.some(r => r.pnr !== PNR(p.personnummer))) throw new Fel(400, 'Filen gäller inte den här patienten, eller saknar personnummer på någon rad. Inget är inläst. Kontrollera att du har öppnat rätt journal och rätt fil.', 'ogiltig', { falt: ['innehall'] });
  const synliga = journal.synligaMatvarden(new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden'));
  const hash = createHash('sha256').update(`${format}\n${innehall}`).digest('hex');
  const redan = atk.db.query('SELECT count(*) AS n FROM tillvaxt_import WHERE patient_id = ? AND fil_hash = ?').get(p.id, hash).n;
  const granskade = rader.map((r, i) => {
    const fel = (orsak) => ({ index: i, typ: r.typ, namn: r.typ ? T.MATT[r.typ].namn : null, tid: r.tid, varde: r.varde, status: 'fel', orsak });
    if (!r.typ) return fel('Måttet känns inte igen. Vikt, längd, huvudomfång och sitthöjd läses in.');
    const ms = Date.parse(r.tid);
    if (!Number.isFinite(ms)) return fel('Datumet går inte att läsa.');
    const datum = new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    if (datum < p.fodd || ms > nu) return fel('Datumet ligger före födelsen eller i framtiden.');
    const faktor = r.enhet == null || r.enhet === '' ? 1 : ENHETER[r.typ][String(r.enhet).toLowerCase()];
    if (faktor == null) return fel(`Enheten ${String(r.enhet).slice(0, 10)} känns inte igen för ${T.MATT[r.typ].namn.toLowerCase()}.`);
    const v = typeof r.varde === 'number' ? r.varde : typeof r.varde === 'string' && /^\d+([.,]\d+)?$/.test(r.varde.trim()) ? Number(r.varde.trim().replace(',', '.')) : NaN;
    const varde = Math.round(v * faktor * 1000) / 1000;
    const def = journal.MATTYPER[r.typ];
    if (!Number.isFinite(varde) || varde < def.min || varde > def.max) return fel(`${def.namn} ${Number.isFinite(varde) ? String(varde).replace('.', ',') : ''} ${def.enhet} går inte att mäta. Värdet ska vara mellan ${def.min} och ${def.max}.`.replace('  ', ' '));
    // Rimligt för barnets ålder: mer än fem standardavvikelser från referensen är troligen ett fel.
    const z = T.zVarde(r.typ, p.kon, T.alderManader(p.fodd, ms), varde);
    if (z != null && Math.abs(z) > 5) return fel(`${def.namn} ${String(varde).replace('.', ',')} ${def.enhet} ligger mer än fem standardavvikelser från referensen för barnets ålder och är troligen fel.`);
    const finns = synliga.some(m => m.typ === r.typ && new Date(m.tid).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) === datum && Math.abs((m.varde_num ?? Number(m.varde)) - varde) < (r.typ === 'vikt' ? 0.05 : 0.5));
    return { index: i, typ: r.typ, namn: def.namn, tid: new Date(ms).toISOString(), datum, varde, enhet: def.enhet, ursprungEnhet: r.ursprungEnhet ? String(r.ursprungEnhet).slice(0, 120) : null, ursprungAv: r.ursprungAv ? String(r.ursprungAv).slice(0, 120) : null,
      status: finns ? 'finns' : 'ny', orsak: finns ? 'Samma mått samma dag finns redan i journalen.' : null };
  });
  const n = (s) => granskade.filter(x => x.status === s).length;
  const kallsystem = kalla ?? (format === 'riv' ? SIMULERAT_SYSTEM : 'Fil');
  return { format, formatText: FORMAT[format], kallsystem, hash, redanInlast: redan > 0, rader: granskade, antal: { ny: n('ny'), finns: n('finns'), fel: n('fel') },
    text: redan ? 'Filen är redan inläst.' : `${n('ny')} nya mätvärden kan läsas in. ${n('finns')} finns redan och ${n('fel')} går inte att läsa in.` };
}

// POST /api/patient/:id/tillvaxt/import { format, innehall, hash, rader? }: läser in de nya raderna efter
// förhandsgranskningen. hash ska vara den som granskningen gav, så att det som läses in är det som granskades.
export function importera(atk, p, body = {}, nu = new Date()) {
  kravVardande(atk, 'registrera_matvarde', null, 'tillvaxt:import');
  const g = granska(atk, p, { format: body.format, innehall: body.innehall, kalla: body.format === 'riv' ? SIMULERAT_SYSTEM : null }, nu.getTime());
  if (body.hash !== g.hash) throw new Fel(400, 'Filen har ändrats sedan den granskades. Granska den igen.', 'ogiltig', { falt: ['hash'] });
  if (g.redanInlast) throw new Fel(400, 'Filen är redan inläst.', 'ogiltig', { falt: ['innehall'] });
  const valda = Array.isArray(body.rader) ? new Set(body.rader.filter(Number.isInteger)) : null;
  const nya = g.rader.filter(r => r.status === 'ny' && (!valda || valda.has(r.index)));
  if (!nya.length) throw new Fel(400, 'Det finns inga nya mätvärden att läsa in.', 'ogiltig', { falt: ['rader'] });
  const db = atk.db;
  const t = nu.toISOString();
  db.transaction(() => {
    for (const r of nya) {
      const id = Number(db.query("INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'import')")
        .run(p.id, atk.personal.enhet_id, r.typ, String(r.varde), r.varde, r.enhet, r.tid).lastInsertRowid);
      db.query('INSERT INTO tillvaxt_import (matvarde_id, patient_id, enhet_id, kallsystem, ursprung_enhet, ursprung_av, fil_hash, importerad, importerad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, p.id, atk.personal.enhet_id, g.kallsystem, r.ursprungEnhet, r.ursprungAv, g.hash, t, atk.personal.id);
    }
  })();
  atk.logga('registrera_matvarde', atk.grund(), `tillvaxt:import:${nya.length}`);
  return [201, { antal: nya.length, text: `${nya.length} mätvärden från ${g.kallsystem} är inlästa och syns på kurvorna. Ursprunget står vid varje värde.` }];
}

// Ursprunget för ett inläst värde, för tabellen under kurvan.
export function ursprungFor(db, matvardeId) {
  if (!harTabell(db, 'tillvaxt_import')) return null;
  const r = db.query('SELECT * FROM tillvaxt_import WHERE matvarde_id = ?').get(matvardeId);
  return r ? { kallsystem: r.kallsystem, enhet: r.ursprung_enhet, av: r.ursprung_av, importerad: r.importerad, importeradAv: personNamn(db, r.importerad_av) } : null;
}

// Det simulerade journalsystemet i en annan region svarar på GetObservations med barnets mätningar där: vikt, längd
// och huvudomfång vid sex, tolv och arton månader och vid två, tre och fyra år, så långt barnet hunnit. Värdena räknas ur
// WHO:s referens och är påhittade. Barn med skyddade personuppgifter finns inte i det simulerade systemet.
export function simuleratSvar(p, nu = Date.now()) {
  const ut = [];
  if (p.skyddad) return { observation: ut, result: { resultCode: 'OK', message: 'Simulerat journalsystem i en annan region. Inga uppgifter.' } };
  const z = { vikt: 0.2, langd: 0.3, huvudomfang: 0.1 };
  for (const man of [6, 12, 18, 24, 36, 48]) {
    const t = Date.parse(`${p.fodd}T10:00:00Z`) + man * 30.4375 * DAG;
    if (t > nu - 30 * DAG) break;
    for (const m of ['vikt', 'langd', 'huvudomfang']) {
      if (m === 'huvudomfang' && man > 24) continue;
      const l = T.lms(m, p.kon, man);
      if (!l) continue;
      const v = Math.round(T.vardeVidZ(l, z[m]) * (m === 'vikt' ? 100 : 10)) / (m === 'vikt' ? 100 : 10);
      ut.push({ header: { patientId: { id: PNR(p.personnummer), type: '1.2.752.129.2.1.3.1' }, sourceSystemHSAId: 'SE0000000000-SIM1', accountableHealthcareProfessional: { healthcareProfessionalCareUnitName: SIMULERAT_SYSTEM.split(' (')[0], healthcareProfessionalName: 'BHV-sjuksköterska (simulerad)' } },
        body: { observationCode: { code: K11.tillvaxt[m].kod, codeSystem: K11.oid.snomed }, value: { pq: { value: v, unit: T.MATT[m].enhet } }, observationTime: new Date(t).toISOString().slice(0, 10).replace(/-/g, '') + '100000' } });
    }
  }
  return { observation: ut, result: { resultCode: 'OK', logId: createHash('sha256').update(p.id).digest('hex').slice(0, 16), message: 'Simulerat journalsystem i en annan region, utan tjänsteplattformen. Värdena är påhittade.' } };
}

// ---------------------------------------------------------------------------------------------------------------
// Indikatorer för uppföljning (4.1.1.8)

const barnPa = (db, ve) => db.query('SELECT p.* FROM bhv_inskrivning i JOIN patienter p ON p.id = i.patient_id WHERE i.enhet_id = ? AND p.sammanslagen_till IS NULL').all(ve);
const uppgift = (db, pid, typ) => db.query('SELECT 1 FROM tillvaxt_uppgifter WHERE patient_id = ? AND typ = ? LIMIT 1').get(pid, typ);
// Varje indikator räknar täljare och nämnare ur det som är registrerat på vårdenheten.
export const INDIKATORER = [
  { id: 'besok_i_tid', text: 'Hälsobesök gjorda i tid', raknar: (db, barn, nu) => {
    let n = 0, t = 0;
    for (const b of P.BESOK) for (const p of barn) {
      if (P.alderDagar(p.fodd, nu) <= b.fonster[1]) continue;
      n++;
      const r = db.query("SELECT tid FROM bhv_besok WHERE patient_id = ? AND besok_id = ? AND status = 'genomfort'").get(p.id, b.id);
      if (r) { const d = P.alderDagar(p.fodd, Date.parse(r.tid)); if (d >= b.fonster[0] && d <= b.fonster[1]) t++; }
    }
    return [t, n];
  } },
  { id: 'besok_med_matt', text: 'Hälsobesök med alla mått i programmet', raknar: (db, barn) => {
    let n = 0, t = 0;
    for (const p of barn) for (const r of db.query("SELECT * FROM bhv_besok WHERE patient_id = ? AND status = 'genomfort'").all(p.id)) {
      const b = P.BESOK.find(x => x.id === r.besok_id);
      if (!b || !b.matt?.length) continue;
      n++;
      if (db.query(`SELECT count(DISTINCT typ) AS n FROM matvarden WHERE vardkontakt_id = ? AND typ IN (${b.matt.map(() => '?').join(', ')})`).get(r.vardkontakt_id, ...b.matt).n === b.matt.length) t++;
    }
    return [t, n];
  } },
  { id: 'vaccinationstackning', text: 'Vaccinationer i programmet givna i tid', raknar: (db, barn, nu) => {
    let n = 0, t = 0;
    for (const v of P.VACCINER.filter(x => x.id !== 'bcg')) {
      const b = P.BESOK.find(x => x.vacciner.includes(v.id));
      const grans = b ? b.fonster[1] : v.alder + 60;
      for (const p of barn.filter(x => P.alderDagar(x.fodd, nu) > grans)) { n++; if (db.query('SELECT 1 FROM vaccinationer WHERE patient_id = ? AND vaccin_id = ?').get(p.id, v.id)) t++; }
    }
    return [t, n];
  } },
  { id: 'fodelsedata', text: 'Barn med födelsevikt, födelselängd, huvudomfång vid födelsen och graviditetslängd', raknar: (db, barn) => [barn.filter(p => ['fodelsevikt', 'fodelselangd', 'fodelse_huvudomfang', 'graviditetslangd'].every(t => uppgift(db, p.id, t))).length, barn.length] },
  { id: 'malangd', text: 'Barn med båda föräldrarnas längd, så att målängden räknas', raknar: (db, barn) => [barn.filter(p => uppgift(db, p.id, 'langd_mor') && uppgift(db, p.id, 'langd_far')).length, barn.length] },
  { id: 'tb_risk', text: 'Barn med bedömd risk för tuberkulos', raknar: (db, barn) => [barn.filter(p => uppgift(db, p.id, 'tb_risk')).length, barn.length] },
  { id: 'hemmatningar', text: 'Mätningar hemma som hanterades inom sju dagar', raknar: (db, barn) => {
    const r = barn.flatMap(p => db.query("SELECT skapad, hanterad_tid, status FROM hemmatningar WHERE patient_id = ?").all(p.id));
    return [r.filter(x => x.status !== 'vantar' && Date.parse(x.hanterad_tid) - Date.parse(x.skapad) <= 7 * DAG).length, r.length];
  } },
  { id: 'pubertet', text: 'Barn från tolv år med registrerat pubertetsstadium', raknar: (db, barn, nu) => {
    const aldre = barn.filter(p => T.alderManader(p.fodd, nu) >= 144);
    return [aldre.filter(p => harTabell(db, 'tillvaxt_pubertet') && db.query('SELECT 1 FROM tillvaxt_pubertet WHERE patient_id = ? LIMIT 1').get(p.id)).length, aldre.length];
  } },
];
export const STANDARDVAL = ['besok_i_tid', 'besok_med_matt', 'vaccinationstackning'];
const PER_ID = new Map(INDIKATORER.map(i => [i.id, i]));
export const LITEN = 5;
// Ett värde med varje liten cell spärrad för sig: färre än fem i nämnaren, täljaren eller resten ger inget tal.
export function cell([t, n]) {
  if (!n) return { taljare: null, namnare: 0, procent: null, text: 'Inget underlag' };
  if (n < LITEN || (t > 0 && t < LITEN) || (n - t > 0 && n - t < LITEN)) return { taljare: null, namnare: null, procent: null, spärrad: true, text: 'Färre än 5' };
  return { taljare: t, namnare: n, procent: Math.round(t / n * 1000) / 10, text: `${Math.round(t / n * 1000) / 10} procent (${t} av ${n})` };
}

export function valFor(db, ve) {
  const r = harTabell(db, 'bhv_indikatorval') ? db.query('SELECT indikatorer FROM bhv_indikatorval WHERE enhet_id = ? ORDER BY id DESC LIMIT 1').get(ve) : null;
  const v = r ? JSON.parse(r.indikatorer).filter(x => PER_ID.has(x)) : STANDARDVAL;
  return v.length ? v : STANDARDVAL;
}
const kravBvc = (personal) => { if (!kanRoll(personal, 'rapportera_bhvq')) throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad'); };

// GET /api/bhv/indikatorer: vårdenhetens valda indikatorer med värden, och katalogen. Inom vårdenheten visas täljare och
// nämnare som antal, aldrig vilka barn det gäller.
export function indikatorer(db, personal, nu = Date.now()) {
  kravBvc(personal);
  const ve = vardenhetFor(db, personal.enhet_id);
  const barn = barnPa(db, ve);
  const valda = valFor(db, ve);
  return {
    enhet: enhetsnamn(db, ve), antalBarn: barn.length, valda, katalog: INDIKATORER.map(i => ({ id: i.id, text: i.text, vald: valda.includes(i.id) })),
    resultat: valda.map(id => { const i = PER_ID.get(id); const [t, n] = i.raknar(db, barn, nu); return { id, text: i.text, taljare: t, namnare: n, procent: n ? Math.round(t / n * 1000) / 10 : null }; }),
    text: 'Indikatorerna räknas ur det som redan är registrerat. De visar antal, aldrig vilka barn det gäller.',
  };
}
// POST /api/bhv/indikatorer { indikatorer: [...] }: barnavårdscentralen väljer sina indikatorer.
export function valjIndikatorer(db, personal, body = {}, nu = new Date()) {
  kravBvc(personal);
  const lista = Array.isArray(body.indikatorer) ? body.indikatorer : null;
  if (!lista || !lista.length || lista.length > INDIKATORER.length || lista.some(x => typeof x !== 'string' || !PER_ID.has(x))) throw new Fel(400, 'Välj minst en indikator ur listan.', 'ogiltig', { falt: ['indikatorer'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  db.query('INSERT INTO bhv_indikatorval (enhet_id, indikatorer, tid, av) VALUES (?, ?, ?, ?)').run(ve, JSON.stringify([...new Set(lista)]), nu.toISOString(), personal.id);
  return indikatorer(db, personal, nu.getTime());
}

// GET /api/bhv/indikatorer/region: uppföljningsrollen ser alla indikatorer för varje barnavårdscentral, med varje liten
// cell spärrad för sig. Regionens summa räknas bara på de vårdenheter vars cell visas, så att en spärrad cell inte kan
// räknas fram som skillnaden mellan summan och de andra.
export function region(db, personal, nu = Date.now()) {
  if (!kanRoll(personal, 'statistik_region')) throw new Fel(403, 'Din yrkesroll ser inte regionens uppföljning.', 'nekad');
  const enheter = db.query('SELECT DISTINCT enhet_id FROM bhv_inskrivning ORDER BY enhet_id').all().map(r => r.enhet_id);
  const rader = enheter.map(ve => ({ ve, barn: barnPa(db, ve) }));
  const ut = INDIKATORER.map(i => {
    const per = rader.map(({ ve, barn }) => ({ enhet: enhetsnamn(db, ve), varde: cell(i.raknar(db, barn, nu)) }));
    const visade = per.filter(x => x.varde.taljare != null);
    const t = visade.reduce((s, x) => s + x.varde.taljare, 0), n = visade.reduce((s, x) => s + x.varde.namnare, 0);
    return { id: i.id, text: i.text, enheter: per, region: visade.length ? cell([t, n]) : { taljare: null, namnare: null, procent: null, text: 'Inget underlag som kan visas' } };
  });
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik_region', resurs: 'bhv:indikatorer:region', grund: 'uppfoljning', resultat: 'tillaten' });
  return { antalEnheter: enheter.length, indikatorer: ut, text: 'Celler med färre än fem barn eller besök visas inte. Regionens summa räknas bara på vårdenheter vars värden visas.' };
}

export { iso, enheterUnder };
