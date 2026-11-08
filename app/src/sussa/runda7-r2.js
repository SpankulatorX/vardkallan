// Runda 7, r2: tillgänglighet (EN 301 549 och bilaga K2), skärmanpassning, nyheter vid ny version och övningar med
// intyg. Testnamnen för servertesterna (app/test/utbildning.test.js), testerna av gränssnittet (test/tillganglighet.cjs)
// och klickbudgeten, och posterna i Sussa 8.4, 10.1 och KD1.1 som rundan bygger. Mappningsfilerna lägger posterna
// härifrån ovanpå sina egna, så att ändringen ligger samlad här.
const GK = 'Gränssnitt > Klickbudget > ';
const GT = 'Gränssnitt > Tillgänglighet > ';
const GU = 'Gränssnitt > Utbildning > ';
const NY = 'Nyheter > ';
const UB = 'Övningar och intyg > ';
const TG = 'Tillgänglighetsredogörelse > ';
const TI = 'Inloggningens tidsgräns > ';

export const PREFIX = { GT, GU };

// Testerna av gränssnittet i test/tillganglighet.cjs.
export const G = {
  media: `${GT}inget ljud, ingen video, inga bilder av text och inget som blinkar eller rör sig av sig självt`,
  alt: `${GT}varje bild och symbol har ett textalternativ eller är dold för hjälpmedel`,
  namn: `${GT}varje formulärfält, knapp och länk har ett namn som beskriver syftet`,
  rubriker: `${GT}varje vy har en rubrik på nivå 1 och rubrikerna hoppar inte över någon nivå`,
  landmarken: `${GT}allt innehåll ligger i landmärken: sidhuvud, meny, huvudinnehåll och sidfot`,
  sprak: `${GT}sidan har språket svenska och varje vy har en egen sidtitel`,
  kontrast: `${GT}texten har minst 4,5:1 i kontrast och stor text minst 3:1, i alla vyer för alla roller`,
  komponentkontrast: `${GT}fältens ramar och fokusmarkeringen har minst 3:1 mot bakgrunden`,
  farg: `${GT}status, larm, uppmärksamhetssymbolen och kurvorna har text eller form utöver färgen`,
  zoom: `${GT}texten går att förstora till 200 procent utan att innehåll eller funktion försvinner`,
  omflyttning: `${GT}vid 320 px bredd behövs ingen rullning i sidled`,
  tangentbord: `${GT}allt som går att klicka på går att nå med tangentbordet`,
  fokusordning: `${GT}tabbordningen följer sidans ordning, utan positivt tabindex och utan tangentbordsfälla`,
  synligtFokus: `${GT}varje element som får fokus med tabb har en synlig fokusmarkering`,
  tangentbordFlode: `${GT}inloggning, att öppna en patient, byta flik och stänga nyheterna går med bara tangentbordet`,
  vidFokus: `${GT}att ett element får fokus byter inte sida och öppnar inget`,
  felmarkering: `${GT}ett fel i ett formulär markeras vid fältet och beskrivs med text`,
  hogKontrast: `${GT}högkontrastläget ger minst 7:1 i kontrast och följer datorns inställning`,
  rorelse: `${GT}med minskade rörelser i datorn finns inga animationer eller övergångar`,
  skarmar: `${GT}alla vyer fungerar på mobil, platta och stor skärm utan rullning i sidled och utan för långa textrader`,
  nyheter: `${GU}nyhetsrutan visar rollens nyheter efter inloggning, stängs med ett klick och går att läsa igen`,
  hjalp: `${GU}hjälpen i sammanhanget finns i de vanligaste flödena och går att öppna med tangentbordet`,
  intyg: `${GU}övningarna ger ett intyg med giltighetstid, och verksamhetschefen ser vårdenhetens intyg`,
  kbNyheter: `${GK}Läsa nyheterna och stänga dem inom budget`,
  // Runda 7, r2, andra omgången: varningen före utloggningen och övningarna som data.
  tidsgrans: `${GT}fem minuter före utloggningen läser skärmläsare upp en varning, Fortsätt arbeta förlänger inloggningen och osparad text finns kvar som utkast efter en ny inloggning`,
  redigera: `${GU}verksamhetschefen utser en utbildare, och utbildaren ändrar en övning som sparas som en ny version med historik`,
  kbForlang: `${GK}Fortsätta arbeta när inloggningen snart går ut inom budget`,
};

// Servertesterna i app/test/utbildning.test.js.
export const S = {
  nyFil: `${NY}nyheterna har version, datum och roller, och den senaste versionen är den som körs`,
  nyRoll: `${NY}rutan visar bara den aktuella versionens nyheter för användarens roll, och historiken går att läsa igen`,
  nyStang: `${NY}rutan stängs per användare och version och kommer tillbaka vid nästa version`,
  nyApi: `${NY}API: nyheter kräver inloggning, och invånaren får sina egna`,
  ovRoll: `${UB}varje yrkesroll har övningar, och rätt svar lämnas inte ut före rättningen`,
  ovIntyg: `${UB}alla rätt ger ett intyg som gäller i ett år, och ett fel ger förklaringar men inget intyg`,
  ovGiltighet: `${UB}intyget går ut efter ett år, och systemet varnar 30 dagar innan`,
  ovEnhet: `${UB}verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, och ingen annan gör det`,
  ovText: `${UB}övningarna och nyheterna innehåller inga patientuppgifter utom demopatienternas namn, och texterna är svenska`,
  ovAndras: `${UB}ett intyg ändras och raderas aldrig`,
  tgK2: `${TG}redogörelsen har varje krav i bilaga K2 med status och hur det är testat`,
  tgStatus: `${TG}ett krav är uppfyllt bara när alla dess tester är gröna, och det som bara kan bedömas av människor är märkt`,
  tgApi: `${TG}API: tillganglighet går att läsa utan inloggning`,
  tgDok: `${TG}docs/tillganglighet.md skrivs ur samma register som sidan och tar upp varje krav`,
  ovVersion: `${UB}verksamhetschefen och en utbildare ändrar övningarna som en ny version med historik, och ingen annan gör det`,
  ovProva: `${UB}en ändrad övning prövas innan den sparas, och systemet säger vad som saknas`,
  ovUtbildare: `${UB}verksamhetschefen utfärdar utbildarintyg bara till någon på vårdenheten med giltigt intyg`,
  tiUt: `${TI}inloggningen går ut efter en tid utan aktivitet, men sandlådan och utkasten finns kvar efter en ny inloggning`,
  tiBakgrund: `${TI}anrop i bakgrunden förlänger inte inloggningen, och Fortsätt arbeta gör det`,
  tiRubrik: `${TI}varje svar till en inloggad säger när inloggningen går ut, och utloggningen står i säkerhetsloggen`,
};

const ALLA_A11Y = [G.media, G.alt, G.namn, G.rubriker, G.landmarken, G.sprak, G.kontrast, G.komponentkontrast, G.farg, G.zoom, G.omflyttning,
  G.tangentbord, G.fokusordning, G.synligtFokus, G.tangentbordFlode, G.vidFokus, G.felmarkering, G.hogKontrast, G.rorelse, S.tgK2, S.tgStatus, S.tgApi, S.tgDok,
  G.tidsgrans, G.kbForlang, S.tiUt, S.tiBakgrund, S.tiRubrik];

// Posterna som rundan bygger. De ersätter avsnittsfilens planerade poster.
const POSTER = {
  '8.4.1.3': {
    kategori: 'system', avsedd: 'delvis', tester: ALLA_A11Y,
    losning: 'Gränssnittet prövas i varje bygge mot det som går att kontrollera automatiskt i WCAG 2.1 nivå AA, som EN 301 549 kapitel 9 och 11 hänvisar till: kontrast, namn på fält och knappar, textalternativ, rubrikordning, landmärken, språk, tabbordning, synligt fokus, tangentbord utan mus, förstoring till 200 procent och omflyttning vid 320 px, för varje vy och varje demoroll. Ingen information bärs bara av färg: status, larm, uppmärksamhetssymbolen och kurvorna har text eller form. Ett högkontrastläge finns, och systemet följer datorns inställningar för hög kontrast och minskade rörelser. Tillgänglighetsredogörelsen på sidan Tillgänglighet och i docs/tillganglighet.md visar varje krav i bilaga K2 med status och hur det är testat.',
    expert: 'Systemet följer självt datorns inställningar för kontrast och rörelse, bär varje statusvärde med text och form och förklarar fel på vanlig svenska vid fältet, så att ingen behöver ställa in något eller tolka färger.',
    anmarkning: 'De automatiska kontrollerna är skrivna i projektet, utan en extern tillgänglighetsmotor. Det som bara kan bedömas av människor, till exempel att rubriker och länktexter beskriver syftet och att språket är begripligt, är märkt så i redogörelsen och inte prövat med användare med funktionsnedsättning. Ingen granskning med skärmläsare är gjord. ISO 9241-11 följs genom användartestet med SUS (docs/anvandartest.md), som ännu inte är genomfört med vårdpersonal.',
  },
  'KD1.1.4.3': {
    kategori: 'system', avsedd: 'uppfyllt_demo', tester: [G.skarmar, G.omflyttning, G.zoom],
    losning: 'Gränssnittet är responsivt. Varje vy för varje demoroll prövas i varje bygge på mobil (360 px), platta (768 och 1024 px), vanlig skärm (1440 px) och stor skärm (2560 px), vid 200 procents förstoring och vid 320 px bredd: ingen rullning i sidled, och textraderna blir inte för långa på stor skärm.',
    expert: 'Systemet anpassar själv menyn, tabellerna och patienthuvudet till skärmen, så att användaren aldrig behöver välja en vy för sin enhet.',
    anmarkning: 'Prövat i Chromium med Playwright. Riktiga plattor, telefoner och flera skärmar är inte prövade.',
  },
  'KD1.1.4.10': {
    kategori: 'system', avsedd: 'delvis', tester: [G.skarmar, G.omflyttning, G.zoom, G.hogKontrast],
    losning: 'Responsiv design utan minsta upplösning: från 320 px bredd till 2560 px. Under 640 px blir menyn en knapp och knapparna minst 40 px höga, mellan 640 och 1100 px blir patienthuvudet och sidopanelerna smalare, och på stor skärm begränsas textraderna så att de går att läsa. Text och symboler är vektorer, så hög upplösning ger skarp text. Flera skärmar fungerar genom att journalen kan öppnas i flera fönster med samma inloggning.',
    expert: 'Systemet anpassar själv gränssnittet till skärmens storlek, förstoring och kontrastinställning, utan inställningar för användaren.',
    anmarkning: 'Rekommendation: minst 1280 px bredd för arbete med journalen på en vanlig arbetsplats, men allt fungerar från 320 px. Något stöd för att dela upp arbetet över flera skärmar, till exempel att följa med en patient mellan fönster, finns inte.',
  },
  '10.1.1.2': {
    kategori: 'leverantor', avsedd: 'delvis', tester: [G.hjalp, S.ovText],
    losning: 'Hjälptexterna i gränssnittet, nyheterna och övningarna är på svenska och prövas av språkkontrollen i bygget: inga engelska ord, tankstreck eller ellipser och korrekt å, ä och ö.',
    expert: 'Systemet prövar själv språket i varje bygge, så att ny text aldrig kommer ut på engelska.',
    anmarkning: 'Ett fullständigt utbildningsmaterial på nivå C1 finns inte. Språkkontrollen prövar ord och tecken, inte språknivån.',
  },
  '10.1.1.3': {
    kategori: 'leverantor', avsedd: 'delvis', tester: [G.hjalp, G.intyg, S.ovRoll, S.ovIntyg, S.ovEnhet],
    losning: 'Onlinehjälp i sammanhanget i de vanligaste flödena, övningar i utbildningsmiljön (demon) med intyg och giltighetstid, och uppföljning för verksamhetschefen. Allt nås i webbläsaren oberoende av tid och plats.',
    expert: 'Systemet väljer övningarna efter yrkesrollen, rättar och förklarar själv, och visar verksamhetschefen vem som behöver göra om dem.',
    anmarkning: 'Instruktionsfilmer, lärarledd utbildning och utvärdering av utbildningen finns inte.',
  },
  '10.1.1.4': {
    kategori: 'system', avsedd: 'uppfyllt_demo', tester: [S.nyFil, S.nyRoll, S.nyStang, S.nyApi, G.nyheter, G.kbNyheter],
    losning: 'Nyheterna för varje version står i app/src/nyheter.json med version, datum, roller och omfattning. Efter en ny version ser varje användare en kort ruta med det som är nytt för just den rollen, med de stora förändringarna först och en länk dit förändringen finns. Rutan stängs med ett klick och kommer inte tillbaka förrän nästa version, och alla nyheter för rollen går att läsa igen under Nyheter.',
    expert: 'Systemet vet själv vilken version som körs, vilken roll användaren har och vad användaren redan har läst, så att ingen behöver leta i versionsanteckningar eller läsa det som gäller andra roller.',
    anmarkning: 'Vad användaren har stängt sparas i demons sandlåda och följer inte med till en annan dator.',
  },
  '10.1.1.5': {
    kategori: 'system', avsedd: 'delvis', tester: [S.ovRoll, S.ovIntyg, S.ovGiltighet, S.ovEnhet, S.ovText, S.ovAndras, S.ovVersion, S.ovProva, S.ovUtbildare, G.intyg, G.redigera, G.hjalp],
    losning: 'Under Utbildning gör varje användare övningarna för sin yrkesroll med demopatienter och får ett intyg som gäller i ett år när alla svar är rätt. Verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, vilka som går ut inom 30 dagar och vilka som saknar intyg, och utfärdar utbildarintyg till den som själv har ett giltigt intyg. Övningarna är data med versioner: verksamhetschefen och utbildarna ändrar dem i gränssnittet, och varje ändring sparas som en ny version med vem, när och vad som ändrades. Hjälpen i sammanhanget länkar till övningarna.',
    expert: 'Systemet väljer övningarna efter yrkesrollen, rättar på servern och förklarar varje svar, räknar giltighetstiden, prövar en ändrad övning innan den sparas och säger vad som saknas, och vet själv vilka som arbetar på vårdenheten och vilka som är utbildare.',
    anmarkning: 'Övningarna är kunskapsfrågor om hur systemet fungerar, inte praktiska prov i journalen. Övningarna gäller hela vårdgivaren, inte en vårdenhet i taget. Utbildare är ett intyg, ingen egen inloggningsroll. Intygen gäller bara i demon.',
  },
};

// Lägger rundans poster ovanpå avsnittets poster.
export const medR7r2 = (poster) => poster.map(x => (POSTER[x.id] ? { id: x.id, egna: x.egna ?? [], ...POSTER[x.id] } : x));
