// Tidboken per mottagning och vårdgivare en dag: tider, tidstyp, vem som har tiden och beläggningen. Ingen behöver
// boka härifrån, eftersom systemet föreslår tiderna, men här syns hela dagen. Med Visa utan namn visas bara att en tid
// är upptagen, till exempel på en skärm som andra kan se.
import { esc, api, vyRubrik, notis, felNotis, dialog } from '../ui.js';
import { patientCell } from './arbetslista.js';
import { valjTid, tidText, kl } from '../tidbok-ui.js';

export const namn = 'tidbok';

const dagPlus = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const lank = (d, anon) => `#/tidbok?datum=${d}${anon ? '&utan=namn' : ''}`;

export async function visa(main, _p, q, ctx = {}) {
  const anon = q.get('utan') === 'namn';
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(q.get('datum') ?? '') ? q.get('datum') : null;
  const t = await api(`/api/tidbok?${datum ? `datum=${datum}&` : ''}${anon ? 'avidentifierad=1' : ''}`);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const d = t.datum;
  const dag = new Date(`${d}T12:00:00Z`).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const oppna = t.regler.filter(r => r.egenbokning).map(r => r.text.toLowerCase());
  main.innerHTML = vyRubrik('Tidbok', `${esc(t.vardenhet.namn)}, ${esc(dag)}.`) + `<div id="tidbok">
    <nav class="knapprad" aria-label="Välj dag">
      <a class="knapp liten sekundar" href="${lank(dagPlus(d, -1), anon)}">Föregående dag</a>
      <a class="knapp liten sekundar" href="${lank(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }), anon)}">I dag</a>
      <a class="knapp liten sekundar" href="${lank(dagPlus(d, 1), anon)}">Nästa dag</a>
      <a class="knapp liten text" href="${lank(d, !anon)}">${anon ? 'Visa med namn' : 'Visa utan namn'}</a>
    </nav>
    ${oppna.length ? `<p class="hjalp">Patienterna kan själva boka, boka om och avboka ${esc(oppna.join(' och '))} i Min journal fram till 24 timmar före (demoregel).</p>` : ''}
    ${anon ? '<p class="ruta ruta-info liten">Tidboken visas utan patientuppgifter. Den visar bara vilka tider som är upptagna.</p>' : ''}
    <div class="tb-scheman">${t.scheman.map(s => `<section class="ov-sektion tb-schema" aria-labelledby="tb-${esc(s.id)}">
      <div class="sektion-huvud"><h2 id="tb-${esc(s.id)}">${esc(s.vardgivare.namn)}</h2><p class="dampad liten">${esc(s.yrkesrollText)}, ${esc(s.mottagning.namn)}. ${esc(s.belaggning.bokade)} av ${esc(s.belaggning.tider)} tider bokade.</p></div>
      ${s.tider.length ? `<ul class="tb-tider">${s.tider.map(x => tidRad(x, anon)).join('')}</ul>` : '<p class="tom liten">Inga tider den här dagen.</p>'}
    </section>`).join('')}</div></div>`;
  main.querySelector('#tidbok').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tb]');
    if (!b) return;
    try { await atgard(b, t); await visa(main, _p, q, ctx); } catch (err) { felNotis(err); }
  });
}

function tidRad(x, anon) {
  const upptagen = x.bokade >= x.platser;
  const grupp = x.platser > 1 ? ` <span class="dampad">${esc(x.bokade)} av ${esc(x.platser)} platser</span>` : '';
  const vem = anon ? (upptagen ? '<span class="dampad">Upptagen</span>' : '<span class="tb-ledig">Ledig</span>')
    : x.bokningar.length ? x.bokningar.map(b => `<span class="tb-bokning">${patientCell(b.patient, `#/patient/${encodeURIComponent(b.patient.id)}`)} <span class="tagg${b.status === 'incheckad' ? ' tagg-pagaende' : ''}">${esc(b.statusText)}</span>
      ${b.status === 'bokad' && x.platser === 1 ? `<button type="button" class="knapp text liten" data-tb="omboka" data-id="${b.id}">Boka om</button><button type="button" class="knapp text liten" data-tb="avboka" data-id="${b.id}">Avboka</button>` : ''}</span>`).join('')
      : '<span class="tb-ledig">Ledig</span>';
  return `<li class="${upptagen ? 'tb-upptagen' : 'tb-fri'}"><span class="tb-klocka">${esc(kl(x.start))}</span><span class="tb-typ">${esc(x.rubrik ?? x.tidstypText)}${grupp}</span><span class="tb-vem">${vem}</span></li>`;
}

// Ombokning och avbokning, också från patientens översikt.
export async function ombokaBokning(id, namn) {
  const f = await api(`/api/bokning/${id}/forslag`);
  const tidId = await valjTid({ rubrik: `Boka om ${namn}`, text: `Nu: ${esc(tidText(f.bokning.tid.start))}, ${esc(f.bokning.tid.tidstypText)} hos ${esc(f.bokning.tid.vardgivare?.namn ?? '')}. Patienten får en ny kallelse av sig själv.`, forslag: f.forslag, demoregler: f.demoregler });
  if (!tidId) return null;
  const r = await api(`/api/bokning/${id}/omboka`, { metod: 'POST', data: { tidId } });
  notis(`Tiden är ombokad till ${tidText(r.tid.start)}. En ny kallelse är skickad.`);
  return r;
}

export async function avbokaBokning(id, namn) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Avboka tiden för ${esc(namn)}</h2>
    <div class="dialog-text"><p>Patienten får ett besked om avbokningen av sig själv. Står patienten på väntelistan läggs hen tillbaka där.</p></div>
    <div class="falt"><label for="ab-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><input id="ab-orsak" name="orsak" required maxlength="120" autocomplete="off"></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avboka</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return null;
  await api(`/api/bokning/${id}/avboka`, { metod: 'POST', data: { orsak: svar.data.orsak } });
  notis('Tiden är avbokad och patienten har fått besked.');
  return true;
}

async function atgard(b, t) {
  const bok = t.scheman.flatMap(s => s.tider).flatMap(x => x.bokningar).find(x => String(x.id) === b.dataset.id);
  if (!bok) return;
  if (b.dataset.tb === 'omboka') await ombokaBokning(bok.id, bok.patient.namn);
  else if (b.dataset.tb === 'avboka') await avbokaBokning(bok.id, bok.patient.namn);
}
