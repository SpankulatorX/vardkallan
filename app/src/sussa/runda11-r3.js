// Testerna för graviditet, förlossning och BB i runda 11, r3 (obstetrik.js, forlossning.js, graviditetsregistret.js och
// r11r3-rutter.js), för mappningen av Sussa 4.7.
const GR = 'Graviditet, förlossning och BB > ';

export const GRAVIDITET_R11 = {
  ivf: `${GR}IVF-graviditeten: beräknad partus räknas från embryoöverföringen, ultraljudet ändrar den inte och IVF ingår i riskbedömningen`,
  ultraljud: `${GR}ultraljudsjournalen: ett ultraljud till vecka 22 daterar graviditeten, och tillväxtultraljudet jämför den skattade vikten och varnar för liten för tiden och viktskillnad mellan tvillingar`,
  samtal: `${GR}inskrivningssamtalet: levnadsvanorna blir en signerad anteckning, och tobak och anamnes ger råd och beslutsstöd för graviditetsdiabetes och havandeskapsförgiftning`,
  vald: `${GR}frågorna om våld: svaren lämnas aldrig ut i graviditetsjournalen, uppföljningen eller registret och läses bara på den vårdenhet som ställde dem, med logg`,
  valdEj: `${GR}frågorna om våld ställs bara när kvinnan är ensam, och annars påminner systemet vid nästa besök`,
  ctg: `${GR}CTG från simulerad utrustning: systemet klassar kurvan som normal, avvikande eller patologisk, och barnmorskan bekräftar eller motiverar en annan bedömning`,
  ctgTvilling: `${GR}CTG vid tvillingar har en kanal och en analys per foster`,
  smart: `${GR}smärtlindring: före EDA kontrollerar systemet trombocyterna bland det som den inloggade får se`,
  anmalan: `${GR}födelseanmälan till Skatteverket (simulerad): barnet får ett av Skatteverkets testpersonnummer i stället för reservnumret, och en mor utan personnummer får förklaringen`,
  bb: `${GR}BB-journalen: systemet räknar viktnedgången, varnar för feber och blödning, säger när PKU tas och prövar utskrivningskriterierna för mor och barn`,
  efterkontroll: `${GR}efterkontrollen: EPDS och fråga 10 ger varningar, och mödrahälsovården föreslår efterkontrollen efter förlossningen`,
  register: `${GR}Graviditetsregistret (simulerat): kontrollen före utskicket håller kvar poster med fel, undantar den som har motsatt sig och skickar bara nya poster`,
  uppfoljning: `${GR}uppföljningen räknar inskrivning, ultraljud, smärtlindring, CTG, födelseanmälan och efterkontroll utan personuppgifter`,
  oversikt: `${GR}förlossningens och mödrahälsovårdens översikter visar bara det som den inloggade får se, och en spärrad vårdenhets graviditet syns inte`,
  sakerhet: `${GR}säkerhet: åtgärderna på förlossningen och BB ger 404 för en annan patient och 403 för en annan vårdenhet`,
  api: `${GR}API: barnmorskan på förlossningen kopplar CTG, bedömer, registrerar smärtlindring, födelse, födelseanmälan och BB i gränssnittets anrop`,
  datauttag: `${GR}datauttaget har tabellerna Graviditet och Forlossning utan personuppgifter och utan svaren om våld`,
  barnSkydd: `${GR}säkerhet: ett barn med skyddade personuppgifter eller spärr lämnas inte ut i datauttaget eller till Graviditetsregistret, och förlossningen räknas som utelämnad`,
  seed: `${GR}seeden har en graviditet på mödrahälsovården, en pågående förlossning med CTG och tvillingar på BB, relativt till seedens tid`,
};
