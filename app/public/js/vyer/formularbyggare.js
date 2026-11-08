// Runda 10, r3: systemförvaltarens sida Formulär (Sussa 5.1.1.3). Verksamhetens formulär byggs här utan kod: frågor av
// fördefinierade datatyper, fasta svar med poäng, en skala med tolkning, regler, en kroppsbild för markeringar och
// förifyllnad ur journalen. Systemet sätter nycklarna själv, förhandsvisar formuläret och texten som svaren ger medan man
// bygger, förklarar varje fel på vanlig svenska och föreslår koder ur kodverken. Ett nytt formulär eller en ny version
// gäller först när en annan systemförvaltare har godkänt det, och den gamla versionen gäller tills dess.
import { esc, api, notis, medKnapp, dialog, vyRubrik, tidpunkt } from '../ui.js';
import * as R from '../formularmotor-regler.js';
import * as formular from './patient-formular.js';

let stenar = null;
const nyckel = (text, upptagna) => {
  const bas = (text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f$1').slice(0, 24)) || 'fraga';
  let k = /^[a-z]/.test(bas) ? bas : `f_${bas}`;
  let n = 2;
  while (upptagna.has(k)) k = `${bas.slice(0, 20)}_${n++}`;
  return k;
};

// Svarsalternativen skrivs ett per rad, med poäng efter ett likhetstecken: Två eller fler = 2.
const altText = (alt = []) => alt.map(a => `${a.text}${a.poang != null ? ` = ${a.poang}` : ''}`).join('\n');
const altLas = (text, gamla = []) => {
  const sett = new Set();
  return text.split('\n').map(r => r.trim()).filter(Boolean).map((r) => {
    const m = r.match(/^(.*?)\s*=\s*(-?\d+)\s*$/);
    const t = (m ? m[1] : r).trim();
    const forra = gamla.find(a => a.text === t);
    const varde = forra?.varde ?? nyckel(t, sett);
    sett.add(varde);
    return { varde, text: t, ...(m ? { poang: Number(m[2]) } : {}), ...(forra?.kod ? { kod: forra.kod } : {}) };
  });
};
// Tolkningarna skrivs en per rad: 0-2 Låg risk. Ett utropstecken först gör tolkningen till en varning.
const tolkText = (t = []) => t.map(x => `${x.varning ? '!' : ''}${x.fran}-${x.till} ${x.text}`).join('\n');
const tolkLas = (text, gamla = []) => text.split('\n').map(r => r.trim()).filter(Boolean).map((r) => {
  const m = r.match(/^(!)?\s*(-?\d+)\s*-\s*(-?\d+)\s+(.+)$/);
  if (!m) return { fran: NaN, till: NaN, text: r };
  const forra = gamla.find(x => x.text === m[4].trim());
  return { fran: Number(m[2]), till: Number(m[3]), text: m[4].trim(), varning: Boolean(m[1]), ...(forra?.kod ? { kod: forra.kod } : {}) };
});
// Reglerna skrivs en per rad: villkor: text. Villkoret är poäng minst 3, nyckel = svar, nyckel minst 80 eller nyckel högst 2.
const villkorText = (v) => (!v ? '' : v.poang ? `poäng minst ${v.poang.minst}` : Object.hasOwn(v, 'ar') ? `${v.falt} = ${v.ar}` : Object.hasOwn(v, 'minst') ? `${v.falt} minst ${v.minst}` : Object.hasOwn(v, 'hogst') ? `${v.falt} högst ${v.hogst}` : `${v.falt} ifyllt`);
const villkorLas = (t) => {
  const s = t.trim();
  if (!s) return null;
  let m = s.match(/^poäng\s+minst\s+(-?\d+)$/i);
  if (m) return { poang: { minst: Number(m[1]) } };
  m = s.match(/^([a-z][a-z0-9_]*)\s*=\s*([a-z0-9_]+)$/);
  if (m) return { falt: m[1], ar: m[2] };
  m = s.match(/^([a-z][a-z0-9_]*)\s+(minst|högst)\s+(-?[\d,.]+)$/);
  if (m) return { falt: m[1], [m[2] === 'minst' ? 'minst' : 'hogst']: Number(m[3].replace(',', '.')) };
  m = s.match(/^([a-z][a-z0-9_]*)\s+ifyllt$/);
  if (m) return { falt: m[1], ifyllt: true };
  return { falt: s };
};
const reglerText = (r = []) => r.map(x => `${villkorText(x.om)}: ${x.text}`).join('\n');
const reglerLas = (text) => text.split('\n').map(r => r.trim()).filter(Boolean).map((r) => {
  const i = r.indexOf(':');
  return i < 0 ? { om: null, text: r } : { om: villkorLas(r.slice(0, i)), text: r.slice(i + 1).trim() };
});

function fragaKort(f, i, alla) {
  const opt = (lista, vald) => lista.map(([v, t]) => `<option value="${esc(v)}"${v === vald ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const ff = stenar.forifyllnad.filter(x => x.typer.includes(f.typ));
  const p = `fb-${i}`;
  return `<li class="fb-fraga" data-i="${i}">
    <div class="falt-rad">
      <div class="falt bred"><label for="${p}-fraga">Fråga ${i + 1}</label><input id="${p}-fraga" data-f="fraga" value="${esc(f.fraga ?? '')}" maxlength="200" autocomplete="off"></div>
      <div class="falt"><label for="${p}-typ">Datatyp</label><select id="${p}-typ" data-f="typ">${opt(stenar.datatyper.map(d => [d.id, d.namn]), f.typ)}</select></div>
      <div class="falt"><label for="${p}-sokord">Hamnar under sökordet</label><select id="${p}-sokord" data-f="sokord">${opt(stenar.sokord.map(s => [s, s]), f.sokord ?? R.SOKORD_STANDARD)}</select></div>
    </div>
    <p class="hjalp">Nyckel: <code>${esc(f.id)}</code>. ${esc(stenar.datatyper.find(d => d.id === f.typ)?.beskrivning ?? '')}</p>
    <div class="falt-rad">
      ${f.typ === 'val' || f.typ === 'flerval' ? `<div class="falt bred"><label for="${p}-alt">Svarsalternativ, ett per rad, med poäng efter likhetstecken</label><textarea id="${p}-alt" data-f="alternativ" rows="3" placeholder="Inga = 0">${esc(altText(f.alternativ))}</textarea></div>` : ''}
      ${f.typ === 'ja_nej' ? `<div class="falt smal"><label for="${p}-pja">Poäng för ja</label><input id="${p}-pja" data-f="poang_ja" inputmode="numeric" value="${esc(f.poang?.ja ?? '')}"></div><div class="falt smal"><label for="${p}-pnej">Poäng för nej</label><input id="${p}-pnej" data-f="poang_nej" inputmode="numeric" value="${esc(f.poang?.nej ?? '')}"></div>` : ''}
      ${f.typ === 'heltal' || f.typ === 'decimal' ? `<div class="falt smal"><label for="${p}-min">Lägsta</label><input id="${p}-min" data-f="min" inputmode="decimal" value="${esc(f.min ?? '')}"></div><div class="falt smal"><label for="${p}-max">Högsta</label><input id="${p}-max" data-f="max" inputmode="decimal" value="${esc(f.max ?? '')}"></div><div class="falt smal"><label for="${p}-enhet">Enhet</label><input id="${p}-enhet" data-f="enhet" value="${esc(f.enhet ?? '')}" maxlength="20"></div>` : ''}
      ${f.typ === 'text' ? `<div class="falt smal"><label for="${p}-max">Längsta text i tecken</label><input id="${p}-max" data-f="maxLangd" inputmode="numeric" value="${esc(f.maxLangd ?? 1000)}"></div>` : ''}
      ${f.typ === 'matvarde' ? `<div class="falt"><label for="${p}-mv">Mätvärde</label><select id="${p}-mv" data-f="matvarde">${opt(stenar.mattyper.map(m => [m.id, `${m.namn} (${m.enhet})`]), f.matvarde ?? 'vikt')}</select></div>` : ''}
      ${f.typ === 'bild' ? `<div class="falt"><label for="${p}-bild">Bild</label><select id="${p}-bild" data-f="bild">${opt(stenar.bilder.map(b => [b.id, b.namn]), f.bild ?? 'kropp')}</select></div>` : ''}
      ${ff.length ? `<div class="falt"><label for="${p}-ff">Systemet fyller i</label><select id="${p}-ff" data-f="forifyll"><option value="">Inget</option>${opt(ff.map(x => [x.id, x.text]), f.forifyll ?? '')}</select></div>` : ''}
      ${i > 0 ? `<div class="falt"><label for="${p}-visa">Visas bara när, till exempel ${esc(alla[0].id)} = ja</label><input id="${p}-visa" data-f="visaOm" value="${esc(villkorText(f.visaOm))}" autocomplete="off"></div>` : ''}
    </div>
    <div class="knapprad"><div class="kryssfalt"><input type="checkbox" id="${p}-obl" data-f="obligatoriskt"${f.obligatoriskt ? ' checked' : ''}><label for="${p}-obl">Obligatorisk</label></div>
      ${i > 0 ? `<button type="button" class="knapp liten text" data-upp="${i}">Flytta upp<span class="sr"> fråga ${i + 1}</span></button>` : ''}
      <button type="button" class="knapp liten text" data-bort="${i}">Ta bort<span class="sr"> fråga ${i + 1}</span></button></div>
  </li>`;
}

// Läser det som står i byggaren till en definition.
function lasDef(yta, def) {
  const ut = {
    namn: yta.querySelector('#fb-namn').value.trim(), beskrivning: yta.querySelector('#fb-beskrivning').value.trim(),
    kategori: yta.querySelector('[name="fb-kategori"]:checked')?.value ?? null,
    roller: [...yta.querySelectorAll('[name="fb-roll"]:checked')].map(x => x.value),
    enheter: [...yta.querySelectorAll('[name="fb-enhet"]:checked')].map(x => x.value),
    falt: [],
  };
  if (!ut.roller.length) ut.roller = null;
  if (!ut.enheter.length) ut.enheter = null;
  const upptagna = new Set();
  [...yta.querySelectorAll('.fb-fraga')].forEach((li, i) => {
    const g = def.falt[Number(li.dataset.i)] ?? {};
    const v = (k) => li.querySelector(`[data-f="${k}"]`);
    const f = { id: g.id, fraga: v('fraga').value.trim(), typ: v('typ').value, sokord: v('sokord').value, obligatoriskt: v('obligatoriskt').checked };
    if (!f.id) f.id = nyckel(f.fraga || `fraga ${i + 1}`, upptagna);
    upptagna.add(f.id);
    if (g.hjalp) f.hjalp = g.hjalp;
    if (g.kod) f.kod = g.kod;
    if (v('alternativ')) f.alternativ = altLas(v('alternativ').value, g.alternativ);
    if (v('poang_ja') && (v('poang_ja').value !== '' || v('poang_nej').value !== '')) f.poang = { ja: Number(v('poang_ja').value || 0), nej: Number(v('poang_nej').value || 0) };
    for (const k of ['min', 'max']) if (v(k)) f[k] = v(k).value === '' ? null : Number(v(k).value.replace(',', '.'));
    if (v('enhet')?.value.trim()) f.enhet = v('enhet').value.trim();
    if (v('maxLangd')) f.maxLangd = Number(v('maxLangd').value);
    if (v('matvarde')) f.matvarde = v('matvarde').value;
    if (v('bild')) { f.bild = v('bild').value; f.maxMarkeringar = g.maxMarkeringar ?? 10; }
    if (v('forifyll')?.value) f.forifyll = v('forifyll').value;
    if (v('visaOm')?.value.trim()) f.visaOm = villkorLas(v('visaOm').value);
    ut.falt.push(f);
  });
  const sn = yta.querySelector('#fb-skala').value.trim();
  const st = yta.querySelector('#fb-tolkning').value.trim();
  if (sn || st) ut.skala = { namn: sn, tolkning: tolkLas(st, def.skala?.tolkning), ...(def.skala?.kalla ? { kalla: def.skala.kalla } : {}) };
  const rg = yta.querySelector('#fb-regler').value.trim();
  if (rg) ut.regler = reglerLas(rg);
  return ut;
}

function byggare(main, { def: start, kod = null, version = null }) {
  let def = structuredClone(start);
  const rita = () => {
    main.innerHTML = `${vyRubrik(kod ? `Ny version av ${def.namn}` : 'Nytt formulär', 'Bygg formuläret med frågor och fasta svar. Systemet förhandsvisar det medan du bygger och säger vad som behöver ändras. Det gäller först när en annan systemförvaltare har godkänt det.')}
      <div class="fb-delad"><form class="fb-form" novalidate aria-label="Formulärets innehåll">
        <div class="falt-rad"><div class="falt bred"><label for="fb-namn">Namn, som blir anteckningens typ i journalen</label><input id="fb-namn" value="${esc(def.namn ?? '')}" maxlength="60" autocomplete="off"${kod ? ' readonly' : ''}></div></div>
        <div class="falt"><label for="fb-beskrivning">Beskrivning</label><textarea id="fb-beskrivning" rows="2" maxlength="500">${esc(def.beskrivning ?? '')}</textarea></div>
        <fieldset class="kryssgrupp"><legend>Vem skriver och läser</legend>${stenar.kategorier.map(k => `<div class="kryssfalt"><input type="radio" id="fb-kat-${k.id}" name="fb-kategori" value="${k.id}"${(def.kategori ?? 'omvardnad') === k.id ? ' checked' : ''}><label for="fb-kat-${k.id}">${esc(k.text)}</label></div>`).join('')}</fieldset>
        <details class="fb-behorighet"${def.roller || def.enheter ? ' open' : ''}><summary>Bara vissa yrken eller vårdenheter</summary>
          <fieldset class="kryssgrupp"><legend>Yrken som fyller i formuläret. Inget val betyder alla som får skriva anteckningen.</legend>${stenar.yrken.map(y => `<div class="kryssfalt"><input type="checkbox" id="fb-roll-${y.id}" name="fb-roll" value="${y.id}"${def.roller?.includes(y.id) ? ' checked' : ''}><label for="fb-roll-${y.id}">${esc(y.namn)}</label></div>`).join('')}</fieldset>
          <fieldset class="kryssgrupp"><legend>Vårdenheter som använder formuläret. Inget val betyder alla.</legend>${stenar.vardenheter.map(e => `<div class="kryssfalt"><input type="checkbox" id="fb-enhet-${esc(e.id)}" name="fb-enhet" value="${esc(e.id)}"${def.enheter?.includes(e.id) ? ' checked' : ''}><label for="fb-enhet-${esc(e.id)}">${esc(e.namn)}</label></div>`).join('')}</fieldset>
        </details>
        <h2>Frågor</h2>
        <ol class="fb-fragor">${def.falt.map((f, i) => fragaKort(f, i, def.falt)).join('')}</ol>
        <button type="button" class="knapp sekundar" data-ny-fraga>Lägg till fråga</button>
        <h2>Skala och regler</h2>
        <div class="falt-rad"><div class="falt"><label for="fb-skala">Skalans namn</label><input id="fb-skala" value="${esc(def.skala?.namn ?? '')}" maxlength="60" autocomplete="off"></div>
          <div class="falt bred"><label for="fb-tolkning">Tolkning av poängen, en per rad. Utropstecken först ger en varning.</label><textarea id="fb-tolkning" rows="2" placeholder="0-2 Låg risk">${esc(tolkText(def.skala?.tolkning))}</textarea></div></div>
        <div class="falt"><label for="fb-regler">Regler, en per rad: villkor, kolon och texten som visas</label><textarea id="fb-regler" rows="2" placeholder="poäng minst 3: Hög risk. Planera åtgärder.">${esc(reglerText(def.regler))}</textarea></div>
        <div class="knapprad"><button type="button" class="knapp" data-foresla>Föreslå formuläret</button><button type="button" class="knapp text" data-avbryt>Avbryt</button></div>
      </form>
      <aside class="fb-forhand" aria-label="Förhandsvisning" data-forhand aria-live="polite"><p class="tom">Förhandsvisningen kommer när formuläret har en fråga.</p></aside></div>`;
    koppla();
  };
  let timer = null;
  let nr = 0;
  const forhand = async () => {
    const mitt = ++nr;
    const d = lasDef(main, def);
    const ruta = main.querySelector('[data-forhand]');
    if (!d.falt.length || !ruta) return;
    let f;
    try { f = await api('/api/formular/forhandsvisa', { metod: 'POST', data: { definition: d, kod }, tyst: true }); } catch { return; }
    if (mitt !== nr || !ruta.isConnected) return;
    ruta.innerHTML = f.ok ? `<p class="ruta ruta-info liten" role="status">Formuläret går att använda. ${esc(f.andring)}</p>
        ${f.kodforslag.length ? `<div class="ruta ruta-info liten"><p><strong>Systemet föreslår koder:</strong></p><ul>${f.kodforslag.map((k, i) => `<li>${esc(k.text)} för svaret ${esc(d.falt.find(x => x.id === k.falt)?.alternativ?.find(a => a.varde === k.varde)?.text ?? '')} <button type="button" class="knapp liten sekundar" data-kod="${i}">Använd koden</button></li>`).join('')}</ul></div>` : ''}
        ${f.koder.length ? `<p class="liten">Koder: ${f.koder.map(k => `${esc(k.text)} för ${esc(k.var)}`).join('. ')}.</p>` : ''}
        <h3>Så ser formuläret ut</h3><div class="fb-exempel">${formular.modul({ kod: 'forhand', version: version ?? 1, definition: f.varde }).falt({})}</div>
        <h3>Texten som ett exempel på svar ger</h3><dl class="sokord">${f.exempel.map(s => `<div><dt>${esc(s.sokord)}</dt><dd>${esc(s.text)}</dd></div>`).join('')}</dl>`
      : `<p class="ruta ruta-larm liten" role="status">${esc(f.varfor)}</p>`;
    ruta.onclick = (e) => {
      const b = e.target.closest('[data-kod]');
      if (!b) return;
      const k = f.kodforslag[Number(b.dataset.kod)];
      def = lasDef(main, def);
      const a = def.falt.find(x => x.id === k.falt)?.alternativ?.find(x => x.varde === k.varde);
      if (a) a.kod = k.kod;
      notis(`Svaret har nu koden ${k.text}.`);
      rita();
    };
  };
  const koppla = () => {
    const form = main.querySelector('.fb-form');
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(forhand, 300); });
    form.addEventListener('change', (e) => {
      // En ny datatyp ger frågan sina egna fält.
      if (e.target.matches('[data-f="typ"]')) { def = lasDef(main, def); const i = Number(e.target.closest('.fb-fraga').dataset.i); rita(); main.querySelector(`#fb-${i}-typ`)?.focus(); }
      clearTimeout(timer); timer = setTimeout(forhand, 50);
    });
    form.addEventListener('click', async (e) => {
      if (e.target.closest('[data-ny-fraga]')) {
        def = lasDef(main, def);
        def.falt.push({ id: nyckel(`fraga ${def.falt.length + 1}`, new Set(def.falt.map(f => f.id))), fraga: '', typ: 'ja_nej', sokord: R.SOKORD_STANDARD });
        rita();
        main.querySelector(`#fb-${def.falt.length - 1}-fraga`).focus();
        return;
      }
      const upp = e.target.closest('[data-upp]');
      const bort = e.target.closest('[data-bort]');
      if (upp || bort) {
        def = lasDef(main, def);
        const i = Number((upp ?? bort).dataset[upp ? 'upp' : 'bort']);
        if (upp) [def.falt[i - 1], def.falt[i]] = [def.falt[i], def.falt[i - 1]]; else def.falt.splice(i, 1);
        rita();
        return;
      }
      if (e.target.closest('[data-avbryt]')) { formularVy.visa(main); return; }
      const fs = e.target.closest('[data-foresla]');
      if (fs) {
        const d = lasDef(main, def);
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Föreslå ${esc(d.namn || 'formuläret')}</h2>
          <div class="falt"><label for="fb-motivering">Varför behövs formuläret eller ändringen? <span class="obl">(obligatoriskt)</span></label><textarea id="fb-motivering" name="motivering" rows="3" required maxlength="1000"></textarea>
          <p class="hjalp">Motiveringen följer med versionen i historiken. En annan systemförvaltare godkänner den.</p></div>
          <p class="dialog-fel ruta ruta-larm liten" hidden></p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Föreslå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
        if (!svar) return;
        try {
          await medKnapp(fs, () => api('/api/formular', { metod: 'POST', data: { definition: d, kod, motivering: svar.data.motivering } }));
          notis('Formuläret är föreslaget. Det gäller när en annan systemförvaltare har godkänt det.');
          formularVy.visa(main);
        } catch { /* felet visas som notis */ }
      }
    });
    forhand();
  };
  rita();
  main.querySelector('#fb-namn')?.focus();
}

const statusTagg = (v) => `<span class="tagg${v.status === 'aktiv' ? ' tagg-ok' : v.status === 'vantar' ? ' tagg-utkast' : ''}">${esc(v.statusText)}</span>`;

export const formularVy = {
  namn: 'formular',
  async visa(main) {
    main.innerHTML = vyRubrik('Formulär', 'Verksamhetens formulär med fasta svar, skalor, regler, kroppsbild och förifyllnad ur journalen. Varje version gäller först när en annan systemförvaltare har godkänt den, och det som har skrivits med en äldre version visas som det skrevs.') + '<div id="fb-lista"><p class="tom">Hämtar.</p></div>';
    const [o, s] = await Promise.all([api('/api/formular'), stenar ? Promise.resolve(stenar) : api('/api/formular/byggstenar')]);
    stenar = s;
    const el = main.querySelector('#fb-lista');
    if (!el) return;
    el.innerHTML = `<div class="knapprad"><button type="button" class="knapp" data-nytt>Nytt formulär</button></div>
      ${o.formular.map(f => `<section class="lm-sektion" aria-labelledby="fb-${esc(f.kod)}"><h2 id="fb-${esc(f.kod)}">${esc(f.namn)}</h2>
        <p class="liten">${f.gallande ? `Version ${f.gallande} gäller.` : 'Ingen version gäller.'} ${f.anteckningar} anteckningar har skrivits med formuläret.</p>
        <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Ändring</th><th scope="col">Föreslagen och beslutad</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead><tbody>
        ${f.versioner.map(v => `<tr><th scope="row">${v.version}</th><td>${statusTagg(v)}</td><td>${esc(v.andring ?? '')}<br><span class="dampad liten">Motivering: ${esc(v.motivering)}</span></td>
          <td>${esc(v.foreslagenAv)}, ${esc(tidpunkt(v.foreslagen))}${v.beslutadAv ? `<br>${v.status === 'avslagen' ? 'Avslagen' : 'Godkänd'} av ${esc(v.beslutadAv)}, ${esc(tidpunkt(v.beslutad))}` : ''}${v.kommentar ? `<br><span class="dampad liten">${esc(v.kommentar)}</span>` : ''}${v.avvecklad ? `<br>Avvecklad av ${esc(v.avvecklad.av)}: ${esc(v.avvecklad.motivering)}` : ''}</td>
          <td class="atgarder">${v.kanGodkanna ? `<button type="button" class="knapp liten" data-godkann="${v.id}">Godkänn</button> <button type="button" class="knapp liten sekundar" data-avsla="${v.id}">Avslå</button>` : ''}${v.status === 'vantar' && v.egen ? `<button type="button" class="knapp liten sekundar" data-aterkalla="${v.id}">Återkalla</button>` : ''}${v.status === 'aktiv' ? `${f.versioner.some(x => x.status === 'vantar') ? '' : `<button type="button" class="knapp liten sekundar" data-version="${esc(f.kod)}">Ny version</button> `}<button type="button" class="knapp liten text" data-avveckla="${v.id}">Avveckla</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></section>`).join('')}`;
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      try {
        if (b.matches('[data-nytt]')) return byggare(main, { def: { namn: '', kategori: 'omvardnad', falt: [{ id: 'fraga_1', fraga: '', typ: 'ja_nej', sokord: R.SOKORD_STANDARD }] } });
        if (b.dataset.version) {
          const f = o.formular.find(x => x.kod === b.dataset.version);
          const v = f.versioner.find(x => x.status === 'aktiv');
          return byggare(main, { def: v.definition, kod: f.kod, version: v.version + 1 });
        }
        if (b.dataset.godkann) { await medKnapp(b, () => api(`/api/formular/${b.dataset.godkann}/godkann`, { metod: 'POST', data: {} })); notis('Formuläret är godkänt och gäller nu. Den förra versionen är ersatt.'); }
        if (b.dataset.aterkalla) { await medKnapp(b, () => api(`/api/formular/${b.dataset.aterkalla}/avsla`, { metod: 'POST', data: {} })); notis('Förslaget är återkallat.'); }
        if (b.dataset.avsla || b.dataset.avveckla) {
          const avveckla = Boolean(b.dataset.avveckla);
          const svar = await dialog(`<form><h2 id="dlg-rubrik">${avveckla ? 'Avveckla formuläret' : 'Avslå versionen'}</h2>
            <div class="falt"><label for="fb-kommentar">${avveckla ? 'Varför avvecklas det?' : 'Varför avslås den?'} <span class="obl">(obligatoriskt)</span></label><textarea id="fb-kommentar" name="kommentar" rows="3" required maxlength="500"></textarea>
            <p class="hjalp">${avveckla ? 'Det som har skrivits med formuläret finns kvar och visas som förut. Nya anteckningar kan inte skrivas med det.' : 'Den som föreslog versionen ser kommentaren i historiken.'}</p></div>
            <div class="knapprad"><button type="button" class="knapp" data-varde="ok">${avveckla ? 'Avveckla' : 'Avslå'}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
          if (!svar) return;
          if (avveckla) await medKnapp(b, () => api(`/api/formular/${b.dataset.avveckla}/avveckla`, { metod: 'POST', data: { motivering: svar.data.kommentar } }));
          else await medKnapp(b, () => api(`/api/formular/${b.dataset.avsla}/avsla`, { metod: 'POST', data: { kommentar: svar.data.kommentar } }));
          notis(avveckla ? 'Formuläret är avvecklat.' : 'Versionen är avslagen.');
        }
        formularVy.visa(main);
      } catch { /* felet visas som notis */ }
    });
  },
};
