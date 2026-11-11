// Runda 13, r1: startsidan för testare (#/testa), dit länken i testinbjudan pekar. Den säger kort vad Vårdkällan är och
// vad testet går ut på, att allt är påhittat och att sandlådan är personlig. Testaren väljer yrkesroll med en stor
// knapp och loggas in i rätt demoroll direkt, och uppdragen startar i panelen längst ner.
import { esc, api, ikon, vyRubrik, medKnapp } from '../ui.js';
import { loggaIn, loggaInInvanare, logotyp } from '../app.js';
import * as testare from '../testinbjudan.js';
import { begransningarHtml } from '../kanda-begransningar.js';

export const namn = 'testa';
const PROFIL = 'vk_testare_profil';
const lasProfil = () => { try { return JSON.parse(localStorage.getItem(PROFIL) ?? '{}') ?? {}; } catch { return {}; } };
const sparaProfil = (p) => { try { localStorage.setItem(PROFIL, JSON.stringify(p)); } catch { /* utan lagring */ } };

export async function visa(main) {
  main.innerHTML = `<div class="testa">
    <div class="testa-marke">${logotyp(40)}<p>Vårdkällan</p></div>
    ${vyRubrik('Testa Vårdkällan och jämför med ditt journalsystem')}
    <div class="testa-intro">
      <p>Vårdkällan är ett öppet vårdinformationssystem, byggt mot den kravspecifikation som regionerna i Sussa samverkan, ett samarbete mellan flera regioner, använde när de upphandlade journalsystemet Cosmic. Systemet är gratis, har öppen källkod (EUPL 1.2) och får användas och anpassas av vem som helst, utan kostnad för själva systemet.</p>
      <p>Syftet med testet är att du som arbetar i Cosmic eller i ett annat journalsystem gör samma arbetsflöden här och säger var det är lättare, ungefär lika eller svårare, och vad som saknas. Uppdragen följer så långt det går de 34 testfall som regionerna använde när Cosmic utvärderades.</p>
    </div>
    <section class="ruta ruta-info testa-viktigt" aria-labelledby="testa-viktigt">
      <h2 id="testa-viktigt">${ikon.info}Bra att veta</h2>
      <ul>
        <li>Alla patienter och all personal är påhittade. Skriv aldrig in uppgifter om riktiga personer.</li>
        <li>Du får en egen sandlåda som bara du ser. Den försvinner efter åtta timmar, och du kan återställa den när du vill.</li>
        <li>Du behöver inte ange namn eller e-post, och svaren är anonyma. Läs mer på <a href="#/om">Om demon och testet</a>.</li>
      </ul>
    </section>
    <section class="testa-steg" aria-labelledby="testa-hur">
      <h2 id="testa-hur">Så går det till</h2>
      <ol>
        <li>Berätta gärna vilket journalsystem du använder i dag. Det är frivilligt.</li>
        <li>Välj din yrkesroll. Du loggas in direkt som en påhittad person med det yrket.</li>
        <li>Gör uppdragen i panelen längst ner, i din egen takt. Uppdraget säger vad du ska göra, inte var du klickar, och systemet bockar av det när det är gjort. Efter varje uppdrag får du en kort fråga om hur det var jämfört med ditt system.</li>
        <li>Knappen Lämna synpunkt finns på varje sida, när något är fel, saknas eller är svårt.</li>
      </ol>
    </section>
    ${begransningarHtml('testa-kanda')}
    <form class="ruta testa-profil" id="testa-profil" novalidate aria-labelledby="testa-om-dig">
      <h2 id="testa-om-dig">Om dig (frivilligt)</h2>
      <p class="liten dampad">Inga namn och ingen arbetsplats. Svaren används bara för att se om resultatet skiljer sig mellan journalsystem och yrken.</p>
      ${testare.profilFalt(lasProfil(), 'testa')}
    </form>
    <section aria-labelledby="testa-roll">
      <h2 id="testa-roll">Välj din yrkesroll</h2>
      <ul class="testa-roller" id="testa-roller"><li class="tom">Hämtar yrkesrollerna.</li></ul>
    </section>
    <p class="liten dampad testa-fot">Vill du hellre välja fritt bland alla demoroller? <a href="#/">Logga in med en demoroll</a>. Om testet och integriteten: <a href="#/om">Om demon och testet</a>.</p>
  </div>`;
  await rollvaljare(main.querySelector('#testa-roller'), () => testare.profilUr(main.querySelector('#testa-profil')));
}

// Knapparna för yrkesrollerna, som också står först på inloggningssidan. En knapp loggar in i rätt demoroll och
// startar uppdragen. profil ger det testaren har fyllt i om sig själv, annars det som sparades förra gången.
export async function rollvaljare(ul, profil = () => lasProfil(), { kort = false } = {}) {
  const { roller } = await api('/api/testare/roller');
  if (!ul?.isConnected) return;
  ul.innerHTML = roller.map(r => `<li><button type="button" class="testa-rollknapp" data-testroll="${esc(r.id)}" aria-describedby="tr-${esc(r.id)}">
      <span class="testa-rollnamn">${esc(r.knapp)}</span>
      <span class="testa-rollom" id="tr-${esc(r.id)}">${esc(r.antal)} uppdrag${r.sussa ? `, varav ${esc(r.sussa)} ur Sussas testfall` : ''}.${kort ? '' : ` ${esc(r.om)}`}</span>
    </button></li>`).join('');
  ul.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-testroll]');
    if (!b) return;
    const r = roller.find(x => x.id === b.dataset.testroll);
    const p = { ...lasProfil(), ...profil() };
    sparaProfil(p);
    try {
      // Inloggningen först, så att förlossningens demodata finns innan baslinjen tas, och sedan uppdragen.
      if (r.invanare) await loggaInInvanare(r.invanare, b); else await loggaIn(r.demoroll, b);
      await medKnapp(b, () => testare.starta(r.id, p));
      await testare.uppdatera({ visa: true });
    } catch { /* notis visad */ }
  });
}
