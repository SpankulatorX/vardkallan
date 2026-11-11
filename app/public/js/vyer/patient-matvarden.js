// Mätvärden (Sussa 3.1.3.9 och 3.1.3.5): NEWS2 som systemet räknar ur vitalparametrarna med vad som ska göras, en
// kurva per mätvärde med referensintervall, alla värden i en tabell och registrering av ett värde eller en hel
// NEWS2-kontroll. Medvetandegrad, GCS och smärta väljs i listor med text, och systemet räknar summan och poängen.
import { esc, api, tidpunkt, datum, notis, medKnapp, migreradEtikett, tal, ikon, faltFel } from '../ui.js';
// Runda 7, r2: hjälp i sammanhanget.
import { hjalpRuta } from '../hjalp.js';
import { far } from '../app.js';
import { doldaRad } from './patient.js';
import { varde as vardeHtml } from './patient-oversikt.js';
import { kontaktRad, nyKontaktData, kontaktNotis } from './patient-vardkontakt.js';
// Runda 9, r2: medicinteknisk utrustning och patientens egna mätningar (mt-ui.js).
import { utrustningHtml, egnaHtml, koppla as kopplaMt, klassEtikett } from '../mt-ui.js';

// Typer och enheter enligt API:t. Blodtryck står först, eftersom det är det vanligaste.
export const MATTYPER = [
  ['blodtryck', 'Blodtryck', 'mmHg'], ['puls', 'Puls', 'slag/min'], ['temp', 'Temperatur', '°C'], ['saturation', 'Syremättnad', '%'],
  ['andningsfrekvens', 'Andningsfrekvens', 'andetag/min'], ['syrgas', 'Syrgas', 'L/min'], ['medvetande', 'Medvetandegrad', ''],
  ['gcs', 'GCS', 'poäng'], ['smarta', 'Smärta (NRS)', 'av 10'], ['vikt', 'Vikt', 'kg'], ['langd', 'Längd', 'cm'], ['crp', 'CRP', 'mg/L'],
  ['egfr', 'eGFR', 'mL/min/1,73 m²'], ['kreatinin', 'Kreatinin', 'µmol/L'], ['hba1c', 'HbA1c', 'mmol/mol'], ['inr', 'PK (INR)', 'INR'],
  ['ntprobnp', 'NT-proBNP', 'ng/L'], ['hb', 'Hemoglobin', 'g/L'], ['glukos', 'Glukos', 'mmol/L'], ['kalium', 'Kalium', 'mmol/L'],
  ['pef', 'PEF', 'L/min'], ['troponin', 'Troponin T', 'ng/L'], ['tsh', 'TSH', 'mIE/L'],
  // Runda 8, r1: SR som intern analys på avdelningen, när läkaren har ordinerat den som kontroll (Sussas testfall 3.5).
  ['sr', 'SR', 'mm'],
];
// Runda 12, r1: mätvärdestyperna som systemförvaltningen har skapat och en annan systemförvaltare har godkänt
// (journalstruktur.js). De hämtas när vyn visas och står efter de inbyggda.
let egnaTyper = [];
const typer = () => [...MATTYPER, ...egnaTyper];
const ACVPU = [['A', 'Vaken'], ['C', 'Nytillkommen förvirring'], ['V', 'Reagerar på tilltal'], ['P', 'Reagerar på smärta'], ['U', 'Reagerar inte']];
const GCS = {
  e: ['Ögonöppning', [[4, 'Spontant'], [3, 'På tilltal'], [2, 'På smärta'], [1, 'Ingen']]],
  v: ['Verbalt svar', [[5, 'Orienterad'], [4, 'Förvirrad'], [3, 'Osammanhängande ord'], [2, 'Obegripliga ljud'], [1, 'Inget']]],
  m: ['Motoriskt svar', [[6, 'Lyder uppmaning'], [5, 'Lokaliserar smärta'], [4, 'Drar undan vid smärta'], [3, 'Böjer onormalt vid smärta'], [2, 'Sträcker vid smärta'], [1, 'Inget']]],
};
const RISK = { lag: 'risk-lag', lag_medel: 'risk-lag-medel', medel: 'risk-medel', hog: 'risk-hog' };
const visatVarde = (m) => (m.beskrivning ? esc(m.beskrivning) : vardeHtml(m));

// En kurva med referensintervall som ett skuggat band. Äldst till vänster. Punkter utanför intervallet är röda och
// har en ring, så att färgen inte är enda bäraren. Texten bredvid och tabellen bär värdena; kurvan är ett stöd.
function kurvaSvg(k) {
  const B = 340, H = 140, V = 40, HO = 10, T = 10, U = 24;
  const pkt = k.punkter;
  const alla = pkt.flatMap(p => p.varden);
  const ref = k.referens;
  let min = Math.min(...alla, ...(ref?.lag != null ? [ref.lag] : []));
  let max = Math.max(...alla, ...(ref?.hog != null && ref.hog < Math.max(...alla) * 2 ? [ref.hog] : []));
  if (max === min) { max += 1; min -= 1; }
  const luft = (max - min) * 0.1;
  min -= luft; max += luft;
  const t0 = Date.parse(pkt[0].tid), t1 = Date.parse(pkt.at(-1).tid);
  const x = (t) => V + (t1 === t0 ? 0.5 : (Date.parse(t) - t0) / (t1 - t0)) * (B - V - HO);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - U);
  const kl = (v) => Math.max(T, Math.min(H - U, y(v)));
  const band = ref && (ref.lag != null || ref.hog != null)
    ? `<rect class="kurva-ref" x="${V}" width="${B - V - HO}" y="${kl(ref.hog ?? max).toFixed(1)}" height="${Math.max(1, kl(ref.lag ?? min) - kl(ref.hog ?? max)).toFixed(1)}"/>` : '';
  const serier = k.serier.map((_, s) => {
    const p = pkt.map(q => [x(q.tid), y(q.varden[s]), q]);
    const linje = p.length > 1 ? `<polyline class="kurva-linje${s ? ' kurva-andra' : ''}" points="${p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>` : '';
    // Runda 9, r2: ett värde från utrustning som inte är godkänt är en ihålig punkt.
    return linje + p.map(([a, b, q]) => `<circle class="kurva-punkt${s ? ' kurva-andra' : ''}${!s && q.utanfor ? ' kurva-utanfor' : ''}${q.kalla === 'utrustning' && !q.godkand ? ' kurva-referens' : ''}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${!s && q.utanfor ? 4 : 3}"/>`).join('');
  }).join('');
  const etikett = (v) => tal(Math.round(v * 10) / 10, 1);
  const besk = `${k.namn}: ${pkt.length} värden från ${datum(pkt[0].tid)} till ${datum(pkt.at(-1).tid)}. ${ref ? `Referens ${ref.lag != null ? `från ${etikett(ref.lag)}` : ''} ${ref.hog != null ? `till ${etikett(ref.hog)}` : ''}. ` : ''}${pkt.filter(p => p.utanfor).length} utanför.`;
  return `<svg class="kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(besk)}" preserveAspectRatio="xMidYMid meet">
    ${band}
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/><line class="kurva-axel" x1="${V}" x2="${B - HO}" y1="${H - U}" y2="${H - U}"/>
    <text class="kurva-text" x="${V - 4}" y="${T + 8}" text-anchor="end">${esc(etikett(max - luft))}</text>
    <text class="kurva-text" x="${V - 4}" y="${H - U}" text-anchor="end">${esc(etikett(min + luft))}</text>
    <text class="kurva-text" x="${V}" y="${H - 6}">${esc(datum(pkt[0].tid))}</text>
    ${pkt.length > 1 ? `<text class="kurva-text" x="${B - HO}" y="${H - 6}" text-anchor="end">${esc(datum(pkt.at(-1).tid))}</text>` : ''}
    ${serier}
  </svg>`;
}

// NEWS2 över tid med banden för risken (0 till 4, 5 till 6 och 7 eller mer).
function news2Svg(serie) {
  const B = 340, H = 120, V = 30, HO = 10, T = 8, U = 22;
  const max = Math.max(10, ...serie.map(s => s.poang));
  const t0 = Date.parse(serie[0].tid), t1 = Date.parse(serie.at(-1).tid);
  const x = (t) => V + (t1 === t0 ? 0.5 : (Date.parse(t) - t0) / (t1 - t0)) * (B - V - HO);
  const y = (v) => T + (1 - v / max) * (H - T - U);
  const band = (fran, till, k) => `<rect class="${k}" x="${V}" width="${B - V - HO}" y="${y(till).toFixed(1)}" height="${(y(fran) - y(till)).toFixed(1)}"/>`;
  const p = serie.map(s => [x(s.tid), y(s.poang), s]);
  return `<svg class="kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(`NEWS2 över tid: ${serie.map(s => s.poang).join(', ')}`)}">
    ${band(0, 4.5, 'n2-lag')}${band(4.5, 6.5, 'n2-medel')}${band(6.5, max, 'n2-hog')}
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/>
    <text class="kurva-text" x="${V - 4}" y="${y(0)}" text-anchor="end">0</text><text class="kurva-text" x="${V - 4}" y="${y(5) + 4}" text-anchor="end">5</text><text class="kurva-text" x="${V - 4}" y="${y(7) + 4}" text-anchor="end">7</text>
    <text class="kurva-text" x="${V}" y="${H - 5}">${esc(datum(serie[0].tid))}</text>${serie.length > 1 ? `<text class="kurva-text" x="${B - HO}" y="${H - 5}" text-anchor="end">${esc(datum(serie.at(-1).tid))}</text>` : ''}
    ${p.length > 1 ? `<polyline class="kurva-linje" points="${p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>` : ''}
    ${p.map(([a, b, s]) => `<circle class="kurva-punkt${s.poang >= 5 || s.rod?.length ? ' kurva-utanfor' : ''}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3.5"/>`).join('')}
  </svg>`;
}

function news2Html(n, kanReg) {
  if (!n) return '';
  if (!n.galler) return `<section class="news2" aria-labelledby="n2-rubrik"><h3 id="n2-rubrik">NEWS2</h3><p class="dampad">${esc(n.text)}</p></section>`;
  const a = n.aktuell;
  const nasta = a?.kontinuerlig ? 'Kontinuerlig övervakning av vitalparametrarna.' : a?.nastaKontroll ? `Nästa kontroll senast ${tidpunkt(a.nastaKontroll)}.` : '';
  const roda = n.nyareRoda.length ? `<p class="ruta ruta-larm liten">${ikon.larm}<span>Efter senaste hela kontrollen: ${n.nyareRoda.map(d => `${esc(d.namn)} ${esc(d.visning)}`).join(', ')} ger 3 poäng. Det kräver åtgärd.</span></p>` : '';
  return `<section class="news2${n.larm ? ' news2-larm' : ''}" aria-labelledby="n2-rubrik">
    <div class="news2-huvud">
      <h3 id="n2-rubrik">NEWS2</h3>
      ${a ? `<p class="news2-poang ${RISK[a.risk] ?? ''}">${a.komplett ? `<strong>${esc(a.poang)}</strong><span>${esc(a.riskText ?? '')}</span>` : '<span>Ofullständig</span>'}</p>` : ''}
      ${kanReg ? `<button type="button" class="knapp liten" data-news2-ny>${ikon.plus}<span>Registrera NEWS2-kontroll</span></button>` : ''}
    </div>
    ${a ? `<p class="news2-tid">${a.komplett ? 'Räknat ur kontrollen' : 'Senaste värdena'} ${esc(tidpunkt(a.tid))}. ${esc(nasta)}${a.forsenad ? ' <strong class="text-larm">Kontrollen är försenad.</strong>' : ''}</p>
      ${a.komplett ? '' : `<p>${esc(a.text)}</p>`}
      ${roda}
      ${a.atgard?.length ? `<div class="news2-atgard"><h4>Vad som ska göras</h4><ul>${a.atgard.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <details class="news2-delar"><summary>Poäng per parameter</summary><table class="tabell"><thead><tr><th scope="col">Parameter</th><th scope="col">Värde</th><th scope="col">Poäng</th></tr></thead>
        <tbody>${a.delar.map(d => `<tr${d.poang === 3 ? ' class="rad-larm"' : ''}><th scope="row">${esc(d.namn)}</th><td>${esc(d.visning)}</td><td>${esc(d.poang)}</td></tr>`).join('')}</tbody></table></details>`
      : '<p class="tom liten">Inga vitalparametrar som du kan se.</p>'}
    ${n.serie.length > 1 ? `<div class="news2-kurva">${news2Svg(n.serie)}</div>` : ''}
    ${skalaHtml(n.skala)}
    <p class="under-text">${esc(n.demoregel)} Källa: ${esc(n.kalla)}.</p>
    ${n.kunskap ? `<details class="liten"><summary>${esc(n.kunskap.rubrik)}</summary><p>${esc(n.kunskap.text)}</p><p class="demoregel">Källa: ${esc(n.kunskap.kalla)}. ${esc(n.kunskap.demomarkning)}</p></details>` : ''}
  </section>`;
}

// Runda 10, r4: skalan för syremättnaden. Läkaren får systemets förslag om skala 2 och beslutar med ett klick.
function skalaHtml(sk) {
  if (!sk) return '';
  return `<div class="news2-skala"><p class="under-text">${esc(sk.text)}${sk.beslut ? ` Beslutat ${esc(tidpunkt(sk.beslut.tid))} av ${esc(sk.beslut.av ?? '')}.` : ''}</p>
    ${sk.forslag ? `<p class="ruta ruta-info liten">${ikon.info}<span>${esc(sk.forslag.text)}</span></p><p class="knapprad"><button type="button" class="knapp liten" data-skala="2">Använd skala 2</button></p>` : ''}
    ${sk.skala === 2 && sk.kanBesluta ? '<p class="knapprad"><button type="button" class="knapp liten sekundar" data-skala="1">Använd skala 1 igen</button></p>' : ''}</div>`;
}

// Runda 10, r4: urvalet i listan efter mätvärde, hur värdet kom in och period. Kurvorna och NEWS2 visar alla värden.
const PERIODER = [['', 'Hela tiden'], ['1', 'Senaste dygnet'], ['7', 'Senaste veckan'], ['30', 'Senaste 30 dagarna']];
function urvalHtml(u) {
  if (!u) return '';
  const val = (namn, id, lista, vald, etikett) => `<div class="falt smal"><label for="${id}">${etikett}</label><select id="${id}" name="${namn}">${lista.map(([v, t]) => `<option value="${esc(v)}"${String(vald ?? '') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  return `<form class="falt-rad mv-urval" id="mv-urval" aria-label="Urval av mätvärden">
    ${val('typ', 'mv-u-typ', [['', 'Alla mätvärden'], ...u.typer.map(t => [t.id, t.text])], u.typ, 'Mätvärde')}
    ${val('inmatning', 'mv-u-inm', [['', 'Alla sätt'], ...u.inmatningar.map(t => [t.id, t.text])], u.inmatning, 'Inmatning')}
    ${val('dagar', 'mv-u-dagar', PERIODER, u.dagar, 'Period')}
    <p class="under-text" aria-live="polite">${u.antal} av ${u.totalt} värden.</p></form>`;
}

function kurvorHtml(kurvor, markerad) {
  if (!kurvor.length) return '';
  return `<section aria-labelledby="mv-kurvor"><h3 id="mv-kurvor">Kurvor</h3><div class="kurvor">${kurvor.map(k => `<article class="kurvkort${k.typ === markerad ? ' markerad' : ''}" id="kurva-${esc(k.typ)}" aria-labelledby="kr-${esc(k.typ)}">
    <header><h4 id="kr-${esc(k.typ)}" tabindex="-1">${esc(k.namn)}</h4><p class="kurva-senaste${k.senaste.utanfor ? ' text-larm' : ''}">${esc(typeof k.senaste.varde === 'number' ? tal(k.senaste.varde, 2) : k.senaste.varde)} <span class="enhet">${esc(k.enhet)}</span></p></header>
    ${kurvaSvg(k)}
    <p class="under-text">${k.referens ? `${esc(k.referens.text)}: ${k.referens.lag != null ? esc(tal(k.referens.lag, 2)) : ''}${k.referens.lag != null && k.referens.hog != null ? ' till ' : k.referens.hog != null ? 'högst ' : ' och uppåt'}${k.referens.hog != null ? esc(tal(k.referens.hog, 2)) : ''}.` : 'Inget referensintervall.'} ${k.typ === 'blodtryck' ? 'Övre linjen systoliskt, nedre diastoliskt.' : ''}</p>
  </article>`).join('')}</div></section>`;
}

let urval = new URLSearchParams();
let urvalFor = null;
export async function visa(el, ctx) {
  if (urvalFor !== ctx.id) { urval = new URLSearchParams(); urvalFor = ctx.id; }
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/matvarden${urval.toString() ? `?${urval}` : ''}`);
  if (!ctx.aktuell()) return;
  const kanReg = far('registrera_matvarde');
  // Runda 12, r1.
  if (kanReg) egnaTyper = await api('/api/mattyper', { tyst: true }).then(r => r.mattyper.filter(m => m.egen).map(m => [m.id, m.namn, m.enhet])).catch(() => egnaTyper);
  if (!ctx.aktuell()) return;
  const markerad = ctx.sub && ctx.sub !== 'ny' ? ctx.sub : null;
  el.innerHTML = `<div class="flikhuvud"><h2>Mätvärden</h2></div>${kanReg ? hjalpRuta('matvarde') : ''}${doldaRad(d.dolda)}
    ${news2Html(d.news2, kanReg && d.news2?.galler)}
    <div id="news2-plats"></div>
    ${kanReg ? registrering() : ''}
    ${kanReg ? '<div id="flera-plats"><p class="knapprad"><button type="button" class="knapp liten sekundar" data-flera-ny>Längd, vikt, blodtryck och puls på en gång</button></p></div>' : ''}
    ${utrustningHtml(d)}
    ${kurvorHtml(d.kurvor ?? [], markerad)}
    ${d.matvarden.length || d.urval?.totalt ? `<section aria-labelledby="mv-alla"><h3 id="mv-alla">Alla värden</h3>${urvalHtml(d.urval)}
      <div class="tabellrulle"><table class="tabell tat">
        <thead><tr><th scope="col">Tid</th><th scope="col">Mätvärde</th><th scope="col">Värde</th><th scope="col">Enhet där det togs</th><th scope="col">Registrerat av</th><th scope="col">Inmatning</th></tr></thead>
        <tbody>${d.matvarden.map(m => `<tr${m.ejSparad ? ' data-ej-sparad' : ''}><td>${esc(tidpunkt(m.tid))}${m.ejSparad ? ' <span class="tagg tagg-larm">Inte sparat i journalen än</span>' : ''}</td><td>${esc(m.namn)}</td><td>${visatVarde(m)}</td><td>${esc(m.vardenhet.namn)}${migreradEtikett(m)}</td><td>${esc(m.registreradAv?.namn ?? '')}${m.bestallning ? `<span class="under-text">Svar från laboratoriet, beställt av ${esc(m.bestallning.bestalldAv ?? '')}</span>` : ''}${klassEtikett(m.klass)}</td><td><span class="tagg${m.inmatning?.maskinell ? ' tagg-maskinell' : ''}">${esc(m.inmatning?.maskinell ? 'Maskinellt' : m.inmatning?.typ === 'manuell' ? 'Manuellt' : m.inmatning?.typ === 'patient' ? 'Patienten' : 'Migrerat')}</span><span class="under-text">${esc(m.inmatning?.text ?? '')}</span></td></tr>`).join('')}</tbody>
      </table></div></section>` : '<p class="tom">Inga mätvärden som du kan se.</p>'}
    ${egnaHtml(d)}`;

  // Från en sökträff öppnas kurvan för mätvärdet.
  if (markerad) {
    const k = el.querySelector(`#kurva-${CSS.escape(markerad)}`);
    if (k) { k.scrollIntoView({ block: 'center' }); k.querySelector('h4')?.focus({ preventScroll: true }); }
  }
  el.querySelector('[data-news2-ny]')?.addEventListener('click', () => news2Form(el, ctx, d.news2?.skala?.skala ?? 1));
  // Runda 10, r4: skalan för syremättnaden och urvalet i listan.
  el.querySelectorAll('[data-skala]').forEach(b => b.addEventListener('click', async () => {
    try {
      await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/news2-skala`, { metod: 'POST', data: { skala: Number(b.dataset.skala) } }));
      notis(b.dataset.skala === '2' ? 'Syremättnaden räknas nu med skala 2, med målet 88 till 92 procent.' : 'Syremättnaden räknas med skala 1 igen.');
      ctx.ladda();
    } catch { /* felet visas som notis */ }
  }));
  el.querySelector('#mv-urval')?.addEventListener('change', (e) => {
    urval = new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v));
    ctx.ladda();
  });
  kopplaMt(el, ctx);
  // Runda 8, r5: flera mätvärden på en gång.
  el.querySelector('[data-flera-ny]')?.addEventListener('click', () => fleraForm(el, ctx));

  const form = el.querySelector('#mv-form');
  if (!form) return;
  const kontakt = kontaktRad(form.querySelector('[data-kontakt-plats]'), ctx);
  const plats = form.querySelector('#mv-varde-plats');
  const satt = () => {
    const typ = form.typ.value;
    const t = typer().find(m => m[0] === typ);
    plats.innerHTML = vardeFalt(typ, t);
    plats.querySelector('[data-gcs]')?.addEventListener('change', () => gcsSumma(plats));
  };
  form.typ.addEventListener('change', satt);
  satt();
  // Från snabbvalet Registrera mätvärde i översikten (matvarden/ny) får värdefältet fokus. Blodtryck är förvalt.
  if (ctx.sub === 'ny') form.querySelector('#mv-varde')?.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typ = form.typ.value;
    const v = lasVarde(form, typ);
    if (v == null) { const f = form.querySelector('#mv-varde, [name="acvpu"], [data-gcs] select'); f?.setAttribute('aria-invalid', 'true'); f?.focus(); return; }
    const data = { typ, varde: v, ...nyKontaktData(kontakt) };
    if (form.tid.value) data.tid = new Date(form.tid.value).toISOString();
    try {
      const m = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/matvarden`, { metod: 'POST', data, ko: true }), form);
      if (m.koad) {
        notis(`${m.namn} ${m.varde} ${m.enhet} är sparat i kön på den här datorn och inte i journalen än. Det skickas när förbindelsen är tillbaka.`, 'info');
        return ctx.ladda();
      }
      notis(m.beskrivning ? `${m.namn}: ${m.beskrivning} Registrerat.` : `${m.namn} ${m.varde} ${m.enhet} är registrerat.`);
      kontaktNotis(m);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}

// Värdefältet efter typ: tal med enhet, val med text för medvetandegrad och smärta, och GCS i tre delar.
function vardeFalt(typ, t) {
  if (typ === 'medvetande') {
    return `<fieldset class="kryssgrupp mv-val"><legend>Medvetandegrad (ACVPU)</legend>${ACVPU.map(([k, txt], i) => `<div class="kryssfalt"><input type="radio" id="mv-acvpu-${k}" name="acvpu" value="${k}"${i ? '' : ' checked'}><label for="mv-acvpu-${k}"><strong>${k}</strong> ${esc(txt)}</label></div>`).join('')}</fieldset>`;
  }
  if (typ === 'smarta') {
    return `<fieldset class="segment mv-nrs"><legend>Smärta, 0 är ingen smärta och 10 värsta tänkbara</legend>${Array.from({ length: 11 }, (_, i) => `<input type="radio" id="mv-nrs-${i}" name="nrs" value="${i}"><label for="mv-nrs-${i}">${i}</label>`).join('')}</fieldset>`;
  }
  if (typ === 'gcs') {
    return `<div class="falt-rad" data-gcs>${Object.entries(GCS).map(([k, [namn, steg]]) => `<div class="falt"><label for="mv-gcs-${k}">${esc(namn)}</label><select id="mv-gcs-${k}" name="gcs-${k}">${steg.map(([v, txt]) => `<option value="${v}">${v} ${esc(txt)}</option>`).join('')}</select></div>`).join('')}
      <p class="gcs-summa" aria-live="polite" data-gcs-summa>GCS 15 (E4 V5 M6). Systemet räknar summan.</p></div>`;
  }
  const hjalp = typ === 'syrgas' ? '<span class="hjalp">0 betyder luft, ingen syrgas.</span>' : '';
  return `<div class="falt smal"><label for="mv-varde">Värde</label><div class="med-enhet"><input id="mv-varde" name="varde" required autocomplete="off" inputmode="${typ === 'blodtryck' ? 'text' : 'decimal'}" placeholder="${typ === 'blodtryck' ? '120/80' : ''}" aria-describedby="mv-enhet"><span id="mv-enhet" class="enhet">${esc(t?.[2] ?? '')}</span></div>${hjalp}</div>`;
}

function gcsSumma(plats) {
  const v = Object.fromEntries(Object.keys(GCS).map(k => [k, Number(plats.querySelector(`#mv-gcs-${k}`).value)]));
  plats.querySelector('[data-gcs-summa]').textContent = `GCS ${v.e + v.v + v.m} (E${v.e} V${v.v} M${v.m}). Systemet räknar summan.`;
}

function lasVarde(form, typ) {
  if (typ === 'medvetande') return form.querySelector('[name="acvpu"]:checked')?.value ?? null;
  if (typ === 'smarta') { const v = form.querySelector('[name="nrs"]:checked')?.value; return v == null ? null : Number(v); }
  if (typ === 'gcs') return `E${form.querySelector('#mv-gcs-e').value}V${form.querySelector('#mv-gcs-v').value}M${form.querySelector('#mv-gcs-m').value}`;
  const v = form.querySelector('#mv-varde')?.value.trim();
  if (!v) return null;
  return typ === 'blodtryck' ? v : Number(v.replace(',', '.'));
}

function registrering() {
  // Runda 10, r1: formuläret fungerar också under ett avbrott (data-ko-ok), och värdet läggs då i skrivkön.
  return `<form class="mv-form" id="mv-form" novalidate aria-labelledby="mv-reg" data-ko-ok>
    <h3 id="mv-reg">Registrera mätvärde</h3>
    <div data-kontakt-plats></div>
    <div class="falt-rad">
      <div class="falt"><label for="mv-typ">Mätvärde</label><select id="mv-typ" name="typ">${typer().map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></div>
      <div id="mv-varde-plats" class="mv-varde-plats"></div>
      <div class="falt"><label for="mv-tid">Tidpunkt</label><input id="mv-tid" name="tid" type="datetime-local" aria-describedby="mv-tid-h"><span class="hjalp" id="mv-tid-h">Tomt betyder nu. Högst 30 dagar bakåt.</span></div>
      <div class="falt knappfalt"><button type="submit" class="knapp">Registrera</button></div>
    </div>
    <p class="form-fel" role="alert" hidden></p>
  </form>`;
}

// Hela NEWS2-kontrollen i ett formulär. Systemet räknar poängen medan värdena skrivs och sparar allt på en gång, med
// samma tid och vårdkontakt.
const N2 = [['andningsfrekvens', 'Andningsfrekvens', 'andetag/min', 'numeric'], ['saturation', 'Syremättnad', '%', 'numeric'], ['blodtryck', 'Blodtryck', 'mmHg', 'text'],
  ['puls', 'Puls', 'slag/min', 'numeric'], ['temp', 'Temperatur', '°C', 'decimal']];
function news2Form(el, ctx, skala = 1) {
  const plats = el.querySelector('#news2-plats');
  plats.innerHTML = `<form class="mv-form news2-form" id="news2-form" novalidate aria-labelledby="n2-reg">
    <h3 id="n2-reg" tabindex="-1">NEWS2-kontroll</h3>
    <p class="hjalp">Fyll i alla sju värdena. Systemet räknar poängen och säger vad som ska göras. Tiden är nu.</p>
    <div class="falt-rad">${N2.map(([k, n, enhet, im]) => `<div class="falt smal"><label for="n2-${k}">${esc(n)}</label><div class="med-enhet"><input id="n2-${k}" name="${k}" inputmode="${im}" autocomplete="off"${k === 'blodtryck' ? ' placeholder="120/80"' : ''}><span class="enhet">${esc(enhet)}</span></div></div>`).join('')}</div>
    <div class="falt-rad">
      <fieldset class="segment"><legend>Luft eller syrgas</legend><input type="radio" id="n2-luft" name="luft" value="luft" checked><label for="n2-luft">Luft</label><input type="radio" id="n2-syre" name="luft" value="syrgas"><label for="n2-syre">Syrgas</label></fieldset>
      <div class="falt smal" data-syrgas hidden><label for="n2-syrgas">Syrgas</label><div class="med-enhet"><input id="n2-syrgas" name="syrgas" inputmode="decimal" autocomplete="off"><span class="enhet">L/min</span></div></div>
    </div>
    <fieldset class="kryssgrupp mv-val"><legend>Medvetandegrad (ACVPU)</legend>${ACVPU.map(([k, txt]) => `<div class="kryssfalt"><input type="radio" id="n2-acvpu-${k}" name="medvetande" value="${k}"><label for="n2-acvpu-${k}"><strong>${k}</strong> ${esc(txt)}</label></div>`).join('')}</fieldset>
    <p class="news2-forhand" aria-live="polite" data-forhand>Poängen visas här när värdena är ifyllda.</p>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Registrera kontrollen</button><button type="button" class="knapp text" data-avbryt>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  const syrgas = form.querySelector('[data-syrgas]');
  const varden = () => {
    const v = Object.fromEntries(N2.map(([k]) => [k, form[k].value.trim()]));
    v.syrgas = form.luft.value === 'syrgas' ? form.syrgas.value.trim() : '0';
    v.medvetande = form.querySelector('[name="medvetande"]:checked')?.value ?? '';
    return v;
  };
  let timer = null;
  const forhand = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const r = await api('/api/news2/berakna', { metod: 'POST', data: { ...varden(), skala }, tyst: true });
        form.querySelector('[data-forhand]').textContent = r.text;
      } catch { /* förhandsvisningen är bara ett stöd */ }
    }, 250);
  };
  form.addEventListener('input', forhand);
  form.addEventListener('change', (e) => { if (e.target.name === 'luft') syrgas.hidden = form.luft.value !== 'syrgas'; forhand(); });
  form.querySelector('[data-avbryt]').addEventListener('click', () => { plats.innerHTML = ''; });
  // Fokus i det första värdet, så att det går att börja skriva direkt.
  form.querySelector('#n2-andningsfrekvens').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/news2`, { metod: 'POST', data: varden() }), form);
      notis(`NEWS2-kontrollen är registrerad. ${r.news2.text}`, r.news2.larm ? 'info' : 'ok');
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}


// Runda 8, r5: längd, vikt, blodtryck och puls i ett formulär (Sussa testfall 4.2). Allt sparas på en gång med samma tid
// och vårdkontakt, och systemet räknar BMI ur längd och vikt. Fält som lämnas tomma registreras inte.
const FLERA = [['langd', 'Längd', 'cm', 'decimal'], ['vikt', 'Vikt', 'kg', 'decimal'], ['blodtryck', 'Blodtryck', 'mmHg', 'text'], ['puls', 'Puls', 'slag/min', 'numeric']];
function fleraForm(el, ctx) {
  const plats = el.querySelector('#flera-plats');
  plats.innerHTML = `<form class="mv-form" id="flera-form" novalidate aria-labelledby="fl-reg">
    <h3 id="fl-reg" tabindex="-1">Längd, vikt, blodtryck och puls</h3>
    <p class="hjalp">Fyll i de värden som har tagits. Tiden är nu, och systemet räknar BMI.</p>
    <div class="falt-rad">${FLERA.map(([k, n, enhet, im]) => `<div class="falt smal"><label for="fl-${k}">${esc(n)}</label><div class="med-enhet"><input id="fl-${k}" name="${k}" inputmode="${im}" autocomplete="off"${k === 'blodtryck' ? ' placeholder="120/80"' : ''}><span class="enhet">${esc(enhet)}</span></div></div>`).join('')}</div>
    <p class="news2-forhand" aria-live="polite" data-bmi></p>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp">Registrera</button><button type="button" class="knapp text" data-avbryt>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  const tal = (v) => Number(String(v).trim().replace(',', '.'));
  form.addEventListener('input', () => {
    const l = tal(form.langd.value);
    const v = tal(form.vikt.value);
    form.querySelector('[data-bmi]').textContent = l > 0 && v > 0 ? `BMI ${(Math.round((v / ((l / 100) ** 2)) * 10) / 10).toString().replace('.', ',')}` : '';
  });
  form.querySelector('[data-avbryt]').addEventListener('click', () => { ctx.ladda(); });
  form.querySelector('#fl-langd').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(FLERA.map(([k]) => [k, form[k].value.trim()]).filter(([, v]) => v));
    if (!Object.keys(data).length) { faltFel(form, { message: 'Fyll i minst ett mätvärde.', data: { falt: ['langd'] } }); form.querySelector('#fl-langd').focus(); return; }
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/matvarden/flera`, { metod: 'POST', data }), form);
      notis(r.text);
      kontaktNotis(r);
      ctx.ladda();
    } catch (err) {
      const f = err?.data?.falt?.[0];
      if (f && form[f]) { form[f].setAttribute('aria-invalid', 'true'); form[f].focus(); }
    }
  });
}
