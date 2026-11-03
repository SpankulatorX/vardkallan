// Inkorgen: osignerade anteckningar, okvitterade remissvar, larm och NLL-avvikelser. Varje rad leder till rätt ställe.
import { esc, api, tidpunkt, ikon, vyRubrik, NLL, dialog, medKnapp, notis } from '../ui.js';
import { S, uppdateraInkorg } from '../app.js';
// Runda 6, r3: tvångsvård, vårdplaner och samordnad planering.
import { inkorgSektioner } from './r3.js';
// Runda 6, r1: uppmärksamhetssymbolen på raderna (Sussa 3.1.5.2), med samma regler som i patienthuvudet.
import { symbolSvg, symbolText, harNagot } from '../uppmarksamhet.js';
// Runda 6, r2: muntliga ordinationer signeras direkt från inkorgen.
import { signeraMuntlig } from './lakemedelsstod.js';
// Runda 6, r4: egna bevakningar.
import { bevakningKlar } from '../planering-ui.js';

export const namn = 'inkorg';

const pnamn = (p) => (p?.skyddad ? 'Skyddad identitet' : p?.namn ?? '');
// Symbolen visas när servern har skickat den, alltså när den inloggade får läsa patientens översikt.
const sym = (p) => (harNagot(p?.uppmarksamhet) ? ` <span class="ik-um" title="${esc(symbolText(p.uppmarksamhet))}">${symbolSvg(p.uppmarksamhet, 18)}</span>` : '');
const LARMTYP = { saknar_mottagningskvittens: 'Mottagningskvittens saknas', svar_forsenat: 'Svar försenat', svar_ej_kvitterat: 'Svaret är inte kvitterat' };

function sektion(id, rubrik, rader, tomText, forklaring) {
  return `<section class="inkorg-sektion" aria-labelledby="ik-${id}">
    <h2 id="ik-${id}">${esc(rubrik)} <span class="antal${rader.length ? ' antal-aktiv' : ''}">${rader.length}</span></h2>
    <p class="dampad liten">${esc(forklaring)}</p>
    ${rader.length ? `<ul class="inkorg-lista">${rader.join('')}</ul>` : `<p class="tom liten">${esc(tomText)}</p>`}
  </section>`;
}

const rad = (href, rubrik, detalj, klass = '') => `<li class="${klass}"><a href="${href}"><span class="ik-rubrik">${rubrik}</span><span class="under-text">${detalj}</span></a>${ikon.pil}</li>`;

export async function visa(main) {
  main.innerHTML = vyRubrik('Inkorg', 'Det som väntar på dig eller din vårdenhet. Inget försvinner förrän det är åtgärdat.') + '<div id="ik"><p class="tom">Hämtar inkorgen.</p></div>';
  const d = await api('/api/inkorg');
  await uppdateraInkorg();
  const pat = (id, flik, sub) => `#/patient/${encodeURIComponent(id)}${flik ? `/${flik}` : ''}${sub ? `/${sub}` : ''}`;

  const osign = d.osigneradeAnteckningar.map(a => rad(pat(a.patientId, 'journal', a.id),
    `${esc(a.typ)}, ${esc(pnamn(a.patient))}${sym(a.patient)}`, `Utkast skapat ${esc(tidpunkt(a.skapad))} på ${esc(a.enhet.namn)}. ${esc(a.sammanfattning)}`));
  const svar = d.okvitteradeSvar.map(r => rad(`#/remisser?riktning=utgaende&remiss=${r.id}`,
    `Svar från ${esc(r.till.namn)}, ${esc(pnamn(r.patient))}${sym(r.patient)}`, `Besvarad ${esc(tidpunkt(r.tider.besvarad))} av ${esc(r.av?.besvarad?.namn ?? '')}. Kvittera att du har läst svaret.`));
  const larm = d.larm.map(l => rad(`#/remisser?riktning=${l.riktning}&remiss=${l.remissId}`,
    `${ikon.larm}<span>${esc(LARMTYP[l.typ] ?? l.typ)}, ${esc(l.patient)}</span>`, `${esc(l.text)} ${l.riktning === 'inkommande' ? 'Inkommande remiss.' : 'Utgående remiss.'}`, 'ik-larm'));
  const nll = d.nllAvvikelser.map(n => rad(pat(n.patientId, 'lakemedel'),
    `${esc(n.lakemedel)}, ${esc(pnamn(n.patient))}${sym(n.patient)}`, `${esc(NLL[n.nll_status] ?? n.nll_status)}. Ordinerat ${esc(tidpunkt(n.skapad))}. Stäm av mot NLL.`, 'ik-nll'));

  const dubb = (d.dubbletter ?? []).map(x => rad(pat(x.patientId, 'identitet'),
    `Trolig dubblett, ${esc(pnamn(x.patient))}${sym(x.patient)}`, `<span class="pnr">${esc(x.patient.personnummer)}</span>. Systemet har hittat ${x.antal === 1 ? 'en annan journal' : `${x.antal} andra journaler`} som troligen gäller samma person. Bekräfta sammanslagningen.`, 'ik-dubblett'));

  // Kontrasignering (Sussa 3.1.11.3) och utlämnade originalhandlingar som inte har kommit tillbaka (Sussa 3.1.9.3).
  const ks = (d.kontrasigneringar ?? []).map(k => (k.tillganglig
    ? rad(k.typ === 'anteckning' ? pat(k.patientId, 'journal', k.postId) : pat(k.patientId, 'matvarden'), `${esc(k.rubrik)}, ${esc(pnamn(k.patient))}${sym(k.patient)}`,
      `Begärd ${esc(tidpunkt(k.begard))} av ${esc(k.begardAv?.namn ?? '')}.${k.kommentar ? ` ${esc(k.kommentar)}` : ''} Läs och kontrasignera.`, 'ik-ks')
    : `<li class="ik-ks"><span class="ik-rubrik">${esc(k.rubrik)}</span><span class="under-text">Begärd av ${esc(k.begardAv?.namn ?? '')}. Du har inte längre behörighet till uppgiften, så den kan inte kontrasigneras av dig.</span></li>`));
  const ater = (d.aterlamnanden ?? []).map(u => rad(pat(u.patientId, 'utlamnat'), `${esc(u.mottagare)}: ${esc(u.beskrivning)}`,
    `Skulle ha lämnats tillbaka senast ${esc(u.aterlamnasSenast)}. Utlämnad ${esc(tidpunkt(u.utlamnad))}.`, 'ik-larm'));

  // Delegeringar som går ut inom 30 dagar, för sjuksköterskan (runda 5).
  const deleg = (d.delegeringarSomGarUt ?? []).map(x => rad('#/delegeringar', `Delegering går ut, ${esc(x.namn)}`, esc(x.text), 'ik-larm'));
  // Återinsättning efter uppehåll med antikoagulantia, för läkaren (runda 5, r4). Knappen öppnar läkemedelslistan med
  // ordinationen ifylld ur den tidigare.
  const atersatt = (d.aterinsattningar ?? []).map(x => `<li class="ik-ater${x.dagarKvar < 0 ? ' ik-larm' : ''}"><div class="ik-text"><span class="ik-rubrik">${esc(x.lakemedel)}, ${esc(pnamn(x.patient))}${sym(x.patient)}</span>
    <span class="under-text">${esc(x.text)} Plan: ${esc(x.plan)}.</span></div><div class="ik-knappar"><a class="knapp liten" href="${esc(x.href)}" data-aterinsatt="${x.ordinationId}">Sätt in igen</a><button type="button" class="knapp liten sekundar" data-avsluta="${x.ordinationId}">Avslutad behandling</button></div></li>`);
  // Vårdhändelser som avbokades eftersom remissen avvisades, för den ordinerande läkaren (runda 5, r4).
  const avbokade = (d.avbokadeVardhandelser ?? []).map(x => x.utanPatient ? `<li class="ik-ater ik-larm"><div class="ik-text"><span class="ik-rubrik">En läkemedelsdos väntar på ett beslut</span>
    <span class="under-text">${esc(x.text)}</span></div><div class="ik-knappar"><button type="button" class="knapp liten" data-vh-nod="${x.ordinationId}">Öppna med nödåtkomst</button></div></li>` : `<li class="ik-ater ik-larm"><div class="ik-text"><span class="ik-rubrik">${esc(x.lakemedel ?? '')}, ${esc(pnamn(x.patient))}${sym(x.patient)}</span>
    <span class="under-text">${esc(x.text)}</span></div><div class="ik-knappar"><a class="knapp liten sekundar" href="${esc(x.hrefUtsatt)}" data-vh-utsatt="${x.ordinationId}">Sätt ut</a>${x.kanSattasUpp ? `<button type="button" class="knapp liten" data-vh-igen="${x.ordinationId}">Sätt upp på väntelistan igen</button>` : ''}</div></li>`);

  // Runda 6, r1: NEWS2 eller ett enskilt värde som kräver åtgärd, för sjuksköterskan och läkaren på vårdenheten.
  const news2 = (d.news2Larm ?? []).map(x => `<li class="ik-larm ik-news2"><a href="${esc(x.href)}"><span class="ik-rubrik">${ikon.larm}<span>${esc(x.rubrik)}, ${esc(pnamn(x.patient))}${sym(x.patient)}</span></span>
    <span class="under-text">${esc(x.text)} Mätt ${esc(tidpunkt(x.tid))}.${x.forsenad ? ' Kontrollen är försenad.' : ''}</span>
    <span class="under-text ik-atgard">${esc(x.atgard.join(' '))}</span></a>${ikon.pil}</li>`);
  // Runda 6, r2: passerade uppföljningar, muntliga ordinationer att signera, fördjupade genomgångar och licenser.
  const uppf = (d.lakemedelsuppfoljningar ?? []).map(x => `<li class="ik-ater ik-larm"><div class="ik-text"><span class="ik-rubrik">${esc(x.lakemedel)}, ${esc(pnamn(x.patient))}</span>
    <span class="under-text">${esc(x.text)} ${esc(x.ordinationsorsak)}.</span></div><div class="ik-knappar"><a class="knapp liten" href="${pat(x.patientId, 'lakemedel', `utvardera-${x.ordinationId}`)}">Utvärdera</a></div></li>`);
  const muntl = (d.muntligaAttSignera ?? []).map(x => `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">${esc(x.lakemedel)}, ${esc(pnamn(x.patient))}</span>
    <span class="under-text">${esc(x.dosering)}. Dokumenterad ${esc(tidpunkt(x.mottagen))} av ${esc(x.mottagenAv)}, ${x.satt === 'telefon' ? 'per telefon' : 'muntligt'}.</span></div><div class="ik-knappar"><a class="knapp liten sekundar" href="${pat(x.patientId, 'lakemedel')}">Läs</a><button type="button" class="knapp liten" data-signera="${x.ordinationId}">Signera</button></div></li>`);
  const fordj = (d.fordjupadeGenomgangar ?? []).map(x => rad(pat(x.patientId, 'lakemedel'), `Fördjupad läkemedelsgenomgång, ${esc(pnamn(x.patient))}`, `${esc(x.statusText)}. Startad ${esc(tidpunkt(x.startad))} av ${esc(x.startadAv)}.`));
  const lic = (d.licenserSomGarUt ?? []).map(x => `<li class="${x.utgangen ? 'ik-larm' : ''}"><span class="ik-rubrik">${esc(x.lakemedel)}, licens ${esc(x.licensnummer)}</span><span class="under-text">${esc(x.text)}</span></li>`);
  // Runda 6, r4: egna bevakningar som har löpt ut, med en patient eller för vårdenheten.
  const egnaBev = (d.egnaBevakningar ?? []).map(x => `<li class="ik-ater"><div class="ik-text"><span class="ik-rubrik">${x.patient ? `<a href="#/patient/${encodeURIComponent(x.patient.id)}">${esc(pnamn(x.patient))}</a>` : 'Vårdenheten'}: ${esc(x.text)}</span>
    <span class="under-text">${x.enhetsniva ? 'För hela vårdenheten' : 'Din bevakning'}, datum ${esc(x.datum)}. Lagd av ${esc(x.skapadAv?.namn ?? '')}.</span></div><div class="ik-knappar"><button type="button" class="knapp liten sekundar" data-egen-bev="${x.id}">Klar</button></div></li>`);
  const yrke = S.session?.personal?.yrke;
  // Runda 6, r2: har användaren hunnit gå vidare till en annan vy, eller loggat ut, medan inkorgen hämtades finns
  // inget att visa den i.
  if (!main.querySelector('#ik') || !S.session?.personal) return;

  main.querySelector('#ik').innerHTML = `<div class="inkorg-rutnat">
    ${news2.length ? sektion('news2', 'NEWS2 som kräver åtgärd', news2, '', 'Patienter på vårdenheten där NEWS2 eller ett enskilt värde kräver åtgärd enligt NEWS2 (Royal College of Physicians 2017). Systemet räknar poängen ur vitalparametrarna. Demoregel, inte kliniskt beslutsstöd.') : ''}
    ${yrke === 'lakare' || muntl.length ? sektion('muntlig', 'Muntliga ordinationer att signera', muntl, 'Inga muntliga ordinationer väntar på din signering.', 'Ordinationer som du lämnade muntligt eller per telefon och som en sjuksköterska har dokumenterat. De skickas till NLL när du har signerat.') : ''}
    ${S.session.behorigheter.includes('utvardera_lakemedel') && yrke === 'lakare' ? sektion('uppf', 'Uppföljning av läkemedel', uppf, 'Inga uppföljningar har passerat.', 'Läkemedel där uppföljningsdatumet har passerat. Utvärdera effekt och biverkan, och systemet föreslår nästa uppföljning.') : ''}
    ${['lakare', 'farmaceut'].includes(yrke) ? sektion('fordj', 'Fördjupade läkemedelsgenomgångar', fordj, 'Inga fördjupade genomgångar väntar på dig.', yrke === 'farmaceut' ? 'Genomgångar på din vårdenhet som väntar på farmaceutens bedömning.' : 'Genomgångar på din vårdenhet som pågår.') : ''}
    ${lic.length ? sektion('lic', 'Licenser som går ut', lic, '', 'Licensläkemedel på din vårdenhet. Systemet bevakar licensens giltighet.') : ''}
    ${avbokade.length ? sektion('vhavbokad', 'Vårdhändelser som avbokades', avbokade, '', 'Remissen avvisades, och tiden för en vårdhändelse som en läkemedelsdos väntar på avbokades. Besluta om ordinationen.') : ''}
    ${S.session.behorigheter.includes('ordinera') ? sektion('atersatt', 'Läkemedel att sätta in igen', atersatt, 'Inget läkemedel ska sättas in igen efter ett uppehåll i dag eller i morgon.', 'Antikoagulantia som gör uppehåll inför ett ingrepp. Systemet påminner dagen före återinsättningen och fyller i ordinationen ur den tidigare.') : ''}
    ${S.session.behorigheter.includes('delegera') && (S.session.personal.yrke === 'sjukskoterska' || deleg.length) ? sektion('deleg', 'Delegeringar som går ut', deleg, 'Inga delegeringar går ut de närmaste 30 dagarna.', 'Undersköterskornas delegeringar att ge läkemedel. Följ upp dem och registrera nya innan de går ut.') : ''}
    ${S.session.behorigheter.includes('sla_samman') ? sektion('dubb', 'Troliga dubbletter', dubb, 'Inga troliga dubbletter.', 'Journaler som systemet tror gäller samma person, till exempel ett reservnummer och ett personnummer med samma namn och födelsedatum.') : ''}
    ${inkorgSektioner(d, sektion, rad)}
    ${S.session.behorigheter.includes('bevaka_enhet') ? sektion('egnabev', 'Bevakningar', egnaBev, 'Inga bevakningar har löpt ut.', 'Bevakningar som du eller någon på vårdenheten har lagt upp, med datum och ansvarig.') : ''}
    ${sektion('larm', 'Larm', larm, 'Inga larm.', 'Remisser där mottagningskvittens, svar eller kvittens av svaret har uteblivit för länge.')}
    ${S.session.behorigheter.includes('kontrasignera') ? sektion('ks', 'Att kontrasignera', ks, 'Inget väntar på din kontrasignering.', 'Journalinformation som någon har bett dig kontrasignera. Öppna, läs och kontrasignera med ett klick.') : ''}
    ${S.session.behorigheter.includes('utlamna') && ater.length ? sektion('ater', 'Återlämnanden som dröjer', ater, '', 'Utlämnade originalhandlingar som skulle ha kommit tillbaka.') : ''}
    ${sektion('osign', 'Osignerade anteckningar', osign, 'Inga osignerade anteckningar.', 'Dina utkast. De syns bara för dig tills du signerar.')}
    ${sektion('svar', 'Okvitterade remissvar', svar, 'Inga remissvar väntar på dig.', 'Svar på remisser från din vårdenhet som ingen har kvitterat än.')}
    ${sektion('nll', 'NLL-avvikelser', nll, 'Inga avvikelser mot Nationella läkemedelslistan.', 'Ordinationer från din vårdenhet där NLL inte svarade i tid eller svarade med fel.')}
  </div>${S.session.personal.yrke === 'vardadministrator' ? '<p class="dampad liten">Som vårdadministratör ser du larm om remissernas status men ingen journaltext.</p>' : ''}`;
  // Runda 5, r4: avsluta behandlingen efter ett uppehåll och sätta upp en avbokad vårdhändelse igen.
  // Runda 6, r4: en egen bevakning markeras som klar.
  main.querySelector('#ik').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-egen-bev]');
    if (!b) return;
    try { await medKnapp(b, () => bevakningKlar(b.dataset.egenBev)); notis('Bevakningen är klar.'); b.closest('li')?.remove(); await uppdateraInkorg(); } catch { /* felet visas som notis */ }
  });
  main.querySelector('#ik').addEventListener('click', async (e) => {
    const sg = e.target.closest('[data-signera]');
    if (sg) return signeraMuntlig(sg, sg.dataset.signera, async () => { await uppdateraInkorg(); visa(main); });
    const b = e.target.closest('[data-avsluta],[data-vh-igen],[data-vh-nod]');
    if (!b) return;
    if (b.dataset.vhNod) {
      const svar = await dialog(`<form><h2 id="dlg-rubrik">Nödåtkomst</h2>
        <p>Du har ingen vårdrelation till patienten. Nödåtkomst används när uppgifterna behövs för vården och patienten inte kan tillfrågas. Den loggas med ditt namn och syftet och följs upp.</p>
        <div class="falt"><label for="nod-syfte">Syfte</label><input id="nod-syfte" name="syfte" maxlength="300" value="Besluta om en läkemedelsdos som väntar på en avbokad vårdhändelse"></div>
        <p class="dialog-fel form-fel" role="alert" hidden></p>
        <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Öppna med nödåtkomst</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
      { validera: (v) => ((v.syfte || '').trim().length < 3 ? 'Ange syftet med minst tre tecken.' : null),
        onOpen: (dl) => dl.querySelector('[data-varde="ok"]').focus() });
      if (!svar) return;
      try {
        const r = await medKnapp(b, () => api(`/api/ordination/${encodeURIComponent(b.dataset.vhNod)}/avbokad/nodatkomst`, { metod: 'POST', data: { syfte: svar.data.syfte.trim() } }));
        location.hash = r.href;
      } catch { /* notis visad */ }
      return;
    }
    if (b.dataset.avsluta) {
      const x = d.aterinsattningar.find(r => String(r.ordinationId) === b.dataset.avsluta);
      if (await avsluta(b, x)) visa(main);
      return;
    }
    try {
      await medKnapp(b, () => api(`/api/ordination/${encodeURIComponent(b.dataset.vhIgen)}/vardhandelse/igen`, { metod: 'POST', data: {} }));
      notis('Vårdhändelsen står på väntelistan igen. Dosen väntar på den nya tiden.');
      visa(main);
    } catch { /* notis visad */ }
  });
}

// Avslutad behandling: systemet föreslår orsaken, och den första är förvald.
async function avsluta(b, x) {
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Avsluta behandlingen med ${esc(x.lakemedel)}</h2>
    <p>Läkemedlet sätts inte in igen efter uppehållet. Avslutet sparas med ditt namn, tiden och orsaken i ordinationens historik, och raden försvinner för alla som har fått den.</p>
    <fieldset class="kryssgrupp"><legend>Orsak</legend>
      ${x.orsaker.map((o, i) => `<div class="kryssfalt"><input type="radio" id="av-${i}" name="orsak" value="${esc(o)}"${i ? '' : ' checked'}><label for="av-${i}">${esc(o)}</label></div>`).join('')}
      <div class="kryssfalt"><input type="radio" id="av-annan" name="orsak" value=""><label for="av-annan">Annan orsak</label></div>
    </fieldset>
    <div class="falt"><label for="av-text">Annan orsak</label><input id="av-text" name="annan" maxlength="300"></div>
    <p class="dialog-fel form-fel" role="alert" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Avsluta behandlingen</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`,
  { validera: (v) => ((v.orsak || v.annan || '').trim().length < 3 ? 'Välj en orsak eller skriv en med minst tre tecken.' : null),
    onOpen: (dl) => { dl.querySelector('#av-text').addEventListener('input', () => { dl.querySelector('#av-annan').checked = true; }); dl.querySelector('[data-varde="ok"]').focus(); } });
  if (!svar) return false;
  const orsak = (svar.data.orsak || svar.data.annan).trim();
  try {
    await medKnapp(b, () => api(`/api/ordination/${encodeURIComponent(x.ordinationId)}/aterinsattning/avsluta`, { metod: 'POST', data: { orsak } }));
    notis(`Behandlingen med ${x.lakemedel} är avslutad.`);
    await uppdateraInkorg();
    return true;
  } catch { return false; }
}
