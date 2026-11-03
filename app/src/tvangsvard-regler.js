// Reglerna för psykiatrisk tvångsvård och rättspsykiatrisk vård (Sussa 3.2.3.1 till 3.2.3.4), byggda direkt från
// lagen (1991:1128) om psykiatrisk tvångsvård (LPT) och lagen (1991:1129) om rättspsykiatrisk vård (LRV) i lydelsen
// till och med SFS 2026:1308 (LPT) och 2026:1148 (LRV), hämtade från riksdagen.se 2026-11-03.
//
// Modulen är ren: lage() räknar fram en tvångsvårdsperiods läge, frister, tvångsåtgärder och uppgifter ur periodens
// händelser och en tidpunkt. Den ändrar inget och läser inget ur databasen. Varje frist och uppgift har sin paragraf.
// En frist som inte står i lagen räknas inte: då säger texten att lagen inte anger någon tid.
//
// Så räknas tiderna. Frister i timmar räknas från klockslaget. När lagen räknar dagar, veckor eller månader från en dag
// säger den inte exakt vilken dag som är den sista. Vårdkällan väljer alltid den kortaste tolkningen: den sista dagen
// är dagen före den dag som ligger tiden efter startdagen (fyra veckor från måndag den 3 är till och med söndag den 30).
// Så kommer en ansökan alltid in i tid. När lagen säger "senast dagen efter" är det dagen efter.
import { addDagar, lokalTid } from './db.js';

const TZ = 'Europe/Stockholm';
const TIMME = 3600_000;
const DYGN = 24 * TIMME;
const datumI = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
const klock = (t) => new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const dagText = (t) => new Date(t).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', timeZone: TZ });
export const tidText = (t) => `${dagText(t)} kl. ${klock(t)}`;

export const LAGAR = {
  LPT: { kort: 'LPT', namn: 'lagen (1991:1128) om psykiatrisk tvångsvård' },
  LRV: { kort: 'LRV', namn: 'lagen (1991:1129) om rättspsykiatrisk vård' },
};

// Månader framåt med samma dag i månaden, eller månadens sista dag när den inte finns.
export function plusManader(datum, n) {
  const [y, m, d] = datum.split('-').map(Number);
  const forsta = new Date(Date.UTC(y, m - 1 + n, 1));
  const sista = new Date(Date.UTC(forsta.getUTCFullYear(), forsta.getUTCMonth() + 1, 0)).getUTCDate();
  return `${forsta.getUTCFullYear()}-${String(forsta.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, sista)).padStart(2, '0')}`;
}
// Den sista dagen för en tid som räknas från en dag (se början av filen).
export function sistaDag(fran, { dagar = 0, manader = 0 }) {
  const d = datumI(fran);
  return addDagar(manader ? plusManader(d, manader) : addDagar(d, dagar), -1);
}
const slutPa = (datum) => lokalTid(datum, '23:59');

// Åldern vid en tidpunkt, för reglerna om patienter under 18 år.
function alderVid(fodd, t) {
  const [y, m, d] = fodd.split('-').map(Number);
  const [ty, tm, td] = datumI(t).split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// Händelsetyperna i beslutsjournalen med text och paragraf.
export const TYPER = {
  vardintyg: { text: 'Vårdintyg', paragraf: 'LPT 4 och 5 §§' },
  ankomst: { text: 'Ankomst till vårdinrättningen', paragraf: 'LPT 6 b §' },
  kvarhallning: { text: 'Beslut att hålla kvar patienten', paragraf: 'LPT 6 §' },
  intagning: { text: 'Beslut om intagning', paragraf: 'LPT 6 b §' },
  overgang11: { text: 'Beslut om övergång från frivillig vård till tvångsvård', paragraf: 'LPT 11 §' },
  lrv: { text: 'Rättspsykiatrisk vård påbörjad', paragraf: 'LRV 12 och 16 a §§' },
  understallning: { text: 'Beslutet underställt förvaltningsrätten', paragraf: 'LPT 12 §' },
  ansokan: { text: 'Ansökan till förvaltningsrätten', paragraf: 'LPT 7, 9, 12 och 26 a §§, LRV 12 a §' },
  anmalan: { text: 'Anmälan om särskild utskrivningsprövning', paragraf: 'LRV 16 a §' },
  medgivande: { text: 'Förvaltningsrätten medgav fortsatt vård', paragraf: 'LPT 8 och 9 §§, LRV 12 a §' },
  avslag: { text: 'Förvaltningsrätten avslog ansökan', paragraf: 'LPT 10 §' },
  ater_sluten: { text: 'Beslut om sluten tvångsvård igen', paragraf: 'LPT 26 a §' },
  upphor: { text: 'Beslut om att tvångsvården upphör', paragraf: 'LPT 27 §' },
  fastspanning: { text: 'Fastspänning', paragraf: 'LPT 19 och 19 a §§' },
  avskiljande: { text: 'Avskiljande', paragraf: 'LPT 20 och 20 a §§' },
  elektronisk: { text: 'Inskränkning i rätten att använda elektroniska kommunikationstjänster', paragraf: 'LPT 20 b och 22 b §§' },
  forsandelser: { text: 'Övervakning av försändelser', paragraf: 'LPT 22 a och 22 b §§' },
  behandling: { text: 'Behandling utan samtycke', paragraf: 'LPT 17 §' },
  kroppsvisitation: { text: 'Kroppsvisitation eller ytlig kroppsbesiktning', paragraf: 'LPT 23 §' },
  forlangning: { text: 'Förlängning av tvångsåtgärd', paragraf: 'LPT 19 till 20 a och 22 b §§' },
  atgard_slut: { text: 'Tvångsåtgärden avslutad', paragraf: 'LPT 19 till 22 b §§' },
  ivo: { text: 'Inspektionen för vård och omsorg underrättad', paragraf: 'LPT 19 till 22 c §§' },
  uppfoljningssamtal: { text: 'Uppföljningssamtal erbjudet', paragraf: 'LPT 18 a §' },
  stodperson: { text: 'Patienten informerad om rätten till stödperson', paragraf: 'LPT 30 §' },
  socialtjanst: { text: 'Behovet av stöd från socialtjänsten undersökt', paragraf: 'LPT 16 §' },
};
export const ATGARDER = ['fastspanning', 'avskiljande', 'elektronisk', 'forsandelser', 'behandling', 'kroppsvisitation'];

const BESLUT_RATTEN = 'Förvaltningsrätten ska ta upp målet till avgörande inom åtta dagar från den dag då ansökan kom in, om den inte förlänger tiden (35 §). Vården får fortsätta i avvaktan på beslutet (10 §).';

// Fristens status. varna är hur långt före fristen den markeras som snart.
function frist(id, rubrik, paragraf, senast, { nu, varna, uppfylld = null, forklaring, konsekvens = null }) {
  const t = Date.parse(senast);
  const status = uppfylld ? 'uppfylld' : nu > t ? 'passerad' : t - nu <= varna ? 'snart' : 'kommande';
  return { id, rubrik, paragraf, senast, status, uppfylld, forklaring, konsekvens };
}

// Tvångsåtgärderna i perioden: varje åtgärd med sina beslut, hur länge beslutet gäller och vad lagen kräver.
function atgarderI(hs, { nu, fodd, kvarhallen }) {
  const ut = [];
  const perId = new Map();
  for (const h of hs) {
    if (ATGARDER.includes(h.typ)) {
      const under18 = fodd ? alderVid(fodd, h.tid) < 18 : false;
      const a = { id: h.id, typ: h.typ, typText: TYPER[h.typ].text, paragraf: '', start: h.tid, under18, beslut: [h], slut: null, giltigTill: null, synnerliga: Boolean(h.detalj?.synnerliga), kvarhallen: Boolean(kvarhallen && kvarhallen.tid <= h.tid && !h.detalj?.efterIntagning) };
      perId.set(h.id, a);
      ut.push(a);
    } else if (h.typ === 'forlangning' || h.typ === 'atgard_slut') {
      const a = perId.get(Number(h.detalj?.avser));
      if (!a) continue;
      if (h.typ === 'atgard_slut') a.slut = h.tid;
      else { a.beslut.push(h); if (h.detalj?.synnerliga) a.synnerliga = true; }
    }
  }
  for (const a of ut) {
    const sista = a.beslut.at(-1);
    const harPlus = (ms) => new Date(Date.parse(sista.tid) + ms).toISOString();
    if (a.typ === 'fastspanning') {
      a.paragraf = a.under18 ? '19 a §' : '19 §';
      if (a.under18) { a.giltigTill = harPlus(TIMME); a.krav = 'Beslutet gäller högst en timme och förlängs genom nya beslut om högst en timme i taget. Hälso- och sjukvårdspersonal ska vara närvarande hela tiden (19 a §).'; }
      else a.krav = 'Fastspänningen ska vara kortvarig, och hälso- och sjukvårdspersonal ska vara närvarande hela tiden (19 § första stycket). Lagen anger ingen gräns i timmar. Längre än så får den pågå bara om chefsöverläkaren beslutar det av synnerliga skäl, och då ska Inspektionen för vård och omsorg underrättas utan dröjsmål (19 § andra och tredje stycket).';
      if (a.kvarhallen) a.krav = `Patienten hålls kvar enligt 6 § och har ännu inte tagits in. ${a.under18 ? 'Fastspänning högst en timme' : 'Fastspänningen ska vara kortvarig'}, beslutad av legitimerad läkare (6 a §). ${a.krav}`;
    } else if (a.typ === 'avskiljande') {
      a.paragraf = a.under18 ? '20 a §' : '20 §';
      const till = sista.detalj?.till && a.synnerliga && !a.under18 ? sista.detalj.till : null;
      a.giltigTill = till ?? harPlus((a.under18 ? 2 : 8) * TIMME);
      a.krav = a.under18
        ? 'Beslutet gäller högst två timmar och förlängs genom nya beslut om högst två timmar i taget. Patienten ska stå under fortlöpande uppsikt av hälso- och sjukvårdspersonal (20 a §).'
        : 'Beslutet gäller högst åtta timmar och förlängs genom ett nytt beslut med högst åtta timmar, eller av synnerliga skäl för en bestämd längre tid. Patienten ska stå under fortlöpande uppsikt av hälso- och sjukvårdspersonal (20 §).';
      if (a.kvarhallen) a.krav = `Patienten hålls kvar enligt 6 § och har ännu inte tagits in (6 a §). ${a.krav}`;
    } else if (a.typ === 'elektronisk') {
      a.paragraf = '20 b och 22 b §§';
      a.giltigTill = a.under18 ? new Date(Date.parse(sista.tid) + 7 * DYGN).toISOString() : slutPa(sistaDag(sista.tid, { manader: 2 }));
      a.krav = `Beslutet gäller högst ${a.under18 ? 'en vecka' : 'två månader'} och ska upphöra genast när förutsättningarna inte längre finns (22 b §).`;
    } else if (a.typ === 'forsandelser') {
      a.paragraf = '22 a och 22 b §§';
      a.giltigTill = slutPa(sistaDag(sista.tid, { manader: 2 }));
      a.krav = 'Beslutet gäller högst två månader och ska upphöra genast när förutsättningarna inte längre finns (22 b §). Försändelser till myndigheter, advokat, offentligt biträde och internationella klagoorgan granskas aldrig (22 a §).';
    } else if (a.typ === 'behandling') {
      a.paragraf = '17 §';
      a.krav = 'Chefsöverläkaren beslutar om behandling utan samtycke när det är nödvändigt (17 § tredje stycket). Lagen anger ingen tidsgräns.';
      a.slut = a.slut ?? a.start;
    } else if (a.typ === 'kroppsvisitation') {
      a.paragraf = '23 §';
      a.krav = 'Ett vittne ska om möjligt vara närvarande (23 §).';
      a.slut = a.slut ?? a.start;
    }
    a.pagar = !a.slut;
    a.status = a.slut ? 'avslutad' : a.giltigTill && nu > Date.parse(a.giltigTill) ? 'utgangen' : 'pagar';
    a.langd = Math.max(0, (a.slut ? Date.parse(a.slut) : nu) - Date.parse(a.start));
  }
  return ut;
}

// Uppgifter om underrättelse till Inspektionen för vård och omsorg (IVO) och uppföljningssamtal.
function uppgifterFor(atgarder, hs, { nu }) {
  const gjort = new Set(hs.filter(h => h.typ === 'ivo').map(h => String(h.detalj?.avser)));
  const samtal = new Set(hs.filter(h => h.typ === 'uppfoljningssamtal').map(h => Number(h.detalj?.avser)));
  const ut = [];
  const ivo = (id, text, paragraf) => { if (!gjort.has(id)) ut.push({ id, typ: 'ivo', text, paragraf, nar: 'Utan dröjsmål. Lagen anger ingen tid i timmar.' }); };
  for (const a of atgarder) {
    const langd = a.langd;
    if (a.typ === 'fastspanning') {
      if (!a.under18 && a.synnerliga) ivo(`ivo:${a.id}`, 'Underrätta Inspektionen för vård och omsorg om beslutet att hålla patienten fastspänd längre av synnerliga skäl.', '19 § tredje stycket');
      if (a.under18 && langd > TIMME) ivo(`ivo:${a.id}`, 'Underrätta Inspektionen för vård och omsorg: patienten under 18 år har varit fastspänd längre än en timme i följd.', '19 a § tredje stycket');
    }
    if (a.typ === 'avskiljande') {
      if (!a.under18 && langd > 8 * TIMME) ivo(`ivo:${a.id}`, 'Underrätta Inspektionen för vård och omsorg: patienten har hållits avskild mer än åtta timmar i följd.', '20 § tredje stycket');
      if (a.under18 && langd > 2 * TIMME) ivo(`ivo:${a.id}`, 'Underrätta Inspektionen för vård och omsorg: patienten under 18 år har hållits avskild längre än två timmar i följd.', '20 a § tredje stycket');
    }
    if (a.typ === 'elektronisk' || a.typ === 'forsandelser') ivo(`ivo:${a.id}`, `Underrätta Inspektionen för vård och omsorg om beslutet om ${a.typ === 'elektronisk' ? 'inskränkning i rätten att använda elektroniska kommunikationstjänster' : 'övervakning av försändelser'}.`, '22 b § fjärde stycket');
    if (['fastspanning', 'avskiljande'].includes(a.typ) && a.slut && !samtal.has(a.id)) {
      ut.push({ id: `samtal:${a.id}`, typ: 'uppfoljningssamtal', avser: a.id, text: `Erbjud patienten ett uppföljningssamtal efter ${a.typText.toLowerCase()} ${tidText(a.start)}.`, paragraf: '18 a §', nar: 'Så snart patientens tillstånd tillåter det. Lagen anger ingen tid.' });
    }
  }
  const unga = atgarder.filter(a => a.under18 && ['fastspanning', 'avskiljande', 'elektronisk'].includes(a.typ));
  if (unga.length >= 3) ivo('ivo:22c', 'Underrätta Inspektionen för vård och omsorg: patienten under 18 år har varit föremål för fastspänning, avskiljande eller inskränkning i rätten att använda elektroniska kommunikationstjänster vid minst tre tillfällen under vårdperioden.', '22 c §');
  return ut.map(u => ({ ...u, nu }));
}

// Periodens läge. hs är periodens händelser i tidsordning med detalj som objekt. fodd är patientens födelsedatum.
// harVardplan säger om det finns en vårdplan för tvångsvården (16 §).
export function lage(hs, { nu = Date.now(), fodd = null, harVardplan = false } = {}) {
  const s = {
    lag: null, status: 'vantar', form: null, grund: null, vardintyg: null, ankomst: null, kvarhallen: null, intagning: null,
    giltigTill: null, giltigParagraf: null, krav: null, ansokan: null, slut: null, slutOrsak: null, medgivanden: 0, sup: false,
    oppenForeAter: false,
  };
  const krav = (typ, senast, paragraf, rubrik, forklaring, konsekvens) => { s.krav = { typ, senast, paragraf, rubrik, forklaring, konsekvens, uppfylld: null }; };
  const frister = [];
  // En ansökan som inte kom in i tid: vården upphör av sig själv (28 § och LRV 14 §), utom vid 26 a §, där det tidigare
  // beslutet om öppen tvångsvård kvarstår. En anmälan enligt LRV 16 a § som kommer för sent avslutar inte vården.
  const kontrollera = (t) => {
    if (s.status === 'upphord' || s.status === 'vantar' || !s.krav || s.krav.uppfylld || t <= Date.parse(s.krav.senast) || s.krav.kontrollerad) return;
    s.krav.kontrollerad = true;
    if (s.krav.paragraf === '26 a §') { s.form = 'oppen'; s.status = 'oppen'; s.aterOppen = true; }
    else if (s.krav.typ === 'ansokan') {
      s.status = 'upphord'; s.slut = s.krav.senast;
      s.slutOrsak = s.lag === 'LRV' ? 'Den rättspsykiatriska vården upphörde eftersom ingen ansökan om fortsatt vård kom in innan tiden löpte ut (LRV 14 § andra stycket).'
        : 'Tvångsvården upphörde eftersom ingen ansökan om medgivande kom in till förvaltningsrätten i tid (28 §).';
      s.upphordAvSigSjalv = true;
    }
  };
  for (const h of hs) {
    const d = h.detalj ?? {};
    kontrollera(Date.parse(h.tid));
    if (s.status === 'upphord') break;
    switch (h.typ) {
      case 'vardintyg': s.vardintyg = h; break;
      case 'ankomst': s.ankomst = h; break;
      case 'kvarhallning': s.kvarhallen = h; break;
      case 'intagning': case 'overgang11': {
        s.lag = 'LPT'; s.status = 'sluten'; s.form = 'sluten'; s.intagning = h; s.grund = h.typ === 'intagning' ? '6 b §' : '11 §';
        if (h.typ === 'intagning') {
          krav('ansokan', slutPa(sistaDag(h.tid, { dagar: 28 })), '7 §', 'Ansökan om medgivande till fortsatt tvångsvård',
            'Om patienten behöver tvångsvård längre än fyra veckor från dagen för beslutet om intagning ska chefsöverläkaren ansöka hos förvaltningsrätten före utgången av fyraveckorstiden (7 §).',
            'Tvångsvården upphör om ansökan inte har kommit in i tid (28 §).');
        } else {
          frister.push(frist('understallning', 'Underställ beslutet förvaltningsrättens prövning', '12 § första stycket', slutPa(addDagar(datumI(h.tid), 1)), {
            nu, varna: 12 * TIMME, uppfylld: hs.find(x => x.typ === 'understallning')?.tid ?? null,
            forklaring: 'Ett beslut om övergång från frivillig vård enligt 11 § ska underställas förvaltningsrättens prövning senast dagen efter beslutet (12 § första stycket).' }));
          krav('ansokan', slutPa(sistaDag(h.tid, { dagar: 4 })), '12 § andra stycket', 'Ansökan om medgivande till fortsatt tvångsvård',
            'Om tvångsvården bör fortsätta ska chefsöverläkaren ansöka hos förvaltningsrätten senast inom fyra dagar från dagen för beslutet (12 § andra stycket).',
            'Tvångsvården upphör om ansökan inte har kommit in i tid (28 §).');
        }
        break;
      }
      case 'lrv': {
        s.lag = 'LRV'; s.status = 'sluten'; s.form = 'sluten'; s.intagning = h; s.sup = Boolean(d.sup); s.grund = d.sup ? 'med särskild utskrivningsprövning' : 'utan särskild utskrivningsprövning';
        const start = [d.verkstallbar, d.ankomst].filter(Boolean).sort().at(-1) ?? datumI(h.tid);
        if (s.sup) {
          krav('anmalan', slutPa(sistaDag(lokalTid(start, '12:00'), { manader: 4 })), 'LRV 16 a §', 'Anmälan om särskild utskrivningsprövning',
            'Chefsöverläkaren ska anmäla frågan om särskild utskrivningsprövning till förvaltningsrätten senast fyra månader efter att domen blev verkställbar, eller från dagen då patienten kom till sjukvårdsinrättningen om det var senare (LRV 16 a §).', null);
        } else {
          s.giltigTill = slutPa(sistaDag(lokalTid(start, '12:00'), { manader: 4 }));
          s.giltigParagraf = 'LRV 12 §';
          krav('ansokan', s.giltigTill, 'LRV 12 a §', 'Ansökan om medgivande till fortsatt rättspsykiatrisk vård',
            'Vården utan särskild utskrivningsprövning får pågå högst fyra månader från dagen då domstolens beslut blev verkställbart, eller från dagen då patienten kom till sjukvårdsinrättningen om det var senare (LRV 12 §). Ansökan om fortsatt vård ska ha kommit in innan tiden har löpt ut (LRV 14 §).',
            'Den rättspsykiatriska vården upphör om ansökan inte har kommit in i tid (LRV 14 § andra stycket).');
        }
        break;
      }
      case 'understallning': break;
      case 'ansokan': case 'anmalan':
        if (s.krav && !s.krav.uppfylld && s.krav.typ === h.typ && Date.parse(h.tid) <= Date.parse(s.krav.senast)) s.krav.uppfylld = h.tid;
        if (h.typ === 'ansokan') s.ansokan = h;
        break;
      case 'medgivande': {
        const beslut = d.beslutsdatum ? lokalTid(d.beslutsdatum, '12:00') : h.tid;
        const form = d.form === 'oppen' ? 'oppen' : 'sluten';
        s.medgivanden++;
        s.ansokan = null;
        if (s.lag === 'LRV' && s.sup) {
          krav('anmalan', slutPa(sistaDag(beslut, { manader: 6 })), 'LRV 16 a §', 'Ny anmälan om särskild utskrivningsprövning',
            'Därefter ska anmälan göras inom var sjätte månad från den dag då förvaltningsrätten senast meddelade beslut i frågan (LRV 16 a §).', null);
        } else {
          const forsta = s.lag === 'LPT' && s.medgivanden === 1 && !s.oppenForeAter;
          if (forsta) {
            s.giltigTill = slutPa(sistaDag(s.intagning.tid, { manader: 4 }));
            s.giltigParagraf = s.grund === '11 §' ? '13 §' : '8 §';
          } else {
            s.giltigTill = slutPa(sistaDag(beslut, { manader: 6 }));
            s.giltigParagraf = s.lag === 'LRV' ? 'LRV 12 a §' : s.oppenForeAter ? '26 a §' : '9 §';
          }
          if (d.till && d.till < datumI(s.giltigTill)) s.giltigTill = slutPa(d.till);
          krav('ansokan', s.giltigTill, s.lag === 'LRV' ? 'LRV 12 a §' : '9 §', 'Ansökan om fortsatt vård',
            s.lag === 'LRV' ? 'Medgivande lämnas för högst sex månader åt gången (LRV 12 a §). Ansökan ska ha kommit in innan tiden för det gällande beslutet har löpt ut (LRV 14 §).'
              : 'Fortsatt vård utöver den tiden kräver förvaltningsrättens medgivande för högst sex månader åt gången, och ansökan ska ha kommit in innan tiden för det gällande beslutet har löpt ut (9 §).',
            s.lag === 'LRV' ? 'Den rättspsykiatriska vården upphör om ansökan inte har kommit in i tid (LRV 14 § andra stycket).' : 'Tvångsvården upphör om ansökan inte har kommit in i tid (28 §).');
        }
        s.form = form; s.status = form; s.oppenForeAter = false;
        break;
      }
      case 'avslag': s.status = 'upphord'; s.slut = h.tid; s.slutOrsak = 'Förvaltningsrätten avslog ansökan, och vården upphörde omedelbart (10 §).'; break;
      case 'ater_sluten':
        s.form = 'sluten'; s.status = 'sluten'; s.oppenForeAter = true;
        s.aterSluten = h;
        krav('ansokan', slutPa(sistaDag(h.tid, { dagar: 4 })), '26 a §', 'Ansökan om fortsatt sluten tvångsvård',
          'Om den slutna tvångsvården bör fortsätta ska chefsöverläkaren ansöka hos förvaltningsrätten senast fyra dagar från dagen för beslutet (26 a § andra stycket).',
          'Annars kvarstår det tidigare beslutet om öppen psykiatrisk tvångsvård (26 a § sista stycket).');
        break;
      case 'upphor': s.status = 'upphord'; s.slut = h.tid; s.slutOrsak = d.orsak ? `${d.orsak} (27 §).` : 'Chefsöverläkaren beslutade att tvångsvården skulle upphöra, eftersom förutsättningarna inte längre fanns (27 §).'; break;
      default: break;
    }
  }

  kontrollera(nu);

  // Fristerna före intagningen: beslut senast 24 timmar efter ankomsten och ett vårdintyg som är högst fyra dagar.
  if (s.status === 'vantar' && s.vardintyg) {
    const frivillig = Boolean(s.vardintyg.detalj?.frivillig);
    if (frivillig) {
      frister.push(frist('beslut11', 'Beslut om övergång till tvångsvård', '11 §', new Date(Date.parse(s.vardintyg.tid) + DYGN).toISOString(), {
        nu, varna: 6 * TIMME, forklaring: 'Patienten vårdas frivilligt. Ett beslut om sluten tvångsvård enligt 11 § ska fattas senast 24 timmar efter att vårdintyget utfärdades.' }));
    } else if (s.ankomst) {
      frister.push(frist('intagning', 'Beslut om intagning', '6 b §', new Date(Date.parse(s.ankomst.tid) + DYGN).toISOString(), {
        nu, varna: 6 * TIMME,
        forklaring: `Frågan om intagning ska avgöras skyndsamt efter undersökning, senast 24 timmar efter ankomsten till vårdinrättningen (6 b §). Patienten kom ${tidText(s.ankomst.tid)}${s.ankomst.detalj?.forklaring ? `, ${s.ankomst.detalj.forklaring}` : ''}.`,
        konsekvens: 'Efter 24 timmar finns inget lagstöd för att hålla kvar patienten.' }));
    }
    frister.push(frist('vardintyg', 'Vårdintyget får användas', '6 b §', new Date(Date.parse(s.vardintyg.tid) + 4 * DYGN).toISOString(), {
      nu, varna: DYGN, forklaring: `Ett beslut om intagning får inte grundas på ett vårdintyg som är äldre än fyra dagar (6 b §). Vårdintyget utfärdades ${tidText(s.vardintyg.tid)}. Lagen säger inte hur dagarna räknas, så Vårdkällan räknar fyra dygn från klockslaget.` }));
  }
  if (s.krav && s.status !== 'upphord') {
    frister.push(frist(s.krav.typ, s.krav.rubrik, s.krav.paragraf, s.krav.senast, { nu, varna: s.krav.paragraf === '12 § andra stycket' || s.krav.paragraf === '26 a §' ? DYGN : 7 * DYGN, uppfylld: s.krav.uppfylld, forklaring: s.krav.forklaring, konsekvens: s.krav.konsekvens }));
  }
  if (s.ansokan && s.status !== 'upphord') s.iAvvaktan = BESLUT_RATTEN;

  const atgarder = atgarderI(hs, { nu, fodd, kvarhallen: s.intagning ? null : s.kvarhallen });
  if (s.intagning) for (const a of atgarder) if (s.kvarhallen && Date.parse(a.start) < Date.parse(s.intagning.tid)) a.kvarhallen = true;
  for (const a of atgarder) {
    if (a.pagar && a.giltigTill) {
      frister.push(frist(`atgard:${a.id}`, `${a.typText}: beslutet gäller till`, a.paragraf, a.giltigTill, {
        nu, varna: a.typ === 'fastspanning' || a.typ === 'avskiljande' ? 30 * 60_000 : 7 * DYGN,
        forklaring: `${a.krav} Förläng med ett nytt beslut eller avsluta åtgärden.`, konsekvens: 'När tiden har gått ut gäller beslutet inte längre.' }));
    }
  }

  // Uppgifter som lagen kräver utan en tid i timmar eller dagar.
  const uppgifter = [];
  const finns = (typ) => hs.some(h => h.typ === typ);
  if (s.intagning && s.status !== 'upphord') {
    if (!harVardplan) uppgifter.push({ id: 'vardplan', typ: 'vardplan', text: 'Upprätta en vårdplan med de behandlingsåtgärder och andra insatser som behövs, så långt möjligt i samråd med patienten.', paragraf: '16 §', nar: 'Snarast efter intagningen. Lagen anger ingen tid i timmar.' });
    if (!finns('socialtjanst')) uppgifter.push({ id: 'socialtjanst', typ: 'socialtjanst', text: 'Undersök om patienten behöver stöd från socialtjänsten, så långt möjligt i samråd med patienten.', paragraf: '16 § andra stycket', nar: 'Lagen anger ingen tid.' });
    if (!finns('stodperson')) uppgifter.push({ id: 'stodperson', typ: 'stodperson', text: 'Informera patienten om rätten att få en stödperson, på ett sätt som är anpassat till patienten.', paragraf: '30 §', nar: 'Så snart patientens tillstånd tillåter det. Lagen anger ingen tid.' });
    if (s.form === 'oppen' && !s.aterOppen) uppgifter.push({ id: 'oppen', typ: 'information', text: 'Öppen psykiatrisk tvångsvård: patienten ska följa de särskilda villkor som rätten eller chefsöverläkaren har beslutat (26 §). Till en ansökan om fortsatt öppen tvångsvård ska en uppföljning av den samordnade vårdplanen fogas (9 §).', paragraf: '26 och 9 §§', nar: null });
  }
  uppgifter.push(...uppgifterFor(atgarder, hs, { nu }).map(({ nu: _n, ...u }) => u));
  if (s.status !== 'upphord' && s.intagning) uppgifter.push({ id: 'overvag', typ: 'information', text: 'Frågan om vårdens upphörande ska övervägas fortlöpande, och vården ska upphöra genast när förutsättningarna inte längre finns.', paragraf: s.lag === 'LRV' ? 'LRV 13 och 15 §§' : '27 §', nar: null });

  const status = s.status;
  const statusText = {
    vantar: s.vardintyg?.detalj?.frivillig ? 'Vårdintyg utfärdat, patienten vårdas frivilligt' : 'Vårdintyg utfärdat, väntar på beslut om intagning',
    sluten: s.lag === 'LRV' ? 'Sluten rättspsykiatrisk vård' : 'Sluten psykiatrisk tvångsvård',
    oppen: s.lag === 'LRV' ? 'Öppen rättspsykiatrisk vård' : 'Öppen psykiatrisk tvångsvård',
    upphord: s.lag === 'LRV' ? 'Den rättspsykiatriska vården har upphört' : s.intagning ? 'Tvångsvården har upphört' : 'Ingen intagning',
  }[status];
  return {
    lag: s.lag, status, statusText, form: s.form, grund: s.grund, sup: s.sup, intagning: s.intagning?.tid ?? null, ankomst: s.ankomst?.tid ?? null,
    vardintyg: s.vardintyg ? { id: s.vardintyg.id, tid: s.vardintyg.tid, av: s.vardintyg.av, frivillig: Boolean(s.vardintyg.detalj?.frivillig) } : null,
    kvarhallen: Boolean(s.kvarhallen && !s.intagning), giltigTill: status === 'upphord' ? null : s.giltigTill, giltigParagraf: s.giltigParagraf,
    iAvvaktan: s.iAvvaktan ?? null, slut: s.slut, slutOrsak: s.slutOrsak, upphordAvSigSjalv: Boolean(s.upphordAvSigSjalv), aterOppen: Boolean(s.aterOppen),
    frister: frister.sort((a, b) => a.senast.localeCompare(b.senast)), atgarder, uppgifter,
  };
}

// Kontroller före ett beslut om intagning (6 b §): vårdintygets ålder, vem som utfärdade det och fristen.
// Ger { ok, kontroller: [{ ok, text }] }. beslutare är personalens id.
export function provaIntagning(l, { nu = Date.now(), beslutare, harUppdrag }) {
  const k = [];
  if (!l.vardintyg) return { ok: false, kontroller: [{ ok: false, text: 'Det finns inget vårdintyg. Ett beslut om intagning får inte fattas utan vårdintyg (4 §).' }] };
  const alder = nu - Date.parse(l.vardintyg.tid);
  const tim = Math.floor(alder / TIMME);
  k.push({ ok: alder <= 4 * DYGN, text: alder <= 4 * DYGN ? `Vårdintyget är ${tim < 48 ? `${tim} ${tim === 1 ? 'timme' : 'timmar'}` : `${Math.floor(tim / 24)} dygn`} gammalt. Det får vara högst fyra dagar (6 b §).` : 'Vårdintyget är äldre än fyra dagar och kan inte ligga till grund för ett beslut om intagning (6 b §). Ett nytt vårdintyg behövs.' });
  k.push({ ok: l.vardintyg.av !== beslutare, text: l.vardintyg.av !== beslutare ? 'Du har inte utfärdat vårdintyget (6 b §).' : 'Du har utfärdat vårdintyget själv. Beslutet får inte fattas av den läkare som har utfärdat vårdintyget (6 b §).' });
  k.push({ ok: harUppdrag, text: harUppdrag ? 'Du är chefsöverläkare eller har chefsöverläkarens uppdrag enligt 39 § att besluta om intagning.' : 'Beslut om intagning fattas av chefsöverläkaren eller av en erfaren läkare med specialistkompetens i psykiatri som har chefsöverläkarens uppdrag (6 b och 39 §§).' });
  const f = l.frister.find(x => x.id === 'intagning' || x.id === 'beslut11');
  if (f) k.push({ ok: f.status !== 'passerad', text: f.status !== 'passerad' ? `Beslutet ska fattas senast ${tidText(f.senast)} (${f.paragraf}).` : `Fristen för beslutet gick ut ${tidText(f.senast)} (${f.paragraf}). Patienten kan inte längre hållas kvar på det vårdintyget.` });
  return { ok: k.every(x => x.ok), kontroller: k };
}
