// Sussa 4.8 Cytostatika: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: cytostatikabehandling ur regim (cytostatika.js), se docs/design.md, avsnittet Specialistområden.
import { CYTOSTATIKA as T } from '../runda9-r3.js';

const ORD = [T.regim, T.karboplatin, T.prov, T.dosjustering, T.sakerhet, T.enhet, T.behorighet, T.api];
const BERED = [T.beredning, T.sakerhet, T.enhet, T.api];
const GE = [T.sangen, T.dubbel, T.peroral, T.sakerhet, T.enhet, T.behorighet, T.api];

export default [
  { id: '4.8.1.1', kategori: 'system', egna: [], tester: ORD, avsedd: 'delvis',
    losning: 'Läkaren ordinerar cytostatika ur en behandlingsregim med cykler och dagar, och systemet räknar doserna.',
    expert: 'Systemet hämtar längd, vikt och kreatinin ur journalen och räknar kroppsyta, njurfunktion och dos.',
    anmarkning: 'Delvis: tre demoregimer. Specialområdet sköts delvis upp i Tilläggsavtal 3.' },
  { id: '4.8.1.2', kategori: 'system', egna: [], tester: BERED, avsedd: 'delvis',
    losning: 'En godkänd kur blir en beredningsorder till en simulerad beredningsenhet med volym, spädning och etikett med streckkod.',
    expert: 'Systemet räknar volymen ur stamlösningen och väljer bärarlösning och volym.',
    anmarkning: 'Delvis: beredningsenheten är simulerad och dess egen kontroll görs av demon.' },
  { id: '4.8.1.3', kategori: 'system', egna: [], tester: GE, avsedd: 'delvis',
    losning: 'Den beredda kuren tas emot med streckkodskontroll, iordningställs vid sängen, dubbelkontrolleras av en andra person i sin egen inloggning och ges i regimens ordning. Peroral behandling överlämnas till patienten med instruktion.',
    expert: 'Systemet kontrollerar id-band, etikett, hållbarhet och ordning och räknar tabletterna för peroral behandling.',
    anmarkning: 'Delvis: infusionstakt, avbrott och biverkningar under administreringen registreras inte.' },
  { id: '4.8.1.4', kategori: 'system', egna: [], tester: ORD, avsedd: 'delvis',
    losning: 'Regimerna har cykler, intervall och dagar. Doserna räknas per kroppsyta (Mosteller) eller med Calverts formel för karboplatin ur njurfunktionen (Cockcroft-Gault, med tak). Före varje kur prövas provsvaren mot regimens gränser, och läkaren godkänner kuren, justerar dosen med orsak eller skjuter upp cykeln. Nästa cykel planeras med aktuell vikt.',
    expert: 'Systemet räknar och avrundar doserna, säger vilka provsvar som saknas eller ligger under gränsen och varför kuren inte kan godkännas, beställer proverna med ett klick och räknar om doserna när vikten ändras.',
    anmarkning: 'Delvis: tre regimer som demoregler (EC, karboplatin och kapecitabin). Regimbibliotek med godkännande av regimansvarig, premedicinering och dosgränser för hela behandlingen (till exempel kumulativ antracyklindos) saknas.' },
  { id: '4.8.1.5', kategori: 'system', egna: [], tester: BERED, avsedd: 'delvis',
    losning: 'Beredningsordern har varje dos med beräkning, stamlösningens styrka, volym läkemedel, bärarlösning, total volym, infusionstid, etikett med patientens identitet och streckkod och hållbarhet. Peroral behandling får tabletterna per tillfälle och för hela cykeln. Den simulerade beredningsenheten bereder bara en kur som läkaren har godkänt.',
    expert: 'Systemet räknar volym och tabletter och skriver etiketten, och streckkoden kontrolleras när beredningen tas emot och vid sängen.',
    anmarkning: 'Delvis: beredningsenheten är simulerad. Arbetslista, lager och spårbarhet av batcher på beredningsenheten saknas.' },
  { id: '4.8.1.6', kategori: 'system', egna: [], tester: GE, avsedd: 'delvis',
    losning: 'Mottagningen läser etiketten. Vid sängen läser den som ska ge kuren id-bandet och etiketten, och dosen väntar på dubbelkontroll hos de andra behöriga på vårdenheten, som bekräftar med en egen läsning i sin egen inloggning. Först därefter ges dosen, i regimens ordning och inom hållbarheten. Peroral behandling överlämnas till patienten med tabletter och instruktion.',
    expert: 'Systemet föreslår vem som kan kontrollera, aldrig den som iordningställde, nekar fel patient, fel etikett, för gammal beredning och fel ordning med förklaring, och skriver instruktionen till patienten.',
    anmarkning: 'Delvis: infusionens start och slut, extravasering och reaktioner registreras inte, och överlämnandet följs inte upp i Min journal.' },
  { id: '4.8.1.7', kategori: 'system', egna: [], tester: [T.uppfoljning, T.api], avsedd: 'delvis',
    losning: 'Uppföljningen per vårdenhet visar pågående behandlingar per regim, planerade kurer de kommande fyra veckorna, givna kurer, beredningar, dosjusteringar och uppskjutna cykler, utan personuppgifter.',
    expert: 'Systemet räknar allt ur ordinationerna, beredningarna och administreringen.',
    anmarkning: 'Delvis: uppföljningen finns i API:t men ännu inte i datauttaget för uppföljning eller i ett gränssnitt.' },
];
