// Runda 12, r1: testerna för konfiguration utan programmerare, gemensamma för mappningen av Sussa 12.1.1.6, 12.1.1.7,
// 12.1.1.8 och 12.1.1.10 och för vårt D11 i krav.js.
const JS = 'Journalens struktur > ';
const LR = 'Läkemedelsregler som konfiguration > ';
const AK = 'Administration som konfiguration > ';
const UE = 'Undantag av en enskild anteckning > ';

export const R12R1 = {
  mall: `${JS}mall: en ny mall med ett nytt sökord godkänns av en annan systemförvaltare och används direkt i journalen`,
  sokordKod: `${JS}mall: systemet sätter koden för ett känt sökord, kontrollerar Snomed CT:s kontrollsiffra och stoppar en kod som redan har ett annat namn`,
  mallFhir: `${JS}mall: FHIR lämnar ut anteckningen med anteckningstypens och sökordens koder`,
  mallVersion: `${JS}mall: en ny version visar vad som påverkas, och skrivna anteckningar ändras inte`,
  mattypKontroll: `${JS}mattyp: en ny mätvärdestyp kontrolleras mot NPU, LOINC och UCUM, och en kod som redan används stoppas`,
  mattypJournal: `${JS}mattyp: efter godkännandet går den att registrera inom de rimliga värdena, och FHIR lämnar ut den med kod och UCUM`,
  mattypLast: `${JS}mattyp: koden och enheten kan inte ändras när värden finns, men gränserna kan`,
  fyraOgon: `${JS}fyra ögon: en beslutad version ändras eller raderas inte, ett godkännande prövas igen och allt loggas`,
  behorighet: `${JS}behörighet: bara systemförvaltningen ändrar journalens struktur, och svaren innehåller inga patientuppgifter`,
  ram: `${JS}ram: vårdgivarens ram anger sökord som måste finnas och sökord som får läggas till lokalt`,
  lokal: `${JS}lokal: en vårdenhets anpassning inom ramen gäller bara på vårdenheten, och en anpassning utanför ramen stoppas`,
  ramAndras: `${JS}ram: en ny ram visar vilka lokala anpassningar som slutar gälla, och de slutar gälla när den godkänns`,
  lmNy: 'Läkemedelsmallar i gränssnittet > en läkare bygger en ny läkemedelsmall med systemets förslag, och den används först när den mallansvariga läkaren har godkänt den',
  lmApi: 'Läkemedelsmallar i gränssnittet > API: en läkare ändrar en läkemedelsmall i gränssnittet och ser vem som ska godkänna den',
  interaktioner: `${LR}interaktioner: vårdgivarens lista är en demoregel med fyra ögon, och en ny interaktion ger en varning vid ordination`,
  maxdoser: `${LR}maxdoser och njurfunktion: högsta dygnsdosen och gränserna för metformin är parametrar som läses vid varje ordination`,
  orsak: `${LR}ordinationsorsak och uppföljningsdatum: frivilliga där NLL inte berörs om vårdgivaren väljer det, och alltid krav vid förskrivning`,
  tidbok: `${AK}tidboken och vårdgarantin: reglerna är parametrar med samma standardvärden, och väntelistan räknar gränsen ur det godkända värdet`,
  avgifter: `${AK}avgifterna och högkostnadsskyddet: parametrar med fyra ögon som avgiften räknas ur, och sidan säger vad som inte går att ändra`,
  enskild: `${UE}en enskild anteckning undantas från visning med fyra ögon, och journalen, sökningen och direktläsningen visar den inte`,
  enskildVersion: `${UE}en rättelse av en undantagen anteckning är också undantagen, och ett undantag på en anteckning i pågående vård stoppas`,
  enskildSparr: `${UE}ett undantag på en spärrad vårdenhets anteckning röjer inget: svaret är detsamma med och utan undantaget`,
  enskildKanaler: `${UE}FHIR, publiceringen och producenten för tjänstekontrakt prövar samma undantag, och Min journal visar anteckningen`,
  api: `${JS}API: systemförvaltaren föreslår en mall och en mätvärdestyp, kollegan godkänner i sin egen inloggning, och konfigurationen stannar i sandlådan`,
};

// Strukturerad information (12.1.1.7) och mallarna inom ramar (D11).
export const TESTER_STRUKTUR = [R12R1.mall, R12R1.sokordKod, R12R1.mallFhir, R12R1.mallVersion, R12R1.mattypKontroll, R12R1.mattypJournal, R12R1.mattypLast, R12R1.fyraOgon, R12R1.behorighet, R12R1.api];
export const TESTER_RAMAR = [R12R1.ram, R12R1.lokal, R12R1.ramAndras];
export const TESTER_LAKEMEDELSMALLAR = [R12R1.lmNy, R12R1.lmApi];
// Läkemedel (12.1.1.8).
export const TESTER_LAKEMEDELSREGLER = [R12R1.interaktioner, R12R1.maxdoser, R12R1.orsak];
// Administration (12.1.1.6).
export const TESTER_ADMINISTRATION = [R12R1.tidbok, R12R1.avgifter];
// Undantas från visning (12.1.1.10).
export const TESTER_UNDANTAG_ENSKILD = [R12R1.enskild, R12R1.enskildVersion, R12R1.enskildSparr, R12R1.enskildKanaler];
