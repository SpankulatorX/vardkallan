// Sussa 2.7 Språk och författning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, L, J, M } = TEST;

export default [
  { id: '2.7.1.1', kategori: 'leverantor', egna: ['L11', 'M13'], tester: [], avsedd: 'planerat',
    anmarkning: 'Vårdkällan är inte CE-märkt. Läkemedelsvarningarna är märkta som demoregler.' },
  {
    id: '2.7.1.2', kategori: 'system', egna: ['L1', 'L2', 'L3', 'L4', 'L6', 'L7', 'L13'], avsedd: 'delvis',
    tester: [
      `${J}signerad anteckning kan inte ändras i databasen (trigger)`,
      `${B}spärr: aktivt val häver inte spärren`,
      `${B}nödåtkomst: häver aldrig en spärr`,
      `${L}UPDATE på loggen avbryts av trigger`,
      `${B}skyddad identitet: namn och personnummer maskeras`,
      `${M}ordinationsorsak är obligatorisk`,
    ],
    losning: 'Delar av patientdatalagen och HSLF-FS 2016:40 är byggda och testade: journalen kan inte ändras i efterhand, spärr och nödåtkomst följer lagen, varje åtkomst loggas och skyddad identitet maskeras.',
    expert: 'Lagkraven ligger i serverns regler, så användaren behöver inte kunna patientdatalagen: systemet frågar efter aktivt val, samtycke eller syfte just när lagen kräver det.',
    anmarkning: 'Lag 2022:913, MDR, NIS2, arkivlagen och tillgänglighetslagen är inte uppfyllda, och ingen juridisk granskning är gjord. Se de egna kraven L1 till L13.',
  },
  { id: '2.7.1.3', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Hela gränssnittet är på svenska, men det finns inget automatiskt test som kontrollerar det.' },
];
