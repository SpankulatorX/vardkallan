// Runda 10, r5: processtöd med kunskapsstöd och kunskapsgenererande stöd, sammanhållen journalföring,
// högflödesmottagningen, läkemedelsbehandlingen genom vårdprocesserna med kollegakontroll, kunskapsstödet vid
// läkemedelshanteringen och de nationella vaccinationsprogrammen. Mappningsfilerna lägger tilläggen härifrån ovanpå sina
// egna poster med medR10r5, så att ändringen ligger samlad här. tester läggs till postens egna, och de andra fälten
// ersätter postens.
import { T } from './runda10-r5-tester.js';
import { klickbudgetTest } from '../krav.js';
import { FLODEN } from '../klickbudget.js';

const flode = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));
const VP = 'Vårdplan > ';

const POSTER = {
  '3.2.1.1': {
    avsedd: 'uppfyllt_demo',
    tester: [T.vardforlopp, T.forslagKunskap, T.varningKunskap, T.lmInfo, T.news2, T.utfallPlan,
      `${VP}systemet föreslår standardplanen ur diagnosen och läkaren sätter upp den med ett klick`, flode('vardplan')],
    losning: 'Processtödet är vårdplanerna med vårdförlopp: systemet föreslår standardplanen ur diagnosen och sammanhanget, och varje plan har vårdförloppets steg med vad riktlinjen säger, källan och nästa steg, räknat ur de åtgärder som är utförda. Kunskapsstödet är integrerat där beslutet fattas: i vårdplanen, vid NEWS2, vid varje varning i ordinationen, administreringen och utsättningen (varför systemet varnar och vad användaren kan göra) och som läkemedelsinformation vid ordinationen med patientens eGFR och ålder. Det kliniska beslutsstödet är varningarna och kontrollerna i läkemedelsprocessen och NEWS2-larmen. Det kunskapsgenererande stödet visar vårdenhetens egna utfall.',
    expert: 'Systemet föreslår planen, räknar ut nästa steg i vårdförloppet och visar riktlinjens text och källan i samma vy, så användaren behöver varken leta efter riktlinjen eller hålla reda på var i förloppet patienten är.',
    anmarkning: 'Kunskapstexterna är Vårdkällans sammanfattningar av de angivna källorna, inte granskade av vården, och varken kunskapsstödet eller beslutsstödet är en medicinteknisk produkt (ingen MDR-bedömning). Vårdförlopp finns för de fem standardplanerna.',
  },
  '3.2.1.2': {
    avsedd: 'uppfyllt_demo',
    tester: [T.vardforlopp, T.forslagKunskap, T.varningKunskap, T.lmInfo, T.news2, T.utfallPlan, T.utfallVarning, T.kkGrupper,
      'Läkemedel > allvarlig varning måste kvitteras med motivering', flode('vardplan')],
    losning: 'Processtödet följer vården från förslaget på standardplan till uppföljning och avslut. I varje steg visas kunskapsstödet i samma vy: vårdförloppets steg med riktlinjens text, NEWS2 med vad poängen betyder, varningarna i läkemedelsprocessen med varför och vad användaren kan göra, läkemedelsinformationen vid ordinationen och vårdenhetens erfarenhet av standardplanen, varningen och substansen. Kollegakontrollen av högriskläkemedel bestäms av systemet. Visualiseringen är enhetlig: samma ruta för kunskapsstöd i vårdplanen, ordinationen och mätvärdena.',
    expert: 'Allt räknas av systemet ur journalen: nästa steg, eGFR, ålder, riskgrupp och utfall, så att användaren bara behöver läsa och besluta. Kunskapsstödet kommer utan att användaren frågar efter det.',
    anmarkning: 'Kunskapsstöd från nationella tjänster eller tredjepartsprodukter (till exempel Sil, Janusmed eller ett vårdprogram från en extern leverantör) är inte anslutet. Läkemedelsuppslaget simuleras med en egen katalog, märkt som simulerad. Ingen MDR-bedömning är gjord.',
  },
  '3.2.1.3': {
    avsedd: 'uppfyllt_demo',
    tester: [T.vardforlopp, T.varningKunskap, T.lmInfo, T.utfallPlan, T.utfallSkydd, T.utfallVarning, T.utfallSubstans,
      'Läkemedel > varning: metformin vid lågt eGFR', 'Läkemedel > varningarna är märkta som demoregler'],
    losning: 'Steg 1, dokumentations- och visualiseringsstöd: strukturerad dokumentation, tidslinjen, kurvor och vårdförloppets steg. Steg 2, kunskapsbaserade system: reglerna i läkemedelsprocessen och NEWS2 som prövar journalens uppgifter mot kunskap och förklarar varför, med källa. Steg 3, kunskapsgenererande system: systemet räknar fram utfall ur journalens egna data på vårdenheten och återför dem där beslutet fattas, hur många avslutade planer ur samma standardplan som nådde alla mål och hur lång tid de tog, hur ofta en varning kvitteras och hur ofta en substans sätts ut inom 30 dagar.',
    expert: 'Systemet lär av vårdenhetens egna data utan att någon behöver ta fram statistik, och visar erfarenheten vid förslaget, varningen och läkemedlet. Små tal visas aldrig, så ingen patient kan pekas ut.',
    anmarkning: 'Utfallen är beskrivande statistik ur journalens data och inte en modell som förutsäger något. Reglerna och utfallen är demo och ingen MDR-bedömning är gjord.',
  },
  '3.2.2.3': {
    avsedd: 'uppfyllt_demo',
    tester: [T.sjSamtycke, T.sjKronologi, T.sjSparr, T.sjNod, T.sjBunden, T.sjLogg, flode('sammanhallen')],
    losning: 'Uppgifter som har skapats i Vårdkällan, migrerats från VAS och Cosmic eller hämtats från en annan vårdgivare genom sammanhållen journalföring (patientdatalagen 6 kap.) visas i samma tidslinje. Varje post har vårdgivare, vårdenhet, yrkesroll, den som skapade den och tiden utskrivna, och källan är märkt. Tidslinjen kan visas i tidsordning, per vårdkontakt eller per hälsoärende, och uppgifterna från den andra vårdgivaren kan sorteras och väljas på typ.',
    expert: 'Systemet vet om patienten har samtyckt, frågar bara när samtycket saknas, föreslår syftet och lägger uppgifterna i tidslinjen, så användaren aldrig behöver öppna ett annat system. Spärrar hos den andra vårdgivaren följer med av sig själva.',
    anmarkning: 'Den andra vårdgivaren och dess uppgifter är simulerade. En riktig anslutning till tjänsterna för sammanhållen journalföring (till exempel NPÖ) finns inte, och kringsystem utöver det simulerade laboratoriet är inte anslutna.',
  },
  '3.2.3.5': {
    avsedd: 'uppfyllt_demo',
    tester: [T.akAnkomst, T.akTriage, T.akTavla, T.akAktivitet, T.akUt, T.akSkyddad, T.akLedtider, T.akPrehospital, T.akDirekt, T.akRelation, flode('akut-ankomst'),
      'API > väntrummet visar aldrig namn för skyddad patient'],
    losning: 'Akutmottagningens flödestavla: ankomstregistrering med könummer och akutbesök, triage med prioritet ur NEWS2 och kontaktorsaken, patientens steg (väntar på triage, på läkare, på prov eller undersökning, bedömd, beslut), planerade och utförda aktiviteter med vem och när, läkarbedömning, beslut, utregistrering och överföring till slutenvård med inskrivning från akutbesöket. Förvarningar från ambulansen (simulerad prehospital tjänst) blir ankomster med de prehospitala uppgifterna. Ledtiderna följs upp per prioritet. Tavlan kan grupperas och väljas på prioritet och steg.',
    expert: 'Systemet sätter könummer, tider och steg själv, räknar prioriteten och förklarar varför, sorterar på prioritet och väntetid och skriver in patienten på avdelningen vid inläggning, så personalen bara registrerar det som har hänt.',
    anmarkning: 'Triagen är en demoregel, inte RETTS eller något annat fastställt triagesystem, och ingen MDR-bedömning är gjord. Ambulansen är simulerad. Akutbesöket ger vårdrelation först när en annan person än den som registrerade ankomsten har mött patienten i triagen eller bedömningen.',
  },
  '3.5.1.1': {
    avsedd: 'uppfyllt_demo',
    tester: [T.loForslag, T.loSkicka, T.loSparr, T.loBehorighet, T.loKommun, T.kkFlode, T.kkSjalv, T.kkBeredning, T.kkParameter, T.kkSparad, T.kkInkorg, flode('lakemedelsberattelse')],
    losning: 'Läkemedelsbehandlingen följer patienten genom vårdprocesserna: den gemensamma läkemedelslistan, ordination, iordningsställande med kollegakontroll av högriskläkemedel, administrering, utsättning, läkemedelsgenomgång och vid utskrivningen överföringen av läkemedelsberättelsen, läkemedelslistan och epikrisen till nästa vårdgivare: vårdcentralen där patienten är listad och kommunen i den samordnade planeringen. Mottagaren kvitterar, och avsändaren ser kvittensen.',
    expert: 'Systemet tar fram berättelsen och listan, väljer mottagarna och avgör vilka doser en kollega ska kontrollera, så läkaren skickar med ett klick och sjuksköterskan inte behöver kunna listan över högriskläkemedel.',
    anmarkning: 'Kommunen är en simulerad part. NLL är simulerad. Vårdgivare utanför Vårdkällan får inte överföringen elektroniskt i demon, utöver den simulerade kommunen.',
  },
  '3.5.1.5': {
    avsedd: 'uppfyllt_demo',
    tester: [T.varningKunskap, T.lmInfo, T.lmInfoBehorighet, T.utfallVarning, T.utfallSubstans, T.kkGrupper, T.kkFlode, T.kkParameter, T.kkSparad,
      'Läkemedel > varning: överkänslighet med matchande ATC-prefix', 'Läkemedel > varning: warfarin och NSAID', 'Läkemedel > varning: metformin vid lågt eGFR',
      'Läkemedel > allvarlig varning måste kvitteras med motivering', 'Administrering > varning: dubbel dos'],
    losning: 'Kliniskt beslutsstöd: varningar vid ordination, administrering och utsättning och kollegakontroll av högriskläkemedel. Kunskapsstöd: vid varje varning står varför systemet varnar, vad användaren kan göra och källan, och vid ordinationen visas läkemedelsinformation om substansens egenskaper, dosering, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med vårdenhetens erfarenhet av substansen.',
    expert: 'Systemet prövar varje ordination och dos mot journalen, räknar med patientens eGFR och ålder och förklarar på vanlig svenska varför det varnar och vad användaren kan göra.',
    anmarkning: 'Sil och Janusmed är inte anslutna. Läkemedelsuppslaget är en simulerad katalog med sammanfattningar ur produktresuméerna, inte granskade av farmaceut eller läkare. Ingen MDR-bedömning är gjord.',
  },
  '3.5.1.7': {
    avsedd: 'uppfyllt_demo',
    tester: [T.vpProgram, T.vpRiskgrupp, T.vpRegistrera, T.vpRegister, T.vpBehorighet, T.vpBhvEgen, T.vpFhir, flode('vaccination-riskgrupp'),
      'Barnhälsovårdens program > besöken och vaccinationerna följer barnets ålder, och systemet säger varför en dos inte kan ges'],
    losning: 'Barnvaccinationsprogrammet i barnhälsovården till fem år och fortsättningen med elevhälsans doser (MPR dos 2, HPV i två doser och difteri, stelkramp och kikhosta dos 5), vattkoppor för barn födda 1 juli 2025 eller senare och programmet för riskgrupper (influensa varje säsong och pneumokocker) under fliken Vaccinationer. Doser som har getts någon annanstans, till exempel av elevhälsan, registreras med källan. Varje dos som ges i Vårdkällan rapporteras till vaccinationsregistret. I FHIR är vaccinationerna Immunization.',
    expert: 'Systemet räknar ut vilka doser som gäller ur ålder, givna doser och riskgrupp i diagnoserna, föreslår dosen med skälet, prövar ordning, intervall och säsong och rapporterar dosen själv, så ingen behöver kunna programmen eller rapportera för hand.',
    anmarkning: 'Vaccinationsregistret är simulerat. Åldrarna, intervallen, säsongen och riskgrupperna är förenklade demoregler. Folkhälsomyndigheten har inte fastställt åldern för vaccination mot vattkoppor, så dosen visas men kan inte planeras.',
  },
};

export const medR10r5 = (poster) => poster.map(x => {
  const p = POSTER[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...(x.tester ?? []), ...tester])] };
});
