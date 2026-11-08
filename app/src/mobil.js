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

// Uppställningen per funktionellt krav i kapitel 3 och 4 (Sussa 2.3.1.3). Runda 10, r1: varje krav i kapitlen finns med,
// inte bara de som har flöden i klickbudgeten. lage är
//   mobil      kravet har flöden som är gjorda för mobilen och görs i 360 px av test/mobil.cjs,
//   skrivbord  kravet har flöden i klickbudgeten, men de hör till skrivbordet,
//   vyer       kravet har inget eget flöde i klickbudgeten, men dess vyer går att öppna i 360 px (test/mobil.cjs prövar
//              varje vy i menyn för varje roll och varje flik i journalen),
//   planerat   kravet är inte byggt i demon.
export const LAGE = {
  mobil: 'Flöden som är gjorda för mobilen och prövas i 360 px',
  skrivbord: 'Kravets flöden hör till skrivbordet. Vyerna går att öppna i 360 px utan sidledsrullning, men de är inte gjorda för mobilen.',
  vyer: 'Kravet har inget eget flöde i klickbudgeten. Dess vyer går att öppna i 360 px utan sidledsrullning, prövat för varje vy i menyn och varje flik i journalen.',
  planerat: 'Kravet är inte byggt i demon.',
};
export function perKrav(poster, mappning, klickbudgetTest) {
  const perTest = new Map(mobilaFloden().filter(f => f.mobil).map(f => [klickbudgetTest(FLODEN.find(x => x.id === f.id)), f.namn]));
  const iMappning = new Map(mappning.map(m => [m.id, m]));
  return poster.filter(p => ['3', '4'].includes(p.kapitel)).map((p) => {
    const m = iMappning.get(p.id);
    const tester = m?.tester ?? [];
    const floden = tester.filter(t => t.startsWith('Gränssnitt > Klickbudget > '));
    const mobila = floden.map(t => perTest.get(t)).filter(Boolean);
    const lage = mobila.length ? 'mobil' : floden.length ? 'skrivbord' : tester.length && (m?.avsedd ?? 'planerat') !== 'planerat' ? 'vyer' : 'planerat';
    return { id: p.id, rubrik: p.rubrik, kategori: m?.kategori ?? 'system', lage, mobila, varfor: lage === 'mobil' ? null : LAGE[lage] };
  });
}
