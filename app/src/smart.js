// SMART on FHIR (runda 6, r5, Sussa 5.1.1.4, 2.6.1.2 och 5.2.1.6). Externa tillämpningar startas från journalen (EHR
// launch) eller för sig (standalone launch) och får en åtkomstbiljett med OAuth 2.0, kod med PKCE (S256). Biljetten
// gäller den inloggade personen och begränsas av omfånget (scopes), aldrig mer än behörighetsmotorn ger personen själv:
// varje anrop prövas och loggas som om personen gjorde det, utan aktiva val, nödåtkomst eller samtycke. En biljett går
// ut efter 30 minuter, återkallas vid utloggning, ny inloggning och när tillämpningen stängs, och varje utfärdande,
// återkallelse och utgång loggas.
//
// Tillämpningarna registreras av administratören i TILLAMPNINGAR med de omfång och adresser som de får använda. Inget
// annat godtas. Demon har en registrerad tillämpning, Blodtryck över tid, som ligger på samma server.
import { createHash, randomBytes } from 'node:crypto';
import { Fel } from './db.js';
import { kanRoll, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { SMART_OMFANG } from './fhir-definitioner.js';

export const BILJETT_SEKUNDER = 30 * 60;
const KOD_SEKUNDER = 60;
const START_SEKUNDER = 5 * 60;

// Registrerade tillämpningar. adress och omdirigering är sökvägar på samma server i demon. kravs är handlingen i
// behörighetsmotorn som personen måste ha för att se tillämpningen i journalen.
export const TILLAMPNINGAR = [
  {
    id: 'blodtryck', namn: 'Blodtryck över tid', adress: '/tillampningar/blodtryck/index.html', omdirigering: ['/tillampningar/blodtryck/index.html'],
    beskrivning: 'Ett diagram över patientens blodtryck. En enkel demotillämpning som läser blodtrycket med SMART on FHIR.',
    omfang: ['launch', 'launch/patient', 'patient/Patient.read', 'patient/Observation.read'], kravs: 'las_matvarden',
    far: 'Läsa patientens namn och mätvärden. Inget annat, och bara det du själv får se utan aktiva val.',
  },
];
export const tillampning = (id) => TILLAMPNINGAR.find(t => t.id === id) ?? null;

const slump = () => randomBytes(32).toString('base64url');
export const s256 = (verifierare) => createHash('sha256').update(verifierare).digest('base64url');

// Omfång enligt SMART App Launch 1 (read, write, *) och 2 (c, r, u, d, s).
// Runda 10, r1: system/ för systemkonton utan inloggad person (SMART Backend Services, systemkonton.js).
const OMFANG = /^(patient|user|system)\/(\*|[A-Z][A-Za-z]{1,40})\.(read|write|\*|c?r?u?d?s?)$/;
export function tolkaOmfang(text) {
  const delar = String(text ?? '').split(/\s+/).filter(Boolean);
  const ut = [];
  for (const d of delar) {
    if (d === 'launch' || d === 'launch/patient') { ut.push({ text: d, kontext: true }); continue; }
    const m = d.match(OMFANG);
    if (!m || !m[3]) continue;
    const r = m[3];
    const ratt = r === 'read' ? 'rs' : r === 'write' ? 'cud' : r === '*' ? 'cruds' : r;
    ut.push({ text: d, niva: m[1], typ: m[2], ratt });
  }
  return ut;
}
const BEHOV = { GET: 'rs', POST: 'c', PUT: 'u', DELETE: 'd' };

// Om biljetten tillåter anropet. malPatient är patienten som anropet gäller (null för personalens egna resurser som
// Organization). Ger null när det är tillåtet, annars en förklaring.
export function provaOmfang(biljett, { metod, typ, malPatient }) {
  const behov = metod === 'GET' ? null : BEHOV[metod];
  for (const o of biljett.omfang) {
    if (o.kontext || (o.typ !== '*' && o.typ !== typ)) continue;
    if (behov ? !o.ratt.includes(behov) : !/[rs]/.test(o.ratt)) continue;
    if (o.niva === 'patient') {
      if (!biljett.patientId || malPatient !== biljett.patientId) continue;
    }
    // Runda 10, r1: system/ gäller bara en biljett för ett systemkonto, och user/ bara en person.
    if ((o.niva === 'system') !== Boolean(biljett.system)) continue;
    return null;
  }
  const patientOmfang = biljett.omfang.some(o => o.niva === 'patient' && (o.typ === '*' || o.typ === typ));
  if (patientOmfang && malPatient !== biljett.patientId) return 'Tillämpningen har bara tillgång till den patient som den startades för.';
  return `Tillämpningen har inte fått tillgång till ${typ}${metod === 'GET' ? '' : ' för att skriva'}.`;
}

// Biljetter, koder och starter. Allt ligger i minnet i servern och försvinner vid omstart, så att en biljett aldrig
// överlever servern. Varje post har sandlådan s och personen som den gäller.
export function skapaSmart({ nu = () => Date.now() } = {}) {
  const starter = new Map();
  const koder = new Map();
  const biljetter = new Map();
  // Runda 10, r1: en biljett för ett systemkonto (system: true) gäller kontot och inte en inloggad person.
  const sysLogga = (s, b, resurs, syfte) => {
    try { loggaRad(s.db, { personal_id: b.personalId, enhet_id: b.enhetId, handling: 'tillampning', resurs, grund: 'systemkonto', syfte, resultat: 'tillaten' }); } catch { /* sandlådan är stängd */ }
  };

  // En sandlåda som redan är stängd kan inte loggas i. Då finns inte heller loggen kvar.
  const logga = (s, b, resurs, syfte) => {
    try {
      const pers = s.db.query('SELECT id, enhet_id FROM personal WHERE id = ?').get(b.personalId);
      if (!pers) return;
      loggaRad(s.db, { personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: b.patientId ?? null, handling: 'tillampning', resurs, grund: b.grund ?? 'vardrelation', syfte, resultat: 'tillaten' });
    } catch { /* sandlådan är stängd */ }
  };
  const omfangText = (o) => o.map(x => x.text).join(' ');

  // Ett anrop till start från journalen. Patienten och tillämpningen är prövade av anroparen.
  function nyStart(s, { personalId, patientId, klient, grund }) {
    const id = slump();
    starter.set(id, { s, personalId, patientId, klient, grund, utgar: nu() + START_SEKUNDER * 1000 });
    return id;
  }
  function taStart(id, s, klient) {
    const st = starter.get(id);
    starter.delete(id);
    if (!st || st.s !== s || st.klient !== klient || st.utgar < nu() || st.personalId !== s.personalId) return null;
    return st;
  }
  function nyKod(s, post) {
    const id = slump();
    koder.set(id, { ...post, s, utgar: nu() + KOD_SEKUNDER * 1000 });
    return id;
  }
  // Byter en kod mot en biljett. Koden går att använda en gång.
  function bytKod({ kod, verifierare, omdirigering, klient }) {
    const k = koder.get(kod);
    koder.delete(kod);
    if (!k || k.utgar < nu()) throw new Fel(400, 'Koden är ogiltig eller har gått ut.', 'invalid_grant');
    if (k.klient !== klient || k.omdirigering !== omdirigering) throw new Fel(400, 'Koden hör till en annan tillämpning eller adress.', 'invalid_grant');
    if (typeof verifierare !== 'string' || verifierare.length < 43 || verifierare.length > 128 || s256(verifierare) !== k.utmaning) throw new Fel(400, 'PKCE-kontrollen misslyckades.', 'invalid_grant');
    if (k.s.personalId !== k.personalId) throw new Fel(400, 'Personen är inte längre inloggad.', 'invalid_grant');
    const token = slump();
    const b = { token, s: k.s, personalId: k.personalId, patientId: k.patientId ?? null, klient, omfang: k.omfang, grund: k.grund, skapad: nu(), utgar: nu() + BILJETT_SEKUNDER * 1000, launch: k.launch };
    biljetter.set(token, b);
    const t = tillampning(klient);
    logga(k.s, b, `tillampning:${klient}`, `Åtkomstbiljett till ${t?.namn ?? klient} utfärdad, giltig i ${BILJETT_SEKUNDER / 60} minuter, med omfånget ${omfangText(b.omfang)}.`);
    return b;
  }
  function aterkallaBiljett(b, orsak) {
    if (!biljetter.delete(b.token)) return;
    if (b.system) sysLogga(b.s, b, `systemkonto:${b.klient}:slut`, orsak);
    else logga(b.s, b, `tillampning:${b.klient}:slut`, orsak);
  }
  // Runda 10, r1: en biljett för ett systemkonto efter ett prövat klientintyg (systemkonton.js). Den gäller i fem minuter.
  function nySystemBiljett(s, konto, omfang, { sekunder = 300 } = {}) {
    const token = slump();
    const b = { token, s, system: true, personalId: konto.id, enhetId: konto.vardenheter[0], patientId: null, klient: konto.id, omfang: tolkaOmfang(omfang.join(' ')), skapad: nu(), utgar: nu() + sekunder * 1000 };
    biljetter.set(token, b);
    sysLogga(s, b, `systemkonto:${konto.id}`, `Åtkomstbiljett till systemkontot ${konto.namn} utfärdad efter ett signerat klientintyg, giltig i ${sekunder / 60} minuter, med omfånget ${omfang.join(' ')}.`);
    return b;
  }
  // Biljetten bakom en Bearer-rubrik, eller null. En biljett vars person har loggat ut eller vars tid har gått ut är
  // ogiltig och tas bort, och utgången loggas.
  function hitta(token, finns) {
    const b = biljetter.get(token);
    if (!b) return null;
    if (b.utgar < nu()) { aterkallaBiljett(b, 'Åtkomstbiljetten gick ut.'); return null; }
    if ((!b.system && b.s.personalId !== b.personalId) || !finns(b.s)) { aterkallaBiljett(b, 'Åtkomstbiljetten upphörde eftersom personen inte längre är inloggad.'); return null; }
    return b;
  }
  // Återkallar alla biljetter i en sandlåda, till exempel vid utloggning. filter väljer vilka. Systemkontonas biljetter
  // gäller ingen inloggad person och återkallas bara när filtret säger det (runda 10, r1).
  function aterkalla(s, orsak, filter = (b) => !b.system) {
    let n = 0;
    for (const b of [...biljetter.values()]) if (b.s === s && filter(b)) { aterkallaBiljett(b, orsak); n++; }
    for (const [id, k] of koder) if (k.s === s) koder.delete(id);
    for (const [id, st] of starter) if (st.s === s) starter.delete(id);
    return n;
  }
  function stada(finns) {
    for (const b of [...biljetter.values()]) hitta(b.token, finns);
    for (const [id, k] of koder) if (k.utgar < nu()) koder.delete(id);
    for (const [id, st] of starter) if (st.utgar < nu()) starter.delete(id);
  }
  return { nyStart, taStart, nyKod, bytKod, hitta, aterkalla, aterkallaBiljett, stada, biljetter, koder, nySystemBiljett };
}

// Omfånget som tillämpningen får: det den begär och är registrerad för. En patientkontext kräver launch (från
// journalen) eller launch/patient (standalone).
export function beviljatOmfang(t, begart) {
  return tolkaOmfang(begart).filter(o => t.omfang.includes(o.text));
}

// SMART-konfigurationen på /fhir/.well-known/smart-configuration (SMART App Launch 2.0).
export function konfiguration(base) {
  return {
    issuer: `${base}/fhir`,
    authorization_endpoint: `${base}/oauth/authorize`, token_endpoint: `${base}/oauth/token`, revocation_endpoint: `${base}/oauth/revoke`,
    // Runda 10, r1: client_credentials med private_key_jwt för systemkonton (SMART Backend Services).
    grant_types_supported: ['authorization_code', 'client_credentials'], response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'], token_endpoint_auth_signing_alg_values_supported: ['ES256', 'RS384'],
    scopes_supported: SMART_OMFANG,
    capabilities: ['launch-ehr', 'launch-standalone', 'client-public', 'client-confidential-asymmetric', 'context-ehr-patient', 'context-standalone-patient', 'permission-patient', 'permission-user', 'permission-v1', 'permission-v2'],
  };
}

// En enkel HTML-sida utan skript för valet av patient i en standalone launch och för fel som inte kan skickas tillbaka
// till tillämpningen. Patienterna är de som personen har på sin arbetslista, med skyddad identitet maskerad.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function sida(rubrik, innehall) {
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(rubrik)}</title><link rel="stylesheet" href="/app.css"></head>
<body><main class="smart-sida"><h1>${esc(rubrik)}</h1>${innehall}</main></body></html>`;
}
export function valjPatientSida(t, biljett, patienter) {
  const rader = patienter.map(p => `<li><button class="knapp sekundar" type="submit" name="patient" value="${esc(p.id)}">${esc(visningsnamn(p))}, ${esc(visningsPnr(p))}</button></li>`).join('');
  return sida(`Starta ${t.namn}`, `<p>Välj patienten som tillämpningen ska öppnas för. Den får ${esc(t.far.charAt(0).toLowerCase() + t.far.slice(1))}</p>
<form method="post" action="/oauth/authorize/val"><input type="hidden" name="biljett" value="${esc(biljett)}"><ul class="smart-lista">${rader || '<li>Du har inga patienter på arbetslistan.</li>'}</ul>
<p><button class="knapp sekundar" type="submit" name="avbryt" value="1">Avbryt</button></p></form>`);
}
export const felSida = (text) => sida('Tillämpningen kunde inte startas', `<p>${esc(text)}</p><p><a href="/">Till Vårdkällan</a></p>`);
export const kanStarta = (personal, t) => Boolean(personal && kanRoll(personal, t.kravs));
