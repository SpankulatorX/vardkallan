// Genomgång av Vårdkällans gränssnitt med Playwright. Loggar in som var och en av de åtta demorollerna,
// går igenom varje vy rollen har och gör huvudflödena. Loggar sedan in som patienter i Min journal. Misslyckas vid
// konsolfel, sidfel eller HTTP 500.
//
// Användning (servern måste vara igång):
//   NODE_PATH=$(npm root -g) node test/genomgang.cjs [bas-url]
// Standard för bas-url är http://127.0.0.1:18796. Skärmbilder sparas i test/skarmbilder/.
//
// Webbläsaren skriver "Failed to load resource ... 403" i konsolen när API:t nekar åtkomst, och 404 när Min journal
// svarar att en annan patients journal inte finns. Det är väntat där demon visar nekad åtkomst, så just de raderna
// räknas separat och redovisas. Alla andra konsolfel, alla sidfel, alla svar med status 500 eller högre och saknade
// statiska filer räknas som fel.

const { chromium } = require('@playwright/test');
const { mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const BAS = process.argv[2] || 'http://127.0.0.1:18796';
const UT = join(__dirname, 'skarmbilder');
mkdirSync(UT, { recursive: true });
for (const f of ['00-fel.png', '00-fel-mobil.png']) rmSync(join(UT, f), { force: true });

const fel = [];
const vantade403 = [];
let steg = 0;
let aktuelltSteg = '';

function bevaka(page, namn) {
  page.on('pageerror', e => fel.push(`[${namn}] sidfel i "${aktuelltSteg}": ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource: the server responded with a status of 40[34]/.test(t)) { vantade403.push(`${aktuelltSteg}`); return; }
    fel.push(`[${namn}] konsolfel i "${aktuelltSteg}": ${t}`);
  });
  page.on('response', r => {
    const u = new URL(r.url());
    if (r.status() >= 500) fel.push(`[${namn}] HTTP ${r.status()} ${r.request().method()} ${u.pathname} i "${aktuelltSteg}"`);
    if (r.status() === 404 && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/fhir/')) fel.push(`[${namn}] saknad fil ${u.pathname}`);
    if (r.status() === 429) fel.push(`[${namn}] HTTP 429 ${u.pathname}`);
  });
}

async function s(namn, fn) {
  aktuelltSteg = namn;
  const fore = fel.length;
  try {
    await fn();
  } catch (e) {
    fel.push(`steg "${namn}" misslyckades: ${e.message.split('\n')[0]}`);
  }
  steg++;
  console.log(`${fel.length > fore ? 'FEL' : 'ok '} ${String(steg).padStart(3)} ${namn}`);
  if (fel.length > fore) throw new Error(fel.slice(fore).join('\n'));
}

const bild = async (page, namn, hel = false) => {
  // Helsidesbilder tas från toppen, annars hamnar det fasta patienthuvudet mitt i bilden.
  if (hel) await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(UT, `${namn}.png`), fullPage: hel });
};
const vantaVy = async (page) => { await page.waitForLoadState('networkidle'); await page.waitForSelector('main h1'); };
async function forvanta(page, sel, text) {
  const l = page.locator(sel).filter({ hasText: text }).first();
  await l.waitFor({ state: 'visible', timeout: 8000 });
  return l;
}
async function saknas(page, text) {
  const n = await page.locator('main').getByText(text, { exact: false }).count();
  if (n) throw new Error(`"${text}" ska inte synas men finns ${n} gånger`);
}
async function gaTill(page, hash) { await page.goto(`${BAS}/${hash}`); await vantaVy(page); }

async function loggaIn(page, id) {
  await page.goto(`${BAS}/#/`);
  await page.waitForLoadState('networkidle');
  if (await page.locator('[data-a="loggaut"]').count()) {
    await page.click('[data-a="loggaut"]');
  }
  await page.waitForSelector(`[data-roll="${id}"]`);
  await page.click(`[data-roll="${id}"]`);
  await page.waitForSelector('[data-a="loggaut"]');
  await vantaVy(page);
}

// Inloggning i Min journal med simulerad e-legitimation.
async function loggaInPatient(page, id) {
  await page.goto(`${BAS}/#/`);
  await page.waitForLoadState('networkidle');
  if (await page.locator('[data-a="loggaut"]').count()) await page.click('[data-a="loggaut"]');
  await page.waitForSelector('#flik-patient');
  await page.click('#flik-patient');
  await page.click(`[data-invanare="${id}"]`);
  await page.waitForSelector('[data-a="loggaut"]');
  await vantaVy(page);
}
const MIN_FLIKAR = ['Översikt', 'Anteckningar', 'Diagnoser', 'Läkemedel', 'Provsvar', 'Remisser', 'Vem har läst', 'Spärrar'];
async function minFlik(page, text) {
  await page.click(`.min-flikar a:text-is("${text}")`);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('.min-del .tom')?.textContent.startsWith('Hämtar'));
}

// Besöker varje menyval rollen har och kontrollerar att vyn visas utan felruta.
async function allaVyer(page, roll, forvantade) {
  const lankar = await page.locator('#meny-lista a').evaluateAll(a => a.map(x => [x.getAttribute('href'), x.querySelector('.menytext').textContent]));
  const texter = lankar.map(l => l[1]);
  if (JSON.stringify(texter) !== JSON.stringify(forvantade)) throw new Error(`menyn för ${roll} är ${JSON.stringify(texter)}, förväntade ${JSON.stringify(forvantade)}`);
  for (const [href, text] of lankar) {
    await s(`${roll}: vyn ${text}`, async () => {
      await page.click(`#meny-lista a[href="${href}"]`);
      await vantaVy(page);
      if (await page.locator('main h1', { hasText: 'Det gick inte att visa sidan' }).count()) throw new Error(`vyn ${text} visade en felruta`);
      if (await page.locator('main .tom', { hasText: /^Hämtar/ }).count()) { await page.waitForTimeout(500); }
    });
  }
}

async function valDialog(page, knappSel, { intyg = false, bildnamn } = {}) {
  await page.click(knappSel);
  const dl = page.locator('dialog[open]');
  await dl.waitFor();
  await dl.locator('[data-forslag]').first().click();
  if (intyg) await dl.locator('input[name="intyg"]').check();
  if (bildnamn) await bild(page, bildnamn);
  await dl.locator('[data-varde="ok"]').click();
  await dl.waitFor({ state: 'detached' });
  await page.waitForLoadState('networkidle');
}

const MENY = {
  klinisk: ['Arbetslista', 'Sök patient', 'Inkorg', 'Remisser', 'Väntrum (akuten)', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  utanRemiss: ['Arbetslista', 'Sök patient', 'Inkorg', 'Väntrum (akuten)', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  logg: ['Sök patient', 'Logguppföljning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  const page = await ctx.newPage();
  bevaka(page, 'skrivbord');
  let remissId = null;

  try {
    // Utan inloggning
    await s('inloggningssidan visar de åtta demorollerna och demoraden', async () => {
      await page.goto(`${BAS}/`);
      await page.waitForSelector('.roll');
      const n = await page.locator('.roll').count();
      if (n !== 8) throw new Error(`${n} roller`);
      await forvanta(page, '.demorad', 'Demo med påhittade patienter och testpersonnummer från Skatteverket. Inte för vård av riktiga patienter.');
      await forvanta(page, '.sidfot', 'Vårdkällan är ett fristående demoprojekt med öppen källkod (EUPL 1.2). Det är inte en tjänst från Region Örebro län.');
      await forvanta(page, '#roll-lak-akut-visar', 'Nödåtkomst');
      await bild(page, '01-inloggning', true);
    });
    await s('kravspårbarhet, moduler och svarstider går att läsa utan inloggning', async () => {
      await gaTill(page, '#/krav'); await forvanta(page, '.testkorning', 'tester gröna');
      await gaTill(page, '#/moduler'); await forvanta(page, '.modul-planerat', 'Planerat, inte byggt');
      await gaTill(page, '#/drift'); await forvanta(page, 'main h1', 'Svarstider');
      await gaTill(page, '#/arbetslista'); await page.waitForSelector('.roll');
    });
    await s('tangentbord: första tabbstoppet är länken till innehållet', async () => {
      await page.goto(`${BAS}/`); await page.waitForSelector('.roll');
      await page.keyboard.press('Tab');
      const t = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (t !== 'Hoppa till innehållet') throw new Error(`fokus på "${t}"`);
    });

    // Sara Lindqvist, läkare på kardiologen
    await s('Sara Lindqvist loggar in och ser arbetslistan', async () => {
      await loggaIn(page, 'lak-kard');
      await forvanta(page, '.inloggad', 'Sara Lindqvist');
      await forvanta(page, '#lista', 'Gunnar Åkesson');
      await forvanta(page, '#lista .skyddad-namn', 'Skyddad identitet');
      await saknas(page, 'Engberg');
      await bild(page, '02-arbetslista', true);
    });
    await allaVyer(page, 'Sara Lindqvist', MENY.klinisk);
    await s('Sara: inkorgen och svarstiden', async () => {
      await gaTill(page, '#/inkorg');
      await forvanta(page, '.ik-larm', 'Mottagningskvittens saknas');
      await forvanta(page, '#svarstid', 'ms');
      await bild(page, '03-inkorg', true);
    });
    await s('Sara: patientöversikten med tidslinje och migrerade poster', async () => {
      await gaTill(page, '#/arbetslista');
      await page.click('a.patientlank:has-text("Gunnar Åkesson")');
      await page.waitForSelector('.tidslinje');
      await forvanta(page, '.patientband', 'Överkänslighet: Penicilliner');
      await forvanta(page, '.band-grund', 'Vårdrelation på din enhet');
      await forvanta(page, '.tidslinje', 'Migrerad från Cosmic 2023');
      await bild(page, '04-patient-oversikt', true);
    });
    await s('Sara: aktivt val visar uppgifter från andra vårdenheter', async () => {
      await valDialog(page, '#behorighetsrad [data-val="andra_enheter"]', { bildnamn: '05-dialog-aktivt-val' });
      await forvanta(page, '.band-grund', 'Aktivt val: andra vårdenheter');
      await page.waitForSelector('.tidslinje');
      await forvanta(page, '.tidslinje', 'Migrerad från VAS 2014');
    });
    await s('Sara: signerar sitt utkast från inkorgen', async () => {
      await gaTill(page, '#/inkorg');
      await page.click('#ik-osign ~ ul a');
      await forvanta(page, '.ant-form h2', 'utkast');
      await page.fill('textarea[data-sokord="Åtgärd"]', 'Fortsatt behandling. Planerar hemgång i morgon.');
      await page.click('.ant-form [data-signera]');
      await forvanta(page, '.anteckning .ant-fakta', 'Signerad');
      await forvanta(page, '.anteckning', 'Planerar hemgång i morgon.');
    });
    await s('Sara: rättar den signerade anteckningen med orsak', async () => {
      await page.click('[data-ratta]');
      await page.fill('input[name="orsak"]', 'Fel vikt i första versionen.');
      await page.fill('textarea[data-sokord="Aktuellt"]', 'Pigg på ronden. Vikt 80,9 kg.');
      await page.click('.ant-form [data-spara]');
      await forvanta(page, '.version-gammal', 'Version 1');
      await forvanta(page, '.overstruken del', 'Vikt 81,6 kg');
      await forvanta(page, '.ant-fakta', 'Fel vikt i första versionen.');
      await bild(page, '06-journal-rattelse', true);
    });
    await s('Sara: skriver en ny anteckning från mall, sparar utkast och signerar', async () => {
      await page.click('a:has-text("Ny anteckning")');
      await forvanta(page, '.ant-form h2', 'Ny anteckning');
      await page.selectOption('select[name="typ"]', 'Daganteckning');
      await page.fill('textarea[data-sokord="Aktuellt"]', 'Inga nya besvär. Sover gott.');
      await page.fill('textarea[data-sokord="Bedömning"]', 'Stabil.');
      await bild(page, '07-journal-ny-anteckning', true);
      await page.click('.ant-form [data-spara]');
      await forvanta(page, '.ant-form h2', 'utkast');
      await page.click('.ant-form [data-signera]');
      await forvanta(page, '.anteckning', 'Inga nya besvär. Sover gott.');
    });
    await s('Sara: ordinerar Ibuprofen, varningen warfarin och NSAID måste kvitteras med motivering', async () => {
      await gaTill(page, '#/patient/p01/lakemedel');
      await page.click('[data-ny]');
      await page.fill('#lm-sok', 'ibuprofen');
      await page.click('[data-lm]');
      await page.fill('input[name="dosering"]', '1 tablett vid behov, högst 3 per dygn');
      await page.selectOption('select[name="typ"]', 'vid_behov');
      await page.fill('input[name="ordinationsorsak"]', 'Ledvärk');
      await page.click('[data-upp="14"]');
      await page.click('[data-spara]');
      await forvanta(page, '.varningslista', 'Warfarin och NSAID');
      await forvanta(page, '.demoregel', 'demoregler');
      // Utan motivering stoppas ordinationen.
      await page.click('[data-spara]');
      await forvanta(page, '.ordform .form-fel', 'kvitteras med en motivering');
      await bild(page, '08-lakemedel-varning', true);
      await page.fill('textarea[data-motivering="warfarin_nsaid"]', 'Kortvarig behandling, INR kontrolleras om tre dagar.');
      await page.click('[data-spara]');
      await forvanta(page, '.notis', 'Ibuprofen Orifarm är ordinerat');
      await forvanta(page, '.lm-tabell', 'warfarin_nsaid (Kortvarig behandling');
    });
    await s('Sara: simulerar timeout mot NLL, ordinationen syns ändå, och avstämningen hittar registreringen', async () => {
      await page.click('.demo-panel summary');
      await page.click('[data-nll="timeout"]');
      await forvanta(page, '#nll-lage', 'timeout');
      await page.click('[data-ny]');
      await page.fill('#lm-sok', 'omeprazol');
      await page.click('[data-lm]');
      await page.fill('input[name="dosering"]', '1 kapsel på morgonen');
      await page.fill('input[name="ordinationsorsak"]', 'Magskydd under NSAID-behandling');
      await page.click('[data-upp="14"]');
      await page.click('[data-spara]');
      await forvanta(page, '.notis', 'fick timeout');
      const rad = page.locator('.lm-tabell tr', { hasText: 'Omeprazol' });
      await rad.locator('.nll-okand_kontrolleras').waitFor();
      await bild(page, '09-lakemedel-nll-timeout', true);
      await gaTill(page, '#/inkorg');
      await forvanta(page, '.ik-nll', 'Omeprazol');
      await page.click('.ik-nll a');
      await page.waitForSelector('.lm-tabell');
      await page.locator('.lm-tabell tr', { hasText: 'Omeprazol' }).locator('[data-avstam]').click();
      await forvanta(page, '.notis', 'hade registrerat ordinationen');
      await page.locator('.lm-tabell tr', { hasText: 'Omeprazol' }).locator('.nll-kvitterad').waitFor();
    });
    await s('Sara: sätter ut en ordination med orsak', async () => {
      await page.locator('.lm-tabell tr', { hasText: 'Alvedon' }).locator('[data-utsatt]').click();
      const dl = page.locator('dialog[open]');
      await dl.locator('textarea').fill('Ingen smärta längre.');
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Alvedon är utsatt');
      await forvanta(page, '#lm-utsatt', 'Utsatta');
    });
    await s('Sara: registrerar ett mätvärde och ser trenden', async () => {
      await gaTill(page, '#/patient/p01/matvarden');
      await page.selectOption('#mv-typ', 'puls');
      await page.fill('#mv-varde', '78');
      await page.click('#mv-form [type="submit"]');
      await forvanta(page, '.notis', 'Puls 78');
      await page.waitForSelector('svg.trend');
      await bild(page, '10-matvarden', true);
    });
    await s('Sara: patienten samtycker till att spärren för Elin Sandberg tillfälligt hävs', async () => {
      await gaTill(page, '#/patient/p04/journal');
      await forvanta(page, '.patientband .signal-sparr', 'Det finns spärrade uppgifter');
      await saknas(page, 'Allmänpsykiatriska');
      await valDialog(page, '#behorighetsrad [data-val="samtycke_sparr"]', { intyg: true, bildnamn: '11-dialog-samtycke' });
      await forvanta(page, '.band-grund', 'Samtycke till spärrade uppgifter');
      await forvanta(page, '.j-grupp h3', 'Allmänpsykiatriska kliniken');
    });
    await s('Sara: visa identitet för patienten med skyddade personuppgifter', async () => {
      await gaTill(page, '#/patient/p03');
      await forvanta(page, '.patientband h1', 'Skyddad identitet');
      await forvanta(page, '.patientband .pnr', '19840416-****');
      await saknas(page, 'Engberg');
      await forvanta(page, 'section[aria-labelledby="ov-kontakt"]', 'visas aldrig');
      await bild(page, '12-skyddad-identitet', true);
      await valDialog(page, '#behorighetsrad [data-val="visa_identitet"]');
      await forvanta(page, '.patientband h1', 'Malin Engberg');
      await forvanta(page, '.band-grund', 'Identitet visad');
    });
    await s('Sara: patient utan vårdrelation ger en lugn förklaring och erbjuder nödåtkomst', async () => {
      await gaTill(page, '#/patient/p12');
      await forvanta(page, 'main h1', 'Ingen vårdrelation');
      await forvanta(page, '.ruta-nod', 'Försöket är loggat');
    });
    await s('Sara: öppet API visar FHIR-svar med sessionen', async () => {
      await gaTill(page, '#/api');
      await forvanta(page, '#api-json', 'CapabilityStatement');
      await page.click('.api-knapp:has-text("/fhir/MedicationRequest")');
      await forvanta(page, '#api-json', 'MedicationRequest');
      await forvanta(page, '#api-status', 'HTTP 200');
      await bild(page, '13-oppet-api', true);
    });
    await s('Sara: Sussas kravspecifikation är standardvyn, med sammanställning, filter, sök och en post', async () => {
      await gaTill(page, '#/krav');
      await forvanta(page, '.flikar a[aria-current="page"]', 'Sussas kravspecifikation');
      await forvanta(page, '.testkorning', 'tester gröna');
      await forvanta(page, '.sussa-utdrag', 'Kapitel 7 till 10 och 12 ingår inte i utdraget');
      await forvanta(page, '.ingress-block', 'dnr 16RS2022');
      await forvanta(page, '.sussa-summa tfoot', 'Totalt');
      await forvanta(page, '#sf-antal', 'Visar 305 av 305 poster.');
      if (!(await page.locator('#sf-kapitel option[value="7"]').isDisabled())) throw new Error('kapitel 7 går att välja fast det inte ingår');
      await page.evaluate(() => document.getElementById('notiser').replaceChildren());
      await bild(page, '60-sussa-krav');
      // Kapitel, status och kategori filtrerar listan och sparas i adressen.
      await page.selectOption('#sf-kapitel', '3');
      const idKap3 = await page.locator('details.sussapost').evaluateAll(d => d.map(x => x.dataset.id));
      if (!idKap3.length || idKap3.some(id => !id.startsWith('3.'))) throw new Error(`kapitelfiltret visade ${idKap3.slice(0, 3).join(', ')}`);
      await page.selectOption('#sf-status', 'planerat');
      if (await page.locator('#sussa-lista .krav-uppfyllt_demo, #sussa-lista .krav-delvis').count()) throw new Error('statusfiltret visade poster som inte är planerade');
      await page.selectOption('#sf-kapitel', '');
      await page.selectOption('#sf-status', '');
      await page.selectOption('#sf-kategori', 'nationell');
      const kategorier = await page.locator('details.sussapost .under-text').allTextContents();
      if (!kategorier.length || kategorier.some(t => !t.includes('nationell tjänst'))) throw new Error('kategorifiltret visade andra kategorier');
      await page.selectOption('#sf-kategori', '');
      await page.fill('#sf-sok', '3.5.2.6');
      await forvanta(page, '#sf-antal', 'Visar 1 av 305 poster.');
      if (!page.url().includes('sok=3.5.2.6')) throw new Error(`filtret sparades inte i adressen: ${page.url()}`);
      await page.fill('#sf-sok', 'vätskebalans');
      if ((await page.locator('details.sussapost').count()) < 3) throw new Error('textsökningen hittade för få poster');
      await page.fill('#sf-sok', '3.5.2.6');
      // En post visar kravtext, lösning, expertrollen, tester och egna krav.
      await page.click('details.sussapost[data-id="3.5.2.6"] > summary');
      const post = page.locator('details.sussapost[data-id="3.5.2.6"] .sussa-innehall');
      for (const t of ['Kravtext', 'ordinationsorsak', 'Vårdkällans lösning', 'Hur systemet är experten', 'Tester', 'Läkemedel > ordinationsorsak är obligatorisk', 'Kopplade egna krav', 'L7']) {
        await post.filter({ hasText: t }).waitFor({ timeout: 8000 });
      }
      await page.evaluate(() => document.getElementById('notiser').replaceChildren());
      await bild(page, '61-sussa-post');
      // Filtret finns kvar efter en omladdning, och en länk med post öppnar posten.
      await page.reload(); await vantaVy(page);
      if (await page.inputValue('#sf-sok') !== '3.5.2.6') throw new Error('sökningen fanns inte kvar efter omladdning');
      await gaTill(page, '#/krav?post=3.1.11.1');
      await forvanta(page, 'details.sussapost[open][data-id="3.1.11.1"] .sussa-innehall', 'Hur systemet är experten');
      await gaTill(page, '#/krav?kategori=leverantor');
      await page.click('details.sussapost[data-id="11.2.1.1"] > summary');
      await forvanta(page, 'details.sussapost[data-id="11.2.1.1"] .sussa-innehall', 'Posten gäller leverantören');
    });
    await s('Sara: det egna ramverket finns kvar som andra flik, med filter på status', async () => {
      await gaTill(page, '#/krav');
      await page.click('.flikar a:has-text("Eget ramverk")');
      await page.waitForURL(/vy=egna$/);
      await forvanta(page, '.testkorning', 'tester gröna');
      await page.click('.delflikar a:has-text("Planerat")');
      await page.waitForURL(/vy=egna&status=planerat/);
      await forvanta(page, '.delflikar a[aria-current]', 'Planerat');
      if (await page.locator('.krav-uppfyllt_demo').count()) throw new Error('filtret visade uppfyllda krav');
      await page.click('.delflikar a:has-text("Alla")');
      await page.waitForURL(/vy=egna$/);
      await forvanta(page, '.delflikar a[aria-current]', 'Alla');
      await forvanta(page, '.krav-anm', 'originalnummer finns nu för kapitel 1 till 6 och 11');
      await page.locator('.testlista summary').first().click();
      await bild(page, '14-kravsparbarhet');
    });
    await s('Sara: moduler, migreringsavstämning och svarstider', async () => {
      await gaTill(page, '#/moduler'); await forvanta(page, '.modul-planerat', 'Cytostatika'); await bild(page, '15-moduler', true);
      await gaTill(page, '#/migrering'); await forvanta(page, '.avst-fel', 'Avvikelse'); await forvanta(page, '.avvikelse', 'jodkontrastmedel'); await bild(page, '16-migrering', true);
      await gaTill(page, '#/drift'); await forvanta(page, '.drift-tabell', 'GET /api/patient/:id'); await bild(page, '17-svarstider', true);
    });
    await s('Sara: väljer en reservkod för läsläget vid avbrott och ser när reservkopian går ut', async () => {
      await gaTill(page, '#/arbetslista');
      await page.click('[data-a="reservkod"]');
      const dl = page.locator('dialog[open]');
      await dl.waitFor();
      await forvanta(page, 'dialog[open]', 'SITHS-kortet');
      await dl.locator('#dlg-kod').fill('246813');
      await dl.locator('#dlg-kod2').fill('246813');
      await dl.locator('[data-varde="spara"]').click();
      await forvanta(page, '.notis', 'Reservkoden är sparad');
      await forvanta(page, '[data-a="reservkod"]', 'Reservkopia till');
      await page.click('[data-a="reservkod"]');
      await forvanta(page, 'dialog[open] .ruta-info', 'Du har en reservkopia på den här datorn');
      await bild(page, '42-reservkod-vald');
      await page.locator('dialog[open] [data-varde="avbryt"]').click();
    });

    // Remisskedjan: Per Holm skickar, Karin Berg kvitterar, Sara Lindqvist bedömer och svarar, Per Holm kvitterar svaret.
    await s('Per Holm loggar in och skickar en remiss för Gunnar Åkesson till kardiologen', async () => {
      await loggaIn(page, 'lak-vc');
      await forvanta(page, '.inloggad', 'Per Holm');
      await gaTill(page, '#/patient/p01/remisser');
      await page.click('[data-ny]');
      await page.selectOption('select[name="tillEnhetId"]', 'uso-kard');
      await page.selectOption('select[name="prioritet"]', 'skyndsam');
      await page.fill('textarea[name="fragestallning"]', 'Bedömning inför elkonvertering. Ny tid på mottagningen?');
      await page.fill('textarea[name="anamnes"]', 'Utskriven från avdelning 72. Waran, INR 2,4.');
      await page.click('#remissform [type="submit"]');
      await forvanta(page, '.notis', 'Remissen är skickad');
      const forsta = page.locator('#p-remisser .remiss').first();
      remissId = (await forsta.getAttribute('id')).replace('remiss-', '');
      await forvanta(page, `#remiss-${remissId} .steg-nasta`, 'Mottagen');
      await bild(page, '18-remiss-skickad', true);
    });
    await allaVyer(page, 'Per Holm', MENY.klinisk);
    await s('Karin Berg kvitterar remissen som mottagen men ser ingen journaltext', async () => {
      await loggaIn(page, 'adm-kard');
      await gaTill(page, '#/remisser');
      const kort = page.locator(`#remiss-${remissId}`);
      await kort.waitFor();
      if (await kort.getByText('Bedömning inför elkonvertering').count()) throw new Error('vårdadministratören ser frågeställningen');
      await kort.locator('[data-remiss-atgard="mottag"]').click();
      await forvanta(page, '.notis', 'kvitterad som mottagen');
      await page.locator(`#remiss-${remissId} .steg-klar`, { hasText: 'Mottagen' }).waitFor();
    });
    await allaVyer(page, 'Karin Berg', MENY.klinisk);
    await s('Karin Berg: översikten visar administrativa uppgifter, ingen journaltext och inga läkemedel', async () => {
      await gaTill(page, '#/patient/p01');
      await forvanta(page, '.ruta-info', 'Journaltext, diagnoser och läkemedel visas inte');
      const flikar = await page.locator('.flikar a').allTextContents();
      if (JSON.stringify(flikar) !== JSON.stringify(['Översikt', 'Remisser', 'Logglista'])) throw new Error(`flikar ${flikar}`);
      if (await page.locator('.signal-overk').count()) throw new Error('överkänslighet visas för vårdadministratören');
      await bild(page, '19-vardadministrator', true);
    });
    await s('Sara Lindqvist accepterar och besvarar remissen', async () => {
      await loggaIn(page, 'lak-kard');
      await gaTill(page, `#/remisser?riktning=inkommande&remiss=${remissId}`);
      const kort = page.locator(`#remiss-${remissId}`);
      await kort.locator('[data-remiss-atgard="bedom"]').click();
      let dl = page.locator('dialog[open]');
      await dl.locator('#b-acc').check();
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Remissen är accepterad');
      await page.locator(`#remiss-${remissId} [data-remiss-atgard="svara"]`).click();
      dl = page.locator('dialog[open]');
      await dl.locator('textarea').fill('Tid på kardiologiska mottagningen om två veckor. Fortsätt Waran med INR 2 till 3.');
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Svaret är skickat');
      await page.locator(`#remiss-${remissId} .steg-klar`, { hasText: 'Besvarad' }).waitFor();
    });
    await s('Per Holm kvitterar svaret från inkorgen och kedjan är hel', async () => {
      await loggaIn(page, 'lak-vc');
      await gaTill(page, '#/inkorg');
      await page.locator(`#ik-svar ~ ul a[href*="remiss=${remissId}"]`).click();
      await vantaVy(page);
      const kort = page.locator(`#remiss-${remissId}`);
      await kort.locator('[data-remiss-atgard="kvittera"]').click();
      await forvanta(page, '.notis', 'Svaret är kvitterat');
      await page.locator(`#remiss-${remissId} .steg-klar`, { hasText: 'Svar kvitterat' }).waitFor();
      const klara = await page.locator(`#remiss-${remissId} .steg-klar`).count();
      if (klara !== 5) throw new Error(`${klara} av 5 steg klara`);
      await page.locator(`#remiss-${remissId}`).scrollIntoViewIfNeeded();
      await bild(page, '20-remiss-kedjan-klar');
    });
    await s('Per Holm kvitterar också det gamla remissvaret för Anna Viklund, larmet försvinner', async () => {
      await gaTill(page, '#/inkorg');
      await forvanta(page, '.ik-larm', 'Svaret är inte kvitterat');
      await page.locator('#ik-svar ~ ul a').first().click();
      await vantaVy(page);
      await page.locator('.remiss.markerad [data-remiss-atgard="kvittera"]').click();
      await forvanta(page, '.notis', 'Svaret är kvitterat');
      await gaTill(page, '#/inkorg');
      await saknas(page, 'Svaret är inte kvitterat');
    });

    // Erik Nyström, akuten
    await s('Erik Nyström loggar in, väntrummet visar könummer och aldrig namnet på den skyddade patienten', async () => {
      await loggaIn(page, 'lak-akut');
      await gaTill(page, '#/vantrum');
      await forvanta(page, '.vantrum-tabell', 'Nummer A09');
      await forvanta(page, '.vantrum-tabell .skyddad-namn', 'Namn visas inte');
      await forvanta(page, '.ruta-forklaring', 'röjdes fem personer');
      await saknas(page, 'Engberg');
      await bild(page, '21-vantrum', true);
    });
    await allaVyer(page, 'Erik Nyström', MENY.klinisk);
    await s('Erik Nyström söker Thomas Lindberg, som akuten saknar vårdrelation med', async () => {
      await gaTill(page, '#/sok');
      await page.fill('#sokfalt', 'Lindberg');
      await page.click('#sokform [type="submit"]');
      await forvanta(page, '#traffar', 'Thomas Lindberg');
      await forvanta(page, '#traffar', 'Nej, journalen kräver en grund');
      await page.click('#traffar a:has-text("Thomas Lindberg")');
      await forvanta(page, 'main h1', 'Ingen vårdrelation');
      await bild(page, '22-ingen-vardrelation');
    });
    await s('Erik Nyström använder nödåtkomst med motivering', async () => {
      await valDialog(page, '.ruta-nod [data-val="nodatkomst"]', { intyg: true, bildnamn: '23-dialog-nodatkomst' });
      await forvanta(page, '.patientband h1', 'Thomas Lindberg');
      await forvanta(page, '.band-grund', 'Nödåtkomst, loggas och granskas');
      await page.waitForSelector('.tidslinje');
      await forvanta(page, '.tidslinje', 'Diabetes');
      await bild(page, '24-nodatkomst-journal', true);
    });
    await s('Erik Nyström: sök på personnummer hittar den skyddade patienten bara på fullständigt nummer', async () => {
      await gaTill(page, '#/sok?q=Engberg');
      await forvanta(page, '#traffar', 'Ingen patient hittades');
      await gaTill(page, '#/sok?q=198404162383');
      await forvanta(page, '#traffar .skyddad-namn', 'Skyddad identitet');
      await saknas(page, 'Engberg');
    });

    // Lena Ström, psykiatrin
    await s('Lena Ström ser psykiatrins egna uppgifter om Elin Sandberg utan spärrmarkering', async () => {
      await loggaIn(page, 'lak-psyk');
      await forvanta(page, '#lista', 'Elin Sandberg');
      await page.click('a.patientlank:has-text("Elin Sandberg")');
      await page.waitForSelector('.patientband');
      if (await page.locator('.signal-sparr').count()) throw new Error('spärrmarkering visas för den spärrade enheten själv');
      await page.click('.flikar a:has-text("Journal")');
      await forvanta(page, '.j-grupp h3', 'Allmänpsykiatriska kliniken');
      await bild(page, '25-psykiatrin', true);
    });
    await allaVyer(page, 'Lena Ström', MENY.klinisk);

    // Johan Ek, sjuksköterska
    await s('Johan Ek loggar in, kan inte ordinera men skriver och signerar en omvårdnadsanteckning', async () => {
      await loggaIn(page, 'ssk-kard');
      await gaTill(page, '#/patient/p01/lakemedel');
      if (await page.locator('[data-ny]').count()) throw new Error('sjuksköterskan har knappen Ordinera');
      await forvanta(page, '.flikhuvud', 'kan läsa läkemedelslistan men inte ordinera');
      await gaTill(page, '#/patient/p01/journal/ny');
      await forvanta(page, '.ant-form h2', 'Ny anteckning');
      const mallar = await page.locator('select[name="typ"] option').allTextContents();
      if (JSON.stringify(mallar) !== JSON.stringify(['Omvårdnadsanteckning'])) throw new Error(`mallar ${mallar}`);
      await page.fill('textarea[data-sokord="Sömn"]', 'Sov hela natten.');
      await page.click('.ant-form [data-signera]');
      await forvanta(page, '.anteckning', 'Sov hela natten.');
    });
    await allaVyer(page, 'Johan Ek', MENY.klinisk);

    // Amira Haddad, undersköterska
    await s('Amira Haddad ser omvårdnad, läkemedel och mätvärden men inga läkaranteckningar och inga diagnoser', async () => {
      await loggaIn(page, 'usk-kard');
      await gaTill(page, '#/patient/p01');
      const flikar = await page.locator('.flikar a').allTextContents();
      if (JSON.stringify(flikar) !== JSON.stringify(['Översikt', 'Journal', 'Läkemedel', 'Mätvärden', 'Logglista'])) throw new Error(`flikar ${flikar}`);
      if (await page.locator('#ov-dia').count()) throw new Error('diagnoser visas');
      await page.click('.flikar a:has-text("Journal")');
      await page.waitForSelector('.j-grupp');
      const typer = await page.locator('.j-typ').allTextContents();
      if (typer.some(t => t !== 'Omvårdnadsanteckning')) throw new Error(`typer ${typer}`);
      await page.click('.flikar a:has-text("Mätvärden")');
      await page.selectOption('#mv-typ', 'saturation');
      await page.fill('#mv-varde', '95');
      await page.click('#mv-form [type="submit"]');
      await forvanta(page, '.notis', 'Saturation 95');
      await bild(page, '26-underskoterska', true);
    });
    await allaVyer(page, 'Amira Haddad', MENY.utanRemiss);

    // Min journal: patienterna själva, i samma sandlåda som personalen ovan.
    await s('inloggningssidan har val mellan Personal och Patient, och patientlistan visar inte den skyddade patientens namn', async () => {
      await page.goto(`${BAS}/#/`);
      await page.waitForLoadState('networkidle');
      if (await page.locator('[data-a="loggaut"]').count()) await page.click('[data-a="loggaut"]');
      await page.waitForSelector('#flik-personal[aria-selected="true"]');
      if (!(await page.locator('#panel-patient').isHidden())) throw new Error('patientpanelen syns innan den valts');
      await page.click('#flik-patient');
      await forvanta(page, '#patientlista', 'Gunnar Åkesson');
      await forvanta(page, '#patientlista', 'Johanna Bergström');
      await forvanta(page, '#patientlista', 'Skyddad identitet');
      await forvanta(page, '#patientlista', '19840416-****');
      await saknas(page, 'Engberg');
      if (await page.locator('[data-invanare="inv-p09"]').count()) throw new Error('barnet under 16 år kan väljas');
      if (!page.url().endsWith('#/?vy=patient')) throw new Error(`adressen är ${page.url()}`);
      await bild(page, '45-inloggning-patient', true);
      // Tangentbordet: pil vänster går tillbaka till Personal.
      await page.focus('#flik-patient');
      await page.keyboard.press('ArrowLeft');
      await page.waitForSelector('#flik-personal[aria-selected="true"]');
      const fokus = await page.evaluate(() => document.activeElement?.id);
      if (fokus !== 'flik-personal') throw new Error(`fokus på ${fokus}`);
      if (!(await page.locator('#panel-patient').isHidden())) throw new Error('patientpanelen syns fortfarande');
    });
    await s('Gunnar Åkesson loggar in i Min journal och ser översikten utan personalens meny', async () => {
      await loggaInPatient(page, 'inv-p01');
      await forvanta(page, '.min-band h1', 'Gunnar Åkesson');
      await forvanta(page, '.inloggad', 'Inloggad med e-legitimation (simulerad)');
      if (await page.locator('#meny, .svarstid, [data-a="avbrott"]:visible').count()) throw new Error('personalens meny, svarstid eller avbrottsknapp visas');
      const flikar = await page.locator('.min-flikar a').allTextContents();
      if (JSON.stringify(flikar) !== JSON.stringify(MIN_FLIKAR)) throw new Error(`flikar ${flikar}`);
      await forvanta(page, '.oversikt-rutnat', 'Penicilliner');
      await forvanta(page, '.min-del .ruta-info', 'ett provsvar som inte är vidimerat än');
      await bild(page, '46-min-oversikt', true);
    });
    await s('Gunnar: Vem har läst visar vårdenhet, yrkesroll och grund men inga namn på personalen', async () => {
      await minFlik(page, 'Vem har läst');
      await forvanta(page, '.min-logg', 'Kardiologiska kliniken USÖ');
      await forvanta(page, '.min-logg', 'Avdelning 72, kardiologi');
      await forvanta(page, '.min-logg', 'Akutmottagningen USÖ');
      await forvanta(page, '.min-logg', 'Vårdcentralen Tybble');
      await forvanta(page, '.min-logg', 'Sjuksköterska');
      await forvanta(page, '.min-namn', 'Namnet på den som läste visas inte här');
      for (const n of ['Sara Lindqvist', 'Johan Ek', 'Amira Haddad', 'Per Holm', 'Karin Berg', 'Erik Nyström']) await saknas(page, n);
      if (await page.locator('.min-logg [data-egen]:visible').count()) throw new Error('egna besök visas utan att de valts');
      await page.check('#min-egna');
      await page.locator('.min-logg [data-egen]').first().waitFor({ state: 'visible' });
      await page.uncheck('#min-egna');
      await bild(page, '47-min-vem-har-last', true);
      await page.click('[data-loggutdrag]');
      await forvanta(page, '.notis', 'Begäran om loggutdrag är skickad');
    });
    await s('Gunnar: provsvaret väntar på vidimering och en anteckning öppnas i sin helhet', async () => {
      await minFlik(page, 'Provsvar');
      await forvanta(page, '.min-del .ruta-info', 'PK (INR)');
      await forvanta(page, '.min-matlista', 'Puls');
      await minFlik(page, 'Anteckningar');
      await page.locator('.min-ant li', { hasText: 'Rättad' }).first().locator('a').click();
      await page.waitForSelector('.min-anteckning');
      await forvanta(page, '.min-anteckning', 'Anteckningen är rättad');
      await forvanta(page, '.min-anteckning', 'Skriven av');
      await page.click('.version-gammal summary');
      await forvanta(page, '.min-anteckning', 'Fel vikt i första versionen.');
      await forvanta(page, '.version-gammal .overstruken', 'Vikt 81,6 kg');
      await bild(page, '48-min-anteckning', true);
    });
    await s('Gunnar: personalens sidor och andra patienters journaler går inte att nå', async () => {
      await page.goto(`${BAS}/#/arbetslista`);
      await page.waitForURL(/#\/min/);
      await page.goto(`${BAS}/#/patient/p02`);
      await page.waitForURL(/#\/min/);
      await vantaVy(page);
      await gaTill(page, '#/min/p02');
      await forvanta(page, 'main h1', 'Journalen finns inte');
      await saknas(page, 'Lindberg');
      await gaTill(page, '#/krav');
      await forvanta(page, '.testkorning', 'tester gröna');
    });
    await s('Elin Sandberg ser psykiatrins uppgifter trots spärren och begär att spärren hävs', async () => {
      await loggaInPatient(page, 'inv-p04');
      await forvanta(page, '.min-band', 'En spärr mot andra vårdenheter');
      await minFlik(page, 'Anteckningar');
      await forvanta(page, '.min-ant', 'Allmänpsykiatriska kliniken USÖ');
      await forvanta(page, '.min-dolda', 'Visas inte i Min journal');
      await minFlik(page, 'Spärrar');
      await forvanta(page, '.min-del', 'Allmänpsykiatriska kliniken USÖ');
      await page.click('[data-hav="uso-psyk"]');
      await forvanta(page, '.notis', 'Begäran är skickad till vården');
      await forvanta(page, '.min-del', 'Häva en spärr');
      await forvanta(page, '.min-del', 'inte behandlad än');
      await bild(page, '49-min-sparrar', true);
    });
    await s('David Nordin: psykiatrins nya mottagningsanteckning visas senare', async () => {
      await loggaInPatient(page, 'inv-p15');
      await minFlik(page, 'Anteckningar');
      await forvanta(page, '.min-dolda', 'Visas senare');
      await saknas(page, 'I remission');
    });
    await s('Johanna Bergström läser Leos journal som vårdnadshavare men kan inte spärra den', async () => {
      await loggaInPatient(page, 'inv-vh01');
      await forvanta(page, 'main h1', 'Min journal');
      await forvanta(page, '.min-journaler', 'Leo Bergström');
      await forvanta(page, 'main', 'Det finns ingen journal om dig själv');
      await page.click('.min-journaler a');
      await forvanta(page, '.min-band h1', 'Leo Bergström');
      await forvanta(page, '.min-band', 'Du läser som vårdnadshavare');
      await forvanta(page, '.oversikt-rutnat', 'Jordnöt');
      await bild(page, '50-min-vardnadshavare', true);
      await minFlik(page, 'Spärrar');
      await forvanta(page, '.min-del', 'En vårdnadshavare kan inte spärra barnets uppgifter');
      if (await page.locator('#min-sparrform').count()) throw new Error('vårdnadshavaren kan begära spärr');
    });

    // Mats Wall, logggranskare
    await s('Mats Wall loggar in och landar i logguppföljningen med hel loggkedja', async () => {
      await loggaIn(page, 'logg');
      await forvanta(page, 'main h1', 'Logguppföljning');
      await forvanta(page, '.kedja-hel', 'Loggkedjan är hel');
    });
    await allaVyer(page, 'Mats Wall', MENY.logg);
    await s('Mats Wall filtrerar på nödåtkomst och ser Erik Nyströms åtkomst med syfte', async () => {
      await gaTill(page, '#/logg');
      await page.click('label[for="fl-nodatkomst"]');
      await page.waitForURL(/flagga=nodatkomst/);
      await vantaVy(page);
      await forvanta(page, '.logg-tabell', 'Erik Nyström');
      await forvanta(page, '.logg-tabell', 'Medvetslös vid ankomst');
      await forvanta(page, '.logg-tabell', 'Thomas Lindberg');
      await forvanta(page, '.kedja-hel', 'Loggkedjan är hel');
      await bild(page, '27-logg-nodatkomst', true);
    });
    await s('Mats Wall filtrerar på samtycke och nekade försök', async () => {
      await page.click('label[for="fl-samtycke"]');
      await page.waitForURL(/flagga=samtycke/);
      await vantaVy(page);
      await forvanta(page, '.logg-tabell', 'Samtycke till spärrade uppgifter');
      await page.click('label[for="fl-nekad"]');
      await page.waitForURL(/flagga=nekad/);
      await vantaVy(page);
      await forvanta(page, '.logg-tabell', 'Nekad');
    });
    await s('Mats Wall ser patienternas egna läsningar i Min journal, utan flagga', async () => {
      await gaTill(page, '#/logg');
      const rad = page.locator('.logg-tabell tr', { hasText: 'Patienten själv' }).first();
      await rad.waitFor();
      if (await rad.evaluate(tr => tr.classList.contains('flaggad'))) throw new Error('patientens egen läsning är flaggad');
      await forvanta(page, '.logg-tabell', 'Johanna Bergström');
    });
    await s('Mats Wall öppnar logglistan för Gunnar Åkesson och ser dagens åtkomster', async () => {
      await gaTill(page, '#/sok?q=Åkesson');
      await page.click('#traffar a:has-text("Gunnar Åkesson")');
      await forvanta(page, 'main h1', 'Logglista för Gunnar Åkesson');
      await forvanta(page, '.logg-tabell', 'Sara Lindqvist');
      await forvanta(page, '.logg-tabell', 'Per Holm');
      await bild(page, '28-logglista-patient', true);
    });
    await s('Mats Wall kan inte öppna journalen', async () => {
      await page.goto(`${BAS}/#/patient/p01`);
      await page.waitForURL(/#\/logg$/);
      await vantaVy(page);
    });
    await s('återställ demon ger nya patienter men behåller inloggningen', async () => {
      await page.click('[data-a="aterstall"]');
      await forvanta(page, '.notis', 'Demon är återställd');
      await forvanta(page, '.inloggad', 'Mats Wall');
    });

    // Användartestet (D6). Hela testet med enkät och resultatfil testas i test/anvandartest.cjs.
    await s('användartestet startas från inloggningssidan och visar en uppgift i taget i listen', async () => {
      await page.click('[data-a="loggaut"]');
      await page.waitForSelector('[data-roll]');
      await page.click('a[href="#/anvandartest"]');
      await forvanta(page, 'main h1', 'Användartest');
      await forvanta(page, '.at-info', 'Alla patienter i demon är påhittade');
      await page.fill('#at-kod', 'G01');
      for (const id of ['oppna-patient', 'las-anteckning', 'daganteckning', 'ordinera', 'utsattning', 'kvittera-svar', 'nodatkomst', 'halsoarende', 'inskrivning', 'flytta', 'utskrivning', 'registrera-besok', 'planera-video']) await page.uncheck(`input[name="uppgift"][value="${id}"]`);
      await page.click('#at-start [type="submit"]');
      await forvanta(page, '#testlage', 'Uppgift 1 av 2');
      await forvanta(page, '#testlage-text', 'blodtryck till 128/82');
      await page.click('#testlage [data-t="borja"]');
      await page.waitForSelector('#testlage [data-t="klar"]', { timeout: 15000 });
      await forvanta(page, '.inloggad', 'Johan Ek');
      await page.waitForSelector('.tidslinje');
      await bild(page, '43-anvandartest-uppgift');
    });
    await s('användartestet går att avbryta, och då raderas allt som mätts', async () => {
      await page.click('#testlage [data-t="hoppa"]');
      await forvanta(page, '#testlage', 'Uppgift 2 av 2');
      await page.click('#testlage [data-t="avbryt"]');
      await page.click('dialog[open] [data-varde="ok"]');
      await page.waitForSelector('#at-start');
      await page.waitForSelector('[data-a="loggaut"]', { state: 'detached' });
      const kvar = await page.evaluate(() => ({ lagrat: sessionStorage.getItem('vk_anvandartest'), list: Boolean(document.getElementById('testlage')) }));
      if (kvar.lagrat !== null || kvar.list) throw new Error('testläget finns kvar efter att testet avbrutits');
    });
  } catch (e) {
    await page.screenshot({ path: join(UT, '00-fel.png'), fullPage: true }).catch(() => {});
  }

  // Mobilbredd 360 px: ingen sidledsrullning.
  const mobil = await browser.newContext({ viewport: { width: 360, height: 760 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm', deviceScaleFactor: 2 });
  const mp = await mobil.newPage();
  bevaka(mp, 'mobil');
  const ingenSidledsrullning = async (vy) => {
    const b = await mp.evaluate(() => document.documentElement.scrollWidth);
    if (b > 360) throw new Error(`${vy}: sidan är ${b} px bred`);
  };
  try {
    if (!fel.length) {
      await s('mobil: inloggningen på 360 px', async () => {
        await mp.goto(`${BAS}/`); await mp.waitForSelector('.roll');
        await ingenSidledsrullning('inloggning');
        await bild(mp, '29-mobil-inloggning');
      });
      await s('mobil: patientjournalen på 360 px', async () => {
        await mp.click('[data-roll="lak-kard"]'); await mp.waitForSelector('#lista table');
        await ingenSidledsrullning('arbetslista');
        await mp.goto(`${BAS}/#/patient/p01`); await mp.waitForSelector('.tidslinje');
        await ingenSidledsrullning('översikt');
        await bild(mp, '30-mobil-patient');
        await mp.click('[data-a="meny"]');
        await mp.waitForSelector('#meny.oppen');
        await bild(mp, '31-mobil-meny');
        for (const h of ['#/patient/p01/journal', '#/patient/p01/lakemedel', '#/remisser', '#/krav', '#/anvandartest', '#/logg']) {
          if (h === '#/logg') continue;
          await mp.goto(`${BAS}/${h}`); await mp.waitForLoadState('networkidle');
          await ingenSidledsrullning(h);
        }
      });
      await s('mobil: Sussas kravspecifikation på 360 px', async () => {
        await mp.goto(`${BAS}/#/krav`); await mp.waitForSelector('#sf-antal:has-text("Visar 305")');
        await ingenSidledsrullning('Sussas krav');
        await mp.selectOption('#sf-status', 'uppfyllt_demo');
        await mp.waitForSelector('details.sussapost');
        await mp.goto(`${BAS}/#/krav?post=5.2.1.7`); await mp.waitForSelector('details.sussapost[open][data-id="5.2.1.7"] .sussa-innehall h3');
        await mp.waitForTimeout(200);
        const topp = await mp.locator('details.sussapost[open][data-id="5.2.1.7"]').evaluate(e => e.getBoundingClientRect().top);
        if (topp < -5 || topp > 300) throw new Error(`posten i adressen visas inte överst, utan ${Math.round(topp)} px ner`);
        await ingenSidledsrullning('Sussas krav, en post');
        await bild(mp, '62-mobil-sussa-krav');
        await mp.goto(`${BAS}/#/krav?vy=egna`); await mp.waitForSelector('.delflikar');
        await ingenSidledsrullning('eget ramverk');
      });
      await s('mobil: Min journal på 360 px', async () => {
        await mp.goto(`${BAS}/#/`); await mp.waitForLoadState('networkidle');
        await mp.click('[data-a="loggaut"]');
        await mp.waitForSelector('#flik-patient');
        await mp.click('#flik-patient');
        await mp.waitForSelector('[data-invanare="inv-p01"]');
        await ingenSidledsrullning('inloggning, patient');
        await bild(mp, '51-mobil-inloggning-patient');
        await mp.click('[data-invanare="inv-p01"]');
        await mp.waitForSelector('.min-band h1');
        await mp.waitForSelector('.oversikt-rutnat');
        await ingenSidledsrullning('Min journal, översikt');
        await bild(mp, '52-mobil-min-oversikt');
        for (const f of MIN_FLIKAR.slice(1)) {
          await minFlik(mp, f);
          await ingenSidledsrullning(`Min journal, ${f}`);
          if (f === 'Vem har läst') await bild(mp, '53-mobil-min-vem-har-last');
        }
        await mp.goto(`${BAS}/#/min/p01/anteckningar`); await mp.waitForSelector('.min-ant');
        await mp.click('.min-ant a >> nth=0'); await mp.waitForSelector('.min-anteckning');
        await ingenSidledsrullning('Min journal, anteckning');
      });
    }
  } catch { await mp.screenshot({ path: join(UT, '00-fel-mobil.png'), fullPage: true }).catch(() => {}); }

  await browser.close();
  console.log('');
  console.log(`Väntade nekade anrop (403 och 404) i konsolen: ${vantade403.length} (${[...new Set(vantade403)].join('; ')})`);
  if (fel.length) {
    console.log(`\nGenomgången misslyckades: ${steg} steg, ${fel.length} fel`);
    for (const f of fel) console.log(`  ${f}`);
    process.exit(1);
  }
  console.log(`Genomgången klar: ${steg} steg, 0 fel, 8 roller och 5 patienter i Min journal. Skärmbilder i ${UT}`);
})().catch(e => { console.error(e); process.exit(1); });
