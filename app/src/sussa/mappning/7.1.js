// Sussa 7.1 Ekonomi och ekonomisk uppföljning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 7, r3: ekonomi.js, ekonomi-schema.js och ekonomi-rutter.js.
import { klickbudgetTest } from '../../krav.js';
import { FLODEN } from '../../klickbudget.js';

const P = 'Ekonomi: prislistor > ';
const F = 'Ekonomi: faktureringsunderlag > ';
const K = 'Ekonomi: kostnader i vårdprocessen > ';
const S = 'Ekonomi: skydd i underlaget och högkostnadsskyddet > ';
const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));

export default [
  {
    id: '7.1.1.1', kategori: 'system', egna: ['D6'], avsedd: 'uppfyllt_demo',
    tester: [
      `${F}systemet skapar transaktionsposter ur vårdtillfället med vårddygn, material, DRG och sammanhållande id utan att någon registrerar dem`,
      `${F}läkemedel som gavs på enheten och åtgärder med KVÅ blir poster med pris ur prislistan och materialschablon`,
      `${F}ett besök som vårdadministratören registrerar blir en post och en patientavgift utan att något mer registreras`,
      `${F}utlämnade hjälpmedel blir poster med hjälpmedelsavgift, och registreringen prövas och loggas`,
      `${F}export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna`,
      `${F}översikten per vårdenhet visar antal, summa och varningar utan personuppgifter, och förra månaden är förvald`,
      `${F}skyddad identitet: underlaget innehåller aldrig adressen eller namnet`,
      `${S}ett barn med skyddade personuppgifter: varken vårdnadshavarens namn och identitet eller adressen finns i underlaget`,
      `${S}en vårdnadshavare med skyddade personuppgifter: namn, identitet och barnets adress lämnas inte ut`,
      'Ekonomi: sandlådor och roller > en sandlåda från före runda 7 får tabellerna, prislistorna och ekonomen',
      'Ekonomi: export för en spärrad vårdenhet > underlaget för en vårdenhet som patienten har spärrat har minsta möjliga uppgifter och inget om andra vårdenheter',
      'Ekonomi: ChargeItem i FHIR > ChargeItem med samma behörighet och loggning som kostnadsrutan',
      flode('exportera-underlag'), flode('lamna-ut-hjalpmedel'),
    ],
    losning: 'Systemet skapar transaktionsposterna av sig självt ur vårdkontakter, vårddygn, åtgärder med KVÅ, läkemedel som gavs på enheten, utlämnade hjälpmedel (som läkare och sjuksköterskor lämnar ut med två klick från kostnadsrutan) och material enligt schabloner, och ekonomen hämtar underlaget per vårdenhet och månad som CSV eller JSON. Varje post har ett stabilt id och ett sammanhållande id som pekar på vårdkontakten eller vårdtillfället, och varje export sparas och loggas på patienterna i underlaget.',
    expert: 'Ingen registrerar en transaktion: systemet läser det som har hänt, sätter priset ur den prislista som gällde dagen för händelsen och visar per vårdenhet vad som väntar och varför, så att ekonomen hämtar underlaget med ett klick.',
    anmarkning: 'Priserna är demopriser och inga verkliga regionpriser. Ingen riktig överföring till ett ekonomisystem görs, filen laddas ner. Material räknas med schabloner. Posterna finns också som ChargeItem i FHIR. Ett underlag för en vårdenhet som patienten har spärrat har minsta möjliga uppgifter.',
  },
  {
    id: '7.1.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [
      `${P}varje vårdenhet har en prislista med version, giltighetstid och demopriser, och kardiologin har en historik`,
      `${P}bara ekonomen ändrar en prislista, som blir en ny version från ett datum som inte har passerat, och ändringen loggas`,
      `${F}betalningsmottagaren räknas fram: utomlänsvård, vårdnadshavare, asylsökande, reservnummer och egen region`,
      `${F}när reservnumret ersätts av personnumret följer underlaget med och betalningsmottagaren blir känd`,
      `${F}vårdadministratören registrerar LMA-kortet som patienten visar, och då ändras avgiften och betalningsmottagaren`,
      `${F}utomlänsvård: underlaget har en del per hemregion med de uppgifter som den nationella tjänsten för utomlänsvård behöver (simulerad)`,
      `${F}DRG: vårdtillfället grupperas med en demoregel ur den ansvariga vårdenhetens huvuddiagnos, och utan huvuddiagnos förklarar systemet varför`,
      `${F}medicinskt färdigbehandlad registreras av läkaren på vårdtillfället och ingår i underlaget`,
      `${F}i en samordnad planering vid utskrivning är underrättelsen om utskrivningsklar registreringen, och kommunens betalningsansvar kommer med`,
      `${F}export som CSV och JSON per period och vårdenhet kräver ekonomens roll, och varje export loggas på patienterna`,
    ],
    losning: 'Prislistor per vårdenhet med versioner, giltighetstid och historik, som bara ekonomen ändrar och som loggas. Betalningsmottagaren räknas fram: egen region, en annan region vid utomlänsvård, Migrationsverket för asylsökande med LMA-kort, kommunen för dygn med betalningsansvar, patienten eller vårdnadshavaren för avgiften, och väntan vid reservnummer. Vårdtillfällen grupperas i DRG-liknande demogrupper, och medicinskt färdigbehandlad ingår i underlaget, antingen från läkarens registrering eller från underrättelsen om utskrivningsklar i den samordnade planeringen.',
    expert: 'Systemet avgör betalningsmottagaren ur identitet, ålder, folkbokföring och LMA-kort, grupperar vårdtillfället ur den ansvariga vårdenhetens huvuddiagnos och tar medicinskt färdigbehandlad från den samordnade planeringen när den finns, så att ingen behöver kunna riksavtalet eller DRG.',
    anmarkning: 'DRG-grupperna är en egen demogruppering och inte NordDRG, som är licensierad. Folkbokföringen och den nationella tjänsten för utomlänsvård är simulerade, och fältlistan för utomlänsvård bygger inte på tjänstens specifikation, som inte är läst. Avtal med rabatter, ersättning från andra länder och kommunens belopp enligt 5 kap. 6 § lag (2017:612) saknas.',
  },
  {
    id: '7.1.2.1', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [
      `${K}läkaren ser kostnaden hittills för vårdtillfället per kategori enligt prislistan, med DRG och högkostnadsskyddet`,
      `${K}vårdadministratören ser bara patientavgifterna och högkostnadsskyddet, och undersköterskan ser inga kostnader`,
      `${K}spärr och inre sekretess: kostnader från en spärrad eller annan vårdenhet syns inte och nämns inte`,
      `${K}en öppenvårdskontakt i dag har en egen kostnadsruta`,
      `${S}högkostnadsskyddet räknas bara på de kontakter användaren får se: en spärrad enhet utan och med samtycke`,
      'Ekonomi: avgifter som taket har påverkat > en dold kontakt som gör nästa synliga avgift nedsatt men inte noll ändrar inte svaret i kostnadsrutan',
      'Ekonomi: avgiften visas som e-frikortet > patienten ser hela högkostnadsskyddet i Min journal, med alla besök, och ingen annan når det',
    ],
    losning: 'I patientens översikt finns en ruta med kostnaden hittills för det pågående vårdtillfället eller dagens vårdkontakt: vårddygn, läkemedel, material, åtgärder och hjälpmedel enligt prislistan, ersättningen enligt DRG-demogruppen och patientens högkostnadsskydd med vad som återstår till frikort. Läkare och sjuksköterskor ser hela rutan, vårdadministratören bara avgifterna och högkostnadsskyddet.',
    expert: 'Systemet räknar kostnaden av sig självt ur det som har hänt och visar bara det användaren redan får se, så att ingen behöver leta i prislistor eller räkna avgifter.',
    anmarkning: 'Demopriser. Rabatter visas inte. Högkostnadsskyddet och avgifterna i rutan räknas bara på de besök användaren får se, så de kan visa mindre än patienten har betalat när det finns besök på en annan vårdenhet eller en spärrad enhet. Rutan säger det, och patienten ser hela skyddet i Min journal.',
  },
];
