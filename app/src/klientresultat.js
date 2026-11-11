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

// Runda 12, r2: lasttestet (scripts/lasttest.js) gäller koden i både src/ och public/. Hashen är sha256 över båda
// katalogerna, med katalogens namn före varje fil.
export const SRC = fileURLToPath(new URL('../src', import.meta.url));
export const LASTTEST = fileURLToPath(new URL('../lasttest.json', import.meta.url));
export function kodHash(src = SRC, pub = PUBLIC) {
  return createHash('sha256').update(`src ${existsSync(src) ? gransnittHash(src) : ''}\npublic ${existsSync(pub) ? gransnittHash(pub) : ''}`).digest('hex');
}

// Runda 12, r2: valideringen med HL7:s validator (test/fhir-validering/) gäller den kod som bygger FHIR-resurserna:
// varje fil i src/ som skapar en resurs (har resourceType). Hashen är sha256 över filerna i sorterad ordning, och
// resultatet räknas bara när hashen stämmer, så att bygget vet om valideringen gäller den FHIR-export som byggs.
export const FHIRVALIDERING = fileURLToPath(new URL('../fhir-validering.json', import.meta.url));
export function fhirKodHash(src = SRC) {
  const filer = [];
  const ga = (d) => {
    for (const n of readdirSync(d).sort()) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) ga(f);
      else if (n.endsWith('.js') && readFileSync(f, 'utf8').includes('resourceType')) filer.push(f);
    }
  };
  if (existsSync(src)) ga(src);
  const h = createHash('sha256');
  for (const f of filer) h.update(`${relative(src, f)}\n`).update(readFileSync(f));
  return { hash: h.digest('hex'), filer: filer.map(f => relative(src, f)) };
}

const lasJson = (fil) => {
  try { return fil && existsSync(fil) ? JSON.parse(readFileSync(fil, 'utf8')) : null; } catch { return null; }
};

let cache = null;
// Läser båda filerna. Hashen av public/ räknas en gång per process, eftersom filerna inte ändras medan servern kör.
// Runda 7, r1: sussatestfall är sussa-testfall.json från test/sussa-testfall.cjs, Sussas användbarhetstester.
export function lasKlientresultat({ klickbudget, klienttester, sussatestfall = null, publicDir = PUBLIC, lasttest = null, srcDir = SRC, fhirvalidering = null } = {}) {
  const nyckel = `${klickbudget}|${klienttester}|${sussatestfall}|${publicDir}|${lasttest}|${srcDir}|${fhirvalidering}`;
  if (!cache || cache.nyckel !== nyckel) {
    cache = { nyckel, hash: existsSync(publicDir) ? gransnittHash(publicDir) : null, kod: lasttest && existsSync(lasttest) ? kodHash(srcDir, publicDir) : null,
      fhir: fhirvalidering && existsSync(fhirvalidering) ? fhirKodHash(srcDir).hash : null };
  }
  const hash = cache.hash;
  const kb = lasJson(klickbudget);
  const kt = lasJson(klienttester);
  const aktuell = (x) => Boolean(x && hash && x.gransnittHash === hash);
  const tester = [];
  // Runda 7, r1: Sussas testfall.
  const st = lasJson(sussatestfall);
  for (const [fil, aktiv] of [[kt, aktuell(kt)], [kb, aktuell(kb)], [st, aktuell(st)]]) {
    for (const t of fil?.tester ?? []) tester.push({ namn: t.namn, status: aktiv ? t.status : 'inaktuell' });
  }
  // Runda 12, r2: lasttestet räknas bara när det gäller samma kod i src/ och public/ som servern kör.
  const lt = lasJson(lasttest);
  const ltAktuell = Boolean(lt && cache.kod && lt.kodHash === cache.kod);
  for (const t of lt?.tester ?? []) tester.push({ namn: t.namn, status: ltAktuell ? t.status : 'inaktuell' });
  // Runda 12, r2: valideringen med HL7:s validator räknas bara när den gäller samma FHIR-kod.
  const fv = lasJson(fhirvalidering);
  const fvAktuell = Boolean(fv && cache.fhir && fv.fhirKodHash === cache.fhir);
  for (const t of fv?.tester ?? []) tester.push({ namn: t.namn, status: fvAktuell ? t.status : 'inaktuell' });
  return {
    tester,
    klienttester: kt ? { tid: kt.tid, antal: kt.tester?.length ?? 0, godkanda: (kt.tester ?? []).filter(t => t.status === 'grön').length, aktuell: aktuell(kt) } : null,
    klickbudget: kb ? { tid: kb.tid, regler: kb.regler, floden: kb.floden, aktuell: aktuell(kb) } : null,
    // Runda 7, r1: resultatet per testfall och sammanställningen enligt Sussas modell (Bilaga F1:2).
    fhirvalidering: fv ? { tid: fv.tid, aktuell: fvAktuell, validator: fv.validator, resurser: fv.resurser, fel: fv.fel, varningar: fv.varningar } : null,
    lasttest: lt ? { tid: lt.tid, aktuell: ltAktuell, mal: lt.mal, upplagg: lt.upplagg, nivaer: lt.nivaer } : null,
    sussaTestfall: st ? { tid: st.tid, aktuell: aktuell(st), webblasare: st.webblasare, klm: st.klm, klmSteg: st.klmSteg, testfall: st.testfall, ejGenomforbara: st.ejGenomforbara, sammanstallning: st.sammanstallning } : null,
  };
}
