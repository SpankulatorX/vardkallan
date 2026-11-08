// Runda 10, r5: testnamnen för servertesterna i app/test/runda10-r5.test.js, som mappningen pekar på. Filen importerar
// ingenting, så att både testerna och mappningen kan använda den.
const KS = 'Kunskapsstöd > ';
const KG = 'Kunskapsgenererande stöd > ';
const KK = 'Kollegakontroll av högriskläkemedel > ';
const LO = 'Läkemedelsöverföring > ';
const VP = 'Vaccinationsprogram > ';
const SJ = 'Sammanhållen journalföring > ';
const AK = 'Akutmottagningen > ';

export const T = {
  // Kunskapsstöd (3.2.1.1, 3.2.1.2 och 3.5.1.5).
  vardforlopp: `${KS}vårdplanen visar vårdförloppets steg med riktlinjens text och källa, och systemet räknar fram nästa steg ur de utförda åtgärderna`,
  forslagKunskap: `${KS}förslaget på standardplan har vårdförloppet och källan innan planen sätts upp`,
  varningKunskap: `${KS}varje varning vid ordination, administrering och utsättning förklarar varför och vad användaren kan göra, med källa`,
  lmInfo: `${KS}läkemedelsinformationen visar egenskaper, dosering vid patientens eGFR och om läkemedlet är olämpligt för äldre, med källa och demomärkning`,
  lmInfoBehorighet: `${KS}läkemedelsinformationen räknar inte med ett eGFR från en spärrad vårdenhet och kräver behörighet att läsa läkemedel`,
  news2: `${KS}NEWS2 visas med vad poängen betyder och källan`,
  // Kunskapsgenererande stöd (3.2.1.3).
  utfallPlan: `${KG}utfallet för en standardplan räknas ur vårdenhetens avslutade planer och visas när planen föreslås`,
  utfallSkydd: `${KG}små tal visas aldrig, inte heller som skillnaden mellan två tal, och andra vårdenheters planer räknas inte`,
  utfallVarning: `${KG}vid varningen visar systemet hur ofta den har kvitterats på vårdenheten`,
  utfallSubstans: `${KG}läkemedelsinformationen visar hur ofta substansen sätts ut inom 30 dagar på vårdenheten`,
  // Kollegakontroll (3.5.1.1 och 3.5.1.5).
  kkGrupper: `${KK}systemet avgör själv vilka doser en kollega kontrollerar: koncentrerade elektrolyter och Addex, opioider, insulin- och heparininfusion och cytostatika`,
  kkFlode: `${KK}en opioid iordningsställs, kontrolleras av en kollega i sin egen inloggning och ges, och en dos som inte är kontrollerad stoppas med en förklaring`,
  kkSjalv: `${KK}den som iordningsställde kan inte kontrollera själv, och en undersköterska eller en annan vårdenhet kan inte kontrollera`,
  kkBeredning: `${KK}en infusion med Addex-tillsats bereds och kontrolleras av en kollega innan den ges`,
  kkParameter: `${KK}systemförvaltaren styr grupperna som parametrar med fyra ögon, och en avstängd grupp kontrolleras inte`,
  kkSparad: `${KK}den sparade kontrollen avgör: ett annat läkemedel eller en annan ordination i anropet, eller en avstängd parameter, öppnar inte en okontrollerad dos`,
  kkInkorg: `${KK}inkorgen visar antalet doser som väntar på kontroll utan patientuppgifter, och aldrig den egna dosen`,
  // Läkemedelsöverföring (3.5.1.1).
  loForslag: `${LO}systemet väljer mottagarna själv: vårdcentralen där patienten är listad och kommunen när en samordnad planering pågår`,
  loSkicka: `${LO}läkemedelsberättelsen, läkemedelslistan och epikrisen skickas med ett klick, och mottagaren ser och kvitterar dem`,
  loSparr: `${LO}spärrade ordinationer skickas aldrig, och en spärr på den egna vårdenheten kräver patientens samtycke innan något skickas`,
  loBehorighet: `${LO}bara en läkare med vårdrelation skickar, och bara mottagaren och avsändaren ser överföringen`,
  loKommun: `${LO}kommunen ser bara läkemedelslistan och berättelsen som har skickats till den`,
  // Vaccinationsprogram (3.5.1.7).
  vpProgram: `${VP}programmet för barn fortsätter med elevhälsans doser och vattkoppor, och vuxna föreslås influensa och pneumokocker efter ålder och riskgrupp`,
  vpRiskgrupp: `${VP}riskgruppen räknas bara ur diagnoser som användaren får se`,
  vpRegistrera: `${VP}en dos ges med prövning mot programmet, och en dos som har getts någon annanstans registreras med källan`,
  vpRegister: `${VP}varje dos som ges rapporteras till det simulerade vaccinationsregistret med kvittens`,
  vpBehorighet: `${VP}vaccinationerna kräver vårdrelation, och nödåtkomst ger bara läsning`,
  vpBhvEgen: `${VP}barnhälsovården registrerar bara vaccin i sitt eget program och hänvisar andra vacciner till vaccinationsprogrammens flöde, som prövar dem`,
  vpParameter: `${VP}åldern för vattkoppor, åldersgränsen och riskgrupperna är parametrar som systemförvaltaren sätter med fyra ögon, och programmet följer dem`,
  vpFhir: `${VP}FHIR: vaccinationerna i programmen är Immunization med samma behörighet`,
  // Sammanhållen journalföring (3.2.2.3).
  sjSamtycke: `${SJ}uppgifter från en annan vårdgivare hämtas först efter vårdrelation, samtycke och ett aktivt val`,
  sjKronologi: `${SJ}de hämtade uppgifterna visas i samma kronologi med vårdgivare, vårdenhet, yrkesroll och tid utskrivna, och kan sorteras och väljas`,
  sjSparr: `${SJ}uppgifter som är spärrade hos den andra vårdgivaren hämtas aldrig och röjs inte`,
  sjNod: `${SJ}nödåtkomst utan samtycke hämtar uppgifterna och loggas som nödåtkomst, men aldrig spärrade`,
  sjBunden: `${SJ}valet gäller bara den person och vårdenhet som gjorde det och följer aldrig med till nästa inloggning eller uppdrag`,
  sjLogg: `${SJ}varje hämtning loggas på patienten med vårdgivaren, och samtycket kan återkallas`,
  // Akutmottagningen (3.2.3.5).
  akAnkomst: `${AK}ankomsten registreras med ett klick: könummer, akutbesök och tid sätts av systemet`,
  akTriage: `${AK}triagen räknar prioriteten ur vitalparametrarna och kontaktorsaken och förklarar varför`,
  akTavla: `${AK}flödestavlan visar patientens steg, planerade och utförda aktiviteter och ledtider, sorterade på prioritet och väntetid`,
  akAktivitet: `${AK}en aktivitet planeras och registreras som utförd med vem och när`,
  akUt: `${AK}utregistreringen avslutar besöket, och överföringen till slutenvård skriver in patienten`,
  akSkyddad: `${AK}flödestavlan visar aldrig namn för en skyddad patient och bara könummer utanför akutmottagningen`,
  akLedtider: `${AK}ledtiderna följs upp per prioritet utan patientuppgifter`,
  akDirekt: `${AK}den direkta ankomsten tar bara patient och kontaktorsak från anropet, och ankomstsätt, prioritet, triage och prehospitala uppgifter ignoreras`,
  akRelation: `${AK}vårdrelationen uppstår bara när en annan person bekräftar den, också efter en förvarning, och bekräftelsen loggas`,
  akPrehospital: `${AK}en förvarning från ambulansen tas emot och blir en ankomst med prehospitala uppgifter`,
};
