// Varning innan inloggningen går ut (runda 7, r2, K2 1.6.1 justerbar tidsgräns). Servern säger i varje svar när
// inloggningen går ut utan aktivitet (rubriken X-Inloggning-Gar-Ut). Fem minuter innan visas en varning som skärmläsare
// läser upp (role="alertdialog") med knappen Fortsätt arbeta, som förlänger inloggningen på servern. Gör användaren
// inget sparas text i en anteckning eller remiss som utkast, och sedan loggas användaren ut. Utkasten finns kvar efter
// en ny inloggning. Under ett avbrott loggas ingen ut, eftersom läskopian då behövs.
import { esc, api, notis, avbrott, vantaPaAnrop, klockslag } from './ui.js';
import { S, loggaUt } from './app.js';

const VARNING_MS = 5 * 60_000;
const SPARA_FORE_MS = 20_000;
let garUt = null;
let tVarning = null;
let tSlut = null;
let forraFokus = null;

const inloggad = () => Boolean(S.session?.inloggad);

export function stopp() {
  clearTimeout(tVarning); clearTimeout(tSlut);
  garUt = null;
  dolj(false);
}

// Anropas med tiden från servern efter varje svar.
export function satt(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return;
  garUt = t;
  planera();
}

function planera() {
  clearTimeout(tVarning); clearTimeout(tSlut);
  if (!garUt || !inloggad()) return;
  const kvar = garUt - Date.now();
  if (kvar > VARNING_MS) { dolj(true); tVarning = setTimeout(visa, kvar - VARNING_MS); } else visa();
  tSlut = setTimeout(slut, Math.max(0, kvar - SPARA_FORE_MS));
}

function visa() {
  if (!inloggad() || avbrott.aktivt || avbrott.simulerat) return;
  let el = document.getElementById('tidsgrans');
  const minuter = S.session?.inloggning?.minuter ?? 30;
  const text = `Du har inte gjort något i Vårdkällan på en stund. Du loggas ut klockan ${klockslag(new Date(garUt).toISOString())}, efter ${minuter} minuter utan aktivitet. Text som du har skrivit i en anteckning eller en remiss sparas då som utkast och finns kvar när du loggar in igen.`;
  if (el) { el.querySelector('#tidsgrans-text').textContent = text; return; }
  el = document.createElement('div');
  el.id = 'tidsgrans';
  el.className = 'tidsgrans';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-labelledby', 'tidsgrans-rubrik');
  el.setAttribute('aria-describedby', 'tidsgrans-text');
  el.innerHTML = `<h2 id="tidsgrans-rubrik">Du loggas snart ut</h2><p id="tidsgrans-text">${esc(text)}</p>
    <div class="knapprad"><button type="button" class="knapp" data-a="forlang">Fortsätt arbeta</button></div>`;
  document.body.append(el);
  forraFokus = document.activeElement;
  el.querySelector('[data-a="forlang"]').focus();
}

function dolj(lamnaFokus) {
  const el = document.getElementById('tidsgrans');
  if (!el) return;
  const hadeFokus = el.contains(document.activeElement);
  el.remove();
  if (lamnaFokus && hadeFokus) {
    const mal = forraFokus?.isConnected && forraFokus !== document.body ? forraFokus : document.querySelector('main h1');
    mal?.focus();
  }
  forraFokus = null;
}

export async function forlang(knapp) {
  if (knapp) knapp.disabled = true;
  try {
    // Svaret har en ny tid i rubriken, som flyttar varningen och tar bort rutan.
    const r = await api('/api/session/forlang', { metod: 'POST', data: {} });
    if (r.inloggning?.garUt) satt(r.inloggning.garUt);
    notis(`Du är inloggad. Inloggningen gäller till klockan ${klockslag(r.inloggning.garUt)} om du inte gör något.`, 'info');
  } catch { /* 401 hanteras av api() */ } finally { if (knapp?.isConnected) knapp.disabled = false; }
}

// Sparar text i öppna formulär som utkast med formulärens egna knappar. Ger vad som sparades.
async function sparaUtkast() {
  const sparat = [];
  const main = document.getElementById('innehall');
  if (!main) return sparat;
  for (const b of main.querySelectorAll('button')) {
    if (b.textContent.trim() !== 'Spara utkast' || b.disabled || !b.checkVisibility()) continue;
    const form = b.closest('form');
    const harText = form && [...form.querySelectorAll('textarea, input[type="text"]')].some(f => f.value.trim());
    if (!harText) continue;
    b.click();
    sparat.push(form.closest('#remissform, .remissform') || form.id === 'remissform' ? 'en remiss' : 'en anteckning');
  }
  await vantaPaAnrop();
  return sparat;
}

async function slut() {
  if (!inloggad() || avbrott.aktivt || avbrott.simulerat) return;
  // Har inloggningen förlängts i en annan flik eller av ett anrop gäller den nya tiden.
  if (garUt - Date.now() > SPARA_FORE_MS + 1000) { planera(); return; }
  const sparat = await sparaUtkast();
  const minuter = S.session?.inloggning?.minuter ?? 30;
  const vad = sparat.length ? ` Det du hade skrivit är sparat som utkast (${[...new Set(sparat)].join(' och ')}) och finns kvar när du loggar in igen.` : '';
  await loggaUt({ text: `Du är utloggad efter ${minuter} minuter utan aktivitet.${vad}` });
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a="forlang"]');
  if (b) forlang(b);
});
