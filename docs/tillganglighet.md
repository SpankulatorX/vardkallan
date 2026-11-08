# Tillgänglighetsredogörelse för Vårdkällan

Vårdkällan är ett fristående demoprojekt. Redogörelsen visar hur gränssnittet uppfyller kraven i bilaga K2, Tillgänglighetskrav enligt EN 301 549, i förfrågningsunderlaget för Framtidens vårdinformationsstöd (Sussa 8.4.1.3), och några krav i WCAG 2.1 nivå AA som K2 inte nämner. Samma redogörelse med testernas status från det senaste bygget finns på sidan Tillgänglighet i demon, med en länk längst ned på varje sida.

Dokumentet skrivs ur registret i "app/src/tillganglighet.js" med "bun scripts/tillganglighet-md.js". Statusen här är den avsedda. Sidan i demon visar Delvis uppfyllt för ett krav vars tester inte är gröna.

## Så testas det

- Skriptet "test/tillganglighet.cjs" går med Playwright igenom alla vyer för alla demoroller och Min journal och prövar det som går att pröva automatiskt: kontrast med WCAG:s formel, namn på fält, knappar och länkar, textalternativ, rubrikordning, landmärken, språk och sidtitel, tabbordning, synligt fokus, att allt som går att klicka på nås med tangentbordet, att fokus inte byter sida, 200 procents förstoring och 320 px bredd. Det prövar också att ingen information bärs bara av färg, högkontrastläget, minskade rörelser och skärmstorlekarna mobil, platta och stor skärm.
- Kontrollerna är skrivna i projektet, utan en extern tillgänglighetsmotor.
- Det som bara kan bedömas av människor är märkt så. Ingen granskning med skärmläsare och inget test med användare med funktionsnedsättning är gjort.

## Krav i bilaga K2

| WCAG | Krav | EN 301 549 | Nivå | Status | Hur det är testat |
|---|---|---|---|---|---|
| 1.1.1 | Innehåll som inte är text | 11.2.1.1 | A | Uppfyllt | Automatiskt test. Varje bild och symbol i alla vyer prövas: den har ett textalternativ, eller är dold för hjälpmedel när den bara är dekoration. Kurvorna har en beskrivning med värdena, och värdena finns också i en tabell. |
| 1.2.1 | Enbart ljud och enbart video (förinspelad) | 11.2.1.2 | A | Ej tillämpligt | Automatiskt test. Vårdkällan har inget ljud och ingen video. Testet prövar att inga ljud- eller videoelement finns i någon vy. |
| 1.2.2 | Textbeskrivningar (förinspelade) | 11.2.1.3 | A | Ej tillämpligt | Automatiskt test. Inga förinspelade media finns. |
| 1.2.3 | Ljudbeskrivning eller mediealternativ (förinspelat) | 11.2.1.4 | A | Ej tillämpligt | Automatiskt test. Inga förinspelade media finns. |
| 1.2.5 | Ljudbeskrivning (förinspelad) | 11.2.1.6 | AA | Ej tillämpligt | Automatiskt test. Inga förinspelade media finns. |
| 1.3.3 | Sensoriska kännetecken | 11.2.1.9 | A | Delvis uppfyllt | Kräver bedömning av en människa. Instruktionerna i gränssnittet hänvisar till knappar och fält med deras namn, inte med form, färg eller placering. Det är granskat i koden, men bara en människa kan bedöma det i varje text. |
| 1.4.1 | Användning av färger | 11.2.1.10 | A | Uppfyllt | Automatiskt test. Status, larm, varningar, uppmärksamhetssymbolen, spärrmarkeringen och skyddad identitet har text och symbol utöver färgen. I kurvorna har punkter utanför referensintervallet en ring, och den andra serien är streckad. Länkar i löptext är understrukna. Testet prövar varje vy för varje roll. |
| 1.4.2 | Kontroll av ljud | 11.2.1.11 | A | Ej tillämpligt | Automatiskt test. Vårdkällan spelar inget ljud. |
| 1.4.3 | Kontrast (minimum) | 11.2.1.12 | AA | Uppfyllt | Automatiskt test. Kontrasten mellan text och bakgrund räknas med WCAG:s formel för varje synligt textelement i alla vyer för alla demoroller och i Min journal: minst 4,5:1, och 3:1 för stor text. |
| 1.4.4 | Förändring av textstorlek | 11.2.1.13 | AA | Uppfyllt | Automatiskt test. Varje vy prövas vid 200 procents förstoring: ingen rullning i sidled, och ingen text som klipps av i en ruta. |
| 1.4.5 | Text i form av bild | 11.2.1.14 | AA | Uppfyllt | Automatiskt test. All text är text. Testet prövar att inga bilder med text finns; logotypen är en symbol utan text. |
| 2.1.1 | Tangentbord | 11.2.1.15 | A | Uppfyllt | Automatiskt test, och resten kräver bedömning av en människa. Allt som går att klicka på är en knapp, länk eller ett fält och nås med tabb. Testet prövar varje vy och gör inloggning, att öppna en patient, att byta flik och att stänga nyheterna med bara tangentbordet. Att varje flöde går hela vägen med tangentbordet är prövat för de vanligaste flödena, inte för alla. |
| 2.1.2 | Ingen tangentbordsfälla | 11.2.1.16 | A | Uppfyllt | Automatiskt test. Testet tabbar igenom varje vy och prövar att fokus alltid går vidare. Dialogerna stängs med Escape och lämnar tillbaka fokus. |
| 2.2.1 | Justerbar tidsgräns | 11.2.1.17 | A | Uppfyllt | Automatiskt test, och resten kräver bedömning av en människa. Inloggningen går ut efter 30 minuter utan aktivitet. Fem minuter innan visas en varning som skärmläsare läser upp, och knappen Fortsätt arbeta förlänger inloggningen på servern, hur många gånger som helst. Text i en anteckning eller remiss sparas som utkast innan utloggningen och finns kvar efter en ny inloggning. Felmeddelanden står kvar tills de stängs. Testet prövar varningen, förlängningen och utkasten. Åtkomsten för externa tillämpningar med SMART on FHIR går ut efter 30 minuter, och tillämpningen varnar inte själv. |
| 2.2.2 | Paus, stopp, dölj | 11.2.1.18 | A | Uppfyllt | Automatiskt test, och resten kräver bedömning av en människa. Inget rör sig, blinkar eller rullar av sig självt. Läskopian förnyas i bakgrunden utan att sidan ändras. Med minskade rörelser i datorn finns inga animationer alls, vilket testet prövar. |
| 2.4.3 | Fokusordning | 11.2.1.22 | A | Uppfyllt | Automatiskt test. Testet prövar att inget har positivt tabindex, att tabbordningen följer sidans ordning och att fokus flyttas till rubriken när en vy byts. |
| 2.4.4 | Syftet med en länk (i sammanhanget) | 11.2.1.23 | A | Delvis uppfyllt | Automatiskt test, och resten kräver bedömning av en människa. Testet prövar att varje länk har ett namn. Att namnet beskriver syftet i sammanhanget kan bara en människa bedöma. |
| 2.4.6 | Rubriker och ledtexter | 11.2.1.25 | AA | Delvis uppfyllt | Automatiskt test, och resten kräver bedömning av en människa. Testet prövar att varje vy har en rubrik på nivå 1, att rubrikerna inte hoppar över nivåer och att varje fält har en ledtext. Att rubrikerna och ledtexterna beskriver ämnet kan bara en människa bedöma. |
| 2.4.7 | Synligt fokus | 11.2.1.26 | AA | Uppfyllt | Automatiskt test. Testet tabbar igenom varje vy och prövar att varje element som får fokus har en synlig fokusmarkering med minst 3:1 i kontrast. |
| 3.2.1 | Vid fokus | 11.2.1.29 | A | Uppfyllt | Automatiskt test. Testet prövar att adressen inte ändras och att ingen dialog öppnas när fokus flyttas med tabb. |
| 3.2.2 | Vid inmatning | 11.2.1.30 | A | Delvis uppfyllt | Kräver bedömning av en människa. Att välja i en lista eller kryssa i en ruta byter inte sida. Filter som uppdaterar en lista direkt, till exempel i Kravspårbarhet, ändrar bara listan och behåller fokus. Granskat i koden. |
| 3.3.1 | Identifiering av fel | 11.2.1.33 | A | Uppfyllt | Automatiskt test. Ett fel från servern markeras vid fältet och beskrivs i text i formuläret, och fokus flyttas till fältet. Testet prövar det i ett formulär. |
| 3.3.2 | Ledtexter eller instruktioner | 11.2.1.34 | A | Uppfyllt | Automatiskt test. Varje fält har en ledtext, och obligatoriska fält är märkta med text. Testet prövar varje vy. |
| 3.3.3 | Förslag vid felhantering | 11.2.1.35 | AA | Delvis uppfyllt | Kräver bedömning av en människa. Felmeddelandena förklarar på vanlig svenska vad som är fel och vad som går att göra, till exempel när ett personnummer har fel kontrollsiffra. Bara en människa kan bedöma om varje förslag hjälper. |
| 3.3.4 | Förebyggande av fel (juridiskt, ekonomiskt, data) | 11.2.1.36 | AA | Uppfyllt | Kräver bedömning av en människa. Journalanteckningar sparas som utkast och signeras först när användaren väljer det, en signerad anteckning ändras aldrig utan rättas med en ny version, och en felaktig registrering makuleras och raderas aldrig. Ordinationer kontrolleras innan de sparas. Granskat i koden och prövat i servertesterna för journalen och läkemedlen. |

## Krav i WCAG 2.1 nivå AA utöver K2

| WCAG | Krav | EN 301 549 | Nivå | Status | Hur det är testat |
|---|---|---|---|---|---|
| 1.3.1 | Information och relationer | 11.1.3.1 | A | Uppfyllt | Automatiskt test. Rubriker, listor, tabeller och fält är märkta så att hjälpmedel kan läsa strukturen. Testet prövar rubrikordningen, landmärkena och fältens ledtexter. |
| 1.4.10 | Omflyttning | 11.1.4.10 | AA | Uppfyllt | Automatiskt test. Varje vy prövas vid 320 px bredd utan rullning i sidled. Breda tabeller rullar i sin egen ruta, vilket WCAG tillåter för tabeller. |
| 1.4.11 | Kontrast för andra element än text | 11.1.4.11 | AA | Uppfyllt | Automatiskt test. Fältens ramar och fokusmarkeringen prövas mot bakgrunden: minst 3:1. |
| 2.4.1 | Möjlighet att hoppa över block | 11.1.4.1 | A | Uppfyllt | Automatiskt test. Det första tabbstoppet är länken Hoppa till innehållet, och sidan har landmärken. |
| 2.4.2 | Sidans titel | 11.1.4.2 | A | Uppfyllt | Automatiskt test. Varje vy har en egen titel med vyns rubrik. |
| 3.1.1 | Sidans språk | 11.1.6.1 | A | Uppfyllt | Automatiskt test. Sidan har språket svenska, och språkkontrollen i bygget stoppar engelska ord i allt som visas. |
| 4.1.2 | Namn, roll, värde | 11.1.9.2 | A | Uppfyllt | Automatiskt test. Knappar, länkar och fält är riktiga element med namn. Flikar och val har sitt läge märkt (aria-current och aria-pressed). |

## Anpassning för funktionsnedsättningar

### Synskada

Allt går att förstora till 200 procent och läsa vid 320 px bredd. Kontrasten är minst 4,5:1, och högkontrastläget ger minst 7:1. Alla bilder och symboler har textalternativ, och sidan har landmärken och rubriker för skärmläsare. Allt nås med tangentbordet, och fokus syns.

### Hörselskada

Vårdkällan har inget ljud. Larm och påminnelser visas i inkorgen och på skärmen, aldrig bara som ljud.

### Färgblindhet

Färg bär aldrig ensam information. Status, larm, uppmärksamhetssymbolen och kurvorna har text, symbol eller form.

### Begränsad kognitionsförmåga

Systemet är experten: det fyller i det som går att räkna ut och förklarar på vanlig svenska. Språkkontrollen stoppar engelska ord och interna förkortningar. Hjälpen i sammanhanget förklarar de vanligaste flödena steg för steg, nyheterna visar bara det som gäller den egna rollen, och inget rör sig när datorn är inställd på minskade rörelser.

## Inställningar

- Knappen Hög kontrast högst upp på sidan ger mörkare text på vit bakgrund, tydligare ramar och understrukna länkar, med minst 7:1 i kontrast. Valet sparas i webbläsaren.
- Systemet följer datorns inställning för hög kontrast ("prefers-contrast: more" och tvingade färger i Windows) och för minskade rörelser ("prefers-reduced-motion: reduce") utan att användaren behöver välja något.

## Det som inte är uppfyllt fullt ut

- 1.3.3 Sensoriska kännetecken (delvis uppfyllt): den del som bara en människa kan bedöma är inte bedömd av användare.
- 2.4.4 Syftet med en länk (i sammanhanget) (delvis uppfyllt): den del som bara en människa kan bedöma är inte bedömd av användare.
- 2.4.6 Rubriker och ledtexter (delvis uppfyllt): den del som bara en människa kan bedöma är inte bedömd av användare.
- 3.2.2 Vid inmatning (delvis uppfyllt): den del som bara en människa kan bedöma är inte bedömd av användare.
- 3.3.3 Förslag vid felhantering (delvis uppfyllt): den del som bara en människa kan bedöma är inte bedömd av användare.
