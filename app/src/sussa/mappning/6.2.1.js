// Sussa 6.2.1 Analys och uppföljning i kärnsystemet: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
const P = 'Patientgruppering > ';
const S = 'Statistik och analys > ';

export default [
  { id: '6.2.1.1', kategori: 'system', egna: ['D5'], avsedd: 'uppfyllt_demo',
    tester: [
      `${S}uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter`,
      `${S}vårdenhetens statistik räknas bara på den egna vårdenhetens uppgifter, och en annan vårdenhet nekas`,
      `${S}urval och resultat sparas, återanvänds och delas med vårdenheten, och prövas med den egna behörigheten`,
      `${P}ett sparat resultat läses bara av en roll som får se statistik, och svaret är detsamma oavsett om det finns`,
      `${P}en roll utan behörighet att gruppera nekas och loggas`,
    ],
    losning: 'Sidan Analys och statistik i kärnsystemet. Sju mått: vårdkontakter, patienter med vårdkontakt, medelvårdtid, diagnoser per kategori, nya ordinationer per läkemedelsgrupp, ledtid från remiss till svar och från provtagning till svar. Den som analyserar väljer mått, gruppering (månad, vårdenhet, vårdform, kön, åldersgrupp eller kategori), period, vårdenhet och en patientgrupp som filter och får en tabell och ett diagram. Urval och resultat sparas, återanvänds och delas med vårdenheten eller med uppföljningen. Uppföljningsrollen ser hela vårdgivaren, och vårdenhetens personal ser den egna vårdenheten.',
    expert: 'Systemet väljer ett diagram efter grupperingen, döljer antal under fem och medianer på för få värden, och räknar aldrig in spärrade uppgifter eller patienter med skyddade personuppgifter. Ett delat urval prövas alltid med behörigheten hos den som använder det.',
    anmarkning: 'Måtten är de som systemet redan har data för. Analysen är byggd för sandlådans storlek och räknas på journalens tabeller vid varje fråga, inte i ett datalager. Diagrammen är enkla stapel- och linjediagram.',
  },
  { id: '6.2.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${P}villkoren kontrolleras och skrivs på vanlig svenska, och färdiga grupper har målvärden ur riktlinjerna`,
      `${P}läkaren grupperar sina patienter på diagnos, mätvärde, läkemedel, besök och demografi och får en lista som loggas`,
      `${P}gruppen räknas bara på uppgifter som läkaren får se utan aktivt val, och aldrig på spärrade uppgifter`,
      `${P}en patient utan vårdrelation på vårdenheten kommer aldrig med i läkarens grupp`,
      `${P}uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter`,
      `${P}en roll utan behörighet att gruppera nekas och loggas`,
      'Folkhälsa > en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet',
      `${S}uppföljningen väljer mått, period, vårdenhet och patientgrupp och får tabell och diagram utan personuppgifter`,
    ],
    losning: 'En patientgrupp är ett urval av villkor: diagnoser (till exempel kroniska sjukdomar), genomförda åtgärder med KVÅ-kod, pågående läkemedel med ATC-kod, senaste mät- och labbvärden (blodtryck, BMI, HbA1c, eGFR med flera), mätvärden som saknas, levnadsvanor (tobak, alkohol, fysisk aktivitet och matvanor), antal besök och demografi, med en tidsperiod. Gruppen används för bevakning av riskpatienter på vårdenheten, som filter i statistiken, i folkhälsoinsatserna och sparas för att användas igen.',
    expert: 'Den som grupperar väljer en färdig grupp, till exempel diabetes med HbA1c över målnivån eller hypertoni utan blodtryck det senaste året, med målvärden ur riktlinjerna, och systemet skriver själv vad gruppen betyder och varför varje patient kom med. Ingen behöver kunna koderna.',
    anmarkning: 'Läkare och sjuksköterskor ser bara patienter som de har vårdrelation till på den egna vårdenheten, och villkoren prövas bara mot den egna vårdenhetens uppgifter och läkemedelslistan. Uppföljningen ser bara antal. Rapportering till externa parter med grupperna är inte byggd. Strep A finns inte som mätvärde i demon.',
  },
];
