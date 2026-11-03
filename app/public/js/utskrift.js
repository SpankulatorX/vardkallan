// Utskrift av journalen (Sussa 3.1.9). Systemet föreslår syftet och delarna ur sammanhanget, och utskriften innehåller
// bara det som servern lämnar ut till den inloggade. Utskriften visas som en utskriftsvänlig sida med utskrifts-id på
// varje sida, och webbläsarens utskriftsdialog öppnas, där den också kan sparas som PDF.
import { esc, api, dialog, notis, felNotis, tidpunkt, datum, ikon } from './ui.js';

const KON = { kvinna: 'Kvinna', man: 'Man' };

function dialogHtml(f) {
  const forsta = f.forslag[0];
  return `<h2 id="dlg-rubrik">Skriv ut journalen</h2>
    <p class="dampad">Utskriften innehåller bara det du får se. Den får ett utskrifts-id som står på varje sida, och den loggas.</p>
    <form novalidate>
      <fieldset class="valgrupp"><legend>Syfte</legend>
        ${f.forslag.map((x, i) => `<label class="val-rad"><input type="radio" name="syfte" value="${esc(x.id)}"${i === 0 ? ' checked' : ''}><span>${esc(x.syfte)}<span class="under-text">${esc(x.skal)}</span></span></label>`).join('')}
        <label class="val-rad"><input type="radio" name="syfte" value="annat"><span>Annat syfte</span></label>
        <div class="falt" data-annat hidden><label for="ut-annat">Syftet med utskriften</label><input id="ut-annat" name="annat" maxlength="200" autocomplete="off"></div>
      </fieldset>
      <fieldset class="valgrupp"><legend>Ta med</legend>
        ${f.delar.map(d => `<label class="val-rad"><input type="checkbox" name="del" value="${esc(d.id)}"${forsta.delar.includes(d.id) ? ' checked' : ''}><span>${esc(d.rubrik)}</span></label>`).join('')}
        ${f.ingarInte.length ? `<p class="dampad liten">Ingår inte för din yrkesroll: ${esc(f.ingarInte.join(', '))}.</p>` : ''}
      </fieldset>
      <label class="val-rad" data-utlamnas-rad><input type="checkbox" name="utlamnas"${forsta.utlamnasTill ? ' checked' : ''}><span>Kopian lämnas ut till patienten<span class="under-text">Registreras som utlämnad journalhandling, med vem och när.</span></span></label>
      <label class="val-rad"><input type="checkbox" name="avidentifierad"><span>Utan namn och personnummer<span class="under-text">För granskning eller undervisning. Fritexten kan ändå peka ut patienten.</span></span></label>
      <p class="dialog-fel" role="alert" hidden></p>
    </form>
    <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp" data-varde="ok">${ikon.logg}<span>Skriv ut</span></button></div>`;
}

// Öppnar dialogen och skriver ut. Returnerar utskriften, eller null om den avbröts.
export async function skrivUt(patientId) {
  let f;
  try { f = await api(`/api/patient/${encodeURIComponent(patientId)}/utskrift/forslag`); } catch (e) { felNotis(e); return null; }
  let val = null;
  const svar = await dialog(dialogHtml(f), {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      const form = dl.querySelector('form');
      form.addEventListener('change', (e) => {
        if (e.target.name !== 'syfte') {
          if (e.target.name === 'avidentifierad' && e.target.checked) form.utlamnas.checked = false;
          return;
        }
        const x = f.forslag.find(y => y.id === e.target.value);
        dl.querySelector('[data-annat]').hidden = e.target.value !== 'annat';
        if (x) {
          for (const c of form.querySelectorAll('[name="del"]')) c.checked = x.delar.includes(c.value);
          form.utlamnas.checked = Boolean(x.utlamnasTill);
        } else form.annat.focus();
      });
    },
    validera: (data, dl) => {
      const form = dl.querySelector('form');
      const delar = [...form.querySelectorAll('[name="del"]:checked')].map(c => c.value);
      if (!delar.length) return 'Välj minst en del att skriva ut.';
      const x = f.forslag.find(y => y.id === data.syfte);
      const syfte = x ? x.syfte : (data.annat ?? '').trim();
      if (syfte.length < 3) return 'Skriv syftet med utskriften.';
      if (form.utlamnas.checked && form.avidentifierad.checked) return 'En kopia till patienten skrivs ut med patientens namn och personnummer.';
      val = { syfte, delar, utlamnasTill: form.utlamnas.checked ? 'Patienten' : null, avidentifierad: form.avidentifierad.checked };
      return null;
    },
  });
  if (!svar || !val) return null;
  let u;
  try { u = await api(`/api/patient/${encodeURIComponent(patientId)}/utskrift`, { metod: 'POST', data: val }); } catch (e) { felNotis(e); return null; }
  notis(`Utskriften är registrerad med id ${u.id}${u.utlamnande ? ' och som utlämnad till patienten' : ''}.`);
  visa(u);
  return u;
}

const rad = (r) => `<li><div class="ut-rad"><strong>${esc(r.rubrik)}</strong><span class="dampad">${esc(r.tid ? (r.tid.length > 10 ? tidpunkt(r.tid) : datum(r.tid)) : '')}${r.enhet ? `, ${esc(r.enhet)}` : ''}</span></div>
  ${r.text ? `<p>${esc(r.text)}</p>` : ''}
  ${r.sokord?.length ? `<dl class="sokord">${r.sokord.map(s => `<div><dt>${esc(s.sokord)}</dt><dd>${esc(s.text)}</dd></div>`).join('')}</dl>` : ''}</li>`;

// Utskriftssidan. Den täcker appen och har egna knappar, som inte kommer med på papperet.
export function visa(u) {
  document.querySelector('.utskrift-ram')?.remove();
  const el = document.createElement('div');
  el.className = 'utskrift-ram';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'utskrift-rubrik');
  const p = u.patient;
  el.innerHTML = `<div class="utskrift-verktyg"><p>Utskrift ${esc(u.id)}. Välj Skriv ut, eller Spara som PDF i webbläsarens utskriftsdialog.</p>
      <div class="knapprad"><button type="button" class="knapp" data-skriv-ut>${ikon.logg}<span>Skriv ut</span></button><button type="button" class="knapp sekundar" data-stang>Stäng</button></div></div>
    <article class="utskrift" data-utskrift-id="${esc(u.id)}">
      <header class="utskrift-huvud">
        <p class="utskrift-vardgivare">${esc(u.vardgivare)}, Vårdkällan (demo)</p>
        <h1 id="utskrift-rubrik" tabindex="-1">Journalutskrift</h1>
        <dl class="utskrift-fakta">
          <div><dt>Patient</dt><dd>${esc(p.namn)}${p.personnummer ? `, <span class="pnr">${esc(p.personnummer)}</span>` : ''}, ${esc(p.alder)} år, ${esc(KON[p.kon] ?? '')}</dd></div>
          <div><dt>Utskriven</dt><dd>${esc(tidpunkt(u.tid))} av ${esc(u.av.namn)}, ${esc(u.av.titel ?? '')}, ${esc(u.av.enhet)}</dd></div>
          <div><dt>Syfte</dt><dd>${esc(u.syfte)}</dd></div>
          <div><dt>Innehåll</dt><dd>${esc(u.delar.join(', '))}</dd></div>
          <div><dt>Utskrifts-id</dt><dd><strong>${esc(u.id)}</strong> <span class="dampad">Kontrollsumma ${esc(u.kontrollsumma.slice(0, 16))}</span></dd></div>
          ${u.utlamnande ? `<div><dt>Utlämnad</dt><dd>Till ${esc(u.utlamnande.mottagare)} ${esc(tidpunkt(u.utlamnande.utlamnad))}</dd></div>` : ''}
        </dl>
      </header>
      ${u.utelamnat.length ? `<section class="utskrift-utelamnat" aria-labelledby="ut-ute"><h2 id="ut-ute">Det här finns inte med</h2><ul>${u.utelamnat.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
      ${u.sektioner.map(s => `<section class="utskrift-del" aria-labelledby="ut-${esc(s.id)}"><h2 id="ut-${esc(s.id)}">${esc(s.rubrik)}</h2>${s.rader.length ? `<ul>${s.rader.map(rad).join('')}</ul>` : '<p class="dampad">Inga uppgifter.</p>'}</section>`).join('')}
      <footer class="utskrift-sidfot">Utskrifts-id ${esc(u.id)}, ${esc(p.namn)}${p.personnummer ? ` ${esc(p.personnummer)}` : ''}, utskriven ${esc(tidpunkt(u.tid))}. Utskriften är en kopia ur journalen och uppdateras inte.</footer>
    </article>`;
  document.body.append(el);
  document.body.classList.add('skriver-ut');
  const forra = document.activeElement;
  const stang = () => { el.remove(); document.body.classList.remove('skriver-ut'); window.removeEventListener('hashchange', stang); if (forra?.isConnected) forra.focus(); };
  el.querySelector('[data-stang]').addEventListener('click', stang);
  el.querySelector('[data-skriv-ut]').addEventListener('click', () => window.print());
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') stang(); });
  window.addEventListener('hashchange', stang);
  el.querySelector('h1').focus();
  // Webbläsarens utskriftsdialog öppnas direkt. I ett automatiskt test finns ingen skrivare, och då hoppas den över.
  if (!navigator.webdriver) setTimeout(() => window.print(), 50);
}
