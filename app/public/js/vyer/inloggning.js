// Inloggning med simulerat SITHS-kort: välj en av demorollerna.
import { esc, api, ikon } from '../ui.js';
import { loggaIn, logotyp } from '../app.js';

export const namn = 'inloggning';

// Vad varje roll visar i demon. Bygger på seeden och behörighetsreglerna.
const VISAR = {
  'lak-kard': 'Signerar och rättar anteckningar, ordinerar med varningar och bedömer och besvarar remisser. Elin Sandberg har spärrade uppgifter som visas bara med hennes samtycke.',
  'ssk-kard': 'Läser journalen och skriver omvårdnadsanteckningar och mätvärden på avdelning 72. Får inte ordinera läkemedel.',
  'usk-kard': 'Ser läkemedel, mätvärden, överkänslighet och omvårdnadsanteckningar, men inga läkaranteckningar och inga diagnoser.',
  'lak-akut': 'Nödåtkomst på akuten: Thomas Lindberg kommer in medvetslös och akuten har ingen vårdrelation med honom. Ser väntrummet, men aldrig namnet på en skyddad patient.',
  'lak-vc': 'Distriktsläkare med listade patienter. Har ett remissvar från kardiologen som väntar på kvittens.',
  'lak-psyk': 'Spärrade uppgifter från psykiatrin: ser klinikens egna anteckningar om Elin Sandberg, som andra enheter bara ser som en spärrmarkering.',
  'adm-kard': 'Vårdadministratör: tar emot remisser och ser kontaktuppgifter och vårdkontakter, men ingen journaltext och inga läkemedel.',
  'logg': 'Logguppföljning: ser varje åtkomst till alla patienter, filtrerar på nödåtkomst, nekade försök och samtycken och kontrollerar att loggkedjan är hel.',
};

export async function visa(main) {
  main.innerHTML = `<div class="inloggning">
    <section class="inloggning-intro" aria-labelledby="inl-rubrik">
      <div class="inloggning-marke">${logotyp(44)}<div><p class="marke-namn">Vårdkällan</p><p class="marke-under">Hela vården i ett öppet system</p></div></div>
      <h1 id="inl-rubrik" tabindex="-1">Logga in med SITHS-kort</h1>
      <p>I vården loggar man in med SITHS-kortet, ett tjänstekort med e-legitimation. I demon är kortet simulerat: du väljer en påhittad person, och behörigheten följer personens yrke och enhet precis som med ett riktigt kort.</p>
      <p>All behörighet kontrolleras på servern. Varje öppnad journal loggas i en logg som inte går att ändra, och du kan granska loggen genom att logga in som Mats Wall.</p>
      <p class="liten-text">Varje besökare får en egen sandlåda med påhittade patienter. Det du gör syns bara för dig och kan återställas med knappen överst.</p>
    </section>
    <section class="roller" aria-labelledby="roll-rubrik">
      <h2 id="roll-rubrik">Välj demoroll</h2>
      <ul class="rollista" id="rollista"><li class="tom">Hämtar demorollerna.</li></ul>
    </section>
  </div>`;
  const roller = await api('/api/demo/personal');
  const lista = main.querySelector('#rollista');
  lista.innerHTML = roller.map(r => `<li>
    <button type="button" class="roll" data-roll="${esc(r.id)}" aria-describedby="roll-${esc(r.id)}-visar">
      <span class="roll-kort" aria-hidden="true">${ikon.kort}</span>
      <span class="roll-text">
        <span class="roll-namn">${esc(r.namn)}</span>
        <span class="roll-yrke">${esc(r.titel)}</span>
        <span class="roll-enhet">${esc(r.enhet.namn)}</span>
      </span>
      <span class="roll-pil" aria-hidden="true">${ikon.pil}</span>
    </button>
    <p class="roll-visar" id="roll-${esc(r.id)}-visar">${esc(VISAR[r.id] ?? '')}</p>
  </li>`).join('');
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-roll]');
    if (b) loggaIn(b.dataset.roll, b).catch(() => {});
  });
}
