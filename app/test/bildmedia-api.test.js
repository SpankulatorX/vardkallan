// API för bilder och media 1.1 (runda 11, r5): uppladdning i delar, miniatyr, annotering, import och DICOMweb genom
// servern, med demons bilder för Gunnar Åkesson i mallen.
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createHash } from 'node:crypto';
import { testserver, klient, sandlada } from './hjalp.js';
import { sarPng } from './media-filer.js';
import { bildStorlek } from '../src/bildkodek.js';

let app;
beforeAll(() => { app = testserver(); });
afterAll(() => app.stopp());

const binar = async (k, vag) => {
  const r = await fetch(app.url + vag, { headers: { Cookie: k.kaka() } });
  return { status: r.status, typ: r.headers.get('content-type'), buf: Buffer.from(await r.arrayBuffer()) };
};

describe('API för bilder och media 1.1', () => {
  test('bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb', async () => {
    const k = klient(app);
    await k.logga('lak-kard');
    const db = sandlada(app, k).db;
    const g = await k.get('/api/patient/p01/media');
    expect(g.status).toBe(200);
    expect(g.data.bilder.map(b => b.kroppsstalle)).toEqual(['korsbenet', 'korsbenet', 'korsbenet']);
    expect(g.data.studier[0].arkivet.forvaltFonster).toBe('Mjukdelar');
    const buf = sarPng(1200, 900);
    const s = await k.post('/api/patient/p01/media/uppladdning', { namn: 'sar.png', storlek: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), kroppsstalle: 'Vänster häl' });
    expect(s.status).toBe(201);
    for (let i = 0; i < s.data.delar; i++) {
      const d = await k.post(`/api/media/uppladdning/${s.data.id}/del`, { nr: i, data: buf.subarray(i * s.data.delstorlek, (i + 1) * s.data.delstorlek).toString('base64') });
      expect(d.status).toBe(200);
    }
    const m = await k.post(`/api/media/uppladdning/${s.data.id}/klar`, {});
    expect(m.status).toBe(201);
    expect(m.data).toMatchObject({ kroppsstalle: 'vänster häl', egenskaper: { bredd: 1200, hojd: 900 } });
    const min = await binar(k, `/api/media/${m.data.id}/miniatyr`);
    expect([min.status, min.typ]).toEqual([200, 'image/jpeg']);
    expect(await bildStorlek(min.buf)).toMatchObject({ bredd: 256, hojd: 192 });
    const ladda = await fetch(`${app.url}/api/media/${m.data.id}/fil?ladda=1`, { headers: { Cookie: k.kaka() } });
    expect(ladda.headers.get('content-disposition')).toStartWith('attachment');
    const a = await k.post(`/api/media/${m.data.id}/annoteringar`, { typ: 'ring', punkter: [[0.3, 0.3], [0.6, 0.6]], text: 'Rodnad' });
    expect(a.status).toBe(201);
    expect((await k.get('/api/patient/p01/media')).data.bilder.find(b => b.id === m.data.id).annoteringar.map(x => x.text)).toEqual(['Rodnad']);
    expect((await k.post(`/api/media/annotering/${a.data.id}/ta-bort`, {})).data.borttagen).toBe(true);
    // DICOMweb: sökning på personnumret, instanserna och den renderade bilden.
    const pnr = db.query("SELECT personnummer FROM patienter WHERE id = 'p01'").get().personnummer;
    const q = await k.get(`/api/dicomweb/studies?PatientID=${pnr}`);
    expect(q.headers.get('content-type')).toStartWith('application/dicom+json');
    const studie = q.data[0];
    const uid = studie['0020000D'].Value[0];
    const ser = (await k.get(`/api/dicomweb/studies/${uid}/series`)).data;
    const suid = ser[0]['0020000E'].Value[0];
    const inst = (await k.get(`/api/dicomweb/studies/${uid}/series/${suid}/instances`)).data;
    const iuid = inst[0]['00080018'].Value[0];
    const p10 = await binar(k, `/api/dicomweb/studies/${uid}/series/${suid}/instances/${iuid}`);
    expect(p10.typ).toStartWith('multipart/related; type="application/dicom"');
    const r = await binar(k, `/api/dicomweb/studies/${uid}/series/${suid}/instances/${iuid}/rendered?window=1600,2400`);
    expect([r.status, r.typ]).toEqual([200, 'image/png']);
    expect((await k.get('/api/dicomweb/studies')).status).toBe(400);
    expect((await k.get("/api/dicomweb/studies?PatientID=000000000000")).data).toEqual([]);
  });

  test('bilder 1.1: sjuksköterskan hämtar från apparaten och granskar, och läkaren hämtar bilder från en annan vårdgivare med samtycke', async () => {
    const k = klient(app);
    await k.logga('ssk-kard');
    const a = await k.post('/api/patient/p01/media/apparat/sarkamera', {});
    expect(a.status).toBe(201);
    expect(a.data.bilder[0]).toMatchObject({ status: 'vantar', kroppsstalle: 'korsbenet' });
    const v = await k.get('/api/patient/p01/media');
    expect(v.data.attGranska.map(b => b.id)).toEqual([a.data.bilder[0].id]);
    expect((await k.post(`/api/media/${a.data.bilder[0].id}/granska`, {})).data.status).toBe('journal');
    await k.logga('lak-kard');
    expect((await k.get('/api/patient/p01/media/extern')).data.samtycke).toBe(false);
    expect((await k.post('/api/patient/p01/media/extern', {})).status).toBe(400);
    const h = await k.post('/api/patient/p01/media/extern', { samtycke: true, syfte: 'Tidigare bilder av knät' });
    expect(h.data.bilder).toHaveLength(2);
    expect((await k.get('/api/patient/p01/media')).data.attGranska.map(b => b.kalla.id)).toEqual(['annan_vardgivare', 'annan_vardgivare']);
  });
});
