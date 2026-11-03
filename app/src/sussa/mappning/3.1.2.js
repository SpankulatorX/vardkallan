// Sussa 3.1.2 Visualisering - Presentationsvyer: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { B, A, S } = TEST;

export default [
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
];
