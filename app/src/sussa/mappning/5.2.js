// Sussa 5.2 Identitet och åtkomst (IAM): hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
import { TEST } from '../../krav.js';
// Runda 8, r5: tilläggen för tobaksvanor, epikrisen, mätvärdena, övningarna och parametrarna (sussa/runda8-r5.js).
import { medR8r5 } from '../runda8-r5.js';
// Runda 9, r5: inloggning med biljett, skyddsbehov, signering, certifikat, e-arkiv, gallring och miljöer (sussa/runda9-r5.js).
import { medR9r5 } from '../runda9-r5.js';

const { B, A, L, F, LK, MJ, GA, GK } = TEST;

const POSTERNA = [
  // Runda 14, r1: inloggning genom beställarens inloggningstjänst (inloggningstjanster.js och
  // test/inloggningstjanster-r14.test.js).
  {
    id: '5.2.1.1', kategori: 'nationell', egna: ['L5', 'L9'], avsedd: 'uppfyllt_demo',
    tester: [
      'en extern inloggningstjänst kopplas in med fyra ögon, och nycklarna pinnas med tumavtryck',
      'servern anropar bara inloggningstjänster som driften har godkänt',
      'nycklar med privata delar, symmetriska nycklar och för korta RSA-nycklar godtas inte',
      'inloggning med authorization code och PKCE ger åtkomst ur biljettens attribut, och personen väljer inget',
      'klienten kan autentisera sig med ett signerat intyg (private_key_jwt), och tjänsten kan signera med RSA',
      'en biljett med fel signatur, alg none, HS256 med den publika nyckeln, fel utfärdare, fel mottagare, fel nonce eller som har gått ut avvisas',
      'state hör till sessionen och används en gång, och koden kan inte användas igen',
      'attribut som saknas eller motsäger masterdata ger ingen åtkomst, med orsaken på vanlig svenska',
      'ett byte av nyckel kräver fyra ögon, och systemet föreslår bytet när tjänsten har bytt nyckel',
      'en avstängd tjänst går inte att logga in med, och den som är inloggad genom den loggas ut',
      'konfigurationen sparar inga hemligheter, bara namnet på miljövariabeln',
      'en beslutad ändring av en inloggningstjänst ändras eller raderas inte, och bara systemförvaltningen kopplar in tjänster',
      'övningstjänsten i demon: hela inloggningen, och en biljett med fel vårdenhet ger ingen åtkomst',
      'övningstjänsten ger koden en gång och kräver rätt PKCE och klientens intyg',
    ].map(t => `Inloggningstjänst (5.2.1.1) > ${t}`),
    losning: 'Vårdgivaren kopplar in sin egen inloggningstjänst (OpenID Connect Provider, till exempel Ineras IdP för medarbetare, som talar OpenID Connect enligt HEART-profilen) i systemförvaltningen. Varje ändring, också ett byte av nyckel och en avstängning, gäller först när en andra systemförvaltare har godkänt den. Tjänstens publika nycklar pinnas med tumavtryck när den läggs in, och inga hemligheter sparas i databasen: Vårdkällan autentiserar sig med ett signerat intyg (private_key_jwt) med en nyckel utanför databasen, eller med en hemlighet i serverns miljö. Inloggningen går med authorization code och PKCE, och biljetten prövas: state och nonce, signatur med en inlagd nyckel och en asymmetrisk algoritm, utfärdare, mottagare, giltighetstid, tillitsnivå och att den används en gång. Attributen tolkas enligt Ineras attributspecifikation för IdP 3.3 (HSA-id, medarbetaruppdrag med ändamål och vårdenhet, vårdgivare och legitimerad yrkesgrupp) och prövas mot masterdata vid inloggningen och i varje anrop.',
    expert: 'Systemförvaltaren skriver bara in tjänstens adress och klient-id. Systemet hämtar tjänstens uppgifter och nycklar från adresser som driften har godkänt, kontrollerar att tjänsten stödjer det som krävs, visar tumavtrycken och föreslår själv ett byte när tjänsten har bytt nyckel. Personalen väljer aldrig uppdrag eller behörighet, och när ett attribut saknas eller inte stämmer med katalogen stänger systemet och säger på vanlig svenska vad som är fel och vem som kan rätta det.',
    anmarkning: 'Ingen verklig regions inloggningstjänst är inkopplad. Testerna använder en lokal testutfärdare och demon en simulerad övningstjänst i samma server, och inloggningen är prövad lokalt mot Keycloak (test/keycloak-oidc.sh). SAML 2.0 är inte byggt: signaturkontrollen av XML kräver kanonisering och en härdad XML-tolk, som Vårdkällan inte har utan ett granskat beroende, och Ineras IdP för medarbetare talar också OpenID Connect. Utloggning hos tjänsten (RP-initiated logout) finns inte.',
  },
  {
    id: '5.2.1.2', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${L}varje rad kedjas med sha256 av föregående hash och raden`,
      `${L}UPDATE på loggen avbryts av trigger`,
      `${L}DELETE på loggen avbryts av trigger`,
      `${A}sökningen loggas`,
      `${F}FHIR-anrop loggas`,
      `${A}logggranskaren ser logg med hel kedja, andra roller nekas`,
      `${A}nödåtkomst via API flaggas i logguppföljningen`,
    ],
    losning: 'Varje åtkomst och aktivitet loggas med grund i en åtkomstlogg som inte går att ändra, med hashkedja och databastriggrar, och följs upp med flaggor.',
    expert: 'Systemet loggar varje åtkomst och dess grund självt, så ingen behöver dokumentera varför journalen öppnades.',
    anmarkning: 'Stickprovskontroller och lagring i minst fem år finns inte.',
  },
  {
    id: '5.2.1.3', kategori: 'system', egna: ['L4'], avsedd: 'uppfyllt_demo',
    tester: [
      `${F}AuditEvent bara för logggranskare`,
      // Runda 6, r1: export till fil (logguppfoljning.js).
      'Export av loggen > åtkomstloggen exporteras som NDJSON i kedjans ordning med hash, och exporten loggas',
      'Export av loggen > CSV har rubriker, semikolon och skydd mot formler, och säkerhetsloggen kan också exporteras',
      'Export av loggen > bara logggranskaren exporterar, och ett nekat försök loggas',
    ],
    losning: 'Logggranskaren exporterar åtkomstloggen och säkerhetsloggen till fil som NDJSON eller CSV, med samma urval som i logguppföljningen, och kan läsa loggen som FHIR AuditEvent per patient. Exporten loggas i både åtkomstloggen och säkerhetsloggen.',
    expert: 'Raderna kommer i kedjans ordning med hash och föregående hash, så att kedjan kan kontrolleras utanför systemet, och skyddad identitet är maskerad också i filen. CSV skyddas mot formler i kalkylprogram, så granskaren behöver inte tänka på det.',
    anmarkning: 'Export till ett e-arkiv för loggar (lagring i minst fem år) finns inte, eftersom demons sandlådor lever i åtta timmar.',
  },
  {
    id: '5.2.1.4', kategori: 'system', egna: ['D4', 'L5'], avsedd: 'uppfyllt_demo',
    tester: [
      `${MJ}utloggning och byte av roll i samma webbläsare nollställer sessionen`,
      `${LK}nyckeln lämnas vid inloggning, byts vid ny inloggning och glöms vid utloggning`,
      `${GA}läskopian rensas vid utloggning`,
      `${GA}utloggning under avbrott loggar ut sessionen på servern, även om fliken stängs`,
      `${GA}utloggning i en flik avslutar läsläget i webbläsarens andra flikar`,
    ],
    losning: 'Utloggning avslutar sessionen på servern och rensar läskopian och reservkopian, också under avbrott och i andra flikar.',
    expert: 'Systemet rensar allt som hör till inloggningen självt vid utloggning, så användaren behöver inte stänga flikar eller tömma något.',
    anmarkning: 'Automatisk utloggning efter inaktivitet är inte testad.',
  },
  { id: '5.2.1.5', kategori: 'leverantor', egna: ['D12'], tester: [], avsedd: 'planerat',
    anmarkning: 'Gäller leverantörens drift- och supportpersonal. Det finns ingen drift med supportpersonal för demon.' },
  {
    id: '5.2.1.6', kategori: 'system', egna: ['D8', 'L2'], avsedd: 'delvis',
    tester: [
      `${B}yrkesroll: läkare får ordinera, sjuksköterska och undersköterska får inte`,
      `${A}nekad åtkomst ger 403 kraver_val och loggas som nekad`,
      `${MJ}patientsessionen når inga av personalens API:er`,
      `${MJ}personalens session når inte Min journal`,
      'SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas',
      'SMART on FHIR > biljetten ger aldrig mer än personen utan aktiva val: andra vårdenheter och spärr följer inte med',
      'SMART on FHIR > biljetten återkallas vid utloggning, när tillämpningen stängs och när den går ut, och allt loggas',
    ],
    losning: 'Behörigheten avgörs på servern för varje anrop utifrån yrkesroll och enhet. API:erna för externa tillämpningar använder OAuth 2.0 med åtkomstbiljetter (Bearer) från Vårdkällans auktoriseringstjänst, där omfånget i biljetten begränsar åtkomsten utöver behörighetsmotorn.',
    expert: 'Systemet räknar ut behörigheten ur roll, enhet och vårdrelation, och biljettens omfång kan bara minska den, aldrig öka den. Användaren behöver aldrig välja behörighet.',
    anmarkning: 'Inloggningen i gränssnittet är simulerad. Ingen extern IDP, SAML eller OpenID Connect med id-token finns, och attributen i biljetten kommer från Vårdkällans egen inloggning.',
  },
  {
    id: '5.2.1.7', kategori: 'system', egna: ['L3'], avsedd: 'uppfyllt_demo',
    tester: [
      `${B}inre sekretess: andra enheters uppgifter kräver aktivt val`,
      `${B}inre sekretess: aktivt val visar andra enheters uppgifter med grund aktivt_val`,
      `${B}spärr: spärrmarkering syns men innehållet döljs`,
      `${B}spärr: aktivt val häver inte spärren`,
      `${B}spärr: samtycke i stunden visar spärrade uppgifter`,
      `${B}nödåtkomst: utan vårdrelation krävs val och läkare får nödåtkomst`,
      `${A}aktivt val för andra enheter via API`,
      `${A}spärrmarkering och samtycke via API`,
      `${GK}Nödåtkomst inom budget`,
    ],
    losning: 'Inre sekretess med aktivt val, spärr med spärrmarkering och samtycke i stunden, och nödåtkomst, i ett flöde där uppgifterna visas stegvis.',
    expert: 'Systemet visar först det användaren har rätt till och frågar efter aktivt val eller samtycke bara när det behövs, med förslag på grund och en förklaring på vanlig svenska.',
    anmarkning: 'Spärr och samtycke finns i Vårdkällans egen behörighetsmotor och inte via de nationella tjänsterna i kapitel 2.',
  },
  {
    id: '5.2.1.8', kategori: 'system', egna: ['L2'], avsedd: 'delvis',
    tester: [
      `${B}vårdrelation: inskriven patient ger åtkomst på egen enhet`,
      `${B}vårdrelation: listning och remiss till enheten ger vårdrelation`,
      `${B}vårdrelation: kontakt avslutad för mer än 90 dagar sedan ger ingen vårdrelation`,
      `${B}vårdrelation: avvisad remiss ger ingen vårdrelation`,
    ],
    losning: 'Åtkomst räknas fram ur yrkesroll, enhet och vårdrelation. Ingen behörighet läggs upp per patient.',
    expert: 'Vårdrelationen räknas ut ur inskrivning, listning och remiss, så ingen administratör behöver lägga upp eller ta bort åtkomst för hand.',
    anmarkning: 'Personal och roller ligger i seeden och hämtas inte från masterdata som HSA.',
  },
];
// Runda 14, r5: leverantörens åtaganden, servicenivåerna, utbildningsmaterialet och innovationsrummet (sussa/runda14-r5.js).
import { medR14r5 } from '../runda14-r5.js';

const R14_FORE = medR9r5(medR8r5(POSTERNA));
export default medR14r5(R14_FORE);
