// Bilder och media i journalen (runda 11, r5, Sussa 4.2.1.1 till 4.2.1.4). Galleriet med miniatyrer som servern gör,
// förstoring med annoteringar, jämförelse över tid per kroppsställe, film och ljud, import från fil, kameran, en
// simulerad medicinteknisk apparat och en simulerad annan vårdgivare, med granskning före journalen, och studierna i
// det simulerade multimediaarkivet.
//
// Systemet är experten: typen, tiden och längden läses ur filen, bilden knyts till vårdkontakten, kroppsstället föreslås
// ur patientens tidigare bilder, och den som granskar en import ser direkt om apparatens patient stämmer med journalen.
import { esc, api, tidpunkt, datum, notis, medKnapp, ikon, tal, dialog, plural } from '../ui.js';
import { skicka, kamera, visaBild, visaStudie } from '../bildvisare.js';

const SLAG = { bild: 'Bild', video: 'Film', ljud: 'Ljud', dokument: 'Dokument' };
const SPARAD = { bild: 'Bilden är sparad', video: 'Filmen är sparad', ljud: 'Ljudet är sparat', dokument: 'Dokumentet är sparat' };
const pid = (ctx) => encodeURIComponent(ctx.id);
let urval = { stalle: '', slag: '', kalla: '' };

const langd = (b) => (b.egenskaper?.langdSek ? ` ${tal(b.egenskaper.langdSek, 1)} s` : '');
const altText = (b) => `${SLAG[b.slag]}${b.kroppsstalle ? ` av ${b.kroppsstalle}` : ''}, ${datum(b.tagen)}${b.beskrivning ? `. ${b.beskrivning}` : ''}`;

function kort(b) {
  return `<li class="bm-kort" id="bm-${b.id}">
    <button type="button" class="bm-oppna" data-oppna="${b.id}" aria-label="${esc(`Öppna ${altText(b)}`)}">
      <img src="${esc(b.miniatyr)}" alt="" loading="lazy" width="256" height="192">
      ${b.slag !== 'bild' ? `<span class="tagg bm-slag">${esc(SLAG[b.slag])}${esc(langd(b))}</span>` : ''}
      ${b.annoteringar?.length ? `<span class="tagg bm-antal-ann">${esc(plural(b.annoteringar.length, 'annotering', 'annoteringar'))}</span>` : ''}
    </button>
    <p class="bm-text"><strong>${esc(b.kroppsstalle ?? b.namn)}</strong> <span class="under-text">${esc(tidpunkt(b.tagen))}</span></p>
    <p class="under-text">${esc(b.kalla.text)}${b.ursprung ? `, ${esc(b.ursprung.vardenhet)}` : ''}${b.registrerad.av ? `, ${esc(b.registrerad.av)}` : ''}</p>
    ${b.beskrivning ? `<p class="bm-besk">${esc(b.beskrivning)}</p>` : ''}
  </li>`;
}

function granskaKort(b) {
  return `<li class="bm-kort bm-granska" id="bmg-${b.id}">
    <img src="${esc(b.miniatyr)}" alt="${esc(altText(b))}" width="256" height="192">
    <p class="bm-text"><strong>${esc(b.kalla.text)}</strong> <span class="under-text">${esc(tidpunkt(b.tagen))}</span></p>
    <p class="under-text">${esc(b.apparat ? `${b.apparat.namn}, ${b.apparat.serienummer}` : b.ursprung ? `${b.ursprung.vardenhet}, ${b.ursprung.skapadAv}` : b.registrerad.av ?? '')}${b.beskrivning ? `. ${esc(b.beskrivning)}` : ''}</p>
    <p class="ruta ${b.identitet?.stammer === false ? 'ruta-larm' : 'ruta-info'} liten">${b.identitet?.stammer === false ? ikon.varning : ikon.info}<span>${esc(b.identitet?.text ?? 'Kontrollera att bilden gäller patienten.')}</span></p>
    <div class="falt"><label for="bmg-stalle-${b.id}">Kroppsställe</label><input id="bmg-stalle-${b.id}" value="${esc(b.kroppsstalle ?? '')}" maxlength="60" autocomplete="off" list="bm-stallen"></div>
    <div class="knapprad">${b.identitet?.stammer === false ? '' : `<button type="button" class="knapp liten" data-godkann="${b.id}">För in i journalen</button>`}<button type="button" class="knapp liten sekundar" data-avvisa="${b.id}">Avvisa</button></div>
  </li>`;
}

function studieRad(s) {
  return `<li class="bm-studie-rad">
    <p><strong>${esc(s.undersokning)}</strong> <span class="tagg">${esc(s.modalitet)}</span> <span class="under-text">${esc(s.arkiv)}</span></p>
    <p class="under-text">Beställd ${esc(tidpunkt(s.bestalld.tid))} av ${esc(s.bestalld.av ?? '')}. Frågeställning: ${esc(s.fragestallning)}</p>
    ${s.status === 'besvarad' ? `<p>${esc(s.utlatande ?? '')}</p><p class="under-text">${esc(plural(s.antalBilder, 'bild', 'bilder'))}, studie ${esc(s.uid)}.</p>
      ${s.arkivet ? `<div class="knapprad"><button type="button" class="knapp liten" data-studie="${s.id}">Visa bilderna</button></div>` : ''}` : '<p class="under-text">Arkivet har inte svarat än.</p>'}
  </li>`;
}

const filtrera = (bilder) => bilder.filter(b => (!urval.stalle || b.kroppsstalle === urval.stalle) && (!urval.slag || b.slag === urval.slag) && (!urval.kalla || b.kalla.id === urval.kalla));

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${pid(ctx)}/media`);
  if (!ctx.aktuell()) return;
  const kallor = [...new Set(d.bilder.map(b => b.kalla.id))];
  const slag = [...new Set(d.bilder.map(b => b.slag))];
  if (urval.stalle && !d.kroppsstallen.includes(urval.stalle)) urval = { stalle: '', slag: '', kalla: '' };
  const synliga = filtrera(d.bilder);
  el.innerHTML = `<div class="bm-vy"><div class="flikhuvud"><h2>Bilder och media</h2><p class="dampad">Bilder, filmer, ljud och dokument i journalen och undersökningar i multimediaarkivet. Servern gör miniatyrerna, och originalet ändras aldrig.</p></div>
    <datalist id="bm-stallen">${d.kroppsstallen.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    ${d.attGranska.length ? `<section aria-labelledby="bm-granska-rubrik"><h3 id="bm-granska-rubrik">Att granska <span class="antal antal-aktiv">${d.attGranska.length}</span></h3>
      <p class="hjalp">Bilder från en apparat, en annan vårdgivare eller patientens Min journal kommer in i journalen när någon på vårdenheten har granskat dem.</p>
      ${d.attGranska.length > 1 && d.attGranska.every(b => b.identitet?.stammer !== false) ? '<div class="knapprad"><button type="button" class="knapp" data-godkann-alla>För in alla i journalen</button></div>' : ''}
      <ul class="bm-galleri">${d.attGranska.map(granskaKort).join('')}</ul></section>` : ''}
    ${d.kanSkriva ? `<form class="mv-form bm-form" id="bm-form" novalidate aria-labelledby="bm-ny">
      <h3 id="bm-ny">Lägg till i journalen</h3>
      <div class="falt-rad">
        <div class="falt"><label for="bm-fil">Fil från datorn eller mobilen</label><input id="bm-fil" name="fil" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/*,application/pdf" aria-describedby="bm-fil-h"><span class="hjalp" id="bm-fil-h">Bild, film, ljud eller PDF. Systemet läser typen, tiden och längden ur filen.</span></div>
        <div class="falt"><label for="bm-stalle">Kroppsställe</label><input id="bm-stalle" name="kroppsstalle" maxlength="60" autocomplete="off" list="bm-stallen" value="${esc(d.forslagStalle ?? '')}" aria-describedby="bm-stalle-h"><span class="hjalp" id="bm-stalle-h">${d.forslagStalle ? 'Förslaget är kroppsstället på patientens senaste bild.' : 'Till exempel vänster underben.'}</span></div>
        <div class="falt"><label for="bm-besk">Beskrivning</label><input id="bm-besk" name="beskrivning" maxlength="300" autocomplete="off"></div>
      </div>
      <p class="bm-framsteg" role="status" aria-live="polite"></p>
      <p class="form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp">Spara i journalen</button><button type="button" class="knapp sekundar" data-kamera>${ikon.plus}<span>Kameran</span></button></div>
      <details class="bm-import"><summary>Från en apparat eller en annan vårdgivare</summary>
        <div class="falt-rad"><div class="falt"><label for="bm-apparat">Apparat (simulerad)</label><select id="bm-apparat">${d.apparater.map(a => `<option value="${esc(a.id)}">${esc(a.namn)}</option>`).join('')}</select></div>
          <div class="knapprad"><button type="button" class="knapp sekundar" data-apparat>Hämta från apparaten</button></div></div>
        <p class="hjalp">${esc(d.simulerat.apparat)} Apparaten skickar bilderna med patientens personnummer ur sin arbetslista.</p>
        ${d.extern.kanHamta ? `<div class="knapprad"><button type="button" class="knapp sekundar" data-extern>Hämta från ${esc(d.extern.vardgivare)}</button></div>
        <p class="hjalp">${d.extern.samtycke ? 'Patienten har samtyckt till att uppgifter hämtas från den andra vårdgivaren.' : 'Bilderna hämtas bara om patienten samtycker.'} ${esc(d.simulerat.extern)}</p>` : ''}
      </details>
    </form>` : ''}
    <section aria-labelledby="bm-galleri-rubrik"><h3 id="bm-galleri-rubrik">I journalen <span class="antal">${d.bilder.length}</span></h3>
      ${d.bilder.length ? `<div class="falt-rad bm-urval" role="group" aria-label="Urval">
        <div class="falt"><label for="bm-u-stalle">Kroppsställe</label><select id="bm-u-stalle" data-urval="stalle"><option value="">Alla</option>${d.kroppsstallen.map(s => `<option value="${esc(s)}"${s === urval.stalle ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        ${slag.length > 1 ? `<div class="falt"><label for="bm-u-slag">Slag</label><select id="bm-u-slag" data-urval="slag"><option value="">Alla</option>${slag.map(s => `<option value="${s}"${s === urval.slag ? ' selected' : ''}>${esc(SLAG[s])}</option>`).join('')}</select></div>` : ''}
        ${kallor.length > 1 ? `<div class="falt"><label for="bm-u-kalla">Källa</label><select id="bm-u-kalla" data-urval="kalla"><option value="">Alla</option>${kallor.map(k => `<option value="${esc(k)}"${k === urval.kalla ? ' selected' : ''}>${esc(d.kallor[k])}</option>`).join('')}</select></div>` : ''}
      </div>
      ${d.kroppsstallen.filter(s => d.bilder.filter(b => b.kroppsstalle === s && b.bild).length > 1).map(s => `<button type="button" class="knapp liten sekundar" data-jamfor="${esc(s)}">Jämför bilder av ${esc(s)} över tid</button>`).join(' ')}
      <div id="bm-jamforelse" aria-live="polite"></div>
      <ul class="bm-galleri">${synliga.map(kort).join('')}</ul>${synliga.length ? '' : '<p class="tom">Inga bilder i urvalet.</p>'}`
        : '<p class="tom">Inga bilder eller filmer som du kan se.</p>'}
    </section>
    <section aria-labelledby="bm-studier-rubrik"><h3 id="bm-studier-rubrik">Multimediaarkivet <span class="antal">${d.studier.length}</span></h3>
      <p class="hjalp">${esc(d.simulerat.arkiv)} Arkivet nås genom DICOMweb, så att en extern visare kan anslutas.</p>
      ${d.studier.length ? `<ul class="bm-studier">${d.studier.map(studieRad).join('')}</ul>` : '<p class="tom">Inga undersökningar i arkivet som du kan se.</p>'}
    </section></div>`;

  const ladda = () => ctx.ladda();
  el.querySelectorAll('[data-urval]').forEach(s => s.addEventListener('change', () => { urval = { ...urval, [s.dataset.urval]: s.value }; ladda(); }));

  const vy = el.querySelector('.bm-vy');
  vy.addEventListener('click', async (e) => {
    const o = e.target.closest('[data-oppna]');
    if (o) {
      const b = d.bilder.find(x => String(x.id) === o.dataset.oppna);
      if (b.slag === 'bild') await visaBild(b, { kanAnnotera: d.kanSkriva, uppdatera: () => {} }).then(ladda);
      else spela(b);
      return;
    }
    const st = e.target.closest('[data-studie]');
    if (st) { await visaStudie(d.studier.find(x => String(x.id) === st.dataset.studie)); return; }
    const j = e.target.closest('[data-jamfor]');
    if (j) { await jamfor(el, ctx, j.dataset.jamfor); return; }
    const g = e.target.closest('[data-godkann], [data-avvisa]');
    if (g) {
      const id = g.dataset.godkann ?? g.dataset.avvisa;
      try {
        await medKnapp(g, () => api(`/api/media/${id}/granska`, { metod: 'POST', data: { godkann: Boolean(g.dataset.godkann), kroppsstalle: el.querySelector(`#bmg-stalle-${id}`)?.value.trim() || undefined } }));
        notis(g.dataset.godkann ? 'Bilden är införd i journalen.' : 'Bilden är avvisad och kommer inte in i journalen.');
        ladda();
      } catch { /* felet visas som notis */ }
      return;
    }
    const alla = e.target.closest('[data-godkann-alla]');
    if (alla) {
      try {
        await medKnapp(alla, async () => { for (const b of d.attGranska) await api(`/api/media/${b.id}/granska`, { metod: 'POST', data: { godkann: true, kroppsstalle: el.querySelector(`#bmg-stalle-${b.id}`)?.value.trim() || undefined } }); });
        notis(`${plural(d.attGranska.length, 'bild', 'bilder')} är införda i journalen.`);
        ladda();
      } catch { ladda(); }
      return;
    }
    if (e.target.closest('[data-apparat]')) {
      const b = e.target.closest('[data-apparat]');
      try {
        const r = await medKnapp(b, () => api(`/api/patient/${pid(ctx)}/media/apparat/${encodeURIComponent(el.querySelector('#bm-apparat').value)}`, { metod: 'POST', data: { kroppsstalle: el.querySelector('#bm-stalle').value.trim() || undefined } }));
        notis(r.text);
        ladda();
      } catch { /* felet visas som notis */ }
      return;
    }
    if (e.target.closest('[data-extern]')) { await extern(e.target.closest('[data-extern]'), ctx, d); return; }
    if (e.target.closest('[data-kamera]')) {
      const r = await kamera();
      if (r === null && !navigator.mediaDevices?.getUserMedia) notis('Kameran går inte att nå i den här webbläsaren. Välj en fil i stället; på en mobil kan filen tas med kameran direkt.', 'info');
      if (r) await spara(el, ctx, d, r.fil, { kalla: r.kalla, langdSek: r.langdSek });
    }
  });

  const form = el.querySelector('#bm-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fil = form.fil.files[0];
    if (!fil) { notis('Välj en fil först.', 'info'); form.fil.focus(); return; }
    await spara(el, ctx, d, fil, {});
  });
  if (ctx.sub) el.querySelector(`#bm-${Number(ctx.sub)}`)?.scrollIntoView({ block: 'center' });
}

async function spara(el, ctx, d, fil, extra) {
  const form = el.querySelector('#bm-form');
  const knapp = form.querySelector('[type=submit]');
  const plats = form.querySelector('.bm-framsteg');
  const meta = { kroppsstalle: form.kroppsstalle.value.trim() || undefined, beskrivning: form.beskrivning.value.trim() || undefined, kalla: extra.kalla ?? 'fil', langdSek: extra.langdSek };
  try {
    const m = await medKnapp(knapp, () => skicka(ctx.id, fil, meta, { granser: d.granser, framsteg: (a) => { plats.textContent = `Skickar ${Math.round(a * 100)} procent.`; } }), form);
    plats.textContent = '';
    notis(`${SPARAD[m.slag]} i journalen.${m.forminskad ? ` Bilden förminskades från ${tal(m.forminskad.fran / 1024 / 1024, 1)} MB till ${tal(m.forminskad.till / 1024 / 1024, 1)} MB så att den får plats.` : ''}`);
    ctx.ladda();
  } catch (e) { plats.textContent = ''; if (!(e?.status)) notis(e?.message ?? 'Filen kunde inte sparas.', 'fel'); }
}

// Film och ljud spelas upp i en dialog.
async function spela(b) {
  await dialog(`<form><h2 id="dlg-rubrik">${esc(altText(b))}</h2>
    ${b.slag === 'video' ? `<video controls preload="metadata" src="${esc(b.url)}" class="bm-film"></video>` : b.slag === 'ljud' ? `<audio controls preload="metadata" src="${esc(b.url)}"></audio>` : `<p><a class="knapp sekundar" href="${esc(b.url)}" target="_blank" rel="noopener">Öppna ${esc(b.namn)}</a></p>`}
    <div class="knapprad"><a class="knapp sekundar" href="${esc(b.url)}?ladda=1" download>Ladda ner</a><button type="button" class="knapp" data-varde="avbryt">Stäng</button></div></form>`, { klass: 'bm-dialog' });
}

// Bilderna av ett kroppsställe bredvid varandra i tidsordning, med dagarna från den första.
async function jamfor(el, ctx, stalle) {
  const j = await api(`/api/patient/${pid(ctx)}/media/jamforelse?kroppsstalle=${encodeURIComponent(stalle)}`);
  const plats = el.querySelector('#bm-jamforelse');
  plats.innerHTML = `<section class="bm-jamfor" aria-labelledby="bm-jamfor-rubrik"><h4 id="bm-jamfor-rubrik" tabindex="-1">Jämförelse: ${esc(j.text)}</h4>
    <ol class="bm-jamfor-rad">${j.bilder.map(b => `<li><img src="${esc(b.visning)}" alt="${esc(altText(b))}"><p><strong>${b.dagarFranForsta === 0 ? 'Första bilden' : `Dag ${b.dagarFranForsta}`}</strong> <span class="under-text">${esc(tidpunkt(b.tagen))}</span></p>${b.beskrivning ? `<p class="under-text">${esc(b.beskrivning)}</p>` : ''}</li>`).join('')}</ol>
    <button type="button" class="knapp liten sekundar" data-stang-jamfor>Stäng jämförelsen</button></section>`;
  plats.querySelector('h4').focus();
  plats.querySelector('[data-stang-jamfor]').addEventListener('click', () => { plats.innerHTML = ''; });
}

// Bilder från den andra vårdgivaren hämtas genom sammanhållen journalföring: ett aktivt val med syfte, och samtycket om
// det saknas. Syftet är förifyllt och kan ändras.
async function extern(knapp, ctx, d) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Bilder från ${esc(d.extern.vardgivare)}</h2>
    <p>Bilder från en annan vårdgivare hämtas genom sammanhållen journalföring${d.extern.samtycke ? '. Patienten har samtyckt på din vårdenhet.' : ' och bara om patienten samtycker. Samtycket gäller din vårdenhet och kan återkallas.'} Hämtningen loggas med syftet.</p>
    <div class="falt"><label for="bm-syfte">Syfte</label><input id="bm-syfte" name="syfte" required minlength="3" maxlength="300" value="Bedömning av tidigare bilder i vården av patienten" autocomplete="off"></div>
    ${d.extern.samtycke ? '' : '<div class="kryssfalt"><input type="checkbox" id="bm-samtycke" name="samtycke" value="ja" required><label for="bm-samtycke">Patienten samtycker till att bilderna hämtas</label></div>'}
    <p class="hjalp">${esc(d.simulerat.extern)}</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Hämta bilderna</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    const r = await medKnapp(knapp, () => api(`/api/patient/${pid(ctx)}/media/extern`, { metod: 'POST', data: { syfte: svar.data.syfte.trim(), samtycke: d.extern.samtycke || svar.data.samtycke === 'ja' } }));
    notis(r.text);
    ctx.ladda();
  } catch { /* felet visas som notis */ }
}
