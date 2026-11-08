// Väntrummet på akuten. Uppropning sker alltid med könummer, aldrig med namn.
// Runda 10, r5: flödestavlan för akutmottagningens personal (Sussa 3.2.3.5): ankomst, triage, aktiviteter, bedömning,
// beslut och utregistrering, förvarningar från ambulansen (simulerad) och ledtiderna. Allt räknas och prövas i servern.
import { esc, api, klockslag, ikon, vyRubrik, tom, PRIORITET_VANTRUM, dialog, notis, felNotis, medKnapp } from '../ui.js';
import { S } from '../app.js';
import { listCell } from '../uppmarksamhet.js';

export const namn = 'vantrum';

let urval = { prioritet: '', steg: '' };

export async function visa(main) {
  main.innerHTML = vyRubrik('Väntrum på akuten', 'Akutmottagningen USÖ. Patienterna ropas upp med könummer.') + '<div id="akut-tavla"></div><div id="vr"><p class="tom">Hämtar väntrummet.</p></div>';
  const rader = await api('/api/vantrum');
  const akut = rader.some(r => 'patientId' in r) || S.session.enhet.vardenhet?.id === 'uso-akut';
  const ordning = { rod: 0, orange: 1, gul: 2, gron: 3, bla: 4 };
  const sorterade = [...rader].sort((a, b) => (ordning[a.prioritet] ?? 9) - (ordning[b.prioritet] ?? 9) || a.ankomst.localeCompare(b.ankomst));
  main.querySelector('#vr').innerHTML = `<div class="vantrum-delad">
    <div>
      ${rader.length ? `<div class="tabellrulle"><table class="tabell vantrum-tabell">
        <caption class="sr">Väntande patienter, högst prioritet först</caption>
        <thead><tr><th scope="col">Könummer</th><th scope="col">Prioritet</th><th scope="col">Ankomst</th><th scope="col">Väntat</th><th scope="col">Uppropning</th>${akut ? '<th scope="col"><span class="sr">Uppmärksamhetsinformation</span><span aria-hidden="true" title="Uppmärksamhetsinformation">Upm.</span></th><th scope="col">Patient</th><th scope="col">Orsak</th>' : ''}</tr></thead>
        <tbody>${sorterade.map(r => `<tr>
          <th scope="row" class="konummer">${esc(r.konummer)}</th>
          <td><span class="triage triage-${esc(r.prioritet)}"><span class="triage-ruta" aria-hidden="true"></span>${esc(PRIORITET_VANTRUM[r.prioritet] ?? r.prioritet)}</span></td>
          <td>${esc(klockslag(r.ankomst))}</td>
          <td>${esc(r.vantetidMin)} min</td>
          <td><span class="uppropning">"${esc(r.uppropning)}"</span></td>
          ${akut ? `<td class="um-cell">${r.uppmarksamhet ? listCell(r.uppmarksamhet, `#/patient/${encodeURIComponent(r.patientId)}`) : ''}</td><td>${r.skyddad ? `<span class="skyddad-namn">${ikon.skold}<span>Namn visas inte, skyddad identitet</span></span>` : `<a href="#/patient/${encodeURIComponent(r.patientId)}">${esc(r.namn)}</a>`}</td><td>${esc(r.orsak ?? '')}</td>` : ''}
        </tr>`).join('')}</tbody></table></div>` : tom('Ingen väntar just nu.')}
      ${akut ? '' : '<p class="dampad liten">Du arbetar inte på akutmottagningen och ser därför bara könummer, ankomst och prioritet.</p>'}
    </div>
    <aside class="ruta ruta-forklaring" aria-labelledby="vr-varfor">
      <h2 id="vr-varfor">Varför bara könummer</h2>
      <p>När Region Örebro län gick över till ett nytt journalsystem hösten 2024 röjdes fem personer med skyddade personuppgifter mellan september och november, bland annat genom att de ropades upp med sitt riktiga namn i väntrummet. Det visade SVT Örebro i januari 2025.</p>
      <p>I Vårdkällan kan det inte hända genom uppropningen: väntrumsvyn och uppropningen har bara könummer för alla patienter. Namnet på en patient med skyddad identitet skickas aldrig från servern till väntrummet, inte ens till akutens personal.</p>
    </aside>
  </div>`;
  if (akut) await tavla(main.querySelector('#akut-tavla'), () => visa(main));
}

// ---- Runda 10, r5: flödestavlan --------------------------------------------------------------------------------
const STEGKLASS = { vantar_triage: 'tagg-larm', vantar_lakare: '', vantar_aktivitet: '', bedomd: '', beslut: '' };
async function tavla(plats, ladda) {
  const q = new URLSearchParams(Object.entries(urval).filter(([, v]) => v));
  const [d, l] = await Promise.all([api(`/api/akut${q.size ? `?${q}` : ''}`), api('/api/akut/ledtider').catch(() => null)]);
  if (!d.full) { plats.innerHTML = ''; return; }
  const lakare = S.session.personal.yrke === 'lakare';
  const rad = (r) => `<tr data-besok="${r.id}">
    <th scope="row" class="konummer">${esc(r.konummer)}</th>
    <td><span class="triage triage-${esc(r.prioritet ?? 'ej_triagerad')}"><span class="triage-ruta" aria-hidden="true"></span>${esc(r.prioritetText)}</span>${r.triage?.varfor ? `<details class="liten"><summary>Varför</summary><ul class="enkel-lista">${r.triage.varfor.map(v => `<li>${esc(v)}</li>`).join('')}</ul></details>` : ''}</td>
    <td>${r.skyddad ? `<span class="skyddad-namn">${ikon.skold}<span>Skyddad identitet</span></span>` : `<a href="#/patient/${encodeURIComponent(r.patientId)}">${esc(r.namn)}</a>`}<span class="under-text">${esc(r.kontaktorsak)}${r.ankomstsatt === 'ambulans' ? ', med ambulans' : ''}</span>
      ${r.prehospital ? `<span class="under-text">Ambulansens förslag: ${esc(PRIORITET_VANTRUM[r.prehospital.forslagPrioritet] ?? '')}</span>` : ''}</td>
    <td><span class="tagg ${STEGKLASS[r.steg] ?? ''}">${esc(r.stegText)}</span>
      ${r.aktiviteter.length ? `<ul class="enkel-lista liten">${r.aktiviteter.map(a => `<li>${esc(a.text)}: ${a.utford ? `utförd ${esc(klockslag(a.utford))} av ${esc(a.utfordAv?.namn ?? '')}` : `planerad ${esc(klockslag(a.planerad))} av ${esc(a.planeradAv?.namn ?? '')} <button type="button" class="knapp-lank" data-ak-utford="${a.id}" data-besok="${r.id}">Utförd</button>`}</li>`).join('')}</ul>` : ''}</td>
    <td>${esc(klockslag(r.ankomst))}<span class="under-text">Väntat ${esc(r.ledtider.vantatMin)} min${r.ledtider.tillTriageMin != null ? `, triage efter ${esc(r.ledtider.tillTriageMin)} min` : ''}${r.ledtider.tillLakareMin != null ? `, läkare efter ${esc(r.ledtider.tillLakareMin)} min` : ''}</span></td>
    <td class="atgarder"><div class="knapprad">
      ${r.steg === 'vantar_triage' ? `<button type="button" class="knapp liten" data-ak="triage" data-besok="${r.id}" data-orsak="${esc(r.kontaktorsak)}">Triage</button>` : ''}
      ${lakare && !r.bedomd && r.steg !== 'vantar_triage' ? `<button type="button" class="knapp liten" data-ak="bedomning" data-besok="${r.id}">Läkarbedömning</button>` : ''}
      ${r.steg !== 'vantar_triage' ? `<button type="button" class="knapp liten sekundar" data-ak="aktivitet" data-besok="${r.id}">Planera aktivitet</button>` : ''}
      ${lakare && r.bedomd ? `<button type="button" class="knapp liten sekundar" data-ak="ut" data-besok="${r.id}">Skriv ut eller lägg in</button>` : ''}
    </div></td></tr>`;
  plats.innerHTML = `<section class="ruta akut-tavla" aria-labelledby="ak-rubrik">
    <div class="sektion-huvud"><h2 id="ak-rubrik">Flödestavla</h2>
      <div class="knapprad"><button type="button" class="knapp liten" data-ak="ankomst">Ny ankomst</button><button type="button" class="knapp liten sekundar" data-ak="forvarning">Simulera förvarning från ambulansen</button></div></div>
    <div class="falt-rad">
      <div class="falt"><label for="ak-prio">Prioritet</label><select id="ak-prio" data-ak-urval="prioritet"><option value="">Alla</option>${Object.entries(d.prioriteter).map(([k, t]) => `<option value="${k}"${urval.prioritet === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="falt"><label for="ak-steg">Steg</label><select id="ak-steg" data-ak-urval="steg"><option value="">Alla</option>${d.steg.map(s => `<option value="${s.id}"${urval.steg === s.id ? ' selected' : ''}>${esc(s.text)}</option>`).join('')}</select></div>
    </div>
    ${d.forvarningar.length ? `<h3>Förvarningar från ambulansen</h3><ul class="enkel-lista">${d.forvarningar.map(f => `<li><strong>${esc(f.kontaktorsak)}</strong>, beräknad ankomst ${esc(klockslag(f.beraknad))}. ${f.namn ? esc(f.namn) : f.skyddad ? 'Skyddad identitet' : 'Patienten är inte identifierad'}. Förslag: ${esc(PRIORITET_VANTRUM[f.forslagPrioritet] ?? '')}.
      ${f.patientId ? `<button type="button" class="knapp liten" data-ak-ta-emot="${f.id}">Patienten har kommit</button>` : ''}</li>`).join('')}</ul>` : ''}
    ${d.tavla.length ? `<div class="tabellrulle"><table class="tabell akut-tabell"><caption class="sr">Patienter på akutmottagningen, högst prioritet först</caption>
      <thead><tr><th scope="col">Könummer</th><th scope="col">Prioritet</th><th scope="col">Patient</th><th scope="col">Steg och aktiviteter</th><th scope="col">Ankomst och ledtider</th><th scope="col"><span class="sr">Åtgärder</span></th></tr></thead>
      <tbody>${d.tavla.map(rad).join('')}</tbody></table></div>` : tom('Inga patienter med de valen.')}
    ${l ? `<details><summary>Ledtider de senaste ${esc(l.dagar)} dagarna</summary><p class="liten">${esc(l.text)}</p><ul class="enkel-lista">${l.perPrioritet.map(x => `<li>${esc(x.prioritetText)}: ${x.visas ? `${esc(x.antal)} besök, median ${esc(x.medianTillTriageMin)} min till triage, ${esc(x.medianTillLakareMin ?? '')} min till läkare och ${esc(x.medianVistelseMin)} min på mottagningen` : 'för få besök för att visa'}</li>`).join('')}</ul></details>` : ''}
    <p class="demoregel">${esc(d.demoregel)} Ambulansen är simulerad.</p>
  </section>`;
  plats.querySelectorAll('[data-ak-urval]').forEach(s => s.addEventListener('change', () => { urval[s.dataset.akUrval] = s.value; tavla(plats, ladda); }));
  plats.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ak], [data-ak-utford], [data-ak-ta-emot]');
    if (!b) return;
    try {
      if (b.dataset.akUtford) { await medKnapp(b, () => api(`/api/akut/${b.dataset.besok}/aktivitet/${b.dataset.akUtford}/utford`, { metod: 'POST', data: {} })); notis('Aktiviteten är utförd.'); return ladda(); }
      if (b.dataset.akTaEmot) { const r = await medKnapp(b, () => api('/api/akut/ankomst', { metod: 'POST', data: { forvarningId: Number(b.dataset.akTaEmot) } })); notis(`Ankomsten är registrerad med nummer ${r.konummer}. Triagera patienten.`); return ladda(); }
      const typ = b.dataset.ak;
      if (typ === 'ankomst') return ankomst(ladda);
      if (typ === 'forvarning') return forvarning(ladda);
      if (typ === 'triage') return triage(b, ladda);
      if (typ === 'bedomning') { await medKnapp(b, () => api(`/api/akut/${b.dataset.besok}/bedomning`, { metod: 'POST', data: {} })); notis('Läkarbedömningen är registrerad.'); return ladda(); }
      if (typ === 'aktivitet') return aktivitet(b, d.aktiviteter, ladda);
      if (typ === 'ut') return utregistrera(b, ladda);
    } catch (x) { felNotis(x); }
  });
}

async function ankomst(ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Ny ankomst</h2>
    <p>Systemet sätter könumret, tiden och akutbesöket. Saknar patienten personnummer, registrera patienten med reservnummer först.</p>
    <div class="falt"><label for="ak-sok">Patient (namn eller personnummer)</label><input id="ak-sok" name="sok" autocomplete="off" required></div>
    <div class="falt"><label for="ak-orsak">Kontaktorsak</label><input id="ak-orsak" name="kontaktorsak" maxlength="200" required></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera ankomsten</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    const traffar = await api(`/api/sok?q=${encodeURIComponent(svar.data.sok.trim())}`);
    if (traffar.length !== 1) { notis(traffar.length ? 'Flera patienter matchar. Skriv hela personnumret.' : 'Ingen patient matchar.', 'fel'); return; }
    const r = await api('/api/akut/ankomst', { metod: 'POST', data: { patientId: traffar[0].id, kontaktorsak: svar.data.kontaktorsak } });
    notis(`Ankomsten är registrerad med nummer ${r.konummer}.`);
    ladda();
  } catch (x) { felNotis(x); }
}

const VITAL = [['andningsfrekvens', 'Andningsfrekvens (andetag/min)'], ['saturation', 'Syremättnad (%)'], ['syrgas', 'Syrgas (L/min, 0 för luft)'], ['systoliskt', 'Systoliskt blodtryck (mmHg)'], ['diastoliskt', 'Diastoliskt blodtryck (mmHg)'], ['puls', 'Puls (slag/min)'], ['temp', 'Temperatur (°C)']];
const vitalFalt = (pre) => `${VITAL.map(([k, t]) => `<div class="falt smal"><label for="${pre}-${k}">${esc(t)}</label><input id="${pre}-${k}" name="${k}" inputmode="decimal"${k === 'syrgas' ? ' value="0"' : ''}></div>`).join('')}
  <div class="falt smal"><label for="${pre}-medv">Medvetandegrad</label><select id="${pre}-medv" name="medvetande"><option value="A">A, vaken</option><option value="C">C, ny förvirring</option><option value="V">V, reagerar på tilltal</option><option value="P">P, reagerar på smärta</option><option value="U">U, reagerar inte</option></select></div>`;
const vitaler = (data) => Object.fromEntries([...VITAL.map(([k]) => [k, data[k] === '' || data[k] == null ? null : Number(String(data[k]).replace(',', '.'))]).filter(([, v]) => v != null && Number.isFinite(v)), ['medvetande', data.medvetande]]);

async function triage(b, ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Triage</h2><p>Systemet räknar prioriteten ur vitalparametrarna och kontaktorsaken och visar varför.</p>
    <div class="falt"><label for="tr-orsak">Kontaktorsak</label><input id="tr-orsak" name="kontaktorsak" value="${esc(b.dataset.orsak)}" maxlength="200"></div>
    <div class="falt-rad">${vitalFalt('tr')}</div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Räkna prioriteten</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, { klass: 'dialog-bred' });
  if (!svar) return;
  try {
    const r = await api(`/api/akut/${b.dataset.besok}/triage`, { metod: 'POST', data: { kontaktorsak: svar.data.kontaktorsak, vitaler: vitaler(svar.data) } });
    notis(`Prioritet ${r.prioritetText.toLowerCase()}. ${r.triage.varfor.join(' ')}`);
    ladda();
  } catch (x) { felNotis(x); }
}

async function aktivitet(b, typer, ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Planera aktivitet</h2>
    <div class="falt"><label for="ak-typ">Aktivitet</label><select id="ak-typ" name="typ">${Object.entries(typer).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Planera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try { await api(`/api/akut/${b.dataset.besok}/aktivitet`, { metod: 'POST', data: { typ: svar.data.typ } }); notis('Aktiviteten är planerad.'); ladda(); } catch (x) { felNotis(x); }
}

async function utregistrera(b, ladda) {
  const avd = await api('/api/avdelningar').catch(() => []);
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Skriv ut eller lägg in</h2>
    <fieldset class="falt"><legend>Beslut</legend><label class="kryss"><input type="radio" name="beslut" value="hem" checked> Hem</label><label class="kryss"><input type="radio" name="beslut" value="inlaggning"> Inläggning</label><label class="kryss"><input type="radio" name="beslut" value="annan"> Annan vårdform</label></fieldset>
    <div class="falt"><label for="ak-avd">Avdelning vid inläggning</label><select id="ak-avd" name="enhetId"><option value="">Välj avdelning</option>${(Array.isArray(avd) ? avd : avd.avdelningar ?? []).map(a => `<option value="${esc(a.id)}">${esc(a.namn)}</option>`).join('')}</select></div>
    <p class="liten">Vid inläggning skriver systemet in patienten från akutbesöket.</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
  if (!svar) return;
  try {
    const r = await api(`/api/akut/${b.dataset.besok}/utregistrera`, { metod: 'POST', data: { beslut: svar.data.beslut, ...(svar.data.enhetId ? { enhetId: svar.data.enhetId } : {}) } });
    notis(r.vardtillfalle ? `Patienten är inskriven på ${r.vardtillfalle.enhet?.namn ?? 'avdelningen'}.` : 'Besöket är utregistrerat.');
    ladda();
  } catch (x) { felNotis(x); }
}

async function forvarning(ladda) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Simulera förvarning från ambulansen</h2>
    <p>I demon skickar den simulerade ambulansen förvarningen härifrån. Ambulansen är avsändaren, och förvarningen ger ingen åtkomst till journalen.</p>
    <div class="falt"><label for="fv-pnr">Personnummer</label><input id="fv-pnr" name="personnummer" inputmode="numeric" maxlength="13"></div>
    <div class="falt"><label for="fv-orsak">Kontaktorsak</label><input id="fv-orsak" name="kontaktorsak" maxlength="200" required></div>
    <div class="falt smal"><label for="fv-min">Minuter till ankomst</label><input id="fv-min" name="minuter" inputmode="numeric" value="10"></div>
    <div class="falt-rad">${vitalFalt('fv')}</div>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Skicka förvarningen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, { klass: 'dialog-bred' });
  if (!svar) return;
  try {
    const r = await api('/api/demo/ambulans/forvarning', { metod: 'POST', data: { personnummer: svar.data.personnummer, kontaktorsak: svar.data.kontaktorsak, minuter: Number(svar.data.minuter), vitaler: vitaler(svar.data) } });
    notis(`Förvarningen är mottagen. Ambulansens vitalparametrar ger förslaget ${PRIORITET_VANTRUM[r.forslagPrioritet]?.toLowerCase() ?? ''}.`);
    ladda();
  } catch (x) { felNotis(x); }
}

