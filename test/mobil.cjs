// Mobilt arbetssätt och sidan Öppet API (runda 9, r6, Sussa 2.3.1.1 till 2.3.1.4, 2.5.1.1 och 2.6.1.2). Skriptet gör
// varje flöde som app/src/mobil.js anger som mobilt i en skärm som är 360 px bred, med samma steg som klickbudgeten,
// och kontrollerar efter flödet att sidan inte rullar i sidled och att knapparna är minst 40 px höga. Det prövar också
// armbandet vid sängen, Min journal i mobilen, att inloggningen håller när förbindelsen bryts och kommer tillbaka från
// en annan adress, och att systemförvaltaren registrerar en tillämpning och att ett ärende skickas på sidan Öppet API.
// Resultatet skrivs till app/klienttest-resultat.json med prefixen Gränssnitt > Mobil > och Gränssnitt > Öppet API > .
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/mobil.cjs [bas-url]

const { chromium } = require('@playwright/test');
const { join } = require('node:path');
const { mkdirSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { Matare, skapa, raknaISidan } = require('./flodessteg.cjs');
const { skrivKlienttester } = require('./klienttester.cjs');

const BAS = process.argv[2] || 'http://127.0.0.1:18196';
const APP = join(__dirname, '..', 'app');
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });
const MOBIL = 'Gränssnitt > Mobil > ';
const OPPET = 'Gränssnitt > Öppet API > ';
// Runda 10, r1: registreringen av överkänslighet.
const UPPM = 'Gränssnitt > Uppmärksamhet > ';
const KONTEXT = { viewport: { width: 360, height: 760 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm', deviceScaleFactor: 2 };

(async () => {
  const { mobilaFloden } = await import(pathToFileURL(join(APP, 'src', 'mobil.js')).href);
  const { FLODEN } = await import(pathToFileURL(join(APP, 'src', 'klickbudget.js')).href);
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const { synlig, gaTill, loggaIn, startI, GOR } = skapa(BAS);
  const browser = await chromium.launch();
  const tester = { [MOBIL]: [], [OPPET]: [], [UPPM]: [] };
  const fel = [];
  let ctx = null;
  let page = null;
  const nyKontext = async () => {
    if (ctx) await ctx.close();
    ctx = await browser.newContext(KONTEXT);
    await raknaISidan(ctx);
    page = await ctx.newPage();
    page.on('pageerror', e => fel.push(`sidfel: ${e.message}`));
  };
  // Samma kontroll som genomgången: ingen sidledsrullning och knappar som går att trycka på med fingret.
  const kontrolleraMobil = async (vad) => {
    const b = await page.evaluate(() => document.documentElement.scrollWidth);
    if (b > 360) throw new Error(`${vad}: sidan är ${b} px bred`);
    const sma = await page.evaluate(() => [...document.querySelectorAll('button:not(.knapp-lank), a.knapp, input[type="submit"], input[type="button"], .segment label, [role="tab"]')]
      .map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ e, r }) => r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sr, [hidden], dialog:not([open])') && r.height < 39.5)
      .map(({ e, r }) => `"${(e.textContent.trim() || e.getAttribute('aria-label') || e.tagName).replace(/\s+/g, ' ').slice(0, 30)}" ${Math.round(r.height)} px`));
    if (sma.length) throw new Error(`${vad}: knappar lägre än 40 px: ${[...new Set(sma)].slice(0, 6).join(', ')}`);
  };
  const test = async (prefix, namn, fn) => {
    try {
      await fn();
      tester[prefix].push({ namn: `${prefix}${namn}`, status: 'grön' });
      console.log(`ok   ${namn}`);
    } catch (e) {
      tester[prefix].push({ namn: `${prefix}${namn}`, status: 'röd', fel: e.message.split('\n')[0] });
      console.log(`FEL  ${namn}: ${e.message.split('\n')[0]}`);
      await page?.screenshot({ path: join(UT, `00-fel-mobil-${tester[prefix].length}.png`), fullPage: true }).catch(() => {});
    }
  };

  // Varje mobilt flöde i 360 px, med samma steg som klickbudgeten. Demon återställs vid varje byte av roll.
  let roll = null;
  await nyKontext();
  for (const f of mobilaFloden().filter(x => x.mobil)) {
    const flode = FLODEN.find(x => x.id === f.id);
    await test(MOBIL, `${flode.namn} går i 360 px`, async () => {
      if (roll !== flode.roll) {
        await nyKontext();
        await loggaIn(page, flode.roll);
        if (!flode.roll.startsWith('inv-')) { await page.click('[data-a="aterstall"]'); await synlig(page, '.notis', 'Demon är återställd'); }
        roll = flode.roll;
      }
      await startI[flode.start](page);
      // I mobilen ligger menyn bakom menyknappen. Ett flöde som börjar i menyn öppnar den först, med ett tryck.
      if (GOR[flode.id].toString().includes('#meny-lista') && await page.locator('[data-a="meny"]').isVisible()) {
        await page.click('[data-a="meny"]');
        await page.waitForSelector('#meny.oppen');
      }
      const m = new Matare(page);
      await m.borja();
      await GOR[flode.id](m, page);
      await m.kontrollera();
      await kontrolleraMobil(flode.namn);
    });
  }

  // Varje roll: startsidan och menyn i 360 px.
  await test(MOBIL, 'varje roll har sin startsida och menyn i 360 px utan sidledsrullning och med knappar på minst 40 px', async () => {
    for (const r of ['lak-kard', 'ssk-kard', 'usk-kard', 'lak-akut', 'lak-vc', 'lak-psyk', 'adm-kard', 'logg', 'ark', 'uppf', 'kom-bist', 'far-kard', 'vch-kard', 'eko', 'sysf', 'fys-kard']) {
      await nyKontext();
      await loggaIn(page, r);
      await page.waitForSelector('main h1');
      await kontrolleraMobil(`${r}: startsidan`);
      await page.click('[data-a="meny"]');
      await page.waitForSelector('#meny.oppen');
      await kontrolleraMobil(`${r}: menyn`);
    }
  });

  // Patienten i sin mobil.
  await test(MOBIL, 'patienten läser sin journal, sina tider och vem som läst journalen i Min journal i 360 px', async () => {
    await nyKontext();
    await loggaIn(page, 'inv-p01');
    await gaTill(page, '#/min/p01');
    await page.waitForSelector('.min-band h1');
    await kontrolleraMobil('Min journal');
    for (const flik of await page.locator('[role="tab"]').all()) {
      await flik.click();
      await page.waitForLoadState('networkidle');
      await kontrolleraMobil(`Min journal, ${(await flik.textContent()).trim()}`);
    }
  });

  // Vid sängen: armbandet identifierar patienten i Läkemedel att ge (inläsningen i POST /api/skanna, Sussa 3.1.3.6).
  await test(MOBIL, 'vid sängen identifierar armbandet patienten i Läkemedel att ge, och bara patientens doser visas', async () => {
    await nyKontext();
    await loggaIn(page, 'ssk-kard');
    await gaTill(page, '#/administrering');
    await page.waitForSelector('.adm-patient');
    const forsta = await page.locator('.adm-patient h2').first().getAttribute('id');
    const pid = forsta.replace(/^adm-/, '');
    const kod = await page.evaluate(async (p) => {
      const r = await fetch(`/api/patient/${encodeURIComponent(p)}/armband`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error(`armbandet kunde inte skrivas ut: ${r.status}`);
      return (await r.json()).kod;
    }, pid);
    await page.fill('#adm-kod', kod);
    await page.keyboard.press('Enter');
    await synlig(page, '#adm-kod-svar', 'Bara patientens doser visas');
    const synliga = await page.locator('.adm-patient:not([hidden])').count();
    if (synliga !== 1) throw new Error(`${synliga} patienter visas efter skanningen`);
    await kontrolleraMobil('Läkemedel att ge efter skanningen');
    await page.screenshot({ path: join(UT, '60-mobil-armband.png') });
  });

  // Förbindelsen bryts och kommer tillbaka från en annan adress, som när mobilen går från wifi till mobildatanätet.
  await test(MOBIL, 'förbindelsen bryts och kommer tillbaka från en annan adress utan att inloggningen tappas', async () => {
    await nyKontext();
    await loggaIn(page, 'ssk-kard');
    await gaTill(page, '#/patient/p01');
    await page.waitForSelector('.tidslinje');
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(500);
    // Ett annat nät: varje anrop kommer nu från en annan adress.
    await ctx.route('**/*', (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': '198.51.100.23' } }));
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await gaTill(page, '#/patient/p01/lakemedel');
    await page.waitForSelector('main h1');
    if (!(await page.locator('[data-a="loggaut"]').count())) throw new Error('inloggningen tappades');
    const s = await page.evaluate(async () => (await (await fetch('/api/session')).json()).personal?.id);
    if (s !== 'ssk-kard') throw new Error(`sessionen gäller ${s}`);
  });

  // Sidan Öppet API: ändringsloggen, ett ärende och en tillämpning som systemförvaltaren registrerar.
  await test(OPPET, 'ändringsloggen visar versionen, och läkaren skickar ett ärende om en saknad informationsmängd', async () => {
    await nyKontext();
    await loggaIn(page, 'lak-kard');
    await gaTill(page, '#/api');
    await synlig(page, '#api-andringar', '0.9.0');
    await page.click('[data-nytt-arende]');
    await page.selectOption('dialog[open] select[name="typ"]', 'informationsmangd');
    await page.fill('dialog[open] input[name="rubrik"]', 'Levnadsvanor för vårddatalagret');
    await page.fill('dialog[open] textarea[name="text"]', 'Vårddatalagret behöver levnadsvanorna som strukturerade uppgifter.');
    await page.click('dialog[open] [data-varde="ok"]');
    await synlig(page, '.api-arende', 'Levnadsvanor för vårddatalagret');
    await kontrolleraMobil('Öppet API');
  });
  await test(OPPET, 'systemförvaltaren registrerar en tillämpning, ser vad den får och kan återkalla den', async () => {
    await nyKontext();
    await loggaIn(page, 'sysf');
    await gaTill(page, '#/api');
    await page.click('[data-ny-tillampning]');
    await page.fill('dialog[open] input[name="namn"]', 'Vikt över tid');
    await page.fill('dialog[open] textarea[name="beskrivning"]', 'Visar patientens vikt över tid för dietisten.');
    await page.check('dialog[open] input[name="las"][value="Observation"]');
    await synlig(page, 'dialog[open] [data-forhand]', 'mätvärden');
    await page.click('dialog[open] [data-varde="ok"]');
    await synlig(page, '.api-lista li', 'Vikt över tid');
    await page.locator('.api-lista li', { hasText: 'Vikt över tid' }).locator('[data-aterkalla-t]').click();
    await page.fill('dialog[open] textarea[name="orsak"]', 'Prövningen är klar.');
    await page.click('dialog[open] [data-varde="ok"]');
    await synlig(page, '.api-lista li', 'Återkallad');
    await kontrolleraMobil('Öppet API för systemförvaltaren');
    await page.screenshot({ path: join(UT, '61-oppet-api-forvaltning.png'), fullPage: true });
  });

  // Runda 10, r1: varje vy i menyn för varje roll och varje flik i journalen i 360 px (Sussa 2.3.1.3). Uppställningen per
  // funktionellt krav (app/src/mobil.js) säger att vyerna går att öppna i mobilen, och det här testet visar det.
  await test(MOBIL, 'varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px', async () => {
    const vanta = async () => {
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => ![...document.querySelectorAll('main .tom, main .laddar')].some(e => /^Hämtar/.test(e.textContent)), null, { timeout: 8000 }).catch(() => {});
    };
    for (const r of ['lak-kard', 'ssk-kard', 'usk-kard', 'lak-akut', 'lak-vc', 'lak-psyk', 'adm-kard', 'logg', 'ark', 'uppf', 'kom-bist', 'far-kard', 'vch-kard', 'eko', 'sysf', 'fys-kard']) {
      await nyKontext();
      await loggaIn(page, r);
      const lankar = await page.locator('#meny-lista a').evaluateAll(a => a.map(x => [x.getAttribute('href'), x.textContent.trim()]));
      if (!lankar.length) throw new Error(`${r} har ingen meny`);
      for (const [href, text] of lankar) {
        await page.goto(`${BAS}/${href}`);
        await vanta();
        await kontrolleraMobil(`${r}, ${text}`);
      }
    }
    await nyKontext();
    await loggaIn(page, 'lak-kard');
    await gaTill(page, '#/patient/p01');
    await page.waitForSelector('.tidslinje');
    const flikar = await page.locator('.flikar a').evaluateAll(a => a.map(x => [x.getAttribute('href'), x.textContent.trim()]));
    if (flikar.length < 5) throw new Error(`journalen har bara ${flikar.length} flikar`);
    for (const [href, text] of flikar) {
      await page.goto(`${BAS}/${href}`);
      await vanta();
      await kontrolleraMobil(`journalen, ${text}`);
    }
  });

  // Runda 10, r1: i hemsjukvården, hos patienten och utan uppkoppling (Sussa 2.3.1.2 och 2.3.1.4). Mätvärdet registreras
  // i mobilen, märks som inte sparat och sparas när förbindelsen är tillbaka.
  await test(MOBIL, 'i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka', async () => {
    await nyKontext();
    await loggaIn(page, 'ssk-kard');
    await gaTill(page, '#/patient/p01/matvarden');
    await page.waitForSelector('#mv-form');
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.laskopia), null, { timeout: 10000 });
    await page.evaluate(async () => (await import('/js/avbrott.js')).simulera());
    await synlig(page, '#avbrott h2', 'Avbrott: läsläge');
    await gaTill(page, '#/patient/p01/matvarden');
    await page.waitForSelector('#mv-form');
    await page.selectOption('#mv-typ', 'saturation');
    await page.fill('#mv-varde', '93');
    await page.click('#mv-form [type=submit]');
    await synlig(page, '.notis', 'sparat i kön på den här datorn');
    await synlig(page, 'tr[data-ej-sparad]', 'Inte sparat i journalen än');
    await kontrolleraMobil('mätvärden under avbrottet');
    await page.screenshot({ path: join(UT, '63-mobil-skrivko.png') });
    await page.click('[data-avbrott="avsluta"]');
    await synlig(page, '.notis', 'från avbrottet är nu sparade i journalen');
    const mv = await page.evaluate(async () => (await (await fetch('/api/patient/p01/matvarden')).json()).matvarden.filter(m => m.typ === 'saturation' && String(m.varde) === '93').length);
    if (mv < 1) throw new Error('saturationen från kön finns inte i journalen');
  });

  // Runda 10, r1: systemförvaltaren registrerar ett systemkonto för vårddatalagret (Sussa 2.5.1.2).
  await test(OPPET, 'systemförvaltaren registrerar ett systemkonto för vårddatalagret, ser vad det får och kan återkalla det', async () => {
    const { generateKeyPairSync } = require('node:crypto');
    const jwk = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' });
    await nyKontext();
    await loggaIn(page, 'sysf');
    await gaTill(page, '#/api');
    await page.waitForSelector('[data-nytt-systemkonto]');
    await page.click('[data-nytt-systemkonto]');
    await page.fill('dialog[open] input[name="namn"]', 'Regionens vårddatalager');
    await page.fill('dialog[open] textarea[name="syfte"]', 'Uppföljning av diagnoser i regionens vårddatalager.');
    await page.check('dialog[open] input[name="ve"][value="uso-kard"]');
    await synlig(page, 'dialog[open] [data-forhand]', 'Kardiologiska kliniken USÖ');
    await page.fill('dialog[open] textarea[name="nyckel"]', JSON.stringify(jwk));
    await page.click('dialog[open] [data-varde="ok"]');
    await synlig(page, '.notis', 'client_id');
    const rad = page.locator('[data-systemkonton] .api-lista li', { hasText: 'Regionens vårddatalager' });
    await rad.waitFor();
    await synlig(page, '[data-systemkonton] .api-lista li', 'system/Condition.rs');
    await kontrolleraMobil('Öppet API, systemkonton');
    await rad.locator('[data-aterkalla-s]').click();
    await page.fill('dialog[open] textarea[name="orsak"]', 'Prövningen är klar.');
    await page.click('dialog[open] [data-varde="ok"]');
    await synlig(page, '[data-systemkonton] .api-lista li', 'Återkallat');
  });

  // Runda 10, r1: läkaren registrerar en överkänslighet ur listan, och systemet föreslår graden (Sussa 2.5.1.1 och 3.1.5).
  await test(UPPM, 'läkaren registrerar en överkänslighet med ämnet och reaktionen, och den syns i patienthuvudet med graden', async () => {
    await nyKontext();
    await loggaIn(page, 'lak-kard');
    await gaTill(page, '#/patient/p01');
    await page.waitForSelector('.patientband h1');
    const lagg = page.locator('[data-um-lagg]').first();
    if (!(await lagg.isVisible())) await page.locator('.signal-um summary').first().click();
    await page.locator('[data-um-lagg]').first().click();
    await page.click('dialog[open] [data-varde="overk"]');
    await page.waitForSelector('dialog[open] #ok-amne');
    await page.selectOption('dialog[open] #ok-amne', 'latex');
    await page.check('dialog[open] input[name="reaktion"][value="urtikaria"]');
    await page.click('dialog[open] [data-varde="ok"]');
    await synlig(page, '.notis', 'Överkänsligheten mot latex är registrerad med graden skadlig');
    await synlig(page, '.patientband', 'Latex');
    await kontrolleraMobil('patienthuvudet med överkänsligheten');
  });

  const version = browser.version();
  await browser.close();
  for (const [prefix, lista] of Object.entries(tester)) {
    skrivKlienttester({ app: APP, prefix, tester: lista.map(({ namn, status }) => ({ namn, status })), bas: BAS, webblasare: `Chromium ${version}`, gransnittHash: gransnittHash(join(APP, 'public')) });
  }
  const roda = Object.values(tester).flat().filter(t => t.status !== 'grön');
  if (fel.length) console.log(`\nSidfel:\n  ${[...new Set(fel)].slice(0, 10).join('\n  ')}`);
  console.log(`\nMobil och Öppet API: ${Object.values(tester).flat().length - roda.length} av ${Object.values(tester).flat().length} gröna.`);
  if (roda.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
