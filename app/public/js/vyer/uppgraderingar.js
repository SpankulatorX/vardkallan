// Uppgraderingar (runda 12, r2, vårt D7 och M8): versionen i drift, databasens schemaversion, vad nästa version ändrar
// och godkännandet av två systemförvaltare. Systemet visar själv nyheterna, API:ts ändringslogg och migreringarna, och
// det stoppar en uppgradering vars tester inte är gröna. En återgång till förra versionen backar databasen med de
// återställningar som sparades när migreringarna tillämpades, och inget går förlorat.
import { esc, api, tidpunkt, datum, notis, medKnapp, dialog, vyRubrik, ikon } from '../ui.js';

export const namn = 'uppgraderingar';

const TYPTEXT = { uppgradering: 'Uppgradering', atergang: 'Återgång' };
const STATUSTEXT = { vantar: 'Väntar på godkännande', genomford: 'Genomförd' };

function versionsInnehall(v) {
  return `<article class="lm-sektion uppg-version" aria-labelledby="uppg-v-${esc(v.version.replace(/\./g, '-'))}">
    <h3 id="uppg-v-${esc(v.version.replace(/\./g, '-'))}">Version ${esc(v.version)}${v.datum ? `, ${esc(datum(v.datum))}` : ''}</h3>
    <h4>Nyheter för användarna</h4>
    ${v.nyheter.length ? `<ul>${v.nyheter.map(n => `<li><strong>${esc(n.rubrik)}</strong>. ${esc(n.text)}</li>`).join('')}</ul>` : '<p class="liten">Inga nyheter för användarna.</p>'}
    <h4>Ändringar i API:t</h4>
    ${v.api ? `<p class="liten">${esc(v.api.text)}</p>${v.api.annat.length ? `<ul class="liten">${v.api.annat.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}` : '<p class="liten">Inga ändringar i API:t.</p>'}
    <h4>Ändringar i databasen</h4>
    ${v.migreringar.length ? `<ul>${v.migreringar.map(m => `<li>Migrering ${m.id}: ${esc(m.namn)}. ${esc(m.beskrivning ?? '')} ${m.aterstallning ? 'Går att backa.' : ''}</li>`).join('')}</ul>` : '<p class="liten">Inga ändringar i databasen.</p>'}
  </article>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Uppgraderingar', 'Versionen i drift, vad en uppgradering ändrar och godkännandet innan den används.') + '<div id="uppg"><p class="tom">Hämtar.</p></div>';
  const o = await api('/api/uppgraderingar');
  const el = main.querySelector('#uppg');
  if (!el) return;
  const v = o.vantar;
  const godkannText = v?.godkand1Av ? `Godkänd av ${esc(v.godkand1Av)} ${esc(tidpunkt(v.godkand1))}. Väntar på en andra systemförvaltare.` : 'Väntar på att vårdgivarens systemförvaltare godkänner den.';
  el.innerHTML = `
    <section class="inkorg-sektion" aria-labelledby="uppg-drift"><h2 id="uppg-drift">I drift</h2>
      <p>Version ${esc(o.driftversion)} är i drift. Programmet är version ${esc(o.program)}.</p>
      <p class="${o.schema.stammer ? 'ruta ruta-ok' : 'ruta ruta-larm'} liten">${o.schema.stammer ? ikon.bock : ikon.varning}<span>Databasens schemaversion är ${o.schema.schemaversion}. ${o.schema.stammer ? `Den stämmer med version ${esc(o.driftversion)}.` : 'Den stämmer inte med versionen i drift.'} Schemat kontrolleras varje gång servern startar eller läser in en sandlåda.</span></p>
      ${o.forra ? `<p class="liten">Om version ${esc(o.driftversion)} ger fel i vården går det att gå tillbaka till version ${esc(o.forra.version)}. Databasen backas med de återställningar som sparades när migreringarna tillämpades, och det som har skrivits i de nya tabellerna sparas undan och kommer tillbaka vid nästa uppgradering. En säkerhetskopia tas först.</p>
        <button type="button" class="knapp sekundar" data-aterga>Gå tillbaka till version ${esc(o.forra.version)}</button>` : ''}
    </section>
    ${v ? `<section class="inkorg-sektion" aria-labelledby="uppg-vantar"><h2 id="uppg-vantar">Uppgradering till version ${esc(v.till)}</h2>
      <p class="${o.tester.gron ? 'ruta ruta-ok' : 'ruta ruta-larm'} liten">${o.tester.gron ? ikon.bock : ikon.varning}<span>${esc(o.tester.text)}${o.tester.tid ? ` Testerna kördes ${esc(tidpunkt(o.tester.tid))}.` : ''}</span></p>
      <p data-uppg-status>${godkannText}</p>
      ${o.tester.gron && v.kanGodkanna ? `<button type="button" class="knapp" data-godkann="${v.id}">${v.godkand1Av ? 'Godkänn och uppgradera nu' : 'Godkänn uppgraderingen'}</button>` : ''}
      ${!v.kanGodkanna && v.godkand1Av ? '<p class="liten">Du har redan godkänt uppgraderingen. En annan systemförvaltare godkänner den i sin egen inloggning, och då används den direkt.</p>' : ''}
      <h3>Det här ändrar uppgraderingen</h3>
      ${o.nasta.map(versionsInnehall).join('')}
    </section>` : ''}
    <section class="lm-sektion" aria-labelledby="uppg-mig"><h2 id="uppg-mig">Migreringar</h2>
      <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Nr</th><th scope="col">Version</th><th scope="col">Ändring</th><th scope="col">Tillämpad</th></tr></thead><tbody>
        ${o.migreringar.map(m => `<tr><td class="tal">${m.id}</td><td>${esc(m.version)}</td><th scope="row">${esc(m.namn)}</th><td>${m.tillampad ? `${ikon.bock} ${esc(tidpunkt(m.tillampad))}` : 'Inte tillämpad'}</td></tr>`).join('')}</tbody></table></div>
      ${o.parkerade.length ? `<p class="liten">Undanlagt vid en återgång: ${o.parkerade.map(p => `${esc(p.tabell)}${p.kolumn ? `.${esc(p.kolumn)}` : ''}`).join(', ')}. Det läggs tillbaka vid nästa uppgradering.</p>` : ''}
    </section>
    ${o.i_drift && !v ? versionsInnehall(o.i_drift) : ''}
    <section class="lm-sektion" aria-labelledby="uppg-hist"><h2 id="uppg-hist">Historik</h2>
      ${o.historik.length ? `<ul class="inkorg-lista">${o.historik.map(h => `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">${esc(TYPTEXT[h.typ] ?? h.typ)} från ${esc(h.fran)} till ${esc(h.till)}</span>
        <span class="under-text">${esc(STATUSTEXT[h.status] ?? h.status)}. ${h.typ === 'atergang' ? `Gjord av ${esc(h.skapadAv)} ${esc(tidpunkt(h.skapad))}.` : `${h.godkand1Av ? `Godkänd av ${esc(h.godkand1Av)}` : ''}${h.godkand2Av ? ` och ${esc(h.godkand2Av)}` : ''}${h.genomford ? `, används sedan ${esc(tidpunkt(h.genomford))}` : ''}.`}</span></div></li>`).join('')}</ul>` : '<p class="tom liten">Ingen uppgradering eller återgång är gjord i den här sandlådan.</p>'}
      <p class="demoregel">Simulerat: i demon byts bara databasen i sandlådan, och programmet är detsamma för alla sandlådor. I driften är varje version en egen avbildning, och vid en återgång startas den förra avbildningen, som själv backar databasen när den startar.</p>
    </section>`;
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-aterga]');
    if (a) {
      const ok = await dialog(`<h2 id="dlg-rubrik">${ikon.varning}<span>Gå tillbaka till version ${esc(o.forra.version)}</span></h2>
        <div class="dialog-text"><p>En säkerhetskopia av sandlådan tas först. Sedan backas databasen till version ${esc(o.forra.version)}, och uppgraderingen till version ${esc(o.driftversion)} väntar på att två systemförvaltare godkänner den igen.</p></div>
        <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp knapp-allvar" data-varde="ok">Gå tillbaka</button></div>`, { klass: 'dialog-allvar' });
      if (!ok) return;
      try { await medKnapp(a, () => api('/api/uppgraderingar/atergang', { metod: 'POST', data: {} })); notis(`Version ${o.forra.version} är i drift igen.`); } catch { /* notis visad */ }
      return visa(main);
    }
    const g = e.target.closest('[data-godkann]');
    if (!g) return;
    try {
      const r = await medKnapp(g, () => api(`/api/uppgraderingar/${g.dataset.godkann}/godkann`, { metod: 'POST', data: {} }));
      notis(r.genomford ? `Uppgraderingen till version ${r.uppgradering.till} används nu.` : 'Uppgraderingen är godkänd och väntar på en andra systemförvaltare.');
    } catch { /* notis visad */ }
    visa(main);
  });
}
