// Sussa 4.2 Bildhantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: bilder och media i journalen (bilder.js), se docs/design.md, avsnittet Specialistområden.
import { BILDER as T } from '../runda9-r3.js';

export default [
  { id: '4.2.1.1', kategori: 'system', egna: [], tester: Object.values(T), avsedd: 'delvis',
    losning: 'Bilder och media i journalen knutna till patient, vårdkontakt och anteckning, med import från flera källor och referenser till studier i ett simulerat multimediaarkiv. Den finns i API:t.',
    expert: 'Systemet avgör filtypen, knyter bilden till vårdkontakten, märker källan och ställer bilder av samma kroppsställe bredvid varandra.',
    anmarkning: 'Delvis: inget eget gränssnitt i journalen finns ännu, och bilderna begränsas till 40 kB i demon.' },
  { id: '4.2.1.2', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.ladda, T.jamfor, T.behorighet, T.tak, T.sakerhet, T.api],
    losning: 'Bilder (PNG och JPEG) och PDF sparas med patient, vårdenhet, vårdkontakt, anteckning, kroppsställe, beskrivning, tid och SHA-256. Filen visas med samma inre sekretess, spärr och loggning som journalanteckningar, och bilder av samma kroppsställe visas i tidsordning med dagarna mellan dem.',
    expert: 'Systemet avgör typen ur filens innehåll, knyter bilden till den pågående vårdkontakten och ställer samman jämförelsen själv.',
    anmarkning: 'Delvis: miniatyrer och förstoring görs av webbläsaren, eftersom inget gränssnitt för bilderna finns ännu. Video, ljud och annotering saknas, och FHIR Media är inte byggd.' },
  { id: '4.2.1.3', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.arkiv, T.sakerhet, T.api],
    losning: 'Undersökningar beställs till ett simulerat multimediaarkiv (bildarkivet och ett fotoarkiv) med frågeställning. Arkivet svarar med utlåtande, studiens id och antal bilder, och journalen har en bildlänk som visar studien genom arkivet med samma behörighet och loggning som journalen.',
    expert: 'Systemet väljer arkivet ur undersökningen och lägger in svaret och bildlänken i journalen utan att någon behöver hämta dem.',
    anmarkning: 'Delvis: arkiven är simulerade och bilden är en ritad platshållare. DICOM, XDS-I och FHIR ImagingStudy är inte byggda.' },
  { id: '4.2.1.4', kategori: 'system', egna: [], avsedd: 'delvis',
    tester: [T.ladda, T.remiss, T.min, T.granska, T.sparr, T.sakerhet, T.api],
    losning: 'Import från fil och från mobilens kamera, från patientens egen uppladdning i Min journal till en vårdenhet där patienten har kontakt och från en remissbilaga. Källan märks på bilden, och patientens bilder kommer in i journalen först när vårdenheten har granskat dem.',
    expert: 'Systemet föreslår vårdenheterna där patienten har kontakt, märker källan själv och låter en remissbilaga behålla avsändarens vårdenhet, så att en spärr gäller också i journalen.',
    anmarkning: 'Delvis: import från medicintekniska apparater och från andra vårdgivare saknas, och gränssnittet för kameran är inte byggt.' },
];
