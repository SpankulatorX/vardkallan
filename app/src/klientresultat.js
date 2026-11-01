// Resultat från testerna av gränssnittet. De körs i Playwright mot en lokal server (test/avbrott.cjs, test/anvandartest.cjs och
// test/klickbudget.cjs) och skrivs till klienttest-resultat.json och klickbudget.json, som följer med i bygget.
// Varje fil har en hash av allt i public/ när testerna kördes. Har gränssnittet ändrats sedan dess räknas testerna
// som inaktuella, och kravet blir delvis tills testerna har körts igen.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Modulen läses också av Playwright-skripten i Node, så sökvägen tas från import.meta.url och inte från Buns import.meta.dir.
export const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));

// sha256 över alla filer i public/, i sorterad ordning, med sökvägen före innehållet.
export function gransnittHash(rot = PUBLIC) {
  const filer = [];
  const ga = (d) => {
    for (const n of readdirSync(d).sort()) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) ga(f); else filer.push(f);
    }
  };
  ga(rot);
  const h = createHash('sha256');
  for (const f of filer) h.update(`${relative(rot, f)}\n`).update(readFileSync(f));
  return h.digest('hex');
}

const lasJson = (fil) => {
  try { return fil && existsSync(fil) ? JSON.parse(readFileSync(fil, 'utf8')) : null; } catch { return null; }
};

let cache = null;
// Läser båda filerna. Hashen av public/ räknas en gång per process, eftersom filerna inte ändras medan servern kör.
export function lasKlientresultat({ klickbudget, klienttester, publicDir = PUBLIC } = {}) {
  const nyckel = `${klickbudget}|${klienttester}|${publicDir}`;
  if (!cache || cache.nyckel !== nyckel) cache = { nyckel, hash: existsSync(publicDir) ? gransnittHash(publicDir) : null };
  const hash = cache.hash;
  const kb = lasJson(klickbudget);
  const kt = lasJson(klienttester);
  const aktuell = (x) => Boolean(x && hash && x.gransnittHash === hash);
  const tester = [];
  for (const [fil, aktiv] of [[kt, aktuell(kt)], [kb, aktuell(kb)]]) {
    for (const t of fil?.tester ?? []) tester.push({ namn: t.namn, status: aktiv ? t.status : 'inaktuell' });
  }
  return {
    tester,
    klienttester: kt ? { tid: kt.tid, antal: kt.tester?.length ?? 0, godkanda: (kt.tester ?? []).filter(t => t.status === 'grön').length, aktuell: aktuell(kt) } : null,
    klickbudget: kb ? { tid: kb.tid, regler: kb.regler, floden: kb.floden, aktuell: aktuell(kb) } : null,
  };
}
