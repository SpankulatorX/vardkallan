// Genomgång av Vårdkällans gränssnitt med Playwright. Loggar in som var och en av de fjorton demorollerna,
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
const MIN_FLIKAR = ['Översikt', 'Tider', 'Anteckningar', 'Diagnoser', 'Läkemedel', 'Provsvar', 'Remisser', 'Vem har läst', 'Spärrar'];
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

// Runda 7, r2: all personal har Utbildning (övningar och intyg, Sussa 10.1.1.5) före Migreringsavstämning.
const MENY = {
  // Läkaren registrerar också delegeringar (runda 5, r4).
  // Runda 6, r2: läkaren och sjuksköterskan har Direktiv och uppföljning.
  klinisk: ['Arbetslista', 'Sök patient', 'Inkorg', 'Delegeringar', 'Direktiv och uppföljning', 'Remisser', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Sjuksköterskan registrerar delegeringar, och undersköterskan med delegering ger läkemedel (runda 5).
  sjukskoterska: ['Arbetslista', 'Sök patient', 'Inkorg', 'Läkemedel att ge', 'Delegeringar', 'Direktiv och uppföljning', 'Remisser', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 6, r2: farmaceuten i den fördjupade läkemedelsgenomgången.
  farmaceut: ['Arbetslista', 'Sök patient', 'Inkorg', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  underskoterska: ['Arbetslista', 'Sök patient', 'Inkorg', 'Läkemedel att ge', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  utanRemiss: ['Arbetslista', 'Sök patient', 'Inkorg', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Vårdadministratören har tidboken först: dagens arbete, tidbok och väntelista (Sussa 3.4.1 till 3.4.4).
  vardadministrator: ['Dagens arbete', 'Tidbok', 'Väntelista', 'Arbetslista', 'Sök patient', 'Inkorg', 'Remisser', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  logg: ['Sök patient', 'Logguppföljning', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  arkiv: ['E-arkiv och gallring', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 6, r3: Lena Ström på psykiatrin har bevakningen av tvångsvården, och kommunen (simulerad) har Samverkan.
  psykiatri: ['Arbetslista', 'Sök patient', 'Inkorg', 'Delegeringar', 'Tvångsvård', 'Direktiv och uppföljning', 'Remisser', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  kommun: ['Samverkan', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 7, r5: uppföljningsrollen granskar och skickar rapporterna till myndigheter och register.
  uppfoljning: ['Datauttag', 'Tvångsvård och samordning', 'Rapportering', 'Utbildning', 'Användartester', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 6, r6: verksamhetschefen utser uppdragen i läkemedelshanteringen och fastställer generella direktiv.
  verksamhetschef: ['Läkemedelsansvar', 'Direktiv och uppföljning', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 7, r3: ekonomen tar fram faktureringsunderlaget och sköter prislistorna.
  ekonom: ['Faktureringsunderlag', 'Prislistor', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 7, r4: systemförvaltaren har regler och parametrar, omorganisation, undantag och lagring.
  systemforvaltare: ['Regler och parametrar', 'Omorganisation', 'Undantag från visning', 'Lagring', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 7, r6: läkaren på Vårdcentralen Tybble har Barnhälsovård, eftersom vårdenheten har en barnavårdscentral.
  bvc: ['Arbetslista', 'Sök patient', 'Inkorg', 'Delegeringar', 'Direktiv och uppföljning', 'Barnhälsovård', 'Remisser', 'Väntrum (akuten)', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
  // Runda 7, r1: fysioterapeuten, paramedicinaren i Sussas testfall.
  fysioterapeut: ['Arbetslista', 'Sök patient', 'Inkorg', 'Remisser', 'Utbildning', 'Migreringsavstämning', 'Kravspårbarhet', 'Moduler', 'Öppet API', 'Svarstider'],
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm' });
  const page = await ctx.newPage();
  bevaka(page, 'skrivbord');
  let remissId = null;

  try {
    // Utan inloggning
    await s('inloggningssidan visar de arton demorollerna och demoraden', async () => {
      await page.goto(`${BAS}/`);
      await page.waitForSelector('.roll');
      const n = await page.locator('.roll').count();
      // Runda 6, r6: verksamhetschefen är den trettonde. Runda 7: ekonomen (r3), de två systemförvaltarna (r4) och
      // distriktssköterskan Hanna Lilja i barnhälsovården (r6), och fysioterapeuten i Sussas testfall (r1).
      if (n !== 18) throw new Error(`${n} roller`);
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
    // Runda 6, r1: sökning i journalen, kurvor och NEWS2.
    await s('Sara söker på blodtryck i journalen, ser tolkningen och öppnar kurvan med referensintervall', async () => {
      await gaTill(page, '#/patient/p01');
      await page.fill('#jsok-falt', 'blodtryck');
      await page.press('#jsok-falt', 'Enter');
      await forvanta(page, '[data-tolkning]', 'mätvärdena blodtryck');
      await forvanta(page, '.jsok-traff mark', 'Blodtryck');
      await bild(page, '90-journalsok', true);
      await page.locator('.jsok-traff a[data-traff="matvarde"]').first().click();
      await forvanta(page, '#kurva-blodtryck.markerad h4', 'Blodtryck');
      await forvanta(page, '.news2', 'NEWS2');
      await forvanta(page, '.news2', 'Nästa kontroll senast');
      await forvanta(page, '#kurva-inr', 'Målintervall vid behandling med warfarin');
      await bild(page, '91-kurvor-news2', true);
    });
    // Runda 6, r5: en extern tillämpning startas från journalen med SMART on FHIR och stängs igen.
    await s('Sara startar Blodtryck över tid från journalen, ser diagrammet och stänger tillämpningen', async () => {
      await gaTill(page, '#/patient/p01/tillampningar');
      await forvanta(page, '.tillampning', 'Blodtryck över tid');
      await forvanta(page, '.ingress', 'utan aktiva val, nödåtkomst eller samtycke');
      await page.click('[data-starta="blodtryck"]');
      await page.frameLocator('#tillampning-ram iframe').locator('[data-diagram] svg').waitFor({ timeout: 15000 });
      await forvanta(page, '[data-tillampning-status]', 'Blodtryck över tid visar');
      await bild(page, '95-tillampning-blodtryck', true);
      await page.click('[data-stang]');
      await forvanta(page, '.notis', 'Tillämpningen är stängd');
    });
    await s('Sara söker på sertralin hos Elin Sandberg och får inga träffar ur den spärrade psykiatrin', async () => {
      await gaTill(page, '#/patient/p04/sok?q=sertralin');
      await forvanta(page, '.antal-text', 'Inga träffar.');
      if (await page.locator('.jsok-traff').count()) throw new Error('träffar visas ur den spärrade psykiatrin');
      // Spärrmarkeringen i patienthuvudet står kvar, men sökträffarna säger inget om det spärrade.
      const traffar = await page.locator('#flikinnehall').textContent();
      if (/spärr|psykiatri|depression/i.test(traffar)) throw new Error(`sökträffarna nämner det spärrade: ${traffar.slice(0, 200)}`);
    });
    await s('Sara: inkorgen och svarstiden', async () => {
      await gaTill(page, '#/inkorg');
      await forvanta(page, '.ik-larm', 'Mottagningskvittens saknas');
      // Återinsättning efter uppehåll med antikoagulantia (runda 5, r4).
      await forvanta(page, '#ik-atersatt', 'Läkemedel att sätta in igen');
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
    await s('Sara: uppmärksamhetsinformationen i patienthuvudet och systemets förslag ur läkemedelslistan', async () => {
      await forvanta(page, '.patientband .signal-um summary', 'Överkänslighet: Penicilliner');
      await forvanta(page, '.um-forslag', 'Antikoagulantiabehandling');
      await forvanta(page, '.um-forslag', 'demoregel');
      await page.click('.patientband .signal-um summary');
      await forvanta(page, '.um-panel', 'Registrerad');
      await forvanta(page, '.um-panel', 'skadlig');
      await bild(page, '63-uppmarksamhet');
      await page.click('.patientband .signal-um summary');
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
      // Vänta in systemets förslag ur produkten, annars kan förslaget ändra formuläret mellan kontrollen och sparandet.
      await page.waitForFunction(() => document.querySelector('input[name="dos"]')?.value === '400');
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
    await s('Sara: simulerar att NLL inte svarar i tid, ordinationen syns ändå, och avstämningen hittar registreringen', async () => {
      await page.click('.demo-panel summary');
      await page.click('[data-nll="timeout"]');
      await forvanta(page, '#nll-lage', 'inget svar i tid');
      await page.click('[data-ny]');
      await page.fill('#lm-sok', 'omeprazol');
      await page.click('[data-lm]');
      await page.fill('input[name="dosering"]', '1 kapsel på morgonen');
      await page.fill('input[name="ordinationsorsak"]', 'Magskydd under NSAID-behandling');
      await page.click('[data-upp="14"]');
      await page.click('[data-spara]');
      await forvanta(page, '.notis', 'NLL svarade inte i tid');
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
      await page.waitForSelector('#kurva-puls svg.kurva');
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
      // Runda 7, r7: hela specifikationen ingår, och ingen text säger längre att kapitel saknas.
      if (await page.locator('.sussa-utdrag').count()) throw new Error('rutan om kapitel som saknas finns kvar');
      await forvanta(page, '.ingress-block', 'dnr 16RS2022');
      await forvanta(page, '.sussa-summa tfoot', 'Totalt');
      await forvanta(page, '#sf-antal', 'Visar 389 av 389 poster.');
      if (await page.locator('#sf-kapitel option[value="7"]').isDisabled()) throw new Error('kapitel 7 går inte att välja');
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
      await forvanta(page, '#sf-antal', 'Visar 1 av 389 poster.');
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
    // Runda 7, r7: driftspecifikationen som eget filter, vikt, Cambios svar, avtalets signaler och bör-kraven (K2, K3, K5).
    await s('Sara: kravsidan visar vikt, Cambios svar och vad som togs bort eller sköts upp i avtalet', async () => {
      await gaTill(page, '#/krav');
      await page.selectOption('#sf-spec', 'drift');
      const drift = await page.locator('details.sussapost').evaluateAll(d => d.map(x => x.dataset.id));
      if (drift.length !== 52 || drift.some(id => !id.startsWith('KD1.'))) throw new Error(`driftfiltret visade ${drift.length} poster, först ${drift[0]}`);
      await page.selectOption('#sf-spec', '');
      // Sortering på vikt: det högst viktade kriteriet först, med vikten i raden.
      await page.selectOption('#sf-typ', 'utvarderingskriterium');
      await page.selectOption('#sf-sortera', 'vikt');
      const forsta = page.locator('#sussa-lista details.sussapost').first();
      if (await forsta.getAttribute('data-id') !== 'KD1.1.1.9') throw new Error('det högst viktade kriteriet står inte först');
      await forvanta(page, '#sussa-lista details.sussapost[data-id="KD1.1.1.9"] summary', 'Vikt 4,64 %');
      await page.click('details.sussapost[data-id="KD1.1.1.9"] > summary');
      const kd = page.locator('details.sussapost[data-id="KD1.1.1.9"] .sussa-innehall');
      for (const t of ['Vikt i utvärderingen', 'plats 1 av 200', 'Cambios svar fick 2 av 10 poäng', 'Cambios svar i anbudet', 'Cambio svarade ja']) await kd.filter({ hasText: t }).waitFor({ timeout: 8000 });
      // Ett omaskerat svar i kapitel 3 är sammanfattat med fil och sida, ett maskerat är märkt.
      await gaTill(page, '#/krav?post=3.1.1.3');
      const p3 = page.locator('details.sussapost[open][data-id="3.1.1.3"] .sussa-innehall');
      for (const t of ['reservnummer', 'CAMBIO Anbudssvar_KAP03_3.1.1.3.pdf, sida', 'Kryss: CAMBIO Kravspecifikation Kapitel 3']) await p3.filter({ hasText: t }).waitFor({ timeout: 8000 });
      await gaTill(page, '#/krav?post=3.2.2.3');
      await forvanta(page, 'details.sussapost[open][data-id="3.2.2.3"] .sussa-maskerat', 'maskerad i den utlämnade handlingen');
      // Signalerna: CIS togs bort ur avtalet 2022 och delar av 3.4.3.3 sköts upp.
      await gaTill(page, '#/krav?avtal=exkluderat');
      await forvanta(page, '#sussa-lista details.sussapost[data-id="4.6.1.2"] summary', 'Exkluderat ur avtalet 2022');
      await page.click('details.sussapost[data-id="4.6.1.2"] > summary');
      await forvanta(page, 'details.sussapost[data-id="4.6.1.2"] .sussa-signaler', 'ÄB32');
      await gaTill(page, '#/krav?post=3.4.3.3');
      await forvanta(page, 'details.sussapost[open][data-id="3.4.3.3"] .sussa-signaler', 'Ny leveransdag: 2023-12-15');
      // Bilaga A1 och viktningen förklaras ovanför filtren.
      await page.click('.sussa-a1 > summary');
      await forvanta(page, '.sussa-a1', 'A1.1');
      await forvanta(page, '.sussa-a1', 'Finns inte');
      await page.click('.sussa-viktning > summary');
      await forvanta(page, '.sussa-viktning', '9.1.1.2 och 9.1.1.3');
      await page.evaluate(() => document.getElementById('notiser').replaceChildren());
      await bild(page, '63-sussa-avtal');
      // Genvägen till de tio högst viktade som inte är uppfyllda, och tillbaka till hela urvalet.
      await page.click('#sf-arbetslista');
      await forvanta(page, '#sa-vikt', 'De 10 högst viktade');
      if ((await page.locator('#sussa-lista details.sussapost').count()) !== 10) throw new Error('genvägen visade inte tio poster');
      if (await page.locator('#sussa-lista .krav-uppfyllt_demo').count()) throw new Error('genvägen visade uppfyllda poster');
      await page.click('#sf-visa-alla');
      await forvanta(page, '#sf-antal', 'Visar');
      if ((await page.locator('#sussa-lista details.sussapost').count()) <= 10) throw new Error('Visa alla visade inte hela urvalet');
      // Bör-krav och målbild som egen flik, kopplad till posterna.
      await page.click('.flikar a:has-text("Bör-krav och målbild")');
      await page.waitForURL(/vy=bor$/);
      await forvanta(page, '#bor-bor', 'Bör-krav');
      await forvanta(page, '#bor-malbild', 'Målbild');
      await forvanta(page, '.kravgrupp', 'Ekonomisk information bör kunna visualiseras');
      await page.locator('.bor-poster a[href="#/krav?post=7.1.2.1"]').first().click();
      await forvanta(page, 'details.sussapost[open][data-id="7.1.2.1"] .sussa-innehall', 'Kravtext');
      await gaTill(page, '#/krav?vy=bor');
      await bild(page, '64-bor-krav');
    });
    await s('Sara: det egna ramverket finns kvar som egen flik, med filter på status', async () => {
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
      await forvanta(page, '.krav-anm', 'originalnummer finns nu för kapitel 1 till 12');
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
    await allaVyer(page, 'Per Holm', MENY.bvc);
    // Runda 7, r6: tillväxt och barnhälsovård på Barnavårdscentralen Tybble.
    await s('Per Holm ser Idas tillväxtkurvor med WHO:s referenslinjer och bekräftar en mätning som mamman gjort hemma', async () => {
      await gaTill(page, '#/patient/p61/tillvaxt');
      await forvanta(page, '#tv-kurva-vikt', 'Vikt');
      await page.locator('#tv-kurva-langd svg.tv-kurva polyline.tv-ref').first().waitFor();
      await forvanta(page, '.tv-tecken', 'Mätt hemma, väntar');
      await forvanta(page, '.tv-program', 'Barnhälsovårdens program');
      await forvanta(page, '#tv-fodsel ~ *', 'Målängden är');
      await bild(page, '96-tillvaxt', true);
      await page.locator('[data-bekrafta]').first().click();
      await forvanta(page, '.notis', 'räknas nu på kurvan');
    });
    await s('Per Holm skickar barnhälsovårdens rapport till registret, som är en simulerad mottagare', async () => {
      await gaTill(page, '#/bhv');
      await forvanta(page, '#bhv-q', 'Svenska barnhälsovårdsregistret');
      await forvanta(page, '#bhv', 'simulerad mottagare');
      await bild(page, '97-bhvq', true);
      await page.click('[data-bhvq-skicka]');
      await forvanta(page, '.notis', 'Kvittens BHVQ-SIM-');
      await forvanta(page, '#bhv', 'Det finns inget nytt att rapportera');
    });
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
    await allaVyer(page, 'Karin Berg', MENY.vardadministrator);
    await s('Karin Berg: översikten visar administrativa uppgifter, ingen journaltext och inga läkemedel', async () => {
      await gaTill(page, '#/patient/p01');
      await forvanta(page, '.ruta-info', 'Journaltext, diagnoser och läkemedel visas inte');
      const flikar = await page.locator('.flikar a').allTextContents();
      if (JSON.stringify(flikar) !== JSON.stringify(['Översikt', 'Remisser', 'Logglista', 'Identitet', 'Utskrifter'])) throw new Error(`flikar ${flikar}`);
      if (await page.locator('.signal-overk').count()) throw new Error('överkänslighet visas för vårdadministratören');
      if (await page.locator('.signal-um, .um-forslag').count()) throw new Error('uppmärksamhetsinformation visas för vårdadministratören');
      await bild(page, '19-vardadministrator', true);
    });
    await s('Karin Berg: systemet har hittat en trolig dubblett och visar journalerna sida vid sida', async () => {
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-dubb ~ ul', 'Trolig dubblett, Annika Holmgren');
      await page.click('#ik-dubb ~ ul a');
      await forvanta(page, '.band-fakta', 'Reservnummer');
      await forvanta(page, '.dubblett', 'Personnummer 19650509-2962');
      await forvanta(page, '.dubblett', 'Journalen med personnummer blir kvar');
      await bild(page, '63-dubblett', true);
    });
    // Tidboken (Sussa 3.4.1 till 3.4.4): Karin Berg börjar dagen på Dagens arbete, där systemet har ordnat allt.
    await s('Karin Berg: dagens arbete visar dagens patienter, remisser, väntelistan, kallelser och bevakningar med en åtgärd per rad', async () => {
      await gaTill(page, '#/idag');
      await forvanta(page, 'main h1', 'Dagens arbete');
      await forvanta(page, '#idag-dagens tr', 'Leo Bergström');
      await forvanta(page, '#idag-dagens tr', 'Avgiftsfritt');
      await forvanta(page, '#idag-dagens tr', 'minuter sen');
      await forvanta(page, '#idag-remisser tr', 'Karl-Erik Brandt');
      await forvanta(page, '#idag-vantelista tr', 'dagar kvar');
      await forvanta(page, '#idag-kallelser', 'Hjärtskola');
      await forvanta(page, '#idag-bevakningar', 'tidigare tid blir ledig');
      for (const rad of await page.locator('#idag-dagens tbody tr, #idag-remisser tbody tr').all()) {
        const n = await rad.locator('[data-atgard]').count();
        if (n > 1) throw new Error('en rad har mer än en åtgärd');
      }
      await bild(page, '64-dagens-arbete', true);
    });
    await s('Karin Berg bokar tid för Karl-Erik Brandts remiss bland systemets förslag', async () => {
      await page.locator('#idag-remisser tr', { hasText: 'Karl-Erik Brandt' }).locator('[data-atgard="boka"]').click();
      await forvanta(page, 'dialog[open] .forslag-knapp', 'Den tidigaste lediga tiden');
      await bild(page, '65-forslag-pa-tider');
      await page.locator('dialog[open] .forslag-knapp').first().click();
      await forvanta(page, '.notis', 'Karl-Erik Brandt har fått en tid');
      await forvanta(page, '#idag-remisser', 'Alla accepterade remisser har fått tid');
    });
    await s('Ahmed Hassan checkar in på skärmen i väntrummet, som aldrig visar namn', async () => {
      await gaTill(page, '#/incheckning');
      await page.fill('#skarm-pnr', '19901117-2476');
      await page.click('#skarm-form [type="submit"]');
      await forvanta(page, '#skarm-svar', 'Du är incheckad');
      await forvanta(page, '#skarm-svar', 'Min journal eller i receptionen');
      await saknas(page, 'Ahmed');
      await saknas(page, 'Hassan');
      await bild(page, '66-incheckningsskarm', true);
      await page.fill('#skarm-pnr', '19121212-1212');
      await page.click('#skarm-form [type="submit"]');
      await forvanta(page, '#skarm-svar', 'Vi hittar ingen tid');
    });
    await s('Karin Berg tar betalt för Ahmed Hassan och checkar in David Nordin med ett klick', async () => {
      await gaTill(page, '#/idag');
      await page.locator('#idag-dagens tr', { hasText: 'Ahmed Hassan' }).locator('[data-atgard="betala"]').click();
      await forvanta(page, 'dialog[open]', 'simulerad');
      await page.click('dialog[open] [data-varde="kort"]');
      await forvanta(page, '.notis', 'är betalt med kort');
      await page.locator('#idag-dagens tr', { hasText: 'David Nordin' }).locator('[data-atgard="checka_in"]').click();
      await forvanta(page, '.notis', 'David Nordin är incheckad');
    });
    await s('Karin Berg skickar kallelserna till Hjärtskolan', async () => {
      await page.locator('#idag-kallelser [data-atgard="kalla_grupp"]').click();
      await forvanta(page, 'dialog[open] .kallelse-text', 'Hej (patientens förnamn)');
      await bild(page, '67-gruppkallelse');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', '3 kallelser är skickade');
    });
    await s('Karin Berg ändrar prioritet på väntelistan med en orsak', async () => {
      await gaTill(page, '#/vantelista');
      await forvanta(page, 'main', 'Vårdgarantin');
      await page.locator('tr', { hasText: 'Elin Sandberg' }).locator('[data-vl="prio"]').click();
      await page.locator('dialog[open] [data-grupp="orsak"] button').first().click();
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Prioriteten för Elin Sandberg är hög');
      await bild(page, '68-vantelista', true);
    });
    await s('Karin Berg: tidboken per vårdgivare, också utan namn', async () => {
      await gaTill(page, '#/tidbok');
      await forvanta(page, '.tb-schema', 'Lina Persson');
      await forvanta(page, '.tb-schema', 'David Nordin');
      await bild(page, '69-tidbok', true);
      await page.click('a:text-is("Visa utan namn")');
      await page.waitForSelector('.ruta-info:has-text("utan patientuppgifter")');
      await saknas(page, 'Nordin');
    });
    await s('Karin Berg bokar om en tid från patientens översikt, och patienten får en ny kallelse', async () => {
      await gaTill(page, '#/patient/p10');
      await forvanta(page, '.ov-tider', 'Nybesök');
      await page.locator('.ov-tider [data-tider="omboka"]').first().click();
      await page.locator('dialog[open] .forslag-knapp').first().click();
      await forvanta(page, '.notis', 'Tiden är ombokad till');
      await page.locator('.ov-tider details summary').first().click();
      await forvanta(page, '.ov-tider .kallelse', 'Din tid är ändrad');
    });
    await s('Sara Lindqvist accepterar och besvarar remissen', async () => {
      await loggaIn(page, 'lak-kard');
      // Arbetslistan hämtas klart innan sidan byts.
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
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
      // Symbolen för uppmärksamhetsinformation, utan innehåll och utan namn för den skyddade patienten.
      const um = page.locator('.vantrum-tabell tr', { has: page.locator('.skyddad-namn') }).locator('.um-lank');
      if (!(await um.count())) throw new Error('väntrummet visar ingen symbol för den skyddade patienten');
      if (!(await um.getAttribute('title')).includes('Särskild vårdrutin')) throw new Error('symbolen saknar textbeskrivning');
      await saknas(page, 'Avböjer blodtransfusion');
      await bild(page, '21-vantrum', true);
      await gaTill(page, '#/arbetslista');
      const rad = page.locator('#lista tr', { hasText: 'Ahmed Hassan' });
      if (!(await rad.locator('.um-lank').getAttribute('title')).includes('Smitta')) throw new Error('arbetslistan visar inte smitta för Ahmed Hassan');
      await saknas(page, 'MRSA');
      await rad.locator('.um-lank').click();
      await forvanta(page, '.patientband .signal-um summary', 'Bärare av MRSA');
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
    await allaVyer(page, 'Lena Ström', MENY.psykiatri);

    // Johan Ek, sjuksköterska
    await s('Johan Ek loggar in, kan inte ordinera men skriver och signerar en omvårdnadsanteckning', async () => {
      await loggaIn(page, 'ssk-kard');
      // Arbetslistan hämtas klart innan sidan byts.
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
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
    // Delegering av läkemedelshantering (runda 5, HSLF-FS 2017:37 9 kap.).
    await s('Johan Ek ser i inkorgen att Amira Haddads delegering går ut och registrerar en ny med systemets förslag', async () => {
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-deleg ~ ul', 'Delegering går ut, Amira Haddad');
      await page.click('#ik-deleg ~ ul a');
      await vantaVy(page);
      await forvanta(page, '.del-person', 'Gäller till och med');
      await page.click('.del-person [data-del="ny"]');
      const dl = page.locator('dialog[open]');
      await dl.waitFor();
      if (!(await dl.locator('#del-tabletter_peroralt').isChecked()) || !(await dl.locator('#del-insulin_subkutant').isChecked())) throw new Error('systemet föreslog inte samma omfattning som den nuvarande delegeringen');
      await dl.locator('#del-intyg').check();
      await bild(page, '80-delegering');
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Delegeringen för Amira Haddad är registrerad');
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-deleg ~ .tom', 'Inga delegeringar går ut');
    });
    // Runda 6, r1: NEWS2-larmet i inkorgen med vad som ska göras.
    await s('Johan Ek ser NEWS2-larmet för Annika Holmgren i inkorgen med vad som ska göras', async () => {
      await gaTill(page, '#/inkorg');
      await forvanta(page, '.ik-news2', 'NEWS2 7, hög risk');
      await forvanta(page, '.ik-news2', 'Puls 134 slag/min ger 3 poäng');
      await forvanta(page, '.ik-news2', 'intensivvård');
      await bild(page, '92-inkorg-news2', true);
    });
    await allaVyer(page, 'Johan Ek', MENY.sjukskoterska);

    // Amira Haddad, undersköterska
    await s('Amira Haddad ser omvårdnad, läkemedel och mätvärden men inga läkaranteckningar och inga diagnoser', async () => {
      await loggaIn(page, 'usk-kard');
      await gaTill(page, '#/patient/p01');
      const flikar = await page.locator('.flikar a').allTextContents();
      // Runda 6, r3: undersköterskan ser vårdplanerna och registrerar sina egna åtgärder under Planer.
      if (JSON.stringify(flikar) !== JSON.stringify(['Översikt', 'Journal', 'Läkemedel', 'Mätvärden', 'Logglista', 'Identitet', 'Utskrifter', 'Planer', 'Tillämpningar'])) throw new Error(`flikar ${flikar}`);
      if (await page.locator('#ov-dia').count()) throw new Error('diagnoser visas');
      await page.click('.flikar a:has-text("Journal")');
      await page.waitForSelector('.j-grupp');
      const typer = await page.locator('.j-typ').allTextContents();
      if (typer.some(t => t !== 'Omvårdnadsanteckning')) throw new Error(`typer ${typer}`);
      await page.click('.flikar a:has-text("Mätvärden")');
      await page.selectOption('#mv-typ', 'saturation');
      await page.fill('#mv-varde', '95');
      await page.click('#mv-form [type="submit"]');
      await forvanta(page, '.notis', 'Syremättnad 95');
      await bild(page, '26-underskoterska', true);
    });
    await s('Amira Haddad ger en dos med delegering och ser inte Ge för en injektion som delegeringen inte omfattar', async () => {
      // Läkaren ordinerar Fragmin, en injektion under huden utan fasta tider, via API:t.
      await loggaIn(page, 'lak-kard');
      const r = await page.request.post(`${BAS}/api/patient/p01/lakemedel`, { headers: { Origin: BAS }, data: {
        lakemedelId: 'VK-NPL-0004', dosering: 'Enligt schema för bryggbehandling', dos: 5000, dosEnhet: 'IE', typ: 'staende', ordinationsorsak: 'Bryggbehandling',
        uppfoljningsdatum: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10), kvitteradeVarningar: [{ regel: 'dubbel_antikoagulantia', motivering: 'Bryggbehandling inför uppehåll med Waran' }] } });
      if (!r.ok()) throw new Error(`ordinationen gick inte: ${r.status()}`);
      await loggaIn(page, 'usk-kard');
      await page.click('#meny-lista a[href="#/administrering"]');
      await vantaVy(page);
      await forvanta(page, '.adm-delegering', 'Du ger läkemedel med delegering');
      const gunnar = page.locator('.adm-patient', { hasText: 'Gunnar Åkesson' });
      const fragmin = gunnar.locator('.adm-vb', { hasText: 'Fragmin' });
      await fragmin.waitFor();
      if (await fragmin.locator('[data-adm]').count()) throw new Error('knappen Ge visas för Fragmin, som delegeringen inte omfattar');
      await forvanta(page, '.adm-vb', 'Fragmin är en injektion under huden, som inte ingår');
      // Alvedon är utsatt tidigare i genomgången. Waran är en tablett utan fasta tider, som delegeringen omfattar.
      await gunnar.locator('.adm-vb', { hasText: 'Waran' }).locator('[data-adm="fri"]').click();
      const dl = page.locator('dialog[open]');
      await dl.waitFor();
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Waran är given');
      await forvanta(page, '.adm-vb', 'av Amira Haddad, med delegering från Johan Ek');
      await bild(page, '81-delegering-dos', true);
    });
    await allaVyer(page, 'Amira Haddad', MENY.underskoterska);

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
      await forvanta(page, '#min-um', 'Uppmärksamhetsinformation');
      await forvanta(page, '.oversikt-rutnat', 'Skadlig');
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

    // Runda 7, r6: distriktssköterskan ger MPR och får frågan om andra vaccinationer, som alla barn får.
    await s('Hanna Lilja ger Ida MPR och svarar på frågan om vaccinationer som har getts någon annanstans', async () => {
      await loggaIn(page, 'ssk-vc');
      await gaTill(page, '#/patient/p61/tillvaxt');
      await page.locator('[data-vaccin="mpr1"]').click();
      const dl = page.locator('dialog[open]');
      await dl.waitFor();
      await forvanta(page, 'dialog[open] legend', 'någon annanstans');
      if (await dl.locator('[data-dolda-vaccinationer]').count()) throw new Error('varningen om dolda vaccinationer visas utan att det finns några');
      await dl.locator('#dlg-andra-nej').check();
      await bild(page, '99-vaccination-fraga');
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'är registrerad');
    });
    // Runda 7, r6: vårdnadshavaren ser barnets tillväxt och skickar en mätning hemifrån.
    await s('Linnea Holmqvist ser Idas kurvor och vaccinationer i Min journal och skickar en mätning hemifrån', async () => {
      await loggaInPatient(page, 'inv-vh02');
      await page.click('.min-journaler a');
      await forvanta(page, '.min-band h1', 'Ida Holmqvist');
      await minFlik(page, 'Tillväxt');
      await forvanta(page, '.min-del', 'Vaccinationer');
      await page.locator('.min-del svg.tv-kurva').first().waitFor();
      await page.fill('#min-tv-vikt', '9,5');
      await page.click('#min-tv-form [type="submit"]');
      await forvanta(page, '.notis', 'Barnavårdscentralen bekräftar');
      await bild(page, '98-min-tillvaxt', true);
    });
    await s('Mikael Svensson ser sin tid och kallelsen under Tider i Min journal och bokar om den själv', async () => {
      await loggaInPatient(page, 'inv-p14');
      await minFlik(page, 'Tider');
      await forvanta(page, '.min-tider', 'Telefontid');
      // Runda 7, r3: patienten ser hela sitt högkostnadsskydd under Tider.
      await forvanta(page, '.min-hogkostnad', 'högkostnadsskyddet de senaste tolv månaderna');
      await page.locator('.min-tid details summary').first().click();
      await forvanta(page, '.min-tid .kallelse-text', 'Du har fått en tid');
      await page.locator('.min-tid [data-min="omboka"]').first().click();
      await page.locator('dialog[open] .forslag-knapp').first().click();
      await forvanta(page, '.notis', 'Din tid är ombokad till');
      await bild(page, '70-min-tider', true);
    });
    await s('Malin Engberg har skyddade personuppgifter och får kallelser bara i Min journal', async () => {
      await loggaInPatient(page, 'inv-p03');
      await minFlik(page, 'Tider');
      await forvanta(page, '.ruta-info', 'skyddade personuppgifter');
      await forvanta(page, '.min-tider', 'Vårdcentralen Tybble');
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
    // Runda 6, r1: säkerhetshändelser, export av loggen och stickprovskontroll.
    await s('Mats Wall ser säkerhetshändelserna med hel kedja och kan exportera loggen', async () => {
      await gaTill(page, '#/logg');
      await page.locator('.loggexport a[data-export="csv"]').waitFor();
      await page.click('.delflikar a:has-text("Säkerhetshändelser")');
      await vantaVy(page);
      await forvanta(page, '.logg-tabell', 'Inloggning med SITHS-kort (simulerat).');
      await forvanta(page, '.kedja-hel', 'Loggkedjan är hel');
      await bild(page, '93-sakerhetslogg', true);
    });
    await s('Mats Wall drar ett stickprov och markerar en åtkomst som befogad med ett klick', async () => {
      await page.click('.delflikar a:has-text("Stickprov")');
      await vantaVy(page);
      await page.click('[data-dra]');
      await forvanta(page, '.notis', 'åtkomster är draget');
      const kvar = await page.locator('[data-kvar]').textContent();
      await page.locator('[data-befogad]').first().click();
      await forvanta(page, '.notis', 'Åtkomsten är granskad');
      await forvanta(page, '.stickprov-rad.granskad', 'Befogad');
      if ((await page.locator('[data-kvar]').textContent()) === kvar) throw new Error('antalet som återstår ändrades inte');
      await bild(page, '94-stickprov', true);
    });
    await s('återställ demon ger nya patienter men behåller inloggningen', async () => {
      await page.click('[data-a="aterstall"]');
      await forvanta(page, '.notis', 'Demon är återställd');
      await forvanta(page, '.inloggad', 'Mats Wall');
    });

    // Utskrift och kontrasignering (Sussa 3.1.9 och 3.1.11.3).
    await s('Sara skriver ut läkemedelslistan, och utskriften har utskrifts-id och säger vad som saknas', async () => {
      await loggaIn(page, 'lak-kard');
      // Arbetslistan hämtas klart innan sidan byts.
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
      await gaTill(page, '#/patient/p04');
      await page.waitForSelector('.tidslinje');
      await page.click('.snabbval [data-utskrift]');
      await page.locator('dialog[open]').waitFor();
      await page.click('dialog[open] label:has-text("Kopia av journalen till patienten")');
      await bild(page, '70-utskrift-dialog');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Utskriften är registrerad med id U-');
      await forvanta(page, '.utskrift-utelamnat', 'spärrade uppgifter');
      if (await page.locator('.utskrift', { hasText: 'sertralin' }).count()) throw new Error('spärrade uppgifter kom med i utskriften');
      await bild(page, '71-utskrift', true);
      await page.click('.utskrift-ram [data-stang]');
      await page.click('.flikar a:has-text("Utskrifter")');
      await forvanta(page, 'main', 'Utlämnade journalhandlingar');
      await forvanta(page, '.tabell', 'Patienten');
    });
    await s('Sara kontrasignerar underläkarens anteckning från inkorgen', async () => {
      await gaTill(page, '#/inkorg');
      await page.click('#ik-ks ~ ul a');
      await forvanta(page, '.kontrasignering', 'Kontrasignering begärd');
      await bild(page, '72-kontrasignering');
      await page.click('.anteckning [data-kontrasignera]');
      await forvanta(page, '.kontrasignering', 'Kontrasignerad');
    });
    // Säkrare utsättning (runda 5): antikoagulantia sätts bara ut med en plan.
    await s('Sara sätter ut Waran med en plan, och planen syns i läkemedelslistan och i FHIR', async () => {
      await gaTill(page, '#/patient/p01/lakemedel');
      await page.locator('.lm-tabell tr', { hasText: 'Waran' }).filter({ has: page.locator('[data-utsatt]') }).locator('[data-utsatt]').click();
      const dl = page.locator('dialog[open]');
      await dl.waitFor();
      await forvanta(page, 'dialog[open] .varningslista', 'blodpropp och stroke');
      // Utan plan går det inte.
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, 'dialog[open] .dialog-fel', 'Välj planen');
      await dl.locator('[data-plan="uppehall"]').click();
      if (!(await dl.locator('textarea[name="orsak"]').inputValue()).startsWith('Uppehåll inför ingrepp')) throw new Error('orsaken fylldes inte i ur planen');
      await bild(page, '82-utsattning-plan');
      await dl.locator('[data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Waran är utsatt');
      await forvanta(page, '.ut-plan', 'Uppehåll inför ingrepp, återinsätts');
      const lista = await (await page.request.get(`${BAS}/api/patient/p01/lakemedel`)).json();
      const waran = lista.ordinationer.find(o => o.lakemedel?.namn === 'Waran' && o.status === 'utsatt');
      const fhir = await (await page.request.get(`${BAS}/fhir/MedicationRequest/${waran.id}`)).json();
      if (!fhir.extension.some(e => e.url.endsWith('/utsattningsplan') && e.valueCode === 'uppehall')) throw new Error('planen saknas i FHIR');
    });

    // Ingela Nord, arkivarie (Sussa 5.4.2 och 5.3.1.7)
    await s('Ingela Nord landar i E-arkiv och gallring och kan inte öppna journalen', async () => {
      await loggaIn(page, 'ark');
      await forvanta(page, 'main h1', 'E-arkiv och gallring');
      await page.goto(`${BAS}/#/patient/p01`);
      await page.waitForURL(/#\/arkiv$/);
      await vantaVy(page);
    });
    await allaVyer(page, 'Ingela Nord', MENY.arkiv);
    await s('Ingela Nord registrerar ett gallringsbeslut och systemet tar fram underlaget', async () => {
      await gaTill(page, '#/arkiv');
      await page.click('#ar-form label:has-text("Gallring")');
      await page.fill('#ar-dnr', 'DEMO-2026-0101');
      await page.click('#ar-form [type="submit"]');
      await forvanta(page, '.notis', 'Beslutet är registrerat');
      await page.click('[data-underlag]');
      await forvanta(page, '[data-underlag-ut]', 'Harald Strand');
      await bild(page, '73-gallring', true);
    });
    await s('Ingela Nord skapar ett exportpaket till e-arkiv för en patient', async () => {
      await page.click('#ar-form label:has-text("Leverans till e-arkiv")');
      await page.fill('#ar-dnr', 'DEMO-2026-0102');
      await page.fill('#ar-pnr', '19450202-4732');
      await page.press('#ar-pnr', 'Tab');
      await forvanta(page, '[data-patient-svar]', 'Gunnar Åkesson');
      await page.click('#ar-form [type="submit"]');
      await forvanta(page, '.notis', 'Beslutet är registrerat');
      const [nedladdning] = await Promise.all([page.waitForEvent('download'), page.click('[data-paket]')]);
      if (!/^IP_.*\.zip$/.test(nedladdning.suggestedFilename())) throw new Error(`filnamn ${nedladdning.suggestedFilename()}`);
      await forvanta(page, '.notis', 'Exportpaketet IP_');
      await forvanta(page, '.arkiv-lista', 'SHA-256');
      await bild(page, '74-arkiv-export', true);
    });

    // Daniel Sund, uppföljning (Sussa 6.3.1)
    await s('Daniel Sund ser datauttaget utan namn och personnummer', async () => {
      await loggaIn(page, 'uppf');
      await forvanta(page, 'main h1', 'Datauttag för uppföljning');
      await forvanta(page, '.tabell', 'Vardkontakt');
      await saknas(page, 'Åkesson');
      await bild(page, '75-datauttag', true);
    });
    await allaVyer(page, 'Daniel Sund', MENY.uppfoljning);
    // Runda 7, r5: rapportering till myndigheter och register. Läkarna rättar felen i inkorgen med systemets förslag,
    // och uppföljningsrollen granskar rapporten utan patientuppgifter.
    await s('Sara Lindqvist och Erik Nyström rättar fel i rapporten till patientregistret från inkorgen', async () => {
      await loggaIn(page, 'lak-kard');
      const ok = await page.evaluate(async () => (await fetch('/api/demo/rapportfel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).ok);
      if (!ok) throw new Error('Demoläget för rapportfel kunde inte skapas');
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-rapportfel', 'Att rätta före rapportering');
      await page.locator('#ik-rapportfel ~ ul li', { hasText: 'Huvuddiagnos saknas' }).first().locator('[data-rapportfel]').click();
      await forvanta(page, 'dialog[open]', 'Systemets förslag');
      await bild(page, '77-rapportfel-diagnos');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'är registrerad som huvuddiagnos');
      // Inkorgen ritas om efter rättningen. Den väntas in, så att utloggningen inte avbryter den.
      await page.waitForLoadState('networkidle');
      await loggaIn(page, 'lak-akut');
      await gaTill(page, '#/inkorg');
      await page.locator('#ik-rapportfel ~ ul li', { hasText: 'utan yttre orsak' }).first().locator('[data-rapportfel]').click();
      await forvanta(page, 'dialog[open]', 'Vad gjorde patienten?');
      await page.selectOption('dialog[open] #rf-mekanism', 'W01');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'W01.99');
      await page.waitForLoadState('networkidle');
    });
    await s('Daniel Sund granskar rapporten till patientregistret utan patientuppgifter och ser tjänstekontrakten', async () => {
      await loggaIn(page, 'uppf');
      await gaTill(page, '#/rapportering');
      await forvanta(page, '.rapport-kort', 'Patientregistret');
      await forvanta(page, '.rapport-kort', 'Medicinska födelseregistret');
      await page.click('[data-granska="par"]');
      await forvanta(page, '.rapport-detalj', 'Filerna');
      await forvanta(page, '.rapport-detalj', 'SV_AD_18_');
      await saknas(page, 'Åkesson');
      await saknas(page, '19450202');
      await bild(page, '78-rapportering', true);
      await gaTill(page, '#/api');
      await forvanta(page, '#tk', 'GetCareDocumentation');
      await forvanta(page, '#tk', 'Simulerad producent');
    });
    await s('Sara Lindqvist registrerar och ångrar patientens invändning mot kvalitetsregistret, och patienten anmäler den själv i Min journal', async () => {
      await loggaIn(page, 'lak-kard');
      await gaTill(page, '#/patient/p01/identitet');
      await page.click('[data-kr="motsatt"]');
      await forvanta(page, '.notis', 'Invändningen är registrerad');
      await forvanta(page, '.kr-invandning', 'Patienten har motsatt sig registrering');
      await page.click('[data-kr="aterkalla"]');
      await forvanta(page, '.notis', 'Invändningen är ångrad');
      await page.waitForLoadState('networkidle');
      await loggaInPatient(page, 'inv-p10');
      await gaTill(page, '#/min/p10/sparrar');
      await page.click('[data-kr="motsatt"]');
      await forvanta(page, '.kr-invandning', 'Du har motsatt sig registrering');
      await bild(page, '79-min-kvalitetsregister', true);
      await page.click('[data-kr="aterkalla"]');
      await forvanta(page, '.notis', 'Invändningen är ångrad');
      await page.waitForLoadState('networkidle');
    });
    // Runda 6, r3: kommunens part i samordnad planering (simulerad) ser bara det som regionen har skickat.
    await s('Lisa Ahlgren på kommunen ser inskrivningsmeddelandet men ingen journal', async () => {
      await loggaIn(page, 'kom-bist');
      await forvanta(page, 'main h1', 'Samverkan');
      await forvanta(page, '.r3-sam', 'Gunnar Åkesson');
      await forvanta(page, '.r3-sam', 'Beräknad utskrivning');
      await saknas(page, 'Hjärtsvikt');
      await bild(page, '76-samverkan', true);
    });
    await allaVyer(page, 'Lisa Ahlgren', MENY.kommun);
    await s('svarstiderna visar när datauttaget senast uppdaterades', async () => {
      await gaTill(page, '#/drift');
      await forvanta(page, '.faktarad', 'Datauttag för uppföljning');
    });

    // Runda 6, r2: läkemedelsprocessen, del 2 (Sussa 3.5.1 till 3.5.3).
    await s('Sara Lindqvist ordinerar ur en mall, ser dosering över flera dygn, filtrerar listan och startar en fördjupad genomgång', async () => {
      await loggaIn(page, 'lak-kard');
      await page.click('[data-a="aterstall"]');
      await forvanta(page, '.notis', 'Demon är återställd');
      await gaTill(page, '#/patient/p01/lakemedel');
      await forvanta(page, '#lm-dygn', 'Dosering över flera dygn');
      await forvanta(page, '.lms-dygn', 'Furosemid');
      await page.click('[data-mall]');
      await page.click('[data-paket="elkonvertering"]');
      await forvanta(page, '.lms-forslag', 'Tas inte med');
      await bild(page, '90-mall-elkonvertering');
      await page.click('[data-paket-ordinera]');
      await forvanta(page, '.notis', 'ur mallen Inför elkonvertering');
      await forvanta(page, '.lm-tabell', 'Mall: Inför elkonvertering');
      await page.click('[data-lmfilter="obs"]');
      await forvanta(page, '.lm-tabell', 'Särskild observation vid utsättning');
      await page.click('[data-lmfilter="alla"]');
      await page.click('[data-fg="starta"]');
      await forvanta(page, '.notis', 'fördjupade läkemedelsgenomgången är startad');
      await forvanta(page, '#lm-fordjupad ~ p, .lm-sektion', 'Väntar på farmaceutens bedömning');
      await bild(page, '91-lakemedel-del2');
    });
    await s('Sara Lindqvist ordinerar med nedtrappning, spädning och förpackning ur systemets förslag', async () => {
      await gaTill(page, '#/patient/p04/lakemedel');
      await page.click('[data-ny]');
      await page.fill('#lm-sok', 'prednisolon');
      await page.click('[data-lm]');
      await page.locator('.o-trappning').waitFor();
      await page.click('.o-trappning summary');
      await page.fill('#o-orsak', 'Polymyalgia reumatika');
      await page.click('[data-spara]');
      await forvanta(page, '.notis', 'Prednisolon Pfizer är ordinerat');
      await forvanta(page, '.lm-tabell', 'Nedtrappning, steg 1 av 8');
      await page.click('[data-ny]');
      await page.fill('#lm-sok', 'bensylpenicillin');
      await page.click('[data-lm]');
      await page.locator('.o-spadning').waitFor();
      await page.fill('#o-orsak', 'Erysipelas');
      await page.click('[data-spara]');
      await forvanta(page, '.notis', 'Bensylpenicillin Noridem är ordinerat');
      await forvanta(page, '.lm-tabell', 'Koncentration 30 mg/ml');
      await forvanta(page, '.lm-tabell', 'NPL-pack-id');
    });
    await s('Sara Lindqvist ser direktiven och uppföljningen på vårdenhetens nivå, och uppföljningen som har passerat i inkorgen', async () => {
      await gaTill(page, '#/lakemedelsstod');
      await forvanta(page, 'main h1', 'Direktiv och uppföljning');
      await forvanta(page, '.tabell', 'Feber eller lätt till måttlig smärta');
      await forvanta(page, '#lms-upp', 'Uppföljning på vårdenhetens nivå');
      await bild(page, '92-direktiv-och-uppfoljning');
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-uppf ~ ul', 'Melatonin Bluefish');
      await forvanta(page, '#ik-lic ~ ul', 'Tiamin injektionsvätska, licens');
    });
    await s('Johan Ek ser direktiven prövade mot patienten, dokumenterar en muntlig ordination och registrerar en dos i efterhand', async () => {
      await loggaIn(page, 'ssk-kard');
      // Arbetslistan hämtas klart innan sidan byts.
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
      await gaTill(page, '#/patient/p01/lakemedel');
      await forvanta(page, '#lm-dir ~ ul', 'Direktivet gäller inte från 75 år');
      await page.click('[data-muntlig]');
      await forvanta(page, '#ord-rubrik', 'Muntlig ordination');
      // Losartan, som Gunnar inte har. Omeprazol har Sara ordinerat tidigare i genomgången.
      await page.fill('#lm-sok', 'losartan');
      await page.click('[data-lm]');
      await page.fill('#o-dosering', '1 tablett nu');
      await page.fill('#o-orsak', 'Högt blodtryck');
      await page.fill('#m-omed', 'Blodtrycket behöver sänkas nu');
      await page.click('[data-spara]');
      await forvanta(page, '.notis', 'Den muntliga ordinationen av Losartan Krka är dokumenterad');
      await forvanta(page, '.lm-tabell', 'Muntlig, väntar på signering av Sara Lindqvist');
      await gaTill(page, '#/administrering');
      const alvedon = page.locator('.adm-patient', { hasText: 'Gunnar Åkesson' }).locator('.adm-vb', { hasText: 'Alvedon' });
      await alvedon.locator('.adm-mer summary').click();
      await alvedon.locator('[data-adm="efterhand"]').click();
      await page.locator('dialog[open] [data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Alvedon är registrerad som given');
      await bild(page, '93-dos-i-efterhand');
    });
    await s('Sara Lindqvist signerar den muntliga ordinationen i inkorgen', async () => {
      await loggaIn(page, 'lak-kard');
      // Arbetslistan hämtas klart innan sidan byts.
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-muntlig ~ ul', 'Losartan Krka');
      await page.locator('[data-signera]').first().click();
      await forvanta(page, '.notis', 'muntliga ordinationen av Losartan Krka är signerad');
      await forvanta(page, '#ik-muntlig ~ .tom', 'Inga muntliga ordinationer väntar');
    });

    // Elsa Nordin, farmaceut (runda 6, r2)
    await s('Elsa Nordin ser den fördjupade genomgången i inkorgen och gör farmaceutens bedömning', async () => {
      await loggaIn(page, 'far-kard');
      // Arbetslistan hämtas klart innan sidan byts.
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-fordj ~ ul', 'Väntar på farmaceutens bedömning');
      await gaTill(page, '#/patient/p01/lakemedel');
      await page.click('[data-fg="farmaceut"]');
      await page.locator('dialog[open] .lms-underlag').waitFor();
      await bild(page, '94-farmaceut');
      await page.locator('dialog[open] [data-varde="ok"]').click();
      await forvanta(page, '.notis', 'Steget är sparat');
      await forvanta(page, '.lm-sektion', 'Väntar på läkarens beslut');
      // Fliken har ritats om efter sparandet. Vänta tills alla anrop är klara innan sidan byts.
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await gaTill(page, '#/patient/p01');
      await saknas(page, 'Daganteckning');
    });
    await allaVyer(page, 'Elsa Nordin', MENY.farmaceut);

    // Ulrika Sandell, verksamhetschef (runda 6, r6)
    await s('Ulrika Sandell ser påminnelserna och utser en medicinskt ansvarig läkare med systemets förslag', async () => {
      await loggaIn(page, 'vch-kard');
      await forvanta(page, 'main h1', 'Läkemedelsansvar');
      await forvanta(page, '#la-pam ~ ul', 'Medicinskt ansvarig läkare saknas på Kardiologiska kliniken USÖ');
      await forvanta(page, '#la-pam ~ ul', 'Ansvarsdokumentet för läkemedelshanteringen har inte setts över');
      await forvanta(page, '.ruta-info', 'kan inte överlåtas');
      await saknas(page, 'Gunnar');
      await bild(page, '96-lakemedelsansvar', true);
      await page.click('[data-paminnelse="0"]');
      await page.locator('dialog[open] #la-person').waitFor();
      await forvanta(page, 'dialog[open]', 'Göran Malm hade uppdraget till');
      await bild(page, '97-utse-mal');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Göran Malm är utsedd till medicinskt ansvarig läkare');
      await forvanta(page, '#la-medicinskt_ansvarig', 'Göran Malm');
      await saknas(page, 'Ansvarsdokumentet för läkemedelshanteringen har inte setts över');
      await page.waitForLoadState('networkidle');
    });
    await allaVyer(page, 'Ulrika Sandell', MENY.verksamhetschef);
    // Fredrik Alm, ekonom (runda 7, r3)
    await s('Fredrik Alm hämtar förra månadens faktureringsunderlag som CSV med ett klick, och exporten syns i listan', async () => {
      await loggaIn(page, 'eko');
      await forvanta(page, 'main h1', 'Faktureringsunderlag');
      await forvanta(page, '#ek', 'Förra månaden är förvald');
      await forvanta(page, '#ek tbody', 'Kardiologiska kliniken USÖ');
      await saknas(page, 'Gunnar');
      await saknas(page, 'Åkesson');
      await page.waitForSelector('#ek-exporter ul, #ek-exporter .tom:not(:has-text("Hämtar"))');
      await bild(page, '99-faktureringsunderlag', true);
      const rad = page.locator('#ek tbody tr', { has: page.locator('[data-export="csv"]') }).first();
      const [fil] = await Promise.all([page.waitForEvent('download'), rad.locator('[data-export="csv"]').click()]);
      if (!/^faktureringsunderlag-[\w-]+-\d{4}-\d{2}\.csv$/.test(fil.suggestedFilename())) throw new Error(`filen heter ${fil.suggestedFilename()}`);
      await forvanta(page, '.notis', 'är exporterat');
      await forvanta(page, '#ek-exporter', 'CSV');
      // Den pågående månaden visar reservnumret som väntar, utan att säga vem.
      await page.selectOption('#ek-period', { index: 0 });
      await forvanta(page, '#ek', 'reservnummer');
      await saknas(page, 'Holmgren');
    });
    await s('Fredrik Alm ändrar ett pris i prislistan från nästa månad, och historiken visar den nya versionen', async () => {
      await gaTill(page, '#/prislistor');
      await forvanta(page, 'main h1', 'Prislistor');
      await forvanta(page, '.faktarad', 'Gäller i dag');
      await forvanta(page, '.pl-historik', 'Nya demopriser för vårddygn och besök');
      await page.click('[data-andra="vardkontakt"][data-kod="telefon"]');
      await page.locator('dialog[open] #pl-pris').waitFor();
      await page.fill('dialog[open] #pl-pris', '475');
      await page.fill('dialog[open] #pl-orsak', 'Nytt demopris för telefonkontakt');
      await bild(page, '100-andra-pris');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Telefonkontakt kostar 475 kr från');
      await forvanta(page, '.pl-historik', 'Nytt demopris för telefonkontakt');
      await forvanta(page, '.faktarad', 'Kommande');
      await page.waitForLoadState('networkidle');
    });
    await allaVyer(page, 'Fredrik Alm', MENY.ekonom);

    // Tomas Lindh, systemförvaltare (runda 7, r4)
    await s('Tomas Lindh godkänner kollegans ändring av en regel och ser att den gäller', async () => {
      await loggaIn(page, 'sysf');
      await forvanta(page, 'main h1', 'Regler och parametrar');
      await forvanta(page, '#sf-att-godkanna ~ ul', 'Larm när mottagningskvittensen dröjer');
      await forvanta(page, '#sf-att-godkanna ~ ul', 'Föreslagen av Nora Ekholm');
      await forvanta(page, '#sf-lasta ~ ul', 'Åtkomstloggen och säkerhetsloggen');
      await saknas(page, 'Gunnar');
      await bild(page, '99-regler', true);
      await page.click('#sf-att-godkanna ~ ul [data-godkann]');
      await forvanta(page, '.notis', 'Ändringen är godkänd');
      await forvanta(page, 'tr[data-nyckel="remiss.mottagningskvittens_timmar"]', '4 timmar');
      await forvanta(page, '#sf-historik ~ .tabellrulle', 'Nora Ekholm');
      await page.click('tr[data-nyckel="arkiv.gallring_ar"] [data-andra]');
      await page.locator('dialog[open] #sf-varde').fill('8');
      await forvanta(page, 'dialog[open] [data-forhand]', 'patientdatalagen 3 kap. 17 §');
      await bild(page, '100-regel-rimlighet');
      await page.click('dialog[open] [data-varde="avbryt"]');
      await page.waitForLoadState('networkidle');
    });
    await s('Tomas Lindh förbereder en sammanslagning och ser vad som påverkas, bara med antal', async () => {
      await gaTill(page, '#/omorganisation');
      await page.click('tr[data-enhet="uso-kard"] [data-forandra]');
      await page.locator('dialog[open] #sf-typ').selectOption('sammanslagning');
      await page.locator('dialog[open] input[name="gamla"][value="uso-med"]').check();
      await page.locator('dialog[open] #sf-namn').fill('Hjärt- och medicinkliniken USÖ');
      await forvanta(page, 'dialog[open] [data-forhand]', 'Pågående vårdkontakter: 4.');
      await forvanta(page, 'dialog[open] [data-forhand]', 'kodas inte om');
      await saknas(page, 'Gunnar');
      await bild(page, '101-omorganisation');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Förändringen är förberedd till');
      await forvanta(page, '#sf-forberedda ~ ul', 'slås samman till Hjärt- och medicinkliniken USÖ');
      // Sammanslagningen ändrar vem som har åtkomst och väntar på en annan systemförvaltares godkännande (fyra ögon).
      await forvanta(page, '#sf-forberedda ~ ul', 'väntar på att en annan systemförvaltare godkänner den');
      await page.waitForLoadState('networkidle');
    });
    await s('Tomas Lindh föreslår ett undantag, och systemet stoppar ett som skulle dölja pågående vård', async () => {
      await gaTill(page, '#/undantag');
      await forvanta(page, '#sf-u-regler ~ ul', 'gäller aldrig Min journal');
      await page.click('[data-nytt-undantag]');
      await page.locator('dialog[open] #sf-u-omfang').selectOption('enhet');
      await page.locator('dialog[open] #sf-u-varde').selectOption('uso-kard');
      await page.locator('dialog[open] input[name="kanaler"][value="visning"]').check();
      await forvanta(page, 'dialog[open] [data-forhand]', 'kan inte döljas');
      await page.locator('dialog[open] input[name="kanaler"][value="visning"]').uncheck();
      await page.locator('dialog[open] #sf-u-motivering').fill('Kliniken deltar i en studie med egen rapportering.');
      await forvanta(page, 'dialog[open] [data-forhand]', 'publiceras inte till nationella tjänster');
      await bild(page, '102-undantag');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'väntar på att en annan systemförvaltare godkänner det');
      await page.waitForLoadState('networkidle');
    });
    await s('Tomas Lindh provar säkerhetskopian och ser uppgifterna per huvudman', async () => {
      await gaTill(page, '#/lagring');
      await forvanta(page, '#sf-l-huvudman ~ .tabellrulle', 'Region Örebro län');
      await page.click('[data-prova]');
      await forvanta(page, '.notis', 'Säkerhetskopian lästes tillbaka och allt stämmer');
      await forvanta(page, '[data-provresultat]', 'Triggrarna stoppar ändring och radering av loggen i kopian');
      await bild(page, '103-lagring');
      // Uttag som fil: ett beslut med diarienummer och skäl, som en annan systemförvaltare godkänner (fyra ögon).
      await page.click('[data-nytt-uttag]');
      await page.locator('dialog[open] #sf-ut-dnr').fill('RS 2026-1234');
      await page.locator('dialog[open] #sf-ut-mot').fill('Regionen byter journalsystem och tar med sig sina uppgifter.');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'väntar på att en annan systemförvaltare godkänner det');
      await forvanta(page, '#sf-l-uttag ~ ul', 'beslut RS 2026-1234');
      await forvanta(page, '#sf-l-uttag ~ ul', 'Väntar på att en annan systemförvaltare godkänner beslutet');
      await page.waitForLoadState('networkidle');
    });
    await allaVyer(page, 'Tomas Lindh', MENY.systemforvaltare);
    // Fyra ögon på riktigt: Nora Ekholm loggar in i samma sandlåda och godkänner sammanslagningen som Tomas Lindh förberedde.
    await s('Nora Ekholm godkänner sammanslagningen som Tomas Lindh förberedde, men inte sina egna förslag', async () => {
      await loggaIn(page, 'sysf-2');
      await gaTill(page, '#/omorganisation');
      const rad = page.locator('#sf-forberedda ~ ul li', { hasText: 'slås samman till Hjärt- och medicinkliniken USÖ' });
      await rad.waitFor();
      await forvanta(page, '#sf-forberedda ~ ul', 'Förberedd av Tomas Lindh');
      await bild(page, '104-godkanna-omorganisation');
      await rad.locator('[data-godkann-omorg]').click();
      await forvanta(page, '.notis', 'Förändringen är godkänd');
      await forvanta(page, '#sf-forberedda ~ ul', 'Godkänd av Nora Ekholm');
      // Beslutet om uttag som Tomas Lindh registrerade godkänns också av henne, och filen går sedan att hämta.
      await gaTill(page, '#/lagring');
      await page.locator('#sf-l-uttag ~ ul [data-godkann-uttag]').first().click();
      await forvanta(page, '.notis', 'Uttaget är godkänt');
      await forvanta(page, '#sf-l-uttag ~ ul', 'Godkänt av Nora Ekholm');
      await page.locator('#sf-l-uttag ~ ul [data-hamta-uttag]').first().waitFor();
      // Det hon själv föreslår väntar på någon annan: ingen knapp för att godkänna det.
      await gaTill(page, '#/regler');
      await page.click('tr[data-nyckel="logg.stickprov_antal"] [data-andra]');
      await page.locator('dialog[open] #sf-varde').fill('15');
      await page.locator('dialog[open] #sf-motivering').fill('Fler åtkomster i varje stickprov.');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '#sf-mina ~ ul', '15 åtkomster');
      if (await page.locator('#sf-mina ~ ul [data-godkann]').count()) throw new Error('den egna ändringen gick att godkänna');
      await page.waitForLoadState('networkidle');
    });
    await allaVyer(page, 'Nora Ekholm', MENY.systemforvaltare);
    // Runda 7, r1: fysioterapeuten och Sussas testfall. Testdatan läggs in i demoläget, och fysioterapeuten besvarar
    // en remiss som paramedicinare.
    await s('Jenny Holmberg lägger in Sussas testdata och besvarar remissen för Sara Sandmark som paramedicinare', async () => {
      await loggaIn(page, 'fys-kard');
      await forvanta(page, '.inloggad', 'Jenny Holmberg');
      await gaTill(page, '#/sussatest');
      await forvanta(page, '.st-info', 'Underlag för riktiga användartester senare');
      await page.click('[data-st="testdata"]');
      await forvanta(page, '.notis', 'Sussas testpatienter är inlagda');
      await gaTill(page, '#/arbetslista');
      await page.locator('a.patientlank', { hasText: 'Sara Sandmark' }).first().click();
      await page.waitForSelector('.tidslinje');
      await page.click('.flikar a:text-is("Remisser")');
      await page.locator('[data-remiss-atgard="svara"]').first().click();
      await page.locator('dialog[open] textarea').fill('Tack för remissen. Vi har träffat Sara och gett henne rätt behandling.');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Svaret är skickat till remittenten');
      await page.waitForLoadState('networkidle');
    });
    await allaVyer(page, 'Jenny Holmberg', MENY.fysioterapeut);
    await s('Per Holm granskar sina 30 utkast och signerar alla med ett klick', async () => {
      await loggaIn(page, 'lak-vc');
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
      await page.evaluate(async () => { await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()); await fetch('/api/demo/sussa-testfall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()); });
      await page.goto('about:blank');
      await gaTill(page, '#/inkorg');
      await page.click('[data-signera-alla]');
      await forvanta(page, 'dialog[open] .ik-granska', 'Henrik Lundin');
      await bild(page, '111-signera-alla');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', '30 anteckningar är signerade');
      await forvanta(page, '#ik-osign ~ .tom', 'Inga osignerade anteckningar');
      await page.waitForLoadState('networkidle');
    });
    // Runda 7, r1: testledaren skapar ett testtillfälle med en kod som visas en gång, testpersonen svarar med koden och
    // testledaren läser och exporterar bara det tillfället med samma kod.
    let testkod = null;
    await s('Daniel Sund är testledare och skapar ett testtillfälle med en kod som visas en gång', async () => {
      await loggaIn(page, 'uppf');
      await page.click('#meny-lista a[href="#/sussatest"]');
      await vantaVy(page);
      await forvanta(page, '#st-tillfallen ~ p', 'Koden visas bara en gång');
      await page.click('[data-st="skapa"]');
      testkod = (await (await forvanta(page, '[data-st-kod]', '')).textContent()).trim();
      if (!/^[A-Za-z0-9_-]{32,}$/.test(testkod)) throw new Error(`koden har fel form: ${testkod}`);
      await forvanta(page, '#st-serverlista', 'Inga svar i tillfället än');
    });
    await s('formuläret för Sussas testfall räknar SUS och expertgranskningen och sparar med koden utan patientuppgifter', async () => {
      await loggaIn(page, 'lak-vc');
      await gaTill(page, '#/sussatest');
      await page.evaluate(() => localStorage.removeItem('vk_sussatest'));
      await gaTill(page, '#/moduler');
      await gaTill(page, '#/sussatest');
      await forvanta(page, '.st-sparas', 'raderas 90 dagar efter det senaste svaret');
      await page.fill('#st-tkod', testkod);
      await page.fill('#st-kod', '19450207');
      for (let i = 1; i <= 10; i++) await page.locator(`#st-sus label.sus-val:has(input[name="sus${i}"][value="${i % 2 ? 4 : 2}"])`).click();
      await forvanta(page, '[data-st-sus]', '75 av 100, 2 utvärderingspoäng');
      await page.click('#st-sus [type="submit"]');
      await forvanta(page, '#st-sus .form-fel', 'Sex siffror i rad tas inte emot');
      await page.fill('#st-kod', 'L03');
      await page.click('#st-sus [type="submit"]');
      await forvanta(page, '.notis', 'SUS-svaret för L03 är sparat: 75 av 100');
      await forvanta(page, '.notis', 'Svaret för L03 är sparat på servern');
      await page.fill('#st-granskare', 'E01');
      for (let i = 1; i <= 7; i++) await page.locator(`label[for="st-p${i}-${i < 7 ? 10 : 5}"]`).click();
      await forvanta(page, '[data-st-expert]', '65 av 70, 10 utvärderingspoäng');
      await page.click('#st-expert [type="submit"]');
      await forvanta(page, '.notis', 'Granskningen är sparad: 65 av 70');
      await forvanta(page, '#st-lista', 'Medelvärde SUS 75 av 100');
      const lagrat = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
      if (/Sandmark|Danielsson|19450207/.test(lagrat) || lagrat.includes(testkod)) throw new Error('webbläsaren har sparat patientuppgifter eller koden');
      await bild(page, '112-sussatest', true);
      await page.evaluate(() => localStorage.removeItem('vk_sussatest'));
    });
    await s('Daniel Sund läser och exporterar svaren i sitt tillfälle med koden och raderar tillfället', async () => {
      await loggaIn(page, 'uppf');
      await page.click('#meny-lista a[href="#/sussatest"]');
      await vantaVy(page);
      if (await page.locator('[data-st-kod]').count()) throw new Error('koden visas igen');
      await page.fill('#st-lkod', testkod);
      await page.click('#st-oppna [type="submit"]');
      await forvanta(page, '#st-serverlista', 'L03');
      await forvanta(page, '#st-serverlista', 'Användbarhetsexpert');
      const csv = await page.evaluate(async (kod) => (await fetch('/api/anvandartest/svar/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod, format: 'csv' }) })).text(), testkod);
      if (!csv.startsWith('id;typ;roll;pseudonym;datum;testfall') || !csv.includes('L03') || /Sandmark|Danielsson|19450207/.test(csv)) throw new Error('exporten är fel');
      await bild(page, '113-anvandartester-server');
      await page.click('[data-st="radera-tillfalle"]');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Testtillfället är raderat med 2 svar');
    });
    await s('Sara granskar den ändrade mallen i inkorgen och godkänner den', async () => {
      await loggaIn(page, 'lak-kard');
      await page.waitForFunction(() => document.querySelector('#lista') && !/Hämtar/.test(document.querySelector('#lista').textContent));
      await gaTill(page, '#/inkorg');
      await forvanta(page, '#ik-mallar ~ ul', 'Inför elkonvertering, version 2');
      await page.click('#ik-mallar ~ ul [data-granska="0"]');
      await forvanta(page, 'dialog[open]', 'tiden före vårdhändelsen ändras från 1 timme till 2 timmar');
      await bild(page, '98-godkanna-mall');
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'Mallen Inför elkonvertering är godkänd i version 2');
      // Inkorgen ritas om efter godkännandet, och då finns inget kvar att godkänna.
      await page.locator('#ik-mallar').waitFor({ state: 'detached', timeout: 8000 }).catch(() => { throw new Error('mallen står kvar i inkorgen efter godkännandet'); });
      await page.waitForLoadState('networkidle');
    });
    // Runda 7, r3: kostnaderna i vårdprocessen och medicinskt färdigbehandlad.
    await s('Sara ser kostnaderna hittills för Gunnars vårdtillfälle med DRG och högkostnadsskyddet, och registrerar Elin som medicinskt färdigbehandlad', async () => {
      await gaTill(page, '#/patient/p01');
      await forvanta(page, '.ov-kostnader', 'Kostnader i vårdprocessen');
      await forvanta(page, '.ov-kostnader', 'Vårddygn');
      await forvanta(page, '.ov-kostnader', 'Enligt DRG, demogrupp');
      await forvanta(page, '.ov-kostnader', 'högkostnadsskyddet');
      await forvanta(page, '.ov-kostnader', 'samordnad planering vid utskrivning');
      await page.locator('.ov-kostnader').scrollIntoViewIfNeeded();
      await bild(page, '101-kostnader');
      await gaTill(page, '#/patient/p04');
      await page.click('.ov-kostnader [data-ek="fardigbehandlad"]');
      await page.locator('dialog[open] #ek-fb-datum').waitFor();
      await page.click('dialog[open] [data-varde="ok"]');
      await forvanta(page, '.notis', 'registrerad som medicinskt färdigbehandlad');
      await forvanta(page, '.ov-kostnader', 'Medicinskt färdigbehandlad');
      await page.waitForLoadState('networkidle');
    });
    await s('Sara lämnar ut en rollator från kostnadsrutan, och den syns som hjälpmedel i kostnaden', async () => {
      await gaTill(page, '#/patient/p01');
      await forvanta(page, '.ov-kostnader', 'Beloppet gäller de besök du kan se');
      await page.click('.ov-kostnader [data-ek="hjalpmedel"]');
      await page.locator('dialog[open] [data-varde="HM-ROLLATOR"]').waitFor();
      await bild(page, '102-hjalpmedel');
      await page.click('dialog[open] [data-varde="HM-ROLLATOR"]');
      await forvanta(page, '.notis', 'Rollator är registrerat som utlämnat');
      await forvanta(page, '.ov-kostnader', 'Hjälpmedel');
      await page.waitForLoadState('networkidle');
    });
    await s('Karin Berg ser bara avgifter och högkostnadsskydd i kostnadsrutan, inga läkemedel eller DRG', async () => {
      await loggaIn(page, 'adm-kard');
      await gaTill(page, '#/patient/p01');
      await forvanta(page, '.ov-kostnader', 'Avgifter och högkostnadsskydd');
      const t = await page.locator('.ov-kostnader').textContent();
      for (const x of ['DRG', 'Furosemid', 'Läkemedel', 'Vårddygn']) if (t.includes(x)) throw new Error(`kostnadsrutan för vårdadministratören visar ${x}`);
    });

    // Användartestet (D6). Hela testet med enkät och resultatfil testas i test/anvandartest.cjs.
    await s('användartestet startas från inloggningssidan och visar en uppgift i taget i listen', async () => {
      await page.click('[data-a="loggaut"]');
      await page.waitForSelector('[data-roll]');
      await page.click('a[href="#/anvandartest"]');
      await forvanta(page, 'main h1', 'Användartest');
      await forvanta(page, '.at-info', 'Alla patienter i demon är påhittade');
      await page.fill('#at-kod', 'G01');
      for (const id of ['oppna-patient', 'las-anteckning', 'daganteckning', 'ordinera', 'utsattning', 'uppmarksamhet', 'kvittera-svar', 'nodatkomst', 'reservnummer', 'sla-samman', 'halsoarende', 'inskrivning', 'flytta', 'utskrivning', 'registrera-besok', 'planera-video', 'utskrift', 'begar-kontrasignering', 'kontrasignera', 'ge-dos', 'vidimera', 'utsattning-varning', 'boka-remiss', 'checka-in', 'gruppkallelse', 'omboka', 'aterbesok', 'utsattning-plan', 'ge-dos-delegering', 'registrera-delegering', 'aterinsattning', 'avsluta-aterinsattning', 'avvisa-remiss-satt-ut', 'vardplan', 'intagningsbeslut', 'sok-journal', 'news2', 'ordinera-mall', 'dos-efterhand', 'utse-mal', 'godkanna-mall', 'extern-tillampning', 'boka-ingrepp', 'boka-kedja', 'kravviktning', 'exportera-underlag', 'lamna-ut-hjalpmedel', 'forbered-namnbyte', 'andra-demoregel', 'rapport-par', 'tillvaxt-bhv', 'nyheter', 'boka-fri', 'boka-team', 'grupp-lagg-till', 'avdelningens-handelser', 'forlang-inloggning']) await page.uncheck(`input[name="uppgift"][value="${id}"]`);
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
    // Ett fel utanför ett steg (till exempel en meny som inte stämmer) får aldrig försvinna tyst: det räknas som fel.
    if (!fel.some(f => e.message.includes(f) || f.includes(e.message.split('\n')[0]))) fel.push(`utanför ett steg efter "${aktuelltSteg}": ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(UT, '00-fel.png'), fullPage: true }).catch(() => {});
  }

  // Mobilbredd 360 px: ingen sidledsrullning.
  const MOBILKONTEXT = { viewport: { width: 360, height: 760 }, locale: 'sv-SE', timezoneId: 'Europe/Stockholm', deviceScaleFactor: 2 };
  let mobil = await browser.newContext(MOBILKONTEXT);
  let mp = await mobil.newPage();
  bevaka(mp, 'mobil');
  // Runda 5 (r3): en ny session för varje roll, så att inga anrop från förra rollens vy kommer efter utloggningen.
  const nyMobilSession = async () => { await mobil.close(); mobil = await browser.newContext(MOBILKONTEXT); mp = await mobil.newPage(); bevaka(mp, 'mobil'); };
  // Runda 5 (r3): varje vy på 360 px kontrolleras både för sidledsrullning och för knappar som går att trycka på med
  // fingret, minst 40 px höga.
  const ingenSidledsrullning = async (vy) => {
    const b = await mp.evaluate(() => document.documentElement.scrollWidth);
    if (b > 360) throw new Error(`${vy}: sidan är ${b} px bred`);
    const sma = await mp.evaluate(() => [...document.querySelectorAll('button:not(.knapp-lank), a.knapp, input[type="submit"], input[type="button"], .segment label, [role="tab"]')]
      .map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ e, r }) => r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sr, [hidden]') && r.height < 39.5)
      .map(({ e, r }) => `"${(e.textContent.trim() || e.getAttribute('aria-label') || e.tagName).replace(/\s+/g, ' ').slice(0, 30)}" ${Math.round(r.height)} px`));
    if (sma.length) throw new Error(`${vy}: knappar lägre än 40 px: ${[...new Set(sma)].slice(0, 10).join(', ')}${sma.length > 10 ? ` och ${sma.length - 10} till` : ''}`);
  };
  const vantaHamtat = (p) => p.waitForFunction(() => ![...document.querySelectorAll('main .tom, main .laddar')].some(e => /^Hämtar/.test(e.textContent)), null, { timeout: 8000 }).catch(() => {});
  const MOBILROLLER = [['lak-kard', 'Sara Lindqvist'], ['ssk-kard', 'Johan Ek'], ['usk-kard', 'Amira Haddad'], ['lak-akut', 'Erik Nyström'], ['lak-vc', 'Per Holm'],
    ['lak-psyk', 'Lena Ström'], ['adm-kard', 'Karin Berg'], ['logg', 'Mats Wall'], ['ark', 'Ingela Nord'], ['uppf', 'Daniel Sund'], ['kom-bist', 'Lisa Ahlgren'], ['far-kard', 'Elsa Nordin'], ['vch-kard', 'Ulrika Sandell'], ['eko', 'Fredrik Alm'], ['sysf', 'Tomas Lindh'], ['sysf-2', 'Nora Ekholm'],
    // Runda 7, r1.
    ['fys-kard', 'Jenny Holmberg']];
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
        await mp.goto(`${BAS}/#/krav`); await mp.waitForSelector('#sf-antal:has-text("Visar 389")');
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
      // Runda 5 (r3): varje vy i menyn för varje demoroll, journalens alla flikar och incheckningsskärmen på 360 px.
      for (const [id, namn] of MOBILROLLER) {
        await s(`mobil: alla vyer i menyn för ${namn} på 360 px`, async () => {
          await nyMobilSession();
          await loggaIn(mp, id);
          const lankar = await mp.locator('#meny-lista a').evaluateAll(a => a.map(x => [x.getAttribute('href'), x.querySelector('.menytext').textContent]));
          if (!lankar.length) throw new Error(`${namn} har ingen meny`);
          for (const [href, text] of lankar) {
            await mp.goto(`${BAS}/${href}`); await vantaVy(mp); await vantaHamtat(mp);
            await ingenSidledsrullning(`${namn}, ${text}`);
          }
          await mp.click('[data-a="meny"]');
          await mp.waitForSelector('#meny.oppen');
          await ingenSidledsrullning(`${namn}, menyn`);
        });
      }
      await s('mobil: journalens alla flikar på 360 px', async () => {
        await nyMobilSession();
        await loggaIn(mp, 'lak-kard');
        await mp.goto(`${BAS}/#/patient/p01`); await mp.waitForSelector('.tidslinje');
        const flikar = await mp.locator('.flikar a').evaluateAll(a => a.map(x => [x.getAttribute('href'), x.textContent.trim()]));
        if (flikar.length < 5) throw new Error(`journalen har bara ${flikar.length} flikar`);
        for (const [href, text] of flikar) {
          await mp.goto(`${BAS}/${href}`); await vantaVy(mp); await vantaHamtat(mp);
          await ingenSidledsrullning(`journalen, ${text}`);
        }
        // Runda 6, r1: sökträffarna i journalen.
        await mp.goto(`${BAS}/#/patient/p01/sok?q=blodtryck`); await vantaVy(mp); await vantaHamtat(mp);
        await ingenSidledsrullning('journalen, sökträffar');
        await bild(mp, '80-mobil-journal-flik');
      });
      await s('mobil: läkemedel att ge, dagens arbete, tidbok och incheckningsskärmen på 360 px', async () => {
        await nyMobilSession();
        await loggaIn(mp, 'ssk-kard');
        await mp.goto(`${BAS}/#/administrering`); await vantaVy(mp); await vantaHamtat(mp);
        await ingenSidledsrullning('Läkemedel att ge');
        await bild(mp, '81-mobil-lakemedel-att-ge');
        await nyMobilSession();
        await loggaIn(mp, 'adm-kard');
        for (const [h, namn] of [['#/idag', 'Dagens arbete'], ['#/tidbok', 'Tidbok'], ['#/vantelista', 'Väntelista'], ['#/incheckning', 'Incheckningsskärmen']]) {
          await mp.goto(`${BAS}/${h}`); await vantaVy(mp); await vantaHamtat(mp);
          await ingenSidledsrullning(namn);
          if (h === '#/tidbok') await bild(mp, '82-mobil-tidbok');
          if (h === '#/incheckning') await bild(mp, '83-mobil-incheckning');
        }
      });
    }
  } catch (e) {
    if (!fel.some(f => e.message.includes(f) || f.includes(e.message.split('\n')[0]))) fel.push(`mobil, utanför ett steg efter "${aktuelltSteg}": ${e.message.split('\n')[0]}`);
    await mp.screenshot({ path: join(UT, '00-fel-mobil.png'), fullPage: true }).catch(() => {});
  }

  await browser.close();
  console.log('');
  console.log(`Väntade nekade anrop (403 och 404) i konsolen: ${vantade403.length} (${[...new Set(vantade403)].join('; ')})`);
  if (fel.length) {
    console.log(`\nGenomgången misslyckades: ${steg} steg, ${fel.length} fel`);
    for (const f of fel) console.log(`  ${f}`);
    process.exit(1);
  }
  console.log(`Genomgången klar: ${steg} steg, 0 fel, 10 roller och 5 patienter i Min journal. Skärmbilder i ${UT}`);
})().catch(e => { console.error(e); process.exit(1); });
