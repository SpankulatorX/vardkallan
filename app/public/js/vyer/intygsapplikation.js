// Runda 14, r3: den simulerade intygsapplikationen (Sussa 2.2.1.9). Den öppnas från fliken Intyg i journalen, med
// patienten, läkaren och vårdenheten ifyllda, som Webcert i integrerat läge. Den är simulerad och inte Webcert: inget
// intyg lämnar demon. Varje ändring, signering och sändning meddelas journalen med statusuppdateringar.
import { esc, api, notis, felNotis, medKnapp, vyRubrik, tidpunkt } from '../ui.js';

export const namn = 'intygsapplikation';

const valHtml = (namn, etikett, alt, varde, av) => `<div class="falt"><label for="ia-${namn}">${esc(etikett)}</label>
  <select id="ia-${namn}" name="${namn}"${av ? ' disabled' : ''}><option value="">Välj</option>${Object.entries(alt).map(([k, t]) => `<option value="${esc(k)}"${varde === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;

export async function visa(main, iid) {
  const d = await api(`/api/intygsapplikation/${encodeURIComponent(iid)}`);
  const av = !d.kan.andra;
  const s = d.svar;
  main.innerHTML = `${vyRubrik(d.text, esc(d.simulerad))}
    <div class="ruta ruta-info"><p><strong>Intygsapplikation (simulerad, inte Webcert)</strong></p>
      <p class="liten">Patient: ${esc(d.patient.namn)}, ${esc(d.patient.personnummer)}. Vårdenhet: ${esc(d.vardenhet ?? '')}. Skapat av ${esc(d.skapadAv)} ${esc(tidpunkt(d.skapad))}. Mottagare: ${esc(d.mottagare)}.</p>
      <p class="liten">Status: <span class="tagg">${esc(d.statusText)}</span></p></div>
    <form class="ia-form">
      ${s.diagnosKod ? `<p><strong>Diagnos:</strong> ${esc(s.diagnosKod)} ${esc(s.diagnosText ?? '')} <span class="under-text">Förifylld från journalen.</span></p>` : ''}
      ${d.alternativ.period ? `${valHtml('sysselsattning', 'Sysselsättning', d.alternativ.sysselsattning, s.sysselsattning, av)}
        ${valHtml('nedsattning', 'Arbetsförmågan', d.alternativ.nedsattning, s.nedsattning, av)}
        <div class="falt"><label for="ia-fran">Från och med</label><input type="date" id="ia-fran" name="fran" value="${esc(s.fran ?? '')}"${av ? ' disabled' : ''}></div>
        <div class="falt"><label for="ia-till">Till och med</label><input type="date" id="ia-till" name="till" value="${esc(s.till ?? '')}"${av ? ' disabled' : ''}></div>` : ''}
      <div class="falt"><label for="ia-ovrigt">Övrigt</label><textarea id="ia-ovrigt" name="ovrigt" rows="3"${av ? ' disabled' : ''}>${esc(s.ovrigt ?? '')}</textarea></div>
      ${d.saknas.length ? `<p class="forslag-varfor">Innan intyget kan signeras behövs: ${esc(d.saknas.join(', '))}.</p>` : ''}
      <div class="knapprad">
        ${d.kan.andra ? '<button type="submit" class="knapp sekundar">Spara</button>' : ''}
        ${d.kan.signera ? '<button type="button" class="knapp" data-atgard="signera">Signera</button>' : ''}
        ${d.kan.skicka ? '<button type="button" class="knapp" data-atgard="skicka">Skicka till mottagaren</button>' : ''}
        ${d.kan.makulera ? '<button type="button" class="knapp sekundar" data-atgard="makulera">Makulera</button>' : ''}
        ${d.kan.radera ? '<button type="button" class="knapp sekundar" data-atgard="radera">Radera utkastet</button>' : ''}
      </div>
    </form>
    <p><a href="#/patient/${encodeURIComponent(d.patientId)}/intyg">Tillbaka till journalen</a></p>`;
  const form = main.querySelector('.ia-form');
  const data = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v === '' ? null : v]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await medKnapp(e.submitter ?? form.querySelector('button'), () => api(`/api/intygsapplikation/${encodeURIComponent(iid)}`, { metod: 'POST', data: data() })); notis('Utkastet är sparat.'); visa(main, iid); } catch (x) { felNotis(x); }
  });
  form.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-atgard]');
    if (!b) return;
    try {
      if (d.kan.andra && b.dataset.atgard === 'signera') await api(`/api/intygsapplikation/${encodeURIComponent(iid)}`, { metod: 'POST', data: data() });
      const r = await medKnapp(b, () => api(`/api/intygsapplikation/${encodeURIComponent(iid)}/${b.dataset.atgard}`, { metod: 'POST', data: {} }));
      notis(`Intyget: ${r.statusText.toLowerCase()}. Journalen har fått statusen.`);
      visa(main, iid);
    } catch (x) { felNotis(x); }
  });
}
