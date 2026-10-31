// Kravspårbarhet: varje krav med id, rubrik, källa, status och de automatiska tester som visar det.
import { esc, api, tidpunkt, ikon, vyRubrik } from '../ui.js';

export const namn = 'krav';

const STATUS = { uppfyllt_demo: 'Uppfyllt i demon', delvis: 'Delvis', planerat: 'Planerat' };
const VAR = {
  '/': ['#/', 'Inloggningen'], '/drift': ['#/drift', 'Svarstider'], '/fhir/metadata': ['#/api', 'Öppet API'], '/inkorg': ['#/inkorg', 'Inkorgen'],
  '/krav': ['#/krav', 'Kravspårbarhet'], '/logg': ['#/logg', 'Logguppföljningen'], '/migrering': ['#/migrering', 'Migreringsavstämningen'],
  '/patient/:id': [null, 'patientjournalen'], '/patient/:id/anteckningar': [null, 'journalens anteckningar'],
  '/patient/:id/lakemedel': [null, 'journalens läkemedelsflik'], '/vantrum': ['#/vantrum', 'Väntrummet'],
};
const TESTSTATUS = { 'grön': ['ok', 'Grönt'], 'röd': ['fel', 'Rött'], hoppad: ['hoppad', 'Hoppades över'], saknas: ['fel', 'Saknas'] };
const GRUPP = [['K', 'Spårbarhet från krav till test'], ['D', 'Icke-funktionella krav och design'], ['L', 'Lagkrav och nationella tjänster'], ['M', 'Misstag att inte upprepa']];

export async function visa(main, _p, q) {
  const filter = ['uppfyllt_demo', 'delvis', 'planerat'].includes(q.get('status')) ? q.get('status') : 'alla';
  main.innerHTML = vyRubrik('Kravspårbarhet') + `<div class="ingress-block">
      <p>Kraven kommer från den offentliga granskningen av upphandlingen av Cosmic i Sussa-samverkan, rapporten Cosmic upphandling krav och kritik, och från lagkraven på journalsystem. Varje krav pekar på de automatiska tester som visar det, och testerna körs vid varje bygge. Ett krav räknas som uppfyllt i demon bara om alla dess tester finns och är gröna.</p>
      <p>Sussas egen kravspecifikation med originalnummer och utvärderingsmodell är begärd ut som allmän handling. Den läggs in här när den kommer. Uppfyllt i demon betyder att funktionen finns och är testad i demon, inte att Vårdkällan uppfyller kraven i en upphandling eller är CE-märkt.</p>
    </div><div id="kr"><p class="tom">Hämtar kravregistret.</p></div>`;
  const d = await api('/api/krav');
  const t = d.testresultat;
  const summa = d.summa;
  const urval = d.krav.filter(k => filter === 'alla' || k.status === filter);
  const filterLank = (k, text, n) => `<li><a href="#/krav${k === 'alla' ? '' : `?status=${k}`}"${filter === k ? ' aria-current="true"' : ''}>${esc(text)} <span class="antal">${n}</span></a></li>`;
  main.querySelector('#kr').innerHTML = `
    <div class="testkorning ${t?.misslyckade ? 'testkorning-rod' : 'testkorning-gron'}">${t ? `${t.misslyckade ? ikon.varning : ikon.bock}<p><strong>${t.godkanda} av ${t.antal} tester gröna</strong> i senaste bygget, ${esc(tidpunkt(t.tid))}, Bun ${esc(t.bun)}.${t.misslyckade ? ` ${t.misslyckade} röda.` : ''}</p>` : `${ikon.info}<p>Inget testresultat finns från bygget.</p>`}</div>
    <nav class="delflikar" aria-label="Filtrera på status"><ul>
      ${filterLank('alla', 'Alla', d.krav.length)}${filterLank('uppfyllt_demo', STATUS.uppfyllt_demo, summa.uppfyllt_demo)}${filterLank('delvis', STATUS.delvis, summa.delvis)}${filterLank('planerat', STATUS.planerat, summa.planerat)}
    </ul></nav>
    ${GRUPP.map(([pre, rubrik]) => {
      const g = urval.filter(k => k.id.startsWith(pre));
      if (!g.length) return '';
      return `<section class="kravgrupp" aria-labelledby="kg-${pre}"><h2 id="kg-${pre}">${esc(rubrik)}</h2><ul class="kravlista">${g.map(kravRad).join('')}</ul></section>`;
    }).join('') || '<p class="tom">Inga krav har den statusen.</p>'}`;
}

function kravRad(k) {
  const v = k.var ? VAR[k.var] : null;
  return `<li class="krav krav-${esc(k.status)}">
    <div class="krav-huvud"><span class="krav-id">${esc(k.id)}</span><h3>${esc(k.rubrik)}</h3><span class="kravstatus kravstatus-${esc(k.status)}">${esc(STATUS[k.status])}</span></div>
    <p class="krav-kalla">Källa: ${esc(k.kalla)}${v ? `. Visas i ${v[0] ? `<a href="${v[0]}">${esc(v[1])}</a>` : esc(v[1])}` : ''}.</p>
    ${k.avsedd !== k.status ? `<p class="ruta ruta-larm liten">Avsett som ${esc(STATUS[k.avsedd].toLowerCase())}, men alla tester är inte gröna.</p>` : ''}
    ${k.anmarkning ? `<p class="krav-anm">${esc(k.anmarkning)}</p>` : ''}
    ${k.tester.length ? `<details class="testlista"><summary>${k.tester.length === 1 ? 'Ett test' : `${k.tester.length} tester`}, ${k.tester.filter(x => x.status === 'grön').length} gröna</summary><ul>${k.tester.map(x => {
      const [kl, txt] = TESTSTATUS[x.status] ?? ['fel', x.status];
      return `<li class="test test-${kl}">${kl === 'ok' ? ikon.bock : ikon.kryss}<span class="sr">${esc(txt)}: </span><span>${esc(x.namn)}</span></li>`;
    }).join('')}</ul></details>` : '<p class="dampad liten">Inga automatiska tester än.</p>'}
  </li>`;
}
