// Intensivvården som flik i journalen (runda 11, r7, Sussa 4.6.1.1 och 4.6.1.2): samma övervakning som på sidan
// Intensivvård, för personalen på en vårdenhet med intensivvårdsavdelning.
import { rendera } from './iva.js';

export async function visa(el, ctx) {
  el.innerHTML = '<div class="flikhuvud"><h2>Intensivvård</h2><p class="dampad">Övervakning, realtid från monitorn, egna gränser, vätskebalans, vårdtyngd och överrapportering.</p></div><div id="iva-flik"><p class="tom">Hämtar övervakningen.</p></div>';
  const d = await rendera(el.querySelector('#iva-flik'), ctx.id, ctx, () => ctx.ladda(), { iFlik: true });
  const text = el.querySelector('.flikhuvud .dampad');
  if (d && text && !d.patient.plats) text.textContent = `${d.patient.namn} vårdas inte på intensivvårdsavdelningen just nu. Uppgifterna nedan gäller ändå patienten.`;
}
