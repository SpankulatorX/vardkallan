// Tester av läsläget vid avbrott (D4) i en riktig webbläsare med Playwright. Resultatet skrivs till
// app/klienttest-resultat.json, som /api/krav läser, tillsammans med en hash av app/public. Ändras gränssnittet
// efteråt räknas testerna som inaktuella tills skriptet körs igen.
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/avbrott.cjs [bas-url]
// Standard för bas-url är http://127.0.0.1:18797. 127.0.0.1 räknas som säker kontext, så service workern fungerar.
//
// Ett riktigt avbrott görs med webbläsarens offlineläge (context.setOffline), så att varken sidan eller service
// workern når servern. Servern stoppas aldrig. Under offlineläget skriver webbläsaren nätverksfel i konsolen; de
// räknas inte som fel. Alla sidfel räknas som fel, och konsolfel när webbläsaren är online.

const { chromium } = require('@playwright/test');
const { writeFileSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const BAS = process.argv[2] || 'http://127.0.0.1:18797';
const APP = join(__dirname, '..', 'app');
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });
for (const f of readdirSync(UT)) if (f.startsWith('00-fel-avbrott')) rmSync(join(UT, f));
const PREFIX = 'Gränssnitt > Avbrott > ';

const tester = [];
const sidfel = [];
let offline = false;

function bevaka(page, namn) {
  page.on('pageerror', e => sidfel.push(`[${namn}] sidfel: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (offline && /ERR_INTERNET_DISCONNECTED|Failed to fetch|Failed to load resource/.test(t)) return;
    sidfel.push(`[${namn}] konsolfel: ${t}`);
  });
}

let felNr = 0;
let felSida = null;
async function test(namn, fn) {
  const fore = sidfel.length;
  try {
    await fn();
    if (sidfel.length > fore) throw new Error(sidfel.slice(fore).join('; '));
    tester.push({ namn: PREFIX + namn, status: 'grön' });
    console.log(`ok  ${namn}`);
  } catch (e) {
    tester.push({ namn: PREFIX + namn, status: 'röd', fel: e.message.split('\n')[0] });
    console.log(`FEL ${namn}: ${e.message.split('\n')[0]}`);
    await felSida?.screenshot({ path: join(UT, `00-fel-avbrott-${++felNr}.png`), fullPage: true }).catch(() => {});
  }
}

const anta = (villkor, text) => { if (!villkor) throw new Error(text); };
const bild = async (page, namn) => { await page.waitForTimeout(250); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: join(UT, `${namn}.png`) }); };
async function synlig(page, sel, text) {
  const l = page.locator(sel).filter({ hasText: text }).first();
  await l.waitFor({ state: 'visible', timeout: 10000 });
  return l;
}
async function loggaIn(page, id) {
  await page.goto(`${BAS}/#/`);
  await page.waitForLoadState('networkidle');
  if (await page.locator('[data-a="loggaut"]').count()) await page.click('[data-a="loggaut"]');
  await page.click(`[data-roll="${id}"]`);
  await page.waitForSelector('[data-a="loggaut"]');
  await page.waitForSelector('main h1');
}
// Väntar tills läskopian är sparad i IndexedDB efter tidpunkten efter.
async function vantaPaKopia(page, efter = '') {
  await page.waitForFunction((e) => (document.documentElement.dataset.laskopia ?? '') > e, efter, { timeout: 10000 });
  return page.evaluate(() => document.documentElement.dataset.laskopia);
}
// Läser IndexedDB och sessionStorage i sidan.
const lagrat = (page) => page.evaluate(async () => {
  const db = await new Promise((ja, nej) => { const q = indexedDB.open('vardkallan-lasekopia'); q.onsuccess = () => ja(q.result); q.onerror = () => nej(q.error); });
  const poster = db.objectStoreNames.contains('poster')
    ? await new Promise((ja) => { const q = db.transaction('poster').objectStore('poster').getAll(); q.onsuccess = () => ja(q.result); })
    : [];
  db.close();
  return { poster: poster.map(p => ({ id: p.id, falt: Object.keys(p).sort() })), nyckel: sessionStorage.getItem('vk_lasnyckel') };
});

(async () => {
  const browser = await chromium.launch();
  const ny = () => browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  const ctx = await ny();
  const page = await ctx.newPage();
  felSida = page;
  bevaka(page, 'sara');
  let kopiaTid = '';

  try {
    await loggaIn(page, 'lak-kard');
    await page.click('a.patientlank:has-text("Gunnar Åkesson")');
    await page.waitForSelector('.tidslinje');
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    kopiaTid = await vantaPaKopia(page);
  } catch (e) { sidfel.push(`förberedelsen misslyckades: ${e.message.split('\n')[0]}`); }

  await test('läskopian i webbläsaren är krypterad och nyckeln ligger inte i IndexedDB', async () => {
    const r = await page.evaluate(async () => {
      const db = await new Promise((ja, nej) => { const q = indexedDB.open('vardkallan-lasekopia'); q.onsuccess = () => ja(q.result); q.onerror = () => nej(q.error); });
      const poster = await new Promise((ja) => { const q = db.transaction('poster').objectStore('poster').getAll(); q.onsuccess = () => ja(q.result); });
      db.close();
      const n = JSON.parse(sessionStorage.getItem('vk_lasnyckel'));
      const k = poster.find(p => p.id === 'kopia');
      const data = new Uint8Array(k.data);
      const somText = new TextDecoder('utf-8', { fatal: false }).decode(data);
      const meta = JSON.stringify({ ...k, data: undefined, iv: Array.from(k.iv) });
      const radNyckel = Uint8Array.from(atob(n.nyckel.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const innehaller = (hela, del) => { outer: for (let i = 0; i + del.length <= hela.length; i++) { for (let j = 0; j < del.length; j++) if (hela[i + j] !== del[j]) continue outer; return true; } return false; };
      const nyckel = await crypto.subtle.importKey('raw', radNyckel, 'AES-GCM', false, ['decrypt']);
      const aad = (s) => new TextEncoder().encode(`vardkallan-lasekopia|kopia|${k.personalId}|${s}|${k.giltigTill}`);
      const klar = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: k.iv, additionalData: aad(k.skapad) }, nyckel, k.data));
      let andradMetaGarAttLasa = true;
      try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: k.iv, additionalData: aad('2020-01-01T00:00:00.000Z') }, nyckel, k.data); } catch { andradMetaGarAttLasa = false; }
      const allaPoster = JSON.stringify(poster.map(p => ({ ...p, data: Array.from(new Uint8Array(p.data)).join(','), iv: Array.from(p.iv).join(',') })));
      return {
        falt: Object.keys(k).sort(), ivLangd: k.iv.length, bytes: data.length,
        klartextIData: ['Åkesson', 'Waran', 'Gunnar', 'Penicillin'].filter(t => somText.includes(t) || meta.includes(t)),
        nyckelIDb: allaPoster.includes(n.nyckel) || poster.some(p => innehaller(new Uint8Array(p.data), radNyckel)),
        dekrypterad: ['Gunnar Åkesson', 'Waran'].every(t => klar.includes(t)), andradMetaGarAttLasa, personalId: k.personalId,
      };
    });
    anta(JSON.stringify(r.falt) === JSON.stringify(['data', 'giltigTill', 'id', 'iv', 'personalId', 'skapad']), `fälten i IndexedDB är ${r.falt}`);
    anta(r.ivLangd === 12, 'IV är inte 12 byte');
    anta(r.klartextIData.length === 0, `klartext i IndexedDB: ${r.klartextIData}`);
    anta(!r.nyckelIDb, 'nyckeln finns i IndexedDB');
    anta(r.dekrypterad, 'chiffertexten gick inte att dekryptera med nyckeln till läskopian');
    anta(!r.andradMetaGarAttLasa, 'ändrad metadata gick att dekryptera');
    anta(r.personalId === 'lak-kard', 'fel person i metadata');
    console.log(`    läskopian är ${r.bytes} byte chiffertext`);
  });

  await test('appen startar utan nät från service workern och visar läsläget', async () => {
    await ctx.setOffline(true);
    offline = true;
    await page.reload();
    await synlig(page, '#avbrott h2', 'Avbrott: läsläge');
    const tid = await page.locator('[data-laskopia-tid]').textContent();
    anta(/kl\. \d\d:\d\d/.test(tid), `tidpunkten för läskopian visas inte: ${tid}`);
    await synlig(page, '#avbrott', 'Uppgifterna kan vara inaktuella');
    await synlig(page, '.inloggad', 'Sara Lindqvist');
    await page.goto(`${BAS}/#/arbetslista`);
    await synlig(page, '#lista', 'Gunnar Åkesson');
    await page.goto(`${BAS}/#/patient/p01`);
    await synlig(page, '.patientband h1', 'Gunnar Åkesson');
    await page.waitForSelector('.tidslinje');
    await synlig(page, '#ov-lm', 'Aktuella läkemedel');
    await bild(page, '32-avbrott-laslage');
    await page.click('.flikar a:has-text("Läkemedel")');
    await synlig(page, '.lm-tabell', 'Waran');
    await page.click('.flikar a:has-text("Journal")');
    await page.waitForSelector('.anteckning .ant-fakta');
  });

  await test('skrivande är avstängt i läsläget med en förklaring', async () => {
    await synlig(page, '#avbrott', 'Allt skrivande är avstängt');
    anta(!(await page.locator('a:has-text("Ny anteckning")').isVisible()), 'Ny anteckning syns i läsläget');
    await page.click('.flikar a:has-text("Läkemedel")');
    await page.waitForSelector('.lm-tabell');
    anta(await page.locator('[data-ny]').isDisabled(), 'Ordinera går att klicka på');
    anta(await page.locator('[data-utsatt]').first().isDisabled(), 'Sätt ut går att klicka på');
    anta(await page.locator('[data-a="aterstall"]').isDisabled(), 'Återställ demon går att klicka på');
    const titel = await page.locator('[data-ny]').getAttribute('title');
    anta(/Avstängt under avbrottet/.test(titel ?? ''), `ingen förklaring på knappen: ${titel}`);
    await bild(page, '33-avbrott-skrivning-avstangd');
    await page.goto(`${BAS}/#/patient/p01/journal/ny`);
    await page.waitForSelector('.ant-form textarea');
    anta(await page.locator('.ant-form textarea').first().isDisabled(), 'anteckningsformuläret går att skriva i');
    anta(await page.locator('.ant-form [data-signera]').isDisabled(), 'Signera går att klicka på');
    // Ett försök att skriva direkt mot API:t stoppas i klienten med en förklaring.
    const svar = await page.evaluate(async () => {
      const { api } = await import('/js/ui.js');
      try { await api('/api/patient/p01/matvarden', { metod: 'POST', data: { typ: 'puls', varde: 70 } }); return 'skickades'; } catch (e) { return `${e.kod}: ${e.message}`; }
    });
    anta(svar.startsWith('laslage: Under avbrottet går det inte att spara'), `skrivningen gav ${svar}`);
    await page.goto(`${BAS}/#/patient/p12`);
    await synlig(page, 'main', 'Patienten finns inte i läskopian');
    await page.goto(`${BAS}/#/patient/p01`);
    await page.waitForSelector('.tidslinje');
  });

  await test('åtkomster i läsläget når åtkomstloggen när servern svarar igen', async () => {
    const lokala = await page.evaluate(async () => (await import('/js/lasekopia.js')).hamtaLogg());
    anta(lokala.length >= 5, `bara ${lokala.length} lokala loggrader`);
    anta(lokala.every(r => r.patientId === 'p01'), 'lokala loggrader för andra patienter än p01');
    await ctx.setOffline(false);
    offline = false;
    await synlig(page, '.notis', 'Servern svarar igen');
    await page.locator('#avbrott').waitFor({ state: 'hidden' });
    const kvar = await page.evaluate(async () => (await import('/js/lasekopia.js')).hamtaLogg());
    anta(kvar.length === 0, `${kvar.length} loggrader finns kvar lokalt`);
    anta(!(await page.locator('[data-ny]').count()) || !(await page.locator('[data-ny]').isDisabled()), 'knappar är fortfarande avstängda');
    // Logggranskaren i samma sandlåda ser åtkomsterna från läsläget.
    const ctxLogg = page.context();
    const r = await ctxLogg.request.post(`${BAS}/api/login`, { data: { personalId: 'logg' } });
    anta(r.ok(), 'logggranskaren kunde inte logga in');
    const ll = await (await ctxLogg.request.get(`${BAS}/api/patient/p01/logglista`)).json();
    const fran = ll.rader.filter(x => x.resurs?.startsWith('laslage:'));
    anta(fran.length === lokala.length, `${fran.length} rader från läsläget i loggen, ${lokala.length} lokalt`);
    anta(fran.every(x => x.personal?.id === 'lak-kard' && x.syfte?.startsWith('Läsläge vid avbrott')), 'raderna har fel person eller syfte');
    anta(ll.kedjaHel, 'loggkedjan är inte hel');
    await loggaIn(page, 'logg');
    await page.goto(`${BAS}/#/logg/patient/p01`);
    await synlig(page, '.logg-tabell', 'Läsläge vid avbrott');
    await bild(page, '34-logg-laslage');
  });

  await test('simulerat avbrott ger läsläge medan servern svarar andra besökare', async () => {
    await loggaIn(page, 'lak-kard');
    await page.click('a.patientlank:has-text("Gunnar Åkesson")');
    await page.waitForSelector('.tidslinje');
    kopiaTid = await vantaPaKopia(page, kopiaTid);
    const anrop = [];
    const lyssna = (req) => { const u = new URL(req.url()); if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/fhir')) anrop.push(u.pathname); };
    await page.click('[data-a="avbrott"]');
    page.on('request', lyssna);
    await synlig(page, '#avbrott h2', 'Avbrott: läsläge');
    await synlig(page, '#avbrott', 'Avbrottet är simulerat i den här fliken');
    await page.goto(`${BAS}/#/patient/p01/lakemedel`);
    await synlig(page, '.lm-tabell', 'Waran');
    await page.reload();
    await synlig(page, '#avbrott h2', 'Avbrott: läsläge');
    await synlig(page, '.lm-tabell', 'Waran');
    anta(!(await page.locator('[data-a="avbrott"]').isVisible()), 'knappen Simulera avbrott syns under det simulerade avbrottet');
    await page.click('#meny-lista a[href="#/arbetslista"]');
    await synlig(page, '#lista', 'Gunnar Åkesson');
    page.off('request', lyssna);
    anta(anrop.length === 0, `sidan anropade servern under det simulerade avbrottet: ${anrop}`);
    await bild(page, '35-simulerat-avbrott');
    // En annan besökare når servern som vanligt.
    const annan = await ny();
    const ap = await annan.newPage();
    bevaka(ap, 'annan');
    await loggaIn(ap, 'lak-vc');
    await synlig(ap, '#lista', 'Gunnar Åkesson');
    anta(!(await ap.locator('#avbrott').isVisible()), 'den andra besökaren ser läsläget');
    await annan.close();
    await page.click('[data-avbrott="avsluta"]');
    await synlig(page, '.notis', 'Servern svarar igen');
    await page.locator('#avbrott').waitFor({ state: 'hidden' });
  });

  await test('läskopian rensas vid utloggning', async () => {
    const fore = await lagrat(page);
    anta(fore.poster.some(p => p.id === 'kopia') && fore.nyckel, 'ingen läskopia före utloggningen');
    await page.click('[data-a="loggaut"]');
    await page.waitForSelector('[data-roll]');
    await page.waitForTimeout(300);
    const efter = await lagrat(page);
    anta(efter.poster.length === 0, `kvar i IndexedDB: ${efter.poster.map(p => p.id)}`);
    anta(efter.nyckel === null, 'nyckeln finns kvar i sessionStorage');
    anta(!(await page.evaluate(() => document.documentElement.dataset.laskopia)), 'sidan visar fortfarande en läskopia');
    // Utan inloggning och utan kopia ger ett avbrott inget läsläge med patientuppgifter.
    await ctx.setOffline(true);
    offline = true;
    await page.reload();
    await synlig(page, '#avbrott h2', 'servern svarar inte');
    await synlig(page, '#avbrott', 'Det finns ingen läskopia');
    await ctx.setOffline(false);
    offline = false;
  });

  await test('utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs', async () => {
    const inloggad = async (c) => (await (await c.request.get(`${BAS}/api/session`)).json()).inloggad;
    // Simulerat avbrott: servern svarar, så sessionen loggas ut direkt.
    const c1 = await ny();
    const p1 = await c1.newPage();
    await loggaIn(p1, 'lak-kard');
    await vantaPaKopia(p1);
    await p1.click('[data-a="avbrott"]');
    await synlig(p1, '#avbrott h2', 'Avbrott: läsläge');
    await p1.click('[data-a="loggaut"]');
    await synlig(p1, '.notis', 'Du är utloggad och läskopian är raderad');
    anta(!(await inloggad(c1)), 'sessionen är kvar på servern efter utloggning under simulerat avbrott');
    await c1.close();
    // Riktigt avbrott och fliken stängs: nästa start loggar ut sessionen innan den används.
    const c2 = await ny();
    const p2 = await c2.newPage();
    await loggaIn(p2, 'lak-kard');
    await vantaPaKopia(p2);
    await c2.setOffline(true);
    await p2.reload();
    await synlig(p2, '#avbrott h2', 'Avbrott: läsläge');
    await p2.click('[data-a="loggaut"]');
    await synlig(p2, '.notis', 'loggas ut när förbindelsen är tillbaka');
    anta(await p2.evaluate(() => localStorage.getItem('vk_utloggad_under_avbrott')) === '1', 'den väntande utloggningen sparades inte');
    await p2.close();
    await c2.setOffline(false);
    anta(await inloggad(c2), 'kontrollen: sessionen borde finnas kvar på servern innan sidan öppnas igen');
    const p3 = await c2.newPage();
    await p3.goto(`${BAS}/#/`);
    await p3.waitForSelector('[data-roll]');
    await p3.waitForTimeout(300);
    anta(!(await inloggad(c2)), 'sessionen användes igen efter att fliken stängts under avbrottet');
    anta(await p3.evaluate(() => localStorage.getItem('vk_utloggad_under_avbrott')) === null, 'den väntande utloggningen togs inte bort');
    await c2.close();
  });

  await test('läskopian används inte efter 8 timmar', async () => {
    const c = await ny();
    const p = await c.newPage();
    bevaka(p, 'klocka');
    await p.clock.install();
    await loggaIn(p, 'lak-kard');
    await vantaPaKopia(p);
    anta((await lagrat(p)).poster.some(x => x.id === 'kopia'), 'ingen läskopia sparades');
    await p.clock.setSystemTime(new Date(Date.now() + 8 * 3600_000 + 60_000));
    await p.click('[data-a="avbrott"]');
    await synlig(p, '#avbrott h2', 'servern svarar inte');
    await synlig(p, '#avbrott', 'Det finns ingen läskopia');
    const efter = await lagrat(p);
    anta(!efter.poster.some(x => x.id === 'kopia'), 'den gamla läskopian finns kvar i IndexedDB');
    await c.close();
  });

  const version = browser.version();
  await browser.close();
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const resultat = { tid: new Date().toISOString(), bas: BAS, webblasare: `Chromium ${version}`, gransnittHash: gransnittHash(join(APP, 'public')), tester };
  writeFileSync(join(APP, 'klienttest-resultat.json'), `${JSON.stringify(resultat, null, 2)}\n`);
  const roda = tester.filter(t => t.status !== 'grön');
  console.log(`\nAvbrott: ${tester.length - roda.length} av ${tester.length} gröna. Resultatet finns i app/klienttest-resultat.json`);
  if (sidfel.length) console.log(`Sidfel och konsolfel:\n  ${sidfel.join('\n  ')}`);
  process.exit(roda.length || sidfel.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
