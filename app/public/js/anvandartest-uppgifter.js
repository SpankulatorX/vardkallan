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
  'Inkommande remisser med en vårdhändelse som väntar': { hash: '#/remisser', klar: 'article.remiss', forbered: 'remiss-vardhandelse' },
  // Runda 6, r3: patient 21 med vårdintyg från akutmottagningen.
  'Översikten för en patient som väntar på beslut om intagning': { hash: '#/patient/p21', klar: '.tidslinje' },
  // Runda 6, r2: demon återställs först, som i test/flodessteg.cjs.
  'Patientens läkemedelsflik': { hash: '#/patient/p01/lakemedel', klar: '.lm-tabell', forbered: 'aterstall' },
  'Läkemedel att ge efter återställning': { hash: '#/administrering', klar: '.adm-patient', forbered: 'aterstall' },
  // Runda 7, r4: systemförvaltarens sidor.
  'Omorganisationen efter återställning': { hash: '#/omorganisation', klar: '.sf-org', forbered: 'aterstall' },
  'Reglerna efter återställning': { hash: '#/regler', klar: '#sf-att-godkanna', forbered: 'aterstall' },
  // Runda 6, r6.
  'Verksamhetschefens startsida': { hash: '#/lakemedelsansvar', klar: '#la-pam', forbered: 'aterstall' },
  'Inkorgen efter återställning': { hash: '#/inkorg', klar: '#ik-mallar', forbered: 'aterstall' },
  // Runda 7, r5: uppföljningsrollens rapportering, efter återställning.
  'Rapporteringssidan efter återställning': { hash: '#/rapportering', klar: '[data-granska="par"]', forbered: 'aterstall' },
  // Runda 7, r7.
  'Kravsidan': { hash: '#/krav', klar: '#sussa-lista details.sussapost' },
  // Runda 9, r1: Birgitta Nyman tar insulin med penna, och demon återställs först.
  'Översikten för en patient med insulin': { hash: '#/patient/p06', klar: '.tidslinje', forbered: 'aterstall' },
  // Runda 7, r3.
  'Ekonomens startsida': { hash: '#/ekonomi', klar: '#ek table' },
  // Runda 7, r6: barnet på Barnavårdscentralen Tybble.
  'Översikten för ett barn på barnavårdscentralen': { hash: '#/patient/p61', klar: '.tidslinje', forbered: 'aterstall' },
  // Runda 7, r2: efter en återställning har ingen stängt nyheterna.
  'Arbetslistan med nyheterna efter en ny version': { hash: '#/arbetslista', klar: '.nyhetsruta', forbered: 'aterstall' },
  'Arbetslistan när inloggningen snart går ut': { hash: '#/arbetslista', klar: '#tidsgrans', forbered: 'inloggning-gar-ut' },
  // Runda 8, r2: de inkommande remisserna och den inskannade pappersremissen efter återställning.
  'Inkommande remisser efter återställning': { hash: '#/remisser', klar: '.r8-skannade [data-skann]', forbered: 'aterstall' },
  // Runda 8, r1: provtagningen för sjuksköterskan, efter återställning.
  'Provtagningen efter återställning': { hash: '#/provtagning', klar: '.pt-patient', forbered: 'aterstall' },
  // Runda 9, r2: fliken Mätvärden efter återställning, och med en kopplad monitor vars värden väntar på godkännande.
  'Patientens mätvärden efter återställning': { hash: '#/patient/p01/matvarden', klar: '#mt-koppla', forbered: 'aterstall' },
  'Mätvärden med värden från en kopplad monitor': { hash: '#/patient/p01/matvarden', klar: '[data-mt-godkann]', forbered: 'koppla-monitor' },
  // Runda 10, r3: systemförvaltarens formulär.
  'Systemförvaltarens formulär': { hash: '#/formular', klar: '#fb-lista [data-nytt]' },
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
  {
    id: 'avvisa-remiss-satt-ut', namn: 'Avvisa en remiss och sätta ut läkemedlet', roll: 'lak-kard', start: 'Inkommande remisser med en vårdhändelse som väntar',
    text: 'Birgitta Nyman är remitterad från vårdcentralen för elkonvertering. Du bedömer att hon ska handläggas i primärvården. Avvisa remissen, och se till att inget läkemedel väntar på ett ingrepp som inte blir av.',
    kontroll: { notis: 'Remissen är avvisad' },
  },
  // Runda 6, r3: standardvårdplan och beslut om intagning enligt LPT.
  {
    id: 'vardplan', namn: 'Sätta upp en standardvårdplan', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson har hjärtsvikt. Se till att han får en vårdplan med mål och åtgärder för hjärtsvikten.',
    kontroll: { notis: 'Vårdplanen Hjärtsvikt är upprättad' },
  },
  {
    id: 'intagningsbeslut', namn: 'Registrera ett intagningsbeslut', roll: 'lak-psyk', start: 'Översikten för en patient som väntar på beslut om intagning',
    text: 'Sofia Hedlund har kommit med vårdintyg från akutmottagningen. Du har undersökt henne och bedömer att hon behöver sluten psykiatrisk tvångsvård. Registrera ditt beslut.',
    kontroll: { notis: 'Beslutet om intagning är registrerat' },
  },
  // Runda 6, r1: sökning i journalen och NEWS2-kontroll.
  {
    id: 'sok-journal', namn: 'Söka i journalen och öppna träffen', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Du vill se hur Gunnar Åkessons blodtryck har utvecklats sedan han lades in. Hitta blodtrycket i hans journal.',
    kontroll: { hash: '^#/patient/p01/\\w+/blodtryck$', sel: '#kurva-blodtryck h4', text: 'Blodtryck' },
  },
  {
    id: 'news2', namn: 'Registrera en NEWS2-kontroll', roll: 'ssk-kard', start: 'Patientens översikt',
    text: 'Du kontrollerar Gunnar på kvällen. Andningsfrekvensen är 22, syremättnaden 95 procent utan syrgas, blodtrycket 118/72, pulsen 112 och temperaturen 38,4. Han är vaken. Dokumentera kontrollen så att det syns vad som ska göras.',
    kontroll: { notis: 'NEWS2-kontrollen är registrerad' },
  },
  // Runda 6, r2: läkemedelsprocessen, del 2.
  {
    id: 'ordinera-mall', namn: 'Ordinera från en mall med flera ordinationer', roll: 'lak-kard', start: 'Patientens läkemedelsflik',
    text: 'Gunnar Åkesson ska elkonverteras. Kliniken har en fastställd mall för läkemedlen inför och efter en elkonvertering. Ordinera läkemedlen ur mallen.',
    kontroll: { notis: 'ur mallen Inför elkonvertering' },
  },
  {
    id: 'dos-efterhand', namn: 'Registrera en dos i efterhand', roll: 'ssk-kard', start: 'Läkemedel att ge efter återställning',
    text: 'Du gav Gunnar Åkesson två tabletter Alvedon för en halvtimme sedan men hann inte registrera det. Registrera dosen nu.',
    kontroll: { notis: 'Alvedon är registrerad som given' },
  },
  // Runda 6, r6: ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar.
  {
    id: 'utse-mal', namn: 'Utse en medicinskt ansvarig läkare', roll: 'vch-kard', start: 'Verksamhetschefens startsida',
    text: 'Du är verksamhetschef på kardiologen. Uppdraget som medicinskt ansvarig läkare har gått ut. Se till att kliniken har en medicinskt ansvarig läkare igen.',
    kontroll: { notis: 'är utsedd till medicinskt ansvarig läkare' },
  },
  {
    id: 'godkanna-mall', namn: 'Godkänna en ändrad läkemedelsmall', roll: 'lak-kard', start: 'Inkorgen efter återställning',
    text: 'Du ansvarar för klinikens läkemedelsmallar. En kollega har ändrat mallen inför elkonvertering. Se vad som har ändrats och godkänn mallen.',
    kontroll: { notis: 'är godkänd' },
  },
  // Runda 6, r5: en extern tillämpning startas från journalen (Sussa 5.1.1.4).
  {
    id: 'extern-tillampning', namn: 'Starta en extern tillämpning från journalen', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Du vill se hur Gunnar Åkessons blodtryck har förändrats i ett diagram. Kliniken använder en tillämpning som heter Blodtryck över tid. Öppna den för Gunnar.',
    kontroll: { sel: '[data-tillampning-status]', text: 'visar' },
  },
  // Runda 6, r4: ingrepp med rum och utrustning, och tider i följd.
  {
    id: 'boka-ingrepp', namn: 'Boka elkonvertering med rum och utrustning', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Mikael Svensson står på väntelistan för elkonvertering. Han behöver sjukresa hem efteråt. Ge honom en tid.',
    kontroll: { notis: 'Mikael Svensson har fått en tid' },
  },
  {
    id: 'boka-kedja', namn: 'Boka provtagning före läkarbesök', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Gunnar Åkesson ska på återbesök efter elkonverteringen och behöver lämna blodprov en stund före besöket. Ge honom tid för båda.',
    kontroll: { notis: 'Gunnar Åkesson har fått en tid' },
  },
  // Runda 7, r5: rapportering till myndigheter och register (Sussa 6.3.2.2).
  {
    id: 'rapport-par', namn: 'Granska och skicka månadens rapport till patientregistret', roll: 'uppf', start: 'Rapporteringssidan efter återställning',
    text: 'Du ansvarar för regionens rapportering till Socialstyrelsen. Se efter att månadens rapport till patientregistret ser rimlig ut och skicka den.',
    kontroll: { notis: 'Rapporten är skickad' },
  },
  // Runda 7, r7: kravsidan (K2).
  {
    id: 'kravviktning', namn: 'Visa de tio högst viktade kriterierna som inte är uppfyllda', roll: 'adm-kard', start: 'Kravsidan',
    text: 'Du följer upp journalsystemet mot regionens kravspecifikation. Ta fram de tio utvärderingskriterier som regionen värderade högst och som ännu inte är uppfyllda.',
    kontroll: { sel: '#sa-vikt', text: 'De 10 högst viktade' },
  },
  // Runda 7, r3.
  {
    id: 'exportera-underlag', namn: 'Exportera faktureringsunderlag för en månad', roll: 'eko', start: 'Ekonomens startsida',
    text: 'Du är ekonom på regionkansliet. Ekonomisystemet behöver förra månadens faktureringsunderlag för en vårdenhet. Hämta underlaget som en fil.',
    kontroll: { notis: 'är exporterat' },
  },
  {
    id: 'lamna-ut-hjalpmedel', namn: 'Lämna ut ett hjälpmedel', roll: 'ssk-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson ska få en rollator med sig hem. Registrera att han har fått den.',
    kontroll: { notis: 'är registrerat som utlämnat' },
  },
  // Runda 7, r4: systemförvaltningen.
  {
    id: 'forbered-namnbyte', namn: 'Förbereda ett namnbyte för en enhet', roll: 'sysf', start: 'Omorganisationen efter återställning',
    text: 'Kardiologiska mottagningen ska heta Hjärtmottagningen USÖ från nästa månad. Förbered namnbytet.',
    kontroll: { notis: 'Förändringen är förberedd till' },
  },
  {
    id: 'andra-demoregel', namn: 'Ändra en demoregel', roll: 'sysf', start: 'Reglerna efter återställning',
    text: 'Patienterna vill få påminnelsen om sin bokade tid tre dygn i förväg i stället för två. Ändra regeln.',
    kontroll: { notis: 'väntar på att en annan systemförvaltare godkänner den' },
  },
  // Runda 7, r6: tillväxt i barnhälsovården (Sussa 4.1).
  {
    id: 'tillvaxt-bhv', namn: 'Registrera längd och vikt vid ett BHV-besök och se kurvan', roll: 'ssk-vc', start: 'Översikten för ett barn på barnavårdscentralen',
    text: 'Ida Holmqvist är på besök hos barnavårdscentralen. Hon väger 9,6 kg och är 82 cm lång. Registrera måtten och se hur hon följer sin kurva.',
    kontroll: { notis: 'är registrerat' },
  },
  // Runda 8, r4: dosändring i en pågående ordination (Sussa 3.5.2.12).
  {
    id: 'andra-dos', namn: 'Ändra dosen i en pågående ordination', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar behöver en högre dos Metoprolol, 100 mg på morgonen från i dag. Ändra dosen utan att sätta ut läkemedlet.',
    kontroll: { notis: 'dosen är ändrad' },
  },
  // Runda 7, r2: nyhetsrutan efter en ny version (Sussa 10.1.1.4).
  {
    id: 'nyheter', namn: 'Läsa nyheterna och stänga dem', roll: 'lak-kard', start: 'Arbetslistan med nyheterna efter en ny version',
    text: 'Vårdkällan har fått en ny version. Läs vad som är nytt för dig som läkare, och se sedan till att nyheterna inte står kvar.',
    kontroll: { notis: 'Nyheterna är stängda' },
  },
  // Runda 8, r3: fri bokning, teambesök, gruppträff och avdelningens planering (Sussa 3.4.1, 3.4.2, testfall 5.1 till 5.3 och 7.1).
  {
    id: 'boka-fri', namn: 'Boka en patient fritt', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Anna Viklund ringer och vill komma på ett besök. Hon står inte på väntelistan. Ge henne en tid.',
    kontroll: { notis: 'Anna Viklund har fått en tid' },
  },
  {
    id: 'boka-team', namn: 'Boka ett teambesök', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Anna Viklund ska träffa både läkaren och sjuksköterskan vid samma besök. Boka ett besök med båda.',
    kontroll: { notis: 'Anna Viklund har fått ett teambesök' },
  },
  {
    id: 'grupp-lagg-till', namn: 'Lägga till en patient i en gruppträff', roll: 'adm-kard', start: 'Vårdadministratörens startsida',
    text: 'Mikael Svensson ska gå i Hjärtskolan. Ge honom en plats på nästa träff.',
    kontroll: { notis: 'Mikael Svensson har fått en plats' },
  },
  {
    id: 'avdelningens-handelser', namn: 'Överblicka dagens händelser på avdelningen', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du börjar ditt pass på avdelningen. Ta reda på vad som är planerat för patienterna klockan 11 i dag.',
    kontroll: { sel: '#av .av-tabell', text: 'Provtagning, blodprover' },
  },
  // Runda 7, r2: varningen före utloggningen (K2 1.6.1).
  {
    id: 'forlang-inloggning', namn: 'Fortsätta arbeta när inloggningen snart går ut', roll: 'lak-kard', start: 'Arbetslistan när inloggningen snart går ut',
    text: 'Du har varit borta från datorn en stund, och Vårdkällan varnar för att du snart loggas ut. Du vill fortsätta arbeta.',
    kontroll: { notis: 'Du är inloggad' },
  },
  // Runda 8, r5: tobaksvanorna, epikrisen och flera mätvärden på en gång (Sussas tema 4).
  {
    id: 'tobaksvanor', namn: 'Fylla i tobaksmallen i en anteckning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson berättar att han röker 20 cigaretter om dagen. Du erbjuder stöd för att sluta, och han tackar ja. Dokumentera hans tobaksvanor och signera.',
    kontroll: { sel: '.anteckning', text: 'Cigaretter dagligen' },
  },
  {
    id: 'epikris', namn: 'Skriva och signera en epikris', roll: 'lak-kard', start: 'Översikten för en inlagd patient',
    text: 'Elin Sandberg ska skrivas ut. Skriv epikrisen: hon är stabil under vårdtiden och ska på återbesök på mottagningen om sex veckor. Signera den.',
    kontroll: { sel: '.anteckning .ant-fakta', text: 'Signerad' },
  },
  {
    id: 'grundmatningar', namn: 'Registrera längd, vikt, blodtryck och puls', roll: 'ssk-kard', start: 'Patientens översikt',
    text: 'Du har mätt Gunnar Åkesson: längd 178 cm, vikt 82 kg, blodtryck 132/84 och puls 68. Dokumentera värdena.',
    kontroll: { notis: 'BMI' },
  },
  // Runda 8, r2: remiss på uppdrag, fördelning och pappersremiss (Sussas testfall 2.2 till 2.5).
  {
    id: 'remiss-pa-uppdrag', namn: 'Skriva en remiss på uppdrag av en läkare', roll: 'adm-kard', start: 'Patientens översikt',
    text: 'Läkaren som Gunnar Åkesson har en tid hos ber dig skriva en remiss till ortopeden om knäsmärta sedan tre månader. Skriv remissen åt läkaren, så att läkaren bara behöver signera den.',
    kontroll: { notis: 'väntar på signering av' },
  },
  {
    id: 'fordela-remiss', namn: 'Fördela en remiss till en läkare', roll: 'adm-kard', start: 'Inkommande remisser efter återställning',
    text: 'Bakjouren ska bedöma de inkommande remisserna i dag. Se till att bakjouren får en av remisserna som inte är bedömda.',
    kontroll: { notis: 'Remissen är fördelad till' },
  },
  {
    id: 'registrera-pappersremiss', namn: 'Registrera en pappersremiss', roll: 'adm-kard', start: 'Inkommande remisser efter återställning',
    text: 'En remiss om Gunnar Åkesson har kommit på papper från Läkarhuset Ekbacken och är redan inskannad. Frågan gäller bröstsmärtor. Registrera remissen så att den kan handläggas.',
    kontroll: { notis: 'är registrerad och står bland de inkommande remisserna' },
  },
  // Runda 8, r1: beställning och svar (Sussa 4.4.2.6 och testfall 3.1 och 3.3).
  {
    id: 'bestall-paket', namn: 'Beställa ett standardpaket med prover', roll: 'lak-kard', start: 'Arbetslistan efter inloggning',
    text: 'Gunnar Åkesson ligger inne med hjärtsvikt. Beställ de prover som behövs för att följa upp hjärtsvikten.',
    kontroll: { notis: 'är beställt' },
  },
  {
    id: 'registrera-provtagning', namn: 'Registrera provtagning', roll: 'ssk-kard', start: 'Provtagningen efter återställning',
    text: 'Du har tagit blodproverna på Elin Sandberg, blodstatus och CRP. Registrera att proverna är tagna och skicka dem till laboratoriet.',
    kontroll: { notis: 'proverna är skickade' },
  },
  // Runda 9, r2: medicinteknisk utrustning och intensivvården (Sussa 3.6.1 och 4.6).
  {
    id: 'koppla-monitor', namn: 'Koppla en patientmonitor till patienten', roll: 'ssk-kard', start: 'Patientens mätvärden efter återställning',
    text: 'Gunnar Åkesson ska övervakas med patientmonitorn DEMO-MON-0001 i stället för med manuella kontroller. Se till att monitorns värden kommer till hans journal.',
    kontroll: { notis: 'är kopplad till patienten' },
  },
  {
    id: 'godkanna-mt', namn: 'Godkänna värden från monitorn', roll: 'ssk-kard', start: 'Mätvärden med värden från en kopplad monitor',
    text: 'Du har kontrollerat Gunnar Åkesson och ser att monitorns värden stämmer. Se till att värdena räknas när NEWS2 och larmen räknas fram.',
    kontroll: { notis: 'för diagnostiskt bruk' },
  },
  {
    id: 'iva-oversikt', namn: 'Öppna intensivvårdens översikt och övervakningen av en patient', roll: 'lak-kard', start: 'Arbetslistan efter inloggning',
    text: 'Du ska gå rond på Hjärtintensiven. Skaffa dig en bild av hur patienterna där mår, och titta närmare på den första patienten.',
    kontroll: { sel: '#iva-analys' },
  },
  // Runda 9, r1: förbrukningsartiklar ur en mall.
  {
    id: 'forbrukning-mall', namn: 'Förskriva förbrukningsartiklar ur en mall', roll: 'lak-vc', start: 'Översikten för en patient med insulin',
    text: 'Birgitta Nyman tar insulin med penna och behöver pennkanyler och lansetter. Förskriv förbrukningsartiklarna som hon behöver.',
    kontroll: { notis: 'Insulin med penna är förskriven' },
  },
  // Runda 9, r7: streckkodsläsaren och de färdiga patientgrupperna.
  {
    id: 'skanna-armband', namn: 'Öppna patienten genom att skanna armbandet', roll: 'ssk-kard', start: 'Arbetslistan efter inloggning',
    text: 'Gunnar Åkesson har ett armband med streckkod. Skanna armbandet så att hans journal öppnas. Utan läsare skriver du koden från armbandet i fältet Skanna.',
    kontroll: { sel: '.patientband h1', text: 'Gunnar Åkesson' },
  },
  {
    id: 'patientgrupp', namn: 'Visa en färdig patientgrupp', roll: 'lak-vc', start: 'Arbetslistan efter inloggning',
    text: 'Vårdcentralen vill veta vilka patienter med diabetes som har ett HbA1c över målnivån. Visa gruppen.',
    kontroll: { sel: '[data-grupp-ut]', text: 'Birgitta' },
  },
  // Runda 10, r3: röstinmatning, rättstavning, sårdokumentation med kroppsbilden och formulärbyggaren.
  {
    id: 'diktera', namn: 'Diktera och signera en daganteckning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson är pigg och äter bra och har inga bröstsmärtor. Du bedömer honom som stabil. Diktera en daganteckning och signera den. Utan mikrofon skriver du texten.',
    kontroll: { sel: '.anteckning .ant-fakta', text: 'Signerad' },
  },
  {
    id: 'stavning', namn: 'Rätta en felstavad medicinsk term i en anteckning', roll: 'lak-kard', start: 'Patientens översikt',
    text: 'Skriv en daganteckning om att Gunnar Åkesson har hosta och feber och att du misstänker pnemoni. Rätta stavningen med systemets förslag och signera.',
    kontroll: { sel: '.anteckning', text: 'pneumoni' },
  },
  {
    id: 'formular-sar', namn: 'Dokumentera ett sår med kroppsbilden', roll: 'ssk-kard', start: 'Patientens översikt',
    text: 'Gunnar Åkesson har ett trycksår på höger häl, 2 gånger 1,5 cm, med en rodnad som inte bleknar. Dokumentera såret i formuläret Sårdokumentation och signera.',
    kontroll: { sel: '.anteckning', text: 'höger häl' },
  },
  {
    id: 'bygga-formular', namn: 'Bygga ett formulär och föreslå det', roll: 'sysf', start: 'Systemförvaltarens formulär',
    text: 'Avdelningarna vill dokumentera munhälsa. Bygg ett formulär som heter Munhälsa med två frågor: om patienten har ont i munnen och om patienten behöver hjälp med munvården. Föreslå det för godkännande.',
    kontroll: { notis: 'Formuläret är föreslaget' },
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
