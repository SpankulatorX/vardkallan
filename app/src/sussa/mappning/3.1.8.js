// Sussa 3.1.8 Sök: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const { A } = TEST;
// Runda 6, r1: sökning i patientens journal (journalsok.js).
const SJ = 'Sökning i journalen > ';
const sokFlode = klickbudgetTest(FLODEN.find(f => f.id === 'sok-journal'));

export default [
  {
    id: '3.1.8.1', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}sök på namn hittar namn med å, ä och ö oavsett skiftläge`,
      `${A}sökningen loggas`,
      `${SJ}blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning`,
      `${SJ}en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen`,
      `${SJ}spärrade uppgifter: inga träffar, och svaret röjer inte att de finns, inte heller med nödåtkomst`,
      `${SJ}andra vårdenheters uppgifter söks först efter ett aktivt val, och svaret nämner dem inte per träff`,
      `${SJ}sökningen loggas som läsning med söktermen och antalet synliga träffar i syftet`,
      sokFlode,
    ],
    losning: 'Patientsök på namn eller identitet i hela regionen, och ett sökfält i patientens journal som söker i anteckningar, diagnoser, läkemedel och mätvärden. Träffarna står i tidsordning med träffen markerad, och ett klick öppnar uppgiften där den finns i journalen.',
    expert: 'Systemet tolkar frågan själv: blodtryck eller feber hittar mätvärdet, en ICD-10-kod diagnosen och ett läkemedelsnamn, en ATC-kod eller en grupp som blodförtunnande ordinationen, och svaret säger hur frågan tolkades. Sökningen ser bara det läsningen får se, så inget spärrat eller dolt röjs.',
    anmarkning: 'Sökning på grupp-, vårdenhets- och vårdgivarnivå (till exempel alla patienter med en viss diagnos) finns inte i journalen. Datauttaget för uppföljning har uppgifterna utan namn.',
  },
  {
    id: '3.1.8.2', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${A}sök maskerar skyddad patient och hittar den bara på fullständigt personnummer`,
      `${A}sök på namn hittar namn med å, ä och ö oavsett skiftläge`,
      `${SJ}blodtryck hittar mätvärdet och anteckningar, med markerad träff och i kronologisk ordning`,
      `${SJ}en ICD-10-kod hittar diagnosen och ett läkemedelsnamn ordinationen`,
      `${SJ}en läkemedelsgrupp hittar ordinationen och anteckningar som nämner läkemedlet`,
      `${SJ}yrkesrollen: undersköterskan hittar omvårdnad men inte läkaranteckningar eller diagnoser, vårdadministratören nekas`,
      `${SJ}skyddad identitet: svaret innehåller varken namn eller personnummer`,
      sokFlode,
    ],
    losning: 'Fritext och kodad information i samma sökfält: fritext i anteckningarnas sökord, ICD-10-SE för diagnoser, ATC och läkemedelsgrupper för ordinationer och mätvärdestyper med vanliga ord. Patientsöket tar namn och alla slags identiteter.',
    expert: 'Sökningen tål skiftläge och å, ä och ö, tolkar vanliga ord till kodverken och förklarar tolkningen, så användaren behöver varken kunna koderna eller veta var uppgiften står.',
    anmarkning: 'Filter på typ, tid och vårdenhet i sökträffarna och sökning på grupp-, vårdenhets- och vårdgivarnivå saknas.',
  },
];
