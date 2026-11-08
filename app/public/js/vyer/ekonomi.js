// Ekonomi (runda 7, r3, Sussa 7.1): ekonomens faktureringsunderlag och prislistor. Systemet har redan skapat
// transaktionsposterna ur det som har hänt, så startsidan visar varje vårdenhet med antal poster, belopp och vad som
// väntar för förra månaden, och underlaget hämtas med ett klick. Inga patientuppgifter visas på sidan, bara i filen.
import { esc, api, datum, tidpunkt, notis, felNotis, dialog, medKnapp, vyRubrik, ikon, idag, plusDagar, ApiFel } from '../ui.js';
import { kr } from '../tidbok-ui.js';

export const namn = 'ekonomi';

const exporterad = (s) => (s ? `Exporterad ${esc(tidpunkt(s.tid))} som ${esc(s.format.toUpperCase())}` : 'Inte exporterad');

// Filen hämtas med fetch, så att ett fel visas som en notis i stället för att laddas ner, och sparas sedan.
async function hamtaFil(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) {
    let j = {};
    try { j = await r.json(); } catch { j = { fel: 'Underlaget kunde inte tas fram.' }; }
    throw new ApiFel(r.status, j);
  }
  const blob = await r.blob();
  const namnet = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'faktureringsunderlag';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namnet;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return { antal: Number(r.headers.get('x-antal-poster') ?? 0), namn: namnet };
}

function radHtml(v, period) {
  const q = (format) => `/api/ekonomi/underlag?${new URLSearchParams({ vardenhet: v.vardenhet.id, period: period.manad, format })}`;
  const detaljer = v.antal ? `<details class="ek-detaljer"><summary>Visa underlaget</summary>
      <div class="ek-grupper"><div><h3>Per typ</h3><ul class="enkel-lista">${v.perTyp.map(g => `<li>${esc(g.text)}: ${g.antal} ${g.antal === 1 ? 'post' : 'poster'}, ${esc(kr(g.belopp))}</li>`).join('')}</ul></div>
      <div><h3>Per betalningsmottagare</h3><ul class="enkel-lista">${v.perBetalare.map(g => `<li>${esc(g.text)}: ${g.antal} ${g.antal === 1 ? 'post' : 'poster'}, ${esc(kr(g.belopp))}</li>`).join('')}</ul></div></div>
    </details>` : '';
  return `<tr data-enhet="${esc(v.vardenhet.id)}"><th scope="row">${esc(v.vardenhet.namn)}<span class="under-text">${esc(v.vardenhet.hsaId)}</span>
      ${v.varningar.map(w => `<span class="under-text ek-varning">${ikon.varning}${esc(w)}</span>`).join('')}${detaljer}</th>
    <td class="tal">${v.antal}</td><td class="tal">${esc(kr(v.summa))}</td><td class="tal">${esc(kr(v.debiteras))}</td>
    <td class="ek-status">${exporterad(v.senastExporterad)}</td>
    <td><span class="knapprad">${v.antal ? `<a class="knapp liten" href="${q('csv')}" data-export="csv">${ikon.logg}<span>CSV</span></a><a class="knapp liten sekundar" href="${q('json')}" data-export="json">${ikon.kod}<span>JSON</span></a>` : '<span class="dampad liten">Inga poster</span>'}</span></td></tr>`;
}

export async function visa(main, _p, q) {
  main.innerHTML = vyRubrik('Faktureringsunderlag', 'Systemet skapar transaktionsposterna av sig självt ur vårdkontakter, vårddygn, åtgärder, givna läkemedel, material och hjälpmedel. Hämta underlaget för ekonomisystemet per vårdenhet.')
    + '<div id="ek"><p class="tom">Hämtar underlaget.</p></div>';
  const ladda = async (period) => {
    const o = await api(`/api/ekonomi/oversikt${period ? `?period=${encodeURIComponent(period)}` : ''}`);
    const el = main.querySelector('#ek');
    if (!el) return;
    const p = o.period;
    el.innerHTML = `<div class="ek-val"><label for="ek-period">Period</label>
        <select id="ek-period">${o.perioder.map(x => `<option value="${esc(x.manad)}"${x.manad === p.manad ? ' selected' : ''}>${esc(x.text)}${x.pagar ? ' (pågår)' : ''}</option>`).join('')}</select>
        <p class="dampad liten">${p.pagar ? 'Månaden pågår, så underlaget är preliminärt.' : 'Förra månaden är förvald, eftersom den är avslutad.'}</p></div>
      <div class="tabellrulle"><table class="tabell siffertabell ek-tabell">
        <thead><tr><th scope="col">Vårdenhet</th><th scope="col" class="tal">Poster</th><th scope="col" class="tal">Belopp</th><th scope="col" class="tal">Att fakturera</th><th scope="col">Status</th><th scope="col">Hämta</th></tr></thead>
        <tbody>${o.vardenheter.map(v => radHtml(v, p)).join('')}</tbody></table></div>
      <div class="ruta ruta-info">${ikon.info}<div><p>Varje post har ett sammanhållande id som pekar på vårdkontakten eller vårdtillfället. Betalningsmottagaren räknar systemet fram ur identiteten, åldern, folkbokföringen (simulerad) och LMA-kort. Utomlänsvården har en egen del i JSON-filen per hemregion, i den form som den nationella tjänsten för utomlänsvård tar emot (simulerad).</p>
        <p>Varje export loggas på patienterna i underlaget. För en patient med skyddade personuppgifter innehåller underlaget aldrig namn eller adress.</p></div></div>
      <section aria-labelledby="ek-tidigare"><h2 id="ek-tidigare">Tidigare exporter</h2><div id="ek-exporter"><p class="tom liten">Hämtar.</p></div></section>
      <p class="demoregel">${esc(o.demo)}</p>`;
    el.querySelector('#ek-period').addEventListener('change', (e) => ladda(e.target.value).catch(felNotis));
    const ex = await api('/api/ekonomi/exporter');
    const lista = el.querySelector('#ek-exporter');
    if (lista) {
      lista.innerHTML = ex.exporter.length ? `<ul class="enkel-lista">${ex.exporter.slice(0, 10).map(x => `<li><strong>${esc(x.vardenhet?.namn ?? '')}, ${esc(x.period.text)}</strong>
          <span class="under-text">${esc(tidpunkt(x.tid))}, ${esc(x.format.toUpperCase())}, ${x.antal} poster, ${esc(kr(x.summa))}. ${esc(x.av?.namn ?? '')}.</span></li>`).join('')}</ul>` : '<p class="tom liten">Inga exporter än.</p>';
    }
    return p;
  };
  let period = await ladda(q?.get('period') ?? null);
  main.querySelector('#ek').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-export]');
    if (!a) return;
    e.preventDefault();
    const rad = a.closest('tr');
    const enhet = rad.querySelector('th').firstChild.textContent.trim();
    try {
      const ut = await medKnapp(a, () => hamtaFil(a.getAttribute('href')));
      notis(`Faktureringsunderlaget för ${enhet}, ${period.text}, är exporterat med ${ut.antal} poster.`);
      period = await ladda(main.querySelector('#ek-period')?.value ?? period.manad);
    } catch { /* notisen är visad */ }
  });
}

// Prislistorna (Sussa 7.1.1.2). Ekonomen ändrar ett pris med ett datum som inte har passerat, och varje ändring blir
// en ny version med orsak och vem som gjorde den. Historiken visas under priserna.
const forstaNastaManad = () => `${plusDagar(`${idag().slice(0, 7)}-01`, 32).slice(0, 7)}-01`;

function prisTabell(kat, text, poster, oppen) {
  const rader = Object.entries(poster);
  return `<details class="pl-kategori"${oppen ? ' open' : ''}><summary>${esc(text)} (${rader.length})</summary><div class="tabellrulle"><table class="tabell siffertabell">
    <thead><tr><th scope="col">Kod</th><th scope="col">Text</th><th scope="col" class="tal">Pris</th>${kat === 'hjalpmedel' ? '<th scope="col" class="tal">Patientens avgift</th>' : ''}<th scope="col"><span class="sr">Ändra</span></th></tr></thead>
    <tbody>${rader.map(([kod, p]) => `<tr><td><span class="kod">${esc(kod)}</span></td><td>${esc(p.text)}${p.schablon ? '<span class="under-text">Schablon som systemet räknar</span>' : ''}</td><td class="tal">${esc(kr(p.pris))}</td>${kat === 'hjalpmedel' ? `<td class="tal">${esc(kr(p.avgift))}</td>` : ''}
      <td><button type="button" class="knapp text liten" data-andra="${esc(kat)}" data-kod="${esc(kod)}">Ändra</button></td></tr>`).join('')}</tbody></table></div></details>`;
}

export const prislistor = {
  namn: 'prislistor',
  async visa(main, _p, q) {
    main.innerHTML = vyRubrik('Prislistor', 'Priserna per vårdenhet med giltighetstid och historik. En ändring gäller från ett datum som inte har passerat, så att underlag som redan har tagits fram aldrig ändras.')
      + '<div id="pl"><p class="tom">Hämtar prislistorna.</p></div>';
    const alla = await api('/api/ekonomi/prislistor');
    const ladda = async (enhet) => {
      const h = await api(`/api/ekonomi/prislistor/${encodeURIComponent(enhet)}`);
      const el = main.querySelector('#pl');
      if (!el) return null;
      const aktuell = h.versioner.find(v => v.version === h.aktuellVersion) ?? h.versioner[0];
      const kommande = h.versioner.filter(v => v.giltigFran > idag());
      el.innerHTML = `<div class="ek-val"><label for="pl-enhet">Vårdenhet</label>
          <select id="pl-enhet">${alla.prislistor.map(x => `<option value="${esc(x.vardenhet.id)}"${x.vardenhet.id === h.vardenhet.id ? ' selected' : ''}>${esc(x.vardenhet.namn)}</option>`).join('')}</select></div>
        <dl class="faktarad"><div><dt>Gäller i dag</dt><dd>Version ${aktuell.version}, från ${esc(datum(aktuell.giltigFran))}</dd></div>
          ${kommande.map(v => `<div><dt>Kommande</dt><dd>Version ${v.version} från ${esc(datum(v.giltigFran))}</dd></div>`).join('')}</dl>
        ${Object.entries(h.kategorier).map(([k, t]) => prisTabell(k, t, aktuell.poster[k] ?? {}, k !== 'lakemedel')).join('')}
        <section aria-labelledby="pl-historik"><h2 id="pl-historik">Historik</h2><ol class="enkel-lista pl-historik">${h.versioner.map(v => `<li><strong>Version ${v.version}</strong>, ${esc(datum(v.giltigFran))} till ${v.giltigTill ? esc(datum(v.giltigTill)) : 'tills vidare'}
          <span class="under-text">${esc(v.orsak)}. ${v.skapadAv ? `${esc(v.skapadAv.namn)}, ` : ''}${esc(tidpunkt(v.skapad))}.</span>
          ${v.andringar.length ? `<span class="under-text">${v.andringar.slice(0, 6).map(a => `${esc(a.text)}: ${a.fore == null ? 'ny' : esc(kr(a.fore))} till ${esc(kr(a.efter))}`).join('. ')}${v.andringar.length > 6 ? `. Och ${v.andringar.length - 6} till.` : '.'}</span>` : ''}</li>`).join('')}</ol></section>
        <p class="demoregel">${esc(h.demo)}</p>`;
      el.querySelector('#pl-enhet').addEventListener('change', (e) => ladda(e.target.value).catch(felNotis));
      return h;
    };
    let h = await ladda(q?.get('enhet') ?? alla.prislistor.find(x => x.vardenhet.id === 'uso-kard')?.vardenhet.id ?? alla.prislistor[0].vardenhet.id);
    main.querySelector('#pl').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-andra]');
      if (!b || !h) return;
      const kat = b.dataset.andra;
      const kod = b.dataset.kod;
      const aktuell = h.versioner.find(v => v.version === h.aktuellVersion) ?? h.versioner[0];
      const p = aktuell.poster[kat][kod];
      const svar = await dialog(`<h2 id="dlg-rubrik">Ändra pris</h2><form class="dialog-text">
          <p><strong>${esc(p.text)}</strong> på ${esc(h.vardenhet.namn)}. Nu ${esc(kr(p.pris))}.</p>
          <div class="falt"><label for="pl-pris">Nytt pris i kronor</label><input id="pl-pris" name="pris" type="number" min="0" max="10000000" step="1" inputmode="numeric" required autofocus></div>
          ${kat === 'hjalpmedel' ? `<div class="falt"><label for="pl-avgift">Patientens avgift i kronor</label><input id="pl-avgift" name="avgift" type="number" min="0" step="1" value="${esc(p.avgift)}" required></div>` : ''}
          <div class="falt"><label for="pl-fran">Gäller från</label><input id="pl-fran" name="giltigFran" type="date" min="${esc(idag())}" value="${esc(forstaNastaManad())}" required>
            <span class="hjalp">Första dagen i nästa månad är förvald. Ett datum som har passerat går inte att välja.</span></div>
          <div class="falt"><label for="pl-orsak">Orsak</label><input id="pl-orsak" name="orsak" type="text" maxlength="300" required></div>
          <p class="dialog-fel form-fel" hidden></p></form>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara ny version</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div>`);
      if (!svar) return;
      const andring = { kategori: kat, kod, pris: Number(svar.data.pris), ...(kat === 'hjalpmedel' ? { avgift: Number(svar.data.avgift) } : {}) };
      try {
        const r = await api(`/api/ekonomi/prislistor/${encodeURIComponent(h.vardenhet.id)}`, { metod: 'POST', data: { andringar: [andring], giltigFran: svar.data.giltigFran, orsak: svar.data.orsak } });
        notis(`${p.text} kostar ${kr(andring.pris)} från ${datum(r.giltigFran)}. Prislistan har version ${r.version}.`);
        h = await ladda(h.vardenhet.id);
      } catch (err) { felNotis(err); }
    });
  },
};
