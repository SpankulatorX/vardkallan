// Sussa 3.7.1 Kommunikation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { MJ } = TEST;

export default [
  {
    id: '3.7.1.1', kategori: 'system', egna: ['L4', 'L5'], avsedd: 'delvis',
    tester: [
      `${MJ}inloggning med simulerad e-legitimation ger en egen session utan personalens behörigheter`,
      `${MJ}patienten når sin egen journal men inte någon annans, oavsett id i adressen`,
      `${MJ}anteckningstyp som vårdgivaren valt att inte visa döljs och redovisas`,
      `${MJ}begäran om spärr ändrar inte spärren och registreras som begäran till vården`,
      `${MJ}logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn`,
    ],
    losning: 'Min journal, Vårdkällans egen e-tjänst för invånare: patienten läser sin journal, ser vem som har läst den och kan begära spärr eller loggutdrag hos vården.',
    expert: 'Min journal visar bara det vårdgivaren har valt att visa och säger vad som inte visas och varför, så patienten behöver inte förstå journalens regler.',
    anmarkning: 'Meddelanden mellan patient och vård, ombud och 1177 saknas. Inloggningen med e-legitimation är simulerad, och begäranden handläggs inte av någon i demon.',
  },
  { id: '3.7.1.2', kategori: 'nationell', egna: ['L5', 'L8'], tester: [], avsedd: 'planerat',
    anmarkning: 'Kommunikation via 1177 Vårdguidens e-tjänster kräver anslutning till 1177 och är inte byggd.' },
  {
    id: '3.7.1.3', kategori: 'system', egna: ['L4', 'L5'], avsedd: 'delvis',
    tester: [
      `${MJ}spärrade uppgifter visas för patienten själv och spärren redovisas`,
      `${MJ}begäran om spärr ändrar inte spärren och registreras som begäran till vården`,
      `${MJ}vårdnadshavare läser barnets journal under 13 år men inte från 13 år eller för ett barn med skyddad identitet`,
      `${MJ}logglistan visar vårdenhet, yrkesroll, tid och typ av åtkomst men inte personalens namn`,
    ],
    losning: 'I Min journal ser patienten spärrar och vem som har läst journalen, kan begära spärr och loggutdrag, och vårdnadshavare kan läsa barnets journal enligt reglerna.',
    expert: 'Systemet avgör självt vad patienten och vårdnadshavaren får se utifrån ålder och skyddad identitet, så ingen behöver kunna reglerna för att använda tjänsten.',
    anmarkning: 'Patienten kan inte delta i planeringen, till exempel genom bokning, egen vårdbegäran eller meddelanden.',
  },
];
