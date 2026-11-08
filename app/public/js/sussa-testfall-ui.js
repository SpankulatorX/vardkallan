// Runda 7, r1: resultatet av Sussas användbarhetstester på kravsidan (K4). Varje testfall i Bilaga F1:4 med uppmätta
// steg mot klickbudgeten, uppskattad tid mot tidsklassen och poängen för mätning 1 och 2 enligt Bilaga F1:2, och de
// testfall som Vårdkällan inte kan genomföra med vad som saknas.
import { esc, tidpunkt, ikon, tal } from './ui.js';

const minSek = (s) => (s == null ? '' : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);
const poang = (p) => (p == null ? '' : `${p}`);
const medel = (v) => (v == null ? 'inget värde' : tal(v, 2));

export function sussaTestfallTabell(st) {
  if (!st) return '<p class="ruta ruta-larm liten">Ingen körning av Sussas testfall finns.</p>';
  const s = st.sammanstallning;
  const rader = st.testfall.map(t => `<tr${t.fel || !t.inomBudget ? ' class="avvikande"' : ''}>
    <th scope="row">${esc(t.nr)} ${esc(t.titel)}<span class="under-text">${esc(t.roll)}, demorollen ${esc(t.demoroll)}</span></th>
    <td class="tal">${t.fel ? `<span class="avst avst-fel">${ikon.varning}Når inte slutvillkoret</span>` : `<strong>${t.uppmatt}</strong> av ${t.budget}`}</td>
    <td class="tal">${t.tecken ?? ''}</td>
    <td class="tal">${minSek(t.uppskattadTidS)}<span class="under-text">gräns ${t.tidsklass} min</span></td>
    <td class="tal">${poang(t.malpoang)}${t.brister?.length ? '<span class="under-text">med brister</span>' : ''}</td><td class="tal">${poang(t.tidspoang)}</td>
  </tr>`).join('');
  return `<div class="sussa-testfall">
    <p class="ruta ruta-info liten st-tidsklass">${ikon.info}<span><strong>Tidsgränserna är Vårdkällans bedömning.</strong> Sussa lämnade aldrig ut vilken av tidsklasserna 6, 9, 15 och 18 minuter varje testfall hade (svar på fråga 136 den 13 oktober 2017: informationen delges inte, eftersom metoden undermineras om den är känd i förväg). Vårdkällan har gett varje testfall en tidsklass efter hur stort det är, med motiveringen under tabellen.</span></p>
    <div class="tabellrulle"><table class="tabell siffertabell st-tabell">
      <caption>Sussas testfall som Vårdkällan genomför, uppmätta ${esc(tidpunkt(st.tid))}${st.aktuell ? '' : ', före den senaste ändringen av gränssnittet'}</caption>
      <thead><tr><th scope="col">Testfall och roll</th><th scope="col" class="tal">Steg av budget</th><th scope="col" class="tal">Tecken</th><th scope="col" class="tal">Uppskattad tid och tidsgräns (Vårdkällans bedömning)</th><th scope="col" class="tal">Mål</th><th scope="col" class="tal">Tid</th></tr></thead>
      <tbody>${rader}</tbody>
    </table></div>
    <p class="liten"><strong>${s.antalGenomforda} av ${s.antal} testfall genomförs.</strong> Mätning 1, måluppfyllelse: medelvärde ${esc(medel(s.alla.malupfyllelse))} för alla ${s.antal} testfall, där ett testfall som inte kan genomföras ger 0, vilket blir ${esc(poang(s.alla.poang.malupfyllelse))} utvärderingspoäng av 10. För de genomförda är medelvärdet ${esc(medel(s.genomforda.malupfyllelse))}. Mätning 2, effektivitet: ${esc(medel(s.alla.effektivitet))} för alla, ${esc(poang(s.alla.poang.effektivitet))} utvärderingspoäng, och ${esc(medel(s.genomforda.effektivitet))} för de genomförda. Mätning 3 (SUS) och mätning 4 (expertgranskning) kräver riktiga testpersoner och en granskare, och görs med <a href="#/sussatest">formuläret för Sussas testfall</a>.</p>
    <details class="testlista"><summary>${st.ejGenomforbara.length} testfall kan inte genomföras</summary><dl class="kb-motivering">${st.ejGenomforbara.map(x => `<div><dt>${esc(x.nr)} ${esc(x.titel)}</dt><dd>${esc(x.saknas)}</dd></div>`).join('')}</dl></details>
    <details class="testlista"><summary>Klickbudget, tidsklass och avvikelser för varje testfall</summary><dl class="kb-motivering">${st.testfall.map(t => `<div><dt>${esc(t.nr)} ${esc(t.titel)}</dt><dd><p>Slutvillkor: ${esc(t.slut ?? '')}</p><p>Klickbudget ${t.budget}: ${esc(t.motivering ?? '')}</p><p>Tidsklass ${t.tidsklass} minuter, Vårdkällans bedömning: ${esc(t.tidsklassSkal ?? '')}</p>${(t.brister ?? []).length ? `<p>Brister mot principen att systemet är experten, som ger högst 5 poäng i måluppfyllelse: ${t.brister.map(esc).join(' ')}</p>` : ''}${(t.avvikelser ?? []).length ? `<p>Avvikelser från Sussas text: ${t.avvikelser.map(esc).join(' ')}</p>` : ''}${t.steg ? `<p class="dampad">Stegen: ${t.steg.map(esc).join('; ')}.</p>` : ''}</dd></div>`).join('')}</dl></details>
    <p class="dampad liten">Tiden för en människa är uppskattad med tidsmodellen keystroke-level model (${esc(st.klm?.kalla ?? '')}): ett klick ${tal(st.klmSteg?.klick ?? 0, 2)} s, ett fältbyte ${tal(st.klmSteg?.faltbyte ?? 0, 2)} s, en rullgardinslista ${tal(st.klmSteg?.listval ?? 0, 2)} s och ${tal(st.klmSteg?.tecken ?? 0, 2)} s per tecken, plus systemets svarstid som skriptet mätte i webbläsaren. Läs- och letartid ingår inte. Måluppfyllelsen ger 10 poäng inom klickbudgeten, 5 upp till en och en halv gång budgeten eller när testfallet har brister, och 2 över det. Sussa lämnade aldrig ut tidsklassen per testfall, så den är Vårdkällans bedömning.</p>
  </div>`;
}
