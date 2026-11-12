# Åtkomst för drift- och supportpersonal

Hur behörigheter för drift- och supportpersonal tilldelas, följs upp och begränsas, och hur systemets egna roller hjälper till att hålla dem borta från journalen.

Dokumentet är ett underlag som den som driver Vårdkällan tar över, anpassar och fyller i. Ett dokument gör inte att ett åtagande är uppfyllt: åtagandet kräver en driftansvarig organisation som arbetar efter dokumentet och kan visa det för beställaren. Platshållare står inom hakparentes och börjar med fyll i.

## Krav i Sussa som dokumentet gäller

| Id | Krav | Slag |
| --- | --- | --- |
| 5.2.1.5 | Begränsad åtkomst för leverantörens drift- och supportpersonal | Skallkrav vid leverans |

## Syfte och ansvar

Leverantören ska begränsa åtkomsten till information och funktioner för sin drift- och supportpersonal till det som är absolut nödvändigt, och beskriva hur behörigheter tilldelas, följs upp och begränsas och vilken segmentering och separering av uppgifter som finns (5.2.1.5). Systemet ger stöd inne i applikationen. Åtkomsten till servrar, databaser och nät utanför applikationen styrs av driften.

## Det systemet redan har som stöd

### Behörighet i applikationen

- Behörighetsmotorn räknar åtkomsten ur yrkesroll, vårdenhet och vårdrelation i varje anrop. Ingen behörighet tilldelas för hand ([`app/src/atkomst.js`](../../app/src/atkomst.js)).
- Varje roll, dess behov, risker och handlingar står i behörighetsanalysen ([`docs/behorighetsanalys.md`](../behorighetsanalys.md)).
- Systemförvaltaren konfigurerar regler och parametrar, förbereder omorganisationer, beslutar om undantag, följer upp lagringen och förvaltar det öppna API:t, men har inga handlingar som läser journalen. Rollen får inte läsa journalen eller översikten och får inte ordinera.
- Ändringar som systemförvaltaren gör kräver fyra ögon: en andra systemförvaltare godkänner i sin egen inloggning. Det gäller bland annat parametrar, uppgraderingar ([`app/src/releaser.js`](../../app/src/releaser.js)) och återställning av säkerhetskopior ([`app/src/sakerhetskopior.js`](../../app/src/sakerhetskopior.js)).
- Logggranskaren läser loggarna och drar stickprov, men varje export, varje stickprov och varje granskad rad loggas ([`app/src/logguppfoljning.js`](../../app/src/logguppfoljning.js)).
- Nödåtkomsten i journalen gäller vårdpersonal som vårdar patienten. Den loggas och flaggas och häver aldrig en spärr. Systemförvaltaren har ingen nödåtkomst.
- Inloggningen tas ur biljettens attribut och prövas mot masterdata i varje anrop, så att en person som slutar förlorar åtkomsten direkt ([`app/src/idp.js`](../../app/src/idp.js)).

### Loggar som inte går att ändra

Åtkomstloggen och säkerhetsloggen kedjas med SHA-256 och skyddas av databastriggrar ([`app/src/logg.js`](../../app/src/logg.js), [`app/src/sakerhetslogg.js`](../../app/src/sakerhetslogg.js)). Den som har skrivrätt till databasfilen kan ändå ändra den utan att gå genom systemet. En ändrad rad bryter då kedjan, men det upptäcks först när kedjan kontrolleras. Därför ska direktåtkomst till servern och databasen loggas utanför systemet, se nedan.

### Det systemet inte gör

Databasen och säkerhetskopiorna är inte krypterade av systemet. Filnamnen för kopior och vilande sandlådor är en HMAC av sandlådans id, men innehållet ligger okrypterat. Kryptering av lagringen ska därför göras av driften (se dokumentet om kryptering).

## Att fylla i för den som driver systemet

### Roller i driften

| Roll | Uppgifter | Åtkomst | Får inte |
| --- | --- | --- | --- |
| Drifttekniker | [fyll i] | Servrar och containrar, inte databasens innehåll | Läsa journalen |
| Databasansvarig | [fyll i] | Säkerhetskopior och återställning med fyra ögon | Läsa journalen utanför en återställning |
| Nätansvarig | [fyll i] | Nät och brandväggar | Logga in på servrarna |
| Supportpersonal | [fyll i] | Ärenden och systemets mått (`GET /api/drift`), ingen inloggning i journalen | Logga in som en användare |
| Systemförvaltare hos beställaren | Regler, parametrar och uppgraderingar i systemet | Rollen systemförvaltare | Läsa journalen |

### Tilldelning, uppföljning och borttagning

- [ ] Behörighet ges efter beslut av: [fyll i: roll hos driften och hos beställaren]
- [ ] Personlig inloggning med flerfaktor för all driftåtkomst, inga gemensamma konton: [fyll i]
- [ ] Åtkomsten gäller bara så länge uppdraget gäller och tas bort samma dag som det upphör: [fyll i: rutin]
- [ ] Genomgång av alla behörigheter minst [fyll i: hur ofta], med protokoll
- [ ] Personalen är kontrollerad och har tystnadsplikt eller sekretessförbindelse: [fyll i]

### Segmentering och separering

- [ ] Produktion, acceptanstest, utbildning och test är skilda åt i nät och behörigheter: [fyll i]
- [ ] Administration av servrarna sker bara från ett eget administrationsnät eller via en bevakad hoppserver: [fyll i]
- [ ] Ingen person kan ensam både ändra och godkänna en ändring i produktionen: [fyll i]

### Direktåtkomst till server och databas

- [ ] Varje inloggning på servrarna loggas utanför systemet, i en logg som driftpersonalen inte kan ändra: [fyll i: var loggen finns]
- [ ] Databasfilerna och säkerhetskopiorna ligger på krypterade volymer: [fyll i]
- [ ] Åtkomst till databasens innehåll, till exempel vid felsökning, kräver ett ärende och ett godkännande av beställaren: [fyll i]

### Nödåtkomst för drift

Ibland behövs åtkomst som går utöver det vanliga, till exempel vid ett allvarligt fel nattetid.

1. Åtkomsten begärs i ett ärende med skälet: [fyll i: ärendesystem].
2. En andra person godkänner innan åtkomsten öppnas (fyra ögon): [fyll i: vem].
3. Åtkomsten gäller en begränsad tid: [fyll i: hur länge].
4. Allt som görs loggas, och beställaren får en rapport efteråt.
5. Händelsen registreras i incidentregistret i vyn Servicenivåer och incidenter (`#/servicenivaer`).

## Förkortningar

- API: gränssnitt för program (application programming interface)
- HMAC: kontrollsumma med en hemlig nyckel (hash-based message authentication code)
- SHA: en familj av hashfunktioner (Secure Hash Algorithm), här SHA-256 med 256 bitar

Dokumentet skrivs ur Vårdkällans källkod (app/src/driftdokument.js). Den som tar över det kan kopiera filen och fortsätta i sin egen dokumenthantering.
