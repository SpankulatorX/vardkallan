// Min journal: barnets tillväxt för vårdnadshavaren (runda 7, r6). Kurvorna, vaccinationerna, barnhälsovårdens besök
// och en mätning hemma som barnavårdscentralen bekräftar. Larmen visas inte här; barnavårdscentralen tar upp dem.
import { esc, api, datum, notis, medKnapp, tal, ikon } from '../ui.js';
import { kurvaSvg, teckenforklaring, tabell, zText, alderText } from '../tillvaxt-kurva.js';

const STATUS = { genomfort: 'Gjort', bokat: 'Bokat', nu: 'Ska göras nu', missat: 'Inte gjort', kommande: 'Kommande' };

export async function visa(el, ctx) {
  const d = await api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/tillvaxt`);
  if (!ctx.aktuell()) return;
  el.innerHTML = `<div class="flikhuvud"><h2>Tillväxt</h2></div>
    <p class="ingress">${esc(d.barn.alderText)}. Kurvorna visar ${esc(d.referens.namn)}, som jämför med friska barn i flera länder. Ett värde mellan linjerna för plus och minus 2 SD är vanligt. Prata med barnavårdscentralen om du undrar över kurvan.</p>
    ${d.kanRegistrera ? `<form class="mv-form" id="min-tv-form" novalidate aria-labelledby="min-tv-reg">
      <h3 id="min-tv-reg">Skicka en mätning du har gjort hemma</h3>
      <p class="hjalp">Barnavårdscentralen bekräftar mätningen innan den räknas på kurvan. Skriv det du har mätt.</p>
      <div class="falt-rad">
        <div class="falt smal"><label for="min-tv-vikt">Vikt</label><div class="med-enhet"><input id="min-tv-vikt" name="vikt" inputmode="decimal" autocomplete="off"><span class="enhet">kg</span></div></div>
        <div class="falt smal"><label for="min-tv-langd">Längd</label><div class="med-enhet"><input id="min-tv-langd" name="langd" inputmode="decimal" autocomplete="off"><span class="enhet">cm</span></div></div>
        <div class="falt smal"><label for="min-tv-datum">Datum</label><input id="min-tv-datum" name="datum" type="date"><span class="hjalp">Tomt betyder i dag.</span></div>
        <div class="falt knappfalt"><button type="submit" class="knapp">Skicka</button></div>
      </div>
      <p class="form-fel" role="alert" hidden></p>
    </form>` : ''}
    ${d.hemmatningar.length ? `<div class="ruta ruta-info">${ikon.klocka}<p>${esc(d.hemmatningar.map(h => `${h.namn} ${tal(h.varde, 2)} ${h.enhet} (${datum(h.tid)})`).join(', '))} väntar på att barnavårdscentralen bekräftar ${d.hemmatningar.length === 1 ? 'den' : 'dem'}.</p></div>` : ''}
    ${d.hanterade.filter(h => h.status === 'avvisad').map(h => `<div class="ruta ruta-info">${ikon.info}<p>${esc(h.namn)} ${esc(tal(h.varde, 2))} ${esc(h.enhet)} från ${esc(datum(h.tid))} används inte: ${esc(h.orsak ?? '')}</p></div>`).join('')}
    ${teckenforklaring()}
    <div class="kurvor tv-kurvor">${d.kurvor.filter(k => k.punkter.length).map(k => `<article class="kurvkort" aria-labelledby="min-tv-${esc(k.matt)}">
      <header><h4 id="min-tv-${esc(k.matt)}">${esc(k.namn)}</h4>${k.senaste ? `<p class="kurva-senaste">${esc(tal(k.senaste.varde, k.matt === 'vikt' ? 2 : 1))} <span class="enhet">${esc(k.enhet)}</span></p>` : ''}</header>
      ${k.senaste ? `<p class="under-text">${esc(zText(k.senaste.z))}, ${esc(alderText(k.senaste.alder))}</p>` : ''}
      ${d.barn.inomReferens ? kurvaSvg(k) : ''}
      ${tabell(k)}
    </article>`).join('')}</div>
    ${d.foraldrar.malangd ? `<p>${esc(d.foraldrar.malangd.text)}</p>` : ''}
    <section aria-labelledby="min-tv-vacc"><h3 id="min-tv-vacc">Vaccinationer</h3>
      ${d.vaccinationer.length ? `<ul class="enkel-lista">${d.vaccinationer.map(v => `<li><strong>${esc(v.text)}</strong><span class="under-text">${esc(datum(v.tid))}, ${esc(v.vardenhet.namn)}. Skyddar mot ${esc((v.sjukdomar ?? '').toLowerCase())}.</span></li>`).join('')}</ul>` : '<p class="tom liten">Inga vaccinationer är registrerade.</p>'}
    </section>
    ${d.bhv ? `<section aria-labelledby="min-tv-bhv"><h3 id="min-tv-bhv">Besök på ${esc(d.bhv.enhet)}</h3><div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Besök</th><th scope="col">Omkring</th><th scope="col">Vaccinationer</th><th scope="col">Status</th></tr></thead>
      <tbody>${d.bhv.program.map(b => `<tr><td>${esc(b.text)}</td><td>${esc(b.datum)}</td><td>${esc(b.vacciner.join(', '))}</td><td>${esc(STATUS[b.status])}</td></tr>`).join('')}</tbody></table></div>
      <p class="under-text">Bokade tider finns under Tider.</p></section>` : ''}
    <p class="under-text">${esc(d.referens.kalla)}. Licens: ${esc(d.referens.licens)}</p>`;
  const form = el.querySelector('#min-tv-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries([...new FormData(form)].filter(([, v]) => String(v).trim() !== ''));
    try {
      const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/tillvaxt`, { metod: 'POST', data }), form);
      notis(r.text);
      ctx.ladda();
    } catch { /* felet visas i formuläret */ }
  });
}
