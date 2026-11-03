// Runda 6, r6: ansvarsuppdrag för läkemedel och godkännande av läkemedelsmallar. Testnamnen (app/test/
// lakemedelsansvar.test.js och klickbudgeten) och de poster i Sussa 3.5.1 och 3.5.2 som rundan ändrar. Mappningsfilerna
// för avsnitten lägger rundans ändringar ovanpå runda 6, r2, så att ändringen ligger samlad här.
// krav.js läser testnamnen härifrån för D11, så prefixet för klickbudgeten står här i stället för att importeras.
const GK = 'Gränssnitt > Klickbudget > ';
const AU = 'Ansvarsuppdrag för läkemedel > ';
const AV = 'Avbokad vårdhändelse utan grund > ';
const MG = 'Godkännande av läkemedelsmallar > ';

export const T = {
  oversikt: `${AU}verksamhetschefen ser vårdenhetens uppdrag, och systemet påminner om det som saknas och föreslår vem som ska få uppdraget`,
  utse: `${AU}verksamhetschefen utser en medicinskt ansvarig läkare med ett år förifyllt, och det loggas och syns i säkerhetsloggen`,
  behorighet: `${AU}säkerhet: bara vårdenhetens verksamhetschef utser och avslutar uppdrag, och nekade försök loggas`,
  ledningsansvar: `${AU}verksamhetschefens eget ansvar går inte att lämna över, och systemet förklarar varför en person inte kan få uppdraget`,
  narkotika: `${AU}samma sjuksköterska beställer inte och kontrollerar narkotika, och reserven är en annan än den ordinarie`,
  historik: `${AU}ett nytt uppdrag som medicinskt ansvarig läkare avslutar det förra, och ett uppdrag ändras och raderas aldrig`,
  paminnelser: `${AU}påminnelsen kommer när ett uppdrag går ut inom 30 dagar, uppdraget upphör när personen slutar och genomgången av ansvarsdokumentet sparas`,
  journal: `${AU}säkerhet: verksamhetschefen läser inte journalen och har ingen arbetslista`,
  avbokad: `${AV}raden går till den ordinerande läkaren, annars till den medicinskt ansvariga läkaren och annars till alla läkare, och verksamhetschefen påminns`,
  mallInkorg: `${MG}mallansvarig läkare godkänner en ändrad mall från inkorgen: den gamla används tills den nya är godkänd, och historiken sparas`,
  mallSakerhet: `${MG}säkerhet: bara den mallansvariga läkaren på vårdenheten godkänner, och nekade försök loggas`,
  substans: `${MG}en ändrad läkemedelsmall per substans kräver nytt godkännande per vårdenhet, och förslaget använder den godkända versionen`,
  kbUtse: `${GK}Utse en medicinskt ansvarig läkare inom budget`,
  kbMall: `${GK}Godkänna en ändrad läkemedelsmall inom budget`,
};
export const TESTER_ANSVAR = [T.oversikt, T.utse, T.behorighet, T.ledningsansvar, T.narkotika, T.historik, T.paminnelser, T.journal, T.kbUtse];

// Ändringar per post: tester som läggs till och text som läggs till sist i lösningen, expertrollen och anmärkningen.
const ANDRINGAR = {
  '3.5.1.3': {
    tester: [T.mallInkorg, T.mallSakerhet, T.substans, T.kbMall],
    losning: 'Varje läkemedelsmall, per substans eller med flera ordinationer, godkänns av den läkare som verksamhetschefen har utsett som ansvarig för vårdenhetens läkemedelsmallar innan den kan användas, och en ändrad mall är en ny version som kräver ett nytt godkännande.',
    expert: 'Systemet skriver själv vad som ändrats mot den förra versionen, lägger mallen i den mallansvariga läkarens inkorg och använder den tidigare godkända versionen tills den nya är godkänd, så att den som ordinerar aldrig behöver veta vilken version som gäller.',
    anmarkning: 'Godkännandet följer Gröna häftet 688488 R5 avsnitt 1.4.3. Ett gränssnitt för att bygga eller ändra en mall saknas, liksom farmaceutens förvaltning av mallarna (mallförvaltare på Läkemedelscentrum).',
  },
  '3.5.2.15': {
    tester: [T.utse],
    losning: 'Direktiven fastställs av verksamhetschefen eller den medicinskt ansvariga läkare som verksamhetschefen har utsett.',
    expert: 'Systemet vet vem som är medicinskt ansvarig läkare på vårdenheten och säger det till den läkare som försöker fastställa ett direktiv utan uppdraget.',
    ersattAnmarkning: 'Demons direktiv är påhittade. Vem som får fastställa följer HSLF-FS 2017:37 6 kap. 6 och 17 §§ och Gröna häftet 1.4.2: verksamhetschefen eller den medicinskt ansvariga läkaren. Vårdgivarens nivå finns inte.',
  },
  '3.5.2.7': {
    tester: [T.avbokad],
    ersattExpert: 'Systemet föreslår patientens bokningar med den som passar ordinationen först och räknar om dosen när tiden ändras, och sätter vid en avbokning själv upp vårdhändelsen på väntelistan igen. När remissen avvisades och den läkare som ordinerade inte längre finns på vårdenheten skickar systemet beslutet till den medicinskt ansvariga läkaren, och saknas uppdraget påminns verksamhetschefen.',
  },
};

const lagg = (a, b) => (b ? `${a ? `${a} ` : ''}${b}` : a);
// Lägger rundans ändringar ovanpå avsnittets poster.
export const medR6 = (poster) => poster.map(x => {
  const a = ANDRINGAR[x.id];
  if (!a) return x;
  return { ...x, tester: [...x.tester, ...a.tester.filter(t => !x.tester.includes(t))], losning: lagg(x.losning, a.losning), expert: a.ersattExpert ?? lagg(x.expert, a.expert),
    anmarkning: a.ersattAnmarkning ?? lagg(x.anmarkning, a.anmarkning) };
});
