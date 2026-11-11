// Ekonomi (runda 7, r3, Sussa 7.1.1.1, 7.1.1.2 och 7.1.2.1): faktureringsunderlag, prislistor, betalningsmottagare,
// DRG, medicinskt färdigbehandlad och kostnaderna i vårdprocessen.
//
// Systemet är experten. Ingen registrerar en transaktionspost: systemet skapar dem ur det som har hänt, vårdkontakter,
// vårddygn, åtgärder med KVÅ, läkemedel som gavs på enheten och utlämnade hjälpmedel, och räknar materialet med
// schabloner. Priset hämtas ur den prislista som gällde dagen för händelsen. Betalningsmottagaren räknas fram ur
// identiteten, åldern, folkbokföringen (simulerad) och ett LMA-kort. Vårdtillfället grupperas med en demoregel som
// liknar DRG. Varje post har ett sammanhållande id som pekar på vårdkontakten eller vårdtillfället (Sussa 6.1).
//
// Behörighet. Faktureringsunderlaget och prislistorna är ekonomens, som inte läser journalen. Varje export loggas på
// varje patient i underlaget med grunden ekonomi. Kostnaderna i vårdprocessen visas för läkare och sjuksköterskor med
// samma prövning som resten av journalen, per vårdkontakt och post, och vårdadministratören ser bara patientens
// avgifter och högkostnadsskydd. För en patient med skyddade personuppgifter innehåller underlaget aldrig namn eller
// adress, bara identiteten och att fakturan går genom Skatteverket (simulerat).
import { createHash } from 'node:crypto';
import { Fel, iso, idag, addDagar, datumAv, giltigtDatum } from './db.js';
import { Atkomst, kanRoll, vardenhetFor, enheterUnder, alder, aktivaSparrar } from './atkomst.js';
import { loggaRad } from './logg.js';
import { avgiftFor, avgifter, hogkostnadsskyddet, pagandeFor, rabattFor } from './vardkontakt.js';
import { formatera } from './identitet.js';
import { KVA, SYSTEM } from './kodverk.js';
import { CS } from './fhir-definitioner.js';
import { HANDLING_FOR } from './atgarder.js';
import * as samordnad from './samordnad.js';
import { DEMO, KATEGORIER, DRG_DEMO, DRG_OGRUPPERAD, EGEN_REGION, folkbokforing, lmaFor } from './ekonomi-schema.js';

export { DEMO, KATEGORIER };
export const DEMO_AVGIFT = 'Avgifterna är demoregler, inte några verkliga regionavgifter.';
const DAG = 86400_000;
const datumI = (t) => datumAv(new Date(typeof t === 'number' ? t : Date.parse(t)));
const finns = (db, t) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
const enhetRad = (db, id) => db.query('SELECT * FROM enheter WHERE id = ?').get(id);
const enhetKort = (db, id) => { const e = id && enhetRad(db, id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const text = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const MANAD = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const manadText = (m) => `${MANAD[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// ---------------------------------------------------------------------------------------------------------------
// Prislistor (7.1.1.2)

export function prislistaFor(db, enhetId, datum) {
  const ve = vardenhetFor(db, enhetId);
  const r = db.query('SELECT * FROM prislistor WHERE enhet_id = ? AND giltig_fran <= ? ORDER BY giltig_fran DESC, version DESC LIMIT 1').get(ve, datum);
  return r ? { ...r, poster: JSON.parse(r.poster) } : null;
}

function vardenhetRad(db, id) {
  const e = typeof id === 'string' ? enhetRad(db, id) : null;
  if (!e || e.typ !== 'vardenhet') throw new Fel(400, 'Välj en vårdenhet.', 'ogiltig', { falt: ['vardenhet'] });
  return e;
}

// Skillnaden mellan två versioner: varje pris (och hjälpmedelsavgift) som har ändrats.
function skillnad(fore, efter) {
  const ut = [];
  for (const kat of Object.keys(KATEGORIER)) {
    for (const [kod, p] of Object.entries(efter[kat] ?? {})) {
      const f = fore?.[kat]?.[kod];
      if (!f || f.pris !== p.pris) ut.push({ kategori: kat, kod, text: p.text, fore: f?.pris ?? null, efter: p.pris });
      if (f && kat === 'hjalpmedel' && f.avgift !== p.avgift) ut.push({ kategori: kat, kod, text: `${p.text}, patientens avgift`, fore: f.avgift, efter: p.avgift });
    }
  }
  return ut;
}

// Alla versioner för vårdenheten, nyast först, med giltighetstid och vad som ändrades mot versionen före.
export function prislistaHistorik(db, enhetId) {
  const e = vardenhetRad(db, enhetId);
  const rader = db.query('SELECT * FROM prislistor WHERE enhet_id = ? ORDER BY version').all(e.id).map(r => ({ ...r, poster: JSON.parse(r.poster) }));
  const versioner = rader.map((r, i) => {
    const senare = rader.slice(i + 1).map(x => x.giltig_fran).filter(d => d > r.giltig_fran).sort()[0] ?? null;
    return {
      version: r.version, giltigFran: r.giltig_fran, giltigTill: senare ? addDagar(senare, -1) : null, skapad: r.skapad, skapadAv: personKort(db, r.skapad_av),
      orsak: r.orsak, andringar: i ? skillnad(rader[i - 1].poster, r.poster) : [], poster: r.poster,
    };
  }).reverse();
  const aktuell = prislistaFor(db, e.id, idag());
  return { vardenhet: { id: e.id, hsaId: e.hsa_id, namn: e.namn }, aktuellVersion: aktuell?.version ?? null, kategorier: KATEGORIER, versioner, demo: DEMO };
}

// Vårdenheterna med den version som gäller i dag och den senaste ändringen.
export function prislistor(db) {
  return db.query("SELECT * FROM enheter WHERE typ = 'vardenhet' ORDER BY hsa_id").all().map(e => {
    const a = prislistaFor(db, e.id, idag());
    const kommande = db.query('SELECT version, giltig_fran FROM prislistor WHERE enhet_id = ? AND giltig_fran > ? ORDER BY giltig_fran').get(e.id, idag());
    return { vardenhet: { id: e.id, hsaId: e.hsa_id, namn: e.namn }, version: a?.version ?? null, giltigFran: a?.giltig_fran ?? null, kommande: kommande ? { version: kommande.version, giltigFran: kommande.giltig_fran } : null };
  });
}

// En ändring blir en ny version från ett datum som inte har passerat, så att ett underlag som redan har tagits fram
// aldrig räknas om med andra priser. Versionen bygger på den som gäller från samma datum.
export function andraPrislista(db, personal, enhetId, body = {}) {
  const e = vardenhetRad(db, enhetId);
  const fran = body.giltigFran ?? null;
  if (!giltigtDatum(fran)) throw new Fel(400, 'Ange från vilket datum de nya priserna gäller.', 'ogiltig', { falt: ['giltigFran'] });
  if (fran < idag()) throw new Fel(400, 'Priserna kan inte ändras bakåt i tiden, eftersom underlag som redan har tagits fram då skulle räknas om. Välj i dag eller ett senare datum.', 'ogiltig', { falt: ['giltigFran'] });
  const orsak = text(body.orsak);
  if (orsak.length < 3) throw new Fel(400, 'Skriv varför priserna ändras. Orsaken sparas i prislistans historik.', 'ogiltig', { falt: ['orsak'] });
  const andringar = Array.isArray(body.andringar) ? body.andringar : [];
  if (!andringar.length || andringar.length > 200) throw new Fel(400, 'Ange minst ett pris som ska ändras.', 'ogiltig', { falt: ['andringar'] });
  const bas = prislistaFor(db, e.id, fran);
  if (!bas) throw new Fel(400, 'Vårdenheten har ingen prislista.', 'ogiltig');
  const poster = JSON.parse(JSON.stringify(bas.poster));
  for (const a of andringar) {
    const post = Object.hasOwn(KATEGORIER, a?.kategori) && typeof a.kod === 'string' && Object.hasOwn(poster[a.kategori], a.kod) ? poster[a.kategori][a.kod] : null;
    if (!post) throw new Fel(400, 'Posten finns inte i prislistan.', 'ogiltig', { falt: ['andringar'] });
    for (const falt of ['pris', ...(a.kategori === 'hjalpmedel' ? ['avgift'] : [])]) {
      if (a[falt] === undefined) continue;
      if (!Number.isInteger(a[falt]) || a[falt] < 0 || a[falt] > 10_000_000) throw new Fel(400, `${post.text}: ange priset i hela kronor, från 0 till 10 000 000.`, 'ogiltig', { falt: ['andringar'] });
      post[falt] = a[falt];
    }
  }
  const version = db.query('SELECT max(version) AS v FROM prislistor WHERE enhet_id = ?').get(e.id).v + 1;
  db.query('INSERT INTO prislistor (enhet_id, version, giltig_fran, poster, skapad, skapad_av, orsak) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(e.id, version, fran, JSON.stringify(poster), iso(), personal.id, orsak);
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'prislista', resurs: `prislista:${e.id}:v${version}`, grund: 'ekonomi', syfte: orsak });
  return { version, giltigFran: fran, andringar: skillnad(bas.poster, poster), vardenhet: { id: e.id, namn: e.namn } };
}

// ---------------------------------------------------------------------------------------------------------------
// Betalningsmottagare (7.1.1.2)

const identitetText = (p) => formatera(p.id_typ ?? 'personnummer', p.personnummer);

// Vem som betalar vården. Patientens avgift räknas för sig (avgiftsbetalare).
export function vardbetalare(db, patient, datum) {
  const typ = patient.id_typ ?? 'personnummer';
  if (typ === 'reservnummer') {
    return { typ: 'okand_identitet', namn: 'Identiteten är inte fastställd', debiteras: false, vantar: true,
      text: 'Patienten har reservnummer. Underlaget väntar tills patienten har fått personnummer eller samordningsnummer, och följer då med av sig självt.' };
  }
  const lma = lmaFor(db, patient.id, datum);
  if (lma) {
    return { typ: 'migrationsverket', namn: 'Migrationsverket', debiteras: true, simulerad: true, lmaKort: lma.nummer,
      text: 'Asylsökande med LMA-kort. Regionen söker ersättning från staten genom Migrationsverket. Simulerat i demon.' };
  }
  if (typ === 'oid') {
    return { typ: 'utlandsk', namn: 'Patient utan svensk identitet', debiteras: false, vantar: true,
      text: 'Patienten har varken personnummer eller samordningsnummer. Ersättning från ett annat land enligt EU-förordningen eller den nordiska konventionen hanteras inte i demon.' };
  }
  const f = folkbokforing(patient);
  if (!f) {
    return { typ: 'okand_hemort', namn: 'Hemregionen är inte känd', debiteras: false, vantar: true,
      text: 'Patienten finns inte i folkbokföringen (simulerad), så hemregionen går inte att avgöra. Underlaget väntar tills den är utredd.' };
  }
  if (f.lanKod !== EGEN_REGION.lanKod) {
    return { typ: 'annan_region', namn: f.region, lanKod: f.lanKod, kommun: f.kommun, debiteras: true, simulerad: true,
      text: `Utomlänsvård. Patienten är folkbokförd i ${f.lan}, och ${f.region} betalar enligt riksavtalet för utomlänsvård. Underlaget följer den nationella tjänsten för utomlänsvård, som är simulerad i demon.` };
  }
  return { typ: 'egen_region', namn: EGEN_REGION.region, lanKod: f.lanKod, kommun: f.kommun, debiteras: false,
    text: 'Patienten är folkbokförd i länet. Ingen faktura skickas, och raden är underlag för kostnadsredovisning och uppföljning.' };
}

// Vårdnadshavaren för ett barn, och om skyddade personuppgifter gäller. Invånaren har ingen egen skyddsflagga, så
// skyddet hämtas ur vårdnadshavarens egen journal (samma person, kopplad eller med samma personnummer). Är barnet eller
// någon vårdnadshavare skyddad lämnas varken namn, identitet eller adress ut, eftersom de pekar ut hushållet.
function vardnadshavareFor(db, barn) {
  const alla = finns(db, 'vardnadshavare') ? db.query('SELECT i.* FROM vardnadshavare v JOIN invanare i ON i.id = v.invanare_id WHERE v.barn_id = ? ORDER BY i.id').all(barn.id) : [];
  const skyddadPerson = (i) => Boolean(db.query('SELECT 1 FROM patienter WHERE skyddad = 1 AND (id = ? OR personnummer = ?)').get(i.patient_id ?? '', i.personnummer));
  return { vh: alla[0] ?? null, skyddad: Boolean(barn.skyddad) || alla.some(skyddadPerson) };
}
const minderarig = (patient, datum) => (patient.id_typ ?? 'personnummer') !== 'reservnummer' && alder(patient.fodd, datum) < 18;

// Vem som betalar patientavgiften: patienten, eller vårdnadshavaren för ett barn under 18 år.
export function avgiftsbetalare(db, patient, datum) {
  const typ = patient.id_typ ?? 'personnummer';
  if (typ === 'reservnummer') return { typ: 'okand_identitet', namn: null, identitet: null, vantar: true, text: 'Patienten har reservnummer. Avgiften faktureras när identiteten är fastställd.' };
  if (alder(patient.fodd, datum) < 18) {
    const { vh, skyddad } = vardnadshavareFor(db, patient);
    if (skyddad) return { typ: 'vardnadshavare', namn: null, identitet: null, skyddad: true, text: 'Vårdnadshavare där barnet eller vårdnadshavaren har skyddade personuppgifter. Fakturan går genom Skatteverkets förmedling, och varken namn, identitet eller adress lämnas ut. Simulerat i demon.' };
    if (vh) return { typ: 'vardnadshavare', namn: `${vh.fornamn} ${vh.efternamn}`, identitet: formatera('personnummer', vh.personnummer), text: 'Patienten är under 18 år, så vårdnadshavaren betalar avgiften.' };
    return { typ: 'vardnadshavare', namn: null, identitet: null, vantar: true, text: 'Patienten är under 18 år. Vårdnadshavaren hämtas ur folkbokföringen, som inte finns i demon.' };
  }
  return { typ: 'patient', namn: patient.skyddad ? null : `${patient.fornamn} ${patient.efternamn}`, identitet: identitetText(patient), skyddad: Boolean(patient.skyddad), text: 'Patienten betalar avgiften själv.' };
}

// Patienten i underlaget. Namn och adress lämnas aldrig ut för en patient med skyddade personuppgifter, och inte heller
// barnets adress när en vårdnadshavare är skyddad (hushallSkyddat).
function patientDel(p, hushallSkyddat = false) {
  const skydd = Boolean(p.skyddad) || hushallSkyddat;
  return {
    id: p.id, identitet: identitetText(p), identitetstyp: p.id_typ ?? 'personnummer', skyddad: skydd,
    namn: skydd ? null : `${p.fornamn} ${p.efternamn}`, adress: skydd ? null : p.adress ?? null, postnr: skydd ? null : p.postnr ?? null, ort: skydd ? null : p.ort ?? null,
    forsandelse: skydd ? 'Skyddade personuppgifter: fakturan skickas genom Skatteverket, och adressen lämnas aldrig ut. Simulerat i demon.' : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// DRG (demoregel) och medicinskt färdigbehandlad

const vardtid = (start, slut, nu) => Math.max(1, Math.ceil(((slut ? Date.parse(slut) : nu) - Date.parse(start)) / DAG));

// Grupperingen bygger på huvuddiagnosen från den vårdenhet som har det medicinska ansvaret, aldrig på en annan vårdenhets
// diagnoser. Saknar vårdtillfället en huvuddiagnos tar systemet den från vårdenhetens senaste kontakt före inskrivningen,
// och säger det. dygn ersätter vårdtiden, så att en kostnadsruta bara räknar de vistelser användaren ser.
export function drgFor(db, vt, { dygn = null, nu = Date.now() } = {}) {
  const ve = vardenhetFor(db, vt.enhet_id);
  const egna = new Set(enheterUnder(db, ve));
  const kontakter = db.query('SELECT id FROM vardkontakter WHERE vardtillfalle_id = ?').all(vt.id).map(k => k.id);
  const dia = kontakter.length ? db.query(`SELECT * FROM diagnoser WHERE vardkontakt_id IN (${kontakter.map(() => '?').join(', ')}) ORDER BY datum DESC, id DESC`).all(...kontakter).filter(d => egna.has(d.enhet_id)) : [];
  let huvud = dia.find(d => d.typ === 'huvud');
  let fran = 'vardtillfallet';
  if (!huvud) {
    const grans = addDagar(datumI(vt.inskriven), -90);
    huvud = db.query("SELECT * FROM diagnoser WHERE patient_id = ? AND typ = 'huvud' AND datum >= ? AND datum <= ? ORDER BY datum DESC, id DESC").all(vt.patient_id, grans, datumI(vt.inskriven)).find(d => egna.has(d.enhet_id));
    fran = 'tidigare_kontakt';
  }
  const tid = dygn ?? vardtid(vt.inskriven, vt.utskriven, nu);
  if (!huvud) {
    return { ...DRG_OGRUPPERAD, demo: true, belopp: 0, vardtid: tid, huvuddiagnos: null,
      forklaring: 'Vårdtillfället saknar huvuddiagnos från den vårdenhet som har det medicinska ansvaret, så det kan inte grupperas. När huvuddiagnosen är registrerad grupperar systemet vårdtillfället av sig självt.' };
  }
  const g = DRG_DEMO.find(x => x.icd.test(huvud.kod));
  const bi = dia.some(d => d.typ === 'bi');
  const vikt = Math.round((g.vikt + (bi ? 0.1 : 0)) * 100) / 100;
  const pris = prislistaFor(db, ve, datumI(vt.utskriven ?? nu))?.poster.vardtillfalle;
  const ytterfall = Math.max(0, tid - g.trimgrans);
  const belopp = pris ? Math.round(vikt * pris.drgPoang.pris) + ytterfall * pris.ytterfallDygn.pris : 0;
  return {
    kod: g.kod, text: g.text, vikt, trimgrans: g.trimgrans, vardtid: tid, ytterfallDygn: ytterfall, huvuddiagnos: huvud.kod, huvuddiagnosFran: fran, belopp, demo: true,
    forklaring: `Grupperad på huvuddiagnosen ${huvud.kod}${bi ? ' med bidiagnos' : ''}${fran === 'tidigare_kontakt' ? ', som systemet tog från vårdenhetens kontakt före inskrivningen eftersom vårdtillfället saknar en egen' : ''}. ${ytterfall ? `${ytterfall} vårddygn utöver gruppens trimgräns på ${g.trimgrans} dygn ersätts per dygn. ` : ''}Demoregel, inte NordDRG.`,
  };
}

// Medicinskt färdigbehandlad. Har patienten en samordnad planering vid utskrivning är underrättelsen om att patienten
// är utskrivningsklar registreringen, och då räknas också kommunens betalningsansvar (samordnad.js). Annars registrerar
// läkaren det på vårdtillfället med ett klick.
export function fardigbehandlad(db, vt, { nu = Date.now() } = {}) {
  const spu = finns(db, 'samordningar') ? db.query("SELECT * FROM samordningar WHERE vardtillfalle_id = ? AND typ = 'spu' ORDER BY id DESC").get(vt.id) : null;
  if (spu) {
    const l = samordnad.lage(db, spu, { nu });
    if (l.utskrivningsklar) {
      return { datum: datumI(l.utskrivningsklar), kalla: 'spu', tid: l.utskrivningsklar, kanRegistreras: false,
        varforInte: 'Registrerat genom underrättelsen om att patienten är utskrivningsklar i den samordnade planeringen vid utskrivning.',
        kommunFran: l.betalning?.uppfyllda ? l.betalning.fran : null,
        kommunText: l.betalning ? (l.betalning.uppfyllda ? `Kommunens betalningsansvar gäller från ${l.betalning.fran}.` : 'Villkoren för kommunens betalningsansvar är inte uppfyllda, så vårddygnen stannar hos regionen.') : null };
    }
    return { datum: null, kalla: null, kanRegistreras: false,
      varforInte: 'Patienten har en samordnad planering vid utskrivning. Skicka underrättelsen om att patienten är utskrivningsklar där, så registreras det här av sig självt och kommunen får beskedet.' };
  }
  const r = db.query('SELECT * FROM fardigbehandlad WHERE vardtillfalle_id = ? ORDER BY id DESC').get(vt.id);
  if (r) return { datum: r.datum, kalla: 'registrerad', tid: r.tid, av: personKort(db, r.av), kanRegistreras: false, varforInte: `Registrerat ${r.datum}.` };
  if (vt.utskriven) return { datum: null, kalla: null, kanRegistreras: false, varforInte: 'Vårdtillfället är avslutat.' };
  return { datum: null, kalla: null, kanRegistreras: true };
}

export function registreraFardigbehandlad(atk, vt, body = {}) {
  atk.krav('fardigbehandlad');
  const db = atk.db;
  const min = vardenhetFor(db, atk.personal.enhet_id);
  const vistelse = db.query('SELECT enhet_id FROM vardkontakter WHERE vardtillfalle_id = ? AND slut IS NULL ORDER BY start DESC').get(vt.id);
  if (min !== vardenhetFor(db, vt.enhet_id) && min !== vardenhetFor(db, vistelse?.enhet_id ?? vt.enhet_id)) {
    atk.logga('fardigbehandlad', 'nekad', `vardtillfalle:${vt.id}:fardigbehandlad`, 'nekad');
    throw new Fel(403, 'Det är läkaren på den vårdenhet som har det medicinska ansvaret eller där patienten vårdas som bedömer att patienten är medicinskt färdigbehandlad.', 'nekad');
  }
  const f = fardigbehandlad(db, vt);
  if (!f.kanRegistreras) throw new Fel(400, f.varforInte, 'ogiltig');
  const datum = body.datum ?? idag();
  if (!giltigtDatum(datum)) throw new Fel(400, 'Ange ett datum.', 'ogiltig', { falt: ['datum'] });
  if (datum > idag()) throw new Fel(400, 'Datumet kan inte ligga i framtiden.', 'ogiltig', { falt: ['datum'] });
  if (datum < datumI(vt.inskriven)) throw new Fel(400, 'Datumet kan inte ligga före inskrivningen.', 'ogiltig', { falt: ['datum'] });
  db.query('INSERT INTO fardigbehandlad (vardtillfalle_id, patient_id, datum, tid, av, enhet_id) VALUES (?, ?, ?, ?, ?, ?)').run(vt.id, vt.patient_id, datum, iso(), atk.personal.id, atk.personal.enhet_id);
  atk.logga('fardigbehandlad', atk.grund(), `vardtillfalle:${vt.id}:fardigbehandlad`);
  return [201, fardigbehandlad(db, vt)];
}

// ---------------------------------------------------------------------------------------------------------------
// Transaktionsposterna (7.1.1.1)

// Sammanhang för en körning: priser, patienter, vårdtillfällen och betalningsmottagare räknas en gång.
function sammanhang(db, nu) {
  const cache = new Map();
  const minne = (nyckel, fn) => { if (!cache.has(nyckel)) cache.set(nyckel, fn()); return cache.get(nyckel); };
  return {
    db, nu,
    pris: (enhet, datum) => minne(`p|${vardenhetFor(db, enhet)}|${datum}`, () => prislistaFor(db, enhet, datum)),
    patient: (id) => minne(`pat|${id}`, () => db.query('SELECT * FROM patienter WHERE id = ?').get(id)),
    vt: (id) => (id ? minne(`vt|${id}`, () => db.query('SELECT * FROM vardtillfallen WHERE id = ?').get(id)) : null),
    fb: (vt) => minne(`fb|${vt.id}`, () => fardigbehandlad(db, vt, { nu })),
    vard: (p, datum) => minne(`vb|${p.id}|${datum}`, () => vardbetalare(db, p, datum)),
    avg: (p, datum) => minne(`ab|${p.id}|${datum}`, () => avgiftsbetalare(db, p, datum)),
    sparr: (pid) => minne(`sp|${pid}`, () => aktivaSparrar(db, pid).length > 0),
    hushall: (p, datum) => minne(`hh|${p.id}|${datum}`, () => minderarig(p, datum) && vardnadshavareFor(db, p).skyddad),
    enhet: (id) => minne(`e|${id}`, () => { const e = enhetRad(db, vardenhetFor(db, id)); return e ? { id: e.id, hsaId: e.hsa_id, namn: e.namn } : null; }),
  };
}

// Den vårdkontakt en uppgift hör till: den som står på raden, annars den kontakt på samma vårdenhet som pågick när
// uppgiften gjordes, med vårdtillfället först.
function kontaktFor(c, rad, tid) {
  const db = c.db;
  if (rad.vardkontakt_id) return db.query('SELECT * FROM vardkontakter WHERE id = ?').get(rad.vardkontakt_id) ?? null;
  const enh = enheterUnder(db, vardenhetFor(db, rad.enhet_id));
  return db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${enh.map(() => '?').join(', ')}) AND start <= ? AND (slut IS NULL OR slut >= ?)
    ORDER BY (typ = 'slutenvard') DESC, start DESC LIMIT 1`).get(rad.patient_id, ...enh, tid, tid) ?? null;
}

const STATUS = { betald: 'Betald vid besöket', faktureras: 'Faktureras', frikort: 'Frikort', avgiftsfri: 'Avgiftsfri', vantar: 'Väntar', intern: 'Ingen faktura' };

// En post. kontakt och vt kan saknas. betalare är vard eller avgift.
function post(c, { id, typ, tid, enhetId, kontakt = null, kod, text: t, antal = 1, aPris, kalla, prislista = null, patientId, betalare = 'vard', extra = {} }) {
  const p = c.patient(patientId);
  const datum = datumI(tid);
  const vt = c.vt(kontakt?.vardtillfalle_id);
  const b = betalare === 'avgift' ? c.avg(p, datum) : typeof betalare === 'object' ? betalare : c.vard(p, datum);
  // En post i ett vårdtillfälle ersätts med DRG och debiteras inte för sig.
  const iVt = Boolean(vt) && typ !== 'drg' && typ !== 'patientavgift' && b.typ !== 'kommun';
  const debiteras = Boolean(b.debiteras) && !iVt && !b.vantar;
  // En patient med en spärr får minsta möjliga uppgifter i underlaget: posten pekar bara på vårdkontakten på den egna
  // vårdenheten, inte på vårdtillfället eller hälsoärendet, som kan omfatta andra vårdenheter (beslut i runda 7).
  const minst = c.sparr(patientId) && typ !== 'drg';
  return {
    id, typ, datum, tid, vardenhet: c.enhet(enhetId), enhet: enhetKort(c.db, enhetId),
    vardkontaktId: kontakt?.id ?? null, vardtillfalleId: minst ? null : vt?.id ?? (typ === 'drg' ? extra.vardtillfalleId : null) ?? null, halsoarendeId: minst ? null : kontakt?.halsoarende_id ?? null,
    sammanhallandeId: vt && !minst ? `vardtillfalle:${vt.id}` : typ === 'drg' ? `vardtillfalle:${extra.vardtillfalleId}` : kontakt ? `vardkontakt:${kontakt.id}` : null,
    kalla, kod, text: t, antal, aPris, belopp: aPris * antal,
    prislista: prislista ? { version: prislista.version, giltigFran: prislista.giltig_fran } : null,
    betalare: b, debiteras, ingarI: iVt && b.debiteras && !minst ? 'drg' : null,
    status: b.vantar ? 'vantar' : debiteras ? 'faktureras' : 'intern', patient: patientDel(p, c.hushall(p, datum)), demo: true, ...extra,
  };
}

// Patientavgiften för en kontakt, med betalningen om den registrerades vid incheckningen.
function avgiftPost(c, v, tid) {
  const p = c.patient(v.patient_id);
  const a = avgiftFor(c.db, p, v);
  if (!a) return null;
  const b = c.avg(p, datumI(tid));
  let status = 'faktureras';
  let statusText = 'Ingen betalning registrerad vid besöket. Fakturan skickas till betalningsmottagaren.';
  if (a.belopp === 0) { status = a.frikort ? 'frikort' : 'avgiftsfri'; statusText = STATUS[status]; }
  else if (finns(c.db, 'betalningar')) {
    const bet = c.db.query('SELECT x.* FROM betalningar x JOIN bokningar b ON b.id = x.bokning_id WHERE b.vardkontakt_id = ? ORDER BY x.id DESC').get(v.id);
    if (bet?.satt === 'kort') { status = 'betald'; statusText = `Betald med kort vid besöket, kvitto ${bet.kvitto}.`; }
    else if (bet?.satt === 'faktura') statusText = `Faktura vald vid besöket, kvitto ${bet.kvitto}.`;
  }
  if (b.vantar && a.belopp > 0) { status = 'vantar'; statusText = b.text; }
  const r = post(c, { id: `patientavgift:vk${v.id}`, typ: 'patientavgift', tid, enhetId: v.enhet_id, kontakt: v, kod: v.typ === 'slutenvard' ? 'slutenvard' : v.typ === 'akut' ? 'akut' : (v.kontaktsatt ?? 'besok'),
    text: `Patientavgift. ${a.text}`, aPris: a.belopp, kalla: `vardkontakt:${v.id}`, patientId: v.patient_id, betalare: 'avgift' });
  return { ...r, status, statusText, debiteras: status === 'faktureras' };
}

function materialPost(c, { id, schablon, tid, enhetId, kontakt, kalla, patientId, antal = 1 }) {
  const pl = c.pris(enhetId, datumI(tid));
  const m = pl && Object.entries(pl.poster.material).find(([, x]) => x.schablon === schablon);
  if (!m) return null;
  return post(c, { id: `material:${id}:${m[0]}`, typ: 'material', tid, enhetId, kontakt, kod: m[0], text: `${m[1].text} (schablon)`, antal, aPris: m[1].pris, kalla, prislista: pl, patientId });
}

// Poster för en vårdkontakt: besöket eller vårddygnen, materialet och patientavgiften. fran och till begränsar dagarna.
function kontaktPoster(c, v, { fran = null, till = null } = {}) {
  const inom = (d) => (!fran || d >= fran) && (!till || d <= till);
  const ut = [];
  if (v.typ !== 'slutenvard') {
    const tid = v.ankomst ?? v.start;
    if (!inom(datumI(tid))) return ut;
    const kod = v.typ === 'akut' ? 'akut' : (v.kontaktsatt ?? 'besok');
    const pl = c.pris(v.enhet_id, datumI(tid));
    const pr = pl?.poster.vardkontakt[kod];
    if (pr) ut.push(post(c, { id: `vardkontakt:vk${v.id}`, typ: 'vardkontakt', tid, enhetId: v.enhet_id, kontakt: v, kod, text: pr.text, aPris: pr.pris, kalla: `vardkontakt:${v.id}`, prislista: pl, patientId: v.patient_id }));
    if (v.typ === 'akut') { const m = materialPost(c, { id: `vk${v.id}`, schablon: 'akut', tid, enhetId: v.enhet_id, kontakt: v, kalla: `vardkontakt:${v.id}`, patientId: v.patient_id }); if (m) ut.push(m); }
    const a = avgiftPost(c, v, tid);
    if (a) ut.push(a);
    return ut;
  }
  const vt = c.vt(v.vardtillfalle_id);
  const fb = vt ? c.fb(vt) : null;
  const p = c.patient(v.patient_id);
  const n = vardtid(v.start, v.slut, c.nu);
  for (let i = 0; i < n; i++) {
    const tid = new Date(Date.parse(v.start) + i * DAG).toISOString();
    const datum = datumI(tid);
    if (!inom(datum)) continue;
    const pl = c.pris(v.enhet_id, datum);
    if (!pl) continue;
    const kommun = fb?.kommunFran && datum >= fb.kommunFran;
    const pr = pl.poster.vardtillfalle[kommun ? 'kommunDygn' : 'varddygn'];
    const f = folkbokforing(p);
    const betalare = kommun ? { typ: 'kommun', namn: `${f?.kommun ?? 'Hemkommunen'} (simulerad)`, debiteras: true, simulerad: true, text: 'Kommunens betalningsansvar för utskrivningsklara patienter (lag 2017:612, 5 kap.). Demopris, beloppet bestäms enligt 5 kap. 6 § eller en överenskommelse.' } : 'vard';
    const extra = fb?.datum ? { fardigbehandlad: fb.datum, efterFardigbehandlad: datum > fb.datum } : {};
    ut.push(post(c, { id: `varddygn:vk${v.id}:${datum}`, typ: 'varddygn', tid, enhetId: v.enhet_id, kontakt: v, kod: kommun ? 'kommunDygn' : 'varddygn', text: pr.text, aPris: pr.pris, kalla: `vardkontakt:${v.id}`, prislista: pl, patientId: v.patient_id, betalare, extra }));
    const m = materialPost(c, { id: `vk${v.id}:${datum}`, schablon: 'varddygn', tid, enhetId: v.enhet_id, kontakt: v, kalla: `vardkontakt:${v.id}`, patientId: v.patient_id });
    if (m) ut.push(m);
  }
  if (v.slut && inom(datumI(v.slut))) { const a = avgiftPost(c, v, v.slut); if (a) ut.push(a); }
  return ut;
}

function atgardPoster(c, a, kontakt) {
  const pl = c.pris(a.enhet_id, datumI(a.tid));
  const pr = pl?.poster.atgard[a.kod];
  if (!pr) return [];
  const kalla = a.lg ? `lakemedelsgenomgang:${a.id}` : `atgard:${a.id}`;
  const ut = [post(c, { id: a.lg ? `atgard:lg${a.id}` : `atgard:a${a.id}`, typ: 'atgard', tid: a.tid, enhetId: a.enhet_id, kontakt, kod: a.kod, text: KVA[a.kod] ?? pr.text, aPris: pr.pris, kalla, prislista: pl, patientId: a.patient_id })];
  const m = materialPost(c, { id: a.lg ? `lg${a.id}` : `a${a.id}`, schablon: a.kod, tid: a.tid, enhetId: a.enhet_id, kontakt, kalla, patientId: a.patient_id });
  if (m) ut.push(m);
  return ut;
}

function lakemedelPoster(c, a, kontakt) {
  const pl = c.pris(a.enhet_id, datumI(a.tid));
  const pr = pl?.poster.lakemedel[a.lakemedel_id];
  if (!pr) return [];
  const kalla = `administrering:${a.id}`;
  const ut = [post(c, { id: `lakemedel:adm${a.id}`, typ: 'lakemedel', tid: a.tid, enhetId: a.enhet_id, kontakt, kod: a.lakemedel_id, text: pr.text, aPris: pr.pris, kalla, prislista: pl, patientId: a.patient_id })];
  const form = c.db.query('SELECT form FROM katalog WHERE id = ?').get(a.lakemedel_id)?.form ?? '';
  if (/injektion|infusion/.test(form) && a.status === 'given') {
    const m = materialPost(c, { id: `adm${a.id}`, schablon: 'injektion', tid: a.tid, enhetId: a.enhet_id, kontakt, kalla, patientId: a.patient_id });
    if (m) ut.push(m);
  }
  return ut;
}

function hjalpmedelPoster(c, h, kontakt) {
  const pl = c.pris(h.enhet_id, datumI(h.tid));
  const pr = pl?.poster.hjalpmedel[h.artikel];
  if (!pr) return [];
  const kalla = `hjalpmedel:${h.id}`;
  const ut = [post(c, { id: `hjalpmedel:h${h.id}`, typ: 'hjalpmedel', tid: h.tid, enhetId: h.enhet_id, kontakt, kod: h.artikel, text: pr.text, antal: h.antal, aPris: pr.pris, kalla, prislista: pl, patientId: h.patient_id })];
  if (pr.avgift > 0) {
    const r = post(c, { id: `patientavgift:h${h.id}`, typ: 'patientavgift', tid: h.tid, enhetId: h.enhet_id, kontakt, kod: h.artikel, text: `Hjälpmedelsavgift för ${pr.text.toLowerCase()}. ${DEMO_AVGIFT}`, antal: h.antal, aPris: pr.avgift, kalla, prislista: pl, patientId: h.patient_id, betalare: 'avgift' });
    ut.push({ ...r, status: r.betalare.vantar ? 'vantar' : 'faktureras', statusText: r.betalare.vantar ? r.betalare.text : 'Faktureras till betalningsmottagaren.', debiteras: !r.betalare.vantar });
  }
  return ut;
}

function drgPost(c, vt) {
  const ve = vardenhetFor(c.db, vt.enhet_id);
  // För en patient med en spärr räknas vårdtiden och inskrivningen bara på vistelserna på den egna vårdenheten.
  const egna = c.sparr(vt.patient_id) ? c.db.query(`SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? AND enhet_id IN (${enheterUnder(c.db, ve).map(() => '?').join(', ')}) ORDER BY start`).all(vt.id, ...enheterUnder(c.db, ve)) : null;
  const g = drgFor(c.db, vt, { nu: c.nu, ...(egna?.length ? { dygn: egna.reduce((s, v) => s + vardtid(v.start, v.slut, c.nu), 0) } : {}) });
  const inskriven = egna?.length ? egna[0].start : vt.inskriven;
  const pl = c.pris(ve, datumI(vt.utskriven));
  const p = c.patient(vt.patient_id);
  const b = c.vard(p, datumI(vt.utskriven));
  const fb = c.fb(vt);
  const r = post(c, { id: `drg:vt${vt.id}`, typ: 'drg', tid: vt.utskriven, enhetId: ve, kod: g.kod, text: g.text, aPris: g.belopp, kalla: `vardtillfalle:${vt.id}`, prislista: pl,
    patientId: vt.patient_id, betalare: b, extra: { vardtillfalleId: vt.id, drg: { kod: g.kod, vikt: g.vikt, vardtid: g.vardtid, ytterfallDygn: g.ytterfallDygn ?? 0 },
      tidigareHuvuddiagnos: g.huvuddiagnosFran === 'tidigare_kontakt', inskriven, utskriven: vt.utskriven, ...(fb.datum ? { fardigbehandlad: fb.datum } : {}) } });
  // Ett vårdtillfälle som inte går att gruppera väntar.
  if (g.kod === DRG_OGRUPPERAD.kod) return { ...r, status: 'vantar', debiteras: false, statusText: g.forklaring };
  return r;
}

const nuIso = (nu) => new Date(nu).toISOString();
const hant = (c) => (rad) => (rad.planerad && !rad.ankomst ? false : Date.parse(rad.start) <= c.nu);

// Alla poster för en vårdenhet och en period (datum i svensk tid, till och med till).
export function transaktioner(db, { vardenhet, fran, till, nu = Date.now() }) {
  const e = vardenhetRad(db, vardenhet);
  const c = sammanhang(db, nu);
  const enh = enheterUnder(db, e.id);
  const ph = enh.map(() => '?').join(', ');
  const inom = (t) => { const d = datumI(t); return d >= fran && d <= till; };
  const ut = [];
  for (const v of db.query(`SELECT * FROM vardkontakter WHERE enhet_id IN (${ph}) AND kalla = 'vardkallan' ORDER BY start, id`).all(...enh).filter(hant(c))) ut.push(...kontaktPoster(c, v, { fran, till }));
  for (const vt of db.query("SELECT * FROM vardtillfallen WHERE kalla = 'vardkallan' AND utskriven IS NOT NULL ORDER BY utskriven, id").all()) {
    if (vardenhetFor(db, vt.enhet_id) === e.id && inom(vt.utskriven)) ut.push(drgPost(c, vt));
  }
  const objekt = [
    ...db.query(`SELECT * FROM atgarder WHERE enhet_id IN (${ph}) AND kalla = 'vardkallan'`).all(...enh).map(a => ['a', a]),
    ...(finns(db, 'lakemedelsgenomgangar') ? db.query(`SELECT *, 'XV015' AS kod, 1 AS lg, NULL AS vardkontakt_id FROM lakemedelsgenomgangar WHERE enhet_id IN (${ph}) AND kalla = 'vardkallan'`).all(...enh).map(a => ['a', a]) : []),
    ...db.query(`SELECT * FROM administreringar WHERE enhet_id IN (${ph}) AND status IN ('given', 'overlamnad') AND kalla = 'vardkallan'`).all(...enh).map(a => ['l', a]),
    ...db.query(`SELECT * FROM hjalpmedel_utlamnade WHERE enhet_id IN (${ph})`).all(...enh).map(a => ['h', a]),
  ];
  for (const [typ, a] of objekt) {
    if (!inom(a.tid) || Date.parse(a.tid) > nu) continue;
    const k = kontaktFor(c, a, a.tid);
    ut.push(...(typ === 'a' ? atgardPoster(c, a, k) : typ === 'l' ? lakemedelPoster(c, a, k) : hjalpmedelPoster(c, a, k)));
  }
  return ut.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.id < b.id ? -1 : 1));
}

// ---------------------------------------------------------------------------------------------------------------
// Sammanställning, översikt och export

const TYPTEXT = { vardkontakt: 'Vårdkontakter', varddygn: 'Vårddygn', drg: 'DRG (demogrupper)', atgard: 'Åtgärder (KVÅ)', material: 'Material (schablon)', hjalpmedel: 'Hjälpmedel', lakemedel: 'Läkemedel', patientavgift: 'Patientavgifter' };
const BETALARTEXT = { egen_region: 'Region Örebro län (egen region)', annan_region: 'Andra regioner (utomlänsvård)', migrationsverket: 'Migrationsverket (asylsökande)', kommun: 'Kommuner (betalningsansvar)', patient: 'Patienter', vardnadshavare: 'Vårdnadshavare', okand_identitet: 'Identiteten är inte fastställd', utlandsk: 'Patienter utan svensk identitet', okand_hemort: 'Hemregionen är inte känd' };

// Sammanställningen utan personuppgifter: antal och belopp per typ och per slag av betalningsmottagare, och vad som väntar.
export function sammanstallning(rader) {
  const grupp = (nyckel, texter) => {
    const m = new Map();
    for (const r of rader) { const k = nyckel(r); const g = m.get(k) ?? { typ: k, text: texter[k] ?? k, antal: 0, belopp: 0 }; g.antal++; g.belopp += r.belopp; m.set(k, g); }
    return [...m.values()];
  };
  const varningar = [];
  const n = (villkor) => rader.filter(villkor).length;
  const st = (x, en, fl) => `${x} ${x === 1 ? en : fl}`;
  const reserv = n(r => r.betalare.typ === 'okand_identitet');
  if (reserv) varningar.push(`${st(reserv, 'post väntar', 'poster väntar')} eftersom patienten har reservnummer och identiteten inte är fastställd. De följer med av sig själva när identiteten är känd.`);
  const hem = n(r => r.betalare.typ === 'okand_hemort');
  if (hem) varningar.push(`${st(hem, 'post väntar', 'poster väntar')} eftersom hemregionen inte går att avgöra ur folkbokföringen.`);
  const utl = n(r => r.betalare.typ === 'utlandsk');
  if (utl) varningar.push(`${st(utl, 'post gäller', 'poster gäller')} patienter utan svensk identitet. Ersättning från andra länder hanteras inte i demon.`);
  const ogr = n(r => r.typ === 'drg' && r.kod === DRG_OGRUPPERAD.kod);
  if (ogr) varningar.push(`${st(ogr, 'vårdtillfälle kan', 'vårdtillfällen kan')} inte grupperas eftersom huvuddiagnosen saknas.`);
  const tidig = n(r => r.typ === 'drg' && r.tidigareHuvuddiagnos);
  if (tidig) varningar.push(`${st(tidig, 'vårdtillfälle är grupperat', 'vårdtillfällen är grupperade')} på en huvuddiagnos från en kontakt före inskrivningen.`);
  const utan = n(r => r.typ !== 'drg' && !r.vardkontaktId);
  if (utan) varningar.push(`${st(utan, 'post saknar', 'poster saknar')} vårdkontakt och har inget sammanhållande id.`);
  return {
    antal: rader.length, summa: rader.reduce((s, r) => s + r.belopp, 0), debiteras: rader.filter(r => r.debiteras).reduce((s, r) => s + r.belopp, 0),
    perTyp: grupp(r => r.typ, TYPTEXT), perBetalare: grupp(r => r.betalare.typ, BETALARTEXT), varningar,
  };
}

export function periodAv(manad) {
  if (typeof manad !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(manad)) throw new Fel(400, 'Välj en månad.', 'ogiltig', { falt: ['period'] });
  const fran = `${manad}-01`;
  const till = addDagar(`${addDagar(fran, 32).slice(0, 7)}-01`, -1);
  return { manad, fran, till, text: manadText(manad), pagar: manad === idag().slice(0, 7) };
}
export const forraManaden = () => addDagar(`${idag().slice(0, 7)}-01`, -1).slice(0, 7);

function senasteExport(db, enhetId, fran, till) {
  const r = db.query('SELECT * FROM fakturaexporter WHERE enhet_id = ? AND fran = ? AND till = ? ORDER BY id DESC').get(enhetId, fran, till);
  return r ? { id: r.id, tid: r.tid, format: r.format, antal: r.antal, av: personKort(db, r.av) } : null;
}

// Översikten per vårdenhet för ekonomen. Förra månaden är förvald, eftersom den är avslutad.
export function oversikt(db, personal, { period = null, nu = Date.now() } = {}) {
  const p = periodAv(period ?? forraManaden());
  const perioder = [];
  for (let i = 0, m = idag().slice(0, 7); i < 13; i++) { perioder.push({ manad: m, text: manadText(m), pagar: i === 0 }); m = addDagar(`${m}-01`, -1).slice(0, 7); }
  const vardenheter = db.query("SELECT * FROM enheter WHERE typ = 'vardenhet' ORDER BY hsa_id").all().map(e => ({
    vardenhet: { id: e.id, hsaId: e.hsa_id, namn: e.namn }, ...sammanstallning(transaktioner(db, { vardenhet: e.id, fran: p.fran, till: p.till, nu })),
    senastExporterad: senasteExport(db, e.id, p.fran, p.till),
  }));
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'faktureringsunderlag', resurs: `faktureringsunderlag:oversikt:${p.manad}`, grund: 'ekonomi' });
  return { period: p, perioder, vardenheter, demo: DEMO };
}

export function exporter(db) {
  return db.query('SELECT * FROM fakturaexporter ORDER BY id DESC LIMIT 50').all().map(r => ({
    id: r.id, tid: r.tid, av: personKort(db, r.av), vardenhet: enhetKort(db, r.enhet_id), period: { fran: r.fran, till: r.till, text: r.fran.slice(8) === '01' && r.till === periodAv(r.fran.slice(0, 7)).till ? manadText(r.fran.slice(0, 7)) : `${r.fran} till ${r.till}` },
    format: r.format, antal: r.antal, summa: r.summa, debiteras: r.debiteras, sha256: r.sha256,
  }));
}

const KOLUMNER = [['id', 'Post-id'], ['sammanhallandeId', 'Sammanhållande id'], ['vardkontaktId', 'Vårdkontakt'], ['vardtillfalleId', 'Vårdtillfälle'], ['typ', 'Typ'], ['datum', 'Datum'],
  ['vardenhetHsa', 'Vårdenhetens HSA-id'], ['vardenhet', 'Vårdenhet'], ['kod', 'Kod'], ['text', 'Text'], ['antal', 'Antal'], ['aPris', 'À-pris'], ['belopp', 'Belopp'],
  ['debiteras', 'Debiteras'], ['status', 'Status'], ['betalareTyp', 'Betalningsmottagare, typ'], ['betalare', 'Betalningsmottagare'], ['betalareIdentitet', 'Betalningsmottagarens identitet'],
  ['lanKod', 'Hemregionens länskod'], ['lmaKort', 'LMA-kort'], ['patientIdentitet', 'Patientens identitet'], ['identitetstyp', 'Identitetstyp'], ['patientNamn', 'Patientens namn'],
  ['adress', 'Adress'], ['postnr', 'Postnummer'], ['ort', 'Ort'], ['forsandelse', 'Försändelse'], ['drgKod', 'DRG'], ['drgVikt', 'DRG-vikt'],
  ['fardigbehandlad', 'Medicinskt färdigbehandlad'], ['prislista', 'Prislistans version'], ['demo', 'Demo']];
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const platt = (r) => ({
  id: r.id, sammanhallandeId: r.sammanhallandeId, vardkontaktId: r.vardkontaktId, vardtillfalleId: r.vardtillfalleId, typ: r.typ, datum: r.datum,
  vardenhetHsa: r.vardenhet?.hsaId, vardenhet: r.vardenhet?.namn, kod: r.kod, text: r.text, antal: r.antal, aPris: r.aPris, belopp: r.belopp,
  debiteras: r.debiteras ? 'ja' : 'nej', status: r.status, betalareTyp: r.betalare.typ, betalare: r.betalare.namn ?? '', betalareIdentitet: r.betalare.identitet ?? '',
  lanKod: r.betalare.lanKod ?? '', lmaKort: r.betalare.lmaKort ?? '', patientIdentitet: r.patient.identitet, identitetstyp: r.patient.identitetstyp, patientNamn: r.patient.namn,
  adress: r.patient.adress, postnr: r.patient.postnr, ort: r.patient.ort, forsandelse: r.patient.forsandelse, drgKod: r.drg?.kod ?? '', drgVikt: r.drg?.vikt ?? '',
  fardigbehandlad: r.fardigbehandlad ?? '', prislista: r.prislista?.version ?? '', demo: 'ja',
});
// Underlaget innehåller inga diagnoskoder utöver DRG-gruppen och inga interna fält.
const utan = (r) => { const { tid, enhet, tidigareHuvuddiagnos, ...rest } = r; return rest; };

// Underlaget till den nationella tjänsten för utomlänsvård (simulerad): en grupp per hemregion med vårdtillfällen och
// besök, identitet, vårdande vårdenhet, vårdform, datum, DRG och belopp.
function utomlans(rader) {
  const m = new Map();
  for (const r of rader.filter(x => x.betalare.typ === 'annan_region' && x.debiteras)) {
    const g = m.get(r.betalare.lanKod) ?? { hemregion: r.betalare.namn, lanKod: r.betalare.lanKod, vardandeRegion: EGEN_REGION.region, simulerad: true, poster: [], summa: 0 };
    g.poster.push({ postId: r.id, sammanhallandeId: r.sammanhallandeId, patientIdentitet: r.patient.identitet, vardenhetHsa: r.vardenhet.hsaId, vardform: r.typ === 'drg' ? 'slutenvard' : 'oppenvard',
      datum: r.datum, inskriven: r.inskriven ?? null, utskriven: r.utskriven ?? null, kod: r.kod, drg: r.drg ? { kod: r.drg.kod, vikt: r.drg.vikt, vardtid: r.drg.vardtid } : null, belopp: r.belopp });
    g.summa += r.belopp;
    m.set(r.betalare.lanKod, g);
  }
  return [...m.values()];
}

export function exportera(db, personal, { vardenhet, period = null, fran = null, till = null, format, nu = Date.now() }) {
  if (!['csv', 'json'].includes(format)) throw new Fel(400, 'Välj CSV eller JSON.', 'ogiltig', { falt: ['format'] });
  const e = vardenhetRad(db, vardenhet);
  const p = period ? periodAv(period) : { fran, till };
  if (!giltigtDatum(p.fran) || !giltigtDatum(p.till) || p.fran > p.till) throw new Fel(400, 'Välj en period.', 'ogiltig', { falt: ['period'] });
  const rader = transaktioner(db, { vardenhet: e.id, fran: p.fran, till: p.till, nu });
  const s = sammanstallning(rader);
  const id = (db.query('SELECT max(id) AS m FROM fakturaexporter').get().m ?? 0) + 1;
  const skapad = iso();
  const textUt = format === 'json'
    ? `${JSON.stringify({
      format: 'vardkallan-faktureringsunderlag', version: 1, demo: true, text: DEMO, exportId: id, skapad, av: { id: personal.id, namn: personal.namn },
      vardenhet: { id: e.id, hsaId: e.hsa_id, namn: e.namn }, period: { fran: p.fran, till: p.till }, antal: rader.length, summa: { totalt: s.summa, debiteras: s.debiteras },
      varningar: s.varningar, poster: rader.map(utan), utomlansvard: utomlans(rader),
    }, null, 2)}\n`
    : `﻿${[KOLUMNER.map(([, r]) => csvCell(r)).join(';'), ...rader.map(platt).map(r => KOLUMNER.map(([k]) => csvCell(r[k])).join(';'))].join('\r\n')}\r\n`;
  const sha = createHash('sha256').update(textUt).digest('hex');
  db.query('INSERT INTO fakturaexporter (id, tid, av, enhet_id, fran, till, format, antal, summa, debiteras, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, skapad, personal.id, e.id, p.fran, p.till, format, rader.length, s.summa, s.debiteras, sha);
  // Varje patient i underlaget får en rad i åtkomstloggen, och exporten en rad utan patient.
  for (const pid of [...new Set(rader.map(r => r.patient.id))]) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: 'faktureringsunderlag', resurs: `faktureringsunderlag:${id}`, grund: 'ekonomi' });
  }
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'faktureringsunderlag', resurs: `faktureringsunderlag:${id}:${format}`, grund: 'ekonomi',
    syfte: `Export av ${rader.length} poster för ${e.namn}, ${p.fran} till ${p.till}, som ${format.toUpperCase()}.` });
  const namn = `faktureringsunderlag-${e.id}-${period ?? `${p.fran}-${p.till}`}.${format}`;
  return { text: textUt, namn, contentType: format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8', antal: rader.length, exportId: id, sha256: sha };
}

// ---------------------------------------------------------------------------------------------------------------
// Kostnader i vårdprocessen (7.1.2.1)

// Poster för en patients vårdkontakter: kontakterna själva och det som hör till dem, utan period.
function posterForKontakter(c, kontakter) {
  const db = c.db;
  const ids = new Set(kontakter.map(k => k.id));
  const pid = kontakter[0]?.patient_id;
  const ut = kontakter.flatMap(v => kontaktPoster(c, v));
  if (!pid) return ut;
  const objekt = [
    ...db.query("SELECT * FROM atgarder WHERE patient_id = ? AND kalla = 'vardkallan'").all(pid).map(a => ['a', a]),
    ...(finns(db, 'lakemedelsgenomgangar') ? db.query("SELECT *, 'XV015' AS kod, 1 AS lg, NULL AS vardkontakt_id FROM lakemedelsgenomgangar WHERE patient_id = ? AND kalla = 'vardkallan'").all(pid).map(a => ['a', a]) : []),
    ...db.query("SELECT * FROM administreringar WHERE patient_id = ? AND status IN ('given', 'overlamnad') AND kalla = 'vardkallan'").all(pid).map(a => ['l', a]),
    ...db.query('SELECT * FROM hjalpmedel_utlamnade WHERE patient_id = ?').all(pid).map(a => ['h', a]),
  ];
  for (const [typ, a] of objekt) {
    if (Date.parse(a.tid) > c.nu) continue;
    const k = kontaktFor(c, a, a.tid);
    if (!k || !ids.has(k.id)) continue;
    ut.push(...(typ === 'a' ? atgardPoster(c, a, k) : typ === 'l' ? lakemedelPoster(c, a, k) : hjalpmedelPoster(c, a, k)));
  }
  return ut;
}

const summera = (rader) => {
  const m = new Map();
  for (const r of rader) { const g = m.get(r.kod) ?? { kod: r.kod, text: r.text, antal: 0, belopp: 0 }; g.antal += r.antal; g.belopp += r.belopp; m.set(r.kod, g); }
  return [...m.values()].sort((a, b) => b.belopp - a.belopp);
};

// Beloppen i kostnadsrutan räknas bara på de besök användaren får se.
const MIN_JOURNAL = 'Beloppet gäller de besök du kan se. Patienten ser hela högkostnadsskyddet i Min journal.';
function hogkostnadText(h) {
  if (h.lma) return { ...h, text: 'Patienten är asylsökande med LMA-kort och betalar den lägre avgiften. Högkostnadsskyddet gäller inte i demon.' };
  if (h.frikort) return { ...h, text: `Patienten har frikort: ${h.grans} kr är betalt inom högkostnadsskyddet de senaste tolv månaderna. ${MIN_JOURNAL}` };
  return { ...h, text: `Patienten har betalat ${h.betalt} kr av ${h.grans} kr inom högkostnadsskyddet de senaste tolv månaderna. ${h.kvar} kr återstår till frikort. ${MIN_JOURNAL}` };
}

// Läkemedel och åtgärder visas bara när rollen och behörighetsmotorn släpper igenom dem, som i journalen.
function synligaRader(atk, alla) {
  const pers = atk.personal;
  return alla.filter((r) => {
    if (r.typ === 'lakemedel') return atk.prova('las_lakemedel', { enhet_id: r.enhet?.id, gemensam: true }).tillaten;
    if (r.typ === 'atgard' || (r.typ === 'material' && /^(atgard|lakemedelsgenomgang|administrering):/.test(r.kalla))) {
      const h = r.typ === 'atgard' ? HANDLING_FOR[r.kod] : r.kalla.startsWith('administrering:') ? 'las_lakemedel' : HANDLING_FOR[alla.find(x => x.typ === 'atgard' && x.kalla === r.kalla)?.kod];
      return Boolean(h) && kanRoll(pers, h) && atk.prova(h, { enhet_id: r.enhet?.id, gemensam: h === 'las_lakemedel' }).tillaten;
    }
    return true;
  });
}

// Avgiften för en kontakt räknas om med bara de besök användaren får se, samma filter som för högkostnadsskyddet, så att
// ett belopp eller en text som taket har påverkat aldrig röjer besök på en spärrad eller annan vårdenhet. Statusen
// räknas bara ur det som inte beror på taket: den omräknade avgiften, om betalningsmottagaren väntar och om en
// kortbetalning finns. Den ofiltrerade postens status används aldrig.
function synligAvgift(atk, p, r, synligaBesok) {
  const db = atk.db;
  const vkId = /^vardkontakt:(\d+)$/.exec(r.kalla)?.[1];
  if (!vkId) return { datum: r.datum, tid: r.tid, text: r.text, belopp: r.belopp, status: r.status, statusText: r.statusText ?? STATUS[r.status], rad: r };
  const v = db.query('SELECT * FROM vardkontakter WHERE id = ?').get(Number(vkId));
  const a = avgiftFor(db, p, v, { synliga: synligaBesok });
  const b = avgiftsbetalare(db, p, r.datum);
  const kort = finns(db, 'betalningar') && Boolean(db.query("SELECT 1 FROM betalningar x JOIN bokningar k ON k.id = x.bokning_id WHERE k.vardkontakt_id = ? AND x.satt = 'kort'").get(v.id));
  const status = a.belopp === 0 ? (a.frikort ? 'frikort' : 'avgiftsfri') : b.vantar ? 'vantar' : kort ? 'betald' : 'faktureras';
  // Runda 12, r3: rabatten med ordinarie avgift och skäl, räknad på samma synliga besök som avgiften.
  // Runda 13, r3 (säkerhetsfynd 9): med vårdgivarens godkända avgifter och åldersgränser.
  const rabatt = rabattFor(p, v, a, avgifter(db));
  return { datum: r.datum, tid: r.tid, text: `Patientavgift. ${a.text}`, belopp: a.belopp, status, statusText: status === 'vantar' ? b.text : STATUS[status], ...(rabatt ? { rabatt } : {}), rad: r };
}

// Kostnadsrutan för ett vårdtillfälle eller en vårdkontakt. Utan val visas det pågående vårdtillfället, annars dagens
// eller den senaste kontakten i öppenvården. Allt prövas i behörighetsmotorn per vårdkontakt och post.
export function kostnader(atk, q = {}, nu = Date.now()) {
  const db = atk.db;
  atk.krav('las_kostnader');
  const pers = atk.personal;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const full = kanRoll(pers, 'las_lakemedel');
  const kontakterAv = (sql, ...a) => db.query(sql).all(...a).filter(v => v.kalla === 'vardkallan' && (!v.planerad || v.ankomst) && Date.parse(v.start) <= nu);
  let typ = null;
  let mal = null;
  let synliga = [];
  if (q.vardtillfalle) {
    mal = db.query('SELECT * FROM vardtillfallen WHERE id = ? AND patient_id = ?').get(Number(q.vardtillfalle), atk.patientId);
    if (!mal) throw new Fel(404, 'Vårdtillfället finns inte.', 'saknas');
    typ = 'vardtillfalle';
  } else if (q.vardkontakt) {
    mal = db.query('SELECT * FROM vardkontakter WHERE id = ? AND patient_id = ?').get(Number(q.vardkontakt), atk.patientId);
    if (!mal) throw new Fel(404, 'Vårdkontakten finns inte.', 'saknas');
    typ = 'vardkontakt';
  }
  if (!typ) {
    for (const vt of db.query("SELECT * FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL AND kalla = 'vardkallan' ORDER BY inskriven DESC").all(atk.patientId)) {
      const s = atk.filtrera(kontakterAv('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start', vt.id), 'las_kostnader');
      if (s.length) { typ = 'vardtillfalle'; mal = vt; synliga = s; break; }
    }
  }
  if (!typ) {
    const dag = datumI(nu);
    const kand = atk.filtrera(kontakterAv("SELECT * FROM vardkontakter WHERE patient_id = ? AND typ <> 'slutenvard' ORDER BY start DESC", atk.patientId), 'las_kostnader');
    const v = kand.find(x => !x.slut || datumI(x.ankomst ?? x.start) === dag) ?? kand.find(x => Date.parse(x.start) >= nu - 90 * DAG);
    if (v) { typ = 'vardkontakt'; mal = v; synliga = [v]; }
  } else if (!synliga.length) {
    if (typ === 'vardtillfalle') {
      const alla = kontakterAv('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start', mal.id);
      synliga = atk.filtrera(alla, 'las_kostnader');
      if (!synliga.length) atk.krav('las_kostnader', { resurs: { enhet_id: alla[0]?.enhet_id ?? mal.enhet_id }, beskrivning: `kostnader:vardtillfalle:${mal.id}` });
    } else {
      atk.krav('las_kostnader', { resurs: { enhet_id: mal.enhet_id }, beskrivning: `kostnader:vardkontakt:${mal.id}` });
      synliga = [mal];
    }
  }
  // Bara de kontakter användaren får se räknas, så att beloppet inte röjer ett besök på en spärrad eller annan vårdenhet.
  const synligaBesok = (rader) => atk.filtrera(rader, 'las_admin');
  const hog = hogkostnadText(hogkostnadsskyddet(db, p, nu, { synliga: synligaBesok }));
  if (!typ) {
    atk.logga('las_kostnader', atk.grund(), 'kostnader:ingen');
    return { aktuell: null, hogkostnadsskydd: hog, demo: full ? DEMO : DEMO_AVGIFT };
  }
  const c = sammanhang(db, nu);
  const alla = posterForKontakter(c, synliga);
  // Läkemedel och åtgärder visas bara när rollen och behörighetsmotorn släpper igenom dem, som i journalen.
  const rader = synligaRader(atk, alla);
  const avgifter = rader.filter(r => r.typ === 'patientavgift').map(r => synligAvgift(atk, p, r, synligaBesok));
  const sedan = synliga.reduce((m, v) => (v.start < m ? v.start : m), synliga[0].start);
  const ut = { typ, id: mal.id, sedan, pagar: typ === 'vardtillfalle' ? !mal.utskriven : !mal.slut, patientavgifter: avgifter.map(({ tid, rad, ...x }) => x), demo: full ? DEMO : DEMO_AVGIFT };
  // Runda 12, r3 (Sussa 7.1.2.1): summan av rabatterna på patientavgifterna i rutan.
  ut.rabatter = avgifter.reduce((s, x) => s + (x.rabatt?.rabatt ?? 0), 0);
  if (full) {
    const kost = rader.filter(r => r.typ !== 'patientavgift');
    ut.kategorier = ['vardkontakt', 'varddygn', 'lakemedel', 'material', 'atgard', 'hjalpmedel'].map(t => ({ typ: t, text: TYPTEXT[t], antal: kost.filter(r => r.typ === t).reduce((s, r) => s + r.antal, 0), belopp: kost.filter(r => r.typ === t).reduce((s, r) => s + r.belopp, 0) })).filter(k => k.antal);
    ut.totalt = ut.kategorier.reduce((s, k) => s + k.belopp, 0);
    ut.lakemedel = summera(kost.filter(r => r.typ === 'lakemedel'));
    ut.material = summera(kost.filter(r => r.typ === 'material'));
    ut.atgarder = summera(kost.filter(r => r.typ === 'atgard'));
    ut.hjalpmedel = summera(kost.filter(r => r.typ === 'hjalpmedel'));
    ut.vistelser = synliga.map(v => ({ id: v.id, vardenhet: enhetKort(db, v.enhet_id), start: v.start, slut: v.slut, dygn: v.typ === 'slutenvard' ? vardtid(v.start, v.slut, nu) : null }));
    if (typ === 'vardtillfalle') {
      const dygn = synliga.filter(v => v.typ === 'slutenvard').reduce((s, v) => s + vardtid(v.start, v.slut, nu), 0);
      // DRG bygger på den ansvariga vårdenhetens diagnoser och visas bara för den som får läsa dem.
      if (kanRoll(pers, 'las_diagnoser') && atk.prova('las_diagnoser', { enhet_id: mal.enhet_id }).tillaten) {
        const g = drgFor(db, mal, { dygn, nu });
        ut.drg = { kod: g.kod, text: g.text, vikt: g.vikt, belopp: g.belopp, vardtid: g.vardtid, forklaring: g.forklaring, preliminar: !mal.utskriven };
      }
      const fb = fardigbehandlad(db, mal, { nu });
      ut.fardigbehandlad = { ...fb, kanRegistreras: fb.kanRegistreras && kanRoll(pers, 'fardigbehandlad') };
    }
  }
  atk.logga('las_kostnader', atk.grund(), `kostnader:${typ}:${mal.id}`);
  return { aktuell: ut, hogkostnadsskydd: hog, demo: full ? DEMO : DEMO_AVGIFT };
}

// ---------------------------------------------------------------------------------------------------------------
// Hjälpmedel och LMA-kort

export function registreraHjalpmedel(atk, body = {}) {
  atk.krav('hjalpmedel');
  const db = atk.db;
  const pers = atk.personal;
  const pl = prislistaFor(db, pers.enhet_id, idag());
  const artikel = typeof body.artikel === 'string' ? body.artikel : '';
  const pr = pl && Object.hasOwn(pl.poster.hjalpmedel, artikel) ? pl.poster.hjalpmedel[artikel] : null;
  if (!pr) throw new Fel(400, 'Välj ett hjälpmedel ur vårdenhetens prislista.', 'ogiltig', { falt: ['artikel'] });
  const v = pagandeFor(db, pers, atk.patientId);
  const r = db.query('INSERT INTO hjalpmedel_utlamnade (patient_id, enhet_id, vardkontakt_id, artikel, antal, tid, av) VALUES (?, ?, ?, ?, 1, ?, ?)')
    .run(atk.patientId, pers.enhet_id, v?.id ?? null, artikel, iso(), pers.id);
  const id = Number(r.lastInsertRowid);
  atk.logga('hjalpmedel', atk.grund(), `hjalpmedel:${id}`);
  return [201, { id, artikel, text: pr.text, avgift: pr.avgift, vardkontaktId: v?.id ?? null, demo: DEMO_AVGIFT }];
}

export function hjalpmedelLista(db, personal) {
  const pl = prislistaFor(db, personal.enhet_id, idag());
  return Object.entries(pl?.poster.hjalpmedel ?? {}).map(([kod, p]) => ({ kod, text: p.text, avgift: p.avgift }));
}

export function registreraLma(atk, body = {}) {
  atk.krav('lma');
  const nummer = text(body.nummer, 40);
  if (!/^[A-Za-z0-9-]{4,30}$/.test(nummer)) throw new Fel(400, 'Skriv numret som det står på LMA-kortet.', 'ogiltig', { falt: ['nummer'] });
  if (!giltigtDatum(body.giltigTill) || body.giltigTill < idag()) throw new Fel(400, 'Ange datumet som kortet gäller till. Ett kort som har gått ut ger ingen lägre avgift.', 'ogiltig', { falt: ['giltigTill'] });
  const r = atk.db.query('INSERT INTO lma_kort (patient_id, nummer, giltig_till, registrerad, av) VALUES (?, ?, ?, ?, ?)').run(atk.patientId, nummer, body.giltigTill, iso(), atk.personal.id);
  atk.logga('lma', atk.grund(), `lma:${r.lastInsertRowid}`);
  return [201, { id: Number(r.lastInsertRowid), nummer, giltigTill: body.giltigTill, text: 'LMA-kortet är registrerat. Patienten betalar den lägre avgiften för asylsökande och Migrationsverket blir betalningsmottagare för vården (simulerat).' }];
}

// ---------------------------------------------------------------------------------------------------------------
// Min journal: patienten ser hela sitt högkostnadsskydd, med varje avgift som räknas, var och när. Det är patientens
// egna uppgifter, och spärrar mellan vårdenheter gäller inte patientens egen läsning.
export function minHogkostnadsskydd(atk, nu = Date.now()) {
  const db = atk.db;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const h = hogkostnadsskyddet(db, p, nu, { medAvgifter: true });
  const avgifter = (h.avgifter ?? []).map(a => ({ datum: datumI(a.kontakt.ankomst ?? a.kontakt.start), vardenhet: enhetKort(db, vardenhetFor(db, a.kontakt.enhet_id))?.namn ?? null, belopp: a.belopp }));
  const text = h.lma ? 'Du är asylsökande med LMA-kort och betalar den lägre avgiften. Högkostnadsskyddet gäller inte i demon.'
    : h.frikort ? `Du har frikort till och med ${h.frikortTill}. Du har betalat ${h.grans} kr inom högkostnadsskyddet de senaste tolv månaderna.`
      : `Du har betalat ${h.betalt} kr av ${h.grans} kr inom högkostnadsskyddet de senaste tolv månaderna. När du har betalat ${h.kvar} kr till får du frikort.`;
  return { grans: h.grans, betalt: h.betalt, kvar: h.kvar, frikort: h.frikort, frikortTill: h.frikortTill ?? null, lma: h.lma, avgifter, text, demoregler: true, demo: DEMO_AVGIFT };
}

// ---------------------------------------------------------------------------------------------------------------
// FHIR: ChargeItem (runda 7, r3). En resurs per post för patientens vårdkontakter, med samma behörighet och filter som
// kostnadsrutan: vårdkontakterna prövas med las_kostnader, läkemedel och åtgärder med samma handlingar som i journalen,
// och vårdadministratören får bara patientavgifterna, omräknade på de besök hen får se. DRG-posten finns bara i
// faktureringsunderlaget.
const fhirId = (id) => id.replace(/:/g, '.');
const KALLA_TABELL = { vk: 'vardkontakter', a: 'atgarder', lg: 'lakemedelsgenomgangar', adm: 'administreringar', h: 'hjalpmedel_utlamnade' };
function patientForFhirId(db, id) {
  const m = /^[a-z]+\.(vk|a|lg|adm|h)(\d{1,9})(\.|$)/.exec(id ?? '');
  if (!m || !finns(db, KALLA_TABELL[m[1]])) return null;
  return db.query(`SELECT patient_id FROM ${KALLA_TABELL[m[1]]} WHERE id = ?`).get(Number(m[2]))?.patient_id ?? null;
}

export function chargeItems(atk, nu = Date.now()) {
  const db = atk.db;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const full = kanRoll(atk.personal, 'las_lakemedel');
  const kontakter = db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND kalla = 'vardkallan' ORDER BY start, id").all(atk.patientId)
    .filter(v => (!v.planerad || v.ankomst) && Date.parse(v.start) <= nu);
  const synliga = atk.filtrera(kontakter, 'las_kostnader');
  const synligaBesok = (rader) => atk.filtrera(rader, 'las_admin');
  const rader = synligaRader(atk, posterForKontakter(sammanhang(db, nu), synliga));
  const poster = [
    ...(full ? rader.filter(r => r.typ !== 'patientavgift').map(r => ({ rad: r, belopp: r.belopp, text: r.text })) : []),
    ...rader.filter(r => r.typ === 'patientavgift').map(r => { const a = synligAvgift(atk, p, r, synligaBesok); return { rad: r, belopp: a.belopp, text: a.text }; }),
  ];
  return poster.map(({ rad: r, belopp, text: t }) => ({
    resourceType: 'ChargeItem', id: fhirId(r.id), meta: { tag: [{ system: `${CS}/kalla`, code: 'vardkallan' }] }, status: 'billable',
    code: { ...(r.typ === 'atgard' && KVA[r.kod] ? { coding: [{ system: SYSTEM.kva, code: r.kod, display: KVA[r.kod] }] } : {}), text: t },
    subject: { reference: `Patient/${atk.patientId}` }, ...(r.vardkontaktId ? { context: { reference: `Encounter/${r.vardkontaktId}` } } : {}),
    occurrenceDateTime: r.tid, performingOrganization: { reference: `Organization/${r.vardenhet.id}` }, quantity: { value: r.antal },
    priceOverride: { value: belopp, currency: 'SEK' },
  }));
}

// GET /fhir/ChargeItem?patient=<id> och GET /fhir/ChargeItem/<id>. ctx som i fhir.hantera.
export function fhirHantera(ctx, delar, bundle) {
  const { db, personal, url } = ctx;
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  if (delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  const [, id] = delar;
  let pid;
  if (id) {
    pid = patientForFhirId(db, id);
    if (!pid) throw new Fel(404, 'Resursen finns inte.', 'saknas');
  } else {
    pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
    if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
    if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  }
  const resurs = id ? `fhir/ChargeItem/${id}` : `fhir/ChargeItem${url.search}`;
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), 'las_kostnader');
  atk.krav('las_kostnader', { beskrivning: resurs });
  const resurser = chargeItems(atk);
  atk.logga('las_kostnader', atk.grund(), resurs);
  if (!id) return { status: 200, body: bundle(resurser) };
  const r = resurser.find(x => x.id === id);
  if (!r) throw new Fel(404, 'Resursen finns inte.', 'saknas');
  return { status: 200, body: r };
}
