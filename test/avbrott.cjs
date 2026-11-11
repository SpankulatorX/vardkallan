// Tester av läsläget vid avbrott (D4) i en riktig webbläsare med Playwright. Resultatet skrivs till
// app/klienttest-resultat.json, som /api/krav läser, tillsammans med en hash av app/public. Testerna från
// test/anvandartest.cjs i samma fil behålls (test/klienttester.cjs). Ändras gränssnittet
// efteråt räknas testerna som inaktuella tills skriptet körs igen.
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/avbrott.cjs [bas-url]
// Standard för bas-url är http://127.0.0.1:18797. 127.0.0.1 räknas som säker kontext, så service workern fungerar.
//
// Ett riktigt avbrott görs med webbläsarens offlineläge (context.setOffline), så att varken sidan eller service
// workern når servern. Servern stoppas aldrig. Under offlineläget skriver webbläsaren nätverksfel i konsolen; de
// räknas inte som fel. Alla sidfel räknas som fel, och konsolfel när webbläsaren är uppkopplad.

const { chromium, request: playwrightRequest } = require('@playwright/test');
const { mkdirSync, readdirSync, rmSync, mkdtempSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { skrivKlienttester } = require('./klienttester.cjs');

const BAS = process.argv[2] || 'http://127.0.0.1:18797';
// Runda 11: testprocessen följer testcontainerns falska klocka, om den har en. Webbläsarens klocka ställs av testerna
// själva där de behöver den (clock.install), så den ställs inte här.
const { foljServernsKlocka } = require('./testklocka.cjs');
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
// Runda 10, r1: AVBROTT_BARA=<del av namnet> kör bara de testerna, för felsökning. Resultatet skrivs då inte.
const BARA = process.env.AVBROTT_BARA || null;
async function test(namn, fn) {
  if (BARA && !namn.includes(BARA)) return;
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
// Läser IndexedDB och sessionStorage i sidan: posterna i varje förråd med fälten.
const lagrat = (page) => page.evaluate(async () => {
  const db = await new Promise((ja, nej) => { const q = indexedDB.open('vardkallan-lasekopia'); q.onsuccess = () => ja(q.result); q.onerror = () => nej(q.error); });
  const las = (namn) => (db.objectStoreNames.contains(namn)
    ? new Promise((ja) => { const q = db.transaction(namn).objectStore(namn).getAll(); q.onsuccess = () => ja(q.result); })
    : Promise.resolve([]));
  const [poster, reserv, logg] = [await las('poster'), await las('reserv'), await las('logg')];
  db.close();
  const kort = (x) => ({ id: x.id ?? x.personalId, falt: Object.keys(x).sort() });
  return { poster: poster.map(kort), reserv: reserv.map(kort), logg: logg.map(kort), nyckel: sessionStorage.getItem('vk_lasnyckel') };
});
// Reservkoder i testerna. Johans är en lösenfras med å, ä och ö.
const KOD_SARA = '246813';
const KOD_JOHAN = 'blå häst i snön';
async function valjReservkod(page, kod) {
  await page.click('[data-a="reservkod"]');
  const dl = page.locator('dialog[open]');
  await dl.waitFor();
  await dl.locator('#dlg-kod').fill(kod);
  await dl.locator('#dlg-kod2').fill(kod);
  await dl.locator('[data-varde="spara"]').click();
  await synlig(page, '.notis', 'Reservkoden är sparad');
  await synlig(page, '[data-a="reservkod"]', 'Reservkopia till');
}
// Väljer personen i reservinloggningen och skickar koden. Ger texten i felrutan, eller null när läsläget öppnades.
async function reservInloggning(page, id, kod) {
  const form = page.locator(`form[data-personal="${id}"]`);
  if (await form.isHidden()) await page.click(`[data-reserv="${id}"]`);
  await form.locator('input[name="kod"]').fill(kod);
  await form.locator('button[type="submit"]').click();
  const fel = form.locator('.form-fel');
  const ok = page.locator('#avbrott h2', { hasText: 'läsläge med reservkod' });
  const borta = page.locator('.ruta-larm');
  await Promise.race([fel.waitFor({ state: 'visible', timeout: 15000 }), ok.waitFor({ timeout: 15000 }), borta.waitFor({ timeout: 15000 })]).catch(() => {});
  if (await ok.count()) return null;
  if (await borta.count()) return (await borta.textContent()) ?? '';
  return (await fel.textContent()) ?? '';
}
// Undersöker allt som lagras i webbläsaren: IndexedDB, localStorage och sessionStorage. Letar efter reservkoden,
// läskopians nyckel i klartext och patientuppgifter i klartext, och prövar att packa upp nyckeln med koden.
const undersok = (page, kod, nyckelB64) => page.evaluate(async ({ kod, nyckelB64 }) => {
  const db = await new Promise((ja, nej) => { const q = indexedDB.open('vardkallan-lasekopia'); q.onsuccess = () => ja(q.result); q.onerror = () => nej(q.error); });
  const las = (namn) => new Promise((ja) => { const q = db.transaction(namn).objectStore(namn).getAll(); q.onsuccess = () => ja(q.result); });
  const forrad = { poster: await las('poster'), reserv: await las('reserv'), logg: await las('logg') };
  db.close();
  const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const franB64 = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const binar = [];
  const text = [];
  const ga = (v) => {
    if (v instanceof ArrayBuffer) binar.push(new Uint8Array(v));
    else if (ArrayBuffer.isView(v)) binar.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    else if (typeof v === 'string') text.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(ga);
  };
  ga(forrad);
  for (let i = 0; i < localStorage.length; i++) text.push(localStorage.key(i), localStorage.getItem(localStorage.key(i)));
  // sessionStorage har flikens nyckel med avsikt, så där letas bara efter reservkoden.
  const flik = [];
  for (let i = 0; i < sessionStorage.length; i++) flik.push(sessionStorage.key(i), sessionStorage.getItem(sessionStorage.key(i)));
  const innehaller = (hela, del) => { yttre: for (let i = 0; i + del.length <= hela.length; i++) { for (let j = 0; j < del.length; j++) if (hela[i + j] !== del[j]) continue yttre; return true; } return false; };
  const kodBytes = new TextEncoder().encode(kod);
  const radNyckel = nyckelB64 ? franB64(nyckelB64) : null;
  const avkodad = binar.map(u => new TextDecoder('utf-8', { fatal: false }).decode(u));
  const r = forrad.reserv[0];
  let ickeExporterbar = null;
  let felKodGarInte = null;
  if (r) {
    const aad = new TextEncoder().encode(`vardkallan-reservkod|${r.personalId}|${r.kopiaId}|${r.giltigTill}|${b64(r.salt)}|${r.iterationer}`);
    const packaUpp = async (k) => {
      const bas = await crypto.subtle.importKey('raw', new TextEncoder().encode(k.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
      const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: r.salt, iterations: r.iterationer }, bas, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
      return crypto.subtle.unwrapKey('raw', r.inslagen, kek, { name: 'AES-GCM', iv: r.wrapIv, additionalData: aad }, 'AES-GCM', false, ['decrypt']);
    };
    ickeExporterbar = (await packaUpp(kod)).extractable === false;
    try { await packaUpp(`${kod}9`); felKodGarInte = false; } catch { felKodGarInte = true; }
  }
  // Loggens metadata i klartext (id och läskopians id) får inte innehålla patientuppgifter.
  const loggMeta = JSON.stringify(forrad.logg.map(x => ({ id: x.id, kopiaId: x.kopiaId })));
  return {
    antal: Object.fromEntries(Object.entries(forrad).map(([k, v]) => [k, v.length])),
    falt: { reserv: r ? Object.keys(r).sort() : [], logg: forrad.logg[0] ? Object.keys(forrad.logg[0]).sort() : [] },
    reserv: r ? { personalId: r.personalId, namn: r.namn, saltLangd: r.salt.length, iterationer: r.iterationer, inslagenLangd: r.inslagen.byteLength, ivLangd: r.wrapIv.length } : null,
    koden: [...text, ...flik].some(t => t.includes(kod)) || binar.some(u => innehaller(u, kodBytes)),
    radNyckel: radNyckel ? (text.some(t => t.includes(nyckelB64)) || binar.some(u => innehaller(u, radNyckel))) : null,
    // Korta ord kan finnas av en slump i chiffertext, så de söks bara i metadata.
    klartext: [...['Åkesson', 'Waran', 'Gunnar', 'las_oversikt', 'las_lakemedel'].filter(t => avkodad.some(a => a.includes(t))), ...['p01', 'las_'].filter(t => loggMeta.includes(t))],
    ickeExporterbar, felKodGarInte,
  };
}, { kod, nyckelB64 });

(async () => {
  await foljServernsKlocka(BAS);
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
      const aad = (s) => new TextEncoder().encode(`vardkallan-lasekopia|kopia|${k.kopiaId}|${k.personalId}|${s}|${k.giltigTill}`);
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
    anta(JSON.stringify(r.falt) === JSON.stringify(['data', 'giltigTill', 'id', 'iv', 'kopiaId', 'personalId', 'skapad']), `fälten i IndexedDB är ${r.falt}`);
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
    const r = await ctxLogg.request.post(`${BAS}/api/login`, { data: { personalId: 'logg' }, headers: { Origin: BAS } });
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

  // Läskopians läkemedelsdel (Sussa 11.2.1.8). Klockan i fliken styrs av testet. Ingen gör något i fliken: Waran sätts
  // ut från en annan flik med samma inloggning, så att fliken bara får veta det genom att läskopian förnyas av sig själv.
  const lmCtx = await ny();
  const lm = await lmCtx.newPage();
  bevaka(lm, 'läkemedel');
  await test('läskopian förnyas av sig själv medan personen är inloggad', async () => {
    felSida = lm;
    await lm.clock.install();
    await loggaIn(lm, 'lak-kard');
    await lm.click('a.patientlank:has-text("Gunnar Åkesson")');
    await lm.waitForSelector('.tidslinje');
    await vantaPaKopia(lm);
    await lm.waitForLoadState('networkidle');
    await lm.waitForTimeout(1000);
    const forsta = await lm.evaluate(() => document.documentElement.dataset.laskopia);
    const lista = await (await lmCtx.request.get(`${BAS}/api/patient/p01/lakemedel`)).json();
    const waran = lista.ordinationer.find(o => o.aktuell && o.lakemedel?.namn.startsWith('Waran'));
    anta(waran, 'Waran finns inte bland de aktuella ordinationerna');
    const ut = await lmCtx.request.post(`${BAS}/api/ordination/${waran.id}/utsatt`, { data: { orsak: 'Byte till annat antikoagulantia', plan: { typ: 'byte' } }, headers: { Origin: BAS } });
    anta(ut.ok(), `utsättningen gick inte: ${ut.status()}`);
    await lm.waitForTimeout(1000);
    anta(await lm.evaluate(() => document.documentElement.dataset.laskopia) === forsta, 'läskopian förnyades innan klockan gick fram');
    // Fyra och en halv minut utan att någon gör något.
    await lm.clock.fastForward('04:30');
    const andra = await vantaPaKopia(lm, forsta);
    anta(andra > forsta, 'läskopian förnyades inte av sig själv');
    console.log(`    läskopian förnyades av sig själv: ${forsta} och ${andra}`);
  });

  await test('läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter', async () => {
    felSida = lm;
    await lm.click('[data-a="avbrott"]');
    await synlig(lm, '#avbrott h2', 'Avbrott: läsläge');
    await synlig(lm, '#avbrott [data-lm-alder="alla"]', 'Läkemedelsuppgifterna');
    await lm.click('.flikar a:has-text("Läkemedel")');
    const rad = await synlig(lm, '[data-lm-alder="p01"]', 'Läkemedelsuppgifterna hämtades kl.');
    const text = (await rad.textContent()) ?? '';
    anta(/kl\. \d\d:\d\d, för mindre än en minut sedan/.test(text), `åldern visas inte: ${text}`);
    anta(!/gammal/.test((await rad.getAttribute('class')) ?? ''), 'varnar fast uppgifterna är nya');
    // Utsättningen från den andra fliken finns i läskopian.
    await synlig(lm, 'section[aria-labelledby="lm-utsatt"]', 'Waran');
    anta(!(await lm.locator('section[aria-labelledby="lm-akt"]').filter({ hasText: 'Waran' }).count()), 'Waran står kvar bland de aktuella ordinationerna');
    await bild(lm, '42-laslage-lakemedel-alder');
    // Medan avbrottet pågår blir uppgifterna äldre, och texten följer med.
    await lm.clock.fastForward('06:00');
    await synlig(lm, '[data-lm-alder="p01"]', 'för 6 minuter sedan');
    anta(!(await lm.locator('[data-lm-alder].gammal').count()), 'varnar innan uppgifterna är 10 minuter gamla');
    await lm.clock.fastForward('05:00');
    const gammal = await synlig(lm, '[data-lm-alder="p01"].gammal', 'äldre än 10 minuter');
    anta(/för 11 minuter sedan/.test((await gammal.textContent()) ?? ''), 'åldern i varningen stämmer inte');
    await synlig(lm, '#avbrott [data-lm-alder="alla"].gammal', 'äldre än 10 minuter');
    await bild(lm, '43-laslage-lakemedel-gammal');
    // Översikten visar samma sak för patienten.
    await lm.click('.flikar a:has-text("Översikt")');
    await synlig(lm, 'section[aria-labelledby="ov-lm"] [data-lm-alder="p01"].gammal', 'äldre än 10 minuter');
    // Utanför läsläget visas ingen ålder.
    await lm.click('[data-avbrott="avsluta"]');
    await synlig(lm, '.notis', 'Servern svarar igen');
    await lm.locator('#avbrott').waitFor({ state: 'hidden' });
    await lm.waitForSelector('section[aria-labelledby="ov-lm"]');
    await lm.waitForTimeout(500);
    anta(!(await lm.locator('[data-lm-alder]').count()), 'åldern visas utanför läsläget');
  });
  await lmCtx.close();

  // Reservinloggning (D4). En webbläsarprofil på disken, så att en riktig omstart av webbläsaren kan göras: då är
  // sessionStorage och sessionskakan borta, men IndexedDB, service workern och dess cache finns kvar.
  const profil = mkdtempSync(join(tmpdir(), 'vk-avbrott-profil-'));
  let pctx = null;
  let pr = null;
  let gammalKaka = null;
  let lokalaRader = 0;
  const startaProfil = async (utanNat = false) => {
    pctx = await chromium.launchPersistentContext(profil, { viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
    if (utanNat) { await pctx.setOffline(true); offline = true; }
    pr = pctx.pages()[0] ?? await pctx.newPage();
    bevaka(pr, 'profil');
    felSida = pr;
  };
  const raknaLogg = async () => (await lagrat(pr)).logg.length;

  await test('reservkoden väljs när webbläsaren är uppkopplad och bara den inslagna nyckeln sparas', async () => {
    await startaProfil();
    await loggaIn(pr, 'lak-kard');
    await pr.click('a.patientlank:has-text("Gunnar Åkesson")');
    await pr.waitForSelector('.tidslinje');
    await pr.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    await vantaPaKopia(pr);
    await synlig(pr, '[data-a="reservkod"]', 'Reservkod');
    // För kort kod och olika koder stoppas i dialogen.
    await pr.click('[data-a="reservkod"]');
    const dl = pr.locator('dialog[open]');
    await dl.locator('#dlg-kod').fill('12345');
    await dl.locator('#dlg-kod2').fill('12345');
    await dl.locator('[data-varde="spara"]').click();
    await synlig(pr, 'dialog[open] .dialog-fel', 'minst 6 siffror');
    await dl.locator('#dlg-kod').fill(KOD_SARA);
    await dl.locator('#dlg-kod2').fill('246812');
    await dl.locator('[data-varde="spara"]').click();
    await synlig(pr, 'dialog[open] .dialog-fel', 'inte lika');
    await bild(pr, '37-reservkod-dialog');
    await dl.locator('[data-varde="avbryt"]').click();
    await valjReservkod(pr, KOD_SARA);
    const nyckel = JSON.parse(await pr.evaluate(() => sessionStorage.getItem('vk_lasnyckel'))).nyckel;
    const u = await undersok(pr, KOD_SARA, nyckel);
    anta(JSON.stringify(u.falt.reserv) === JSON.stringify(['enhet', 'forsok', 'giltigTill', 'inslagen', 'iterationer', 'kopia', 'kopiaId', 'namn', 'personalId', 'salt', 'skapad', 'titel', 'vantaTill', 'wrapIv']), `fälten i reservkopian är ${u.falt.reserv}`);
    anta(u.reserv.personalId === 'lak-kard' && u.reserv.namn === 'Sara Lindqvist', 'fel person i reservkopian');
    anta(u.reserv.saltLangd === 16 && u.reserv.ivLangd === 12 && u.reserv.iterationer >= 600000, `salt ${u.reserv.saltLangd}, iv ${u.reserv.ivLangd}, iterationer ${u.reserv.iterationer}`);
    anta(u.reserv.inslagenLangd === 48, `den inslagna nyckeln är ${u.reserv.inslagenLangd} byte`);
    anta(!u.koden, 'reservkoden finns i webbläsarens lagring');
    anta(!u.radNyckel, 'läskopians nyckel finns i klartext i IndexedDB');
    anta(u.klartext.length === 0, `klartext i lagringen: ${u.klartext}`);
    anta(u.ickeExporterbar, 'nyckeln som koden packar upp går att exportera');
    anta(u.felKodGarInte, 'fel kod packade upp nyckeln');
    gammalKaka = (await pctx.cookies()).find(c => c.name === 'vk_sid');
    anta(gammalKaka, 'ingen sessionskaka');
  });

  await test('efter omstart av webbläsaren utan nät visas vilka som har en reservkopia på datorn och när den går ut', async () => {
    await pctx.close();
    await startaProfil(true);
    await pr.goto(`${BAS}/`);
    await synlig(pr, 'main h1', 'Logga in med reservkod');
    await synlig(pr, '#avbrott h2', 'servern svarar inte');
    const rad = await synlig(pr, '#reservval li', 'Sara Lindqvist');
    const text = await rad.textContent();
    anta(/Går ut \d+ \w+ \d{4} kl\. \d\d:\d\d/.test(text), `utgångstiden visas inte: ${text}`);
    anta(!(await pr.locator('[data-roll]').count()), 'demorollerna visas fast servern inte svarar');
    await bild(pr, '38-reservinloggning');
  });

  await test('fel reservkod ger väntetid och rätt reservkod öppnar läsläget', async () => {
    const fel = await reservInloggning(pr, 'lak-kard', '111111');
    anta(/Fel reservkod\. 4 försök kvar/.test(fel ?? '') && /Vänta 2 sekunder/.test(fel), `felet var ${fel}`);
    anta(await pr.locator('form[data-personal="lak-kard"] input').inputValue() === '', 'koden ligger kvar i fältet');
    const vanta = await reservInloggning(pr, 'lak-kard', KOD_SARA);
    anta(/Vänta/.test(vanta ?? ''), `rätt kod under väntetiden gav ${vanta}`);
    await pr.waitForTimeout(2300);
    const ok = await reservInloggning(pr, 'lak-kard', KOD_SARA);
    anta(ok === null, `rätt kod gav ${ok}`);
    await synlig(pr, '.inloggad', 'Sara Lindqvist');
    await synlig(pr, '#lista', 'Gunnar Åkesson');
    await synlig(pr, '#avbrott', 'Du är inloggad med din reservkod');
    await bild(pr, '39-laslage-reservkod');
  });

  await test('åtkomster med reservkod loggas krypterat och överlever att fliken stängs', async () => {
    await pr.click('a.patientlank:has-text("Gunnar Åkesson")');
    await pr.waitForSelector('.tidslinje');
    await pr.click('.flikar a:has-text("Läkemedel")');
    await synlig(pr, '.lm-tabell', 'Waran');
    anta(await pr.locator('[data-ny]').isDisabled(), 'Ordinera går att klicka på med reservkod');
    await pr.click('.flikar a:has-text("Journal")');
    await pr.waitForSelector('.anteckning .ant-fakta');
    await pr.waitForTimeout(300);
    const u = await undersok(pr, KOD_SARA, null);
    lokalaRader = u.antal.logg;
    anta(lokalaRader >= 4, `bara ${lokalaRader} lokala loggrader`);
    anta(JSON.stringify(u.falt.logg) === JSON.stringify(['data', 'id', 'iv', 'kopiaId']), `fälten i loggen är ${u.falt.logg}`);
    anta(u.klartext.length === 0, `klartext i loggen: ${u.klartext}`);
    // Webbläsaren stängs mitt i läsläget. Loggen finns kvar, men läskopian kräver koden igen.
    await pctx.close();
    await startaProfil(true);
    await pr.goto(`${BAS}/`);
    await synlig(pr, 'main h1', 'Logga in med reservkod');
    anta(await raknaLogg() === lokalaRader, 'loggen från läsläget försvann när webbläsaren stängdes');
  });

  await test('när servern svarar igen mitt i läsläget med reservkod når åtkomsterna åtkomstloggen', async () => {
    anta(await reservInloggning(pr, 'lak-kard', KOD_SARA) === null, 'reservkoden fungerade inte efter omstarten');
    await pr.click('a.patientlank:has-text("Gunnar Åkesson")');
    await pr.waitForSelector('.tidslinje');
    await pr.waitForTimeout(300);
    lokalaRader = await raknaLogg();
    await pctx.setOffline(false);
    offline = false;
    await synlig(pr, '.notis', 'åtkomstloggen');
    await pr.locator('#avbrott').waitFor({ state: 'hidden' });
    anta(await raknaLogg() === 0, 'loggen finns kvar lokalt');
    // Sessionskakan försvann med omstarten, så personen loggar in igen.
    await synlig(pr, '.notis', 'Logga in för att fortsätta');
    await pr.waitForSelector('[data-roll]');
    // Logggranskaren i den gamla sandlådan ser åtkomsterna på Sara.
    const api = await playwrightRequest.newContext({ baseURL: BAS, extraHTTPHeaders: { Origin: BAS }, storageState: { cookies: [gammalKaka], origins: [] } });
    try {
      anta((await api.post('/api/login', { data: { personalId: 'logg' } })).ok(), 'logggranskaren kunde inte logga in');
      const ll = await (await api.get('/api/patient/p01/logglista')).json();
      const fran = ll.rader.filter(x => x.resurs?.startsWith('laslage:'));
      anta(fran.length === lokalaRader, `${fran.length} rader från läsläget i loggen, ${lokalaRader} lokalt`);
      anta(fran.every(x => x.personal?.id === 'lak-kard'), 'raderna har fel person');
      anta(ll.kedjaHel, 'loggkedjan är inte hel');
    } finally { await api.dispose(); }
  });

  await test('utloggning raderar reservkopian, den inslagna nyckeln och loggen efter att loggen förts över', async () => {
    await pr.click('[data-roll="lak-kard"]');
    await pr.waitForSelector('[data-a="loggaut"]');
    // Reservkopian från förra inloggningen går inte att förnya utan koden och tas bort.
    await synlig(pr, '.notis', 'reservkopia från förra inloggningen är raderad');
    anta((await lagrat(pr)).reserv.length === 0, 'den gamla reservkopian finns kvar');
    await pr.click('a.patientlank:has-text("Gunnar Åkesson")');
    await pr.waitForSelector('.tidslinje');
    await vantaPaKopia(pr);
    await valjReservkod(pr, KOD_SARA);
    await pr.click('[data-a="avbrott"]');
    await synlig(pr, '#avbrott h2', 'Avbrott: läsläge');
    await pr.click('.flikar a:has-text("Läkemedel")');
    await synlig(pr, '.lm-tabell', 'Waran');
    await pr.waitForTimeout(300);
    const fore = await lagrat(pr);
    anta(fore.reserv.length === 1 && fore.logg.length > 0, `före utloggningen: ${fore.reserv.length} reservkopior, ${fore.logg.length} loggrader`);
    await pr.click('[data-a="loggaut"]');
    await synlig(pr, '.notis', 'Du är utloggad');
    await pr.waitForTimeout(300);
    const efter = await lagrat(pr);
    anta(efter.reserv.length === 0 && efter.logg.length === 0 && efter.poster.length === 0 && efter.nyckel === null,
      `kvar efter utloggningen: ${JSON.stringify({ reserv: efter.reserv.length, logg: efter.logg.length, poster: efter.poster.length, nyckel: Boolean(efter.nyckel) })}`);
    await pctx.request.post(`${BAS}/api/login`, { data: { personalId: 'logg' }, headers: { Origin: BAS } });
    const ll = await (await pctx.request.get(`${BAS}/api/patient/p01/logglista`)).json();
    anta(ll.rader.filter(x => x.resurs?.startsWith('laslage:')).length === fore.logg.length, 'loggen fördes inte över före utloggningen');
    // Efter utloggningen finns ingen reservkopia att öppna.
    await pctx.request.post(`${BAS}/api/logout`, { data: {}, headers: { Origin: BAS } });
    await pctx.setOffline(true);
    offline = true;
    await pr.goto(`${BAS}/#/`);
    await pr.reload();
    await synlig(pr, '#reservval', 'Det finns ingen reservkopia på den här datorn');
    await pctx.setOffline(false);
    offline = false;
  });
  await pctx?.close().catch(() => {});
  rmSync(profil, { recursive: true, force: true });

  await test('utloggning i en flik avslutar läsläget i webbläsarens andra flikar', async () => {
    const c = await ny();
    const a = await c.newPage();
    bevaka(a, 'flik A');
    felSida = a;
    await loggaIn(a, 'lak-kard');
    await a.click('a.patientlank:has-text("Gunnar Åkesson")');
    await a.waitForSelector('.tidslinje');
    await a.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    await vantaPaKopia(a);
    const b = await c.newPage();
    bevaka(b, 'flik B');
    await b.goto(`${BAS}/#/patient/p01/lakemedel`);
    await synlig(b, '.lm-tabell', 'Waran');
    await vantaPaKopia(b);
    await c.setOffline(true);
    offline = true;
    await a.reload();
    await synlig(a, '#avbrott h2', 'Avbrott: läsläge');
    await b.reload();
    await synlig(b, '#avbrott h2', 'Avbrott: läsläge');
    await synlig(b, '.lm-tabell', 'Waran');
    await a.click('[data-a="loggaut"]');
    await synlig(a, '.notis', 'Du är utloggad');
    await synlig(b, '.notis', 'någon loggade ut i en annan flik');
    await synlig(b, 'main h1', 'Logga in med reservkod');
    anta(!(await b.locator('.inloggad').count()), 'flik B visar fortfarande personen');
    await b.goto(`${BAS}/#/patient/p01/lakemedel`);
    await synlig(b, 'main h1', 'Logga in med reservkod');
    anta(!(await b.locator('.lm-tabell').count()), 'flik B visar läkemedlen efter utloggningen');
    await c.setOffline(false);
    offline = false;
    await c.close();
  });

  await test('en navigering direkt till en fil ersätter inte appen i service workerns cache', async () => {
    const c = await ny();
    const p = await c.newPage();
    bevaka(p, 'cache');
    felSida = p;
    await p.goto(`${BAS}/`);
    await p.waitForSelector('[data-roll]');
    await p.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    await p.goto(`${BAS}/js/ui.js`);
    await c.setOffline(true);
    offline = true;
    await p.goto(`${BAS}/`);
    await synlig(p, 'main h1', 'Logga in med reservkod');
    await c.setOffline(false);
    offline = false;
    await c.close();
  });

  await test('fem fel reservkoder raderar reservkopian och flikar kan inte pröva samtidigt', async () => {
    const c = await ny();
    const p = await c.newPage();
    bevaka(p, 'fem fel');
    felSida = p;
    await p.clock.install();
    await loggaIn(p, 'ssk-kard');
    await p.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    await vantaPaKopia(p);
    await valjReservkod(p, KOD_JOHAN);
    // En ny flik utan nät har ingen nyckel i sessionStorage.
    await c.setOffline(true);
    offline = true;
    const p2 = await c.newPage();
    bevaka(p2, 'fem fel, ny flik');
    felSida = p2;
    await p2.goto(`${BAS}/`);
    await synlig(p2, 'main h1', 'Logga in med reservkod');
    // Två flikar prövar samtidigt: bara det ena försöket prövas, det andra får vänta.
    // Den tredje fliken bevakas bara för sidfel: dess nätverksfel utan nät kan komma efter att den stängts.
    const p3 = await c.newPage();
    p3.on('pageerror', e => sidfel.push(`[fem fel, tredje fliken] sidfel: ${e.message}`));
    await p3.goto(`${BAS}/`);
    await synlig(p3, 'main h1', 'Logga in med reservkod');
    const samtidigt = await Promise.all([reservInloggning(p2, 'ssk-kard', 'fel kod nummer 1'), reservInloggning(p3, 'ssk-kard', 'fel kod nummer 1b')]);
    anta(samtidigt.filter(x => /^Fel reservkod\. 4 försök kvar/.test(x ?? '')).length === 1 && samtidigt.filter(x => /^Vänta/.test(x ?? '')).length === 1, `samtidiga försök gav ${samtidigt}`);
    await p3.close();
    await p2.clock.setSystemTime(new Date(Date.now() + 60_000));
    for (let i = 2; i <= 4; i++) {
      const fel = await reservInloggning(p2, 'ssk-kard', `fel kod nummer ${i}`);
      anta(new RegExp(`Fel reservkod\\. (${5 - i} försök|Ett försök) kvar`).test(fel ?? ''), `försök ${i} gav ${fel}`);
      await p2.clock.setSystemTime(new Date(Date.now() + i * 120_000));
    }
    const sista = await reservInloggning(p2, 'ssk-kard', 'fel kod nummer 5');
    anta(/Reservkopian är raderad från datorn/.test(sista ?? ''), `femte försöket gav ${sista}`);
    await synlig(p2, '#reservval', 'Det finns ingen reservkopia på den här datorn');
    anta((await lagrat(p2)).reserv.length === 0, 'reservkopian finns kvar i IndexedDB');
    await c.setOffline(false);
    offline = false;
    await c.close();
  });

  await test('två personer på samma dator har var sin reservkopia som bara öppnas med egen kod', async () => {
    const c = await ny();
    const p = await c.newPage();
    bevaka(p, 'två personer');
    felSida = p;
    await loggaIn(p, 'lak-kard');
    await p.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    await vantaPaKopia(p);
    await valjReservkod(p, KOD_SARA);
    // Johan loggar in i samma webbläsare utan att Sara loggar ut i gränssnittet.
    await c.request.post(`${BAS}/api/login`, { data: { personalId: 'ssk-kard' }, headers: { Origin: BAS } });
    await p.reload();
    await synlig(p, '.inloggad', 'Johan Ek');
    await vantaPaKopia(p);
    await valjReservkod(p, KOD_JOHAN);
    await c.request.post(`${BAS}/api/logout`, { data: {}, headers: { Origin: BAS } });
    await p.reload();
    await p.waitForSelector('[data-roll]');
    await synlig(p, '#reservkopior', 'Reservkopior på den här datorn');
    for (const n of ['Sara Lindqvist', 'Johan Ek']) await synlig(p, '#reservkopior li', n);
    anta(/Går ut/.test(await p.locator('#reservkopior').textContent()), 'utgångstiden visas inte på inloggningssidan');
    await bild(p, '40-reservkopior-pa-datorn');
    await c.setOffline(true);
    offline = true;
    await p.reload();
    await synlig(p, '#reservval li', 'Johan Ek');
    const fel = await reservInloggning(p, 'ssk-kard', KOD_SARA);
    anta(/Fel reservkod/.test(fel ?? ''), `Saras kod till Johans reservkopia gav ${fel}`);
    await p.waitForTimeout(2300);
    anta(await reservInloggning(p, 'ssk-kard', KOD_JOHAN) === null, 'Johans kod öppnade inte hans reservkopia');
    await synlig(p, '.inloggad', 'Johan Ek');
    anta(!(await p.locator('.inloggad').textContent()).includes('Sara'), 'fel person i sidhuvudet');
    // Servern svarar igen medan Sara är inloggad i webbläsarens session. Johans reservläge tar inte över den.
    await c.request.post(`${BAS}/api/login`, { data: { personalId: 'lak-kard' }, headers: { Origin: BAS } });
    await c.setOffline(false);
    offline = false;
    await synlig(p, '.notis', 'någon annan är inloggad');
    await p.waitForSelector('[data-roll]');
    anta(!(await p.locator('.inloggad').count()), 'reservläget tog över en annan persons session');
    await c.close();
  });

  await test('simulerat avbrott visar reservinloggningen när fliken stängs i demon', async () => {
    const c = await ny();
    const p = await c.newPage();
    bevaka(p, 'demo');
    felSida = p;
    await loggaIn(p, 'lak-kard');
    await p.click('a.patientlank:has-text("Gunnar Åkesson")');
    await p.waitForSelector('.tidslinje');
    await p.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
    await vantaPaKopia(p);
    await p.click('[data-a="avbrott"]');
    await synlig(p, '#avbrott h2', 'Avbrott: läsläge');
    // Reservkoden går att välja också när avbrottet redan har börjat.
    await p.click('[data-avbrott="reservkod"]');
    const dl = p.locator('dialog[open]');
    await dl.locator('#dlg-kod').fill(KOD_SARA);
    await dl.locator('#dlg-kod2').fill(KOD_SARA);
    await dl.locator('[data-varde="spara"]').click();
    await synlig(p, '.notis', 'Reservkoden är sparad');
    await synlig(p, '#avbrott', 'Du har en reservkopia på datorn');
    await p.click('[data-avbrott="stang"]');
    await synlig(p, 'main h1', 'Logga in med reservkod');
    await synlig(p, '#avbrott', 'Avbrottet är simulerat');
    anta(await reservInloggning(p, 'lak-kard', KOD_SARA) === null, 'reservkoden öppnade inte läsläget');
    await p.click('#meny-lista a[href="#/arbetslista"]');
    await p.click('a.patientlank:has-text("Gunnar Åkesson")');
    await p.waitForSelector('.tidslinje');
    await p.click('.flikar a:has-text("Läkemedel")');
    await synlig(p, '.lm-tabell', 'Waran');
    await p.waitForTimeout(300);
    const rader = (await lagrat(p)).logg.length;
    anta(rader > 0, 'inga lokala loggrader');
    await bild(p, '41-simulerat-reservkod');
    await p.click('[data-avbrott="avsluta"]');
    await synlig(p, '.notis', 'Servern svarar igen');
    await p.locator('#avbrott').waitFor({ state: 'hidden' });
    // Samma person är inloggad i webbläsarens session, så arbetet fortsätter som vanligt.
    await synlig(p, '.inloggad', 'Sara Lindqvist');
    anta((await lagrat(p)).logg.length === 0, 'loggen finns kvar lokalt');
    // Runda 7, r1: inloggningen som logggranskare nedan delar sessionskaka med sidan. Sidan hämtar fortfarande journalen
    // och förnyar läskopian efter avbrottet, och ett sådant anrop som hann iväg efter bytet fick 403 och gav ibland ett
    // konsolfel. Sidan får bli klar och stängs därför först.
    await p.waitForLoadState('networkidle');
    await p.close();
    await c.request.post(`${BAS}/api/login`, { data: { personalId: 'logg' }, headers: { Origin: BAS } });
    const ll = await (await c.request.get(`${BAS}/api/patient/p01/logglista`)).json();
    anta(ll.rader.filter(x => x.resurs?.startsWith('laslage:')).length === rader, 'raderna från reservläget saknas i åtkomstloggen');
    await c.close();
  });

  // Runda 10, r1: skrivkön (Sussa 2.3.1.4). Sjuksköterskan ger en dos och registrerar ett mätvärde medan servern inte
  // svarar. Det sparas krypterat på datorn, märks som inte sparat och skickas när förbindelsen är tillbaka. En dos som
  // någon annan har gett under avbrottet blir en konflikt som hon själv avgör.
  {
    const c = await ny();
    const p = await c.newPage();
    bevaka(p, 'skrivko');
    felSida = p;
    const req = c.request;
    // En ordination vid behov för p01, så att testet inte beror på vilka dostider som har passerat i dag.
    const vidBehovFor = async () => (await (await req.get(`${BAS}/api/patient/p01/administreringar`)).json()).vidBehov;
    const antalGivna = async (oid) => (await (await req.get(`${BAS}/api/patient/p01/administreringar`)).json()).vidBehov.find(v => v.ordinationId === oid)?.senasteDygnet ?? 0;
    let oid = null;
    await test('en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka', async () => {
      await loggaIn(p, 'lak-kard');
      const lm = await (await req.get(`${BAS}/api/lakemedel/katalog?q=paracetamol`)).json();
      const lmId = lm.find(x => x.atc === 'N02BE01' && /tablett/i.test(x.form ?? ''))?.id ?? lm.find(x => x.atc === 'N02BE01')?.id;
      anta(lmId, 'hittade inget paracetamol i katalogen');
      const o = await req.post(`${BAS}/api/patient/p01/lakemedel`, { headers: { Origin: BAS }, data: { lakemedelId: lmId, ordinationsorsak: 'Smärta', dosering: '1 g vid behov, högst 4 gånger per dygn', typ: 'vid_behov', vidBehov: true, uppfoljningsdatum: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10) } });
      let od = await o.json();
      if (o.status() === 400 && od.kraverKvittens) {
        od = await (await req.post(`${BAS}/api/patient/p01/lakemedel`, { headers: { Origin: BAS }, data: { lakemedelId: lmId, ordinationsorsak: 'Smärta', dosering: '1 g vid behov, högst 4 gånger per dygn', typ: 'vid_behov', vidBehov: true, uppfoljningsdatum: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10), kvitteradeVarningar: od.kraverKvittens.map(regel => ({ regel, motivering: 'Prövat i testet av skrivkön.' })) } })).json();
      }
      oid = od.ordination?.id;
      anta(oid, `ordinationen kunde inte sparas: ${JSON.stringify(od).slice(0, 200)}`);
      await loggaIn(p, 'ssk-kard');
      await p.goto(`${BAS}/#/patient/p01/lakemedel`);
      await p.waitForSelector(`[data-adm="ge"][data-ord="${oid}"]`);
      const kopiaFore = await vantaPaKopia(p, '');
      // Läskopian förnyas efter ordinationen, så att dosen finns i den.
      await p.evaluate(async () => (await import('/js/avbrott.js')).fornyaNu());
      await vantaPaKopia(p, kopiaFore);
      await p.click('[data-a="avbrott"]');
      await synlig(p, '#avbrott h2', 'Avbrott: läsläge');
      await synlig(p, '#avbrott', 'utom att ge doser och registrera mätvärden');
      await p.goto(`${BAS}/#/patient/p01/lakemedel`);
      const ge = p.locator(`[data-adm="ge"][data-ord="${oid}"]`);
      await ge.waitFor();
      anta(!(await ge.isDisabled()), 'knappen Ge är avstängd under avbrottet');
      // Annat skrivande är fortfarande avstängt, till exempel att registrera att en dos inte gavs.
      const ejGiven = p.locator('[data-adm="ej_given"]').first();
      if (await ejGiven.count()) anta(await ejGiven.isDisabled(), 'Inte given går att klicka på under avbrottet');
      await ge.click();
      await synlig(p, '.notis', 'sparad i kön på den här datorn');
      await synlig(p, '[data-ej-sparad]', 'Inte sparad i journalen än');
      await p.click('.flikar a:has-text("Mätvärden")');
      await p.waitForSelector('#mv-form');
      await p.selectOption('#mv-typ', 'puls');
      await p.fill('#mv-varde', '88');
      await p.click('#mv-form [type=submit]');
      await synlig(p, '.notis', 'sparat i kön på den här datorn');
      await synlig(p, 'tr[data-ej-sparad]', 'Inte sparat i journalen än');
      await synlig(p, '#avbrott', '2 registreringar väntar i kön');
      // Kön är krypterad: inget i klartext i IndexedDB.
      const ko = await p.evaluate(async () => {
        const db = await new Promise((ja, nej) => { const q = indexedDB.open('vardkallan-lasekopia'); q.onsuccess = () => ja(q.result); q.onerror = () => nej(q.error); });
        const rader = await new Promise((ja) => { const q = db.transaction('ko').objectStore('ko').getAll(); q.onsuccess = () => ja(q.result); });
        db.close();
        const text = rader.map(r => new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(r.data))).join(' ');
        return { antal: rader.length, falt: rader[0] ? Object.keys(rader[0]).sort() : [], klartext: ['p01', 'puls', 'matvarde', 'ordinationId'].filter(t => text.includes(t)) };
      });
      anta(ko.antal === 2 && ko.klartext.length === 0, `kön i IndexedDB: ${JSON.stringify(ko)}`);
      anta(JSON.stringify(ko.falt) === JSON.stringify(['data', 'id', 'iv', 'kopiaId', 'skapad']), `fälten i kön är ${ko.falt}`);
      await bild(p, '42-avbrott-skrivko');
      await p.click('[data-avbrott="avsluta"]');
      await synlig(p, '.notis', '2 registreringar från avbrottet är nu sparade i journalen');
      const mv = await (await req.get(`${BAS}/api/patient/p01/matvarden`)).json();
      anta(mv.matvarden.some(m => m.typ === 'puls' && String(m.varde) === '88' && m.registreradAv?.namn === 'Johan Ek'), 'pulsen från kön finns inte i journalen');
      anta(await antalGivna(oid) === 1, `dosen från kön är given ${await antalGivna(oid)} gånger`);
      anta((await p.evaluate(async () => (await (await import('/js/lasekopia.js')).koRader()).length)) === 0, 'kön är inte tom');
    });

    await test('en dos som någon annan gav under avbrottet blir en konflikt som sjuksköterskan avgör, och dosen sparas inte två gånger', async () => {
      anta(oid, 'ordinationen från förra testet saknas');
      const kopiaFore = await p.evaluate(() => document.documentElement.dataset.laskopia ?? '');
      await p.evaluate(async () => (await import('/js/avbrott.js')).fornyaNu());
      await vantaPaKopia(p, kopiaFore);
      await p.click('[data-a="avbrott"]');
      await synlig(p, '#avbrott h2', 'Avbrott: läsläge');
      await p.goto(`${BAS}/#/patient/p01/lakemedel`);
      await p.locator(`[data-adm="ge"][data-ord="${oid}"]`).click();
      await synlig(p, '.notis', 'sparad i kön på den här datorn');
      // En kollega ger samma läkemedel på en annan dator medan den här fliken inte når servern.
      const g = await req.post(`${BAS}/api/patient/p01/administreringar`, { headers: { Origin: BAS }, data: { ordinationId: oid, atgard: 'ge', kvitteradeVarningar: [{ regel: 'dubbel_dos', motivering: 'Prövat i testet av skrivkön.' }] } });
      anta(g.ok(), `kollegans dos sparades inte: ${g.status()}`);
      anta(await antalGivna(oid) === 2, 'kollegans dos räknades inte');
      await p.click('[data-avbrott="avsluta"]');
      const dl = p.locator('dialog[open]');
      await dl.waitFor();
      await synlig(p, 'dialog[open]', 'Registrering från avbrottet');
      await synlig(p, 'dialog[open]', 'gavs senast');
      await bild(p, '43-avbrott-skrivko-konflikt');
      // Utan motivering går det inte att registrera, och sjuksköterskan tar bort dosen eftersom den inte gavs två gånger.
      await dl.locator('[data-varde="registrera"]').click();
      await synlig(p, 'dialog[open] .dialog-fel', 'motivering');
      await dl.locator('[data-varde="kasta"]').click();
      await synlig(p, '.notis', 'borttagen ur kön');
      anta(await antalGivna(oid) === 2, `dosen sparades ändå: ${await antalGivna(oid)}`);
      anta((await p.evaluate(async () => (await (await import('/js/lasekopia.js')).koRader()).length)) === 0, 'kön är inte tom');
    });
    await c.close();
  }

  const version = browser.version();
  await browser.close();
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  // Testerna med samma prefix ersätts. Andra skripts tester i filen (test/anvandartest.cjs) behålls.
  if (!BARA) skrivKlienttester({ app: APP, prefix: PREFIX, tester, bas: BAS, webblasare: `Chromium ${version}`, gransnittHash: gransnittHash(join(APP, 'public')) });
  const roda = tester.filter(t => t.status !== 'grön');
  console.log(`\nAvbrott: ${tester.length - roda.length} av ${tester.length} gröna. Resultatet finns i app/klienttest-resultat.json`);
  if (sidfel.length) console.log(`Sidfel och konsolfel:\n  ${sidfel.join('\n  ')}`);
  process.exit(roda.length || sidfel.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
