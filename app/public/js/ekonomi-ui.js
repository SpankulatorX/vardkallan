// Kostnader i vårdprocessen (runda 7, r3, Sussa 7.1.2.1): en ruta i patientens översikt med kostnaden hittills för det
// pågående vårdtillfället eller dagens vårdkontakt enligt prislistan, DRG enligt demogrupperingen och patientens
// högkostnadsskydd. Läkare och sjuksköterskor ser hela rutan. Vårdadministratören ser bara patientens avgifter och
// högkostnadsskydd. Läkaren registrerar här att patienten är medicinskt färdigbehandlad.
import { esc, api, datum, notis, felNotis, dialog, idag } from './ui.js';
import { far } from './app.js';
import { kr } from './tidbok-ui.js';

// Hämtas för sig. Vid avbrott finns kostnaderna inte i läskopian, och då visas rutan inte.
export async function hamta(id) {
  if (!far('las_kostnader')) return null;
  try { return await api(`/api/patient/${encodeURIComponent(id)}/kostnader`); } catch (e) { if (e?.status === 401) throw e; return null; }
}

const lista = (rubrik, rader) => (rader?.length ? `<details class="ek-lista"><summary>${esc(rubrik)} (${rader.length})</summary><ul class="enkel-lista">${rader.map(r => `<li>${esc(r.text)}: ${esc(String(r.antal))} st, ${esc(kr(r.belopp))}</li>`).join('')}</ul></details>` : '');

function fardigHtml(f) {
  if (!f) return '';
  if (f.datum) return `<p class="ek-fardig"><strong>Medicinskt färdigbehandlad ${esc(datum(f.datum))}.</strong>${f.kalla === 'spu' ? ' Från underrättelsen i den samordnade planeringen.' : f.av ? ` Registrerat av ${esc(f.av.namn)}.` : ''}${f.kommunText ? ` ${esc(f.kommunText)}` : ''}</p>`;
  if (f.kanRegistreras) return '<div class="knapprad tat" data-skriv><button type="button" class="knapp liten sekundar" data-ek="fardigbehandlad">Medicinskt färdigbehandlad</button></div>';
  return f.varforInte ? `<p class="dampad liten">${esc(f.varforInte)}</p>` : '';
}

export function sektionHtml(k) {
  if (!k) return '';
  const a = k.aktuell;
  const hog = `<p class="ek-hog">${esc(k.hogkostnadsskydd.text)}</p>`;
  const avgifter = a?.patientavgifter?.length ? `<ul class="enkel-lista ek-avgifter">${a.patientavgifter.map(x => `<li>Patientavgift ${esc(kr(x.belopp))}, ${esc(datum(x.datum))}<span class="under-text">${esc(x.statusText ?? '')}</span></li>`).join('')}</ul>` : '';
  let innehall = '';
  if (!a) innehall = '<p class="tom liten">Patienten har ingen pågående vårdkontakt eller vårdtillfälle som du kan se kostnaderna för.</p>';
  else if (a.kategorier) {
    const vad = a.typ === 'vardtillfalle' ? `Vårdtillfället sedan ${datum(a.sedan)}` : `Vårdkontakten ${datum(a.sedan)}`;
    innehall = `<p><strong>${esc(vad)}: ${esc(kr(a.totalt))}</strong> ${a.pagar ? 'hittills' : ''}</p>
      <div class="tabellrulle"><table class="tabell siffertabell ek-kostnad"><thead><tr><th scope="col">Kostnad</th><th scope="col" class="tal">Antal</th><th scope="col" class="tal">Belopp</th></tr></thead>
        <tbody>${a.kategorier.map(x => `<tr><td>${esc(x.text)}</td><td class="tal">${x.antal}</td><td class="tal">${esc(kr(x.belopp))}</td></tr>`).join('')}</tbody></table></div>
      ${lista('Läkemedel', a.lakemedel)}${lista('Material', a.material)}${lista('Åtgärder', a.atgarder)}${lista('Hjälpmedel', a.hjalpmedel)}
      ${a.drg ? `<p class="ek-drg">Enligt DRG, demogrupp ${esc(a.drg.text.replace(' (demogrupp)', '').toLowerCase())}: <strong>${esc(kr(a.drg.belopp))}</strong>${a.drg.preliminar ? ', preliminärt tills patienten är utskriven' : ''}.<span class="under-text">${esc(a.drg.forklaring)}</span></p>` : ''}
      ${fardigHtml(a.fardigbehandlad)}`;
  } else innehall = `<p>${a.typ === 'vardtillfalle' ? 'Vårdtillfället' : 'Vårdkontakten'} ${esc(datum(a.sedan))}.</p>`;
  return `<section class="ov-sektion ov-kostnader" aria-labelledby="ov-kostnader"><div class="sektion-huvud"><h2 id="ov-kostnader">${a?.kategorier ? 'Kostnader i vårdprocessen' : 'Avgifter och högkostnadsskydd'}</h2><span class="tagg tagg-demo">Demopriser</span></div>
    ${innehall}${avgifter}${hog}<p class="demoregel">${esc(k.demo)}</p></section>`;
}

export function koppla(el, k, ctx, ladda) {
  if (!k?.aktuell) return;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ek="fardigbehandlad"]');
    if (!b) return;
    const svar = await dialog(`<h2 id="dlg-rubrik">Medicinskt färdigbehandlad</h2><form class="dialog-text">
        <p>Registrera att ${esc(ctx.patient?.namn ?? 'patienten')} är medicinskt färdigbehandlad. Datumet följer med i faktureringsunderlaget för vårdtillfället.</p>
        <div class="falt"><label for="ek-fb-datum">Datum</label><input id="ek-fb-datum" name="datum" type="date" max="${esc(idag())}" value="${esc(idag())}" required></div>
        <p class="dialog-fel form-fel" hidden></p></form>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div>`);
    if (!svar) return;
    try {
      const r = await api(`/api/vardtillfalle/${encodeURIComponent(k.aktuell.id)}/fardigbehandlad`, { metod: 'POST', data: { datum: svar.data.datum } });
      notis(`Patienten är registrerad som medicinskt färdigbehandlad ${datum(r.datum)}.`);
      await ladda();
    } catch (err) { felNotis(err); }
  });
}
