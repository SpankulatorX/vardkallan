// Runda 13, r1: reglerna för synpunkter från testare, som gränssnittet och servern delar (src/synpunkter.js). Sidan visar
// samma text om vad som sparas som servern följer, innan någon skriver något.

// Vad synpunkten gäller. Nyckeln sparas, texten visas.
export const TYPER = [
  ['fel', 'Något är fel'],
  ['saknas', 'Något saknas'],
  ['svart', 'Svårt eller krångligt'],
  ['vard', 'Fel i fackspråket eller i vården'],
  ['annat', 'Annat'],
];
// Hur allvarligt det är för testaren.
export const ALLVAR = [
  ['stoppar', 'Det stoppar mig, jag kan inte göra det jag ska'],
  ['stor', 'Det går, men det tar för lång tid eller blir lätt fel'],
  ['liten', 'En detalj eller ett förslag'],
];
// Testarens yrke, frivilligt. Systemet förväljer det yrke som testaren valde på startsidan.
export const YRKEN = [
  ['lakare', 'Läkare'],
  ['sjukskoterska', 'Sjuksköterska'],
  ['underskoterska', 'Undersköterska'],
  ['barnmorska', 'Barnmorska'],
  ['vardadministrator', 'Vårdadministratör eller medicinsk sekreterare'],
  ['paramedicin', 'Fysioterapeut, arbetsterapeut, dietist eller kurator'],
  ['systemforvaltare', 'Systemförvaltare eller IT i vården'],
  ['patient', 'Patient eller närstående'],
  ['annat', 'Annat yrke'],
];
// Journalsystem som testaren har arbetat i, frivilligt och flera val.
export const SYSTEM = [
  ['cosmic', 'Cosmic'],
  ['takecare', 'Take Care'],
  ['melior', 'Melior'],
  ['ncscross', 'NCS Cross'],
  ['pascal', 'Pascal'],
  ['annat', 'Annat journalsystem'],
  ['inget', 'Inget'],
];
// Hur länge testaren har arbetat i sitt journalsystem, frivilligt.
export const AR = [
  ['under-1', 'Kortare än ett år'],
  ['1-3', 'Ett till tre år'],
  ['3-10', 'Tre till tio år'],
  ['over-10', 'Mer än tio år'],
];
// Var testaren arbetar, frivilligt. Ingen arbetsplats.
export const VARDFORM = [
  ['region', 'Region'],
  ['kommun', 'Kommun'],
  ['privat', 'Privat vård'],
  ['annan', 'Annat'],
];
// Jämförelsen efter varje uppdrag: med hur testaren gör samma sak i sitt journalsystem i dag.
export const JAMFORELSE = [
  ['lattare', 'Lättare än i mitt journalsystem'],
  ['lika', 'Ungefär lika'],
  ['svarare', 'Svårare än i mitt journalsystem'],
  ['kan_inte', 'Det går inte att jämföra'],
];
export const MAX_MITT_SYSTEM = 120;
export const HOPPADE_OVER = 'hoppade_over';

export const MAX_TEXT = 2000;
export const MIN_TEXT = 3;
export const MAX_KONTAKT = 200;
export const GALLRING_DAGAR = 365;
export const KONTAKT_DAGAR = 90;

// Det som sparas, varför, hur länge och vem som läser. Visas i formuläret och på sidan Om demon.
export const SPARAS = [
  'Det du skriver i en synpunkt, vad den gäller och hur allvarligt det är för dig.',
  'Efter varje uppdrag: om det var lättare, ungefär lika eller svårare än i ditt journalsystem, det du skriver om varför och, om du vill, ungefär hur många klick eller hur lång tid det tar hos dig.',
  'Om du väljer att fylla i dem: vilket journalsystem du använder i dag, hur länge, ditt yrke och om du arbetar i region, kommun eller privat vård. Aldrig namn eller arbetsplats.',
  'Det systemet fyller i själv: vilken sida du var på (till exempel #/patient/p01, där p01 är en påhittad patient), vilken demoroll du var inloggad som, vilket uppdrag du arbetade med, versionen av Vårdkällan och av gränssnittet, skärmens bredd, webbläsarens namn och huvudversion, operativsystemets namn och tiden.',
  'Ingen e-postadress och inget namn, om du inte själv skriver en kontaktuppgift i det frivilliga fältet.',
  'Inga uppgifter om demons patienter, och ingen kopia av det du har gjort i sandlådan.',
  'Din adress sparas aldrig. Bara ett kontrollvärde som inte går att räkna tillbaka till adressen används för att stoppa den som skickar väldigt många synpunkter.',
];
export const VARFOR = 'Svaren sparas för att jämföra samma arbetsflöden med de journalsystem som vården använder i dag, och för att rätta det som är fel, bygga det som saknas och göra det som är svårt enklare. Resultaten redovisas bara sammanställda, aldrig så att en enskild testare går att känna igen.';
export const HUR_LANGE = `Synpunkter och svar raderas efter ${GALLRING_DAGAR} dagar. En kontaktuppgift raderas redan efter ${KONTAKT_DAGAR} dagar.`;
export const VEM_LASER = 'Bara projektets testledare läser synpunkterna och svaren, med en läskod som bara finns på servern. Länken till demon ger ingen läsrätt, och ingen annan besökare kan se dem. Du kan inte själv läsa eller ändra en synpunkt efter att du har skickat den, men du får ett kort nummer som bekräftelse.';
export const PERSONNUMMER_TEXT = 'Skriv inga personnummer. Ett riktigt personnummer tas inte emot, varken i texten eller i kontaktfältet, eftersom synpunkterna inte får innehålla uppgifter om riktiga personer. Demons påhittade patienter och Skatteverkets testpersonnummer går bra att nämna.';

// Ser ut som ett personnummer eller samordningsnummer: tio eller tolv siffror i följd, med bindestreck, plustecken eller
// mellanslag mellan grupperna. Servern prövar varje kandidat mot kontrollsiffran och Skatteverkets testnummer.
export function kandidater(text) {
  return (String(text ?? '').match(/\d(?:[\s+-]?\d)+/g) ?? []).filter(k => [10, 12].includes(k.replace(/[\s+-]/g, '').length));
}
