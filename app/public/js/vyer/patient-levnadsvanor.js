// Runda 9, r7: formuläret för levnadsvanorna alkohol, fysisk aktivitet och matvanor i en anteckning (Sussa 6.2.2.1), med
// samma gränssnitt som formuläret för tobaksvanor (falt, las och koppla). Den som dokumenterar fyller i de områden som
// samtalet gällde. Systemet räknar risken och visar direkt vilket stöd riktlinjerna rekommenderar och vilken KVÅ-kod det
// har. Servern kontrollerar och räknar om allt när anteckningen sparas (src/levnadsvanor.js).
import { esc } from '../ui.js';
import * as R from '../levnadsvanor-regler.js';

const id = (...d) => `lv-${d.join('-')}`;
const tal = (namn, etikett, varde, enhet) => `<div class="falt"><label for="${id(namn)}">${esc(etikett)}</label><span class="med-enhet"><input id="${id(namn)}" name="${esc(namn)}" inputmode="numeric" autocomplete="off" size="5" value="${esc(varde ?? '')}"><span class="enhet">${esc(enhet)}</span></span></div>`;
const val = (namn, etikett, alternativ, varde) => `<div class="falt"><label for="${id(namn)}">${esc(etikett)}</label><select id="${id(namn)}" name="${esc(namn)}"><option value="">Välj</option>${alternativ.map(([v, t]) => `<option value="${esc(v)}"${String(varde ?? '') === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;

export function falt(svar = {}) {
  const a = svar.alkohol ?? {};
  const f = svar.fysisk ?? {};
  const m = svar.mat ?? {};
  return `<div class="levnadsvanor" data-levnadsvanor>
    <fieldset><legend>Alkohol</legend>
      ${tal('glasPerVecka', 'Antal standardglas en vanlig vecka', a.glasPerVecka, 'glas')}
      ${val('berusning', 'Hur ofta fyra standardglas eller fler vid samma tillfälle', R.BERUSNING, a.berusning)}
    </fieldset>
    <fieldset><legend>Fysisk aktivitet</legend>
      ${tal('traningMinuter', 'Fysisk träning en vanlig vecka', f.traningMinuter, 'minuter')}
      ${tal('vardagMinuter', 'Vardagsmotion en vanlig vecka', f.vardagMinuter, 'minuter')}
    </fieldset>
    <fieldset><legend>Matvanor</legend>
      ${R.MATFRAGOR.map(q => val(`mat-${q.id}`, q.text, q.alternativ.map(([v, t]) => [v, t]), m[q.id])).join('')}
    </fieldset>
    <div data-lv-forslag aria-live="polite"></div>
    <div class="falt"><label for="${id('kommentar')}">Kommentar</label><textarea id="${id('kommentar')}" name="kommentar" rows="2" maxlength="${R.KOMMENTAR_MAX}">${esc(svar.kommentar ?? '')}</textarea></div>
  </div>`;
}

// Svaren ur formuläret. Ett område som inte är ifyllt kommer inte med.
export function las(el) {
  const v = (n) => el.querySelector(`[name="${n}"]`)?.value?.trim() ?? '';
  const ut = { stod: {}, givet: {} };
  if (v('glasPerVecka') !== '' || v('berusning')) ut.alkohol = { glasPerVecka: v('glasPerVecka'), berusning: v('berusning') };
  if (v('traningMinuter') !== '' || v('vardagMinuter') !== '') ut.fysisk = { traningMinuter: v('traningMinuter'), vardagMinuter: v('vardagMinuter') };
  if (R.MATFRAGOR.some(q => v(`mat-${q.id}`))) ut.mat = Object.fromEntries(R.MATFRAGOR.map(q => [q.id, v(`mat-${q.id}`)]));
  for (const omr of Object.keys(R.OMRADEN)) {
    const s = el.querySelector(`[name="stod-${omr}"]`)?.value;
    if (s) ut.stod[omr] = s;
    if (el.querySelector(`[name="givet-${omr}"]`)?.checked) ut.givet[omr] = true;
  }
  ut.kommentar = v('kommentar');
  return ut;
}

// Systemets förslag visas medan formuläret fylls i, med frågan om stödet för de områden där riktlinjerna föreslår stöd.
export function koppla(el, { alder = null, svar = {} } = {}) {
  const ruta = el.querySelector('[data-lv-forslag]');
  if (!ruta) return;
  const rita = () => {
    const nu = las(el);
    const tidigare = { stod: { ...(svar.stod ?? {}), ...nu.stod }, givet: { ...(svar.givet ?? {}), ...nu.givet } };
    const varde = {};
    if (nu.alkohol && nu.alkohol.glasPerVecka !== '' && nu.alkohol.berusning) varde.alkohol = { glasPerVecka: Number(nu.alkohol.glasPerVecka), berusning: nu.alkohol.berusning };
    if (nu.fysisk && nu.fysisk.traningMinuter !== '' && nu.fysisk.vardagMinuter !== '') varde.fysisk = { traningMinuter: Number(nu.fysisk.traningMinuter), vardagMinuter: Number(nu.fysisk.vardagMinuter) };
    if (nu.mat && R.MATFRAGOR.every(q => nu.mat[q.id])) varde.mat = nu.mat;
    const f = R.forslag(varde, { alder });
    const r = R.risk(varde, { alder });
    ruta.innerHTML = Object.entries(f).map(([omr, x]) => `<div class="ruta ruta-info liten"><p><strong>${esc(R.OMRADEN[omr].namn)}</strong>: ${esc(r[omr].text)}</p>${x.kod ? `<p>Systemet föreslår ${esc(x.atgard.toLowerCase())} (KVÅ ${esc(x.kod)}). ${esc(x.motivering)}</p>
      ${val(`stod-${omr}`, 'Stödet', R.STOD, tidigare.stod[omr])}
      <label class="kryss"><input type="checkbox" name="givet-${esc(omr)}"${tidigare.givet[omr] ? ' checked' : ''}> Samtalet hölls vid besöket</label>` : `<p>${esc(x.motivering)}</p>`}</div>`).join('');
  };
  el.addEventListener('change', (e) => { if (!e.target.name?.startsWith('stod-') && !e.target.name?.startsWith('givet-')) rita(); });
  rita();
}
