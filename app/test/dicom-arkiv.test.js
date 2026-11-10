// Det simulerade multimediaarkivet (runda 11, r5, Sussa 4.2.1.3): DICOM-filer, DICOM JSON och renderade bilder.
import { describe, test, expect } from 'bun:test';
import * as d from '../src/dicom-arkiv.js';
import { UNDERSOKNINGAR } from '../src/bilder.js';
import { bildStorlek } from '../src/bildkodek.js';

const S = (undersokning, id = 7) => ({ id, undersokning, uid: `1.3.6.1.4.1.32473.1.9.${id}`, utford: '2026-11-09T07:30:00.000Z' });
const P = { fornamn: 'Bilda', efternamn: 'Fotosson', personnummer: '197501012384', fodd: '1975-01-01', kon: 'kvinna', skyddad: 0 };

// Läser elementen i en DICOM-fil i explicit VR little endian: { 'gggg,eeee': { vr, data } }.
function lasP10(buf) {
  expect(buf.subarray(128, 132).toString('latin1')).toBe('DICM');
  const ut = {};
  let p = 132;
  while (p < buf.length) {
    const g = buf.readUInt16LE(p), e = buf.readUInt16LE(p + 2), vr = buf.toString('latin1', p + 4, p + 6);
    const lang = ['OB', 'OW', 'SQ', 'UN', 'UT', 'UC', 'UR', 'OD', 'OF', 'OL'].includes(vr);
    const n = lang ? buf.readUInt32LE(p + 8) : buf.readUInt16LE(p + 6);
    const fran = p + (lang ? 12 : 8);
    ut[`${g.toString(16).padStart(4, '0')},${e.toString(16).padStart(4, '0')}`] = { vr, data: buf.subarray(fran, fran + n) };
    p = fran + n;
  }
  return ut;
}
const text = (el) => el.data.toString('utf8').replace(/[\0 ]+$/, '');

describe('Simulerat multimediaarkiv med DICOMweb', () => {
  test('en instans är en DICOM-fil i explicit VR little endian med patienten ur journalen och pixeldata i rätt storlek', () => {
    const s = S('dt_hjarna'), u = UNDERSOKNINGAR.dt_hjarna;
    const st = d.struktur(s, u);
    expect(st.serier[0].instanser).toHaveLength(120);
    expect(st.forvaltFonster).toBe('Hjärna');
    const el = lasP10(d.p10(s, u, P, false, st.serier[0], st.serier[0].instanser[59]));
    expect(text(el['0002,0010'])).toBe(d.EXPLICIT_LE);
    expect(text(el['0008,0016'])).toBe('1.2.840.10008.5.1.4.1.1.2');
    expect(text(el['0008,0060'])).toBe('CT');
    expect(text(el['0010,0010'])).toBe('Fotosson^Bilda');
    expect(text(el['0010,0020'])).toBe('19750101-2384');
    expect(text(el['0020,000d'])).toBe(s.uid);
    expect(text(el['0020,0013'])).toBe('60');
    expect(el['0028,0010'].data.readUInt16LE(0)).toBe(128);
    expect(text(el['0028,1052'])).toBe('-1024');
    expect(el['7fe0,0010']).toMatchObject({ vr: 'OW' });
    expect(el['7fe0,0010'].data.length).toBe(128 * 128 * 2);
    expect(text(el['0020,4000'])).toContain('simulerade');
  });

  test('en patient med skyddad identitet är skyddad också i DICOM tills identiteten har visats', () => {
    const s = S('lungrontgen'), u = UNDERSOKNINGAR.lungrontgen;
    const st = d.struktur(s, u);
    const skyddad = { ...P, skyddad: 1 };
    const el = lasP10(d.p10(s, u, skyddad, false, st.serier[0], st.serier[0].instanser[0]));
    expect(text(el['0010,0010'])).toBe('Skyddad identitet');
    expect(text(el['0010,0020'])).not.toContain('2384');
    expect(el['0010,0030'].data.length).toBe(0);
    expect(JSON.stringify(d.studieJson(s, u, skyddad, false, '/api/dicomweb'))).not.toContain('Fotosson');
    expect(JSON.stringify(d.studieJson(s, u, skyddad, true, '/api/dicomweb'))).toContain('Fotosson^Bilda');
  });

  test('DICOM JSON för sökning och metadata följer DICOMwebs format, och pixeldatan är en BulkDataURI', () => {
    const s = S('hoftled'), u = UNDERSOKNINGAR.hoftled;
    const j = d.studieJson(s, u, P, false, '/api/dicomweb');
    expect(j['0020000D']).toEqual({ vr: 'UI', Value: [s.uid] });
    expect(j['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Fotosson^Bilda' }] });
    expect(j['00201208']).toEqual({ vr: 'IS', Value: [3] });
    expect(j['00080061']).toEqual({ vr: 'CS', Value: ['DX'] });
    const m = d.metadataJson(s, u, P, false, '/api/dicomweb');
    expect(m).toHaveLength(3);
    expect(m[2]['7FE00010'].BulkDataURI).toBe(`/api/dicomweb/studies/${s.uid}/series/${s.uid}.1/instances/${s.uid}.1.3`);
    expect(m[0]['00280030']).toEqual({ vr: 'DS', Value: [1.4, 1.4] });
  });

  test('den renderade bilden är en PNG med fönstret, bilderna är desamma varje gång, och ett ogiltigt fönster avvisas', async () => {
    const s = S('dt_hjarna'), u = UNDERSOKNINGAR.dt_hjarna;
    const px = d.pixlar(s, u, 60);
    const hjarna = d.rendera(px, { center: 40, bredd: 80 });
    const ben = d.rendera(px, { center: 600, bredd: 2800 });
    expect(await bildStorlek(hjarna)).toMatchObject({ bredd: 128, hojd: 128, format: 'png' });
    expect(hjarna.equals(ben)).toBe(false);
    expect(d.rendera(d.pixlar(s, u, 60), { center: 40, bredd: 80 }).equals(hjarna)).toBe(true);
    expect(d.lasFonster('40,80')).toEqual({ center: 40, bredd: 80 });
    expect(d.lasFonster('-600,1500,linear')).toEqual({ center: -600, bredd: 1500 });
    expect(() => d.lasFonster('40;80')).toThrow('center,bredd');
    expect(() => d.lasFonster('40,0')).toThrow('center,bredd');
    const foto = d.pixlar(S('hudfoto'), UNDERSOKNINGAR.hudfoto, 1);
    expect(await bildStorlek(d.rendera(foto))).toMatchObject({ bredd: 256, hojd: 192 });
    const mp = d.multipart([Buffer.from('a'), Buffer.from('b')]);
    expect(mp.typ).toMatch(/^multipart\/related; type="application\/dicom"; boundary=/);
    expect(mp.kropp.toString('latin1').match(/Content-Type: application\/dicom/g)).toHaveLength(2);
  });
});
