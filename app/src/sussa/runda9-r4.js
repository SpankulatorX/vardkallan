// Runda 9, r4: testnamnen för informationsstrukturen (NI), nationellt fackspråk, förvaltningen av kodverk, masterdatan
// och migreringen (app/test/arkitektur.test.js). Mappningsfilerna för Sussa 5.1.1, 5.1.2 och 5.1.3 pekar hit.
const NI = 'Informationsstruktur > ';
const NF = 'Nationellt fackspråk > ';
const KF = 'Förvaltning av kodverk > ';
const MD = 'Masterdata > ';
const MG = 'Migrering > ';

export const T = {
  niKlasser: `${NI}modellen har NI 2023:2:s informationsklasser och begrepp med termbankens definitioner, och varje klass som används finns i NI`,
  niTabeller: `${NI}varje tabell med patientuppgifter har en NI-klass, och en tabell som ingen har klassat får NI:s allmänna klass och visas`,
  niFhir: `${NI}varje FHIR-resurs i API:t har en NI-klass, och NI:s attribut pekar på kolumner som finns`,
  niApi: `${NI}API: informationsmodellen visar klasserna med tabeller och FHIR-resurser för inloggad personal, utan patientuppgifter`,
  nfKoder: `${NF}varje Snomed-kod i delmängden har rätt kontrollsiffra och partition och en kontrollerad engelsk term`,
  nfSokord: `${NF}varje sökord i journalens mallar har en Snomed-kod eller en förklaring, och anteckningen får koden i FHIR`,
  nfDelar: `${NF}NF:s delar är Snomed CT, ICD-10-SE, KVÅ och termbanken, och API:t visar hur var och en används`,
  nfAtgard: `${NF}åtgärder med KVÅ har samma åtgärd i Snomed CT, och fynd och provtyper i beställning och svar ingår i delmängden`,
  kvRegister: `${KF}varje kodverk har version, giltighet, utgivare och källa, och Vårdkällans egna kodverk finns med som lokala`,
  kvJamfor: `${KF}en ny utgåva kontrolleras och jämförs med den som gäller: nya, ändrade och borttagna koder och hur många diagnoser som berörs`,
  kvFyraOgon: `${KF}en utgåva gäller först när en annan systemförvaltare har godkänt den, och aldrig bakåt i tiden`,
  kvDiagnos: `${KF}en diagnos prövas mot den utgåva som gäller den dagen, och en kod som har tagits bort förklaras`,
  kvLokalt: `${KF}ett lokalt kodverk från verksamheten skapas med fyra ögon och dess koder går att hämta i API:t`,
  kvApi: `${KF}API: bara systemförvaltningen förvaltar kodverken, och historiken visar vem som lade in och godkände`,
  mdKodverk: `${MD}en ny utgåva av ett kodverk från källan läses in och läggs fram för godkännande med jämförelsen färdig`,
  mdLakemedel: `${MD}läkemedelskatalogen läses från källan: nya och ändrade produkter förs in och en produkt som saknas står kvar`,
  mdListning: `${MD}listningen läses från källan, och en omlistning flyttar vårdrelationen till den nya vårdcentralen`,
  mdScheman: `${MD}arbetsscheman, prislistor, beställarregistret och tillgängligheten i förrådet följer samma kontrakt och synkronisering`,
  mdSchema: `${MD}masterdatan läses in efter ett schema som systemförvaltningen ändrar, och en ny sandlåda räknar seeden som första inläsningen`,
  mdParameter: `${MD}vilka delar som är masterdata är parametrar: en del som förvaltas i Vårdkällan läses inte in`,
  mdTillganglig: `${MD}en källa som inte svarar ändrar ingenting, de senast giltiga uppgifterna används och avvikelsen visas`,
  mdApi: `${MD}API: systemförvaltaren läser in en del direkt, och andra roller får inte`,
  mgImport: `${MG}en migreringsfil valideras, läses in med källa och stäms av mot antalet i filen`,
  mgAvvikelse: `${MG}en post som inte går att läsa in blir en avvikelse med orsak, och samma fil två gånger läses inte in igen`,
  mgBehorighet: `${MG}bara systemförvaltningen läser in, posterna märks som migrerade och syns i patientens tidslinje`,
};

export const TESTER_NI = [T.niKlasser, T.niTabeller, T.niFhir, T.niApi];
export const TESTER_NF = [T.nfKoder, T.nfSokord, T.nfDelar, T.nfAtgard];
export const TESTER_KODVERK = [T.kvRegister, T.kvJamfor, T.kvFyraOgon, T.kvDiagnos, T.kvLokalt, T.kvApi];
