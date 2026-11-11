// Lasttest (runda 12, r2, Sussa KD1.1.1.5): spelar realistiska flöden för 100 och 500 samtidiga användare mot en lokal
// server och sparar svarstiderna per åtgärd mot svarstidsmålet i D5 (p95 under 200 ms per adress i API:t) i
// lasttest.json, med en hash av src/ och public/ så att kravregistret vet om resultatet gäller den kod som byggs.
//
// Varje användare loggar in och arbetar sedan i en slinga: öppnar arbetslistan, söker en patient, läser översikten,
// journalen, läkemedlen och mätvärdena, registrerar ibland ett mätvärde och tittar i inkorgen, med betänketid mellan
// åtgärderna som när en person läser. I demon motsvarar en sandlåda en vårdgivares databas, så användarna delar
// sandlådor (ANVANDARE_PER_SANDLADA), på samma sätt som många användare delar en databas i driften.
//
// Körs så här, mot en container som är startad med MAX_SESSIONER och NYA_PER_TIMME tillräckligt högt:
//   bun scripts/lasttest.js http://127.0.0.1:18222
// Miljö: NIVAER (100,500), SEKUNDER (mätningens längd per nivå), BETANK_MIN och BETANK_MAX (sekunder).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { kodHash } from '../src/klientresultat.js';

const BAS = (process.argv[2] || 'http://127.0.0.1:18222').replace(/\/$/, '');
const NIVAER = (process.env.NIVAER || '100,500').split(',').map(Number);
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

const halsa = await fetch(`${BAS}/api/health`).then(r => r.json());
const nivaer = [];
for (const n of NIVAER) {
  console.log(`Lasttest med ${n} samtidiga användare i ${SEKUNDER} sekunder`);
  const r = await niva(n);
  for (const x of r.per) console.log(`  ${x.atgard.padEnd(28)} ${String(x.antal).padStart(6)} anrop  p50 ${String(x.p50).padStart(6)} ms  p95 ${String(x.p95).padStart(6)} ms  fel ${x.fel}  ${x.ok ? 'ok' : 'över målet'}`);
  nivaer.push(r);
}
const tester = nivaer.map(r => ({ namn: `Lasttest > ${r.anvandare} samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel`, status: r.ok ? 'grön' : 'röd' }));
const ut = {
  tid: new Date().toISOString(), version: halsa.version, kodHash: kodHash(), gransnitt: halsa.gransnitt, bas: BAS,
  mal: { p95Ms: MAL_MS, kalla: 'D5: p95 under 200 ms per adress i API:t' },
  upplagg: { sekunder: SEKUNDER, uppvarmning: UPPVARMNING, betanketid: [BETANK_MIN, BETANK_MAX], anvandarePerSandlada: PER_SANDLADA, roller: ROLLER, patienter: PATIENTER.length },
  maskin: process.env.MASKIN || null,
  nivaer, tester,
};
writeFileSync(join(import.meta.dir, '..', 'lasttest.json'), JSON.stringify(ut, null, 2) + '\n');
console.log(`lasttest.json: ${tester.filter(t => t.status === 'grön').length} av ${tester.length} nivåer klarar målet`);
