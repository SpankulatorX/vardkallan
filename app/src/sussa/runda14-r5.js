// Runda 14, r5: leverantörens åtaganden. Ett öppet projekt kan inte själv åta sig att driva systemet. Det som är
// levererat är dokumenten i docs/drift/ som en driftansvarig tar över och fyller i, servicenivårapporten och
// incidentregistret med rapporten till beställaren (servicenivaer.js), utbildningsmaterialet per roll, instruktionsfilmerna
// och innovationsrummet. En post blir delvis bara där dokumentet eller funktionen ger det kravet frågar efter (till
// exempel en beskrivning eller en rekommenderad process). Övriga poster står kvar som planerade, med en hänvisning till
// dokumentet. Mappningsfilerna lägger på detta sist.
const D = 'Driftdokument > ';
const S = 'Servicenivåer > ';
const U = 'Utbildningsmaterial > ';
const I = 'Innovationsrum > ';
const F = 'Instruktionsfilmer > ';

export const T14 = {
  sussaId: `${D}varje Sussa-id som ett dokument i docs/drift/ hänvisar till finns i Sussa-registret, och varje krav som dokumentet gäller står i texten`,
  filer: `${D}varje fil som dokumenten hänvisar till finns i repot`,
  sprak: `${D}dokumenten följer språkreglerna: svenska, inga tankstreck, ellipser eller interna anteckningar, och varje förkortning är förklarad`,
  avsnitt: `${D}varje dokument har avsnitten om det systemet har som stöd och det som ska fyllas i, med platshållare`,
  process: `${D}processhandboken beskriver incident-, problem-, ändrings-, release- och beställningshantering med roller, prioritetsmodell, större incidenter och uppföljningsmöten, övriga processer och hur ITIL v3/2011 motsvarar ITIL 4`,
  sla: `${D}servicenivådokumentet har regler och anvisningar, mall för servicenivåavtal och månadsrapport, hur referensnivån för svarstider tas fram och uppföljningsmöten`,
  rapportering: `${D}rutinen för incidentrapportering har förslaget till anvisning, vem som gör vad och vad exporten till beställaren innehåller`,
  kontinuitet: `${D}kontinuitetsplanen beskriver tillgången till informationen vid avbrott, systemet när integrerade system inte svarar, riskanalys, scenarier, roller och övning`,
  aterstallning: `${D}återställningsplanen har mål, säkerhetskopiering, återställning till en tidpunkt, provåterläsning och haveri av hela servern`,
  uppdateringar: `${D}dokumentet om säkerhetsuppdateringar beskriver vad som uppdateras och hur, planerat underhåll och CE-märkningen`,
  support: `${D}supportdokumentet har ansvarsfördelning, nivåer, kanaler, servicenivåer, språk och ärendehantering`,
  samverkan: `${D}samverkansmodellen har en ansvarig för helheten, organisation på strategisk, taktisk och operativ nivå, forum, roller och förändringsarbete i samarbete`,
  skadligKod: `${D}dokumentet om skadlig kod och intrång beskriver hur systemet förhindrar och upptäcker, det systemet inte gör och plan för åtgärd`,
  atkomst: `${D}dokumentet om åtkomst för drift och support beskriver behörighet i systemet, tilldelning och uppföljning, segmentering, direktåtkomst och nödåtkomst`,
  kryptering: `${D}dokumentet om kryptering anger systemets algoritmer, och varje algoritm som står där finns i koden`,
  klienter: `${D}dokumentet om klienter beskriver klienter, insticksprogram, tredjepartsprodukter, uppdatering och eKlient, och klienten laddar inga externa skript`,
  inforande: `${D}införandedokumentet har mall för projektplan, utbildningsplan, test fram till acceptanstest och planer för specialområden`,
  prioritet: `${S}systemet sätter prioriteten enligt prioritetsmodellen i bilaga DU2 ur två frågor på vanlig svenska, och saknad redundans blir prioritet 2`,
  behorighet: `${S}bara systemförvaltningen registrerar incidenter, och registreringen loggas i säkerhetsloggen utan incidentens text`,
  patientuppgifter: `${S}en incident tar inte emot patientuppgifter: en text som ser ut att innehålla ett personnummer stoppas`,
  major: `${S}prioritet 1 som inte är löst inom 2 timmar startar processen för en större incident, och åtgärdstiden räknas mot gränsvärdet`,
  uppfoljning: `${S}prioritet 1 och 2 avslutas bara med orsak, konsekvens, åtgärd och förebyggande åtgärd, och uppföljningsmötet registreras efteråt`,
  tidsgrans: `${S}systemet säger när beställaren ska ha rapporten om incidenten, och en personuppgiftsincident ska rapporteras inom 24 timmar`,
  export: `${S}incidentrapporten till beställaren har incidenterna och säkerhetsloggens händelser per typ, utan patientuppgifter eller personer, markerar incidenterna som rapporterade och loggas`,
  rapport: `${S}månadsrapporten räknas ur incidentregistret och systemets mått: tillgänglighet, åtgärdstider mot gränsvärdena, året hittills, svarstider, kopior och säkerhetsloggen`,
  manader: `${S}månaderna följer svensk tid, också över skiftet till vintertid`,
  api: `${S}API > rutterna nekar annan roll än systemförvaltaren, och systemförvaltaren registrerar, avslutar, följer upp och tar ut rapporten`,
  // Klickbudgeten (krav.js, klickbudgetTest) för flödet Registrera en incident.
  gui: 'Gränssnitt > Klickbudget > Registrera en incident inom budget',
  uRoller: `${U}varje yrkesroll med övningar har ett material, och invånaren har ett eget`,
  uOvningar: `${U}varje övning och varje instruktionsfilm för rollen finns med i rollens material, med rätt svar och förklaring`,
  uFloden: `${U}varje arbetsflöde i materialet finns i klickbudgeten och görs av en demoroll med rollens yrke`,
  uSprak: `${U}texterna är på svenska utan engelska ord, tankstreck, ellipser och interna anteckningar`,
  uKoncept: `${U}utbildningskonceptet tar upp e-utbildning, praktiska prov, filmer, lärarledd utbildning, superanvändare, utvärdering och hur materialet hålls aktuellt`,
  uFiler: `${U}filerna i docs/utbildning är exakt det som skrivs ur registren`,
  iDelar: `${I}innovationsrummet tar upp dokumentation, utvecklarforum, utbildning, processer, rutiner och support`,
  iBidra: `${I}CONTRIBUTING.md beskriver hur man bygger, kör, testar och bidrar under EUPL 1.2`,
  iSprak: `${I}innovationsrummet och CONTRIBUTING.md följer språkreglerna`,
  filmFloden: `${F}varje instruktionsfilm är ett flöde i klickbudgeten, och filmerna täcker läkaren, sjuksköterskan, undersköterskan, vårdadministratören, invånaren och systemförvaltaren`,
  filmFiler: `${F}skriptet som spelar in filmerna finns i repot, och varje film i docs/filmer/ är en WebM på högst 2 MB`,
};
const DOK = [T14.sussaId, T14.filer, T14.sprak, T14.avsnitt];
const DRIFTANSVARIG = 'Åtagandet kräver en driftansvarig organisation, till exempel regionen eller en driftleverantör, som arbetar efter dokumentet och kan visa det för beställaren.';
const ANM_PLANERAT = (dok) => `Gäller leverantörens åtagande och inte systemets funktion. Underlaget för den som driver systemet finns i ${dok}. Ett dokument gör inte att åtagandet är uppfyllt.`;

// Delvis: dokumentet eller funktionen ger det kravet frågar efter.
const delvis = (tester, losning, anmarkning, expert = null) => ({ avsedd: 'delvis', tester: [...DOK, ...tester], losning, anmarkning, ...(expert ? { expert } : {}) });
const planerat = (dok) => ({ avsedd: 'planerat', tester: [], anmarkning: ANM_PLANERAT(dok) });

const HANDBOK = 'docs/drift/processhandbok.md';
const L_HANDBOK = 'Processhandboken i docs/drift/processhandbok.md beskriver incident-, problem-, ändrings-, release- och beställningshantering enligt ITIL 4 med roller för driftleverantören och beställaren, rapporteringsvägar, prioritetsmodellen ur servicenivåbilagan, större incidenter, incidentuppföljningsmöten, övriga processer och en tabell över hur ITIL v3/2011 motsvarar ITIL 4. Den skrivs ur källkoden och kan tas över och fyllas i.';
const E_INCIDENT = 'Systemförvaltaren svarar på två frågor på vanlig svenska, och systemet sätter prioriteten enligt servicenivåavtalet, räknar åtgärdstiden mot gränsvärdet, säger när beställaren ska ha rapporten och när processen för en större incident ska startas.';
const L_INCIDENT = 'Incidentregistret på sidan Servicenivåer och incidenter: prioriteten sätts ur hur många som berörs och om vården kan arbeta, prioritet 1 som inte är löst inom 2 timmar visas som en större incident, prioritet 1 och 2 avslutas med orsak, konsekvens, åtgärd och förebyggande åtgärd, och uppföljningsmötet registreras.';

export const R14R5 = {
  // Processhandboken (KD1.3).
  'KD1.3.1.1': delvis([T14.process], L_HANDBOK, `Processerna är definierade i ett förslag till processhandbok och är inte överenskomna med någon beställare. ${DRIFTANSVARIG}`),
  'KD1.3.1.2': planerat(HANDBOK),
  'KD1.3.1.3': delvis([T14.process], `${L_HANDBOK} Avsnittet om hur handboken hålls uppdaterad beskriver hur beställaren involveras och hur ändringar överenskoms skriftligen.`, DRIFTANSVARIG),
  'KD1.3.2.1': planerat(HANDBOK),
  'KD1.3.2.2': delvis([T14.process, T14.uppfoljning], `${L_HANDBOK} ${L_INCIDENT}`, `Systemet håller underlaget och registrerar att mötet är hållet. Mötet hålls av driftleverantören med beställaren. ${DRIFTANSVARIG}`, E_INCIDENT),
  'KD1.3.2.3': delvis([T14.process, T14.major], `${L_HANDBOK} ${L_INCIDENT}`, `Systemet säger när processen för en större incident ska startas. Processen genomförs av driftleverantören. ${DRIFTANSVARIG}`, E_INCIDENT),
  'KD1.3.2.4': delvis([T14.process, T14.rapportering], `${L_HANDBOK} Rutinen för incidentrapportering finns i docs/drift/incidentrapportering.md.`, DRIFTANSVARIG),
  'KD1.3.3.1': planerat(HANDBOK),
  'KD1.3.3.2': delvis([T14.process], L_HANDBOK, DRIFTANSVARIG),
  'KD1.3.4.1': planerat(HANDBOK),
  'KD1.3.4.2': delvis([T14.process], `${L_HANDBOK} Ändringar i systemets regler och parametrar görs med fyra ögon i systemet självt.`, DRIFTANSVARIG),
  'KD1.3.5.1': planerat(HANDBOK),
  'KD1.3.5.2': delvis([T14.process], `${L_HANDBOK} Uppgraderingar godkänns av två systemförvaltare och går att backa.`, DRIFTANSVARIG),
  'KD1.3.6.1': planerat(HANDBOK),
  'KD1.3.6.2': delvis([T14.process], L_HANDBOK, DRIFTANSVARIG),
  'KD1.3.7.1': delvis([T14.process], L_HANDBOK, DRIFTANSVARIG),
  // Servicenivåer (KD1.2).
  'KD1.2.1.1': delvis([T14.sla, T14.rapport, T14.prioritet, T14.gui], 'Regler och anvisningar för servicenivåhantering i docs/drift/servicenivaer.md, med mallar för servicenivåavtal och månadsrapport. Verktyget är servicenivårapporten och incidentregistret på sidan Servicenivåer och incidenter.', `Reglerna är ett förslag och är inte godkända av någon beställare. Gränsvärdena kommer ur upphandlingens servicenivåbilaga. ${DRIFTANSVARIG}`, 'Systemet räknar utfallet mot gränsvärdena själv och skriver avvikelserna på vanlig svenska, så att ingen behöver räkna fram rapporten för hand.'),
  'KD1.2.1.2': delvis([T14.sla, T14.rapport, T14.api, T14.gui], 'Systemet räknar månadsrapporten för servicenivåerna ur incidentregistret och sina egna mått: tillgängligheten, antal och åtgärdstid per prioritet mot gränsvärdena, året hittills, svarstiderna, säkerhetskopiorna och säkerhetsloggens kedja.', `Svarstiderna mäts av servern sedan den startade, inte vid beställarens anslutningspunkt, och rapporten gäller sandlådan i demon. Övervakningen dygnet runt och den månatliga rapporteringen görs av driften. ${DRIFTANSVARIG}`, 'Systemet räknar rapporten för vald månad och säger vilka gränsvärden som har överskridits. Användaren väljer bara månaden.'),
  'KD1.2.1.3': delvis([T14.sla], 'Dokumentet docs/drift/servicenivaer.md beskriver hur referensnivån för svarstider tas fram med mätpunkt vid anslutningspunkten, serverns Server-Timing och p95 per adress i /api/drift och lasttestet.', `Referensnivån ska definieras tillsammans med beställaren under grundimplementationen, och det är inte gjort. ${DRIFTANSVARIG}`),
  'KD1.2.1.4': delvis([T14.process, T14.prioritet], 'När avtalad redundans saknas utan att någon incident har inträffat registreras det som en incident av slaget Avtalad redundans saknas, och systemet ger den prioritet 2.', DRIFTANSVARIG, 'Systemet sätter prioriteten själv och förklarar varför, så att ingen behöver komma ihåg regeln.'),
  'KD1.2.1.5': delvis([T14.sla, T14.rapport], 'Uppföljningen av servicenivåerna beskrivs i docs/drift/servicenivaer.md, och systemet räknar månadsrapporten ur incidentregistret och sina egna mått.', DRIFTANSVARIG),
  // Leverantörens drift (KD1.1).
  'KD1.1.1.1': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.2': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.3': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.4': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.6': planerat('docs/drift/sakerhetsuppdateringar.md'),
  'KD1.1.1.7': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.8': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.9': planerat('docs/drift/datahallar.md'),
  'KD1.1.1.11': delvis([T14.kontinuitet], 'Kontinuitetsplanen i docs/drift/kontinuitetsplan.md beskriver hur systemet fungerar när integrerade system inte svarar: överföringen till NLL får status okänd och stäms av, prenumerationer har en tidsgräns, laboratoriernas meddelanden väntar i en utkorg och masterdata gäller i sin senast giltiga version.', `Beskrivningen gäller systemets egen del. Prövning med beställarens integrationer är inte gjord. ${DRIFTANSVARIG}`),
  'KD1.1.1.12': delvis([T14.uppdateringar], 'Dokumentet docs/drift/sakerhetsuppdateringar.md beskriver planerat underhåll med så lite avbrott som möjligt, och uppgraderingar godkänns av två systemförvaltare och går att backa.', `Systemet har ingen växling mellan servrar utan avbrott, så ett versionsbyte kräver en omstart. ${DRIFTANSVARIG}`),
  'KD1.1.1.13': planerat('docs/drift/datahallar.md'),
  'KD1.1.2.1': planerat('docs/drift/datahallar.md'),
  'KD1.1.2.2': planerat('docs/drift/datahallar.md'),
  'KD1.1.3.1': planerat('docs/drift/aterstallning.md'),
  'KD1.1.3.2': planerat('docs/drift/aterstallning.md'),
  'KD1.1.4.1': planerat('docs/drift/klienter.md'),
  'KD1.1.4.2': planerat('docs/drift/klienter.md'),
  'KD1.1.4.4': delvis([T14.klienter], 'Dokumentet docs/drift/klienter.md beskriver vilka klienter som stöds: systemet är en webbtillämpning i webbläsaren, också i mobilen, utan klientprogram.', 'Testerna körs i Chromium. Andra webbläsare och riktiga mobiler är inte prövade i bygget.'),
  'KD1.1.4.5': delvis([T14.klienter], 'Dokumentet docs/drift/klienter.md har en tabell mot eKlients bilagor KD1 till KD4 med vad som är prövat och vad som inte är prövat.', 'Följsamheten är inte prövad på beställarens standardklient.'),
  'KD1.1.4.6': delvis([T14.klienter], 'Systemet kräver inga insticksprogram. Dokumentet docs/drift/klienter.md beskriver det, och testet prövar att sidan inte laddar några skript från andra webbplatser.', 'Inte prövat på beställarens standardklient.'),
  'KD1.1.4.7': delvis([T14.klienter], 'Systemet kräver ingen klientvirtualisering, eftersom det körs i webbläsaren (docs/drift/klienter.md).', 'Inte prövat på beställarens standardklient.'),
  'KD1.1.4.8': delvis([T14.klienter], 'Klienten har inga tredjepartsprodukter utöver webbläsaren: inga skript, typsnitt eller stilmallar laddas från andra webbplatser (docs/drift/klienter.md).', 'Inte prövat på beställarens standardklient.'),
  'KD1.1.4.9': delvis([T14.klienter], 'Klienten uppdateras av webbläsaren genom systemets service worker när en ny version finns, utan paket och utan installation (docs/drift/klienter.md).', 'Beställarens roller och rutiner för klientuppgradering är inte överenskomna.'),
  // Arkitektur och säkerhet hos leverantören (5.2 och 5.3).
  '5.2.1.5': delvis([T14.atkomst], 'Dokumentet docs/drift/atkomst-for-drift-och-support.md beskriver hur behörigheter för drift- och supportpersonal tilldelas, följs upp och begränsas, segmentering och separering, direktåtkomst och nödåtkomst för drift. I systemet läser systemförvaltaren inte journalen, ändringar görs med fyra ögon och loggas i säkerhetsloggen.', `Åtkomsten till servrar och databaser utanför systemet styrs och loggas av driften. ${DRIFTANSVARIG}`),
  '5.3.1.1': planerat('docs/drift/informationssakerhet.md'),
  '5.3.1.4': delvis([T14.kryptering], 'Dokumentet docs/drift/kryptering.md anger vilka algoritmer och nyckellängder systemet använder vid signering, inloggning och lagring, och vad driften ska ha för TLS, lagring och nyckelhantering. Testet prövar att varje algoritm som står där finns i koden.', `Systemet terminerar inte TLS själv och krypterar inte databasen eller säkerhetskopiorna. Det gör driften. ${DRIFTANSVARIG}`),
  '5.3.1.9': planerat('docs/drift/fysiskt-skydd.md'),
  '5.3.1.10': delvis([T14.skadligKod], 'Dokumentet docs/drift/skydd-mot-skadlig-kod-och-intrang.md beskriver det systemet gör (policy för innehåll, kontroll av filtyp ur innehållet, tak på storlek och antal) och den övervakning, de larm och den plan för åtgärd som driften ska ha.', `Uppladdade filer söks inte igenom efter virus av systemet. ${DRIFTANSVARIG}`),
  '5.3.1.11': delvis([T14.uppdateringar], 'Dokumentet docs/drift/sakerhetsuppdateringar.md beskriver hur systemet och plattformen hålls uppdaterade: koden har inga externa paket, Bun-versionen är låst, och en uppgradering kräver gröna tester och två systemförvaltare och går att backa.', `Bevakningen av säkerhetsuppdateringar och hur de påverkar CE-märkningen sköts av den som driver och förvaltar systemet. ${DRIFTANSVARIG}`),
  '5.3.1.13': delvis([T14.skadligKod], 'Dokumentet docs/drift/skydd-mot-skadlig-kod-och-intrang.md beskriver intrångsskydd och intrångsdetektering: det systemet gör (säkerhetsloggen med avvisade anrop och misslyckade inloggningar, tak mot missbruk och hashkedjor som avslöjar ändrade loggrader) och det driften ska ha för att upptäcka, förhindra och larma.', `Larm till en driftorganisation finns inte i systemet. ${DRIFTANSVARIG}`),
  '5.3.1.14': delvis([T14.rapportering, T14.tidsgrans, T14.export, T14.gui], 'Rutinen för incidentrapportering i docs/drift/incidentrapportering.md, och incidentrapporten till beställaren som systemförvaltaren tar ut från sidan Servicenivåer och incidenter: incidenterna med prioritet, tider och underlaget till uppföljningen och säkerhetsloggens händelser räknade per typ, utan patientuppgifter. Uttaget loggas, och incidenterna markeras som rapporterade.', `Tidsgränserna är ett förslag till anvisning tills beställaren har gett sin, och i demon hämtas rapporten som en fil. ${DRIFTANSVARIG}`, 'Systemet säger för varje incident när beställaren senast ska ha rapporten och om tidsgränsen har hållits, och räknar säkerhetsloggens händelser själv.'),
  '5.3.1.15': delvis([T14.kontinuitet], 'Kontinuitetsplanen i docs/drift/kontinuitetsplan.md beskriver hur tillgången till informationen säkras: läsläget med den krypterade läskopian, registrering av doser och mätvärden under avbrott, säkerhetskopior på två platser och hur systemet fungerar när integrerade system inte svarar, med riskanalys, scenarier, roller och övning.', DRIFTANSVARIG),
  '5.3.1.16': delvis([T14.aterstallning], 'Planen i docs/drift/aterstallning.md med mål för återställningen, och verktygen i systemet: säkerhetskopior på två platser med verifiering, återställning till en tidpunkt med fyra ögon och provåterläsning i bygget.', `Att bygga upp hela tjänsten på en ny server från kopiorna på den andra platsen är inte prövat. ${DRIFTANSVARIG}`),
  // Styrning och samverkan (9.1) och förändringsarbete (11.1).
  '9.1.1.1': delvis([T14.samverkan], 'Samverkansmodellen i docs/drift/samverkansmodell.md beskriver samverkansorganisationen på strategisk, taktisk och operativ nivå för hela avtalsperioden, med forum, periodicitet, agendor och roller.', `Modellen är ett förslag och kräver en ansvarig organisation som fyller rollerna. ${DRIFTANSVARIG}`),
  '9.1.1.2': delvis([T14.samverkan], 'Samverkansmodellen i docs/drift/samverkansmodell.md beskriver den gemensamma styrningen för samarbetet med roller, processer, verktyg och forum.', DRIFTANSVARIG),
  '9.1.1.3': delvis([T14.samverkan], 'Samverkansmodellen i docs/drift/samverkansmodell.md beskriver styrningen för den enskilda regionen med roller, processer, verktyg och forum.', DRIFTANSVARIG),
  '11.1.1.1': delvis([T14.samverkan], 'Avsnittet om förändringsarbete i samarbete i docs/drift/samverkansmodell.md föreslår hur förändringsarbetet kan bedrivas mellan beställaren och leverantören.', DRIFTANSVARIG),
  '11.1.1.2': delvis([T14.samverkan], 'Avsnittet om förändringsarbete i samarbete i docs/drift/samverkansmodell.md beskriver förändringsledare, superanvändare och verksamhetens deltagande i test och utbildning.', DRIFTANSVARIG),
  // Implementation (11.2 och 11.3).
  '11.2.1.1': planerat('docs/drift/inforande.md'),
  '11.2.1.2': planerat('docs/drift/samverkansmodell.md'),
  '11.2.1.3': planerat('docs/drift/samverkansmodell.md'),
  '11.2.1.4': delvis([T14.filmFloden, T14.filmFiler, T14.uOvningar], 'Instruktionsfilmer i docs/filmer/, en per vanligt arbetsflöde, med textade steg på svenska. De spelas in ur samma flöden som klickbudgeten mäter med test/instruktionsfilmer.cjs och kan göras om efter varje ändring. E-utbildningen är övningarna i systemet, och utbildningsmaterialet per roll länkar till filmerna.', 'Materialet är inte anpassat till en beställares verksamhet, och inget acceptanstest är påbörjat.'),
  '11.2.1.6': planerat('docs/drift/inforande.md'),
  '11.2.1.9': delvis([T14.inforande], 'En mall för projektplanen för grundimplementationen i docs/drift/inforande.md med organisation och kompetens, leveransobjekt, tid- och aktivitetsplan, milstolpar, roller och ansvar, testaktiviteter, utbildningsaktiviteter, risker och integrationerna i kategori B och C.', 'Planen är en mall från projektet och är inte överenskommen med någon beställare.'),
  '11.2.1.10': delvis([T14.inforande], 'En mall för projektplanen för grundimplementationen i docs/drift/inforande.md.', 'Planen är en mall från projektet och är inte överenskommen med någon beställare.'),
  '11.2.1.11': delvis([T14.inforande, T14.uKoncept], 'Utbildningsplanen för grundimplementationen i docs/drift/inforande.md, och utbildningsmaterialet per roll i docs/utbildning/.', 'Planen är ett förslag. Utbildning av beställarens projektdeltagare och förändringsledare kräver en ansvarig organisation.'),
  '11.2.1.12': delvis([T14.inforande, T14.uKoncept], 'Utbildningsplanen för grundimplementationen i docs/drift/inforande.md, och utbildningsmaterialet per roll i docs/utbildning/.', 'Planen är ett förslag och är inte överenskommen med någon beställare.'),
  '11.3.1.1': planerat('docs/drift/inforande.md'),
  // Applikationskonfiguration, test och support (12).
  '12.1.1.2': planerat(HANDBOK),
  '12.2.1.1': planerat('docs/drift/inforande.md och docs/testmetod.md'),
  '12.2.1.2': planerat('docs/drift/inforande.md'),
  '12.2.1.3': delvis([T14.inforande, 'Testmetod > testmetoden beskrivs efter ISO/IEC/IEEE 29119-3 med testplan, testdesign, testfall, testprocedurer och testrapporter, och allt den pekar på finns'], 'Testmetoden i docs/testmetod.md och testnivåerna fram till acceptanstest i docs/drift/inforande.md.', 'Metoden är Vårdkällans egen tillämpning av standardens struktur och är inte certifierad. Acceptanstest med en beställare ingår inte.'),
  '12.3.1.1': planerat('docs/drift/support.md'),
  '12.3.1.2': planerat('docs/drift/support.md'),
  '12.3.1.3': planerat('docs/drift/support.md'),
  '12.3.1.4': delvis([T14.support], 'Supportdokumentet i docs/drift/support.md beskriver upplägg, nivåer, kanaler, process, verktyg och servicenivåer för support.', `Support dygnet runt kräver en ansvarig organisation. I systemet finns synpunkter från varje vy och ärenden om saknad information i det öppna API:t. ${DRIFTANSVARIG}`),
  '12.3.1.5': delvis([T14.support], 'Supportdokumentet i docs/drift/support.md beskriver ärendehanteringen och förväntningarna på beställaren.', `Ett ärendehanteringssystem som beställaren har åtkomst till finns inte. ${DRIFTANSVARIG}`),
  // Utbildning (10.1).
  '10.1.1.1': delvis([T14.uRoller, T14.uKoncept, T14.uFiler], 'Utbildningskonceptet i docs/utbildning/README.md: e-utbildning med övningar och intyg i systemet, praktiska prov i övningsjournal, instruktionsfilmer, lärarledd utbildning, superanvändare och utvärdering. Materialet skrivs ur systemets egna register och hålls därför aktuellt med varje version.', 'Konceptet kräver en ansvarig organisation för den lärarledda utbildningen och utvärderingen.'),
  // Innovationsrummet (2.6).
  '2.6.1.1': delvis([T14.iDelar, T14.iBidra, T14.iSprak], 'Innovationsrummet beskrivs i docs/innovationsrum.md och CONTRIBUTING.md: dokumentationen av det öppna API:t och systemet, sandlådor där vem som helst kan pröva, registrering av externa tillämpningar, utbildningen, och hur förändringar föreslås, prövas och beslutas.', 'Utvecklarforumet finns som GitHub Discussions och privata säkerhetsrapporter är påslagna (SECURITY.md), men projektet förvaltas av en enskild person utan avtalade svarstider. Support och ett forum med moderatorer och avtalade tider behöver en ansvarig organisation. Ärenden och pull requests finns på GitHub och synpunkter från varje vy i demon.', 'Sandlådan och kravsidan visar själva vad som finns och hur det prövas, så att en utvecklare inte behöver fråga någon för att komma igång.'),
};

// Poster som behåller sin status men får nya tester och en ny anmärkning.
const TILLAGG = {
  '10.1.1.2': { tester: [T14.uRoller, T14.uOvningar, T14.uFloden, T14.uSprak, T14.uFiler],
    losning: 'Utbildningsmaterial på svenska per roll i docs/utbildning/, skrivet ur övningarna, de vanliga arbetsflödena, instruktionsfilmerna och testinbjudans uppdrag, så att materialet följer systemet. I systemet finns övningarna med intyg och hjälpen i sammanhanget.',
    anmarkning: 'Språkkontrollen prövar ord och tecken, inte språknivån. Att materialet motsvarar nivå C1 är inte bedömt av någon utomstående.' },
  '10.1.1.3': { tester: [T14.uKoncept, T14.filmFloden, T14.filmFiler],
    anmarkning: 'Instruktionsfilmerna och utbildningsmaterialet per roll finns sedan version 1.4. Lärarledd utbildning och utvärdering av utbildningen kräver en ansvarig organisation och finns inte.' },
};

export function medR14r5(avsnitt) {
  return avsnitt.map((x) => {
    if (R14R5[x.id]) return { ...x, ...R14R5[x.id] };
    if (TILLAGG[x.id]) { const t = TILLAGG[x.id]; return { ...x, ...t, tester: [...new Set([...(x.tester ?? []), ...t.tester])] }; }
    return x;
  });
}
