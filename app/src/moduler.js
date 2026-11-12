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
//   api                rutter i API:t, som '/api/iva'.
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
    { avsnitt: ['3.4.1.8'], rutter: ['#/arbetslista', '#/inkorg'], vyer: ['arbetslista.js', 'inkorg.js'], api: ['/api/arbetslista', '/api/inkorg'] }),
  m('oversikt', 'journal', 'Patientöversikt och presentationsvyer',
    'Patienthuvudet med basfakta och behörighetens grund, översikten med tidslinjen där migrerad historik ligger i samma kronologi, och vyer som systemet väljer efter situationen: mottagningsbesök, akut eller rond. Fliken Uppföljning samlar mål, avvikelser och det som ska följas upp, och utbildningsläget visar journalen utan personuppgifter.',
    { avsnitt: ['3.1.2', '3.1.6'], rutter: ['#/patient/:id'], journal: ['oversikt', 'uppfoljning', 'utbildningslage'], vyer: ['patient.js', 'patient-oversikt.js', 'patient-uppfoljning.js', 'patient-utbildningslage.js'], kod: ['src/presentationsvyer.js'], api: ['/api/patient/:id/oversikt', '/api/patient/:id/basfakta'] }),
  m('anteckningar', 'journal', 'Journalanteckningar och signering',
    'Anteckningar från mallar med sökord, utkast, signering med kontrollsumma och rättelse. En signerad anteckning ändras aldrig: rättelsen blir en ny version och den gamla står kvar överstruken. Kontrasignering där systemet föreslår vem, och vårdenhetens signeringslista.',
    { avsnitt: ['3.1.3.1', '3.1.3.5', '3.1.7', '3.1.11', '5.3.1.6'], rutter: ['#/signeringslista'], journal: ['journal'], vyer: ['patient-journal.js', 'signeringslista.js'], kod: ['src/journal.js', 'src/anteckningssignatur.js', 'src/kontrasignering.js', 'src/strukturerad.js'], api: ['/api/patient/:id/anteckningar', '/api/anteckning/:id/signera', '/api/signeringslista'],
      simulerat: 'SITHS-kortet som signaturen görs med är simulerat.' }),
  m('vardkontakt', 'journal', 'Vårdkontakter, vårdtillfällen och hälsoärenden',
    'Allt som dokumenteras hör till en vårdkontakt, och systemet väljer kontakten ur sammanhanget. Vårdtillfällen med inskrivning, flytt, permission och utskrivning, hälsoärenden som håller ihop kontakter över tid, och spårbarhet mot kringsystem och delprocesser.',
    { avsnitt: ['6.1.1', '3.4.4.1', '3.4.4.3'], journal: ['journal', 'oversikt'], vyer: ['patient-vardkontakt.js'], kod: ['src/vardkontakt.js', 'src/halsoarende.js', 'src/sparbarhet.js', 'src/vardformer.js'], api: ['/api/patient/:id/vardkontakter', '/api/patient/:id/halsoarenden'] }),
  m('matvarden', 'journal', 'Mätvärden, skalor och NEWS2',
    'Vitalparametrar och labbvärden med kurva och referensintervall, NEWS2 som systemet räknar ur vitalparametrarna med nästa kontroll och larm, Glasgow Coma Scale och smärta med NRS. Varje värde visar om det är inmatat för hand, från utrustning eller av patienten.',
    { avsnitt: ['3.1.3.4', '3.1.3.9'], journal: ['matvarden'], vyer: ['patient-matvarden.js'], kod: ['src/vitalparametrar.js', 'src/skalor.js', 'src/matvarde-inmatning.js', 'src/syremattnad-skala.js'], api: ['/api/patient/:id/matvarden', '/api/patient/:id/news2'],
      simulerat: 'Referensintervallen och larmgränserna är demoregler.' }),
  m('infarter', 'journal', 'In- och utfarter',
    'Katetrar, sonder och dränage från insättning till avveckling. Den som registrerar väljer typ och placering, och systemet sätter storlek, tid och KVÅ-kod, räknar nästa skötsel och lägger den i avdelningens planering.',
    { avsnitt: ['3.1.3.3', '3.1.3.8'], journal: ['infarter'], vyer: ['patient-infarter.js'], kod: ['src/infarter.js'], api: ['/api/patient/:id/infarter'] }),
  m('formular', 'journal', 'Formulär och kroppsbild',
    'Formulär som verksamheten bygger utan kod: frågor med fasta svar, poäng, skalor, regler, koder ur kodverken, förifyllnad ur journalen och en kroppsbild för markeringar. En ny version gäller först när en annan systemförvaltare har godkänt den, och den som fyller i ser bara de frågor som gäller.',
    { avsnitt: ['3.1.3.1', '3.1.7.1', '5.1.1.3'], rutter: ['#/formular'], journal: ['journal'], vyer: ['formularbyggare.js', 'patient-formular.js'], kod: ['src/formularmotor.js', 'public/js/formularmotor-regler.js'], api: ['/api/formular', '/api/patient/:id/formular/:kod/forifyllnad'] }),
  m('rost', 'journal', 'Röstinmatning och rättstavning',
    'Diktering i anteckningens sökord med röstkommandon för skiljetecken, ny rad och byte av sökord. Dikteringen hör till den öppna patienten och kan aldrig signera. Rättstavning av medicinska termer och grammatik medan man skriver, med en egen ordlista per person.',
    { avsnitt: ['3.1.3.2', '3.1.3.7', '3.1.3.10'], journal: ['journal'], kod: ['src/rostinmatning.js', 'src/stavning.js', 'public/js/rostinmatning.js', 'public/js/stavning-ui.js'], api: ['/api/stavning', '/api/rost/val'],
      simulerat: 'Taligenkänningen är webbläsarens egen och används bara när användaren har valt det.' }),
  m('levnadsvanor', 'journal', 'Levnadsvanor och folkhälsa',
    'Tobak, alkohol, fysisk aktivitet och matvanor med de nationella frågorna, där systemet räknar risken och föreslår stöd med KVÅ-kod, och folkhälsoinsatser som startar med en riskgrupp och följer hur många som har fått stöd.',
    { avsnitt: ['6.2.2'], rutter: ['#/analys'], journal: ['journal'], vyer: ['patient-levnadsvanor.js', 'patient-tobak.js'], kod: ['src/levnadsvanor.js', 'src/tobak.js', 'src/folkhalsa.js'], api: ['/api/folkhalsa'] }),
  m('uppmarksamhet', 'journal', 'Uppmärksamhetsinformation och överkänslighet',
    'Uppmärksamhetsinformation efter Socialstyrelsens huvudgrupper, med en symbol i patienthuvudet, arbetslistan och väntrummet. Systemet föreslår själv uppgifterna ur läkemedelslistan, diagnoserna och överkänsligheterna, och ny överkänslighet registreras i ett eget flöde med ATC-kod som systemet slår upp.',
    { avsnitt: ['3.1.5', '3.1.6.2'], journal: ['oversikt'], kod: ['src/uppmarksamhet.js', 'src/overkanslighet.js', 'src/umi-kodverk.js', 'public/js/uppmarksamhet.js'], api: ['/api/patient/:id/uppmarksamhet', '/api/patient/:id/overkanslighet'], nas: 'Från uppmärksamhetsraden i patienthuvudet.' }),
  m('identitet', 'journal', 'Identitet och sammanslagning',
    'Personnummer, samordningsnummer, reservnummer och annan identitet med OID. Systemet tolkar numret i valfritt format, skapar reservnummer, hittar troliga dubbletter och för samman journalerna när personnumret blir känt.',
    { avsnitt: ['3.1.1'], journal: ['identitet'], vyer: ['patient-identitet.js'], kod: ['src/identitet.js'], api: ['/api/patient/:id/identiteter', '/api/identitet/tolka'],
      simulerat: 'Reservnumren har ett påhittat format i demon.' }),
  m('sok', 'journal', 'Sökning',
    'Sökning efter patient och sökning i journalen. Systemet tolkar vanliga ord, ICD-10-koder, läkemedelsnamn och läkemedelsgrupper, söker bara i det användaren får läsa och markerar träffen i tidsordning.',
    { avsnitt: ['3.1.8'], rutter: ['#/sok'], journal: ['sok'], vyer: ['sok.js', 'patient-sok.js'], kod: ['src/journalsok.js'], api: ['/api/sok', '/api/patient/:id/sok'], nas: 'Sökfältet överst i journalen.' }),
  m('utskrift', 'journal', 'Utskrifter och utlämnanden',
    'Utskrift av hela eller delar av journalen med utskrifts-id på varje sida, där systemet föreslår syftet och säger själv vad som inte kommer med. Utlämnande och återlämnande av journalhandlingar och menprövning registreras.',
    { avsnitt: ['3.1.9'], journal: ['utlamnat'], vyer: ['patient-utlamnat.js'], kod: ['src/utskrift.js', 'public/js/utskrift.js'], api: ['/api/patient/:id/utskrift', '/api/patient/:id/utlamnanden'] }),
  m('restjournaler', 'journal', 'Skannade restjournaler',
    'Pappersjournaler som skannas in och visas i samma kronologi som den övriga journalen. Systemet läser texten i PDF:en, föreslår dokumenttyp och period, kontrollerar personnumret och gör texten sökbar.',
    { avsnitt: ['3.1.10'], journal: ['restjournaler'], vyer: ['patient-restjournaler.js'], kod: ['src/restjournal.js'], api: ['/api/patient/:id/restjournaler'] }),
  m('donation', 'journal', 'Donation och transplantation',
    'Ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen, checklistan bockas av där systemet kan och donationsanteckningen skrivs av systemet. Transplantationer registreras, och en avliden patient märks i hela journalen.',
    { avsnitt: ['3.1.12'], journal: ['donation'], vyer: ['patient-donation.js'], kod: ['src/donation.js', 'src/avliden.js'], api: ['/api/patient/:id/donation'],
      simulerat: 'Donationsregistret och kvalitetsregistret är simulerade.' }),
  m('vardplaner', 'journal', 'Vårdplaner, vårdförlopp och kunskapsstöd',
    'Vårdplaner där systemet föreslår en standardplan ur diagnosen, med vårdförlopp, riktlinjens text och nästa steg, och bevakar uppföljningen. Kunskapsstöd i sammanhanget, vårdenhetens egna utfall och sammanhållen journalföring med en annan vårdgivare.',
    { avsnitt: ['3.2.1', '3.2.2'], journal: ['planer', 'oversikt'], vyer: ['r3.js'], kod: ['src/vardplan.js', 'src/kunskapsstod.js', 'src/utfallsstod.js', 'src/sammanhallen.js', 'public/js/kunskapsstod-ui.js'], api: ['/api/patient/:id/vardplaner', '/api/patient/:id/sammanhallen'],
      simulerat: 'Kunskapsstödet och vårdförloppen är demoregler. Den andra vårdgivaren i sammanhållen journalföring är simulerad.' }),
  m('tvangsvard', 'journal', 'Psykiatrisk tvångsvård',
    'Tvångsvård enligt LPT och LRV, där systemet räknar alla frister med paragraf och föreslår nästa steg. Bevakningen på den psykiatriska vårdenheten visar alla pågående perioder med nästa frist, och uppföljningen samlar tvångsvård och samordning.',
    { avsnitt: ['3.2.3.1', '3.2.3.2', '3.2.3.3', '3.2.3.4'], rutter: ['#/tvangsvard', '#/planuppfoljning'], journal: ['tvangsvard'], vyer: ['r3.js'], kod: ['src/tvangsvard.js', 'src/tvangsvard-regler.js'], api: ['/api/patient/:id/tvangsvard', '/api/tvangsvard/bevakning'] }),
  m('akut', 'journal', 'Akutmottagningen och väntrummet',
    'Akutmottagningens flödestavla: ankomst med ett klick, triage där systemet räknar prioriteten ur vitalparametrarna och kontaktorsaken, bedömning, beslut och ledtider. Uppropning med könummer i väntrummet, där namnet på en skyddad patient aldrig lämnar servern.',
    { avsnitt: ['3.2.3.5'], rutter: ['#/vantrum'], vyer: ['vantrum.js'], kod: ['src/akutflode.js'], api: ['/api/akut', '/api/vantrum'],
      simulerat: 'Ambulansens förvarning är simulerad.' }),
  m('tillampningar', 'journal', 'Externa tillämpningar med SMART on FHIR',
    'Tillämpningar som startas från journalen med SMART on FHIR och aldrig ser mer än den inloggade, till exempel demotillämpningen Blodtryck över tid. Åtkomsten går ut efter 30 minuter och återkallas vid utloggning.',
    { avsnitt: ['5.1.1.4'], journal: ['tillampningar'], vyer: ['patient-tillampningar.js'], kod: ['src/smart.js'], api: ['/api/patient/:id/tillampningar'] }),

  // Läkemedel.
  m('lakemedel', 'lakemedel', 'Läkemedel och ordination',
    'Läkemedelslistan med ordination ur mallar, obligatorisk ordinationsorsak och uppföljningsdatum, varningar som förklarar varför, dosändring från ett datum, upp- och nedtrappning, muntlig ordination, vidimering, läkemedelsgenomgång och läkemedelsberättelse som systemet skriver. Varje överföring till Nationella läkemedelslistan kvitteras.',
    { avsnitt: ['3.5.1', '3.5.2'], journal: ['lakemedel'], vyer: ['patient-lakemedel.js'], kod: ['src/lakemedel.js', 'src/lakemedelsregler.js', 'src/dosandring.js', 'src/ordinationsmallar.js', 'src/ordinationsvagar.js', 'src/lakemedelsoverforing.js', 'src/hogriskkontroll.js'], api: ['/api/patient/:id/lakemedel', '/api/ordination/:id/dosandring'],
      simulerat: 'Nationella läkemedelslistan är simulerad, och varningarna är demoregler, inte kliniskt beslutsstöd.' }),
  m('administrering', 'lakemedel', 'Läkemedel att ge, beredning och vätskebalans',
    'Systemet räknar fram dagens doser per avdelning och patient, och sjuksköterskan ger, iordningställer eller lämnar över med ett klick, också i efterhand och under permission. Beredning med kontroll av en kollega och etikett, patientnära skanning av armband och förpackning, egenadministrering och vätskebalans per dygn och framåt.',
    { avsnitt: ['3.5.2.2', '3.5.2.3', '3.5.2.5', '3.5.2.17', '3.5.2.18', '3.5.2.21', '3.5.3'], rutter: ['#/administrering'], vyer: ['administrering.js'], kod: ['src/administrering.js', 'src/beredning.js', 'src/egenadministrering.js', 'src/lakemedelsvyer.js'], api: ['/api/administreringar', '/api/patient/:id/vatskebalans'] }),
  m('delegering', 'lakemedel', 'Delegering av läkemedelshantering',
    'Sjuksköterskan och läkaren registrerar delegeringar att iordningställa, administrera och lämna över läkemedel, med period och omfattning. Undersköterskan ser sina egna, och systemet påminner innan en delegering går ut.',
    { avsnitt: ['3.5.2.18'], rutter: ['#/delegeringar'], vyer: ['delegeringar.js'], kod: ['src/delegering.js'], api: ['/api/delegeringar'] }),
  m('direktiv', 'lakemedel', 'Generella direktiv och läkemedelsuppföljning',
    'Generella direktiv som läkaren fastställer för vårdenheten eller vårdgivaren, och ordination enligt direktiv för sjuksköterskan. Uppföljningen av läkemedelsbehandlingen per vårdenhet och vårdgivare.',
    { avsnitt: ['3.5.2.15', '3.5.2.20'], rutter: ['#/lakemedelsstod'], vyer: ['lakemedelsstod.js'], kod: ['src/lakemedelsstod.js', 'src/direktiv-vardgivare.js', 'src/lakemedelsuppfoljning.js', 'src/lakemedelsstatistik.js'], api: ['/api/direktiv', '/api/lakemedel/uppfoljning'] }),
  m('lakemedelsansvar', 'lakemedel', 'Läkemedelsansvar på vårdenheten',
    'Verksamhetschefen utser medicinskt ansvarig läkare, läkare ansvarig för läkemedelsmallar, läkemedelsansvarig sjuksköterska och kontrollanter av narkotikaförbrukningen, med systemets förslag. Läkemedelsmallarna godkänns av den mallansvariga läkaren.',
    { avsnitt: ['3.5.1.3'], rutter: ['#/lakemedelsansvar'], vyer: ['lakemedelsansvar.js'], kod: ['src/lakemedelsansvar.js', 'src/mallgodkannande.js'], api: ['/api/lakemedelsansvar', '/api/lakemedelsmallar'] }),
  m('forbrukning', 'lakemedel', 'Förbrukningsartiklar, beställningar och klinisk prövning',
    'Förskrivning, förnyelse, ändring och utsättning av förbrukningsartiklar, beställning av extempore- och licensläkemedel, och kliniska läkemedelsprövningar med studiedeltagande, i läkemedelsfliken.',
    { avsnitt: ['3.5.4', '3.5.5', '3.5.2.4'], journal: ['lakemedel'], vyer: ['forbrukning.js'], kod: ['src/forbrukning.js', 'src/lakemedelsbestallning.js', 'src/kliniskprovning.js'], api: ['/api/patient/:id/forbrukning', '/api/provningar'],
      simulerat: 'Apoteket som tar emot beställningarna är simulerat.' }),
  m('vaccinationer', 'lakemedel', 'Vaccinationer',
    'De nationella vaccinationsprogrammen för barn efter fem år och för riskgrupper. Systemet föreslår nästa dos i programmet och rapporterar den givna vaccinationen.',
    { avsnitt: ['3.5.1.7'], journal: ['vaccinationer'], vyer: ['patient-vaccinationer.js'], kod: ['src/vaccinationsprogram.js', 'src/vaccinationsregister.js'], api: ['/api/patient/:id/vaccinationsprogram'],
      simulerat: 'Vaccinationsregistret är simulerat.' }),
  m('medicinteknik', 'lakemedel', 'Medicinteknisk utrustning',
    'Patientmonitorer och infusionspumpar skickar värden och doser i FHIR R4 eller HL7 v2 med en egen nyckel per utrustning. Utrustningen kopplas till patienten genom att dess streckkod skannas, och värdena klassas och godkänns innan de används för beslut.',
    { avsnitt: ['3.6.1', '3.5.2.19'], rutter: ['#/administrering', '#/iva'], journal: ['matvarden'], kod: ['src/medicinteknik.js', 'src/mt-klass.js', 'public/js/mt-ui.js'], api: ['/api/mt/utrustning', '/api/patient/:id/mt'],
      simulerat: 'Utrustningen är simulerad.' }),

  // Planering och administration.
  m('tidbok', 'planering', 'Tidbok, väntelista och kallelser',
    'Vårdadministratörens dagliga arbete i ordning, tidbok per mottagning och vårdgivare med lokaler och utrustning som resurser, väntelista med gräns mot vårdgarantin, förslag på tider så att bokning är ett klick, teambesök och gruppträffar, kallelser och påminnelser som systemet skriver och skickar, och incheckning i Min journal och på en skärm i väntrummet.',
    { avsnitt: ['3.4.1', '3.4.2', '3.4.3', '3.4.4'], rutter: ['#/idag', '#/tidbok', '#/vantelista', '#/incheckning'], vyer: ['idag.js', 'tidbok.js', 'vantelista.js', 'incheckning.js', 'patient-tider.js'], kod: ['src/tidbok.js', 'src/planering.js', 'src/planering-bas.js', 'src/bokning-r8.js', 'src/vardhandelse.js', 'src/aterbesok.js'], api: ['/api/tidbok', '/api/vantelista'],
      simulerat: 'Sms och brev är simulerade, och vårdgarantins gränser är demoregler.' }),
  m('avdelning', 'planering', 'Avdelningens planering och beläggning',
    'Allt som ska göras för avdelningens patienter i dag: uppgifter som provtagning och omläggning, läkemedel att ge och bokade tider, per tid, patient eller resurs. Beläggningen per avdelning visas utan personuppgifter.',
    { avsnitt: ['3.4.1.6', '3.1.2.4'], rutter: ['#/avdelning', '#/avdelning/patient/:id', '#/avdelning/resurs/:id'], vyer: ['avdelning.js'], kod: ['src/avdelningsplan.js'], api: ['/api/avdelning/planering', '/api/belaggning'], nas: 'Från arbetslistan.' }),
  m('kassa', 'planering', 'Kassa och patientavgifter',
    'Avgifter för besök, hjälpmedel, receptförnyelse och intyg som systemet räknar, betalning, återbetalning med kvitto, kassaredovisning per kassör och betalsätt och dagsavslut som inte kan ändras.',
    { avsnitt: ['3.4.4.4'], rutter: ['#/kassa'], vyer: ['r10r7.js'], kod: ['src/kassa.js'], api: ['/api/kassa'],
      simulerat: 'Betalterminalen är simulerad, och avgifterna är demoregler.' }),
  m('kapacitet', 'planering', 'Kapacitet och prognos',
    'Lediga tider mot väntelistan och de inkomna remisserna tolv veckor framåt, när kön är borta, vilka som riskerar att passera sin gräns och förslag på fler tider.',
    { avsnitt: ['3.4.1.5'], rutter: ['#/kapacitet'], vyer: ['r10r7.js'], kod: ['src/kapacitetsprognos.js'], api: ['/api/kapacitet'],
      simulerat: 'Prognosen är en demoregel.' }),
  m('kontorsstod', 'planering', 'Kontorsstöd och videobesök',
    'Personalens tidbok som kalenderprenumeration, journaltext och rapporter som Word-dokument, inbjudan, uppringning och möteslänk för en tid.',
    { avsnitt: ['5.1.1.1'], rutter: ['#/kontorsstod', '#/videomote/:id'], vyer: ['r10r7.js'], kod: ['src/kontorsstod.js'], api: ['/api/kontorsstod'],
      simulerat: 'Microsofts tjänster och mötessidan för videobesöket är simulerade.' }),
  m('remiss', 'planering', 'Remiss och konsultation',
    'Remisser med mottagningskvittens, bedömning, svar och kvittens av svaret, och larm när ett steg uteblir. Bilagor, utkast, remiss på uppdrag, fördelning till en namngiven läkare, remisskonferens, konsultation skild från remiss, pappersremisser från andra vårdgivare och ledtider.',
    { avsnitt: ['3.3.1'], rutter: ['#/remisser'], journal: ['remisser'], vyer: ['remisser.js', 'patient-remisser.js'], kod: ['src/remiss.js', 'src/remiss-r4.js', 'src/remiss-r8.js', 'src/remiss-r10.js', 'src/remissavvisning.js', 'public/js/remiss-r8-ui.js'], api: ['/api/remisser', '/api/patient/:id/remisser'],
      simulerat: 'Vårdgivare utanför demon och HSA-katalogen är simulerade.' }),
  m('labb', 'planering', 'Beställning och svar för laboratoriet, röntgen och fysiologi',
    'Labbeställning med paket som systemet föreslår, beställning på uppdrag, provtagning rör för rör med etiketter och streckkod, svar med NPU-kod och referensintervall som läkaren vidimerar, kontroller till avdelningen och laboratoriernas egna system anslutna genom FHIR. Röntgen, ultraljud, klinisk fysiologi och klinisk neurofysiologi beställs i samma formulär, med kontroll av njurfunktionen före kontrast och frågor före strålning och magnetkamera, och röntgenklinikens arbetslista bokar den första lediga tiden med ett klick. Ett rättat svar behåller den tidigare versionen, och patientnära instrument skickar sina svar själva.',
    { avsnitt: ['4.4.1', '4.4.2', '4.4.3', '5.1.4.5'], rutter: ['#/provtagning', '#/undersokningar'], journal: ['prover'], vyer: ['provtagning.js', 'patient-prover.js', 'undersokningar.js'], kod: ['src/labb.js', 'src/labb-katalog.js', 'src/labb-fhir.js', 'src/kontroller.js', 'src/streckkod.js', 'src/produktionssystem.js', 'src/undersokningar.js', 'src/labb-svarsversioner.js', 'src/labb-underlag.js', 'src/patientnara.js'], api: ['/api/provtagning', '/api/patient/:id/prover'],
      simulerat: 'Laboratoriernas och röntgens system och instrumenten vid sängen är simulerade, och referensintervallen är demovärden.' }),
  m('mobil', 'planering', 'Mobilt arbete och streckkodsläsare',
    'Gränssnittet är byggt för mobilen först, och de vanliga flödena vid sängen är gjorda för mobilen. Streckkodsläsaren i toppraden öppnar patienten från armbandet, bockar av rör och kontrollerar förpackningar, och när servern inte svarar sparas givna doser och mätvärden krypterat och skickas sedan.',
    { avsnitt: ['2.3', '3.1.3.6'], rutter: ['#/administrering', '#/provtagning'], kod: ['src/mobil.js', 'src/skanning.js', 'src/skrivko.js', 'public/js/skanner.js'], api: ['/api/skanna', '/api/skrivko'] }),
  m('avbrott', 'planering', 'Läsläge vid avbrott',
    'När servern inte svarar går det att läsa arbetslistan och patienternas journaler ur en krypterad läskopia i webbläsaren, med reservinloggning och reservkod. Läskopian förnyas av sig själv medan man är inloggad.',
    { avsnitt: ['11.2.1.8'], rutter: ['#/arbetslista'], kod: ['public/js/avbrott.js', 'public/js/lasekopia.js', 'public/js/reservkopia.js'], api: ['/api/lasekopia'], nas: 'Knappen Simulera avbrott överst på sidan.' }),

  // Specialistområden.
  m('bhv', 'specialist', 'Barnhälsovård och tillväxt',
    'Tillväxtkurvor med WHO:s tillväxtstandard och WHO:s referens 5 till 19 år, där du väljer referens och vilka mått som visas, och larm när kurvor korsas. Sitthöjd och pubertet enligt Tanners stadier, där systemet säger till när puberteten är tidig eller sen, och tidigare mätningar som läses in från en fil eller ett annat journalsystem efter att systemet har granskat dem. Barnhälsovårdens besöks- och vaccinationsprogram med bokning i tidboken, mätningar hemma från vårdnadshavaren, valbara indikatorer som uppföljningen ser för regionen och rapportering till Svenska barnhälsovårdsregistret med kontroll före utskicket.',
    { avsnitt: ['4.1', '11.3.1.5'], rutter: ['#/bhv'], journal: ['tillvaxt'], min: ['tillvaxt'], vyer: ['bhv.js', 'patient-tillvaxt.js', 'min-tillvaxt.js'], kod: ['src/bhv.js', 'src/tillvaxt.js', 'src/tillvaxt-r11.js', 'src/seed/who2007-tillvaxt.js', 'src/bhv-program.js', 'src/bhvq.js', 'public/js/bhv-indikatorer-ui.js'], api: ['/api/patient/:id/tillvaxt', '/api/bhv/uppfoljning'],
      simulerat: 'Registret och det andra journalsystemet är simulerade, och larmen och tidsfönstren är demoregler.' }),
  m('bilder', 'specialist', 'Bilder och media',
    'Fliken Bilder i journalen med galleri, förstoring med annoteringar och jämförelse över tid per kroppsställe. Bilder, filmer och ljud läggs in från datorn, mobilens kamera eller en apparat och hämtas från en annan vårdgivare med patientens samtycke. Det som kommer från en apparat, en annan vårdgivare eller patienten granskas innan det förs in i journalen, och röntgenstudierna visas ur multimediaarkivet med fönster och mätning genom DICOMweb.',
    { avsnitt: ['4.2'], journal: ['bilder'], vyer: ['patient-bilder.js'], kod: ['src/bilder.js', 'src/bildmedia.js', 'src/bildkodek.js', 'src/dicom-arkiv.js', 'public/js/bildvisare.js'], api: ['/api/patient/:id/media', '/api/media/vantande'],
      simulerat: 'Multimediaarkivet, apparaterna och den andra vårdgivaren är simulerade.' }),
  m('samordnad', 'specialist', 'Samordnad planering med kommunen',
    'Samordnad planering vid utskrivning och samordnad individuell plan, där systemet skickar inskrivningsmeddelandet och följer planeringen med kommunen. Kommunen ser bara det regionen har skickat.',
    { avsnitt: ['4.3'], rutter: ['#/samverkan'], journal: ['planer'], vyer: ['r3.js'], kod: ['src/samordnad.js'], api: ['/api/samverkan', '/api/patient/:id/samordning'],
      simulerat: 'Kommunen är en simulerad part.' }),
  m('blod', 'specialist', 'Blodprodukter',
    'Fliken Blod i journalen beställer blodprodukter med blodgruppering och bastest, som systemet beställer själv när de saknas, och följer beställningen från upprättad till avslutad. Transfusionen står som en administrering i läkemedelslistan med kontroll vid sängen av två personer, en transfusionsreaktion rapporteras till blodcentralen med systemets klassning, åtgärder och prover, och sidan Blodcentralen visar vårdenhetens beställningar, blodet på avdelningen och lagret.',
    { avsnitt: ['4.4.2.12'], rutter: ['#/blodcentral'], journal: ['blod'], vyer: ['blodcentral.js', 'patient-blod.js'], kod: ['src/blod.js'], api: ['/api/patient/:id/blod', '/api/blod/kontroller'],
      simulerat: 'Blodcentralen och enhetsnumren är simulerade.' }),
  m('operation', 'specialist', 'Operationsplanering',
    'Operationsavdelningen med dagens program per sal, väntelistan, uppvakningen, salsblocken över vårdenheter och sjukhus, förrådet med sterilgodset och uppföljningen, och fliken Operation i journalen. Systemet föreslår tid, sal, team med anestesi och utrustning, fyller i WHO:s checklista för säker kirurgi med det som redan är känt, för anestesijournalen med värden från monitorn och räknar om dagens program när en operation drar ut på tiden. Anestesin är en egen vårdenhet, och operationsanmälan är en beställning till den.',
    { avsnitt: ['4.5'], rutter: ['#/operation'], journal: ['operation'], vyer: ['operation.js', 'patient-operation.js'], kod: ['src/operation.js', 'src/operation-seed.js', 'src/anestesijournal.js', 'src/sterilgods.js'], api: ['/api/operation/oversikt', '/api/operation/vantelista', '/api/patient/:id/operation'],
      simulerat: 'Salarna, monitorn och sterilcentralen är simulerade, och tiderna och kriterierna är demoregler.' }),
  m('iva', 'specialist', 'Anestesi och intensivvård',
    'Översikt över alla patienter på intensivvårdsavdelningen och övervakning per patient med EKG, artärtryck, pletysmografi och andning i realtid från monitorn, monitorns larm och egna larmgränser för patienten, som aldrig tystar avdelningens larm. Kontinuerliga infusioner med målstyrd titrering, timvis vätskebalans med perspiratio och prognos mot behandlingsmålen, vårdtyngd enligt NEMS, överrapportering enligt SBAR och fliken Intensivvård i journalen. Anestesibedömningen inför en operation görs från operationen i journalen, och anestesiläkaren bekräftar ASA-klassen på operationsdagen.',
    { avsnitt: ['4.6'], rutter: ['#/iva', '#/iva/:id'], journal: ['iva'], vyer: ['iva.js', 'iva-tillagg.js', 'patient-iva.js'], kod: ['src/iva.js', 'src/iva-dosenhet.js', 'src/iva-nems.js', 'src/iva-patientregler.js', 'src/iva-vagform.js', 'src/iva-vatskemal.js'], api: ['/api/iva', '/api/patient/:id/iva'],
      simulerat: 'Monitorn och utrustningen är simulerade, och reglerna och protokollen är demoregler.' }),
  m('obstetrik', 'specialist', 'Graviditet och förlossning',
    'Graviditetsjournalen i fliken Graviditet med besöksprogram, provschema, riskbedömning, ultraljudsjournal och inskrivningssamtal, där svaren på frågorna om våld bara läses av mödrahälsovården och av en vårdenhet som kvinnan har gett sitt samtycke till. Mödrahälsovårdens sida med vårdenhetens graviditeter och rapporteringen till Graviditetsregistret, och förlossningen med partogram, CTG som systemet analyserar, smärtlindring, födelseanmälan och BB-journalen för mor och barn, också vid tvillingar. Kvinnan ser sin graviditet i Min journal.',
    { avsnitt: ['4.7'], rutter: ['#/modrahalsovard', '#/forlossning', '#/forlossning/:id'], journal: ['graviditet', 'nyfodd'], min: ['graviditet'], vyer: ['modrahalsovard.js', 'forlossning.js', 'patient-graviditet.js', 'min-graviditet.js'], kod: ['src/obstetrik.js', 'src/forlossning.js', 'src/graviditetsregistret.js', 'src/obstetrik-seed.js', 'public/js/obstetrik-ui.js'], api: ['/api/patient/:id/graviditet', '/api/graviditet/uppfoljning'],
      simulerat: 'CTG-monitorn, Graviditetsregistret och Skatteverkets mottagning av födelseanmälan är simulerade, och reglerna för besöksprogram och risker är demoregler.' }),
  m('cytostatika', 'specialist', 'Cytostatika',
    'Fliken Cytostatika i journalen med behandlingen ur regimbiblioteket, kurer, doser efter kroppsyta eller njurfunktion, premedicinering och kumulativ dos. Läkaren godkänner kuren när systemet har prövat provsvaren, den kumulativa dosen och beredningsenhetens platser, och sjuksköterskan ger den med dubbelkontroll i två inloggningar och registrerar infusionens förlopp. Regimbiblioteket har versioner som en regimansvarig läkare godkänner, beredningsenheten signerar beredningen med batch och kontrollmätning och följer en batch till patienterna, och den som har tabletter hemma rapporterar varje dag i Min journal.',
    { avsnitt: ['4.8'], rutter: ['#/cytostatika', '#/cytostatika/regimer', '#/beredning'], journal: ['cytostatika'], min: ['cytostatika'], vyer: ['cytostatika-enhet.js', 'cytostatikaberedning.js', 'patient-cytostatika.js', 'min-cytostatika.js'], kod: ['src/cytostatika.js', 'src/cytostatika-beredning.js', 'src/cytostatika-demo.js'], api: ['/api/patient/:id/cytostatika', '/api/cytostatika/kontroller'],
      simulerat: 'Regimerna är demoregimer, och beredningsenhetens kapacitet är en demoregel.' }),

  // Invånaren.
  m('min', 'invanare', 'Min journal för invånaren',
    'Invånarens egen e-tjänst: anteckningar, diagnoser, läkemedel, provsvar och remisser efter vårdgivarens visningsregler, vem som har läst journalen, egna mätningar, egenbokning och incheckning, egen vårdbegäran, vårdplanen, spärrar och ombud. Vårdnadshavare läser barnets journal till 13 år.',
    { avsnitt: ['3.7.1', '3.3.2', '3.4.2.3', '3.4.4.2', '3.4.4.5', '3.6.1.7'], rutter: ['#/min'], min: ['oversikt', 'tider', 'anteckningar', 'diagnoser', 'lakemedel', 'provsvar', 'egenmatning', 'remisser', 'logglista', 'sparrar', 'meddelanden', 'vardplan', 'ombud'], vyer: ['min.js', 'min-delar.js', 'min-tider.js', 'min-r10r7.js', 'min-vardbegaran.js'], kod: ['src/patientvy.js', 'src/ombud.js', 'src/min-vardplan.js', 'src/vardbegaran.js'], api: ['/api/min/journal/:id'],
      simulerat: 'E-legitimationen och sms är simulerade.', nas: 'Logga in under Patient på inloggningssidan.' }),
  m('meddelanden', 'invanare', 'Meddelanden och begäranden från invånare',
    'Meddelanden från patienten, vårdnadshavaren och ombudet går till rätt vårdenhet och yrkesroll, och invånarens begäranden om spärr och loggutdrag handläggs i vården.',
    { avsnitt: ['3.7.1.1', '3.7.1.3'], rutter: ['#/meddelanden', '#/meddelanden/:id', '#/begaran'], vyer: ['r10r7.js'], kod: ['src/invanarmeddelanden.js'], api: ['/api/meddelanden', '/api/begaran'] }),

  // Uppföljning och ekonomi.
  m('analys', 'uppfoljning', 'Analys och statistik',
    'Patientgrupper ur villkor på diagnoser, åtgärder, läkemedel, mätvärden, levnadsvanor, besök och demografi, statistik med tabell och diagram, sparade och delade urval och ledtider mot målvärden. Statistiken visar inga personuppgifter och döljer små tal.',
    { avsnitt: ['6.2.1'], rutter: ['#/analys'], vyer: ['analys.js'], kod: ['src/analys.js'], api: ['/api/analys', '/api/analys/statistik'] }),
  m('datauttag', 'uppfoljning', 'Datauttag',
    'Ett datauttag för uppföljning utan namn och personnummer som byggs om varje natt, och uppföljningen av tvångsvård och samordnad planering.',
    { avsnitt: ['6.3.1'], rutter: ['#/datauttag', '#/planuppfoljning'], vyer: ['datauttag.js', 'r3.js'], kod: ['src/datauttag.js'], api: ['/api/datauttag'] }),
  m('rapportering', 'uppfoljning', 'Rapportering till myndigheter och register',
    'Systemet sammanställer månadens rapporter till patientregistret, väntetidsdatabasen, Vårdtillfällesdatabasen, medicinska födelseregistret och ett demoregister för hjärtsvikt ur det som redan är registrerat, och kontrollerar dem mot filspecifikationerna före utskicket.',
    { avsnitt: ['6.3.2'], rutter: ['#/rapportering'], vyer: ['rapportering.js'], kod: ['src/myndighetsrapport.js', 'src/rapportkoder.js'], api: ['/api/rapportering'],
      simulerat: 'Mottagarna är simulerade.' }),
  m('forskning', 'uppfoljning', 'Forskningsuttag',
    'Beställningar av datauttag till forskare med etikprövning och två godkännanden, pseudonymer och ett utlämnande som loggas och inte kan ändras.',
    { avsnitt: ['6.3.3'], rutter: ['#/forskning'], vyer: ['forskning.js'], kod: ['src/forskning.js'], api: ['/api/forskning'] }),
  m('ekonomi', 'uppfoljning', 'Ekonomi och fakturering',
    'Systemet skapar transaktionsposterna för fakturering ur vårdkontakter, vårddygn, åtgärder, läkemedel, material och hjälpmedel, med priset ur vårdenhetens prislista och betalningsmottagaren uträknad. Prislistor med giltighetstid och kostnader i vårdprocessen.',
    { avsnitt: ['7.1'], rutter: ['#/ekonomi', '#/prislistor'], vyer: ['ekonomi.js'], kod: ['src/ekonomi.js', 'public/js/ekonomi-ui.js'], api: ['/api/ekonomi/underlag', '/api/ekonomi/prislistor'] }),

  // Behörighet, förvaltning och teknik.
  m('behorighet', 'forvaltning', 'Behörighet, inloggning och logg',
    'Vårdrelation, inre sekretess med aktivt val, spärr med samtycke, nödåtkomst och skyddade personuppgifter, prövade på servern i varje anrop. Inloggning genom en autentiseringstjänst med biljett och behörighet ur masterdata, en åtkomstlogg och en säkerhetslogg som inte går att ändra, logguppföljning med export och stickprov, signerade meddelanden och skyddsbehov per informationstyp.',
    { avsnitt: ['5.2', '5.3'], rutter: ['#/logg', '#/logg/patient/:id'], journal: ['logglista'], vyer: ['logg.js', 'patient-logglista.js'], kod: ['src/atkomst.js', 'src/logg.js', 'src/logguppfoljning.js', 'src/sakerhetslogg.js', 'src/idp.js', 'src/skyddsbehov.js', 'src/pki.js', 'src/signering.js', 'src/hotmodell.js'], api: ['/api/logg', '/api/patient/:id/logglista'],
      simulerat: 'SITHS-kortet är simulerat.' }),
  m('arkiv', 'forvaltning', 'E-arkiv och gallring',
    'Export till e-arkiv enligt Riksarkivets FGS med journalen i FHIR R4 och signerad kvittens, återföring, och gallring och radering bara efter ett registrerat beslut, utan att åtkomstloggen ändras.',
    { avsnitt: ['5.4.2', '5.3.1.7'], rutter: ['#/arkiv'], vyer: ['arkiv.js'], kod: ['src/arkiv.js', 'src/earkiv.js'], api: ['/api/arkiv/beslut'],
      simulerat: 'E-arkivet är simulerat.' }),
  m('systemforvaltning', 'forvaltning', 'Systemförvaltning',
    'Regler och parametrar med giltighetsdatum, förhandsvisning och fyra ögon, omorganisationer enligt HSA:s regler, undantag från visning, lagring och säkerhetskopior per huvudman, och miljöer för acceptanstest, utbildning och test ur en kopia av produktionsmiljön.',
    { avsnitt: ['12.1', 'KD1.1.3', 'KD1.1.1.5'], rutter: ['#/regler', '#/omorganisation', '#/undantag', '#/lagring'], vyer: ['systemforvaltning.js'], kod: ['src/konfiguration.js', 'src/omorganisation.js', 'src/undantag.js', 'src/lagring.js', 'src/miljoer.js'], api: ['/api/konfiguration', '/api/omorganisation', '/api/lagring', '/api/miljoer'],
      simulerat: 'Kopplingen till HSA-katalogen är simulerad, och HSA-id för nya enheter är påhittade.' }),
  m('kodverk', 'forvaltning', 'Kodverk, masterdata och informationsstruktur',
    'Alla kodverk med version och giltighet, nationellt fackspråk där systemet sätter Snomed CT-koden själv, journalens uppgifter mappade mot Nationell informationsstruktur och masterdata för organisation, personal och befolkning.',
    { avsnitt: ['5.1.2', '5.1.3'], rutter: ['#/kodverk'], vyer: ['kodverk.js'], kod: ['src/kodverk.js', 'src/kodverksforvaltning.js', 'src/masterdata.js', 'src/informationsmodell.js', 'src/fackssprak.js'], api: ['/api/kodverk', '/api/masterdata', '/api/informationsmodell'],
      simulerat: 'Källorna för masterdata är utbytbara och simulerade i demon.' }),
  m('migrering', 'forvaltning', 'Migrering och avstämning',
    'Inläsning av ett uttag ur ett annat journalsystem som en FHIR Bundle, där systemet först visar vad som förs över och vad som blir avvikelser, och en avstämning mot antalet i källan.',
    { avsnitt: ['5.1.1.2'], rutter: ['#/migrering'], vyer: ['migrering.js'], kod: ['src/migreringsimport.js'], api: ['/api/migrering'] }),
  m('oppetapi', 'forvaltning', 'Öppet FHIR-API',
    'FHIR R4 för läsning och skrivning med samma behörighet, loggning och varningar som gränssnittet, prenumerationer, systemkonton för till exempel ett vårddatalager, ändringslogg per version och ärenden om information som saknas.',
    { avsnitt: ['2.5', '2.6'], rutter: ['#/api'], vyer: ['oppet-api.js'], kod: ['src/fhir.js', 'src/fhir-skrivning.js', 'src/prenumeration.js', 'src/systemkonton.js', 'src/api-forvaltning.js', 'src/api-andringar.js', 'src/oppet-api.js'], api: ['/api/oppet-api/forvaltning', '/api/oppet-api/andringar'] }),
  m('nationella', 'forvaltning', 'Nationella tjänster, simulerade',
    'Adaptrar med samma kontrakt som en riktig anslutning för Nationella läkemedelslistan, en producent för Nationell patientöversikt och tjänstekontrakten i bilaga K10, där sidan Öppet API visar Vårdkällans roll för varje kontrakt.',
    { avsnitt: ['2.2', '3.1.4', '5.1.4.1', '5.1.4.2', '5.1.4.3', '5.1.4.4', '5.1.4.6', '3.5.1.9', '3.7.1.2'], rutter: ['#/api'], vyer: ['oppet-api.js'], kod: ['src/tjanstekontrakt.js', 'public/js/tjanstekontrakt.js'], api: ['/api/tjanstekontrakt'],
      simulerat: 'Alla nationella tjänster är simulerade i demon.' }),
  m('nationella-anslutning', 'forvaltning', 'Anslutning till de riktiga nationella tjänsterna',
    'Riktiga anslutningar till Nationella läkemedelslistan, Nationell patientöversikt, 1177, Ineras tjänsteplattform och e-remiss mellan vårdgivare. De kräver avtal och anslutning och görs inte i en publik demo.'),
  m('utbildning', 'forvaltning', 'Utbildning, hjälp och nyheter',
    'Övningar med demopatienter och intyg som gäller ett år, hjälp i sammanhanget i de vanligaste flödena och en ruta med det som är nytt för just den rollen efter en ny version.',
    { avsnitt: ['10.1'], rutter: ['#/utbildning', '#/nyheter'], vyer: ['utbildning.js', 'nyheter.js'], kod: ['src/utbildning.js', 'src/nyheter.js', 'public/js/hjalp.js'], api: ['/api/utbildning', '/api/nyheter'] }),
  m('tillganglighet', 'forvaltning', 'Tillgänglighet och skärmanpassning',
    'Varje vy för varje roll prövas automatiskt mot det som går att pröva i WCAG 2.1 nivå AA och på mobil, platta och stor skärm, med en tillgänglighetsredogörelse och ett högkontrastläge.',
    { avsnitt: ['8.4.1.3', 'KD1.1.4'], rutter: ['#/tillganglighet'], vyer: ['tillganglighet.js'], kod: ['src/tillganglighet.js', 'public/js/kontrast.js'], api: ['/api/tillganglighet'] }),
  m('anvandartest', 'forvaltning', 'Användartester och Sussas testfall',
    'Sussas 34 användbarhetstestfall spelas automatiskt i gränssnittet och mäts som i upphandlingen. Testläget ger personer som arbetar i vården uppgifter en i taget, och testledaren läser SUS och expertgranskningen.',
    { avsnitt: ['8.4.1.1', '8.4.1.2'], rutter: ['#/anvandartest', '#/sussatest'], vyer: ['sussatest.js'], kod: ['src/sussa-testfall.js', 'src/anvandartest.js', 'src/anvandartest-svar.js', 'public/js/anvandartest.js'], api: ['/api/anvandartest/svar'] }),
  m('krav', 'forvaltning', 'Kravspårbarhet och moduler',
    'Sussas kravspecifikation med originalnummer och det egna ramverket, där varje krav pekar på de automatiska tester som visar det, lagkravsmatrisen och den här sidan, som räknar fram vad som finns.',
    { avsnitt: ['2.7'], rutter: ['#/krav', '#/moduler'], vyer: ['krav.js', 'moduler.js'], kod: ['src/krav.js', 'src/sussa/index.js', 'src/lagmatris.js', 'src/moduler.js'], api: ['/api/krav/sussa', '/api/moduler'] }),
  m('drift', 'forvaltning', 'Systemuppbyggnad och svarstider',
    'Svarstiderna per adress i API:t mot målet, och systemuppbyggnaden i fem perspektiv med alla ingående moduler och totalkostnaden ur mätningen.',
    { avsnitt: ['2.1'], rutter: ['#/drift'], vyer: ['drift.js'], kod: ['src/arkitektur.js', 'src/server.js'], api: ['/api/drift', '/api/arkitektur'] }),
];

// Runda 13, r1: testinbjudan, guidade uppdrag efter Sussas testfall och synpunkter från varje vy.
MODULER.push(m('testinbjudan', 'forvaltning', 'Testinbjudan och synpunkter',
  'En startsida för personal som vill jämföra Vårdkällan med sitt journalsystem. Testaren väljer yrkesroll och får uppdrag efter Sussas 34 testfall, som systemet bockar av själv, och svarar efter varje uppdrag om det var lättare, ungefär lika eller svårare än i det system hen använder i dag. Knappen Lämna synpunkt finns på varje sida, och testledaren läser allt sorterat per uppdrag, journalsystem och vy med en läskod.',
  { avsnitt: [], rutter: ['#/testa', '#/om', '#/testledare'], vyer: ['testa.js', 'om.js', 'testledare.js'], kod: ['src/testinbjudan.js', 'src/synpunkter.js', 'src/r13r1-rutter.js', 'public/js/testinbjudan.js', 'public/js/synpunkt-regler.js', 'scripts/testinbjudan.js'],
    api: ['/api/synpunkter', '/api/testare', '/api/testledare/synpunkter'], simulerat: 'Demorollerna och testpatienterna är påhittade. Svaren är testarnas egna och sparas i en egen databas utanför sandlådorna.' }));

// Runda 12, r1: journalens mallar, sökord och mätvärdestyper hör till systemförvaltningen (journalstruktur.js).
{
  const s = MODULER.find(x => x.id === 'systemforvaltning');
  s.rutter.push('#/struktur');
  s.vyer.push('journalstruktur.js');
  s.kod.push('src/journalstruktur.js');
  s.api.push('/api/journalstruktur', '/api/mattyper');
}
// Runda 12, r3 (vårt L5): flerfaktorsinloggning hör till modulen för behörighet och inloggning.
{
  const b = MODULER.find(x => x.id === 'behorighet');
  b.beskrivning += ' Flerfaktorsinloggning med passkeys (WebAuthn) och engångskoder (RFC 6238) för personalen och för invånaren i Min journal, påslagen av var och en.';
  b.rutter.push('#/flerfaktor');
  b.vyer.push('flerfaktor.js');
  b.kod.push('src/flerfaktor.js', 'public/js/flerfaktor-ui.js');
  b.api.push('/api/flerfaktor');
  b.simulerat = 'SITHS-kortet och e-legitimationen är simulerade. Flerfaktorn är riktig men gäller bara i besökarens sandlåda.';
  // Praktiska prov i journalen hör till utbildningen.
  const u = MODULER.find(x => x.id === 'utbildning');
  u.beskrivning += ' Praktiska prov som görs i en övningsjournal, där systemet kontrollerar resultatet och utbildaren följer upp.';
  u.kod.push('src/praktiska-prov.js');
  // Arbete över flera skärmar hör till skärmanpassningen.
  const t = MODULER.find(x => x.id === 'tillganglighet');
  t.beskrivning += ' En del av journalen kan öppnas i ett nytt fönster, och fönstren följer varandra när en patient öppnas.';
  t.kod.push('public/js/flera-fonster.js');
}
// Runda 12, r2: uppgraderingarna med återgång och de schemalagda säkerhetskopiorna hör till systemförvaltningen.
{
  const sf = MODULER.find(x => x.id === 'systemforvaltning');
  sf.rutter.push('#/uppgraderingar');
  sf.vyer.push('uppgraderingar.js');
  sf.kod.push('src/releaser.js', 'src/sakerhetskopior.js', 'src/lagringsprognos.js');
  sf.api.push('/api/uppgraderingar', '/api/sakerhetskopior');
  sf.beskrivning += ' Uppgraderingar som två systemförvaltare godkänner och som går att backa, och schemalagda säkerhetskopior på två platser med återställning till en tidpunkt.';
  sf.simulerat += ' I demon byter en uppgradering eller återgång bara databasen i sandlådan, inte programmet, och säkerhetskopiornas två platser är två kataloger på samma server.';
}
// Runda 13, r2: kapaciteten för många besökare (sandlådor som vilar på disk, sidan när demon är full och taken mot
// missbruk) hör till modulen för systemuppbyggnad och svarstider.
{
  const d = MODULER.find(x => x.id === 'drift');
  d.beskrivning += ' Sandlådor som inte används vilar på disk och läses in igen vid nästa anrop, så att ingen sandlåda tas bort för att ge plats åt en ny. Systemet räknar själv ut hur många som ryms i minnet ur minnesgränsen, och när demon är full får en ny besökare en sida som säger när det är lönt att försöka igen.';
  d.kod.push('src/sandlada-vila.js', 'public/js/demo-full.js');
}
// Runda 14, r4: testprotokollet med spårbarhet till kraven (Sussa 11.2.1.7) hör till kravspårbarheten.
{
  const k = MODULER.find(x => x.id === 'krav');
  k.beskrivning += ' Testprotokollet visar för varje krav testfallen, resultatet, när testerna kördes och vilken byggd version det gäller, och kan skrivas ut inför ett acceptanstest.';
  k.avsnitt.push('11.2.1.7');
  k.rutter.push('#/testprotokoll');
  k.vyer.push('testprotokoll.js');
  k.kod.push('src/testprotokoll.js', 'scripts/testprotokoll-md.js');
  k.api.push('/api/krav/testprotokoll');
  // Dokumentationen av gränssnitten för informationsutbyte (Sussa 3.6.1.3) hör till det öppna API:t.
  const o = MODULER.find(x => x.id === 'oppetapi');
  o.beskrivning += ' Alla gränssnitt för informationsutbyte beskrivs samlat i docs/gransnitt.md, med processen för hur en beställare själv utvecklar och förvaltar dem.';
  o.avsnitt.push('3.6.1.3');
  o.kod.push('src/gransnitt-utbyte.js');
}
// Runda 14, r4: mellanarkivet (Sussa 5.4.2.2) hör till e-arkivet, och reservdatorn för läkemedel (Sussa 11.2.1.8) till
// läsläget vid avbrott.
{
  const a = MODULER.find(x => x.id === 'arkiv');
  a.beskrivning += ' Äldre journalhandlingar förs över till ett mellanarkiv efter ett beslut, och visas sedan i journalen, tidslinjen och sökningen som förut, med samma behörighet och loggning.';
  a.kod.push('src/mellanarkiv.js', 'src/mellanarkiv-rutter.js');
  a.api.push('/api/patient/:id/mellanarkiv', '/api/mellanarkiv/:id');
  a.simulerat = 'E-arkivet och mellanarkivet är simulerade.';
  const r = MODULER.find(x => x.id === 'avbrott');
  r.beskrivning += ' En dator på vårdenheten kan vara reservdator för läkemedel: den hämtar själv ordinationerna och dagens doser för alla inskrivna patienter var fjärde minut och visar och skriver ut dem när kärnsystemet inte svarar.';
  r.rutter.push('#/reservdator');
  r.vyer.push('reservdator.js');
  r.kod.push('src/reservlakemedel.js');
  r.api.push('/api/reservlista');
}

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
  // En flik med dold: true nås bara från något annat (sökfältet, översikten) och står inte bland flikarna.
  const dolda = new Set();
  const flikar = (fil, re) => {
    const ut = new Map();
    for (const rad of las(fil).split('\n')) {
      for (const x of rad.matchAll(re)) {
        if (!ut.has(x[1])) ut.set(x[1], x[2]);
        if (/dold:\s*true/.test(rad) && fil.endsWith('patient.js')) dolda.add(x[1]);
      }
    }
    return ut;
  };
  return {
    rutter, meny, dolda,
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
// säger om '/api/...' är en rutt i servern, och finnsFil om en fil finns.
export function modulregister({ register, gransnitt = null, apiFinns = () => false, finnsFil = (f) => existsSync(join(APP, f)), moduler = MODULER } = {}) {
  const g = gransnitt ?? (gransnittCache ??= lasGransnitt());
  const poster = register?.poster ?? [];
  const avsnittRubrik = new Map((register?.avsnitt ?? []).map(a => [a.id, a.rubrik]));
  const postRubrik = new Map(poster.map(p => [p.id, p.rubrik]));
  const ut = moduler.map((mod) => {
    const rutter = mod.rutter.map(vag => ({ vag, finns: ruttFinns(g, vag), meny: g.meny.get(vag) ?? null, offentlig: Boolean(g.rutter.find(r => r.re.test(exempel(vag)))?.offentlig) }));
    const journal = mod.journal.map(flik => ({ flik, namn: g.journal.get(flik) ?? null, finns: g.journal.has(flik), dold: Boolean(g.dolda?.has(flik)) }));
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
