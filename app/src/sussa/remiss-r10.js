// Runda 10, r6: remiss, del 4 (konsultation skild från remiss, urval i remissöversikten och läkarens kvittens av beslut
// på uppdrag). Testnamnen (app/test/remiss-del4.test.js och klickbudgeten) och de poster i Sussa 3.3.1 som byggdes i
// rundan. Mappningsfilen för avsnittet ersätter sina poster med dessa efter runda 8, r2 (remiss-r8.js), så att
// ändringen ligger samlad här. Testerna från de tidigare rundorna står kvar.
import { flode } from './tidbok-tester.js';

const RE4 = 'Remiss, del 4 > ';

export const T10 = {
  typ: `${RE4}konsultation: typen väljs när remissen skapas och följer med utkast, återanvändning, på uppdrag och vidarebefordran`,
  svar: `${RE4}konsultation: mottagaren svarar direkt med ett konsultationssvar, systemet kvitterar mottagning och bedömning och vårdansvaret stannar hos remittenten`,
  fhir: `${RE4}konsultation: en ServiceRequest med kategorin konsultation skapar en konsultation genom FHIR, och utan kategori blir det en remiss`,
  urval: `${RE4}översikt: remisserna filtreras på typ, status, prioritet och tid, och antalet per val räknar bara det som visas för den egna vårdenheten`,
  period: `${RE4}översikt: perioden räknas från en fast tid och intervallet följer svensk tid`,
  kvittens: `${RE4}beslut på uppdrag: hamnar i den ansvariga läkarens inkorg och kvitteras av läkaren i egen inloggning`,
  bilagor: `${RE4}bilagor: storleken och antalet är parametrar som systemförvaltaren sätter, med demons gränser som förval`,
  underkann: `${RE4}beslut på uppdrag: läkaren som inte håller med öppnar remissen igen för egen bedömning, och väntelistans post avslutas`,
};

const ANDRING = {
  '3.3.1.3': {
    tester: [T10.typ, T10.svar, T10.urval, T10.period, T10.kvittens],
    losning: ' En konsultation är märkt som konsultation i listor, på remisskortet och i FHIR, med texten om att vårdansvaret stannar hos remittenten. Översikten över inkommande och utgående går att filtrera på typ, status, prioritet och när remissen skickades, och varje val visar hur många remisser det ger. Kortet visar om ett beslut på uppdrag väntar på läkarens kvittens, är kvitterat eller har öppnats igen.',
    expert: 'Inkorgen visar självt vad som väntar, och kortet visar bara de steg som enheten och den inloggade får ta, med konsultationen märkt och vårdadministratören utan klinisk text. Översikten räknar antalet för varje urval bland vårdenhetens egna remisser, så att användaren ser vad ett val ger innan det görs.',
    anmarkning: 'Urvalet gäller översikten över den egna vårdenhetens remisser. Remisser från vårdgivare utanför Vårdkällan finns bara som registrerade pappersremisser (3.3.1.2).',
  },
  '3.3.1.4': {
    tester: [T10.typ, T10.fhir, T10.bilagor, flode('skicka-konsultation')],
    losning: ' Den som remitterar väljer om vårdansvaret ska lämnas över (remiss) eller om hon vill ha råd medan vårdansvaret stannar hos vårdenheten (konsultation). Valet finns i formuläret, i utkastet, i remissen på uppdrag och i FHIR som kategori, och följer med när en tidigare remiss återanvänds och när remissen skickas vidare.',
    expert: 'Systemet fyller i patient, avsändare, enhet, prioritet och sista svarsdatum, föreslår uppdragsgivaren ur patientens tider och vårdkontakter och frågar på vanlig svenska om vårdansvaret ska lämnas över, med remiss förvald. Den som skriver på uppdrag ser aldrig det hon inte får se.',
    anmarkning: 'Bilagor är PDF, PNG, JPEG eller text. Storleken och antalet är parametrar som systemförvaltaren sätter med fyra ögon, med 40 kB och fem per remiss som förval i den publika demon. Ett anrop får vara högst 64 kB, så en bilaga kan vara högst 45 kB i demon.',
  },
  '3.3.1.5': {
    tester: [T10.svar, T10.kvittens, T10.underkann],
    losning: ' En konsultation besvaras direkt med ett konsultationssvar, och patienten sätts inte upp på mottagarens väntelista. Ett beslut som vårdadministratören registrerar på uppdrag gäller direkt men hamnar i den ansvariga läkarens inkorg, där läkaren kvitterar det eller öppnar remissen igen och bedömer den själv.',
    expert: 'Systemet föreslår bakjouren, väljer nästa remisskonferens, kvitterar mottagningen och registrerar bedömningen själv när läkaren svarar på en konsultation, så att varje beslut tas med ett klick. Ett beslut på uppdrag hamnar självt i den ansvariga läkarens inkorg, och bara den läkaren kan kvittera det i sin egen inloggning.',
    anmarkning: 'Bakjouren (överläkaren) och konferenstiderna (tisdagar och torsdagar klockan 8) är demoregler. En remiss där patienten redan har fått en tid öppnas inte igen förrän tiden är avbokad.',
  },
};

export const medR10 = (poster) => poster.map(x => {
  const a = ANDRING[x.id];
  if (!a) return x;
  return { ...x, avsedd: 'uppfyllt_demo', tester: [...x.tester, ...a.tester], losning: `${x.losning}${a.losning}`, expert: a.expert, anmarkning: a.anmarkning };
});
