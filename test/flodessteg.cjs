// Flödena i klickbudgeten (D6), gemensamma för test/klickbudget.cjs och test/anvandartest.cjs. Varje flöde görs från
// sin startpunkt med riktiga interaktioner (musklick, tangenttryck och inskriven text), och Matare räknar stegen enligt
// reglerna i app/src/klickbudget.js.

// Räknar steg i ett flöde.
class Matare {
  constructor(page) { this.page = page; this.nollstall(); }
  nollstall() { this.klick = 0; this.faltbyten = 0; this.tangenter = 0; this.listval = 0; this.implicita = 0; this.steg = []; }
  async borja() { this.nollstall(); await this.page.evaluate(() => { window.__klick = 0; window.__tangent = 0; }); }
  // Ett musklick på ett element.
  async klicka(loc, text) {
    await loc.waitFor({ state: 'visible' });
    await loc.click();
    this.klick++;
    this.steg.push(`klick: ${text}`);
  }
  // En rullgardinslista: två klick (öppna och välja), eller inget om rätt värde redan är förvalt.
  async valj(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    if (await loc.inputValue() === varde) { this.steg.push(`förvalt: ${text}`); return; }
    await loc.selectOption(varde);
    this.klick += 2;
    this.listval++;
    this.steg.push(`lista (2 klick): ${text}`);
  }
  // Text i ett fält. Har fältet inte redan fokus krävs ett fältbyte, som görs med ett klick i fältet.
  async skriv(loc, varde, text) {
    await loc.waitFor({ state: 'visible' });
    const harFokus = await loc.evaluate(el => el === document.activeElement);
    if (!harFokus) { await loc.click(); this.faltbyten++; this.steg.push(`fältbyte: ${text}`); } else this.steg.push(`har redan fokus: ${text}`);
    await this.page.keyboard.type(varde);
  }
  async tangent(namn, text) {
    // Enter i ett formulär med en skicka-knapp gör att webbläsaren själv klickar på knappen. Det är samma tangenttryck,
    // men sidan ser också ett klick, vilket kontrollen räknar med.
    if (namn === 'Enter' && await this.page.evaluate(() => Boolean(document.activeElement?.form?.querySelector('[type="submit"]')))) this.implicita++;
    await this.page.keyboard.press(namn);
    this.tangenter++;
    this.steg.push(`tangent ${namn}: ${text}`);
  }
  // Jämför med vad sidan har tagit emot. Klick i fält räknas som fältbyten, och listval görs utan musklick.
  async kontrollera() {
    const s = await this.page.evaluate(() => ({ klick: window.__klick, tangent: window.__tangent }));
    const vantadeKlick = this.klick - 2 * this.listval + this.faltbyten + this.implicita;
    if (s.klick !== vantadeKlick || s.tangent !== this.tangenter) {
      throw new Error(`sidan tog emot ${s.klick} klick och ${s.tangent} tangenter, skriptet räknade ${vantadeKlick} och ${this.tangenter}`);
    }
  }
  get uppmatt() { return this.klick + this.faltbyten + this.tangenter; }
}

// Sidan räknar de klick och specialtangenter (inte tecken) som webbläsaren faktiskt tar emot. Matare.kontrollera
// jämför med dem.
async function raknaISidan(ctx) {
  await ctx.addInitScript(() => {
    window.__klick = 0; window.__tangent = 0;
    document.addEventListener('click', e => { if (e.isTrusted) window.__klick++; }, true);
    document.addEventListener('keydown', e => { if (e.isTrusted && e.key.length > 1) window.__tangent++; }, true);
  });
}

// Hjälparna och flödena för en server med adressen BAS.
function skapa(BAS) {
  async function synlig(page, sel, text) {
    const l = page.locator(sel).filter({ hasText: text }).first();
    await l.waitFor({ state: 'visible', timeout: 10000 });
    return l;
  }
  async function gaTill(page, hash) { await page.goto(`${BAS}/${hash}`); await page.waitForLoadState('networkidle'); await page.waitForSelector('main h1'); }
  async function loggaIn(page, id) {
    await page.goto(`${BAS}/#/`);
    await page.waitForLoadState('networkidle');
    if (await page.locator('[data-a="loggaut"]').count()) await page.click('[data-a="loggaut"]');
    // En patient (roll inv-) loggar in i Min journal med simulerad e-legitimation.
    if (id.startsWith('inv-')) { await page.click('#flik-patient'); await page.click(`[data-invanare="${id}"]`); } else await page.click(`[data-roll="${id}"]`);
    await page.waitForSelector('[data-a="loggaut"]');
    await page.waitForSelector('#lista, main h1');
    await page.waitForLoadState('networkidle');
  }
  const startI = {
    'Arbetslistan efter inloggning': async (page) => { await gaTill(page, '#/arbetslista'); await page.waitForSelector('#lista table'); },
    'Patientens översikt': async (page) => { await gaTill(page, '#/patient/p01'); await page.waitForSelector('.tidslinje'); },
    'Översikten för en remitterad patient': async (page) => { await gaTill(page, '#/patient/p05'); await page.waitForSelector('.tidslinje'); },
    'Översikten för en patient på mottagningen': async (page) => { await gaTill(page, '#/patient/p11'); await page.waitForSelector('.tidslinje'); },
    'Översikten för en inlagd patient': async (page) => { await gaTill(page, '#/patient/p04'); await page.waitForSelector('.tidslinje'); },
    'Vårdadministratörens startsida': async (page) => { await gaTill(page, '#/idag'); await page.waitForSelector('#idag-dagens'); },
    'Översikten för en patient med bokad tid': async (page) => { await gaTill(page, '#/patient/p15'); await page.waitForSelector('.ov-tider'); },
    // Runda 6, r3: patient 21 med vårdintyg från akutmottagningen väntar på beslut om intagning.
    'Översikten för en patient som väntar på beslut om intagning': async (page) => { await gaTill(page, '#/patient/p21'); await page.waitForSelector('.tidslinje'); },
    'Min journal för en patient med bokad tid': async (page) => { await gaTill(page, '#/min/p14'); await page.waitForSelector('.min-band h1'); },
    // Runda 5, r4: demoläget med en remiss som en vårdhändelse hänger på (POST /api/demo/remiss-vardhandelse).
    'Inkommande remisser med en vårdhändelse som väntar': async (page) => {
      await gaTill(page, '#/arbetslista');
      const ok = await page.evaluate(async () => {
        await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return (await fetch('/api/demo/remiss-vardhandelse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).ok;
      });
      if (!ok) throw new Error('Demoläget kunde inte skapas inför flödet');
      await gaTill(page, '#/remisser');
      await page.locator('article.remiss', { hasText: 'Bedömning inför elkonvertering' }).waitFor();
    },
    // Runda 5, r4: Waran gör uppehåll inför ett ingrepp med återinsättning i morgon. Görs med API:t utanför mätningen.
    'Arbetslistan dagen före en återinsättning': async (page) => {
      await gaTill(page, '#/arbetslista');
      const ok = await page.evaluate(async () => {
        const imorgon = new Date(Date.now() + 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
        // Samma förberedelse som i användartestet (anvandartest.js): demon återställs först.
        await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const l = await (await fetch('/api/patient/p01/lakemedel')).json();
        const w = l.ordinationer.find(o => o.lakemedel?.namn === 'Waran' && o.status === 'aktiv');
        if (!w) return false;
        const r = await fetch(`/api/ordination/${w.id}/utsatt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: { typ: 'uppehall', aterinsattning: imorgon } }) });
        return r.ok;
      });
      if (!ok) throw new Error('Waran kunde inte göra uppehåll inför flödet');
      await gaTill(page, '#/arbetslista');
      await page.waitForSelector('#lista table');
    },
  };

  // Flödena. Varje funktion gör flödet från startpunkten och kontrollerar att det når sitt resultat.
  const GOR = {
    'oppna-patient': async (m, page) => {
      await m.klicka(page.locator('a.patientlank', { hasText: 'Gunnar Åkesson' }), 'patientens namn i arbetslistan');
      await page.waitForSelector('.tidslinje');
      await synlig(page, '#ov-lm', 'Aktuella läkemedel');
      await synlig(page, '#ov-ant', 'Senaste anteckningar');
    },
    'las-anteckning': async (m, page) => {
      const forsta = page.locator('.ant-lista li').filter({ hasNot: page.locator('.tagg-utkast') }).first();
      const typ = (await forsta.locator('.ant-typ').textContent()).trim();
      await m.klicka(forsta.locator('a'), `senaste signerade anteckningen (${typ})`);
      await synlig(page, '.anteckning .ant-huvud h2', typ);
      await synlig(page, '.anteckning .ant-fakta', 'Signerad');
    },
    daganteckning: async (m, page) => {
      await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
      await page.waitForSelector('#ant-form');
      await m.valj(page.locator('#ny-mall'), 'Daganteckning', 'mallen Daganteckning');
      await m.skriv(page.locator('textarea[data-sokord="Aktuellt"]'), 'Pigg, äter bra. Inga bröstsmärtor.', 'sökordet Aktuellt');
      await m.skriv(page.locator('textarea[data-sokord="Bedömning"]'), 'Stabil, fortsatt plan.', 'sökordet Bedömning');
      await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
      await synlig(page, '.anteckning', 'Pigg, äter bra. Inga bröstsmärtor.');
      await synlig(page, '.anteckning .ant-fakta', 'Signerad');
    },
    ordinera: async (m, page) => {
      await m.klicka(page.locator('.snabbval a', { hasText: 'Ordinera' }), 'Ordinera');
      await page.waitForSelector('#ordform');
      await m.skriv(page.locator('#lm-sok'), 'omeprazol', 'sök läkemedel');
      await m.klicka(page.locator('[data-lm]').first(), 'träffen Omeprazol');
      // Systemet föreslår doseringen ur mallen för omeprazol (Sussa 3.5.1.3), så den behöver inte skrivas.
      await page.waitForFunction(() => document.querySelector('input[name="dosering"]')?.value === '1 kapsel på morgonen');
      await m.skriv(page.locator('input[name="ordinationsorsak"]'), 'Magskydd', 'ordinationsorsak');
      await m.klicka(page.locator('[data-upp="14"]'), 'uppföljning om två veckor');
      await m.klicka(page.locator('[data-spara]'), 'Kontrollera och spara');
      await synlig(page, '.notis', 'Omeprazol Sandoz är ordinerat');
      await synlig(page, '.lm-tabell', 'Omeprazol');
    },
    utsattning: async (m, page) => {
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      await page.waitForSelector('.lm-tabell');
      await m.klicka(page.locator('.lm-tabell tr', { hasText: 'Alvedon' }).locator('[data-utsatt]'), 'Sätt ut för Alvedon');
      await m.skriv(page.locator('dialog[open] textarea'), 'Ingen smärta längre.', 'orsak');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Sätt ut');
      await synlig(page, '.notis', 'Alvedon är utsatt');
    },
    uppmarksamhet: async (m, page) => {
      const forslag = page.locator('.um-forslag', { hasText: 'Antikoagulantiabehandling' });
      await m.klicka(forslag.locator('[data-um-bekrafta]'), 'Bekräfta förslaget Antikoagulantiabehandling');
      await synlig(page, '.notis', 'Uppmärksamhetsinformationen är bekräftad');
      await synlig(page, '.patientband .signal-um summary', 'Antikoagulantiabehandling');
    },
    blodtryck: async (m, page) => {
      await m.klicka(page.locator('.snabbval a', { hasText: 'Registrera mätvärde' }), 'Registrera mätvärde');
      await page.waitForSelector('#mv-form');
      await m.valj(page.locator('#mv-typ'), 'blodtryck', 'mätvärdet Blodtryck');
      await m.skriv(page.locator('#mv-varde'), '128/82', 'värdet');
      await m.klicka(page.locator('#mv-form [type="submit"]'), 'Registrera');
      await synlig(page, '.notis', 'Blodtryck 128/82');
    },
    remiss: async (m, page) => {
      await m.klicka(page.locator('.snabbval a', { hasText: 'Skicka remiss' }), 'Skicka remiss');
      await page.waitForSelector('#remissform');
      await m.valj(page.locator('select[name="tillEnhetId"]'), 'uso-kard', 'mottagare Kardiologiska kliniken');
      await m.skriv(page.locator('textarea[name="fragestallning"]'), 'Bedömning inför elkonvertering.', 'frågeställning');
      await m.skriv(page.locator('textarea[name="anamnes"]'), 'Förmaksflimmer sedan 2014. Waran, INR 2,4.', 'anamnes');
      await m.klicka(page.locator('#remissform [type="submit"]'), 'Skicka remissen');
      await synlig(page, '.notis', 'Remissen är skickad');
    },
    'kvittera-svar': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
      await page.waitForSelector('#ik-svar');
      await m.klicka(page.locator('#ik-svar ~ ul a').first(), 'remissvaret i inkorgen');
      await synlig(page, '.remiss.markerad .remiss-text', 'Svar');
      await m.klicka(page.locator('.remiss.markerad [data-remiss-atgard="kvittera"]'), 'Kvittera svaret');
      await synlig(page, '.notis', 'Svaret är kvitterat');
    },
    nodatkomst: async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/sok"]'), 'Sök patient i menyn');
      await page.waitForSelector('#sokfalt');
      await m.skriv(page.locator('#sokfalt'), 'Lindberg', 'sökfältet');
      await m.tangent('Enter', 'sök');
      await m.klicka(page.locator('#traffar a', { hasText: 'Thomas Lindberg' }), 'träffen Thomas Lindberg');
      await m.klicka(page.locator('.ruta-nod [data-val="nodatkomst"]'), 'Nödåtkomst');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-forslag]').first(), 'syftet Medvetslös vid ankomst');
      await m.klicka(page.locator('dialog[open] input[name="intyg"]'), 'intyget att patienten inte kan samtycka');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Öppna med nödåtkomst');
      await synlig(page, '.band-grund', 'Nödåtkomst, loggas och granskas');
    },
    reservnummer: async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/sok"]'), 'Sök patient i menyn');
      await page.waitForSelector('#sokfalt');
      await m.klicka(page.locator('[data-ny-patient]'), 'Registrera ny patient');
      await page.waitForSelector('#np-form');
      await m.klicka(page.locator('#np-m'), 'kön Man');
      await m.skriv(page.locator('#np-fodelse'), '40', 'ungefärlig ålder');
      await m.klicka(page.locator('#np-form [type="submit"]'), 'Registrera');
      await synlig(page, '.notis', 'registrerad med reservnummer VK');
      await synlig(page, '.band-fakta', 'Reservnummer');
    },
    'sla-samman': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
      await page.waitForSelector('#ik-dubb');
      await m.klicka(page.locator('#ik-dubb ~ ul a').first(), 'den troliga dubbletten i inkorgen');
      await synlig(page, '.dubblett', 'Trolig dubblett');
      await m.klicka(page.locator('[data-sla-samman]').first(), 'Slå samman journalerna');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Slå samman');
      await synlig(page, '.notis', 'Journalerna är sammanslagna');
      await synlig(page, '.id-tabell', 'Tidigare');
    },
    halsoarende: async (m, page) => {
      await m.klicka(page.locator('.ha-forslag', { hasText: 'Vänsterhjärtsvikt' }).locator('[data-ha-bekrafta]'), 'Bekräfta i förslaget');
      await synlig(page, '.notis', 'Hälsoärendet Vänsterhjärtsvikt är bekräftat');
      await synlig(page, '.vk-lista', 'Hälsoärende: Vänsterhjärtsvikt');
    },
    inskrivning: async (m, page) => {
      await m.klicka(page.locator('[data-vk="skriv-in"]'), 'Skriv in');
      await page.locator('dialog[open]').waitFor();
      await m.skriv(page.locator('dialog[open] input[name="orsak"]'), 'Elkonvertering', 'orsaken');
      await m.skriv(page.locator('dialog[open] input[name="plats"]'), 'Avd 72, sal 5', 'sal och säng');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skriv in');
      await synlig(page, '.notis', 'Patienten är inskriven på Avdelning 72');
      await synlig(page, '.vardtillfalle', 'Avd 72, sal 5');
    },
    flytta: async (m, page) => {
      await m.klicka(page.locator('.vardtillfalle [data-vk="flytta"]'), 'Flytta');
      await page.locator('dialog[open]').waitFor();
      await m.valj(page.locator('dialog[open] select[name="enhetId"]'), 'uso-kard-hia', 'avdelningen HIA');
      await m.skriv(page.locator('dialog[open] input[name="plats"]'), 'HIA, sal 1', 'sal och säng');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Flytta');
      await synlig(page, '.notis', 'Patienten ligger nu på Hjärtintensivvårdsavdelningen');
      await synlig(page, '.vardtillfalle', 'HIA, sal 1');
    },
    utskrivning: async (m, page) => {
      await m.klicka(page.locator('.vardtillfalle [data-vk="skriv-ut"]'), 'Skriv ut');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skriv ut');
      await synlig(page, '.notis', 'Patienten är utskriven');
    },
    'registrera-besok': async (m, page) => {
      await m.klicka(page.locator('[data-vk="registrera"]'), 'Registrera vårdkontakt');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
      await synlig(page, '.notis', 'Besök är registrerat');
      await synlig(page, '.vk-lista', 'Enligt remiss från Vårdcentralen Kumla');
    },
    'planera-video': async (m, page) => {
      await m.klicka(page.locator('[data-vk="registrera"]'), 'Registrera vårdkontakt');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-knappval="kontaktsatt"] [data-val="video"]'), 'Video');
      await m.klicka(page.locator('dialog[open] [data-knappval="nar"] [data-val="planerad"]'), 'Planerad');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
      await synlig(page, '.notis', 'Video är registrerat till');
    },
    // Läkemedelsprocessen (Sussa 3.5.2).
    'ge-dos': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/administrering"]'), 'Läkemedel att ge i menyn');
      await page.waitForSelector('.adm-patient');
      const gunnar = page.locator('.adm-patient', { hasText: 'Gunnar Åkesson' });
      await m.klicka(gunnar.locator('.adm-vb', { hasText: 'Alvedon' }).locator('[data-adm="ge"]'), 'Ge för Alvedon vid behov');
      await synlig(page, '.notis', 'Alvedon är given');
    },
    vidimera: async (m, page) => {
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      await synlig(page, '.vidimering', 'ändringar sedan vidimeringen');
      await m.klicka(page.locator('[data-vidimera]'), 'Vidimera listan');
      await synlig(page, '.notis', 'Läkemedelslistan är vidimerad');
      await synlig(page, '.vidimering', 'Inget har ändrats sedan dess');
    },
    'utsattning-varning': async (m, page) => {
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      await page.waitForSelector('.lm-tabell');
      await m.klicka(page.locator('.lm-tabell tr', { hasText: 'Metoprolol' }).filter({ has: page.locator('[data-utsatt]') }).locator('[data-utsatt]'), 'Sätt ut för Metoprolol');
      await synlig(page, 'dialog[open] .varningslista', 'Betablockerare ska inte sättas ut tvärt');
      await m.skriv(page.locator('dialog[open] textarea'), 'Bradykardi, trappas ned enligt plan.', 'orsak');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Sätt ut trots varningen');
      await synlig(page, '.notis', 'Metoprolol Sandoz är utsatt');
    },
    // Vem som får ge läkemedel och säkrare utsättning (runda 5).
    'utsattning-plan': async (m, page) => {
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      await page.waitForSelector('.lm-tabell');
      await m.klicka(page.locator('.lm-tabell tr', { hasText: 'Waran' }).filter({ has: page.locator('[data-utsatt]') }).locator('[data-utsatt]'), 'Sätt ut för Waran');
      await synlig(page, 'dialog[open] .varningslista', 'blodpropp och stroke');
      await m.klicka(page.locator('dialog[open] [data-plan="uppehall"]'), 'planen Uppehåll inför ingrepp');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Jag har en plan');
      await synlig(page, '.notis', 'Waran är utsatt');
      await synlig(page, '.ut-plan', 'Uppehåll inför ingrepp, återinsätts');
    },
    'ge-dos-delegering': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/administrering"]'), 'Läkemedel att ge i menyn');
      await page.waitForSelector('.adm-patient');
      await synlig(page, '.adm-delegering', 'Du ger läkemedel med delegering');
      const gunnar = page.locator('.adm-patient', { hasText: 'Gunnar Åkesson' });
      await m.klicka(gunnar.locator('.adm-vb', { hasText: 'Alvedon' }).locator('[data-adm="ge"]'), 'Ge för Alvedon vid behov');
      await synlig(page, '.notis', 'Alvedon är given');
    },
    'registrera-delegering': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/delegeringar"]'), 'Delegeringar i menyn');
      const amira = page.locator('.del-person', { hasText: 'Amira Haddad' });
      await m.klicka(amira.locator('[data-del="ny"]'), 'Ny delegering för Amira Haddad');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] #del-intyg'), 'intyget att kunskaperna är kontrollerade');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera delegeringen');
      await synlig(page, '.notis', 'Delegeringen för Amira Haddad är registrerad');
    },
    utskrift: async (m, page) => {
      await m.klicka(page.locator('.snabbval [data-utskrift]'), 'Skriv ut');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skriv ut i dialogen');
      await synlig(page, '.notis', 'Utskriften är registrerad med id U-');
      await synlig(page, '.utskrift .utskrift-fakta', 'Läkemedelslista till patienten vid utskrivning');
      await synlig(page, '.utskrift-sidfot', 'Utskrifts-id U-');
      // Utskriftssidan stängs utanför mätningen, så att nästa flöde börjar i journalen.
      await page.evaluate(() => document.querySelector('.utskrift-ram [data-stang]')?.click());
    },
    'begar-kontrasignering': async (m, page) => {
      const forsta = page.locator('.ant-lista li').filter({ hasNot: page.locator('.tagg-utkast') }).first();
      await m.klicka(forsta.locator('a'), 'senaste signerade anteckningen');
      await page.waitForSelector('.anteckning .ant-fakta');
      await m.klicka(page.locator('.anteckning [data-begar-ks]'), 'Begär kontrasignering');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skicka');
      await synlig(page, '.notis', 'Begäran om kontrasignering är skickad till Göran Malm');
      await synlig(page, '.kontrasignering', 'Kontrasignering begärd');
    },
    kontrasignera: async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
      await page.waitForSelector('#ik-ks');
      await m.klicka(page.locator('#ik-ks ~ ul a').first(), 'begäran om kontrasignering i inkorgen');
      await synlig(page, '.anteckning', 'Stabil efter PCI');
      await m.klicka(page.locator('.anteckning [data-kontrasignera]'), 'Kontrasignera');
      await synlig(page, '.notis', 'Anteckningen är kontrasignerad');
      await synlig(page, '.kontrasignering', 'Kontrasignerad');
    },
    // Tidboken (Sussa 3.4.1 till 3.4.4). Systemet föreslår tiderna, så bokning och ombokning är två klick.
    'boka-remiss': async (m, page) => {
      await m.klicka(page.locator('#idag-remisser tr', { hasText: 'Karl-Erik Brandt' }).locator('[data-atgard="boka"]'), 'Boka tid vid remissen');
      await page.locator('dialog[open] .forslag-knapp').first().waitFor();
      await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
      await synlig(page, '.notis', 'Karl-Erik Brandt har fått en tid');
      await page.locator('#idag-remisser', { hasText: 'Alla accepterade remisser har fått tid' }).waitFor();
    },
    'checka-in': async (m, page) => {
      await m.klicka(page.locator('#idag-dagens tr', { hasText: 'Ahmed Hassan' }).locator('[data-atgard="checka_in"]'), 'Checka in för Ahmed Hassan');
      await synlig(page, '.notis', 'Ahmed Hassan är incheckad');
      await synlig(page, '#idag-dagens tr', 'Att betala 200 kr');
    },
    gruppkallelse: async (m, page) => {
      await m.klicka(page.locator('#idag-kallelser [data-atgard="kalla_grupp"]').first(), 'Skicka kallelser för Hjärtskolan');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skicka 3 kallelser');
      await synlig(page, '.notis', '3 kallelser är skickade');
    },
    omboka: async (m, page) => {
      await m.klicka(page.locator('.ov-tider [data-tider="omboka"]').first(), 'Boka om');
      await page.locator('dialog[open] .forslag-knapp').first().waitFor();
      await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
      await synlig(page, '.notis', 'Tiden är ombokad till');
    },
    'egen-ombokning': async (m, page) => {
      await m.klicka(page.locator('.min-flikar a', { hasText: /^Tider$/ }), 'fliken Tider');
      await page.waitForSelector('.min-tider');
      await m.klicka(page.locator('.min-tid [data-min="omboka"]').first(), 'Boka om');
      await page.locator('dialog[open] .forslag-knapp').first().waitFor();
      await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den föreslagna tiden');
      await synlig(page, '.notis', 'Din tid är ombokad till');
    },
    // Runda 5, r1: systemet föreslår återbesöket ur sammanhanget, och läkaren bekräftar med ett klick (Sussa 3.4.1.1).
    aterbesok: async (m, page) => {
      await m.klicka(page.locator('.snabbval [data-aterbesok]'), 'Återbesök');
      await page.locator('dialog[open] [data-varde="ok"]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Sätt upp återbesök');
      await synlig(page, '.notis', 'Återbesöket står på väntelistan');
    },
    // Runda 5, r4: återinsättning efter uppehåll från inkorgen, med ordinationen ifylld ur den tidigare (Sussa 3.5.2.8).
    aterinsattning: async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
      await synlig(page, '.ik-ater', 'Waran ska sättas in igen i morgon');
      await m.klicka(page.locator('.ik-ater', { hasText: 'Gunnar Åkesson' }).locator('[data-aterinsatt]'), 'Sätt in igen');
      await page.waitForFunction(() => document.querySelector('#ordform input[name="dosering"]')?.value === 'Enligt doseringsschema, styrs av INR' && document.querySelector('#ordform input[name="ordinationsorsak"]')?.value);
      await m.klicka(page.locator('#ordform [data-spara]'), 'Kontrollera och spara');
      await synlig(page, '.notis', 'Waran är ordinerat');
      await synlig(page, '.lm-tabell', 'Waran');
    },
    // Runda 5, r4: behandlingen avslutas för gott från inkorgen, med en orsak som systemet föreslår.
    'avsluta-aterinsattning': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/inkorg"]'), 'Inkorg i menyn');
      await synlig(page, '.ik-ater', 'Waran ska sättas in igen i morgon');
      await m.klicka(page.locator('.ik-ater', { hasText: 'Gunnar Åkesson' }).locator('[data-avsluta]'), 'Avslutad behandling');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Avsluta behandlingen');
      await synlig(page, '.notis', 'Behandlingen med Waran 2,5 mg är avslutad');
      await synlig(page, '#ik-atersatt ~ .tom', 'Inget läkemedel ska sättas in igen');
    },
    // Runda 6, r3: standardvårdplan som systemet föreslår ur diagnosen (Sussa 3.2.2.1).
    vardplan: async (m, page) => {
      await m.klicka(page.locator('.r3-forslag [data-vp-mall="hjartsvikt"]'), 'Sätt upp vårdplanen');
      await page.locator('dialog[open] [data-varde="ok"]').waitFor();
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Upprätta vårdplanen');
      await synlig(page, '.notis', 'Vårdplanen Hjärtsvikt är upprättad');
    },
    // Runda 6, r3: beslut om intagning enligt 6 b § LPT, med systemets kontroller (Sussa 3.2.3.1).
    intagningsbeslut: async (m, page) => {
      await m.klicka(page.locator('[data-tv-steg]'), 'Besluta om intagning');
      await page.locator('dialog[open] input[name="bekraftelse"]').waitFor();
      await m.klicka(page.locator('dialog[open] input[name="bekraftelse"]'), 'Bekräfta undersökning och bedömning');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Besluta om intagning');
      await synlig(page, '.notis', 'Beslutet om intagning är registrerat');
    },
    // Runda 5, r4: avvisningen frågar om läkemedlet som väntar på vårdhändelsen, med Sätt ut förvalt.
    'avvisa-remiss-satt-ut': async (m, page) => {
      const kort = page.locator('article.remiss', { hasText: 'Bedömning inför elkonvertering' });
      await m.klicka(kort.locator('[data-remiss-atgard="bedom"]'), 'Bedöm');
      await page.locator('dialog[open]').waitFor();
      await m.klicka(page.locator('dialog[open] #b-avv'), 'Avvisa');
      await synlig(page, 'dialog[open] [data-avvisning]', 'Sätt ut eller behåll?');
      await m.skriv(page.locator('dialog[open] #b-mot'), 'Handläggs i primärvården.', 'motivering');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Spara bedömningen');
      await synlig(page, '.notis', 'Omeprazol Sandoz 20 mg är utsatt');
    },
  };
  return { synlig, gaTill, loggaIn, startI, GOR };
}

module.exports = { Matare, skapa, raknaISidan };
