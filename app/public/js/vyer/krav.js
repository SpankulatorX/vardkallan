// Kravspårbarhet: Sussas kravspecifikation med originalnummer (standardvyn) och det egna ramverket K, D, L och M.
// Varje krav och post visas med status och de automatiska tester som visar det.
import { esc, api, tidpunkt, ikon, vyRubrik } from '../ui.js';

export const namn = 'krav';

const STATUS = { uppfyllt_demo: 'Uppfyllt i demon', delvis: 'Delvis', planerat: 'Planerat' };
const VAR = {
  '/': ['#/', 'Inloggningen'], '/drift': ['#/drift', 'Svarstider'], '/fhir/metadata': ['#/api', 'Öppet API'], '/inkorg': ['#/inkorg', 'Inkorgen'],
  '/krav': ['#/krav', 'Kravspårbarhet'], '/logg': ['#/logg', 'Logguppföljningen'], '/migrering': ['#/migrering', 'Migreringsavstämningen'],
  '/patient/:id': [null, 'patientjournalen'], '/patient/:id/anteckningar': [null, 'journalens anteckningar'],
  '/patient/:id/lakemedel': [null, 'journalens läkemedelsflik'], '/vantrum': ['#/vantrum', 'Väntrummet'],
};
const TESTSTATUS = { 'grön': ['ok', 'Grönt'], 'röd': ['fel', 'Rött'], hoppad: ['hoppad', 'Hoppades över'], saknas: ['fel', 'Saknas'], inaktuell: ['hoppad', 'Inaktuellt, gränssnittet har ändrats sedan testet kördes'] };
const GRUPP = [['K', 'Spårbarhet från krav till test'], ['D', 'Icke-funktionella krav och design'], ['L', 'Lagkrav och nationella tjänster'], ['M', 'Misstag att inte upprepa']];

export async function visa(main, _p, q) {
  const vy = ['egna', 'bor'].includes(q.get('vy')) ? q.get('vy') : 'sussa';
  main.innerHTML = vyRubrik('Kravspårbarhet') + `<nav class="flikar" aria-label="Kravregister"><ul>
      <li><a href="#/krav"${vy === 'sussa' ? ' aria-current="page"' : ''}>Sussas kravspecifikation</a></li>
      <li><a href="#/krav?vy=bor"${vy === 'bor' ? ' aria-current="page"' : ''}>Bör-krav och målbild</a></li>
      <li><a href="#/krav?vy=egna"${vy === 'egna' ? ' aria-current="page"' : ''}>Eget ramverk</a></li>
    </ul></nav><div id="kr-vy"></div>`;
  const yta = main.querySelector('#kr-vy');
  if (vy === 'egna') await visaEgna(yta, q);
  else if (vy === 'bor') await visaBor(yta);
  else await visaSussa(yta, q);
}

const testkorning = (t) => `<div class="testkorning ${t?.misslyckade ? 'testkorning-rod' : 'testkorning-gron'}">${t ? `${t.misslyckade ? ikon.varning : ikon.bock}<p><strong>${t.godkanda} av ${t.antal} tester gröna</strong> i senaste bygget, ${esc(tidpunkt(t.tid))}, Bun ${esc(t.bun)}.${t.misslyckade ? ` ${t.misslyckade} röda.` : ''}</p>` : `${ikon.info}<p>Inget testresultat finns från bygget.</p>`}</div>`;

const testrader = (tester) => tester.map(x => {
  const [kl, txt] = TESTSTATUS[x.status] ?? ['fel', x.status];
  return `<li class="test test-${kl}">${kl === 'ok' ? ikon.bock : ikon.kryss}<span class="sr">${esc(txt)}: </span><span>${esc(x.namn)}</span></li>`;
}).join('');

// Det egna ramverket: K, D, L och M.
async function visaEgna(yta, q) {
  const filter = ['uppfyllt_demo', 'delvis', 'planerat'].includes(q.get('status')) ? q.get('status') : 'alla';
  yta.innerHTML = `<div class="ingress-block">
      <p>Kraven kommer från den offentliga granskningen av upphandlingen av Cosmic i Sussa-samverkan, rapporten Cosmic upphandling krav och kritik, och från lagkraven på journalsystem. Varje krav pekar på de automatiska tester som visar det, och testerna körs vid varje bygge. Ett krav räknas som uppfyllt i demon bara om alla dess tester finns och är gröna.</p>
      <p>Sussas egen kravspecifikation med originalnummer finns under fliken Sussas kravspecifikation. Uppfyllt i demon betyder att funktionen finns och är testad i demon, inte att Vårdkällan uppfyller kraven i en upphandling eller är CE-märkt.</p>
    </div><div id="kr"><p class="tom">Hämtar kravregistret.</p></div>`;
  const d = await api('/api/krav');
  const summa = d.summa;
  const urval = d.krav.filter(k => filter === 'alla' || k.status === filter);
  const filterLank = (k, text, n) => `<li><a href="#/krav?vy=egna${k === 'alla' ? '' : `&status=${k}`}"${filter === k ? ' aria-current="true"' : ''}>${esc(text)} <span class="antal">${n}</span></a></li>`;
  yta.querySelector('#kr').innerHTML = `
    ${testkorning(d.testresultat)}
    ${klientRad(d.klienttester)}
    <nav class="delflikar" aria-label="Filtrera på status"><ul>
      ${filterLank('alla', 'Alla', d.krav.length)}${filterLank('uppfyllt_demo', STATUS.uppfyllt_demo, summa.uppfyllt_demo)}${filterLank('delvis', STATUS.delvis, summa.delvis)}${filterLank('planerat', STATUS.planerat, summa.planerat)}
    </ul></nav>
    ${GRUPP.map(([pre, rubrik]) => {
      const g = urval.filter(k => k.id.startsWith(pre));
      if (!g.length) return '';
      return `<section class="kravgrupp" aria-labelledby="kg-${pre}"><h2 id="kg-${pre}">${esc(rubrik)}</h2><ul class="kravlista">${g.map(kravRad).join('')}</ul></section>`;
    }).join('') || '<p class="tom">Inga krav har den statusen.</p>'}`;
}

// Sussas kravspecifikation med originalnummer. Filtren sparas i adressen, och en post öppnas med ?post=id.
const KATEGORI = { system: 'Systemet', nationell: 'Nationell tjänst', leverantor: 'Leverantören' };
const KATEGORI_FORKLARING = {
  system: 'Posten gäller systemets funktion.',
  nationell: 'Posten kräver en nationell tjänst eller en extern part, som inte är ansluten i demon.',
  leverantor: 'Posten gäller leverantören, driften eller projektet och inte systemets funktion.',
};
const TYP = { krav_vid_anbud: 'Krav vid anbud', krav_vid_leverans: 'Krav vid leverans', utvarderingskriterium: 'Utvärderingskriterium' };
const STATUSORDNING = ['uppfyllt_demo', 'delvis', 'planerat'];
const normal = (s) => String(s ?? '').toLocaleLowerCase('sv-SE');
// Runda 7, r7: driftspecifikationen som eget filter, vikt, Cambios svar och avtalets signaler (K2 och K3).
const SPECIFIKATION = { losning: 'Kravspecifikation lösning', drift: 'Kravspecifikation drift och teknik' };
const AVTALSFILTER = { exkluderat: 'Exkluderat ur avtalet 2022', uppskjutet: 'Uppskjutet', nagot: 'Exkluderat eller uppskjutet' };
const ARBETS_STATUS = { ...Object.fromEntries(STATUSORDNING.map(s => [s, STATUS[s]])), ej: 'Inte uppfyllt i demon' };
const procent = (v, decimaler = 2) => `${(v * 100).toLocaleString('sv-SE', { minimumFractionDigits: decimaler, maximumFractionDigits: 2 })} %`;
const kronor = (n) => `${n.toLocaleString('sv-SE')} kr`;
const ARBETSLISTA = '#/krav?typ=utvarderingskriterium&status=ej&sortera=vikt&topp=10';

async function visaSussa(yta, q) {
  yta.innerHTML = '<p class="tom">Hämtar Sussas kravspecifikation.</p>';
  const d = await api('/api/krav/sussa');
  const avsnitt = new Map(d.avsnitt.map(a => [a.id, a]));
  const perId = new Map(d.poster.map(p => [p.id, p]));
  const val = {
    spec: SPECIFIKATION[q.get('spec')] ? q.get('spec') : '',
    kapitel: d.kapitel.some(k => k.nr === q.get('kapitel')) ? q.get('kapitel') : '',
    status: ARBETS_STATUS[q.get('status')] ? q.get('status') : '',
    kategori: KATEGORI[q.get('kategori')] ? q.get('kategori') : '',
    typ: TYP[q.get('typ')] ? q.get('typ') : '',
    avtal: AVTALSFILTER[q.get('avtal')] ? q.get('avtal') : '',
    sortera: q.get('sortera') === 'vikt' ? 'vikt' : '',
    sok: q.get('sok') ?? '',
  };
  // Genvägen visar de första tio. Ändras ett filter visas hela urvalet igen.
  let topp = /^\d{1,3}$/.test(q.get('topp') ?? '') ? Number(q.get('topp')) : 0;
  const s = d.summa;
  const v = d.viktning;
  const a = d.avtal;
  const valj = (namn, rubrik, alla, alternativ) => `<div class="falt"><label for="sf-${namn}">${rubrik}</label><select id="sf-${namn}" name="${namn}"><option value="">${alla}</option>${Object.entries(alternativ).map(([k, t]) => `<option value="${esc(k)}"${val[namn] === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  yta.innerHTML = `<div class="ingress-block">
      <p>Region Örebro läns kravspecifikation för upphandlingen av journalsystemet Cosmic, med Sussas originalnummer. Varje post visar kravtexten, hur Vårdkällan möter den, hur systemet tar expertrollen och vilka automatiska tester som visar det. En post räknas som uppfylld i demon bara om alla dess tester finns och är gröna, och en post utan tester är planerad. Uppfyllt i demon betyder inte att Vårdkällan uppfyller kraven i en upphandling.</p>
      <p>Varje post visar också vad Cambio svarade i anbudet, som är en del av avtalet, hur mycket Sussa viktade kriteriet i utvärderingen och om delar av det togs bort ur avtalet eller sköts upp 2022.</p>
      <p class="liten">Källa: ${esc(d.kalla.replace(/\.$/, ''))}. ${esc(d.utdrag)}</p>
    </div>
    ${testkorning(d.testresultat)}
    <div class="tabellrulle sussa-summa-rulle"><table class="tabell siffertabell sussa-summa">
      <caption>Sammanställning av ${d.poster.length} poster per kategori och status</caption>
      <thead><tr><th scope="col">Kategori</th>${STATUSORDNING.map(st => `<th scope="col" class="tal">${esc(STATUS[st])}</th>`).join('')}<th scope="col" class="tal">Totalt</th></tr></thead>
      <tbody>${Object.keys(KATEGORI).map(k => `<tr><th scope="row">${esc(KATEGORI[k])}</th>${STATUSORDNING.map(st => `<td class="tal">${s.korstabell[k][st]}</td>`).join('')}<td class="tal"><strong>${s.kategori[k]}</strong></td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">Totalt</th>${STATUSORDNING.map(st => `<td class="tal"><strong>${s.status[st]}</strong></td>`).join('')}<td class="tal"><strong>${d.poster.length}</strong></td></tr></tfoot>
    </table></div>
    <details class="sussa-om sussa-viktning"><summary>Så viktade Sussa kriterierna</summary>
      <p>${v.antalViktade} utvärderingskriterier har en vikt i viktningsträdet (bilaga F1:1). Ett kriteriums vikt är dess andel av hela kvalitetsbedömningen: produkten av vikterna för kapitlet, avsnittet och kriteriet. Kriterierna väger tillsammans ${esc(procent(v.summaKriterier, 0))} och användbarhetstesterna ${esc(procent(v.modell.anvandbarhetstester, 0))}. Kvaliteten vägdes mot priset ${v.modell.funktion * 100} mot ${v.modell.pris * 100}: varje kriterium som inte fick full poäng gav ett prispåslag, där hela påslaget var medelpriset för anbuden gånger ${String(v.modell.prispaslagFaktor).replace('.', ',')}, ${esc(kronor(v.modell.prispaslag))}.</p>
      <p>Vikterna stämmer med Cambios prispåslag per kriterium i bilaga 6a till upphandlingsrapporten, utom för 9.1.1.2 och 9.1.1.3. Där räknade utvärderingen med vikterna i omvänd ordning mot viktningsträdet.</p>
      <p class="liten">Källa: ${esc(v.kalla)}. Betygen: ${esc(v.kallaBetyg)} och ${esc(v.kallaMotivering)}.</p>
    </details>
    <details class="sussa-om sussa-a1"><summary>Avtalet och Cambios svar</summary>
      <p>Den avtalade specifikationen är bilaga A1 till avtalet om köp. Den består av sju delar:</p>
      <ul class="sussa-a1-delar">${a.a1.delar.map(x => `<li><span class="krav-id">${esc(x.id)}</span> ${esc(x.namn)}. <span class="tagg tagg-a1-${esc(x.finns)}">${esc({ ja: 'Finns', delvis: 'Finns delvis', nej: 'Finns inte' }[x.finns])}</span> <span class="dampad">${esc(x.var)}</span></li>`).join('')}</ul>
      <p>${esc(a.a1.senare)}</p>
      <p>Cambio kryssade ja på ${a.summa.ja} av ${d.poster.length} poster. ${a.summa.sammanfattade} beskrivande svar går att läsa och är sammanfattade här, ${a.summa.maskerade} är maskerade i den utlämnade handlingen och ${a.summa.delvisMaskerade} är delvis maskerat.</p>
      <p class="liten">Källa: ${esc(a.kalla)}. ${esc(d.signalkallor.ab32.namn)}, ${esc(d.signalkallor.ab32.datum)}. ${esc(d.signalkallor.at3.namn)}, undertecknad ${esc(d.signalkallor.at3.datum)}.</p>
    </details>
    <p class="sussa-genvag"><a class="knapp sekundar liten" id="sf-arbetslista" href="${ARBETSLISTA}">De tio högst viktade kriterierna som inte är uppfyllda</a></p>
    <form class="sussa-filter" role="search" aria-label="Filtrera Sussas krav">
      <div class="falt-rad">
        ${valj('spec', 'Specifikation', 'Båda', SPECIFIKATION)}
        ${valj('kapitel', 'Kapitel', 'Alla kapitel', Object.fromEntries(d.kapitel.map(k => [k.nr, `${k.nr} ${k.rubrik}`])))}
        ${valj('status', 'Status', 'Alla', ARBETS_STATUS)}
        ${valj('kategori', 'Kategori', 'Alla', KATEGORI)}
        ${valj('typ', 'Typ', 'Alla', TYP)}
        ${valj('avtal', 'Avtalet 2022', 'Alla', AVTALSFILTER)}
        ${valj('sortera', 'Ordning', 'Som i dokumentet', { vikt: 'Högst vikt först' })}
        <div class="falt bred"><label for="sf-sok">Sök på id eller text</label><input id="sf-sok" name="sok" type="search" autocomplete="off" value="${esc(val.sok)}" placeholder="Till exempel 3.5.2.6 eller ordinationsorsak"></div>
      </div>
    </form>
    <p class="dampad liten" id="sf-antal" role="status"></p>
    <div id="sussa-lista"></div>`;

  const form = yta.querySelector('.sussa-filter');
  const lista = yta.querySelector('#sussa-lista');
  const antal = yta.querySelector('#sf-antal');
  const rita = () => {
    const sok = normal(val.sok.trim());
    let urval = d.poster.filter(p => (!val.spec || (val.spec === 'drift') === p.kapitel.startsWith('KD'))
      && (!val.kapitel || p.kapitel === val.kapitel)
      && (!val.status || (val.status === 'ej' ? p.status !== 'uppfyllt_demo' : p.status === val.status))
      && (!val.kategori || p.kategori === val.kategori) && (!val.typ || p.typ === val.typ)
      && (!val.avtal || (val.avtal === 'nagot' ? p.signaler.length > 0 : p.signaler.some(x => x.typ === val.avtal)))
      && (!sok || p.id.toLocaleLowerCase('sv-SE').startsWith(sok) || normal(`${p.rubrik} ${p.text} ${p.mervarden.join(' ')} ${p.losning ?? ''} ${p.avtal?.sammanfattning ?? ''}`).includes(sok)));
    const totalt = urval.length;
    if (val.sortera === 'vikt') urval = [...urval].sort((x, y) => (x.viktRang ?? 1e9) - (y.viktRang ?? 1e9));
    if (topp) urval = urval.slice(0, topp);
    antal.innerHTML = topp && totalt > urval.length
      ? `Visar de ${urval.length} första av ${totalt} poster. <a href="#" id="sf-visa-alla">Visa alla ${totalt}</a>`
      : `Visar ${urval.length} av ${d.poster.length} poster.`;
    if (val.sortera === 'vikt') {
      lista.innerHTML = urval.length ? `<section class="kravgrupp" aria-labelledby="sa-vikt"><h2 id="sa-vikt">${topp ? `De ${urval.length} högst viktade` : 'Högst vikt först'}</h2>
        <ol class="kravlista sussa-rang">${urval.map(sussaRad).join('')}</ol></section>` : '<p class="tom">Inga poster matchar filtret.</p>';
      return;
    }
    const grupper = [];
    for (const p of urval) {
      if (grupper.at(-1)?.id !== p.avsnitt) grupper.push({ id: p.avsnitt, poster: [] });
      grupper.at(-1).poster.push(p);
    }
    lista.innerHTML = grupper.map(g => {
      const av = avsnitt.get(g.id);
      return `<section class="kravgrupp" aria-labelledby="sa-${esc(g.id)}"><h2 id="sa-${esc(g.id)}"><span class="krav-id">${esc(g.id)}</span> ${esc(av?.rubrik ?? '')}</h2>
        ${av?.sammanfattning ? `<details class="sussa-om"><summary>Om avsnittet</summary><p>${esc(av.sammanfattning)}</p></details>` : ''}
        <ul class="kravlista">${g.poster.map(sussaRad).join('')}</ul></section>`;
    }).join('') || '<p class="tom">Inga poster matchar filtret.</p>';
  };
  const spara = () => {
    const qs = new URLSearchParams([...Object.entries(val).filter(([, x]) => x), ...(topp ? [['topp', String(topp)]] : [])]).toString();
    try { history.replaceState(null, '', `#/krav${qs ? `?${qs}` : ''}`); } catch { /* adressen kan inte ändras */ }
  };
  form.addEventListener('input', (e) => {
    if (!(e.target.name in val)) return;
    val[e.target.name] = e.target.value;
    topp = 0;
    spara();
    rita();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  antal.addEventListener('click', (e) => {
    if (e.target.id !== 'sf-visa-alla') return;
    e.preventDefault();
    topp = 0;
    spara();
    rita();
  });
  // Detaljerna fylls i först när en post öppnas.
  lista.addEventListener('toggle', (e) => {
    const el = e.target;
    if (!el.matches?.('details.sussapost') || !el.open) return;
    const del = el.querySelector('.sussa-detalj');
    if (!del.dataset.fylld) { del.innerHTML = sussaDetalj(perId.get(el.dataset.id), d); del.dataset.fylld = '1'; }
  }, true);
  rita();
  const oppna = q.get('post');
  const el = oppna && perId.has(oppna) ? lista.querySelector(`details[data-id="${CSS.escape(oppna)}"]`) : null;
  // Appen flyttar fokus till rubriken och rullar upp efter att vyn är ritad, så posten får fokus efter det.
  if (el) { el.open = true; setTimeout(() => { el.querySelector('summary').focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }, 0); }
}

const signalTagg = (x) => `<span class="tagg tagg-${esc(x.typ)}">${esc(AVTALSFILTER[x.typ])}</span>`;

function sussaRad(p) {
  const taggar = [p.vikt != null ? `<span class="tagg tagg-vikt" title="Plats ${p.viktRang} av de viktade kriterierna">Vikt ${esc(procent(p.vikt))}</span>` : '', ...p.signaler.map(signalTagg)].filter(Boolean).join('');
  return `<li class="krav krav-${esc(p.status)}"><details class="sussapost" data-id="${esc(p.id)}">
    <summary><span class="krav-id">${esc(p.id)}</span><span class="sussa-rubrik"><strong>${esc(p.rubrik)}</strong><span class="under-text">${esc(TYP[p.typ] ?? p.typ)}${p.kategori === 'system' ? '' : `, ${esc(KATEGORI[p.kategori].toLowerCase())}`}</span>${taggar ? `<span class="sussa-taggar">${taggar}</span>` : ''}</span><span class="kravstatus kravstatus-${esc(p.status)}">${esc(STATUS[p.status])}</span></summary>
    <div class="sussa-detalj"></div>
  </details></li>`;
}

const sida = (k) => `${esc(k.fil)}, sida ${esc(String(k.sida))}`;

// Vikten i utvärderingen och Sussas betyg på Cambios svar (K2).
function viktDel(p, d) {
  if (p.vikt == null) return p.typ === 'utvarderingskriterium' ? '<h3>Vikt i utvärderingen</h3><p>Kriteriet har ingen vikt. Beskrivningen utvärderades inte.</p>' : '';
  const b = p.betyg;
  return `<h3>Vikt i utvärderingen</h3>
    <p>${esc(procent(p.vikt))} av kvalitetsbedömningen, plats ${p.viktRang} av ${d.viktning.antalViktade} viktade kriterier.${b?.viktIUtvarderingen != null ? ` Utvärderingen räknade med ${esc(procent(b.viktIUtvarderingen))}, i omvänd ordning mot viktningsträdet.` : ''}</p>
    ${b ? `<p>Cambios svar fick ${b.poang} av 10 poäng${b.prispaslag ? `, vilket gav ett prispåslag på ${esc(kronor(b.prispaslag))}` : ' och inget prispåslag'}.</p>
    <p class="liten dampad">Källa: ${esc(d.viktning.kallaBetyg)}, sida ${b.sida}${b.motivering ? `. Sussas motivering: ${esc(d.viktning.kallaMotivering)}, sida ${b.motivering}` : ''}.</p>` : ''}`;
}

// Cambios svar i anbudet, avtalets bilaga A1.6 (K2).
function svarDel(p) {
  const s = p.avtal;
  if (!s) return '';
  const svar = s.svar === 'ja' ? 'Cambio svarade ja.' : s.svar === 'nej' ? 'Cambio svarade nej.' : 'Posten har inget kryss att svara ja eller nej på.';
  const text = s.sammanfattning ? `<p>${esc(s.sammanfattning)}</p>`
    : s.maskerat === 'helt' ? '<p class="sussa-maskerat">Cambios beskrivning är maskerad i den utlämnade handlingen.</p>' : '';
  const kallor = [`Kryss: ${sida(s.kryss)}`, ...s.beskrivning.map(b => `${b.maskerad ? 'Maskerad beskrivning' : 'Beskrivning'}: ${sida(b)}`)];
  return `<h3>Cambios svar i anbudet</h3>
    <p><strong>${esc(svar)}</strong>${s.maskerat === 'delvis' ? ' En del av beskrivningen är maskerad.' : ''}</p>
    ${text}
    <p class="liten dampad">${kallor.map(k => esc(k)).join('. ')}.</p>`;
}

// Det som togs bort ur avtalet eller sköts upp 2022 (K3).
function signalDel(p) {
  if (!p.signaler.length) return '';
  return `<h3>Avtalet 2022</h3><ul class="enkel-lista sussa-signaler">${p.signaler.map(x => `<li>${signalTagg(x)} ${esc(x.varfor)}${x.datum ? ` <span class="dampad">Ny leveransdag: ${esc(x.datum.join(', '))}.</span>` : ''}
    <span class="liten dampad under-text">Källa: ${x.kallor.map(k => `${esc(k.dokument)}, ${k.sidor.length > 1 ? 'sidorna' : 'sida'} ${esc(k.sidor.join(', '))}`).join('. ')}.</span></li>`).join('')}</ul>`;
}

function sussaDetalj(p, d) {
  const egna = p.egna.length ? `<ul class="enkel-lista">${p.egna.map(e => `<li><a href="#/krav?vy=egna">${esc(e.id)}</a> ${esc(e.rubrik ?? '')}${e.status ? ` <span class="kravstatus kravstatus-${esc(e.status)}">${esc(STATUS[e.status])}</span>` : ''}</li>`).join('')}</ul>` : '<p class="dampad">Inga kopplade egna krav.</p>';
  return `<div class="sussa-innehall">
    <p class="dampad liten">${esc(TYP[p.typ] ?? p.typ)}${p.sida ? `, sida ${esc(p.sida)} i kravspecifikationen` : ''}. ${esc(KATEGORI_FORKLARING[p.kategori] ?? '')}</p>
    <h3>Kravtext</h3><p class="sussa-text">${esc(p.text)}</p>
    ${p.mervarden.length ? `<h3>Mervärden som bedöms</h3><ul>${p.mervarden.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    ${p.kompletterar.length ? `<p class="liten">Hänger ihop med ${p.kompletterar.map(id => `<a href="#/krav?post=${encodeURIComponent(id)}">${esc(id)}</a>`).join(', ')}.</p>` : ''}
    ${viktDel(p, d)}
    ${svarDel(p)}
    ${signalDel(p)}
    <h3>Vårdkällans lösning</h3><p>${p.losning ? esc(p.losning) : 'Inte byggt i Vårdkällan.'}</p>
    ${p.expert ? `<h3>Hur systemet är experten</h3><p>${esc(p.expert)}</p>` : ''}
    ${p.anmarkning ? `<h3>Det som saknas eller är simulerat</h3><p>${esc(p.anmarkning)}</p>` : ''}
    ${p.avsedd !== p.status && p.avsedd !== 'planerat' ? `<p class="ruta ruta-larm liten">Avsett som ${esc(STATUS[p.avsedd].toLowerCase())}, men ${p.tester.length ? 'alla tester är inte gröna' : 'posten har inga tester'}.</p>` : ''}
    <h3>Tester</h3>${p.tester.length ? `<ul class="testrader">${testrader(p.tester)}</ul>` : '<p class="dampad">Inga automatiska tester än, därför planerad.</p>'}
    <h3>Kopplade egna krav</h3>${egna}
  </div>`;
}

// Bör-krav och målbild som en egen backlogg (K5). Varje rad hänger ihop med poster i Sussas kravspecifikation.
async function visaBor(yta) {
  yta.innerHTML = '<p class="tom">Hämtar bör-krav och målbild.</p>';
  const d = await api('/api/krav/sussa');
  const perId = new Map(d.poster.map(p => [p.id, p]));
  const rad = (b) => `<li class="krav krav-${esc(b.status)}">
    <div class="krav-huvud"><span class="krav-id">${esc(b.id)}</span><h3>${esc(b.text)}</h3><span class="kravstatus kravstatus-${esc(b.status)}">${esc(STATUS[b.status])}</span></div>
    <p class="krav-kalla">Källa: ${esc(b.kalla)}.</p>
    <ul class="enkel-lista bor-poster">${b.poster.map(id => { const p = perId.get(id); return `<li><a href="#/krav?post=${encodeURIComponent(id)}">${esc(id)}</a> ${esc(p?.rubrik ?? '')}${p ? ` <span class="kravstatus kravstatus-${esc(p.status)}">${esc(STATUS[p.status])}</span>` : ''}</li>`; }).join('')}</ul>
  </li>`;
  const grupp = (typ, rubrik, ingress) => {
    const g = d.borkrav.filter(b => b.typ === typ);
    return `<section class="kravgrupp" aria-labelledby="bor-${typ}"><h2 id="bor-${typ}">${esc(rubrik)} <span class="antal">${g.length}</span></h2><p class="dampad liten">${esc(ingress)}</p><ul class="kravlista">${g.map(rad).join('')}</ul></section>`;
  };
  yta.innerHTML = `<div class="ingress-block">
      <p>Det som kravspecifikationen önskar utan att kräva det, och målbilden som kraven ska leda mot, som en egen lista. Varje rad pekar på de poster i Sussas kravspecifikation som den hänger ihop med, och statusen följer posterna: uppfyllt i demon när alla poster är det, planerat när alla är planerade och annars delvis.</p>
      <p class="liten">Meningar med bör som bara anvisar hur anbudssvaret skulle skrivas, till exempel sidantal, finns inte med.</p>
    </div>
    ${grupp('bor', 'Bör-krav', 'Önskemål med ordet bör i kravspecifikationen.')}
    ${grupp('malbild', 'Målbild', 'Målbilden i kapitel 1 och de avsnitt där beställaren beskriver sin målbild.')}`;
}

// Testerna av gränssnittet körs i en webbläsare med Playwright före bygget, inte i själva bygget.
function klientRad(kt) {
  if (!kt) return '';
  return `<p class="dampad liten">Gränssnittet testas dessutom i en webbläsare med Playwright: ${kt.godkanda} av ${kt.antal} tester gröna, ${esc(tidpunkt(kt.tid))}.${kt.aktuell ? '' : ' Gränssnittet har ändrats sedan dess, så de testerna räknas som inaktuella tills de körs igen.'}</p>`;
}

// Klickbudgeten (D6): uppmätt antal steg mot budgeten per flöde.
function klickbudgetTabell(kb) {
  if (!kb) return '<p class="ruta ruta-larm liten">Ingen mätning av klickbudgeten finns.</p>';
  return `<div class="klickbudget">
    <div class="tabellrulle"><table class="tabell siffertabell kb-tabell">
      <caption>Klickbudget per flöde, uppmätt ${esc(tidpunkt(kb.tid))}${kb.aktuell ? '' : ', före den senaste ändringen av gränssnittet'}</caption>
      <thead><tr><th scope="col">Flöde</th><th scope="col">Börjar i</th><th scope="col" class="tal">Uppmätt</th><th scope="col" class="tal">Budget</th><th scope="col">Varav</th></tr></thead>
      <tbody>${kb.floden.map(f => `<tr${f.uppmatt > f.budget ? ' class="avvikande"' : ''}>
        <th scope="row">${esc(f.namn)}</th><td>${esc(f.start)}</td>
        <td class="tal"><strong>${f.uppmatt}</strong>${f.uppmatt > f.budget ? `<span class="avst avst-fel">${ikon.varning}Över budget</span>` : ''}</td><td class="tal">${f.budget}</td>
        <td class="liten">${[[f.klick, 'klick', 'klick'], [f.faltbyten, 'fältbyte', 'fältbyten'], [f.tangenter, 'tangent', 'tangenter']].filter(x => x[0]).map(([n, en, fl]) => `${n} ${n === 1 ? en : fl}`).join(', ')}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="dampad liten">${esc(kb.regler)}</p>
    <p class="liten">Mätningen med verkliga användare görs med <a href="#/anvandartest">användartestet</a>, som ger samma uppgifter till personer som arbetar i vården och räknar på samma sätt.</p>
    <details class="testlista"><summary>Motivering för varje budget</summary><dl class="kb-motivering">${kb.floden.map(f => `<div><dt>${esc(f.namn)}</dt><dd>${esc(f.motivering)}</dd></div>`).join('')}</dl></details>
  </div>`;
}

function kravRad(k) {
  const v = k.var ? VAR[k.var] : null;
  return `<li class="krav krav-${esc(k.status)}">
    <div class="krav-huvud"><span class="krav-id">${esc(k.id)}</span><h3>${esc(k.rubrik)}</h3><span class="kravstatus kravstatus-${esc(k.status)}">${esc(STATUS[k.status])}</span></div>
    <p class="krav-kalla">Källa: ${esc(k.kalla)}${v ? `. Visas i ${v[0] ? `<a href="${v[0]}">${esc(v[1])}</a>` : esc(v[1])}` : ''}.</p>
    ${k.avsedd !== k.status ? `<p class="ruta ruta-larm liten">Avsett som ${esc(STATUS[k.avsedd].toLowerCase())}, men alla tester är inte gröna.</p>` : ''}
    ${k.anmarkning ? `<p class="krav-anm">${esc(k.anmarkning)}</p>` : ''}
    ${'klickbudget' in k ? klickbudgetTabell(k.klickbudget) : ''}
    ${k.tester.length ? `<details class="testlista"><summary>${k.tester.length === 1 ? 'Ett test' : `${k.tester.length} tester`}, ${k.tester.filter(x => x.status === 'grön').length} gröna</summary><ul>${testrader(k.tester)}</ul></details>` : '<p class="dampad liten">Inga automatiska tester än.</p>'}
  </li>`;
}
