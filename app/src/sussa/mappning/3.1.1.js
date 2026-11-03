// Sussa 3.1.1 Identifikation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';

const { F, S, GK } = TEST;
const I = 'Identitet > ';

const IDENTITETER = [
  `${I}typbestämning: personnummer, samordningsnummer, reservnummer och OID känns igen i alla vanliga skrivsätt`,
  `${I}tio siffror och plustecken ger rätt sekel`,
  `${I}kontrollsiffror: fel kontrollsiffra, datum och längd förklaras på svenska`,
  `${I}demon tar bara testpersonnummer och samordningsnummer byggda på dem`,
  `${I}reservnummer skapas av systemet med påhittat format, OID-rot för dokumentation och rätt könssiffra`,
  `${I}seed: samordningsnummer, reservnummer, OID och en dubblett`,
  `${I}API: sök hittar patienten på varje identitetstyp, i valfritt format, och på en tidigare identitet`,
  `${I}API: registrera patient utan känd identitet ger reservnummer och vårdkontakt`,
  `${I}behörighet: registrering och ny identitet kräver rätt yrkesroll och vårdrelation, och nekade försök loggas`,
  `${I}FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler`,
  `${F}Patient har personnummer med rätt identifier-system`,
  `${S}personnummer kommer från Skatteverkets testpersonnummer`,
  `${GK}Registrera patient utan känd identitet inom budget`,
];

const SAMMANSLAGNING = [
  `${I}systemet hittar dubbletten på namn och födelsedatum, men aldrig för skyddad identitet eller två personnummer`,
  `${I}API: nytt personnummer ersätter reservnumret, och det gamla finns kvar som tidigare identitet`,
  `${I}API: ett nummer som tillhör en annan journal blir ett förslag om sammanslagning`,
  `${I}sammanslagning: journal, spärrar, vårdrelationer och skyddad identitet följer med och den gamla journalen leder till den gällande`,
  `${I}API: sammanslagning flyttar journalen, och sök, logglista och huvud leder till den gällande journalen`,
  `${I}behörighet: bara vårdadministratören slår samman, och bara journaler som systemet har föreslagit`,
  `${I}FHIR: Patient har alla identifierare med HL7 Swedens system och Patient.link för sammanslagna journaler`,
  `${GK}Slå samman en dubblett inom budget`,
];

const ANM_TYPER = 'Simulerat i demon: reservnumret har ett påhittat format (VK, födelsedatum, löpnummer och kontrollsiffra) under OID-roten 1.3.6.1.4.1.32473.1, som är IANA:s nummer för dokumentation (RFC 5612) och inte tillhör någon region. Personnummer och samordningsnummer går bara att använda om de är Skatteverkets testpersonnummer och testsamordningsnummer. Det finns ingen koppling till folkbokföringen (PU-tjänsten), så namnet skrivs in för hand och ett samordningsnummers giltighet kontrolleras inte hos Skatteverket. Nationellt reservnummer och regionernas egna reservnummerformat stöds inte, men ett reservnummer från en annan vårdgivare kan registreras som en identitet med sin OID.';
const ANM_SAMMAN = 'En sammanslagning går inte att ångra i demon. Att dela upp två journaler som slogs samman av misstag är inte byggt. Spärrar och vårdrelationer följer med, men Min journal-inloggningen följer bara med när den gamla journalen hade en invånare kopplad.';

export default [
  {
    id: '3.1.1.1', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: IDENTITETER,
    losning: 'Patienten kan ha personnummer, samordningsnummer, reservnummer eller en annan identitet med OID. Identiteten används för sökning, visning och FHIR, och varje patient har alltid en gällande identitet och sin historik.',
    expert: 'Användaren skriver eller klistrar in numret i vilket format som helst, och systemet avgör självt vad det är genom kontrollsiffran, dag plus 60 för samordningsnummer och reservnumrets format. Är något fel säger systemet vad på vanlig svenska, och reservnummer skapar systemet självt.',
    anmarkning: ANM_TYPER,
  },
  {
    id: '3.1.1.2', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: SAMMANSLAGNING,
    losning: 'När personnummer eller samordningsnummer blir känt blir det den gällande identiteten, och den gamla finns kvar som tidigare identitet och går att söka på. Två journaler för samma person slås samman: all journalinformation, spärrar, vårdrelationer och skyddad identitet följer med, den gamla journalen leder till den gällande, åtkomstloggen visas för båda och sammanslagningen loggas.',
    expert: 'Systemet hittar själv troliga dubbletter, på namn, födelsedatum och kön eller när ett nummer som skrivs in redan tillhör en annan journal, och avgör vilken journal som blir kvar. Vårdadministratören ser förslaget i inkorgen och bekräftar med ett klick.',
    anmarkning: ANM_SAMMAN,
  },
  {
    id: '3.1.1.3', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: [...IDENTITETER, `${I}API: sök förklarar ett felskrivet nummer`],
    losning: 'Fyra typer av identitet i samma fält och samma sökning: personnummer, samordningsnummer, reservnummer och OID-identitet. FHIR Patient har alla identifierare, personnummer och samordningsnummer med HL7 Swedens system och de andra med sin OID.',
    expert: 'Samma sökfält tar namn eller vilket nummer som helst, och systemet avgör vad det är, förklarar ett felskrivet nummer och hittar också patienter på tidigare identiteter. Ingen typlista att välja i.',
    anmarkning: ANM_TYPER,
  },
  {
    id: '3.1.1.4', kategori: 'system', egna: ['L6'], avsedd: 'uppfyllt_demo',
    tester: SAMMANSLAGNING,
    losning: 'Sammanslagning av tidigare identiteter med den senast gällande, med historik över alla identiteter, Patient.link i FHIR och en logg över vem som slog samman vad och varför.',
    expert: 'Systemet föreslår sammanslagningen, visar journalerna sida vid sida och väljer själv vilken journal som blir kvar (personnummer före samordningsnummer, OID och reservnummer). Skyddad identitet föreslås aldrig på namn, bara när hela numret har skrivits in.',
    anmarkning: ANM_SAMMAN,
  },
];
