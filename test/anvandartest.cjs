// Tester av testläget för användartest (D6) i en riktig webbläsare med Playwright. Skriptet gör ett användartest från
// start till slut: deltagarkod, fem uppgifter (fyra görs, en hoppas över efter att hjälp har registrerats), enkäten
// och resultatet. Uppgifterna görs med samma flöden och samma räkning som test/klickbudget.cjs (test/flodessteg.cjs),
// och testlägets egen räkning ska ge samma klick, fältbyten och tangenter. Allt nätverk avlyssnas, och inget anrop
// får innehålla testresultatet. Resultatet skrivs till app/klienttest-resultat.json, där testerna från
// test/avbrott.cjs behålls (test/klienttester.cjs).
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/anvandartest.cjs [bas-url]
// Standard för bas-url är http://127.0.0.1:18797.

const { chromium } = require('@playwright/test');
const { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { Matare, skapa, raknaISidan } = require('./flodessteg.cjs');
const { skrivKlienttester } = require('./klienttester.cjs');

const BAS = process.argv[2] || 'http://127.0.0.1:18797';
const APP = join(__dirname, '..', 'app');
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });
for (const f of readdirSync(UT)) if (f.startsWith('00-fel-anvandartest')) rmSync(join(UT, f));
const PREFIX = 'Gränssnitt > Användartest > ';

// Uppgifterna i testet. kvittera-svar hoppas över efter att hjälp har registrerats.
const VALDA = ['daganteckning', 'blodtryck', 'remiss', 'kvittera-svar', 'nodatkomst'];
const HOPPAS = 'kvittera-svar';
// En deltagarkod och en text i en öppen fråga som inte finns någon annanstans, så att de kan sökas i nätverket.
const KOD = 'PW-Q7X';
const MARKOR = 'Zebrafinkens fältbyte';
const SUS_SVAR = [4, 1, 5, 2, 4, 1, 5, 1, 4, 2];
const SUS_VANTAD = 87.5;

const tester = [];
const sidfel = [];
let felSida = null;
let felNr = 0;
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
    await felSida?.screenshot({ path: join(UT, `00-fel-anvandartest-${++felNr}.png`), fullPage: true }).catch(() => {});
  }
}
const anta = (villkor, text) => { if (!villkor) throw new Error(text); };

(async () => {
  const { UPPGIFTER } = await import(pathToFileURL(join(APP, 'public', 'js', 'anvandartest-uppgifter.js')).href);
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const hash = gransnittHash(join(APP, 'public'));
  const appversion = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).version;
  let skript = null;
  try { skript = JSON.parse(readFileSync(join(APP, 'klickbudget.json'), 'utf8')); } catch { skript = null; }
  const { GOR } = skapa(BAS);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm', acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BAS });
  await raknaISidan(ctx);
  const page = await ctx.newPage();
  felSida = page;
  page.on('pageerror', e => sidfel.push(`sidfel: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/status of 403/.test(m.text())) sidfel.push(`konsolfel: ${m.text()}`); });
  // Allt som går över nätet, med kropp.
  const anrop = [];
  let fas = 'uppgifter';
  page.on('request', r => anrop.push({ fas, metod: r.method(), url: r.url(), kropp: r.postData() ?? '' }));

  const matt = {};
  let fil = null;
  let tillstandFore = null;

  await test('testläget räknar klick, fältbyten och tangenter som klickbudgetskriptet för samma flöden', async () => {
    await page.goto(`${BAS}/#/anvandartest`);
    await page.waitForSelector('#at-start');
    tillstandFore = await page.evaluate(() => ({ lagrat: sessionStorage.getItem('vk_anvandartest'), list: Boolean(document.getElementById('testlage')) }));
    anta(tillstandFore.lagrat === null && !tillstandFore.list, 'testläget är på innan testet har startats');
    await page.fill('#at-kod', KOD);
    for (const u of UPPGIFTER) if (!VALDA.includes(u.id)) await page.uncheck(`input[name="uppgift"][value="${u.id}"]`);
    await page.click('#at-start [type="submit"]');
    await page.waitForSelector('#testlage [data-t="borja"]');
    for (const [i, id] of VALDA.entries()) {
      const u = UPPGIFTER.find(x => x.id === id);
      const text = (await page.locator('#testlage-text').textContent()).trim();
      anta(text === u.text, `uppgift ${i + 1} visar fel text: ${text}`);
      anta((await page.locator('.testlage-nr').textContent()).includes(`Uppgift ${i + 1} av ${VALDA.length}`), 'fel uppgiftsnummer i listen');
      await page.click('#testlage [data-t="borja"]');
      await page.waitForSelector('#testlage [data-t="klar"]', { timeout: 20000 });
      if (id === HOPPAS) {
        await page.click('#testlage [data-t="hjalp"]');
        await page.waitForSelector('#testlage [data-t="hjalp"]:has-text("(1)")');
        await page.click('#testlage [data-t="hoppa"]');
        continue;
      }
      const m = new Matare(page);
      await m.borja();
      await GOR[id](m, page);
      await m.kontrollera();
      matt[id] = { klick: m.klick, faltbyten: m.faltbyten, tangenter: m.tangenter, uppmatt: m.uppmatt };
      const iSidan = await page.evaluate(() => {
        const t = JSON.parse(sessionStorage.getItem('vk_anvandartest'));
        const r = t.pagar.rakning;
        return { klick: r.klick, faltbyten: r.faltbyten, tangenter: r.tangenter, uppmatt: r.klick + r.faltbyten + r.tangenter, steg: r.steg };
      });
      const { steg, ...siffror } = iSidan;
      anta(JSON.stringify(siffror) === JSON.stringify(matt[id]), `${id}: testläget räknade ${JSON.stringify(siffror)}, skriptet ${JSON.stringify(matt[id])}. Testläget: ${steg.join('; ')}. Skriptet: ${m.steg.join('; ')}`);
      // Samma siffror som klickbudget.cjs mätte, om den mätningen gjordes på samma gränssnitt.
      const kb = skript?.gransnittHash === hash ? skript.floden.find(f => f.id === id) : null;
      if (kb) anta(kb.uppmatt === matt[id].uppmatt, `${id}: klickbudget.json har ${kb.uppmatt} steg, testläget ${matt[id].uppmatt}`);
      const n = (v, en, fl) => `${v} ${v === 1 ? en : fl}`;
      console.log(`    ${u.namn}: ${matt[id].uppmatt} steg (${n(matt[id].klick, 'klick', 'klick')}, ${n(matt[id].faltbyten, 'fältbyte', 'fältbyten')}, ${n(matt[id].tangenter, 'tangent', 'tangenter')})${kb ? ', samma som klickbudget.json' : ''}`);
      await page.click('#testlage [data-t="klar"]');
    }
    fas = 'enkat';
    await page.waitForSelector('#at-enkat', { timeout: 20000 });
    anta(!(await page.locator('#testlage').count()), 'listen syns kvar under enkäten');
  });

  await test('enkäten ger SUS-poäng enligt standardformeln', async () => {
    await page.check('input[name="yrkesroll"][value="lakare"]');
    await page.check('input[name="erfarenhet"][value="2-5"]');
    // Utan svar på alla påståenden går enkäten inte att spara.
    await page.click('#at-enkat [type="submit"]');
    await page.locator('#at-enkat .form-fel:not([hidden])').waitFor();
    anta((await page.locator('#at-enkat .form-fel').textContent()).includes('påstående 1, 2, 3'), 'saknade svar visas inte');
    for (const [i, v] of SUS_SVAR.entries()) await page.check(`input[name="sus${i + 1}"][value="${v}"]`);
    await page.fill('#at-svarast', `${MARKOR}, att hitta remissen.`);
    await page.fill('#at-saknades', 'Inget.');
    await page.click('#at-enkat [type="submit"]');
    fas = 'resultat';
    await page.waitForSelector('.at-tabell');
    const poang = (await page.locator('[data-sus]').textContent()).trim();
    anta(poang === '87,5', `SUS-poängen är ${poang}, väntat 87,5`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(UT, '38-anvandartest-resultat.png') });
  });

  await test('resultatfilen laddas ner med datum, version, deltagarkod, uppgifter och SUS-poäng', async () => {
    const [nedladdning] = await Promise.all([page.waitForEvent('download'), page.click('[data-r="ladda"]')]);
    const katalog = mkdtempSync(join(tmpdir(), 'vk-anvandartest-'));
    try {
      const vag = join(katalog, nedladdning.suggestedFilename());
      await nedladdning.saveAs(vag);
      anta(/^anvandartest-PW-Q7X-\d{4}-\d{2}-\d{2}\.json$/.test(nedladdning.suggestedFilename()), `filnamnet är ${nedladdning.suggestedFilename()}`);
      fil = JSON.parse(readFileSync(vag, 'utf8'));
    } finally { rmSync(katalog, { recursive: true, force: true }); }
    anta(fil.format === 'vardkallan-anvandartest' && fil.formatversion === 1, 'fel format');
    anta(fil.deltagarkod === KOD, 'fel deltagarkod');
    anta(!Number.isNaN(Date.parse(fil.datum)) && !Number.isNaN(Date.parse(fil.avslutad)), 'datum saknas');
    anta(fil.version.app === appversion, `appens version är ${fil.version.app}`);
    anta(fil.version.gransnitt === hash, 'gränssnittets hash stämmer inte med app/public');
    anta(fil.version.uppgifter === 1, 'uppgifternas version saknas');
    anta(JSON.stringify(fil.deltagare) === JSON.stringify({ yrkesroll: 'lakare', erfarenhet: '2-5' }), `deltagaren är ${JSON.stringify(fil.deltagare)}`);
    anta(JSON.stringify(Object.keys(fil.deltagare).sort()) === '["erfarenhet","yrkesroll"]', 'resultatet har fler uppgifter om deltagaren än roll och erfarenhet');
    anta(JSON.stringify(fil.uppgifter.map(u => u.id)) === JSON.stringify(VALDA), `uppgifterna är ${fil.uppgifter.map(u => u.id)}`);
    anta(JSON.stringify(fil.ejGjorda) === JSON.stringify(UPPGIFTER.map(u => u.id).filter(id => !VALDA.includes(id))), 'ej gjorda uppgifter saknas');
    for (const u of fil.uppgifter) {
      anta(u.tidMs > 0, `${u.id}: ingen tid`);
      if (u.id === HOPPAS) continue;
      anta(u.status === 'klar' && u.malUppnatt === true && u.hjalp === 0, `${u.id}: status ${u.status}, målet ${u.malUppnatt}, hjälp ${u.hjalp}`);
      anta(u.tidTillMalMs > 0 && u.tidTillMalMs <= u.tidMs, `${u.id}: tid till målet ${u.tidTillMalMs}`);
      const { klick, faltbyten, tangenter, uppmatt } = u;
      anta(JSON.stringify({ klick, faltbyten, tangenter, uppmatt }) === JSON.stringify(matt[u.id]), `${u.id}: filen har ${JSON.stringify({ klick, faltbyten, tangenter, uppmatt })}`);
    }
    anta(fil.sus.poang === SUS_VANTAD && JSON.stringify(fil.sus.svar) === JSON.stringify(SUS_SVAR), `SUS i filen: ${JSON.stringify(fil.sus)}`);
    anta(fil.oppnaSvar.svarast.startsWith(MARKOR) && fil.oppnaSvar.jamfort === '' && fil.oppnaSvar.saknades === 'Inget.', 'de öppna svaren stämmer inte');
    // Det som skrevs i fälten under uppgifterna finns inte i resultatet.
    anta(!JSON.stringify(fil).includes('Pigg, äter bra') && !JSON.stringify(fil).includes('elkonvertering'), 'inskriven text finns i resultatet');
    // Texten som kopieras har samma resultat som filen.
    await page.click('[data-r="kopiera"]');
    await page.waitForSelector('.notis:has-text("Resultatet är kopierat")');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    anta(text.includes(`Deltagarkod: ${KOD}`) && text.includes('SUS: 87,5'), 'den kopierade texten saknar deltagarkod eller SUS');
    const json = JSON.parse(text.slice(text.indexOf('Resultatfil (JSON):') + 'Resultatfil (JSON):'.length));
    anta(JSON.stringify(json) === JSON.stringify(fil), 'den kopierade texten har inte samma resultat som filen');
  });

  await test('hoppa över och hjälp registreras per uppgift', async () => {
    const u = fil.uppgifter.find(x => x.id === HOPPAS);
    anta(u.status === 'hoppade_over' && u.hjalp === 1 && u.hjalpVidMs.length === 1 && u.malUppnatt === false, `den överhoppade uppgiften: ${JSON.stringify(u)}`);
    anta((await page.locator(`.at-tabell tr[data-uppgift="${HOPPAS}"]`).textContent()).includes('Hoppade över'), 'tabellen visar inte att uppgiften hoppades över');
  });

  await test('inget anrop skickar testresultat till servern', async () => {
    const egen = new URL(BAS).origin;
    const andraVardar = anrop.filter(a => !a.url.startsWith('blob:') && new URL(a.url).origin !== egen);
    anta(andraVardar.length === 0, `anrop till andra värdar: ${andraVardar.map(a => a.url)}`);
    const markorer = [KOD, MARKOR, 'vardkallan-anvandartest', '"sus"', 'malUppnatt', 'uppmatt'];
    const lacker = anrop.filter(a => markorer.some(x => a.url.includes(encodeURIComponent(x)) || a.url.includes(x) || a.kropp.includes(x)));
    anta(lacker.length === 0, `anrop med testresultat: ${lacker.map(a => `${a.metod} ${a.url}`)}`);
    // Efter uppgifterna skrivs inget till servern: enkäten, resultatet, nedladdningen och kopieringen görs i webbläsaren.
    const skrivningar = anrop.filter(a => a.fas !== 'uppgifter' && a.metod !== 'GET');
    anta(skrivningar.length === 0, `skrivande anrop efter uppgifterna: ${skrivningar.map(a => `${a.metod} ${a.url}`)}`);
    const api = anrop.filter(a => a.fas === 'resultat' && new URL(a.url).pathname.startsWith('/api/'));
    anta(api.length === 0, `anrop till API:t under resultatet: ${api.map(a => a.url)}`);
    console.log(`    ${anrop.length} anrop avlyssnade, inga med testresultat`);
  });

  await test('testläget rensas när testet avslutas', async () => {
    await page.click('[data-r="avsluta"]');
    await page.click('dialog[open] [data-varde="ok"]');
    await page.waitForSelector('#at-start');
    await page.waitForSelector('.notis:has-text("Testet är avslutat")');
    const efter = await page.evaluate(() => ({ lagrat: sessionStorage.getItem('vk_anvandartest'), list: Boolean(document.getElementById('testlage')), nycklar: Object.keys(sessionStorage) }));
    anta(efter.lagrat === null && !efter.list, 'testläget finns kvar efter att testet avslutats');
    anta(!efter.nycklar.some(k => k.includes('anvandartest')), `kvar i sessionStorage: ${efter.nycklar}`);
    await page.reload();
    await page.waitForSelector('#at-start');
    anta(!(await page.locator('#testlage').count()), 'listen kommer tillbaka efter omladdning');
  });

  const version = browser.version();
  await browser.close();
  skrivKlienttester({ app: APP, prefix: PREFIX, tester, bas: BAS, webblasare: `Chromium ${version}`, gransnittHash: hash });
  const roda = tester.filter(t => t.status !== 'grön');
  console.log(`\nAnvändartest: ${tester.length - roda.length} av ${tester.length} gröna. Resultatet finns i app/klienttest-resultat.json`);
  if (sidfel.length) console.log(`Sidfel och konsolfel:\n  ${sidfel.join('\n  ')}`);
  process.exit(roda.length || sidfel.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
