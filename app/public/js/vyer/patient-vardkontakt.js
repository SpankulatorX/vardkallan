// Vårdkontakter, vårdtillfällen och hälsoärenden i patientens översikt, och raden "Dokumenteras på" i formulären.
// Systemet väljer vårdkontakten åt den som dokumenterar. Här visas vilken det blir, med möjlighet att ändra, och de
// dialoger som vårdadministratören och sjuksköterskan använder för att registrera kontakter och skriva in, flytta och
// skriva ut. Alla regler gäller på servern (src/vardkontakt.js); gränssnittet visar bara förval och förklaringar.
import { esc, api, datum, tidpunkt, dialog, notis, felNotis, migreradEtikett, VARDFORM, ikon, plusDagar, idag } from '../ui.js';
import { far } from '../app.js';
// Runda 13, r3 (E1-36).
import { sattDiagnos } from './patient-oversikt.js';

// Runda 13, r3 (E1-16): administrativ kontakt utan avgift, förvald när patienten inte är på plats.
export const KONTAKTSATT = { besok: 'Besök', telefon: 'Telefon', video: 'Video', hembesok: 'Hembesök', administrativ: 'Administrativ' };
const STATUS = { planerad: 'Planerad', pagaende: 'Pågående', avslutad: 'Avslutad' };
const VT_STATUS = { inskriven: 'Inskriven', permission: 'På permission', utskriven: 'Utskriven' };
const kr = (b) => `${Number(b).toLocaleString('sv-SE')} kr`;

const kontaktText = (v) => `${v.kontaktsatt ? KONTAKTSATT[v.kontaktsatt] : VARDFORM[v.typ] ?? v.typ}, ${v.vardenhet?.namn ?? ''}`;

// Raden överst i formulären: vilken vårdkontakt det som sparas hamnar på. dok är { vardkontakt, ny } från servern.
// val är användarens ändring av en ny kontakt, { kontaktsatt, orsak }, eller null.
export function dokumenterasHtml(dok, val = null) {
  if (!dok) return '';
  if (dok.vardkontakt?.dold && !val) {
    // Vistelsen ligger på en annan vårdenhet som användaren inte får se utan aktivt val.
    const v = dok.vardkontakt;
    return `<p class="dok-kontakt" data-dok-kontakt>${ikon.info}<span>Dokumenteras på vårdtillfället <strong>${esc(v.orsak ?? '')}</strong>, där ${esc(v.ansvarig?.namn ?? 'din klinik')} har det medicinska ansvaret. Patienten vårdas på en annan vårdenhet.</span>
      <button type="button" class="knapp text liten" data-dok-andra>Ny kontakt i stället</button></p>`;
  }
  if (dok.vardkontakt && !val) {
    const v = dok.vardkontakt;
    return `<p class="dok-kontakt" data-dok-kontakt>${ikon.info}<span>Dokumenteras på vårdkontakten <strong>${esc(v.orsak)}</strong>: ${esc(kontaktText(v))}${v.plats && v.plats !== v.vardenhet?.namn ? `, ${esc(v.plats)}` : ''}, sedan ${esc(tidpunkt(v.ankomst ?? v.start))}.</span>
      <button type="button" class="knapp text liten" data-dok-andra>Ny kontakt i stället</button></p>`;
  }
  const n = { ...(dok.ny ?? {}), ...(val ?? {}) };
  const satt = KONTAKTSATT[n.kontaktsatt] ?? 'Besök';
  const var_ = dok.ny?.enhet?.namn ?? dok.vardkontakt?.vardenhet?.namn ?? 'din enhet';
  const inledning = dok.vardkontakt ? 'I stället för den pågående kontakten skapar systemet' : `Patienten har ingen pågående vårdkontakt på ${esc(dok.ny?.vardenhet?.namn ?? 'din enhet')}. När du sparar skapar systemet`;
  return `<p class="dok-kontakt dok-ny" data-dok-kontakt>${ikon.info}<span>${inledning} en vårdkontakt i dag: <strong>${esc(satt)}</strong> på ${esc(var_)}${n.orsak ? `. Kontaktorsak: ${esc(n.orsak)}` : ''}${/[.?!]$/.test(n.orsak ?? '') ? '' : '.'}</span>
    <button type="button" class="knapp text liten" data-dok-andra>Ändra</button></p>`;
}

// Kopplar knappen i raden. Ändringen sparas i state.val och skickas som nyKontakt när uppgiften sparas.
export function kopplaDokumenteras(el, dok, state, rita) {
  el.querySelector('[data-dok-andra]')?.addEventListener('click', async () => {
    const forval = { ...(dok.ny ?? { kontaktsatt: 'besok', orsak: '' }), ...(state.val ?? {}) };
    const svar = await dialog(`<form>
      <h2 id="dlg-rubrik">Vårdkontakt för det du dokumenterar</h2>
      <div class="dialog-text"><p>Systemet knyter det du sparar till en vårdkontakt. Välj hur du har kontakt med patienten.</p></div>
      ${kontaktsattFalt(forval.kontaktsatt)}
      <div class="falt"><label for="dk-orsak">Kontaktorsak</label><input id="dk-orsak" name="orsak" maxlength="200" autocomplete="off" value="${esc(dok.vardkontakt ? '' : forval.orsak ?? '')}"></div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Använd</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
    </form>`, { onOpen: (dl) => kopplaKnappval(dl) });
    if (!svar) return;
    state.val = { kontaktsatt: svar.data.kontaktsatt, orsak: svar.data.orsak.trim() || null };
    rita();
  });
}
export const nyKontaktData = (state) => (state.val ? { nyKontakt: state.val } : {});

// Fyller plats med raden för ett formulär: hämtar vilken kontakt det blir och kopplar Ändra. Returnerar state, som
// formuläret skickar med nyKontaktData. Går det inte att hämta (till exempel i läsläget) visas ingen rad.
export function kontaktRad(plats, ctx) {
  const state = { val: null };
  if (!plats) return state;
  api(`/api/patient/${encodeURIComponent(ctx.id)}/vardkontakt/aktuell`).then((dok) => {
    if (!plats.isConnected) return;
    const rita = () => { plats.innerHTML = dokumenterasHtml(dok, state.val); kopplaDokumenteras(plats, dok, state, rita); };
    rita();
  }).catch(() => {});
  return state;
}

// Notisen efter att något sparats: säger var det hamnade, och att en ny kontakt kan ändras i översikten.
export function kontaktNotis(svar) {
  const v = svar?.vardkontakt;
  if (v?.ny) notis(`En ny vårdkontakt skapades: ${KONTAKTSATT[v.kontaktsatt] ?? 'Besök'} på ${v.vardenhet?.namn ?? ''}. Den kan ändras under Översikt.`, 'info');
}

// Ett val med knappar, ett klick per val. Värdet ligger i ett dolt fält, så att det följer med formuläret.
function knappval(namn, rubrik, alternativ, valt) {
  return `<div class="falt"><span class="etikett" id="kv-${namn}">${esc(rubrik)}</span><div class="segment knappval" role="group" aria-labelledby="kv-${namn}" data-knappval="${namn}">
    ${alternativ.map(([k, t]) => `<button type="button" data-val="${esc(k)}" aria-pressed="${k === valt}">${esc(t)}</button>`).join('')}
    <input type="hidden" name="${namn}" value="${esc(valt)}"></div></div>`;
}
const kontaktsattFalt = (valt = 'besok') => knappval('kontaktsatt', 'Kontaktsätt', Object.entries(KONTAKTSATT), valt);
// Kopplar knappvalen i en dialog. andrat anropas med formuläret efter varje val.
function kopplaKnappval(dl, andrat = () => {}) {
  dl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-knappval] button[data-val]');
    if (!b) return;
    const grupp = b.closest('[data-knappval]');
    for (const x of grupp.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    grupp.querySelector('input[type="hidden"]').value = b.dataset.val;
    andrat(dl.querySelector('form'));
  });
}

// Nästa vardag klockan 09:00, som förval för en planerad kontakt.
function nastaVardag() {
  let d = plusDagar(idag(), 1);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = plusDagar(d, 1);
  return `${d}T09:00`;
}

// En läskopia från en äldre version saknar vårdstrukturen. Då visas kontakterna utan den.
const TOM = { forval: {}, vardtillfallen: [], perKontakt: {}, halsoarenden: [], forslag: [] };
const struktur = (d) => d.vardstruktur ?? TOM;

// Avsnittet i översikten. d är svaret från /oversikt.
export function sektionHtml(d, ctx) {
  const s = struktur(d);
  const delar = [];
  const knappar = [];
  if (far('registrera_vardkontakt') && s.forval.registrering) knappar.push(`<button type="button" class="knapp liten sekundar" data-vk="registrera">${ikon.plus}<span>Registrera vårdkontakt</span></button>`);
  if (far('vardtillfalle') && s.forval.inskrivning) knappar.push(`<button type="button" class="knapp liten sekundar" data-vk="skriv-in">${ikon.plus}<span>Skriv in</span></button>`);
  for (const vt of s.vardtillfallen.filter(x => x.status !== 'utskriven')) delar.push(vardtillfalleHtml(vt, ctx));
  const per = s.perKontakt;
  const lista = d.vardkontakter.length ? `<ul class="enkel-lista vk-lista">${d.vardkontakter.map(v => {
    const p = per[v.id] ?? {};
    const innehall = [p.anteckningar && `${p.anteckningar} ${p.anteckningar === 1 ? 'anteckning' : 'anteckningar'}`, p.matvarden && `${p.matvarden} mätvärden`,
      p.ordinationer && `${p.ordinationer} ${p.ordinationer === 1 ? 'ordination' : 'ordinationer'}`, p.remisser && `${p.remisser} ${p.remisser === 1 ? 'remiss' : 'remisser'}`,
      p.diagnoser?.length && `diagnos ${p.diagnoser.join(', ')}`].filter(Boolean).join(', ');
    const arende = v.halsoarendeId ? s.halsoarenden.find(h => h.id === v.halsoarendeId) : null;
    const plats = v.plats && v.plats !== v.vardenhet?.namn ? `, ${esc(v.plats)}` : '';
    // Vem som skapade kontakten och när (spårbarhet). Migrerade kontakter har sin etikett i stället.
    const ursprung = v.automatisk ? `Skapad av systemet${v.skapadAv ? ` när ${esc(v.skapadAv.namn)} dokumenterade` : ' när historiken fördes över'}`
      : v.skapadAv ? `Registrerad av ${esc(v.skapadAv.namn)}, ${esc(v.skapadAv.titel ?? '')}` : v.kalla === 'vardkallan' ? 'Registrerad' : '';
    const sparning = ursprung ? `${ursprung}${v.kalla === 'vardkallan' && v.skapad ? ` ${esc(tidpunkt(v.skapad))}` : ''}${v.andradAv ? `. Ändrad av ${esc(v.andradAv.namn)} ${esc(tidpunkt(v.andrad))}` : ''}.` : '';
    return `<li data-vk-id="${v.id}"><strong>${esc(v.orsak)}</strong>${v.status !== 'avslutad' ? ` <span class="tagg tagg-pagaende">${esc(STATUS[v.status])}</span>` : ''}${arende ? ` <span class="tagg">Hälsoärende: ${esc(arende.rubrik)}</span>` : ''}
      <span class="under-text">${esc(v.kontaktsatt ? KONTAKTSATT[v.kontaktsatt] : VARDFORM[v.typ] ?? v.typ)}${v.typ !== 'slutenvard' && v.kontaktsatt ? `, ${esc(VARDFORM[v.typ] ?? '').toLowerCase()}` : ''}, ${esc(v.vardenhet?.namn ?? '')}${plats}. ${esc(datum(v.ankomst ?? v.start))}${v.slut ? ` till ${esc(datum(v.slut))}` : ''}${v.planerad && v.ankomst ? `, ankom ${esc(tidpunkt(v.ankomst))}` : ''}</span>
      ${innehall ? `<span class="under-text">${esc(innehall)}</span>` : ''}
      ${sparning ? `<span class="under-text">${sparning}</span>` : ''}
      ${v.avgift ? `<span class="under-text">Patientavgift ${esc(kr(v.avgift.belopp))}. ${esc(v.avgift.text)}</span>` : ''}${migreradEtikett(v)}
      ${v.besokSlut ? `<span class="under-text">Besöket slutade ${esc(tidpunkt(v.besokSlut))}.</span>` : ''}
      ${v.kanAndras && v.status !== 'avslutad' ? `<span class="knapprad tat" data-skriv><button type="button" class="knapp text liten" data-vk="andra" data-id="${v.id}">Ändra</button>${v.typ !== 'slutenvard' && !v.besokSlut ? `<button type="button" class="knapp text liten" data-vk="besok-slut" data-id="${v.id}">Besöket är slut</button>` : ''}<button type="button" class="knapp text liten" data-vk="avsluta" data-id="${v.id}">Avsluta kontakten</button></span>` : ''}
      <span class="knapprad tat"><button type="button" class="knapp text liten" data-vk="handelser" data-id="${v.id}">Händelser och kringsystem</button></span>
    </li>`;
  }).join('')}</ul>` : '<p class="tom liten">Inga vårdkontakter som du kan se.</p>';
  delar.push(lista);
  return `<section class="ov-sektion ov-vardkontakter" aria-labelledby="ov-vk"><div class="sektion-huvud"><h2 id="ov-vk">Vårdkontakter</h2></div>
    ${knappar.length ? `<div class="knapprad tat" data-skriv>${knappar.join('')}</div>` : ''}${delar.join('')}</section>`;
}

function vardtillfalleHtml(vt, ctx) {
  const kan = far('vardtillfalle');
  // Runda 8, r5: epikrisen öppnas direkt från vårdtillfället, med det som systemet kan skriva ur det.
  const epikris = ctx && far('skriv_journal') ? `<a class="knapp liten sekundar" href="${ctx.href('journal', 'epikris')}" data-epikris>${ikon.penna}<span>Skriv epikris</span></a>` : '';
  const satellit = vt.ansvarig && vt.produktion && vt.ansvarig.id !== vt.produktion.id;
  return `<div class="vardtillfalle" data-vt="${vt.id}">
    <p class="vt-rubrik"><strong>${esc(VT_STATUS[vt.status])}</strong> på ${esc(vt.avdelning?.namn ?? '')}, ${esc(vt.plats ?? '')}${vt.status === 'permission' ? ` <span class="tagg tagg-utkast">Permission till ${esc(datum(vt.permissionTill))}</span>` : ''}</p>
    <p class="under-text">Vårdtillfälle sedan ${esc(tidpunkt(vt.inskriven))}. ${esc(vt.orsak ?? '')}</p>
    ${satellit ? `<p class="under-text">Medicinskt ansvar: ${esc(vt.ansvarig.namn)}. Patienten vårdas på ${esc(vt.produktion.namn)}.</p>` : ''}
    <details class="vt-historik"><summary>Vårdtillfällets händelser (${vt.handelser.length})</summary><ol>${vt.handelser.map(h => `<li><span class="vt-handelse">${esc(h.text)}</span> ${esc(tidpunkt(h.tid))}${h.plats ? `, ${esc(h.plats)}` : ''}${h.detalj ? `. ${esc(h.detalj)}` : ''}${h.av ? `. ${esc(h.av.namn)}` : ''}</li>`).join('')}</ol></details>
    ${kan ? `<div class="knapprad tat" data-skriv>
      ${vt.status === 'permission' ? '<button type="button" class="knapp liten sekundar" data-vk="ater">Åter från permission</button>' : '<button type="button" class="knapp liten sekundar" data-vk="flytta">Flytta</button><button type="button" class="knapp liten sekundar" data-vk="permission">Permission</button>'}
      <button type="button" class="knapp liten sekundar" data-vk="skriv-ut">Skriv ut</button><button type="button" class="knapp liten sekundar" data-vk="hemsjukvard">Skriv ut till hemsjukvård</button><button type="button" class="knapp liten sekundar" data-vk="armband">Armband</button>${epikris}</div>` : epikris ? `<div class="knapprad tat" data-skriv>${epikris}</div>` : ''}
  </div>`;
}

// Systemets förslag på hälsoärenden. Ett klick bekräftar.
export function forslagHtml(d) {
  const f = struktur(d).forslag;
  if (!f.length || !far('halsoarende')) return '';
  const vk = new Map(d.vardkontakter.map(v => [v.id, v]));
  return f.map(x => `<div class="ruta ruta-info ha-forslag" data-ha="${esc(x.nyckel)}">${ikon.info}<div>
    <p><strong>${x.typ === 'nytt' ? `Systemet föreslår ett hälsoärende: ${esc(x.rubrik)}` : `Systemet föreslår att kontakterna hör till hälsoärendet ${esc(x.rubrik)}`}</strong></p>
    <p class="liten">${x.grunder.map(g => esc(g.text)).join(' ')}</p>
    <ul class="liten ha-kontakter">${x.kontakter.map(id => vk.get(id)).filter(Boolean).map(v => `<li>${esc(datum(v.ankomst ?? v.start))}, ${esc(v.orsak)} (${esc(v.vardenhet?.namn ?? '')})</li>`).join('')}</ul>
    <div class="knapprad" data-skriv><button type="button" class="knapp liten" data-ha-bekrafta>Bekräfta</button><button type="button" class="knapp liten text" data-ha-avvisa>Inte samma ärende</button></div>
  </div></div>`).join('');
}

// Händelser i avsnittet. ladda ritar om översikten efter en ändring.
export function koppla(el, d, ctx, ladda) {
  const pid = encodeURIComponent(ctx.id);
  const s = struktur(d);
  const kor = async (fn, klar) => {
    try { const r = await fn(); notis(typeof klar === 'function' ? klar(r) : klar); await ladda(); } catch (e) { felNotis(e); }
  };
  el.addEventListener('click', async (e) => {
    const ha = e.target.closest('[data-ha-bekrafta], [data-ha-avvisa]');
    if (ha) {
      const nyckel = ha.closest('[data-ha]').dataset.ha;
      ha.disabled = true;
      if (ha.matches('[data-ha-bekrafta]')) await kor(() => api(`/api/patient/${pid}/halsoarenden`, { metod: 'POST', data: { nyckel } }), (r) => `Hälsoärendet ${r.rubrik} är bekräftat.`);
      else await kor(() => api(`/api/patient/${pid}/halsoarenden/avvisa`, { metod: 'POST', data: { nyckel } }), 'Förslaget visas inte igen.');
      return;
    }
    const b = e.target.closest('[data-vk]');
    if (!b) return;
    const vtId = b.closest('[data-vt]')?.dataset.vt;
    const vt = vtId ? s.vardtillfallen.find(x => String(x.id) === vtId) : null;
    const handling = b.dataset.vk;
    if (handling === 'registrera') return registrera(s, pid, kor);
    if (handling === 'skriv-in') return skrivIn(s, pid, kor);
    if (handling === 'flytta') return flytta(vt, kor);
    if (handling === 'permission') return permission(vt, kor);
    if (handling === 'ater') return kor(() => api(`/api/vardtillfalle/${vt.id}/permission/avsluta`, { metod: 'POST', data: {} }), 'Patienten är åter från permission.');
    if (handling === 'skriv-ut') return skrivUt(vt, kor);
    // Runda 9, r7: utskrivning till hemsjukvård, patientens armband, besökets sluttid och händelsekedjan.
    if (handling === 'hemsjukvard') return kor(() => api(`/api/vardtillfalle/${vt.id}/overgang`, { metod: 'POST', data: { till: 'hemsjukvard' } }), (r) => r.text);
    if (handling === 'armband') return armband(pid);
    if (handling === 'besok-slut') return kor(() => api(`/api/vardkontakt/${b.dataset.id}/besok-slut`, { metod: 'POST', data: {} }), (r) => r.text);
    if (handling === 'handelser') return handelser(b.dataset.id);
    const v = d.vardkontakter.find(x => String(x.id) === b.dataset.id);
    if (handling === 'andra' && v) return andra(v, kor);
    if (handling === 'avsluta' && v) {
      // Runda 13, r3 (E1-36): en kontakt utan diagnos avslutas efter en fråga till den som får sätta diagnos.
      if (far('registrera_diagnos') && Array.isArray(v.diagnoser) && !v.diagnoser.length) {
        const svar = await dialog(`<h2 id="dlg-rubrik">Kontakten har ingen diagnos</h2>
          <div class="dialog-text"><p>${esc(v.orsak ?? 'Vårdkontakten')} har ingen diagnos. Vill du sätta en innan kontakten avslutas?</p></div>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Sätt diagnos</button><button type="button" class="knapp sekundar" data-varde="utan">Avsluta utan diagnos</button><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div>`);
        if (!svar) return;
        if (svar.val === 'ok' && !(await sattDiagnos({ id: ctx.id }, null, { vardkontakt: v }).catch((x) => { felNotis(x); return false; }))) return;
      }
      return kor(() => api(`/api/vardkontakt/${v.id}/avsluta`, { metod: 'POST', data: {} }), 'Vårdkontakten är avslutad.');
    }
  });
}

// Runda 9, r7: patientens armband med streckkod, och händelsekedjan med kringsystemen för en vårdkontakt.
async function armband(pid) {
  try {
    const a = await api(`/api/patient/${pid}/armband`, { metod: 'POST', data: {} });
    await dialog(`<div><h2 id="dlg-rubrik">Armband</h2><div class="armband-utskrift"><p><strong>${esc(a.patient.namn)}</strong><br>${esc(a.patient.personnummer)}</p>${a.svg}</div>
      <p class="hjalp">Koden innehåller inga personuppgifter. Skanna armbandet för att öppna patienten eller kontrollera att ett rör eller en dos hör till rätt patient.</p>
      <div class="knapprad"><button type="button" class="knapp" data-skriv-armband>Skriv ut</button><button type="button" class="knapp sekundar" data-varde="avbryt">Stäng</button></div></div>`,
    { onOpen: (dl) => dl.querySelector('[data-skriv-armband]').addEventListener('click', () => window.print()) });
  } catch (e) { felNotis(e); }
}
async function handelser(id) {
  try {
    const h = await api(`/api/vardkontakt/${id}/handelser`);
    await dialog(`<div><h2 id="dlg-rubrik">Händelser i vårdkontakten</h2>
      <p class="under-text">Process-id ${esc(h.vardkontakt.processId)}</p>
      ${h.vardformer.length > 1 ? `<p>Vårdformer: ${h.vardformer.map(x => esc(x.dold ? x.vardformText : `${x.vardformText} ${datum(x.start)}${x.faktiskBesokstidMinuter != null ? `, ${x.faktiskBesokstidMinuter} minuter` : ''}`)).join(' till ')}</p>` : ''}
      <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Tid</th><th scope="col">System</th><th scope="col">Händelse</th><th scope="col">Korrelations-id</th></tr></thead>
      <tbody>${h.handelser.map(x => `<tr><td>${esc(tidpunkt(x.tid))}</td><td>${esc(x.system)}</td><td>${esc(x.handelse)}</td><td><code>${esc(x.korrelationId ?? '')}</code></td></tr>`).join('')}</tbody></table></div>
      <p class="hjalp">${esc(h.anmarkning)}</p>
      <div class="knapprad"><button type="button" class="knapp sekundar" data-varde="avbryt">Stäng</button></div></div>`);
  } catch (e) { felNotis(e); }
}

async function registrera(s, pid, kor) {
  const f = s.forval.registrering;
  const avgift = (k) => (f.avgifter?.[k] ? `Patientavgift ${kr(f.avgifter[k].belopp)}. ${f.avgifter[k].text}` : '');
  const svar = await dialog(`<form>
    <h2 id="dlg-rubrik">Registrera vårdkontakt</h2>
    <div class="dialog-text"><p>Kontakten registreras på ${esc(f.enhet?.namn ?? '')}. Systemet har fyllt i det som går att räkna ut.</p></div>
    ${kontaktsattFalt('besok')}
    <div class="falt"><label for="rk-orsak">Kontaktorsak${f.orsak ? '' : ' <span class="obl">(obligatoriskt)</span>'}</label><input id="rk-orsak" name="orsak" maxlength="200" autocomplete="off" value="${esc(f.orsak ?? '')}"></div>
    ${knappval('nar', 'När', [['nu', 'Nu'], ['planerad', 'Planerad']], 'nu')}
    <div class="falt" data-plan hidden><label for="rk-start">Tid</label><input id="rk-start" name="start" type="datetime-local" value="${esc(nastaVardag())}"></div>
    <p class="hjalp" data-avgift>${esc(avgift('besok'))}</p>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
  </form>`, {
    onOpen: (dl) => kopplaKnappval(dl, (form) => {
      dl.querySelector('[data-plan]').hidden = form.nar.value !== 'planerad';
      dl.querySelector('[data-avgift]').textContent = avgift(form.kontaktsatt.value);
    }),
    validera: (data) => (!data.orsak.trim() ? 'Ange kontaktorsak.' : data.nar === 'planerad' && !data.start ? 'Ange tid för den planerade kontakten.' : null),
  });
  if (!svar) return;
  const data = { kontaktsatt: svar.data.kontaktsatt, orsak: svar.data.orsak.trim() };
  if (svar.data.nar === 'planerad') Object.assign(data, { planerad: true, start: new Date(svar.data.start).toISOString() });
  await kor(() => api(`/api/patient/${pid}/vardkontakter`, { metod: 'POST', data }), (r) => (r.ankomstRegistrerad
    ? `Ankomsten är registrerad på den planerade kontakten ${tidpunkt(r.start)}.`
    : `${KONTAKTSATT[r.kontaktsatt]} är registrerat${r.planerad ? ` till ${tidpunkt(r.start)}` : ''}.${r.avgift ? ` Patientavgift ${kr(r.avgift.belopp)}.` : ''}`));
}

let avdelningar = null;
async function avdelningsLista() {
  avdelningar ??= await api('/api/avdelningar');
  return avdelningar;
}
const avdelningsval = (lista, valt, tom = null) => `${tom ? `<option value="">${esc(tom)}</option>` : ''}${lista.map(a => `<option value="${esc(a.id)}"${a.id === valt ? ' selected' : ''}>${esc(a.namn)}${a.sjukhus && !a.namn.includes(a.sjukhus) ? `, ${esc(a.sjukhus)}` : ''}</option>`).join('')}`;

async function skrivIn(s, pid, kor) {
  const f = s.forval.inskrivning;
  let lista;
  try { lista = await avdelningsLista(); } catch (e) { felNotis(e); return; }
  const svar = await dialog(`<form>
    <h2 id="dlg-rubrik">Skriv in patienten</h2>
    <div class="dialog-text"><p>Ett vårdtillfälle börjar. Det följer med patienten vid flytt och sängbyte, så inget behöver registreras om.${f.fran ? ` Akutbesöket på ${esc(f.fran.vardenhet?.namn ?? '')} avslutas och knyts till vårdtillfället.` : ''}</p></div>
    <div class="falt"><label for="si-orsak">Orsak till inskrivningen${f.orsak ? '' : ' <span class="obl">(obligatoriskt)</span>'}</label><input id="si-orsak" name="orsak" maxlength="200" autocomplete="off" value="${esc(f.orsak ?? '')}"></div>
    <div class="falt"><label for="si-enhet">Avdelning</label><select id="si-enhet" name="enhetId">${avdelningsval(lista, f.enhet?.id)}</select></div>
    <div class="falt"><label for="si-plats">Sal och säng</label><input id="si-plats" name="plats" maxlength="80" autocomplete="off" placeholder="Till exempel Avd 72, sal 3"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skriv in</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
  </form>`, { validera: (data) => (!data.orsak.trim() ? 'Ange orsaken till inskrivningen.' : null) });
  if (!svar) return;
  await kor(() => api(`/api/patient/${pid}/vardtillfallen`, { metod: 'POST', data: { enhetId: svar.data.enhetId, orsak: svar.data.orsak.trim(), plats: svar.data.plats.trim() } }),
    (r) => `Patienten är inskriven på ${r.avdelning?.namn ?? ''}.`);
}

async function flytta(vt, kor) {
  let lista;
  try { lista = await avdelningsLista(); } catch (e) { felNotis(e); return; }
  const svar = await dialog(`<form>
    <h2 id="dlg-rubrik">Flytta patienten</h2>
    <div class="dialog-text"><p>Patienten ligger på ${esc(vt.avdelning?.namn ?? '')}, ${esc(vt.plats ?? '')}. Vårdtillfället och allt som är dokumenterat följer med. Välj samma avdelning för ett sängbyte.</p></div>
    <div class="falt"><label for="fl-enhet">Till</label><select id="fl-enhet" name="enhetId">${avdelningsval(lista, null, 'Välj avdelning')}</select></div>
    <div class="falt"><label for="fl-plats">Sal och säng</label><input id="fl-plats" name="plats" maxlength="80" autocomplete="off"></div>
    <div class="kryssfalt" data-ansvar hidden><input type="checkbox" id="fl-ansvar" name="behallAnsvar" value="ja"><label for="fl-ansvar">${esc(vt.ansvarig?.namn ?? '')} behåller det medicinska ansvaret</label></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Flytta</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
  </form>`, {
    onOpen: (dl) => dl.querySelector('select').addEventListener('change', (e) => {
      const a = lista.find(x => x.id === e.target.value);
      dl.querySelector('[data-ansvar]').hidden = !a || a.vardenhet?.id === vt.ansvarig?.id;
    }),
    validera: (data) => (!data.enhetId ? 'Välj vart patienten flyttas.' : null),
  });
  if (!svar) return;
  await kor(() => api(`/api/vardtillfalle/${vt.id}/flytta`, { metod: 'POST', data: { enhetId: svar.data.enhetId, plats: svar.data.plats.trim(), behallAnsvar: svar.data.behallAnsvar === 'ja' } }),
    (r) => `Patienten ligger nu på ${r.avdelning?.namn ?? ''}, ${r.plats ?? ''}.`);
}

async function permission(vt, kor) {
  const svar = await dialog(`<form>
    <h2 id="dlg-rubrik">Permission</h2>
    <div class="dialog-text"><p>Patienten är fortfarande inskriven under permissionen.</p></div>
    <div class="falt"><label for="pe-till">Åter senast</label><input id="pe-till" name="till" type="date" value="${esc(plusDagar(idag(), 1))}" min="${esc(idag())}" max="${esc(plusDagar(idag(), 14))}"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera permission</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
  </form>`);
  if (!svar) return;
  await kor(() => api(`/api/vardtillfalle/${vt.id}/permission`, { metod: 'POST', data: { till: svar.data.till } }), (r) => `Permission till ${datum(r.permissionTill)} är registrerad.`);
}

async function skrivUt(vt, kor) {
  const k = vt.utskrivningskontroll ?? [];
  const svar = await dialog(`<form>
    <h2 id="dlg-rubrik">Skriv ut patienten</h2>
    <div class="dialog-text"><p>Vårdtillfället på ${esc(vt.avdelning?.namn ?? '')} avslutas nu.</p>
      ${k.length ? `<ul class="kontroll-lista">${k.map(x => `<li>${ikon.info}<span>${esc(x.text)}</span></li>`).join('')}</ul>` : '<p>Systemet har kontrollerat vårdtillfället och hittar inget som behöver göras före utskrivningen.</p>'}</div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skriv ut</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
  </form>`);
  if (!svar) return;
  await kor(() => api(`/api/vardtillfalle/${vt.id}/skriv-ut`, { metod: 'POST', data: {} }), 'Patienten är utskriven.');
}

async function andra(v, kor) {
  const svar = await dialog(`<form>
    <h2 id="dlg-rubrik">Ändra vårdkontakt</h2>
    <div class="dialog-text"><p>${esc(v.orsak)}, ${esc(v.vardenhet?.namn ?? '')}, ${esc(tidpunkt(v.start))}. Ändringen sparas med ditt namn och tiden.</p></div>
    ${v.typ !== 'slutenvard' ? kontaktsattFalt(v.kontaktsatt ?? 'besok') : ''}
    <div class="falt"><label for="vk-orsak">Kontaktorsak</label><input id="vk-orsak" name="orsak" maxlength="200" autocomplete="off" value="${esc(v.orsak)}"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Spara</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
  </form>`, { onOpen: (dl) => kopplaKnappval(dl), validera: (data) => (data.orsak.trim().length < 2 ? 'Ange kontaktorsak.' : null) });
  if (!svar) return;
  const data = { orsak: svar.data.orsak.trim() };
  if (svar.data.kontaktsatt) data.kontaktsatt = svar.data.kontaktsatt;
  await kor(() => api(`/api/vardkontakt/${v.id}`, { metod: 'PATCH', data }), 'Vårdkontakten är ändrad.');
}

// Tidslinjen grupperad per vårdtillfälle och vårdkontakt, eller per hälsoärende. rad ritar en post som i tidslinjen.
export function grupperadTidslinje(d, lage, rad) {
  const s = struktur(d);
  const vk = new Map(d.vardkontakter.map(v => [v.id, v]));
  const grupper = new Map();
  const lagg = (nyckel, rubrik, under, t) => { if (!grupper.has(nyckel)) grupper.set(nyckel, { rubrik, under, poster: [] }); grupper.get(nyckel).poster.push(t); };
  for (const t of d.tidslinje) {
    if (lage === 'arende') {
      const h = t.halsoarendeId ? s.halsoarenden.find(x => x.id === t.halsoarendeId) : null;
      if (h) lagg(`h${h.id}`, `Hälsoärende: ${h.rubrik}`, `Bekräftat ${datum(h.skapad)}${h.skapadAv ? ` av ${h.skapadAv.namn}` : ''}`, t);
      else lagg('utan', 'Utan hälsoärende', '', t);
      continue;
    }
    const vt = t.vardtillfalleId ? s.vardtillfallen.find(x => x.id === t.vardtillfalleId) : null;
    if (vt) {
      lagg(`vt${vt.id}`, `Vårdtillfälle: ${vt.orsak ?? ''}`, `${datum(vt.inskriven)}${vt.utskriven ? ` till ${datum(vt.utskriven)}` : ', pågår'}`, t);
    } else if (t.vardkontaktId && vk.has(t.vardkontaktId)) {
      const v = vk.get(t.vardkontaktId);
      lagg(`vk${v.id}`, `${v.kontaktsatt ? KONTAKTSATT[v.kontaktsatt] : VARDFORM[v.typ]}: ${v.orsak}`, `${datum(v.ankomst ?? v.start)}, ${v.vardenhet?.namn ?? ''}`, t);
    } else lagg('ovrigt', 'Vårdkontakter vid andra vårdenheter', 'Uppgifterna visas, men kontakten hör till en vårdenhet vars uppgifter du ser först efter ett aktivt val.', t);
  }
  if (!grupper.size) return '<p class="tom liten">Inget att visa.</p>';
  return [...grupper.values()].map(g => `<section class="tl-grupp"><h3>${esc(g.rubrik)}</h3>${g.under ? `<p class="under-text">${esc(g.under)}</p>` : ''}
    <ol class="tidslinje">${g.poster.map(rad).join('')}</ol></section>`).join('');
}
