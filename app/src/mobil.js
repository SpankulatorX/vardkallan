// Mobilt arbetssätt (runda 9, r6, Sussa 2.3.1.1 till 2.3.1.3). För varje vanligt flöde i klickbudgeten står här om det
// är gjort för att användas i mobilen, till exempel vid sängen, i hemsjukvården eller av patienten själv, och annars
// varför det hör till skrivbordet. Skriptet test/mobil.cjs gör varje flöde som står som mobilt i en skärm som är 360 px
// bred och kontrollerar att sidan inte rullar i sidled och att knapparna går att träffa, så listan påstår aldrig mer än
// testet visar. Uppställningen per funktionellt krav i kapitel 3 och 4 räknas fram ur Sussa-registrets mappning: ett
// krav har de mobila flöden vars klickbudgettest står bland kravets tester.
import { FLODEN } from './klickbudget.js';

// Perspektiven i figur 2 i kravspecifikationens kapitel 2: personalens och patientens mobilitet.
export const PERSPEKTIV = {
  sangen: 'Personalen vid sängen och på avdelningen',
  rorelse: 'Personalen i rörelse och utanför vårdens lokaler',
  patienten: 'Patienten i sin mobil',
};
const mobil = (perspektiv, text) => ({ mobil: true, perspektiv, text });
const skrivbord = (text) => ({ mobil: false, perspektiv: null, text });

export const MOBILA = {
  'oppna-patient': mobil('rorelse', 'Arbetslistan och översikten fungerar i mobilen.'),
  'las-anteckning': mobil('rorelse', 'Anteckningen läses i mobilen, till exempel före ett hembesök.'),
  blodtryck: mobil('sangen', 'Blodtrycket registreras vid sängen.'),
  'ge-dos': mobil('sangen', 'Läkemedel att ge visar dosen vid sängen, och den ges med ett klick.'),
  'ge-dos-delegering': mobil('sangen', 'Undersköterskan ger dosen vid sängen, och delegeringen prövas av systemet.'),
  'dos-efterhand': mobil('sangen', 'En dos som getts registreras i efterhand vid sängen.'),
  news2: mobil('sangen', 'NEWS2-kontrollen görs vid sängen, och systemet räknar poängen.'),
  grundmatningar: mobil('sangen', 'Längd, vikt, blodtryck och puls registreras vid sängen.'),
  'registrera-provtagning': mobil('sangen', 'Provtagningen registreras vid sängen.'),
  'avdelningens-handelser': mobil('rorelse', 'Dagens händelser på avdelningen överblickas i mobilen.'),
  'kvittera-svar': mobil('rorelse', 'Ett remissvar kvitteras i mobilen.'),
  'sok-journal': mobil('rorelse', 'Sökningen i journalen fungerar i mobilen.'),
  'egen-ombokning': mobil('patienten', 'Patienten bokar om sin tid i Min journal i mobilen.'),
  // Runda 10, r3: såret dokumenteras vid sängen, och anteckningen dikteras i mobilen.
  'formular-sar': mobil('sangen', 'Såret dokumenteras vid sängen, och läget markeras med fingret på kroppsbilden.'),
  diktera: mobil('rorelse', 'Anteckningen dikteras i mobilen, till exempel direkt efter ett hembesök.'),
};
const SKRIVBORD = 'Flödet hör till skrivbordet, där formulär, tabeller och listor över många patienter eller tider får plats. Det går att öppna i mobilen, men är inte gjort för den.';

// Bedömningen för alla flöden i klickbudgeten, i samma ordning.
export function mobilaFloden() {
  return FLODEN.map(f => ({ id: f.id, namn: f.namn, roll: f.roll, ...(Object.hasOwn(MOBILA, f.id) ? MOBILA[f.id] : skrivbord(SKRIVBORD)) }));
}

// Uppställningen per funktionellt krav i kapitel 3 och 4: de mobila flöden som kravets tester omfattar.
export function perKrav(poster, mappning, klickbudgetTest) {
  const perTest = new Map(mobilaFloden().filter(f => f.mobil).map(f => [klickbudgetTest(FLODEN.find(x => x.id === f.id)), f.namn]));
  const iMappning = new Map(mappning.map(m => [m.id, m]));
  return poster.filter(p => ['3', '4'].includes(p.kapitel)).flatMap((p) => {
    const m = iMappning.get(p.id);
    const floden = (m?.tester ?? []).filter(t => t.startsWith('Gränssnitt > Klickbudget > '));
    if (!floden.length) return [];
    const mobila = floden.map(t => perTest.get(t)).filter(Boolean);
    return [{ id: p.id, rubrik: p.rubrik, mobila, varfor: mobila.length ? null : 'Kravets flöden hör till skrivbordet.' }];
  });
}
