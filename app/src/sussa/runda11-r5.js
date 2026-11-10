// Testerna för bilder och media i version 1.1 (runda 11, r5, Sussa 4.2.1.1 till 4.2.1.4): bildkodeken (bildkodek.js),
// det simulerade arkivet med DICOMweb (dicom-arkiv.js), uppladdning, annoteringar, import och FHIR (bildmedia.js), API:t
// (r11r5-rutter.js) och flödena i fliken Bilder i klickbudgeten.
const BK = 'Bildkodek > ';
const DA = 'Simulerat multimediaarkiv med DICOMweb > ';
const BM = 'Bilder och media 1.1 > ';
const API = 'API för bilder och media 1.1 > ';
const GK = 'Gränssnitt > Klickbudget > ';

export const KODEK = {
  typ: `${BK}typen avgörs ur innehållet för bilder, filmer, ljud och PDF, och annat stöds inte`,
  langd: `${BK}filmens och ljudets längd och bildstorlek läses ur filen, med tak på antalet delar`,
  exif: `${BK}EXIF ger tiden när bilden togs, kameran, orienteringen och om bilden bär platsuppgifter`,
  miniatyr: `${BK}servern gör miniatyren, vrider den efter EXIF och förstorar aldrig, och en bomb med för många pixlar avvisas`,
  ritad: `${BK}servern ritar miniatyren för film, ljud och dokument, och ljudkurvan ur ett ljud i WAV`,
};
export const ARKIV = {
  p10: `${DA}en instans är en DICOM-fil i explicit VR little endian med patienten ur journalen och pixeldata i rätt storlek`,
  skydd: `${DA}en patient med skyddad identitet är skyddad också i DICOM tills identiteten har visats`,
  json: `${DA}DICOM JSON för sökning och metadata följer DICOMwebs format, och pixeldatan är en BulkDataURI`,
  rendera: `${DA}den renderade bilden är en PNG med fönstret, bilderna är desamma varje gång, och ett ogiltigt fönster avvisas`,
};
export const MEDIA = {
  delar: `${BM}en fil större än ett anrop skickas i delar, kontrolleras och förs in i journalen med miniatyr och visningsbild som servern gör`,
  tak: `${BM}uppladdningen i delar har tak per person, patient och sandlåda, delar med fel storlek avvisas och en bild som inte går att avkoda kommer inte in`,
  exif: `${BM}tiden när bilden togs och kameran läses ur EXIF, och platsuppgifter följer inte med till miniatyren`,
  film: `${BM}film och ljud sparas med längd, spelas upp ur journalen och får en ritad miniatyr`,
  annotering: `${BM}annoteringar sparas som ett eget lager med författare, originalet ändras inte, och bara den som gjorde annoteringen tar bort den`,
  annSparr: `${BM}säkerhet: en annotering från en spärrad vårdenhet syns inte, och svaret är detsamma som utan den`,
  apparat: `${BM}en bild från en medicinteknisk apparat väntar på granskning med apparatens serienummer, och en bild som enligt apparaten gäller en annan patient kan inte föras in`,
  extern: `${BM}bilder från en annan vårdgivare hämtas bara med patientens samtycke, behåller sitt ursprung och kommer in i journalen efter granskning`,
  dicomweb: `${BM}DICOMweb: QIDO-RS söker patientens studier, WADO-RS hämtar instansen som DICOM-fil och den renderade bilden med fönster, med behörighet och loggning`,
  dicomSparr: `${BM}säkerhet: DICOMweb visar inte en studie på en spärrad vårdenhet, en patient utan åtkomst ger en tom lista, och en studie för en annan patient finns inte`,
  fhir: `${BM}FHIR Media och ImagingStudy med samma behörighet som fliken, och ImagingStudy pekar på arkivets DICOMweb`,
  externVal: `${BM}säkerhet: bilder från en annan vårdgivare kräver ett aktivt val med syfte i sessionen för samma person och patient, som sammanhållen journalföring`,
  granskaKategori: `${BM}säkerhet: granskningen kräver skrivrätten för bildens kategori, så en roll med bara omvårdnadens skrivrätt för inte in en bild i journalens kategori`,
  dicomNekad: `${BM}säkerhet: en sökning i DICOMweb på en patient utan åtkomst ger en tom lista och loggas som nekad`,
  demo: `${BM}demons mall har trycksårsbilderna och en besvarad lungröntgen för Gunnar Åkesson, men inte seeden som testerna bygger på`,
  api: `${API}bilder 1.1: en stor bild skickas i delar, servern gör miniatyren, bilden annoteras och studien hämtas genom DICOMweb`,
  apiImport: `${API}bilder 1.1: sjuksköterskan hämtar från apparaten och granskar, och läkaren hämtar bilder från en annan vårdgivare med samtycke`,
};
export const FLODEN = {
  fil: `${GK}Lägga in en bild från datorn i journalen inom budget`,
  jamfor: `${GK}Jämföra bilder av ett kroppsställe över tid inom budget`,
  apparat: `${GK}Hämta en bild från en apparat och föra in den i journalen inom budget`,
  studie: `${GK}Visa en röntgenstudie ur arkivet med ett annat fönster inom budget`,
};
