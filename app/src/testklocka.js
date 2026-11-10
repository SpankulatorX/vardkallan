// Runda 11, r1: falsk klocka för testcontainern, så att gränssnittstesterna kan köras vid en annan tid än den verkliga.
// Läses bara när testflaggan VARDKALLAN_TESTKLOCKA=1 är satt. Då flyttas klockan så att den visar VARDKALLAN_FALSK_NU
// när servern startar, och den går sedan som vanligt. Utan flaggan gör filen ingenting, och driften sätter den aldrig.
// Filen läses in först av allt i server.js, innan någon modul hinner läsa klockan.
const RiktigDate = globalThis.Date;
const flagga = process.env.VARDKALLAN_TESTKLOCKA === '1';

function installera(varde) {
  const mal = RiktigDate.parse(varde);
  if (Number.isNaN(mal)) throw new Error(`VARDKALLAN_FALSK_NU går inte att tolka som en tid: ${varde}`);
  // En sparad sandlåda eller en publik adress hör till driften. Där får klockan aldrig flyttas.
  if (process.env.SESSION_FIL || process.env.LITA_PA_PROXY === '1') {
    throw new Error('Den falska klockan får bara användas i en testcontainer, inte med SESSION_FIL eller LITA_PA_PROXY.');
  }
  const forskjutning = mal - RiktigDate.now();
  class TestDate extends RiktigDate {
    constructor(...a) {
      if (a.length === 0) super(RiktigDate.now() + forskjutning);
      else super(...a);
    }
    static now() { return RiktigDate.now() + forskjutning; }
    // Datum som Bun själv skapar (till exempel filers tider) är riktiga Date och ska också räknas som Date.
    static [Symbol.hasInstance](x) { return x instanceof RiktigDate; }
  }
  // Date() utan new ger en text, som den riktiga.
  const DateMedAnrop = new Proxy(TestDate, { apply: () => new TestDate().toString() });
  globalThis.Date = DateMedAnrop;
  return forskjutning;
}

export const TESTKLOCKA = flagga && process.env.VARDKALLAN_FALSK_NU
  ? { forskjutningMs: installera(process.env.VARDKALLAN_FALSK_NU), start: process.env.VARDKALLAN_FALSK_NU }
  : null;
if (TESTKLOCKA) console.log(`Testklocka: servern startar vid ${TESTKLOCKA.start} (testflaggan VARDKALLAN_TESTKLOCKA är satt).`);
