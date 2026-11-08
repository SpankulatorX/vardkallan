// Utbildning: övningar och intyg i utbildningsmiljön (Sussa 10.1.1.5). Varje yrkesroll gör sina övningar med
// demopatienter, servern rättar och förklarar, och alla rätt ger ett intyg som gäller i ett år. Verksamhetschefen ser
// intygen för vårdenheten.
import { esc, api, vyRubrik, medKnapp, notis, ikon, datum, faltFel } from '../ui.js';
import { HJALP } from '../hjalp.js';

export const namn = 'utbildning';

const STATUSIKON = { giltigt: ikon.bock, gar_ut: ikon.varning, utgatt: ikon.kryss, saknas: ikon.info };
const intygHtml = (i) => `<span class="intyg intyg-${esc(i.status)}">${STATUSIKON[i.status] ?? ''}<span>${esc(i.text)}</span></span>`;
const giltigHtml = (i) => (i.giltigtTill ? `Giltigt till ${esc(datum(i.giltigtTill))}` : 'Gör övningarna för att få ett intyg.');

function minaHtml(o) {
  return `<section class="ruta" aria-labelledby="ut-intyg-rubrik">
    <h2 id="ut-intyg-rubrik">Ditt intyg</h2>
    <p data-intyg>${intygHtml(o.intyg)} <span class="dampad">${giltigHtml(o.intyg)}</span></p>
    <p class="dampad liten">${esc(o.kurs)} för ${esc(o.rollText.toLowerCase())}. ${o.ovningar.length} övningar. Alla svar ska vara rätt, och intyget gäller i ett år. ${esc(o.utbildningsmiljo)}</p>
  </section>`;
}

function ovningarHtml(o) {
  return `<section aria-labelledby="ut-ov-rubrik">
    <h2 id="ut-ov-rubrik">Övningar</h2>
    <form id="ovningar" class="ovningar" novalidate>
      ${o.ovningar.map((x, i) => `<fieldset class="ovning" data-ovning="${esc(x.id)}">
        <legend><span class="ovning-nr">Övning ${i + 1}.</span> ${esc(x.fraga)}</legend>
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
    <p class="dampad">${s.giltigt} med giltigt intyg, ${s.gar_ut} som går ut inom ${e.garUtDagar} dagar, ${s.utgatt} som har gått ut och ${s.saknas} utan intyg. De som behöver göra övningarna står först.</p>
    <div class="tabellrulle"><table class="tabell">
      <thead><tr><th scope="col">Namn</th><th scope="col">Titel</th><th scope="col">Intyg</th><th scope="col">Giltigt till</th></tr></thead>
      <tbody>${e.personer.map(p => `<tr><th scope="row">${esc(p.namn)}</th><td>${esc(p.titel)}</td><td>${intygHtml(p)}</td><td>${p.giltigtTill ? esc(datum(p.giltigtTill)) : '<span class="dampad">Inget datum</span>'}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

const hjalpLista = () => `<section aria-labelledby="ut-hjalp-rubrik">
    <h2 id="ut-hjalp-rubrik">Hjälp i flödena</h2>
    <p>Knappen Hjälp finns i de vanligaste flödena och förklarar vad du gör och vad systemet gör åt dig: ${Object.values(HJALP).map(h => esc(h.rubrik.toLowerCase())).join(', ')}.</p>
    <p><a href="#/nyheter">Nyheter i den här versionen</a></p>
  </section>`;

export async function visa(main) {
  main.innerHTML = vyRubrik('Utbildning', 'Korta övningar om hur Vårdkällan fungerar för din roll, med demopatienter. Alla rätt ger ett intyg som gäller i ett år.') + '<div id="utbildning"><p class="tom">Hämtar övningarna.</p></div>';
  const o = await api('/api/utbildning');
  const e = o.enhet ? await api('/api/utbildning/enhet') : null;
  const el = main.querySelector('#utbildning');
  el.innerHTML = `${minaHtml(o)}${e ? enhetHtml(e) : ''}${ovningarHtml(o)}${hjalpLista()}`;
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
