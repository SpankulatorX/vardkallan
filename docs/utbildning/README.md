# Utbildning i Vårdkällan

Det här är utbildningskonceptet och utbildningsplanen för Vårdkällan, och utbildningsmaterialet för varje yrkesroll. Materialet är på svenska och skrivet för vuxna yrkesverksamma, motsvarande nivå C1 i Europarådets gemensamma referensram för språk: korta stycken, vanliga ord och fackord där vården använder dem.

## Grundtanken

Systemet är experten, inte användaren. Systemet fyller i det det kan räkna ut, föreslår nästa steg och förklarar på vanlig svenska varför något inte går. Därför handlar utbildningen mer om arbetsflödena och om vad systemet gör åt användaren än om knappar och kodverk. Ett flöde som kräver mycket utbildning är ett tecken på att flödet behöver göras om, och varje vanligt flöde har en klickbudget som mäts automatiskt.

## Utbildningskonceptet

Utbildningen har sex delar, som bygger på varandra. Alla delar utom den lärarledda utbildningen finns i systemet i dag.

1. E-utbildning i systemet. Under Utbildning gör varje användare övningarna för sin yrkesroll: korta kunskapsfrågor om hur Vårdkällan fungerar, med demopatienter. Servern rättar och förklarar varje svar. Den som svarar rätt på alla får ett intyg i Grundkurs i Vårdkällan som gäller i 365 dagar. Verksamhetschefen ser vilka på vårdenheten som har giltigt intyg, vilka vars intyg går ut inom 30 dagar och vilka som saknar intyg.

2. Praktiska prov i en övningsjournal. Ett praktiskt prov är en uppgift som görs på riktigt i journalen för en påhittad patient, och systemet kontrollerar själv att det blev rätt. I dag finns 3 prov: ordinera paracetamol vid behov, skriva och signera en journalanteckning och registrera ett blodtryck.

3. Instruktionsfilmer. 10 korta filmer visar de vanligaste arbetsflödena från början till slut, med textade steg på svenska. De ligger i docs/filmer/ och spelas in på nytt efter varje ändring i gränssnittet.

4. Hjälp i sammanhanget och nyheter. Rutan Hjälp i de vanligaste flödena säger vad användaren gör och vad systemet gör, och länkar till övningarna. Efter en ny version visar systemet nyheterna för rollen, med ändrade arbetssätt först.

5. Lärarledd utbildning. En utbildare leder ett pass för en yrkesroll i demon, som är Vårdkällans utbildningsmiljö. Varje deltagare har en egen sandlåda och kan göra fel utan att något påverkas. Passet följer materialet för rollen: arbetsflödena, filmerna och uppdragen i testinbjudan, och slutar med övningarna och ett praktiskt prov. Den lärarledda utbildningen ordnas av den organisation som inför systemet.

6. Superanvändare. På varje vårdenhet ska det finnas minst en superanvändare, som i Vårdkällan är en utbildare: någon som själv har ett giltigt intyg och som verksamhetschefen har gett ett utbildarintyg. Utbildaren ändrar vårdenhetens egna övningar, startar praktiska prov och följer upp vilka som har klarat dem. Det är ingen egen inloggningsroll, utan en behörighet för den som redan arbetar på vårdenheten.

## Utbildningsplan

Planen gäller ett införande på en vårdenhet och den löpande utbildningen efteråt.

1. Före start utbildas superanvändarna först: hela materialet för deras yrkesroll, övningarna, de praktiska proven och en genomgång av hur de följer upp de andra.

2. Varje användare gör e-utbildningen före den lärarledda utbildningen: läser materialet för rollen, ser filmerna och gör övningarna.

3. Lärarledd utbildning per yrkesroll i demon, med uppdragen i testinbjudan som övningsuppgifter, följd av ett praktiskt prov.

4. Vid start finns superanvändarna på vårdenheten, och synpunkter lämnas med knappen Lämna synpunkt på varje sida.

5. Löpande: nyheterna efter varje ny version, nya filmer när ett arbetsflöde ändras och ett nytt intyg varje år. Systemet påminner när ett intyg går ut inom 30 dagar.

## Utvärdering av utbildningen

Utbildningen utvärderas med det som systemet redan mäter:

- Intygen och de praktiska proven: vilka som har klarat dem och när intygen går ut, per vårdenhet.
- Klickbudgeten: att de vanliga arbetsflödena inte kräver fler steg än budgeten, mätt automatiskt efter varje ändring.
- Synpunkterna från varje vy och jämförelsefrågan efter varje uppdrag i testinbjudan: om flödet var lättare, ungefär lika eller svårare än i det journalsystem testaren använder i dag.
- Användartest med personer som arbetar i vården, med protokollet i docs/anvandartest.md.

Ett flöde där många svarar fel på en övning, misslyckas med ett prov eller lämnar synpunkter är först en fråga om flödet, och sedan om utbildningen.

## Så hålls materialet aktuellt

Materialet skrivs ur systemets egna register med scripts/dokument-md.js: arbetsflödena och klickbudgeten ur klickbudget.js, filmerna ur instruktionsfilmer.js, övningarna ur seed/ovningar.js, de praktiska proven ur praktiska-prov.js och uppdragen ur testinbjudan.js. Ett automatiskt test stoppar bygget om filerna här inte är exakt det som skrivs ur registren, om ett arbetsflöde eller en film i materialet inte finns i registren eller om en roll med övningar saknar material.

Övningarna i materialet är version 1, som den står i koden. Ändrar verksamhetschefen eller en utbildare övningarna i gränssnittet, gäller den nya versionen i systemet, och materialet visar fortfarande version 1.

## Material per roll

| Roll | Arbetsflöden | Filmer | Övningar | Uppdrag |
| --- | --- | --- | --- | --- |
| [Läkare](lakare.md) | 57 | 4 | 7 | 22 |
| [Sjuksköterska](sjukskoterska.md) | 28 | 2 | 8 | 19 |
| [Undersköterska](underskoterska.md) | 1 | 1 | 7 | 7 |
| [Vårdadministratör](vardadministrator.md) | 19 | 1 | 7 | 12 |
| [Logggranskare](logggranskare.md) | 0 | 0 | 3 | 0 |
| [Arkivarie](arkivarie.md) | 0 | 0 | 3 | 0 |
| [Analytiker (uppföljning)](uppfoljning.md) | 1 | 0 | 3 | 0 |
| [Kommunens personal (simulerad)](kommun.md) | 0 | 0 | 3 | 0 |
| [Farmaceut](farmaceut.md) | 1 | 0 | 6 | 0 |
| [Verksamhetschef](verksamhetschef.md) | 1 | 0 | 4 | 0 |
| [Ekonom](ekonom.md) | 1 | 0 | 3 | 0 |
| [Systemförvaltare](systemforvaltare.md) | 4 | 1 | 3 | 7 |
| [Fysioterapeut](fysioterapeut.md) | 0 | 0 | 5 | 7 |
| [Invånare i Min journal](invanare.md) | 5 | 1 | 0 | 7 |
