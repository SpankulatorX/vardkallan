// Fel i rapporterna till myndigheter och register, i inkorgen (runda 7, r5, Sussa 6.3.2). Läkaren sätter en saknad
// diagnos med systemets förslag eller svarar på tre frågor om en yttre orsak, och systemet sätter koden. Vårdadministratören
// får saknade identiteter och väntelistans uppgifter med en länk dit de rättas. Raden finns bara när behörighetsmotorn
// ger åtkomst till patienten på den egna vårdenheten.
import { esc, api, dialog, medKnapp, notis, datum } from './ui.js';

const KNAPP = { diagnos: 'Sätt diagnos', yttre_orsak: 'Ange yttre orsak' };
const LANK = { identitet: (r) => `#/patient/${encodeURIComponent(r.patientId)}/identitet`, aktivitet: () => '#/vantelista', vantelista: () => '#/vantelista' };
const pnamn = (p) => (p?.skyddad ? 'Skyddad identitet' : p?.namn ?? '');

export function rapportfelSektion(d, sektion) {
  const rader = (d.rapportfel ?? []).map((r, i) => {
    const knapp = KNAPP[r.atgard];
    const lank = LANK[r.atgard]?.(r);
    return `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik"><a href="#/patient/${encodeURIComponent(r.patientId)}">${esc(pnamn(r.patient))}</a>: ${esc(r.text)}</span>
      <span class="under-text">${esc(r.rapporter.join(', '))}${r.datum ? `, vårdkontakt ${esc(datum(r.datum))}` : ''}. Kontakten hålls kvar och följer med av sig själv i nästa rapport när det är rättat.</span></div>
      <div class="ik-knappar">${knapp ? `<button type="button" class="knapp liten" data-rapportfel="${i}">${esc(knapp)}</button>` : lank ? `<a class="knapp liten sekundar" href="${esc(lank)}">Rätta</a>` : ''}</div></li>`;
  });
  return rader.length ? sektion('rapportfel', 'Att rätta före rapportering', rader, '', 'Uppgifter som saknas eller är fel i rapporterna till myndigheter och register. Systemet har hittat dem och föreslår hur de rättas.') : '';
}

let val = null;
const hamtaVal = async () => (val ??= await api('/api/rapportering/rattning/val'));

async function diagnosDialog(r) {
  const v = await hamtaVal();
  const forslag = r.forslag ?? [];
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Sätt diagnos</h2><p>${esc(r.text)}</p>
    ${forslag.length ? `<fieldset class="radiogrupp"><legend>Systemets förslag ur patientens tidigare diagnoser</legend>${forslag.map((f, i) => `<label class="radio"><input type="radio" name="kod" value="${esc(f.kod)}"${i === 0 ? ' checked' : ''}> ${esc(f.kod)} ${esc(f.text)}</label>`).join('')}</fieldset>` : ''}
    <div class="falt"><label for="rf-annan">${forslag.length ? 'Annan diagnos' : 'Diagnos'}</label><select id="rf-annan" name="annan"><option value="">${forslag.length ? 'Välj om förslaget inte passar' : 'Välj diagnos'}</option>${v.diagnoser.map(d => `<option value="${esc(d.kod)}">${esc(d.kod)} ${esc(d.text)}</option>`).join('')}</select></div>
    <p class="under-text">Systemet avgör om det är huvud- eller bidiagnos och sätter datumet ur vårdkontakten.</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (d) => (!(d.annan || d.kod) ? 'Välj en diagnos.' : null), onOpen: (dl) => dl.querySelector('[data-varde="ok"]').focus() });
  return svar ? { kod: svar.data.annan || svar.data.kod } : null;
}

async function yttreDialog(r) {
  const v = (await hamtaVal()).yttreOrsak;
  const lista = (namn, rubrik, poster) => `<div class="falt"><label for="rf-${namn}">${esc(rubrik)}</label><select id="rf-${namn}" name="${namn}">${poster.map(p => `<option value="${esc(p.kod)}"${p.kod === v.forval[namn] ? ' selected' : ''}>${esc(p.text)}</option>`).join('')}</select></div>`;
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Ange yttre orsak</h2><p>${esc(r.text)}</p>
    ${lista('mekanism', 'Vad hände?', v.mekanism)}${lista('plats', 'Var hände det?', v.plats)}${lista('aktivitet', 'Vad gjorde patienten?', v.aktivitet)}
    <p class="under-text">Systemet sätter koden ur kapitlet om yttre orsaker i ICD-10-SE. Ospecificerat går att spara, men ett preciserat svar ger bättre statistik.</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { onOpen: (dl) => dl.querySelector('[data-varde="ok"]').focus() });
  return svar ? svar.data : null;
}

// Klick i inkorgen. Returnerar true när klicket gällde ett rapportfel.
export async function rapportfelKlick(e, d, efter) {
  const b = e.target.closest('[data-rapportfel]');
  if (!b) return false;
  const r = d.rapportfel[Number(b.dataset.rapportfel)];
  const kropp = r.atgard === 'yttre_orsak' ? await yttreDialog(r) : await diagnosDialog(r);
  if (!kropp) return true;
  try {
    const ut = await medKnapp(b, () => api(`/api/vardkontakt/${encodeURIComponent(r.vardkontaktId)}/diagnos`, { metod: 'POST', data: kropp }));
    notis(`${ut.kod} ${ut.text} är registrerad som ${ut.typ === 'huvud' ? 'huvuddiagnos' : 'bidiagnos'}.`);
    await efter();
  } catch { /* felet visas som notis */ }
  return true;
}
