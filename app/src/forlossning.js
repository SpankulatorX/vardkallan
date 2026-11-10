// Förlossningen och BB (runda 11, r3, Sussa 4.7.1.1 och 4.7.1.3): CTG från simulerad utrustning med systemets analys
// och barnmorskans dokumenterade bedömning, smärtlindringen med kontroller före EDA och spinal, den elektroniska
// födelseanmälan till Skatteverket (simulerad) som ger barnet ett personnummer, BB-journalen för mor och barn med
// kontroller, screening och utskrivning, och förlossningens översikt över pågående förlossningar och BB.
//
// Systemet är experten:
//   - CTG-kurvan kommer från utrustningen. Systemet räknar basalfrekvens, variabilitet, accelerationer och
//     decelerationer, klassar kurvan och säger vad som ska göras och när nästa bedömning ska göras. Barnmorskan
//     bekräftar bedömningen med ett klick, eller skriver varför hon bedömer annorlunda. Vid flerbörd har varje foster
//     en egen kanal.
//   - Före EDA och spinalbedövning kontrollerar systemet trombocyterna och pågående behandling med heparin bland det som
//     den inloggade får se.
//   - Födelseanmälan fylls i av systemet ur förlossningsjournalen. Skatteverket (simulerat) svarar med barnets
//     personnummer, som ersätter reservnumret.
//   - På BB räknar systemet barnets viktnedgång från födelsevikten, varnar för feber, blödning, gulsot och för få
//     måltider, säger när PKU-provet får tas och prövar utskrivningskriterierna för mor och barn.
//
// Klassningen av CTG och gränserna är demoregler med svensk CTG-klassificering som förebild, inte ett kliniskt
// beslutsstöd. Utrustningen och Skatteverket är simulerade.
import { Fel, datumAv, lokalTid, addDagar } from './db.js';
import { Atkomst, vardenhetFor, enheterUnder, visningsnamn } from './atkomst.js';
import * as identitet from './identitet.js';
import * as obs from './obstetrik.js';
import { tabell, finns, personNamn, enhetKort, iso, MIN, TIMME, matvarde, lasRad, andraRad, textFalt, loggaPatient, SAKNAS } from './specialist-hjalp.js';
import testpnr from './seed/testpersonnummer.json' with { type: 'json' };

const lasJson = (s, standard) => { try { return JSON.parse(s) ?? standard; } catch { return standard; } };
const andraForl = (atk, f) => andraRad(atk, f, 'graviditet', 'las_graviditet', 'Förlossningsjournalen förs av förlossningens vårdenhet.');
export const DEMOREGEL = 'Demoregel, inte ett kliniskt beslutsstöd. CTG-klassningen och gränserna är förenklade, och utrustningen och Skatteverket är simulerade.';

// ---- CTG ---------------------------------------------------------------------------------------------------------------

export const CTG_KLASS = tabell({ normal: 'Normalt CTG', avvikande: 'Avvikande CTG', patologiskt: 'Patologiskt CTG' });
const ORDNING = { normal: 0, avvikande: 1, patologiskt: 2 };
export const CTG_FORLOPP = tabell({ normal: 'Normalt förlopp', avvikande: 'Takykardi', patologiskt: 'Sena decelerationer och nedsatt variabilitet' });
export const CTG_GORA = {
  normal: 'Fortsätt övervakningen. Nästa bedömning om 30 minuter.',
  avvikande: 'Leta efter orsaken (läge, vätska, feber, värkstimulering) och åtgärda den. Informera förlossningsläkaren och bedöm igen inom 15 minuter.',
  patologiskt: 'Tillkalla förlossningsläkaren nu. Stäng av värkstimuleringen och överväg skalpelektrod och laktat från barnets skalp eller att förlösa.',
};
export const CTG_INTERVALL_MIN = { normal: 30, avvikande: 15, patologiskt: 15 };
export const UTRUSTNING = 'CTG-monitor CTG-SIM-1 (simulerad)';
const STEG_S = 15;
const FONSTER_MIN = 30;

// Den simulerade monitorn: fosterljud och värkar var 15:e sekund, beräknade ur tiden sedan kopplingen och förloppet,
// så att samma tid alltid ger samma kurva. Foster 2 vid flerbörd har ett eget normalt förlopp.
function fhrVid(t, forlopp, foster) {
  const fas = (t % 180) / 180;
  const fro = foster * 1.7;
  const bas = foster > 1 ? 128 : forlopp === 'avvikande' ? 158 : forlopp === 'patologiskt' ? 140 : 135;
  const amp = foster > 1 ? 6 : forlopp === 'patologiskt' ? 1.2 : 7;
  let v = bas + amp * (0.6 * Math.sin(t / 7.3 + fro) + 0.4 * Math.sin(t / 2.9 + 2 * fro));
  if ((forlopp === 'normal' || foster > 1) && (t % 600) < 60) v += 26 * Math.sin(Math.PI * (t % 600) / 60);
  if (forlopp === 'patologiskt' && foster === 1 && fas >= 0.33 && fas <= 0.67) v -= 25 * Math.sin(Math.PI * (fas - 0.33) / 0.34);
  return Math.round(v);
}
const tokoVid = (t) => { const fas = (t % 180) / 180; return Math.round(fas < 0.4 ? 10 + 55 * Math.sin(Math.PI * fas / 0.4) : 10); };

export function kurva(k, antalFoster, nu) {
  const slut = Math.min(nu.getTime(), k.slut ? Date.parse(k.slut) : Infinity);
  const start = Math.max(Date.parse(k.start), slut - FONSTER_MIN * MIN);
  const punkter = [];
  for (let ms = start; ms <= slut; ms += STEG_S * 1000) {
    const t = Math.round((ms - Date.parse(k.start)) / 1000);
    punkter.push({ tid: iso(ms), fhr: Array.from({ length: antalFoster }, (_, i) => fhrVid(t, k.forlopp, i + 1)), toko: tokoVid(t) });
  }
  return punkter;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
// Episoder där kurvan ligger mer än 15 slag från basalfrekvensen i minst 15 sekunder.
function episoder(punkter, idx, basal, under) {
  const ut = [];
  let pa = null;
  punkter.forEach((p, i) => {
    const av = under ? p.fhr[idx] < basal - 15 : p.fhr[idx] > basal + 15;
    if (av) pa = pa ?? { fran: i, till: i };
    if (av) pa.till = i;
    if ((!av || i === punkter.length - 1) && pa) { if (pa.till - pa.fran >= 1) ut.push(pa); pa = null; }
  });
  return ut;
}

// Analysen per foster av de senaste 30 minuterna.
export function analys(punkter, antalFoster) {
  return Array.from({ length: antalFoster }, (_, idx) => {
    if (punkter.length < 8) return { foster: idx + 1, klass: null, text: 'Kurvan är för kort för en bedömning. Vänta några minuter.' };
    const basal = median(punkter.map(p => p.fhr[idx]));
    const dec = episoder(punkter, idx, basal, true);
    const acc = episoder(punkter, idx, basal, false);
    // En deceleration är sen när dess lägsta punkt kommer efter att värken har gått över.
    const sena = dec.filter(e => {
      let lagst = e.fran;
      for (let i = e.fran; i <= e.till; i++) if (punkter[i].fhr[idx] < punkter[lagst].fhr[idx]) lagst = i;
      return punkter[lagst].toko <= 15;
    }).length;
    const iDec = new Set(dec.flatMap(e => Array.from({ length: e.till - e.fran + 1 }, (_, i) => e.fran + i)));
    const minuter = [];
    for (let i = 0; i + 4 <= punkter.length; i += 4) {
      if ([0, 1, 2, 3].some(j => iDec.has(i + j))) continue;
      const v = punkter.slice(i, i + 4).map(p => p.fhr[idx]);
      minuter.push(Math.max(...v) - Math.min(...v));
    }
    const variabilitet = median(minuter) ?? 0;
    const skal = [];
    let klass = 'normal';
    const satt = (k, t) => { skal.push(t); if (ORDNING[k] > ORDNING[klass]) klass = k; };
    if (basal < 100 || basal > 170) satt('patologiskt', `Basalfrekvensen ${basal} slag per minut ligger utanför 100 till 170.`);
    else if (basal < 110 || basal > 150) satt('avvikande', `Basalfrekvensen ${basal} slag per minut ligger utanför 110 till 150.`);
    if (variabilitet < 3) satt('patologiskt', `Variabiliteten är ${variabilitet} slag per minut, under 3.`);
    else if (variabilitet < 5 || variabilitet > 25) satt('avvikande', `Variabiliteten är ${variabilitet} slag per minut, utanför 5 till 25.`);
    if (sena >= 2) satt('patologiskt', `${sena} sena decelerationer efter värkarna.`);
    else if (dec.length) satt('avvikande', `${dec.length === 1 ? 'En deceleration' : `${dec.length} decelerationer`}.`);
    return { foster: idx + 1, basal, variabilitet, accelerationer: acc.length, decelerationer: dec.length, sena, klass, klassText: CTG_KLASS[klass],
      text: skal.length ? skal.join(' ') : `Basalfrekvens ${basal}, variabilitet ${variabilitet}, ${acc.length ? `${acc.length} accelerationer` : 'inga accelerationer'} och inga decelerationer.`,
      gora: CTG_GORA[klass] };
  });
}
const varst = (a) => a.filter(x => x.klass).reduce((k, x) => (ORDNING[x.klass] > ORDNING[k] ? x.klass : k), 'normal');

const aktivKoppling = (db, f) => db.query('SELECT * FROM ctg_koppling WHERE forlossning_id = ? AND slut IS NULL ORDER BY id DESC').get(f.id);
const antalFor = (db, f) => obs.graviditetRad(db, f.graviditet_id).antal_foster;

export function ctgUt(db, f, nu = new Date()) {
  const k = aktivKoppling(db, f);
  const bed = db.query('SELECT * FROM ctg_bedomning WHERE forlossning_id = ? ORDER BY tid DESC, id DESC').all(f.id).map(b => ({
    id: b.id, tid: b.tid, klass: b.klass, klassText: CTG_KLASS[b.klass], forslag: b.forslag, avvekFranForslag: b.klass !== b.forslag, atgard: b.atgard, motivering: b.motivering, av: personNamn(db, b.av) }));
  if (!k) return { kopplad: false, bedomningar: bed, demoregel: DEMOREGEL };
  const antal = antalFor(db, f);
  const punkter = kurva(k, antal, nu);
  const a = analys(punkter, antal);
  const klass = varst(a);
  const senast = bed[0]?.tid ?? null;
  const nasta = iso(Date.parse(senast ?? k.start) + (senast ? CTG_INTERVALL_MIN[bed[0].klass] : 15) * MIN);
  return { kopplad: true, utrustning: k.utrustning, start: k.start, forlopp: k.forlopp, antalFoster: antal, punkter, analys: a, klass, klassText: CTG_KLASS[klass], gora: CTG_GORA[klass],
    nastaBedomning: nasta, forsenad: Date.parse(nasta) < nu.getTime(), bedomningar: bed, demoregel: DEMOREGEL };
}

export function ctgKoppla(atk, f, body = {}, nu = new Date()) {
  andraForl(atk, f);
  if (f.status !== 'pagaende') throw new Fel(409, 'Förlossningen är avslutad.', 'ogiltig');
  if (aktivKoppling(atk.db, f)) throw new Fel(409, 'CTG är redan kopplad.', 'ogiltig');
  const forlopp = body.forlopp ?? 'normal';
  if (!finns(CTG_FORLOPP, forlopp)) throw new Fel(400, 'Förloppet för den simulerade monitorn finns inte.', 'ogiltig', { falt: ['forlopp'] });
  atk.db.query('INSERT INTO ctg_koppling (forlossning_id, patient_id, enhet_id, start, utrustning, forlopp, av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(f.id, f.patient_id, f.enhet_id, iso(nu), UTRUSTNING, forlopp, atk.personal.id);
  return { ...ctgUt(atk.db, f, nu), text: `CTG är kopplad till ${UTRUSTNING}. Systemet analyserar kurvan.` };
}

export function ctgBedomning(atk, f, body = {}, nu = new Date()) {
  andraForl(atk, f);
  if (f.status !== 'pagaende') throw new Fel(409, 'Förlossningen är avslutad.', 'ogiltig');
  const u = ctgUt(atk.db, f, nu);
  if (!u.kopplad) throw new Fel(409, 'Koppla CTG först. Systemet behöver kurvan för bedömningen.', 'ogiltig');
  if (u.analys.some(a => !a.klass)) throw new Fel(409, 'Kurvan är för kort för en bedömning. Vänta några minuter.', 'ogiltig');
  const klass = body.klass ?? u.klass;
  if (!finns(CTG_KLASS, klass)) throw new Fel(400, 'Klassningen finns inte.', 'ogiltig', { falt: ['klass'] });
  const motivering = textFalt(body.motivering, 500);
  if (klass !== u.klass && motivering.length < 5) throw new Fel(400, `Systemet klassar kurvan som ${CTG_KLASS[u.klass].toLowerCase()}. Skriv varför du bedömer den annorlunda.`, 'ogiltig', { falt: ['motivering'] });
  const atgard = textFalt(body.atgard, 500) || CTG_GORA[klass];
  atk.db.query('INSERT INTO ctg_bedomning (forlossning_id, patient_id, enhet_id, tid, klass, forslag, analys, atgard, motivering, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(f.id, f.patient_id, atk.personal.enhet_id, iso(nu), klass, u.klass, JSON.stringify(u.analys.map(({ gora, ...x }) => x)), atgard, motivering || null, atk.personal.id);
  return { ...ctgUt(atk.db, f, nu), varning: klass === 'patologiskt' ? 'Patologiskt CTG. Tillkalla förlossningsläkaren nu.' : null,
    text: `Bedömningen är dokumenterad: ${CTG_KLASS[klass].toLowerCase()}. Nästa bedömning om ${CTG_INTERVALL_MIN[klass]} minuter.` };
}

// ---- Smärtlindring -----------------------------------------------------------------------------------------------------

export const SMARTLINDRING = obs.SMARTLINDRING;
const REGIONAL = ['eda', 'spinal'];
export const TPK_GRANS = 80;

// Det som behöver kontrolleras före EDA och spinal, bland det som den inloggade får se.
export function foreRegional(atk) {
  const db = atk.db;
  const tpk = atk.filtrera(db.query("SELECT * FROM matvarden WHERE patient_id = ? AND typ = 'tpk' ORDER BY tid DESC").all(atk.patientId), 'las_matvarden')[0] ?? null;
  const heparin = atk.filtrera(db.query(`SELECT o.*, k.namn AS lnamn FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id WHERE o.patient_id = ? AND o.status = 'aktiv' AND k.atc LIKE 'B01AB%'`).all(atk.patientId), 'las_lakemedel', { gemensam: true });
  const hinder = [];
  if (!tpk) hinder.push('Trombocyterna är inte tagna. Ta blodstatus innan EDA eller spinal läggs.');
  else if (Number(tpk.varde_num ?? tpk.varde) < TPK_GRANS) hinder.push(`Trombocyterna är ${tpk.varde_num ?? tpk.varde}, under ${TPK_GRANS}. Anestesiläkaren bedömer om bedövningen kan läggas.`);
  if (heparin.length) hinder.push(`Patienten har heparin (${heparin.map(o => o.lnamn).join(', ')}). Anestesiläkaren bedömer när den senaste dosen gavs innan bedövningen läggs.`);
  return { tpk: tpk ? { varde: tpk.varde_num ?? Number(tpk.varde), tid: tpk.tid } : null, heparin: heparin.length > 0, hinder };
}

export function smartlindring(atk, f, body = {}, nu = new Date()) {
  const db = atk.db;
  andraForl(atk, f);
  if (f.status !== 'pagaende') throw new Fel(409, 'Förlossningen är avslutad.', 'ogiltig');
  const metod = body.metod;
  if (!finns(SMARTLINDRING, metod)) throw new Fel(400, 'Välj smärtlindring i listan.', 'ogiltig', { falt: ['metod'] });
  const varningar = [];
  if (REGIONAL.includes(metod)) {
    const k = foreRegional(atk);
    if (k.hinder.length && body.anestesiBedomd !== true) {
      throw new Fel(409, `${k.hinder.join(' ')} Registrera bedövningen när anestesiläkaren har bedömt patienten.`, 'kontroll', { hinder: k.hinder });
    }
    if (k.hinder.length) varningar.push(`Anestesiläkaren har bedömt patienten trots: ${k.hinder.join(' ')}`);
    const opp = db.query('SELECT max(oppning) AS o FROM partogram WHERE forlossning_id = ?').get(f.id).o;
    if (metod === 'eda' && opp != null && opp >= 9) varningar.push(`Modermunnen är öppen ${opp} cm. En EDA hinner sällan verka innan barnet föds.`);
  }
  db.query('INSERT INTO smartlindring (forlossning_id, patient_id, enhet_id, tid, metod, varningar, av) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(f.id, f.patient_id, atk.personal.enhet_id, iso(nu), metod, JSON.stringify(varningar), atk.personal.id);
  return { smartlindring: smartlindringUt(db, f), varningar, text: `${SMARTLINDRING[metod]} är registrerad.` };
}
export const smartlindringUt = (db, f) => db.query('SELECT * FROM smartlindring WHERE forlossning_id = ? ORDER BY tid, id').all(f.id)
  .map(s => ({ id: s.id, tid: s.tid, metod: s.metod, text: SMARTLINDRING[s.metod], varningar: lasJson(s.varningar, []), av: personNamn(db, s.av) }));

// ---- Födelseanmälan till Skatteverket (simulerad) -----------------------------------------------------------------------

export const MOTTAGARE_SKV = 'Skatteverket (simulerad mottagare)';
// Ett ledigt testpersonnummer med barnets kön, så nära födelseåret som möjligt. Skatteverkets testpersonnummer finns
// bara för vissa födelsedagar, så datumet i numret stämmer inte med barnets födelsedag i demon.
export function tilldelaPersonnummer(db, { kon, fodd }) {
  const anvanda = new Set([...db.query('SELECT personnummer FROM patienter').all().map(r => r.personnummer), ...db.query('SELECT varde FROM identiteter').all().map(r => r.varde)]);
  const ar = Number(fodd.slice(0, 4));
  const pnr = testpnr.filter(p => !anvanda.has(p) && (Number(p[10]) % 2 === 1) === (kon === 'man'))
    .sort((a, b) => Math.abs(Number(a.slice(0, 4)) - ar) - Math.abs(Number(b.slice(0, 4)) - ar) || b.localeCompare(a))[0];
  if (!pnr) throw new Fel(409, 'Det finns inga lediga testpersonnummer i demon.', 'ogiltig');
  return pnr;
}
const anmalanUt = (db, a) => (a ? { id: a.id, tid: a.tid, status: a.status, kvittens: a.kvittens, personnummer: a.personnummer ? identitet.formatera('personnummer', a.personnummer) : null, text: a.text, av: personNamn(db, a.av), mottagare: MOTTAGARE_SKV } : null);

export function fodelseanmalan(atk, f, body = {}, nu = new Date()) {
  const db = atk.db;
  andraForl(atk, f);
  const ordning = Number(body.ordning ?? 1);
  const b = db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? AND ordning = ?').get(f.id, ordning);
  if (!b) throw new Fel(404, 'Barnet är inte registrerat i förlossningen.', 'saknas');
  if (db.query('SELECT 1 FROM fodelseanmalan WHERE barn_patient_id = ?').get(b.barn_patient_id)) throw new Fel(409, 'Födelseanmälan för barnet är redan skickad.', 'ogiltig');
  const mor = db.query('SELECT * FROM patienter WHERE id = ?').get(f.patient_id);
  const barn = db.query('SELECT * FROM patienter WHERE id = ?').get(b.barn_patient_id);
  const t = iso(nu);
  const n = db.query('SELECT count(*) AS n FROM fodelseanmalan').get().n + 1;
  const kvittens = `SKV-SIM-${String(n).padStart(6, '0')}`;
  let status, pnr = null, text;
  if ((mor.id_typ ?? 'personnummer') !== 'personnummer') {
    status = 'ej_folkbokford';
    text = 'Modern har inget personnummer och är inte folkbokförd. Skatteverket tar emot anmälan men ger barnet inget personnummer, så barnet behåller reservnumret.';
  } else {
    pnr = tilldelaPersonnummer(db, { kon: barn.kon, fodd: barn.fodd });
    const tolkat = identitet.tolka(pnr);
    db.transaction(() => {
      // Födelsedatumet i journalen är barnets riktiga födelsedag, inte datumet i testpersonnumret.
      identitet.nyIdentitet(db, barn, { ...tolkat, fodd: null }, { personal: atk.personal, tid: t });
    })();
    status = 'kvitterad';
    text = `Skatteverket har tagit emot födelseanmälan och gett barnet personnumret ${identitet.formatera('personnummer', pnr)} (ett av Skatteverkets testpersonnummer i demon). Reservnumret finns kvar som tidigare identitet.${mor.skyddad ? ' Moderns skyddade personuppgifter gäller också barnet.' : ''}`;
  }
  db.query('INSERT INTO fodelseanmalan (forlossning_id, patient_id, barn_patient_id, enhet_id, tid, status, kvittens, personnummer, text, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(f.id, f.patient_id, b.barn_patient_id, atk.personal.enhet_id, t, status, kvittens, pnr, text, atk.personal.id);
  // Identiteten ändras på barnets journal, och det loggas där.
  const ab = new Atkomst(db, atk.personal, b.barn_patient_id, {}, 'registrera_patient');
  ab.logga('registrera_patient', ab.grund(), `fodelseanmalan:${kvittens}`);
  return { anmalan: anmalanUt(db, db.query('SELECT * FROM fodelseanmalan WHERE barn_patient_id = ?').get(b.barn_patient_id)), text };
}

// ---- BB-journalen ------------------------------------------------------------------------------------------------------

export const BB_MOR = { blodning: tabell({ normal: 'Normal', riklig: 'Riklig' }), livmoder: tabell({ fast: 'Fast och väl kontraherad', mjuk: 'Mjuk' }),
  amning: tabell({ fungerar: 'Fungerar', stod: 'Behöver stöd', ej_aktuellt: 'Ammar inte' }), stamning: tabell({ bra: 'Bra', nedstamd: 'Nedstämd eller orolig' }) };
export const BB_BARN = { andning: tabell({ ua: 'Utan anmärkning', anstrangd: 'Ansträngd' }), hudfarg: tabell({ normal: 'Normal', gulaktig: 'Gulaktig', blek: 'Blek eller grå' }) };
export const SCREENING = tabell({ kvitamin: 'K-vitamin', pulsoximetri: 'Pulsoximetri', horsel: 'Hörselscreening', barnlakare: 'Barnläkarundersökning', pku: 'PKU-prov' });
export const SCREENING_RESULTAT = tabell({ ua: 'Utan anmärkning', avvikande: 'Avvikande, åtgärd planerad', given: 'Given' });
export const PKU_TIMMAR = 48;
export const VIKTNEDGANG_GRANS = 10;

// Vem patienten är på BB: modern i en förlossning eller ett barn som föddes i en.
function bbRad(atk) {
  const db = atk.db;
  const barn = db.query('SELECT * FROM forlossning_barn WHERE barn_patient_id = ?').get(atk.patientId);
  if (barn) {
    atk.krav('las_graviditet', { resurs: { enhet_id: barn.enhet_id } });
    return { vem: 'barn', barn, f: obs.forlossningRad(db, barn.forlossning_id) };
  }
  const f = atk.filtrera(db.query("SELECT * FROM forlossningar WHERE patient_id = ? AND status = 'avslutad' ORDER BY avslutad DESC").all(atk.patientId), 'las_graviditet')[0];
  if (!f) throw new Fel(404, 'Patienten har ingen förlossning på BB.', 'saknas');
  return { vem: 'mor', f };
}
const utskriven = (db, f) => db.query('SELECT * FROM bb_utskrivning WHERE forlossning_id = ?').get(f.id);
const kravBbEnhet = (atk, f) => {
  atk.krav('graviditet');
  if (vardenhetFor(atk.db, atk.personal.enhet_id) !== vardenhetFor(atk.db, f.enhet_id)) throw new Fel(403, 'BB-journalen förs av förlossningens vårdenhet.', 'nekad');
};
const valFran = (t, v, falt, text) => { if (v == null || v === '') return null; if (!finns(t, v)) throw new Fel(400, text, 'ogiltig', { falt: [falt] }); return v; };
const talFran = (v, falt, min, max, text) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new Fel(400, text, 'ogiltig', { falt: [falt] });
  return n;
};

export function bbKontroll(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  obs.sakra(db);
  const { vem, barn, f } = bbRad(atk);
  kravBbEnhet(atk, f);
  if (utskriven(db, f)) throw new Fel(409, 'Mor och barn är utskrivna från BB.', 'ogiltig');
  const t = iso(nu);
  const varningar = [];
  let varden;
  if (vem === 'mor') {
    const bt = body.blodtryck ? String(body.blodtryck).trim() : null;
    if (bt && !/^\d{2,3}\/\d{2,3}$/.test(bt)) throw new Fel(400, 'Blodtryck anges som systoliskt/diastoliskt, till exempel 120/80.', 'ogiltig', { falt: ['blodtryck'] });
    varden = {
      temp: talFran(body.temp, 'temp', 34, 42, 'Temperaturen anges i grader, 34 till 42.'), puls: talFran(body.puls, 'puls', 30, 220, 'Pulsen anges i slag per minut.'), blodtryck: bt,
      blodning: valFran(BB_MOR.blodning, body.blodning, 'blodning', 'Blödningen finns inte i listan.'), livmoder: valFran(BB_MOR.livmoder, body.livmoder, 'livmoder', 'Livmodern finns inte i listan.'),
      urinerat: body.urinerat == null ? null : body.urinerat === true, smarta: talFran(body.smarta, 'smarta', 0, 10, 'Smärtan anges 0 till 10.'),
      amning: valFran(BB_MOR.amning, body.amning, 'amning', 'Amningen finns inte i listan.'), stamning: valFran(BB_MOR.stamning, body.stamning, 'stamning', 'Stämningsläget finns inte i listan.'),
    };
    if (Object.values(varden).every(v => v == null)) throw new Fel(400, 'Fyll i minst ett värde.', 'ogiltig', { falt: ['temp'] });
    const [sys, dia] = bt ? bt.split('/').map(Number) : [null, null];
    if (varden.temp != null && varden.temp >= 38) varningar.push(`Feber ${String(varden.temp).replace('.', ',')} grader efter förlossningen. Kontakta läkare: risk för infektion i livmodern, brösten eller urinvägarna.`);
    if (varden.blodning === 'riklig' || varden.livmoder === 'mjuk') varningar.push('Risk för blödning: massera livmodern, mät blödningen och tillkalla läkare.');
    if ((varden.puls != null && varden.puls > 110) || (sys != null && sys < 90)) varningar.push('Påverkad puls eller lågt blodtryck. Kontrollera blödningen och tillkalla läkare.');
    if (sys != null && (sys >= 140 || dia >= 90)) varningar.push('Förhöjt blodtryck efter förlossningen. Kontrollera protein i urinen och kontakta läkare.');
    if (varden.urinerat === false && nu.getTime() - Date.parse(f.avslutad) > 6 * TIMME) varningar.push('Hon har inte kissat på sex timmar sedan förlossningen. Mät blåsan med ultraljud.');
    if (varden.smarta != null && varden.smarta >= 7) varningar.push('Svår smärta. Bedöm orsaken och ge smärtlindring enligt ordination.');
    if (varden.stamning === 'nedstamd') varningar.push('Hon är nedstämd eller orolig. Ta dig tid för ett samtal och informera mödrahälsovården inför efterkontrollen.');
    db.transaction(() => {
      if (varden.temp != null) matvarde(atk, 'temp', varden.temp, t);
      if (varden.puls != null) matvarde(atk, 'puls', varden.puls, t);
      if (bt) matvarde(atk, 'blodtryck', bt, t);
    })();
  } else {
    const vikt = talFran(body.vikt, 'vikt', 300, 7000, 'Vikten anges i hela gram, 300 till 7 000.');
    if (vikt != null && !Number.isInteger(vikt)) throw new Fel(400, 'Vikten anges i hela gram.', 'ogiltig', { falt: ['vikt'] });
    varden = {
      vikt, temp: talFran(body.temp, 'temp', 34, 41, 'Temperaturen anges i grader, 34 till 41.'),
      andning: valFran(BB_BARN.andning, body.andning, 'andning', 'Andningen finns inte i listan.'), hudfarg: valFran(BB_BARN.hudfarg, body.hudfarg, 'hudfarg', 'Hudfärgen finns inte i listan.'),
      maltider: talFran(body.maltider, 'maltider', 0, 20, 'Antalet måltider det senaste dygnet anges 0 till 20.'),
      urin: body.urin == null ? null : body.urin === true, avforing: body.avforing == null ? null : body.avforing === true,
    };
    if (Object.values(varden).every(v => v == null)) throw new Fel(400, 'Fyll i minst ett värde.', 'ogiltig', { falt: ['vikt'] });
    if (vikt != null) {
      const ned = Math.round(((barn.vikt - vikt) / barn.vikt) * 1000) / 10;
      varden.viktnedgang = ned;
      if (ned >= VIKTNEDGANG_GRANS) varningar.push(`Barnet har gått ner ${String(ned).replace('.', ',')} procent från födelsevikten ${barn.vikt} g. Kontrollera amningen, ge tillägg enligt rutin och kontakta barnläkaren.`);
      else if (ned >= 7) varningar.push(`Barnet har gått ner ${String(ned).replace('.', ',')} procent. Stöd amningen och väg igen i morgon.`);
    }
    if (varden.temp != null && (varden.temp < 36.5 || varden.temp > 37.5)) varningar.push(`Temperaturen ${String(varden.temp).replace('.', ',')} ligger utanför 36,5 till 37,5. ${varden.temp < 36.5 ? 'Hud mot hud och mät igen om en timme.' : 'Kontakta barnläkaren: risk för infektion.'}`);
    if (varden.andning === 'anstrangd') varningar.push('Ansträngd andning. Tillkalla barnläkaren nu.');
    if (varden.hudfarg === 'gulaktig') varningar.push('Barnet är gulaktigt. Mät bilirubinet i huden och kontakta barnläkaren om värdet ligger över gränsen för åldern i timmar.');
    if (varden.hudfarg === 'blek') varningar.push('Blek eller grå hudfärg. Tillkalla barnläkaren nu.');
    if (varden.maltider != null && varden.maltider < 8) varningar.push('Färre än åtta måltider det senaste dygnet. Väck barnet för mat och stöd amningen.');
    db.transaction(() => {
      if (vikt != null) matvarde(atk, 'vikt', vikt / 1000, t);
      if (varden.temp != null) matvarde(atk, 'temp', varden.temp, t);
    })();
  }
  db.query('INSERT INTO bb_kontroller (patient_id, enhet_id, forlossning_id, vem, tid, varden, varningar, av) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(atk.patientId, atk.personal.enhet_id, f.id, vem, t, JSON.stringify(varden), JSON.stringify(varningar), atk.personal.id);
  return { ...bbFor(atk, nu), varningar, text: varningar.length ? 'Kontrollen är registrerad. Se varningarna.' : 'Kontrollen är registrerad.' };
}

export function bbScreening(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  obs.sakra(db);
  const { vem, barn, f } = bbRad(atk);
  if (vem !== 'barn') throw new Fel(400, 'Screeningen registreras i barnets journal.', 'ogiltig');
  kravBbEnhet(atk, f);
  if (utskriven(db, f)) throw new Fel(409, 'Mor och barn är utskrivna från BB.', 'ogiltig');
  const typ = body.typ;
  if (!finns(SCREENING, typ)) throw new Fel(400, 'Välj screening i listan.', 'ogiltig', { falt: ['typ'] });
  const resultat = body.resultat ?? (typ === 'kvitamin' ? 'given' : 'ua');
  if (!finns(SCREENING_RESULTAT, resultat)) throw new Fel(400, 'Resultatet finns inte i listan.', 'ogiltig', { falt: ['resultat'] });
  const tidigast = Date.parse(barn.fodd_tid) + PKU_TIMMAR * TIMME;
  if (typ === 'pku' && nu.getTime() < tidigast) throw new Fel(409, `PKU-provet tas tidigast ${PKU_TIMMAR} timmar efter födelsen, från ${iso(tidigast)}.`, 'ogiltig', { tidigast: iso(tidigast) });
  if (db.query('SELECT 1 FROM bb_screening WHERE patient_id = ? AND typ = ?').get(atk.patientId, typ)) throw new Fel(409, `${SCREENING[typ]} är redan registrerad.`, 'ogiltig');
  db.query('INSERT INTO bb_screening (patient_id, enhet_id, forlossning_id, typ, tid, resultat, av) VALUES (?, ?, ?, ?, ?, ?, ?)').run(atk.patientId, atk.personal.enhet_id, f.id, typ, iso(nu), resultat, atk.personal.id);
  return { ...bbFor(atk, nu), text: `${SCREENING[typ]} är registrerad.` };
}

const kontrollerFor = (db, pid, f) => db.query('SELECT * FROM bb_kontroller WHERE patient_id = ? AND forlossning_id = ? ORDER BY tid DESC, id DESC').all(pid, f.id)
  .map(k => ({ id: k.id, tid: k.tid, varden: lasJson(k.varden, {}), varningar: lasJson(k.varningar, []), av: personNamn(db, k.av) }));

// Barnets BB-journal med screeningen och det som ska göras före hemgång.
function barnBb(db, b, f, nu) {
  const kontroller = kontrollerFor(db, b.barn_patient_id, f);
  const scr = db.query('SELECT * FROM bb_screening WHERE patient_id = ? ORDER BY tid').all(b.barn_patient_id);
  const pkuFran = iso(Date.parse(b.fodd_tid) + PKU_TIMMAR * TIMME);
  const screening = Object.keys(SCREENING).map(typ => {
    const r = scr.find(s => s.typ === typ);
    return { typ, text: SCREENING[typ], gjord: r ? { tid: r.tid, resultat: SCREENING_RESULTAT[r.resultat], av: personNamn(db, r.av) } : null,
      tidigast: typ === 'pku' ? pkuFran : null, kanTas: typ !== 'pku' || nu.getTime() >= Date.parse(pkuFran) };
  });
  const vikt = kontroller.find(k => k.varden.vikt != null);
  const anm = db.query('SELECT * FROM fodelseanmalan WHERE barn_patient_id = ?').get(b.barn_patient_id);
  return { patientId: b.barn_patient_id, ordning: b.ordning, fodd: b.fodd_tid, timmar: Math.floor((nu.getTime() - Date.parse(b.fodd_tid)) / TIMME), fodelsevikt: b.vikt,
    senasteVikt: vikt ? { vikt: vikt.varden.vikt, tid: vikt.tid, viktnedgang: vikt.varden.viktnedgang } : null, kontroller, screening, anmalan: anmalanUt(db, anm) };
}

// Utskrivningskriterierna för mor och barn, som systemet prövar.
export function kriterier(db, f, { pkuAterbesok = false } = {}, nu = new Date()) {
  const ut = [];
  const mor = kontrollerFor(db, f.patient_id, f);
  const k = (ok, text) => ut.push({ ok: Boolean(ok), text });
  k(mor[0] && nu.getTime() - Date.parse(mor[0].tid) <= 12 * TIMME, 'Modern har kontrollerats de senaste tolv timmarna.');
  k(mor[0] && !mor[0].varningar.length, 'Moderns senaste kontroll har inga varningar.');
  k(mor.some(x => x.varden.urinerat === true), 'Modern har kissat efter förlossningen.');
  for (const b of db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(f.id)) {
    const bb = barnBb(db, b, f, nu);
    const namn = db.query('SELECT fornamn FROM patienter WHERE id = ?').get(b.barn_patient_id)?.fornamn ?? `Barn ${b.ordning}`;
    const gjord = (typ) => bb.screening.find(s => s.typ === typ).gjord;
    k(bb.kontroller[0] && nu.getTime() - Date.parse(bb.kontroller[0].tid) <= 12 * TIMME, `${namn} har kontrollerats de senaste tolv timmarna.`);
    k(bb.senasteVikt && bb.senasteVikt.viktnedgang < VIKTNEDGANG_GRANS, `${namn} har vägts och gått ner mindre än ${VIKTNEDGANG_GRANS} procent.`);
    for (const typ of ['kvitamin', 'pulsoximetri', 'barnlakare', 'horsel']) k(gjord(typ), `${namn}: ${SCREENING[typ].toLowerCase()} är gjord.`);
    k(gjord('pku') || pkuAterbesok, `${namn}: PKU-provet är taget eller bokat som återbesök.`);
  }
  return ut;
}

export function bbFor(atk, nu = new Date()) {
  const db = atk.db;
  obs.sakra(db);
  const { vem, barn, f } = bbRad(atk);
  const u = utskriven(db, f);
  const base = { vem, forlossningId: f.id, utskriven: u ? { tid: u.tid, av: personNamn(db, u.av) } : null, demoregel: DEMOREGEL,
    kanRegistrera: atk.prova('graviditet').tillaten && vardenhetFor(db, atk.personal.enhet_id) === vardenhetFor(db, f.enhet_id) && !u };
  if (vem === 'barn') {
    return { ...base, barn: barnBb(db, barn, f, nu) };
  }
  return { ...base, kontroller: kontrollerFor(db, f.patient_id, f), avslutad: f.avslutad,
    barn: db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(f.id).map(b => ({ ...barnBb(db, b, f, nu), namn: visningsnamn(db.query('SELECT * FROM patienter WHERE id = ?').get(b.barn_patient_id)) })),
    kriterier: u ? [] : kriterier(db, f, {}, nu) };
}

export function utskrivning(atk, body = {}, nu = new Date()) {
  const db = atk.db;
  obs.sakra(db);
  const { vem, f } = bbRad(atk);
  if (vem !== 'mor') throw new Fel(400, 'Mor och barn skrivs ut från moderns journal.', 'ogiltig');
  kravBbEnhet(atk, f);
  if (utskriven(db, f)) throw new Fel(409, 'Mor och barn är redan utskrivna.', 'ogiltig');
  const kr = kriterier(db, f, { pkuAterbesok: body.pkuAterbesok === true }, nu);
  const saknas = kr.filter(x => !x.ok);
  if (saknas.length) throw new Fel(409, `Utskrivningen kan inte göras ännu: ${saknas.map(x => x.text.replace(/\.$/, '').toLowerCase()).join('; ')}.`, 'kontroll', { saknas: saknas.map(x => x.text) });
  const t = iso(nu);
  const barnIds = db.query('SELECT barn_patient_id FROM forlossning_barn WHERE forlossning_id = ?').all(f.id).map(r => r.barn_patient_id);
  const enheter = enheterUnder(db, vardenhetFor(db, f.enhet_id));
  const ph = enheter.map(() => '?').join(', ');
  db.transaction(() => {
    db.query('INSERT INTO bb_utskrivning (forlossning_id, patient_id, enhet_id, tid, av, kriterier) VALUES (?, ?, ?, ?, ?, ?)').run(f.id, f.patient_id, atk.personal.enhet_id, t, atk.personal.id, JSON.stringify(kr));
    for (const pid of [f.patient_id, ...barnIds]) db.query(`UPDATE vardkontakter SET slut = ? WHERE patient_id = ? AND typ = 'slutenvard' AND slut IS NULL AND enhet_id IN (${ph})`).run(t, pid, ...enheter);
  })();
  for (const pid of barnIds) { const ab = new Atkomst(db, atk.personal, pid, {}, 'graviditet'); ab.logga('graviditet', ab.grund(), `bb:utskrivning:${f.id}`); }
  return { ...bbFor(atk, nu), text: `Mor och ${barnIds.length > 1 ? 'barnen' : 'barn'} är utskrivna från BB. Mödrahälsovården bokar efterkontrollen och barnavårdscentralen hembesöket.` };
}

// ---- Förlossningsjournalen för en patient och förlossningens översikt ----------------------------------------------------

// Förlossningen för modern med partogram, CTG, smärtlindring, barnen, födelseanmälan och BB.
export function forlossningFor(atk, nu = new Date()) {
  const db = atk.db;
  obs.sakra(db);
  atk.krav('las_graviditet');
  const f = atk.filtrera(db.query('SELECT * FROM forlossningar WHERE patient_id = ? ORDER BY start DESC, id DESC').all(atk.patientId), 'las_graviditet')[0];
  if (!f) return { forlossning: null, demoregel: DEMOREGEL };
  const g = obs.graviditetRad(db, f.graviditet_id);
  const gSynlig = atk.prova('las_graviditet', { enhet_id: g.enhet_id }).tillaten;
  const gu = gSynlig ? obs.graviditetUt(atk, g, nu) : null;
  const egen = vardenhetFor(db, atk.personal.enhet_id) === vardenhetFor(db, f.enhet_id) && atk.prova('graviditet').tillaten;
  const barn = db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ? ORDER BY ordning').all(f.id).map(b => ({
    ordning: b.ordning, patientId: b.barn_patient_id, namn: visningsnamn(db.query('SELECT * FROM patienter WHERE id = ?').get(b.barn_patient_id)),
    anmalan: anmalanUt(db, db.query('SELECT * FROM fodelseanmalan WHERE barn_patient_id = ?').get(b.barn_patient_id)) }));
  return {
    forlossning: { ...obs.forlossningUt(atk, f), vecka: obs.veckaText(Math.max(0, obs.dagarFor(g, datumAv(nu)))), antalFoster: g.antal_foster },
    ctg: f.status === 'pagaende' ? ctgUt(db, f, nu) : { kopplad: false, bedomningar: ctgUt(db, f, nu).bedomningar },
    smartlindring: smartlindringUt(db, f), foreRegional: f.status === 'pagaende' ? foreRegional(atk) : null, barn,
    graviditet: gu ? { bpd: gu.bpd, risk: gu.risk, onskemal: gu.inskrivningssamtal?.onskemal ?? null, paritet: gu.paritet, tidigareKejsarsnitt: gu.tidigareKejsarsnitt } : null,
    bb: f.status === 'avslutad' ? bbFor(atk, nu) : null, kanRegistrera: egen, forlopp: CTG_FORLOPP, smartlindringsval: SMARTLINDRING, demoregel: DEMOREGEL,
  };
}

// Översikten för förlossningen: pågående förlossningar och mödrar och barn på BB, bara det som den inloggade får se.
export function oversikt(db, personal, valFor = () => ({}), nu = new Date()) {
  obs.sakra(db);
  obs.kravForlossning(db, personal);
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const rader = db.query(`SELECT * FROM forlossningar WHERE enhet_id IN (${ph}) AND (status = 'pagaende' OR id NOT IN (SELECT forlossning_id FROM bb_utskrivning)) ORDER BY start`).all(...enheter);
  const pagaende = [], bb = [];
  for (const f of rader) {
    const atk = new Atkomst(db, personal, f.patient_id, valFor(f.patient_id), 'las_graviditet');
    if (!atk.prova('las_graviditet', { enhet_id: f.enhet_id }).tillaten) continue;
    const p = db.query('SELECT * FROM patienter WHERE id = ?').get(f.patient_id);
    if (!p || p.sammanslagen_till) continue;
    loggaPatient(db, personal, f.patient_id, 'las_graviditet', atk.grund(), 'forlossning:oversikt');
    const g = obs.graviditetRad(db, f.graviditet_id);
    const fu = obs.forlossningUt(atk, f);
    const rad = { patientId: p.id, namn: visningsnamn(p), forlossningId: f.id, start: f.start, antalFoster: g.antal_foster };
    if (f.status === 'pagaende') {
      const c = ctgUt(db, f, nu);
      pagaende.push({ ...rad, vecka: obs.veckaText(Math.max(0, obs.dagarFor(g, datumAv(nu)))), oppning: fu.partogram.at(-1)?.oppning ?? null, lage: fu.lage, fosterljudVarning: fu.fosterljudVarning,
        ctg: c.kopplad ? { klass: c.klass, klassText: c.klassText, nastaBedomning: c.nastaBedomning, forsenad: c.forsenad } : null,
        smartlindring: smartlindringUt(db, f).map(s => s.text), fodda: fu.barn.length });
    } else {
      const b = bbFor(atk, nu);
      const varningar = [...(b.kontroller[0]?.varningar ?? []), ...b.barn.flatMap(x => x.kontroller[0]?.varningar ?? [])];
      bb.push({ ...rad, avslutad: f.avslutad, varningar, kvar: b.kriterier.filter(x => !x.ok).map(x => x.text),
        barn: b.barn.map(x => ({ patientId: x.patientId, namn: x.namn, timmar: x.timmar, viktnedgang: x.senasteVikt?.viktnedgang ?? null, anmalan: x.anmalan?.status ?? null })) });
    }
  }
  return { vardenhet: enhetKort(db, ve), pagaende, bb, text: 'Pågående förlossningar med partogram och CTG, och mödrar och barn på BB. Systemet analyserar kurvorna och säger vad som ska göras.', demoregel: DEMOREGEL };
}

// Uppföljningen per vårdenhet (Sussa 4.7.1.4): runda 9:s uppföljning och det som har tillkommit i runda 11, utan
// personuppgifter. Svaren på frågorna om våld räknas aldrig, bara att frågorna är ställda.
export function uppfoljning(db, personal, period = {}, nu = new Date()) {
  const u = obs.uppfoljning(db, personal, period, nu);
  const ve = vardenhetFor(db, personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const start = lokalTid(u.fran, '00:00'), slut = lokalTid(addDagar(u.till, 1), '00:00');
  const andel = (n, av) => (av ? Math.round((n / av) * 100) : null);
  const samtal = db.query(`SELECT s.* FROM graviditet_samtal s WHERE s.enhet_id IN (${ph}) AND s.tid >= ? AND s.tid < ? AND s.id = (SELECT max(id) FROM graviditet_samtal x WHERE x.graviditet_id = s.graviditet_id)`).all(...enheter, start, slut);
  const tob = samtal.map(s => lasJson(s.tobak, {}));
  const forl = db.query(`SELECT id FROM forlossningar WHERE enhet_id IN (${ph}) AND avslutad >= ? AND avslutad < ?`).all(...enheter, start, slut).map(r => r.id);
  const smart = forl.map(id => new Set(db.query('SELECT metod FROM smartlindring WHERE forlossning_id = ?').all(id).map(r => r.metod)));
  const patologiskt = forl.filter(id => db.query("SELECT 1 FROM ctg_bedomning WHERE forlossning_id = ? AND klass = 'patologiskt'").get(id)).length;
  const barn = forl.flatMap(id => db.query('SELECT * FROM forlossning_barn WHERE forlossning_id = ?').all(id));
  const anmalda = barn.filter(b => db.query("SELECT 1 FROM fodelseanmalan WHERE barn_patient_id = ? AND status = 'kvitterad'").get(b.barn_patient_id)).length;
  const ek = db.query(`SELECT * FROM graviditet_efterkontroll WHERE enhet_id IN (${ph}) AND tid >= ? AND tid < ?`).all(...enheter, start, slut);
  const ul = db.query(`SELECT * FROM graviditet_ultraljud WHERE enhet_id IN (${ph}) AND tid >= ? AND tid < ?`).all(...enheter, start, slut);
  return {
    ...u,
    inskrivning: { samtal: samtal.length, valdfraganStalld: andel(samtal.filter(s => s.vald_stalld).length, samtal.length), rokerVidInskrivning: andel(tob.filter(t => t.rokning === 'ja').length, samtal.length),
      snusarVidInskrivning: andel(tob.filter(t => t.snus === 'ja').length, samtal.length) },
    ultraljud: { antal: ul.length, medVarning: ul.filter(x => lasJson(x.varningar, []).length).length },
    smartlindring: Object.keys(SMARTLINDRING).map(id => ({ id, namn: SMARTLINDRING[id], andel: andel(smart.filter(s => s.has(id)).length, forl.length) })).filter(x => x.andel),
    ctg: { patologisktAndel: andel(patologiskt, forl.length) },
    fodelseanmalan: { barn: barn.length, medPersonnummer: anmalda },
    efterkontroll: { antal: ek.length, epdsOverGrans: andel(ek.filter(e => e.epds >= obs.EPDS_GRANS || e.epds_fraga10 > 0).length, ek.length) },
    textR11: 'Inskrivningen räknar att frågorna om våld är ställda, aldrig vad som svarades. En andel visas inte när underlaget saknas.',
  };
}

export { SAKNAS };
