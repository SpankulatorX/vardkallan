# Klienter och klientplattform

Vilka klienter Vårdkällan kräver och är prövat i, hur klienten uppdateras och hur systemet förhåller sig till eKlients livscykelplaner, mobilstandard och paketeringspolicy.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| KD1.1.4.1 | Krav på följsamhet mot klient och klientplattform | Skallkrav vid leverans |
| KD1.1.4.2 | Krav på följsamhet mot klient och klientplattform | Skallkrav vid leverans |
| KD1.1.4.4 | Klient och klientplattform | Utvärderingskriterium |
| KD1.1.4.5 | eKlient | Utvärderingskriterium |
| KD1.1.4.6 | Plug-ins | Utvärderingskriterium |
| KD1.1.4.7 | Klientvirtualisering | Utvärderingskriterium |
| KD1.1.4.8 | Tredjepartsprodukter | Utvärderingskriterium |
| KD1.1.4.9 | Klientuppgradering | Utvärderingskriterium |

## Syfte och ansvar

Beställaren tillhandahåller klienter enligt eKlient, och systemet ska kunna användas på dem (KD1.1.4.1). Vårdkällan är en webbapplikation som körs i en vanlig webbläsare. Här står vad systemet kräver av klienten, vad som är prövat och vad driften och beställaren behöver pröva och fylla i.

## Det systemet redan har som stöd

### Klienter som stöds (KD1.1.4.4)

| Klient | Vad som gäller | Prövat |
| --- | --- | --- |
| Webbläsare på dator | Gränssnittet är vanlig HTML, CSS och JavaScript utan ramverk | Automatiskt i Chromium 147 vid varje ändring av gränssnittet ([`app/klienttest-resultat.json`](../../app/klienttest-resultat.json)) |
| Webbläsare i mobil och surfplatta | De flöden som är gjorda för mobilen prövas i en skärm som är 360 px bred: sidan ska inte rulla i sidled och knapparna ska gå att träffa | Automatiskt i Chromium ([`app/src/mobil.js`](../../app/src/mobil.js), `test/mobil.cjs`) |
| Flera skärmar | Fönster i samma webbläsare följer samma patient, och ett fönster kan låsas till sin patient | [`app/public/js/flera-fonster.js`](../../app/public/js/flera-fonster.js) |
| Tillgänglighet | Prövad mot EN 301 549 | [`docs/tillganglighet.md`](../tillganglighet.md) |
| Tjock klient eller egen app | Finns inte och behövs inte | |

Den automatiska prövningen görs inte i Microsoft Edge, Firefox eller Safari och inte på riktiga mobiler. Systemet ska därför prövas i beställarens webbläsare och enheter innan det tas i bruk.

### Inga insticksprogram och ingen klientvirtualisering (KD1.1.4.6, KD1.1.4.7)

Systemet kräver inga insticksprogram (plug-ins), ingen Java, inga ActiveX-komponenter och ingen läsare för PDF utöver webbläsarens egen. Policyn för innehåll (`object-src 'none'`) stoppar inbäddade objekt. Ingen klientvirtualisering behövs, eftersom allt körs i webbläsaren.

### Tredjepartsprodukter i klienten (KD1.1.4.8)

Inga. Gränssnittet laddar inga skript, typsnitt eller stilmallar från andra webbplatser. Policyn för innehåll är `default-src 'self'`, så webbläsaren kör bara skript från systemet självt ([`app/src/server.js`](../../app/src/server.js)). Typsnittet Noto Sans levereras av systemet med sin licens. Kameran och mikrofonen används för bilder, film och ljud i journalen genom webbläsarens egna gränssnitt när användaren väljer det. Röstinmatningen använder webbläsarens inbyggda taligenkänning ([`app/public/js/rostinmatning.js`](../../app/public/js/rostinmatning.js)), och hur ljudet behandlas beror på webbläsaren, så det ska bedömas av beställaren. Streckkodsläsare används i tangentbordsläge och kräver inget i webbläsaren ([`app/public/js/skanner.js`](../../app/public/js/skanner.js)).

### Uppdatering av klienten (KD1.1.4.2, KD1.1.4.9)

Det finns inget klientpaket. När servern uppgraderas får alla användare den nya versionen av gränssnittet nästa gång sidan laddas. En bakgrundstjänst i webbläsaren (service worker, [`app/public/sw.js`](../../app/public/sw.js)) cachar bara gränssnittets statiska filer, så att läsläget fungerar vid avbrott. Den hämtar alltid filerna från servern först och använder cachen bara när servern inte svarar inom fyra sekunder eller svarar med ett serverfel. Den rör aldrig `/api` eller `/fhir`, så patientuppgifter cachas inte där. Läskopian för avbrott är krypterad (se dokumentet om kryptering). En ny version av bakgrundstjänsten tar över direkt när den har installerats.

## Följsamhet mot eKlient (KD1.1.4.5)

Bilagorna KD1 till KD4 är skrivna 2015 till 2017 och nämner de produkter och versioner som gällde då.

| Bilaga och regel | Vårdkällan | Prövat |
| --- | --- | --- |
| KD1 och KD2, livscykelplan för webbläsare: webbapplikationer ska i första hand vara oberoende av webbläsarens produkt och version | Bara standarder i webbläsaren, ingen kod för en viss webbläsare | Bara i Chromium. Microsoft Edge, som numera bygger på Chromium, och Chrome är inte prövade för sig |
| KD1 och KD2, inga webbkomponenter på klienten (Flash, Silverlight, Java i webbläsaren) | Inga | Ja, policyn för innehåll stoppar dem |
| KD1 och KD2, inget kompatibilitetsläge i webbläsaren | Behövs inte | Nej, inte prövat i regionens klientmiljö |
| KD1 och KD2, tilläggsapplikationer på klienten (Java, PDF-läsare, .NET, Office) ska motiveras och bör avvecklas | Inga. Kallelser tas ut som PDF som webbläsaren visar | Ja |
| KD1 och KD2, livscykelplan för operativsystem | Systemet beror inte på operativsystemet, bara på webbläsaren | Nej, inte prövat på regionens operativsystem |
| KD3, mobila enheter: webbappen är det första alternativet och kräver bara en webbläsare | Ingen app att distribuera med MDM | Ja, i Chromium med en smal skärm |
| KD3, data som lagras lokalt ska krypteras och trafiken ska krypteras | Läskopian krypteras med AES-GCM. Trafiken krypteras med TLS av driften | Läskopian ja, TLS i driften nej |
| KD3, inloggning med två faktorer | Flerfaktor med passkey eller engångskoder ([`app/src/flerfaktor.js`](../../app/src/flerfaktor.js)). SITHS-kortet är simulerat | Inte med riktiga SITHS-kort |
| KD4, paketeringspolicy 2.61: program som installeras ska paketeras som MSI | Ingenting installeras. Enligt policyn ska genvägar till webbapplikationer inte paketeras | Ej tillämpligt |

## Att fylla i för den som driver systemet

### Klientmiljön hos beställaren

| Fråga | Svar |
| --- | --- |
| Webbläsare och versioner som ska stödjas | [fyll i: enligt beställarens aktuella livscykelplan] |
| Operativsystem på datorerna | [fyll i] |
| Mobila enheter och hur de förvaltas | [fyll i: plattformar och MDM] |
| Inloggning med SITHS i webbläsaren | [fyll i: hur kortet eller e-legitimationen når webbläsaren] |
| Regler för bakgrundstjänster i webbläsaren och lokal lagring | [fyll i: om beställarens policy tillåter dem, eftersom läsläget kräver det] |

### Prövning före start

- [ ] Hela klickbudgeten och läsläget prövas i varje webbläsare som beställaren stödjer: [fyll i: webbläsare, version och resultat]
- [ ] Prövning på beställarens mobila enheter: [fyll i]
- [ ] Prövning med beställarens hjälpmedel för tillgänglighet: [fyll i]
- [ ] Ny prövning när beställaren byter primär webbläsare eller version: [fyll i: rutin]

### Uppgradering av klienten (KD1.1.4.9)

| Roll | Uppgift |
| --- | --- |
| Driften | Uppgraderar servern efter beslut med fyra ögon ([`app/src/releaser.js`](../../app/src/releaser.js)) och meddelar beställaren i förväg |
| Beställarens systemförvaltare | Godkänner uppgraderingen och läser nyheterna och ändringsloggen för API:t |
| Beställarens klientförvaltning | [fyll i: om något behöver göras i klienterna, till exempel en genväg på skrivbordet] |
| Användarna | Laddar om sidan. [fyll i: hur användarna informeras] |

## Förkortningar

- AES: standard för symmetrisk kryptering (Advanced Encryption Standard)
- API: gränssnitt för program (application programming interface)
- CSS: stilmallar för webbsidor (Cascading Style Sheets)
- EN: europeisk standard (europeisk norm)
- HTML: märkspråket för webbsidor (HyperText Markup Language)
- MDM: system för att förvalta mobila enheter (mobile device management)
- MSI: installationspaket för Windows (Windows Installer)
- PDF: dokumentformatet Portable Document Format
- SITHS: e-legitimation för personal i vård och omsorg, på kort eller i mobil
- TLS: kryptering av trafiken på nätet (Transport Layer Security)

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
