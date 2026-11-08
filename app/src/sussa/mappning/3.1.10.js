// Sussa 3.1.10 Skanning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 10, r4: skannade restjournaler (restjournal.js och sussa/runda10-r4.js).
import { RESTJOURNAL } from '../runda10-r4.js';

export default [
  { id: '3.1.10.1', kategori: 'system', egna: ['D2'], tester: RESTJOURNAL, avsedd: 'uppfyllt_demo',
    losning: 'En restjournal skannas in i fliken Restjournaler som PDF eller bild och knyts till patienten, vårdenheten och tiden. Systemet läser PDF:ens textlager, föreslår dokumenttyp och period och kontrollerar personnumret. Dokumentet visas i översiktens tidslinje vid periodens slut, märkt som skannad pappersjournal, tillsammans med migrerad historik och ny dokumentation, och öppnas från listan. Det ändras och raderas aldrig, och ett dokument som skannats till fel patient makuleras med orsak.',
    expert: 'Den som skannar väljer bara filen. Systemet föreslår dokumenttyp och period ur texten, stoppar ett dokument med en annan patients personnummer och samma fil två gånger, och sätter vårdenhet, tid och vem som skannade.',
    anmarkning: 'OCR av bilder görs inte i demon: en skannad bild sparas utan text och söks inte. Texten läses ur PDF:ens textlager, som en skanner med OCR lägger in. En fil får vara högst 40 kB i demon.' },
  { id: '3.1.10.2', kategori: 'system', egna: [], tester: RESTJOURNAL, avsedd: 'uppfyllt_demo',
    losning: 'Skanning: en fil per dokument, med systemets förslag till metadata. OCR och bildskanning: PDF med textlager och bilder i PNG och JPEG. Metadata: dokumenttyp, period, ursprung, vårdenhet, tid och den som skannade, och förslagen kan ändras innan dokumentet sparas. Helhet: dokumentet står i samma tidslinje som migrerad historik och ny dokumentation. Sökbarhet: texten söks i journalens sökfält med samma behörighet som listan. Presentation: märkt som skannad pappersjournal med period, utdrag och länk till dokumentet.',
    expert: 'Systemet läser texten och fyller i dokumenttyp och period, kontrollerar identiteten och ställer dokumentet i kronologin, så att den som letar hittar restjournalen bland den övriga journalen utan att veta att den finns.',
    anmarkning: 'OCR av bilder är inte byggd, så en skannad bild är inte sökbar. Behörighet, spärr och loggning är desamma som för journalanteckningarna.' },
];
