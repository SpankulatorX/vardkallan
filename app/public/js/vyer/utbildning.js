// Utbildning: övningar och intyg i utbildningsmiljön (Sussa 10.1.1.5). Varje yrkesroll gör sina övningar med
// demopatienter, servern rättar och förklarar, och alla rätt ger ett intyg som gäller i ett år. Verksamhetschefen ser
// intygen för vårdenheten och utfärdar utbildarintyg. Verksamhetschefen och utbildarna ändrar övningarna, och varje
// ändring sparas som en ny version med historik.
import { esc, api, vyRubrik, medKnapp, notis, ikon, datum, tidpunkt, faltFel } from '../ui.js';
import { HJALP } from '../hjalp.js';

export const namn = 'utbildning';

const STATUSIKON = { giltigt: ikon.bock, gar_ut: ikon.varning, utgatt: ikon.kryss, saknas: ikon.info };
const intygHtml = (i) => `<span class="intyg intyg-${esc(i.status)}">${STATUSIKON[i.status] ?? ''}<span>${esc(i.text)}</span></span>`;
const giltigHtml = (i) => (i.giltigtTill ? `Giltigt till ${esc(datum(i.giltigtTill))}` : 'Gör övningarna för att få ett intyg.');
const BOKSTAV = ['A', 'B', 'C', 'D', 'E'];

function minaHtml(o) {
  const utb = ['giltigt', 'gar_ut'].includes(o.utbildare?.status);
  return `<section class="ruta" aria-labelledby="ut-intyg-rubrik">
    <h2 id="ut-intyg-rubrik">Ditt intyg</h2>
    <p data-intyg>${intygHtml(o.intyg)} <span class="dampad">${giltigHtml(o.intyg)}</span></p>
    ${utb ? `<p data-utbildare>${intygHtml(o.utbildare)} <span class="dampad">Utbildarintyget gäller till ${esc(datum(o.utbildare.giltigtTill))}. Du kan ändra övningarna.</span></p>` : ''}
    <p class="dampad liten">${esc(o.kurs)} för ${esc(o.rollText.toLowerCase())}, version ${o.version} av övningarna. ${o.ovningar.length} övningar${o.vardenhet?.antalEgna ? `, varav ${o.vardenhet.antalEgna} som ${esc(o.vardenhet.namn)} har lagt till (version ${o.vardenhet.version})` : ''}. Alla svar ska vara rätt, och intyget gäller i ett år. ${esc(o.utbildningsmiljo)}</p>
  </section>`;
}

function ovningarHtml(o) {
  return `<section aria-labelledby="ut-ov-rubrik">
    <h2 id="ut-ov-rubrik">Övningar</h2>
    <form id="ovningar" class="ovningar" novalidate>
      ${o.ovningar.map((x, i) => `<fieldset class="ovning" data-ovning="${esc(x.id)}">
        <legend><span class="ovning-nr">Övning ${i + 1}.</span> ${esc(x.fraga)}${x.enhet ? ` <span class="tagg">${esc(o.vardenhet?.namn ?? 'Vårdenhetens egen')}</span>` : ''}</legend>
        ${x.alternativ.map(a => `<div class="ovning-val"><input type="radio" id="ov-${esc(x.id)}-${esc(a.id)}" name="${esc(x.id)}" value="${esc(a.id)}"><label for="ov-${esc(x.id)}-${esc(a.id)}">${esc(a.text)}</label></div>`).join('')}
        ${x.prova ? `<p class="liten"><a href="${esc(x.prova)}">Pröva i demon</a></p>` : ''}
        <p class="ovning-svar" data-svar="${esc(x.id)}" hidden></p>
      </fieldset>`).join('')}
      <p class="form-fel" id="ov-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp" data-a="ratta">Rätta övningarna</button></div>
      <p data-resultat role="status" hidden></p>
    </form>
  </section>`;
}

function enhetHtml(e) {
  const s = e.summa;
  return `<section aria-labelledby="ut-enhet-rubrik" data-intyg-enhet>
    <h2 id="ut-enhet-rubrik">Intyg på ${esc(e.vardenhet.namn)}</h2>
    <p class="dampad">${s.giltigt} med giltigt intyg, ${s.gar_ut} som går ut inom ${e.garUtDagar} dagar, ${s.utgatt} som har gått ut och ${s.saknas} utan intyg. De som behöver göra övningarna står först. Utbildarintyg kan utfärdas till den som själv har ett giltigt intyg.</p>
    <div class="tabellrulle"><table class="tabell">
      <thead><tr><th scope="col">Namn</th><th scope="col">Titel</th><th scope="col">Intyg</th><th scope="col">Giltigt till</th><th scope="col">Utbildare</th></tr></thead>
      <tbody>${e.personer.map(p => `<tr><th scope="row">${esc(p.namn)}</th><td>${esc(p.titel)}</td><td>${intygHtml(p)}</td><td>${p.giltigtTill ? esc(datum(p.giltigtTill)) : '<span class="dampad">Inget datum</span>'}</td>
        <td>${p.utbildare.status === 'saknas' ? '' : intygHtml(p.utbildare)}${p.kanBliUtbildare ? ` <button type="button" class="knapp liten sekundar" data-utbildare="${esc(p.id)}" aria-label="Utfärda utbildarintyg till ${esc(p.namn)}">Utfärda utbildarintyg</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

const hjalpLista = () => `<section aria-labelledby="ut-hjalp-rubrik">
    <h2 id="ut-hjalp-rubrik">Hjälp i flödena</h2>
    <p>Knappen Hjälp finns i de vanligaste flödena och förklarar vad du gör och vad systemet gör åt dig: ${Object.values(HJALP).map(h => esc(h.rubrik.toLowerCase())).join(', ')}.</p>
    <p><a href="#/nyheter">Nyheter i den här versionen</a></p>
  </section>`;

// Formuläret för en övning när övningarna ändras. i är platsen i listan.
function redigeraOvning(x, i, r) {
  const p = `ovr-${i}`;
  const alt = [...x.alternativ, ...Array(Math.max(0, 4 - x.alternativ.length)).fill({ id: '', text: '' })].slice(0, 5);
  return `<details class="ov-red" data-i="${i}" data-id="${esc(x.id)}"${x.ny ? ' open' : ''}>
    <summary><span class="ovning-nr">Övning ${i + 1}.</span> <span data-sammanfattning>${esc(x.fraga || 'Ny övning')}</span></summary>
    <div class="ov-red-inre">
      <div class="falt"><label for="${p}-fraga">Fråga</label><textarea id="${p}-fraga" name="fraga" rows="2">${esc(x.fraga)}</textarea></div>
      <fieldset class="ov-red-grupp"><legend>Yrkesroller som gör övningen</legend>
        ${r.roller.map(y => `<label class="ov-kryss"><input type="checkbox" name="roller" value="${esc(y.id)}"${x.roller.includes(y.id) ? ' checked' : ''}> ${esc(y.text)}</label>`).join('')}
      </fieldset>
      <fieldset class="ov-red-grupp"><legend>Svarsalternativ, och vilket som är rätt</legend>
        ${alt.map((a, j) => `<div class="ov-alt"><input type="radio" id="${p}-ratt-${j}" name="${p}-ratt" value="${j}"${a.id && a.id === x.ratt ? ' checked' : ''}><label for="${p}-ratt-${j}" class="ov-alt-ratt">Rätt svar ${BOKSTAV[j]}</label>
          <label class="sr" for="${p}-alt-${j}">Alternativ ${BOKSTAV[j]}</label><input type="text" id="${p}-alt-${j}" name="alt" value="${esc(a.text)}" placeholder="Alternativ ${BOKSTAV[j]}"></div>`).join('')}
      </fieldset>
      <div class="falt"><label for="${p}-forklaring">Förklaring som visas efter rättningen</label><textarea id="${p}-forklaring" name="forklaring" rows="2">${esc(x.forklaring)}</textarea></div>
      <div class="falt"><label for="${p}-prova">Länk till demon</label><select id="${p}-prova" name="prova"><option value="">Ingen länk</option>${r.prova.map(v => `<option value="${esc(v)}"${v === x.prova ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <label class="ov-kryss"><input type="checkbox" name="bort"> Ta bort övningen i den nya versionen</label>
    </div>
  </details>`;
}

function redigeraHtml(r) {
  // Runda 8, r5: vårdgivarens övningar eller vårdenhetens egna, med var sin historik.
  const enhet = r.omfang === 'enhet';
  const lage = enhet && !r.version ? `${esc(r.vardenhet.namn)} har inga egna övningar än. Lägg till en övning och spara den första versionen.` : `Version ${r.version} gäller nu. Ändra, lägg till eller ta bort övningar och spara en ny version.`;
  return `<h3>${enhet ? `Egna övningar för ${esc(r.vardenhet.namn)}` : 'Vårdgivarens övningar'}</h3>
    <p>${lage} Den förra versionen finns kvar i historiken, och intyg som redan är utfärdade gäller. Systemet prövar övningarna innan de sparas och säger vad som saknas.${enhet ? ' De egna övningarna görs av personalen på vårdenheten utöver vårdgivarens.' : ''}</p>
    <form id="ov-redigera" novalidate>
      <div id="ov-red-lista">${r.ovningar.map((x, i) => redigeraOvning(x, i, r)).join('')}</div>
      <div class="knapprad"><button type="button" class="knapp sekundar" data-ny-ovning>${ikon.plus}<span>Lägg till en övning</span></button></div>
      <div class="falt"><label for="ov-andring">Vad har ändrats <span class="obl">(obligatoriskt)</span></label><input type="text" id="ov-andring" name="andring" maxlength="300" aria-describedby="ov-andring-h"><span class="hjalp" id="ov-andring-h">Står i historiken, till exempel Tydligare fråga om loggen.</span></div>
      <p class="form-fel" id="ov-red-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp" data-a="spara-ovningar">Spara ny version</button></div>
    </form>
    <h3>Historik</h3>
    <div class="tabellrulle"><table class="tabell" data-ov-historik>
      <thead><tr><th scope="col">Version</th><th scope="col">Sparad</th><th scope="col">Av</th><th scope="col">Vad som ändrades</th><th scope="col" class="tal">Övningar</th></tr></thead>
      <tbody>${r.historik.map(h => `<tr><th scope="row">${h.version}</th><td>${esc(tidpunkt(h.tid))}</td><td>${esc(h.av ?? 'Systemet')}</td><td>${esc(h.andring)}</td><td class="tal">${h.antal}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

// Läser formuläret till en lista med övningar som servern prövar.
function lasOvningar(form) {
  let ny = 0;
  return [...form.querySelectorAll('.ov-red')].filter(d => !d.querySelector('[name="bort"]').checked).map(d => {
    const i = d.dataset.i;
    const alt = [...d.querySelectorAll('[name="alt"]')].map((f, j) => ({ j, text: f.value.trim() })).filter(a => a.text);
    const rattIndex = Number(d.querySelector(`[name="ovr-${i}-ratt"]:checked`)?.value ?? -1);
    const fraga = d.querySelector('[name="fraga"]').value;
    return {
      id: d.dataset.id || `ny-${Date.now().toString(36)}-${++ny}`,
      roller: [...d.querySelectorAll('[name="roller"]:checked')].map(c => c.value),
      fraga, alternativ: alt.map(a => ({ id: `x${a.j}`, text: a.text })), ratt: `x${rattIndex}`,
      forklaring: d.querySelector('[name="forklaring"]').value, prova: d.querySelector('[name="prova"]').value || null,
    };
  });
}

function kopplaRedigering(el, r) {
  const yta = el.querySelector('#ov-red-yta');
  yta.innerHTML = redigeraHtml(r);
  const form = yta.querySelector('#ov-redigera');
  form.querySelector('[data-ny-ovning]').addEventListener('click', () => {
    const lista = form.querySelector('#ov-red-lista');
    const i = lista.children.length;
    lista.insertAdjacentHTML('beforeend', redigeraOvning({ id: '', roller: [], fraga: '', alternativ: [], ratt: '', forklaring: '', prova: null, ny: true }, i, r));
    lista.lastElementChild.querySelector('[name="fraga"]').focus();
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const ruta = form.querySelector('#ov-red-fel');
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    // Övningarna som tas bort räknas inte, så felets nummer gäller listan som skickas.
    const kvar = [...form.querySelectorAll('.ov-red')].filter(d => !d.querySelector('[name="bort"]').checked);
    try {
      const svar = await medKnapp(form.querySelector('[data-a="spara-ovningar"]'), () => api('/api/utbildning/ovningar', { metod: 'POST', data: { omfang: r.omfang ?? 'vardgivare', ovningar: lasOvningar(form), andring: form.andring.value } }), form);
      notis(svar.text);
      kopplaRedigering(el, svar);
    } catch (e) {
      if (e?.status !== 400) return;
      const [plats, falt] = String(e.data?.falt?.[0] ?? '').split('.');
      const d = kvar[Number(plats)];
      ruta.textContent = e.message;
      ruta.hidden = false;
      if (d && falt) {
        d.open = true;
        const mal = { fraga: '[name="fraga"]', roller: '[name="roller"]', alternativ: '[name="alt"]', ratt: '[type="radio"]', forklaring: '[name="forklaring"]', prova: '[name="prova"]' }[falt];
        const f = mal && d.querySelector(mal);
        if (f) { f.setAttribute('aria-invalid', 'true'); f.setAttribute('aria-errormessage', ruta.id); f.focus(); }
      } else if (plats === 'andring') form.andring.focus();
    }
  });
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Utbildning', 'Korta övningar om hur Vårdkällan fungerar för din roll, med demopatienter. Alla rätt ger ett intyg som gäller i ett år.') + '<div id="utbildning"><p class="tom">Hämtar övningarna.</p></div>';
  const o = await api('/api/utbildning');
  const e = o.enhet ? await api('/api/utbildning/enhet') : null;
  const el = main.querySelector('#utbildning');
  const egna = o.kanAndraEnhet ? `<button type="button" class="knapp sekundar" data-oppna-enhet>Ändra egna övningar för ${esc(o.kanAndraEnhet.namn)}</button>` : '';
  el.innerHTML = `${minaHtml(o)}${e ? `<div id="ut-enhet">${enhetHtml(e)}</div>` : ''}${ovningarHtml(o)}${o.kanAndra || o.kanAndraEnhet ? `<section aria-labelledby="ut-red-rubrik" data-ov-redigera>
      <h2 id="ut-red-rubrik">Ändra övningarna</h2>
      <div id="ov-red-yta"><p>Du är ${o.enhet ? 'verksamhetschef' : 'utbildare'} och kan ändra vårdgivarens övningar för alla yrkesroller${o.kanAndraEnhet ? ` och de egna övningarna för ${esc(o.kanAndraEnhet.namn)}` : ''}.</p><div class="knapprad">${o.kanAndra ? '<button type="button" class="knapp sekundar" data-oppna-redigering>Ändra övningarna</button>' : ''}${egna}</div></div>
    </section>` : ''}${hjalpLista()}`;

  const oppna = (omfang) => async (ev) => {
    const r = await medKnapp(ev.currentTarget, () => api(`/api/utbildning/ovningar${omfang === 'enhet' ? '?omfang=enhet' : ''}`));
    kopplaRedigering(el, r);
    (el.querySelector('#ov-red-yta details summary') ?? el.querySelector('#ov-red-yta [data-ny-ovning]'))?.focus();
  };
  el.querySelector('[data-oppna-redigering]')?.addEventListener('click', oppna('vardgivare'));
  el.querySelector('[data-oppna-enhet]')?.addEventListener('click', oppna('enhet'));
  el.querySelector('#ut-enhet')?.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-utbildare]');
    if (!b) return;
    const r = await medKnapp(b, () => api('/api/utbildning/utbildare', { metod: 'POST', data: { personalId: b.dataset.utbildare } })).catch(() => null);
    if (!r) return;
    el.querySelector('#ut-enhet').innerHTML = enhetHtml(r);
    notis(r.text);
    el.querySelector('#ut-enhet-rubrik')?.setAttribute('tabindex', '-1');
    el.querySelector('#ut-enhet-rubrik')?.focus();
  });

  const form = el.querySelector('#ovningar');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const svar = Object.fromEntries(o.ovningar.map(x => [x.id, form.querySelector(`input[name="${CSS.escape(x.id)}"]:checked`)?.value]).filter(([, v]) => v));
    const knapp = form.querySelector('[data-a="ratta"]');
    let r;
    try {
      r = await medKnapp(knapp, () => api('/api/utbildning/ratta', { metod: 'POST', data: { svar } }), form);
    } catch (err) {
      // Obesvarade övningar markeras vid frågan.
      for (const id of err?.data?.falt ?? []) form.querySelector(`[data-ovning="${CSS.escape(id)}"]`)?.classList.add('obesvarad');
      return;
    }
    faltFel(form, null);
    form.querySelectorAll('.obesvarad').forEach(x => x.classList.remove('obesvarad'));
    for (const x of r.resultat) {
      const p = form.querySelector(`[data-svar="${CSS.escape(x.id)}"]`);
      p.hidden = false;
      p.className = `ovning-svar ${x.ratt ? 'ovning-ratt' : 'ovning-fel'}`;
      p.innerHTML = `${x.ratt ? ikon.bock : ikon.kryss}<span><strong>${x.ratt ? 'Rätt.' : `Fel. Rätt svar: ${esc(x.rattSvar)}`}</strong> ${esc(x.forklaring)}</span>`;
    }
    const res = form.querySelector('[data-resultat]');
    res.hidden = false;
    res.className = r.godkand ? 'ruta ruta-ok' : 'ruta ruta-info';
    res.textContent = r.text;
    el.querySelector('[data-intyg]').innerHTML = `${intygHtml(r.intyg)} <span class="dampad">${giltigHtml(r.intyg)}</span>`;
    if (r.godkand) notis('Intyget är utfärdat och gäller i ett år.');
  });
}
