// Moduler: vad som finns i demon och vad som är planerat. Ingenting märks som klart som inte är det.
import { esc, ikon, vyRubrik } from '../ui.js';

export const namn = 'moduler';

const FINNS = [
  ['Patientöversikt', 'Aktuella läkemedel, diagnoser, senaste mätvärden och anteckningar, pågående remisser och en tidslinje där migrerad historik från VAS och Cosmic ligger i samma kronologi.', null],
  ['Journal', 'Anteckningar från mallar med sökord, utkast, signering och rättelse. En signerad anteckning ändras aldrig; rättelsen blir en ny version och den gamla står kvar överstruken.', null],
  ['Läkemedel', 'Ordination med obligatorisk ordinationsorsak och uppföljningsdatum, varningar som måste kvitteras, utsättning med orsak och kvittens från Nationella läkemedelslistan. NLL är simulerad, och varningarna är demoregler, inte kliniskt beslutsstöd.', null],
  ['Remiss och svar', 'Remisser inom regionen med mottagningskvittens, bedömning, svar och kvittens av svaret, och larm när ett steg uteblir. Inte e-remiss mellan vårdgivare.', '#/remisser'],
  ['Mätvärden', 'Vitalparametrar och labbvärden med trend per typ och registrering av nya värden.', null],
  ['Behörighet och logg', 'Vårdrelation, inre sekretess med aktivt val, spärr med samtycke, nödåtkomst, skyddade personuppgifter och en logg som inte går att ändra, med logguppföljning.', '#/logg'],
  ['Tidbok, väntelista och kallelser', 'Vårdadministratörens dagliga arbete i ordning, tidbok per mottagning och vårdgivare, väntelista med gräns mot vårdgarantin, förslag på tider så att bokning är ett klick, kallelser och påminnelser som systemet skriver och skickar själv, incheckning i Min journal och på en skärm i väntrummet, och patientavgift med simulerad betalning. Egenbokning i Min journal. Sms, brev och betalning är simulerade, och avgifterna och vårdgarantin är demoregler.', null],
  ['Väntrum med könummer', 'Uppropning med könummer för alla patienter. Namnet på en skyddad patient lämnar aldrig servern.', '#/vantrum'],
  ['Min journal för patienten', 'Invånarens egen e-tjänst med simulerad e-legitimation: anteckningar, diagnoser, läkemedel, provsvar och remisser efter vårdgivarens visningsregler, och vem som har läst journalen, med vårdenhet, yrkesroll, tid och grund. Spärr och loggutdrag begärs hos vården. Vårdnadshavare läser barnets journal till 13 år.', '#/?vy=patient'],
  ['Öppet FHIR-API', 'FHIR R4 för läsning av alla resurser, med samma behörighet och loggning som gränssnittet. Inte validerat mot HL7 Swedens basprofiler.', '#/api'],
  // Runda 7, r6.
  ['Barnhälsovård och tillväxt', 'Tillväxtkurvor med WHO:s tillväxtstandard och larm när kurvor korsas, barnhälsovårdens besöks- och vaccinationsprogram med bokning i tidboken, mätningar hemma från vårdnadshavaren och rapportering till Svenska barnhälsovårdsregistret med kontroll före utskicket. Registret är en simulerad mottagare, och larmen och tidsfönstren är demoregler.', null],
  // Runda 8, r1.
  ['Beställning och svar för laboratoriet', 'Labbeställning med paket som systemet föreslår, beställning på uppdrag, provtagning rör för rör med etiketter, svar med NPU-kod och referensintervall som läkaren vidimerar och kontroller till avdelningen. Laboratorierna är simulerade.', null],
  ['Migreringsavstämning och kravspårbarhet', 'Avstämning av migrerade poster och ett kravregister där varje krav pekar på sina automatiska tester.', '#/migrering'],
];

const PLANERAT = [
  ['Kassa och resursbokning', 'Kassaredovisning, återbetalning, LMA-kort och avgifter för hjälpmedel, recept och intyg, och bokning av lokaler, utrustning och transporter.'],
  ['Samordnad vårdplanering med kommunen', 'Planering vid utskrivning från sluten vård och informationsutbyte med kommunernas vård och omsorg.'],
  ['Operation, anestesi och intensivvård', 'Operationsplanering, anestesijournal och övervakning inom intensivvården.'],
  ['Cytostatika', 'Behandlingsregimer, ordination och beredning av cytostatika.'],
  ['Förlossning', 'Graviditet, förlossningsjournal och partogram.'],
  ['Beställning och svar för röntgen och fysiologi', 'Beställningar till bild- och funktionsmedicin, med svar och kvittens. Laboratoriet finns sedan runda 8.'],
  ['Diktat och taligenkänning', 'Diktering av anteckningar med taligenkänning och utskrift.'],
  ['Integrationer mot NLL, NPÖ, 1177 och e-remiss', 'Riktiga anslutningar till nationella tjänster. I demon är NLL simulerad och övriga saknas.'],
  ['Uppföljning och statistik', 'Verksamhetsuppföljning, kvalitetsregister och inrapportering till patientregistret.'],
  ['Mobil', 'Arbete vid sängen och i hemsjukvården från mobil och surfplatta. Gränssnittet fungerar i dag på smal skärm, men en mobil arbetsapp finns inte.'],
];

export async function visa(main) {
  main.innerHTML = vyRubrik('Moduler', 'Hela vården ska rymmas i ett öppet system, en modul i taget. Här är vad som finns i demon och vad som är planerat. Journalens delar når du genom att öppna en patient från arbetslistan.') + `
    <section aria-labelledby="mod-finns" class="modulgrupp"><h2 id="mod-finns">Finns i demon <span class="antal">${FINNS.length}</span></h2>
      <ul class="modullista">${FINNS.map(([n, t, h]) => `<li class="modul modul-finns"><span class="modul-status">${ikon.bock}Finns i demon</span><h3>${h ? `<a href="${h}">${esc(n)}</a>` : esc(n)}</h3><p>${esc(t)}</p></li>`).join('')}</ul></section>
    <section aria-labelledby="mod-plan" class="modulgrupp"><h2 id="mod-plan">Planerat <span class="antal">${PLANERAT.length}</span></h2>
      <p class="dampad">Inget av det här finns i demon än. Ordningen säger inget om när det byggs.</p>
      <ul class="modullista">${PLANERAT.map(([n, t]) => `<li class="modul modul-planerat"><span class="modul-status">${ikon.klocka}Planerat, inte byggt</span><h3>${esc(n)}</h3><p>${esc(t)}</p></li>`).join('')}</ul></section>`;
}
