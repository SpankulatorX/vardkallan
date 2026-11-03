// Blodtryck över tid: en demotillämpning som visar hur en extern tillämpning ansluter med SMART on FHIR (runda 6, r5).
// Den startas från journalen (EHR launch, med iss och launch i adressen) eller för sig (standalone launch), hämtar en
// åtkomstbiljett med OAuth 2.0 och PKCE och läser patientens blodtryck med biljetten. Biljetten finns bara i minnet och
// försvinner när sidan stängs. Verifieraren för PKCE ligger i sessionStorage bara medan inloggningen pågår.
const KLIENT = 'blodtryck';
const LOINC_BT = '85354-9';
const q = new URLSearchParams(location.search);
const OMDIRIGERING = `${location.origin}${location.pathname}`;
const NYCKEL = 'vardkallan-smart-blodtryck';
const $ = (sel) => document.querySelector(sel);
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function meddela(data) {
  if (window.parent !== window) window.parent.postMessage({ typ: 'vardkallan-tillampning', klient: KLIENT, ...data }, location.origin);
}
function fel(text) {
  $('[data-status]').textContent = text;
  $('[data-status]').classList.add('bt-fel');
  meddela({ fel: text });
}

async function starta() {
  const iss = q.get('iss') ?? `${location.origin}/fhir`;
  // Bara Vårdkällan på samma webbplats godtas som utgivare i demon.
  if (new URL(iss).origin !== location.origin) return fel('Tillämpningen ansluter bara till Vårdkällan på den här webbplatsen.');
  const launch = q.get('launch');
  const r = await fetch(`${iss}/.well-known/smart-configuration`, { credentials: 'omit' });
  if (!r.ok) return fel('Vårdkällans inställningar för SMART on FHIR kunde inte hämtas.');
  const konf = await r.json();
  const verifierare = b64(crypto.getRandomValues(new Uint8Array(32)));
  const utmaning = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifierare))));
  const tillstand = b64(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem(NYCKEL, JSON.stringify({ verifierare, tillstand, iss, token: konf.token_endpoint }));
  const omfang = launch ? 'launch patient/Patient.read patient/Observation.read' : 'launch/patient patient/Patient.read patient/Observation.read';
  const p = new URLSearchParams({ response_type: 'code', client_id: KLIENT, redirect_uri: OMDIRIGERING, scope: omfang, state: tillstand, aud: iss, code_challenge: utmaning, code_challenge_method: 'S256' });
  if (launch) p.set('launch', launch);
  location.replace(`${konf.authorization_endpoint}?${p}`);
}

async function hamtaBiljett() {
  const s = JSON.parse(sessionStorage.getItem(NYCKEL) ?? 'null');
  sessionStorage.removeItem(NYCKEL);
  // Koden ska inte ligga kvar i adressen eller i historiken.
  history.replaceState(null, '', location.pathname);
  if (!s || s.tillstand !== q.get('state')) return fel('Inloggningen kunde inte kontrolleras. Starta tillämpningen igen från journalen.');
  const r = await fetch(s.token, {
    method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: OMDIRIGERING, client_id: KLIENT, code_verifier: s.verifierare }),
  });
  const t = await r.json();
  if (!r.ok || !t.access_token || !t.patient) return fel(`Tillämpningen fick ingen åtkomst. ${t.error_description ?? ''}`.trim());
  return visa(s.iss, t);
}

async function visa(iss, t) {
  const huvud = { Authorization: `Bearer ${t.access_token}`, Accept: 'application/fhir+json' };
  const hamta = async (vag) => {
    const r = await fetch(`${iss}/${vag}`, { headers: huvud, credentials: 'omit' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.issue?.[0]?.diagnostics ?? 'Uppgifterna kunde inte hämtas.');
    return data;
  };
  try {
    if (t.need_patient_banner) {
      const p = await hamta(`Patient/${encodeURIComponent(t.patient)}`);
      $('[data-patient]').textContent = p.name?.[0]?.text ?? '';
      $('[data-patient]').hidden = false;
    }
    const b = await hamta(`Observation?patient=${encodeURIComponent(t.patient)}`);
    const matningar = (b.entry ?? []).map(e => e.resource).filter(o => o.code?.coding?.some(c => c.code === LOINC_BT))
      .map(o => ({ tid: o.effectiveDateTime, sys: o.component?.[0]?.valueQuantity?.value, dia: o.component?.[1]?.valueQuantity?.value }))
      .filter(m => m.tid && Number.isFinite(m.sys) && Number.isFinite(m.dia)).sort((a, x) => a.tid.localeCompare(x.tid));
    rita(matningar);
    meddela({ antal: matningar.length });
  } catch (e) { fel(e.message); }
}

const tidText = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });

function rita(m) {
  $('[data-status]').textContent = m.length ? `${m.length} blodtryck. Det senaste är ${m.at(-1).sys}/${m.at(-1).dia} mmHg, ${tidText(m.at(-1).tid)}.` : 'Patienten har inga blodtryck som du får se.';
  if (!m.length) return;
  const B = 640; const H = 240; const V = 44; const U = 28;
  const min = Math.min(40, ...m.map(x => x.dia)) - 10;
  const max = Math.max(160, ...m.map(x => x.sys)) + 10;
  const t0 = Date.parse(m[0].tid); const t1 = Math.max(Date.parse(m.at(-1).tid), t0 + 1);
  const x = (tid) => V + ((Date.parse(tid) - t0) / (t1 - t0)) * (B - V - 12);
  const y = (v) => 8 + (1 - (v - min) / (max - min)) * (H - 8 - U);
  const linje = (falt) => m.map(p => `${x(p.tid).toFixed(1)},${y(p[falt]).toFixed(1)}`).join(' ');
  const nivaer = [60, 80, 100, 120, 140, 160].filter(v => v > min && v < max);
  const svg = `<svg viewBox="0 0 ${B} ${H}" role="img" aria-label="Blodtryck över tid, ${m.length} mätningar">
    ${nivaer.map(v => `<line class="bt-rutnat" x1="${V}" x2="${B - 12}" y1="${y(v)}" y2="${y(v)}"/><text class="bt-axel" x="${V - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    <polyline class="bt-sys" points="${linje('sys')}"/><polyline class="bt-dia" points="${linje('dia')}"/>
    ${m.map(p => `<circle class="bt-sys" cx="${x(p.tid)}" cy="${y(p.sys)}" r="3"/><circle class="bt-dia" cx="${x(p.tid)}" cy="${y(p.dia)}" r="3"/>`).join('')}
    <text class="bt-axel" x="${V}" y="${H - 6}">${tidText(m[0].tid)}</text><text class="bt-axel" x="${B - 12}" y="${H - 6}" text-anchor="end">${tidText(m.at(-1).tid)}</text>
  </svg><p class="bt-forklaring"><span class="bt-sys-farg">Systoliskt</span> <span class="bt-dia-farg">Diastoliskt</span></p>`;
  $('[data-diagram]').insertAdjacentHTML('beforeend', svg);
  $('[data-diagram]').hidden = false;
  const rader = [...m].reverse().map(p => `<tr><td>${tidText(p.tid)}</td><td>${p.sys}</td><td>${p.dia}</td></tr>`).join('');
  $('[data-tabell] tbody').innerHTML = rader;
  $('[data-tabell]').hidden = false;
}

if (q.get('error')) fel(`Vårdkällan nekade starten. ${q.get('error_description') ?? ''}`.trim());
else if (q.get('code')) hamtaBiljett().catch(() => fel('Tillämpningen kunde inte ansluta.'));
else starta().catch(() => fel('Tillämpningen kunde inte ansluta.'));
