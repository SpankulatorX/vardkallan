// Sussa 2.7 Språk och författning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
import { LAGTESTER } from '../../lagmatris.js';

const { B, L, J, M } = TEST;
const SPRAK = 'Språk > ';
const LM = 'Lagkravsmatris > ';
const MATRISTESTER = [
  `${LM}varje relevant lag finns, och varje rad har tester eller en avgränsning med en förklaring`,
  `${LM}matrisens tester räknas in i 2.7.1.2, och statusen per rad följer testerna`,
  `${LM}API: krav/sussa ger matrisen under 2.7.1.2 med status per rad`,
];

export default [
  { id: '2.7.1.1', kategori: 'leverantor', egna: ['L11', 'M13'], tester: [], avsedd: 'planerat',
    anmarkning: 'Vårdkällan är inte CE-märkt. Läkemedelsvarningarna är märkta som demoregler.' },
  // Runda 9, r6: lagkravsmatrisen (lagmatris.js). Varje rad har tester eller en avgränsning.
  {
    id: '2.7.1.2', kategori: 'system', egna: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L10', 'L11', 'L12', 'L13'], avsedd: 'uppfyllt_demo',
    tester: [...LAGTESTER, ...MATRISTESTER],
    losning: 'En lagkravsmatris i kravregistret (lagmatris.js, under posten på kravsidan och i GET /api/krav/sussa) kopplar varje skyldighet för beställaren i patientdatalagen, HSLF-FS 2016:40, lagen om sammanhållen vård- och omsorgsdokumentation, patientsäkerhetslagen, patientlagen, OSL, dataskyddsförordningen, arkivlagen, lagen om nationell läkemedelslista, HSLF-FS 2017:37, lagen om tillgänglighet till digital offentlig service, cybersäkerhetslagen (NIS2), MDR och säkerhetsskyddslagen till den funktion som stödjer den och till testerna som visar det. Statusen per rad räknas ur testerna vid varje bygge.',
    expert: 'Lagkraven ligger i serverns regler, så användaren behöver inte kunna patientdatalagen: systemet frågar efter aktivt val, samtycke eller syfte just när lagen kräver det, och matrisen visar för varje paragraf vilken regel som gör det.',
    anmarkning: 'Avgränsning: posten gäller det som systemet kan göra vid användning. Det som bara organisationen eller tillverkaren kan uppfylla står i matrisen som avgränsning med en förklaring: behovs- och riskanalysen för behörigheter, systematiskt patientsäkerhetsarbete, register över behandlingar och konsekvensbedömning enligt dataskyddsförordningen, riskhantering och incidentrapportering enligt cybersäkerhetslagen, CE-märkning enligt MDR (Vårdkällan är inte CE-märkt) och säkerhetsskyddsanalys. Hänvisningarna till paragrafer är inte juridiskt granskade, och stark autentisering och NLL är simulerade.',
  },
  // Runda 5 (r3): språkkontrollen i app/test/sprak.test.js.
  {
    id: '2.7.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${SPRAK}gränssnittets texter är svenska, utan engelska ord, tankstreck, ellipser och interna anteckningar`,
      `${SPRAK}serverns felmeddelanden och varningar är svenska`,
      `${SPRAK}inga tankstreck, ellipser eller interna anteckningar någonstans i public/ och src/, inte heller i kommentarer`,
      `${SPRAK}kontrollen hittar engelska ord, okända förkortningar, tankstreck, ellipser och interna anteckningar`,
      `${SPRAK}kontrollen hittar å, ä och ö som saknas`,
    ],
    losning: 'Hela gränssnittet, Min journal och serverns felmeddelanden och varningar är på svenska. Vid varje bygge går ett test igenom alla texter som visas och stoppar bygget vid ett engelskt ord, ett tankstreck, en ellips, ett ord där å, ä eller ö saknas eller en intern anteckning. De sista lånorden är utbytta mot svenska ord (inget svar i tid, uppkopplad, syremättnad och tomt), och kontrollen stoppar de engelska orden om de kommer tillbaka.',
    expert: 'Systemet förklarar på vanlig svenska varför något inte går, och språkkontrollen ser till att ingen text på engelska eller med kodverkets namn når användaren.',
    anmarkning: 'Kontrollen bygger på en lista över vanliga engelska ord och en lista över tillåtna lånord, förkortningar och egennamn (FHIR, SITHS, NPÖ, ATC och andra). Ett engelskt ord som inte står i listan och inte har w upptäcks inte. Patientuppgifterna i demon (anteckningar och namn) kontrolleras inte, och ingen språkgranskning av en människa är gjord. FHIR-svarens kodverk (LOINC, ATC) har kodverkens engelska benämningar, som inte visas i gränssnittet. Sussas användbarhetstester (runda 7) spelas i det svenska gränssnittet, och formulären för SUS och expertgranskning är på svenska, med Sussas egen formulering av SUS.',
  },
];
