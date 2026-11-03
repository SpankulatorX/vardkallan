// Gemensamt för tidboken i gränssnittet: förslagen på tider, betalningen och omprioriteringen. Systemet föreslår
// tiderna, och vårdadministratören eller patienten väljer med ett klick. Ingen behöver leta i en kalender.
import { esc, dialog, ikon } from './ui.js';

const TZ = 'Europe/Stockholm';
export const dagText = (t) => new Date(t).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
export const kl = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', '.');
export const tidText = (t) => `${dagText(t)} kl. ${kl(t)}`;
export const dagar = (n) => `${n} ${Math.abs(n) === 1 ? 'dag' : 'dagar'}`;
export const kr = (n) => `${Number(n).toLocaleString('sv-SE')} kr`;

const forslagKnapp = (f, i) => `<li><button type="button" class="forslag-knapp${i === 0 ? ' forst' : ''}" data-varde="tid:${f.tidId}" data-tid="${f.tidId}">
  <span class="forslag-tid">${ikon.klocka}<strong>${esc(tidText(f.start))}</strong></span>
  <span class="forslag-vem">${esc(f.tidstypText)} hos ${esc(f.vardgivare?.namn ?? '')}${f.mottagning ? `, ${esc(f.mottagning.namn)}` : ''}</span>
  ${f.skal?.length ? `<span class="forslag-skal">${esc(f.skal.join(' '))}</span>` : ''}
  <span class="forslag-valj">Boka</span>
</button></li>`;

// Visar systemets förslag i en dialog och returnerar den valda tidens id, eller null.
export async function valjTid({ rubrik, text = '', forslag, demoregler = '' }) {
  const html = `<h2 id="dlg-rubrik">${esc(rubrik)}</h2>
    <div class="dialog-text">${text ? `<p>${text}</p>` : ''}<p>Systemet har valt de lämpligaste tiderna. Välj en så är den bokad.</p></div>
    ${forslag.length ? `<ol class="forslag-lista">${forslag.map(forslagKnapp).join('')}</ol>` : '<p class="ruta ruta-info">Det finns ingen ledig tid som passar. Ring mottagningen eller lägg en bevakning.</p>'}
    ${demoregler ? `<p class="hjalp">${esc(demoregler)}</p>` : ''}
    <div class="knapprad"><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`;
  const svar = await dialog(html, { klass: 'dialog-bred' });
  return svar?.val?.startsWith('tid:') ? Number(svar.val.slice(4)) : null;
}

// Betalning av patientavgiften. Systemet har räknat avgiften. Kort och faktura är simulerade.
export async function valjBetalsatt(avgift, namn) {
  const svar = await dialog(`<h2 id="dlg-rubrik">Ta betalt</h2>
    <div class="dialog-text"><p>${esc(namn)} ska betala <strong>${esc(kr(avgift.belopp))}</strong>.</p><p class="hjalp">${esc(avgift.text)}</p>
    <p class="hjalp">Betalningen är simulerad i demon. Inga pengar dras och ingen faktura skickas.</p></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="kort">Betalt med kort</button><button type="button" class="knapp sekundar" data-varde="faktura">Skicka faktura</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div>`);
  return svar?.val ?? null;
}

const PRIO = [['hog', 'Hög'], ['normal', 'Normal'], ['lag', 'Låg']];
// Omprioritering: ny prioritet och orsak med varsitt klick. Systemet föreslår orsakerna.
export async function valjPrioritet(post, orsaker) {
  let prio = post.prioritet === 'hog' ? 'normal' : 'hog';
  let orsak = null;
  const svar = await dialog(`<h2 id="dlg-rubrik">Ändra prioritet</h2>
    <div class="dialog-text"><p>${esc(post.patient.namn)}, ${esc(post.orsak)}. Prioriteten är ${esc(post.prioritetText.toLowerCase())}.</p></div>
    <div class="falt"><span class="etikett" id="pr-ny">Ny prioritet</span><div class="segment knappval" role="group" aria-labelledby="pr-ny" data-grupp="prio">
      ${PRIO.map(([k, t]) => `<button type="button" data-val="${k}" aria-pressed="${k === prio}"${k === post.prioritet ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div></div>
    <div class="falt"><span class="etikett" id="pr-orsak">Orsak</span><div class="knappval-lista" role="group" aria-labelledby="pr-orsak" data-grupp="orsak">
      ${Object.entries(orsaker).map(([k, t]) => `<button type="button" class="knapp sekundar liten" data-val="${k}" aria-pressed="false">${esc(t)}</button>`).join('')}</div></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`, {
    onOpen: (dl) => dl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-grupp] button[data-val]');
      if (!b) return;
      const g = b.closest('[data-grupp]');
      for (const x of g.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      if (g.dataset.grupp === 'prio') prio = b.dataset.val; else orsak = b.dataset.val;
    }),
    validera: () => (!orsak ? 'Välj orsaken till ändringen.' : null),
  });
  return svar?.val === 'ok' ? { prioritet: prio, orsak } : null;
}

// Gränsen mot vårdgarantin eller måldatumet, med varning när den är nära eller passerad.
export function gransHtml(g) {
  if (!g) return '<span class="dampad">Ingen gräns</span>';
  const text = g.dagarKvar < 0 ? `${dagar(-g.dagarKvar)} efter gränsen` : g.dagarKvar === 0 ? 'Gränsen är i dag' : `${dagar(g.dagarKvar)} kvar`;
  return `${g.risk ? `<span class="tagg tagg-larm">${ikon.varning}${esc(text)}</span>` : esc(text)}<span class="under-text">${esc(g.text)}</span>`;
}

export const kallelseHtml = (k) => `<div class="kallelse"><p class="kallelse-huvud"><strong>${esc({ kallelse: 'Kallelse', paminnelse: 'Påminnelse', ombokning: 'Ny tid', avbokning: 'Avbokning' }[k.typ] ?? 'Kallelse')}</strong>
  ${k.kanalText ?? k.kanal ? `<span class="tagg">${esc(k.kanalText ?? k.kanal)}${k.simulerad ? ', simulerat' : ''}</span>` : ''}</p>
  <p class="kallelse-text">${esc(k.text)}</p>${k.forklaring ? `<p class="hjalp">${esc(k.forklaring)}</p>` : ''}</div>`;
