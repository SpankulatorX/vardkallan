// Runda 8, r5: villkoren för version 1.0, som rutan överst på kravsidan visar (GET /api/krav/version).
//
// Versionsprincipen: 0.x är ett demosystem under uppbyggnad, och varje runda höjer det andra talet (0.8 är runda 8).
// Version 1.0 betyder att demon är funktionellt komplett mot kravspecifikationen, när alla fyra villkor är uppfyllda.
// Runda 11, r8: efter 1.0 höjer varje runda det andra talet igen (1.1 är runda 11), utan att villkoren för 1.0 ändras.
// Villkoren räknas av servern ur Sussa-registret (sussa/index.js), resultatet av Sussas testfall (sussa-testfall.json)
// och listan med öppna säkerhetsfynd (sakerhetsfynd.json). Inget av det skrivs in för hand här.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TESTFALL, TIDSKLASSER } from './sussa-testfall.js';

export const PRINCIP = 'Version 0.x är ett demosystem under uppbyggnad, och varje runda höjer det andra talet: 0.8 är runda 8. Version 1.0 betyder att demon är funktionellt komplett mot kravspecifikationen, och den sätts när alla fyra villkoren nedan är uppfyllda. Efter 1.0 höjer varje runda det andra talet igen: 1.1 är runda 11. En version 1.x gör demon mer komplett och ändrar inte villkoren för 1.0, som fortsätter att gälla.';
export const INTE_VARDEN = 'Version 1.0 betyder inte att Vårdkällan kan användas i vården. Det kräver riktiga integrationer (Nationell patientöversikt, Nationella läkemedelslistan och laboratorier), troligen CE-märkning som medicinteknisk produkt, en driftorganisation, en extern säkerhetsgranskning, migrering av befintliga journaler och det som kravspecifikationen kräver av leverantören.';
export const KAPITEL_KARNA = ['2', '3', '5', '6'];

const FYND_FIL = join(import.meta.dir, 'sakerhetsfynd.json');
export function lasFynd(fil = FYND_FIL) {
  try { return JSON.parse(readFileSync(fil, 'utf8')); } catch { return null; }
}

const st = (n, en, flera) => `${n} ${n === 1 ? en : flera}`;

// register är svaret från sussaRegister, sussaTestfall resultatet av Sussas testfall (klientresultat.js) och fynd
// innehållet i sakerhetsfynd.json.
export function villkor10(register, sussaTestfall, { version = null, fynd = lasFynd(), testfall = TESTFALL } = {}) {
  const system = register.poster.filter(p => p.kategori === 'system');
  const planerade = system.filter(p => p.status === 'planerat').length;
  const karna = system.filter(p => KAPITEL_KARNA.includes(String(p.kapitel)));
  const uppfyllda = karna.filter(p => p.status === 'uppfyllt_demo').length;

  // Ett testfall räknas när varje körning har nått slutvillkoret inom Sussas maximala tid för tidsklassen.
  const aktuellt = Boolean(sussaTestfall?.aktuell);
  const resultat = sussaTestfall?.testfall ?? [];
  const inomTid = testfall.filter(x => {
    const r = resultat.filter(y => y.nr === x.nr);
    const max = TIDSKLASSER[x.tidsklass]?.max;
    return x.korningar.length > 0 && r.length > 0 && r.every(y => y.uppnatt && typeof y.uppskattadTidS === 'number' && y.uppskattadTidS < max);
  }).length;

  const oppna = Array.isArray(fynd?.oppna) ? fynd.oppna.length : null;
  const villkor = [
    {
      id: 'a', rubrik: 'Ingen post i kategorin system är planerad',
      uppfyllt: planerade === 0, antal: system.length - planerade, total: system.length,
      text: planerade === 0 ? `Alla ${system.length} poster i kategorin system är minst delvis uppfyllda.` : `${st(planerade, 'post', 'poster')} av ${system.length} i kategorin system är planerade och har inget i demon än.`,
    },
    {
      id: 'b', rubrik: 'Kärnsystemets poster i kapitel 2, 3, 5 och 6 är uppfyllda i demon',
      uppfyllt: karna.length > 0 && uppfyllda === karna.length, antal: uppfyllda, total: karna.length,
      text: `${uppfyllda} av ${karna.length} poster i kategorin system i kapitel 2, 3, 5 och 6 är uppfyllda i demon. ${st(karna.length - uppfyllda, 'post är', 'poster är')} kvar. Poster som kräver en nationell tjänst räknas inte här.`,
    },
    {
      id: 'c', rubrik: 'Alla Sussas testfall går att genomföra inom Sussas tidsgränser',
      uppfyllt: aktuellt && inomTid === testfall.length, antal: aktuellt ? inomTid : 0, total: testfall.length,
      text: `${aktuellt ? inomTid : 0} av ${testfall.length} testfall går att genomföra inom den maximala tiden för sin tidsklass.${aktuellt ? '' : ' Resultatet av testfallen saknas eller gäller inte det gränssnitt som körs nu.'}`,
    },
    {
      id: 'd', rubrik: 'Säkerhetsgranskningen har inga öppna fynd',
      uppfyllt: oppna === 0, antal: oppna, total: null,
      text: oppna == null ? 'Listan med säkerhetsfynd går inte att läsa.' : oppna === 0 ? 'Inga öppna fynd från säkerhetsgranskningarna.' : `${st(oppna, 'öppet fynd', 'öppna fynd')} från säkerhetsgranskningarna är inte rättade.`,
    },
  ];
  const kvar = villkor.filter(v => !v.uppfyllt).length;
  return {
    version, princip: PRINCIP, villkor, uppfyllt: kvar === 0,
    text: kvar === 0 ? 'Alla fyra villkoren är uppfyllda. Demon är funktionellt komplett mot kravspecifikationen.' : `${4 - kvar} av 4 villkor är uppfyllda.`,
    inteVarden: INTE_VARDEN,
  };
}
