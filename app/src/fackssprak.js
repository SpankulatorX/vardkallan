// Nationellt fackspråk (runda 9, r4, Sussa 5.1.3.2 och 5.1.3.4). NF består av begreppssystemet Snomed CT,
// klassifikationerna (ICD-10-SE och KVÅ används här) och termerna i Socialstyrelsens termbank. Det här är Vårdkällans
// delmängd av Snomed CT, hur klassifikationerna används och vilka termer ur termbanken som gränssnittet använder.
//
// Systemet är experten: koden sätts av systemet ur det användaren redan gör. Den som skriver en anteckning väljer
// sökordet Bedömning och anteckningen får Snomed CT 424836000, en NEWS2-kontroll får både KVÅ QD008 och Snomed CT
// 304495004, och en odling med växt av E. coli får fyndets kod. Ingen behöver kunna kodverken.
//
// Koderna i delmängden är begrepp i den internationella utgåvan av Snomed CT, som också ingår i den svenska utgåvan.
// display är den engelska föredragna termen, kontrollerad mot tx.fhir.org (SNOMED CT International Edition 20250201)
// 2026-11-08, och text är Vårdkällans svenska benämning. Den svenska utgåvan kräver licens och är inte kontrollerad
// här. Varje identitet kontrolleras dessutom i bygget med Snomed CT:s kontrollsiffra (Verhoeff) och partition.
import { SYSTEM, KVA, ICD10SE, K11 } from './kodverk.js';
import { FYND, ROR } from './labb-katalog.js';
import { BEGREPP } from './informationsmodell.js';

export const SNOMED = SYSTEM.snomed;
// Den svenska utgåvans modul i Snomed CT och versionen som delmängden är kontrollerad mot.
export const SVENSK_UTGAVA = `${SNOMED}/45991000052106`;
export const KONTROLLERAD_MOT = `${SNOMED}/900000000000207008/version/20250201`;

// Sökorden i journalens mallar (journal.js). Ett sökord utan exakt motsvarighet får ingen kod hellre än en som är fel,
// och varför står i ingen.
export const SOKORD = {
  'Kontaktorsak': { code: '1269489004', display: 'Chief complaint' },
  'Anamnes': { code: '422625006', display: 'History of present illness section' },
  'Aktuellt': { code: '1184595009', display: 'Present problem document section' },
  'Status': { code: '5880005', display: 'Physical examination' },
  'Bedömning': { code: '424836000', display: 'Assessment section' },
  'Åtgärd': { code: '1184587005', display: 'Plan of care document section' },
  'Prioritet': { code: '225390008', display: 'Triage' },
  'Orsak till vård': { code: '1269557005', display: 'Reason for hospital admission' },
  'Förlopp': { code: '263502005', display: 'Clinical course' },
  'Läkemedelsförändringar': { code: '182838006', display: 'Change of medication' },
  'Uppföljning': { code: '308273005', display: 'Follow-up status' },
  'Kommunikation': { code: '263536004', display: 'Communication' },
  'Nutrition': { code: '384759009', display: 'Nutrition' },
  'Elimination': { code: '106019003', display: 'Elimination pattern' },
  'Aktivitet': { code: '68130003', display: 'Physical activity' },
  'Sömn': { code: '258158006', display: 'Sleep' },
  'Smärta': { code: '22253000', display: 'Pain' },
  'Psykosocialt': { code: '87996002', display: 'Psychosocial status' },
  'Planering': { code: '1184587005', display: 'Plan of care document section' },
  // Runda 8, r5: mallen för tobaksvanor.
  'Tobak och nikotin': { code: '229819007', display: 'Tobacco use and exposure' },
  // Runda 9: sökorden i mallen för levnadsvanor (levnadsvanor.js).
  'Alkohol': { code: '228273003', display: 'Finding relating to alcohol drinking behavior' },
  'Fysisk aktivitet': { code: '68130003', display: 'Physical activity' },
  'Matvanor': { code: '41829006', display: 'Dietary finding' },
  'Stöd': { ingen: 'Stödet är åtgärden som systemet föreslår ur svaren, och den får sin kod i KVÅ när den registreras, inte som sökord.' },
  'Kommentar': { ingen: 'En kommentar är fri text utan eget innehåll i Snomed CT, så sökordet får ingen kod.' },
  'Andning/cirkulation': { ingen: 'Sökordet täcker två områden i omvårdnadens struktur. Snomed CT har ett begrepp för vart och ett men inget för båda, så sökordet får ingen kod.' },
  'Hud/vävnad': { ingen: 'Snomed CT har kroppsstrukturen hud men inget begrepp för omvårdnadsområdet hud och vävnad, så sökordet får ingen kod.' },
};

// Åtgärderna med KVÅ och samma åtgärd i Snomed CT. Åtgärder utan exakt motsvarighet har ingen Snomed-kod.
export const ATGARDER = {
  QD008: { code: '304495004', display: 'Monitoring of blood pressure, temperature, pulse rate and respiratory rate' },
  PA001: { code: '444714004', display: 'Assessment of consciousness level' },
  XV015: { code: '182836005', display: 'Review of medication' },
};

// Delmängden: sökord, fynd och åtgärder, och provtyperna och fynden i beställning och svar (labb-katalog.js).
export function delmangd() {
  const ut = [];
  for (const [sokord, k] of Object.entries(SOKORD)) if (k.code) ut.push({ grupp: 'sökord', text: sokord, ...k });
  for (const [kva, k] of Object.entries(ATGARDER)) ut.push({ grupp: 'åtgärd', text: KVA[kva], kva, ...k });
  for (const f of Object.values(FYND)) ut.push({ grupp: 'fynd', text: f.text, code: f.snomed, display: f.display });
  const prov = new Map();
  // Runda 10, r6: en undersökning utan provtagning har ingen provtyp.
  for (const r of Object.values(ROR)) if (r.snomed && !prov.has(r.snomed)) prov.set(r.snomed, { grupp: 'provtyp', text: r.material, code: r.snomed, display: r.snomedText });
  ut.push(...prov.values());
  return ut;
}

// Koderna för Svenska barnhälsovårdsregistret i den svenska utgåvan (bilaga K11). De har ingen engelsk term att
// kontrollera mot, så bara identiteten kontrolleras.
export function svenskaKoder() {
  const ut = [];
  for (const [id, t] of Object.entries(K11.tillvaxt)) ut.push({ grupp: 'tillväxt', id, code: t.kod, text: t.text });
  for (const [id, v] of Object.entries(K11.vaccination)) for (const del of ['typ', 'varde']) ut.push({ grupp: 'vaccination', id: `${id}.${del}`, code: v[del].kod, text: v[del].text });
  return ut;
}

// Snomed CT:s kontrollsiffra är Verhoeffs. Tabellerna är Verhoeffs multiplikation, permutation och invers.
const D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
const P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];
export function verhoeffGiltig(tal) {
  let c = 0;
  const siffror = String(tal).split('').reverse().map(Number);
  siffror.forEach((d, i) => { c = D[c][P[i % 8][d]]; });
  return c === 0;
}

// En identitet för ett begrepp i Snomed CT: 6 till 18 siffror, ingen inledande nolla, rätt kontrollsiffra och
// partitionen 00 (begrepp i den internationella utgåvan) eller 10 (begrepp i en nationell utgåva).
export function provaBegrepp(id) {
  const t = String(id ?? '');
  if (!/^[1-9]\d{5,17}$/.test(t)) return { ok: false, varfor: 'En identitet i Snomed CT har 6 till 18 siffror och börjar inte med 0.' };
  if (!verhoeffGiltig(t)) return { ok: false, varfor: `Kontrollsiffran i ${t} stämmer inte. Koden är troligen felskriven.` };
  const partition = t.slice(-3, -1);
  if (partition === '00') return { ok: true, utgava: 'internationell' };
  if (partition === '10') return { ok: true, utgava: 'nationell', namnrymd: t.slice(-10, -3) };
  return { ok: false, varfor: `${t} är inte ett begrepp i Snomed CT utan en annan sorts identitet (partition ${partition}).` };
}

// Koden för ett sökord, i den form FHIR använder, eller null.
export function sokordKod(sokord) {
  const k = Object.hasOwn(SOKORD, sokord) ? SOKORD[sokord] : null;
  return k?.code ? { system: SNOMED, code: k.code, display: k.display } : null;
}

// NF:s delar och hur Vårdkällan använder dem, för API:t och dokumentationen. Inga patientuppgifter.
export function oversikt() {
  const d = delmangd();
  return {
    delar: [
      { del: 'Snomed CT', slag: 'begreppssystem', system: SNOMED, svenskUtgava: SVENSK_UTGAVA, kontrolleradMot: KONTROLLERAD_MOT,
        anvands: 'Sökorden i journalens mallar, åtgärder med KVÅ, provtyper och fynd i odlingar, och tillväxt och vaccination i barnhälsovården.',
        antal: d.length + svenskaKoder().length },
      { del: 'ICD-10-SE', slag: 'klassifikation', system: SYSTEM.icd10se, anvands: 'Diagnoser. Systemet visar Socialstyrelsens titel, så användaren söker på text.', antal: Object.keys(ICD10SE).length },
      { del: 'KVÅ', slag: 'klassifikation', system: SYSTEM.kva, anvands: 'Åtgärder som systemet registrerar själv, till exempel NEWS2-kontroller och läkemedelsgenomgångar.', antal: Object.keys(KVA).length },
      { del: 'Socialstyrelsens termbank', slag: 'termer', anvands: 'Begreppen i informationsmodellen och i gränssnittet, med termbankens definition.', antal: Object.keys(BEGREPP).length },
    ],
    delmangd: d,
    svenskaKoder: svenskaKoder(),
    sokordUtanKod: Object.entries(SOKORD).filter(([, k]) => k.ingen).map(([sokord, k]) => ({ sokord, varfor: k.ingen })),
    termer: Object.values(BEGREPP).map(b => ({ term: b.term, definition: b.definition })),
  };
}
