// Runda 9, r7: streckkodsläsaren (Sussa 3.1.3.6). En läsare i tangentbordsläge skriver koden och trycker Enter. Fältet
// Skanna i toppraden tar emot koden, och när fokus inte står i ett textfält fångas en snabb följd av tecken som slutar
// med Enter också utan fältet. Servern avgör vad koden är och prövar behörigheten. Gränssnittet säger bara vilken
// patient som är öppen och i vilket sammanhang (provtagning, läkemedel), och följer svaret.
import { esc, api, notis, felNotis } from './ui.js';
import { far, utanJournal, rita } from './app.js';

const MAX_MS_MELLAN = 40;
let senastePatient = null;

export const faltHtml = () => (far('sok') && !utanJournal() ? `<form class="skanna" data-skanna role="search" aria-label="Skanna streckkod">
  <label class="sr" for="skanna-falt">Skanna streckkod</label>
  <input id="skanna-falt" name="kod" type="text" autocomplete="off" spellcheck="false" maxlength="200" placeholder="Skanna armband, rör eller förpackning">
</form>` : '');

// Sammanhanget ur adressen: öppen patient och flik.
function sammanhang() {
  const m = location.hash.match(/^#\/patient\/([\w-]+)(?:\/([a-z]+))?/);
  if (m) return { patientId: decodeURIComponent(m[1]), sammanhang: m[2] === 'prover' ? 'provtagning' : m[2] === 'lakemedel' ? 'administrering' : 'oppna' };
  if (location.hash.startsWith('#/provtagning')) return { patientId: senastePatient && Date.now() - senastePatient.tid < 120_000 ? senastePatient.id : null, sammanhang: 'provtagning' };
  if (location.hash.startsWith('#/administrering')) return { patientId: senastePatient && Date.now() - senastePatient.tid < 120_000 ? senastePatient.id : null, sammanhang: 'administrering' };
  return { patientId: null, sammanhang: 'oppna' };
}

export async function skanna(kod) {
  const s = sammanhang();
  try {
    const r = await api('/api/skanna', { metod: 'POST', data: { kod, ...s } });
    if (r.typ === 'patient') {
      senastePatient = { id: r.patient.id, tid: Date.now() };
      if (r.sammaPatient === false) notis(r.varning, 'info', { kvar: true });
      else if (r.sammaPatient === true) notis(r.text);
      else if (location.hash.startsWith('#/provtagning') || location.hash.startsWith('#/administrering')) notis(`${r.patient.namn}, ${r.patient.personnummer}. Skanna rören eller förpackningen.`);
      else location.hash = r.oppna;
      return r;
    }
    notis(r.text, r.varningar?.length ? 'info' : 'ok', { kvar: Boolean(r.varningar?.length) });
    if (r.typ === 'etikett' && r.tagen) rita();
    return r;
  } catch (e) { felNotis(e); return null; }
}

document.addEventListener('submit', (e) => {
  const f = e.target.closest?.('[data-skanna]');
  if (!f) return;
  e.preventDefault();
  const falt = f.querySelector('input');
  const kod = falt.value.trim();
  falt.value = '';
  if (kod) skanna(kod);
});

// En läsare skriver snabbare än en människa. Tecken som kommer tätt och slutar med Enter, när fokus inte står i ett
// fält, räknas som en skanning.
let buffert = '';
let senast = 0;
document.addEventListener('keydown', (e) => {
  const mal = e.target;
  if (mal?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const nu = Date.now();
  if (nu - senast > MAX_MS_MELLAN) buffert = '';
  senast = nu;
  if (e.key === 'Enter') {
    if (buffert.length >= 8) { e.preventDefault(); const kod = buffert; buffert = ''; skanna(kod); }
    buffert = '';
    return;
  }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) buffert += e.key;
});

export const _test = { sammanhang, esc };
