// E-arkiv, gallring och förstöring av journaler (Sussa 5.4.2 och 5.3.1.7), för arkivarien. Allt kräver ett registrerat
// beslut. Systemet fyller i beslutsfattare och lagrum, räknar fram vad beslutet gäller och bygger exportpaketet.
// Arkivarien läser aldrig journalen: posterna visas bara med typ, datum och vårdenhet.
import { esc, api, vyRubrik, tidpunkt, datum, idag, notis, felNotis, medKnapp, dialog, ikon, plural } from '../ui.js';
import { far } from '../app.js';

export const namn = 'arkiv';

// Runda 9, r5 (Sussa 5.4.2.3): e-arkivets kvittens för ett paket som har levererats.
const leveransText = (l) => (!l ? '' : l.status === 'kvitterat'
  ? `<span class="under-text">Mottaget och kvitterat av ${esc(l.mottagare)} ${esc(tidpunkt(l.tid))}. Kvittensen är signerad.</span>`
  : `<span class="under-text">Avvisat av ${esc(l.mottagare)}: ${esc(l.orsak ?? '')}</span>`);
// Runda 9, r5 (Sussa 5.4.2.4): gallringsreglerna per informationsmängd, som systemförvaltaren ändrar.
const reglerLista = (regler) => `<section class="arkiv-kort" aria-labelledby="ar-regler"><h2 id="ar-regler">Gallringsregler</h2>
  <p class="dampad liten">Ett gallringsbeslut tar med reglerna som de gäller när beslutet registreras. Systemförvaltaren ändrar dem under Regler och parametrar, med fyra ögon. Hela journalen bevaras minst tio år efter den sista uppgiften.</p>
  <dl class="faktalista">${regler.map(r => `<div><dt>${esc(r.text)}</dt><dd>${esc(plural(r.ar, 'år', 'år'))}<span class="under-text">${esc(r.villkor)}</span></dd></div>`).join('')}</dl>
</section>`;
// Runda 13, r3 (E3-35): en gallring eller radering verkställs först när verksamhetschefen har godkänt den.
const STATUS = (b) => (b.verkstallt ? `Verkställt ${tidpunkt(b.verkstallt)} av ${b.verkstalltAv ?? ''}`
  : b.typ === 'leverans' || b.typ === 'mellanarkiv' ? 'Inte verkställt'
    : `Inte verkställt. ${[
      ...(b.godkannande?.enheter ?? []).map(g => `Godkänt för ${g.enhet} av ${g.av ?? ''} ${tidpunkt(g.tid)}`),
      ...(b.godkannande?.klart ? [] : [`Väntar på godkännande för ${(b.godkannande?.saknas ?? []).join(', ')}`]),
    ].join('. ')}`);
const pnamn = (p) => (p ? `${p.skyddad ? 'Skyddad identitet' : p.namn}, ${p.personnummer}` : 'Alla journaler');

function beslutKort(b) {
  const omf = b.omfattning;
  // Runda 14, r4: överföringen till mellanarkivet gäller handlingar från före regelns gräns, i alla journaler.
  const vad = b.typ === 'mellanarkiv' ? `Journalhandlingar från före ${datum(omf.fore)}`
    : b.typ === 'gallring' ? `Journaler med sista uppgift före ${datum(omf.fore)}` : b.typ === 'leverans' ? (omf.urval === 'alla' ? 'Alla journaler (återföring av all data)' : pnamn(b.patient))
    : `${pnamn(b.patient)}: ${omf.hela ? 'hela journalen' : plural(omf.poster.length, 'post', 'poster')}`;
  const res = b.resultat;
  return `<li class="arkiv-kort" data-beslut="${b.id}">
    <h3>${esc(b.typText)}, ${esc(b.diarienummer)}</h3>
    <dl class="faktalista">
      <div><dt>Beslut</dt><dd>${esc(datum(b.beslutsdatum))}, ${esc(b.beslutsfattare)}</dd></div>
      <div><dt>Lagrum</dt><dd>${esc(b.lagrum)}</dd></div>
      <div><dt>Gäller</dt><dd>${esc(vad)}</dd></div>
      <div><dt>Status</dt><dd>${esc(STATUS(b))}${res && b.typ === 'mellanarkiv' ? `. ${esc(plural(res.patienter, 'journal', 'journaler'))}, ${esc(plural(res.anteckningar, 'anteckning', 'anteckningar'))} och ${esc(plural(res.matvarden, 'mätvärde', 'mätvärden'))} i mellanarkivet` : res && !res.paket ? `. ${esc(plural(res.patienter, 'journal', 'journaler'))}` : ''}</dd></div>
      ${b.exporter.map(e => `<div><dt>Paket</dt><dd>${esc(e.id)}, ${esc(plural(e.filer, 'fil', 'filer'))}, ${esc(Math.round(e.storlek / 1024))} kB<span class="under-text">SHA-256 ${esc(e.sha256)}</span>${leveransText(e.leverans)}</dd></div>`).join('')}
    </dl>
    <div class="knapprad">
      ${b.typ === 'leverans' ? `<button type="button" class="knapp" data-leverera="${b.id}">${ikon.arkiv}<span>Leverera till e-arkivet</span></button><button type="button" class="knapp sekundar" data-paket="${b.id}">Ladda ner exportpaket</button>` : ''}
      ${b.typ !== 'leverans' && !b.verkstallt ? `<button type="button" class="knapp sekundar" data-underlag="${b.id}">Visa underlag</button>` : ''}
    </div>
    <div data-underlag-ut></div>
  </li>`;
}

export async function visa(main) {
  // Runda 13, r3 (E3-35): verksamhetschefen ser bara besluten som väntar på godkännande, utan patienter.
  if (!far('registrera_arkivbeslut')) return visaGodkannande(main);
  main.innerHTML = vyRubrik('E-arkiv och gallring', 'Export till e-arkiv, återföring av all data, gallring och förstöring av journaler. Allt kräver ett registrerat beslut och loggas. Journalens innehåll visas inte här.') + '<div id="arkiv"><p class="tom">Hämtar besluten.</p></div>';
  const [{ typer, gallringsregler = [] }, beslut] = await Promise.all([api('/api/arkiv/typer'), api('/api/arkiv/beslut')]);
  const el = main.querySelector('#arkiv');
  const tillstand = { typ: 'leverans', patient: null, poster: null };
  el.innerHTML = `<div class="arkiv-rutnat">
    <section class="arkiv-kort" aria-labelledby="ar-ny"><h2 id="ar-ny">Registrera ett beslut</h2>
      <form id="ar-form" novalidate>
        <fieldset class="valgrupp"><legend>Slag av beslut</legend>${Object.entries(typer).map(([k, t], i) => `<label class="val-rad"><input type="radio" name="typ" value="${k}"${i === 0 ? ' checked' : ''}><span>${esc(t.text)}</span></label>`).join('')}</fieldset>
        <p class="dampad liten" data-forklaring></p>
        <dl class="faktalista"><div><dt>Beslutsfattare</dt><dd data-fattare></dd></div><div><dt>Lagrum</dt><dd data-lagrum></dd></div></dl>
        <div class="falt"><label for="ar-dnr">Diarienummer</label><input id="ar-dnr" name="diarienummer" required maxlength="60" autocomplete="off"></div>
        <div class="falt"><label for="ar-datum">Beslutsdatum</label><input id="ar-datum" name="beslutsdatum" type="date" value="${esc(idag())}" max="${esc(idag())}"></div>
        <div data-patientdel>
          <label class="val-rad" data-alla><input type="checkbox" name="alla"><span>Alla journaler<span class="under-text">Återföring av all data, till exempel när avtalet upphör.</span></span></label>
          <div class="falt" data-patientfalt><label for="ar-pnr">Patientens personnummer eller annan identitet</label><input id="ar-pnr" name="pnr" autocomplete="off"><span class="hjalp" data-patient-svar></span></div>
          <label class="val-rad" data-hela hidden><input type="checkbox" name="hela" checked><span>Hela journalen</span></label>
          <div data-poster></div>
        </div>
        <p class="form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="submit" class="knapp">Registrera beslutet</button></div>
      </form>
    </section>
    ${gallringsregler.length ? reglerLista(gallringsregler) : ''}
    <section aria-labelledby="ar-lista"><h2 id="ar-lista">Beslut</h2>
      ${beslut.length ? `<ul class="arkiv-lista">${beslut.map(beslutKort).join('')}</ul>` : '<p class="tom">Inga beslut är registrerade.</p>'}
    </section>
  </div>`;

  const form = el.querySelector('#ar-form');
  const rita = () => {
    const t = typer[tillstand.typ];
    form.querySelector('[data-forklaring]').textContent = t.forklaring;
    form.querySelector('[data-fattare]').textContent = t.beslutsfattare;
    form.querySelector('[data-lagrum]').textContent = t.lagrum;
    form.querySelector('[data-patientdel]').hidden = tillstand.typ === 'gallring' || tillstand.typ === 'mellanarkiv';
    form.querySelector('[data-alla]').hidden = tillstand.typ !== 'leverans';
    form.querySelector('[data-patientfalt]').hidden = tillstand.typ === 'leverans' && form.alla.checked;
    form.querySelector('[data-hela]').hidden = tillstand.typ !== 'radering' || !tillstand.patient;
    const poster = form.querySelector('[data-poster]');
    poster.innerHTML = tillstand.typ === 'radering' && tillstand.poster && !form.hela.checked
      ? `<fieldset class="valgrupp"><legend>Poster som beslutet gäller</legend><div class="post-lista">${tillstand.poster.map(p => `<label class="val-rad"><input type="checkbox" name="post" value="${esc(p.typ)}:${p.id}"><span>${esc(p.text)} ${esc(datum(p.datum))}<span class="under-text">${esc(p.enhet)}${p.av ? `, ${esc(p.av)}` : ''}${p.versioner > 1 ? `, ${p.versioner} versioner` : ''}</span></span></label>`).join('')}</div><p class="dampad liten">Bara typ, datum och vårdenhet visas. En rättad anteckning raderas med alla sina versioner.</p></fieldset>`
      : '';
  };
  rita();
  form.addEventListener('change', (e) => { if (e.target.name === 'typ') tillstand.typ = e.target.value; if (['typ', 'alla', 'hela'].includes(e.target.name)) rita(); });
  // Systemet tolkar identiteten och visar vem det är, maskerat för skyddad identitet.
  form.pnr.addEventListener('change', async () => {
    const svar = form.querySelector('[data-patient-svar]');
    tillstand.patient = null; tillstand.poster = null;
    if (!form.pnr.value.trim()) { svar.textContent = ''; rita(); return; }
    try {
      const p = await api(`/api/arkiv/patient?q=${encodeURIComponent(form.pnr.value.trim())}`);
      tillstand.patient = p;
      svar.textContent = `${p.skyddad ? 'Skyddad identitet' : p.namn}, ${p.personnummer}${p.forstord ? '. Journalen är redan gallrad eller förstörd.' : ''}`;
      if (tillstand.typ === 'radering') tillstand.poster = (await api(`/api/arkiv/patient/${encodeURIComponent(p.id)}/poster`)).poster;
    } catch (err) { svar.textContent = err.message; }
    rita();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { typ: tillstand.typ, diarienummer: form.diarienummer.value.trim(), beslutsdatum: form.beslutsdatum.value };
    if (tillstand.typ === 'leverans') { if (form.alla.checked) data.omfattning = 'alla'; else data.patientId = tillstand.patient?.id; }
    if (tillstand.typ === 'radering') {
      data.patientId = tillstand.patient?.id;
      if (form.hela.checked) data.omfattning = 'hela';
      else data.poster = [...form.querySelectorAll('[name="post"]:checked')].map(c => { const [typ, id] = c.value.split(':'); return { typ, id: Number(id) }; });
    }
    try {
      await medKnapp(form.querySelector('[type="submit"]'), () => api('/api/arkiv/beslut', { metod: 'POST', data }), form);
      notis('Beslutet är registrerat.');
      visa(main);
    } catch { /* felet visas i formuläret */ }
  });

  el.querySelectorAll('[data-paket]').forEach(b => b.addEventListener('click', () => laddaNer(b, main)));
  el.querySelectorAll('[data-leverera]').forEach(b => b.addEventListener('click', () => leverera(b, main)));
  el.querySelectorAll('[data-underlag]').forEach(b => b.addEventListener('click', () => underlag(b, main)));
}

// Exportpaketet hämtas som en ZIP-fil och sparas i webbläsaren.
async function laddaNer(b, main) {
  b.disabled = true;
  try {
    const r = await fetch(`/api/arkiv/beslut/${b.dataset.paket}/paket`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).fel ?? 'Paketet kunde inte skapas.');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${r.headers.get('x-paket-id')}.zip`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    notis(`Exportpaketet ${r.headers.get('x-paket-id')} är skapat med ${r.headers.get('x-paket-filer')} filer för ${plural(Number(r.headers.get('x-paket-patienter')), 'journal', 'journaler')}.`);
    visa(main);
  } catch (err) { felNotis(err); b.disabled = false; }
}

// Runda 9, r5: systemet bygger paketet, skickar det till e-arkivet och visar kvittensen.
async function leverera(b, main) {
  try {
    const r = await medKnapp(b, () => api(`/api/arkiv/beslut/${b.dataset.leverera}/leverera`, { metod: 'POST', data: {} }));
    if (r.status === 'kvitterat') notis(`Paketet ${r.paket} med ${plural(r.patienter, 'journal', 'journaler')} är mottaget och kvitterat av ${r.mottagare}.`);
    else felNotis(new Error(`${r.mottagare} tog inte emot paketet. ${r.orsak ?? ''}`));
    visa(main);
  } catch { /* notis visad */ }
}

async function underlag(b, main) {
  const ut = b.closest('[data-beslut]').querySelector('[data-underlag-ut]');
  let u;
  try { u = await api(`/api/arkiv/beslut/${b.dataset.underlag}/underlag`); } catch (err) { felNotis(err); return; }
  // Runda 14, r4 (Sussa 5.4.2.2): överföringen till mellanarkivet raderar inget och kräver inget godkännande.
  if (u.beslut.typ === 'mellanarkiv') return underlagMellanarkiv(ut, u, main);
  // Runda 9, r5: delarna av andra journaler som gallras för sig, per informationsmängd.
  const delar = u.delar ?? [];
  ut.innerHTML = `<p>${u.regel ? `${esc(u.regel)} ` : ''}Beslutet gäller ${esc(plural(u.patienter.length, 'hel journal', 'hela journaler'))}${u.patienter.length ? ':' : '.'}</p>
    ${u.patienter.length ? `<ul class="post-lista">${u.patienter.map(p => `<li>${esc(pnamn(p))}${p.sistaUppgift ? `<span class="under-text">Sista uppgiften ${esc(datum(p.sistaUppgift))}</span>` : ''}</li>`).join('')}</ul>` : ''}
    ${delar.map(d => `<p>${esc(d.text)} äldre än ${esc(plural(d.ar, 'år', 'år'))}, före ${esc(datum(d.fore))}: ${esc(String(d.antal))} i ${esc(plural(d.patienter.length, 'journal', 'journaler'))}. Resten av journalerna finns kvar.</p>
      <ul class="post-lista">${d.patienter.map(p => `<li>${esc(pnamn(p))}<span class="under-text">${esc(String(p.antal))} st.</span></li>`).join('')}</ul>`).join('')}
    ${!(u.patienter.length || delar.length) ? '<p class="tom">Inga journaler uppfyller beslutet.</p>'
    : u.beslut.godkannande?.klart ? `<div class="knapprad"><button type="button" class="knapp knapp-allvar" data-verkstall>${ikon.varning}<span>Verkställ</span></button></div>`
      : `<p class="dampad">Verksamhetschefen för varje vårdenhet där uppgifterna finns godkänner verkställandet i sin egen inloggning, under E-arkiv och gallring. Godkännande saknas för ${esc((u.beslut.godkannande?.saknas ?? []).join(', '))}. Därefter kan du verkställa.</p>`}`;
  ut.querySelector('[data-verkstall]')?.addEventListener('click', async (e) => {
    const ok = await dialog(`<h2 id="dlg-rubrik">${ikon.varning}<span>Verkställ beslutet</span></h2>
      <div class="dialog-text"><p>${esc(u.beslut.typText)} enligt ${esc(u.beslut.diarienummer)}. Journalhandlingarna för ${esc(plural(u.patienter.length, 'journal', 'journaler'))}${delar.length ? ` och de utpekade delarna av ${esc(plural(new Set(delar.flatMap(d => d.patienter.map(p => p.id))).size, 'journal', 'journaler'))}` : ''} raderas och går inte att återskapa.</p>
      <p>Åtkomstloggen ändras inte. Raderingen loggas med beslutets id och hur många poster som togs bort. Patientens identitet, utskrifter och utlämnanden finns kvar.</p></div>
      <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp knapp-allvar" data-varde="ok">Verkställ</button></div>`, { klass: 'dialog-allvar' });
    if (!ok) return;
    try {
      await medKnapp(e.currentTarget, () => api(`/api/arkiv/beslut/${u.beslut.id}/verkstall`, { metod: 'POST', data: {} }));
      notis('Beslutet är verkställt.');
      visa(main);
    } catch { /* notis visad */ }
  });
}

// Runda 13, r3 (E3-35, beslut från Jonas): verksamhetschefens godkännande av gallring och radering. Fyra ögon innan
// journaler raderas som inte går att återskapa. Underlaget visas i antal, inte med patienter.
async function visaGodkannande(main) {
  main.innerHTML = vyRubrik('E-arkiv och gallring', 'Arkivarien förbereder gallring och radering av journaler. Du godkänner verkställandet för din vårdenhet innan något raderas där. Journalernas innehåll visas inte här, och inget om andra vårdenheter.') + '<div id="arkiv"><p class="tom">Hämtar besluten.</p></div>';
  const el = main.querySelector('#arkiv');
  const { beslut } = await api('/api/arkiv/godkanna');
  el.innerHTML = `<section class="arkiv-kort" aria-labelledby="ar-godk"><h2 id="ar-godk">Att godkänna</h2>
    ${beslut.length ? `<ul class="arkiv-lista">${beslut.map(b => `<li class="arkiv-kort" data-godk="${b.id}">
      <h3>${esc(b.typText)}, ${esc(b.diarienummer)}</h3>
      <dl class="faktalista">
        <div><dt>Beslut</dt><dd>${esc(datum(b.beslutsdatum))}, ${esc(b.beslutsfattare)}</dd></div>
        <div><dt>Lagrum</dt><dd>${esc(b.lagrum)}</dd></div>
        <div><dt>Omfattning</dt><dd>${esc(b.omfattning)}</dd></div>
        <div><dt>Förberett</dt><dd>${esc(b.registreradAv ?? '')}, ${esc(tidpunkt(b.registrerad))}</dd></div>
        ${b.motivering ? `<div><dt>Motivering</dt><dd>${esc(b.motivering)}</dd></div>` : ''}
      </dl>
      <div class="knapprad"><button type="button" class="knapp knapp-allvar" data-godkann="${b.id}">Godkänn verkställandet</button></div>
    </li>`).join('')}</ul>` : '<p class="tom">Inga beslut väntar på ditt godkännande.</p>'}
  </section>`;
  el.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-godkann]');
    if (!k) return;
    const b = beslut.find(x => String(x.id) === k.dataset.godkann);
    const ok = await dialog(`<h2 id="dlg-rubrik">${ikon.varning}<span>Godkänn verkställandet</span></h2>
      <div class="dialog-text"><p>${esc(b.typText)} enligt ${esc(b.diarienummer)}: ${esc(b.omfattning)}. När arkivarien verkställer raderas journalhandlingarna och går inte att återskapa.</p></div>
      <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp knapp-allvar" data-varde="ok">Godkänn</button></div>`, { klass: 'dialog-allvar' });
    if (!ok) return;
    try {
      const r = await medKnapp(k, () => api(`/api/arkiv/beslut/${b.id}/godkann`, { metod: 'POST', data: {} }));
      notis(r?.klart ? 'Verkställandet är godkänt. Arkivarien kan nu verkställa beslutet.' : 'Verkställandet är godkänt för din vårdenhet. Andra berörda vårdenheter ska också godkänna.');
      visaGodkannande(main);
    } catch { /* notis visad */ }
  });
}

// Runda 14, r4 (Sussa 5.4.2.2): systemet har tagit fram handlingarna. Arkivarien ser antal och period per journal, aldrig
// innehållet, och för över dem med ett klick. Handlingarna visas sedan i journalen som förut.
function underlagMellanarkiv(ut, u, main) {
  const n = u.patienter.reduce((s, p) => s + p.anteckningar + p.matvarden, 0);
  ut.innerHTML = `<p>${esc(u.regel)} Mottagare: ${esc(u.mottagare)}.</p>
    ${u.patienter.length ? `<ul class="post-lista">${u.patienter.map(p => `<li>${esc(pnamn(p))}<span class="under-text">${esc(plural(p.anteckningar, 'anteckning', 'anteckningar'))} och ${esc(plural(p.matvarden, 'mätvärde', 'mätvärden'))}${p.period ? `, ${esc(p.period)}` : ''}</span></li>`).join('')}</ul>
      <div class="knapprad"><button type="button" class="knapp" data-overfor>${ikon.arkiv}<span>För över till mellanarkivet</span></button></div>
      <p class="dampad liten">Mellanarkivet kontrollerar varje paket innan något förs över. Uppgifterna visas sedan i journalen för den som har rätt att läsa dem, och de ändras aldrig.</p>`
    : '<p class="tom">Inga journalhandlingar uppfyller beslutet.</p>'}`;
  ut.querySelector('[data-overfor]')?.addEventListener('click', async (e) => {
    try {
      const r = await medKnapp(e.currentTarget, () => api(`/api/arkiv/beslut/${u.beslut.id}/overfor`, { metod: 'POST', data: {} }));
      notis(`${plural(n, 'journalhandling', 'journalhandlingar')} i ${plural(r.resultat.patienter, 'journal', 'journaler')} är överförda till mellanarkivet.`);
      visa(main);
    } catch { /* notis visad */ }
  });
}
