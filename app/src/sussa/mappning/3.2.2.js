// Sussa 3.2.2 Vårdplaner och vårdprocesser: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, S } = TEST;

export default [
  { id: '3.2.2.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Vårdplaner är inte byggda.' },
  { id: '3.2.2.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  {
    id: '3.2.2.3', kategori: 'system', egna: ['D2', 'M5'], avsedd: 'delvis',
    tester: [
      `${A}migreringsavstämningen visar avvikelsen`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}översikten har tidslinje med migrerade poster märkta`,
    ],
    losning: 'Migrerad historik från VAS och Cosmic visas i samma kronologi som ny dokumentation, med källan utskriven och en avstämning av migreringen.',
    expert: 'Systemet lägger gammal och ny dokumentation i samma tidslinje och visar själv var en avvikelse finns, så användaren behöver inte leta i ett annat system.',
    anmarkning: 'Information som skapas utanför Vårdkällan, hos andra vårdgivare eller i kringsystem, hämtas inte. Migreringen gäller seedens poster.',
  },
];
