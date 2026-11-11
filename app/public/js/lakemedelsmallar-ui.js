// Runda 12, r1 (vårt D11): vårdenhetens läkemedelsmallar under Direktiv och uppföljning. Läkaren bygger en ny mall
// eller ändrar en, med systemets förslag ur katalogen, och mallen används först när den mallansvariga läkaren har
// godkänt den i sin inkorg. Systemet visar vad som ändras och vem som godkänner innan något sparas.
import { esc, api, notis, medKnapp, dialog } from './ui.js';

const TYP = { staende: 'Stående', vid_behov: 'Vid behov', tillfallig: 'Tillfällig' };
const tyst = (vag, data) => api(vag, { metod: 'POST', data, tyst: true });

export async function visa(plats) {
  if (!plats) return;
  let d;
  try { d = await api('/api/lakemedelsmallar', { tyst: true }); } catch { plats.innerHTML = ''; return; }
  if (!plats.isConnected) return;
  plats.innerHTML = `<section class="lm-sektion" aria-labelledby="lms-mallar"><h2 id="lms-mallar">Läkemedelsmallar</h2>
    <p class="liten">${esc(d.text)} Förskrivaren får mallen som förslag när läkemedlet väljs.</p>
    <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Mall</th><th scope="col">Innehåll</th><th scope="col">Version</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
      ${d.substans.map(m => `<tr><th scope="row">${esc(m.namn)}<br><span class="dampad liten">ATC ${esc(m.atc)}</span></th><td class="liten">${m.innehall.map(esc).join('<br>') || 'Ingen godkänd version ännu.'}</td>
        <td>${m.version ? `Version ${m.version}` : 'Inte godkänd'}${m.vantarVersion ? `<br><span class="under-text">Version ${m.vantarVersion} väntar på godkännande</span>` : ''}</td>
        <td class="atgarder"><button type="button" class="knapp liten sekundar" data-andra-mall="${esc(m.atc)}">Ändra</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="knapprad"><button type="button" class="knapp" data-ny-lmmall>Ny läkemedelsmall</button></div></section>`;
  plats.addEventListener('click', async (e) => {
    const n = e.target.closest('[data-ny-lmmall]');
    const a = e.target.closest('[data-andra-mall]');
    if (!n && !a) return;
    if (await formular(n ? null : a.dataset.andraMall, n ?? a)) visa(plats);
  });
}

async function formular(atc, knapp) {
  const ny = !atc;
  let stenar = null;
  if (ny) { try { stenar = await api('/api/lakemedelsmallar/byggstenar'); } catch { return false; } }
  const forsta = stenar?.substanser[0]?.forslag ?? {};
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${ny ? 'Ny läkemedelsmall' : 'Ändra läkemedelsmallen'}</h2>
    ${ny ? `<div class="falt"><label for="lmm-atc">Substans</label><select id="lmm-atc" name="atc">${stenar.substanser.map(s => `<option value="${esc(s.atc)}">${esc(s.substans)} (${esc(s.atc)})</option>`).join('')}</select>
      <p class="hjalp">Bara substanser utan mall. Systemet föreslår dos och enhet ur produktens styrka.</p></div>
      <div class="falt"><label for="lmm-namn">Mallens namn</label><input id="lmm-namn" name="namn" required maxlength="80" value="${esc(forsta.namn ?? '')}"></div>` : `<input type="hidden" name="atc" value="${esc(atc)}">`}
    <div class="falt"><label for="lmm-dosering">Dosering</label><input id="lmm-dosering" name="dosering" maxlength="200"${ny ? ' required' : ''} value="${esc(forsta.dosering ?? '')}"></div>
    <div class="falt-rad"><div class="falt smal"><label for="lmm-dos">Dos</label><input id="lmm-dos" name="dos" inputmode="decimal" value="${esc(forsta.dos ?? '')}"></div>
      <div class="falt smal"><label for="lmm-enhet">Enhet</label><input id="lmm-enhet" name="dosEnhet" maxlength="20" value="${esc(forsta.dosEnhet ?? '')}"></div>
      <div class="falt smal"><label for="lmm-tider">Tider</label><input id="lmm-tider" name="tider" maxlength="40" value="${esc((forsta.tider ?? []).join(', '))}" aria-describedby="lmm-tider-h"><span class="hjalp" id="lmm-tider-h">Timmar, till exempel 08, 20</span></div>
      <div class="falt smal"><label for="lmm-upp">Uppföljning efter dagar</label><input id="lmm-upp" name="uppfoljning" inputmode="numeric" value="${esc(forsta.uppfoljning ?? '')}"></div></div>
    <fieldset class="segment"><legend>Typ</legend>${Object.entries(TYP).map(([k, t]) => `<input type="radio" id="lmm-typ-${k}" name="typ" value="${k}"${(forsta.typ ?? 'staende') === k && ny ? ' checked' : ''}><label for="lmm-typ-${k}">${t}</label>`).join('')}</fieldset>
    ${ny ? '' : '<div class="falt"><label for="lmm-andring">Varför ändras mallen?</label><input id="lmm-andring" name="andring" maxlength="300"></div>'}
    <div class="sf-forhand" data-forhand aria-live="polite"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka för godkännande</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      const form = dl.querySelector('form');
      // Systemet fyller i förslaget för den substans som väljs.
      form.atc?.addEventListener?.('change', () => {
        const f = stenar.substanser.find(s => s.atc === form.atc.value)?.forslag ?? {};
        for (const k of ['namn', 'dosering', 'dos', 'dosEnhet', 'uppfoljning']) if (form[k]) form[k].value = f[k] ?? '';
        form.tider.value = (f.tider ?? []).join(', ');
      });
      let timer = null;
      let nr = 0;
      const kor = async () => {
        if (!dl.open) return;
        const mitt = ++nr;
        const ruta = dl.querySelector('[data-forhand]');
        const data = data0(form, ny);
        try {
          const f = await tyst('/api/lakemedelsmallar/forhandsvisa', data);
          if (mitt !== nr) return;
          ruta.innerHTML = f.ok ? `<div class="ruta ruta-info liten"><ul>${f.andringar.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`
            : `<div class="ruta ruta-larm liten" role="status"><ul>${f.fel.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
        } catch (x) { if (mitt === nr) ruta.innerHTML = `<p class="ruta ruta-larm liten" role="status">${esc(x.message)}</p>`; }
      };
      dl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(kor, 300); });
      dl.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(kor, 50); });
      if (ny) kor();
    },
  });
  if (!svar) return false;
  const data = Object.fromEntries(Object.entries(svar.data).filter(([, v]) => v !== ''));
  try {
    const r = await medKnapp(knapp, () => api(ny ? '/api/lakemedelsmallar/ny' : `/api/lakemedelsmallar/${encodeURIComponent(atc)}/andra`, { metod: 'POST', data }));
    notis(`${r.namn} version ${r.version} är sparad. ${r.text}`);
  } catch { return false; }
  return true;
}

// Det som skickas för förhandsvisningen. En ändring skickar bara de fält som är ifyllda.
function data0(form, ny) {
  const d = Object.fromEntries(new FormData(form));
  return ny ? d : Object.fromEntries(Object.entries(d).filter(([, v]) => v !== ''));
}
