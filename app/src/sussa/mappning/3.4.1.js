// Sussa 3.4.1 Planering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, M, R, GK } = TEST;

export default [
  { id: '3.4.1.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Patientplanering är inte byggd.' },
  { id: '3.4.1.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Resursplanering är inte byggd.' },
  {
    id: '3.4.1.3', kategori: 'system', egna: ['D1', 'M4'], avsedd: 'delvis',
    tester: [
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
      `${R}larm: mottagningskvittens saknas efter 2 timmar`,
      `${M}NLL: timeout döljer inte ordinationen och avstämning hittar registreringen`,
    ],
    losning: 'Inkorgen samlar bevakningar för enheten och den inloggade: remisslarm, okvitterade svar och NLL-avvikelser.',
    expert: 'Systemet skapar bevakningarna självt utifrån det som händer, så ingen behöver lägga upp en påminnelse för hand.',
    anmarkning: 'Egna åtgärder och bevakningar som användaren lägger upp saknas.',
  },
  { id: '3.4.1.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.4.1.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.4.1.6', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.4.1.7', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Väntelistor är inte byggda.' },
  {
    id: '3.4.1.8', kategori: 'system', egna: ['D6'], avsedd: 'delvis',
    tester: [
      `${A}arbetslista maskerar skyddad identitet`,
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
      `${GK}Öppna patient från arbetslistan inom budget`,
    ],
    losning: 'Arbetslistan visar patienter med vårdrelation på enheten, och inkorgen visar bevakningar.',
    expert: 'Arbetslistan räknas fram ur vårdrelationen på den inloggades enhet, så användaren behöver inte bygga sin lista själv.',
    anmarkning: 'Aktivitetslistor per roll och nivå, till exempel för en hel klinik, saknas.',
  },
];
