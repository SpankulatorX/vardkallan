// Runda 12, r3 (Sussa 11.2.1.5): Vårdkällans testmetod beskriven efter dokumentstrukturen i ISO/IEC/IEEE 29119-3
// (testplan, testdesign, testfall, testprocedurer och testrapporter), med vad som motsvarar varje dokument i projektet.
// Beskrivningen är data här, så att ett test kan stoppa bygget om något den pekar på inte finns. docs/testmetod.md
// skrivs ur den med scripts/dokument-md.js.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const d = (id, rubrik, standard, text, filer) => ({ id, rubrik, standard, text, filer });

// filer är sökvägar från förrådets rot. Sökvägar i app/ prövas i varje bygge, de andra när hela förrådet finns.
export const DOKUMENT = [
  d('strategi', 'Testpolicy och teststrategi', 'Organisatorisk testdokumentation (29119-3 avsnitt 5)',
    'Testerna skrivs före koden (testdriven utveckling). Varje krav i det egna registret och varje post i Sussas register pekar på de automatiska tester som visar det, och en status som uppfylld ges bara när alla dessa tester är gröna i det senaste bygget. Bygget stoppas om ett test är rött, och samma tester körs i GitHub Actions vid varje ändring, också med falsk klocka vid de tider som har fällt tester förut. Riskerna styr vad som testas mest: behörighet, spärr, inre sekretess, skyddad identitet och loggning har negativa tester för fel roll, fel vårdenhet och dolda rader.',
    ['docs/testmetod.md', 'docs/design.md', '.github/workflows/test.yml']),
  d('testplan', 'Testplan', 'Testledningens dokumentation: testplan (29119-3 avsnitt 6.2)',
    'Vad som ska testas och när det är klart står i kravregistren: de egna kraven K, D, L och M med sina tester, och Sussas 389 poster med mappningen till tester per avsnitt. Klickbudgeten anger för varje vanligt flöde hur många klick det får ta. Planen är levande: ett nytt krav får sina tester i samma ändring som koden.',
    ['app/src/krav.js', 'app/src/sussa/index.js', 'app/src/sussa/mappning', 'app/src/klickbudget.js']),
  d('testdesign', 'Testdesign', 'Dynamisk testdokumentation: testdesignspecifikation (29119-3 avsnitt 7.2)',
    'Testvillkoren tas ur kravtexten mening för mening och ur lagkraven. Teknikerna i ISO/IEC/IEEE 29119-4 som används mest är ekvivalensklasser (roller och behörigheter, spärrad enhet utan och med samtycke), gränsvärden (ålder, giltighetstider, tak och klockslag runt midnatt och sommartid), tillståndsövergångar (utkast, signerad och rättad anteckning, inloggning som väntar på den andra faktorn) och scenarier (Sussas 34 användbarhetstestfall).',
    ['app/src/sussa-testfall.js', 'app/src/lagmatris.js', 'app/scripts/klocktest.js']),
  d('testfall', 'Testfall', 'Dynamisk testdokumentation: testfallsspecifikation (29119-3 avsnitt 7.3)',
    'Varje testfall är ett namngivet test med förutsättningar, steg och förväntat resultat i koden. Servertesterna körs med Bun, och gränssnittstesterna körs i en riktig webbläsare med Playwright. Testnamnen är desamma i kravregistret, så att ett krav som pekar på ett test som inte finns syns i bygget.',
    ['app/test', 'test/avbrott.cjs', 'test/anvandartest.cjs', 'test/genomgang.cjs', 'test/klickbudget.cjs', 'test/sussa-testfall.cjs', 'test/tillganglighet.cjs', 'test/mobil.cjs']),
  d('testprocedur', 'Testprocedurer', 'Dynamisk testdokumentation: testprocedurspecifikation (29119-3 avsnitt 7.4)',
    'Servertesterna körs med ett skript som också skriver resultatet och kontrollerar att kravregistret bara pekar på tester som finns. Gränssnittstesterna körs i en bestämd ordning mot en lokal container, eftersom de skriver resultat med en hash av gränssnittet. Docker-bygget kör servertesterna igen och stoppas vid ett rött test.',
    ['app/scripts/kor-tester.js', 'app/Dockerfile', 'test/klienttester.cjs']),
  d('testdata', 'Testdata och testmiljö', 'Dynamisk testdokumentation: krav på testdata och testmiljö (29119-3 avsnitt 7.5 och 7.6)',
    'Testdata är påhittade patienter med Skatteverkets testpersonnummer och testsamordningsnummer, som seeden lägger i en ny sandlåda för varje test och varje besökare. Testmiljön är en container med samma image som demon. Testerna får inte bero på dagens datum: tid skickas in som en fast tid, och en falsk klocka prövar tiderna som har fällt tester förut.',
    ['app/src/seed', 'app/src/seed/testsamordningsnummer.json', 'research/testpersonnummer.json', 'app/test/falsk-klocka.js', 'test/testklocka.cjs']),
  d('testrapport', 'Testresultat, testlogg och testrapporter', 'Testledningens och den dynamiska testningens rapporter (29119-3 avsnitt 6.3, 6.4 och 7.9 till 7.12)',
    'Varje körning skriver resultatet per test till filer som följer med i bygget, och kravsidan i demon är testrapporten: för varje krav och varje post visas testerna och deras status från det senaste bygget. Gränssnittets resultat räknas som inaktuella om gränssnittet har ändrats sedan testerna kördes. Fel och fynd från säkerhetsgranskningarna sparas med åtgärd, och tillgänglighetsredogörelsen skrivs ur tillgänglighetstestet.',
    ['app/klienttest-resultat.json', 'app/klickbudget.json', 'app/sussa-testfall.json', 'app/src/klientresultat.js', 'app/src/sakerhetsfynd.json', 'docs/tillganglighet.md', 'docs/fhir-validering.md']),
];

export const ROT = join(import.meta.dir, '..', '..');
export const provbar = (fil) => fil.startsWith('app/') || existsSync(join(ROT, 'docs'));
export const finns = (fil) => existsSync(join(ROT, fil));

export function markdown() {
  const ut = ['# Testmetod', '',
    'Vårdkällan testas efter en dokumenterad metod som följer dokumentstrukturen i ISO/IEC/IEEE 29119-3 (testdokumentation). För varje dokument som standarden beskriver anges här vad som motsvarar det i projektet och var det finns. Beskrivningen är data i `app/src/testmetod.js`, och ett test i bygget stoppar bygget om något som beskrivningen pekar på saknas.', '',
    '| Dokument enligt 29119-3 | Motsvarighet i Vårdkällan |', '| --- | --- |',
    ...DOKUMENT.map(x => `| ${x.standard} | ${x.rubrik} |`)];
  for (const x of DOKUMENT) ut.push('', `## ${x.rubrik}`, '', `Enligt standarden: ${x.standard}.`, '', x.text, '', `Finns i: ${x.filer.map(f => `\`${f}\``).join(', ')}.`);
  ut.push('', '## Avgränsning', '',
    'Metoden är Vårdkällans egen tillämpning av standardens struktur och är inte certifierad. Acceptanstest med en beställare och tester med personer som arbetar i vården ingår inte i det som körs automatiskt.');
  return `${ut.join('\n')}\n`;
}
