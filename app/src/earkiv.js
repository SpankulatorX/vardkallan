// Runda 9, r5: export till ett e-arkiv med mappning mot e-arkivets dataelement, mottagningskontroll och signerad
// kvittens (Sussa 5.4.2.3).
//
// E-arkivet är simulerat i demon (Simulerat e-arkiv, demo). Dess dataelement för informationstypen Patientjournal är
// en egen förenklad uppsättning i demon och inte R7e-arkivets eller en verklig leveransöverenskommelse, men mappningen
// görs på samma sätt: varje dataelement hos e-arkivet har en källa i Vårdkällan, och systemet fyller i värdet för varje
// journalhandling i paketet. Indexet ligger som beskrivande metadata i paketet (metadata/descriptive/earkiv-index.xml),
// och mappningen står i paketets dokumentation.
//
// Leveransen: Vårdkällan bygger paketet, signerar ett manifest med paketets SHA-256 med sitt certifikat och skickar båda.
// E-arkivet kontrollerar signaturen och certifikatet, att paketet har den SHA-256 som manifestet säger, och gör sin
// mottagningskontroll av paketet: METS.xml, att varje fil som METS.xml anger finns med rätt storlek och SHA-256, att
// inga filer saknas i METS.xml, mapparna som FGS Paketstruktur kräver och att varje journalhandling i indexet har alla
// obligatoriska dataelement. Svaret är en kvittens som e-arkivet signerar, med resultatet och felen på vanlig svenska.
// Beviset för leveransen sparas (signering.js).
//
// Systemet är experten: arkivarien trycker på Leverera till e-arkivet. Systemet bygger paketet, mappar, skickar och
// säger om e-arkivet tog emot det och annars vad som var fel.
import { createHash } from 'node:crypto';
import { Fel } from './db.js';
import { vardenhetFor, aktivaSparrar } from './atkomst.js';
import { packaUpp } from './zip.js';
import * as signering from './signering.js';
import * as pki from './pki.js';

export const EARKIV = pki.PARTER.earkiv.namn;
export const INFORMATIONSTYP = 'Patientjournal';

const hsa = (db, tabell, id) => (id ? db.query(`SELECT hsa_id FROM ${tabell} WHERE id = ?`).get(id)?.hsa_id ?? null : null);
const enhetNamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? null;

// Journalhandlingarna per slag: tabellen, dokumenttypen, FHIR-resursen i paketet, datumet och den som upprättade dem.
const HANDLINGAR = [
  { tabell: 'anteckningar', resurs: 'Composition', villkor: "status = 'signerad'", typ: (r) => r.typ, datum: (r) => r.signerad_tid ?? r.skapad, av: (r) => r.forfattare_id, version: (r) => r.version ?? 1 },
  { tabell: 'diagnoser', resurs: 'Condition', typ: () => 'Diagnos', datum: (r) => r.datum, av: () => null },
  { tabell: 'matvarden', resurs: 'Observation', typ: () => 'Mätvärde', datum: (r) => r.tid, av: (r) => r.registrerad_av },
  { tabell: 'ordinationer', resurs: 'MedicationRequest', typ: () => 'Läkemedelsordination', datum: (r) => r.skapad, av: (r) => r.ordinerad_av },
  { tabell: 'vardkontakter', resurs: 'Encounter', typ: () => 'Vårdkontakt', datum: (r) => r.start, av: () => null },
  { tabell: 'remisser', resurs: 'ServiceRequest', enhet: (r) => r.fran_enhet_id, typ: () => 'Remiss', datum: (r) => r.skickad_tid, av: () => null },
];

// E-arkivets dataelement och var värdet kommer ifrån i Vårdkällan. obligatorisk säger vad e-arkivet kräver.
export const DATAELEMENT = [
  { namn: 'Arkivbildare', obligatorisk: true, kalla: 'Vårdgivaren i HSA, enheten överst i organisationen' },
  { namn: 'Informationstyp', obligatorisk: true, kalla: `Alltid ${INFORMATIONSTYP}` },
  { namn: 'Patientidentitet', obligatorisk: true, kalla: 'Patientens gällande identitet: personnummer, samordningsnummer eller reservnummer' },
  { namn: 'Patientnamn', obligatorisk: true, kalla: 'Patientens för- och efternamn' },
  { namn: 'SkyddadePersonuppgifter', obligatorisk: true, kalla: 'Markeringen för skyddade personuppgifter, ja eller nej' },
  { namn: 'Dokumenttyp', obligatorisk: true, kalla: 'Anteckningens typ, eller slaget av journalhandling' },
  { namn: 'Dokumentdatum', obligatorisk: true, kalla: 'Signeringstiden för en anteckning, annars tiden då uppgiften registrerades' },
  { namn: 'Vardenhet', obligatorisk: true, kalla: 'HSA-id för vårdenheten där uppgiften registrerades' },
  { namn: 'UpprattadAv', obligatorisk: false, kalla: 'HSA-id för den som skrev, registrerade eller ordinerade' },
  { namn: 'Version', obligatorisk: true, kalla: 'Anteckningens version, 1 för andra uppgifter' },
  { namn: 'Sparr', obligatorisk: true, kalla: 'Om patienten har spärrat vårdenheten, ja eller nej' },
  { namn: 'Sekretess', obligatorisk: true, kalla: 'Alltid offentlighets- och sekretesslagen (2009:400) 25 kap. 1 §' },
  { namn: 'Fil', obligatorisk: true, kalla: 'Filen i paketet där journalhandlingen finns som HL7 FHIR R4' },
  { namn: 'Referens', obligatorisk: true, kalla: 'Resursens fullUrl i filen, till exempel urn:vardkallan:Composition/12' },
];

// Indexet för en patients journalhandlingar, en post per handling med alla dataelement.
export function index(db, pid) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(pid);
  const vg = db.query("SELECT namn FROM enheter WHERE typ = 'vardgivare' ORDER BY rowid LIMIT 1").get()?.namn ?? null;
  const sparrar = aktivaSparrar(db, pid);
  const ut = [];
  for (const h of HANDLINGAR) {
    for (const r of db.query(`SELECT * FROM ${h.tabell} WHERE patient_id = ? ${h.villkor ? `AND ${h.villkor}` : ''} ORDER BY id`).all(pid)) {
      const enhet = h.enhet ? h.enhet(r) : r.enhet_id;
      const ve = vardenhetFor(db, enhet);
      ut.push({
        Arkivbildare: vg ? `${vg} (demo)` : null, Informationstyp: INFORMATIONSTYP, Patientidentitet: p.personnummer, Patientnamn: `${p.fornamn} ${p.efternamn}`,
        SkyddadePersonuppgifter: p.skyddad ? 'ja' : 'nej', Dokumenttyp: h.typ(r), Dokumentdatum: String(h.datum(r) ?? '').slice(0, 19) || null,
        Vardenhet: hsa(db, 'enheter', ve), UpprattadAv: hsa(db, 'personal', h.av(r)), Version: String(h.version ? h.version(r) : 1),
        Sparr: sparrar.includes(ve) ? 'ja' : 'nej', Sekretess: 'Offentlighets- och sekretesslagen (2009:400) 25 kap. 1 §',
        Fil: `representations/rep_1/data/journal/${pid}.json`, Referens: `urn:vardkallan:${h.resurs}/${r.id}`, vardenhetNamn: enhetNamn(db, ve),
      });
    }
  }
  return ut;
}

const xml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export function indexXml(poster) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<earkivindex informationstyp="${INFORMATIONSTYP}" mottagare="${xml(EARKIV)}" antal="${poster.length}">
${poster.map(p => `  <handling>\n${DATAELEMENT.map(d => `    <${d.namn}>${xml(p[d.namn])}</${d.namn}>`).join('\n')}\n  </handling>`).join('\n')}
</earkivindex>
`;
}
const lasIndex = (text) => [...text.matchAll(/<handling>([\s\S]*?)<\/handling>/g)].map(m => Object.fromEntries(DATAELEMENT.map(d => [d.namn, (m[1].match(new RegExp(`<${d.namn}>([^<]*)</${d.namn}>`)) ?? [])[1] ?? null])));

export const mappningDok = () => `## Mappning mot e-arkivets dataelement

Mottagare: ${EARKIV}. Informationstyp: ${INFORMATIONSTYP}. Indexet finns i metadata/descriptive/earkiv-index.xml med en post per journalhandling.

| Dataelement | Obligatoriskt | Källa i Vårdkällan |
|---|---|---|
${DATAELEMENT.map(d => `| ${d.namn} | ${d.obligatorisk ? 'ja' : 'nej'} | ${d.kalla} |`).join('\n')}
`;

const sha = (b) => createHash('sha256').update(b).digest('hex').toUpperCase();
const MAPPAR = ['metadata/', 'metadata/descriptive/', 'metadata/preservation/', 'metadata/other/', 'representations/', 'representations/rep_1/', 'representations/rep_1/data/', 'schemas/', 'documentation/'];

// E-arkivets mottagningskontroll av paketet. Ger { fel, filer, handlingar } där fel är en lista på vanlig svenska.
export function mottagningskontroll(paket) {
  const fel = [];
  let filer;
  try { filer = packaUpp(paket); } catch { return { fel: ['Paketet går inte att packa upp.'], filer: 0, handlingar: 0 }; }
  const rot = [...filer.keys()].find(n => /^IP_[^/]+\/$/.test(n));
  if (!rot) return { fel: ['Paketet saknar en rotmapp med paketets id.'], filer: 0, handlingar: 0 };
  const mets = filer.get(`${rot}METS.xml`)?.data.toString('utf8');
  if (!mets) return { fel: ['METS.xml saknas.'], filer: 0, handlingar: 0 };
  if (!mets.includes(`OBJID="${rot.slice(0, -1)}"`)) fel.push('OBJID i METS.xml stämmer inte med rotmappen.');
  for (const [krav, text] of [['PROFILE="https://earksip.dilcis.eu/profile/E-ARK-SIP.xml"', 'profilen för E-ARK SIP'], ['csip:OAISPACKAGETYPE="SIP"', 'pakettypen SIP'],
    ['ROLE="CREATOR"', 'den som skapade paketet'], ['<structMap', 'en strukturkarta'], ['<dmdSec', 'den beskrivande metadatan']]) {
    if (!mets.includes(krav)) fel.push(`METS.xml saknar ${text}.`);
  }
  for (const m of MAPPAR) if (!filer.has(rot + m)) fel.push(`Mappen ${m} saknas.`);
  const angivna = new Map();
  for (const m of mets.matchAll(/<(?:file|mdRef) [^>]*?SIZE="(\d+)"[^>]*?CHECKSUM="([0-9A-F]{64})"[^>]*?(?:\/>|>\s*<FLocat [^>]*?xlink:href="([^"]+)")/g)) {
    const href = m[3] ?? (m[0].match(/xlink:href="([^"]+)"/) ?? [])[1];
    if (href) angivna.set(href, { storlek: Number(m[1]), sha: m[2] });
  }
  for (const m of mets.matchAll(/<mdRef [^>]*?xlink:href="([^"]+)"[^>]*?SIZE="(\d+)"[^>]*?CHECKSUM="([0-9A-F]{64})"/g)) angivna.set(m[1], { storlek: Number(m[2]), sha: m[3] });
  for (const [vag, f] of angivna) {
    const fil = filer.get(rot + vag);
    if (!fil) { fel.push(`Filen ${vag} finns i METS.xml men inte i paketet.`); continue; }
    if (fil.data.length !== f.storlek) fel.push(`Filen ${vag} har en annan storlek än METS.xml anger.`);
    if (sha(fil.data) !== f.sha) fel.push(`Filen ${vag} har en annan SHA-256 än METS.xml anger.`);
  }
  for (const n of filer.keys()) {
    const vag = n.slice(rot.length);
    if (!n.startsWith(rot) || n.endsWith('/') || vag === 'METS.xml') continue;
    if (!angivna.has(vag)) fel.push(`Filen ${vag} finns i paketet men inte i METS.xml.`);
  }
  const idx = filer.get(`${rot}metadata/descriptive/earkiv-index.xml`)?.data.toString('utf8');
  let handlingar = 0;
  if (!idx) fel.push('Indexet med e-arkivets dataelement saknas.');
  else {
    const poster = lasIndex(idx);
    handlingar = poster.length;
    poster.forEach((p, i) => {
      const saknas = DATAELEMENT.filter(d => d.obligatorisk && !p[d.namn]).map(d => d.namn);
      if (saknas.length) fel.push(`Journalhandling ${i + 1} i indexet saknar ${saknas.join(', ')}.`);
      else if (!filer.has(rot + p.Fil)) fel.push(`Journalhandling ${i + 1} i indexet pekar på en fil som inte finns.`);
    });
  }
  return { fel, filer: [...filer.keys()].filter(n => !n.endsWith('/')).length, handlingar };
}

// Manifestet som Vårdkällan signerar: paketets id, storlek och SHA-256.
export const manifest = (objid, paket) => ({ paket: objid, storlek: paket.length, sha256: sha(paket), informationstyp: INFORMATIONSTYP });

// Det simulerade e-arkivet tar emot: kontrollerar signaturen, att paketet är det som manifestet säger och paketet självt,
// och signerar kvittensen. andraPaket finns för testerna, som ändrar paketet på vägen.
function earkivetTarEmot(m, innehall, paket, aterkallade) {
  const kontroll = mottagningskontroll(paket);
  const fel = [...(sha(paket) !== innehall.sha256 || paket.length !== innehall.storlek ? ['Paketet stämmer inte med det signerade manifestet.'] : []), ...kontroll.fel];
  const kv = signering.kvittera('earkiv', m, innehall, { aterkallade, kontroll: () => (fel.length ? `Mottagningskontrollen hittade fel: ${fel.slice(0, 10).join(' ')}` : null) });
  return { kv, kontroll: { ...kontroll, fel } };
}

// Leverans av ett exportpaket som redan är byggt (arkiv.exportera). Ger kvittensens resultat och mottagningskontrollen.
export function leverera(db, { objid, paket, enhetId = 'rol', paketPaVagen = (p) => p }) {
  let kontroll = null;
  const bevis = signering.skicka(db, {
    typ: 'earkiv', kalla: `arkivexporter:${objid}`, enhetId, innehall: manifest(objid, paket),
    mottagaren: (m, innehall) => { const r = earkivetTarEmot(m, innehall, paketPaVagen(paket), pki.aterkallade(db)); kontroll = r.kontroll; return r.kv; },
  });
  return { paket: objid, status: bevis.status, orsak: bevis.orsak, mottagare: EARKIV, tid: bevis.tid, bevis: bevis.id, kontroll };
}

// Leveransen för ett paket, för beslutet i gränssnittet.
export function leveransFor(db, objid) {
  const b = signering.forKalla(db, `arkivexporter:${objid}`).at(-1);
  return b ? { status: b.status, orsak: b.orsak, tid: b.tid, mottagare: EARKIV, bevis: b.id } : null;
}

export function kontrolleraLeverans(db, bevisId) {
  const r = db.query("SELECT kalla FROM signerade_meddelanden WHERE id = ? AND typ = 'earkiv'").get(bevisId);
  if (!r) throw new Fel(404, 'Leveransen finns inte.', 'saknas');
  const e = db.query('SELECT * FROM arkivexporter WHERE id = ?').get(r.kalla.split(':')[1]);
  return signering.kontrolleraBevis(db, bevisId, e ? { paket: e.id, storlek: e.storlek, sha256: e.sha256, informationstyp: INFORMATIONSTYP } : undefined);
}
