// Uppföljning av läkemedelsprocessen på vårdgivarens nivå (runda 9, r1, Sussa 3.5.2.20): per läkemedel förskrivning,
// administrering och utvärdering över alla vårdenheter hos vårdgivaren, utan personuppgifter.
//
// Systemet är experten. Siffrorna räknas av systemet ur ordinationerna, doserna och utvärderingarna, och systemet
// visar per läkemedel hur många vårdenheter som förskriver det, andelen utvärderade ordinationer, effekten och
// biverkningarna och var uppföljningen har passerat. Ett antal patienter som är mindre än tre visas inte, så att ingen
// enskild patient kan pekas ut. Användaren väljer bara perioden.
//
// Behörighet. Statistiken för vårdgivaren kräver statistik_region (uppföljningen). Läsningen loggas utan patient.
// Doser som har makulerats räknas inte.
import { Fel, idag, addDagar } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';
import { huvudman } from './lagring.js';

export const MINSTA_ANTAL = 3;
export const PERIODER = [30, 90, 365];
const katalog = (db, id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);

export function vardgivarniva(db, personal, { dagar = 90 } = {}, nu = new Date()) {
  if (!kanRoll(personal, 'statistik_region')) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik_region', resurs: 'lakemedelsuppfoljning:vardgivare', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'Uppföljningen av läkemedel på vårdgivarens nivå är för uppföljningen.', 'nekad');
  }
  const period = PERIODER.includes(Number(dagar)) ? Number(dagar) : 90;
  const hm = huvudman(db);
  const min = hm.get(personal.enhet_id);
  const iVardgivaren = (enhetId) => hm.get(enhetId) === min;
  const fran = addDagar(idag(), -period);
  const franIso = new Date(nu.getTime() - period * 86400_000).toISOString();
  const ord = db.query('SELECT * FROM ordinationer').all().filter(o => iVardgivaren(o.enhet_id));
  const makulerade = new Set(db.query("SELECT post_id FROM makuleringar WHERE typ = 'administrering'").all().map(r => r.post_id));
  const doser = db.query("SELECT id, ordination_id, lakemedel_id, patient_id, enhet_id FROM administreringar WHERE status IN ('given', 'overlamnad') AND tid >= ?").all(franIso)
    .filter(a => iVardgivaren(a.enhet_id) && !makulerade.has(a.id));
  const per = new Map();
  const rad = (k, lm) => per.get(k) ?? per.set(k, { substans: k, atc: lm?.atc ?? null, forskrivna: 0, nya: 0, pagaende: 0, vardenheter: new Set(), patienter: new Set(), doser: 0,
    utvarderade: 0, effekt: { god: 0, delvis: 0, ingen: 0, for_tidigt: 0 }, biverkningar: 0, passerade: 0 }).get(k);
  for (const o of ord) {
    const lm = katalog(db, o.lakemedel_id);
    const r = rad(lm?.substans ?? o.lakemedel_id, lm);
    const aktiv = o.status === 'aktiv' && (!o.slut || o.slut >= idag());
    if (!aktiv && (o.skapad ?? '') < franIso) continue;
    r.forskrivna++;
    if ((o.skapad ?? '') >= franIso) r.nya++;
    if (aktiv) r.pagaende++;
    if (aktiv && o.uppfoljning < idag()) r.passerade++;
    r.vardenheter.add(vardenhetFor(db, o.enhet_id));
    r.patienter.add(o.patient_id);
    const u = db.query('SELECT * FROM lakemedelsutvarderingar WHERE ordination_id = ? ORDER BY tid DESC, id DESC').get(o.id);
    if (u) { r.utvarderade++; r.effekt[u.effekt] = (r.effekt[u.effekt] ?? 0) + 1; if (u.biverkan !== 'ingen') r.biverkningar++; }
  }
  for (const a of doser) {
    const lm = katalog(db, a.lakemedel_id);
    const k = lm?.substans ?? a.lakemedel_id;
    if (!per.has(k)) continue;
    per.get(k).doser++;
  }
  const rader = [...per.values()].filter(r => r.forskrivna > 0).map(r => {
    const fa = r.patienter.size < MINSTA_ANTAL;
    return {
      substans: r.substans, atc: r.atc, vardenheter: r.vardenheter.size, forskrivna: fa ? null : r.forskrivna, nya: fa ? null : r.nya, pagaende: fa ? null : r.pagaende,
      patienter: fa ? null : r.patienter.size, faPatienter: fa, doser: fa ? null : r.doser, utvarderade: fa ? null : r.utvarderade,
      andelUtvarderade: fa || !r.forskrivna ? null : Math.round(r.utvarderade / r.forskrivna * 100), andelGodEffekt: fa || !r.utvarderade ? null : Math.round(r.effekt.god / r.utvarderade * 100),
      effekt: fa ? null : r.effekt, biverkningar: fa ? null : r.biverkningar, passerade: fa ? null : r.passerade,
    };
  }).sort((a, b) => (b.patienter ?? 0) - (a.patienter ?? 0) || a.substans.localeCompare(b.substans, 'sv'));
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik_region', resurs: 'lakemedelsuppfoljning:vardgivare', grund: 'uppfoljning', resultat: 'tillaten' });
  return {
    niva: 'vardgivare', vardgivare: db.query('SELECT namn FROM enheter WHERE id = ?').get(min)?.namn ?? null, dagar: period, fran, perioder: PERIODER, minstaAntal: MINSTA_ANTAL, rader,
    summa: { forskrivna: rader.reduce((s, r) => s + (r.forskrivna ?? 0), 0), doser: rader.reduce((s, r) => s + (r.doser ?? 0), 0), utvarderade: rader.reduce((s, r) => s + (r.utvarderade ?? 0), 0) },
    anmarkning: `Räknat ur ordinationer, givna doser och utvärderingar på alla vårdenheter hos vårdgivaren de senaste ${period} dagarna, och de ordinationer som pågår. Ett läkemedel med färre än ${MINSTA_ANTAL} patienter visas bara med antal vårdenheter. Inga personuppgifter.`,
  };
}
