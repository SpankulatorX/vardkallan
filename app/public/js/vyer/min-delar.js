// Delarna i Min journal: översikt, anteckningar, diagnoser, läkemedel, provsvar, remisser, vem har läst och spärrar.
// Texterna riktar sig till patienten. Allt som visas kommer från /api/min, som redan har tillämpat vårdgivarens regler.
import { esc, api, datum, tidpunkt, ikon, notis, medKnapp, migreradEtikett, ORDTYP, PRIORITET_REMISS } from '../ui.js';
import { varde } from './patient-oversikt.js';
import { symbolSvg } from '../uppmarksamhet.js';
// Runda 6, r4: egen vårdbegäran.
import * as vardbegaran from './min-vardbegaran.js';
// Runda 7, r5: invändningen mot kvalitetsregistret.
import { invandningIMinJournal } from '../rapportfel.js';

// Uppmärksamhetsinformation: det vården ska se direkt för att vården ska bli säker, som överkänslighet, behandlingar
// som påverkar annan vård, smitta och särskilda vårdrutiner. Patienten ser samma uppgifter som vården, utan förslag.
const GRADTEXT = { livshotande: 'Livshotande', skadlig: 'Skadlig', besvarande: 'Besvärande' };
function umLista(u) {
  if (!u?.poster.length) return tomRad('Ingen uppmärksamhetsinformation är registrerad.');
  return `<p class="liten dampad min-um-symbol">${symbolSvg(u.symbol, 22)}<span>Vården ser en symbol för uppgifterna överst i din journal.</span></p>
    <ul class="enkel-lista">${u.poster.map(p => `<li><strong>${esc(p.term)}</strong>${p.grad ? ` <span class="tagg${p.grad === 'livshotande' ? ' tagg-larm' : ''}">${esc(GRADTEXT[p.grad])}</span>` : ''}
      <span class="under-text">${esc(p.kategoriText)}. ${esc(p.motivering ?? '')}</span><span class="under-text">Registrerad ${esc(datum(p.registrerad.tid))}, ${esc(p.registrerad.vardenhet?.namn ?? '')}</span></li>`).join('')}</ul>`;
}

const del = (pid, d) => api(`/api/min/journal/${encodeURIComponent(pid)}/${d}`);
const tomRad = (t) => `<p class="tom liten">${esc(t)}</p>`;
const plats = (x) => `${esc(x.vardenhet ?? '')}${x.arbetsplats ? `, ${esc(x.arbetsplats)}` : ''}`;
const sektion = (id, rubrik, innehall, lank = '') => `<section class="ov-sektion" aria-labelledby="min-${id}"><div class="sektion-huvud"><h3 id="min-${id}">${esc(rubrik)}</h3>${lank}</div>${innehall}</section>`;
const delrubrik = (t, ingress = '') => `<div class="flikhuvud"><h2>${esc(t)}</h2></div>${ingress ? `<p class="ingress">${ingress}</p>` : ''}`;
const rattadTagg = (a) => (a.rattad ? ' <span class="tagg">Rättad</span>' : '');

// Hur vårdgivaren begränsar Min journal (HSLF-FS 2016:40 4 kap. 12 §). Visas i översikten och under anteckningar.
function begransningar(h) {
  const b = h.begransningar;
  return `<details class="min-regler"><summary>${ikon.info}<span>Så visas uppgifter i Min journal</span></summary>
    <ul>
      <li>Anteckningar visas när de är signerade. Utkast visas inte.</li>
      <li>Provsvar från laboratoriet visas när ansvarig läkare har vidimerat dem, och senast ${esc(b.provsvarSenastDagar)} dagar efter provtagningen. Mätvärden som blodtryck och puls visas direkt.</li>
      ${b.regler.map(r => `<li>${esc(r.motivering)}</li>`).join('')}
      <li>Diagnoser, läkemedel, överkänslighet, uppmärksamhetsinformation, remisser och vårdkontakter visas direkt.</li>
      <li>Spärrar gäller mellan vårdenheter. Du ser själv dina uppgifter också från en vårdenhet som du har spärrat.</li>
      <li>Vaccinationer i barnhälsovården och barnets tillväxt visas under Tillväxt. Vaccinationer i de andra programmen dokumenteras i journalen men visas inte i Min journal. Dina tider finns under Tider.</li>
    </ul>
    <p>Har du frågor om innehållet i journalen kan du kontakta den vårdenhet som har skrivit det. Du kan också begära en kopia av hela journalen.</p>
  </details>`;
}

export async function oversikt(el, ctx) {
  const d = await del(ctx.pid, 'oversikt');
  if (!ctx.aktuell()) return;
  const h = ctx.huvud;
  const rutor = [];
  if (h.relation === 'vardnadshavare') rutor.push(`<div class="ruta ruta-info">${ikon.person}<p>Du läser ${esc(h.patient.namn)}s journal som vårdnadshavare. Du kan läsa den tills barnet fyller 13 år. Det du läser loggas och syns i barnets logglista.</p></div>`);
  if (h.sparrar.length) rutor.push(`<div class="ruta ruta-sparr">${ikon.las}<p>Du har spärrat uppgifter från ${h.sparrar.map(s => esc(s.vardenhet)).join(' och ')}. Andra vårdenheter ser bara att det finns spärrade uppgifter. Du ser själv allt. <a href="${ctx.href('sparrar')}">Om spärrar</a></p></div>`);
  const vantar = [];
  if (d.vantar.anteckningar) vantar.push(`${d.vantar.anteckningar === 1 ? 'en anteckning' : `${d.vantar.anteckningar} anteckningar`} som visas senare`);
  if (d.vantar.provsvar) vantar.push(d.vantar.provsvar === 1 ? 'ett provsvar som inte är vidimerat än' : `${d.vantar.provsvar} provsvar som inte är vidimerade än`);
  if (vantar.length) rutor.push(`<div class="ruta ruta-info">${ikon.klocka}<p>Det finns ${esc(vantar.join(' och '))}. <a href="${ctx.href(d.vantar.anteckningar ? 'anteckningar' : 'provsvar')}">Läs mer</a></p></div>`);

  const kort = [
    sektion('ant', 'Senaste anteckningar', d.anteckningar.length ? `<ul class="ant-lista">${d.anteckningar.map(a => `<li><a href="${ctx.href('anteckningar', a.id)}"><span class="ant-typ">${esc(a.typ)}</span></a>${rattadTagg(a)}
      <span class="under-text">${esc(tidpunkt(a.datum))}, ${plats(a)}</span>${migreradEtikett(a)}<p class="sammanfattning">${esc(a.sammanfattning)}</p></li>`).join('')}</ul>` : tomRad('Inga anteckningar.'),
    `<a class="sektion-lank" href="${ctx.href('anteckningar')}">Alla ${esc(d.antalAnteckningar)} anteckningar</a>`),
    sektion('lm', 'Aktuella läkemedel', d.lakemedel.length ? `<ul class="enkel-lista">${d.lakemedel.map(o => `<li><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka ?? '')}</span><span class="under-text">${esc(o.dosering)}. ${esc(o.ordinationsorsak)}</span></li>`).join('')}</ul>` : tomRad('Inga aktuella läkemedel.'),
      `<a class="sektion-lank" href="${ctx.href('lakemedel')}">Läkemedel</a>`),
    sektion('um', 'Uppmärksamhetsinformation', umLista(d.uppmarksamhet)),
    sektion('dia', 'Diagnoser', d.diagnoser.length ? `<ul class="enkel-lista">${d.diagnoser.map(x => `<li>${esc(x.text)} <span class="kod">${esc(x.kod)}</span><span class="under-text">${esc(datum(x.datum))}, ${plats(x)}</span></li>`).join('')}</ul>` : tomRad('Inga diagnoser.'),
      `<a class="sektion-lank" href="${ctx.href('diagnoser')}">Alla diagnoser</a>`),
    sektion('ps', 'Senaste provsvar och mätvärden', d.provsvar.length ? `<dl class="matvarden-kort">${d.provsvar.map(m => `<div><dt>${esc(m.namn)}</dt><dd>${varde(m)}<span class="under-text">${esc(tidpunkt(m.tid))}</span></dd></div>`).join('')}</dl>` : tomRad('Inga provsvar eller mätvärden.'),
      `<a class="sektion-lank" href="${ctx.href('provsvar')}">Alla provsvar</a>`),
    sektion('rem', 'Pågående remisser', d.remisser.length ? `<ul class="enkel-lista">${d.remisser.map(r => `<li><strong>Till ${esc(r.till)}</strong><span class="under-text">${esc(remissText(r))}</span></li>`).join('')}</ul>` : tomRad('Inga pågående remisser.'),
      `<a class="sektion-lank" href="${ctx.href('remisser')}">Remisser</a>`),
    sektion('vk', 'Vårdkontakter', d.vardkontakter.length ? `<ul class="enkel-lista">${d.vardkontakter.map(v => `<li><strong>${esc(v.orsak ?? '')}</strong>${v.pagaende ? ' <span class="tagg tagg-pagaende">Pågående</span>' : ''}<span class="under-text">${plats(v)}. ${esc(datum(v.start))}${v.slut ? ` till ${esc(datum(v.slut))}` : ''}</span>${migreradEtikett(v)}</li>`).join('')}</ul>` : tomRad('Inga vårdkontakter.')),
    sektion('las', 'Vem har läst journalen', `<p>Se vilka vårdenheter som har läst journalen, när och på vilken grund.</p>`, `<a class="sektion-lank" href="${ctx.href('logglista')}">Vem har läst</a>`),
  ];
  el.innerHTML = `<h2 class="sr">Översikt</h2>${rutor.join('')}<div class="oversikt-rutnat">${kort.join('')}</div>${begransningar(h)}`;
}

export async function anteckningar(el, ctx) {
  if (ctx.sub) return anteckning(el, ctx);
  const d = await del(ctx.pid, 'anteckningar');
  if (!ctx.aktuell()) return;
  const senare = d.senare.length ? `<section class="min-dolda" aria-labelledby="min-senare"><h3 id="min-senare">${ikon.klocka}Visas senare</h3><ul class="enkel-lista">${d.senare.map(s =>
    `<li>${esc(s.typ)}, ${plats(s)}, signerad ${esc(datum(s.signerad))}<span class="under-text">Visas här från ${esc(tidpunkt(s.visasFran))}.</span></li>`).join('')}</ul></section>` : '';
  const ej = d.ejVisade.length ? `<section class="min-dolda" aria-labelledby="min-ejvisade"><h3 id="min-ejvisade">${ikon.info}Visas inte i Min journal</h3><ul class="enkel-lista">${d.ejVisade.map(x =>
    `<li>${x.antal === 1 ? 'En anteckning' : `${esc(x.antal)} anteckningar`}${x.typ ? ` av typen ${esc(x.typ.toLowerCase())}` : ''}${x.vardenhet ? ` från ${esc(x.vardenhet)}` : ''}.<span class="under-text">${esc(x.motivering)}</span></li>`).join('')}</ul></section>` : '';
  el.innerHTML = `${delrubrik('Anteckningar', 'Nyast först. Anteckningar visas när de är signerade.')}${senare}${ej}
    ${d.anteckningar.length ? `<ul class="ant-lista min-ant">${d.anteckningar.map(a => `<li><a href="${ctx.href('anteckningar', a.id)}"><span class="ant-typ">${esc(a.typ)}</span></a>${rattadTagg(a)}
      <span class="under-text">${esc(tidpunkt(a.datum))}, ${plats(a)}${a.forfattare ? `. ${esc(a.forfattare.namn)}, ${esc(a.forfattare.titel)}` : ''}</span>${migreradEtikett(a)}<p class="sammanfattning">${esc(a.sammanfattning)}</p></li>`).join('')}</ul>` : tomRad('Det finns inga anteckningar att visa.')}`;
}

function sokordHtml(v) {
  return `<dl class="min-sokord">${v.sokord.filter(s => s.text).map(s => `<div><dt>${esc(s.sokord)}</dt><dd>${esc(s.text)}</dd></div>`).join('')}</dl>`;
}

async function anteckning(el, ctx) {
  const a = await api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/anteckning/${encodeURIComponent(ctx.sub)}`);
  if (!ctx.aktuell()) return;
  const aldre = a.versioner.filter(v => v.id !== a.id);
  el.innerHTML = `<p><a href="${ctx.href('anteckningar')}">Tillbaka till alla anteckningar</a></p>
    <article class="anteckning min-anteckning" aria-labelledby="min-ant-rubrik">
      <h2 id="min-ant-rubrik">${esc(a.typ)}</h2>
      <p class="ant-fakta">${esc(tidpunkt(a.datum))}, ${plats(a)}${a.forfattare ? `<span class="under-text">Skriven av ${esc(a.forfattare.namn)}, ${esc(a.forfattare.titel)}${a.signeradAv ? `. Signerad av ${esc(a.signeradAv.namn)}` : ''}</span>` : ''}${migreradEtikett(a)}</p>
      ${a.version > 1 ? `<p class="ruta ruta-info liten">Anteckningen är rättad. Orsak: ${esc(a.rattelseOrsak ?? '')} Den tidigare versionen finns kvar och visas nedan.</p>` : ''}
      ${sokordHtml(a)}
      ${aldre.map(v => `<details class="version-gammal"><summary>Version ${esc(v.version)}, ${esc(tidpunkt(v.datum))}, ersatt</summary><div class="overstruken"><del>${sokordHtml(v)}</del></div></details>`).join('')}
    </article>`;
}

export async function diagnoser(el, ctx) {
  const d = await del(ctx.pid, 'diagnoser');
  if (!ctx.aktuell()) return;
  el.innerHTML = `${delrubrik('Diagnoser', 'Diagnoserna är kodade med ICD-10-SE. Koden står efter texten.')}
    ${d.diagnoser.length ? `<ul class="enkel-lista min-lista">${d.diagnoser.map(x => `<li><strong>${esc(x.text)}</strong> <span class="kod">${esc(x.kod)}</span>${x.typ === 'huvud' ? ' <span class="dampad">(huvuddiagnos)</span>' : ''}
      <span class="under-text">${esc(datum(x.datum))}, ${plats(x)}</span>${migreradEtikett(x)}</li>`).join('')}</ul>` : tomRad('Inga diagnoser.')}`;
}

const ordinationHtml = (o) => `<li><strong>${esc(o.lakemedel?.namn ?? '')}</strong> <span class="dampad">${esc([o.lakemedel?.styrka, o.lakemedel?.form].filter(Boolean).join(', '))}</span>${o.vidBehov ? ' <span class="tagg">Vid behov</span>' : ''}
  <span class="min-dos">${esc(o.dosering)}</span>
  <span class="under-text">Mot: ${esc(o.ordinationsorsak)}. ${esc(ORDTYP[o.typ] ?? '')} sedan ${esc(datum(o.start))}${o.slut ? `, till ${esc(datum(o.slut))}` : ''}. Följs upp senast ${esc(datum(o.uppfoljningsdatum))}.</span>
  <span class="under-text">Ordinerat av ${esc(o.ordineradAv ?? '')}, ${plats(o)}</span>
  ${o.utsatt ? `<span class="under-text">Utsatt ${esc(datum(o.utsatt.tid))}: ${esc(o.utsatt.orsak ?? '')}</span>` : ''}${migreradEtikett(o)}</li>`;

export async function lakemedel(el, ctx) {
  const d = await del(ctx.pid, 'lakemedel');
  if (!ctx.aktuell()) return;
  el.innerHTML = `${delrubrik('Läkemedel', 'Läkemedel som vården har ordinerat. Fråga vården om du är osäker på hur du ska ta ett läkemedel.')}
    <section aria-labelledby="min-lm-akt"><h3 id="min-lm-akt">Aktuella läkemedel</h3>
      ${d.aktuella.length ? `<ul class="enkel-lista min-lista">${d.aktuella.map(ordinationHtml).join('')}</ul>` : tomRad('Inga aktuella läkemedel.')}</section>
    <section aria-labelledby="min-ok"><h3 id="min-ok">Överkänslighet</h3>
      ${d.overkanslighet.length ? `<ul class="enkel-lista min-lista">${d.overkanslighet.map(o => `<li><strong>${esc(o.amne)}</strong>${o.allvarlighet === 'allvarlig' ? ' <span class="tagg tagg-larm">Allvarlig</span>' : ''}<span class="under-text">${esc(o.reaktion ?? '')}. Registrerad ${esc(datum(o.datum))}, ${plats(o)}</span>${migreradEtikett(o)}</li>`).join('')}</ul>` : tomRad('Ingen registrerad överkänslighet.')}</section>
    ${d.tidigare.length ? `<details class="min-tidigare"><summary>Tidigare läkemedel (${esc(d.tidigare.length)})</summary><ul class="enkel-lista min-lista">${d.tidigare.map(ordinationHtml).join('')}</ul></details>` : ''}`;
}

// Värdena per typ, nyast först.
function perTyp(rader) {
  const typer = new Map();
  for (const m of rader) { if (!typer.has(m.namn)) typer.set(m.namn, []); typer.get(m.namn).push(m); }
  return [...typer].map(([namn, v]) => `<li class="min-matt"><h4>${esc(namn)}</h4><ul class="min-varden">${v.map(m => `<li><span class="min-vardet">${varde(m)}</span><span class="under-text">${esc(tidpunkt(m.tid))}, ${plats(m)}</span>${migreradEtikett(m)}</li>`).join('')}</ul></li>`).join('');
}

// Runda 11, r6: beställda prover och undersökningar med status, bokad tid och förberedelse (Sussa 4.4.2.5).
function bestallningarHtml(b) {
  const rader = (b?.bestallningar ?? []).filter(x => !x.klar || x.analyser.some(a => a.utlatande));
  return `<section aria-labelledby="min-best"><h3 id="min-best">Beställda prover och undersökningar</h3><p class="dampad liten">${esc(b?.regel ?? '')}</p>
    ${rader.length ? `<ul class="enkel-lista min-bestallningar">${rader.map(x => `<li><strong>${esc(x.analyser.map(a => a.namn).join(', '))}</strong> <span class="tagg${x.klar ? ' tagg-ok' : ''}">${esc(x.status)}</span>
      <span class="under-text">Beställd ${esc(datum(x.skapad))}, ${esc(x.vardenhet)}.</span>
      ${x.analyser.map(a => `<span class="under-text">${esc(a.namn)}: ${esc(a.status)}${a.tid ? ` ${esc(tidpunkt(a.tid))}` : ''}${a.plats ? `, ${esc(a.plats)}` : ''}.${a.rattat ? ' Svaret är rättat.' : ''}</span>
        ${a.forberedelse ? `<span class="under-text">Förbered dig: ${esc(a.forberedelse)}</span>` : ''}${a.utlatande ? `<span class="under-text">Utlåtande: ${esc(a.utlatande)}</span>` : ''}`).join('')}</li>`).join('')}</ul>` : tomRad('Inga beställningar pågår.')}</section>`;
}

export async function provsvar(el, ctx) {
  const [d, best] = await Promise.all([del(ctx.pid, 'provsvar'), del(ctx.pid, 'bestallningar').catch(() => null)]);
  if (!ctx.aktuell()) return;
  const vantar = d.vantar.length ? `<div class="ruta ruta-info">${ikon.klocka}<div><p>${d.vantar.length === 1 ? 'Ett provsvar är inte vidimerat' : `${esc(d.vantar.length)} provsvar är inte vidimerade`} än. Det visas när ansvarig läkare har gått igenom det, och senast ${esc(d.senastDagar)} dagar efter provtagningen.</p>
    <ul class="enkel-lista">${d.vantar.map(v => `<li>${esc(v.namn)}, provtaget ${esc(tidpunkt(v.provtagen))}<span class="under-text">Visas senast ${esc(datum(v.visasSenast))}</span></li>`).join('')}</ul></div></div>` : '';
  el.innerHTML = `${delrubrik('Provsvar och mätvärden')}${vantar}
    ${best ? bestallningarHtml(best) : ''}
    <section aria-labelledby="min-labb"><h3 id="min-labb">Provsvar</h3>${d.provsvar.length ? `<ul class="min-matlista">${perTyp(d.provsvar)}</ul>` : tomRad('Inga provsvar att visa.')}</section>
    <section aria-labelledby="min-vital"><h3 id="min-vital">Mätvärden</h3><p class="dampad liten">Blodtryck, puls, vikt och andra mätningar visas direkt när de är registrerade.</p>${d.matvarden.length ? `<ul class="min-matlista">${perTyp(d.matvarden)}</ul>` : tomRad('Inga mätvärden.')}</section>`;
}

function remissText(r) {
  if (r.status === 'skickad') return `Skickad ${datum(r.tider.skickad)}. Mottagaren har inte bekräftat att remissen har kommit fram än.`;
  if (r.status === 'mottagen') return `Mottagen ${datum(r.tider.mottagen)}. Väntar på bedömning.`;
  if (r.status === 'bedomd' && r.beslut === 'avvisad') return `Avvisad ${datum(r.tider.bedomd)}.`;
  if (r.status === 'bedomd') return `Accepterad ${datum(r.tider.bedomd)}. Väntar på svar, senast ${datum(r.svarSenast)}.`;
  if (r.status === 'besvarad') return `Besvarad ${datum(r.tider.besvarad)}.`;
  return `Besvarad ${datum(r.tider.besvarad)}. Svaret är läst av den som skickade remissen.`;
}
const STEG = [['skickad', 'Skickad'], ['mottagen', 'Mottagen'], ['bedomd', 'Bedömd'], ['besvarad', 'Besvarad']];
function stegHtml(r) {
  const nu = ['skickad', 'mottagen', 'bedomd', 'besvarad', 'svar_kvitterat'].indexOf(r.status);
  const avvisad = r.beslut === 'avvisad';
  return `<ol class="kedja" aria-label="Remissens steg">${STEG.map(([k, t], i) => {
    const gjord = i <= nu;
    const stopp = avvisad && i > 2;
    const lage = stopp ? 'stoppad' : gjord ? (k === 'bedomd' && avvisad ? 'avvisad' : 'klar') : 'vantar';
    return `<li class="steg steg-${lage}"><span class="steg-punkt" aria-hidden="true">${gjord ? (lage === 'avvisad' ? ikon.kryss : ikon.bock) : ''}</span><span class="steg-text"><strong>${esc(k === 'bedomd' && gjord ? (avvisad ? 'Avvisad' : 'Accepterad') : t)}</strong><span class="sr"> (${stopp ? 'avslutad' : gjord ? 'klart' : 'inte än'})</span></span></li>`;
  }).join('')}</ol>`;
}

export async function remisser(el, ctx) {
  const d = await del(ctx.pid, 'remisser');
  if (!ctx.aktuell()) return;
  el.innerHTML = `${delrubrik('Remisser', 'Remisser som vården har skickat om dig, och dina egna vårdbegäranden. Här ser du hur långt de har kommit.')}
    ${vardbegaran.knappHtml()}
    ${d.remisser.length ? `<ul class="min-remisser">${d.remisser.map(r => `<li class="ov-sektion">
      <h3>Till ${esc(r.till)}</h3><p class="under-text">${r.egen ? 'Din egen vårdbegäran' : `Från ${esc(r.fran)}`}. Prioritet: ${esc((PRIORITET_REMISS[r.prioritet] ?? r.prioritet).toLowerCase())}.</p>${migreradEtikett(r)}
      ${stegHtml(r)}<p>${esc(remissText(r))}</p>
      <dl class="faktalista"><div><dt>${r.egen ? 'Ditt besvär' : 'Frågeställning'}</dt><dd>${esc(r.fragestallning)}</dd></div>
        ${r.beslut === 'avvisad' && r.motivering ? `<div><dt>Motivering</dt><dd>${esc(r.motivering)}</dd></div>` : ''}
        ${r.svar ? `<div><dt>Svar</dt><dd>${esc(r.svar)}</dd></div>` : ''}</dl>
    </li>`).join('')}</ul>` : tomRad('Inga remisser.')}`;
  vardbegaran.koppla(el, ctx);
}

// Vem har läst journalen.
const HANDLING = {
  las_oversikt: 'Öppnade journalens översikt', las_admin: 'Läste administrativa uppgifter', las_journal: 'Läste anteckningar', las_omvardnad: 'Läste omvårdnadsanteckningar',
  las_lakemedel: 'Läste läkemedelslistan', las_matvarden: 'Läste provsvar och mätvärden', las_diagnoser: 'Läste diagnoser', las_remiss: 'Läste remisser',
  las_remiss_status: 'Såg remissernas status', skriv_journal: 'Skrev en anteckning', skriv_omvardnad: 'Skrev en omvårdnadsanteckning', ordinera: 'Ordinerade eller ändrade ett läkemedel',
  registrera_matvarde: 'Registrerade ett mätvärde', remittera: 'Skickade en remiss', mottag_remiss: 'Tog emot en remiss', bedom_remiss: 'Bedömde en remiss',
  svara_remiss: 'Svarade på en remiss', kvittera_svar: 'Kvitterade ett remissvar', nodatkomst: 'Öppnade journalen med nödåtkomst',
  andra_enheter: 'Valde att visa uppgifter från andra vårdenheter', samtycke_sparr: 'Registrerade ditt samtycke till att visa spärrade uppgifter',
  visa_identitet: 'Visade din skyddade identitet', las_logg: 'Läste åtkomstloggen', invanare_las: 'Läste journalen', invanare_begaran: 'Skickade en begäran',
  registrera_vardkontakt: 'Registrerade eller ändrade en vårdkontakt', vardtillfalle: 'Skrev in, flyttade eller skrev ut dig', halsoarende: 'Höll samman vårdkontakter i ett hälsoärende',
  // Runda 6, r4.
  bevaka: 'Lade upp eller avslutade en bevakning', boka: 'Bokade, bokade om eller avbokade en tid', kalla: 'Skickade eller hämtade en kallelse', checka_in: 'Checkade in dig eller tog betalt',
};
const GRUND = {
  egen_enhet: 'Vårdrelation', vardrelation: 'Vårdrelation', administrativ: 'Administrativ uppgift', aktivt_val: 'Aktivt val',
  samtycke_sparr: 'Med ditt samtycke', nodatkomst: 'Nödåtkomst', logggranskning: 'Logggranskning', nekad: 'Nekades',
  egen_atkomst: 'Egen åtkomst', vardnadshavare: 'Vårdnadshavare',
  // Runda 10, r5: sammanhållen journalföring med en annan vårdgivare.
  samtycke: 'Med ditt samtycke till sammanhållen journalföring',
};
const VEM = { du: 'Du', patienten: 'Patienten själv', vardnadshavare: 'Vårdnadshavare', invanare: 'En annan person', ombud: 'Ditt ombud' };
const VIA = { fhir: 'via det öppna API:t', laskopia: 'till läskopian för avbrott', laslage: 'i läsläget under ett avbrott', min_journal: 'i Min journal' };

function loggRad(r) {
  const vem = r.vem === 'personal' ? `${esc(r.vardenhet ?? '')}${r.arbetsplats ? `<span class="under-text">${esc(r.arbetsplats)}</span>` : ''}` : esc(VEM[r.vem] ?? '');
  const roll = r.vem === 'personal' ? `${esc(r.yrkesroll ?? '')}${r.vardgivare ? `, ${esc(r.vardgivare)}` : ''}` : 'Min journal, Vårdkällans e-tjänst';
  const flagga = r.resultat === 'nekad' || r.grund === 'nodatkomst' || r.grund === 'samtycke_sparr';
  return `<li class="min-loggrad${flagga ? ' flaggad' : ''}${r.egenAtkomst ? ' egen' : ''}"${r.egenAtkomst ? ' data-egen' : ''}>
    <time datetime="${esc(r.tid)}">${esc(tidpunkt(r.tid))}</time>
    <div class="min-logg-vem"><strong>${vem}</strong><span class="under-text">${roll}</span></div>
    <div class="min-logg-vad">${r.automatisk ? `${esc(r.handlingText)}${r.antal > 1 ? ` <span class="dampad">${esc(r.antal)} gånger den dagen</span>` : ''}` : `${esc(HANDLING[r.handling] ?? r.handlingText ?? 'Annan åtgärd i journalen')}${r.via ? ` <span class="dampad">${esc(VIA[r.via])}</span>` : ''}`}
      <span class="grund grund-${esc(r.grund)}">${esc(GRUND[r.grund] ?? r.grund)}</span>${r.resultat === 'nekad' ? `<span class="resultat-nekad">${ikon.las}Försöket nekades, inget visades</span>` : ''}</div>
  </li>`;
}

export async function logglista(el, ctx) {
  const d = await del(ctx.pid, 'logglista');
  if (!ctx.aktuell()) return;
  const vard = d.rader.filter(r => r.vem === 'personal').length;
  const egna = d.rader.filter(r => r.egenAtkomst).length;
  const andra = d.rader.length - vard - egna;
  el.innerHTML = `${delrubrik('Vem har läst journalen', `Varje gång någon i vården öppnar journalen loggas det. Här ser du vilken vårdenhet och yrkesroll det var, när det var och på vilken grund. Nödåtkomst, ditt samtycke till spärrade uppgifter och nekade försök är markerade.`)}
    <div class="ruta ruta-forklaring min-namn">
      <p>Namnet på den som läste visas inte här. Vårdgivaren ska kunna visa vilken vårdenhet och vid vilken tidpunkt någon har tagit del av uppgifterna, så att du kan bedöma om åtkomsten var befogad (HSLF-FS 2016:40 4 kap. 10 §). Vill du veta namnet kan du begära ett loggutdrag. Vården prövar då om namnet kan lämnas ut.</p>
      <div class="knapprad"><button type="button" class="knapp sekundar liten" data-loggutdrag>Begär loggutdrag med namn</button></div>
    </div>
    ${d.kedjaHel ? `<p class="kedja-status kedja-hel liten">${ikon.bock}<span>Loggen är kontrollerad: ingen rad har ändrats eller tagits bort.</span></p>` : `<p class="kedja-status kedja-bruten liten" role="alert">${ikon.varning}<span>Loggens kontroll visar att en rad inte stämmer. Kontakta vården.</span></p>`}
    <div class="min-logg-filter kryssfalt"><input type="checkbox" id="min-egna"><label for="min-egna">Visa också när du själv har läst journalen i Min journal (${esc(egna)})</label></div>
    <p class="antal-text" id="min-logg-antal">${vard === 1 ? 'En åtkomst' : `${esc(vard)} åtkomster`} av vården${d.avskurna.vard ? `, de senaste ${esc(d.max.vard)}` : ''}${andra ? `, och ${andra === 1 ? 'ett försök' : `${esc(andra)} försök eller läsningar`} av någon annan i Min journal` : ''}. Nyast först.</p>
    ${d.rader.length ? `<ol class="min-logg" id="min-logg">${d.rader.map(loggRad).join('')}</ol>` : tomRad('Ingen har läst journalen.')}`;
  const lista = el.querySelector('#min-logg');
  const visaEgna = (ja) => { lista?.querySelectorAll('[data-egen]').forEach(x => { x.hidden = !ja; }); };
  visaEgna(false);
  el.querySelector('#min-egna').addEventListener('change', (e) => visaEgna(e.target.checked));
  el.querySelector('[data-loggutdrag]').addEventListener('click', async (e) => {
    try {
      await medKnapp(e.currentTarget, () => api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/begaran`, { metod: 'POST', data: { typ: 'loggutdrag' } }));
      notis('Begäran om loggutdrag är skickad till vården. Du ser den under Spärrar.');
    } catch { /* notis visad */ }
  });
}

const BEGARAN = { sparr: 'Spärra uppgifter', hava_sparr: 'Häva en spärr', loggutdrag: 'Loggutdrag med namn' };

export async function sparrar(el, ctx) {
  const d = await del(ctx.pid, 'sparrar');
  if (!ctx.aktuell()) return;
  const valbara = d.vardenheter.filter(e => !e.sparrad);
  el.innerHTML = `${delrubrik('Spärrar och begäranden')}
    <div class="ruta ruta-forklaring"><p>Du kan spärra uppgifter från en vårdenhet. Då ser andra vårdenheter inte uppgifterna, bara att det finns spärrade uppgifter (patientdatalagen 4 kap. 4 och 5 §§). I Vårdkällan visas de spärrade uppgifterna för en annan vårdenhet bara om du samtycker i stunden. Du ser själv alltid dina uppgifter.</p>
      <p>Här skickar du en begäran till vården. Den ändrar inget direkt: vården behandlar begäran och registrerar spärren, eller hävningen av den. I demon behandlas begärandena inte.</p></div>
    <section aria-labelledby="min-sp"><h3 id="min-sp">Dina spärrar</h3>
      ${d.sparrar.length ? `<ul class="enkel-lista min-lista">${d.sparrar.map(s => `<li>${ikon.las} <strong>${esc(s.vardenhet)}</strong><span class="under-text">Spärrad sedan ${esc(datum(s.sedan))}</span>
        ${d.kanBegaraSparr ? `<button type="button" class="knapp sekundar liten" data-hav="${esc(s.vardenhetId)}">Begär att spärren hävs</button>` : ''}</li>`).join('')}</ul>` : tomRad('Inga spärrar.')}</section>
    ${d.kanBegaraSparr ? `<section aria-labelledby="min-ny"><h3 id="min-ny">Begär en spärr</h3>
      ${valbara.length ? `<form id="min-sparrform" class="min-form" novalidate>
        <div class="falt"><label for="min-enhet">Vårdenhet</label><select id="min-enhet" name="enhetId" required>${valbara.map(e => `<option value="${esc(e.id)}">${esc(e.namn)}</option>`).join('')}</select>
          <span class="hjalp">De vårdenheter som har uppgifter om dig.</span></div>
        <div class="falt"><label for="min-medd">Meddelande till vården <span class="obl">(frivilligt)</span></label><textarea id="min-medd" name="meddelande" rows="2" maxlength="500"></textarea></div>
        <p class="form-fel" role="alert" hidden></p>
        <button type="submit" class="knapp">Skicka begäran</button>
      </form>` : tomRad('Alla vårdenheter som har uppgifter om dig är redan spärrade.')}</section>`
    : '<p class="ruta ruta-info">En vårdnadshavare kan inte spärra barnets uppgifter eller begära att en spärr hävs (patientdatalagen 4 kap. 4 och 5 §§). Du kan begära ett loggutdrag.</p>'}
    <section aria-labelledby="min-beg"><h3 id="min-beg">Dina begäranden</h3>
      ${d.begaran.length ? `<ul class="enkel-lista min-lista">${d.begaran.map(b => `<li><strong>${esc(BEGARAN[b.typ] ?? b.typ)}</strong>${b.vardenhet ? `, ${esc(b.vardenhet)}` : ''}
        <span class="under-text">Skickad ${esc(tidpunkt(b.skapad))}${b.egen ? '' : ' av en annan vårdnadshavare'}. ${b.status === 'skickad' ? 'Skickad till vården, inte behandlad än.' : esc(b.status)}</span>${b.meddelande ? `<span class="under-text">${esc(b.meddelande)}</span>` : ''}</li>`).join('')}</ul>` : tomRad('Inga begäranden.')}</section>`;
  const skicka = async (knapp, data, form = null) => {
    await medKnapp(knapp, () => api(`/api/min/journal/${encodeURIComponent(ctx.pid)}/begaran`, { metod: 'POST', data }), form);
    notis('Begäran är skickad till vården.');
    ctx.ladda();
  };
  el.querySelector('#min-sparrform')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    skicka(f.querySelector('[type="submit"]'), { typ: 'sparr', enhetId: f.enhetId.value, meddelande: f.meddelande.value }, f).catch(() => {});
  });
  el.querySelectorAll('[data-hav]').forEach(b => b.addEventListener('click', () => skicka(b, { typ: 'hava_sparr', enhetId: b.dataset.hav }).catch(() => {})));
  // Runda 7, r5: patientens egen invändning mot kvalitetsregistret.
  invandningIMinJournal(el, ctx.pid).catch(() => {});
}
