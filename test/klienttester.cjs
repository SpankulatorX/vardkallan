// Skriver resultatet från ett Playwright-skript till app/klienttest-resultat.json utan att skriva över de andra
// skriptens resultat. Varje skript äger testerna med sitt prefix (till exempel "Gränssnitt > Avbrott > ") och ersätter
// bara dem. Filen har en hash av app/public. Har gränssnittet ändrats sedan ett annat skript kördes, behålls det
// skriptets tester men med status inaktuell, så att de inte räknas som gröna förrän skriptet har körts igen.

const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
// Runda 11: med testcontainerns falska klocka skrivs resultatet bredvid (testklocka.cjs), inte i filen som följer med bygget.
const { resultatfil } = require('./testklocka.cjs');

function skrivKlienttester({ app, prefix, tester, bas, webblasare, gransnittHash }) {
  const fil = join(app, resultatfil('klienttest-resultat.json'));
  let forra = null;
  try { forra = JSON.parse(readFileSync(fil, 'utf8')); } catch { forra = null; }
  const sammaGransnitt = forra?.gransnittHash === gransnittHash;
  const andra = (forra?.tester ?? []).filter(t => !t.namn.startsWith(prefix)).map(t => (sammaGransnitt ? t : { ...t, status: 'inaktuell' }));
  const resultat = { tid: new Date().toISOString(), bas, webblasare, gransnittHash, tester: [...andra, ...tester] };
  writeFileSync(fil, `${JSON.stringify(resultat, null, 2)}\n`);
  return resultat;
}

module.exports = { skrivKlienttester };
