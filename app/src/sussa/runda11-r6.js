// Testerna för undersökningarna, de rättade svaren, underlagen, koderna i svar, de patientnära analyserna, statusen i
// Min journal och parametrarna i beställning och svar (runda 11, r6), gemensamma för mappningen av Sussa 4.4.1, 4.4.2
// och 12.1.1.9.
import { klickbudgetTest } from '../krav.js';
import { FLODEN } from '../klickbudget.js';

const US = 'Undersökningar i beställning och svar > ';
const UL = 'Underlag i beställning och svar > ';
const RS = 'Rättade svar > ';
const KS = 'Koder i svar > ';
const PN = 'Patientnära analyser > ';
const MJ = 'Status i Min journal > ';
const PB = 'Parametrar för beställning och svar > ';
const AU = 'API för undersökningar > ';
const kb = (id) => { const f = FLODEN.find(x => x.id === id); return f ? [klickbudgetTest(f)] : []; };

export const R6 = {
  flera: `${US}en beställning med prover, röntgen och ultraljud blir en beställning till varje specialistsystem under samma beställnings-id`,
  kreatinin: `${US}jodkontrast: utan aktuellt eGFR lägger systemet till P-Kreatinin, och röntgen bokar först när svaret har kommit`,
  egfr: `${US}jodkontrast: eGFR under 30 stoppar, 30 till 44 kräver kvittens, och ett värde på en spärrad vårdenhet varken räknas eller nämns`,
  graviditet: `${US}graviditet: systemet frågar bara kvinnor 12 till 55 år före strålning, stoppar strålning mot buken och tar en registrerad graviditet som ja`,
  implantat: `${US}magnetkamera: implantat i uppmärksamhetsinformationen eller enligt beställaren kräver MR-säkerhetskontroll innan röntgen bokar`,
  arbetslista: `${US}röntgenklinikens arbetslista: prioritet och senaste dag, föreslagen tid, bokning, utförande med studie i arkivet och loggning med grunden utförande`,
  utforare: `${US}arbetslistan och åtgärderna är bara för personalen på den utförande enheten, och skyddad identitet visas utan namn`,
  utlatande: `${US}utlåtandet har KVÅ, fynd i Snomed CT, vårdförloppet och studiens id, och den ansvariga läkaren vidimerar det`,
  simuleringRontgen: `${US}demoknappen Simulera svar bokar och gör aldrig röntgenklinikens undersökningar, så att kontrollerna före undersökningen inte kringgås`,
  fysiologi: `${US}klinisk fysiologi bokar själv, utför när tiden har kommit och bifogar kurvan till svaret`,
  upprepad: `${US}upprepad beställning: en serie beställningar med rätt tider, utan dubblettvarning för de egna delarna och högst 60 dagar framåt`,
  planerat: `${US}planerat: patientens alla planerade prover, undersökningar och kontroller från alla vårdenheter som användaren får se`,
  svf: `${US}standardiserat vårdförlopp föreslås ur vårdkontakten och följer med i beställningen, svaret och till producentsystemet`,
  underlag: `${UL}underlag bifogas till beställningen, typen avgörs ur innehållet, med tak per fil och beställning, och visas med beställningens behörighet`,
  underlagSvar: `${UL}underlag i svaret från producentsystemet (presentedForm) sparas och visas i beställningen och i FHIR`,
  rattat: `${RS}ett rättat svar ersätter mätvärdet, den tidigare versionen finns kvar oförändrad och svaret vidimeras på nytt`,
  rattatDemo: `${RS}demoknappen för ett rättat svar kräver beställningsrätt på den beställande vårdenheten och gäller inte anslutna producentsystem eller instrument`,
  rattatLast: `${RS}den som läste den tidigare versionen får det rättade svaret i inkorgen, och ingen annan`,
  rattatPs: `${RS}producentsystemet skickar ett rättat svar med status corrected, och varje version har ett signerat bevis som stämmer`,
  koder: `${KS}koder i svaret från ett specialistsystem: KVÅ, Snomed CT och vårdförlopp tas emot med text, och en kod i fel form avvisas`,
  instrument: `${PN}en patientnära analys beställs, provet tas och instrumentet skickar svaret genom det öppna gränssnittet med etiketten`,
  instrumentEtikett: `${PN}instrumentets svar med fel etikett avvisas, och svaret bockar av kontrollen av samma mätvärde`,
  minStatus: `${MJ}patienten ser beställningarnas status, bokad tid och förberedelse, och svaret först när det är vidimerat`,
  minRegel: `${MJ}en vårdenhet vars anteckningar inte visas i Min journal visar inte heller sina beställningar`,
  parametrar: `${PB}vad som förs över till det mottagande systemet, etikettskrivarna och anvisningarna ändras med fyra ögon och slår igenom`,
  etikett: `${PB}etikettformatet följer parametern för arbetsplatsen där den som skriver ut arbetar`,
  api: `${AU}läkaren beställer röntgen med frågan om graviditet, röntgensjuksköterskan bokar och registrerar, och Min journal visar statusen`,
};
export const R6_KB = { bestall: kb('bestall-undersokning'), boka: kb('boka-undersokning') };
