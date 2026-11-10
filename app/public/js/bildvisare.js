// Bildvisaren för bilder och media (runda 11, r5, Sussa 4.2.1.2 och 4.2.1.3): uppladdning i delar, kameran och
// mikrofonen, annoteringar som ett eget lager och visaren för studier i det simulerade multimediaarkivet.
//
// Systemet är experten: servern gör miniatyren och visningsbilden och läser typen, tiden och längden ur filen. En bild
// som är större än taket förminskas här innan den skickas, och användaren får veta det. I arkivets visare är fönstret
// förvalt efter undersökningen, och en mätning räknas i millimeter ur pixelavståndet.
import { esc, api, tidpunkt, dialog, notis, medKnapp, ikon, tal } from './ui.js';

// ---- Uppladdning i delar -------------------------------------------------------------------------------------------

const base64 = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

// En bild som är större än taket förminskas till högst 2 400 pixlar som JPEG.
async function forminska(fil, maxByte) {
  const bild = await createImageBitmap(fil);
  const skala = Math.min(1, 2400 / Math.max(bild.width, bild.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bild.width * skala); c.height = Math.round(bild.height * skala);
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  for (const kvalitet of [0.88, 0.8, 0.7, 0.6]) {
    const b = await new Promise(ok => c.toBlob(ok, 'image/jpeg', kvalitet));
    if (b && b.size <= maxByte) return new File([b], fil.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  }
  return null;
}

// Skickar filen i delar och för in den i journalen. framsteg(andel) visar hur långt det har kommit.
export async function skicka(patientId, fil, meta, { granser, framsteg = () => {} } = {}) {
  let f = fil;
  let forminskad = null;
  if (f.type.startsWith('image/') && granser && f.size > granser.maxFil.bild) {
    const ny = await forminska(f, granser.maxFil.bild);
    if (!ny) throw new Error('Bilden är för stor och kunde inte förminskas.');
    forminskad = { fran: f.size, till: ny.size };
    f = ny;
  }
  const buf = new Uint8Array(await f.arrayBuffer());
  const sha256 = globalThis.crypto?.subtle ? hex(await crypto.subtle.digest('SHA-256', buf)) : undefined;
  const s = await api(`/api/patient/${encodeURIComponent(patientId)}/media/uppladdning`, { metod: 'POST', data: { namn: f.name || 'fil', storlek: buf.length, sha256, ...meta } });
  try {
    for (let i = 0; i < s.delar; i++) {
      await api(`/api/media/uppladdning/${s.id}/del`, { metod: 'POST', data: { nr: i, data: base64(buf.subarray(i * s.delstorlek, (i + 1) * s.delstorlek)) } });
      framsteg((i + 1) / s.delar);
    }
    const m = await api(`/api/media/uppladdning/${s.id}/klar`, { metod: 'POST', data: {} });
    return { ...m, forminskad };
  } catch (e) {
    api(`/api/media/uppladdning/${s.id}/avbryt`, { metod: 'POST', data: {}, tyst: true }).catch(() => {});
    throw e;
  }
}

// ---- Kameran och mikrofonen ----------------------------------------------------------------------------------------

// Dialogen med kameran: ta en bild, spela in en film eller ett ljud. Svarar med { fil, kalla, langdSek } eller null.
// Upplösningen och bithastigheten väljs så att en film på 30 sekunder ryms i taket.
export async function kamera() {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  let strom = null, inspelning = null, start = 0, resultat = null, timer = null;
  const stoppa = () => { strom?.getTracks().forEach(t => t.stop()); strom = null; clearTimeout(timer); };
  const svar = await dialog(`<form><h2 id="dlg-rubrik">Kameran och mikrofonen</h2>
      <p class="hjalp">Bilden, filmen eller ljudet knyts till patienten och vårdkontakten när du sparar. En film spelas in i högst 30 sekunder.</p>
      <video class="bm-kamera" autoplay muted playsinline aria-label="Kamerans bild"></video>
      <p class="bm-kamera-lage" role="status" aria-live="polite">Startar kameran.</p>
      <div class="knapprad">
        <button type="button" class="knapp" data-kamera="bild">Ta bild</button>
        <button type="button" class="knapp sekundar" data-kamera="film">Spela in film</button>
        <button type="button" class="knapp sekundar" data-kamera="ljud">Spela in ljud</button>
        <button type="button" class="knapp sekundar" data-kamera="stopp" hidden>Stoppa inspelningen</button>
      </div>
      <div class="knapprad"><button type="button" class="knapp" data-varde="ok" disabled>Använd</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
    </form>`, {
    onOpen: async (dl) => {
      const video = dl.querySelector('video');
      const lage = dl.querySelector('.bm-kamera-lage');
      const ok = dl.querySelector('[data-varde="ok"]');
      const stopp = dl.querySelector('[data-kamera="stopp"]');
      dl.addEventListener('close', stoppa);
      try {
        strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        video.srcObject = strom;
        lage.textContent = 'Kameran är på.';
      } catch { lage.textContent = 'Kameran gick inte att starta. Webbläsaren kan ha nekat åtkomst. Välj en fil i stället.'; }
      const spela = async (slag) => {
        const s = await navigator.mediaDevices.getUserMedia(slag === 'ljud' ? { audio: true } : { video: { facingMode: 'environment', width: { ideal: 640 } }, audio: true });
        const typ = slag === 'ljud' ? 'audio/webm' : 'video/webm';
        inspelning = new MediaRecorder(s, { mimeType: MediaRecorder.isTypeSupported(typ) ? typ : undefined, videoBitsPerSecond: 400_000, audioBitsPerSecond: 64_000 });
        const delar = [];
        inspelning.ondataavailable = (e) => { if (e.data.size) delar.push(e.data); };
        inspelning.onstop = () => {
          s.getTracks().forEach(t => t.stop());
          const blob = new Blob(delar, { type: inspelning.mimeType || typ });
          const langdSek = Math.round((performance.now() - start) / 100) / 10;
          resultat = { fil: new File([blob], `${slag === 'ljud' ? 'ljud' : 'film'}-${Date.now()}.webm`, { type: blob.type }), kalla: slag === 'ljud' ? 'mikrofon' : 'kamera', langdSek };
          lage.textContent = `${slag === 'ljud' ? 'Ljudet' : 'Filmen'} är inspelat, ${tal(langdSek, 1)} sekunder. Välj Använd för att spara.`;
          stopp.hidden = true; ok.disabled = false; ok.focus();
        };
        start = performance.now();
        inspelning.start(1000);
        stopp.hidden = false; stopp.focus();
        lage.textContent = slag === 'ljud' ? 'Spelar in ljud.' : 'Spelar in film.';
        timer = setTimeout(() => inspelning?.state === 'recording' && inspelning.stop(), 30_000);
      };
      dl.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-kamera]');
        if (!b) return;
        e.preventDefault();
        try {
          if (b.dataset.kamera === 'bild') {
            if (!video.videoWidth) return;
            const c = document.createElement('canvas');
            c.width = video.videoWidth; c.height = video.videoHeight;
            c.getContext('2d').drawImage(video, 0, 0);
            const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
            resultat = { fil: new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' }), kalla: 'kamera' };
            lage.textContent = 'Bilden är tagen. Välj Använd för att spara den.';
            ok.disabled = false; ok.focus();
          } else if (b.dataset.kamera === 'stopp') inspelning?.stop();
          else await spela(b.dataset.kamera);
        } catch { lage.textContent = 'Inspelningen gick inte att starta. Webbläsaren kan ha nekat åtkomst till mikrofonen.'; }
      });
    },
  });
  stoppa();
  return svar?.val === 'ok' ? resultat : null;
}

// ---- Annoteringar --------------------------------------------------------------------------------------------------

const DICOMWEB = '/api/dicomweb';
const VERKTYG = [['pil', 'Pil'], ['ring', 'Ring'], ['linje', 'Linje'], ['text', 'Text']];
const N = 1000;
const P = ([x, y]) => [Math.round(x * N), Math.round(y * N)];

// Annoteringarna som SVG ovanpå bilden, i en ruta som är 1 000 gånger 1 000 och sträcks ut över bilden.
export function lagerSvg(annoteringar, { bredd = 1, hojd = 1 } = {}) {
  const f = (a) => {
    const [x1, y1] = P(a.punkter[0]);
    const [x2, y2] = a.punkter[1] ? P(a.punkter[1]) : [x1, y1];
    const etikett = a.text ? `<text x="${x2 + 8}" y="${y2 - 8}" class="bm-ann-text">${esc(a.text)}</text>` : '';
    if (a.typ === 'text') return `<text x="${x1}" y="${y1}" class="bm-ann-text">${esc(a.text)}</text>`;
    if (a.typ === 'ring') return `<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" class="bm-ann"/>${etikett}`;
    if (a.typ === 'pil') return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="bm-ann" marker-end="url(#bm-pil)"/>${etikett}`;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="bm-ann"/>${etikett}`;
  };
  return `<svg class="bm-lager" viewBox="0 0 ${N} ${N}" preserveAspectRatio="none" aria-hidden="true" data-forhallande="${bredd / hojd}">
    <defs><marker id="bm-pil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker></defs>
    ${annoteringar.map(f).join('')}</svg>`;
}

// Förstoringen av en bild med annoteringarna. Med verktygen väljer användaren två punkter med två klick (eller med
// piltangenterna och Retur), så att inget behöver dras.
export async function visaBild(b, { kanAnnotera, uppdatera }) {
  let annoteringar = [...(b.annoteringar ?? [])];
  let verktyg = null, punkter = [], markor = [0.5, 0.5];
  const lista = () => (annoteringar.length ? `<ul class="bm-ann-lista">${annoteringar.map(a => `<li>${esc(a.typText)}${a.text ? `: ${esc(a.text)}` : ''} <span class="under-text">${esc(a.skapad.av)}, ${esc(tidpunkt(a.skapad.tid))}</span>${a.egen ? ` <button type="button" class="knapp liten sekundar" data-ta-bort="${a.id}">Ta bort</button>` : ''}</li>`).join('')}</ul>` : '<p class="under-text">Inga annoteringar.</p>');
  await dialog(`<form><h2 id="dlg-rubrik">${esc(b.kroppsstalle ? `Bild av ${b.kroppsstalle}` : b.namn)}, ${esc(tidpunkt(b.tagen))}</h2>
      <div class="bm-stor" tabindex="0" role="img" aria-label="${esc(b.beskrivning ?? b.namn)}. Med ett verktyg valt flyttar piltangenterna markören och Retur sätter en punkt.">
        <img src="${esc(b.visning)}" alt="">
        <div class="bm-lagerplats">${lagerSvg(annoteringar)}</div>
        <span class="bm-markor" hidden></span>
      </div>
      <div class="kryssfalt"><input type="checkbox" id="bm-visa-lager" checked><label for="bm-visa-lager">Visa annoteringar (originalet ändras aldrig)</label></div>
      ${kanAnnotera ? `<fieldset class="bm-verktyg"><legend>Annotera</legend>${VERKTYG.map(([id, t]) => `<button type="button" class="knapp liten sekundar" data-verktyg="${id}" aria-pressed="false">${t}</button>`).join('')}
        <label class="sr" for="bm-ann-text">Text till annoteringen</label><input id="bm-ann-text" maxlength="120" placeholder="Text till annoteringen, till exempel rodnad" autocomplete="off">
        <p class="hjalp bm-verktyg-hjalp" aria-live="polite">Välj ett verktyg och klicka på bilden.</p></fieldset>` : ''}
      <div class="bm-ann-plats">${lista()}</div>
      ${metadataHtml(b)}
      <div class="knapprad"><a class="knapp sekundar" href="${esc(b.url)}?ladda=1" download>${ikon.arkiv}<span>Ladda ner originalet</span></a><button type="button" class="knapp" data-varde="avbryt">Stäng</button></div>
    </form>`, {
    klass: 'bm-dialog',
    onOpen: (dl) => {
      const stor = dl.querySelector('.bm-stor');
      const hjalp = dl.querySelector('.bm-verktyg-hjalp');
      const markorEl = dl.querySelector('.bm-markor');
      const rita = () => { dl.querySelector('.bm-lagerplats').innerHTML = lagerSvg(annoteringar); dl.querySelector('.bm-ann-plats').innerHTML = lista(); };
      dl.querySelector('#bm-visa-lager').addEventListener('change', (e) => { dl.querySelector('.bm-lagerplats').hidden = !e.target.checked; });
      const satt = async (p) => {
        if (!verktyg) return;
        punkter.push(p);
        const behov = verktyg === 'text' ? 1 : 2;
        if (punkter.length < behov) { hjalp.textContent = 'Klicka där annoteringen ska sluta.'; return; }
        const text = dl.querySelector('#bm-ann-text').value.trim();
        try {
          const a = await api(`/api/media/${b.id}/annoteringar`, { metod: 'POST', data: { typ: verktyg, punkter, text: text || undefined } });
          annoteringar.push(a);
          rita();
          hjalp.textContent = `${a.typText} är sparad som ett eget lager.`;
          dl.querySelector('#bm-ann-text').value = '';
          uppdatera?.();
        } catch (e) { hjalp.textContent = e.message; }
        punkter = [];
      };
      const andel = (e) => { const r = stor.querySelector('img').getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
      stor.addEventListener('click', (e) => satt(andel(e)));
      stor.addEventListener('keydown', (e) => {
        if (!verktyg) return;
        const steg = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }[e.key];
        if (steg) { e.preventDefault(); markor = [Math.min(1, Math.max(0, markor[0] + steg[0])), Math.min(1, Math.max(0, markor[1] + steg[1]))]; }
        else if (e.key === 'Enter') { e.preventDefault(); satt([...markor]); }
        else return;
        markorEl.hidden = false;
        markorEl.style.left = `${markor[0] * 100}%`; markorEl.style.top = `${markor[1] * 100}%`;
      });
      dl.addEventListener('click', async (e) => {
        const v = e.target.closest('[data-verktyg]');
        if (v) {
          verktyg = v.getAttribute('aria-pressed') === 'true' ? null : v.dataset.verktyg;
          punkter = [];
          dl.querySelectorAll('[data-verktyg]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.verktyg === verktyg)));
          hjalp.textContent = verktyg ? (verktyg === 'text' ? 'Skriv texten och klicka där den ska stå.' : 'Klicka där annoteringen ska börja.') : 'Välj ett verktyg och klicka på bilden.';
          return;
        }
        const t = e.target.closest('[data-ta-bort]');
        if (t) {
          await medKnapp(t, () => api(`/api/media/annotering/${t.dataset.taBort}/ta-bort`, { metod: 'POST', data: {} }));
          annoteringar = annoteringar.filter(a => String(a.id) !== t.dataset.taBort);
          rita();
          uppdatera?.();
        }
      });
    },
  });
}

const storlekText = (n) => (n >= 1024 * 1024 ? `${tal(n / 1024 / 1024, 1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);
export function metadataHtml(b) {
  const e = b.egenskaper ?? {};
  const rader = [
    ['Tagen', tidpunkt(b.tagen)],
    ['Källa', `${b.kalla.text}${b.apparat ? `, ${b.apparat.namn} (${b.apparat.serienummer})` : ''}${b.ursprung ? `, ${b.ursprung.vardenhet}, ${b.ursprung.vardgivare}` : ''}`],
    ['Registrerad', `${tidpunkt(b.registrerad.tid)}${b.registrerad.av ? ` av ${b.registrerad.av}` : ''}, ${b.vardenhet?.namn ?? ''}`],
    ...(b.granskad ? [['Granskad', `${tidpunkt(b.granskad.tid)} av ${b.granskad.av}`]] : []),
    ...(e.bredd ? [['Storlek', `${e.bredd} × ${e.hojd} pixlar, ${storlekText(b.storlek)}`]] : [['Storlek', storlekText(b.storlek)]]),
    ...(e.langdSek ? [['Längd', `${tal(e.langdSek, 1)} sekunder${e.langdKalla === 'inspelning' ? ' (mätt vid inspelningen)' : ''}`]] : []),
    ...(e.kamera ? [['Kamera', e.kamera]] : []),
    ...(e.plats ? [['Platsuppgifter', 'Originalet har platsuppgifter. De visas inte och följer inte med till miniatyren.']] : []),
    ['Kontrollsumma', `SHA-256 ${b.sha256.slice(0, 16)}`],
  ];
  return `<dl class="bm-meta">${rader.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}

// ---- Arkivets visare -----------------------------------------------------------------------------------------------

// Studien visas genom DICOMweb (WADO-RS rendered). Bildnumret byts med reglaget eller piltangenterna, fönstret med
// knapparna (förvalt efter undersökningen), och två klick mäter ett avstånd i millimeter.
export async function visaStudie(s) {
  const a = s.arkivet;
  const serie = a.serier[0];
  const instansUid = (nr) => `${serie.forsta.replace(/\.\d+$/, '')}.${nr}`;
  let nr = Math.ceil(serie.antal / 2), fonster = a.fonster.find(f => f.namn === a.forvaltFonster) ?? null, matning = [];
  const url = () => `/api/dicomweb/studies/${encodeURIComponent(a.studieUid)}/series/${encodeURIComponent(serie.uid)}/instances/${encodeURIComponent(instansUid(nr))}/rendered${fonster ? `?window=${fonster.center},${fonster.bredd}` : ''}`;
  await dialog(`<form><h2 id="dlg-rubrik">${esc(s.undersokning)}, ${esc(tidpunkt(s.utford))}</h2>
      <p class="ruta ruta-info liten">${ikon.info}<span>Bilderna kommer från ${esc(s.arkiv)} genom DICOMweb. Arkivet och bilderna är simulerade.</span></p>
      <div class="bm-studie" tabindex="0" role="img" aria-label="${esc(`${s.undersokning}, bild ${nr} av ${serie.antal}`)}. Piltangenterna byter bild."><img src="${esc(url())}" alt="" width="${a.kolumner}" height="${a.rader}"><svg class="bm-matning" viewBox="0 0 ${a.kolumner} ${a.rader}" aria-hidden="true"></svg></div>
      ${serie.antal > 1 ? `<div class="falt"><label for="bm-bildnr">Bild <span class="bm-nr">${nr}</span> av ${serie.antal}</label><input id="bm-bildnr" type="range" min="1" max="${serie.antal}" value="${nr}"></div>` : ''}
      ${a.fonster.length ? `<fieldset class="bm-verktyg"><legend>Fönster</legend>${a.fonster.map(f => `<button type="button" class="knapp liten sekundar" data-fonster="${esc(f.namn)}" aria-pressed="${f === fonster}">${esc(f.namn)}</button>`).join('')}</fieldset>` : ''}
      <p class="hjalp bm-matt" aria-live="polite">Klicka på två punkter i bilden för att mäta avståndet.</p>
      <p class="under-text">Utlåtande: ${esc(s.utlatande ?? '')}</p>
      <p class="under-text">En extern visare med DICOMweb ansluts till <code>${esc(location.origin + DICOMWEB)}</code>, studie ${esc(a.studieUid)}.</p>
      <div class="knapprad"><button type="button" class="knapp" data-varde="avbryt">Stäng</button></div>
    </form>`, {
    klass: 'bm-dialog',
    onOpen: (dl) => {
      const img = dl.querySelector('.bm-studie img');
      const ytan = dl.querySelector('.bm-studie');
      const svg = dl.querySelector('.bm-matning');
      const visa = () => {
        img.src = url();
        const n = dl.querySelector('.bm-nr'); if (n) n.textContent = String(nr);
        const r = dl.querySelector('#bm-bildnr'); if (r) r.value = String(nr);
        ytan.setAttribute('aria-label', `${s.undersokning}, bild ${nr} av ${serie.antal}. Piltangenterna byter bild.`);
      };
      dl.querySelector('#bm-bildnr')?.addEventListener('input', (e) => { nr = Number(e.target.value); visa(); });
      ytan.addEventListener('keydown', (e) => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        nr = Math.min(serie.antal, Math.max(1, nr + d));
        visa();
      });
      ytan.addEventListener('click', (e) => {
        const r = img.getBoundingClientRect();
        const p = [((e.clientX - r.left) / r.width) * a.kolumner, ((e.clientY - r.top) / r.height) * a.rader];
        matning = matning.length >= 2 ? [p] : [...matning, p];
        svg.innerHTML = matning.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" class="bm-ann"/>`).join('') + (matning.length === 2 ? `<line x1="${matning[0][0]}" y1="${matning[0][1]}" x2="${matning[1][0]}" y2="${matning[1][1]}" class="bm-ann"/>` : '');
        if (matning.length === 2) {
          const mm = Math.hypot(matning[1][0] - matning[0][0], matning[1][1] - matning[0][1]) * a.pixelavstand;
          dl.querySelector('.bm-matt').textContent = `Avståndet är ${tal(mm, 1)} mm (pixelavstånd ${tal(a.pixelavstand, 2)} mm).`;
        }
      });
      dl.addEventListener('click', (e) => {
        const f = e.target.closest('[data-fonster]');
        if (!f) return;
        fonster = a.fonster.find(x => x.namn === f.dataset.fonster);
        dl.querySelectorAll('[data-fonster]').forEach(x => x.setAttribute('aria-pressed', String(x === f)));
        visa();
      });
    },
  });
}

