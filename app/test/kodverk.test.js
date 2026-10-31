import { describe, test, expect } from 'bun:test';
import { PATIENTER } from '../src/seed/patienter.js';
import { KATALOG } from '../src/seed/lakemedel-katalog.js';
import { ICD10SE, ATC, MATKOD, SYSTEM } from '../src/kodverk.js';
import { ANTIKOAGULANTIA, NSAID, WARFARIN, METFORMIN } from '../src/lakemedel.js';
import { MATTYPER } from '../src/journal.js';
import { MATTYPER_ENHET } from '../src/db.js';

// Tabellerna i kodverk.js är kontrollerade mot primärkällorna (docs/kodkontroll.md). Testerna håller seeden i takt med dem.
describe('Kodverk', () => {
  test('varje diagnos i seeden har en ICD-10-SE-kod med Socialstyrelsens titel', () => {
    const diagnoser = PATIENTER.flatMap(p => p.diagnoser);
    expect(diagnoser.length).toBeGreaterThan(30);
    for (const d of diagnoser) {
      expect(ICD10SE[d.kod]).toBeDefined();
      expect(d.text).toBe(ICD10SE[d.kod]);
      // Minst fyrställig kod (ICD-10-SE: kategori utan uppdelning kompletteras med decimalen 9).
      expect(d.kod).toMatch(/^[A-Z]\d\d\.\d{1,2}$/);
    }
  });

  test('varje läkemedel i katalogen har en ATC-kod ur WHO:s register', () => {
    for (const l of KATALOG) {
      expect(ATC[l.atc]).toBeDefined();
      expect(l.atc).toMatch(/^[A-Z]\d\d[A-Z]{2}(\d\d)?$/);
    }
    for (const p of PATIENTER) for (const o of p.overkanslighet ?? []) if (o.atc) expect(ATC[o.atc]).toBeDefined();
  });

  test('varningsreglernas ATC-prefix stämmer med WHO:s register', () => {
    expect(ATC[NSAID]).toBe('ANTIINFLAMMATORY AND ANTIRHEUMATIC PRODUCTS, NON-STEROIDS');
    expect(ATC.J01C).toBe('BETA-LACTAM ANTIBACTERIALS, PENICILLINS');
    expect(ANTIKOAGULANTIA.map(k => ATC[k])).toEqual(['Vitamin K antagonists', 'Heparin group', 'Direct thrombin inhibitors', 'Direct factor Xa inhibitors']);
    expect(ATC[WARFARIN]).toBe('warfarin');
    expect(ATC[METFORMIN]).toBe('metformin');
    // Katalogens NSAID och penicilliner fångas av prefixen, och inget annat läkemedel gör det.
    const nsaid = KATALOG.filter(l => l.atc.startsWith(NSAID)).map(l => l.substans).sort();
    expect(nsaid).toEqual(['diklofenak', 'ibuprofen', 'naproxen']);
    const pc = KATALOG.filter(l => l.atc.startsWith('J01C')).map(l => l.substans).sort();
    expect(pc).toEqual(['amoxicillin', 'bensylpenicillin', 'fenoximetylpenicillin', 'pivmecillinam']);
  });

  test('varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet', () => {
    // eGFR saknar kod med avsikt, se kodverk.js.
    expect(Object.keys(MATKOD).sort()).toEqual(Object.keys(MATTYPER).sort());
    for (const [typ, k] of Object.entries(MATKOD)) {
      expect(MATTYPER_ENHET[typ]).toBeDefined();
      expect(k.ucum).toMatch(/\S/);
      if (typ === 'egfr') expect(k.coding).toEqual([]);
      else if (k.kategori === 'laboratory') expect(k.coding).toEqual([{ system: SYSTEM.npu, code: expect.stringMatching(/^NPU\d{5}$/) }]);
      else expect(k.coding.every(c => c.system === SYSTEM.loinc && /^\d+-\d$/.test(c.code) && c.display)).toBe(true);
    }
    expect(MATKOD.crp.coding[0].code).toBe('NPU19748');
    expect(MATKOD.saturation.coding.map(c => c.code)).toEqual(['2708-6', '59408-5']);
  });
});
