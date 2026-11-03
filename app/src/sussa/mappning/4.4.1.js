// Sussa 4.4.1 Grundläggande behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { KV, FS, MJ } = TEST;

export default [
  {
    id: '4.4.1.1', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${FS}labbvärden har NPU-kod och UCUM-enhet`,
      `${MJ}provsvar visas när de är vidimerade eller efter 14 dagar, mätvärden direkt`,
    ],
    losning: 'Provsvar för patienten med NPU-kod och UCUM-enhet, som visas i journalen och i Min journal.',
    expert: 'Systemet avgör självt när ett provsvar får visas för patienten, när det är vidimerat eller efter 14 dagar.',
    anmarkning: 'Elektronisk beställning finns inte. Provsvaren kommer från seeden och inte från ett laboratorium.',
  },
  { id: '4.4.1.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Beställning till flera laboratorier är inte byggd.' },
  { id: '4.4.1.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Beställningar finns inte, och därmed inget beställnings-id.' },
  {
    id: '4.4.1.4', kategori: 'system', egna: ['D9'], avsedd: 'delvis',
    tester: [
      `${FS}labbvärden har NPU-kod och UCUM-enhet`,
      `${KV}varje mätvärdestyp har kod: NPU för labb, LOINC för vitalparametrar, och UCUM-enhet`,
    ],
    losning: 'Provsvar har NPU-kod och UCUM-enhet och visas på samma sätt i journalen, i Min journal och i FHIR.',
    expert: 'Systemet sätter kod och enhet själv, så samma värde tolkas likadant överallt utan att någon översätter det.',
    anmarkning: 'Beställningsdelen av processen saknas.',
  },
  { id: '4.4.1.5', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Krav enligt STAFS 2015:13 är inte bedömda.' },
];
