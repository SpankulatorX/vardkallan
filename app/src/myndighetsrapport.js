// Felens text är generisk och innehåller aldrig fritext eller koder ur journalen, eftersom uppföljningsrollen ser den utan
// vårdrelation. Det som behövs för att hitta posten står i detalj, som bara visas i inkorgen efter behörighetsprövningen.
//
// Rapportering till myndigheter och register (runda 7, r5, Sussa 6.3.2 och avtalets tillägg 2020, A1.7 punkt 4).
// Systemet sammanställer varje rapport själv ur det som redan är registrerat: vårdtillfällen, vårdkontakter, diagnoser,
// åtgärder, givna läkemedel, tvångsvårdens beslut, väntelistan, remisser och förlossningar. Det kontrollerar raderna mot
// reglerna i den gällande tekniska beskrivningen, och varje fel får en text på vanlig svenska och hamnar hos den som kan
// rätta det. En rad med fel hålls kvar och följer med av sig själv i nästa rapport när den är rättad, eftersom
// patientregistret tar emot de tre senaste månaderna varje gång. Inget skickas på riktigt: mottagarna är simulerade.
//
// Formaten följer Socialstyrelsens föreskrifter och filspecifikationer (källor i rapportkoder.js och
// docs/kodkontroll.md). För Vårdtillfällesdatabasen hittades ingen gällande teknisk beskrivning, så formatet är ett
// antagande och märkt så. Kvalitetsregistret är ett demoregister.
import { createHash, randomBytes } from 'node:crypto';
import { Fel } from './db.js';
import { vardenhetFor, aktivaSparrar } from './atkomst.js';
import { ICD10SE, KVA } from './kodverk.js';
import { loggaRad } from './logg.js';
import { lage } from './tvangsvard-regler.js';
import * as K from './rapportkoder.js';

const TZ = 'Europe/Stockholm';
const pad = (n) => String(n).padStart(2, '0');
const datumSv = (iso) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }) : null);
const lokal = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T');
const kompakt = (datum) => (datum ? datum.replaceAll('-', '') : '');
const tidKompakt = (iso) => (iso ? lokal(iso).slice(0, 16).replace(/[-:]/g, '') : '');
const tidMedSekunder = (iso) => (iso ? lokal(iso).slice(0, 19) : '');
const finnsTabell = (db, namn) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(namn));

// Månader i svensk tid, som 'ÅÅÅÅ-MM'.
export const manadAv = (nu) => new Date(nu).toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
export function addManad(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
const sistaDag = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`; };
const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const manadText = (ym) => `${MANADER[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS myndighetsrapporter (
  id INTEGER PRIMARY KEY, rapport TEXT NOT NULL, period TEXT NOT NULL, skickad TEXT NOT NULL, av TEXT NOT NULL, mottagare TEXT NOT NULL,
  filer TEXT NOT NULL, antal TEXT NOT NULL, kvarhallna INTEGER NOT NULL, utelamnade TEXT NOT NULL, kvittens TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS myndighetsrapport_andras_ej BEFORE UPDATE ON myndighetsrapporter BEGIN SELECT RAISE(ABORT, 'En skickad rapport ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS myndighetsrapport_raderas_ej BEFORE DELETE ON myndighetsrapporter BEGIN SELECT RAISE(ABORT, 'En skickad rapport raderas inte'); END;
CREATE TABLE IF NOT EXISTS kvalitetsregister_motsatt (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, register TEXT NOT NULL, registrerad TEXT NOT NULL, registrerad_av TEXT
);
CREATE TABLE IF NOT EXISTS registeraterkoppling (
  id INTEGER PRIMARY KEY, register TEXT NOT NULL, rapport_id INTEGER NOT NULL, tid TEXT NOT NULL, data TEXT NOT NULL
);
`;
export function sakra(db) {
  db.exec(SCHEMA);
  // Invändningen kan ångras och kan anmälas av patienten själv. Raden raderas aldrig, utan får tiden för ångrandet.
  const kol = db.query('PRAGMA table_info(kvalitetsregister_motsatt)').all().map(k => k.name);
  for (const k of ['invanare_id', 'aterkallad', 'aterkallad_av', 'aterkallad_av_invanare']) if (!kol.includes(k)) db.exec(`ALTER TABLE kvalitetsregister_motsatt ADD COLUMN ${k} TEXT`);
}

// Filerna och deras fält: namn och högsta antal tecken, i den ordning som filspecifikationen anger.
const ID = ['Vårdkontakts-id', 30];
export const FILER = {
  SV_AD: { rubrik: 'Slutenvård, administrativa uppgifter', falt: [ID, ['Personnummer', 12], ['Juridiskt kön', 1], ['Födelseår', 4], ['Sjukhus', 6], ['Klinik', 3], ['Datum för inskrivning', 8], ['Datum för utskrivning', 8], ['Planerad vårdkontakt', 1], ['Inskrivningssätt', 1], ['Utskrivningssätt', 1]] },
  SV_DI: { rubrik: 'Slutenvård, diagnoser', falt: [ID, ['Diagnoskod', 5], ['Typ av diagnos', 1]] },
  SV_YO: { rubrik: 'Slutenvård, yttre orsaker', falt: [ID, ['Yttre orsakskod', 5]] },
  SV_AT: { rubrik: 'Slutenvård, åtgärder med åtgärdskod', falt: [ID, ['Åtgärdskod', 5], ['Datum för åtgärd', 8]] },
  SV_LT: { rubrik: 'Slutenvård, läkemedelstillförsel med ATC-kod', falt: [ID, ['ATC-kod', 8], ['Datum för åtgärd', 8]] },
  OV_AD: { rubrik: 'Öppenvård, administrativa uppgifter', falt: [ID, ['Personnummer', 12], ['Juridiskt kön', 1], ['Födelseår', 4], ['Sjukhus', 6], ['Klinik', 3], ['Datum för öppenvårdskontakt', 8], ['Akutverksamhet', 1], ['Tidpunkt för öppenvårdskontakt på akutmottagning', 13], ['Tidpunkt för bedömning på akutmottagning', 13], ['Tidpunkt för avslut på akutmottagning', 13], ['Avbruten vård på akutmottagning', 1], ['Planerad vårdkontakt', 1], ['Form av öppenvårdskontakt', 1]] },
  OV_DI: { rubrik: 'Öppenvård, diagnoser', falt: [ID, ['Diagnoskod', 5], ['Typ av diagnos', 1]] },
  OV_YO: { rubrik: 'Öppenvård, yttre orsaker', falt: [ID, ['Yttre orsakskod', 5]] },
  OV_AT: { rubrik: 'Öppenvård, åtgärder med åtgärdskod', falt: [ID, ['Åtgärdskod', 5], ['Datum för åtgärd', 8]] },
  OV_LT: { rubrik: 'Öppenvård, läkemedelstillförsel med ATC-kod', falt: [ID, ['ATC-kod', 8], ['Datum för åtgärd', 8]] },
  OV_YK: { rubrik: 'Öppenvård, yrkeskategori i psykiatrin', falt: [ID, ['Yrkeskategori', 5]] },
  TV: { rubrik: 'Psykiatrisk vårdform enligt LPT och LRV', falt: [['Personnummer', 12], ['Juridiskt kön', 1], ['Födelseår', 4], ['Sjukhus', 6], ['Klinik', 3], ['Psykiatrisk vårdform', 1], ['Datum för start av psykiatrisk vårdform', 8], ['Datum för avslut av psykiatrisk vårdform', 8]] },
  VTID_SVV_AD: { rubrik: 'Väntande i specialiserad vård', falt: [['Mätperiod', 10], ['Vårdkontakts-id', 255], ['Vårdgaranti', 1], ['Fas', 1], ['Medicinskt verksamhetsområde', 3], ['Aktivitet', 5], ['Aktivitet KVÅ', 5], ['Aktivitet ICD', 6], ['Huvudman', 50], ['Vårdgivare', 50], ['Vårdenhet1', 6], ['Vårdenhet1_namn', 250], ['Vårdenhet2', 50], ['Vårdenhet3', 50], ['Listning', 50], ['Födelseår', 4], ['Juridiskt kön', 1], ['Kommunkod', 4], ['Bokningssätt', 1], ['Vårdkontakt', 2], ['Yrkesgrupp', 5], ['Avvikelse', 1], ['Remittenttyp', 1], ['Beslut att utföra aktivitet', 19], ['Medicinskt måldatum', 19], ['Remiss-ID', 255], ['Remittent', 50], ['Remissdatum', 19], ['Ankomstdatum', 19]] },
  VTD: { rubrik: 'Vårdtillfällen (antaget format)', falt: [['Vårdtillfälles-id', 30], ['Personnummer', 12], ['Juridiskt kön', 1], ['Födelseår', 4], ['Sjukhus', 6], ['Klinik', 3], ['Datum för inskrivning', 8], ['Datum för utskrivning', 8], ['Vårdtid i dagar', 4], ['Huvuddiagnos', 5], ['Inskrivningssätt', 1], ['Utskrivningssätt', 1]] },
  // Medicinska födelseregistret, uppgifter om förlossningen: 66 frågor, av vilka Vårdkällan kan besvara de som finns
  // utanför en förlossningsjournal. Övriga lämnas tomma.
  MFR_FV1: { rubrik: 'Uppgifter om förlossningen', falt: [['Förlossnings-id', 30], ['HSA-id', 40], ['FV-id', 6], ['Uppgifternas status', 1], ['Den förlöstas personnummer', 12], ['Identifieringsalternativ', 1], ['Den förlöstas födelsedatum', 8], ['Varit inskriven i mödrahälsovården', 1], ['Inskriven i samband med förlossningen', 13], ...Array.from({ length: 57 }, (_, i) => [`Fråga ${i + 10}`, 13])] },
  MFR_FV4: { rubrik: 'Diagnoser för den förlösta', falt: [['Förlossnings-id', 30], ['Diagnoskodens löpnummer', 2], ['Diagnoskod', 5]] },
  MFR_FV5: { rubrik: 'Åtgärder för den förlösta', falt: [['Förlossnings-id', 30], ['Diagnoskodens löpnummer', 2], ['Åtgärdskod', 5], ['Åtgärdstillfälle', 13]] },
  KR: { rubrik: 'Demoregister för hjärtsvikt (antaget format)', falt: [['Personnummer', 12], ['Juridiskt kön', 1], ['Födelseår', 4], ['Vårdenhet', 50], ['Diagnoskod', 5], ['Diagnosdatum', 8], ['RAS-hämmare', 1], ['Betablockerare', 1], ['MRA', 1], ['SGLT2-hämmare', 1], ['Systoliskt blodtryck', 3], ['Puls', 3], ['NT-proBNP', 6], ['eGFR', 3]] },
};
// Fråga 13 (antal barn) och 65 (utskriven) i FV1, som systemet kan räkna fram.
const FV1_ANTAL_BARN = 12;
const FV1_UTSKRIVEN = 64;

// Rapporterna. bestammelse är den bestämmelse som uppgiftsskyldigheten bygger på.
export const RAPPORTER = {
  par: {
    id: 'par', namn: 'Patientregistret', kortnamn: 'PAR', mottagare: 'Socialstyrelsen, patientregistret (simulerad mottagare)', kalla: 'par',
    filer: ['SV_AD', 'SV_DI', 'SV_YO', 'SV_AT', 'SV_LT', 'OV_AD', 'OV_DI', 'OV_YO', 'OV_AT', 'OV_LT', 'OV_YK', 'TV'],
    bestammelse: 'Lagen (1998:543) om hälsodataregister 6 §, förordningen (2001:707) om patientregister hos Socialstyrelsen och Socialstyrelsens föreskrifter HSLF-FS 2023:33 i lydelsen enligt HSLF-FS 2025:44.',
    frekvens: 'Varje månad, senast den sista dagen, för de tre månader som föregår rapporteringsmånaden (HSLF-FS 2023:33 4 §).',
  },
  viv: {
    id: 'viv', namn: 'Väntetider i vården', kortnamn: 'VIV', mottagare: 'Socialstyrelsen, väntetidsdatabasen (simulerad mottagare)', kalla: 'viv',
    filer: ['VTID_SVV_AD'],
    bestammelse: 'Hälso- och sjukvårdslagen (2017:30) 9 kap. och hälso- och sjukvårdsförordningen (2017:80) 6 kap. Sedan den 1 juli 2025 tar Socialstyrelsen emot uppgifterna i stället för SKR.',
    frekvens: 'Varje månad, mellan den 4 och den 25 i månaden efter mätperioden.',
  },
  vtd: {
    id: 'vtd', namn: 'Vårdtillfällesdatabasen', kortnamn: 'Vårdtillfällen', mottagare: 'Vårdtillfällesdatabasen (simulerad mottagare)', kalla: null, antagande: true,
    filer: ['VTD'],
    bestammelse: 'Avtalets tillägg 2020 (A1.7 punkt 4) nämner Vårdtillfällesdatabasen. Ingen gällande teknisk beskrivning för den hittades, och vårdtillfällena rapporteras i dag till patientregistret. Formatet här är ett antagande som bygger på patientregistrets uppgifter om slutenvård.',
    frekvens: 'Varje månad för föregående månad (antagande).',
  },
  mfr: {
    id: 'mfr', namn: 'Medicinska födelseregistret', kortnamn: 'MFR', mottagare: 'Socialstyrelsen, medicinska födelseregistret (simulerad mottagare)', kalla: 'mfr',
    filer: ['MFR_FV1', 'MFR_FV4', 'MFR_FV5'],
    bestammelse: 'Lagen (1998:543) om hälsodataregister 6 §, förordningen (2001:708) om medicinskt födelseregister hos Socialstyrelsen och Socialstyrelsens föreskrifter HSLF-FS 2024:5.',
    frekvens: 'Varje månad, senast den sista dagen, och senast två månader efter den månad då förlossningen ägde rum (HSLF-FS 2024:5 4 §).',
  },
  kvalitetsregister: {
    id: 'kvalitetsregister', namn: 'Demoregister för hjärtsvikt', kortnamn: 'Kvalitetsregister', mottagare: 'Demoregister för hjärtsvikt (simulerat kvalitetsregister)', kalla: null, antagande: true,
    filer: ['KR'],
    bestammelse: 'Patientdatalagen (2008:355) 7 kap. Registreringen är frivillig för patienten: uppgifterna lämnas inte om patienten motsätter sig det (7 kap. 2 §), och patienten ska få information om det (7 kap. 3 §).',
    frekvens: 'Varje månad för de tre föregående månaderna (demoregel).',
  },
};
export const RAPPORT_ID = Object.keys(RAPPORTER);

// Perioden som rapporten avser när den görs vid tiden nu.
export function period(rapportId, nu = new Date()) {
  const m = manadAv(nu);
  const [fran, till] = { par: [-3, -1], kvalitetsregister: [-3, -1], viv: [-1, -1], vtd: [-1, -1], mfr: [-2, -1] }[rapportId];
  const f = addManad(m, fran);
  const t = addManad(m, till);
  const sistaInlamning = rapportId === 'viv' ? `${m}-25` : sistaDag(m);
  return { fran: `${f}-01`, till: sistaDag(t), manad: t, rapporteringsmanad: m, text: f === t ? manadText(f) : `${manadText(f)} till ${manadText(t)}`, sistaInlamning };
}
const iPerioden = (datum, p) => Boolean(datum) && datum >= p.fran && datum <= p.till;

// Ett fält i en fil: utan semikolon och radbrytningar, som filformatet inte tål.
const falt = (v) => String(v ?? '').replace(/[;\r\n]+/g, ' ').trim();
const kon = (p) => (p.kon === 'man' ? '1' : p.kon === 'kvinna' ? '2' : '');

// Sammanställer rapporten. Returnerar filerna, felen, varningarna och det som inte rapporteras eller hålls kvar.
export function sammanstall(db, rapportId, { nu = new Date() } = {}) {
  const r = RAPPORTER[rapportId];
  if (!r) throw new Error(`Okänd rapport: ${rapportId}`);
  sakra(db);
  const ctx = skapaKontext(db, rapportId, nu);
  ({ par: byggPar, viv: byggViv, vtd: byggVtd, mfr: byggMfr, kvalitetsregister: byggKvalitetsregister })[rapportId](ctx);
  const tid = tidKompakt(nu.toISOString());
  const filkod = K.LANSKOD;
  const filer = r.filer.map(kod => {
    const rader = ctx.rader[kod] ?? [];
    const namn = kod === 'VTD' ? `VTD_${filkod}_${kompakt(ctx.period.manad)}_${tid}.txt` : kod === 'KR' ? `KR_HJARTSVIKT_${filkod}_${kompakt(ctx.period.manad)}_${tid}.txt` : `${kod}_${filkod}_${kompakt(ctx.period.manad)}_${tid}.txt`;
    const text = rader.map(x => x.map(falt).join(';')).join('\n') + (rader.length ? '\n' : '');
    return { kod, namn, rubrik: FILER[kod].rubrik, falt: FILER[kod].falt.map(f => f[0]), antal: rader.length, rader, text, sha256: createHash('sha256').update(text).digest('hex') };
  });
  const format = kontrolleraFormat(filer);
  return {
    rapport: { id: r.id, namn: r.namn, kortnamn: r.kortnamn, mottagare: r.mottagare, bestammelse: r.bestammelse, frekvens: r.frekvens, antagande: Boolean(r.antagande), kalla: r.kalla ? K.KALLOR.find(k => k.id === r.kalla) : null },
    period: ctx.period, filer, fel: ctx.fel, varningar: ctx.varningar, undantag: Object.values(ctx.undantag).filter(u => u.antal > 0),
    patienter: [...ctx.patienter], kvarhallna: ctx.kvarhallna.size, format,
    antal: { rader: filer.reduce((s, f) => s + f.antal, 0), patienter: ctx.patienter.size, kontakter: ctx.kontakter },
    tid: nu.toISOString(),
  };
}

function skapaKontext(db, rapportId, nu) {
  const enheter = new Map(db.query('SELECT * FROM enheter').all().map(e => [e.id, e]));
  const patienter = new Map();
  const sparrar = new Map();
  return {
    db, rapportId, nu, period: period(rapportId, nu), enheter,
    rader: {}, fel: [], varningar: [], undantag: {}, patienter: new Set(), kvarhallna: new Set(), kontakter: 0,
    patient(pid) {
      if (!patienter.has(pid)) patienter.set(pid, db.query('SELECT * FROM patienter WHERE id = ?').get(pid) ?? null);
      return patienter.get(pid);
    },
    sparrad(pid, enhetId) {
      if (!sparrar.has(pid)) sparrar.set(pid, aktivaSparrar(db, pid));
      return sparrar.get(pid).includes(vardenhetFor(db, enhetId));
    },
    rad(fil, varden) { (this.rader[fil] ??= []).push(varden); },
    // Räknar något som inte rapporteras eller som rapporteras trots ett skydd, med bestämmelsen det bygger på.
    rakna(nyckel, text, bestammelse, ingar = false) {
      (this.undantag[nyckel] ??= { nyckel, text, bestammelse, ingar, antal: 0 }).antal++;
    },
  };
}

// Vårdenhetens koder. En vårdenhet utan koder är ett fel som rättas i mappningen, inte i journalen.
function koder(ctx, enhetId, radNyckel) {
  const ve = vardenhetFor(ctx.db, enhetId);
  const e = ctx.enheter.get(ve);
  const info = K.ENHETER[ve];
  if (!info) {
    laggFel(ctx, { regel: 'mappning', radNyckel, enhetId: ve, atgard: 'mappning',
      text: `${e?.namn ?? 'Vårdenheten'} har ingen sjukhus- och klinikkod för rapporteringen. Lägg till vårdenheten i mappningen.` });
    return null;
  }
  return { ve, namn: e?.namn, hsa: e?.hsa_id, sjukhus: info.sjukhus ? K.SJUKHUS[info.sjukhus] : null, mvo: info.mvo, akut: info.akut ?? '0', primarvard: Boolean(info.primarvard), psykiatri: Boolean(info.psykiatri) };
}

// Identiteten som filerna kräver: tolv tecken och om det är personnummer, samordningsnummer eller reservnummer.
const ID_TYP = { personnummer: '1', samordningsnummer: '2', reservnummer: '3' };
function identitet(ctx, p, radNyckel, enhetId) {
  const typ = p.id_typ ?? 'personnummer';
  const ok = ID_TYP[typ] && /^[0-9]{12}$/.test(p.personnummer);
  if (ok) return { pnr: p.personnummer, alternativ: ID_TYP[typ] };
  const text = typ === 'reservnummer'
    ? 'Patientens reservnummer har inte tolv siffror, som registret tar emot. Registrera personnummer eller samordningsnummer när det blir känt.'
    : 'Patienten har bara en annan identitet än personnummer, samordningsnummer eller reservnummer. Registrera ett reservnummer för patienten.';
  laggFel(ctx, { regel: 'identitet', radNyckel, patientId: p.id, enhetId: vardenhetFor(ctx.db, enhetId), atgard: 'identitet', text });
  return null;
}

function laggFel(ctx, f) {
  const nyckel = `${ctx.rapportId}:${f.regel}:${f.radNyckel}`;
  if (ctx.fel.some(x => x.nyckel === nyckel)) return;
  const e = ctx.enheter.get(f.enhetId);
  ctx.fel.push({ nyckel, rapport: ctx.rapportId, regel: f.regel, text: f.text, radNyckel: f.radNyckel, enhet: e ? { id: e.id, namn: e.namn } : null,
    patientId: f.patientId ?? null, vardkontaktId: f.vardkontaktId ?? null, datum: f.datum ?? null, atgard: f.atgard, detalj: f.detalj ?? null });
  if (f.radNyckel) ctx.kvarhallna.add(f.radNyckel);
}

// Diagnoserna på en eller flera vårdkontakter, i den ordning de registrerades.
const diagnoserFor = (db, kontaktIdn) => (kontaktIdn.length
  ? db.query(`SELECT * FROM diagnoser WHERE vardkontakt_id IN (${kontaktIdn.map(() => '?').join(', ')}) ORDER BY id`).all(...kontaktIdn) : []);
const atgarderFor = (db, kontaktIdn) => (kontaktIdn.length && finnsTabell(db, 'atgarder')
  ? db.query(`SELECT * FROM atgarder WHERE vardkontakt_id IN (${kontaktIdn.map(() => '?').join(', ')}) ORDER BY tid, id`).all(...kontaktIdn) : []);
function lakemedelFor(db, patientId, fran, till) {
  if (!finnsTabell(db, 'administreringar')) return [];
  const rader = db.query(`SELECT a.tid, k.atc FROM administreringar a JOIN katalog k ON k.id = a.lakemedel_id
    WHERE a.patient_id = ? AND a.status = 'given' AND a.tid >= ? AND (? IS NULL OR a.tid <= ?) ORDER BY a.tid`).all(patientId, fran, till, till);
  // Läkemedelstillförseln anges en gång per läkemedel, med datum då den påbörjades.
  const forsta = new Map();
  for (const x of rader) if (x.atc && !forsta.has(x.atc)) forsta.set(x.atc, x.tid);
  return [...forsta].map(([atc, tid]) => ({ atc, datum: kompakt(datumSv(tid)) }));
}

// Kontroller av diagnoserna för en vårdkontakt. Returnerar raderna för DI och YO, eller null om något måste rättas.
// Systemet avgör själv det som går: en kod som inte får vara huvuddiagnos rapporteras som bidiagnos, och finns flera
// huvuddiagnoser blir den först registrerade huvuddiagnos.
function kontrolleraDiagnoser(ctx, { diagnoser, radNyckel, patientId, vardkontaktId, enhetId, datum, pagar }) {
  const ve = vardenhetFor(ctx.db, enhetId);
  let ok = true;
  for (const d of diagnoser) {
    const kod = K.utanPunkt(d.kod);
    const kand = ICD10SE[d.kod] || K.tolkaYttreOrsak(d.kod) || K.FORLOSSNING[d.kod.slice(0, 3)] || /^Z37\.\d$/.test(d.kod);
    if (!kand || kod.length < 4 || kod.length > 5) {
      laggFel(ctx, { regel: 'kod', radNyckel, patientId, vardkontaktId, enhetId: ve, datum, atgard: 'diagnos',
        text: 'En diagnoskod kan inte rapporteras. Registret tar emot koder ur ICD-10-SE med fyra eller fem tecken utan punkt. Registrera en giltig diagnos för vårdkontakten.', detalj: d.kod });
      ok = false;
    }
  }
  const di = [];
  const yo = [];
  let huvudSatt = false;
  for (const d of diagnoser) {
    if (K.arYttreOrsak(d.kod)) { yo.push(K.utanPunkt(d.kod)); continue; }
    const huvud = d.typ === 'huvud' && !K.ejHuvuddiagnos(d.kod) && !huvudSatt;
    if (huvud) huvudSatt = true;
    di.push([K.utanPunkt(d.kod), huvud ? '1' : '0']);
  }
  if (!huvudSatt && !pagar) {
    laggFel(ctx, { regel: 'huvuddiagnos', radNyckel, patientId, vardkontaktId, enhetId: ve, datum, atgard: 'diagnos',
      text: 'Huvuddiagnos saknas. Läkaren på vårdenheten sätter huvuddiagnosen, och systemet föreslår en ur patientens tidigare diagnoser.' });
    ok = false;
  }
  if (diagnoser.some(d => K.arSkada(d.kod)) && !yo.length) {
    laggFel(ctx, { regel: 'yttre_orsak', radNyckel, patientId, vardkontaktId, enhetId: ve, datum, atgard: 'yttre_orsak',
      text: 'En skada är registrerad utan yttre orsak. Registret kräver minst en yttre orsak för skador och förgiftningar. Läkaren svarar på vad som hände, var och vad patienten gjorde, och systemet sätter koden.' });
    ok = false;
  }
  return ok ? { di, yo } : null;
}

// Skydd som inte hindrar rapporteringen till ett register enligt lag, men som systemet redovisar.
function raknaSkydd(ctx, p, enhetId, lagRegister) {
  if (!lagRegister) return;
  if (p.skyddad) ctx.rakna('skyddade', 'Uppgifter om patienter med skyddade personuppgifter som rapporteras', 'Uppgiftsskyldigheten följer av lag och förordning, och sekretess hindrar inte att uppgiften lämnas till en annan myndighet då (offentlighets- och sekretesslagen 10 kap. 28 §). Filerna saknar adress, så den lämnas aldrig ut.', true);
  if (ctx.sparrad(p.id, enhetId)) ctx.rakna('sparrade', 'Uppgifter från vårdenheter som patienten har spärrat och som rapporteras', 'Spärren enligt patientdatalagen 4 kap. 4 § gäller elektronisk åtkomst för vården inom vårdgivaren, inte en uppgiftsskyldighet enligt lag (lagen om hälsodataregister 6 §).', true);
}

// Patientregistret: slutenvård (vårdtillfällen), specialiserad öppenvård och psykiatrisk vårdform.
function byggPar(ctx) {
  const { db, period: per } = ctx;
  // Slutenvården: varje vårdtillfälle som pågick någon gång under perioden, också om det inte är avslutat.
  for (const vt of db.query('SELECT * FROM vardtillfallen ORDER BY id').all()) {
    const inskr = datumSv(vt.inskriven);
    const utskr = datumSv(vt.utskriven);
    if (inskr > per.till || (utskr && utskr < per.fran)) continue;
    const p = ctx.patient(vt.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const nyckel = `VT${vt.id}`;
    const k = koder(ctx, vt.enhet_id, nyckel);
    if (!k) continue;
    ctx.kontakter++;
    const id = identitet(ctx, p, nyckel, vt.enhet_id);
    const kontakter = db.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start').all(vt.id);
    const kontaktIdn = kontakter.map(v => v.id);
    const sist = kontakter.filter(v => vardenhetFor(db, v.enhet_id) === k.ve).at(-1) ?? kontakter.at(-1);
    const dia = kontrolleraDiagnoser(ctx, { diagnoser: diagnoserFor(db, kontaktIdn), radNyckel: nyckel, patientId: p.id, vardkontaktId: sist?.id ?? null, enhetId: vt.enhet_id, datum: inskr, pagar: !vt.utskriven });
    if (!id || !dia) continue;
    raknaSkydd(ctx, p, vt.enhet_id, true);
    ctx.patienter.add(p.id);
    const forra = kontakter[0]?.foregaende_id ? db.query('SELECT typ, vardtillfalle_id FROM vardkontakter WHERE id = ?').get(kontakter[0].foregaende_id) : null;
    const nasta = vt.utskriven ? db.query("SELECT 1 FROM vardtillfallen WHERE patient_id = ? AND id <> ? AND inskriven >= ? AND inskriven <= ?").get(p.id, vt.id, vt.utskriven, new Date(Date.parse(vt.utskriven) + 86400_000).toISOString()) : null;
    ctx.rad('SV_AD', [nyckel, id.pnr, kon(p), p.fodd.slice(0, 4), k.sjukhus, k.mvo, kompakt(inskr), kompakt(utskr), kontakter[0]?.planerad ? '1' : '2',
      forra?.vardtillfalle_id ? '1' : '3', vt.utskriven ? (nasta ? '1' : '3') : '']);
    for (const d of dia.di) ctx.rad('SV_DI', [nyckel, ...d]);
    for (const y of dia.yo) ctx.rad('SV_YO', [nyckel, y]);
    for (const a of atgarderFor(db, kontaktIdn)) ctx.rad('SV_AT', [nyckel, a.kod, kompakt(datumSv(a.tid))]);
    for (const l of lakemedelFor(db, p.id, vt.inskriven, vt.utskriven)) ctx.rad('SV_LT', [nyckel, l.atc, l.datum]);
    if (!vt.utskriven) ctx.varningar.push({ nyckel: `par:pagar:${nyckel}`, text: `Ett vårdtillfälle på ${k.namn} pågår. Det rapporteras utan utskrivningsdatum och kommer med igen när det är avslutat.` });
  }

  // Den specialiserade öppenvården: besök, telefon, video och hembesök som har ägt rum under perioden.
  for (const v of db.query("SELECT * FROM vardkontakter WHERE typ IN ('oppenvard', 'akut') ORDER BY start, id").all()) {
    const datum = datumSv(v.ankomst ?? v.start);
    if (!iPerioden(datum, per)) continue;
    if (Date.parse(v.start) > ctx.nu.getTime() || (v.planerad && !v.ankomst && !v.slut)) continue;
    const p = ctx.patient(v.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const nyckel = `VK${v.id}`;
    const k = koder(ctx, v.enhet_id, nyckel);
    if (!k) continue;
    if (k.primarvard) { ctx.rakna('primarvard', 'Vårdkontakter i primärvården', 'Primärvården omfattas inte av uppgiftsskyldigheten till patientregistret (HSLF-FS 2023:33 2 § 2).'); continue; }
    const yrken = utforare(db, v.id);
    if (!k.psykiatri && !yrken.has('lakare')) { ctx.rakna('annan_personal', 'Öppenvårdskontakter där patienten inte träffade en läkare, utanför psykiatrin', 'Uppgiftsskyldigheten gäller patienter som har behandlats av läkare i den specialiserade öppenvården, och av annan personal bara i den psykiatriska öppenvården (HSLF-FS 2023:33 2 § 2).'); continue; }
    if (k.psykiatri && !yrken.size) { ctx.rakna('okand_personal', 'Psykiatriska öppenvårdskontakter där det inte går att se vem patienten träffade', 'Yrkeskategorin krävs för psykiatrisk öppenvård (HSLF-FS 2023:33 bilaga 2, OV_YK). Kontakterna saknar anteckning och diagnos.'); continue; }
    const pagar = !v.slut && v.typ === 'akut';
    if (pagar) { ctx.rakna('pagaende', 'Besök på akutmottagningen som inte är avslutade', 'Tidpunkten för avslut krävs för akutmottagningar (HSLF-FS 2023:33 bilaga 2, uppgift 11). Besöket kommer med när det är avslutat.'); continue; }
    ctx.kontakter++;
    const id = identitet(ctx, p, nyckel, v.enhet_id);
    const dia = kontrolleraDiagnoser(ctx, { diagnoser: diagnoserFor(db, [v.id]), radNyckel: nyckel, patientId: p.id, vardkontaktId: v.id, enhetId: v.enhet_id, datum, pagar: false });
    if (!id || !dia) continue;
    raknaSkydd(ctx, p, v.enhet_id, true);
    ctx.patienter.add(p.id);
    const akut1 = k.akut === '1';
    const bedomning = akut1 ? db.query("SELECT min(a.skapad) AS t FROM anteckningar a JOIN personal pe ON pe.id = a.forfattare_id WHERE a.vardkontakt_id = ? AND pe.yrke = 'lakare'").get(v.id)?.t : null;
    if (akut1 && !bedomning) ctx.varningar.push({ nyckel: `par:bedomning:${nyckel}`, text: `Ett besök på ${k.namn} saknar tidpunkt för läkarens första bedömning, eftersom ingen läkaranteckning finns. Besöket rapporteras utan tidpunkten.` });
    const form = { telefon: '8', video: '8', hembesok: '4' }[v.kontaktsatt] ?? '0';
    ctx.rad('OV_AD', [nyckel, id.pnr, kon(p), p.fodd.slice(0, 4), k.sjukhus, k.mvo, kompakt(datum), k.akut,
      akut1 ? tidKompakt(v.ankomst ?? v.start) : '', akut1 ? tidKompakt(bedomning) : '', akut1 ? tidKompakt(v.slut) : '', akut1 ? '0' : '', v.planerad ? '1' : '2', form]);
    for (const d of dia.di) ctx.rad('OV_DI', [nyckel, ...d]);
    for (const y of dia.yo) ctx.rad('OV_YO', [nyckel, y]);
    for (const a of atgarderFor(db, [v.id])) ctx.rad('OV_AT', [nyckel, a.kod, kompakt(datumSv(a.tid))]);
    for (const l of lakemedelFor(db, p.id, v.start, v.slut ?? v.start)) ctx.rad('OV_LT', [nyckel, l.atc, l.datum]);
    if (k.psykiatri) for (const y of yrken) if (K.SOSNYK[y]) ctx.rad('OV_YK', [nyckel, K.SOSNYK[y]]);
  }

  // Psykiatrisk vårdform enligt LPT och LRV (bilaga 3): varje period med samma vårdform som pågick under perioden.
  if (finnsTabell(db, 'tvangsvard_perioder')) {
    for (const tp of db.query('SELECT * FROM tvangsvard_perioder ORDER BY id').all()) {
      const p = ctx.patient(tp.patient_id);
      if (!p || p.sammanslagen_till) continue;
      const hs = db.query('SELECT * FROM tvangsvard_handelser WHERE period_id = ? ORDER BY tid, id').all(tp.id).map(h => ({ ...h, detalj: h.detalj ? JSON.parse(h.detalj) : {} }));
      const nyckel = `TV${tp.id}`;
      for (const s of vardformer(hs, ctx.nu)) {
        const start = datumSv(s.start);
        const slut = datumSv(s.slut);
        if (start > per.till || (slut && slut < per.fran)) continue;
        const k = koder(ctx, tp.enhet_id, nyckel);
        const id = identitet(ctx, p, nyckel, tp.enhet_id);
        if (!k || !id) continue;
        raknaSkydd(ctx, p, tp.enhet_id, true);
        ctx.patienter.add(p.id);
        ctx.rad('TV', [id.pnr, kon(p), p.fodd.slice(0, 4), k.sjukhus, k.mvo, s.form, kompakt(start), kompakt(slut)]);
      }
    }
  }
}

// Vem patienten träffade vid en vårdkontakt: yrket hos den som skrev en anteckning, registrerade en åtgärd eller hade
// den bokade tiden. Bara läkare registrerar diagnoser, så en diagnos betyder att patienten träffade en läkare.
function utforare(db, vkId) {
  const y = new Set(db.query('SELECT DISTINCT pe.yrke FROM anteckningar a JOIN personal pe ON pe.id = a.forfattare_id WHERE a.vardkontakt_id = ?').all(vkId).map(r => r.yrke));
  if (db.query('SELECT 1 FROM diagnoser WHERE vardkontakt_id = ? LIMIT 1').get(vkId)) y.add('lakare');
  if (finnsTabell(db, 'bokningar')) for (const r of db.query('SELECT s.yrkesroll FROM bokningar b JOIN tider t ON t.id = b.tid_id JOIN scheman s ON s.id = t.schema_id WHERE b.vardkontakt_id = ?').all(vkId)) y.add(r.yrkesroll);
  if (finnsTabell(db, 'atgarder')) for (const r of db.query('SELECT DISTINCT pe.yrke FROM atgarder a JOIN personal pe ON pe.id = a.av WHERE a.vardkontakt_id = ?').all(vkId)) y.add(r.yrke);
  return y;
}

// Perioderna med samma psykiatriska vårdform ur beslutsjournalen. Koderna enligt HSLF-FS 2023:33 bilaga 3.
export function vardformer(hs, nu = new Date()) {
  const ut = [];
  let akt = null;
  let lag = null;
  let sup = false;
  const borja = (form, tid) => { if (akt?.form === form) return; if (akt) akt.slut = tid; akt = { form, start: tid, slut: null }; ut.push(akt); };
  const avsluta = (tid) => { if (akt) akt.slut = tid; akt = null; };
  for (const h of hs) {
    const d = h.detalj ?? {};
    if (h.typ === 'kvarhallning') borja('K', h.tid);
    else if (h.typ === 'intagning' || h.typ === 'overgang11') { lag = 'LPT'; borja('D', h.tid); }
    else if (h.typ === 'lrv') { lag = 'LRV'; sup = Boolean(d.sup); borja(sup ? 'E' : 'F', h.tid); }
    else if (h.typ === 'medgivande') {
      const tid = d.beslutsdatum ? `${d.beslutsdatum}T10:00:00.000Z` : h.tid;
      if (d.form === 'oppen') borja(lag === 'LRV' ? (sup ? 'I' : 'J') : 'H', tid);
      else if (lag === 'LRV') borja(sup ? 'E' : 'F', tid);
      else borja('D', tid);
    } else if (h.typ === 'ater_sluten') borja('D', h.tid);
    else if (h.typ === 'avslag' || h.typ === 'upphor') avsluta(h.tid);
  }
  // Vården kan också ha upphört av sig själv, när en ansökan inte kom in i tid (LPT 28 §, LRV 14 §).
  if (akt) {
    const l = lage(hs, { nu: nu.getTime() });
    if (l.status === 'upphord' && l.slut) avsluta(l.slut);
  }
  return ut;
}

// Väntande i specialiserad vård den sista dagen i mätperioden, ur väntelistan.
function byggViv(ctx) {
  const { db, period: per } = ctx;
  if (!finnsTabell(db, 'vantelista')) return;
  const matperiod = `${per.manad}-01`;
  const slutMs = Date.parse(`${per.till}T23:59:59`);
  const vardgivare = ctx.enheter.get('rol')?.hsa_id ?? '';
  for (const v of db.query('SELECT * FROM vantelista ORDER BY id').all()) {
    if (v.fran > per.till) continue;
    // Väntar fortfarande vid mätperiodens slut: inte avslutad, och om en tid är bokad ligger den efter mätperioden.
    if (v.status === 'avslutad') continue;
    if (v.status === 'bokad' && v.bokning_id) {
      const t = db.query('SELECT t.start FROM bokningar b JOIN tider t ON t.id = b.tid_id WHERE b.id = ?').get(v.bokning_id);
      if (t && Date.parse(t.start) <= slutMs) continue;
    }
    const p = ctx.patient(v.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const nyckel = `VL${v.id}`;
    const k = koder(ctx, v.enhet_id, nyckel);
    if (!k) continue;
    if (k.primarvard) { ctx.rakna('primarvard', 'Väntande i primärvården', 'Primärvården rapporteras i egna filer (första kontakt och genomförda kontakter i primärvård), som inte ingår här.'); continue; }
    ctx.kontakter++;
    const fas = { nybesok: '1', ingrepp: '2', undersokning: '3' }[v.tidstyp] ?? '4';
    const aktivitet = Object.entries(K.VIV_AKTIVITET).find(([ord]) => v.orsak.toLowerCase().includes(ord))?.[1] ?? null;
    if ((fas === '2' || fas === '3') && !aktivitet) {
      laggFel(ctx, { regel: 'aktivitet', radNyckel: nyckel, patientId: p.id, enhetId: k.ve, atgard: 'aktivitet', datum: v.fran,
        text: 'En post på väntelistan saknar aktivitet ur väntetidsdatabasens vårdutbudsförteckning, som krävs för operationer och undersökningar. Ange vilket ingrepp patienten väntar på.', detalj: v.orsak });
      continue;
    }
    if (fas === '4' && !v.mal) {
      laggFel(ctx, { regel: 'maldatum', radNyckel: nyckel, patientId: p.id, enhetId: k.ve, atgard: 'vantelista', datum: v.fran,
        text: 'Ett återbesök på väntelistan saknar medicinskt måldatum, som krävs för återbesök. Ange när patienten senast bör komma.' });
      continue;
    }
    const remiss = v.remiss_id ? db.query('SELECT * FROM remisser WHERE id = ?').get(v.remiss_id) : null;
    const listning = db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').get(p.id);
    const kommun = K.KOMMUNKOD[p.ort] ?? null;
    if (!kommun) ctx.rakna('kommun', 'Väntande utan känd folkbokföringskommun, rapporterade med 0000', p.skyddad
      ? 'Filspecifikationen anger 0000 när korrekt kod saknas. För patienter med skyddade personuppgifter finns ingen adress i systemet.'
      : 'Filspecifikationen anger 0000 när korrekt kod saknas.', true);
    raknaSkydd(ctx, p, v.enhet_id, true);
    ctx.patienter.add(p.id);
    const egen = remiss?.fran_enhet_id === 'min-journal';
    const beslut = fas === '1' && remiss ? remiss.skickad_tid : v.skapad;
    ctx.rad('VTID_SVV_AD', [
      matperiod, `${nyckel}-${per.manad}`, fas === '1' || fas === '2' || fas === '3' ? '1' : '2', fas, k.mvo,
      aktivitet?.kod ?? '', '', '', vardgivare, vardgivare, k.sjukhus ?? '00000', k.sjukhus ? K_SJUKHUSNAMN(ctx, k) : 'Sjukhus saknas',
      k.hsa, ctx.enheter.get(v.enhet_id)?.hsa_id !== k.hsa ? ctx.enheter.get(v.enhet_id)?.hsa_id : '',
      listning ? ctx.enheter.get(listning.enhet_id)?.hsa_id ?? '' : '', p.fodd.slice(0, 4), kon(p) || '3', kommun ?? '0000',
      v.patientvald ? '1' : '4', { telefon: '8', video: '81' }[v.tidstyp] ?? '0', K.VIV_YRKESGRUPP[v.yrkesroll] ?? K.VIV_YRKESGRUPP.ovriga,
      '', remiss ? (egen ? '2' : '1') : '', tidMedSekunder(beslut), v.mal ? `${v.mal}T00:00:00` : '',
      remiss && !egen ? `R${remiss.id}` : '', remiss && !egen ? ctx.enheter.get(remiss.fran_enhet_id)?.hsa_id ?? '' : '',
      remiss && !egen ? tidMedSekunder(remiss.skickad_tid) : '', remiss && !egen ? tidMedSekunder(remiss.mottagen_tid) : '',
    ]);
  }
}
const K_SJUKHUSNAMN = (ctx, k) => ctx.enheter.get(K.ENHETER[k.ve]?.sjukhus)?.namn ?? k.namn;

// Vårdtillfällesdatabasen (antaget format): en rad per vårdtillfälle som avslutades under perioden.
function byggVtd(ctx) {
  const { db, period: per } = ctx;
  for (const vt of db.query('SELECT * FROM vardtillfallen WHERE utskriven IS NOT NULL ORDER BY id').all()) {
    const utskr = datumSv(vt.utskriven);
    if (!iPerioden(utskr, per)) continue;
    const p = ctx.patient(vt.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const nyckel = `VT${vt.id}`;
    const k = koder(ctx, vt.enhet_id, nyckel);
    if (!k) continue;
    ctx.kontakter++;
    const id = identitet(ctx, p, nyckel, vt.enhet_id);
    const kontakter = db.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start').all(vt.id);
    const sist = kontakter.filter(v => vardenhetFor(db, v.enhet_id) === k.ve).at(-1) ?? kontakter.at(-1);
    const dia = kontrolleraDiagnoser(ctx, { diagnoser: diagnoserFor(db, kontakter.map(v => v.id)), radNyckel: nyckel, patientId: p.id, vardkontaktId: sist?.id ?? null, enhetId: vt.enhet_id, datum: datumSv(vt.inskriven), pagar: false });
    if (!id || !dia) continue;
    raknaSkydd(ctx, p, vt.enhet_id, true);
    ctx.patienter.add(p.id);
    const inskr = datumSv(vt.inskriven);
    const dagar = Math.max(0, Math.round((Date.parse(`${utskr}T12:00:00Z`) - Date.parse(`${inskr}T12:00:00Z`)) / 86400_000));
    ctx.rad('VTD', [nyckel, id.pnr, kon(p), p.fodd.slice(0, 4), k.sjukhus, k.mvo, kompakt(inskr), kompakt(utskr), String(dagar), dia.di.find(d => d[1] === '1')?.[0] ?? '', '3', '3']);
  }
}

// Medicinska födelseregistret: förlossningar som avslutades under perioden. En förlossning är ett vårdtillfälle med en
// diagnos för förlossning (O80 till O84). Vårdkällan har ingen förlossningsjournal, så de flesta av de 66 frågorna i FV1
// lämnas tomma och redovisas som saknade.
function byggMfr(ctx) {
  const { db, period: per } = ctx;
  const tidigare = new Set(db.query("SELECT filer FROM myndighetsrapporter WHERE rapport = 'mfr'").all().flatMap(r => JSON.parse(r.filer).flatMap(f => f.idn ?? [])));
  for (const vt of db.query('SELECT * FROM vardtillfallen ORDER BY id').all()) {
    const kontakter = db.query('SELECT * FROM vardkontakter WHERE vardtillfalle_id = ? ORDER BY start').all(vt.id);
    const diagnoser = diagnoserFor(db, kontakter.map(v => v.id));
    const forlossning = diagnoser.find(d => K.FORLOSSNING[d.kod.slice(0, 3)]);
    if (!forlossning) continue;
    const datum = datumSv(forlossning.datum ? `${forlossning.datum}T12:00:00Z` : vt.inskriven);
    if (!iPerioden(datum, per)) continue;
    const p = ctx.patient(vt.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const nyckel = `F-VT${vt.id}`;
    const ve = vardenhetFor(db, vt.enhet_id);
    ctx.kontakter++;
    const id = identitet(ctx, p, nyckel, vt.enhet_id);
    const utfall = diagnoser.find(d => /^Z37\.\d$/.test(d.kod));
    if (!utfall) {
      laggFel(ctx, { regel: 'utfall', radNyckel: nyckel, patientId: p.id, vardkontaktId: kontakter.at(-1)?.id ?? null, enhetId: ve, datum, atgard: 'diagnos',
        text: 'Förlossningens utfall (Z37 i ICD-10-SE) saknas, så systemet kan inte räkna antalet barn. Läkaren registrerar utfallet.' });
    }
    if (!id || !utfall) continue;
    raknaSkydd(ctx, p, vt.enhet_id, true);
    ctx.patienter.add(p.id);
    const fv1 = Array(FILER.MFR_FV1.falt.length).fill('');
    fv1[0] = nyckel; fv1[1] = ctx.enheter.get(ve)?.hsa_id ?? ''; fv1[3] = tidigare.has(nyckel) ? '2' : '1'; fv1[4] = id.pnr; fv1[5] = id.alternativ;
    fv1[6] = kompakt(p.fodd); fv1[7] = '2'; fv1[8] = tidKompakt(vt.inskriven);
    fv1[FV1_ANTAL_BARN] = String(K.UTFALL_ANTAL[utfall.kod] ?? ''); fv1[FV1_UTSKRIVEN] = tidKompakt(vt.utskriven);
    ctx.rad('MFR_FV1', fv1);
    diagnoser.filter(d => !/^Z37/.test(d.kod)).forEach((d, i) => ctx.rad('MFR_FV4', [nyckel, String(i + 1), K.utanPunkt(d.kod)]));
    for (const a of atgarderFor(db, kontakter.map(v => v.id))) ctx.rad('MFR_FV5', [nyckel, '', a.kod, tidKompakt(a.tid)]);
    ctx.varningar.push({ nyckel: `mfr:saknas:${nyckel}`, text: 'Förlossningen rapporteras med de uppgifter som finns utanför en förlossningsjournal: identitet, inskrivning, antal barn, diagnoser och åtgärder. De övriga frågorna lämnas tomma, eftersom Vårdkällan inte har någon förlossningsjournal ännu.' });
  }
  if (!ctx.rader.MFR_FV1?.length) ctx.varningar.push({ nyckel: 'mfr:inga', text: `Inga förlossningar avslutades ${per.text}. Vårdkällan har ingen förlossningsjournal ännu, så förlossningar finns bara om en diagnos för förlossning har registrerats.` });
}

// Demoregistret för hjärtsvikt: patienter med hjärtsvikt (I50) som hade en vårdkontakt i specialiserad vård under
// perioden. Patienter som har motsatt sig registreringen kommer inte med (patientdatalagen 7 kap. 2 §). Patienter med
// skyddade personuppgifter och uppgifter från spärrade vårdenheter lämnas inte heller, eftersom ingen lag kräver
// uppgifterna. Det är ett försiktigt val, som i datauttaget.
export const KVALITETSREGISTER = 'hjartsvikt';
function byggKvalitetsregister(ctx) {
  const { db, period: per } = ctx;
  const motsatt = new Set(db.query('SELECT patient_id FROM kvalitetsregister_motsatt WHERE register = ? AND aterkallad IS NULL').all(KVALITETSREGISTER).map(r => r.patient_id));
  const sett = new Set();
  for (const d of db.query("SELECT * FROM diagnoser WHERE kod LIKE 'I50%' ORDER BY datum DESC, id DESC").all()) {
    if (sett.has(d.patient_id)) continue;
    const p = ctx.patient(d.patient_id);
    if (!p || p.sammanslagen_till) continue;
    const kontakt = db.query("SELECT * FROM vardkontakter WHERE patient_id = ? AND typ IN ('oppenvard', 'slutenvard', 'akut') ORDER BY start DESC").all(p.id)
      .find(v => iPerioden(datumSv(v.start), per) && K.ENHETER[vardenhetFor(db, v.enhet_id)] && !K.ENHETER[vardenhetFor(db, v.enhet_id)].primarvard);
    if (!kontakt) continue;
    sett.add(p.id);
    if (motsatt.has(p.id)) { ctx.rakna('motsatt', 'Patienter som har motsatt sig registrering i kvalitetsregistret', 'Personuppgifter får inte behandlas i ett nationellt eller regionalt kvalitetsregister om den enskilde motsätter sig det (patientdatalagen 7 kap. 2 §).'); continue; }
    if (p.skyddad) { ctx.rakna('skyddade_kr', 'Patienter med skyddade personuppgifter', 'Ingen lag kräver uppgiften, så sekretessen bryts inte av en uppgiftsskyldighet (offentlighets- och sekretesslagen 10 kap. 28 § gäller inte). Försiktigt val, som i datauttaget.'); continue; }
    if (ctx.sparrad(p.id, d.enhet_id) || ctx.sparrad(p.id, kontakt.enhet_id)) { ctx.rakna('sparrade_kr', 'Uppgifter från vårdenheter som patienten har spärrat', 'Patienten har motsatt sig att uppgifterna görs tillgängliga (patientdatalagen 4 kap. 4 §). Försiktigt val, som i datauttaget.'); continue; }
    const nyckel = `KR-${p.id}`;
    ctx.kontakter++;
    const id = identitet(ctx, p, nyckel, kontakt.enhet_id);
    if (!id) continue;
    ctx.patienter.add(p.id);
    const atc = db.query("SELECT k.atc FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND o.status = 'aktiv'").all(p.id).map(r => r.atc ?? '');
    const har = (...prefix) => (atc.some(a => prefix.some(x => a.startsWith(x))) ? '1' : '0');
    const senaste = (typ) => db.query('SELECT varde, varde_num FROM matvarden WHERE patient_id = ? AND typ = ? ORDER BY tid DESC LIMIT 1').get(p.id, typ);
    const bt = senaste('blodtryck');
    const num = (m) => (m?.varde_num != null ? String(Math.round(m.varde_num)) : '');
    ctx.rad('KR', [id.pnr, kon(p), p.fodd.slice(0, 4), ctx.enheter.get(vardenhetFor(db, kontakt.enhet_id))?.hsa_id ?? '', K.utanPunkt(d.kod), kompakt(d.datum),
      har('C09'), har('C07'), har('C03DA'), har('A10BK'), bt ? String(parseInt(bt.varde, 10) || '') : '', num(senaste('puls')), num(senaste('ntprobnp')), num(senaste('egfr'))]);
  }
}

// Formatkontrollen som den simulerade mottagaren gör: rätt antal fält, inga för långa fält och inget avslutande
// semikolon när sista uppgiften finns.
export function kontrolleraFormat(filer) {
  const fel = [];
  for (const f of filer) {
    const spec = FILER[f.kod].falt;
    f.text.split('\n').filter(Boolean).forEach((rad, i) => {
      const delar = rad.split(';');
      if (delar.length !== spec.length) fel.push(`${f.namn}, rad ${i + 1}: ${delar.length} fält i stället för ${spec.length}.`);
      delar.forEach((v, j) => { if (spec[j] && [...v].length > spec[j][1]) fel.push(`${f.namn}, rad ${i + 1}: ${spec[j][0]} har fler än ${spec[j][1]} tecken.`); });
    });
  }
  return { ok: fel.length === 0, fel };
}

// Skickar rapporten till den simulerade mottagaren. Rader med fel hålls kvar. Varje patient som finns med i filerna
// loggas i åtkomstloggen, så att patienten ser i Min journal att uppgifter har lämnats till registret.
export function skicka(db, personal, rapportId, { nu = new Date() } = {}) {
  const s = sammanstall(db, rapportId, { nu });
  if (!s.format.ok) throw Object.assign(new Error('Filerna följer inte filspecifikationen.'), { format: s.format });
  const r = RAPPORTER[rapportId];
  const kvittens = { id: `SIM-${randomBytes(6).toString('hex').toUpperCase()}`, mottagen: nu.toISOString(), mottagare: r.mottagare,
    text: 'Simulerad mottagare: filerna togs emot och följer filspecifikationen. Inget har lämnat Vårdkällan.' };
  const filer = s.filer.map(f => ({ kod: f.kod, namn: f.namn, antal: f.antal, sha256: f.sha256, ...(f.kod === 'MFR_FV1' ? { idn: f.rader.map(x => x[0]) } : {}) }));
  const ut = db.transaction(() => {
    const id = db.query('INSERT INTO myndighetsrapporter (rapport, period, skickad, av, mottagare, filer, antal, kvarhallna, utelamnade, kvittens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .get(rapportId, `${s.period.fran}/${s.period.till}`, nu.toISOString(), personal.id, r.mottagare, JSON.stringify(filer), JSON.stringify(s.antal), s.kvarhallna,
        JSON.stringify(s.undantag.map(u => ({ nyckel: u.nyckel, antal: u.antal, ingar: u.ingar }))), JSON.stringify(kvittens)).id;
    const grund = rapportId === 'kvalitetsregister' ? 'kvalitetsregister' : 'uppgiftsskyldighet';
    const resurs = `rapport:${rapportId}:${s.period.manad}:${id}`;
    for (const pid of s.patienter) loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: pid, handling: 'myndighetsrapport', resurs, grund, resultat: 'tillaten', tid: nu.toISOString() });
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'myndighetsrapport', resurs, grund, resultat: 'tillaten', tid: nu.toISOString() });
    if (rapportId === 'kvalitetsregister') aterkoppling(db, id, s, nu);
    return id;
  })();
  return { id: ut, kvittens, antal: s.antal, kvarhallna: s.kvarhallna, period: s.period, filer };
}

// Återkopplingen från det simulerade kvalitetsregistret: andelen patienter med RAS-hämmare och betablockerare per
// vårdenhet, jämfört med påhittade jämförelsetal. Den sparas, så att vården kan ta emot data från registret.
function aterkoppling(db, rapportId, s, nu) {
  const rader = s.filer[0].rader;
  const perEnhet = new Map();
  for (const x of rader) {
    const e = perEnhet.get(x[3]) ?? { hsaId: x[3], antal: 0, ras: 0, bb: 0 };
    e.antal++; if (x[6] === '1') e.ras++; if (x[7] === '1') e.bb++;
    perEnhet.set(x[3], e);
  }
  const data = {
    text: 'Återkoppling från det simulerade kvalitetsregistret. Jämförelsetalen är påhittade i demon.',
    jamforelse: { ras: 80, bb: 85 },
    enheter: [...perEnhet.values()].map(e => ({ ...e, namn: db.query('SELECT namn FROM enheter WHERE hsa_id = ?').get(e.hsaId)?.namn ?? e.hsaId, andelRas: Math.round(100 * e.ras / e.antal), andelBb: Math.round(100 * e.bb / e.antal) })),
  };
  db.query('INSERT INTO registeraterkoppling (register, rapport_id, tid, data) VALUES (?, ?, ?, ?)').run(KVALITETSREGISTER, rapportId, nu.toISOString(), JSON.stringify(data));
}

export function historik(db, rapportId = null) {
  sakra(db);
  const rader = rapportId ? db.query('SELECT * FROM myndighetsrapporter WHERE rapport = ? ORDER BY id DESC').all(rapportId) : db.query('SELECT * FROM myndighetsrapporter ORDER BY id DESC').all();
  return rader.map(r => ({ id: r.id, rapport: r.rapport, period: r.period, skickad: r.skickad, av: r.av, mottagare: r.mottagare, filer: JSON.parse(r.filer).map(({ idn, ...f }) => f), antal: JSON.parse(r.antal), kvarhallna: r.kvarhallna, kvittens: JSON.parse(r.kvittens) }));
}
export function senasteAterkoppling(db) {
  sakra(db);
  const r = db.query('SELECT * FROM registeraterkoppling WHERE register = ? ORDER BY id DESC LIMIT 1').get(KVALITETSREGISTER);
  return r ? { tid: r.tid, rapportId: r.rapport_id, ...JSON.parse(r.data) } : null;
}

// Patientens invändning mot registrering i kvalitetsregistret (patientdatalagen 7 kap. 2 §). av är { personalId } när
// vården registrerar den och { invanareId } när patienten själv anmäler den i Min journal.
const aktivInvandning = (db, patientId) => db.query('SELECT * FROM kvalitetsregister_motsatt WHERE patient_id = ? AND register = ? AND aterkallad IS NULL ORDER BY id DESC').get(patientId, KVALITETSREGISTER);
export function invandning(db, patientId) {
  sakra(db);
  const r = aktivInvandning(db, patientId);
  return {
    register: RAPPORTER.kvalitetsregister.namn, motsatt: Boolean(r), registrerad: r?.registrerad ?? null, av: r ? (r.invanare_id ? 'patienten' : 'vården') : null,
    text: 'Uppgifter om patienten lämnas inte till kvalitetsregistret om patienten motsätter sig det (patientdatalagen 7 kap. 2 §). Invändningen kan ångras.',
  };
}
export function motsatt(db, av, patientId, nu = new Date()) {
  sakra(db);
  if (aktivInvandning(db, patientId)) return { redan: true, ...invandning(db, patientId) };
  const personalId = av?.invanareId ? null : av?.personalId ?? av?.id ?? null;
  db.query('INSERT INTO kvalitetsregister_motsatt (patient_id, register, registrerad, registrerad_av, invanare_id) VALUES (?, ?, ?, ?, ?)')
    .run(patientId, KVALITETSREGISTER, nu.toISOString(), personalId, av?.invanareId ?? null);
  return { registrerad: true, ...invandning(db, patientId) };
}
export function aterkalla(db, av, patientId, nu = new Date()) {
  sakra(db);
  const r = aktivInvandning(db, patientId);
  if (!r) return { redan: true, ...invandning(db, patientId) };
  db.query('UPDATE kvalitetsregister_motsatt SET aterkallad = ?, aterkallad_av = ?, aterkallad_av_invanare = ? WHERE id = ?')
    .run(nu.toISOString(), av?.invanareId ? null : av?.personalId ?? av?.id ?? null, av?.invanareId ?? null, r.id);
  return { aterkallad: true, ...invandning(db, patientId) };
}

// Mappningen som gränssnittet visar: varje vårdenhet med sina koder.
export function mappning(db) {
  const enheter = db.query("SELECT id, namn, hsa_id FROM enheter WHERE typ = 'vardenhet' ORDER BY id").all();
  return enheter.map(e => {
    const k = K.ENHETER[e.id];
    return { id: e.id, namn: e.namn, hsaId: e.hsa_id, sjukhus: k?.sjukhus ? K.SJUKHUS[k.sjukhus] : null, mvo: k?.mvo ?? null, mvoText: k?.mvo ? K.MVO[k.mvo] : null,
      akutverksamhet: k?.akut ?? (k ? '0' : null), primarvard: Boolean(k?.primarvard), saknas: !k };
  });
}

// Rättningar i journalen: förslagen till diagnos för en vårdkontakt, ur patientens tidigare diagnoser på samma vårdenhet
// och hälsoärendets kod. Bara koder som går att rapportera föreslås.
export function diagnosforslag(db, vk) {
  const ve = vardenhetFor(db, vk.enhet_id);
  const ut = [];
  const lagg = (kod) => { if (kod && ICD10SE[kod] && !K.ejHuvuddiagnos(kod) && !ut.some(x => x.kod === kod)) ut.push({ kod, text: ICD10SE[kod] }); };
  for (const d of db.query('SELECT kod, enhet_id FROM diagnoser WHERE patient_id = ? ORDER BY datum DESC, id DESC').all(vk.patient_id)) if (vardenhetFor(db, d.enhet_id) === ve) lagg(d.kod);
  if (vk.halsoarende_id) lagg(db.query('SELECT kod FROM halsoarenden WHERE id = ?').get(vk.halsoarende_id)?.kod);
  return ut.slice(0, 3);
}

// Vårdkontakten som en diagnos registreras på. För ett vårdtillfälle är det den senaste vistelsen på vårdenheten med
// det medicinska ansvaret.
export function kontaktForRattning(db, vardkontaktId) {
  const vk = /^\d{1,9}$/.test(String(vardkontaktId)) ? db.query('SELECT * FROM vardkontakter WHERE id = ?').get(Number(vardkontaktId)) : null;
  if (!vk) throw new Fel(404, 'Vårdkontakten finns inte.', 'saknas');
  return vk;
}

// Läkaren registrerar en diagnos eller en yttre orsak på vårdkontakten. Systemet avgör om det är huvud- eller bidiagnos,
// sätter texten ur ICD-10-SE och datumet ur kontakten, och en yttre orsak sätts ihop ur svaren på tre frågor.
export function registreraDiagnos(atk, vk, body = {}) {
  const db = atk.db;
  atk.krav('registrera_diagnos', { resurs: { enhet_id: vk.enhet_id }, beskrivning: `vardkontakt:${vk.id}:diagnos` });
  let kod;
  let text;
  let typ;
  const kontaktIdn = vk.vardtillfalle_id ? db.query('SELECT id FROM vardkontakter WHERE vardtillfalle_id = ?').all(vk.vardtillfalle_id).map(r => r.id) : [vk.id];
  if (body.mekanism != null) {
    const y = K.yttreOrsak(String(body.mekanism), String(body.plats ?? '9'), String(body.aktivitet ?? '9'));
    if (!y) throw new Fel(400, 'Välj vad som hände, var det hände och vad patienten gjorde.', 'ogiltig', { falt: ['mekanism'] });
    ({ kod, text } = y);
    typ = 'bi';
  } else {
    kod = String(body.kod ?? '').trim().toUpperCase();
    text = ICD10SE[kod];
    if (!text) throw new Fel(400, `Koden ${kod || 'saknas'} finns inte bland de koder ur ICD-10-SE som systemet känner till. Välj en kod i listan.`, 'ogiltig', { falt: ['kod'] });
    const harHuvud = diagnoserFor(db, kontaktIdn).some(d => d.typ === 'huvud' && !K.ejHuvuddiagnos(d.kod));
    typ = harHuvud ? 'bi' : 'huvud';
  }
  const finns = diagnoserFor(db, kontaktIdn).find(d => d.kod === kod);
  if (finns) return { id: finns.id, kod, text: finns.text, typ: finns.typ, fanns: true };
  const datum = datumSv(vk.ankomst ?? vk.start);
  const id = db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, 'vardkallan') RETURNING id")
    .get(vk.patient_id, vk.enhet_id, vk.id, kod, text, typ, datum).id;
  atk.logga('registrera_diagnos', atk.grund(), `vardkontakt:${vk.id}:diagnos:${id}`);
  return { id, kod, text, typ };
}

// Valen för en yttre orsak, för dialogen.
export const YTTRE_VAL = {
  mekanism: Object.entries(K.YTTRE_MEKANISM).map(([kod, text]) => ({ kod, text })),
  plats: Object.entries(K.YTTRE_PLATS).map(([kod, text]) => ({ kod, text })),
  aktivitet: Object.entries(K.YTTRE_AKTIVITET).map(([kod, text]) => ({ kod, text })),
  forval: { mekanism: 'W19', plats: '9', aktivitet: '9' },
};
// Diagnoserna som går att välja när förslaget inte passar.
export const DIAGNOSLISTA = Object.entries(ICD10SE).filter(([kod]) => !K.ejHuvuddiagnos(kod)).map(([kod, text]) => ({ kod, text }));

// Demoläget för rättningarna i inkorgen (POST /api/demo/rapportfel, i den egna sandlådan, för genomgången och
// användartestet): ett avslutat vårdtillfälle på kardiologen utan huvuddiagnos och ett besök på akutmottagningen med en
// skada utan yttre orsak, båda i patientregistrets period.
export function demoRapportfel(db, nu = new Date()) {
  const dag = `${period('par', nu).manad}-10`;
  const t = (d, klocka) => new Date(`${d}T${klocka}:00+01:00`).toISOString();
  const vt = Number(db.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, utskriven, orsak) VALUES ('p01', 'uso-kard', ?, ?, 'Demo: vårdtillfälle utan huvuddiagnos')").run(t(dag, '10:00'), t(dag.slice(0, 8) + '12', '11:00')).lastInsertRowid);
  const vk = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, slut, vardtillfalle_id, orsak) VALUES ('p01', 'uso-kard-72', 'slutenvard', ?, ?, ?, 'Demo: vårdtillfälle utan huvuddiagnos')").run(t(dag, '10:00'), t(dag.slice(0, 8) + '12', '11:00'), vt).lastInsertRowid);
  const akut = Number(db.query("INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, orsak) VALUES ('p05', 'uso-akut', 'akut', 'besok', ?, ?, 'Demo: knäskada')").run(t(dag, '14:00'), t(dag, '17:00')).lastInsertRowid);
  db.query("INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum) VALUES ('p05', 'uso-akut', ?, 'S83.5', ?, 'huvud', ?)").run(akut, ICD10SE['S83.5'], dag);
  return { vardtillfalleId: vt, vardkontaktId: vk, akutId: akut };
}

// Sammanställningen för inkorgen, som hämtas ofta. Den sparas och görs om när någon tabell som rapporterna läser har
// ändrats, när en ny tabell har tillkommit eller när månaden har bytts. Ändringarna räknas av tillfälliga triggrar
// (TEMP), som bara finns i sandlådans anslutning och aldrig följer med när databasen sparas. Den sparade
// sammanställningen används bara för rapportens innehåll. Behörigheten i inkorgen prövas alltid mot databasen.
export const LASTA_TABELLER = ['vardtillfallen', 'vardtillfalle_handelser', 'vardkontakter', 'diagnoser', 'atgarder', 'anteckningar', 'vantelista',
  'bokningar', 'tider', 'scheman', 'patienter', 'identiteter', 'listningar', 'sparrar', 'enheter', 'personal', 'remisser', 'tvangsvard_perioder',
  'tvangsvard_handelser', 'administreringar', 'katalog', 'ordinationer', 'matvarden', 'halsoarenden', 'kvalitetsregister_motsatt', 'myndighetsrapporter'];
const CACHE = new WeakMap();
function sakraRaknare(db) {
  db.exec('CREATE TEMP TABLE IF NOT EXISTS rapport_andring (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL); INSERT OR IGNORE INTO temp.rapport_andring VALUES (1, 0);');
  for (const t of LASTA_TABELLER) {
    if (!finnsTabell(db, t)) continue;
    for (const h of ['INSERT', 'UPDATE', 'DELETE']) db.exec(`CREATE TEMP TRIGGER IF NOT EXISTS rapport_andring_${t}_${h.toLowerCase()} AFTER ${h} ON main.${t} BEGIN UPDATE temp.rapport_andring SET n = n + 1; END`);
  }
}
function avtryck(db, nu) {
  sakraRaknare(db);
  const n = db.query('SELECT n FROM temp.rapport_andring WHERE id = 1').get().n;
  const tabeller = db.query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get().n;
  return `${manadAv(nu)}|${n}|${tabeller}`;
}
export function sammanstallCachad(db, rapportId, { nu = new Date() } = {}) {
  sakra(db);
  const nyckel = avtryck(db, nu);
  let m = CACHE.get(db);
  if (!m) { m = new Map(); CACHE.set(db, m); }
  const c = m.get(rapportId);
  if (c?.nyckel === nyckel) return c.s;
  const s = sammanstall(db, rapportId, { nu });
  m.set(rapportId, { nyckel, s });
  return s;
}

// Felets aktuella vårdenhet och patient, ur databasen, och alla enheter vars uppgifter felet bygger på. Ett fel för ett
// vårdtillfälle (VT och F-VT) slås alltid upp ur vårdtillfället: den ansvariga vårdenheten är vårdtillfällets, och
// enheterna är vårdtillfällets, varje kontakts och varje diagnos på kontakterna. Bara ett fel från en enda kontakt
// (VK) slås upp ur vårdkontakten. Inkorgen prövar behörigheten mot detta och aldrig mot den sparade sammanställningen.
export function aktuellPlats(db, f) {
  const m = /^(F-VT|VT|VK|VL|TV)(\d+)$/.exec(f.radNyckel ?? '');
  if (!m) return null;
  const id = Number(m[2]);
  let rad;
  let enheter;
  if (m[1] === 'VT' || m[1] === 'F-VT') {
    rad = db.query('SELECT patient_id, enhet_id FROM vardtillfallen WHERE id = ?').get(id);
    if (!rad) return null;
    const kontakter = db.query('SELECT id, enhet_id FROM vardkontakter WHERE vardtillfalle_id = ?').all(id);
    enheter = [rad.enhet_id, ...kontakter.map(k => k.enhet_id), ...diagnoserFor(db, kontakter.map(k => k.id)).map(d => d.enhet_id)];
  } else if (m[1] === 'VK') {
    rad = db.query('SELECT patient_id, enhet_id FROM vardkontakter WHERE id = ?').get(id);
    if (!rad) return null;
    enheter = [rad.enhet_id, ...diagnoserFor(db, [id]).map(d => d.enhet_id)];
  } else {
    rad = db.query(`SELECT patient_id, enhet_id FROM ${m[1] === 'VL' ? 'vantelista' : 'tvangsvard_perioder'} WHERE id = ?`).get(id);
    if (!rad) return null;
    enheter = [rad.enhet_id];
  }
  const p = db.query('SELECT id, sammanslagen_till FROM patienter WHERE id = ?').get(rad.patient_id);
  if (!p || p.sammanslagen_till) return null;
  return { patientId: p.id, enhetId: rad.enhet_id, vardenhet: vardenhetFor(db, rad.enhet_id), enheter: [...new Set(enheter)] };
}
