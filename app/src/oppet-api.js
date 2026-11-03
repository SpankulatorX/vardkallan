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
import { BEARER_FEL } from './fhir-definitioner.js';

const FHIR_JSON = { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' };
const INGA_VAL = { andra_enheter: false, nodatkomst: false, samtycke_sparr: false, visa_identitet: false };
const fhirSvar = (body, status = 200, extra = {}) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { ...FHIR_JSON, ...extra } });

export function skapaOppetApi({ R, sessioner, valFor, kontrolleraOrigin, avvisaFranAnnanWebbplats, hamtaSession, inloggade, origin, maxKropp,
  skicka = process.env.WEBHOOK_SKICKA === '1' ? prenumeration.skickaPaRiktigt : prenumeration.simulera, godkanda = prenumeration.GODKANDA_MOTTAGARE }) {
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

  // Skrivningen: POST, PUT och DELETE på /fhir/<typ>[/<id>]. c har sandlådan och personen.
  async function skriv(req, url, c, delar, { klient = null, resurs: lastResurs } = {}) {
    const [typ, id] = delar;
    const base = basFor(url);
    if (typ === 'Subscription') return prenumerationSkriv(req, url, c, delar, { klient, resurs: lastResurs });
    const metod = req.method;
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
        const r = prenumeration.skapa(c.db, c.personal, resurs ?? await lasResurs(req), { godkanda, klient });
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
    const personal = s.db.query('SELECT * FROM personal WHERE id = ?').get(b.personalId);
    if (!personal) return ogiltig('Personen finns inte längre.');
    const delar = url.pathname.replace(/\/+$/, '').split('/').slice(2).map(decodeURIComponent);
    const [typ, id] = delar;
    // En skrivning gäller patienten i resursen (subject eller patient), eller patienten för resursen som ändras.
    const resurs = ['POST', 'PUT'].includes(req.method) ? await lasResurs(req) : null;
    const iResursen = (resurs?.subject ?? resurs?.patient)?.reference?.replace(/^.*Patient\//, '') ?? null;
    const krit = typ === 'Subscription' && typeof resurs?.criteria === 'string' ? new URLSearchParams(resurs.criteria.split('?')[1] ?? '').get('patient')?.replace(/^Patient\//, '') : null;
    const mal = req.method === 'POST' ? iResursen ?? krit : malPatient(s.db, typ, id, url);
    const nekad = smart.provaOmfang(b, { metod: req.method, typ, malPatient: mal });
    if (nekad) return fhirSvar(fhir.utfall(403, 'nekad', nekad), 403, { 'WWW-Authenticate': BEARER_FEL.omfang });
    const c = { s: utanVal(s), db: s.db, personal, invanare: null };
    if (req.method !== 'GET') {
      const svar = await skriv(req, url, c, delar, { klient: b.klient, resurs });
      efterAnrop(s, basFor(url));
      return svar;
    }
    if (typ === 'Subscription') return prenumerationLas(url, c, delar);
    // Tillämpningens namn följer med till loggen som en del av resursen.
    const loggUrl = new URL(url);
    loggUrl.searchParams.set('_klient', b.klient);
    const base = basFor(url);
    const r = fhir.hantera({ db: s.db, personal, invanare: null, nekade: null, valFor: () => INGA_VAL, url: loggUrl, base });
    if (r.body?.resourceType === 'Bundle') r.body.link = [{ relation: 'self', url: `${base}${url.pathname}${url.search}` }];
    return fhirSvar(r.body, r.status);
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
      const t = smart.tillampning(q.get('client_id'));
      if (!t) return html(smart.felSida('Tillämpningen är inte registrerad i Vårdkällan.'), 400);
      const redirect = q.get('redirect_uri') ?? '';
      if (!t.omdirigering.some(p => `${base}${p}` === redirect)) return html(smart.felSida('Adressen som tillämpningen vill komma tillbaka till är inte registrerad.'), 400);
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
      const prov = atk.prova(smart.tillampning(k.klient).kravs);
      if (!prov.tillaten) return tillbaka(k.omdirigering, { error: 'access_denied', state: k.state });
      return tillbaka(k.omdirigering, { code: smartLager.nyKod(s, { ...k, vantarPatient: false, patientId: pid, grund: prov.grund, launch: 'standalone' }), state: k.state });
    }

    if (url.pathname === '/oauth/token' && req.method === 'POST') {
      const f = await formular();
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

  // Efter varje anrop: ändringarna i sandlådan ger meddelanden till prenumerationerna, som skickas i bakgrunden.
  function efterAnrop(s, base) {
    let ut;
    try { ut = prenumeration.behandla(s.db, base); } catch (e) { console.error('Prenumerationerna:', e.message); return; }
    for (const n of ut) {
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
        tillampningar: smart.TILLAMPNINGAR.filter(t => smart.kanStarta(c.personal, t)).map(t => ({
          id: t.id, namn: t.namn, beskrivning: t.beskrivning, far: t.far, kanStartas: new Atkomst(c.db, c.personal, atk.patientId, INGA_VAL, t.kravs).prova(t.kravs).tillaten,
        })),
        villkor: 'En tillämpning får bara det du själv får se, utan aktiva val, nödåtkomst eller samtycke. Åtkomsten går ut efter 30 minuter och upphör när du stänger tillämpningen eller loggar ut.',
      }));
    });
    // Starten från journalen (EHR launch): en start som gäller i fem minuter, den här sandlådan, personen och patienten.
    rutt('POST', '/api/patient/:id/tillampningar/:klient/starta', (c, id, klient) => {
      kravInloggad(c);
      const t = smart.tillampning(klient);
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
    rutt('GET', '/api/masterdata', (c) => { kravInloggad(c); return { delar: masterdata.oversikt(c.db) }; });
  }

  return {
    fhir: fhirIngang, oauth, efterAnrop, registreraRutter, smart: smartLager,
    // Vid utloggning, ny inloggning, inloggning i Min journal och ny sandlåda återkallas alla biljetter i sessionen.
    aterkalla: (s, orsak) => smartLager.aterkalla(s, orsak),
    stada: () => smartLager.stada(finns),
  };
}
