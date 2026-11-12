// Sussa 11.2 Grundimplementation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, KR, LK, GA, SR } = TEST;

// Runda 14, r5: leverantörens åtaganden, servicenivåerna, utbildningsmaterialet och innovationsrummet (sussa/runda14-r5.js).
import { medR14r5 } from '../runda14-r5.js';

const R14_FORE = [
  { id: '11.2.1.1', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller hur leverantören driver grundimplementationen.' },
  { id: '11.2.1.2', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens organisation.' },
  { id: '11.2.1.3', kategori: 'leverantor', egna: ['M10'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller samverkan mellan leverantör och beställare.' },
  { id: '11.2.1.4', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Det finns inget utbildningsmaterial i form av e-learning eller instruktionsfilmer.' },
  {
    id: '11.2.1.5', kategori: 'leverantor', egna: ['D7', 'K4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${KR}status uppfyllt_demo bara när alla tester är gröna`,
      `${KR}saknade eller röda tester ger delvis`,
      // Runda 12, r3: testmetoden beskriven efter ISO/IEC/IEEE 29119-3 (testmetod.js och docs/testmetod.md).
      'Testmetod > testmetoden beskrivs efter ISO/IEC/IEEE 29119-3 med testplan, testdesign, testfall, testprocedurer och testrapporter, och allt den pekar på finns',
    ],
    losning: 'Testerna skrivs före koden, körs i varje bygge och i GitHub Actions, och bygget stoppas om ett test är rött. Testmetoden är dokumenterad i docs/testmetod.md efter dokumentstrukturen i ISO/IEC/IEEE 29119-3: teststrategi, testplan (kravregistren och klickbudgeten), testdesign med teknikerna i 29119-4, testfall, testprocedurer, testdata och testmiljö och testrapporter (kravsidan och resultatfilerna). Metoden har använts i varje runda sedan den första versionen.',
    anmarkning: 'Metoden är Vårdkällans egen tillämpning av standardens struktur och är inte certifierad. Ett test stoppar bygget om något som beskrivningen pekar på saknas. Acceptanstest med en beställare ingår inte.',
  },
  { id: '11.2.1.6', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens ansvar för tester fram till beställarens acceptanstest.' },
  {
    id: '11.2.1.7', kategori: 'leverantor', egna: ['K1', 'K4'], avsedd: 'delvis',
    tester: [
      `${KR}status uppfyllt_demo bara när alla tester är gröna`,
      `${SR}alla 389 id finns exakt en gång, och varje post har en mappning`,
      `${SR}uppfyllt_demo kräver gröna tester`,
      `${A}krav visar kravregistret`,
    ],
    losning: 'Kravregistret visar för varje eget krav och varje Sussa-post vilka tester som visar det, och status från det senaste bygget.',
    anmarkning: 'Inget acceptanstest med en beställare är gjort, och testprotokollet är kravregistret i demon.',
  },
  {
    id: '11.2.1.8', kategori: 'leverantor', egna: ['D4'], avsedd: 'delvis',
    tester: [
      `${LK}en ändrad ordination finns i läskopian inom 10 minuter utan att någon gör något`,
      'Administrering via API > Läskopia > en given dos finns i läskopians läkemedelsdel, identisk med det vanliga anropet',
      `${LK}varje del av läkemedelsdelen är identisk med det vanliga anropet och har en egen tid per patient`,
      `${LK}förnyelsen loggas inte var för sig: utlämnandet loggas när det börjar och när det slutar`,
      `${LK}innehåller bara det servern redan lämnar ut till den inloggade`,
      `${LK}yrkesrollen styr vad läskopian innehåller`,
      `${GA}läskopian förnyas av sig själv medan personen är inloggad`,
      `${GA}läsläget visar hur gammal läkemedelsinformationen är per patient och varnar efter 10 minuter`,
      `${GA}appen startar utan nät från service workern och visar läsläget`,
      `${GA}fel reservkod ger väntetid och rätt reservkod öppnar läsläget`,
    ],
    losning: 'Läskopian vid avbrott har en läkemedelsdel per patient med ordinationerna och dagens administreringar (givna, iordningsställda och överlämnade doser och doser som inte gavs), och en egen tidpunkt. Webbläsaren förnyar kopian av sig själv var fjärde minut medan personen är inloggad, så läkemedelsuppgifterna är aldrig äldre än 10 minuter när servern slutar svara. Läsläget visar per patient när uppgifterna hämtades och varnar tydligt när de är äldre än 10 minuter.',
    expert: 'Ingen behöver komma ihåg att ta en reservkopia: systemet förnyar den själv, mäter åldern och säger på vanlig svenska när uppgifterna är för gamla att lita på och vad man ska göra då.',
    anmarkning: 'Kravet säger att lösningen ska tas fram tillsammans med beställaren, och det är inte gjort. Under ett avbrott som varar längre än 10 minuter blir uppgifterna äldre än så, och läsläget varnar då.',
  },
  { id: '11.2.1.9', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens projektplan.' },
  { id: '11.2.1.10', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens projektplan.' },
  { id: '11.2.1.11', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens utbildningsplan. Testprotokollet för användartest (docs/anvandartest.md) är inte en utbildningsplan.' },
  { id: '11.2.1.12', kategori: 'leverantor', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens utbildningsinsatser.' },
];
export default medR14r5(R14_FORE);
