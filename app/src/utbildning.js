// Övningar och intyg i utbildningsmiljön (Sussa 10.1.1.5, och 10.1.1.3 för onlinehjälp och uppföljning).
//
// Varje yrkesroll har ett antal korta övningar om hur Vårdkällan fungerar, med demopatienter. Den som svarar rätt på
// alla får ett intyg som gäller i ett år, och verksamhetschefen ser vilka på vårdenheten som har ett giltigt intyg,
// vilka som går ut inom 30 dagar och vilka som saknar intyg.
//
// Övningarna är data med versioner (ovningsversioner). Verksamhetschefen eller en utbildare ändrar dem i gränssnittet,
// och varje ändring är en ny version med vem, när och vad som ändrades. En version ändras och raderas aldrig. En
// utbildare är den som har ett giltigt utbildarintyg, som verksamhetschefen utfärdar till någon på vårdenheten som
// själv har ett giltigt intyg. Det är ingen egen inloggningsroll.
//
// Systemet är experten: det väljer själv övningarna efter yrkesrollen, rättar på servern (rätt svar lämnas aldrig ut
// före rättningen), förklarar varje svar på vanlig svenska, räknar giltighetstiden, prövar en ändrad övning innan den
// sparas och förklarar vad som saknas, och vet själv vilka som arbetar på vårdenheten.
//
// Runda 8, r5: en vårdenhet kan ha egna övningar utöver vårdgivarens, med samma versioner och historik (tabellen
// enhetsovningar). Vårdenhetens verksamhetschef och utbildarna på vårdenheten ändrar dem. Personalen gör vårdgivarens
// och den egna vårdenhetens övningar för sin yrkesroll, och de egna övningarna har id med prefixet e., så att de aldrig
// kan krocka med vårdgivarens.
//
// Övningarna innehåller inga patientuppgifter utom demopatienternas påhittade namn. Demon är själv utbildningsmiljön.
import { Fel, iso, datumAv } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { chefFor } from './lakemedelsansvar.js';
import { YRKEN } from './seed/personal.js';
import { OVNINGAR_V1 } from './seed/ovningar.js';
import { KURS, GILTIG_DAGAR } from './utbildning-schema.js';

const DAG = 86400_000;
export const GAR_UT_DAGAR = 30;
export const UTBILDNINGSMILJO = 'Övningarna görs i demon, som är Vårdkällans utbildningsmiljö. Patienterna i övningarna är demopatienter med påhittade namn, och intyget gäller bara i demon.';
export const OVNINGAR = OVNINGAR_V1;
const ALLA = Object.keys(YRKEN);

const harTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ovningsversioner'").get());

// Den gällande versionen av övningarna: den senaste, annars första versionen ur koden.
export function aktuella(db) {
  const r = harTabell(db) ? db.query('SELECT * FROM ovningsversioner ORDER BY version DESC LIMIT 1').get() : null;
  return r ? { version: r.version, ovningar: JSON.parse(r.innehall) } : { version: 1, ovningar: OVNINGAR_V1 };
}

export const ovningarFor = (yrke, lista = OVNINGAR_V1) => lista.filter(x => x.roller.includes(yrke));

// Runda 8, r5: vårdenhetens egna övningar. Den senaste versionen, eller version 0 utan övningar.
const harEnhetstabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'enhetsovningar'").get());
export const ENHET_PREFIX = 'e.';
export function aktuellaEnhet(db, ve) {
  const r = ve && harEnhetstabell(db) ? db.query('SELECT * FROM enhetsovningar WHERE enhet_id = ? ORDER BY version DESC LIMIT 1').get(ve) : null;
  return r ? { version: r.version, ovningar: JSON.parse(r.innehall) } : { version: 0, ovningar: [] };
}
const enhetsnamn = (db, ve) => db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? ve;
// Alla övningar som personen ska göra: vårdgivarens och den egna vårdenhetens, för yrkesrollen.
function allaFor(db, personal) {
  const a = aktuella(db);
  const ve = vardenhetFor(db, personal.enhet_id);
  const e = aktuellaEnhet(db, ve);
  const egna = ovningarFor(personal.yrke, e.ovningar).map(x => ({ ...x, id: `${ENHET_PREFIX}${x.id}`, enhet: true }));
  return { a, e, ve, lista: [...ovningarFor(personal.yrke, a.ovningar), ...egna] };
}

// Alternativen visas i en ordning som beror på övningen, så att det rätta svaret inte alltid står på samma plats.
const blanda = (ovning, alternativ) => {
  const h = (s) => {
    let v = [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    v ^= v >>> 13; v = Math.imul(v, 0x5bd1e995) >>> 0; v ^= v >>> 15;
    return v >>> 0;
  };
  return [...alternativ].sort((a, b) => h(`${ovning}:${a.id}`) - h(`${ovning}:${b.id}`));
};

// Adresserna i demon som en övning kan länka till, och vad rollen behöver för att nå dem.
export const PROVA = {
  '#/arbetslista': null, '#/sok': 'sok', '#/inkorg': null, '#/administrering': 'las_lakemedel', '#/delegeringar': 'ge_lakemedel', '#/idag': 'boka',
  '#/logg': 'las_logg', '#/arkiv': 'registrera_arkivbeslut', '#/datauttag': 'datauttag', '#/samverkan': 'samverkan', '#/lakemedelsansvar': 'lakemedelsansvar',
  '#/utbildning': null, '#/patient/p01': 'patient', '#/patient/p01/lakemedel': 'patient',
  // Runda 7: ekonomens och systemförvaltarens startsidor.
  '#/ekonomi': 'faktureringsunderlag', '#/regler': 'konfigurera',
};
const provaNar = (vag, personal) => {
  if (!(vag in PROVA)) return false;
  const krav = PROVA[vag];
  if (krav === 'patient') return kanRoll(personal, 'las_oversikt') || kanRoll(personal, 'las_admin');
  return krav ? kanRoll(personal, krav) : true;
};

// En övning som den visas före rättningen: utan rätt svar och förklaring.
const utan = (x, personal) => ({
  id: x.id, fraga: x.fraga, alternativ: blanda(x.id, x.alternativ).map(a => ({ id: a.id, text: a.text })), enhet: Boolean(x.enhet),
  // Länken till samma ställe i demon visas bara när rollen når det.
  prova: x.prova && provaNar(x.prova, personal) ? x.prova : null,
});

const dagarMellan = (fran, till) => Math.floor((Date.parse(till) - Date.parse(fran)) / DAG);

// Statusen för ett intyg vid tiden nu: giltigt, gar_ut (inom 30 dagar), utgatt eller saknas.
export function intygStatus(intyg, nu = new Date(), slag = 'Intyg') {
  if (!intyg) return { status: 'saknas', text: slag === 'Intyg' ? 'Inget intyg' : 'Inte utbildare', giltigtTill: null, utfardat: null, dagarKvar: null };
  const kvar = dagarMellan(iso(nu), intyg.giltigt_till);
  const s = Date.parse(intyg.giltigt_till) <= nu.getTime() ? 'utgatt' : kvar <= GAR_UT_DAGAR ? 'gar_ut' : 'giltigt';
  const text = slag === 'Intyg'
    ? { giltigt: 'Giltigt intyg', gar_ut: `Går ut om ${kvar} ${kvar === 1 ? 'dag' : 'dagar'}`, utgatt: 'Intyget har gått ut' }[s]
    : { giltigt: 'Utbildare', gar_ut: `Utbildare, går ut om ${kvar} ${kvar === 1 ? 'dag' : 'dagar'}`, utgatt: 'Utbildarintyget har gått ut' }[s];
  return { status: s, text, giltigtTill: intyg.giltigt_till, utfardat: intyg.utfardat, dagarKvar: s === 'utgatt' ? 0 : kvar, kurs: intyg.kurs, roll: intyg.roll, version: intyg.version ?? null };
}
const giltig = (i, nu) => ['giltigt', 'gar_ut'].includes(intygStatus(i, nu).status);

const senasteIntyg = (db, personalId) => db.query('SELECT * FROM utbildningsintyg WHERE personal_id = ? ORDER BY utfardat DESC, id DESC LIMIT 1').get(personalId) ?? null;
const senasteUtbildarintyg = (db, personalId) => (harTabell(db) ? db.query('SELECT * FROM utbildarintyg WHERE personal_id = ? ORDER BY utfardat DESC, id DESC LIMIT 1').get(personalId) ?? null : null);

function kravUtbildning(personal) {
  if (!kanRoll(personal, 'utbildning')) throw new Fel(403, 'Din yrkesroll har inga övningar i Vårdkällan.', 'nekad');
}

// Verksamhetschefen och den som har ett giltigt utbildarintyg ändrar övningarna.
export const arUtbildare = (db, personal, nu = new Date()) => Boolean(personal && giltig(senasteUtbildarintyg(db, personal.id), nu) && kanRoll(personal, 'utbildning'));
export const kanAndra = (db, personal, nu = new Date()) => Boolean(chefFor(db, personal) || arUtbildare(db, personal, nu));
// Runda 8, r5: vårdenhetens egna övningar ändras av vårdenhetens verksamhetschef och av utbildare vars utbildarintyg
// gäller den vårdenhet där de arbetar. Ger vårdenheten, eller null.
export function enhetForAndring(db, personal, nu = new Date()) {
  const chef = chefFor(db, personal);
  if (chef) return chef;
  const u = personal ? senasteUtbildarintyg(db, personal.id) : null;
  return u && arUtbildare(db, personal, nu) && u.vardenhet === vardenhetFor(db, personal.enhet_id) ? u.vardenhet : null;
}

// Övningarna för den inloggade, och personens intyg.
export function oversikt(db, personal, { nu = new Date() } = {}) {
  kravUtbildning(personal);
  const { a, e, ve, lista } = allaFor(db, personal);
  const ovningar = lista.map(x => utan(x, personal));
  const andraEnhet = enhetForAndring(db, personal, nu);
  return {
    kurs: KURS, version: a.version, giltigDagar: GILTIG_DAGAR, utbildningsmiljo: UTBILDNINGSMILJO, roll: personal.yrke, rollText: YRKEN[personal.yrke],
    ovningar, intyg: intygStatus(senasteIntyg(db, personal.id), nu), enhet: Boolean(chefFor(db, personal)),
    utbildare: intygStatus(senasteUtbildarintyg(db, personal.id), nu, 'Utbildare'), kanAndra: kanAndra(db, personal, nu),
    // Runda 8, r5: vårdenhetens egna övningar.
    vardenhet: { id: ve, namn: enhetsnamn(db, ve), version: e.version, antalEgna: ovningar.filter(x => x.enhet).length },
    kanAndraEnhet: andraEnhet ? { id: andraEnhet, namn: enhetsnamn(db, andraEnhet) } : null,
  };
}

// Rättar svaren. Alla övningar ska vara besvarade. Är alla rätt utfärdas ett intyg som gäller i ett år.
export function ratta(db, personal, svar, { nu = new Date() } = {}) {
  kravUtbildning(personal);
  const { a, lista } = allaFor(db, personal);
  if (!svar || typeof svar !== 'object' || Array.isArray(svar)) throw new Fel(400, 'Svara på övningarna först.', 'ogiltig', { falt: ['svar'] });
  const obesvarade = lista.filter(x => !x.alternativ.some(y => y.id === svar[x.id]));
  if (obesvarade.length) {
    throw new Fel(400, obesvarade.length === 1 ? 'En övning är inte besvarad.' : `${obesvarade.length} övningar är inte besvarade.`, 'ogiltig', { falt: obesvarade.map(x => x.id) });
  }
  const resultat = lista.map(x => ({ id: x.id, ratt: svar[x.id] === x.ratt, rattSvar: x.alternativ.find(y => y.id === x.ratt).text, forklaring: x.forklaring }));
  const antalRatt = resultat.filter(r => r.ratt).length;
  const godkand = antalRatt === lista.length;
  if (godkand) {
    const till = new Date(nu.getTime() + GILTIG_DAGAR * DAG);
    db.query('INSERT INTO utbildningsintyg (personal_id, vardenhet, roll, kurs, utfardat, giltigt_till, antal_ovningar, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(personal.id, vardenhetFor(db, personal.enhet_id), personal.yrke, KURS, iso(nu), iso(till), lista.length, a.version);
  }
  return {
    godkand, antalRatt, antal: lista.length, resultat,
    text: godkand ? `Alla ${lista.length} rätt. Intyget gäller i ett år.` : `${antalRatt} av ${lista.length} rätt. Läs förklaringarna och gör övningarna igen. Alla ska vara rätt för ett intyg.`,
    intyg: intygStatus(senasteIntyg(db, personal.id), nu),
  };
}

const ORDNING = { utgatt: 0, saknas: 1, gar_ut: 2, giltigt: 3 };

// Verksamhetschefens vy: alla som arbetar på vårdenheten, deras intyg och vilka som är utbildare.
export function enhet(db, personal, { nu = new Date() } = {}) {
  const ve = chefFor(db, personal);
  if (!ve || !kanRoll(personal, 'intyg_enhet')) throw new Fel(403, 'Bara vårdenhetens verksamhetschef ser intygen för vårdenheten.', 'nekad');
  const personer = db.query('SELECT * FROM personal WHERE aktiv = 1 ORDER BY namn').all()
    .filter(p => vardenhetFor(db, p.enhet_id) === ve && ROLLER_MED_OVNINGAR.includes(p.yrke))
    .map(p => {
      const intyg = intygStatus(senasteIntyg(db, p.id), nu);
      const utbildare = intygStatus(senasteUtbildarintyg(db, p.id), nu, 'Utbildare');
      return { id: p.id, namn: p.namn, titel: p.titel, yrke: p.yrke, ...intyg, utbildare,
        kanBliUtbildare: ['giltigt', 'gar_ut'].includes(intyg.status) && !['giltigt'].includes(utbildare.status) };
    })
    .sort((a, b) => ORDNING[a.status] - ORDNING[b.status] || a.namn.localeCompare(b.namn, 'sv'));
  const summa = { giltigt: 0, gar_ut: 0, utgatt: 0, saknas: 0 };
  for (const p of personer) summa[p.status]++;
  const namn = db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? ve;
  return { vardenhet: { id: ve, namn }, personer, summa, garUtDagar: GAR_UT_DAGAR };
}

// Verksamhetschefen utfärdar ett utbildarintyg som gäller i ett år. Personen ska arbeta på vårdenheten och själv ha ett
// giltigt intyg, så att den som ändrar övningarna kan dem.
export function utfardaUtbildare(db, personal, personalId, { nu = new Date() } = {}) {
  const ve = chefFor(db, personal);
  if (!ve) throw new Fel(403, 'Bara vårdenhetens verksamhetschef utfärdar utbildarintyg.', 'nekad');
  const p = typeof personalId === 'string' ? db.query('SELECT * FROM personal WHERE id = ? AND aktiv = 1').get(personalId) : null;
  if (!p || vardenhetFor(db, p.enhet_id) !== ve) throw new Fel(400, 'Välj någon som arbetar på din vårdenhet.', 'ogiltig', { falt: ['personalId'] });
  if (!giltig(senasteIntyg(db, p.id), nu)) throw new Fel(400, `${p.namn} har inget giltigt intyg. En utbildare ska först ha gjort övningarna själv.`, 'ogiltig', { falt: ['personalId'] });
  const till = new Date(nu.getTime() + GILTIG_DAGAR * DAG);
  db.query('INSERT INTO utbildarintyg (personal_id, vardenhet, utfardat_av, utfardat, giltigt_till) VALUES (?, ?, ?, ?, ?)').run(p.id, ve, personal.id, iso(nu), iso(till));
  return { ...enhet(db, personal, { nu }), text: `${p.namn} är utbildare till ${datumAv(till)} och kan ändra övningarna.` };
}

// Övningarna med rätt svar och historiken, för den som får ändra dem.
export function redigera(db, personal, { nu = new Date(), omfang = 'vardgivare' } = {}) {
  const namn = (id) => db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null;
  const rad = (r) => ({ version: r.version, tid: r.tid, av: namn(r.av), andring: r.andring, antal: JSON.parse(r.innehall).length });
  const gemensamt = { roller: ALLA.map(id => ({ id, text: YRKEN[id] })), prova: Object.keys(PROVA) };
  // Runda 8, r5: vårdenhetens egna övningar.
  if (omfang === 'enhet') {
    const ve = enhetForAndring(db, personal, nu);
    if (!ve) throw new Fel(403, 'Bara vårdenhetens verksamhetschef och utbildare på vårdenheten ändrar vårdenhetens egna övningar.', 'nekad');
    const e = aktuellaEnhet(db, ve);
    const historik = harEnhetstabell(db) ? db.query('SELECT * FROM enhetsovningar WHERE enhet_id = ? ORDER BY version DESC').all(ve).map(rad) : [];
    return { omfang: 'enhet', vardenhet: { id: ve, namn: enhetsnamn(db, ve) }, version: e.version, ovningar: e.ovningar, historik, ...gemensamt };
  }
  if (omfang !== 'vardgivare') throw new Fel(400, 'Välj vårdgivarens övningar eller vårdenhetens egna.', 'ogiltig', { falt: ['omfang'] });
  if (!kanAndra(db, personal, nu)) throw new Fel(403, 'Bara verksamhetschefen och utbildare ändrar övningarna.', 'nekad');
  const a = aktuella(db);
  const historik = harTabell(db) ? db.query('SELECT * FROM ovningsversioner ORDER BY version DESC').all().map(rad) : [];
  return { omfang: 'vardgivare', version: a.version, ovningar: a.ovningar, historik, ...gemensamt };
}

const txt = (v, min, max) => (typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : null);

// Prövar en lista med övningar och ger den rensade listan, eller ett fel som säger vad som saknas.
// Runda 8, r5: med enhet: true prövas vårdenhetens egna övningar, som får vara noll och inte behöver täcka alla
// yrkesroller, eftersom vårdgivarens övningar redan gör det.
export function prova(lista, { enhet = false } = {}) {
  if (!Array.isArray(lista) || (!enhet && !lista.length) || lista.length > 80) throw new Fel(400, enhet ? 'Vårdenheten kan ha högst 80 egna övningar.' : 'Övningarna ska vara mellan 1 och 80.', 'ogiltig', { falt: ['ovningar'] });
  const sedda = new Set();
  const ut = lista.map((x, i) => {
    const nr = `Övning ${i + 1}`;
    const fel = (text, falt) => new Fel(400, `${nr}: ${text}`, 'ogiltig', { falt: [`${i}.${falt}`] });
    const id = typeof x?.id === 'string' && /^[a-z0-9-]{2,40}$/.test(x.id) ? x.id : null;
    if (!id) throw fel('id ska vara 2 till 40 små bokstäver, siffror eller bindestreck.', 'id');
    if (sedda.has(id)) throw fel(`id ${id} finns redan.`, 'id');
    sedda.add(id);
    const roller = Array.isArray(x.roller) ? [...new Set(x.roller.filter(r => ALLA.includes(r)))] : [];
    if (!roller.length || roller.length !== new Set(x.roller).size) throw fel('välj minst en yrkesroll, och bara yrkesroller som finns.', 'roller');
    const fraga = txt(x.fraga, 10, 300);
    if (!fraga) throw fel('frågan ska vara 10 till 300 tecken.', 'fraga');
    const alt = Array.isArray(x.alternativ) ? x.alternativ.filter(a => txt(a?.text, 1, 300)) : [];
    if (alt.length < 2 || alt.length > 5) throw fel('en övning ska ha 2 till 5 svarsalternativ med text.', 'alternativ');
    const ids = 'abcde';
    const alternativ = alt.map((a, j) => ({ id: ids[j], text: a.text.trim(), ratt: a.id === x.ratt }));
    if (alternativ.filter(a => a.ratt).length !== 1) throw fel('välj vilket svarsalternativ som är rätt.', 'ratt');
    const forklaring = txt(x.forklaring, 10, 500);
    if (!forklaring) throw fel('förklaringen ska vara 10 till 500 tecken. Den visas efter rättningen.', 'forklaring');
    const provaVag = x.prova == null || x.prova === '' ? null : x.prova;
    if (provaVag !== null && !(provaVag in PROVA)) throw fel('länken till demon ska vara en av de adresser som finns i listan.', 'prova');
    return { id, roller, fraga, alternativ: alternativ.map(a => ({ id: a.id, text: a.text })), ratt: alternativ.find(a => a.ratt).id, forklaring, prova: provaVag };
  });
  const utan = enhet ? [] : ALLA.filter(y => !ut.some(x => x.roller.includes(y)));
  if (utan.length) throw new Fel(400, `Varje yrkesroll ska ha minst en övning. Ingen övning finns för ${utan.map(y => YRKEN[y].toLowerCase()).join(', ')}.`, 'ogiltig', { falt: ['roller'] });
  return ut;
}

// Sparar en ny version av övningarna. Den förra finns kvar i historiken, och intyg som redan är utfärdade gäller.
export function sparaVersion(db, personal, { ovningar, andring, omfang = 'vardgivare' } = {}, { nu = new Date() } = {}) {
  // Runda 8, r5: vårdenhetens egna övningar får en egen version i sin egen historik.
  if (omfang === 'enhet') {
    const ve = enhetForAndring(db, personal, nu);
    if (!ve) throw new Fel(403, 'Bara vårdenhetens verksamhetschef och utbildare på vårdenheten ändrar vårdenhetens egna övningar.', 'nekad');
    const vad = txt(andring, 5, 300);
    if (!vad) throw new Fel(400, 'Skriv kort vad som har ändrats, 5 till 300 tecken. Det står i historiken.', 'ogiltig', { falt: ['andring'] });
    const lista = prova(ovningar, { enhet: true });
    const forra = aktuellaEnhet(db, ve);
    if (JSON.stringify(lista) === JSON.stringify(forra.ovningar)) throw new Fel(400, 'Inget har ändrats i övningarna.', 'ogiltig', { falt: ['ovningar'] });
    db.query('INSERT INTO enhetsovningar (enhet_id, version, innehall, andring, av, tid) VALUES (?, ?, ?, ?, ?, ?)').run(ve, forra.version + 1, JSON.stringify(lista), vad, personal.id, iso(nu));
    return { ...redigera(db, personal, { nu, omfang: 'enhet' }), text: `Version ${forra.version + 1} av övningarna för ${enhetsnamn(db, ve)} är sparad och gäller nu.` };
  }
  if (omfang !== 'vardgivare') throw new Fel(400, 'Välj vårdgivarens övningar eller vårdenhetens egna.', 'ogiltig', { falt: ['omfang'] });
  if (!kanAndra(db, personal, nu)) throw new Fel(403, 'Bara verksamhetschefen och utbildare ändrar övningarna.', 'nekad');
  const vad = txt(andring, 5, 300);
  if (!vad) throw new Fel(400, 'Skriv kort vad som har ändrats, 5 till 300 tecken. Det står i historiken.', 'ogiltig', { falt: ['andring'] });
  const lista = prova(ovningar);
  const forra = aktuella(db);
  if (JSON.stringify(lista) === JSON.stringify(forra.ovningar)) throw new Fel(400, 'Inget har ändrats i övningarna.', 'ogiltig', { falt: ['ovningar'] });
  db.query('INSERT INTO ovningsversioner (version, innehall, andring, av, tid) VALUES (?, ?, ?, ?, ?)').run(forra.version + 1, JSON.stringify(lista), vad, personal.id, iso(nu));
  return { ...redigera(db, personal, { nu }), text: `Version ${forra.version + 1} av övningarna är sparad och gäller nu.` };
}

export const ROLLER_MED_OVNINGAR = ALLA.filter(y => ovningarFor(y).length);
