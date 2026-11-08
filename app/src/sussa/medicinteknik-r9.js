// Runda 9, r2: testnamnen för medicinteknisk utrustning, anestesi och intensivvård (app/test/medicinteknik.test.js och
// app/test/iva.test.js) och klickbudgetens flöden, för mappningen av Sussa 3.5.2.19, 3.6.1 och 4.6.
import { TEST } from '../krav.js';

const { GK } = TEST;
const MT = 'Medicinteknik > ';
const MP = 'Medicinteknik, infusionspump > ';
const IV = 'Intensivvård > ';

export const T = {
  fhir: `${MT}en patientmonitor skickar mätvärden i FHIR med sin nyckel, och värdena hamnar som mätvärden med källan utrustning bara för den kopplade patienten`,
  nyckel: `${MT}utan giltig nyckel avvisas meddelandet, och nyckeln sparas bara som HMAC och ersätts av en ny`,
  hl7: `${MT}HL7 v2 ORU^R01 enligt IHE PCD-01 tas emot med MDC-koder och ger ett ACK`,
  felFormat: `${MT}ett meddelande i fel format nekas med en förklaring på svenska, och det avvisade meddelandet sparas med orsaken`,
  profiler: `${MT}formaten och profilerna står i CapabilityStatement och på sidan Öppet API`,
  utanKoppling: `${MT}värden utan gällande koppling avvisas, och efter att kopplingen avslutats tas inga fler emot`,
  koppla: `${MT}kopplingen görs genom att skanna utrustningens streckkod, armbandet kontrolleras mot patienten och varje koppling loggas`,
  flytta: `${MT}när utrustningen flyttas till en annan patient avslutas den förra kopplingen utan att den patienten röjs`,
  annanPatient: `${MT}ett meddelande som anger en annan patient än kopplingen avvisas`,
  behorighet: `${MT}fel roll och fel vårdenhet får inte koppla utrustning, och logggranskaren når inte utrustningen`,
  referens: `${MT}värden från utrustning är referens tills en behörig person godkänner dem, och först då räknas de i NEWS2 och larm`,
  godkannare: `${MT}bara behörig personal på vårdenheten godkänner, och ett bedömt värde kan inte bedömas igen eller ändras`,
  sparr: `${MT}ett värde från utrustning på en spärrad vårdenhet syns inte och röjs inte i svaret`,
  egenRegistrera: `${MT}patienten registrerar egna mätningar i Min journal, och de skickas till vårdenheten som vårdar patienten märkta som inte kvalitetssäkrade`,
  egenSkild: `${MT}patientens egna mätningar visas skilda från vårdens värden och räknas inte i NEWS2, larm eller vikt förrän de är bedömda`,
  egenTak: `${MT}egna mätningar har ett tak per dygn, och fel typ eller värde förklaras`,
  pumpDos: `${MP}en infusionspump rapporterar pågående dos, och systemet registrerar given dos med källan utrustning och kontrollerar den mot ordinationen och dygnsdosen`,
  pumpEnhet: `${MP}pumparna i Läkemedel att ge visas bara för vårdenheten, och en pump kopplas bara till en aktiv infusion`,
  simulerad: `${MP}den simulerade utrustningen skickar värden genom samma mottagning, var femte minut för monitorn och var femtonde för pumpen`,
  analys: `${IV}analysen prövar fördefinierade gränser och trender mot de senaste värdena och ger larm och förslag`,
  parametrar: `${IV}parametrarna för analysen finns i konfigurationen med samma standardvärden som modulen`,
  oversikt: `${IV}översikten visar alla patienter på intensivvårdsavdelningen med senaste värden, larm, utrustning och vätskebalans`,
  overvakning: `${IV}övervakningsvyn har täta värden från den simulerade patientmonitorn och kurvor där monitorns värden är märkta`,
  anestesi: `${IV}anestesibedömningen hämtar läkemedel, överkänslighet, diagnoser och tidigare anestesier ur journalen och föreslår ASA-klass och fasta`,
  anestesiSparr: `${IV}anestesibedömningen räknar bara det som läkaren får se, så en spärrad vårdenhets diagnoser röjs inte`,
  infusion: `${IV}en kontinuerlig infusion i sprutpump ordineras med dos per kilo och timme, och systemet räknar hastigheten och föreslår titrering efter mätvärden`,
  infusionVikt: `${IV}en infusion ordineras inte utan godkänd vikt, och en vikt som patienten själv har mätt räknas inte`,
  gemensam: `${IV}infusioner, bolusar och vätskor visas i en gemensam vy med den timvisa vätskebalansen`,
  vatska: `${IV}vätskebalansen räknas timvis och kumulativt, med urin och dränage per timme, urin per kilo och timme och varning för oliguri`,
  uppfoljning: `${IV}uppföljningen räknar vårddygn, beläggning, vårdtyngd och kvalitetsindikatorer per intensivvårdsavdelning utan personuppgifter`,
  // Klickbudgetens flöden (test/flodessteg.cjs).
  kbKoppla: `${GK}Koppla en patientmonitor till patienten inom budget`,
  kbGodkanna: `${GK}Godkänna värden från monitorn inom budget`,
  kbIva: `${GK}Öppna intensivvårdens översikt och övervakningen av en patient inom budget`,
  kbEgen: `${GK}Lämna en egen mätning i Min journal inom budget`,
};
