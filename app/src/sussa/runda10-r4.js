// Runda 10, r4: testnamnen för in- och utfarter (app/test/infarter.test.js), mätvärden med skala 2 och inmatning
// (app/test/syremattnad.test.js), uppmärksamhetsinformation enligt Socialstyrelsens kodverkslista
// (app/test/uppmarksamhet.test.js), skannade restjournaler (app/test/restjournal.test.js) och donation
// (app/test/donation.test.js), och klickbudgetens flöden, för mappningen av Sussa 3.1.3.3, 3.1.3.8, 3.1.3.9, 3.1.5.1,
// 3.1.10.1, 3.1.10.2 och 3.1.12.1.
import { TEST } from '../krav.js';

const { GK } = TEST;
const IF = 'In- och utfarter > ';
const MV = 'Mätvärden, skala 2 och inmatning > ';
const UM = 'Uppmärksamhetsinformation > ';
const RJ = 'Skannade restjournaler > ';
const DN = 'Donation och transplantation > ';

export const INFARTER = [
  `${IF}typen avgör storlek, KVÅ-kod och nästa skötsel, och registreringen knyts till den pågående vårdkontakten`,
  `${IF}skötseln står i avdelningens planering, och en försenad skötsel markeras`,
  `${IF}en infart följs över tid: skötsel, byte och avveckling med KVÅ, och raderna ändras aldrig`,
  `${IF}systemet stoppar en andra urinkateter och förklarar fel storlek på vanlig svenska`,
  `${IF}vid sängen kontrolleras armbandet mot patienten och förpackningens utgångsdatum`,
  `${IF}behörighet: undersköterskan läser men registrerar inte, och en annan vårdenhet ändrar inte`,
  `${IF}spärr och inre sekretess: en spärrad vårdenhets infart syns inte och röjs inte, varken i listan, tidslinjen eller planeringen`,
  `${IF}FHIR: insättning, skötsel och avveckling är Procedure med KVÅ och samma behörighet`,
  `${IF}tidslinjen i översikten har insättning och avveckling`,
  `${GK}Registrera en perifer venkateter inom budget`,
];

export const MATVARDEN = [
  `${MV}SpO2 skala 2: poängen följer Chart 1, och utan uppgift om luft eller syrgas räknas syremättnaden inte`,
  `${MV}systemet föreslår skala 2 vid andningssvikt med hyperkapné, läkaren beslutar med ett klick och NEWS2 räknas med skala 2`,
  `${MV}skala 2 gäller bara där beslutet syns: en spärrad vårdenhets beslut räknas inte och röjs inte`,
  `${MV}varje mätvärde visar om det är manuellt eller maskinellt inmatat, och listan kan väljas ut efter typ, inmatning och period`,
];

export const UMI = [
  `${UM}kodverkslistan är Socialstyrelsens version 6.1.2 med Snomed CT, ICD-10-SE, ATC och motivering för termerna`,
  `${UM}registrerad uppmärksamhetsinformation har termen ur kodverkslistan med koder och motivering`,
  `${UM}förslag ur läkemedelslistan: immunmodulerande behandling och cytostatika enligt kodverkslistan`,
  `${UM}manuell registrering bara ur listan, och samma term inte två gånger`,
];

export const RESTJOURNAL = [
  `${RJ}systemet läser textlagret och föreslår dokumenttyp och period, och kontrollerar personnumret`,
  `${RJ}skanningen sparar dokumentet med metadata, och samma fil eller fel patient stoppas`,
  `${RJ}restjournalen visas i kronologin tillsammans med migrerad historik och ny dokumentation, och filen loggas`,
  `${RJ}texten i restjournalen är sökbar i sökfältet i journalen`,
  `${RJ}vårdadministratören skannar men läser inte, och fel roll och fel vårdenhet nekas`,
  `${RJ}en spärrad vårdenhets restjournal syns inte och röjs inte, varken i listan, tidslinjen eller sökningen`,
  `${RJ}ett dokument som skannats till fel patient makuleras med orsak, raderas inte och försvinner ur kronologin`,
  `${GK}Skanna in en restjournal inom budget`,
];

export const DONATION = [
  `${DN}ett dödsfall på intensivvården ger de donationsansvariga ett förslag i inkorgen att pröva donation`,
  `${DN}checklistan bockas av där systemet kan, och den medicinska bedömningen får sitt underlag ur journalen`,
  `${DN}närståendes uppgift om inställningen, checklistan klar, KVÅ för bedömningen och underlag till kvalitetsregistret`,
  `${DN}donationsanteckningen skrivs av systemet ur checklistan, och läkaren signerar den`,
  `${DN}en transplantation ger bidiagnos ur ICD-10-SE och uppmärksamhetsinformationen föreslår transplantat`,
  `${DN}behörighet: fel roll, fel vårdenhet och spärr, och tidslinjen visar bara det som får ses`,
  `${GK}Pröva donation efter ett dödsfall på intensivvården inom budget`,
];
