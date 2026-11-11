// Runda 12, r1: Mallar och mätvärdestyper (Sussa 12.1.1.7 och vårt D11). Systemförvaltaren skapar och ändrar
// journalens mallar med sökord, mätvärdestyper, vårdgivarens ramar och vårdenheternas lokala anpassningar. Allt blir
// en ny version som en annan systemförvaltare godkänner. Systemet sätter koderna det redan känner till, kontrollerar
// resten medan man skriver och visar vad som påverkas. Inga patientuppgifter visas, bara antal.
import { esc, api, tidpunkt, notis, medKnapp, dialog, vyRubrik } from '../ui.js';
import { hjalpRuta } from '../hjalp.js';

export const namn = 'journalstruktur';

const tyst = (vag, data) => api(vag, { metod: 'POST', data, tyst: true });
const lista = (t) => String(t ?? '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);

// Nya sökord, ett per rad: namn; kod; engelsk term, eller namn; förklaring varför sökordet inte har någon kod.
function nyaSokord(t) {
  const ut = {};
  for (const rad of String(t ?? '').split('\n').map(r => r.trim()).filter(Boolean)) {
    const [namn, b = '', c = ''] = rad.split(';').map(x => x.trim());
    if (!namn) continue;
    ut[namn] = /^\d+$/.test(b) ? { code: b, display: c } : { ingen: [b, c].filter(Boolean).join('; ') };
  }
  return ut;
}

function versionRad(v) {
  const d = v.definition;
  const vad = v.slag === 'mattyp' ? `${d.kodverk === 'npu' ? 'NPU' : 'LOINC'} ${d.kod}, ${d.enhet}, rimligt ${d.min} till ${d.max}`
    : v.slag === 'ram' ? `Måste finnas: ${d.obligatoriska.join(', ') || 'inga'}. Får läggas till lokalt: ${d.lokalt.join(', ') || 'inga'}.`
      : `Sökord: ${d.sokord.join(', ')}`;
  return `<li class="ik-ater js-version"><div class="ik-text"><span class="ik-rubrik">${esc(v.slagText)}: ${esc(v.rubrik)}, version ${v.version}</span>
      <span class="under-text">${esc(vad)}. Föreslagen av ${esc(v.foreslagenAv)} ${esc(tidpunkt(v.foreslagen))}.</span>
      <span class="under-text">Motivering: ${esc(v.motivering)}</span>
      ${v.paverkas?.length ? `<ul class="liten">${v.paverkas.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</div>
    <div class="ik-knappar">${v.kanGodkanna ? `<button type="button" class="knapp liten" data-godkann="${v.id}">Godkänn</button><button type="button" class="knapp liten sekundar" data-avsla="${v.id}">Avslå</button>` : ''}${v.egen ? `<button type="button" class="knapp liten sekundar" data-aterkalla="${v.id}">Återkalla</button>` : ''}</div></li>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Mallar och mätvärdestyper', 'Journalens mallar med sökord, nya mätvärdestyper, vårdgivarens ramar för mallarna och vårdenheternas lokala anpassningar. En ny version gäller direkt när en annan systemförvaltare har godkänt den.')
    + hjalpRuta('journalstruktur') + '<div id="js-sida"><p class="tom">Hämtar.</p></div>';
  const o = await api('/api/journalstruktur');
  const el = main.querySelector('#js-sida');
  if (!el) return;
  el.innerHTML = `
    <section class="inkorg-sektion" aria-labelledby="js-att-godkanna"><h2 id="js-att-godkanna">Att godkänna <span class="antal${o.attGodkanna.length ? ' antal-aktiv' : ''}">${o.attGodkanna.length}</span></h2>
      ${o.attGodkanna.length ? `<ul class="inkorg-lista">${o.attGodkanna.map(versionRad).join('')}</ul>` : '<p class="tom liten">Inga versioner väntar på ditt godkännande.</p>'}</section>
    ${o.mina.length ? `<section class="inkorg-sektion" aria-labelledby="js-mina"><h2 id="js-mina">Mina förslag</h2><p class="liten">Väntar på att en annan systemförvaltare godkänner dem.</p><ul class="inkorg-lista">${o.mina.map(versionRad).join('')}</ul></section>` : ''}
    <section class="lm-sektion" aria-labelledby="js-mallar"><h2 id="js-mallar">Mallar</h2>
      <div class="knapprad"><button type="button" class="knapp" data-ny="mall">Ny mall</button></div>
      <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Mall</th><th scope="col">Sökord</th><th scope="col">Vårdgivarens ram</th><th scope="col">Lokala anpassningar</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
        ${o.mallar.map(m => `<tr data-mall="${esc(m.typ)}"><th scope="row">${esc(m.typ)}<br><span class="dampad liten">${m.inbyggd ? 'Inbyggd' : `Version ${m.version}`}, ${esc(m.kategoriText)}</span></th>
          <td class="liten">${esc(m.sokord.join(', '))}</td>
          <td class="liten">${m.ram ? `Måste finnas: ${esc(m.ram.obligatoriska.join(', ') || 'inga')}. Får läggas till: ${esc(m.ram.lokalt.join(', ') || 'inga')}.` : 'Ingen ram. En vårdenhet får ordna om och ta bort mallens sökord.'}</td>
          <td class="liten">${m.lokala.length ? m.lokala.map(l => `${esc(l.enhetNamn)}${l.galler ? '' : ' (gäller inte, ryms inte i ramen)'}`).join('<br>') : 'Inga'}</td>
          <td class="atgarder">${m.inbyggd ? '' : `<button type="button" class="knapp liten sekundar" data-ny="mall" data-nyckel="${esc(m.typ)}">Ny version</button>`}
            <button type="button" class="knapp liten sekundar" data-ny="ram" data-nyckel="${esc(m.typ)}">Ram</button>
            <button type="button" class="knapp liten sekundar" data-ny="lokal" data-nyckel="${esc(m.typ)}">Lokal anpassning</button></td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="lm-sektion" aria-labelledby="js-mattyper"><h2 id="js-mattyper">Mätvärdestyper</h2>
      <div class="knapprad"><button type="button" class="knapp" data-ny="mattyp">Ny mätvärdestyp</button></div>
      ${o.mattyper.length ? `<div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Mätvärde</th><th scope="col">Kod</th><th scope="col">Enhet</th><th scope="col">Rimliga värden</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
        ${o.mattyper.map(t => `<tr><th scope="row">${esc(t.namn)}<br><span class="dampad liten">Version ${t.version}</span></th><td>${t.kodverk === 'npu' ? 'NPU' : 'LOINC'} ${esc(t.kod)}</td><td>${esc(t.enhet)} (UCUM ${esc(t.ucum)})</td><td>${t.min} till ${t.max}${t.heltal ? ', heltal' : ''}</td>
          <td class="atgarder"><button type="button" class="knapp liten sekundar" data-ny="mattyp" data-nyckel="${esc(t.id)}">Ny version</button></td></tr>`).join('')}</tbody></table></div>`
        : '<p class="tom liten">Inga egna mätvärdestyper ännu. Journalens inbyggda mätvärden har kod i NPU eller LOINC.</p>'}</section>
    <section class="lm-sektion" aria-labelledby="js-lasta"><h2 id="js-lasta">Det som inte går att ändra här</h2>
      <ul>${o.lasta.map(l => `<li><strong>${esc(l.rubrik)}</strong>: ${esc(l.varfor)}</li>`).join('')}</ul></section>
    ${o.historik.length ? `<section class="lm-sektion" aria-labelledby="js-historik"><h2 id="js-historik">Historik</h2><ul>${o.historik.map(v => `<li><strong>${esc(v.slagText)}: ${esc(v.rubrik)}, version ${v.version}</strong>: ${esc(v.statusText.toLowerCase())} av ${esc(v.beslutadAv ?? '')} ${esc(tidpunkt(v.beslutad))}. Föreslagen av ${esc(v.foreslagenAv)}.${v.kommentar ? ` ${esc(v.kommentar)}` : ''}</li>`).join('')}</ul></section>` : ''}
    <p class="demoregel">${esc(o.anmarkning)}</p>`;
  el.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-godkann]');
    const r = e.target.closest('[data-aterkalla]');
    const a = e.target.closest('[data-avsla]');
    const n = e.target.closest('[data-ny]');
    try {
      if (g) { await medKnapp(g, () => api(`/api/journalstruktur/${g.dataset.godkann}/godkann`, { metod: 'POST', data: {} })); notis('Versionen är godkänd och gäller från nu.'); }
      else if (r) { await medKnapp(r, () => api(`/api/journalstruktur/${r.dataset.aterkalla}/avsluta`, { metod: 'POST', data: {} })); notis('Förslaget är återkallat.'); }
      else if (a) {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Avslå versionen</h2>
          <div class="falt"><label for="js-kommentar">Varför avslås den? <span class="obl">(obligatoriskt)</span></label><textarea id="js-kommentar" name="kommentar" rows="3" required maxlength="500"></textarea></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avslå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!svar) return;
        await medKnapp(a, () => api(`/api/journalstruktur/${a.dataset.avsla}/avsluta`, { metod: 'POST', data: { kommentar: svar.data.kommentar } }));
        notis('Versionen är avslagen.');
      } else if (n) { if (!(await forslag(o, n.dataset.ny, n.dataset.nyckel ?? null, n))) return; }
      else return;
    } catch { return; }
    visa(main);
  });
}

// Formuläret för varje slag och hur definitionen läses ur det. Systemet fyller i det som redan gäller.
function formular(o, slag, nyckel) {
  const mall = o.mallar.find(m => m.typ === nyckel);
  if (slag === 'mall') {
    const m = nyckel ? mall : null;
    const nya = m?.nyaSokord ? Object.entries(m.nyaSokord).map(([k, v]) => (v.code ? `${k}; ${v.code}; ${v.display}` : `${k}; ${v.ingen}`)).join('\n') : '';
    return `${m ? `<input type="hidden" name="typ" value="${esc(m.typ)}"><p>Ny version av <strong>${esc(m.typ)}</strong>.</p>`
      : '<div class="falt"><label for="js-typ">Mallens namn</label><input id="js-typ" name="typ" required maxlength="60" placeholder="Till exempel Smärtmottagningens bedömning"><p class="hjalp">Namnet är anteckningstypen som den som skriver väljer.</p></div>'}
      <fieldset class="segment"><legend>Hör till</legend><input type="radio" id="js-kat-l" name="kategori" value="lakare"${m?.kategori !== 'omvardnad' ? ' checked' : ''}><label for="js-kat-l">Läkarnas dokumentation</label><input type="radio" id="js-kat-o" name="kategori" value="omvardnad"${m?.kategori === 'omvardnad' ? ' checked' : ''}><label for="js-kat-o">Omvårdnad</label></fieldset>
      <div class="falt"><label for="js-sokord">Sökord, i den ordning de visas</label><textarea id="js-sokord" name="sokord" rows="3" required spellcheck="false">${esc(m?.sokord.join(', ') ?? '')}</textarea>
        <p class="hjalp">Skilj sökorden med kommatecken. Ett sökord som redan finns får sin kod i Snomed CT av systemet.</p></div>
      <div class="falt"><label for="js-nya">Nya sökord som inte finns i delmängden</label><textarea id="js-nya" name="nya" rows="2" spellcheck="false">${esc(nya)}</textarea>
        <p class="hjalp">Ett per rad: namn; kod i Snomed CT; engelsk term. Har sökordet ingen kod skriver du namn; varför det inte har någon kod.</p></div>
      <div class="falt-rad"><div class="falt smal"><label for="js-typkod">Anteckningstypens kod i Snomed CT</label><input id="js-typkod" name="typkod" inputmode="numeric" maxlength="18" value="${esc(m?.typkod?.code ?? '')}"><p class="hjalp">Frivilligt. Följer med i FHIR.</p></div>
        <div class="falt"><label for="js-typterm">Kodens engelska term</label><input id="js-typterm" name="typterm" maxlength="120" value="${esc(m?.typkod?.display ?? '')}"></div></div>`;
  }
  if (slag === 'mattyp') {
    const t = nyckel ? o.mattyper.find(x => x.id === nyckel) : null;
    return `<div class="falt"><label for="js-mnamn">Namn som visas i journalen</label><input id="js-mnamn" name="namn" required maxlength="60" value="${esc(t?.namn ?? '')}" placeholder="Till exempel Ferritin"></div>
      <fieldset class="segment"><legend>Kodverk</legend><input type="radio" id="js-kv-npu" name="kodverk" value="npu"${t?.kodverk !== 'loinc' ? ' checked' : ''}><label for="js-kv-npu">NPU, laboratoriets analyser</label><input type="radio" id="js-kv-loinc" name="kodverk" value="loinc"${t?.kodverk === 'loinc' ? ' checked' : ''}><label for="js-kv-loinc">LOINC, andra mätningar</label></fieldset>
      <div class="falt-rad"><div class="falt smal"><label for="js-kod">Kod</label><input id="js-kod" name="kod" required maxlength="20" spellcheck="false" value="${esc(t?.kod ?? '')}"></div>
        <div class="falt smal"><label for="js-ucum">Enhet i UCUM</label><input id="js-ucum" name="ucum" required maxlength="30" spellcheck="false" value="${esc(t?.ucum ?? '')}" placeholder="ug/L"></div></div>
      <div class="falt-rad"><div class="falt smal"><label for="js-min">Lägsta rimliga värde</label><input id="js-min" name="min" inputmode="decimal" required value="${t ? esc(t.min) : ''}"></div>
        <div class="falt smal"><label for="js-max">Högsta rimliga värde</label><input id="js-max" name="max" inputmode="decimal" required value="${t ? esc(t.max) : ''}"></div>
        <div class="kryssfalt"><input type="checkbox" id="js-heltal" name="heltal" value="ja"${t?.heltal ? ' checked' : ''}><label for="js-heltal">Bara heltal</label></div></div>`;
  }
  if (slag === 'ram') {
    const lokalt = o.sokord.filter(s => !mall.sokord.includes(s));
    return `<input type="hidden" name="typ" value="${esc(mall.typ)}"><p>Vårdgivarens ram för <strong>${esc(mall.typ)}</strong>.</p>
      <fieldset class="kryssgrupp"><legend>Sökord som alltid måste finnas</legend>${mall.sokord.map((s, i) => `<div class="kryssfalt"><input type="checkbox" id="js-obl-${i}" name="obl-${i}" value="${esc(s)}"${mall.ram?.obligatoriska.includes(s) ? ' checked' : ''}><label for="js-obl-${i}">${esc(s)}</label></div>`).join('')}</fieldset>
      <fieldset class="kryssgrupp"><legend>Sökord som en vårdenhet får lägga till</legend>${lokalt.map((s, i) => `<div class="kryssfalt"><input type="checkbox" id="js-lok-${i}" name="lok-${i}" value="${esc(s)}"${mall.ram?.lokalt.includes(s) ? ' checked' : ''}><label for="js-lok-${i}">${esc(s)}</label></div>`).join('')}</fieldset>`;
  }
  return `<input type="hidden" name="typ" value="${esc(mall.typ)}"><p>Lokal anpassning av <strong>${esc(mall.typ)}</strong>. ${mall.ram ? `Vårdgivarens ram: måste finnas ${esc(mall.ram.obligatoriska.join(', ') || 'inga')}, får läggas till ${esc(mall.ram.lokalt.join(', ') || 'inga')}.` : 'Mallen har ingen ram, så vårdenheten får ordna om och ta bort mallens sökord men inte lägga till nya.'}</p>
    <div class="falt"><label for="js-enhet">Vårdenhet</label><select id="js-enhet" name="enhet">${o.vardenheter.map(v => `<option value="${esc(v.id)}">${esc(v.namn)}</option>`).join('')}</select></div>
    <div class="falt"><label for="js-lsokord">Vårdenhetens sökord, i den ordning de visas</label><textarea id="js-lsokord" name="sokord" rows="3" required spellcheck="false">${esc(mall.sokord.join(', '))}</textarea></div>`;
}

function definitionAv(slag, form) {
  const d = Object.fromEntries(new FormData(form));
  if (slag === 'mall') return { typ: d.typ, kategori: d.kategori, sokord: lista(d.sokord), nyaSokord: nyaSokord(d.nya), ...(d.typkod?.trim() ? { typkod: { code: d.typkod.trim(), display: d.typterm } } : {}) };
  if (slag === 'mattyp') return { namn: d.namn, kodverk: d.kodverk, kod: d.kod, ucum: d.ucum, min: d.min, max: d.max, heltal: d.heltal === 'ja' };
  if (slag === 'ram') return { typ: d.typ, obligatoriska: Object.entries(d).filter(([k]) => k.startsWith('obl-')).map(([, v]) => v), lokalt: Object.entries(d).filter(([k]) => k.startsWith('lok-')).map(([, v]) => v) };
  return { typ: d.typ, enhet: d.enhet, sokord: lista(d.sokord) };
}

const RUBRIK = { mall: 'mall', mattyp: 'mätvärdestyp', ram: 'Vårdgivarens ram', lokal: 'Lokal anpassning' };

async function forslag(o, slag, nyckel, knapp) {
  const forNyckel = slag === 'mall' || slag === 'mattyp' ? nyckel : null;
  let def = null;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${slag === 'ram' || slag === 'lokal' ? RUBRIK[slag] : nyckel ? `Ny version av ${RUBRIK[slag]}` : `Ny ${RUBRIK[slag]}`}</h2>
    ${formular(o, slag, nyckel)}
    <div class="falt"><label for="js-motivering">Varför behövs ändringen? <span class="obl">(obligatoriskt)</span></label><textarea id="js-motivering" name="motivering" rows="2" required maxlength="1000"></textarea></div>
    <div class="sf-forhand" data-forhand aria-live="polite"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka för godkännande</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
    klass: 'dialog-bred',
    validera: (data, dl) => { def = definitionAv(slag, dl.querySelector('form')); return null; },
    onOpen: (dl) => {
      let timer = null;
      let nr = 0;
      const kor = async () => {
        if (!dl.open) return;
        const mitt = ++nr;
        const ruta = dl.querySelector('[data-forhand]');
        try {
          const f = await tyst('/api/journalstruktur/forhandsvisa', { slag, nyckel: forNyckel, definition: definitionAv(slag, dl.querySelector('form')) });
          if (mitt !== nr) return;
          ruta.innerHTML = f.ok
            ? `<div class="ruta ruta-info liten"><p><strong>Det här påverkas</strong></p><ul>${f.paverkas.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`
            : `<div class="ruta ruta-larm liten" role="status"><ul>${f.fel.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
        } catch (e) { if (mitt === nr) ruta.innerHTML = `<p class="ruta ruta-larm liten" role="status">${esc(e.message)}</p>`; }
      };
      dl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(kor, 300); });
      dl.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(kor, 50); });
      if (nyckel) kor();
    },
  });
  if (!svar || !def) return false;
  try {
    const r = await medKnapp(knapp, () => api('/api/journalstruktur', { metod: 'POST', data: { slag, nyckel: forNyckel, definition: def, motivering: svar.data.motivering } }));
    notis(`${r.version.rubrik} version ${r.version.version} väntar på att en annan systemförvaltare godkänner den.`);
  } catch { return false; }
  return true;
}
