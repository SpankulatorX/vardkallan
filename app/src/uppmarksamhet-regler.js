// Förslagsregler för uppmärksamhetsinformation (Sussa 3.1.5). DEMOREGLER, inte kliniskt beslutsstöd (D10).
//
// Systemet läser det som redan finns i journalen (läkemedelslistan, diagnoserna och överkänsligheterna) och föreslår
// uppmärksamhetsinformation, så att ingen behöver skriva in samma uppgift två gånger. Läkaren bekräftar eller avfärdar
// förslaget med ett klick. Reglerna är en ren funktion av uppgifterna: de läser inte databasen, ändrar inget och prövar
// ingen behörighet. Den som anropar skickar bara in de rader som den inloggade får se.
//
// Reglerna är Vårdkällans egna exempel. De är inte Socialstyrelsens kodverkslista och inte granskade av någon
// klinisk instans. Grupperna följer Socialstyrelsens tabell över huvudgrupper och undergrupper (se uppmarksamhet.js),
// och koderna är ATC och ICD-10-SE. Socialstyrelsens kriterium att ett tillstånd eller en behandling ska vara bestående,
// åtminstone månader eller år, gör att tillfälliga ordinationer inte föreslås.

import { ANTIKOAGULANTIA } from './lakemedel.js';

export const DEMOREGLER = true;

// Varje regel: id, beskrivning (visas i gränssnittet och i kravregistret), och vad den matchar.
export const REGLER = [
  { id: 'antikoagulantia', kalla: 'ordination', atc: ANTIKOAGULANTIA, kategori: 'medicinskt', undergrupp: 'behandling',
    term: 'Antikoagulantiabehandling', motivering: 'Ökad blödningsrisk. Behandlingen behöver beaktas före operation, punktion, injektion och trombolys.',
    beskrivning: 'En stående eller vid behov-ordination av antikoagulantia (ATC B01AA, B01AB, B01AE eller B01AF) i läkemedelslistan.' },
  { id: 'immunsuppression', kalla: 'ordination', atc: ['L04'], kategori: 'medicinskt', undergrupp: 'behandling',
    term: 'Immunsuppressiv behandling', motivering: 'Ökad risk för allvarliga infektioner, och infektioner kan ge mindre tydliga symtom.',
    beskrivning: 'En ordination av immunsuppressiva medel (ATC L04) som inte är tillfällig.' },
  { id: 'kortison', kalla: 'ordination', atc: ['H02AB'], kategori: 'medicinskt', undergrupp: 'behandling',
    term: 'Långvarig kortisonbehandling', motivering: 'Risk för binjurebarksvikt vid annat insjuknande, operation eller om behandlingen avbryts. Ökad infektionsrisk.',
    beskrivning: 'En stående ordination av glukokortikoider för systemiskt bruk (ATC H02AB).' },
  { id: 'smitta-barare', kalla: 'diagnos', icd: ['Z22'], kategori: 'smitta', undergrupp: 'smittamne',
    motivering: 'Särskilda hygienrutiner och smittskyddsåtgärder vid vård och provtagning.',
    beskrivning: 'En diagnos om bärarskap (ICD-10-SE Z22). Tillsammans med resistens mot meticillin (U82.1) blir det bärarskap av MRSA.' },
  { id: 'smittsam-sjukdom', kalla: 'diagnos', icd: ['A15', 'A16', 'B18', 'B20', 'B21', 'B22', 'B23', 'B24'], kategori: 'smitta', undergrupp: 'smittsam_sjukdom',
    motivering: 'Särskilda smittskyddsåtgärder vid vård, provtagning och stickskador.',
    beskrivning: 'En diagnos om tuberkulos (A15, A16), kronisk virushepatit (B18) eller hivinfektion (B20 till B24).' },
  { id: 'implantat', kalla: 'diagnos', icd: ['Z95', 'Z96', 'Z97'], kategori: 'medicinskt', undergrupp: 'implantat',
    motivering: 'Implantatet kan påverka undersökningar som magnetkamera, operation och behandling med diatermi.',
    beskrivning: 'En diagnos om förekomst av implantat (ICD-10-SE Z95 till Z97).' },
  { id: 'transplantat', kalla: 'diagnos', icd: ['Z94'], kategori: 'medicinskt', undergrupp: 'transplantat',
    motivering: 'Patienten har immunsuppressiv behandling och särskild risk vid infektion och vid nya läkemedel.',
    beskrivning: 'En diagnos om transplanterat organ eller vävnad (ICD-10-SE Z94).' },
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
    for (const o of ordinationer) {
      if (!o.aktuell || !prefix(o.lakemedel?.atc, r.atc)) continue;
      // En tillfällig ordination är inte bestående och blir inte uppmärksamhetsinformation.
      if (o.typ === 'tillfallig') continue;
      if (r.id === 'kortison' && o.typ !== 'staende') continue;
      lagg({
        regel: r.id, kategori: r.kategori, undergrupp: r.undergrupp, term: r.term, motivering: r.motivering,
        kod: { system: 'atc', kod: o.lakemedel.atc }, kalla: { typ: 'ordination', id: o.id, text: o.lakemedel.namn },
        varfor: `${o.lakemedel.namn} (ATC ${o.lakemedel.atc}) finns i läkemedelslistan.`,
      });
    }
  }
  const mrsa = diagnoser.some(d => d.kod === 'U82.1');
  for (const r of REGLER.filter(x => x.kalla === 'diagnos')) {
    for (const d of diagnoser) {
      if (!prefix(d.kod, r.icd)) continue;
      const term = r.id === 'smitta-barare' && mrsa ? 'Bärare av MRSA' : d.text;
      lagg({
        regel: r.id, kategori: r.kategori, undergrupp: r.undergrupp, term, motivering: r.motivering,
        kod: { system: 'icd10se', kod: d.kod }, kalla: { typ: 'diagnos', id: d.id, text: `${d.kod} ${d.text}` },
        varfor: `Diagnosen ${d.kod} ${d.text} finns i journalen${term !== d.text ? ' tillsammans med U82.1 Resistens mot meticillin' : ''}.`,
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

