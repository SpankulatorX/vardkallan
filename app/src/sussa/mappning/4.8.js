// Sussa 4.8 Cytostatika: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: cytostatikabehandling ur regim (cytostatika.js), se docs/design.md, avsnittet Specialistområden.
// Runda 11, r4: regimbiblioteket, premedicineringen, den kumulativa dosen, beredningsenheten (cytostatika-beredning.js),
// infusionen, patientens uppföljning i Min journal och uppföljningen i datauttaget, med gränssnitt i journalen, på
// vårdenheten och på beredningsenheten. Se docs/design.md, avsnittet Cytostatika och blodprodukter i version 1.1.
import { CYTOSTATIKA as T } from '../runda9-r3.js';
import { CYTOSTATIKA_R11 as R, GRANSSNITT_R11R4 as G } from '../runda11-r4.js';

const ORD = [T.regim, T.karboplatin, T.prov, T.dosjustering, T.sakerhet, T.enhet, T.behorighet, T.api, R.regimbibliotek, R.premed, R.kumulativ, R.kapacitet, R.enhet, R.api, G.godkann, G.regim];
const BERED = [T.beredning, T.sakerhet, T.enhet, T.api, R.beredning, R.lager, R.sparbarhet, R.sakerhet, R.kapacitet, R.api, G.bered];
const GE = [T.sangen, T.dubbel, T.peroral, T.sakerhet, T.enhet, T.behorighet, T.api, R.premed, R.infusion, R.reaktion, R.min, R.api, G.min];

export default [
  { id: '4.8.1.1', kategori: 'system', egna: [], tester: ORD, avsedd: 'uppfyllt_demo',
    losning: 'Läkaren ordinerar cytostatika ur regimbiblioteket i fliken Cytostatika. Regimen har cykler, dagar och premedicinering, och systemet räknar doserna och godkänner kuren först när provsvaren, den kumulativa dosen och beredningsenhetens platser tillåter den.',
    expert: 'Systemet hämtar längd, vikt och kreatinin ur journalen och räknar kroppsyta, njurfunktion, dos och kumulativ dos, och förklarar varför en kur inte kan godkännas.',
    anmarkning: 'Regimerna (EC, karboplatin och kapecitabin), premedicineringen och gränserna är demoregler. Specialområdet sköts delvis upp i Tilläggsavtal 3.' },
  { id: '4.8.1.2', kategori: 'system', egna: [], tester: BERED, avsedd: 'uppfyllt_demo',
    losning: 'En godkänd kur från USÖ blir en beredningsorder i arbetslistan på Cytostatikaberedningen USÖ, där farmaceuten bereder och signerar i sin egen inloggning med batch och kontrollmätt volym. Kurer från andra sjukhus går till en simulerad extern beredning, som svarar elektroniskt när beredningen är klar.',
    expert: 'Systemet räknar volymen ur stamlösningen, väljer bärarlösning och volym, föreslår den batch som går ut först och prövar kontrollmätningen.',
    anmarkning: 'Beredningsenheten finns bara i demon, och lagret och gränsen för kontrollmätningen är demoregler. Kontrollmätningen skrivs in, ingen våg är ansluten.' },
  { id: '4.8.1.3', kategori: 'system', egna: [], tester: GE, avsedd: 'uppfyllt_demo',
    losning: 'Den beredda kuren tas emot med streckkodskontroll, premedicineringen ges, kuren iordningställs vid sängen, dubbelkontrolleras av en andra person i sin egen inloggning och ges i regimens ordning, med infusionens start, takt, avbrott, reaktioner, extravasering och slut. Peroral behandling överlämnas till patienten, som följer upp den i Min journal.',
    expert: 'Systemet kontrollerar id-band, etikett, premedicinering, hållbarhet och ordning, räknar takten och tabletterna och säger vad som ska göras vid en reaktion eller extravasering.',
    anmarkning: 'Råden vid reaktion och extravasering är demoregler. Infusionspumpen är inte ansluten, takten registreras av den som ger kuren.' },
  { id: '4.8.1.4', kategori: 'system', egna: [], tester: ORD, avsedd: 'uppfyllt_demo',
    losning: 'Regimbiblioteket har versioner. En läkare föreslår en ny version, systemet skriver vad som ändras, och en regimansvarig läkare godkänner eller avslår den i sin egen inloggning. Nya ordinationer får den godkända versionen och pågående behandlingar behåller sin. Regimerna har cykler, intervall, dagar, premedicinering och gräns för den kumulativa dosen. Doserna räknas per kroppsyta (Mosteller) eller med Calverts formel för karboplatin ur njurfunktionen (Cockcroft-Gault, med tak). Före varje kur prövas provsvaren, den kumulativa dosen och beredningsenhetens kapacitet, och läkaren godkänner kuren, justerar dosen med orsak eller skjuter upp cykeln till den dag som systemet föreslår. Varje kur visar skillnaden mot förra kuren.',
    expert: 'Systemet räknar och avrundar doserna, säger vilka provsvar som saknas eller ligger under gränsen, hur mycket av gränsen för den kumulativa dosen som återstår och vilken dag beredningsenheten har plats, och räknar om doserna när vikten ändras.',
    anmarkning: 'Tre regimer som demoregler (EC, karboplatin och kapecitabin). Regimansvarig är i demon den läkare som är ansvarig för läkemedelsmallar på sin vårdenhet. Den kumulativa dosen räknas på de behandlingar som den inloggade får se.' },
  { id: '4.8.1.5', kategori: 'system', egna: [], tester: BERED, avsedd: 'uppfyllt_demo',
    losning: 'Beredningsenheten har en arbetslista per dag med varje dos, beräkning, stamlösning, volym, bärarlösning, total volym, infusionstid, hållbarhet och etikett, ett lager med batcher och utgångsdatum, spårbarhet från en batch till varje patient som har fått den och kapacitet per dag som styr hur många kurer som kan godkännas. Beredningen signeras med batch och kontrollmätt volym.',
    expert: 'Systemet räknar volym och tabletter, föreslår batchen, nekar fel substans, utgången batch och en mätning utanför gränsen, säger om lagret räcker till de planerade kurerna och kontrollerar streckkoden när beredningen tas emot och vid sängen.',
    anmarkning: 'Beredningsenheten, lagret och gränsen för kontrollmätningen är demoregler.' },
  { id: '4.8.1.6', kategori: 'system', egna: [], tester: GE, avsedd: 'uppfyllt_demo',
    losning: 'Mottagningen läser etiketten. Vid sängen ges premedicineringen med en läsning av id-bandet, och den som ska ge kuren läser id-bandet och etiketten. Dosen väntar på dubbelkontroll hos de andra behöriga på vårdenheten, som bekräftar med en egen läsning i sin egen inloggning. Infusionen startas med en takt som systemet räknar, kan pausas och återupptas med lägre takt, och reaktioner och extravasering registreras med grad. Peroral behandling överlämnas till patienten med tabletter och instruktion, och patienten rapporterar intag och mående i Min journal.',
    expert: 'Systemet föreslår vem som kan kontrollera, aldrig den som iordningställde, nekar fel patient, fel etikett, saknad premedicinering, för gammal beredning och fel ordning med förklaring, avgör om infusionen ska fortsätta, pausas eller stoppas vid en reaktion och bedömer patientens rapport.',
    anmarkning: 'Råden vid reaktion, extravasering och patientens rapport är demoregler.' },
  { id: '4.8.1.7', kategori: 'system', egna: [], tester: [T.uppfoljning, T.api, R.uttag, R.reaktion, R.enhet, R.sparbarhet], avsedd: 'uppfyllt_demo',
    losning: 'Uppföljningen per vårdenhet visar pågående behandlingar per regim, planerade och givna kurer, beredningar, dosjusteringar, uppskjutna cykler, reaktioner och avbrutna infusioner, i vårdenhetens vy för cytostatika. Datauttaget för uppföljning har tabellen Cytostatikados med regim, version, cykel, dos per kvadratmeter, status, beredning och batch, och beredningsenheten följer upp beredningar, kontrollmätningar, kassationer och ledtider.',
    expert: 'Systemet räknar allt ur ordinationerna, beredningarna och administreringen, utan personuppgifter.',
    anmarkning: 'Uppföljningen gäller den egna vårdenheten. Datauttaget har inga personuppgifter och inga uppgifter från en spärrad vårdenhet.' },
];
