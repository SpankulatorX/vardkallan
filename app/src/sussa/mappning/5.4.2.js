// Sussa 5.4.2 Grundläggande behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r5: inloggning med biljett, skyddsbehov, signering, certifikat, e-arkiv, gallring och miljöer (sussa/runda9-r5.js).
import { medR9r5 } from '../runda9-r5.js';
const A = 'Arkiv > ';

export default medR9r5([
  {
    id: '5.4.2.1', kategori: 'system', egna: ['M12'], avsedd: 'uppfyllt_demo',
    tester: [
      `${A}beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas`,
      `${A}export och verkställande kräver ett registrerat beslut av rätt slag, och beslutsfattare och lagrum fyller systemet i`,
      `${A}exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil`,
      `${A}exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter`,
    ],
    losning: 'Exportpaket för en patient eller alla journaler enligt FGS Paketstruktur 2.0 (E-ARK CSIP och SIP 2.1.0 i Riksarkivets tillämpning) med journalen i HL7 FHIR R4, metadata i METS och PREMIS och SHA-256 för varje fil. Paketet med alla journaler är också återföringen av all data när avtalet upphör.',
    expert: 'Arkivarien registrerar beslutet med diarienummer och datum. Systemet fyller i beslutsfattare och lagrum, tar med allt som hör till journalen och bygger och kontrollsummerar paketet själv.',
    anmarkning: 'Ingen överföring till ett verkligt e-arkiv. Paketet är inte validerat mot METS-schemat eller mot en leveransöverenskommelse, och XML-scheman ligger inte i mappen schemas.',
  },
  { id: '5.4.2.2', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Åtkomst till mellanarkiv är inte byggd.' },
  {
    id: '5.4.2.3', kategori: 'system', egna: ['M12'], avsedd: 'delvis',
    tester: [
      `${A}exportpaketet följer FGS Paketstruktur 2.0 med METS.xml, alla mappar och SHA-256 för varje fil`,
      `${A}exportpaketet är fullständigt och tar med spärrar och skyddad identitet som uppgifter`,
    ],
    losning: 'Informationen följer med i sitt ursprungliga innehåll som FHIR R4, med alla versioner av rättade anteckningar. Paketets dokumentation mappar varje dataelement mot FHIR-resurser, och journalhandlingarna ligger skilda från åtkomstloggen, som inte är en journalhandling.',
    expert: 'Systemet avskiljer journalhandlingar från övriga handlingar och skriver mappningen i paketet, så att arkivarien inte behöver känna till datamodellen.',
    anmarkning: 'Mappningen mot ett visst e-arkivs dataelement, till exempel R7e-arkivet, är inte gjord, och ingen informationstypsspecifik FGS för journaler är använd.',
  },
  {
    id: '5.4.2.4', kategori: 'system', egna: ['L1'], avsedd: 'delvis',
    tester: [
      `${A}gallring tar bara journaler vars sista uppgift är äldre än tio år, och loggen är oförändrad och hel`,
      `${A}beslut, export, gallring och radering kräver arkivarierollen, och nekade försök loggas`,
    ],
    losning: 'Gallring efter ett registrerat gallringsbeslut: systemet tar fram de journaler vars sista uppgift är äldre än tio år (patientdatalagen 3 kap. 17 §) och som inte har någon pågående kontakt, arkivarien ser underlaget och verkställer. Gallringen loggas med beslutets id och antal poster, och åtkomstloggen ändras inte.',
    expert: 'Systemet räknar fram underlaget ur regeln och journalens sista uppgift, så att ingen behöver leta fram journaler eller kunna bevarandetiderna.',
    anmarkning: 'Gallringsregeln är en enda regel i koden (tio år efter sista uppgiften). Regionens egna gallringsbeslut per informationsmängd går inte att konfigurera i gränssnittet.',
  },
]);
