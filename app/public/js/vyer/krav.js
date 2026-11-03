// Kravspårbarhet: Sussas kravspecifikation med originalnummer (standardvyn) och det egna ramverket K, D, L och M.
// Varje krav och post visas med status och de automatiska tester som visar det.
import { esc, api, tidpunkt, ikon, vyRubrik } from '../ui.js';

export const namn = 'krav';

const STATUS = { uppfyllt_demo: 'Uppfyllt i demon', delvis: 'Delvis', planerat: 'Planerat' };
const VAR = {
  '/': ['#/', 'Inloggningen'], '/drift': ['#/drift', 'Svarstider'], '/fhir/metadata': ['#/api', 'Öppet API'], '/inkorg': ['#/inkorg', 'Inkorgen'],
  '/krav': ['#/krav', 'Kravspårbarhet'], '/logg': ['#/logg', 'Logguppföljningen'], '/migrering': ['#/migrering', 'Migreringsavstämningen'],
  '/patient/:id': [null, 'patientjournalen'], '/patient/:id/anteckningar': [null, 'journalens anteckningar'],
  '/patient/:id/lakemedel': [null, 'journalens läkemedelsflik'], '/vantrum': ['#/vantrum', 'Väntrummet'],
};
const TESTSTATUS = { 'grön': ['ok', 'Grönt'], 'röd': ['fel', 'Rött'], hoppad: ['hoppad', 'Hoppades över'], saknas: ['fel', 'Saknas'], inaktuell: ['hoppad', 'Inaktuellt, gränssnittet har ändrats sedan testet kördes'] };
const GRUPP = [['K', 'Spårbarhet från krav till test'], ['D', 'Icke-funktionella krav och design'], ['L', 'Lagkrav och nationella tjänster'], ['M', 'Misstag att inte upprepa']];

export async function visa(main, _p, q) {
  const vy = q.get('vy') === 'egna' ? 'egna' : 'sussa';
  main.innerHTML = vyRubrik('Kravspårbarhet') + `<nav class="flikar" aria-label="Kravregister"><ul>
      <li><a href="#/krav"${vy === 'sussa' ? ' aria-current="page"' : ''}>Sussas kravspecifikation</a></li>
      <li><a href="#/krav?vy=egna"${vy === 'egna' ? ' aria-current="page"' : ''}>Eget ramverk</a></li>
    </ul></nav><div id="kr-vy"></div>`;
  const yta = main.querySelector('#kr-vy');
  if (vy === 'egna') await visaEgna(yta, q);
  else await visaSussa(yta, q);
}

const testkorning = (t) => `<div class="testkorning ${t?.misslyckade ? 'testkorning-rod' : 'testkorning-gron'}">${t ? `${t.misslyckade ? ikon.varning : ikon.bock}<p><strong>${t.godkanda} av ${t.antal} tester gröna</strong> i senaste bygget, ${esc(tidpunkt(t.tid))}, Bun ${esc(t.bun)}.${t.misslyckade ? ` ${t.misslyckade} röda.` : ''}</p>` : `${ikon.info}<p>Inget testresultat finns från bygget.</p>`}</div>`;

const testrader = (tester) => tester.map(x => {
  const [kl, txt] = TESTSTATUS[x.status] ?? ['fel', x.status];
  return `<li class="test test-${kl}">${kl === 'ok' ? ikon.bock : ikon.kryss}<span class="sr">${esc(txt)}: </span><span>${esc(x.namn)}</span></li>`;
}).join('');

// Det egna ramverket: K, D, L och M.
async function visaEgna(yta, q) {
  const filter = ['uppfyllt_demo', 'delvis', 'planerat'].includes(q.get('status')) ? q.get('status') : 'alla';
  yta.innerHTML = `<div class="ingress-block">
      <p>Kraven kommer från den offentliga granskningen av upphandlingen av Cosmic i Sussa-samverkan, rapporten Cosmic upphandling krav och kritik, och från lagkraven på journalsystem. Varje krav pekar på de automatiska tester som visar det, och testerna körs vid varje bygge. Ett krav räknas som uppfyllt i demon bara om alla dess tester finns och är gröna.</p>
      <p>Sussas egen kravspecifikation med originalnummer finns under fliken Sussas kravspecifikation. Uppfyllt i demon betyder att funktionen finns och är testad i demon, inte att Vårdkällan uppfyller kraven i en upphandling eller är CE-märkt.</p>
    </div><div id="kr"><p class="tom">Hämtar kravregistret.</p></div>`;
  const d = await api('/api/krav');
  const summa = d.summa;
  const urval = d.krav.filter(k => filter === 'alla' || k.status === filter);
  const filterLank = (k, text, n) => `<li><a href="#/krav?vy=egna${k === 'alla' ? '' : `&status=${k}`}"${filter === k ? ' aria-current="true"' : ''}>${esc(text)} <span class="antal">${n}</span></a></li>`;
  yta.querySelector('#kr').innerHTML = `
    ${testkorning(d.testresultat)}
    ${klientRad(d.klienttester)}
    <nav class="delflikar" aria-label="Filtrera på status"><ul>
      ${filterLank('alla', 'Alla', d.krav.length)}${filterLank('uppfyllt_demo', STATUS.uppfyllt_demo, summa.uppfyllt_demo)}${filterLank('delvis', STATUS.delvis, summa.delvis)}${filterLank('planerat', STATUS.planerat, summa.planerat)}
    </ul></nav>
    ${GRUPP.map(([pre, rubrik]) => {
      const g = urval.filter(k => k.id.startsWith(pre));
      if (!g.length) return '';
      return `<section class="kravgrupp" aria-labelledby="kg-${pre}"><h2 id="kg-${pre}">${esc(rubrik)}</h2><ul class="kravlista">${g.map(kravRad).join('')}</ul></section>`;
    }).join('') || '<p class="tom">Inga krav har den statusen.</p>'}`;
}

// Sussas kravspecifikation med originalnummer. Filtren sparas i adressen, och en post öppnas med ?post=id.
const KATEGORI = { system: 'Systemet', nationell: 'Nationell tjänst', leverantor: 'Leverantören' };
const KATEGORI_FORKLARING = {
  system: 'Posten gäller systemets funktion.',
  nationell: 'Posten kräver en nationell tjänst eller en extern part, som inte är ansluten i demon.',
  leverantor: 'Posten gäller leverantören, driften eller projektet och inte systemets funktion.',
};
const TYP = { krav_vid_anbud: 'Krav vid anbud', krav_vid_leverans: 'Krav vid leverans', utvarderingskriterium: 'Utvärderingskriterium' };
const STATUSORDNING = ['uppfyllt_demo', 'delvis', 'planerat'];
const normal = (s) => String(s ?? '').toLocaleLowerCase('sv-SE');

async function visaSussa(yta, q) {
  yta.innerHTML = '<p class="tom">Hämtar Sussas kravspecifikation.</p>';
  const d = await api('/api/krav/sussa');
  const kapitel = new Map(d.kapitel.map(k => [k.nr, k]));
  const avsnitt = new Map(d.avsnitt.map(a => [a.id, a]));
  const perId = new Map(d.poster.map(p => [p.id, p]));
  const saknade = d.saknadeKapitel.map(n => `${n} ${kapitel.get(n)?.rubrik ?? ''}`.trim());
  const val = {
    kapitel: d.kapitel.some(k => k.ingar && k.nr === q.get('kapitel')) ? q.get('kapitel') : '',
    status: STATUSORDNING.includes(q.get('status')) ? q.get('status') : '',
    kategori: KATEGORI[q.get('kategori')] ? q.get('kategori') : '',
    sok: q.get('sok') ?? '',
  };
  const s = d.summa;
  yta.innerHTML = `<div class="ingress-block">
      <p>Region Örebro läns kravspecifikation för upphandlingen av journalsystemet Cosmic, med Sussas originalnummer. Varje post visar kravtexten, hur Vårdkällan möter den, hur systemet tar expertrollen och vilka automatiska tester som visar det. En post räknas som uppfylld i demon bara om alla dess tester finns och är gröna, och en post utan tester är planerad. Uppfyllt i demon betyder inte att Vårdkällan uppfyller kraven i en upphandling.</p>
      <p class="liten">Källa: ${esc(d.kalla)}. ${esc(d.utdrag)}</p>
    </div>
    <p class="ruta ruta-info sussa-utdrag">${ikon.info}<span>Kapitel 7 till 10 och 12 ingår inte i utdraget: ${esc(saknade.join(', '))}. Registret innehåller kapitel 1 till 6 och 11, och kapitel 1 har inga krav.</span></p>
    ${testkorning(d.testresultat)}
    <div class="tabellrulle sussa-summa-rulle"><table class="tabell siffertabell sussa-summa">
      <caption>Sammanställning av ${d.poster.length} poster per kategori och status</caption>
      <thead><tr><th scope="col">Kategori</th>${STATUSORDNING.map(st => `<th scope="col" class="tal">${esc(STATUS[st])}</th>`).join('')}<th scope="col" class="tal">Totalt</th></tr></thead>
      <tbody>${Object.keys(KATEGORI).map(k => `<tr><th scope="row">${esc(KATEGORI[k])}</th>${STATUSORDNING.map(st => `<td class="tal">${s.korstabell[k][st]}</td>`).join('')}<td class="tal"><strong>${s.kategori[k]}</strong></td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">Totalt</th>${STATUSORDNING.map(st => `<td class="tal"><strong>${s.status[st]}</strong></td>`).join('')}<td class="tal"><strong>${d.poster.length}</strong></td></tr></tfoot>
    </table></div>
    <form class="sussa-filter" role="search" aria-label="Filtrera Sussas krav">
      <div class="falt-rad">
        <div class="falt"><label for="sf-kapitel">Kapitel</label><select id="sf-kapitel" name="kapitel"><option value="">Alla kapitel</option>${d.kapitel.map(k => `<option value="${esc(k.nr)}"${k.ingar ? '' : ' disabled'}${val.kapitel === k.nr ? ' selected' : ''}>${esc(`${k.nr} ${k.rubrik}`)}${k.ingar ? '' : ' (ingår inte i utdraget)'}</option>`).join('')}</select></div>
        <div class="falt"><label for="sf-status">Status</label><select id="sf-status" name="status"><option value="">Alla</option>${STATUSORDNING.map(st => `<option value="${st}"${val.status === st ? ' selected' : ''}>${esc(STATUS[st])}</option>`).join('')}</select></div>
        <div class="falt"><label for="sf-kategori">Kategori</label><select id="sf-kategori" name="kategori"><option value="">Alla</option>${Object.entries(KATEGORI).map(([k, t]) => `<option value="${k}"${val.kategori === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="falt bred"><label for="sf-sok">Sök på id eller text</label><input id="sf-sok" name="sok" type="search" autocomplete="off" value="${esc(val.sok)}" placeholder="Till exempel 3.5.2.6 eller ordinationsorsak"></div>
      </div>
    </form>
    <p class="dampad liten" id="sf-antal" role="status"></p>
    <div id="sussa-lista"></div>`;

  const form = yta.querySelector('.sussa-filter');
  const lista = yta.querySelector('#sussa-lista');
  const antal = yta.querySelector('#sf-antal');
  const rita = () => {
    const sok = normal(val.sok.trim());
    const urval = d.poster.filter(p => (!val.kapitel || p.kapitel === val.kapitel) && (!val.status || p.status === val.status)
      && (!val.kategori || p.kategori === val.kategori)
      && (!sok || p.id.startsWith(sok) || normal(`${p.rubrik} ${p.text} ${p.mervarden.join(' ')} ${p.losning ?? ''}`).includes(sok)));
    antal.textContent = `Visar ${urval.length} av ${d.poster.length} poster.`;
    const grupper = [];
    for (const p of urval) {
      if (grupper.at(-1)?.id !== p.avsnitt) grupper.push({ id: p.avsnitt, poster: [] });
      grupper.at(-1).poster.push(p);
    }
    lista.innerHTML = grupper.map(g => {
      const a = avsnitt.get(g.id);
      return `<section class="kravgrupp" aria-labelledby="sa-${esc(g.id)}"><h2 id="sa-${esc(g.id)}"><span class="krav-id">${esc(g.id)}</span> ${esc(a?.rubrik ?? '')}</h2>
        ${a?.sammanfattning ? `<details class="sussa-om"><summary>Om avsnittet</summary><p>${esc(a.sammanfattning)}</p></details>` : ''}
        <ul class="kravlista">${g.poster.map(sussaRad).join('')}</ul></section>`;
    }).join('') || '<p class="tom">Inga poster matchar filtret.</p>';
  };
  const spara = () => {
    const qs = new URLSearchParams(Object.entries(val).filter(([, v]) => v)).toString();
    try { history.replaceState(null, '', `#/krav${qs ? `?${qs}` : ''}`); } catch { /* adressen kan inte ändras */ }
  };
  form.addEventListener('input', (e) => {
    if (!(e.target.name in val)) return;
    val[e.target.name] = e.target.value;
    spara();
    rita();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  // Detaljerna fylls i först när en post öppnas.
  lista.addEventListener('toggle', (e) => {
    const el = e.target;
    if (!el.matches?.('details.sussapost') || !el.open) return;
    const del = el.querySelector('.sussa-detalj');
    if (!del.dataset.fylld) { del.innerHTML = sussaDetalj(perId.get(el.dataset.id)); del.dataset.fylld = '1'; }
  }, true);
  rita();
  const oppna = q.get('post');
  const el = oppna && perId.has(oppna) ? lista.querySelector(`details[data-id="${CSS.escape(oppna)}"]`) : null;
  // Appen flyttar fokus till rubriken och rullar upp efter att vyn är ritad, så posten får fokus efter det.
  if (el) { el.open = true; setTimeout(() => { el.querySelector('summary').focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }, 0); }
}

function sussaRad(p) {
  return `<li class="krav krav-${esc(p.status)}"><details class="sussapost" data-id="${esc(p.id)}">
    <summary><span class="krav-id">${esc(p.id)}</span><span class="sussa-rubrik"><strong>${esc(p.rubrik)}</strong><span class="under-text">${esc(TYP[p.typ] ?? p.typ)}${p.kategori === 'system' ? '' : `, ${esc(KATEGORI[p.kategori].toLowerCase())}`}</span></span><span class="kravstatus kravstatus-${esc(p.status)}">${esc(STATUS[p.status])}</span></summary>
    <div class="sussa-detalj"></div>
  </details></li>`;
}

function sussaDetalj(p) {
  const egna = p.egna.length ? `<ul class="enkel-lista">${p.egna.map(e => `<li><a href="#/krav?vy=egna">${esc(e.id)}</a> ${esc(e.rubrik ?? '')}${e.status ? ` <span class="kravstatus kravstatus-${esc(e.status)}">${esc(STATUS[e.status])}</span>` : ''}</li>`).join('')}</ul>` : '<p class="dampad">Inga kopplade egna krav.</p>';
  return `<div class="sussa-innehall">
    <p class="dampad liten">${esc(TYP[p.typ] ?? p.typ)}, sida ${esc(p.sida)} i kravspecifikationen. ${esc(KATEGORI_FORKLARING[p.kategori] ?? '')}</p>
    <h3>Kravtext</h3><p class="sussa-text">${esc(p.text)}</p>
    ${p.mervarden.length ? `<h3>Mervärden som bedöms</h3><ul>${p.mervarden.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${p.kompletterar.length ? `<p class="liten">Hänger ihop med ${p.kompletterar.map(id => `<a href="#/krav?post=${encodeURIComponent(id)}">${esc(id)}</a>`).join(', ')}.</p>` : ''}
    <h3>Vårdkällans lösning</h3><p>${p.losning ? esc(p.losning) : 'Inte byggt i Vårdkällan.'}</p>
    ${p.expert ? `<h3>Hur systemet är experten</h3><p>${esc(p.expert)}</p>` : ''}
    ${p.anmarkning ? `<h3>Det som saknas eller är simulerat</h3><p>${esc(p.anmarkning)}</p>` : ''}
    ${p.avsedd !== p.status && p.avsedd !== 'planerat' ? `<p class="ruta ruta-larm liten">Avsett som ${esc(STATUS[p.avsedd].toLowerCase())}, men ${p.tester.length ? 'alla tester är inte gröna' : 'posten har inga tester'}.</p>` : ''}
    <h3>Tester</h3>${p.tester.length ? `<ul class="testrader">${testrader(p.tester)}</ul>` : '<p class="dampad">Inga automatiska tester än, därför planerad.</p>'}
    <h3>Kopplade egna krav</h3>${egna}
  </div>`;
}

// Testerna av gränssnittet körs i en webbläsare med Playwright före bygget, inte i själva bygget.
function klientRad(kt) {
  if (!kt) return '';
  return `<p class="dampad liten">Gränssnittet testas dessutom i en webbläsare med Playwright: ${kt.godkanda} av ${kt.antal} tester gröna, ${esc(tidpunkt(kt.tid))}.${kt.aktuell ? '' : ' Gränssnittet har ändrats sedan dess, så de testerna räknas som inaktuella tills de körs igen.'}</p>`;
}

// Klickbudgeten (D6): uppmätt antal steg mot budgeten per flöde.
function klickbudgetTabell(kb) {
  if (!kb) return '<p class="ruta ruta-larm liten">Ingen mätning av klickbudgeten finns.</p>';
  return `<div class="klickbudget">
    <div class="tabellrulle"><table class="tabell siffertabell kb-tabell">
      <caption>Klickbudget per flöde, uppmätt ${esc(tidpunkt(kb.tid))}${kb.aktuell ? '' : ', före den senaste ändringen av gränssnittet'}</caption>
      <thead><tr><th scope="col">Flöde</th><th scope="col">Börjar i</th><th scope="col" class="tal">Uppmätt</th><th scope="col" class="tal">Budget</th><th scope="col">Varav</th></tr></thead>
      <tbody>${kb.floden.map(f => `<tr${f.uppmatt > f.budget ? ' class="avvikande"' : ''}>
        <th scope="row">${esc(f.namn)}</th><td>${esc(f.start)}</td>
        <td class="tal"><strong>${f.uppmatt}</strong>${f.uppmatt > f.budget ? `<span class="avst avst-fel">${ikon.varning}Över budget</span>` : ''}</td><td class="tal">${f.budget}</td>
        <td class="liten">${[[f.klick, 'klick', 'klick'], [f.faltbyten, 'fältbyte', 'fältbyten'], [f.tangenter, 'tangent', 'tangenter']].filter(x => x[0]).map(([n, en, fl]) => `${n} ${n === 1 ? en : fl}`).join(', ')}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="dampad liten">${esc(kb.regler)}</p>
    <p class="liten">Mätningen med verkliga användare görs med <a href="#/anvandartest">användartestet</a>, som ger samma uppgifter till personer som arbetar i vården och räknar på samma sätt.</p>
    <details class="testlista"><summary>Motivering för varje budget</summary><dl class="kb-motivering">${kb.floden.map(f => `<div><dt>${esc(f.namn)}</dt><dd>${esc(f.motivering)}</dd></div>`).join('')}</dl></details>
  </div>`;
}

function kravRad(k) {
  const v = k.var ? VAR[k.var] : null;
  return `<li class="krav krav-${esc(k.status)}">
    <div class="krav-huvud"><span class="krav-id">${esc(k.id)}</span><h3>${esc(k.rubrik)}</h3><span class="kravstatus kravstatus-${esc(k.status)}">${esc(STATUS[k.status])}</span></div>
    <p class="krav-kalla">Källa: ${esc(k.kalla)}${v ? `. Visas i ${v[0] ? `<a href="${v[0]}">${esc(v[1])}</a>` : esc(v[1])}` : ''}.</p>
    ${k.avsedd !== k.status ? `<p class="ruta ruta-larm liten">Avsett som ${esc(STATUS[k.avsedd].toLowerCase())}, men alla tester är inte gröna.</p>` : ''}
    ${k.anmarkning ? `<p class="krav-anm">${esc(k.anmarkning)}</p>` : ''}
    ${'klickbudget' in k ? klickbudgetTabell(k.klickbudget) : ''}
    ${k.tester.length ? `<details class="testlista"><summary>${k.tester.length === 1 ? 'Ett test' : `${k.tester.length} tester`}, ${k.tester.filter(x => x.status === 'grön').length} gröna</summary><ul>${testrader(k.tester)}</ul></details>` : '<p class="dampad liten">Inga automatiska tester än.</p>'}
  </li>`;
}
