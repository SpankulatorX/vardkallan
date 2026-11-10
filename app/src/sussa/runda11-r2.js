// Testerna för operationsplaneringen och anestesin i version 1.1 (runda 11, r2), för mappningen av Sussa 4.5.1.1 till
// 4.5.1.5 och 4.6.1.4 (app/test/operation-r11.test.js och klickbudgeten).
const OP = 'Operation 1.1 > ';
const AN = 'Operation 1.1, anestesi och material > ';
const GK = 'Gränssnitt > Klickbudget > ';

export const OPERATION11 = {
  block: `${OP}salsblocken fördelar salarna mellan vårdenheterna, också på andra sjukhus, och ett block kan släppas och tas av en annan vårdenhet`,
  frislapp: `${OP}ett block som vårdenheten inte har fyllt släpps för andra vårdenheter på sjukhuset två dagar före`,
  team: `${OP}teamet planeras med anestesiläkare och anestesisjuksköterska, och utrustning och instrumentgaller bokas och prövas mot krockar`,
  paverkar: `${OP}vårdhändelser som kan påverka ett planerat ingrepp visas med anmälan, och bara det som den inloggade får se räknas`,
  checklista: `${OP}identiteten kontrolleras med armbandet när patienten kommer in på salen, och WHO:s checklista finns i full omfattning med det systemet vet ifyllt`,
  program: `${OP}sessionen säger om vårdenheten opererar, och dagens program räknar ut när nästa operation kan börja när en operation drar ut på tiden`,
  seed: 'Operation 1.1, seeden > seeden har en genomförd operation för Margareta Forsberg, dagens program och väntelistan (2026-11-09T07:00:00.000Z)',
  anestesibedomning: `${AN}anestesibedömningen knyts till operationsanmälan med riskskalor, samtycke, giltighetstid och information till patienten`,
  anestesijournal: `${AN}anestesijournalen har täta värden från den simulerade monitorn, läkemedel med föreslagen dos och kontroll mot allergier, vätskor och händelser`,
  sterilgods: `${AN}sterilgodset: systemet reserverar instrumentgallren med charge och utgångsdatum, räkningen ska stämma och gallren går tillbaka till sterilcentralen`,
  material: `${AN}materialet: plocklistan ur ingreppet, förbrukningen drar från förrådet, implantat kräver lot och förrådet beställs av sig självt`,
  uppvakning: `${AN}uppvakningen på enhetsnivå, avvikelser från planeringen och överrapporteringen med det som gavs under operationen`,
  uppfoljning: `${AN}uppföljningen räknar inflöde, utrustning, punktlighet och tid på uppvakningen, och datauttaget har operationerna utan personuppgifter`,
  sakerhet: `${AN}säkerhet och behörighet: anestesijournalen, sterilgodset och materialet ger 404 för en annan patient, ändras bara av den anmälande vårdenheten och syns inte bakom en spärr`,
  api: 'Operation 1.1, API > api: koordinatorn ser dagens program, blocken, uppvakningen, förrådet och anestesijournalen, och undersköterskan på kardiologen ser ingen operation',
  // Beslut 2026-11-10: anestesin som egen vårdenhet, giltigheten och ASA-bekräftelsen.
  anestesiRelation: 'Operation 1.1, anestesienheten > anestesienheten får vårdrelation genom operationsanmälan, men inte till andra patienter och inte efter att operationen och uppvakningen är avslutade',
  anestesiLasning: 'Operation 1.1, anestesienheten > anestesienheten läser operationen och gör bedömningen, och den opererande enhetens journal kräver ett aktivt val med förvalt syfte',
  giltighet: 'Operation 1.1, anestesienheten > giltigheten: tolv månader, fem för barn under sju år, provsvar högst tre månader och en varning när tillståndet har ändrats efter bedömningen',
  asa: 'Operation 1.1, anestesienheten > ASA-klassen bekräftas på operationsdagen före induktionen, av en läkare',
  kbPlanera: `${GK}Planera en operation från väntelistan inom budget`,
  kbInSal: `${GK}Registrera att patienten kommer in på salen inom budget`,
};
