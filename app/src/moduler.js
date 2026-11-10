// Modulregistret (runda 11, r8): varje modul i Vårdkällan med namn, beskrivning, Sussa-avsnitt, var den nås i
// gränssnittet och vad som är simulerat. Sidan Moduler (GET /api/moduler) läser registret.
//
// Statusen skrivs aldrig in, den räknas varje gång ur det som finns:
//   demo       modulen har en rutt i gränssnittet (en rutt i app.js, en flik i journalen eller en flik i Min journal)
//              som verkligen finns i koden.
//   api        modulen har ingen rutt i gränssnittet men har rutter i API:t eller kod som finns.
//   planerat   ingen rutt, inga rutter i API:t och ingen kod. Testet stoppar bygget om en planerad modul har poster
//              som är uppfyllda eller delvis uppfyllda.
// Antalet uppfyllda, delvis uppfyllda och planerade poster räknas ur Sussa-registret med samma testresultat som
// kravsidan, så modulsidan och kravsidan kan aldrig säga olika saker.
//
// Testet i app/test/moduler.test.js stoppar bygget om en rutt i app.js, en flik i journalen eller i Min journal eller
// en vy i public/js/vyer saknas i registret, om registret pekar på något som inte finns, om en post i kategorin system
// inte hör till någon modul, eller om en text om en modul som finns säger att den inte är byggd.
//
// Fälten för en modul:
//   id, namn, omrade   omrade grupperar modulerna på sidan.
//   beskrivning        vad som finns, på vanlig svenska.
//   simulerat          vad som är simulerat eller en demoregel, eller null.
//   avsnitt            Sussa-id som prefix: ett avsnitt (4.6) ger alla poster i avsnittet, ett post-id bara posten.
//   rutter             rutter i app.js, med :id för en del som varierar.
//   journal            flikar i patientens journal (patient.js), till exempel tvangsvard.
//   min                flikar i Min journal (min.js).
//   vyer               filer i public/js/vyer.
//   kod                filer i app/ som modulen bygger på.
//   api                rutter i API:t, som 'GET /api/iva'.
//   nas                hur modulen nås när det inte syns av rutterna, eller null.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(import.meta.dir, '..');

export const OMRADEN = [
  ['journal', 'Journalen'],
  ['lakemedel', 'Läkemedel'],
  ['planering', 'Planering och administration'],
  ['specialist', 'Specialistområden'],
  ['invanare', 'Invånaren'],
  ['uppfoljning', 'Uppföljning och ekonomi'],
  ['forvaltning', 'Behörighet, förvaltning och teknik'],
];

export const STATUSAR = {
  demo: { rubrik: 'Finns i demon', text: 'Modulen har en egen plats i gränssnittet. Logga in med en roll som arbetar med den och öppna den i menyn eller i journalen.' },
  api: { rubrik: 'Finns i API:t', text: 'Funktionen finns i servern och nås genom API:t, utan egen vy i gränssnittet.' },
  planerat: { rubrik: 'Planerat', text: 'Ingen kod finns för modulen än. Ordningen säger inget om när den byggs.' },
};

const m = (id, omrade, namn, beskrivning, d = {}) => ({
  id, omrade, namn, beskrivning, simulerat: d.simulerat ?? null, avsnitt: d.avsnitt ?? [], rutter: d.rutter ?? [],
  journal: d.journal ?? [], min: d.min ?? [], vyer: d.vyer ?? [], kod: d.kod ?? [], api: d.api ?? [], nas: d.nas ?? null,
});

export const MODULER = [
  // Journalen.
  m('arbetslista', 'journal', 'Arbetslista och inkorg',
    'Arbetslistan med vårdenhetens patienter och inkorgen med det som väntar på den inloggade: osignerade anteckningar, svar att vidimera, larm, remisser att bedöma, kontroller och kvittenser. Systemet sorterar så att det brådskande står först.',
    { avsnitt: ['3.4.1.8'], rutter: ['#/arbetslista', '#/inkorg'], vyer: ['arbetslista.js', 'inkorg.js'], api: ['GET /api/arbetslista', 'GET /api/inkorg'] }),
  m('oversikt', 'journal', 'Patientöversikt och presentationsvyer',
    'Patienthuvudet med basfakta och behörighetens grund, översikten med tidslinjen där migrerad historik ligger i samma kronologi, och vyer som systemet väljer efter situationen: mottagningsbesök, akut eller rond. Fliken Uppföljning samlar mål, avvikelser och det som ska följas upp, och utbildningsläget visar journalen utan personuppgifter.',
    { avsnitt: ['3.1.2', '3.1.6'], rutter: ['#/patient/:id'], journal: ['oversikt', 'uppfoljning', 'utbildningslage'], vyer: ['patient.js', 'patient-oversikt.js', 'patient-uppfoljning.js', 'patient-utbildningslage.js'], kod: ['src/presentationsvyer.js'], api: ['GET /api/patient/:id/oversikt', 'GET /api/patient/:id/basfakta'] }),
  m('anteckningar', 'journal', 'Journalanteckningar och signering',
    'Anteckningar från mallar med sökord, utkast, signering med kontrollsumma och rättelse. En signerad anteckning ändras aldrig: rättelsen blir en ny version och den gamla står kvar överstruken. Kontrasignering där systemet föreslår vem, och vårdenhetens signeringslista.',
    { avsnitt: ['3.1.3.1', '3.1.3.5', '3.1.7', '3.1.11', '5.3.1.6'], rutter: ['#/signeringslista'], journal: ['journal'], vyer: ['patient-journal.js', 'signeringslista.js'], kod: ['src/journal.js', 'src/anteckningssignatur.js', 'src/kontrasignering.js', 'src/strukturerad.js'], api: ['GET /api/patient/:id/anteckningar', 'POST /api/anteckning/:id/signera', 'GET /api/signeringslista'],
      simulerat: 'SITHS-kortet som signaturen görs med är simulerat.' }),
  m('vardkontakt', 'journal', 'Vårdkontakter, vårdtillfällen och hälsoärenden',
    'Allt som dokumenteras hör till en vårdkontakt, och systemet väljer kontakten ur sammanhanget. Vårdtillfällen med inskrivning, flytt, permission och utskrivning, hälsoärenden som håller ihop kontakter över tid, och spårbarhet mot kringsystem och delprocesser.',
    { avsnitt: ['6.1.1', '3.4.4.1', '3.4.4.3'], journal: ['journal', 'oversikt'], vyer: ['patient-vardkontakt.js'], kod: ['src/vardkontakt.js', 'src/halsoarende.js', 'src/sparbarhet.js', 'src/vardformer.js'], api: ['POST /api/patient/:id/vardkontakter', 'POST /api/patient/:id/halsoarenden'] }),
  m('matvarden', 'journal', 'Mätvärden, skalor och NEWS2',
    'Vitalparametrar och labbvärden med kurva och referensintervall, NEWS2 som systemet räknar ur vitalparametrarna med nästa kontroll och larm, Glasgow Coma Scale och smärta med NRS. Varje värde visar om det är inmatat för hand, från utrustning eller av patienten.',
    { avsnitt: ['3.1.3.4', '3.1.3.9'], journal: ['matvarden'], vyer: ['patient-matvarden.js'], kod: ['src/vitalparametrar.js', 'src/skalor.js', 'src/matvarde-inmatning.js', 'src/syremattnad-skala.js'], api: ['GET /api/patient/:id/matvarden', 'POST /api/patient/:id/news2'],
      simulerat: 'Referensintervallen och larmgränserna är demoregler.' }),
  m('infarter', 'journal', 'In- och utfarter',
    'Katetrar, sonder och dränage från insättning till avveckling. Den som registrerar väljer typ och placering, och systemet sätter storlek, tid och KVÅ-kod, räknar nästa skötsel och lägger den i avdelningens planering.',
    { avsnitt: ['3.1.3.3', '3.1.3.8'], journal: ['infarter'], vyer: ['patient-infarter.js'], kod: ['src/infarter.js'], api: ['GET /api/patient/:id/infarter'] }),
  m('formular', 'journal', 'Formulär och kroppsbild',
    'Formulär som verksamheten bygger utan kod: frågor med fasta svar, poäng, skalor, regler, koder ur kodverken, förifyllnad ur journalen och en kroppsbild för markeringar. En ny version gäller först när en annan systemförvaltare har godkänt den, och den som fyller i ser bara de frågor som gäller.',
    { avsnitt: ['3.1.3.1', '3.1.7.1', '5.1.1.3'], rutter: ['#/formular'], journal: ['journal'], vyer: ['formularbyggare.js', 'patient-formular.js'], kod: ['src/formularmotor.js', 'public/js/formularmotor-regler.js'], api: ['GET /api/formular', 'GET /api/patient/:id/formular/:kod/forifyllnad'] }),
  m('rost', 'journal', 'Röstinmatning och rättstavning',
    'Diktering i anteckningens sökord med röstkommandon för skiljetecken, ny rad och byte av sökord. Dikteringen hör till den öppna patienten och kan aldrig signera. Rättstavning av medicinska termer och grammatik medan man skriver, med en egen ordlista per person.',
    { avsnitt: ['3.1.3.2', '3.1.3.7', '3.1.3.10'], journal: ['journal'], kod: ['src/rostinmatning.js', 'src/stavning.js', 'public/js/rostinmatning.js', 'public/js/stavning-ui.js'], api: ['POST /api/stavning', 'GET /api/rost/val'],
      simulerat: 'Taligenkänningen är webbläsarens egen och används bara när användaren har valt det.' }),
  m('levnadsvanor', 'journal', 'Levnadsvanor och folkhälsa',
    'Tobak, alkohol, fysisk aktivitet och matvanor med de nationella frågorna, där systemet räknar risken och föreslår stöd med KVÅ-kod, och folkhälsoinsatser som startar med en riskgrupp och följer hur många som har fått stöd.',
    { avsnitt: ['6.2.2'], rutter: ['#/analys'], journal: ['journal'], vyer: ['patient-levnadsvanor.js', 'patient-tobak.js'], kod: ['src/levnadsvanor.js', 'src/tobak.js', 'src/folkhalsa.js'], api: ['GET /api/folkhalsa'] }),
  m('uppmarksamhet', 'journal', 'Uppmärksamhetsinformation och överkänslighet',
    'Uppmärksamhetsinformation efter Socialstyrelsens huvudgrupper, med en symbol i patienthuvudet, arbetslistan och väntrummet. Systemet föreslår själv uppgifterna ur läkemedelslistan, diagnoserna och överkänsligheterna, och ny överkänslighet registreras i ett eget flöde med ATC-kod som systemet slår upp.',
    { avsnitt: ['3.1.5', '3.1.6.2'], journal: ['oversikt'], kod: ['src/uppmarksamhet.js', 'src/overkanslighet.js', 'src/umi-kodverk.js', 'public/js/uppmarksamhet.js'], api: ['POST /api/patient/:id/uppmarksamhet', 'GET /api/patient/:id/overkanslighet'], nas: 'Från uppmärksamhetsraden i patienthuvudet.' }),
  m('identitet', 'journal', 'Identitet och sammanslagning',
    'Personnummer, samordningsnummer, reservnummer och annan identitet med OID. Systemet tolkar numret i valfritt format, skapar reservnummer, hittar troliga dubbletter och för samman journalerna när personnumret blir känt.',
    { avsnitt: ['3.1.1'], journal: ['identitet'], vyer: ['patient-identitet.js'], kod: ['src/identitet.js'], api: ['GET /api/patient/:id/identiteter', 'GET /api/identitet/tolka'],
      simulerat: 'Reservnumren har ett påhittat format i demon.' }),
  m('sok', 'journal', 'Sökning',
    'Sökning efter patient och sökning i journalen. Systemet tolkar vanliga ord, ICD-10-koder, läkemedelsnamn och läkemedelsgrupper, söker bara i det användaren får läsa och markerar träffen i tidsordning.',
    { avsnitt: ['3.1.8'], rutter: ['#/sok'], journal: ['sok'], vyer: ['sok.js', 'patient-sok.js'], kod: ['src/journalsok.js'], api: ['GET /api/sok', 'GET /api/patient/:id/sok'] }),
  m('utskrift', 'journal', 'Utskrifter och utlämnanden',
    'Utskrift av hela eller delar av journalen med utskrifts-id på varje sida, där systemet föreslår syftet och säger själv vad som inte kommer med. Utlämnande och återlämnande av journalhandlingar och menprövning registreras.',
    { avsnitt: ['3.1.9'], journal: ['utlamnat'], vyer: ['patient-utlamnat.js'], kod: ['src/utskrift.js', 'public/js/utskrift.js'], api: ['POST /api/patient/:id/utskrift', 'POST /api/patient/:id/utlamnanden'] }),
  m('restjournaler', 'journal', 'Skannade restjournaler',
    'Pappersjournaler som skannas in och visas i samma kronologi som den övriga journalen. Systemet läser texten i PDF:en, föreslår dokumenttyp och period, kontrollerar personnumret och gör texten sökbar.',
    { avsnitt: ['3.1.10'], journal: ['restjournaler'], vyer: ['patient-restjournaler.js'], kod: ['src/restjournal.js'], api: ['GET /api/patient/:id/restjournaler'] }),
  m('donation', 'journal', 'Donation och transplantation',
    'Ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen, checklistan bockas av där systemet kan och donationsanteckningen skrivs av systemet. Transplantationer registreras, och en avliden patient märks i hela journalen.',
    { avsnitt: ['3.1.12'], journal: ['donation'], vyer: ['patient-donation.js'], kod: ['src/donation.js', 'src/avliden.js'], api: ['GET /api/patient/:id/donation'],
      simulerat: 'Donationsregistret och kvalitetsregistret är simulerade.' }),
  m('vardplaner', 'journal', 'Vårdplaner, vårdförlopp och kunskapsstöd',
    'Vårdplaner där systemet föreslår en standardplan ur diagnosen, med vårdförlopp, riktlinjens text och nästa steg, och bevakar uppföljningen. Kunskapsstöd i sammanhanget, vårdenhetens egna utfall och sammanhållen journalföring med en annan vårdgivare.',
    { avsnitt: ['3.2.1', '3.2.2'], journal: ['planer', 'oversikt'], vyer: ['r3.js'], kod: ['src/vardplan.js', 'src/kunskapsstod.js', 'src/utfallsstod.js', 'src/sammanhallen.js', 'public/js/kunskapsstod-ui.js'], api: ['GET /api/patient/:id/vardplaner', 'GET /api/patient/:id/sammanhallen'],
      simulerat: 'Kunskapsstödet och vårdförloppen är demoregler. Den andra vårdgivaren i sammanhållen journalföring är simulerad.' }),
  m('tvangsvard', 'journal', 'Psykiatrisk tvångsvård',
    'Tvångsvård enligt LPT och LRV, där systemet räknar alla frister med paragraf och föreslår nästa steg. Bevakningen på den psykiatriska vårdenheten visar alla pågående perioder med nästa frist, och uppföljningen samlar tvångsvård och samordning.',
    { avsnitt: ['3.2.3.1', '3.2.3.2', '3.2.3.3', '3.2.3.4'], rutter: ['#/tvangsvard', '#/planuppfoljning'], journal: ['tvangsvard'], vyer: ['r3.js'], kod: ['src/tvangsvard.js', 'src/tvangsvard-regler.js'], api: ['GET /api/patient/:id/tvangsvard', 'GET /api/tvangsvard/bevakning'] }),
  m('akut', 'journal', 'Akutmottagningen och väntrummet',
    'Akutmottagningens flödestavla: ankomst med ett klick, triage där systemet räknar prioriteten ur vitalparametrarna och kontaktorsaken, bedömning, beslut och ledtider. Uppropning med könummer i väntrummet, där namnet på en skyddad patient aldrig lämnar servern.',
    { avsnitt: ['3.2.3.5'], rutter: ['#/vantrum'], vyer: ['vantrum.js'], kod: ['src/akutflode.js'], api: ['GET /api/akut', 'GET /api/vantrum'],
      simulerat: 'Ambulansens förvarning är simulerad.' }),
  m('tillampningar', 'journal', 'Externa tillämpningar med SMART on FHIR',
    'Tillämpningar som startas från journalen med SMART on FHIR och aldrig ser mer än den inloggade, till exempel demotillämpningen Blodtryck över tid. Åtkomsten går ut efter 30 minuter och återkallas vid utloggning.',
    { avsnitt: ['5.1.1.4'], journal: ['tillampningar'], vyer: ['patient-tillampningar.js'], kod: ['src/smart.js'], api: ['GET /api/patient/:id/tillampningar'] }),

  // Läkemedel.
  m('lakemedel', 'lakemedel', 'Läkemedel och ordination',
    'Läkemedelslistan med ordination ur mallar, obligatorisk ordinationsorsak och uppföljningsdatum, varningar som förklarar varför, dosändring från ett datum, upp- och nedtrappning, muntlig ordination, vidimering, läkemedelsgenomgång och läkemedelsberättelse som systemet skriver. Varje överföring till Nationella läkemedelslistan kvitteras.',
    { avsnitt: ['3.5.1', '3.5.2'], journal: ['lakemedel'], vyer: ['patient-lakemedel.js'], kod: ['src/lakemedel.js', 'src/lakemedelsregler.js', 'src/dosandring.js', 'src/ordinationsmallar.js', 'src/ordinationsvagar.js', 'src/lakemedelsoverforing.js', 'src/hogriskkontroll.js'], api: ['GET /api/patient/:id/lakemedel', 'POST /api/ordination/:id/dosandring'],
      simulerat: 'Nationella läkemedelslistan är simulerad, och varningarna är demoregler, inte kliniskt beslutsstöd.' }),
  m('administrering', 'lakemedel', 'Läkemedel att ge, beredning och vätskebalans',
    'Systemet räknar fram dagens doser per avdelning och patient, och sjuksköterskan ger, iordningställer eller lämnar över med ett klick, också i efterhand och under permission. Beredning med kontroll av en kollega och etikett, patientnära skanning av armband och förpackning, egenadministrering och vätskebalans per dygn och framåt.',
    { avsnitt: ['3.5.2.2', '3.5.2.3', '3.5.2.5', '3.5.2.17', '3.5.2.18', '3.5.2.21', '3.5.3'], rutter: ['#/administrering'], vyer: ['administrering.js'], kod: ['src/administrering.js', 'src/beredning.js', 'src/egenadministrering.js', 'src/lakemedelsvyer.js'], api: ['GET /api/administreringar', 'GET /api/patient/:id/vatskebalans'] }),
  m('delegering', 'lakemedel', 'Delegering av läkemedelshantering',
    'Sjuksköterskan och läkaren registrerar delegeringar att iordningställa, administrera och lämna över läkemedel, med period och omfattning. Undersköterskan ser sina egna, och systemet påminner innan en delegering går ut.',
    { avsnitt: ['3.5.2.18'], rutter: ['#/delegeringar'], vyer: ['delegeringar.js'], kod: ['src/delegering.js'], api: ['GET /api/delegeringar'] }),
  m('direktiv', 'lakemedel', 'Generella direktiv och läkemedelsuppföljning',
    'Generella direktiv som läkaren fastställer för vårdenheten eller vårdgivaren, och ordination enligt direktiv för sjuksköterskan. Uppföljningen av läkemedelsbehandlingen per vårdenhet och vårdgivare.',
    { avsnitt: ['3.5.2.15', '3.5.2.20'], rutter: ['#/lakemedelsstod'], vyer: ['lakemedelsstod.js'], kod: ['src/lakemedelsstod.js', 'src/direktiv-vardgivare.js', 'src/lakemedelsuppfoljning.js', 'src/lakemedelsstatistik.js'], api: ['GET /api/direktiv', 'GET /api/lakemedel/uppfoljning'] }),
  m('lakemedelsansvar', 'lakemedel', 'Läkemedelsansvar på vårdenheten',
    'Verksamhetschefen utser medicinskt ansvarig läkare, läkare ansvarig för läkemedelsmallar, läkemedelsansvarig sjuksköterska och kontrollanter av narkotikaförbrukningen, med systemets förslag. Läkemedelsmallarna godkänns av den mallansvariga läkaren.',
    { avsnitt: ['3.5.1.3'], rutter: ['#/lakemedelsansvar'], vyer: ['lakemedelsansvar.js'], kod: ['src/lakemedelsansvar.js', 'src/mallgodkannande.js'], api: ['GET /api/lakemedelsansvar', 'GET /api/lakemedelsmallar'] }),
  m('forbrukning', 'lakemedel', 'Förbrukningsartiklar, beställningar och klinisk prövning',
    'Förskrivning, förnyelse, ändring och utsättning av förbrukningsartiklar, beställning av extempore- och licensläkemedel, och kliniska läkemedelsprövningar med studiedeltagande, i läkemedelsfliken.',
    { avsnitt: ['3.5.4', '3.5.5', '3.5.2.4'], journal: ['lakemedel'], vyer: ['forbrukning.js'], kod: ['src/forbrukning.js', 'src/lakemedelsbestallning.js', 'src/kliniskprovning.js'], api: ['GET /api/patient/:id/forbrukning', 'GET /api/provningar'],
      simulerat: 'Apoteket som tar emot beställningarna är simulerat.' }),
  m('vaccinationer', 'lakemedel', 'Vaccinationer',
    'De nationella vaccinationsprogrammen för barn efter fem år och för riskgrupper. Systemet föreslår nästa dos i programmet och rapporterar den givna vaccinationen.',
    { avsnitt: ['3.5.1.7'], journal: ['vaccinationer'], vyer: ['patient-vaccinationer.js'], kod: ['src/vaccinationsprogram.js', 'src/vaccinationsregister.js'], api: ['GET /api/patient/:id/vaccinationsprogram'],
      simulerat: 'Vaccinationsregistret är simulerat.' }),
  m('medicinteknik', 'lakemedel', 'Medicinteknisk utrustning',
    'Patientmonitorer och infusionspumpar skickar värden och doser i FHIR R4 eller HL7 v2 med en egen nyckel per utrustning. Utrustningen kopplas till patienten genom att dess streckkod skannas, och värdena klassas och godkänns innan de används för beslut.',
    { avsnitt: ['3.6.1', '3.5.2.19'], rutter: ['#/administrering', '#/iva'], journal: ['matvarden'], kod: ['src/medicinteknik.js', 'src/mt-klass.js', 'public/js/mt-ui.js'], api: ['GET /api/mt/utrustning', 'GET /api/patient/:id/mt'],
      simulerat: 'Utrustningen är simulerad.' }),

  // Planering och administration.
  m('tidbok', 'planering', 'Tidbok, väntelista och kallelser',
    'Vårdadministratörens dagliga arbete i ordning, tidbok per mottagning och vårdgivare med lokaler och utrustning som resurser, väntelista med gräns mot vårdgarantin, förslag på tider så att bokning är ett klick, teambesök och gruppträffar, kallelser och påminnelser som systemet skriver och skickar, och incheckning i Min journal och på en skärm i väntrummet.',
    { avsnitt: ['3.4.1', '3.4.2', '3.4.3', '3.4.4'], rutter: ['#/idag', '#/tidbok', '#/vantelista', '#/incheckning'], vyer: ['idag.js', 'tidbok.js', 'vantelista.js', 'incheckning.js', 'patient-tider.js'], kod: ['src/tidbok.js', 'src/planering.js', 'src/planering-bas.js', 'src/bokning-r8.js', 'src/vardhandelse.js', 'src/aterbesok.js'], api: ['GET /api/tidbok', 'GET /api/vantelista'],
      simulerat: 'Sms och brev är simulerade, och vårdgarantins gränser är demoregler.' }),
  m('avdelning', 'planering', 'Avdelningens planering och beläggning',
    'Allt som ska göras för avdelningens patienter i dag: uppgifter som provtagning och omläggning, läkemedel att ge och bokade tider, per tid, patient eller resurs. Beläggningen per avdelning visas utan personuppgifter.',
    { avsnitt: ['3.4.1.6', '3.1.2.4'], rutter: ['#/avdelning', '#/avdelning/patient/:id', '#/avdelning/resurs/:id'], vyer: ['avdelning.js'], kod: ['src/avdelningsplan.js'], api: ['GET /api/avdelning/planering', 'GET /api/belaggning'], nas: 'Från arbetslistan.' }),
  m('kassa', 'planering', 'Kassa och patientavgifter',
    'Avgifter för besök, hjälpmedel, receptförnyelse och intyg som systemet räknar, betalning, återbetalning med kvitto, kassaredovisning per kassör och betalsätt och dagsavslut som inte kan ändras.',
    { avsnitt: ['3.4.4.4'], rutter: ['#/kassa'], vyer: ['r10r7.js'], kod: ['src/kassa.js'], api: ['GET /api/kassa'],
      simulerat: 'Betalterminalen är simulerad, och avgifterna är demoregler.' }),
  m('kapacitet', 'planering', 'Kapacitet och prognos',
    'Lediga tider mot väntelistan och de inkomna remisserna tolv veckor framåt, när kön är borta, vilka som riskerar att passera sin gräns och förslag på fler tider.',
    { avsnitt: ['3.4.1.5'], rutter: ['#/kapacitet'], vyer: ['r10r7.js'], kod: ['src/kapacitetsprognos.js'], api: ['GET /api/kapacitet'],
      simulerat: 'Prognosen är en demoregel.' }),
  m('kontorsstod', 'planering', 'Kontorsstöd och videobesök',
    'Personalens tidbok som kalenderprenumeration, journaltext och rapporter som Word-dokument, inbjudan, uppringning och möteslänk för en tid.',
    { avsnitt: ['5.1.1.1'], rutter: ['#/kontorsstod', '#/videomote/:id'], vyer: ['r10r7.js'], kod: ['src/kontorsstod.js'], api: ['GET /api/kontorsstod'],
      simulerat: 'Microsofts tjänster och mötessidan för videobesöket är simulerade.' }),
  m('remiss', 'planering', 'Remiss och konsultation',
    'Remisser med mottagningskvittens, bedömning, svar och kvittens av svaret, och larm när ett steg uteblir. Bilagor, utkast, remiss på uppdrag, fördelning till en namngiven läkare, remisskonferens, konsultation skild från remiss, pappersremisser från andra vårdgivare och ledtider.',
    { avsnitt: ['3.3.1'], rutter: ['#/remisser'], journal: ['remisser'], vyer: ['remisser.js', 'patient-remisser.js'], kod: ['src/remiss.js', 'src/remiss-r4.js', 'src/remiss-r8.js', 'src/remiss-r10.js', 'src/remissavvisning.js', 'public/js/remiss-r8-ui.js'], api: ['GET /api/remisser', 'GET /api/patient/:id/remisser'],
      simulerat: 'Vårdgivare utanför demon och HSA-katalogen är simulerade.' }),
  m('labb', 'planering', 'Beställning och svar för laboratoriet',
    'Labbeställning med paket som systemet föreslår, beställning på uppdrag, provtagning rör för rör med etiketter och streckkod, svar med NPU-kod och referensintervall som läkaren vidimerar, kontroller till avdelningen och laboratoriernas egna system anslutna genom FHIR.',
    { avsnitt: ['4.4.1', '4.4.2', '4.4.3', '5.1.4.5'], rutter: ['#/provtagning'], journal: ['prover'], vyer: ['provtagning.js', 'patient-prover.js'], kod: ['src/labb.js', 'src/labb-katalog.js', 'src/labb-fhir.js', 'src/kontroller.js', 'src/streckkod.js', 'src/produktionssystem.js'], api: ['GET /api/provtagning', 'GET /api/patient/:id/prover'],
      simulerat: 'Laboratorierna är simulerade, och referensintervallen är demovärden.' }),
  m('mobil', 'planering', 'Mobilt arbete och streckkodsläsare',
    'Gränssnittet är byggt för mobilen först, och de vanliga flödena vid sängen är gjorda för mobilen. Streckkodsläsaren i toppraden öppnar patienten från armbandet, bockar av rör och kontrollerar förpackningar, och när servern inte svarar sparas givna doser och mätvärden krypterat och skickas sedan.',
    { avsnitt: ['2.3', '3.1.3.6'], rutter: ['#/administrering', '#/provtagning'], kod: ['src/mobil.js', 'src/skanning.js', 'src/skrivko.js', 'public/js/skanner.js'], api: ['POST /api/skanna', 'POST /api/skrivko'] }),
  m('avbrott', 'planering', 'Läsläge vid avbrott',
    'När servern inte svarar går det att läsa arbetslistan och patienternas journaler ur en krypterad läskopia i webbläsaren, med reservinloggning och reservkod. Läskopian förnyas av sig själv medan man är inloggad.',
    { avsnitt: ['11.2.1.8'], rutter: ['#/arbetslista'], kod: ['public/js/avbrott.js', 'public/js/lasekopia.js', 'public/js/reservkopia.js'], api: ['GET /api/lasekopia'], nas: 'Knappen Simulera avbrott överst på sidan.' }),

  // Specialistområden.
  m('bhv', 'specialist', 'Barnhälsovård och tillväxt',
    'Tillväxtkurvor med WHO:s tillväxtstandard och larm när kurvor korsas, barnhälsovårdens besöks- och vaccinationsprogram med bokning i tidboken, mätningar hemma från vårdnadshavaren och rapportering till Svenska barnhälsovårdsregistret med kontroll före utskicket.',
    { avsnitt: ['4.1', '11.3.1.5'], rutter: ['#/bhv'], journal: ['tillvaxt'], min: ['tillvaxt'], vyer: ['bhv.js', 'patient-tillvaxt.js', 'min-tillvaxt.js'], kod: ['src/bhv.js', 'src/tillvaxt.js', 'src/bhv-program.js', 'src/bhvq.js'], api: ['GET /api/patient/:id/tillvaxt', 'GET /api/bhv/uppfoljning'],
      simulerat: 'Registret är en simulerad mottagare, och larmen och tidsfönstren är demoregler.' }),
  m('bilder', 'specialist', 'Bilder och media',
    'Bilder och dokument i journalen med import från fil, kamera, Min journal och remissbilagor, granskning av det patienten har skickat, jämförelse över tid och undersökningar i ett multimediaarkiv som svarar med utlåtande.',
    { avsnitt: ['4.2'], kod: ['src/bilder.js'], api: ['GET /api/patient/:id/media', 'GET /api/media/vantande'],
      simulerat: 'Multimediaarkivet är simulerat.' }),
  m('samordnad', 'specialist', 'Samordnad planering med kommunen',
    'Samordnad planering vid utskrivning och samordnad individuell plan, där systemet skickar inskrivningsmeddelandet och följer planeringen med kommunen. Kommunen ser bara det regionen har skickat.',
    { avsnitt: ['4.3'], rutter: ['#/samverkan'], journal: ['planer'], vyer: ['r3.js'], kod: ['src/samordnad.js'], api: ['GET /api/samverkan', 'GET /api/patient/:id/samordning'],
      simulerat: 'Kommunen är en simulerad part.' }),
  m('blod', 'specialist', 'Blodprodukter',
    'Beställning av blodprodukter med blodgruppering och bastest som systemet beställer själv när de saknas, och varje enhet följd från utlämning via kontroll vid sängen av två personer till transfusion eller återlämning. Avvikelser vid kontrollen hamnar i inkorgen.',
    { avsnitt: ['4.4.2.12'], kod: ['src/blod.js'], api: ['GET /api/patient/:id/blod', 'GET /api/blod/kontroller'],
      simulerat: 'Blodcentralen och enhetsnumren är simulerade.' }),
  m('operation', 'specialist', 'Operationsplanering',
    'Operationsanmälan med väntelista, planering av sal, team och tid, WHO:s checklista för säker kirurgi, förloppet med KVÅ och implantat, uppvakning med överrapportering och uppföljning per vårdenhet.',
    { avsnitt: ['4.5'], kod: ['src/operation.js'], api: ['GET /api/operation/oversikt', 'GET /api/operation/vantelista', 'GET /api/patient/:id/operation'],
      simulerat: 'Salarna är påhittade, och tiderna och kriterierna är demoregler.' }),
  m('iva', 'specialist', 'Anestesi och intensivvård',
    'Översikt över alla patienter på intensivvårdsavdelningen och övervakning per patient med täta värden från monitorn, larm och förslag ur fördefinierade gränser och trender, kontinuerliga infusioner med titrering, timvis vätskebalans, anestesibedömning och uppföljning per avdelning.',
    { avsnitt: ['4.6'], rutter: ['#/iva', '#/iva/:id'], vyer: ['iva.js'], kod: ['src/iva.js'], api: ['GET /api/iva', 'GET /api/patient/:id/iva'],
      simulerat: 'Utrustningen är simulerad, och reglerna och protokollen är demoregler.' }),
  m('obstetrik', 'specialist', 'Graviditet och förlossning',
    'Graviditetsjournal med beräknad partus, besöksprogram, provschema och riskbedömning, och förlossningsjournal med partogram och barnets egen journal, också vid flerbörd.',
    { avsnitt: ['4.7'], kod: ['src/obstetrik.js'], api: ['GET /api/patient/:id/graviditet', 'GET /api/graviditet/uppfoljning'],
      simulerat: 'Reglerna för besöksprogram och risker är demoregler.' }),
  m('cytostatika', 'specialist', 'Cytostatika',
    'Ordination ur en behandlingsregim med dos efter kroppsyta eller njurfunktion som systemet räknar, provkontroll före kuren, beredningsorder med etikett och dubbelkontroll vid sängen i två inloggningar.',
    { avsnitt: ['4.8'], kod: ['src/cytostatika.js'], api: ['GET /api/patient/:id/cytostatika', 'GET /api/cytostatika/kontroller'],
      simulerat: 'Beredningsenheten är simulerad, och regimerna är demoregimer.' }),

  // Invånaren.
  m('min', 'invanare', 'Min journal för invånaren',
    'Invånarens egen e-tjänst: anteckningar, diagnoser, läkemedel, provsvar och remisser efter vårdgivarens visningsregler, vem som har läst journalen, egna mätningar, egenbokning och incheckning, egen vårdbegäran, vårdplanen, spärrar och ombud. Vårdnadshavare läser barnets journal till 13 år.',
    { avsnitt: ['3.7.1', '3.3.2', '3.4.2.3', '3.4.4.2', '3.4.4.5', '3.6.1.7'], rutter: ['#/min'], min: ['oversikt', 'tider', 'anteckningar', 'diagnoser', 'lakemedel', 'provsvar', 'egenmatning', 'remisser', 'logglista', 'sparrar', 'meddelanden', 'vardplan', 'ombud'], vyer: ['min.js', 'min-delar.js', 'min-tider.js', 'min-r10r7.js', 'min-vardbegaran.js'], kod: ['src/patientvy.js', 'src/ombud.js', 'src/min-vardplan.js', 'src/vardbegaran.js'], api: ['GET /api/min/journal/:id'],
      simulerat: 'E-legitimationen och sms är simulerade.', nas: 'Logga in under Patient på inloggningssidan.' }),
  m('meddelanden', 'invanare', 'Meddelanden och begäranden från invånare',
    'Meddelanden från patienten, vårdnadshavaren och ombudet går till rätt vårdenhet och yrkesroll, och invånarens begäranden om spärr och loggutdrag handläggs i vården.',
    { avsnitt: ['3.7.1.1', '3.7.1.3'], rutter: ['#/meddelanden', '#/meddelanden/:id', '#/begaran'], vyer: ['r10r7.js'], kod: ['src/invanarmeddelanden.js'], api: ['GET /api/meddelanden', 'GET /api/begaran'] }),

  // Uppföljning och ekonomi.
  m('analys', 'uppfoljning', 'Analys och statistik',
    'Patientgrupper ur villkor på diagnoser, åtgärder, läkemedel, mätvärden, levnadsvanor, besök och demografi, statistik med tabell och diagram, sparade och delade urval och ledtider mot målvärden. Statistiken visar inga personuppgifter och döljer små tal.',
    { avsnitt: ['6.2.1'], rutter: ['#/analys'], vyer: ['analys.js'], kod: ['src/analys.js'], api: ['GET /api/analys', 'POST /api/analys/statistik'] }),
  m('datauttag', 'uppfoljning', 'Datauttag',
    'Ett datauttag för uppföljning utan namn och personnummer som byggs om varje natt, och uppföljningen av tvångsvård och samordnad planering.',
    { avsnitt: ['6.3.1'], rutter: ['#/datauttag', '#/planuppfoljning'], vyer: ['datauttag.js', 'r3.js'], kod: ['src/datauttag.js'], api: ['GET /api/datauttag'] }),
  m('rapportering', 'uppfoljning', 'Rapportering till myndigheter och register',
    'Systemet sammanställer månadens rapporter till patientregistret, väntetidsdatabasen, Vårdtillfällesdatabasen, medicinska födelseregistret och ett demoregister för hjärtsvikt ur det som redan är registrerat, och kontrollerar dem mot filspecifikationerna före utskicket.',
    { avsnitt: ['6.3.2'], rutter: ['#/rapportering'], vyer: ['rapportering.js'], kod: ['src/myndighetsrapport.js', 'src/rapportkoder.js'], api: ['GET /api/rapportering'],
      simulerat: 'Mottagarna är simulerade.' }),
  m('forskning', 'uppfoljning', 'Forskningsuttag',
    'Beställningar av datauttag till forskare med etikprövning och två godkännanden, pseudonymer och ett utlämnande som loggas och inte kan ändras.',
    { avsnitt: ['6.3.3'], rutter: ['#/forskning'], vyer: ['forskning.js'], kod: ['src/forskning.js'], api: ['GET /api/forskning'] }),
  m('ekonomi', 'uppfoljning', 'Ekonomi och fakturering',
    'Systemet skapar transaktionsposterna för fakturering ur vårdkontakter, vårddygn, åtgärder, läkemedel, material och hjälpmedel, med priset ur vårdenhetens prislista och betalningsmottagaren uträknad. Prislistor med giltighetstid och kostnader i vårdprocessen.',
    { avsnitt: ['7.1'], rutter: ['#/ekonomi', '#/prislistor'], vyer: ['ekonomi.js'], kod: ['src/ekonomi.js', 'public/js/ekonomi-ui.js'], api: ['GET /api/ekonomi/underlag', 'GET /api/ekonomi/prislistor'] }),

  // Behörighet, förvaltning och teknik.
  m('behorighet', 'forvaltning', 'Behörighet, inloggning och logg',
    'Vårdrelation, inre sekretess med aktivt val, spärr med samtycke, nödåtkomst och skyddade personuppgifter, prövade på servern i varje anrop. Inloggning genom en autentiseringstjänst med biljett och behörighet ur masterdata, en åtkomstlogg och en säkerhetslogg som inte går att ändra, logguppföljning med export och stickprov, signerade meddelanden och skyddsbehov per informationstyp.',
    { avsnitt: ['5.2', '5.3'], rutter: ['#/logg', '#/logg/patient/:id'], journal: ['logglista'], vyer: ['logg.js', 'patient-logglista.js'], kod: ['src/atkomst.js', 'src/logg.js', 'src/logguppfoljning.js', 'src/sakerhetslogg.js', 'src/idp.js', 'src/skyddsbehov.js', 'src/pki.js', 'src/signering.js', 'src/hotmodell.js'], api: ['GET /api/logg', 'GET /api/patient/:id/logglista'],
      simulerat: 'SITHS-kortet är simulerat.' }),
  m('arkiv', 'forvaltning', 'E-arkiv och gallring',
    'Export till e-arkiv enligt Riksarkivets FGS med journalen i FHIR R4 och signerad kvittens, återföring, och gallring och radering bara efter ett registrerat beslut, utan att åtkomstloggen ändras.',
    { avsnitt: ['5.4.2', '5.3.1.7'], rutter: ['#/arkiv'], vyer: ['arkiv.js'], kod: ['src/arkiv.js', 'src/earkiv.js'], api: ['GET /api/arkiv/beslut'],
      simulerat: 'E-arkivet är simulerat.' }),
  m('systemforvaltning', 'forvaltning', 'Systemförvaltning',
    'Regler och parametrar med giltighetsdatum, förhandsvisning och fyra ögon, omorganisationer enligt HSA:s regler, undantag från visning, lagring och säkerhetskopior per huvudman, och miljöer för acceptanstest, utbildning och test ur en kopia av produktionsmiljön.',
    { avsnitt: ['12.1', 'KD1.1.3', 'KD1.1.1.5'], rutter: ['#/regler', '#/omorganisation', '#/undantag', '#/lagring'], vyer: ['systemforvaltning.js'], kod: ['src/konfiguration.js', 'src/omorganisation.js', 'src/undantag.js', 'src/lagring.js', 'src/miljoer.js'], api: ['GET /api/konfiguration', 'GET /api/omorganisation', 'GET /api/lagring', 'GET /api/miljoer'],
      simulerat: 'Kopplingen till HSA-katalogen är simulerad, och HSA-id för nya enheter är påhittade.' }),
  m('kodverk', 'forvaltning', 'Kodverk, masterdata och informationsstruktur',
    'Alla kodverk med version och giltighet, nationellt fackspråk där systemet sätter Snomed CT-koden själv, journalens uppgifter mappade mot Nationell informationsstruktur och masterdata för organisation, personal och befolkning.',
    { avsnitt: ['5.1.2', '5.1.3'], rutter: ['#/kodverk'], vyer: ['kodverk.js'], kod: ['src/kodverk.js', 'src/kodverksforvaltning.js', 'src/masterdata.js', 'src/informationsmodell.js', 'src/fackssprak.js'], api: ['GET /api/kodverk', 'GET /api/masterdata', 'GET /api/informationsmodell'],
      simulerat: 'Källorna för masterdata är utbytbara och simulerade i demon.' }),
  m('migrering', 'forvaltning', 'Migrering och avstämning',
    'Inläsning av ett uttag ur ett annat journalsystem som en FHIR Bundle, där systemet först visar vad som förs över och vad som blir avvikelser, och en avstämning mot antalet i källan.',
    { avsnitt: ['5.1.1.2'], rutter: ['#/migrering'], vyer: ['migrering.js'], kod: ['src/migreringsimport.js'], api: ['GET /api/migrering'] }),
  m('oppetapi', 'forvaltning', 'Öppet FHIR-API',
    'FHIR R4 för läsning och skrivning med samma behörighet, loggning och varningar som gränssnittet, prenumerationer, systemkonton för till exempel ett vårddatalager, ändringslogg per version och ärenden om information som saknas.',
    { avsnitt: ['2.5', '2.6'], rutter: ['#/api'], vyer: ['oppet-api.js'], kod: ['src/fhir.js', 'src/fhir-skrivning.js', 'src/prenumeration.js', 'src/systemkonton.js', 'src/api-forvaltning.js', 'src/api-andringar.js', 'src/oppet-api.js'], api: ['GET /api/oppet-api/forvaltning', 'GET /api/oppet-api/andringar'] }),
  m('nationella', 'forvaltning', 'Nationella tjänster, simulerade',
    'Adaptrar med samma kontrakt som en riktig anslutning för Nationella läkemedelslistan, en producent för Nationell patientöversikt och tjänstekontrakten i bilaga K10, där sidan Öppet API visar Vårdkällans roll för varje kontrakt.',
    { avsnitt: ['2.2', '3.1.4', '5.1.4.1', '5.1.4.2', '5.1.4.3', '5.1.4.4', '5.1.4.6', '3.5.1.9', '3.7.1.2'], rutter: ['#/api'], vyer: ['oppet-api.js'], kod: ['src/tjanstekontrakt.js', 'public/js/tjanstekontrakt.js'], api: ['GET /api/tjanstekontrakt'],
      simulerat: 'Alla nationella tjänster är simulerade i demon.' }),
  m('nationella-anslutning', 'forvaltning', 'Anslutning till de riktiga nationella tjänsterna',
    'Riktiga anslutningar till Nationella läkemedelslistan, Nationell patientöversikt, 1177, Ineras tjänsteplattform och e-remiss mellan vårdgivare. De kräver avtal och anslutning och görs inte i en publik demo.'),
  m('utbildning', 'forvaltning', 'Utbildning, hjälp och nyheter',
    'Övningar med demopatienter och intyg som gäller ett år, hjälp i sammanhanget i de vanligaste flödena och en ruta med det som är nytt för just den rollen efter en ny version.',
    { avsnitt: ['10.1'], rutter: ['#/utbildning', '#/nyheter'], vyer: ['utbildning.js', 'nyheter.js'], kod: ['src/utbildning.js', 'src/nyheter.js', 'public/js/hjalp.js'], api: ['GET /api/utbildning', 'GET /api/nyheter'] }),
  m('tillganglighet', 'forvaltning', 'Tillgänglighet och skärmanpassning',
    'Varje vy för varje roll prövas automatiskt mot det som går att pröva i WCAG 2.1 nivå AA och på mobil, platta och stor skärm, med en tillgänglighetsredogörelse och ett högkontrastläge.',
    { avsnitt: ['8.4.1.3', 'KD1.1.4'], rutter: ['#/tillganglighet'], vyer: ['tillganglighet.js'], kod: ['src/tillganglighet.js', 'public/js/kontrast.js'], api: ['GET /api/tillganglighet'] }),
  m('anvandartest', 'forvaltning', 'Användartester och Sussas testfall',
    'Sussas 34 användbarhetstestfall spelas automatiskt i gränssnittet och mäts som i upphandlingen. Testläget ger personer som arbetar i vården uppgifter en i taget, och testledaren läser SUS och expertgranskningen.',
    { avsnitt: ['8.4.1.1', '8.4.1.2'], rutter: ['#/anvandartest', '#/sussatest'], vyer: ['sussatest.js'], kod: ['src/sussa-testfall.js', 'src/anvandartest.js', 'src/anvandartest-svar.js', 'public/js/anvandartest.js'], api: ['POST /api/anvandartest/svar'] }),
  m('krav', 'forvaltning', 'Kravspårbarhet och moduler',
    'Sussas kravspecifikation med originalnummer och det egna ramverket, där varje krav pekar på de automatiska tester som visar det, lagkravsmatrisen och den här sidan, som räknar fram vad som finns.',
    { avsnitt: ['2.7'], rutter: ['#/krav', '#/moduler'], vyer: ['krav.js', 'moduler.js'], kod: ['src/krav.js', 'src/sussa/index.js', 'src/lagmatris.js', 'src/moduler.js'], api: ['GET /api/krav/sussa', 'GET /api/moduler'] }),
  m('drift', 'forvaltning', 'Systemuppbyggnad och svarstider',
    'Svarstiderna per adress i API:t mot målet, och systemuppbyggnaden i fem perspektiv med alla ingående moduler och totalkostnaden ur mätningen.',
    { avsnitt: ['2.1'], rutter: ['#/drift'], vyer: ['drift.js'], kod: ['src/arkitektur.js', 'src/server.js'], api: ['GET /api/drift', 'GET /api/arkitektur'] }),
];

// Vyer och rutter som inte hör till en enskild modul, med motivering.
export const UTAN_MODUL = {
  vyer: {
    'inloggning.js': 'Inloggningssidan är ingången till alla moduler, för personalen och för Min journal.',
  },
  rutter: {},
};

// Ord som en text om en modul som finns aldrig får använda om modulen.
export const FORBJUDNA = /inte byggt|inte byggd|finns inte|(?<![\wåäö])planerat(?![\wåäö])|ännu inte|inte än(?![\wåäö])/i;

// --- Gränssnittet läses ur koden ---------------------------------------------------------------------------------

// Rutterna i app.js (regexlitteraler som börjar med #/, var de än står), menyns rader och flikarna i journalen och Min
// journal. Också rader som en annan del lägger till med splice eller push känns igen.
export function lasGransnitt({ rot = APP, text = null } = {}) {
  const las = (f) => text?.[f] ?? readFileSync(join(rot, f), 'utf8');
  const app = las('public/js/app.js');
  const rutter = [];
  for (const rad of app.split('\n')) {
    const x = rad.match(/\[\/(\^#\\\/\S*?\$)\/\s*,/);
    if (!x) continue;
    if (!rutter.some(r => r.monster === x[1])) rutter.push({ monster: x[1], re: new RegExp(x[1]), offentlig: /,\s*true\s*\]\s*,?\s*$/.test(rad) || undefined });
  }
  const meny = new Map();
  for (const x of app.matchAll(/\['(#\/[\w/-]+)',\s*'([^']+)',\s*'\w+'/g)) if (!meny.has(x[1])) meny.set(x[1], x[2]);
  const flikar = (fil, re) => {
    const ut = new Map();
    for (const x of las(fil).matchAll(re)) if (!ut.has(x[1])) ut.set(x[1], x[2]);
    return ut;
  };
  return {
    rutter, meny,
    journal: flikar('public/js/vyer/patient.js', /\['([a-z]+)',\s*'([^']+)',\s*\(/g),
    min: flikar('public/js/vyer/min.js', /\['([a-z]+)',\s*'([^']+)',\s*[\w.(]/g),
    vyer: readdirSync(join(rot, 'public/js/vyer')).filter(f => f.endsWith('.js')).sort(),
  };
}

// En rutt i registret med :id prövas mot app.js med ett exempel i stället för variabeln.
export const exempel = (vag) => vag.replace(/:\w+/g, '1');
export const ruttFinns = (g, vag) => g.rutter.some(r => r.re.test(exempel(vag)));
export const traffar = (prefix, id) => id === prefix || id.startsWith(`${prefix}.`);

let gransnittCache = null;

// Registret med status och antal. register är svaret från sussaRegister (samma testresultat som kravsidan), apiFinns
// säger om 'GET /api/...' är en rutt i servern, och finnsFil om en fil finns.
export function modulregister({ register, gransnitt = null, apiFinns = () => false, finnsFil = (f) => existsSync(join(APP, f)), moduler = MODULER } = {}) {
  const g = gransnitt ?? (gransnittCache ??= lasGransnitt());
  const poster = register?.poster ?? [];
  const avsnittRubrik = new Map((register?.avsnitt ?? []).map(a => [a.id, a.rubrik]));
  const postRubrik = new Map(poster.map(p => [p.id, p.rubrik]));
  const ut = moduler.map((mod) => {
    const rutter = mod.rutter.map(vag => ({ vag, finns: ruttFinns(g, vag), meny: g.meny.get(vag) ?? null, offentlig: Boolean(g.rutter.find(r => r.re.test(exempel(vag)))?.offentlig) }));
    const journal = mod.journal.map(flik => ({ flik, namn: g.journal.get(flik) ?? null, finns: g.journal.has(flik) }));
    const min = mod.min.map(flik => ({ flik, namn: g.min.get(flik) ?? null, finns: g.min.has(flik) }));
    const kod = mod.kod.map(fil => ({ fil, finns: finnsFil(fil) }));
    const api = mod.api.map(vag => ({ vag, finns: apiFinns(vag) }));
    const vyer = mod.vyer.map(fil => ({ fil, finns: g.vyer.includes(fil) }));
    const gui = [...rutter, ...journal, ...min].some(x => x.finns);
    const status = gui ? 'demo' : [...kod, ...api].some(x => x.finns) ? 'api' : 'planerat';
    const egna = poster.filter(p => mod.avsnitt.some(a => traffar(a, p.id)));
    const antal = { uppfyllt_demo: 0, delvis: 0, planerat: 0 };
    for (const p of egna) antal[p.status] = (antal[p.status] ?? 0) + 1;
    return {
      id: mod.id, namn: mod.namn, omrade: mod.omrade, beskrivning: mod.beskrivning, simulerat: mod.simulerat, nas: mod.nas,
      status, statusText: STATUSAR[status].rubrik,
      avsnitt: mod.avsnitt.map(id => ({ id, rubrik: avsnittRubrik.get(id) ?? postRubrik.get(id) ?? null })),
      poster: { ...antal, totalt: egna.length, ids: egna.map(p => p.id) },
      kravLank: mod.avsnitt.length ? `#/krav?poster=${mod.avsnitt.join(',')}` : null,
      rutter, journal, min, kod, api, vyer,
    };
  });
  const summa = { demo: 0, api: 0, planerat: 0 };
  for (const x of ut) summa[x.status]++;
  return { statusar: STATUSAR, omraden: OMRADEN.map(([id, namn]) => ({ id, namn })), summa, moduler: ut };
}
