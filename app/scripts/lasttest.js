// Lasttest (runda 12, r2, Sussa KD1.1.1.5): spelar realistiska flöden för 100 och 500 samtidiga användare mot en lokal
// server och sparar svarstiderna per åtgärd mot svarstidsmålet i D5 (p95 under 200 ms per adress i API:t) i
// lasttest.json, med en hash av src/ och public/ så att kravregistret vet om resultatet gäller den kod som byggs.
//
// Varje användare loggar in och arbetar sedan i en slinga: öppnar arbetslistan, söker en patient, läser översikten,
// journalen, läkemedlen och mätvärdena, registrerar ibland ett mätvärde och tittar i inkorgen, med betänketid mellan
// åtgärderna som när en person läser. I demon motsvarar en sandlåda en vårdgivares databas, så användarna delar
// sandlådor (ANVANDARE_PER_SANDLADA), på samma sätt som många användare delar en databas i driften.
//
// Runda 13, r2: vågen. VAG nya besökare (300) kommer utspritt under VAG_SEKUNDER (300) och får var sin sandlåda, som
// när en länk delas på Reddit. Varje besökare loggar in, registrerar ett mätvärde som markering och arbetar i
// VAG_ARBETE_MIN till VAG_ARBETE_MAX sekunder. Får besökaren sidan om att demon är full väntar den den tid som svaret
// anger och försöker igen, som sidan gör. Till sist kontrolleras att varje besökares markering finns kvar (ingen
// sandlåda har tappats), att serverns minne har hållit sig under gränsen och att svarstiderna håller målet.
//
// Körs så här, mot en container som är startad med NYA_PER_TIMME tillräckligt högt (och för vågen med --memory satt
// till gränsen i driften):
//   bun scripts/lasttest.js http://127.0.0.1:18222
// Miljö: NIVAER (100,500, tomt för att hoppa över), SEKUNDER (mätningens längd per nivå), BETANK_MIN och BETANK_MAX
// (sekunder), VAG (0 för att hoppa över), VAG_SEKUNDER, VAG_ARBETE_MIN och VAG_ARBETE_MAX (sekunder).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { kodHash } from '../src/klientresultat.js';
// Runda 13, r2: namnet på vågens test delas med kravregistret.
import { TEST_VAG } from '../src/sussa/runda13-r2.js';

const BAS = (process.argv[2] || 'http://127.0.0.1:18222').replace(/\/$/, '');
const NIVAER = (process.env.NIVAER ?? '100,500').split(',').filter(Boolean).map(Number);
// Runda 13, r2: vågen.
const VAG = Number(process.env.VAG ?? 300);
const VAG_SEKUNDER = Number(process.env.VAG_SEKUNDER || 300);
const VAG_ARBETE_MIN = Number(process.env.VAG_ARBETE_MIN || 120);
const VAG_ARBETE_MAX = Number(process.env.VAG_ARBETE_MAX || 360);
const MARKERING = '187';
const SEKUNDER = Number(process.env.SEKUNDER || 120);
const UPPVARMNING = Number(process.env.UPPVARMNING || 20);
const BETANK_MIN = Number(process.env.BETANK_MIN || 5);
const BETANK_MAX = Number(process.env.BETANK_MAX || 15);
const PER_SANDLADA = Number(process.env.ANVANDARE_PER_SANDLADA || 10);
const MAL_MS = 200;
// Patienterna på Kardiologiska kliniken, som användarna öppnar från arbetslistan.
const PATIENTER = ['p01', 'p03', 'p04', 'p05', 'p08', 'p09', 'p10', 'p11'];
// Rollerna som arbetar i flödena, växelvis per sandlåda.
const ROLLER = ['lak-kard', 'ssk-kard'];

const vanta = (ms) => new Promise(r => setTimeout(r, ms));
const slump = (a, b) => a + Math.random() * (b - a);
const valj = (xs) => xs[Math.floor(Math.random() * xs.length)];

// En sandlåda: en sessionskaka och en inloggad person.
async function nySandlada(roll) {
  const r = await fetch(`${BAS}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BAS }, body: JSON.stringify({ personalId: roll }) });
  const kaka = (r.headers.get('set-cookie') || '').split(';')[0];
  if (r.status !== 200 || !kaka) throw new Error(`Inloggningen som ${roll} gav ${r.status}`);
  await r.arrayBuffer();
  return { kaka, roll };
}

// Åtgärderna i ett arbetsflöde, med vikten (hur ofta åtgärden görs).
const ATGARDER = [
  { id: 'arbetslista', namn: 'Öppna arbetslistan', vikt: 3, gor: () => ['GET', '/api/arbetslista'] },
  { id: 'sok', namn: 'Söka en patient', vikt: 2, gor: () => ['GET', `/api/sok?q=${encodeURIComponent(valj(['Åkesson', 'Berg', 'Gunnar', 'Lind']))}`] },
  { id: 'oversikt', namn: 'Öppna patientens översikt', vikt: 4, gor: (p) => ['GET', `/api/patient/${p}/oversikt`] },
  { id: 'journal', namn: 'Läsa journalen', vikt: 3, gor: (p) => ['GET', `/api/patient/${p}/anteckningar`] },
  { id: 'lakemedel', namn: 'Läsa läkemedelslistan', vikt: 3, gor: (p) => ['GET', `/api/patient/${p}/lakemedel`] },
  { id: 'matvarden', namn: 'Läsa mätvärden', vikt: 2, gor: (p) => ['GET', `/api/patient/${p}/matvarden`] },
  { id: 'registrera', namn: 'Registrera ett mätvärde', vikt: 1, gor: (p) => ['POST', `/api/patient/${p}/matvarden`, { typ: 'puls', varde: String(Math.round(slump(55, 95))) }] },
  { id: 'inkorg', namn: 'Titta i inkorgen', vikt: 2, gor: () => ['GET', '/api/inkorg'] },
];
const PULJE = ATGARDER.flatMap(a => Array(a.vikt).fill(a));

async function anrop(sandlada, metod, vag, kropp) {
  const t0 = performance.now();
  const r = await fetch(BAS + vag, {
    method: metod,
    headers: { Cookie: sandlada.kaka, ...(kropp ? { 'Content-Type': 'application/json', Origin: BAS } : {}) },
    body: kropp ? JSON.stringify(kropp) : undefined,
  });
  await r.arrayBuffer();
  return { ms: performance.now() - t0, status: r.status, server: Number((r.headers.get('server-timing') || '').match(/dur=([\d.]+)/)?.[1] ?? NaN) };
}

const percentil = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const avrunda = (x) => (x == null ? null : Math.round(x * 10) / 10);

async function niva(antal) {
  const sandlador = [];
  for (let i = 0; i < Math.ceil(antal / PER_SANDLADA); i++) sandlador.push(await nySandlada(ROLLER[i % ROLLER.length]));
  const matt = new Map(ATGARDER.map(a => [a.id, { ms: [], server: [], fel: 0 }]));
  let mats = false;
  let slut = false;
  const anvandare = Array.from({ length: antal }, (_, i) => (async () => {
    const s = sandlador[Math.floor(i / PER_SANDLADA)];
    // Användarna börjar utspritt under uppvärmningen.
    await vanta(slump(0, UPPVARMNING * 1000));
    while (!slut) {
      const a = valj(PULJE);
      const [metod, vag, kropp] = a.gor(valj(PATIENTER));
      try {
        const r = await anrop(s, metod, vag, kropp);
        if (mats) {
          const m = matt.get(a.id);
          m.ms.push(r.ms);
          if (Number.isFinite(r.server)) m.server.push(r.server);
          if (r.status >= 400) m.fel++;
        }
      } catch { if (mats) matt.get(a.id).fel++; }
      await vanta(slump(BETANK_MIN, BETANK_MAX) * 1000);
    }
  })());
  await vanta(UPPVARMNING * 1000);
  mats = true;
  const start = Date.now();
  await vanta(SEKUNDER * 1000);
  mats = false;
  slut = true;
  const sekunder = (Date.now() - start) / 1000;
  await Promise.all(anvandare);
  const per = ATGARDER.map(a => {
    const m = matt.get(a.id);
    const p95 = percentil(m.ms, 95);
    return { id: a.id, atgard: a.namn, antal: m.ms.length, fel: m.fel, p50: avrunda(percentil(m.ms, 50)), p95: avrunda(p95), max: avrunda(m.ms.length ? Math.max(...m.ms) : null), serverP95: avrunda(percentil(m.server, 95)), ok: m.ms.length > 0 && p95 < MAL_MS && m.fel === 0 };
  });
  const anropTotalt = per.reduce((s, x) => s + x.antal, 0);
  return { anvandare: antal, sandlador: sandlador.length, sekunder: Math.round(sekunder), anrop: anropTotalt, perSekund: avrunda(anropTotalt / sekunder), fel: per.reduce((s, x) => s + x.fel, 0), per, ok: per.every(x => x.ok) };
}

// Runda 13, r2: vågen av nya besökare med var sin sandlåda.
async function vag(antal) {
  const matt = new Map(ATGARDER.map(a => [a.id, { ms: [], server: [], fel: 0 }]));
  const resultat = { fulla: 0, vantatSekunder: [], tappade: 0, felLista: [], vantande: 0 };
  const prov = { maxRss: 0, maxAnvant: 0, maxIMinnet: 0, maxVilar: 0, gransMb: null, overskridna: 0 };
  let klar = false;
  // Serverns minne och sandlådor, varannan sekund.
  const provtagning = (async () => {
    while (!klar) {
      try {
        const d = await fetch(`${BAS}/api/drift`).then(r => r.json());
        const k = d.kapacitet;
        prov.maxRss = Math.max(prov.maxRss, k.minne.rssMb ?? 0);
        prov.maxAnvant = Math.max(prov.maxAnvant, k.minne.anvantMb ?? 0);
        prov.maxIMinnet = Math.max(prov.maxIMinnet, k.iMinnet);
        prov.maxVilar = Math.max(prov.maxVilar, k.vilar);
        prov.gransMb = k.minne.gransMb;
        prov.maxIMinnetTak = k.maxIMinnet;
        prov.overskridna = k.overskridna;
      } catch { /* nästa prov */ }
      await vanta(2000);
    }
  })();
  const fel = (text) => { if (resultat.felLista.length < 20) resultat.felLista.push(text); };
  const besokare = Array.from({ length: antal }, (_, i) => (async () => {
    await vanta(slump(0, VAG_SEKUNDER * 1000));
    const roll = ROLLER[i % ROLLER.length];
    // En ny sandlåda, eller sidan om att demon är full.
    let kaka = null;
    const borjan = Date.now();
    for (;;) {
      const r = await fetch(`${BAS}/api/session`);
      if (r.status === 503 && r.headers.get('x-vk-full') === '1') {
        resultat.fulla++;
        const j = await r.json();
        await vanta(j.forsokIgenSekunder * 1000);
        continue;
      }
      kaka = (r.headers.get('set-cookie') || '').split(';')[0];
      await r.arrayBuffer();
      if (r.status !== 200 || !kaka) { fel(`Ny sandlåda gav ${r.status}`); return; }
      break;
    }
    if (Date.now() - borjan > 1000) resultat.vantatSekunder.push(Math.round((Date.now() - borjan) / 1000));
    const s = { kaka, roll };
    const login = await anrop(s, 'POST', '/api/login', { personalId: roll });
    if (login.status !== 200) { fel(`Inloggningen gav ${login.status}`); resultat.tappade++; return; }
    const m = await anrop(s, 'POST', '/api/patient/p01/matvarden', { typ: 'puls', varde: MARKERING });
    if (m.status !== 201) { fel(`Markeringen gav ${m.status}`); return; }
    const slut = Date.now() + slump(VAG_ARBETE_MIN, VAG_ARBETE_MAX) * 1000;
    while (Date.now() < slut) {
      await vanta(slump(BETANK_MIN, BETANK_MAX) * 1000);
      const a = valj(PULJE);
      const [metod, vag, kropp] = a.gor(valj(PATIENTER));
      try {
        const r = await anrop(s, metod, vag, kropp);
        const x = matt.get(a.id);
        x.ms.push(r.ms);
        if (Number.isFinite(r.server)) x.server.push(r.server);
        // 401 betyder att sandlådan eller inloggningen har tappats.
        if (r.status === 401) { resultat.tappade++; fel(`${a.id} gav 401`); return; }
        if (r.status >= 400) { x.fel++; fel(`${a.id} gav ${r.status}`); }
      } catch (e) { matt.get(a.id).fel++; fel(`${a.id}: ${e.message}`); }
    }
    // Markeringen ska finnas kvar i besökarens egen sandlåda.
    const kvar = await fetch(`${BAS}/api/patient/p01/matvarden`, { headers: { Cookie: kaka } });
    const text = await kvar.text();
    if (kvar.status !== 200 || !new RegExp(`"varde":"?${MARKERING}"?[,}]`).test(text)) { resultat.tappade++; fel(`Markeringen saknades (${kvar.status})`); }
  })());
  const start = Date.now();
  await Promise.all(besokare);
  klar = true;
  await provtagning;
  const per = ATGARDER.map(a => {
    const x = matt.get(a.id);
    const p95 = percentil(x.ms, 95);
    return { id: a.id, atgard: a.namn, antal: x.ms.length, fel: x.fel, p50: avrunda(percentil(x.ms, 50)), p95: avrunda(p95), max: avrunda(x.ms.length ? Math.max(...x.ms) : null), serverP95: avrunda(percentil(x.server, 95)), ok: x.ms.length > 0 && p95 < MAL_MS && x.fel === 0 };
  });
  const minneOk = prov.gransMb ? prov.maxRss < prov.gransMb : true;
  return {
    besokare: antal, ankomstSekunder: VAG_SEKUNDER, arbeteSekunder: [VAG_ARBETE_MIN, VAG_ARBETE_MAX], sekunder: Math.round((Date.now() - start) / 1000),
    anrop: per.reduce((s, x) => s + x.antal, 0), fel: per.reduce((s, x) => s + x.fel, 0), tappade: resultat.tappade,
    fullSvar: resultat.fulla, vantade: resultat.vantatSekunder.length, maxVantanSekunder: resultat.vantatSekunder.length ? Math.max(...resultat.vantatSekunder) : 0,
    minne: { gransMb: prov.gransMb, maxRssMb: prov.maxRss, maxCgroupMb: prov.maxAnvant, ok: minneOk },
    sandlador: { maxIMinnet: prov.maxIMinnet, takIMinnet: prov.maxIMinnetTak ?? null, maxVilar: prov.maxVilar, overskridna: prov.overskridna },
    felExempel: resultat.felLista,
    per, ok: per.every(x => x.ok) && resultat.tappade === 0 && minneOk,
  };
}

const halsa = await fetch(`${BAS}/api/health`).then(r => r.json());
const nivaer = [];
for (const n of NIVAER) {
  console.log(`Lasttest med ${n} samtidiga användare i ${SEKUNDER} sekunder`);
  const r = await niva(n);
  for (const x of r.per) console.log(`  ${x.atgard.padEnd(28)} ${String(x.antal).padStart(6)} anrop  p50 ${String(x.p50).padStart(6)} ms  p95 ${String(x.p95).padStart(6)} ms  fel ${x.fel}  ${x.ok ? 'ok' : 'över målet'}`);
  nivaer.push(r);
}
const tester = nivaer.map(r => ({ namn: `Lasttest > ${r.anvandare} samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel`, status: r.ok ? 'grön' : 'röd' }));
// Runda 13, r2.
let vagen = null;
if (VAG > 0) {
  console.log(`Våg: ${VAG} nya besökare under ${VAG_SEKUNDER} sekunder, med var sin sandlåda`);
  vagen = await vag(VAG);
  for (const x of vagen.per) console.log(`  ${x.atgard.padEnd(28)} ${String(x.antal).padStart(6)} anrop  p50 ${String(x.p50).padStart(6)} ms  p95 ${String(x.p95).padStart(6)} ms  fel ${x.fel}  ${x.ok ? 'ok' : 'över målet'}`);
  console.log(`  Tappade sandlådor ${vagen.tappade}, svar om full demo ${vagen.fullSvar} (${vagen.vantade} besökare väntade, längst ${vagen.maxVantanSekunder} s)`);
  console.log(`  Minne högst ${vagen.minne.maxRssMb} MB (gräns ${vagen.minne.gransMb ?? 'ingen'} MB), i minnet högst ${vagen.sandlador.maxIMinnet} av ${vagen.sandlador.takIMinnet}, vilande högst ${vagen.sandlador.maxVilar}`);
  tester.push({ namn: TEST_VAG, status: vagen.ok ? 'grön' : 'röd' });
}
const ut = {
  tid: new Date().toISOString(), version: halsa.version, kodHash: kodHash(), gransnitt: halsa.gransnitt, bas: BAS,
  mal: { p95Ms: MAL_MS, kalla: 'D5: p95 under 200 ms per adress i API:t' },
  upplagg: { sekunder: SEKUNDER, uppvarmning: UPPVARMNING, betanketid: [BETANK_MIN, BETANK_MAX], anvandarePerSandlada: PER_SANDLADA, roller: ROLLER, patienter: PATIENTER.length },
  maskin: process.env.MASKIN || null,
  nivaer, vag: vagen, tester,
};
writeFileSync(join(import.meta.dir, '..', 'lasttest.json'), JSON.stringify(ut, null, 2) + '\n');
console.log(`lasttest.json: ${tester.filter(t => t.status === 'grön').length} av ${tester.length} nivåer klarar målet`);
