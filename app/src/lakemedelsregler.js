// Demoregler för läkemedelsprocessen (D10): varningar vid administrering, vid utsättning av läkemedel med särskilda
// observationer (Sussa 3.5.2.8) och kontrollerna i läkemedelsgenomgången (3.5.1.11). Reglerna ligger i en egen modul,
// skild från journalkärnan, och är märkta som demoregler. De är inte kliniskt beslutsstöd, inte kontrollerade av
// farmaceut eller läkare och inte CE-märkta. Funktionerna är rena: de får färdiga uppgifter och ändrar inget.

export const DEMOREGLER_PROCESS = 'Varningarna är demoregler för att visa flödet. De är inte kliniskt beslutsstöd, inte granskade av farmaceut eller läkare och inte CE-märkta.';

const DAG = 86400_000;
const TIMME = 3600_000;
const klock = (iso) => new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const nar = (iso, nu) => {
  const d = (x) => new Date(x).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const idag = d(nu);
  const igar = d(nu - DAG);
  return d(iso) === idag ? `kl. ${klock(iso)}` : d(iso) === igar ? `i går kl. ${klock(iso)}` : `${d(iso)} kl. ${klock(iso)}`;
};
const timmar = (ms) => { const h = Math.round(ms / TIMME * 10) / 10; return `${String(h).replace('.', ',')} ${h === 1 ? 'timme' : 'timmar'}`; };

// Så tidigt får en schemalagd dos ges utan varning, och när den räknas som försenad.
export const FONSTER_FORE_MIN = 60;
export const FONSTER_EFTER_MIN = 60;

// Högsta antal per dygn ur doseringstexten, till exempel "högst 8 tabletter per dygn" eller "högst 4 gånger per dygn".
export function maxPerDygn(dosering = '') {
  const m = /högst (\d+)\s*(tabletter|tablett|kapslar|kapsel|doser|dos|gånger|injektioner)?\s*per dygn/i.exec(dosering);
  if (!m) return null;
  return { antal: Number(m[1]), enhet: /gång/i.test(m[2] ?? '') ? 'ganger' : 'enheter', text: m[0] };
}
// Minsta tid mellan två doser av samma substans. Ur doseringen ("minst 6 timmar mellan doserna"), annars halva det
// kortaste avståndet mellan ordinationens tider, och 4 timmar för vid behov.
export function minstaIntervallMs(o) {
  const m = /minst (\d+) timmar/i.exec(o.dosering ?? '');
  if (m) return Number(m[1]) * TIMME;
  const tider = (o.tider ?? []).map(t => { const [h, mi = '0'] = String(t).split(':'); return Number(h) * 60 + Number(mi); }).sort((a, b) => a - b);
  if (o.vidBehov || !tider.length) return 4 * TIMME;
  if (tider.length === 1) return 12 * TIMME;
  let kortast = 24 * 60 - tider[tider.length - 1] + tider[0];
  for (let i = 1; i < tider.length; i++) kortast = Math.min(kortast, tider[i] - tider[i - 1]);
  return Math.max(2 * TIMME, (kortast / 2) * 60_000);
}

// Varningar vid iordningsställande, administrering och överlämnande. underlag:
//   ordination   ordinationen (ordinationUt) eller null när dosen ges utan ordination
//   aktivVid     { aktiv, varfor } om ordinationen gällde vid tidpunkten
//   lakemedel    produkten
//   planerad     dostiden i ordinationen eller null
//   tid          när dosen ges (ms)
//   antal        antal enheter (tabletter, doser) i dosen
//   tidigare     tidigare doser av samma substans: [{ tid, planerad, ordinationId, antal, av, status }]
//   dos          dosen som anges när den skiljer sig från ordinationens, annars null
export function administreringsvarningar({ ordination, aktivVid, lakemedel, planerad, tid, antal = 1, tidigare = [], nu = Date.now(), dos = null }) {
  const ut = [];
  // Dos som avviker från ordinationen: bara när en annan dos än ordinationens anges.
  const avvikelse = ordination ? dosavvikelse(ordination, dos) : null;
  if (avvikelse) ut.push(avvikelse);
  if (!ordination) {
    ut.push({ niva: 'allvarlig', regel: 'utan_ordination', text: `Det finns ingen ordination av ${lakemedel.namn}. En dos utan ordination ska bara ges efter en muntlig ordination av läkare, och läkaren behöver ordinera i efterhand. Skriv vem som ordinerade.` });
  } else if (aktivVid && !aktivVid.aktiv) {
    ut.push({ niva: 'allvarlig', regel: 'utan_ordination', text: `${aktivVid.varfor} En dos då ska bara registreras om den faktiskt gavs, och då med en förklaring.` });
  }
  const givna = tidigare.filter(x => x.status === 'given' || x.status === 'overlamnad');
  if (planerad) {
    const samma = givna.find(x => x.planerad === planerad && x.ordinationId === ordination?.id);
    if (samma) {
      ut.push({ niva: 'allvarlig', regel: 'dubbel_dos', text: `Dosen ${nar(planerad, nu)} är redan ${samma.status === 'overlamnad' ? 'överlämnad' : 'given'} ${nar(samma.tid, nu)} av ${samma.av}. Ges den igen får patienten dubbel dos.` });
    }
    const fore = Date.parse(planerad) - tid;
    if (!samma && fore > FONSTER_FORE_MIN * 60_000) {
      ut.push({ niva: 'allvarlig', regel: 'for_tidig', text: `Dosen är ordinerad ${nar(planerad, nu)}, om ${timmar(fore)}. En dos får ges högst ${FONSTER_FORE_MIN} minuter före dostiden. Ges den nu blir det för kort tid till nästa dos.` });
    }
  }
  if (ordination && !ut.some(v => v.regel === 'dubbel_dos')) {
    const grans = minstaIntervallMs(ordination);
    const nara = givna.filter(x => Math.abs(tid - Date.parse(x.tid)) < grans && !(planerad && x.planerad === planerad)).sort((a, b) => Date.parse(b.tid) - Date.parse(a.tid))[0];
    if (nara) {
      ut.push({ niva: 'allvarlig', regel: 'dubbel_dos', text: `${lakemedel.substans[0].toUpperCase()}${lakemedel.substans.slice(1)} gavs senast ${nar(nara.tid, nu)} av ${nara.av}. Det ska gå minst ${timmar(grans)} mellan doserna enligt ordinationen, och nu har det gått ${timmar(Math.abs(tid - Date.parse(nara.tid)))}.` });
    }
  }
  if (ordination?.vidBehov) {
    const max = maxPerDygn(ordination.dosering);
    if (max) {
      const dygn = givna.filter(x => tid - Date.parse(x.tid) < DAG && tid >= Date.parse(x.tid));
      const hittills = max.enhet === 'ganger' ? dygn.length : dygn.reduce((s, x) => s + (x.antal ?? 1), 0);
      const efter = hittills + (max.enhet === 'ganger' ? 1 : antal);
      if (efter > max.antal) {
        ut.push({ niva: 'allvarlig', regel: 'max_per_dygn', text: `Ordinationen säger ${max.text}. Det senaste dygnet har patienten fått ${hittills}, så den här dosen ger ${efter}.` });
      }
    }
  }
  return ut;
}

// Läkemedel med särskilda observationer vid utsättning. dagar är hur länge behandlingen ska ha pågått för att regeln
// gäller. Prefixen är ATC-koder ur WHO:s register.
export const UTSATTNINGSREGLER = [
  { regel: 'betablockerare', atc: ['C07'], dagar: 7, niva: 'allvarlig',
    text: 'Betablockerare ska inte sättas ut tvärt efter längre tids behandling. Det kan ge snabb puls, högt blodtryck och kärlkramp.',
    forslag: 'Trappa ned dosen under en till två veckor, till exempel genom att halvera dosen varannan till var tredje dag.' },
  // Antikoagulantia (beslut 2026-11-03): utsättningen kräver en bekräftad plan, som sparas med utsättningen.
  { regel: 'antikoagulantia', atc: ['B01AA', 'B01AB', 'B01AE', 'B01AF'], dagar: 0, niva: 'allvarlig', plan: true,
    text: 'Ett avbrott i behandlingen med antikoagulantia utan en plan ökar risken för blodpropp och stroke.',
    forslag: 'Välj planen: byte till ett annat medel, uppehåll inför ett ingrepp med datum för återinsättning, eller avslutad behandling.' },
  { regel: 'p2y12_efter_pci', atc: ['B01AC24', 'B01AC04', 'B01AC22'], dagar: 0, maxDagar: 365, niva: 'allvarlig',
    text: 'Trombocythämmare efter PCI ska inte sättas ut i förtid. Under det första året ökar utsättning risken för stenttrombos.',
    forslag: 'Stäm av med kardiolog innan behandlingen sätts ut.' },
  { regel: 'kortikosteroider', atc: ['H02AB'], dagar: 21, niva: 'allvarlig',
    text: 'Kortison i tablettform som har getts mer än tre veckor ska inte sättas ut tvärt. Binjurarna kan behöva tid att börja producera kortisol igen.',
    forslag: 'Trappa ned dosen under flera veckor.' },
  { regel: 'basinsulin', atc: ['A10AE'], dagar: 0, niva: 'allvarlig',
    text: 'Utan basinsulin kan en patient med typ 1-diabetes få ketoacidos inom några timmar.',
    forslag: 'Se till att basinsulinet ersätts, till exempel av ett annat basinsulin eller insulininfusion.' },
  { regel: 'antiepileptika', atc: ['N03A'], dagar: 0, niva: 'allvarlig',
    text: 'Antiepileptika ska inte sättas ut tvärt. Det kan utlösa kramper.',
    forslag: 'Trappa ned dosen under flera veckor.' },
  { regel: 'antidepressiva', atc: ['N06AB', 'N06AX'], dagar: 42, niva: 'observera',
    text: 'Efter mer än sex veckors behandling kan antidepressiva ge utsättningssymtom som yrsel, oro och sömnbesvär.',
    forslag: 'Trappa ned dosen under några veckor.' },
  { regel: 'opioider', atc: ['N02A'], dagar: 14, niva: 'observera',
    text: 'Efter mer än två veckors behandling kan opioider ge abstinens om de sätts ut tvärt.',
    forslag: 'Trappa ned dosen.' },
  { regel: 'sommedel', atc: ['N05BA', 'N05CD', 'N05CF'], dagar: 28, niva: 'observera',
    text: 'Bensodiazepiner och liknande sömnmedel kan ge abstinens och sämre sömn om de sätts ut tvärt efter mer än fyra veckor.',
    forslag: 'Trappa ned dosen.' },
];

// Varningar vid utsättning. behandlingDagar är hur länge patienten har haft substansen utan uppehåll.
export function utsattningsvarningar({ lakemedel, behandlingDagar }) {
  const ut = [];
  for (const r of UTSATTNINGSREGLER) {
    if (!r.atc.some(a => lakemedel.atc.startsWith(a))) continue;
    if (behandlingDagar < r.dagar) continue;
    if (r.maxDagar != null && behandlingDagar > r.maxDagar) continue;
    const langd = behandlingDagar >= 365 ? `${Math.floor(behandlingDagar / 365)} år` : `${behandlingDagar} ${behandlingDagar === 1 ? 'dag' : 'dagar'}`;
    ut.push({ niva: r.niva, regel: r.regel, text: `${lakemedel.namn} (${lakemedel.atc}). ${r.text} Patienten har haft behandlingen i ${langd}.`, forslag: r.forslag, ...(r.plan ? { plan: true } : {}) });
  }
  return ut;
}

// Kontrollerna i läkemedelsgenomgången. ordinationer är de pågående (ordinationUt), paren är varningarna från
// ordinationskontrollen (lakemedel.varningar) för varje ordination mot de andra. alder i år, egfr eller null.
export const OLAMPLIGA_ALDRE = [
  { atc: 'N05CF', text: 'Zopiklon och liknande sömnmedel ökar risken för fall hos äldre.' },
  { atc: 'N05BA', text: 'Bensodiazepiner ökar risken för fall och förvirring hos äldre.' },
  { atc: 'N02AA', text: 'Opioider ökar risken för förvirring, förstoppning och fall hos äldre.' },
  { atc: 'M01A', text: 'NSAID ökar risken för blödning och njurpåverkan hos äldre.' },
];
export function genomgangsfynd({ ordinationer, par = [], alder = null, idag }) {
  const fynd = [];
  const atc5 = new Map();
  for (const o of ordinationer) {
    const k = o.lakemedel.atc.slice(0, 5);
    atc5.set(k, [...(atc5.get(k) ?? []), o]);
  }
  for (const [k, lista] of atc5) {
    if (lista.length > 1) fynd.push({ typ: 'dubbelmedicinering', niva: 'allvarlig', ordinationer: lista.map(o => o.id), text: `${lista.map(o => o.lakemedel.namn).join(' och ')} är i samma läkemedelsgrupp (${k}). Kontrollera att båda behövs.` });
  }
  for (const v of par) fynd.push({ typ: 'interaktion', niva: v.niva, ordinationer: v.ordinationer, text: v.text });
  for (const o of ordinationer) {
    if (o.uppfoljningsdatum < idag) fynd.push({ typ: 'uppfoljning', niva: 'observera', ordinationer: [o.id], text: `Uppföljningen av ${o.lakemedel.namn} skulle ha gjorts ${o.uppfoljningsdatum}.` });
    if (!o.ordinationsorsak || o.ordinationsorsak.trim().length < 3) fynd.push({ typ: 'indikation', niva: 'observera', ordinationer: [o.id], text: `${o.lakemedel.namn} saknar ordinationsorsak.` });
    if (alder != null && alder >= 75) {
      const r = OLAMPLIGA_ALDRE.find(x => o.lakemedel.atc.startsWith(x.atc));
      if (r) fynd.push({ typ: 'aldre', niva: 'observera', ordinationer: [o.id], text: `${o.lakemedel.namn}: ${r.text} Patienten är ${alder} år.` });
    }
  }
  if (alder != null && alder >= 75 && ordinationer.length >= 10) {
    fynd.push({ typ: 'polyfarmaci', niva: 'observera', ordinationer: [], text: `Patienten är ${alder} år och har ${ordinationer.length} pågående ordinationer. Tio eller fler läkemedel ger ökad risk för biverkningar.` });
  }
  return fynd;
}

// Planerna vid utsättning av antikoagulantia (runda 5). Läkaren väljer en, och systemet fyller i orsaken ur planen.
export const UTSATTNINGSPLANER = {
  byte: { text: 'Byte till annat medel', orsak: 'Byte till annat antikoagulantia', beskrivning: 'Ett annat antikoagulantia ersätter det som sätts ut.' },
  uppehall: { text: 'Uppehåll inför ingrepp', orsak: 'Uppehåll inför ingrepp', beskrivning: 'Behandlingen gör uppehåll inför ett ingrepp och sätts in igen ett visst datum.', aterinsattning: true },
  avslutad: { text: 'Avslutad behandling', orsak: 'Behandlingen är avslutad', beskrivning: 'Behandlingen ska inte fortsätta, till exempel när tiden för behandlingen är slut.' },
};
// Hur många dagar efter i dag systemet föreslår att behandlingen sätts in igen efter ett uppehåll.
export const UPPEHALL_DAGAR = 5;
export function planText(p) {
  if (!p) return null;
  if (p.typ === 'byte') return `${UTSATTNINGSPLANER.byte.text}${p.ersattMed ? `: ${p.ersattMed}` : ''}`;
  if (p.typ === 'uppehall') return `${UTSATTNINGSPLANER.uppehall.text}, återinsätts ${p.aterinsattning}`;
  return UTSATTNINGSPLANER[p.typ]?.text ?? p.typ;
}

// Dos som avviker från ordinationen (runda 5). Intervallet är ordinationens dos, eller dos till dos gånger kvoten i
// doseringen när den anger ett intervall ("1 till 2 tabletter", "2,5 till 5 mg"). Utanför intervallet är dosen en
// observation som ändå kvitteras med motivering, och mer än dubbelt eller mindre än hälften är allvarligt.
const tal = (x) => Number(String(x).replace(',', '.'));
const talText = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
export function dosintervall(o) {
  if (o?.dos == null || !Number.isFinite(o.dos) || o.dos <= 0) return null;
  const m = /(\d+(?:,\d+)?)\s*till\s*(\d+(?:,\d+)?)/.exec(o.dosering ?? '');
  const kvot = m && tal(m[1]) > 0 && tal(m[2]) > tal(m[1]) ? tal(m[2]) / tal(m[1]) : 1;
  return { min: o.dos, max: o.dos * kvot };
}
export function dosavvikelse(o, dos) {
  const iv = dosintervall(o);
  if (dos == null || !iv || (dos >= iv.min && dos <= iv.max)) return null;
  const enhet = o.dosEnhet ? ` ${o.dosEnhet}` : '';
  const ord = iv.max > iv.min ? `${talText(iv.min)} till ${talText(iv.max)}${enhet}` : `${talText(iv.min)}${enhet}`;
  const given = `${talText(dos)}${enhet}`;
  if (dos > iv.max * 2 || dos < iv.min / 2) {
    return { niva: 'allvarlig', regel: 'avvikande_dos', kraverKvittens: true,
      text: `Dosen ${given} är ${dos > iv.max ? 'mer än dubbelt så stor som' : 'mindre än hälften av'} ordinationens ${ord}. Kontrollera dosen mot ordinationen innan den ges, och skriv varför en annan dos ges.` };
  }
  return { niva: 'observera', regel: 'avvikande_dos', kraverKvittens: true,
    text: `Dosen ${given} skiljer sig från ordinationens ${ord}. Skriv varför en annan dos ges, till exempel en muntlig ordination.` };
}
