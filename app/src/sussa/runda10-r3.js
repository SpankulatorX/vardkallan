// Runda 10, r3: formulärmotorn, kroppsbilden, röstinmatningen och rättstavningen. Testnamnen för servertesterna
// (app/test/formularmotor.test.js, stavning.test.js och rostinmatning.test.js), klickbudgeten och de mobila flödena, och
// tilläggen till posterna i Sussa 3.1.3, 3.1.7 och 5.1.1. Mappningsfilerna lägger tilläggen härifrån ovanpå sina egna
// poster med medR10r3, så att ändringen ligger samlad här.
import { klickbudgetTest } from '../krav.js';
import { FLODEN } from '../klickbudget.js';

const FM = 'Formulär > ';
const ST = 'Rättstavning > ';
const RO = 'Röstinmatning > ';
const MO = 'Gränssnitt > Mobil > ';
const kb = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));
const mobil = (id) => `${MO}${FLODEN.find(f => f.id === id).namn} går i 360 px`;

export const T = {
  datatyper: `${FM}definitionen har fördefinierade datatyper med validering, och systemet förklarar varje fel på vanlig svenska`,
  fasta: `${FM}fasta svarsalternativ ger poäng, skalan tolkar summan och anteckningen får text som systemet skriver ur svaren`,
  regler: `${FM}frågor visas och krävs efter regler, och reglerna ger varningar på vanlig svenska`,
  kropp: `${FM}kroppsbilden: systemet avgör kroppsdel och sida ur markeringen, också höger och vänster bakifrån`,
  koder: `${FM}svarsalternativ och tolkningar kan ha koder i ICD-10-SE, KVÅ och Snomed CT, som systemet kontrollerar och föreslår`,
  versioner: `${FM}ett formulär byggs som en ny version och används först när en annan systemförvaltare har godkänt det`,
  forifyll: `${FM}förifyllnad: systemet fyller i ålder och senaste mätvärde ur journalen och säger varifrån värdet kommer`,
  forifyllSparr: `${FM}förifyllnad bygger bara på det som den som fyller i får se: en spärrad vårdenhets mätvärde ändrar inte svaret`,
  matvarde: `${FM}ett nytt mätvärde i formuläret registreras som mätvärde när anteckningen signeras, och ett oförändrat förifyllt värde registreras inte igen`,
  behorighet: `${FM}behörighet per formulär: kategori, yrken och vårdenheter prövas på servern`,
  signerad: `${FM}svaren i en signerad anteckning ändras aldrig, och en rättelse blir en ny version med egna svar`,
  api: `${FM}API: systemförvaltaren bygger, förhandsvisar och föreslår formulär, och den som dokumenterar får aktiva formulär bland mallarna`,
  fhir: `${FM}FHIR: formuläret som Questionnaire och svaren som QuestionnaireResponse med samma behörighet som anteckningen`,
  term: `${ST}en felstavad medicinsk term får förslag ur den medicinska ordlistan, och vanliga ord och rätt stavade termer markeras inte`,
  grammatik: `${ST}grammatik: upprepade ord, stor bokstav efter punkt, mellanslag och särskrivning av medicinska termer`,
  egen: `${ST}den personliga ordlistan: ett ord som personen lägger till markeras inte längre för personen, men för andra`,
  engelska: `${ST}engelska: medicinska termer på engelska kontrolleras när texten är på engelska`,
  kallor: `${ST}ordlistan har källor och utgåvor: kodverken, läkemedelskatalogen och den medicinska ordlistan`,
  stavApi: `${ST}API: kontrollen tar emot text utan att spara eller logga den, och kräver inloggning`,
  kommandon: `${RO}röstkommandon: skiljetecken, ny rad och byte av sökord tolkas, och systemet sätter stor bokstav i början av meningen`,
  signera: `${RO}signering och andra beslut görs aldrig med rösten: kommandot signera ger en förklaring och inget händer`,
  markt: `${RO}dikterad text märks i anteckningen och blir journal för andra först när den är signerad`,
};
export const TESTER_FORMULAR = [T.datatyper, T.fasta, T.regler, T.kropp, T.koder, T.versioner, T.forifyll, T.forifyllSparr, T.matvarde, T.behorighet, T.signerad, T.api, T.fhir];
export const TESTER_STAVNING = [T.term, T.grammatik, T.egen, T.engelska, T.kallor, T.stavApi];
export const TESTER_ROST = [T.kommandon, T.signera, T.markt];

const ROST_LOSNING = 'Knappen Diktera i anteckningens sökord startar webbläsarens taligenkänning på svenska. Texten hamnar i det sökord som dikteras, och röstkommandon ger skiljetecken, ny rad, nästa eller föregående sökord, gå till ett sökord, ångra och sluta diktera. Systemet sätter stor bokstav och mellanslag, och sökord med dikterad text märks som dikterade i anteckningen. Texten blir ett utkast som sparas och signeras med knapparna, och rösten kan aldrig signera.';
const ROST_EXPERT = 'Systemet avgör själv vad som är text och vad som är ett kommando, sätter skiljetecken och stor bokstav och flyttar mellan sökorden, så att den som dikterar bara talar. Dikteringen hör till den patient som var öppen när den startade: rutan visar vems journal det är, och byter man sida avbryts den.';
const ROST_ANM = 'Igenkänningen är webbläsarens (Web Speech API) och finns i till exempel Chrome och Edge. Systemet ber om lokal igenkänning när webbläsaren har den, och annars kan webbläsaren skicka ljudet till sin leverantörs tjänst, vilket rutan säger. I drift behövs en motor som regionen godkänner. Testet i klickbudgeten använder en simulerad igenkänning. Röstinmatningen finns i anteckningarnas sökord, inte i formulärens frågor och inte i ordinationer.';
const FORMULAR_LOSNING = 'Verksamhetens formulär byggs på sidan Formulär av systemförvaltningen, utan kod: frågor med datatyperna fritext, heltal, tal med decimaler, datum, ja eller nej, ett eller flera fasta svar, bild med markeringar och mätvärde, var och en med sin validering. Fasta svar kan ge poäng och ha en kod i ICD-10-SE, KVÅ eller Snomed CT, poängen räknas till en skala med tolkning, och regler visar frågor, kräver svar och ger varningar. En fråga kan fyllas i av systemet med patientens ålder, det senaste mätvärdet eller diagnoserna. Kroppsbilden framifrån och bakifrån tar emot markeringar. Ett ifyllt formulär är en journalanteckning med text som systemet skriver ur svaren, svaren sparas strukturerat med formulärets version och lämnas ut i FHIR som QuestionnaireResponse, och ett nytt mätvärde i formuläret registreras bland mätvärdena när anteckningen signeras. Seeden har Fallriskbedömning och Sårdokumentation.';
const FORMULAR_EXPERT = 'Den som fyller i svarar bara på frågorna: systemet visar de frågor som gäller, fyller i det som finns i journalen och säger varifrån, räknar poängen, säger vad den betyder och skriver vilken kroppsdel och sida en markering ligger på, också när höger och vänster byter plats bakifrån. Den som bygger får nycklarna satta, en förhandsvisning medan formuläret byggs, en förklaring för varje fel och förslag på koder ur kodverken.';

const POSTER = {
  '3.1.3.1': {
    avsedd: 'uppfyllt_demo',
    tester: [T.fasta, T.regler, T.kropp, T.versioner, T.signerad, T.api, kb('formular-sar'), kb('bygga-formular')],
    losning: `Anteckningar skrivs i mallar med sökord per anteckningstyp, och omvårdnadsanteckningen följer VIPS. Mallarna för tobaksvanor och levnadsvanor har fasta svarsalternativ. ${FORMULAR_LOSNING}`,
    expert: FORMULAR_EXPERT,
    anmarkning: 'Bilden i formulären är kroppsbilden, ritad som en schematisk figur. Egna bilder och figurer går inte att lägga in i ett formulär, och fotografier i journalen hanteras under Bilder och media. Poängen i seedens fallriskbedömning är en demoregel och inte en validerad skala.',
  },
  '3.1.3.2': {
    avsedd: 'uppfyllt_demo', tester: [...TESTER_ROST, kb('diktera'), mobil('diktera')],
    losning: ROST_LOSNING, expert: ROST_EXPERT, anmarkning: ROST_ANM,
  },
  '3.1.3.5': {
    avsedd: 'uppfyllt_demo',
    tester: [T.fasta, T.kropp, T.forifyll, T.matvarde, kb('formular-sar')],
    losning: 'Strukturerat: mallar med sökord, formulär med fasta svar som verksamheten bygger själv, mätvärden och skalor. Ostrukturerat: fritext under varje sökord, dikterad eller skriven. Skalor och poängmodeller med text: NEWS2, Glasgow Coma Scale, NRS och ACVPU, och formulärens egna skalor, där systemet räknar summan och skriver tolkningen. Bilder med markeringar: kroppsbilden i formulären, där systemet skriver kroppsdel och sida. Underlag för beräkningar: svaren sparas strukturerat bredvid texten, och mätvärden i ett formulär blir mätvärden som NEWS2, kurvorna och BMI räknar på. Epikrisen får orsaken till vården, diagnoserna och läkemedelsförändringarna ur vårdtillfället.',
    expert: 'Mallen ger sökorden, formuläret de frågor som gäller och systemet fyller i ålder och senaste mätvärde, räknar poängen, skriver tolkningen och texten och avgör var en markering i kroppsbilden ligger. Den som dokumenterar behöver varken komma ihåg strukturen, poängtabellerna eller kodverken.',
    anmarkning: 'Skalorna är demoregler och inte kliniskt beslutsstöd. Kroppsbilden är den enda bilden i formulären. Epikrisens förlopp skrivs med fritext.',
  },
  '3.1.3.7': {
    avsedd: 'uppfyllt_demo', tester: [...TESTER_ROST, kb('diktera'), mobil('diktera')],
    losning: `${ROST_LOSNING} Medan man talar visas det som hörs, och efteråt säger systemet att den dikterade texten ska läsas igenom före signeringen. Ångra tar bort det som dikterades senast.`,
    expert: ROST_EXPERT, anmarkning: ROST_ANM,
  },
  '3.1.3.10': {
    avsedd: 'uppfyllt_demo', tester: [...TESTER_STAVNING, kb('stavning')],
    losning: 'Textfälten i anteckningarna har webbläsarens stavningskontroll på svenska. Dessutom kontrollerar systemet medicinska termer och grammatik medan man skriver: en term som är felstavad visas under fältet med förklaring och förslag, och ett klick byter ordet. Ordlistan byggs ur Vårdkällans medicinska ordlista, titlarna i ICD-10-SE och KVÅ, läkemedelskatalogen, mätvärdena och sökorden, och visar källa och utgåva. Grammatiken kontrolleras för samma ord två gånger, liten bokstav efter punkt, mellanslag runt skiljetecken och särskrivning av medicinska termer. Varje person har en egen ordlista, och texten på engelska kan kontrolleras mot medicinska termer på engelska.',
    expert: 'Systemet kontrollerar själv när man slutar skriva, känner igen böjningar och sammansättningar av termerna och föreslår rätt term, så att ingen behöver slå upp stavningen. Ordlistan följer kodverken när de uppdateras, och texten som kontrolleras sparas och loggas aldrig.',
    anmarkning: 'Den allmänna svenska stavningen sköts av webbläsarens egen kontroll. Grammatiken är regler för vanliga fel i journaltext, inte en fullständig grammatikkontroll. Den medicinska ordlistan har drygt 300 egna termer utöver kodverken och katalogen. Engelska kan väljas i API:t, men fälten i gränssnittet är alltid på svenska.',
  },
  '3.1.7.1': {
    avsedd: 'uppfyllt_demo', tester: [T.forifyll, T.forifyllSparr, T.matvarde],
    losning: 'Varje uppgift registreras en gång och samma post används i översikten, Min journal, FHIR och överföringen till NLL. Vårdkontakten skapas när någon börjar dokumentera, ett vårdtillfälle följer med vid flytt utan att något registreras om, och orsaken från akutbesöket eller remissen följer med till inskrivningen och den nya kontakten. I formulären fyller systemet i åldern och det senaste mätvärdet med källan utskriven, och ett nytt mätvärde i ett formulär registreras en gång bland mätvärdena, där NEWS2, kurvorna och nästa formulär hämtar det.',
    expert: 'Systemet återanvänder det som redan finns: ordinationen skickas till NLL, kontakten skapas ur sammanhanget, akutbesökets orsak blir inskrivningens, ankomsten registreras på den planerade kontakten och formulären fyller i det journalen redan har, så att ingenting skrivs två gånger. Varje förifyllt värde visar varifrån det kommer.',
    anmarkning: 'Principen gäller systemets egna flöden. Uppgifter från och till andra vårdgivare byggs under 3.2.2.3 och 3.5.1.1, och NLL är simulerad.',
  },
  '5.1.1.3': {
    avsedd: 'uppfyllt_demo', tester: [...TESTER_FORMULAR, kb('bygga-formular'), kb('formular-sar'), mobil('formular-sar')],
    losning: `${FORMULAR_LOSNING} Formuläret kan begränsas till vissa yrken och vårdenheter, vilket servern prövar, och fylls i på samma sätt i mobilen. Varje ändring är en ny version som gäller när en annan systemförvaltare har godkänt den, ett formulär kan avvecklas, och det som skrivits med en äldre version visas med den versionen.`,
    expert: FORMULAR_EXPERT,
    anmarkning: 'Villkor och regler skrivs i byggaren som korta rader, till exempel poäng minst 3, och systemet förklarar en rad som inte går att tolka. Bilden är kroppsbilden. Formulären används som journalanteckningar och lämnas ut i FHIR, men inte i remisser eller i Min journal som formulär för patienten.',
  },
};

// Lägger rundans tillägg ovanpå avsnittets poster. tester läggs till postens egna, och de andra fälten ersätter postens.
export const medR10r3 = (poster) => poster.map(x => {
  const p = POSTER[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...x.tester, ...tester])] };
});
