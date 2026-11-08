// Tidboken per mottagning och vårdgivare en dag: tider, tidstyp, vem som har tiden och beläggningen. Ingen behöver
// boka härifrån, eftersom systemet föreslår tiderna, men här syns hela dagen. Med Visa utan namn visas bara att en tid
// är upptagen, till exempel på en skärm som andra kan se.
import { esc, api, vyRubrik, notis, felNotis, dialog } from '../ui.js';
import { patientCell } from './arbetslista.js';
import { valjTid, tidText, kl } from '../tidbok-ui.js';
// Runda 6, r4: resursernas arbetslista, bokningsmallarna och anpassning av vyn. Läkare och sjuksköterskor läser
// tidboken, med sitt eget schema som förval, men bokar inte.
import { far } from '../app.js';
import { anpassaVy } from '../planering-ui.js';
// Runda 10, r7: möteslänk, uppringning och inbjudan för en bokning (kontorsstödet).
import { kontorsstodBokning } from './r10r7.js';

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
    <p class="dampad liten tb-vy">${t.vy?.vardgivare === 'mina' ? 'Visar ditt schema.' : Array.isArray(t.vy?.vardgivare) ? 'Visar de vårdgivare du har valt.' : 'Visar alla vårdgivare.'} <button type="button" class="knapp text liten" data-tb="anpassa">Anpassa vyn</button></p>
    <div class="tb-scheman">${t.scheman.map(s => `<section class="ov-sektion tb-schema" aria-labelledby="tb-${esc(s.id)}">
      <div class="sektion-huvud"><h2 id="tb-${esc(s.id)}">${esc(s.vardgivare.namn)}</h2><p class="dampad liten">${esc(s.yrkesrollText)}, ${esc(s.mottagning.namn)}. ${esc(s.belaggning.bokade)} av ${esc(s.belaggning.tider)} tider bokade.</p></div>
      ${s.tider.length ? `<ul class="tb-tider">${s.tider.map(x => tidRad(x, anon)).join('')}</ul>` : '<p class="tom liten">Inga tider den här dagen.</p>'}
    </section>`).join('') || '<p class="tom">Inga vårdgivare att visa. Välj Anpassa vyn.</p>'}</div>
    ${resurserHtml(t)}${mallarHtml(t)}</div>`;
  main.querySelector('#tidbok').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tb]');
    if (!b) return;
    try {
      if (b.dataset.tb === 'anpassa') { if (!(await anpassaVy('tidbok'))) return; } else await atgard(b, t);
      await visa(main, _p, q, ctx);
    } catch (err) { felNotis(err); }
  });
}

// Runda 6, r4: lokaler, utrustning och sjukresor med dagens bokningar, som en arbetslista per resurs.
function resurserHtml(t) {
  if (!t.resurser?.length) return '';
  return `<section class="ov-sektion" aria-labelledby="tb-resurser"><div class="sektion-huvud"><h2 id="tb-resurser">Lokaler, utrustning och sjukresor</h2></div>
    <div class="tb-scheman">${t.resurser.map(r => `<div class="tb-resurs"><h3>${esc(r.namn)} <span class="tagg">${esc(r.typText ?? '')}</span>${r.demo ? ' <span class="tagg">Simulerad</span>' : ''}</h3>
      ${r.bokningar.length ? `<ul class="tb-tider">${r.bokningar.map(b => `<li class="tb-upptagen"><span class="tb-klocka">${esc(kl(b.start))}</span><span class="tb-typ">${esc(b.text)}</span><span class="tb-vem">${b.patient ? patientCell(b.patient, `#/patient/${encodeURIComponent(b.patient.id)}`) : `<span class="dampad">Till ${esc(kl(b.slut))}</span>`}</span></li>`).join('')}</ul>` : '<p class="tb-ledig liten">Ledig hela dagen.</p>'}</div>`).join('')}</div>
    <p class="hjalp">Systemet bokar lokal, utrustning och sjukresa samtidigt som tiden och föreslår bara tider då allt är ledigt. Sjukresorna är simulerade.</p></section>`;
}
function mallarHtml(t) {
  if (!t.mallar?.length) return '';
  return `<section class="ov-sektion" aria-labelledby="tb-mallar"><div class="sektion-huvud"><h2 id="tb-mallar">Bokningsmallar</h2></div>
    <ul class="enkel-lista">${t.mallar.map(m => `<li><strong>${esc(m.namn)}</strong><span class="under-text">${esc(m.forklaring)}</span></li>`).join('')}</ul></section>`;
}

function tidRad(x, anon) {
  const upptagen = x.bokade >= x.platser;
  const grupp = x.platser > 1 ? ` <span class="dampad">${esc(x.bokade)} av ${esc(x.platser)} platser</span>` : '';
  const vem = anon ? (upptagen ? '<span class="dampad">Upptagen</span>' : '<span class="tb-ledig">Ledig</span>')
    : x.bokningar.length ? x.bokningar.map(b => `<span class="tb-bokning">${patientCell(b.patient, `#/patient/${encodeURIComponent(b.patient.id)}`)} <span class="tagg${b.status === 'incheckad' ? ' tagg-pagaende' : ''}">${esc(b.statusText)}</span>${b.styrLakemedel ? ' <span class="tagg" title="' + esc(b.styrLakemedel) + '">Styr en läkemedelsdos</span>' : ''}
      ${b.resurser?.length ? `<span class="under-text">${esc(b.resurser.map(r => r.namn).join(', '))}</span>` : ''}${b.kedja ? ` <span class="tagg">${esc(b.kedja.roll === 'fore' ? 'Före läkarbesöket' : 'Med provtagning före')}</span>` : ''}
      ${b.status === 'bokad' && x.platser === 1 && far('boka') && b.kedja?.roll !== 'fore' ? `<button type="button" class="knapp text liten" data-tb="omboka" data-id="${b.id}">Boka om</button><button type="button" class="knapp text liten" data-tb="avboka" data-id="${b.id}">Avboka</button>` : ''}${['bokad', 'incheckad'].includes(b.status) && x.platser === 1 ? `<button type="button" class="knapp text liten" data-tb="kontorsstod" data-id="${b.id}">Kontorsstöd</button>` : ''}</span>`).join('')
      : '<span class="tb-ledig">Ledig</span>';
  return `<li class="${upptagen ? 'tb-upptagen' : 'tb-fri'}"><span class="tb-klocka">${esc(kl(x.start))}</span><span class="tb-typ">${esc(x.rubrik ?? x.tidstypText)}${grupp}</span><span class="tb-vem">${vem}</span></li>`;
}

// Ombokning och avbokning, också från patientens översikt.
export async function ombokaBokning(id, namn) {
  const f = await api(`/api/bokning/${id}/forslag`);
  // En planerad vårdhändelse: dialogen säger att tiden styr en läkemedelsdos, aldrig vilket läkemedel (runda 5, r1).
  const styr = f.bokning.styrLakemedel ? `</p><p class="ruta ruta-info liten">${esc(f.bokning.styrLakemedel)}` : '';
  const tidId = await valjTid({ rubrik: `Boka om ${namn}`, text: `Nu: ${esc(tidText(f.bokning.tid.start))}, ${esc(f.bokning.tid.tidstypText)} hos ${esc(f.bokning.tid.vardgivare?.namn ?? '')}. Patienten får en ny kallelse av sig själv.${styr}`, forslag: f.forslag, demoregler: f.demoregler });
  if (!tidId) return null;
  const r = await api(`/api/bokning/${id}/omboka`, { metod: 'POST', data: { tidId } });
  notis(`Tiden är ombokad till ${tidText(r.tid.start)}. En ny kallelse är skickad.`);
  return r;
}

export async function avbokaBokning(id, namn, styrLakemedel = null) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Avboka tiden för ${esc(namn)}</h2>
    <div class="dialog-text"><p>Patienten får ett besked om avbokningen av sig själv. Står patienten på väntelistan läggs hen tillbaka där.</p>${styrLakemedel ? `<p class="ruta ruta-info liten">${esc(styrLakemedel)} Avbokas tiden väntar dosen tills vårdhändelsen har fått en ny tid.</p>` : ''}</div>
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
  else if (b.dataset.tb === 'avboka') await avbokaBokning(bok.id, bok.patient.namn, bok.styrLakemedel);
  else if (b.dataset.tb === 'kontorsstod') await kontorsstodBokning(bok.id);
}
