// Inloggning med simulerat SITHS-kort: välj en av demorollerna. När servern inte svarar visas i stället
// reservinloggningen: välj en person som har en reservkopia på datorn och ange reservkoden.
import { esc, api, ikon, avbrott, tidpunkt } from '../ui.js';
import { loggaIn, logotyp } from '../app.js';
import * as reserv from '../reservkopia.js';
import { oppnadMedReserv } from '../avbrott.js';

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

const marke = () => `<div class="inloggning-marke">${logotyp(44)}<div><p class="marke-namn">Vårdkällan</p><p class="marke-under">Hela vården i ett öppet system</p></div></div>`;

export async function visa(main) {
  if (avbrott.aktivt) return visaReserv(main);
  main.innerHTML = `<div class="inloggning">
    <section class="inloggning-intro" aria-labelledby="inl-rubrik">
      ${marke()}
      <h1 id="inl-rubrik" tabindex="-1">Logga in med SITHS-kort</h1>
      <p>I vården loggar man in med SITHS-kortet, ett tjänstekort med e-legitimation. I demon är kortet simulerat: du väljer en påhittad person, och behörigheten följer personens yrke och enhet precis som med ett riktigt kort.</p>
      <p>All behörighet kontrolleras på servern. Varje öppnad journal loggas i en logg som inte går att ändra, och du kan granska loggen genom att logga in som Mats Wall.</p>
      <p class="liten-text">Varje besökare får en egen sandlåda med påhittade patienter. Det du gör syns bara för dig och kan återställas med knappen överst.</p>
      <div class="reservkopior" id="reservkopior" hidden></div>
    </section>
    <section class="roller" aria-labelledby="roll-rubrik">
      <h2 id="roll-rubrik">Välj demoroll</h2>
      <ul class="rollista" id="rollista"><li class="tom">Hämtar demorollerna.</li></ul>
    </section>
  </div>`;
  visaReservkopior(main.querySelector('#reservkopior'));
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

// Vilka som har en reservkopia på datorn och när den går ut, så att den som delar dator ser det.
async function visaReservkopior(el) {
  const lista = await reserv.lista();
  if (!lista.length || !el?.isConnected) return;
  el.innerHTML = `<h2>${ikon.nyckel}Reservkopior på den här datorn</h2>
    <p>De här personerna kan öppna sin läskopia med sin reservkod om servern inte svarar. En reservkopia raderas när personen loggar ut och går ut efter 8 timmar.</p>
    <ul>${lista.map(r => `<li><strong>${esc(r.namn)}</strong>, ${esc(r.titel)}, ${esc(r.enhet)}. Går ut ${esc(tidpunkt(r.giltigTill))}.</li>`).join('')}</ul>`;
  el.hidden = false;
}

// Reservinloggningen under ett avbrott. Hela vyn är undantagen från spärren av skrivande (data-las-ok), eftersom den
// inte skriver något till journalen.
async function visaReserv(main, meddelande = '') {
  main.innerHTML = `<div class="inloggning" data-las-ok>
    <section class="inloggning-intro" aria-labelledby="inl-rubrik">
      ${marke()}
      <h1 id="inl-rubrik" tabindex="-1">Logga in med reservkod</h1>
      <p>Servern svarar inte, så det går inte att logga in som vanligt. Har du valt en reservkod på den här datorn kan du öppna din läskopia och läsa i den tills förbindelsen är tillbaka. Inget kan sparas under tiden.</p>
      <p>I vården låser SITHS-kortet upp en nyckel med PIN-koden även utan nät, och kortet räknar felaktiga försök. I demon är kortet simulerat med en reservkod. Efter 5 fel raderas reservkopian från datorn.</p>
    </section>
    <section class="roller" aria-labelledby="roll-rubrik">
      <h2 id="roll-rubrik">Reservkopior på den här datorn</h2>
      ${meddelande ? `<p class="ruta ruta-larm" role="alert">${esc(meddelande)}</p>` : ''}
      <ul class="rollista" id="reservval"><li class="tom">Läser reservkopiorna.</li></ul>
    </section>
  </div>`;
  const lista = await reserv.lista();
  const ul = main.querySelector('#reservval');
  if (!ul) return;
  if (!lista.length) {
    ul.innerHTML = '<li class="tom">Det finns ingen reservkopia på den här datorn. En reservkopia görs när du väljer en reservkod medan du är inloggad.</li>';
    return;
  }
  ul.innerHTML = lista.map((r, i) => `<li>
    <button type="button" class="roll" data-reserv="${esc(r.personalId)}" aria-expanded="false" aria-controls="rf-${i}">
      <span class="roll-kort" aria-hidden="true">${ikon.kort}</span>
      <span class="roll-text">
        <span class="roll-namn">${esc(r.namn)}</span>
        <span class="roll-yrke">${esc(r.titel)}</span>
        <span class="roll-enhet">${esc(r.enhet)}</span>
      </span>
      <span class="roll-pil" aria-hidden="true">${ikon.pil}</span>
    </button>
    <p class="roll-visar">Läskopia från ${esc(tidpunkt(r.skapad))}. Går ut ${esc(tidpunkt(r.giltigTill))}.</p>
    <form class="reserv-form" id="rf-${i}" data-personal="${esc(r.personalId)}" method="post" autocomplete="off" hidden>
      <div class="falt"><label for="rk-${i}">Reservkod för ${esc(r.namn)}</label><input id="rk-${i}" name="kod" type="password" autocomplete="off" maxlength="200" required></div>
      <p class="form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="submit" class="knapp">Öppna läsläget</button></div>
    </form>
  </li>`).join('');
  ul.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reserv]');
    if (!b) return;
    const form = ul.querySelector(`#${b.getAttribute('aria-controls')}`);
    const oppen = form.hidden;
    form.hidden = !oppen;
    b.setAttribute('aria-expanded', String(oppen));
    if (oppen) form.querySelector('input').focus();
  });
  ul.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target.closest('form');
    const falt = form.querySelector('input[name="kod"]');
    const kod = falt.value;
    falt.value = '';
    const ruta = form.querySelector('.form-fel');
    const knapp = form.querySelector('button[type="submit"]');
    ruta.hidden = true;
    knapp.disabled = true;
    knapp.setAttribute('aria-busy', 'true');
    try {
      const m = await reserv.lasUpp(form.dataset.personal, kod);
      await oppnadMedReserv(m);
    } catch (err) {
      if (!form.isConnected) return;
      // Är reservkopian borta ritas listan om med förklaringen överst.
      if (['raderad', 'utgangen', 'trasig', 'saknas'].includes(err.kod)) return visaReserv(main, err.message);
      ruta.textContent = err.message ?? 'Reservkopian gick inte att öppna.';
      ruta.hidden = false;
      falt.setAttribute('aria-invalid', 'true');
      falt.focus();
    } finally {
      if (knapp.isConnected) { knapp.disabled = false; knapp.removeAttribute('aria-busy'); }
    }
  });
}
