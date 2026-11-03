// Testerna för tidboken (tidbok.js) som mappningen av Sussa 3.4.1 till 3.4.4 pekar på. Ligger utanför mappning/,
// eftersom den katalogen bara har en fil per avsnitt.
import { klickbudgetTest } from '../krav.js';
import { FLODEN } from '../klickbudget.js';

const TB = 'Tidbok > ';
export const T = {
  seed: `${TB}seeden har scheman per mottagning och vårdgivare med tidstyper, och dagens patienter på kardiologiska mottagningen`,
  remissVantelista: `${TB}en accepterad remiss hamnar på väntelistan av sig själv med tidstyp, yrkesroll, prioritet och vårdgaranti som demoregel`,
  forslag: `${TB}systemet föreslår tider med rätt tidstyp och yrkesroll, före gränsen, hos tidigare vårdgivare och inte samma dag som en annan tid`,
  boka: `${TB}en remiss bokas med ett klick: bokningen blir en planerad vårdkontakt och kallelsen går ut av sig själv`,
  kallelse: `${TB}kallelsen skrivs ur bokningen på enkel svenska, med kanal vald av systemet och utan journaltext`,
  paminnelse: `${TB}påminnelsen skickas automatiskt två dagar före tiden`,
  vantelista: `${TB}väntelistan lyfter den som riskerar att passera gränsen, och omprioritering kräver orsak och sparas`,
  omboka: `${TB}ombokning flyttar den planerade vårdkontakten och systemet skickar en ny kallelse`,
  avboka: `${TB}avbokning tar bort den planerade kontakten, lägger tillbaka posten på väntelistan och meddelar patienten`,
  incheckning: `${TB}incheckning registrerar ankomsten på den planerade vårdkontakten, ger konummer och visar avgiften`,
  betalning: `${TB}betalningen räknas av systemet: kort, faktura, frikort och avgiftsfrihet, simulerad och märkt`,
  startsida: `${TB}startsidan visar dagens arbete i ordning med en enda nästa åtgärd per rad`,
  gruppExempel: `${TB}exemplet på gruppkallelsen skrivs ur en mall och aldrig ur en sparad kallelse till en patient`,
  grupp: `${TB}gruppkallelse skickar en kallelse till varje deltagare och loggas per patient`,
  skyddad: `${TB}skyddad identitet: kallelser bara i Min journal med förklaring, och inget namn i listorna eller på incheckningsskärmen`,
  behorighet: `${TB}behörighet: bara vårdadministratören bokar, kallar, checkar in och hanterar väntelistan`,
  nekad: `${TB}utan vårdrelation eller remiss nekas bokningen, och en annan vårdenhets tidbok går inte att använda`,
  tidbok: `${TB}tidboken per mottagning och vårdgivare visar tider, beläggning och regler, och kan visas utan namn`,
  kallelseEnhet: `${TB}en kallelse på en annan vårdenhet kan inte markeras som lämnad, och försöket loggas`,
  egenIncheckning: `${TB}patienten checkar in själv i Min journal och ankomsten registreras på vårdkontakten`,
  egenbokning: `${TB}patienten bokar om och avbokar i Min journal på de tidstyper mottagningen öppnar, med samma förslag`,
  egenRegler: `${TB}egenbokning stängs 24 timmar före tiden och för tidstyper som mottagningen inte öppnar`,
  fhir: `${TB}FHIR: Schedule, Slot och Appointment med status för incheckning och samma behörighet och loggning`,
  fhirInvanare: `${TB}FHIR: invånaren ser bara sina egna Appointment`,
  avvisad: 'Tidbok, säkerhetsgranskning > en bokning ger inte bestående vårdrelation när remissen avvisas: tiden avbokas och patienten får besked',
  relationsfonster: 'Tidbok, säkerhetsgranskning > en planerad kontakt ger vårdrelation bara till 90 dagar efter tiden',
  skyddadKallelse: 'Tidbok, säkerhetsgranskning > kallelsetexten och adressen för en patient med skyddade personuppgifter visas inte för personalen',
  skarm: 'Tidbok, säkerhetsgranskning > incheckningsskärmen visar inte avgiften och stoppar många försök',
};
export const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));
