// Inloggning: personal med simulerat SITHS-kort, eller patient med simulerad e-legitimation till Min journal.
import { esc, api, ikon } from '../ui.js';
import { loggaIn, loggaInInvanare, logotyp } from '../app.js';

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

// Vad några av patienterna visar i Min journal.
const VISAR_PATIENT = {
  'inv-p01': 'Inlagd på kardiologen. Ser vilka vårdenheter som har läst journalen sedan han kom in via akuten, och ett provsvar som väntar på vidimering.',
  'inv-p02': 'Öppnades med nödåtkomst när han kom in medvetslös. Nödåtkomsten syns i hans egen logglista.',
  'inv-p03': 'Har skyddade personuppgifter. Ser sina egna uppgifter, men namnet visas inte här i listan.',
  'inv-p04': 'Har spärrat uppgifter från psykiatrin. Ser själv allt, även det spärrade, och kan begära att spärren hävs.',
  'inv-p15': 'Psykiatrins mottagningsanteckningar visas 14 dagar efter signering, och omvårdnadsanteckningarna visas inte alls.',
  'inv-vh01': 'Läser barnets journal tills barnet fyller 13 år, men kan inte spärra barnets uppgifter.',
};

const FLIKAR = [['personal', 'Personal'], ['patient', 'Patient']];

export async function visa(main, _param, q) {
  const vald = q?.get('vy') === 'patient' ? 'patient' : 'personal';
  main.innerHTML = `<div class="inloggningssida">
    <div class="inloggning-marke">${logotyp(44)}<div><p class="marke-namn">Vårdkällan</p><p class="marke-under">Hela vården i ett öppet system</p></div></div>
    <h1 id="inl-rubrik" tabindex="-1">Logga in</h1>
    <div class="inloggningsval" role="tablist" aria-label="Logga in som">
      ${FLIKAR.map(([k, t]) => `<button type="button" role="tab" id="flik-${k}" aria-controls="panel-${k}" aria-selected="${k === vald}" tabindex="${k === vald ? 0 : -1}" data-flik="${k}">${k === 'personal' ? ikon.kort : ikon.person}<span>${esc(t)}</span></button>`).join('')}
    </div>
    <div class="inloggning" id="panel-personal" role="tabpanel" aria-labelledby="flik-personal"${vald === 'personal' ? '' : ' hidden'}>
      <section class="inloggning-intro" aria-labelledby="intro-personal">
        <h2 id="intro-personal">Logga in med SITHS-kort</h2>
        <p>I vården loggar man in med SITHS-kortet, ett tjänstekort med e-legitimation. I demon är kortet simulerat: du väljer en påhittad person, och behörigheten följer personens yrke och enhet precis som med ett riktigt kort.</p>
        <p>All behörighet kontrolleras på servern. Varje öppnad journal loggas i en logg som inte går att ändra, och du kan granska loggen genom att logga in som Mats Wall.</p>
        <p class="liten-text">Varje besökare får en egen sandlåda med påhittade patienter. Det du gör syns bara för dig och kan återställas med knappen överst.</p>
      </section>
      <section class="roller" aria-labelledby="roll-rubrik">
        <h2 id="roll-rubrik">Välj demoroll</h2>
        <ul class="rollista" id="rollista"><li class="tom">Hämtar demorollerna.</li></ul>
      </section>
    </div>
    <div class="inloggning" id="panel-patient" role="tabpanel" aria-labelledby="flik-patient"${vald === 'patient' ? '' : ' hidden'}>
      <section class="inloggning-intro" aria-labelledby="intro-patient">
        <h2 id="intro-patient">Logga in med e-legitimation</h2>
        <p>Min journal är Vårdkällans e-tjänst för invånare. Du läser din egen journal och ser vilka vårdenheter som har läst den, när och på vilken grund.</p>
        <p>I demon är e-legitimationen simulerad och inte kopplad till någon extern tjänst: du väljer en av de påhittade patienterna. Servern ger dig bara den journalen, aldrig någon annans och aldrig personalens funktioner.</p>
        <p class="liten-text">Min journal är öppen från 16 års ålder. Vårdnadshavare läser sitt barns journal tills barnet fyller 13 år, med sin egen e-legitimation. Du kan logga in som patient i samma sandlåda som personalen och se deras läsningar i din logglista.</p>
      </section>
      <section class="roller" aria-labelledby="pat-rubrik">
        <h2 id="pat-rubrik">Välj patient</h2>
        <ul class="rollista" id="patientlista"><li class="tom">Hämtar patienterna.</li></ul>
      </section>
    </div>
  </div>`;

  // Flikarna följer mönstret för tabbar: piltangenterna byter flik, Home och End går till första och sista.
  const flikar = [...main.querySelectorAll('[role="tab"]')];
  const valj = (k, fokus = false) => {
    for (const f of flikar) {
      const ar = f.dataset.flik === k;
      f.setAttribute('aria-selected', String(ar));
      f.tabIndex = ar ? 0 : -1;
      main.querySelector(`#panel-${f.dataset.flik}`).hidden = !ar;
      if (ar && fokus) f.focus();
    }
    history.replaceState(null, '', k === 'patient' ? '#/?vy=patient' : '#/');
  };
  main.querySelector('[role="tablist"]').addEventListener('click', (e) => {
    const f = e.target.closest('[role="tab"]');
    if (f) valj(f.dataset.flik);
  });
  main.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    const i = flikar.indexOf(document.activeElement);
    if (i < 0) return;
    const ny = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: flikar.length - 1 }[e.key];
    if (ny == null) return;
    e.preventDefault();
    valj(flikar[(ny + flikar.length) % flikar.length].dataset.flik, true);
  });

  const [roller, invanare] = await Promise.all([api('/api/demo/personal'), api('/api/demo/invanare')]);
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

  const plista = main.querySelector('#patientlista');
  plista.innerHTML = invanare.map(i => {
    const visar = VISAR_PATIENT[i.id] ?? '';
    const barn = i.barn.length ? `Vårdnadshavare till ${i.barn.map(b => `${b.namn}, ${b.alder} år`).join(' och ')}` : '';
    return `<li>
    <button type="button" class="inv-val" data-invanare="${esc(i.id)}"${visar || barn ? ` aria-describedby="inv-${esc(i.id)}-visar"` : ''}>
      <span class="roll-kort roll-kort-inv" aria-hidden="true">${ikon.person}</span>
      <span class="roll-text">
        <span class="roll-namn">${i.skyddad ? `${ikon.skold} ` : ''}${esc(i.namn)}</span>
        <span class="roll-yrke pnr">${esc(i.personnummer)}</span>
        <span class="roll-enhet">${esc(i.alder)} år${i.egenJournal ? '' : ', ingen egen journal i demon'}</span>
      </span>
      <span class="roll-pil" aria-hidden="true">${ikon.pil}</span>
    </button>
    ${visar || barn ? `<p class="roll-visar" id="inv-${esc(i.id)}-visar">${barn ? `${esc(barn)}. ` : ''}${esc(visar)}</p>` : ''}
  </li>`;
  }).join('');
  plista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-invanare]');
    if (b) loggaInInvanare(b.dataset.invanare, b).catch(() => {});
  });
}
