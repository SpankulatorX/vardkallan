// Förbrukningsartiklar i läkemedelsfliken (runda 9, r1, Sussa 3.5.4.1 till 3.5.4.4, och beställningarna i 3.5.2.4
// längst ned i filen): giltiga, utgångna och utsatta
// förskrivningar med historik, filter och sortering, mallarna som systemet föreslår ur läkemedelslistan och
// diagnoserna, och förskrivning, ändring, förnyelse, utsättning och återinsättning. Servern räknar mängden och skriver
// anvisningen, så att förskrivaren bara väljer artikeln eller mallen.
import { esc, api, notis, felNotis, medKnapp, dialog, ikon, datum, tidpunkt } from '../ui.js';
import { S } from '../app.js';

const val = { grupp: '', sortering: 'giltighet' };
const NLL = { kvitterad: 'Kvitterad av NLL (simulerad)', finns_i_nll: 'Finns i NLL från annan förskrivare' };

// forhand är svaret när läkemedelsfliken redan har hämtat det, så att fliken är klar när den visas.
export const hamta = (pid) => api(`/api/patient/${encodeURIComponent(pid)}/forbrukning?${new URLSearchParams(Object.entries(val).filter(([, v]) => v))}`);
export async function visa(plats, pid, forhand = null) {
  if (!plats) return;
  let d = forhand;
  if (!d) { try { d = await hamta(pid); } catch { plats.innerHTML = ''; return; } }
  if (!plats.isConnected) return;
  const kan = d.kan?.kan;
  const rad = (f) => `<tr class="${f.status === 'giltig' ? '' : 'dampad'}">
    <td><strong>${esc(f.artikel.namn)}</strong> <span class="dampad liten">${esc(f.artikel.varunummer ?? '')}</span><span class="under-text">${esc(f.gruppText)}${f.mall ? `, mallen ${esc(f.mall)}` : ''}</span><span class="under-text">${esc(f.anvisning)}</span></td>
    <td>${f.forpackningar} × ${esc(String(f.artikel.forpackning ?? ''))} ${esc(f.artikel.enhet ?? '')}<span class="under-text">${f.uttag} uttag</span></td>
    <td><span class="tagg${f.status === 'giltig' ? ' tagg-ok' : f.status === 'utsatt' ? '' : ' tagg-larm'}">${esc(f.statusText)}</span><span class="under-text">${f.status === 'utsatt' ? `Utsatt ${esc(datum(f.utsatt.tid))} av ${esc(f.utsatt.av)}: ${esc(f.utsatt.orsak)}` : `Giltig till ${esc(f.giltigTill)}`}</span>
      <span class="under-text">${esc(NLL[f.nllStatus] ?? f.nllStatus)}</span></td>
    <td>${esc(f.uppfoljning.datum)}<span class="under-text">${esc(f.uppfoljning.ansvarig.namn ?? '')}</span></td>
    <td>${f.extern ? `Registrerad: ${esc(f.externForskrivare)}` : `${esc(f.forskriven.av.namn)}`}<span class="under-text">${esc(f.forskriven.enhet?.namn ?? '')}, ${esc(datum(f.forskriven.tid))}</span>
      <details class="fb-historik"><summary>Historik</summary><ul class="liten">${f.historik.map(h => `<li>${esc(tidpunkt(h.tid))} ${esc(h.text)} av ${esc(h.av)}, ${esc(h.enhet?.namn ?? '')}${h.detalj ? `. ${esc(h.detalj)}` : ''}</li>`).join('')}</ul></details></td>
    <td class="atgarder">${kan ? `<div class="knapprad">${f.status === 'utsatt' ? `<button type="button" class="knapp liten sekundar" data-fb="atersatt" data-id="${f.id}" data-namn="${esc(f.artikel.namn)}">Sätt in igen</button>`
      : `<button type="button" class="knapp liten sekundar" data-fb="fornya" data-id="${f.id}" data-namn="${esc(f.artikel.namn)}">Förnya</button>${f.status === 'giltig' ? `<button type="button" class="knapp liten sekundar" data-fb="andra" data-id="${f.id}" data-namn="${esc(f.artikel.namn)}" data-fp="${f.forpackningar}" data-uttag="${f.uttag}" data-uppf="${esc(f.uppfoljning.datum)}">Ändra</button>` : ''}<button type="button" class="knapp liten sekundar" data-fb="utsatt" data-id="${f.id}" data-namn="${esc(f.artikel.namn)}">Sätt ut</button>`}</div>` : ''}</td></tr>`;
  const tabell = (lista, rubrik, id) => (lista.length ? `<h4 id="${id}">${esc(rubrik)} <span class="antal">${lista.length}</span></h4><div class="tabellrulle"><table class="tabell fb-tabell" aria-labelledby="${id}">
    <thead><tr><th scope="col">Artikel</th><th scope="col">Mängd</th><th scope="col">Status</th><th scope="col">Uppföljning</th><th scope="col">Förskriven av</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
    <tbody>${lista.map(rad).join('')}</tbody></table></div>` : '');
  const forslag = (d.forslag ?? []).map(m => `<li class="fb-mall"><div><strong>${esc(m.namn)}</strong><span class="under-text">${esc(m.varfor)} ${m.artiklar.map(a => `${esc(a.namn)}${a.redanForskriven ? ' (redan förskriven)' : `, ${a.mangd.forpackningar} förp.`}`).join('; ')}.</span></div>
    <button type="button" class="knapp liten" data-fb-mall="${esc(m.id)}" data-namn="${esc(m.namn)}">Förskriv mallen</button></li>`).join('');
  plats.innerHTML = `<section class="lm-sektion fb-sektion" aria-labelledby="fb-rubrik"><h3 id="fb-rubrik">Förbrukningsartiklar <span class="antal">${d.giltiga.length}</span></h3>
    <div class="lms-verktyg"><div class="falt"><label for="fb-grupp">Visa</label><select id="fb-grupp" data-fbval="grupp"><option value="">Alla grupper</option>${Object.entries(d.grupper).map(([k, v]) => `<option value="${k}"${d.filter.grupp === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <div class="falt"><label for="fb-sort">Sortera</label><select id="fb-sort" data-fbval="sortering"><option value="giltighet">Giltighet</option><option value="artikel"${d.filter.sortering === 'artikel' ? ' selected' : ''}>Artikel</option><option value="uppfoljning"${d.filter.sortering === 'uppfoljning' ? ' selected' : ''}>Uppföljning</option></select></div></div>
    ${forslag ? `<p class="liten">Systemet föreslår ur läkemedelslistan och diagnoserna:</p><ul class="adm-lista">${forslag}</ul>` : ''}
    ${tabell(d.giltiga, 'Giltiga', 'fb-giltiga') || '<p class="tom liten">Inga giltiga förskrivningar av förbrukningsartiklar.</p>'}
    ${tabell(d.utgangna, 'Utgångna', 'fb-utgangna')}
    ${tabell(d.utsatta, 'Utsatta', 'fb-utsatta')}
    ${kan ? '<div class="knapprad"><button type="button" class="knapp liten sekundar" data-fb-ny>Ny förskrivning</button><button type="button" class="knapp liten text" data-fb-extern>Registrera förskrivning från annan förskrivare</button></div>' : ''}
    ${d.dolda?.sparrade ? '<p class="dampad liten">Det finns spärrade uppgifter. Förskrivningar från spärrade vårdenheter visas inte.</p>' : ''}
    <p class="dampad liten">${esc(d.demoregler)}</p></section>`;
  koppla(plats, pid, d);
}

function koppla(plats, pid, d) {
  const ladda = () => visa(plats, pid);
  const sektion = plats.querySelector('.fb-sektion');
  sektion.addEventListener('change', (e) => {
    const s = e.target.closest('[data-fbval]');
    if (!s) return;
    val[s.dataset.fbval] = s.value;
    ladda();
  });
  sektion.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-fb-mall]');
    if (m) return skicka(m, `/api/patient/${encodeURIComponent(pid)}/forbrukning/mall`, { mallId: m.dataset.fbMall }, (r) => `${r.mall} är förskriven: ${r.forskrivningar.map(f => f.artikel.namn).join(', ')}.${r.borttagna.length ? ` Redan förskrivet: ${r.borttagna.map(b => b.namn).join(', ')}.` : ''}`, ladda);
    if (e.target.closest('[data-fb-ny]') || e.target.closest('[data-fb-extern]')) return ny(e.target.closest('button'), pid, d, Boolean(e.target.closest('[data-fb-extern]')), ladda);
    const b = e.target.closest('[data-fb]');
    if (!b) return;
    const typ = b.dataset.fb;
    let data = {};
    if (typ === 'utsatt' || typ === 'atersatt') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">${typ === 'utsatt' ? 'Sätt ut' : 'Sätt in igen'}: ${esc(b.dataset.namn)}</h2>
        <div class="falt"><label for="fb-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><textarea id="fb-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">${typ === 'utsatt' ? 'Sätt ut' : 'Sätt in igen'}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      data = { orsak: svar.data.orsak.trim() };
    } else if (typ === 'andra') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Ändra: ${esc(b.dataset.namn)}</h2>
        <div class="falt-rad"><div class="falt smal"><label for="fb-fp">Förpackningar per uttag</label><input id="fb-fp" name="forpackningar" inputmode="numeric" value="${esc(b.dataset.fp)}"></div>
        <div class="falt smal"><label for="fb-ut">Uttag</label><input id="fb-ut" name="uttag" inputmode="numeric" value="${esc(b.dataset.uttag)}"></div>
        <div class="falt"><label for="fb-uppf">Uppföljning</label><input id="fb-uppf" name="uppfoljning" type="date" value="${esc(b.dataset.uppf)}"></div></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      data = { forpackningar: Number(svar.data.forpackningar), uttag: Number(svar.data.uttag), uppfoljning: svar.data.uppfoljning };
    }
    const TEXT = { fornya: 'är förnyad', andra: 'är ändrad', utsatt: 'är utsatt', atersatt: 'är insatt igen' };
    return skicka(b, `/api/forbrukning/${b.dataset.id}/${typ}`, data, (r) => `${r.forskrivning.artikel.namn} ${TEXT[typ]}. ${r.nll?.text ?? ''}`.trim(), ladda);
  });
}

// Skickar och visar en varning som kräver motivering i en dialog, som administreringen.
async function skicka(knapp, vag, data, klar, ladda) {
  try {
    let r;
    try { r = await api(vag, { metod: 'POST', data }); } catch (e) {
      if (!(e.status === 400 && e.data?.kraverKvittens)) throw e;
      const svar = await dialog(`<form><h2 id="dlg-rubrik">${ikon.varning}<span>Varning</span></h2>
        <ul class="varn-observera">${e.data.varningar.map(v => `<li>${esc(v.text)}</li>`).join('')}</ul>
        <div class="falt"><label for="fb-mot">Motivering <span class="obl">(obligatoriskt)</span></label><textarea id="fb-mot" name="motivering" rows="2" required minlength="3" maxlength="300"></textarea></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Förskriv ändå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      r = await api(vag, { metod: 'POST', data: { ...data, kvitteradeVarningar: e.data.kraverKvittens.map(regel => ({ regel, motivering: svar.data.motivering.trim() })) } });
    }
    notis(klar(r));
    ladda();
  } catch (e) { felNotis(e); }
  void knapp;
}

async function ny(knapp, pid, d, extern, ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${extern ? 'Registrera förskrivning från annan förskrivare' : 'Ny förskrivning av förbrukningsartikel'}</h2>
    <div class="falt"><label for="fb-art">Artikel</label><select id="fb-art" name="artikelId" required>${Object.entries(d.grupper).map(([g, t]) => `<optgroup label="${esc(t)}">${d.artiklar.filter(a => a.grupp === g).map(a => `<option value="${esc(a.id)}"${a.redanForskriven ? ' disabled' : ''}>${esc(a.namn)}, ${a.mangd.forpackningar} förp. om ${a.forpackning} ${esc(a.enhet)}${a.redanForskriven ? ' (redan förskriven)' : ''}</option>`).join('')}</optgroup>`).join('')}</select>
      <span class="hjalp">Systemet räknar mängden för tre månader ur läkemedelslistan och skriver anvisningen.</span></div>
    ${extern ? `<div class="falt-rad"><div class="falt"><label for="fb-ext-v">Förskriven av <span class="obl">(obligatoriskt)</span></label><input id="fb-ext-v" name="forskrivare" required minlength="3" maxlength="120"></div>
      <div class="falt"><label for="fb-ext-d">Datum</label><input id="fb-ext-d" name="datum" type="date" required></div></div>` : ''}
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">${extern ? 'Registrera' : 'Förskriv'}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  const data = { artikelId: svar.data.artikelId, ...(extern ? { extern: { forskrivare: svar.data.forskrivare, datum: svar.data.datum } } : {}) };
  return skicka(knapp, `/api/patient/${encodeURIComponent(pid)}/forbrukning`, data, (r) => `${r.forskrivning.artikel.namn} är ${extern ? 'registrerad' : 'förskriven'}. ${r.nll?.text ?? ''}`.trim(), ladda);
}

// ---- Beställningar av extempore, licens och blodprodukter (Sussa 3.5.2.4) ------------------------------------------
// Systemet föreslår vad som ska beställas ur ordinationerna, och de externa parterna är simulerade. Svaret kommer när
// demoknappen Simulera svar används.
export async function visaBestallningar(plats, pid, forhand = null) {
  if (!plats) return;
  let d = forhand;
  if (!d) { try { d = await api(`/api/patient/${encodeURIComponent(pid)}/lakemedelsbestallningar`); } catch { plats.innerHTML = ''; return; } }
  if (!plats.isConnected) return;
  if (!d.bestallningar.length && !d.forslag.length && !d.licenser.length) { plats.innerHTML = ''; return; }
  const lic = d.licenser.map(l => `<li><strong>${esc(l.namn)}</strong> <span class="under-text">${l.licens.giltig ? `Licens ${esc(l.licens.licens.licensnummer)} gäller till ${esc(l.licens.licens.giltigTill)}.` : esc(l.licens.varfor)}</span>
    <button type="button" class="knapp liten sekundar" data-lic="${esc(l.id)}" data-namn="${esc(l.namn)}">Ansök om licens</button></li>`).join('');
  plats.innerHTML = `<section class="lm-sektion" aria-labelledby="lb-rubrik"><h3 id="lb-rubrik">Beställningar och licenser</h3>
    ${d.forslag.length ? `<ul class="adm-lista">${d.forslag.map(f => `<li class="adm-vb"><div><strong>${esc(f.lakemedel)}</strong><span class="under-text">Beställs från ${esc(f.mottagare)}, ${esc(f.mangd)}.</span></div>
      <button type="button" class="knapp liten" data-best="${f.ordinationId}" data-namn="${esc(f.lakemedel)}">Beställ</button></li>`).join('')}</ul>` : ''}
    ${d.bestallningar.length ? `<ul class="liten">${d.bestallningar.map(b => `<li><strong>${esc(b.typText)}: ${esc(b.lakemedel?.namn ?? '')}</strong>, ${esc(b.mangd)}. <span class="tagg">${esc(b.statusText)}</span> ${esc(b.mottagare)}${b.svar ? `. ${esc(b.svar)}` : ''}
      ${!['levererad', 'beviljad'].includes(b.status) ? `<button type="button" class="knapp-lank" data-best-svar="${b.id}">Simulera svar</button>` : ''}</li>`).join('')}</ul>` : ''}
    ${lic ? `<ul class="adm-lista">${lic}</ul>` : ''}
    <p class="dampad liten">${esc(d.simulerat)}</p></section>`;
  plats.querySelector('section').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-best], [data-best-svar], [data-lic]');
    if (!b) return;
    try {
      if (b.dataset.best) {
        const r = await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(pid)}/lakemedelsbestallningar`, { metod: 'POST', data: { ordinationId: Number(b.dataset.best) } }));
        notis(`${r.bestallning.lakemedel.namn} är beställd från ${r.bestallning.mottagare}.`);
      } else if (b.dataset.bestSvar) {
        const r = await medKnapp(b, () => api(`/api/lakemedelsbestallning/${b.dataset.bestSvar}/simulera-svar`, { metod: 'POST', data: {} }));
        notis(`${r.bestallning.typText}: ${r.bestallning.statusText.toLowerCase()}. ${r.bestallning.svar ?? ''}`.trim());
      } else {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Licensansökan: ${esc(b.dataset.namn)}</h2>
          <div class="falt"><label for="lic-mot">Varför räcker inte ett godkänt läkemedel? <span class="obl">(obligatoriskt)</span></label><textarea id="lic-mot" name="motivering" rows="3" required minlength="10" maxlength="500"></textarea></div>
          <div class="kryssfalt"><input type="checkbox" id="lic-gen" name="generell" value="ja"><label for="lic-gen">Generell licens för vårdenheten</label></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka ansökan</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!svar) return;
        const r = await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(pid)}/lakemedelsbestallningar`, { metod: 'POST', data: { lakemedelId: b.dataset.lic, motivering: svar.data.motivering.trim(), generell: svar.data.generell === 'ja' } }));
        notis(`${r.forlangning ? 'Förlängningen' : 'Licensansökan'} för ${r.bestallning.lakemedel.namn} är skickad till ${r.bestallning.mottagare}.`);
      }
      visaBestallningar(plats, pid);
    } catch { /* notis visad */ }
  });
}

// ---- Klinisk läkemedelsprövning (Sussa 3.5.5.1) --------------------------------------------------------------------
// Patientens deltagande med studienummer och ansvarig prövare, och för prövaren inkludering och avslutning.
export async function visaProvningar(plats, pid, forhand = null) {
  if (!plats) return;
  let d = forhand;
  if (!d) { try { d = await api(`/api/patient/${encodeURIComponent(pid)}/provningar`); } catch { plats.innerHTML = ''; return; } }
  if (!plats.isConnected) return;
  if (!d.deltaganden.length && !d.kanInkludera.length) { plats.innerHTML = ''; return; }
  plats.innerHTML = `<section class="lm-sektion" aria-labelledby="kp-rubrik"><h3 id="kp-rubrik">Klinisk prövning</h3>
    ${d.deltaganden.length ? `<ul class="adm-lista">${d.deltaganden.map(x => `<li class="adm-vb"><div><strong>${esc(x.provning.studienummer)}</strong> <span class="tagg${x.aktiv ? ' tagg-pagaende' : ''}">${x.aktiv ? 'Deltar' : 'Avslutat'}</span>
      <span class="under-text">${esc(x.provning.titel)}. Ansvarig prövare ${esc(x.provning.ansvarig.namn)}, ${esc(x.provning.vardenhet.namn)}. Prövningsläkemedel ${esc(x.provning.lakemedel?.namn ?? '')}.</span>
      <span class="under-text">Inkluderad ${esc(datum(x.inkluderad))} av ${esc(x.inkluderadAv)}${x.randomiseringskod ? `, randomiseringskod ${esc(x.randomiseringskod)}` : ''}${x.avslutad ? `. Avslutat ${esc(datum(x.avslutad.tid))}: ${esc(x.avslutad.orsak)}` : ''}.</span></div>
      ${x.aktiv && x.provning.provare.some(p => p.id === S.session?.personal?.id) ? `<button type="button" class="knapp liten sekundar" data-kp-avsluta="${x.id}">Avsluta deltagandet</button>` : ''}</li>`).join('')}</ul>` : ''}
    ${d.kanInkludera.map(p => `<p class="liten">Du är prövare i ${esc(p.studienummer)}. <button type="button" class="knapp liten sekundar" data-kp-ink="${p.id}" data-nr="${esc(p.studienummer)}">Inkludera patienten</button></p>`).join('')}
    <p class="dampad liten">${esc(d.demoregel)}</p></section>`;
  plats.querySelector('section').addEventListener('click', async (e) => {
    const ink = e.target.closest('[data-kp-ink]');
    const avs = e.target.closest('[data-kp-avsluta]');
    if (!ink && !avs) return;
    const svar = await dialog(ink ? `<form><h2 id="dlg-rubrik">Inkludera i ${esc(ink.dataset.nr)}</h2>
      <p class="liten">Systemet registrerar uppmärksamhetsinformationen själv, så att alla som öppnar journalen ser att patienten deltar.</p>
      <div class="falt"><label for="kp-kod">Randomiseringskod</label><input id="kp-kod" name="kod" autocomplete="off" maxlength="30"></div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Inkludera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`
      : `<form><h2 id="dlg-rubrik">Avsluta deltagandet</h2><div class="falt"><label for="kp-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><textarea id="kp-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
    if (!svar) return;
    try {
      if (ink) await medKnapp(ink, () => api(`/api/patient/${encodeURIComponent(pid)}/provningar`, { metod: 'POST', data: { provningId: Number(ink.dataset.kpInk), randomiseringskod: svar.data.kod } }));
      else await medKnapp(avs, () => api(`/api/studiedeltagande/${avs.dataset.kpAvsluta}/avsluta`, { metod: 'POST', data: { orsak: svar.data.orsak.trim() } }));
      notis(ink ? `Patienten är inkluderad i ${ink.dataset.nr}.` : 'Deltagandet är avslutat.');
      visaProvningar(plats, pid);
    } catch { /* notis visad */ }
  });
}
