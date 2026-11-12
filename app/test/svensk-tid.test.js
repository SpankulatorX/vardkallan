// Runda 11, r1: datum som människor menar räknas i svensk tid, inte i UTC. Mellan 00 och 01 svensk tid (00 och 02 på
// sommaren) har UTC fortfarande gårdagens datum. Varje test här prövar ett fel som klocktestet hittade, vid just de
// klockslagen, och med en fast tid så att testet är detsamma när det än körs.
import { describe, test, expect } from 'bun:test';
import { byggSeed, lokalTid, addDagar, datumAv } from '../src/db.js';
import * as hogrisk from '../src/hogriskkontroll.js';
import * as vardformer from '../src/vardformer.js';
import * as vaccinationsprogram from '../src/vaccinationsprogram-regler.js';
import * as bhvProgram from '../src/bhv-program.js';
import * as utbildning from '../src/utbildning.js';
// Runda 13, r3 (E2-5): spara ger dosen med uppgiften om identiteten (administrering-hjalp.js).
import * as administrering from './administrering-hjalp.js';
import { personal, atk } from './hjalp.js';

const ms = (datum, klocka) => Date.parse(lokalTid(datum, klocka));

describe('Datum i svensk tid (runda 11, r1)', () => {
  test('kollegakontrollen räknar barn under 18 år efter det svenska datumet, också strax efter midnatt', () => {
    const db = byggSeed(new Date(ms('2026-11-12', '12:00')));
    db.query("UPDATE patienter SET fodd = '2008-11-12' WHERE id = 'p01'").run();
    const lm = db.query("SELECT * FROM katalog WHERE id = 'VK-NPL-0030'").get();
    const k = (nu) => hogrisk.kategorierFor(db, { lm, o: { administrationssatt: 'peroralt' }, patientId: 'p01', nu }).map(x => x.id);
    // Klockan 00.30 svensk tid på 18-årsdagen är patienten vuxen, fast UTC fortfarande har dagen före.
    expect(k(ms('2026-11-12', '00:30'))).toEqual([]);
    expect(k(ms('2026-11-11', '23:30'))).toEqual(['opioider']);
  });

  test('första hembesöket efter utskrivning läggs nästa vardag klockan 10 svensk tid', () => {
    // Fredag 13 november 00.30 svensk tid (torsdag i UTC): nästa vardag är måndagen.
    expect(vardformer.nastaVardag(new Date(ms('2026-11-13', '00:30')))).toBe(lokalTid('2026-11-16', '10:00'));
    // Söndag 23.30: måndagen.
    expect(vardformer.nastaVardag(new Date(ms('2026-11-15', '23:30')))).toBe(lokalTid('2026-11-16', '10:00'));
    // På sommaren är klockan 10 svensk tid 08.00 UTC.
    expect(vardformer.nastaVardag(new Date(ms('2027-06-08', '14:00')))).toBe('2027-06-09T08:00:00.000Z');
    expect(vardformer.nastaVardag(new Date(ms('2027-06-08', '00:30')))).toBe('2027-06-09T08:00:00.000Z');
  });

  test('vaccinationsprogrammet byter dag och säsong efter det svenska datumet', () => {
    const vzv = (nu) => vaccinationsprogram.program({ fodd: '2025-09-01', nu, givna: [], regler: { vattkopporManader: 12 } }).rader.find(r => r.id === 'vzv1');
    // Vattkoppor ingår från 1 januari 2027, också klockan 00.30 på nyårsdagen.
    expect(vzv(ms('2027-01-01', '00:30')).status).toBe('nu');
    expect(vzv(ms('2026-12-31', '23:30')).status).toBe('kommande');
    // Influensasäsongen börjar 1 oktober, klockan 00.30 svensk tid (sommartid) är det 30 september i UTC.
    expect(vaccinationsprogram.sasongFor(ms('2026-10-01', '00:30'))).toMatchObject({ pagar: true, fran: '2026-10-01' });
    expect(vaccinationsprogram.sasongFor(ms('2026-09-30', '23:30')).pagar).toBe(false);
  });

  test('barnhälsovården räknar barnets ålder i dagar efter det svenska datumet', () => {
    const rota1 = bhvProgram.vaccinRad('rota1');
    // Rotavirus dos 1 ges från 42 dagars ålder, alltså från samma datum sex veckor efter födelsedagen.
    expect(bhvProgram.alderDagar('2026-10-01', ms('2026-11-12', '00:30'))).toBe(42);
    expect(bhvProgram.alderDagar('2026-10-01', ms('2026-11-11', '23:30'))).toBe(41);
    expect(bhvProgram.provaVaccin(rota1, { fodd: '2026-10-01', nu: ms('2026-11-12', '00:30') }).ok).toBe(true);
    // Dagen då nästa dos kan ges skrivs med det svenska datumet.
    const rota2 = bhvProgram.vaccinRad('rota2');
    const r = bhvProgram.provaVaccin(rota2, { fodd: '2026-08-01', nu: ms('2026-11-10', '12:00'), givna: [{ vaccinId: 'rota1', tid: lokalTid('2026-11-02', '00:30') }] });
    expect(r.ok).toBe(false);
    expect(r.skal).toContain(`Dosen kan ges från ${addDagar('2026-11-02', rota2.intervall)}.`);
  });

  test('vätskebalansens dygn är från brytningen till samma klockslag nästa dag, också när sommartiden börjar eller slutar', () => {
    const db = byggSeed(new Date(ms('2027-10-31', '15:00')));
    const a = atk(db, 'usk-kard', 'p01', {}, 'las_matvarden');
    // Vintertiden börjar 31 oktober 2027: dygnet från klockan 14 den 30 oktober har 25 timmar.
    const host = administrering.vatskebalans(a, { dag: '2027-10-30', brytning: '14' });
    expect([host.fran, host.till]).toEqual([lokalTid('2027-10-30', '14:00'), lokalTid('2027-10-31', '14:00')]);
    // Sommartiden börjar 28 mars 2027: dygnet från midnatt har 23 timmar.
    const var_ = administrering.vatskebalans(a, { dag: '2027-03-28' });
    expect([var_.fran, var_.till]).toEqual([lokalTid('2027-03-28', '00:00'), lokalTid('2027-03-29', '00:00')]);
    expect(Date.parse(var_.till) - Date.parse(var_.fran)).toBe(23 * 3600_000);
  });

  test('utbildarintyget visar slutdatumet i svensk tid', () => {
    const nu = new Date(ms('2026-11-12', '00:30'));
    const d = byggSeed(nu);
    const r = utbildning.utfardaUtbildare(d, personal(d, 'vch-kard'), 'far-kard', { nu });
    const till = d.query("SELECT giltigt_till FROM utbildarintyg WHERE personal_id = 'far-kard' ORDER BY id DESC").get().giltigt_till;
    // Klockan 00.30 svensk tid har UTC dagen före, så de två datumen skiljer sig och texten ska ha det svenska.
    const svenskt = datumAv(new Date(till));
    expect(svenskt).not.toBe(till.slice(0, 10));
    expect(r.text).toContain(`är utbildare till ${svenskt} och`);
  });
});
