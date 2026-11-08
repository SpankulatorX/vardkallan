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

export default [
  {
    id: '2.3.1.1', kategori: 'system', egna: ['D4'], avsedd: 'uppfyllt_demo',
    tester: [ROLLER, ...SANGEN, ARMBAND, BEDOMT],
    losning: 'Gränssnittet är byggt för mobilen först: varje vy fungerar i 360 px utan sidledsrullning och med knappar som går att träffa med fingret, för varje roll. Vid sängen identifierar sjuksköterskan patienten genom att skanna armbandet i Läkemedel att ge, och sedan visas bara den patientens doser. Doser ges, mätvärden och NEWS2 registreras och provtagning registreras i mobilen med samma steg som vid skrivbordet, och ett test gör vart och ett av flödena i 360 px.',
    expert: 'Systemet läser armbandet och visar bara rätt patients doser, så att ingen behöver leta i listan eller jämföra namn för hand. Samma kontroller och varningar gäller i mobilen som vid skrivbordet.',
    anmarkning: 'Inläsningen av armbandet bygger på den gemensamma funktionen för streckkoder (Sussa 3.1.3.6, POST /api/skanna). Det finns ingen egen app för mobilen, utan webbläsaren används. Testerna körs i Chromium med en skärm som är 360 px bred, inte på riktiga telefoner.',
  },
  {
    id: '2.3.1.2', kategori: 'system', egna: ['D4'], avsedd: 'uppfyllt_demo',
    tester: [BEDOMT, ROLLER, ...SANGEN.slice(0, 2), ...RORELSE.slice(0, 2), ...PATIENTEN, MIN, NAT],
    losning: 'Figur 2 beskriver mobiliteten som rörelsefrihet för användarna, information som är tillgänglig och skyddad, gränssnitt anpassade för mobilen och utveckling med mobilen först. Vårdkällan möter det med tre perspektiv som vart och ett har flöden som prövas i 360 px: personalen vid sängen och på avdelningen (läkemedel och mätvärden), personalen i rörelse och utanför vårdens lokaler (arbetslistan, journalen och sökningen, med samma inloggning när förbindelsen bryts och kommer tillbaka från ett annat nät) och patienten i sin mobil (Min journal, tider och ombokning). Uppställningen finns i mobil.js.',
    expert: 'Systemet anpassar sig själv efter skärmen och nätet, så användaren behöver inte välja en mobil version eller logga in igen när mobilen byter nät.',
    anmarkning: 'Hemsjukvården som egen vårdform byggs under Sussa 6.1.1.6. Det finns ingen egen app, och stödet för olika hårdvara och operativsystem bygger på att gränssnittet är en webbsida utan byggsteg, prövad i Chromium.',
  },
  {
    id: '2.3.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [BEDOMT, PERKRAV, ...SANGEN, ...RORELSE, ...PATIENTEN],
    losning: 'Varje vanligt flöde i klickbudgeten är bedömt för mobilen i mobil.js, och de som är gjorda för mobilen görs i 360 px av ett test med samma steg som vid skrivbordet. Uppställningen per funktionellt krav i kapitel 3 och 4 räknas fram ur Sussa-registret och visas under den här posten på kravsidan: för varje krav med flöden i klickbudgeten, vilka av dem som är mobila.',
    expert: 'Uppställningen räknas fram ur testerna, så den kan inte påstå mer än vad som faktiskt går i mobilen. De mobila flödena har samma automation som vid skrivbordet: systemet fyller i vårdkontakt, tider och förslag.',
    anmarkning: 'Krav utan flöden i klickbudgeten är inte bedömda för mobilen. Flöden som hör till skrivbordet går att öppna i mobilen men är inte gjorda för den.',
  },
  {
    id: '2.3.1.4', kategori: 'system', egna: ['D4'], avsedd: 'delvis',
    tester: [
      `${GA}appen startar utan nät från service workern och visar läsläget`,
      `${GA}simulerat avbrott ger läsläge medan servern svarar andra besökare`,
      `${GA}skrivande är avstängt i läsläget med en förklaring`,
      `${GA}åtkomster i läsläget når åtkomstloggen när servern svarar igen`,
      `${LK}åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka`,
      // Runda 9, r6: byte mellan nät.
      NAT,
    ],
    losning: 'Läsläget vid avbrott: arbetslistan och kopierade patienter går att läsa när servern inte svarar, i samma flik eller med reservkod. Åtkomster under avbrottet förs till åtkomstloggen när förbindelsen är tillbaka.',
    expert: 'Systemet märker självt att servern inte svarar, går över till läsläget och förklarar varför skrivandet är avstängt. När förbindelsen är tillbaka förs loggen över utan att användaren gör något.',
    anmarkning: 'Skrivande under avbrott finns inte: mätvärden och givna doser kan inte läggas i en kö som skickas när förbindelsen är tillbaka. Läskopian innehåller inte hela journalen. Byte mellan nät är prövat: inloggningen håller när förbindelsen bryts och kommer tillbaka från en annan adress.',
  },
];
