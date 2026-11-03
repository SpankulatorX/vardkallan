// Sussa 3.4.3 Kallelse och påminnelse: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { T, flode } from '../tidbok-tester.js';

export default [
  {
    id: '3.4.3.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.kallelse, T.paminnelse, T.skyddad],
    losning: 'Kallelser och påminnelser går till Min journal, med sms eller med brev. Patientens eget val av kanal sparas.',
    expert: 'Systemet väljer kanal själv: patientens val om det går, annars Min journal, sms eller brev. En patient med skyddade personuppgifter får kallelser bara i Min journal, och systemet förklarar varför.',
    anmarkning: 'Sms och brev är simulerade och märkta så. Inget skickas utanför demon.',
  },
  {
    id: '3.4.3.2', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [T.kallelse, T.grupp, T.gruppExempel, T.paminnelse, flode('gruppkallelse')],
    losning: 'Kallelse och påminnelse till en patient går ut när tiden bokas och två dagar före. Till en gruppträff skickas kallelserna till alla deltagare på en gång när det är bestämt att träffen blir av.',
    expert: 'Systemet skriver kallelserna och väljer kanal för varje deltagare. Varje patient prövas i behörighetsmotorn och loggas för sig.',
    anmarkning: 'Sms och brev är simulerade.',
  },
  {
    id: '3.4.3.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.kallelse, T.paminnelse, T.omboka, T.avboka, T.skyddad, T.egenIncheckning, T.grupp],
    losning: 'Systemet skriver kallelsen ur bokningen på enkel svenska: tid, plats, vårdgivarens yrke, förberedelser och avgift, aldrig journaltext. Påminnelsen går ut av sig själv, en ändrad eller avbokad tid ger ett nytt besked, och patienten kan bekräfta att hen kommer. Kallelserna som patienten har fått visas för personalen och i Min journal.',
    expert: 'Ingen behöver skriva eller skicka en kallelse för hand. Systemet ser när bokningen ändras och skickar ett nytt besked, och väljer kanal efter skyddad identitet och patientens val.',
    anmarkning: 'Språkpreferens, export till andra format, en central distributionskanal och kallelse till vårdkontakter utan förbokad tid saknas. Sms och brev är simulerade.',
  },
];
