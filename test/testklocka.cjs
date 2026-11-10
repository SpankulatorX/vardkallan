// Runda 11, r1: gränssnittstesterna följer testcontainerns falska klocka (app/src/testklocka.js).
// Startas containern med VARDKALLAN_TESTKLOCKA=1 och VARDKALLAN_FALSK_NU visar /api/health serverns tid som testklocka.
// Då ställs testprocessens egen klocka och webbläsarens klocka på samma tid, så att datum som testet eller sidan räknar
// fram (i dag, i morgon, kommande tider) är desamma som serverns. Utan testklocka gör funktionerna ingenting.
//
//   const { foljServernsKlocka, stallKlockan } = require('./testklocka.cjs');
//   await foljServernsKlocka(BAS);            // en gång, innan testet räknar ut några datum
//   await stallKlockan(ctx);                  // för varje ny webbläsarkontext, före första sidan
//   resultatfil('sussa-testfall.json')        // var resultatet skrivs (vid falsk klocka inte filen som följer med bygget)
let forskjutning = null;

async function foljServernsKlocka(bas) {
  if (forskjutning != null) return forskjutning;
  let h = null;
  try { h = await (await fetch(`${bas}/api/health`)).json(); } catch { return null; }
  if (!h || !h.testklocka) return null;
  const RiktigDate = globalThis.Date;
  forskjutning = RiktigDate.parse(h.testklocka) - RiktigDate.now();
  const f = forskjutning;
  class TestDate extends RiktigDate {
    constructor(...a) { if (a.length === 0) super(RiktigDate.now() + f); else super(...a); }
    static now() { return RiktigDate.now() + f; }
    static [Symbol.hasInstance](x) { return x instanceof RiktigDate; }
  }
  globalThis.Date = new Proxy(TestDate, { apply: () => new TestDate().toString() });
  console.log(`Testklocka: servern visar ${h.testklocka}, testet och webbläsaren följer den.`);
  return forskjutning;
}

async function stallKlockan(ctx) {
  if (forskjutning == null) return;
  await ctx.clock.install({ time: Date.now() });
}

// Resultat från en körning med falsk klocka följer inte med bygget: de skrivs bredvid, i en fil som git inte följer.
const resultatfil = (namn) => (forskjutning == null ? namn : `.testtmp-testklocka-${namn}`);

module.exports = { foljServernsKlocka, stallKlockan, resultatfil };
