# Kryptering och signering

Vilka algoritmer och nyckellängder Vårdkällan använder vid signering, inloggning och lagring, och vad driften ska ha för kryptering av trafik, lagring och säkerhetskopior och för nyckelhantering.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.4 | Kryptering av datatrafik | Skallkrav vid leverans |

## Syfte och ansvar

Trafiken till och från systemet ska krypteras med publikt erkända algoritmer och nyckellängder som i dag inte kan knäckas med uttömmande sökning, och säkerhetskänsliga uppgifter som loggar och autentiseringsuppgifter ska krypteras vid lagring (5.3.1.4). Systemet krypterar och signerar på flera ställen i sin egen kod. Kryptering av trafiken (TLS) och av lagringen görs av driften.

## Det systemet redan har som stöd

### Signering och integritet

| Användning | Algoritm och nyckel | Var det finns |
| --- | --- | --- |
| Certifikat för instanser och delsystem | X.509 med ECDSA P-256 och SHA-256, kedja från rot via mellanliggande utfärdare, spärrlista | [`app/src/pki.js`](../../app/src/pki.js) |
| Meddelanden till andra organisationer och kvittenser | ECDSA P-256 och SHA-256 över ett huvud med SHA-256 av innehållet | [`app/src/signering.js`](../../app/src/signering.js) |
| Id-biljett vid inloggning | JWT signerad med ES256 (ECDSA P-256 och SHA-256), giltig i 300 sekunder och bara en gång | [`app/src/idp.js`](../../app/src/idp.js) |
| Signerade anteckningar | Ed25519 med en nyckel som härleds med HMAC-SHA256 ur en serverhemlighet som inte ligger i databasen (simulerat SITHS-kort) | [`app/src/anteckningssignatur.js`](../../app/src/anteckningssignatur.js) |
| Åtkomstloggen och säkerhetsloggen | Hashkedja med SHA-256 | [`app/src/logg.js`](../../app/src/logg.js), [`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js) |
| Säkerhetskopior och e-arkivpaket | Kontrollsumma med SHA-256 | [`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js), [`app/src/arkiv.js`](../../app/src/arkiv.js) |

I demon är rotutfärdaren en test-utfärdare som skapas när servern startar. I drift används certifikat från en utfärdare som är publikt erkänd, och listan över betrodda utfärdare innehåller den.

### Kryptering vid lagring

| Uppgift | Skydd | Var det finns |
| --- | --- | --- |
| Hemlig nyckel för engångskoder (TOTP) | AES-256-GCM med användaren som tilläggsdata. Nyckeln kommer från `FLERFAKTOR_NYCKEL` (64 hextecken) eller en fil med rättigheten 0600, aldrig från databasen | [`app/src/flerfaktor.js`](../../app/src/flerfaktor.js) |
| Passkeys | Bara den publika nyckeln sparas. Servern godtar ES256 och RS256 | [`app/src/flerfaktor.js`](../../app/src/flerfaktor.js) |
| Läskopian för avbrott i webbläsaren | AES-GCM med 256 bitars nyckel genom webbläsarens kryptering (Web Crypto). Nyckeln skapas av servern vid inloggningen, gäller i 8 timmar och kan inte exporteras ur webbläsaren | [`app/public/js/lasekopia.js`](../../app/public/js/lasekopia.js) |
| Reservkopian av läskopian | Nyckeln slås in med AES-GCM och en nyckel som härleds ur reservkoden med PBKDF2 (SHA-256, 600 000 iterationer, slumpat salt på 16 byte) | [`app/public/js/reservkopia.js`](../../app/public/js/reservkopia.js) |
| Nycklar för utrustning och kalenderprenumerationer | Sparas bara som HMAC-SHA256 | [`app/src/medicinteknik.js`](../../app/src/medicinteknik.js), [`app/src/kontorsstod.js`](../../app/src/kontorsstod.js) |
| Sessionen | Slumpat id på 24 byte, kakan är HttpOnly, SameSite=Lax och Secure när den publika adressen är HTTPS | [`app/src/server.js`](../../app/src/server.js) |

### Det systemet inte gör

- Systemet terminerar inte TLS själv. Det lyssnar på HTTP i containern och förutsätter att driften har en TLS-terminering framför.
- Systemet sätter inte rubriken för strikt HTTPS (HSTS). Den ska sättas där TLS termineras.
- Databasen, de vilande sandlådorna och säkerhetskopiorna krypteras inte av systemet. De skyddas mot ändring med triggrar och kontrollsummor men inte mot läsning.
- Systemets nycklar (för engångskoder, kopiornas namn och signeringen) skapas eller läses från filer och miljövariabler. Det finns ingen koppling till en hårdvarumodul för nycklar.

## Att fylla i för den som driver systemet

### Trafiken

| Krav | Beskrivning |
| --- | --- |
| TLS-versioner | TLS 1.2 och TLS 1.3, inga äldre. [fyll i: var TLS termineras] |
| Chiffersviter | Bara publikt erkända chiffer med framåtsekretess, till exempel AES-GCM och ChaCha20-Poly1305 med ECDHE. [fyll i: konfigurationen] |
| Certifikat för den publika adressen | [fyll i: utfärdare, nyckeltyp och längd, giltighet och hur certifikatet förnyas] |
| HSTS | [fyll i: rubriken och dess maximala ålder] |
| Trafiken mellan TLS-termineringen och containern | [fyll i: samma server, eget nät eller krypterad] |
| Trafiken till nationella tjänster och andra organisationer | [fyll i: till exempel ömsesidig TLS med SITHS-certifikat] |

### Lagringen

- [ ] Volymerna för databas, vilande sandlådor och säkerhetskopior är krypterade med AES med 256 bitars nyckel eller motsvarande: [fyll i: metod]
- [ ] Säkerhetskopior som lämnar servern krypteras före överföringen: [fyll i]
- [ ] Serverns och nätets loggar krypteras vid lagring: [fyll i]
- [ ] Utrustning med lagring raderas eller förstörs säkert när den tas ur bruk: [fyll i]

### Nyckelhantering

| Nyckel | Var den förvaras | Vem som har tillgång | Byte |
| --- | --- | --- | --- |
| `FLERFAKTOR_NYCKEL` | [fyll i] | [fyll i] | [fyll i: hur ofta och hur befintliga koder krypteras om] |
| Nyckeln för kopiornas namn | [fyll i] | [fyll i] | [fyll i] |
| Serverhemligheten för signering | [fyll i] | [fyll i] | [fyll i] |
| Instansens certifikat och nyckel | [fyll i] | [fyll i] | [fyll i] |
| TLS-certifikatets nyckel | [fyll i] | [fyll i] | [fyll i] |
| Nycklar för krypterade volymer | [fyll i] | [fyll i] | [fyll i] |

- [ ] Nycklar förvaras skilda från de data de skyddar, gärna i en hårdvarumodul för nycklar: [fyll i]
- [ ] Rutin om en nyckel kan ha röjts: [fyll i]
- [ ] Genomgång av algoritmer och nyckellängder mot gällande rekommendationer minst en gång om året: [fyll i: vem]

## Förkortningar

- AES: standard för symmetrisk kryptering (Advanced Encryption Standard)
- ECDHE: nyckelutbyte med elliptiska kurvor och tillfälliga nycklar, som ger framåtsekretess
- ECDSA: digital signatur med elliptiska kurvor (Elliptic Curve Digital Signature Algorithm)
- HMAC: kontrollsumma med en hemlig nyckel (hash-based message authentication code)
- HSTS: rubrik som säger åt webbläsaren att bara använda HTTPS mot webbplatsen (HTTP Strict Transport Security)
- HTTP: protokollet för webben (Hypertext Transfer Protocol)
- HTTPS: HTTP krypterat med TLS
- JWT: en signerad biljett i JSON-format med standarden JWT (JSON Web Token)
- PBKDF2: härledning av en nyckel ur ett lösenord eller en kod (Password-Based Key Derivation Function 2)
- SHA: en familj av hashfunktioner (Secure Hash Algorithm), här SHA-256 med 256 bitar
- SITHS: e-legitimation för personal i vård och omsorg, på kort eller i mobil
- TLS: kryptering av trafiken på nätet (Transport Layer Security)
- TOTP: engångskoder som räknas ur tiden (Time-based One-Time Password, RFC 6238)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
