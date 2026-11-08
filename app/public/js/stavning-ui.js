// Runda 10, r3: rättstavning och grammatik i anteckningens textfält (Sussa 3.1.3.10). Fälten har webbläsarens egen
// stavningskontroll på svenska. Dessutom kontrollerar servern medicinska termer och grammatik (src/stavning.js) en kort
// stund efter att man slutat skriva och när man lämnar fältet. Möjliga fel visas under fältet med förklaring och förslag:
// ett klick byter ordet, och ett ord som är rätt kan läggas i den egna ordlistan. Texten sparas inte av kontrollen, och
// kontrollen räknas inte som aktivitet, så att den inte skjuter upp den automatiska utloggningen.
import { esc, api, notis } from './ui.js';

const PAUS = 700;

function ruta(t) {
  let r = t.parentElement.querySelector(':scope > .stavning');
  if (!r) {
    r = document.createElement('div');
    r.className = 'stavning';
    r.setAttribute('aria-live', 'polite');
    t.insertAdjacentElement('afterend', r);
  }
  return r;
}

async function kontrollera(t) {
  const text = t.value;
  const r = ruta(t);
  if (!text.trim()) { r.replaceChildren(); return; }
  let svar;
  try { svar = await api('/api/stavning', { metod: 'POST', data: { text, sprak: t.lang === 'en' ? 'en' : 'sv' }, tyst: true, bakgrund: true }); } catch { return; }
  // Texten kan ha ändrats medan kontrollen pågick. Då visas resultatet för den nya texten i stället.
  if (t.value !== text || !t.isConnected) return;
  r.innerHTML = svar.fel.length ? `<p class="stavning-rubrik">Systemet hittade ${svar.fel.length === 1 ? 'ett möjligt fel' : `${svar.fel.length} möjliga fel`}:</p><ul>${svar.fel.map((f, i) => `<li>
      <span class="stavning-ord ${f.typ === 'grammatik' ? 'grammatik' : ''}">${esc(f.text.trim() || 'mellanslag')}</span> ${esc(f.forklaring)}
      ${f.forslag.slice(0, 2).map((x, j) => `<button type="button" class="knapp liten sekundar" data-byt="${i}" data-forslag="${j}">Byt till ${esc(x.trim() ? x.replace(/\n/g, ' ') : 'ett mellanslag')}</button>`).join('')}
      ${f.typ === 'stavning' ? `<button type="button" class="knapp liten text" data-ordlista="${i}">Lägg till i min ordlista</button>` : ''}
    </li>`).join('')}</ul>` : '';
  r.onclick = async (e) => {
    const b = e.target.closest('[data-byt]');
    const o = e.target.closest('[data-ordlista]');
    if (b) {
      const f = svar.fel[Number(b.dataset.byt)];
      if (t.value.slice(f.start, f.slut) !== f.text) { kontrollera(t); return; }
      t.value = t.value.slice(0, f.start) + f.forslag[Number(b.dataset.forslag)] + t.value.slice(f.slut);
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.focus();
      kontrollera(t);
    }
    if (o) {
      const f = svar.fel[Number(o.dataset.ordlista)];
      try {
        await api('/api/stavning/ordlista', { metod: 'POST', data: { ord: f.text } });
        notis(`${f.text} finns nu i din ordlista och markeras inte igen.`);
        kontrollera(t);
      } catch { /* felet visas som notis */ }
    }
  };
}

// Kopplar kontrollen till alla textfält i formuläret som har data-sokord eller data-stavning.
export function koppla(form) {
  for (const t of [...form.querySelectorAll('[data-sokord], [data-stavning]')].filter(t => t.tagName === 'TEXTAREA')) {
    t.spellcheck = true;
    if (!t.lang) t.lang = 'sv';
    let timer = null;
    t.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => kontrollera(t), PAUS); });
    t.addEventListener('blur', () => { clearTimeout(timer); kontrollera(t); });
  }
}
