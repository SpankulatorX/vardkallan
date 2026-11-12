// Sussa 11.2 Grundimplementation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { A, KR, LK, GA, SR } = TEST;

export default [
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
      // Runda 14, r4: testprotokollet med spårbarhet (testprotokoll.js, docs/testprotokoll.md och sidan Testprotokoll).
      'Testprotokoll > varje krav och varje Sussa-post med tester finns med sina testfall, resultat, datum och version',
      'Testprotokoll > ett test som saknas, är rött eller inaktuellt syns som det, och summan räknas ur testfallen',
      'Testprotokoll > protokollet säger att inget acceptanstest med en beställare är gjort, också i markdown',
      'Testprotokoll > källan och datumet för varje testfall kommer från filen som testet kördes i',
      'Testprotokoll > docs/testprotokoll.md är skrivet av skriptet med version, kodhash och acceptanstestet',
      'Testprotokoll i API:t > GET /api/krav/testprotokoll är öppen utan inloggning och skapar ingen sandlåda',
    ],
    losning: 'Testprotokollet räknas ur kravregistret, Sussa-registret och resultaten från det senaste bygget. För varje eget krav och varje Sussa-post med tester visas testfallen, resultatet för varje testfall, i vilken körning och när det kördes, och vilken byggd version protokollet gäller: versionen och en kodhash över serverns och gränssnittets källkod. Krav utan testfall räknas upp för sig. Protokollet finns som docs/testprotokoll.md, skrivet av ett skript efter bygget, och som en utskrivbar sida i demon (Testprotokoll, länkad från kravsidan) som räknas ur bygget som körs.',
    anmarkning: 'Inget acceptanstest med en beställare är gjort. Protokollet är underlaget inför ett acceptanstest, med Vårdkällans egna automatiska tester, och beställarens egna testfall och kriterier finns inte med.',
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
      // Runda 14, r4: den andra källan, vårdenhetens reservdator för läkemedel (reservlakemedel.js och vyn Reservdator).
      'Reservdator för läkemedel > listan har alla inskrivna patienter på vårdenheten med aktuella ordinationer och dagens doser, ur samma svar som de vanliga anropen',
      'Reservdator för läkemedel > bara sjuksköterskor och läkare använder reservdatorn, och bara för den egna vårdenhetens inskrivna patienter',
      'Reservdator för läkemedel > en spärrad vårdenhets ordinationer finns inte med, och skyddad identitet är maskerad',
      'Reservdator för läkemedel > utlämnandet till reservdatorn loggas som en period: en rad när patienten kommer med och en när det slutar',
      'Gränssnitt > Klickbudget > Göra en dator till vårdenhetens reservdator för läkemedel inom budget',
    ],
    losning: 'Läskopian vid avbrott har en läkemedelsdel per patient med ordinationerna och dagens administreringar (givna, iordningsställda och överlämnade doser och doser som inte gavs), och en egen tidpunkt. Webbläsaren förnyar kopian av sig själv var fjärde minut medan personen är inloggad, så läkemedelsuppgifterna är aldrig äldre än 10 minuter när servern slutar svara. Läsläget visar per patient när uppgifterna hämtades och varnar tydligt när de är äldre än 10 minuter. Runda 14: en andra källa när också den egna datorn är nere eller personen inte var inloggad när avbrottet började. En dator på vårdenheten är reservdator för läkemedel (sidan Reservdator för läkemedel, länkad från Läkemedel att ge): den hämtar själv ordinationerna och dagens doser för alla inskrivna patienter på vårdenheten var fjärde minut, med samma behörighet som läkemedelslistan, visar dem med sin ålder när kärnsystemet inte svarar och skriver ut dem på papper.',
    expert: 'Ingen behöver komma ihåg att ta en reservkopia eller skriva ut en reservlista: systemet förnyar både läskopian och reservdatorns lista själv, mäter åldern och säger på vanlig svenska när uppgifterna är för gamla att lita på och vad man ska göra då.',
    anmarkning: 'Kravet säger att lösningen ska tas fram tillsammans med beställaren och att ersättningen ska överenskommas särskilt, och det är inte gjort. Under ett avbrott som varar längre än 10 minuter blir uppgifterna äldre än så, och läsläget och reservdatorn varnar då. I demon är reservdatorn en flik i samma webbläsare; i vården ska det vara en egen dator på vårdenheten med egen ström och nätanslutning. Reservdatorns lista finns bara i flikens minne: laddas sidan om under avbrottet är den borta, och då gäller utskriften.',
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
