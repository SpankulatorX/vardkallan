// Identiteter (Sussa 3.1.1): fliken Identitet i journalen och registreringen av en ny patient från sök.
// Systemet är experten: användaren skriver eller klistrar in ett nummer i vilket format som helst, och servern avgör vad
// det är, säger vad som är fel och skapar reservnummer. Ingen typlista att välja i. Troliga dubbletter hittar systemet
// självt, och en vårdadministratör bekräftar sammanslagningen.
import { esc, api, tidpunkt, datum, notis, medKnapp, dialog, ikon, ApiFel, faltFel } from '../ui.js';
import { far, uppdateraInkorg } from '../app.js';
import { nollstall } from './patient.js';

const STATUS = { gallande: 'Gällande', tidigare: 'Tidigare', ovrig: 'Extra identitet' };
const kon = (k) => (k === 'man' ? 'Man' : k === 'kvinna' ? 'Kvinna' : '');

// Visar vad systemet läser ut ur numret medan det skrivs. Tomt fält betyder okänd identitet.
export function tolkaMedan(input, ut, { tomText = '' } = {}) {
  let timer = null;
  let senast = '';
  const visa = async () => {
    const v = input.value.trim();
    if (v === senast) return;
    senast = v;
    if (!v) { ut.innerHTML = tomText ? `<span class="dampad">${esc(tomText)}</span>` : ''; ut.dataset.typ = ''; input.dispatchEvent(new CustomEvent('tolkad', { detail: null })); return; }
    try {
      const t = await api(`/api/identitet/tolka?q=${encodeURIComponent(v)}`, { tyst: true });
      if (input.value.trim() !== v) return;
      ut.dataset.typ = t.ok ? t.typ : '';
      if (!t.arIdentitet) ut.innerHTML = '<span class="dampad">Det här ser inte ut som ett nummer.</span>';
      else if (!t.ok) ut.innerHTML = `${ikon.varning}<span>${esc(t.fel)}</span>`;
      else ut.innerHTML = `${ikon.bock}<span>${esc(t.beskrivning)}${t.demoFel ? ` ${esc(t.demoFel)}` : ''}</span>`;
      ut.className = `tolkning ${!t.arIdentitet ? '' : t.ok && !t.demoFel ? 'tolkning-ok' : 'tolkning-fel'}`;
      input.dispatchEvent(new CustomEvent('tolkad', { detail: t }));
    } catch { /* tolkningen är ett stöd, servern prövar igen när formuläret skickas */ }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(visa, 250); });
  visa();
}

// Födelsedatum eller ålder i samma fält. Systemet avgör vilket.
function fodelse(v) {
  const s = String(v ?? '').trim();
  if (/^\d{1,3}$/.test(s)) return { alder: Number(s) };
  if (/^\d{8}$/.test(s)) return { fodd: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` };
  return s ? { fodd: s } : {};
}

// Formuläret för en ny patient i sökvyn. Med ett känt nummer ger numret födelsedatum och kön, och bara namnet behövs.
// Utan nummer skapar systemet ett reservnummer av kön och födelsedatum eller ålder. Namnet kan då saknas.
export function registreringHtml() {
  return `<section class="ruta ny-patient" id="ny-patient" aria-labelledby="np-rubrik" hidden>
    <h2 id="np-rubrik">Registrera ny patient</h2>
    <form id="np-form" novalidate>
      <div class="falt"><label for="np-id">Personnummer eller annan identitet</label>
        <input id="np-id" name="identitet" autocomplete="off" aria-describedby="np-id-h np-tolkning">
        <span class="hjalp" id="np-id-h">Lämna tomt om identiteten är okänd. Då skapar systemet ett reservnummer.</span>
        <p class="tolkning" id="np-tolkning" aria-live="polite"></p></div>
      <div class="falt-rad">
        <div class="falt"><label for="np-fornamn">Förnamn</label><input id="np-fornamn" name="fornamn" autocomplete="off" maxlength="60"></div>
        <div class="falt"><label for="np-efternamn">Efternamn</label><input id="np-efternamn" name="efternamn" autocomplete="off" maxlength="60"></div>
      </div>
      <div data-okand>
        <fieldset class="radiogrupp" id="np-kon"><legend>Kön</legend>
          <div class="radio"><input type="radio" id="np-k" name="kon" value="kvinna"><label for="np-k">Kvinna</label></div>
          <div class="radio"><input type="radio" id="np-m" name="kon" value="man"><label for="np-m">Man</label></div>
        </fieldset>
        <div class="falt smal-falt"><label for="np-fodelse">Födelsedatum eller ungefärlig ålder</label>
          <input id="np-fodelse" name="fodelse" autocomplete="off" inputmode="numeric" aria-describedby="np-fodelse-h">
          <span class="hjalp" id="np-fodelse-h">Till exempel 1980-04-12 eller 45.</span></div>
      </div>
      <p class="form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp">Registrera</button><button type="button" class="knapp sekundar" data-np-stang>Avbryt</button></div>
    </form>
  </section>`;
}

export function kopplaRegistrering(main) {
  const sek = main.querySelector('#ny-patient');
  const form = main.querySelector('#np-form');
  const knapp = main.querySelector('[data-ny-patient]');
  if (!sek || !form || !knapp) return;
  const okand = form.querySelector('[data-okand]');
  knapp.addEventListener('click', () => { sek.hidden = false; knapp.hidden = true; form.identitet.focus(); });
  form.querySelector('[data-np-stang]').addEventListener('click', () => { sek.hidden = true; knapp.hidden = false; knapp.focus(); });
  // Personnummer och samordningsnummer ger kön och födelsedatum, så de fälten behövs inte då.
  form.identitet.addEventListener('tolkad', (e) => { okand.hidden = Boolean(e.detail?.ok && e.detail.kon); });
  tolkaMedan(form.identitet, form.querySelector('#np-tolkning'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { identitet: form.identitet.value.trim(), fornamn: form.fornamn.value.trim(), efternamn: form.efternamn.value.trim(), kon: form.kon.value || undefined, ...fodelse(form.fodelse.value) };
    let r;
    try {
      r = await medKnapp(form.querySelector('[type=submit]'), () => api('/api/patienter', { metod: 'POST', data }), form);
    } catch (fel) {
      if (fel instanceof ApiFel && fel.kod === 'finns') {
        faltFel(form, null);
        const ruta = form.querySelector('.form-fel');
        ruta.innerHTML = `${esc(fel.message)} <a href="#/patient/${encodeURIComponent(fel.data.patient.id)}">Öppna journalen för ${esc(fel.data.patient.namn)}</a>`;
        ruta.hidden = false;
      }
      return;
    }
    const p = r.patient;
    notis(r.skapatReservnummer ? `Patienten är registrerad med reservnummer ${p.personnummer}.` : `${p.namn} är registrerad med ${p.typText.toLowerCase()} ${p.personnummer}.`);
    location.hash = `#/patient/${encodeURIComponent(p.id)}`;
  });
}

function identitetsTabell(d) {
  return `<div class="tabellrulle"><table class="tabell id-tabell">
    <thead><tr><th scope="col">Identitet</th><th scope="col">Nummer</th><th scope="col">Status</th><th scope="col">Gäller</th><th scope="col">Anmärkning</th></tr></thead>
    <tbody>${d.identiteter.map(i => `<tr${i.status === 'gallande' ? ' class="id-gallande"' : ''}>
      <th scope="row">${esc(i.typText)}${i.systemNamn ? `<span class="under-text">${esc(i.systemNamn)}</span>` : ''}</th>
      <td><span class="pnr">${esc(i.visning)}</span></td>
      <td>${esc(STATUS[i.status])}</td>
      <td>${esc(datum(i.fran))}${i.till ? ` till ${esc(datum(i.till))}` : ''}</td>
      <td>${[i.orsak === 'sammanslagen' ? 'Från en journal som slogs samman med den här' : i.orsak ? `${i.orsak[0].toUpperCase()}${i.orsak.slice(1)}` : '', i.franAnnanJournal && i.orsak !== 'sammanslagen' ? 'Från en sammanslagen journal' : ''].filter(Boolean).map(esc).join('. ')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function jamforelse(d, f) {
  const a = d.patient;
  const b = f.annan;
  const kvar = f.kvar === a.id ? a : b;
  const rad = (rubrik, x, y) => `<tr><th scope="row">${esc(rubrik)}</th><td>${x}</td><td>${y}</td></tr>`;
  return `<section class="ruta ruta-info dubblett" aria-labelledby="db-${esc(b.id)}" data-dubblett="${esc(b.id)}">
    <div>
      <h3 id="db-${esc(b.id)}">Trolig dubblett</h3>
      <p>${esc(f.grundText)} Systemet föreslår att journalerna slås samman.</p>
      <div class="tabellrulle"><table class="tabell">
        <thead><tr><td></td><th scope="col">Den här journalen</th><th scope="col">Den andra journalen</th></tr></thead>
        <tbody>
          ${rad('Namn', esc(a.namn), esc(b.namn))}
          ${rad('Identitet', `${esc(a.typText)} <span class="pnr">${esc(a.personnummer)}</span>`, `${esc(b.typText)} <span class="pnr">${esc(b.personnummer)}</span>`)}
          ${rad('Födelsedatum', esc(a.fodd ? datum(a.fodd) : ''), esc(b.fodd ? datum(b.fodd) : ''))}
          ${rad('Kön', esc(kon(a.kon)), esc(kon(b.kon)))}
        </tbody>
      </table></div>
      <p>Journalen med ${esc(kvar.typText.toLowerCase())} blir kvar, eftersom det är den senast gällande identiteten. Allt i den andra journalen flyttas dit: anteckningar, läkemedel, mätvärden, diagnoser, remisser, vårdkontakter och spärrar. Den andra identiteten finns kvar som tidigare identitet och går att söka på.</p>
      <div class="knapprad"><button type="button" class="knapp" data-sla-samman="${esc(b.id)}">Slå samman journalerna</button><button type="button" class="knapp sekundar" data-avfarda="${esc(b.id)}">Inte samma person</button></div>
    </div>
  </section>`;
}

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/identiteter`);
  if (!ctx.aktuell()) return;
  const g = d.identiteter.find(i => i.status === 'gallande');
  el.innerHTML = `<div class="flikhuvud"><h2>Identitet</h2></div>
    ${d.dubbletter.map(f => jamforelse(d, f)).join('')}
    <section aria-labelledby="id-gallande"><h3 id="id-gallande">Gällande identitet</h3>
      <p class="id-nu"><span class="tagg">${esc(g?.typText ?? '')}</span> <span class="pnr">${esc(g?.visning ?? '')}</span>${g?.systemNamn ? ` <span class="dampad">${esc(g.systemNamn)}</span>` : ''}</p>
      ${g?.typ === 'reservnummer' ? '<p class="dampad liten">Reservnumret är skapat av systemet eftersom identiteten inte var känd. När personnummer eller samordningsnummer blir känt skriver du in det nedan, så blir det den gällande identiteten och reservnumret finns kvar som tidigare identitet. Formatet är påhittat för demon.</p>' : ''}
    </section>
    ${d.kan.andraIdentitet ? `<section aria-labelledby="id-ny"><h3 id="id-ny">Ny identitet</h3>
      <form id="id-form" class="sokform" novalidate>
        <div class="falt"><label for="id-falt">Personnummer, samordningsnummer eller OID och nummer</label>
          <div class="sokrad"><input id="id-falt" name="identitet" autocomplete="off" aria-describedby="id-falt-h id-tolkning"><button type="submit" class="knapp">Spara</button></div>
          <span class="hjalp" id="id-falt-h">Skriv eller klistra in numret i valfritt format. Systemet avgör vilken sorts nummer det är.</span>
          <p class="tolkning" id="id-tolkning" aria-live="polite"></p></div>
        <p class="form-fel" role="alert" hidden></p>
      </form></section>` : ''}
    <section aria-labelledby="id-alla"><h3 id="id-alla">Alla identiteter</h3>${identitetsTabell(d)}</section>
    ${d.sammanslagningar.length ? `<section aria-labelledby="id-samman"><h3 id="id-samman">Sammanslagna journaler</h3>
      <ul class="enkel-lista">${d.sammanslagningar.map(s => `<li>${esc(tidpunkt(s.tid))}: journalen med ${esc(s.franPatient.typText.toLowerCase())} <span class="pnr">${esc(s.franPatient.personnummer)}</span> slogs samman med den här av ${esc(s.av ?? '')}. ${esc(s.grundText)} ${s.antal} uppgifter flyttades.</li>`).join('')}</ul>
    </section>` : ''}`;

  const form = el.querySelector('#id-form');
  if (form) {
    tolkaMedan(form.identitet, form.querySelector('#id-tolkning'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await medKnapp(form.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/identitet`, { metod: 'POST', data: { identitet: form.identitet.value } }), form);
        notis(r.utfall === 'bytt' ? `${r.identitet.typText} ${r.identitet.visning} är nu den gällande identiteten.` : r.utfall === 'tillagd' ? `${r.identitet.typText} är tillagd.` : 'Patienten har redan den identiteten.');
        ctx.laddaOm();
      } catch (fel) {
        if (fel instanceof ApiFel && fel.kod === 'dubblett') {
          faltFel(form, null);
          const ruta = form.querySelector('.form-fel');
          ruta.textContent = `${fel.message} ${fel.data.kanSlaSamman ? 'Förslaget visas överst.' : 'En vårdadministratör ser förslaget och bekräftar sammanslagningen.'}`;
          ruta.hidden = false;
          if (fel.data.kanSlaSamman) ctx.laddaOm();
        }
      }
    });
  }

  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sla-samman]');
    const a = e.target.closest('[data-avfarda]');
    if (s && far('sla_samman')) {
      const svar = await dialog(`<h2 id="dlg-rubrik">Slå samman journalerna?</h2>
        <p class="dialog-text">Allt flyttas till journalen med den senast gällande identiteten. Den andra journalen finns kvar som historik och leder dit. Sammanslagningen loggas och syns i patientens logglista.</p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Slå samman</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`);
      if (!svar) return;
      try {
        const r = await medKnapp(s, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/sammanslagning`, { metod: 'POST', data: { med: s.dataset.slaSamman } }));
        notis(`Journalerna är sammanslagna. ${r.antal} uppgifter finns nu i journalen med ${r.patient.typText.toLowerCase()} ${r.patient.personnummer}.`);
        await uppdateraInkorg();
        nollstall();
        location.hash = `#/patient/${encodeURIComponent(r.till)}/identitet`;
      } catch { /* felet visas som notis */ }
    }
    if (a && far('sla_samman')) {
      try {
        await medKnapp(a, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/dubblett/avfarda`, { metod: 'POST', data: { med: a.dataset.avfarda } }));
        notis('Förslaget är avfärdat. Systemet föreslår inte de här journalerna igen.');
        await uppdateraInkorg();
        ctx.laddaOm();
      } catch { /* felet visas som notis */ }
    }
  });
}
