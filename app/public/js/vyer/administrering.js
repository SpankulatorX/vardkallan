// Läkemedel att ge (Sussa 3.5.2.17, 3.5.2.18, 3.5.2.2 och 3.5.2.5): dagens doser per patient, framräknade av servern ur
// ordinationerna. Sjuksköterskan bekräftar det som ges med ett klick. Varningar för dubbel dos, för tidig dos, dos utan
// ordination och högsta dygnsdos visas innan något sparas, och en allvarlig varning kvitteras med motivering. Samma
// delar används i avdelningens lista (#/administrering) och i patientens läkemedelsflik.
import { esc, api, notis, felNotis, medKnapp, dialog, ikon, vyRubrik, tom, klockslag, tidpunkt, datum, idag, plusDagar, sessionNummer } from '../ui.js';
// Runda 7, r2: hjälp i sammanhanget.
import { hjalpRuta } from '../hjalp.js';
import { far, S } from '../app.js';
import { patientCell } from './arbetslista.js';
// Runda 6, r2: makulering av en felaktig registrering.
import { makulera } from './lakemedelsstod.js';

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
// Runda 13, r4: antalet ur en dosering som "1 till 2 tabletter vid behov", högst fyra knappar.
const vbIntervall = (dosering) => {
  const m = String(dosering ?? '').match(/(\d+)\s*(?:till|-)\s*(\d+)\s+(tablett|tabletter|kapsel|kapslar|dos|doser|droppar|puffar)/i);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a >= 1 && b > a && b - a <= 3 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : null;
};
const intervallEnhet = (dosering, n) => {
  const ord = (String(dosering ?? '').match(/\d+\s*(?:till|-)\s*\d+\s+(\S+)/i)?.[1] ?? '').toLowerCase();
  const par = { tablett: ['tablett', 'tabletter'], tabletter: ['tablett', 'tabletter'], kapsel: ['kapsel', 'kapslar'], kapslar: ['kapsel', 'kapslar'], dos: ['dos', 'doser'], doser: ['dos', 'doser'], droppar: ['droppe', 'droppar'], puffar: ['puff', 'puffar'] }[ord];
  return par ? par[n === 1 ? 0 : 1] : '';
};
const inteDelegerad = (x) => (omfattas(x) ? '' : `<span class="under-text adm-varfor">${esc(x.delegering.varfor)}</span>`);

// Doserna för en patient, som HTML. kan: får användaren ge läkemedel till patienten.
// Runda 13, r3 (E2-5): patientens namn och personnummer för frågan om identiteten, per patient som visas.
const patientText = new Map();
export function patientDoser(pid, l, patient = null) {
  if (patient?.namn) patientText.set(pid, [patient.namn, patient.personnummer].filter(Boolean).join(', '));
  const kan = l.kan?.kan;
  const rad = (d) => {
    const [st, kl] = STATUS[d.status] ?? [d.status, ''];
    const a = d.administrering;
    // Runda 9, r1: en dos som ska beredas föreslås att beredas först, och en beredning som väntar på kontroll ges inte.
    const bered = d.beredning && a?.status !== 'iordningstalld';
    // Runda 10, r5: ett högriskläkemedel som inte bereds iordningsställs först, så att en kollega kan kontrollera det.
    const kollegaIor = !d.beredning && d.kollegakontroll?.kravs && a?.status !== 'iordningstalld';
    const vantarKontroll = a?.status === 'iordningstalld' && ((a.beredning?.kontroll?.kravs && !a.beredning.kontroll.av) || (a.kollegakontroll && !a.kollegakontroll.av));
    const knappar = kan && d.forslag && omfattas(d) ? `
      ${bered ? `<button type="button" class="knapp liten" data-adm="iordningstall" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}" data-bered="${esc(JSON.stringify(beredData(d)))}">Bered</button>`
        : kollegaIor ? `<button type="button" class="knapp liten" data-adm="iordningstall" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Iordningsställ</button>`
        : vantarKontroll ? '' : `<button type="button" class="knapp liten" data-adm="${d.forslag}" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}"${a?.iordningstalld?.kontrollkod ? ` data-kod="${esc(a.iordningstalld.kontrollkod)}"` : ''} data-namn="${esc(d.lakemedel?.namn)}"${d.forslag === 'ge' ? ' data-ko-ok' : ''}>${d.forslag === 'overlamna' ? 'Lämna över' : 'Ge'}</button>`}
      <details class="adm-mer"><summary>Mer</summary><div class="knapprad">
        ${a?.status !== 'iordningstalld' && !bered && !kollegaIor ? `<button type="button" class="knapp liten sekundar" data-adm="iordningstall" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Iordningsställ</button>` : ''}
        <button type="button" class="knapp liten sekundar" data-adm="efterhand" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Given tidigare</button>
        ${d.dos != null ? `<button type="button" class="knapp liten sekundar" data-adm="annan_dos" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-dos="${esc(d.dos)}" data-enhet="${esc(d.dosEnhet ?? '')}" data-namn="${esc(d.lakemedel?.namn)}">Annan dos</button>` : ''}
        <button type="button" class="knapp liten sekundar" data-adm="ej_given" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Inte given</button>
        ${d.forslag === 'overlamna' ? `<button type="button" class="knapp liten sekundar" data-adm="ge" data-pid="${esc(pid)}" data-ord="${d.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(d.lakemedel?.namn)}">Ge på avdelningen</button>` : ''}
      </div></details>` : '';
    return `<tr data-dos="${esc(d.nyckel)}">
      <td><time>${esc(klockslag(d.planerad))}</time>${datum(d.planerad) !== datum(idag()) ? `<span class="under-text">${esc(datum(d.planerad))}</span>` : ''}</td>
      <td><strong>${lmText(d)}</strong>${r6Taggar(d)}<span class="under-text">${esc(d.dosering)}${d.administrationssatt ? `, ${esc(d.administrationssatt.toLowerCase())}` : ''}${d.vardhandelse ? `. Inför ${esc(d.vardhandelse.text.toLowerCase())}` : ''}</span>${d.vardhandelse?.forklaring ? `<span class="under-text">${esc(d.vardhandelse.forklaring)}</span>` : ''}${d.spadning ? `<span class="under-text lms-spadning">${esc(d.spadning.text)}</span>` : ''}${r9Info(d)}</td>
      <td>${dosText(d)}</td>
      <td><span class="tagg ${kl}">${esc(st)}</span>${d.underPermission ? ' <span class="tagg">Permission</span>' : ''}${a?.ejSparad ? ' <span class="tagg tagg-larm" data-ej-sparad>Inte sparad i journalen än</span>' : ''}
        ${a && a.status !== 'iordningstalld' ? `<span class="under-text">${vem(a)}${a.orsak ? `. ${esc(a.orsak)}` : ''}${d.antalRegistreringar > 1 ? `. Registrerad ${d.antalRegistreringar} gånger` : ''}</span>` : ''}
        ${a?.status === 'iordningstalld' ? `<span class="under-text">Iordningsställd ${esc(klockslag(a.iordningstalld.tid))} av ${esc(a.iordningstalld.av)}. Etikett ${esc(a.iordningstalld.kontrollkod)}</span>${r9Status(pid, a, kan)}` : ''}
        ${a && kan ? `<button type="button" class="knapp-lank" data-makulera-adm="${a.id}" data-pid="${esc(pid)}" data-text="${esc(`${d.lakemedel?.namn ?? ''}, ${STATUS[a.status]?.[0]?.toLowerCase() ?? ''} ${klockslag(a.tid ?? a.iordningstalld?.tid)}`)}">Makulera</button>` : ''}
        ${d.forslag ? inteDelegerad(d) : ''}</td>
      <td class="atgarder">${knappar}</td>
    </tr>`;
  };
  // Runda 10, r5: en iordningsställd vid behovsdos med kollegakontroll visas vid ordinationen tills den är given.
  const vbIor = (v) => (l.senaste ?? []).find(a => a.ordinationId === v.ordinationId && a.status === 'iordningstalld' && !a.makulerad) ?? null;
  const vbKnapp = (v) => {
    const ior = vbIor(v);
    if (ior) return ior.kollegakontroll && !ior.kollegakontroll.av ? '' : `<button type="button" class="knapp liten" data-adm="ge" data-pid="${esc(pid)}" data-ord="${v.ordinationId}" data-kod="${esc(ior.iordningstalld.kontrollkod)}" data-namn="${esc(v.lakemedel?.namn)}">Ge</button>`;
    if (v.kollegakontroll?.kravs) return `<button type="button" class="knapp liten${v.kanGesNu ? '' : ' sekundar'}" data-adm="iordningstall" data-pid="${esc(pid)}" data-ord="${v.ordinationId}" data-namn="${esc(v.lakemedel?.namn)}">Iordningsställ</button>`;
    // Runda 13, r4 (E2-9): en dos som får vara 1 till 2 tabletter ges med en knapp per antal, så att antalet alltid väljs
    // med samma klick som dosen ges.
    const intervall = vbIntervall(v.dosering);
    if (intervall) return intervall.map(n => `<button type="button" class="knapp liten${v.kanGesNu ? '' : ' sekundar'}" data-adm="ge" data-antal="${n}" data-pid="${esc(pid)}" data-ord="${v.ordinationId}" data-namn="${esc(v.lakemedel?.namn)}" data-ko-ok>Ge ${n} ${esc(intervallEnhet(v.dosering, n))}</button>`).join(' ');
    return `<button type="button" class="knapp liten${v.kanGesNu ? '' : ' sekundar'}" data-adm="ge" data-pid="${esc(pid)}" data-ord="${v.ordinationId}" data-namn="${esc(v.lakemedel?.namn)}" data-ko-ok>Ge</button>`;
  };
  const vb = (v) => `<li class="adm-vb"><div><strong>${lmText(v)}</strong> <span class="tagg">Vid behov</span>${kollegaInfo(v)}
      <span class="under-text">${esc(v.dosering)}</span>
      <span class="under-text">${v.senaste ? `Senast given ${esc(tidpunkt(v.senaste.tid))} av ${esc(v.senaste.utfordAv?.namn ?? '')}${v.senaste.delegering ? `, med delegering från ${esc(v.senaste.delegering.utfardadAv)}` : ''}.` : 'Inte given det senaste dygnet.'}${v.max ? ` ${v.senasteDygnet} av högst ${v.max.antal} det senaste dygnet.` : ''}</span>
      ${v.varfor ? `<span class="under-text adm-varfor">${esc(v.varfor)}</span>` : ''}${inteDelegerad(v)}
      ${vbIor(v) ? `<span class="under-text">Iordningsställd ${esc(klockslag(vbIor(v).iordningstalld.tid))} av ${esc(vbIor(v).iordningstalld.av)}. Etikett ${esc(vbIor(v).iordningstalld.kontrollkod)}</span>${r9Status(pid, vbIor(v), kan)}` : ''}</div>
      ${v.senaste?.ejSparad ? '<span class="tagg tagg-larm" data-ej-sparad>Inte sparad i journalen än</span>' : ''}
      ${kan && omfattas(v) ? `<div class="adm-knappar">${vbKnapp(v)}
        <details class="adm-mer"><summary>Mer</summary><div class="knapprad"><button type="button" class="knapp liten sekundar" data-adm="efterhand" data-pid="${esc(pid)}" data-ord="${v.ordinationId}" data-namn="${esc(v.lakemedel?.namn)}">Given tidigare</button></div></details></div>` : ''}</li>`;
  const ut = (u) => `<li class="adm-vb"><div><strong>${lmText(u)}</strong> <span class="tagg">Utan fasta tider</span><span class="under-text">${esc(u.dosering)}</span>${r9Info(u)}
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
  return `${kan ? skannaForm(pid) : ''}${l.permission ? `<p class="ruta ruta-info liten">${ikon.info}<span>Patienten är på permission till och med ${esc(datum(l.permission.till))}. Doserna under permissionen lämnas över till patienten.</span></p>` : ''}
    ${l.doser.length ? `<div class="tabellrulle"><table class="tabell adm-tabell">
      <thead><tr><th scope="col">Tid</th><th scope="col">Läkemedel</th><th scope="col">Dos</th><th scope="col">Status</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
      <tbody>${l.doser.map(rad).join('')}</tbody></table></div>` : '<p class="tom liten">Inga doser med fasta tider i dag.</p>'}
    ${egenHtml(pid, l, kan)}
    ${l.vidBehov.length || l.utanTider.length || l.vantarPaHandelse.length || l.kommandeHandelser?.length ? `<ul class="adm-lista">${l.vidBehov.map(vb).join('')}${l.utanTider.map(ut).join('')}${l.vantarPaHandelse.map(vantar).join('')}${(l.kommandeHandelser ?? []).map(kommande).join('')}</ul>` : ''}
    ${(l.senaste ?? []).some(a => a.makulerad) ? `<p class="liten">Makulerade registreringar: ${l.senaste.filter(a => a.makulerad).map(a => `<span class="makulerad">${esc(a.lakemedel?.namn)} ${esc(klockslag(a.tid ?? a.iordningstalld?.tid))}</span> (${esc(a.makulerad.orsak)}, ${esc(a.makulerad.av)})`).join(', ')}.</p>` : ''}
    ${l.utanOrdination?.length ? `<p class="liten">Doser utan ordination det senaste dygnet: ${l.utanOrdination.map(a => `${esc(a.lakemedel?.namn)} ${esc(klockslag(a.tid))}`).join(', ')}.</p>` : ''}
    ${!kan && l.kan?.varfor ? `<p class="dampad liten">${esc(l.kan.varfor)}</p>` : ''}
    ${l.dolda?.sparrade ? '<p class="dampad liten">Det finns spärrade uppgifter. Ordinationer och doser från spärrade vårdenheter visas inte.</p>' : ''}`;
}
// Runda 6, r2: trappschemats steg, läkemedelstyp, muntlig ordination och generellt direktiv vid dosen.
const r6Taggar = (d) => [
  d.trappning?.steg && ` <span class="tagg">Steg ${d.trappning.steg} av ${d.trappning.antal}</span>`,
  d.produkttyp && ` <span class="tagg tagg-demo">${esc(d.produkttyp.typText)}</span>`,
  d.muntlig && ` <span class="tagg${d.muntlig.signerad ? '' : ' tagg-larm'}">${d.muntlig.signerad ? 'Muntlig, signerad' : `Muntlig, ges utan signering till kl. ${esc(klockslag(d.muntlig.gesUtanSigneringTill))}`}</span>`,
  d.direktiv && ` <span class="tagg">Direktiv, högst ${d.direktiv.maxTillfallen} ${d.direktiv.maxTillfallen === 1 ? 'tillfälle' : 'tillfällen'}</span>`,
].filter(Boolean).join('');
const handelseText = (h) => {
  // Den skyddade formen för en annan vårdenhet har ingen förskjutning, bara när läkemedlet ges (runda 5).
  if (h.forskjutningMin == null) return `inför ${h.text.toLowerCase()}`;
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

// Runda 13, r3 (E2-5, beslut från Jonas, säkerhetsgranskningen): en dos som ges utan skannat armband kräver en uppgift
// om hur patientens identitet kontrollerades. Servern minns bekräftelsen för den som gav den, för patienten, i sessionen,
// en läkemedelsrunda (en kvart), och kräver en ny annars. Klienten minns bara att den inte behöver fråga igen, med
// nyckeln inloggad person och patient, och glömmer det vid varje ny session (inloggning, utloggning och byte av person).
// Svarar servern att bekräftelsen saknas frågar dialogen ändå. Det vanligaste sättet är förvalt, så att flödet utan
// skanning får ett klick till och flödet med skanning inget.
const IDENTITET_SATT = [['id_band_hand', 'Id-bandet avläst för hand'], ['id_handling', 'Id-handling'], ['kand', 'Patienten är känd av mig'], ['annan', 'Annat sätt']];
const RUNDA_MS = 15 * 60_000;
const identitetMinne = { session: -1, rader: new Map() };
const identitetNyckel = (pid) => `${S.session?.personal?.id ?? ''}:${pid}`;
function identitetRader() {
  if (identitetMinne.session !== sessionNummer()) { identitetMinne.session = sessionNummer(); identitetMinne.rader = new Map(); }
  return identitetMinne.rader;
}
const nyligenBekraftad = (pid) => { const t = identitetRader().get(identitetNyckel(pid)); return Boolean(t && Date.now() - t < RUNDA_MS); };
async function fragaIdentitet(pid, namnText) {
  // Formuläret fungerar också under ett avbrott (data-ko-ok), eftersom en dos då läggs i skrivkön.
  const vem = patientText.get(pid);
  const svar = await dialog(`<form data-ko-ok><h2 id="dlg-rubrik">Patientens identitet${vem ? `: ${esc(vem)}` : ''}</h2>
    <p>${esc(namnText)} ges och armbandet är inte skannat. Hur har du kontrollerat att det är rätt patient?</p>
    <fieldset class="kryssgrupp" id="adm-id"><legend>Identiteten kontrollerades med</legend>${IDENTITET_SATT.map(([k, t], i) => `<div class="kryssfalt"><input type="radio" id="adm-id-${k}" name="satt" value="${k}"${i === 0 ? ' checked' : ''}><label for="adm-id-${k}">${esc(t)}</label></div>`).join('')}</fieldset>
    <div class="falt"><label for="adm-id-text">Hur, om annat sätt</label><input id="adm-id-text" name="text" maxlength="200" autocomplete="off"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Identiteten är kontrollerad</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (d) => (d.satt === 'annan' && String(d.text ?? '').trim().length < 3 ? 'Skriv hur du har kontrollerat identiteten.' : null) });
  if (!svar) return null;
  return { satt: svar.data.satt, ...(svar.data.satt === 'annan' ? { text: String(svar.data.text).trim() } : {}) };
}

// Registrerar en åtgärd. Utan skannat armband följer identiteten med (se ovan).
async function registrera(pid, data, namnText) {
  const utanSkanning = data.atgard === 'ge' && !data.armband;
  if (utanSkanning && !data.identitet && !nyligenBekraftad(pid)) {
    const id = await fragaIdentitet(pid, namnText);
    if (!id) return null;
    data = { ...data, identitet: id };
  }
  const tyst = utanSkanning && !data.identitet;
  try {
    const r = await skicka(pid, data, namnText, { tyst });
    if (r && utanSkanning) identitetRader().set(identitetNyckel(pid), Date.now());
    return r;
  } catch (e) {
    if (!(tyst && e?.kod === 'identitet')) { if (tyst) felNotis(e); throw e; }
    const id = await fragaIdentitet(pid, namnText);
    if (!id) return null;
    const r = await skicka(pid, { ...data, identitet: id }, namnText);
    if (r) identitetRader().set(identitetNyckel(pid), Date.now());
    return r;
  }
}

// Med en allvarlig varning visas den med fält för motivering, och åtgärden görs om med kvittensen.
async function skicka(pid, data, namnText, { tyst = false } = {}) {
  const vag = `/api/patient/${encodeURIComponent(pid)}/administreringar`;
  try {
    // Runda 10, r1: under ett avbrott läggs en given dos i skrivkön (ko), och servern prövar den när förbindelsen är tillbaka.
    return await api(vag, { metod: 'POST', data, ko: data.atgard === 'ge' && !data.tid, ...(tyst ? { tyst: true } : {}) });
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
  // Runda 9, r1: patientnära skanning med streckkodsläsaren, som skriver koden och Enter.
  el.addEventListener('keydown', (e) => {
    const f = e.target.closest('.adm-skanna input');
    if (f && e.key === 'Enter') { e.preventDefault(); skanning(f, ladda); }
  });
  el.addEventListener('click', async (e) => {
    // Runda 9, r1: etiketten, kontrollen av en beredning, armbandet och skanningen.
    const eg = e.target.closest('[data-egen]');
    if (eg) return kvitteraEgen(eg, ladda);
    const r9 = e.target.closest('[data-etikett], [data-kontroll-ber], [data-armband], [data-skanna]');
    if (r9?.dataset.etikett) return visaEtikett(r9.dataset.pid, r9.dataset.etikett);
    if (r9?.dataset.kontrollBer) return kontrolleraBeredning(r9, ladda);
    // Runda 10, r5: kollegakontrollen av ett högriskläkemedel.
    const kk = e.target.closest('[data-kollega]');
    if (kk) return kontrolleraKollega(kk, ladda);
    if (r9?.dataset.armband) return visaArmband(r9.dataset.armband);
    if (r9 && r9.dataset.skanna != null) return skanning(r9.closest('.adm-skanna').querySelector('input'), ladda);
    const h = e.target.closest('[data-handelse]');
    if (h) return angeHandelsetid(h, ladda);
    const mk = e.target.closest('[data-makulera-adm]');
    if (mk) return makulera(mk.dataset.pid, 'administrering', mk.dataset.makuleraAdm, mk.dataset.text, ladda);
    const b = e.target.closest('[data-adm]');
    if (!b) return;
    const typ = b.dataset.adm;
    const data = { ordinationId: Number(b.dataset.ord) };
    if (b.dataset.planerad) data.planerad = b.dataset.planerad;
    if (b.dataset.kod) data.kontrollkod = b.dataset.kod;
    // Runda 13, r4: antalet som valdes med knappen för en dos vid behov.
    if (b.dataset.antal) data.antal = Number(b.dataset.antal);
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
      // Systemet föreslår dostiden, men aldrig en tid i framtiden. För en dos utan dostid föreslås en halvtimme sedan.
      const forvalMs = b.dataset.planerad ? Math.min(Date.parse(b.dataset.planerad), Date.now()) : typ === 'efterhand' ? Date.now() - 30 * 60_000 : Date.now();
      const forval = klockslag(new Date(Math.floor(forvalMs / 300_000) * 300_000).toISOString()).replace('.', ':');
      const svar = await dialog(`<form><h2 id="dlg-rubrik">${typ === 'fri' ? 'Ge' : 'Registrera i efterhand'}: ${esc(namnText)}</h2>
        <p>${typ === 'fri' ? 'Ordinationen har inga fasta tider. Ange dosen som ges.' : 'Ange när dosen gavs. Registreringen visar både när dosen gavs och när den registrerades.'}</p>
        <div class="falt-rad"><div class="falt"><label for="adm-tid">Klockslag</label><input id="adm-tid" name="tid" type="time" value="${esc(forval)}" required></div>
        ${typ === 'fri' ? '<div class="falt"><label for="adm-dos">Dos</label><input id="adm-dos" name="dos" inputmode="decimal"></div>' : ''}</div>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
      if (!svar) return;
      data.atgard = 'ge';
      data.tid = lokalTill(svar.data.tid);
      if (svar.data.dos?.trim()) data.dos = Number(svar.data.dos.replace(',', '.'));
    } else if (typ === 'iordningstall' && b.dataset.bered) {
      // Runda 9, r1: beredningen. Systemet visar vad som ska göras, och den som bereder anger bara batchnumret.
      const svar = await beredDialog(namnText, JSON.parse(b.dataset.bered));
      if (!svar) return;
      Object.assign(data, { atgard: 'iordningstall', beredning: svar });
    } else data.atgard = typ;
    try {
      const r = await medKnapp(b, () => registrera(b.dataset.pid, data, namnText));
      if (!r) return;
      const a = r.administrering;
      if (r.koad) {
        notis(`${a.lakemedel?.namn ?? namnText} är given kl. ${klockslag(a.tid)}. Den är sparad i kön på den här datorn och inte i journalen än. Den skickas när förbindelsen är tillbaka.`, 'info');
        return ladda();
      }
      // Runda 13, r4: efter en dos vid behov påminner systemet om att följa upp effekten.
      const vidBehov = b.closest('.adm-vb') && typ === 'ge';
      notis(`${a.lakemedel?.namn} ${KLAR[typ] ?? 'är registrerad'}${a.antal > 1 ? `, ${a.antal} st,` : ''}${a.tid ? ` kl. ${klockslag(a.tid)}` : ''}.${a.iordningstalld && a.status === 'iordningstalld' ? ` Etikett ${a.iordningstalld.kontrollkod}.` : ''}${vidBehov ? ' Följ upp effekten om en timme och dokumentera den.' : ''}`);
      ladda();
    } catch { /* notis visad */ }
  });
}

async function angeHandelsetid(b, ladda) {
  // Runda 11, r1: i morgon efter det svenska datumet (tidigare UTC, som gav i dag mellan 00 och 01).
  const imorgon = plusDagar(idag(), 1);
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
// Runda 9, r2: infusionspumparna. Dosen registreras av systemet när pumpen rapporterar, och en varning från kontrollen mot
// ordinationen visas här och i patientens mätvärden, där den kvitteras.
function pumparHtml(d) {
  if (!d?.pumpar?.length) return '';
  return `<section class="adm-pumpar ov-sektion" aria-labelledby="adm-pumpar"><div class="sektion-huvud"><h2 id="adm-pumpar">Pumpar som rapporterar</h2></div>
    <ul class="mt-kopplingar">${d.pumpar.map(p => `<li class="mt-koppling"><div><a class="patientlank" href="#/patient/${encodeURIComponent(p.patient.id)}/matvarden">${esc(p.patient.namn)}</a>
      <span class="under-text">${esc(p.koppling.utrustning?.typText ?? '')} ${esc(p.koppling.utrustning?.serienummer ?? '')}${p.koppling.ordination ? `, ${esc(p.koppling.ordination.text)}` : ''}. ${p.senaste ? esc(p.senaste.text) : 'Ingen rapport än'}. Det senaste dygnet ${esc(String(p.dygn.volymMl).replace('.', ','))} ml${p.dygn.dos != null ? `, ${esc(String(p.dygn.dos).replace('.', ','))} ${esc(p.dygn.dosEnhet ?? '')}` : ''}.</span></div>
      ${p.okvitterade.length ? `<p class="ruta ruta-larm liten">${ikon.larm}<span>${esc(p.okvitterade[0].varningar[0].text)} <a href="#/patient/${encodeURIComponent(p.patient.id)}/matvarden">Kvittera i mätvärdena</a>.</span></p>` : ''}</li>`).join('')}</ul>
    <p class="dampad liten">Doserna från pumpen registreras av systemet med källan utrustning och räknas in i vätskebalansen. ${esc(d.demo)}</p></section>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Läkemedel att ge', 'Dagens doser för de inneliggande patienterna, framräknade ur ordinationerna.') + hjalpRuta('ge-dos') + '<div id="adm"><p class="tom">Hämtar.</p></div>';
  const el = main.querySelector('#adm');
  const d = await api('/api/administreringar');
  // Runda 8, r4: har användaren gått vidare, eller har listan ritats om medan den hämtades (två doser givna tätt efter
  // varandra), ritar den senaste omritningen själv. Annars kopplades knapparna två gånger till samma lista, och ett
  // klick på Ge registrerade dosen två gånger (testfall 1.4 föll ibland på varningen för dubbel dos).
  if (!el.isConnected) return;
  if (!d.patienter.length) { el.innerHTML = tom(`Det finns inga inneliggande patienter på ${d.vardenhet?.namn ?? 'din vårdenhet'} som du har vårdrelation till.`); return; }
  // Undersköterskan ser vad hennes delegering omfattar och hur länge den gäller (runda 5).
  const deleg = d.delegering ? `<p class="ruta ruta-info liten adm-delegering">${ikon.info}<span>${d.delegering.giltig
    ? `Du ger läkemedel med delegering: ${esc(d.delegering.omfattning.toLowerCase())}, till och med ${esc(datum(d.delegering.till))}. Knappen Ge visas bara för doser som delegeringen omfattar.`
    : esc(d.delegering.varfor)} <a href="#/delegeringar">Mina delegeringar</a></span></p>` : '';
  // Runda 9, r2: pumparna som rapporterar doser på vårdenheten (medicinteknik.js, Sussa 3.5.2.19).
  const pump = await api('/api/mt/pumpar').catch(() => null);
  if (!el.isConnected) return;
  el.innerHTML = `${deleg}${pumparHtml(pump)}<p class="ingress liten">${esc(d.vardenhet?.namn ?? '')}: ${d.sammanfattning.attGe} ${d.sammanfattning.attGe === 1 ? 'dos' : 'doser'} att ge nu${d.sammanfattning.forsenade ? `, ${d.sammanfattning.forsenade} försenade` : ''}. Varningarna är demoregler, inte kliniskt beslutsstöd.</p>
    ${d.patienter.map(p => `<section class="adm-patient" aria-labelledby="adm-${esc(p.patient.id)}">
      <h2 id="adm-${esc(p.patient.id)}">${patientCell(p.patient, `#/patient/${encodeURIComponent(p.patient.id)}/lakemedel`)} <span class="dampad liten">${esc(p.plats ?? '')}</span></h2>
      ${patientDoser(p.patient.id, p, p.patient)}
    </section>`).join('')}`;
  koppla(el, () => visa(main));
  skannaArmband(el);
}

// Runda 9, r6: vid sängen identifieras patienten med armbandet (Sussa 2.3.1.1). En streckkodsläsare skriver koden och
// Enter i fältet. Systemet tolkar koden (POST /api/skanna, Sussa 3.1.3.6) och visar bara den patientens doser, så att
// rätt dos ges till rätt patient. Behörigheten prövas på servern innan något om patienten visas.
function skannaArmband(el) {
  const form = document.createElement('form');
  // Runda 10, r1: en egen klass, så att Enter i fältet inte fångas av skanningen av etikett och armband vid en dos.
  form.className = 'adm-skanna-armband';
  form.innerHTML = `<label for="adm-kod">Skanna patientens armband</label><div class="adm-skanna-rad"><input id="adm-kod" name="kod" autocomplete="off" spellcheck="false" maxlength="200" aria-describedby="adm-kod-svar">
    <button type="submit" class="knapp sekundar">Visa patienten</button></div><p id="adm-kod-svar" class="under-text" role="status"></p>`;
  el.prepend(form);
  const svar = form.querySelector('#adm-kod-svar');
  const visaAlla = () => { el.querySelectorAll('.adm-patient').forEach(x => { x.hidden = false; }); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kod = form.kod.value.trim();
    if (!kod) { visaAlla(); svar.textContent = ''; return; }
    try {
      const r = await api('/api/skanna', { metod: 'POST', data: { kod, sammanhang: 'oppna' }, tyst: true });
      const pid = r.patient?.id;
      const sektion = pid ? el.querySelector(`#adm-${CSS.escape(pid)}`)?.closest('.adm-patient') : null;
      if (!sektion) { visaAlla(); svar.textContent = 'Patienten har inga doser i listan.'; return; }
      el.querySelectorAll('.adm-patient').forEach(x => { x.hidden = x !== sektion; });
      svar.textContent = `${r.patient.namn}, ${r.patient.personnummer}. Bara patientens doser visas. Töm fältet för att se alla.`;
      sektion.querySelector('button')?.focus();
    } catch (x) {
      visaAlla();
      svar.textContent = x.status === 404 && /Okänd adress/.test(x.message) ? 'Inläsning av armband finns inte i den här versionen.' : x.message;
    } finally { form.kod.value = ''; }
  });
}

// ---- Runda 9, r1: beredning med kontroll och etikett, flytande form, gas och patientnära skanning ----------------

const beredData = (d) => ({ text: d.spadning?.text ?? '', dubbel: Boolean(d.beredning?.dubbelkontroll), varfor: d.beredning?.varfor ?? '', timmar: d.beredning?.hallbarTimmar ?? null });
// Under doseringen: att dosen bereds, mängden i ml för en oral lösning och flödet för syrgas.
// Runda 10, r5: att en kollega kontrollerar dosen, och varför.
const kollegaInfo = (d) => (d.kollegakontroll?.kravs ? ` <span class="tagg">Kollegakontroll</span><span class="under-text">${esc(d.kollegakontroll.varfor)}</span>` : '');
const r9Info = (d) => [
  !d.beredning && d.kollegakontroll?.kravs && kollegaInfo(d),
  d.beredning && `<span class="under-text"><span class="tagg">Bereds</span>${d.beredning.dubbelkontroll ? ' <span class="tagg">Kontroll av en annan person</span>' : ''} Håller ${esc(String(d.beredning.hallbarTimmar))} timmar efter beredningen.</span>`,
  d.flytande && `<span class="under-text adm-flytande">${esc(d.flytande.text)}</span>`,
  d.gas && `<span class="under-text adm-gas">${esc(d.gas.text)}</span>`,
].filter(Boolean).join('');
// Vid en iordningsställd dos: beredningen, kontrollen och etiketten.
const r9Status = (pid, a, kan) => {
  const b = a.beredning;
  const jag = S.session?.personal?.id;
  const kanKontrollera = kan && ['sjukskoterska', 'lakare'].includes(S.session?.personal?.yrke) && b?.bereddAv?.id !== jag;
  return `${b ? `<span class="under-text">Batch ${esc(b.batch)}, håller till ${esc(klockslag(b.hallbarTill))}.${b.kontroll.kravs ? b.kontroll.av ? ` Kontrollerad av ${esc(b.kontroll.av.namn)}.` : ' <span class="tagg tagg-larm">Väntar på kontroll</span>' : ''}</span>` : ''}
    ${kollegaStatus(pid, a, kan)}
    <span class="knapprad">${b?.kontroll?.kravs && !b.kontroll.av && kanKontrollera ? `<button type="button" class="knapp liten" data-kontroll-ber="${b.id}" data-pid="${esc(pid)}" data-text="${esc(b.text ?? '')}" data-varfor="${esc(b.kontroll.varfor ?? '')}">Kontrollera beredning</button>` : ''}
    <button type="button" class="knapp-lank" data-etikett="${a.id}" data-pid="${esc(pid)}">Etikett</button></span>`;
};

// Runda 10, r5: kollegakontrollen av en iordningsställd dos. Den som iordningsställde kan inte kontrollera själv.
function kollegaStatus(pid, a, kan) {
  const k = a.kollegakontroll;
  if (!k) return '';
  const jag = S.session?.personal?.id;
  const kanKontrollera = kan && ['sjukskoterska', 'lakare'].includes(S.session?.personal?.yrke) && k.iordningstalldAv?.id !== jag;
  return `<span class="under-text">${k.av ? `Kollegakontroll av ${esc(k.av.namn)} ${esc(klockslag(k.tid))}.` : '<span class="tagg tagg-larm">Väntar på kollegakontroll</span>'}</span>
    ${!k.av && kanKontrollera ? `<button type="button" class="knapp liten" data-kollega="${k.id}" data-pid="${esc(pid)}" data-varfor="${esc(k.varfor)}" data-kod="${esc(a.iordningstalld?.kontrollkod ?? '')}">Kontrollera dosen</button>` : ''}`;
}
async function kontrolleraKollega(b, ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Kontrollera dosen</h2>
    <p class="liten">${esc(b.dataset.varfor)}</p>
    <p>Kontrollera läkemedlet, dosen, patienten och etiketten ${esc(b.dataset.kod)}. Kontrollen registreras på dig.</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Dosen är kontrollerad</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(b.dataset.pid)}/kollegakontroll/${b.dataset.kollega}`, { metod: 'POST', data: { kontrollkod: b.dataset.kod } }));
    notis('Dosen är kontrollerad och kan ges.');
    ladda();
  } catch { /* notis visad */ }
}

async function beredDialog(namnText, b) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Bered ${esc(namnText)}</h2>
    <p class="ruta ruta-info liten">${ikon.info}<span>${esc(b.text)}</span></p>
    ${b.dubbel ? `<p class="liten">${esc(b.varfor)}</p>` : ''}
    <div class="falt"><label for="ber-batch">Batchnummer <span class="obl">(obligatoriskt)</span></label><input id="ber-batch" name="batch" autocomplete="off" required minlength="3" maxlength="80">
      <span class="hjalp">Skanna förpackningen, så fyller systemet i batch och utgångsdatum, eller skriv batchnumret.</span></div>
    <div class="falt"><label for="ber-utgang">Förpackningens utgångsdatum</label><input id="ber-utgang" name="utgang" type="date"></div>
    <p class="liten">Beredningen håller ${esc(String(b.timmar ?? 24))} timmar. Etiketten finns vid dosen efter beredningen.</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera beredningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (x) => (String(x.batch ?? '').trim().length < 3 ? 'Ange batchnumret, minst tre tecken, eller skanna förpackningen.' : null) });
  if (!svar) return null;
  const v = String(svar.data.batch).trim();
  // En skannad förpackningskod (GS1) innehåller batch och utgångsdatum, och servern läser dem.
  const kod = /^\(01\)|^01\d{14}/.test(v);
  return { ...(kod ? { forpackningskod: v } : { batch: v }), ...(svar.data.utgang ? { utgang: svar.data.utgang } : {}) };
}

async function kontrolleraBeredning(b, ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Kontrollera beredningen</h2>
    <p>${esc(b.dataset.text)}</p><p class="liten">${esc(b.dataset.varfor)}</p>
    <div class="falt"><label for="kb-batch">Batchnummer som du läser på förpackningen <span class="obl">(obligatoriskt)</span></label><input id="kb-batch" name="batch" autocomplete="off" required minlength="3" maxlength="20"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Beredningen är kontrollerad</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(b.dataset.pid)}/beredningar/${b.dataset.kontrollBer}/kontroll`, { metod: 'POST', data: { batch: svar.data.batch.trim() } }));
    notis('Beredningen är kontrollerad. Dosen kan ges.');
    ladda();
  } catch { /* notis visad */ }
}

async function visaEtikett(pid, aid) {
  try {
    const e = await api(`/api/patient/${encodeURIComponent(pid)}/administreringar/${aid}/etikett`);
    const pdf = `/api/patient/${encodeURIComponent(pid)}/administreringar/${aid}/etikett.pdf`;
    const rad = (r) => `<span>${r.fet ? `<strong>${esc(r.text)}</strong>` : esc(r.text)}</span>`;
    await dialog(`<div><h2 id="dlg-rubrik">Etikett ${esc(e.kontrollkod)}</h2>
      ${e.skyddad ? '<p class="liten">Patienten har skyddade personuppgifter. Namn och personnummer står på etiketten först när du har valt att visa identiteten.</p>' : ''}
      <div class="pr-etikett adm-etikett">${e.rader.slice(0, 2).map(rad).join('')}${e.svg}${e.rader.slice(2).map(rad).join('')}</div>
      <div class="knapprad"><a class="knapp" href="${pdf}" target="_blank" rel="noopener">Skriv ut</a><a class="knapp sekundar" href="${pdf}?format=${e.format === 'a4' ? 'etikett' : 'a4'}" target="_blank" rel="noopener">${e.format === 'a4' ? 'En etikett per sida' : 'A4-ark'}</a><button type="button" class="knapp sekundar" data-varde="avbryt">Stäng</button></div></div>`, { klass: 'dialog-bred' });
  } catch (x) { felNotis(x); }
}

async function visaArmband(pid) {
  try {
    const a = await api(`/api/patient/${encodeURIComponent(pid)}/armband`);
    await dialog(`<div><h2 id="dlg-rubrik">Patientens armband</h2>
      <p class="liten">Armbandet har patientens journalnummer i Vårdkällan som streckkod, aldrig personnumret. I demon kan koden skrivas i fältet för skanning.</p>
      <div class="pr-etikett adm-etikett"><span><strong>${esc(a.patient.namn)}</strong></span><span>${esc(a.patient.personnummer)}</span>${a.svg}</div>
      <div class="knapprad"><a class="knapp" href="/api/patient/${encodeURIComponent(pid)}/armband.pdf" target="_blank" rel="noopener">Skriv ut</a><button type="button" class="knapp sekundar" data-varde="avbryt">Stäng</button></div></div>`);
  } catch (x) { felNotis(x); }
}

const skannaForm = (pid) => `<form class="adm-skanna" data-pid="${esc(pid)}" novalidate>
  <div class="falt"><label for="sk-${esc(pid)}">Skanna etikett och armband</label><input id="sk-${esc(pid)}" name="kod" autocomplete="off">
  <span class="hjalp">Streckkodsläsaren skriver koden. Skanna etiketten på dosen och patientens armband, i valfri ordning.</span></div>
  <div class="knapprad"><button type="button" class="knapp liten sekundar" data-skanna>Kontrollera</button><button type="button" class="knapp-lank" data-armband="${esc(pid)}">Visa armbandet</button></div>
  <p class="under-text adm-skannat" aria-live="polite"></p></form>`;

// Varje skannad kod sparas tills både etiketten och armbandet finns. Sedan prövar servern dem, och dosen ges efter en
// bekräftelse med båda koderna, som servern prövar på nytt.
async function skanning(input, ladda) {
  const form = input.closest('.adm-skanna');
  const kod = input.value.trim();
  input.value = '';
  if (kod) {
    if (/^VKA-/i.test(kod)) form.dataset.armband = kod; else form.dataset.etikett = kod;
  }
  const kvar = !form.dataset.etikett ? 'Skanna etiketten på dosen.' : !form.dataset.armband ? 'Skanna patientens armband.' : '';
  form.querySelector('.adm-skannat').textContent = kvar;
  if (kvar) { input.focus(); return; }
  const pid = form.dataset.pid;
  const koder = { etikett: form.dataset.etikett, armband: form.dataset.armband };
  delete form.dataset.etikett;
  delete form.dataset.armband;
  try {
    const r = await api(`/api/patient/${encodeURIComponent(pid)}/administreringar/skanna`, { metod: 'POST', data: koder });
    const svar = await dialog(`<div><h2 id="dlg-rubrik">${ikon.info}<span>Skanningen stämmer</span></h2><p>${esc(r.text)}</p>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Ge</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></div>`);
    if (!svar) return;
    const ut = await registrera(pid, { ordinationId: r.ordinationId, ...(r.planerad ? { planerad: r.planerad } : {}), kontrollkod: r.kontrollkod, armband: r.armband, atgard: 'ge' }, r.lakemedel.namn);
    if (!ut) return;
    notis(`${ut.administrering.lakemedel?.namn} är given kl. ${klockslag(ut.administrering.tid)}, efter skanning av etikett och armband.`);
    ladda();
  } catch (e) {
    if (form.isConnected) form.querySelector('.adm-skannat').textContent = e.message ?? '';
    felNotis(e);
  }
}

// ---- Runda 9, r1: ordinationer som patienten sköter själv ----------------------------------------------------------

const EGEN_STATUS = { kommande: ['Kommande', ''], att_kvittera: ['Kvittera nu', 'tagg-pagaende'], ej_kvitterad: ['Inte kvitterad', 'tagg-larm'], tagen: ['Tagen', 'tagg-ok'], inte_tagen: ['Inte tagen', 'tagg-utkast'] };
function egenHtml(pid, l, kan) {
  const lista = l.egenadministrering ?? [];
  if (!lista.length) return '';
  const dos = (x, d) => {
    const [st, kl] = EGEN_STATUS[d.status] ?? [d.status, ''];
    const knappar = kan && !d.kvittens ? `<button type="button" class="knapp liten" data-egen="tagen" data-pid="${esc(pid)}" data-ord="${x.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(x.lakemedel?.namn)}">Tagen</button><button type="button" class="knapp liten sekundar" data-egen="inte" data-pid="${esc(pid)}" data-ord="${x.ordinationId}" data-planerad="${esc(d.planerad)}" data-namn="${esc(x.lakemedel?.namn)}">Inte tagen</button>` : '';
    return `<li><time>${esc(klockslag(d.planerad))}</time> <span class="tagg ${kl}">${esc(st)}</span>${d.kvittens ? ` <span class="dampad liten">Kvitterad ${esc(klockslag(d.kvittens.tid))} av ${esc(d.kvittens.kvitteradAv)}${d.kvittens.orsak ? `: ${esc(d.kvittens.orsak)}` : ''}</span>` : ''} ${knappar}</li>`;
  };
  return `<h4 class="adm-egen-rubrik">Patienten tar själv</h4><ul class="adm-lista adm-egen">${lista.map(x => `<li class="adm-vb"><div><strong>${lmText(x)}</strong> <span class="tagg">Patienten tar själv</span>
    <span class="under-text">${esc(x.dosering)}</span>
    ${x.doser.length ? `<ul class="liten">${x.doser.map(d => dos(x, d)).join('')}</ul>` : `<span class="under-text">${x.senaste.length ? `Senast kvitterat ${esc(tidpunkt(x.senaste[0].tid))}.` : 'Inget intag kvitterat.'}</span>`}</div>
    ${kan && x.vidBehov ? `<button type="button" class="knapp liten sekundar" data-egen="tagen" data-pid="${esc(pid)}" data-ord="${x.ordinationId}" data-namn="${esc(x.lakemedel?.namn)}">Registrera intag</button>` : ''}</li>`).join('')}</ul>`;
}

async function kvitteraEgen(b, ladda) {
  const data = { ordinationId: Number(b.dataset.ord), ...(b.dataset.planerad ? { planerad: b.dataset.planerad } : {}), tagen: b.dataset.egen === 'tagen' };
  if (!data.tagen) {
    const svar = await dialog(`<form><h2 id="dlg-rubrik">${esc(b.dataset.namn)} togs inte</h2>
      <div class="falt"><label for="egen-orsak">Orsak <span class="obl">(obligatoriskt)</span></label><textarea id="egen-orsak" name="orsak" rows="2" required minlength="3" maxlength="300"></textarea></div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
    if (!svar) return;
    data.orsak = svar.data.orsak.trim();
  }
  try {
    await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(b.dataset.pid)}/egenintag`, { metod: 'POST', data }));
    notis(`${b.dataset.namn}: intaget är ${data.tagen ? 'kvitterat' : 'registrerat som inte taget'}.`);
    ladda();
  } catch { /* notis visad */ }
}
