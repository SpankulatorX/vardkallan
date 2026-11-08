// Avdelningens planering (runda 8, r3, testfall 7.1 till 7.4): allt som är planerat för avdelningens patienter i dag i
// en vy. Uppgifter (provtagning, omläggning, sjukgymnastik, teamrond med flera), läkemedel att ge och bokade tider på
// andra arbetsplatser. Visas per tid, per patient eller per yrkesroll, och för ett urval av patienter. Härifrån nås en
// patients planering över flera dagar och en persons planering för veckan.
import { esc, api, vyRubrik, notis, felNotis, dialog, medKnapp, ikon, tom } from '../ui.js';
import { patientCell } from './arbetslista.js';

export const namn = 'avdelning';
const TZ = 'Europe/Stockholm';
const kl = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', '.');
const dagText = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const plusD = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const idagD = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
const VYER = [['tid', 'Per tid'], ['patient', 'Per patient'], ['yrke', 'Per yrkesroll']];
// Valen gäller tills sidan laddas om.
const lage = { vy: 'tid', valda: new Set(), datum: null, enhet: null };

const ansvarigHtml = (h) => {
  if (h.deltagare?.length) return h.deltagare.map(d => `<a class="av-resurs" href="#/avdelning/resurs/${encodeURIComponent(d.id)}">${esc(d.namn)}</a>`).join(', ');
  if (h.ansvarig) return `<a class="av-resurs" href="#/avdelning/resurs/${encodeURIComponent(h.ansvarig.id)}">${esc(h.ansvarig.namn)}</a>${h.yrkeText ? `<span class="under-text">${esc(h.yrkeText)}</span>` : ''}`;
  return esc(h.yrkeText ?? '');
};
const statusHtml = (h, kanUtfora) => (h.uppgiftId && h.status === 'planerad' && kanUtfora
  ? `<button type="button" class="knapp liten sekundar" data-utford="${esc(h.uppgiftId)}">Utförd</button>`
  : `<span class="${h.status === 'utford' ? 'tagg' : 'dampad'}">${esc(h.statusText ?? '')}</span>`);
const handelseHtml = (h) => `<span class="av-typ tagg">${esc(h.typText)}</span> ${esc(h.text)}`;

function raderHtml(rader, { patient = true, kanUtfora = false } = {}) {
  if (!rader.length) return tom('Inget är planerat.');
  return `<div class="tabellrulle"><table class="tabell av-tabell">
    <thead><tr><th scope="col">Tid</th>${patient ? '<th scope="col">Patient</th>' : ''}<th scope="col">Händelse</th><th scope="col">Ansvarig</th><th scope="col">Status</th></tr></thead>
    <tbody>${rader.map(({ h, p }) => `<tr data-klocka="${esc(kl(h.tid))}"${h.status === 'utford' ? ' class="av-utford"' : ''}>
      <td><strong>${esc(kl(h.tid))}</strong></td>
      ${patient ? `<td>${p ? patientCell(p.patient, `#/patient/${encodeURIComponent(p.patient.id)}`) : '<span class="dampad">Upptagen</span>'}${p?.plats ? `<span class="under-text">${esc(p.plats)}</span>` : ''}</td>` : ''}
      <td>${handelseHtml(h)}</td><td>${ansvarigHtml(h)}</td><td>${statusHtml(h, kanUtfora)}</td></tr>`).join('')}</tbody></table></div>`;
}

export async function visa(main, _p, q, ctx = {}) {
  main.innerHTML = vyRubrik('Avdelningens planering') + '<p class="tom">Hämtar planeringen.</p>';
  if (q?.get('datum')) lage.datum = q.get('datum');
  await rita(main, ctx.aktuell ?? (() => true));
}

async function rita(main, aktuell) {
  const qs = new URLSearchParams();
  if (lage.datum) qs.set('datum', lage.datum);
  if (lage.enhet) qs.set('enhet', lage.enhet);
  const d = await api(`/api/avdelning/planering${qs.size ? `?${qs}` : ''}`);
  if (!aktuell()) return;
  if (!d.avdelning) { main.innerHTML = vyRubrik('Avdelningens planering') + tom('Det finns inga inskrivna patienter på din vårdenhet.'); return; }
  const valda = [...lage.valda].filter(id => d.patienter.some(p => p.patient.id === id));
  const synliga = valda.length ? d.patienter.filter(p => valda.includes(p.patient.id)) : d.patienter;
  const alla = synliga.flatMap(p => p.handelser.map(h => ({ h, p }))).sort((a, b) => a.h.tid.localeCompare(b.h.tid));
  const idag = d.datum === idagD();
  let innehall;
  if (lage.vy === 'patient') {
    innehall = synliga.map(p => `<section class="tabellsektion av-patient" aria-labelledby="av-p-${esc(p.patient.id)}"><h2 id="av-p-${esc(p.patient.id)}">${patientCell(p.patient, `#/patient/${encodeURIComponent(p.patient.id)}`)} <span class="dampad liten">${esc(p.plats ?? '')}</span></h2>
      ${raderHtml(p.handelser.map(h => ({ h, p })), { patient: false, kanUtfora: d.kanUtfora })}</section>`).join('');
  } else if (lage.vy === 'yrke') {
    const grupper = new Map();
    for (const r of alla) { const k = r.h.ansvarig?.namn ?? r.h.yrkeText ?? 'Övrigt'; if (!grupper.has(k)) grupper.set(k, []); grupper.get(k).push(r); }
    innehall = [...grupper].map(([k, rader], i) => `<section class="tabellsektion" aria-labelledby="av-y-${i}"><h2 id="av-y-${i}">${esc(k)} <span class="antal">${rader.length}</span></h2>${raderHtml(rader, { kanUtfora: d.kanUtfora })}</section>`).join('');
  } else {
    innehall = `<section class="tabellsektion" aria-labelledby="av-tid-r"><h2 id="av-tid-r">${idag ? 'I dag' : esc(dagText(d.datum))} <span class="antal">${alla.length}</span></h2>${raderHtml(alla, { kanUtfora: d.kanUtfora })}</section>`;
  }
  main.innerHTML = vyRubrik('Avdelningens planering', `${esc(d.avdelning.namn)}, ${esc(dagText(d.datum))}. Allt som är planerat för patienterna: uppgifter, läkemedel att ge och bokade tider.`) + `<div id="av">
    <div class="av-verktyg">
      <div role="group" aria-label="Dag"><button type="button" class="knapp liten ${idag ? '' : 'sekundar'}" data-dag="0" aria-pressed="${idag}">I dag</button><button type="button" class="knapp liten sekundar" data-dag="-1">Dagen före</button><button type="button" class="knapp liten sekundar" data-dag="1">Dagen efter</button></div>
      <div role="group" aria-label="Visa">${VYER.map(([k, t]) => `<button type="button" class="knapp liten ${lage.vy === k ? '' : 'sekundar'}" data-vy="${k}" aria-pressed="${lage.vy === k}">${esc(t)}</button>`).join('')}</div>
      ${d.avdelningar.length > 1 ? `<label class="av-enhet">Avdelning <select id="av-enhet">${d.avdelningar.map(a => `<option value="${esc(a.id)}"${a.id === d.avdelning.id ? ' selected' : ''}>${esc(a.namn)}</option>`).join('')}</select></label>` : ''}
      ${d.kanPlanera ? `<button type="button" class="knapp liten" data-planera>${ikon.plus}<span>Planera uppgift</span></button>` : ''}
    </div>
    <fieldset class="av-patienter" id="av-patienter"><legend>Patienter. Markera några för att bara visa dem.</legend><ul class="enkel-lista">${d.patienter.map(p => `<li>
      <label><input type="checkbox" value="${esc(p.patient.id)}"${valda.includes(p.patient.id) ? ' checked' : ''}> ${esc(p.patient.namn)}</label> <span class="dampad liten">${esc(p.plats ?? '')}</span>
      <a class="av-plan liten" href="#/avdelning/patient/${encodeURIComponent(p.patient.id)}">Planering<span class="sr"> för ${esc(p.patient.namn)}</span></a></li>`).join('')}</ul></fieldset>
    ${innehall}
    <p class="hjalp">${esc(d.demoregler)}</p></div>`;
  const el = main.querySelector('#av');
  el.querySelector('#av-patienter').addEventListener('change', (e) => {
    const x = e.target.closest('input[type=checkbox]');
    if (!x) return;
    if (x.checked) lage.valda.add(x.value); else lage.valda.delete(x.value);
    rita(main, aktuell).catch(felNotis);
  });
  el.querySelector('#av-enhet')?.addEventListener('change', (e) => { lage.enhet = e.target.value; rita(main, aktuell).catch(felNotis); });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dag], [data-vy], [data-planera], [data-utford]');
    if (!b) return;
    try {
      if (b.dataset.vy) lage.vy = b.dataset.vy;
      else if (b.dataset.dag) lage.datum = b.dataset.dag === '0' ? null : plusD(d.datum, Number(b.dataset.dag));
      else if (b.hasAttribute('data-planera')) { if (!(await planeraUppgift(d))) return; }
      else if (b.dataset.utford) { await medKnapp(b, () => api(`/api/planerad-uppgift/${b.dataset.utford}/utford`, { metod: 'POST', data: {} })); notis('Uppgiften är registrerad som utförd.'); }
      await rita(main, aktuell);
    } catch (err) { felNotis(err); }
  });
}

// Planera en uppgift. Systemet föreslår typ, yrkesroll, längd och nästa hela timme ur texten.
async function planeraUppgift(d) {
  const lokal = (iso) => { const x = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
  const nasta = lokal(new Date(Math.ceil(Date.now() / 3600_000) * 3600_000).toISOString());
  const svar = await dialog(`<h2 id="dlg-rubrik">Planera uppgift</h2>
    <form class="falt-grupp" novalidate>
      <label>Patient <select name="patient">${d.patienter.map(p => `<option value="${esc(p.patient.id)}">${esc(p.patient.namn)}, ${esc(p.plats ?? '')}</option>`).join('')}</select></label>
      <label>Vad ska göras <input name="text" required maxlength="120" autofocus placeholder="Till exempel Omläggning av sår"></label>
      <p class="hjalp" id="av-forslag" aria-live="polite">Systemet avgör typen och vem som brukar göra det ur texten.</p>
      <label>När <input name="start" type="datetime-local" value="${esc(nasta)}" required></label>
      <label>Ansvarig <select name="ansvarigId"><option value="">Den yrkesroll som brukar göra det</option>${d.personal.map(p => `<option value="${esc(p.id)}">${esc(p.namn)}, ${esc(p.yrkeText)}</option>`).join('')}</select></label>
    </form><div class="dialog-fel ruta ruta-fel" hidden></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Planera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, {
    onOpen: (dl) => {
      const t = dl.querySelector('input[name="text"]');
      let timer = null;
      t.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(async () => {
        if (t.value.trim().length < 3) return;
        try { const f = await api(`/api/planering/forslag?text=${encodeURIComponent(t.value)}`, { tyst: true }); dl.querySelector('#av-forslag').textContent = `${f.typText}, ${f.yrkeText.toLowerCase()}, ${f.minuter} minuter.`; } catch { /* förslaget är bara en hjälp */ }
      }, 300); });
    },
  });
  if (svar?.val !== 'ok') return false;
  const r = await api(`/api/patient/${encodeURIComponent(svar.data.patient)}/planering`, { metod: 'POST', data: { text: svar.data.text, start: new Date(svar.data.start).toISOString(), ansvarigId: svar.data.ansvarigId || undefined } });
  notis(r.besked);
  return true;
}

// Dagar med händelser, för patientens och resursens planering.
const dagarHtml = (dagar, idag, { patient }) => dagar.map(dg => `<section class="tabellsektion av-dag${dg.datum === idag ? ' av-idag' : ''}" data-datum="${esc(dg.datum)}" aria-labelledby="av-d-${esc(dg.datum)}">
  <h2 id="av-d-${esc(dg.datum)}">${dg.datum === idag ? 'I dag, ' : ''}${esc(dagText(dg.datum))} <span class="antal">${dg.handelser.length}</span></h2>
  ${raderHtml(dg.handelser.map(h => ({ h, p: patient ? (h.patient ? { patient: h.patient } : null) : null })), { patient })}</section>`).join('');

// En patients planering över flera dagar (testfall 7.3).
export const patient = {
  namn: 'avdelning-patient',
  async visa(main, [id]) {
    main.innerHTML = vyRubrik('Patientens planering') + '<p class="tom">Hämtar planeringen.</p>';
    const d = await api(`/api/patient/${encodeURIComponent(id)}/planering`);
    main.innerHTML = vyRubrik(`Planering för ${d.patient.namn}`, `${esc(d.patient.personnummer)}. Tre dagar bakåt och tre framåt: uppgifter, läkemedel att ge i dag och bokade tider.`) +
      `<nav class="snabbval" aria-label="Planeringen"><ul><li><a class="knapp liten sekundar" href="#/avdelning">Avdelningens planering</a></li><li><a class="knapp liten sekundar" href="#/patient/${encodeURIComponent(d.patient.id)}">Journalen</a></li></ul></nav>
      ${dagarHtml(d.dagar, d.idag, { patient: false })}`;
  },
};

// En persons planering för veckan (testfall 7.4).
export const resurs = {
  namn: 'avdelning-resurs',
  async visa(main, [id], q) {
    main.innerHTML = vyRubrik('Planering för en person') + '<p class="tom">Hämtar planeringen.</p>';
    const qs = q?.get('fran') ? `?fran=${encodeURIComponent(q.get('fran'))}&till=${encodeURIComponent(q.get('till') ?? '')}` : '';
    const d = await api(`/api/resurs/${encodeURIComponent(id)}/planering${qs}`);
    main.innerHTML = vyRubrik(`Planering för ${d.person.namn}`, `${esc(d.person.titel ?? d.person.yrkeText ?? '')}. ${esc(dagText(d.fran))} till ${esc(dagText(d.till))}: uppgifter på avdelningen, bokade tider och teambesök.`) +
      `<nav class="snabbval" aria-label="Planeringen"><ul><li><a class="knapp liten sekundar" href="#/avdelning">Avdelningens planering</a></li>
        <li><a class="knapp liten sekundar" href="#/avdelning/resurs/${encodeURIComponent(d.person.id)}?fran=${plusD(d.fran, -7)}&till=${plusD(d.till, -7)}">Veckan före</a></li>
        <li><a class="knapp liten sekundar" href="#/avdelning/resurs/${encodeURIComponent(d.person.id)}?fran=${plusD(d.fran, 7)}&till=${plusD(d.till, 7)}">Veckan efter</a></li></ul></nav>
      ${dagarHtml(d.dagar, d.idag, { patient: true })}<p class="hjalp">${esc(d.utanPatient)}</p>`;
  },
};
