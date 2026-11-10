// Det simulerade multimediaarkivet med DICOMweb (runda 11, r5, Sussa 4.2.1.3).
//
// Studierna som beställs i bilder.js lagras i ett simulerat arkiv (som ett VNA eller ett DICOM PACS). Arkivet svarar på
// DICOMweb: QIDO-RS för sökning efter studier, serier och instanser (DICOM JSON), WADO-RS för hämtning av instanserna som
// DICOM-filer (Part 10, explicit VR little endian), metadata och renderade bilder (PNG med fönster). En extern visare som
// talar DICOMweb kan därför anslutas till samma adress, med samma behörighet och loggning som journalen.
//
// Systemet är experten: det väljer fönstret efter undersökningen (hjärnfönster för datortomografi av hjärnan,
// lungfönster för lungröntgen), räknar fram pixelavståndet så att mätningar blir i millimeter och sätter patientens
// identitet i studien ur journalen, så att ingen behöver skriva in den. En patient med skyddad identitet visas som
// skyddad också i DICOM, om inte identiteten har visats efter ett aktivt val.
//
// Arkivet och bilderna är simulerade: bilderna räknas fram av systemet ur undersökningen och bildnumret och visar inga
// verkliga patienter. XDS-I.b är en dokumenterad integrationspunkt och inte byggd (docs/design.md).
import { Fel, datumAv } from './db.js';
import { visningsnamn, visningsPnr } from './atkomst.js';
import { OID_ROT } from './identitet.js';
import { kodaPng, Duk } from './bildkodek.js';
import { tabell } from './specialist-hjalp.js';

export const SIMULERAT = 'Arkivet och bilderna är simulerade. Bilderna räknas fram av systemet och visar inga verkliga patienter.';
export const EXPLICIT_LE = '1.2.840.10008.1.2.1';
const IMPL_UID = `${OID_ROT}.9.0.1`;

// Modaliteterna i arkivet: SOP-klass, bildstorlek, pixelavstånd i millimeter och fönstren som systemet föreslår.
export const MODALITETER = tabell({
  DX: { sop: '1.2.840.10008.5.1.4.1.1.1.1', namn: 'Digital röntgen', rader: 256, kolumner: 256, avstand: 1.4, fonster: [['Standard', 2048, 4096], ['Ben', 2800, 2000], ['Mjukdelar', 1600, 2400]] },
  CT: { sop: '1.2.840.10008.5.1.4.1.1.2', namn: 'Datortomografi', rader: 128, kolumner: 128, avstand: 1.8, intercept: -1024, fonster: [['Hjärna', 40, 80], ['Ben', 600, 2800], ['Mjukdelar', 50, 400]] },
  MR: { sop: '1.2.840.10008.5.1.4.1.1.4', namn: 'Magnetkamera', rader: 128, kolumner: 128, avstand: 1.8, fonster: [['Standard', 600, 1200]] },
  US: { sop: '1.2.840.10008.5.1.4.1.1.6.1', namn: 'Ultraljud', rader: 192, kolumner: 256, avstand: 0.3, fonster: [['Standard', 128, 256]] },
  XC: { sop: '1.2.840.10008.5.1.4.1.1.77.1.4', namn: 'Fotografi', rader: 192, kolumner: 256, avstand: 0.1, rgb: true, fonster: [] },
});
// Fönstret som systemet väljer först för en undersökning, när det inte är modalitetens första.
const FORVAL = { lungrontgen: 'Mjukdelar', hoftled: 'Ben', dt_hjarna: 'Hjärna' };
export const modalitetFor = (m) => MODALITETER[m] ?? MODALITETER.DX;

// ---- Studiens uppbyggnad -------------------------------------------------------------------------------------------

// Studien har en serie med undersökningens bilder. Uid:n bygger på studiens uid i demons OID-rot.
export function struktur(s, u) {
  const mod = modalitetFor(u.modalitet);
  const serie = `${s.uid}.1`;
  return {
    studie: s.uid, modalitet: u.modalitet, mod,
    serier: [{ uid: serie, nummer: 1, beskrivning: u.namn, antal: u.bilder, instanser: Array.from({ length: u.bilder }, (_, i) => ({ uid: `${serie}.${i + 1}`, nummer: i + 1 })) }],
    fonster: mod.fonster.map(([namn, c, w]) => ({ namn, center: c, bredd: w })),
    forvaltFonster: FORVAL[s.undersokning] ?? mod.fonster[0]?.[0] ?? null,
  };
}
export function instansFor(st, serieUid, instansUid) {
  const se = st.serier.find(x => x.uid === serieUid);
  const i = se?.instanser.find(x => x.uid === instansUid);
  if (!se || !i) throw new Fel(404, 'Bilden finns inte i studien.', 'saknas');
  return { serie: se, instans: i };
}

// ---- De simulerade bilderna ----------------------------------------------------------------------------------------

// Ett slumptal som alltid blir detsamma för samma studie och bild, så att bilden ser likadan ut varje gång.
function slump(fro) {
  let a = fro >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const inom = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// Pixlarna för en bild: 16 bitar (12 lagrade) i gråskala, eller RGB för fotografier.
export function pixlar(s, u, nr) {
  const mod = modalitetFor(u.modalitet);
  const R = mod.rader, K = mod.kolumner;
  const r = slump(s.id * 7919 + nr * 104729);
  if (mod.rgb) {
    const d = new Duk(K, R, [214, 170, 140]);
    for (let i = 0; i < d.px.length; i += 3) { const n = Math.round((r() - 0.5) * 14); d.px[i] += n; d.px[i + 1] += n; d.px[i + 2] += n; }
    const cx = 128 + (nr - 2) * 6, cy = 96;
    for (let k = 0; k < 24; k++) d.ellips(cx + (r() - 0.5) * 30, cy + (r() - 0.5) * 22, 12 + r() * 10, 10 + r() * 8, [96 - k, 58, 36], 0.5);
    d.ellips(cx, cy, 16, 13, [70, 40, 26], 0.7);
    for (let x = 20; x < 236; x += 10) d.fyll(x, 172, 1, x % 50 === 20 ? 12 : 6, [30, 30, 30]);
    return { rader: R, kolumner: K, rgb: true, data: d.px };
  }
  const data = new Uint16Array(R * K);
  const satt = (x, y, v) => { data[y * K + x] = Math.max(0, Math.min(4095, Math.round(v + (r() - 0.5) * (mod === MODALITETER.CT ? 8 : 70)))); };
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < K; x++) {
      let v;
      if (u.modalitet === 'CT' || u.modalitet === 'MR') {
        const z = (nr - 1) / Math.max(1, u.bilder - 1);
        const f = Math.sqrt(Math.max(0, 1 - ((z - 0.5) / 0.55) ** 2));
        const yt = 0.75 + 0.25 * f;
        const ct = u.modalitet === 'CT';
        // Huvudet: luft, skalle, hjärna och ventriklar. Värdena är Hounsfield-enheter plus 1024 för datortomografi.
        if (!inom(x, y, 64, 64, 54 * f + 2, 60 * yt * f + 2)) v = ct ? 24 : 0;
        else if (!inom(x, y, 64, 64, 48 * f, 54 * yt * f)) v = ct ? 1024 + 1300 : 120;
        else if (z > 0.35 && z < 0.65 && (inom(x, y, 56, 60, 5, 14 * f) || inom(x, y, 72, 60, 5, 14 * f))) v = ct ? 1024 + 8 : 1100;
        else v = ct ? 1024 + (inom(x, y, 64, 64, 34 * f, 40 * yt * f) ? 38 : 30) : (inom(x, y, 64, 64, 34 * f, 40 * yt * f) ? 520 : 700);
      } else if (u.modalitet === 'US') {
        const vinkel = Math.atan2(x - K / 2, y + 10), avst = Math.hypot(x - K / 2, y + 10);
        v = Math.abs(vinkel) < 0.7 && avst > 20 && avst < R ? (inom(x, y, K / 2, R * 0.55, 30, 20) ? 20 : 90 + r() * 120) : 0;
      } else if (s.undersokning === 'hoftled') {
        const sida = nr === 3 ? 1 : 0;
        v = 300;
        if (inom(x, y, 128, 128, 120, 125)) v = 1500;
        if (inom(x, y, 128, 70, 90, 50) && !inom(x, y, 128, 80, 60, 32)) v = 2900;
        for (const cx of sida ? [96] : [64, 192]) {
          if (inom(x, y, cx, 138, 22, 22)) v = 3200;
          if (y > 150 && Math.abs(x - (cx + (cx < 128 ? 14 : -14))) < 14) v = 3000;
        }
      } else {
        const lateral = nr === 2;
        v = 250;
        if (inom(x, y, 128, 140, lateral ? 80 : 112, 122)) v = 2300;
        if (lateral ? inom(x, y, 124, 118, 50, 72) : inom(x, y, 84, 118, 38, 72) || inom(x, y, 172, 118, 38, 72)) v = 850;
        if (!lateral && inom(x, y, 142, 162, 42, 34)) v = 2200;
        if (!lateral && Math.abs(x - 128) < 9) v = 3300;
        if (lateral && Math.abs(x - 182) < 10 && y > 30) v = 3300;
        if (!lateral && y > 40 && y < 175 && (y - 40) % 22 < 3 && inom(x, y, 128, 118, 100, 80)) v += 500;
      }
      satt(x, y, v);
    }
  }
  return { rader: R, kolumner: K, rgb: false, data, intercept: mod.intercept ?? 0 };
}

// En renderad bild (PNG) med fönstret center och bredd, i modalitetens enheter (Hounsfield för datortomografi).
export function rendera(px, { center, bredd } = {}) {
  if (px.rgb) return kodaPng(px.data, px.kolumner, px.rader, 3);
  const ut = new Uint8Array(px.rader * px.kolumner);
  const c = Number.isFinite(center) ? center : 2048 + (px.intercept ?? 0);
  const w = Number.isFinite(bredd) && bredd >= 1 ? bredd : 4096;
  for (let i = 0; i < ut.length; i++) {
    const v = px.data[i] + (px.intercept ?? 0);
    ut[i] = Math.max(0, Math.min(255, Math.round(((v - (c - 0.5)) / (w - 1) + 0.5) * 255)));
  }
  return kodaPng(ut, px.kolumner, px.rader, 1);
}

// Fönstret ur DICOMwebs parameter window=center,bredd[,funktion]. Ett fönster utanför rimliga gränser avvisas.
export function lasFonster(v) {
  if (v == null || v === '') return {};
  const m = /^(-?\d{1,5}(?:\.\d{1,3})?),(\d{1,5}(?:\.\d{1,3})?)(?:,linear)?$/i.exec(String(v));
  if (!m || Number(m[2]) < 1) throw new Fel(400, 'Fönstret anges som center,bredd, till exempel 40,80.', 'ogiltig', { falt: ['window'] });
  return { center: Number(m[1]), bredd: Number(m[2]) };
}

// ---- DICOM Part 10 -------------------------------------------------------------------------------------------------

const LANG4 = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT']);
function element(grupp, elem, vr, varde) {
  let data;
  if (Buffer.isBuffer(varde)) data = varde;
  else if (vr === 'US') { data = Buffer.alloc(2); data.writeUInt16LE(varde); }
  else if (vr === 'UL') { data = Buffer.alloc(4); data.writeUInt32LE(varde); }
  else data = Buffer.from(String(varde), 'utf8');
  if (data.length % 2) data = Buffer.concat([data, Buffer.from([vr === 'UI' || vr === 'OB' ? 0 : 0x20])]);
  const h = Buffer.alloc(LANG4.has(vr) ? 12 : 8);
  h.writeUInt16LE(grupp, 0); h.writeUInt16LE(elem, 2); h.write(vr, 4, 'latin1');
  if (LANG4.has(vr)) h.writeUInt32LE(data.length, 8); else h.writeUInt16LE(data.length, 6);
  return Buffer.concat([h, data]);
}

// Personnamn i DICOM: efternamn^förnamn. En skyddad identitet står som den visas i journalen.
const pnDicom = (p, visad) => (p.skyddad && !visad ? visningsnamn(p, false) : `${p.efternamn}^${p.fornamn}`);
const datumDicom = (iso) => (iso ? datumAv(new Date(iso)).replaceAll('-', '') : '');
const tidDicom = (iso) => (iso ? new Date(iso).toISOString().slice(11, 19).replaceAll(':', '') : '');

// Uppgifterna om studien som står i varje instans och i sökningens svar.
export function studieAttribut(s, u, p, visad) {
  return {
    namn: pnDicom(p, visad), pid: visningsPnr(p, visad), fodd: p.skyddad && !visad ? '' : String(p.fodd ?? '').replaceAll('-', ''), kon: p.kon === 'kvinna' ? 'F' : p.kon === 'man' ? 'M' : 'O',
    datum: datumDicom(s.utford), tid: tidDicom(s.utford), beskrivning: u.namn, accession: `VK${String(s.id).padStart(6, '0')}`,
  };
}

// En instans som DICOM-fil: 128 byte förord, DICM, filhuvudet (grupp 0002) och data i explicit VR little endian.
export function p10(s, u, p, visad, serie, instans) {
  const st = struktur(s, u);
  const mod = st.mod;
  const a = studieAttribut(s, u, p, visad);
  const px = pixlar(s, u, instans.nummer);
  const fonster = mod.fonster.find(f => f[0] === st.forvaltFonster) ?? mod.fonster[0];
  const ds = [
    element(0x0008, 0x0005, 'CS', 'ISO_IR 192'),
    element(0x0008, 0x0016, 'UI', mod.sop),
    element(0x0008, 0x0018, 'UI', instans.uid),
    element(0x0008, 0x0020, 'DA', a.datum),
    element(0x0008, 0x0030, 'TM', a.tid),
    element(0x0008, 0x0050, 'SH', a.accession),
    element(0x0008, 0x0060, 'CS', u.modalitet),
    element(0x0008, 0x0070, 'LO', 'Vårdkällan, simulerat arkiv'),
    element(0x0008, 0x1030, 'LO', a.beskrivning),
    element(0x0010, 0x0010, 'PN', a.namn),
    element(0x0010, 0x0020, 'LO', a.pid),
    element(0x0010, 0x0021, 'LO', 'Vårdkällan (demo)'),
    element(0x0010, 0x0030, 'DA', a.fodd),
    element(0x0010, 0x0040, 'CS', a.kon),
    element(0x0020, 0x000d, 'UI', s.uid),
    element(0x0020, 0x000e, 'UI', serie.uid),
    element(0x0020, 0x0010, 'SH', String(s.id)),
    element(0x0020, 0x0011, 'IS', String(serie.nummer)),
    element(0x0020, 0x0013, 'IS', String(instans.nummer)),
    element(0x0020, 0x4000, 'LT', SIMULERAT),
    element(0x0028, 0x0002, 'US', px.rgb ? 3 : 1),
    element(0x0028, 0x0004, 'CS', px.rgb ? 'RGB' : 'MONOCHROME2'),
    ...(px.rgb ? [element(0x0028, 0x0006, 'US', 0)] : []),
    element(0x0028, 0x0010, 'US', px.rader),
    element(0x0028, 0x0011, 'US', px.kolumner),
    element(0x0028, 0x0030, 'DS', `${mod.avstand}\\${mod.avstand}`),
    element(0x0028, 0x0100, 'US', px.rgb ? 8 : 16),
    element(0x0028, 0x0101, 'US', px.rgb ? 8 : 12),
    element(0x0028, 0x0102, 'US', px.rgb ? 7 : 11),
    element(0x0028, 0x0103, 'US', 0),
    ...(px.rgb ? [] : [
      element(0x0028, 0x1050, 'DS', String(fonster?.[1] ?? 2048)),
      element(0x0028, 0x1051, 'DS', String(fonster?.[2] ?? 4096)),
      element(0x0028, 0x1052, 'DS', String(px.intercept ?? 0)),
      element(0x0028, 0x1053, 'DS', '1'),
    ]),
    element(0x7fe0, 0x0010, px.rgb ? 'OB' : 'OW', px.rgb ? Buffer.from(px.data) : Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength)),
  ];
  const meta = Buffer.concat([
    element(0x0002, 0x0001, 'OB', Buffer.from([0, 1])),
    element(0x0002, 0x0002, 'UI', mod.sop),
    element(0x0002, 0x0003, 'UI', instans.uid),
    element(0x0002, 0x0010, 'UI', EXPLICIT_LE),
    element(0x0002, 0x0012, 'UI', IMPL_UID),
    element(0x0002, 0x0013, 'SH', 'VARDKALLAN_11'),
  ]);
  return Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'latin1'), element(0x0002, 0x0000, 'UL', meta.length), meta, ...ds]);
}

// WADO-RS svarar med multipart/related, en del per instans.
export function multipart(delar, typ = 'application/dicom') {
  const grans = `vk-del-${delar.length}-${Date.now().toString(36)}`;
  const kropp = Buffer.concat([...delar.flatMap(d => [Buffer.from(`--${grans}\r\nContent-Type: ${typ}\r\n\r\n`, 'latin1'), d, Buffer.from('\r\n', 'latin1')]), Buffer.from(`--${grans}--\r\n`, 'latin1')]);
  return { kropp, typ: `multipart/related; type="${typ}"; boundary=${grans}` };
}

// ---- DICOM JSON (QIDO-RS och metadata) -----------------------------------------------------------------------------

const V = (vr, ...varden) => ({ vr, ...(varden.length && varden.every(v => v !== '' && v != null) ? { Value: varden } : {}) });
const PN = (namn) => ({ vr: 'PN', Value: [{ Alphabetic: namn }] });

export function studieJson(s, u, p, visad, bas) {
  const st = struktur(s, u);
  const a = studieAttribut(s, u, p, visad);
  return {
    '00080005': V('CS', 'ISO_IR 192'), '00080020': V('DA', a.datum), '00080030': V('TM', a.tid), '00080050': V('SH', a.accession), '00080061': V('CS', u.modalitet),
    '00081030': V('LO', a.beskrivning), '00081190': V('UR', `${bas}/studies/${s.uid}`), '00100010': PN(a.namn), '00100020': V('LO', a.pid), '00100030': V('DA', a.fodd),
    '00100040': V('CS', a.kon), '0020000D': V('UI', s.uid), '00200010': V('SH', String(s.id)),
    '00201206': V('IS', st.serier.length), '00201208': V('IS', st.serier.reduce((n, x) => n + x.antal, 0)),
  };
}
export function serieJson(s, u, serie, bas) {
  return { '00080060': V('CS', u.modalitet), '0008103E': V('LO', serie.beskrivning), '00081190': V('UR', `${bas}/studies/${s.uid}/series/${serie.uid}`), '0020000D': V('UI', s.uid),
    '0020000E': V('UI', serie.uid), '00200011': V('IS', serie.nummer), '00201209': V('IS', serie.antal) };
}
export function instansJson(s, u, serie, instans, bas) {
  const mod = modalitetFor(u.modalitet);
  return { '00080016': V('UI', mod.sop), '00080018': V('UI', instans.uid), '00081190': V('UR', `${bas}/studies/${s.uid}/series/${serie.uid}/instances/${instans.uid}`),
    '0020000D': V('UI', s.uid), '0020000E': V('UI', serie.uid), '00200013': V('IS', instans.nummer), '00280010': V('US', mod.rader), '00280011': V('US', mod.kolumner) };
}
// Metadata för alla instanser i studien, med pixeldata som BulkDataURI.
export function metadataJson(s, u, p, visad, bas) {
  const st = struktur(s, u);
  const mod = st.mod;
  const studie = studieJson(s, u, p, visad, bas);
  return st.serier.flatMap(se => se.instanser.map(i => ({
    ...studie, ...serieJson(s, u, se, bas), ...instansJson(s, u, se, i, bas),
    '00280002': V('US', mod.rgb ? 3 : 1), '00280004': V('CS', mod.rgb ? 'RGB' : 'MONOCHROME2'), '00280030': V('DS', mod.avstand, mod.avstand),
    '00280100': V('US', mod.rgb ? 8 : 16), '00280101': V('US', mod.rgb ? 8 : 12),
    ...(mod.rgb ? {} : { '00281052': V('DS', mod.intercept ?? 0), '00281053': V('DS', 1) }),
    '7FE00010': { vr: mod.rgb ? 'OB' : 'OW', BulkDataURI: `${bas}/studies/${s.uid}/series/${se.uid}/instances/${i.uid}` },
  })));
}
