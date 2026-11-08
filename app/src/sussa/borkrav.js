// Bör-krav och målbild ur Sussas kravspecifikation som en egen backlogg (K5). Varje rad är ett önskemål eller en del av
// målbilden som inte är ett skall-krav, med källan i förfrågningsunderlaget och de poster i registret som den hänger
// ihop med. Statusen räknas fram ur posternas status i index.js: uppfyllt_demo när alla poster är uppfyllda i demon,
// planerat när alla är planerade och annars delvis.
//   id       B för bör-krav och M för målbild, med löpnummer.
//   typ      bor eller malbild.
//   kalla    dokument och avsnitt i förfrågningsunderlaget.
//   text     önskemålet eller målbilden, kort och med kravspecifikationens egna ord där det går.
//   poster   id i Sussa-registret.
// Meningar med bör som bara anvisar hur anbudssvaret ska skrivas (sidantal, sidhänvisningar, vad beskrivningen ska
// omfatta, i 2.1.1.1, 11.3.1.10 och KD1.1.1.9) är inte önskemål om systemet och finns därför inte med.
export const UTELAMNADE = ['2.1.1.1', '11.3.1.10', 'KD1.1.1.9'];

const KAP = (n) => `Kravspecifikation lösning, kapitel ${n}`;
const DRIFT = 'Kravspecifikation drift och teknik';

export default [
  // Bör-krav.
  { id: 'B1', typ: 'bor', kalla: `${KAP(7)}, Grundläggande behov`, text: 'Om möjligt bör kärnsystemet även hantera uthämtning och betalning av hjälpmedel.', poster: ['3.4.4.4', '7.1.1.2'] },
  { id: 'B2', typ: 'bor', kalla: `${KAP(7)}, avsnitt 7.1`, text: 'Ekonomisk information bör kunna visualiseras i kärnsystemet om så önskas.', poster: ['7.1.2.1'] },
  { id: 'B3', typ: 'bor', kalla: `${KAP(7)}, avsnitt 7.1.1`, text: 'Kärnsystemet bör hantera faktureringsunderlag och schabloniserade kostnadsberäkningar och ge information som stödjer faktureringen i ekonomisystemet.', poster: ['7.1.1.1', '7.1.1.2'] },
  { id: 'B4', typ: 'bor', kalla: `${KAP(7)}, avsnitt 7.1.2`, text: 'Priser på läkemedel, hjälpmedel och behandlingar bör kunna visas i kärnsystemet.', poster: ['7.1.2.1'] },
  { id: 'B5', typ: 'bor', kalla: `${KAP(7)}, utvärderingskriterium 7.1.2.1`, text: 'Kärnsystemet bör kunna visualisera kostnaderna i en pågående patients vårdprocess.', poster: ['7.1.2.1'] },
  { id: 'B6', typ: 'bor', kalla: `${KAP(5)}, avsnitt 5.4 Arkivering`, text: 'Patientjournaler bör finnas kvar under patientens livstid och därefter stå till forskningens förfogande, enligt de allmänna råd som SKL och Riksarkivet har gett.', poster: ['5.4.2.1', '5.4.2.3', '5.4.2.4'] },
  { id: 'B7', typ: 'bor', kalla: `${KAP(5)}, avsnitt 5.4 Arkivering`, text: 'Uppgifter som behövs för patientens fortsatta vård bör föras över till ett mellanarkiv, där vårdinformationssystemet har integrerad åtkomst till dem.', poster: ['5.4.2.2'] },

  // Målbild.
  { id: 'M1', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'Partnerskap mellan patient och vårdgivare, så att patient och anhöriga kan vara aktiva i planering, genomförande och uppföljning av vården.', poster: ['3.7.1.1', '3.7.1.2', '3.7.1.3', '3.3.2.1'] },
  { id: 'M2', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'Vård på distans i olika former och stöd för nya vårdflöden och vårdformer.', poster: ['2.3.1.1', '2.3.1.2', '2.3.1.3'] },
  { id: 'M3', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'IT-stödet upplevs som en helhet med en strukturerad journal per patient, där det är lätt att följa patientens väg genom vården.', poster: ['3.1.2.2', '3.1.7.1', '3.2.2.3'] },
  { id: 'M4', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'Effektiva vårdprocesser med strukturerad och standardiserad information, mobila lösningar och process- och beslutsstöd.', poster: ['3.1.3.5', '3.2.1.2', '3.2.1.3'] },
  { id: 'M5', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'En modern och robust arkitektur med sömlösa integrationer enligt internationell standard och informationsutbyte mellan vårdgivare.', poster: ['2.5.1.2', '2.5.1.3', '5.1.3.3'] },
  { id: 'M6', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'Säker och kostnadseffektiv drift och förvaltning.', poster: ['KD1.1.1.9', '12.3.1.4'] },
  { id: 'M7', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'Uppföljning av kvalitet och produktion med flexibel utdata i realtid.', poster: ['6.2.1.1', '6.3.1.3'] },
  { id: 'M8', typ: 'malbild', kalla: `${KAP(1)}, avsnitt 1.1 Målbild`, text: 'Underlag för forskning och innovation.', poster: ['6.3.3.1', '2.6.1.2'] },
  { id: 'M9', typ: 'malbild', kalla: `${KAP(2)}, utvärderingskriterium 2.5.1.3`, text: 'Tillgång till all information som är meningsfull för verksamheten och användarna, via öppna och generellt tillgängliga API:er och integrationsgränssnitt.', poster: ['2.5.1.1', '2.5.1.2', '2.5.1.3'] },
  { id: 'M10', typ: 'malbild', kalla: `${KAP(5)}, avsnitt 5.2 Identitet och åtkomst`, text: 'Behörighet som tilldelas i en kvalitetssäkrad process utifrån anställning och arbetsuppgifter, och en fristående tjänst för identifiering och autentisering.', poster: ['5.2.1.1', '5.2.1.6', '5.2.1.8'] },
  { id: 'M11', typ: 'malbild', kalla: `${KAP(6)}, Konceptuell målbild för uppföljning och datauttag`, text: 'Kliniskt beslutsstöd, uppföljning av vårdproduktion och uttag för forskning i kärnsystemet, och data till regionernas datalager via en accesspunkt.', poster: ['6.2.1.1', '6.3.1.1', '6.3.1.5', '6.3.3.1'] },
  { id: 'M12', typ: 'malbild', kalla: `${KAP(12)}, avsnitt 12.2 Test`, text: 'Nya leveranser är väl testade av leverantören, så att acceptanstest kan visa att systemet fungerar enligt överenskommelsen.', poster: ['12.2.1.1', '12.2.1.2', '12.2.1.3'] },
  { id: 'M13', typ: 'malbild', kalla: `${DRIFT}, avsnitt 1.1`, text: 'Leverantören levererar drifttjänsten som ett helhetsåtagande och tar ansvar för hela den avtalade leveransen.', poster: ['KD1.1.1.1', 'KD1.1.1.9'] },
  { id: 'M14', typ: 'malbild', kalla: `${DRIFT}, avsnitt 1.1.4`, text: 'Kärnsystemet kan användas från olika klienter, enheter och mobila enheter beroende på sammanhanget.', poster: ['KD1.1.4.4', 'KD1.1.4.10'] },
  { id: 'M15', typ: 'malbild', kalla: `${DRIFT}, avsnitt 1.2`, text: 'Kärnsystemet och drifttjänsten levereras enligt SLA, och utfallet följs upp och redovisas löpande.', poster: ['KD1.2.1.2', 'KD1.2.1.5'] },
  { id: 'M16', typ: 'malbild', kalla: `${DRIFT}, avsnitt 1.3`, text: 'Alla tjänsteleveranser och samarbetet mellan leverantör och beställare följer ITIL, med processer för incidenter, problem, ändringar, releaser och beställningar.', poster: ['KD1.3.1.1', 'KD1.3.2.1', 'KD1.3.3.1', 'KD1.3.4.1', 'KD1.3.5.1', 'KD1.3.6.1'] },
];
