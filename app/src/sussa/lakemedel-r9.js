// Runda 9, r1: läkemedel, förbrukningsartiklar och vaccination. Testnamnen (app/test/lakemedel-r9.test.js och
// app/test/forbrukning.test.js) och ändringarna i posterna i Sussa 3.5.1 till 3.5.5 som rundan byggde. Mappningsfilerna
// för avsnitten lägger ändringarna ovanpå sina poster, så att de ligger samlade här.
const BK = 'Beredning med kontroll och etikett > ';
const DF = 'Doser i flytande form och gasform > ';
const PS = 'Patientnära skanning > ';
const BA = 'Beredning och skanning via API > ';

export const T = {
  kalium: `${BK}en infusion med kaliumklorid bereds med batch, kontrolleras av en annan sjuksköterska och får en etikett med streckkod innan den ges`,
  foljer: `${BK}beredningen följer ordinationen: fel lösning, gången förpackning och passerad hållbarhet stoppas med en förklaring, och en skannad förpackning fyller i batch och utgångsdatum`,
  flytande: `${DF}flytande dos: systemet räknar volymen i ml ur styrkan och visar den vid iordningsställandet, och en uppmätt volym som avviker varnar`,
  gas: `${DF}syrgas ordineras i liter per minut med utrustning och mål för saturationen, och systemet stoppar ett flöde som utrustningen inte ger`,
  skanning: `${PS}etiketten och armbandet kontrolleras mot dosen, och ett armband eller en etikett för en annan patient stoppas utan att röja den andra patienten`,
  skanningSparr: `${PS}en etikett för en dos av en spärrad vårdenhets ordination behandlas som en okänd etikett`,
  api: `${BA}API: beredning, kontroll, etikett som PDF, armband och skanning, med loggning`,
  sammanslagning: 'Sammanslagning av journaler med beredning och skanning > en beredning och en skanning följer med när journalerna slås samman, och skyddet mot ändring gäller efteråt',
  vb: 'Vätskebalans framåt i flera dygn > den förväntade vätskebalansen visas 24, 48 eller 72 timmar framåt, med ackumulerad mängd in och förlusterna för hela perioden',
  identitet: 'Identitet > sammanslagning: rader som aldrig får ändras, till exempel en given dos, följer med, och skyddet gäller efteråt',
  egen: 'Egenadministrering i slutenvården > en ordination som patienten sköter själv kommer inte med bland doserna att ge, och sjuksköterskan kvitterar intaget per dostid',
  egenHinder: 'Egenadministrering i slutenvården > systemet förklarar varför en blodprodukt, en infusion och narkotika inte kan skötas av patienten själv',
  bestallning: 'Beställning av extempore, licens och blodprodukter > extempore beställs från det simulerade apoteket och blodprodukter från den simulerade blodcentralen, med mängd ur ordinationen och status till leveransen',
  licens: 'Beställning av extempore, licens och blodprodukter > en licensansökan till det simulerade Läkemedelsverket kräver motivering, och en beviljad licens bevakas av systemet',
  epikris: 'Läkemedelsberättelsen i epikrisen > epikrisens förslag har läkemedelsberättelsen under Läkemedelsförändringar, och den som läkaren har sparat vid läkemedelsgenomgången går först',
  vardgivare: 'Uppföljning av läkemedel på vårdgivarens nivå > förskrivning, administrering och utvärdering per läkemedel över alla vårdenheter, utan personuppgifter och bara för uppföljningen',
  direktivVardgivare: 'Generella direktiv på vårdgivarens nivå > den läkare som vårdgivaren har utsett fastställer ett direktiv som gäller alla vårdenheter, och andra får en förklaring',
};
export const TESTER_R9R1 = Object.values(T);

// Ändringar per post: tester som läggs till, text som läggs till sist i lösningen och expertrollen, och en anmärkning
// eller expertroll som ersätter den förra när rundan har byggt det som saknades.
export const ANDRINGAR = {
  // Poster som redan var uppfyllda i demon och bara saknade en ärlig mappning.
  '3.5.1.8': {
    avsedd: 'uppfyllt_demo',
    tester: [T.identitet, T.sammanslagning],
    losning: 'En dos som bereds visar beredningen, batch, hållbarhet och kontroll, och en oral lösning och syrgas visas i ml och liter per minut.',
    ersattAnmarkning: 'En patient som först registreras oidentifierad, med reservnummer, får all läkemedelsinformation samlad i samma lista när journalerna slås samman. Ordinationer, doser, beredningar och skanningar följer med och kan inte ändras efteråt.',
  },
  '3.5.1.11': {
    avsedd: 'uppfyllt_demo',
    tester: [T.epikris],
    losning: 'Läkemedelsberättelsen följer med i epikrisens förslag under Läkemedelsförändringar: den som läkaren har sparat vid läkemedelsgenomgången under vårdtillfället, annars den som systemet tar fram ur historiken.',
    ersattAnmarkning: 'Fynden är demoregler. Överföringen av läkemedelsberättelsen till nästa vårdgivare hör till 3.5.1.1 och görs inte.',
  },
  '3.5.2.10': {
    avsedd: 'uppfyllt_demo',
    tester: [T.kalium, T.sammanslagning],
    losning: 'Beredningen och kontrollen av den sparas med vem och när, och följer dosen genom processen.',
    ersattAnmarkning: 'Urvalet av historiken görs med listans filter och vyn över flera dygn. En oidentifierad patients läkemedelsprocess samlas med resten när journalerna slås samman.',
  },
  '3.5.2.15': {
    avsedd: 'uppfyllt_demo',
    tester: [T.direktivVardgivare],
    losning: 'Ett direktiv kan också fastställas för hela vårdgivaren av den läkare som vårdgivaren har utsett, och gäller då på alla vårdenheter hos vårdgivaren men inte i en kommun.',
    ersattAnmarkning: 'Demons direktiv är påhittade. Vem som får fastställa följer HSLF-FS 2017:37 6 kap. 6 och 17 §§ och Gröna häftet 1.4.2: endast läkare, den medicinskt ansvariga läkaren för vårdenheten, och för hela vårdgivaren den läkare som vårdgivaren har utsett. I demon är det läkaren Sara Lindqvist.',
  },
  '3.5.2.20': {
    avsedd: 'uppfyllt_demo',
    tester: [T.vardgivare],
    losning: 'Uppföljning på vårdgivarens nivå för uppföljningen: per läkemedel antal vårdenheter, patienter, förskrivna och nya ordinationer, givna doser, andel utvärderade, effekt, biverkningar och passerade uppföljningar över alla vårdenheter, för 30, 90 eller 365 dagar.',
    ersattAnmarkning: 'Rapportering av biverkningar till Läkemedelsverket står inte i kravtexten och finns inte. Ett läkemedel med färre än tre patienter visas bara med antal vårdenheter.',
  },
  '3.5.2.14': {
    avsedd: 'uppfyllt_demo',
    ersattAnmarkning: 'Vårdhändelsen får sin tid ur tidboken eller anges för hand. Planering av operationer är ett eget område och finns inte i demon.',
  },
  '3.5.3.3': {
    avsedd: 'uppfyllt_demo',
    tester: [T.vb],
    losning: 'Perioden framåt kan väljas till 24, 48 eller 72 timmar, och varje förväntad post visar den ackumulerade mängden in.',
    ersattAnmarkning: 'Förväntade förluster räknas i samma takt som det senaste dygnet, eftersom förluster inte ordineras.',
  },
  '3.5.1.4': {
    avsedd: 'uppfyllt_demo',
    tester: [T.kalium, T.foljer, T.api],
    losning: 'Den som späder registrerar beredningen när dosen iordningsställs: systemet visar lösningen, volymen, hur mycket som dras upp och tillsatserna ur ordinationen, och den som bereder anger bara batchnumret eller skannar förpackningen. En beredning med kaliumklorid eller morfin kontrolleras av en annan sjuksköterska eller läkare innan den ges, och etiketten med streckkod har beredningen, batch, hållbarhet och vem som beredde och kontrollerade.',
    ersattExpert: 'Systemet föreslår spädningen och tillsatserna ur produkten, räknar koncentration, volym och hastighet och stoppar en för hög koncentration eller tillsats med en förklaring. Vid beredningen vet systemet vilka doser som ska beredas och kontrolleras av en annan person, läser batch och utgångsdatum ur förpackningens kod och stoppar en annan lösning eller volym än ordinationens, en gången förpackning, en beredning som inte längre håller och en dos utan beredning eller kontroll.',
    ersattAnmarkning: 'Spädningsreglerna är demoregler för fem substanser och två tillsatser, kaliumklorid och Addex-Magnesium, inte granskade av farmaceut. Vilka beredningar som kontrolleras av en annan person (kaliumklorid och morfin) och hur länge en beredning håller (fyra timmar för bensylpenicillin, annars ett dygn) är demoregler, inte en vårdgivares rutin. Förpackningens kod läses som GS1-text, och ingen riktig streckkodsläsare eller etikettskrivare är ansluten.',
  },
  '3.5.2.4': {
    avsedd: 'uppfyllt_demo',
    tester: [T.bestallning, T.licens],
    losning: 'Beställningssteget: extempore beställs från ett simulerat apotek och blodprodukter från en simulerad blodcentral ur ordinationen, och en licens söks hos ett simulerat Läkemedelsverket, med status till leverans eller beslut. En beviljad licens registreras och bevakas.',
    ersattExpert: 'Systemet bevakar licensens giltighet vid ordination och dos och i läkarens inkorg, kräver kontrollen vid sängen för en blodprodukt och räknar kalorierna ur nutritionen. Det vet ur ordinationen vad som ska beställas och från vem, räknar mängden, säger när en licens redan gäller eller behöver förlängas och registrerar en beviljad licens själv.',
    ersattAnmarkning: 'Produkterna utanför NPL är påhittade demoposter. Apoteket, Läkemedelsverket och blodcentralen är simulerade och svarar när demoknappen används. Ingen riktig beställning, licensansökan eller förlikning görs.',
  },
  '3.5.2.12': {
    avsedd: 'uppfyllt_demo',
    tester: [T.egen, T.egenHinder, T.gas],
    losning: 'En ordination i slutenvården kan markeras som egenadministrering: patienten sköter läkemedlet själv, doserna kommer inte med bland sjuksköterskans doser att ge, och sjuksköterskan kvitterar patientens intag per dostid eller registrerar att det inte togs, med orsak.',
    ersattAnmarkning: 'Förslagen och trappmallarna är demoregler, och så är reglerna för vad patienten får sköta själv (inte blodprodukter, inte intravenöst och inte narkotika). Doseringsstöd och kliniskt beslutsstöd från en extern källa och elektronisk beställning till extern part finns inte och står inte i kravtexten.',
  },
  '3.5.2.17': {
    avsedd: 'uppfyllt_demo',
    tester: [T.kalium, T.foljer, T.flytande, T.gas, T.skanning, T.api],
    losning: 'Varje iordningsställd dos får en etikett med streckkod (Code 128) som bara innehåller kontrollkoden, med patienten, läkemedlet, dosen och dostiden, och för en beredd dos lösningen, volymen, tillsatserna, batch och hållbarhet. En oral lösning ordineras i mg och mäts upp i ml, och syrgas ordineras i liter per minut med utrustning och mål för saturationen.',
    ersattExpert: 'Systemet kontrollerar dosen redan när den iordningsställs, visar vad som ska göras med spädningen och tillsatserna och skriver etiketten själv. Det räknar en oral lösning i ml med rätt spruta, väljer utrustning för syrgasen ur flödet, stoppar ett flöde som utrustningen inte ger och säger när saturationen ligger utanför målet.',
    ersattAnmarkning: 'Etiketten skrivs ut som PDF för etikettskrivare eller A4-ark, och ingen riktig etikettskrivare är ansluten. Gränserna för syrgasens utrustning och standardmålet 92 till 96 procent är demoregler. Syrgasen är en egen demopost i katalogen, inte en produkt ur NPL.',
  },
  '3.5.2.18': {
    avsedd: 'uppfyllt_demo',
    tester: [T.skanning, T.skanningSparr, T.api],
    losning: 'Patientnära skanning: ett fält tar emot etikettens och armbandets streckkod, som en streckkodsläsare skriver, kontrollerar dem mot den iordningsställda dosen och patienten och ger dosen med båda koderna, som sparas med dosen. Armbandet har patientens journalnummer, aldrig personnumret.',
    ersattExpert: 'Systemet kontrollerar varje dos mot ordinationen, tidigare doser och för undersköterskan delegeringen, förklarar varje varning på vanlig svenska och sätter själv tid, vem som gav dosen och vårdkontakten. Vid skanningen kontrollerar systemet att etiketten hör till en iordningsställd dos för just den patient vars armband skannas och stoppar en dos till fel patient utan att röja vem den andra patienten är.',
    ersattAnmarkning: 'Varningarna är demoregler. Ingen riktig streckkodsläsare är ansluten: läsaren skriver som ett tangentbord, och i demon kan koden skrivas i fältet. Tiderna ändras i den pågående ordinationen (dosändring). Vilka läkemedelsformer som kan delegeras och gränsen på ett år är demoregler, inte en vårdgivares rutin efter riskanalys (9 kap. 8 och 9 §§). Bara undersköterskor kan få delegering i demon, och delegeringen registreras av en sjuksköterska eller läkare men inte av en tandläkare, eftersom demon inte har någon tandvård.',
  },
};

const lagg = (a, b) => (b ? `${a ? `${a} ` : ''}${b}` : a);
// Lägger rundans ändringar ovanpå avsnittets poster.
export const medR9r1 = (poster) => poster.map(x => {
  const a = ANDRINGAR[x.id];
  if (!a) return x;
  return { ...x, ...(a.avsedd ? { avsedd: a.avsedd } : {}), ...(a.egna ? { egna: [...new Set([...(x.egna ?? []), ...a.egna])] } : {}),
    tester: [...x.tester, ...(a.tester ?? []).filter(t => !x.tester.includes(t))],
    losning: a.ersattLosning ?? lagg(x.losning, a.losning), expert: a.ersattExpert ?? lagg(x.expert, a.expert), anmarkning: a.ersattAnmarkning ?? x.anmarkning };
});
