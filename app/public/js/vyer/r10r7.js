// Runda 10, r7: vyerna för meddelanden från invånare, invånarnas begäranden, kassan, vårdenhetens kapacitet och
// kontorsstödet, och den simulerade mötessidan för ett videobesök. Servern prövar behörigheten i varje anrop.
import { esc, api, vyRubrik, tom, notis, felNotis, medKnapp, dialog, tidpunkt, datum, klockslag } from '../ui.js';

const kr = (n) => `${Number(n).toLocaleString('sv-SE')} kr`;
const fel = (err) => { if (err?.status !== 400) felNotis(err); };

// --- Meddelanden från invånare -------------------------------------------------------------------------------------
async function visaMeddelanden(main, [id]) {
  main.innerHTML = vyRubrik('Meddelanden', 'Meddelanden från patienter, vårdnadshavare och ombud till vårdenheten. Systemet har skickat varje meddelande till den yrkesroll som ska läsa det.')
    + '<div id="md-lista"><p class="tom">Hämtar.</p></div><div id="md-trad"></div>';
  const l = await api('/api/meddelanden');
  const rad = (t) => `<tr${String(t.id) === id ? ' aria-current="true"' : ''}><th scope="row"><a href="#/meddelanden/${t.id}" data-md-trad="${t.id}">${esc(t.patient.namn)}</a><span class="under-text">${esc(t.patient.personnummer)}</span></th>
    <td>${esc(t.typText)}</td><td>${esc(t.yrkesrollText)}${t.tillDig ? ' <span class="tagg tagg-pagaende">Till dig</span>' : ''}</td><td>${esc(t.statusText)}</td><td>${esc(tidpunkt(t.senast))}</td></tr>`;
  main.querySelector('#md-lista').innerHTML = l.tradar.length ? `<div class="tabellrulle"><table class="tabell" id="md-tabell"><caption class="sr">Meddelanden till vårdenheten</caption>
    <thead><tr><th scope="col">Patient</th><th scope="col">Det gäller</th><th scope="col">Till</th><th scope="col">Status</th><th scope="col">Senast</th></tr></thead>
    <tbody>${l.tradar.map(rad).join('')}</tbody></table></div><p class="hjalp">${esc(l.demoregler)}</p>` : tom('Inga meddelanden till vårdenheten.');
  if (id) await visaTrad(main, id);
}

async function visaTrad(main, id) {
  const el = main.querySelector('#md-trad');
  const t = await api(`/api/meddelanden/${encodeURIComponent(id)}`);
  const knappar = t.kanAvsluta ? (t.utfallVal.length > 1
    ? t.utfallVal.map((u, i) => `<button type="button" class="knapp${i ? ' sekundar' : ''}" data-md-utfall="${esc(u.id)}">${esc(u.text)}</button>`).join('')
    : '<button type="button" class="knapp" data-md="svara-avsluta">Svara och avsluta</button>') : '';
  el.innerHTML = `<section class="ov-sektion" aria-labelledby="md-rubrik">
    <div class="sektion-huvud"><h2 id="md-rubrik" tabindex="-1">${esc(t.typText)}${t.galler ? `: ${esc(t.galler)}` : ''}</h2><span class="tagg">${esc(t.statusText)}</span></div>
    <p class="under-text">Skrivet av ${esc(t.skrivetAv ?? '')}, till ${esc(t.yrkesrollText)} på ${esc(t.vardenhet ?? '')}.</p>
    <ol class="meddelanden">${t.meddelanden.map(m => `<li class="meddelande meddelande-${esc(m.fran)}"><p class="under-text">${esc(m.vem ?? '')}, ${esc(tidpunkt(m.tid))}</p><p class="kallelse-text">${esc(m.text)}</p>${m.avisering ? `<p class="hjalp">${esc(m.avisering)}</p>` : ''}</li>`).join('')}</ol>
    ${t.avgift ? `<p class="hjalp">Avgift: ${esc(kr(t.avgift.belopp))}. ${esc(t.avgift.text)}</p>` : ''}
    ${t.forslag ? `<p class="ruta ruta-info liten">${esc(t.forslag)}</p>` : ''}
    ${t.varforInte ? `<p class="ruta ruta-info liten">${esc(t.varforInte)}</p>` : ''}
    ${t.kanSvara ? `<form id="md-svar" novalidate><div class="falt"><label for="md-text">Svar till patienten</label><textarea id="md-text" name="text" rows="3" maxlength="2000"></textarea></div>
      <p class="form-fel" hidden></p><div class="knapprad">${knappar}<button type="button" class="knapp sekundar" data-md="svara">Skicka svar</button></div></form>` : ''}
  </section>`;
  const form = el.querySelector('#md-svar');
  form?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-md], [data-md-utfall]');
    if (!b) return;
    const text = form.text.value.trim();
    try {
      if (b.dataset.md === 'svara') {
        await medKnapp(b, () => api(`/api/meddelanden/${t.id}/svar`, { metod: 'POST', data: { text } }), form);
        notis('Svaret är skickat. Patienten får ett meddelande om det.');
      } else if (b.dataset.md === 'svara-avsluta') {
        if (text) await medKnapp(b, () => api(`/api/meddelanden/${t.id}/svar`, { metod: 'POST', data: { text } }), form);
        await medKnapp(b, () => api(`/api/meddelanden/${t.id}/avsluta`, { metod: 'POST', data: {} }), form);
        notis('Svaret är skickat och ärendet avslutat.');
      } else {
        const r = await medKnapp(b, () => api(`/api/meddelanden/${t.id}/avsluta`, { metod: 'POST', data: { utfall: b.dataset.mdUtfall, text } }), form);
        notis(r.utfall === 'fornyat' ? 'Receptet är förnyat. Systemet har skapat avgiften och skrivit till patienten.' : r.utfall === 'utfardat' ? 'Intyget är utfärdat. Systemet har skapat avgiften och skrivit till patienten.' : 'Ärendet är avslutat.');
      }
      await visaMeddelanden(main, [String(t.id)]);
    } catch (err) { fel(err); }
  });
}

// --- Invånarnas begäranden ----------------------------------------------------------------------------------------
async function visaBegaran(main) {
  main.innerHTML = vyRubrik('Begäranden', 'Invånarnas begäranden i Min journal om spärr, om att häva en spärr och om loggutdrag. Patienten bestämmer själv om spärren, och systemet utför begäran med ett klick.') + '<div id="bg-lista"><p class="tom">Hämtar.</p></div>';
  const l = await api('/api/begaran');
  const el = main.querySelector('#bg-lista');
  el.innerHTML = l.begaran.length ? `<ul class="enkel-lista">${l.begaran.map(b => `<li class="ov-sektion"><p><strong>${esc(b.typText)}</strong>${b.vardenhet ? `, ${esc(b.vardenhet)}` : ''}. ${esc(b.patient.namn)} <span class="under-text">${esc(b.patient.personnummer)}, ${esc(tidpunkt(b.skapad))}</span></p>
    ${b.meddelande ? `<p class="kallelse-text">${esc(b.meddelande)}</p>` : ''}<p class="hjalp">${esc(b.forklaring)}</p>
    <div class="knapprad"><button type="button" class="knapp" data-bg="${b.id}">${esc(b.atgard)}</button></div></li>`).join('')}</ul>` : tom('Inga begäranden väntar.');
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-bg]');
    if (!b) return;
    try {
      const r = await medKnapp(b, () => api(`/api/begaran/${b.dataset.bg}/handlagg`, { metod: 'POST', data: {} }));
      notis(r.besked);
      await visaBegaran(main);
    } catch (err) { felNotis(err); }
  });
}

// --- Kassan -------------------------------------------------------------------------------------------------------
const summaHtml = (s) => `Kort ${esc(kr(s.kort))}, faktura ${esc(kr(s.faktura))}${s.aterbetalt ? `, återbetalt ${esc(kr(s.aterbetalt))}` : ''}. Netto ${esc(kr(s.netto))}.`;
async function visaKassa(main) {
  main.innerHTML = vyRubrik('Kassa', 'Betalningar och återbetalningar på vårdenheten i dag, per kassör och betalsätt. Betalterminalen är simulerad.') + '<div id="kassa"><p class="tom">Hämtar.</p></div>';
  const k = await api('/api/kassa');
  const el = main.querySelector('#kassa');
  const jag = k.kassorer.find(x => x.du);
  el.innerHTML = `<form class="ov-sektion" id="kassa-ny" novalidate aria-labelledby="kassa-ny-rubrik">
      <div class="sektion-huvud"><h2 id="kassa-ny-rubrik">Ta betalt för recept eller intyg</h2></div>
      <div class="falt-rad"><div class="falt"><label for="kassa-pnr">Patientens personnummer</label><input id="kassa-pnr" name="personnummer" autocomplete="off" maxlength="40"></div>
      <div class="falt"><label for="kassa-tjanst">Tjänst</label><select id="kassa-tjanst" name="tjanst">${k.tjanster.map(t => `<option value="${esc(t.id)}">${esc(t.text)}</option>`).join('')}</select></div></div>
      <p class="form-fel" hidden></p><div class="knapprad"><button type="submit" class="knapp">Registrera avgift</button></div><div id="kassa-avgift"></div>
    </form>
    <section class="ov-sektion" id="kassa-dagens" aria-labelledby="kassa-dagens-rubrik"><div class="sektion-huvud"><h2 id="kassa-dagens-rubrik">Dagens kassa ${esc(k.datum)}</h2></div>
      <p>${esc(k.vardenhet.namn)}. ${summaHtml(k.summa)}</p>
      ${k.kassorer.length ? k.kassorer.map(x => `<h3>${esc(x.namn)}</h3><p>${summaHtml(x.summa)}</p>${x.forklaring ? `<p class="hjalp">${esc(x.forklaring)}</p>` : ''}
        <div class="tabellrulle"><table class="tabell"><caption class="sr">Betalningar för ${esc(x.namn)}</caption><thead><tr><th scope="col">Tid</th><th scope="col">Kvitto</th><th scope="col">Slag</th><th scope="col">Betalsätt</th><th scope="col" class="tal">Belopp</th><th scope="col">Avslutad</th><th scope="col"><span class="sr">Åtgärd</span></th></tr></thead>
        <tbody>${x.rader.map(r => `<tr><td>${esc(klockslag(r.tid))}</td><th scope="row">${esc(r.kvitto)}</th><td>${esc(r.slag)}</td><td>${esc(r.sattText)}</td><td class="tal">${esc(kr(r.belopp))}</td><td>${r.avslutad ? 'Ja' : 'Nej'}</td>
          <td>${r.kanAterbetalas ? `<button type="button" class="knapp text liten" data-ater="${esc(r.kalla)}:${r.id}" data-belopp="${r.belopp}">Återbetala</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`).join('') : tom('Inga betalningar i dag.')}
      <div class="knapprad">${jag?.kanAvsluta ? '<button type="button" class="knapp" id="kassa-avslut">Gör dagsavslut</button>' : ''}<a class="knapp sekundar" href="/api/kassa/rapport.docx" download>Kassaredovisning som Word-dokument</a></div>
      <div id="kassa-avslut-form"></div>
    </section>
    <section class="ov-sektion" aria-labelledby="kassa-avslut-rubrik"><div class="sektion-huvud"><h2 id="kassa-avslut-rubrik">Dagsavslut i dag</h2></div>
      ${k.avslut.length ? `<ul class="enkel-lista">${k.avslut.map(a => `<li>${esc(klockslag(a.tid))}, ${esc(a.kassor.namn ?? '')}: ${a.antal} rader, kort ${esc(kr(a.summor.kort))}, faktura ${esc(kr(a.summor.faktura))}. ${esc(a.text)}${a.forklaring ? ` ${esc(a.forklaring)}` : ''}</li>`).join('')}</ul>` : tom('Inget dagsavslut ännu.')}
    </section>
    <p class="hjalp">${esc(k.demoregler)}</p>`;
  const ny = el.querySelector('#kassa-ny');
  ny.addEventListener('submit', async (e) => {
    e.preventDefault();
    const [tjanst, intygstyp] = ny.tjanst.value.split(':');
    try {
      const r = await medKnapp(ny.querySelector('[type=submit]'), () => api('/api/kassa/avgift', { metod: 'POST', data: { personnummer: ny.personnummer.value, tjanst, intygstyp } }), ny);
      const a = r.avgift;
      ny.querySelector('#kassa-avgift').innerHTML = `<div class="ruta ruta-info"><p><strong>${esc(r.patient.namn)}</strong>, ${esc(a.tjanstText)}: ${esc(kr(a.belopp))}.</p><p class="hjalp">${esc(a.text)}</p>
        ${a.status === 'att_betala' ? `<div class="knapprad"><button type="button" class="knapp" data-betala="kort" data-id="${a.id}">Kort</button><button type="button" class="knapp sekundar" data-betala="faktura" data-id="${a.id}">Faktura</button></div>` : '<p>Det finns inget att betala. Systemet har registrerat det.</p>'}</div>`;
    } catch (err) { fel(err); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-betala], [data-ater], #kassa-avslut, #kassa-avsluta-ok');
    if (!b) return;
    try {
      if (b.dataset.betala) {
        const r = await medKnapp(b, () => api(`/api/kassa/avgift/${b.dataset.id}/betala`, { metod: 'POST', data: { satt: b.dataset.betala } }));
        notis(`${r.betalning.satt === 'kort' ? 'Betalt med kort' : 'Fakturan är registrerad'}. Kvitto ${r.betalning.kvitto}.`);
        await visaKassa(main);
      } else if (b.dataset.ater) {
        const [kalla, id] = b.dataset.ater.split(':');
        const svar = await dialog(`<h2 id="dlg-rubrik">Återbetala ${esc(kr(b.dataset.belopp))}</h2><div class="dialog-text"><p>Beloppet går tillbaka samma väg som det betalades: till kortet eller som kreditfaktura. Välj varför.</p></div>
          <div class="knapprad">${k.orsaker.map(o => `<button type="button" class="knapp sekundar" data-varde="${esc(o.id)}">${esc(o.text)}</button>`).join('')}<button type="button" class="knapp text" data-varde="avbryt">Avbryt</button></div>`);
        if (!svar?.val || svar.val === 'avbryt') return;
        const r = await api('/api/kassa/aterbetalning', { metod: 'POST', data: { kalla, id: Number(id), orsak: svar.val } });
        notis(`Återbetalt ${kr(r.belopp)}. Kvitto ${r.kvitto}.`);
        await visaKassa(main);
      } else if (b.id === 'kassa-avslut') {
        const s = jag.oppna;
        el.querySelector('#kassa-avslut-form').innerHTML = `<form class="ruta ruta-info" id="kassa-avslut-falt" novalidate><p>Din kassa: ${s.antal} rader. Kort ${esc(kr(s.kort))} och faktura ${esc(kr(s.faktura))}. Betalterminalens dagsrapport säger ${esc(kr(s.kort))} på kort (simulerad).</p>
          <div class="falt-rad"><div class="falt"><label for="kassa-raknat">Räknat på kort, kronor</label><input id="kassa-raknat" name="raknat" inputmode="numeric" value="${s.kort}"></div>
          <div class="falt"><label for="kassa-forklaring">Förklaring om beloppen inte stämmer</label><input id="kassa-forklaring" name="forklaring" maxlength="500"></div></div>
          <p class="form-fel" hidden></p><div class="knapprad"><button type="button" class="knapp" id="kassa-avsluta-ok">Stäm av och avsluta</button></div></form>`;
      } else {
        const f = el.querySelector('#kassa-avslut-falt');
        const r = await medKnapp(b, () => api('/api/kassa/dagsavslut', { metod: 'POST', data: { raknat: Number(f.raknat.value), forklaring: f.forklaring.value } }), f);
        notis(`Dagsavslutet är gjort. ${r.text}`);
        await visaKassa(main);
      }
    } catch (err) { fel(err); }
  });
}

// --- Kapacitet och prognos ---------------------------------------------------------------------------------------------
async function visaKapacitet(main) {
  main.innerHTML = vyRubrik('Kapacitet', 'Lediga tider mot väntelistan och de inkomna remisserna vecka för vecka, när kön är borta och vad som behöver göras. Inga patientuppgifter.') + '<div id="kap"><p class="tom">Hämtar.</p></div>';
  const k = await api('/api/kapacitet');
  const forslag = k.grupper.flatMap(g => g.forslag);
  main.querySelector('#kap').innerHTML = `<p>${esc(k.vardenhet.namn)}, ${k.veckor.length} veckor från vecka ${k.veckor[0].nummer}. Väntar: <strong>${k.summa.vantar}</strong>, varav ${k.summa.remisser} inkomna remisser. Riskerar att passera gränsen: <strong>${k.summa.riskerarGransen}</strong>. Lediga tider: ${k.summa.ledigaTotalt}.</p>
    ${forslag.length ? `<section class="ov-sektion" aria-labelledby="kap-forslag"><div class="sektion-huvud"><h2 id="kap-forslag">Systemets förslag</h2></div><ul class="enkel-lista">${forslag.map(f => `<li class="${f.typ === 'risk' ? 'ruta ruta-obs liten' : ''}">${esc(f.text)}</li>`).join('')}</ul></section>` : ''}
    <div class="tabellrulle"><table class="tabell" id="kap-grupper"><caption>Per tidstyp och yrkesroll</caption><thead><tr><th scope="col">Tidstyp</th><th scope="col">Yrkesroll</th><th scope="col" class="tal">Väntar</th><th scope="col" class="tal">Lediga tider</th><th scope="col" class="tal">Inflöde per vecka</th><th scope="col">Kön är borta</th><th scope="col" class="tal">Riskerar gränsen</th></tr></thead>
    <tbody>${k.grupper.map(g => `<tr><th scope="row">${esc(g.tidstypText)}</th><td>${esc(g.yrkesrollText)}</td><td class="tal">${g.vantar}</td><td class="tal">${g.ledigaTotalt}</td><td class="tal">${esc(String(g.inflodePerVecka).replace('.', ','))}</td>
      <td>${g.kontBorta ? `Vecka ${g.kontBorta.vecka}` : 'Inte inom perioden'}</td><td class="tal">${g.riskerarGransen}</td></tr>`).join('')}</tbody></table></div>
    ${k.grupper.filter(g => g.vantar).map(g => `<details class="ov-sektion"><summary>${esc(g.tidstypText)} hos ${esc(g.yrkesrollText)} vecka för vecka</summary><div class="tabellrulle"><table class="tabell"><caption class="sr">${esc(g.tidstypText)} hos ${esc(g.yrkesrollText)}</caption>
      <thead><tr><th scope="col">Vecka</th><th scope="col" class="tal">Tider</th><th scope="col" class="tal">Bokade</th><th scope="col" class="tal">Lediga</th><th scope="col" class="tal">Nya i kön</th><th scope="col" class="tal">Kvar i kön</th></tr></thead>
      <tbody>${g.veckor.map(v => `<tr><th scope="row">${v.vecka}${v.beraknad ? ' (beräknad)' : ''}</th><td class="tal">${v.tider}</td><td class="tal">${v.bokade}</td><td class="tal">${v.lediga}</td><td class="tal">${v.efterfragan}</td><td class="tal">${v.koEfter}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}
    ${k.resurser.length ? `<div class="tabellrulle"><table class="tabell" id="kap-resurser"><caption>Lokaler, utrustning och sjukresor, bokade timmar per vecka</caption><thead><tr><th scope="col">Resurs</th>${k.veckor.slice(0, 6).map(v => `<th scope="col" class="tal">v. ${v.nummer}</th>`).join('')}<th scope="col" class="tal">Högst</th></tr></thead>
      <tbody>${k.resurser.map(r => `<tr><th scope="row">${esc(r.namn)}</th>${r.veckor.slice(0, 6).map(v => `<td class="tal">${esc(String(v.timmar).replace('.', ','))}</td>`).join('')}<td class="tal">${r.hogst} %</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="knapprad"><a class="knapp sekundar" href="/api/kapacitet/rapport.docx" download>Prognosen som Word-dokument</a></div>
    <p class="hjalp">${esc(k.demoregler)}</p>`;
}

// --- Kontorsstöd ---------------------------------------------------------------------------------------------------
const STATUS = { byggt: 'Byggt', simulerat: 'Simulerat', beskrivet: 'Beskrivet' };
async function visaKontorsstod(main) {
  main.innerHTML = vyRubrik('Kontorsstöd', 'Hur Vårdkällan fungerar tillsammans med kontorsstödet, till exempel Microsoft 365, och din kalender.') + '<div id="ks"><p class="tom">Hämtar.</p></div>';
  const [kal, a] = await Promise.all([api('/api/kalender'), api('/api/kontorsstod')]);
  const el = main.querySelector('#ks');
  const kalender = (s, adress = null, text = '') => `<div class="sektion-huvud"><h2 id="ks-kal">Din kalender</h2></div><p>${esc(s.text)}</p>
    ${adress ? `<div class="falt"><label for="kal-adress">Adress för kalenderprogrammet</label><input id="kal-adress" readonly value="${esc(adress)}"></div><p class="ruta ruta-info liten">${esc(text)}</p>` : ''}
    ${s.finns ? `<p class="under-text">Länken skapades ${esc(tidpunkt(s.skapad))}${s.hamtad ? ` och hämtades senast ${esc(tidpunkt(s.hamtad))}` : ''}.</p>` : ''}
    <div class="knapprad"><button type="button" class="knapp" id="kal-skapa">${s.finns ? 'Skapa en ny länk' : 'Skapa kalenderlänk'}</button>${s.finns ? '<button type="button" class="knapp sekundar" id="kal-aterkalla">Återkalla länken</button>' : ''}</div>`;
  el.innerHTML = `<section class="ov-sektion" aria-labelledby="ks-kal" id="ks-kalender">${kalender(kal)}</section>
    <section class="ov-sektion" aria-labelledby="ks-ark"><div class="sektion-huvud"><h2 id="ks-ark">Arkitektur mot kontorsstödet</h2></div><p>${esc(a.princip)}</p>
      <div class="tabellrulle"><table class="tabell"><caption class="sr">Områden i kontorsstödet</caption><thead><tr><th scope="col">Område</th><th scope="col">Så fungerar det</th><th scope="col">Standard</th><th scope="col">Säkerhet</th><th scope="col">Läge</th></tr></thead>
      <tbody>${a.omraden.map(o => `<tr><th scope="row">${esc(o.namn)}</th><td>${esc(o.hur)}</td><td>${esc(o.standard)}</td><td>${esc(o.sakerhet)}</td><td>${esc(STATUS[o.status])}</td></tr>`).join('')}</tbody></table></div>
      <p>${esc(a.overlapp)}</p><p class="hjalp">${esc(a.simulerat)}</p></section>`;
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('#kal-skapa, #kal-aterkalla');
    if (!b) return;
    try {
      const sek = el.querySelector('#ks-kalender');
      if (b.id === 'kal-skapa') {
        const r = await medKnapp(b, () => api('/api/kalender/lank', { metod: 'POST', data: {} }));
        sek.innerHTML = kalender(r, r.adress, r.visasEnGang);
        notis('Kalenderlänken är skapad.');
      } else {
        const r = await medKnapp(b, () => api('/api/kalender/lank/aterkalla', { metod: 'POST', data: {} }));
        sek.innerHTML = kalender(r);
        notis('Kalenderlänken är återkallad och fungerar inte längre.');
      }
    } catch (err) { felNotis(err); }
  });
}

// --- Patientens ombud med fullmakt, under Identitet -----------------------------------------------------------------
export async function ombudIJournalen(el, pid) {
  const d = await api(`/api/patient/${encodeURIComponent(pid)}/fullmakter`);
  const sek = document.createElement('section');
  sek.setAttribute('aria-labelledby', 'fm-rubrik');
  const ritaOm = (x) => {
    sek.innerHTML = `<h3 id="fm-rubrik">Ombud med fullmakt</h3>
      ${x.fullmakter.length ? `<ul class="enkel-lista">${x.fullmakter.map(f => `<li><strong>${esc(f.ombud?.namn ?? '')}</strong> <span class="pnr">${esc(f.ombud?.personnummer ?? '')}</span>: ${esc(f.omfattning.map(o => o.text).join('. '))}. Till och med ${esc(f.giltigTill)}. ${esc(f.kallaText)}. <span class="tagg">${esc(f.statusText ?? '')}</span>
        ${f.aktiv && x.kanRegistrera ? `<button type="button" class="knapp text liten" data-fm-aterkalla="${f.id}">Återkalla</button>` : ''}</li>`).join('')}</ul>` : '<p class="tom">Patienten har inga ombud.</p>'}
      ${x.kanRegistrera ? `<form id="fm-ny" novalidate><div class="falt-rad"><div class="falt"><label for="fm-pnr">Ombudets personnummer</label><input id="fm-pnr" name="personnummer" autocomplete="off" maxlength="13"></div></div>
        <div class="radio"><input type="checkbox" id="fm-skriftlig" name="skriftlig"><label for="fm-skriftlig">Patienten har lämnat en skriftlig och undertecknad fullmakt</label></div>
        <p class="form-fel" hidden></p><div class="knapprad"><button type="submit" class="knapp sekundar">Registrera fullmakten</button></div></form>` : ''}
      <p class="hjalp">Ett ombud bokar tider och skriver meddelanden för patienten i Min journal, men läser aldrig journalen. ${esc(x.demoregler)}</p>`;
  };
  ritaOm(d);
  el.append(sek);
  sek.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await medKnapp(f.querySelector('[type=submit]'), () => api(`/api/patient/${encodeURIComponent(pid)}/fullmakter`, { metod: 'POST', data: { personnummer: f.personnummer.value, skriftlig: f.skriftlig.checked } }), f);
      notis('Fullmakten är registrerad.');
      ritaOm(await api(`/api/patient/${encodeURIComponent(pid)}/fullmakter`));
    } catch (err) { fel(err); }
  });
  sek.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-fm-aterkalla]');
    if (!b) return;
    try {
      await medKnapp(b, () => api(`/api/patient/${encodeURIComponent(pid)}/fullmakter/${b.dataset.fmAterkalla}/aterkalla`, { metod: 'POST', data: {} }));
      notis('Fullmakten är återkallad.');
      ritaOm(await api(`/api/patient/${encodeURIComponent(pid)}/fullmakter`));
    } catch (err) { felNotis(err); }
  });
}

// --- En bokning i tidboken: möteslänk, uppringning och inbjudan -------------------------------------------------------
export async function kontorsstodBokning(id) {
  const k = await api(`/api/bokning/${encodeURIComponent(id)}/kontorsstod`);
  const rader = [
    k.video && `<li><a href="${esc(k.video.lank)}">Öppna videomötet</a><span class="under-text">${esc(k.video.text)}</span></li>`,
    k.telefon && (k.telefon.uri ? `<li><a href="${esc(k.telefon.uri)}">Ring upp patienten</a><span class="under-text">${esc(k.telefon.text)}</span></li>` : `<li>${esc(k.telefon.text)}</li>`),
    `<li><a href="${esc(k.ics)}" download>Lägg in tiden i din kalender</a><span class="under-text">En kalenderfil med tid, typ och mottagning, utan patientuppgifter.</span></li>`,
    `<li><a href="${esc(k.epost)}" download>Inbjudan som e-post (simulerad)</a><span class="under-text">Ett e-postmeddelande med kalenderinbjudan. Det skickas inte i demon.</span></li>`,
  ].filter(Boolean);
  await dialog(`<h2 id="dlg-rubrik">${esc(k.tidstypText ?? 'Tiden')} i kontorsstödet</h2><div class="dialog-text"><ul class="enkel-lista">${rader.join('')}</ul></div>
    <div class="knapprad"><button type="button" class="knapp sekundar" data-varde="avbryt">Stäng</button></div>`);
}

// --- Den simulerade mötessidan ------------------------------------------------------------------------------------
async function visaVideomote(main, [kod]) {
  main.innerHTML = vyRubrik('Videomöte (simulerat)') + '<div id="vm"><p class="tom">Hämtar.</p></div>';
  const m = await api(`/api/videomote/${encodeURIComponent(kod)}`);
  main.querySelector('#vm').innerHTML = `<div class="ruta ruta-info"><p>${esc(m.text)}</p><p>Tid: ${esc(datum(m.start))} klockan ${esc(klockslag(m.start))} till ${esc(klockslag(m.slut))}.</p></div>`;
}

export const meddelanden = { namn: 'meddelanden', visa: visaMeddelanden };
export const begaran = { namn: 'begaran', visa: visaBegaran };
export const kassa = { namn: 'kassa', visa: visaKassa };
export const kapacitet = { namn: 'kapacitet', visa: visaKapacitet };
export const kontorsstod = { namn: 'kontorsstod', visa: visaKontorsstod };
export const videomote = { namn: 'videomote', visa: visaVideomote };
