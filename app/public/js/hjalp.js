// Hjälp i sammanhanget (Sussa 10.1.1.5 och 10.1.1.3): en kort förklaring i de vanligaste flödena av vad användaren gör
// och vad systemet gör åt användaren. Hjälpen är stängd tills den öppnas, så att den inte tar plats för den som kan
// flödet, och den länkar till övningarna under Utbildning.
import { esc } from './ui.js';

export const HJALP = {
  'oppna-patient': {
    rubrik: 'Öppna en patient',
    steg: ['Klicka på patientens namn i listan.', 'Översikten visar läkemedel, diagnoser, mätvärden och de senaste anteckningarna direkt.'],
    systemet: 'Listan har bara patienter med vårdrelation på din enhet. Skyddad identitet maskeras, och en spärr visas som en markering utan innehåll.',
  },
  daganteckning: {
    rubrik: 'Skriva en anteckning',
    steg: ['Välj Ny anteckning. Mallen Daganteckning är förvald.', 'Skriv under de sökord som behövs, till exempel Aktuellt och Bedömning.', 'Välj Signera, eller Spara utkast om du vill fortsätta senare.'],
    systemet: 'Anteckningen knyts till den pågående vårdkontakten. En signerad anteckning ändras aldrig, den rättas med en ny version där den gamla finns kvar.',
  },
  ordinera: {
    rubrik: 'Ordinera eller sätta ut ett läkemedel',
    steg: ['Välj Ordinera och sök på läkemedlets namn eller substans.', 'Välj träffen. Systemet föreslår dosering och tider, som du ändrar om de inte passar.', 'Skriv ordinationsorsaken, välj uppföljning och spara.', 'Sätt ut med knappen på läkemedlets rad och skriv orsaken.'],
    systemet: 'Ordinationen kontrolleras mot överkänslighet, andra läkemedel och högsta dos innan den sparas, och en allvarlig varning kräver en motivering. Överföringen till NLL bevakas (simulerad i demon).',
  },
  inkorg: {
    rubrik: 'Inkorgen',
    steg: ['Raderna är det som väntar på dig: osignerade anteckningar, remissvar att kvittera, larm och påminnelser.', 'Klicka på en rad för att läsa, och kvittera eller signera där.'],
    systemet: 'Systemet lägger själv in det som saknar kvittens eller har gått över tiden, och släpper inget förrän det är åtgärdat.',
  },
  matvarde: {
    rubrik: 'Registrera ett mätvärde',
    steg: ['Välj mätvärde. Blodtryck är förvalt.', 'Skriv värdet, till exempel 128/82, och välj Registrera.', 'För NEWS2 välj Registrera NEWS2-kontroll och fyll i vitalparametrarna.'],
    systemet: 'Enheten och koden sätts av systemet. Ett värde utanför referensintervallet markeras med text och ring i kurvan, och NEWS2 räknas själv och larmar i inkorgen när det behövs.',
  },
  'ge-dos': {
    rubrik: 'Ge en dos',
    steg: ['Leta upp patienten i listan. Dagens doser står i tidsordning.', 'Välj Ge på dosen. Vid behov finns under varje patient.'],
    systemet: 'Systemet räknar fram doserna ur ordinationerna och varnar för dubbel dos, för tidig dos och högsta dygnsdos med en förklaring. En undersköterska ser knappen Ge bara med en giltig delegering.',
  },
  remiss: {
    rubrik: 'Skicka en remiss',
    steg: ['Välj Skicka remiss.', 'Välj mottagare och skriv frågeställning och anamnes. Prioritet och sista svarsdatum är förvalda.', 'Välj Skicka remissen, eller Spara utkast.'],
    systemet: 'Remissen bevakas: uteblir mottagningskvittensen, svaret eller din kvittens av svaret kommer ett larm i inkorgen.',
  },
  sok: {
    rubrik: 'Söka patient och nödåtkomst',
    steg: ['Skriv namn eller personnummer i valfritt format och tryck Enter.', 'Öppna träffen. Saknas vårdrelation föreslår systemet rätt väg: samtycke, aktivt val eller nödåtkomst.', 'Nödåtkomst kräver ett syfte och intyg om att patienten inte kan samtycka.'],
    systemet: 'Systemet avgör själv om du har skrivit ett personnummer, samordningsnummer, reservnummer eller namn och förklarar vad som är fel. Varje sökning och nödåtkomst loggas.',
  },
  boka: {
    rubrik: 'Boka en tid',
    steg: ['Dagens arbete visar remisser som väntar på tid, med dagar kvar mot vårdgarantin.', 'Välj Boka på raden och sedan en av tiderna som systemet föreslår.'],
    systemet: 'Systemet föreslår de lämpligaste tiderna, skriver kallelsen och väljer kanal. Vårdgarantin och avgifterna är demoregler.',
  },
};

// Hjälpen som en utfällbar ruta. id är nyckeln i HJALP.
export function hjalpRuta(id) {
  const h = HJALP[id];
  if (!h) return '';
  return `<details class="flodeshjalp" data-hjalp="${esc(id)}">
    <summary><span class="flodeshjalp-ikon" aria-hidden="true">?</span>Hjälp: ${esc(h.rubrik.toLowerCase())}</summary>
    <div class="flodeshjalp-inre">
      <ol>${h.steg.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p><strong>Det här gör systemet åt dig:</strong> ${esc(h.systemet)}</p>
      <p class="liten"><a href="#/utbildning">Övningar och intyg under Utbildning</a></p>
    </div>
  </details>`;
}
