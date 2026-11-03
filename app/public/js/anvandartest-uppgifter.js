// Uppgifterna i användartestet (D6). En uppgift per flöde i klickbudgeten (app/src/klickbudget.js, FLODEN), i samma
// ordning, med samma namn, demoroll och startpunkt som skriptet test/klickbudget.cjs. Ett test i bygget kontrollerar
// att listorna stämmer överens. Texten beskriver en situation i vården och säger inte var man ska klicka.
//
// kontroll beskriver när uppgiftens mål syns på skärmen: en notis med en viss text, eller ett element med en viss text,
// eventuellt på en viss adress. Kontrollen registrerar om målet nåddes. Användaren markerar själv när uppgiften är klar.

// Resultatfilens format. scripts/sammanstall-anvandartest.js läser bara filer med det här formatet.
export const FORMAT = 'vardkallan-anvandartest';

// Höjs när en uppgiftstext ändras, så att resultat från olika formuleringar inte blandas i sammanställningen.
export const UPPGIFTSVERSION = 1;

// Startpunkterna i FLODEN: adress och ett element som visar att sidan är klar.
export const STARTPUNKT = {
  'Arbetslistan efter inloggning': { hash: '#/arbetslista', klar: '#lista table' },
  'Patientens översikt': { hash: '#/patient/p01', klar: '.tidslinje' },
};

export const UPPGIFTER = [
  {
    id: 'oppna-patient', namn: 'Öppna patient från arbetslistan', roll: 'lak-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du arbetar som läkare på kardiologen och ska träffa Gunnar Åkesson. Ta fram hans journal så att du ser hans läkemedel och diagnoser.',
    kontroll: { hash: '^#/patient/p01$', sel: '#ov-lm', text: 'Aktuella läkemedel' },
  },
  {
    id: 'las-anteckning', namn: 'Läsa senaste anteckning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Du vill veta vad som hände senast någon skrev i Gunnars journal. Läs hela den senaste signerade anteckningen.',
    kontroll: { hash: '^#/patient/p01/journal/(?!ny$)[\\w-]+$', sel: '.anteckning .ant-fakta', text: 'Signerad' },
  },
  {
    id: 'daganteckning', namn: 'Skriva och signera en daganteckning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Du har träffat Gunnar på ronden. Han är pigg, äter bra och har inga bröstsmärtor. Du bedömer honom som stabil och planen fortsätter. Dokumentera det som en daganteckning och signera den.',
    kontroll: { notis: 'Anteckningen är signerad' },
  },
  {
    id: 'ordinera', namn: 'Ordinera ett läkemedel utan varning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar behöver magskydd. Ordinera omeprazol, en kapsel på morgonen, och följ upp om två veckor.',
    kontroll: { notis: 'är ordinerat' },
  },
  {
    id: 'utsattning', namn: 'Sätta ut ett läkemedel', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar har inte ont längre och behöver inte Alvedon. Sätt ut det.',
    kontroll: { notis: 'Alvedon är utsatt' },
  },
  {
    id: 'blodtryck', namn: 'Registrera blodtryck', roll: 'ssk-kard', start: 'Patientens översikt',
    text: 'Du arbetar som sjuksköterska på avdelning 72. Du har just mätt Gunnar Åkessons blodtryck till 128/82. Dokumentera värdet.',
    kontroll: { notis: 'Blodtryck 128/82' },
  },
  {
    id: 'remiss', namn: 'Skicka remiss', roll: 'lak-vc', start: 'Patientens översikt',
    text: 'Du är distriktsläkare. Gunnar har haft förmaksflimmer sedan 2014 och står på Waran. Du vill att kardiologen bedömer honom inför en elkonvertering. Skicka en remiss till kardiologiska kliniken.',
    kontroll: { notis: 'Remissen är skickad' },
  },
  {
    id: 'kvittera-svar', namn: 'Kvittera remissvar', roll: 'lak-vc', start: 'Arbetslistan efter inloggning',
    text: 'Kardiologen har svarat på en remiss som du skickat. Läs svaret och bekräfta att du har läst det.',
    kontroll: { notis: 'Svaret är kvitterat' },
  },
  {
    id: 'nodatkomst', namn: 'Nödåtkomst', roll: 'lak-akut', start: 'Arbetslistan efter inloggning',
    text: 'Du är läkare på akuten. Thomas Lindberg har kommit in medvetslös, och akuten har ingen vårdrelation med honom. Öppna hans journal så att du kan se vilka läkemedel han har.',
    kontroll: { sel: '.band-grund', text: 'Nödåtkomst' },
  },
  {
    id: 'reservnummer', namn: 'Registrera patient utan känd identitet', roll: 'lak-akut', start: 'Arbetslistan efter inloggning',
    text: 'En man i 40-årsåldern har kommit in till akuten. Han kan inte säga vem han är och har ingen legitimation. Registrera honom som patient så att akuten kan börja dokumentera.',
    kontroll: { notis: 'registrerad med reservnummer' },
  },
  {
    id: 'sla-samman', namn: 'Slå samman en dubblett', roll: 'adm-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du är vårdadministratör på kardiologen. Annika Holmgren skrevs in i natt med reservnummer eftersom hon saknade legitimation, men hon har redan en journal med personnummer. Se till att hon bara har en journal.',
    kontroll: { notis: 'Journalerna är sammanslagna' },
  },
];

// Deltagarens bakgrund. Bara val, inga fritextfält, så att inga identifierande uppgifter samlas in.
export const YRKESROLLER = [
  ['lakare', 'Läkare'], ['sjukskoterska', 'Sjuksköterska'], ['underskoterska', 'Undersköterska'],
  ['vardadministrator', 'Vårdadministratör eller medicinsk sekreterare'], ['annan', 'Annan yrkesroll i vården'],
];
export const ERFARENHET = [['0-1', 'Mindre än 2 år'], ['2-5', '2 till 5 år'], ['6-10', '6 till 10 år'], ['11-', 'Mer än 10 år']];

export const OPPNA_FRAGOR = [
  ['svarast', 'Vad var svårast?'],
  ['jamfort', 'Vad var bättre eller sämre än i det journalsystem du använder i dag?'],
  ['saknades', 'Vad saknade du?'],
];
