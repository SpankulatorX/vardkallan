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
  // Ett fält som systemet redan har fyllt i skrivs om: fältbyte om fältet inte har fokus, Ctrl+A och den nya texten.
  async ersatt(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    if (!(await loc.inputValue())) return this.skriv(loc, varde, text);
    await this.skriv(loc, '', text);
    await this.tangent('Control+a', `markera texten i ${text}`);
    await this.page.keyboard.type(varde);
    this.tecken += [...varde].length;
  }
  // Ett datumfält: ett fältbyte till fältets första del (året) och siffrorna.
  async datum(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    await loc.click({ position: { x: 12, y: 10 } });
    this.faltbyten++;
    this.steg.push(`fältbyte: ${text}`);
    const siffror = varde.replace(/-/g, '');
    await this.page.keyboard.type(siffror);
    this.tecken += siffror.length;
  }
}

// Ordinationsformuläret från patientens översikt (läkaren) eller läkemedelsfliken (sjuksköterskans muntliga ordination).
async function valjLakemedel(m, page, sok, namn) {
  await m.skriv(page.locator('#lm-sok'), sok, 'sök läkemedel');
  await m.klicka(page.locator('[data-lm]', { hasText: namn }).first(), `träffen ${namn}`);
  await page.waitForFunction(() => document.querySelector('#ordform input[name="lakemedelId"]')?.value);
  await page.waitForTimeout(300);
}
async function sparaOrdination(m, page, namn) {
  await m.klicka(page.locator('#ordform [data-spara]'), 'Kontrollera och spara');
  // En varning kvitteras med motivering i samma formulär.
  const kv = page.locator('#ordform [data-kvittera], #ordform textarea[name^="motivering"]');
  await synligEller(page, '.notis', `${namn}`, kv);
  // Läkemedelsfliken ritas om efter sparandet.
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.lm-tabell');
}
async function synligEller(page, sel, text, annan) {
  await Promise.race([page.locator(sel).filter({ hasText: text }).first().waitFor({ timeout: 10000 }), annan.first().waitFor({ timeout: 10000 }).then(() => { throw new Error(`varning vid ordinationen: ${text}`); })]);
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
    // Tema 1, läkemedelshantering (runda 7, r1).
    '1.1': async (m, page) => {
      await oppnaFranLista(m, page, 'Gerda Ström');
      // Första ordinationen från översikten, de följande från läkemedelsfliken som visas efter sparandet.
      const ny = async () => { const flik = page.locator('button[data-ny]:visible'); await m.klicka((await flik.count()) ? flik.first() : page.locator('.snabbval a', { hasText: 'Ordinera' }), 'Ordinera'); await page.waitForSelector('#ordform'); };
      await ny();
      await valjLakemedel(m, page, 'alvedon forte', 'Alvedon forte');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Värk', 'ordinationsorsak');
      await m.ersatt(page.locator('#ordform input[name="dosering"]'), '1 tablett 1 till 4 gånger dagligen vid behov, tillsvidare', 'dosering');
      await m.ersatt(page.locator('#ordform input[name="dos"]'), '1000', 'dos');
      await sparaOrdination(m, page, 'Alvedon forte är ordinerat');
      await ny();
      await valjLakemedel(m, page, 'kloramfenikol', 'ögondroppar');
      await m.skriv(page.locator('#ordform input[name="dosering"]'), '1 droppe 6 gånger dagligen i höger öga i 1 vecka', 'dosering');
      await m.valj(page.locator('#ordform select[name="typ"]'), 'tillfallig', 'typen Tillfällig');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Infektion', 'ordinationsorsak');
      await m.datum(page.locator('#ordform input[name="slut"]'), D.om(7), 'slutdatum om en vecka');
      await sparaOrdination(m, page, 'Kloramfenikol Santen är ordinerat');
      await ny();
      await valjLakemedel(m, page, 'sertralin', 'Sertralin Teva 50');
      await m.skriv(page.locator('#ordform input[name="dosering"]'), 'En halv tablett varje morgon i 6 dagar, därefter 1 tablett varje morgon, tillsvidare', 'dosering');
      await m.klicka(page.locator('#ordform details', { hasText: 'Upptrappning' }).locator('summary'), 'Upptrappning enligt schema');
      await m.ersatt(page.locator('#ordform input[name="trDagar"]'), '6', 'dagar per steg');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Nedstämdhet', 'ordinationsorsak');
      await m.klicka(page.locator('#ordform [data-upp="14"]'), 'uppföljning om två veckor');
      await sparaOrdination(m, page, 'Sertralin Teva är ordinerat');
      // Ny dos av Metformin: den gamla ordinationen sätts ut och den nya ordineras.
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      await m.klicka(page.locator('.lm-tabell tr', { hasText: 'Metformin Sandoz' }).locator('[data-utsatt]'), 'Sätt ut för Metformin');
      await m.skriv(page.locator('dialog[open] textarea'), 'Ny dos, ersätts med Metformin 850 mg', 'orsak');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Sätt ut');
      await synlig(page, '.notis', 'Metformin Sandoz är utsatt');
      await m.klicka(page.locator('button[data-ny]:visible').first(), 'Ordinera i läkemedelsfliken');
      await page.waitForSelector('#ordform');
      await valjLakemedel(m, page, 'metformin teva', 'Metformin Teva 850');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Mot diabetes', 'ordinationsorsak');
      await sparaOrdination(m, page, 'Metformin Teva är ordinerat');
      for (const n of ['Alvedon forte', 'Kloramfenikol Santen', 'Sertralin Teva', 'Metformin Teva']) await synlig(page, '.lm-tabell', n);
    },
    '1.2': async (m, page) => {
      await oppnaFranLista(m, page, 'Elin Arnström');
      // Första ordinationen från översikten, de följande från läkemedelsfliken som visas efter sparandet.
      const ny = async () => { const flik = page.locator('button[data-ny]:visible'); await m.klicka((await flik.count()) ? flik.first() : page.locator('.snabbval a', { hasText: 'Ordinera' }), 'Ordinera'); await page.waitForSelector('#ordform'); };
      await ny();
      await valjLakemedel(m, page, 'paracetamol fresenius', 'Paracetamol Fresenius Kabi');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Smärta', 'ordinationsorsak');
      await m.ersatt(page.locator('#ordform input[name="dosering"]'), '100 ml engångsdos. Ges som intravenös infusion under 15 minuter', 'dosering');
      await m.ersatt(page.locator('#ordform input[name="dos"]'), '1000', 'dos');
      await m.valj(page.locator('#ordform select[name="typ"]'), 'tillfallig', 'typen Tillfällig');
      await sparaOrdination(m, page, 'Paracetamol Fresenius Kabi är ordinerat');
      await ny();
      await valjLakemedel(m, page, 'glucos', 'Glucos Baxter');
      await m.skriv(page.locator('#ordform input[name="dosering"]'), '1000 ml med Addex-Magnesium 20 mmol. Ges på två timmar', 'dosering');
      await m.valj(page.locator('#ordform select[name="typ"]'), 'tillfallig', 'typen Tillfällig');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Vätska och magnesium', 'ordinationsorsak');
      await sparaOrdination(m, page, 'Glucos Baxter');
      await ny();
      await valjLakemedel(m, page, 'addex', 'Addex-Magnesium');
      await m.skriv(page.locator('#ordform input[name="dosering"]'), '20 mmol tillsätts i Glucos 1000 ml', 'dosering');
      await m.valj(page.locator('#ordform select[name="typ"]'), 'tillfallig', 'typen Tillfällig');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Magnesium', 'ordinationsorsak');
      await sparaOrdination(m, page, 'Addex-Magnesium är ordinerat');
      await ny();
      await valjLakemedel(m, page, 'stesolid', 'Stesolid 10');
      await m.skriv(page.locator('#ordform input[name="dosering"]'), '1 tablett som premedicinering 1 timme före röntgen', 'dosering');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Premedicinering inför röntgen', 'ordinationsorsak');
      await m.klicka(page.locator('#ordform .o-handelse summary'), 'Ges inför en planerad vårdhändelse');
      await m.klicka(page.locator('#ordform [data-vh="ny"]'), 'Ny vårdhändelse');
      await m.skriv(page.locator('#ordform input[name="vardhandelse"]'), 'Röntgen', 'vårdhändelsen');
      await sparaOrdination(m, page, 'Stesolid är ordinerat');
      for (const n of ['Paracetamol Fresenius Kabi', 'Glucos Baxter', 'Addex-Magnesium', 'Stesolid']) await synlig(page, '.lm-tabell', n);
    },
    '1.3': async (m, page) => {
      await oppnaFranLista(m, page, 'Trevis Ljung');
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      const ny = async () => { await m.klicka(page.locator('[data-muntlig]'), 'Muntlig ordination'); await page.waitForSelector('#ordform'); };
      await ny();
      await m.valj(page.locator('#ordform select[name="lakareId"]'), 'lak-kard', 'läkaren Sara Lindqvist');
      await m.skriv(page.locator('#ordform input[name="omedelbar"]'), 'Svår smärta', 'varför behandlingen inte kan vänta');
      await valjLakemedel(m, page, 'alvedon forte', 'Alvedon forte');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Smärta', 'ordinationsorsak');
      await m.ersatt(page.locator('#ordform input[name="dosering"]'), '1 tablett, engångsordination', 'dosering');
      await m.ersatt(page.locator('#ordform input[name="dos"]'), '1000', 'dos');
      await m.valj(page.locator('#ordform select[name="typ"]'), 'tillfallig', 'typen Tillfällig');
      await sparaOrdination(m, page, 'Alvedon forte');
      await ny();
      await m.valj(page.locator('#ordform select[name="lakareId"]'), 'lak-kard', 'läkaren Sara Lindqvist');
      await m.skriv(page.locator('#ordform input[name="omedelbar"]'), 'Svår smärta', 'varför behandlingen inte kan vänta');
      await valjLakemedel(m, page, 'morfin abcur', 'Morfin Abcur');
      await m.ersatt(page.locator('#ordform input[name="dosering"]'), '1 ml intramuskulärt, engångsordination', 'dosering');
      await m.ersatt(page.locator('#ordform input[name="dos"]'), '10', 'dos');
      await m.valj(page.locator('#ordform select[name="typ"]'), 'tillfallig', 'typen Tillfällig');
      await m.valj(page.locator('#ordform select[name="administrationssatt"]'), 'intramuskulart', 'intramuskulärt');
      await m.skriv(page.locator('#ordform input[name="ordinationsorsak"]'), 'Smärta', 'ordinationsorsak');
      await sparaOrdination(m, page, 'Morfin Abcur');
      for (const n of ['Alvedon forte', 'Morfin Abcur']) await synlig(page, '.lm-tabell', n);
    },
    '1.4': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/administrering"]'), 'Läkemedel att ge i menyn');
      await page.waitForSelector('.adm-patient');
      const bertil = page.locator('.adm-patient', { hasText: 'Bertil Danielsson' });
      // Instruktionerna står i doseringen, så att de kan läsas upp.
      await bertil.locator('tr', { hasText: 'Ges som intravenös infusion under 15 minuter' }).first().waitFor();
      await bertil.locator('tr', { hasText: 'Ges på två timmar' }).first().waitFor();
      const dos = (namn) => bertil.locator('tr', { hasText: namn }).filter({ has: page.locator('[data-adm]') }).first();
      await m.klicka(dos('Paracetamol Fresenius Kabi').locator('[data-adm="ge"]'), 'Ge för Paracetamol');
      await synlig(page, '.notis', 'Paracetamol Fresenius Kabi är given');
      await page.waitForLoadState('networkidle');
      await m.klicka(dos('Glucos Baxter').locator('.adm-mer summary'), 'Mer för Glucos');
      await m.klicka(dos('Glucos Baxter').locator('[data-adm="iordningstall"]'), 'Iordningsställ');
      await page.waitForTimeout(300);
      if (await page.locator('dialog[open] [data-varde="ok"]').count()) await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'bekräfta iordningsställandet');
      await synlig(page, '.notis', 'iordningsställd');
      await page.waitForLoadState('networkidle');
      await m.klicka(dos('Glucos Baxter').locator('[data-adm="ge"]'), 'Ge för Glucos');
      if (await page.locator('dialog[open] [data-varde="ok"]').count()) await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'bekräfta');
      await synlig(page, '.notis', 'Glucos Baxter');
      await page.waitForLoadState('networkidle');
      await m.klicka(dos('Stesolid').locator('[data-adm="ge"]'), 'Ge för Stesolid');
      await synlig(page, '.notis', 'Stesolid är given');
      await page.waitForLoadState('networkidle');
      await m.klicka(bertil.locator('.adm-vb', { hasText: 'Zopiklon' }).locator('[data-adm="ge"]'), 'Ge för Zopiklon vid behov');
      if (await page.locator('dialog[open] [data-varde="ok"]').count()) await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'bekräfta');
      await synlig(page, '.notis', 'Zopiklon');
      // Listan ritas om efter varje dos. Vänta tills den står still, så att nästa klick inte hamnar på en knapp som flyttas.
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      // Patienten kräktes upp premedicineringen: en omvårdnadsanteckning.
      await m.klicka(bertil.locator('a.patientlank, a[href^="#/patient/"]').first(), 'Bertil Danielsson');
      await page.waitForSelector('.flikar');
      await m.klicka(page.locator('.flikar a', { hasText: 'Översikt' }), 'fliken Översikt');
      await page.waitForSelector('.tidslinje');
      await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
      await page.waitForSelector('#ant-form');
      await m.valj(page.locator('#ny-mall'), 'Omvårdnadsanteckning', 'mallen Omvårdnadsanteckning');
      await m.skriv(page.locator('textarea[data-sokord="Elimination"]'), 'Kräktes upp premedicineringen, Stesolid 10 mg, strax efter att den gavs.', 'sökordet Elimination');
      await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
      await synlig(page, '.anteckning', 'Kräktes upp premedicineringen');
    },
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
    // Runda 8, r2: remiss på uppdrag (2.2), fördelning och bedömning (2.3), fördelning och remisskonferens på uppdrag
    // (2.4) och en extern pappersremiss (2.5).
    '2.2': async (m, page) => {
      await sok(m, page, 'Mira', 'Mira Axelsson');
      await m.klicka(page.locator('.snabbval a', { hasText: 'Remiss på uppdrag' }), 'Remiss på uppdrag');
      await page.waitForSelector('#uppdragform');
      const vald = await page.locator('#ru-lakare').inputValue();
      if (vald !== D.UPPDRAG_2_2.uppdragsgivare) throw new Error(`systemet föreslog ${vald} som uppdragsgivare`);
      await m.valj(page.locator('#ru-till'), D.UPPDRAG_2_2.tillEnhetId, 'mottagare Ortopediska kliniken USÖ');
      await m.skriv(page.locator('#ru-fraga'), D.REMISS_2_1.fragestallning, 'frågeställning');
      await m.skriv(page.locator('#ru-anamnes'), D.REMISS_2_1.anamnes, 'anamnes');
      await m.klicka(page.locator('#uppdragform [type="submit"]'), 'Skicka till läkaren för signering');
      await synlig(page, '.notis', 'väntar på signering av Sara Lindqvist');
      await synlig(page, '.r8-uppdrag', 'Väntar på signering av Sara Lindqvist');
    },
    '2.3': async (m, page) => {
      const kort = (namn, atgard) => page.locator('article.remiss', { hasText: namn }).filter({ has: page.locator(`[data-remiss-atgard="${atgard}"]`) }).first();
      await m.klicka(page.locator('#meny-lista a[href="#/remisser"]'), 'Remisser i menyn');
      await page.waitForSelector('article.remiss');
      await m.klicka(kort('Berit Strandhall', 'fordela').locator('[data-remiss-atgard="fordela"]'), 'Fördela för Berit Strandhall');
      await m.klicka(page.locator('dialog[open] [data-varde="ol-kard"]'), 'bakjouren Göran Malm');
      await synlig(page, '.notis', 'fördelad till Göran Malm');
      await page.waitForLoadState('networkidle');
      await m.klicka(kort('Gerda Ström', 'bedom').locator('[data-remiss-atgard="bedom"]'), 'Bedöm för Gerda Ström');
      await page.locator('dialog[open] #tr-60').waitFor();
      await m.klicka(page.locator('dialog[open] #tr-60'), 'Inom två månader');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Spara bedömningen');
      await synlig(page, '.notis', 'inom två månader');
      await page.waitForLoadState('networkidle');
      await m.klicka(kort('Elin Arnström', 'bedom').locator('[data-remiss-atgard="bedom"]'), 'Bedöm för Elin Arnström');
      await page.locator('dialog[open] #b-avv').waitFor();
      await m.klicka(page.locator('dialog[open] #b-avv'), 'Avvisa');
      await m.skriv(page.locator('dialog[open] #b-mot'), D.AVVISNING_2_3, 'svarstexten');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Spara bedömningen');
      await synlig(page, '.notis', 'Remissen är avvisad');
      await page.waitForLoadState('networkidle');
      await m.klicka(kort('Trevis Ljung', 'vidarebefordra').locator('[data-remiss-atgard="vidarebefordra"]'), 'Skicka vidare för Trevis Ljung');
      await page.locator('dialog[open] #vb-till').waitFor();
      await m.valj(page.locator('dialog[open] #vb-till'), 'uso-psyk', 'Allmänpsykiatriska kliniken USÖ');
      await m.skriv(page.locator('dialog[open] #vb-mot'), D.VIDAREBEFORDRAN_2_3, 'motiveringen');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skicka vidare');
      await synlig(page, '.notis', 'skickad vidare till Allmänpsykiatriska kliniken USÖ');
      await page.waitForLoadState('networkidle');
      await synlig(page, 'article.remiss', 'Fördelad till Göran Malm');
    },
    '2.4': async (m, page) => {
      const kort = (namn, atgard) => page.locator('article.remiss', { hasText: namn }).filter({ has: page.locator(`[data-remiss-atgard="${atgard}"]`) }).first();
      await m.klicka(page.locator('#meny-lista a[href="#/remisser"]'), 'Remisser i menyn');
      await page.waitForSelector('article.remiss');
      await m.klicka(kort('Bertil Danielsson', 'fordela').locator('[data-remiss-atgard="fordela"]'), 'Fördela för Bertil Danielsson');
      await m.klicka(page.locator('dialog[open] [data-varde="ol-kard"]'), 'bakjouren Göran Malm');
      await synlig(page, '.notis', 'fördelad till Göran Malm');
      for (const namn of ['Sara Sandmark', 'Anna Karlsson', 'Sven Markström']) {
        await page.waitForLoadState('networkidle');
        await m.klicka(kort(namn, 'konferens').locator('[data-remiss-atgard="konferens"]'), `Till remisskonferens för ${namn}`);
        await synlig(page, '.notis', 'står på remisskonferensen');
      }
      await page.waitForLoadState('networkidle');
      for (const namn of ['Sara Sandmark', 'Anna Karlsson', 'Sven Markström']) await synlig(page, `article.remiss:has-text("${namn}")`, 'På remisskonferensen');
      await synlig(page, 'article.remiss:has-text("Bertil Danielsson")', 'Fördelad till Göran Malm');
    },
    '2.5': async (m, page) => {
      const r = D.SKANNAD_2_5.remiss;
      await m.klicka(page.locator('#meny-lista a[href="#/remisser"]'), 'Remisser i menyn');
      await m.klicka(page.locator('.r8-skannade li', { hasText: r.enhet }).locator('[data-skann]'), 'Registrera vid den inskannade remissen');
      await page.locator('dialog[open] #ex-patient').waitFor();
      await m.skriv(page.locator('dialog[open] #ex-patient'), 'Trevis Ljung', 'patienten');
      await synlig(page, 'dialog[open] [data-vald]', 'Trevis Ljung');
      await m.skriv(page.locator('dialog[open] #ex-enhet'), r.enhet, 'avsändande enhet');
      await m.datum(page.locator('dialog[open] #ex-datum'), r.remissdatum, 'remissdatum');
      await m.skriv(page.locator('dialog[open] #ex-fraga'), r.fragestallning, 'frågeställning');
      await m.skriv(page.locator('dialog[open] #ex-anamnes'), r.anamnes, 'anamnes');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
      await synlig(page, '.notis', `Pappersremissen från ${r.enhet} är registrerad`);
      await synlig(page, 'article.remiss:has-text("Trevis Ljung")', `Pappersremiss från ${r.enhet}`);
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
      // Runda 8, r2: Gerda Ström har en remiss till vårdenheten i testdatan för testfall 2.3, och då föreslår systemet
      // orsaken ur remissen. Slutvillkoret är att kontakten med den orsak som registrerades syns.
      const registrerad = (await orsak.count()) ? await orsak.inputValue() : 'Akut besök, oplanerat';
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
      await synlig(page, '.notis', 'är registrerat');
      await synlig(page, '.vk-lista', registrerad);
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
  const D = { ...D0, ANKOMNA: D0.ANKOMNA_5_6, namn: Object.fromEntries(D0.SUSSA_PATIENTER.map(p => [p.id, `${p.fornamn} ${p.efternamn}`])),
    om: (dagar) => new Date(Date.now() + dagar * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) };
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

  // SUSSA_NR=1.1,1.2 kör bara de testfallen och skriver inget resultat, för utvecklingen av ett flöde.
  const BARA = process.env.SUSSA_NR ? process.env.SUSSA_NR.split(',') : null;
  for (const { x, k } of R.KORNINGAR.filter(({ x }) => !BARA || BARA.includes(x.nr))) {
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
      r.brister = k.brister;
      r.malpoang = R.malpoang({ uppnatt: true, steg: r.uppmatt, budget: k.budget, brister: k.brister });
      r.tidspoang = R.tidspoang(r.uppskattadTidS, x.tidsklass);
      console.log(`${r.inomBudget ? 'ok ' : 'ÖVER'} ${x.nr} ${x.titel} (${k.demoroll}): ${r.uppmatt} steg (budget ${k.budget}), ${r.tecken} tecken, uppskattat ${r.uppskattadTidS} s, poäng ${r.malpoang} och ${r.tidspoang}`);
      if (!r.inomBudget) fel.push(`${x.nr} ${x.titel} (${k.demoroll}): ${r.uppmatt} steg, budget ${k.budget}`);
    } catch (e) {
      r.fel = e.message.split('\n')[0];
      r.malpoang = 0; r.tidspoang = 0;
      fel.push(`${x.nr} ${x.titel} (${k.demoroll}): ${r.fel}`);
      console.log(`FEL ${x.nr} ${x.titel} (${k.demoroll}): ${r.fel}. Steg så långt: ${m.steg.join("; ")}`);
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
  if (BARA) { await browser.close(); console.log(fel.length ? `\nFel:\n  ${fel.join('\n  ')}` : '\nInga fel.'); process.exit(fel.length ? 1 : 0); }
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
