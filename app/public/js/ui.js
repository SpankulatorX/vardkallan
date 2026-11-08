// Gemensamma hjälpare för vyerna: anrop, formatering, dialoger, notiser och ikoner.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Tider kommer i UTC och visas i svensk tid. Datum (YYYY-MM-DD) visas som de är.
const TZ = 'Europe/Stockholm';
const MANAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const delar = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return p;
};
export function datum(v) {
  if (!v) return '';
  const s = String(v);
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) [y, m, d] = s.split('-');
  else { const p = delar(s); if (!p) return s; ({ year: y, month: m, day: d } = p); }
  return `${Number(d)} ${MANAD[Number(m) - 1]} ${y}`;
}
export function klockslag(iso) {
  const p = iso && delar(iso);
  return p ? `${p.hour}:${p.minute}` : '';
}
export const tidpunkt = (iso) => (iso ? `${datum(iso)} kl. ${klockslag(iso)}` : '');
// Dagens datum i svensk tid, YYYY-MM-DD.
export function idag() {
  const p = delar(new Date().toISOString());
  return `${p.year}-${p.month}-${p.day}`;
}
export function plusDagar(isoDatum, n) {
  const d = new Date(`${isoDatum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const tal = (n, dec = 1) => (n == null ? '' : Number(n).toLocaleString('sv-SE', { maximumFractionDigits: dec }));
export const plural = (n, en, flera) => `${n} ${n === 1 ? en : flera}`;

// Kodvärden till text.
export const GRUND = {
  egen_enhet: 'Egen enhet', vardrelation: 'Vårdrelation', aktivt_val: 'Aktivt val', samtycke_sparr: 'Samtycke till spärrade uppgifter',
  nodatkomst: 'Nödåtkomst', administrativ: 'Administrativ uppgift', logggranskning: 'Logggranskning', nekad: 'Nekad',
  egen_atkomst: 'Patientens egen åtkomst', vardnadshavare: 'Vårdnadshavare',
  arkivbeslut: 'Arkivbeslut', uppfoljning: 'Uppföljning',
  // Runda 6, r3: kommunens part i samordnad planering.
  samverkan: 'Samverkan med kommunen',
  // Runda 7, r3: ekonomens faktureringsunderlag och prislistor.
  ekonomi: 'Ekonomi',
};
export const NLL = { skickad: 'Skickas', kvitterad: 'Kvitterad av NLL', okand_kontrolleras: 'Okänd, kontrolleras', fel: 'Fel från NLL',
  // Runda 6, r2: muntlig ordination och läkemedel som inte skickas till NLL.
  vantar_signering: 'Väntar på signering', ej_aktuell: 'Skickas inte till NLL' };
export const ORDTYP = { staende: 'Stående', vid_behov: 'Vid behov', tillfallig: 'Tillfällig' };
export const PRIORITET_REMISS = { akut: 'Akut', skyndsam: 'Skyndsam', normal: 'Normal' };
export const PRIORITET_VANTRUM = { rod: 'Röd', orange: 'Orange', gul: 'Gul', gron: 'Grön', bla: 'Blå' };
export const VARDFORM = { slutenvard: 'Slutenvård', akut: 'Akut', oppenvard: 'Öppenvård' };
export const HANDLING = {
  las_oversikt: 'Läste patientöversikten', las_journal: 'Läste journalanteckningar', las_omvardnad: 'Läste omvårdnadsanteckningar',
  skriv_journal: 'Skrev journalanteckning', skriv_omvardnad: 'Skrev omvårdnadsanteckning', las_lakemedel: 'Läste läkemedelslistan',
  ordinera: 'Ordinerade eller ändrade läkemedel', ge_lakemedel: 'Gav läkemedel', las_matvarden: 'Läste mätvärden', registrera_matvarde: 'Registrerade mätvärde',
  las_diagnoser: 'Läste diagnoser', las_remiss: 'Läste remisser', las_remiss_status: 'Såg remissers status', remittera: 'Skickade remiss',
  mottag_remiss: 'Kvitterade mottagen remiss', bedom_remiss: 'Bedömde remiss', svara_remiss: 'Svarade på remiss', kvittera_svar: 'Kvitterade remissvar',
  las_admin: 'Läste administrativa uppgifter', sok: 'Sökte patient', vantrum: 'Såg väntrummet', nodatkomst: 'Använde nödåtkomst',
  andra_enheter: 'Visade uppgifter från andra vårdenheter', samtycke_sparr: 'Registrerade samtycke till spärrade uppgifter',
  visa_identitet: 'Visade skyddad identitet', las_logg: 'Läste åtkomstloggen',
  registrera_vardkontakt: 'Registrerade eller ändrade vårdkontakt', vardtillfalle: 'Skrev in, flyttade eller skrev ut', halsoarende: 'Bekräftade hälsoärende',
  invanare_las: 'Läste journalen i Min journal', invanare_begaran: 'Skickade en begäran i Min journal',
  registrera_patient: 'Registrerade ny patient', andra_identitet: 'Registrerade ny identitet', sla_samman: 'Slog samman journaler',
  dubblettkontroll: 'Såg ett förslag om sammanslagning', dubblett_avfardad: 'Avfärdade ett förslag om sammanslagning',
  skriv_ut: 'Skrev ut journalen', utlamna: 'Registrerade utlämnande eller återlämnande', begara_kontrasignering: 'Begärde kontrasignering',
  kontrasignera: 'Kontrasignerade', registrera_arkivbeslut: 'Registrerade eller läste arkivbeslut', arkivera: 'Exporterade till e-arkiv',
  gallra: 'Gallrade journalen efter beslut', radera: 'Förstörde journalhandlingar efter beslut', datauttag: 'Hämtade datauttaget för uppföljning',
  // Runda 6, r3.
  las_vardplan: 'Läste vårdplaner', vardplan: 'Upprättade eller ändrade vårdplan', vardplan_atgard: 'Registrerade utförd åtgärd i vårdplan',
  las_tvangsvard: 'Läste uppgifter om tvångsvård', tvangsvard: 'Registrerade i tvångsvården', samordna: 'Samordnad planering', samverkan: 'Kommunen läste samordnad planering',
  // Runda 6, r6.
  lakemedelsansvar: 'Läste eller ändrade uppdrag i läkemedelshanteringen', godkanna_mall: 'Godkände eller läste läkemedelsmallar',
};
// Runda 6, r4: bevakningar och tidboken.
// Runda 7, r3: ekonomi.
Object.assign(HANDLING, { faktureringsunderlag: 'Tog fram faktureringsunderlag', prislista: 'Läste eller ändrade prislistor', las_kostnader: 'Såg kostnaderna i vårdprocessen',
  fardigbehandlad: 'Registrerade medicinskt färdigbehandlad', hjalpmedel: 'Registrerade utlämnat hjälpmedel', lma: 'Registrerade LMA-kort' });
// Runda 7, r4: systemförvaltningen.
Object.assign(HANDLING, { konfigurera: 'Föreslog eller beslutade om en ändring av regler och parametrar', omorganisera: 'Förberedde eller avbröt en omorganisation', undanta: 'Föreslog eller beslutade om ett undantag från visning', lagring: 'Kontrollerade säkerhetskopian' });
Object.assign(HANDLING, { bevaka: 'Lade upp eller avslutade bevakning', bevaka_enhet: 'Lade upp bevakning för vårdenheten', las_tidbok: 'Läste tidboken', statistik: 'Såg statistik utan personuppgifter' });
// Runda 8, r2: remiss på uppdrag, fördelning, remisskonferens och pappersremiss.
Object.assign(HANDLING, { remittera_pa_uppdrag: 'Skrev remiss på uppdrag av en läkare', fordela_remiss: 'Fördelade remiss till en läkare', remisskonferens: 'Satte remiss på remisskonferens',
  registrera_beslut_pa_uppdrag: 'Registrerade beslut om remiss på uppdrag av en läkare', registrera_extern_remiss: 'Registrerade pappersremiss från en extern vårdgivare' });
// Runda 8, r3: avdelningens planering.
Object.assign(HANDLING, { las_planering: 'Såg planerade händelser', planera: 'Planerade eller strök en uppgift', utfora_uppgift: 'Registrerade en uppgift som utförd' });
// Runda 9, r1: förbrukningsartiklar.
Object.assign(HANDLING, { forskriva_forbrukning: 'Förskrev eller ändrade förbrukningsartiklar', bestalla_lakemedel: 'Beställde extempore eller blodprodukt' });
export const YRKE = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', underskoterska: 'Undersköterska', vardadministrator: 'Vårdadministratör', logggranskare: 'Logggranskare', arkivarie: 'Arkivarie', uppfoljning: 'Analytiker (uppföljning)', kommun: 'Kommunens personal (simulerad)', farmaceut: 'Farmaceut', verksamhetschef: 'Verksamhetschef', ekonom: 'Ekonom', systemforvaltare: 'Systemförvaltare' };

// Anrop mot API:t. Svarstiden läses från Server-Timing. Fel kastas som ApiFel med serverns text och kod.
export class ApiFel extends Error {
  constructor(status, data) {
    super(data?.fel || `Servern svarade ${status}.`);
    this.status = status;
    this.kod = data?.kod ?? null;
    this.data = data ?? {};
  }
}
// ejLaslage: när den ger true används aldrig läsläget eller läskopian (Min journal).
export const krokar = { svarstid: null, vid401: null, vid429: null, efterSkrivning: null, ejLaslage: null, inloggning: null };

// Avbrott (D4). När servern inte svarar går gränssnittet över till läsläge: läsningar besvaras från den krypterade
// läskopian i webbläsaren och skrivningar stoppas. avbrott.js sätter upptackt (kontrollerar att servern verkligen är
// nere och visar läsläget) och svara (läser ur läskopian). simulerat gör att klienten beter sig som om servern var nere.
export const avbrott = { aktivt: false, simulerat: false, upptackt: null, svara: null };
// Svar som betyder att servern bakom inte nås: 502 till 504 från Caddy och 52x från Cloudflare.
const NERE = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
const natverkFel = () => new ApiFel(0, { fel: 'Det gick inte att nå servern. Kontrollera anslutningen och försök igen.', kod: 'natverk' });
async function franKopia(vag, metod) {
  if (!avbrott.aktivt) await avbrott.upptackt?.(true);
  if (!avbrott.svara) throw natverkFel();
  return avbrott.svara(vag, metod);
}

export function lasServerTiming(h) {
  const m = (h || '').match(/app;dur=([\d.]+)/);
  return m ? Number(m[1]) : null;
}

// Pågående anrop avbryts vid utloggning, så att ett anrop som når servern efter utloggningen inte ger 401.
const pagaende = new Set();
export function avbrytAllaAnrop() { for (const k of pagaende) k.abort(); pagaende.clear(); }
// Runda 7, r2: väntar tills inga anrop pågår, till exempel när utkast sparas innan inloggningen går ut.
export async function vantaPaAnrop(maxMs = 5000) {
  const slut = Date.now() + maxMs;
  while (pagaende.size && Date.now() < slut) await new Promise(r => setTimeout(r, 50));
}

// direkt: anropet går alltid till servern, också i läsläget (hälsokontrollen, läskopian och loggen från läsläget).
// bakgrund: anropet görs av gränssnittet självt och räknas inte som aktivitet för inloggningen (runda 7, r2).
export async function api(vag, { metod = 'GET', data, tyst = false, direkt = false, bakgrund = false } = {}) {
  if (krokar.ejLaslage?.()) direkt = true;
  if (!direkt && (avbrott.aktivt || avbrott.simulerat)) return franKopia(vag, metod);
  let r;
  const t0 = performance.now();
  const kontroll = new AbortController();
  pagaende.add(kontroll);
  try {
    r = await fetch(vag, {
      method: metod,
      headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(bakgrund ? { 'X-Vk-Bakgrund': '1' } : {}) },
      body: data !== undefined ? JSON.stringify(data) : undefined,
      credentials: 'same-origin',
      signal: kontroll.signal,
    });
  } catch {
    if (kontroll.signal.aborted) throw new ApiFel(0, { fel: 'Anropet avbröts.', kod: 'avbruten' });
    if (!direkt && await avbrott.upptackt?.()) return franKopia(vag, metod);
    throw natverkFel();
  } finally {
    pagaende.delete(kontroll);
  }
  if (!direkt && NERE.has(r.status) && await avbrott.upptackt?.()) return franKopia(vag, metod);
  const st = lasServerTiming(r.headers.get('server-timing'));
  krokar.svarstid?.({ vag, metod, server: st, totalt: performance.now() - t0, status: r.status });
  const garUt = r.headers.get('x-inloggning-gar-ut');
  if (garUt) krokar.inloggning?.(garUt);
  const txt = await r.text();
  let j = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch { j = { fel: 'Servern gav ett svar som inte gick att läsa.' }; }
  if (!r.ok) {
    const e = new ApiFel(r.status, j);
    if (r.status === 401 && !tyst) krokar.vid401?.(e);
    if (r.status === 429) krokar.vid429?.(e);
    throw e;
  }
  if (metod !== 'GET') krokar.efterSkrivning?.(vag);
  return j;
}

// Råanrop som behåller status, rubriker och text (för FHIR-exemplen).
export async function raa(vag) {
  if (avbrott.aktivt || avbrott.simulerat) throw new ApiFel(0, { fel: 'Det öppna API:t nås inte under avbrottet. Läskopian innehåller inga FHIR-svar.', kod: 'laslage' });
  const t0 = performance.now();
  const r = await fetch(vag, { credentials: 'same-origin' });
  const text = await r.text();
  const st = lasServerTiming(r.headers.get('server-timing'));
  krokar.svarstid?.({ vag, metod: 'GET', server: st, totalt: performance.now() - t0, status: r.status });
  return { status: r.status, typ: r.headers.get('content-type'), server: st, text };
}

// Notiser. typ: ok | fel | info
export function notis(text, typ = 'ok', { kvar = false } = {}) {
  const el = document.createElement('div');
  el.className = `notis notis-${typ}`;
  el.setAttribute('role', typ === 'fel' ? 'alert' : 'status');
  el.innerHTML = `${typ === 'fel' ? ikon.varning : typ === 'ok' ? ikon.bock : ikon.info}<span>${esc(text)}</span>`;
  const behallare = document.getElementById('notiser');
  behallare.append(el);
  // Högst tre notiser åt gången; den äldsta försvinner först.
  while (behallare.children.length > 3) behallare.firstElementChild.remove();
  // Runda 7, r2 (K2 1.6.1, justerbar tidsgräns): ett fel står kvar tills det stängs, eller tills tre nyare notiser har
  // kommit. Andra notiser bekräftar något som också syns på sidan och försvinner efter en stund.
  if (typ === 'fel' || kvar) {
    const stang = document.createElement('button');
    stang.type = 'button';
    stang.className = 'notis-stang';
    stang.setAttribute('aria-label', 'Stäng meddelandet');
    stang.innerHTML = ikon.kryss;
    stang.addEventListener('click', () => el.remove());
    el.append(stang);
    return;
  }
  setTimeout(() => el.remove(), 4200);
}
export function felNotis(e) {
  if (e?.status === 401 || e?.status === 429 || e?.kod === 'avbruten') return;
  notis(e?.message || 'Något gick fel.', 'fel');
}

// Modal dialog. html ska ha en rubrik med id="dlg-rubrik". Knappar med data-varde stänger dialogen.
// Med validera(data, dialog, varde) kan dialogen stoppa stängning; funktionen returnerar en feltext eller null.
let dlgNr = 0;
export function dialog(html, { onOpen, validera, klass = '' } = {}) {
  return new Promise(resolve => {
    const forra = document.activeElement;
    const dl = document.createElement('dialog');
    const id = `dlg-${++dlgNr}`;
    dl.className = `dialog ${klass}`;
    dl.setAttribute('aria-labelledby', `${id}-rubrik`);
    dl.innerHTML = `<div class="dialog-inre">${html.replace('id="dlg-rubrik"', `id="${id}-rubrik"`)}</div>`;
    document.body.append(dl);
    let klar = false;
    const avsluta = (v) => { if (klar) return; klar = true; dl.close(); resolve(v); };
    dl.addEventListener('click', e => {
      const b = e.target.closest('[data-varde]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.varde === 'avbryt') return avsluta(null);
      const form = dl.querySelector('form');
      if (form && !form.reportValidity()) return;
      const data = form ? Object.fromEntries(new FormData(form)) : {};
      const fel = validera?.(data, dl, b.dataset.varde);
      const ruta = dl.querySelector('.dialog-fel');
      if (fel) { if (ruta) { ruta.textContent = fel; ruta.hidden = false; } return; }
      avsluta({ val: b.dataset.varde, data });
    });
    dl.addEventListener('submit', e => e.preventDefault());
    dl.addEventListener('cancel', e => { e.preventDefault(); avsluta(null); });
    dl.addEventListener('close', () => { setTimeout(() => dl.remove(), 30); if (forra?.isConnected) forra.focus(); });
    dl.showModal();
    const forsta = dl.querySelector('[autofocus], textarea, input:not([type=hidden]):not([type=radio]), select, input[type=radio]:checked');
    (forsta ?? dl.querySelector('button'))?.focus();
    onOpen?.(dl);
  });
}

// Knapp som är spärrad medan ett anrop pågår. Fel visas som notis och kastas vidare.
// Med ett formulär visas 400-fel vid fälten i stället för som notis.
export async function medKnapp(knapp, fn, form = null) {
  if (knapp) { knapp.disabled = true; knapp.setAttribute('aria-busy', 'true'); }
  try { const r = await fn(); if (form) faltFel(form, null); return r; } catch (e) {
    if (form && e?.status === 400) faltFel(form, e); else felNotis(e);
    throw e;
  }
  finally { if (knapp?.isConnected) { knapp.disabled = false; knapp.removeAttribute('aria-busy'); } }
}

// Visar fältfel från ett 400-svar i ett formulär.
export function faltFel(form, e, namn = {}) {
  const ruta = form.querySelector('.form-fel');
  // Runda 7, r2 (K2 1.9.1): feltexten hör till fältet med aria-errormessage, så att hjälpmedel läser den vid fältet.
  if (ruta && !ruta.id) ruta.id = `fel-${Math.random().toString(36).slice(2, 8)}`;
  form.querySelectorAll('[aria-invalid]').forEach(x => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-errormessage'); });
  const falt = e?.data?.falt ?? [];
  for (const f of falt) {
    const el = form.querySelector(`[name="${namn[f] ?? f}"]`);
    el?.setAttribute('aria-invalid', 'true');
    if (el && ruta) el.setAttribute('aria-errormessage', ruta.id);
  }
  if (ruta) { ruta.textContent = e?.message ?? ''; ruta.hidden = !e; }
  if (falt.length) form.querySelector(`[name="${namn[falt[0]] ?? falt[0]}"]`)?.focus();
}

const P = (d) => `<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
export const ikon = {
  bock: P('<path d="M20 6 9 17l-5-5"/>'),
  kryss: P('<path d="M18 6 6 18M6 6l12 12"/>'),
  varning: P('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  larm: P('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  las: P('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  skold: P('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  oga: P('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  sok: P('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  lista: P('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  inkorg: P('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>'),
  remiss: P('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'),
  vantrum: P('<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>'),
  logg: P('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  migrering: P('<path d="M4 7h12l-3-3M20 17H8l3 3"/>'),
  krav: P('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  moduler: P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  kod: P('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
  klocka: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  penna: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  arkiv: P('<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4"/>'),
  meny: P('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  ut: P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  pil: P('<path d="m9 18 6-6-6-6"/>'),
  kort: P('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  nyckel: P('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 5.8l3 3M14.2 8.6l2 2"/>'),
  person: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  piller: P('<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="m9.1 7.9 5.8 8.2"/>'),
  kalender: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M8 17h2M14 14h2"/>'),
  ko: P('<circle cx="6" cy="7" r="2.5"/><circle cx="12" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M3 17a3 3 0 0 1 6 0M9 17a3 3 0 0 1 6 0M15 17a3 3 0 0 1 6 0"/>'),
};

// Etikett för poster som migrerats från VAS eller Cosmic. Samma vikt som annat, bara märkt.
export const migreradEtikett = (x) => (x?.kallaEtikett ? `<span class="tagg tagg-migrerad">${ikon.arkiv}${esc(x.kallaEtikett)}</span>` : '');

// Rubrik för en vy. Fokus flyttas hit vid navigering.
export const vyRubrik = (text, under = '') => `<div class="vyhuvud"><h1 tabindex="-1">${esc(text)}</h1>${under ? `<p class="ingress">${under}</p>` : ''}</div>`;

export const tom = (text) => `<p class="tom">${esc(text)}</p>`;

// Ett fält i ett formulär.
export function falt({ namn, etikett, typ = 'text', varde = '', obligatorisk = false, hjalp = '', attr = '', alternativ = null, rader = 3 }) {
  const id = `f-${namn}-${Math.random().toString(36).slice(2, 7)}`;
  const req = obligatorisk ? ' required aria-required="true"' : '';
  const hj = hjalp ? `<span class="hjalp" id="${id}-h">${hjalp}</span>` : '';
  const desc = hjalp ? ` aria-describedby="${id}-h"` : '';
  let kontroll;
  if (alternativ) kontroll = `<select id="${id}" name="${esc(namn)}"${req}${desc} ${attr}>${alternativ.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(varde) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  else if (typ === 'textarea') kontroll = `<textarea id="${id}" name="${esc(namn)}" rows="${rader}"${req}${desc} ${attr}>${esc(varde)}</textarea>`;
  else kontroll = `<input id="${id}" name="${esc(namn)}" type="${typ}" value="${esc(varde)}"${req}${desc} ${attr}>`;
  return `<div class="falt"><label for="${id}">${esc(etikett)}${obligatorisk ? ' <span class="obl">(obligatoriskt)</span>' : ''}</label>${kontroll}${hj}</div>`;
}
