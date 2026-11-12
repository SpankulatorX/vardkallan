// Runda 13, r2: kapacitet och säkerhet för många besökare. Sandlådor som vilar på disk, inga tappade sandlådor, en
// vänlig sida när demon är full, tak mot missbruk, vågen i lasttestet och fynden från säkerhetsgranskningen av runda 12
// (säkerhetskopiornas tak, återställningen med fyra ögon och flerfaktorn). Testnamnen delas med scripts/lasttest.js.
export const TEST_VAG = 'Lasttest > våg av nya besökare med var sin sandlåda: ingen sandlåda tappas, minnet håller sig under gränsen och p95 under svarstidsmålet';

const V = 'Vilande sandlådor i servern > ';
const F = 'När demon är full > ';
const M = 'Missbruk från många besökare > ';
const K1 = 'Säkerhetsfynd 1: säkerhetskopiorna har tak > ';
const K3 = 'Säkerhetsfynd 3 och 4: återställning och inläsning av kopior > ';
export const T = {
  lagret: 'Vilande sandlådor: lagret > en sandlåda skrivs komprimerad till disk under ett namn som inte röjer id:t och läses in oförändrad',
  taket: 'Vilande sandlådor: lagret > taket i minnet räknas ur containerns minnesgräns, och utan gräns gäller standardvärdet',
  vilar: `${V}en sandlåda som inte har använts på tio minuter skrivs till disk och släpps ur minnet, och nästa anrop läser in den med allt kvar`,
  aktiv: `${V}en aktiv sandlåda tas aldrig bort för att ge plats åt en ny: med plats för tre i minnet finns alla åtta kvar`,
  drift: `${V}sidan om systemets uppbyggnad och driftsidan väcker inga andra sandlådor`,
  attaTimmar: `${V}en sandlåda som inte har använts på åtta timmar försvinner, också från disk och med sina säkerhetskopior`,
  full: `${F}en ny besökare får 503 med en förklaring på svenska och när det är lönt att försöka igen, och de som redan arbetar märker inget`,
  fullMinne: `${F}när alla platser i minnet används just nu får en ny besökare vänta, men en besökare vars sandlåda vilar kommer alltid in`,
  omstart: 'Omstart med vilande sandlådor > vid stopp skrivs sandlådorna till disk, sessionsfilen har inga databaser, och efter start vilar de tills de används',
  uppblast: `${M}en uppblåst sandlåda tar fler platser i minnet, så att minnet håller sig inom budgeten`,
  dbTak: `${M}en sandlåda kan inte växa över taket för databasen, och anropet som skulle göra det får ett begripligt fel`,
  manuella: `${K1}en manuell kopia per minut och tio per timme per sandlåda, sedan 429 med en förklaring`,
  diskTak: `${K1}ett tak för diskutrymmet över alla sandlådor, där de äldsta kopiorna tas bort först`,
  stegvis: `${K1}det schemalagda jobbet tar en sandlåda i taget och släpper fram andra anrop emellan`,
  fyraOgon: `${K3}fynd 4: en ensam systemförvaltare kan inte läsa in en kopia, och förslaget säger vad som går förlorat`,
  sparr: `${K3}fynd 4: en spärr som har registrerats efter kopian stoppar inläsningen med en förklaring, också mellan förslag och godkännande`,
  faktorKvar: `${K3}fynd 3: en faktor som registrerades efter kopian finns kvar efter inläsningen`,
  utloggad: `${K3}fynd 3: efter inläsning av en kopia är sessionen utloggad, och en roll med faktor i kopian kräver faktorn`,
};
export const TESTER_KAPACITET = [T.lagret, T.taket, T.vilar, T.aktiv, T.drift, T.full, T.fullMinne, T.omstart, T.uppblast, T.dbTak];

const POSTER = {
  'KD1.1.1.5': {
    tester: [T.vilar, T.aktiv, T.full],
    anmarkning: 'I demon är produktionsmiljön besökarens sandlåda, och miljöerna är nya sandlådor på samma server. Lasttestet körs mot en lokal container på utvecklarens dator. Nivåerna med 100 och 500 samtidiga användare delar sandlådor tio och tio, på samma sätt som många användare delar en databas i driften, och vågen ger varje ny besökare en egen sandlåda, som när demon får många besökare på en gång. Sandlådor som inte används vilar på disk och läses in igen vid nästa anrop. SLA:erna för övriga miljöer gäller driften och är inte prövade. Kravet är formulerat som ett åtagande för anbudsgivaren.',
  },
  'KD1.1.1.10': {
    avsedd: 'delvis',
    tester: TESTER_KAPACITET,
    losning: 'Servern övervakar sin egen kapacitet i varje anrop: hur många sandlådor som är i minnet och hur mycket minne de tar, hur många som vilar på disk, diskutrymmet för sandlådor och kopior, det lediga utrymmet på disken och svarstiderna. Taket i minnet räknas ur containerns minnesgräns. När minnet behövs flyttar systemet den sandlåda som har varit oanvänd längst till disk, aldrig en som används just nu, och när ett tak är nått får nya besökare en sida som säger när det är lönt att försöka igen, medan de som redan arbetar inte märker något. Sidan Svarstider visar kapaciteten och svarstiderna mot målet.',
    expert: 'Systemet räknar själv ut hur många sandlådor som ryms i minnet och på disken och agerar innan något går sönder. Ingen behöver övervaka minnet eller ta bort sandlådor för hand.',
    anmarkning: 'Kravet gäller leverantörens processer och rutiner för att upptäcka kapacitetsbrister. Det som är byggt är systemets egen del: övervakningen, åtgärderna och lasttestet. Larm till en driftorganisation och kapacitetsplanering över tid finns inte i demon.',
  },
  'KD1.1.3.6': {
    tester: [T.manuella, T.diskTak, T.stegvis, T.fyraOgon, T.sparr, T.faktorKvar, T.utloggad, T.attaTimmar],
    losning: 'Varje sandlåda kopieras på ett schema (var femtonde minut när något har ändrats, en sandlåda i taget) och före varje återställning och återgång till en tidigare version. Kopian är en konsistent ögonblicksbild av hela databasen och skrivs komprimerad på två platser. Båda verifieras: kontrollsumman ska vara densamma som för ögonblicksbilden, och kopian läst från den första platsen ska vara en hel databas med alla tabeller och med åtkomstloggens och säkerhetsloggens hashkedjor hela. Kopiorna har tak: högst åtta per sandlåda, högst en kopia i minuten och tio i timmen som systemförvaltaren ber om, ett tak för hur stor en sandlåda får vara och ett tak för allas kopior tillsammans, där de äldsta tas bort först. En återställning till en tidpunkt föreslås av en systemförvaltare och godkänns av en andra i sin egen inloggning. Systemet tar den senaste verifierade kopian före tidpunkten, läser den från den andra platsen om den första är skadad, visar vad som går förlorat, stoppar återställningen om en spärr har registrerats eller hävts efter kopian, tar först en kopia av läget som det är och för över loggraderna och faktorerna för flerfaktor, så att varken loggen eller ett skydd går förlorat. Efter återställningen loggas alla ut och loggar in på nytt med sin andra faktor. Applikatoriska fel möts av att uppgraderingar går att backa med de återställningar som sparas i databasen. Det som har registrerats går inte att radera eller skriva över: signerade anteckningar, loggar, ändringar av konfigurationen och flyttar vid omorganisation skyddas av databasens triggrar, och loggarna har hashkedjor som visar om något har ändrats.',
    expert: 'Systemförvaltaren väljer bara en tidpunkt i en lista. Systemet väljer den rätta kopian, kontrollerar den, säger på vanlig svenska vad som försvinner och stoppar det som inte får hända, så att en återställning aldrig gör saken värre.',
    anmarkning: 'Demoregel: de två platserna är två kataloger på samma server, eller två lager i minnet när servern inte sparar till disk. I driften är den andra platsen en annan volym på en annan ort. Återställningen går till den senaste kopian före tidpunkten, så det som gjordes mellan kopian och tidpunkten återställs inte (högst femton minuter). Ett förslag om återställning finns i sandlådans session och gäller i 30 minuter. Skydd mot krascher i den fysiska infrastrukturen och störningar i nätet utanför applikationen hör till driften.',
  },
};

// Lägger rundans tillägg ovanpå avsnittets poster.
export const medR13r2 = (poster) => poster.map(x => {
  const p = POSTER[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...(x.tester ?? []), ...tester])] };
});
