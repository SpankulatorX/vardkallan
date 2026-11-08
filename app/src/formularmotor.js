// Runda 10, r3: formulärmotorn (Sussa 3.1.3.1, 3.1.3.5, 3.1.7.1 och 5.1.1.3). Verksamhetens formulär är data, inte kod.
// Systemförvaltningen bygger ett formulär i gränssnittet med frågor av fördefinierade datatyper (public/js/
// formularmotor-regler.js), fasta svar med poäng och koder ur ICD-10-SE, KVÅ och Snomed CT, en skala med tolkning,
// regler, en kroppsbild för markeringar och förifyllnad ur journalen. Varje ändring är en ny version som gäller först när
// en annan systemförvaltare har godkänt den (fyra ögon, som parametrarna i konfiguration.js). En godkänd version ändras
// och raderas aldrig, och den som avvecklar ett formulär behåller allt som har skrivits med det.
//
// Ett ifyllt formulär är en vanlig journalanteckning med formulärets namn som typ. Behörigheten är anteckningens
// (omvårdnad eller läkarnas dokumentation), och formuläret kan dessutom begränsas till vissa yrken och vårdenheter, vilket
// prövas här på servern. Systemet skriver anteckningens text ur svaren, och svaren sparas strukturerat bredvid med
// formulärets version, så att anteckningen syns som text överallt där anteckningar visas och svaren går att räkna på.
//
// Information registreras en gång: åldern tas ur personnumret, ett mätvärde fylls i med det senaste värdet som den som
// fyller i får se, och ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, så att det
// finns i mätvärdena, kurvorna och NEWS2 utan att någon skriver det igen. Förifyllnaden bygger bara på det som anroparen
// får se, efter behörighetsmotorn, spärr och inre sekretess.
import { Fel, iso, idag } from './db.js';
import { kanRoll, vardenhetFor, alder as alderAv, ROLLER } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as sakerhetslogg from './sakerhetslogg.js';
import { ICD10SE, KVA, SYSTEM } from './kodverk.js';
import { SOKORD, provaBegrepp, delmangd } from './fackssprak.js';
import * as R from '../public/js/formularmotor-regler.js';
import { SCHEMA_FORMULAR } from './schema-runda10-r3.js';

const harTabell = (db, namn = 'formular') => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(namn));
export function sakra(db) { db.exec(SCHEMA_FORMULAR); }
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
const loggaAtgard = (db, personal, resurs) => loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'konfigurera', resurs, grund: 'administrativ' });
const kravForvaltning = (personal) => {
  if (!personal || !kanRoll(personal, 'konfigurera')) throw new Fel(403, 'Bara systemförvaltningen bygger och ändrar formulär.', 'nekad');
};
const journalModul = () => require('./journal.js');

// Det som en definition behöver ur resten av systemet: mätvärdestyperna, sökorden med kod och mallarnas namn.
function sammanhang(db) {
  const j = journalModul();
  const mattyper = Object.fromEntries(Object.entries(j.MATTYPER).map(([id, m]) => [id, { namn: m.namn, min: m.min, max: m.max, enhet: m.enhet, format: m.format ?? null, heltal: m.heltal ?? false }]));
  const sokord = Object.keys(SOKORD).filter(s => SOKORD[s].code || s === 'Kommentar' || s === 'Hud/vävnad');
  const vardenheter = db.query("SELECT id FROM enheter WHERE typ = 'vardenhet'").all().map(r => r.id);
  return { mattyper, sokord, upptagnaNamn: j.MALLAR.map(m => m.typ), vardenheter };
}

// Kodverken som en fråga, ett svarsalternativ eller en tolkning kan ha en kod i.
export const KODVERK = { icd10: 'ICD-10-SE', kva: 'KVÅ', snomed: 'Snomed CT' };
export function provaKod(k) {
  if (!k || typeof k !== 'object' || !Object.hasOwn(KODVERK, k.system)) return `Koden behöver ett av kodverken ${Object.values(KODVERK).join(', ')}.`;
  const kod = String(k.kod ?? '').trim();
  if (k.system === 'icd10') return Object.hasOwn(ICD10SE, kod) ? null : `Koden ${kod.slice(0, 12)} finns inte i ICD-10-SE i Vårdkällans kodverk.`;
  if (k.system === 'kva') return Object.hasOwn(KVA, kod) ? null : `Koden ${kod.slice(0, 12)} finns inte i KVÅ i Vårdkällans kodverk.`;
  const p = provaBegrepp(kod);
  return p.ok ? null : p.varfor;
}
const snomedText = (kod) => delmangd().find(d => d.code === kod)?.text ?? null;
export function kodText(k) {
  if (!k) return null;
  if (k.system === 'icd10') return `${ICD10SE[k.kod]} (${k.kod})`;
  if (k.system === 'kva') return `${KVA[k.kod]} (KVÅ ${k.kod})`;
  const t = snomedText(k.kod);
  return t ? `${t} (Snomed CT ${k.kod})` : `Snomed CT ${k.kod}`;
}
const kodFhir = (k) => ({ system: k.system === 'icd10' ? SYSTEM.icd10se : k.system === 'kva' ? SYSTEM.kva : SYSTEM.snomed, code: k.kod, display: k.system === 'icd10' ? ICD10SE[k.kod] : k.system === 'kva' ? KVA[k.kod] : (delmangd().find(d => d.code === k.kod)?.display ?? undefined) });

// Alla koder i en definition, med var de sitter.
function koder(def) {
  const ut = [];
  for (const f of def.falt) {
    if (f.kod) ut.push({ var: `frågan ${f.fraga}`, kod: f.kod });
    for (const a of f.alternativ ?? []) if (a.kod) ut.push({ var: `svaret ${a.text} i frågan ${f.fraga}`, kod: a.kod });
  }
  for (const t of def.skala?.tolkning ?? []) if (t.kod) ut.push({ var: `tolkningen ${t.text}`, kod: t.kod });
  return ut;
}

// Förslag på koder för svarsalternativ utan kod: ett alternativ vars text står i en kodtitel får koden som förslag.
function kodforslag(def) {
  const titlar = [
    ...Object.entries(ICD10SE).map(([kod, text]) => ({ kod: { system: 'icd10', kod }, text })),
    ...Object.entries(KVA).map(([kod, text]) => ({ kod: { system: 'kva', kod }, text })),
    ...delmangd().filter(d => d.code).map(d => ({ kod: { system: 'snomed', kod: d.code }, text: d.text })),
  ];
  const ut = [];
  for (const f of def.falt) {
    for (const a of f.alternativ ?? []) {
      if (a.kod || a.text.length < 5) continue;
      const t = a.text.toLowerCase();
      const traff = titlar.find(x => x.text.toLowerCase().startsWith(t) || x.text.toLowerCase() === t);
      if (traff) ut.push({ falt: f.id, varde: a.varde, kod: traff.kod, text: traff.text });
    }
  }
  return ut;
}

// Kontrollerar en definition helt: strukturen i reglerna och koderna mot kodverken.
function prova(db, definition) {
  const p = R.provaDefinition(definition, sammanhang(db));
  if (!p.ok) return p;
  // Ett yrke som inte skriver anteckningar i kategorin kan aldrig fylla i formuläret, och systemet säger det direkt.
  const handling = p.varde.kategori === 'omvardnad' ? 'skriv_omvardnad' : 'skriv_journal';
  const utan = (p.varde.roller ?? []).filter(r => !(ROLLER[r] ?? []).includes(handling));
  if (utan.length) return { ok: false, varfor: `${utan.map(r => R.YRKEN[r]).join(' och ')} skriver inte ${p.varde.kategori === 'omvardnad' ? 'omvårdnadsanteckningar' : 'läkaranteckningar'} i journalen och kan därför inte fylla i formuläret.`, falt: 'roller' };
  for (const k of koder(p.varde)) {
    const v = provaKod(k.kod);
    if (v) return { ok: false, varfor: `Koden för ${k.var}: ${v}`, falt: 'kod' };
  }
  return p;
}

// Vad som ändrats mot förra versionen, på vanlig svenska.
function andring(forra, ny) {
  if (!forra) return 'Nytt formulär.';
  const ut = [];
  const fId = new Map(forra.falt.map(f => [f.id, f]));
  const nId = new Map(ny.falt.map(f => [f.id, f]));
  for (const f of ny.falt) if (!fId.has(f.id)) ut.push(`Ny fråga: ${f.fraga}.`);
  for (const f of forra.falt) if (!nId.has(f.id)) ut.push(`Borttagen fråga: ${f.fraga}.`);
  for (const f of ny.falt) {
    const g = fId.get(f.id);
    if (g && JSON.stringify(g) !== JSON.stringify(f)) ut.push(`Ändrad fråga: ${f.fraga}.`);
  }
  if (JSON.stringify(forra.skala ?? null) !== JSON.stringify(ny.skala ?? null)) ut.push('Ändrad skala eller tolkning.');
  if (JSON.stringify(forra.regler ?? null) !== JSON.stringify(ny.regler ?? null)) ut.push('Ändrade regler.');
  if (JSON.stringify([forra.roller, forra.enheter, forra.kategori]) !== JSON.stringify([ny.roller, ny.enheter, ny.kategori])) ut.push('Ändrat vem som får fylla i formuläret.');
  if (forra.beskrivning !== ny.beskrivning) ut.push('Ändrad beskrivning.');
  return ut.length ? ut.join(' ') : 'Samma innehåll som den gällande versionen.';
}

const slug = (namn) => namn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'formular';
const rad = (db, id) => {
  const r = harTabell(db) && db.query('SELECT * FROM formular WHERE id = ?').get(Number(id));
  if (!r) throw new Fel(404, 'Formuläret finns inte.', 'saknas');
  return r;
};
const aktiv = (db, kod) => (harTabell(db) ? db.query("SELECT * FROM formular WHERE kod = ? AND status = 'aktiv'").get(kod) : null);
const STATUSTEXT = { vantar: 'Väntar på godkännande', aktiv: 'Gäller', avslagen: 'Avslagen', ersatt: 'Ersatt av en senare version', avvecklad: 'Avvecklad' };

function versionUt(db, r, personal) {
  return {
    id: r.id, kod: r.kod, version: r.version, namn: r.namn, status: r.status, statusText: STATUSTEXT[r.status],
    definition: JSON.parse(r.definition), andring: r.andring, motivering: r.motivering,
    foreslagenAv: personNamn(db, r.foreslagen_av), foreslagen: r.foreslagen,
    beslutadAv: personNamn(db, r.beslutad_av), beslutad: r.beslutad, kommentar: r.beslut_kommentar,
    avvecklad: r.avvecklad ? { av: personNamn(db, r.avvecklad_av), tid: r.avvecklad, motivering: r.avveckling_motivering } : null,
    ...(personal ? { kanGodkanna: r.status === 'vantar' && r.foreslagen_av !== personal.id, egen: r.foreslagen_av === personal.id } : {}),
  };
}

// Förhandsvisningen: om definitionen går att använda, förklaringen när den inte gör det, vad som ändrats mot den gällande
// versionen, texten som ett exempel på svar ger, kodernas text och förslag på koder.
export function forhandsvisa(db, personal, { definition, kod = null } = {}) {
  kravForvaltning(personal);
  const p = prova(db, definition);
  if (!p.ok) return { ok: false, varfor: p.varfor, falt: p.falt };
  const gallande = kod ? aktiv(db, kod) : null;
  const exempelSvar = {};
  for (const f of p.varde.falt) {
    if (f.typ === 'ja_nej') exempelSvar[f.id] = 'ja';
    else if (f.typ === 'val') exempelSvar[f.id] = f.alternativ.at(-1).varde;
    else if (f.typ === 'flerval') exempelSvar[f.id] = [f.alternativ[0].varde];
    else if (['heltal', 'decimal', 'matvarde'].includes(f.typ)) exempelSvar[f.id] = f.min;
    else if (f.typ === 'bild') exempelSvar[f.id] = [{ vy: 'bak', x: 56, y: 95, region: 'bak:hal-h', regionText: 'höger häl', text: '' }];
    else if (f.typ === 'datum') exempelSvar[f.id] = idag();
    else exempelSvar[f.id] = 'Exempeltext';
  }
  return {
    ok: true, varde: p.varde, andring: andring(gallande ? JSON.parse(gallande.definition) : null, p.varde),
    exempel: R.sokord(p.varde, exempelSvar), koder: koder(p.varde).map(k => ({ var: k.var, text: kodText(k.kod) })), kodforslag: kodforslag(p.varde),
  };
}

// Föreslår ett nytt formulär eller en ny version av ett formulär. Det gäller först när en annan systemförvaltare har
// godkänt det.
export function foresla(db, personal, { definition, kod = null, motivering } = {}) {
  kravForvaltning(personal);
  sakra(db);
  const m = typeof motivering === 'string' ? motivering.trim() : '';
  if (!m) throw new Fel(400, 'Skriv varför formuläret behövs eller ändras. Motiveringen följer med versionen i historiken.', 'ogiltig', { falt: ['motivering'] });
  if (m.length > 1000) throw new Fel(400, 'Motiveringen får vara högst 1000 tecken.', 'ogiltig', { falt: ['motivering'] });
  const p = prova(db, definition);
  if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: [p.falt] });
  let k = kod;
  let version = 1;
  let forra = null;
  if (k) {
    const senaste = db.query('SELECT * FROM formular WHERE kod = ? ORDER BY version DESC LIMIT 1').get(k);
    if (!senaste) throw new Fel(404, 'Formuläret finns inte.', 'saknas');
    if (senaste.namn !== p.varde.namn) throw new Fel(400, `Namnet är anteckningens typ i journalen och följer formuläret i alla versioner. Behåll namnet ${senaste.namn}, eller bygg ett nytt formulär med det nya namnet.`, 'ogiltig', { falt: ['namn'] });
    version = senaste.version + 1;
    forra = aktiv(db, k);
  } else {
    if (db.query("SELECT 1 FROM formular WHERE lower(namn) = lower(?) AND status IN ('vantar', 'aktiv')").get(p.varde.namn)) throw new Fel(409, `Det finns redan ett formulär som heter ${p.varde.namn}. Gör en ny version av det i stället.`, 'ogiltig', { falt: ['namn'] });
    k = slug(p.varde.namn);
    let n = 2;
    while (db.query('SELECT 1 FROM formular WHERE kod = ?').get(k)) k = `${slug(p.varde.namn).slice(0, 36)}_${n++}`;
  }
  if (db.query("SELECT 1 FROM formular WHERE kod = ? AND status = 'vantar'").get(k)) throw new Fel(409, 'Det finns redan en version av formuläret som väntar på godkännande. Godkänn eller avslå den först.', 'ogiltig');
  const r = db.query(`INSERT INTO formular (kod, version, namn, definition, status, motivering, andring, foreslagen_av, foreslagen)
    VALUES (?, ?, ?, ?, 'vantar', ?, ?, ?, ?)`).run(k, version, p.varde.namn, JSON.stringify(p.varde), m, andring(forra ? JSON.parse(forra.definition) : null, p.varde), personal.id, iso());
  loggaAtgard(db, personal, `formular:${r.lastInsertRowid}`);
  return versionUt(db, rad(db, r.lastInsertRowid), personal);
}

export function godkann(db, personal, id, { kommentar } = {}) {
  kravForvaltning(personal);
  const r = rad(db, id);
  if (r.status !== 'vantar') throw new Fel(409, 'Versionen är redan beslutad.', 'ogiltig');
  if (r.foreslagen_av === personal.id) throw new Fel(403, 'Fyra ögon: en annan systemförvaltare än den som föreslog formuläret måste godkänna det.', 'nekad');
  // Prövas igen, eftersom kodverken och mallarna kan ha ändrats sedan förslaget.
  const p = prova(db, JSON.parse(r.definition));
  if (!p.ok) throw new Fel(400, `Formuläret kan inte godkännas: ${p.varfor}`, 'ogiltig');
  const t = iso();
  db.transaction(() => {
    db.query("UPDATE formular SET status = 'ersatt' WHERE kod = ? AND status = 'aktiv'").run(r.kod);
    db.query("UPDATE formular SET status = 'aktiv', beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?")
      .run(personal.id, t, typeof kommentar === 'string' && kommentar.trim() ? kommentar.trim().slice(0, 500) : null, r.id);
  })();
  loggaAtgard(db, personal, `formular:${r.id}`);
  sakerhetslogg.logga(db, { typ: 'andrad_installning', personal_id: personal.id, enhet_id: personal.enhet_id,
    beskrivning: `Formuläret ${r.namn} version ${r.version} gäller, föreslaget av ${personNamn(db, r.foreslagen_av)} och godkänt av ${personal.namn}.` });
  return versionUt(db, rad(db, r.id), personal);
}

export function avsla(db, personal, id, { kommentar } = {}) {
  kravForvaltning(personal);
  const r = rad(db, id);
  if (r.status !== 'vantar') throw new Fel(409, 'Versionen är redan beslutad.', 'ogiltig');
  const k = typeof kommentar === 'string' ? kommentar.trim() : '';
  if (r.foreslagen_av !== personal.id && !k) throw new Fel(400, 'Skriv varför formuläret avslås. Den som föreslog det ser kommentaren i historiken.', 'ogiltig', { falt: ['kommentar'] });
  db.query("UPDATE formular SET status = 'avslagen', beslutad_av = ?, beslutad = ?, beslut_kommentar = ? WHERE id = ?").run(personal.id, iso(), k.slice(0, 500) || 'Återkallat av den som föreslog det.', r.id);
  loggaAtgard(db, personal, `formular:${r.id}`);
  return versionUt(db, rad(db, r.id), personal);
}

// Ett formulär som inte längre ska användas avvecklas. Anteckningarna som har skrivits med det finns kvar och visas som
// förut.
export function avveckla(db, personal, id, { motivering } = {}) {
  kravForvaltning(personal);
  const r = rad(db, id);
  if (r.status !== 'aktiv') throw new Fel(409, 'Bara den version som gäller kan avvecklas.', 'ogiltig');
  const m = typeof motivering === 'string' ? motivering.trim() : '';
  if (m.length < 3) throw new Fel(400, 'Skriv varför formuläret avvecklas.', 'ogiltig', { falt: ['motivering'] });
  db.query("UPDATE formular SET status = 'avvecklad', avvecklad_av = ?, avvecklad = ?, avveckling_motivering = ? WHERE id = ?").run(personal.id, iso(), m.slice(0, 500), r.id);
  loggaAtgard(db, personal, `formular:${r.id}`);
  return versionUt(db, rad(db, r.id), personal);
}

// Systemförvaltarens översikt: alla formulär med versionerna, senaste först. Inga patientuppgifter, bara antal anteckningar.
export function oversikt(db, personal) {
  kravForvaltning(personal);
  if (!harTabell(db)) return { formular: [] };
  const rader = db.query('SELECT * FROM formular ORDER BY kod, version DESC').all();
  const per = new Map();
  for (const r of rader) { if (!per.has(r.kod)) per.set(r.kod, []); per.get(r.kod).push(r); }
  const antal = (ids) => (harTabell(db, 'formular_svar') && ids.length ? db.query(`SELECT COUNT(*) n FROM formular_svar WHERE formular_id IN (${ids.map(() => '?').join(',')})`).get(...ids).n : 0);
  return {
    formular: [...per].map(([kod, v]) => ({
      kod, namn: v[0].namn, gallande: v.find(x => x.status === 'aktiv')?.version ?? null, anteckningar: antal(v.map(x => x.id)),
      versioner: v.map(x => versionUt(db, x, personal)),
    })),
  };
}

// Byggstenarna för gränssnittet: datatyper, bilder, mätvärden, sökord, förifyllnad, yrken, kategorier och vårdenheter.
export function byggstenar(db, personal) {
  kravForvaltning(personal);
  const s = sammanhang(db);
  return {
    datatyper: Object.entries(R.DATATYPER).map(([id, d]) => ({ id, ...d })),
    bilder: Object.entries(R.BILDER).map(([id, b]) => ({ id, namn: b.namn })),
    mattyper: Object.entries(s.mattyper).filter(([, m]) => !m.format).map(([id, m]) => ({ id, namn: m.namn, enhet: m.enhet, min: m.min, max: m.max })),
    sokord: s.sokord, forifyllnad: Object.entries(R.FORIFYLLNAD).map(([id, f]) => ({ id, ...f })),
    yrken: Object.entries(R.YRKEN).map(([id, namn]) => ({ id, namn })), kategorier: Object.entries(R.KATEGORIER).map(([id, text]) => ({ id, text })),
    kodverk: Object.entries(KODVERK).map(([id, namn]) => ({ id, namn })),
    vardenheter: db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all(),
  };
}

// Får personen fylla i formuläret? Kategorin prövas av behörighetsmotorn som för andra anteckningar, och yrkena och
// vårdenheterna här.
function far(db, personal, def) {
  const handling = def.kategori === 'omvardnad' ? 'skriv_omvardnad' : 'skriv_journal';
  if (!personal || !kanRoll(personal, handling)) return false;
  if (def.roller && !def.roller.includes(personal.yrke)) return false;
  if (def.enheter && !def.enheter.includes(vardenhetFor(db, personal.enhet_id))) return false;
  return true;
}
const mallAv = (r) => {
  const def = JSON.parse(r.definition);
  return { typ: r.namn, kategori: def.kategori, strukturerad: true, sokord: [...new Set(def.falt.map(f => f.sokord))], formular: { id: r.id, kod: r.kod, version: r.version, definition: def } };
};

// De formulär som personen får fylla i, som mallar (GET /api/mallar).
export function mallarFor(db, personal) {
  if (!personal || !harTabell(db)) return [];
  return db.query("SELECT * FROM formular WHERE status = 'aktiv' ORDER BY namn").all().filter(r => far(db, personal, JSON.parse(r.definition))).map(mallAv);
}

// Mallen för en anteckningstyp som är ett formulär, eller null. Ett formulär som finns men inte gäller ger ett fel som
// säger varför.
export function mallFor(db, typ, personal) {
  if (!harTabell(db) || typeof typ !== 'string') return null;
  const r = db.query("SELECT * FROM formular WHERE namn = ? AND status = 'aktiv'").get(typ);
  if (!r) {
    if (db.query('SELECT 1 FROM formular WHERE namn = ?').get(typ)) throw new Fel(400, `Formuläret ${typ} används inte längre. Välj ett annat formulär eller en mall.`, 'ogiltig', { falt: ['typ'] });
    return null;
  }
  const m = mallAv(r);
  if (!far(db, personal, m.formular.definition)) throw new Fel(403, `Formuläret ${typ} fylls i av ${m.formular.definition.roller ? m.formular.definition.roller.map(x => R.YRKEN[x].toLowerCase()).join(', ') : 'andra yrken'}${m.formular.definition.enheter ? ' på vissa vårdenheter' : ''}.`, 'nekad');
  return m;
}

// Förifyllnaden: värdena som systemet kan ta ur journalen, med var de kommer ifrån. Bara det som anroparen får se.
function senasteMatvarde(atk, typ) {
  const j = journalModul();
  if (!kanRoll(atk.personal, 'las_matvarden')) return null;
  return j.synligaMatvarden(atk).find(m => m.typ === typ) ?? null;
}
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;
function forifyllda(atk, def) {
  const ut = {};
  for (const f of def.falt) {
    if (f.forifyll === 'alder') {
      const p = atk.db.query('SELECT fodd FROM patienter WHERE id = ?').get(atk.patientId);
      if (p?.fodd) ut[f.id] = { varde: alderAv(p.fodd, idag()), kalla: 'Ur personnumret' };
    } else if (f.forifyll === 'senaste') {
      const m = senasteMatvarde(atk, f.matvarde);
      if (m) ut[f.id] = { varde: m.varde_num ?? Number(m.varde), kalla: `Senaste mätvärdet ${m.tid.slice(0, 10)}, ${enhetsnamn(atk.db, m.enhet_id)}`, matvardeId: m.id };
    } else if (f.forifyll === 'diagnoser') {
      const d = journalModul().synligaDiagnoser(atk).filter(x => x.typ !== 'avslutad');
      if (d.length) ut[f.id] = { varde: d.map(x => `${x.text} (${x.kod})`).join(', ').slice(0, f.maxLangd), kalla: 'Diagnoserna i journalen' };
    }
  }
  return ut;
}

export function forifyllnad(atk, kod) {
  const r = typeof kod === 'string' ? aktiv(atk.db, kod) : null;
  if (!r) throw new Fel(404, 'Formuläret finns inte.', 'saknas');
  const def = JSON.parse(r.definition);
  if (!far(atk.db, atk.personal, def)) throw new Fel(403, 'Din yrkesroll fyller inte i formuläret.', 'nekad');
  atk.krav(def.kategori === 'omvardnad' ? 'skriv_omvardnad' : 'skriv_journal');
  const v = forifyllda(atk, def);
  return { formular: { id: r.id, kod: r.kod, version: r.version }, varden: Object.fromEntries(Object.entries(v).map(([id, x]) => [id, { varde: x.varde, kalla: x.kalla }])) };
}

// Kontrollerar svaren och ger det som sparas: svaren, texten som systemet skriver, poängen och var värdena kommer ifrån.
// I en rättelse (forra) ändras inte ett mätvärde som redan är registrerat.
export function forbered(atk, formular, svar, { forra = null } = {}) {
  const def = formular.definition;
  const p = R.provaSvar(def, svar, { idag: idag() });
  if (!p.ok) throw new Fel(400, p.varfor, 'ogiltig', { falt: [p.falt] });
  const v = p.varde;
  const fore = forifyllda(atk, def);
  const kallor = {};
  for (const f of R.synligaFalt(def, v)) {
    if (f.forifyll === 'alder' && fore[f.id]) {
      // Åldern vet systemet. Ett tomt fält fylls i, och en annan ålder sparas inte.
      if (v[f.id] == null) v[f.id] = fore[f.id].varde;
      else if (v[f.id] !== fore[f.id].varde) throw new Fel(400, `Patienten är ${fore[f.id].varde} år enligt personnumret. Systemet fyller i åldern.`, 'ogiltig', { falt: [f.id] });
      kallor[f.id] = 'ur personnumret';
    }
    if (f.typ === 'matvarde' && v[f.id] != null) {
      if (forra) {
        if (forra.svar[f.id] !== v[f.id]) throw new Fel(400, `Mätvärdet ${f.fraga.toLowerCase()} är registrerat i journalens mätvärden och rättas under Mätvärden, så att det bara finns på ett ställe.`, 'ogiltig', { falt: [f.id] });
        kallor[f.id] = forra.kallor[f.id];
      } else if (fore[f.id] && fore[f.id].varde === v[f.id]) kallor[f.id] = fore[f.id].kalla.charAt(0).toLowerCase() + fore[f.id].kalla.slice(1);
      else {
        if (!kanRoll(atk.personal, 'registrera_matvarde')) throw new Fel(403, `Din yrkesroll registrerar inte mätvärden. Lämna ${f.fraga.toLowerCase()} som systemet fyllde i, eller tomt.`, 'nekad');
        kallor[f.id] = 'registreras som mätvärde när anteckningen signeras';
      }
    }
  }
  const poang = R.poang(def, v);
  return { formularId: formular.id, varde: v, kallor, poang, sokord: R.sokord(def, v, { kallor }) };
}

export function spara(db, anteckningId, f) {
  sakra(db);
  const rad = [f.formularId, JSON.stringify(f.varde), f.poang?.summa ?? null, JSON.stringify(f.kallor), iso(), anteckningId];
  if (db.query('SELECT 1 FROM formular_svar WHERE anteckning_id = ?').get(anteckningId)) db.query('UPDATE formular_svar SET formular_id = ?, svar = ?, poang = ?, kallor = ?, sparad = ? WHERE anteckning_id = ?').run(...rad);
  else db.query('INSERT INTO formular_svar (formular_id, svar, poang, kallor, sparad, anteckning_id) VALUES (?, ?, ?, ?, ?, ?)').run(...rad);
}

// Formuläret som en anteckning skrevs med, eller null om anteckningen inte är ett formulär.
export function formularFor(db, anteckningId) {
  if (!harTabell(db, 'formular_svar')) return null;
  const s = db.query('SELECT * FROM formular_svar WHERE anteckning_id = ?').get(anteckningId);
  if (!s) return null;
  const r = db.query('SELECT * FROM formular WHERE id = ?').get(s.formular_id);
  return { rad: s, formular: { id: r.id, kod: r.kod, version: r.version, definition: JSON.parse(r.definition) }, svar: JSON.parse(s.svar), kallor: JSON.parse(s.kallor ?? '{}') };
}

// Svaren för en anteckning, som de lämnas ut tillsammans med anteckningen.
export function ut(db, anteckningId) {
  const f = formularFor(db, anteckningId);
  if (!f) return null;
  const def = f.formular.definition;
  const registrerat = harTabell(db, 'formular_matvarden')
    ? db.query('SELECT falt, matvarde_id FROM formular_matvarden WHERE anteckning_id = ? ORDER BY falt').all(anteckningId).map(r => ({ falt: r.falt, matvardeId: r.matvarde_id })) : [];
  return {
    id: f.formular.id, kod: f.formular.kod, version: f.formular.version, namn: def.namn, definition: def, svar: f.svar, kallor: f.kallor,
    poang: R.poang(def, f.svar), varningar: R.varningar(def, f.svar), registrerat,
    koder: koder(def).map(k => ({ var: k.var, text: kodText(k.kod) })),
  };
}

// Före signeringen: ett nytt mätvärde registreras i journalens mätvärden, en gång, och texten säger det. Prövas igen mot
// det senaste värdet, eftersom ett mätvärde kan ha registrerats sedan utkastet sparades. Körs i signeringens transaktion
// innan anteckningen blir signerad, så att inget blir halvgjort.
export function foreSignering(atk, a) {
  const f = formularFor(atk.db, a.id);
  if (!f) return;
  const def = f.formular.definition;
  const fore = forifyllda(atk, def);
  const kallor = { ...f.kallor };
  const j = journalModul();
  for (const falt of R.synligaFalt(def, f.svar)) {
    if (falt.typ !== 'matvarde' || f.svar[falt.id] == null) continue;
    if (fore[falt.id] && fore[falt.id].varde === f.svar[falt.id]) { kallor[falt.id] = fore[falt.id].kalla.charAt(0).toLowerCase() + fore[falt.id].kalla.slice(1); continue; }
    const m = j.registreraMatvarde(atk, { typ: falt.matvarde, varde: f.svar[falt.id] });
    atk.db.query('INSERT INTO formular_matvarden (anteckning_id, falt, matvarde_id) VALUES (?, ?, ?)').run(a.id, falt.id, m.id);
    kallor[falt.id] = 'registrerat som mätvärde vid signeringen';
  }
  const sokord = R.sokord(def, f.svar, { kallor });
  atk.db.query('UPDATE formular_svar SET kallor = ? WHERE anteckning_id = ?').run(JSON.stringify(kallor), a.id);
  atk.db.query('UPDATE anteckningar SET sokord = ? WHERE id = ?').run(JSON.stringify(sokord), a.id);
}

// FHIR R4 ---------------------------------------------------------------------------------------------------------------

const QTYP = { text: 'text', heltal: 'integer', decimal: 'decimal', datum: 'date', ja_nej: 'choice', val: 'choice', flerval: 'choice', bild: 'group', matvarde: 'decimal' };
const CS_SVAR = 'https://vardkallan.404haven.se/fhir/CodeSystem/formularsvar';
const CS_REGION = 'https://vardkallan.404haven.se/fhir/CodeSystem/kroppsregion';
const ASCII = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');

// Formulärets version som Questionnaire. Id är kod-version.
export function fhirFormular(r) {
  const def = JSON.parse(r.definition);
  const status = r.status === 'aktiv' ? 'active' : r.status === 'vantar' ? 'draft' : 'retired';
  return {
    resourceType: 'Questionnaire', id: `${r.kod.replace(/_/g, '-')}-${r.version}`, url: `https://vardkallan.404haven.se/fhir/Questionnaire/${r.kod.replace(/_/g, '-')}`, version: String(r.version),
    name: ASCII(def.namn).slice(0, 60) || `F${r.id}`, title: def.namn, status, ...(r.beslutad ? { date: r.beslutad } : {}),
    ...(def.beskrivning ? { description: def.beskrivning } : {}),
    item: def.falt.map(f => ({
      linkId: f.id, text: f.fraga, type: QTYP[f.typ], ...(f.obligatoriskt ? { required: true } : {}), ...(f.typ === 'flerval' ? { repeats: true } : {}),
      ...(f.typ === 'ja_nej' ? { answerOption: [{ valueCoding: { system: CS_SVAR, code: 'ja', display: 'Ja' } }, { valueCoding: { system: CS_SVAR, code: 'nej', display: 'Nej' } }] } : {}),
      ...(f.alternativ ? { answerOption: f.alternativ.map(a => ({ valueCoding: a.kod ? { ...kodFhir(a.kod) } : { system: CS_SVAR, code: a.varde, display: a.text } })) } : {}),
      ...(f.typ === 'bild' ? { repeats: true, item: [{ linkId: `${f.id}.region`, text: 'Kroppsdel och sida', type: 'choice' }, { linkId: `${f.id}.text`, text: 'Beskrivning', type: 'string' }] } : {}),
      ...(f.visaOm && !Object.hasOwn(f.visaOm, 'ifyllt') ? { enableWhen: [villkorFhir(def, f.visaOm)] } : {}),
    })),
  };
}
function villkorFhir(def, v) {
  const f = def.falt.find(x => x.id === v.falt);
  if (Object.hasOwn(v, 'ar')) {
    const a = f.alternativ?.find(x => x.varde === v.ar);
    return { question: v.falt, operator: '=', answerCoding: a?.kod ? kodFhir(a.kod) : { system: CS_SVAR, code: v.ar } };
  }
  const tal = Object.hasOwn(v, 'minst') ? Number(v.minst) : Number(v.hogst);
  return { question: v.falt, operator: Object.hasOwn(v, 'minst') ? '>=' : '<=', ...(f.typ === 'heltal' ? { answerInteger: tal } : { answerDecimal: tal }) };
}

// Svaren i en anteckning som QuestionnaireResponse. a är anteckningen som anteckningUt ger den, efter behörigheten.
export function fhirSvar(db, a) {
  const f = a.formular;
  if (!f) return null;
  const def = f.definition;
  const item = [];
  for (const falt of R.synligaFalt(def, f.svar)) {
    const v = f.svar[falt.id];
    if (v == null) continue;
    let answer;
    if (falt.typ === 'ja_nej') answer = [{ valueCoding: { system: CS_SVAR, code: v, display: v === 'ja' ? 'Ja' : 'Nej' } }];
    else if (falt.typ === 'val' || falt.typ === 'flerval') answer = (Array.isArray(v) ? v : [v]).map(x => { const al = falt.alternativ.find(y => y.varde === x); return { valueCoding: al.kod ? kodFhir(al.kod) : { system: CS_SVAR, code: x, display: al.text } }; });
    else if (falt.typ === 'heltal') answer = [{ valueInteger: v }];
    else if (falt.typ === 'decimal' || falt.typ === 'matvarde') answer = [{ valueDecimal: v }];
    else if (falt.typ === 'datum') answer = [{ valueDate: v }];
    else if (falt.typ === 'text') answer = [{ valueString: v }];
    if (falt.typ === 'bild') {
      for (const m of v) item.push({ linkId: falt.id, text: falt.fraga, item: [{ linkId: `${falt.id}.region`, answer: [{ valueCoding: { system: CS_REGION, code: m.region, display: m.regionText } }] }, ...(m.text ? [{ linkId: `${falt.id}.text`, answer: [{ valueString: m.text }] }] : [])] });
    } else item.push({ linkId: falt.id, text: falt.fraga, answer });
  }
  return {
    resourceType: 'QuestionnaireResponse', id: String(a.id), questionnaire: `https://vardkallan.404haven.se/fhir/Questionnaire/${f.kod.replace(/_/g, '-')}|${f.version}`,
    status: a.status === 'signerad' ? (a.ersatt ? 'amended' : 'completed') : 'in-progress', subject: { reference: `Patient/${a.patientId}` },
    ...(a.vardkontaktId ? { encounter: { reference: `Encounter/${a.vardkontaktId}` } } : {}), authored: a.signerad?.tid ?? a.skapad,
    ...(a.forfattare?.id ? { author: { reference: `Practitioner/${a.forfattare.id}`, display: a.forfattare.namn } } : {}),
    item,
  };
}

// /fhir/Questionnaire och /fhir/QuestionnaireResponse. Formulären har inga patientuppgifter men läses bara av personalen.
// Svaren prövas, filtreras och loggas som anteckningen de hör till (Composition i fhir.js).
export function fhirHantera(ctx, delar, bundle) {
  const { db, personal, url } = ctx;
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  const [typ, id] = delar;
  if (delar.length > 2) throw new Fel(404, 'Okänd FHIR-resurs.', 'saknas');
  const { Atkomst } = require('./atkomst.js');
  const j = journalModul();
  if (typ === 'Questionnaire') {
    const alla = harTabell(db) ? db.query("SELECT * FROM formular WHERE status IN ('aktiv', 'ersatt', 'avvecklad') ORDER BY kod, version").all().map(fhirFormular) : [];
    if (id) { const q = alla.find(x => x.id === id); if (!q) throw new Fel(404, 'Resursen finns inte.', 'saknas'); return { status: 200, body: q }; }
    const sokt = url.searchParams.get('url') ?? url.searchParams.get('_id');
    return { status: 200, body: bundle(alla.filter(q => !sokt || q.url === sokt || q.id === sokt)) };
  }
  if (id) {
    if (!/^\d{1,9}$/.test(id) || !formularFor(db, Number(id))) throw new Fel(404, 'Resursen finns inte.', 'saknas');
    const a = j.hamtaAnteckningRad(db, id);
    const atk = new Atkomst(db, personal, a.patient_id, ctx.valFor(a.patient_id), j.lasHandling(a.kategori));
    const ut = j.hamtaAnteckning(atk, a);
    atk.logga(j.lasHandling(a.kategori), atk.grund(), `fhir/QuestionnaireResponse/${id}`);
    return { status: 200, body: fhirSvar(db, ut) };
  }
  const pid = (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '');
  if (!pid) throw new Fel(400, 'Sökparametern patient krävs.', 'ogiltig');
  if (!db.query('SELECT 1 FROM patienter WHERE id = ?').get(pid)) throw new Fel(404, 'Patienten finns inte.', 'saknas');
  const handling = kanRoll(personal, 'las_journal') ? 'las_journal' : 'las_omvardnad';
  const atk = new Atkomst(db, personal, pid, ctx.valFor(pid), handling);
  atk.krav(handling, { beskrivning: `fhir/QuestionnaireResponse${url.search}` });
  const lista = j.listaAnteckningar(atk).anteckningar.filter(a => formularFor(db, a.id));
  const resurser = lista.map(a => fhirSvar(db, j.anteckningUt(db, j.hamtaAnteckningRad(db, a.id))));
  atk.logga(handling, atk.grund(), `fhir/QuestionnaireResponse${url.search}`);
  return { status: 200, body: bundle(resurser) };
}

// Seeden ------------------------------------------------------------------------------------------------------------------

// Formulären Fallriskbedömning och Sårdokumentation, föreslagna av den ena systemförvaltaren och godkända av den andra,
// och en ny version av fallriskbedömningen som väntar på godkännande, så att fyra ögon syns i demon. Med anteckning
// läggs en signerad fallriskbedömning in för patienten p01, två dagar före bas, så att formulären finns i FHIR.
export function seeda(db, bas = new Date(), { anteckning = false } = {}) {
  sakra(db);
  if (db.query('SELECT 1 FROM formular LIMIT 1').get()) return;
  const { FALLRISK, SAR } = require('./schema-runda10-r3.js');
  const t = (h) => new Date(bas.getTime() - h * 3600_000).toISOString();
  const lagg = (def, kod, version, status, av, beslutad, timmar, motivering, andringText) => {
    const p = prova(db, def);
    if (!p.ok) throw new Error(`Seedens formulär ${def.namn}: ${p.varfor}`);
    return Number(db.query(`INSERT INTO formular (kod, version, namn, definition, status, motivering, andring, foreslagen_av, foreslagen, beslutad_av, beslutad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(kod, version, p.varde.namn, JSON.stringify(p.varde), status, motivering, andringText, av, t(timmar), beslutad, beslutad ? t(timmar - 2) : null).lastInsertRowid);
  };
  const fall = lagg(FALLRISK, 'fallrisk', 1, 'aktiv', 'sysf', 'sysf-2', 24 * 30, 'Avdelningarna dokumenterar fallrisken på samma sätt, så att den går att följa över tid.', 'Nytt formulär.');
  lagg(SAR, 'sar', 1, 'aktiv', 'sysf', 'sysf-2', 24 * 30 - 4, 'Sårets läge markeras på en kroppsbild i stället för att beskrivas i fritext.', 'Nytt formulär.');
  const yrsel = { id: 'yrsel', typ: 'ja_nej', fraga: 'Har patienten yrsel vid uppresning?', poang: { ja: 1, nej: 0 }, sokord: 'Status' };
  const v2 = { ...FALLRISK, falt: [...FALLRISK.falt, yrsel], skala: { ...FALLRISK.skala, tolkning: [FALLRISK.skala.tolkning[0], { ...FALLRISK.skala.tolkning[1], till: 9 }] } };
  lagg(v2, 'fallrisk', 2, 'vantar', 'sysf-2', null, 3, 'Yrsel vid uppresning är en vanlig orsak till fall hos äldre och saknas i formuläret.', `Ny fråga: ${yrsel.fraga} Ändrad skala eller tolkning.`);
  if (!anteckning || !db.query("SELECT 1 FROM patienter WHERE id = 'p01'").get() || !db.query("SELECT 1 FROM personal WHERE id = 'ssk-kard'").get()) return;
  const def = JSON.parse(db.query('SELECT definition FROM formular WHERE id = ?').get(fall).definition);
  const svar = { alder: alderAv(db.query("SELECT fodd FROM patienter WHERE id = 'p01'").get().fodd, t(48).slice(0, 10)), fall: 'nej', lakemedel: 'ett', syn: 'ja', gang: 'hjalpmedel', forvirring: 'nej' };
  const kallor = { alder: 'ur personnumret' };
  const tid = t(48);
  const vk = db.query("SELECT id FROM vardkontakter WHERE patient_id = 'p01' AND enhet_id = 'uso-kard-72' ORDER BY start DESC").get()?.id ?? null;
  const r = db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av)
    VALUES ('p01', 'uso-kard-72', ?, ?, 'omvardnad', ?, 'ssk-kard', ?, 'signerad', ?, 'ssk-kard')`).run(vk, def.namn, JSON.stringify(R.sokord(def, svar, { kallor })), tid, tid);
  db.query('INSERT INTO formular_svar (anteckning_id, formular_id, svar, poang, kallor, sparad) VALUES (?, ?, ?, ?, ?, ?)')
    .run(Number(r.lastInsertRowid), fall, JSON.stringify(svar), R.poang(def, svar).summa, JSON.stringify(kallor), tid);
}
