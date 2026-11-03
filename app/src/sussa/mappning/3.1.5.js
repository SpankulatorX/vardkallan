// Sussa 3.1.5 Uppmärksamhetsinformation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { M, F } = TEST;

export default [
  {
    id: '3.1.5.1', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [
      `${M}varning: överkänslighet med matchande ATC-prefix`,
      `${F}Observation, AllergyIntolerance, Encounter, ServiceRequest, Composition, Organization och Practitioner har rätt form`,
    ],
    losning: 'Överkänslighet registreras strukturerat med substans, reaktion och allvarlighetsgrad, lämnas ut som FHIR AllergyIntolerance och används i läkemedelsvarningarna.',
    expert: 'Systemet jämför varje ny ordination med registrerad överkänslighet och varnar med en förklaring, så förskrivaren behöver inte själv slå upp den.',
    anmarkning: 'Bara överkänslighet är strukturerad. Smitta, behandlingar och avvikande vårdrutiner enligt Socialstyrelsens rekommendation saknas, och strukturen är inte kontrollerad mot rekommendationen.',
  },
  { id: '3.1.5.2', kategori: 'system', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Patienthuvudet visar överkänslighet och markeringar i alla patientvyer, men det finns inget automatiskt test av det.' },
  {
    id: '3.1.5.3', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [
      `${M}varning: överkänslighet med matchande ATC-prefix`,
      `${M}allvarlig varning måste kvitteras med motivering`,
    ],
    losning: 'Överkänslighet är strukturerad och ger varning vid ordination. En allvarlig varning måste kvitteras med motivering.',
    expert: 'Systemet kontrollerar mot överkänsligheten i samma steg som ordinationen och kräver motivering bara när varningen är allvarlig.',
    anmarkning: 'Övrig uppmärksamhetsinformation enligt Socialstyrelsens rekommendation saknas.',
  },
];
