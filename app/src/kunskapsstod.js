// Kunskapsstöd i processtödet och i läkemedelshanteringen (runda 10, r5, Sussa 3.2.1.1, 3.2.1.2 och 3.5.1.5).
//
// Systemet är experten. Kunskapen visas där den behövs, utan att användaren letar: i vårdplanen visas vårdförloppets
// steg med vad riktlinjen säger och vilket steg som är nästa, vid varje varning i ordinationen, administreringen och
// utsättningen står varför systemet varnar och vad användaren kan göra, och vid ett läkemedel visas substansens
// egenskaper, dosering vid nedsatt njurfunktion och om det är olämpligt för äldre, prövat mot patientens eget eGFR och
// ålder. Användaren behöver aldrig kunna reglerna eller slå upp något i ett annat system.
//
// Texterna är korta sammanfattningar som Vårdkällan har skrivit ur de källor som står vid varje text. De är inte
// granskade av vården, och kunskapsstödet är inte en medicinteknisk produkt (ingen MDR-bedömning). En nationell tjänst
// för läkemedelsinformation, som Sil eller Janusmed, är inte ansluten. Läkemedelsuppslaget simuleras i stället med en
// egen katalog, märkt som simulerad.
//
// Modulen har inga tabeller och läser ingenting om patienten själv. Det som rör patienten (eGFR och ålder) skickas in av
// den som anropar, efter behörighetsprövningen i den modulen.

export const DEMOMARKNING = 'Kunskapsstödet är en demo. Texterna är sammanfattningar som Vårdkällan har skrivit ur källorna, inte granskade av vården, och kunskapsstödet är inte en medicinteknisk produkt (ingen MDR-bedömning).';
export const SIMULERAD_KATALOG = 'Läkemedelsuppslaget är simulerat. En nationell tjänst för läkemedelsinformation är inte ansluten i demon.';

// Källorna, med namn och utgivare. Inga länkar, så att ingen läser texten som om den vore källans egen.
export const KALLOR = {
  hjartsvikt: 'Socialstyrelsen, Nationella riktlinjer för hjärtsjukvård, och det nationella vårdprogrammet för hjärtsvikt (Nationellt system för kunskapsstyrning hälso- och sjukvård)',
  trycksar: 'Socialstyrelsen, Förebygga trycksår, och kvalitetsregistret Senior alert',
  diabetes: 'Socialstyrelsen, Nationella riktlinjer för diabetesvård, och det nationella vårdprogrammet för diabetes (Nationellt system för kunskapsstyrning hälso- och sjukvård)',
  fall: 'Socialstyrelsen, Förebygga fall, och kvalitetsregistret Senior alert',
  lpt: 'Lag (1991:1128) om psykiatrisk tvångsvård, 2 och 16 §§',
  news2: 'Royal College of Physicians, National Early Warning Score (NEWS) 2, 2017',
  smpc: 'Produktresumén för substansen (Läkemedelsverket), sammanfattad i Vårdkällans simulerade läkemedelskatalog',
  aldre: 'Socialstyrelsen, Indikatorer för god läkemedelsterapi hos äldre',
  hsl: 'Socialstyrelsens föreskrifter och allmänna råd (HSLF-FS 2017:37) om ordination och hantering av läkemedel i hälso- och sjukvården',
};

// ---- Vårdförloppen i standardplanerna ----------------------------------------------------------------------------
// Varje standardplan i vardplan.js har ett vårdförlopp med steg. Ett steg är klart när alla dess åtgärder är utförda.
// atgarder är början av åtgärdernas text i mallen. Det första steget som inte är klart är nästa steg.
const steg = (rubrik, atgarder, text) => ({ rubrik, atgarder, text });
export const VARDFORLOPP = {
  hjartsvikt: {
    rubrik: 'Vårdförlopp vid hjärtsvikt', kalla: KALLOR.hjartsvikt,
    sammanfattning: 'Riktlinjerna lägger störst vikt vid att behandlingen med läkemedel optimeras, att patienten lär sig egenvård och att uppföljningen är planerad innan patienten skrivs ut.',
    steg: [
      steg('Bedöm vätskebalansen', ['Daglig vikt', 'Vätskelista'], 'Daglig vikt på morgonen före frukost och en vätskelista visar om behandlingen med diuretika räcker. En viktökning på mer än 2 kg på tre dagar är ett tecken på försämring.'),
      steg('Optimera läkemedelsbehandlingen', ['Läkemedelsgenomgång'], 'Vid hjärtsvikt med nedsatt pumpförmåga rekommenderas fyra grupper av läkemedel: ACE-hämmare eller angiotensinreceptorblockerare (eller sakubitril och valsartan), betablockerare, mineralkortikoidreceptorantagonist och SGLT2-hämmare. Doserna trappas upp till måldos.'),
      steg('Lär ut egenvård', ['Information om egenvård'], 'Patienten ska känna igen tecken på försämring, väga sig själv och veta när vården ska kontaktas.'),
      steg('Planera uppföljningen', ['Remiss till hjärtsviktsmottagningen'], 'Uppföljning på en sjuksköterskeledd hjärtsviktsmottagning efter utskrivningen minskar risken för ny inläggning.'),
    ],
  },
  trycksar: {
    rubrik: 'Vårdförlopp för att förebygga trycksår', kalla: KALLOR.trycksar,
    sammanfattning: 'Trycksår förebyggs genom riskbedömning, daglig hudinspektion, lägesändring, tryckavlastning och tillräckligt med näring.',
    steg: [
      steg('Bedöm risken', ['Riskbedömning för trycksår'], 'Riskbedömningen görs med en strukturerad skala, till exempel modifierad Norton, och huden inspekteras dagligen.'),
      steg('Avlasta trycket', ['Lägesändring', 'Tryckavlastande madrass'], 'Lägesändring enligt schema och en tryckavlastande madrass minskar trycket mot huden.'),
      steg('Säkra näringen', ['Bedömning av nutrition'], 'Undernäring ökar risken för trycksår. Vikt och intag följs.'),
    ],
  },
  diabetes: {
    rubrik: 'Vårdförlopp vid diabetes', kalla: KALLOR.diabetes,
    sammanfattning: 'Riktlinjerna lägger vikt vid individuella mål för glukosvärdena, regelbunden fotundersökning och att patienten kan hantera lågt blodsocker.',
    steg: [
      steg('Följ glukosvärdena', ['Glukoskontroll'], 'Glukosvärdena följs enligt ordinationen mot de mål som läkaren har satt för patienten.'),
      steg('Undersök fötterna', ['Fotundersökning'], 'Fotundersökningen visar risken för fotsår, och riskgruppen avgör hur ofta den görs.'),
      steg('Lär ut egenvård', ['Information om egenvård'], 'Patienten ska kunna känna igen och behandla lågt blodsocker.'),
      steg('Bedöm behandlingen', ['Bedömning av behandlingen'], 'Läkaren bedömer om behandlingen når målen och om den behöver ändras.'),
    ],
  },
  fall: {
    rubrik: 'Vårdförlopp för att förebygga fall', kalla: KALLOR.fall,
    sammanfattning: 'Fall förebyggs genom riskbedömning, genomgång av läkemedel som ökar risken för fall och stöd vid förflyttning.',
    steg: [
      steg('Bedöm risken', ['Riskbedömning för fall'], 'Riskbedömningen görs med en strukturerad skala, till exempel Downton, när patienten skrivs in.'),
      steg('Gå igenom läkemedlen', ['Genomgång av läkemedel'], 'Sömnmedel, lugnande medel, opioider och blodtryckssänkande läkemedel ökar risken för fall.'),
      steg('Stöd vid förflyttning', ['Hjälp vid förflyttning'], 'Hjälp vid förflyttning och toalettbesök minskar risken för fall under vårdtiden.'),
    ],
  },
  lpt: {
    rubrik: 'Vårdförlopp i vårdplanen vid psykiatrisk tvångsvård', kalla: KALLOR.lpt,
    sammanfattning: 'Vårdplanen ska upprättas snarast efter intagningen och ange de insatser som behövs för att syftet med tvångsvården ska uppnås (16 § LPT).',
    steg: [
      steg('Planera behandlingen', ['Behandlingsåtgärder'], 'Planen anger behandlingen och de andra insatser som behövs.'),
      steg('Samråd', ['Samråd med patienten', 'Samråd med närstående'], 'Planen upprättas i samråd med patienten och, om det inte är olämpligt, med närstående (16 § LPT).'),
      steg('Undersök stödet efter vården', ['Undersök om patienten behöver stöd'], 'Behöver patienten stöd från socialtjänsten efter vården ska planen upprättas i samverkan med socialnämnden (16 § andra stycket LPT).'),
    ],
  },
};

// Vårdförloppet för en plan: steg med status ur planens åtgärder och nästa steg på vanlig svenska. atgarder är
// planUt-åtgärderna (med senastUtford). null för en individuell plan utan mall.
export function vardforlopp(mall, atgarder = []) {
  const f = mall && Object.hasOwn(VARDFORLOPP, mall) ? VARDFORLOPP[mall] : null;
  if (!f) return null;
  const hor = (s) => atgarder.filter(x => s.atgarder.some(b => x.text.startsWith(b)));
  const rader = f.steg.map(s => {
    const egna = hor(s);
    const klar = egna.length > 0 && egna.every(x => x.senastUtford);
    const paborjat = egna.some(x => x.senastUtford);
    return { rubrik: s.rubrik, text: s.text, status: klar ? 'klar' : paborjat ? 'pagar' : 'kvar', atgarder: egna.map(x => x.id) };
  });
  const nasta = rader.find(r => r.status !== 'klar') ?? null;
  return {
    rubrik: f.rubrik, sammanfattning: f.sammanfattning, kalla: f.kalla, demomarkning: DEMOMARKNING, steg: rader,
    nasta: nasta ? { rubrik: nasta.rubrik, text: `Nästa steg: ${nasta.rubrik.toLowerCase()}. ${nasta.text}` } : { rubrik: null, text: 'Alla steg i vårdförloppet har åtgärder som är utförda. Följ upp målen och avsluta planen när de är nådda.' },
  };
}

// ---- Varningarna i läkemedelshanteringen --------------------------------------------------------------------------
// För varje regel: varför systemet varnar och vad användaren kan göra, på vanlig svenska, och källan.
const v = (varfor, vadGora, kalla = KALLOR.smpc) => ({ varfor, vadGora, kalla });
export const VARNINGAR = {
  overkanslighet: v('Patienten har reagerat på ett läkemedel i samma grupp. En ny kontakt med substansen kan ge en lika stark eller starkare reaktion.',
    'Välj ett läkemedel ur en annan grupp. Ordinera bara om nyttan är större än risken, och skriv varför i motiveringen. Läs vilken reaktion som är registrerad.'),
  dubbel_substans: v('Samma substans två gånger ger dubbel dos, och det är den vanligaste orsaken till överdosering i läkemedelslistan.',
    'Ändra den pågående ordinationen i stället för att lägga till en ny, eller sätt ut den gamla innan den nya sparas.'),
  dubbel_grupp: v('Två läkemedel i samma grupp har ofta samma effekt och samma biverkningar, och det är sällan avsikten att ge båda.',
    'Kontrollera att båda behövs. Behövs bara det ena, sätt ut det andra.'),
  dubbel_antikoagulantia: v('Två blodförtunnande läkemedel samtidigt ökar risken för allvarlig blödning kraftigt.',
    'Sätt ut det ena när det nya sätts in, till exempel vid byte från warfarin till en NOAK, och följ planen för bytet. Behövs båda en kort tid, skriv varför.'),
  warfarin_nsaid: v('NSAID hämmar blodplättarna och kan ge magsår, och tillsammans med warfarin ökar risken för allvarlig blödning.',
    'Välj paracetamol mot smärtan. Behövs NSAID, ge kortast möjliga tid och överväg skydd för magsäcken.'),
  metformin_egfr: v('Metformin utsöndras via njurarna. Vid nedsatt njurfunktion stiger halten, och risken för laktacidos ökar.',
    'Vid eGFR under 30 ska metformin inte användas. Vid eGFR 30 till 44 är högsta dygnsdos 1 000 mg. Ta ett nytt eGFR om värdet är gammalt.'),
  licens: v('Ett licensläkemedel får bara ges så länge licensen gäller och till den patient eller vårdenhet som licensen gäller för.',
    'Ansök om en ny licens innan den gamla går ut, eller välj ett godkänt läkemedel.', KALLOR.hsl),
  extempore: v('Ett extemporeläkemedel tillverkas för patienten och har ingen produktresumé.', 'Kontrollera beredningen och hållbarheten på etiketten.', KALLOR.hsl),
  blodprodukt: v('En blodprodukt ges bara efter kontroll vid sängen av patientens identitet och blodenheten.', 'Gör kontrollen vid sängen med en kollega.', KALLOR.hsl),
  blodkontroll: v('En blodprodukt ges bara efter kontroll vid sängen av patientens identitet och blodenheten.', 'Gör kontrollen vid sängen med en kollega.', KALLOR.hsl),
  studie_interaktion: v('Patienten deltar i en klinisk prövning, och prövningens protokoll begränsar vilka läkemedel som får ges.', 'Kontakta prövningens ansvariga läkare innan läkemedlet ordineras.'),
  utanfor_studie: v('Prövningsläkemedlet får bara ges till den som deltar i prövningen.', 'Kontrollera att patienten deltar, eller välj ett annat läkemedel.'),
  // Administrering.
  dubbel_dos: v('Dosen är redan given. En dos till ger dubbel dos.', 'Ge inte dosen. Kontrollera i listan vem som gav den och när, och fråga patienten.', KALLOR.hsl),
  for_tidig: v('Dosen ges tidigare än ordinationen tillåter, och halten i blodet kan bli för hög.', 'Vänta till dostiden, eller fråga läkaren om dosen kan ges nu.', KALLOR.hsl),
  max_per_dygn: v('Den högsta dygnsdosen i ordinationen är nådd. Fler doser kan ge förgiftning, till exempel leverskada av paracetamol.', 'Ge inte fler doser i dag. Kontakta läkaren om patienten behöver mer.', KALLOR.hsl),
  utan_ordination: v('Ett läkemedel ges bara efter en ordination (HSLF-FS 2017:37 6 kap.).', 'Be läkaren ordinera läkemedlet. En muntlig ordination dokumenteras och signeras av läkaren i efterhand.', KALLOR.hsl),
  avvikande_dos: v('Dosen avviker från den ordinerade.', 'Ge den ordinerade dosen, eller be läkaren ändra ordinationen.', KALLOR.hsl),
  avvikande_volym: v('Den uppmätta volymen motsvarar inte den ordinerade dosen.', 'Mät upp volymen igen innan dosen ges.', KALLOR.hsl),
  for_liten_volym: v('En så liten volym går inte att mäta upp säkert.', 'Be läkaren ordinera en annan styrka.', KALLOR.hsl),
  saturation_over_mal: v('För mycket syrgas kan ge koldioxidretention hos en patient med KOL.', 'Fråga läkaren om flödet kan sänkas.'),
  saturation_under_mal: v('Saturationen är under målet, och patienten kan behöva mer syrgas.', 'Kontakta läkaren om flödet behöver höjas.'),
  sparrade_uppgifter: v('Uppgifter från en spärrad vårdenhet räknas inte in i kontrollen, eftersom de inte får visas.', 'Fråga patienten om samtycke att visa uppgifterna om de kan ha betydelse.', KALLOR.hsl),
};
// Utsättningsreglerna har redan ett förslag (lakemedelsregler.js UTSATTNINGSREGLER). Varför-texten är regelns text.

// Lägger till varför, vad användaren kan göra och källan i varje varning som har en kunskapstext. Varningar som redan
// har ett förslag behåller det som vad användaren kan göra.
export function berika(varningar = []) {
  return varningar.map(x => {
    const k = x?.regel && Object.hasOwn(VARNINGAR, x.regel) ? VARNINGAR[x.regel] : null;
    if (!k && !x?.forslag) return x;
    return { ...x, kunskap: { varfor: k?.varfor ?? x.text, vadGora: x.forslag ?? k?.vadGora ?? null, kalla: k?.kalla ?? KALLOR.smpc, demomarkning: DEMOMARKNING } };
  });
}

// ---- Läkemedelsinformation att slå upp ---------------------------------------------------------------------------
// Per ATC-prefix, det längsta prefixet gäller. njure: gränser för eGFR (ml/min/1,73 m²) med vad som gäller under
// gränsen, från den lägsta. aldre: text om läkemedlet är olämpligt för äldre (75 år och äldre i demon).
const lm = (egenskaper, dosering, { njure = [], njureText = null, aldre = null } = {}) => ({ egenskaper, dosering, njure, njureText, aldre });
const n = (under, niva, text) => ({ under, niva, text });
export const SUBSTANSER = {
  B01AA03: lm('Warfarin hämmar bildningen av koagulationsfaktorer som beror på vitamin K. Effekten följs med PK(INR).',
    'Dosen styrs av PK(INR), vanligen med mål 2 till 3. Många läkemedel och livsmedel påverkar effekten.',
    { njureText: 'Ingen dosjustering för njurfunktionen, men risken för blödning ökar vid kraftigt nedsatt njurfunktion.', njure: [n(30, 'observera', 'Risken för blödning är ökad vid eGFR under 30. Följ PK(INR) tätare.')] }),
  B01AF02: lm('Apixaban hämmar faktor Xa direkt och behöver inga provtagningar för att styra dosen.',
    'Vid förmaksflimmer 5 mg två gånger dagligen. 2,5 mg två gånger dagligen om två av tre gäller: 80 år eller äldre, vikt 60 kg eller lägre, kreatinin 133 µmol/l eller högre.',
    { njure: [n(15, 'allvarlig', 'Rekommenderas inte vid kreatininclearance under 15.'), n(30, 'observera', 'Används med försiktighet vid kreatininclearance 15 till 29. Vid förmaksflimmer ges då 2,5 mg två gånger dagligen.')] }),
  B01AF01: lm('Rivaroxaban hämmar faktor Xa direkt och behöver inga provtagningar för att styra dosen.',
    'Vid förmaksflimmer 20 mg en gång dagligen, tillsammans med mat.',
    { njure: [n(15, 'allvarlig', 'Rekommenderas inte vid kreatininclearance under 15.'), n(50, 'observera', 'Vid förmaksflimmer och kreatininclearance 15 till 49 är dosen 15 mg en gång dagligen.')] }),
  B01AB: lm('Lågmolekylärt heparin hämmar koagulationen genom antitrombin och ges som injektion under huden.',
    'Dosen beror på indikationen och vikten. Som profylax ges vanligen en dos per dygn.',
    { njure: [n(30, 'observera', 'Vid kreatininclearance under 30 ansamlas läkemedlet. Dosen kan behöva minskas och anti-Xa följas.')] }),
  A10BA02: lm('Metformin minskar glukosbildningen i levern och ökar känsligheten för insulin. Ger inte lågt blodsocker i sig.',
    'Börja med 500 mg en eller två gånger dagligen till måltid och öka efter hand. Högsta dygnsdos 3 000 mg vid normal njurfunktion.',
    { njure: [n(30, 'allvarlig', 'Ska inte användas vid eGFR under 30.'), n(45, 'observera', 'Vid eGFR 30 till 44 är högsta dygnsdos 1 000 mg. Börja inte behandlingen vid eGFR i det intervallet.'), n(60, 'observera', 'Vid eGFR 45 till 59 är högsta dygnsdos 2 000 mg.')] }),
  A10BK03: lm('Empagliflozin ökar utsöndringen av glukos i urinen och skyddar hjärtat och njurarna vid hjärtsvikt och kronisk njursjukdom.',
    'Vid hjärtsvikt 10 mg en gång dagligen.',
    { njure: [n(20, 'observera', 'Börja inte behandlingen vid eGFR under 20. Den glukossänkande effekten minskar redan under 45.')] }),
  A10A: lm('Insulin sänker blodsockret. Fel dos kan ge livshotande lågt blodsocker.',
    'Dosen är individuell och följs med glukoskontroller. Insulininfusion ges efter ett fastställt schema.',
    { njure: [n(30, 'observera', 'Vid nedsatt njurfunktion bryts insulin ned långsammare, och risken för lågt blodsocker ökar.')] }),
  M01A: lm('NSAID dämpar inflammation och smärta genom att hämma prostaglandinerna, vilket också påverkar njurarna, magslemhinnan och blodplättarna.',
    'Lägsta effektiva dos under kortast möjliga tid.',
    { njure: [n(30, 'allvarlig', 'Bör undvikas vid eGFR under 30, eftersom njurfunktionen kan försämras ytterligare.'), n(60, 'observera', 'Kan försämra njurfunktionen vid eGFR under 60, särskilt tillsammans med diuretika och ACE-hämmare.')],
      aldre: 'NSAID ökar risken för blödning från magtarmkanalen, njursvikt och hjärtsvikt hos äldre.' }),
  N02BE01: lm('Paracetamol lindrar smärta och sänker feber och påverkar inte blodplättarna eller magslemhinnan.',
    'Högsta dygnsdos är 4 g för vuxna. Vid låg vikt, nedsatt leverfunktion eller hög ålder är 3 g en säkrare gräns.',
    { njure: [n(30, 'observera', 'Vid eGFR under 30 bör det gå minst sex timmar mellan doserna.')] }),
  N02A: lm('Opioider lindrar svår smärta genom opioidreceptorerna i nervsystemet. De kan ge andningsdepression, förstoppning och förvirring.',
    'Börja med en låg dos och trappa upp efter effekt. Ge alltid något mot förstoppning.',
    { njure: [n(30, 'allvarlig', 'Morfin och dess nedbrytningsprodukter ansamlas vid eGFR under 30. Välj en annan opioid eller sänk dosen kraftigt.'), n(60, 'observera', 'Vid eGFR under 60 kan dosen behöva minskas eller intervallet förlängas.')],
      aldre: 'Opioider ökar risken för förvirring, förstoppning och fall hos äldre.' }),
  N05BA: lm('Bensodiazepiner verkar lugnande och ångestdämpande. Diazepam har lång halveringstid.',
    'Kortast möjliga tid. Beroende kan utvecklas efter några veckor.',
    { aldre: 'Bensodiazepiner med lång halveringstid, som diazepam, ökar risken för fall, förvirring och dagtrötthet hos äldre.' }),
  N05CF: lm('Zopiklon är ett sömnmedel som verkar som bensodiazepinerna.',
    'Kortast möjliga tid, vanligen högst några veckor. Hos äldre lägre dos.',
    { aldre: 'Sömnmedel ökar risken för fall och förvirring hos äldre.' }),
  C03DA01: lm('Spironolakton blockerar aldosteron och sparar kalium. Används vid hjärtsvikt och för att behandla ödem.',
    'Vid hjärtsvikt vanligen 25 till 50 mg en gång dagligen. Kalium och kreatinin följs.',
    { njure: [n(30, 'allvarlig', 'Risken för farligt högt kalium är stor vid eGFR under 30. Används inte.'), n(45, 'observera', 'Vid eGFR 30 till 44 är risken för högt kalium ökad. Följ kalium tätt.')] }),
  C09AA: lm('ACE-hämmare sänker blodtrycket och avlastar hjärtat. De kan höja kalium och kreatinin.',
    'Trappa upp till måldos. Kalium och kreatinin kontrolleras en till två veckor efter start och dosökning.',
    { njure: [n(30, 'observera', 'Vid eGFR under 30 börjar man med en lägre dos och följer kalium och kreatinin tätt.')] }),
  C03CA01: lm('Furosemid är ett loopdiuretikum som snabbt drar ut vätska via njurarna.',
    'Dosen anpassas efter vikten och vätskebalansen.',
    { njureText: 'Vid nedsatt njurfunktion behövs ofta en högre dos för att få effekt.' }),
  C07AB: lm('Betablockerare sänker pulsen och skyddar hjärtat vid hjärtsvikt och efter hjärtinfarkt.',
    'Trappa upp långsamt till måldos. Sätts inte ut tvärt.', {}),
  C10AA: lm('Statiner sänker LDL-kolesterolet och minskar risken för hjärtinfarkt och stroke.',
    'En gång dagligen. Muskelvärk kan vara en biverkning.', {}),
  C01AA05: lm('Digoxin sänker hjärtfrekvensen vid förmaksflimmer och ökar hjärtats kontraktionskraft.',
    'Låg dos och kontroll av koncentrationen i blodet, särskilt hos äldre.',
    { njure: [n(60, 'observera', 'Digoxin utsöndras via njurarna. Vid nedsatt njurfunktion behövs en lägre dos och kontroll av koncentrationen.')] }),
  B05XA: lm('Koncentrerade elektrolyter, som kaliumklorid och magnesiumsulfat, späds alltid före infusion.',
    'Kalium ges högst 10 mmol per timme i en perifer infart. Ordinationen anger mängden i mmol.',
    { njure: [n(30, 'observera', 'Vid eGFR under 30 utsöndras kalium och magnesium sämre. Följ halterna i blodet tätt.')] }),
  L01: lm('Cytostatika hämmar celldelningen och ges efter en fastställd regim med kontroll av blodvärden.',
    'Dosen räknas ur kroppsyta eller vikt enligt regimen. Följ beredningsordern.',
    { njureText: 'Flera cytostatika kräver dosjustering efter njurfunktionen enligt regimen.' }),
};

// Den mest specifika posten för ATC-koden.
export function substansFor(atc = '') {
  let bast = null;
  for (const k of Object.keys(SUBSTANSER)) if (atc.startsWith(k) && (!bast || k.length > bast.length)) bast = k;
  return bast ? { atcPrefix: bast, ...SUBSTANSER[bast] } : null;
}

const ALDER_ALDRE = 75;
// Läkemedelsinformationen för ett läkemedel, med det som gäller just den här patienten: eGFR och ålder skickas in av
// den som anropar och har prövats i behörighetsmotorn där. olampligAldre är regeln i lakemedelsregler.js.
export function lakemedelsinfo(lakemedel, { egfr = null, alder = null, olampligAldre = null } = {}) {
  const s = substansFor(lakemedel.atc);
  const njure = s?.njure ?? [];
  // Den strängaste gränsen som patientens eGFR är under.
  const galler = egfr == null ? null : [...njure].sort((a, b) => a.under - b.under).find(x => egfr < x.under) ?? null;
  const aldreText = s?.aldre ?? olampligAldre ?? null;
  return {
    lakemedel: { id: lakemedel.id, namn: lakemedel.namn, substans: lakemedel.substans, styrka: lakemedel.styrka, atc: lakemedel.atc },
    finns: Boolean(s),
    egenskaper: s?.egenskaper ?? 'Vårdkällans simulerade katalog har ingen sammanfattning för substansen. Läs produktresumén.',
    dosering: s?.dosering ?? null,
    njurfunktion: {
      gransar: njure.map(x => ({ under: x.under, niva: x.niva, text: x.text })), text: s?.njureText ?? (njure.length ? null : 'Ingen dosjustering för njurfunktionen i den simulerade katalogen.'),
      egfr, patient: egfr == null ? 'Patienten har inget eGFR som du får se. Ta ett nytt prov om njurfunktionen kan ha betydelse.'
        : galler ? `Patientens senaste eGFR är ${egfr}. ${galler.text}` : `Patientens senaste eGFR är ${egfr}. Ingen av gränserna för substansen gäller.`,
      niva: galler?.niva ?? null,
    },
    aldre: { olamplig: Boolean(aldreText), text: aldreText, alder, patient: aldreText && alder != null && alder >= ALDER_ALDRE ? `Patienten är ${alder} år. ${aldreText}` : null },
    kalla: aldreText && !s?.aldre ? `${KALLOR.smpc}. ${KALLOR.aldre}` : KALLOR.smpc,
    simulerad: SIMULERAD_KATALOG, demomarkning: DEMOMARKNING,
  };
}

// ---- NEWS2 ------------------------------------------------------------------------------------------------------
export const NEWS2_KUNSKAP = {
  rubrik: 'Vad NEWS2 betyder', kalla: KALLOR.news2, demomarkning: DEMOMARKNING,
  text: 'NEWS2 räknas ur sju vitalparametrar. 0 till 4 poäng: kontrollerna görs minst var tolfte timme. 5 till 6 poäng, eller 3 poäng i en enskild parameter: bedömning av läkare snarast och kontroller minst varje timme. 7 poäng eller mer: akut bedömning av ett team med kompetens för kritiskt sjuka och kontinuerlig övervakning.',
};
