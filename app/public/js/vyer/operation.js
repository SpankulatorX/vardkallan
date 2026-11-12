// Operationsavdelningen (runda 11, r2, Sussa 4.5.1.1 till 4.5.1.5): dagens program per sal med prognos när en operation
// drar ut på tiden, väntelistan med planeringen, uppvakningen, salsblocken över vårdenheter och sjukhus, förrådet och
// uppföljningen. En annan vårdenhets operation visas bara som upptagen tid.
import { esc, api, vyRubrik, tidpunkt, klockslag, datum, idag, plusDagar, notis, medKnapp, ikon } from '../ui.js';
import { far, S } from '../app.js';
import { planeraDialog } from './patient-operation.js';

export const namn = 'operation';

const FLIKAR = [
  ['program', 'Dagens program'], ['vantelista', 'Väntelista'], ['uppvakning', 'Uppvakning'], ['block', 'Salsblock'], ['forrad', 'Förråd'], ['uppfoljning', 'Uppföljning'],
  // Runda 11, r2: anestesienhetens beställda bedömningar, bara för anestesienheten.
  ['anestesi', 'Beställda anestesibedömningar'],
];
const arAnestesi = () => Boolean(S.session?.operation?.anestesi);

function anestesiHtml(a) {
  if (!a.anmalningar.length) return '<p class="tom">Inga beställda anestesibedömningar.</p>';
  return `<p class="under-text">${esc(a.text)}</p><div class="tabellrulle"><table class="tabell op-anestesi"><caption class="sr">Operationsanmälningarna som är beställda till anestesienheten</caption>
    <thead><tr><th scope="col">Patient</th><th scope="col">Ingrepp</th><th scope="col">Planerad</th><th scope="col">Bedömning</th></tr></thead>
    <tbody>${a.anmalningar.map(x => `<tr><th scope="row">${patientLank(x.patient)}<span class="under-text">${esc(x.vardenhet?.namn ?? '')}</span></th><td>${esc(x.ingrepp)}</td>
      <td>${x.planerad ? esc(tidpunkt(x.planerad)) : `Väntar, målet ${esc(datum(x.malDatum))}`}</td>
      <td>${x.bedomning ? `ASA ${esc(x.bedomning.asa)}, ${x.bedomning.giltig ? `giltig till ${esc(datum(x.bedomning.giltigTill))}` : 'gäller inte längre'}` : 'Inte gjord'}${x.asaBekraftad ? '<span class="under-text">ASA bekräftad på operationsdagen</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="dampad liten">${esc(a.demoregel)}</p>`;
}
const STATUS = { planerad: 'Planerad', pagar: 'Pågår', uppvak: 'Uppvakning', klar: 'Klar', vantar: 'Väntar' };
const patientLank = (p) => `<a class="patientlank" href="#/patient/${encodeURIComponent(p.id)}/operation">${esc(p.namn)}</a>`;

function flikarHtml(aktiv) {
  const synliga = FLIKAR.filter(([id]) => (id !== 'uppfoljning' || far('statistik')) && (id !== 'anestesi' || arAnestesi()));
  return `<nav class="op-flikar" aria-label="Operationsavdelningen"><ul>${synliga.map(([id, t]) => `<li><a href="#/operation/${id}"${id === aktiv ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav>`;
}

function programHtml(o) {
  return `<div class="knapprad op-datum"><a class="knapp liten sekundar" href="#/operation/program?datum=${esc(plusDagar(o.datum, -1))}">Föregående dag</a>
      <strong>${esc(datum(o.datum))}</strong><a class="knapp liten sekundar" href="#/operation/program?datum=${esc(plusDagar(o.datum, 1))}">Nästa dag</a></div>
    ${o.salar.map(s => `<section class="ov-sektion" aria-labelledby="op-sal-${esc(s.id)}"><div class="sektion-huvud"><h2 id="op-sal-${esc(s.id)}">${esc(s.namn)}</h2>
        <p class="under-text">Beläggning ${esc(s.belaggning)} procent av salstiden ${esc(o.salstid.fran)} till ${esc(o.salstid.till)}.${s.block.egen ? ' Vårdenhetens block.' : s.block.oppen ? ' Öppen för vårdenheterna på sjukhuset.' : ''}</p></div>
      ${s.operationer.length ? `<div class="tabellrulle"><table class="tabell op-program"><caption class="sr">Operationerna i ${esc(s.namn)}</caption>
        <thead><tr><th scope="col">Tid</th><th scope="col">Patient</th><th scope="col">Ingrepp</th><th scope="col">Team</th><th scope="col">Läge</th></tr></thead>
        <tbody>${s.operationer.map(x => x.upptagen ? `<tr class="op-upptagen"><th scope="row">${esc(klockslag(x.start))} till ${esc(klockslag(x.slut))}</th><td colspan="4">Upptagen</td></tr>`
          : `<tr${x.forsenad ? ' class="rad-larm"' : ''}><th scope="row">${esc(klockslag(x.start))} till ${esc(klockslag(x.slut))}</th><td>${patientLank(x.patient)}</td><td>${esc(x.ingrepp)}</td>
            <td><span class="under-text">${esc([x.team.operator, x.team.opssk, x.team.anestesilakare, x.team.anestesissk].filter(Boolean).join(', '))}</span></td>
            <td>${esc(STATUS[x.status] ?? x.status)}${x.senaste ? `, ${esc(x.senaste.toLocaleLowerCase('sv'))}` : ''}${x.avvikelse ? `<span class="under-text text-larm">${esc(x.avvikelse)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="tom liten">Inga operationer planerade.</p>'}</section>`).join('')}
    <p class="dampad liten">${esc(o.demoregel)}</p>`;
}

function vantelistaHtml(v) {
  if (!v.vantande.length) return '<p class="tom">Ingen väntar på operation.</p>';
  return `<div class="tabellrulle"><table class="tabell op-vantelista"><caption class="sr">Väntelistan i ordning efter målet för väntetiden</caption>
    <thead><tr><th scope="col">Patient</th><th scope="col">Ingrepp</th><th scope="col">Prioritet</th><th scope="col">Mål</th><th scope="col"><span class="sr">Planera</span></th></tr></thead>
    <tbody>${v.vantande.map(x => `<tr${x.overMal ? ' class="rad-larm"' : ''}><th scope="row">${patientLank(x.patient)}</th><td>${esc(x.ingrepp)} <span class="under-text">KVÅ ${esc(x.kva)}</span></td><td>${esc(x.prioritet)}</td>
      <td>${esc(datum(x.malDatum))}<span class="under-text">${x.overMal ? 'Målet har passerats' : `${esc(x.dagarKvar)} dagar kvar`}</span>${x.behandlingsgaranti ? `<span class="under-text${x.behandlingsgaranti.passerad ? ' text-larm' : ''}" data-behandlingsgaranti>Behandlingsgarantin ${esc(datum(x.behandlingsgaranti.datum))}${x.behandlingsgaranti.passerad ? ', passerad' : ''}</span>` : ''}</td>
      <td>${far('operation_planera') ? `<button type="button" class="knapp liten" data-planera="${esc(x.id)}">Planera</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="dampad liten">${esc(v.demoregel)}</p>`;
}

function uppvakningHtml(u) {
  if (!u.patienter.length) return '<p class="tom">Ingen patient på uppvakningen.</p>';
  return `<ul class="op-lista">${u.patienter.map(p => `<li class="${p.kanSkrivasUt ? 'op-klar' : 'op-kvar'}">${p.kanSkrivasUt ? ikon.bock : ikon.klocka}<div><strong>${patientLank(p.patient)}</strong>, ${esc(p.ingrepp)}
    <span class="under-text">På uppvakningen sedan ${esc(klockslag(p.start))}, ${esc(p.minuter)} minuter. ${esc(p.text)}</span></div></li>`).join('')}</ul>
    <p class="dampad liten">${esc(u.demoregel)}</p>`;
}

function blockHtml(b) {
  const kan = far('operation_planera') && b.opererar;
  return `<p class="under-text">${esc(b.text)}</p>
    <div class="tabellrulle"><table class="tabell op-block"><caption class="sr">Salsblocken de kommande fem vardagarna</caption>
    <thead><tr><th scope="col">Sal</th>${b.dagar.map(d => `<th scope="col">${esc(datum(d))}</th>`).join('')}</tr></thead>
    <tbody>${b.salar.map(s => `<tr><th scope="row">${esc(s.namn)}</th>${s.dagar.map(d => `<td class="${d.egen ? 'op-egen' : ''}">${esc(d.vardenhet?.namn ?? 'Öppen sal')}
      <span class="under-text">${esc(d.belaggning)} procent planerat${d.frislappt ? ', släppt för sjukhuset' : ''}${d.andrad ? ', ändrat' : ''}</span>
      ${kan && d.egen && d.belaggning === 0 ? `<button type="button" class="knapp liten sekundar" data-slapp="${esc(s.id)}" data-datum="${esc(d.datum)}">Släpp</button>` : ''}
      ${kan && !d.vardenhet ? `<button type="button" class="knapp liten sekundar" data-ta="${esc(s.id)}" data-datum="${esc(d.datum)}">Ta blocket</button>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="dampad liten">${esc(b.demoregel)}</p>`;
}

function forradHtml(f) {
  return `<p class="under-text">${esc(f.text)}</p>
    <div class="tabellrulle"><table class="tabell"><caption class="sr">Saldot i operationsförrådet</caption><thead><tr><th scope="col">Artikel</th><th scope="col">Saldo</th><th scope="col">Beställningspunkt</th></tr></thead>
    <tbody>${f.artiklar.map(a => `<tr${a.lagt ? ' class="rad-larm"' : ''}><th scope="row">${esc(a.namn)} <span class="under-text">${esc(a.artikel)}</span></th><td>${esc(a.saldo)}</td><td>${esc(a.bestallningspunkt)}</td></tr>`).join('')}</tbody></table></div>
    <h2>Beställningar till förrådet</h2>
    ${f.bestallningar.length ? `<ul class="enkel-lista">${f.bestallningar.map(b => `<li>${esc(b.antal)} st ${esc(b.namn)}, beställt ${esc(tidpunkt(b.bestalld))}. ${b.levererad ? `Levererat ${esc(tidpunkt(b.levererad))}.` : `Levereras ${esc(tidpunkt(b.levereras))}.`}<span class="under-text">${esc(b.orsak)}</span></li>`).join('')}</ul>` : '<p class="tom liten">Inga beställningar.</p>'}
    <p class="dampad liten">${esc(f.demo)}</p>`;
}

function uppfoljningHtml(u) {
  const rad = (dt, dd) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`;
  return `<p class="under-text">${esc(u.vardenhet.namn)}, ${esc(datum(u.fran))} till ${esc(datum(u.till))}. ${esc(u.text)}</p>
    <dl class="pt-uppf">
      ${rad('Inflöde', `${esc(u.inflode.anmalda)} anmälda (${esc(u.inflode.perPrioritet.map(p => `${p.namn.toLocaleLowerCase('sv')} ${p.antal}`).join(', '))})`)}
      ${rad('Väntar', `${esc(u.vantande.antal)}, varav ${esc(u.vantande.overMal)} efter målet`)}
      ${rad('Väntetid till operation', u.vantetid.genomforda ? `Median ${esc(u.vantetid.medianDagar)} dagar, ${esc(u.vantetid.inomMal)} av ${esc(u.vantetid.genomforda)} inom målet` : 'Inga genomförda')}
      ${rad('Strukna', `${esc(u.strukna.antal)} (${esc(u.strukna.andel)} procent av de planerade)${u.strukna.perOrsak.length ? `: ${esc(u.strukna.perOrsak.map(s => `${s.orsak.toLocaleLowerCase('sv')} ${s.antal}`).join(', '))}` : ''}`)}
      ${rad('Punktlighet', `${esc(u.punktlighet.iTid)} av ${esc(u.punktlighet.forstaOperationer)}. ${esc(u.punktlighet.text)}`)}
      ${rad('Tid på uppvakningen', u.uppvakning.antal ? `Median ${esc(u.uppvakning.medianMinuter)} minuter för ${esc(u.uppvakning.antal)} patienter` : 'Inga utskrivna')}
      ${u.salar.map(s => rad(`Salsutnyttjande, ${s.namn}`, `${esc(s.utnyttjande)} procent`)).join('')}
      ${u.utrustning.filter(x => x.bokningar).map(x => rad(x.namn, `${esc(x.bokningar)} bokningar, ${esc(x.minuter)} minuter`)).join('')}
      ${u.perIngrepp.map(i => rad(i.namn, `${esc(i.antal)} genomförda, i medel ${esc(i.medelMinuter)} minuter mot beräknade ${esc(i.beraknadeMinuter)}`)).join('')}
    </dl>`;
}

export async function visa(main, [flik = 'program'], q, ctx = {}) {
  const aktiv = FLIKAR.some(([id]) => id === flik) && (flik !== 'anestesi' || arAnestesi()) ? flik : arAnestesi() ? 'anestesi' : 'program';
  main.innerHTML = `${vyRubrik('Operationsavdelningen', `${S.session?.operation?.vardenhet?.namn ?? ''}. Systemet föreslår tider och team, prövar krockar och räknar ut när nästa operation kan börja.`)}${flikarHtml(aktiv)}<div id="op-vy"><p class="tom">Hämtar operationsavdelningen.</p></div>`;
  const dag = q?.get?.('datum') ?? idag();
  const VAG = { program: `/api/operation/oversikt?datum=${encodeURIComponent(dag)}`, vantelista: '/api/operation/vantelista', uppvakning: '/api/operation/uppvakning', block: '/api/operation/block', forrad: '/api/operation/forrad', uppfoljning: '/api/operation/uppfoljning', anestesi: '/api/operation/anestesi' };
  const d = await api(VAG[aktiv]);
  if (ctx.aktuell && !ctx.aktuell()) return;
  const el = main.querySelector('#op-vy');
  if (!el) return;
  el.innerHTML = { program: programHtml, vantelista: vantelistaHtml, uppvakning: uppvakningHtml, block: blockHtml, forrad: forradHtml, uppfoljning: uppfoljningHtml, anestesi: anestesiHtml }[aktiv](d);
  const ladda = () => visa(main, [aktiv], q, ctx);
  el.addEventListener('click', async (e) => {
    const t = (s) => e.target.closest(s);
    try {
      if (t('[data-planera]')) {
        if (await planeraDialog(t('[data-planera]').dataset.planera, t('[data-planera]'))) ladda();
      } else if (t('[data-slapp]') || t('[data-ta]')) {
        const b = t('[data-slapp]') ?? t('[data-ta]');
        const r = await medKnapp(b, () => api(`/api/operation/block/${b.dataset.slapp ? 'slapp' : 'ta'}`, { metod: 'POST', data: { sal: b.dataset.slapp ?? b.dataset.ta, datum: b.dataset.datum } }));
        notis(r.text);
        ladda();
      }
    } catch { /* notis */ }
  });
}
