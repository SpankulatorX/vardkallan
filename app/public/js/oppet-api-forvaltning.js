// Runda 9, r6: sidan Öppet API för utvecklare och förvaltning (Sussa 2.5.1.1 till 2.5.1.3 och 2.6.1.2). Ändringsloggen,
// hur en tillämpning byggs och prövas, ärenden mellan kund och utvecklare, och för systemförvaltaren registrering av
// tillämpningar och godkännande av mottagare. Systemet föreslår behörigheten och texten om vad en tillämpning får ur
// omfånget, och förklarar varför något inte går.
import { esc, api, datum, tidpunkt, notis, medKnapp, dialog, falt } from './ui.js';

const RESURSER = [['Patient', 'Namn och personnummer'], ['Observation', 'Mätvärden'], ['Condition', 'Diagnoser'], ['MedicationRequest', 'Läkemedel'],
  ['AllergyIntolerance', 'Överkänslighet'], ['Composition', 'Anteckningar'], ['ServiceRequest', 'Remisser'], ['Encounter', 'Vårdkontakter']];

export async function ritaAndringslogg(el) {
  const d = await api('/api/oppet-api/andringar', { tyst: true });
  el.innerHTML = `<p class="under-text">Version ${esc(d.version)}. Varje resurstyp och skrivning i CapabilityStatement har en rad här, och bygget stoppas om de inte stämmer.</p>
    <ol class="api-andringar">${d.andringar.map(a => `<li><strong>${esc(a.version)}</strong> <span class="dampad">${esc(datum(a.datum))}</span><br>${esc(a.text)}
      ${a.resurser.length ? `<br><span class="under-text">Nya resurstyper: ${a.resurser.map(esc).join(', ')}</span>` : ''}
      ${a.skrivning.length ? `<br><span class="under-text">Skrivning: ${a.skrivning.map(s => esc(s.replace(':', ' '))).join(', ')}</span>` : ''}</li>`).join('')}</ol>`;
}

export function utvecklare() {
  return `<p>En tillämpning byggs i valfritt programmeringsspråk med FHIR R4 och SMART on FHIR. Plattformen sköter inloggning, patientkontext, behörighet och loggning, så tillämpningen får aldrig se mer än den som startar den.</p>
    <ul class="api-lankar">
      <li><a href="/fhir/metadata">CapabilityStatement</a>: alla resurstyper, sökningar och skrivningar.</li>
      <li><a href="/fhir/.well-known/smart-configuration">SMART-konfigurationen</a>: adresserna för inloggning och åtkomstbiljett.</li>
      <li><a href="/tillampningar/blodtryck/index.html">Blodtryck över tid</a>: en liten exempeltillämpning med öppen källkod som visar hela flödet.</li>
      <li><a href="https://github.com/SpankulatorX/vardkallan">Källkoden på GitHub</a> under EUPL 1.2, där innovationer också kan delas.</li>
    </ul>
    <p>Testdata och sandlåda: varje besökare i demon får en egen sandlåda med påhittade patienter och Skatteverkets testpersonnummer. Allt som görs där stannar i sandlådan och försvinner efter åtta timmar, så en tillämpning kan prövas fritt. Systemförvaltaren registrerar tillämpningen nedan, och den syns sedan under Tillämpningar i journalen för de roller som får använda den.</p>`;
}

const status = (s) => `<span class="tagg">${esc(s)}</span>`;
function arendeRad(a) {
  return `<li class="api-arende" data-arende="${a.id}"><div><strong>${esc(a.rubrik)}</strong> ${status(a.statusText)}${a.version ? ` <span class="dampad">version ${esc(a.version)}</span>` : ''}</div>
    <p class="under-text">${esc(a.typText)}. ${esc(a.skapadAv ?? '')}, ${esc(tidpunkt(a.skapad))}.${a.resurstyp ? ` Gäller ${esc(a.resurstyp)}.` : ''}${a.tjanstekontrakt ? ` Tjänstekontrakt: ${esc(a.tjanstekontrakt)}.` : ''}</p>
    <p>${esc(a.text)}</p>${a.beslut ? `<p class="under-text">Bedömning: ${esc(a.beslut)}</p>` : ''}
    ${a.svar.length ? `<ul class="api-svar-lista">${a.svar.map(s => `<li><span class="dampad">${esc(s.av ?? 'Systemet')}, ${esc(tidpunkt(s.tid))}:</span> ${esc(s.text)}</li>`).join('')}</ul>` : ''}
    <div class="knapprad"><button type="button" class="knapp liten sekundar" data-svara="${a.id}">Svara</button>${a.nasta.map(n => `<button type="button" class="knapp liten sekundar" data-steg="${a.id}" data-status="${esc(n)}">${esc({ bedomd: 'Bedöm', planerad: 'Planera', levererad: 'Levererad', avslag: 'Avslå', besvarad: 'Besvarad' }[n] ?? n)}</button>`).join('')}</div></li>`;
}

function tillampningRad(t, forvaltare) {
  return `<li><strong>${esc(t.namn)}</strong>${t.aterkallad ? ` ${status('Återkallad')}` : t.fast ? ` ${status('Demons egen')}` : ''}
    <p class="under-text">${esc(t.beskrivning)} Får: ${esc(t.far)}</p><p class="under-text"><code>${esc(t.omfang.join(' '))}</code></p>
    ${forvaltare && !t.fast && !t.aterkallad ? `<button type="button" class="knapp liten sekundar" data-aterkalla-t="${esc(t.id)}">Återkalla</button>` : ''}</li>`;
}
function mottagareRad(m, forvaltare) {
  return `<li><code>${esc(m.adress)}</code>${m.aterkallad ? ` ${status('Återkallad')}` : ''}<p class="under-text">${esc(m.syfte)}</p>
    ${forvaltare && !m.fast && !m.aterkallad ? `<button type="button" class="knapp liten sekundar" data-aterkalla-m="${m.id}">Återkalla</button>` : ''}</li>`;
}

async function fraga(rubrik, faltHtml, knapp) {
  return dialog(`<form><h2 id="dlg-rubrik">${esc(rubrik)}</h2>${faltHtml}<p class="dialog-fel ruta ruta-larm" hidden></p>
    <div class="knapprad"><button type="button" class="knapp" data-varde="ok">${esc(knapp)}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`);
}

export async function ritaForvaltning(el) {
  let d;
  try { d = await api('/api/oppet-api/forvaltning', { tyst: true }); } catch {
    el.innerHTML = '<p class="tom">Logga in för att se ärenden, tillämpningar och mottagare.</p>';
    return;
  }
  const f = d.forvaltare;
  el.innerHTML = `<section aria-labelledby="api-arenden-rubrik"><h3 id="api-arenden-rubrik">Ärenden om API:t</h3>
      <p class="under-text">Saknas en informationsmängd, ett attribut eller en mappning mot ett tjänstekontrakt, eller har du en fråga eller har hittat ett fel? Skriv ett ärende. Systemförvaltaren bedömer det och planerar ändringen till en version i ändringsloggen. Skriv inga patientuppgifter.</p>
      <button type="button" class="knapp" data-nytt-arende>Nytt ärende</button>
      ${d.arenden.length ? `<ul class="api-arenden">${d.arenden.map(arendeRad).join('')}</ul>` : '<p class="tom">Inga ärenden ännu.</p>'}</section>
    <section aria-labelledby="api-till-rubrik"><h3 id="api-till-rubrik">Registrerade tillämpningar</h3>
      ${f ? '<button type="button" class="knapp" data-ny-tillampning>Registrera en tillämpning</button>' : ''}
      <ul class="api-lista">${d.tillampningar.map(t => tillampningRad(t, f)).join('')}</ul></section>
    <section aria-labelledby="api-mott-rubrik"><h3 id="api-mott-rubrik">Godkända mottagare för prenumerationer</h3>
      <p class="under-text">Meddelanden om ändringar skickas bara till de här adresserna, och bara med id.</p>
      ${f ? '<button type="button" class="knapp" data-ny-mottagare>Godkänn en mottagare</button>' : ''}
      <ul class="api-lista">${d.mottagare.map(m => mottagareRad(m, f)).join('')}</ul></section>`;
  const igen = () => ritaForvaltning(el);
  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.matches('[data-nytt-arende]')) {
        const svar = await fraga('Nytt ärende om API:t', falt({ namn: 'typ', etikett: 'Vad gäller det?', alternativ: Object.entries(d.arendetyper) })
          + falt({ namn: 'rubrik', etikett: 'Rubrik', obligatorisk: true, attr: 'maxlength="120"' })
          + falt({ namn: 'text', etikett: 'Beskrivning', typ: 'textarea', obligatorisk: true, attr: 'maxlength="2000"', hjalp: 'Vilken information eller vilket attribut saknas, och vad ska det användas till? Inga patientuppgifter.' })
          + falt({ namn: 'resurstyp', etikett: 'Resurstyp i FHIR, om du vet', alternativ: [['', 'Vet inte'], ...RESURSER.map(([t, n]) => [t, `${n} (${t})`]), ['QuestionnaireResponse', 'Formulärsvar (QuestionnaireResponse)'], ['Procedure', 'Åtgärder (Procedure)']] })
          + falt({ namn: 'tjanstekontrakt', etikett: 'Nationellt tjänstekontrakt, om det gäller ett', attr: 'maxlength="120"' }), 'Skicka');
        if (!svar) return;
        const a = await api('/api/oppet-api/arenden', { metod: 'POST', data: { ...svar.data, resurstyp: svar.data.resurstyp || null } });
        notis(a.svar.length ? 'Ärendet är skickat. Systemet har svarat direkt, eftersom informationen redan finns.' : 'Ärendet är skickat till systemförvaltaren.');
        return igen();
      }
      if (b.dataset.svara) {
        const svar = await fraga('Svara på ärendet', falt({ namn: 'text', etikett: 'Svar', typ: 'textarea', obligatorisk: true, attr: 'maxlength="2000"' }), 'Skicka');
        if (!svar) return;
        await medKnapp(b, () => api(`/api/oppet-api/arenden/${b.dataset.svara}/svar`, { metod: 'POST', data: svar.data }));
        return igen();
      }
      if (b.dataset.steg) {
        const st = b.dataset.status;
        const behoverVersion = st === 'planerad' || st === 'levererad';
        const svar = await fraga('För ärendet vidare', (behoverVersion ? falt({ namn: 'version', etikett: 'Version', obligatorisk: true, attr: 'inputmode="decimal" maxlength="20"', hjalp: st === 'levererad' ? 'Versionen ska finnas i ändringsloggen.' : 'Versionen som ändringen planeras till, till exempel 1.0.0.' }) : '')
          + falt({ namn: 'beslut', etikett: st === 'avslag' ? 'Motivering' : 'Bedömning eller svar', typ: 'textarea', obligatorisk: ['avslag', 'bedomd', 'besvarad'].includes(st), attr: 'maxlength="1000"' }), 'Spara');
        if (!svar) return;
        await medKnapp(b, () => api(`/api/oppet-api/arenden/${b.dataset.steg}/status`, { metod: 'POST', data: { status: st, ...svar.data } }));
        return igen();
      }
      if (b.matches('[data-ny-tillampning]')) {
        let valda = [];
        const svar = await dialog(`<form><h2 id="dlg-rubrik">Registrera en tillämpning</h2>
          ${falt({ namn: 'namn', etikett: 'Namn', obligatorisk: true, attr: 'maxlength="80"' })}
          ${falt({ namn: 'beskrivning', etikett: 'Vad gör tillämpningen?', typ: 'textarea', obligatorisk: true, attr: 'maxlength="500"' })}
          ${falt({ namn: 'adress', etikett: 'Adress', obligatorisk: true, varde: '/tillampningar/blodtryck/index.html', hjalp: 'En sökväg på samma server eller en https-adress.' })}
          <fieldset class="falt"><legend>Vad ska tillämpningen läsa?</legend>${RESURSER.map(([t, n]) => `<label class="val"><input type="checkbox" name="las" value="${t}"${t === 'Patient' ? ' checked' : ''}> ${esc(n)}</label>`).join('')}</fieldset>
          <div data-forhand class="ruta liten" role="status"></div><p class="dialog-fel ruta ruta-larm" hidden></p>
          <div class="knapprad"><button type="button" class="knapp" data-varde="ok">Registrera</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div></form>`, {
          validera: (_, dl) => {
            valda = [...dl.querySelectorAll('input[name=las]:checked')].map(x => x.value);
            return valda.length ? null : 'Välj minst en uppgift som tillämpningen ska läsa.';
          },
          onOpen: (dl) => {
            const visa = async () => {
              const omfang = [...dl.querySelectorAll('input[name=las]:checked')].map(x => `patient/${x.value}.read`).join(' ');
              const ruta = dl.querySelector('[data-forhand]');
              try { const p = await api('/api/oppet-api/tillampningar/forslag', { metod: 'POST', data: { omfang }, tyst: true }); ruta.textContent = `Tillämpningen får: ${p.far}`; } catch (x) { ruta.textContent = x.message; }
            };
            dl.addEventListener('change', visa);
            visa();
          },
        });
        if (!svar) return;
        const t = await api('/api/oppet-api/tillampningar', { metod: 'POST', data: { namn: svar.data.namn, beskrivning: svar.data.beskrivning, adress: svar.data.adress, omfang: valda.map(v => `patient/${v}.read`).join(' ') } });
        notis(`${t.namn} är registrerad. Den syns under Tillämpningar i journalen.`);
        return igen();
      }
      if (b.matches('[data-ny-mottagare]')) {
        const svar = await fraga('Godkänn en mottagare', falt({ namn: 'adress', etikett: 'Adress', obligatorisk: true, typ: 'url', hjalp: 'En https-adress med ett namn, på port 443.' })
          + falt({ namn: 'syfte', etikett: 'Vad är mottagaren?', obligatorisk: true, attr: 'maxlength="300"', hjalp: 'Till exempel det regionala vårddatalagret.' }), 'Godkänn');
        if (!svar) return;
        await api('/api/oppet-api/mottagare', { metod: 'POST', data: svar.data });
        notis('Mottagaren är godkänd.');
        return igen();
      }
      const t = b.dataset.aterkallaT;
      const m = b.dataset.aterkallaM;
      if (t || m) {
        const svar = await fraga(t ? 'Återkalla tillämpningen' : 'Återkalla mottagaren', falt({ namn: 'orsak', etikett: 'Varför?', typ: 'textarea', obligatorisk: true, attr: 'maxlength="300"', hjalp: t ? 'Tillämpningen kan inte startas efteråt, och dess åtkomstbiljetter återkallas direkt.' : 'Varje prenumeration till adressen avslutas.' }), 'Återkalla');
        if (!svar) return;
        await medKnapp(b, () => api(t ? `/api/oppet-api/tillampningar/${encodeURIComponent(t)}/aterkalla` : `/api/oppet-api/mottagare/${m}/aterkalla`, { metod: 'POST', data: svar.data }));
        return igen();
      }
    } catch { /* felet visas som notis */ }
  };
}
