// Sussa 2.3 Mobilitet: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { LK, GA } = TEST;

// Runda 9, r6: de mobila flödena (mobil.js) prövas i 360 px av test/mobil.cjs, och uppställningen per krav i
// app/test/runda9-r6.test.js.
const GM = 'Gränssnitt > Mobil > ';
const MA = 'Mobilt arbetssätt > ';
const ROLLER = `${GM}varje roll har sin startsida och menyn i 360 px utan sidledsrullning och med knappar på minst 40 px`;
const ARMBAND = `${GM}vid sängen identifierar armbandet patienten i Läkemedel att ge, och bara patientens doser visas`;
const MIN = `${GM}patienten läser sin journal, sina tider och vem som läst journalen i Min journal i 360 px`;
const NAT = `${GM}förbindelsen bryts och kommer tillbaka från en annan adress utan att inloggningen tappas`;
const BEDOMT = `${MA}varje flöde i klickbudgeten är bedömt för mobilen, och varje perspektiv i figur 2 har mobila flöden`;
const PERKRAV = `${MA}uppställningen per funktionellt krav i kapitel 3 och 4 räknas ur registret och anger bara flöden som prövas i 360 px`;
const flode = (namn) => `${GM}${namn} går i 360 px`;
const SANGEN = ['Ge en dos', 'Ge en dos med delegering', 'Registrera en dos i efterhand', 'Registrera blodtryck', 'Registrera en NEWS2-kontroll', 'Registrera längd, vikt, blodtryck och puls', 'Registrera provtagning'].map(flode);
const RORELSE = ['Öppna patient från arbetslistan', 'Läsa senaste anteckning', 'Överblicka dagens händelser på avdelningen', 'Kvittera remissvar', 'Söka i journalen och öppna träffen'].map(flode);
const PATIENTEN = ['Patienten bokar om sin tid i Min journal'].map(flode);

// Runda 10, r1: skrivkön vid avbrott (skrivko.js, test/avbrott.cjs och app/test/runda10-r1-skrivko.test.js),
// hemsjukvården utan uppkoppling och varje vy i 360 px (test/mobil.cjs) och uppställningen för varje krav i kapitel 3
// och 4 (app/test/runda10-r1-mobil.test.js).
const GAV = 'Gränssnitt > Avbrott > ';
const SK = 'Skrivkön efter avbrott > ';
const HEMMA = `${GM}i hemsjukvården utan uppkoppling registreras ett mätvärde i 360 px, märks som inte sparat och sparas när förbindelsen är tillbaka`;
const VYER = `${GM}varje vy i menyn för varje roll och varje flik i journalen går att öppna i 360 px utan sidledsrullning och med knappar på minst 40 px`;
const ALLAKRAV = 'Mobila tillämpningar > varje funktionellt krav i kapitel 3 och 4 finns i uppställningen, med mobila flöden, skrivbordets flöden, vyer i 360 px eller som inte byggt';
const KO_UI = `${GAV}en dos och ett mätvärde som registreras under avbrottet märks som inte sparade och sparas när förbindelsen är tillbaka`;
const KO_KONFLIKT = `${GAV}en dos som någon annan gav under avbrottet blir en konflikt som sjuksköterskan avgör, och dosen sparas inte två gånger`;
const KO_SERVER = [
  `${SK}ett mätvärde och en dos från kön sparas med tiden då de gjordes, och en rad som skickas igen sparas inte två gånger`,
  `${SK}en dos som någon annan gav under avbrottet blir en konflikt som personen avgör, och ingen dos sparas två gånger`,
  `${SK}kön tas bara emot från den som gjorde registreringarna, med en rad som är krypterad med läskopians nyckel och inom läskopians giltighet`,
  `${SK}läskopian har mätvärdena och remisserna för patienterna, för de roller som får läsa dem`,
];

export default [
  {
    id: '2.3.1.1', kategori: 'system', egna: ['D4'], avsedd: 'uppfyllt_demo',
    tester: [ROLLER, VYER, ...SANGEN, ARMBAND, BEDOMT, HEMMA, KO_UI],
    losning: 'Gränssnittet är byggt för mobilen först: varje vy i menyn för varje roll och varje flik i journalen fungerar i 360 px utan sidledsrullning och med knappar som går att träffa med fingret. Vid sängen identifierar sjuksköterskan patienten genom att skanna armbandet i Läkemedel att ge, och sedan visas bara den patientens doser. Doser ges, mätvärden och NEWS2 registreras och provtagning registreras i mobilen med samma steg som vid skrivbordet, och ett test gör vart och ett av flödena i 360 px. Utan uppkoppling, till exempel hos patienten i hemsjukvården, ges doser och registreras mätvärden ändå: de sparas krypterat i mobilen, märks som inte sparade och skickas när förbindelsen är tillbaka (Sussa 2.3.1.4).',
    expert: 'Systemet läser armbandet och visar bara rätt patients doser, så att ingen behöver leta i listan eller jämföra namn för hand. Samma kontroller och varningar gäller i mobilen som vid skrivbordet, och utan uppkoppling sparar systemet själv i kön och skickar när nätet är tillbaka.',
    anmarkning: 'Mobilen använder samma app i webbläsaren som datorn, utan eget program (beslut 2026-11-08). Inläsningen av armbandet bygger på den gemensamma funktionen för streckkoder (Sussa 3.1.3.6, POST /api/skanna). Testerna körs i Chromium med en skärm som är 360 px bred, inte på riktiga telefoner.',
  },
  {
    id: '2.3.1.2', kategori: 'system', egna: ['D4'], avsedd: 'uppfyllt_demo',
    tester: [BEDOMT, ROLLER, VYER, ...SANGEN.slice(0, 2), ...RORELSE.slice(0, 2), ...PATIENTEN, MIN, NAT, HEMMA, KO_UI],
    losning: 'Figur 2 beskriver mobiliteten som rörelsefrihet för användarna, information som är tillgänglig och skyddad, gränssnitt anpassade för mobilen och utveckling med mobilen först. Vårdkällan möter det med tre perspektiv som vart och ett har flöden som prövas i 360 px: personalen vid sängen och på avdelningen (läkemedel och mätvärden), personalen i rörelse och utanför vårdens lokaler (arbetslistan, journalen och sökningen, med samma inloggning när förbindelsen bryts och kommer tillbaka från ett annat nät, och i hemsjukvården hos patienten, där doser och mätvärden registreras också utan uppkoppling) och patienten i sin mobil (Min journal, tider och ombokning). Informationen är skyddad: läskopian och kön i mobilen är krypterade och raderas vid utloggning, och samma behörighet och loggning gäller som vid skrivbordet. Utvecklingen sker med mobilen först: varje vy i menyn och journalen prövas i 360 px. Uppställningen finns i mobil.js.',
    expert: 'Systemet anpassar sig själv efter skärmen och nätet, så användaren behöver inte välja en mobil version, logga in igen när mobilen byter nät eller komma ihåg vad som ska skickas efter ett avbrott.',
    anmarkning: 'Hemsjukvården är en vårdform på vårdkontakten (Sussa 6.1.1.6). Kommunal hemsjukvård är inte byggd. Mobilen använder samma app i webbläsaren som datorn, utan eget program (beslut 2026-11-08). Stödet för olika hårdvara och operativsystem bygger på att gränssnittet är en webbsida utan byggsteg, prövad i Chromium.',
  },
  {
    id: '2.3.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [BEDOMT, PERKRAV, ALLAKRAV, VYER, ...SANGEN, ...RORELSE, ...PATIENTEN, HEMMA],
    losning: 'Varje vanligt flöde i klickbudgeten är bedömt för mobilen i mobil.js, och de som är gjorda för mobilen görs i 360 px av ett test med samma steg som vid skrivbordet. Uppställningen per funktionellt krav räknas fram ur Sussa-registret och visas under den här posten på kravsidan, för varje krav i kapitel 3 och 4: de mobila flödena, eller att kravets flöden hör till skrivbordet, att kravet saknar eget flöde men dess vyer går att öppna i 360 px, eller att kravet inte är byggt. Bredd: läkemedel, mätvärden, NEWS2, provtagning, arbetslistan, journalen, sökningen, remissvar och Min journal. Enkelhet: samma steg och klickbudget som vid skrivbordet. Säkerhet: samma behörighet och loggning, och krypterad läskopia och kö utan uppkoppling. Automation: systemet fyller i vårdkontakt, tider och förslag.',
    expert: 'Uppställningen räknas fram ur testerna, så den kan inte påstå mer än vad som faktiskt går i mobilen. De mobila flödena har samma automation som vid skrivbordet: systemet fyller i vårdkontakt, tider och förslag.',
    anmarkning: 'Flöden som hör till skrivbordet, till exempel ordinationer och planering över många patienter, går att öppna i mobilen men är inte gjorda för den.',
  },
  {
    id: '2.3.1.4', kategori: 'system', egna: ['D4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${GA}appen startar utan nät från service workern och visar läsläget`,
      `${GA}simulerat avbrott ger läsläge medan servern svarar andra besökare`,
      `${GA}skrivande är avstängt i läsläget med en förklaring`,
      `${GA}åtkomster i läsläget når åtkomstloggen när servern svarar igen`,
      `${LK}åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka`,
      // Runda 9, r6: byte mellan nät.
      NAT,
      // Runda 10, r1: skrivkön och fler delar av journalen i läskopian.
      ...KO_SERVER, KO_UI, KO_KONFLIKT, HEMMA,
    ],
    losning: 'Olika nät och rörelse: inloggningen hålls av servern och håller när förbindelsen bryts och kommer tillbaka från en annan adress, till exempel från wifi till mobildatanätet eller hemifrån. Robusthet vid störningar: när servern inte svarar går appen själv över till läsläget, med arbetslistan och för patienterna i läskopian patienthuvudet, översikten, läkemedlen och dagens doser, mätvärdena, remisserna och de senaste anteckningarna, i samma flik eller med reservkod. Doser ges och mätvärden registreras ändå: de sparas krypterat på datorn eller i mobilen, märks som inte sparade i journalen och skickas av sig själva när förbindelsen är tillbaka. Då sparas de med tiden då de gjordes och prövas med samma kontroller som annars, och en dos som någon annan har gett under avbrottet blir en konflikt som personen själv avgör. Åtkomster under avbrottet förs till åtkomstloggen.',
    expert: 'Systemet märker självt att servern inte svarar, går över till läsläget, låter det viktigaste arbetet vid sängen fortsätta och skickar det när förbindelsen är tillbaka, utan att användaren gör något. Det prövar själv varje registrering mot det som har hänt under avbrottet och förklarar en konflikt på vanlig svenska.',
    anmarkning: 'Under avbrottet går bara givna doser och mätvärden att registrera, vilket är den beslutade avgränsningen (beslut 2026-11-08). Annat skrivande, som anteckningar och ordinationer, väntar tills förbindelsen är tillbaka, eftersom det behöver en aktuell journal. Läskopian gäller patienterna på arbetslistan och de som personen har öppnat. Nätverkets egen redundans ingår inte, som kravtexten medger.',
  },
];
