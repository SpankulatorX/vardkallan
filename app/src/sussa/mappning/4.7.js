// Sussa 4.7 Obstetrik och förlossning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: graviditetsjournalen och förlossningsjournalen (obstetrik.js), se docs/design.md, avsnittet Specialistområden.
import { GRAVIDITET as T } from '../runda9-r3.js';

export default [
  { id: '4.7.1.1', kategori: 'system', egna: [], tester: Object.values(T), avsedd: 'delvis',
    losning: 'Graviditetsjournalen med beräknad partus, besöksprogram, provschema och riskbedömning och förlossningsjournalen med partogram och registrering av barnen, också vid flerbörd. Den finns i API:t.',
    expert: 'Systemet räknar graviditetslängden, programmet, proverna och risken, varnar vid besöket och i partogrammet och skapar barnets journal och födelseuppgifter själv.',
    anmarkning: 'Delvis: grundfunktionen finns med förenklade demoregler. Inget eget gränssnitt finns ännu, och CTG, ultraljudsjournal och BB-vårdens omvårdnad saknas.' },
  { id: '4.7.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.bpd, T.program, T.risk, T.besok, T.uppfoljning, T.behorighet, T.sakerhet, T.api],
    losning: 'Barnmorskan skriver in graviditeten med sista mens, ultraljud, antal foster och tidigare förlossningar. Graviditetsjournalen visar beräknad partus, graviditetsveckan, besöksprogrammet med nästa besök, provschemat, riskbedömningen och besöken med blodtryck, vikt, symfys-fundusmått, fosterljud och protein i urinen.',
    expert: 'Systemet räknar beräknad partus och väljer ultraljudet när det skiljer mer än sju dagar, lägger ut besöksprogrammet och proverna efter vecka, risk och flerbörd, beställer proverna med ett klick, gör riskbedömningen ur journalen och varnar för förhöjt blodtryck, protein, avvikande symfys-fundusmått och fosterljud.',
    anmarkning: 'Delvis: programmet och gränserna är förenklade demoregler. Rutinultraljudet är en post i programmet, inte en ultraljudsjournal. Inskrivningssamtalets frågor (till exempel om våld och levnadsvanor) och Graviditetsregistret saknas.' },
  { id: '4.7.1.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.partogram, T.barn, T.sakerhet, T.api],
    losning: 'Förlossningsjournalen startas från vecka 22 och har ett partogram med modermunnens öppning, fosterljud och värkar. Vid födelsen registreras kön, vikt, längd, huvudomfång, Apgar och förlossningssätt. Varje barn, också vid flerbörd, får en egen journal med reservnummer kopplad till modern, och graviditetslängd, födelsevikt, längd och huvudomfång förs vidare till barnhälsovården.',
    expert: 'Systemet räknar varningslinjen och åtgärdslinjen och säger vad som ska göras, varnar för fosterljud utanför gränserna, skapar barnets journal och reservnummer och för födelseuppgifterna vidare utan att någon skriver dem igen.',
    anmarkning: 'Delvis: personnumret från Skatteverket och aviseringen av födelsen är inte simulerade, CTG och smärtlindring under förlossningen registreras inte, och modern och barnet vårdas på BB utan egen BB-journal.' },
  { id: '4.7.1.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.uppfoljning, T.api],
    losning: 'Planeringen och uppföljningen per vårdenhet visar pågående graviditeter, flerbörd, risk vid inskrivningen, väntade förlossningar per vecka de kommande tolv veckorna och förlossningarnas utfall: antal, barn, flerbörd, andel kejsarsnitt, Apgar under 7, medelvikt och förlopp över åtgärdslinjen, utan personuppgifter.',
    expert: 'Systemet räknar allt ur journalerna, så att verksamheten kan planera förlossningarna utan egna listor.',
    anmarkning: 'Delvis: uppföljningen finns i API:t men ännu inte i datauttaget för uppföljning eller i ett gränssnitt.' },
];
