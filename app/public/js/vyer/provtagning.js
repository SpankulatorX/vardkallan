// Prover och kontroller på vårdenheten (runda 8, r1, Sussas testfall 3.3 och 3.5): rören att ta i dag per patient i
// provtagningsordning, med ett klick per rör, och kontrollerna som läkaren har ordinerat, som uppgifter med tid.
// Uppföljningen av beställningarna visas för den som ser vårdenhetens statistik.
import { esc, api, vyRubrik, tidpunkt, klockslag, ikon } from '../ui.js';
import { far } from '../app.js';
import { bestallningKort, kopplaBestallningar } from '../labb-ui.js';

export const namn = 'provtagning';

const STATUS_KLASS = { utford: 'tagg-ok', forsenad: 'tagg-larm', pagar: 'tagg-pagaende', planerad: '' };
const pnamn = (p) => (p?.skyddad ? 'Skyddad identitet' : p?.namn ?? '');

export async function visa(main, _p, _q, ctx = {}) {
  main.innerHTML = `${vyRubrik('Prover och kontroller', 'Rören att ta i dag i provtagningsordning och kontrollerna som läkaren har ordinerat. Ett klick på Tagen registrerar provtagningen med tid och ditt namn, och proverna skickas när alla rör är tagna.')}
    <div id="pt"><p class="tom">Hämtar provtagningen.</p></div>`;
  const [d, plan, uppf] = await Promise.all([api('/api/provtagning'), api('/api/planerat').catch(() => null), far('statistik') ? api('/api/labb/uppfoljning').catch(() => null) : null]);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#pt');
  if (!el) return;
  const kontroller = (plan?.uppgifter ?? []).filter(u => u.typ === 'kontroll');
  const alla = d.patienter.flatMap(p => p.bestallningar);
  el.innerHTML = `<section class="ov-sektion" aria-labelledby="pt-prov"><div class="sektion-huvud"><h2 id="pt-prov">Provtagning ${esc(d.datum)}, ${esc(d.vardenhet.namn)}</h2></div>
      ${d.patienter.length ? d.patienter.map(p => `<section class="pt-patient" aria-labelledby="pt-p-${esc(p.patient.id)}">
        <h3 id="pt-p-${esc(p.patient.id)}"><a class="patientlank" href="#/patient/${encodeURIComponent(p.patient.id)}/prover">${esc(pnamn(p.patient))}</a> <span class="pnr">${esc(p.patient.personnummer)}</span>${p.plats ? ` <span class="under-text">${esc(p.plats)}</span>` : ''}
          ${p.kvar ? ` <span class="tagg tagg-pagaende">${p.kvar} ${p.kvar === 1 ? 'rör' : 'rör'} kvar</span>` : ' <span class="tagg tagg-ok">Klart</span>'}</h3>
        ${p.bestallningar.map(b => bestallningKort(b, { rubrikNiva: 4, patient: p.patient })).join('')}
      </section>`).join('') : '<p class="tom">Inga prover att ta i dag.</p>'}
      <p class="dampad liten">${esc(d.simulerat)}</p>
    </section>
    <section class="ov-sektion" aria-labelledby="pt-kontr"><div class="sektion-huvud"><h2 id="pt-kontr">Kontroller i dag</h2></div>
      ${kontroller.length ? `<ul class="pt-uppgifter">${kontroller.map(u => `<li><span class="pt-tid">${esc(klockslag(u.tid))}</span><span class="pt-text"><a href="${esc(u.href)}">${esc(u.rubrik)}, ${esc(pnamn(u.patient))}</a>
        <span class="under-text">${esc(u.plats ?? u.enhet.namn)}. ${esc(u.text)}${u.utford?.tid ? ` Registrerat ${esc(tidpunkt(u.utford.tid))}${u.utford.av ? ` av ${esc(u.utford.av)}` : ''}.` : ''}</span></span>
        <span class="tagg ${STATUS_KLASS[u.status] ?? ''}">${esc(u.statusText)}</span></li>`).join('')}</ul>` : '<p class="tom liten">Inga kontroller är ordinerade i dag.</p>'}
      <p class="dampad liten">En kontroll bockas av när mätvärdet registreras i tid. ${esc(plan?.demoregel ?? '')}</p>
    </section>
    ${uppf ? `<section class="ov-sektion" aria-labelledby="pt-uppf"><div class="sektion-huvud"><h2 id="pt-uppf">Uppföljning, senaste ${uppf.dagar} dagarna</h2></div>
      <dl class="pt-uppf">
        <div><dt>Beställningar</dt><dd>${uppf.antal}, varav ${uppf.paUppdrag} på uppdrag och ${uppf.makulerade} makulerade</dd></div>
        <div><dt>Analyser</dt><dd>${uppf.analyser}, varav ${uppf.avvikande} avvikande och ${uppf.kritiska} kritiska</dd></div>
        <div><dt>Till provtagning</dt><dd>${uppf.ledtider.tillProvtagningMin != null ? `${Math.round(uppf.ledtider.tillProvtagningMin)} minuter` : 'inga'}</dd></div>
        <div><dt>Från provtagning till svar</dt><dd>${uppf.ledtider.tillSvarMin != null ? `${Math.round(uppf.ledtider.tillSvarMin)} minuter` : 'inga'}</dd></div>
        <div><dt>Från svar till vidimering</dt><dd>${uppf.ledtider.tillVidimeringMin != null ? `${Math.round(uppf.ledtider.tillVidimeringMin)} minuter` : 'inga'}</dd></div>
      </dl><p class="dampad liten">${ikon.info}${esc(uppf.text)}</p></section>` : ''}`;
  kopplaBestallningar(el, (id) => alla.find(b => String(b.id) === String(id)), () => visa(main, _p, _q, ctx));
}
