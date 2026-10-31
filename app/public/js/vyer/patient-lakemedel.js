// Läkemedelslistan: ordinationer med NLL-status, ordination med obligatoriska fält och varningar, utsättning och avstämning mot NLL.
import { esc, api, datum, tidpunkt, migreradEtikett, notis, felNotis, faltFel, medKnapp, dialog, ikon, ORDTYP, idag, plusDagar } from '../ui.js';
import { far } from '../app.js';
import { doldaRad } from './patient.js';
import { nllChip } from './patient-oversikt.js';

let nastaOverforing = null;

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel`);
  if (!ctx.aktuell()) return;
  const kanOrdinera = far('ordinera');
  const aktuella = d.ordinationer.filter(o => o.aktuell);
  const ovriga = d.ordinationer.filter(o => !o.aktuell);
  el.innerHTML = `<div class="flikhuvud"><h2>Läkemedel</h2>
      ${kanOrdinera ? `<button type="button" class="knapp" data-ny aria-expanded="false" aria-controls="ordform">${ikon.plus}<span>Ordinera</span></button>` : '<p class="dampad liten">Din yrkesroll kan läsa läkemedelslistan men inte ordinera.</p>'}</div>
    ${doldaRad(d.dolda)}
    <p class="dampad liten">Läkemedelslistan är gemensam för vårdgivaren och följer Nationella läkemedelslistan (NLL). Varje ändring skickas till NLL och kvitteras. I demon är NLL simulerad.</p>
    <div id="ordform-plats"></div>
    ${kanOrdinera ? nllDemo() : ''}
    <section aria-labelledby="lm-akt"><h3 id="lm-akt">Aktuella ordinationer <span class="antal">${aktuella.length}</span></h3>${tabell(aktuella, kanOrdinera, true)}</section>
    ${ovriga.length ? `<section aria-labelledby="lm-utsatt"><h3 id="lm-utsatt">Utsatta och avslutade <span class="antal">${ovriga.length}</span></h3>${tabell(ovriga, kanOrdinera, false)}</section>` : ''}`;

  el.querySelector('[data-ny]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#ordform-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    ordinationsForm(plats, ctx);
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-utsatt],[data-avstam],[data-nll]');
    if (!b) return;
    if (b.dataset.nll) {
      try {
        const r = await medKnapp(b, () => api('/api/demo/nll-timeout', { metod: 'POST', data: b.dataset.nll === 'fel' ? { lage: 'fel' } : {} }));
        nastaOverforing = r.nastaOverforing;
        notis(nastaOverforing === 'fel' ? 'Nästa överföring till NLL får ett felsvar.' : 'Nästa överföring till NLL får timeout.', 'info');
        el.querySelector('#nll-lage').textContent = lageText();
      } catch { /* notis visad */ }
    } else if (b.dataset.utsatt) {
      const o = d.ordinationer.find(x => String(x.id) === b.dataset.utsatt);
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Sätt ut ${esc(o.lakemedel?.namn)}</h2>
          <p>Ordinationen raderas inte. Den flyttas till utsatta med orsak, tid och vem som satte ut den, och utsättningen skickas till NLL.</p>
          <div class="falt"><label for="ut-orsak">Orsak till utsättningen <span class="obl">(obligatoriskt)</span></label><textarea id="ut-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
          <p class="dialog-fel form-fel" role="alert" hidden></p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Sätt ut</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (x.orsak.trim().length < 3 ? 'Ange orsaken med minst tre tecken.' : null) });
      if (!svar) return;
      try {
        const r = await api(`/api/ordination/${o.id}/utsatt`, { metod: 'POST', data: { orsak: svar.data.orsak.trim() } });
        nastaOverforing = null;
        notis(`${o.lakemedel?.namn} är utsatt. ${nllResultat(r.nll)}`, r.nll.status === 'kvitterad' ? 'ok' : 'info');
        ctx.ladda();
      } catch (err) { felNotis(err); }
    } else if (b.dataset.avstam) {
      try {
        const r = await medKnapp(b, () => api(`/api/ordination/${b.dataset.avstam}/nll-avstam`, { metod: 'POST', data: {} }));
        nastaOverforing = null;
        notis(r.resultat === 'fanns_registrerad'
          ? `Avstämningen visar att NLL hade registrerat ordinationen. Kvittens ${r.kvittens}.`
          : `Ordinationen saknades i NLL och har skickats igen. ${nllResultat(r.nll)}`);
        ctx.ladda();
      } catch { /* notis visad */ }
    }
  });
}

const lageText = () => (nastaOverforing === 'fel' ? 'Nästa överföring får ett felsvar.' : nastaOverforing === 'timeout' ? 'Nästa överföring får timeout.' : 'Nästa överföring går som vanligt.');

function nllDemo() {
  return `<details class="demo-panel"><summary>Demo: simulera problem mot NLL</summary>
    <p>En timeout får aldrig dölja en lyckad förskrivning. Simulera ett fel, ordinera sedan, och se att ordinationen ändå syns i listan med status Okänd, kontrolleras. Stäm sedan av mot NLL.</p>
    <div class="knapprad"><button type="button" class="knapp sekundar liten" data-nll="timeout">Simulera timeout mot NLL</button><button type="button" class="knapp sekundar liten" data-nll="fel">Simulera fel från NLL</button></div>
    <p class="liten" id="nll-lage" aria-live="polite">${esc(lageText())}</p>
  </details>`;
}

export function nllResultat(nll) {
  if (!nll) return '';
  if (nll.status === 'kvitterad') return `NLL kvitterade överföringen (${nll.kvittens}).`;
  if (nll.status === 'timeout') return 'Överföringen till NLL fick timeout. Ordinationen gäller och visas i listan med status Okänd, kontrolleras. Stäm av mot NLL.';
  if (nll.status === 'fel') return 'NLL svarade med fel. Ordinationen visas i listan med status Fel från NLL. Stäm av för att skicka den igen.';
  return '';
}

function tabell(rader, kanOrdinera, aktuella) {
  if (!rader.length) return '<p class="tom liten">Inga.</p>';
  return `<div class="tabellrulle"><table class="tabell lm-tabell">
    <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Typ</th><th scope="col">Ordinationsorsak</th><th scope="col">${aktuella ? 'Uppföljning' : 'Utsatt'}</th><th scope="col">NLL</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
    <tbody>${rader.map(o => `<tr>
      <td><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka)} ${esc(o.lakemedel?.form)}</span>
        <span class="under-text">ATC ${esc(o.lakemedel?.atc)}, ordinerat ${esc(datum(o.start))} av ${esc(o.ordineradAv?.namn ?? '')}, ${esc(o.vardenhet?.namn ?? '')}</span>${migreradEtikett(o)}
        ${o.kvitteradeVarningar?.length ? `<span class="under-text">Kvitterade varningar: ${o.kvitteradeVarningar.map(k => `${esc(k.regel)} (${esc(k.motivering)})`).join('; ')}</span>` : ''}</td>
      <td>${esc(o.dosering)}${o.tider?.length ? `<span class="under-text">Kl. ${esc(o.tider.join(', '))}</span>` : ''}</td>
      <td>${esc(ORDTYP[o.typ] ?? o.typ)}</td>
      <td>${esc(o.ordinationsorsak)}</td>
      <td>${aktuella ? `${esc(datum(o.uppfoljningsdatum))}${o.slut ? `<span class="under-text">Slut ${esc(datum(o.slut))}</span>` : ''}` : (o.utsatt ? `${esc(datum(o.utsatt.tid))}<span class="under-text">${esc(o.utsatt.orsak ?? '')}, ${esc(o.utsatt.av ?? '')}</span>` : `Slut ${esc(datum(o.slut))}`)}</td>
      <td>${nllChip(o.nll_status)}</td>
      <td class="atgarder">
        ${kanOrdinera && ['okand_kontrolleras', 'fel'].includes(o.nll_status) ? `<button type="button" class="knapp liten" data-avstam="${o.id}">Stäm av mot NLL</button>` : ''}
        ${kanOrdinera && o.status === 'aktiv' ? `<button type="button" class="knapp liten sekundar" data-utsatt="${o.id}">Sätt ut</button>` : ''}
        <details class="historik"><summary>Historik</summary><ol>${(o.historik ?? []).map(h => `<li><time>${esc(tidpunkt(h.tid))}</time> ${esc(h.handelse)}${h.detalj ? `: ${esc(h.detalj)}` : ''}${h.av ? ` <span class="dampad">(${esc(h.av)})</span>` : ''}</li>`).join('')}</ol></details>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function ordinationsForm(plats, ctx) {
  const i = idag();
  plats.innerHTML = `<form class="ordform" id="ordform" novalidate aria-labelledby="ord-rubrik">
    <h3 id="ord-rubrik" tabindex="-1">Ny ordination</h3>
    <div class="falt lm-sok"><label for="lm-sok">Läkemedel <span class="obl">(obligatoriskt)</span></label>
      <input id="lm-sok" type="search" autocomplete="off" placeholder="Sök på namn, substans eller ATC-kod" aria-describedby="lm-valt" aria-controls="lm-traffar">
      <input type="hidden" name="lakemedelId">
      <ul class="lm-traffar" id="lm-traffar" aria-label="Träffar i läkemedelskatalogen"></ul>
      <p class="hjalp" id="lm-valt" aria-live="polite">Inget läkemedel valt.</p>
    </div>
    <div class="falt-rad">
      <div class="falt bred"><label for="o-dosering">Dosering <span class="obl">(obligatoriskt)</span></label><input id="o-dosering" name="dosering" required maxlength="300" placeholder="Till exempel 1 tablett morgon och kväll"></div>
      <div class="falt smal"><label for="o-dos">Dos</label><input id="o-dos" name="dos" inputmode="decimal"></div>
      <div class="falt smal"><label for="o-dosenhet">Enhet</label><input id="o-dosenhet" name="dosEnhet" placeholder="mg"></div>
      <div class="falt smal"><label for="o-tider">Tider</label><input id="o-tider" name="tider" placeholder="08, 20"></div>
    </div>
    <div class="falt-rad">
      <div class="falt"><label for="o-typ">Typ</label><select id="o-typ" name="typ"><option value="staende">Stående</option><option value="vid_behov">Vid behov</option><option value="tillfallig">Tillfällig</option></select></div>
      <div class="falt bred"><label for="o-orsak">Ordinationsorsak <span class="obl">(obligatoriskt)</span></label><input id="o-orsak" name="ordinationsorsak" required maxlength="300"></div>
    </div>
    <div class="falt-rad">
      <div class="falt"><label for="o-upp">Uppföljningsdatum <span class="obl">(obligatoriskt)</span></label><input id="o-upp" name="uppfoljningsdatum" type="date" required min="${i}" value=""></div>
      <div class="falt"><label for="o-start">Startdatum</label><input id="o-start" name="start" type="date" value="${i}"></div>
      <div class="falt"><label for="o-slut">Slutdatum</label><input id="o-slut" name="slut" type="date"></div>
    </div>
    <p class="hjalp">Ordinationsorsak och uppföljningsdatum krävs av Nationella läkemedelslistan. Förslag på uppföljning: <button type="button" class="lanknapp" data-upp="14">om två veckor</button>, <button type="button" class="lanknapp" data-upp="90">om tre månader</button>.</p>
    <div id="varningar"></div>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp" data-spara>Kontrollera och spara</button><button type="button" class="knapp text" data-stang>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  form.querySelector('h3').focus();
  const sok = form.querySelector('#lm-sok');
  const traffar = form.querySelector('#lm-traffar');
  let timer = null;
  let kontrollerad = null;
  sok.addEventListener('input', () => {
    clearTimeout(timer);
    const v = sok.value.trim();
    if (v.length < 2) { traffar.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const lista = await api(`/api/lakemedel/katalog?q=${encodeURIComponent(v)}`);
        traffar.innerHTML = lista.length ? lista.slice(0, 8).map(l => `<li><button type="button" data-lm="${esc(l.id)}" data-namn="${esc(`${l.namn} ${l.styrka} ${l.form}`)}"><strong>${esc(l.namn)}</strong> ${esc(l.styrka)} ${esc(l.form)} <span class="dampad">${esc(l.substans)}, ATC ${esc(l.atc)}</span></button></li>`).join('') : '<li class="tom liten">Inget läkemedel i katalogen matchar.</li>';
      } catch (e) { felNotis(e); }
    }, 180);
  });
  traffar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lm]');
    if (!b) return;
    form.lakemedelId.value = b.dataset.lm;
    form.querySelector('#lm-valt').textContent = `Valt: ${b.dataset.namn}`;
    sok.value = b.dataset.namn;
    traffar.innerHTML = '';
    kontrollerad = null;
    form.querySelector('#varningar').innerHTML = '';
    form.dosering.focus();
  });
  form.addEventListener('click', (e) => {
    const u = e.target.closest('[data-upp]');
    if (u) { form.uppfoljningsdatum.value = plusDagar(form.start.value || i, Number(u.dataset.upp)); }
    if (e.target.closest('[data-stang]')) { plats.innerHTML = ''; plats.closest('.flikinnehall')?.querySelector('[data-ny]')?.setAttribute('aria-expanded', 'false'); }
  });
  form.addEventListener('input', (e) => { if (!e.target.closest('#varningar') && e.target !== sok) kontrollerad = null; });

  const data = () => ({
    lakemedelId: form.lakemedelId.value, dosering: form.dosering.value.trim(),
    dos: form.dos.value.trim() ? Number(form.dos.value.replace(',', '.')) : null, dosEnhet: form.dosEnhet.value.trim() || null,
    tider: form.tider.value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean), typ: form.typ.value, vidBehov: form.typ.value === 'vid_behov',
    ordinationsorsak: form.ordinationsorsak.value.trim(), uppfoljningsdatum: form.uppfoljningsdatum.value, start: form.start.value || i, slut: form.slut.value || null,
  });
  const NAMN = { lakemedelId: 'lakemedelId', dosering: 'dosering', dos: 'dos', typ: 'typ', ordinationsorsak: 'ordinationsorsak', uppfoljningsdatum: 'uppfoljningsdatum', start: 'start', slut: 'slut' };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knapp = form.querySelector('[data-spara]');
    const o = data();
    if (!o.lakemedelId) { faltFel(form, { message: 'Välj ett läkemedel i katalogen.', data: {} }); sok.focus(); return; }
    try {
      await medKnapp(knapp, async () => {
        // Första steget: kontroll. Varningar visas och allvarliga måste kvitteras med motivering.
        const nyckel = JSON.stringify(o);
        if (kontrollerad !== nyckel) {
          const k = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel/kontroll`, { metod: 'POST', data: o });
          kontrollerad = nyckel;
          if (k.varningar.length) { visaVarningar(form, k); knapp.textContent = 'Spara ordinationen'; return; }
        }
        const kv = [...form.querySelectorAll('[data-motivering]')].map(t => ({ regel: t.dataset.motivering, motivering: t.value.trim() }));
        const saknas = kv.filter(k => k.motivering.length < 3);
        if (saknas.length) {
          const t = form.querySelector(`[data-motivering="${saknas[0].regel}"]`);
          t.setAttribute('aria-invalid', 'true'); t.focus();
          throw Object.assign(new Error('Allvarliga varningar måste kvitteras med en motivering innan ordinationen sparas.'), { status: 400, data: {} });
        }
        const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel`, { metod: 'POST', data: { ...o, kvitteradeVarningar: kv } });
        nastaOverforing = null;
        notis(`${r.ordination.lakemedel?.namn} är ordinerat. ${nllResultat(r.nll)}`, r.nll.status === 'kvitterad' ? 'ok' : 'info');
        ctx.ladda();
      }, form);
    } catch (err) {
      if (err.status === 400 && err.data?.varningar) { visaVarningar(form, err.data); }
      else if (err.status === 400) faltFel(form, err, NAMN);
    }
  });
}

function visaVarningar(form, k) {
  const allv = k.varningar.filter(v => v.niva === 'allvarlig');
  const obs = k.varningar.filter(v => v.niva !== 'allvarlig');
  const regler = [...new Set(allv.map(v => v.regel))];
  const ut = form.querySelector('#varningar');
  ut.innerHTML = `<div class="varningslista" role="alert">
    <h4>${ikon.varning}<span>${k.varningar.length === 1 ? 'En varning' : `${k.varningar.length} varningar`} före sparande</span></h4>
    ${allv.length ? `<ul class="varn-allvarlig">${allv.map(v => `<li><strong>Allvarlig.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${obs.length ? `<ul class="varn-observera">${obs.map(v => `<li><strong>Observera.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${regler.map((r, n) => `<div class="falt"><label for="kv-${n}">Motivering för att ordinera trots varningen (${esc(r.replace(/_/g, ' '))}) <span class="obl">(obligatoriskt)</span></label><textarea id="kv-${n}" rows="2" data-motivering="${esc(r)}" maxlength="500"></textarea></div>`).join('')}
    <p class="demoregel">${esc(k.anmarkning ?? 'Varningarna är demoregler, inte kliniskt beslutsstöd.')}</p>
  </div>`;
  ut.querySelector('textarea')?.focus();
}
