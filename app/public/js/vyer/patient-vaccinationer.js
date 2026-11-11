// Vaccinationer i de nationella vaccinationsprogrammen (runda 10, r5, Sussa 3.5.1.7). Systemet visar vilka doser som
// gäller för patienten och varför, prövar varje dos mot programmet och rapporterar den till det simulerade
// vaccinationsregistret. Barnhälsovårdens doser till fem år ges på barnavårdscentralen (fliken Tillväxt).
import { esc, api, notis, felNotis, dialog, datum, idag, medKnapp } from '../ui.js';
// Runda 13, r4: kontrollen före vaccinationen och dosens uppgifter, samma som i fliken Tillväxt.
import { dosFaltHtml, provaDosFalt, dosData } from '../vaccination-ui.js';

// Runda 13, r4 (E2-38): barnhälsovårdens doser till sex års ålder, som ges på barnavårdscentralen.
const BHV_STATUS = { given: 'Given', nu: 'Kan ges nu', kommande: 'Senare', missad: 'Besöket har passerat' };
const bhvHtml = (d, pid) => (d.barnhalsovard?.length ? `<section aria-labelledby="vp-bhv"><h3 id="vp-bhv">Barnhälsovårdens doser</h3>
  <p class="liten">Doserna till sex års ålder ges på barnavårdscentralen och registreras i fliken <a href="#/patient/${pid}/tillvaxt">Tillväxt</a>.</p>
  <div class="tabellrulle"><table class="tabell"><caption class="sr">Barnhälsovårdens doser</caption>
    <thead><tr><th scope="col">Vaccin</th><th scope="col">Besök</th><th scope="col">Status</th></tr></thead>
    <tbody>${d.barnhalsovard.map(r => `<tr><th scope="row">${esc(r.text)}<span class="under-text">${esc(r.sjukdomar ?? '')}</span></th><td>${esc(r.besok)}<span class="under-text">Omkring ${esc(r.datum)}</span></td>
      <td><span class="tagg${r.status === 'nu' ? ' tagg-obs' : ''}">${esc(BHV_STATUS[r.status] ?? r.status)}</span>${r.given ? `<span class="under-text">${esc(datum(r.given))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div></section>` : '');

const STATUS = { nu: 'Kan ges nu', kommande: 'Senare', given: 'Given', ej_faststalld: 'Åldern är inte fastställd', ej_aktuell: 'Inte aktuell' };

export async function visa(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const d = await api(`/api/patient/${pid}/vaccinationsprogram`);
  if (!ctx.aktuell()) return;
  const p = d.program;
  el.innerHTML = `<div class="flikhuvud"><h2>Vaccinationer</h2></div>
    <p class="ingress">Systemet följer de nationella vaccinationsprogrammen: barnens doser efter fem års ålder, som oftast ges av elevhälsan, och programmet för riskgrupper. Varje dos som ges här rapporteras till vaccinationsregistret, som är simulerat i demon.</p>
    ${d.riskgrupper.length ? `<p class="forslag-varfor">Riskgrupp enligt journalen: ${esc(d.riskgrupper.map(r => r.text).join(', '))}.</p>` : ''}
    ${d.doldaVaccinationer?.kraverVal ? `<p class="ruta ruta-info liten">${esc(d.doldaVaccinationer.text)}</p>` : ''}
    ${bhvHtml(d, pid)}
    <section aria-labelledby="vp-prog"><h3 id="vp-prog">Programmet för patienten</h3>
      ${p.rader.length ? `<div class="tabellrulle"><table class="tabell"><caption class="sr">Doser i programmen</caption>
        <thead><tr><th scope="col">Vaccin</th><th scope="col">Program</th><th scope="col">När</th><th scope="col">Status</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead>
        <tbody>${p.rader.map(r => `<tr><th scope="row">${esc(r.text)}<span class="under-text">${esc(r.sjukdomar)}</span></th><td>${esc(r.programText)}</td><td>${esc(r.nar ?? '')}${r.ges ? `<span class="under-text">${esc(r.ges)}</span>` : ''}</td>
          <td><span class="tagg">${esc(STATUS[r.status] ?? r.status)}</span>${r.varfor ? `<span class="under-text">${esc(r.varfor)}</span>` : ''}${r.skal ? `<span class="under-text">${esc(r.skal)}</span>` : ''}${r.given ? `<span class="under-text">Senast ${esc(datum(r.given))}</span>` : ''}</td>
          <td>${r.status === 'nu' && d.kan.vaccinera ? `<button type="button" class="knapp liten" data-vp-ge="${esc(r.id)}" data-namn="${esc(r.text)}">Ge dosen</button>` : ''}${d.kan.vaccinera ? ` <button type="button" class="knapp liten sekundar" data-vp-tidigare="${esc(r.id)}" data-namn="${esc(r.text)}">Given någon annanstans</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="tom">Inga doser i programmen gäller för patienten nu.</p>'}
      <p class="demoregel">${esc(p.demoregel)} Källa: ${esc(p.kallor.program)}.</p>
    </section>
    <section aria-labelledby="vp-givna"><h3 id="vp-givna">Registrerade vaccinationer</h3>
      ${d.vaccinationer.length ? `<ul class="enkel-lista">${d.vaccinationer.map(v => `<li><strong>${esc(v.text)}</strong> ${esc(datum(v.tid))} <span class="dampad">${esc(v.program ?? '')}</span>
        <span class="under-text">${v.kalla ? `Given av ${esc(v.kalla.text ?? v.kalla.typText)}, registrerad på ${esc(v.vardenhet?.namn ?? '')}` : `${esc(v.vardenhet?.namn ?? '')}${v.givetAv ? `, ${esc(v.givetAv)}` : ''}${v.batch ? `, batch ${esc(v.batch)}` : ''}`}</span>
        ${v.rapport ? `<span class="under-text">${esc(v.rapport.statusText)}, kvittens ${esc(v.rapport.kvittens)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="tom">Inga vaccinationer registrerade.</p>'}
    </section>`;
  el.addEventListener('click', async (e) => {
    const ge = e.target.closest('[data-vp-ge]');
    const tid = e.target.closest('[data-vp-tidigare]');
    if (ge) {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Ge ${esc(ge.dataset.namn)}</h2>
        <p>${esc(d.fraga.replace('barnet', 'patienten').replace('Har barnet', 'Har patienten').replace('vårdnadshavaren', 'patienten'))}</p>
        <fieldset class="falt"><legend>Har patienten fått vaccinationer någon annanstans?</legend>
          <label class="kryss"><input type="radio" name="andra" value="nej" checked> Nej</label><label class="kryss"><input type="radio" name="andra" value="ja"> Ja</label></fieldset>
        ${dosFaltHtml('vp')}
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera dosen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, { validera: provaDosFalt });
      if (!svar) return;
      try {
        const r = await medKnapp(ge, () => api(`/api/patient/${pid}/vaccinationsprogram/vaccination`, { metod: 'POST', data: { vaccinId: ge.dataset.vpGe, andraVaccinationer: svar.data.andra, ...dosData(svar.data) } }));
        notis(r.text);
        ctx.ladda();
      } catch (x) { felNotis(x); }
    }
    if (tid) {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">${esc(tid.dataset.namn)} given någon annanstans</h2>
        <div class="falt"><label for="vp-datum">Datum då dosen gavs</label><input id="vp-datum" name="datum" type="date" max="${esc(idag())}" required></div>
        <fieldset class="falt"><legend>Var gavs dosen?</legend><label class="kryss"><input type="radio" name="kalla" value="elevhalsan" checked> Elevhälsan</label><label class="kryss"><input type="radio" name="kalla" value="annan"> Annan vårdgivare eller utomlands</label></fieldset>
        <div class="falt"><label for="vp-text">Var, om det är känt</label><input id="vp-text" name="text" maxlength="200"></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      try {
        const r = await medKnapp(tid, () => api(`/api/patient/${pid}/vaccinationsprogram/tidigare`, { metod: 'POST', data: { vaccinId: tid.dataset.vpTidigare, datum: svar.data.datum, kalla: svar.data.kalla, text: svar.data.text } }));
        notis(r.text);
        ctx.ladda();
      } catch (x) { felNotis(x); }
    }
  });
}
