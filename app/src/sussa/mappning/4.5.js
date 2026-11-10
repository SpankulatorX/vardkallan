// Sussa 4.5 Operationsplanering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: operationsplaneringen (operation.js), se docs/design.md, avsnittet Specialistområden.
// Runda 11, r2: salsblock, team med anestesi, utrustning, anestesijournal, sterilgods, material, gränssnitt och datauttag
// (operation.js, anestesijournal.js, sterilgods.js, patient-operation.js och vyer/operation.js), se docs/design.md,
// avsnittet Operationsplanering och anestesi, version 1.1.
import { OPERATION as T } from '../runda9-r3.js';
import { OPERATION11 as U } from '../runda11-r2.js';

const DEMO = 'Salarna, salstiden, salsblocken, utrustningen, instrumentgallren, förrådets artiklar och operationstiderna är demoregler, anestesimonitorn, sterilcentralen och förrådet är simulerade och kallelsen skickas av en simulerad tjänst.';

export default [
  { id: '4.5.1.1', kategori: 'system', egna: [], tester: [...Object.values(T), ...Object.values(U)], avsedd: 'uppfyllt_demo',
    losning: 'Operationsplaneringen följer patienten från operationsanmälan via väntelista, planering av sal, block, team, utrustning och tid och förloppet på salen med anestesijournal, checklista, sterilgods och material till uppvakningen, överrapporteringen och uppföljningen. Läkare och sjuksköterskor arbetar i fliken Operation i journalen, och operationsavdelningen har en egen vy med dagens program, väntelistan, uppvakningen, salsblocken, förrådet och uppföljningen.',
    expert: 'Systemet sätter KVÅ, operationstid, mål för väntetiden och förberedelser ur ingreppet och prioriteten, föreslår tid, team och utrustning, håller ordningen och checklistan under operationen och skriver överrapporteringen.',
    anmarkning: `Uppfyllt i demon. ${DEMO} Anestesin är en egen vårdenhet på varje sjukhus, och anmälan är en beställning till den.` },
  { id: '4.5.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.anmalan, T.forberedelser, T.vantelista, T.planering, T.kallelse, T.oversikt, T.behorighet, T.sakerhet, T.api, U.block, U.frislapp, U.team, U.paverkar, U.anestesibedomning, U.seed, U.api, U.kbPlanera, U.anestesiRelation, U.anestesiLasning, U.giltighet],
    losning: 'Läkaren anmäler till operation med ingrepp, sida och prioritet. Patienten står på vårdenhetens väntelista i ordning efter målet för väntetiden. Planeringen väljer sal, tid, operatör, operationssjuksköterska, anestesiläkare och anestesisjuksköterska, bokar utrustning och instrumentgaller, prövar krockar och skriver kallelsen, och en operation kan strykas med orsak. Salstiden är fördelad i block mellan de opererande vårdenheterna, också på andra sjukhus i regionen, och ett block kan släppas och tas av en annan vårdenhet. Förberedelserna visar prover, anestesibedömning med giltighetstid och kallelse, och vårdhändelser som kan påverka ingreppet (antikoagulantia, insulin, feber och nya diagnoser) visas med anmälan.',
    expert: 'Systemet föreslår första lediga tid i vårdenhetens egna block, sedan på andra sjukhus och sist i öppna salar, med team och utrustning som är lediga, och nekar en dubbelbokning med förklaring, och ett block som inte är fyllt släpps av sig självt för andra vårdenheter två dagar före. Proverna före operationen väljer systemet själv, och det som kan påverka ingreppet hämtar systemet ur journalen.',
    anmarkning: `Uppfyllt i demon. ${DEMO}` },
  { id: '4.5.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.checklista, T.atgard, T.oversikt, T.sakerhet, T.api, U.checklista, U.anestesijournal, U.sterilgods, U.material, U.program, U.sakerhet, U.seed, U.api, U.kbInSal, U.asa],
    losning: 'Under operationen registreras in på sal med kontroll av id-bandet, anestesistart, knivtid, operationens slut och ut från sal, och WHO:s checklista för säker kirurgi i full svensk omfattning i tre delar. Anestesijournalen har värden var femte minut från anestesimonitorn, läkemedel med dos, vätskor in och ut med balans och händelser som intubation och komplikationer. Instrumentgallren registreras med charge och utgångsdatum och räknas innan patienten lämnar salen, och förbrukningen enligt plocklistan med implantaten med lot. Ingreppet blir en åtgärd med KVÅ. Dagens program per sal visar förloppet och räknar ut när nästa operation kan börja när en operation drar ut på tiden.',
    expert: 'Systemet sätter tiderna och håller ordningen, fyller i det på checklistan som det redan vet (id-band, allergier, blod, samtycke, monitor, team, profylax, sterilgods och implantat), föreslår antibiotikaprofylax och induktionsdos ur ingreppet, vikten och allergierna, stoppar ett läkemedel som patienten är överkänslig mot och ett utgånget galler, och kräver att räkningen stämmer.',
    anmarkning: `Uppfyllt i demon. ${DEMO}` },
  { id: '4.5.1.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.uppvak, T.overrapport, T.sakerhet, T.api, U.uppvakning, U.sterilgods, U.material, U.seed, U.api],
    losning: 'På uppvakningen registreras kontrollerna, och systemet prövar kriterierna för utskrivning. Operationsavdelningen ser alla patienter på uppvakningen med tid och kriterier. Vid utskrivningen skriver systemet överrapporteringen till vårdavdelningen med det som gavs under operationen och ordinerar de postoperativa kontrollerna. Avvikelsen från planeringen (start och tid på salen) visas för varje operation, instrumentgallren går tillbaka till sterilcentralen och förrådet beställs när en artikel når beställningspunkten.',
    expert: 'Systemet säger vilka kriterier som inte är uppfyllda och varför, skriver överrapporteringen i SBAR-form ur operationen och anestesijournalen, räknar avvikelsen från planeringen och beställer material av sig självt.',
    anmarkning: `Uppfyllt i demon. Kriterierna för utskrivning är en demoregel efter modell av Aldrete och PADSS. ${DEMO} Postoperativa läkemedel och smärtlindring ordineras som vanliga ordinationer i läkemedelslistan.` },
  { id: '4.5.1.5', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.uppfoljning, T.api, U.uppfoljning, U.api],
    losning: 'Uppföljningen per vårdenhet räknar inflöde, väntande och väntande över målet, väntetid till operation och andel inom målet, strukna operationer per orsak, salsutnyttjande, bokningar av utrustning och instrumentgaller, punktlighet för dagens första operation, tid på uppvakningen och genomförda operationer per ingrepp med operationstid mot beräknad tid, utan personuppgifter. Den visas i operationsavdelningens vy, och datauttaget för uppföljning har en tabell med operationerna.',
    expert: 'Systemet räknar allt ur anmälningarna, planeringen, förloppet och uppvakningen, så att ingen behöver föra statistik.',
    anmarkning: 'Uppfyllt i demon. Tidsgränsen för punktlighet (tio minuter) är en demoregel.' },
];
