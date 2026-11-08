// Runda 9, r7: beställningar av forskningsuttag (Sussa 6.3.3.1). Uppföljningsrollen registrerar och lämnar ut,
// arkivarien gör sekretessprövningen och verksamhetschefen godkänner för sin vårdenhet. Servern prövar allt.
import { esc, api, vyRubrik, tidpunkt, medKnapp, notis, felNotis, falt, tom } from '../ui.js';
import { far } from '../app.js';

export const namn = 'forskning';

function kort(b, kan) {
  return `<article class="ruta" data-bestallning="${b.id}">
    <h2>${esc(b.diarienummer)}: ${esc(b.titel)}</h2>
    <p>${esc(b.forskare)}, ${esc(b.organisation)}. Etikprövning ${esc(b.etikprovning)}.${b.aterkommande ? ' Återkommande uttag.' : ''}</p>
    <dl class="faktarad"><div><dt>Status</dt><dd>${esc(b.nastaSteg)}</dd></div><div><dt>Vårdenheter</dt><dd>${esc(b.vardenheter.join(', '))}</dd></div>
      <div><dt>Tabeller</dt><dd>${esc(Object.entries(b.urval).map(([t, f]) => `${t} (${f.join(', ')})`).join('; '))}</dd></div></dl>
    ${b.beslut.length ? `<ul>${b.beslut.map(x => `<li>${esc(x.roll)}: ${x.beslut === 'godkand' ? 'godkänd' : 'avslagen'} av ${esc(x.av)} ${esc(tidpunkt(x.tid))}${x.motivering ? `. ${esc(x.motivering)}` : ''}</li>`).join('')}</ul>` : ''}
    ${b.utlamnanden.length ? `<p class="under-text">Utlämnad ${b.utlamnanden.map(u => `${esc(tidpunkt(u.tid))} av ${esc(u.av)}, kontrollsumma ${esc(u.sha256.slice(0, 12))}`).join('; ')}.</p>` : ''}
    <div class="knapprad">
      ${kan.besluta && b.status === 'registrerad' ? `<button type="button" class="knapp" data-beslut="godkand" data-id="${b.id}">Godkänn</button><button type="button" class="knapp sekundar" data-beslut="avslagen" data-id="${b.id}">Avslå</button>` : ''}
      ${kan.registrera && (b.status === 'godkand' || (b.status === 'utlamnad' && b.aterkommande)) ? `<button type="button" class="knapp" data-utlamna="${b.id}">Lämna ut uttaget</button>` : ''}
    </div>
  </article>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Forskningsuttag', 'Beställningar av datauttag till forskare. Uttaget innehåller inga namn, personnummer eller fritext, och lämnas ut först när två personer har godkänt det.') + '<div id="fu"><p class="tom">Hämtar.</p></div>';
  const d = await api('/api/forskning');
  const enheter = await api('/api/enheter').catch(() => []);
  const vardenheter = (Array.isArray(enheter) ? enheter : enheter.enheter ?? []).flatMap(function platta(e) { return [e, ...(e.barn ?? []).flatMap(platta)]; }).filter(e => e.typ === 'vardenhet');
  const el = main.querySelector('#fu');
  const kan = { registrera: d.kanRegistrera, besluta: d.kanBesluta };
  el.innerHTML = `${kan.registrera ? `<details class="ruta"><summary>Registrera en beställning</summary>
      <form data-ny>
        ${falt({ namn: 'titel', etikett: 'Studiens titel', obligatorisk: true })}
        ${falt({ namn: 'forskare', etikett: 'Forskare', obligatorisk: true })}
        ${falt({ namn: 'organisation', etikett: 'Organisation', obligatorisk: true })}
        ${falt({ namn: 'etikprovning', etikett: 'Diarienummer för etikprövningen', obligatorisk: true, hjalp: 'Som Etikprövningsmyndigheten anger det, till exempel 2026-01234-01.' })}
        <fieldset><legend>Vårdenheter som uttaget gäller</legend>${vardenheter.map(v => `<label class="kryss"><input type="checkbox" name="vardenheter" value="${esc(v.id)}"> ${esc(v.namn)}</label>`).join('')}</fieldset>
        ${Object.entries(d.tabeller).map(([t, s]) => `<fieldset><legend>${esc(t)}<span class="under-text">${esc(s.beskrivning)}</span></legend>${Object.keys(s.falt).filter(f => !['rad', 'patient'].includes(f)).map(f => `<label class="kryss"><input type="checkbox" name="falt" value="${esc(t)}.${esc(f)}"> ${esc(f)}</label>`).join('')}</fieldset>`).join('')}
        <label class="kryss"><input type="checkbox" name="aterkommande"> Återkommande uttag i en löpande studie</label>
        <div class="knapprad"><button type="submit" class="knapp">Registrera</button></div>
      </form></details>` : ''}
    ${d.bestallningar.length ? d.bestallningar.map(b => kort(b, kan)).join('') : tom('Inga beställningar.')}`;
  el.querySelector('[data-ny]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const urval = {};
    for (const x of f.getAll('falt')) { const [t, falt2] = String(x).split('.'); (urval[t] ??= []).push(falt2); }
    try {
      const b = await medKnapp(e.currentTarget.querySelector('[type=submit]'), () => api('/api/forskning', { metod: 'POST', data: {
        titel: f.get('titel'), forskare: f.get('forskare'), organisation: f.get('organisation'), etikprovning: f.get('etikprovning'),
        vardenheter: f.getAll('vardenheter'), urval, aterkommande: f.get('aterkommande') === 'on' } }));
      notis(`Beställningen har diarienummer ${b.diarienummer}.`);
      visa(main);
    } catch (x) { felNotis(x); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-beslut]');
    const u = e.target.closest('[data-utlamna]');
    try {
      if (b) {
        const motivering = b.dataset.beslut === 'avslagen' ? window.prompt('Varför avslås beställningen?') : null;
        if (b.dataset.beslut === 'avslagen' && !motivering) return;
        await medKnapp(b, () => api(`/api/forskning/${b.dataset.id}/beslut`, { metod: 'POST', data: { beslut: b.dataset.beslut, motivering } }));
        notis('Beslutet är registrerat.');
        visa(main);
      }
      if (u) {
        const r = await medKnapp(u, () => api(`/api/forskning/${u.dataset.utlamna}/utlamna`, { metod: 'POST' }));
        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${r.diarienummer}.json`;
        a.click();
        notis(`Uttaget är utlämnat och loggat, kontrollsumma ${r.sha256.slice(0, 12)}.`);
        visa(main);
      }
    } catch (x) { felNotis(x); }
  });
  void far;
}
