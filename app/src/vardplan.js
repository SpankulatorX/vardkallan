// Vårdplaner (Sussa 3.2.2.1 och 3.2.2.2): standardiserade vårdplaner som mallar och individuella planer med mål,
// åtgärder, ansvarig yrkesroll och uppföljningsdatum.
//
// Systemet är experten. Det föreslår en standardplan ur patientens diagnoser och sammanhang (inneliggande, ålder,
// pågående tvångsvård), fyller i mål, åtgärder, ansvarig och uppföljningsdatum ur mallen, och användaren sätter upp
// planen med ett klick och anpassar den efter patienten. Systemet bevakar uppföljningen, ser själv när en åtgärd som
// gäller ett mätvärde är gjord (till exempel daglig vikt) och visar avvikelser från planen i översikten och i inkorgen.
// Mallarna är demoregler, inte granskade av vården.
//
// Behörighet. En vårdplan hör till den vårdenhet som upprättade den och har inre sekretess och spärr som annan
// journalinformation. Läkare och sjuksköterskor upprättar, ändrar och följer upp planer på sin vårdenhet, och den som
// har en åtgärd registrerar att den är utförd: undersköterskan sina, sjuksköterskan sina och undersköterskans, läkaren
// alla. Nödåtkomst ger bara läsning. Planernas historik ändras och raderas aldrig.
import { Fel, iso, idag, addDagar, giltigtDatum } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder, alder } from './atkomst.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS vardplaner (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, mall TEXT, rubrik TEXT NOT NULL, grund TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv', uppfoljning TEXT NOT NULL, skapad TEXT NOT NULL, skapad_av TEXT NOT NULL,
  CHECK (status IN ('aktiv', 'pausad', 'avslutad'))
);
CREATE TABLE IF NOT EXISTS vardplan_mal (
  id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL, text TEXT NOT NULL, borttagen TEXT, skapad TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vardplan_atgarder (
  id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL, text TEXT NOT NULL, ansvarig TEXT NOT NULL, dagligen INTEGER NOT NULL DEFAULT 0,
  matvarde TEXT, borttagen TEXT, skapad TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vardplan_utfort (
  id INTEGER PRIMARY KEY, atgard_id INTEGER NOT NULL, plan_id INTEGER NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vardplan_historik (
  id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, enhet_id TEXT, typ TEXT NOT NULL, text TEXT, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS vp_historik_andras_ej BEFORE UPDATE ON vardplan_historik BEGIN SELECT RAISE(ABORT, 'Vårdplanens historik ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vp_historik_raderas_ej BEFORE DELETE ON vardplan_historik BEGIN SELECT RAISE(ABORT, 'Vårdplanens historik raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS vp_utfort_andras_ej BEFORE UPDATE ON vardplan_utfort BEGIN SELECT RAISE(ABORT, 'En utförd åtgärd ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS vp_utfort_raderas_ej BEFORE DELETE ON vardplan_utfort BEGIN SELECT RAISE(ABORT, 'En utförd åtgärd raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS vp_raderas_ej BEFORE DELETE ON vardplaner BEGIN SELECT RAISE(ABORT, 'En vårdplan raderas inte'); END;
`;
export const sakraSchema = (db) => db.exec(SCHEMA);

export const DEMOREGLER = 'Standardplanerna och när systemet föreslår dem är demoregler för att visa flödet. De är inte granskade av vården.';
export const ANSVARIGA = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', underskoterska: 'Undersköterska' };
// Vem som får registrera en åtgärd som utförd, efter åtgärdens ansvariga yrkesroll.
const FAR_UTFORA = { lakare: ['lakare'], sjukskoterska: ['sjukskoterska', 'lakare'], underskoterska: ['underskoterska', 'sjukskoterska', 'lakare'] };
export const MALSTATUS = { uppnatt: 'Uppnått', delvis: 'Delvis uppnått', ej_uppnatt: 'Inte uppnått' };

// Standardplanerna (demoregler). villkor får patientens sammanhang och ger skälet till förslaget eller null.
const a = (text, ansvarig, extra = {}) => ({ text, ansvarig, dagligen: false, matvarde: null, ...extra });
export const MALLAR = [
  {
    id: 'hjartsvikt', rubrik: 'Hjärtsvikt', uppfoljningDagar: 7,
    villkor: (k) => k.diagnos('I50') && `Patienten har diagnosen ${k.diagnos('I50').text} (${k.diagnos('I50').kod}).`,
    mal: ['Patienten känner igen tecken på försämring och vet när vården ska kontaktas', 'Vikten ökar inte mer än 2 kg på tre dagar', 'Patienten kan sköta sina läkemedel själv'],
    atgarder: [a('Daglig vikt på morgonen före frukost', 'underskoterska', { dagligen: true, matvarde: 'vikt' }), a('Vätskelista och bedömning av vätskebalansen', 'sjukskoterska', { dagligen: true }),
      a('Information om egenvård vid hjärtsvikt', 'sjukskoterska'), a('Läkemedelsgenomgång och optimering av hjärtsviktsbehandlingen', 'lakare'), a('Remiss till hjärtsviktsmottagningen inför utskrivningen', 'lakare')],
  },
  {
    id: 'trycksar', rubrik: 'Förebyggande av trycksår', uppfoljningDagar: 3,
    villkor: (k) => (k.diagnos('L89') ? `Patienten har diagnosen ${k.diagnos('L89').text}.` : k.inlagd && k.alder >= 75 ? `Patienten är ${k.alder} år och inneliggande, vilket ger ökad risk för trycksår.` : null),
    mal: ['Huden är hel', 'Patienten får i sig tillräckligt med mat och dryck'],
    atgarder: [a('Riskbedömning för trycksår och hudinspektion', 'sjukskoterska', { dagligen: true }), a('Lägesändring enligt schema dag och natt', 'underskoterska', { dagligen: true }),
      a('Tryckavlastande madrass', 'sjukskoterska'), a('Bedömning av nutrition och vikt', 'sjukskoterska')],
  },
  {
    id: 'diabetes', rubrik: 'Diabetes', uppfoljningDagar: 14,
    villkor: (k) => { const d = k.diagnos('E10') ?? k.diagnos('E11'); return d && `Patienten har diagnosen ${d.text} (${d.kod}).`; },
    mal: ['Glukosvärden inom de mål som läkaren har satt', 'Patienten kan känna igen och behandla lågt blodsocker'],
    atgarder: [a('Glukoskontroll enligt ordination', 'sjukskoterska', { dagligen: true }), a('Fotundersökning', 'sjukskoterska'), a('Information om egenvård vid diabetes', 'sjukskoterska'), a('Bedömning av behandlingen', 'lakare')],
  },
  {
    id: 'fall', rubrik: 'Förebyggande av fall', uppfoljningDagar: 7,
    villkor: (k) => (k.diagnos('R29') ? `Patienten har diagnosen ${k.diagnos('R29').text}.` : k.inlagd && k.alder >= 80 ? `Patienten är ${k.alder} år och inneliggande, vilket ger ökad risk för fall.` : null),
    mal: ['Patienten faller inte under vårdtiden'],
    atgarder: [a('Riskbedömning för fall', 'sjukskoterska'), a('Hjälp vid förflyttning och toalettbesök', 'underskoterska', { dagligen: true }), a('Genomgång av läkemedel som ökar risken för fall', 'lakare')],
  },
  {
    id: 'lpt', rubrik: 'Vårdplan vid psykiatrisk tvångsvård', uppfoljningDagar: 7,
    villkor: (k) => (k.tvangsvard ? 'Patienten vårdas enligt LPT eller LRV på vårdenheten. En vårdplan ska upprättas snarast efter intagningen (16 § LPT).' : null),
    mal: ['Patienten kan medverka frivilligt till nödvändig vård och ta emot det stöd som behövs (2 § LPT)'],
    atgarder: [a('Behandlingsåtgärder och andra insatser som behövs för att syftet med tvångsvården ska uppnås', 'lakare'), a('Samråd med patienten om vårdplanen', 'lakare'),
      a('Samråd med närstående, om det inte är olämpligt (16 § LPT)', 'sjukskoterska'), a('Undersök om patienten behöver stöd från socialtjänsten (16 § andra stycket LPT)', 'lakare'),
      a('Bedömning av om tvångsåtgärder fortfarande behövs', 'sjukskoterska', { dagligen: true })],
  },
];

const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel, yrke FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const text = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const synligaPlaner = (atk) => (kanRoll(atk.personal, 'las_vardplan') ? atk.filtrera(atk.db.query('SELECT * FROM vardplaner WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId), 'las_vardplan') : []);

// Patientens sammanhang på den egna vårdenheten: diagnoser, om patienten ligger inne och ålder. Bara uppgifter från den
// egna vårdenheten, så att ett förslag aldrig bygger på eller röjer en annan vårdenhets uppgifter.
function sammanhang(atk, { tvangsvard = false } = {}) {
  const db = atk.db;
  const enheter = enheterUnder(db, vardenhetFor(db, atk.personal.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  const dia = db.query(`SELECT * FROM diagnoser WHERE patient_id = ? AND enhet_id IN (${ph}) ORDER BY datum DESC`).all(atk.patientId, ...enheter);
  const inlagd = Boolean(db.query(`SELECT 1 FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND typ = 'slutenvard' AND slut IS NULL`).get(atk.patientId, ...enheter));
  const p = db.query('SELECT fodd FROM patienter WHERE id = ?').get(atk.patientId);
  return { diagnos: (prefix) => dia.find(d => d.kod.startsWith(prefix)) ?? null, inlagd, alder: alder(p.fodd, idag()), tvangsvard };
}

const malUt = (db, m, senaste) => ({ id: m.id, text: m.text, status: senaste?.[m.id] ?? null, statusText: MALSTATUS[senaste?.[m.id]] ?? 'Följs upp' });
function atgardUt(db, plan, x, nu) {
  const utf = db.query('SELECT * FROM vardplan_utfort WHERE atgard_id = ? ORDER BY tid DESC LIMIT 1').get(x.id);
  // En åtgärd som gäller ett mätvärde räknas som utförd när mätvärdet är registrerat på vårdenheten.
  let sist = utf?.tid ?? null;
  let auto = false;
  if (x.matvarde) {
    const enheter = enheterUnder(db, plan.enhet_id);
    const m = db.query(`SELECT tid FROM matvarden WHERE patient_id = ? AND typ = ? AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY tid DESC LIMIT 1`).get(plan.patient_id, x.matvarde, ...enheter);
    if (m && (!sist || m.tid > sist)) { sist = m.tid; auto = true; }
  }
  const forsenad = plan.status === 'aktiv' && x.dagligen && (!sist || nu - Date.parse(sist) > 24 * 3600_000) && nu - Date.parse(x.skapad) > 24 * 3600_000;
  return { id: x.id, text: x.text, ansvarig: x.ansvarig, ansvarigText: ANSVARIGA[x.ansvarig], dagligen: Boolean(x.dagligen), senastUtford: sist, utfordAvSystemet: auto,
    utfordAv: utf && !auto ? personKort(db, utf.av) : null, forsenad };
}

export function planUt(atk, plan, nu = Date.now()) {
  const db = atk.db;
  const mal = db.query('SELECT * FROM vardplan_mal WHERE plan_id = ? AND borttagen IS NULL ORDER BY id').all(plan.id);
  const atg = db.query('SELECT * FROM vardplan_atgarder WHERE plan_id = ? AND borttagen IS NULL ORDER BY id').all(plan.id);
  const hist = db.query('SELECT * FROM vardplan_historik WHERE plan_id = ? ORDER BY tid DESC, id DESC').all(plan.id);
  const uppf = hist.find(h => h.typ === 'uppfoljning');
  const senaste = uppf ? JSON.parse(uppf.detalj ?? '{}').mal ?? {} : {};
  const atgarder = atg.map(x => atgardUt(db, plan, x, nu));
  const egen = vardenhetFor(db, atk.personal.enhet_id) === vardenhetFor(db, plan.enhet_id);
  const avvikelser = [];
  if (plan.status === 'aktiv' && plan.uppfoljning < idag()) avvikelser.push({ typ: 'uppfoljning', text: `Uppföljningen skulle ha gjorts ${plan.uppfoljning}.` });
  for (const x of atgarder) if (x.forsenad) avvikelser.push({ typ: 'atgard', text: `${x.text} är inte registrerad det senaste dygnet (${x.ansvarigText.toLowerCase()}).` });
  for (const m of mal) if (senaste[m.id] === 'ej_uppnatt') avvikelser.push({ typ: 'mal', text: `Målet "${m.text}" var inte uppnått vid den senaste uppföljningen.` });
  return {
    id: plan.id, rubrik: plan.rubrik, mall: plan.mall, standard: Boolean(plan.mall), grund: plan.grund, status: plan.status,
    statusText: { aktiv: 'Pågår', pausad: 'Uppehåll', avslutad: 'Avslutad' }[plan.status], uppfoljning: plan.uppfoljning, enhet: enhetKort(db, plan.enhet_id),
    skapad: plan.skapad, skapadAv: personKort(db, plan.skapad_av), mal: mal.map(m => malUt(db, m, senaste)), atgarder, avvikelser,
    historik: hist.map(h => ({ id: h.id, tid: h.tid, typ: h.typ, text: h.text, av: personKort(db, h.av), enhet: enhetKort(db, h.enhet_id) })),
    kan: {
      andra: egen && kanRoll(atk.personal, 'vardplan') && plan.status !== 'avslutad',
      utfora: egen && kanRoll(atk.personal, 'vardplan_atgard') && plan.status === 'aktiv' ? atgarder.filter(x => (FAR_UTFORA[x.ansvarig] ?? []).includes(atk.personal.yrke)).map(x => x.id) : [],
    },
  };
}

// Förslag på standardplaner som inte redan pågår på vårdenheten. Bara för den som kan upprätta planer.
export function forslag(atk, { tvangsvard = false } = {}) {
  if (!kanRoll(atk.personal, 'vardplan')) return [];
  const k = sammanhang(atk, { tvangsvard });
  const ve = vardenhetFor(atk.db, atk.personal.enhet_id);
  const pagar = new Set(synligaPlaner(atk).filter(p => p.status !== 'avslutad' && vardenhetFor(atk.db, p.enhet_id) === ve).map(p => p.mall));
  return MALLAR.filter(m => !pagar.has(m.id)).map(m => ({ m, varfor: m.villkor(k) })).filter(x => x.varfor).map(({ m, varfor }) => ({
    mall: m.id, rubrik: m.rubrik, varfor, uppfoljning: addDagar(idag(), m.uppfoljningDagar), mal: m.mal,
    atgarder: m.atgarder.map(x => ({ text: x.text, ansvarig: x.ansvarig, ansvarigText: ANSVARIGA[x.ansvarig], dagligen: x.dagligen })),
  }));
}

export function forPatient(atk, { tvangsvard = false } = {}) {
  atk.krav('las_vardplan');
  const planer = synligaPlaner(atk).map(p => planUt(atk, p));
  const kan = kanRoll(atk.personal, 'vardplan') && atk.prova('vardplan').grund !== 'nodatkomst';
  return { planer, forslag: kan ? forslag(atk, { tvangsvard }) : [], mallar: kan ? MALLAR.map(m => ({ id: m.id, rubrik: m.rubrik })) : [], ansvariga: ANSVARIGA, kan: { skapa: kan }, demoregler: DEMOREGLER };
}

// För översikten: pågående planer med nästa uppföljning och avvikelser, och förslagen.
export function oversikt(atk, { tvangsvard = false } = {}) {
  if (!kanRoll(atk.personal, 'las_vardplan')) return null;
  const d = forPatient(atk, { tvangsvard });
  return { planer: d.planer.filter(p => p.status !== 'avslutad').map(p => ({ id: p.id, rubrik: p.rubrik, status: p.status, statusText: p.statusText, uppfoljning: p.uppfoljning, enhet: p.enhet, avvikelser: p.avvikelser.length })),
    forslag: d.forslag.map(f => ({ mall: f.mall, rubrik: f.rubrik, varfor: f.varfor })), kan: d.kan };
}

function kravSkriv(atk, handling = 'vardplan') {
  const r = atk.krav(handling, { beskrivning: 'vardplan' });
  if (r.grund === 'nodatkomst') {
    atk.logga(handling, 'nekad', 'vardplan', 'nekad');
    throw new Fel(403, 'Att ändra en vårdplan kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
}
const historik = (db, plan, pers, typ, t, detalj = null) => db.query('INSERT INTO vardplan_historik (plan_id, tid, av, enhet_id, typ, text, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(plan, iso(), pers.id, pers.enhet_id, typ, t, detalj ? JSON.stringify(detalj) : null);

// Upprättar en vårdplan ur en standardplan (body.mall) eller som en individuell plan (body.rubrik, body.mal, body.atgarder).
// Mallens innehåll kan anpassas i samma anrop: body.mal och body.atgarder ersätter då mallens.
export function skapa(atk, body = {}, { tvangsvard = false } = {}) {
  kravSkriv(atk);
  const db = atk.db;
  const pers = atk.personal;
  const mall = body.mall ? MALLAR.find(m => m.id === body.mall) : null;
  if (body.mall && !mall) throw new Fel(400, 'Standardplanen finns inte.', 'ogiltig', { falt: ['mall'] });
  const rubrik = text(body.rubrik, 120) || mall?.rubrik;
  if (!rubrik) throw new Fel(400, 'Ge planen en rubrik, eller välj en av standardplanerna.', 'ogiltig', { falt: ['rubrik'] });
  const mal = (Array.isArray(body.mal) ? body.mal.map(m => text(m)) : mall?.mal ?? []).filter(Boolean);
  const atgarder = (Array.isArray(body.atgarder) ? body.atgarder.map(x => ({ text: text(x?.text), ansvarig: x?.ansvarig, dagligen: Boolean(x?.dagligen), matvarde: null }))
    : (mall?.atgarder ?? [])).filter(x => x.text);
  if (!mal.length) throw new Fel(400, 'Planen behöver minst ett mål.', 'ogiltig', { falt: ['mal'] });
  if (!atgarder.length) throw new Fel(400, 'Planen behöver minst en åtgärd.', 'ogiltig', { falt: ['atgarder'] });
  if (atgarder.some(x => !ANSVARIGA[x.ansvarig])) throw new Fel(400, 'Varje åtgärd behöver en ansvarig yrkesroll.', 'ogiltig', { falt: ['atgarder'] });
  const uppf = body.uppfoljning ?? addDagar(idag(), mall?.uppfoljningDagar ?? 7);
  if (!giltigtDatum(uppf) || uppf < idag()) throw new Fel(400, 'Ange ett uppföljningsdatum från och med i dag.', 'ogiltig', { falt: ['uppfoljning'] });
  const grund = mall ? mall.villkor(sammanhang(atk, { tvangsvard })) ?? null : null;
  const t = iso();
  const id = Number(db.query('INSERT INTO vardplaner (patient_id, enhet_id, mall, rubrik, grund, uppfoljning, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, pers.enhet_id, mall?.id ?? null, rubrik, grund, uppf, t, pers.id).lastInsertRowid);
  for (const m of mal) db.query('INSERT INTO vardplan_mal (plan_id, text, skapad) VALUES (?, ?, ?)').run(id, m, t);
  for (const x of atgarder) db.query('INSERT INTO vardplan_atgarder (plan_id, text, ansvarig, dagligen, matvarde, skapad) VALUES (?, ?, ?, ?, ?, ?)').run(id, x.text, x.ansvarig, x.dagligen ? 1 : 0, x.matvarde ?? null, t);
  historik(db, id, pers, 'upprattad', mall ? `Upprättad ur standardplanen ${mall.rubrik}.` : 'Upprättad som individuell plan.');
  atk.logga('vardplan', atk.grund(), `vardplan:${id}:upprattad`);
  return [201, planUt(atk, db.query('SELECT * FROM vardplaner WHERE id = ?').get(id))];
}

export const hamtaPlan = (db, id) => {
  const p = db.query('SELECT * FROM vardplaner WHERE id = ?').get(Number(id));
  if (!p) throw new Fel(404, 'Vårdplanen finns inte.', 'saknas');
  return p;
};

// Ändringar i en plan: POST /api/vardplan/:id/:atgard. Planen måste höra till den egna vårdenheten.
export function andra(atk, plan, atgard, body = {}) {
  const db = atk.db;
  const pers = atk.personal;
  const handling = atgard === 'utfort' ? 'vardplan_atgard' : 'vardplan';
  kravSkriv(atk, handling);
  atk.krav('las_vardplan', { resurs: { enhet_id: plan.enhet_id } });
  if (vardenhetFor(db, pers.enhet_id) !== vardenhetFor(db, plan.enhet_id)) {
    atk.logga(handling, 'nekad', `vardplan:${plan.id}:${atgard}`, 'nekad');
    throw new Fel(403, `Planen hör till ${enhetKort(db, plan.enhet_id).namn} och ändras där.`, 'nekad');
  }
  if (plan.status === 'avslutad') throw new Fel(400, 'Planen är avslutad.', 'ogiltig');
  const t = iso();
  switch (atgard) {
    case 'utfort': {
      const x = db.query('SELECT * FROM vardplan_atgarder WHERE id = ? AND plan_id = ? AND borttagen IS NULL').get(Number(body.atgard), plan.id);
      if (!x) throw new Fel(400, 'Åtgärden finns inte i planen.', 'ogiltig', { falt: ['atgard'] });
      if (plan.status !== 'aktiv') throw new Fel(400, 'Planen har uppehåll. Återuppta den först.', 'ogiltig');
      if (!(FAR_UTFORA[x.ansvarig] ?? []).includes(pers.yrke)) {
        atk.logga(handling, 'nekad', `vardplan:${plan.id}:utfort:${x.id}`, 'nekad');
        throw new Fel(403, `Åtgärden har ${ANSVARIGA[x.ansvarig].toLowerCase()} som ansvarig. Den registreras av den yrkesrollen.`, 'nekad');
      }
      db.query('INSERT INTO vardplan_utfort (atgard_id, plan_id, tid, av) VALUES (?, ?, ?, ?)').run(x.id, plan.id, t, pers.id);
      break;
    }
    case 'mal': {
      const m = text(body.text);
      if (!m) throw new Fel(400, 'Skriv målet.', 'ogiltig', { falt: ['text'] });
      db.query('INSERT INTO vardplan_mal (plan_id, text, skapad) VALUES (?, ?, ?)').run(plan.id, m, t);
      historik(db, plan.id, pers, 'andrad', `Mål tillagt: ${m}`);
      break;
    }
    case 'atgard': {
      const x = text(body.text);
      if (!x) throw new Fel(400, 'Skriv åtgärden.', 'ogiltig', { falt: ['text'] });
      if (!ANSVARIGA[body.ansvarig]) throw new Fel(400, 'Välj vem som är ansvarig för åtgärden.', 'ogiltig', { falt: ['ansvarig'] });
      db.query('INSERT INTO vardplan_atgarder (plan_id, text, ansvarig, dagligen, skapad) VALUES (?, ?, ?, ?, ?)').run(plan.id, x, body.ansvarig, body.dagligen ? 1 : 0, t);
      historik(db, plan.id, pers, 'andrad', `Åtgärd tillagd: ${x} (${ANSVARIGA[body.ansvarig].toLowerCase()})`);
      break;
    }
    case 'ta-bort': {
      const tabell = body.mal ? 'vardplan_mal' : 'vardplan_atgarder';
      const rad = db.query(`SELECT * FROM ${tabell} WHERE id = ? AND plan_id = ? AND borttagen IS NULL`).get(Number(body.mal ?? body.atgard), plan.id);
      if (!rad) throw new Fel(400, 'Det finns inte i planen.', 'ogiltig');
      if (tabell === 'vardplan_mal' && db.query('SELECT count(*) AS n FROM vardplan_mal WHERE plan_id = ? AND borttagen IS NULL').get(plan.id).n < 2) throw new Fel(400, 'Planen behöver minst ett mål.', 'ogiltig');
      db.query(`UPDATE ${tabell} SET borttagen = ? WHERE id = ?`).run(t, rad.id);
      historik(db, plan.id, pers, 'andrad', `${body.mal ? 'Mål' : 'Åtgärd'} borttagen: ${rad.text}`);
      break;
    }
    case 'uppfoljning': {
      const mal = db.query('SELECT * FROM vardplan_mal WHERE plan_id = ? AND borttagen IS NULL').all(plan.id);
      const res = {};
      for (const m of mal) {
        const s = body.mal?.[m.id] ?? body.mal?.[String(m.id)];
        if (!MALSTATUS[s]) throw new Fel(400, `Ange om målet "${m.text}" är uppnått.`, 'ogiltig', { falt: [`mal-${m.id}`] });
        res[m.id] = s;
      }
      const nasta = body.nasta ?? addDagar(idag(), MALLAR.find(x => x.id === plan.mall)?.uppfoljningDagar ?? 7);
      if (!giltigtDatum(nasta) || nasta < idag()) throw new Fel(400, 'Ange nästa uppföljningsdatum från och med i dag.', 'ogiltig', { falt: ['nasta'] });
      db.query('UPDATE vardplaner SET uppfoljning = ? WHERE id = ?').run(nasta, plan.id);
      const n = Object.values(res).filter(s => s === 'uppnatt').length;
      historik(db, plan.id, pers, 'uppfoljning', `Uppföljning: ${n} av ${mal.length} mål uppnådda.${text(body.kommentar) ? ` ${text(body.kommentar)}` : ''} Nästa uppföljning ${nasta}.`, { mal: res });
      break;
    }
    case 'pausa': {
      if (plan.status !== 'aktiv') throw new Fel(400, 'Planen har redan uppehåll.', 'ogiltig');
      const orsak = text(body.orsak);
      if (!orsak) throw new Fel(400, 'Skriv varför planen gör uppehåll.', 'ogiltig', { falt: ['orsak'] });
      db.query("UPDATE vardplaner SET status = 'pausad' WHERE id = ?").run(plan.id);
      historik(db, plan.id, pers, 'pausad', `Uppehåll: ${orsak}`);
      break;
    }
    case 'ateruppta':
      if (plan.status !== 'pausad') throw new Fel(400, 'Planen har inget uppehåll.', 'ogiltig');
      db.query("UPDATE vardplaner SET status = 'aktiv', uppfoljning = max(uppfoljning, ?) WHERE id = ?").run(idag(), plan.id);
      historik(db, plan.id, pers, 'aterupptagen', 'Planen återupptogs.');
      break;
    case 'avsluta': {
      db.query("UPDATE vardplaner SET status = 'avslutad' WHERE id = ?").run(plan.id);
      historik(db, plan.id, pers, 'avslutad', `Avslutad.${text(body.kommentar) ? ` ${text(body.kommentar)}` : ''}`);
      break;
    }
    default: throw new Fel(404, 'Okänd ändring av vårdplanen.', 'saknas');
  }
  atk.logga(handling, atk.grund(), `vardplan:${plan.id}:${atgard}`);
  return planUt(atk, db.query('SELECT * FROM vardplaner WHERE id = ?').get(plan.id));
}

// Finns det en pågående vårdplan på vårdenheten (för 16 § LPT i tvangsvard.js)?
export const pagarPa = (db, patientId, vardenhet) => db.query("SELECT enhet_id FROM vardplaner WHERE patient_id = ? AND status <> 'avslutad'").all(patientId).some(p => vardenhetFor(db, p.enhet_id) === vardenhet);

// Inkorgen: planer på personalens vårdenhet vars uppföljning har passerat, för läkare och sjuksköterskor.
export function inkorg(db, personal, { harVardrelation }) {
  if (!kanRoll(personal, 'vardplan')) return [];
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  return db.query(`SELECT * FROM vardplaner WHERE status = 'aktiv' AND uppfoljning < ? AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY uppfoljning`).all(idag(), ...enheter)
    .filter(p => harVardrelation(db, p.patient_id, ve))
    .map(p => ({ patientId: p.patient_id, planId: p.id, rubrik: p.rubrik, uppfoljning: p.uppfoljning }));
}

// Seeden: Elin Sandberg (p04) har en vårdplan för förebyggande av fall på avdelning 72 vars uppföljning har passerat.
export function seeda(db, bas = new Date()) {
  sakraSchema(db);
  const dag = (n) => addDagar(bas.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }), n);
  const t = new Date(bas.getTime() - 4 * 86400_000).toISOString();
  const m = MALLAR.find(x => x.id === 'fall');
  const id = Number(db.query("INSERT INTO vardplaner (patient_id, enhet_id, mall, rubrik, grund, uppfoljning, skapad, skapad_av) VALUES ('p04', 'uso-kard-72', 'fall', ?, ?, ?, ?, 'ssk-kard')")
    .run(m.rubrik, 'Upprättad efter en fallriskbedömning vid inskrivningen.', dag(-1), t).lastInsertRowid);
  for (const x of m.mal) db.query('INSERT INTO vardplan_mal (plan_id, text, skapad) VALUES (?, ?, ?)').run(id, x, t);
  for (const x of m.atgarder) db.query('INSERT INTO vardplan_atgarder (plan_id, text, ansvarig, dagligen, matvarde, skapad) VALUES (?, ?, ?, ?, ?, ?)').run(id, x.text, x.ansvarig, x.dagligen ? 1 : 0, x.matvarde, t);
  db.query("INSERT INTO vardplan_historik (plan_id, tid, av, enhet_id, typ, text) VALUES (?, ?, 'ssk-kard', 'uso-kard-72', 'upprattad', 'Upprättad ur standardplanen Förebyggande av fall.')").run(id, t);
}
export function sakra(db) {
  const fanns = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vardplaner'").get();
  sakraSchema(db);
  if (!fanns) seeda(db, new Date());
}
