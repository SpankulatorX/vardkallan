// Det öppna API:t för skrivning och externa tillämpningar (runda 6, r5): skrivning via FHIR (fhir-skrivning.js),
// prenumerationer (prenumeration.js), SMART on FHIR (smart.js), masterdata (masterdata.js) och täckningen (api-tackning.js).
// Servern lämnar sina hjälpare hit. Skrivningen går genom serverns egen routningstabell, så att samma funktion, samma
// behörighet och samma loggning gäller som när gränssnittet gör samma sak.
import { Fel } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import * as fhir from './fhir.js';
import * as skrivning from './fhir-skrivning.js';
import * as prenumeration from './prenumeration.js';
import * as smart from './smart.js';
import * as masterdata from './masterdata.js';
import { tackning } from './api-tackning.js';
import { andringslogg } from './api-andringar.js';
import * as forvaltning from './api-forvaltning.js';
import { BEARER_FEL } from './fhir-definitioner.js';
// Runda 10, r1: systemkonton utan inloggad person (SMART Backend Services, Sussa 2.5.1.2).
import * as systemkonton from './systemkonton.js';
import { loggaRad } from './logg.js';

const FHIR_JSON = { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' };
const INGA_VAL = { andra_enheter: false, nodatkomst: false, samtycke_sparr: false, visa_identitet: false };
const fhirSvar = (body, status = 200, extra = {}) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { ...FHIR_JSON, ...extra } });

export function skapaOppetApi({ R, sessioner, valFor, kontrolleraOrigin, avvisaFranAnnanWebbplats, hamtaSession, inloggade, origin, maxKropp,
  skicka = process.env.WEBHOOK_SKICKA === '1' ? prenumeration.skickaPaRiktigt : prenumeration.simulera, godkanda = prenumeration.GODKANDA_MOTTAGARE,
  // Runda 9, r6 (säkerhetsgranskningen): domänerna som sandlådans mottagare måste ligga under, och att bara driftens lista
  // gäller när meddelanden skickas på riktigt.
  domaner = prenumeration.KONFIGURERADE_DOMANER, endastKonfiguration = process.env.WEBHOOK_SKICKA === '1' }) {
  const smartLager = smart.skapaSmart();
  const finns = (s) => [...sessioner.values()].includes(s);
  const basFor = (url) => origin || `${url.protocol}//${url.host}`;
  // En session för en tillämpning: samma sandlåda och person, men aldrig de aktiva val som personen har gjort i
  // gränssnittet. Tillämpningen får bara det som personen får se utan val, nödåtkomst eller samtycke.
  const utanVal = (s) => Object.assign(Object.create(s), { val: {} });

  // Kör ett anrop genom serverns routningstabell, med resursen för loggen. Ger { status, data } eller kastar Fel.
  function kor(c, metod, vag, kropp, loggResurs) {
    const [sokvag, q = ''] = vag.split('?');
    for (const [m, re, fn] of R) {
      const x = sokvag.match(re);
      if (!x || m !== metod) continue;
      const sub = Object.assign(Object.create(c), { body: kropp ?? {}, url: { pathname: loggResurs, search: q ? `?${q}` : '', searchParams: new URLSearchParams(q) } });
      const ut = fn(sub, ...x.slice(1).map(decodeURIComponent));
      if (ut instanceof Response) throw new Fel(500, 'Anropet gav en fil.', 'fel');
      return Array.isArray(ut) && typeof ut[0] === 'number' ? { status: ut[0], data: ut[1] } : { status: 200, data: ut };
    }
    throw new Fel(404, 'Okänd adress.', 'saknas');
  }

  async function lasResurs(req) {
    const typ = req.headers.get('content-type') || '';
    if (!/^application\/(fhir\+)?json/.test(typ)) throw new Fel(415, 'Skicka resursen som application/fhir+json.', 'ogiltig');
    const text = await req.text();
    if (text.length > maxKropp) throw new Fel(413, 'För stor förfrågan.', 'ogiltig');
    try { return JSON.parse(text); } catch { throw new Fel(400, 'Ogiltig JSON.', 'ogiltig'); }
  }

  // Patienten som ett anrop gäller, för omfånget patient/. null när anropet inte gäller en patient.
  function malPatient(db, typ, id, url) {
    if (typ === 'Patient') return id ?? url.searchParams.get('_id') ?? url.searchParams.get('patient');
    if (id) {
      const tabell = { ...Object.fromEntries(Object.entries(prenumeration.KALLOR).map(([t, k]) => [t, k.tabell])), Flag: 'uppmarksamhet', MedicationAdministration: 'administreringar', List: 'vidimeringar', EpisodeOfCare: 'halsoarenden', CarePlan: 'vardplaner' }[typ];
      if (!tabell || !/^\d{1,9}$/.test(id)) return null;
      return db.query(`SELECT patient_id FROM ${tabell} WHERE id = ?`).get(Number(id))?.patient_id ?? null;
    }
    return (url.searchParams.get('patient') ?? url.searchParams.get('subject') ?? '').replace(/^Patient\//, '') || null;
  }

  let kanda = null;
  const kandaTyper = () => (kanda ??= new Set(fhir.capability('').rest[0].resource.map(r => r.type)));

  // Skrivningen: POST, PUT och DELETE på /fhir/<typ>[/<id>]. c har sandlådan och personen.
  async function skriv(req, url, c, delar, { klient = null, resurs: lastResurs } = {}) {
    const [typ, id] = delar;
    const base = basFor(url);
    if (typ === 'Subscription') return prenumerationSkriv(req, url, c, delar, { klient, resurs: lastResurs });
    // Runda 9, r6: en resurstyp som CapabilityStatement inte anger finns inte, varken för läsning eller skrivning.
    if (!kandaTyper().has(typ)) return fhirSvar(fhir.utfall(404, 'saknas', 'Okänd FHIR-resurs.'), 404);
    const metod = req.method;
    // Runda 10, r1: makulering med DELETE eller $makulera (fhir-skrivning.js makulera).
    if ((metod === 'DELETE' && delar.length === 2) || (metod === 'POST' && delar.length === 3 && delar[2] === '$makulera')) {
      let orsak = url.searchParams.get('orsak');
      if (metod === 'POST') {
        const p = lastResurs ?? await lasResurs(req);
        orsak = p?.resourceType === 'Parameters' && Array.isArray(p.parameter) ? p.parameter.find(x => x?.name === 'orsak')?.valueString ?? null : null;
      }
      const loggM = `fhir/${typ}/${id}/$makulera${klient ? `?klient=${klient}` : ''}`;
      let ut;
      try {
        ut = skrivning.makulera({ db: c.db, personal: c.personal, typ, id, orsak, kor: (m, v, k) => kor(c, m, v, k, loggM) });
      } catch (e) {
        if (e instanceof Fel) return fhirSvar(skrivning.utfall(typ, e), e.status);
        throw e;
      }
      const prefer = req.headers.get('prefer') ?? '';
      if (/return=minimal/.test(prefer)) return fhirSvar(null, 200);
      if (/return=OperationOutcome/i.test(prefer)) return fhirSvar(skrivning.lyckat(ut.text), 200);
      return fhirSvar(ut.resurs, 200);
    }
    if (metod === 'POST' && delar.length !== 1) throw new Fel(400, 'En ny resurs skapas med POST på resurstypen, till exempel POST /fhir/Observation.', 'ogiltig');
    if ((metod === 'PUT' || metod === 'DELETE') && delar.length !== 2) throw new Fel(400, 'Ange resursens id i adressen.', 'ogiltig');
    const resurs = metod === 'DELETE' ? null : lastResurs ?? await lasResurs(req);
    const logg = `fhir/${typ}${id ? `/${id}` : ''}${klient ? `?klient=${klient}` : ''}`;
    let ut;
    try {
      ut = skrivning.skriv({ db: c.db, metod, typ, id, resurs, rad: skrivning.radFor(c.db, typ, id), kor: (m, v, k) => kor(c, m, v, k, logg) });
    } catch (e) {
      if (e instanceof Fel) return fhirSvar(skrivning.utfall(typ, e), e.status);
      throw e;
    }
    const plats = `${base}/fhir/${ut.typ}/${ut.id}`;
    const prefer = req.headers.get('prefer') ?? '';
    const huvud = { Location: plats, 'Content-Location': plats };
    if (/return=minimal/.test(prefer)) return fhirSvar(null, ut.status, huvud);
    if (/return=OperationOutcome/i.test(prefer)) return fhirSvar(skrivning.lyckat(ut.text, ut.varningar), ut.status, huvud);
    return fhirSvar(ut.resurs, ut.status, huvud);
  }

  // Prenumerationer: skapa, läsa och avsluta de egna.
  async function prenumerationSkriv(req, url, c, delar, { klient, resurs }) {
    const [, id] = delar;
    try {
      if (req.method === 'POST' && delar.length === 1) {
        const r = prenumeration.skapa(c.db, c.personal, resurs ?? await lasResurs(req), { godkanda: forvaltning.godkandaMottagare(c.db, godkanda, { domaner, endastKonfiguration }), klient });
        return fhirSvar(prenumeration.subscription(r), 201, { Location: `${basFor(url)}/fhir/Subscription/${r.id}` });
      }
      if (req.method === 'DELETE' && id) return fhirSvar(prenumeration.subscription(prenumeration.avsluta(c.db, c.personal, id)));
      throw new Fel(405, 'En prenumeration skapas med POST och avslutas med DELETE. Den ändras inte.', 'ogiltig');
    } catch (e) {
      if (e instanceof Fel) return fhirSvar(skrivning.utfall('Subscription', e), e.status);
      throw e;
    }
  }
  function prenumerationLas(url, c, delar) {
    const [, id] = delar;
    if (id) return fhirSvar(prenumeration.subscription(prenumeration.egen(c.db, c.personal, id)));
    const rader = prenumeration.egna(c.db, c.personal).map(prenumeration.subscription);
    const base = basFor(url);
    return fhirSvar({ resourceType: 'Bundle', type: 'searchset', total: rader.length, link: [{ relation: 'self', url: `${base}${url.pathname}${url.search}` }],
      ...(rader.length ? { entry: rader.map(r => ({ fullUrl: `${base}/fhir/Subscription/${r.id}`, resource: r, search: { mode: 'match' } })) } : {}) });
  }

  // Ett FHIR-anrop med en åtkomstbiljett (Authorization: Bearer). Prövas mot omfånget och sedan som vanligt, som
  // personen själv, utan aktiva val.
  async function medBiljett(req, url, token) {
    const b = smartLager.hitta(token, finns);
    const ogiltig = (text) => fhirSvar(fhir.utfall(401, 'ej_inloggad', text), 401, { 'WWW-Authenticate': BEARER_FEL.ogiltig });
    if (!b) return ogiltig('Åtkomstbiljetten är ogiltig, har gått ut eller har återkallats.');
    const s = b.s;
    // Runda 9, r5: personen och medarbetaruppdraget prövas mot masterdata som i sessionen (inloggade i server.js).
    // Runda 10, r1: för ett systemkonto prövas kontot i databasen vid varje anrop, så att en återkallelse gäller direkt.
    const personal = b.system
      ? (systemkonton.kontoFor(s.db, b.personalId) ? s.db.query("SELECT * FROM personal WHERE id = ? AND aktiv = 1 AND yrke = 'systemkonto'").get(b.personalId) : null)
      : inloggade(s).personal;
    if (b.system && !personal) { smartLager.aterkallaBiljett(b, 'Åtkomstbiljetten upphörde eftersom systemkontot är återkallat.'); return ogiltig('Systemkontot är återkallat.'); }
    if (!personal || personal.id !== b.personalId) return ogiltig('Personen är inte längre inloggad med ett gällande medarbetaruppdrag.');
    const delar = url.pathname.replace(/\/+$/, '').split('/').slice(2).map(decodeURIComponent);
    const [typ, id] = delar;
    // Med en biljett godtas bara /fhir/<typ> och /fhir/<typ>/<id>, så att omfånget alltid prövas mot den typ som
    // faktiskt lämnas ut. Operationer och compartment-sökningar (till exempel Patient/<id>/$everything) nekas.
    // Runda 10, r1: $makulera på en resurs är tillåten, med omfånget för att ta bort (d).
    const makul = (req.method === 'DELETE' && delar.length === 2) || (req.method === 'POST' && delar.length === 3 && delar[2] === '$makulera');
    if (!makul && (delar.length < 1 || delar.length > 2 || delar.some(d => d.startsWith('$')))) {
      return fhirSvar(fhir.utfall(403, 'nekad', 'Operationen stöds inte med åtkomstbiljett.'), 403, { 'WWW-Authenticate': BEARER_FEL.omfang });
    }
    // En skrivning gäller patienten i resursen (subject eller patient), eller patienten för resursen som ändras.
    const resurs = ['POST', 'PUT'].includes(req.method) ? await lasResurs(req) : null;
    // Runda 10, r1: en makulering prövas mot omfånget för att ta bort och mot patienten för resursen. Ett systemkonto
    // prövas i makuleringen, som bara tillåter det som kontot självt har skrivit.
    if (makul) {
      const nek = b.system ? null : smart.provaOmfang(b, { metod: 'DELETE', typ, malPatient: malPatient(s.db, typ, id, url) });
      if (nek) return fhirSvar(fhir.utfall(403, 'nekad', nek), 403, { 'WWW-Authenticate': BEARER_FEL.omfang });
      const c = { s: utanVal(s), db: s.db, personal, invanare: null };
      const svar = await skriv(req, url, c, delar, { klient: b.klient, resurs });
      efterAnrop(s, basFor(url));
      return pseudonymer(b, s) ? pseudonymSvar(svar, s, b) : svar;
    }
    const iResursen = (resurs?.subject ?? resurs?.patient)?.reference?.replace(/^.*Patient\//, '') ?? null;
    const krit = typ === 'Subscription' && typeof resurs?.criteria === 'string' ? new URLSearchParams(resurs.criteria.split('?')[1] ?? '').get('patient')?.replace(/^Patient\//, '') : null;
    // Runda 9, r6 (säkerhetsgranskningen): en bokning gäller remissens patient, oavsett vad resursen säger på andra
    // ställen, så att en biljett för en patient aldrig kan boka en remiss för en annan.
    const remissPatient = () => {
      const rid = String(resurs?.basedOn?.[0]?.reference ?? '').match(/(?:^|\/)ServiceRequest\/(\d{1,9})$/)?.[1];
      return rid ? s.db.query('SELECT patient_id FROM remisser WHERE id = ?').get(Number(rid))?.patient_id ?? null : null;
    };
    const mal = req.method === 'POST' ? (typ === 'Appointment' ? remissPatient() : iResursen ?? krit) : malPatient(s.db, typ, id, url);
    const nekad = smart.provaOmfang(b, { metod: req.method, typ, malPatient: mal });
    if (nekad) return fhirSvar(fhir.utfall(403, 'nekad', nekad), 403, { 'WWW-Authenticate': BEARER_FEL.omfang });
    const c = { s: utanVal(s), db: s.db, personal, invanare: null };
    if (req.method !== 'GET') {
      const svar = await skriv(req, url, c, delar, { klient: b.klient, resurs });
      efterAnrop(s, basFor(url));
      // Runda 10, r1: också svaret på en skrivning, till exempel en prenumeration, går genom pseudonymerna.
      return pseudonymer(b, s) ? pseudonymSvar(svar, s, b) : svar;
    }
    if (typ === 'Subscription') return pseudonymer(b, s) ? pseudonymSvar(prenumerationLas(url, c, delar), s, b) : prenumerationLas(url, c, delar);
    // Runda 10, r1: ett systemkonto utan omfånget för identitet ser patienterna med kontots pseudonym. Anropet översätts
    // från pseudonym till id, och svaret görs om innan det lämnar servern.
    const pseudo = pseudonymer(b, s);
    const tr = pseudo ? systemkonton.oversattAnrop(s.db, b.personalId, url) : { url };
    if (tr.fel) return fhirSvar(fhir.utfall(tr.fel.status, tr.fel.kod, tr.fel.message), tr.fel.status);
    // Tillämpningens namn följer med till loggen som en del av resursen.
    const loggUrl = new URL(tr.url);
    loggUrl.searchParams.set('_klient', b.klient);
    const base = basFor(url);
    const r = fhir.hantera({ db: s.db, personal, invanare: null, nekade: null, valFor: () => INGA_VAL, url: loggUrl, base });
    if (r.body?.resourceType === 'Bundle') r.body.link = [{ relation: 'self', url: `${base}${url.pathname}${url.search}` }];
    return fhirSvar(pseudo ? systemkonton.pseudonymisera(s.db, b.personalId, r.body) : r.body, r.status);
  }

  // Runda 10, r1: om svaren till en biljett ska ha pseudonymer: ett systemkonto utan omfånget för identitet, eller ett
  // konto vars val av identitet inte längre gäller.
  const pseudonymer = (b, s) => Boolean(b.system && !(b.identitet && systemkonton.kontoFor(s.db, b.personalId)?.identitet));
  async function pseudonymSvar(svar, s, b) {
    const text = await svar.text();
    if (!text) return new Response(null, { status: svar.status, headers: svar.headers });
    let data;
    try { data = JSON.parse(text); } catch { return new Response(text, { status: svar.status, headers: svar.headers }); }
    return fhirSvar(systemkonton.pseudonymisera(s.db, b.personalId, data), svar.status);
  }

  // Ingången från servern för /fhir. Ger ett svar, eller null när den vanliga läsningen med sessionen ska göras.
  async function fhirIngang(req, url, c) {
    const sokvag = url.pathname.replace(/\/+$/, '');
    if (sokvag === '/fhir/.well-known/smart-configuration') return new Response(JSON.stringify(smart.konfiguration(basFor(url))), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    // Konformitetsresurserna läses utan inloggning och utan biljett.
    if (fhir.oppenSokvag(sokvag) && req.method === 'GET') return null;
    const auth = req.headers.get('authorization') ?? '';
    if (/^Bearer\s+/i.test(auth)) return medBiljett(req, url, auth.replace(/^Bearer\s+/i, '').trim());
    const delar = sokvag.split('/').slice(2).map(decodeURIComponent);
    const lasning = req.method === 'GET' || req.method === 'HEAD';
    if (lasning && delar[0] !== 'Subscription') return null;
    const sess = hamtaSession(req);
    if (sess) Object.assign(c, { s: sess.s, db: sess.s.db, ...inloggade(sess.s) });
    if (c.invanare) {
      avvisaFranAnnanWebbplats(req);
      throw new Fel(403, 'Min journal kan bara läsa. Skrivning och prenumerationer görs av vårdens personal.', 'nekad');
    }
    if (!c.personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
    if (lasning) return prenumerationLas(url, c, delar);
    // Skrivning med sessionskakan kontrolleras som andra skrivande anrop, så att en annan webbplats inte kan skriva.
    kontrolleraOrigin(req);
    return skriv(req, url, c, delar);
  }

  // OAuth 2.0 för SMART on FHIR: /oauth/authorize, /oauth/authorize/val, /oauth/token och /oauth/revoke.
  async function oauth(req, url, c, { arbetslista }) {
    const base = basFor(url);
    const html = (text, status = 200) => new Response(text, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' } });
    const omdirigera = (adress) => new Response(null, { status: 302, headers: { Location: adress, 'Cache-Control': 'no-store' } });
    const tillbaka = (redirect, parametrar) => { const u = new URL(redirect); for (const [k, v] of Object.entries(parametrar)) if (v != null) u.searchParams.set(k, v); return omdirigera(u.toString()); };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
    const formular = async () => new URLSearchParams(await req.text());

    if (url.pathname === '/oauth/authorize' && req.method === 'GET') {
      const q = url.searchParams;
      // Runda 9, r6: tillämpningarna som systemförvaltaren har registrerat i sandlådan kommer med (api-forvaltning.js).
      const sess0 = hamtaSession(req);
      const t = forvaltning.tillampning(sess0?.s.db ?? null, q.get('client_id'));
      if (!t) return html(smart.felSida('Tillämpningen är inte registrerad i Vårdkällan.'), 400);
      const redirect = q.get('redirect_uri') ?? '';
      if (!t.omdirigering.some(p => (p.startsWith('https://') ? p : `${base}${p}`) === redirect)) return html(smart.felSida('Adressen som tillämpningen vill komma tillbaka till är inte registrerad.'), 400);
      const state = q.get('state');
      if (q.get('response_type') !== 'code') return tillbaka(redirect, { error: 'unsupported_response_type', state });
      if (q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge') ?? '')) return tillbaka(redirect, { error: 'invalid_request', error_description: 'PKCE med S256 krävs.', state });
      if (q.get('aud') !== `${base}/fhir`) return tillbaka(redirect, { error: 'invalid_request', error_description: 'aud ska vara Vårdkällans FHIR-adress.', state });
      const omfang = smart.beviljatOmfang(t, q.get('scope'));
      if (!omfang.some(o => !o.kontext)) return tillbaka(redirect, { error: 'invalid_scope', state });
      const sess = hamtaSession(req);
      const s = sess?.s;
      const personal = s ? inloggade(s).personal : null;
      if (!personal) return html(smart.felSida('Logga in i Vårdkällan med SITHS-kort först, och starta sedan tillämpningen igen.'), 401);
      if (!smart.kanStarta(personal, t)) return tillbaka(redirect, { error: 'access_denied', error_description: 'Din yrkesroll har inte tillgång till tillämpningen.', state });
      const post = { personalId: personal.id, klient: t.id, omfang, omdirigering: redirect, utmaning: q.get('code_challenge'), state };
      if (q.get('launch')) {
        // Start från journalen: patienten kommer från starten, som bara gäller den här sandlådan, personen och tillämpningen.
        const st = smartLager.taStart(q.get('launch'), s, t.id);
        if (!st) return tillbaka(redirect, { error: 'invalid_request', error_description: 'Starten är ogiltig eller har gått ut. Starta tillämpningen igen från journalen.', state });
        return tillbaka(redirect, { code: smartLager.nyKod(s, { ...post, patientId: st.patientId, grund: st.grund, launch: 'ehr' }), state });
      }
      if (omfang.some(o => o.text === 'launch/patient')) {
        // Standalone: personen väljer patienten bland sina patienter på arbetslistan.
        const val = smartLager.nyKod(s, { ...post, vantarPatient: true });
        const patienter = arbetslista({ s, db: s.db, personal }).map(p => s.db.query('SELECT * FROM patienter WHERE id = ?').get(p.id));
        return html(smart.valjPatientSida(t, val, patienter));
      }
      return tillbaka(redirect, { code: smartLager.nyKod(s, { ...post, patientId: null, launch: 'standalone' }), state });
    }

    if (url.pathname === '/oauth/authorize/val' && req.method === 'POST') {
      kontrolleraOrigin(req);
      const f = await formular();
      const k = smartLager.koder.get(f.get('biljett') ?? '');
      smartLager.koder.delete(f.get('biljett') ?? '');
      const sess = hamtaSession(req);
      if (!k || !k.vantarPatient || k.s !== sess?.s || k.utgar < Date.now() || k.s.personalId !== k.personalId) return html(smart.felSida('Valet har gått ut. Starta tillämpningen igen.'), 400);
      if (f.get('avbryt')) return tillbaka(k.omdirigering, { error: 'access_denied', state: k.state });
      const s = k.s;
      const personal = inloggade(s).personal;
      const pid = f.get('patient') ?? '';
      if (!arbetslista({ s, db: s.db, personal }).some(p => p.id === pid)) return html(smart.felSida('Patienten finns inte på din arbetslista.'), 400);
      const atk = new Atkomst(s.db, personal, pid, INGA_VAL, 'las_oversikt');
      const kt = forvaltning.tillampning(s.db, k.klient);
      if (!kt) return html(smart.felSida('Tillämpningen har återkallats.'), 400);
      const prov = atk.prova(kt.kravs);
      if (!prov.tillaten) return tillbaka(k.omdirigering, { error: 'access_denied', state: k.state });
      return tillbaka(k.omdirigering, { code: smartLager.nyKod(s, { ...k, vantarPatient: false, patientId: pid, grund: prov.grund, launch: 'standalone' }), state: k.state });
    }

    if (url.pathname === '/oauth/token' && req.method === 'POST') {
      const f = await formular();
      // Runda 10, r1: ett systemkonto byter ett signerat klientintyg mot en biljett (SMART Backend Services).
      if (f.get('grant_type') === 'client_credentials') return systemBiljett(f, base, json);
      if (f.get('grant_type') !== 'authorization_code') return json({ error: 'unsupported_grant_type' }, 400);
      try {
        const b = smartLager.bytKod({ kod: f.get('code'), verifierare: f.get('code_verifier'), omdirigering: f.get('redirect_uri'), klient: f.get('client_id') });
        return json({
          access_token: b.token, token_type: 'Bearer', expires_in: Math.round((b.utgar - Date.now()) / 1000), scope: b.omfang.map(o => o.text).join(' '),
          ...(b.patientId ? { patient: b.patientId, need_patient_banner: b.launch !== 'ehr' } : {}),
        });
      } catch (e) {
        if (e instanceof Fel) return json({ error: 'invalid_grant', error_description: e.message }, 400);
        throw e;
      }
    }

    if (url.pathname === '/oauth/revoke' && req.method === 'POST') {
      const f = await formular();
      const b = smartLager.biljetter.get(f.get('token') ?? '');
      if (b && b.klient === f.get('client_id')) smartLager.aterkallaBiljett(b, 'Tillämpningen återkallade åtkomstbiljetten.');
      return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response('Okänd adress.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Runda 10, r1: biljetten för ett systemkonto. Kontot finns i en sandlåda, och id:t är slumpat och unikt, så sandlådan
  // hittas på id:t i intyget. Intyget prövas sedan mot kontots offentliga nyckel i den sandlådan. Ett nekat intyg loggas
  // på kontot när kontot finns.
  function hittaKonto(id) {
    for (const s of sessioner.values()) {
      try { if (s.db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_systemkonton'").get() && s.db.query('SELECT 1 FROM api_systemkonton WHERE id = ?').get(id)) return s; } catch { /* stängd */ }
    }
    return null;
  }
  function systemBiljett(f, base, json) {
    const nej = (text) => json({ error: 'invalid_client', error_description: text }, 401);
    if (f.get('client_assertion_type') !== systemkonton.INTYG_TYP) return json({ error: 'invalid_request', error_description: `client_assertion_type ska vara ${systemkonton.INTYG_TYP}.` }, 400);
    const intyg = f.get('client_assertion') ?? '';
    const id = systemkonton.kontoIdI(intyg);
    const s = id ? hittaKonto(id) : null;
    if (!s) return nej('Systemkontot finns inte.');
    let konto;
    try { konto = systemkonton.provaIntyg(s.db, intyg, { aud: `${base}/oauth/token` }); } catch (e) {
      if (!(e instanceof Fel)) throw e;
      const rad = s.db.query('SELECT enhet_id FROM personal WHERE id = ?').get(id);
      if (rad) loggaRad(s.db, { personal_id: id, enhet_id: rad.enhet_id, handling: 'tillampning', resurs: `systemkonto:${id}`, grund: 'nekad', resultat: 'nekad', syfte: `Ingen åtkomstbiljett: ${e.message}` });
      return nej(e.message);
    }
    const omfang = systemkonton.beviljat(konto, f.get('scope'));
    if (!omfang.length) return json({ error: 'invalid_scope', error_description: 'Systemkontot har inte fått något av det som begärdes.' }, 400);
    const b = smartLager.nySystemBiljett(s, konto, omfang, { sekunder: systemkonton.BILJETT_SEKUNDER });
    return json({ access_token: b.token, token_type: 'Bearer', expires_in: systemkonton.BILJETT_SEKUNDER, scope: omfang.join(' ') });
  }

  // Efter varje anrop: ändringarna i sandlådan ger meddelanden till prenumerationerna, som skickas i bakgrunden.
  function efterAnrop(s, base) {
    let ut;
    try { ut = prenumeration.behandla(s.db, base); } catch (e) { console.error('Prenumerationerna:', e.message); return; }
    // Varje meddelande prövas mot mottagarna igen när det skickas, med driftens konfiguration som tak.
    const tillatna = forvaltning.godkandaMottagare(s.db, godkanda, { domaner, endastKonfiguration });
    for (const n of ut) {
      if (!tillatna.includes(n.mottagare)) {
        try { prenumeration.sparaUtfall(s.db, n.notisId, { status: 'misslyckad', svar: 'Mottagaren står inte i driftens konfiguration. Meddelandet skickades inte.' }); } catch { /* sandlådan är stängd */ }
        continue;
      }
      Promise.resolve(skicka(n.mottagare, n.kropp)).then((r) => { try { prenumeration.sparaUtfall(s.db, n.notisId, r); } catch { /* sandlådan är stängd */ } })
        .catch(() => { try { prenumeration.sparaUtfall(s.db, n.notisId, { status: 'misslyckad', svar: 'Meddelandet kunde inte skickas.' }); } catch { /* sandlådan är stängd */ } });
    }
  }

  // Rutterna i /api för tillämpningarna i journalen och för masterdata och täckningen.
  function registreraRutter({ rutt, kravInloggad, medPatient }) {
    // De tillämpningar som personen kan starta för patienten, med vad de får göra.
    rutt('GET', '/api/patient/:id/tillampningar', (c, id) => {
      kravInloggad(c);
      const handling = kanRoll(c.personal, 'las_oversikt') ? 'las_oversikt' : 'las_admin';
      return medPatient(c, id, handling, (atk) => (atk.krav(handling), {
        tillampningar: forvaltning.aktivaTillampningar(c.db).filter(t => smart.kanStarta(c.personal, t)).map(t => ({
          id: t.id, namn: t.namn, beskrivning: t.beskrivning, far: t.far, kanStartas: new Atkomst(c.db, c.personal, atk.patientId, INGA_VAL, t.kravs).prova(t.kravs).tillaten,
        })),
        villkor: 'En tillämpning får bara det du själv får se, utan aktiva val, nödåtkomst eller samtycke. Åtkomsten går ut efter 30 minuter och upphör när du stänger tillämpningen eller loggar ut.',
      }));
    });
    // Starten från journalen (EHR launch): en start som gäller i fem minuter, den här sandlådan, personen och patienten.
    rutt('POST', '/api/patient/:id/tillampningar/:klient/starta', (c, id, klient) => {
      kravInloggad(c);
      const t = forvaltning.tillampning(c.db, klient);
      if (!t || !smart.kanStarta(c.personal, t)) throw new Fel(403, 'Din yrkesroll har inte tillgång till tillämpningen.', 'nekad');
      return medPatient(c, id, t.kravs, (atk, p) => {
        const utan = new Atkomst(c.db, c.personal, p.id, INGA_VAL, t.kravs);
        utan.krav(t.kravs, { beskrivning: `tillampning:${t.id}` });
        const launch = smartLager.nyStart(c.s, { personalId: c.personal.id, patientId: p.id, klient: t.id, grund: utan.grund() });
        atk.grunder.add(utan.grund());
        return { adress: `${t.adress}?iss=${encodeURIComponent(`${basFor(c.url)}/fhir`)}&launch=${encodeURIComponent(launch)}` };
      });
    });
    // Stänger tillämpningen: biljetterna för den och patienten återkallas.
    rutt('POST', '/api/patient/:id/tillampningar/:klient/stang', (c, id, klient) => {
      kravInloggad(c);
      const n = smartLager.aterkalla(c.s, 'Åtkomstbiljetten återkallades när tillämpningen stängdes.', b => b.klient === klient && b.patientId === id && b.personalId === c.personal.id);
      return { aterkallade: n };
    });
    rutt('GET', '/api/oppet-api/tackning', () => ({ floden: tackning() }));
    // Runda 9, r6: ändringsloggen för API:t, som går att läsa utan inloggning (Sussa 2.5.1.1).
    rutt('GET', '/api/oppet-api/andringar', () => andringslogg());
    // Runda 9, r6: tillämpningar, mottagare och ärenden mellan kund och utvecklare (api-forvaltning.js).
    rutt('GET', '/api/oppet-api/forvaltning', (c) => forvaltning.oversikt(c.db, kravInloggad(c)));
    rutt('POST', '/api/oppet-api/tillampningar/forslag', (c) => { kravInloggad(c); return forvaltning.forslag(c.body.omfang); });
    rutt('POST', '/api/oppet-api/tillampningar', (c) => [201, forvaltning.registreraTillampning(c.db, kravInloggad(c), c.body)]);
    rutt('POST', '/api/oppet-api/tillampningar/:id/aterkalla', (c, id) => forvaltning.aterkallaTillampning(c.db, kravInloggad(c), id, c.body, {
      aterkallaBiljetter: (klient) => smartLager.aterkalla(c.s, 'Åtkomstbiljetten återkallades när systemförvaltaren återkallade tillämpningen.', b => b.klient === klient),
    }));
    rutt('POST', '/api/oppet-api/mottagare', (c) => [201, forvaltning.godkannMottagare(c.db, kravInloggad(c), c.body, godkanda, { domaner, endastKonfiguration })]);
    rutt('POST', '/api/oppet-api/mottagare/:id/aterkalla', (c, id) => forvaltning.aterkallaMottagare(c.db, kravInloggad(c), id, c.body));
    rutt('GET', '/api/oppet-api/arenden', (c) => ({ arenden: forvaltning.arenden(c.db, kravInloggad(c)) }));
    rutt('POST', '/api/oppet-api/arenden', (c) => [201, forvaltning.nyttArende(c.db, kravInloggad(c), c.body, { kapabilitet: fhir.capability('') })]);
    rutt('POST', '/api/oppet-api/arenden/:id/svar', (c, id) => [201, forvaltning.svara(c.db, kravInloggad(c), id, c.body)]);
    rutt('POST', '/api/oppet-api/arenden/:id/status', (c, id) => forvaltning.andraStatus(c.db, kravInloggad(c), id, c.body));
    rutt('GET', '/api/masterdata', (c) => { kravInloggad(c); return { delar: masterdata.oversikt(c.db) }; });
    // Runda 10, r1: systemkonton för tillämpningar utan inloggad person (systemkonton.js).
    rutt('GET', '/api/oppet-api/systemkonton', (c) => {
      const p = kravInloggad(c);
      if (!kanRoll(p, systemkonton.HANDLING)) throw new Fel(403, 'Bara systemförvaltaren ser systemkontona.', 'nekad');
      return { konton: systemkonton.konton(c.db), mangder: Object.entries(systemkonton.MANGDER).map(([id, m]) => ({ id, namn: m.namn, typer: m.typer })),
        vardenheter: c.db.query("SELECT id, namn FROM enheter WHERE typ = 'vardenhet' ORDER BY namn").all() };
    });
    rutt('POST', '/api/oppet-api/systemkonton/forslag', (c) => {
      const p = kravInloggad(c);
      if (!kanRoll(p, systemkonton.HANDLING)) throw new Fel(403, 'Bara systemförvaltaren registrerar systemkonton.', 'nekad');
      return systemkonton.forslag(c.db, c.body);
    });
    rutt('POST', '/api/oppet-api/systemkonton', (c) => [201, systemkonton.registrera(c.db, kravInloggad(c), c.body)]);
    rutt('POST', '/api/oppet-api/systemkonton/:id/aterkalla', (c, id) => systemkonton.aterkalla(c.db, kravInloggad(c), id, c.body, {
      aterkallaBiljetter: (kid) => smartLager.aterkalla(c.s, 'Åtkomstbiljetten återkallades när systemförvaltaren återkallade systemkontot.', b => b.system && b.klient === kid),
    }));
  }

  return {
    fhir: fhirIngang, oauth, efterAnrop, registreraRutter, smart: smartLager,
    // Vid utloggning, ny inloggning, inloggning i Min journal och ny sandlåda återkallas alla biljetter i sessionen.
    aterkalla: (s, orsak) => smartLager.aterkalla(s, orsak),
    stada: () => smartLager.stada(finns),
  };
}
