// Anestesijournalen under operationen (runda 11, r2, Sussa 4.5.1.3 och 4.6): förloppet med tiderna ur operationen, täta
// värden från anestesimonitorn, läkemedel och vätskor och händelser som intubation och komplikationer.
//
// Systemet är experten:
//   - Monitorn på salen skickar värden var femte minut från att patienten kommer in på salen tills patienten lämnar den.
//     I demon är monitorn simulerad och värdena räknas fram av systemet, märkta som simulerade.
//   - Systemet föreslår antibiotikaprofylaxen ur ingreppet och byter den själv vid överkänslighet mot penicillin, räknar
//     induktionsdosen ur patientens vikt och fyller i standarddosen för de andra läkemedlen. Ett läkemedel som patienten
//     är överkänslig mot, eller en dos över den högsta, stoppas med en förklaring.
//   - Vätskebalansen räknas av systemet ur det som registreras in och ut.
// Läkemedlen, doserna och monitorns värden är demoregler, inte kliniskt beslutsstöd.
import { Fel } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import { tabell, finns, personNamn, textFalt, iso, tid as giltigTid, MIN, lasRad, andraRad } from './specialist-hjalp.js';
import * as op from './operation.js';
import * as journal from './journal.js';
import { kvalitetssakrad } from './mt-klass.js';

export const DEMOREGEL = 'Läkemedlen, doserna och anestesimonitorn är demoregler och simulerade, inte kliniskt beslutsstöd.';
export const MONITOR_MIN = 5;
export const KALLA = 'Anestesimonitor (simulerad)';
const ANDRA = 'Operationen hanteras av den anmälande vårdenheten.';

// Läkemedlen under anestesin. perKg ger dosen ur vikten, annars gäller standard. max är den högsta dosen per tillfälle.
export const LAKEMEDEL = tabell({
  propofol: { namn: 'Propofol', atc: 'N01AX10', enhet: 'mg', vag: 'intravenöst', perKg: 2, standard: 140, max: 300, grupp: 'Induktion' },
  fentanyl: { namn: 'Fentanyl', atc: 'N01AH01', enhet: 'mikrogram', vag: 'intravenöst', standard: 100, max: 250, grupp: 'Smärtlindring' },
  rokuronium: { namn: 'Rokuronium', atc: 'M03AC09', enhet: 'mg', vag: 'intravenöst', perKg: 0.6, standard: 40, max: 100, grupp: 'Muskelavslappning' },
  bupivakain: { namn: 'Bupivakain spinalt', atc: 'N01BB01', enhet: 'mg', vag: 'spinalt', standard: 12.5, max: 20, grupp: 'Bedövning' },
  kloxacillin: { namn: 'Kloxacillin', atc: 'J01CF02', enhet: 'g', vag: 'intravenöst', standard: 2, max: 2, grupp: 'Antibiotikaprofylax' },
  cefuroxim: { namn: 'Cefuroxim', atc: 'J01DC02', enhet: 'g', vag: 'intravenöst', standard: 1.5, max: 3, grupp: 'Antibiotikaprofylax' },
  klindamycin: { namn: 'Klindamycin', atc: 'J01FF01', enhet: 'mg', vag: 'intravenöst', standard: 600, max: 900, grupp: 'Antibiotikaprofylax' },
  ondansetron: { namn: 'Ondansetron', atc: 'A04AA01', enhet: 'mg', vag: 'intravenöst', standard: 4, max: 8, grupp: 'Mot illamående' },
  dexametason: { namn: 'Dexametason', atc: 'H02AB02', enhet: 'mg', vag: 'intravenöst', standard: 8, max: 8, grupp: 'Mot illamående' },
  efedrin: { namn: 'Efedrin', atc: 'C01CA26', enhet: 'mg', vag: 'intravenöst', standard: 5, max: 30, grupp: 'Blodtryck' },
  tranexamsyra: { namn: 'Tranexamsyra', atc: 'B02AA02', enhet: 'g', vag: 'intravenöst', standard: 1, max: 2, grupp: 'Blödning' },
  paracetamol: { namn: 'Paracetamol', atc: 'N02BE01', enhet: 'g', vag: 'intravenöst', standard: 1, max: 1, grupp: 'Smärtlindring' },
});
export const VATSKOR = tabell({
  ringer: { namn: 'Ringer-acetat', riktning: 'in' }, nacl: { namn: 'Natriumklorid 9 mg/ml', riktning: 'in' }, glukos: { namn: 'Glukos 50 mg/ml', riktning: 'in' },
  blodning: { namn: 'Blödning', riktning: 'ut' }, urin: { namn: 'Urin', riktning: 'ut' },
});
export const HANDELSER = tabell({
  intubation: { namn: 'Intubation' }, larynxmask: { namn: 'Larynxmask' }, spinal: { namn: 'Spinalbedövning lagd' }, blockad: { namn: 'Nervblockad lagd' },
  extubation: { namn: 'Extubation' }, komplikation: { namn: 'Komplikation', text: true }, anteckning: { namn: 'Anteckning', text: true },
});
const ANTIBIOTIKA = ['kloxacillin', 'cefuroxim', 'klindamycin'];
const tal = (v) => String(v).replace('.', ',');
const avrunda = (v) => Math.round(v * 10) / 10;

// Värdena från den simulerade anestesimonitorn, var femte minut från in på sal till ut från sal, högst till nu. Lugnt
// deterministiskt brus kring fasta grundvärden, så att samma operation och tid alltid ger samma värde. Värdena räknas inte
// ur journalen, så att inget från en annan vårdenhet syns i dem. Efter anestesistart sjunker blodtrycket lite, och vid
// generell anestesi mäts koldioxid i utandningsluften.
const brus = (k, i, skala) => Math.round((Math.sin(k * 5.31 + i * 0.41) + Math.sin(k * 2.7 + i * 1.33) * 0.5) * skala * 10) / 10;
export function fyllVarden(db, an, nu = new Date()) {
  op.sakra(db);
  const f = db.query('SELECT * FROM op_forlopp WHERE anmalan_id = ?').get(an.id);
  if (!f?.in_sal) return 0;
  const steg = MONITOR_MIN * MIN;
  const slut = Math.min(nu.getTime(), f.ut_sal ? Date.parse(f.ut_sal) : Infinity);
  const ins = db.query('INSERT OR IGNORE INTO op_anestesi_varden (anmalan_id, patient_id, enhet_id, tid, puls, sys, dia, saturation, etco2, andningsfrekvens, temp, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  let n = 0;
  db.transaction(() => {
    for (let t = Date.parse(f.in_sal), i = 0; t <= slut && i < 400; t += steg, i++) {
      const efterStart = f.anestesistart && t >= Date.parse(f.anestesistart);
      const generell = an.anestesi === 'generell';
      const sys = Math.round((efterStart ? 118 : 138) + brus(an.id, i, 6));
      n += ins.run(an.id, an.patient_id, an.enhet_id, iso(t), Math.round((efterStart ? 66 : 76) + brus(an.id + 1, i, 4)), sys, Math.min(sys - 20, Math.round((efterStart ? 68 : 80) + brus(an.id + 2, i, 3))),
        Math.min(100, Math.round(98 + brus(an.id + 3, i, 1))), efterStart && generell ? avrunda(5 + brus(an.id + 4, i, 0.2)) : null,
        efterStart && generell ? 12 : Math.round(14 + brus(an.id + 5, i, 1.5)), avrunda(36.4 + brus(an.id + 6, i, 0.15)), KALLA).changes;
    }
  })();
  return n;
}

const radUt = (db, r) => ({ id: r.id, tid: r.tid, av: personNamn(db, r.av) });
// Anestesijournalen för en operation. Läsningen prövas på den anmälande vårdenheten (aktivt val, spärr och samtycke).
export function journalFor(atk, an, nu = new Date()) {
  lasRad(atk, an, 'las_operation');
  const db = atk.db;
  fyllVarden(db, an, nu);
  const f = db.query('SELECT * FROM op_forlopp WHERE anmalan_id = ?').get(an.id);
  const rader = db.query('SELECT * FROM op_anestesi WHERE anmalan_id = ? ORDER BY tid, id').all(an.id);
  const lm = rader.filter(r => r.slag === 'lakemedel').map(r => ({ ...radUt(db, r), kod: r.kod, namn: LAKEMEDEL[r.kod]?.namn ?? r.kod, dos: r.dos, enhet: r.dos_enhet, vag: LAKEMEDEL[r.kod]?.vag ?? null }));
  const vatskor = rader.filter(r => r.slag === 'vatska').map(r => ({ ...radUt(db, r), kod: r.kod, namn: VATSKOR[r.kod]?.namn ?? r.kod, riktning: VATSKOR[r.kod]?.riktning ?? 'in', volym: r.volym_ml }));
  const summa = (rikt) => vatskor.filter(v => v.riktning === rikt).reduce((s, v) => s + v.volym, 0);
  const varden = db.query('SELECT * FROM op_anestesi_varden WHERE anmalan_id = ? ORDER BY tid').all(an.id).map(v => ({
    tid: v.tid, puls: v.puls, blodtryck: `${v.sys}/${v.dia}`, sys: v.sys, dia: v.dia, map: Math.round((v.sys + 2 * v.dia) / 3), saturation: v.saturation, etco2: v.etco2,
    andningsfrekvens: v.andningsfrekvens, temp: v.temp, kalla: v.kalla }));
  return {
    pagar: Boolean(f?.in_sal && !f?.ut_sal), tider: op.HANDELSER.map(h => ({ id: h.id, namn: h.namn, tid: f?.[h.id] ?? null })),
    varden, lakemedel: lm, vatskor: { rader: vatskor, in: summa('in'), ut: summa('ut'), balans: summa('in') - summa('ut') },
    handelser: rader.filter(r => r.slag === 'handelse').map(r => ({ ...radUt(db, r), kod: r.kod, namn: HANDELSER[r.kod]?.namn ?? r.kod, text: r.text })),
    forslag: forslag(atk, an, lm), katalog: { lakemedel: Object.entries(LAKEMEDEL).map(([id, l]) => ({ id, namn: l.namn, enhet: l.enhet, grupp: l.grupp, max: l.max })),
      vatskor: Object.entries(VATSKOR).map(([id, v]) => ({ id, ...v })), handelser: Object.entries(HANDELSER).map(([id, h]) => ({ id, namn: h.namn, text: Boolean(h.text) })) },
    monitor: { kalla: KALLA, intervallMinuter: MONITOR_MIN }, demoregel: DEMOREGEL,
  };
}

// Vikten som den inloggade får se, för dosen per kilo. Läsningen loggas med sin egen grund.
const viktCache = new WeakMap();
function vikt(atk, an) {
  if (!kanRoll(atk.personal, 'las_matvarden')) return null;
  if (viktCache.has(atk)) return viktCache.get(atk);
  const x = new Atkomst(atk.db, atk.personal, an.patient_id, atk.val, 'las_matvarden');
  const m = journal.synligaMatvarden(x).find(v => v.typ === 'vikt' && kvalitetssakrad(v));
  if (x.grunder.size) x.logga('las_matvarden', x.grund(), `operation:${an.id}:vikt`);
  const kg = m ? Number(m.varde_num) : null;
  viktCache.set(atk, kg);
  return kg;
}
function dosFor(atk, an, kod) {
  const l = LAKEMEDEL[kod];
  const kg = l.perKg ? vikt(atk, an) : null;
  return kg ? Math.min(l.max, Math.round(l.perKg * kg)) : l.standard;
}
function forslag(atk, an, givna) {
  const p = op.profylaxFor(atk, an);
  const given = givna.some(g => ANTIBIOTIKA.includes(g.kod));
  const kg = vikt(atk, an);
  return {
    profylax: { lakemedel: p.lakemedel, namn: p.namn, dos: p.dos, enhet: p.enhet, given, text: given ? 'Antibiotikaprofylaxen är given.' : `Förslag: ${p.text}` },
    lakemedel: Object.entries(LAKEMEDEL).filter(([id]) => !ANTIBIOTIKA.includes(id) || id === p.lakemedel).map(([id, l]) => {
      const dos = dosFor(atk, an, id);
      return { kod: id, namn: l.namn, dos, enhet: l.enhet, grupp: l.grupp, text: `${l.namn} ${tal(dos)} ${l.enhet} ${l.vag}${l.perKg && kg ? `, ${tal(l.perKg)} ${l.enhet}/kg vid ${tal(kg)} kg` : ''}.` };
    }),
  };
}

function kravPagar(db, an) {
  const f = db.query('SELECT in_sal, ut_sal FROM op_forlopp WHERE anmalan_id = ?').get(an.id);
  if (!f?.in_sal || f.ut_sal) throw new Fel(409, 'Anestesijournalen förs under operationen, från in på sal till ut från sal.', 'ogiltig');
}
const andra = (atk, an) => andraRad(atk, an, 'operation_registrera', 'las_operation', ANDRA);
const insert = (atk, an, t, slag, kod, { dos = null, enhet = null, volym = null, text = null } = {}, nu) => atk.db.query(`INSERT INTO op_anestesi (anmalan_id, patient_id, enhet_id, tid, slag, kod, dos, dos_enhet, volym_ml, text, av, registrerad)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(an.id, an.patient_id, an.enhet_id, t, slag, kod, dos, enhet, volym, text, atk.personal.id, iso(nu));

// Ett läkemedel under operationen. Utan dos fyller systemet i den föreslagna. Överkänslighet stoppar läkemedlet.
export function registreraLakemedel(atk, an, body = {}, nu = new Date()) {
  andra(atk, an);
  const db = atk.db;
  if (!finns(LAKEMEDEL, body.lakemedel)) throw new Fel(400, 'Välj läkemedlet.', 'ogiltig', { falt: ['lakemedel'] });
  kravPagar(db, an);
  const l = LAKEMEDEL[body.lakemedel];
  const dos = body.dos == null || body.dos === '' ? dosFor(atk, an, body.lakemedel) : typeof body.dos === 'number' ? body.dos : Number(String(body.dos).replace(',', '.'));
  if (!Number.isFinite(dos) || dos <= 0 || dos > l.max) throw new Fel(400, `Dosen av ${l.namn.toLocaleLowerCase('sv')} ska vara ett tal över noll och högst ${tal(l.max)} ${l.enhet} per tillfälle.`, 'ogiltig', { falt: ['dos'] });
  const overk = atk.filtrera(db.query("SELECT * FROM overkanslighet WHERE patient_id = ? AND status = 'aktiv'").all(an.patient_id), 'las_oversikt', { gemensam: true })
    .find(o => o.atc && (l.atc.startsWith(o.atc) || (o.atc.startsWith('J01C') && l.atc.startsWith('J01C'))));
  if (overk) {
    const alt = op.profylaxFor(atk, an);
    throw new Fel(409, `Patienten är överkänslig mot ${overk.amne}. ${l.namn} ges inte.${l.grupp === 'Antibiotikaprofylax' ? ` Ge ${alt.namn.toLocaleLowerCase('sv')} ${tal(alt.dos)} ${alt.enhet} i stället.` : ''}`, 'ogiltig', { falt: ['lakemedel'] });
  }
  const t = giltigTid(body.tid, 'tid', nu, { bakat: 12 * 60 * MIN });
  insert(atk, an, t, 'lakemedel', body.lakemedel, { dos, enhet: l.enhet }, nu);
  return { ...journalFor(atk, an, nu), text: `${l.namn} ${tal(dos)} ${l.enhet} är registrerat.` };
}

export function registreraVatska(atk, an, body = {}, nu = new Date()) {
  andra(atk, an);
  if (!finns(VATSKOR, body.slag)) throw new Fel(400, 'Välj vätskan.', 'ogiltig', { falt: ['slag'] });
  kravPagar(atk.db, an);
  const v = Number(body.volym);
  if (!Number.isInteger(v) || v <= 0 || v > 5000) throw new Fel(400, 'Volymen anges i hela milliliter, 1 till 5000.', 'ogiltig', { falt: ['volym'] });
  const t = giltigTid(body.tid, 'tid', nu, { bakat: 12 * 60 * MIN });
  insert(atk, an, t, 'vatska', body.slag, { volym: v }, nu);
  return { ...journalFor(atk, an, nu), text: `${VATSKOR[body.slag].namn} ${v} ml är registrerat.` };
}

export function registreraHandelse(atk, an, body = {}, nu = new Date()) {
  andra(atk, an);
  if (!finns(HANDELSER, body.handelse)) throw new Fel(400, 'Välj händelsen.', 'ogiltig', { falt: ['handelse'] });
  kravPagar(atk.db, an);
  const h = HANDELSER[body.handelse];
  const text = textFalt(body.text, 500) || null;
  if (h.text && !text) throw new Fel(400, `Beskriv ${h.namn.toLocaleLowerCase('sv')}en.`, 'ogiltig', { falt: ['text'] });
  const t = giltigTid(body.tid, 'tid', nu, { bakat: 12 * 60 * MIN });
  insert(atk, an, t, 'handelse', body.handelse, { text }, nu);
  return { ...journalFor(atk, an, nu), text: `${h.namn} är registrerad.` };
}

// En sammanfattning för överrapporteringen, ur raderna för operationen.
export function sammanfattning(db, an) {
  op.sakra(db);
  const rader = db.query('SELECT * FROM op_anestesi WHERE anmalan_id = ? ORDER BY tid, id').all(an.id);
  const lm = rader.filter(r => r.slag === 'lakemedel').map(r => `${LAKEMEDEL[r.kod]?.namn ?? r.kod} ${tal(r.dos)} ${r.dos_enhet}`);
  const v = rader.filter(r => r.slag === 'vatska');
  const s = (rikt) => v.filter(x => VATSKOR[x.kod]?.riktning === rikt).reduce((a, x) => a + x.volym_ml, 0);
  const h = rader.filter(r => r.slag === 'handelse' && HANDELSER[r.kod]?.text).map(r => `${HANDELSER[r.kod].namn.toLocaleLowerCase('sv')}: ${r.text}`);
  if (!lm.length && !v.length && !h.length) return '';
  const bal = s('in') - s('ut');
  return `Under operationen: ${lm.length ? lm.join(', ') : 'inga läkemedel registrerade'}${v.length ? `; vätskor in ${s('in')} ml och ut ${s('ut')} ml, balans ${bal > 0 ? '+' : ''}${bal} ml` : ''}${h.length ? `; ${h.join('; ')}` : ''}.`;
}
