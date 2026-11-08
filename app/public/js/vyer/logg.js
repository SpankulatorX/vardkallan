// Logguppföljning för logggranskaren: filter, datum, loggkedjans status och logglistan per patient.
import { esc, api, tidpunkt, datum, ikon, vyRubrik, tom, GRUND, HANDLING, YRKE, idag, plusDagar, medKnapp, notis, dialog } from '../ui.js';

export const namn = 'logg';

const FLAGGOR = [['alla', 'Alla'], ['vard', 'Vårdens åtkomster'], ['nodatkomst', 'Nödåtkomst'], ['nekad', 'Nekade försök'], ['samtycke', 'Samtycke till spärrade uppgifter'], ['arkiv', 'Arkiv och gallring']];
// Runda 9, r5: åtkomster till uppgifter med mycket högt skyddsbehov (Sussa 5.3.1.2).
FLAGGOR.push(['skyddsbehov', 'Mycket högt skyddsbehov']);

export function kedjaRuta(hel, v) {
  return hel
    ? `<div class="kedja-status kedja-hel" role="status">${ikon.bock}<div><strong>Loggkedjan är hel.</strong><span>${v?.antal != null ? `Alla ${esc(v.antal)} rader är kontrollerade` : 'Varje rad är kontrollerad'} mot föregående rads hash. Ingen rad har ändrats eller tagits bort.</span></div></div>`
    : `<div class="kedja-status kedja-bruten" role="alert">${ikon.varning}<div><strong>Loggkedjan är bruten${v?.felRad ? ` vid rad ${esc(v.felRad)}` : ''}.</strong><span>${esc(v?.orsak ?? 'En rad stämmer inte med kedjan.')} Kontakta informationssäkerhet.</span></div></div>`;
}

const patientCell = (r, lank = true) => {
  if (!r.patient) return '<span class="dampad">Ingen patient</span>';
  const n = r.patient.skyddad ? `<span class="skyddad-namn">${ikon.skold}<span>Skyddad identitet</span></span>` : esc(r.patient.namn);
  return `${lank ? `<a href="#/logg/patient/${encodeURIComponent(r.patient.id)}">${n}</a>` : n}<span class="under-text pnr">${esc(r.patient.personnummer)}</span>`;
};

// Förklaring under handlingen: söksträngen, och om raden gäller läskopian för avbrott (D4).
function resursText(r) {
  if (r.resurs && r.handling === 'sok') return `<span class="under-text">${esc(r.resurs.replace(/^sok:/, 'Sökte på '))}</span>`;
  if (r.resurs === 'lasekopia') return '<span class="under-text">Lämnades ut till läskopian för avbrott</span>';
  if (r.resurs === 'lasekopia:slut') return '<span class="under-text">Senaste utlämnandet till läskopian för avbrott</span>';
  if (r.resurs?.startsWith('laslage:')) return '<span class="under-text">Läst i läsläget under ett avbrott</span>';
  if (r.resurs?.startsWith('fhir/') && r.invanare) return '<span class="under-text">Via det öppna API:t</span>';
  if (r.resurs?.startsWith('utskrift:U-')) return `<span class="under-text">Utskrifts-id ${esc(r.resurs.slice(9))}</span>`;
  if (r.resurs?.startsWith('beslut:')) return `<span class="under-text">Arkivbeslut ${esc(r.resurs.slice(7).split(':')[0])}</span>`;
  return '';
}

// En rad från Min journal har invånaren i stället för personal. Patientens egen läsning visas utan namn.
const INVANARE = { egen: 'Patienten själv', vardnadshavare: 'Vårdnadshavare', annan: 'Invånare' };
function vemCell(r) {
  if (r.invanare) return `${esc(r.invanare.namn ?? INVANARE[r.invanare.relation] ?? 'Invånare')}<span class="under-text">${esc(r.invanare.namn ? INVANARE[r.invanare.relation] ?? 'Invånare' : 'Invånare')}, e-legitimation</span>`;
  return `${esc(r.personal?.namn ?? '')}<span class="under-text">${esc(YRKE[r.personal?.yrke] ?? '')}</span>`;
}

export function loggTabell(rader, { visaPatient = true } = {}) {
  if (!rader.length) return tom('Inga loggrader matchar urvalet.');
  return `<div class="tabellrulle"><table class="tabell logg-tabell">
    <thead><tr><th scope="col">Tid</th><th scope="col">Vem</th><th scope="col">Enhet</th>${visaPatient ? '<th scope="col">Patient</th>' : ''}<th scope="col">Handling</th><th scope="col">Grund</th><th scope="col">Syfte</th><th scope="col">Resultat</th></tr></thead>
    <tbody>${rader.map(r => `<tr class="${r.flaggad ? 'flaggad' : ''}${r.resultat === 'nekad' ? ' nekad' : ''}">
      <td>${esc(tidpunkt(r.tid))}</td>
      <td>${vemCell(r)}</td>
      <td>${r.invanare ? '<span class="dampad">Min journal</span>' : esc(r.enhet?.namn ?? '')}</td>
      ${visaPatient ? `<td>${patientCell(r)}</td>` : ''}
      <td>${esc(HANDLING[r.handling] ?? r.handling)}${resursText(r)}</td>
      <td><span class="grund grund-${esc(r.grund)}">${esc(GRUND[r.grund] ?? r.grund)}</span>${r.skyddsniva === 3 ? '<span class="under-text">Mycket högt skyddsbehov</span>' : ''}</td>
      <td>${esc(r.syfte ?? '')}</td>
      <td>${r.resultat === 'nekad' ? `<span class="resultat-nekad">${ikon.las}Nekad</span>` : 'Tillåten'}${r.flaggad ? '<span class="sr">, flaggad för uppföljning</span>' : ''}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

// Runda 6, r1: delarna i logguppföljningen. Åtkomstloggen, säkerhetshändelserna (Sussa 5.3.1.12) och
// stickprovskontrollen (HSLF-FS 2016:40 4 kap. 9 b §).
const DELAR = [['atkomst', 'Åtkomster'], ['sakerhet', 'Säkerhetshändelser'], ['stickprov', 'Stickprov']];
const delflikar = (vy) => `<nav class="delflikar" aria-label="Loggens delar"><ul>${DELAR.map(([k, t]) => `<li><a href="#/logg${k === 'atkomst' ? '' : `?vy=${k}`}"${k === vy ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav>`;
// Export till fil (Sussa 5.2.1.3). Länken laddar ner filen, och exporten loggas på servern.
const exportLankar = (typ, p) => `<p class="loggexport">Exportera ${typ === 'atkomst' ? 'urvalet' : 'säkerhetsloggen'} till fil:
  <a class="knapp liten sekundar" href="/api/logg/export?${new URLSearchParams({ typ, format: 'ndjson', ...p })}" download data-export="ndjson">${ikon.logg}<span>NDJSON</span></a>
  <a class="knapp liten sekundar" href="/api/logg/export?${new URLSearchParams({ typ, format: 'csv', ...p })}" download data-export="csv">${ikon.logg}<span>CSV</span></a>
  <span class="under-text">Raderna kommer i kedjans ordning med hash, så att kedjan kan kontrolleras utanför systemet. Exporten loggas.</span></p>`;

export async function visa(main, _p, q) {
  const vy = DELAR.some(d => d[0] === q.get('vy')) ? q.get('vy') : 'atkomst';
  if (vy === 'sakerhet') return visaSakerhet(main, q);
  if (vy === 'stickprov') return visaStickprov(main);
  const flagga = FLAGGOR.some(f => f[0] === q.get('flagga')) ? q.get('flagga') : 'alla';
  const fran = q.get('fran') ?? plusDagar(idag(), -7);
  const till = q.get('till') ?? idag();
  main.innerHTML = vyRubrik('Logguppföljning', 'Varje åtkomst till varje journal. Nödåtkomst, nekade försök och samtycken flaggas för uppföljning.') + `${delflikar(vy)}
    <form class="loggfilter" id="loggfilter">
      <fieldset class="segment"><legend>Visa</legend>${FLAGGOR.map(([k, t]) => `<input type="radio" id="fl-${k}" name="flagga" value="${k}"${k === flagga ? ' checked' : ''}><label for="fl-${k}">${esc(t)}</label>`).join('')}</fieldset>
      <div class="falt kompakt"><label for="lf-fran">Från</label><input id="lf-fran" name="fran" type="date" value="${esc(fran)}"></div>
      <div class="falt kompakt"><label for="lf-till">Till</label><input id="lf-till" name="till" type="date" value="${esc(till)}"></div>
      <button type="submit" class="knapp">Visa loggen</button>
    </form>
    <form class="loggfilter" id="utskriftsok" role="search" aria-label="Sök utskrift">
      <div class="falt kompakt"><label for="us-id">Utskrifts-id från papperet</label><input id="us-id" name="uid" placeholder="U-XXXXXXXX" maxlength="10" autocomplete="off"></div>
      <button type="submit" class="knapp sekundar">Sök utskrift</button>
    </form>
    <div id="utskriftsvar"></div>
    <form class="loggfilter" id="mottagarsok" role="search" aria-label="Sök utlämnanden på mottagare">
      <div class="falt kompakt"><label for="ms-mottagare">Utlämnat till</label><input id="ms-mottagare" name="mottagare" list="ms-forslag" maxlength="120" autocomplete="off" placeholder="Alla mottagare"><datalist id="ms-forslag"></datalist></div>
      <button type="submit" class="knapp sekundar">Sök utlämnanden</button>
    </form>
    <div id="mottagarsvar"></div>
    <div id="loggresultat"><p class="tom">Hämtar loggen.</p></div>`;
  // Eftersökning av en utlämnad utskrift med id:t som står på varje sida (Sussa 3.1.9.5).
  const us = main.querySelector('#utskriftsok');
  us.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ut = main.querySelector('#utskriftsvar');
    try {
      const u = await api(`/api/utskrift/${encodeURIComponent(us.uid.value.trim().toUpperCase())}`);
      ut.innerHTML = `<div class="ruta ruta-info" role="status"><p><strong>${esc(u.id)}</strong>, utskriven ${esc(tidpunkt(u.tid))} av ${esc(u.av?.namn ?? '')} på ${esc(u.enhet.namn)}. Syfte: ${esc(u.syfte)}. Innehåll: ${esc(u.delar.join(', '))}.</p>
        ${u.utlamnanden.length ? `<p>Utlämnad till ${u.utlamnanden.map(x => `${esc(x.mottagare)} ${esc(tidpunkt(x.utlamnad))}${x.aterlamnad ? `, återlämnad ${esc(tidpunkt(x.aterlamnad))}` : ''}`).join('; ')}.</p>` : '<p>Inte registrerad som utlämnad.</p>'}
        <p><a href="#/logg/patient/${encodeURIComponent(u.patientId)}">Patientens logglista</a></p></div>`;
    } catch (err) { ut.innerHTML = `<p class="ruta ruta-info">${esc(err.message)}</p>`; }
  });
  // Runda 10, r2: utlämnade journalhandlingar per mottagare över alla patienter, med menprövningen (Sussa 3.1.9.5).
  const ms = main.querySelector('#mottagarsok');
  ms.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ut = main.querySelector('#mottagarsvar');
    try {
      const r = await api(`/api/logg/utlamnanden?${new URLSearchParams({ mottagare: ms.mottagare.value.trim(), fran: form.fran.value, till: form.till.value })}`);
      ms.querySelector('#ms-forslag').innerHTML = r.mottagare.map(m => `<option value="${esc(m)}">`).join('');
      ut.innerHTML = r.rader.length ? `<p class="antal-text">${r.antal === 1 ? 'Ett utlämnande' : `${esc(r.antal)} utlämnanden`} mellan ${esc(form.fran.value)} och ${esc(form.till.value)}.</p>
        <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Utlämnad</th><th scope="col">Patient</th><th scope="col">Mottagare och handling</th><th scope="col">Menprövning</th><th scope="col">Återlämnad</th></tr></thead>
        <tbody>${r.rader.map(u => `<tr><td>${esc(tidpunkt(u.utlamnad))}<span class="under-text">${esc(u.av?.namn ?? '')}, ${esc(u.enhet.namn)}</span></td>
          <td><a href="#/logg/patient/${encodeURIComponent(u.patientId)}">${esc(u.patient?.namn ?? '')}</a><span class="under-text">${esc(u.patient?.personnummer ?? '')}</span></td>
          <td><strong>${esc(u.mottagare)}</strong><span class="under-text">${esc(u.beskrivning)}${u.utskriftId ? `, utskrift ${esc(u.utskriftId)}` : ''}</span></td>
          <td>${u.menprovningBeslut ? `${esc(u.menprovningBeslut.beslutText)}<span class="under-text">${esc(u.menprovningBeslut.grundText)} Prövad av ${esc(u.menprovningBeslut.av?.namn ?? '')}.</span>` : esc(u.menprovning ?? '')}</td>
          <td>${u.aterlamnad ? esc(tidpunkt(u.aterlamnad)) : u.aterlamnasSenast ? `Senast ${esc(u.aterlamnasSenast)}${u.forsenad ? ', försenad' : ''}` : '<span class="dampad">Kopia</span>'}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="tom">Inga utlämnanden till den mottagaren under perioden.</p>';
    } catch (err) { ut.innerHTML = `<p class="ruta ruta-info">${esc(err.message)}</p>`; }
  });
  const form = main.querySelector('#loggfilter');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams({ flagga: form.flagga.value, fran: form.fran.value, till: form.till.value });
    location.hash = `#/logg?${p}`;
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'flagga') form.requestSubmit(); });
  const d = await api(`/api/logg?${new URLSearchParams({ flagga, ...(fran ? { fran } : {}), ...(till ? { till } : {}) })}`);
  const flaggade = d.rader.filter(r => r.flaggad).length;
  main.querySelector('#loggresultat').innerHTML = `${kedjaRuta(d.kedjaHel, d.verifiering)}
    <p class="antal-text">${d.rader.length === 1 ? 'En rad' : `${d.rader.length} rader`}${flagga === 'alla' && flaggade ? `, varav ${flaggade} flaggade för uppföljning` : ''}. Nyast först, högst 500.</p>
    ${exportLankar('atkomst', { flagga, fran, till })}
    ${loggTabell(d.rader)}`;
}

// Säkerhetshändelser: inloggningar, misslyckade inloggningar, avvisade anrop, ändrade behörigheter och inställningar,
// exporter och stickprov, i en egen kedja.
async function visaSakerhet(main, q) {
  const typ = q.get('typ') ?? '';
  main.innerHTML = vyRubrik('Logguppföljning', 'Händelser med säkerhetspåverkan, i en egen logg som inte går att ändra.') + `${delflikar('sakerhet')}<div id="sakerhet"><p class="tom">Hämtar säkerhetsloggen.</p></div>`;
  const d = await api(`/api/logg/sakerhet${typ ? `?typ=${encodeURIComponent(typ)}` : ''}`);
  const el = main.querySelector('#sakerhet');
  el.innerHTML = `<form class="loggfilter" id="sakfilter"><div class="falt kompakt"><label for="sk-typ">Typ</label><select id="sk-typ" name="typ"><option value="">Alla typer</option>${Object.entries(d.typer).map(([k, t]) => `<option value="${esc(k)}"${k === typ ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></form>
    ${kedjaRuta(d.verifiering.hel, d.verifiering)}
    <p class="antal-text">${d.rader.length === 1 ? 'En händelse' : `${d.rader.length} händelser`}. Nyast först, högst 500.</p>
    ${exportLankar('sakerhet', {})}
    ${d.rader.length ? `<div class="tabellrulle"><table class="tabell logg-tabell"><thead><tr><th scope="col">Tid</th><th scope="col">Typ</th><th scope="col">Vem</th><th scope="col">Händelse</th><th scope="col">Anrop</th></tr></thead>
      <tbody>${d.rader.map(r => `<tr class="${['inloggning_misslyckad', 'avvisat_anrop', 'andrad_behorighet'].includes(r.typ) ? 'flaggad' : ''}"><td>${esc(tidpunkt(r.tid))}</td><td>${esc(r.typText)}</td>
        <td>${r.personal ? `${esc(r.personal.namn ?? r.personal.id)}<span class="under-text">${esc(YRKE[r.personal.yrke] ?? '')}</span>` : r.invanare ? 'Invånare i Min journal' : '<span class="dampad">Ingen inloggad</span>'}</td>
        <td>${esc(r.beskrivning)}</td><td class="kod">${r.vag ? `${esc(r.metod ?? '')} ${esc(r.vag)}${r.status ? ` <span class="under-text">Svar ${esc(r.status)}</span>` : ''}` : ''}</td></tr>`).join('')}</tbody></table></div>` : tom('Inga säkerhetshändelser matchar urvalet.')}`;
  el.querySelector('#sk-typ').addEventListener('change', (e) => { location.hash = `#/logg?vy=sakerhet${e.target.value ? `&typ=${encodeURIComponent(e.target.value)}` : ''}`; });
}

// Stickprovskontroll: systemet drar åtkomsterna slumpvis och säger vad som ska kontrolleras. Befogad är ett klick,
// och det syns hela tiden hur många som återstår.
async function visaStickprov(main) {
  main.innerHTML = vyRubrik('Logguppföljning', 'Systematiska och återkommande stickprovskontroller av åtkomsten, som HSLF-FS 2016:40 4 kap. 9 b § kräver. Varje kontroll dokumenteras.') + `${delflikar('stickprov')}<div id="stickprov"><p class="tom">Hämtar stickproven.</p></div>`;
  const el = main.querySelector('#stickprov');
  const rita = async (s = null) => {
    const d = await api('/api/stickprov');
    const a = s ?? d.aktuellt;
    const patient = (r) => (r.patient ? `${r.patient.skyddad ? 'Skyddad identitet' : esc(r.patient.namn)} <span class="pnr">${esc(r.patient.personnummer)}</span>` : '');
    el.innerHTML = `<div class="stickprov-huvud">
        <p>${d.dags ? '<strong>Det är dags för ett nytt stickprov.</strong> ' : `Nästa stickprov föreslås ${esc(datum(d.nastaForeslas))}. `}Systemet drar ${esc(d.antal)} åtkomster slumpvis bland vårdens åtkomster de senaste ${esc(d.dagar)} dagarna, som inte har kontrollerats förut. Åtkomster till uppgifter med mycket högt skyddsbehov kommer alltid med när de finns.</p>
        <button type="button" class="knapp${d.dags ? '' : ' sekundar'}" data-dra>${ikon.plus}<span>Dra ett nytt stickprov</span></button>
      </div>
      ${d.kvarTotalt ? `<p class="ruta ruta-info liten" data-kvar>${d.kvarTotalt === 1 ? 'En åtkomst återstår' : `${esc(d.kvarTotalt)} åtkomster återstår`} att granska.</p>` : d.stickprov.length ? '<p class="ruta ruta-info liten" data-kvar>Alla åtkomster i stickproven är granskade.</p>' : ''}
      ${a ? `<section aria-labelledby="sp-rubrik"><h2 id="sp-rubrik">Stickprov ${esc(a.id)}, draget ${esc(tidpunkt(a.skapad))}</h2>
        <p class="antal-text">${esc(a.granskade)} av ${esc(a.antal)} granskade, ${esc(a.kvar)} återstår. Urval bland ${esc(a.urval)} åtkomster.</p>
        <ol class="stickprov-lista">${a.rader.map(r => `<li class="stickprov-rad${r.granskad ? ' granskad' : ''}${r.granskad?.bedomning === 'utreds' ? ' utreds' : ''}">
          <div class="sp-text"><span class="ik-rubrik">${esc(tidpunkt(r.tid))}, ${esc(r.personal?.namn ?? '')} (${esc(YRKE[r.personal?.yrke] ?? '')}), ${esc(r.enhet?.namn ?? '')}</span>
            <span class="under-text">${esc(HANDLING[r.handling] ?? r.handling)}. Grund: ${esc(GRUND[r.grund] ?? r.grund)}${r.syfte ? `. Syfte: ${esc(r.syfte.replace(/\.$/, ''))}` : ''}. Patient: ${patient(r)}</span>
            <span class="under-text sp-kontrollera">${esc(r.kontrollera)}</span>${r.skyddsorsak ? `<span class="under-text">Mycket högt skyddsbehov: ${esc(r.skyddsorsak)}</span>` : ''}
            ${r.granskad ? `<span class="under-text">${r.granskad.bedomning === 'utreds' ? `Ska utredas: ${esc(r.granskad.kommentar ?? '')}` : 'Befogad'}. Granskad ${esc(tidpunkt(r.granskad.tid))} av ${esc(r.granskad.av?.namn ?? '')}.</span>` : ''}</div>
          ${r.granskad ? '' : `<div class="ik-knappar"><button type="button" class="knapp liten" data-befogad="${esc(r.loggId)}">Befogad</button><button type="button" class="knapp liten sekundar" data-utreds="${esc(r.loggId)}">Utred</button></div>`}
        </li>`).join('')}</ol></section>` : tom('Inget stickprov är draget än.')}
      ${d.stickprov.length > 1 ? `<h3>Tidigare stickprov</h3><ul class="stickprov-tidigare">${d.stickprov.slice(1).map(x => `<li><a href="#/logg?vy=stickprov" data-visa="${esc(x.id)}">Stickprov ${esc(x.id)}, ${esc(datum(x.skapad))}</a>: ${esc(x.granskade)} av ${esc(x.antal)} granskade.</li>`).join('')}</ul>` : ''}
      <p class="under-text">${esc(d.regel)}</p>`;
    el.querySelector('[data-dra]').addEventListener('click', async (e) => {
      try {
        const ny = await medKnapp(e.currentTarget, () => api('/api/stickprov', { metod: 'POST', data: {} }));
        notis(`Stickprov ${ny.id} med ${ny.antal} åtkomster är draget.`);
        rita(ny);
      } catch { /* notis visad */ }
    });
    el.querySelectorAll('[data-visa]').forEach(l => l.addEventListener('click', async (e) => { e.preventDefault(); rita(await api(`/api/stickprov/${encodeURIComponent(l.dataset.visa)}`)); }));
    el.querySelectorAll('[data-befogad], [data-utreds]').forEach(b => b.addEventListener('click', async () => {
      const loggId = b.dataset.befogad ?? b.dataset.utreds;
      let data = {};
      if (b.dataset.utreds) {
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Utred åtkomsten</h2><p>Skriv varför åtkomsten ska utredas. Kommentaren sparas med granskningen och kan inte ändras.</p>
          <div class="falt"><label for="sp-kommentar">Varför</label><input id="sp-kommentar" name="kommentar" maxlength="500"></div>
          <p class="dialog-fel form-fel" role="alert" hidden></p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
        { validera: (v) => ((v.kommentar || '').trim().length < 3 ? 'Skriv minst tre tecken.' : null), onOpen: (dl) => dl.querySelector('#sp-kommentar').focus() });
        if (!svar) return;
        data = { bedomning: 'utreds', kommentar: svar.data.kommentar.trim() };
      }
      try {
        const ny = await medKnapp(b, () => api(`/api/stickprov/${encodeURIComponent(a.id)}/rad/${encodeURIComponent(loggId)}`, { metod: 'POST', data }));
        notis(data.bedomning === 'utreds' ? 'Åtkomsten är markerad för utredning.' : `Åtkomsten är granskad. ${ny.kvar === 0 ? 'Stickprovet är klart.' : `${ny.kvar} återstår.`}`);
        rita(ny);
      } catch { /* notis visad */ }
    }));
  };
  await rita();
}

// Logglistan för en patient: underlag för patientens rätt till logginformation.
export const patient = {
  namn: 'loggpatient',
  async visa(main, [id]) {
    main.innerHTML = vyRubrik('Logglista för patient') + '<div id="lp"><p class="tom">Hämtar logglistan.</p></div>';
    const d = await api(`/api/patient/${encodeURIComponent(id)}/logglista`);
    const p = d.patient;
    main.querySelector('h1').textContent = p.skyddad ? 'Logglista, skyddad identitet' : `Logglista för ${p.namn}`;
    main.querySelector('#lp').innerHTML = `<p class="ingress">Personnummer <span class="pnr">${esc(p.personnummer)}</span>. Patienten har rätt att få veta vem som har tagit del av journalen (patientdatalagen 8 kap. 5 §). Listan visar alla åtkomster, även nekade försök.</p>
      ${kedjaRuta(d.kedjaHel)}
      ${loggTabell(d.rader, { visaPatient: false })}
      <p><a href="#/logg">Tillbaka till logguppföljningen</a></p>`;
  },
};
