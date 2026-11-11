// Bilder och media i journalen, version 1.1 (runda 11, r5, Sussa 4.2.1.1 till 4.2.1.4). Bygger på bilder.js.
//
// Det som finns här: uppladdning i delar (så att riktiga bilder, filmer och ljud får plats trots att ett anrop är högst
// 64 kB), miniatyrer och visningsbilder som servern gör, annoteringar som ett eget lager (originalet ändras aldrig),
// import från en simulerad medicinteknisk apparat och från en simulerad annan vårdgivare med granskning före journalen,
// det simulerade multimediaarkivet genom DICOMweb (dicom-arkiv.js) och FHIR Media och ImagingStudy.
//
// Systemet är experten:
//   - Typen, bildens storlek, tiden när bilden togs, kameran och filmens längd läses ur filen. Bilden knyts själv till
//     den pågående vårdkontakten, och kroppsstället föreslås ur patientens tidigare bilder.
//   - Servern gör miniatyren och visningsbilden, så att galleriet är snabbt och visar samma sak i alla webbläsare.
//     Platsuppgifter i en bilds EXIF följer inte med till miniatyren eller visningsbilden.
//   - En bild från en apparat kommer med patientens identitet ur apparatens arbetslista, och systemet stoppar en bild som
//     enligt apparaten gäller en annan patient. En bild från en annan vårdgivare hämtas bara med patientens samtycke och
//     behåller sitt ursprung: vårdgivaren, vårdenheten och den som tog bilden.
//   - I arkivet väljer systemet fönstret efter undersökningen och räknar mätningar i millimeter ur pixelavståndet.
//
// Apparaterna, den andra vårdgivaren och arkivet är simulerade i demon och märkta som simulerade.
import { createHash, randomBytes } from 'node:crypto';
import { Fel } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import * as bilder from './bilder.js';
import * as kodek from './bildkodek.js';
import * as arkiv from './dicom-arkiv.js';
import * as sammanhallen from './sammanhallen.js';
import { tabell, finns, textFalt, iso, MIN, DAG, bunden, lasRad, andraRad, personNamn, vardkontaktFor } from './specialist-hjalp.js';

// En del är 45 000 byte, som i base64 och JSON ryms i ett anrop på 64 kB.
export const DELSTORLEK = 45_000;
export const MAX_PAGAENDE = 2;
export const UPPLADDNING_MIN = 30;
export const MINIATYR = 256;
export const VISNING = 1600;
export const MAX_ANNOTERINGAR = 30;
export const MAX_IMPORT_VANTANDE = 8;
export const ANNOTERINGSTYPER = tabell({ pil: 'Pil', ring: 'Ring', linje: 'Linje', text: 'Text' });
export const DEMO_APPARAT = 'Apparaterna är simulerade i demon. Ingen riktig medicinteknisk apparat är ansluten, och bilderna räknas fram av systemet.';
export const DEMO_EXTERN = 'Den andra vårdgivaren och dess bilder är simulerade i demon.';

const skrivFor = (personal) => (kanRoll(personal, 'skriv_journal') ? 'skriv_journal' : 'skriv_omvardnad');
const kategoriFor = (personal) => (kanRoll(personal, 'skriv_journal') ? 'journal' : 'omvardnad');
const kanSkriva = (personal) => kanRoll(personal, 'skriv_journal') || kanRoll(personal, 'skriv_omvardnad');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// ---- Uppladdning i delar -------------------------------------------------------------------------------------------

function taBortUppladdning(db, id) {
  db.query('DELETE FROM media_uppladdning_delar WHERE uppladdning_id = ?').run(id);
  db.query('DELETE FROM media_uppladdningar WHERE id = ?').run(id);
}
// Uppladdningar som inte blev klara inom en halvtimme töms, så att inga delar av en fil ligger kvar.
export function rensa(db, nu = new Date()) {
  bilder.sakra(db);
  for (const u of db.query('SELECT id FROM media_uppladdningar WHERE skapad < ?').all(iso(nu.getTime() - UPPLADDNING_MIN * MIN))) taBortUppladdning(db, u.id);
}

export function uppladdningRad(db, id) {
  bilder.sakra(db);
  const r = typeof id === 'string' && /^[0-9a-f]{32}$/.test(id) ? db.query('SELECT * FROM media_uppladdningar WHERE id = ?').get(id) : null;
  if (!r) throw new Fel(404, 'Uppladdningen finns inte.', 'saknas');
  return r;
}
const egen = (atk, u) => { bunden(atk, u); if (u.personal_id !== atk.personal.id) throw new Fel(404, 'Uppgiften finns inte.', 'saknas'); return u; };

// Startar en uppladdning: { namn, storlek, sha256?, kalla, kroppsstalle, beskrivning, tagen, anteckningId, langdSek }.
// Taket per patient och sandlåda prövas redan här, med de uppladdningar som pågår.
export function starta(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  rensa(db, nu);
  atk.krav(skrivFor(atk.personal));
  const namn = bilder.filnamn(body.namn);
  if (!namn) throw new Fel(400, 'Filen behöver ett namn.', 'ogiltig', { falt: ['namn'] });
  const storlek = body.storlek;
  const max = Math.max(...Object.values(bilder.MAX_FIL));
  if (!Number.isInteger(storlek) || storlek < 1) throw new Fel(400, 'Filens storlek saknas.', 'ogiltig', { falt: ['storlek'] });
  if (storlek > max) throw new Fel(400, `Filen är för stor. Den största filen som tas emot är ${max / 1024 / 1024} MB i demon (en film). En bild får vara högst ${bilder.MAX_FIL.bild / 1024 / 1024} MB.`, 'ogiltig', { falt: ['storlek'] });
  if (body.sha256 != null && (typeof body.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(body.sha256))) throw new Fel(400, 'Kontrollsumman är inte en SHA-256.', 'ogiltig', { falt: ['sha256'] });
  const kalla = body.kalla ?? 'fil';
  if (!['fil', 'kamera', 'mikrofon'].includes(kalla)) throw new Fel(400, 'Källan är fil eller kamera.', 'ogiltig', { falt: ['kalla'] });
  if (db.query('SELECT count(*) AS n FROM media_uppladdningar WHERE personal_id = ?').get(atk.personal.id).n >= MAX_PAGAENDE) {
    throw new Fel(409, `Du har redan ${MAX_PAGAENDE} uppladdningar som inte är klara. Vänta tills de är klara eller avbryt dem.`, 'tak');
  }
  bilder.takFor(db, atk.patientId, storlek);
  const meta = { kalla, kroppsstalle: textFalt(body.kroppsstalle, 60) || null, beskrivning: textFalt(body.beskrivning, 300) || null,
    tagen: typeof body.tagen === 'string' ? body.tagen.slice(0, 40) : null, anteckningId: Number.isInteger(body.anteckningId) ? body.anteckningId : null,
    langdSek: typeof body.langdSek === 'number' && Number.isFinite(body.langdSek) ? body.langdSek : null };
  const id = randomBytes(16).toString('hex');
  const delar = Math.ceil(storlek / DELSTORLEK);
  db.query('INSERT INTO media_uppladdningar (id, patient_id, enhet_id, personal_id, namn, storlek, delar, sha256, meta, skapad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, atk.patientId, atk.personal.enhet_id, atk.personal.id, namn, storlek, delar, body.sha256 ?? null, JSON.stringify(meta), iso(nu));
  return { id, delstorlek: DELSTORLEK, delar, giltigTill: iso(nu.getTime() + UPPLADDNING_MIN * MIN) };
}

// En del: { nr, data } med data i base64. Varje del har exakt rätt storlek och tas emot en gång.
export function del(atk, u, body = {}) {
  const db = atk.db;
  egen(atk, u);
  const nr = body.nr;
  if (!Number.isInteger(nr) || nr < 0 || nr >= u.delar) throw new Fel(400, 'Delens nummer stämmer inte.', 'ogiltig', { falt: ['nr'] });
  if (typeof body.data !== 'string' || body.data.length > Math.ceil(DELSTORLEK / 3) * 4 + 8 || !/^[A-Za-z0-9+/=]+$/.test(body.data)) throw new Fel(400, 'Delen kunde inte läsas.', 'ogiltig', { falt: ['data'] });
  const buf = Buffer.from(body.data, 'base64');
  const vantad = nr === u.delar - 1 ? u.storlek - DELSTORLEK * (u.delar - 1) : DELSTORLEK;
  if (buf.length !== vantad) throw new Fel(400, 'Delen har fel storlek.', 'ogiltig', { falt: ['data'] });
  if (db.query('SELECT 1 FROM media_uppladdning_delar WHERE uppladdning_id = ? AND nr = ?').get(u.id, nr)) throw new Fel(409, 'Delen är redan mottagen.', 'ogiltig');
  db.query('INSERT INTO media_uppladdning_delar (uppladdning_id, patient_id, nr, data) VALUES (?, ?, ?, ?)').run(u.id, u.patient_id, nr, buf);
  atk.loggad = true;
  return { mottagna: db.query('SELECT count(*) AS n FROM media_uppladdning_delar WHERE uppladdning_id = ?').get(u.id).n, delar: u.delar };
}

export function avbryt(atk, u) {
  egen(atk, u);
  taBortUppladdning(atk.db, u.id);
  atk.loggad = true;
  return { avbruten: true };
}

// Filen sätts ihop, kontrolleras och förs in i journalen. En bild avkodas på servern först, så att en trasig bild eller
// en bild med fler pixlar än taket aldrig kommer in. Delarna töms vad som än händer.
export function avsluta(atk, u, nu = new Date()) {
  const db = atk.db;
  egen(atk, u);
  atk.krav(skrivFor(atk.personal));
  const delar = db.query('SELECT data FROM media_uppladdning_delar WHERE uppladdning_id = ? ORDER BY nr').all(u.id);
  if (delar.length !== u.delar) throw new Fel(409, `${delar.length} av ${u.delar} delar har kommit. Skicka resten först.`, 'ogiltig');
  const buf = Buffer.concat(delar.map(d => Buffer.from(d.data)));
  const meta = JSON.parse(u.meta);
  let fil;
  try {
    if (buf.length !== u.storlek || (u.sha256 && sha(buf) !== u.sha256)) throw new Fel(400, 'Filen blev inte densamma som den som skickades. Skicka den igen.', 'ogiltig');
    fil = bilder.tolkaBuffer(u.namn, buf);
  } catch (e) { taBortUppladdning(db, u.id); throw e; }
  return (async () => {
    try {
      if (bilder.TYPER[fil.typ].bild) {
        try { await kodek.bildStorlek(fil.buf); } catch { throw new Fel(400, 'Bilden kunde inte läsas, eller har fler än 16 miljoner pixlar. Spara den i PNG eller JPEG och pröva igen.', 'ogiltig'); }
      }
      const m = bilder.laddaFil(atk, kategoriFor(atk.personal), fil, meta, nu, { uppladdning: u.id });
      taBortUppladdning(db, u.id);
      await gorVisning(db, bilder.mediaRad(db, m.id));
      return bilder.mediaUt(db, bilder.mediaRad(db, m.id));
    } catch (e) { taBortUppladdning(db, u.id); throw e; }
  })();
}

// En liten fil i ett anrop (bilder.ladda), med miniatyren gjord direkt.
export function laddaHel(atk, body = {}, nu = new Date()) {
  const m = bilder.ladda(atk, body, nu);
  return gorVisning(atk.db, bilder.mediaRad(atk.db, m.id)).then(() => m);
}

// ---- Miniatyrer och visningsbilder ---------------------------------------------------------------------------------

// Servern gör miniatyren (256 pixlar) och för en bild visningsbilden (1 600 pixlar), en gång per fil. En bild som inte
// går att avkoda får en ritad miniatyr. Film, ljud och PDF får en ritad miniatyr, ljud i WAV med ljudkurvan.
export async function gorVisning(db, m) {
  bilder.sakra(db);
  const har = new Set(db.query('SELECT storlek FROM media_visning WHERE media_id = ?').all(m.id).map(r => r.storlek));
  const slag = bilder.TYPER[m.typ]?.slag ?? 'dokument';
  const spara = (storlek, v) => db.query('INSERT OR IGNORE INTO media_visning (media_id, patient_id, enhet_id, storlek, typ, data, bredd, hojd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(m.id, m.patient_id, m.enhet_id, storlek, v.typ, v.data, v.bredd ?? null, v.hojd ?? null);
  const ritad = () => ({ typ: 'image/png', data: kodek.ritadMiniatyr(slag === 'bild' ? 'dokument' : slag, slag === 'ljud' ? Buffer.from(m.data) : null), bredd: 256, hojd: 192 });
  if (slag !== 'bild') { if (!har.has('miniatyr')) spara('miniatyr', ritad()); return; }
  const buf = Buffer.from(m.data);
  try {
    const st = await kodek.bildStorlek(buf);
    db.query('UPDATE media_egenskaper SET bredd = ?, hojd = ? WHERE media_id = ?').run(st.bredd, st.hojd, m.id);
    if (!har.has('miniatyr')) spara('miniatyr', await kodek.forminska(buf, MINIATYR, { kvalitet: 78 }));
    if (!har.has('visning')) spara('visning', await kodek.forminska(buf, VISNING, { kvalitet: 85 }));
  } catch {
    if (!har.has('miniatyr')) spara('miniatyr', ritad());
  }
}

// Miniatyren eller visningsbilden, med samma prövning och loggning som filen.
export function visningsfil(atk, m, storlek) {
  bilder.kravFil(atk, m, `:${storlek}`);
  if (storlek === 'visning' && !bilder.TYPER[m.typ]?.bild) throw new Fel(404, 'Filen har ingen visningsbild.', 'saknas');
  return (async () => {
    let r = atk.db.query('SELECT * FROM media_visning WHERE media_id = ? AND storlek = ?').get(m.id, storlek);
    if (!r) { await gorVisning(atk.db, m); r = atk.db.query('SELECT * FROM media_visning WHERE media_id = ? AND storlek = ?').get(m.id, storlek); }
    // En bild som inte gick att avkoda visas som originalet.
    if (!r) return new Response(m.data, { headers: bilder.huvuden(m.typ, m.namn) });
    return new Response(r.data, { headers: bilder.huvuden(r.typ, `${storlek}-${m.id}.${r.typ === 'image/png' ? 'png' : 'jpg'}`) });
  })();
}

// ---- Annoteringar --------------------------------------------------------------------------------------------------

const annoteringUt = (db, a, personal) => ({
  id: a.id, mediaId: a.media_id, typ: a.typ, typText: ANNOTERINGSTYPER[a.typ], punkter: JSON.parse(a.punkter), text: a.text,
  skapad: { tid: a.skapad, av: personNamn(db, a.skapad_av) }, egen: a.skapad_av === personal.id,
});
export function annoteringRad(db, id) {
  bilder.sakra(db);
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM media_annoteringar WHERE id = ?').get(Number(id)) : null;
  if (!r) throw new Fel(404, 'Annoteringen finns inte.', 'saknas');
  return r;
}
// Annoteringarna på en bild som användaren får se: inre sekretess och spärr gäller annoteringens vårdenhet.
export function annoteringarFor(atk, m) {
  const rader = atk.db.query('SELECT * FROM media_annoteringar WHERE media_id = ? AND borttagen IS NULL ORDER BY id').all(m.id);
  return atk.filtrera(rader, () => bilder.lasHandlingFor(m)).map(a => annoteringUt(atk.db, a, atk.personal));
}

// { typ, punkter, text }. Punkterna är andelar av bildens bredd och höjd (0 till 1): två för pil, ring och linje, en för
// text. Annoteringen sparas på den inloggades vårdenhet, och bilden ändras inte.
export function annotera(atk, m, body = {}, nu = new Date()) {
  const db = atk.db;
  lasRad(atk, m, bilder.lasHandlingFor(m));
  atk.krav(skrivFor(atk.personal));
  if (m.status !== 'journal' || !bilder.TYPER[m.typ]?.bild) throw new Fel(400, 'Bara bilder i journalen kan annoteras.', 'ogiltig');
  if (!finns(ANNOTERINGSTYPER, body.typ)) throw new Fel(400, 'Välj pil, ring, linje eller text.', 'ogiltig', { falt: ['typ'] });
  const antal = body.typ === 'text' ? 1 : 2;
  const p = body.punkter;
  if (!Array.isArray(p) || p.length !== antal || !p.every(x => Array.isArray(x) && x.length === 2 && x.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1))) {
    throw new Fel(400, antal === 1 ? 'Texten behöver en plats på bilden.' : 'Annoteringen behöver en start och ett slut på bilden.', 'ogiltig', { falt: ['punkter'] });
  }
  const text = textFalt(body.text, 120);
  if (body.typ === 'text' && !text) throw new Fel(400, 'Skriv texten.', 'ogiltig', { falt: ['text'] });
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const egna = db.query('SELECT enhet_id FROM media_annoteringar WHERE media_id = ? AND borttagen IS NULL').all(m.id).filter(a => vardenhetFor(db, a.enhet_id) === ve).length;
  if (egna >= MAX_ANNOTERINGAR) throw new Fel(409, `Bilden har redan ${MAX_ANNOTERINGAR} annoteringar från din vårdenhet.`, 'tak');
  const r = db.query('INSERT INTO media_annoteringar (media_id, patient_id, enhet_id, typ, punkter, text, skapad, skapad_av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(m.id, m.patient_id, atk.personal.enhet_id, body.typ, JSON.stringify(p.map(x => x.map(v => Math.round(v * 10000) / 10000))), text || null, iso(nu), atk.personal.id);
  return annoteringUt(db, db.query('SELECT * FROM media_annoteringar WHERE id = ?').get(r.lastInsertRowid), atk.personal);
}

// Bara den som gjorde annoteringen tar bort den. Raden finns kvar med tiden och personen.
export function taBortAnnotering(atk, a, nu = new Date()) {
  const db = atk.db;
  const m = bilder.mediaRad(db, a.media_id);
  lasRad(atk, a, bilder.lasHandlingFor(m));
  if (a.skapad_av !== atk.personal.id) throw new Fel(403, 'Bara den som gjorde annoteringen kan ta bort den.', 'nekad');
  if (a.borttagen) throw new Fel(409, 'Annoteringen är redan borttagen.', 'ogiltig');
  db.query('UPDATE media_annoteringar SET borttagen = ?, borttagen_av = ? WHERE id = ?').run(iso(nu), atk.personal.id, a.id);
  return { id: a.id, borttagen: true };
}

// ---- Journalens vy -------------------------------------------------------------------------------------------------

// Allt som fliken Bilder behöver: bilderna med annoteringar, studierna med arkivets uppbyggnad, det som väntar på
// granskning på den inloggades vårdenhet, apparaterna och läget hos den andra vårdgivaren.
export function forPatient(atk, nu = new Date()) {
  const db = atk.db;
  const bas = bilder.forPatient(atk, nu);
  const rader = new Map(db.query('SELECT * FROM media WHERE patient_id = ?').all(atk.patientId).map(m => [m.id, m]));
  bas.bilder = bas.bilder.map(b => ({ ...b, annoteringar: annoteringarFor(atk, rader.get(b.id)) }));
  const studier = new Map(db.query('SELECT * FROM media_studier WHERE patient_id = ?').all(atk.patientId).map(s => [s.id, s]));
  bas.studier = bas.studier.map(s => {
    const rad = studier.get(s.id);
    if (rad?.status !== 'besvarad') return s;
    const st = arkiv.struktur(rad, bilder.UNDERSOKNINGAR[rad.undersokning]);
    return { ...s, arkivet: { studieUid: rad.uid, serier: st.serier.map(x => ({ uid: x.uid, antal: x.antal, beskrivning: x.beskrivning, forsta: x.instanser[0].uid })),
      fonster: st.fonster, forvaltFonster: st.forvaltFonster, pixelavstand: st.mod.avstand, rader: st.mod.rader, kolumner: st.mod.kolumner, dicomweb: `/api/dicomweb/studies/${rad.uid}` } };
  });
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const vantar = [...rader.values()].filter(m => m.status === 'vantar' && vardenhetFor(db, m.enhet_id) === ve)
    .filter(m => atk.prova(m.kalla === 'min_journal' ? 'las_journal' : bilder.lasHandlingFor(m), { enhet_id: m.enhet_id }).tillaten)
    .sort((a, b) => a.registrerad.localeCompare(b.registrerad));
  const p = db.query('SELECT personnummer FROM patienter WHERE id = ?').get(atk.patientId);
  bas.attGranska = kanSkriva(atk.personal) ? vantar.map(m => ({ ...bilder.mediaUt(db, m), identitet: identitetFor(db, m, p) })) : [];
  bas.kanSkriva = kanSkriva(atk.personal);
  bas.kanBestalla = kanRoll(atk.personal, 'remittera');
  bas.apparater = bas.kanSkriva ? Object.entries(APPARATER).map(([id, a]) => ({ id, namn: a.namn, beskrivning: a.beskrivning })) : [];
  bas.extern = { vardgivare: sammanhallen.VARDGIVARE.namn, samtycke: sammanhallen.harSamtycke(db, atk.personal, atk.patientId), kanHamta: kanRoll(atk.personal, 'skriv_journal') };
  bas.forslagStalle = bas.bilder.find(b => b.kroppsstalle)?.kroppsstalle ?? null;
  bas.granser = { delstorlek: DELSTORLEK, maxFil: { ...bilder.MAX_FIL } };
  bas.simulerat = { apparat: DEMO_APPARAT, extern: DEMO_EXTERN, arkiv: arkiv.SIMULERAT };
  return bas;
}

// Om identiteten i en import stämmer med patienten. En bild från en apparat bär personnumret ur apparatens arbetslista.
function identitetFor(db, m, p) {
  if (m.kalla !== 'apparat') return { stammer: true };
  const a = JSON.parse(bilder.egenskaperRad(db, m.id)?.apparat ?? '{}');
  return a.patientPnr === p.personnummer ? { stammer: true, text: 'Apparaten anger samma personnummer som journalen.' }
    : { stammer: false, text: 'Apparaten anger en annan patient än den här. Bilden kan inte föras in i journalen.' };
}

// ---- Import från en medicinteknisk apparat (simulerad) -------------------------------------------------------------

export const APPARATER = tabell({
  sarkamera: { namn: 'Sårkamera (simulerad)', modell: 'Demosårkamera S2', serienummer: 'DEMO-SAR-0001', modalitet: 'XC', bilder: 1, beskrivning: 'Sårfoto med mätskala' },
  dermatoskop: { namn: 'Dermatoskop (simulerat)', modell: 'Demodermatoskop D1', serienummer: 'DEMO-DERM-0001', modalitet: 'XC', bilder: 2, beskrivning: 'Dermatoskopisk bild' },
  ultraljud: { namn: 'Bärbar ultraljudsapparat (simulerad)', modell: 'Demoultraljud U3', serienummer: 'DEMO-UL-0001', modalitet: 'US', bilder: 2, beskrivning: 'Ultraljudsbild' },
});

// En simulerad bild ur arkivets bildgenerator, som PNG.
function simuleradBild(fro, modalitet, nr) {
  const undersokning = modalitet === 'US' ? { modalitet: 'US', bilder: 2 } : { modalitet, bilder: 4 };
  return arkiv.rendera(arkiv.pixlar({ id: fro, undersokning: 'apparat' }, undersokning, nr), { center: 128, bredd: 256 });
}

// Apparaten skickar bilderna av patienten som är vald i dess arbetslista. I demon väljer systemet patienten i
// arbetslistan när journalen är öppen, så personnumret följer med (pnr anges bara av testerna). Bilderna väntar på
// granskning på vårdenheten och kommer in i journalen när någon har granskat dem.
export function franApparat(atk, apparatId, body = {}, nu = new Date(), { pnr = null } = {}) {
  const db = atk.db;
  bilder.sakra(db);
  atk.krav(skrivFor(atk.personal));
  if (!finns(APPARATER, apparatId)) throw new Fel(400, 'Apparaten finns inte på din vårdenhet.', 'ogiltig', { falt: ['apparat'] });
  const a = APPARATER[apparatId];
  if (db.query("SELECT count(*) AS n FROM media WHERE patient_id = ? AND status = 'vantar' AND kalla = 'apparat'").get(atk.patientId).n + a.bilder > MAX_IMPORT_VANTANDE) {
    throw new Fel(409, 'Det finns redan bilder från apparater som väntar på granskning. Granska dem först.', 'tak');
  }
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const stalle = textFalt(body.kroppsstalle, 60) || db.query("SELECT kroppsstalle FROM media WHERE patient_id = ? AND status = 'journal' AND kroppsstalle IS NOT NULL ORDER BY tagen DESC").get(atk.patientId)?.kroppsstalle || null;
  const fro = db.query('SELECT count(*) AS n FROM media').get().n + 1;
  const ut = [];
  for (let i = 1; i <= a.bilder; i++) {
    const buf = simuleradBild(fro * 10 + i, a.modalitet, i);
    const m = bilder.spara(db, { patientId: atk.patientId, enhetId: atk.personal.enhet_id, kategori: kategoriFor(atk.personal), fil: { namn: `${apparatId}-${i}.png`, typ: 'image/png', buf },
      kalla: 'apparat', kallaRef: a.serienummer, kroppsstalle: stalle, beskrivning: `${a.beskrivning}, bild ${i} av ${a.bilder}`, tagen: iso(nu.getTime() - (a.bilder - i) * MIN), nu, av: atk.personal.id,
      status: 'vantar', apparat: { id: apparatId, namn: a.namn, modell: a.modell, serienummer: a.serienummer, patientPnr: pnr ?? p.personnummer } });
    ut.push(bilder.mediaUt(db, m));
  }
  return { bilder: ut, text: `${ut.length === 1 ? 'En bild' : `${ut.length} bilder`} från ${a.namn}. Granska och för in i journalen.`, simulerat: DEMO_APPARAT };
}

// Granskningen av en import före journalen. En bild från Min journal granskas som förut (bilder.granska). En bild från en
// apparat eller en annan vårdgivare granskas på vårdenheten som tog emot den, och en bild som enligt apparaten gäller en
// annan patient kan bara avvisas.
export function granska(atk, m, body = {}, nu = new Date()) {
  const db = atk.db;
  if (m.kalla === 'min_journal' || !['apparat', 'annan_vardgivare'].includes(m.kalla)) return bilder.granska(atk, m, body, nu);
  // Säkerhetsgranskningen av runda 11: skrivrätten som hör till bildens kategori, inte den inloggades bästa skrivrätt.
  andraRad(atk, m, m.kategori === 'journal' ? 'skriv_journal' : 'skriv_omvardnad', bilder.lasHandlingFor(m), 'Bilden granskas av den vårdenhet som tog emot den.');
  if (m.status !== 'vantar') throw new Fel(409, 'Bilden är redan granskad.', 'ogiltig');
  const godkann = body.godkann !== false;
  if (godkann && !identitetFor(db, m, db.query('SELECT personnummer FROM patienter WHERE id = ?').get(m.patient_id)).stammer) {
    throw new Fel(409, 'Apparaten anger en annan patient än den här. Bilden kan inte föras in i journalen. Avvisa den och kontrollera apparatens arbetslista.', 'ogiltig');
  }
  const stalle = textFalt(body.kroppsstalle, 60).toLocaleLowerCase('sv').replace(/\s+/g, ' ') || null;
  db.query('UPDATE media SET status = ?, granskad_tid = ?, granskad_av = ?, vardkontakt_id = ?, kroppsstalle = coalesce(?, kroppsstalle) WHERE id = ?')
    .run(godkann ? 'journal' : 'avvisad', iso(nu), atk.personal.id, godkann ? vardkontaktFor(atk, nu) : null, stalle, m.id);
  return bilder.mediaUt(db, bilder.mediaRad(db, m.id));
}

// ---- Import från en annan vårdgivare (simulerad) -------------------------------------------------------------------

// Bilderna hos den simulerade vårdgivaren (sammanhallen.js). Id och personer är påhittade.
const EXTERNA = {
  p01: [
    { id: 'hh-bild-1', tagen: '2026-03-04T13:20:00.000Z', vardenhet: 'Hälsohuset ortopedmottagning (simulerad)', av: 'Demofysioterapeut Hälsohuset', kroppsstalle: 'höger knä', beskrivning: 'Foto av höger knä efter fall i hemmet', modalitet: 'XC' },
    { id: 'hh-bild-2', tagen: '2026-03-05T09:10:00.000Z', vardenhet: 'Hälsohuset ortopedmottagning (simulerad)', av: 'Demoläkare Hälsohuset', kroppsstalle: 'höger knä', beskrivning: 'Röntgen av höger knä, ingen fraktur', modalitet: 'DX' },
  ],
};
const externRef = (x) => `${sammanhallen.VARDGIVARE.hsaId}:${x.id}`;

// Säkerhetsgranskningen av runda 11: bilderna hos den andra vårdgivaren går genom samma kontroll som sammanhållen
// journalföring i övrigt (sammanhallen.js): ett aktivt val med syfte, bundet till sessionen, patienten, personen och
// vårdenheten, som gäller på ett samtycke eller vid nödåtkomst. Varje visning och hämtning loggas med grund och syfte.
const loggaExtern = (atk, val) => atk.logga('las_journal', val.grund, `media:extern:${sammanhallen.VARDGIVARE.hsaId}`, 'tillaten', val.syfte);

// Läget: bilderna hos den andra vårdgivaren visas bara när det aktiva valet gäller.
export function externLage(atk, sess) {
  const db = atk.db;
  sammanhallen.sakra(db);
  bilder.sakra(db);
  atk.krav('las_journal');
  const samtycke = sammanhallen.harSamtycke(db, atk.personal, atk.patientId);
  const val = sammanhallen.giltigtVal(atk, sess);
  const poster = val ? (EXTERNA[atk.patientId] ?? []).map(x => ({ id: x.id, tagen: x.tagen, vardenhet: x.vardenhet, av: x.av, kroppsstalle: x.kroppsstalle, beskrivning: x.beskrivning,
    hamtad: Boolean(db.query('SELECT 1 FROM media WHERE patient_id = ? AND kalla = ? AND kalla_ref = ?').get(atk.patientId, 'annan_vardgivare', externRef(x))) })) : [];
  if (val) loggaExtern(atk, val);
  else atk.loggad = true;
  return { vardgivare: sammanhallen.VARDGIVARE.namn, samtycke, aktivtVal: Boolean(val), bilder: poster, simulerat: DEMO_EXTERN,
    text: val ? (poster.length ? `${poster.length} bilder hos ${sammanhallen.VARDGIVARE.namn}.` : `Inga bilder hos ${sammanhallen.VARDGIVARE.namn}.`)
      : samtycke ? 'Patienten har samtyckt. Ange syftet för att hämta bilderna från den andra vårdgivaren.' : 'Patienten kan ha bilder hos en annan vårdgivare. Bilderna hämtas bara om patienten samtycker.' };
}

// Hämtar bilderna som inte redan är hämtade. Utan ett aktivt val görs valet här med sammanhallen.hamta ({ syfte, samtycke? }),
// med samma krav på syfte och samtycke. Bilderna hör till journalens kategori och hämtas av den som skriver i journalen.
// De väntar på granskning och behåller sitt ursprung.
export function hamtaExtern(atk, sess, body = {}, nu = new Date()) {
  const db = atk.db;
  sammanhallen.sakra(db);
  bilder.sakra(db);
  atk.krav('las_journal');
  atk.krav('skriv_journal');
  let val = sammanhallen.giltigtVal(atk, sess);
  if (!val) {
    sammanhallen.hamta(atk, sess, { syfte: body.syfte, samtycke: body.samtycke === true });
    val = sammanhallen.giltigtVal(atk, sess);
    if (!val) throw new Fel(400, 'Bilderna från den andra vårdgivaren kunde inte hämtas. Gör ett aktivt val med syfte först.', 'ogiltig', { falt: ['syfte'] });
  }
  const ut = [];
  for (const [i, x] of (EXTERNA[atk.patientId] ?? []).entries()) {
    if (db.query('SELECT 1 FROM media WHERE patient_id = ? AND kalla = ? AND kalla_ref = ?').get(atk.patientId, 'annan_vardgivare', externRef(x))) continue;
    const buf = x.modalitet === 'DX'
      ? arkiv.rendera(arkiv.pixlar({ id: 900 + i, undersokning: 'hoftled' }, { modalitet: 'DX', bilder: 3 }, 3), { center: 2800, bredd: 2000 })
      : simuleradBild(900 + i, 'XC', 1);
    const m = bilder.spara(db, { patientId: atk.patientId, enhetId: atk.personal.enhet_id, kategori: 'journal', fil: { namn: `${x.id}.png`, typ: 'image/png', buf }, kalla: 'annan_vardgivare',
      kallaRef: externRef(x), kroppsstalle: x.kroppsstalle, beskrivning: x.beskrivning, tagen: x.tagen, nu, av: null, status: 'vantar',
      ursprung: { vardgivare: sammanhallen.VARDGIVARE.namn, hsaId: sammanhallen.VARDGIVARE.hsaId, vardenhet: x.vardenhet, skapadAv: x.av, begardAv: atk.personal.id } });
    ut.push(bilder.mediaUt(db, m));
  }
  loggaExtern(atk, val);
  atk.loggad = true;
  return { bilder: ut, text: ut.length ? `${ut.length === 1 ? 'En bild' : `${ut.length} bilder`} från ${sammanhallen.VARDGIVARE.namn}. Granska och för in i journalen.` : 'Inga nya bilder att hämta.', simulerat: DEMO_EXTERN };
}

// ---- DICOMweb mot det simulerade arkivet ---------------------------------------------------------------------------

export const DICOMWEB = '/api/dicomweb';
const DICOMJSON = { 'Content-Type': 'application/dicom+json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const svarJson = (v) => new Response(JSON.stringify(v), { headers: DICOMJSON });
const patientFor = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);

// Studien med ett uid i arkivet. Bara besvarade studier finns i arkivet.
export function studieForUid(db, uid) {
  bilder.sakra(db);
  bilder.forfallna(db, new Date());
  const s = typeof uid === 'string' && /^[0-9.]{1,64}$/.test(uid) ? db.query("SELECT * FROM media_studier WHERE uid = ? AND status = 'besvarad'").get(uid) : null;
  if (!s) throw new Fel(404, 'Studien finns inte i arkivet.', 'saknas');
  return s;
}
// Patienten för en sökning på PatientID (personnummer med eller utan bindestreck).
export function patientForPid(db, pid) {
  const pnr = typeof pid === 'string' ? pid.replace(/[-\s]/g, '') : '';
  return /^\d{12}$/.test(pnr) ? db.query('SELECT id FROM patienter WHERE personnummer = ?').get(pnr)?.id ?? null : null;
}
const datumIntervall = (v) => {
  if (!v) return null;
  const m = /^(\d{8})?-?(\d{8})?$/.exec(v);
  if (!m || (!m[1] && !m[2])) throw new Fel(400, 'StudyDate anges som ÅÅÅÅMMDD eller ett intervall ÅÅÅÅMMDD-ÅÅÅÅMMDD.', 'ogiltig');
  return v.includes('-') ? [m[1] ?? '00000000', m[2] ?? '99999999'] : [m[1], m[1]];
};

// QIDO-RS: patientens studier som användaren får se, filtrerade på uid, modalitet och datum. En patient som användaren
// inte får se ger en tom lista, precis som en patient som inte finns.
export function qidoStudier(atk, fraga = {}) {
  const db = atk.db;
  bilder.sakra(db);
  bilder.forfallna(db, new Date());
  // Säkerhetsgranskningen av runda 11: ett nekat försök loggas av krav som nekat, och svaret är en tom lista, som för en
  // patient som inte finns.
  try { atk.krav('las_journal', { beskrivning: 'dicomweb:studies' }); } catch (e) { if (e.status === 403) { atk.loggad = true; return svarJson([]); } throw e; }
  const datum = datumIntervall(fraga.StudyDate);
  const p = patientFor(db, atk.patientId);
  const visad = Boolean(atk.val?.visa_identitet);
  const rader = atk.filtrera(db.query("SELECT * FROM media_studier WHERE patient_id = ? AND status = 'besvarad' ORDER BY utford DESC").all(atk.patientId), 'las_journal')
    .filter(s => !fraga.StudyInstanceUID || s.uid === fraga.StudyInstanceUID)
    .filter(s => !fraga.ModalitiesInStudy || bilder.UNDERSOKNINGAR[s.undersokning].modalitet === fraga.ModalitiesInStudy)
    .map(s => [s, arkiv.studieJson(s, bilder.UNDERSOKNINGAR[s.undersokning], p, visad, DICOMWEB)])
    .filter(([, j]) => !datum || (j['00080020'].Value?.[0] >= datum[0] && j['00080020'].Value?.[0] <= datum[1]));
  atk.logga('las_journal', atk.grund(), `dicomweb:studies:${rader.map(([s]) => s.id).join(',')}`);
  return svarJson(rader.map(([, j]) => j));
}

// Studiens serier, instanser, metadata, DICOM-filer och renderade bilder. Prövas som journalen och loggas när det som
// begärs finns i studien.
function provaStudie(atk, s) {
  lasRad(atk, s, 'las_journal');
  const u = bilder.UNDERSOKNINGAR[s.undersokning];
  return { u, st: arkiv.struktur(s, u), p: patientFor(atk.db, s.patient_id), visad: Boolean(atk.val?.visa_identitet) };
}
const loggaStudie = (atk, s, del) => atk.logga('las_journal', atk.grund(), `dicomweb:${s.uid}:${del}`);
export function serier(atk, s) {
  const { u, st } = provaStudie(atk, s);
  loggaStudie(atk, s, 'series');
  return svarJson(st.serier.map(se => arkiv.serieJson(s, u, se, DICOMWEB)));
}
export function instanser(atk, s, serieUid) {
  const { u, st } = provaStudie(atk, s);
  const se = st.serier.find(x => x.uid === serieUid);
  if (!se) throw new Fel(404, 'Serien finns inte i studien.', 'saknas');
  loggaStudie(atk, s, 'instances');
  return svarJson(se.instanser.map(i => arkiv.instansJson(s, u, se, i, DICOMWEB)));
}
export function metadata(atk, s) {
  const { u, p, visad } = provaStudie(atk, s);
  loggaStudie(atk, s, 'metadata');
  return svarJson(arkiv.metadataJson(s, u, p, visad, DICOMWEB));
}
export function hamtaInstans(atk, s, serieUid, instansUid) {
  const { u, st, p, visad } = provaStudie(atk, s);
  const { serie, instans } = arkiv.instansFor(st, serieUid, instansUid);
  loggaStudie(atk, s, instans.uid);
  const mp = arkiv.multipart([arkiv.p10(s, u, p, visad, serie, instans)]);
  return new Response(mp.kropp, { headers: { 'Content-Type': mp.typ, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function renderad(atk, s, serieUid, instansUid, { fonster = null, miniatyr = false } = {}) {
  const { u, st } = provaStudie(atk, s);
  const { instans } = arkiv.instansFor(st, serieUid, instansUid);
  const f = arkiv.lasFonster(fonster);
  loggaStudie(atk, s, `${instans.uid}:${miniatyr ? 'thumbnail' : 'rendered'}`);
  const forval = st.fonster.find(x => x.namn === st.forvaltFonster);
  const png = arkiv.rendera(arkiv.pixlar(s, u, instans.nummer), f.center != null ? f : forval ? { center: forval.center, bredd: forval.bredd } : {});
  return new Response(png, { headers: bilder.huvuden('image/png', `${instans.uid}.png`) });
}

// ---- FHIR Media och ImagingStudy -----------------------------------------------------------------------------------

export const FHIR_TYPER = ['Media', 'ImagingStudy'];
const MEDIATYP = { bild: 'image', video: 'video', ljud: 'audio' };
const ref = (typ, id, display) => ({ reference: `${typ}/${id}`, ...(display ? { display } : {}) });

export function mediaFhir(db, m, base) {
  const e = bilder.egenskaperRad(db, m.id);
  const ut = bilder.mediaUt(db, m);
  return {
    resourceType: 'Media', id: String(m.id), status: 'completed',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/media-type', code: MEDIATYP[ut.slag] }] },
    subject: ref('Patient', m.patient_id), ...(m.vardkontakt_id ? { encounter: ref('Encounter', m.vardkontakt_id) } : {}),
    createdDateTime: m.tagen, issued: m.registrerad, ...(m.registrerad_av ? { operator: ref('Practitioner', m.registrerad_av, personNamn(db, m.registrerad_av)) } : {}),
    ...(m.kroppsstalle ? { bodySite: { text: m.kroppsstalle } } : {}), ...(ut.apparat ? { deviceName: `${ut.apparat.namn}, ${ut.apparat.serienummer}` } : {}),
    ...(e?.hojd ? { height: e.hojd } : {}), ...(e?.bredd ? { width: e.bredd } : {}), ...(e?.langd_sek ? { duration: e.langd_sek } : {}),
    content: { contentType: m.typ, url: `${base}/api/media/${m.id}/fil`, size: m.storlek, hash: createHash('sha1').update(Buffer.from(m.data)).digest('base64'), title: m.namn, creation: m.tagen },
    note: [{ text: `Källa: ${ut.kalla.text}.${ut.ursprung ? ` ${ut.ursprung.vardenhet}, ${ut.ursprung.vardgivare}.` : ''}${m.beskrivning ? ` ${m.beskrivning}` : ''}` }],
  };
}

export function imagingStudyFhir(db, s, base) {
  const u = bilder.UNDERSOKNINGAR[s.undersokning];
  const besvarad = s.status === 'besvarad';
  const st = besvarad ? arkiv.struktur(s, u) : null;
  return {
    resourceType: 'ImagingStudy', id: String(s.id),
    ...(besvarad ? { contained: [{ resourceType: 'Endpoint', id: 'dicomweb', status: 'active', connectionType: { system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type', code: 'dicom-wado-rs' },
      name: `${bilder.ARKIV[s.arkiv].namn}, DICOMweb`, payloadType: [{ text: 'DICOM' }], address: `${base}${DICOMWEB}` }] } : {}),
    ...(besvarad ? { identifier: [{ system: 'urn:dicom:uid', value: `urn:oid:${s.uid}` }] } : {}),
    status: besvarad ? 'available' : 'registered',
    modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: u.modalitet }],
    subject: ref('Patient', s.patient_id), ...(s.vardkontakt_id ? { encounter: ref('Encounter', s.vardkontakt_id) } : {}),
    ...(besvarad ? { started: s.utford } : {}), referrer: ref('Practitioner', s.bestalld_av, personNamn(db, s.bestalld_av)),
    ...(besvarad ? { endpoint: [{ reference: '#dicomweb' }], numberOfSeries: st.serier.length, numberOfInstances: st.serier.reduce((n, x) => n + x.antal, 0) } : {}),
    description: u.namn, reasonCode: [{ text: s.fragestallning }], ...(s.utlatande ? { note: [{ text: s.utlatande }] } : {}),
    ...(besvarad ? { series: st.serier.map(se => ({ uid: se.uid, number: se.nummer, modality: { system: 'http://dicom.nema.org/resources/ontology/DCM', code: u.modalitet }, description: se.beskrivning,
      numberOfInstances: se.antal, endpoint: [{ reference: '#dicomweb' }], instance: se.instanser.map(i => ({ uid: i.uid, sopClass: { system: 'urn:ietf:rfc:3986', code: `urn:oid:${st.mod.sop}` }, number: i.nummer })) })) } : {}),
  };
}

// Läsning och sökning med samma behörighet och loggning som fliken Bilder. Invånaren har inte resurserna.
export function fhirHantera(ctx, delar, bundle) {
  const { db, personal, url, base } = ctx;
  const [typ, id] = delar;
  if (!personal || delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  bilder.sakra(db);
  bilder.forfallna(db, new Date());
  const media = typ === 'Media';
  const handlingFor = (r) => (media ? bilder.lasHandlingFor(r) : 'las_journal');
  const finnsSom = (r) => (media ? r.status === 'journal' && Boolean(MEDIATYP[bilder.TYPER[r.typ]?.slag]) : true);
  const mappa = (r) => (media ? mediaFhir(db, r, base) : imagingStudyFhir(db, r, base));
  const tabellNamn = media ? 'media' : 'media_studier';
  if (id) {
    const r = /^\d{1,9}$/.test(id) ? db.query(`SELECT * FROM ${tabellNamn} WHERE id = ?`).get(Number(id)) : null;
    if (!r || !finnsSom(r)) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const atk = new Atkomst(db, personal, r.patient_id, ctx.valFor(r.patient_id), handlingFor(r));
    atk.krav(handlingFor(r), { resurs: { enhet_id: r.enhet_id }, beskrivning: `fhir/${typ}/${id}` });
    atk.logga(handlingFor(r), atk.grund(), `fhir/${typ}/${id}`);
    return { status: 200, body: mappa(r) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const las = media && !kanRoll(personal, 'las_journal') ? 'las_omvardnad' : 'las_journal';
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), las);
  atk.krav(las, { beskrivning: `fhir/${typ}${url.search}` });
  const rader = atk.filtrera(db.query(`SELECT * FROM ${tabellNamn} WHERE patient_id = ? ORDER BY id`).all(pid).filter(finnsSom), handlingFor);
  atk.logga(las, atk.grund(), `fhir/${typ}${url.search}`);
  return { status: 200, body: bundle(rader.map(mappa)) };
}

// ---- Demons bilder -------------------------------------------------------------------------------------------------

// Ett trycksår på korsbenet hos Gunnar Åkesson som läker under vårdtiden, fotograferat av sjuksköterskan, och en
// lungröntgen som läkaren har beställt. Läggs i demons mall (db.js mallen), inte i seeden som testerna bygger på.
export function demo(db, bas = new Date()) {
  bilder.sakra(db);
  if (!db.query("SELECT 1 FROM patienter WHERE id = 'p01'").get() || db.query("SELECT 1 FROM media WHERE patient_id = 'p01'").get()) return;
  const vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id = 'uso-kard-72' AND slut IS NULL").get()?.id ?? null;
  const foto = (storlek, rodnad) => {
    const d = new kodek.Duk(320, 240, [222, 184, 158]);
    for (let i = 0; i < d.px.length; i += 3) { const n = ((i * 2654435761) >>> 0) % 9 - 4; d.px[i] += n; d.px[i + 1] += n; d.px[i + 2] += n; }
    d.ellips(160, 120, 70 * storlek + 18, 52 * storlek + 14, [214, 140, 120], rodnad);
    d.ellips(160, 120, 60 * storlek, 44 * storlek, [150, 46, 44]);
    d.ellips(156, 116, 34 * storlek, 22 * storlek, [196, 120, 70], 0.8);
    for (let x = 20; x < 300; x += 8) d.fyll(x, 214, 1, (x - 20) % 40 === 0 ? 14 : 7, [40, 40, 40]);
    return d.png();
  };
  const bilderna = [[-3 * DAG + 4 * 3600_000, 1, 0.8, 'Trycksår kategori 2 på korsbenet vid inskrivningen.'], [-2 * DAG + 2 * 3600_000, 0.8, 0.6, 'Mindre rodnad, såret rengjort.'],
    [-2 * 3600_000, 0.55, 0.35, 'Såret läker, granulationsvävnad.']];
  for (const [i, [dt, storlek, rodnad, text]] of bilderna.entries()) {
    const t = iso(Math.min(bas.getTime() + dt, bas.getTime() - 3600_000));
    bilder.spara(db, { patientId: 'p01', enhetId: 'uso-kard-72', vardkontaktId: vk, kategori: 'omvardnad', fil: { namn: `trycksar-${i + 1}.png`, typ: 'image/png', buf: foto(storlek, rodnad) },
      kalla: 'kamera', kroppsstalle: 'korsbenet', beskrivning: text, tagen: t, nu: new Date(t), av: 'ssk-kard' });
  }
  const bestalld = iso(bas.getTime() - 3 * DAG + 5 * 3600_000);
  db.query("INSERT INTO media_studier (patient_id, enhet_id, vardkontakt_id, undersokning, arkiv, fragestallning, bestalld_av, bestalld, status) VALUES ('p01', 'uso-kard-72', ?, 'lungrontgen', 'rontgen', ?, 'lak-kard', ?, 'bestalld')")
    .run(vk, 'Hjärtsvikt? Pleuravätska?', bestalld);
  bilder.forfallna(db, bas);
}
