// Runda 8, r5: formuläret för tobaks- och nikotinvanor i en anteckning (Sussa testfall 4.1). Frågorna har fasta
// svarsalternativ enligt den nationella vägledningen. Systemet sätter själv att patienten använder tobak när en produkt
// är ifylld, flyttar fokus till antalet och visar direkt vilket stöd Socialstyrelsens riktlinjer rekommenderar och vilken
// KVÅ-kod det har. Servern kontrollerar och räknar om allt när anteckningen sparas (src/tobak.js).
import { esc } from '../ui.js';
import * as R from '../tobak-regler.js';

const id = (...d) => `tb-${d.join('-')}`;
const BRUKVAL = [['', 'Nej'], ...R.BRUK];

function produktRad(p, v = {}) {
  const val = v.bruk ?? '';
  return `<tr data-produkt="${esc(p.id)}">
    <th scope="row">${esc(p.namn)}</th>
    ${BRUKVAL.map(([b, text]) => `<td class="tobak-val"><input type="radio" id="${id(p.id, b || 'nej')}" name="${id('p', p.id)}" value="${esc(b)}"${val === b ? ' checked' : ''}><label for="${id(p.id, b || 'nej')}"><span class="sr">${esc(p.namn)}: ${esc(text)}</span></label></td>`).join('')}
    <td class="tobak-mer" data-mer>${merFalt(p, v)}</td>
  </tr>`;
}

// Fältet bredvid valet: antal, slutdatum eller vilken produkt, beroende på valet.
function merFalt(p, v = {}) {
  if (!v.bruk) return '';
  const delar = [];
  if (p.vad) delar.push(`<label class="sr" for="${id('vad', p.id)}">Vilken produkt</label><input type="text" id="${id('vad', p.id)}" name="vad" maxlength="100" placeholder="Vilken produkt" value="${esc(v.vad ?? '')}" autocomplete="off">`);
  if (v.bruk === 'slutat') delar.push(`<label for="${id('slut', p.id)}" class="liten">Slutdatum</label> <input type="date" id="${id('slut', p.id)}" name="slutdatum" value="${esc(v.slutdatum ?? '')}">`);
  else if (!p.utanAntal) {
    const enhet = v.bruk === 'dagligen' ? p.dagligen : p.ibland;
    delar.push(`<span class="med-enhet"><label class="sr" for="${id('antal', p.id)}">Antal ${esc(p.namn.toLowerCase())} ${esc(enhet)}</label><input type="text" id="${id('antal', p.id)}" name="antal" inputmode="numeric" autocomplete="off" size="4" value="${esc(v.antal ?? '')}"><span class="enhet">${esc(enhet)}</span></span>`);
  }
  return delar.join(' ');
}

const tabell = (lista, svar) => `<div class="tabellrulle"><table class="tabell tobak-tabell">
  <thead><tr><th scope="col">Produkt</th>${BRUKVAL.map(([, t]) => `<th scope="col">${esc(t)}</th>`).join('')}<th scope="col">Hur mycket</th></tr></thead>
  <tbody>${lista.map(p => produktRad(p, svar.produkter?.[p.id])).join('')}</tbody></table></div>`;

// Hela formulärets innehåll. svar är tidigare svar (ett utkast eller en rättelse).
export function falt(svar = {}) {
  const vanliga = R.PRODUKTER.filter(p => !p.fler);
  const fler = R.PRODUKTER.filter(p => p.fler);
  const merOppen = fler.some(p => svar.produkter?.[p.id]?.bruk);
  return `<div class="tobak" data-tobak>
    <fieldset class="kryssgrupp tobak-niva1"><legend>Använder patienten, eller har patienten använt, tobak eller nikotin?</legend>
      ${R.ANVANDER.map(([v, t]) => `<div class="kryssfalt"><input type="radio" id="${id('anv', v)}" name="tb-anvander" value="${v}"${svar.anvander === v ? ' checked' : ''}><label for="${id('anv', v)}">${esc(t)}</label></div>`).join('')}
    </fieldset>
    <fieldset class="tobak-niva2"><legend>Användning per produkt</legend>
      <p class="hjalp">Fyll i det som patienten använder. Systemet sätter då själv svaret Ja ovan.</p>
      ${tabell(vanliga, svar)}
      <details class="tobak-fler"${merOppen ? ' open' : ''}><summary>Fler produkter: vattenpipa, nikotinläkemedel och andra</summary>${tabell(fler, svar)}</details>
    </fieldset>
    <div class="tobak-forslag" data-tobak-forslag aria-live="polite"></div>
    <div class="falt"><label for="tb-kommentar">Kommentar</label><textarea id="tb-kommentar" name="tb-kommentar" rows="2" maxlength="${R.KOMMENTAR_MAX}">${esc(svar.kommentar ?? '')}</textarea></div>
    <p class="under-text">Frågorna följer ${esc(R.KALLA.fragor)}. Förslaget på stöd följer ${esc(R.KALLA.riktlinjer)}.</p>
  </div>`;
}

// Läser svaren ur formuläret.
export function las(el) {
  const yta = el.querySelector('[data-tobak]');
  const produkter = {};
  for (const rad of yta.querySelectorAll('[data-produkt]')) {
    const bruk = rad.querySelector('input[type="radio"]:checked')?.value;
    if (!bruk) continue;
    const v = { bruk };
    const antal = rad.querySelector('[name="antal"]')?.value.trim();
    if (antal) v.antal = antal;
    const slut = rad.querySelector('[name="slutdatum"]')?.value;
    if (slut) v.slutdatum = slut;
    const vad = rad.querySelector('[name="vad"]')?.value.trim();
    if (vad != null) v.vad = vad;
    produkter[rad.dataset.produkt] = v;
  }
  const anvander = yta.querySelector('[name="tb-anvander"]:checked')?.value ?? null;
  return {
    anvander: Object.keys(produkter).length ? 'ja' : anvander, produkter,
    stod: yta.querySelector('[name="tb-stod"]:checked')?.value ?? null,
    givet: Boolean(yta.querySelector('[name="tb-givet"]')?.checked),
    kommentar: yta.querySelector('[name="tb-kommentar"]').value,
  };
}

function forslagHtml(svar, alder) {
  if (svar.anvander == null) return '';
  const f = R.forslag(svar, { alder });
  if (!f.kod) return `<p class="ruta ruta-info liten">${esc(f.motivering)}</p>`;
  return `<div class="ruta ruta-info">
    <p><strong>Systemet föreslår: ${esc(f.atgard)} (KVÅ ${esc(f.kod)}).</strong> ${esc(f.motivering)}</p>
    <fieldset class="kryssgrupp tobak-stod"><legend>Stödet</legend>${R.STOD.map(([v, t]) => `<div class="kryssfalt"><input type="radio" id="${id('stod', v)}" name="tb-stod" value="${v}"${svar.stod === v ? ' checked' : ''}><label for="${id('stod', v)}">${esc(t)}</label></div>`).join('')}</fieldset>
    <div class="kryssfalt"${svar.stod === 'accepterat' ? '' : ' hidden'} data-givet><input type="checkbox" id="tb-givet" name="tb-givet"${svar.givet ? ' checked' : ''}><label for="tb-givet">Samtalet hölls vid besöket. Systemet registrerar åtgärden med koden när du signerar.</label></div>
  </div>`;
}

// Kopplar händelserna. alder är patientens ålder, som systemet vet.
export function koppla(el, { alder = null, svar = {} } = {}) {
  const yta = el.querySelector('[data-tobak]');
  const forslag = yta.querySelector('[data-tobak-forslag]');
  const rita = () => {
    const s = las(el);
    // Förslaget ritas om bara när det ändras, så att valet av stöd står kvar.
    const nyckel = JSON.stringify([s.anvander, R.forslag(s, { alder }).kod]);
    if (forslag.dataset.nyckel === nyckel) {
      const givet = forslag.querySelector('[data-givet]');
      if (givet) givet.hidden = s.stod !== 'accepterat';
      return;
    }
    forslag.dataset.nyckel = nyckel;
    forslag.innerHTML = forslagHtml(s, alder);
  };
  forslag.innerHTML = forslagHtml({ ...svar, anvander: svar.anvander ?? null }, alder);
  forslag.dataset.nyckel = JSON.stringify([svar.anvander ?? null, svar.anvander ? R.forslag(svar, { alder }).kod : null]);
  yta.addEventListener('change', (e) => {
    const t = e.target;
    const rad = t.closest('[data-produkt]');
    if (rad && t.type === 'radio') {
      const p = R.PRODUKT[rad.dataset.produkt];
      const mer = rad.querySelector('[data-mer]');
      const forra = { antal: mer.querySelector('[name="antal"]')?.value, vad: mer.querySelector('[name="vad"]')?.value };
      mer.innerHTML = merFalt(p, { bruk: t.value, ...forra });
      // Systemet sätter själv svaret Ja när en produkt är ifylld, och fokus flyttas till antalet.
      if (t.value) {
        yta.querySelector(`#${id('anv', 'ja')}`).checked = true;
        mer.querySelector('[name="vad"], [name="antal"]')?.focus();
      }
    }
    if (t.name === 'tb-anvander' && t.value !== 'ja') {
      for (const r of yta.querySelectorAll('[data-produkt]')) {
        const nej = r.querySelector('input[type="radio"][value=""]');
        if (!nej.checked) { nej.checked = true; r.querySelector('[data-mer]').innerHTML = ''; }
      }
    }
    rita();
  });
}
