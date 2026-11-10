// Sussa 4.2 Bildhantering: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r3: bilder och media i journalen (bilder.js), se docs/design.md, avsnittet Specialistområden.
// Runda 11, r5: fliken Bilder, uppladdning i delar, miniatyrer, annoteringar, film och ljud, import från apparat och
// annan vårdgivare, det simulerade arkivet med DICOMweb och FHIR Media och ImagingStudy (bildmedia.js, dicom-arkiv.js,
// bildkodek.js), se docs/design.md, avsnittet Bilder och media i version 1.1.
import { BILDER as T } from '../runda9-r3.js';
import { KODEK as K, ARKIV as A, MEDIA as M, FLODEN as F } from '../runda11-r5.js';

export default [
  { id: '4.2.1.1', kategori: 'system', egna: [], tester: [...Object.values(T), M.delar, M.film, M.annotering, M.fhir, M.api, F.fil, F.jamfor], avsedd: 'uppfyllt_demo',
    losning: 'Bildhanteringen är en del av journalen: fliken Bilder har galleriet med miniatyrer som servern gör, förstoring med annoteringar, jämförelse över tid, film och ljud, import från fil, kameran, en apparat och en annan vårdgivare, och studierna i multimediaarkivet. Bilderna har samma behörighet, spärr och loggning som journalanteckningarna och finns i FHIR som Media.',
    expert: 'Systemet avgör typen ur filen, läser tiden ur EXIF, knyter bilden till vårdkontakten, föreslår kroppsstället ur patientens tidigare bilder och ställer bilder av samma kroppsställe bredvid varandra.',
    anmarkning: 'En bild får vara högst 1 MB, en film 2 MB och ett ljud 1 MB i demon, och en sandlåda har plats för 4 MB, eftersom sandlådan ligger i minnet. En större bild förminskas i webbläsaren innan den skickas, och användaren får veta det.' },
  { id: '4.2.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.ladda, T.jamfor, T.behorighet, T.tak, T.sakerhet, T.api, K.typ, K.langd, K.exif, K.miniatyr, K.ritad, M.delar, M.tak, M.exif, M.film, M.annotering, M.annSparr, M.fhir, M.api, A.rendera, F.fil, F.jamfor, F.studie],
    losning: 'Del av journalen: en egen flik med samma behörighet och loggning som anteckningarna. Bearbetning och analys: annoteringar (pil, ring, linje och text) som ett eget lager med författare, jämförelse över tid per kroppsställe och, för studierna, fönster och mätning i millimeter. Sökning och urval på kroppsställe, slag och källa. Presentation: miniatyrer och visningsbilder som servern gör, förstoring, uppspelning av film och ljud. Metadata: typ, storlek, pixlar, längd, tid ur EXIF, kamera, källa, apparat, ursprung, vårdenhet, vårdkontakt, granskning och SHA-256. Import från fil, kamera, mikrofon, apparat, annan vårdgivare, Min journal och remissbilaga, och export av originalet, som Media i FHIR och som DICOM genom WADO-RS.',
    expert: 'Servern gör miniatyrerna och läser metadatan ur filen, så att ingen behöver fylla i den. Platsuppgifter i EXIF följer inte med till miniatyren, och annoteringar ändrar aldrig originalet.',
    anmarkning: 'Annoteringar finns för bilder, inte för film. Mätning i millimeter görs i arkivets studier, där pixelavståndet är känt; på ett foto saknas skala. Film och ljud avkodas inte på servern, så deras miniatyr är ritad (för ljud i WAV med ljudkurvan).' },
  { id: '4.2.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.arkiv, T.sakerhet, T.api, A.p10, A.skydd, A.json, A.rendera, M.dicomweb, M.dicomSparr, M.dicomNekad, M.fhir, M.demo, M.api, F.studie],
    losning: 'Journalen arbetar mot ett simulerat multimediaarkiv (som ett VNA eller DICOM PACS) genom DICOMweb: QIDO-RS för sökning efter studier, serier och instanser i DICOM JSON och WADO-RS för instanserna som DICOM-filer (Part 10), metadata och renderade bilder med fönster. Samma adress kan användas av en extern visare som talar DICOMweb, med samma behörighet och loggning som journalen. Studierna finns i FHIR som ImagingStudy med en Endpoint till arkivet. Bilder som inte är DICOM (foton, film, ljud och PDF) lagras i journalen och finns som Media.',
    expert: 'Systemet väljer arkivet och fönstret efter undersökningen, sätter patientens identitet i studien ur journalen och skyddar en skyddad identitet också i DICOM. Svaret och bildlänken kommer till journalen utan att någon behöver hämta dem.',
    anmarkning: 'Arkivet och bilderna är simulerade: bilderna räknas fram av systemet och visar inga verkliga patienter. XDS-I.b är en dokumenterad integrationspunkt (docs/design.md) och inte byggd. Ingen extern visare är ansluten i demon.' },
  { id: '4.2.1.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.ladda, T.remiss, T.min, T.granska, T.sparr, T.sakerhet, T.api, K.typ, M.delar, M.exif, M.film, M.apparat, M.extern, M.externVal, M.granskaKategori, M.apiImport, F.fil, F.apparat],
    losning: 'Import från fil, mobilens kamera och mikrofon (bild, film och ljud), en medicinteknisk apparat (sårkamera, dermatoskop och bärbart ultraljud, simulerade), en annan vårdgivare genom sammanhållen journalföring med patientens samtycke (simulerad), patientens uppladdning i Min journal och en remissbilaga. Spårbarhet: källan, apparatens serienummer, ursprunget hos den andra vårdgivaren och den som granskade står på bilden. Format: PNG, JPEG och WebP, MP4 och WebM, MP3, M4A, WAV, Ogg och WebM-ljud, och PDF.',
    expert: 'Apparaten skickar bilderna med patientens personnummer ur arbetslistan, och systemet stoppar en bild som gäller en annan patient. Bilder från en apparat, en annan vårdgivare och Min journal kommer in i journalen först när någon på vårdenheten har granskat dem, med kroppsstället förifyllt.',
    anmarkning: 'Apparaterna och den andra vårdgivaren är simulerade, och apparatens bilder räknas fram av systemet. Kameran används genom webbläsaren; på en mobil kan filvalet också ta bilden direkt.' },
];
