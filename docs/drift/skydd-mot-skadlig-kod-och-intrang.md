# Skydd mot skadlig kod och intrång

Vad Vårdkällan själv gör för att förhindra, upptäcka och logga angrepp, och vad driften ska ha för skydd mot skadlig kod, intrångsskydd, intrångsdetektering, larm och åtgärd.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.3.1.10 | Skydd mot skadlig kod | Skallkrav vid leverans |
| 5.3.1.13 | Intrångsskydd och intrångsdetektering | Skallkrav vid leverans |

## Syfte och ansvar

Sussa kräver skydd mot skadlig kod med övervakning, larm och plan för åtgärd (5.3.1.10) och säkerhetsfunktioner för intrångsskydd och intrångsdetektering som upptäcker, förhindrar och larmar (5.3.1.13). Systemet har skydd i sin egen kod, men övervakning dygnet runt, larm till en jourhavande och åtgärder kräver en driftansvarig organisation.

## Det systemet redan har som stöd

### Förhindra

| Skydd | Vad det gör | Var det finns |
| --- | --- | --- |
| Policy för innehåll (CSP) | `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` och `frame-ancestors 'none'`. Webbläsaren kör bara skript från systemet självt, och sidan kan inte ramas in av en annan webbplats | [`app/src/server.js`](../../app/src/server.js) |
| Andra säkerhetsrubriker | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` och `Referrer-Policy: same-origin` på statiska filer | [`app/src/server.js`](../../app/src/server.js) |
| Sessionen | Kakan är HttpOnly och SameSite=Lax, får Secure när den publika adressen är HTTPS, och byts vid varje inloggning. Skrivande anrop med fel ursprung avvisas | [`app/src/server.js`](../../app/src/server.js) |
| Tak på anrop | En förfrågan får vara högst 64 kB. Varje sandlåda och varje adress har tak och tidsbudgetar | [`app/src/server.js`](../../app/src/server.js) |
| Filer som laddas upp | Typen avgörs ur filens innehåll och inte ur namnet. Bara bilder, film, ljud och PDF tas emot, med tak på storlek (1 MB för bild, ljud och dokument och 2 MB för film), på antal pixlar, på antal delar som läses och på hur mycket som packas upp | [`app/src/bilder.js`](../../app/src/bilder.js), [`app/src/bildkodek.js`](../../app/src/bildkodek.js) |
| Inloggning | Bara biljetter från betrodda utfärdare med rätt algoritm, nyckel, mottagare och giltighetstid, och varje biljett används en gång | [`app/src/idp.js`](../../app/src/idp.js) |
| Flerfaktor | Passkey eller engångskoder, högst fem felaktiga försök per inloggning och tio per användare under en kvart | [`app/src/flerfaktor.js`](../../app/src/flerfaktor.js) |
| Prenumerationer | Bara godkända mottagare, utan omdirigeringar och interna adresser | [`docs/sakerhetsarkitektur.md`](../sakerhetsarkitektur.md) |

Hotmodellen med varje hot, kontrollen och testerna som visar att kontrollen fungerar finns i [`app/src/hotmodell.js`](../../app/src/hotmodell.js) och beskrivs i [`docs/sakerhetsarkitektur.md`](../sakerhetsarkitektur.md).

### Upptäcka

- Säkerhetsloggen registrerar inloggning, utloggning, misslyckad inloggning, anrop som avvisas med 401 eller 403, ändrade behörigheter och inställningar, flerfaktor, export av loggen och stickprov ([`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js)).
- Åtkomstloggen registrerar varje läsning och skrivning i journalen med grund, och nödåtkomst och nekade försök flaggas i logguppföljningen ([`app/src/logg.js`](../../app/src/logg.js), [`app/src/logguppfoljning.js`](../../app/src/logguppfoljning.js)).
- Båda loggarna kedjas med SHA-256 och skyddas av databastriggrar mot ändring och radering. En rad som ändras i efterhand bryter kedjan, och kontrollen visar var. Kedjorna prövas också när en säkerhetskopia provåterläses ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)).
- Signerade anteckningar och meddelanden kan kontrolleras när som helst, så att ändrat innehåll syns ([`app/src/anteckningssignatur.js`](../../app/src/anteckningssignatur.js), [`app/src/signering.js`](../../app/src/signering.js)).

### Det systemet inte gör

Systemet söker inte igenom filer efter virus, har ingen egen intrångsdetektering på nätnivå och skickar inga larm till en jourhavande. Det finns ingen extern säkerhetsgranskning eller penetrationstest av koden. Säkerhetsloggen kan läsas och exporteras av logggranskaren, men driften behöver föra över händelserna till sin egen övervakning för att få larm.

## Att fylla i för den som driver systemet

### Skydd mot skadlig kod (5.3.1.10)

| Område | Beskrivning |
| --- | --- |
| Skydd på servrarna | [fyll i: produkt eller metod för servrar och containerbilder] |
| Granskning av filer som laddas upp, utöver systemets egen typkontroll | [fyll i: till exempel en virusskanner framför systemet] |
| Sårbarhetsbevakning av containerbild, operativsystem och Bun | [fyll i: verktyg, hur ofta och vem som läser resultatet] |
| Säkerhetsuppdateringar | [fyll i: tid från publicering till installation, per allvarlighetsgrad] |
| Klienterna | Beställarens ansvar enligt eKlient. [fyll i: hur ansvaret avtalas] |

### Intrångsskydd och intrångsdetektering (5.3.1.13)

| Funktion | Beskrivning |
| --- | --- |
| Brandvägg och segmentering | [fyll i: zoner, vilka portar som är öppna] |
| Skydd för webbtrafiken framför systemet | [fyll i: till exempel ett filter för webbtrafik (web application firewall) och skydd mot överbelastning] |
| Intrångsdetektering på nät och servrar | [fyll i: produkt och vad som övervakas] |
| Insamling av loggar | [fyll i: hur säkerhetsloggen, serverns loggar och nätets loggar samlas på ett ställe] |
| Mönster som ger larm | [fyll i: till exempel många misslyckade inloggningar, många avvisade anrop från samma adress, en bruten hashkedja] |
| Jour och larmväg | [fyll i: vem som tar emot larmet dygnet runt och inom vilken tid] |

### Plan för åtgärd

1. Larmet bedöms av jourhavande inom [fyll i: tid].
2. En säkerhetsincident registreras i incidentregistret i vyn Servicenivåer och incidenter (`#/servicenivaer`, `servicenivaer.js`).
3. Begränsa: [fyll i: till exempel stänga en adress, stänga av ett konto eller ta systemet till läsläge].
4. Utreda med säkerhetsloggen, åtkomstloggen och serverns loggar. Hashkedjorna visar om en logg har ändrats.
5. Återställa vid behov från en verifierad säkerhetskopia, med fyra ögon ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)).
6. Rapportera till beställaren. Incidentrapporten tas ut med `POST /api/servicenivaer/export` (5.3.1.14).
7. Följa upp och förbättra: [fyll i: hur lärdomar förs in i rutiner och i koden].

- [ ] Planen övas minst [fyll i: hur ofta].
- [ ] Rapportering till myndigheter enligt gällande regler: [fyll i: vem som rapporterar och till vem].

## Förkortningar

- CSP: policy för innehåll (Content Security Policy) som talar om för webbläsaren vad en sida får ladda och köra
- HTTPS: HTTP krypterat med TLS
- PDF: dokumentformatet Portable Document Format
- SHA: en familj av hashfunktioner (Secure Hash Algorithm), här SHA-256 med 256 bitar

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
