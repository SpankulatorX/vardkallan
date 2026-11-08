// Sussa 3.1.5 Uppmärksamhetsinformation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST, klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const { M, F, FS } = TEST;
// Runda 10, r4: Socialstyrelsens kodverkslista (sussa/runda10-r4.js).
import { UMI } from '../runda10-r4.js';
const UM = 'Uppmärksamhetsinformation > ';
const bekrafta = klickbudgetTest(FLODEN.find(f => f.id === 'uppmarksamhet'));

export default [
  {
    id: '3.1.5.1', kategori: 'system', egna: ['D9', 'D10'], avsedd: 'uppfyllt_demo',
    tester: [
      `${UM}strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell`,
      `${UM}överkänsligheterna som redan finns ingår, med grad, och syns i symbolen`,
      `${UM}förslag ur läkemedelslistan: antikoagulantia blir behandling, men inte tillfällig behandling`,
      `${UM}förslag ur diagnoserna: bärarskap blir smitta, implantat och transplantat blir medicinska tillstånd`,
      `${UM}FHIR: Flag och AllergyIntolerance med samma behörighet och loggning`,
      `${FS}varje tillägg och eget kodsystem har en publicerad definition`,
      `${M}varning: överkänslighet med matchande ATC-prefix`,
      ...UMI,
    ],
    losning: 'Uppmärksamhetsinformationen är en egen struktur med Socialstyrelsens fyra huvudgrupper (medicinska tillstånd och behandlingar, smitta, överkänslighet och särskild vårdrutin) och deras undergrupper. Överkänslighet har graderna livshotande, skadlig och besvärande. De överkänsligheter som redan är registrerade ingår direkt. Termerna, koderna och motiveringarna är Socialstyrelsens kodverkslista till informationsspecifikationen version 6.1.2, med 94 termer, ICD-10-SE, ATC och Snomed CT, inläst som data. Varje registrering och varje förslag är en term ur listan med dess koder och motivering, och överkänslighetens reaktion får sin term som varningsinformation eller observandum. Uppgifterna lämnas ut i FHIR som Flag och AllergyIntolerance, med Snomed CT när begreppet finns i den internationella utgåvan.',
    expert: 'Systemet läser läkemedelslistan, diagnoserna och överkänsligheterna och föreslår själv rätt term ur Socialstyrelsens kodverkslista, med huvudgrupp, undergrupp, koder, motivering och grad. Läkaren bekräftar med ett klick, och ingen behöver kunna kodverkslistan, Snomed CT eller ICD-10-SE.',
    anmarkning: 'Kodverkslistan är version 6.1.2 (2025-12-15) från E-hälsomyndighetens sida om uppmärksamhetsinformation, där Socialstyrelsens specifikation numera publiceras. Snomed CT kräver licens. Begreppen finns därför bara som id, och texten är kodverkslistans egna rubriker och motiveringar, inte de svenska beskrivningarna i Snomed CT. Vid verklig användning läses den svenska utgåvan in från källan, som andra kodverk i masterdatan. Snomed CT-begrepp i den svenska utgåvans namnrymd lämnas inte ut i FHIR, eftersom validatorn bara har den internationella utgåvan. Att systemet föreslår en term ur journalen är Vårdkällans demoregel. Termer som registrerades före runda 10 med andra namn står kvar som de skrevs. Överföring till NPÖ står inte i kravtexten och är inte byggd.',
  },
  {
    id: '3.1.5.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${UM}överkänsligheterna som redan finns ingår, med grad, och syns i symbolen`,
      `${UM}arbetslistan visar bara kategorierna, utan innehåll`,
      `${UM}väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet`,
      `${UM}spärrade uppgifter syns inte i symbolen förrän patienten samtycker`,
      `${UM}läskopian har uppmärksamhetsinformationen och symbolen`,
      `${UM}Min journal visar patientens uppmärksamhetsinformation, utan förslag och personalens id`,
      bekrafta,
      // Runda 6, r1: symbolen också i patientsöket och inkorgen.
      'Uppmärksamhetssymbolen i sök och inkorg > patientsök visar symbolen med samma regler som i patienthuvudet',
      'Uppmärksamhetssymbolen i sök och inkorg > inkorgen visar symbolen på raderna med patient, bara när översikten får läsas',
    ],
    losning: 'Symbolen står i patienthuvudet, som är detsamma i alla patientens vyer (översikt, journal, läkemedel, mätvärden, remisser och logglista), och i arbetslistan, väntrummet, patientsöket och inkorgen. Den visar vilka huvudgrupper som har information och den allvarligaste graden av överkänslighet, och innehållet är ett klick bort. Den följer med i läskopian vid avbrott.',
    expert: 'Systemet sätter symbolen själv ur strukturen. Den visar aldrig mer än rollen får se: spärrade uppgifter syns inte, vårdadministratören ser ingen symbol och väntrummet visar den bara för akutens personal, utan namn för skyddad identitet.',
    anmarkning: 'Symbolen i söket och inkorgen visas bara när den inloggade får läsa patientens översikt, annars är raden utan symbol. Symbolen följer principen i Socialstyrelsens specifikation (en del per huvudgrupp, graden som fyllnad) men är ritad för Vårdkällan och är inte den nationella bilden.',
  },
  {
    id: '3.1.5.3', kategori: 'system', egna: ['D10'], avsedd: 'uppfyllt_demo',
    tester: [
      `${UM}strukturen följer huvudgrupperna och undergrupperna i Socialstyrelsens tabell`,
      `${UM}förslagsreglerna ligger i en egen modul och är märkta som demoregler`,
      `${UM}läkaren bekräftar ett förslag med ett klick, och det loggas med vem, var och när`,
      `${UM}manuell registrering bara ur listan, och samma term inte två gånger`,
      `${UM}ett avfärdat förslag kommer inte tillbaka, och avfärdandet loggas`,
      `${UM}när behandlingen sätts ut föreslår systemet att uppgiften avslutas, och den avslutas aldrig utan orsak`,
      `${UM}sjuksköterska och undersköterska ser informationen men bekräftar inte, vårdadministratören ser den inte`,
      `${UM}väntrummet visar symbolen för akutens personal, utan namn för skyddad identitet`,
      `${UM}FHIR: Flag och AllergyIntolerance med samma behörighet och loggning`,
      bekrafta,
    ],
    losning: 'Omfattning: Socialstyrelsens fyra huvudgrupper med undergrupper och tre grader för överkänslighet. Nyregistrering: förslag ur journalen som bekräftas med ett klick, eller ett val ur en kort lista för det systemet inte kan räkna ut. Ändring: uppgifter avslutas med orsak och raderas aldrig. Spårbarhet: varje uppgift visar när, på vilken vårdenhet och av vem den registrerades, och varje ändring loggas. Säkerhet: samma behörighet, spärr och skyddade personuppgifter som resten av journalen. Presentation: samma symbol i alla patientvyer, arbetslistan, väntrummet och Min journal.',
    expert: 'Systemet hittar uppgifterna själv, väljer huvudgrupp, undergrupp, kod och grad, och föreslår att en uppgift avslutas när behandlingen som den bygger på har satts ut. Läkaren behöver aldrig kunna Socialstyrelsens struktur eller koder.',
    anmarkning: 'Förslagsreglerna är demoregler, inte kliniskt beslutsstöd. Termerna i listan för manuell registrering är delvis hämtade från Region Västmanlands och Socialstyrelsens exempel och delvis Vårdkällans egna. Kodverkslistan med Snomed CT är inte inläst.',
  },
];
