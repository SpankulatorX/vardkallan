// Sökträffar i journalen (Sussa 3.1.8.1 och 3.1.8.2). Systemet har tolkat frågan och sökt i det rollen får läsa.
// Träffarna står i tidsordning med träffen markerad, och ett klick öppnar uppgiften där den finns i journalen.
import { esc, api, datum, tidpunkt, migreradEtikett } from '../ui.js';

const TYP = { anteckning: 'Anteckning', diagnos: 'Diagnos', ordination: 'Läkemedel', matvarde: 'Mätvärde' };

const delar = (d) => d.map(x => (x.markerad ? `<mark>${esc(x.text)}</mark>` : esc(x.text))).join('');
const tid = (t) => (String(t.tid ?? '').length > 10 ? tidpunkt(t.tid) : datum(t.tid));

export async function visa(el, ctx) {
  const q = (ctx.q.get('q') ?? '').trim();
  if (q.length < 2) { el.innerHTML = '<h2>Sök i journalen</h2><p class="tom">Skriv minst två tecken i sökfältet ovanför flikarna.</p>'; return; }
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/sok?q=${encodeURIComponent(q)}`);
  if (!ctx.aktuell()) return;
  const andra = ctx.patient?.harAndraEnheter && !ctx.patient?.andraEnheterVisade
    ? '<p class="dampad liten">Sökningen gäller det du ser. Uppgifter från andra vårdenheter söks när du har gjort ett aktivt val.</p>' : '';
  el.innerHTML = `<div class="flikhuvud"><h2 id="jsok-rubrik">Sökträffar för "${esc(d.fraga)}"</h2></div>
    <p class="ingress liten" data-tolkning>${esc(d.tolkning)}</p>${andra}
    <p class="antal-text" role="status">${d.antal === 0 ? 'Inga träffar.' : d.antal === 1 ? 'En träff, nyast först.' : `${d.antal} träffar, nyast först${d.visade < d.antal ? `. De ${d.visade} senaste visas` : ''}.`}</p>
    ${d.traffar.length ? `<ol class="jsok-lista" aria-labelledby="jsok-rubrik">${d.traffar.map(t => `<li class="jsok-traff jsok-${esc(t.typ)}">
      <a href="${esc(ctx.href(t.ref.flik, t.ref.sub))}" data-traff="${esc(t.typ)}">
        <span class="jsok-rad1"><span class="tagg">${esc(TYP[t.typ] ?? t.typ)}</span><span class="jsok-rubrik">${esc(t.rubrik)}</span>${t.kod ? ` <span class="kod">${t.kod.markerad ? `<mark>${esc(t.kod.system)} ${esc(t.kod.kod)}</mark>` : `${esc(t.kod.system)} ${esc(t.kod.kod)}`}</span>` : ''}<time>${esc(tid(t))}</time></span>
        <span class="jsok-text">${delar(t.delar)}</span>
        <span class="under-text">${esc(t.vardenhet?.namn ?? '')}${t.utkast ? ', utkast' : ''}</span>
      </a>${migreradEtikett(t)}</li>`).join('')}</ol>` : '<p class="tom">Inget i journalen som du får se matchar sökningen.</p>'}`;
}
