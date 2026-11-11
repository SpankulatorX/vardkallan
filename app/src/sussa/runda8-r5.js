// Runda 8, r5: mallen för tobaksvanor, epikrisens förslag, flera mätvärden på en gång, vårdenheternas egna övningar,
// utloggningen och undantaget i barnhälsovårdsregistret som parametrar, och villkoren för version 1.0. Testnamnen för
// servertesterna (app/test/r5.test.js), klickbudgeten och Sussas testfall, och tilläggen till posterna i Sussa 3.1.3,
// 4.1, 5.2, 10.1 och 12.1. Mappningsfilerna lägger tilläggen härifrån ovanpå sina egna poster med medR8r5, så att
// ändringen ligger samlad här.
import { testfallTest, testfall } from '../sussa-testfall.js';

const GK = 'Gränssnitt > Klickbudget > ';
const TB = 'Tobaksvanor > ';
const EM = 'Epikris och mätvärden > ';
const OV = 'Övningar per vårdenhet > ';
const PA = 'Parametrar för utloggning och rapportering > ';
const VE = 'Version 1.0 > ';

export const T = {
  tobakRegler: `${TB}systemet sätter själv att patienten använder tobak, och föreslår stöd och KVÅ-kod enligt Socialstyrelsens riktlinjer`,
  tobakFel: `${TB}systemet förklarar på vanlig svenska när svaren inte går ihop`,
  tobakText: `${TB}anteckningen får text som systemet skriver ur svaren, och svaren sparas strukturerat bredvid`,
  tobakKva: `${TB}hölls samtalet vid besöket registreras åtgärden med KVÅ-koden när anteckningen signeras, och svaren ändras sedan aldrig`,
  tobakApi: `${TB}API: rollerna som skriver omvårdnadsanteckningar dokumenterar tobaksvanor, och översikten visar den senaste`,
  tobakSparr: `${TB}en anteckning om tobaksvanor på en spärrad vårdenhet varken visas eller ändrar svaret i översikten`,
  epikris: `${EM}epikrisen får Orsak till vård ur vårdtillfället och diagnoserna, och läkaren skriver bara förloppet och uppföljningen`,
  epikrisSparr: `${EM}epikrisens förslag bygger bara på det läkaren får se: en spärrad eller annan vårdenhets diagnos ändrar inte förslaget`,
  flera: `${EM}längd, vikt, blodtryck och puls registreras på en gång med samma tid och vårdkontakt, och systemet räknar BMI`,
  ovEnhet: `${OV}personalen gör vårdgivarens och den egna vårdenhetens övningar, och de egna har ett eget prefix`,
  ovEnhetAndra: `${OV}vårdenhetens verksamhetschef och utbildare ändrar de egna övningarna som en ny version med egen historik`,
  utlogg: `${PA}utloggningen har skilda gränser för personal och invånare, med rimlighetskontroll och samma standard som förut`,
  utloggGaller: `${PA}en godkänd ändring av utloggningen gäller från dagen den gäller, med fyra ögon, och bara för personalen`,
  bhvq: `${PA}undantaget för skyddade personuppgifter i barnhälsovårdsregistret är en parameter, och dess standard är konstanten`,
  version: `${VE}villkoren räknas ur registret, testfallen och säkerhetsfynden, och 1.0 nås bara när alla fyra är uppfyllda`,
  versionApi: `${VE}API: krav/version ger versionen ur package.json och de fyra villkoren utan inloggning, och listan med säkerhetsfynd är tom`,
  kbTobak: `${GK}Fylla i tobaksmallen i en anteckning inom budget`,
  kbEpikris: `${GK}Skriva och signera en epikris inom budget`,
  kbFlera: `${GK}Registrera längd, vikt, blodtryck och puls inom budget`,
};
const korningar = (nr) => testfall(nr).korningar.map(k => testfallTest(testfall(nr), k));
export const TESTER_TOBAK = [T.tobakRegler, T.tobakFel, T.tobakText, T.tobakKva, T.tobakApi, T.tobakSparr, T.kbTobak, ...korningar('4.1')];
export const TESTER_EPIKRIS = [T.epikris, T.epikrisSparr, T.kbEpikris, ...korningar('4.3')];
export const TESTER_FLERA = [T.flera, T.kbFlera, ...korningar('4.2')];
export const TESTER_VERSION = [T.version, T.versionApi];

const TOBAK_LOSNING = 'Mallen Tobaksvanor har de nationella frågorna med fasta svarsalternativ: om patienten använder tobak eller nikotin, och per produkt dagligen, ibland eller slutat med antal. Systemet skriver anteckningens text ur svaren, sparar svaren strukturerat bredvid och föreslår stödet enligt Socialstyrelsens riktlinjer med KVÅ-kod. Översikten visar den senaste dokumentationen.';
const TOBAK_EXPERT = 'Systemet sätter själv att patienten använder tobak när en produkt är ifylld, räknar patientens ålder ur personnumret, föreslår rätt stöd och KVÅ-kod och registrerar åtgärden när samtalet har hållits, så att ingen behöver kunna riktlinjerna eller kodverket.';

// Tilläggen per post. tester läggs till postens egna, och de andra fälten ersätter postens när de finns.
const POSTER = {
  '3.1.3.1': {
    tester: TESTER_TOBAK,
    losning: `Anteckningar skrivs i mallar med sökord per anteckningstyp. Omvårdnadsanteckningen följer VIPS. ${TOBAK_LOSNING}`,
    expert: `Systemet visar bara de mallar rollen får skriva och förväljer daganteckning och den egna enhetens vårdkontakt, så användaren skriver bara det som är nytt. ${TOBAK_EXPERT}`,
    anmarkning: 'Beskrivande bilder saknas, och formulär med fasta svarsalternativ finns bara för tobaksvanor. Mallarnas sökord ändras av systemförvaltningen, och sedan runda 12 skapar systemförvaltningen nya mallar under Mallar och mätvärdestyper.',
  },
  '3.1.3.4': { tester: TESTER_FLERA },
  '3.1.3.5': {
    tester: [...TESTER_TOBAK, ...TESTER_EPIKRIS],
    losning: 'Strukturerade sökord i mallar, fritext under varje sökord och strukturerade mätvärden. Mallen för tobaksvanor har fasta svarsalternativ enligt den nationella vägledningen, och systemet skriver texten ur svaren. Epikrisen får orsaken till vården, diagnoserna och läkemedelsförändringarna ur vårdtillfället. Skalor och poängmodeller: NEWS2 som systemet räknar ur vitalparametrarna, Glasgow Coma Scale med ögonöppning, verbalt och motoriskt svar, smärta med NRS 0 till 10 och medvetandegrad med ACVPU. Systemet räknar summan och skriver texten, till exempel GCS 13 (E3 V4 M6). Inga licensierade skalor.',
    expert: 'Mallen ger sökorden för anteckningstypen, och skalorna och tobaksvanorna väljs med fasta svar med vanlig text, så användaren behöver varken komma ihåg strukturen, poängtabellerna, riktlinjerna eller kodverket. Systemet räknar poängen, föreslår stödet med KVÅ-kod och skriver det som går att räkna ut i epikrisen själv.',
    anmarkning: 'Beskrivande bilder och fler formulär med fasta svar än tobaksvanorna saknas. Epikrisen får orsaken till vården och läkemedelsförändringarna ur vårdtillfället, men förloppet skrivs med fritext.',
  },
  '3.1.3.9': { tester: TESTER_FLERA },
  '4.1.1.7': { tester: [T.bhvq] },
  '5.2.1.4': {
    tester: [T.utlogg, T.utloggGaller],
    losning: 'Utloggning avslutar sessionen på servern och rensar läskopian och reservkopian, också under avbrott och i andra flikar. Efter en tid utan aktivitet loggas användaren ut automatiskt, med en varning fem minuter innan. Tiden är två parametrar under Regler och parametrar, en för personalen och en för Min journal, mellan 5 och 120 respektive 60 minuter och med fyra ögon.',
  },
  '10.1.1.5': {
    tester: [T.ovEnhet, T.ovEnhetAndra],
    anmarkning: 'Övningarna är kunskapsfrågor om hur systemet fungerar, inte praktiska prov i journalen. En vårdenhet kan ha egna övningar utöver vårdgivarens, med egna versioner och egen historik. Utbildare är ett intyg, ingen egen inloggningsroll. Intygen gäller bara i demon.',
  },
  '12.1.1.3': { tester: [T.utlogg, T.utloggGaller, T.bhvq] },
  '12.1.1.5': { tester: [T.utlogg, T.utloggGaller] },
  '12.1.1.6': { tester: [T.bhvq] },
  '12.1.1.7': { tester: [T.tobakKva] },
};

// Lägger rundans tillägg ovanpå avsnittets poster.
export const medR8r5 = (poster) => poster.map(x => {
  const p = POSTER[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...(x.tester ?? []), ...tester])] };
});
export { TOBAK_LOSNING, TOBAK_EXPERT };
