// Runda 14, r5: utbildningsmaterialet per yrkesroll (Sussa 10.1.1.1 till 10.1.1.3, 11.2.1.11 och 11.2.1.12).
//
// Materialet skrivs ur systemets egna register, så att det aldrig glider isär från systemet: de vanliga arbetsflödena
// och klickbudgeten (klickbudget.js), instruktionsfilmerna (instruktionsfilmer.js), övningarna i utbildningsmiljön
// (seed/ovningar.js), de praktiska proven (praktiska-prov.js) och testinbjudans uppdrag (testinbjudan.js). Det enda som
// står här är vad varje roll gör i systemet och vad rollen ska kunna efter utbildningen.
//
// scripts/dokument-md.js skriver filer() till docs/utbildning/, och test/utbildningsmaterial.test.js prövar att filerna
// är exakt det som skrivs här. Övningarna är version 1 ur koden. En vårdgivare som ändrar övningarna i gränssnittet får
// nya versioner i sandlådan, och de står inte i materialet.
import { YRKEN, PERSONAL } from './seed/personal.js';
import { PATIENTER } from './seed/patienter.js';
import { OVNINGAR_V1 } from './seed/ovningar.js';
import { FLODEN } from './klickbudget.js';
import { FILMER, filmFil } from './instruktionsfilmer.js';
import { TESTROLLER, uppdragUt } from './testinbjudan.js';
import { KURS, GILTIG_DAGAR } from './utbildning-schema.js';
import { PROVA, GAR_UT_DAGAR } from './utbildning.js';
import { PROVTYPER } from './praktiska-prov.js';
import { kanRoll } from './atkomst.js';

// Demons publika adress, som länkarna i övningarna går till.
export const DEMO = 'https://vardkallan.404haven.se';
export const KATALOG = 'docs/utbildning';

// Invånaren är ingen yrkesroll i personalkatalogen. Demorollerna för invånare har id som börjar med inv-.
export const INVANARE = 'invanare';

// Yrkesrollerna som får ett material, med vad rollen gör i systemet och vad den ska kunna efter utbildningen.
const R = (beskrivning, kunna) => ({ beskrivning, kunna });
export const ROLLER = {
  lakare: R(
    'Som läkare läser du journalen för dina patienter, skriver och signerar anteckningar, ordinerar och sätter ut läkemedel, skickar remisser och kvitterar svar, ställer diagnoser och skriver epikriser. Du arbetar oftast från arbetslistan och patientens översikt. Nödåtkomst och uppgifter från andra vårdenheter kräver ett aktivt val med syfte, som systemet föreslår och loggar.',
    ['öppna en patient från arbetslistan och läsa översikten', 'skriva och signera en daganteckning', 'ordinera ett läkemedel och ta ställning till en varning', 'skicka en remiss och kvittera ett remissvar', 'veta när nödåtkomst får användas och vad som loggas'],
  ),
  sjukskoterska: R(
    'Som sjuksköterska registrerar du mätvärden och vitalparametrar, ger doser från Läkemedel att ge, skriver omvårdnadsanteckningar, skriver in, flyttar och skriver ut patienter och registrerar delegeringar till undersköterskor. Barnmorskan och distriktssköterskan har samma behörigheter i demon.',
    ['ge en dos från Läkemedel att ge och förstå varningen för dubbel dos', 'registrera en NEWS2-kontroll och följa det systemet föreslår', 'skriva in, flytta och skriva ut en patient', 'registrera en delegering för en undersköterska', 'skriva och signera en omvårdnadsanteckning'],
  ),
  underskoterska: R(
    'Som undersköterska registrerar du mätvärden och vätskebalans, tar prover och ger doser när du har en giltig delegering. Systemet prövar delegeringen för varje dos och visar knappen Ge bara när delegeringen gäller.',
    ['registrera mätvärden och vätskebalans', 'ge en dos med en giltig delegering', 'veta vad systemet gör när en delegering saknas eller har gått ut'],
  ),
  vardadministrator: R(
    'Som vårdadministratör bokar, bokar om och avbokar du tider, checkar in patienter, skickar kallelser, registrerar besök, tar betalt och gör dagsavslut i kassan. Du slår också samman journaler när systemet har hittat en trolig dubblett. Dagens arbete är din startsida.',
    ['boka tid för en remiss med en av de tider som systemet föreslår', 'checka in en patient och ta betalt', 'boka om en tid och skicka en gruppkallelse', 'bekräfta en sammanslagning av två journaler'],
  ),
  logggranskare: R(
    'Som logggranskare följer du upp åtkomsten till journalerna. Systemet drar stickprov ur åtkomstloggen och flaggar nödåtkomster, och du markerar varje åtkomst som befogad eller att den ska utredas. Du läser inte journalerna.',
    ['göra ett stickprov i logguppföljningen', 'följa upp en nödåtkomst', 'förklara varför loggen inte går att ändra'],
  ),
  arkivarie: R(
    'Som arkivarie registrerar du beslut om gallring och bevarande och tar fram exportpaket till e-arkivet. Gallring görs bara efter ett registrerat beslut, och åtkomstloggen ändras aldrig. Du läser inte journalerna.',
    ['registrera ett beslut om gallring', 'ta fram ett exportpaket till e-arkivet', 'veta vad som aldrig gallras'],
  ),
  uppfoljning: R(
    'Som analytiker tar du fram datauttag för uppföljning och statistik och granskar och skickar rapporterna till myndigheter och kvalitetsregister. Datauttaget har inga namn eller personnummer.',
    ['ta fram ett datauttag för uppföljning', 'granska och skicka månadens rapport till patientregistret', 'förklara vilka uppgifter som aldrig finns i ett datauttag'],
  ),
  kommun: R(
    'Som kommunens personal ser du den samordnade planeringen inför utskrivning, som delas med kommunen, men inte journalen. Kommunen är en simulerad part i demon.',
    ['läsa och svara på en samordnad planering', 'veta vilka uppgifter kommunen får se och vilka den inte får se'],
  ),
  farmaceut: R(
    'Som farmaceut deltar du i fördjupade läkemedelsgenomgångar, där systemet tar fram läkemedelsberättelsen och läkaren ordinerar. På cytostatikaberedningen bereder du kurer med batch och kontrollmätning och sköter lagret.',
    ['förbereda en fördjupad läkemedelsgenomgång med underlaget från systemet', 'veta vad farmaceuten gör och vad läkaren gör i genomgången'],
  ),
  verksamhetschef: R(
    'Som verksamhetschef utser du uppdragen i läkemedelshanteringen, följer upp vilka på vårdenheten som har giltigt intyg från utbildningen och utfärdar utbildarintyg. Du godkänner också gallring och radering för din vårdenhet. Du läser inte journalerna.',
    ['utse en medicinskt ansvarig läkare', 'se vilka på vårdenheten som har giltigt intyg och vilka som behöver göra övningarna', 'utfärda ett utbildarintyg', 'veta vilket ansvar som inte kan lämnas över'],
  ),
  ekonom: R(
    'Som ekonom tar du fram faktureringsunderlag och sköter prislistorna. Systemet skapar underlaget själv ur det som har hänt i vården, och du läser aldrig journalen.',
    ['exportera faktureringsunderlaget för en vårdenhet och en månad', 'förklara hur systemet räknar fram priserna och betalningsmottagarna'],
  ),
  systemforvaltare: R(
    'Som systemförvaltare föreslår du ändringar av regler, parametrar, mallar, kodverk och formulär, förbereder omorganisationer, registrerar externa tillämpningar och följer upp lagringen och säkerhetskopiorna. En ändring gäller först när en annan systemförvaltare har godkänt den. Du läser inte journalerna.',
    ['föreslå en ändrad regel och godkänna en annan systemförvaltares förslag', 'förbereda ett namnbyte för en enhet', 'registrera en extern tillämpning på sidan Öppet API', 'kontrollera att säkerhetskopian går att läsa tillbaka'],
  ),
  fysioterapeut: R(
    'Som fysioterapeut tar du emot och bedömer remisser, skriver anteckningar efter besök, registrerar mätvärden och bockar av planerade uppgifter som träning. Fysioterapeuten spelar också Sussas paramedicinare, alltså arbetsterapeut, dietist och kurator.',
    ['bedöma och besvara en remiss', 'skriva och signera en anteckning efter ett besök', 'bocka av en planerad uppgift'],
  ),
  [INVANARE]: R(
    'Som invånare loggar du in i Min journal med en simulerad e-legitimation. Där läser du din journal, ser vilka vårdenheter som har läst den, bokar och bokar om tider, lämnar egna mätningar, skriver till vården och begär loggutdrag eller spärr.',
    ['läsa din journal och se vem som har läst den', 'boka om en tid', 'lämna en egen mätning och skriva till vården', 'begära ett loggutdrag eller en spärr'],
  ),
};

export const rollnamn = (yrke) => (yrke === INVANARE ? 'Invånare i Min journal' : YRKEN[yrke]);
export const filnamn = (yrke) => `${yrke}.md`;

// Yrket för en demoroll: personalens yrke ur personalkatalogen, och invånaren för id som börjar med inv-.
export const yrkeFor = (id) => (id?.startsWith('inv-') ? INVANARE : PERSONAL.find(p => p.id === id)?.yrke ?? null);
const namnFor = (id) => {
  if (id?.startsWith('inv-')) { const p = PATIENTER.find(x => x.id === id.slice(4)); return p ? `${p.fornamn} ${p.efternamn}` : null; }
  return PERSONAL.find(p => p.id === id)?.namn ?? null;
};

// Samma prövning som utbildning.js gör innan övningen visar länken till demon: länken finns bara när rollen når adressen.
function nar(vag, yrke) {
  if (!vag || !(vag in PROVA)) return false;
  const krav = PROVA[vag];
  const p = { yrke };
  if (krav === 'patient') return kanRoll(p, 'las_oversikt') || kanRoll(p, 'las_admin');
  return krav ? kanRoll(p, krav) : true;
}

// Instruktionsfilmerna med flödets namn, roll, startpunkt och budget ur klickbudgeten, som filmer() i
// instruktionsfilmer.js. En film vars flöde ännu inte finns i klickbudgeten står inte i materialet. Det felet stoppar
// bygget i testerna av instruktionsfilmerna, så materialet behöver inte stanna för det.
export function filmerMedFlode() {
  const perId = new Map(FLODEN.map(f => [f.id, f]));
  return FILMER.filter(x => perId.has(x.flode)).map((x) => {
    const f = perId.get(x.flode);
    return { ...x, roll: f.roll, start: f.start, flodesnamn: f.namn, budget: f.budget, fil: filmFil(x.id) };
  });
}

// Delarna i materialet för en roll, ur registren.
export function delar(yrke) {
  const demoroller = PERSONAL.filter(p => p.demo && p.yrke === yrke);
  return {
    demoroller,
    floden: FLODEN.filter(f => yrkeFor(f.roll) === yrke),
    filmer: filmerMedFlode().filter(f => yrkeFor(f.roll) === yrke),
    ovningar: OVNINGAR_V1.filter(o => o.roller.includes(yrke)),
    prov: Object.values(PROVTYPER).filter(p => p.roller.includes(yrke)),
    testroller: TESTROLLER.filter(r => yrkeFor(r.demoroll ?? r.invanare) === yrke),
  };
}

// Länken till en film från docs/utbildning/, där filmerna ligger i docs/filmer/.
export const filmLank = (id) => filmFil(id).replace(/^docs\//, '../');

const stycken = (...s) => s.filter(Boolean).join('\n\n');

export function materialFor(yrke) {
  const roll = ROLLER[yrke];
  if (!roll) throw new Error(`Okänd yrkesroll för utbildningsmaterialet: ${yrke}`);
  const d = delar(yrke);
  const namn = rollnamn(yrke);
  const forst = d.demoroller[0];
  const ut = [];

  ut.push(`# Utbildning i Vårdkällan: ${namn}`);
  ut.push(`Det här materialet hör till ${KURS}. Det skrivs ur Vårdkällans egna register, så att arbetsflödena, filmerna, övningarna och uppdragen alltid är de som finns i systemet.`);

  ut.push('## Vad du gör i Vårdkällan');
  ut.push(roll.beskrivning);
  ut.push(stycken(
    'Systemet är experten, inte du. Det betyder att systemet fyller i det som det kan räkna ut ur sammanhanget, till exempel vårdkontakt, enhet, tid och koder. Det föreslår nästa steg och kontrollerar mot regler och kodverk innan något sparas.',
    'När något inte går, eller när systemet varnar, står det på vanlig svenska varför och vad du kan göra i stället. Du behöver aldrig kunna kodverk, regler eller lagtext för att göra rätt.',
  ));
  if (yrke === INVANARE) {
    ut.push('I demon väljer du en påhittad patient under Patient på startsidan. Inloggningen med e-legitimation är simulerad.');
  } else if (d.demoroller.length) {
    ut.push(stycken(
      'I demon väljer du en demoroll under Personal på startsidan. Demorollerna för din yrkesroll är:',
      d.demoroller.map(p => `- ${p.namn}, ${p.titel}`).join('\n'),
      'Alla patienter i demon är påhittade och har testpersonnummer från Skatteverket. Varje besökare får en egen sandlåda, så det du gör påverkar ingen annan.',
    ));
  }

  if (d.floden.length) {
    ut.push('## Vanliga arbetsflöden');
    ut.push('Varje arbetsflöde har en klickbudget: det största antalet klick, fältbyten och tangenttryck som flödet får kräva. Budgeten mäts automatiskt i gränssnittet efter varje ändring, så att ett flöde inte blir krångligare utan att det märks.');
    for (const f of d.floden) {
      const vem = namnFor(f.roll);
      ut.push(`### ${f.namn}`);
      ut.push(stycken(
        `Börjar i: ${f.start}. Klickbudget: högst ${f.budget} steg.${vem ? ` I demon gör ${vem} flödet.` : ''}`,
        f.motivering,
      ));
    }
  }

  if (d.filmer.length) {
    ut.push('## Instruktionsfilmer');
    ut.push('Filmerna visar ett arbetsflöde från början till slut med textade steg på svenska. De spelas in på nytt efter varje ändring i gränssnittet, så att de alltid visar det gränssnitt som finns.');
    for (const f of d.filmer) {
      ut.push(`### ${f.rubrik}`);
      ut.push(stycken(f.beskrivning, `Flöde: ${f.flodesnamn}, klickbudget ${f.budget}. [Se filmen](${filmLank(f.id)})`));
    }
  }

  if (d.ovningar.length) {
    ut.push('## Övningar');
    ut.push(`Övningarna görs under Utbildning i demon. Servern rättar svaren och förklarar varje svar. När alla svar är rätt får du ett intyg som gäller i ${GILTIG_DAGAR} dagar. Här står frågorna med rätt svar och förklaringen, så att du kan läsa på före och efter.`);
    d.ovningar.forEach((o, i) => {
      const ratt = o.alternativ.find(a => a.id === o.ratt);
      const lank = nar(o.prova, yrke) && forst
        ? `Pröva i demon: logga in som ${forst.namn} och öppna [samma ställe i demon](${DEMO}/${o.prova}).`
        : null;
      ut.push(`### Övning ${i + 1}`);
      ut.push(stycken(o.fraga, `Rätt svar: ${ratt.text}`, o.forklaring, lank));
    });
  }

  if (d.prov.length) {
    ut.push('## Praktiska prov');
    ut.push('Ett praktiskt prov görs på riktigt i en övningsjournal, som är en av demons påhittade patienter. Systemet kontrollerar själv att det blev rätt och säger på vanlig svenska vad som saknas. Utbildaren eller verksamhetschefen startar proven för vårdenheten. Ett godkänt prov gäller i ett år.');
    for (const p of d.prov) {
      ut.push(`### ${p.titel}`);
      ut.push(p.uppgift('patienten i övningsjournalen'));
    }
  }

  if (d.testroller.length) {
    ut.push('## Uppdrag i testinbjudan');
    ut.push('Uppdragen görs i demon under Testa (#/testa). De följer så långt det går Sussas användbarhetstestfall och ligger i den ordning en arbetsdag har dem. Systemet bockar av ett uppdrag själv när det har hänt, och ett uppdrag som går ut på att hitta något har en fråga som systemet rättar.');
    for (const r of d.testroller) {
      ut.push(`### ${r.knapp}`);
      ut.push(r.om);
      ut.push(r.uppdrag.map((u, i) => {
        const x = uppdragUt(u);
        const rader = [`${i + 1}. ${x.titel}${x.sussa ? ` (Sussas testfall ${x.sussa})` : ''}.`];
        for (const t of x.text) rader.push(`   ${t}`);
        if (x.fraga) rader.push(`   Fråga: ${x.fraga}`);
        if (x.slut) rader.push(`   Klart när: ${x.slut}`);
        return rader.join('\n');
      }).join('\n'));
    }
  }

  ut.push('## Det här ska du kunna efter utbildningen');
  const kunna = [...roll.kunna];
  if (d.floden.length) kunna.push('göra de vanliga arbetsflödena ovan inom klickbudgeten');
  if (d.ovningar.length) kunna.push(`svara rätt på alla ${d.ovningar.length} övningar och få intyget`);
  ut.push(kunna.map(k => `- ${k[0].toUpperCase()}${k.slice(1)}.`).join('\n'));

  return `${ut.join('\n\n')}\n`;
}

// Rollerna i den ordning materialet listas: personalkatalogens ordning och sist invånaren.
export const ordning = () => [...Object.keys(YRKEN).filter(y => ROLLER[y]), INVANARE];

// docs/utbildning/README.md: utbildningskonceptet och utbildningsplanen, med en tabell över rollerna.
export function index() {
  const alla = filmerMedFlode();
  const prov = Object.values(PROVTYPER);
  const rader = ordning().map((y) => {
    const d = delar(y);
    return `| [${rollnamn(y)}](${filnamn(y)}) | ${d.floden.length} | ${d.filmer.length} | ${d.ovningar.length} | ${d.testroller.reduce((n, r) => n + r.uppdrag.length, 0)} |`;
  });
  const ut = [];
  ut.push('# Utbildning i Vårdkällan');
  ut.push('Det här är utbildningskonceptet och utbildningsplanen för Vårdkällan, och utbildningsmaterialet för varje yrkesroll. Materialet är på svenska och skrivet för vuxna yrkesverksamma, motsvarande nivå C1 i Europarådets gemensamma referensram för språk: korta stycken, vanliga ord och fackord där vården använder dem.');

  ut.push('## Grundtanken');
  ut.push('Systemet är experten, inte användaren. Systemet fyller i det det kan räkna ut, föreslår nästa steg och förklarar på vanlig svenska varför något inte går. Därför handlar utbildningen mer om arbetsflödena och om vad systemet gör åt användaren än om knappar och kodverk. Ett flöde som kräver mycket utbildning är ett tecken på att flödet behöver göras om, och varje vanligt flöde har en klickbudget som mäts automatiskt.');

  ut.push('## Utbildningskonceptet');
  ut.push(stycken(
    'Utbildningen har sex delar, som bygger på varandra. Alla delar utom den lärarledda utbildningen finns i systemet i dag.',
    `1. E-utbildning i systemet. Under Utbildning gör varje användare övningarna för sin yrkesroll: korta kunskapsfrågor om hur Vårdkällan fungerar, med demopatienter. Servern rättar och förklarar varje svar. Den som svarar rätt på alla får ett intyg i ${KURS} som gäller i ${GILTIG_DAGAR} dagar. Verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, vilka vars intyg går ut inom ${GAR_UT_DAGAR} dagar och vilka som saknar intyg.`,
    `2. Praktiska prov i en övningsjournal. Ett praktiskt prov är en uppgift som görs på riktigt i journalen för en påhittad patient, och systemet kontrollerar själv att det blev rätt. I dag finns ${prov.length} prov: ${prov.map(p => p.titel.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' och $1')}.`,
    `3. Instruktionsfilmer. ${alla.length} korta filmer visar de vanligaste arbetsflödena från början till slut, med textade steg på svenska. De ligger i docs/filmer/ och spelas in på nytt efter varje ändring i gränssnittet.`,
    '4. Hjälp i sammanhanget och nyheter. Rutan Hjälp i de vanligaste flödena säger vad användaren gör och vad systemet gör, och länkar till övningarna. Efter en ny version visar systemet nyheterna för rollen, med ändrade arbetssätt först.',
    '5. Lärarledd utbildning. En utbildare leder ett pass för en yrkesroll i demon, som är Vårdkällans utbildningsmiljö. Varje deltagare har en egen sandlåda och kan göra fel utan att något påverkas. Passet följer materialet för rollen: arbetsflödena, filmerna och uppdragen i testinbjudan, och slutar med övningarna och ett praktiskt prov. Den lärarledda utbildningen ordnas av den organisation som inför systemet.',
    '6. Superanvändare. På varje vårdenhet ska det finnas minst en superanvändare, som i Vårdkällan är en utbildare: någon som själv har ett giltigt intyg och som verksamhetschefen har gett ett utbildarintyg. Utbildaren ändrar vårdenhetens egna övningar, startar praktiska prov och följer upp vilka som har klarat dem. Det är ingen egen inloggningsroll, utan en behörighet för den som redan arbetar på vårdenheten.',
  ));

  ut.push('## Utbildningsplan');
  ut.push(stycken(
    'Planen gäller ett införande på en vårdenhet och den löpande utbildningen efteråt.',
    '1. Före start utbildas superanvändarna först: hela materialet för deras yrkesroll, övningarna, de praktiska proven och en genomgång av hur de följer upp de andra.',
    '2. Varje användare gör e-utbildningen före den lärarledda utbildningen: läser materialet för rollen, ser filmerna och gör övningarna.',
    '3. Lärarledd utbildning per yrkesroll i demon, med uppdragen i testinbjudan som övningsuppgifter, följd av ett praktiskt prov.',
    '4. Vid start finns superanvändarna på vårdenheten, och synpunkter lämnas med knappen Lämna synpunkt på varje sida.',
    `5. Löpande: nyheterna efter varje ny version, nya filmer när ett arbetsflöde ändras och ett nytt intyg varje år. Systemet påminner när ett intyg går ut inom ${GAR_UT_DAGAR} dagar.`,
  ));

  ut.push('## Utvärdering av utbildningen');
  ut.push(stycken(
    'Utbildningen utvärderas med det som systemet redan mäter:',
    [
      '- Intygen och de praktiska proven: vilka som har klarat dem och när intygen går ut, per vårdenhet.',
      '- Klickbudgeten: att de vanliga arbetsflödena inte kräver fler steg än budgeten, mätt automatiskt efter varje ändring.',
      '- Synpunkterna från varje vy och jämförelsefrågan efter varje uppdrag i testinbjudan: om flödet var lättare, ungefär lika eller svårare än i det journalsystem testaren använder i dag.',
      '- Användartest med personer som arbetar i vården, med protokollet i docs/anvandartest.md.',
    ].join('\n'),
    'Ett flöde där många svarar fel på en övning, misslyckas med ett prov eller lämnar synpunkter är först en fråga om flödet, och sedan om utbildningen.',
  ));

  ut.push('## Så hålls materialet aktuellt');
  ut.push(stycken(
    'Materialet skrivs ur systemets egna register med scripts/dokument-md.js: arbetsflödena och klickbudgeten ur klickbudget.js, filmerna ur instruktionsfilmer.js, övningarna ur seed/ovningar.js, de praktiska proven ur praktiska-prov.js och uppdragen ur testinbjudan.js. Ett automatiskt test stoppar bygget om filerna här inte är exakt det som skrivs ur registren, om ett arbetsflöde eller en film i materialet inte finns i registren eller om en roll med övningar saknar material.',
    'Övningarna i materialet är version 1, som den står i koden. Ändrar verksamhetschefen eller en utbildare övningarna i gränssnittet, gäller den nya versionen i systemet, och materialet visar fortfarande version 1.',
  ));

  ut.push('## Material per roll');
  ut.push(['| Roll | Arbetsflöden | Filmer | Övningar | Uppdrag |', '| --- | --- | --- | --- | --- |', ...rader].join('\n'));
  return `${ut.join('\n\n')}\n`;
}

// Filerna i docs/utbildning/: README.md och en fil per roll.
export const filer = () => [['README.md', index()], ...ordning().map(y => [filnamn(y), materialFor(y)])];
