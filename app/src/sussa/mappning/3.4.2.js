// Sussa 3.4.2 Bokning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { T, flode } from '../tidbok-tester.js';
// Runda 6, r4.
import { medR4 } from '../planering-r4.js';
// Runda 8, r3.
import { medR8 } from '../bokning-r8.js';

const AVSNITT = [
  {
    id: '3.4.2.1', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [T.boka, T.omboka, T.avboka, T.behorighet, T.nekad, T.avvisad, T.relationsfonster, flode('boka-remiss'), flode('omboka')],
    losning: 'Bokning, ombokning och avbokning från startsidan, väntelistan, tidboken och patientens översikt. En bokning är en planerad vårdkontakt, och varje åtgärd prövas i behörighetsmotorn och loggas.',
    expert: 'Systemet föreslår de lämpligaste tiderna och bokningen är ett klick. Vid ombokning flyttas vårdkontakten med, och patienten får en ny kallelse utan att någon ber om det.',
    anmarkning: 'Bokningsregler som verksamheten själv kan ändra finns inte i gränssnittet. Reglerna för egenbokning ligger i seeden.',
  },
  {
    id: '3.4.2.2', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [T.forslag, T.boka, T.omboka, T.avboka, T.kallelse, flode('boka-remiss'), flode('omboka')],
    losning: 'Bokningen utgår från planeringen på väntelistan. Systemet väljer tider med rätt tidstyp och yrkesroll före gränsen, och bokningen skapar vårdkontakten och kallelsen. Avbokning lägger tillbaka patienten på väntelistan.',
    expert: 'Allt som går att räkna ut görs av systemet: tid, kallelse, kanal, avgift och vårdkontakt. Den som bokar väljer bara bland förslagen.',
    anmarkning: 'Mallar, bokning till flera resurser samtidigt, tider i följd och arbetslistor till medicinteknisk utrustning saknas.',
  },
  {
    id: '3.4.2.3', kategori: 'system', egna: ['L5'], avsedd: 'delvis',
    tester: [T.egenbokning, T.egenRegler, T.egenIncheckning, flode('egen-ombokning'), T.egenTidstyper, T.vhMinJournal],
    losning: 'Patienten bokar, bokar om och avbokar i Min journal på de tidstyper som mottagningen öppnar för det, och bara där patienten redan har vårdrelation. Egenbokningen gäller bara återbesök, telefon och video, aldrig nybesök eller gruppträff (beslut 2026-11-03). Vårdnadshavare gör det för barn under 13 år. Varje åtgärd loggas på patienten.',
    expert: 'Patienten får samma förslag på lämpliga tider som vårdadministratören. Systemet stänger egenbokningen 24 timmar före tiden och säger varför, stänger den för en tid som styr när en läkemedelsdos ska ges och skapar en bevakning när patienten avbokar.',
    anmarkning: 'Min journal är Vårdkällans egen e-tjänst. Publicering av tider till 1177 Vårdguidens e-tjänster och andra kanaler är inte byggd, och ombud kan inte boka.',
  },
];

// Runda 6, r4: posterna som byggdes i planering och tidbok, del 2, och remiss, del 2, ersätts ur sussa/planering-r4.js.
export default medR8(medR4(AVSNITT));
