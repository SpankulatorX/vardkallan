// Sussas användbarhetstester som automatiska tester (runda 7, r1, K4 och Sussa 8.4.1.1 och 8.4.1.2). Spelar varje
// testfall i Bilaga F1:4 som Vårdkällan kan genomföra, i gränssnittet och med rätt roll, och mäter det som Sussa mätte
// när Cosmic utvärderades (Bilaga F1:2): om slutvillkoret nås (mätning 1, måluppfyllelse) och hur lång tid det tar
// (mätning 2, effektivitet). Registret med testfallen, tidsklasserna, poängen och tidsmodellen finns i
// app/src/sussa-testfall.js och testdatan i app/src/seed/sussa-testdata.js.
//
// Varje steg görs med en riktig interaktion och räknas som i klickbudgeten (test/flodessteg.cjs): klick, fältbyten,
// listval och tangenter, och dessutom antalet tecken som skrivs. Tiden för en människa uppskattas med
// keystroke-level model ur stegen och tecknen, plus den tid som skriptet själv väntade på gränssnittet. Resultatet skrivs
// till app/sussa-testfall.json med en hash av public/, och kravsidan visar det per testfall under K4.
//
// Före varje testfall återställs demon och testdatan läggs in (POST /api/demo/sussa-testfall), så att varje testfall
// börjar från samma läge, som Sussa krävde av testpaketen. Testfallet börjar på rollens startsida efter inloggningen,
// så att det ingår att hitta patienten.
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/sussa-testfall.cjs [bas-url]
// Standard för bas-url är http://127.0.0.1:18797.

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
const { synlig, gaTill, loggaIn } = skapa(BAS);

// Matare räknar dessutom tecknen som skrivs, för tidsuppskattningen.
class SussaMatare extends Matare {
  nollstall() { super.nollstall(); this.tecken = 0; }
  async skriv(loc, varde, text) { await super.skriv(loc, varde, text); this.tecken += [...varde].length; }
}

const post = (page, vag) => page.evaluate(async (v) => {
  const r = await fetch(v, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  return { ok: r.ok, text: await r.text() };
}, vag);

// Rollens startsida efter inloggningen: Dagens arbete för vårdadministratören, annars arbetslistan.
async function startsida(page, roll) {
  // Sidan laddas om från en tom sida, så att vyn hämtas från den nya sandlådan.
  await page.goto('about:blank');
  if (roll === 'adm-kard') { await gaTill(page, '#/idag'); await page.waitForSelector('#idag-dagens'); return; }
  await gaTill(page, '#/arbetslista');
  await page.waitForSelector('#lista table');
}

async function oppnaFranLista(m, page, namn) {
  await m.klicka(page.locator('a.patientlank', { hasText: namn }).first(), `${namn} i arbetslistan`);
  await page.waitForSelector('.tidslinje');
}
async function sok(m, page, sokord, namn) {
  await m.klicka(page.locator('#meny-lista a[href="#/sok"]'), 'Sök patient i menyn');
  await page.waitForSelector('#sokfalt');
  await m.skriv(page.locator('#sokfalt'), sokord, 'sökfältet');
  await m.tangent('Enter', 'sök');
  await m.klicka(page.locator('#traffar a', { hasText: namn }).first(), `träffen ${namn}`);
  await page.waitForSelector('.tidslinje');
}

// Flödena, ett per testfall. Varje flöde slutar med att kontrollera Sussas slutvillkor i gränssnittet.
function floden(D) {
  return {
    '2.1': async (m, page) => {
      await oppnaFranLista(m, page, 'Mira Axelsson');
      await m.klicka(page.locator('.snabbval a', { hasText: 'Skicka remiss' }), 'Skicka remiss');
      await page.waitForSelector('#remissform');
      await m.valj(page.locator('select[name="tillEnhetId"]'), 'uso-med', 'mottagare Medicinska kliniken USÖ');
      await m.skriv(page.locator('textarea[name="fragestallning"]'), D.REMISS_2_1.fragestallning, 'frågeställning');
      await m.skriv(page.locator('textarea[name="anamnes"]'), D.REMISS_2_1.anamnes, 'anamnes');
      await m.klicka(page.locator('#remissform [type="submit"]'), 'Skicka remissen');
      await synlig(page, '.notis', 'Remissen är skickad');
    },
    '2.6': async (m, page) => {
      await oppnaFranLista(m, page, 'Sara Sandmark');
      await m.klicka(page.locator('.flikar a', { hasText: 'Remisser' }), 'fliken Remisser');
      await m.klicka(page.locator('[data-remiss-atgard="svara"]').first(), 'Svara');
      await page.locator('dialog[open] textarea').waitFor();
      await m.skriv(page.locator('dialog[open] textarea'), D.SVAR_2_6, 'svaret');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skicka svaret');
      await synlig(page, '.notis', 'Svaret är skickat till remittenten');
    },
    '3.4': async (m, page) => {
      await oppnaFranLista(m, page, 'Bertil Danielsson');
      await m.klicka(page.locator('.flikar a', { hasText: 'Mätvärden' }), 'fliken Mätvärden');
      await m.klicka(page.locator('[data-val="andra_enheter"]').first(), 'Visa uppgifter från andra vårdenheter');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-forslag]').first(), 'syftet som systemet föreslår');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Visa uppgifterna');
      // Slutvillkoret: raden med PK taget klockan 11.36 på vårdcentralen visar 0,9 INR.
      const rad = page.locator('tr', { hasText: `kl. ${D.PK_SVAR.klocka}` }).filter({ hasText: 'PK (INR)' });
      await rad.first().waitFor({ timeout: 10000 });
      const text = await rad.first().innerText();
      if (!text.includes('0,9 INR') || !text.includes('Vårdcentralen Tybble')) throw new Error(`fel provsvar: ${text}`);
    },
    '4.2': async (m, page) => {
      await oppnaFranLista(m, page, 'Sara Sandmark');
      await m.klicka(page.locator('.snabbval a', { hasText: 'Registrera mätvärde' }), 'Registrera mätvärde');
      await page.waitForSelector('#mv-form');
      await m.skriv(page.locator('#mv-varde'), '140/90', 'blodtrycket');
      await m.klicka(page.locator('#mv-form [type="submit"]'), 'Registrera');
      await synlig(page, '.notis', 'Blodtryck 140/90');
      for (const [typ, namn, varde] of [['langd', 'Längd', '165'], ['vikt', 'Vikt', '75'], ['puls', 'Puls', '83']]) {
        await page.waitForSelector('#mv-form #mv-typ');
        await m.valj(page.locator('#mv-typ'), typ, `mätvärdet ${namn}`);
        await m.skriv(page.locator('#mv-varde'), varde, `värdet för ${namn.toLowerCase()}`);
        await m.klicka(page.locator('#mv-form [type="submit"]'), 'Registrera');
        await synlig(page, '.notis', `${namn} ${varde}`);
      }
    },
    '4.3': async (m, page) => {
      await oppnaFranLista(m, page, 'Anna Karlsson');
      await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
      await page.waitForSelector('#ant-form');
      await m.valj(page.locator('#ny-mall'), 'Epikris', 'mallen Epikris');
      await m.skriv(page.locator('textarea[data-sokord="Orsak till vård"]'), D.ANNA_EPIKRIS.orsak, 'Orsak till vård');
      await m.skriv(page.locator('textarea[data-sokord="Förlopp"]'), D.ANNA_EPIKRIS.forlopp, 'Förlopp');
      await m.skriv(page.locator('textarea[data-sokord="Uppföljning"]'), D.ANNA_EPIKRIS.uppfoljning, 'Uppföljning');
      await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
      await synlig(page, '.anteckning', 'Sepsis, A41.9');
      await synlig(page, '.anteckning .ant-fakta', 'Signerad');
    },
    '4.4': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
      await m.klicka(page.locator('[data-signera-alla]'), 'Granska och signera alla');
      await page.locator('dialog[open] .ik-granska').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Signera alla');
      await synlig(page, '.notis', '30 anteckningar är signerade');
      await synlig(page, '#ik-osign ~ .tom', 'Inga osignerade anteckningar');
    },
    '5.4': async (m, page) => {
      await sok(m, page, 'Svedin', 'Susanne Svedin');
      await m.klicka(page.locator('.ov-tider [data-tider="avboka"]').first(), 'Avboka');
      await page.locator('dialog[open] input[name="orsak"]').waitFor();
      await m.skriv(page.locator('dialog[open] input[name="orsak"]'), 'Vill boka om, inga lediga tider', 'orsaken');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Avboka');
      await synlig(page, '.notis', 'Tiden är avbokad');
      await synlig(page, '.ov-tider', 'Väntar på tid');
    },
    '5.5': async (m, page) => {
      await m.klicka(page.locator('#idag-dagens tr', { hasText: 'Sofia Andersson' }).locator('[data-atgard="checka_in"]'), 'Checka in för Sofia Andersson');
      await synlig(page, '.notis', 'Sofia Andersson är incheckad');
    },
    '5.6': async (m, page) => {
      await m.klicka(page.locator('.snabbval a[href="#/tidbok"]'), 'Min tidbok i arbetslistan');
      await page.waitForSelector('.tb-bokning');
      const incheckade = await page.locator('.tb-bokning', { hasText: 'Incheckad' }).allInnerTexts();
      const namn = D.ANKOMNA.map(id => D.namn[id]);
      if (incheckade.length !== 5 || !namn.every(n => incheckade.some(t => t.includes(n)))) throw new Error(`incheckade: ${incheckade.join(', ')}`);
    },
    '5.7': async (m, page) => {
      await sok(m, page, 'Gerda', 'Gerda Ström');
      await m.klicka(page.locator('[data-vk="registrera"]'), 'Registrera vårdkontakt');
      await page.locator('dialog[open]').waitFor();
      const orsak = page.locator('dialog[open] input[name="orsak"]');
      if (await orsak.count() && !(await orsak.inputValue())) await m.skriv(orsak, 'Akut besök, oplanerat', 'orsaken');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
      await synlig(page, '.notis', 'är registrerat');
      await synlig(page, '.vk-lista', 'Akut besök, oplanerat');
    },
    '5.8': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/vantelista"]'), 'Väntelista i menyn');
      await m.klicka(page.locator('#vl-lista tr', { hasText: 'Jonas Brun' }).locator('[data-vl="boka"]'), 'Boka tid för Jonas Brun');
      await page.locator('dialog[open] .forslag-knapp').first().waitFor();
      await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
      await synlig(page, '.notis', 'Jonas Brun har fått en tid');
      await synlig(page, '.notis', 'Kallelsen är skickad');
    },
    '6.1': async (m, page) => {
      await oppnaFranLista(m, page, 'Mira Axelsson');
      await m.klicka(page.locator('[data-vk="skriv-in"]'), 'Skriv in');
      await page.locator('dialog[open]').waitFor();
      const orsak = page.locator('dialog[open] input[name="orsak"]');
      if (!(await orsak.inputValue())) await m.skriv(orsak, 'Feber och frossa', 'orsaken');
      await m.skriv(page.locator('dialog[open] input[name="plats"]'), 'Avd 72, sal 5, säng 1', 'sal och säng');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skriv in');
      await synlig(page, '.notis', 'Patienten är inskriven på Avdelning 72');
      await synlig(page, '.vardtillfalle', 'Avd 72, sal 5, säng 1');
    },
    '6.2': async (m, page) => {
      await oppnaFranLista(m, page, 'Fatima Baskar');
      await m.klicka(page.locator('.vardtillfalle [data-vk="flytta"]'), 'Flytta');
      await page.locator('dialog[open]').waitFor();
      await m.valj(page.locator('dialog[open] select[name="enhetId"]'), 'uso-ort', 'Ortopediska kliniken USÖ');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Flytta');
      await synlig(page, '.notis', 'Patienten ligger nu på Ortopediska kliniken USÖ');
    },
    '6.3': async (m, page) => {
      await oppnaFranLista(m, page, 'Bertil Danielsson');
      await m.skriv(page.locator('#jsok-falt'), 'epikris', 'sökfältet i journalen');
      await m.tangent('Enter', 'sök');
      await m.klicka(page.locator('.jsok-traff a[data-traff="anteckning"]', { hasText: 'Epikris' }).first(), 'träffen Epikris');
      await synlig(page, '.anteckning .ant-huvud h2', 'Epikris');
      await synlig(page, '.anteckning', 'Sepsis');
    },
  };
}

(async () => {
  const R = await import(pathToFileURL(join(APP, 'src', 'sussa-testfall.js')).href);
  const D0 = await import(pathToFileURL(join(APP, 'src', 'seed', 'sussa-testdata.js')).href);
  const { gransnittHash } = await import(pathToFileURL(join(APP, 'src', 'klientresultat.js')).href);
  const D = { ...D0, ANKOMNA: D0.ANKOMNA_5_6, namn: Object.fromEntries(D0.SUSSA_PATIENTER.map(p => [p.id, `${p.fornamn} ${p.efternamn}`])) };
  const FLODEN = floden(D);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  await raknaISidan(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => fel.push(`sidfel: ${e.message}`));
  page.on('response', r => { if (r.status() === 401) fel.push(`401: ${r.request().method()} ${r.url()}`); });
  page.on('console', msg => { if (msg.type() === 'error' && !/status of 403/.test(msg.text())) fel.push(`konsolfel: ${msg.text()}`); });
  const m = new SussaMatare(page);
  const resultat = [];
  let roll = null;

  for (const { x, k } of R.KORNINGAR) {
    const r = { nr: x.nr, titel: x.titel, tema: x.tema, roll: R.ROLLER[k.roll].namn, demoroll: k.demoroll, tidsklass: x.tidsklass, tidsklassSkal: x.tidsklassSkal, budget: k.budget, motivering: k.motivering, avvikelser: x.avvikelser, slut: x.slut, uppnatt: false };
    try {
      if (!FLODEN[x.nr]) throw new Error('flödet saknas i skriptet');
      if (roll !== k.demoroll) { await page.goto('about:blank'); await loggaIn(page, k.demoroll); roll = k.demoroll; }
      // Demon återställs och testdatan läggs in utanför mätningen, från en sida utan patientuppgifter, så att inget anrop
      // från förra testfallets vy går till den nya sandlådan.
      await gaTill(page, '#/moduler');
      const a = await post(page, '/api/reset');
      const b = await post(page, '/api/demo/sussa-testfall');
      if (!a.ok || !b.ok) throw new Error(`testdatan kunde inte läggas in: ${b.text}`);
      await startsida(page, k.demoroll);
      await m.borja();
      const t0 = Date.now();
      await FLODEN[x.nr](m, page);
      const ms = Date.now() - t0;
      await m.kontrollera();
      const listval = m.listval;
      const klick = m.klick - 2 * listval;
      const klm = R.klmTid({ klick, listval, faltbyten: m.faltbyten, tecken: m.tecken, tangenter: m.tangenter, svarstidMs: ms });
      Object.assign(r, {
        uppnatt: true, klick: m.klick, listval, faltbyten: m.faltbyten, tangenter: m.tangenter, tecken: m.tecken, uppmatt: m.uppmatt,
        inomBudget: m.uppmatt <= k.budget, skriptetsTidMs: ms, uppskattadTidS: klm.sekunder, klmDelar: klm.delar, steg: m.steg,
      });
      r.malpoang = R.malpoang({ uppnatt: true, steg: r.uppmatt, budget: k.budget });
      r.tidspoang = R.tidspoang(r.uppskattadTidS, x.tidsklass);
      console.log(`${r.inomBudget ? 'ok ' : 'ÖVER'} ${x.nr} ${x.titel} (${k.demoroll}): ${r.uppmatt} steg (budget ${k.budget}), ${r.tecken} tecken, uppskattat ${r.uppskattadTidS} s, poäng ${r.malpoang} och ${r.tidspoang}`);
      if (!r.inomBudget) fel.push(`${x.nr} ${x.titel} (${k.demoroll}): ${r.uppmatt} steg, budget ${k.budget}`);
    } catch (e) {
      r.fel = e.message.split('\n')[0];
      r.malpoang = 0; r.tidspoang = 0;
      fel.push(`${x.nr} ${x.titel} (${k.demoroll}): ${r.fel}`);
      console.log(`FEL ${x.nr} ${x.titel} (${k.demoroll}): ${r.fel}`);
      await page.screenshot({ path: join(UT, `00-fel-sussa-${x.nr}-${k.demoroll}.png`), fullPage: true }).catch(() => {});
    }
    resultat.push(r);
  }

  const ut = {
    tid: new Date().toISOString(), bas: BAS, webblasare: `Chromium ${browser.version()}`, gransnittHash: gransnittHash(join(APP, 'public')),
    kalla: R.KALLA, klm: R.KLM, klmSteg: R.KLM_STEG,
    testfall: resultat,
    ejGenomforbara: R.TESTFALL.filter(x => !x.korningar.length).map(x => ({ nr: x.nr, titel: x.titel, roller: x.roller.map(r => R.ROLLER[r].namn), saknas: x.saknas })),
    tester: R.KORNINGAR.map(({ x, k }) => { const r = resultat.find(y => y.nr === x.nr && y.demoroll === k.demoroll); return { namn: R.testfallTest(x, k), status: r && r.uppnatt && r.inomBudget && !r.fel ? 'grön' : 'röd' }; }),
  };
  ut.sammanstallning = R.sammanstall(ut);
  writeFileSync(join(APP, 'sussa-testfall.json'), `${JSON.stringify(ut, null, 2)}\n`);

  // Kravsidan visar resultatet per testfall under K4.
  try {
    await page.goto('about:blank');
    await gaTill(page, '#/krav?vy=egna');
    const k4 = page.locator('.krav', { has: page.locator('.krav-id', { hasText: /^K4$/ }) });
    await k4.locator('.st-tabell').waitFor();
    await k4.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById('notiser').replaceChildren());
    await page.waitForTimeout(250);
    await k4.screenshot({ path: join(UT, '110-sussas-testfall.png') });
  } catch (e) { fel.push(`kravsidan: ${e.message.split('\n')[0]}`); }

  await browser.close();
  const s = ut.sammanstallning;
  console.log(`\n${s.antalGenomforda} av ${s.antal} testfall genomförda i ${s.korningar} körningar. Mätning 1, alla testfall: ${s.alla.malupfyllelse} (${s.alla.poang.malupfyllelse} poäng), genomförda: ${s.genomforda.malupfyllelse}. Mätning 2, alla: ${s.alla.effektivitet} (${s.alla.poang.effektivitet} poäng), genomförda: ${s.genomforda.effektivitet}.`);
  if (fel.length) { console.log(`\nSussas testfall misslyckades:\n  ${fel.join('\n  ')}`); process.exit(1); }
  console.log('Alla genomförbara testfall når slutvillkoret inom klickbudgeten. Resultatet finns i app/sussa-testfall.json');
})().catch(e => { console.error(e); process.exit(1); });
