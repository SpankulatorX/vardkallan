// Uppmätt klickbudget (D6). Gör de vanligaste arbetsflödena i gränssnittet med Playwright och räknar klick, fältbyten
// och tangenttryck enligt reglerna i app/src/klickbudget.js, där budgetarna och motiveringarna finns. Resultatet skrivs
// till app/klickbudget.json, som /api/krav läser och kravsidan visar för D6. Skriptet misslyckas om ett flöde kräver
// fler steg än budgeten, eller om flödet inte når sitt resultat.
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/klickbudget.cjs [bas-url]
// Standard för bas-url är http://127.0.0.1:18797.
//
// Varje steg görs med en riktig interaktion: musklick, tangenttryck och inskriven text. Skriptet räknar sina egna
// steg, och sidan räknar samtidigt de klick och specialtangenter webbläsaren faktiskt tar emot. Stämmer siffrorna
// inte överens misslyckas mätningen, så att inget steg kan döljas i en hjälpfunktion.

const { chromium } = require('@playwright/test');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { Matare, skapa, raknaISidan } = require('./flodessteg.cjs');

const BAS = process.argv[2] || 'http://127.0.0.1:18797';
const APP = join(__dirname, '..', 'app');
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });

const fel = [];
const { synlig, gaTill, loggaIn, startI, GOR } = skapa(BAS);

(async () => {
  const { FLODEN, REGLER } = await import(pathToFileURL(join(APP, 'src', 'klickbudget.js')).href);
  const { klickbudgetTest } = await import(pathToFileURL(join(APP, 'src', 'krav.js')).href);
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  await raknaISidan(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => fel.push(`sidfel: ${e.message} (${(e.stack || '').split('\n').slice(1, 4).map(r => r.trim()).join(' | ')})`));
  page.on('response', r => { if (r.status() === 401) fel.push(`401: ${r.request().method()} ${r.url()}`); });
  page.on('console', msg => { if (msg.type() === 'error' && !/status of 403/.test(msg.text())) fel.push(`konsolfel: ${msg.text()}`); });
  const m = new Matare(page);
  const resultat = [];
  let roll = null;

  for (const f of FLODEN) {
    const r = { ...f, klick: 0, faltbyten: 0, tangenter: 0, uppmatt: 0, inomBudget: false, steg: [] };
    try {
      // Vid byte av roll återställs demon, så att varje roll börjar med patienterna som i seeden.
      if (roll !== f.roll) {
        await loggaIn(page, f.roll);
        await page.click('[data-a="aterstall"]');
        await synlig(page, '.notis', 'Demon är återställd');
        roll = f.roll;
      }
      await startI[f.start](page);
      await m.borja();
      await GOR[f.id](m, page);
      await m.kontrollera();
      Object.assign(r, { klick: m.klick, faltbyten: m.faltbyten, tangenter: m.tangenter, uppmatt: m.uppmatt, steg: m.steg });
      r.inomBudget = r.uppmatt <= r.budget;
      console.log(`${r.inomBudget ? 'ok ' : 'ÖVER'} ${f.namn}: ${r.uppmatt} (budget ${r.budget}). ${m.steg.join('; ')}`);
      if (!r.inomBudget) fel.push(`${f.namn}: ${r.uppmatt} steg, budget ${r.budget}`);
    } catch (e) {
      fel.push(`${f.namn}: ${e.message.split('\n')[0]}`);
      r.fel = e.message.split('\n')[0];
      console.log(`FEL ${f.namn}: ${r.fel}`);
      await page.screenshot({ path: join(UT, `00-fel-klickbudget-${f.id}.png`), fullPage: true }).catch(() => {});
    }
    resultat.push(r);
  }

  const ut = {
    tid: new Date().toISOString(), bas: BAS, webblasare: `Chromium ${browser.version()}`, gransnittHash: gransnittHash(join(APP, 'public')), regler: REGLER,
    floden: resultat.map(({ id, namn, roll: rl, start, budget, motivering, klick, faltbyten, tangenter, uppmatt, inomBudget, steg }) => ({ id, namn, roll: rl, start, budget, motivering, klick, faltbyten, tangenter, uppmatt, inomBudget, steg })),
    tester: resultat.map(r => ({ namn: klickbudgetTest(r), status: !r.fel && r.inomBudget ? 'grön' : 'röd' })),
  };
  writeFileSync(join(APP, 'klickbudget.json'), `${JSON.stringify(ut, null, 2)}\n`);

  // Kravsidan visar tabellen för D6 under fliken Eget ramverk.
  try {
    // Sidan laddas om från en tom sida, så att inget från det sista flödet (till exempel en tillämpning i en ram) håller
    // nätverket igång.
    await page.goto('about:blank');
    await gaTill(page, '#/krav?vy=egna');
    const d6 = page.locator('.krav', { has: page.locator('.krav-id', { hasText: /^D6$/ }) });
    await d6.locator('.kb-tabell').waitFor();
    await d6.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById('notiser').replaceChildren());
    await page.waitForTimeout(250);
    await d6.screenshot({ path: join(UT, '36-klickbudget.png') });
  } catch (e) { fel.push(`kravsidan: ${e.message.split('\n')[0]}`); }

  await browser.close();
  console.log('\nFlöde | uppmätt | budget');
  for (const r of ut.floden) console.log(`${r.namn} | ${r.uppmatt} | ${r.budget}`);
  if (fel.length) { console.log(`\nKlickbudgeten misslyckades:\n  ${fel.join('\n  ')}`); process.exit(1); }
  console.log('\nAlla flöden inom budget. Resultatet finns i app/klickbudget.json');
})().catch(e => { console.error(e); process.exit(1); });
