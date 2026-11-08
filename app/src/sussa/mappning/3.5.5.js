// Sussa 3.5.5 Klinisk läkemedelsprövning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r1: klinisk prövning (app/src/kliniskprovning.js och app/test/lakemedel-r9.test.js).
const KP = 'Klinisk läkemedelsprövning > ';

export default [
  { id: '3.5.5.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${KP}prövaren inkluderar en patient, systemet registrerar uppmärksamhetsinformationen och varnar vid ordination utanför studien och vid ett läkemedel som protokollet inte tillåter`,
      `${KP}ett deltagande på en spärrad vårdenhet syns inte och ger ingen varning som röjer det`,
    ],
    losning: 'Kliniska prövningar med studienummer, titel, sponsor, prövande vårdenhet, ansvarig prövare, prövare, prövningsläkemedel och läkemedel som studieprotokollet inte tillåter samtidigt. Prövaren inkluderar och avslutar patienter med randomiseringskod, och prövningsläkemedlet ordineras, iordningsställs, ges och följs upp med samma kontroller och historik som andra läkemedel. Prövaren ser studiens deltagare med ordinationer och givna doser.',
    expert: 'Systemet registrerar själv att patienten deltar som uppmärksamhetsinformation med studienummer och ansvarig prövare, och varnar med prövarens namn när prövningsläkemedlet ordineras till någon utanför studien eller ett läkemedel som protokollet inte tillåter ordineras till en deltagare.',
    anmarkning: 'Studien, sponsorn och prövningsläkemedlet är påhittade demoposter. Redovisning av prövningsläkemedel till sponsorn, avblindning och rapportering till Läkemedelsverket finns inte och står inte i kravtexten.' },
];
