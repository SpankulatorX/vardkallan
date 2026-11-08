// Runda 10, r3: ett formulär som verksamheten har byggt, ifyllt i en anteckning (Sussa 3.1.3.1, 3.1.3.5 och 5.1.1.3).
// Frågorna ritas ur formulärets definition med samma regler som servern använder (formularmotor-regler.js): systemet
// visar bara de frågor som gäller, fyller i det som finns i journalen och säger varifrån, räknar poängen och visar vad
// den betyder, visar reglernas varningar medan man fyller i och skriver vilken kroppsdel och sida en markering i
// kroppsbilden ligger på. Servern kontrollerar och räknar om allt när anteckningen sparas.
//
// Modulen har samma gränssnitt som mallarna för tobaksvanor och levnadsvanor: falt(svar) ger formulärets innehåll,
// koppla(form, ...) kopplar händelserna och las(form) läser svaren.
import { esc, api } from '../ui.js';
import * as R from '../formularmotor-regler.js';

const id = (...d) => `fm-${d.join('-')}`;
const talText = (n) => String(n).replace('.', ',');

// Kroppsbilden: bilden är dubbelt så hög som bred, och höjden i regionerna räknas om från procent. Regionerna ritas som rundade rektanglar, så att bilden och det systemet räknar med är detsamma.
// Markeringarna är numrerade cirklar. Bilden har en text för skärmläsare, och markeringarna står också i en lista.
export function bildSvg(falt, vy, markeringar = [], { las = false } = {}) {
  const v = R.BILDER[falt.bild].vyer[vy];
  const nr = (m) => markeringar.indexOf(m) + 1;
  return `<figure class="fm-bild"><svg viewBox="0 0 100 200" role="img" aria-label="${esc(`${v.namn}. ${las ? '' : 'Klicka där du vill markera.'}`)}" data-vy="${vy}" data-falt="${esc(falt.id)}" class="fm-kropp${las ? ' las' : ''}" preserveAspectRatio="xMidYMid meet">
      ${v.regioner.map(r => `<rect x="${r.x1}" y="${r.y1 * 2}" width="${r.x2 - r.x1}" height="${(r.y2 - r.y1) * 2}" rx="2" class="fm-region"><title>${esc(r.text)}</title></rect>`).join('')}
      ${markeringar.filter(m => m.vy === vy).map(m => `<g class="fm-markering"><circle cx="${m.x}" cy="${m.y * 2}" r="3.2"></circle><text x="${m.x}" y="${m.y * 2 + 1.4}" text-anchor="middle">${nr(m)}</text></g>`).join('')}
    </svg><figcaption>${esc(v.namn)}</figcaption></figure>`;
}

function bildFalt(f, varde = []) {
  return `<div class="fm-bildfalt" data-bildfalt="${esc(f.id)}">
    <div class="fm-bilder">${Object.keys(R.BILDER[f.bild].vyer).map(vy => bildSvg(f, vy, varde)).join('')}</div>
    <div class="falt kompakt"><label for="${id(f.id, 'region')}">Eller välj kroppsdel</label><select id="${id(f.id, 'region')}" data-region-val><option value="">Välj kroppsdel</option>
      ${Object.entries(R.BILDER[f.bild].vyer).map(([vy, v]) => `<optgroup label="${esc(v.namn)}">${v.regioner.map(r => `<option value="${esc(`${vy}:${r.id}`)}">${esc(R.region(f.bild, vy, (r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2)?.text ?? r.text)}</option>`).join('')}</optgroup>`).join('')}
    </select></div>
    <p class="fm-bildfel ruta ruta-larm liten" role="status" hidden></p>
    <ol class="fm-markeringar">${varde.map((m, i) => markeringRad(f, m, i)).join('')}</ol>
  </div>`;
}
const markeringRad = (f, m, i) => `<li data-markering data-vy="${esc(m.vy)}" data-x="${m.x}" data-y="${m.y}">
    <span class="fm-region-text">${esc(m.regionText ?? R.region(f.bild, m.vy, m.x, m.y)?.text ?? '')}</span>
    <label class="sr" for="${id(f.id, 'm', i)}">Beskrivning av markering ${i + 1}</label>
    <input type="text" id="${id(f.id, 'm', i)}" maxlength="${R.MAX.markeringText}" value="${esc(m.text ?? '')}" placeholder="Beskrivning, till exempel rodnad" autocomplete="off" spellcheck="true" lang="sv">
    <button type="button" class="knapp liten text" data-ta-bort>Ta bort<span class="sr"> markering ${i + 1}</span></button>
  </li>`;

function fraga(f, v) {
  const etikett = `${esc(f.fraga)}${f.obligatoriskt ? ' <span class="obl">(obligatoriskt)</span>' : ''}`;
  const hjalp = f.hjalp ? `<p class="hjalp">${esc(f.hjalp)}</p>` : '';
  const kalla = '<p class="hjalp fm-kalla" data-kalla hidden></p>';
  if (f.typ === 'ja_nej' || f.typ === 'val' || f.typ === 'flerval') {
    const alt = f.typ === 'ja_nej' ? [{ varde: 'ja', text: 'Ja' }, { varde: 'nej', text: 'Nej' }] : f.alternativ;
    const typ = f.typ === 'flerval' ? 'checkbox' : 'radio';
    const vald = (a) => (Array.isArray(v) ? v.includes(a.varde) : v === a.varde);
    return `<fieldset class="kryssgrupp fm-val"><legend>${etikett}</legend>${hjalp}${alt.map(a => `<div class="kryssfalt"><input type="${typ}" id="${id(f.id, a.varde)}" name="${id(f.id)}" value="${esc(a.varde)}"${vald(a) ? ' checked' : ''}><label for="${id(f.id, a.varde)}">${esc(a.text)}</label></div>`).join('')}</fieldset>`;
  }
  if (f.typ === 'bild') return `<fieldset class="fm-bildgrupp"><legend>${etikett}</legend>${hjalp}${bildFalt(f, v ?? [])}</fieldset>`;
  if (f.typ === 'text') return `<div class="falt"><label for="${id(f.id)}">${etikett}</label>${hjalp}<textarea id="${id(f.id)}" rows="2" maxlength="${f.maxLangd}" spellcheck="true" lang="sv">${esc(v ?? '')}</textarea>${kalla}</div>`;
  const typ = f.typ === 'datum' ? 'date' : 'text';
  const inmatning = f.typ === 'datum' ? '' : ` inputmode="${f.typ === 'heltal' || f.heltal ? 'numeric' : 'decimal'}"`;
  return `<div class="falt fm-tal"><label for="${id(f.id)}">${etikett}</label>${hjalp}<span class="med-enhet"><input type="${typ}" id="${id(f.id)}"${inmatning} autocomplete="off" size="6" value="${esc(v == null ? '' : typeof v === 'number' ? talText(v) : v)}">${f.enhet ? `<span class="enhet">${esc(f.enhet)}</span>` : ''}</span>${kalla}</div>`;
}

// Modulen för ett formulär. def är formulärets definition, som servern gav med mallen eller anteckningen.
export function modul(formular) {
  const def = formular.definition;
  const falt = (svar = {}) => `<div class="formular" data-formular="${esc(formular.kod)}">
      ${def.beskrivning ? `<p class="hjalp">${esc(def.beskrivning)}</p>` : ''}
      ${def.falt.map(f => `<div class="fm-fraga" data-fraga="${esc(f.id)}">${fraga(f, svar[f.id])}</div>`).join('')}
      <div class="fm-resultat" data-fm-resultat aria-live="polite"></div>
      <p class="under-text">Formuläret ${esc(def.namn)}, version ${formular.version}.${def.skala?.kalla ? ` Skalan: ${esc(def.skala.kalla)}.` : ''}</p>
    </div>`;

  // Svaren som de står i formuläret. Tal läses med komma eller punkt.
  const las = (el) => {
    const yta = el.querySelector('[data-formular]');
    const ut = {};
    for (const f of def.falt) {
      const fr = yta.querySelector(`[data-fraga="${f.id}"]`);
      if (!fr || fr.hidden) continue;
      if (f.typ === 'ja_nej' || f.typ === 'val') { const c = fr.querySelector('input:checked'); if (c) ut[f.id] = c.value; }
      else if (f.typ === 'flerval') { const c = [...fr.querySelectorAll('input:checked')].map(x => x.value); if (c.length) ut[f.id] = c; }
      else if (f.typ === 'bild') {
        const m = [...fr.querySelectorAll('[data-markering]')].map(li => ({ vy: li.dataset.vy, x: Number(li.dataset.x), y: Number(li.dataset.y), text: li.querySelector('input').value.trim() }));
        if (m.length) ut[f.id] = m;
      } else {
        const t = fr.querySelector('input, textarea').value.trim();
        if (!t) continue;
        ut[f.id] = f.typ === 'text' || f.typ === 'datum' ? t : (Number.isFinite(Number(t.replace(',', '.'))) ? Number(t.replace(',', '.')) : t);
      }
    }
    return ut;
  };

  const koppla = (el, { svar = {}, patientId = null } = {}) => {
    const yta = el.querySelector('[data-formular]');
    const resultat = yta.querySelector('[data-fm-resultat]');
    const rita = () => {
      const s = las(el);
      const synliga = new Set(R.synligaFalt(def, s).map(f => f.id));
      for (const fr of yta.querySelectorAll('[data-fraga]')) fr.hidden = !synliga.has(fr.dataset.fraga);
      const p = R.poang(def, s);
      const v = R.varningar(def, s);
      resultat.innerHTML = `${p ? `<p class="ruta ${p.tolkning?.varning ? 'ruta-larm' : 'ruta-info'} liten"><strong>${esc(p.namn)}: ${p.summa} poäng${p.tolkning ? `, ${esc(p.tolkning.text.toLowerCase())}` : ''}.</strong> Systemet räknar poängen ur svaren.</p>` : ''}
        ${v.map(x => `<p class="ruta ${x.varning ? 'ruta-larm' : 'ruta-info'} liten">${esc(x.text)}</p>`).join('')}`;
    };
    // Ett klick i kroppsbilden lägger en markering. Systemet skriver kroppsdelen och sidan och flyttar fokus till
    // beskrivningen. Ett klick utanför kroppen förklaras.
    yta.addEventListener('click', (e) => {
      const svg = e.target.closest('svg.fm-kropp');
      const bort = e.target.closest('[data-ta-bort]');
      if (bort) {
        const ruta = bort.closest('[data-bildfalt]');
        bort.closest('[data-markering]').remove();
        ritaBild(ruta);
        rita();
        return;
      }
      if (!svg || svg.classList.contains('las')) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      markera(svg.closest('[data-bildfalt]'), svg.dataset.vy, Math.round(p.x * 10) / 10, Math.round((p.y / 2) * 10) / 10);
    });
    // Utan mus väljs kroppsdelen i listan, och markeringen hamnar mitt i den.
    yta.addEventListener('change', (e) => {
      const val = e.target.closest('[data-region-val]');
      if (!val || !val.value) return;
      const ruta = val.closest('[data-bildfalt]');
      const f = def.falt.find(x => x.id === ruta.dataset.bildfalt);
      const [vy, rid] = val.value.split(':');
      const r = R.BILDER[f.bild].vyer[vy].regioner.find(g => g.id === rid);
      val.value = '';
      if (r) markera(ruta, vy, (r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2);
    });
    const markera = (ruta, vy, x, y) => {
      const f = def.falt.find(z => z.id === ruta.dataset.bildfalt);
      const fel = ruta.querySelector('.fm-bildfel');
      const r = R.region(f.bild, vy, x, y);
      if (!r) { fel.textContent = 'Markeringen hamnade utanför kroppen. Klicka på kroppen, så skriver systemet vilken kroppsdel det är.'; fel.hidden = false; return; }
      fel.hidden = true;
      const lista = ruta.querySelector('.fm-markeringar');
      if (lista.children.length >= f.maxMarkeringar) { fel.textContent = `Frågan kan ha högst ${f.maxMarkeringar} markeringar.`; fel.hidden = false; return; }
      lista.insertAdjacentHTML('beforeend', markeringRad(f, { vy, x, y, regionText: r.text }, lista.children.length));
      ritaBild(ruta);
      lista.lastElementChild.querySelector('input').focus();
      rita();
    };
    const ritaBild = (ruta) => {
      const f = def.falt.find(x => x.id === ruta.dataset.bildfalt);
      const m = [...ruta.querySelectorAll('[data-markering]')].map(li => ({ vy: li.dataset.vy, x: Number(li.dataset.x), y: Number(li.dataset.y) }));
      ruta.querySelector('.fm-bilder').innerHTML = Object.keys(R.BILDER[f.bild].vyer).map(vy => bildSvg(f, vy, m)).join('');
      [...ruta.querySelectorAll('[data-markering]')].forEach((li, i) => { li.querySelector('.sr').textContent = `Beskrivning av markering ${i + 1}`; });
    };
    yta.addEventListener('change', rita);
    yta.addEventListener('input', rita);
    rita();
    // Förifyllnaden: tomma fält fylls i med det som journalen har, och källan står under fältet.
    if (patientId && !Object.keys(svar).length) {
      api(`/api/patient/${encodeURIComponent(patientId)}/formular/${encodeURIComponent(formular.kod)}/forifyllnad`, { tyst: true }).then((f) => {
        if (!yta.isConnected) return;
        for (const [fid, x] of Object.entries(f.varden ?? {})) {
          const fr = yta.querySelector(`[data-fraga="${fid}"]`);
          const inp = fr?.querySelector('input, textarea');
          if (!inp || inp.value) continue;
          inp.value = typeof x.varde === 'number' ? talText(x.varde) : x.varde;
          const k = fr.querySelector('[data-kalla]');
          if (k) { k.textContent = `Ifyllt av systemet: ${x.kalla}.`; k.hidden = false; }
        }
        rita();
      }).catch(() => { /* utan förifyllnad fyller man i själv */ });
    }
  };
  return { falt, las, koppla };
}

// Kroppsbilden med markeringarna när en signerad anteckning läses.
export function lasBild(formular) {
  const def = formular.definition;
  return def.falt.filter(f => f.typ === 'bild' && formular.svar?.[f.id]?.length).map(f => `<div class="fm-las"><p class="fm-las-rubrik">${esc(f.fraga)}</p>
    <div class="fm-bilder">${Object.keys(R.BILDER[f.bild].vyer).map(vy => bildSvg(f, vy, formular.svar[f.id], { las: true })).join('')}</div></div>`).join('');
}
