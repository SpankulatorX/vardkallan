// Runda 12, r2: uppgraderingar med återgång (vårt D7 och M8), säkerhetskopior på två platser med återställning till en
// tidpunkt (Sussa KD1.1.3.6), lagringsklasser (KD1.1.3.5) och lasttestet (KD1.1.1.5). Testnamnen delas med krav.js.
const R = 'Releaser > ';
const K = 'Säkerhetskopior > ';
export const T = {
  backa: `${R}varje migrering har en återställning, och upp och sedan ned ger samma schema som före`,
  start: `${R}schemakontrollen när servern startar tillämpar saknade migreringar och backar en nyare versions med de återställningar som sparades i databasen`,
  sparad: `${R}en sparad sandlåda som läses in får sitt schema kontrollerat, och versionen i drift gäller efter en återgång`,
  visar: `${R}uppgraderingen visar nyheterna, API:ts ändringslogg och migreringarna för versionen`,
  stoppas: `${R}en uppgradering vars tester inte är gröna stoppas och kan inte godkännas`,
  aterga: `${R}återgång till förra versionen backar databasen, och uppgraderingen används först när två olika systemförvaltare har godkänt den`,
  roll: `${R}bara systemförvaltningen ser och gör uppgraderingar`,
  api: `${R}API: återgång och godkännande av två systemförvaltare i var sin inloggning, och servern visar schemaversionen`,
  tvaPlatser: `${K}varje kopia skrivs på två platser och verifieras på båda, och sandlådans id syns inte i något filnamn`,
  skadad: `${K}en skadad kopia underkänns, och återläsningen tar den från den andra platsen`,
  schema: `${K}schemaläggningen tar en kopia av varje sandlåda som har ändrats sedan sin senaste kopia, och sparar ett begränsat antal`,
  tidpunkt: `${K}återställning till en tidpunkt tar den senaste verifierade kopian före tidpunkten, sparar läget före och behåller loggarna`,
  kopiaRoll: `${K}bara systemförvaltningen ser och återställer kopiorna`,
  kopiaApi: `${K}API: systemförvaltaren ser när den senaste kopian togs och om den är verifierad, och återställer sandlådan till en tidpunkt`,
};
export const TESTER_RELEASER = [T.backa, T.start, T.sparad, T.visar, T.stoppas, T.aterga, T.roll, T.api];
export const TESTER_PROGNOS = [
  'Lagringsprognos > prognosen räknar tillväxten det senaste året och skriver fram storleken, också med fördubblad aktivitet',
  'Lagringsprognos > lagringsklasserna delar upp volymen efter ålder och visar kostnaden per månad med och utan klasser',
];
export const TESTER_KOPIOR = [T.tvaPlatser, T.skadad, T.schema, T.tidpunkt, T.kopiaRoll, T.kopiaApi];

// Lasttestet (scripts/lasttest.js). Resultatet läses ur lasttest.json och räknas bara när det gäller samma kod.
export const TESTER_LAST = [100, 500].map(n => `Lasttest > ${n} samtidiga användare: p95 under svarstidsmålet för varje åtgärd och inga fel`);

const POSTER = {
  'KD1.1.1.5': {
    avsedd: 'uppfyllt_demo',
    tester: TESTER_LAST,
    losning: 'Systemförvaltaren skapar en acceptanstestmiljö, en utbildningsmiljö eller en testmiljö ur en kopia av produktionsmiljön med ett klick. Acceptanstestmiljön är en kopia med skarpa data där systemet avidentifierar patientuppgifterna: namn, personnummer och andra identiteter, adress, telefon och kontaktperson byts överallt, också i fritext, och loggarna börjar om. Utbildnings- och testmiljön har fiktiva patienter med reglerna, parametrarna och de andra gemensamma inställningarna kopierade från produktionen. Varje miljö är märkt överst på varje sida och i API:t. Dimensioneringen är prövad med ett lasttest som spelar realistiska flöden för 100 och 500 samtidiga användare mot servern (inloggning, arbetslistan, sökning, översikten, journalen, läkemedlen, mätvärdena, registrering av mätvärden och inkorgen) och mäter svarstiden per åtgärd mot svarstidsmålet i D5. Resultatet följer med i bygget och räknas bara när det gäller samma kod som byggs.',
    anmarkning: 'I demon är produktionsmiljön besökarens sandlåda, och miljöerna är nya sandlådor på samma server. Lasttestet körs mot en lokal container på utvecklarens dator, och användarna delar sandlådor tio och tio, på samma sätt som många användare delar en databas i driften. SLA:erna för övriga miljöer gäller driften och är inte prövade. Kravet är formulerat som ett åtagande för anbudsgivaren.',
  },
  'KD1.1.3.5': {
    avsedd: 'delvis',
    tester: TESTER_PROGNOS,
    losning: 'Varje uppgift hör till en huvudman genom den enhet den registrerades på, och en huvudmans uppgifter tas ut till en egen databas med samma tabeller, index och triggrar (se KD1.1.3.4). Sidan Lagring visar databasens storlek, antal rader per tabell och de största tabellerna, och en prognos ur tillväxten: hur många rader som tillkom det senaste året, och storleken på databasen och kopiorna på två platser om ett, tre och tio år, både med dagens tillväxt och med fördubblad aktivitet. Lagringsklasserna (snabb lagring för aktuella uppgifter och billigare lagring för uppgifter äldre än tre år) har kvalitet, svarstid och pris per gigabyte, och sidan visar hur volymen fördelas på klasserna och vad lagringen kostar per månad med och utan klasser.',
    expert: 'Systemet räknar tillväxten och prognosen själv ur uppgifternas datum, så att ingen behöver mäta eller räkna för att se när lagringen behöver byggas ut. Det visar också vad det skulle spara att lägga äldre uppgifter i billigare lagring.',
    anmarkning: 'Lagringsklasserna och prognosen finns i demon, men uppgifterna flyttas inte till en separat databas: det kräver att journalens läsningar, uttagen och säkerhetskopiorna läser från två databaser, och det är inte byggt. Priserna per gigabyte är demovärden. Prognosen är linjär ur det senaste årets tillväxt.',
  },
  'KD1.1.3.6': {
    avsedd: 'uppfyllt_demo',
    tester: [...TESTER_KOPIOR, T.backa, T.start, T.aterga],
    losning: 'Varje sandlåda kopieras på ett schema (var femtonde minut när något har ändrats) och före varje återställning och återgång till en tidigare version. Kopian är en konsistent ögonblicksbild av hela databasen och skrivs på två platser. Båda verifieras: kontrollsumman ska vara densamma som för ögonblicksbilden, och kopian läst från platsen ska vara en hel databas med alla tabeller och med åtkomstloggens och säkerhetsloggens hashkedjor hela. Systemförvaltaren återställer sandlådan till en vald tidpunkt: systemet tar den senaste verifierade kopian före tidpunkten, läser den från den andra platsen om den första är skadad, tar först en kopia av läget som det är och för över loggraderna som har skrivits efter kopian, så att varken journalen eller loggen förlorar något. Applikatoriska fel möts av att uppgraderingar går att backa med de återställningar som sparas i databasen, och det som skrivits i en ny version sparas undan vid en återgång. Det som har registrerats går inte att radera eller skriva över: signerade anteckningar, loggar, ändringar av konfigurationen och flyttar vid omorganisation skyddas av databasens triggrar, och loggarna har hashkedjor som visar om något har ändrats. Vid störningar i nätet arbetar personalen vidare i läskopian och skrivkön, och dataläckage förhindras av behörighetsmotorn och av att sandlådans id aldrig syns i kopiornas namn.',
    expert: 'Systemförvaltaren väljer bara en tidpunkt i en lista, och sidan Lagring visar när den senaste kopian togs och om den är verifierad på båda platserna. Systemet väljer den rätta kopian, kontrollerar den innan den används och sparar läget före, så att en återställning aldrig gör saken värre.',
    anmarkning: 'Demoregel: de två platserna är två kataloger på samma server, eller två lager i minnet när servern inte sparar till disk. I driften är den andra platsen en annan volym på en annan ort. Återställningen går till den senaste kopian före tidpunkten, så det som gjordes mellan kopian och tidpunkten återställs inte (högst femton minuter). Skydd mot krascher i den fysiska infrastrukturen och störningar i nätet utanför applikationen hör till driften.',
  },
};

// Lägger rundans tillägg ovanpå avsnittets poster.
export const medR12r2 = (poster) => poster.map(x => {
  const p = POSTER[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...(x.tester ?? []), ...tester])] };
});
