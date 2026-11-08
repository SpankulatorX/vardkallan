// Runda 7, r1: formulären för mätning 3 och 4 i Sussas modell för användbarhetstester (Bilaga F1:2), som underlag för
// riktiga användartester av Vårdkällan senare. Gemensamt för gränssnittet (vyer/sussatest.js) och servern
// (src/sussa-testfall.js), så att poängen räknas på samma sätt överallt.
import { susPoang } from './sus.js';

// Mätning 3: System Usability Scale med Sussas svenska formulering i Bilaga F1:2 avsnitt 4.3, där ordet [Produkten] är
// utbytt mot systemet. Originalet: Brooke J. SUS, a quick and dirty usability scale, i Jordan med flera (red.),
// Usability Evaluation in Industry, Taylor och Francis 1996. Poängen räknas med standardformeln i sus.js, som också står
// i Bilaga F1:2: udda påståenden ger svaret minus 1, jämna 5 minus svaret, och summan gånger 2,5 ger 0 till 100.
export const SUS_SUSSA_KALLA = 'Bilaga F1:2 Modell för att testa och utvärdera användbarhet, avsnitt 4.3 (Sussa samverkan, dnr 16RS2022), efter Brooke 1996';
export const SUS_SUSSA = [
  'Jag skulle gärna och ofta använda systemet.',
  'Jag skulle dra mig för att använda systemet, det är onödigt komplicerat.',
  'Jag tycker att systemet är lätt att använda.',
  'Jag tror att jag skulle behöva hjälp av en kollega eller från någon IT-person för att kunna använda systemet.',
  'Jag tycker att funktionerna i systemet är väl organiserade och tydliga.',
  'Jag tycker att det finns för mycket inkonsekvens och ologiska vägar i systemet.',
  'Jag kan tänka mig att de flesta skulle lära sig att använda systemet mycket snabbt.',
  'Jag tror att många tycker att systemet är mycket besvärligt att använda.',
  'Jag känner mig väldigt säker på hur jag ska använda systemet.',
  'Jag tror att jag behöver lära mig mycket innan jag kan komma igång med systemet.',
];
export const SUS_SKALA_SUSSA = { 1: 'Instämmer inte alls', 5: 'Instämmer helt' };
export { susPoang };

// Omvandlingen till slutliga utvärderingspoäng i Bilaga F1:2 avsnitt 5. Mätning 1 och 2 är medelvärden 0 till 10,
// mätning 3 SUS-poäng 0 till 100 och mätning 4 expertgranskningens summa för de sju dialogprinciperna, 0 till 70.
export const OMVANDLING = {
  malupfyllelse: [[8, 10], [4, 5], [1.5, 2]],
  effektivitet: [[8, 10], [4, 5], [1.5, 2]],
  tillfredsstallelse: [[90, 10], [80, 5], [50, 2]],
  expert: [[60, 10], [30, 5], [12, 2]],
};
export function utvarderingspoang(matning, varde) {
  const t = OMVANDLING[matning];
  if (!t) throw new Error(`Okänd mätning: ${matning}`);
  if (typeof varde !== 'number' || !Number.isFinite(varde)) return null;
  for (const [grans, poang] of t) if (varde >= grans) return poang;
  return 0;
}

// Mätning 4: expertgranskning mot de sju dialogprinciperna i ISO 9241-110:2006, med Sussas beskrivningar i Bilaga F1:2
// avsnitt 4.4. Kontrollfrågorna är Vårdkällans stöd för granskaren. Varje princip får 10, 5, 2 eller 0 poäng.
export const DIALOGPRINCIPER = [
  { nr: 1, namn: 'Anpassad till uppgiften', beskrivning: 'En dialog är anpassad till uppgiften om den stödjer användaren i att utföra uppgiften säkert och effektivt.',
    fragor: ['Visar vyn bara det som behövs för uppgiften?', 'Fyller systemet i det som det kan räkna ut ur sammanhanget?', 'Klarar flödet sin klickbudget?'] },
  { nr: 2, namn: 'Självinstruerande', beskrivning: 'En dialog är självinstruerande om användaren omedelbart förstår varje steg genom återkoppling eller genom förklaringar när användaren ber om dem.',
    fragor: ['Bekräftar systemet varje sparad åtgärd med en tydlig notis?', 'Förklarar systemet på vanlig svenska varför något inte går?'] },
  { nr: 3, namn: 'Förutsägbar för användaren', beskrivning: 'En dialog är förutsägbar om den är konsekvent och stämmer med användarens kunskap om vården, utbildning, erfarenhet och vedertagna konventioner.',
    fragor: ['Ligger knappar och vyer på samma ställe i hela systemet?', 'Används vårdens egna ord och inte systemets?'] },
  { nr: 4, namn: 'Stödjer inlärning', beskrivning: 'En dialog stödjer inlärning om den stödjer användaren att lära sig systemet.',
    fragor: ['Föreslår systemet nästa steg?', 'Kan en ny användare klara testfallet utan utbildning?'] },
  { nr: 5, namn: 'Styrbar', beskrivning: 'En dialog är styrbar om användaren kan ta initiativet och styra riktning och takt tills uppgiften är klar.',
    fragor: ['Går det att avbryta och gå tillbaka utan att något sparas?', 'Kan användaren ändra det som systemet har föreslagit?'] },
  { nr: 6, namn: 'Tolerant mot fel', beskrivning: 'En dialog är tolerant mot fel om det tänkta resultatet kan nås trots fel, med inga eller få korrigerande handlingar.',
    fragor: ['Kontrollerar systemet uppgifterna innan något sparas?', 'Går ett fel att rätta utan att börja om?'] },
  { nr: 7, namn: 'Möjlig att individualisera', beskrivning: 'En dialog är möjlig att individualisera om gränssnittet kan anpassas till uppgiften, individuella önskemål och användarens skicklighet.',
    fragor: ['Kan användaren spara egna vyer och urval?', 'Fungerar systemet med tangentbord, förstoring och på en liten skärm?'] },
];
export const PRINCIPPOANG = [10, 5, 2, 0];
export const PRINCIPSKALA = {
  10: 'Väl godkänd: alla tillämpningar uppfylls och inga betydande användbarhetsbrister.',
  5: 'Godkänd: större delen av tillämpningarna uppfylls.',
  2: 'Acceptabel: en mindre del av tillämpningarna uppfylls.',
  0: 'Inga av tillämpningarna uppfylls.',
};
// Summan för de sju principerna, 0 till 70, och utvärderingspoängen. Utan poäng för alla sju finns ingen summa.
export function expertpoang(poang) {
  if (!Array.isArray(poang) || poang.length !== DIALOGPRINCIPER.length || !poang.every(p => PRINCIPPOANG.includes(p))) return null;
  const summa = poang.reduce((a, b) => a + b, 0);
  return { summa, poang: utvarderingspoang('expert', summa) };
}

// Ett svar sparas utan patientuppgifter: deltagarkoden är en kort kod som testledaren hittar på, och en kommentar med
// sex siffror i rad (ett personnummer eller ett datum) tas inte emot.
export const KODMONSTER = /^[A-Za-z0-9-]{1,12}$/;
export const kodGiltig = (k) => typeof k === 'string' && KODMONSTER.test(k) && !/\d{6}/.test(k);
export const kommentarGiltig = (t) => typeof t === 'string' && t.length <= 1000 && !/\d{6}/.test(t.replace(/[\s-]/g, ''));

// Det som sparas på servern när en testperson svarar (src/anvandartest-svar.js), och som sidan visar innan.
export const GALLRING_DAGAR = 90;
export const SPARAS = [
  'Testtillfället, med den kod som testledaren ger dig. Bara testledaren kan läsa svaren, och bara med samma kod.',
  'Din roll i testet, till exempel Läkare slutenvård. Inte ditt namn.',
  'En pseudonym som testledaren sätter, till exempel L03.',
  'Datum för testet, utan klockslag.',
  'Vilket testfall svaret gäller.',
  'Dina svar och poängen som systemet räknar. En kommentar i expertgranskningen får inte innehålla patientuppgifter.',
  `Ett testtillfälle och alla dess svar raderas ${GALLRING_DAGAR} dagar efter det senaste svaret, eller tidigare om testledaren raderar det.`,
];
export const TESTROLLER = ['Läkare öppenvård', 'Läkare slutenvård', 'Sjuksköterska slutenvård', 'Sjuksköterska öppenvård', 'Undersköterska', 'Paramedicinare', 'Medicinsk sekreterare', 'Användbarhetsexpert'];
