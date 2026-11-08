// Runda 7, r7: viktningen av utvärderingskriterierna, Cambios svar, avtalets signaler och bör-kraven (K2, K3, K5).
import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { SPEC, sussaRegister, sussaTester } from '../src/sussa/index.js';
import { TRAD, CAMBIO, MODELL, AVVIKELSER_6A, viktI6a, SVAR, SIGNALER, SIGNALTYPER, BORKRAV, UTELAMNADE, A1, VIKTADE, noderOvanfor, viktFor } from '../src/sussa/avtal.js';
import { testserver, klient } from './hjalp.js';

const SUSSA = join(import.meta.dir, '..', 'src', 'sussa');
const kriterier = SPEC.poster.filter(p => p.typ === 'utvarderingskriterium').map(p => p.id);
const perId = new Map(SPEC.poster.map(p => [p.id, p]));
const forbjudna = /[—–…]/;

describe('Sussa-avtalet', () => {
  test('viktningen stämmer med utvärderingsmodellen och Cambios prispåslag', () => {
    const nod = new Map(TRAD.map(([id, , v]) => [id, v]));
    expect(nod.size).toBe(TRAD.length);
    // Varje nods barn summerar till 1, och nivå 1 är kapitlen plus användbarhetstesterna.
    const barn = new Map();
    for (const [id, , v] of TRAD) {
      const upp = noderOvanfor(id);
      const far = upp.length > 1 ? upp.at(-2) : 'rot';
      barn.set(far, (barn.get(far) ?? 0) + v);
    }
    barn.set('rot', barn.get('rot') + MODELL.anvandbarhetstester);
    for (const [far, summa] of barn) expect({ far, summa: Math.round(summa * 1000) / 1000 }).toEqual({ far, summa: 1 });
    // Alla utvärderingskriterier utom 11.3.1.10, som inte utvärderas, har en vikt, och trädet viktar inget annat.
    const viktade = TRAD.filter(([id]) => id.split('.').length === 4).map(([id]) => id);
    expect(new Set(viktade)).toEqual(new Set(kriterier.filter(id => id !== '11.3.1.10')));
    expect(viktade.length).toBe(200);
    expect(perId.get('11.3.1.10').text).toContain('utvärderas ej');
    expect(viktFor('11.3.1.10')).toBeNull();
    // Kriterierna och användbarhetstesterna är tillsammans hela kvalitetsbedömningen.
    const summa = viktade.reduce((s, id) => s + viktFor(id), 0);
    expect(Math.abs(summa + MODELL.anvandbarhetstester - 1)).toBeLessThan(1e-9);
    // Exempel räknade för hand: 2.1.1.1 är 0,13 x 0,3 x 1 och driftens helhetsåtagande 0,17 x 0,7 x 0,65 x 0,6.
    expect(viktFor('2.1.1.1')).toBeCloseTo(0.039, 9);
    expect(viktFor('KD1.1.1.9')).toBeCloseTo(0.04641, 9);
    expect(viktFor('3.1.7.1')).toBeCloseTo(0.12 * 0.23 * 0.15, 9);
    expect(VIKTADE[0]).toEqual({ id: 'KD1.1.1.9', vikt: viktFor('KD1.1.1.9') });
    // Prispåslaget är medelvärdet av anbuden gånger 2,33, och Cambios påslag per kriterium i bilaga 6a är kriteriets
    // vikt gånger prispåslaget gånger andelen för betyget. Det visar att vikterna är de som användes i utvärderingen.
    expect(Math.abs(MODELL.medelvarde * MODELL.prispaslagFaktor - MODELL.prispaslag)).toBeLessThan(2);
    expect(Object.keys(CAMBIO).sort()).toEqual([...viktade].sort());
    // Bara 9.1.1.2 och 9.1.1.3 räknades med andra vikter i bilaga 6a än i trädet, i omvänd ordning.
    expect(AVVIKELSER_6A).toEqual({ '9.1.1.2': 0.6, '9.1.1.3': 0.4 });
    expect(viktI6a('9.1.1.2')).toBeCloseTo(viktFor('9.1.1.3'), 9);
    expect(viktI6a('3.1.1.3')).toBe(viktFor('3.1.1.3'));
    for (const [id, [poang, kr, sida]] of Object.entries(CAMBIO)) {
      expect([0, 2, 5, 10]).toContain(poang);
      expect(sida).toBeGreaterThan(0);
      const forvantat = viktI6a(id) * MODELL.prispaslag * MODELL.andelPaslag[poang];
      expect({ id, avvikelse: Math.abs(forvantat - kr) < 2 }).toEqual({ id, avvikelse: true });
    }
  });

  test('registret visar vikt, rang och betyg per kriterium så att det går att sortera på vad Sussa värderade högst', () => {
    const r = sussaRegister(null);
    const p = (id) => r.poster.find(x => x.id === id);
    expect(p('KD1.1.1.9')).toMatchObject({ vikt: 0.04641, viktRang: 1, betyg: { poang: 2, prispaslag: 199894018 } });
    expect(p('2.1.1.1')).toMatchObject({ vikt: 0.039, viktRang: 2 });
    expect(p('3.1.1.1')).toMatchObject({ vikt: null, viktRang: null, betyg: null });
    expect(p('9.1.1.2')).toMatchObject({ vikt: 0.016, betyg: { poang: 5, viktIUtvarderingen: 0.024 } });
    expect(p('2.1.1.1').betyg.viktIUtvarderingen).toBeNull();
    expect(p('11.3.1.10').vikt).toBeNull();
    const rangordnade = r.poster.filter(x => x.vikt != null).sort((a, b) => a.viktRang - b.viktRang);
    expect(rangordnade.length).toBe(200);
    for (let i = 1; i < rangordnade.length; i++) expect(rangordnade[i - 1].vikt >= rangordnade[i].vikt).toBe(true);
    expect(r.viktning).toMatchObject({ antalViktade: 200, summaKriterier: 0.93, modell: { funktion: 0.7, pris: 0.3 } });
    expect(r.viktning.kalla).toContain('Bilaga F1:1 Viktningsträd');
    // De tio högst viktade kriterierna som inte är uppfyllda i demon, som kravsidans genväg visar.
    const tio = rangordnade.filter(x => x.status !== 'uppfyllt_demo').slice(0, 10);
    expect(tio.length).toBe(10);
    expect(tio[0].id).toBe('KD1.1.1.9');
  });

  test('varje post har Cambios svar med källa, och maskerade svar är märkta som maskerade', () => {
    expect(Object.keys(SVAR).sort()).toEqual(SPEC.poster.map(p => p.id).sort());
    for (const p of SPEC.poster) {
      const s = SVAR[p.id];
      // Cambio kryssade ja på alla krav och kriterier. 11.3.1.10 är en beskrivning utan kryss.
      expect({ id: p.id, svar: s.svar }).toEqual({ id: p.id, svar: p.id === '11.3.1.10' ? null : 'ja' });
      expect(typeof s.kryss.fil === 'string' && s.kryss.fil.endsWith('.pdf') && s.kryss.sida > 0).toBe(true);
      expect([false, 'delvis', 'helt']).toContain(s.maskerat);
      for (const b of s.beskrivning) {
        expect(b.fil).toMatch(/Anbudssvar_KAP\d\d?_/);
        expect(b.fil).toContain(p.id.replace(/^KD/, ''));
        expect(b.sida).toMatch(/^\d+( till \d+)?$/);
      }
      // Ett kriterium har alltid en beskrivande svarsfil. En maskerad fil har inget sammanfattat innehåll.
      if (p.typ === 'utvarderingskriterium') expect({ id: p.id, filer: s.beskrivning.length > 0 }).toEqual({ id: p.id, filer: true });
      if (s.maskerat === 'helt') {
        expect(s.sammanfattning).toBeNull();
        expect(s.beskrivning.every(b => b.maskerad)).toBe(true);
      }
      if (s.maskerat === false && s.beskrivning.length) expect({ id: p.id, sammanfattning: typeof s.sammanfattning }).toEqual({ id: p.id, sammanfattning: 'string' });
      if (s.maskerat === 'delvis') expect(s.beskrivning.some(b => b.maskerad) && s.beskrivning.some(b => !b.maskerad)).toBe(true);
      if (s.sammanfattning) {
        expect(s.sammanfattning.length).toBeLessThanOrEqual(300);
        expect(s.sammanfattning).toContain('Cambio');
      }
    }
    // Kapitel 3 och 4 är omaskerade nästan helt, kapitel 10 till 12 är maskerade.
    const lasbara = (kap) => SPEC.poster.filter(p => p.kapitel === kap && SVAR[p.id].sammanfattning).length;
    expect(lasbara('3')).toBeGreaterThan(55);
    expect(lasbara('4')).toBeGreaterThan(30);
    expect(lasbara('12')).toBe(0);
    expect(SVAR['3.5.2.6'].sammanfattning).toBeNull();
    expect(SVAR['3.1.1.3'].sammanfattning).toContain('reservnummer');
    expect(SVAR['3.2.2.3'].maskerat).toBe('helt');
    // Bilaga A1 består av A1.1 till A1.7, och det står vilka av dem som finns.
    expect(A1.delar.map(d => d.id)).toEqual(['A1.1', 'A1.2', 'A1.3', 'A1.4', 'A1.5', 'A1.6', 'A1.7']);
    expect(A1.delar.find(d => d.id === 'A1.1').finns).toBe('nej');
    expect(A1.delar.find(d => d.id === 'A1.6').finns).toBe('delvis');
    for (const d of A1.delar) expect(['ja', 'delvis', 'nej']).toContain(d.finns);
  });

  test('poster som exkluderades ur avtalet eller sköts upp 2022 har en signal med skäl och källa', () => {
    expect(SIGNALTYPER).toEqual({ exkluderat: 'Exkluderat ur avtalet 2022', uppskjutet: 'Uppskjutet' });
    for (const [id, lista] of Object.entries(SIGNALER)) {
      expect(perId.has(id)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);
      for (const s of lista) {
        expect(Object.keys(SIGNALTYPER)).toContain(s.typ);
        expect(typeof s.varfor === 'string' && s.varfor.length > 20 && s.varfor.length <= 240).toBe(true);
        expect(s.kallor.length).toBeGreaterThan(0);
        for (const k of s.kallor) expect(k.sidor.every(n => Number.isInteger(n) && n > 0)).toBe(true);
      }
      expect(new Set(lista.map(s => s.typ)).size).toBe(lista.length);
    }
    // Cosmic CIS för anestesi och intensivvård togs bort genom ÄB32 och Tilläggsavtal 3.
    for (const id of ['4.6.1.1', '4.6.1.2', '4.6.1.7', '3.5.3.3', '5.3.1.2']) {
      expect(SIGNALER[id].find(s => s.typ === 'exkluderat').kallor.map(k => k.dokument).join(' ')).toContain('ÄB32');
    }
    // En delfunktion som utgår och en som sköts upp: bekräftelse av bokning i appen utgick, kallelsen sköts upp.
    expect(SIGNALER['3.4.3.3'].map(s => s.typ).sort()).toEqual(['exkluderat', 'uppskjutet']);
    expect(SIGNALER['3.4.3.3'].find(s => s.typ === 'uppskjutet').datum).toContain('2023-12-15');
    expect(SIGNALER['4.7.1.4'].map(s => s.typ)).toEqual(['uppskjutet']);
    expect(SIGNALER['3.1.1.1']).toBeUndefined();
    // Registret ger signalerna på posten.
    const r = sussaRegister(null);
    expect(r.poster.find(p => p.id === '4.6.1.2').signaler[0].typ).toBe('exkluderat');
    expect(r.poster.find(p => p.id === '3.1.1.1').signaler).toEqual([]);
    expect(r.signaltyper.exkluderat).toBe('Exkluderat ur avtalet 2022');
  });

  test('bör-krav och målbild är en egen lista kopplad till posterna, med status från posterna', () => {
    expect(BORKRAV.length).toBeGreaterThan(15);
    const id = BORKRAV.map(b => b.id);
    expect(new Set(id).size).toBe(id.length);
    for (const b of BORKRAV) {
      expect(['bor', 'malbild']).toContain(b.typ);
      expect(b.id.startsWith(b.typ === 'bor' ? 'B' : 'M')).toBe(true);
      expect(b.poster.length).toBeGreaterThan(0);
      for (const p of b.poster) expect({ b: b.id, p, finns: perId.has(p) }).toEqual({ b: b.id, p, finns: true });
      if (b.typ === 'bor') expect(b.text).toMatch(/\bbör\b/);
    }
    // Varje mening med bör i kravtexterna är antingen i listan eller en anvisning för hur anbudssvaret skrivs.
    const medBor = SPEC.poster.filter(p => /\bbör\b/.test(p.text)).map(p => p.id);
    for (const p of medBor) expect({ p, med: BORKRAV.some(b => b.poster.includes(p)) || UTELAMNADE.includes(p) }).toEqual({ p, med: true });
    expect(BORKRAV.some(b => b.poster.includes('7.1.2.1') && b.typ === 'bor')).toBe(true);
    const r = sussaRegister(null);
    // Utan testresultat är inget uppfyllt, och en rad har samma status som sina poster eller delvis.
    for (const b of r.borkrav) expect(['delvis', 'planerat']).toContain(b.status);
    expect(r.borkrav.find(b => b.id === 'B2').status).toBe('planerat');
  });

  test('datafilerna har inga tankstreck, ellipser eller personnamn ur handlingarna', () => {
    for (const f of ['vikter.js', 'avtalssvar.js', 'avtalssignaler.js', 'borkrav.js', 'avtal.js']) {
      const text = readFileSync(join(SUSSA, f), 'utf8');
      expect({ f, traff: forbjudna.test(text) }).toEqual({ f, traff: false });
      // Personer som förekommer i avtalen och protokollen ska inte stå i registret.
      for (const namn of ['Avidan', 'Fabó', 'Svahn', 'Simonsson', 'Gille', 'Waller', 'Rudenstam']) expect({ f, namn, traff: text.includes(namn) }).toEqual({ f, namn, traff: false });
    }
  });

  test('API: krav/sussa ger vikter, Cambios svar, signaler, bilaga A1 och bör-kraven', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '..', '.testtmp-sussa-avtal-'));
    const fil = join(dir, 'test-resultat.json');
    writeFileSync(fil, JSON.stringify({ tid: '2026-11-08T10:00:00Z', bun: '1.3.14', antal: 0, godkanda: 0, misslyckade: 0, tester: sussaTester().map(namn => ({ namn, status: 'grön' })) }));
    const app = testserver({ testresultat: fil, klientresultat: { klickbudget: join(dir, 'saknas.json'), klienttester: join(dir, 'saknas2.json') } });
    try {
      const r = await klient(app).get('/api/krav/sussa');
      expect(r.status).toBe(200);
      const d = r.data;
      expect(d.saknadeKapitel).toEqual([]);
      expect(d.poster.find(p => p.id === '3.1.1.3')).toMatchObject({ vikt: expect.any(Number), avtal: { svar: 'ja', maskerat: false }, betyg: { poang: 5 } });
      expect(d.poster.find(p => p.id === '4.6.1.2').signaler.map(s => s.typ)).toContain('exkluderat');
      expect(d.avtal.a1.delar.length).toBe(7);
      expect(d.avtal.summa.ja).toBe(388);
      expect(d.borkrav.length).toBe(BORKRAV.length);
      expect(d.viktning.antalViktade).toBe(200);
    } finally { app.stopp(); rmSync(dir, { recursive: true }); }
  });
});
