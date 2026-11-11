// Bilder och media i journalen (runda 9, r3, Sussa 4.2): bilder och dokument knutna till patient, vårdkontakt och
// anteckning, med visning, förstoring och jämförelse över tid, import från fil, mobilens kamera, patientens egen
// uppladdning i Min journal och remissbilagor, och referenser till studier i ett simulerat externt multimediaarkiv.
//
// Systemet är experten:
//   - Filtypen avgörs av systemet ur filens innehåll, och bilden knyts själv till den pågående vårdkontakten. Källan
//     märks på bilden (fil, kamera, Min journal, remissbilaga eller arkiv) utan att någon behöver ange den.
//   - Bilder av samma kroppsställe ställs bredvid varandra i tidsordning med antalet dagar mellan dem, för jämförelse.
//   - Patientens egen uppladdning hamnar hos vårdenheten för granskning och kommer in i journalen först när någon på
//     vårdenheten har godkänt den. Systemet föreslår vårdenheterna där patienten har kontakt.
//   - En undersökning i multimediaarkivet beställs med frågeställning, och svaret och bildlänken kommer tillbaka till
//     journalen. Bilderna visas genom arkivet med samma behörighet och loggning som andra uppgifter.
//   - Inre sekretess, spärr och loggning gäller som för journalanteckningar: en bild från en annan vårdenhet visas efter
//     ett aktivt val, och en spärrad syns inte alls.
//
// Multimediaarkiven och deras utlåtanden är simulerade.
import { createHash } from 'node:crypto';
import { Fel, datumAv, lokalTid } from './db.js';
import { vardenhetFor, enheterUnder, harVardrelation, kanRoll, visningsnamn } from './atkomst.js';
import { typFor, bilagaFil, bilagaRad, EGEN } from './remiss-r4.js';
import { OID_ROT } from './identitet.js';
import { tabell, finns, personNamn, enhetKort, textFalt, iso, MIN, vardkontaktFor, provaRad, loggaPatient, bunden, andraRad } from './specialist-hjalp.js';
// Runda 11, r5: typen och metadatan ur filens innehåll (bildkodek.js).
import { typUrInnehall, exifInfo, mp4Info, webmInfo, wavInfo } from './bildkodek.js';

// Runda 11, r5: taket per fil efter slaget. En fil som är större än ett anrop (64 kB) skickas i delar (bildmedia.js).
// Taket per patient och per sandlåda gäller som förut, och uppladdningar som inte är klara räknas med.
export const MAX_FIL = tabell({ bild: 1024 * 1024, video: 2 * 1024 * 1024, ljud: 1024 * 1024, dokument: 1024 * 1024 });
export const MAX_BYTE = MAX_FIL.bild;
export const MAX_PER_PATIENT = 40;
export const MAX_PER_SANDLADA = 4 * 1024 * 1024;
export const MAX_VANTANDE = 5;
const SLAGTEXT = { bild: 'En bild', video: 'En film', ljud: 'En ljudinspelning', dokument: 'Ett dokument' };
export const TYPER = tabell({
  'image/png': { ext: 'png', bild: true, slag: 'bild' }, 'image/jpeg': { ext: 'jpg', bild: true, slag: 'bild' }, 'application/pdf': { ext: 'pdf', bild: false, slag: 'dokument' },
  // Runda 11, r5: WebP, film och ljud.
  'image/webp': { ext: 'webp', bild: true, slag: 'bild' }, 'video/mp4': { ext: 'mp4', bild: false, slag: 'video' }, 'video/webm': { ext: 'webm', bild: false, slag: 'video' },
  'audio/mp4': { ext: 'm4a', bild: false, slag: 'ljud' }, 'audio/webm': { ext: 'weba', bild: false, slag: 'ljud' }, 'audio/ogg': { ext: 'ogg', bild: false, slag: 'ljud' },
  'audio/mpeg': { ext: 'mp3', bild: false, slag: 'ljud' }, 'audio/wav': { ext: 'wav', bild: false, slag: 'ljud' },
});
export const KALLOR = tabell({ fil: 'Fil från datorn', kamera: 'Mobilens kamera', min_journal: 'Patientens uppladdning i Min journal', remissbilaga: 'Bilaga till remiss', arkiv: 'Multimediaarkiv',
  // Runda 11, r5.
  mikrofon: 'Inspelning med mikrofonen', apparat: 'Medicinteknisk apparat', annan_vardgivare: 'Annan vårdgivare' });
// De simulerade multimediaarkiven och undersökningarna som kan beställas. svarMinuter är när arkivet svarar.
export const ARKIV = tabell({
  rontgen: { namn: 'Bild- och funktionsmedicin, bildarkivet (simulerat)', svarMinuter: 30 },
  hud: { namn: 'Hudmottagningens fotoarkiv (simulerat)', svarMinuter: 10 },
});
export const UNDERSOKNINGAR = tabell({
  lungrontgen: { namn: 'Lungröntgen', arkiv: 'rontgen', modalitet: 'DX', bilder: 2, utlatande: 'Simulerat utlåtande: Normalstora hjärtkonturer. Inga infiltrat eller pleuravätska.' },
  hoftled: { namn: 'Röntgen höftled', arkiv: 'rontgen', modalitet: 'DX', bilder: 3, utlatande: 'Simulerat utlåtande: Lätt minskad ledspringa. Ingen fraktur.' },
  dt_hjarna: { namn: 'Datortomografi av hjärnan', arkiv: 'rontgen', modalitet: 'CT', bilder: 120, utlatande: 'Simulerat utlåtande: Ingen blödning eller expansivitet. Normal ventrikelvidd.' },
  hudfoto: { namn: 'Dermatoskopi och översiktsfoto', arkiv: 'hud', modalitet: 'XC', bilder: 4, utlatande: 'Simulerat utlåtande: Regelbundet pigmentnät utan atypiska strukturer.' },
  // Runda 11, r6: undersökningarna som läkaren beställer i beställning och svar (labb-katalog.js, undersokningar.js).
  // Röntgenkliniken lägger studien i arkivet när undersökningen är gjord, och utlåtandet länkar till den med studiens id.
  rtg_kna: { namn: 'Röntgen knäled', arkiv: 'rontgen', modalitet: 'DX', bilder: 2, utlatande: 'Simulerat utlåtande: Normal ledspringa. Ingen fraktur eller ledvätska.' },
  dt_buk: { namn: 'DT buk med kontrast', arkiv: 'rontgen', modalitet: 'CT', bilder: 300, utlatande: 'Simulerat utlåtande: Inga tecken till tumör eller abscess. Normala parenkymatösa organ.' },
  dt_torax: { namn: 'DT torax med kontrast', arkiv: 'rontgen', modalitet: 'CT', bilder: 250, utlatande: 'Simulerat utlåtande: Rundhärd 18 mm i höger överlob, förenlig med tumör. Inga förstorade lymfkörtlar.' },
  mr_hjarna: { namn: 'MR hjärna', arkiv: 'rontgen', modalitet: 'MR', bilder: 180, utlatande: 'Simulerat utlåtande: Inga vitsubstansförändringar. Ingen expansivitet.' },
  mr_kna: { namn: 'MR knäled', arkiv: 'rontgen', modalitet: 'MR', bilder: 160, utlatande: 'Simulerat utlåtande: Ingen menisk- eller korsbandsskada.' },
  ul_buk: { namn: 'Ultraljud buk', arkiv: 'rontgen', modalitet: 'US', bilder: 12, utlatande: 'Simulerat utlåtande: Gallblåsa utan konkrement. Normal lever och mjälte.' },
  ul_njurar: { namn: 'Ultraljud njurar', arkiv: 'rontgen', modalitet: 'US', bilder: 8, utlatande: 'Simulerat utlåtande: Normalstora njurar utan avflödeshinder.' },
});

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, anteckning_id INTEGER, kategori TEXT NOT NULL,
  typ TEXT NOT NULL, namn TEXT NOT NULL, storlek INTEGER NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL, kalla TEXT NOT NULL, kalla_ref TEXT,
  kroppsstalle TEXT, beskrivning TEXT, tagen TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT, invanare_id TEXT, status TEXT NOT NULL,
  granskad_tid TEXT, granskad_av TEXT
);
CREATE INDEX IF NOT EXISTS ix_media_patient ON media (patient_id);
CREATE TRIGGER IF NOT EXISTS media_andras_ej BEFORE UPDATE OF data, sha256, typ, kalla ON media BEGIN SELECT RAISE(ABORT, 'En bild ändras inte.'); END;
-- Runda 11, r5: det systemet har läst ur filen, apparaten som tog bilden och ursprunget hos en annan vårdgivare.
CREATE TABLE IF NOT EXISTS media_egenskaper (
  media_id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, slag TEXT NOT NULL, bredd INTEGER, hojd INTEGER, langd_sek REAL, langd_kalla TEXT,
  exif_tagen TEXT, kamera TEXT, plats INTEGER NOT NULL DEFAULT 0, apparat TEXT, ursprung TEXT
);
-- Miniatyrer och visningsbilder som servern har gjort. Originalet i media ändras aldrig.
CREATE TABLE IF NOT EXISTS media_visning (
  media_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, storlek TEXT NOT NULL, typ TEXT NOT NULL, data BLOB NOT NULL, bredd INTEGER, hojd INTEGER,
  PRIMARY KEY (media_id, storlek)
);
-- Annoteringar är ett eget lager på bilden. En annotering ändras inte; den som gjorde den kan ta bort den, och raden finns kvar.
CREATE TABLE IF NOT EXISTS media_annoteringar (
  id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, punkter TEXT NOT NULL, text TEXT,
  skapad TEXT NOT NULL, skapad_av TEXT NOT NULL, borttagen TEXT, borttagen_av TEXT
);
CREATE TRIGGER IF NOT EXISTS media_annotering_andras_ej BEFORE UPDATE OF media_id, typ, punkter, text, skapad, skapad_av ON media_annoteringar
  BEGIN SELECT RAISE(ABORT, 'En annotering ändras inte.'); END;
-- Uppladdningar i delar som inte är klara. De töms när filen är sparad, avbruten eller har gått ut.
CREATE TABLE IF NOT EXISTS media_uppladdningar (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, personal_id TEXT NOT NULL, namn TEXT NOT NULL, storlek INTEGER NOT NULL, delar INTEGER NOT NULL,
  sha256 TEXT, meta TEXT NOT NULL, skapad TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media_uppladdning_delar (
  uppladdning_id TEXT NOT NULL, patient_id TEXT NOT NULL, nr INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (uppladdning_id, nr)
);
CREATE TABLE IF NOT EXISTS media_studier (
  id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, vardkontakt_id INTEGER, undersokning TEXT NOT NULL, arkiv TEXT NOT NULL,
  fragestallning TEXT NOT NULL, bestalld_av TEXT NOT NULL, bestalld TEXT NOT NULL, utford TEXT, uid TEXT, utlatande TEXT, status TEXT NOT NULL
);
`;
const har = new WeakSet();
export function sakra(db) { if (!har.has(db)) { db.exec(SCHEMA); har.add(db); } }

export function mediaRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM media WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Bilden finns inte.', 'saknas');
  return r;
}
export function studieRad(db, id) {
  sakra(db);
  const r = db.query('SELECT * FROM media_studier WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Undersökningen finns inte.', 'saknas');
  return r;
}
const handlingFor = (m) => (m.kategori === 'omvardnad' ? 'las_omvardnad' : 'las_journal');
const normaliseraStalle = (s) => textFalt(s, 60).toLocaleLowerCase('sv').replace(/\s+/g, ' ');

// Läser en fil ur anropet: { namn, data } med data i base64. Typen avgörs ur innehållet.
export const filnamn = (v) => (typeof v === 'string' ? v.replace(/[\\/\x00-\x1f]/g, '').trim().slice(0, 100) : '');
export function tolkaMedia(inp) {
  const namn = filnamn(inp?.namn);
  if (!namn) throw new Fel(400, 'Filen behöver ett namn.', 'ogiltig', { falt: ['namn'] });
  if (typeof inp?.data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(inp.data)) throw new Fel(400, 'Filen kunde inte läsas.', 'ogiltig', { falt: ['data'] });
  return tolkaBuffer(namn, Buffer.from(inp.data, 'base64'));
}
// Runda 11, r5: typen och slaget ur innehållet (bildkodek.js), och taket efter slaget.
export function tolkaBuffer(namn, buf) {
  if (!buf.length) throw new Fel(400, 'Filen är tom.', 'ogiltig', { falt: ['data'] });
  const typ = typUrInnehall(buf)?.typ ?? typFor(buf);
  if (!finns(TYPER, typ)) throw new Fel(400, 'Filtypen stöds inte. Ladda upp en bild (PNG, JPEG eller WebP), en film (MP4 eller WebM), ett ljud (MP3, M4A, WAV, Ogg eller WebM) eller en PDF. Systemet avgör typen ur filens innehåll.', 'ogiltig', { falt: ['data'] });
  const slag = TYPER[typ].slag;
  if (buf.length > MAX_FIL[slag]) throw new Fel(400, `Filen är för stor. ${SLAGTEXT[slag]} får vara högst ${Math.round(MAX_FIL[slag] / 1024 / 1024)} MB i demon.`, 'ogiltig', { falt: ['data'] });
  return { namn, typ, buf };
}

// Runda 11, r5: det systemet läser ur filen själv: bildens tid och kamera ur EXIF, filmens och ljudets längd och storlek.
export function egenskaperUr(fil) {
  const ut = { slag: TYPER[fil.typ].slag, bredd: null, hojd: null, langdSek: null, exifTagen: null, kamera: null, plats: false };
  if (fil.typ === 'image/jpeg') { const e = exifInfo(fil.buf); Object.assign(ut, { exifTagen: e.tagen, kamera: e.kamera, plats: e.plats }); }
  if (fil.typ === 'image/png' && fil.buf.length >= 24) Object.assign(ut, { bredd: fil.buf.readUInt32BE(16), hojd: fil.buf.readUInt32BE(20) });
  const info = fil.typ.endsWith('/mp4') ? mp4Info(fil.buf) : fil.typ.endsWith('/webm') ? webmInfo(fil.buf) : fil.typ === 'audio/wav' ? wavInfo(fil.buf) : null;
  if (info) Object.assign(ut, { langdSek: info.langdSek ?? null, bredd: info.bredd ?? null, hojd: info.hojd ?? null });
  return ut;
}

export function takFor(db, patientId, storlek, { uppladdning = null } = {}) {
  sakra(db);
  // Runda 11, r5: uppladdningar som inte är klara räknas med, så att taken inte kan kringgås med många samtidiga.
  const vantande = db.query('SELECT count(*) AS n FROM media_uppladdningar WHERE patient_id = ? AND id IS NOT ?').get(patientId, uppladdning).n;
  if (db.query("SELECT count(*) AS n FROM media WHERE patient_id = ? AND status <> 'avvisad'").get(patientId).n + vantande >= MAX_PER_PATIENT) throw new Fel(409, `Patienten har redan ${MAX_PER_PATIENT} bilder i demon.`, 'tak');
  const upptaget = db.query('SELECT coalesce(sum(storlek), 0) AS s FROM media').get().s + db.query('SELECT coalesce(sum(storlek), 0) AS s FROM media_uppladdningar WHERE id IS NOT ?').get(uppladdning).s;
  if (upptaget + storlek > MAX_PER_SANDLADA) throw new Fel(409, 'Sandlådan har inte plats för fler bilder. Börja om med en ny sandlåda.', 'tak');
}

export function spara(db, { patientId, enhetId, vardkontaktId = null, anteckningId = null, kategori, fil, kalla, kallaRef = null, kroppsstalle = null, beskrivning = null, tagen, nu, av = null, invanare = null, status = 'journal',
  apparat = null, ursprung = null, langdSek = null, uppladdning = null }) {
  takFor(db, patientId, fil.buf.length, { uppladdning });
  const r = db.query(`INSERT INTO media (patient_id, enhet_id, vardkontakt_id, anteckning_id, kategori, typ, namn, storlek, sha256, data, kalla, kalla_ref, kroppsstalle, beskrivning,
      tagen, registrerad, registrerad_av, invanare_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(patientId, enhetId, vardkontaktId, anteckningId, kategori, fil.typ, fil.namn, fil.buf.length, createHash('sha256').update(fil.buf).digest('hex'), fil.buf, kalla, kallaRef,
      kroppsstalle ? normaliseraStalle(kroppsstalle) : null, textFalt(beskrivning, 300) || null, tagen, iso(nu), av, invanare, status);
  // Runda 11, r5: det systemet läser ur filen. En längd som filen saknar (en inspelning i webbläsaren) mäts vid inspelningen.
  const e = egenskaperUr(fil);
  const langd = e.langdSek ?? (Number.isFinite(langdSek) && langdSek > 0 && langdSek <= 3600 ? Math.round(langdSek * 10) / 10 : null);
  db.query(`INSERT INTO media_egenskaper (media_id, patient_id, enhet_id, slag, bredd, hojd, langd_sek, langd_kalla, exif_tagen, kamera, plats, apparat, ursprung)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.lastInsertRowid, patientId, enhetId, e.slag, e.bredd, e.hojd, langd, langd == null ? null : e.langdSek != null ? 'fil' : 'inspelning',
    e.exifTagen, e.kamera, e.plats ? 1 : 0, apparat ? JSON.stringify(apparat) : null, ursprung ? JSON.stringify(ursprung) : null);
  return mediaRad(db, r.lastInsertRowid);
}

// Runda 11, r5: tiden ur EXIF är svensk lokaltid utan zon. Den används när ingen tid anges och den inte ligger i framtiden.
export function tagenUrExif(exifTagen, nu) {
  if (!exifTagen) return null;
  const ms = Date.parse(lokalTid(exifTagen.slice(0, 10), exifTagen.slice(11, 16))) + Number(exifTagen.slice(17, 19) || 0) * 1000;
  return Number.isFinite(ms) && ms <= nu.getTime() + 5 * MIN && ms > Date.parse('1990-01-01T00:00:00Z') ? iso(ms) : null;
}
export const egenskaperRad = (db, id) => db.query('SELECT * FROM media_egenskaper WHERE media_id = ?').get(id) ?? null;
const lasJson = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export const tagenFor = (v, nu) => {
  if (v == null || v === '') return iso(nu);
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || ms > nu.getTime() + 5 * MIN) throw new Fel(400, 'Tiden när bilden togs är inte en giltig tidpunkt.', 'ogiltig', { falt: ['tagen'] });
  return iso(ms);
};

export function mediaUt(db, m) {
  // Runda 11, r5: slaget, det systemet har läst ur filen, apparaten, ursprunget och adresserna för miniatyr och visning.
  const e = egenskaperRad(db, m.id);
  const ursprung = lasJson(e?.ursprung);
  const apparat = lasJson(e?.apparat);
  return {
    id: m.id, namn: m.namn, typ: m.typ, bild: Boolean(TYPER[m.typ]?.bild), storlek: m.storlek, sha256: m.sha256, kalla: { id: m.kalla, text: KALLOR[m.kalla] }, kroppsstalle: m.kroppsstalle,
    beskrivning: m.beskrivning, tagen: m.tagen,
    registrerad: { tid: m.registrerad, av: m.registrerad_av ? personNamn(db, m.registrerad_av) : m.invanare_id ? 'Patienten via Min journal' : ursprung ? `${ursprung.skapadAv}, ${ursprung.vardenhet}` : null },
    vardenhet: enhetKort(db, m.enhet_id), vardkontaktId: m.vardkontakt_id, anteckningId: m.anteckning_id, url: `/api/media/${m.id}/fil`, status: m.status,
    slag: TYPER[m.typ]?.slag ?? 'dokument', miniatyr: `/api/media/${m.id}/miniatyr`, visning: TYPER[m.typ]?.bild ? `/api/media/${m.id}/visning` : `/api/media/${m.id}/fil`,
    egenskaper: e ? { bredd: e.bredd, hojd: e.hojd, langdSek: e.langd_sek, langdKalla: e.langd_kalla, kamera: e.kamera, exifTagen: e.exif_tagen, plats: Boolean(e.plats) } : null,
    apparat: apparat ? { namn: apparat.namn, serienummer: apparat.serienummer } : null,
    ursprung: ursprung ? { vardgivare: ursprung.vardgivare, vardenhet: ursprung.vardenhet, skapadAv: ursprung.skapadAv, simulerad: true } : null,
    granskad: m.granskad_tid ? { tid: m.granskad_tid, av: personNamn(db, m.granskad_av) } : null,
  };
}
export function studieUt(db, s, nu = new Date()) {
  return {
    id: s.id, undersokning: UNDERSOKNINGAR[s.undersokning].namn, modalitet: UNDERSOKNINGAR[s.undersokning].modalitet, arkiv: ARKIV[s.arkiv].namn, fragestallning: s.fragestallning,
    bestalld: { tid: s.bestalld, av: personNamn(db, s.bestalld_av) }, status: s.status, utford: s.utford, uid: s.uid, utlatande: s.utlatande,
    antalBilder: s.status === 'besvarad' ? UNDERSOKNINGAR[s.undersokning].bilder : 0, bildlank: s.status === 'besvarad' ? `/api/media/studie/${s.id}/visa` : null,
    vardenhet: enhetKort(db, s.enhet_id), simulerat: true,
  };
}

// ---- Uppladdning och import av personalen -----------------------------------------------------------------------------

// En bild från datorn eller mobilens kamera, knuten till den pågående vårdkontakten och eventuellt till en anteckning.
// Läkaren dokumenterar i journalkategorin och övrig vårdpersonal i omvårdnadskategorin, som för anteckningar.
export function ladda(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  const kategori = kanRoll(atk.personal, 'skriv_journal') ? 'journal' : 'omvardnad';
  atk.krav(kategori === 'journal' ? 'skriv_journal' : 'skriv_omvardnad');
  return laddaFil(atk, kategori, tolkaMedia(body.bild), body, nu);
}

// Runda 11, r5: samma registrering för en fil som har kommit i ett anrop och en som har skickats i delar (bildmedia.js).
// Tiden när bilden togs läses ur EXIF när ingen tid anges.
export function laddaFil(atk, kategori, fil, body = {}, nu = new Date(), { uppladdning = null } = {}) {
  const db = atk.db;
  const kalla = body.kalla ?? 'fil';
  if (!['fil', 'kamera', 'mikrofon'].includes(kalla)) throw new Fel(400, 'Källan är fil eller kamera.', 'ogiltig', { falt: ['kalla'] });
  const exifTid = body.tagen == null || body.tagen === '' ? tagenUrExif(egenskaperUr(fil).exifTagen, nu) : null;
  let anteckningId = null;
  if (body.anteckningId != null) {
    const a = db.query('SELECT * FROM anteckningar WHERE id = ? AND patient_id = ?').get(Number(body.anteckningId), atk.patientId);
    if (!a || vardenhetFor(db, a.enhet_id) !== vardenhetFor(db, atk.personal.enhet_id)) throw new Fel(400, 'Bilden kan knytas till en anteckning för patienten på din vårdenhet.', 'ogiltig', { falt: ['anteckningId'] });
    anteckningId = a.id;
  }
  const m = spara(db, { patientId: atk.patientId, enhetId: atk.personal.enhet_id, vardkontaktId: vardkontaktFor(atk, nu), anteckningId, kategori, fil, kalla,
    kroppsstalle: body.kroppsstalle, beskrivning: body.beskrivning, tagen: exifTid ?? tagenFor(body.tagen, nu), nu, av: atk.personal.id, langdSek: Number(body.langdSek), uppladdning });
  return mediaUt(db, m);
}

// En bilaga till en remiss som den inloggade får läsa förs in i journalen. Källan märks med remissens bilaga.
export function franRemissbilaga(atk, bilagaId, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  const kategori = kanRoll(atk.personal, 'skriv_journal') ? 'journal' : 'omvardnad';
  atk.krav(kategori === 'journal' ? 'skriv_journal' : 'skriv_omvardnad');
  const b = bilagaRad(db, bilagaId);
  if (b.patient_id !== atk.patientId || !b.remiss_id) throw new Fel(404, 'Bilagan finns inte.', 'saknas');
  bilagaFil(atk, b);
  if (!finns(TYPER, b.typ)) throw new Fel(400, 'Bara bilder och PDF förs in i journalen. Textbilagor finns kvar i remissen.', 'ogiltig');
  if (db.query("SELECT 1 FROM media WHERE kalla = 'remissbilaga' AND kalla_ref = ? AND patient_id = ?").get(String(b.id), atk.patientId)) throw new Fel(409, 'Bilagan finns redan i journalen.', 'ogiltig');
  // Säkerhetsgranskningen: bilden behåller avsändarens vårdenhet, så att inre sekretess och en spärr mot avsändaren gäller
  // också i journalen. En bilaga som patienten själv har skickat (egen vårdbegäran eller komplettering från Min journal)
  // hör till den mottagande vårdenheten och kommer in i journalen först efter granskning, som en bild från Min journal.
  const r = db.query('SELECT fran_enhet_id, till_enhet_id FROM remisser WHERE id = ?').get(b.remiss_id);
  const franPatienten = Boolean(b.skapad_av_invanare) || r.fran_enhet_id === EGEN;
  const franEnhet = !franPatienten && db.query('SELECT 1 FROM enheter WHERE id = ?').get(r.fran_enhet_id) ? r.fran_enhet_id : r.till_enhet_id;
  atk.krav('las_journal', { resurs: { enhet_id: franEnhet }, beskrivning: `bilaga:${b.id}` });
  const m = spara(db, { patientId: atk.patientId, enhetId: franEnhet, vardkontaktId: franPatienten ? null : vardkontaktFor(atk, nu), kategori: 'journal', fil: { namn: b.namn, typ: b.typ, buf: Buffer.from(b.data) },
    kalla: 'remissbilaga', kallaRef: String(b.id), kroppsstalle: body.kroppsstalle, beskrivning: body.beskrivning ?? `Bilaga till remiss ${b.remiss_id}`, tagen: b.skapad, nu, av: atk.personal.id,
    status: franPatienten ? 'vantar' : 'journal' });
  return mediaUt(db, m);
}

// ---- Patientens uppladdning i Min journal ----------------------------------------------------------------------------

// Vårdenheterna som patienten kan skicka en bild till: de där patienten har en vårdrelation.
export function minMottagare(atk) {
  const vardenheter = atk.db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all();
  return vardenheter.filter(v => harVardrelation(atk.db, atk.patient.id, v.id)).map(v => ({ id: v.id, namn: v.namn }));
}

export function minLaddaUpp(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  const mottagare = minMottagare(atk);
  const ve = mottagare.find(v => v.id === body.enhetId);
  if (!ve) throw new Fel(400, 'Välj en av vårdenheterna där du har kontakt.', 'ogiltig', { falt: ['enhetId'] });
  if (db.query("SELECT count(*) AS n FROM media WHERE patient_id = ? AND status = 'vantar'").get(atk.patient.id).n >= MAX_VANTANDE) {
    throw new Fel(409, `Du har redan ${MAX_VANTANDE} bilder som vården inte har granskat. Vänta tills de är granskade.`, 'tak');
  }
  const fil = tolkaMedia(body.bild);
  if (!TYPER[fil.typ].bild) throw new Fel(400, 'Ladda upp en bild i PNG eller JPEG.', 'ogiltig', { falt: ['data'] });
  const m = spara(db, { patientId: atk.patient.id, enhetId: ve.id, kategori: 'journal', fil, kalla: 'min_journal', kroppsstalle: body.kroppsstalle, beskrivning: body.beskrivning,
    tagen: tagenFor(body.tagen, nu), nu, invanare: atk.invanare.id, status: 'vantar' });
  atk.logga(`min:bild:${m.id}`, { handling: 'invanare_begaran' });
  return { id: m.id, till: ve.namn, status: 'vantar', text: `Bilden är skickad till ${ve.namn}. Den kommer in i din journal när vården har granskat den.` };
}

// Bilder som patienter har skickat till den inloggades vårdenhet och som väntar på granskning. En patient som den
// inloggade inte får se finns inte med alls, och varje patient som visas loggas.
export function vantande(db, personal, valFor) {
  sakra(db);
  if (!kanRoll(personal, 'skriv_journal') && !kanRoll(personal, 'skriv_omvardnad')) return { bilder: [] };
  const enheter = enheterUnder(db, vardenhetFor(db, personal.enhet_id));
  const rader = db.query(`SELECT * FROM media WHERE status = 'vantar' AND enhet_id IN (${enheter.map(() => '?').join(', ')}) ORDER BY registrerad`).all(...enheter);
  const ut = [];
  for (const m of rader) {
    const r = provaRad(db, personal, valFor, m, 'las_journal');
    if (!r.tillaten) continue;
    loggaPatient(db, personal, m.patient_id, 'las_journal', r.grund, '/api/media/vantande');
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(m.patient_id);
    ut.push({ ...mediaUt(db, m), patient: { id: p.id, namn: visningsnamn(p, valFor(p.id).visa_identitet) } });
  }
  return { bilder: ut };
}

export function granska(atk, m, body = {}, nu = new Date()) {
  const db = atk.db;
  // Säkerhetsgranskningen: granskningen är en ändring och görs av den vårdenhet som patienten skickade bilden till.
  andraRad(atk, m, 'skriv_journal', 'las_journal', 'Bilden granskas av den vårdenhet som patienten skickade den till.');
  if (m.status !== 'vantar') throw new Fel(409, 'Bilden är redan granskad.', 'ogiltig');
  const godkann = body.godkann !== false;
  db.query('UPDATE media SET status = ?, granskad_tid = ?, granskad_av = ?, vardkontakt_id = ?, kroppsstalle = coalesce(?, kroppsstalle) WHERE id = ?')
    .run(godkann ? 'journal' : 'avvisad', iso(nu), atk.personal.id, godkann ? vardkontaktFor(atk, nu) : null, body.kroppsstalle ? normaliseraStalle(body.kroppsstalle) : null, m.id);
  return mediaUt(db, mediaRad(db, m.id));
}

// ---- Visning och jämförelse ------------------------------------------------------------------------------------------

export function forPatient(atk, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav(kanRoll(atk.personal, 'las_journal') ? 'las_journal' : 'las_omvardnad');
  forfallna(db, nu);
  const bilder = atk.filtrera(db.query("SELECT * FROM media WHERE patient_id = ? AND status = 'journal' ORDER BY tagen DESC, id DESC").all(atk.patientId), handlingFor);
  const studier = atk.filtrera(db.query('SELECT * FROM media_studier WHERE patient_id = ? ORDER BY bestalld DESC').all(atk.patientId), 'las_journal');
  const stallen = [...new Set(bilder.map(b => b.kroppsstalle).filter(Boolean))].sort();
  return { bilder: bilder.map(m => mediaUt(db, m)), studier: studier.map(s => studieUt(db, s, nu)), kroppsstallen: stallen,
    undersokningar: Object.entries(UNDERSOKNINGAR).map(([id, u]) => ({ id, namn: u.namn, arkiv: ARKIV[u.arkiv].namn })), kallor: KALLOR };
}

// Bilderna av ett kroppsställe i tidsordning, med dagarna mellan varje bild och den första.
export function jamforelse(atk, kroppsstalle) {
  const db = atk.db;
  sakra(db);
  const s = normaliseraStalle(kroppsstalle);
  if (!s) throw new Fel(400, 'Ange kroppsstället.', 'ogiltig', { falt: ['kroppsstalle'] });
  atk.krav(kanRoll(atk.personal, 'las_journal') ? 'las_journal' : 'las_omvardnad');
  const bilder = atk.filtrera(db.query("SELECT * FROM media WHERE patient_id = ? AND status = 'journal' AND kroppsstalle = ? AND typ LIKE 'image/%' ORDER BY tagen, id").all(atk.patientId, s), handlingFor);
  const forsta = bilder[0] ? Date.parse(bilder[0].tagen) : null;
  return { kroppsstalle: s, bilder: bilder.map(m => ({ ...mediaUt(db, m), dagarFranForsta: Math.round((Date.parse(m.tagen) - forsta) / 86400_000) })),
    text: bilder.length > 1 ? `${bilder.length} bilder av ${s} över ${Math.round((Date.parse(bilder.at(-1).tagen) - forsta) / 86400_000)} dagar.` : bilder.length ? 'Bara en bild av kroppsstället.' : 'Inga bilder av kroppsstället.' };
}

export const huvuden = (typ, namn, { ladda = false } = {}) => ({ 'Content-Type': typ, 'Content-Disposition': `${ladda ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(namn)}`, 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'", 'Cache-Control': 'no-store' });

// Filen, med samma prövning som raden: inre sekretess och spärr på vårdenheten där bilden registrerades. Loggas.
export function fil(atk, m, { ladda = false } = {}) {
  kravFil(atk, m);
  // Runda 11, r5: filen kan laddas ner (export av bildmaterialet).
  return new Response(m.data, { headers: huvuden(m.typ, m.namn, { ladda }) });
}
// Runda 11, r5: samma prövning och loggning för filen, miniatyren och visningsbilden (bildmedia.js). En bild som väntar
// på granskning från Min journal prövas som journalen; en import från en apparat eller en annan vårdgivare efter sin kategori.
export const lasHandlingFor = (m) => handlingFor(m);
export function kravFil(atk, m, del = '') {
  bunden(atk, m);
  if (!['vantar', 'journal'].includes(m.status)) throw new Fel(404, 'Bilden finns inte.', 'saknas');
  atk.krav(m.status === 'vantar' && m.kalla === 'min_journal' ? 'las_journal' : handlingFor(m), { resurs: { enhet_id: m.enhet_id }, beskrivning: `media:${m.id}${del}` });
  atk.logga(handlingFor(m), atk.grund(), `media:${m.id}${del}`);
}

// ---- Det simulerade multimediaarkivet --------------------------------------------------------------------------------

export function bestallUndersokning(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  sakra(db);
  atk.krav('remittera');
  if (!finns(UNDERSOKNINGAR, body.undersokning)) throw new Fel(400, 'Välj undersökningen.', 'ogiltig', { falt: ['undersokning'] });
  const fragestallning = textFalt(body.fragestallning, 500);
  if (!fragestallning) throw new Fel(400, 'Skriv frågeställningen.', 'ogiltig', { falt: ['fragestallning'] });
  const u = UNDERSOKNINGAR[body.undersokning];
  const r = db.query("INSERT INTO media_studier (patient_id, enhet_id, vardkontakt_id, undersokning, arkiv, fragestallning, bestalld_av, bestalld, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bestalld')")
    .run(atk.patientId, atk.personal.enhet_id, vardkontaktFor(atk, nu), body.undersokning, u.arkiv, fragestallning, atk.personal.id, iso(nu));
  return studieUt(db, studieRad(db, r.lastInsertRowid), nu);
}

// Arkivet utför undersökningen och svarar efter sin svarstid. Studien får ett uid i demons OID-rot.
export function forfallna(db, nu = new Date()) {
  sakra(db);
  for (const s of db.query("SELECT * FROM media_studier WHERE status = 'bestalld'").all()) {
    if (nu.getTime() < Date.parse(s.bestalld) + ARKIV[s.arkiv].svarMinuter * MIN) continue;
    db.query("UPDATE media_studier SET status = 'besvarad', utford = ?, uid = ?, utlatande = ? WHERE id = ?")
      .run(iso(Date.parse(s.bestalld) + ARKIV[s.arkiv].svarMinuter * MIN), `${OID_ROT}.9.${s.id}`, UNDERSOKNINGAR[s.undersokning].utlatande, s.id);
  }
}

// Bildlänken: studien visas genom arkivet, med samma behörighet som journalanteckningar. Bilden är en ritad
// platshållare, eftersom arkivet är simulerat.
export function visaStudie(atk, s, nu = new Date()) {
  bunden(atk, s);
  forfallna(atk.db, nu);
  s = studieRad(atk.db, s.id);
  atk.krav('las_journal', { resurs: { enhet_id: s.enhet_id }, beskrivning: `media:studie:${s.id}` });
  if (s.status !== 'besvarad') throw new Fel(409, 'Arkivet har inte svarat än.', 'ogiltig');
  atk.logga('las_journal', atk.grund(), `media:studie:${s.id}`);
  const u = UNDERSOKNINGAR[s.undersokning];
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360" role="img" aria-label="Simulerad bild från ${esc(ARKIV[s.arkiv].namn)}">
<rect width="480" height="360" fill="#111"/><ellipse cx="240" cy="180" rx="150" ry="120" fill="#555"/><ellipse cx="240" cy="180" rx="90" ry="70" fill="#999"/>
<text x="16" y="28" fill="#fff" font-family="sans-serif" font-size="16">${esc(u.namn)} (simulerad bild)</text>
<text x="16" y="340" fill="#fff" font-family="sans-serif" font-size="12">${esc(ARKIV[s.arkiv].namn)}, studie ${esc(s.uid)}, ${esc(datumAv(new Date(s.utford)))}</text></svg>`;
  return new Response(svg, { headers: huvuden('image/svg+xml', `studie-${s.id}.svg`) });
}

