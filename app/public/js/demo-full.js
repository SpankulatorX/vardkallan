// Runda 13, r2: sidan som visas när demon är full. Servern svarar 503 med koden demo_full och hur många sekunder det är
// lönt att vänta. Sidan förklarar läget på vanlig svenska, räknar ner och försöker igen av sig själv. De som redan
// arbetar i demon ser aldrig sidan, eftersom deras sandlådor aldrig tas bort för att ge plats.
let timer = null;
let kvar = 0;
let forsok = null;

const tidText = (s) => {
  const m = Math.floor(s / 60);
  const sek = s % 60;
  if (m === 0) return `${sek} ${sek === 1 ? 'sekund' : 'sekunder'}`;
  return `${m} ${m === 1 ? 'minut' : 'minuter'}${sek ? ` och ${sek} ${sek === 1 ? 'sekund' : 'sekunder'}` : ''}`;
};
const ORSAK = {
  minne: 'Platserna för sandlådor som används just nu är upptagna. En plats blir ledig när någon har gått ifrån sin sandlåda en stund, oftast inom några minuter.',
  disk: 'Alla platser för sandlådor är upptagna. En plats blir ledig när en sandlåda inte har använts på en tid.',
};

export const visas = () => Boolean(document.getElementById('demo-full'));

// data är svaret från servern: orsak och forsokIgenSekunder. nyttForsok är funktionen som försöker igen och ritar
// sidan som vanligt när det går.
export function visa(data, nyttForsok) {
  forsok = nyttForsok;
  kvar = Math.max(5, Math.round(Number(data?.forsokIgenSekunder) || 60));
  const ram = document.getElementById('ram');
  if (!visas()) {
    ram.innerHTML = `<header class="topp"><div class="topp-inre">
        <a class="varumarke" href="#/"><span><span class="namn">Vårdkällan</span><span class="under">Hela vården i ett öppet system</span></span></a>
        <nav class="topp-lankar" aria-label="Om Vårdkällan"><a href="#/krav">Kravspårbarhet</a><a href="#/moduler">Moduler</a><a href="#/drift">Svarstider</a></nav>
      </div></header>
      <main id="innehall" class="innehall ute" tabindex="-1">
        <section id="demo-full" class="demo-full" aria-labelledby="demo-full-rubrik">
          <h1 id="demo-full-rubrik">Demon har många besökare just nu</h1>
          <p>Vårdkällan är ett öppet vårdinformationssystem som du kan pröva fritt. Varje besökare får en egen sandlåda med påhittade patienter, och just nu är alla platser upptagna. De som redan arbetar i demon får behålla sina sandlådor.</p>
          <p data-full-orsak></p>
          <p class="demo-full-tid"><strong>Det är tillfälligt.</strong> Sidan försöker igen av sig själv om <span data-full-kvar></span>. Du behöver inte göra något.</p>
          <p class="sr" role="status" data-full-status></p>
          <div class="knapprad"><button type="button" class="knapp" data-full-igen>Försök igen nu</button></div>
          <p class="hjalp">Medan du väntar kan du läsa hur kraven är uppfyllda under <a href="#/krav">Kravspårbarhet</a>, vad systemet består av under <a href="#/moduler">Moduler</a> eller hur snabbt servern svarar under <a href="#/drift">Svarstider</a>.</p>
        </section>
      </main>`;
    ram.querySelector('[data-full-igen]').addEventListener('click', () => igen());
    ram.querySelector('#innehall').focus({ preventScroll: true });
  }
  ram.querySelector('[data-full-orsak]').textContent = ORSAK[data?.orsak] ?? ORSAK.disk;
  document.title = 'Demon har många besökare: Vårdkällan';
  rakna();
  clearInterval(timer);
  timer = setInterval(() => { kvar--; if (kvar <= 0) igen(); else rakna(); }, 1000);
}

function rakna() {
  const el = document.querySelector('[data-full-kvar]');
  if (el) el.textContent = tidText(Math.max(0, kvar));
}

async function igen() {
  clearInterval(timer);
  const status = document.querySelector('[data-full-status]');
  if (status) status.textContent = 'Försöker igen.';
  try { await forsok?.(); } catch { /* forsok visar sidan igen med en ny tid */ }
}

// Sidan försvinner när det gick att få en sandlåda.
export function stang() {
  clearInterval(timer);
  timer = null;
}
