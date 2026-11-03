// Sussa 2.3 Mobilitet: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { LK, GA } = TEST;

export default [
  { id: '2.3.1.1', kategori: 'system', egna: ['D4'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gränssnittet går att använda i mobilbredd och läsläget fungerar utan nät. Genomgången i webbläsaren visar varje vy för varje demoroll på 360 px och kontrollerar att sidan inte rullar i sidled och att knapparna är minst 40 px höga. Det finns inga mobila arbetsflöden, till exempel vid sängen, och genomgången är inte ett test i kravregistret.' },
  { id: '2.3.1.2', kategori: 'system', egna: ['D4'], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt som ett mobilt arbetssätt. Se 2.3.1.4 för robusthet vid avbrott.' },
  { id: '2.3.1.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Det finns inga särskilda mobila tillämpningar.' },
  {
    id: '2.3.1.4', kategori: 'system', egna: ['D4'], avsedd: 'delvis',
    tester: [
      `${GA}appen startar utan nät från service workern och visar läsläget`,
      `${GA}simulerat avbrott ger läsläge medan servern svarar andra besökare`,
      `${GA}skrivande är avstängt i läsläget med en förklaring`,
      `${GA}åtkomster i läsläget når åtkomstloggen när servern svarar igen`,
      `${LK}åtkomster i läsläget skrivs till åtkomstloggen när förbindelsen är tillbaka`,
    ],
    losning: 'Läsläget vid avbrott: arbetslistan och kopierade patienter går att läsa när servern inte svarar, i samma flik eller med reservkod. Åtkomster under avbrottet förs till åtkomstloggen när förbindelsen är tillbaka.',
    expert: 'Systemet märker självt att servern inte svarar, går över till läsläget och förklarar varför skrivandet är avstängt. När förbindelsen är tillbaka förs loggen över utan att användaren gör något.',
    anmarkning: 'Skrivande under avbrott finns inte, och övergångar mellan olika nät är inte testade. Läskopian innehåller inte hela journalen.',
  },
];
