// Sussa 3.1.12 Donation: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 10, r4: donation och transplantation (donation.js och sussa/runda10-r4.js).
import { DONATION } from '../runda10-r4.js';

export default [
  { id: '3.1.12.1', kategori: 'system', egna: [], tester: DONATION, avsedd: 'uppfyllt_demo',
    losning: 'När läkaren registrerar ett dödsfall på intensivvårdsavdelningen får vårdenhetens donationsansvariga ett förslag i inkorgen. Donationsutredningen följer en checklista med referens till lagen vid varje punkt: möjlig donator identifierad, döden fastställd, Donationsregistret kontrollerat, den avlidnes inställning, närstående informerade, medicinsk bedömning, transplantationskoordinatorn och underlaget till kvalitetsregistret. Systemet skriver donationsanteckningen ur checklistan som ett utkast åt läkaren. En transplantation registreras med organ och datum, och systemet sätter bidiagnosen ur ICD-10-SE.',
    expert: 'Systemet bockar själv av det som går att räkna ut, slår upp Donationsregistret, samlar det i journalen som talar emot donation, skriver anteckningen och underlaget till kvalitetsregistret och sätter KVÅ-koden för undersökningen. Efter en transplantation föreslår uppmärksamhetsinformationen själv Förekomst av transplantat.',
    anmarkning: 'Donationsregistret, transplantationskoordinatorn och kvalitetsregistret är simulerade, och checklistan är en demoregel. De donationsansvariga är uppdrag som verksamhetschefen utser per vårdenhet. Ett dödsfall märker patienten som avliden med datum i huvudet och sökningen, stoppar nya bokningar, kallelser, påminnelser och sms, avbokar kommande tider utan besked och meddelar den simulerade folkbokföringen. Min journal påverkas inte.' },
];
