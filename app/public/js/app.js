// Vårdkällan: sessionen, ramen och routningen. Varje vy är en modul med visa(main, parametrar).
import { esc, api, avbrytAllaAnrop, krokar, nySession, notis, felNotis, ikon, tal, medKnapp, avbrott } from './ui.js';
import * as avbrottslage from './avbrott.js';
import { satNyckel } from './lasekopia.js';
import * as inloggning from './vyer/inloggning.js';
import * as arbetslista from './vyer/arbetslista.js';
import * as sok from './vyer/sok.js';
import * as inkorg from './vyer/inkorg.js';
import * as patient from './vyer/patient.js';
import * as remisser from './vyer/remisser.js';
import * as vantrum from './vyer/vantrum.js';
import * as logg from './vyer/logg.js';
import * as migrering from './vyer/migrering.js';
import * as krav from './vyer/krav.js';
import * as moduler from './vyer/moduler.js';
// Runda 12, r2: uppgraderingar med återgång.
import * as uppgraderingar from './vyer/uppgraderingar.js';
import * as oppetApi from './vyer/oppet-api.js';
import * as drift from './vyer/drift.js';
import * as anvandartest from './anvandartest.js';
// Runda 13, r1: testinbjudan, guidade uppdrag och synpunkter från varje vy.
import * as testinbjudan from './testinbjudan.js';
import * as testa from './vyer/testa.js';
import * as omDemon from './vyer/om.js';
import * as testledare from './vyer/testledare.js';
import * as minJournal from './vyer/min.js';
import * as administrering from './vyer/administrering.js';
import * as arkiv from './vyer/arkiv.js';
import * as datauttag from './vyer/datauttag.js';
// Tidboken (Sussa 3.4.1 till 3.4.4): vårdadministratörens startsida, tidbok, väntelista och incheckningsskärm.
import * as idag from './vyer/idag.js';
import * as tidbok from './vyer/tidbok.js';
import * as vantelista from './vyer/vantelista.js';
import * as incheckning from './vyer/incheckning.js';
// Delegering av läkemedelshantering (runda 5).
import * as delegeringar from './vyer/delegeringar.js';
// Runda 6, r3: bevakningen av tvångsvården, uppföljningen och kommunens vy.
import { bevakningVy, uppfoljningVy, samverkanVy, inkorgAntal } from './vyer/r3.js';
// Runda 6, r2: generella direktiv och uppföljning.
import * as lakemedelsstod from './vyer/lakemedelsstod.js';
// Runda 6, r6: verksamhetschefens uppdrag i läkemedelshanteringen.
import * as lakemedelsansvar from './vyer/lakemedelsansvar.js';
// Runda 7, r3: ekonomens faktureringsunderlag och prislistor.
import * as ekonomi from './vyer/ekonomi.js';
// Runda 7, r4: systemförvaltningen.
import * as systemforvaltning from './vyer/systemforvaltning.js';
// Runda 10, r3: systemförvaltarens formulär (formularbyggare.js).
import { formularVy } from './vyer/formularbyggare.js';
// Runda 9, r4: kodverken och masterdatan.
import * as kodverk from './vyer/kodverk.js';
// Runda 12, r1: journalens mallar, sökord och mätvärdestyper utan programmerare.
import * as journalstruktur from './vyer/journalstruktur.js';
// Runda 7, r5: rapportering till myndigheter och register.
import * as rapportering from './vyer/rapportering.js';
// Runda 7, r6: barnhälsovårdens sida med rapporteringen till registret och uppföljningen.
import * as barnhalsovard from './vyer/bhv.js';
// Runda 7, r2: nyhetsrutan, utbildningen, tillgänglighetsredogörelsen och högkontrastläget.
import * as nyhetsruta from './nyheter.js';
import * as kontrast from './kontrast.js';
import * as nyheter from './vyer/nyheter.js';
import * as utbildning from './vyer/utbildning.js';
import * as tillganglighet from './vyer/tillganglighet.js';
import * as tidsgrans from './tidsgrans.js';
// Runda 8, r1: provtagningen och kontrollerna på vårdenheten, och raderna för beställning och svar i inkorgen.
import * as provtagning from './vyer/provtagning.js';
// Runda 11, r6: röntgenklinikens arbetslista med inkomna undersökningar, prioritet och bokning.
import * as undersokningar from './vyer/undersokningar.js';
import { inkorgAntal as labbInkorgAntal } from './labb-ui.js';

// Högkontrastläget sätts innan något ritas, så att sidan inte blinkar till i vanliga färger.
kontrast.init();
// Runda 7, r1: Sussas testfall med testpersoner, SUS och expertgranskning.
import * as sussatest from './vyer/sussatest.js';
// Runda 8, r3: avdelningens planerade händelser och en resurs planering.
import * as avdelning from './vyer/avdelning.js';
// Runda 9, r2: intensivvårdens översikt och övervakning.
import * as iva from './vyer/iva.js';
// Runda 11, r2: operationsavdelningen.
import * as operationsavdelning from './vyer/operation.js';
// Runda 9, r7: analys och statistik, forskningsuttag och streckkodsläsaren.
import * as analys from './vyer/analys.js';
import * as forskning from './vyer/forskning.js';
import * as signeringslista from './vyer/signeringslista.js';
import * as skanner from './skanner.js';
// Runda 10, r7: meddelanden från invånare, invånarnas begäranden, kassan, kapaciteten och kontorsstödet.
import * as r10r7 from './vyer/r10r7.js';
// Runda 11, r4: cytostatika på vårdenheten, regimbiblioteket, beredningsenheten och blodcentralen.
import * as cytostatikaEnhet from './vyer/cytostatika-enhet.js';
import * as cytostatikaberedning from './vyer/cytostatikaberedning.js';
import * as blodcentral from './vyer/blodcentral.js';

// Runda 11, r3: förlossningen och BB, och mödrahälsovården.
import * as forlossning from './vyer/forlossning.js';
import * as modrahalsovard from './vyer/modrahalsovard.js';
// Runda 12, r3 (vårt L5): flerfaktorsinloggning med passkeys och engångskoder.
import * as flerfaktorVy from './vyer/flerfaktor.js';
import { andraFaktorn } from './flerfaktor-ui.js';
// Runda 12, r3 (Sussa KD1.1.4.10): arbete över flera skärmar.
import * as flera from './flera-fonster.js';
// Runda 13, r2: sidan när demon är full.
import * as demoFull from './demo-full.js';

// Globalt tillstånd.
export const S = { session: null, inkorg: null, svarstid: null };

export const far = (handling) => Boolean(S.session?.behorigheter?.includes(handling));
// Personalen loggar in med simulerat SITHS-kort, invånaren i Min journal med simulerad e-legitimation.
export const arPersonal = () => Boolean(S.session?.inloggad && S.session.personal);
export const arInvanare = () => Boolean(S.session?.inloggad && S.session.roll === 'invanare');
export const arLogggranskare = () => S.session?.personal?.yrke === 'logggranskare';
// Arkivarien och uppföljningsrollen läser inte journalen och har ingen arbetslista (Sussa 5.4.2 och 6.3.1).
// Runda 6, r6: verksamhetschefen läser inte heller journalen.
// Runda 7, r3 och r4: ekonomen och systemförvaltaren läser inte heller journalen.
export const utanJournal = () => ['logggranskare', 'arkivarie', 'uppfoljning', 'kommun', 'verksamhetschef', 'ekonom', 'systemforvaltare'].includes(S.session?.personal?.yrke);
export const minVardenhet = () => S.session?.enhet?.vardenhet?.id ?? null;
export const pa = (...h) => h.some(far);
// Runda 11, r6: vårdenheterna som utför beställda undersökningar i demon (röntgenkliniken). Servern prövar det själv.
const UTFORANDE_ENHETER = ['uso-rtg'];
export const utforandeEnhet = () => far('undersokning_utfora') && UTFORANDE_ENHETER.includes(minVardenhet());

// Vänstermenyn. Varje rad: adress, text, ikon, villkor, räknare.
const MENY = [
  ['#/idag', 'Dagens arbete', 'kalender', () => far('boka')],
  ['#/tidbok', 'Tidbok', 'klocka', () => far('boka')],
  ['#/vantelista', 'Väntelista', 'ko', () => far('vantelista')],
  // Runda 10, r7: vårdadministratörens kassa och vårdenhetens kapacitet.
  ['#/kassa', 'Kassa', 'kort', () => far('kassa')],
  ['#/kapacitet', 'Kapacitet', 'krav', () => far('kapacitet')],
  ['#/arbetslista', 'Arbetslista', 'lista', () => !utanJournal()],
  ['#/sok', 'Sök patient', 'sok', () => far('sok')],
  ['#/inkorg', 'Inkorg', 'inkorg', () => !utanJournal(), 'inkorg'],
  // Läkaren ger läkemedel från patientens läkemedelsflik, och avdelningens lista är för sjuksköterskan och
  // undersköterskan med delegering (runda 5). Sjuksköterskan och läkaren registrerar delegeringarna.
  ['#/administrering', 'Läkemedel att ge', 'piller', () => far('ge_lakemedel') && !far('ordinera')],
  // Runda 8, r1: rören att ta och kontrollerna i dag, för sjuksköterskan och undersköterskan. Läkaren tar prover från
  // patientens flik Prover.
  ['#/provtagning', 'Prover och kontroller', 'lista', () => far('ta_prov') && !far('bestalla_prov') && !utforandeEnhet()],
  // Runda 11, r6: undersökningarna för personalen på röntgenkliniken, som utför dem.
  ['#/undersokningar', 'Undersökningar', 'kalender', () => utforandeEnhet()],
  // Runda 9, r2: intensivvården, för läkare, sjuksköterskor och undersköterskor på en vårdenhet med intensivvårdsavdelning.
  ['#/iva', 'Intensivvård', 'larm', () => Boolean(S.session?.iva)],
  // Runda 11, r2: operationsavdelningen, för personalen på en vårdenhet som opererar.
  ['#/operation', 'Operation', 'kalender', () => Boolean(S.session?.operation)],
  // Runda 11, r4: cytostatika för läkare och sjuksköterskor på en vårdenhet som ger cytostatika, beredningsenheten för
  // farmaceuten där, och blodcentralen för läkare och sjuksköterskor.
  ['#/cytostatika', 'Cytostatika', 'piller', () => Boolean(S.session?.r11r4?.cytostatika)],
  ['#/beredning', 'Beredning', 'lista', () => Boolean(S.session?.r11r4?.beredning)],
  ['#/blodcentral', 'Blodcentralen', 'kort', () => far('las_prover') && far('bestalla_lakemedel')],
  // Runda 10, r7: meddelanden från invånare till vårdenheten.
  ['#/meddelanden', 'Meddelanden', 'inkorg', () => far('meddelande_invanare')],
  ['#/delegeringar', 'Delegeringar', 'nyckel', () => far('delegera')],
  // Runda 6, r3: tvångsvården på psykiatrin och kommunens samverkan.
  ['#/tvangsvard', 'Tvångsvård', 'klocka', () => Boolean(S.session?.r3?.tvangsvardsenhet)],
  ['#/samverkan', 'Samverkan', 'lista', () => far('samverkan')],
  // Runda 6, r2: generella direktiv för läkaren och sjuksköterskan och uppföljningen på vårdenhetens nivå för läkaren.
  // Runda 6, r6: verksamhetschefen utser uppdragen i läkemedelshanteringen.
  ['#/lakemedelsansvar', 'Läkemedelsansvar', 'nyckel', () => far('lakemedelsansvar')],
  ['#/lakemedelsstod', 'Direktiv och uppföljning', 'piller', () => pa('faststalla_direktiv', 'ordinera_direktiv')],
  // Runda 7, r4: systemförvaltningen.
  ['#/regler', 'Regler och parametrar', 'penna', () => far('konfigurera')],
  ['#/omorganisation', 'Omorganisation', 'moduler', () => far('omorganisera')],
  ['#/undantag', 'Undantag från visning', 'oga', () => far('undanta')],
  ['#/lagring', 'Lagring', 'arkiv', () => far('lagring')],
  // Runda 12, r2: uppgraderingar med återgång och godkännande av två systemförvaltare.
  ['#/uppgraderingar', 'Uppgraderingar', 'pil', () => far('lagring')],
  // Runda 9, r4.
  ['#/kodverk', 'Kodverk och masterdata', 'lista', () => far('konfigurera')],
  // Runda 12, r1.
  ['#/struktur', 'Mallar och mätvärdestyper', 'penna', () => far('konfigurera')],
  // Runda 10, r3: formulären som verksamheten bygger.
  ['#/formular', 'Formulär', 'penna', () => far('konfigurera')],
  // Runda 7, r6: barnhälsovården, för läkare och sjuksköterskor på en vårdenhet med barnavårdscentral.
  ['#/bhv', 'Barnhälsovård', 'person', () => Boolean(S.session?.bhv)],
  ['#/remisser', 'Remisser', 'remiss', () => pa('las_remiss', 'las_remiss_status')],
  ['#/vantrum', 'Väntrum (akuten)', 'vantrum', () => far('vantrum')],
  ['#/logg', 'Logguppföljning', 'logg', () => far('las_logg')],
  // Runda 10, r7: invånarnas begäranden om spärr och loggutdrag.
  ['#/begaran', 'Begäranden', 'lista', () => pa('registrera_sparr', 'las_logg')],
  // Runda 13, r3 (E3-35): verksamhetschefen godkänner gallring och radering här.
  ['#/arkiv', 'E-arkiv och gallring', 'arkiv', () => pa('registrera_arkivbeslut', 'godkanna_gallring')],
  ['#/datauttag', 'Datauttag', 'lista', () => far('datauttag')],
  ['#/planuppfoljning', 'Tvångsvård och samordning', 'krav', () => far('datauttag')],
  // Runda 7, r3: ekonomen.
  ['#/ekonomi', 'Faktureringsunderlag', 'lista', () => far('faktureringsunderlag')],
  ['#/prislistor', 'Prislistor', 'kort', () => far('prislista')],
  // Runda 7, r5.
  ['#/rapportering', 'Rapportering', 'arkiv', () => far('myndighetsrapport')],
  // Runda 9, r7: patientgrupper, statistik, folkhälsa och ledtider, och beställningar av forskningsuttag.
  ['#/analys', 'Analys och statistik', 'krav', () => pa('patientgrupp', 'statistik', 'statistik_region')],
  ['#/forskning', 'Forskningsuttag', 'arkiv', () => pa('forskning_bestall', 'forskning_godkann')],
  ['#/signeringslista', 'Signeringslista', 'penna', () => far('signeringslista')],
  // Runda 10, r7: kontorsstödet, med kalenderprenumerationen, för dem som har en tidbok.
  ['#/kontorsstod', 'Kontorsstöd', 'moduler', () => far('las_tidbok')],
  // Runda 7, r2: övningar och intyg för all personal (Sussa 10.1.1.5).
  ['#/utbildning', 'Utbildning', 'person', () => far('utbildning')],
  // Runda 7, r1: testledaren läser och exporterar svaren från användartesterna.
  ['#/sussatest', 'Användartester', 'krav', () => far('anvandartest_las')],
  ['#/migrering', 'Migreringsavstämning', 'migrering', () => true],
  ['#/krav', 'Kravspårbarhet', 'krav', () => true],
  ['#/moduler', 'Moduler', 'moduler', () => true],
  ['#/api', 'Öppet API', 'kod', () => true],
  ['#/drift', 'Svarstider', 'klocka', () => true],
];

// Runda 11, r3: Mödrahälsovård och Förlossningen efter Barnhälsovård, för läkare och sjuksköterskor (barnmorskor) på en
// vårdenhet med mödrahälsovård eller förlossning.
MENY.splice(MENY.findIndex(m => m[0] === '#/bhv') + 1, 0,
  ['#/modrahalsovard', 'Mödrahälsovård', 'person', () => Boolean(S.session?.obstetrik?.mhv)],
  ['#/forlossning', 'Förlossningen', 'larm', () => Boolean(S.session?.obstetrik?.forlossning)]);

const RUTTER = [
  [/^#\/idag$/, idag, () => far('boka')],
  // Runda 6, r4: läkare och sjuksköterskor läser tidboken, med sitt eget schema som förval.
  [/^#\/tidbok$/, tidbok, () => far('las_tidbok')],
  [/^#\/vantelista$/, vantelista, () => far('vantelista')],
  [/^#\/incheckning$/, incheckning, () => far('checka_in')],
  [/^#\/arbetslista$/, arbetslista, () => !utanJournal()],
  // Runda 8, r3.
  [/^#\/avdelning$/, avdelning, () => far('las_planering')],
  // Runda 9, r7.
  [/^#\/analys$/, analys, () => pa('patientgrupp', 'statistik', 'statistik_region')],
  [/^#\/forskning$/, forskning, () => pa('forskning_bestall', 'forskning_godkann')],
  [/^#\/signeringslista$/, signeringslista, () => far('signeringslista')],
  // Runda 10, r7.
  [/^#\/meddelanden$/, r10r7.meddelanden, () => far('meddelande_invanare')],
  [/^#\/meddelanden\/(\d+)$/, r10r7.meddelanden, () => far('meddelande_invanare')],
  [/^#\/begaran$/, r10r7.begaran, () => pa('registrera_sparr', 'las_logg')],
  [/^#\/kassa$/, r10r7.kassa, () => far('kassa')],
  [/^#\/kapacitet$/, r10r7.kapacitet, () => far('kapacitet')],
  [/^#\/kontorsstod$/, r10r7.kontorsstod, () => far('las_tidbok')],
  [/^#\/videomote\/([\w-]+)$/, r10r7.videomote, () => true, true],
  [/^#\/avdelning\/patient\/([\w-]+)$/, avdelning.patient, () => far('las_planering')],
  [/^#\/avdelning\/resurs\/([\w-]+)$/, avdelning.resurs, () => far('las_planering')],
  [/^#\/sok$/, sok, () => far('sok')],
  [/^#\/inkorg$/, inkorg, () => !utanJournal()],
  [/^#\/administrering$/, administrering, () => far('las_lakemedel')],
  // Runda 8, r1.
  [/^#\/provtagning$/, provtagning, () => far('ta_prov')],
  // Runda 11, r6.
  [/^#\/undersokningar$/, undersokningar, () => utforandeEnhet()],
  // Runda 9, r2.
  [/^#\/iva$/, iva, () => Boolean(S.session?.iva)],
  [/^#\/iva\/([\w-]+)$/, iva.patient, () => Boolean(S.session?.iva)],
  // Runda 11, r2.
  [/^#\/operation(?:\/([a-z]+))?$/, operationsavdelning, () => Boolean(S.session?.operation)],
  // Runda 11, r4.
  [/^#\/cytostatika$/, cytostatikaEnhet, () => far('las_cytostatika')],
  [/^#\/cytostatika\/regimer$/, cytostatikaEnhet.regimer, () => far('las_cytostatika')],
  [/^#\/beredning$/, cytostatikaberedning, () => Boolean(S.session?.r11r4?.beredning)],
  [/^#\/blodcentral$/, blodcentral, () => far('las_prover') && far('bestalla_lakemedel')],
  // Delegeringar (runda 5): sjuksköterskan och läkaren registrerar, undersköterskan ser sina egna.
  [/^#\/delegeringar$/, delegeringar, () => far('delegera') || S.session?.personal?.yrke === 'underskoterska'],
  [/^#\/lakemedelsstod$/, lakemedelsstod, () => pa('faststalla_direktiv', 'ordinera_direktiv')],
  [/^#\/lakemedelsansvar$/, lakemedelsansvar, () => far('lakemedelsansvar')],
  // Runda 7, r4: systemförvaltningen.
  [/^#\/regler$/, systemforvaltning.regler, () => far('konfigurera')],
  [/^#\/omorganisation$/, systemforvaltning.omorganisation, () => far('omorganisera')],
  [/^#\/undantag$/, systemforvaltning.undantag, () => far('undanta')],
  [/^#\/lagring$/, systemforvaltning.lagring, () => far('lagring')],
  // Runda 12, r2.
  [/^#\/uppgraderingar$/, uppgraderingar, () => far('lagring')],
  // Runda 9, r4.
  [/^#\/kodverk$/, kodverk, () => far('konfigurera')],
  // Runda 12, r1.
  [/^#\/struktur$/, journalstruktur, () => far('konfigurera')],
  // Runda 10, r3.
  [/^#\/formular$/, formularVy, () => far('konfigurera')],
  [/^#\/bhv$/, barnhalsovard, () => Boolean(S.session?.bhv)],
  // Runda 11, r3.
  [/^#\/modrahalsovard$/, modrahalsovard, () => Boolean(S.session?.obstetrik?.mhv)],
  [/^#\/forlossning$/, forlossning, () => Boolean(S.session?.obstetrik?.forlossning)],
  [/^#\/forlossning\/([\w-]+)$/, forlossning.patient, () => Boolean(S.session?.obstetrik?.forlossning)],
  [/^#\/remisser$/, remisser, () => pa('las_remiss', 'las_remiss_status')],
  [/^#\/vantrum$/, vantrum, () => far('vantrum')],
  [/^#\/logg$/, logg, () => far('las_logg')],
  [/^#\/logg\/patient\/([\w-]+)$/, logg.patient, () => far('las_logg')],
  [/^#\/arkiv$/, arkiv, () => far('registrera_arkivbeslut')],
  [/^#\/datauttag$/, datauttag, () => far('datauttag')],
  // Runda 6, r3.
  [/^#\/tvangsvard$/, bevakningVy, () => Boolean(S.session?.r3?.tvangsvardsenhet)],
  [/^#\/planuppfoljning$/, uppfoljningVy, () => far('datauttag') || Boolean(S.session?.r3?.tvangsvardsenhet)],
  [/^#\/samverkan$/, samverkanVy, () => far('samverkan')],
  // Runda 7, r3.
  [/^#\/ekonomi$/, ekonomi, () => far('faktureringsunderlag')],
  [/^#\/prislistor$/, ekonomi.prislistor, () => far('prislista')],
  // Runda 7, r5.
  [/^#\/rapportering$/, rapportering, () => far('myndighetsrapport')],
  // Runda 7, r2: utbildningen, nyheterna och tillgänglighetsredogörelsen (öppen utan inloggning).
  [/^#\/utbildning$/, utbildning, () => far('utbildning')],
  [/^#\/nyheter$/, nyheter, () => arPersonal()],
  [/^#\/tillganglighet$/, tillganglighet, () => true, true],
  [/^#\/migrering$/, migrering, () => true],
  [/^#\/krav$/, krav, () => true, true],
  [/^#\/moduler$/, moduler, () => true, true],
  [/^#\/api$/, oppetApi, () => true],
  [/^#\/drift$/, drift, () => true, true],
  [/^#\/anvandartest$/, anvandartest, () => true, true],
  // Runda 7, r1.
  [/^#\/sussatest$/, sussatest, () => true, true],
  [/^#\/patient\/([\w-]+)(?:\/([a-z]+))?(?:\/([\w-]+))?$/, patient, () => !utanJournal()],
];
// Runda 13, r1: startsidan för testare, sidan om demon och testledarens vy, öppna utan inloggning.
RUTTER.splice(RUTTER.findIndex(r => String(r[0]) === String(/^#\/anvandartest$/)), 0,
  [/^#\/testa$/, testa, () => true, true],
  [/^#\/om$/, omDemon, () => true, true],
  [/^#\/testledare$/, testledare, () => true, true],
);
// Runda 12, r3 (vårt L5): inloggning och flerfaktor, för all personal och för invånaren i Min journal.
RUTTER.splice(RUTTER.findIndex(r => String(r[0]) === String(/^#\/nyheter$/)), 0, [/^#\/flerfaktor$/, flerfaktorVy, () => arPersonal()]);

// Invånarens adresser i Min journal, och de offentliga sidorna. Personalens vyer finns inte här.
const RUTTER_MIN = [
  [/^#\/min(?:\/([\w-]+))?(?:\/([a-z]+))?(?:\/([\w-]+))?$/, minJournal],
  [/^#\/krav$/, krav],
  [/^#\/moduler$/, moduler],
  [/^#\/drift$/, drift],
  // Runda 7, r2.
  [/^#\/nyheter$/, nyheter],
  [/^#\/tillganglighet$/, tillganglighet],
  // Runda 10, r7: den simulerade mötessidan för ett videobesök.
  [/^#\/videomote\/([\w-]+)$/, r10r7.videomote],
  // Runda 12, r3.
  [/^#\/flerfaktor$/, flerfaktorVy],
  // Runda 13, r1.
  [/^#\/testa$/, testa],
  [/^#\/om$/, omDemon],
];

// Enhetsträdet: varje enhet med sin vårdenhet. Inre sekretess och remisser räknas per vårdenhet.
const enhetMap = new Map();
export async function laddaEnheter() {
  if (enhetMap.size) return;
  const trad = await api('/api/enheter');
  const gaa = (n, ve) => {
    const egen = n.typ === 'vardenhet' ? n.id : ve;
    enhetMap.set(n.id, { ...n, vardenhet: n.typ === 'arbetsplats' ? ve : egen });
    n.barn.forEach(b => gaa(b, egen));
  };
  trad.forEach(n => gaa(n, null));
}
export const vardenhetAv = (id) => enhetMap.get(id)?.vardenhet ?? id;
export const enhetLista = () => [...enhetMap.values()];

// Vårdadministratören börjar på dagens arbete, där systemet har ordnat det som ska göras i dag.
export const hem = () => (arInvanare() ? '#/min' : arLogggranskare() ? '#/logg' : far('registrera_arkivbeslut') ? '#/arkiv' : far('datauttag') ? '#/datauttag' : far('samverkan') ? '#/samverkan' : far('lakemedelsansvar') ? '#/lakemedelsansvar' : far('faktureringsunderlag') ? '#/ekonomi' : far('konfigurera') ? '#/regler' : far('boka') ? '#/idag' : '#/arbetslista');

// Logotypen: en droppe över en våg, en källa.
export const logotyp = (storlek = 30) => `<svg class="logotyp" width="${storlek}" height="${storlek}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M16 5.2c-3.3 4.7-6.1 8.1-6.1 11.6a6.1 6.1 0 0 0 12.2 0c0-3.5-2.8-6.9-6.1-11.6z" fill="#fff"/><path d="M7.5 26.2c2.8-1.7 5.7-1.7 8.5 0s5.7 1.7 8.5 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;

function svarstidHtml() {
  const t = S.svarstid;
  const text = t?.server != null ? `${tal(t.server, 1)} ms` : 'ingen mätning än';
  return `${ikon.klocka}<span>Svarstid <strong>${esc(text)}</strong></span>`;
}

krokar.svarstid = (t) => {
  if (t.server == null) return;
  S.svarstid = t;
  const el = document.getElementById('svarstid');
  if (el) {
    el.innerHTML = svarstidHtml();
    el.title = `Senaste anrop: ${t.metod} ${t.vag}. Serverns tid ${tal(t.server, 1)} ms, hela vägen ${tal(t.totalt, 0)} ms.`;
  }
};
krokar.vid401 = () => {
  avbrottslage.stoppaFornyelse();
  tidsgrans.stopp();
  const varInloggad = Boolean(S.session?.inloggad);
  S.session = { inloggad: false };
  // Sessionen finns inte längre, så flikens läskopia och nyckel gäller inte heller.
  avbrottslage.rensa().catch(() => {});
  if (varInloggad) notis('Du är utloggad. Välj en roll för att logga in igen.', 'info');
  ramNyckel = null;
  if (location.hash !== '#/') location.hash = '#/'; else rita();
};
// Runda 7, r2: servern säger i varje svar när inloggningen går ut, och tidsgrans.js varnar fem minuter innan.
krokar.inloggning = (iso) => tidsgrans.satt(iso);
// Runda 13, r2: servern säger vad taket gäller (nya besök, tunga anrop eller sandlådor från adressen).
krokar.vid429 = (e) => notis(e?.message || 'Det har kommit många nya besök från din adress. Vänta en stund och försök sedan igen.', 'info');
// Runda 13, r2: när demon är full visas en sida som förklarar läget och försöker igen av sig själv (demo-full.js).
krokar.vidFull = (e) => { ramNyckel = null; demoFull.visa(e.data, forsokIgenFull); };
async function forsokIgenFull() {
  S.session = await api('/api/session', { tyst: true });
  demoFull.stang();
  ramNyckel = null;
  miljorad(S.session.miljo);
  await uppdateraInkorg();
  rita();
}

// Ett anrop som avbröts vid utloggning är inget fel. Omritningar efter en sparad ändring väntas inte alltid in,
// så avbrottet fångas här i stället för i varje vy. Alla andra fel släpps igenom.
window.addEventListener('unhandledrejection', (e) => { if (e.reason?.kod === 'avbruten') e.preventDefault(); });
// Min journal får aldrig läsläge eller läskopia (D4 gäller personalen).
krokar.ejLaslage = () => arInvanare();

export async function uppdateraInkorg() {
  if (!arPersonal() || utanJournal()) { S.inkorg = null; return; }
  try {
    const d = await api('/api/inkorg', { tyst: true });
    S.inkorg = d.osigneradeAnteckningar.length + d.okvitteradeSvar.length + d.larm.length + d.nllAvvikelser.length + (d.dubbletter?.length ?? 0) + (d.kontrasigneringar?.length ?? 0) + (d.aterlamnanden?.length ?? 0)
      + (d.delegeringarSomGarUt?.length ?? 0)
      // Återinsättning efter uppehåll med antikoagulantia (runda 5, r4).
      + (d.aterinsattningar?.length ?? 0)
      // Vårdhändelser som avbokades eftersom remissen avvisades (runda 5, r4).
      + (d.avbokadeVardhandelser?.length ?? 0)
      // NEWS2 som kräver åtgärd (runda 6, r1).
      + (d.news2Larm?.length ?? 0)
      // Runda 6, r3: tvångsvård, vårdplaner och samordnad planering.
      + inkorgAntal(d)
      // Läkemedelsprocessen, del 2 (runda 6, r2).
      + (d.lakemedelsuppfoljningar?.length ?? 0) + (d.muntligaAttSignera?.length ?? 0) + (d.fordjupadeGenomgangar?.length ?? 0) + (d.licenserSomGarUt?.length ?? 0)
      // Mallar att godkänna (runda 6, r6).
      + (d.mallarAttGodkanna?.length ?? 0)
      // Runda 11, r4: regimversioner att godkänna och patienternas rapporter om cytostatika.
      + (d.cytoRegimversioner?.length ?? 0) + (d.cytoRapporter?.length ?? 0)
      // Egna bevakningar som har löpt ut (runda 6, r4).
      + (d.egnaBevakningar?.length ?? 0)
      // Rättningar före rapportering till myndigheter och register (runda 7, r5).
      + (d.rapportfel?.length ?? 0)
      // Runda 7, r6: barnhälsovården.
      + (d.tillvaxtLarm?.length ?? 0) + (d.hemmatningarAttBekrafta?.length ?? 0) + (d.bhvAttBoka?.length ?? 0)
      // Runda 8, r2: remisser att signera på uppdrag och remisser fördelade till läkaren.
      + (d.remisserAttSignera?.length ?? 0) + (d.remisserAttBedoma?.length ?? 0)
      // Runda 10, r6: beslut på uppdrag att kvittera.
      + (d.beslutAttKvittera?.length ?? 0) + (d.blodAvvikelser?.length ?? 0)
      // Runda 8, r1: beställning och svar.
      + labbInkorgAntal(d)
      // Runda 9, r1: beredningar att kontrollera.
      + (d.beredningarAttKontrollera?.length ?? 0)
      // Runda 10, r5: kollegakontroller och läkemedelsberättelser att kvittera.
      + (d.kollegakontrollerAttGora?.length ?? 0) + (d.lakemedelsoverforingar?.length ?? 0)
      // Runda 10, r4: förslag om donation till de donationsansvariga.
      + (d.donationsforslag?.length ?? 0);
  } catch { S.inkorg = null; }
  const el = document.querySelector('[data-raknare="inkorg"]');
  if (el) { el.textContent = S.inkorg ? String(S.inkorg) : ''; el.hidden = !S.inkorg; }
  const sr = document.querySelector('[data-raknare-text="inkorg"]');
  if (sr) sr.textContent = S.inkorg ? `, ${S.inkorg} att hantera` : '';
}

function menyHtml(route) {
  return MENY.filter(m => m[3]()).map(([h, t, ik, , rakn]) => {
    const aktiv = route === h || route.startsWith(h + '/') || route.startsWith(h + '?');
    const r = rakn === 'inkorg' ? `<span class="raknare" data-raknare="inkorg" aria-hidden="true"${S.inkorg ? '' : ' hidden'}>${S.inkorg ?? ''}</span><span class="sr" data-raknare-text="inkorg">${S.inkorg ? `, ${S.inkorg} att hantera` : ''}</span>` : '';
    return `<li><a href="${h}"${aktiv ? ' aria-current="page"' : ''}>${ikon[ik]}<span class="menytext">${esc(t)}</span>${r}</a></li>`;
  }).join('');
}

let ramNyckel = null;
function ritaRam(route) {
  const sess = S.session;
  const ram = document.getElementById('ram');
  const nyckel = arPersonal() ? sess.personal.id : arInvanare() ? `invanare:${sess.invanare.id}` : 'ute';
  if (ramNyckel === nyckel && document.getElementById('innehall')) {
    const nav = document.getElementById('meny-lista');
    if (nav) nav.innerHTML = menyHtml(route);
    return document.getElementById('innehall');
  }
  ramNyckel = nyckel;
  if (!sess?.inloggad) {
    ram.innerHTML = `<header class="topp"><div class="topp-inre">
        <a class="varumarke" href="#/">${logotyp()}<span><span class="namn">Vårdkällan</span><span class="under">Hela vården i ett öppet system</span></span></a>
        <nav class="topp-lankar" aria-label="Om Vårdkällan"><a href="#/testa">Testa och jämför</a><a href="#/om">Om demon</a><a href="#/krav">Kravspårbarhet</a><a href="#/moduler">Moduler</a><a href="#/drift">Svarstider</a><a href="#/">Logga in</a></nav>
      </div></header>
      <main id="innehall" class="innehall ute" tabindex="-1"></main>`;
    return document.getElementById('innehall');
  }
  if (arInvanare()) return ritaRamInvanare(ram, sess);
  const p = sess.personal;
  const e = sess.enhet;
  ram.innerHTML = `<header class="topp"><div class="topp-inre">
      <a class="varumarke" href="${hem()}">${logotyp()}<span><span class="namn">Vårdkällan</span><span class="under">Hela vården i ett öppet system</span></span></a>
      <button type="button" class="menyknapp" data-a="meny" aria-expanded="false" aria-controls="meny">${ikon.meny}<span>Meny</span></button>
      <div class="inloggad" aria-label="Inloggad person">
        <span class="kort-ikon" aria-hidden="true">${ikon.kort}</span>
        <span class="vem"><strong>${esc(p.namn)}</strong><span>${esc(p.titel)}, ${esc(e.namn)}</span></span>
      </div>
      ${skanner.faltHtml()}
      <a class="svarstid" id="svarstid" href="#/drift">${svarstidHtml()}</a>
      ${utanJournal() ? '' : `<button type="button" class="knapp text liten reservknapp" data-a="reservkod">${ikon.nyckel}<span data-reserv-text>Reservkod</span></button>`}
      ${flerfaktorLank(sess)}
      <button type="button" class="knapp sekundar liten" data-a="loggaut">${ikon.ut}<span>Logga ut</span></button>
    </div></header>
    <div id="nyhetsruta"></div>
    <div class="arbetsyta">
      <nav class="meny" id="meny" aria-label="Huvudmeny"><ul id="meny-lista">${menyHtml(route)}</ul></nav>
      <main id="innehall" class="innehall" tabindex="-1"></main>
    </div>`;
  avbrottslage.uppdateraReservStatus();
  // Runda 7, r2: nyheterna för rollen efter en ny version, en gång per inloggning och ram.
  nyhetsruta.visa();
  return document.getElementById('innehall');
}

// Min journal har en egen ram: ingen meny för personalen, ingen svarstid och inget läsläge, bara invånarens journal.
function ritaRamInvanare(ram, sess) {
  ram.innerHTML = `<header class="topp topp-min"><div class="topp-inre">
      <a class="varumarke" href="#/min">${logotyp()}<span><span class="namn">Min journal</span><span class="under">Vårdkällan för invånare</span></span></a>
      <div class="inloggad" aria-label="Inloggad person">
        <span class="kort-ikon" aria-hidden="true">${ikon.person}</span>
        <span class="vem"><strong>${esc(sess.invanare.namn)}</strong><span>Inloggad med e-legitimation (simulerad)</span></span>
      </div>
      ${flerfaktorLank(sess)}
      <button type="button" class="knapp sekundar liten" data-a="loggaut">${ikon.ut}<span>Logga ut</span></button>
    </div></header>
    <div id="nyhetsruta"></div>
    <main id="innehall" class="innehall min-innehall" tabindex="-1"></main>
    <nav class="min-om" aria-label="Om Vårdkällan"><p>Min journal är en del av Vårdkällan, ett öppet journalsystem.</p><ul><li><a href="#/krav">Kravspårbarhet</a></li><li><a href="#/moduler">Moduler</a></li><li><a href="#/drift">Svarstider</a></li><li><a href="#/nyheter">Nyheter</a></li><li><a href="#/om">Om demon och testet</a></li></ul></nav>`;
  nyhetsruta.visa();
  return document.getElementById('innehall');
}

let navNr = 0;
let forstaVisning = true;
export const aktuellNav = () => navNr;

export async function rita() {
  const nr = ++navNr;
  demoknappar();
  const route = location.hash || '#/';
  const [vag, fraga = ''] = route.split('?');
  const q = new URLSearchParams(fraga);
  let traff = null;
  for (const [re, vy, villkor, offentlig] of RUTTER) {
    const m = vag.match(re);
    if (m) { traff = { vy, villkor, offentlig, param: m.slice(1).map(x => (x == null ? x : decodeURIComponent(x))) }; break; }
  }
  if (!S.session?.inloggad) {
    if (!traff?.offentlig) {
      if (vag !== '#/' && vag !== '#' && vag !== '') { history.replaceState(null, '', '#/'); }
      const main = ritaRam('#/');
      return visaVy(inloggning, main, [], q, nr);
    }
    const main = ritaRam(vag);
    return visaVy(traff.vy, main, traff.param, q, nr);
  }
  if (arInvanare()) {
    let min = null;
    for (const [re, vy] of RUTTER_MIN) {
      const m = vag.match(re);
      if (m) { min = { vy, param: m.slice(1).map(x => (x == null ? x : decodeURIComponent(x))) }; break; }
    }
    if (!min) { location.replace('#/min'); return; }
    return visaVy(min.vy, ritaRam(vag), min.param, q, nr);
  }
  if (!traff || !traff.villkor()) {
    if (traff && !traff.villkor()) notis('Den sidan hör inte till din yrkesroll.', 'info');
    location.replace(hem());
    return;
  }
  const main = ritaRam(vag);
  document.getElementById('meny')?.classList.remove('oppen');
  document.querySelector('[data-a="meny"]')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('meny-oppen');
  return visaVy(traff.vy, main, traff.param, q, nr);
}

async function visaVy(vy, main, param, q, nr) {
  const forraVy = main.dataset.vy;
  const vyNamn = vy.namn ?? '';
  // Inom patientjournalen och Min journal byts bara fliken; fokus flyttas inte till sidans början.
  const journal = (vyNamn === 'patient' || vyNamn === 'min') && param[0];
  const sammaPatient = Boolean(journal) && forraVy === `${vyNamn}:${param[0]}`;
  main.dataset.vy = journal ? `${vyNamn}:${param[0]}` : vyNamn;
  try {
    await vy.visa(main, param, q, { aktuell: () => nr === navNr, sammaPatient });
  } catch (e) {
    if (nr !== navNr) return;
    if (e?.status === 401 || e?.kod === 'avbruten') return;
    console.warn('Vyn kunde inte visas:', e);
    main.innerHTML = `<div class="vyhuvud"><h1 tabindex="-1">Det gick inte att visa sidan</h1></div><div class="ruta ruta-info"><p>${esc(e?.message ?? 'Okänt fel.')}</p><p><a href="${S.session?.inloggad ? hem() : '#/'}">Gå till startsidan</a></p></div>`;
  }
  if (nr !== navNr) return;
  // Vid första laddningen ligger fokus kvar i början av sidan, så att länken till innehållet nås först.
  // En vy kan peka ut ett fält med data-fokus (sökfältet), annars får rubriken fokus.
  if (forstaVisning) forstaVisning = false;
  else if (!sammaPatient) {
    const mal = main.querySelector('[data-fokus]') ?? main.querySelector('h1');
    (mal ?? main).focus({ preventScroll: false });
    window.scrollTo(0, 0);
  }
  document.title = `${main.querySelector('h1')?.textContent?.trim() || 'Start'}, Vårdkällan`;
  // Läskopian för avbrott förnyas när en patient har öppnats, annars högst en gång i minuten. Bara för personalen.
  if (arPersonal()) avbrottslage.fornya({ nu: vyNamn === 'patient' });
  // Runda 12, r3 (Sussa KD1.1.4.10): personalens fönster följer varandra när en patient öppnas.
  if (arPersonal()) {
    flera.starta(S.session.personal.id);
    const pid = vyNamn === 'patient' && param[0] && main.querySelector('.patientband h1') ? param[0] : null;
    flera.patient(pid, pid ? main.querySelector('.patientband h1')?.textContent?.trim() ?? '' : '');
    if (pid && !main.querySelector('[data-fonster-rad]')) {
      const flikar = main.querySelector('.flikar');
      if (flikar) { flikar.insertAdjacentHTML('afterend', flera.radHtml(pid)); flera.kopplaRad(main.querySelector('[data-fonster-rad]')); }
    }
  } else flera.stoppa();
  // Runda 13, r1: panelen med uppdragen frågar om något uppdrag har blivit gjort.
  testinbjudan.efterVy();
}

// Demoknappen Simulera avbrott visas för den som är inloggad, och inte under ett avbrott.
export function demoknappar() {
  const b = document.querySelector('[data-a="avbrott"]');
  if (b) b.hidden = !arPersonal() || avbrott.simulerat || avbrott.aktivt;
}

// Runda 12, r3: länken till inloggning och flerfaktor i sidhuvudet, med en bock när flerfaktor är på.
function flerfaktorLank(sess) {
  const pa = Boolean(sess?.flerfaktor?.aktiv);
  return `<a class="knapp text liten flerfaktor-lank" href="#/flerfaktor" data-flerfaktor="${pa ? 'pa' : 'av'}">${ikon.skold}<span>${pa ? 'Flerfaktor på' : 'Flerfaktor'}</span></a>`;
}

// Runda 12, r3: när personen har flerfaktor väntar inloggningen på den andra faktorn. Avbryter personen blir ingen
// inloggad, och den förra inloggningen i webbläsaren är redan avslutad på servern.
async function medAndraFaktorn(s, forra = null) {
  if (!s?.flerfaktor?.kravs) return s;
  // Ingen är inloggad medan den andra faktorn väntar, och svar på äldre anrop gäller inte längre.
  nySession();
  S.session = { inloggad: false };
  const klar = await andraFaktorn(s.flerfaktor, s.flerfaktorVantar?.namn);
  if (!klar?.inloggad) {
    // Den förra personens läskopia gäller inte längre, eftersom servern har avslutat den inloggningen.
    await avbrottslage.rensa({ personalId: forra }).catch(() => {});
    nySession();
    S.session = { inloggad: false };
    S.inkorg = null;
    ramNyckel = null;
    rita();
    return null;
  }
  return klar;
}

export async function loggaIn(personalId, knapp) {
  // Runda 7, r2: en förnyelse av läskopian för den förra inloggningen får inte fortsätta.
  avbrottslage.stoppaFornyelse();
  const forra = S.session?.personal?.id ?? null;
  const s = await medAndraFaktorn(await medKnapp(knapp, () => api('/api/login', { metod: 'POST', data: { personalId } })), forra);
  if (!s) return;
  nySession();
  S.session = s;
  // Ny inloggning, ny nyckel: en tidigare persons läskopia raderas, och personens reservkopia från en tidigare
  // inloggning också, eftersom den inte går att förnya utan reservkoden.
  const { reservBorttagen } = await satNyckel(s.lasnyckel, s.personal.id).catch(() => ({}));
  avbrottslage.fornya({ nu: true });
  ramNyckel = null;
  document.getElementById('notiser').replaceChildren();
  // Åtkomster från läsläget som väntar på datorn skickas också vid inloggning.
  avbrottslage.skickaLoggar().then(avbrottslage.meddelaLogg).catch(() => {});
  if (reservBorttagen) notis('Din reservkopia från förra inloggningen är raderad. Välj en ny reservkod om du vill kunna läsa vid ett avbrott.', 'info');
  await Promise.all([uppdateraInkorg(), laddaEnheter().catch(() => {})]);
  if (location.hash === hem()) rita(); else location.hash = hem();
}

// Inloggning i Min journal. En läskopia som personal har lämnat i webbläsaren raderas, eftersom invånaren aldrig får en.
// Åtkomster från läsläget som väntar på datorn skickas först, och den förra personens reservkopia raderas.
export async function loggaInInvanare(invanareId, knapp) {
  avbrottslage.stoppaFornyelse();
  const forra = S.session?.personal?.id ?? null;
  const loggen = await avbrottslage.skickaLoggar().catch(() => null);
  const s = await medAndraFaktorn(await medKnapp(knapp, () => api('/api/login/invanare', { metod: 'POST', data: { invanareId } })), forra);
  if (!s) return;
  nySession();
  S.session = s;
  S.inkorg = null;
  await avbrottslage.rensa({ personalId: forra }).catch(() => {});
  ramNyckel = null;
  document.getElementById('notiser').replaceChildren();
  avbrottslage.meddelaLogg(loggen);
  if (location.hash === hem()) rita(); else location.hash = hem();
}

// Utloggning. Används av knappen Logga ut och av användartestet när uppgifterna är klara.
export async function loggaUt({ text = null } = {}) {
  // Runda 7, r2: förnyelsen av läskopian stoppas först, så att inget anrop når servern efter utloggningen.
  avbrottslage.stoppaFornyelse();
  tidsgrans.stopp();
  avbrytAllaAnrop();
  if (avbrott.aktivt) {
    const klarPaServern = await avbrottslage.loggaUtUnderAvbrott();
    S.session = { inloggad: false };
    S.inkorg = null;
    ramNyckel = null;
    document.getElementById('notiser').replaceChildren();
    notis(klarPaServern ? 'Du är utloggad och läskopian är raderad.' : 'Du är utloggad i den här fliken och läskopian är raderad. Sessionen på servern loggas ut när förbindelsen är tillbaka, även om fliken stängs.', 'info');
    if (location.hash === '#/') rita(); else location.hash = '#/';
    return;
  }
  // Åtkomster från läsläget som väntar på datorn skickas före utloggningen. Personens reservkopia raderas.
  const vem = S.session?.personal?.id ?? null;
  const loggen = await avbrottslage.skickaLoggar().catch(() => null);
  try { await api('/api/logout', { metod: 'POST', data: {} }); } catch (err) { felNotis(err); }
  await avbrottslage.rensa({ personalId: vem }).catch(() => {});
  S.session = { inloggad: false };
  S.inkorg = null;
  ramNyckel = null;
  // Nästa person ska inte se föregående persons meddelanden.
  document.getElementById('notiser').replaceChildren();
  if (text) notis(text, 'info', { kvar: true }); else notis('Du är utloggad.', 'info');
  avbrottslage.meddelaLogg(loggen);
  if (location.hash === '#/') rita(); else location.hash = '#/';
}

// Ny sandlåda med patienterna som i seeden. Inloggningen behålls.
export async function aterstallDemo(knapp = null) {
  const s = await medKnapp(knapp, () => api('/api/reset', { metod: 'POST', data: {} }));
  const { ok, ...sess } = s;
  S.session = sess;
  notis('Demon är återställd. Alla ändringar är borta och patienterna är som från början.');
  ramNyckel = null;
  await uppdateraInkorg();
  rita();
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a;
  if (a === 'loggaut') {
    await loggaUt();
  } else if (a === 'aterstall') {
    try { await aterstallDemo(b); } catch { /* notis visad */ }
  } else if (a === 'reservkod') {
    await avbrottslage.valjReservkod();
  } else if (a === 'avbrott') {
    await avbrottslage.simulera();
    notis('Avbrottet är simulerat. Den här fliken beter sig som om servern var nere. Servern är igång för alla andra.', 'info');
  } else if (a === 'kontrast') {
    // Runda 7, r2: högkontrastläget.
    kontrast.vaxla();
  } else if (a === 'tillbaka-miljo') {
    // Runda 9, r5: tillbaka till produktionsmiljön, som sidan laddas om i.
    try { await medKnapp(b, () => api('/api/miljoer/tillbaka', { metod: 'POST', data: {} })); location.href = '/'; } catch { /* notis visad */ }
  } else if (a === 'stang-nyheter') {
    try { await nyhetsruta.stang(b); } catch { /* notis visad */ }
  } else if (a === 'meny') {
    const nav = document.getElementById('meny');
    const oppen = nav.classList.toggle('oppen');
    b.setAttribute('aria-expanded', String(oppen));
    // Runda 13, r4: på en smal skärm visas skannern, reservkoden, flerfaktorn och svarstiden när menyn är öppen.
    document.body.classList.toggle('meny-oppen', oppen);
  }
});

window.addEventListener('hashchange', () => rita());

// Runda 9, r5 (KD1.1.1.5): märkningen av en acceptanstest-, utbildnings- eller testmiljö överst på varje sida, med
// vägen tillbaka till produktionsmiljön. Produktionsmiljön har ingen märkning utöver demoraden.
function miljorad(m) {
  const el = document.getElementById('miljorad');
  if (!el || !m || m.typ === 'produktion') return;
  el.innerHTML = `<p><strong>${esc(m.text)}.</strong> ${esc(m.beskrivning)}</p><button type="button" class="knapp liten sekundar" data-a="tillbaka-miljo">Tillbaka till produktionsmiljön</button>`;
  el.hidden = false;
  document.title = `${m.kort}: Vårdkällan`;
}

async function start() {
  avbrottslage.init();
  anvandartest.init();
  // Runda 13, r1: knappen Lämna synpunkt och panelen med uppdragen.
  testinbjudan.init();
  try {
    S.session = await api('/api/session', { tyst: true });
    miljorad(S.session.miljo);
    // Åtkomster från ett tidigare läsläge som finns kvar på datorn, till exempel för att fliken stängdes, skickas nu.
    if (!avbrott.aktivt) avbrottslage.meddelaLogg(await avbrottslage.skickaLoggar().catch(() => null));
    if (!avbrott.aktivt) await avbrottslage.slutforUtloggning().catch(() => {});
    if (arPersonal()) await laddaEnheter().catch(() => {});
    if (arPersonal() && !avbrott.aktivt) await satNyckel(S.session.lasnyckel, S.session.personal.id).catch(() => {});
    if (!arPersonal() && !avbrott.aktivt) await avbrottslage.rensa().catch(() => {});
  } catch (e) {
    S.session = { inloggad: false };
    // Runda 13, r2: sidan som säger att demon är full visas redan och försöker igen av sig själv.
    if (e.kod === 'demo_full') return;
    // Under ett avbrott förklarar avbrottsraden och reservinloggningen läget.
    if (e.status !== 429 && !avbrott.aktivt) felNotis(e);
  }
  await uppdateraInkorg();
  rita();
}
start();
