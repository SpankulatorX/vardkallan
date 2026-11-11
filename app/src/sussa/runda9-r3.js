// Testerna för specialistområdena i runda 9, r3, gemensamma för mappningen av Sussa 4.2, 4.4.2.12, 4.5, 4.7 och 4.8:
// operation (operation.js), blodprodukter (blod.js), graviditet och förlossning (obstetrik.js), cytostatika
// (cytostatika.js) och bilder och media (bilder.js), och deras API (r9r3-rutter.js).
const OP = 'Operationsplanering > ';
const BL = 'Blodprodukter > ';
const GR = 'Graviditet och förlossning > ';
const CY = 'Cytostatika > ';
const BI = 'Bilder och media > ';
const API = 'API för specialistområdena > ';

export const OPERATION = {
  anmalan: `${OP}läkaren anmäler till operation med ingrepp och sida, och systemet sätter KVÅ, operationstid, anestesi och målet för väntetiden ur prioriteten`,
  forberedelser: `${OP}förberedelserna: systemet listar proverna som saknas, med blodgruppering och bastest vid risk för blödning, och beställer dem med ett klick`,
  vantelista: `${OP}väntelistan för operation står i ordning efter målet för väntetiden och visar bara patienter som den inloggade får se`,
  planering: `${OP}systemet föreslår första lediga tid i en sal på sjukhuset med operatör och operationssjuksköterska, och nekar en dubbelbokning av sal eller team`,
  kallelse: `${OP}planeringen skriver kallelsen med förberedelserna, och en struken operation får orsak och står kvar på väntelistan`,
  checklista: `${OP}under operationen sätter systemet tiderna i ordning, och WHO:s checklista måste vara klar före anestesi, snitt och utflyttning`,
  atgard: `${OP}ingreppet registreras som åtgärd med KVÅ när operationen är slut, och implantatet med lot krävs innan patienten lämnar salen`,
  uppvak: `${OP}uppvakningen prövar kriterierna för utskrivning mot kontrollerna och förklarar vad som saknas`,
  overrapport: `${OP}utskrivningen från uppvakningen skriver överrapporteringen och ordinerar de postoperativa kontrollerna till avdelningen`,
  oversikt: `${OP}dagens operationer per sal visar en annan vårdenhets operation bara som upptagen tid`,
  uppfoljning: `${OP}uppföljningen räknar väntetider, strukna operationer, salsutnyttjande och produktion per ingrepp utan personuppgifter`,
  behorighet: `${OP}behörighet: undersköterskan läser men anmäler inte, och en spärrad vårdenhets operation syns inte i journalen`,
  sakerhet: `${OP}säkerhet: en operationsanmälan för en annan patient ger 404 för varje åtgärd, och en annan vårdenhet ändrar inte operationen ens med aktivt val`,
  api: `${API}operation: läkaren anmäler, sjuksköterskan planerar och registrerar, och en annan patients anmälan ger 404 utan logg på fel patient`,
};

export const BLOD = {
  prover: `${BL}blodgruppering och bastest beställs till blodcentralen som prover och besvaras med blodgrupp och antikroppsscreening`,
  bestall: `${BL}beställningen av blod beställer själv blodgruppering och bastest som saknas och väntar på svaren innan blodcentralen bereder`,
  kedja: `${BL}blodcentralen förenlighetsprövar och bereder enheter med patientens blodgrupp, och beställningen kan följas från upprättad till avslutad`,
  sangen: `${BL}vid sängen kontrollerar systemet id-bandet, enhetsnumret, blodgruppen och den andra personen, och blod som inte startats inom 30 minuter återlämnas`,
  dubbel: `${BL}dubbelkontrollen vid sängen: den andra personen bekräftar i sin egen session, den som förberedde kan inte kontrollera själv och ett id i anropet räcker inte`,
  sakerhet: `${BL}säkerhet: en blodbeställning eller enhet för en annan patient ger 404 för varje åtgärd`,
  forenlighet: `${BL}förenligheten: erytrocyter efter AB0 och RhD, plasma åt andra hållet och trombocyter AB0-lika`,
  positivt: `${BL}ett positivt bastest stoppar beställningen hos blodcentralen med en förklaring`,
  behorighet: `${BL}behörighet: sjuksköterskan beställer inte blod, en annan vårdenhet hanterar inte blodet och en spärrad beställning syns inte`,
  api: `${API}blod: läkaren beställer, proverna besvaras och sjuksköterskan och läkaren kontrollerar vid sängen i var sin inloggning`,
};

export const GRAVIDITET = {
  bpd: `${GR}graviditetsjournalen: systemet räknar beräknad partus ur sista mens och väljer ultraljudet när det skiljer mer än sju dagar`,
  program: `${GR}besöksprogrammet och provschemat räknas ur graviditetsveckan, och systemet beställer proverna vid nästa besök`,
  risk: `${GR}riskbedömningen görs av systemet ur ålder, BMI, diagnoser, tidigare kejsarsnitt, flerbörd och RhD, och flerbörd ger tätare besök`,
  besok: `${GR}vid besöket varnar systemet för förhöjt blodtryck med protein i urinen, avvikande symfys-fundusmått och fosterljud, och blodtrycket blir ett mätvärde`,
  partogram: `${GR}partogrammet: systemet räknar varningslinjen och åtgärdslinjen och säger när förloppet går för långsamt`,
  barn: `${GR}vid tvillingfödsel får varje barn en egen journal med reservnummer kopplad till modern, och födelseuppgifterna förs vidare till barnhälsovården`,
  uppfoljning: `${GR}planeringen och uppföljningen per vårdenhet räknar graviditeter, väntade förlossningar per vecka och förlossningarnas utfall utan personuppgifter`,
  behorighet: `${GR}behörighet: undersköterskan för inte graviditetsjournalen, och en graviditet på en spärrad vårdenhet syns inte för förlossningen`,
  sakerhet: `${GR}säkerhet: en graviditet eller förlossning för en annan patient ger 404, och förlossningen läser graviditetsjournalen först efter ett aktivt val`,
  api: `${API}graviditet: barnmorskan skriver in graviditeten och registrerar ett besök, och uppföljningen räknar den`,
};

export const CYTOSTATIKA = {
  regim: `${CY}ordination ur behandlingsregim: systemet hämtar längd och vikt, räknar kroppsytan och varje dos och lägger ut cyklerna`,
  karboplatin: `${CY}karboplatin doseras med Calverts formel ur njurfunktionen som systemet räknar med Cockcroft-Gault`,
  prov: `${CY}före kuren prövar systemet provsvaren mot regimens gränser, beställer det som saknas och låter läkaren skjuta upp cykeln`,
  dosjustering: `${CY}dosjustering: läkaren väljer andel av full dos med orsak, och systemet räknar om doserna`,
  beredning: `${CY}beredningsordern till beredningsenheten har volym ur stamlösningen, bärarlösning, total volym och etikett med streckkod`,
  sangen: `${CY}vid sängen kontrollerar systemet id-band, etikett och att läkemedlen ges i regimens ordning, och nästa cykel räknas om efter vikten`,
  dubbel: `${CY}dubbelkontrollen: den andra personen bekräftar i sin egen session, den som iordningställde kan inte kontrollera själv och ett id i anropet räcker inte`,
  sakerhet: `${CY}säkerhet: en cykel, dos eller behandling för en annan patient ger 404 för varje åtgärd`,
  enhet: `${CY}säkerhet: åtgärderna prövar behandlingens vårdenhet: annan enhet utan och med aktivt val och spärrad enhet utan och med samtycke`,
  peroral: `${CY}peroral behandling: systemet räknar tabletterna för cykeln och skriver instruktionen när kuren överlämnas till patienten`,
  uppfoljning: `${CY}uppföljningen per vårdenhet räknar behandlingar, planerade och givna kurer, beredningar, dosjusteringar och uppskjutna cykler utan personuppgifter`,
  behorighet: `${CY}behörighet: sjuksköterskan ordinerar inte, en annan vårdenhet ger inte kuren och en spärrad behandling syns inte`,
  api: `${API}cytostatika: läkaren ordinerar och godkänner, beredningsordern hämtas och dubbelkontrollen görs i två inloggningar`,
};

export const BILDER = {
  ladda: `${BI}en bild laddas upp till journalen, typen avgörs ur innehållet och bilden knyts till vårdkontakten och anteckningen`,
  jamfor: `${BI}jämförelse över tid: bilder av samma kroppsställe ställs i tidsordning med dagarna mellan dem`,
  remiss: `${BI}en remissbilaga förs in i journalen med källan märkt, och en textbilaga stannar i remissen`,
  min: `${BI}patientens uppladdning i Min journal går till en vårdenhet där patienten har kontakt och kommer in i journalen först efter granskning`,
  arkiv: `${BI}multimediaarkivet: undersökningen beställs med frågeställning, arkivet svarar med utlåtande och bildlänk, och bilden visas genom arkivet med behörighet och loggning`,
  behorighet: `${BI}behörighet: en bild från en annan vårdenhet kräver aktivt val, en spärrad syns inte alls, och undersköterskan ser bara omvårdnadens bilder`,
  tak: `${BI}taket: en patient har högst 40 bilder, en bild högst 1 MB och en film högst 2 MB i demon`,
  sakerhet: `${BI}säkerhet: en bild eller studie för en annan patient ger 404 och loggas inte på fel patient`,
  granska: `${BI}säkerhet: patientens bild granskas bara av vårdenheten som den skickades till, inte av en annan vårdenhet med aktivt val`,
  sparr: `${BI}säkerhet: en remissbilaga behåller avsändarens vårdenhet, så att en spärr gäller också i journalen, och patientens egen bilaga granskas först`,
  api: `${API}bilder: en bild laddas upp och hämtas som fil med loggning, och patienten skickar en bild från Min journal till granskning`,
};
