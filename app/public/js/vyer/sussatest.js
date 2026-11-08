// Runda 7, r1: Sussas testfall med riktiga testpersoner (#/sussatest). Underlag för användartester senare: testfallen ur
// Bilaga F1:4, SUS-formuläret som en testperson fyller i efter ett testfall (mätning 3) och checklistan för
// expertgranskningen mot de sju dialogprinciperna i ISO 9241-110 (mätning 4), med poängen enligt Bilaga F1:2.
//
// Svaren sparas bara i den här webbläsaren (localStorage) och laddas ner som en fil. De innehåller ingen patientuppgift:
// deltagarkoden är en kort kod som testledaren hittar på, och en kommentar med sex siffror i rad tas inte emot.
import { esc, api, notis, vyRubrik, tal, tidpunkt, medKnapp, dialog, felNotis } from '../ui.js';
import { S, uppdateraInkorg, rita, far } from '../app.js';
import { SUS_SUSSA, SUS_SUSSA_KALLA, SUS_SKALA_SUSSA, susPoang, utvarderingspoang, DIALOGPRINCIPER, PRINCIPPOANG, PRINCIPSKALA, expertpoang, kodGiltig, kommentarGiltig, SPARAS, TESTROLLER, GALLRING_DAGAR } from '../sussa-formular.js';

export const namn = 'sussatest';

const NYCKEL = 'vk_sussatest';
const FORMAT = 'vardkallan-sussatest';
const GRUPPER = TESTROLLER.filter(r => r !== 'Användbarhetsexpert');

const tom = () => ({ format: FORMAT, version: 1, sus: [], expert: [] });
function lasa() {
  try { const d = JSON.parse(localStorage.getItem(NYCKEL) ?? 'null'); return d?.format === FORMAT ? d : tom(); } catch { return tom(); }
}
function spara(d) { try { localStorage.setItem(NYCKEL, JSON.stringify(d)); return true; } catch { return false; } }

function laddaNer(d) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify({ ...d, nedladdad: new Date().toISOString() }, null, 2)}\n`], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sussatest-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const medel = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export async function visa(main) {
  main.innerHTML = vyRubrik('Sussas testfall med testpersoner', 'SUS och expertgranskning enligt Sussas modell för att testa och utvärdera användbarhet.') + '<div id="st"><p class="tom">Hämtar testfallen.</p></div>';
  let k4 = null;
  try { k4 = (await api('/api/krav', { tyst: true })).krav.find(x => x.id === 'K4')?.sussaTestfall ?? null; } catch { k4 = null; }
  // Ett testfall kan spelas av flera roller, en rad per roll i resultatet.
  const perNr = new Map();
  for (const t of k4?.testfall ?? []) {
    const g = perNr.get(t.nr) ?? { nr: t.nr, titel: t.titel, slut: t.slut, roller: [], genomfors: true };
    g.roller.push(`${t.roll} (${t.demoroll})`);
    perNr.set(t.nr, g);
  }
  const testfall = k4 ? [...perNr.values(), ...k4.ejGenomforbara.map(t => ({ nr: t.nr, titel: t.titel, saknas: t.saknas, genomfors: false }))]
    .sort((a, b) => a.nr.localeCompare(b.nr, 'sv', { numeric: true })) : [];
  const el = main.querySelector('#st');
  const d = lasa();
  const inloggad = Boolean(S.session?.inloggad && S.session.personal);
  el.innerHTML = `<div class="ruta ruta-info st-info"><p><strong>Underlag för riktiga användartester senare.</strong> Inga testpersoner har fyllt i formulären än, och resultaten på kravsidan är skriptets mätning, inte en mätning med användare.</p></div>
    <section class="ruta st-sparas" aria-labelledby="st-sparas-rubrik">
      <h2 id="st-sparas-rubrik">Det här sparas när du svarar</h2>
      <p>${inloggad ? 'Med koden för testtillfället sparas svaren på servern, där bara testledaren kan läsa och exportera dem med samma kod. En kopia sparas i den här webbläsaren.' : 'Du är inte inloggad, så svaren sparas bara i den här webbläsaren. Logga in med demorollen för att spara dem på servern.'} Inga patientuppgifter och inte ditt namn sparas.</p>
      <ul>${SPARAS.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      ${inloggad ? '<div class="falt"><label for="st-tkod">Kod för testtillfället, från testledaren</label><input id="st-tkod" name="tkod" maxlength="100" autocomplete="off" spellcheck="false"></div>' : ''}
    </section>
    ${far('anvandartest_las') ? `<section class="ruta" aria-labelledby="st-tillfallen"><h2 id="st-tillfallen">Testtillfällen (testledare)</h2>
      <p class="liten">Skapa ett testtillfälle och ge koden till testpersonerna. Koden visas bara en gång. Svaren i ett tillfälle läses, exporteras och raderas bara med dess kod, så ingen annan testledare ser dem. Ett tillfälle tar emot högst 200 svar och raderas med alla svar ${GALLRING_DAGAR} dagar efter det senaste svaret. Ett tillfälle utan svar raderas efter 24 timmar. Du kan skapa högst 5 tillfällen i timmen och ha högst 20 aktiva tillfällen.</p>
      <p class="knapprad"><button type="button" class="knapp liten" data-st="skapa">Skapa testtillfälle</button></p>
      <div id="st-nykod"></div>
      <form id="st-oppna" class="falt-rad" novalidate><div class="falt"><label for="st-lkod">Kod för tillfället</label><input id="st-lkod" name="lkod" maxlength="100" autocomplete="off" spellcheck="false"></div><div class="falt knappfalt"><button type="submit" class="knapp liten">Visa svaren</button></div></form>
      <div id="st-serverlista"></div></section>` : ''}
    <section class="ruta" aria-labelledby="st-fall">
      <h2 id="st-fall">Testfallen</h2>
      <p class="liten">Testpersonen loggar in med demorollen, och testledaren lägger in testdatan före varje testfall, så att varje testfall börjar från samma läge. Testfallet börjar på rollens startsida och är slut när slutvillkoret syns.</p>
      ${inloggad ? `<p class="knapprad"><button type="button" class="knapp liten" data-st="testdata">Återställ demon och lägg in testdatan</button> <button type="button" class="knapp liten sekundar" data-st="testdata-avdelning">Lägg in avdelningens händelser för tema 7</button></p>` : '<p class="dampad liten">Logga in med en demoroll för att lägga in testdatan.</p>'}
      ${testfall.length ? `<div class="tabellrulle"><table class="tabell st-fall"><thead><tr><th scope="col">Testfall</th><th scope="col">Roll i demon</th><th scope="col">Slut när</th></tr></thead><tbody>
        ${testfall.map(t => `<tr><th scope="row">${esc(t.nr)} ${esc(t.titel)}</th><td>${t.genomfors ? esc(t.roller.join(', ')) : 'Kan inte genomföras'}</td><td class="liten">${esc(t.genomfors ? t.slut ?? '' : t.saknas ?? '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="tom liten">Testfallen kunde inte hämtas.</p>'}
    </section>
    <section class="ruta" aria-labelledby="st-sus-rubrik">
      <h2 id="st-sus-rubrik">SUS efter ett testfall (mätning 3)</h2>
      <p class="dampad liten">Påståendena är Sussas svenska formulering av System Usability Scale. Källa: ${esc(SUS_SUSSA_KALLA)}.</p>
      <form id="st-sus" novalidate>
        <div class="falt-rad">
          <div class="falt"><label for="st-kod">Pseudonym, som testledaren sätter</label><input id="st-kod" name="kod" maxlength="12" autocomplete="off" required></div>
          <div class="falt"><label for="st-testfall">Testfall</label><select id="st-testfall" name="testfall"><option value="alla">Alla testfall i testpaketet</option>${testfall.filter(t => t.genomfors).map(t => `<option value="${esc(t.nr)}">${esc(t.nr)} ${esc(t.titel)}</option>`).join('')}</select></div>
          <div class="falt"><label for="st-grupp">Roll i testet</label><select id="st-grupp" name="grupp">${GRUPPER.map(g => `<option>${esc(g)}</option>`).join('')}</select></div>
        </div>
        <ol class="sus-lista">${SUS_SUSSA.map((p, i) => `<li><fieldset class="sus"><legend>${esc(p)}</legend>
          <div class="sus-skala"><span class="sus-anda" aria-hidden="true">${esc(SUS_SKALA_SUSSA[1])}</span>
          ${[1, 2, 3, 4, 5].map(v => `<label class="sus-val"><input type="radio" name="sus${i + 1}" value="${v}"><span>${v}<span class="sr">${SUS_SKALA_SUSSA[v] ? `, ${esc(SUS_SKALA_SUSSA[v])}` : ''}</span></span></label>`).join('')}
          <span class="sus-anda" aria-hidden="true">${esc(SUS_SKALA_SUSSA[5])}</span></div></fieldset></li>`).join('')}</ol>
        <p class="st-poang" aria-live="polite">SUS-poäng: <strong data-st-sus>svara på alla tio</strong></p>
        <p class="form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="submit" class="knapp">Spara svaret</button></div>
      </form>
    </section>
    <section class="ruta" aria-labelledby="st-exp-rubrik">
      <h2 id="st-exp-rubrik">Expertgranskning mot ISO 9241-110 (mätning 4)</h2>
      <p class="dampad liten">Användbarhetsexperten bedömer systemet i sin helhet efter testerna. Varje dialogprincip får 10, 5, 2 eller 0 poäng, och summan av de sju omvandlas till utvärderingspoäng enligt Bilaga F1:2.</p>
      <form id="st-expert" novalidate>
        <div class="falt"><label for="st-granskare">Granskarens pseudonym</label><input id="st-granskare" name="kod" maxlength="12" autocomplete="off" required></div>
        <ol class="st-principer">${DIALOGPRINCIPER.map(p => `<li><fieldset><legend><strong>${esc(p.namn)}</strong></legend>
          <p class="liten">${esc(p.beskrivning)}</p>
          <ul class="liten st-fragor">${p.fragor.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          <div class="segment" role="radiogroup" aria-label="Poäng för ${esc(p.namn)}">${PRINCIPPOANG.map(v => `<input type="radio" id="st-p${p.nr}-${v}" name="p${p.nr}" value="${v}"><label for="st-p${p.nr}-${v}" title="${esc(PRINCIPSKALA[v])}">${v}</label>`).join('')}</div>
          <div class="falt"><label for="st-k${p.nr}">Kommentar</label><textarea id="st-k${p.nr}" name="k${p.nr}" rows="2" maxlength="1000"></textarea></div>
        </fieldset></li>`).join('')}</ol>
        <dl class="liten st-skala">${PRINCIPPOANG.map(v => `<div><dt>${v} poäng</dt><dd>${esc(PRINCIPSKALA[v])}</dd></div>`).join('')}</dl>
        <p class="st-poang" aria-live="polite">Summa: <strong data-st-expert>ge poäng för alla sju</strong></p>
        <p class="form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="submit" class="knapp">Spara granskningen</button></div>
      </form>
    </section>
    <section class="ruta" aria-labelledby="st-sparade"><h2 id="st-sparade">Sparade svar i den här webbläsaren</h2><div id="st-lista"></div></section>
`;

  const ritaLista = () => {
    const x = lasa();
    const susv = x.sus.map(s => s.poang);
    const m = medel(susv);
    const e = x.expert.at(-1);
    el.querySelector('#st-lista').innerHTML = `${x.sus.length ? `<div class="tabellrulle"><table class="tabell st-svar"><thead><tr><th scope="col">Deltagare</th><th scope="col">Testfall</th><th scope="col">Användargrupp</th><th scope="col" class="tal">SUS</th><th scope="col">Sparat</th></tr></thead><tbody>
        ${x.sus.map(s => `<tr><td>${esc(s.kod)}</td><td>${esc(s.testfall)}</td><td>${esc(s.grupp)}</td><td class="tal">${tal(s.poang, 1)}</td><td>${esc(tidpunkt(s.tid))}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="liten">Medelvärde SUS ${tal(m, 1)} av 100 från ${x.sus.length} ${x.sus.length === 1 ? 'svar' : 'svar'}, vilket ger ${utvarderingspoang('tillfredsstallelse', m)} utvärderingspoäng av 10 (godkänt är 70).</p>` : '<p class="tom liten">Inga SUS-svar är sparade i den här webbläsaren.</p>'}
      ${e ? `<p class="liten">Senaste expertgranskningen (${esc(e.kod)}, ${esc(tidpunkt(e.tid))}): summa ${e.summa} av 70, vilket ger ${e.utvarderingspoang} utvärderingspoäng av 10.</p>` : '<p class="tom liten">Ingen expertgranskning är sparad.</p>'}
      ${x.sus.length || x.expert.length ? '<div class="knapprad"><button type="button" class="knapp liten" data-st="ladda">Ladda ner som fil</button><button type="button" class="knapp liten sekundar" data-st="radera">Radera alla svar</button></div>' : ''}`;
  };
  ritaLista();

  // Svaret sparas på servern med koden för testtillfället, utan patientuppgifter. Servern prövar fälten och räknar poängen.
  // Koden hålls bara i fältet och sparas aldrig i webbläsaren.
  const tkod = () => el.querySelector('#st-tkod')?.value.trim() ?? '';
  const sparaServer = async (data) => {
    if (!tkod()) { notis('Svaret är sparat i den här webbläsaren. Skriv koden för testtillfället för att spara det på servern.', 'info'); return; }
    try {
      const r = await api('/api/anvandartest/svar', { metod: 'POST', data: { ...data, kod: tkod() } });
      notis(`Svaret för ${r.pseudonym} är sparat på servern: ${tal(r.poang, 1)} poäng, ${r.utvarderingspoang} utvärderingspoäng.`);
    } catch { /* felet visas som notis, och kopian finns i webbläsaren */ }
  };
  // Testledaren: skapa ett tillfälle, visa, exportera och radera med koden.
  const lkod = () => el.querySelector('#st-lkod')?.value.trim() ?? '';
  const ritaServer = async () => {
    const plats = el.querySelector('#st-serverlista');
    if (!plats || !lkod()) return;
    let d;
    try { d = await api('/api/anvandartest/svar/lista', { metod: 'POST', data: { kod: lkod() } }); } catch { plats.innerHTML = ''; return; }
    const s = d.sammanstallning;
    plats.innerHTML = `<p class="liten">Tillfälle ${esc(d.tillfalle.id)}, skapat ${esc(tidpunkt(d.tillfalle.skapad))}. ${d.tillfalle.antalSvar} av högst ${d.tillfalle.maxSvar} svar. Raderas ${esc(d.tillfalle.raderas)} om inget mer svar kommer.</p>
      ${d.svar.length ? `<div class="tabellrulle"><table class="tabell st-serversvar"><thead><tr><th scope="col">Pseudonym</th><th scope="col">Roll</th><th scope="col">Datum</th><th scope="col">Testfall</th><th scope="col">Typ</th><th scope="col" class="tal">Poäng</th></tr></thead><tbody>
        ${d.svar.map(r => `<tr><td>${esc(r.pseudonym)}</td><td>${esc(r.roll)}</td><td>${esc(r.datum)}</td><td>${esc(r.testfall)}</td><td>${r.typ === 'sus' ? 'SUS' : 'Expertgranskning'}</td><td class="tal">${tal(r.poang, 1)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="tom liten">Inga svar i tillfället än.</p>'}
      <p class="liten">SUS: ${s.sus.antal} svar${s.sus.medel != null ? `, medelvärde ${tal(s.sus.medel, 1)}, ${s.sus.utvarderingspoang} utvärderingspoäng` : ''}. Expertgranskning: ${s.expert.antal}${s.expert.senaste ? `, den senaste ${s.expert.senaste.summa} av 70, ${s.expert.senaste.utvarderingspoang} utvärderingspoäng` : ''}.</p>
      <p class="knapprad"><button type="button" class="knapp liten" data-st="export" data-format="csv">Exportera som CSV</button><button type="button" class="knapp liten sekundar" data-st="export" data-format="json">Exportera som JSON</button><button type="button" class="knapp liten sekundar" data-st="radera-tillfalle">Radera tillfället</button></p>`;
  };
  el.querySelector('#st-oppna')?.addEventListener('submit', (e) => { e.preventDefault(); ritaServer(); });
  const exportera = async (format) => {
    const r = await fetch('/api/anvandartest/svar/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kod: lkod(), format }) });
    if (!r.ok) { notis('Exporten gick inte. Kontrollera koden.', 'fel'); return; }
    const namnet = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? `anvandartester.${format}`;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = namnet; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const susForm = el.querySelector('#st-sus');
  const susSvar = () => Array.from({ length: 10 }, (_, i) => Number(susForm.querySelector(`[name="sus${i + 1}"]:checked`)?.value ?? NaN));
  susForm.addEventListener('change', () => {
    const p = susPoang(susSvar());
    el.querySelector('[data-st-sus]').textContent = p == null ? 'svara på alla tio' : `${tal(p, 1)} av 100, ${utvarderingspoang('tillfredsstallelse', p)} utvärderingspoäng`;
  });
  const fel = (form, text) => { const f = form.querySelector('.form-fel'); f.textContent = text ?? ''; f.hidden = !text; };
  susForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const kod = susForm.kod.value.trim();
    if (!kodGiltig(kod)) return fel(susForm, 'Skriv en kort deltagarkod med bokstäver och siffror, till exempel L03. Sex siffror i rad tas inte emot, så att inget personnummer sparas.');
    const p = susPoang(susSvar());
    if (p == null) return fel(susForm, 'Svara på alla tio påståenden.');
    fel(susForm, null);
    const x = lasa();
    x.sus.push({ kod, testfall: susForm.testfall.value, grupp: susForm.grupp.value, svar: susSvar(), poang: p, tid: new Date().toISOString() });
    if (inloggad) sparaServer({ typ: 'sus', roll: susForm.grupp.value, pseudonym: kod, testfall: susForm.testfall.value, svar: susSvar() });
    const ok = spara(x);
    notis(ok ? `SUS-svaret för ${kod} är sparat: ${tal(p, 1)} av 100.` : 'Svaret kunde inte sparas i den här webbläsaren.', ok ? 'ok' : 'fel');
    susForm.reset();
    el.querySelector('[data-st-sus]').textContent = 'svara på alla tio';
    ritaLista();
  });

  const expForm = el.querySelector('#st-expert');
  const expPoang = () => DIALOGPRINCIPER.map(p => Number(expForm.querySelector(`[name="p${p.nr}"]:checked`)?.value ?? NaN));
  expForm.addEventListener('change', () => {
    const r = expertpoang(expPoang());
    el.querySelector('[data-st-expert]').textContent = r ? `${r.summa} av 70, ${r.poang} utvärderingspoäng` : 'ge poäng för alla sju';
  });
  expForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const kod = expForm.kod.value.trim();
    if (!kodGiltig(kod)) return fel(expForm, 'Skriv en kort kod för granskaren, till exempel E01. Sex siffror i rad tas inte emot.');
    const r = expertpoang(expPoang());
    if (!r) return fel(expForm, 'Ge poäng för alla sju dialogprinciper.');
    const kommentarer = DIALOGPRINCIPER.map(p => expForm[`k${p.nr}`].value.trim());
    if (!kommentarer.every(kommentarGiltig)) return fel(expForm, 'En kommentar har sex siffror i rad. Skriv inga personnummer eller andra patientuppgifter.');
    fel(expForm, null);
    if (inloggad) sparaServer({ typ: 'expert', roll: 'Användbarhetsexpert', pseudonym: kod, testfall: 'alla', svar: DIALOGPRINCIPER.map((pr, i) => ({ nr: pr.nr, poang: expPoang()[i], kommentar: kommentarer[i] })) });
    const x = lasa();
    x.expert.push({ kod, principer: DIALOGPRINCIPER.map((p, i) => ({ nr: p.nr, namn: p.namn, poang: expPoang()[i], kommentar: kommentarer[i] })), summa: r.summa, utvarderingspoang: r.poang, tid: new Date().toISOString() });
    const ok = spara(x);
    notis(ok ? `Granskningen är sparad: ${r.summa} av 70.` : 'Granskningen kunde inte sparas i den här webbläsaren.', ok ? 'ok' : 'fel');
    expForm.reset();
    el.querySelector('[data-st-expert]').textContent = 'ge poäng för alla sju';
    ritaLista();
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-st]');
    if (!b) return;
    if (b.dataset.st === 'ladda') laddaNer(lasa());
    else if (b.dataset.st === 'radera') { spara(tom()); notis('Alla sparade svar är raderade i den här webbläsaren.'); ritaLista(); }
    else if (b.dataset.st === 'skapa') {
      try {
        const t = await medKnapp(b, () => api('/api/anvandartest/tillfallen', { metod: 'POST', data: {} }));
        el.querySelector('#st-nykod').innerHTML = `<div class="ruta ruta-info"><p>Testtillfälle ${esc(t.id)} är skapat. Koden visas bara nu. Skriv ner den och ge den till testpersonerna:</p><p><code class="st-kod" data-st-kod>${esc(t.kod)}</code></p></div>`;
        el.querySelector('#st-lkod').value = t.kod;
        ritaServer();
      } catch { /* felet visas som notis */ }
    }
    else if (b.dataset.st === 'export') { try { await exportera(b.dataset.format); } catch (err) { felNotis(err); } }
    else if (b.dataset.st === 'radera-tillfalle') {
      const svar = await dialog(`<h2 id="dlg-rubrik">Radera testtillfället?</h2><p>Tillfället och alla dess svar raderas på servern och går inte att få tillbaka. Exportera svaren först om de behövs.</p><div class="knapprad"><button type="button" class="knapp" data-varde="ok">Radera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>`);
      if (svar?.val !== 'ok') return;
      try {
        const r = await api('/api/anvandartest/tillfalle/radera', { metod: 'POST', data: { kod: lkod() } });
        notis(`Testtillfället är raderat med ${r.raderadeSvar} svar.`);
        el.querySelector('#st-lkod').value = '';
        el.querySelector('#st-nykod').innerHTML = '';
        el.querySelector('#st-serverlista').innerHTML = '';
      } catch { /* felet visas som notis */ }
    }
    // Runda 8, r3: tema 7 behöver fler inskrivna patienter, som inte ska finnas i de andra testfallen.
    else if (b.dataset.st === 'testdata-avdelning') {
      try {
        await medKnapp(b, async () => { await api('/api/reset', { metod: 'POST', data: {} }); await api('/api/demo/sussa-testfall', { metod: 'POST', data: {} }); await api('/api/demo/sussa-avdelning', { metod: 'POST', data: {} }); });
        notis('Demon är återställd och testdatan för tema 7 är inlagd: patienterna på avdelningen och deras planerade händelser.');
        await uppdateraInkorg();
        rita();
      } catch { /* felet visas som notis */ }
    }
    else if (b.dataset.st === 'testdata') {
      try {
        await medKnapp(b, async () => { await api('/api/reset', { metod: 'POST', data: {} }); await api('/api/demo/sussa-testfall', { metod: 'POST', data: {} }); });
        notis('Demon är återställd och Sussas testpatienter är inlagda.');
        await uppdateraInkorg();
        rita();
      } catch { /* felet visas som notis */ }
    }
  });
}
