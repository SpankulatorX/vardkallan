// Runda 13, r1: om demon och testet (#/om). Det som ett forum kräver av en undersökning: vem som står bakom, syftet,
// att svaren är anonyma, vad som sparas, hur länge och hur det hanteras, och hur man kontaktar projektet. Texterna om
// vad som sparas är samma som formulären visar och servern följer (synpunkt-regler.js).
import { esc, api, vyRubrik } from '../ui.js';
import { begransningarHtml } from '../kanda-begransningar.js';
import { SPARAS, VARFOR, HUR_LANGE, VEM_LASER, PERSONNUMMER_TEXT } from '../synpunkt-regler.js';

export const namn = 'om';
const GITHUB = 'https://github.com/SpankulatorX/vardkallan';

export async function visa(main, _p, _q, { aktuell = () => true } = {}) {
  let inteVarden = '';
  try { inteVarden = (await api('/api/krav/version', { tyst: true })).inteVarden ?? ''; } catch { inteVarden = ''; }
  if (!aktuell()) return;
  main.innerHTML = `${vyRubrik('Om demon och testet', 'Vem som står bakom Vårdkällan, vad testet är till för och vad som sparas.')}
  <div class="om">
    <section class="ruta" aria-labelledby="om-vem">
      <h2 id="om-vem">Vem står bakom</h2>
      <p>Vårdkällan är ett fristående projekt som drivs av en enskild person, utan koppling till någon region, Inera, 1177 eller någon leverantör av journalsystem. Projektet har ingen kommersiell avsikt, säljer inget och tar inte emot pengar för systemet. All källkod finns öppet på <a href="${GITHUB}">GitHub</a>.</p>
    </section>
    <section class="ruta" aria-labelledby="om-syfte">
      <h2 id="om-syfte">Syftet</h2>
      <p>Syftet är att undersöka hur personal som arbetar i Cosmic eller i ett annat journalsystem upplever samma arbetsflöden i Vårdkällan. Testet påstår inte att Vårdkällan är bättre. Det är just det som ska undersökas: var det är lättare, ungefär lika eller svårare, och vad som saknas.</p>
      <p>Uppdragen följer så långt det går de 34 användbarhetstestfall som regionerna i Sussa samverkan, ett samarbete mellan regioner som upphandlade Cosmic tillsammans, använde när systemet utvärderades. Så gäller jämförelsen samma sak.</p>
    </section>
    <section class="ruta" aria-labelledby="om-kostnad">
      <h2 id="om-kostnad">Kostnad och licens</h2>
      <p>Systemet är gratis. Källkoden har licensen EUPL 1.2, och vem som helst, till exempel en region, får använda, ändra och anpassa systemet efter sina egna behov, utan kostnad för själva systemet.</p>
      ${inteVarden ? `<p>${esc(inteVarden)}</p>` : ''}
    </section>
    <section class="ruta" aria-labelledby="om-anonymt">
      <h2 id="om-anonymt">Anonymt och frivilligt</h2>
      <p>Att vara med är frivilligt, och du kan sluta när du vill. Du behöver inte logga in med något eget konto, och du behöver inte ange namn, e-post eller arbetsplats. Svaren är anonyma, och resultaten redovisas bara sammanställda, aldrig så att en enskild testare går att känna igen. Ingen får ersättning, och inget av det du svarar används till marknadsföring.</p>
      <p>${esc(PERSONNUMMER_TEXT)}</p>
    </section>
    <section class="ruta" aria-labelledby="om-sparas">
      <h2 id="om-sparas">Det här sparas</h2>
      <ul>${SPARAS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3>Varför</h3><p>${esc(VARFOR)}</p>
      <h3>Hur länge</h3><p>${esc(HUR_LANGE)} Din sandlåda med det du har gjort i demon raderas efter åtta timmar.</p>
      <h3>Vem som läser och hur det hanteras</h3><p>${esc(VEM_LASER)} Svaren sparas på projektets egen server, lämnas inte vidare till någon annan och används inte för något annat än det som står här. Trafiken till demon går krypterad genom Cloudflare, som skyddar den mot överbelastning.</p>
      <h3>Kakor och spårning</h3><p>Demon använder en enda kaka, för att hålla ihop din session och din sandlåda. Den försvinner när sessionen tar slut. Demon har inga spårningsverktyg, ingen statistiktjänst och inga annonser.</p>
    </section>
    ${begransningarHtml('om-kanda')}
    <section class="ruta" aria-labelledby="om-kontakt">
      <h2 id="om-kontakt">Kontakta projektet</h2>
      <p>Använd knappen Lämna synpunkt längst ner på varje sida. Vill du ha svar kan du skriva en e-postadress eller ett telefonnummer i det frivilliga fältet för kontakt. Du kan också skapa ett ärende på <a href="${GITHUB}/issues">GitHub</a>. Det som skrivs där är offentligt.</p>
    </section>
    <p><a class="knapp" href="#/testa">Till testet</a></p>
  </div>`;
}
