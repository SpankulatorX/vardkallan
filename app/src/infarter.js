// In- och utfarter (runda 10, r4, Sussa 3.1.3.3 och 3.1.3.8): katetrar, sonder och dränage som registreras och följs
// över tid, från att de sätts tills de avvecklas.
//
// Systemet är experten:
//   - Typen avgör resten. Systemet förväljer den vanligaste storleken, visar bara de storlekar som finns för typen och de
//     vanligaste placeringarna, sätter tiden till nu och knyter registreringen till den pågående vårdkontakten.
//   - Systemet räknar när nästa skötsel ska göras ur den senaste skötseln eller insättningen, och skötseln står i
//     avdelningens planering för dagen utan att någon behöver planera den. En skötsel som är försenad markeras.
//   - Systemet påminner om att pröva behovet när en kateter har legat länge, och stoppar en andra kvarliggande
//     urinkateter eller sond som inte kan finnas samtidigt.
//   - KVÅ-koden för insättning, skötsel, byte och avveckling sätts av systemet ur typen, så ingen behöver kunna kodverket.
//   - Vid sängen kan armbandet och förpackningens streckkod skannas: armbandet kontrolleras mot den öppna patienten och
//     förpackningens artikelnummer, batch och utgångsdatum sparas, och en förpackning som har gått ut stoppas.
//
// Behörighet. In- och utfarter registreras av läkare och sjuksköterskor (handlingen infart) och läses som
// omvårdnadsanteckningar (las_omvardnad), med inre sekretess, spärr och loggning som resten av journalen. En rad ändras
// bara på den vårdenhet där den registrerades. Intervallen för skötsel och påminnelserna är demoregler.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as atgarder from './atgarder.js';
import * as skanning from './skanning.js';
import * as avdelningsplan from './avdelningsplan.js';
import { tabell, finns, personNamn, enhetKort, textFalt, iso, tid as giltigTid, vardkontaktFor, bunden, andraRad, TIMME, DAG, vardenhetFor } from './specialist-hjalp.js';

export const DEMOREGEL = 'Intervallen för skötsel och påminnelserna är demoregler i Vårdkällan, inte kliniskt beslutsstöd.';
export const LAS = 'las_omvardnad';
export const SKRIV = 'infart';

// Typerna. storlekar i typens enhet, standard är den storlek som förväljs. insattning, skotsel, byte och avveckling är
// KVÅ-koder (kontrollerade mot KVÅ 2026, docs/kodkontroll.md), och null där KVÅ inte har en kod som passar typen.
// skotselTimmar är intervallet för skötseln och provaDagar när systemet påminner om att pröva behovet (demoregler).
// samtidigt false betyder att patienten inte kan ha två av typen samtidigt.
export const TYPER = tabell({
  pvk: { namn: 'Perifer venkateter (PVK)', kort: 'PVK', grupp: 'infart', enhet: 'G', storlekar: ['14', '16', '17', '18', '20', '22', '24'], standard: '20',
    placeringar: ['Vänster underarm', 'Höger underarm', 'Vänster handrygg', 'Höger handrygg', 'Vänster armveck', 'Höger armveck'],
    insattning: 'SP021', skotsel: 'QD005', byte: 'DP028', avveckling: 'DP029', skotselTimmar: 24, provaDagar: 3, samtidigt: true,
    skotselText: 'Inspektera insticksstället, bedöm tecken på inflammation och lägg om förbandet vid behov.' },
  picc: { namn: 'Perifert insatt central kateter (PICC)', kort: 'PICC', grupp: 'infart', enhet: 'Fr', storlekar: ['3', '4', '5', '6'], standard: '4',
    placeringar: ['Vänster överarm', 'Höger överarm'], insattning: 'SP105', skotsel: 'QD004', byte: null, avveckling: 'DF007', skotselTimmar: 7 * 24, provaDagar: null, samtidigt: false,
    skotselText: 'Byt förband och kontrollera kateterns funktion och insticksstället.' },
  cvk: { namn: 'Central venkateter (CVK)', kort: 'CVK', grupp: 'infart', enhet: 'Fr', storlekar: ['5', '7', '8', '12'], standard: '7',
    placeringar: ['Höger vena jugularis interna', 'Vänster vena jugularis interna', 'Höger vena subclavia', 'Vänster vena subclavia', 'Vena femoralis'],
    insattning: null, skotsel: 'QD004', byte: null, avveckling: 'DF007', skotselTimmar: 7 * 24, provaDagar: null, samtidigt: false,
    skotselText: 'Byt förband och kontrollera kateterns funktion och insticksstället.' },
  kad: { namn: 'Kvarliggande urinkateter (KAD)', kort: 'KAD', grupp: 'utfart', enhet: 'Ch', storlekar: ['10', '12', '14', '16', '18', '20', '22'], standard: '14',
    placeringar: ['Uretra'], insattning: 'TKC20', skotsel: 'DK028', byte: null, avveckling: 'DK021', skotselTimmar: 24, provaDagar: 1, samtidigt: false,
    skotselText: 'Sköt katetern, kontrollera urinflödet och pröva om katetern fortfarande behövs.' },
  suprapubisk: { namn: 'Suprapubisk kateter', kort: 'Suprapubisk kateter', grupp: 'utfart', enhet: 'Ch', storlekar: ['10', '12', '14', '16', '18'], standard: '14',
    placeringar: ['Suprapubiskt'], insattning: 'DK010', skotsel: 'DK028', byte: null, avveckling: 'DK023', skotselTimmar: 24, provaDagar: null, samtidigt: false,
    skotselText: 'Sköt katetern och insticksstället och kontrollera urinflödet.' },
  sond: { namn: 'Nasogastrisk sond', kort: 'Sond', grupp: 'infart', enhet: 'Ch', storlekar: ['8', '10', '12', '14', '16', '18'], standard: '12',
    placeringar: ['Vänster näsborre', 'Höger näsborre'], insattning: 'TJD00', skotsel: null, byte: null, avveckling: null, skotselTimmar: 24, provaDagar: null, samtidigt: false,
    skotselText: 'Kontrollera sondens läge och fixering och sköt huden vid näsborren.' },
  dranage: { namn: 'Dränage', kort: 'Dränage', grupp: 'utfart', enhet: 'Ch', storlekar: ['8', '10', '12', '16', '20', '24', '28', '32'], standard: '12',
    placeringar: ['Buk', 'Thorax höger', 'Thorax vänster', 'Operationssår'], insattning: null, skotsel: 'DV150', byte: null, avveckling: 'DV005', skotselTimmar: 24, provaDagar: null, samtidigt: true,
    skotselText: 'Kontrollera dränagets funktion, mängd och utseende och sköt huden runt dränaget.' },
});
export const GRUPPER = tabell({ infart: 'Infart', utfart: 'Utfart' });
export const ORSAKER = tabell({
  behovs_inte: 'Behövs inte längre', komplikation: 'Komplikation, till exempel inflammation eller stopp', oavsiktligt: 'Kom ut oavsiktligt',
  byte: 'Byts mot en ny', utskrivning: 'Inför utskrivning',
});

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS infarter (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, typ TEXT NOT NULL, storlek TEXT NOT NULL,
  placering TEXT NOT NULL, lagd TEXT NOT NULL, lagd_av TEXT, registrerad TEXT NOT NULL, registrerad_av TEXT NOT NULL, kalla TEXT NOT NULL DEFAULT 'manuell',
  artikel TEXT, batch TEXT, utgang TEXT, ersatter_id INTEGER, avvecklad TEXT, avvecklad_av TEXT, avveckling_orsak TEXT, kommentar TEXT
);
CREATE INDEX IF NOT EXISTS ix_infarter_patient ON infarter (patient_id);
CREATE TRIGGER IF NOT EXISTS infarter_andras_ej BEFORE UPDATE OF typ, storlek, placering, lagd, lagd_av, registrerad, registrerad_av, kalla, artikel, batch, enhet_id ON infarter
  BEGIN SELECT RAISE(ABORT, 'En registrerad in- eller utfart ändras inte. Avveckla den eller registrera ett byte.'); END;
CREATE TRIGGER IF NOT EXISTS infarter_avvecklas_en_gang BEFORE UPDATE OF avvecklad ON infarter WHEN OLD.avvecklad IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'In- eller utfarten är redan avvecklad.'); END;
CREATE TRIGGER IF NOT EXISTS infarter_raderas_ej BEFORE DELETE ON infarter BEGIN SELECT RAISE(ABORT, 'En in- eller utfart raderas inte.'); END;
CREATE TABLE IF NOT EXISTS infart_skotsel (
  id INTEGER PRIMARY KEY AUTOINCREMENT, infart_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL,
  anteckning TEXT, atgard_id INTEGER
);
CREATE INDEX IF NOT EXISTS ix_infart_skotsel ON infart_skotsel (infart_id);
CREATE TRIGGER IF NOT EXISTS infart_skotsel_andras_ej BEFORE UPDATE OF infart_id, enhet_id, tid, av, anteckning ON infart_skotsel BEGIN SELECT RAISE(ABORT, 'En registrerad skötsel ändras inte.'); END;
CREATE TRIGGER IF NOT EXISTS infart_skotsel_raderas_ej BEFORE DELETE ON infart_skotsel BEGIN SELECT RAISE(ABORT, 'En registrerad skötsel raderas inte.'); END;
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }
export const finnsTabell = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'infarter'").get());

export function infartRad(db, id) {
  sakra(db);
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM infarter WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'In- eller utfarten finns inte.', 'saknas');
  return r;
}

const skotselFor = (db, id) => db.query('SELECT * FROM infart_skotsel WHERE infart_id = ? ORDER BY tid, id').all(id);
const lokal = (t) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const dygn = (fran, till) => Math.max(0, Math.floor((Date.parse(till) - Date.parse(fran)) / DAG));

// När nästa skötsel ska göras: intervallet efter den senaste skötseln, eller efter insättningen.
export function nastaSkotsel(rad, skotsel = []) {
  const t = TYPER[rad.typ];
  if (rad.avvecklad || !t) return null;
  const senast = skotsel.length ? skotsel.at(-1).tid : rad.lagd;
  return iso(Date.parse(senast) + t.skotselTimmar * TIMME);
}

// Systemets råd om raden, på vanlig svenska.
export function rad(radIn, skotsel, nu = new Date()) {
  const t = TYPER[radIn.typ];
  const ut = [];
  if (radIn.avvecklad || !t) return ut;
  const nasta = nastaSkotsel(radIn, skotsel);
  if (nasta && Date.parse(nasta) < nu.getTime()) ut.push({ niva: 'varning', text: `Skötseln är försenad. Den skulle ha gjorts senast ${lokal(nasta)}.` });
  const d = dygn(radIn.lagd, nu);
  if (t.provaDagar && d >= t.provaDagar) {
    ut.push({ niva: 'observera', text: radIn.typ === 'kad'
      ? `Katetern har legat i ${d} dygn. Pröva om den fortfarande behövs, eftersom risken för urinvägsinfektion ökar för varje dygn.`
      : `Venkatetern har legat i ${d} dygn. Pröva om den behövs, och byt den om den ska vara kvar längre.` });
  }
  return ut;
}

export function infartUt(db, r, nu = new Date()) {
  const t = TYPER[r.typ];
  const sk = skotselFor(db, r.id);
  const till = r.avvecklad ?? iso(nu);
  return {
    id: r.id, typ: r.typ, namn: t?.namn ?? r.typ, kort: t?.kort ?? r.typ, grupp: t?.grupp ?? null, gruppText: GRUPPER[t?.grupp] ?? null,
    storlek: r.storlek, enhet: t?.enhet ?? '', storlekText: `${r.storlek} ${t?.enhet ?? ''}`.trim(), placering: r.placering,
    lagd: { tid: r.lagd, av: personNamn(db, r.lagd_av) }, registrerad: { tid: r.registrerad, av: personNamn(db, r.registrerad_av) },
    vardenhet: enhetKort(db, r.enhet_id), vardkontaktId: r.vardkontakt_id, kalla: r.kalla, kallaText: r.kalla === 'skanning' ? 'Registrerad med skanning vid sängen' : 'Registrerad i journalen',
    artikel: r.artikel ? { artikel: r.artikel, batch: r.batch, utgang: r.utgang } : null,
    dygn: dygn(r.lagd, till), aktiv: !r.avvecklad,
    avvecklad: r.avvecklad ? { tid: r.avvecklad, av: personNamn(db, r.avvecklad_av), orsak: ORSAKER[r.avveckling_orsak] ?? r.avveckling_orsak } : null,
    ersatterId: r.ersatter_id, ersattAvId: db.query('SELECT id FROM infarter WHERE ersatter_id = ?').get(r.id)?.id ?? null,
    skotsel: sk.map(s => ({ id: s.id, tid: s.tid, av: personNamn(db, s.av), anteckning: s.anteckning })),
    skotselText: t?.skotselText ?? null, nastaSkotsel: nastaSkotsel(r, sk), forsenad: Boolean(!r.avvecklad && nastaSkotsel(r, sk) && Date.parse(nastaSkotsel(r, sk)) < nu.getTime()),
    rad: rad(r, sk, nu), kommentar: r.kommentar,
  };
}

// Raderna som anroparen får se, med inre sekretess och spärr.
export function synliga(atk) {
  sakra(atk.db);
  if (!kanRoll(atk.personal, LAS)) return [];
  const rader = atk.db.query('SELECT * FROM infarter WHERE patient_id = ? ORDER BY lagd DESC, id DESC').all(atk.patientId);
  return atk.filtrera(rader, LAS);
}

// Typerna för formuläret, med förval.
export const typerUt = () => Object.entries(TYPER).map(([id, t]) => ({ id, namn: t.namn, grupp: t.grupp, enhet: t.enhet, storlekar: t.storlekar, standard: t.standard, placeringar: t.placeringar }));

// GET /api/patient/:id/infarter
export function lista(atk, nu = new Date()) {
  atk.krav(LAS);
  const rader = synliga(atk).map(r => infartUt(atk.db, r, nu));
  return {
    aktiva: rader.filter(r => r.aktiv), avvecklade: rader.filter(r => !r.aktiv), typer: typerUt(), orsaker: Object.entries(ORSAKER).map(([id, text]) => ({ id, text })),
    kanRegistrera: kanRoll(atk.personal, SKRIV), demoregel: DEMOREGEL,
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr },
  };
}

// Armbandet ska höra till den öppna patienten, och förpackningen får inte ha gått ut.
function skannat(atk, body, nu) {
  const ut = { kalla: 'manuell', artikel: null, batch: null, utgang: null };
  if (body.armband != null && body.armband !== '') {
    const k = skanning.tolka(body.armband);
    const a = k.typ === 'armband' ? atk.db.query('SELECT patient_id FROM armband WHERE kod = ? AND aterkallad IS NULL').get(k.kod) : null;
    if (!a) throw new Fel(400, 'Koden är inte ett giltigt armband. Skanna patientens armband igen.', 'ogiltig', { falt: ['armband'] });
    if (a.patient_id !== atk.patientId) throw new Fel(409, 'Armbandet tillhör en annan patient än den som är öppen. Ingenting är registrerat.', 'annan_patient', { falt: ['armband'] });
    ut.kalla = 'skanning';
  }
  if (body.forpackning != null && body.forpackning !== '') {
    const k = skanning.tolka(body.forpackning);
    if (k.typ !== 'forpackning') throw new Fel(400, 'Koden är inte en förpackning med GS1-streckkod. Skanna förpackningen igen eller lämna fältet tomt.', 'ogiltig', { falt: ['forpackning'] });
    if (k.utgang && k.utgang < iso(nu).slice(0, 10)) throw new Fel(409, `Förpackningen gick ut ${k.utgang}. Använd en annan förpackning.`, 'utgangen', { falt: ['forpackning'] });
    Object.assign(ut, { kalla: 'skanning', artikel: k.gtin, batch: k.batch, utgang: k.utgang });
  }
  return ut;
}

function lagg(atk, { typ, storlek, placering, lagd, lagdAv, vardkontaktId, kalla, ersatter = null, kommentar = null, nu }) {
  const r = atk.db.query(`INSERT INTO infarter (patient_id, enhet_id, vardkontakt_id, typ, storlek, placering, lagd, lagd_av, registrerad, registrerad_av, kalla, artikel, batch, utgang, ersatter_id, kommentar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, atk.personal.enhet_id, vardkontaktId, typ, storlek, placering, lagd, lagdAv, iso(nu), atk.personal.id,
    kalla.kalla, kalla.artikel, kalla.batch, kalla.utgang, ersatter, kommentar);
  return infartRad(atk.db, r.lastInsertRowid);
}

function prova(body, t) {
  const falt = [];
  const storlek = body.storlek == null || body.storlek === '' ? t.standard : String(body.storlek).trim().replace(',', '.');
  if (!t.storlekar.includes(storlek)) falt.push('storlek');
  const placering = textFalt(body.placering, 60);
  if (!placering) falt.push('placering');
  if (falt.length) {
    throw new Fel(400, `Kontrollera ${falt.includes('storlek') ? `storleken (för ${t.kort} finns ${t.storlekar.join(', ')} ${t.enhet})` : ''}${falt.length === 2 ? ' och ' : ''}${falt.includes('placering') ? 'var den sitter' : ''}.`, 'ogiltig', { falt });
  }
  return { storlek, placering };
}

// POST /api/patient/:id/infarter { typ, storlek?, placering, lagd?, armband?, forpackning?, kommentar? }. Utan tid har
// den som registrerar satt den nu, och insättningen registreras som åtgärd med KVÅ. Med en tidigare tid sattes den av
// någon annan, till exempel på operation, och då registreras ingen insättning i den inloggades namn.
export function registrera(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav(SKRIV);
  if (!finns(TYPER, body.typ)) throw new Fel(400, 'Välj vilken sorts in- eller utfart det är.', 'ogiltig', { falt: ['typ'] });
  const t = TYPER[body.typ];
  const { storlek, placering } = prova(body, t);
  const nuNu = body.lagd == null || body.lagd === '';
  const lagd = giltigTid(body.lagd, 'lagd', nu, { bakat: 90 * DAG });
  const kalla = skannat(atk, body, nu);
  if (!t.samtidigt) {
    const fanns = db.query('SELECT * FROM infarter WHERE patient_id = ? AND typ = ? AND avvecklad IS NULL').all(atk.patientId, body.typ)
      .filter(r => { const p = atk.prova(LAS, { enhet_id: r.enhet_id }); return p.tillaten || p.krav === 'kraver_val'; });
    // En rad på en annan vårdenhet stoppar också, men svaret säger inte var den finns. En rad på en spärrad vårdenhet
    // räknas inte, eftersom inget får tala om att den finns.
    if (fanns.length) throw new Fel(409, `Patienten har redan en ${t.namn.toLocaleLowerCase('sv')} som inte är avvecklad. Avveckla den först eller registrera ett byte.`, 'finns_redan');
  }
  const vardkontaktId = vardkontaktFor(atk, nu);
  const r = lagg(atk, { typ: body.typ, storlek, placering, lagd, lagdAv: nuNu ? atk.personal.id : null, vardkontaktId, kalla, kommentar: textFalt(body.kommentar, 300) || null, nu });
  if (nuNu && t.insattning) atgarder.registreraAtgard(atk, { kod: t.insattning, tid: lagd, vardkontaktId, underlag: { infart: r.id } });
  return infartUt(db, r, nu);
}

const andra = (atk, r) => andraRad(atk, bunden(atk, r), SKRIV, LAS, 'In- och utfarter ändras bara på den vårdenhet där de registrerades.');

// POST /api/infart/:id/skotsel { anteckning? }: skötseln är gjord nu.
export function skota(atk, r, body = {}, nu = new Date()) {
  andra(atk, r);
  if (r.avvecklad) throw new Fel(409, 'In- eller utfarten är avvecklad.', 'avvecklad');
  const t = TYPER[r.typ];
  const vk = vardkontaktFor(atk, nu);
  const a = t.skotsel ? atgarder.registreraAtgard(atk, { kod: t.skotsel, tid: iso(nu), vardkontaktId: vk, underlag: { infart: r.id } }) : null;
  atk.db.query('INSERT INTO infart_skotsel (infart_id, patient_id, enhet_id, tid, av, anteckning, atgard_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(r.id, r.patient_id, atk.personal.enhet_id, iso(nu), atk.personal.id, textFalt(body.anteckning, 300) || null, a?.id ?? null);
  return infartUt(atk.db, infartRad(atk.db, r.id), nu);
}

// POST /api/infart/:id/avveckla { orsak }
export function avveckla(atk, r, body = {}, nu = new Date(), { medAtgard = true } = {}) {
  andra(atk, r);
  if (r.avvecklad) throw new Fel(409, 'In- eller utfarten är redan avvecklad.', 'avvecklad');
  if (!finns(ORSAKER, body.orsak)) throw new Fel(400, 'Välj varför den avvecklas.', 'ogiltig', { falt: ['orsak'] });
  const t = TYPER[r.typ];
  atk.db.query('UPDATE infarter SET avvecklad = ?, avvecklad_av = ?, avveckling_orsak = ? WHERE id = ?').run(iso(nu), atk.personal.id, body.orsak, r.id);
  if (medAtgard && t.avveckling && body.orsak !== 'oavsiktligt') atgarder.registreraAtgard(atk, { kod: t.avveckling, tid: iso(nu), vardkontaktId: vardkontaktFor(atk, nu), underlag: { infart: r.id } });
  return infartUt(atk.db, infartRad(atk.db, r.id), nu);
}

// POST /api/infart/:id/byt { storlek?, placering? }: den gamla avvecklas och en ny sätts nu, med samma storlek och
// placering om inget annat anges. Bytet följer med som en kedja.
export function byt(atk, r, body = {}, nu = new Date()) {
  andra(atk, r);
  if (r.avvecklad) throw new Fel(409, 'In- eller utfarten är avvecklad.', 'avvecklad');
  const t = TYPER[r.typ];
  const { storlek, placering } = prova({ storlek: body.storlek ?? r.storlek, placering: body.placering ?? r.placering }, t);
  const kalla = skannat(atk, body, nu);
  avveckla(atk, r, { orsak: 'byte' }, nu, { medAtgard: !t.byte });
  const vk = vardkontaktFor(atk, nu);
  const ny = lagg(atk, { typ: r.typ, storlek, placering, lagd: iso(nu), lagdAv: atk.personal.id, vardkontaktId: vk, kalla, ersatter: r.id, nu });
  const kod = t.byte ?? t.insattning;
  if (kod) atgarder.registreraAtgard(atk, { kod, tid: iso(nu), vardkontaktId: vk, underlag: { infart: ny.id } });
  return infartUt(atk.db, ny, nu);
}

// Händelserna i översiktens tidslinje: när varje synlig in- och utfart sattes och avvecklades.
export function tidslinje(atk) {
  if (!finnsTabell(atk.db) || !kanRoll(atk.personal, LAS)) return [];
  const db = atk.db;
  return synliga(atk).flatMap(r => {
    const t = TYPER[r.typ];
    const enhet = enhetKort(db, r.enhet_id);
    const ut = [{ tid: r.lagd, typ: 'infart', rubrik: `Satt: ${t?.namn ?? r.typ}`, text: `${r.storlek} ${t?.enhet ?? ''}, ${r.placering}`, enhet, kalla: 'vardkallan', kallaEtikett: null, ref: { typ: 'infart', id: r.id } }];
    if (r.avvecklad) ut.push({ tid: r.avvecklad, typ: 'infart', rubrik: `Avvecklad: ${t?.namn ?? r.typ}`, text: ORSAKER[r.avveckling_orsak] ?? '', enhet, kalla: 'vardkallan', kallaEtikett: null, ref: { typ: 'infart', id: r.id } });
    return ut;
  });
}

// Skötseln i avdelningens planering (avdelningsplan.js). Raderna prövas där i behörighetsmotorn på sin vårdenhet. En
// skötsel som är försenad står först på dagen.
avdelningsplan.registreraKalla('infart', (db, { patientId, fran, till }) => {
  if (!finnsTabell(db)) return [];
  const ut = [];
  for (const r of db.query('SELECT * FROM infarter WHERE patient_id = ? AND avvecklad IS NULL').all(patientId)) {
    const t = TYPER[r.typ];
    const nasta = nastaSkotsel(r, skotselFor(db, r.id));
    if (!t || !nasta || nasta >= till) continue;
    const tidpunkt = nasta < fran ? fran : nasta;
    ut.push({ id: r.id, tid: tidpunkt, slut: iso(Date.parse(tidpunkt) + 15 * 60_000), typ: 'omlaggning', typText: 'Skötsel', patient_id: r.patient_id, enhet_id: r.enhet_id,
      text: `Skötsel av ${t.namn.toLocaleLowerCase('sv').replace(/ \(.*\)$/, '')}, ${r.placering}${nasta < fran ? '. Försenad' : ''}. ${t.skotselText}`, yrke: 'sjukskoterska', ansvarig_id: null, status: 'planerad' });
  }
  return ut;
});

// Seed: patienten på avdelning 72 (p01) har en perifer venkateter och en urinkateter som sattes vid inskrivningen.
export function seeda(db, bas = new Date()) {
  sakra(db);
  if (db.query('SELECT 1 FROM infarter LIMIT 1').get()) return;
  const v = db.query("SELECT * FROM vardkontakter WHERE patient_id = 'p01' AND typ = 'slutenvard' AND slut IS NULL ORDER BY start DESC").get();
  if (!v) return;
  const lagd = iso(Math.max(Date.parse(v.start), bas.getTime() - 2 * DAG));
  const ins = db.query(`INSERT INTO infarter (patient_id, enhet_id, vardkontakt_id, typ, storlek, placering, lagd, lagd_av, registrerad, registrerad_av, kalla) VALUES ('p01', ?, ?, ?, ?, ?, ?, 'ssk-kard', ?, 'ssk-kard', 'manuell')`);
  const pvk = Number(ins.run(v.enhet_id, v.id, 'pvk', '20', 'Vänster underarm', lagd, lagd).lastInsertRowid);
  ins.run(v.enhet_id, v.id, 'kad', '14', 'Uretra', lagd, lagd);
  db.query("INSERT INTO infart_skotsel (infart_id, patient_id, enhet_id, tid, av, anteckning) VALUES (?, 'p01', ?, ?, 'ssk-kard', ?)")
    .run(pvk, v.enhet_id, iso(Date.parse(lagd) + DAG), 'Insticksstället utan rodnad.');
}

export { vardenhetFor };
