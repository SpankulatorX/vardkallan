// Runda 8, r2: remiss, del 3 (remiss på uppdrag, fördelning, remisskonferens och extern pappersremiss) och Sussas
// testfall 2.2 till 2.5. Testnamnen (app/test/remiss-del3.test.js, klickbudgeten och test/sussa-testfall.cjs) och de
// poster i Sussa 3.3.1 som byggdes i rundan. Mappningsfilen för avsnittet ersätter sina poster med dessa, efter
// runda 6, r4 (planering-r4.js), så att ändringen ligger samlad här.
import { TEST } from '../krav.js';
import { flode } from './tidbok-tester.js';
import { T4 } from './planering-r4.js';
import { KORNINGAR, testfallTest } from '../sussa-testfall.js';

const { A, R } = TEST;
const RE3 = 'Remiss, del 3 > ';

export const T8 = {
  uppdrag: `${RE3}på uppdrag: vårdadministratören skriver remissen med en läkare som remittent, systemet föreslår läkaren och remissen skickas när läkaren har signerat i inkorgen`,
  uppdragSakerhet: `${RE3}på uppdrag: den som skriver ser aldrig remissens text eller läkarens anteckning, och bara den namngivna läkaren signerar`,
  fordela: `${RE3}fördelning: en inkommande remiss fördelas till en namngiven läkare med två klick, systemet kvitterar mottagningen och läkaren får den i inkorgen`,
  tidsram: `${RE3}besök inom: en accepterad remiss hamnar på väntelistan med den tidsram som läkaren väljer`,
  konferensTid: `${RE3}remisskonferens: nästa konferens är tisdag eller torsdag klockan 8 och räknas från en fast tid`,
  konferens: `${RE3}remisskonferens: systemet sätter remissen på nästa konferens, läkaren bedömer i följd och vårdadministratören registrerar beslut på uppdrag med läkaren som ansvarig`,
  extern: `${RE3}extern pappersremiss: registreras från en inskannad remiss med avsändare ur den simulerade HSA-katalogen eller som fritext och går in i samma flöde`,
  externRelation: `${RE3}extern pappersremiss: registreringen ger ingen läsrätt, den som registrerade tar inte emot och bedömer inte, och vårdrelationen uppstår när någon annan tar emot`,
  externSkydd: `${RE3}extern pappersremiss: skyddad identitet maskeras och en spärr röjs inte, och registreringen ger ingen åtkomst till de spärrade uppgifterna`,
};
// Körningarna av Sussas testfall i gränssnittet, per testfall.
const testfall = (nr) => KORNINGAR.filter(({ x }) => x.nr === nr).map(({ x, k }) => testfallTest(x, k));

const p = (id, avsedd, egna, tester, losning, expert, anmarkning, kategori = 'system') => ({ id, kategori, egna, avsedd, tester, losning, expert, anmarkning });

const POSTER = () => Object.fromEntries([
  p('3.3.1.2', 'delvis', ['L8'], [T8.extern, T8.externRelation, T8.externSkydd, flode('registrera-pappersremiss'), ...testfall('2.5')],
    'En remiss från en vårdgivare utanför Vårdkällan tas emot på papper: vårdadministratören registrerar den från den inskannade remissen, med avsändaren ur den simulerade HSA-katalogen eller som fritext, och den går in i samma flöde som andra inkommande remisser. Svaret skickas med post.',
    'Systemet hittar patienten på namn eller nummer, föreslår avsändaren ur HSA-katalogen, sätter remissdatum, mottagare och svarsdatum, gör den inskannade remissen till bilaga och kvitterar svaret. Remissen ger vårdrelation först när någon annan än den som registrerade den har tagit emot den.',
    'Elektronisk vårdbegäran till och från externa vårdgivare (e-remiss) finns inte, och remisser skickas inte ut ur Vårdkällan. Skannern, HSA-katalogen och utskicket med post är simulerade.', 'nationell'),
  p('3.3.1.3', 'delvis', ['D1'], [`${R}seeden har remisser i varje läge och larm`, `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`, `${R}vårdadministratör ser status men inte klinisk text`, T4.bilagor, T4.vidarebefordra, T4.vardbegaran, T8.uppdragSakerhet, T8.fordela, T8.konferens, T8.extern],
    'Remisser visas per patient och i en översikt över inkommande och utgående, med statuskedjan, vem som gjorde varje steg och när, bilagorna, vidarebefordran, om remissen är en egen vårdbegäran eller en pappersremiss, vem som skrev den på uppdrag, vem den är fördelad till, om den står på remisskonferens och vem som registrerade ett beslut på uppdrag. Remisskonferensen har en egen vy. Det som väntar på åtgärd visas i inkorgen, med remisser att signera och att bedöma.',
    'Inkorgen visar självt vad som väntar, och kortet visar bara de steg som enheten och den inloggade får ta. Vårdadministratören ser status och att det finns bilagor, men ingen klinisk text och inga filnamn, inte heller i en remiss som hon har skrivit på uppdrag.',
    'Konsultation skiljs inte från remiss. Urval och filter i remissöversikten finns som inkommande, utgående och remisskonferens.'),
  p('3.3.1.4', 'delvis', ['D1'], [`${R}ny remiss valideras`, flode('remiss'), `${A}helflöde: remiss genom hela statuskedjan`, T4.utkast, T4.ateranvand, T4.bilagor, T4.komplettera, T8.uppdrag, T8.uppdragSakerhet, flode('remiss-pa-uppdrag'), ...testfall('2.2')],
    'En remiss skapas från patientens journal, kan sparas som utkast, kan utgå från en tidigare remiss och får bilagor. Vårdadministratören skriver remisser på uppdrag av en läkare, som signerar dem i inkorgen innan de skickas, med läkaren som remittent.',
    'Systemet fyller i patient, avsändare, enhet, prioritet och sista svarsdatum, föreslår uppdragsgivaren ur patientens tider och vårdkontakter och föreslår läkaren att lägga till sin egen anteckning om patienten när läkaren signerar. Den som skriver på uppdrag ser aldrig det hon inte får se.',
    'Bilagor är högst 40 kB och fem per remiss i demon. Konsultation skiljs inte från remiss.'),
  p('3.3.1.5', 'delvis', ['D1'], [`${R}bara mottagande enhet kan kvittera, bedöma och svara`, `${R}avvisning kräver motivering och avslutar kedjan`, `${R}bara avsändaren kan kvittera svaret`, flode('kvittera-svar'), T4.vidarebefordra, T4.komplettera, T8.fordela, T8.tidsram, T8.konferensTid, T8.konferens, flode('fordela-remiss'), ...testfall('2.3'), ...testfall('2.4')],
    'Mottagande enhet kvitterar, fördelar remissen till en namngiven läkare, sätter den på remisskonferens, bedömer med en tidsram för besöket, svarar, avvisar med motivering eller skickar remissen vidare. På remisskonferensen bedömer läkarna remisserna i följd, och vårdadministratören kan registrera besluten på uppdrag med läkaren som ansvarig.',
    'Systemet föreslår bakjouren och visar hur många remisser varje läkare har att bedöma, väljer nästa remisskonferens, kvitterar mottagningen och föreslår tidsramen ur prioriteten, så att varje beslut tas med ett klick.',
    'Konsultation skiljs inte från remiss. Beslut som registreras på uppdrag gäller direkt utan läkarens kvittens. Bakjouren och konferenstiderna är demoregler.'),
].map(x => [x.id, x]));

let cache = null;
export const medR8 = (poster) => { cache ??= POSTER(); return poster.map(x => cache[x.id] ?? x); };
