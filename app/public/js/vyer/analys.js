// Runda 9, r7: analys och statistik i kärnsystemet (Sussa 6.2.1.1), patientgrupper (6.2.1.2), folkhälsoinsatser
// (6.2.2.1) och uppföljningen av subprocesserna mot målvärdena (6.1.1.4). Servern prövar behörigheten och räknar allt;
// här visas bara det som servern lämnar ut. Läkare och sjuksköterskor ser sina patienter på den egna vårdenheten,
// uppföljningen ser antal för hela vårdgivaren.
import { esc, api, vyRubrik, tidpunkt, datum, ikon, medKnapp, notis, felNotis, falt, tom } from '../ui.js';
import { far, pa } from '../app.js';

export const namn = 'analys';

const tal = (v, dolt) => (dolt || v == null ? '<span class="dampad">färre än 5</span>' : esc(String(v).replace('.', ',')));

// Ett enkelt stapeldiagram i SVG. Dolda rutor ritas inte.
function diagram(rader, rubrik) {
  const synliga = rader.filter(r => typeof r.varde === 'number');
  if (!synliga.length) return '';
  const max = Math.max(...synliga.map(r => r.varde), 1);
  const h = 24;
  const bredd = 600;
  const etikett = 180;
  const rader2 = rader.map((r, i) => {
    const w = typeof r.varde === 'number' ? Math.round((r.varde / max) * (bredd - etikett - 60)) : 0;
    return `<g transform="translate(0 ${i * h})"><text x="0" y="16" class="diagram-etikett">${esc(String(r.nyckel).slice(0, 26))}</text>
      <rect x="${etikett}" y="4" width="${w}" height="${h - 8}" class="diagram-stapel"></rect>
      <text x="${etikett + w + 6}" y="16" class="diagram-varde">${typeof r.varde === 'number' ? esc(String(r.varde).replace('.', ',')) : 'dolt'}</text></g>`;
  }).join('');
  return `<figure class="diagram"><svg viewBox="0 0 ${bredd} ${rader.length * h}" role="img" aria-label="${esc(rubrik)}">${rader2}</svg><figcaption>${esc(rubrik)}</figcaption></figure>`;
}

function patientlista(g) {
  if (g.niva === 'region') {
    const tab = (rubrik, rader) => `<h4>${esc(rubrik)}</h4><table class="tabell siffertabell"><tbody>${rader.map(r => `<tr><th scope="row">${esc(r.nyckel)}</th><td class="tal">${tal(r.varde, r.dolt)}</td></tr>`).join('')}</tbody></table>`;
    return `<p><strong>${tal(g.antal, g.antalDolt)}</strong> patienter i gruppen.</p><div class="kolumner">${tab('Kön', g.perKon)}${tab('Åldersgrupp', g.perAldersgrupp)}${tab('Listning', g.perListning)}</div><p class="under-text">${esc(g.anmarkning)}</p>`;
  }
  if (!g.patienter.length) return `${tom('Ingen patient på din vårdenhet uppfyller villkoren.')}<p class="under-text">${esc(g.anmarkning)}</p>`;
  return `<p><strong>${g.antal}</strong> ${g.antal === 1 ? 'patient' : 'patienter'} på ${esc(g.vardenhet)}.</p>
    <div class="tabellrulle"><table class="tabell"><thead><tr><th scope="col">Patient</th><th scope="col">Ålder</th><th scope="col">Varför patienten är med</th></tr></thead>
    <tbody>${g.patienter.map(p => `<tr><th scope="row"><a href="#/patient/${encodeURIComponent(p.id)}">${esc(p.namn)}</a><span class="under-text">${esc(p.personnummer)}</span></th><td>${p.alder} år</td><td>${esc(p.skal.join('. '))}.</td></tr>`).join('')}</tbody></table></div>
    <p class="under-text">${esc(g.anmarkning)}</p>`;
}

function statistikUt(s) {
  return `<h3>${esc(s.rubrik)}, ${esc(s.vardenhet)}</h3>
    <p class="under-text">Period ${esc(s.period.fran)} till ${esc(s.period.till)}, per ${esc(s.gruppRubrik.toLowerCase())}.${s.patientgrupp ? ` ${esc(s.patientgrupp)}` : ''}</p>
    ${diagram(s.rader, `${s.rubrik} per ${s.gruppRubrik.toLowerCase()}`)}
    <div class="tabellrulle"><table class="tabell siffertabell"><thead><tr><th scope="col">${esc(s.gruppRubrik)}</th><th scope="col" class="tal">${esc(s.enhet)}</th></tr></thead>
    <tbody>${s.rader.map(r => `<tr><th scope="row">${esc(r.nyckel)}</th><td class="tal">${tal(r.varde, r.dolt)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th scope="row">Totalt</th><td class="tal">${tal(s.summa, s.summa == null)}</td></tr></tfoot></table></div>
    <p class="under-text">${esc(s.anmarkning)}</p>`;
}

function insatsKort(i) {
  return `<article class="ruta">
    <h3>${esc(i.namn)}</h3>
    <p>${esc(i.sammanfattning ?? '')}</p>
    <dl class="faktarad"><div><dt>Startad</dt><dd>${esc(datum(i.startad))}</dd></div><div><dt>Utvärderas</dt><dd>${esc(datum(i.utvarderas))}</dd></div>
      <div><dt>Mål</dt><dd>${i.malAndel} procent får stöd</dd></div>${i.avslutad ? `<div><dt>Avslutad</dt><dd>${esc(datum(i.avslutad))}</dd></div>` : ''}</dl>
    ${i.vantar != null ? `<div class="knapprad"><button type="button" class="knapp sekundar liten" data-insats="${i.id}">Visa patienterna</button></div><div data-insats-lista="${i.id}"></div>` : `<p>Antal i riskgruppen: ${tal(i.antal, i.antal == null)}</p>`}
  </article>`;
}

export async function visa(main) {
  main.innerHTML = vyRubrik('Analys och statistik', 'Patientgrupper, statistik, folkhälsoinsatser och ledtider. Systemet räknar bara på det du får se och visar inga personuppgifter i statistiken.') + '<div id="an"><p class="tom">Hämtar.</p></div>';
  const o = await api('/api/analys');
  const el = main.querySelector('#an');
  const mallar = o.mallgrupper.map(m => [m.id, m.namn]);
  const urvalGrupp = o.urval.filter(u => u.slag === 'grupp');
  const gruppVal = [['', 'Ingen patientgrupp'], ...mallar.map(([id, n]) => [`mall:${id}`, n]), ...urvalGrupp.map(u => [`urval:${u.id}`, `${u.namn} (sparad${u.egen ? '' : `, av ${u.agare}`})`])];
  const folk = pa('patientgrupp', 'statistik_region');
  el.innerHTML = `
    ${o.kanGruppera ? `<section aria-labelledby="an-grupp" class="ruta"><h2 id="an-grupp">Patientgrupper</h2>
      <form data-grupp>
        ${falt({ namn: 'grupp', etikett: 'Grupp', alternativ: [...mallar.map(([id, n]) => [`mall:${id}`, n]), ...urvalGrupp.map(u => [`urval:${u.id}`, `${u.namn} (sparad)`])] })}
        <div class="knapprad"><button type="submit" class="knapp">Visa gruppen</button>${o.niva === 'enhet' ? '<button type="button" class="knapp sekundar" data-spara-grupp>Spara som eget urval</button>' : ''}</div>
      </form>
      <p class="under-text" data-grupp-text></p>
      <div data-grupp-ut aria-live="polite"></div></section>` : ''}
    ${o.kanStatistik ? `<section aria-labelledby="an-stat" class="ruta"><h2 id="an-stat">Statistik</h2>
      <form data-stat>
        <div class="kolumner">
        ${falt({ namn: 'matt', etikett: 'Mått', alternativ: o.matt.map(m => [m.id, m.namn]) })}
        ${falt({ namn: 'grupp', etikett: 'Per', alternativ: o.matt[0].grupper.map(g => [g.id, g.namn]) })}
        ${o.niva === 'region' ? falt({ namn: 'vardenhet', etikett: 'Vårdenhet', alternativ: [['', 'Hela vårdgivaren'], ...o.vardenheter.map(v => [v.id, v.namn])] }) : ''}
        ${falt({ namn: 'patientgrupp', etikett: 'Patientgrupp', alternativ: gruppVal })}
        ${falt({ namn: 'fran', etikett: 'Från', typ: 'date' })}
        ${falt({ namn: 'till', etikett: 'Till', typ: 'date' })}
        </div>
        <div class="knapprad"><button type="submit" class="knapp">Visa statistiken</button><button type="button" class="knapp sekundar" data-spara-stat>Spara och dela resultatet</button></div>
      </form>
      <div data-stat-ut aria-live="polite"></div>
      ${o.resultat.length ? `<h3>Sparade resultat</h3><ul>${o.resultat.map(r => `<li><button type="button" class="knapp text liten" data-resultat="${r.id}">${esc(r.namn)}</button> <span class="under-text">${esc(tidpunkt(r.tid))}${r.delad ? ', delat' : ''}</span></li>`).join('')}</ul>` : ''}
    </section>` : ''}
    ${folk ? '<section aria-labelledby="an-folk" class="ruta"><h2 id="an-folk">Folkhälsoinsatser</h2><div data-folk><p class="tom">Hämtar.</p></div></section>' : ''}
    ${o.kanStatistik ? '<section aria-labelledby="an-sub" class="ruta"><h2 id="an-sub">Subprocesser och ledtider</h2><div data-sub><p class="tom">Hämtar.</p></div></section>' : ''}`;

  const valtVillkor = (v) => (v.startsWith('mall:') ? { mall: v.slice(5) } : v.startsWith('urval:') ? { urvalId: Number(v.slice(6)) } : {});
  const gform = el.querySelector('[data-grupp]');
  const visaGrupp = async (knapp) => {
    const v = new FormData(gform).get('grupp');
    const g = await medKnapp(knapp, () => api('/api/analys/grupp', { metod: 'POST', data: valtVillkor(v) }));
    el.querySelector('[data-grupp-text]').textContent = g.text;
    el.querySelector('[data-grupp-ut]').innerHTML = patientlista(g);
  };
  gform?.addEventListener('submit', (e) => { e.preventDefault(); visaGrupp(gform.querySelector('[type=submit]')).catch(felNotis); });
  el.querySelector('[data-spara-grupp]')?.addEventListener('click', async (e) => {
    const v = new FormData(gform).get('grupp');
    const m = o.mallgrupper.find(x => `mall:${x.id}` === v);
    if (!m) { notis('Välj en färdig grupp att spara som eget urval.', 'info'); return; }
    try {
      await medKnapp(e.currentTarget, () => api('/api/analys/urval', { metod: 'POST', data: { namn: m.namn, slag: 'grupp', villkor: m.villkor, delad: true } }));
      notis('Urvalet är sparat och delat med din vårdenhet.');
    } catch (x) { felNotis(x); }
  });

  const sform = el.querySelector('[data-stat]');
  const mattVal = sform?.querySelector('[name=matt]');
  mattVal?.addEventListener('change', () => {
    const m = o.matt.find(x => x.id === mattVal.value);
    sform.querySelector('[name=grupp]').innerHTML = m.grupper.map(g => `<option value="${esc(g.id)}">${esc(g.namn)}</option>`).join('');
  });
  const fraga = () => {
    const f = new FormData(sform);
    const d = { matt: f.get('matt'), grupp: f.get('grupp'), ...valtVillkor(f.get('patientgrupp') || '') };
    if (f.get('vardenhet')) d.vardenhet = f.get('vardenhet');
    if (f.get('fran') || f.get('till')) d.period = { fran: f.get('fran') || undefined, till: f.get('till') || undefined };
    return d;
  };
  sform?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { el.querySelector('[data-stat-ut]').innerHTML = statistikUt(await medKnapp(sform.querySelector('[type=submit]'), () => api('/api/analys/statistik', { metod: 'POST', data: fraga() }))); } catch (x) { felNotis(x); }
  });
  el.querySelector('[data-spara-stat]')?.addEventListener('click', async (e) => {
    try {
      const d = fraga();
      const m = o.matt.find(x => x.id === d.matt);
      const s = await medKnapp(e.currentTarget, () => api('/api/analys/statistik', { metod: 'POST', data: { ...d, spara: { namn: `${m.namn} ${new Date().toLocaleDateString('sv-SE')}`, delad: true } } }));
      el.querySelector('[data-stat-ut]').innerHTML = statistikUt(s);
      notis('Resultatet är sparat och delat.');
    } catch (x) { felNotis(x); }
  });
  el.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-resultat]');
    if (r) { try { el.querySelector('[data-stat-ut]').innerHTML = statistikUt((await api(`/api/analys/resultat/${r.dataset.resultat}`)).resultat); } catch (x) { felNotis(x); } }
    const i = e.target.closest('[data-insats]');
    if (i) {
      try {
        const d = await api(`/api/folkhalsa/insatser/${i.dataset.insats}`);
        el.querySelector(`[data-insats-lista="${i.dataset.insats}"]`).innerHTML = d.patienter.length ? `<table class="tabell"><thead><tr><th scope="col">Patient</th><th scope="col">Status</th><th scope="col">Systemets förslag</th></tr></thead><tbody>${d.patienter.map(p => `<tr><th scope="row"><a href="#/patient/${encodeURIComponent(p.id)}">${esc(p.namn)}</a></th><td>${esc(p.statusText)}${p.stod ? `<span class="under-text">${esc(p.stod.text)} ${esc(datum(p.stod.tid))}</span>` : ''}</td><td>${esc(p.rekommendation ?? '')}</td></tr>`).join('')}</tbody></table>` : tom('Inga patienter som du får se.');
      } catch (x) { felNotis(x); }
    }
  });

  if (folk) {
    const f = await api('/api/folkhalsa');
    el.querySelector('[data-folk]').innerHTML = `${f.niva === 'enhet' ? `<form data-ny-insats class="knapprad">${falt({ namn: 'omrade', etikett: 'Starta en insats för', alternativ: f.omraden.map(x => [x.id, x.risk]) })}<button type="submit" class="knapp">Starta insatsen</button></form>
      <p class="under-text">Systemet tar riskgruppen ur din vårdenhets patienter, föreslår stödet med KVÅ-kod för varje patient och följer upp hur många som har fått stöd.</p>` : `<p class="under-text">${esc(f.anmarkning)}</p>`}
      ${f.insatser.length ? f.insatser.map(insatsKort).join('') : tom('Inga insatser.')}`;
    el.querySelector('[data-ny-insats]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const n = await medKnapp(e.currentTarget.querySelector('[type=submit]'), () => api('/api/folkhalsa/insatser', { metod: 'POST', data: { omrade: new FormData(e.currentTarget).get('omrade') } }));
        notis(`Insatsen ${n.namn} är startad med ${n.antal} patienter.`);
        visa(main);
      } catch (x) { felNotis(x); }
    });
  }
  if (o.kanStatistik) {
    const s = await api('/api/sparbarhet/subprocesser');
    el.querySelector('[data-sub]').innerHTML = `<p class="under-text">${esc(s.vardenhet)}, de senaste ${s.dagar} dagarna. ${esc(s.anmarkning)}</p>
      <div class="tabellrulle"><table class="tabell siffertabell"><thead><tr><th scope="col">Subprocess och steg</th><th scope="col" class="tal">Antal</th><th scope="col" class="tal">Median</th><th scope="col" class="tal">Inom målet</th></tr></thead>
      <tbody>${s.subprocesser.map(p => `<tr><th scope="row">${esc(p.namn)}<span class="under-text">Mål: ${esc(p.malText.toLowerCase())}</span></th><td class="tal">${tal(p.antal, p.antal == null)}</td><td class="tal">${p.median == null ? '' : `${tal(p.median)} ${esc(p.enhet)}`}</td><td class="tal">${p.andelInomMal == null ? '' : `${p.andelInomMal} procent`}</td></tr>
        ${p.steg.map(st => `<tr><td>${esc(st.namn)}</td><td class="tal">${tal(st.antal, st.antal == null)}</td><td class="tal">${st.median == null ? '' : `${tal(st.median)} ${esc(p.enhet)}`}</td><td></td></tr>`).join('')}`).join('')}</tbody></table></div>`;
  }
}
