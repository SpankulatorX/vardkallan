// Sussa 3.1.2 Visualisering - Presentationsvyer: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

// Runda 8, r3: avdelningens planering (sussa/bokning-r8.js).
import { medR8 } from '../bokning-r8.js';

const { B, A, S } = TEST;

// Runda 10, r2: anpassningsbara vyer, uppföljningsvyn och vyer utan personuppgifter (presentationsvyer.js,
// test/presentationsvyer.test.js). Posterna här ersätter de tidigare, också runda 8:s version av 3.1.2.2.
import { T4 } from '../planering-r4.js';
import { T8 } from '../bokning-r8.js';
const AV = 'Anpassningsbara vyer > ';
const UV = 'Uppföljningsvyn > ';
const VU = 'Vyer utan personuppgifter > ';
const MT = 'Medicinteknik > ';
const ID = 'Identitet > ';
const R10 = {
  '3.1.2.1': {
    id: '3.1.2.1', kategori: 'system', egna: ['D2', 'D8'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}översikten har tidslinje med migrerade poster märkta`,
      `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`,
      `${MT}en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten`,
      `${MT}värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm`,
      T4.vyer,
      `${AV}systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök`,
      `${AV}användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern`,
      `${AV}vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen`,
      `${AV}anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut`,
    ],
    losning: 'Manuellt registrerad information och värden från medicinteknisk utrustning visas i samma standardiserade vyer: översikten, journalen, mätvärdena med kurvor, Dagens arbete och tidboken, där värden från utrustning är märkta med källan. Vyerna är anpassningsbara: översikten per situation (delar, ordning och tidsurval), Dagens arbete och tidboken per användare, och vårdenhetens förval som systemförvaltningen eller verksamhetschefen sätter.',
    expert: 'Systemet väljer vy och innehåll utifrån yrkesroll, enhet och patientens läge, så varje roll ser det rollen behöver utan att någon ställer in det. Den som vill ändra gör det en gång, och valet följer med på alla datorer.',
    anmarkning: 'Journalens och mätvärdenas flikar har fasta kolumner. Anpassningen gäller översikten, Dagens arbete och tidboken.',
  },
  '3.1.2.2': {
    id: '3.1.2.2', kategori: 'system', egna: ['D2', 'M5'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}översikten har tidslinje med migrerade poster märkta`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
      T8.dag, T8.patientResurs,
      `${UV}uppföljningsvyn samlar vårdplanernas mål och avvikelser, passerade uppföljningsdatum och remisser med när, var och vem`,
      `${UV}uppföljningsvyn visar var i vårdprocessen patienten är och den samordnade planeringen med kommunen, och översikten sammanfattar den`,
      `${UV}uppföljningsvyn följer behörigheten: spärrad vårdenhet, annan vårdenhet utan aktivt val och fel roll`,
      `${ID}sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande`,
    ],
    losning: 'Standardvyer för patientens vårdprocess: översikten med kronologin, där migrerad historik syns likvärdigt med ny dokumentation, avdelningens och patientens planering med aktiviteter och åtgärder, och uppföljningsvyn som visar var i vårdprocessen patienten är, vårdplanernas mål och avvikelser, avvikande provsvar, läkemedel som ska följas upp, remisser med larm och samordnad planering med kommunen. Varje rad visar när, var och av vem, och vyn filtreras på typ. En journal som skapades för en oidentifierad patient slås samman med den gällande och visas samlad.',
    expert: 'Systemet samlar det som behöver följas upp ur vårdplanerna, provsvaren, ordinationerna, remisserna och den samordnade planeringen, sätter avvikelserna först och säger var i vårdprocessen patienten är, så att ingen behöver leta på flera ställen.',
    anmarkning: 'Vården mellan vårdgivare är den samordnade planeringen med kommunen, som är en egen vårdgivare och en simulerad part i demon. Information från vårdgivare utanför Vårdkällan visas genom 3.2.2.3.',
  },
  '3.1.2.3': {
    id: '3.1.2.3', kategori: 'system', egna: ['D11'], avsedd: 'uppfyllt_demo',
    tester: [
      T4.vyer,
      `${AV}systemet väljer situationen ur sammanhanget: rond för en inskriven patient, akut och mottagningsbesök`,
      `${AV}användaren anpassar delar, ordning och tidsurval per situation, och valet sparas på servern`,
      `${AV}vårdenhetens förval gäller före systemets och användarens eget före vårdenhetens, och sätts bara av systemförvaltningen eller verksamhetschefen`,
      `${AV}anpassningen visar aldrig mer än behörigheten: en del som rollen inte får läsa går inte att välja och lämnas aldrig ut`,
      `${ID}sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande`,
    ],
    losning: 'Översikten anpassas för användaren (vilka delar, i vilken ordning och hur lång tid tidslinjen visar), för ett verksamhetsområde (vårdenhetens förval, som systemförvaltningen eller verksamhetschefen sätter) och för en situation (mottagningsbesök, akut och rond, med var sitt förval). Dagens arbete och tidboken anpassas per användare och Dagens arbete också per vårdenhet. Varje del visar när, var och vem som skapade informationen.',
    expert: 'Systemet väljer situationen själv ur patientens läge och förklarar valet: en pågående akut vårdkontakt ger akut och en inskrivning rond. Användaren behöver inte ställa in något, och den som gör det ser aldrig mer än behörigheten.',
    anmarkning: 'Avgränsning: presentationsvyn är översikten, som anpassas för användaren, verksamheten och situationen. Journalens och mätvärdenas flikar har fasta kolumner.',
  },
  '3.1.2.4': {
    id: '3.1.2.4', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}väntrummet visar aldrig namn för skyddad patient`,
      T4.vantetider, T4.ledtider,
      `Intensivvård > uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter`,
      `${VU}beläggningsöversikten visar platser, belagda och lediga per avdelning utan namn, personnummer eller sal`,
      `${VU}utbildningsläget visar journalen pseudonymiserad och säger vilka uppgifter som aldrig visas`,
      `${VU}utbildningsläget följer behörigheten och visar aldrig en patient med skyddade personuppgifter eller spärrade uppgifter`,
    ],
    losning: 'Förberedda vyer utan personuppgifter: beläggningsöversikten per avdelning (platser, belagda, lediga, inskrivna och utskrivna i dag), väntrummet med könummer, uppföljningen av väntetider, remissernas ledtider och intensivvården som antal, och utbildningsläget, där en journal visas pseudonymiserad med diagnoser, läkemedel, mätvärden och anteckningar. Varje vy säger vilka uppgifter som aldrig visas.',
    expert: 'Systemet tar bort personuppgifterna på servern, så att de aldrig når webbläsaren: namn och personnummer byts mot en pseudonym, datum mot dagar, personalens namn mot yrkesroll och namn i fritexten mot en markering. Det avgör själv vem som får se vad och visar aldrig en patient med skyddade personuppgifter i utbildningsläget.',
    anmarkning: 'Begränsningar: fritext kan ändå innehålla uppgifter som pekar ut patienten, till exempel en närståendes namn som inte är registrerat eller en ovanlig händelse, och därför visas utbildningsläget bara för den som får läsa journalen. Antalet vårdplatser per avdelning är en demoregel.',
  },
};
const medR10 = (poster) => poster.map(x => R10[x.id] ?? x);

export default medR10(medR8([
  {
    id: '3.1.2.1', kategori: 'system', egna: ['D2', 'D8'], avsedd: 'delvis',
    tester: [
      `${A}översikten har tidslinje med migrerade poster märkta`,
      `${B}yrkesroll: undersköterska ser omvårdnadsanteckningar men inte läkaranteckningar`,
      `${B}yrkesroll: vårdadministratör får administrativa uppgifter men ingen journaltext eller läkemedel`,
    ],
    losning: 'Standardiserade vyer: patientöversikt med tidslinje, anteckningar, läkemedel, mätvärden, remisser och inkorg. Vad som visas styrs av yrkesrollen.',
    expert: 'Systemet väljer vy och innehåll utifrån yrkesroll och enhet vid inloggningen, så varje roll ser det rollen behöver utan att någon ställer in det.',
    anmarkning: 'Vyerna går inte att anpassa av användaren eller verksamheten.',
  },
  {
    id: '3.1.2.2', kategori: 'system', egna: ['D2', 'M5'], avsedd: 'delvis',
    tester: [
      `${A}översikten har tidslinje med migrerade poster märkta`,
      `${S}migrerad historik från VAS och Cosmic finns för patient 1`,
      `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`,
    ],
    losning: 'Översikten visar patientens vård i en kronologi där migrerad historik från VAS och Cosmic syns likvärdigt med ny dokumentation, och inkorgen visar det som väntar på åtgärd.',
    expert: 'Systemet lägger allt i samma kronologi och märker källan, så användaren behöver inte veta i vilket system en uppgift skrevs.',
    anmarkning: 'Vyer för hela vårdprocessen mellan vårdgivare, resultat och avvikelser över tid saknas.',
  },
  { id: '3.1.2.3', kategori: 'system', egna: ['D11'], tester: [], avsedd: 'planerat',
    anmarkning: 'Vyerna styrs av yrkesrollen. Anpassning för en användare, ett verksamhetsområde eller en situation finns inte.' },
  {
    id: '3.1.2.4', kategori: 'system', egna: ['L6'], avsedd: 'delvis',
    tester: [
      `${A}väntrummet visar aldrig namn för skyddad patient`,
    ],
    losning: 'Väntrummet på akuten visar könummer, prioritet och väntetid. Personal utanför akutmottagningen ser bara könummer, och patienter med skyddad identitet visas aldrig med namn.',
    expert: 'Systemet avgör självt vem som får se namn i väntrummet, så den som ropar upp behöver inte veta vem som har skyddad identitet.',
    anmarkning: 'Andra vyer utan personuppgifter, till exempel beläggningsöversikt eller vyer för utbildning, saknas.',
  },
]));
