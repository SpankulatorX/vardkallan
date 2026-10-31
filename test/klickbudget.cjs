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

const BAS = process.argv[2] || 'http://127.0.0.1:18797';
const APP = join(__dirname, '..', 'app');
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });

// Räknar steg i ett flöde.
class Matare {
  constructor(page) { this.page = page; this.nollstall(); }
  nollstall() { this.klick = 0; this.faltbyten = 0; this.tangenter = 0; this.listval = 0; this.implicita = 0; this.steg = []; }
  async borja() { this.nollstall(); await this.page.evaluate(() => { window.__klick = 0; window.__tangent = 0; }); }
  // Ett musklick på ett element.
  async klicka(loc, text) {
    await loc.waitFor({ state: 'visible' });
    await loc.click();
    this.klick++;
    this.steg.push(`klick: ${text}`);
  }
  // En rullgardinslista: två klick (öppna och välja), eller inget om rätt värde redan är förvalt.
  async valj(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    if (await loc.inputValue() === varde) { this.steg.push(`förvalt: ${text}`); return; }
    await loc.selectOption(varde);
    this.klick += 2;
    this.listval++;
    this.steg.push(`lista (2 klick): ${text}`);
  }
  // Text i ett fält. Har fältet inte redan fokus krävs ett fältbyte, som görs med ett klick i fältet.
  async skriv(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    const harFokus = await loc.evaluate(el => el === document.activeElement);
    if (!harFokus) { await loc.click(); this.faltbyten++; this.steg.push(`fältbyte: ${text}`); } else this.steg.push(`har redan fokus: ${text}`);
    await this.page.keyboard.type(varde);
  }
  async tangent(namn, text) {
    // Enter i ett formulär med en skicka-knapp gör att webbläsaren själv klickar på knappen. Det är samma tangenttryck,
    // men sidan ser också ett klick, vilket kontrollen räknar med.
    if (namn === 'Enter' && await this.page.evaluate(() => Boolean(document.activeElement?.form?.querySelector('[type="submit"]')))) this.implicita++;
    await this.page.keyboard.press(namn);
    this.tangenter++;
    this.steg.push(`tangent ${namn}: ${text}`);
  }
  // Jämför med vad sidan har tagit emot. Klick i fält räknas som fältbyten, och listval görs utan musklick.
  async kontrollera() {
    const s = await this.page.evaluate(() => ({ klick: window.__klick, tangent: window.__tangent }));
    const vantadeKlick = this.klick - 2 * this.listval + this.faltbyten + this.implicita;
    if (s.klick !== vantadeKlick || s.tangent !== this.tangenter) {
      throw new Error(`sidan tog emot ${s.klick} klick och ${s.tangent} tangenter, skriptet räknade ${vantadeKlick} och ${this.tangenter}`);
    }
  }
  get uppmatt() { return this.klick + this.faltbyten + this.tangenter; }
}

const fel = [];
async function synlig(page, sel, text) {
  const l = page.locator(sel).filter({ hasText: text }).first();
  await l.waitFor({ state: 'visible', timeout: 10000 });
  return l;
}
async function gaTill(page, hash) { await page.goto(`${BAS}/${hash}`); await page.waitForLoadState('networkidle'); await page.waitForSelector('main h1'); }
async function loggaIn(page, id) {
  await page.goto(`${BAS}/#/`);
  await page.waitForLoadState('networkidle');
  if (await page.locator('[data-a="loggaut"]').count()) await page.click('[data-a="loggaut"]');
  await page.click(`[data-roll="${id}"]`);
  await page.waitForSelector('[data-a="loggaut"]');
  await page.waitForSelector('#lista, main h1');
  await page.waitForLoadState('networkidle');
}
const startI = {
  'Arbetslistan efter inloggning': async (page) => { await gaTill(page, '#/arbetslista'); await page.waitForSelector('#lista table'); },
  'Patientens översikt': async (page) => { await gaTill(page, '#/patient/p01'); await page.waitForSelector('.tidslinje'); },
};

// Flödena. Varje funktion gör flödet från startpunkten och kontrollerar att det når sitt resultat.
const GOR = {
  'oppna-patient': async (m, page) => {
    await m.klicka(page.locator('a.patientlank', { hasText: 'Gunnar Åkesson' }), 'patientens namn i arbetslistan');
    await page.waitForSelector('.tidslinje');
    await synlig(page, '#ov-lm', 'Aktuella läkemedel');
    await synlig(page, '#ov-ant', 'Senaste anteckningar');
  },
  'las-anteckning': async (m, page) => {
    const forsta = page.locator('.ant-lista li').filter({ hasNot: page.locator('.tagg-utkast') }).first();
    const typ = (await forsta.locator('.ant-typ').textContent()).trim();
    await m.klicka(forsta.locator('a'), `senaste signerade anteckningen (${typ})`);
    await synlig(page, '.anteckning .ant-huvud h2', typ);
    await synlig(page, '.anteckning .ant-fakta', 'Signerad');
  },
  daganteckning: async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
    await page.waitForSelector('#ant-form');
    await m.valj(page.locator('#ny-mall'), 'Daganteckning', 'mallen Daganteckning');
    await m.skriv(page.locator('textarea[data-sokord="Aktuellt"]'), 'Pigg, äter bra. Inga bröstsmärtor.', 'sökordet Aktuellt');
    await m.skriv(page.locator('textarea[data-sokord="Bedömning"]'), 'Stabil, fortsatt plan.', 'sökordet Bedömning');
    await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
    await synlig(page, '.anteckning', 'Pigg, äter bra. Inga bröstsmärtor.');
    await synlig(page, '.anteckning .ant-fakta', 'Signerad');
  },
  ordinera: async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Ordinera' }), 'Ordinera');
    await page.waitForSelector('#ordform');
    await m.skriv(page.locator('#lm-sok'), 'omeprazol', 'sök läkemedel');
    await m.klicka(page.locator('[data-lm]').first(), 'träffen Omeprazol');
    await m.skriv(page.locator('input[name="dosering"]'), '1 kapsel på morgonen', 'dosering');
    await m.skriv(page.locator('input[name="ordinationsorsak"]'), 'Magskydd', 'ordinationsorsak');
    await m.klicka(page.locator('[data-upp="14"]'), 'uppföljning om två veckor');
    await m.klicka(page.locator('[data-spara]'), 'Kontrollera och spara');
    await synlig(page, '.notis', 'Omeprazol är ordinerat');
    await synlig(page, '.lm-tabell', 'Omeprazol');
  },
  utsattning: async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
    await page.waitForSelector('.lm-tabell');
    await m.klicka(page.locator('.lm-tabell tr', { hasText: 'Alvedon' }).locator('[data-utsatt]'), 'Sätt ut för Alvedon');
    await m.skriv(page.locator('dialog[open] textarea'), 'Ingen smärta längre.', 'orsak');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Sätt ut');
    await synlig(page, '.notis', 'Alvedon är utsatt');
  },
  blodtryck: async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Registrera mätvärde' }), 'Registrera mätvärde');
    await page.waitForSelector('#mv-form');
    await m.valj(page.locator('#mv-typ'), 'blodtryck', 'mätvärdet Blodtryck');
    await m.skriv(page.locator('#mv-varde'), '128/82', 'värdet');
    await m.klicka(page.locator('#mv-form [type="submit"]'), 'Registrera');
    await synlig(page, '.notis', 'Blodtryck 128/82');
  },
  remiss: async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Skicka remiss' }), 'Skicka remiss');
    await page.waitForSelector('#remissform');
    await m.valj(page.locator('select[name="tillEnhetId"]'), 'uso-kard', 'mottagare Kardiologiska kliniken');
    await m.skriv(page.locator('textarea[name="fragestallning"]'), 'Bedömning inför elkonvertering.', 'frågeställning');
    await m.skriv(page.locator('textarea[name="anamnes"]'), 'Förmaksflimmer sedan 2014. Waran, INR 2,4.', 'anamnes');
    await m.klicka(page.locator('#remissform [type="submit"]'), 'Skicka remissen');
    await synlig(page, '.notis', 'Remissen är skickad');
  },
  'kvittera-svar': async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
    await page.waitForSelector('#ik-svar');
    await m.klicka(page.locator('#ik-svar ~ ul a').first(), 'remissvaret i inkorgen');
    await synlig(page, '.remiss.markerad .remiss-text', 'Svar');
    await m.klicka(page.locator('.remiss.markerad [data-remiss-atgard="kvittera"]'), 'Kvittera svaret');
    await synlig(page, '.notis', 'Svaret är kvitterat');
  },
  nodatkomst: async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/sok"]'), 'Sök patient i menyn');
    await page.waitForSelector('#sokfalt');
    await m.skriv(page.locator('#sokfalt'), 'Lindberg', 'sökfältet');
    await m.tangent('Enter', 'sök');
    await m.klicka(page.locator('#traffar a', { hasText: 'Thomas Lindberg' }), 'träffen Thomas Lindberg');
    await m.klicka(page.locator('.ruta-nod [data-val="nodatkomst"]'), 'Nödåtkomst');
    await page.locator('dialog[open]').waitFor();
    await m.klicka(page.locator('dialog[open] [data-forslag]').first(), 'syftet Medvetslös vid ankomst');
    await m.klicka(page.locator('dialog[open] input[name="intyg"]'), 'intyget att patienten inte kan samtycka');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Öppna med nödåtkomst');
    await synlig(page, '.band-grund', 'Nödåtkomst, loggas och granskas');
  },
};

(async () => {
  const { FLODEN, REGLER } = await import(pathToFileURL(join(APP, 'src', 'klickbudget.js')).href);
  const { klickbudgetTest } = await import(pathToFileURL(join(APP, 'src', 'krav.js')).href);
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  // Sidan räknar de klick och specialtangenter (inte tecken) som webbläsaren faktiskt tar emot.
  await ctx.addInitScript(() => {
    window.__klick = 0; window.__tangent = 0;
    document.addEventListener('click', e => { if (e.isTrusted) window.__klick++; }, true);
    document.addEventListener('keydown', e => { if (e.isTrusted && e.key.length > 1) window.__tangent++; }, true);
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => fel.push(`sidfel: ${e.message}`));
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

  // Kravsidan visar tabellen för D6.
  try {
    await gaTill(page, '#/krav');
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
