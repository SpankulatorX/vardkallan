// Moduler (runda 11, r8): varje modul med status, var den nås, vad som är simulerat och hur många av dess krav som är
// uppfyllda. Allt kommer från modulregistret i servern (GET /api/moduler), som räknar statusen ur koden och
// kravregistret. Vyn har inga egna listor, så den kan inte säga något annat än det som finns.
import { esc, api, ikon, vyRubrik } from '../ui.js';

export const namn = 'moduler';

const KLASS = { demo: 'modul-finns', api: 'modul-api', planerat: 'modul-planerat' };
const IKON = { demo: 'bock', api: 'kod', planerat: 'klocka' };
const ORDNING = ['demo', 'api', 'planerat'];
const st = (n, en, flera) => `${n} ${n === 1 ? en : flera}`;

// Var modulen nås: menyns rader, flikarna i journalen och Min journal, offentliga sidor och modulens egen text.
function nas(m) {
  const ut = [];
  const meny = [...new Set(m.rutter.filter(r => r.finns && r.meny).map(r => r.meny))];
  if (meny.length) ut.push(`Menyn: ${meny.map(esc).join(', ')}`);
  const offentliga = m.rutter.filter(r => r.finns && r.offentlig && !r.meny && !r.vag.includes(':'));
  for (const r of offentliga) ut.push(`<a href="${esc(r.vag)}">${esc(m.namn)}</a>, utan inloggning`);
  const flikar = m.journal.filter(f => f.finns && f.namn).map(f => f.namn);
  if (flikar.length) ut.push(`Journalen: ${flikar.length === 1 ? 'fliken' : 'flikarna'} ${flikar.map(esc).join(', ')}`);
  const min = m.min.filter(f => f.finns && f.namn).map(f => f.namn);
  if (min.length) ut.push(`Min journal: ${min.map(esc).join(', ')}`);
  if (m.nas) ut.push(esc(m.nas));
  return ut.length ? `<p class="modul-nas"><strong>Nås från</strong> ${ut.join('. ')}.</p>` : '';
}

function krav(m) {
  if (!m.avsnitt.length) return '<p class="modul-krav dampad">Inga egna poster i Sussas kravspecifikation.</p>';
  const p = m.poster;
  const delar = [`${p.uppfyllt_demo} uppfyllda`, `${p.delvis} delvis`, ...(p.planerat ? [`${p.planerat} planerade`] : [])].join(', ');
  return `<p class="modul-krav"><strong>Krav</strong> <span class="krav-id">${m.avsnitt.map(a => esc(a.id)).join(', ')}</span>: ${esc(delar)} av ${esc(st(p.totalt, 'post', 'poster'))}. <a href="${esc(m.kravLank)}" aria-label="${esc(`Visa kraven för ${m.namn} på kravsidan`)}">Visa kraven</a></p>`;
}

const kort = (m) => `<li class="modul ${KLASS[m.status]}" data-modul="${esc(m.id)}" data-status="${esc(m.status)}">
    <span class="modul-status">${ikon[IKON[m.status]]}${esc(m.statusText)}</span>
    <h4>${esc(m.namn)}</h4>
    <p>${esc(m.beskrivning)}</p>
    ${nas(m)}
    ${m.simulerat ? `<p class="modul-simulerat"><strong>Simulerat</strong> ${esc(m.simulerat)}</p>` : ''}
    ${krav(m)}
  </li>`;

export async function visa(main, _p, _q, { aktuell = () => true } = {}) {
  main.innerHTML = vyRubrik('Moduler', 'Hela vården ska rymmas i ett öppet system, en modul i taget. Sidan räknar själv fram vad som finns, ur koden och kravregistret: en modul finns i demon när den har en plats i gränssnittet, och antalet krav kommer från samma testresultat som kravsidan.') + '<p class="tom" id="mod-hamtar">Hämtar modulerna.</p>';
  const d = await api('/api/moduler');
  if (!aktuell()) return;
  const s = d.summa;
  const grupp = (status) => {
    const moduler = d.moduler.filter(m => m.status === status);
    if (!moduler.length) return '';
    const omraden = d.omraden.map(o => ({ ...o, moduler: moduler.filter(m => m.omrade === o.id) })).filter(o => o.moduler.length);
    return `<section aria-labelledby="mod-${status}" class="modulgrupp" data-grupp="${status}">
      <h2 id="mod-${status}">${esc(d.statusar[status].rubrik)} <span class="antal">${moduler.length}</span></h2>
      <p class="dampad">${esc(d.statusar[status].text)}</p>
      ${omraden.map(o => `<h3 class="modul-omrade">${esc(o.namn)}</h3><ul class="modullista">${o.moduler.map(kort).join('')}</ul>`).join('')}
    </section>`;
  };
  main.querySelector('#mod-hamtar').outerHTML = `<p class="modul-summa" id="mod-summa">${esc(`${st(d.moduler.length, 'modul', 'moduler')}: ${s.demo} finns i demon, ${s.api} finns i API:t och ${s.planerat} återstår.`)}</p>
    ${ORDNING.map(grupp).join('')}`;
}
