// Bokning, del 3 (runda 8, r3): fri bokning, teambesök och att lägga till patienter i en gruppträff. Dialogerna börjar med
// patienten: sökfältet har fokus och Enter söker. Finns bara en träff med vårdrelation väljer systemet den. Sedan visar
// systemet sitt val och de lämpligaste tiderna, och ett klick bokar.
import { esc, api, notis, felNotis, dialog, ikon } from './ui.js';
import { tidText, kl } from './tidbok-ui.js';

const sokHtml = (rubrik, text) => `<h2 id="dlg-rubrik">${esc(rubrik)}</h2>
  <div class="dialog-text"><p>${esc(text)}</p></div>
  <div class="r8-sok"><label for="r8-sok">Patient (namn eller personnummer)</label>
    <div class="r8-sokrad"><input id="r8-sok" type="search" autocomplete="off" autofocus><button type="button" class="knapp liten sekundar" id="r8-sokknapp">Sök</button></div></div>
  <div id="r8-traffar" aria-live="polite"></div><div id="r8-innehall"></div><p class="r8-besked ruta ruta-info" role="status" hidden></p>`;

const traffHtml = (p) => `<li><button type="button" class="knapp liten sekundar r8-traff" data-r8-patient="${esc(p.id)}"${p.vardrelation ? '' : ' disabled'}>
  ${esc(p.namn)}, ${esc(p.personnummer)}</button>${p.vardrelation ? '' : '<span class="under-text">Ingen vårdrelation här. Boka efter en remiss eller när patienten har sökt vård här.</span>'}</li>`;

// Kopplar sökningen i dialogen. valj(patient) anropas när användaren väljer en träff, eller av systemet vid en enda
// träff med vårdrelation om auto är sant.
function kopplaSok(dl, valj, { auto = true } = {}) {
  const falt = dl.querySelector('#r8-sok');
  const traffar = dl.querySelector('#r8-traffar');
  let senaste = [];
  const sok = async () => {
    const q = falt.value.trim();
    if (q.length < 2) { traffar.innerHTML = '<p class="dampad liten">Skriv minst två tecken.</p>'; return; }
    try {
      senaste = await api(`/api/sok?q=${encodeURIComponent(q)}`);
      const med = senaste.filter(p => p.vardrelation);
      if (auto && med.length === 1 && senaste.length === 1) { traffar.innerHTML = ''; await valj(med[0]); return; }
      traffar.innerHTML = senaste.length ? `<ul class="enkel-lista r8-traffar">${senaste.map(traffHtml).join('')}</ul>` : '<p class="dampad liten">Ingen patient hittades.</p>';
    } catch (e) { felNotis(e); }
  };
  falt.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sok(); } });
  dl.querySelector('#r8-sokknapp').addEventListener('click', sok);
  traffar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-r8-patient]');
    if (!b || b.disabled) return;
    const p = senaste.find(x => x.id === b.dataset.r8Patient);
    if (p) await valj(p);
  });
  return { rensa: () => { falt.value = ''; traffar.innerHTML = ''; falt.focus(); } };
}

const forslagHtml = (f, i, varde) => `<li><button type="button" class="forslag-knapp${i === 0 ? ' forst' : ''}" data-varde="${esc(varde)}">
  <span class="forslag-tid">${ikon.klocka}<strong>${esc(tidText(f.start))}</strong></span>
  <span class="forslag-vem">${f.deltagare ? `Teambesök, ${esc(f.minuter)} minuter, med ${esc(f.deltagare.map(d => `${d.yrkesrollText} ${d.namn}`).join(' och '))}` : `${esc(f.tidstypText)} hos ${esc(f.vardgivare?.namn ?? '')}`}${f.mottagning ? `, ${esc(f.mottagning.namn)}` : ''}</span>
  ${f.resurser?.length ? `<span class="forslag-resurser">Bokas samtidigt: ${esc(f.resurser.map(r => r.namn).join(', '))}</span>` : ''}
  ${f.skal?.length ? `<span class="forslag-skal">${esc(f.skal.join(' '))}</span>` : ''}
  <span class="forslag-valj">Boka</span></button></li>`;
const ingaTider = '<p class="ruta ruta-info">Det finns ingen ledig tid som passar. Välj något annat ovan, eller lägg en bevakning.</p>';

// Fri bokning (testfall 5.1). Returnerar bokningen eller null.
export async function bokaFri() {
  let patient = null;
  let f = null;
  const svar = await dialog(sokHtml('Boka besök', 'Sök patienten. Systemet väljer besökstyp, vårdgivare och de lämpligaste tiderna, och skickar kallelsen när tiden är bokad.'), {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      const ruta = dl.querySelector('#r8-innehall');
      const hamta = async (q = '') => {
        f = await api(`/api/patient/${encodeURIComponent(patient.id)}/boka-fri/forslag${q}`);
        ruta.innerHTML = `<p><strong>${esc(f.patient.namn)}</strong>, ${esc(f.patient.personnummer)}. ${esc(f.skal.join(' '))}</p>
          <div class="r8-val">
            <label>Besökstyp <select id="r8-tidstyp">${f.alternativ.tidstyper.map(t => `<option value="${esc(t.id)}"${t.id === f.val.tidstyp ? ' selected' : ''}>${esc(t.text)}</option>`).join('')}</select></label>
            <label>Vårdgivare <select id="r8-vg"><option value="">Systemet väljer</option>${f.alternativ.vardgivare.map(v => `<option value="${esc(v.id)}"${v.id === f.val.personalId ? ' selected' : ''}>${esc(v.namn)}, ${esc(v.yrkesrollText)}</option>`).join('')}</select></label>
          </div>
          ${f.forslag.length ? `<ol class="forslag-lista">${f.forslag.map((x, i) => forslagHtml(x, i, `tid:${x.tidId}`)).join('')}</ol>` : ingaTider}
          <p class="hjalp">${esc(f.demoregler)}</p>`;
      };
      kopplaSok(dl, async (p) => { patient = p; try { await hamta(); } catch (e) { felNotis(e); } });
      ruta.addEventListener('change', async () => {
        const t = ruta.querySelector('#r8-tidstyp').value;
        const v = ruta.querySelector('#r8-vg').value;
        try { await hamta(`?tidstyp=${encodeURIComponent(t)}${v ? `&personalId=${encodeURIComponent(v)}` : ''}`); } catch (e) { felNotis(e); }
      });
    },
  });
  if (!svar?.val?.startsWith('tid:') || !patient) return null;
  const r = await api(`/api/patient/${encodeURIComponent(patient.id)}/boka-fri`, { metod: 'POST', data: { tidId: Number(svar.val.slice(4)) } });
  notis(`${f.patient.namn} har fått en tid ${tidText(r.tid.start)}.${r.resurser?.length ? ` ${r.resurser.map(x => x.namn).join(', ')} är bokade samtidigt.` : ''} ${r.kallelseBesked ?? ''}`.trim());
  return r;
}

// Teambesök (testfall 5.2). Returnerar bokningen eller null.
export async function bokaTeam() {
  let patient = null;
  let f = null;
  const svar = await dialog(sokHtml('Boka teambesök', 'Sök patienten. Systemet väljer teamet och hittar tider då alla och ett rum är lediga hela besöket.'), {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      const ruta = dl.querySelector('#r8-innehall');
      const ritaForslag = () => {
        dl.querySelector('#r8-teamforslag').innerHTML = f.forslag.length ? `<ol class="forslag-lista">${f.forslag.map((x, i) => forslagHtml(x, i, `team:${i}`)).join('')}</ol>` : ingaTider;
      };
      const hamta = async (personal = null) => {
        f = await api(`/api/patient/${encodeURIComponent(patient.id)}/teambesok/forslag${personal ? `?personal=${encodeURIComponent(personal.join(','))}` : ''}`);
        if (!ruta.querySelector('#r8-team')) {
          ruta.innerHTML = `<p><strong>${esc(f.patient.namn)}</strong>, ${esc(f.patient.personnummer)}. ${esc(f.skal.join(' '))}</p>
            <fieldset id="r8-team" class="r8-team"><legend>Teamet</legend>${f.vardgivare.map(v => `<label><input type="checkbox" name="r8-team" value="${esc(v.id)}"${f.valda.includes(v.id) ? ' checked' : ''}> ${esc(v.namn)}, ${esc(v.yrkesrollText)}</label>`).join('')}</fieldset>
            <div id="r8-teamforslag"></div><p class="hjalp">${esc(f.demoregler)}</p>`;
        }
        ritaForslag();
      };
      kopplaSok(dl, async (p) => { patient = p; try { await hamta(); } catch (e) { felNotis(e); } });
      ruta.addEventListener('change', async () => {
        const valda = [...ruta.querySelectorAll('input[name="r8-team"]:checked')].map(x => x.value);
        if (valda.length < 2) { dl.querySelector('#r8-teamforslag').innerHTML = '<p class="ruta ruta-info">Ett teambesök har minst två vårdgivare. Välj en till.</p>'; return; }
        try { await hamta(valda); } catch (e) { felNotis(e); }
      });
    },
  });
  if (!svar?.val?.startsWith('team:') || !patient) return null;
  const x = f.forslag[Number(svar.val.slice(5))];
  const r = await api(`/api/patient/${encodeURIComponent(patient.id)}/teambesok`, { metod: 'POST', data: { personal: x.deltagare.map(d => d.id), start: x.start } });
  notis(`${f.patient.namn} har fått ett teambesök ${tidText(r.tid.start)} med ${r.deltagare.map(d => d.namn).join(' och ')}.${r.resurser?.length ? ` ${r.resurser.map(y => y.namn).join(', ')} är bokat.` : ''} ${r.kallelseBesked ?? ''}`.trim());
  return r;
}

// Lägga till patienter i en gruppträff (testfall 5.3). Dialogen står kvar, så att flera patienter läggs till i följd.
export async function laggTillIGrupp(g) {
  let tillagda = 0;
  await dialog(`${sokHtml(`Lägg till patienter i ${g.tid.rubrik ?? 'gruppträffen'}`, `${tidText(g.tid.start)}, ${g.tid.vardgivare?.namn ?? ''}. Sök en patient och välj träffen. Systemet bokar platsen och skriver kallelsen, och när träffen är full hamnar patienten på gruppens väntelista.`)}
    <p class="r8-platser"><strong id="r8-kvar">${esc(g.kvar)}</strong> av ${esc(g.platser)} platser kvar.</p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Klar</button></div>`, {
    klass: 'dialog-bred',
    onOpen: (dl) => {
      const besked = dl.querySelector('.r8-besked');
      const s = kopplaSok(dl, async (p) => {
        try {
          const r = await api(`/api/tid/${g.tid.id}/grupp`, { metod: 'POST', data: { patientId: p.id } });
          tillagda++;
          besked.textContent = r.text;
          besked.hidden = false;
          if (typeof r.kvar === 'number') dl.querySelector('#r8-kvar').textContent = r.kvar;
          notis(r.text);
          s.rensa();
        } catch (e) { felNotis(e); }
      }, { auto: false });
    },
  });
  return tillagda;
}

// Ger en ledig plats till den som systemet föreslår från gruppens väntelista.
export async function gePlats(vantelistaId) {
  const r = await api(`/api/gruppvantelista/${vantelistaId}/plats`, { metod: 'POST', data: {} });
  notis(r.text);
  return r;
}

// Gruppträffarna i Dagens arbete: platser kvar, väntande och nästa steg.
export const grupperHtml = (grupper) => `<ul class="enkel-lista idag-lista r8-grupper">${grupper.map((g, i) => `<li>
  <strong>${esc(g.tid.rubrik ?? 'Gruppträff')}</strong>, ${esc(tidText(g.tid.start))}, ${esc(g.tid.vardgivare?.namn ?? '')}
  <span class="under-text">${g.full ? 'Full' : `${esc(g.kvar)} av ${esc(g.platser)} platser kvar`}${g.vantar.length ? `. ${esc(g.vantar.length)} på gruppens väntelista` : ''}.${g.deltagare.length ? ` Deltagare: ${esc(g.deltagare.map(d => d.namn).join(', '))}.` : ''}</span>
  ${g.forslag ? `<span class="under-text">${esc(g.forslag.text)}</span>` : ''}
  <span class="knapprad tat"><button type="button" class="knapp liten" data-atgard="r8_grupp" data-grupp="${i}">Lägg till patient</button>${g.forslag ? `<button type="button" class="knapp liten sekundar" data-atgard="r8_plats" data-gvl="${esc(g.forslag.vantelistaId)}">Ge platsen</button>` : ''}</span></li>`).join('')}</ul>`;
export { kl };
