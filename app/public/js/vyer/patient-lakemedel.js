// Läkemedelslistan: ordinationer med NLL-status, ordination med obligatoriska fält och varningar, utsättning och avstämning mot NLL.
import { esc, api, datum, tidpunkt, migreradEtikett, notis, felNotis, faltFel, medKnapp, dialog, ikon, ORDTYP, idag, plusDagar } from '../ui.js';
import { far } from '../app.js';
import { doldaRad } from './patient.js';
import { nllChip } from './patient-oversikt.js';
import { lakemedelsalderRad } from '../avbrott.js';
import { kontaktRad, nyKontaktData, kontaktNotis } from './patient-vardkontakt.js';
import * as administrering from './administrering.js';

let nastaOverforing = null;
const SATT = { peroralt: 'Peroralt', subkutant: 'Subkutant', intravenost: 'Intravenöst', inhalation: 'Inhalation', sublingualt: 'Under tungan', intramuskulart: 'Intramuskulärt' };

// Delar som inte finns i läskopian under ett avbrott (vidimering och vätskebalans) visas inte då.
const kanske = (p) => p.catch(() => null);

export async function visa(el, ctx) {
  const pid = encodeURIComponent(ctx.id);
  const [d, adm, vid, vb] = await Promise.all([
    api(`/api/patient/${pid}/lakemedel`),
    kanske(api(`/api/patient/${pid}/administreringar`)),
    far('ordinera') ? kanske(api(`/api/patient/${pid}/vidimering`)) : null,
    far('las_matvarden') ? kanske(api(`/api/patient/${pid}/vatskebalans`)) : null,
  ]);
  if (!ctx.aktuell()) return;
  const kanOrdinera = far('ordinera');
  const aktuella = d.ordinationer.filter(o => o.aktuell);
  const ovriga = d.ordinationer.filter(o => !o.aktuell);
  el.innerHTML = `<div class="flikhuvud"><h2>Läkemedel</h2>
      ${kanOrdinera ? `<button type="button" class="knapp" data-ny aria-expanded="false" aria-controls="ordform">${ikon.plus}<span>Ordinera</span></button>` : '<p class="dampad liten">Din yrkesroll kan läsa läkemedelslistan men inte ordinera.</p>'}</div>
    ${lakemedelsalderRad(ctx.id)}
    ${doldaRad(d.dolda)}
    <p class="dampad liten">Läkemedelslistan är gemensam för vårdgivaren och följer Nationella läkemedelslistan (NLL). Varje ändring skickas till NLL och kvitteras. I demon är NLL simulerad.</p>
    <div id="ordform-plats"></div>
    ${vid ? vidimeringPanel(vid) : ''}
    ${kanOrdinera ? nllDemo() : ''}
    <section aria-labelledby="lm-akt"><h3 id="lm-akt">Aktuella ordinationer <span class="antal">${aktuella.length}</span></h3>${tabell(aktuella, kanOrdinera, true)}</section>
    ${adm && (adm.doser.length || adm.vidBehov.length || adm.utanTider.length || adm.vantarPaHandelse.length || adm.kommandeHandelser?.length) ? `<section class="lm-sektion" aria-labelledby="lm-adm" id="lm-adm-sektion"><h3 id="lm-adm">Dagens administreringar</h3>${administrering.patientDoser(ctx.id, adm)}</section>` : ''}
    ${kanOrdinera && vid?.kan?.kan ? '<section class="lm-sektion" aria-labelledby="lm-genomgang"><h3 id="lm-genomgang">Läkemedelsgenomgång</h3><p class="liten">Systemet tar fram indikation, dubbelmedicinering, interaktioner, passerade uppföljningar och en läkemedelsberättelse ur historiken.</p><button type="button" class="knapp sekundar" data-genomgang>Gör läkemedelsgenomgång</button></section>' : ''}
    ${vb ? vatskebalansSektion(vb) : ''}
    ${ovriga.length ? `<section aria-labelledby="lm-utsatt"><h3 id="lm-utsatt">Utsatta och avslutade <span class="antal">${ovriga.length}</span></h3>${tabell(ovriga, kanOrdinera, false)}</section>` : ''}`;
  if (adm) administrering.koppla(el.querySelector('#lm-adm-sektion') ?? document.createElement('div'), () => ctx.ladda());

  el.querySelector('[data-ny]')?.addEventListener('click', (e) => {
    const plats = el.querySelector('#ordform-plats');
    if (plats.firstChild) { plats.innerHTML = ''; e.currentTarget.setAttribute('aria-expanded', 'false'); return; }
    e.currentTarget.setAttribute('aria-expanded', 'true');
    ordinationsForm(plats, ctx);
  });
  // Från snabbvalet Ordinera i översikten (lakemedel/ny) öppnas formuläret direkt.
  if (ctx.sub === 'ny' && kanOrdinera) el.querySelector('[data-ny]').click();
  el.addEventListener('click', async (e) => {
    const v = e.target.closest('[data-vidimera],[data-genomgang],[data-vatska]');
    if (v?.dataset.vidimera != null) {
      try {
        await medKnapp(v, () => api(`/api/patient/${pid}/vidimering`, { metod: 'POST', data: {} }));
        notis('Läkemedelslistan är vidimerad.');
        ctx.ladda();
      } catch { /* notis visad */ }
      return;
    }
    if (v?.dataset.genomgang != null) return genomgang(ctx);
    if (v?.dataset.vatska != null) return registreraVatska(ctx, v.dataset.vatska);
    const b = e.target.closest('[data-utsatt],[data-avstam],[data-nll]');
    if (!b) return;
    if (b.dataset.nll) {
      try {
        const r = await medKnapp(b, () => api('/api/demo/nll-timeout', { metod: 'POST', data: b.dataset.nll === 'fel' ? { lage: 'fel' } : {} }));
        nastaOverforing = r.nastaOverforing;
        notis(nastaOverforing === 'fel' ? 'Nästa överföring till NLL får ett felsvar.' : 'Nästa överföring till NLL får timeout.', 'info');
        el.querySelector('#nll-lage').textContent = lageText();
      } catch { /* notis visad */ }
    } else if (b.dataset.utsatt) {
      const o = d.ordinationer.find(x => String(x.id) === b.dataset.utsatt);
      // Systemet kontrollerar först om läkemedlet har särskilda observationer vid utsättning (Sussa 3.5.2.8).
      let k = { varningar: [] };
      try { k = await medKnapp(b, () => api(`/api/ordination/${o.id}/utsattning`)); } catch { return; }
      const allv = k.varningar.filter(x => x.niva === 'allvarlig');
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Sätt ut ${esc(o.lakemedel?.namn)}</h2>
          ${k.varningar.length ? `<div class="varningslista" role="alert"><h3>${ikon.varning}<span>Särskilda observationer vid utsättning</span></h3>
            <ul>${k.varningar.map(x => `<li><strong>${x.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(x.text)}${x.forslag ? ` <em>${esc(x.forslag)}</em>` : ''}</li>`).join('')}</ul>
            <p class="demoregel">${esc(k.anmarkning ?? 'Varningarna är demoregler, inte kliniskt beslutsstöd.')}</p></div>` : ''}
          <p>Ordinationen raderas inte. Den flyttas till utsatta med orsak, tid och vem som satte ut den, och utsättningen skickas till NLL.</p>
          <div class="falt"><label for="ut-orsak">Orsak till utsättningen <span class="obl">(obligatoriskt)</span></label><textarea id="ut-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
          <p class="dialog-fel form-fel" role="alert" hidden></p>
          <div class="knapprad"><button type="button" class="knapp${allv.length ? ' knapp-allvar' : ''}" data-varde="ok">${allv.length ? 'Sätt ut trots varningen' : 'Sätt ut'}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (x) => (x.orsak.trim().length < 3 ? 'Ange orsaken med minst tre tecken.' : null) });
      if (!svar) return;
      try {
        const r = await api(`/api/ordination/${o.id}/utsatt`, { metod: 'POST', data: { orsak: svar.data.orsak.trim(), kvitteradeVarningar: allv.map(x => ({ regel: x.regel })) } });
        nastaOverforing = null;
        notis(`${o.lakemedel?.namn} är utsatt. ${nllResultat(r.nll)}`, r.nll.status === 'kvitterad' ? 'ok' : 'info');
        ctx.ladda();
      } catch (err) { felNotis(err); }
    } else if (b.dataset.avstam) {
      try {
        const r = await medKnapp(b, () => api(`/api/ordination/${b.dataset.avstam}/nll-avstam`, { metod: 'POST', data: {} }));
        nastaOverforing = null;
        notis(r.resultat === 'fanns_registrerad'
          ? `Avstämningen visar att NLL hade registrerat ordinationen. Kvittens ${r.kvittens}.`
          : `Ordinationen saknades i NLL och har skickats igen. ${nllResultat(r.nll)}`);
        ctx.ladda();
      } catch { /* notis visad */ }
    }
  });
}

const lageText = () => (nastaOverforing === 'fel' ? 'Nästa överföring får ett felsvar.' : nastaOverforing === 'timeout' ? 'Nästa överföring får timeout.' : 'Nästa överföring går som vanligt.');

function nllDemo() {
  return `<details class="demo-panel"><summary>Demo: simulera problem mot NLL</summary>
    <p>En timeout får aldrig dölja en lyckad förskrivning. Simulera ett fel, ordinera sedan, och se att ordinationen ändå syns i listan med status Okänd, kontrolleras. Stäm sedan av mot NLL.</p>
    <div class="knapprad"><button type="button" class="knapp sekundar liten" data-nll="timeout">Simulera timeout mot NLL</button><button type="button" class="knapp sekundar liten" data-nll="fel">Simulera fel från NLL</button></div>
    <p class="liten" id="nll-lage" aria-live="polite">${esc(lageText())}</p>
  </details>`;
}

export function nllResultat(nll) {
  if (!nll) return '';
  if (nll.status === 'kvitterad') return `NLL kvitterade överföringen (${nll.kvittens}).`;
  if (nll.status === 'timeout') return 'Överföringen till NLL fick timeout. Ordinationen gäller och visas i listan med status Okänd, kontrolleras. Stäm av mot NLL.';
  if (nll.status === 'fel') return 'NLL svarade med fel. Ordinationen visas i listan med status Fel från NLL. Stäm av för att skicka den igen.';
  return '';
}

function tabell(rader, kanOrdinera, aktuella) {
  if (!rader.length) return '<p class="tom liten">Inga.</p>';
  return `<div class="tabellrulle"><table class="tabell lm-tabell">
    <thead><tr><th scope="col">Läkemedel</th><th scope="col">Dosering</th><th scope="col">Typ</th><th scope="col">Ordinationsorsak</th><th scope="col">${aktuella ? 'Uppföljning' : 'Utsatt'}</th><th scope="col">NLL</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
    <tbody>${rader.map(o => `<tr>
      <td><strong>${esc(o.lakemedel?.namn)}</strong> <span class="dampad">${esc(o.lakemedel?.styrka)} ${esc(o.lakemedel?.form)}</span>
        <span class="under-text">ATC ${esc(o.lakemedel?.atc)}, ordinerat ${esc(datum(o.start))} av ${esc(o.ordineradAv?.namn ?? '')}, ${esc(o.vardenhet?.namn ?? '')}</span>${migreradEtikett(o)}
        ${o.kvitteradeVarningar?.length ? `<span class="under-text">Kvitterade varningar: ${o.kvitteradeVarningar.map(k => `${esc(k.regel)} (${esc(k.motivering)})`).join('; ')}</span>` : ''}</td>
      <td>${esc(o.dosering)}${o.tider?.length ? `<span class="under-text">Kl. ${esc(o.tider.join(', '))}</span>` : ''}${o.administrationssattText ? `<span class="under-text">${esc(o.administrationssattText)}</span>` : ''}${o.vardhandelse ? `<span class="under-text">Inför ${esc(o.vardhandelse.text.toLowerCase())}${o.vardhandelse.administreras ? `, ges ${esc(tidpunkt(o.vardhandelse.administreras))}` : ', väntar på tid'}${o.vardhandelse.foljerTidbok ? '. Tiden följer tidboken' : ''}</span>${o.vardhandelse.forklaring ? `<span class="under-text">${esc(o.vardhandelse.forklaring)}</span>` : ''}` : ''}</td>
      <td>${esc(ORDTYP[o.typ] ?? o.typ)}</td>
      <td>${esc(o.ordinationsorsak)}</td>
      <td>${aktuella ? `${esc(datum(o.uppfoljningsdatum))}${o.slut ? `<span class="under-text">Slut ${esc(datum(o.slut))}</span>` : ''}` : (o.utsatt ? `${esc(datum(o.utsatt.tid))}<span class="under-text">${esc(o.utsatt.orsak ?? '')}, ${esc(o.utsatt.av ?? '')}</span>` : `Slut ${esc(datum(o.slut))}`)}</td>
      <td>${nllChip(o.nll_status)}</td>
      <td class="atgarder">
        ${kanOrdinera && ['okand_kontrolleras', 'fel'].includes(o.nll_status) ? `<button type="button" class="knapp liten" data-avstam="${o.id}">Stäm av mot NLL</button>` : ''}
        ${kanOrdinera && o.status === 'aktiv' ? `<button type="button" class="knapp liten sekundar" data-utsatt="${o.id}">Sätt ut</button>` : ''}
        <details class="historik"><summary>Historik</summary><ol>${(o.historik ?? []).map(h => `<li><time>${esc(tidpunkt(h.tid))}</time> ${esc(h.handelse)}${h.detalj ? `: ${esc(h.detalj)}` : ''}${h.av ? ` <span class="dampad">(${esc(h.av)})</span>` : ''}</li>`).join('')}</ol></details>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function ordinationsForm(plats, ctx) {
  const i = idag();
  plats.innerHTML = `<form class="ordform" id="ordform" novalidate aria-labelledby="ord-rubrik">
    <h3 id="ord-rubrik" tabindex="-1">Ny ordination</h3>
    <div data-kontakt-plats></div>
    <div class="falt lm-sok"><label for="lm-sok">Läkemedel <span class="obl">(obligatoriskt)</span></label>
      <input id="lm-sok" type="search" autocomplete="off" placeholder="Sök på namn, substans eller ATC-kod" aria-describedby="lm-valt" aria-controls="lm-traffar">
      <input type="hidden" name="lakemedelId">
      <ul class="lm-traffar" id="lm-traffar" aria-label="Träffar i läkemedelskatalogen"></ul>
      <p class="hjalp" id="lm-valt" aria-live="polite">Inget läkemedel valt.</p>
    </div>
    <div class="falt-rad">
      <div class="falt bred"><label for="o-dosering">Dosering <span class="obl">(obligatoriskt)</span></label><input id="o-dosering" name="dosering" required maxlength="300" placeholder="Till exempel 1 tablett morgon och kväll"></div>
      <div class="falt smal"><label for="o-dos">Dos</label><input id="o-dos" name="dos" inputmode="decimal"></div>
      <div class="falt smal"><label for="o-dosenhet">Enhet</label><input id="o-dosenhet" name="dosEnhet" placeholder="mg"></div>
      <div class="falt smal"><label for="o-tider">Tider</label><input id="o-tider" name="tider" placeholder="08, 20"></div>
    </div>
    <div class="falt-rad">
      <div class="falt"><label for="o-typ">Typ</label><select id="o-typ" name="typ"><option value="staende">Stående</option><option value="vid_behov">Vid behov</option><option value="tillfallig">Tillfällig</option></select></div>
      <div class="falt"><label for="o-satt">Administrationssätt</label><select id="o-satt" name="administrationssatt">${Object.entries(SATT).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
      <div class="falt bred"><label for="o-orsak">Ordinationsorsak <span class="obl">(obligatoriskt)</span></label><input id="o-orsak" name="ordinationsorsak" required maxlength="300"></div>
    </div>
    <input type="hidden" name="mall"><input type="hidden" name="volymMl">
    <p class="forslag-varfor" id="o-forslag" aria-live="polite" hidden></p>
    <details class="o-handelse"><summary>Ges inför en planerad vårdhändelse</summary>
      <input type="hidden" name="vhVal">
      <div class="vh-val" data-vh-val aria-live="polite"><p class="hjalp">Hämtar patientens bokningar.</p></div>
      <div class="falt-rad">
        <div class="falt bred" data-vh-ny hidden><label for="o-vh">Ny vårdhändelse</label><input id="o-vh" name="vardhandelse" maxlength="120" placeholder="Till exempel elkonvertering"></div>
        <div class="falt smal"><label for="o-vh-t">Timmar före</label><input id="o-vh-t" name="forskjutning" inputmode="decimal" value="1"></div>
      </div>
      <p class="hjalp">Ordinationen får inga fasta tider. Tiden kommer från tidboken: när vårdhändelsen bokas, bokas om eller avbokas räknar systemet om när läkemedlet ska ges.</p>
    </details>
    <div class="falt-rad">
      <div class="falt"><label for="o-upp">Uppföljningsdatum <span class="obl">(obligatoriskt)</span></label><input id="o-upp" name="uppfoljningsdatum" type="date" required min="${i}" value=""></div>
      <div class="falt"><label for="o-start">Startdatum</label><input id="o-start" name="start" type="date" value="${i}"></div>
      <div class="falt"><label for="o-slut">Slutdatum</label><input id="o-slut" name="slut" type="date"></div>
    </div>
    <p class="hjalp">Ordinationsorsak och uppföljningsdatum krävs av Nationella läkemedelslistan. Förslag på uppföljning: <button type="button" class="lanknapp" data-upp="14">om två veckor</button>, <button type="button" class="lanknapp" data-upp="90">om tre månader</button>.</p>
    <div id="varningar"></div>
    <p class="form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="submit" class="knapp" data-spara>Kontrollera och spara</button><button type="button" class="knapp text" data-stang>Avbryt</button></div>
  </form>`;
  const form = plats.querySelector('form');
  const kontakt = kontaktRad(form.querySelector('[data-kontakt-plats]'), ctx);
  const sok = form.querySelector('#lm-sok');
  // Fokus i sökfältet, så att det går att börja skriva läkemedlets namn direkt.
  sok.focus();
  const traffar = form.querySelector('#lm-traffar');
  let timer = null;
  let kontrollerad = null;
  // Runda 5 (r3): varningarna som visas. En ny kontroll med samma varningar ritar inte om dem, så att en motivering som
  // redan är skriven finns kvar när systemets förslag på dos kommer efter den första kontrollen.
  let visadeVarningar = null;
  // Fält som förskrivaren har ändrat sedan läkemedlet valdes.
  const rorda = new Set();
  form.addEventListener('input', (e) => { if (e.target.name) rorda.add(e.target.name); });
  form.addEventListener('change', (e) => { if (e.target.name) rorda.add(e.target.name); });
  sok.addEventListener('input', () => {
    clearTimeout(timer);
    const v = sok.value.trim();
    if (v.length < 2) { traffar.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const lista = await api(`/api/lakemedel/katalog?q=${encodeURIComponent(v)}`);
        traffar.innerHTML = lista.length ? lista.slice(0, 8).map(l => `<li><button type="button" data-lm="${esc(l.id)}" data-namn="${esc(`${l.namn} ${l.styrka} ${l.form}`)}"><strong>${esc(l.namn)}</strong> ${esc(l.styrka)} ${esc(l.form)} <span class="dampad">${esc(l.substans)}, ATC ${esc(l.atc)}</span></button></li>`).join('') : '<li class="tom liten">Inget läkemedel i katalogen matchar.</li>';
      } catch (e) { felNotis(e); }
    }, 180);
  });
  traffar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lm]');
    if (!b) return;
    form.lakemedelId.value = b.dataset.lm;
    form.querySelector('#lm-valt').textContent = `Valt: ${b.dataset.namn}`;
    sok.value = b.dataset.namn;
    traffar.innerHTML = '';
    kontrollerad = null;
    form.querySelector('#varningar').innerHTML = '';
    visadeVarningar = null;
    rorda.clear();
    form.dosering.focus();
    // Fördefinierad ordination (Sussa 3.5.1.3): systemet föreslår dos, administrationssätt, tider och uppföljning ur
    // produkten och patienten. Förskrivaren ändrar bara det som avviker.
    try {
      const f = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel/forslag?lakemedelId=${encodeURIComponent(b.dataset.lm)}`);
      if (form.lakemedelId.value !== b.dataset.lm) return;
      // Ett fält som förskrivaren redan har ändrat medan förslaget hämtades skrivs inte över.
      const satt = (namn, v) => { if (!rorda.has(namn) && v != null && v !== '') form[namn].value = v; };
      satt('dosering', f.dosering);
      satt('dos', f.dos);
      satt('dosEnhet', f.dosEnhet);
      satt('tider', (f.tider ?? []).join(', '));
      satt('typ', f.typ);
      satt('administrationssatt', f.administrationssatt);
      satt('uppfoljningsdatum', f.uppfoljningsdatum);
      form.mall.value = f.mall ?? '';
      form.volymMl.value = f.volymMl ?? '';
      const fv = form.querySelector('#o-forslag');
      fv.textContent = `Förslag ur ${f.mallnamn ? `mallen ${f.mallnamn}` : 'produktens styrka och form'}. ${f.varfor.filter(x => !x.startsWith('Mallen')).join(' ')} ${f.anmarkning}`.replace(/\s+/g, ' ').trim();
      fv.hidden = false;
      if (!rorda.size) (f.dosering ? form.ordinationsorsak : form.dosering).focus();
    } catch { if (!rorda.size) form.dosering.focus(); }
  });
  form.addEventListener('click', (e) => {
    const u = e.target.closest('[data-upp]');
    if (u) { form.uppfoljningsdatum.value = plusDagar(form.start.value || i, Number(u.dataset.upp)); rorda.add('uppfoljningsdatum'); }
    if (e.target.closest('[data-stang]')) { plats.innerHTML = ''; plats.closest('.flikinnehall')?.querySelector('[data-ny]')?.setAttribute('aria-expanded', 'false'); }
  });
  form.addEventListener('input', (e) => { if (!e.target.closest('#varningar') && e.target !== sok) kontrollerad = null; });
  // Planerad vårdhändelse (Sussa 3.5.2.7): systemet föreslår patientens bokningar på vårdenheten, med den som passar
  // ordinationsorsaken först, och läkaren väljer med ett klick. Utan bokning sätter systemet upp vårdhändelsen på
  // väntelistan.
  form.querySelector('.o-handelse').addEventListener('toggle', (e) => {
    // Tiden kommer från vårdhändelsen, så ordinationen får inga fasta tider.
    form.tider.disabled = e.target.open;
    kontrollerad = null;
    if (e.target.open) vardhandelseVal(form, ctx, () => { kontrollerad = null; });
  });

  const data = () => ({
    lakemedelId: form.lakemedelId.value, dosering: form.dosering.value.trim(),
    dos: form.dos.value.trim() ? Number(form.dos.value.replace(',', '.')) : null, dosEnhet: form.dosEnhet.value.trim() || null,
    tider: form.tider.value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean), typ: form.typ.value, vidBehov: form.typ.value === 'vid_behov',
    ordinationsorsak: form.ordinationsorsak.value.trim(), uppfoljningsdatum: form.uppfoljningsdatum.value, start: form.start.value || i, slut: form.slut.value || null,
    administrationssatt: form.administrationssatt.value, mall: form.mall.value || null, volymMl: form.volymMl.value ? Number(form.volymMl.value) : null,
    ...vardhandelseData(form),
  });
  const NAMN = { lakemedelId: 'lakemedelId', dosering: 'dosering', dos: 'dos', typ: 'typ', ordinationsorsak: 'ordinationsorsak', uppfoljningsdatum: 'uppfoljningsdatum', start: 'start', slut: 'slut' };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knapp = form.querySelector('[data-spara]');
    const o = data();
    if (!o.lakemedelId) { faltFel(form, { message: 'Välj ett läkemedel i katalogen.', data: {} }); sok.focus(); return; }
    try {
      await medKnapp(knapp, async () => {
        // Första steget: kontroll. Varningar visas och allvarliga måste kvitteras med motivering.
        const nyckel = JSON.stringify(o);
        if (kontrollerad !== nyckel) {
          const k = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel/kontroll`, { metod: 'POST', data: o });
          kontrollerad = nyckel;
          const varningar = k.varningar.length ? JSON.stringify(k.varningar.map(v => [v.regel, v.niva, v.text])) : null;
          if (!varningar) form.querySelector('#varningar').innerHTML = '';
          if (varningar && varningar !== visadeVarningar) { visadeVarningar = varningar; visaVarningar(form, k); knapp.textContent = 'Spara ordinationen'; return; }
          visadeVarningar = varningar;
        }
        const kv = [...form.querySelectorAll('[data-motivering]')].map(t => ({ regel: t.dataset.motivering, motivering: t.value.trim() }));
        const saknas = kv.filter(k => k.motivering.length < 3);
        if (saknas.length) {
          const t = form.querySelector(`[data-motivering="${saknas[0].regel}"]`);
          t.setAttribute('aria-invalid', 'true'); t.focus();
          throw Object.assign(new Error('Allvarliga varningar måste kvitteras med en motivering innan ordinationen sparas.'), { status: 400, data: {} });
        }
        const r = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedel`, { metod: 'POST', data: { ...o, kvitteradeVarningar: kv, ...nyKontaktData(kontakt) } });
        nastaOverforing = null;
        notis(`${r.ordination.lakemedel?.namn} är ordinerat. ${nllResultat(r.nll)}`, r.nll.status === 'kvitterad' ? 'ok' : 'info');
        kontaktNotis(r);
        ctx.ladda();
      }, form);
    } catch (err) {
      if (err.status === 400 && err.data?.varningar) { visaVarningar(form, err.data); }
      else if (err.status === 400) faltFel(form, err, NAMN);
    }
  });
}

// Vårdhändelsen som läkaren har valt: en bokning, en post på väntelistan eller en ny vårdhändelse.
function vardhandelseData(form) {
  if (!form.querySelector('.o-handelse').open) return {};
  const val = form.vhVal.value;
  const forskjutningTimmar = -Number(form.forskjutning.value.replace(',', '.') || 0);
  if (val.startsWith('bokning:')) return { vardhandelse: { bokningId: Number(val.slice(8)), forskjutningTimmar }, tider: [] };
  if (val.startsWith('post:')) return { vardhandelse: { vantelistaId: Number(val.slice(5)), forskjutningTimmar }, tider: [] };
  if (val === 'ny') return { vardhandelse: { text: form.vardhandelse.value.trim(), forskjutningTimmar }, tider: [] };
  return {};
}

async function vardhandelseVal(form, ctx, andrad) {
  const ruta = form.querySelector('[data-vh-val]');
  if (ruta.dataset.hamtad) return;
  let f;
  try { f = await api(`/api/patient/${encodeURIComponent(ctx.id)}/vardhandelse/forslag?text=${encodeURIComponent(form.ordinationsorsak.value.trim())}`); } catch (e) { ruta.innerHTML = `<p class="dampad liten">${esc(e.message)}</p>`; return; }
  ruta.dataset.hamtad = '1';
  const val = [
    ...f.bokningar.map(b => ({ v: `bokning:${b.id}`, rek: b.rekommenderad, text: `${b.text}, ${tidpunkt(b.start)}`, under: `Bokad ${b.tidstypText.toLowerCase()}${b.vardgivare ? ` hos ${b.vardgivare}` : ''}` })),
    ...f.vantelista.map(p => ({ v: `post:${p.id}`, rek: p.rekommenderad, text: p.text, under: `På väntelistan, ${(p.tidstypText ?? '').toLowerCase()} hos ${p.yrkesrollText}, väntar på tid` })),
    { v: 'ny', rek: false, text: 'Ny vårdhändelse', under: f.ny.text },
  ];
  const forval = val.find(x => x.rek)?.v ?? 'ny';
  ruta.innerHTML = `<p class="etikett" id="vh-rubrik">Vårdhändelse</p>
    <div class="knappval-lista vh-lista" role="group" aria-labelledby="vh-rubrik">${val.map(x => `<button type="button" class="knapp sekundar liten" data-vh="${esc(x.v)}" aria-pressed="false"><span>${esc(x.text)}${x.rek ? ' <span class="tagg">Föreslås</span>' : ''}</span><span class="under-text">${esc(x.under)}</span></button>`).join('')}</div>
    <p class="hjalp">${esc(f.hjalp)}</p>`;
  const valj = (v) => {
    form.vhVal.value = v;
    for (const b of ruta.querySelectorAll('[data-vh]')) b.setAttribute('aria-pressed', String(b.dataset.vh === v));
    form.querySelector('[data-vh-ny]').hidden = v !== 'ny';
    andrad();
  };
  ruta.addEventListener('click', (e) => { const b = e.target.closest('[data-vh]'); if (b) { valj(b.dataset.vh); if (b.dataset.vh === 'ny') form.vardhandelse.focus(); } });
  valj(forval);
}

function visaVarningar(form, k) {
  const allv = k.varningar.filter(v => v.niva === 'allvarlig');
  const obs = k.varningar.filter(v => v.niva !== 'allvarlig');
  const regler = [...new Set(allv.map(v => v.regel))];
  const ut = form.querySelector('#varningar');
  ut.innerHTML = `<div class="varningslista" role="alert">
    <h4>${ikon.varning}<span>${k.varningar.length === 1 ? 'En varning' : `${k.varningar.length} varningar`} före sparande</span></h4>
    ${allv.length ? `<ul class="varn-allvarlig">${allv.map(v => `<li><strong>Allvarlig.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${obs.length ? `<ul class="varn-observera">${obs.map(v => `<li><strong>Observera.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${regler.map((r, n) => `<div class="falt"><label for="kv-${n}">Motivering för att ordinera trots varningen (${esc(r.replace(/_/g, ' '))}) <span class="obl">(obligatoriskt)</span></label><textarea id="kv-${n}" rows="2" data-motivering="${esc(r)}" maxlength="500"></textarea></div>`).join('')}
    <p class="demoregel">${esc(k.anmarkning ?? 'Varningarna är demoregler, inte kliniskt beslutsstöd.')}</p>
  </div>`;
  ut.querySelector('textarea')?.focus();
}

// Vidimering (Sussa 3.5.2.9): vad som har ändrats sedan den senaste vidimeringen, och hela listan vidimeras med ett klick.
function vidimeringPanel(v) {
  const rad = (o) => `<li>${o.andring === 'utsatt' ? 'Utsatt' : o.andring === 'andrad' ? 'Ändrad' : 'Ny'}: <strong>${esc(o.lakemedel?.namn)}</strong> ${esc(o.dosering)}
    <span class="dampad">${o.andring === 'utsatt' ? `${esc(tidpunkt(o.utsatt?.tid))}${o.utsatt?.av ? ` av ${esc(o.utsatt.av)}` : ''}, ${esc(o.utsatt?.orsak ?? '')}` : `${esc(tidpunkt(o.skapad))} av ${esc(o.ordineradAv?.namn ?? '')}, ${esc(o.vardenhet?.namn ?? '')}`}</span></li>`;
  const andr = [...v.andringar.nya, ...v.andringar.utsatta];
  return `<section class="vidimering${v.behovs ? ' behovs' : ''}" aria-labelledby="vid-rubrik">
    <h3 id="vid-rubrik">Vidimering av pågående ordinationer</h3>
    <p>${esc(v.text)}</p>
    ${andr.length ? `<ul>${andr.map(rad).join('')}</ul>` : ''}
    ${v.behovs && v.kan?.kan ? '<button type="button" class="knapp" data-vidimera>Vidimera listan</button>' : ''}
    ${v.kan?.varfor ? `<p class="dampad liten">${esc(v.kan.varfor)}</p>` : ''}
    ${v.dolda?.sparrade ? '<p class="dampad liten">Ordinationer från spärrade vårdenheter ingår inte i vidimeringen.</p>' : ''}
  </section>`;
}

// Vätskebalans (Sussa 3.5.3.1, 3.5.2.21): intag och förluster i dag, med administrerad volym inräknad av systemet.
const ml = (n) => String(n).replace('.', ',');
const klockslagAv = (iso) => new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
function vatskebalansSektion(vb) {
  const kan = far('registrera_matvarde');
  return `<section class="lm-sektion" aria-labelledby="lm-vb"><h3 id="lm-vb">Vätskebalans i dag</h3>
    <p class="vb-summa"><span>In ${ml(vb.summaIn)} ml</span><span>Ut ${ml(vb.summaUt)} ml</span><span>Balans ${vb.balans > 0 ? '+' : ''}${ml(vb.balans)} ml</span></p>
    ${vb.poster.length ? `<ul class="liten">${vb.poster.map(p => `<li>${esc(klockslagAv(p.tid))} ${p.riktning === 'in' ? 'In' : 'Ut'}: ${esc(p.typText)} ${ml(p.volymMl)} ml${p.automatisk ? ' <span class="tagg">Från administrering</span>' : ''} <span class="dampad">${esc(p.registreradAv ?? '')}</span></li>`).join('')}</ul>` : '<p class="tom liten">Inget registrerat i dag.</p>'}
    ${kan ? '<div class="knapprad"><button type="button" class="knapp liten sekundar" data-vatska="in">Registrera intag</button><button type="button" class="knapp liten sekundar" data-vatska="ut">Registrera förlust</button></div>' : ''}
    <p class="dampad liten">Läkemedel som ges intravenöst eller i en infusion räknas in av systemet när dosen ges.</p>
  </section>`;
}

async function registreraVatska(ctx, riktning) {
  const typer = riktning === 'in' ? [['dryck', 'Dryck'], ['mat', 'Mat och sondnäring'], ['infusion', 'Infusion']] : [['urin', 'Urin'], ['dran', 'Dränage'], ['krakning', 'Kräkning'], ['avforing', 'Avföring']];
  const svar = await dialog(`<form><h2 id="dlg-rubrik">${riktning === 'in' ? 'Registrera intag' : 'Registrera förlust'}</h2>
    <div class="falt-rad"><div class="falt"><label for="vb-typ">Typ</label><select id="vb-typ" name="typ">${typer.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
    <div class="falt"><label for="vb-ml">Volym i ml <span class="obl">(obligatoriskt)</span></label><input id="vb-ml" name="volymMl" inputmode="numeric" required></div></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (!(Number(x.volymMl.replace(',', '.')) > 0) ? 'Ange volymen i ml.' : null) });
  if (!svar) return;
  try {
    await api(`/api/patient/${encodeURIComponent(ctx.id)}/vatskebalans`, { metod: 'POST', data: { riktning, typ: svar.data.typ, volymMl: Number(svar.data.volymMl.replace(',', '.')) } });
    notis('Vätskebalansen är registrerad.');
    ctx.ladda();
  } catch (e) { felNotis(e); }
}

// Läkemedelsgenomgång (Sussa 3.5.1.6, 3.5.1.11). Systemet tar fram fynden och läkemedelsberättelsen, läkaren läser,
// kompletterar och sparar.
async function genomgang(ctx) {
  let g;
  try { g = await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedelsgenomgang`); } catch (e) { felNotis(e); return; }
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Läkemedelsgenomgång</h2>
    <h3>Pågående läkemedel och indikation</h3>
    <ul class="liten">${g.ordinationer.map(o => `<li><strong>${esc(o.lakemedel?.namn)}</strong> ${esc(o.dosering)}. ${esc(o.ordinationsorsak)}</li>`).join('')}</ul>
    <h3>Systemets fynd</h3>
    ${g.fynd.length ? `<ul class="genomgang-fynd">${g.fynd.map(f => `<li><strong>${f.niva === 'allvarlig' ? 'Allvarlig.' : 'Observera.'}</strong> ${esc(f.text)}</li>`).join('')}</ul>` : '<p class="liten">Systemet hittade inget att påpeka.</p>'}
    <p class="demoregel">${esc(g.anmarkning)}</p>
    <div class="falt"><label for="lg-ber">Läkemedelsberättelse, framtagen av systemet</label><textarea id="lg-ber" name="berattelse" rows="8" maxlength="4000">${esc(g.berattelse.text)}</textarea></div>
    <div class="falt"><label for="lg-bed">Bedömning</label><textarea id="lg-bed" name="bedomning" rows="2" maxlength="2000"></textarea></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara genomgången</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    await api(`/api/patient/${encodeURIComponent(ctx.id)}/lakemedelsgenomgang`, { metod: 'POST', data: { berattelse: svar.data.berattelse, bedomning: svar.data.bedomning } });
    notis('Läkemedelsgenomgången är sparad.');
    ctx.ladda();
  } catch (e) { felNotis(e); }
}
