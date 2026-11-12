// Runda 9, r5: hotmodellen i säkerhetsarkitekturen (Sussa 5.3.1.18). Varje hot är yttre (från någon utan behörighet
// eller från en annan organisation) eller inre (från någon som har behörighet till systemet eller databasen). Varje hot
// pekar på kontrollen som möter det, på principen i Sussas kravtext som kontrollen följer och på de automatiska tester
// som visar att kontrollen fungerar. Testerna är mappade på posten, så att bygget stoppas om ett test saknas eller är rött.
// Beskrivningen av arkitekturen finns i docs/sakerhetsarkitektur.md.
import { T } from './sussa/runda9-r5-tester.js';

// Principerna i kravtextens mervärden.
export const PRINCIPER = {
  minimalism: 'Minimalism',
  minsta_privilegium: 'Minsta möjliga privilegium',
  redundans: 'Redundans',
  lager: 'Säkerhet i lager',
  sjalvforsvar: 'Självförsvar',
  kontrollerat_flode: 'Kontrollerat informationsflöde',
  balanserad: 'Balanserad säkerhet',
  hardning: 'Härdning',
};

const B = 'Behörighetsmotorn > ';
const A = 'API > ';
const L = 'Åtkomstloggen > ';
const MJ = 'Min journal > ';
const SL = 'Säkerhetsloggen > ';

export const HOT = [
  { id: 'Y1', slag: 'yttre', hot: 'Någon loggar in som en annan person med en förfalskad, ändrad, gammal eller stulen biljett.',
    kontroll: 'Inloggningen godtar bara en biljett från en betrodd autentiseringstjänst med rätt algoritm, nyckel, mottagare och giltighetstid, och varje biljett går att använda en gång. Misslyckade försök står i säkerhetsloggen.',
    principer: ['sjalvforsvar', 'lager'], tester: [T.falsk, T.engang, T.konf] },
  { id: 'Y2', slag: 'yttre', hot: 'En annan webbplats får webbläsaren att göra anrop i den inloggades namn, eller ett skript läser sessionskakan.',
    kontroll: 'Sessionskakan är HttpOnly och SameSite=Lax, skrivande anrop med fel Origin avvisas, och anrop från en annan webbplats avvisas i Min journal. Sessionsnyckeln byts vid varje inloggning.',
    principer: ['lager', 'hardning'], tester: [`${A}sessionskakan är HttpOnly och SameSite=Lax`, `${A}skrivande anrop med fel Origin avvisas`, `${MJ}ingen fritext från adressen hamnar i loggen, och anrop från andra webbplatser avvisas`] },
  { id: 'Y3', slag: 'yttre', hot: 'Överbelastning eller gissning av identiteter genom många eller stora anrop.',
    kontroll: 'Taket för kroppens storlek, taket för nya sandlådor per adress och timme och gränsen för nekade försök per invånare.',
    principer: ['redundans', 'hardning'], tester: [`${A}för stor kropp avvisas`, `${MJ}nekade försök begränsas och tränger inte undan vårdens åtkomster ur logglistan`] },
  { id: 'Y4', slag: 'yttre', hot: 'Ett meddelande från en annan organisation är förfalskat eller har ändrats på vägen.',
    kontroll: 'Meddelandet tas emot först när avsändarens signatur, certifikatkedja till en betrodd utfärdare, giltighet och spärrlista stämmer.',
    principer: ['kontrollerat_flode', 'sjalvforsvar'], tester: [T.labbsvar, T.kedja, T.utgang, T.part, T.aterkalla] },
  { id: 'Y5', slag: 'yttre', hot: 'En annan organisation förnekar att den har tagit emot ett meddelande, eller vad det innehöll.',
    kontroll: 'Vårdkällan signerar varje meddelande till andra organisationer, kräver en signerad kvittens och sparar beviset, som inte kan ändras eller raderas.',
    principer: ['kontrollerat_flode'], tester: [T.nll, T.andrat, T.bevisTrigger, T.leverans] },
  { id: 'Y6', slag: 'yttre', hot: 'En prenumeration används för att få servern att anropa interna adresser (SSRF).',
    kontroll: 'Meddelanden skickas bara till adresser som administratören har godkänt, utan omdirigeringar, interna adresser, fel port eller inloggningsuppgifter.',
    principer: ['hardning', 'kontrollerat_flode'], tester: ['Prenumerationer > skydd mot SSRF: interna adresser, omdirigeringar, fel port och inloggningsuppgifter stoppas'] },
  { id: 'Y7', slag: 'yttre', hot: 'En extern tillämpning får mer än den person som startade den.',
    kontroll: 'Åtkomstbiljettens omfång kan bara minska behörigheten, aldrig öka den, och prövas i varje anrop utöver behörighetsmotorn.',
    principer: ['minsta_privilegium'], tester: ['SMART on FHIR > omfånget begränsar åtkomsten utöver behörighetsmotorn: annan patient, annan resurstyp och skrivning nekas'] },
  { id: 'I1', slag: 'inre', hot: 'Personal läser journaler utan att delta i patientens vård.',
    kontroll: 'Behörighetsmotorn kräver vårdrelation i varje anrop, nödåtkomst flaggas, varje åtkomst loggas och stickprov dras slumpvis.',
    principer: ['minsta_privilegium', 'lager'], tester: [`${B}nekad: utan grund nekas åtkomst utan erbjudande om val`, `${A}nödåtkomst via API flaggas i logguppföljningen`, T.sbStickprov] },
  { id: 'I2', slag: 'inre', hot: 'Personal läser uppgifter från en annan vårdenhet eller spärrade uppgifter.',
    kontroll: 'Inre sekretess med aktivt val, spärr som bara patientens samtycke häver och som nödåtkomst aldrig häver.',
    principer: ['minsta_privilegium', 'balanserad'], tester: [`${B}inre sekretess: andra enheters uppgifter kräver aktivt val`, `${B}spärr: aktivt val häver inte spärren`] },
  { id: 'I3', slag: 'inre', hot: 'Någon med åtkomst till databasen ändrar eller raderar journalen eller loggen i efterhand.',
    kontroll: 'Databastriggrar stoppar ändring och radering av signerad journal, logg och bevis, och loggarna kedjas med SHA-256 så att en ändring upptäcks.',
    principer: ['sjalvforsvar', 'lager'], tester: [`${L}UPDATE på loggen avbryts av trigger`, `${L}DELETE på loggen avbryts av trigger`, `${L}varje rad kedjas med sha256 av föregående hash och raden`,
      'Journal > signerad anteckning kan inte ändras i databasen (trigger)', `${SL}säkerhetsloggen kan inte ändras eller raderas, och kedjan verifieras`] },
  { id: 'I4', slag: 'inre', hot: 'En person behåller behörigheten efter att anställningen eller uppdraget har upphört.',
    kontroll: 'Behörigheten räknas ur masterdata i varje anrop. En person som blir inaktiv eller byter vårdenhet loggas ut av systemet och kan inte logga in med det gamla uppdraget.',
    principer: ['minsta_privilegium', 'minimalism'], tester: [T.inaktiv, T.andrad, T.uppdrag] },
  { id: 'I5', slag: 'inre', hot: 'Uppgifter med mycket högt skyddsbehov röjs, till exempel skyddad identitet eller tvångsvård.',
    kontroll: 'Skyddad identitet maskeras överallt, och åtkomsten till uppgifter med mycket högt skyddsbehov kan tas fram för sig och tas alltid med i stickprovet.',
    principer: ['balanserad', 'lager'], tester: [`${B}skyddad identitet: namn och personnummer maskeras`, T.klassning, T.sbLogg] },
  { id: 'I6', slag: 'inre', hot: 'Patientuppgifter hamnar i en test- eller utbildningsmiljö.',
    kontroll: 'Acceptanstestmiljön avidentifieras av systemet, och utbildnings- och testmiljön har bara fiktiva patienter.',
    principer: ['kontrollerat_flode', 'minimalism'], tester: [T.acceptans, T.fiktiva] },
  { id: 'I7', slag: 'inre', hot: 'Data går förlorad eller blir inkonsistent efter ett fel.',
    kontroll: 'Säkerhetskopian är en konsistent ögonblicksbild, och provåterläsningen kontrollerar tabeller, triggrar, integritet och loggarnas kedjor.',
    principer: ['redundans'], tester: ['Systemförvaltning > lagring: provåterläsningen i sandlådan kontrollerar tabeller, triggrar, integritet och loggarnas hashkedjor och sparas utan patientuppgifter'] },
  { id: 'I8', slag: 'inre', hot: 'Säkerhetshändelser passerar obemärkt.',
    kontroll: 'Inloggning, misslyckad inloggning, avvisade anrop, utloggning och ändrade behörigheter blir händelser i en egen säkerhetslogg med hashkedja.',
    principer: ['lager'], tester: [`${SL}inloggning, misslyckad inloggning, avvisade anrop och utloggning blir säkerhetshändelser`, `${SL}ändrade behörigheter och inställningar blir säkerhetshändelser`] },
];

// Runda 14, r1 (Sussa 5.2.1.1): inloggningen genom beställarens inloggningstjänst.
{
  const R = 'Inloggningstjänst (5.2.1.1) > ';
  HOT.push(
    { id: 'Y8', slag: 'yttre', hot: 'Någon loggar in genom en extern inloggningstjänst med en förfalskad biljett, ett stulet svar eller en biljett med fel attribut.',
      kontroll: 'Svaret ska höra till inloggningen i samma webbläsare (state och nonce) och koden byts med PKCE. Biljetten prövas mot de pinnade nycklarna med en asymmetrisk algoritm, utfärdare, mottagare och tid, och attributen prövas mot masterdata. Allt som inte stämmer stänger.',
      principer: ['sjalvforsvar', 'lager'], tester: [`${R}en biljett med fel signatur, alg none, HS256 med den publika nyckeln, fel utfärdare, fel mottagare, fel nonce eller som har gått ut avvisas`,
        `${R}state hör till sessionen och används en gång, och koden kan inte användas igen`, `${R}attribut som saknas eller motsäger masterdata ger ingen åtkomst, med orsaken på vanlig svenska`] },
    { id: 'I9', slag: 'inre', hot: 'En ensam systemförvaltare kopplar in en falsk inloggningstjänst, byter dess nyckel eller får servern att anropa en intern adress.',
      kontroll: 'Varje ändring av en inloggningstjänst gäller först när en andra systemförvaltare har godkänt den, nycklarna pinnas med tumavtryck, inga hemligheter sparas i databasen och servern anropar bara adresser som driften har godkänt.',
      principer: ['minsta_privilegium', 'kontrollerat_flode'], tester: [`${R}en extern inloggningstjänst kopplas in med fyra ögon, och nycklarna pinnas med tumavtryck`,
        `${R}ett byte av nyckel kräver fyra ögon, och systemet föreslår bytet när tjänsten har bytt nyckel`, `${R}servern anropar bara inloggningstjänster som driften har godkänt`, `${R}konfigurationen sparar inga hemligheter, bara namnet på miljövariabeln`] },
  );
}

export const HOTMODELL_TESTER = [...new Set(HOT.flatMap(h => h.tester))];
