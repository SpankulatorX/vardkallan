// Runda 13, r1: testledarens vy (#/testledare). Med läskoden, som skapas av skriptet scripts/testinbjudan.js på servern,
// visas jämförelserna per uppdrag och journalsystem, fritexterna och synpunkterna, filtrerade på typ, allvar, roll, vy,
// journalsystem och yrkesroll i testet, och de kan exporteras som CSV och Markdown. Läskoden finns bara i minnet i den
// här fliken och skickas i anropets kropp, aldrig i adressen. All text från testare visas som text: inga länkar blir
// klickbara och inget HTML tolkas.
import { esc, api, vyRubrik, tidpunkt, felNotis } from '../ui.js';
import { TYPER, ALLVAR, SYSTEM, JAMFORELSE } from '../synpunkt-regler.js';

export const namn = 'testledare';
let laskod = null;
const text = (lista, k) => lista.find(([x]) => x === k)?.[1] ?? k;

export async function visa(main) {
  main.innerHTML = `${vyRubrik('Synpunkter och jämförelser', 'För projektets testledare. Läskoden skapas på servern och ger ingen annan rätt än att läsa.')}
    <form id="tl-kod" class="ruta tl-kod" novalidate>
      <div class="falt"><label for="tl-laskod">Läskod</label><input id="tl-laskod" name="laskod" type="password" autocomplete="off" maxlength="100" spellcheck="false"></div>
      <p class="form-fel" role="alert" hidden></p>
      <button type="submit" class="knapp">Visa</button>
    </form>
    <div id="tl"></div>`;
  const form = main.querySelector('#tl-kod');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kod = form.querySelector('[name="laskod"]').value.trim();
    const fel = form.querySelector('.form-fel');
    try {
      const d = await api('/api/testledare/synpunkter', { metod: 'POST', data: { laskod: kod } });
      laskod = kod;
      fel.hidden = true;
      form.hidden = true;
      ritaData(main.querySelector('#tl'), d);
    } catch (err) { fel.textContent = err?.message ?? 'Läskoden gäller inte.'; fel.hidden = false; }
  });
  if (laskod) { form.querySelector('[name="laskod"]').value = laskod; form.requestSubmit(); }
}

const opt = (lista, tom) => `<option value="">${esc(tom)}</option>${lista.map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join('')}`;

function ritaData(el, d) {
  el.innerHTML = `<p>${d.antal.synpunkter} synpunkter och ${d.antal.jamforelser} svar efter uppdrag finns sparade.</p>
    <form id="tl-filter" class="ruta falt-rad tl-filter" novalidate aria-label="Filter">
      <div class="falt"><label for="tl-f-system">Journalsystem</label><select id="tl-f-system" name="system">${opt(SYSTEM, 'Alla')}</select></div>
      <div class="falt"><label for="tl-f-testroll">Yrkesroll i testet</label><select id="tl-f-testroll" name="testroll">${opt(d.val.testroller.map(x => [x, x]), 'Alla')}</select></div>
      <div class="falt"><label for="tl-f-typ">Typ</label><select id="tl-f-typ" name="typ">${opt(TYPER, 'Alla')}</select></div>
      <div class="falt"><label for="tl-f-allvar">Allvar</label><select id="tl-f-allvar" name="allvar">${opt(ALLVAR.map(([k, t]) => [k, t.split(',')[0]]), 'Alla')}</select></div>
      <div class="falt"><label for="tl-f-roll">Demoroll</label><select id="tl-f-roll" name="roll">${opt(d.val.roller.map(x => [x, x || 'Inte inloggad']), 'Alla')}</select></div>
      <div class="falt"><label for="tl-f-vy">Vy</label><select id="tl-f-vy" name="vy">${opt(d.val.vyer.map(x => [x, x]), 'Alla')}</select></div>
    </form>
    <p class="knapprad tl-export"><button type="button" class="knapp sekundar liten" data-export="md">Exportera allt som Markdown</button><button type="button" class="knapp sekundar liten" data-export="csv">Synpunkterna som CSV</button><button type="button" class="knapp sekundar liten" data-export="csv-uppdrag">Jämförelserna som CSV</button></p>
    <div id="tl-innehall"></div>`;
  const filter = el.querySelector('#tl-filter');
  const nuvarande = () => Object.fromEntries([...new FormData(filter)].filter(([, v]) => v));
  const ladda = async () => {
    try { innehall(el.querySelector('#tl-innehall'), await api('/api/testledare/synpunkter', { metod: 'POST', data: { laskod, filter: nuvarande() } })); } catch (err) { felNotis(err); }
  };
  filter.addEventListener('change', ladda);
  el.querySelector('.tl-export').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-export]');
    if (!b) return;
    b.disabled = true;
    try {
      const r = await fetch('/api/testledare/export', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ laskod, format: b.dataset.export, filter: nuvarande() }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).fel ?? 'Exporten misslyckades.');
      const namnet = (r.headers.get('content-disposition') ?? '').match(/filename="([^"]+)"/)?.[1] ?? 'synpunkter.txt';
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = namnet; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { felNotis(err); } finally { b.disabled = false; }
  });
  innehall(el.querySelector('#tl-innehall'), d);
}

const pct = (n) => (n == null ? '' : ` (${n} %)`);
function innehall(el, d) {
  const alla = d.perUppdrag.filter(g => g.system === 'alla');
  el.innerHTML = `<section aria-labelledby="tl-jf">
      <h2 id="tl-jf">Jämförelse per uppdrag och journalsystem</h2>
      <p class="liten dampad">Andelarna räknas på dem som kunde jämföra. Raden Alla gäller alla journalsystem tillsammans.</p>
      ${d.perUppdrag.length ? `<div class="tabellrulle"><table class="tabell tl-tabell"><thead><tr><th scope="col">Uppdrag</th><th scope="col">Journalsystem</th><th scope="col">Svar</th><th scope="col">Klara</th><th scope="col">Hoppade</th><th scope="col">Lättare</th><th scope="col">Lika</th><th scope="col">Svårare</th><th scope="col">Kan inte jämföra</th></tr></thead><tbody>
        ${d.perUppdrag.map(g => `<tr${g.system === 'alla' ? ' class="tl-alla"' : ''}><th scope="row">${esc(g.testroll)}: ${esc(g.titel ?? g.uppdrag)}${g.sussa ? ` (Sussa ${esc(g.sussa)})` : ''}</th><td>${esc(g.system === 'alla' ? 'Alla' : text(SYSTEM, g.system))}</td><td>${g.antal}</td><td>${g.klara}</td><td>${g.hoppade}</td><td>${g.lattare}${pct(g.andelLattare)}</td><td>${g.lika}${pct(g.andelLika)}</td><td>${g.svarare}${pct(g.andelSvarare)}</td><td>${g.kan_inte}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="tom">Inga svar efter uppdrag än.</p>'}
    </section>
    ${alla.some(g => g.texter.length) ? `<section aria-labelledby="tl-fritext"><h2 id="tl-fritext">Fritexter efter uppdragen</h2>
      ${alla.filter(g => g.texter.length).map(g => `<h3>${esc(g.testroll)}: ${esc(g.titel ?? g.uppdrag)}</h3><ul class="tl-texter">${g.texter.map(t => `<li><strong>${esc(text(JAMFORELSE, t.jamforelse))}</strong>${t.system ? ` (${esc(text(SYSTEM, t.system))})` : ''}: <span class="tl-fritext">${esc(t.text)}</span>${t.mittSystem ? ` <span class="dampad">Hos testaren: ${esc(t.mittSystem)}</span>` : ''}</li>`).join('')}</ul>`).join('')}</section>` : ''}
    <section aria-labelledby="tl-per-vy">
      <h2 id="tl-per-vy">Synpunkter per vy</h2>
      ${d.perVy.length ? `<ul class="tl-antal">${d.perVy.map(v => `<li><span>${esc(v.nyckel)}</span> <strong>${v.antal}</strong></li>`).join('')}</ul>` : '<p class="tom">Inga synpunkter än.</p>'}
    </section>
    <section aria-labelledby="tl-synpunkter">
      <h2 id="tl-synpunkter">Synpunkter (${d.synpunkter.length})</h2>
      <ul class="tl-lista">${d.synpunkter.map(s => `<li class="ruta tl-synpunkt">
        <p class="tl-rubrik"><strong>${esc(s.nummer)}</strong> ${esc(s.typText)}, ${esc(s.allvarText.split(',')[0].toLowerCase())}</p>
        <p class="tl-fritext">${esc(s.text)}</p>
        <p class="liten dampad">${esc(tidpunkt(s.tid))}. Vy ${esc(s.vy)}, ${esc(s.rollText ?? 'inte inloggad')}${s.testroll ? `, testroll ${esc(s.testroll)}` : ''}${s.uppdrag ? `, uppdrag ${esc(s.uppdrag)}` : ''}. ${s.system ? `Journalsystem ${esc(text(SYSTEM, s.system))}. ` : ''}Version ${esc(s.version)} (${esc(s.gransnitt)}), ${esc(s.webblasare)}${s.bredd ? `, ${s.bredd} px` : ''}.</p>
        ${s.kontakt ? `<p class="liten">Kontakt: <span class="tl-fritext">${esc(s.kontakt)}</span></p>` : ''}
      </li>`).join('')}</ul>
    </section>`;
}
