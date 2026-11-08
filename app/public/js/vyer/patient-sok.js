// Sökträffar i journalen (Sussa 3.1.8.1 och 3.1.8.2). Systemet har tolkat frågan och sökt i det rollen får läsa.
// Träffarna står i tidsordning med träffen markerad, och ett klick öppnar uppgiften där den finns i journalen.
import { esc, api, datum, tidpunkt, migreradEtikett } from '../ui.js';

const TYP = { anteckning: 'Anteckning', diagnos: 'Diagnos', ordination: 'Läkemedel', matvarde: 'Mätvärde' };

const delar = (d) => d.map(x => (x.markerad ? `<mark>${esc(x.text)}</mark>` : esc(x.text))).join('');
const tid = (t) => (String(t.tid ?? '').length > 10 ? tidpunkt(t.tid) : datum(t.tid));

export async function visa(el, ctx) {
  const q = (ctx.q.get('q') ?? '').trim();
  if (q.length < 2) { el.innerHTML = '<h2>Sök i journalen</h2><p class="tom">Skriv minst två tecken i sökfältet ovanför flikarna.</p>'; return; }
  // Runda 10, r2: filter på typ, tid och vårdenhet. Filtren och antalen kommer från servern och gäller bara det du ser.
  const valt = Object.fromEntries(['typ', 'fran', 'till', 'vardenhet'].map(k => [k, ctx.q.get(k) ?? '']).filter(([, v]) => v));
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/sok?${new URLSearchParams({ q, ...valt })}`);
  if (!ctx.aktuell()) return;
  const andra = ctx.patient?.harAndraEnheter && !ctx.patient?.andraEnheterVisade
    ? '<p class="dampad liten">Sökningen gäller det du ser. Uppgifter från andra vårdenheter söks när du har gjort ett aktivt val.</p>' : '';
  el.innerHTML = `<div class="flikhuvud"><h2 id="jsok-rubrik">Sökträffar för "${esc(d.fraga)}"</h2></div>
    <p class="ingress liten" data-tolkning>${esc(d.tolkning)}</p>${andra}${filterHtml(d, valt)}
    <p class="antal-text" role="status">${d.antal === 0 ? 'Inga träffar.' : d.antal === 1 ? 'En träff, nyast först.' : `${d.antal} träffar, nyast först${d.visade < d.antal ? `. De ${d.visade} senaste visas` : ''}.`}</p>
    ${d.traffar.length ? `<ol class="jsok-lista" aria-labelledby="jsok-rubrik">${d.traffar.map(t => `<li class="jsok-traff jsok-${esc(t.typ)}">
      <a href="${esc(ctx.href(t.ref.flik, t.ref.sub))}" data-traff="${esc(t.typ)}">
        <span class="jsok-rad1"><span class="tagg">${esc(TYP[t.typ] ?? t.typ)}</span><span class="jsok-rubrik">${esc(t.rubrik)}</span>${t.kod ? ` <span class="kod">${t.kod.markerad ? `<mark>${esc(t.kod.system)} ${esc(t.kod.kod)}</mark>` : `${esc(t.kod.system)} ${esc(t.kod.kod)}`}</span>` : ''}<time>${esc(tid(t))}</time></span>
        <span class="jsok-text">${delar(t.delar)}</span>
        <span class="under-text">${esc(t.vardenhet?.namn ?? '')}${t.utkast ? ', utkast' : ''}</span>
      </a>${migreradEtikett(t)}</li>`).join('')}</ol>` : '<p class="tom">Inget i journalen som du får se matchar sökningen.</p>'}`;
  const form = el.querySelector('[data-sokfilter]');
  form?.addEventListener('change', () => {
    const p = new URLSearchParams({ q });
    for (const k of ['typ', 'vardenhet', 'fran', 'till']) { const v = form[k]?.value; if (v) p.set(k, v); }
    location.hash = `${ctx.href('sok')}?${p}`;
  });
}

function filterHtml(d, valt) {
  const f = d.filter;
  if (!f || (!f.typer.length && !Object.keys(valt).length)) return '';
  const typ = valt.typ ?? '';
  return `<form class="loggfilter" data-sokfilter aria-label="Filtrera sökträffarna">
    <fieldset class="segment"><legend>Visa</legend>
      <input type="radio" id="sf-typ-alla" name="typ" value=""${typ ? '' : ' checked'}><label for="sf-typ-alla">Allt</label>
      ${f.typer.map(t => `<input type="radio" id="sf-typ-${esc(t.typ)}" name="typ" value="${esc(t.typ)}"${t.typ === typ ? ' checked' : ''}><label for="sf-typ-${esc(t.typ)}">${esc(t.text)} (${esc(t.antal)})</label>`).join('')}
    </fieldset>
    ${f.vardenheter.length > 1 || valt.vardenhet ? `<div class="falt kompakt"><label for="sf-ve">Vårdenhet</label><select id="sf-ve" name="vardenhet"><option value="">Alla</option>${f.vardenheter.map(v => `<option value="${esc(v.id)}"${v.id === valt.vardenhet ? ' selected' : ''}>${esc(v.namn)} (${esc(v.antal)})</option>`).join('')}</select></div>` : ''}
    <div class="falt kompakt"><label for="sf-fran">Från</label><input id="sf-fran" name="fran" type="date" value="${esc(valt.fran ?? '')}"></div>
    <div class="falt kompakt"><label for="sf-till">Till</label><input id="sf-till" name="till" type="date" value="${esc(valt.till ?? '')}"></div>
  </form>`;
}
