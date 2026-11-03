// Skalor och poängmodeller (Sussa 3.1.3.5): NEWS2, GCS, NRS, ACVPU, referensintervall och eGFR (runda 6, r1).
import { describe, test, expect } from 'bun:test';
import { news2, NEWS2_PARAMETRAR, news2Galler, news2Omgangar, tolkaGcs, gcsText, nrsText, ACVPU, referens, utanforReferens, ckdEpi2021, DEMOREGEL, NEWS2_KALLA } from '../src/skalor.js';
import { nyDb } from './hjalp.js';

const NORMAL = { andningsfrekvens: 16, saturation: 97, syrgas: 0, systoliskt: 125, puls: 72, medvetande: 'A', temp: 37.0 };
const poang = (id, v) => NEWS2_PARAMETRAR.find(p => p.id === id).poang(v);

describe('Skalor', () => {
  test('NEWS2: varje parameter ger poäng enligt Chart 1 i RCP 2017', () => {
    const tabell = {
      andningsfrekvens: [[8, 3], [9, 1], [11, 1], [12, 0], [20, 0], [21, 2], [24, 2], [25, 3]],
      saturation: [[91, 3], [92, 2], [93, 2], [94, 1], [95, 1], [96, 0], [100, 0]],
      syrgas: [[0, 0], [1, 2], [15, 2]],
      systoliskt: [[90, 3], [91, 2], [100, 2], [101, 1], [110, 1], [111, 0], [219, 0], [220, 3]],
      puls: [[40, 3], [41, 1], [50, 1], [51, 0], [90, 0], [91, 1], [110, 1], [111, 2], [130, 2], [131, 3]],
      temp: [[35.0, 3], [35.1, 1], [36.0, 1], [36.1, 0], [38.0, 0], [38.1, 1], [39.0, 1], [39.1, 2], [41, 2]],
    };
    for (const [id, rader] of Object.entries(tabell)) for (const [v, p] of rader) expect({ id, v, p: poang(id, v) }).toEqual({ id, v, p });
    expect(Object.fromEntries(Object.keys(ACVPU).map(k => [k, poang('medvetande', k)]))).toEqual({ A: 0, C: 3, V: 3, P: 3, U: 3 });
  });

  test('NEWS2: summan, risken och vad som ska göras enligt Chart 2 och Chart 4', () => {
    const noll = news2(NORMAL);
    expect(noll).toMatchObject({ komplett: true, poang: 0, risk: 'lag', larm: false, frekvens: 'Kontroller minst var 12:e timme', kontrollInomTimmar: 12, kalla: NEWS2_KALLA, demoregel: DEMOREGEL });
    const lag = news2({ ...NORMAL, puls: 95, temp: 38.5 });
    expect(lag).toMatchObject({ poang: 2, risk: 'lag', larm: false, kontrollInomTimmar: 4 });
    expect(lag.atgard[0]).toContain('sjuksköterskan');
    const rod = news2({ ...NORMAL, andningsfrekvens: 26 });
    expect(rod).toMatchObject({ poang: 3, risk: 'lag_medel', larm: true, rod: ['Andningsfrekvens'], kontrollInomTimmar: 1 });
    expect(rod.atgard.join(' ')).toContain('läkarteam');
    const medel = news2({ ...NORMAL, andningsfrekvens: 22, puls: 112, saturation: 95 });
    expect(medel).toMatchObject({ poang: 5, risk: 'medel', larm: true, kontrollInomTimmar: 1 });
    expect(medel.atgard.join(' ')).toContain('omedelbart');
    const hog = news2({ andningsfrekvens: 26, saturation: 91, syrgas: 0, systoliskt: 148, puls: 128, medvetande: 'A', temp: 37.4 });
    expect(hog).toMatchObject({ poang: 8, risk: 'hog', larm: true, kontrollInomTimmar: 0 });
    expect(hog.atgard.join(' ')).toContain('intensivvård');
    expect(hog.text).toBe('NEWS2 8, hög risk. Andningsfrekvens och Syremättnad ger 3 poäng. Kontinuerlig övervakning av vitalparametrarna.');
  });

  test('NEWS2: ett enskilt värde med 3 poäng ger larm även när värden saknas, och systemet säger vad som ska mätas', () => {
    const delvis = news2({ puls: 134, saturation: 97 });
    expect(delvis).toMatchObject({ komplett: false, poang: null, larm: true, risk: 'lag_medel', rod: ['Puls'] });
    expect(delvis.text).toContain('Mät också andningsfrekvens, luft eller syrgas, systoliskt blodtryck, medvetandegrad och temperatur.');
    const utan = news2({ puls: 80 });
    expect(utan).toMatchObject({ komplett: false, larm: false, risk: null });
    expect(utan.text).toStartWith('NEWS2 kan inte räknas förrän alla sju värden finns.');
  });

  test('NEWS2: räknas inte för barn under 16 år eller under graviditet', () => {
    expect(news2Galler({ alder: 8 })).toMatchObject({ galler: false });
    expect(news2Galler({ alder: 8 }).text).toContain('barn under 16 år');
    expect(news2Galler({ alder: 30, diagnosKoder: ['Z34.0'] }).galler).toBe(false);
    expect(news2Galler({ alder: 30, diagnosKoder: ['O24.4'] }).galler).toBe(false);
    expect(news2Galler({ alder: 16, diagnosKoder: ['I48.0'] }).galler).toBe(true);
  });

  test('NEWS2: värden inom en timme blir en mätomgång, och varje omgång vet vilka rader den bygger på', () => {
    const t = (min) => new Date(Date.UTC(2026, 10, 3, 8, min)).toISOString();
    const rad = (id, typ, varde, min) => ({ id, typ, varde: String(varde), varde_num: typeof varde === 'number' ? varde : null, tid: t(min) });
    const rader = [rad(1, 'andningsfrekvens', 22, 0), rad(2, 'saturation', 94, 0), rad(3, 'syrgas', 1, 0), rad(4, 'blodtryck', '138/88', 5),
      rad(5, 'puls', 104, 5), rad(6, 'medvetande', 'A', 10), rad(7, 'temp', 37.6, 10), rad(8, 'puls', 80, 80)];
    const o = news2Omgangar(rader);
    const komplett = o.filter(x => x.resultat.komplett);
    expect(komplett.map(x => [x.ankareId, x.resultat.poang])).toEqual([[7, 6]]);
    expect(komplett[0].anvanda.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Pulsen 70 minuter senare har inga andra värden inom timmen.
    expect(o.at(-1)).toMatchObject({ ankareId: 8, resultat: { komplett: false } });
  });

  test('GCS: systemet räknar summan och skriver texten, och fel delvärden avvisas', () => {
    expect(tolkaGcs('E3V4M6')).toEqual({ e: 3, v: 4, m: 6, summa: 13, text: 'GCS 13 (E3 V4 M6)' });
    expect(tolkaGcs('e1 v2 m4').summa).toBe(7);
    for (const fel of ['E5V4M6', 'E3V6M6', 'E3V4M7', 'E0V1M1', '13', '']) expect(tolkaGcs(fel)).toBeNull();
    expect(gcsText(tolkaGcs('E1V2M4'))).toContain('Medvetslös, 8 poäng eller lägre.');
    expect(gcsText(tolkaGcs('E4V5M6'))).toContain('Fullt medveten.');
  });

  test('NRS och ACVPU: systemet skriver texten', () => {
    expect(nrsText(0)).toBe('Smärta 0 av 10 (NRS), ingen smärta.');
    expect(nrsText(5)).toBe('Smärta 5 av 10 (NRS), måttlig smärta.');
    expect(nrsText(8)).toBe('Smärta 8 av 10 (NRS), svår smärta.');
    expect(Object.keys(ACVPU)).toEqual(['A', 'C', 'V', 'P', 'U']);
  });

  test('referensintervall: NEWS2-området för vitalparametrar, kön för kreatinin och målintervall för INR vid warfarin', () => {
    expect(referens('puls')).toMatchObject({ lag: 51, hog: 90, text: 'Området där värdet ger 0 poäng i NEWS2' });
    expect(referens('kreatinin', { kon: 'kvinna' })).toMatchObject({ lag: 45, hog: 90 });
    expect(referens('kreatinin', { kon: 'man' })).toMatchObject({ lag: 60, hog: 105 });
    expect(referens('inr', { warfarin: true })).toMatchObject({ lag: 2.0, hog: 3.0 });
    expect(referens('inr')).toMatchObject({ lag: null, hog: 1.2 });
    expect(referens('crp').text).toContain('Demovärden');
    expect(utanforReferens(128, referens('puls'))).toBe(true);
    expect(utanforReferens(72, referens('puls'))).toBe(false);
    expect(referens('vikt')).toBeNull();
  });

  test('eGFR: CKD-EPI 2021 ur kreatinin, ålder och kön, och seedens eGFR är räknat ur kreatininet vid samma provtagning', () => {
    // Kreatinin 88,4 µmol/L är 1,0 mg/dL. CKD-EPI 2021: man 50 år ger 92, kvinna 50 år 69.
    expect(ckdEpi2021(88.4, 50, 'man')).toBe(92);
    expect(ckdEpi2021(88.4, 50, 'kvinna')).toBe(69);
    expect(ckdEpi2021(60, 40, 'kvinna')).toBeGreaterThan(100);
    const db = nyDb();
    const egfr = db.query("SELECT m.*, p.fodd, p.kon FROM matvarden m JOIN patienter p ON p.id = m.patient_id WHERE m.typ = 'egfr'").all();
    expect(egfr.length).toBeGreaterThanOrEqual(4);
    for (const e of egfr) {
      const k = db.query("SELECT varde_num FROM matvarden WHERE patient_id = ? AND typ = 'kreatinin' AND tid = ?").get(e.patient_id, e.tid);
      expect(k).not.toBeNull();
      const dag = new Date(e.tid).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
      const [y, m, d] = e.fodd.split('-').map(Number);
      const [ty, tm, td] = dag.split('-').map(Number);
      const alder = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
      expect(e.varde_num).toBe(ckdEpi2021(k.varde_num, alder, e.kon));
    }
  });
});
