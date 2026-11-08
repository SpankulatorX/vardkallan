// Medicinteknisk utrustning i fliken Mätvärden (runda 9, r2, Sussa 3.6.1): kopplingarna, utrustningen att koppla,
// värdena från utrustningen som väntar på godkännande, pumparna och patientens egna mätningar, som visas för sig.
// Systemet hittar utrustningen ur streckkoden, väljer pumpens infusion när det bara finns en och godkänner alla värden
// som väntar med ett klick.
import { esc, api, tidpunkt, klockslag, notis, medKnapp, ikon, tal } from './ui.js';

const vardeText = (m) => `${esc(typeof m.varde === 'number' ? tal(m.varde, 2) : m.varde)} ${esc(m.enhet ?? '')}`;

export function klassEtikett(k) {
  if (!k) return '';
  const typ = k.kalla === 'patient' ? 'tagg-egen' : k.kvalitetssakrad ? 'tagg-ok' : 'tagg-referens';
  return `<span class="tagg ${typ}" title="${esc(k.klassText)}">${esc(k.kalla === 'patient' ? k.klassText : `${k.kallaText}, ${k.kvalitetssakrad ? 'godkänt' : 'referens'}`)}</span>`;
}

function pumpHtml(p) {
  if (!p.senaste) return '<p class="under-text">Pumpen har inte rapporterat än.</p>';
  return `<p class="mt-pump">${ikon.piller}<span>${esc(p.senaste.text)}. Det senaste dygnet ${esc(tal(p.dygn.volymMl, 1))} ml${p.dygn.dos != null ? `, ${esc(tal(p.dygn.dos, 2))} ${esc(p.dygn.dosEnhet ?? '')}` : ''}.</span></p>
    ${p.okvitterade.map(h => `<div class="ruta ruta-larm liten" data-pumpvarning="${esc(h.id)}">${ikon.larm}<div>${h.varningar.map(v => `<p>${esc(v.text)}</p>`).join('')}
      <form class="mt-kvittera" data-kvittera="${esc(h.id)}" novalidate><label for="mt-kv-${esc(h.id)}">Vad gjordes?</label><input id="mt-kv-${esc(h.id)}" name="motivering" autocomplete="off"><button type="submit" class="knapp liten">Kvittera</button><p class="form-fel" role="alert" hidden></p></form></div></div>`).join('')}`;
}

// Utrustningsdelen. d är svaret från /api/patient/:id/matvarden (d.mt och d.egna).
export function utrustningHtml(d) {
  const v = d.mt;
  if (!v) return '';
  const vantar = v.vantar.utrustning;
  return `<section class="mt-del ov-sektion" aria-labelledby="mt-rubrik">
    <div class="sektion-huvud"><h3 id="mt-rubrik">Medicinteknisk utrustning</h3></div>
    ${vantar ? `<div class="ruta ruta-info mt-vantar">${ikon.info}<div><p><strong>${vantar} ${vantar === 1 ? 'värde' : 'värden'} från utrustningen väntar på godkännande.</strong> De visas som referens och räknas inte i NEWS2 eller larm förrän de är godkända för diagnostiskt bruk.</p>
      ${v.kanGodkanna ? `<p class="knapprad"><button type="button" class="knapp liten" data-mt-godkann="utrustning">Godkänn ${vantar} ${vantar === 1 ? 'värde' : 'värden'}</button><button type="button" class="knapp liten sekundar" data-mt-referens="utrustning">Bara som referens</button></p>` : ''}</div></div>` : ''}
    ${v.aktiva.length ? `<ul class="mt-kopplingar">${v.aktiva.map(k => `<li class="mt-koppling" data-koppling="${esc(k.id)}">
      <div><strong>${esc(k.utrustning?.typText ?? '')} ${esc(k.utrustning?.serienummer ?? '')}</strong>${k.utrustning?.simulerad ? ' <span class="tagg">Simulerad</span>' : ''}
        <span class="under-text">Kopplad ${esc(tidpunkt(k.start))} av ${esc(k.kopplad.av ?? '')}${k.armbandKontrollerat ? ', armbandet kontrollerat' : ''}. ${esc(k.arbetsplats)}.${k.ordination ? ` Ger ${esc(k.ordination.text)}.` : ''}</span></div>
      ${v.kanKoppla ? `<div class="knapprad">${k.utrustning?.simulerad ? `<button type="button" class="knapp liten sekundar" data-mt-simulera="${esc(k.id)}">Hämta värden nu</button>` : ''}<button type="button" class="knapp liten sekundar" data-mt-avsluta="${esc(k.id)}">Koppla från</button></div>` : ''}
      ${k.utrustning?.typ === 'pump' ? pumpHtml(v.pumpar.find(p => p.koppling.id === k.id) ?? { senaste: null, okvitterade: [] }) : ''}
    </li>`).join('')}</ul>` : '<p class="tom liten">Ingen utrustning är kopplad till patienten.</p>'}
    ${v.kanKoppla ? `<form class="mt-koppla" id="mt-koppla" novalidate aria-labelledby="mt-koppla-rubrik">
      <h4 id="mt-koppla-rubrik">Koppla utrustning</h4>
      <p class="hjalp">Skanna streckkoden på utrustningen, eller välj den nedan. Skanna gärna armbandet också, så kontrollerar systemet att det är rätt patient.</p>
      <div class="falt-rad">
        <div class="falt"><label for="mt-streckkod">Utrustningens streckkod</label><input id="mt-streckkod" name="streckkod" autocomplete="off" spellcheck="false"></div>
        <div class="falt"><label for="mt-armband">Patientens armband (valfritt)</label><input id="mt-armband" name="armband" autocomplete="off" inputmode="numeric"></div>
        ${v.infusioner.length > 1 ? `<div class="falt"><label for="mt-ordination">Infusion för en pump</label><select id="mt-ordination" name="ordinationId">${v.infusioner.map(o => `<option value="${esc(o.id)}">${esc(o.text)}</option>`).join('')}</select></div>` : ''}
        <div class="falt knappfalt"><button type="submit" class="knapp">Koppla</button></div>
      </div>
      <p class="form-fel" role="alert" hidden></p>
      ${v.utrustning.length ? `<div class="mt-val"><p class="under-text">Utrustning på din vårdenhet:</p><ul class="mt-utrustning">${v.utrustning.map(u => `<li><button type="button" class="knapp liten sekundar" data-mt-valj="${esc(u.streckkod)}"${u.upptagen ? ' aria-describedby="mt-upptagen"' : ''}>${esc(u.typText)} ${esc(u.serienummer)}</button><span class="under-text">${esc(u.arbetsplats)}${u.upptagen ? ', kopplad till en annan patient' : ''}</span></li>`).join('')}</ul>
        <p class="under-text" id="mt-upptagen">Utrustning som är kopplad till en annan patient kopplas från den patienten när du kopplar den här.</p></div>` : ''}
    </form>` : ''}
    <p class="dampad liten">${esc(v.demo)} Format: ${esc(v.format.join(' och '))}.</p>
  </section>`;
}

// Patientens egna mätningar, skilda från vårdens värden.
export function egnaHtml(d) {
  const egna = d.egna ?? [];
  if (!egna.length) return '';
  const v = d.mt;
  const vantar = v?.vantar.patient ?? 0;
  return `<section class="mt-egna ov-sektion" aria-labelledby="mt-egna-rubrik">
    <div class="sektion-huvud"><h3 id="mt-egna-rubrik">Patientens egna mätningar</h3></div>
    <p class="under-text">Mätningar som patienten har registrerat i Min journal. De är inte kvalitetssäkrade och räknas inte i NEWS2, larm eller doser förrän de är bedömda.</p>
    ${vantar && v.kanGodkanna ? `<p class="knapprad"><button type="button" class="knapp liten" data-mt-godkann="patient">Godkänn ${vantar} ${vantar === 1 ? 'mätning' : 'mätningar'}</button><button type="button" class="knapp liten sekundar" data-mt-referens="patient">Bara som referens</button></p>` : ''}
    <div class="tabellrulle"><table class="tabell tat"><thead><tr><th scope="col">Tid</th><th scope="col">Mätvärde</th><th scope="col">Värde</th><th scope="col">Status</th></tr></thead>
      <tbody>${egna.map(m => `<tr><td>${esc(tidpunkt(m.tid))}</td><td>${esc(m.namn)}</td><td>${vardeText(m)}</td><td>${klassEtikett(m.klass)}${m.klass?.bedomd ? `<span class="under-text">Bedömd av ${esc(m.klass.bedomd.av ?? '')} ${esc(klockslag(m.klass.bedomd.tid))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

// Knapparna och formulären i utrustningsdelen och de egna mätningarna.
export function koppla(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const godkann = async (knapp, kalla, beslut) => {
    try {
      const r = await medKnapp(knapp, () => api(`/api/patient/${pid}/mt/godkann`, { metod: 'POST', data: { kalla, beslut } }));
      notis(r.text);
      ctx.ladda();
    } catch { /* felet visas som notis */ }
  };
  el.querySelectorAll('[data-mt-godkann]').forEach(b => b.addEventListener('click', () => godkann(b, b.dataset.mtGodkann, 'godkand')));
  el.querySelectorAll('[data-mt-referens]').forEach(b => b.addEventListener('click', () => godkann(b, b.dataset.mtReferens, 'referens')));
  el.querySelectorAll('[data-mt-avsluta]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await medKnapp(b, () => api(`/api/mt/koppling/${encodeURIComponent(b.dataset.mtAvsluta)}/avsluta`, { metod: 'POST', data: {} })); notis(r.text); ctx.ladda(); } catch { /* notis */ }
  }));
  el.querySelectorAll('[data-mt-simulera]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await medKnapp(b, () => api(`/api/mt/koppling/${encodeURIComponent(b.dataset.mtSimulera)}/simulera`, { metod: 'POST', data: {} })); notis(r.text, r.status === 'mottaget' ? 'ok' : 'info'); ctx.ladda(); } catch { /* notis */ }
  }));
  el.querySelectorAll('[data-kvittera]').forEach(f => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/mt/pumphandelse/${encodeURIComponent(f.dataset.kvittera)}/kvittera`, { metod: 'POST', data: { motivering: f.motivering.value } }), f); notis(r.text); ctx.ladda(); } catch { /* i formuläret */ }
  }));
  const form = el.querySelector('#mt-koppla');
  if (!form) return;
  const skicka = async (knapp) => {
    const data = { streckkod: form.streckkod.value.trim() };
    if (form.armband.value.trim()) data.armband = form.armband.value.trim();
    if (form.ordinationId) data.ordinationId = Number(form.ordinationId.value);
    try {
      const r = await medKnapp(knapp, () => api(`/api/patient/${pid}/mt/koppla`, { metod: 'POST', data }), form);
      notis(r.text);
      ctx.ladda();
    } catch (err) {
      const f = err?.data?.falt?.[0];
      if (f && form[f]) { form[f].setAttribute('aria-invalid', 'true'); form[f].focus(); }
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); skicka(form.querySelector('[type=submit]')); });
  form.querySelectorAll('[data-mt-valj]').forEach(b => b.addEventListener('click', () => { form.streckkod.value = b.dataset.mtValj; skicka(b); }));
}

// Min journal: patientens egna mätningar (Sussa 3.6.1.7). Patienten väljer vad som har mätts och skriver värdet, och
// systemet sätter tiden och skickar mätningen till vårdenheten som vårdar patienten.
export async function minEgna(el, ctx) {
  const d = await api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/egenmatning`);
  if (!ctx.aktuell()) return;
  el.innerHTML = `<section class="min-sektion" aria-labelledby="min-egna-rubrik"><h2 id="min-egna-rubrik">Egna mätningar</h2>
    <p class="ingress">${esc(d.text)}</p>
    ${d.mottagare ? `<form class="mv-form" id="min-egen" novalidate aria-labelledby="min-egen-rubrik"><h3 id="min-egen-rubrik">Lämna en mätning</h3>
      <div class="falt-rad">
        <div class="falt"><label for="min-egen-typ">Vad har du mätt?</label><select id="min-egen-typ" name="typ">${d.typer.map(t => `<option value="${esc(t.typ)}">${esc(t.namn)}</option>`).join('')}</select></div>
        <div class="falt smal"><label for="min-egen-varde">Värde</label><div class="med-enhet"><input id="min-egen-varde" name="varde" autocomplete="off" inputmode="text" aria-describedby="min-egen-enhet min-egen-hjalp"><span id="min-egen-enhet" class="enhet">${esc(d.typer[0]?.enhet ?? '')}</span></div><span class="hjalp" id="min-egen-hjalp">Blodtryck skrivs som övertryck/undertryck, till exempel 135/85.</span></div>
        <div class="falt"><label for="min-egen-tid">När mätte du?</label><input id="min-egen-tid" name="tid" type="datetime-local" aria-describedby="min-egen-tid-h"><span class="hjalp" id="min-egen-tid-h">Tomt betyder nu.</span></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Skicka till ${esc(d.mottagare)}</button></div>
      </div><p class="form-fel" role="alert" hidden></p></form>` : '<p class="tom">Det finns ingen vårdenhet som tar emot dina mätningar ännu.</p>'}
    ${d.matningar.length ? `<div class="tabellrulle"><table class="tabell tat"><caption>Dina mätningar</caption><thead><tr><th scope="col">Tid</th><th scope="col">Mätvärde</th><th scope="col">Värde</th><th scope="col">Skickad till</th><th scope="col">Status</th></tr></thead>
      <tbody>${d.matningar.map(m => `<tr><td>${esc(tidpunkt(m.tid))}</td><td>${esc(m.namn)}</td><td>${vardeText(m)}</td><td>${esc(m.mottagare)}</td><td><span class="tagg ${m.bedomd ? 'tagg-ok' : 'tagg-egen'}">${esc(m.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="tom liten">Du har inte lämnat några mätningar.</p>'}
  </section>`;
  const form = el.querySelector('#min-egen');
  if (!form) return;
  const enhet = form.querySelector('#min-egen-enhet');
  form.typ.addEventListener('change', () => { enhet.textContent = d.typer.find(t => t.typ === form.typ.value)?.enhet ?? ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { typ: form.typ.value, varde: form.varde.value.trim() };
    if (form.tid.value) data.tid = new Date(form.tid.value).toISOString();
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/egenmatning`, { metod: 'POST', data }), form);
      notis(r.text);
      ctx.ladda();
    } catch (err) {
      const f = err?.data?.falt?.[0];
      if (f && form[f]) { form[f].setAttribute('aria-invalid', 'true'); form[f].focus(); }
    }
  });
}
