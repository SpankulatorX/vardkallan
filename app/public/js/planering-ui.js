// Runda 6, r4: gemensamt i gränssnittet för planering och tidbok, del 2, och remiss, del 2. Bevakningar med datum och
// ansvarig ifyllt, anpassning av vyerna, väntetids- och remisstatistik utan personuppgifter, kallelsen som fil och
// bilagor som läses i webbläsaren och skickas till servern. Systemet fyller i det som går, och användaren ändrar bara
// det som inte passar.
import { esc, api, dialog, notis, ikon } from './ui.js';

const TZ = 'Europe/Stockholm';
export const datumKort = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });

// Lägg upp en bevakning för en patient (pid) eller för vårdenheten (utan pid). Datum, ansvarig och vanliga texter
// kommer från systemet.
export async function nyBevakning(pid = null, namn = '') {
  const f = await api(`/api/bevakningar/forslag${pid ? `?patientId=${encodeURIComponent(pid)}` : ''}`);
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${pid ? `Bevakning för ${esc(namn)}` : 'Bevakning för vårdenheten'}</h2>
    <div class="falt"><label for="bev-text">Vad ska bevakas <span class="obl">(obligatoriskt)</span></label><input id="bev-text" name="text" required minlength="3" maxlength="300" autocomplete="off" list="bev-texter" value="${esc(f.texter[0] ?? '')}"></div>
    <datalist id="bev-texter">${f.texter.map(t => `<option value="${esc(t)}"></option>`).join('')}</datalist>
    <div class="falt-rad">
      <div class="falt"><label for="bev-datum">Datum</label><input id="bev-datum" name="datum" type="date" value="${esc(f.datum)}" required></div>
      <div class="falt"><label for="bev-ansvarig">Ansvarig</label><select id="bev-ansvarig" name="ansvarigId">${f.ansvariga.map(a => `<option value="${esc(a.id)}"${a.id === f.ansvarig?.id ? ' selected' : ''}>${esc(a.namn)}${a.titel ? `, ${esc(a.titel.toLowerCase())}` : ''}</option>`).join('')}</select></div>
    </div>
    <p class="hjalp">Bevakningen visas för den ansvariga i inkorgen eller i Dagens arbete från datumet. Hela vårdenheten betyder att alla på vårdenheten ser den.</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Lägg upp bevakningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (x.text.trim().length < 3 ? 'Skriv vad som ska bevakas.' : null) });
  if (!svar) return null;
  const r = await api('/api/bevakningar', { metod: 'POST', data: { ...(pid ? { patientId: pid } : {}), text: svar.data.text.trim(), datum: svar.data.datum, ansvarigId: svar.data.ansvarigId } });
  notis(`Bevakningen är upplagd till ${r.datum}${r.ansvarig ? ` för ${r.ansvarig.namn}` : ' för hela vårdenheten'}.`);
  return r;
}

export const bevakningKlar = (id) => api(`/api/egen-bevakning/${id}/klar`, { metod: 'POST', data: {} });

// Anpassa en vy. alternativ och installning kommer från GET /api/vy/:vy.
export async function anpassaVy(vy) {
  const v = await api(`/api/vy/${vy}`);
  const inst = v.installning;
  const html = vy === 'idag'
    ? `<fieldset class="kryssgrupp"><legend>Delar som visas</legend>${v.alternativ.sektioner.map(s => `<div class="kryssfalt"><input type="checkbox" id="vy-${s.id}" name="s_${s.id}"${inst.sektioner.includes(s.id) ? ' checked' : ''}><label for="vy-${s.id}">${esc(s.text)}</label></div>`).join('')}</fieldset>`
    : `<fieldset class="radiogrupp"><legend>Vårdgivare</legend>
        <div class="radio"><input type="radio" id="vy-alla" name="vg" value="alla"${inst.vardgivare === 'alla' ? ' checked' : ''}><label for="vy-alla">Alla på vårdenheten</label></div>
        ${v.alternativ.vardgivare.some(x => x.mitt) ? `<div class="radio"><input type="radio" id="vy-mina" name="vg" value="mina"${inst.vardgivare === 'mina' ? ' checked' : ''}><label for="vy-mina">Bara mitt schema</label></div>` : ''}
        <div class="radio"><input type="radio" id="vy-valda" name="vg" value="valda"${Array.isArray(inst.vardgivare) ? ' checked' : ''}><label for="vy-valda">De här</label></div>
        <div class="kryss-lista">${v.alternativ.vardgivare.map(x => `<div class="kryssfalt"><input type="checkbox" id="vy-${esc(x.id)}" name="v_${esc(x.id)}"${Array.isArray(inst.vardgivare) && inst.vardgivare.includes(x.id) ? ' checked' : ''}><label for="vy-${esc(x.id)}">${esc(x.namn)}, ${esc(x.yrkesrollText)}</label></div>`).join('')}</div>
      </fieldset>
      <div class="kryssfalt"><input type="checkbox" id="vy-res" name="resurser"${inst.resurser ? ' checked' : ''}><label for="vy-res">Visa lokaler, utrustning och sjukresor</label></div>`;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Anpassa ${vy === 'idag' ? 'Dagens arbete' : 'tidboken'}</h2>
    <div class="dialog-text"><p>Valet sparas för dig och gäller på alla datorer. Förvalet bestäms av din yrkesroll.</p></div>${html}
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="aterstall">Återställ förvalet</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return null;
  if (svar.val === 'aterstall') { await api(`/api/vy/${vy}/aterstall`, { metod: 'POST', data: {} }); notis('Vyn visar förvalet igen.'); return true; }
  const d = svar.data;
  const installning = vy === 'idag'
    ? { sektioner: v.alternativ.sektioner.map(s => s.id).filter(id => d[`s_${id}`]) }
    : { vardgivare: d.vg === 'valda' ? v.alternativ.vardgivare.map(x => x.id).filter(id => d[`v_${id}`]) : d.vg, resurser: Boolean(d.resurser) };
  await api(`/api/vy/${vy}`, { metod: 'PUT', data: { installning } });
  notis('Vyn är sparad.');
  return true;
}

// Väntetider per tidstyp och yrkesroll, utan personuppgifter.
export function vantetiderHtml(s) {
  const tal = (x) => (x == null ? '<span class="dampad">För få</span>' : esc(x));
  return `<section class="ov-sektion" aria-labelledby="vl-stat"><div class="sektion-huvud"><h2 id="vl-stat">Väntetider på ${esc(s.vardenhet?.namn ?? '')}</h2></div>
    <p class="dampad liten">${esc(s.totalt.vantar)} väntar. ${esc(s.totalt.naraGransen)} nära gränsen och ${esc(s.totalt.passerat)} efter den. De senaste ${esc(s.bokade.dagar)} dagarna fick ${esc(s.bokade.antal)} patienter tid${s.bokade.medianDagar != null ? `, efter ${esc(s.bokade.medianDagar)} dagar i mitten` : ''}${s.bokade.inomGransen != null ? `, och ${esc(s.bokade.inomGransen)} procent före gränsen` : ''}.</p>
    ${s.grupper.length ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Tid</th><th scope="col">Väntar</th><th scope="col">Väntat, median</th><th scope="col">Längst</th><th scope="col">Nära gränsen</th><th scope="col">Efter gränsen</th></tr></thead>
      <tbody>${s.grupper.map(g => `<tr><td>${esc(g.tidstypText)} hos ${esc(g.yrkesrollText)}</td><td>${esc(g.vantar)}</td><td>${tal(g.medianDagar)} dagar</td><td>${tal(g.langstDagar)} dagar</td><td>${esc(g.naraGransen)}</td><td>${esc(g.passerat)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="tom liten">Ingen väntar.</p>'}
    <p class="hjalp">${esc(s.demoregler)}</p></section>`;
}

// Ledtiderna i remissflödet och avvikelserna, utan personuppgifter.
export function ledtiderHtml(s) {
  const del = (rubrik, d) => `<h3>${esc(rubrik)} <span class="antal">${esc(d.antal)}</span></h3>
    <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Mätpunkt</th><th scope="col">Antal</th><th scope="col">Median</th><th scope="col">Inom förväntad tid</th></tr></thead>
    <tbody>${d.matpunkter.map(m => `<tr><td>${esc(m.text)}${m.forvantat != null ? `<span class="under-text">Förväntat högst ${esc(m.forvantat)} ${esc(m.enhet)}</span>` : ''}</td><td>${esc(m.antal)}</td><td>${esc(m.medianText)}</td><td>${m.inomForvantat != null ? `${esc(m.inomForvantat)} procent` : '<span class="dampad">Ingen gräns</span>'}</td></tr>`).join('')}</tbody></table></div>
    <ul class="enkel-lista liten">${d.avvikelser.map(a => `<li>${a.antal ? ikon.larm : ''}<span>${esc(a.text)}: ${esc(a.antal)}</span></li>`).join('')}<li>Avvisade ${esc(d.avvisade)}, vidarebefordrade ${esc(d.vidarebefordrade)}${d.besvaradeInomSvarsdatum != null ? `, besvarade före sista svarsdatum ${esc(d.besvaradeInomSvarsdatum)} procent` : ''}.</li></ul>`;
  return `<section class="ov-sektion" aria-labelledby="rem-stat"><div class="sektion-huvud"><h2 id="rem-stat">Ledtider på ${esc(s.vardenhet.namn)}</h2></div>
    ${del('Inkommande', s.inkommande)}${del('Utgående', s.utgaende)}<p class="hjalp">${esc(s.text)}</p></section>`;
}

// Länkar till kallelsen som fil. vag är början på adressen, till exempel /api/kallelse/12.
export const kallelseFiler = (vag) => `<span class="kallelse-filer"><a class="knapp text liten" href="${esc(vag)}/pdf" download>${ikon.arkiv}<span>PDF</span></a><a class="knapp text liten" href="${esc(vag)}/ics" download>${ikon.kalender}<span>Till kalendern</span></a></span>`;

// Läser en fil som base64 för en bilaga. Servern avgör typen ur innehållet och kontrollerar storleken.
export function lasFil(fil) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ namn: fil.name, data: String(r.result).split(',')[1] ?? '' });
    r.onerror = () => reject(new Error('Filen kunde inte läsas.'));
    r.readAsDataURL(fil);
  });
}
export const BILAGA_TEXT = 'PDF, PNG, JPEG eller text, högst 40 kB i demon. Systemet avgör typen ur filens innehåll.';
