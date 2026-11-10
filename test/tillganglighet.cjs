// Tillgänglighetskontroll av gränssnittet (Sussa 8.4.1.3, bilaga K2, EN 301 549 och WCAG 2.1 nivå AA) och skärmanpassning
// (Sussa KD1.1.4.3 och KD1.1.4.10), med Playwright. Går igenom alla vyer i menyn för varje demoroll, journalens flikar,
// Min journal och de offentliga sidorna, och prövar det som går att pröva automatiskt. Kontrollerna är skrivna här,
// utan en extern tillgänglighetsmotor: kontrast med WCAG:s formel, namn på fält, knappar och länkar, textalternativ,
// rubrikordning, landmärken, språk och sidtitel, tabbordning, synligt fokus, tangentbord, att fokus inte byter sida,
// färg som enda bärare, förstoring till 200 procent, 320 px bredd, högkontrastläget, minskade rörelser och skärmarna
// mobil, platta och stor skärm. Det prövar också nyhetsrutan, hjälpen i sammanhanget och övningarna med intyg
// (Sussa 10.1.1.4 och 10.1.1.5).
//
// Resultatet skrivs till app/klienttest-resultat.json (test/klienttester.cjs) med prefixen "Gränssnitt > Tillgänglighet > "
// och "Gränssnitt > Utbildning > ".
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/tillganglighet.cjs [bas-url]
// Med miljövariabeln VISA=1 skrivs varje fynd ut, annars de första per kontroll.

const { chromium } = require('@playwright/test');
const { join } = require('node:path');
const { mkdirSync, readdirSync, rmSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const { skrivKlienttester } = require('./klienttester.cjs');

const BAS = process.argv[2] || 'http://127.0.0.1:18172';
const APP = join(__dirname, '..', 'app');
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });
for (const f of readdirSync(UT)) if (f.startsWith('00-fel-tillganglighet')) rmSync(join(UT, f));
const VISA = process.env.VISA === '1';

// Fynd per kontroll. Varje fynd är en rad med roll, vy och vad som är fel.
const fynd = {};
const nytt = (kontroll, rad) => { (fynd[kontroll] ??= new Set()).add(rad); };
const sidfel = [];

function bevaka(page, namn) {
  page.on('pageerror', e => sidfel.push(`[${namn}] sidfel: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // 403 och 404 där demon visar nekad åtkomst, och 400 när testet själv framkallar ett fel i ett formulär.
    if (/Failed to load resource: the server responded with a status of 40[034]/.test(m.text())) return;
    sidfel.push(`[${namn}] konsolfel: ${m.text()}`);
  });
}

// Räknar pågående anrop i sidan, så att en vy räknas som klar när inga anrop pågår.
const INIT = () => {
  window.__anrop = 0;
  const f = window.fetch.bind(window);
  window.fetch = (...a) => { window.__anrop++; return f(...a).finally(() => { window.__anrop--; }); };
};

async function vantaKlar(page) {
  await page.waitForFunction(() => {
    const h1 = document.querySelector('main h1');
    if (!h1 || window.__anrop > 0) return false;
    if ([...document.querySelectorAll('main .tom')].some(e => /^Hämtar/.test(e.textContent.trim()))) return false;
    return true;
  }, null, { timeout: 15000, polling: 50 });
  await page.waitForTimeout(80);
  await page.waitForFunction(() => window.__anrop === 0, null, { timeout: 15000, polling: 50 });
}

async function gaTill(page, hash) {
  await page.evaluate((h) => { if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; }, hash);
  await vantaKlar(page);
}

async function loggaIn(page, id) {
  await page.goto(`${BAS}/#/`);
  await page.waitForLoadState('networkidle');
  if (await page.locator('[data-a="loggaut"]').count()) { await page.click('[data-a="loggaut"]'); await page.waitForSelector('.roll, #flik-patient'); }
  if (id.startsWith('inv-')) { await page.click('#flik-patient'); await page.click(`[data-invanare="${id}"]`); } else await page.click(`[data-roll="${id}"]`);
  await page.waitForSelector('[data-a="loggaut"]');
  await vantaKlar(page);
}

// ---- Kontrollerna i sidan ----------------------------------------------------------------------------------------
// Körs i webbläsaren. Ger fynden för en vy per kontroll. kontrastKrav är 4.5 (vanligt läge) eller 7 (hög kontrast).
function granskaSida({ kontrastKrav = 4.5, storKrav = 3 } = {}) {
  const ut = { kontrast: [], namn: [], alt: [], rubriker: [], landmarken: [], sprak: [], farg: [], tangentbord: [], media: [], komponent: [] };
  const kort = (el) => {
    const t = (el.getAttribute?.('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    const k = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${k ? `.${k}` : ''}${t ? ` "${t}"` : ''}`;
  };
  const synlig = (el) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const doldForHjalpmedel = (el) => Boolean(el.closest('[aria-hidden="true"], [hidden], .sr-dold'));
  const arSr = (el) => Boolean(el.closest('.sr'));

  // Färger. parse ger [r, g, b, a].
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const d = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [d[0], d[1], d[2], d.length > 3 ? d[3] : 1];
  };
  const blanda = (fg, bg) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const kvot = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Bakgrunden bakom ett element: lagren uppåt i trädet. En gradient ger alla sina färger, och den sämsta räknas.
  const bakgrunder = (el) => {
    const lager = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const bild = cs.backgroundImage;
      if (bild && bild !== 'none') {
        const farger = [...bild.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0]));
        if (farger.length) { lager.push({ gradient: farger }); break; }
        if (/url\(/.test(bild)) return null;
      }
      const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { lager.push({ farg: c }); if (c[3] >= 1) break; }
    }
    let botten = [[255, 255, 255, 1]];
    for (let i = lager.length - 1; i >= 0; i--) {
      const l = lager[i];
      if (l.gradient) botten = l.gradient.map(g => blanda(g, [255, 255, 255, 1]));
      else botten = botten.map(b => blanda(l.farg, b));
    }
    return botten;
  };
  const opacitet = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };

  // 1.4.3 Kontrast: varje synligt textelement.
  const sedda = new Set();
  const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || sedda.has(el) || arSr(el) || !synlig(el)) continue;
    sedda.add(el);
    if (el.closest('select, option, script, style, noscript, .logotyp')) continue;
    // Inaktiva komponenter har inget krav på kontrast (K2 1.4.3, undantaget oväsentlig).
    if (el.closest(':disabled, [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el);
    const iSvg = el.closest('svg');
    let fg = parse(iSvg ? cs.fill : cs.color);
    if (!fg) continue;
    fg = [fg[0], fg[1], fg[2], fg[3] * opacitet(el)];
    const bg = bakgrunder(iSvg ? iSvg.parentElement : el);
    if (!bg) continue;
    const storlek = parseFloat(cs.fontSize);
    const fet = Number(cs.fontWeight) >= 700;
    const stor = storlek >= 24 || (storlek >= 18.66 && fet);
    const krav = stor ? storKrav : kontrastKrav;
    const samsta = Math.min(...bg.map(b => kvot(blanda(fg, b), b)));
    if (samsta < krav - 0.005) ut.kontrast.push(`${kort(el)}: ${samsta.toFixed(2)}:1, krav ${krav}:1 (${cs.color} på ${bg.map(b => `rgb(${b.slice(0, 3).map(Math.round).join(',')})`).join('/')})`);
  }

  // Namn: fält, knappar, länkar, flikar, ramar. Ett namn får inte komma bara från platshållaren.
  const textAv = (el) => {
    let t = '';
    for (const c of el.childNodes) {
      if (c.nodeType === 3) t += c.textContent;
      else if (c.nodeType === 1) {
        if (c.getAttribute('aria-hidden') === 'true' || c.hidden) continue;
        if (c.tagName === 'IMG') t += c.getAttribute('alt') ?? '';
        else if (c.tagName.toLowerCase() === 'svg') t += c.getAttribute('aria-label') ?? c.querySelector('title')?.textContent ?? '';
        else t += c.getAttribute('aria-label') ?? textAv(c);
      }
    }
    return t;
  };
  const namnAv = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    if (el.getAttribute('aria-label')?.trim()) return el.getAttribute('aria-label').trim();
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      const l = [...(el.labels ?? [])].map(x => textAv(x)).join(' ').trim();
      if (l) return l;
      return (el.getAttribute('title') ?? '').trim();
    }
    const t = textAv(el).replace(/\s+/g, ' ').trim();
    return t || (el.getAttribute('title') ?? '').trim();
  };
  for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea, button, a[href], summary, [role="button"], [role="tab"], [role="link"], iframe')) {
    if (!synlig(el) && !(el.matches('input[type="radio"], input[type="checkbox"]') && el.parentElement && synlig(el.parentElement))) continue;
    if (doldForHjalpmedel(el)) continue;
    if (el.tagName === 'IFRAME') { if (!el.title?.trim()) ut.namn.push(`${kort(el)}: ramen saknar titel`); continue; }
    if (!namnAv(el)) ut.namn.push(`${kort(el)}: saknar namn`);
  }
  // Textalternativ: bilder, symboler och element med rollen bild.
  for (const el of document.querySelectorAll('img, svg, [role="img"], input[type="image"]')) {
    if (el.tagName.toLowerCase() === 'svg' && el.parentElement?.closest('svg')) continue;
    if (!synlig(el) || doldForHjalpmedel(el)) continue;
    if (el.tagName === 'IMG') { if (!el.hasAttribute('alt')) ut.alt.push(`${kort(el)}: saknar alt`); continue; }
    const namn = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.tagName.toLowerCase() === 'svg' && el.querySelector(':scope > title')?.textContent);
    if (!namn) ut.alt.push(`${kort(el)}: symbol som inte är dold för hjälpmedel och saknar textalternativ`);
  }

  // Rubriker: en rubrik på nivå 1 i huvudinnehållet, inga tomma rubriker och inga hoppade nivåer.
  const main = document.querySelector('main');
  if (main) {
    const h = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(x => synlig(x) || arSr(x));
    if (!h.some(x => x.tagName === 'H1')) ut.rubriker.push('ingen rubrik på nivå 1 i huvudinnehållet');
    let forra = 0;
    for (const x of h) {
      const n = Number(x.tagName[1]);
      if (!x.textContent.trim()) ut.rubriker.push(`${kort(x)}: tom rubrik`);
      if (forra && n > forra + 1) ut.rubriker.push(`${kort(x)}: nivå ${n} efter nivå ${forra}`);
      forra = n;
    }
  }
  for (const dl of document.querySelectorAll('dialog[open]')) {
    if (!dl.getAttribute('aria-labelledby') && !dl.getAttribute('aria-label')) ut.rubriker.push(`${kort(dl)}: dialogen saknar rubrik`);
  }

  // Landmärken: ett huvudinnehåll, ett sidhuvud och en sidfot, och allt synligt innehåll i ett landmärke.
  const LANDMARKE = 'header, nav, main, footer, aside, form[aria-label], form[aria-labelledby], section[aria-label], section[aria-labelledby], [role="banner"], [role="navigation"], [role="main"], [role="contentinfo"], [role="complementary"], [role="region"], [role="search"], dialog, [role="dialog"], [role="alertdialog"], [role="alert"], [role="status"], [aria-live], .hoppa';
  if (document.querySelectorAll('main').length !== 1) ut.landmarken.push(`${document.querySelectorAll('main').length} huvudinnehåll`);
  if (!document.querySelector('header:not(main header):not(article header):not(section header)')) ut.landmarken.push('inget sidhuvud');
  if (!document.querySelector('body > footer, footer.sidfot')) ut.landmarken.push('ingen sidfot');
  const utanfor = new Set();
  const gang2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = gang2.nextNode(); n; n = gang2.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript') || !synlig(el) || el.closest(LANDMARKE)) continue;
    utanfor.add(kort(el));
  }
  for (const u of utanfor) ut.landmarken.push(`${u}: utanför landmärken`);

  // Språk och titel.
  if (document.documentElement.lang !== 'sv') ut.sprak.push(`språket är "${document.documentElement.lang}"`);
  const h1 = document.querySelector('main h1')?.textContent?.replace(/\s+/g, ' ').trim();
  if (!document.title || document.title === 'Vårdkällan' || (h1 && !document.title.replace(/\s+/g, ' ').includes(h1.slice(0, 20)))) ut.sprak.push(`titeln "${document.title}" säger inte vilken vy det är (${h1})`);

  // Färg som enda bärare (1.4.1). Ett litet färgat element utan text eller symbol bär bara färg.
  const mattad = (c) => { const [r, g, b] = c.map(x => x / 255); const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
  for (const el of document.querySelectorAll('main *, header *, aside *')) {
    if (!synlig(el) || el.closest('svg')) continue;
    if (el.textContent.trim() || el.querySelector('svg, img')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 30 || r.height > 30) continue;
    const cs = getComputedStyle(el);
    const c = parse(cs.backgroundColor);
    if (!c || c[3] < 0.5 || mattad(c) < 0.35) continue;
    // Ett färgat element som hör till en text i samma rad, till exempel en markör framför en text, är dekoration.
    const forald = el.parentElement;
    const namn = el.getAttribute('aria-label') || el.getAttribute('title');
    // Ett element som är dolt för hjälpmedel, i en ruta med text som säger samma sak, är dekoration (till exempel
    // staplarna i Svarstider, där texten bredvid säger om värdet är över målet).
    const dold = el.closest('[aria-hidden="true"]');
    const textBredvid = (x) => Boolean(x?.parentElement && x.parentElement.textContent.trim().length > 1);
    if (!namn && !(dold && textBredvid(dold))) ut.farg.push(`${kort(el)}: färgat element utan text (${cs.backgroundColor}) i ${kort(forald ?? el)}`);
  }
  // Länkar i löpande text ska vara understrukna.
  for (const a of document.querySelectorAll('main p a[href], main li a[href], footer p a[href], main td a[href], main dd a[href]')) {
    if (!synlig(a) || a.matches('.knapp, .knapp-lank, [class*="knapp"]')) continue;
    const forald = a.parentElement;
    const ovrig = [...forald.childNodes].filter(c => c !== a && !(c.nodeType === 1 && c.contains(a))).map(c => c.textContent).join('').trim();
    if (ovrig.length < 3) continue;
    if (!getComputedStyle(a).textDecorationLine.includes('underline')) ut.farg.push(`${kort(a)}: länk i löptext som inte är understruken`);
  }
  // Kurvor: en beskrivning, och flera serier skiljs åt med form, inte bara färg.
  for (const s of document.querySelectorAll('svg.kurva, svg[role="img"]')) {
    if (!synlig(s)) continue;
    if (!s.getAttribute('aria-label')) ut.farg.push(`${kort(s)}: kurva utan beskrivning`);
    const linjer = [...s.querySelectorAll('polyline, path.kurva-linje')];
    if (linjer.length > 1) {
      const streck = new Set(linjer.map(l => getComputedStyle(l).strokeDasharray));
      if (streck.size < 2) ut.farg.push(`${kort(s)}: ${linjer.length} serier som bara skiljs med färg`);
    }
    for (const p of s.querySelectorAll('.kurva-utanfor')) {
      const vanlig = s.querySelector('.kurva-punkt:not(.kurva-utanfor):not(.kurva-andra)');
      if (vanlig && p.getAttribute('r') === vanlig.getAttribute('r') && getComputedStyle(p).stroke === getComputedStyle(vanlig).stroke) ut.farg.push(`${kort(s)}: punkt utanför intervallet skiljs bara med färg`);
    }
  }

  // Tangentbord: allt som ser klickbart ut ska gå att nå med tabb.
  const FOKUSERBAR = 'a[href], button, input, select, textarea, summary, label, option, [tabindex], [contenteditable="true"], iframe';
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest(FOKUSERBAR) || el.closest('svg')) continue;
    const pekare = getComputedStyle(el).cursor === 'pointer';
    if ((pekare || el.hasAttribute('data-a') || el.hasAttribute('onclick')) && synlig(el)) {
      // Ett barn till ett klickbart element ärver pekaren; det är föräldern som räknas.
      if (pekare && el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') continue;
      ut.tangentbord.push(`${kort(el)}: ser klickbart ut men går inte att nå med tabb`);
    }
  }
  for (const el of document.querySelectorAll('[tabindex]')) if (Number(el.getAttribute('tabindex')) > 0) ut.tangentbord.push(`${kort(el)}: positivt tabindex`);

  // Media: inget ljud, ingen video, inga bilder av text och inget som rör sig av sig självt.
  for (const el of document.querySelectorAll('audio, video, embed, object, marquee, blink')) ut.media.push(`${kort(el)}: media`);
  for (const el of document.querySelectorAll('img')) if (!/\.svg(\?|$)|^data:image\/svg/.test(el.currentSrc || el.src)) ut.media.push(`${kort(el)}: rasterbild (${el.src.slice(0, 60)})`);
  for (const a of document.getAnimations?.() ?? []) {
    const t = a.effect?.getTiming?.();
    if (t && (t.iterations === Infinity || (Number(t.duration) * (t.iterations || 1)) > 5000)) ut.media.push(`${kort(a.effect.target)}: animation som pågår mer än fem sekunder`);
  }

  // 1.4.11: fältens ramar mot bakgrunden.
  for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="range"]), select, textarea')) {
    if (!synlig(el) || el.disabled) continue;
    const cs = getComputedStyle(el);
    const ram = parse(cs.borderTopColor);
    const bg = bakgrunder(el.parentElement);
    if (!ram || !bg || parseFloat(cs.borderTopWidth) === 0) {
      const egen = parse(cs.backgroundColor);
      if (egen && bg && Math.min(...bg.map(b => kvot(blanda(egen, b), b))) >= 3) continue;
      ut.komponent.push(`${kort(el)}: fältet saknar ram`);
      continue;
    }
    const k = Math.min(...bg.map(b => kvot(blanda(ram, b), b)));
    if (k < 3) ut.komponent.push(`${kort(el)}: ramen har ${k.toFixed(2)}:1 mot bakgrunden`);
  }
  return ut;
}

// Ingen rullning i sidled, och ingen text som klipps av i en ruta. maxTecken ger för långa textrader på stor skärm.
function granskaLayout({ bredd, maxTecken = null }) {
  const ut = [];
  const sida = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sida > bredd + 1) {
    // Det som sticker ut.
    const breda = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > bredd + 1 && r.width > 0 && !e.closest('.tabellrulle, .rulla, [data-rulla]'); })
      .filter(e => ![...e.children].some(c => c.getBoundingClientRect().right > bredd + 1)).slice(0, 3)
      .map(e => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''}`);
    ut.push(`sidan är ${sida} px bred vid ${bredd} px (${breda.join(', ')})`);
  }
  for (const el of document.querySelectorAll('main *, header *, nav *')) {
    if (!el.checkVisibility() || el.closest('.sr, .tabellrulle, svg, [data-rulla]')) continue;
    const cs = getComputedStyle(el);
    if (!['hidden', 'clip'].includes(cs.overflowX) || cs.textOverflow === 'ellipsis' && el.title) continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.textContent.trim()) ut.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: texten klipps av (${el.scrollWidth} mot ${el.clientWidth} px)`);
  }
  if (maxTecken) {
    for (const p of document.querySelectorAll('main p')) {
      if (!p.checkVisibility() || p.textContent.trim().length < maxTecken) continue;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      const tecken = p.getBoundingClientRect().width / (fs * 0.5);
      if (tecken > maxTecken) ut.push(`${p.tagName.toLowerCase()}.${String(p.className).split(' ')[0]}: textraden rymmer omkring ${Math.round(tecken)} tecken`);
    }
  }
  return ut;
}

// Tabbar igenom sidan och prövar fokusordning, synligt fokus, fokus som byter sida och fällor.
async function granskaFokus(page, etikett, { antal = 45, franMain = false } = {}) {
  await page.evaluate((fran) => {
    window.__fokusHash = location.hash;
    if (fran) { const h = document.querySelector('main h1'); h?.focus(); } else { document.activeElement?.blur(); window.scrollTo(0, 0); }
  }, franMain);
  if (!franMain) await page.evaluate(() => { document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.removeAttribute('tabindex'); });
  let forra = null;
  let samma = 0;
  const sedda = [];
  for (let i = 0; i < antal; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { body: true };
      const kort = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`;
      const cs = getComputedStyle(el);
      const rekt = el.getBoundingClientRect();
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const d = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [d[0], d[1], d[2], d.length > 3 ? d[3] : 1]; };
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const kvot = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      let bg = [255, 255, 255, 1];
      for (let e = el.parentElement; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] >= 0.99) { bg = c; break; } }
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1;
      const skugga = cs.boxShadow && cs.boxShadow !== 'none';
      // En radioknapp eller kryssruta som visas genom sin etikett får fokusmarkeringen på etiketten.
      const etikett = el.matches('input[type="radio"], input[type="checkbox"]') ? el.labels?.[0] ?? el.nextElementSibling : null;
      const ecs = etikett ? getComputedStyle(etikett) : null;
      const etikettMarkerad = ecs && ((ecs.outlineStyle !== 'none' && parseFloat(ecs.outlineWidth) >= 1) || (ecs.boxShadow && ecs.boxShadow !== 'none'));
      const farg = outline ? parse(cs.outlineColor) : null;
      return {
        kort, synlig: (el.checkVisibility() && rekt.width > 0 && rekt.height > 0) || Boolean(etikett?.checkVisibility()),
        markerad: outline || skugga || etikettMarkerad, kontrast: farg ? kvot(farg, bg) : null, hash: location.hash, startHash: window.__fokusHash,
        dialog: Boolean(document.querySelector('dialog[open]')), tabindex: Number(el.getAttribute('tabindex') ?? 0),
        datum: el.matches('input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"]'),
        index: [...document.querySelectorAll('*')].indexOf(el),
      };
    });
    if (r.body) continue;
    if (r.hash !== r.startHash) { nytt('vidFokus', `${etikett}: fokus på ${r.kort} ändrade adressen till ${r.hash}`); break; }
    if (r.dialog) { nytt('vidFokus', `${etikett}: fokus på ${r.kort} öppnade en dialog`); break; }
    if (!r.synlig) nytt('synligtFokus', `${etikett}: fokus på ett dolt element ${r.kort}`);
    // I ett datumfält är det sista tabbstoppet webbläsarens egen kalenderknapp inuti fältet. Den har webbläsarens
    // fokusmarkering, som inte syns i fältets stil, så den räknas inte här. Fältets egna delar har sidans markering.
    else if (!r.markerad && !(r.datum && forra?.index === r.index && forra.markerad)) nytt('synligtFokus', `${etikett}: ${r.kort} har ingen synlig fokusmarkering`);
    else if (r.kontrast != null && r.kontrast < 3) nytt('komponent', `${etikett}: fokusmarkeringen på ${r.kort} har ${r.kontrast.toFixed(2)}:1`);
    if (r.tabindex > 0) nytt('fokusordning', `${etikett}: ${r.kort} har positivt tabindex`);
    // Ett datumfält tar emot tabb för dag, månad och år, så fokus står kvar i fältet några gånger.
    const steg = r.datum ? 6 : 2;
    if (forra && r.index === forra.index) { if (++samma >= steg) { nytt('fokusordning', `${etikett}: fokus fastnar på ${r.kort}`); break; } } else samma = 0;
    if (forra && r.index < forra.index && sedda.length > 3 && i < antal - 1) {
      // Tillbaka till början efter sista elementet är väntat; annars är ordningen fel.
      if (r.index > sedda[0]) nytt('fokusordning', `${etikett}: ${r.kort} kommer efter ${forra.kort} men står före i sidan`);
      else break;
    }
    sedda.push(r.index);
    forra = r;
  }
}

// ---- Körningen ---------------------------------------------------------------------------------------------------

const vyerFor = async (page) => page.locator('#meny-lista a').evaluateAll(a => a.map(x => x.getAttribute('href')));
const flikarFor = async (page) => page.locator('main nav.flikar a').evaluateAll(a => a.map(x => x.getAttribute('href')));

(async () => {
  const { G, PREFIX } = await import(pathToFileURL(join(APP, 'src', 'sussa', 'runda7-r2.js')).href);
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const browser = await chromium.launch();
  const kontext = (vp, extra = {}) => browser.newContext({ viewport: vp, locale: 'sv-SE', timezoneId: 'Europe/Stockholm', ...extra });
  const tester = [];
  const kort = (s) => s.split('\n')[0];
  const sparat = async (page, namn) => { await page.screenshot({ path: join(UT, `00-fel-tillganglighet-${namn}.png`), fullPage: true }).catch(() => {}); };

  // Demorollerna och de offentliga sidorna.
  const ctx = await kontext({ width: 1440, height: 900 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  bevaka(page, 'skrivbord');
  await page.goto(`${BAS}/#/`);
  await page.waitForSelector('.roll');
  const roller = await page.locator('.roll[data-roll]').evaluateAll(r => r.map(x => x.dataset.roll));
  const invanare = 'inv-p01';
  const OFFENTLIGA = ['#/', '#/krav', '#/moduler', '#/drift', '#/tillganglighet'];
  const JOURNAL_ROLLER = ['lak-kard', 'ssk-kard', 'usk-kard', 'adm-kard', 'far-kard'];
  const vyLista = []; // [roll, hash]

  async function granskaHar(etikett, { fokus = true, krav } = {}) {
    const r = await page.evaluate(granskaSida, krav ?? {});
    for (const [k, lista] of Object.entries(r)) for (const f of lista) nytt(k, `${etikett}: ${f}`);
    if (fokus) {
      await granskaFokus(page, `${etikett} (från början)`, { antal: 6 });
      await granskaFokus(page, etikett, { antal: 40, franMain: true });
      await page.evaluate(() => document.querySelector('main h1')?.focus());
    }
  }

  // 1. Offentliga sidor utan inloggning.
  for (const h of OFFENTLIGA) {
    await page.goto(`${BAS}/${h}`);
    await vantaKlar(page);
    vyLista.push(['ute', h]);
    await granskaHar(`utan inloggning ${h}`);
  }
  // 2. Varje demoroll: alla vyer i menyn, och journalens flikar för rollerna med journal.
  for (const roll of roller) {
    await loggaIn(page, roll);
    // Nyhetsrutan granskas på startsidan, där den visas.
    await granskaHar(`${roll} startsidan med nyhetsrutan`);
    const vyer = await vyerFor(page);
    for (const h of vyer) {
      await gaTill(page, h);
      vyLista.push([roll, h]);
      await granskaHar(`${roll} ${h}`);
    }
    for (const extra of ['#/nyheter', '#/tillganglighet']) { await gaTill(page, extra); vyLista.push([roll, extra]); await granskaHar(`${roll} ${extra}`, { fokus: false }); }
    // Runda 8, r2: remisskonferensen med en remiss på, för läkaren och vårdadministratören.
    if (['lak-kard', 'adm-kard'].includes(roll)) {
      await page.evaluate(async () => {
        const d = await (await fetch('/api/remisser?riktning=inkommande')).json();
        const r = d.remisser.find(x => ['skickad', 'mottagen'].includes(x.status) && !x.konferens);
        if (r) await (await fetch(`/api/remiss/${r.id}/remisskonferens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).text();
      });
      await gaTill(page, '#/remisser?vy=konferens');
      await page.waitForSelector('.r8-konferens');
      vyLista.push([roll, '#/remisser?vy=konferens']);
      await granskaHar(`${roll} #/remisser?vy=konferens`, { fokus: false });
    }
    // Runda 8, r3: avdelningens planering, patientens planering och en persons vecka nås från arbetslistan, inte från menyn.
    if (['lak-kard', 'ssk-kard', 'usk-kard', 'fys-kard'].includes(roll)) {
      for (const extra of ['#/avdelning', '#/avdelning/patient/p01', '#/avdelning/resurs/lak-kard']) { await gaTill(page, extra); vyLista.push([roll, extra]); await granskaHar(`${roll} ${extra}`); }
    }
    // Runda 9, r2: intensivvårdens övervakning av en patient nås från översikten, inte från menyn.
    if (['lak-kard', 'ssk-kard'].includes(roll)) { await gaTill(page, '#/iva/p22'); vyLista.push([roll, '#/iva/p22']); await granskaHar(`${roll} #/iva/p22`); }
    // Runda 11, r3: med demodata i sandlådan, förlossningen för en patient, graviditetsjournalen och den nyföddas
    // BB-journal, som nås från förlossningens och mödrahälsovårdens sidor.
    if (['bm-uso', 'ssk-vc'].includes(roll)) {
      const barn = await page.evaluate(async () => {
        await (await fetch('/api/demo/obstetrik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).text();
        const d = await (await fetch('/api/patient/obs4/forlossning')).json();
        return d.barn?.[0]?.patientId ?? null;
      });
      const extra = roll === 'bm-uso' ? ['#/forlossning', '#/forlossning/obs3', '#/forlossning/obs4', '#/patient/obs3/graviditet', ...(barn ? [`#/patient/${barn}/nyfodd`] : [])]
        : ['#/modrahalsovard', '#/patient/obs1/graviditet', '#/patient/obs2/graviditet'];
      for (const h of extra) { await gaTill(page, h); vyLista.push([roll, h]); await granskaHar(`${roll} ${h}`); }
    }
    if (JOURNAL_ROLLER.includes(roll)) {
      await gaTill(page, '#/patient/p01');
      for (const h of await flikarFor(page)) {
        await gaTill(page, h);
        vyLista.push([roll, h]);
        await granskaHar(`${roll} ${h}`, { fokus: roll === 'lak-kard' });
      }
    }
  }
  // 3. Min journal.
  await loggaIn(page, invanare);
  const minFlikar = await page.locator('.min-flikar a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  for (const h of ['#/min', ...minFlikar, '#/nyheter']) {
    await gaTill(page, h);
    vyLista.push([invanare, h]);
    await granskaHar(`${invanare} ${h}`);
  }
  console.log(`Granskade ${vyLista.length} vyer på 1440 px.`);

  // Ett fel i ett formulär (3.3.1): en sökning på ett tecken ger ett fel från servern, som ska markeras vid fältet,
  // beskrivas med text som hör till fältet och få fokus.
  try {
    await loggaIn(page, 'lak-akut');
    await gaTill(page, '#/sok?q=x');
    await page.waitForFunction(() => document.querySelector('#sokform [aria-invalid="true"]') && document.querySelector('#sokform .form-fel:not([hidden])')?.textContent.trim(), null, { timeout: 5000 });
    const r = await page.evaluate(() => {
      const f = document.querySelector('#sokform [aria-invalid="true"]');
      const ruta = document.querySelector('#sokform .form-fel');
      const beskrivning = (f.getAttribute('aria-errormessage') ?? '').split(/\s+/).concat((f.getAttribute('aria-describedby') ?? '').split(/\s+/));
      return { fokus: document.activeElement === f, text: ruta.textContent.trim(), kopplad: Boolean(ruta.id && beskrivning.includes(ruta.id)) };
    });
    if (!/två tecken/.test(r.text)) nytt('felmarkering', `felet beskrivs inte med text (${r.text})`);
    if (!r.fokus) nytt('felmarkering', 'fokus flyttas inte till fältet med fel');
    if (!r.kopplad) nytt('felmarkering', 'feltexten är inte kopplad till fältet');
  } catch (e) { nytt('felmarkering', `sökningen: ${kort(e.message)}`); await sparat(page, 'fel'); }

  // Tangentbord utan mus (2.1.1 och 2.4.1): logga in, stäng nyheterna, öppna en patient och byt flik med tangenter.
  // Runda 10, r1: sidan sparas som skärmbild när steget misslyckas, och felet säger var sidan var.
  let tp = null;
  try {
    const k = await kontext({ width: 1440, height: 900 });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    tp = p;
    bevaka(p, 'tangentbord');
    await p.goto(`${BAS}/#/`);
    await p.waitForSelector('.roll');
    await p.keyboard.press('Tab');
    if ((await p.evaluate(() => document.activeElement?.textContent?.trim())) !== 'Hoppa till innehållet') throw new Error('första tabbstoppet är inte länken till innehållet');
    await p.keyboard.press('Enter');
    // Tabba till Sara Lindqvists roll och tryck Enter.
    let hittad = false;
    for (let i = 0; i < 60 && !hittad; i++) { await p.keyboard.press('Tab'); hittad = await p.evaluate(() => document.activeElement?.dataset?.roll === 'lak-kard'); }
    if (!hittad) throw new Error('rollen gick inte att nå med tabb');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-a="loggaut"]');
    await vantaKlar(p);
    // Nyhetsrutan stängs med tangentbordet.
    hittad = false;
    await p.evaluate(() => document.body.focus());
    for (let i = 0; i < 40 && !hittad; i++) { await p.keyboard.press('Tab'); hittad = await p.evaluate(() => document.activeElement?.dataset?.a === 'stang-nyheter'); }
    if (!hittad) throw new Error('knappen som stänger nyheterna gick inte att nå med tabb');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => !document.querySelector('.nyhetsruta'));
    if (!(await p.evaluate(() => document.activeElement?.closest('main')))) throw new Error('fokus hamnar inte i huvudinnehållet när nyheterna stängs');
    // Öppna Gunnar Åkesson i arbetslistan.
    hittad = false;
    for (let i = 0; i < 60 && !hittad; i++) { await p.keyboard.press('Tab'); hittad = await p.evaluate(() => /Gunnar Åkesson/.test(document.activeElement?.textContent ?? '') && document.activeElement.tagName === 'A'); }
    if (!hittad) throw new Error('patienten gick inte att nå med tabb');
    await p.keyboard.press('Enter');
    await p.waitForSelector('.patientband');
    await vantaKlar(p);
    hittad = false;
    for (let i = 0; i < 60 && !hittad; i++) { await p.keyboard.press('Tab'); hittad = await p.evaluate(() => document.activeElement?.closest?.('nav.flikar') && /Läkemedel/.test(document.activeElement.textContent)); }
    if (!hittad) throw new Error('fliken Läkemedel gick inte att nå med tabb');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => /lakemedel/.test(location.hash));
    await vantaKlar(p);
    // Escape stänger en dialog och lämnar fokus där det var.
    await k.close();
  } catch (e) { nytt('tangentbordFlode', `${kort(e.message)} (${tp?.url() ?? ''})`); if (tp) await sparat(tp, 'tangentbord'); }

  // Högkontrastläget: knappen och datorns inställning ger minst 7:1, och 4,5:1 för stor text.
  try {
    await loggaIn(page, 'lak-kard');
    const knapp = page.locator('[data-a="kontrast"]');
    if (!(await knapp.count())) throw new Error('knappen Hög kontrast saknas');
    await knapp.click();
    if ((await knapp.getAttribute('aria-pressed')) !== 'true') throw new Error('knappen visar inte att högkontrastläget är på');
    for (const h of ['#/arbetslista', '#/inkorg', '#/patient/p01', '#/patient/p01/matvarden', '#/patient/p01/lakemedel', '#/krav', '#/utbildning']) {
      await gaTill(page, h);
      const r = await page.evaluate(granskaSida, { kontrastKrav: 7, storKrav: 4.5 });
      for (const f of r.kontrast) nytt('hogKontrast', `knappen ${h}: ${f}`);
    }
    await page.reload();
    await vantaKlar(page);
    if ((await page.locator('[data-a="kontrast"]').getAttribute('aria-pressed')) !== 'true') throw new Error('högkontrastläget sparas inte');
    await page.locator('[data-a="kontrast"]').click();
    await page.evaluate(() => { try { localStorage.removeItem('vk-kontrast'); } catch { /* ingen lagring */ } });
    // Datorns inställning, utan knappen.
    const k = await kontext({ width: 1440, height: 900 }, { contrast: 'more' });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'hög kontrast');
    await loggaIn(p, 'ssk-kard');
    if ((await p.locator('[data-a="kontrast"]').getAttribute('aria-pressed')) !== 'true') throw new Error('datorns inställning för hög kontrast följs inte');
    for (const h of ['#/arbetslista', '#/patient/p01/matvarden']) {
      await gaTill(p, h);
      const r = await p.evaluate(granskaSida, { kontrastKrav: 7, storKrav: 4.5 });
      for (const f of r.kontrast) nytt('hogKontrast', `datorns inställning ${h}: ${f}`);
    }
    await k.close();
  } catch (e) { nytt('hogKontrast', kort(e.message)); }

  // Minskade rörelser: inga animationer eller övergångar.
  try {
    const k = await kontext({ width: 1440, height: 900 }, { reducedMotion: 'reduce' });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'minskade rörelser');
    await loggaIn(p, 'lak-kard');
    for (const h of ['#/arbetslista', '#/patient/p01', '#/inkorg']) {
      await gaTill(p, h);
      await p.evaluate(() => { const n = document.createElement('div'); n.className = 'notis notis-ok'; document.getElementById('notiser').append(n); setTimeout(() => n.remove(), 400); });
      const r = await p.evaluate(() => {
        const ut = [];
        for (const el of document.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          const tid = (s) => Math.max(...s.split(',').map(x => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)));
          if (cs.animationName !== 'none' && tid(cs.animationDuration) > 1) ut.push(`${el.tagName.toLowerCase()}.${el.className}: animation ${cs.animationName}`);
          if (tid(cs.transitionDuration) > 1) ut.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: övergång ${cs.transitionDuration}`);
        }
        if (getComputedStyle(document.documentElement).scrollBehavior === 'smooth') ut.push('mjuk rullning');
        return [...new Set(ut)];
      });
      for (const f of r) nytt('rorelse', `${h}: ${f}`);
    }
    await k.close();
  } catch (e) { nytt('rorelse', kort(e.message)); }

  // Justerbar tidsgräns (K2 1.6.1): varningen fem minuter före utloggningen läses upp, Fortsätt arbeta förlänger, och text
  // som inte är sparad blir ett utkast som finns kvar efter en ny inloggning.
  try {
    const k = await kontext({ width: 1440, height: 900 });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'tidsgräns');
    await loggaIn(p, 'lak-kard');
    const demo = (sekunder) => p.evaluate(async (s) => { const { api } = await import('/js/ui.js'); await api('/api/demo/inloggning-gar-ut', { metod: 'POST', data: { sekunder: s } }); }, sekunder);
    await demo(200);
    await p.waitForSelector('#tidsgrans');
    const v = await p.evaluate(() => {
      const el = document.getElementById('tidsgrans');
      const namn = document.getElementById(el.getAttribute('aria-labelledby'))?.textContent;
      const besk = document.getElementById(el.getAttribute('aria-describedby'))?.textContent;
      return { roll: el.getAttribute('role'), namn, besk, fokus: document.activeElement?.dataset?.a };
    });
    if (v.roll !== 'alertdialog' || !v.namn || !/loggas ut klockan/.test(v.besk ?? '')) nytt('tidsgrans', `varningen läses inte upp som en varning med namn och text (${JSON.stringify(v)})`);
    if (v.fokus !== 'forlang') nytt('tidsgrans', 'fokus står inte på Fortsätt arbeta');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => !document.getElementById('tidsgrans'));
    const garUt = await p.evaluate(async () => (await (await fetch('/api/session')).json()).inloggning?.garUt);
    if (!(Date.parse(garUt) > Date.now() + 29 * 60_000)) nytt('tidsgrans', `Fortsätt arbeta förlängde inte inloggningen (${garUt})`);
    // Text i en ny anteckning, och sedan låter användaren tiden gå ut.
    await gaTill(p, '#/patient/p01/journal/ny');
    await p.fill('textarea[data-sokord="Aktuellt"]', 'Text som inte hann sparas före utloggningen.');
    await demo(24);
    await p.waitForSelector('#tidsgrans');
    await p.waitForSelector('.roll', { timeout: 20000 });
    const notiser = await p.locator('#notiser').textContent();
    if (!/sparat som utkast/.test(notiser)) nytt('tidsgrans', `utloggningen säger inte att texten är sparad (${notiser.trim().slice(0, 120)})`);
    await p.click('[data-roll="lak-kard"]');
    await p.waitForSelector('[data-a="loggaut"]');
    await vantaKlar(p);
    const utkast = await p.evaluate(async () => JSON.stringify((await (await fetch('/api/patient/p01/anteckningar')).json()).anteckningar.filter(a => a.status === 'utkast')));
    if (!utkast.includes('Text som inte hann sparas')) nytt('tidsgrans', 'texten finns inte som utkast efter den nya inloggningen');
    await k.close();
  } catch (e) { nytt('tidsgrans', kort(e.message)); }

  // Förstoring, omflyttning och skärmarna. Varje vy i listan visas i varje storlek.
  const STORLEKAR = [
    { namn: 'zoom', vp: { width: 640, height: 450 }, kontroll: 'zoom', etikett: '200 procent (640 px)' },
    { namn: 'omflyttning', vp: { width: 320, height: 640 }, kontroll: 'omflyttning', etikett: '320 px' },
    { namn: 'mobil', vp: { width: 360, height: 760 }, kontroll: 'skarmar', etikett: 'mobil 360 px' },
    { namn: 'platta', vp: { width: 768, height: 1024 }, kontroll: 'skarmar', etikett: 'platta 768 px' },
    { namn: 'platta-liggande', vp: { width: 1024, height: 768 }, kontroll: 'skarmar', etikett: 'platta 1024 px' },
    { namn: 'stor', vp: { width: 2560, height: 1440 }, kontroll: 'skarmar', etikett: 'stor skärm 2560 px', maxTecken: 170 },
  ];
  for (const st of STORLEKAR) {
    const k = await kontext(st.vp, st.namn === 'zoom' ? { deviceScaleFactor: 2 } : {});
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, st.namn);
    let inloggad = null;
    for (const [roll, h] of vyLista) {
      try {
        if (roll !== inloggad) {
          if (roll === 'ute') { await p.goto(`${BAS}/#/`); await p.waitForLoadState('networkidle'); if (await p.locator('[data-a="loggaut"]').count()) await p.click('[data-a="loggaut"]'); }
          else await loggaIn(p, roll);
          inloggad = roll;
        }
        if (roll === 'ute') { await p.goto(`${BAS}/${h}`); await vantaKlar(p); } else await gaTill(p, h);
        for (const f of await p.evaluate(granskaLayout, { bredd: st.vp.width, maxTecken: st.maxTecken ?? null })) nytt(st.kontroll, `${st.etikett} ${roll} ${h}: ${f}`);
      } catch (e) { nytt(st.kontroll, `${st.etikett} ${roll} ${h}: ${kort(e.message)}`); }
    }
    await k.close();
    console.log(`Granskade ${vyLista.length} vyer vid ${st.etikett}.`);
  }

  // ---- Utbildning: nyhetsrutan, hjälpen och övningarna ----
  const utb = [];
  const provaUtb = async (namn, fn) => {
    const fore = sidfel.length;
    try { await fn(); if (sidfel.length > fore) throw new Error(sidfel.slice(fore).join('; ')); utb.push({ namn, status: 'grön' }); console.log(`ok  ${namn}`); } catch (e) { utb.push({ namn, status: 'röd', fel: kort(e.message) }); console.log(`FEL ${namn}: ${kort(e.message)}`); await sparat(page, 'utbildning'); }
  };
  await provaUtb(G.nyheter, async () => {
    const k = await kontext({ width: 1440, height: 900 });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'nyheter');
    // Runda 8: vad rutan ska visa för rollen läses från servern, så att kontrollen gäller varje ny version. Läkaren och
    // sjuksköterskan har nyheter i den aktuella versionen.
    const nyheterFor = () => p.evaluate(() => fetch('/api/nyheter').then(r => r.json()));
    await loggaIn(p, 'lak-kard');
    const lak = await nyheterFor();
    const ruta = p.locator('.nyhetsruta');
    await ruta.waitFor();
    const text = await ruta.textContent();
    for (const n of lak.ruta.nyheter) if (!text.includes(n.rubrik)) throw new Error(`läkarens nyhet saknas: ${n.rubrik}`);
    const aldre = lak.alla.slice(1).flatMap(v => v.nyheter.map(n => n.rubrik)).filter(r => !lak.ruta.nyheter.some(n => n.rubrik === r));
    if (aldre.some(r => text.includes(r))) throw new Error('rutan visar en äldre version');
    await p.click('[data-a="stang-nyheter"]');
    await p.waitForFunction(() => !document.querySelector('.nyhetsruta'));
    await loggaIn(p, 'ssk-kard');
    const ssk = await nyheterFor();
    await ruta.waitFor();
    const sskText = await ruta.textContent();
    const baraLakare = lak.ruta.nyheter.filter(n => !ssk.ruta.nyheter.some(x => x.id === n.id));
    if (baraLakare.some(n => sskText.includes(n.rubrik))) throw new Error('sjuksköterskan ser läkarens nyhet');
    await loggaIn(p, 'lak-kard');
    if (await p.locator('.nyhetsruta').count()) throw new Error('rutan kommer tillbaka efter att den har stängts');
    await gaTill(p, '#/nyheter');
    const alla = await p.locator('main').textContent();
    if (!lak.alla.every(v => alla.includes(v.nyheter[0].rubrik))) throw new Error('nyheterna går inte att läsa igen');
    await p.screenshot({ path: join(UT, 'r7r2-nyheter.png') });
    await k.close();
  });
  await provaUtb(G.hjalp, async () => {
    const k = await kontext({ width: 1440, height: 900 });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'hjälp');
    const STALLEN = [
      ['lak-kard', '#/arbetslista', 'oppna-patient'], ['lak-kard', '#/patient/p01/journal', 'daganteckning'], ['lak-kard', '#/patient/p01/lakemedel', 'ordinera'],
      ['lak-kard', '#/inkorg', 'inkorg'], ['ssk-kard', '#/patient/p01/matvarden', 'matvarde'], ['ssk-kard', '#/administrering', 'ge-dos'],
      ['lak-vc', '#/patient/p01/remisser', 'remiss'], ['lak-akut', '#/sok', 'sok'], ['adm-kard', '#/idag', 'boka'],
      // Runda 8, r5.
      ['sysf', '#/regler', 'regler'],
    ];
    let inl = null;
    for (const [roll, h, id] of STALLEN) {
      if (roll !== inl) { await loggaIn(p, roll); inl = roll; }
      await gaTill(p, h);
      const d = p.locator(`details.flodeshjalp[data-hjalp="${id}"]`);
      if (!(await d.count())) throw new Error(`hjälpen ${id} saknas i ${h}`);
      await d.locator('summary').focus();
      await p.keyboard.press('Enter');
      if (!(await d.evaluate(x => x.open))) throw new Error(`hjälpen ${id} öppnas inte med Enter`);
      const t = await d.textContent();
      if (!/Det här gör systemet/.test(t)) throw new Error(`hjälpen ${id} säger inte vad systemet gör`);
      if (!(await d.locator('a[href="#/utbildning"]').count())) throw new Error(`hjälpen ${id} länkar inte till övningarna`);
      if (id === 'ordinera') await p.screenshot({ path: join(UT, 'r7r2-hjalp.png') });
    }
    await k.close();
  });
  await provaUtb(G.redigera, async () => {
    const k = await kontext({ width: 1440, height: 900 });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'redigera');
    await loggaIn(p, 'vch-kard');
    await gaTill(p, '#/utbildning');
    await p.click('[data-utbildare="far-kard"]');
    await p.waitForFunction(() => /Elsa Nordin är utbildare/.test(document.getElementById('notiser').textContent));
    await loggaIn(p, 'far-kard');
    await gaTill(p, '#/utbildning');
    if (!/Du kan ändra övningarna/.test(await p.locator('[data-utbildare]').textContent())) throw new Error('utbildaren ser inte att hon kan ändra övningarna');
    await p.click('[data-oppna-redigering]');
    const forsta = p.locator('.ov-red').first();
    await forsta.locator('summary').click();
    // Ett fel prövas först: en tom fråga.
    await forsta.locator('[name="fraga"]').fill('');
    await p.fill('#ov-andring', 'Tydligare fråga om loggen.');
    await p.click('[data-a="spara-ovningar"]');
    await p.waitForFunction(() => /Övning 1: frågan ska vara/.test(document.getElementById('ov-red-fel')?.textContent ?? ''));
    if (!(await p.evaluate(() => document.activeElement?.name === 'fraga' && document.activeElement.getAttribute('aria-invalid') === 'true'))) throw new Error('fältet med fel får inte fokus och markering');
    await forsta.locator('[name="fraga"]').fill('Vad händer när du läser journalen för en patient i Vårdkällan?');
    await p.click('[data-a="spara-ovningar"]');
    await p.waitForFunction(() => /Version 2 av övningarna är sparad/.test(document.getElementById('notiser').textContent));
    const h = await p.locator('[data-ov-historik] tbody tr').first().textContent();
    if (!/2/.test(h) || !/Elsa Nordin/.test(h) || !/Tydligare fråga om loggen/.test(h)) throw new Error(`historiken visar inte den nya versionen: ${h}`);
    await p.screenshot({ path: join(UT, 'r7r2-ovningar.png'), fullPage: false });
    await k.close();
  });
  await provaUtb(G.intyg, async () => {
    const k = await kontext({ width: 1440, height: 900 });
    await k.addInitScript(INIT);
    const p = await k.newPage();
    bevaka(p, 'intyg');
    await loggaIn(p, 'usk-kard');
    await gaTill(p, '#/utbildning');
    if (!/Inget intyg/.test(await p.locator('[data-intyg]').textContent())) throw new Error('undersköterskan har redan ett intyg');
    // Fel svar först: förklaringar men inget intyg.
    const fragor = await p.locator('fieldset.ovning').count();
    if (fragor < 3) throw new Error(`${fragor} övningar`);
    for (let i = 0; i < fragor; i++) await p.locator('fieldset.ovning').nth(i).locator('input[type="radio"]').first().check();
    await p.click('[data-a="ratta"]');
    await p.locator('[data-resultat]').waitFor();
    if (!/av \d+ rätt/.test(await p.locator('[data-resultat]').textContent())) throw new Error('resultatet visas inte');
    if (!/Inget intyg/.test(await p.locator('[data-intyg]').textContent())) throw new Error('fel svar gav ett intyg');
    // Rätt svar: alternativ b är rätt i demons övningar.
    for (let i = 0; i < fragor; i++) await p.locator('fieldset.ovning').nth(i).locator('input[value="b"]').check();
    await p.click('[data-a="ratta"]');
    await p.waitForFunction(() => /Giltigt intyg/.test(document.querySelector('[data-intyg]')?.textContent ?? ''));
    if (!/Giltigt till/.test(await p.locator('[data-intyg]').textContent())) throw new Error('intyget visar inte hur länge det gäller');
    await p.screenshot({ path: join(UT, 'r7r2-intyg.png'), fullPage: true });
    await loggaIn(p, 'vch-kard');
    await gaTill(p, '#/utbildning');
    const tabell = p.locator('[data-intyg-enhet]');
    await tabell.waitFor();
    const t = await tabell.textContent();
    for (const x of ['Amira Haddad', 'Giltigt intyg', 'Intyget har gått ut', 'Inget intyg', 'Går ut om']) if (!t.includes(x)) throw new Error(`vårdenhetens intyg saknar ${x}`);
    await p.screenshot({ path: join(UT, 'r7r2-intyg-enhet.png'), fullPage: true });
    await k.close();
  });

  // Runda 10, r3: röstinmatningen. Utan igenkänning på enheten frågar Diktera först i en dialog som läses upp, och
  // användaren måste välja att fortsätta. Valet sparas per användare. Med igenkänning på enheten kommer ingen fråga.
  {
    const namn = `${PREFIX.GT}röstinmatningen frågar i en dialog innan ljudet går till webbläsarens tjänst när igenkänning på enheten saknas, valet sparas per användare, och med igenkänning på enheten kommer ingen fråga`;
    try {
      const k = await kontext({ width: 1440, height: 900 });
      await k.addInitScript(INIT);
      const p = await k.newPage();
      bevaka(p, 'diktera');
      const motor = (lokal) => p.evaluate((l) => {
        window.__vkTaligenkanning = class {
          static available(o) { return Promise.resolve(l && o?.processLocally ? 'available' : 'unavailable'); }
          start() {} stop() { setTimeout(() => this.onend?.(), 0); } abort() {}
        };
      }, lokal);
      const oppna = async () => { await gaTill(p, '#/arbetslista'); await gaTill(p, '#/patient/p01/journal/ny'); await p.waitForSelector('#ant-form [data-diktera]'); };
      const dialogFinns = () => p.evaluate(() => Boolean(document.querySelector('dialog[open].diktat-val')));
      const pagar = () => p.locator('#ant-form [data-diktera]').getAttribute('aria-pressed');
      await loggaIn(p, 'lak-kard');
      await p.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await oppna();
      await motor(false);
      await p.click('#ant-form [data-diktera]');
      await p.waitForSelector('dialog[open].diktat-val');
      const d = await p.evaluate(() => {
        const el = document.querySelector('dialog[open].diktat-val');
        return { namn: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent, text: el.querySelector('[data-moln-text]')?.textContent, fokus: el.contains(document.activeElement) };
      });
      if (!d.namn || !/webbläsarens leverantör/.test(d.text) || !/påhittade patienter/.test(d.text) || !d.fokus) throw new Error(`förklaringen saknas eller har inte namn och fokus (${JSON.stringify(d)})`);
      await p.click('dialog[open].diktat-val [data-varde="avbryt"]');
      await p.waitForFunction(() => !document.querySelector('dialog[open].diktat-val'));
      if (await pagar() !== 'false') throw new Error('dikteringen startade fast användaren avbröt');
      await p.click('#ant-form [data-diktera]');
      await p.click('dialog[open].diktat-val [data-varde="ok"]');
      await p.waitForFunction(() => document.querySelector('#ant-form [data-diktera]')?.getAttribute('aria-pressed') === 'true');
      await p.click('#ant-form [data-diktera]');
      // Valet är sparat: nästa gång startar dikteringen utan fråga.
      await oppna();
      await motor(false);
      await p.click('#ant-form [data-diktera]');
      await p.waitForFunction(() => document.querySelector('#ant-form [data-diktera]')?.getAttribute('aria-pressed') === 'true');
      if (await dialogFinns()) throw new Error('frågan kom igen fast valet var sparat');
      await p.click('#ant-form [data-diktera]');
      // En annan användare har inte valt, men med igenkänning på enheten kommer ingen fråga.
      await loggaIn(p, 'ssk-kard');
      await oppna();
      await motor(true);
      await p.click('#ant-form [data-diktera]');
      await p.waitForFunction(() => document.querySelector('#ant-form [data-diktera]')?.getAttribute('aria-pressed') === 'true');
      if (await dialogFinns()) throw new Error('frågan kom fast igenkänningen görs på enheten');
      if (!/på den här datorn/.test(await p.locator('#ant-form [data-diktat]').textContent())) throw new Error('rutan säger inte att igenkänningen görs på datorn');
      // Utan val och utan igenkänning på enheten frågar systemet den nya användaren.
      await p.click('#ant-form [data-diktera]');
      await oppna();
      await motor(false);
      await p.click('#ant-form [data-diktera]');
      await p.waitForSelector('dialog[open].diktat-val');
      await k.close();
      tester.push({ namn, status: 'grön' });
      console.log('ok  röstinmatningens fråga om webbläsarens tjänst');
    } catch (e) {
      tester.push({ namn, status: 'röd', fel: kort(e.message) });
      console.log(`FEL röstinmatningens fråga om webbläsarens tjänst: ${kort(e.message)}`);
    }
  }

  // ---- Resultatet ----
  const tillg = [
    [G.media, ['media']], [G.alt, ['alt']], [G.namn, ['namn']], [G.rubriker, ['rubriker']], [G.landmarken, ['landmarken']], [G.sprak, ['sprak']],
    [G.kontrast, ['kontrast']], [G.komponentkontrast, ['komponent']], [G.farg, ['farg']], [G.zoom, ['zoom']], [G.omflyttning, ['omflyttning']],
    [G.tangentbord, ['tangentbord']], [G.fokusordning, ['fokusordning']], [G.synligtFokus, ['synligtFokus']], [G.tangentbordFlode, ['tangentbordFlode']],
    [G.vidFokus, ['vidFokus']], [G.felmarkering, ['felmarkering']], [G.hogKontrast, ['hogKontrast']], [G.rorelse, ['rorelse']], [G.skarmar, ['skarmar']],
    [G.tidsgrans, ['tidsgrans']],
  ];
  for (const [namn, kontroller] of tillg) {
    const lista = kontroller.flatMap(k => [...(fynd[k] ?? [])]);
    const t = { namn, status: lista.length ? 'röd' : 'grön' };
    if (lista.length) t.fel = `${lista.length} fynd, till exempel ${lista[0]}`;
    tester.push(t);
    console.log(`${lista.length ? 'FEL' : 'ok '} ${namn.replace(PREFIX.GT, '')}${lista.length ? ` (${lista.length})` : ''}`);
    for (const f of lista.slice(0, VISA ? 10000 : 6)) console.log(`      ${f}`);
  }
  if (sidfel.length) { console.log(`Sidfel och konsolfel: ${sidfel.length}`); for (const f of sidfel.slice(0, 10)) console.log(`      ${f}`); }
  // Sidfel under granskningen gör alla granskningar osäkra.
  if (sidfel.length) for (const t of tester) if (t.status === 'grön') { t.status = 'röd'; t.fel = sidfel[0]; }
  const version = `Chromium ${browser.version()}`;
  await browser.close();
  const hash = gransnittHash(join(APP, 'public'));
  skrivKlienttester({ app: APP, prefix: PREFIX.GT, tester, bas: BAS, webblasare: version, gransnittHash: hash });
  skrivKlienttester({ app: APP, prefix: PREFIX.GU, tester: utb, bas: BAS, webblasare: version, gransnittHash: hash });
  const roda = [...tester, ...utb].filter(t => t.status !== 'grön');
  console.log(`\nTillgänglighet: ${tester.length + utb.length - roda.length} av ${tester.length + utb.length} gröna. Resultatet finns i app/klienttest-resultat.json`);
  process.exit(roda.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
