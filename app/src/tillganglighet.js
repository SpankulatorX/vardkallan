// Tillgänglighetsredogörelsen (Sussa 8.4.1.3): varje krav i bilaga K2, Tillgänglighetskrav enligt EN 301 549, med
// status och hur det är testat. Kraven hänvisar till EN 301 549 kapitel 11 (programvara), som i sin tur hänvisar till
// WCAG. Projektet prövar mot WCAG 2.1 nivå AA, som EN 301 549 version 3.2.1 kapitel 9 och 11 kräver, och tar därför
// också med några krav i WCAG 2.1 som K2 inte nämner.
//
// Statusen räknas som i kravregistret: ett krav som ska vara uppfyllt är det bara när alla dess tester finns och är
// gröna, annars är det delvis. bedomning säger hur kravet prövas: automatisk (testerna avgör), manuell (bara en
// människa kan bedöma det) eller bada (testerna prövar det som går, och resten kräver en människa). Det som bara kan
// bedömas av människor är märkt så och inte prövat med användare.
import { G, S } from './sussa/runda7-r2.js';

export const STATUS = ['uppfyllt', 'delvis', 'ej', 'ej_tillampligt'];
export const STATUSTEXT = { uppfyllt: 'Uppfyllt', delvis: 'Delvis uppfyllt', ej: 'Ej uppfyllt', ej_tillampligt: 'Ej tillämpligt' };
export const BEDOMNING = ['automatisk', 'manuell', 'bada'];
export const KALLA = 'Bilaga K2, Tillgänglighetskrav enligt EN 301 549, i förfrågningsunderlaget Framtidens vårdinformationsstöd (dnr 16RS2022), och WCAG 2.1 nivå AA.';

const k = (id, rubrik, en, wcag, niva, avsedd, bedomning, hur, tester = [], anmarkning = null) => ({ id, rubrik, en, wcag, niva, avsedd, bedomning, hur, tester, anmarkning });

export const KRAV = [
  k('1.1.1', 'Innehåll som inte är text', '11.2.1.1', '1.1.1', 'A', 'uppfyllt', 'automatisk',
    'Varje bild och symbol i alla vyer prövas: den har ett textalternativ, eller är dold för hjälpmedel när den bara är dekoration. Kurvorna har en beskrivning med värdena, och värdena finns också i en tabell.',
    [G.alt, G.namn]),
  k('1.2.1', 'Enbart ljud och enbart video (förinspelad)', '11.2.1.2', '1.2.1', 'A', 'ej_tillampligt', 'automatisk',
    'Gränssnittet har inget eget ljud och ingen egen video. Filmer och ljud som vården spelar in och för in i journalen (fliken Bilder) är uppgifter om patienten, och de spelas bara upp när användaren väljer det, i en dialog med webbläsarens kontroller och med kroppsställe, beskrivning, tid och längd i text. Testet prövar att inga ljud- eller videoelement finns i någon vy när den visas.', [G.media]),
  k('1.2.2', 'Textbeskrivningar (förinspelade)', '11.2.1.3', '1.2.2', 'A', 'ej_tillampligt', 'automatisk',
    'Inga förinspelade media finns.', [G.media]),
  k('1.2.3', 'Ljudbeskrivning eller mediealternativ (förinspelat)', '11.2.1.4', '1.2.3', 'A', 'ej_tillampligt', 'automatisk',
    'Inga förinspelade media finns.', [G.media]),
  k('1.2.5', 'Ljudbeskrivning (förinspelad)', '11.2.1.6', '1.2.5', 'AA', 'ej_tillampligt', 'automatisk',
    'Inga förinspelade media finns.', [G.media]),
  k('1.3.3', 'Sensoriska kännetecken', '11.2.1.9', '1.3.3', 'A', 'delvis', 'manuell',
    'Instruktionerna i gränssnittet hänvisar till knappar och fält med deras namn, inte med form, färg eller placering. Det är granskat i koden, men bara en människa kan bedöma det i varje text.', [],
    'Kräver bedömning av en människa.'),
  k('1.4.1', 'Användning av färger', '11.2.1.10', '1.4.1', 'A', 'uppfyllt', 'automatisk',
    'Status, larm, varningar, uppmärksamhetssymbolen, spärrmarkeringen och skyddad identitet har text och symbol utöver färgen. I kurvorna har punkter utanför referensintervallet en ring, och den andra serien är streckad. Länkar i löptext är understrukna. Testet prövar varje vy för varje roll.',
    [G.farg]),
  k('1.4.2', 'Kontroll av ljud', '11.2.1.11', '1.4.2', 'A', 'ej_tillampligt', 'automatisk',
    'Vårdkällan spelar inget ljud av sig självt. Ett inspelat ljud i journalen spelas bara upp när användaren startar det, och det stoppas med webbläsarens kontroller.', [G.media]),
  k('1.4.3', 'Kontrast (minimum)', '11.2.1.12', '1.4.3', 'AA', 'uppfyllt', 'automatisk',
    'Kontrasten mellan text och bakgrund räknas med WCAG:s formel för varje synligt textelement i alla vyer för alla demoroller och i Min journal: minst 4,5:1, och 3:1 för stor text.',
    [G.kontrast]),
  k('1.4.4', 'Förändring av textstorlek', '11.2.1.13', '1.4.4', 'AA', 'uppfyllt', 'automatisk',
    'Varje vy prövas vid 200 procents förstoring: ingen rullning i sidled, och ingen text som klipps av i en ruta.', [G.zoom]),
  k('1.4.5', 'Text i form av bild', '11.2.1.14', '1.4.5', 'AA', 'uppfyllt', 'automatisk',
    'All text är text. Testet prövar att inga bilder med text finns; logotypen är en symbol utan text.', [G.media]),
  k('2.1.1', 'Tangentbord', '11.2.1.15', '2.1.1', 'A', 'uppfyllt', 'bada',
    'Allt som går att klicka på är en knapp, länk eller ett fält och nås med tabb. Testet prövar varje vy och gör inloggning, att öppna en patient, att byta flik och att stänga nyheterna med bara tangentbordet. Att varje flöde går hela vägen med tangentbordet är prövat för de vanligaste flödena, inte för alla.',
    [G.tangentbord, G.tangentbordFlode]),
  k('2.1.2', 'Ingen tangentbordsfälla', '11.2.1.16', '2.1.2', 'A', 'uppfyllt', 'automatisk',
    'Testet tabbar igenom varje vy och prövar att fokus alltid går vidare. Dialogerna stängs med Escape och lämnar tillbaka fokus.', [G.fokusordning]),
  k('2.2.1', 'Justerbar tidsgräns', '11.2.1.17', '2.2.1', 'A', 'uppfyllt', 'bada',
    'Inloggningen går ut efter 30 minuter utan aktivitet. Fem minuter innan visas en varning som skärmläsare läser upp, och knappen Fortsätt arbeta förlänger inloggningen på servern, hur många gånger som helst. Text i en anteckning eller remiss sparas som utkast innan utloggningen och finns kvar efter en ny inloggning. Felmeddelanden står kvar tills de stängs. Testet prövar varningen, förlängningen och utkasten.', [G.tidsgrans],
    'Åtkomsten för externa tillämpningar med SMART on FHIR går ut efter 30 minuter, och tillämpningen varnar inte själv.'),
  k('2.2.2', 'Paus, stopp, dölj', '11.2.1.18', '2.2.2', 'A', 'uppfyllt', 'bada',
    'Inget rör sig, blinkar eller rullar av sig självt. Läskopian förnyas i bakgrunden utan att sidan ändras. Med minskade rörelser i datorn finns inga animationer alls, vilket testet prövar.', [G.media, G.rorelse]),
  k('2.4.3', 'Fokusordning', '11.2.1.22', '2.4.3', 'A', 'uppfyllt', 'automatisk',
    'Testet prövar att inget har positivt tabindex, att tabbordningen följer sidans ordning och att fokus flyttas till rubriken när en vy byts.', [G.fokusordning]),
  k('2.4.4', 'Syftet med en länk (i sammanhanget)', '11.2.1.23', '2.4.4', 'A', 'delvis', 'bada',
    'Testet prövar att varje länk har ett namn. Att namnet beskriver syftet i sammanhanget kan bara en människa bedöma.', [G.namn],
    'Kräver bedömning av en människa.'),
  k('2.4.6', 'Rubriker och ledtexter', '11.2.1.25', '2.4.6', 'AA', 'delvis', 'bada',
    'Testet prövar att varje vy har en rubrik på nivå 1, att rubrikerna inte hoppar över nivåer och att varje fält har en ledtext. Att rubrikerna och ledtexterna beskriver ämnet kan bara en människa bedöma.', [G.rubriker, G.namn],
    'Kräver bedömning av en människa.'),
  k('2.4.7', 'Synligt fokus', '11.2.1.26', '2.4.7', 'AA', 'uppfyllt', 'automatisk',
    'Testet tabbar igenom varje vy och prövar att varje element som får fokus har en synlig fokusmarkering med minst 3:1 i kontrast.', [G.synligtFokus, G.komponentkontrast]),
  k('3.2.1', 'Vid fokus', '11.2.1.29', '3.2.1', 'A', 'uppfyllt', 'automatisk',
    'Testet prövar att adressen inte ändras och att ingen dialog öppnas när fokus flyttas med tabb.', [G.vidFokus]),
  k('3.2.2', 'Vid inmatning', '11.2.1.30', '3.2.2', 'A', 'delvis', 'manuell',
    'Att välja i en lista eller kryssa i en ruta byter inte sida. Filter som uppdaterar en lista direkt, till exempel i Kravspårbarhet, ändrar bara listan och behåller fokus. Granskat i koden.', [],
    'Kräver bedömning av en människa.'),
  k('3.3.1', 'Identifiering av fel', '11.2.1.33', '3.3.1', 'A', 'uppfyllt', 'automatisk',
    'Ett fel från servern markeras vid fältet och beskrivs i text i formuläret, och fokus flyttas till fältet. Testet prövar det i ett formulär.', [G.felmarkering]),
  k('3.3.2', 'Ledtexter eller instruktioner', '11.2.1.34', '3.3.2', 'A', 'uppfyllt', 'automatisk',
    'Varje fält har en ledtext, och obligatoriska fält är märkta med text. Testet prövar varje vy.', [G.namn]),
  k('3.3.3', 'Förslag vid felhantering', '11.2.1.35', '3.3.3', 'AA', 'delvis', 'manuell',
    'Felmeddelandena förklarar på vanlig svenska vad som är fel och vad som går att göra, till exempel när ett personnummer har fel kontrollsiffra. Bara en människa kan bedöma om varje förslag hjälper.', [],
    'Kräver bedömning av en människa.'),
  k('3.3.4', 'Förebyggande av fel (juridiskt, ekonomiskt, data)', '11.2.1.36', '3.3.4', 'AA', 'uppfyllt', 'manuell',
    'Journalanteckningar sparas som utkast och signeras först när användaren väljer det, en signerad anteckning ändras aldrig utan rättas med en ny version, och en felaktig registrering makuleras och raderas aldrig. Ordinationer kontrolleras innan de sparas. Granskat i koden och prövat i servertesterna för journalen och läkemedlen.', [],
    'Kräver bedömning av en människa.'),
];

// Krav i WCAG 2.1 nivå AA som K2 inte nämner, men som går att pröva automatiskt.
export const TILLAGG = [
  k('1.3.1', 'Information och relationer', '11.1.3.1', '1.3.1', 'A', 'uppfyllt', 'automatisk',
    'Rubriker, listor, tabeller och fält är märkta så att hjälpmedel kan läsa strukturen. Testet prövar rubrikordningen, landmärkena och fältens ledtexter.', [G.rubriker, G.landmarken, G.namn]),
  k('1.4.10', 'Omflyttning', '11.1.4.10', '1.4.10', 'AA', 'uppfyllt', 'automatisk',
    'Varje vy prövas vid 320 px bredd utan rullning i sidled. Breda tabeller rullar i sin egen ruta, vilket WCAG tillåter för tabeller.', [G.omflyttning]),
  k('1.4.11', 'Kontrast för andra element än text', '11.1.4.11', '1.4.11', 'AA', 'uppfyllt', 'automatisk',
    'Fältens ramar och fokusmarkeringen prövas mot bakgrunden: minst 3:1.', [G.komponentkontrast]),
  k('2.4.1', 'Möjlighet att hoppa över block', '11.1.4.1', '2.4.1', 'A', 'uppfyllt', 'automatisk',
    'Det första tabbstoppet är länken Hoppa till innehållet, och sidan har landmärken.', [G.landmarken, G.tangentbordFlode]),
  k('2.4.2', 'Sidans titel', '11.1.4.2', '2.4.2', 'A', 'uppfyllt', 'automatisk',
    'Varje vy har en egen titel med vyns rubrik.', [G.sprak]),
  k('3.1.1', 'Sidans språk', '11.1.6.1', '3.1.1', 'A', 'uppfyllt', 'automatisk',
    'Sidan har språket svenska, och språkkontrollen i bygget stoppar engelska ord i allt som visas.', [G.sprak]),
  k('4.1.2', 'Namn, roll, värde', '11.1.9.2', '4.1.2', 'A', 'uppfyllt', 'automatisk',
    'Knappar, länkar och fält är riktiga element med namn. Flikar och val har sitt läge märkt (aria-current och aria-pressed).', [G.namn, G.tangentbord]),
];

// Hur Vårdkällan är anpassad för de funktionsnedsättningar som K2 och Sussa 8.4.1.3 nämner.
export const ANPASSNING = [
  { id: 'syn', rubrik: 'Synskada', text: 'Allt går att förstora till 200 procent och läsa vid 320 px bredd. Kontrasten är minst 4,5:1, och högkontrastläget ger minst 7:1. Alla bilder och symboler har textalternativ, och sidan har landmärken och rubriker för skärmläsare. Allt nås med tangentbordet, och fokus syns.', tester: [G.zoom, G.omflyttning, G.kontrast, G.hogKontrast, G.alt, G.landmarken, G.synligtFokus] },
  { id: 'horsel', rubrik: 'Hörselskada', text: 'Vårdkällan har inga ljudsignaler. Larm och påminnelser visas i inkorgen och på skärmen, aldrig bara som ljud. Ett inspelat ljud i journalen har en beskrivning i text.', tester: [G.media] },
  { id: 'farg', rubrik: 'Färgblindhet', text: 'Färg bär aldrig ensam information. Status, larm, uppmärksamhetssymbolen och kurvorna har text, symbol eller form.', tester: [G.farg] },
  { id: 'kognition', rubrik: 'Begränsad kognitionsförmåga', text: 'Systemet är experten: det fyller i det som går att räkna ut och förklarar på vanlig svenska. Språkkontrollen stoppar engelska ord och interna förkortningar. Hjälpen i sammanhanget förklarar de vanligaste flödena steg för steg, nyheterna visar bara det som gäller den egna rollen, och inget rör sig när datorn är inställd på minskade rörelser.', tester: [G.hjalp, G.nyheter, G.rorelse, S.ovText] },
];

// Räknar status ur testresultaten. tester är en lista med { namn, status } från bygget och testerna av gränssnittet.
export function redogorelse(tester = []) {
  const status = new Map(tester.map(t => [t.namn, t.status]));
  const rakna = (x) => {
    const t = x.tester.map(namn => ({ namn, status: status.get(namn) ?? 'saknas' }));
    const grona = t.length > 0 && t.every(y => y.status === 'grön');
    // Ett krav som ska vara uppfyllt eller inte tillämpligt är det bara med gröna tester. Manuella krav har inga tester
    // och behåller den bedömda statusen.
    let s = x.avsedd;
    if (t.length && !grona && (s === 'uppfyllt' || s === 'ej_tillampligt')) s = 'delvis';
    return { ...x, status: s, statusText: STATUSTEXT[s], manuell: x.bedomning !== 'automatisk', tester: t };
  };
  const krav = KRAV.map(rakna);
  const tillagg = TILLAGG.map(rakna);
  const summa = Object.fromEntries(STATUS.map(s => [s, krav.filter(x => x.status === s).length]));
  const anpassning = ANPASSNING.map(a => {
    const t = a.tester.map(namn => ({ namn, status: status.get(namn) ?? 'saknas' }));
    return { ...a, tester: t, allaGrona: t.every(y => y.status === 'grön') };
  });
  return { kalla: KALLA, krav, tillagg, anpassning, summa };
}

export const tillganglighetTester = () => [...new Set([...KRAV, ...TILLAGG, ...ANPASSNING].flatMap(x => x.tester))];

const BEDOMNINGTEXT = { automatisk: 'Automatiskt test', manuell: 'Kräver bedömning av en människa', bada: 'Automatiskt test, och resten kräver bedömning av en människa' };

// Redogörelsen som Markdown för docs/tillganglighet.md. Skrivs av scripts/tillganglighet-md.js, så att dokumentet och
// sidan i appen alltid kommer ur samma register. Statusen här är den avsedda; sidan i appen visar statusen ur testerna.
export function markdown() {
  const MANNISKA = 'Kräver bedömning av en människa.';
  const anm = (x) => (x.anmarkning && x.anmarkning !== MANNISKA ? x.anmarkning : null);
  const rad = (x) => `| ${x.id} | ${x.rubrik} | ${x.en} | ${x.niva} | ${STATUSTEXT[x.avsedd]} | ${BEDOMNINGTEXT[x.bedomning]}. ${x.hur}${anm(x) ? ` ${anm(x)}` : ''} |`;
  const tabell = (lista) => ['| WCAG | Krav | EN 301 549 | Nivå | Status | Hur det är testat |', '|---|---|---|---|---|---|', ...lista.map(rad)].join('\n');
  const ej = KRAV.filter(x => x.avsedd === 'ej' || x.avsedd === 'delvis');
  return `# Tillgänglighetsredogörelse för Vårdkällan

Vårdkällan är ett fristående demoprojekt. Redogörelsen visar hur gränssnittet uppfyller kraven i bilaga K2, Tillgänglighetskrav enligt EN 301 549, i förfrågningsunderlaget för Framtidens vårdinformationsstöd (Sussa 8.4.1.3), och några krav i WCAG 2.1 nivå AA som K2 inte nämner. Samma redogörelse med testernas status från det senaste bygget finns på sidan Tillgänglighet i demon, med en länk längst ned på varje sida.

Dokumentet skrivs ur registret i "app/src/tillganglighet.js" med "bun scripts/tillganglighet-md.js". Statusen här är den avsedda. Sidan i demon visar Delvis uppfyllt för ett krav vars tester inte är gröna.

## Så testas det

- Skriptet "test/tillganglighet.cjs" går med Playwright igenom alla vyer för alla demoroller och Min journal och prövar det som går att pröva automatiskt: kontrast med WCAG:s formel, namn på fält, knappar och länkar, textalternativ, rubrikordning, landmärken, språk och sidtitel, tabbordning, synligt fokus, att allt som går att klicka på nås med tangentbordet, att fokus inte byter sida, 200 procents förstoring och 320 px bredd. Det prövar också att ingen information bärs bara av färg, högkontrastläget, minskade rörelser och skärmstorlekarna mobil, platta och stor skärm.
- Kontrollerna är skrivna i projektet, utan en extern tillgänglighetsmotor.
- Det som bara kan bedömas av människor är märkt så. Ingen granskning med skärmläsare och inget test med användare med funktionsnedsättning är gjort.

## Krav i bilaga K2

${tabell(KRAV)}

## Krav i WCAG 2.1 nivå AA utöver K2

${tabell(TILLAGG)}

## Anpassning för funktionsnedsättningar

${ANPASSNING.map(a => `### ${a.rubrik}\n\n${a.text}`).join('\n\n')}

## Inställningar

- Knappen Hög kontrast högst upp på sidan ger mörkare text på vit bakgrund, tydligare ramar och understrukna länkar, med minst 7:1 i kontrast. Valet sparas i webbläsaren.
- Systemet följer datorns inställning för hög kontrast ("prefers-contrast: more" och tvingade färger i Windows) och för minskade rörelser ("prefers-reduced-motion: reduce") utan att användaren behöver välja något.

## Det som inte är uppfyllt fullt ut

${ej.map(x => `- ${x.id} ${x.rubrik} (${STATUSTEXT[x.avsedd].toLowerCase()}): ${anm(x) ?? 'den del som bara en människa kan bedöma är inte bedömd av användare.'}`).join('\n')}
`;
}
