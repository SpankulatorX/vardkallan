// Runda 14, r4 (Sussa 11.2.1.7): testprotokoll med spårbarhet mellan krav och testfall, att lämna till en beställare
// inför acceptanstest. Protokollet räknas varje gång ur det som finns: kravregistret (krav.js), Sussa-registret
// (sussa/index.js) och resultaten från det senaste bygget (test-resultat.json och gränssnittens resultatfiler).
//
// För varje eget krav och varje Sussa-post med tester visas testfallen, resultatet för varje testfall, när testet kördes
// och i vilken körning, och överst vilken byggd version protokollet gäller: versionen i package.json och en kodhash
// (sha256 över src/ och public/, samma som lasttestet använder). Krav utan testfall räknas upp för sig, så att det syns
// vad som inte är testat. Ett testfall som saknas i resultaten, är rött eller gäller ett gränssnitt som har ändrats
// sedan testet kördes visas som det.
//
// Systemet är experten: ingen sammanställer protokollet för hand. Sidan Testprotokoll och docs/testprotokoll.md skrivs
// ur samma funktion, och protokollet säger själv vad det inte är: inget acceptanstest med en beställare är gjort.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KRAV, kravregister, lasTestresultat } from './krav.js';
import { sussaRegister } from './sussa/index.js';
import { lasKlientresultat, kodHash, SRC, PUBLIC } from './klientresultat.js';

export const ACCEPTANSTEST = 'Inget acceptanstest med en beställare är gjort. Protokollet visar resultatet av Vårdkällans egna automatiska tester i det senaste bygget och är underlaget inför ett acceptanstest, inte resultatet av ett.';
export const STATUSTEXT = { 'grön': 'Godkänt', 'röd': 'Ej godkänt', hoppad: 'Hoppades över', saknas: 'Inte kört', inaktuell: 'Inaktuellt, gränssnittet har ändrats sedan testet kördes' };
export const RESULTATTEXT = { godkant: 'Alla testfall godkända', ej_godkant: 'Inte alla testfall godkända' };
export const KRAVSTATUS = { uppfyllt_demo: 'uppfyllt i demon', delvis: 'delvis', planerat: 'planerat' };
const STATUSORDNING =['grön', 'röd', 'hoppad', 'saknas', 'inaktuell'];

// Körningarna som ett testfall kan komma från: filen, vad den heter i protokollet och vilka tester den har.
const KORNINGAR = [
  ['klienttester', 'Gränssnittstest i webbläsaren'],
  ['klickbudget', 'Klickbudget i webbläsaren'],
  ['sussatestfall', 'Sussas testfall i webbläsaren'],
  ['lasttest', 'Lasttest'],
  ['fhirvalidering', 'Validering med HL7:s validator'],
];
const lasJson = (fil) => { try { return fil && existsSync(fil) ? JSON.parse(readFileSync(fil, 'utf8')) : null; } catch { return null; } };

// Varje testfall i resultatfilerna för gränssnitt, lasttest och validering, med körningens namn och tid.
export function testkallor(filer = {}) {
  const ut = new Map();
  for (const [nyckel, kalla] of KORNINGAR) {
    const f = lasJson(filer[nyckel]);
    for (const t of f?.tester ?? []) if (!ut.has(t.namn)) ut.set(t.namn, { kalla, tid: f.tid ?? null });
  }
  return ut;
}

// Körningarna överst i protokollet: när varje slags test kördes och hur många som var gröna.
function korningar(resultat, filer) {
  const ut = [];
  if (resultat) ut.push({ kalla: 'Servertest', tid: resultat.tid, antal: resultat.antal, godkanda: resultat.godkanda, misslyckade: resultat.misslyckade, aktuell: true });
  for (const [nyckel, kalla] of KORNINGAR) {
    const f = lasJson(filer?.[nyckel]);
    if (!f) continue;
    const t = f.tester ?? [];
    ut.push({ kalla, tid: f.tid ?? null, antal: t.length, godkanda: t.filter(x => x.status === 'grön').length, misslyckade: t.filter(x => x.status === 'röd').length });
  }
  return ut;
}

const tom = () => Object.fromEntries(STATUSORDNING.map(s => [s, 0]));

// Protokollet. resultat är test-resultat.json, klient svaret från lasKlientresultat (status med inaktuella), kallor en
// karta från testnamn till körning och tid för gränssnittens tester, version versionen i package.json och kodhash
// koden som protokollet gäller.
export function protokoll({ resultat = null, klient = null, kallor = new Map(), korning = [], version = null, kodhash = null } = {}) {
  const status = new Map([...(resultat?.tester ?? []), ...(klient?.tester ?? [])].map(t => [t.namn, t.status]));
  const server = new Set((resultat?.tester ?? []).map(t => t.namn));
  const testfall = (namn) => {
    const s = status.get(namn) ?? 'saknas';
    if (s === 'saknas') return { namn, status: s, statusText: STATUSTEXT[s], kalla: null, tid: null };
    const k = server.has(namn) ? { kalla: 'Servertest', tid: resultat.tid } : (kallor.get(namn) ?? { kalla: 'Gränssnittstest i webbläsaren', tid: null });
    return { namn, status: s, statusText: STATUSTEXT[s] ?? s, kalla: k.kalla, tid: k.tid };
  };
  const post = (register, id, rubrik, statusKrav, tester, extra = {}) => {
    const tf = tester.map(testfall);
    const resultat = tf.every(t => t.status === 'grön') ? 'godkant' : 'ej_godkant';
    return { register, id, rubrik, kravstatus: statusKrav, ...extra, resultat, resultatText: RESULTATTEXT[resultat], testfall: tf };
  };
  const egnaReg = kravregister(resultat, KRAV, klient);
  const sussaReg = sussaRegister(resultat, klient, { egna: egnaReg });
  const egna = egnaReg.krav.filter(k => k.tester.length).map(k => post('egna', k.id, k.rubrik, k.status, k.tester.map(t => t.namn), { kalla: k.kalla }));
  const sussa = sussaReg.poster.filter(p => p.tester.length).map(p => post('sussa', p.id, p.rubrik, p.status, p.tester.map(t => t.namn), { kravtyp: p.typ ?? null, kategori: p.kategori }));
  const alla = [...egna, ...sussa];
  const summa = { krav: alla.length, godkanda: alla.filter(k => k.resultat === 'godkant').length, testfall: 0, status: tom() };
  for (const t of alla.flatMap(k => k.testfall)) { summa.testfall++; summa.status[t.status] = (summa.status[t.status] ?? 0) + 1; }
  return {
    rubrik: 'Testprotokoll med spårbarhet till krav',
    version: { app: version, kodhash, kort: kodhash ? kodhash.slice(0, 12) : null, testkorning: resultat?.tid ?? null, bun: resultat?.bun ?? null },
    acceptanstest: { gjort: false, text: ACCEPTANSTEST },
    korningar: korning.length ? korning : korningar(resultat, null),
    summa, egna, sussa,
    utanTestfall: {
      egna: egnaReg.krav.filter(k => !k.tester.length).map(k => ({ id: k.id, rubrik: k.rubrik, kravstatus: k.status })),
      sussa: sussaReg.poster.filter(p => !p.tester.length).map(p => ({ id: p.id, rubrik: p.rubrik, kategori: p.kategori })),
    },
  };
}

// Kodhashen räknas en gång per process och katalog, eftersom koden inte ändras medan servern kör.
const hashar = new Map();
const kodhashFor = (src, pub) => { const k = `${src}|${pub}`; if (!hashar.has(k)) hashar.set(k, existsSync(src) ? kodHash(src, pub) : null); return hashar.get(k); };
const APPVERSION = (rot) => { try { return JSON.parse(readFileSync(join(rot, 'package.json'), 'utf8')).version; } catch { return null; } };

// Protokollet ur filerna, som servern och skriptet läser dem.
export function franFiler({ testresultat, klientresultat = {}, appRot = join(import.meta.dir, '..'), src = SRC, pub = PUBLIC } = {}) {
  const resultat = lasTestresultat(testresultat);
  const klient = lasKlientresultat(klientresultat);
  return protokoll({ resultat, klient, kallor: testkallor(klientresultat), korning: korningar(resultat, klientresultat), version: APPVERSION(appRot), kodhash: kodhashFor(src, pub) });
}

// Tiderna står i svensk tid, som i resten av Vårdkällan.
const SVENSK = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const datumText = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'inte kört';
  const [dag, klocka] = SVENSK.format(d).split(' ');
  return `${dag} kl. ${klocka} svensk tid`;
};
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function markdown(p) {
  const v = p.version;
  const ut = ['# Testprotokoll', '',
    `${p.rubrik}, Sussa 11.2.1.7. Version ${v.app ?? 'okänd'}, kod ${v.kort ?? 'okänd'}${v.testkorning ? `, servertesterna körda ${datumText(v.testkorning)}` : ', inga servertester körda'}.`, '',
    p.acceptanstest.text, '',
    'Protokollet skrivs av `app/scripts/testprotokoll-md.js` ur kravregistret (`app/src/krav.js`), Sussa-registret (`app/src/sussa/`) och resultaten från bygget, med `app/src/testprotokoll.js`. Samma protokoll visas på sidan Testprotokoll i demon (`#/testprotokoll`), räknat ur bygget som körs där. Kodhashen är sha256 över `app/src/` och `app/public/` och visar vilken byggd kod resultaten gäller.', '',
    '## Sammanfattning', '',
    `Krav och poster med testfall: ${p.summa.krav}, varav ${p.summa.godkanda} med alla testfall godkända. Testfall: ${p.summa.testfall}, varav ${STATUSORDNING.map(s => `${p.summa.status[s] ?? 0} ${STATUSTEXT[s].toLowerCase()}`).join(', ')}. Krav utan testfall: ${p.utanTestfall.egna.length} i det egna ramverket och ${p.utanTestfall.sussa.length} i Sussas kravspecifikation.`, '',
    '## Körningar', '', '| Körning | Tid | Testfall | Godkända | Ej godkända |', '| --- | --- | --- | --- | --- |',
    ...p.korningar.map(k => `| ${cell(k.kalla)} | ${datumText(k.tid)} | ${k.antal} | ${k.godkanda} | ${k.misslyckade} |`)];
  const avsnitt = (rubrik, lista) => {
    ut.push('', `## ${rubrik}`);
    for (const k of lista) {
      ut.push('', `### ${k.id} ${k.rubrik}`, '', `${k.resultatText}. Status i registret: ${KRAVSTATUS[k.kravstatus] ?? k.kravstatus}.`, '', '| Testfall | Resultat | Körning | Tid |', '| --- | --- | --- | --- |',
        ...k.testfall.map(t => `| ${cell(t.namn)} | ${t.statusText} | ${t.kalla ?? 'inte kört'} | ${datumText(t.tid)} |`));
    }
  };
  avsnitt('Eget ramverk', p.egna);
  avsnitt('Sussas kravspecifikation', p.sussa);
  ut.push('', '## Krav utan testfall', '',
    `Eget ramverk: ${p.utanTestfall.egna.map(k => k.id).join(', ') || 'inga'}.`, '',
    `Sussas kravspecifikation: ${p.utanTestfall.sussa.map(k => k.id).join(', ') || 'inga'}.`);
  return `${ut.join('\n')}\n`;
}
