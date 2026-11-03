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
  'Översikten för en remitterad patient': { hash: '#/patient/p05', klar: '.tidslinje' },
  'Översikten för en patient på mottagningen': { hash: '#/patient/p11', klar: '.tidslinje' },
  'Översikten för en inlagd patient': { hash: '#/patient/p04', klar: '.tidslinje' },
  'Vårdadministratörens startsida': { hash: '#/idag', klar: '#idag-dagens' },
  'Översikten för en patient med bokad tid': { hash: '#/patient/p15', klar: '.ov-tider' },
  // Runda 5, r4: forbered görs av anvandartest.js innan uppgiften börjar (Waran gör uppehåll med återinsättning i morgon).
  'Arbetslistan dagen före en återinsättning': { hash: '#/arbetslista', klar: '#lista table', forbered: 'uppehall-waran' },
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
    id: 'uppmarksamhet', namn: 'Bekräfta föreslagen uppmärksamhetsinformation', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar står på Waran, och det ska synas för alla som vårdar honom att han har en ökad blödningsrisk. Se till att det finns som uppmärksamhetsinformation i hans journal.',
    kontroll: { notis: 'Uppmärksamhetsinformationen är bekräftad' },
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
  {
    id: 'halsoarende', namn: 'Bekräfta ett hälsoärende', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkessons hjärtsvikt har följts både på mottagningen och nu under vårdtillfället. Se till att kontakterna hålls samman som ett hälsoärende.',
    kontroll: { notis: 'är bekräftat' },
  },
  {
    id: 'inskrivning', namn: 'Skriva in en patient', roll: 'ssk-kard', start: 'Översikten för en patient på mottagningen',
    text: 'Du arbetar som sjuksköterska på avdelning 72. Anna Viklund läggs in för elkonvertering och får sal 5. Skriv in henne på avdelningen.',
    kontroll: { notis: 'Patienten är inskriven' },
  },
  {
    id: 'flytta', namn: 'Flytta en patient till en annan avdelning', roll: 'ssk-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson behöver övervakas och flyttas till hjärtintensiven, sal 1. Registrera flytten.',
    kontroll: { notis: 'Patienten ligger nu på' },
  },
  {
    id: 'utskrivning', namn: 'Skriva ut en patient', roll: 'ssk-kard', start: 'Översikten för en inlagd patient',
    text: 'Elin Sandberg är färdigbehandlad och går hem i dag. Skriv ut henne.',
    kontroll: { notis: 'Patienten är utskriven' },
  },
  {
    id: 'registrera-besok', namn: 'Registrera ett besök', roll: 'adm-kard', start: 'Översikten för en remitterad patient',
    text: 'Du arbetar som vårdadministratör på kardiologen. Lars Wennberg har kommit till mottagningen efter en remiss från vårdcentralen. Registrera besöket.',
    kontroll: { notis: 'är registrerat' },
  },
  {
    id: 'planera-video', namn: 'Planera ett videobesök', roll: 'adm-kard', start: 'Översikten för en remitterad patient',
    text: 'Lars Wennberg ska ha ett uppföljande videobesök nästa vardag. Planera det.',
    kontroll: { notis: 'Video är registrerat till' },
  },
  {
    id: 'ge-dos', namn: 'Ge en dos', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du arbetar som sjuksköterska på avdelning 72. Gunnar Åkesson har ont och ber om något mot smärtan. Han har Alvedon vid behov. Ge honom en dos och dokumentera det.',
    kontroll: { notis: 'Alvedon är given' },
  },
  {
    id: 'vidimera', namn: 'Vidimera pågående ordinationer', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Du är läkare på kardiologen. Gunnars läkemedel har ändrats sedan han skrevs in. Gå igenom vad som har ändrats och bekräfta att listan med hans pågående ordinationer stämmer.',
    kontroll: { notis: 'Läkemedelslistan är vidimerad' },
  },
  {
    id: 'utsattning-varning', namn: 'Sätta ut ett läkemedel med varning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar har fått långsam puls och ska inte ha Metoprolol längre. Sätt ut det.',
    kontroll: { notis: 'Metoprolol Sandoz är utsatt' },
  },
  // Säkrare utsättning (runda 5).
  {
    id: 'utsattning-plan', namn: 'Sätta ut Waran med plan', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar ska opereras och ska göra uppehåll med Waran inför ingreppet. Sätt ut Waran så att det framgår när behandlingen ska börja igen.',
    kontroll: { notis: 'Waran är utsatt' },
  },
  {
    id: 'utskrift', namn: 'Skriva ut läkemedelslistan vid utskrivning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson ska gå hem från avdelningen och vill ha med sig sin läkemedelslista på papper. Skriv ut den åt honom.',
    kontroll: { notis: 'Utskriften är registrerad med id' },
  },
  {
    id: 'begar-kontrasignering', namn: 'Begära kontrasignering av en anteckning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Du vill att en överläkare går igenom och kontrasignerar den senaste anteckningen i Gunnars journal. Be om det.',
    kontroll: { notis: 'Begäran om kontrasignering är skickad' },
  },
  {
    id: 'kontrasignera', namn: 'Kontrasignera en anteckning', roll: 'lak-kard', start: 'Arbetslistan efter inloggning',
    text: 'Underläkaren Alva Berglund har bett dig kontrasignera hennes daganteckning om Elin Sandberg. Läs den och kontrasignera.',
    kontroll: { notis: 'Anteckningen är kontrasignerad' },
  },
  // Vem som får ge läkemedel (runda 5).
  {
    id: 'ge-dos-delegering', namn: 'Ge en dos med delegering', roll: 'usk-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du arbetar som undersköterska på avdelning 72 och har delegering att ge tabletter. Gunnar Åkesson har ont och ber om något mot smärtan. Han har Alvedon vid behov. Ge honom en dos och dokumentera det.',
    kontroll: { notis: 'Alvedon är given' },
  },
  {
    id: 'registrera-delegering', namn: 'Registrera en delegering', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du arbetar som sjuksköterska på avdelning 72. Undersköterskan Amira Haddads delegering att ge läkemedel går snart ut. Du har följt upp hennes kunskaper och de är aktuella. Se till att hon kan fortsätta ge samma läkemedel det kommande året.',
    kontroll: { notis: 'är registrerad och gäller till och med' },
  },
  {
    id: 'boka-remiss', namn: 'Boka tid för en remiss', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Du är vårdadministratör på kardiologen. Karl-Erik Brandts remiss från Lindesberg är accepterad. Ge honom en tid.',
    kontroll: { notis: 'har fått en tid' },
  },
  {
    id: 'checka-in', namn: 'Checka in en patient', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Ahmed Hassan har just kommit till receptionen för sitt besök i dag. Registrera att han har kommit.',
    kontroll: { notis: 'är incheckad' },
  },
  {
    id: 'gruppkallelse', namn: 'Skicka en gruppkallelse', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Det är bestämt att Hjärtskolan blir av. Se till att alla deltagare får sin kallelse.',
    kontroll: { notis: 'kallelser är skickade' },
  },
  {
    id: 'omboka', namn: 'Boka om en tid', roll: 'adm-kard', start: 'Översikten för en patient med bokad tid',
    text: 'David Nordin ringer och kan inte komma på sin tid i dag. Ge honom en ny tid.',
    kontroll: { notis: 'Tiden är ombokad till' },
  },
  // Runda 5, r1: läkaren sätter upp ett återbesök som systemet föreslår.
  {
    id: 'aterbesok', namn: 'Sätta upp ett återbesök', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson ska komma tillbaka till mottagningen efter vårdtillfället. Se till att han kommer upp på väntelistan för ett återbesök, så att vårdadministratören kan boka tiden.',
    kontroll: { notis: 'Återbesöket står på väntelistan' },
  },
  // Runda 5, r4: systemet bevakar datumet för återinsättning efter ett uppehåll med antikoagulantia.
  {
    id: 'aterinsattning', namn: 'Sätta in Waran igen efter ett uppehåll', roll: 'lak-kard', start: 'Arbetslistan dagen före en återinsättning',
    text: 'Gunnar Åkesson har gjort uppehåll med Waran inför ett ingrepp, och behandlingen ska börja igen i morgon. Se till att han får sitt Waran igen.',
    kontroll: { notis: 'Waran är ordinerat' },
  },
  {
    id: 'avsluta-aterinsattning', namn: 'Avsluta behandlingen efter ett uppehåll', roll: 'lak-kard', start: 'Arbetslistan dagen före en återinsättning',
    text: 'Gunnar Åkesson har gjort uppehåll med Waran inför ett ingrepp. Efter ingreppet har ni bestämt att han inte behöver behandlingen längre. Se till att ingen sätter in den igen.',
    kontroll: { notis: 'är avslutad' },
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
