// Instruktionsfilmerna (runda 14, r5, Sussa 11.2.1.4 och 10.1.1.3). Spelar in varje film i app/src/instruktionsfilmer.js
// med Playwright mot en lokal server, med textade steg på svenska, och skriver den till docs/filmer/<id>.webm. Varje
// film gör samma flöde som klickbudgeten mäter (test/flodessteg.cjs), så att filmen visar det gränssnitt som finns.
// Kör om skriptet efter varje ändring i gränssnittet.
//
// Användning (servern måste vara igång, och ffmpeg med libvpx-vp9 krymper filmerna om det finns):
//   NODE_PATH=$(npm root -g) node test/instruktionsfilmer.cjs [bas-url] [film-id ...]

const { chromium } = require('@playwright/test');
const { mkdirSync, renameSync, rmSync, statSync, existsSync, mkdtempSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { Matare, skapa, raknaISidan } = require('./flodessteg.cjs');
const { foljServernsKlocka, stallKlockan } = require('./testklocka.cjs');

const BAS = process.argv[2] || 'http://127.0.0.1:18797';
const BARA = process.argv.slice(3);
const ROT = join(__dirname, '..');
const UT = join(ROT, 'docs', 'filmer');
const STORLEK = { width: 1280, height: 720 };
const { synlig, loggaIn, startI, GOR } = skapa(BAS);

// Texten längst ned i bilden. Den läggs i en egen ruta som sidan inte kan klicka i, och tas bort mellan filmerna.
async function textremsa(page, text, { rubrik = null } = {}) {
  await page.evaluate(({ text, rubrik }) => {
    let el = document.getElementById('__film-text');
    if (!el) {
      el = document.createElement('div');
      el.id = '__film-text';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;'
        + 'max-width:90%;padding:12px 20px;border-radius:8px;background:rgba(0,0,0,0.82);color:#fff;font:600 22px/1.35 system-ui,sans-serif;text-align:center';
      document.body.append(el);
    }
    el.innerHTML = '';
    if (rubrik) { const h = document.createElement('div'); h.style.cssText = 'font-size:28px;margin-bottom:6px'; h.textContent = rubrik; el.append(h); }
    const p = document.createElement('div');
    p.textContent = text;
    el.append(p);
  }, { text, rubrik });
}

// Mätaren från klickbudgeten, med en textremsa före varje steg och tid att se vad som händer.
class Filmare extends Matare {
  constructor(page) { super(page); this.nr = 0; }
  async visa(text) { this.nr++; await textremsa(this.page, `${this.nr}. ${text}`); await this.page.waitForTimeout(1300); }
  async klicka(loc, text) { await loc.waitFor({ state: 'visible' }); await loc.scrollIntoViewIfNeeded().catch(() => {}); await this.visa(`Klicka: ${text}`); await super.klicka(loc, text); await this.page.waitForTimeout(700); }
  async valj(loc, varde, text) { await this.visa(`Välj ${text}`); await super.valj(loc, varde, text); await this.page.waitForTimeout(700); }
  async skriv(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    await this.visa(`Skriv ${text}`);
    const harFokus = await loc.evaluate(el => el === document.activeElement);
    if (!harFokus) { await loc.click(); this.faltbyten++; }
    await this.page.keyboard.type(varde, { delay: 45 });
    await this.page.waitForTimeout(500);
  }
  async tangent(namn, text) { await this.visa(`Tryck ${namn === 'Enter' ? 'Enter' : namn}: ${text}`); await super.tangent(namn, text); await this.page.waitForTimeout(700); }
}

function krymp(fil) {
  const ff = spawnSync('ffmpeg', ['-version']);
  if (ff.status !== 0) return false;
  const ny = `${fil}.vp9.webm`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', fil, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', ny]);
  if (r.status !== 0 || !existsSync(ny)) { rmSync(ny, { force: true }); return false; }
  renameSync(ny, fil);
  return true;
}

(async () => {
  const { filmer, MAX_BYTE } = await import(pathToFileURL(join(ROT, 'app', 'src', 'instruktionsfilmer.js')).href);
  await foljServernsKlocka(BAS);
  mkdirSync(UT, { recursive: true });
  const tmp = mkdtempSync(join(process.env.TMPDIR || join(ROT, 'app'), 'vk-filmer-'));
  const browser = await chromium.launch();
  const fel = [];
  for (const f of filmer().filter(x => !BARA.length || BARA.includes(x.id))) {
    try {
      // Inloggning och återställning görs utan inspelning, så att filmen börjar där flödet börjar.
      const forbered = await browser.newContext({ viewport: STORLEK, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
      await stallKlockan(forbered);
      const p0 = await forbered.newPage();
      await loggaIn(p0, f.roll);
      await p0.click('[data-a="aterstall"]');
      await synlig(p0, '.notis', 'Demon är återställd');
      await p0.waitForLoadState('networkidle');
      const tillstand = await forbered.storageState();
      await forbered.close();

      const katalog = join(tmp, f.id);
      const ctx = await browser.newContext({ viewport: STORLEK, locale: 'sv-SE', timezoneId: 'Europe/Stockholm', storageState: tillstand, recordVideo: { dir: katalog, size: STORLEK } });
      await stallKlockan(ctx);
      await raknaISidan(ctx);
      const page = await ctx.newPage();
      await startI[f.start](page);
      await page.evaluate(() => document.getElementById('notiser')?.replaceChildren());
      await textremsa(page, f.beskrivning, { rubrik: f.rubrik });
      await page.waitForTimeout(3500);
      const m = new Filmare(page);
      await m.borja();
      await GOR[f.flode](m, page);
      await page.waitForTimeout(800);
      await textremsa(page, `Klart på ${m.uppmatt} steg. Systemet gjorde resten.`, { rubrik: f.rubrik });
      await page.waitForTimeout(2500);
      const video = page.video();
      await ctx.close();
      const fil = join(UT, `${f.id}.webm`);
      renameSync(await video.path(), fil);
      const krympt = krymp(fil);
      const byte = statSync(fil).size;
      console.log(`${byte <= MAX_BYTE ? 'ok ' : 'STOR'} ${f.id}: ${(byte / 1048576).toFixed(2)} MB${krympt ? ', krympt med VP9' : ''}`);
      if (byte > MAX_BYTE) fel.push(`${f.id}: ${byte} byte är mer än ${MAX_BYTE}`);
    } catch (e) {
      fel.push(`${f.id}: ${e.message.split('\n')[0]}`);
      console.log(`FEL ${f.id}: ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
  if (fel.length) { console.log(`\nInspelningen misslyckades:\n  ${fel.join('\n  ')}`); process.exit(1); }
  console.log(`\nFilmerna finns i ${UT}`);
})().catch(e => { console.error(e); process.exit(1); });
