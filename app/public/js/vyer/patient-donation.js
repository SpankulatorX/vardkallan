// Donation och transplantation (runda 10, r4, Sussa 3.1.12.1). Dödsfallet på intensivvården, donationsutredningen med
// checklistan som systemet bockar av där det kan, den avlidnes inställning, donationsanteckningen som systemet skriver
// och registrerade transplantationer.
import { esc, api, datum, tidpunkt, notis, medKnapp, ikon, dialog } from '../ui.js';
import { doldaRad } from './patient.js';

const STATUS = { klar: ['Klar', 'tagg-ok'], ej_aktuell: ['Inte aktuell', ''], kvar: ['Kvar', 'tagg-utkast'] };

function checklista(u, kan) {
  return `<ol class="dn-lista">${u.checklista.map(p => `<li class="dn-punkt dn-${esc(p.status)}" data-punkt="${esc(p.id)}">
    <p><span class="tagg ${STATUS[p.status][1]}">${esc(STATUS[p.status][0])}</span> <strong>${esc(p.text)}</strong>${p.auto ? ' <span class="under-text">Systemet bockar av</span>' : ''}</p>
    ${p.detalj ? `<p class="under-text">${esc(p.detalj)}${p.av && p.av !== 'system' ? `, ${esc(p.av)}` : ''}</p>` : ''}
    <p class="under-text">Referens: ${esc(p.referens)}</p>
    ${kan && !p.auto && p.status === 'kvar' && u.status === 'pagar' ? `<p class="knapprad"><button type="button" class="knapp liten" data-dn-klar="${esc(p.id)}">Klar</button><button type="button" class="knapp liten sekundar" data-dn-ej="${esc(p.id)}">Inte aktuell</button></p>` : ''}
  </li>`).join('')}</ol>`;
}

function utredning(u, d) {
  return `<section class="dn-utredning" aria-labelledby="dn-u-${u.id}"><h3 id="dn-u-${u.id}">Donationsutredning, ${esc(u.statusText.toLowerCase())}</h3>
    <p class="under-text">Startad ${esc(tidpunkt(u.startad.tid))} av ${esc(u.startad.av ?? '')} på ${esc(u.vardenhet?.namn ?? '')}.</p>
    ${checklista(u, d.kanDokumentera)}
    <h4>Underlag för den medicinska bedömningen</h4><ul class="enkel-lista">${u.underlag.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>
    <h4>Underlag till kvalitetsregistret</h4><p class="under-text">${esc(u.kvalitetsregister.register)}. ${u.kvalitetsregister.klar ? 'Klart.' : 'Blir klart när checklistan är klar.'} Utan namn och personnummer.</p>
    <dl class="dn-register">${Object.entries({ Ålder: u.kvalitetsregister.falt.alder, Kön: u.kvalitetsregister.falt.kon, Dödsfall: u.kvalitetsregister.falt.kriterier ?? 'Inte registrerat', Inställning: u.kvalitetsregister.falt.installning ?? 'Inte känd', Utfall: u.kvalitetsregister.falt.utfall, Organ: u.kvalitetsregister.falt.organ.join(', ') || 'Inga' }).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${u.status === 'pagar' && d.kanDokumentera ? `<p class="knapprad">${d.kanRegistreraTransplantation ? `<button type="button" class="knapp liten" data-dn-anteckning="${u.id}">Skriv donationsanteckning</button>` : ''}<button type="button" class="knapp liten sekundar" data-dn-vilja>Närståendes uppgift om inställningen</button><button type="button" class="knapp liten sekundar" data-dn-avsluta="${u.id}">Avsluta utredningen</button></p>` : ''}
    ${u.avslutad ? `<p>Avslutad ${esc(tidpunkt(u.avslutad.tid))} av ${esc(u.avslutad.av ?? '')}.${u.avslutad.organ.length ? ` Organ: ${esc(u.avslutad.organ.join(', '))}.` : ''}${u.avslutad.text ? ` ${esc(u.avslutad.text)}` : ''}</p>` : ''}
  </section>`;
}

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${encodeURIComponent(ctx.id)}/donation`);
  if (!ctx.aktuell()) return;
  const pagar = d.donationer.find(u => u.status === 'pagar');
  el.innerHTML = `<div class="flikhuvud"><h2>Donation och transplantation</h2></div>${doldaRad(d.dolda)}
    ${d.dodsfall ? `<p class="ruta ruta-info">${ikon.info}<span>Patienten avled ${esc(tidpunkt(d.dodsfall.tid))}. ${esc(d.dodsfall.kriterierText)}. Registrerat av ${esc(d.dodsfall.registreradAv ?? '')}.</span></p>` : ''}
    ${d.forslag ? `<div class="ruta ruta-info dn-forslag">${ikon.info}<div><p>${esc(d.forslag.text)}</p><p class="knapprad"><button type="button" class="knapp" data-dn-starta>Starta donationsutredning</button>${d.kanRegistreraDodsfall ? '<button type="button" class="knapp sekundar" data-dn-dod>Registrera dödsfall</button>' : ''}</p></div></div>` : ''}
    ${d.donationer.map(u => utredning(u, d)).join('')}
    ${d.vilja.length ? `<section aria-labelledby="dn-vilja"><h3 id="dn-vilja">Inställning till donation</h3><ul class="enkel-lista">${d.vilja.map(v => `<li><strong>${esc(v.text)}</strong>${v.undantag ? `, utom ${esc(v.undantag)}` : ''}<span class="under-text">${esc(v.kalla)}, ${esc(tidpunkt(v.tid))}</span></li>`).join('')}</ul></section>` : ''}
    <section aria-labelledby="dn-transpl"><h3 id="dn-transpl">Transplantationer</h3>
      ${d.transplantationer.length ? `<ul class="enkel-lista">${d.transplantationer.map(t => `<li><strong>${esc(t.organ)}</strong>, ${esc(datum(t.datum))}${t.centrum ? `, ${esc(t.centrum)}` : ''}<span class="under-text">Bidiagnos ${esc(t.diagnos?.kod ?? '')} ${esc(t.diagnos?.text ?? '')}. Registrerad av ${esc(t.registreradAv ?? '')}.</span></li>`).join('')}</ul>` : '<p class="tom">Inga registrerade transplantationer.</p>'}
      ${d.kanRegistreraTransplantation ? '<p class="knapprad"><button type="button" class="knapp liten sekundar" data-dn-transpl>Registrera transplantation</button></p>' : ''}
    </section>
    <p class="under-text">${esc(d.demoregel)}</p>`;

  const val = (lista, namn) => lista.map(x => `<option value="${esc(x.id)}">${esc(x.text)}</option>`).join('');
  el.addEventListener('click', async (e) => {
    const t = (s) => e.target.closest(s);
    try {
      if (t('[data-dn-starta]')) {
        await medKnapp(t('[data-dn-starta]'), () => api(`/api/patient/${encodeURIComponent(ctx.id)}/donation`, { metod: 'POST', data: {} }));
        notis('Donationsutredningen är startad. Systemet har kontrollerat Donationsregistret (simulerat).');
        ctx.ladda();
      } else if (t('[data-dn-dod]')) {
        const s = await dialog(`<form><h2 id="dlg-rubrik">Registrera dödsfall</h2><div class="falt"><label for="dn-krit">Döden fastställdes med</label><select id="dn-krit" name="kriterier">${val(d.kriterier)}</select></div>
          <div class="falt"><label for="dn-tid">Tidpunkt</label><input id="dn-tid" name="tid" type="datetime-local"><span class="hjalp">Tomt betyder nu.</span></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        const r = await medKnapp(null, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/dodsfall`, { metod: 'POST', data: { kriterier: s.data.kriterier, ...(s.data.tid ? { tid: new Date(s.data.tid).toISOString() } : {}) } }));
        notis(r.text);
        ctx.ladda();
      } else if (t('[data-dn-klar]') || t('[data-dn-ej]')) {
        const b = t('[data-dn-klar]') ?? t('[data-dn-ej]');
        const punkt = b.dataset.dnKlar ?? b.dataset.dnEj;
        const ej = Boolean(b.dataset.dnEj);
        const s = await dialog(`<form><h2 id="dlg-rubrik">${ej ? 'Inte aktuell' : 'Klar'}</h2><div class="falt"><label for="dn-kom">${ej ? 'Varför' : 'Kommentar'}</label><textarea id="dn-kom" name="kommentar" rows="3" maxlength="300"${ej ? ' required' : ''}></textarea></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        await medKnapp(null, () => api(`/api/donation/${pagar.id}/punkt`, { metod: 'POST', data: { punkt, status: ej ? 'ej_aktuell' : 'klar', kommentar: s.data.kommentar?.trim() || undefined } }));
        ctx.ladda();
      } else if (t('[data-dn-vilja]')) {
        const s = await dialog(`<form><h2 id="dlg-rubrik">Den avlidnes inställning</h2><div class="falt"><label for="dn-v">Enligt de närstående</label><select id="dn-v" name="vilja">${val(d.viljor)}</select></div>
          <div class="falt"><label for="dn-und">Undantag</label><input id="dn-und" name="undantag" maxlength="200"><span class="hjalp">Organ eller vävnader som inte får tas, om inställningen har undantag.</span></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        await medKnapp(null, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/donationsvilja`, { metod: 'POST', data: { vilja: s.data.vilja, kalla: 'narstaende', undantag: s.data.undantag?.trim() || undefined } }));
        ctx.ladda();
      } else if (t('[data-dn-anteckning]')) {
        const a = await medKnapp(t('[data-dn-anteckning]'), () => api(`/api/donation/${t('[data-dn-anteckning]').dataset.dnAnteckning}/anteckning`, { metod: 'POST', data: {} }));
        notis('Systemet har skrivit donationsanteckningen som ett utkast. Läs, komplettera och signera.');
        location.hash = ctx.href('journal', a.id);
      } else if (t('[data-dn-avsluta]')) {
        const s = await dialog(`<form><h2 id="dlg-rubrik">Avsluta utredningen</h2><div class="falt"><label for="dn-st">Utfall</label><select id="dn-st" name="status"><option value="genomford">Donation genomförd</option><option value="avbruten">Donation inte genomförd</option></select></div>
          <fieldset class="kryssgrupp"><legend>Donerade organ</legend>${d.organ.map(o => `<div class="kryssfalt"><input type="checkbox" id="dn-o-${esc(o.id)}" name="organ-${esc(o.id)}"><label for="dn-o-${esc(o.id)}">${esc(o.text)}</label></div>`).join('')}</fieldset>
          <div class="falt"><label for="dn-txt">Kommentar</label><input id="dn-txt" name="text" maxlength="300"><span class="hjalp">Krävs när donationen inte genomfördes.</span></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        const organ = d.organ.filter(o => s.data[`organ-${o.id}`]).map(o => o.id);
        await medKnapp(null, () => api(`/api/donation/${t('[data-dn-avsluta]').dataset.dnAvsluta}/avsluta`, { metod: 'POST', data: { status: s.data.status, organ, text: s.data.text?.trim() || undefined } }));
        ctx.ladda();
      } else if (t('[data-dn-transpl]')) {
        const s = await dialog(`<form><h2 id="dlg-rubrik">Registrera transplantation</h2><div class="falt"><label for="dn-org">Organ</label><select id="dn-org" name="organ">${val(d.organ)}</select></div>
          <div class="falt"><label for="dn-dat">Datum</label><input id="dn-dat" name="datum" type="date" required></div>
          <div class="falt"><label for="dn-cent">Transplantationscentrum</label><input id="dn-cent" name="centrum" maxlength="100"></div>
          <p class="hjalp">Systemet sätter bidiagnosen ur ICD-10-SE och föreslår uppmärksamhetsinformationen.</p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!s) return;
        const r = await medKnapp(null, () => api(`/api/patient/${encodeURIComponent(ctx.id)}/transplantationer`, { metod: 'POST', data: { organ: s.data.organ, datum: s.data.datum, centrum: s.data.centrum?.trim() || undefined } }));
        notis(r.text);
        ctx.laddaOm();
      }
    } catch { /* felet visas som notis */ }
  });
}
