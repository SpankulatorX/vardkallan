// Sussa 5.4.2 Grundläggande behov: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r5: inloggning med biljett, skyddsbehov, signering, certifikat, e-arkiv, gallring och miljöer (sussa/runda9-r5.js).
import { medR9r5 } from '../runda9-r5.js';
const A = 'Arkiv > ';
// Runda 14, r4.
const MA = 'Mellanarkiv > ';

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
    anmarkning: 'Ingen överföring till ett verkligt e-arkiv, och paketet är inte prövat mot en leveransöverenskommelse. XML-schemana för METS ligger i mappen schemas, och paketet är prövat med E-ARK:s validator med öppen källkod (commons-ip 2.12.1 mot CSIP 2.1.0) utan fel (docs/earkiv-validering.md).',
  },
  // Runda 14, r4: mellanarkivet med integrerad åtkomst från journalen (mellanarkiv.js).
  {
    id: '5.4.2.2', kategori: 'system', egna: ['M12'], avsedd: 'uppfyllt_demo',
    tester: [
      `${MA}mellanarkivet har tagit emot ett FGS-paket med äldre uppgifter ur VAS, och mottagningskontrollen är utan fel`,
      `${MA}journalen visar handlingarna med samma behörighet: egen vårdenhet direkt och andra vårdenheter efter ett aktivt val`,
      `${MA}yrkesrollen styr vad som visas: inre sekretess för journal och omvårdnad som i journalen`,
      `${MA}en spärrad vårdenhet syns inte, svaret är detsamma med och utan den dolda handlingen, och med samtycke syns den`,
      `${MA}utan vårdrelation är en handling som en som inte finns, och det nekade försöket loggas`,
      `${MA}varje läsning loggas med handlingens id, innehållet är kontrollerat oförändrat, och handlingarna går inte att ändra eller radera`,
      `${MA}arkivarien registrerar ett beslut, systemet tar fram underlaget och för över äldre handlingar, som sedan visas i journalen som förut`,
      `${MA}mellanarkivet avvisar ett paket med fel, och då förs ingenting över`,
      `${MA}tidslinjen och sökningen i journalen tar med handlingarna, märkta Ur mellanarkivet`,
      `${MA}handlingarna följer journalen vid en sammanslagning och raderas med hela journalen efter ett beslut om förstöring`,
    ],
    losning: 'Arkivarien registrerar ett beslut om överföring till mellanarkiv. Systemet tar fram signerade anteckningar som inte har rättats och mätvärden som är äldre än fem år och som inget annat i journalen pekar på, bygger ett FGS-paket per journal som exporten till e-arkivet, och mellanarkivet gör samma mottagningskontroll som e-arkivet innan något förs över. Handlingarna tas bort ur den aktiva journalen först när mellanarkivet har tagit emot dem, i samma transaktion. I journalen står anteckningarna i listan bland de andra, märkta Ur mellanarkivet, mätvärdena och anteckningarna i översiktens tidslinje, och texten är sökbar i journalens sökfält. Allt prövas av behörighetsmotorn på vårdenheten där handlingen skrevs, med inre sekretess, aktivt val, spärrar som de gäller i dag, skyddad identitet och undantag från visning, och varje läsning loggas. Uppgifterna i mellanarkivet ändras aldrig, och varje handling kontrolleras mot sin SHA-256 när den läses.',
    expert: 'Den som arbetar i journalen behöver inte veta att mellanarkivet finns: systemet hämtar handlingarna dit där de andra finns och märker dem. Arkivarien registrerar bara beslutet, och systemet räknar fram vad som ska föras över och kontrollerar paketet.',
    anmarkning: 'Mellanarkivet är lokalt i demon och simulerat, och ingen koppling till ett verkligt mellanarkiv är gjord. Regeln är en regel i koden (fem år), och ordinationer, diagnoser och vårdkontakter stannar i den aktiva journalen eftersom läkemedelslistan, basfakta och ekonomin använder dem. FHIR-API:t och läskopian vid avbrott lämnar inte ut handlingar ur mellanarkivet. I demon fördes Gunnar Åkessons äldre uppgifter ur VAS dit vid migreringen.',
  },
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
