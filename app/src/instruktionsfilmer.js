// Runda 14, r5: instruktionsfilmerna (Sussa 11.2.1.4 och 10.1.1.3). Varje film är ett av de vanliga arbetsflödena i
// klickbudgeten (klickbudget.js), inspelat av test/instruktionsfilmer.cjs mot en lokal container med textade steg på
// svenska. Filmerna ligger i docs/filmer/ och spelas in på nytt efter varje ändring i gränssnittet, så att de alltid
// visar det gränssnitt som finns. Registret beror inte på db.js.
import { FLODEN } from './klickbudget.js';

// flode är id i FLODEN. Rollen och startpunkten hämtas därifrån, så att filmen gör exakt det flöde som klickbudgeten mäter.
const F = (id, flode, rubrik, beskrivning) => ({ id, flode, rubrik, beskrivning });

export const FILMER = [
  F('daganteckning', 'daganteckning', 'Skriva och signera en daganteckning', 'Läkaren skriver en daganteckning i patientens översikt och signerar den. Systemet fyller i vårdkontakt, enhet och tid.'),
  F('ordinera', 'ordinera', 'Ordinera ett läkemedel', 'Läkaren ordinerar ett läkemedel. Systemet föreslår dos och kontrollerar mot överkänslighet och andra läkemedel innan ordinationen sparas.'),
  F('remiss', 'remiss', 'Skicka en remiss', 'Distriktsläkaren skickar en remiss. Systemet föreslår mottagare och fyller i patientens uppgifter.'),
  F('ge-dos', 'ge-dos', 'Ge en dos', 'Sjuksköterskan ger en dos från Läkemedel att ge. Systemet räknar fram dagens doser ur ordinationerna och varnar för dubbel dos.'),
  F('news2', 'news2', 'Registrera en NEWS2-kontroll', 'Sjuksköterskan registrerar vitalparametrar. Systemet räknar NEWS2 och säger vad som ska göras och när nästa kontroll ska göras.'),
  F('ge-dos-delegering', 'ge-dos-delegering', 'Ge en dos med delegering', 'Undersköterskan ger en dos. Systemet prövar delegeringen för just den dosen och visar knappen Ge bara när delegeringen gäller.'),
  F('boka-remiss', 'boka-remiss', 'Boka tid för en remiss', 'Vårdadministratören bokar tid för en remiss från startsidan. Systemet föreslår en ledig tid som passar remissen.'),
  F('nodatkomst', 'nodatkomst', 'Nödåtkomst', 'Läkaren på akutmottagningen öppnar journalen för en patient utan vårdrelation. Systemet kräver syfte, loggar åtkomsten och häver aldrig en spärr.'),
  F('egen-ombokning', 'egen-ombokning', 'Boka om sin tid i Min journal', 'Patienten bokar om sin tid i Min journal och ser direkt den nya tiden.'),
  F('registrera-incident', 'registrera-incident', 'Registrera en incident', 'Systemförvaltaren registrerar en driftstörning. Systemet sätter prioriteten enligt servicenivåavtalet och säger när beställaren ska ha rapporten.'),
];

// Filen för en film, relativt repots rot.
export const filmFil = (id) => `docs/filmer/${id}.webm`;
// Största tillåtna storlek för en film, i byte.
export const MAX_BYTE = 2 * 1024 * 1024;

// Filmerna med flödets namn, roll och startpunkt ur klickbudgeten. Ett okänt flöde ger ett fel, så att registret och
// klickbudgeten inte kan glida isär.
export function filmer() {
  const perId = new Map(FLODEN.map(f => [f.id, f]));
  return FILMER.map((x) => {
    const f = perId.get(x.flode);
    if (!f) throw new Error(`Instruktionsfilmen ${x.id} pekar på ett flöde som inte finns i klickbudgeten: ${x.flode}`);
    return { ...x, roll: f.roll, start: f.start, flodesnamn: f.namn, budget: f.budget, fil: filmFil(x.id) };
  });
}
