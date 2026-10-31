// Mätvärden: senaste per typ med en enkel trend, hela tabellen och registrering av nytt värde.
import { esc, api, tidpunkt, datum, notis, medKnapp, migreradEtikett, tal } from '../ui.js';
import { far } from '../app.js';
import { doldaRad } from './patient.js';
import { varde } from './patient-oversikt.js';

// Typer och enheter enligt API:t.
export const MATTYPER = [
  ['blodtryck', 'Blodtryck', 'mmHg'], ['puls', 'Puls', 'slag/min'], ['temp', 'Temperatur', '°C'], ['saturation', 'Saturation', '%'],
  ['andningsfrekvens', 'Andningsfrekvens', 'andetag/min'], ['vikt', 'Vikt', 'kg'], ['langd', 'Längd', 'cm'], ['crp', 'CRP', 'mg/L'],
  ['egfr', 'eGFR', 'mL/min/1,73 m²'], ['kreatinin', 'Kreatinin', 'µmol/L'], ['hba1c', 'HbA1c', 'mmol/mol'], ['inr', 'PK (INR)', 'INR'],
  ['ntprobnp', 'NT-proBNP', 'ng/L'], ['hb', 'Hemoglobin', 'g/L'], ['glukos', 'Glukos', 'mmol/L'], ['kalium', 'Kalium', 'mmol/L'],
  ['pef', 'PEF', 'L/min'], ['troponin', 'Troponin T', 'ng/L'], ['tsh', 'TSH', 'mIE/L'],
];

// Tal ur ett värde. Blodtryck ger två serier.
const serier = (m) => {
  if (m.typ === 'blodtryck') { const [s, d] = String(m.varde).split('/').map(Number); return [s, d]; }
  return [Number(m.varde)];
};

// En liten trendlinje med punkter. Äldst till vänster. Texten bredvid bär värdet; grafen är ett stöd.
function trend(rader, namn) {
  const r = [...rader].reverse().slice(-12);
  if (r.length < 2) return '<span class="dampad liten">Ett värde, ingen trend än</span>';
  const B = 168, H = 44, P = 5;
  const varden = r.map(serier);
  const alla = varden.flat().filter(Number.isFinite);
  let min = Math.min(...alla), max = Math.max(...alla);
  if (max === min) { max += 1; min -= 1; }
  const t0 = Date.parse(r[0].tid), t1 = Date.parse(r.at(-1).tid);
  const x = (t) => P + (t1 === t0 ? 0.5 : (Date.parse(t) - t0) / (t1 - t0)) * (B - 2 * P);
  const y = (v) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const linjer = varden[0].map((_, s) => {
    const pts = r.map((m, i) => [x(m.tid), y(varden[i][s])]);
    return `<polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" class="trend-linje${s ? ' trend-andra' : ''}"/>${pts.map(([a, b]) => `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="2.2" class="trend-punkt${s ? ' trend-andra' : ''}"/>`).join('')}`;
  }).join('');
  const besk = `${namn}: ${r.length} värden från ${datum(r[0].tid)} till ${datum(r.at(-1).tid)}, lägst ${tal(min, 2)} och högst ${tal(max, 2)}.`;
  return `<svg class="trend" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" aria-label="${esc(besk)}"><line x1="${P}" x2="${B - P}" y1="${H - P}" y2="${H - P}" class="trend-bas"/>${linjer}</svg>`;
}

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/matvarden`);
  if (!ctx.aktuell()) return;
  const perTyp = new Map();
  for (const m of d.matvarden) { if (!perTyp.has(m.typ)) perTyp.set(m.typ, []); perTyp.get(m.typ).push(m); }
  const kanReg = far('registrera_matvarde');
  el.innerHTML = `<div class="flikhuvud"><h2>Mätvärden</h2></div>${doldaRad(d.dolda)}
    ${kanReg ? registrering() : ''}
    ${perTyp.size ? `<section aria-labelledby="mv-trend"><h3 id="mv-trend">Senaste värde och trend</h3>
      <div class="tabellrulle"><table class="tabell mv-tabell">
        <thead><tr><th scope="col">Mätvärde</th><th scope="col">Senaste</th><th scope="col">Uppmätt</th><th scope="col">Trend, senaste 12 värdena</th><th scope="col">Antal</th></tr></thead>
        <tbody>${[...perTyp].map(([, rader]) => `<tr><th scope="row">${esc(rader[0].namn)}</th><td class="mv-varde">${varde(rader[0])}</td><td>${esc(tidpunkt(rader[0].tid))}<span class="under-text">${esc(rader[0].vardenhet.namn)}</span></td><td>${trend(rader, rader[0].namn)}${rader[0].typ === 'blodtryck' ? '<span class="under-text">Övre linjen systoliskt, nedre diastoliskt</span>' : ''}</td><td>${rader.length}</td></tr>`).join('')}</tbody>
      </table></div></section>
    <section aria-labelledby="mv-alla"><h3 id="mv-alla">Alla värden</h3>
      <div class="tabellrulle"><table class="tabell tat">
        <thead><tr><th scope="col">Tid</th><th scope="col">Mätvärde</th><th scope="col">Värde</th><th scope="col">Enhet där det togs</th><th scope="col">Registrerat av</th></tr></thead>
        <tbody>${d.matvarden.map(m => `<tr><td>${esc(tidpunkt(m.tid))}</td><td>${esc(m.namn)}</td><td>${varde(m)}</td><td>${esc(m.vardenhet.namn)}${migreradEtikett(m)}</td><td>${esc(m.registreradAv?.namn ?? '')}</td></tr>`).join('')}</tbody>
      </table></div></section>` : '<p class="tom">Inga mätvärden som du kan se.</p>'}`;

  const form = el.querySelector('#mv-form');
  if (!form) return;
  const enhet = form.querySelector('#mv-enhet');
  const satt = () => { const t = MATTYPER.find(m => m[0] === form.typ.value); enhet.textContent = t[2]; form.varde.placeholder = t[0] === 'blodtryck' ? '120/80' : ''; form.varde.inputMode = t[0] === 'blodtryck' ? 'text' : 'decimal'; };
  form.typ.addEventListener('change', satt);
  satt();
  // Från snabbvalet Registrera mätvärde i översikten (matvarden/ny) får värdefältet fokus. Blodtryck är förvalt.
  if (ctx.sub === 'ny') form.varde.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typ = form.typ.value;
    const v = form.varde.value.trim();
    if (!v) { form.varde.setAttribute('aria-invalid', 'true'); form.varde.focus(); return; }
    const data = { typ, varde: typ === 'blodtryck' ? v : Number(v.replace(',', '.')) };
    if (form.tid.value) data.tid = new Date(form.tid.value).toISOString();
    try {
      const m = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/matvarden`, { metod: 'POST', data }), form);
      notis(`${m.namn} ${m.varde} ${m.enhet} är registrerat.`);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}

function registrering() {
  return `<form class="mv-form" id="mv-form" novalidate aria-labelledby="mv-reg">
    <h3 id="mv-reg">Registrera mätvärde</h3>
    <div class="falt-rad">
      <div class="falt"><label for="mv-typ">Mätvärde</label><select id="mv-typ" name="typ">${MATTYPER.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></div>
      <div class="falt smal"><label for="mv-varde">Värde</label><div class="med-enhet"><input id="mv-varde" name="varde" required autocomplete="off" aria-describedby="mv-enhet"><span id="mv-enhet" class="enhet"></span></div></div>
      <div class="falt"><label for="mv-tid">Tidpunkt</label><input id="mv-tid" name="tid" type="datetime-local" aria-describedby="mv-tid-h"><span class="hjalp" id="mv-tid-h">Tomt betyder nu. Högst 30 dagar bakåt.</span></div>
      <div class="falt knappfalt"><button type="submit" class="knapp">Registrera</button></div>
    </div>
    <p class="form-fel" role="alert" hidden></p>
  </form>`;
}
