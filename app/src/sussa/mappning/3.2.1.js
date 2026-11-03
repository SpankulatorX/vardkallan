// Sussa 3.2.1 Processtöd med integrerat kunskaps- och kliniskt beslutsstöd: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { M } = TEST;

export default [
  {
    id: '3.2.1.1', kategori: 'system', egna: ['D10', 'L11'], avsedd: 'delvis',
    tester: [
      `${M}varningarna är märkta som demoregler`,
      `${M}allvarlig varning måste kvitteras med motivering`,
      `${M}varning: warfarin och NSAID`,
      `${M}varning: metformin vid lågt eGFR`,
    ],
    losning: 'Kliniskt beslutsstöd vid ordination i en egen modul: varningar för överkänslighet, dubbelordination, interaktioner och njurfunktion.',
    expert: 'Systemet kontrollerar ordinationen mot överkänslighet, andra läkemedel och provsvar innan den sparas och förklarar på vanlig svenska varför det varnar.',
    anmarkning: 'Varningarna är demoregler och inte kliniskt beslutsstöd. Processtöd för vårdförlopp och kunskapsstöd saknas.',
  },
  {
    id: '3.2.1.2', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [
      `${M}varningarna är märkta som demoregler`,
      `${M}allvarlig varning måste kvitteras med motivering`,
    ],
    losning: 'Beslutsstödet är integrerat i ordinationen och visas innan ordinationen sparas.',
    expert: 'Varningen kommer i samma steg som ordinationen, så användaren behöver inte öppna ett annat verktyg för att kontrollera.',
    anmarkning: 'Processtöd saknas, och varningarna är demoregler.',
  },
  {
    id: '3.2.1.3', kategori: 'system', egna: ['D10'], avsedd: 'delvis',
    tester: [
      `${M}varning: överkänslighet med matchande ATC-prefix`,
      `${M}varning: metformin vid lågt eGFR`,
      `${M}varningarna är märkta som demoregler`,
    ],
    losning: 'Första steget i beslutsstödstrappan (dokumentations- och visualiseringsstöd) och enkla kunskapsbaserade regler vid ordination.',
    expert: 'Reglerna använder det som redan finns i journalen, som överkänslighet och eGFR, så användaren behöver inte mata in något extra för att få varningen.',
    anmarkning: 'Kunskapsgenererande system saknas, och reglerna är demoregler utan MDR-bedömning.',
  },
];
