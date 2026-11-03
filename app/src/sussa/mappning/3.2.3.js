// Sussa 3.2.3 Processtöd för specifika vårdprocesser: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A } = TEST;

export default [
  { id: '3.2.3.1', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Dokumentation av psykiatrisk tvångsvård enligt LPT och LRV är inte byggd.' },
  { id: '3.2.3.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.2.3.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  { id: '3.2.3.4', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Inte byggt.' },
  {
    id: '3.2.3.5', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${A}väntrummet visar aldrig namn för skyddad patient`,
    ],
    losning: 'Väntrummet på akutmottagningen med könummer, prioritet, ankomst och väntetid. Uppropning sker med könummer.',
    expert: 'Systemet sorterar på prioritet och väntetid och väljer själv att ropa upp med könummer, så skyddad identitet aldrig röjs vid uppropningen.',
    anmarkning: 'In- och utregistrering, triage, logistik mellan stegen och flödesöversikt för akutmottagningen saknas.',
  },
];
