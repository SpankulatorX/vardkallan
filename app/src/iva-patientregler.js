// Runda 11, r7: patientens egna larmgränser och regler i intensivvården (Sussa 4.6.1.3), behandlingsbegränsningarna
// och underlaget för överrapportering.
//
// Läkaren sätter en gräns för en parameter hos en enskild patient, till exempel syremättnad under 85 % för en patient
// med KOL eller ett mål för medelartärtrycket över 70 mmHg. Systemet avgör själv om regeln ersätter avdelningens gräns
// i samma riktning (då gäller patientens gräns i stället) eller om den läggs till, prövar regeln mot de senaste godkända
// värdena vid varje visning och skriver på vanlig svenska vad som larmar och varför. Samma gränser används av monitorn i
// realtidsvisningen (iva-vagform.js), så att larmen på skärmen och i journalen följer samma regel.
//
// Reglerna hör till journalen: de sparas på den vårdenhet där de gjordes, filtreras som mätvärden (inre sekretess,
// aktivt val och spärr) och ändras aldrig. En ny regel för samma parameter och riktning avslutar den förra.
// Reglerna är demoregler, inte kliniskt beslutsstöd.
import { Fel, iso } from './db.js';
import { Atkomst, kanRoll, vardenhetFor } from './atkomst.js';
import { kravVardande } from './administrering.js';
import { kvalitetssakrad } from './mt-klass.js';
import * as iva from './iva.js';
import * as journal from './journal.js';
import * as uppmarksamhet from './uppmarksamhet.js';

const MIN = 60_000;
const TIMME = 3600_000;
const talSv = (v, d = 0) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
const klocka = (t) => new Date(t).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const datumText = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long' });
const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? null : null);

// Parametrarna som en regel kan gälla, med vad som går att mäta och avdelningens gränser (standard) per riktning.
// standardRegel är regeln i iva.IVA_REGLER som avdelningens gräns kommer ifrån.
export const PARAMETRAR = {
  map: { namn: 'Medelartärtryck (MAP)', kort: 'MAP', enhet: 'mmHg', typ: 'blodtryck', min: 30, max: 140, decimaler: 0, standard: { under: (p) => p.mapLag }, standardRegel: { under: 'map_lag' } },
  saturation: { namn: 'Syremättnad', kort: 'SpO₂', enhet: '%', typ: 'saturation', min: 70, max: 100, decimaler: 0, standard: { under: (p) => p.saturationLag }, standardRegel: { under: 'saturation_lag' } },
  puls: { namn: 'Puls', kort: 'Puls', enhet: 'slag/min', typ: 'puls', min: 20, max: 250, decimaler: 0, standard: { under: () => 40, over: () => 130 }, standardRegel: { under: 'puls', over: 'puls' } },
  andningsfrekvens: { namn: 'Andningsfrekvens', kort: 'Andning', enhet: 'andetag/min', typ: 'andningsfrekvens', min: 4, max: 60, decimaler: 0, standard: { under: () => 8, over: () => 30 }, standardRegel: { under: 'andningsfrekvens', over: 'andningsfrekvens' } },
  temp: { namn: 'Temperatur', kort: 'Temp', enhet: '°C', typ: 'temp', min: 34, max: 42, decimaler: 1, standard: { over: () => 38.5 }, standardRegel: { over: 'feber' } },
};
export const VILLKOR = { under: 'under', over: 'över' };
export const NIVAER = { larm: 'Larm', varning: 'Varning' };
export const DEMOREGEL = 'Patientens egna gränser är demoregler för att visa flödet, inte kliniskt beslutsstöd.';

export const SCHEMA = `
-- Patientens egna gränser och regler i intensivvården (runda 11, r7, Sussa 4.6.1.3). En rad ändras aldrig. En ny regel för
-- samma parameter och riktning avslutar den förra (avslutad), och det är det enda som sätts i efterhand, en gång.
CREATE TABLE IF NOT EXISTS iva_patientregler (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, parameter TEXT NOT NULL, villkor TEXT NOT NULL, grans REAL NOT NULL,
  antal INTEGER NOT NULL DEFAULT 1, niva TEXT NOT NULL, gora TEXT, motivering TEXT NOT NULL, ersatter INTEGER NOT NULL DEFAULT 0, skapad TEXT NOT NULL, av TEXT NOT NULL,
  avslutad TEXT, avslutad_av TEXT, avslutad_orsak TEXT,
  CHECK (villkor IN ('under', 'over')), CHECK (niva IN ('larm', 'varning')), CHECK (antal BETWEEN 1 AND 3)
);
CREATE INDEX IF NOT EXISTS ix_iva_preg_pat ON iva_patientregler (patient_id);
CREATE TRIGGER IF NOT EXISTS iva_patientregler_andras_ej BEFORE UPDATE OF enhet_id, parameter, villkor, grans, antal, niva, gora, motivering, ersatter, skapad, av ON iva_patientregler
  BEGIN SELECT RAISE(ABORT, 'En regel ändras inte. Gör en ny regel.'); END;
CREATE TRIGGER IF NOT EXISTS iva_patientregler_avslut_en_gang BEFORE UPDATE OF avslutad, avslutad_av, avslutad_orsak ON iva_patientregler WHEN OLD.avslutad IS NOT NULL
  BEGIN SELECT RAISE(ABORT, 'En avslutad regel ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS iva_patientregler_raderas_ej BEFORE DELETE ON iva_patientregler
  BEGIN SELECT RAISE(ABORT, 'En regel raderas inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'iva_patientregler'").get());

// Ett tal ur ett fält: ett tal eller en text med decimalkomma. Allt annat (listor, objekt, tom text) är null, så att
// typen aldrig kan byta och slippa gränsen.
export function lasTal(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !/^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return null;
  return Number(v.trim().replace(',', '.'));
}
const lasText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const regelUt = (db, r) => {
  const d = PARAMETRAR[r.parameter];
  return {
    id: r.id, parameter: r.parameter, namn: d?.namn ?? r.parameter, villkor: r.villkor, grans: r.grans, enhet: d?.enhet ?? '', antal: r.antal, niva: r.niva, gora: r.gora,
    motivering: r.motivering, ersatter: Boolean(r.ersatter), skapad: r.skapad, av: personNamn(db, r.av), aktiv: !r.avslutad, avslutad: r.avslutad,
    text: `${d?.kort ?? r.parameter} ${VILLKOR[r.villkor]} ${talSv(r.grans, d?.decimaler ?? 1)} ${d?.enhet ?? ''}${r.antal > 1 ? ` i ${r.antal} värden i rad` : ''} ger ${NIVAER[r.niva].toLowerCase()}.`,
  };
};

// Reglerna som användaren får se (samma regler som mätvärden), aktiva först.
export function reglerFor(atk, { allaVersioner = false } = {}) {
  if (!finns(atk.db) || !kanRoll(atk.personal, 'las_matvarden')) return [];
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden');
  const rader = a.filtrera(atk.db.query('SELECT * FROM iva_patientregler WHERE patient_id = ? ORDER BY skapad DESC, id DESC').all(atk.patientId), 'las_matvarden');
  return rader.filter(r => allaVersioner || !r.avslutad).map(r => regelUt(atk.db, r));
}

// Avdelningens gräns i en riktning, eller null när avdelningen inte har någon.
export function standardGrans(parameter, villkor, params = iva.STANDARD) {
  const f = PARAMETRAR[parameter]?.standard?.[villkor];
  return f ? f(params) : null;
}

// POST /api/patient/:id/iva/regler { parameter, villkor, grans, antal?, niva?, gora?, motivering }. Läkaren sätter
// regeln. Systemet avgör om den ersätter avdelningens gräns, förklarar vad som ändras och avslutar en tidigare regel för
// samma parameter och riktning.
export function sparaRegel(atk, p, body = {}, nu = new Date()) {
  kravVardande(atk, 'ordinera', null, 'iva:regel');
  const db = atk.db;
  const falt = [];
  const parameter = typeof body.parameter === 'string' && Object.hasOwn(PARAMETRAR, body.parameter) ? body.parameter : null;
  if (!parameter) falt.push('parameter');
  const villkor = typeof body.villkor === 'string' && Object.hasOwn(VILLKOR, body.villkor) ? body.villkor : null;
  if (!villkor) falt.push('villkor');
  const grans = lasTal(body.grans);
  const d = parameter ? PARAMETRAR[parameter] : null;
  if (grans == null || (d && (grans < d.min || grans > d.max))) falt.push('grans');
  const antal = body.antal == null || body.antal === '' ? 1 : lasTal(body.antal);
  if (!Number.isInteger(antal) || antal < 1 || antal > 3) falt.push('antal');
  const niva = body.niva == null || body.niva === '' ? 'larm' : (typeof body.niva === 'string' && Object.hasOwn(NIVAER, body.niva) ? body.niva : null);
  if (!niva) falt.push('niva');
  const motivering = lasText(body.motivering, 300);
  if (motivering.length < 3) falt.push('motivering');
  if (falt.length) {
    const namn = { parameter: 'vilken parameter regeln gäller', villkor: 'om värdet ska vara under eller över gränsen', grans: d ? `gränsen, ett tal mellan ${d.min} och ${d.max} ${d.enhet}` : 'gränsen', antal: 'antal värden i rad, 1 till 3', niva: 'larm eller varning', motivering: 'varför patienten har en egen gräns' };
    throw new Fel(400, `Kontrollera ${falt.map(f => namn[f]).join(', ')}.`, 'ogiltig', { falt });
  }
  const params = iva.parametrar(db, nu);
  const std = standardGrans(parameter, villkor, params);
  const ersatter = std != null;
  const gora = lasText(body.gora, 200) || null;
  const t = nu.toISOString();
  const id = db.transaction(() => {
    // En tidigare regel för samma parameter och riktning på patienten avslutas. Bara de som användaren får se, så att en
    // regel på en spärrad vårdenhet varken avslutas eller röjs.
    for (const r of reglerFor(atk).filter(x => x.parameter === parameter && x.villkor === villkor)) {
      db.query('UPDATE iva_patientregler SET avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ? AND avslutad IS NULL').run(t, atk.personal.id, 'Ersatt av en ny regel', r.id);
    }
    return Number(db.query(`INSERT INTO iva_patientregler (patient_id, enhet_id, parameter, villkor, grans, antal, niva, gora, motivering, ersatter, skapad, av)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(atk.patientId, atk.personal.enhet_id, parameter, villkor, grans, antal, niva, gora, motivering, ersatter ? 1 : 0, t, atk.personal.id).lastInsertRowid);
  })();
  atk.logga('ordinera', atk.grund(), `iva:regel:${id}`);
  const r = regelUt(db, db.query('SELECT * FROM iva_patientregler WHERE id = ?').get(id));
  const fmt = (v) => `${talSv(v, d.decimaler)} ${d.enhet}`;
  let forklaring = '';
  if (ersatter) {
    const mildare = villkor === 'under' ? grans < std : grans > std;
    forklaring = ` Den ersätter avdelningens gräns ${fmt(std)} för patienten.${mildare ? ` Gränsen är ${villkor === 'under' ? 'lägre' : 'högre'} än avdelningens, så systemet larmar senare för patienten än för andra.` : grans === std ? '' : ' Systemet larmar tidigare för patienten än för andra.'}`;
  } else forklaring = ' Avdelningen har ingen gräns i den riktningen, så regeln läggs till.';
  return { regel: r, regler: reglerFor(atk), text: `Regeln gäller från nu: ${r.text}${forklaring} Monitorn larmar efter samma gräns.` };
}

// POST /api/patient/:id/iva/regler/:rid/avsluta { orsak? }. Avdelningens gräns gäller igen.
export function avslutaRegel(atk, rid, body = {}, nu = new Date()) {
  kravVardande(atk, 'ordinera', null, 'iva:regel');
  const db = atk.db;
  const r = reglerFor(atk).find(x => x.id === Number(rid));
  if (!r) throw new Fel(404, 'Regeln finns inte, eller är redan avslutad.', 'saknas');
  db.query('UPDATE iva_patientregler SET avslutad = ?, avslutad_av = ?, avslutad_orsak = ? WHERE id = ? AND avslutad IS NULL').run(nu.toISOString(), atk.personal.id, lasText(body.orsak, 200) || 'Avslutad', r.id);
  atk.logga('ordinera', atk.grund(), `iva:regel:${r.id}:avsluta`);
  return { regler: reglerFor(atk), text: `Regeln är avslutad. ${r.ersatter ? 'Avdelningens gräns gäller igen.' : ''}`.trim() };
}

// Gränserna som gäller för patienten per parameter och riktning: patientens egen regel när den finns, annars
// avdelningens. Används av monitorns larm i realtidsvisningen.
export function gransFor(regler, params = iva.STANDARD) {
  const ut = {};
  for (const [parameter, d] of Object.entries(PARAMETRAR)) {
    ut[parameter] = {};
    for (const villkor of Object.keys(VILLKOR)) {
      const egen = regler.find(r => r.aktiv && r.parameter === parameter && r.villkor === villkor);
      const std = standardGrans(parameter, villkor, params);
      if (egen) ut[parameter][villkor] = { grans: egen.grans, kalla: 'patient', regelId: egen.id, niva: egen.niva, text: `patientens gräns ${talSv(egen.grans, d.decimaler)} ${d.enhet}`,
        ...(std != null ? { avdelningen: std, avdelningenText: `avdelningens gräns ${talSv(std, d.decimaler)} ${d.enhet}` } : {}) };
      else if (std != null) ut[parameter][villkor] = { grans: std, kalla: 'avdelning', niva: parameter === 'temp' ? 'varning' : 'larm', text: `avdelningens gräns ${talSv(std, d.decimaler)} ${d.enhet}` };
    }
  }
  return ut;
}

const vardeAv = (m, parameter) => (parameter === 'map' ? iva.map(m.varde) : m.varde_num ?? Number(m.varde));

// Lägger patientens regler till analysen. analys är resultatet av iva.analysera med avdelningens gränser. Patientens
// regler prövas mot de senaste godkända värdena (samma fönster på sex timmar som analysen). Ett larm stängs aldrig av
// tyst: när patientens gräns är mildare än avdelningens och bara avdelningens gräns bryts, blir fyndet en observation som
// säger vilken gräns som gäller för patienten och varför, i stället för att försvinna.
export function tillampa(regler, analys, { rader, nu = new Date() }) {
  const aktiva = regler.filter(r => r.aktiv);
  if (!aktiva.length) return analys;
  const godkanda = [...rader].filter(kvalitetssakrad).filter(m => Date.parse(m.tid) <= nu.getTime() && Date.parse(m.tid) > nu.getTime() - 6 * TIMME)
    .sort((a, b) => b.tid.localeCompare(a.tid) || b.id - a.id);
  const senaste = (typ) => godkanda.find(m => m.typ === typ) ?? null;
  // Den mildare patientregel som gäller för ett fynd från avdelningens regler, eller null. För regler som gäller båda
  // riktningarna (puls och andningsfrekvens) avgör det senaste värdet riktningen.
  const mildareFor = (fynd) => aktiva.find(r => {
    const d = PARAMETRAR[r.parameter];
    if (!r.ersatter || d.standardRegel[r.villkor] !== fynd.regel) return false;
    const std = standardGrans(r.parameter, r.villkor);
    const mildare = r.villkor === 'under' ? r.grans < std : r.grans > std;
    if (!mildare) return false;
    const m = senaste(d.typ);
    const v = m ? vardeAv(m, r.parameter) : null;
    if (v == null) return false;
    // Värdet bryter avdelningens gräns i patientregelns riktning men inte patientens egen gräns.
    const iRiktning = r.villkor === 'under' ? v < std : v > std;
    const bryterEgen = r.villkor === 'under' ? v < r.grans : v > r.grans;
    return iRiktning && !bryterEgen;
  }) ?? null;
  const ut = analys.map(f => {
    const r = f.niva === 'larm' || f.niva === 'varning' ? mildareFor(f) : null;
    if (!r) return f;
    return { ...f, niva: 'observation', avdelningensNiva: f.niva, patientregelId: r.id,
      text: `${f.text} Avdelningens gräns skulle ha gett ${NIVAER[f.niva].toLowerCase()}, men för patienten gäller en egen gräns: ${r.text} Motivering: ${r.motivering}`,
      gora: 'Följ patientens egen gräns. Är motiveringen inte längre giltig, ska läkaren avsluta regeln.' };
  });
  for (const r of aktiva) {
    const d = PARAMETRAR[r.parameter];
    const varden = godkanda.filter(m => m.typ === d.typ).map(m => ({ m, v: vardeAv(m, r.parameter) })).filter(x => x.v != null).slice(0, r.antal);
    if (varden.length < r.antal) continue;
    if (Date.parse(varden[0].m.tid) - Date.parse(varden.at(-1).m.tid) > TIMME) continue;
    const bryter = varden.every(x => (r.villkor === 'under' ? x.v < r.grans : x.v > r.grans));
    if (!bryter) continue;
    const vtext = varden.map(x => `${talSv(x.v, d.decimaler)} ${d.enhet} kl. ${klocka(x.m.tid)}`).join(' och ');
    ut.push({
      niva: r.niva, regel: 'patient', regelId: r.id, patientregel: true,
      text: `${d.kort} ${vtext}, ${VILLKOR[r.villkor]} patientens gräns ${talSv(r.grans, d.decimaler)} ${d.enhet} (${r.av ?? 'läkaren'}, ${datumText(r.skapad)}).`,
      gora: r.gora || (r.niva === 'larm' ? 'Bedöm patienten nu och kontakta ansvarig läkare.' : 'Kontrollera värdet igen och följ patientens plan.'),
    });
  }
  const ordning = { larm: 0, varning: 1, forslag: 2, observation: 3 };
  return ut.sort((x, y) => ordning[x.niva] - ordning[y.niva]);
}

// Kroken i iva.js: patientens regler läggs till analysen i översikten och övervakningen. Avdelningens gränser används
// alltid i iva.analysera, så att inget larm försvinner.
export const analysFor = (atk, analys, x) => tillampa(reglerFor(atk), analys, x);

// Behandlingsbegränsningarna ur uppmärksamhetsinformationen (undergruppen Beslut i Socialstyrelsens kodverkslista), så
// att de står överst för den som vårdar patienten. Bara det som användaren får se.
export function behandlingsbegransningar(atk) {
  if (!kanRoll(atk.personal, 'las_oversikt')) return [];
  const a = new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_oversikt');
  if (!a.prova('las_oversikt').tillaten) return [];
  const h = uppmarksamhet.forHuvud(a);
  return (h?.poster ?? []).filter(x => x.undergrupp === 'beslut').map(x => ({ term: x.term, tid: x.registrerad?.tid ?? null, vardenhet: x.registrerad?.vardenhet?.namn ?? null, av: x.registrerad?.av ?? null }));
}

// Underlaget för överrapportering enligt SBAR (situation, bakgrund, aktuellt tillstånd och rekommendation), som systemet
// skriver ur övervakningen och journalen. Bara det som användaren får se.
export function overrapportering(atk, ov, { begransningar = [], regler = [], vatska = null, nems = null } = {}) {
  const db = atk.db;
  const diagnoser = kanRoll(atk.personal, 'las_diagnoser') ? journal.synligaDiagnoser(new Atkomst(db, atk.personal, atk.patientId, atk.val, 'las_diagnoser')) : [];
  // Vårdkontakten prövas i behörighetsmotorn, så att orsak och tid från en spärrad vårdenhet eller en som kräver aktivt
  // val aldrig kommer med.
  const vk = iva.ivaKontaktFor(atk);
  const v = ov.varden;
  const varde = (typ, namn, enhet, d = 0) => (v[typ] ? `${namn} ${typ === 'blodtryck' ? `${v[typ].varde} (MAP ${v[typ].map})` : talSv(v[typ].varde, d)} ${enhet} kl. ${klocka(v[typ].tid)}${v[typ].godkand ? '' : ', inte godkänt'}` : null);
  const situation = [
    `${ov.patient.namn}, ${ov.patient.personnummer}${ov.patient.plats ? `, ${ov.patient.plats}` : ''}.`,
    vk ? `Vårdas på intensivvårdsavdelningen sedan ${datumText(vk.start)} kl. ${klocka(vk.start)}${vk.orsak ? ` för ${vk.orsak.charAt(0).toLowerCase()}${vk.orsak.slice(1)}` : ''}.` : null,
    ...begransningar.map(b => `${b.term}.`),
  ].filter(Boolean);
  const bakgrund = diagnoser.length ? [`Diagnoser: ${[...new Map(diagnoser.map(d => [d.kod, `${d.kod} ${d.text}`])).values()].slice(0, 6).join(', ')}.`] : ['Inga diagnoser som du kan se.'];
  const aktuellt = [
    [varde('blodtryck', 'Blodtryck', 'mmHg'), varde('puls', 'puls', 'slag/min'), varde('saturation', 'syremättnad', '%'), varde('andningsfrekvens', 'andningsfrekvens', 'andetag/min'), varde('temp', 'temperatur', '°C', 1)].filter(Boolean).join(', ') || 'Inga värden de senaste timmarna.',
    ...ov.infusioner.map(i => `${i.lakemedel} ${talSv(i.dos, 3)} ${i.dosEnhet}, ${talSv(i.mlH, 1)} ml/h.`),
    vatska ? `Vätskebalans det senaste dygnet ${vatska.balansMedPerspiratio > 0 ? '+' : ''}${talSv(vatska.balansMedPerspiratio, 0)} ml med perspiratio.` : `Vätskebalans det senaste dygnet ${ov.vatska.balans > 0 ? '+' : ''}${talSv(ov.vatska.balans, 0)} ml.`,
    ...(nems?.senaste ? [`Vårdtyngd NEMS ${nems.senaste.poang} poäng (${nems.senaste.dygn}).`] : []),
    ...regler.filter(r => r.aktiv).map(r => `Egen gräns: ${r.text}`),
  ];
  const rekommendation = ov.analys.length ? ov.analys.map(a => `${a.text}${a.gora ? ` ${a.gora}` : ''}`) : ['Inga larm eller förslag just nu. Fortsätt enligt plan.'];
  const text = [['Situation', situation], ['Bakgrund', bakgrund], ['Aktuellt tillstånd', aktuellt], ['Rekommendation', rekommendation]].map(([r, rad]) => `${r}\n${rad.join('\n')}`).join('\n\n');
  return { situation, bakgrund, aktuellt, rekommendation, text, tid: iso() };
}

export { vardenhetFor };
