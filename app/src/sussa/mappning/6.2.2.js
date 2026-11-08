// Sussa 6.2.2 Folkhälsa (Population Health Management): hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
const L = 'Levnadsvanor > ';
const F = 'Folkhälsa > ';

export default [
  { id: '6.2.2.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${L}systemet räknar risken för alkohol, fysisk aktivitet och matvanor och föreslår stöd med KVÅ-kod`,
      `${L}anteckningen får text som systemet skriver, och samtalet registreras som åtgärd när den signeras`,
      `${F}en insats startar med en riskgrupp ur patientgrupperingen och följer utfallet mot målet`,
      `${F}patientlistan i en insats prövar varje patient i behörighetsmotorn, och en patient utan åtkomst syns inte alls`,
      `${F}rekommendationen syns i patientens översikt för den som kan ge stödet`,
      `${F}insatserna följer behörigheten: kardiologen ser inte vårdcentralens insats, och uppföljningen ser bara antal`,
      'Patientgruppering > uppföljningen får gruppen som antal för hela vårdgivaren, med små grupper dolda och utan personuppgifter',
    ],
    losning: 'Arbetsprocessen i figur 5: levnadsvanorna alkohol, fysisk aktivitet och matvanor dokumenteras strukturerat i anteckningstypen Levnadsvanor, som tobaksvanorna (datainsamling). Systemet räknar risken per levnadsvana och översätter allt till patientgrupperingens villkor (databehandling). En folkhälsoinsats startar med en riskgrupp ur patientgrupperingen (befolkningsanalys). För varje patient i gruppen föreslår systemet stödet med KVÅ-kod, i patientens översikt och i insatsens lista (rekommendationer och notifieringar). Insatsen följer andelen som har fått stöd och andelen utan risk vid den senaste dokumentationen mot målet, och uppföljningen ser alla insatser som antal (uppföljning).',
    expert: 'Den som dokumenterar svarar bara på frågorna. Systemet räknar risken, föreslår stödet enligt Socialstyrelsens riktlinjer, sätter KVÅ-koden när samtalet har hållits, skriver anteckningens text, väljer riskgruppen och föreslår namn, mål och datum för utvärderingen av insatsen.',
    anmarkning: 'Gränserna för riskbruk, otillräcklig fysisk aktivitet och ohälsosamma matvanor och poängen för matvanorna är demoregler med riktlinjernas definitioner som förebild. Externa datakällor, befolkningsdata utöver listningen och notifieringar till invånare och anhöriga är inte byggda. Prediktion och riskstratifiering med modeller är inte byggda.',
  },
];
