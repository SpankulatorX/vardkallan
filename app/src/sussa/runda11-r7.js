// Runda 11, r7: testnamnen för intensivvården och tillväxten i version 1.1 (app/test/iva-r11.test.js och
// app/test/tillvaxt-r11.test.js) och klickbudgetens nya flöden, för mappningen av Sussa 4.1 och 4.6.
import { klickbudgetTest } from '../krav.js';
import { FLODEN } from '../klickbudget.js';

const IV = 'Intensivvård, version 1.1 > ';
const TV = 'Tillväxt, version 1.1 > ';
const kb = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));

export const IVA = {
  vagform: `${IV}realtidsvisningen har vågformer som följer pulsen, blodtrycket och andningen, och samma tid ger samma kurva`,
  realtid: `${IV}realtidsvisningen kräver en kopplad monitor, larmar mot patientens gränser och loggas en gång per session`,
  regelAnalys: `${IV}patientens egen gräns prövas i analysen, och en mildare gräns gör avdelningens larm till en observation i stället för att tysta det`,
  regelApi: `${IV}läkaren sätter patientens egna gränser, servern prövar typ och gräns, och en ny regel avslutar den förra`,
  sparr: `${IV}en regel, ett andningsstöd, ett mål och NEMS på en spärrad vårdenhet röjs inte och påverkar varken larm eller förslag`,
  begransning: `${IV}behandlingsbegränsningar står överst i översikten och i överrapporteringen, som systemet skriver enligt SBAR`,
  perspiratio: `${IV}perspiratio räknas ur vikten, febern och andningsstödet, och dygnsbrytningen kl. 06 följer svensk tid också vid omställningen`,
  mal: `${IV}läkaren sätter mål för vätska, energi och vikt, och systemet visar aktuellt underskott och rekommendationer, också för elektrolyterna`,
  nems: `${IV}NEMS föreslås ur journalen med orsak för varje post, sjuksköterskan bekräftar, och servern räknar poängen`,
  doser: `${IV}infusionerna har en sammanräkning av givna doser det senaste dygnet och sedan starten`,
  nyheter: `${IV}nyheterna i version 1.1 för intensivvården och tillväxten visas för rätt roller`,
  overrapporteringSparr: `${IV}överrapporteringen röjer varken orsak eller tid för en vårdkontakt på en spärrad vårdenhet eller på en annan vårdenhet utan aktivt val`,
  kbNems: kb('iva-nems'),
};
export const TILLVAXT = {
  who2007: `${TV}WHO:s referens 5 till 19 år räknas ur tabellen, och systemet väljer referens efter åldern`,
  byte: `${TV}referenserna som inte får användas fritt står med skälet, och användaren kan byta referens i kurvorna`,
  sitthojd: `${TV}sitthöjd registreras med K11:s kod och visas som kurva utan referens, och K11:s koder är kontrollerade mot Snomed CT`,
  pubertet: `${TV}pubertet registreras med de stadier som gäller barnets kön, och systemet räknar starten och varnar för tidig pubertet`,
  granska: `${TV}en fil förhandsgranskas innan något sparas, och en fil för en annan patient, orimliga värden och för stora filer avvisas`,
  importera: `${TV}inläsningen sparar ursprunget som det var, och den som läser in står aldrig som den som mätte`,
  journalsystem: `${TV}det simulerade journalsystemet svarar på GetObservations, och svaret granskas och läses in som en fil`,
  kontrakt: `${TV}GetObservations och GetActivities svarar med samma behörighet som FHIR`,
  indikatorer: `${TV}barnavårdscentralen väljer sina indikatorer, och regionen ser dem med varje liten cell spärrad för sig`,
  sparr: `${TV}en pubertetsregistrering på en spärrad vårdenhet syns inte och ändrar inte bedömningen`,
  kbImport: kb('tillvaxt-import'),
};

const DEMO = 'Hjärtintensiven på Kardiologiska kliniken är demons intensivvårdsavdelning med åtta platser. Reglerna och protokollen är demoregler, inte kliniskt beslutsstöd, och utrustningen är simulerad. Specialområdet sköts upp i Tilläggsavtal 3.';

// Tilläggen per post i 4.6. tester läggs till postens egna, och de andra fälten ersätter postens.
const POSTER_IVA = {
  '4.6.1.1': {
    tester: [IVA.realtid, IVA.regelApi, IVA.mal, IVA.nems, IVA.begransning, IVA.nyheter],
    losning: 'Intensivvården har en egen sida och en flik i journalen med översikt, övervakning och realtid med vågformer från monitorn, analys mot fördefinierade parametrar och patientens egna gränser, behandlingsbegränsningar och överrapportering, anestesibedömning, kontinuerliga infusioner med titrering och sammanräkning av givna doser, timvis vätskebalans med perspiratio, prognos och behandlingsmål, andningsstöd, vårdtyngd enligt NEMS och uppföljning, byggda på mätvärdena, utrustningen, läkemedlen och vätskebalansen som redan finns.',
    anmarkning: `${DEMO} Operationsplanering, anestesijournal under ingreppet, uppvakningsavdelning och scoring som SAPS 3 saknas. Vasoaktiva läkemedel och sedering saknas i läkemedelskatalogen.`,
  },
  '4.6.1.2': {
    tester: [IVA.vagform, IVA.realtid, IVA.begransning, IVA.sparr], avsedd: 'uppfyllt_demo',
    losning: 'Översikten visar alla patienter på intensivvårdsavdelningen med senaste värdena, NEWS2, larm och förslag, behandlingsbegränsningar, egna gränser, vårdtyngd, kopplad utrustning, infusioner och vätskebalans, med de mest akuta först. Övervakningen per patient, på sidan Intensivvård och som flik i journalen, har realtid från den kopplade monitorn: EKG, artärtryck, pletysmografi och andning som vågformer de senaste åtta sekunderna, de aktuella siffrorna och monitorns larm, uppdaterade var tredje sekund med en knapp för paus. Under realtiden finns täta värden var femte minut med kurvor över de senaste timmarna där monitorns värden är märkta.',
    expert: 'Systemet sorterar själv patienterna efter larm, ritar vågformerna från monitorn och larmar mot de gränser som gäller för patienten, så att den som går in på avdelningen ser vem som behöver hjälp först och vad monitorn visar vid sängen.',
    anmarkning: `${DEMO} Monitorn är simulerad: vågformerna och realtidsvärdena räknas fram ur samma grundvärden som monitorn skickar till journalen och sparas inte.`,
  },
  '4.6.1.3': {
    tester: [IVA.regelAnalys, IVA.regelApi, IVA.sparr, IVA.begransning, IVA.realtid, IVA.overrapporteringSparr], avsedd: 'uppfyllt_demo',
    losning: 'Fördefinierade parametrar med gränser och trender prövas av systemet mot de senaste godkända värdena och omsätts i larm, varningar och förslag med vad som ska göras. Läkaren sätter egna gränser och regler per patient (parameter, under eller över, gräns, antal värden i rad, larm eller varning, åtgärd och motivering). En egen gräns ersätter avdelningens i samma riktning, men en mildare gräns tystar aldrig avdelningens larm: det blir en observation med motiveringen. Monitorn larmar efter samma gränser. Behandlingsbegränsningar ur uppmärksamhetsinformationen står överst, och systemet skriver underlaget för överrapportering enligt SBAR. Patientens namn och personnummer står på varje vy.',
    expert: 'Systemet prövar reglerna själv vid varje visning, visar avdelningens gräns medan läkaren skriver en egen, avgör om den ersätter eller läggs till och förklarar vad som ändras, och skriver överrapporteringen ur det som redan finns.',
    anmarkning: `${DEMO} Avdelningens gränser för medelartärtryck, syremättnad, trendfönster och oliguri är parametrar som systemförvaltaren ändrar med fyra ögon.`,
  },
  '4.6.1.5': {
    tester: [IVA.doser],
    losning: 'Läkaren ordinerar en kontinuerlig infusion i sprutpump ur ett protokoll med dos per kilo och timme, koncentration, intervall, bolusdos och högsta dygnsdos. Systemet räknar hastigheten i ml/h på den godkända vikten, föreslår titrering efter mätvärden inom det ordinerade intervallet och visar infusionerna, bolusarna och vätskorna i en gemensam vy. Sjuksköterskan titrerar med ett klick, och pumpens doser registreras och kontrolleras. Systemet räknar samman givna doser det senaste dygnet och sedan starten ur titreringarna och bolusarna, och säger till när dygnsdosen är överskriden.',
    anmarkning: `${DEMO} Det finns ett protokoll, morfin. Vasoaktiva läkemedel och sedering saknas eftersom de inte finns i demons läkemedelskatalog. Produkterna Noradrenalin Abcur, Propofol-Lipuro, Midazolam Panpharma och Furix är kontrollerade mot NPL 2026-11-10, men förpackningarna som katalogen kräver är inte inlästa.`,
  },
  '4.6.1.6': {
    tester: [IVA.perspiratio, IVA.mal, IVA.sparr], avsedd: 'uppfyllt_demo',
    losning: 'Vätskebalansen räknas timvis och kumulativt det senaste dygnet, med urin och dränage per timme, urin i ml per kilo och timme och varning för oliguri. Volymen från infusioner och pumpar räknas in av sig själv. Systemet räknar perspiratio genom huden och andningen ur den godkända vikten, febern och andningsstödet med befuktning, och visar balansen med perspiratio, prognosen till dygnsbrytningen kl. 06 med infusionerna i ml/h och förlusterna i samma takt som de senaste sex timmarna, och läkarens behandlingsmål för vätskebalans, energi och vikt med aktuellt underskott och rekommendationer, också för kalium och natrium.',
    expert: 'Systemet räknar balansen, perspiratio och prognosen själv, säger hur långt patienten är från målet och hur mycket balansen behöver ändras per timme, så att ingen behöver summera listor eller räkna med vikten.',
    anmarkning: `${DEMO} Perspiratio, prognosen och rekommendationerna är demoregler.`,
  },
  '4.6.1.7': {
    tester: [IVA.nems, IVA.kbNems, IVA.sparr], avsedd: 'uppfyllt_demo',
    losning: 'Uppföljningen per intensivvårdsavdelning visar vårddygn, vårdtillfällen, beläggning, medelvårdtid, vårdtyngd (andel vårddygn med kopplad monitor och med kontinuerlig infusion, och vårdtyngd enligt NEMS med medelpoäng, poster och andel registrerade vårddygn) och kvalitetsindikatorer, utan personuppgifter. Sjuksköterskan registrerar NEMS per vårddygn med ett klick, eftersom systemet föreslår posterna ur journalen.',
    expert: 'Systemet kryssar själv i de NEMS-poster som står i journalen, skriver varför och räknar poängen, och räknar uppföljningen ur det som redan dokumenteras.',
    anmarkning: `${DEMO} NEMS-posternas förslag är demoregler. Rapportering till Svenska Intensivvårdsregistret finns inte.`,
  },
};
const POSTER_TILLVAXT = {
  '4.1.1.2': {
    tester: [TILLVAXT.who2007, TILLVAXT.byte],
    losning: 'Kurvorna bygger på WHO:s tillväxtstandard 0 till 5 år och WHO:s tillväxtreferens 5 till 19 år (L, M och S per månad för vikt till tio år, längd och BMI). Systemet väljer referens efter barnets ålder och går mjukt över mellan dem vid fem år. För ett barn som är fött före vecka 37 räknas korrigerad ålder till två år.',
    anmarkning: 'De svenska referenserna, prematurkurvorna (Fenton 2013 och INTERGROWTH-21st) och kurvorna för Downs och Turners syndrom finns inte utgivna under en fri licens med maskinläsbara värden och används inte (docs/kodkontroll.md). WHO:s tabeller används under CC BY-NC-SA 3.0 IGO.',
  },
  '4.1.1.3': {
    tester: [TILLVAXT.who2007, TILLVAXT.byte],
    losning: 'Två referenser finns: WHO:s tillväxtstandard 0 till 5 år och WHO:s tillväxtreferens 5 till 19 år, med kurvor för vikt, längd, huvudomfång (till fem år) och BMI och linjerna -2, -1, 0, +1 och +2 SD. Referenserna ligger i egna tabeller med källa och licens. I gränssnittet väljs WHO efter barnets ålder, eller en av referenserna, och referenserna som inte finns står med skälet.',
    anmarkning: 'Svenska referenser, prematurkurvor och kurvor för syndrom saknas, eftersom de inte får användas fritt (docs/kodkontroll.md).',
  },
  '4.1.1.4': {
    tester: [TILLVAXT.sitthojd, TILLVAXT.pubertet, TILLVAXT.sparr], avsedd: 'uppfyllt_demo',
    losning: 'Vikt, längd, huvudomfång och sitthöjd registreras i ett formulär vid besöket, i en transaktion med samma tid och vårdkontakt. Födelseuppgifter, föräldrarnas längd och pubertet enligt Tanners stadier registreras som egna uppgifter. Alla observationer i K11 har registrets Snomed CT-kod, sitthöjd med 248335006, och koderna är kontrollerade mot SNOMED CT International Edition 20250201. Vårdnadshavaren kan skicka en mätning från hemmet som barnavårdscentralen bekräftar.',
    expert: 'Systemet sätter tid, kod, enhet och vårdkontakt, prövar värdet mot rimliga gränser, visar bara de pubertetsmått som gäller barnets kön och sitthöjd från två års ålder, och knyter mätningen till rätt besök i programmet.',
    anmarkning: 'Kroppslängdens kod i K11 (248334005) är inaktiv i den internationella utgåvan sedan 2021 och står kvar som i K11, eftersom registret tar emot K11:s koder. Koderna i den svenska utgåvan kontrolleras bara med kontrollsiffran, eftersom den kräver licens.',
  },
  '4.1.1.6': {
    tester: [TILLVAXT.byte, TILLVAXT.sitthojd, TILLVAXT.pubertet], avsedd: 'uppfyllt_demo',
    losning: 'Kurvorna ritas som SVG med referenslinjerna -2, -1, 0, +1 och +2 SD och kan visas för barnets ålder, första året, två år, fem år och för större barn tio och 19 år. Användaren väljer referens och vilka mått som visas. Varje kurva har en tabell med datum, ålder, värde, SD, percentil och källa, också för inlästa värden. Särskilda händelser och pubertetens stadier med start och bedömning visas. För för tidigt födda räknas korrigerad ålder till två år. Vårdnadshavaren ser samma kurvor i Min journal.',
    expert: 'Systemet väljer ålderspannet och referensen efter barnets ålder, visar SD och percentil vid varje värde och räknar när puberteten började, så att avvikelsen syns utan att någon räknar.',
    anmarkning: 'Prematurkurvor finns inte av licensskäl (4.1.1.2). För tidigt födda visas med korrigerad ålder på WHO:s kurvor.',
  },
  '4.1.1.7': {
    tester: [TILLVAXT.granska, TILLVAXT.importera, TILLVAXT.journalsystem, TILLVAXT.kontrakt, TILLVAXT.kbImport], avsedd: 'uppfyllt_demo',
    losning: 'Export till Svenska barnhälsovårdsregistret enligt K11 med kontroll före utskicket. Mätvärdena finns i FHIR som Observation och genom tjänstekontrakten GetObservations och GetActivities. Import från en fil (FHIR Bundle eller CSV) eller från ett annat journalsystem genom GetObservations: systemet granskar varje värde, kontrollerar att filen gäller barnet och visar vad som redan finns innan något sparas, och ursprunget sparas som det var.',
    expert: 'Systemet avgör filens format, kontrollerar identiteten, prövar varje värde mot rimliga gränser och barnets kurva och läser bara in det som är nytt, så att användaren bara bekräftar.',
    anmarkning: 'Registret, det andra journalsystemet och tjänstekontrakten är simulerade, utan den nationella tjänsteplattformen.',
  },
  '4.1.1.8': {
    tester: [TILLVAXT.indikatorer], avsedd: 'uppfyllt_demo',
    losning: 'Uppföljningen på barnavårdscentralen visar besöken i programmet och vaccinationstäckningen, och barnavårdscentralen väljer sina indikatorer ur en katalog: besök i tid, besök med alla mått, vaccinationer i tid, födelsedata, föräldrarnas längd, risk för tuberkulos, mätningar hemma som hanteras inom sju dagar och pubertet från tolv år. Uppföljningsrollen ser alla indikatorer för varje barnavårdscentral i regionen. Den visar antal, aldrig vilka barn det gäller.',
    expert: 'Systemet räknar indikatorerna själv ur det som redan är registrerat och spärrar varje cell med färre än fem barn för sig, så att ingen behöver föra statistik eller räkna fram ett litet tal.',
    anmarkning: 'Indikatorerna är demoregler. Regionens summa räknas bara på barnavårdscentraler vars värden visas.',
  },
};
const lagg = (tillagg) => (poster) => poster.map(x => {
  const p = tillagg[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...(x.tester ?? []), ...tester])] };
});
export const medR11r7Iva = lagg(POSTER_IVA);
export const medR11r7Tillvaxt = lagg(POSTER_TILLVAXT);
