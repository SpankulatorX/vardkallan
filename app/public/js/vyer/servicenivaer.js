// Servicenivåer och incidenter (runda 14, r5, Sussa KD1.2.1.1 till KD1.2.1.4, KD1.3.2.2, KD1.3.2.3 och 5.3.1.14).
// Systemförvaltaren registrerar en incident genom att svara på två frågor, och systemet sätter prioriteten enligt
// servicenivåavtalet, säger när beställaren ska ha rapporten och när processen för en större incident ska startas, och
// räknar månadsrapporten ur registret och systemets egna mått. Processerna står i docs/drift/.
import { esc, api, tidpunkt, notis, medKnapp, dialog, vyRubrik, ikon, tal } from '../ui.js';

export const namn = 'servicenivaer';

const prioText = (i) => `Prioritet ${i.prioritet} (${i.prioritetNamn})`;
const PRIOKLASS = { 1: 'ruta-larm', 2: 'ruta-larm', 3: 'ruta-info', 4: 'ruta-info' };

function formular(val) {
  const radio = (namnet, lista, forval = null) => Object.entries(lista).map(([k, t]) => `<div class="kryssfalt"><input type="radio" id="sn-${namnet}-${k}" name="${namnet}" value="${k}"${k === forval ? ' checked' : ''}><label for="sn-${namnet}-${k}">${esc(t)}</label></div>`).join('');
  return `<form id="sn-ny" class="inkorg-sektion" aria-labelledby="sn-ny-rubrik" novalidate>
    <h2 id="sn-ny-rubrik">Registrera en incident</h2>
    <div class="falt"><label for="sn-rubrik">Vad har hänt? <span class="obl">(obligatoriskt)</span></label><input id="sn-rubrik" name="rubrik" type="text" maxlength="120" required aria-required="true" aria-describedby="sn-rubrik-h"><span class="hjalp" id="sn-rubrik-h">Till exempel Inloggningen svarar inte. Skriv inga patientuppgifter.</span></div>
    <fieldset class="kryssgrupp" id="sn-omfattning"><legend>Hur många berörs?</legend>${radio('omfattning', val.omfattning)}</fieldset>
    <fieldset class="kryssgrupp" id="sn-paverkan"><legend>Kan vården arbeta?</legend>${radio('paverkan', val.paverkan)}</fieldset>
    <details class="sn-mer"><summary>Annat slag av incident, beskrivning eller starttid</summary>
      <fieldset class="kryssgrupp"><legend>Slag av incident</legend>${radio('kategori', val.kategorier, 'drift')}</fieldset>
      <div class="kryssfalt" id="sn-pu" hidden><input type="checkbox" id="sn-personuppgifter" name="personuppgifter" value="ja"><label for="sn-personuppgifter">Patientuppgifter kan ha röjts, ändrats eller förlorats (personuppgiftsincident)</label></div>
      <div class="falt"><label for="sn-beskrivning">Beskrivning</label><textarea id="sn-beskrivning" name="beskrivning" rows="3" maxlength="1000"></textarea></div>
      <div class="falt"><label for="sn-borjade">Började</label><input id="sn-borjade" name="borjade" type="datetime-local" aria-describedby="sn-borjade-h"><span class="hjalp" id="sn-borjade-h">Tomt betyder nu.</span></div>
    </details>
    <p class="form-fel" role="alert" hidden></p>
    <button type="submit" class="knapp">Registrera incidenten</button>
  </form>`;
}

function incident(i) {
  const u = i.uppfoljning;
  return `<li class="lm-sektion sn-incident" data-incident="${i.id}">
    <h3>${esc(i.rubrik)}</h3>
    <p class="ruta ${PRIOKLASS[i.prioritet]} liten">${i.prioritet <= 2 ? ikon.varning : ikon.info}<span><strong>${esc(prioText(i))}.</strong> ${esc(i.skal)}</span></p>
    <dl class="faktarad">
      <div><dt>Slag</dt><dd>${esc(i.kategoriText)}${i.personuppgifter ? ', personuppgiftsincident' : ''}</dd></div>
      <div><dt>Började</dt><dd>${esc(tidpunkt(i.borjade))}</dd></div>
      <div><dt>${i.pagar ? 'Pågått' : 'Åtgärdstid'}</dt><dd>${esc(i.atgardstid.text)}${i.atgardstid.malMinuter ? ` av högst ${tal(i.atgardstid.malMinuter / 60, 0)} timmar` : ''}${i.atgardstid.inomMal === false ? ' (över gränsvärdet)' : ''}</dd></div>
      <div><dt>Rapportering</dt><dd>${i.rapportering.rapporterad ? `Rapporterad ${esc(tidpunkt(i.rapportering.rapporterad))}${i.rapportering.iTid === false ? ', för sent' : ''}` : esc(i.rapportering.text)}</dd></div>
      ${!i.pagar && u.kravs ? `<div><dt>Uppföljningsmöte</dt><dd>${u.mote ? esc(u.mote) : 'Inte hållet'}</dd></div>` : ''}
    </dl>
    ${i.nasta ? `<p class="ruta ${i.major.aktiv || i.rapportering.iTid === false ? 'ruta-larm' : 'ruta-info'} liten" data-nasta>${i.major.aktiv ? ikon.varning : ikon.info}<span>${esc(i.nasta)}</span></p>` : ''}
    ${!i.pagar && u.orsak ? `<details><summary>Underlag till uppföljningen</summary><dl class="sn-underlag"><dt>Orsak</dt><dd>${esc(u.orsak)}</dd><dt>Konsekvens</dt><dd>${esc(u.konsekvens)}</dd><dt>Åtgärd</dt><dd>${esc(u.atgard)}</dd><dt>Så hindras det att hända igen</dt><dd>${esc(u.forebyggande)}</dd></dl></details>` : ''}
    <div class="knapprad">
      ${i.pagar ? `<button type="button" class="knapp sekundar" data-avsluta="${i.id}">Avsluta incidenten</button>` : ''}
      ${!i.pagar && u.kravs && !u.mote ? `<button type="button" class="knapp sekundar" data-mote="${i.id}">Uppföljningsmötet är hållet i dag</button>` : ''}
    </div>
  </li>`;
}

function rapport(r) {
  const prio = r.prioriteter.map(p => `<tr><th scope="row">${p.prioritet} ${esc(p.namn)}</th><td class="tal">${p.antal}</td><td class="tal">${p.overskridna}</td><td>${p.malTimmar ? `${p.malTimmar} timmar` : 'Enligt överenskommelse'}</td>
    <td>${p.aretHittills.antal}${p.aretHittills.maxAntal !== null ? ` av högst ${p.aretHittills.maxAntal}` : ''}, ${esc(p.aretHittills.text)}${p.aretHittills.maxTimmar !== null ? ` av högst ${p.aretHittills.maxTimmar} timmar` : ''}</td></tr>`).join('');
  return `<section class="lm-sektion" aria-labelledby="sn-rapport-rubrik" id="sn-rapport">
    <h2 id="sn-rapport-rubrik">Månadsrapport för ${esc(r.manad)}${r.pagar ? ', hittills' : ''}</h2>
    <div class="knapprad"><button type="button" class="knapp text" data-manad="${esc(r.forra)}">Förra månaden</button>${r.nasta ? `<button type="button" class="knapp text" data-manad="${esc(r.nasta)}">Nästa månad</button>` : ''}</div>
    <p class="ruta ${r.avvikelser.length ? 'ruta-larm' : 'ruta-ok'}" data-sammanfattning>${r.avvikelser.length ? ikon.varning : ikon.bock}<span>${esc(r.sammanfattning)}</span></p>
    ${r.avvikelser.length ? `<ul class="liten">${r.avvikelser.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    <dl class="faktarad">
      <div><dt>Tillgänglighet</dt><dd>${tal(r.tillganglighet.utfall, 3)} procent, avbrott ${esc(r.tillganglighet.avbrott)}</dd></div>
      <div><dt>Rapporter till beställaren</dt><dd>${r.rapportering.iTid} i tid, ${r.rapportering.sena} för sent, ${r.rapportering.vantar} väntar</dd></div>
      <div><dt>Svarstider</dt><dd>${r.svarstider.overMal} av ${r.svarstider.adresser} adresser över målet ${r.svarstider.malP95Ms} ms</dd></div>
      ${r.sakerhetskopior ? `<div><dt>Säkerhetskopior</dt><dd>${r.sakerhetskopior.verifierade} verifierade av ${r.sakerhetskopior.antal} under månaden${r.sakerhetskopior.senasteVerifierade ? `, senast ${esc(tidpunkt(r.sakerhetskopior.senasteVerifierade))}` : ''}</dd></div>` : ''}
      <div><dt>Säkerhetsloggen</dt><dd>${r.sakerhetslogg.handelser.reduce((s, h) => s + h.antal, 0)} händelser, kedjan ${r.sakerhetslogg.kedjanHel ? 'håller' : 'håller inte'}</dd></div>
    </dl>
    <p class="liten">${esc(r.tillganglighet.text)}</p>
    <div class="tabellrulle"><table class="tabell siffertabell"><caption class="sr">Incidenter per prioritet</caption>
      <thead><tr><th scope="col">Prioritet</th><th scope="col" class="tal">Under månaden</th><th scope="col" class="tal">Över gränsvärdet</th><th scope="col">Högsta åtgärdstid</th><th scope="col">Året hittills</th></tr></thead>
      <tbody>${prio}</tbody></table></div>
    <p class="liten">${esc(r.svarstider.text)} ${esc(r.kalla)}</p>
  </section>`;
}

export async function visa(main, { manad = null } = {}) {
  main.innerHTML = vyRubrik('Servicenivåer och incidenter', 'Systemet sätter prioriteten enligt servicenivåavtalet, räknar åtgärdstiden och säger när beställaren ska ha rapporten.') + '<div id="sn"><p class="tom">Hämtar.</p></div>';
  const [l, r] = await Promise.all([api('/api/servicenivaer/incidenter'), api(`/api/servicenivaer/rapport${manad ? `?manad=${encodeURIComponent(manad)}` : ''}`)]);
  const el = main.querySelector('#sn');
  if (!el) return;
  el.innerHTML = `${formular(l.val)}
    <section class="inkorg-sektion" aria-labelledby="sn-lista-rubrik"><h2 id="sn-lista-rubrik">Incidenter${l.pagar ? `, ${l.pagar} pågår` : ''}</h2>
      ${l.incidenter.length ? `<ul class="sn-lista" id="sn-lista">${l.incidenter.slice(0, 20).map(incident).join('')}</ul>` : '<p class="tom" id="sn-lista">Inga incidenter är registrerade i den här sandlådan.</p>'}
    </section>
    ${rapport(r)}
    <section class="lm-sektion" aria-labelledby="sn-export-rubrik"><h2 id="sn-export-rubrik">Incidentrapport till beställaren</h2>
      <p>Rapporten har incidenterna de senaste 30 dagarna med prioritet, tider och underlaget till uppföljningen, och säkerhetsloggens händelser räknade per typ. Den har inga patientuppgifter. Incidenterna markeras som rapporterade, och uttaget skrivs i säkerhetsloggen.</p>
      <button type="button" class="knapp sekundar" data-export>Hämta incidentrapporten</button>
      <p class="demoregel">Simulerat: i demon hämtas rapporten som en fil. I driften skickas den till beställaren på det sätt som beställaren anvisar, och tidsgränserna är ett förslag tills beställaren har gett sin anvisning.</p>
    </section>`;
  const form = el.querySelector('#sn-ny');
  const uppdatera = () => {
    const kat = form.querySelector('[name="kategori"]:checked')?.value ?? 'drift';
    const omf = form.querySelector('[name="omfattning"]:checked')?.value;
    el.querySelector('#sn-pu').hidden = kat !== 'sakerhet';
    el.querySelector('#sn-omfattning').hidden = kat === 'redundans';
    el.querySelector('#sn-paverkan').hidden = kat === 'redundans' || omf === 'ingen';
  };
  form.addEventListener('change', uppdatera);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const kat = d.get('kategori') ?? 'drift';
    const data = { rubrik: d.get('rubrik') ?? '', kategori: kat, omfattning: d.get('omfattning') ?? undefined, paverkan: d.get('paverkan') ?? undefined,
      beskrivning: d.get('beskrivning') ?? '', personuppgifter: kat === 'sakerhet' && d.get('personuppgifter') === 'ja' };
    const b = d.get('borjade');
    if (b) data.borjade = new Date(b).toISOString();
    try {
      const i = await medKnapp(form.querySelector('[type="submit"]'), () => api('/api/servicenivaer/incidenter', { metod: 'POST', data }), form);
      notis(`Incidenten är registrerad med ${prioText(i).toLowerCase()}.${i.nasta ? ` ${i.nasta}` : ''}`, i.prioritet <= 2 ? 'info' : 'ok', { kvar: i.prioritet <= 2 });
      visa(main, { manad });
    } catch { /* felet visas vid formuläret */ }
  });
  el.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-manad]');
    if (m) return visa(main, { manad: m.dataset.manad });
    const a = e.target.closest('[data-avsluta]');
    if (a) {
      const i = l.incidenter.find(x => String(x.id) === a.dataset.avsluta);
      const krav = i.uppfoljning.kravs;
      const f = (n, t) => `<div class="falt"><label for="sn-a-${n}">${esc(t)}${krav ? ' <span class="obl">(obligatoriskt)</span>' : ''}</label><textarea id="sn-a-${n}" name="${n}" rows="2" maxlength="1000"${krav ? ' required aria-required="true"' : ''}></textarea></div>`;
      const svar = await dialog(`<h2 id="dlg-rubrik">Avsluta incidenten</h2><form class="dialog-text">
        <p>${krav ? `${esc(prioText(i))} avslutas med underlaget till incidentuppföljningsmötet med beställaren.` : 'Skriv gärna orsaken och åtgärden.'} Skriv inga patientuppgifter.</p>
        ${f('orsak', 'Orsak')}${krav ? f('konsekvens', 'Konsekvens') : ''}${f('atgard', 'Åtgärd')}${krav ? f('forebyggande', 'Så hindras det att hända igen') : ''}
        <p class="dialog-fel form-fel" role="alert" hidden></p></form>
        <div class="knapprad"><button type="button" class="knapp text" data-varde="avbryt">Avbryt</button><button type="button" class="knapp" data-varde="ok">Avsluta</button></div>`);
      if (!svar) return;
      try { await medKnapp(a, () => api(`/api/servicenivaer/incidenter/${i.id}/avsluta`, { metod: 'POST', data: svar.data })); notis('Incidenten är avslutad.'); } catch { /* notis visad */ }
      return visa(main, { manad });
    }
    const mt = e.target.closest('[data-mote]');
    if (mt) {
      try { await medKnapp(mt, () => api(`/api/servicenivaer/incidenter/${mt.dataset.mote}/uppfoljning`, { metod: 'POST', data: {} })); notis('Uppföljningsmötet är registrerat.'); } catch { /* notis visad */ }
      return visa(main, { manad });
    }
    const x = e.target.closest('[data-export]');
    if (x) {
      try {
        const ut = await medKnapp(x, () => api('/api/servicenivaer/export', { metod: 'POST', data: {} }));
        const lank = document.createElement('a');
        lank.href = URL.createObjectURL(new Blob([`${JSON.stringify(ut.rapport, null, 2)}\n`], { type: 'application/json' }));
        lank.download = ut.fil;
        document.body.append(lank);
        lank.click();
        lank.remove();
        notis(`Incidentrapporten är hämtad${ut.nyRapporterade ? ` och ${ut.nyRapporterade} ${ut.nyRapporterade === 1 ? 'incident är markerad' : 'incidenter är markerade'} som rapporterade` : ''}.`);
      } catch { /* notis visad */ }
      return visa(main, { manad });
    }
  });
}
