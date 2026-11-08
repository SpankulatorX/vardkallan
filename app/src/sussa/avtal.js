// Runda 7, r7: viktningen, Cambios svar, avtalets signaler och bör-kraven för Sussa-registret (K2, K3 och K5).
// Datat ligger i egna filer: vikter.js (viktningsträdet och Cambios betyg), avtalssvar.js (Cambios svar per post),
// avtalssignaler.js (vad som togs bort ur avtalet eller sköts upp 2022) och borkrav.js (bör-krav och målbild).
// index.js lägger till avtalPost(id) på varje post och avtalRegister(poster) på registret.
import { TRAD, CAMBIO, MODELL, AVVIKELSER_6A, KALLA as VIKTKALLA, KALLA_BETYG, KALLA_MOTIVERING } from './vikter.js';
import SVAR, { A1, KALLA as SVARSKALLA } from './avtalssvar.js';
import SIGNALER, { KALLOR as SIGNALKALLOR, TYPER as SIGNALTYPER } from './avtalssignaler.js';
import BORKRAV, { UTELAMNADE } from './borkrav.js';

export { SVAR, SIGNALER, BORKRAV, UTELAMNADE, TRAD, CAMBIO, MODELL, AVVIKELSER_6A, A1, SIGNALTYPER };

const NOD = new Map(TRAD.map(([id, rubrik, vikt]) => [id, { rubrik, vikt }]));

// Noderna i viktningsträdet från kapitlet ned till id, till exempel 3, 3.1, 3.1.1 och 3.1.1.3. Nivåer som inte har
// egen vikt i trädet (som 2.3.1) hoppas över, eftersom kriterierna där viktas direkt mot avsnittet.
export const noderOvanfor = (id) => {
  const d = id.split('.');
  return d.map((_, i) => d.slice(0, i + 1).join('.')).filter(x => NOD.has(x));
};

// Ett kriteriums vikt i hela kvalitetsbedömningen: produkten av vikterna längs vägen i trädet.
export const viktFor = (id) => (NOD.has(id) ? noderOvanfor(id).reduce((v, n) => v * NOD.get(n).vikt, 1) : null);

// Kriterierna är trädets löv med fyra nivåer. Rangen är 1 för det kriterium som Sussa värderade högst.
const KRITERIER = TRAD.filter(([id]) => id.split('.').length === 4).map(([id]) => ({ id, vikt: viktFor(id) }))
  .sort((a, b) => b.vikt - a.vikt || a.id.localeCompare(b.id, 'sv', { numeric: true }));
const RANG = new Map(KRITERIER.map((k, i) => [k.id, i + 1]));
export const VIKTADE = KRITERIER;

const avrunda = (x) => (x == null ? null : Math.round(x * 1e6) / 1e6);

// Vikten som bilaga 6a faktiskt räknade med, där den skiljer sig från trädet.
export const viktI6a = (id) => (id in AVVIKELSER_6A ? viktFor(id) * AVVIKELSER_6A[id] / NOD.get(id).vikt : viktFor(id));

export function avtalPost(id) {
  const b = CAMBIO[id];
  const svar = SVAR[id] ?? null;
  return {
    vikt: avrunda(viktFor(id)), viktRang: RANG.get(id) ?? null,
    betyg: b ? { poang: b[0], prispaslag: b[1], sida: b[2], motivering: svar?.motivering ?? null,
      viktIUtvarderingen: id in AVVIKELSER_6A ? avrunda(viktI6a(id)) : null } : null,
    avtal: svar, signaler: SIGNALER[id] ?? [],
  };
}

// En backloggrad har samma status som sina poster när de är lika, annars delvis.
const samladStatus = (lista) => (lista.length && lista.every(s => s === lista[0]) ? lista[0] : 'delvis');

export function avtalRegister(poster) {
  const status = new Map(poster.map(p => [p.id, p.status]));
  const svar = Object.values(SVAR);
  return {
    viktning: {
      kalla: VIKTKALLA, kallaBetyg: KALLA_BETYG, kallaMotivering: KALLA_MOTIVERING, modell: MODELL,
      antalViktade: KRITERIER.length, summaKriterier: avrunda(KRITERIER.reduce((s, k) => s + k.vikt, 0)),
    },
    avtal: {
      kalla: SVARSKALLA, a1: A1,
      summa: {
        ja: svar.filter(s => s.svar === 'ja').length, nej: svar.filter(s => s.svar === 'nej').length,
        sammanfattade: svar.filter(s => s.sammanfattning).length, maskerade: svar.filter(s => s.maskerat === 'helt').length,
        delvisMaskerade: svar.filter(s => s.maskerat === 'delvis').length,
      },
    },
    signalkallor: SIGNALKALLOR, signaltyper: SIGNALTYPER,
    borkrav: BORKRAV.map(b => ({ ...b, status: samladStatus(b.poster.map(id => status.get(id) ?? 'planerat')) })),
  };
}
