// Runda 14, r3: intyg, e-remiss och vaccinationer med tjänstekontrakt i RIVTA. Testnamnen (app/test/lakarintyg-r14.test.js,
// eremiss-r14.test.js, r14r3-api.test.js, rivta-vaccination-r14.test.js och klickbudgeten) och de poster i Sussa 2.2,
// 3.3.1 och 5.1.4 som byggdes i rundan. Mappningsfilerna ersätter sina poster med dessa, så att ändringen ligger samlad
// här. Ärlighetsregeln gäller: ett kontrakt som är byggt, validerat och testat lokalt är inte anslutet, så posterna är
// delvis uppfyllda.
import { flode } from './tidbok-tester.js';

const IN = 'Intyg genom intygsapplikationen > Intyg > ';
const ER = 'E-remiss till och från externa vårdgivare > E-remiss > ';
const API = 'Intyg och e-remiss i API:t > ';
const VA = 'Tjänstekontrakt i RIVTA, vaccinationer > Vaccination > ';
const ET = 'E-tjänster med tjänstekontrakt i RIVTA > ';
const INTE_ANSLUTET = 'inte anslutet till den nationella tjänsteplattformen (kräver avtal med Inera och SITHS-funktionscertifikat)';
const anm = (kontrakt) => `Byggt och validerat mot tjänstekontraktet ${kontrakt}, testat lokalt mot tjänsteplattformen; ${INTE_ANSLUTET}.`;

export const T14R3 = {
  intygSkapa: `${IN}läkaren skapar ett utkast med CreateDraftCertificate, och patient, läkare, vårdenhet och diagnos fylls i av systemet`,
  intygStatus: `${IN}signerat och skickat i intygsapplikationen syns i journalen utan att någon gör något`,
  intygAvstam: `${IN}en händelse som inte kom fram läggs in av avstämningen med ListCertificatesForCareWithQA`,
  intygTyper: `${IN}bara de intyg som får skrivas för patienten visas, och förslaget följer patienten`,
  intygSkyddad: `${IN}för en patient med skyddade personuppgifter skickas ingen adress till intygsapplikationen`,
  intygRoll: `${IN}sjuksköterskan ser intygen men skapar inga, och en annan vårdenhet ser dem bara efter ett aktivt val`,
  intygSparr: `${IN}ett intyg på en spärrad vårdenhet syns inte och röjs inte, utan samtycke`,
  intygProducent: `${IN}producenten avvisar en statusuppdatering för ett intyg som journalen inte har skapat, och ändrar ingenting`,
  intygUppdrag: `${IN}intygsapplikationen nekar den som inte har uppdrag på vårdenheten, och loggar försöket`,
  intygApi: `${API}Intyg > API: läkaren skriver ett intyg, signerar det i intygsapplikationen och journalen visar statusen`,
  erUt: `${ER}en remiss till en extern vårdgivare skickas med ProcessRequest, och mottagningsbekräftelsen gör den mottagen`,
  erSvar: `${ER}slutsvaret med ProcessRequestOutcome gör remissen besvarad, och remittenten kvitterar det som vanligt`,
  erIfylld: `${ER}remissen fylls i av systemet: patient, remittent, vårdenhet och diagnoser från den egna vårdenheten, aldrig från en annan`,
  erIn: `${ER}en remiss från en extern vårdgivare kommer in, ger vårdrelation först när den tas emot, och beskedet går tillbaka`,
  erDemo: `${ER}demon skickar en extern remiss bara för en patient som vårdenheten redan har vårdrelation till`,
  erProducent: `${ER}producenten avvisar en remiss till en okänd vårdenhet, från fel avsändare och för en patient som inte finns`,
  erBesked: `${ER}ett besked från fel avsändare eller för en okänd remiss ändrar ingenting`,
  erUtanPnr: `${ER}en patient utan personnummer eller samordningsnummer får ett besked på svenska och ingen remiss skickas`,
  erApi: `${API}E-remiss > API: läkaren skickar en e-remiss, mottagaren bekräftar och svarar, och en inkommande e-remiss väntar på mottagning`,
  vaccLas: `${VA}GetVaccinationHistory svarar med de vaccinationer som organisationens systemkonto får läsa i FHIR`,
  vaccSkydd: `${VA}GetVaccinationHistory lämnar aldrig ut skyddade personuppgifter eller spärrade vaccinationer, och en okänd organisation nekas`,
  formular: `${ET}Formulär > ett formulär skickas med CreateFormRequest, statusen hämtas med GetForm och en förfrågan avbryts med CancelForm`,
  portal: `${ET}1177 > ett meddelande går till inkorgen i 1177 bara när patienten har ett konto, med IsActiveUser och AddMessage`,
  nkrr: `${ET}NKRR > vårdenheten meddelar kvalitetsregistret med ProcessRegistrationNotification, men aldrig för skyddade personuppgifter`,
  dos: 'Dosdispensering med tjänstekontrakt i RIVTA > Dos > läkaren anmäler patienten till dosapoteket med SkapaVardtagare och journalen hämtar uppgifterna med HamtaVardtagareinformation',
  dosSkyddad: 'Dosdispensering med tjänstekontrakt i RIVTA > Dos > en patient med skyddade personuppgifter anmäls utan adress',
  nkrrInvandning: `${ET}NKRR > en patient som har motsatt sig registrering i kvalitetsregistret anmäls inte, och efter att invändningen är återkallad anmäls hen`,
};
const T = T14R3;

const POSTER = {
  '5.1.4.3': {
    tester: [T.dos, T.dosSkyddad],
    losning: 'Läkaren anmäler patienten som dospatient till dosapoteket med SkapaVardtagare, och journalen hämtar dosapotekets uppgifter med HamtaVardtagareinformation (riv.druglogistics.dosedispensing, gränssnittet mellan vårdsystem och dosapotek).',
    expert: 'Läkaren bekräftar bara patientens samtycke. Läkaren, arbetsplatskoden, patienten, adressen, den patientansvariga läkaren, dosapoteket och första dosdagen fyller systemet i.',
    anmarkning: `${anm('riv.druglogistics.dosedispensing 1.1.0 (SkapaVardtagare 1.0 och HamtaVardtagareinformation 1.0, RIVTA Basic Profile 2.0)')} Dosapoteket är simulerat. Ordinationen av dosdispenserade läkemedel görs i eHälsomyndighetens e-tjänst för dosförskrivning (i dag Pascal), som inte går att ansluta utan eHälsomyndighetens godkännande. Det finns inget gränssnitt för anmälan än.`,
  },
  '5.1.4.1': {
    bara: 'anmarkning',
    anmarkning: ' Runda 14: eHälsomyndighetens kontrakt för att skicka och makulera e-recept är inte publicerade bland tjänstedomänerna i RIVTA (riv.se.apotekensservice.or har bara hämtning av ordinationer, och dess filer saknar licensuppgift), så e-receptet är inte byggt mot ett tjänstekontrakt. Riktig anslutning kräver eHälsomyndighetens godkännande.',
  },
  '2.2.1.5': {
    tester: [T.formular],
    losning: 'Vårdenheten skickar ett formulär till patienten inför besöket med CreateFormRequest, hämtar status och svar med GetForm och avbryter en förfrågan som inte behövs med CancelForm.',
    expert: 'Mallen, vårdenheten, vårdgivaren, patientens identitet och giltighetstiden fyller systemet i. Den som skickar väljer bara formulär.',
    anmarkning: `${anm('riv.infrastructure.eservicesupply.forminteraction 2.1.1 (CreateFormRequest 2.0, GetForm 2.1, CancelForm 2.0)')} Formulärtjänsten är simulerad. Mallarna förvaltas inte från Vårdkällan (GetFormTemplate och SaveFormTemplate är inte byggda), och svaren förs inte in i journalen. Det finns inget gränssnitt för formulären än.`,
  },
  '2.2.1.6': {
    tester: [T.portal],
    losning: 'Ett meddelande från vårdenheten går till patientens inkorg i 1177 med AddMessage, efter att systemet med IsActiveUser har frågat om patienten har ett konto.',
    expert: 'Systemet skickar bara till 1177 när patienten kan läsa meddelandet och säger annars att det ska gå som brev. Vårdenheten och vårdgivaren fyller systemet i.',
    anmarkning: `${anm('riv-application.infrastructure.eservicesupply.patientportal 2.0 (IsActiveUser och AddMessage)')} 1177 är simulerat, och en patient har ett konto i demon när hen är invånare i Min journal. Kallelserna i tidboken går ännu inte genom kontraktet. Min journal är Vårdkällans egen e-tjänst.`,
  },
  '2.2.1.14': {
    tester: [T.nkrr, T.nkrrInvandning],
    losning: 'Vårdenheten meddelar ett kvalitetsregister med ProcessRegistrationNotification att uppgifterna för en registrering finns, och registret hämtar dem genom NKRR.',
    expert: 'Vårdgivaren, vårdenheten och patientens identitet fyller systemet i. Systemet prövar själv om patienten har motsatt sig registreringen, med samma prövning som alla utgående registreringar, och en patient som har motsatt sig det eller har skyddade personuppgifter meddelas aldrig.',
    anmarkning: `${anm('riv.followup.qualityregistry.nkrr 1.2.2 (ProcessRegistrationNotification 1.0)')} NKRR och registret är simulerade. Vårdkällan är inte producent för de kontrakt som NKRR läser journaluppgifterna med, utöver journalens producenter. Det finns inget gränssnitt för meddelandet än.`,
  },
  '2.2.1.9': {
    tester: [T.intygSkapa, T.intygStatus, T.intygAvstam, T.intygTyper, T.intygSkyddad, T.intygRoll, T.intygSparr, T.intygProducent, T.intygUppdrag, T.intygApi, flode('skriv-intyg')],
    losning: 'Fliken Intyg i journalen öppnar en integrerad intygsapplikation för patienten, som Webcert i integrerat läge: journalen skapar utkastet med CreateDraftCertificate, tar emot intygets händelser med CertificateStatusUpdateForCare adresserat till vårdenheten och stämmer av med ListCertificatesForCareWithQA. Meddelandena byggs, valideras och skickas med den gemensamma grunden för RIVTA.',
    expert: 'Läkaren väljer bara vilket intyg som ska skrivas. Systemet föreslår det som passar patienten, visar bara de intyg som får skrivas för patienten och fyller i patienten, läkaren, vårdenheten och diagnosen, och intygets status kommer till journalen av sig själv.',
    anmarkning: `${anm('riv.clinicalprocess.healthcond.certificate 4.0.5 (CreateDraftCertificate 3.3, CertificateStatusUpdateForCare 3.2, ListCertificatesForCareWithQA 3.3)')} Intygsapplikationen är simulerad och är inte Webcert, eftersom Webcert och Intygstjänsten inte går att bygga utan Ineras artefaktförråd. Inget intyg skickas till Försäkringskassan eller någon annan mottagare. Frågor och svar från mottagaren hanteras inte.`,
  },
  '2.2.1.11': {
    tester: [T.vaccLas, T.vaccSkydd],
    losning: 'Vårdkällan är producent av vaccinationer med GetVaccinationHistory 2.0 för anslutna konsumenter, med vaccin, dos, datum, batch, program och vårdenhet ur registreringen. Varje vaccination i ett nationellt program rapporteras dessutom till det simulerade vaccinationsregistret.',
    expert: 'Vaccinationerna lämnas ut av sig själva när en ansluten tjänst frågar, med samma prövning som FHIR-API:t: bara de vårdenheter och informationsmängder som organisationen är ansluten för, aldrig skyddade personuppgifter och aldrig spärrade uppgifter.',
    anmarkning: `${anm('GetVaccinationHistory 2.0 i riv.clinicalprocess.activityprescription.actoutcome 2.2.2')} Vaccinet anges med ATC-kod och namn, eftersom demons katalog saknar NPL-id. Rapporteringen till vaccinationsregistret är simulerad och går inte genom ett tjänstekontrakt.`,
  },
  '2.2.1.12': {
    tester: [T.erUt, T.erSvar, T.erIfylld, T.erIn, T.erProducent, T.erBesked, T.erApi, flode('skicka-eremiss')],
    losning: 'E-remiss till och från vårdgivare utanför Vårdkällan med ProcessRequest, ProcessRequestConfirmation och ProcessRequestOutcome. Remissen är en vanlig remiss med samma statuskedja och larm, och statusen följer mottagarens besked och svar. En inkommande e-remiss blir en remiss till vårdenheten.',
    expert: 'Läkaren väljer bara mottagare och skriver frågeställningen. Systemet fyller i patienten, remittenten, vårdenheten och diagnoserna från den egna vårdenheten, skickar beskedet och svaret på en inkommande remiss av sig själv och avvisar meddelanden från fel avsändare eller för fel patient utan att något ändras.',
    anmarkning: `${anm('riv.clinicalprocess.activity.request 2.3 (ProcessRequest, ProcessRequestConfirmation och ProcessRequestOutcome)')} Mottagarna är påhittade och simulerade. Remisstatus till 1177 och Journalen (riv.crm.requeststatus) och bilagor i e-remissen finns inte.`,
  },
  '3.3.1.2': {
    tester: [T.erUt, T.erSvar, T.erIn, T.erDemo, T.erUtanPnr, T.erApi, flode('skicka-eremiss')],
    losning: 'Vårdbegäran skickas till och tas emot från vårdgivare utanför Vårdkällan som e-remiss. En utgående e-remiss bekräftas och besvaras av mottagaren, och en inkommande e-remiss tas emot som en remiss till vårdenheten och ger vårdrelation först när någon på vårdenheten har tagit emot den.',
    expert: 'Systemet fyller i remissen, skickar mottagningsbekräftelsen, avvisningen och svaret till avsändaren av sig själv och förklarar på vanlig svenska när en remiss inte kan skickas, till exempel när patienten saknar personnummer.',
    anmarkning: `${anm('riv.clinicalprocess.activity.request 2.3')} De externa vårdgivarna är påhittade och simulerade. Pappersremisser från vårdgivare utan e-remiss registreras som förut.`,
  },
};

export const medR14r3 = (poster) => poster.map(x => {
  const a = POSTER[x.id];
  if (!a) return x;
  if (a.bara === 'anmarkning') return { ...x, anmarkning: `${x.anmarkning ?? ''}${a.anmarkning}` };
  return { ...x, avsedd: 'delvis', kategori: x.kategori, tester: [...(x.tester ?? []), ...a.tester], losning: a.losning, expert: a.expert, anmarkning: a.anmarkning };
});
