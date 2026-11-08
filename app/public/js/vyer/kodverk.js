// Kodverk och masterdata (runda 9, r4, Sussa 5.1.2 och 5.1.3): systemförvaltarens sida för masterdatans källor,
// kodverkens utgåvor över tid och lokala kodverk, och en sammanfattning av informationsstrukturen (NI) och det
// nationella fackspråket. Systemet kontrollerar och jämför en ny utgåva medan man skriver och förklarar varför den inte
// går. Inga patientuppgifter visas, bara antal.
import { esc, api, datum, tidpunkt, notis, medKnapp, dialog, vyRubrik } from '../ui.js';
import { hjalpRuta } from '../hjalp.js';

export const namn = 'kodverk';

const SLAG = { nationellt: 'Nationellt', internationellt: 'Internationellt', lokalt: 'Lokalt' };
const tyst = (vag, data) => api(vag, { metod: 'POST', data, tyst: true });
const antal = (n, en, flera) => `${n} ${n === 1 ? en : flera}`;

function utgavaRad(u) {
  const j = u.jamforelse;
  return `<li class="ik-ater kv-utgava"><div class="ik-text"><span class="ik-rubrik">${esc(u.namn)} ${esc(u.version)}</span>
      <span class="under-text">${antal(u.antal, 'kod', 'koder')}: ${j.nya} nya, ${j.andrade} med ny text och ${j.borttagna} borttagna. Gäller från ${esc(datum(u.giltigFran))}. Från ${esc(u.foreslagenAv)} ${esc(tidpunkt(u.foreslagen))}.</span>
      ${u.andringar.borttagna.length ? `<span class="under-text">Tas bort: ${esc(u.andringar.borttagna.slice(0, 8).map(b => `${b.kod} ${b.text}`).join(', '))}${u.andringar.borttagna.length > 8 ? ' med flera' : ''}.</span>` : ''}
      <span class="under-text">Motivering: ${esc(u.motivering ?? '')}</span></div>
    <div class="ik-knappar">${u.kanGodkanna ? `<button type="button" class="knapp liten" data-godkann="${u.id}">Godkänn</button><button type="button" class="knapp liten sekundar" data-avsla="${u.id}">Avslå</button>` : ''}${u.egen ? `<button type="button" class="knapp liten sekundar" data-aterkalla="${u.id}">Återkalla</button>` : ''}</div></li>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Kodverk och masterdata', 'Källorna för masterdatan, kodverkens utgåvor över tid och verksamhetens lokala kodverk. En ny utgåva gäller från ett datum och först när en annan systemförvaltare har godkänt den.')
    + hjalpRuta('kodverk') + '<div id="kv-sida"><p class="tom">Hämtar.</p></div>';
  const [o, m, ni, nf] = await Promise.all([api('/api/kodverk'), api('/api/masterdata'), api('/api/informationsmodell'), api('/api/fackssprak')]);
  const el = main.querySelector('#kv-sida');
  if (!el) return;
  el.innerHTML = `
    <section class="inkorg-sektion" aria-labelledby="kv-att-godkanna"><h2 id="kv-att-godkanna">Att godkänna <span class="antal${o.attGodkanna.length ? ' antal-aktiv' : ''}">${o.attGodkanna.length}</span></h2>
      ${o.attGodkanna.length ? `<ul class="inkorg-lista">${o.attGodkanna.map(utgavaRad).join('')}</ul>` : '<p class="tom liten">Inga utgåvor väntar på ditt godkännande.</p>'}</section>
    ${o.mina.length ? `<section class="inkorg-sektion" aria-labelledby="kv-mina"><h2 id="kv-mina">Mina utgåvor</h2><p class="liten">Väntar på att en annan systemförvaltare godkänner dem.</p><ul class="inkorg-lista">${o.mina.map(utgavaRad).join('')}</ul></section>` : ''}
    <section class="lm-sektion" aria-labelledby="kv-kodverk"><h2 id="kv-kodverk">Kodverk</h2>
      <div class="knapprad"><button type="button" class="knapp" data-ny-utgava="">Lägg in en ny utgåva</button><button type="button" class="knapp sekundar" data-nytt-lokalt>Nytt lokalt kodverk</button></div>
      <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Kodverk</th><th scope="col">Utgåva</th><th scope="col">Gäller från</th><th scope="col" class="tal">Koder</th><th scope="col">Används till</th></tr></thead><tbody>
        ${o.kodverk.map(k => `<tr><th scope="row">${esc(k.namn)}<br><span class="dampad liten">${esc(SLAG[k.slag] ?? k.slag)}${k.nf ? ', nationellt fackspråk' : ''}. ${esc(k.utgivare ?? '')}</span></th>
          <td>${esc(k.version ?? 'Ingen')}${k.kommande ? `<br><span class="under-text">${esc(k.kommande.version)} från ${esc(datum(k.kommande.gallerFran))}</span>` : ''}</td>
          <td>${k.giltigFran ? esc(datum(k.giltigFran)) : ''}</td><td class="tal">${k.antal}</td><td class="liten">${esc(k.anvands ?? '')}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="lm-sektion" aria-labelledby="kv-masterdata"><h2 id="kv-masterdata">Masterdata</h2>
      <p class="liten">Systemet läser in varje del från sin källa efter schemat under Regler och parametrar. Där står också vilka delar som förvaltas i Vårdkällan.</p>
      <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Del</th><th scope="col">Källa</th><th scope="col" class="tal">Poster</th><th scope="col">Senaste inläsningen</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
        ${m.delar.map(d => `<tr${d.avvikelse ? ' class="avvikande"' : ''}><th scope="row">${esc(d.namn)}<br><span class="dampad liten">${esc(d.forvaltning)}</span></th><td>${esc(d.kalla.namn)}</td>
          <td class="tal">${d.antal ?? ''}</td>
          <td>${d.senaste ? `${esc(tidpunkt(d.senaste.tid))}${d.senaste.seed ? ' (seeden)' : `: ${d.senaste.nya} nya, ${d.senaste.andrade} ändrade`}` : 'Inte inläst ännu'}${d.avvikelse ? `<br><span class="ruta ruta-larm liten">${esc(d.avvikelse)}</span>` : ''}</td>
          <td class="atgarder">${d.extern ? `<button type="button" class="knapp liten sekundar" data-synka="${esc(d.del)}">Läs in nu</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="lm-sektion" aria-labelledby="kv-ni"><h2 id="kv-ni">Informationsstruktur och fackspråk</h2>
      <p>Journalens uppgifter följer ${esc(ni.ni.namn)} ${esc(ni.ni.version)}: ${ni.sammanfattning.anvandaKlasser} av ${ni.sammanfattning.klasser} informationsklasser används av ${ni.sammanfattning.tabeller} tabeller och ${ni.sammanfattning.fhirTyper} resurstyper i FHIR.
        ${ni.sammanfattning.allmantKlassade.length ? `Allmänt klassade som Uppgift i patientjournal: ${esc(ni.sammanfattning.allmantKlassade.join(', '))}.` : 'Alla tabeller med patientuppgifter har en egen klass.'}</p>
      <ul>${nf.delar.map(d => `<li><strong>${esc(d.del)}</strong>: ${esc(d.anvands)}</li>`).join('')}</ul>
      ${nf.sokordUtanKod.length ? `<p class="liten">Sökord utan kod i Snomed CT: ${esc(nf.sokordUtanKod.map(s => s.sokord).join(', '))}.</p>` : ''}</section>
    ${o.historik.length ? `<section class="lm-sektion" aria-labelledby="kv-historik"><h2 id="kv-historik">Historik</h2><ul>${o.historik.map(u => `<li><strong>${esc(u.namn)} ${esc(u.version)}</strong>: ${esc(u.statusText.toLowerCase())} av ${esc(u.beslutadAv ?? '')} ${esc(tidpunkt(u.beslutad))}${u.gallerFran ? `, gäller från ${esc(datum(u.gallerFran))}` : ''}. Från ${esc(u.foreslagenAv)}.</li>`).join('')}</ul></section>` : ''}
    <p class="demoregel">Källorna i demon är simulerade och läser seeden. Utgåvorna är de som är inbyggda i Vårdkällan.</p>`;
  el.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-godkann]');
    const r = e.target.closest('[data-aterkalla]');
    const a = e.target.closest('[data-avsla]');
    const s = e.target.closest('[data-synka]');
    const n = e.target.closest('[data-ny-utgava]');
    const l = e.target.closest('[data-nytt-lokalt]');
    try {
      if (g) { await medKnapp(g, () => api(`/api/kodverk/utgavor/${g.dataset.godkann}/godkann`, { metod: 'POST', data: {} })); notis('Utgåvan är godkänd. Den gäller från dagen som står i tabellen.'); }
      else if (r) { await medKnapp(r, () => api(`/api/kodverk/utgavor/${r.dataset.aterkalla}/avsluta`, { metod: 'POST', data: {} })); notis('Utgåvan är återkallad.'); }
      else if (a) {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Avslå utgåvan</h2>
          <div class="falt"><label for="kv-kommentar">Varför avslås den? <span class="obl">(obligatoriskt)</span></label><textarea id="kv-kommentar" name="kommentar" rows="3" required maxlength="500"></textarea></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avslå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!svar) return;
        await medKnapp(a, () => api(`/api/kodverk/utgavor/${a.dataset.avsla}/avsluta`, { metod: 'POST', data: { kommentar: svar.data.kommentar } }));
        notis('Utgåvan är avslagen.');
      } else if (s) {
        const svar = await medKnapp(s, () => api(`/api/masterdata/${s.dataset.synka}/synkronisera`, { metod: 'POST', data: {} }));
        const x = svar.rapport;
        notis(x.tillganglig === false ? 'Källan svarade inte. De senast giltiga uppgifterna används.' : x.fel.length ? `Inläsningen ändrade ingenting: ${x.fel[0]}` : `Inläst: ${x.nya.length} nya, ${x.andrade.length} ändrade och ${x.oforandrade} oförändrade.`);
      } else if (n || l) { if (!(await nyUtgava(o, l ? 'nytt' : '', n ?? l))) return; }
      else return;
    } catch { return; }
    visa(main);
  });
}

// Lägger in en ny utgåva av ett kodverk eller skapar ett lokalt kodverk. Systemet kontrollerar och jämför medan man skriver.
async function nyUtgava(o, forval, knapp) {
  const valbara = o.kodverk.filter(k => !k.inbyggd);
  const nytt = forval === 'nytt';
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${nytt ? 'Nytt lokalt kodverk' : 'Lägg in en ny utgåva'}</h2>
    ${nytt ? `<div class="falt"><label for="kv-namn">Kodverkets namn</label><input id="kv-namn" name="namn" required maxlength="80" placeholder="Till exempel Besöksorsaker på akuten"></div><input type="hidden" name="kodverk" value="nytt">`
      : `<div class="falt"><label for="kv-val">Kodverk</label><select id="kv-val" name="kodverk">${valbara.map(k => `<option value="${esc(k.id)}">${esc(k.namn)}, gäller nu ${esc(k.version ?? '')}</option>`).join('')}</select></div>`}
    <div class="falt smal"><label for="kv-version">Utgåvans version</label><input id="kv-version" name="version" required maxlength="40" value="${nytt ? '1' : ''}"></div>
    <div class="falt smal"><label for="kv-fran">Gäller från</label><input id="kv-fran" name="giltigFran" type="date" value="${esc(o.forvalDatum)}" min="${esc(o.forvalDatum)}"></div>
    <div class="falt"><label for="kv-koder">Koderna, en per rad med semikolon mellan kod och text</label><textarea id="kv-koder" name="koder" rows="8" required spellcheck="false"></textarea>
      <p class="hjalp">Klistra in hela utgåvan från källans fil. Koder som inte finns med tas bort ur utgåvan.</p></div>
    <div class="falt"><label for="kv-motivering">Varför behövs utgåvan? <span class="obl">(obligatoriskt)</span></label><textarea id="kv-motivering" name="motivering" rows="2" required maxlength="1000"></textarea></div>
    <div class="sf-forhand" data-forhand aria-live="polite"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka för godkännande</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      let timer = null;
      let nr = 0;
      const kor = async () => {
        // En förhandsvisning efter att dialogen har stängts skulle pröva ett kodverk som redan har skapats.
        if (!dl.open) return;
        const mitt = ++nr;
        const ruta = dl.querySelector('[data-forhand]');
        const data = Object.fromEntries(new FormData(dl.querySelector('form')));
        if (!String(data.koder ?? '').trim()) { ruta.innerHTML = ''; return; }
        try {
          const f = await tyst('/api/kodverk/forhandsvisa', data);
          if (mitt !== nr) return;
          ruta.innerHTML = f.ok
            ? `<div class="ruta ruta-info liten"><p><strong>Jämfört med utgåvan som gäller</strong></p><ul>${f.effekt.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`
            : `<div class="ruta ruta-larm liten" role="status"><ul>${f.fel.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
        } catch (e) { if (mitt === nr) ruta.innerHTML = `<p class="ruta ruta-larm liten" role="status">${esc(e.message)}</p>`; }
      };
      dl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(kor, 300); });
      dl.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(kor, 50); });
    },
  });
  if (!svar) return false;
  try {
    const r = await medKnapp(knapp, () => api('/api/kodverk/utgavor', { metod: 'POST', data: svar.data }));
    notis(`${r.utgava.namn} ${r.utgava.version} väntar på att en annan systemförvaltare godkänner den.`);
  } catch { return false; }
  return true;
}
