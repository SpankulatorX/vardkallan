// Förslagsregler för uppmärksamhetsinformation (Sussa 3.1.5). DEMOREGLER, inte kliniskt beslutsstöd (D10).
//
// Systemet läser det som redan finns i journalen (läkemedelslistan, diagnoserna och överkänsligheterna) och föreslår
// uppmärksamhetsinformation, så att ingen behöver skriva in samma uppgift två gånger. Läkaren bekräftar eller avfärdar
// förslaget med ett klick. Reglerna är en ren funktion av uppgifterna: de läser inte databasen, ändrar inget och prövar
// ingen behörighet. Den som anropar skickar bara in de rader som den inloggade får se.
//
// Runda 10, r4: termerna, koderna (ICD-10-SE, ATC och Snomed CT) och motiveringarna är Socialstyrelsens kodverkslista
// för uppmärksamhetsinformation, version 6.1.2 (umi-kodverk.js). Vilka läkemedel och diagnoser som leder till en term
// följer listans koder. Att förslaget görs, och att tillfälliga ordinationer inte föreslås, är Vårdkällans demoregel,
// inte granskad av någon klinisk instans. Socialstyrelsens kriterium är att ett tillstånd eller en behandling ska vara
// bestående, åtminstone månader eller år.

import { ANTIKOAGULANTIA } from './lakemedel.js';
import { termMedId, forDiagnoser, nationell } from './umi-kodverk.js';

export const DEMOREGLER = true;

// Varje regel: id, beskrivning (visas i gränssnittet och i kravregistret), och vad den matchar.
export const REGLER = [
  // Runda 10, r4: termerna, koderna och motiveringarna är Socialstyrelsens kodverkslista (umi-kodverk.js). Läkemedlen leder
  // till behandlingarna med ATC i listan, och diagnoserna till termerna med ICD-10-SE i listan.
  { id: 'antikoagulantia', kalla: 'ordination', atc: ANTIKOAGULANTIA, kategori: 'medicinskt', undergrupp: 'behandling', nationell: 'antikoagulantiabehandling',
    beskrivning: 'En stående eller vid behov-ordination av antikoagulantia (ATC B01AA, B01AB, B01AE eller B01AF) i läkemedelslistan ger Antikoagulantiabehandling.' },
  { id: 'immunsuppression', kalla: 'ordination', atc: ['L03A', 'L04'], kategori: 'medicinskt', undergrupp: 'behandling', nationell: 'immunmodulerande-behandling',
    beskrivning: 'En ordination av immunstimulerande eller immunsuppressiva medel (ATC L03A eller L04) som inte är tillfällig ger Immunmodulerande behandling.' },
  { id: 'cytostatika', kalla: 'ordination', atc: ['L01'], kategori: 'medicinskt', undergrupp: 'behandling', nationell: 'cytostatikabehandling',
    beskrivning: 'En ordination av antineoplastiska medel (ATC L01) som inte är tillfällig ger Cytostatikabehandling.' },
  { id: 'medicinskt-tillstand', kalla: 'diagnos', kategori: 'medicinskt', undergrupp: 'annat_tillstand',
    beskrivning: 'En diagnos med en ICD-10-SE-kod som står i kodverkslistans Annat medicinskt tillstånd, till exempel T78.3 angioneurotiskt ödem eller E27.1 Addisons sjukdom.' },
  { id: 'behandling-diagnos', kalla: 'diagnos', kategori: 'medicinskt', undergrupp: 'behandling',
    beskrivning: 'En diagnos om en behandling utan läkemedel i kodverkslistan, som Z99.2 beroende av njurdialys.' },
  { id: 'smitta-barare', kalla: 'diagnos', kategori: 'smitta', undergrupp: 'smittamne',
    beskrivning: 'Kombinationen av koder för bärarskap i kodverkslistan, till exempel bärare av stafylokocker (Z22.3) med Staphylococcus aureus (B95.6) och resistens mot meticillin (U82.1), som blir MRSA.' },
  { id: 'implantat', kalla: 'diagnos', kategori: 'medicinskt', undergrupp: 'implantat',
    beskrivning: 'En diagnos om förekomst av implantat i kodverkslistan (ICD-10-SE Z95, Z96, Z98.2 och Z99.4). En kod som gäller flera implantat, som Z95.0, ger ett förslag per implantat, och läkaren väljer det som stämmer.' },
  { id: 'transplantat', kalla: 'diagnos', kategori: 'medicinskt', undergrupp: 'transplantat',
    beskrivning: 'En diagnos om transplanterat organ eller vävnad i kodverkslistan (ICD-10-SE Z94).' },
  { id: 'overkanslighet-grad', kalla: 'overkanslighet', kategori: 'overkanslighet',
    beskrivning: 'En registrerad överkänslighet vars grad inte är bekräftad. Anafylaxi i reaktionen ger livshotande, allvarlig överkänslighet ger skadlig och annan besvärande.' },
];

const prefix = (kod, lista) => Boolean(kod) && lista.some(p => kod.startsWith(p));

// Graden för en överkänslighet, föreslagen ur reaktion och allvarlighetsgrad.
export function foreslagenGrad(o) {
  if (/anafylax/i.test(o.reaktion ?? '')) return 'livshotande';
  if (o.allvarlighet === 'allvarlig') return 'skadlig';
  return 'besvarande';
}

// foresla({ ordinationer, diagnoser, overkanslighet })
//   ordinationer: [{ id, typ, aktuell, lakemedel: { namn, atc } }]
//   diagnoser:    [{ id, kod, text }]
//   overkanslighet: [{ id, amne, atc, reaktion, allvarlighet }] som saknar bekräftad grad
// Returnerar förslag: { nyckel, regel, kategori, undergrupp, term, motivering, kod, grad, kalla: { typ, id, text }, varfor, demoregel }.
// En regel ger högst ett förslag per term, från den första raden som matchar.
export function foresla({ ordinationer = [], diagnoser = [], overkanslighet = [] }) {
  const ut = [];
  const sett = new Set();
  const lagg = (f) => {
    const nyckel = `${f.regel}:${f.term}`;
    if (sett.has(nyckel)) return;
    sett.add(nyckel);
    ut.push({ nyckel, demoregel: true, grad: null, ...f });
  };
  for (const r of REGLER.filter(x => x.kalla === 'ordination')) {
    const t = termMedId(r.nationell);
    for (const o of ordinationer) {
      if (!o.aktuell || !prefix(o.lakemedel?.atc, r.atc)) continue;
      // En tillfällig ordination är inte bestående och blir inte uppmärksamhetsinformation.
      if (o.typ === 'tillfallig') continue;
      lagg({
        regel: r.id, kategori: r.kategori, undergrupp: r.undergrupp, term: t.term, motivering: t.motivering, nationell: nationell(t),
        kod: { system: 'atc', kod: o.lakemedel.atc }, kalla: { typ: 'ordination', id: o.id, text: o.lakemedel.namn },
        varfor: `${o.lakemedel.namn} (ATC ${o.lakemedel.atc}) finns i läkemedelslistan.`,
      });
    }
  }
  // Diagnoserna: varje diagnos prövas för sig mot kodverkslistan, och en kombination mot alla diagnoser.
  const koder = diagnoser.map(d => d.kod);
  for (const r of REGLER.filter(x => x.kalla === 'diagnos')) {
    for (const { t, kod } of forDiagnoser(koder).filter(x => x.t.undergrupp === r.undergrupp && x.t.kategori === r.kategori)) {
      const d = diagnoser.find(x => x.kod === kod);
      const flera = forDiagnoser([kod]).filter(x => x.t.undergrupp === r.undergrupp).length > 1;
      lagg({
        regel: r.id, kategori: r.kategori, undergrupp: r.undergrupp, term: t.term, motivering: t.motivering, nationell: nationell(t),
        kod: { system: 'icd10se', kod: d.kod }, kalla: { typ: 'diagnos', id: d.id, text: `${d.kod} ${d.text}` },
        varfor: `Diagnosen ${d.kod} ${d.text} finns i journalen${t.kombination ? `, tillsammans med ${t.icd.slice(1).join(' och ')}` : ''}.${flera ? ' Koden gäller flera termer i kodverkslistan. Bekräfta den som stämmer och avfärda de andra.' : ''}`,
      });
    }
  }
  for (const o of overkanslighet) {
    const grad = foreslagenGrad(o);
    lagg({
      regel: 'overkanslighet-grad', kategori: 'overkanslighet', undergrupp: o.atc ? 'aktiv_substans' : 'ovrigt', term: o.amne,
      motivering: o.reaktion ?? '', grad, kod: o.atc ? { system: 'atc', kod: o.atc } : null,
      kalla: { typ: 'overkanslighet', id: o.id, text: o.amne },
      varfor: `Överkänsligheten mot ${o.amne.toLowerCase()} är registrerad med reaktionen ${String(o.reaktion ?? 'okänd').toLowerCase()}. Graden är föreslagen och behöver bekräftas.`,
    });
  }
  return ut;
}
