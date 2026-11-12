// Flödena i klickbudgeten (D6), gemensamma för test/klickbudget.cjs och test/anvandartest.cjs. Varje flöde görs från
// sin startpunkt med riktiga interaktioner (musklick, tangenttryck och inskriven text), och Matare räknar stegen enligt
// reglerna i app/src/klickbudget.js.

// Räknar steg i ett flöde.
// Runda 13, r3 (E2-5): utan skanning bekräftas patientens identitet en gång per patient och läkemedelsrunda. Dialogen
// har det vanligaste sättet förvalt, så ett klick bekräftar. klicka är mätarens klick i flöden med klickbudget.
async function idDialog(page, klicka = (l) => l.click()) {
  if (await page.locator('dialog[open] #adm-id').waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await klicka(page.locator('dialog[open] [data-varde="ok"]'));
}
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
    // Runda 7, r7: kravsidan med Sussas kravspecifikation.
    'Kravsidan': async (page) => { await gaTill(page, '#/krav'); await page.waitForSelector('#sussa-lista details.sussapost'); },
    // Runda 7, r6: barnet på Barnavårdscentralen Tybble, efter återställning så att inga mätningar från förra körningen finns.
    'Översikten för ett barn på barnavårdscentralen': async (page) => {
      await gaTill(page, '#/arbetslista');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/patient/p61');
      await page.waitForSelector('.tidslinje');
    },
    'Översikten för en patient med bokad tid': async (page) => { await gaTill(page, '#/patient/p15'); await page.waitForSelector('.ov-tider'); },
    // Runda 6, r3: patient 21 med vårdintyg från akutmottagningen väntar på beslut om intagning.
    'Översikten för en patient som väntar på beslut om intagning': async (page) => { await gaTill(page, '#/patient/p21'); await page.waitForSelector('.tidslinje'); },
    'Min journal för en patient med bokad tid': async (page) => { await gaTill(page, '#/min/p14'); await page.waitForSelector('.min-band h1'); },
    // Runda 5, r4: demoläget med en remiss som en vårdhändelse hänger på (POST /api/demo/remiss-vardhandelse).
    'Inkommande remisser med en vårdhändelse som väntar': async (page) => {
      await gaTill(page, '#/arbetslista');
      const ok = await page.evaluate(async () => {
        await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text());
        const r = await fetch('/api/demo/remiss-vardhandelse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        await r.text();
        return r.ok;
      });
      if (!ok) throw new Error('Demoläget kunde inte skapas inför flödet');
      await gaTill(page, '#/remisser');
      await page.locator('article.remiss', { hasText: 'Bedömning inför elkonvertering' }).waitFor();
    },
    // Runda 6, r2: läkemedelsfliken och Läkemedel att ge efter att demon har återställts.
    'Patientens läkemedelsflik': async (page) => {
      await gaTill(page, '#/arbetslista');
      // Runda 6, r5: svaret läses till slut, annars räknar Playwright anropet som pågående och väntar förgäves på ett
      // nätverk i vila när en ram (tillämpningen i journalen) senare laddas.
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/patient/p01/lakemedel');
      await page.waitForSelector('.lm-tabell');
    },
    // Runda 6, r6: verksamhetschefens startsida och den mallansvariga läkarens inkorg, efter återställning.
    'Verksamhetschefens startsida': async (page) => {
      await gaTill(page, '#/moduler');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
      await gaTill(page, '#/lakemedelsansvar');
      await page.waitForSelector('#la-pam');
    },
    // Runda 7, r3: ekonomens startsida med faktureringsunderlaget per vårdenhet för förra månaden.
    'Ekonomens startsida': async (page) => { await gaTill(page, '#/ekonomi'); await page.waitForSelector('#ek table'); await page.waitForSelector('#ek-exporter ul, #ek-exporter .tom:not(:has-text("Hämtar"))'); },
    // Runda 7, r4: systemförvaltarens sidor efter återställning.
    'Omorganisationen efter återställning': async (page) => {
      await gaTill(page, '#/moduler');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/omorganisation');
      await page.waitForSelector('.sf-org');
    },
    'Reglerna efter återställning': async (page) => {
      await gaTill(page, '#/moduler');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/regler');
      await page.waitForSelector('#sf-att-godkanna');
    },
    // Runda 8, r2: de inkommande remisserna och den inskannade pappersremissen efter återställning.
    'Inkommande remisser efter återställning': async (page) => {
      await gaTill(page, '#/moduler');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/remisser');
      await page.waitForSelector('article.remiss');
      await page.waitForSelector('.r8-skannade [data-skann]');
    },
    'Inkorgen efter återställning': async (page) => {
      await gaTill(page, '#/arbetslista');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
      await gaTill(page, '#/inkorg');
      await page.waitForSelector('#ik-mallar');
    },
    // Runda 7, r5: uppföljningsrollens rapportering, efter återställning, så att ingen rapport har skickats förut.
    'Rapporteringssidan efter återställning': async (page) => {
      await gaTill(page, '#/datauttag');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/rapportering');
      await page.waitForSelector('[data-granska="par"]');
    },
    // Runda 7, r2: efter en återställning har ingen stängt nyheterna, som efter en ny version.
    'Arbetslistan med nyheterna efter en ny version': async (page) => {
      await gaTill(page, '#/arbetslista');
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/arbetslista');
      await page.waitForSelector('.nyhetsruta [data-a="stang-nyheter"]');
    },
    // Runda 7, r2: demoläget flyttar inloggningens tid så att varningen före utloggningen visas direkt.
    'Arbetslistan när inloggningen snart går ut': async (page) => {
      await gaTill(page, '#/arbetslista');
      await page.evaluate(async () => {
        await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text());
        const { api } = await import('/js/ui.js');
        await api('/api/demo/inloggning-gar-ut', { metod: 'POST', data: { sekunder: 240 } });
      });
      await page.waitForSelector('#tidsgrans [data-a="forlang"]');
    },
    'Läkemedel att ge efter återställning': async (page) => {
      await gaTill(page, '#/arbetslista');
      // Runda 6, r5: svaret läses till slut, annars räknar Playwright anropet som pågående och väntar förgäves på ett
      // nätverk i vila när en ram (tillämpningen i journalen) senare laddas.
      await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
      await gaTill(page, '#/administrering');
      await page.waitForSelector('.adm-patient');
    },
    // Runda 5, r4: Waran gör uppehåll inför ett ingrepp med återinsättning i morgon. Görs med API:t utanför mätningen.
    'Arbetslistan dagen före en återinsättning': async (page) => {
      await gaTill(page, '#/arbetslista');
      const ok = await page.evaluate(async () => {
        const imorgon = new Date(Date.now() + 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
        // Samma förberedelse som i användartestet (anvandartest.js): demon återställs först.
        await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text());
        const l = await (await fetch('/api/patient/p01/lakemedel')).json();
        const w = l.ordinationer.find(o => o.lakemedel?.namn === 'Waran' && o.status === 'aktiv');
        if (!w) return false;
        const r = await fetch(`/api/ordination/${w.id}/utsatt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: { typ: 'uppehall', aterinsattning: imorgon } }) });
        await r.text();
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
    // Runda 8, r4: dosändring i en pågående ordination, med en annan styrka som systemet fyller i doseringen för.
    'andra-dos': async (m, page) => {
      await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
      await page.waitForSelector('.lm-tabell');
      await m.klicka(page.locator('.lm-tabell tr', { hasText: 'Metoprolol Sandoz' }).locator('[data-dosandring]'), 'Ändra dos för Metoprolol');
      await m.klicka(page.locator('dialog[open] [data-styrka]', { hasText: '100 mg' }), 'styrkan 100 mg');
      await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Ändra dosen');
      await synlig(page, '.notis', 'dosen är ändrad');
      await synlig(page, '.lm-tabell tr:has-text("Metoprolol Sandoz")', '100 mg');
    },
    // Runda 7, r2: varningen före utloggningen.
    'forlang-inloggning': async (m, page) => {
      await synlig(page, '#tidsgrans', 'Du loggas snart ut');
      await m.klicka(page.locator('#tidsgrans [data-a="forlang"]'), 'Fortsätt arbeta');
      await page.waitForFunction(() => !document.getElementById('tidsgrans'));
      await synlig(page, '.notis', 'Du är inloggad');
    },
    // Runda 7, r2: nyhetsrutan.
    nyheter: async (m, page) => {
      // Runda 8: rutan visar den aktuella versionens nyheter för rollen, som servern säger vilka de är.
      const forvantat = await page.evaluate(() => fetch('/api/nyheter').then(r => r.json()));
      await synlig(page, '.nyhetsruta', forvantat.ruta.nyheter[0].rubrik);
      await m.klicka(page.locator('[data-a="stang-nyheter"]'), 'Stäng nyheterna');
      await page.waitForFunction(() => !document.querySelector('.nyhetsruta'));
      await synlig(page, '.notis', 'Nyheterna är stängda');
    },
    'ge-dos': async (m, page) => {
      await m.klicka(page.locator('#meny-lista a[href="#/administrering"]'), 'Läkemedel att ge i menyn');
      await page.waitForSelector('.adm-patient');
      const gunnar = page.locator('.adm-patient', { hasText: 'Gunnar Åkesson' });
      await m.klicka(gunnar.locator('.adm-vb', { hasText: 'Alvedon' }).locator('[data-adm="ge"]').first(), 'Ge för Alvedon vid behov');
      await idDialog(page, (l) => m.klicka(l, 'Identiteten är kontrollerad'));
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
      await m.klicka(gunnar.locator('.adm-vb', { hasText: 'Alvedon' }).locator('[data-adm="ge"]').first(), 'Ge för Alvedon vid behov');
      await idDialog(page, (l) => m.klicka(l, 'Identiteten är kontrollerad'));
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
      await page.waitForFunction(() => document.querySelector('#ordform input[name="dosering"]')?.value.startsWith('Enligt doseringsschema, styrs av INR') && document.querySelector('#ordform input[name="ordinationsorsak"]')?.value);
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
    // Runda 6, r1: sökning i journalen och NEWS2-kontroll.
    'sok-journal': async (m, page) => {
      await m.skriv(page.locator('#jsok-falt'), 'blodtryck', 'sökfältet i journalen');
      await m.tangent('Enter', 'sök');
      await synlig(page, '[data-tolkning]', 'mätvärdena blodtryck');
      await m.klicka(page.locator('.jsok-traff a[data-traff="matvarde"]').first(), 'den senaste träffen, ett blodtryck');
      await synlig(page, '#kurva-blodtryck.markerad h4', 'Blodtryck');
    },
    news2: async (m, page) => {
      await m.klicka(page.locator('.flikar a', { hasText: 'Mätvärden' }), 'fliken Mätvärden');
      await m.klicka(page.locator('[data-news2-ny]'), 'Registrera NEWS2-kontroll');
      await m.skriv(page.locator('#n2-andningsfrekvens'), '22', 'andningsfrekvens');
      await m.skriv(page.locator('#n2-saturation'), '95', 'syremättnad');
      await m.skriv(page.locator('#n2-blodtryck'), '118/72', 'blodtryck');
      await m.skriv(page.locator('#n2-puls'), '112', 'puls');
      await m.skriv(page.locator('#n2-temp'), '38,4', 'temperatur');
      await m.klicka(page.locator('#n2-acvpu-A'), 'medvetandegraden A, vaken');
      await m.klicka(page.locator('#news2-form [type="submit"]'), 'Registrera kontrollen');
      await synlig(page, '.notis', 'NEWS2 6, medelhög risk');
    },
  };
  // Runda 6, r2: läkemedelsprocessen, del 2.
  GOR['ordinera-mall'] = async (m, page) => {
    await m.klicka(page.locator('[data-mall]'), 'Ordinera från mall');
    await m.klicka(page.locator('[data-paket="elkonvertering"]'), 'mallen Inför elkonvertering');
    await synlig(page, '.lms-forslag', 'Tas inte med');
    await m.klicka(page.locator('[data-paket-ordinera]'), 'Ordinera');
    await synlig(page, '.notis', 'läkemedel är ordinerade ur mallen Inför elkonvertering');
    await synlig(page, '.lm-tabell', 'Mall: Inför elkonvertering');
  };
  GOR['dos-efterhand'] = async (m, page) => {
    const gunnar = page.locator('.adm-patient', { hasText: 'Gunnar Åkesson' });
    const alvedon = gunnar.locator('.adm-vb', { hasText: 'Alvedon' });
    await m.klicka(alvedon.locator('.adm-mer summary'), 'Mer för Alvedon vid behov');
    await m.klicka(alvedon.locator('[data-adm="efterhand"]'), 'Given tidigare');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
    await idDialog(page, (l) => m.klicka(l, 'Identiteten är kontrollerad'));
    await synlig(page, '.notis', 'Alvedon är registrerad som given');
  };
  // Runda 6, r6.
  GOR['utse-mal'] = async (m, page) => {
    await m.klicka(page.locator('[data-paminnelse="0"]'), 'Utse Göran Malm');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Utse');
    await synlig(page, '.notis', 'Göran Malm är utsedd till medicinskt ansvarig läkare');
    await synlig(page, '#la-medicinskt_ansvarig', 'Göran Malm');
  };
  // Runda 7, r4: systemförvaltningen. Namnbyte är förvalt och namnet markerat, och värdet i regeln likaså.
  GOR['forbered-namnbyte'] = async (m, page) => {
    await m.klicka(page.locator('tr[data-enhet="uso-kard-mott"] [data-forandra]'), 'Ändra vid Kardiologiska mottagningen');
    await m.skriv(page.locator('dialog[open] #sf-namn'), 'Hjärtmottagningen USÖ', 'det nya namnet');
    await synlig(page, 'dialog[open] [data-forhand]', 'byter namn till Hjärtmottagningen USÖ');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Förbered');
    await synlig(page, '.notis', 'Förändringen är förberedd till');
    await synlig(page, '#sf-forberedda ~ ul', 'Kardiologiska mottagningen byter namn till Hjärtmottagningen USÖ');
  };
  GOR['andra-demoregel'] = async (m, page) => {
    await m.klicka(page.locator('tr[data-nyckel="tidbok.paminnelse_timmar"] [data-andra]'), 'Ändra vid Påminnelse före en bokad tid');
    await m.skriv(page.locator('dialog[open] #sf-varde'), '72', 'det nya värdet');
    await m.skriv(page.locator('dialog[open] #sf-motivering'), 'Patienterna hinner boka om en dag tidigare.', 'motiveringen');
    await synlig(page, 'dialog[open] [data-forhand]', 'påminnelsefönstret');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Skicka för godkännande');
    await synlig(page, '.notis', 'väntar på att en annan systemförvaltare godkänner den');
    await synlig(page, '#sf-mina ~ ul', '72 timmar');
  };
  GOR['godkanna-mall'] = async (m, page) => {
    await m.klicka(page.locator('#ik-mallar ~ ul [data-granska="0"]'), 'Granska');
    await synlig(page, 'dialog[open]', 'Ändrat mot version 1');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Godkänn');
    await synlig(page, '.notis', 'Mallen Inför elkonvertering är godkänd');
  };
  // Runda 6, r5: en extern tillämpning startas från journalen med SMART on FHIR och visar blodtrycket i en ram.
  GOR['extern-tillampning'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Tillämpningar' }), 'fliken Tillämpningar');
    await m.klicka(page.locator('[data-starta="blodtryck"]'), 'Starta Blodtryck över tid');
    await page.frameLocator('#tillampning-ram iframe').locator('[data-diagram] svg').waitFor({ timeout: 15000 });
    await synlig(page, '[data-tillampning-status]', 'Blodtryck över tid visar');
  };
  // Runda 6, r4: ingrepp med rum och utrustning, och provtagning före läkarbesök. Systemet föreslår tiderna och bokar
  // allt samtidigt, så båda flödena är två klick.
  GOR['boka-ingrepp'] = async (m, page) => {
    await m.klicka(page.locator('#idag-vantelista tr', { hasText: 'Elkonvertering vid förmaksflimmer' }).locator('[data-atgard="boka"]'), 'Boka tid vid elkonverteringen');
    await page.locator('dialog[open] .forslag-knapp').first().waitFor();
    await synlig(page, 'dialog[open] .forslag-resurser', 'Defibrillator');
    await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
    await synlig(page, '.notis', 'Mikael Svensson har fått en tid');
    await synlig(page, '.notis', 'Defibrillator');
  };
  GOR['boka-kedja'] = async (m, page) => {
    await m.klicka(page.locator('#idag-vantelista tr', { hasText: 'Återbesök efter elkonverteringen' }).locator('[data-atgard="boka"]'), 'Boka tid vid återbesöket');
    await page.locator('dialog[open] .forslag-knapp').first().waitFor();
    await synlig(page, 'dialog[open] .forslag-fore', 'Provtagning klockan');
    await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'det första förslaget med provtagning och läkarbesök');
    await synlig(page, '.notis', 'Gunnar Åkesson har fått en tid');
    await synlig(page, '.notis', 'provtagning');
  };
  // Runda 8, r3: fri bokning, teambesök, gruppträff och avdelningens planering.
  GOR['boka-fri'] = async (m, page) => {
    await m.klicka(page.locator('#idag [data-atgard="r8_fri"]'), 'Boka besök');
    await m.skriv(page.locator('dialog[open] #r8-sok'), 'Viklund', 'sökfältet');
    await m.tangent('Enter', 'sök');
    await page.locator('dialog[open] .forslag-knapp').first().waitFor();
    await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
    await synlig(page, '.notis', 'Anna Viklund har fått en tid');
  };
  GOR['boka-team'] = async (m, page) => {
    await m.klicka(page.locator('#idag [data-atgard="r8_team"]'), 'Boka teambesök');
    await m.skriv(page.locator('dialog[open] #r8-sok'), 'Viklund', 'sökfältet');
    await m.tangent('Enter', 'sök');
    await page.locator('dialog[open] .forslag-knapp').first().waitFor();
    await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
    await synlig(page, '.notis', 'Anna Viklund har fått ett teambesök');
  };
  GOR['grupp-lagg-till'] = async (m, page) => {
    await m.klicka(page.locator('#idag-grupper li', { hasText: 'Hjärtskola' }).locator('[data-atgard="r8_grupp"]'), 'Lägg till patient vid Hjärtskola');
    await m.skriv(page.locator('dialog[open] #r8-sok'), 'Mikael Svensson', 'sökfältet');
    await m.tangent('Enter', 'sök');
    await m.klicka(page.locator('dialog[open] [data-r8-patient]', { hasText: 'Mikael Svensson' }).first(), 'träffen');
    await synlig(page, '.notis', 'Mikael Svensson har fått en plats på Hjärtskola');
  };
  GOR['avdelningens-handelser'] = async (m, page) => {
    await m.klicka(page.locator('.snabbval a[href="#/avdelning"]'), 'Avdelningens planering');
    await synlig(page, '#av .av-tabell tr', 'Provtagning, blodprover');
  };
  // Runda 7, r5: granska och skicka månadens rapport till patientregistret.
  GOR['rapport-par'] = async (m, page) => {
    await m.klicka(page.locator('[data-granska="par"]'), 'Granska patientregistret');
    await synlig(page, '.rapport-detalj', 'Filerna');
    await m.klicka(page.locator('[data-skicka="par"]'), 'Skicka till patientregistret');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Bekräfta');
    await synlig(page, '.notis', 'Rapporten är skickad till den simulerade mottagaren');
  };
  // Runda 13, r1: testinbjudan. Startsidan för testare, en synpunkt och det första uppdraget.
  startI['Startsidan för testare'] = async (page) => { await gaTill(page, '#/testa'); await page.waitForSelector('.testa-rollknapp'); };
  GOR['lamna-synpunkt'] = async (m, page) => {
    await m.klicka(page.locator('[data-tp="synpunkt"]'), 'Lämna synpunkt');
    await page.waitForSelector('dialog[open] #sp-text');
    await m.skriv(page.locator('#sp-text'), 'Det är svårt att se vilka patienter som är nya i dag.', 'synpunkten');
    await m.klicka(page.locator('dialog[open] input[name="typ"][value="svart"]'), 'Svårt eller krångligt');
    await m.klicka(page.locator('dialog[open] input[name="allvar"][value="liten"]'), 'En detalj eller ett förslag');
    await m.klicka(page.locator('dialog[open] button[type="submit"]'), 'Skicka synpunkten');
    await synlig(page, '.synpunkt-kvitto', 'Tack');
    // Dialogen stängs utan att räknas, så att nästa flöde börjar på en tom sida.
    await page.evaluate(() => document.querySelector('dialog[open]')?.close());
  };
  GOR['valj-yrkesroll'] = async (m, page) => {
    await m.klicka(page.locator('[data-testroll="lakare-sjukhus"]'), 'Läkare på sjukhus');
    await synlig(page, '#testare-panel', 'Ta emot dagens första patient');
    await page.waitForSelector('#lista table');
    await m.klicka(page.locator('a.patientlank', { hasText: 'Gunnar Åkesson' }), 'en patient i arbetslistan');
    await page.waitForSelector('.tidslinje');
    await synlig(page, '#testare-panel .tp-jamforelse', 'Ta emot dagens första patient');
    // Uppdragen avslutas utan att räknas, så att de inte följer med till nästa flöde.
    await page.evaluate(() => fetch('/api/testare/avsluta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()).then(() => sessionStorage.removeItem('vk_testare_aktiv')));
  };
  // Runda 7, r7: de tio högst viktade kriterierna som inte är uppfyllda, med det högst viktade först.
  GOR['kravviktning'] = async (m, page) => {
    await m.klicka(page.locator('#sf-arbetslista'), 'De tio högst viktade kriterierna som inte är uppfyllda');
    await synlig(page, '#sa-vikt', 'De 10 högst viktade');
    const id = await page.locator('#sussa-lista details.sussapost').evaluateAll(d => d.map(x => x.dataset.id));
    if (id.length !== 10 || id[0] !== 'KD1.1.1.9') throw new Error(`listan visade ${id.length} poster och först ${id[0]}`);
    await synlig(page, '#sussa-lista .sussapost', 'Vikt 4,64 %');
  };
  // Runda 7, r3: underlaget för den första vårdenheten med poster hämtas som CSV med ett klick.
  GOR['exportera-underlag'] = async (m, page) => {
    const rad = page.locator('#ek tbody tr', { has: page.locator('[data-export="csv"]') }).first();
    const [fil] = await Promise.all([page.waitForEvent('download'), m.klicka(rad.locator('[data-export="csv"]'), 'CSV för vårdenheten')]);
    if (!/^faktureringsunderlag-[\w-]+-\d{4}-\d{2}\.csv$/.test(fil.suggestedFilename())) throw new Error(`filen heter ${fil.suggestedFilename()}`);
    await synlig(page, '.notis', 'är exporterat');
    await synlig(page, '#ek-exporter', 'CSV');
  };
  // Runda 7, r3: ett hjälpmedel lämnas ut med två klick från kostnadsrutan i översikten.
  GOR['lamna-ut-hjalpmedel'] = async (m, page) => {
    await m.klicka(page.locator('.ov-kostnader [data-ek="hjalpmedel"]'), 'Lämna ut hjälpmedel');
    await m.klicka(page.locator('dialog[open] [data-varde="HM-ROLLATOR"]'), 'Rollator');
    await synlig(page, '.notis', 'Rollator är registrerat som utlämnat');
  };
  // Runda 7, r6: vikt och längd vid ett besök i barnhälsovården. Vikten har fokus när fliken öppnas, och kurvan visar
  // det nya värdet direkt.
  GOR['tillvaxt-bhv'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Tillväxt' }), 'fliken Tillväxt');
    await page.waitForSelector('#tv-form');
    await m.skriv(page.locator('#tv-vikt'), '9,6', 'vikten');
    await m.skriv(page.locator('#tv-langd'), '82', 'längden');
    await m.klicka(page.locator('#tv-form [type="submit"]'), 'Registrera');
    await synlig(page, '.notis', 'Vikt 9,6 kg');
    await synlig(page, '#tv-kurva-vikt .kurva-senaste', '9,6');
    await page.locator('#tv-kurva-vikt svg.tv-kurva').waitFor();
  };
  // Runda 8, r5: tobaksvanorna med fasta svarsalternativ. Ett klick på Dagligen för cigaretter flyttar fokus till
  // antalet, och systemet föreslår stödet och KVÅ-koden.
  GOR.tobaksvanor = async (m, page) => {
    await m.klicka(page.locator('[data-tobak-ny]'), 'Dokumentera tobaksvanor i översikten');
    await page.waitForSelector('#ant-form [data-tobak]');
    await m.klicka(page.locator('#tb-cigaretter-dagligen'), 'Dagligen för cigaretter');
    await m.skriv(page.locator('#tb-antal-cigaretter'), '20', 'antalet cigaretter per dag');
    await m.klicka(page.locator('#tb-stod-accepterat'), 'Erbjudet och accepterat');
    await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
    await synlig(page, '.anteckning', 'Cigaretter dagligen, 20 per dag');
    await synlig(page, '.anteckning', 'KVÅ DV113');
    await synlig(page, '.anteckning .ant-fakta', 'Signerad');
  };
  // Runda 8, r5: epikrisen från vårdtillfället. Systemet har skrivit orsaken till vården ur vårdtillfället och
  // diagnoserna, och fokus står i Förlopp.
  GOR.epikris = async (m, page) => {
    await m.klicka(page.locator('.vardtillfalle [data-epikris]'), 'Skriv epikris');
    await page.waitForSelector('#ant-form [data-forslag-info]');
    await m.skriv(page.locator('textarea[data-sokord="Förlopp"]'), 'Konverterad till sinusrytm. Stabil under vårdtiden.', 'Förlopp');
    await m.skriv(page.locator('textarea[data-sokord="Uppföljning"]'), 'Återbesök på mottagningen om sex veckor.', 'Uppföljning');
    await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
    await synlig(page, '.anteckning .ant-huvud h2', 'Epikris');
    await synlig(page, '.anteckning .ant-fakta', 'Signerad');
  };
  // Runda 8, r5: längd, vikt, blodtryck och puls på en gång.
  GOR.grundmatningar = async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Registrera mätvärde' }), 'Registrera mätvärde');
    await m.klicka(page.locator('[data-flera-ny]'), 'Längd, vikt, blodtryck och puls på en gång');
    await m.skriv(page.locator('#fl-langd'), '178', 'längden');
    await m.skriv(page.locator('#fl-vikt'), '82', 'vikten');
    await m.skriv(page.locator('#fl-blodtryck'), '132/84', 'blodtrycket');
    await m.skriv(page.locator('#fl-puls'), '68', 'pulsen');
    await m.klicka(page.locator('#flera-form [type="submit"]'), 'Registrera');
    await synlig(page, '.notis', 'BMI 25,9');
  };
  // Runda 8, r2: remiss på uppdrag, fördelning och pappersremiss.
  GOR['remiss-pa-uppdrag'] = async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Remiss på uppdrag' }), 'Remiss på uppdrag');
    await page.waitForSelector('#uppdragform');
    if (!(await page.locator('#ru-lakare').inputValue())) throw new Error('systemet föreslog ingen uppdragsgivare');
    await m.valj(page.locator('#ru-till'), 'uso-ort', 'mottagare Ortopediska kliniken USÖ');
    await m.skriv(page.locator('#ru-fraga'), 'Knäsmärta sedan tre månader. Bedömning?', 'frågeställning');
    await m.skriv(page.locator('#ru-anamnes'), 'Svullnad efter ansträngning.', 'anamnes');
    await m.klicka(page.locator('#uppdragform [type="submit"]'), 'Skicka till läkaren för signering');
    await synlig(page, '.notis', 'väntar på signering av');
  };
  GOR['fordela-remiss'] = async (m, page) => {
    const kort = page.locator('article.remiss').filter({ has: page.locator('[data-remiss-atgard="fordela"]') }).first();
    await m.klicka(kort.locator('[data-remiss-atgard="fordela"]'), 'Fördela');
    await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den läkare som systemet föreslår först');
    await synlig(page, '.notis', 'Remissen är fördelad till');
  };
  GOR['registrera-pappersremiss'] = async (m, page) => {
    await m.klicka(page.locator('.r8-skannade [data-skann]').first(), 'Registrera vid den inskannade remissen');
    await page.locator('dialog[open] #ex-patient').waitFor();
    await m.skriv(page.locator('dialog[open] #ex-patient'), 'Gunnar Åkesson', 'patienten');
    await synlig(page, 'dialog[open] [data-vald]', 'Gunnar Åkesson');
    await m.skriv(page.locator('dialog[open] #ex-enhet'), 'Läkarhuset Ekbacken', 'avsändande enhet');
    await m.skriv(page.locator('dialog[open] #ex-fraga'), 'Bröstsmärtor. Bedömning?', 'frågeställning');
    await m.skriv(page.locator('dialog[open] #ex-anamnes'), 'Påhittad pappersremiss i demon.', 'anamnes');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
    await synlig(page, '.notis', 'Pappersremissen från Läkarhuset Ekbacken är registrerad');
  };
  // Runda 8, r1: ett paket som systemet föreslår beställs med ett klick, och provtagningen registreras med ett klick per rör.
  startI['Provtagningen efter återställning'] = async (page) => {
    await gaTill(page, '#/moduler');
    await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
    await gaTill(page, '#/provtagning');
    await page.waitForSelector('.pt-patient');
  };
  GOR['bestall-paket'] = async (m, page) => {
    await m.klicka(page.locator('a.patientlank', { hasText: 'Gunnar Åkesson' }).first(), 'Gunnar Åkesson i arbetslistan');
    await page.waitForSelector('.tidslinje');
    await m.klicka(page.locator('.snabbval a', { hasText: 'Beställ prover' }), 'Beställ prover');
    await page.waitForSelector('#pr-forslag [data-bestall-paket]');
    await m.klicka(page.locator('#pr-forslag [data-bestall-paket]').first(), 'Beställ vid det föreslagna paketet');
    await synlig(page, '.notis', 'är beställt');
    await synlig(page, '#pr-lista .pr-best', 'Beställd, väntar på provtagning');
  };
  GOR['registrera-provtagning'] = async (m, page) => {
    const kort = page.locator('.pt-patient', { hasText: 'Elin Sandberg' }).locator('.pr-best', { hasText: 'B-Blodstatus' });
    await m.klicka(kort.locator('[data-tagen]').first(), 'Tagen för det första röret');
    await synlig(page, '.notis', 'rör kvar');
    await page.waitForLoadState('networkidle');
    await m.klicka(page.locator('.pt-patient', { hasText: 'Elin Sandberg' }).locator('.pr-best', { hasText: 'B-Blodstatus' }).locator('[data-tagen]').first(), 'Tagen för det andra röret');
    await synlig(page, '.notis', 'proverna är skickade');
    await synlig(page, '.pt-patient .pr-best', 'Skickad till laboratoriet');
  };
  // Runda 9, r2: medicinteknisk utrustning, godkännande av värden, intensivvården och egna mätningar.
  startI['Patientens mätvärden efter återställning'] = async (page) => {
    await gaTill(page, '#/arbetslista');
    await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
    await gaTill(page, '#/patient/p01/matvarden');
    await page.waitForSelector('#mt-koppla [data-mt-valj]');
  };
  startI['Mätvärden med värden från en kopplad monitor'] = async (page) => {
    await gaTill(page, '#/arbetslista');
    const ok = await page.evaluate(async () => {
      await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text());
      const r = await fetch('/api/patient/p01/mt/koppla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streckkod: 'MT-MON-0001' }) });
      await r.text();
      return r.ok;
    });
    if (!ok) throw new Error('Monitorn kunde inte kopplas inför flödet');
    await gaTill(page, '#/patient/p01/matvarden');
    await page.waitForSelector('[data-mt-godkann="utrustning"]');
  };
  startI['Min journal för patienten'] = async (page) => { await gaTill(page, '#/min/p01'); await page.waitForSelector('.min-band h1'); };
  GOR['koppla-monitor'] = async (m, page) => {
    await m.klicka(page.locator('#mt-koppla [data-mt-valj="MT-MON-0001"]'), 'Patientmonitor DEMO-MON-0001 i listan, i stället för att skanna');
    await synlig(page, '.notis', 'är kopplad till patienten');
    await synlig(page, '.mt-koppling', 'DEMO-MON-0001');
  };
  GOR['godkanna-mt'] = async (m, page) => {
    await m.klicka(page.locator('[data-mt-godkann="utrustning"]'), 'Godkänn vid värdena från monitorn');
    await synlig(page, '.notis', 'för diagnostiskt bruk');
    await page.waitForLoadState('networkidle');
  };
  GOR['iva-oversikt'] = async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/iva"]'), 'Intensivvård i menyn');
    await page.waitForSelector('table.iva-oversikt');
    await m.klicka(page.locator('table.iva-oversikt a.patientlank').first(), 'patienten i översikten');
    await synlig(page, 'main h1', 'Övervakning');
    await page.waitForSelector('#iva-analys');
  };
  // Runda 11, r7: vårdtyngden enligt NEMS är ett klick, eftersom systemet har kryssat i posterna ur journalen.
  startI['Övervakningen av en patient på intensivvården'] = async (page) => { await gaTill(page, '#/iva/p22'); await page.waitForSelector('#iva-nems-form'); };
  GOR['iva-nems'] = async (m, page) => {
    await m.klicka(page.locator('#iva-nems-form [type="submit"]'), 'Registrera vårdtyngden');
    await synlig(page, '.notis', 'är registrerat för');
  };
  // Runda 11, r7: tillväxtdata från det simulerade journalsystemet granskas och läses in med tre klick.
  startI['Tillväxten för ett barn som har flyttat hit'] = async (page) => { await gaTill(page, '#/patient/p09/tillvaxt'); await page.waitForSelector('#tv-import'); };
  GOR['tillvaxt-import'] = async (m, page) => {
    await m.klicka(page.locator('#tv-import > summary'), 'Läs in tillväxtdata');
    await m.klicka(page.locator('[data-tv-journalsystem]'), 'Hämta från journalsystemet');
    await page.waitForSelector('[data-tv-importera]');
    await m.klicka(page.locator('[data-tv-importera]'), 'Läs in');
    await synlig(page, '.notis', 'är inlästa');
  };
  GOR['egen-matning'] = async (m, page) => {
    await m.klicka(page.locator('.min-flikar a', { hasText: /^Egna mätningar$/ }), 'fliken Egna mätningar');
    await page.waitForSelector('#min-egen');
    await m.skriv(page.locator('#min-egen-varde'), '138/86', 'blodtrycket');
    await m.klicka(page.locator('#min-egen [type=submit]'), 'Skicka');
    await synlig(page, '.notis', 'Mätningen är skickad');
    await synlig(page, '.min-del table', 'Inte bedömd ännu');
  };
  // Runda 9, r1: förbrukningsartiklar ur den mall som systemet föreslår.
  startI['Översikten för en patient med insulin'] = async (page) => { await gaTill(page, '#/patient/p06'); await page.waitForSelector('.tidslinje'); };
  GOR['forbrukning-mall'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
    await page.waitForSelector('.fb-sektion [data-fb-mall="insulin-penna"]');
    await m.klicka(page.locator('.fb-sektion [data-fb-mall="insulin-penna"]'), 'Förskriv mallen Insulin med penna');
    await synlig(page, '.notis', 'Insulin med penna är förskriven');
    await synlig(page, '.fb-sektion', 'Pennkanyler 4 mm');
  };
  // Runda 10, r4: en perifer venkateter, en skannad restjournal och ett förslag om donation i inkorgen.
  GOR['registrera-infart'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'In- och utfarter' }), 'fliken In- och utfarter');
    await page.waitForSelector('#if-form');
    await m.skriv(page.locator('#if-placering'), 'Höger handrygg', 'var den sitter');
    await m.klicka(page.locator('#if-form [type="submit"]'), 'Registrera');
    await synlig(page, '.notis', 'är registrerad');
    await synlig(page, '.if-lista', 'Höger handrygg');
  };
  // Restjournalen är en PDF med textlager och patientens personnummer, som från en skanner med OCR. Sidnumret gör varje
  // fil unik, så att flödet kan göras flera gånger i samma sandlåda.
  const restjournalPdf = () => {
    const strom = 'BT /F1 11 Tf 50 790 Td (Journalanteckning, pappersjournal) Tj 0 -16 Td (Gunnar Akesson 19450202-4732) Tj 0 -16 Td (1999-05-03 Mottagningsbesok.) Tj 0 -16 Td (Sida ' + Date.now() + ') Tj ET';
    const delar = ['%PDF-1.4', '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj', '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj', `4 0 obj << /Length ${strom.length} >>\nstream\n${strom}\nendstream endobj`, 'trailer << /Root 1 0 R >>', '%%EOF'];
    return Buffer.from(delar.join('\n'), 'latin1');
  };
  GOR['skanna-restjournal'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Restjournaler' }), 'fliken Restjournaler');
    await page.waitForSelector('#rj-fil');
    const [val] = await Promise.all([page.waitForEvent('filechooser'), m.klicka(page.locator('#rj-fil'), 'Skannat dokument')]);
    await val.setFiles({ name: 'restjournal-1999.pdf', mimeType: 'application/pdf', buffer: restjournalPdf() });
    await synlig(page, '#rj-forslag', 'Personnumret i dokumentet är patientens');
    await m.klicka(page.locator('#rj-form [type="submit"]'), 'Spara restjournalen');
    await synlig(page, '.notis', 'Restjournalen är inskannad');
  };
  startI['Inkorgen med ett förslag om donation'] = async (page) => {
    await gaTill(page, '#/arbetslista');
    const ok = await page.evaluate(async () => {
      const post = (vag, data = {}) => fetch(vag, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.ok);
      await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text());
      return await post('/api/demo/donation') && await post('/api/patient/p10/dodsfall', { kriterier: 'direkta' });
    });
    if (!ok) throw new Error('Demoläget för donation kunde inte skapas inför flödet');
    await gaTill(page, '#/inkorg');
    await page.locator('section[aria-labelledby="ik-donation"] li', { hasText: 'Möjlig donator' }).waitFor();
  };
  GOR['starta-donation'] = async (m, page) => {
    await m.klicka(page.locator('section[aria-labelledby="ik-donation"] li a', { hasText: 'Möjlig donator' }), 'förslaget Möjlig donator i inkorgen');
    await page.waitForSelector('[data-dn-starta]');
    await m.klicka(page.locator('[data-dn-starta]'), 'Starta donationsutredning');
    await synlig(page, '.notis', 'Donationsutredningen är startad');
    await synlig(page, '.dn-lista', 'Donationsregistret kontrollerat');
  };
  // Runda 9, r7: koden på armbandet hämtas utan att räknas, och skannas sedan i fältet Skanna.
  GOR['skanna-armband'] = async (m, page) => {
    const kod = await page.evaluate(() => fetch('/api/patient/p01/armband', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json()).then(x => x.kod));
    await m.skriv(page.locator('#skanna-falt'), kod, 'skanna armbandet');
    await m.tangent('Enter', 'läsarens Enter');
    await synlig(page, '.patientband h1', 'Gunnar Åkesson');
  };
  GOR['patientgrupp'] = async (m, page) => {
    await m.klicka(page.locator('#meny a', { hasText: 'Analys och statistik' }), 'Analys och statistik');
    await page.waitForSelector('[data-grupp]');
    await m.klicka(page.locator('[data-grupp] [type="submit"]'), 'Visa gruppen');
    await synlig(page, '[data-grupp-ut]', 'Birgitta');
  };
  // Runda 10, r2: utskrift av en anteckning, överkänslighet och sökning över patienter.
  GOR['skriv-ut-anteckning'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: /^Journal$/ }), 'fliken Journal');
    await m.klicka(page.locator('[data-skriv-ut-anteckning]'), 'Skriv ut anteckningen');
    await m.klicka(page.locator('dialog [data-varde="ok"]'), 'Skriv ut');
    await synlig(page, '.utskrift-ram', 'Journalanteckningar');
    await page.locator('.utskrift-ram [data-stang]').evaluate(b => b.click());
  };
  GOR['registrera-overkanslighet'] = async (m, page) => {
    await m.klicka(page.locator('.signal-um summary'), 'uppmärksamhetsraden');
    await m.klicka(page.locator('[data-ok-ny]').first(), 'Ny överkänslighet');
    await m.skriv(page.locator('#ok-amne'), 'ibuprofen', 'ämnet');
    await m.skriv(page.locator('#ok-reaktion'), 'Andningsbesvär', 'reaktionen');
    await synlig(page, '[data-ok-forslag]', 'M01AE01');
    await m.klicka(page.locator('dialog [data-varde="ok"]'), 'Registrera');
    await synlig(page, '.notis', 'ATC-kod M01AE01');
  };
  GOR['sok-journaler'] = async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/sok"]'), 'Sök patient i menyn');
    await m.skriv(page.locator('#journalerfalt'), 'förmaksflimmer', 'Sök i journalerna');
    await m.tangent('Enter', 'sök');
    await synlig(page, '#journalertraffar', 'Söker patienter med');
  };
  // Runda 10, r6: en konsultation skickas från samma formulär som en remiss, med ett klick på Fråga om råd.
  GOR['skicka-konsultation'] = async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Skicka remiss' }), 'Skicka remiss');
    await page.waitForSelector('#remissform');
    await m.klicka(page.locator('#rf-typ-konsultation'), 'Fråga om råd, vårdansvaret stannar hos oss');
    await m.valj(page.locator('select[name="tillEnhetId"]'), 'uso-kard', 'mottagare Kardiologiska kliniken');
    await m.skriv(page.locator('textarea[name="fragestallning"]'), 'Blåsljud utan symtom. Behöver hon följas upp?', 'frågeställning');
    await m.skriv(page.locator('textarea[name="anamnes"]'), 'Nyupptäckt systoliskt blåsljud.', 'anamnes');
    await m.klicka(page.locator('#remissform [type="submit"]'), 'Skicka');
    await synlig(page, '.notis', 'Konsultationen är skickad');
  };
  // Runda 10, r5: läkemedelsberättelsen, vaccinationen, sammanhållen journalföring och ankomsten till akuten.
  const efterAterstallning = async (page, hash, vanta) => {
    await gaTill(page, '#/arbetslista');
    await page.evaluate(() => fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
    await gaTill(page, hash);
    await page.waitForSelector(vanta);
  };
  startI['Översikten för den inlagda patienten efter återställning'] = (page) => efterAterstallning(page, '#/patient/p01', '.tidslinje');
  startI['Väntrummet efter återställning'] = (page) => efterAterstallning(page, '#/vantrum', '.akut-tavla');
  GOR['lakemedelsberattelse'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Läkemedel' }), 'fliken Läkemedel');
    await page.waitForSelector('[data-ov-skicka]');
    await m.klicka(page.locator('[data-ov-skicka]'), 'Skicka läkemedelsberättelsen');
    await synlig(page, '.notis', 'är skickade till Vårdcentralen Tybble');
  };
  GOR['vaccination-riskgrupp'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Vaccinationer' }), 'fliken Vaccinationer');
    await page.waitForSelector('[data-vp-ge="pneumokocker"]');
    await m.klicka(page.locator('[data-vp-ge="pneumokocker"]'), 'Ge dosen');
    await page.locator('dialog[open] [data-varde="ok"]').waitFor();
    // Runda 13, r4: kontrollen före vaccinationen.
    await m.klicka(page.locator('dialog[open] #vp-k-ja'), 'patienten är frisk i dag');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera dosen');
    await synlig(page, '.notis', 'rapporterad till vaccinationsregistret');
  };
  GOR['sammanhallen'] = async (m, page) => {
    await page.waitForSelector('.sj-form');
    await m.klicka(page.locator('.sj-form [data-sj-samtycke]'), 'patienten samtycker');
    await m.klicka(page.locator('.sj-form [type="submit"]'), 'Hämta uppgifter');
    await synlig(page, '.tidslinje', 'Annan vårdgivare');
  };
  GOR['akut-ankomst'] = async (m, page) => {
    await m.klicka(page.locator('[data-ak="ankomst"]'), 'Ny ankomst');
    await page.locator('dialog[open] #ak-sok').waitFor();
    await m.skriv(page.locator('dialog[open] #ak-sok'), '19660319-3373', 'personnumret');
    await m.skriv(page.locator('dialog[open] #ak-orsak'), 'Bröstsmärta', 'kontaktorsaken');
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera ankomsten');
    await synlig(page, '.notis', 'Ankomsten är registrerad');
    await synlig(page, '.akut-tavla', 'Bröstsmärta');
  };
  // Runda 10, r3: röstinmatningen med en simulerad taligenkänning, som ger det som sägs som slutliga resultat. Inget
  // sparas förrän läkaren signerar: skriptet kontrollerar att ingen anteckning skickas till servern under dikteringen.
  GOR.diktera = async (m, page) => {
    await page.evaluate((fraser) => {
      // Igenkänningen görs på enheten (processLocally), så ingen fråga om webbläsarens tjänst kommer.
      window.__vkTaligenkanning = class {
        static available(o) { return Promise.resolve(o?.processLocally ? 'available' : 'unavailable'); }
        start() {
          let i = 0;
          const nasta = () => {
            if (this.stopp || i >= fraser.length) return;
            this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: fraser[i++] }, isFinal: true, length: 1 }] });
            setTimeout(nasta, 80);
          };
          setTimeout(nasta, 80);
        }
        stop() { this.stopp = true; setTimeout(() => this.onend?.(), 0); }
        abort() { this.stopp = true; }
      };
    }, ['pigg och äter bra punkt inga bröstsmärtor punkt', 'gå till bedömning stabil kommatecken fortsatt plan punkt', 'sluta diktera']);
    const skickat = [];
    const lyssna = (r) => { if (r.method() !== 'GET' && /\/api\/(patient\/[^/]+\/anteckningar|anteckning\/)/.test(r.url())) skickat.push(r.url()); };
    page.on('request', lyssna);
    try {
      await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
      await page.waitForSelector('#ant-form [data-diktera]');
      await m.klicka(page.locator('#ant-form [data-diktera]'), 'Diktera');
      await synlig(page, '#ant-form [data-diktat]', 'Dikteringen är klar');
      if (await page.locator('textarea[data-sokord="Aktuellt"]').inputValue() !== 'Pigg och äter bra. Inga bröstsmärtor.') throw new Error('det dikterade hamnade inte i Aktuellt');
      if (await page.locator('textarea[data-sokord="Bedömning"]').inputValue() !== 'Stabil, fortsatt plan.') throw new Error('det dikterade hamnade inte i Bedömning');
      if (skickat.length) throw new Error(`något skickades till servern under dikteringen: ${skickat.join(', ')}`);
    } finally { page.off('request', lyssna); }
    await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
    await synlig(page, '.anteckning', 'Pigg och äter bra. Inga bröstsmärtor.');
    await synlig(page, '.anteckning .sokord', 'Dikterad');
    await synlig(page, '.anteckning .ant-fakta', 'Signerad');
  };
  // Runda 10, r3: rättstavningen föreslår den medicinska termen under fältet.
  GOR.stavning = async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
    await page.waitForSelector('#ant-form');
    await m.skriv(page.locator('textarea[data-sokord="Aktuellt"]'), 'Hosta och feber sedan tre dagar. Misstänkt pnemoni.', 'sökordet Aktuellt');
    await m.klicka(page.locator('.stavning [data-byt]', { hasText: 'Byt till pneumoni' }), 'Byt till pneumoni');
    await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
    await synlig(page, '.anteckning', 'Misstänkt pneumoni.');
  };
  // Runda 10, r3: sårdokumentationen med kroppsbilden. Klicket görs på höger häl i vyn bakifrån.
  GOR['formular-sar'] = async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Ny anteckning' }), 'Ny anteckning');
    await page.waitForSelector('#ant-form');
    await m.valj(page.locator('#ny-mall'), 'Sårdokumentation', 'mallen Sårdokumentation');
    await page.waitForSelector('[data-formular="sar"] svg.fm-kropp[data-vy="bak"]');
    await page.waitForFunction(() => document.querySelector('#fm-vikt')?.value);
    const bak = page.locator('svg.fm-kropp[data-vy="bak"]');
    const ruta = await bak.boundingBox();
    await m.klicka({ waitFor: (o) => bak.waitFor(o), click: () => bak.click({ position: { x: ruta.width * 0.56, y: ruta.height * 0.95 } }) }, 'höger häl i kroppsbilden');
    await m.skriv(page.locator('[data-bildfalt="lage"] [data-markering] input').first(), 'Rodnad som inte bleknar', 'beskrivningen av markeringen');
    await m.klicka(page.locator('#fm-sartyp-trycksar'), 'Trycksår');
    await m.skriv(page.locator('#fm-langd'), '2', 'längden');
    await m.skriv(page.locator('#fm-bredd'), '1,5', 'bredden');
    await m.klicka(page.locator('.ant-form [data-signera]'), 'Signera');
    await synlig(page, '.anteckning', 'höger häl: Rodnad som inte bleknar');
    await synlig(page, '.anteckning', 'Vikt: 81,6 kg (förifyllt av systemet)');
    await page.waitForSelector('.anteckning .fm-las svg .fm-markering');
  };
  // Runda 10, r3: formulärbyggaren. Förslaget gäller först när en annan systemförvaltare har godkänt det.
  startI['Systemförvaltarens formulär'] = async (page) => { await gaTill(page, '#/formular'); await page.waitForSelector('#fb-lista [data-nytt]'); };
  GOR['bygga-formular'] = async (m, page) => {
    await m.klicka(page.locator('#fb-lista [data-nytt]'), 'Nytt formulär');
    await page.waitForSelector('.fb-form');
    await m.skriv(page.locator('#fb-namn'), 'Munhälsa', 'namnet');
    await m.skriv(page.locator('#fb-0-fraga'), 'Har patienten ont i munnen?', 'första frågan');
    await m.klicka(page.locator('[data-ny-fraga]'), 'Lägg till fråga');
    await m.skriv(page.locator('#fb-1-fraga'), 'Behöver patienten hjälp med munvården?', 'andra frågan');
    await synlig(page, '[data-forhand]', 'Formuläret går att använda');
    await m.klicka(page.locator('[data-foresla]'), 'Föreslå formuläret');
    await m.skriv(page.locator('#fb-motivering'), 'Munhälsan dokumenteras på samma sätt på alla avdelningar.', 'motiveringen');
    await m.klicka(page.locator('dialog [data-varde="ok"]'), 'Föreslå');
    await synlig(page, '.notis', 'Formuläret är föreslaget');
    await synlig(page, '#fb-lista', 'Munhälsa');
  };
  // Runda 10, r7: meddelanden från invånare, kontorsstödet, kapaciteten, kassan och ombudet.
  GOR['fornya-recept'] = async (m, page) => {
    await m.klicka(page.locator('#meny a', { hasText: 'Meddelanden' }), 'Meddelanden');
    await page.waitForSelector('#md-tabell');
    await m.klicka(page.locator('#md-tabell tr', { hasText: 'Förnya ett recept' }).locator('a').first(), 'patientens begäran');
    await page.waitForSelector('[data-md-utfall="fornyat"]');
    await m.klicka(page.locator('[data-md-utfall="fornyat"]'), 'Receptet är förnyat');
    await synlig(page, '.notis', 'Receptet är förnyat');
  };
  GOR['kalenderprenumeration'] = async (m, page) => {
    await m.klicka(page.locator('#meny a', { hasText: 'Kontorsstöd' }), 'Kontorsstöd');
    await page.waitForSelector('#kal-skapa');
    await m.klicka(page.locator('#kal-skapa'), 'Skapa kalenderlänk');
    await page.waitForSelector('#kal-adress');
  };
  GOR['svara-meddelande'] = async (m, page) => {
    await m.klicka(page.locator('#meny a', { hasText: 'Meddelanden' }), 'Meddelanden');
    await page.waitForSelector('#md-tabell');
    await m.klicka(page.locator('#md-tabell tr', { hasText: 'En fråga till vården' }).locator('a').first(), 'meddelandet');
    await page.waitForSelector('#md-text');
    await m.skriv(page.locator('#md-text'), 'Ja, ta dem som vanligt.', 'svaret');
    await m.klicka(page.locator('[data-md="svara-avsluta"]'), 'Svara och avsluta');
    await synlig(page, '.notis', 'Svaret är skickat och ärendet avslutat');
  };
  GOR['kapacitetsprognos'] = async (m, page) => {
    await m.klicka(page.locator('#meny a', { hasText: 'Kapacitet' }), 'Kapacitet');
    await page.waitForSelector('#kap-grupper');
  };
  // Kassan med en betalning i dag: en patient checkas in och betalar med kort innan stegen räknas.
  startI['Kassan'] = async (page) => {
    await page.evaluate(() => fetch('/api/demo/kassa-besok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
    await gaTill(page, '#/kassa');
    await page.waitForSelector('#kassa-avslut');
  };
  GOR['dagsavslut'] = async (m, page) => {
    await m.klicka(page.locator('#kassa-avslut'), 'Gör dagsavslut');
    await page.waitForSelector('#kassa-avsluta-ok');
    await m.klicka(page.locator('#kassa-avsluta-ok'), 'Stäm av och avsluta');
    await synlig(page, '.notis', 'Dagsavslutet är gjort');
  };
  startI['Min journal för ombudet'] = async (page) => { await gaTill(page, '#/min'); await page.waitForSelector('[data-ombud]'); };
  GOR['skicka-meddelande'] = async (m, page) => {
    await m.klicka(page.locator('.min-flikar a', { hasText: /^Meddelanden$/ }), 'fliken Meddelanden');
    await page.waitForSelector('#mn-text');
    await m.skriv(page.locator('#mn-text'), 'Kan jag ta med min fru på besöket?', 'meddelandet');
    await m.klicka(page.locator('#min-nytt [type="submit"]'), 'Skicka');
    await synlig(page, '.notis', 'Meddelandet är skickat');
  };
  GOR['ombud-boka'] = async (m, page) => {
    await m.klicka(page.locator('[data-ombud="p01"]'), 'Gunnar Åkesson');
    await page.waitForSelector('[data-min="boka"]');
    await m.klicka(page.locator('[data-min="boka"]').first(), 'Visa lediga tider');
    await page.locator('dialog[open] .forslag-knapp').first().waitFor();
    await m.klicka(page.locator('dialog[open] .forslag-knapp').first(), 'den första föreslagna tiden');
    await synlig(page, '.notis', 'Din tid är bokad');
  };
  // Runda 11, r2: operationsplaneringen och förloppet på salen.
  // Runda 13, r4: dagens operationer är genomförda när dagen har gått. Flödet börjar då på nästa dag med en planerad
  // operation, så att det går att mäta när som helst på dygnet.
  startI['Operationsavdelningens program'] = async (page) => {
    const datum = await page.evaluate(async () => {
      const dag = (n) => new Date(Date.now() + n * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
      for (let n = 0; n < 7; n++) {
        const o = await fetch(`/api/operation/oversikt?datum=${dag(n)}`).then(r => r.json());
        if (o.salar?.some(s => s.operationer.some(x => x.status === 'planerad' && x.patient))) return dag(n);
      }
      return dag(0);
    });
    await gaTill(page, `#/operation/program?datum=${datum}`);
    await page.waitForSelector('.op-program');
  };
  GOR['planera-operation'] = async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/operation"]'), 'Operation i menyn');
    await page.waitForSelector('.op-flikar');
    await m.klicka(page.locator('.op-flikar a[href="#/operation/vantelista"]'), 'Väntelista');
    await page.waitForSelector('[data-planera]');
    await m.klicka(page.locator('[data-planera]').first(), 'Planera vid patienten som har väntat längst');
    await page.locator('dialog[open] [data-varde="ok"]').waitFor();
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Planera i systemets förslag');
    await synlig(page, '.notis', 'Operationen är planerad');
  };
  GOR['operation-in-sal'] = async (m, page) => {
    await m.klicka(page.locator('table.op-program tr', { hasText: 'Planerad' }).locator('a.patientlank').first(), 'patienten i dagens program');
    await page.waitForSelector('[data-op-handelse="in_sal"]');
    await m.klicka(page.locator('[data-op-handelse="in_sal"]'), 'In på sal');
    await page.locator('dialog[open] [data-varde="ok"]').waitFor();
    await m.klicka(page.locator('dialog[open] [data-varde="ok"]'), 'Registrera');
    await page.waitForSelector('.op-check');
  };
  // Runda 11, r3: demodata för mödrahälsovården och förlossningen läggs in i sandlådan innan stegen räknas.
  const obstetrikDemo = (page) => page.evaluate(() => fetch('/api/demo/obstetrik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.text()));
  startI['Graviditetsjournalen i vecka 30'] = async (page) => {
    await obstetrikDemo(page);
    await gaTill(page, '#/patient/obs1/graviditet');
    await page.waitForSelector('#gr-besok');
  };
  GOR['graviditet-besok'] = async (m, page) => {
    await m.skriv(page.locator('#gb-blodtryck'), '116/72', 'blodtrycket');
    await m.skriv(page.locator('#gb-vikt'), '73', 'vikten');
    await m.skriv(page.locator('#gb-sf'), '30', 'symfys-fundusmåttet');
    await m.skriv(page.locator('#gb-fosterljud'), '142', 'fosterljuden');
    await m.klicka(page.locator('#gr-besok [type="submit"]'), 'Spara besöket');
    await synlig(page, '.notis', 'Besöket är sparat');
  };
  startI['Förlossningens översikt'] = async (page) => {
    await obstetrikDemo(page);
    await gaTill(page, '#/forlossning');
    await page.waitForSelector('#forl-tabell');
  };
  GOR['ctg-bedomning'] = async (m, page) => {
    await m.klicka(page.locator('#forl-tabell a.patientlank', { hasText: 'Amanda Lindholm' }), 'Amanda Lindholm');
    await page.waitForSelector('#fp-ctg-bekrafta');
    await m.klicka(page.locator('#fp-ctg-bekrafta'), 'Bekräfta bedömningen');
    await synlig(page, '.notis', 'Bedömningen är dokumenterad');
  };
  // Runda 11, r4: cytostatika och blod för Annika Holmgren (p17), beredningen och Anna Viklunds rapport (p11).
  startI['Journalen för patienten med cytostatika'] = async (page) => { await gaTill(page, '#/patient/p17'); await page.waitForSelector('.patientband h1'); await page.waitForLoadState('networkidle'); };
  // Demoläget godkänner Annika Holmgrens kur i den egna sandlådan, så att det finns en dos att bereda.
  startI['Beredningsenheten med en godkänd kur'] = async (page) => {
    const ok = await page.evaluate(async () => (await fetch('/api/demo/cytostatika-kur', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).ok);
    if (!ok) throw new Error('Kuren kunde inte godkännas inför flödet');
    await gaTill(page, '#/nyheter');
  };
  startI['Min journal för patienten med cytostatika'] = async (page) => { await gaTill(page, '#/min/p11'); await page.waitForSelector('.min-band h1'); };
  GOR['cyto-godkann'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: /^Cytostatika$/ }), 'fliken Cytostatika');
    await page.waitForSelector('[data-cy-kur="godkann"]:not([disabled])');
    await m.klicka(page.locator('[data-cy-kur="godkann"]'), 'Godkänn kuren');
    await synlig(page, '.notis', 'Kuren är godkänd');
  };
  GOR['regim-godkann'] = async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/cytostatika"]'), 'Cytostatika i menyn');
    await page.waitForSelector('#cye-kurer');
    await m.klicka(page.locator('a[href="#/cytostatika/regimer"]'), 'Regimbiblioteket');
    await page.waitForSelector('[data-rb-godkann]');
    await m.klicka(page.locator('[data-rb-godkann]').first(), 'Godkänn versionen');
    await synlig(page, '.notis', 'gäller nu för nya ordinationer');
  };
  GOR['blod-bestall'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: /^Blod$/ }), 'fliken Blod');
    await page.waitForSelector('#bl-ny');
    await m.skriv(page.locator('#bl-indikation'), 'Anemi efter cytostatika, Hb 88', 'indikationen');
    await m.klicka(page.locator('#bl-ny [type="submit"]'), 'Beställ');
    await synlig(page, '.notis', 'Blodet är beställt');
  };
  GOR['cyto-bered'] = async (m, page) => {
    await m.klicka(page.locator('#meny-lista a[href="#/beredning"]'), 'Beredning i menyn');
    const forsta = page.locator('[data-bd-bered]').first();
    await forsta.waitFor();
    const hjalp = await forsta.locator('[id^="bd-mh-"]').textContent();
    const ml = hjalp.match(/Beräknat ([\d,]+) ml/)[1];
    await m.skriv(forsta.locator('[name="uppmattMl"]'), ml, 'den kontrollmätta volymen');
    await m.klicka(forsta.locator('[type="submit"]'), 'Signera beredningen');
    await synlig(page, '.notis', 'är beredd och signerad');
  };
  GOR['cyto-min-rapport'] = async (m, page) => {
    await m.klicka(page.locator('.min-flikar a', { hasText: /^Min behandling$/ }), 'fliken Min behandling');
    await page.waitForSelector('[data-min-cy]');
    await m.klicka(page.locator('[data-min-cy] [name="morgon"]'), 'morgonens tabletter');
    await m.klicka(page.locator('[data-min-cy] [type="submit"]'), 'Skicka till mottagningen');
    await synlig(page, '.notis', 'Fortsätt som vanligt');
  };
  // Runda 11, r5: bilder och media i journalen. Bilden är en PNG som byggs här, ett sår på huden.
  GOR['bild-fran-fil'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Bilder' }), 'fliken Bilder');
    await page.waitForSelector('#bm-fil');
    const [val] = await Promise.all([page.waitForEvent('filechooser'), m.klicka(page.locator('#bm-fil'), 'Fil från datorn eller mobilen')]);
    await val.setFiles({ name: 'sarfoto.png', mimeType: 'image/png', buffer: sarPng(640, 480) });
    await m.klicka(page.locator('#bm-form [type="submit"]'), 'Spara i journalen');
    await synlig(page, '.notis', 'Bilden är sparad i journalen');
  };
  GOR['jamfor-bilder'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Bilder' }), 'fliken Bilder');
    await m.klicka(page.locator('[data-jamfor="korsbenet"]'), 'Jämför bilder av korsbenet över tid');
    await synlig(page, '.bm-jamfor', 'bilder av korsbenet över');
  };
  GOR['bild-fran-apparat'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Bilder' }), 'fliken Bilder');
    await m.klicka(page.locator('.bm-import summary'), 'Från en apparat eller en annan vårdgivare');
    await m.klicka(page.locator('[data-apparat]'), 'Hämta från apparaten');
    await page.waitForSelector('.bm-granska [data-godkann]');
    await m.klicka(page.locator('.bm-granska [data-godkann]').first(), 'För in i journalen');
    await synlig(page, '.notis', 'Bilden är införd i journalen');
  };
  GOR['visa-studie'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Bilder' }), 'fliken Bilder');
    await m.klicka(page.locator('[data-studie]').first(), 'Visa bilderna');
    await page.waitForSelector('dialog[open] [data-fonster="Ben"]');
    await m.klicka(page.locator('dialog[open] [data-fonster="Ben"]'), 'fönstret Ben');
    await page.waitForFunction(() => document.querySelector('dialog[open] .bm-studie img')?.src.includes('window=2800,2000') && document.querySelector('dialog[open] .bm-studie img').complete);
  };
  // Runda 11, r6: en röntgenundersökning beställs i fliken Prover, och röntgenkliniken bokar den första i sin lista.
  GOR['bestall-undersokning'] = async (m, page) => {
    await m.klicka(page.locator('.snabbval a', { hasText: 'Beställ prover' }), 'Beställ prover');
    await page.waitForSelector('#pr-valj summary');
    await m.klicka(page.locator('#pr-valj summary'), 'Välj analyser');
    await m.klicka(page.locator('#pr-a-rtg_kna'), 'Röntgen knäled');
    await m.klicka(page.locator('[data-bestall-valda]'), 'Beställ');
    await synlig(page, '.notis', 'är beställt');
    await synlig(page, '#pr-lista .pr-best', 'Röntgen knäled');
  };
  startI['Röntgenklinikens undersökningar efter återställning'] = (page) => efterAterstallning(page, '#/undersokningar', '#us-boka');
  GOR['boka-undersokning'] = async (m, page) => {
    await page.waitForSelector('#us [data-boka]');
    await m.klicka(page.locator('#us [data-boka]').first(), 'Boka vid den första undersökningen');
    await synlig(page, '.notis', 'är bokad');
  };
  // Runda 14, r4: mellanarkivet och reservdatorn för läkemedel.
  GOR['las-mellanarkiv'] = async (m, page) => {
    await m.klicka(page.locator('.flikar a', { hasText: 'Journal' }).first(), 'fliken Journal');
    const rad = page.locator('#j-poster li a', { hasText: 'Ur mellanarkivet' }).first();
    await rad.waitFor();
    await m.klicka(rad, 'anteckningen Ur mellanarkivet');
    await synlig(page, '[data-mellanarkiv-kontroll]', 'Kontrollsumman visar');
  };
  startI['E-arkiv och gallring'] = async (page) => { await gaTill(page, '#/arkiv'); await page.waitForSelector('#ar-form'); };
  GOR['overfor-mellanarkiv'] = async (m, page) => {
    await m.klicka(page.locator('#ar-form label.val-rad', { hasText: 'Överföring till mellanarkiv' }), 'Överföring till mellanarkiv');
    await m.skriv(page.locator('#ar-dnr'), 'Arkiv 2026-777', 'diarienumret');
    await m.klicka(page.locator('#ar-form [type="submit"]'), 'Registrera beslutet');
    const kort = page.locator('[data-beslut]', { hasText: 'Arkiv 2026-777' }).first();
    await m.klicka(kort.locator('[data-underlag]'), 'Visa underlag');
    await m.klicka(kort.locator('[data-overfor]'), 'För över till mellanarkivet');
    await synlig(page, '.notis', 'överförda till mellanarkivet');
  };
  GOR['oppna-reservdator'] = async (m, page) => {
    await m.klicka(page.locator('.meny a[href="#/administrering"]'), 'Läkemedel att ge i menyn');
    await m.klicka(page.locator('[data-reservdator-lank] a'), 'Reservdator för läkemedel');
    await synlig(page, '#reservdator', 'inskrivna patienter');
  };
  return { synlig, gaTill, loggaIn, startI, GOR };
}

// Runda 11, r5: en PNG med ett sår på huden, för flödena och genomgången med bilder.
function sarPng(bredd = 64, hojd = 48) {
  const zlib = require('node:zlib');
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let x = 0xffffffff; for (const v of b) x = crcT[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const del = (typ, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(typ, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ra = Buffer.alloc((bredd * 3 + 1) * hojd);
  for (let y = 0; y < hojd; y++) {
    for (let x = 0; x < bredd; x++) {
      const i = y * (bredd * 3 + 1) + 1 + x * 3;
      const sar = ((x - bredd / 2) / (bredd * 0.3)) ** 2 + ((y - hojd / 2) / (hojd * 0.3)) ** 2 <= 1;
      ra[i] = sar ? 170 : 224; ra[i + 1] = sar ? 40 : 186; ra[i + 2] = sar ? 40 : 160;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(bredd, 0); ihdr.writeUInt32BE(hojd, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), del('IHDR', ihdr), del('IDAT', zlib.deflateSync(ra)), del('IEND', Buffer.alloc(0))]);
}

// Runda 13, r3: idDialog.
module.exports = { Matare, skapa, raknaISidan, sarPng, idDialog };
