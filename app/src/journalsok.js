// Sökning i patientens journal (Sussa 3.1.8.1 och 3.1.8.2, runda 6, r1). Ett sökfält söker i anteckningar, diagnoser,
// läkemedel och mätvärden och ger träffarna i kronologisk ordning med träffen markerad.
//
// Systemet tolkar frågan: vanliga ord som blodtryck, feber eller njurfunktion hittar mätvärdena, en ICD-10-kod hittar
// diagnosen, och ett läkemedelsnamn, en substans, en ATC-kod eller en grupp som blodförtunnande hittar ordinationen
// och anteckningar som nämner läkemedlet. Svaret säger hur frågan tolkades.
//
// Samma behörighet som läsningen: varje rad filtreras i behörighetsmotorn innan den prövas mot frågan, så att en träff
// i en spärrad del eller en annan vårdenhet utan aktivt val aldrig räknas, markeras eller nämns. Svaret är detsamma som
// om uppgiften inte fanns. Sökningen loggas som en läsning, med söktermen och antalet synliga träffar i syftet.
// Runda 7, r4: undantag från visning.
import { provare as undantagProvare } from './undantag.js';
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import { ICD10SE, MATKOD } from './kodverk.js';
// Runda 10, r4: skannade restjournaler.
import * as restjournal from './restjournal.js';

const MAX_TRAFFAR = 100;
const sv = (s) => String(s ?? '').toLocaleLowerCase('sv-SE');
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;

// Vanliga ord för mätvärdena. Varje ord leder till en eller flera mätvärdestyper.
export const MATORD = {
  blodtryck: ['blodtryck'], bt: ['blodtryck'], tryck: ['blodtryck'], puls: ['puls'], hjärtfrekvens: ['puls'], pulsen: ['puls'],
  feber: ['temp'], temp: ['temp'], temperatur: ['temp'], kroppstemperatur: ['temp'],
  syremättnad: ['saturation'], saturation: ['saturation'], spo2: ['saturation'], syresättning: ['saturation'], sat: ['saturation'],
  andning: ['andningsfrekvens'], andningsfrekvens: ['andningsfrekvens'], af: ['andningsfrekvens'],
  vikt: ['vikt'], vägning: ['vikt'], längd: ['langd'], bmi: ['vikt', 'langd'],
  njurfunktion: ['egfr', 'kreatinin'], njurar: ['egfr', 'kreatinin'], gfr: ['egfr'], egfr: ['egfr'], kreatinin: ['kreatinin'],
  blodsocker: ['glukos', 'hba1c'], sockervärde: ['glukos', 'hba1c'], glukos: ['glukos'], hba1c: ['hba1c'], diabetesvärde: ['hba1c'],
  blodvärde: ['hb'], hemoglobin: ['hb'], hb: ['hb'], blodbrist: ['hb'],
  pk: ['inr'], inr: ['inr'], waranprov: ['inr'], crp: ['crp'], infektionsvärde: ['crp'], snabbsänka: ['crp'],
  kalium: ['kalium'], troponin: ['troponin'], hjärtinfarktprov: ['troponin'], bnp: ['ntprobnp'], 'nt-probnp': ['ntprobnp'], probnp: ['ntprobnp'],
  tsh: ['tsh'], sköldkörtel: ['tsh'], pef: ['pef'], peak: ['pef'],
  news: ['andningsfrekvens', 'saturation', 'syrgas', 'blodtryck', 'puls', 'medvetande', 'temp'], news2: ['andningsfrekvens', 'saturation', 'syrgas', 'blodtryck', 'puls', 'medvetande', 'temp'],
  vitalparametrar: ['andningsfrekvens', 'saturation', 'blodtryck', 'puls', 'temp'],
  medvetande: ['medvetande', 'gcs'], medvetandegrad: ['medvetande', 'gcs'], gcs: ['gcs'], glasgow: ['gcs'], acvpu: ['medvetande'],
  smärta: ['smarta'], nrs: ['smarta'], ont: ['smarta'], smärtskattning: ['smarta'], syrgas: ['syrgas'], syre: ['syrgas'],
  // Runda 8, r1: svaren från laboratoriet och SR.
  blodstatus: ['hb', 'lpk', 'tpk'], lpk: ['lpk'], leukocyter: ['lpk'], tpk: ['tpk'], trombocyter: ['tpk'], natrium: ['natrium'],
  elstatus: ['natrium', 'kalium'], b12: ['kobalamin'], kobalamin: ['kobalamin'], folat: ['folat'], folsyra: ['folat'], sr: ['sr'], sänka: ['sr'],
};

// Läkemedelsgrupper med vanliga ord, som ATC-prefix ur WHO:s register.
export const GRUPPORD = {
  blodförtunnande: ['B01A'], antikoagulantia: ['B01A'], 'propplösande': ['B01A'], antibiotika: ['J01'], penicillin: ['J01C'],
  smärtstillande: ['N02', 'M01A'], värktabletter: ['N02', 'M01A'], vätskedrivande: ['C03'], diuretika: ['C03'],
  betablockerare: ['C07'], blodtryckssänkande: ['C02', 'C03', 'C07', 'C08', 'C09'], insulin: ['A10A'], diabetesläkemedel: ['A10'],
  kortison: ['H02AB'], statin: ['C10AA'], blodfettssänkande: ['C10'], antidepressiva: ['N06A'], sömnmedel: ['N05C'], magskydd: ['A02BC'],
};

const ICD = /^([A-Z])(\d{2})(?:\.?(\d{1,2}))?$/i;
const ATCKOD = /^[A-Z]\d{2}(?:[A-Z](?:[A-Z](?:\d{2})?)?)?$/i;

// Tolkar frågan: ord att leta efter i text, mätvärdestyper, diagnoskoder och ATC-prefix.
export function tolka(fraga) {
  const q = String(fraga ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const ord = sv(q);
  const t = { fraga: q, ord, matTyper: new Set(), icd: null, atc: [], beskrivning: [] };
  const icd = q.match(ICD);
  if (icd) { t.icd = `${icd[1].toUpperCase()}${icd[2]}${icd[3] ? `.${icd[3]}` : ''}`; t.beskrivning.push(`diagnoser med koden ${t.icd}`); }
  if (ATCKOD.test(q)) { t.atc.push(q.toUpperCase()); t.beskrivning.push(`läkemedel med ATC-kod ${q.toUpperCase()}`); }
  for (const w of [ord, ...ord.split(' ')]) for (const typ of MATORD[w] ?? []) t.matTyper.add(typ);
  for (const [typ, def] of Object.entries(journal.MATTYPER)) if (ord.length >= 3 && sv(def.namn).includes(ord)) t.matTyper.add(typ);
  if (t.matTyper.size) t.beskrivning.push(`mätvärdena ${[...t.matTyper].map(x => journal.MATTYPER[x].namn.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' och $1')}`);
  if (GRUPPORD[ord]) { t.atc.push(...GRUPPORD[ord]); t.beskrivning.push(`läkemedel i gruppen ${ord}`); }
  return t;
}

// Markerade delar: texten delad i bitar, där bitarna som matchar något av orden är markerade. Ingen HTML.
function markera(text, ord) {
  const s = String(text ?? '');
  const lag = sv(s);
  const omr = [];
  for (const o of ord.filter(x => x && x.length >= 2)) {
    let i = lag.indexOf(o);
    while (i >= 0) { omr.push([i, i + o.length]); i = lag.indexOf(o, i + o.length); }
  }
  if (!omr.length) return null;
  omr.sort((a, b) => a[0] - b[0]);
  const delar = [];
  let pos = 0;
  for (const [a, b] of omr) {
    if (a < pos) continue;
    if (a > pos) delar.push({ text: s.slice(pos, a), markerad: false });
    delar.push({ text: s.slice(a, b), markerad: true });
    pos = b;
  }
  if (pos < s.length) delar.push({ text: s.slice(pos), markerad: false });
  return delar;
}

// Ett utdrag runt den första träffen, så att en lång anteckning inte visas i sin helhet.
function utdrag(text, ord, fore = 70, efter = 140) {
  const lag = sv(text);
  const i = Math.min(...ord.map(o => lag.indexOf(o)).filter(x => x >= 0));
  if (!Number.isFinite(i)) return null;
  const start = Math.max(0, i - fore);
  const slut = Math.min(text.length, i + efter);
  return `${start > 0 ? 'Förkortat: ' : ''}${text.slice(start, slut).trim()}${slut < text.length ? ' (fortsätter)' : ''}`;
}

const helaMarkerad = (text) => [{ text, markerad: true }];

// Raderna som användaren får se, en kategori i taget, med samma filter som läsningen.
function synligaAnteckningar(atk) {
  if (!kanRoll(atk.personal, 'las_journal') && !kanRoll(atk.personal, 'las_omvardnad')) return [];
  const rader = atk.db.query(`SELECT * FROM anteckningar a WHERE patient_id = ? AND (status = 'signerad' OR forfattare_id = ?)
    AND NOT EXISTS (SELECT 1 FROM anteckningar b WHERE b.ersatter_id = a.id) ORDER BY skapad DESC, id DESC`).all(atk.patientId, atk.personal.id);
  // Runda 7, r4: en anteckning som är undantagen från visning hittas inte heller vid sökning.
  const undantagen = undantagProvare(atk.db, 'visning');
  return atk.filtrera(rader, a => journal.lasHandling(a.kategori)).filter(a => !undantagen(a, 'anteckning'));
}

export function sok(atk, fraga) {
  const handling = 'las_oversikt';
  atk.krav(handling);
  const t = tolka(fraga);
  if (t.fraga.length < 2) throw new Fel(400, 'Skriv minst två tecken.', 'ogiltig', { falt: ['q'] });
  const db = atk.db;
  const pers = atk.personal;
  const traffar = [];
  const katalog = (id) => db.query('SELECT * FROM katalog WHERE id = ?').get(id);

  // Läkemedel som frågan träffar. Deras namn letas också efter i anteckningarna.
  const ord = [t.ord];
  const ordinationer = kanRoll(pers, 'las_lakemedel') ? lakemedel.synligaOrdinationer(atk) : [];
  for (const o of ordinationer) {
    const lm = katalog(o.lakemedel_id);
    if (!lm) continue;
    const namn = sv(lm.namn);
    const traff = namn.includes(t.ord) || sv(lm.substans).includes(t.ord) || t.atc.some(p => lm.atc.startsWith(p)) || sv(o.orsak).includes(t.ord) || sv(o.dosering).includes(t.ord);
    if (!traff) continue;
    const atcTraff = t.atc.some(p => lm.atc.startsWith(p));
    const text = `${lm.namn} ${lm.styrka ?? ''}, ${o.dosering}. Orsak: ${o.orsak}.${o.status === 'utsatt' ? ` Utsatt: ${o.utsatt_orsak ?? ''}` : ''}`.replace(/\s+/g, ' ');
    const delar = markera(text, [t.ord, ...(atcTraff || sv(lm.substans).includes(t.ord) ? [sv(lm.namn.split(' ')[0])] : [])]) ?? helaMarkerad(text);
    traffar.push({ typ: 'ordination', tid: o.skapad, rubrik: o.status === 'utsatt' ? 'Läkemedel, utsatt' : 'Läkemedel', delar, kod: { system: 'ATC', kod: lm.atc, markerad: atcTraff },
      vardenhet: { id: o.enhet_id, namn: enhetsnamn(db, o.enhet_id) }, kalla: o.kalla, kallaEtikett: journal.kallaEtikett(o.kalla, o.skapad), ref: { flik: 'lakemedel', sub: null } });
    if (atcTraff || sv(lm.substans).includes(t.ord)) ord.push(sv(lm.namn.split(' ')[0]), sv(lm.substans));
  }

  // Diagnoser: kod, text och Socialstyrelsens titel.
  if (kanRoll(pers, 'las_diagnoser')) {
    for (const d of journal.synligaDiagnoser(atk)) {
      const kodTraff = t.icd && (d.kod === t.icd || d.kod.startsWith(t.icd.replace(/\.$/, '')));
      const titel = ICD10SE[d.kod] ?? '';
      const textTraff = t.ord.length >= 3 && (sv(d.text).includes(t.ord) || sv(titel).includes(t.ord));
      if (!kodTraff && !textTraff) continue;
      traffar.push({ typ: 'diagnos', tid: d.datum, rubrik: d.typ === 'huvud' ? 'Huvuddiagnos' : 'Bidiagnos', delar: markera(d.text, [t.ord]) ?? [{ text: d.text, markerad: false }],
        kod: { system: 'ICD-10-SE', kod: d.kod, markerad: Boolean(kodTraff) }, vardenhet: { id: d.enhet_id, namn: enhetsnamn(db, d.enhet_id) }, kalla: d.kalla,
        kallaEtikett: journal.kallaEtikett(d.kalla, d.datum), ref: { flik: null, sub: null } });
    }
  }

  // Mätvärden: de typer som frågan leder till, varje värde för sig.
  if (t.matTyper.size && kanRoll(pers, 'las_matvarden')) {
    for (const m of journal.synligaMatvarden(atk).filter(x => t.matTyper.has(x.typ))) {
      const u = journal.matvardeUt(db, m);
      const varde = u.beskrivning ?? `${String(u.varde).replace('.', ',')} ${u.enhet ?? ''}`.trim();
      traffar.push({ typ: 'matvarde', tid: m.tid, rubrik: { laboratory: 'Provsvar', survey: 'Skala' }[MATKOD[m.typ]?.kategori] ?? 'Vitalparameter', delar: [{ text: u.namn, markerad: true }, { text: ` ${varde}`, markerad: false }],
        vardenhet: { id: m.enhet_id, namn: enhetsnamn(db, m.enhet_id) }, kalla: m.kalla, kallaEtikett: u.kallaEtikett, ref: { flik: 'matvarden', sub: m.typ } });
    }
  }

  // Anteckningar: fritext i alla sökord och anteckningstypen, också namnen på läkemedel som frågan träffade.
  const ordAnt = [...new Set([...ord, ...[...t.matTyper].map(x => sv(journal.MATTYPER[x].namn))].filter(o => o.length >= 2))];
  for (const a of synligaAnteckningar(atk)) {
    const sokord = JSON.parse(a.sokord);
    const traffDelar = sokord.filter(s => ordAnt.some(o => sv(s.text).includes(o) || sv(s.sokord).includes(o)));
    const typTraff = sv(a.typ).includes(t.ord);
    if (!traffDelar.length && !typTraff) continue;
    const forsta = traffDelar[0];
    const text = forsta ? `${forsta.sokord}: ${utdrag(forsta.text, ordAnt.filter(o => sv(forsta.text).includes(o))) ?? forsta.text}` : sokord.map(s => `${s.sokord}: ${s.text}`).join(' ').slice(0, 200);
    traffar.push({ typ: 'anteckning', tid: a.signerad_tid ?? a.skapad, rubrik: a.typ, delar: markera(text, ordAnt) ?? [{ text, markerad: false }],
      antalSokord: traffDelar.length, utkast: a.status !== 'signerad', vardenhet: { id: a.enhet_id, namn: enhetsnamn(db, a.enhet_id) }, kalla: a.kalla,
      kallaEtikett: journal.kallaEtikett(a.kalla, a.skapad), ref: { flik: 'journal', sub: String(a.id) } });
  }

  // Runda 10, r4: texten i skannade restjournaler (restjournal.js), med samma behörighet som listan.
  if (kanRoll(atk.personal, restjournal.LAS)) traffar.push(...restjournal.sokTraffar(atk, [...new Set([...ordAnt, t.ord].filter(o => o.length >= 2))], markera));

  traffar.sort((x, y) => String(y.tid).localeCompare(String(x.tid)));
  const antal = traffar.length;
  const tolkning = t.beskrivning.length ? `Söker på "${t.fraga}" i texten och på ${t.beskrivning.join(', ').replace(/, ([^,]*)$/, ' och $1')}.` : `Söker på "${t.fraga}" i anteckningar, diagnoser, läkemedel och mätvärden.`;
  atk.logga(handling, atk.grund(), 'journalsok', 'tillaten', `Sökning i journalen: "${t.fraga}" (${antal} ${antal === 1 ? 'träff' : 'träffar'})`);
  return { fraga: t.fraga, tolkning, antal, visade: Math.min(antal, MAX_TRAFFAR), traffar: traffar.slice(0, MAX_TRAFFAR) };
}
