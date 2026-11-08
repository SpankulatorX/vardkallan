// Remiss, del 4 i gränssnittet (runda 10, r6): remiss eller konsultation, urval i remissöversikten och läkarens kvittens
// av beslut som har registrerats på uppdrag. Servern prövar all behörighet, räknar antalen och fyller i det den kan.
import { esc, api, notis, dialog, medKnapp, tidpunkt } from './ui.js';
import { uppdateraInkorg } from './app.js';

// Frågan när en remiss skrivs: lämna över vårdansvaret eller be om råd. Förvalet är remiss.
export const TYPER = [
  { id: 'remiss', fraga: 'Lämna över vårdansvaret (remiss)', hjalp: 'Mottagaren tar över ansvaret för det remissen gäller, bedömer och kallar patienten.' },
  { id: 'konsultation', fraga: 'Fråga om råd, vårdansvaret stannar hos oss (konsultation)', hjalp: 'Mottagaren svarar med råd. Patienten sätts inte upp på mottagarens väntelista.' },
];

export function typFalt(prefix, valt = 'remiss') {
  return `<fieldset class="radiogrupp" aria-describedby="${prefix}-typ-hjalp"><legend>Vad vill du?</legend>
    ${TYPER.map(t => `<div class="radio"><input type="radio" id="${prefix}-typ-${t.id}" name="typ" value="${t.id}"${t.id === valt ? ' checked' : ''}><label for="${prefix}-typ-${t.id}">${esc(t.fraga)}</label></div>`).join('')}
    <p class="hjalp" id="${prefix}-typ-hjalp">${esc(TYPER.map(t => t.hjalp).join(' '))}</p></fieldset>`;
}
export const valdTyp = (form) => form.querySelector('input[name="typ"]:checked')?.value ?? 'remiss';

// Taggen i remisskortets rubrikrad.
export const typTagg = (r) => (r.konsultation ? '<span class="tagg tagg-konsultation">Konsultation</span>' : '');

// Det som remisskortet visar utöver del 1 till 3: vårdansvaret för en konsultation och kvittensen av ett beslut på uppdrag.
export function kortHtml(r) {
  const rader = [];
  if (r.konsultation) rader.push(esc(r.vardansvar));
  const k = r.beslutPaUppdrag?.kvittens;
  if (k?.status === 'vantar') rader.push(`Beslutet väntar på kvittens av ${esc(r.beslutPaUppdrag.ansvarig?.namn ?? 'den ansvariga läkaren')}. Det gäller redan, så att patienten inte behöver vänta.`);
  if (k?.status === 'kvitterat') rader.push(`Beslutet kvitterades ${esc(tidpunkt(k.tid))} av ${esc(k.av?.namn ?? '')}.`);
  if (k?.status === 'underkant') rader.push(`${esc(k.av?.namn ?? 'Läkaren')} kvitterade inte beslutet ${esc(tidpunkt(k.tid))} och bedömer remissen själv.${k.kommentar ? ` ${esc(k.kommentar)}` : ''}`);
  return rader.map(t => `<p class="ruta ruta-info liten r10-rad">${t}</p>`).join('');
}

// ---------------------------------------------------------------------------------------------------------------
// Urval i remissöversikten

const FALT = [['typ', 'Typ', 'Alla typer'], ['status', 'Status', 'Oavsett status'], ['prioritet', 'Prioritet', 'Alla prioriteter'], ['period', 'Skickad', 'Hela tiden']];

// Valen med antalet per val, som servern har räknat ur vårdenhetens remisser.
export function urvalHtml(d, riktning) {
  if (!d.val) return '';
  const f = d.filter ?? {};
  return `<form class="r10-urval" aria-label="Urval av remisser" data-riktning="${esc(riktning)}">
    <div class="falt-rad">${FALT.map(([k, etikett, alla]) => `<div class="falt"><label for="ru-${k}">${etikett}</label><select id="ru-${k}" name="${k}">
      <option value="">${alla}</option>${d.val[k].map(v => `<option value="${esc(v.id)}"${f[k] === v.id ? ' selected' : ''}>${esc(v.text)}${v.antal != null ? ` (${v.antal})` : ''}</option>`).join('')}</select></div>`).join('')}</div>
    <p class="dampad liten" aria-live="polite">Visar ${d.antal.visade} av ${d.antal.totalt} remisser.${Object.keys(f).length ? ' <button type="button" class="knapp liten text" data-urval-rensa>Visa alla</button>' : ''}</p>
  </form>`;
}

// Ett val ändrar adressen, så att urvalet följer med tillbaka till översikten.
export function kopplaUrval(el) {
  const form = el.querySelector('.r10-urval');
  if (!form) return;
  const ga = (rensa = false) => {
    const q = new URLSearchParams({ riktning: form.dataset.riktning });
    if (!rensa) for (const [k] of FALT) if (form[k].value) q.set(k, form[k].value);
    location.hash = `#/remisser?${q}`;
  };
  form.addEventListener('change', () => ga());
  form.querySelector('[data-urval-rensa]')?.addEventListener('click', () => ga(true));
}
export const urvalFraga = (q) => ['typ', 'status', 'prioritet', 'period'].filter(k => q.get(k)).map(k => `&${k}=${encodeURIComponent(q.get(k))}`).join('');

// ---------------------------------------------------------------------------------------------------------------
// Inkorgen: beslut på uppdrag att kvittera

export function inkorgRader(d, { pnamn, sym }) {
  return (d.beslutAttKvittera ?? []).map(x => `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">${x.beslut === 'avvisad' ? 'Avvisad' : 'Accepterad'} ${x.typ === 'konsultation' ? 'konsultation' : 'remiss'} från ${esc(x.fran.namn)}, ${esc(pnamn(x.patient))}${sym(x.patient)}</span>
    <span class="under-text">${esc(x.fragestallning ?? '')} Registrerat ${esc(tidpunkt(x.tid))} av ${esc(x.registreradAv?.namn ?? '')} med dig som ansvarig.${x.motivering ? ` Motivering: ${esc(x.motivering)}` : ''}</span></div>
    <div class="ik-knappar"><button type="button" class="knapp liten" data-r10-kvittera="${x.id}">Stämmer</button><button type="button" class="knapp liten sekundar" data-r10-underkann="${x.id}">Stämmer inte</button></div></li>`);
}

// Returnerar true när inkorgen ska ritas om.
export async function inkorgKlick(e) {
  const k = e.target.closest('[data-r10-kvittera]');
  const u = e.target.closest('[data-r10-underkann]');
  if (!k && !u) return false;
  const id = (k ?? u).dataset[k ? 'r10Kvittera' : 'r10Underkann'];
  let data = { utfall: 'stammer' };
  if (u) {
    const svar = await dialog(`<form><h2 id="dlg-rubrik">Beslutet stämmer inte</h2>
      <div class="dialog-text"><p>Remissen öppnas igen och hamnar bland dina remisser att bedöma. Står patienten på väntelistan avslutas den posten.</p></div>
      <div class="falt"><label for="r10-kom">Vad stämmer inte? <span class="obl">(obligatoriskt)</span></label><textarea id="r10-kom" name="kommentar" rows="3" maxlength="1000" required></textarea></div>
      <p class="dialog-fel form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Öppna remissen igen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
    { validera: (x) => (x.kommentar.trim().length < 3 ? 'Skriv vad som inte stämmer.' : null) });
    if (!svar) return false;
    data = { utfall: 'stammer_inte', kommentar: svar.data.kommentar.trim() };
  }
  try {
    await medKnapp(k ?? u, () => api(`/api/remiss/${id}/beslut-pa-uppdrag/kvittera`, { metod: 'POST', data }));
    notis(u ? 'Remissen är öppnad igen och väntar på din bedömning.' : 'Beslutet är kvitterat.');
    await uppdateraInkorg();
    return true;
  } catch { return false; /* felet visas som notis */ }
}
