// Graviditetsjournalen i patientens journal (runda 11, r3, Sussa 4.7.1.1 och 4.7.1.2): inskrivningen, beräknad partus,
// riskbedömningen med beslutsstöd, besöksprogrammet och provschemat, besöken med symfys-funduskurvan,
// ultraljudsjournalen, inskrivningssamtalet med de känsliga frågorna om våld, efterkontrollen och Graviditetsregistret.
// Fliken Nyfödd är barnets BB-journal med kontroller och screening. Systemet räknar, föreslår och varnar; barnmorskan
// fyller bara i det som bara hon kan veta.
import { esc, api, datum, tidpunkt, notis, medKnapp, ikon, dialog, tal } from '../ui.js';
import { far, S, minVardenhet } from '../app.js';
import { varningar, attGora, sfSvg } from '../obstetrik-ui.js';

const enc = encodeURIComponent;
const val = (lista, valt = null) => lista.map(([v, t]) => `<option value="${esc(v)}"${v === valt ? ' selected' : ''}>${esc(t)}</option>`).join('');
const TOBAK = [['aldrig', 'Har aldrig använt'], ['slutat_fore', 'Slutade före graviditeten'], ['slutat_under', 'Slutade när graviditeten blev känd'], ['ja', 'Använder nu']];
const ANAMNES = [['tidigareGdm', 'Graviditetsdiabetes i en tidigare graviditet'], ['tidigarePreeklampsi', 'Havandeskapsförgiftning i en tidigare graviditet'],
  ['arftlighetDiabetes', 'Diabetes hos förälder eller syskon'], ['forlossningsradsla', 'Rädsla inför förlossningen']];
const VALDFRAGOR = [['tidigare', 'Har du någon gång blivit utsatt för våld, hot eller kränkningar av någon som står dig nära?'], ['nu', 'Är du utsatt för våld, hot eller kränkningar nu?'], ['radd', 'Känner du dig rädd för någon i din närhet?']];
const VALDSVAR = [['nej', 'Nej'], ['ja', 'Ja'], ['vill_ej', 'Vill inte svara']];
const EJ_ORSAK = [['inte_ensam', 'Kvinnan var inte ensam vid besöket'], ['tolk_narstaende', 'Tolken var en närstående'], ['annat', 'Annat skäl']];
const SMARTLINDRING = [['bad', 'Varmt bad'], ['lustgas', 'Lustgas'], ['tens', 'TENS'], ['akupunktur', 'Akupunktur'], ['sterilvatten', 'Sterilvattenkvaddlar'], ['eda', 'Epiduralbedövning (EDA)']];
const UL_TYP = [['rutin', 'Rutinultraljud'], ['kub', 'Tidigt ultraljud (KUB)'], ['tillvaxt', 'Tillväxtultraljud'], ['ovrigt', 'Annat ultraljud']];
const PLACENTA = [['', 'Inte bedömt'], ['framvagg', 'Framväggen'], ['bakvagg', 'Bakväggen'], ['fundus', 'Fundus'], ['lagt', 'Lågt sittande'], ['foreliggande', 'Föreliggande']];
const FOSTERVATTEN = [['', 'Inte bedömt'], ['normalt', 'Normal mängd'], ['lite', 'Lite fostervatten'], ['mycket', 'Mycket fostervatten']];
const BERUSNING = [['aldrig', 'Aldrig'], ['sallan', 'Mer sällan än en gång i månaden'], ['manad', 'Varje månad'], ['vecka', 'Varje vecka'], ['dagligen', 'Dagligen eller nästan dagligen']];
const AMNING = [['helt', 'Helamning'], ['delvis', 'Delvis amning'], ['ingen', 'Ingen amning']];
const BLODNING = [['ingen', 'Ingen blödning'], ['lite', 'Lite blödning'], ['mycket', 'Riklig blödning']];
const tom = (v) => (v === '' || v == null ? undefined : v);
const fel = '<p class="form-fel" role="alert" hidden></p>';

function registreraHtml() {
  return `<form id="gr-ny" class="ob-form" novalidate aria-labelledby="gr-ny-r"><h3 id="gr-ny-r">Skriv in graviditeten</h3>
    <p class="hjalp">Systemet räknar beräknad partus, besöksprogrammet, provschemat och risken ur det du fyller i och ur journalen.</p>
    <div class="falt-rad"><div class="falt"><label for="gr-sm">Första dagen i sista mens</label><input id="gr-sm" name="sistaMens" type="date"></div>
      <div class="falt"><label for="gr-antal">Antal foster</label><select id="gr-antal" name="antalFoster">${val([['1', '1'], ['2', '2, tvillingar'], ['3', '3']], '1')}</select></div>
      <div class="falt"><label for="gr-par">Tidigare förlossningar</label><input id="gr-par" name="paritet" type="number" min="0" max="15" value="0" inputmode="numeric"></div>
      <div class="falt"><label for="gr-ks">Varav kejsarsnitt</label><input id="gr-ks" name="tidigareKejsarsnitt" type="number" min="0" max="15" value="0" inputmode="numeric"></div></div>
    <fieldset class="ob-falt"><legend>IVF</legend><div class="kryssfalt"><input type="checkbox" id="gr-ivf" name="ivf"><label for="gr-ivf">IVF-graviditet. Beräknad partus räknas då från embryoöverföringen.</label></div>
      <div class="falt-rad"><div class="falt"><label for="gr-et">Embryoöverföringen</label><input id="gr-et" name="overforing" type="date"></div>
      <div class="falt"><label for="gr-ed">Embryots ålder</label><select id="gr-ed" name="embryoDagar">${val([['5', 'Dag 5'], ['3', 'Dag 3'], ['2', 'Dag 2'], ['6', 'Dag 6']], '5')}</select></div></div></fieldset>
    <div class="knapprad"><button type="submit" class="knapp">Skriv in graviditeten</button></div>${fel}</form>`;
}

function sammanfattning(g) {
  const r = g.risk;
  return `<dl class="faktalista ob-fakta">
    <div><dt>Graviditetslängd</dt><dd><strong>${esc(g.status === 'pagaende' ? g.graviditetslangd.text : g.status === 'forlost' ? 'Förlöst' : 'Avslutad')}</strong></dd></div>
    <div><dt>Beräknad partus</dt><dd>${esc(datum(g.bpd))} <span class="under-text">${esc({ sista_mens: 'från sista mens', ultraljud: 'från ultraljudet', ivf: 'från embryoöverföringen (IVF)' }[g.bpdKalla] ?? '')}</span></dd></div>
    <div><dt>Foster</dt><dd>${g.antalFoster === 1 ? 'Ett' : g.antalFoster === 2 ? 'Tvillingar' : `${g.antalFoster} foster`}</dd></div>
    <div><dt>Tidigare förlossningar</dt><dd>${g.paritet}${g.tidigareKejsarsnitt ? `, varav ${g.tidigareKejsarsnitt} kejsarsnitt` : ''}</dd></div>
    <div><dt>Risk</dt><dd><span class="tagg${r.niva === 'normal' ? ' tagg-ok' : ' tagg-utkast'}">${esc(r.namn)}</span>${r.faktorer.length ? ` <span class="under-text">${esc(r.faktorer.map(f => f.text).join(' '))}</span>` : ''}</dd></div>
    <div><dt>Graviditetsdiabetes</dt><dd>${esc(r.gdm?.text ?? '')}</dd></div>
    <div><dt>Havandeskapsförgiftning</dt><dd>${esc(r.preeklampsi?.text ?? '')}</dd></div>
    <div><dt>Mödrahälsovården</dt><dd>${esc(g.vardenhet?.namn ?? '')}, inskriven ${esc(datum(g.registrerad.tid))} av ${esc(g.registrerad.av ?? '')}</dd></div>
  </dl><p class="under-text">${esc(g.demoregel)}</p>`;
}

function programHtml(g, kanBestalla) {
  const n = g.program.nasta;
  return `<section aria-labelledby="gr-prog-${g.id}"><h3 id="gr-prog-${g.id}">Besöksprogram och provschema</h3>
    ${n ? `<p>Nästa: <strong>${esc(n.typ)}</strong> i vecka ${n.vecka}, ${esc(datum(n.datum))}.${n.prover.length ? ` Prover: ${esc(n.prover.map(p => p.namn).join(', '))}.` : ''}</p>` : ''}
    ${n?.prover.length && kanBestalla ? `<p class="knapprad"><button type="button" class="knapp liten" data-gr-prover="${g.id}">Beställ proverna för nästa besök</button></p>` : ''}
    <details><summary>Hela programmet (${g.program.besok.length} besök)</summary><div class="tabellrulle"><table class="tabell"><caption class="sr">Besöksprogrammet med datum och prover</caption>
      <thead><tr><th scope="col">Vecka</th><th scope="col">Datum</th><th scope="col">Besök</th><th scope="col">Prover</th><th scope="col">Gjort</th></tr></thead>
      <tbody>${g.program.besok.map(b => `<tr${b === n ? ' class="rad-markerad"' : ''}><th scope="row">${b.vecka}</th><td>${esc(datum(b.datum))}</td><td>${esc(b.typ)}</td><td>${esc(b.prover.map(p => p.namn).join(', '))}</td><td>${b.gjort ? 'Ja' : ''}</td></tr>`).join('')}</tbody></table></div></details>
  </section>`;
}

function besokHtml(g, kan) {
  return `<section aria-labelledby="gr-besok-${g.id}"><h3 id="gr-besok-${g.id}">Besök</h3>
    ${kan && g.status === 'pagaende' ? `<form id="gr-besok" class="ob-form" novalidate aria-label="Registrera besök" data-gid="${g.id}"><p class="hjalp">Systemet sätter veckan, varnar för förhöjt blodtryck, protein, avvikande symfys-fundusmått och fosterljud, och blodtryck och vikt blir mätvärden.</p>
      <div class="falt-rad"><div class="falt"><label for="gb-blodtryck">Blodtryck</label><input id="gb-blodtryck" name="blodtryck" autocomplete="off" placeholder="120/80"></div>
      <div class="falt"><label for="gb-vikt">Vikt, kg</label><input id="gb-vikt" name="vikt" inputmode="decimal" autocomplete="off"></div>
      <div class="falt"><label for="gb-sf">Symfys-fundusmått, cm</label><input id="gb-sf" name="sfMatt" inputmode="decimal" autocomplete="off"></div>
      <div class="falt"><label for="gb-fosterljud">Fosterljud, slag per minut</label><input id="gb-fosterljud" name="fosterljud" inputmode="numeric" autocomplete="off"></div>
      <div class="falt"><label for="gb-protein">Protein i urinen</label><select id="gb-protein" name="urinProtein">${val([['', 'Inte testat'], ['0', 'Negativt'], ['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+']], '')}</select></div>
      <div class="falt knappfalt"><button type="submit" class="knapp">Spara besöket</button></div></div>${fel}</form>` : ''}
    ${g.besok.length ? `<div class="tabellrulle"><table class="tabell"><caption class="sr">Registrerade besök</caption><thead><tr><th scope="col">Datum</th><th scope="col">Vecka</th><th scope="col">Blodtryck</th><th scope="col">Vikt</th><th scope="col">Symfys-fundusmått</th><th scope="col">Fosterljud</th><th scope="col">Varningar</th></tr></thead>
      <tbody>${[...g.besok].reverse().map(b => `<tr><th scope="row">${esc(datum(b.tid))}</th><td>${esc(b.vecka)}</td><td>${esc(b.blodtryck ?? '')}</td><td>${esc(tal(b.vikt))}</td><td>${esc(tal(b.sfMatt))}</td><td>${esc(b.fosterljud ?? '')}</td><td>${b.varningar.length ? `<span class="text-larm">${esc(b.varningar.join(' '))}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="tom liten">Inga besök registrerade.</p>'}
    <h4>Symfys-fundusmått</h4>${sfSvg(g.sfKurva)}
  </section>`;
}

function ultraljudHtml(g, kan) {
  return `<section aria-labelledby="gr-ul-${g.id}"><h3 id="gr-ul-${g.id}">Ultraljudsjournal</h3>
    ${g.ultraljud.length ? `<ul class="enkel-lista ob-lista">${[...g.ultraljud].reverse().map(u => `<li><strong>${esc(u.typText)}</strong> ${esc(datum(u.datum))}, ${esc(u.vecka)}${u.datering ? ', daterade graviditeten' : ''}
      <span class="under-text">${u.antalFoster > 1 ? `${u.antalFoster} foster. ` : ''}${u.foster.map(f => `${u.antalFoster > 1 ? `Foster ${f.ordning}: ` : ''}${f.hjartaktivitet ? 'hjärtaktivitet' : 'ingen hjärtaktivitet'}${f.skattadVikt ? `, ${f.skattadVikt} g (${f.avvikelse > 0 ? '+' : ''}${f.avvikelse} procent mot förväntat)` : ''}`).join('. ')}.${u.placenta ? ` Moderkaka: ${esc(u.placenta.toLowerCase())}.` : ''}${u.fostervatten ? ` ${esc(u.fostervatten)}.` : ''}${u.fynd ? ` ${esc(u.fynd)}` : ''} ${esc(u.av ?? '')}.</span>
      ${varningar(u.varningar)}</li>`).join('')}</ul>` : '<p class="tom liten">Inga ultraljud registrerade.</p>'}
    ${kan && g.status === 'pagaende' ? `<details><summary>Registrera ultraljud</summary><form id="gr-ul" class="ob-form" novalidate aria-label="Registrera ultraljud" data-gid="${g.id}" data-antal="${g.antalFoster}">
      <p class="hjalp">Ett ultraljud till och med vecka 22 daterar graviditeten. Vid tillväxtultraljudet räknar systemet veckan själv och jämför den skattade vikten med den förväntade.</p>
      <div class="falt-rad"><div class="falt"><label for="gu-typ">Typ</label><select id="gu-typ" name="typ">${val(UL_TYP, g.graviditetslangd.dagar >= 154 ? 'tillvaxt' : 'rutin')}</select></div>
      <div class="falt"><label for="gu-veckor">Veckor</label><input id="gu-veckor" name="veckor" inputmode="numeric" value="${Math.floor(Math.max(0, g.graviditetslangd.dagar) / 7)}"></div>
      <div class="falt"><label for="gu-dagar">Dagar</label><input id="gu-dagar" name="dagar" inputmode="numeric" value="${Math.max(0, g.graviditetslangd.dagar) % 7}"></div>
      <div class="falt"><label for="gu-antal">Antal foster</label><select id="gu-antal" name="antalFoster">${val([['1', '1'], ['2', '2'], ['3', '3']], String(g.antalFoster))}</select></div></div>
      <div class="falt-rad">${Array.from({ length: g.antalFoster }, (_, i) => `<div class="falt"><label for="gu-vikt-${i}">Skattad vikt${g.antalFoster > 1 ? ` foster ${i + 1}` : ''}, g</label><input id="gu-vikt-${i}" name="vikt${i}" inputmode="numeric" autocomplete="off"></div>`).join('')}
      <div class="falt"><label for="gu-plac">Moderkaka</label><select id="gu-plac" name="placenta">${val(PLACENTA, '')}</select></div>
      <div class="falt"><label for="gu-fv">Fostervatten</label><select id="gu-fv" name="fostervatten">${val(FOSTERVATTEN, '')}</select></div></div>
      <div class="falt"><label for="gu-fynd">Fynd</label><input id="gu-fynd" name="fynd" maxlength="500" autocomplete="off"></div>
      <div class="knapprad"><button type="submit" class="knapp">Spara ultraljudet</button></div>${fel}</form></details>` : ''}
  </section>`;
}

function samtalHtml(g, kan) {
  const s = g.inskrivningssamtal;
  const visning = s ? `<dl class="faktalista ob-fakta">
      <div><dt>Registrerat</dt><dd>${esc(tidpunkt(s.tid))} av ${esc(s.av ?? '')}</dd></div>
      <div><dt>Tobak</dt><dd>Rökning: ${esc(s.tobak.rokningText ?? '')}. Snus: ${esc(s.tobak.snusText ?? '')}.</dd></div>
      <div><dt>Anamnes</dt><dd>${s.anamnes.length ? esc(s.anamnes.map(a => a.text).join(', ')) : 'Inget av det som systemet frågar om'}</dd></div>
      <div><dt>Frågorna om våld</dt><dd>${s.valdfragan.stalld ? 'Ställda. Svaren är känsliga uppgifter och visas inte här.' : `Inte ställda: ${esc(s.valdfragan.orsak ?? '')}. Systemet påminner vid nästa besök.`}
        ${s.valdfragan.kanLasaSvar ? ` <button type="button" class="knapp liten sekundar" data-gr-vald="${g.id}">${ikon.las}Visa svaren</button>` : ''}</dd></div>
      <div><dt>Önskemål inför förlossningen</dt><dd>${esc(s.onskemal.text || 'Inga skrivna')}${s.onskemal.smartlindring.length ? `. Smärtlindring: ${esc(s.onskemal.smartlindring.map(x => x.text).join(', '))}` : ''}</dd></div>
      ${s.anteckningId ? '<div><dt>Levnadsvanor</dt><dd>Signerad anteckning av typen Levnadsvanor i journalen.</dd></div>' : ''}
    </dl>` : '<p class="tom liten">Inskrivningssamtalet är inte registrerat.</p>';
  const form = kan && g.status === 'pagaende' ? `<details${s ? '' : ' open'}><summary>${s ? 'Nytt inskrivningssamtal' : 'Registrera inskrivningssamtalet'}</summary><form id="gr-samtal" class="ob-form" novalidate aria-label="Inskrivningssamtal" data-gid="${g.id}">
      <fieldset class="ob-falt"><legend>Anamnes</legend>${ANAMNES.map(([k, t]) => `<div class="kryssfalt"><input type="checkbox" id="gs-${k}" name="${k}"><label for="gs-${k}">${esc(t)}</label></div>`).join('')}</fieldset>
      <fieldset class="ob-falt"><legend>Tobak</legend><div class="falt-rad"><div class="falt"><label for="gs-rok">Rökning</label><select id="gs-rok" name="rokning">${val(TOBAK, 'aldrig')}</select></div>
        <div class="falt"><label for="gs-snus">Snus</label><select id="gs-snus" name="snus">${val(TOBAK, 'aldrig')}</select></div></div></fieldset>
      <fieldset class="ob-falt"><legend>Levnadsvanor</legend><p class="hjalp">Svaren blir en signerad anteckning av typen Levnadsvanor. Under graviditeten är rådet att inte dricka alkohol alls.</p>
        <div class="falt-rad"><div class="falt"><label for="gs-glas">Standardglas en vanlig vecka</label><input id="gs-glas" name="glasPerVecka" inputmode="numeric" value="0"></div>
        <div class="falt"><label for="gs-ber">Fyra glas eller fler vid ett tillfälle</label><select id="gs-ber" name="berusning">${val(BERUSNING, 'aldrig')}</select></div>
        <div class="falt"><label for="gs-tr">Träning, minuter i veckan</label><input id="gs-tr" name="traningMinuter" inputmode="numeric"></div>
        <div class="falt"><label for="gs-va">Vardagsmotion, minuter i veckan</label><input id="gs-va" name="vardagMinuter" inputmode="numeric"></div></div></fieldset>
      <fieldset class="ob-falt"><legend>Frågor om våld i nära relationer</legend><p class="hjalp">Frågorna ställs till alla, när kvinnan är ensam och utan närstående som tolk. Svaren sparas som känsliga uppgifter som bara mödrahälsovården här kan läsa, och läsningen loggas.</p>
        <div class="kryssfalt"><input type="checkbox" id="gs-ensam" name="ensam"><label for="gs-ensam">Hon är ensam med mig och frågorna kan ställas</label></div>
        <div data-gs-fragor hidden>${VALDFRAGOR.map(([k, t]) => `<fieldset class="ob-radio"><legend>${esc(t)}</legend>${VALDSVAR.map(([v, tt]) => `<span class="radiofalt"><input type="radio" id="gs-${k}-${v}" name="vald_${k}" value="${v}"><label for="gs-${k}-${v}">${esc(tt)}</label></span>`).join('')}</fieldset>`).join('')}</div>
        <div class="falt" data-gs-orsak><label for="gs-orsak">Varför frågorna inte kunde ställas</label><select id="gs-orsak" name="orsak">${val(EJ_ORSAK, 'inte_ensam')}</select></div></fieldset>
      <fieldset class="ob-falt"><legend>Önskemål inför förlossningen</legend>${SMARTLINDRING.map(([k, t]) => `<div class="kryssfalt"><input type="checkbox" id="gs-sm-${k}" name="sm_${k}"><label for="gs-sm-${k}">${esc(t)}</label></div>`).join('')}
        <div class="falt"><label for="gs-onsk">Annat hon vill att förlossningen ska veta</label><textarea id="gs-onsk" name="onskemal" maxlength="1000" rows="2"></textarea></div></fieldset>
      <div class="knapprad"><button type="submit" class="knapp">Spara inskrivningssamtalet</button></div>${fel}</form></details>` : '';
  return `<section aria-labelledby="gr-samtal-${g.id}"><h3 id="gr-samtal-${g.id}">Inskrivningssamtal</h3>${visning}${samtyckeHtml(g, s)}${form}</section>`;
}

// Runda 11, r3, Jonas beslut 2026-11-10: kvinnans samtycke till att en annan vårdenhet läser svaren om våld. Syns
// bara för den vårdenhet som ställde frågorna, och bara den ger och återkallar det.
function samtyckeHtml(g, s) {
  if (!s?.samtycken || !s.valdfragan.stalld) return '';
  const standard = new Date(Math.min(Date.parse(`${g.bpd}T12:00:00Z`) + 42 * 86400_000, Date.now() + 360 * 86400_000)).toISOString().slice(0, 10);
  return `<div class="ob-samtycke"><h4>Samtycke till att en annan vårdenhet läser svaren om våld</h4>
    ${s.samtycken.length ? `<ul class="enkel-lista">${s.samtycken.map(x => `<li><strong>${esc(x.mottagare?.namn ?? '')}</strong> till och med ${esc(datum(x.till))}
      <span class="under-text">${x.aktiv ? 'Gäller' : x.aterkallad ? `Återkallat ${esc(tidpunkt(x.aterkallad.tid))}` : 'Har gått ut'}. Registrerat av ${esc(x.av ?? '')}.</span>
      ${x.aktiv ? ` <button type="button" class="knapp liten sekundar" data-gr-aterkalla="${x.id}" data-gid="${g.id}">Återkalla</button>` : ''}</li>`).join('')}</ul>` : '<p class="tom liten">Inget samtycke. Svaren syns bara här.</p>'}
    ${far('graviditet') ? `<details><summary>Registrera ett samtycke</summary><form id="gr-samtycke" class="ob-form" novalidate aria-label="Samtycke till att en annan vårdenhet läser svaren" data-gid="${g.id}">
      <p class="hjalp">Fråga när hon är ensam, som frågorna. Samtycket gäller en vårdenhet till och med ett datum, kan återkallas när som helst och loggas.</p>
      <div class="kryssfalt"><input type="checkbox" id="gc-ensam" name="ensam"><label for="gc-ensam">Hon är ensam med mig och samtycker</label></div>
      <div class="falt-rad"><div class="falt"><label for="gc-mott">Vårdenhet</label><select id="gc-mott" name="mottagare">${s.samtyckesmottagare.map(e => `<option value="${esc(e.id)}"${e.id === 'uso-kk' ? ' selected' : ''}>${esc(e.namn)}</option>`).join('')}</select></div>
      <div class="falt"><label for="gc-till">Gäller till och med</label><input id="gc-till" name="till" type="date" value="${esc(standard)}"></div>
      <div class="falt knappfalt"><button type="submit" class="knapp">Registrera samtycket</button></div></div>${fel}</form></details>` : ''}
  </div>`;
}

function efterkontrollHtml(g, kan) {
  if (g.status !== 'forlost') return '';
  return `<section aria-labelledby="gr-ek-${g.id}"><h3 id="gr-ek-${g.id}">Efterkontroll</h3>
    ${g.efterkontroll.length ? `<ul class="enkel-lista">${g.efterkontroll.map(e => `<li><strong>${esc(datum(e.tid))}</strong> EPDS ${e.epds} poäng, ${esc(e.amning.toLowerCase())}, ${esc(e.blodning.toLowerCase())}<span class="under-text">${esc(e.av ?? '')}</span>${varningar(e.varningar)}</li>`).join('')}</ul>` : '<p class="tom liten">Efterkontrollen är inte gjord.</p>'}
    ${kan ? `<form id="gr-ek" class="ob-form" novalidate aria-label="Registrera efterkontroll" data-gid="${g.id}"><div class="falt-rad">
      <div class="falt"><label for="ge-epds">EPDS, poäng</label><input id="ge-epds" name="epds" inputmode="numeric"></div>
      <div class="falt"><label for="ge-f10">Fråga 10 i EPDS, poäng</label><select id="ge-f10" name="epdsFraga10">${val([['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], '0')}</select></div>
      <div class="falt"><label for="ge-amn">Amning</label><select id="ge-amn" name="amning">${val(AMNING, 'helt')}</select></div>
      <div class="falt"><label for="ge-bl">Blödning</label><select id="ge-bl" name="blodning">${val(BLODNING, 'ingen')}</select></div></div>
      <div class="kryssfalt"><input type="checkbox" id="ge-ejlakt" name="ejLakt"><label for="ge-ejlakt">Bristningen har inte läkt</label></div>
      <div class="falt"><label for="ge-prev">Preventivmedel</label><input id="ge-prev" name="preventivmedel" maxlength="200" autocomplete="off"></div>
      <div class="knapprad"><button type="submit" class="knapp">Spara efterkontrollen</button></div>${fel}</form>` : ''}
  </section>`;
}

function graviditetHtml(g, pid) {
  const kan = far('graviditet') && minVardenhet() === g.vardenhet?.id;
  const kanBestalla = kan && (far('bestalla_prov') || far('bestalla_prov_uppdrag'));
  const forl = g.forlossning;
  return `<article class="ob-graviditet" aria-labelledby="gr-${g.id}"><h3 id="gr-${g.id}" class="sr">Graviditet med beräknad partus ${esc(g.bpd)}</h3>
    ${sammanfattning(g)}${attGora(g.attGora)}
    ${forl ? `<p class="ruta ruta-info liten">${ikon.info}<span>Förlossningen ${forl.status === 'pagaende' ? 'pågår' : 'är avslutad'} på ${esc(forl.vardenhet?.namn ?? '')}${forl.barn.length ? `, ${forl.barn.length === 1 ? 'ett barn' : `${forl.barn.length} barn`}` : ''}.${S.session?.obstetrik?.forlossning ? ` <a href="#/forlossning/${enc(pid)}">Öppna förlossningen</a>.` : ''}</span></p>` : ''}
    ${g.status === 'pagaende' ? programHtml(g, kanBestalla) : ''}
    ${samtalHtml(g, kan)}${besokHtml(g, kan)}${ultraljudHtml(g, kan)}${efterkontrollHtml(g, kan)}
    ${kan ? `<div class="kryssfalt ob-register-val"><input type="checkbox" id="gr-reg-${g.id}" data-gr-register="${g.id}"${g.registerMotsatt ? ' checked' : ''}><label for="gr-reg-${g.id}">Patienten har motsatt sig att uppgifterna rapporteras till Graviditetsregistret</label></div>` : ''}
  </article>`;
}

const nummer = (v) => (v === '' || v == null ? undefined : Number(String(v).replace(',', '.')));

export async function visa(el, ctx) {
  const d = await api(`/api/patient/${enc(ctx.id)}/graviditet`);
  if (!ctx.aktuell()) return;
  const pagaende = d.graviditeter.find(g => g.status === 'pagaende');
  const [senaste, ...tidigare] = d.graviditeter;
  el.innerHTML = `<div class="flikhuvud"><h2>Graviditet</h2></div>
    ${d.moder ? '<p class="ruta ruta-info liten">Patienten är ett barn som föddes på förlossningen. BB-journalen finns under fliken Nyfödd.</p>' : ''}
    ${d.dolda?.kraverVal && !pagaende ? `<p class="ruta ruta-info liten">${ikon.info}<span>Graviditetsjournalen finns på en annan vårdenhet, till exempel mödrahälsovården. Den visas efter ett aktivt val.</span></p>` : ''}
    ${!pagaende && !d.dolda?.kraverVal && far('graviditet') ? registreraHtml() : ''}
    ${senaste ? graviditetHtml(senaste, ctx.id) : (!far('graviditet') ? '<p class="tom">Ingen graviditetsjournal.</p>' : '')}
    ${tidigare.length ? `<details><summary>Tidigare graviditeter (${tidigare.length})</summary>${tidigare.map(g => graviditetHtml(g, ctx.id)).join('')}</details>` : ''}
`;
  // Systemets varningar och råd efter en registrering står kvar tills de stängs.
  const visaSvar = (r, text) => {
    if (r?.varningar?.length) notis(`${text ?? 'Sparat.'} ${r.varningar.join(' ')}`, 'fel', { kvar: true });
    else notis(text ?? 'Sparat.');
    ctx.ladda();
  };
  const skicka = async (form, vag, data, text) => {
    try { const r = await medKnapp(form.querySelector('[type=submit]'), () => api(vag, { metod: 'POST', data }), form); visaSvar(r, r.text ?? text); } catch { /* i formuläret */ }
  };
  el.querySelector('#gr-ny')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const data = { sistaMens: tom(f.sistaMens.value), antalFoster: Number(f.antalFoster.value), paritet: Number(f.paritet.value || 0), tidigareKejsarsnitt: Number(f.tidigareKejsarsnitt.value || 0) };
    if (f.ivf.checked) data.ivf = { overforing: f.overforing.value, embryoDagar: Number(f.embryoDagar.value) };
    skicka(f, `/api/patient/${enc(ctx.id)}/graviditet`, data, 'Graviditeten är inskriven.');
  });
  el.querySelector('#gr-besok')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    skicka(f, `/api/graviditet/${f.dataset.gid}/besok`, { blodtryck: tom(f.blodtryck.value.trim()), vikt: nummer(f.vikt.value), sfMatt: nummer(f.sfMatt.value), fosterljud: nummer(f.fosterljud.value), urinProtein: nummer(f.urinProtein.value) }, 'Besöket är sparat.');
  });
  el.querySelector('#gr-ul')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const antal = Number(f.antalFoster.value);
    const foster = Array.from({ length: antal }, (_, i) => ({ skattadVikt: nummer(f[`vikt${i}`]?.value) }));
    skicka(f, `/api/graviditet/${f.dataset.gid}/ultraljud`, { typ: f.typ.value, veckor: nummer(f.veckor.value), dagar: nummer(f.dagar.value), antalFoster: antal, foster, placenta: tom(f.placenta.value), fostervatten: tom(f.fostervatten.value), fynd: tom(f.fynd.value) }, 'Ultraljudet är sparat.');
  });
  const sf = el.querySelector('#gr-samtal');
  if (sf) {
    const ensam = sf.querySelector('#gs-ensam');
    const vaxla = () => { sf.querySelector('[data-gs-fragor]').hidden = !ensam.checked; sf.querySelector('[data-gs-orsak]').hidden = ensam.checked; };
    ensam.addEventListener('change', vaxla);
    vaxla();
    sf.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(sf);
      const levnadsvanor = { alkohol: { glasPerVecka: nummer(fd.get('glasPerVecka')) ?? 0, berusning: fd.get('berusning') } };
      if (fd.get('traningMinuter') || fd.get('vardagMinuter')) levnadsvanor.fysisk = { traningMinuter: nummer(fd.get('traningMinuter')) ?? 0, vardagMinuter: nummer(fd.get('vardagMinuter')) ?? 0 };
      const data = {
        anamnes: Object.fromEntries(ANAMNES.map(([k]) => [k, fd.get(k) === 'on'])), tobak: { rokning: fd.get('rokning'), snus: fd.get('snus') }, levnadsvanor,
        vald: ensam.checked ? { ensam: true, svar: Object.fromEntries(VALDFRAGOR.map(([k]) => [k, fd.get(`vald_${k}`)])) } : { ensam: false, orsak: fd.get('orsak') },
        onskemal: { text: fd.get('onskemal') ?? '', smartlindring: SMARTLINDRING.filter(([k]) => fd.get(`sm_${k}`) === 'on').map(([k]) => k) },
      };
      skicka(sf, `/api/graviditet/${sf.dataset.gid}/samtal`, data);
    });
  }
  el.querySelector('#gr-samtycke')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    skicka(f, `/api/graviditet/${f.dataset.gid}/valdsamtycke`, { ensam: f.ensam.checked, mottagare: f.mottagare.value, till: f.till.value });
  });
  el.querySelectorAll('[data-gr-aterkalla]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await medKnapp(b, () => api(`/api/graviditet/${b.dataset.gid}/valdsamtycke/${b.dataset.grAterkalla}/aterkalla`, { metod: 'POST', data: {} })); notis(r.text); ctx.ladda(); } catch { /* notis */ }
  }));
  el.querySelector('#gr-ek')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    skicka(f, `/api/graviditet/${f.dataset.gid}/efterkontroll`, { epds: nummer(f.epds.value), epdsFraga10: Number(f.epdsFraga10.value), amning: f.amning.value, blodning: f.blodning.value, bristningLakt: f.ejLakt.checked ? false : undefined, preventivmedel: tom(f.preventivmedel.value) }, 'Efterkontrollen är sparad.');
  });
  el.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-gr-prover]');
    const v = e.target.closest('[data-gr-vald]');
    try {
      if (p) { const r = await medKnapp(p, () => api(`/api/graviditet/${p.dataset.grProver}/prover`, { metod: 'POST', data: {} })); notis(r.text ?? 'Proverna är beställda.'); ctx.ladda(); }
      if (v) {
        const r = await medKnapp(v, () => api(`/api/graviditet/${v.dataset.grVald}/valdsvar`));
        await dialog(`<h2 id="dlg-rubrik">Svaren på frågorna om våld</h2><p class="under-text">${esc(tidpunkt(r.tid))}, ${esc(r.av ?? '')}. ${esc(r.text)}</p>
          <dl class="faktalista">${r.svar.map(x => `<div><dt>${esc(x.fraga)}</dt><dd>${esc(x.svar ?? '')}</dd></div>`).join('')}</dl>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Stäng</button></div>`);
      }
    } catch { /* notis */ }
  });
  el.querySelectorAll('[data-gr-register]').forEach(c => c.addEventListener('change', async () => {
    try { const r = await api(`/api/graviditet/${c.dataset.grRegister}/register`, { metod: 'POST', data: { motsatt: c.checked } }); notis(r.text); } catch { c.checked = !c.checked; }
  }));
}

// ---- Fliken Nyfödd: barnets BB-journal ---------------------------------------------------------------------------------

const SCREENING_TEXT = { kvitamin: 'Registrera K-vitamin', pulsoximetri: 'Pulsoximetri utan anmärkning', horsel: 'Hörselscreening utan anmärkning', barnlakare: 'Barnläkarundersökning utan anmärkning', pku: 'PKU-provet är taget' };
export function bbBarnHtml(b, kan, { niva = 4 } = {}) {
  const k = b.kontroller[0];
  return `<dl class="faktalista ob-fakta">
      <div><dt>Född</dt><dd>${esc(tidpunkt(b.fodd))}, ${b.timmar} timmar sedan</dd></div>
      <div><dt>Födelsevikt</dt><dd>${b.fodelsevikt} g</dd></div>
      <div><dt>Senaste vikt</dt><dd>${b.senasteVikt ? `${b.senasteVikt.vikt} g, ${tal(b.senasteVikt.viktnedgang)} procent under födelsevikten` : 'Inte vägd efter födelsen'}</dd></div>
      <div><dt>Födelseanmälan</dt><dd>${b.anmalan ? `${esc({ kvitterad: 'Kvitterad', ej_folkbokford: 'Mottagen, inget personnummer' }[b.anmalan.status] ?? b.anmalan.status)} (${esc(b.anmalan.kvittens)})${b.anmalan.personnummer ? `, personnummer ${esc(b.anmalan.personnummer)}` : ''}` : 'Inte skickad'}</dd></div>
    </dl>
    ${k ? varningar(k.varningar) : ''}
    <h${niva}>Screening före hemgång</h${niva}><ul class="enkel-lista ob-screening">${b.screening.map(s => `<li>${s.gjord ? `${ikon.bock}<strong>${esc(s.text)}</strong> <span class="under-text">${esc(s.gjord.resultat)}, ${esc(tidpunkt(s.gjord.tid))}</span>`
      : `<strong>${esc(s.text)}</strong> <span class="under-text">${s.tidigast && !s.kanTas ? `tas från ${esc(tidpunkt(s.tidigast))}` : 'kvar'}</span>${kan && s.kanTas ? ` <button type="button" class="knapp liten sekundar" data-bb-screening="${esc(s.typ)}" data-pid="${esc(b.patientId)}">${esc(SCREENING_TEXT[s.typ])}</button>` : ''}`}</li>`).join('')}</ul>
    ${kan ? `<form class="ob-form" data-bb-barn="${esc(b.patientId)}" novalidate aria-label="Kontroll av barnet"><div class="falt-rad">
      <div class="falt"><label for="bk-vikt-${esc(b.patientId)}">Vikt, g</label><input id="bk-vikt-${esc(b.patientId)}" name="vikt" inputmode="numeric" autocomplete="off"></div>
      <div class="falt"><label for="bk-temp-${esc(b.patientId)}">Temperatur</label><input id="bk-temp-${esc(b.patientId)}" name="temp" inputmode="decimal" autocomplete="off"></div>
      <div class="falt"><label for="bk-hud-${esc(b.patientId)}">Hudfärg</label><select id="bk-hud-${esc(b.patientId)}" name="hudfarg">${val([['', 'Inte bedömt'], ['normal', 'Normal'], ['gulaktig', 'Gulaktig'], ['blek', 'Blek eller grå']], '')}</select></div>
      <div class="falt"><label for="bk-mal-${esc(b.patientId)}">Måltider senaste dygnet</label><input id="bk-mal-${esc(b.patientId)}" name="maltider" inputmode="numeric" autocomplete="off"></div>
      <div class="falt knappfalt"><button type="submit" class="knapp liten">Spara kontrollen</button></div></div>${fel}</form>` : ''}`;
}
export function kopplaBb(el, ladda) {
  el.querySelectorAll('[data-bb-barn]').forEach(f => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { vikt: nummer(f.vikt.value), temp: nummer(f.temp.value), hudfarg: tom(f.hudfarg.value), maltider: nummer(f.maltider.value) };
    try { const r = await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/patient/${enc(f.dataset.bbBarn)}/bb`, { metod: 'POST', data }), f); notis(r.text); ladda(); } catch { /* i formuläret */ }
  }));
  el.querySelectorAll('[data-bb-screening]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await medKnapp(b, () => api(`/api/patient/${enc(b.dataset.pid)}/bb/screening`, { metod: 'POST', data: { typ: b.dataset.bbScreening } })); notis(r.text); ladda(); } catch { /* notis */ }
  }));
}

export const nyfodd = {
  async visa(el, ctx) {
    let d;
    try { d = await api(`/api/patient/${enc(ctx.id)}/bb`, { tyst: true }); } catch (e) { if (e?.status !== 404) throw e; d = null; }
    if (!ctx.aktuell()) return;
    if (!d || d.vem !== 'barn') { el.innerHTML = '<div class="flikhuvud"><h2>Nyfödd</h2></div><p class="tom">Barnet föddes inte på förlossningen i Vårdkällan, så det finns ingen BB-journal.</p>'; return; }
    el.innerHTML = `<div class="flikhuvud"><h2>Nyfödd, BB-journal</h2></div>
      ${d.utskriven ? `<p class="ruta ruta-info liten">${ikon.info}<span>Utskriven från BB ${esc(tidpunkt(d.utskriven.tid))} av ${esc(d.utskriven.av ?? '')}.</span></p>` : ''}
      ${bbBarnHtml(d.barn, d.kanRegistrera, { niva: 3 })}<p class="under-text">${esc(d.demoregel)}</p>`;
    kopplaBb(el, ctx.ladda);
  },
};
