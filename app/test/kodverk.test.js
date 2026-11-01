import { describe, test, expect } from 'bun:test';
import { PATIENTER } from '../src/seed/patienter.js';
import { KATALOG } from '../src/seed/lakemedel-katalog.js';
import { ICD10SE, ATC, MATKOD, SYSTEM, NPL } from '../src/kodverk.js';
import { ANTIKOAGULANTIA, NSAID, WARFARIN, METFORMIN } from '../src/lakemedel.js';
import { MATTYPER } from '../src/journal.js';
import { MATTYPER_ENHET, nySessionsDb } from '../src/db.js';

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

  test('varje läkemedel i katalogen är en produkt i NPL med samma namn, styrka, form, substans och ATC-kod', () => {
    const forst = (s) => s[0].toLowerCase() + s.slice(1);
    expect(new Set(KATALOG.map(l => l.npl)).size).toBe(KATALOG.length);
    expect(Object.keys(NPL).sort()).toEqual(KATALOG.map(l => l.npl).sort());
    for (const l of KATALOG) {
      const p = NPL[l.npl];
      expect(l.npl).toMatch(/^(19|20)\d{6}\d{6}$/);
      expect(p).toBeDefined();
      expect([l.namn, l.styrka, l.form, l.substans, l.atc]).toEqual([p.namn, p.styrka, forst(p.form), forst(p.substans), p.atc]);
      expect(p.godkand).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('ordinationerna i seeden har dos och administrationsväg som passar produktens styrka och form', () => {
    const lm = Object.fromEntries(KATALOG.map(l => [l.id, l]));
    const enhet = (e) => (e === 'mikrog' ? 'mikrogram' : e);
    const ordinationer = PATIENTER.flatMap(p => p.ordinationer ?? []);
    expect(ordinationer.length).toBeGreaterThan(40);
    for (const o of ordinationer) {
      const l = lm[o.lm];
      const vagar = NPL[l.npl].vagar;
      const text = o.dosering.toLowerCase();
      // Dos i samma enhet som en styrka per enhet (tablett, kapsel, spruta, injektionsflaska) ska vara 1 till 4 hela enheter.
      const s = /^(\d[\d ]*(?:,\d+)?) (mg|g|mikrogram|IE)$/.exec(l.styrka);
      if (o.dosEnhet && s && enhet(o.dosEnhet) === s[2]) {
        const antal = o.dos / Number(s[1].replace(/ /g, '').replace(',', '.'));
        expect(Number.isInteger(antal) && antal >= 1 && antal <= 4).toBe(true);
        const forsta = /^(\d+) (?:till \d+ )?(tablett|tabletter|kapsel|kapslar|injektion)/.exec(text);
        if (forsta) expect(Number(forsta[1])).toBe(antal);
      } else if (o.dosEnhet === 'E') expect(l.styrka).toMatch(/^100 (E|enheter)\/ml$/);
      else if (o.dosEnhet === 'dos') expect(l.styrka).toMatch(/\/dos$/);
      else if (o.dosEnhet === 'st') expect(l.form).toMatch(/förfylld/);
      else expect(o.dosEnhet ?? null).toBeNull();
      if (/tablett/.test(text)) expect(l.form).toMatch(/tablett/);
      if (/kapsel/.test(text)) expect(l.form).toMatch(/kapsel/);
      if (/injektion|intravenöst/.test(text)) expect(l.form).toMatch(/injektion/);
      if (/intravenöst/.test(text)) expect(vagar).toContain('INVE');
      if (/subkutant/.test(text)) expect(vagar).toContain('SUCU');
      if (/lårets utsida/.test(text)) expect(vagar).toContain('INMU');
      if (/under tungan/.test(text)) expect(vagar).toContain('SL');
      if (/inhalation|spacer/.test(text)) expect(vagar).toContain('IH');
      if (/^(\d+|1 till 2) (tablett|kapsel)/.test(text)) expect(vagar).toContain('ORAL');
    }
  });

  test('ingen ordination i seeden börjar före produktens godkännande i NPL', () => {
    const db = nySessionsDb();
    const rader = db.query('SELECT o.start, k.npl FROM ordinationer o JOIN katalog k ON k.id = o.lakemedel_id').all();
    expect(rader.length).toBeGreaterThan(40);
    for (const r of rader) expect(r.start.slice(0, 10) >= NPL[r.npl].godkand).toBe(true);
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
