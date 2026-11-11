// Runda 11, r7: realtidsvisning med vågformer från den simulerade patientmonitorn (Sussa 4.6.1.2).
//
// En kopplad monitor skickar var femte minut värden till journalen genom mottagningen (medicinteknik.js). Mellan dem
// visar övervakningen det monitorn visar vid sängen: EKG, artärtryck, pletysmografi för syremättnaden och andningen som
// vågformer de senaste sekunderna, de aktuella siffrorna och monitorns larm. Vågformerna och siffrorna räknas fram av
// den simulerade monitorn ur samma grundvärden som den skickar till journalen, så att kurvorna följer patientens puls,
// blodtryck och andning. Ingen riktig utrustning är ansluten.
//
// Realtidsvärdena sparas inte i journalen och är aldrig godkända. Monitorns larm prövas mot de gränser som gäller för
// patienten (patientens egna regler eller avdelningens gränser, iva-patientregler.js), så att larmet vid sängen och
// larmet i journalen följer samma regel. Systemet larmar inte i journalen på ett realtidsvärde.
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as mt from './medicinteknik.js';
import * as iva from './iva.js';
import * as regler from './iva-patientregler.js';

export const SEKUNDER = 8;
export const HZ = { ekg: 100, art: 50, pleth: 50, andning: 25 };
export const UPPDATERING_SEKUNDER = 3;
export const DEMO = 'Vågformerna och realtidsvärdena räknas fram av den simulerade monitorn. De sparas inte i journalen och är inte godkända.';

// Ett lugnt deterministiskt brus, så att samma koppling och tid alltid ger samma kurva.
const brus = (fro, x) => Math.sin(fro * 12.9898 + x * 0.731) * 0.6 + Math.sin(fro * 4.1414 + x * 2.177) * 0.4;
const gauss = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// Tiden sedan senaste slaget och slagets längd vid tiden t (sekunder). Slagen ligger på ett fast rutnät med
// periodlängden 60/puls, med en liten variation från slag till slag.
function slag(t, puls, fro) {
  const rr = 60 / Math.max(20, puls);
  const n = Math.floor(t / rr);
  const forskj = brus(fro, n) * 0.02 * rr;
  let start = n * rr + forskj;
  if (t < start) start -= rr;
  return { sedan: t - start, rr };
}

// EKG (avledning II) i mV: P, Q, R, S och T som gaussiska vågor kring R-taggen. T-vågen flyttas med slagets längd.
export function ekgVarde(t, puls, fro = 0) {
  const { sedan, rr } = slag(t + 0.25, puls, fro);
  const x = sedan - 0.25;
  const tPos = 0.16 + 0.1 * Math.sqrt(rr);
  return 0.12 * gauss(x, -0.17, 0.025) - 0.12 * gauss(x, -0.03, 0.01) + 1.0 * gauss(x, 0, 0.011) - 0.25 * gauss(x, 0.032, 0.012) + 0.3 * gauss(x, tPos, 0.045)
    + brus(fro + 7, t * 40) * 0.01;
}
// Pulsvågen relativt (0 till 1), 0,2 sekunder efter R-taggen, med dikrot incisur.
function pulsvag(t, puls, fro) {
  const { sedan } = slag(t - 0.2, puls, fro);
  return Math.min(1, gauss(sedan, 0.12, 0.06) + 0.35 * gauss(sedan, 0.34, 0.07));
}
// Artärtrycket i mmHg mellan diastoliskt och systoliskt tryck.
export const artVarde = (t, puls, sys, dia, fro = 0) => dia + (sys - dia) * pulsvag(t, puls, fro);
// Pletysmografin relativt (0 till 1), något efter artärtrycket.
export const plethVarde = (t, puls, fro = 0) => pulsvag(t - 0.08, puls, fro);
// Andningen (impedans), relativ, med andningsfrekvensen.
export const andningVarde = (t, af, fro = 0) => 0.5 + 0.45 * Math.sin((2 * Math.PI * af * t) / 60) * (1 + brus(fro + 3, Math.floor((t * af) / 60)) * 0.1);

// Vågformerna för de senaste SEKUNDER sekunderna fram till slutMs. Ger en lista med värden per kurva och frekvensen.
export function vagformer({ puls, sys, dia, af }, slutMs, fro = 0, sekunder = SEKUNDER) {
  const t0 = slutMs / 1000 - sekunder;
  const serie = (hz, f, d) => Array.from({ length: sekunder * hz }, (_, i) => r(f(t0 + i / hz), d));
  return {
    start: new Date(t0 * 1000).toISOString(), slut: new Date(slutMs).toISOString(), sekunder,
    kurvor: [
      { id: 'ekg', namn: 'EKG II', enhet: 'mV', hz: HZ.ekg, varden: serie(HZ.ekg, (t) => ekgVarde(t, puls, fro), 3) },
      { id: 'art', namn: 'Artärtryck', enhet: 'mmHg', hz: HZ.art, varden: serie(HZ.art, (t) => artVarde(t, puls, sys, dia, fro), 1) },
      { id: 'pleth', namn: 'Pletysmografi (SpO₂)', enhet: '', hz: HZ.pleth, varden: serie(HZ.pleth, (t) => plethVarde(t, puls, fro), 3) },
      { id: 'andning', namn: 'Andning', enhet: '', hz: HZ.andning, varden: serie(HZ.andning, (t) => andningVarde(t, af, fro), 3) },
    ],
  };
}

// Värdena som monitorn visar vid tiden nu: grundvärdena ur den senaste simuleringen med en liten variation var tionde
// sekund. Ett värde från bundle från den simulerade monitorn läses med samma koder som mottagningen.
export function realtidsvarden(db, u, k, nu) {
  const b = mt.simuleradMonitor(db, u, k, nu.toISOString());
  const obs = (kod) => b.entry.map(e => e.resource).find(x => x.code?.coding?.[0]?.code === kod);
  const tal = (kod) => obs(kod)?.valueQuantity?.value ?? null;
  const bt = obs('150020')?.component ?? [];
  const steg = Math.floor(nu.getTime() / 10_000);
  const v = (bas, skala) => (bas == null ? null : bas + Math.round(brus(k.id + 11, steg) * skala));
  const sys = v(bt.find(c => c.code.coding[0].code === '150021')?.valueQuantity.value, 3);
  const dia = v(bt.find(c => c.code.coding[0].code === '150022')?.valueQuantity.value, 2);
  return {
    puls: v(tal('147842'), 2), saturation: Math.min(100, v(tal('150456'), 1)), andningsfrekvens: Math.max(4, v(tal('151562'), 1)),
    temp: tal('150364'), sys, dia: Math.min(dia, sys - 10), map: iva.map(`${sys}/${Math.min(dia, sys - 10)}`),
  };
}

const NAMN = { map: ['MAP', 'mmHg'], saturation: ['SpO₂', '%'], puls: ['Puls', 'slag/min'], andningsfrekvens: ['Andning', 'andetag/min'], temp: ['Temp', '°C'] };
const talSv = (v, d = 0) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
// Monitorns larm: realtidsvärdena mot gränserna som gäller för patienten.
export function monitorlarm(varden, granser) {
  const ut = [];
  for (const [parameter, g] of Object.entries(granser)) {
    const v = varden[parameter];
    if (v == null) continue;
    const [n, e] = NAMN[parameter];
    const d = parameter === 'temp' ? 1 : 0;
    for (const [villkor, ord, bryter] of [['under', 'under', (x) => v < x], ['over', 'över', (x) => v > x]]) {
      const x = g[villkor];
      if (!x) continue;
      if (bryter(x.grans)) ut.push({ parameter, niva: x.niva, kalla: x.kalla, text: `${n} ${talSv(v, d)} ${e} ${ord} ${x.text}.` });
      // En mildare egen gräns stänger aldrig av larmet tyst: monitorn säger att avdelningens gräns är bruten och vilken
      // gräns som gäller för patienten.
      else if (x.avdelningen != null && bryter(x.avdelningen)) ut.push({ parameter, niva: 'observation', kalla: 'avdelning', text: `${n} ${talSv(v, d)} ${e} ${ord} ${x.avdelningenText}. För patienten gäller ${x.text}.` });
    }
  }
  const ordning = { larm: 0, varning: 1, observation: 2 };
  return ut.sort((a, b) => ordning[a.niva] - ordning[b.niva]);
}

// GET /api/patient/:id/iva/realtid. Monitorn är den som är kopplad till patienten nu och syns för användaren. En monitor
// på en vårdenhet som användaren inte får se behandlas som ingen monitor, så att inget röjs.
export function realtid(atk, nu = new Date()) {
  atk.krav('las_matvarden');
  const db = atk.db;
  if (!mt.finns(db)) return { kopplad: false, text: 'Ingen patientmonitor är kopplad.', demo: DEMO };
  const k = db.query(`SELECT k.* FROM mt_kopplingar k JOIN mt_utrustning u ON u.id = k.utrustning_id WHERE k.patient_id = ? AND k.slut IS NULL AND u.typ = 'monitor' AND k.start <= ?
    ORDER BY k.start DESC`).all(atk.patientId, nu.toISOString()).find(x => atk.prova('las_matvarden', { enhet_id: x.enhet_id }).tillaten);
  if (!k) return { kopplad: false, text: 'Ingen patientmonitor är kopplad. Koppla monitorn vid sängen genom att skanna dess streckkod under Mätvärden och utrustning, så visas kurvorna i realtid.', demo: DEMO };
  const u = mt.utrustningRad(db, k.utrustning_id);
  const varden = realtidsvarden(db, u, k, nu);
  const pr = regler.reglerFor(atk);
  const granser = regler.gransFor(pr, iva.parametrar(db, nu));
  const v = vagformer({ puls: varden.puls, sys: varden.sys, dia: varden.dia, af: varden.andningsfrekvens }, nu.getTime(), k.id);
  return {
    kopplad: true, monitor: { id: u.id, modell: u.modell, serienummer: u.serienummer, sedan: k.start }, tid: nu.toISOString(), varden, granser,
    larm: monitorlarm(varden, granser), ...v, uppdateraSekunder: UPPDATERING_SEKUNDER, demo: DEMO,
    text: pr.some(x => x.aktiv) ? 'Monitorns larmgränser följer patientens egna regler och avdelningens gränser.' : 'Monitorns larmgränser följer avdelningens gränser.',
  };
}

export const harMonitor = (atk) => kanRoll(atk.personal, 'las_matvarden');
export { Fel };
