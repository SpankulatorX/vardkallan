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
};
const T = T14R3;

const POSTER = {
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
  return { ...x, avsedd: 'delvis', kategori: x.kategori, tester: [...(x.tester ?? []), ...a.tester], losning: a.losning, expert: a.expert, anmarkning: a.anmarkning };
});
