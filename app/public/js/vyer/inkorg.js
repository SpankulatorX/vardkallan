// Inkorgen: osignerade anteckningar, okvitterade remissvar, larm och NLL-avvikelser. Varje rad leder till rätt ställe.
import { esc, api, tidpunkt, ikon, vyRubrik, NLL } from '../ui.js';
import { S, uppdateraInkorg } from '../app.js';

export const namn = 'inkorg';

const pnamn = (p) => (p?.skyddad ? 'Skyddad identitet' : p?.namn ?? '');
const LARMTYP = { saknar_mottagningskvittens: 'Mottagningskvittens saknas', svar_forsenat: 'Svar försenat', svar_ej_kvitterat: 'Svaret är inte kvitterat' };

function sektion(id, rubrik, rader, tomText, forklaring) {
  return `<section class="inkorg-sektion" aria-labelledby="ik-${id}">
    <h2 id="ik-${id}">${esc(rubrik)} <span class="antal${rader.length ? ' antal-aktiv' : ''}">${rader.length}</span></h2>
    <p class="dampad liten">${esc(forklaring)}</p>
    ${rader.length ? `<ul class="inkorg-lista">${rader.join('')}</ul>` : `<p class="tom liten">${esc(tomText)}</p>`}
  </section>`;
}

const rad = (href, rubrik, detalj, klass = '') => `<li class="${klass}"><a href="${href}"><span class="ik-rubrik">${rubrik}</span><span class="under-text">${detalj}</span></a>${ikon.pil}</li>`;

export async function visa(main) {
  main.innerHTML = vyRubrik('Inkorg', 'Det som väntar på dig eller din vårdenhet. Inget försvinner förrän det är åtgärdat.') + '<div id="ik"><p class="tom">Hämtar inkorgen.</p></div>';
  const d = await api('/api/inkorg');
  await uppdateraInkorg();
  const pat = (id, flik, sub) => `#/patient/${encodeURIComponent(id)}${flik ? `/${flik}` : ''}${sub ? `/${sub}` : ''}`;

  const osign = d.osigneradeAnteckningar.map(a => rad(pat(a.patientId, 'journal', a.id),
    `${esc(a.typ)}, ${esc(pnamn(a.patient))}`, `Utkast skapat ${esc(tidpunkt(a.skapad))} på ${esc(a.enhet.namn)}. ${esc(a.sammanfattning)}`));
  const svar = d.okvitteradeSvar.map(r => rad(`#/remisser?riktning=utgaende&remiss=${r.id}`,
    `Svar från ${esc(r.till.namn)}, ${esc(pnamn(r.patient))}`, `Besvarad ${esc(tidpunkt(r.tider.besvarad))} av ${esc(r.av?.besvarad?.namn ?? '')}. Kvittera att du har läst svaret.`));
  const larm = d.larm.map(l => rad(`#/remisser?riktning=${l.riktning}&remiss=${l.remissId}`,
    `${ikon.larm}<span>${esc(LARMTYP[l.typ] ?? l.typ)}, ${esc(l.patient)}</span>`, `${esc(l.text)} ${l.riktning === 'inkommande' ? 'Inkommande remiss.' : 'Utgående remiss.'}`, 'ik-larm'));
  const nll = d.nllAvvikelser.map(n => rad(pat(n.patientId, 'lakemedel'),
    `${esc(n.lakemedel)}, ${esc(pnamn(n.patient))}`, `${esc(NLL[n.nll_status] ?? n.nll_status)}. Ordinerat ${esc(tidpunkt(n.skapad))}. Stäm av mot NLL.`, 'ik-nll'));

  const dubb = (d.dubbletter ?? []).map(x => rad(pat(x.patientId, 'identitet'),
    `Trolig dubblett, ${esc(pnamn(x.patient))}`, `<span class="pnr">${esc(x.patient.personnummer)}</span>. Systemet har hittat ${x.antal === 1 ? 'en annan journal' : `${x.antal} andra journaler`} som troligen gäller samma person. Bekräfta sammanslagningen.`, 'ik-dubblett'));

  main.querySelector('#ik').innerHTML = `<div class="inkorg-rutnat">
    ${S.session.behorigheter.includes('sla_samman') ? sektion('dubb', 'Troliga dubbletter', dubb, 'Inga troliga dubbletter.', 'Journaler som systemet tror gäller samma person, till exempel ett reservnummer och ett personnummer med samma namn och födelsedatum.') : ''}
    ${sektion('larm', 'Larm', larm, 'Inga larm.', 'Remisser där mottagningskvittens, svar eller kvittens av svaret har uteblivit för länge.')}
    ${sektion('osign', 'Osignerade anteckningar', osign, 'Inga osignerade anteckningar.', 'Dina utkast. De syns bara för dig tills du signerar.')}
    ${sektion('svar', 'Okvitterade remissvar', svar, 'Inga remissvar väntar på dig.', 'Svar på remisser från din vårdenhet som ingen har kvitterat än.')}
    ${sektion('nll', 'NLL-avvikelser', nll, 'Inga avvikelser mot Nationella läkemedelslistan.', 'Ordinationer från din vårdenhet där överföringen till NLL fick timeout eller fel.')}
  </div>${S.session.personal.yrke === 'vardadministrator' ? '<p class="dampad liten">Som vårdadministratör ser du larm om remissernas status men ingen journaltext.</p>' : ''}`;
}
