// Läkemedel att ge (Sussa 3.5.2.17, 3.5.2.18, 3.5.2.2 och 3.5.2.5): dagens doser per patient, framräknade av servern ur
// ordinationerna. Sjuksköterskan bekräftar det som ges med ett klick. Varningar för dubbel dos, för tidig dos, dos utan
// ordination och högsta dygnsdos visas innan något sparas, och en allvarlig varning kvitteras med motivering. Samma
// delar används i avdelningens lista (#/administrering) och i patientens läkemedelsflik.
import { esc, api, notis, felNotis, medKnapp, dialog, ikon, vyRubrik, tom, klockslag, tidpunkt, datum, idag } from '../ui.js';
import { far } from '../app.js';
import { patientCell } from './arbetslista.js';

export const namn = 'administrering';

const STATUS = {
  kommande: ['Kommande', ''], att_ge: ['Att ge nu', 'tagg-pagaende'], forsenad: ['Försenad', 'tagg-larm'], iordningstalld: ['Iordningsställd', 'tagg-utkast'],
  given: ['Given', 'tagg-ok'], overlamnad: ['Överlämnad', 'tagg-ok'], ej_given: ['Inte given', 'tagg-utkast'],
};
const lmText = (x) => `${esc(x.lakemedel?.namn)} <span class="dampad">${esc(x.lakemedel?.styrka ?? '')}</span>`;
const dosText = (x) => (x.dos != null ? `${String(x.dos).replace('.', ',')} ${esc(x.dosEnhet ?? '')}` : '');
// Vem som gav dosen, och vem som registrerade den när det var någon annan.
const vem = (a) => {
  if (!a?.utfordAv) return '';
  const annan = a.registreradAv && a.registreradAv.id !== a.utfordAv.id ? ` av ${esc(a.registreradAv.namn)}` : '';
  const reg = a.efterhand ? `, registrerad i efterhand ${esc(tidpunkt(a.registrerad))}${annan}` : annan ? `, registrerad${annan}` : '';
  // Delegeringen som undersköterskan gav dosen med (runda 5).
  const deleg = a.delegering ? `, med delegering från ${esc(a.delegering.utfardadAv)}` : '';
  return `${klockslag(a.tid)} av ${esc(a.utfordAv.namn)}${deleg}${reg}`;
};
// Undersköterskan ser knappen Ge bara för doser som hennes delegering omfattar, och annars varför (runda 5).
const omfattas = (x) => x.delegering?.omfattas !== false;
const inteDelegerad = (x) => (omfattas(x) ? '' : `<span class="under-text adm-varfor">${esc(x.delegering.varfor)}</span>`);

// Doserna för en patient, som HTML. kan: får användaren ge läkemedel till patienten.
export function patientDoser(pid, l) {
  const kan = l.kan?.kan;
  const rad = (d) => {
    const [st, kl] = STATUS[d.status] ?? [d.status, ''];
    const a = d.administrering;
    const knappar = kan && d.forslag && omfattas(d) ? `
      <button type="button" class="knapp liten" data-adm="${d.forslag}" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}"${a?.iordningstalld?.kontrollkod ? ` data-kod="${esc(a.iordningstalld.kontrollkod)}"` : ''} data-namn="${esc(d.lakemedel?.namn)}">${d.forslag === 'overlamna' ? 'Lämna över' : 'Ge'}</button>
      <details class="adm-mer"><summary>Mer</summary><div class="knapprad">
        ${a?.status !== 'iordningstalld' ? `<button type="button" class="knapp liten sekundar" data-adm="iordningstall" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Iordningsställ</button>` : ''}
        <button type="button" class="knapp liten sekundar" data-adm="efterhand" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Given tidigare</button>
        ${d.dos != null ? `<button type="button" class="knapp liten sekundar" data-adm="annan_dos" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-dos="${esc(d.dos)}" data-enhet="${esc(d.dosEnhet ?? '')}" data-namn="${esc(d.lakemedel?.namn)}">Annan dos</button>` : ''}
        <button type="button" class="knapp liten sekundar" data-adm="ej_given" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Inte given</button>
        ${d.forslag === 'overlamna' ? `<button type="button" class="knapp liten sekundar" data-adm="ge" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Ge på avdelningen</button>` : ''}
      </div></details>` : '';
    return `<tr data-dos="${esc(d.nyckel)}">
      <td><time>${esc(klockslag(d.planerad))}</time>${datum(d.planerad) !== datum(idag()) ? `<span class="under-text">${esc(datum(d.planerad))}</span>` : ''}</td>
      <td><strong>${lmText(d)}</strong><span class="under-text">${esc(d.dosering)}${d.administrationssatt ? `, ${esc(d.administrationssatt.toLowerCase())}` : ''}${d.vardhandelse ? `. Inför ${esc(d.vardhandelse.text.toLowerCase())}` : ''}</span>${d.vardhandelse?.forklaring ? `<span class="under-text">${esc(d.vardhandelse.forklaring)}</span>` : ''}</td>
      <td>${dosText(d)}</td>
      <td><span class="tagg ${kl}">${esc(st)}</span>${d.underPermission ? ' <span class="tagg">Permission</span>' : ''}
        ${a && a.status !== 'iordningstalld' ? `<span class="under-text">${vem(a)}${a.orsak ? `. ${esc(a.orsak)}` : ''}${d.antalRegistreringar > 1 ? `. Registrerad ${d.antalRegistreringar} gånger` : ''}</span>` : ''}
        ${a?.status === 'iordningstalld' ? `<span class="under-text">Iordningsställd ${esc(klockslag(a.iordningstalld.tid))} av ${esc(a.iordningstalld.av)}. Etikett ${esc(a.iordningstalld.kontrollkod)}</span>` : ''}
        ${d.forslag ? inteDelegerad(d) : ''}</td>
      <td class="atgarder">${knappar}</td>
    </tr>`;
  };
  const vb = (v) => `<li class="adm-vb"><div><strong>${lmText(v)}</strong> <span class="tagg">Vid behov</span>
      <span class="under-text">${esc(v.dosering)}</span>
      <span class="under-text">${v.senaste ? `Senast given ${esc(tidpunkt(v.senaste.tid))} av ${esc(v.senaste.utfordAv?.namn ?? '')}${v.senaste.delegering ? `, med delegering från ${esc(v.senaste.delegering.utfardadAv)}` : ''}.` : 'Inte given det senaste dygnet.'}${v.max ? ` ${v.senasteDygnet} av högst ${v.max.antal} det senaste dygnet.` : ''}</span>
      ${v.varfor ? `<span class="under-text adm-varfor">${esc(v.varfor)}</span>` : ''}${inteDelegerad(v)}</div>
      ${kan && omfattas(v) ? `<button type="button" class="knapp liten${v.kanGesNu ? '' : ' sekundar'}" data-adm="ge" data-pid="${esc(pid)}" data-ord="${v.ordinationId}" data-namn="${esc(v.lakemedel?.namn)}">Ge</button>` : ''}</li>`;
  const ut = (u) => `<li class="adm-vb"><div><strong>${lmText(u)}</strong> <span class="tagg">Utan fasta tider</span><span class="under-text">${esc(u.dosering)}</span>
      ${u.givnaIdag.length ? `<span class="under-text">Given i dag ${u.givnaIdag.map(a => `${esc(klockslag(a.tid))}${a.dos != null ? ` (${dosText(a)})` : ''} av ${esc(a.utfordAv?.namn ?? '')}${a.delegering ? `, med delegering från ${esc(a.delegering.utfardadAv)}` : ''}`).join('; ')}.</span>` : ''}${inteDelegerad(u)}</div>
      ${kan && omfattas(u) ? `<button type="button" class="knapp liten sekundar" data-adm="fri" data-pid="${esc(pid)}" data-ord="${u.ordinationId}" data-namn="${esc(u.lakemedel?.namn)}">Ge dos</button>` : ''}</li>`;
  // Runda 5, r1: vårdhändelsen följer tidboken, och systemet förklarar varför dosen väntar (vardhandelse.js).
  const avbokad = (h) => h.lage === 'avbokad' || h.lage === 'avslutad';
  const vantar = (v) => `<li class="adm-vb"><div><strong>${lmText(v)}</strong> <span class="tagg${avbokad(v.vardhandelse) ? ' tagg-larm' : ''}">${avbokad(v.vardhandelse) ? 'Vårdhändelsen är avbokad' : 'Väntar på tid'}</span>
      <span class="under-text">Ges ${esc(handelseText(v.vardhandelse))}.</span>
      <span class="under-text adm-varfor">${esc(v.vardhandelse.forklaring ?? 'Tiden räknas fram när vårdhändelsen har fått sin tid.')}</span></div>
      ${kan || far('ordinera') ? `<button type="button" class="knapp liten sekundar" data-handelse="${v.ordinationId}" data-pid="${esc(pid)}" data-text="${esc(v.vardhandelse.text)}" data-foljer="${v.vardhandelse.foljerTidbok ? '1' : ''}">${v.vardhandelse.foljerTidbok ? 'Ange tid för hand' : `Ange tid för ${esc(v.vardhandelse.text.toLowerCase())}`}</button>` : ''}</li>`;
  const kommande = (v) => `<li class="adm-vb"><div><strong>${lmText(v)}</strong> <span class="tagg">Ges ${esc(tidpunkt(v.administreras))}</span>
      <span class="under-text">Ges ${esc(handelseText(v.vardhandelse))}.${v.vardhandelse.foljerTidbok ? ' Tiden följer tidboken.' : ''}</span>
      ${v.vardhandelse.forklaring ? `<span class="under-text">${esc(v.vardhandelse.forklaring)}</span>` : ''}</div></li>`;
  return `${l.permission ? `<p class="ruta ruta-info liten">${ikon.info}<span>Patienten är på permission till och med ${esc(datum(l.permission.till))}. Doserna under permissionen lämnas över till patienten.</span></p>` : ''}
    ${l.doser.length ? `<div class="tabellrulle"><table class="tabell adm-tabell">
      <thead><tr><th scope="col">Tid</th><th scope="col">Läkemedel</th><th scope="col">Dos</th><th scope="col">Status</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
      <tbody>${l.doser.map(rad).join('')}</tbody></table></div>` : '<p class="tom liten">Inga doser med fasta tider i dag.</p>'}
    ${l.vidBehov.length || l.utanTider.length || l.vantarPaHandelse.length || l.kommandeHandelser?.length ? `<ul class="adm-lista">${l.vidBehov.map(vb).join('')}${l.utanTider.map(ut).join('')}${l.vantarPaHandelse.map(vantar).join('')}${(l.kommandeHandelser ?? []).map(kommande).join('')}</ul>` : ''}
    ${l.utanOrdination?.length ? `<p class="liten">Doser utan ordination det senaste dygnet: ${l.utanOrdination.map(a => `${esc(a.lakemedel?.namn)} ${esc(klockslag(a.tid))}`).join(', ')}.</p>` : ''}
    ${!kan && l.kan?.varfor ? `<p class="dampad liten">${esc(l.kan.varfor)}</p>` : ''}
    ${l.dolda?.sparrade ? '<p class="dampad liten">Det finns spärrade uppgifter. Ordinationer och doser från spärrade vårdenheter visas inte.</p>' : ''}`;
}
const handelseText = (h) => {
  const t = Math.abs(h.forskjutningMin) / 60;
  const tt = `${String(Math.round(t * 10) / 10).replace('.', ',')} ${t === 1 ? 'timme' : 'timmar'}`;
  return h.forskjutningMin === 0 ? `vid ${h.text.toLowerCase()}` : h.forskjutningMin < 0 ? `${tt} före ${h.text.toLowerCase()}` : `${tt} efter ${h.text.toLowerCase()}`;
};

const lokalTill = (hhmm, dag = idag()) => new Date(`${dag}T${hhmm}:00`).toISOString();
// Motivering krävs för allvarliga varningar och för en dos som avviker från ordinationen (kraverKvittens, runda 5).
const REGELTEXT = { dubbel_dos: 'dubbel dos', for_tidig: 'för tidig dos', utan_ordination: 'dos utan ordination', max_per_dygn: 'högsta dygnsdos', avvikande_dos: 'annan dos än ordinationen' };
const kvittensHtml = (varningar, kraver = null) => {
  const allv = varningar.filter(v => v.niva === 'allvarlig');
  const obs = varningar.filter(v => v.niva !== 'allvarlig');
  const regler = kraver ?? [...new Set(varningar.filter(v => v.niva === 'allvarlig' || v.kraverKvittens).map(v => v.regel))];
  return `${allv.length ? `<ul class="varn-allvarlig">${allv.map(v => `<li><strong>Allvarlig.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${obs.length ? `<ul class="varn-observera">${obs.map(v => `<li><strong>Observera.</strong> ${esc(v.text)}</li>`).join('')}</ul>` : ''}
    ${regler.map((r, n) => `<div class="falt"><label for="adm-kv-${n}">Motivering (${esc(REGELTEXT[r] ?? r.replace(/_/g, ' '))}) <span class="obl">(obligatoriskt)</span></label><textarea id="adm-kv-${n}" name="kv_${esc(r)}" rows="2" maxlength="500" required minlength="3"></textarea></div>`).join('')}`;
};

// Registrerar en åtgärd. Med en allvarlig varning visas den med fält för motivering, och åtgärden görs om med kvittensen.
async function registrera(pid, data, namnText) {
  const vag = `/api/patient/${encodeURIComponent(pid)}/administreringar`;
  try {
    return await api(vag, { metod: 'POST', data });
  } catch (e) {
    if (!(e.status === 400 && e.data?.varningar)) throw e;
    const svar = await dialog(`<form><h2 id="dlg-rubrik">${ikon.varning}<span>Varning: ${esc(namnText)}</span></h2>
      <div class="varningslista" role="alert">${kvittensHtml(e.data.varningar, e.data.kraverKvittens)}<p class="demoregel">Varningarna är demoregler, inte kliniskt beslutsstöd.</p></div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera ändå</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
    { validera: (x) => (Object.values(x).some(v => String(v).trim().length < 3) ? 'Skriv en motivering med minst tre tecken.' : null) });
    if (!svar) return null;
    const kv = Object.entries(svar.data).map(([k, v]) => ({ regel: k.slice(3), motivering: String(v).trim() }));
    return api(vag, { metod: 'POST', data: { ...data, kvitteradeVarningar: kv } });
  }
}

const KLAR = { ge: 'är given', overlamna: 'är överlämnad till patienten', ej_given: 'är registrerad som inte given', iordningstall: 'är iordningsställd', efterhand: 'är registrerad som given', fri: 'är given', annan_dos: 'är given' };

// Kopplar knapparna i el. ladda ritar om efter en ändring.
export function koppla(el, ladda) {
  el.addEventListener('click', async (e) => {
    const h = e.target.closest('[data-handelse]');
    if (h) return angeHandelsetid(h, ladda);
    const b = e.target.closest('[data-adm]');
    if (!b) return;
    const typ = b.dataset.adm;
    const data = { ordinationId: Number(b.dataset.ord) };
    if (b.dataset.planerad) data.planerad = b.dataset.planerad;
    if (b.dataset.kod) data.kontrollkod = b.dataset.kod;
    const namnText = b.dataset.namn;
    if (typ === 'ej_given') {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">${esc(namnText)} ges inte</h2>
        <p>Dosen registreras som inte given, med orsak och vem som registrerade den.</p>
        <div class="knapprad" data-forslag-rad>${['Patienten avböjde', 'Patienten fastar inför undersökning', 'Pausad efter kontakt med läkare'].map(t => `<button type="button" class="knapp liten sekundar" data-orsak="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <div class="falt"><label for="adm-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><textarea id="adm-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { onOpen: (dl) => dl.addEventListener('click', (x) => { const o = x.target.closest('[data-orsak]'); if (o) dl.querySelector('textarea').value = o.dataset.orsak; }) });
      if (!svar) return;
      Object.assign(data, { atgard: 'ej_given', orsak: svar.data.orsak.trim() });
    } else if (typ === 'annan_dos') {
      // En annan dos än ordinationens (runda 5). Servern varnar och kräver en motivering innan dosen sparas.
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Annan dos: ${esc(namnText)}</h2>
        <p>Ordinationen är ${esc(String(b.dataset.dos).replace('.', ','))} ${esc(b.dataset.enhet)}. En annan dos visar en varning och kräver en motivering.</p>
        <div class="falt"><label for="adm-annan">Dos som ges (${esc(b.dataset.enhet)})</label><input id="adm-annan" name="dos" inputmode="decimal" value="${esc(String(b.dataset.dos).replace('.', ','))}" required></div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Fortsätt</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      Object.assign(data, { atgard: 'ge', dos: Number(String(svar.data.dos).replace(',', '.')) });
    } else if (typ === 'efterhand' || typ === 'fri') {
      const forval = b.dataset.planerad ? klockslag(b.dataset.planerad).replace('.', ':') : new Date().toTimeString().slice(0, 5);
      const svar = await dialog(`<form><h2 id="dlg-rubrik">${typ === 'fri' ? 'Ge' : 'Registrera i efterhand'}: ${esc(namnText)}</h2>
        <p>${typ === 'fri' ? 'Ordinationen har inga fasta tider. Ange dosen som ges.' : 'Ange när dosen gavs. Registreringen visar både när dosen gavs och när den registrerades.'}</p>
        <div class="falt-rad"><div class="falt"><label for="adm-tid">Klockslag</label><input id="adm-tid" name="tid" type="time" value="${esc(forval)}" required></div>
        ${typ === 'fri' ? '<div class="falt"><label for="adm-dos">Dos</label><input id="adm-dos" name="dos" inputmode="decimal"></div>' : ''}</div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      data.atgard = 'ge';
      data.tid = lokalTill(svar.data.tid);
      if (svar.data.dos?.trim()) data.dos = Number(svar.data.dos.replace(',', '.'));
    } else data.atgard = typ;
    try {
      const r = await medKnapp(b, () => registrera(b.dataset.pid, data, namnText));
      if (!r) return;
      const a = r.administrering;
      notis(`${a.lakemedel?.namn} ${KLAR[typ] ?? 'är registrerad'}${a.tid ? ` kl. ${klockslag(a.tid)}` : ''}.${a.iordningstalld && a.status === 'iordningstalld' ? ` Etikett ${a.iordningstalld.kontrollkod}.` : ''}`);
      ladda();
    } catch { /* notis visad */ }
  });
}

async function angeHandelsetid(b, ladda) {
  const imorgon = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Tid för ${esc(b.dataset.text.toLowerCase())}</h2>
    <p>När vårdhändelsen har fått en tid räknar systemet fram när läkemedlet ska ges.</p>
    ${b.dataset.foljer ? '<p class="ruta ruta-info liten">Vårdhändelsen följer tidboken. Sätter du tiden för hand slutar den följa tidboken, och en ombokning flyttar inte längre dosen.</p>' : ''}
    <div class="falt-rad"><div class="falt"><label for="vh-dag">Datum</label><input id="vh-dag" name="dag" type="date" value="${imorgon}" required></div>
    <div class="falt"><label for="vh-tid">Klockslag</label><input id="vh-tid" name="tid" type="time" value="09:00" required></div></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara tiden</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    const r = await api(`/api/ordination/${b.dataset.handelse}/vardhandelse`, { metod: 'POST', data: { tid: lokalTill(svar.data.tid, svar.data.dag) } });
    notis(`Läkemedlet ges ${tidpunkt(r.vardhandelse.administreras)}.`);
    ladda();
  } catch (e) { felNotis(e); }
}

// Avdelningens lista (#/administrering).
export async function visa(main) {
  main.innerHTML = vyRubrik('Läkemedel att ge', 'Dagens doser för de inneliggande patienterna, framräknade ur ordinationerna.') + '<div id="adm"><p class="tom">Hämtar.</p></div>';
  const d = await api('/api/administreringar');
  const el = main.querySelector('#adm');
  // Har användaren hunnit gå vidare till en annan vy medan listan hämtades finns inget att visa den i.
  if (!el) return;
  if (!d.patienter.length) { el.innerHTML = tom(`Det finns inga inneliggande patienter på ${d.vardenhet?.namn ?? 'din vårdenhet'} som du har vårdrelation till.`); return; }
  // Undersköterskan ser vad hennes delegering omfattar och hur länge den gäller (runda 5).
  const deleg = d.delegering ? `<p class="ruta ruta-info liten adm-delegering">${ikon.info}<span>${d.delegering.giltig
    ? `Du ger läkemedel med delegering: ${esc(d.delegering.omfattning.toLowerCase())}, till och med ${esc(datum(d.delegering.till))}. Knappen Ge visas bara för doser som delegeringen omfattar.`
    : esc(d.delegering.varfor)} <a href="#/delegeringar">Mina delegeringar</a></span></p>` : '';
  el.innerHTML = `${deleg}<p class="ingress liten">${esc(d.vardenhet?.namn ?? '')}: ${d.sammanfattning.attGe} ${d.sammanfattning.attGe === 1 ? 'dos' : 'doser'} att ge nu${d.sammanfattning.forsenade ? `, ${d.sammanfattning.forsenade} försenade` : ''}. Varningarna är demoregler, inte kliniskt beslutsstöd.</p>
    ${d.patienter.map(p => `<section class="adm-patient" aria-labelledby="adm-${esc(p.patient.id)}">
      <h2 id="adm-${esc(p.patient.id)}">${patientCell(p.patient, `#/patient/${encodeURIComponent(p.patient.id)}/lakemedel`)} <span class="dampad liten">${esc(p.plats ?? '')}</span></h2>
      ${patientDoser(p.patient.id, p)}
    </section>`).join('')}`;
  koppla(el, () => visa(main));
}
