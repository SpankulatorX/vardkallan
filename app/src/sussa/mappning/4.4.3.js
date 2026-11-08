// Sussa 4.4.3 Etiketter: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 8, r1: provtagningsetiketter med streckkod (streckkod.js, filformat.js och labb.js).
import { T } from '../labb-r8.js';

export default [
  {
    id: '4.4.3.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.pdf, T.etiketter, T.code128],
    losning: 'Etiketterna skrivs ut som PDF, en etikett per sida (57 x 32 mm) för en etikettskrivare eller ett A4-ark med 3 x 7 etiketter för en vanlig skrivare. Formatet följer skrivaren där den som skriver ut arbetar och kan alltid väljas.',
    expert: 'Systemet väljer formatet ur arbetsplatsen och skapar en etikett per rör, så att ingen behöver räkna rör eller välja skrivare.',
    anmarkning: 'Vilken skrivare en arbetsplats har är en inställning i koden i demon.',
  },
  {
    id: '4.4.3.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.etiketter, T.pdf, T.code128, T.provtagning],
    losning: 'Varje etikett har patientens namn och personnummer, streckkod (Code 128) med etikett-id, beställnings-id, analyserna, röret, laboratoriet och provtagningstiden. Etiketterna kan förhandsvisas i beställningen och skrivas ut när som helst, före eller efter provtagningen.',
    expert: 'Systemet sätter identiteten enligt reglerna för skyddad identitet: namn och personnummer står bara när användaren har valt att visa identiteten, och adressen står aldrig på en etikett.',
    anmarkning: 'Etiketterna skrivs ut som PDF. Ingen etikettskrivare är ansluten direkt i demon.',
  },
];
