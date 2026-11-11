// Bildkodeken för bilder och media (runda 11, r5, Sussa 4.2.1.2 och 4.2.1.4): typen ur innehållet, metadata ur EXIF,
// film och ljud, miniatyrer som servern gör och taken på allt som tolkas.
import { describe, test, expect } from 'bun:test';
import * as k from '../src/bildkodek.js';
import { sarPng, jpeg, mp4, webm, wav, bombPng } from './media-filer.js';

describe('Bildkodek', () => {
  test('typen avgörs ur innehållet för bilder, filmer, ljud och PDF, och annat stöds inte', async () => {
    const typ = (b) => k.typUrInnehall(b)?.typ ?? null;
    expect(typ(sarPng())).toBe('image/png');
    expect(typ(await jpeg())).toBe('image/jpeg');
    expect(typ(Buffer.from(await new Bun.Image(sarPng()).webp().bytes()))).toBe('image/webp');
    expect(k.typUrInnehall(mp4())).toEqual({ typ: 'video/mp4', slag: 'video' });
    expect(k.typUrInnehall(mp4({ video: false }))).toEqual({ typ: 'audio/mp4', slag: 'ljud' });
    expect(k.typUrInnehall(webm())).toEqual({ typ: 'video/webm', slag: 'video' });
    expect(k.typUrInnehall(webm({ video: false }))).toEqual({ typ: 'audio/webm', slag: 'ljud' });
    expect(typ(wav())).toBe('audio/wav');
    expect(typ(Buffer.from('OggS\0\x02rest', 'latin1'))).toBe('audio/ogg');
    expect(typ(Buffer.from('ID3\x04\0rest', 'latin1'))).toBe('audio/mpeg');
    expect(typ(Buffer.from('%PDF-1.4\n'))).toBe('application/pdf');
    expect(typ(Buffer.from('bara text'))).toBeNull();
    expect(typ(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  test('filmens och ljudets längd och bildstorlek läses ur filen, med tak på antalet delar', () => {
    expect(k.mp4Info(mp4({ sekunder: 12 }))).toMatchObject({ video: true, langdSek: 12, bredd: 320, hojd: 240 });
    expect(k.webmInfo(webm({ sekunder: 7.5 }))).toMatchObject({ doctype: 'webm', video: true, langdSek: 7.5, bredd: 320, hojd: 240 });
    expect(k.webmInfo(webm({ video: false })).langdSek).toBeNull();
    expect(k.wavInfo(wav(2))).toMatchObject({ kanaler: 1, frekvens: 8000, bitar: 16, langdSek: 2 });
    // En fil med tusentals tomma boxar läses bara till taket.
    const manga = Buffer.concat([mp4(), ...Array.from({ length: 5000 }, () => Buffer.from([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]))]);
    const t0 = performance.now();
    expect(k.mp4Info(manga).video).toBe(true);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  test('EXIF ger tiden när bilden togs, kameran, orienteringen och om bilden bär platsuppgifter', async () => {
    expect(k.exifInfo(await jpeg({ exif: { orientering: 6, plats: true } }))).toEqual({ tagen: '2026-11-02T14:30:00', kamera: 'Demokamera X1', orientering: 6, plats: true });
    expect(k.exifInfo(await jpeg())).toEqual({ tagen: null, kamera: null, orientering: 1, plats: false });
    expect(k.exifInfo(sarPng())).toMatchObject({ tagen: null });
  });

  test('servern gör miniatyren, vrider den efter EXIF och förstorar aldrig, och en bomb med för många pixlar avvisas', async () => {
    const stor = sarPng(800, 600);
    const m = await k.forminska(stor, 256);
    expect([m.typ, m.bredd, m.hojd]).toEqual(['image/jpeg', 256, 192]);
    expect(await k.bildStorlek(m.data)).toMatchObject({ bredd: 256, hojd: 192, format: 'jpeg' });
    const vriden = await k.forminska(await jpeg({ bredd: 80, hojd: 40, exif: { orientering: 6 } }), 256);
    expect(await k.bildStorlek(vriden.data)).toMatchObject({ bredd: 40, hojd: 80 });
    expect([vriden.bredd, vriden.hojd]).toEqual([40, 80]);
    const liten = await k.forminska(sarPng(40, 30), 256);
    expect([liten.bredd, liten.hojd]).toEqual([40, 30]);
    const bomb = bombPng();
    expect(bomb.length).toBeLessThan(200);
    await expect(k.bildStorlek(bomb)).rejects.toThrow('maxPixels');
    await expect(k.forminska(bomb, 256)).rejects.toThrow('maxPixels');
  });

  test('servern ritar miniatyren för film, ljud och dokument, och ljudkurvan ur ett ljud i WAV', async () => {
    for (const slag of ['video', 'ljud', 'dokument']) expect(await k.bildStorlek(k.ritadMiniatyr(slag))).toMatchObject({ bredd: 256, hojd: 192, format: 'png' });
    const kurva = k.ljudkurva(wav(1), 50);
    expect(kurva).toHaveLength(50);
    expect(kurva[49]).toBeGreaterThan(kurva[0]);
    expect(k.ljudkurva(mp4({ video: false }))).toBeNull();
    expect(await k.bildStorlek(k.ritadMiniatyr('ljud', wav(1)))).toMatchObject({ bredd: 256 });
  });
});
