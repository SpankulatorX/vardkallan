// Runda 13, r4: arbetsdagen på mottagningarna och operationsavdelningen, seeddata som hänger ihop och fynden på nivå 2
// från det utforskande testet. Posterna behåller sin status: här läggs testerna till och det som systemet nu gör som
// expert, i ett eget block per post, så att ändringen ligger samlad. Mappningsfilerna lägger på detta sist.
const A = 'Arbetsdagen på mottagningarna (runda 13, r4) > ';
const V = 'Väntelistan (runda 13, r4, E3-8 och E3-9) > ';
const B = 'Bokning från väntelistan (runda 13, r4, E3-10 och E3-47) > ';
const VB = 'Vätskebalansen (runda 13, r4, E2-14 och E2-51) > ';
const VC = 'Vaccinationer (runda 13, r4, E2-38 och E2-39) > ';
const AN = 'Anestesiläkaren (runda 13, r4, E1-32) > ';
const AS = 'Anestesiläkaren, säkerhetsgranskningen (runda 13, r4) > ';
const N2 = 'Nivå 2 (runda 13, r4) > ';

export const T13 = {
  mittPaDagen: `${A}mitt på dagen har några patienter kommit och några väntas`,
  efterhand: `${A}en ankomst som registreras i efterhand räknas från den bokade tiden`,
  opFormiddag: `${A}operationsprogrammet: mitt på förmiddagen är den första operationen gjord eller pågår och den andra väntar`,
  vardgaranti: `${V}vårdgarantin har en egen kolumn, och väntan som patienten väljer eller som har medicinska skäl räknas inte`,
  avsluta: `${V}en post tas bort från väntelistan med en orsak, och bara av vårdenheten själv`,
  inskriven: `${B}en inskriven patient får förslag från några dagar efter i dag, med hans kommande tider på vårdenheten`,
  brev: `${B}systemet föreslår inte en tid som ett brev inte hinner fram till, och ett brev till en för nära tid skickas inte`,
  vatska: `${VB}en urinmätning har tid och period, och timmar utan registrering räknas inte som noll och ger ingen oliguri`,
  vaccinBhv: `${VC}barnhälsovårdens doser står i fliken Vaccinationer, och åldern räknas från födelsedagen`,
  vaccinKontroll: `${VC}en dos ges bara när patienten är frisk i dag, och batch, utgångsdatum och injektionsställe sparas`,
  anestesiProgram: `${AN}ser de operationer som är beställda till anestesienheten i programmet, och inte andra sjukhus operationer`,
  anestesiLista: `${AN}har patienterna med beställda operationer i arbetslistan`,
  anestesiKlar: `${AS}en avslutad operation (klar) visas inte för anestesienheten i programmet, bara som upptagen tid`,
  anestesiSparr: `${AS}arbetslistan tar inte ingreppet från en anmälan som anestesiläkaren inte får se (spärrad vårdenhet)`,
  attGodkanna: `${N2}E3-27: allt som väntar på godkännande står samlat, och bara det någon annan har föreslagit räknas som att godkänna`,
};

const TILLAGG = {
  '3.4.1.4': {
    tester: [T13.mittPaDagen, T13.efterhand],
    expert: 'Runda 13: dagens patienter på mottagningarna ligger på arbetsdagen. Mitt på dagen väntas några och några har kommit, på kvällen är dagens besök gjorda och nästa arbetsdags patienter är bokade, och på natten väntas dagens patienter. Systemet stänger ett besök som är genomfört.',
  },
  '3.4.1.7': {
    tester: [T13.vardgaranti, T13.avsluta],
    expert: 'Runda 13: vårdgarantin har en egen kolumn med datum och dagar kvar. Patientvald och medicinskt orsakad väntan registreras som en egen åtgärd, och systemet flyttar vårdgarantins datum med de dagar som inte räknas. En post som inte längre behövs tas bort med en orsak, och prioriteten ändras bara när tillståndet eller läkarens bedömning har ändrats.',
    anmarkning: 'Vårdgarantin och väntan som inte räknas är demoregler. Rapporteringen till Väntetider i vården är inte byggd.',
  },
  '3.4.2.2': {
    tester: [T13.inskriven, T13.brev],
    expert: 'Runda 13: systemet föreslår inte en tid som ett brev inte hinner fram till, och för en patient som är inskriven föreslår det återbesöket några dagar fram och visar patientens kommande tider på vårdenheten.',
  },
  '3.4.3.1': {
    tester: [T13.brev],
    expert: 'Runda 13: ett brev till en tid om mindre än tre dagar skickas inte. Raden i Dagens arbete säger att patienten ska få tiden per telefon.',
  },
  '3.4.4.3': {
    tester: [T13.efterhand],
    expert: 'Runda 13: en ankomst som inte registrerades i tid kan registreras i efterhand samma dag, och systemet räknar den från den bokade tiden. Dagens arbete säger att ankomsten saknas innan dagen avslutas.',
  },
  '3.5.1.7': {
    tester: [T13.vaccinBhv, T13.vaccinKontroll],
    expert: 'Runda 13: barnhälsovårdens doser står också under Vaccinationer, och en ålder i hela år räknas från födelsedagen. Före varje dos frågar systemet om patienten är frisk i dag, föreslår injektionsstället efter åldern och sparar batch, utgångsdatum och injektionsställe. Ett utgånget vaccin stoppas.',
    anmarkning: 'Batchnummer och utgångsdatum skrivs in för hand. Skanning av vaccinets förpackning är inte byggd.',
  },
  '3.5.3.1': {
    tester: [T13.vatska],
    expert: 'Runda 13: vätskebalansen finns också under Mätvärden. En registrering har en tid och kan gälla en period, och för urin föreslår systemet perioden sedan den förra mätningen. En timme utan registrering är okänd och ger ingen falsk varning om oliguri.',
  },
  '4.5.1.2': {
    tester: [T13.opFormiddag, T13.anestesiProgram, T13.anestesiKlar],
    expert: 'Runda 13: anestesiläkaren ser de operationer som är beställda till anestesienheten i salsprogrammet och har patienterna i arbetslistan, med samma prövning som listan över beställda anestesibedömningar.',
  },
  '12.1.1.6': {
    tester: [T13.attGodkanna],
    expert: 'Runda 13: allt som väntar på en andra systemförvaltares godkännande står samlat på sidan Regler och parametrar, med länk till sidan där det godkänns och vad den inloggade själv kan godkänna.',
  },
};

// Lägger tilläggen på posterna: testerna läggs till, och texten om hur systemet tar expertrollen i runda 13 läggs i
// anmärkningen efter det som fanns, eftersom expert-texten är en eller två meningar.
export const medR13r4 = (poster) => poster.map(p => {
  const t = TILLAGG[p.id];
  if (!t) return p;
  return {
    ...p, tester: [...(p.tester ?? []), ...t.tester.filter(x => !(p.tester ?? []).includes(x))],
    anmarkning: [p.anmarkning, t.expert, t.anmarkning].filter(Boolean).join(' '),
  };
});
