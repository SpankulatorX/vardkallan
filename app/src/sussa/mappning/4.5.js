// Sussa 4.5 Operationsplanering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: operationsplaneringen (operation.js), se docs/design.md, avsnittet Specialistområden.
import { OPERATION as T } from '../runda9-r3.js';

const alla = Object.values(T);

export default [
  { id: '4.5.1.1', kategori: 'system', egna: [], tester: alla, avsedd: 'delvis',
    losning: 'Operationsplaneringen följer patienten från operationsanmälan via väntelista, planering av sal, team och tid och förloppet på salen till uppvakningen och uppföljningen per vårdenhet. Den finns i API:t.',
    expert: 'Systemet sätter KVÅ, operationstid, mål för väntetiden och förberedelser ur ingreppet och prioriteten, föreslår tid och team och håller ordningen och checklistan under operationen.',
    anmarkning: 'Delvis: grundfunktionen för hela kedjan finns i demon med fyra ingrepp, fem påhittade salar och anestesiteamet som simulerat. Inget eget gränssnitt för operationsplaneringen finns ännu, och anestesijournal, sterilgods och materialbeställning saknas.' },
  { id: '4.5.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.anmalan, T.forberedelser, T.vantelista, T.planering, T.kallelse, T.oversikt, T.behorighet, T.sakerhet, T.api],
    losning: 'Läkaren anmäler till operation med ingrepp, sida, prioritet och anestesiform. Patienten står på vårdenhetens väntelista i ordning efter målet för väntetiden. Planeringen väljer sal, tid, operatör och operationssjuksköterska, prövar krockar, skriver kallelsen och kan stryka med orsak. Förberedelserna visar prover, anestesibedömning och kallelse, och proverna beställs med ett klick.',
    expert: 'Systemet sätter KVÅ, operationstid och mål ur prioriteten, föreslår första lediga tid och teamet och nekar dubbelbokning med förklaring. Proverna före operationen, med blodgruppering och bastest vid risk för blödning, väljer systemet själv.',
    anmarkning: 'Delvis: salarna, salstiden och operationstiderna är demoregler, anestesiteamet är simulerat och kallelsen skickas av en simulerad tjänst. Planering över flera vårdenheter och resurser som utrustning saknas.' },
  { id: '4.5.1.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.checklista, T.atgard, T.oversikt, T.sakerhet, T.api],
    losning: 'Under operationen registreras in på sal, anestesistart, knivtid, operationens slut och ut från sal, WHO:s checklista för säker kirurgi i tre delar och implantat med lot- eller serienummer. Ingreppet blir en åtgärd med KVÅ på vårdkontakten och syns i FHIR som Procedure. Dagens operationer per sal visas på enhetsnivå.',
    expert: 'Systemet sätter tiderna och håller ordningen, kräver checklistans del före anestesi, snitt och utflyttning, fyller i allergier och blodbeställning ur journalen och registrerar KVÅ-koden själv. En annan vårdenhets operation visas bara som upptagen tid.',
    anmarkning: 'Delvis: anestesiförlopp, läkemedel och vätskor under operationen och sterilgods registreras inte. Checklistan är förkortad.' },
  { id: '4.5.1.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.uppvak, T.overrapport, T.sakerhet, T.api],
    losning: 'På uppvakningen registreras kontrollerna, och systemet prövar kriterierna för utskrivning. Vid utskrivningen skriver systemet överrapporteringen till vårdavdelningen och ordinerar de postoperativa kontrollerna, som hamnar bland avdelningens planerade uppgifter.',
    expert: 'Systemet säger vilka kriterier som inte är uppfyllda och varför, skriver överrapporteringen i SBAR-form ur operationen och föreslår kontrollerna var fjärde timme under ett dygn.',
    anmarkning: 'Delvis: kriterierna är en demoregel efter modell av Aldrete och PADSS. Postoperativa läkemedel och smärtlindring ordineras som vanliga ordinationer i läkemedelslistan.' },
  { id: '4.5.1.5', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.uppfoljning, T.api],
    losning: 'Uppföljningen per vårdenhet räknar väntande och väntande över målet, väntetid till operation och andel inom målet, strukna operationer per orsak, salsutnyttjande och genomförda operationer per ingrepp med operationstid mot beräknad tid, utan personuppgifter.',
    expert: 'Systemet räknar allt ur anmälningarna, planeringen och förloppet, så att ingen behöver föra statistik.',
    anmarkning: 'Delvis: uppföljningen finns i API:t men ännu inte i datauttaget för uppföljning (datauttag.js) eller i ett gränssnitt.' },
];
