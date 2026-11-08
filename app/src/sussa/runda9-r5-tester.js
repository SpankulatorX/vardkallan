// Runda 9, r5: testnamnen för servertesterna i app/test/runda9-r5.test.js, som mappningen och hotmodellen pekar på.
// Filen importerar ingenting, så att både hotmodellen (hotmodell.js) och tilläggen till posterna (runda9-r5.js) kan
// använda den.
const IB = 'Inloggning med biljett > ';
const BM = 'Behörighet ur masterdata > ';
const SB = 'Skyddsbehov > ';
const SM = 'Signerade meddelanden > ';
const CE = 'Certifikat mellan instanser > ';
const EA = 'E-arkiv > ';
const GR = 'Gallringsregler > ';
const MI = 'Miljöer > ';
const SA = 'Säkerhetsarkitektur > ';

export const T = {
  idp: `${IB}inloggningen går genom den simulerade autentiseringstjänsten, och personen, uppdraget och behörigheten tas ur biljettens attribut`,
  falsk: `${IB}en biljett med fel utfärdare, fel nyckel, ändrad signatur, fel mottagare, fel algoritm eller som har gått ut avvisas, och orsaken loggas i säkerhetsloggen`,
  engang: `${IB}en biljett kan bara användas en gång`,
  uppdrag: `${IB}ett uppdrag på en annan vårdenhet, med en annan yrkesroll eller med fel ändamål avvisas med en förklaring`,
  konf: `${IB}autentiseringstjänstens publika nyckel och konfiguration för OpenID Connect kan läsas utan inloggning`,
  ny: `${BM}en ny person i källan får behörighet ur yrke och vårdenhet utan administration och kan logga in med biljett`,
  andrad: `${BM}en ändrad person i källan får den nya behörigheten: byte av yrkesroll och av vårdenhet avslutar den gamla inloggningen och en ny inloggning ger den nya`,
  inaktiv: `${BM}en person som synkroniseringen gör inaktiv nekas inloggning och förlorar åtkomsten i en pågående session`,
  klassning: `${SB}varje informationstyp har en skyddsnivå, och informationsstrukturen skiljer uppgifterna efter vårdenhet, process och plan`,
  sbLogg: `${SB}logggranskaren tar fram alla åtkomster till uppgifter med mycket högt skyddsbehov`,
  sbStickprov: `${SB}stickprovet tar alltid med åtkomster till uppgifter med mycket högt skyddsbehov`,
  nll: `${SM}en förskrivning till läkemedelslistan signeras med Vårdkällans certifikat och kvitteras med läkemedelslistans signatur, och beviset sparas`,
  andrat: `${SM}ändrat innehåll upptäcks: i ett meddelande på vägen, i kvittensen och i journalen efteråt`,
  labbsvar: `${SM}ett svar från laboratoriet tas emot först när signaturen och certifikatet stämmer, och beviset sparas också för ett avvisat svar`,
  bevisTrigger: `${SM}bevisen kan inte ändras eller raderas`,
  bevisApi: `${SM}API: systemförvaltaren ser certifikaten och bevisen utan patientuppgifter och kontrollerar ett bevis, andra roller nekas`,
  kedja: `${CE}kedjan kontrolleras mot listan över betrodda utfärdare, och en egen utfärdare eller en instans som utfärdar certifikat godtas inte`,
  utgang: `${CE}ett utgånget, ännu inte giltigt eller återkallat certifikat avvisas`,
  part: `${CE}ett certifikat för en annan instans godtas inte som avsändare`,
  aterkalla: `${CE}när systemförvaltaren återkallar laboratoriets certifikat i sandlådan tas svaren inte emot, och det gäller bara den sandlådan`,
  index: `${EA}paketet har ett index med e-arkivets dataelement för varje journalhandling, och mappningen står i dokumentationen`,
  leverans: `${EA}leveransen kvitteras av e-arkivet med en signerad kvittens efter mottagningskontrollen`,
  avvisad: `${EA}ett paket som ändras på vägen eller saknar en fil avvisas av mottagningskontrollen med orsaken`,
  skilda: `${EA}journalhandlingar och åtkomstloggen ligger skilda åt, och indexet tar bara med journalhandlingarna`,
  regler: `${GR}reglerna per informationsmängd är parametrar med lagens lägsta gräns, som systemförvaltaren ändrar med fyra ögon, och arkivarien ser dem`,
  delar: `${GR}ett gallringsbeslut gallrar mätvärden och kallelser som är äldre än regeln i journaler som finns kvar, och resten av journalen är orörd`,
  delarLogg: `${GR}gallringen av delar loggas per journal utan innehåll, åtkomstloggen är hel och beslutet kan bara verkställas en gång`,
  acceptans: `${MI}systemförvaltaren skapar en acceptanstestmiljö ur en kopia av sandlådan, med skarpa data och avidentifierade patientuppgifter`,
  fiktiva: `${MI}utbildnings- och testmiljön har fiktiva data och samma regler och parametrar som produktionsmiljön`,
  markt: `${MI}miljön är märkt i varje svar om sessionen och går inte att återställa, och det går att gå tillbaka till produktionsmiljön`,
  miljoTak: `${MI}bara systemförvaltaren skapar miljöer, högst tre per sandlåda och inte ur en annan miljö`,
  hotmodell: `${SA}hotmodellen har yttre och inre hot, och varje hot pekar på en kontroll, en princip och tester`,
  principer: `${SA}varje princip i Sussas kravtext möts av minst ett hot i hotmodellen`,
};
