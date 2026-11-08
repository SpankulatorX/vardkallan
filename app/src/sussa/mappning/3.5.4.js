// Sussa 3.5.4 Förbrukningsartiklar: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
// Runda 9, r1: förbrukningsartiklar (app/src/forbrukning.js och app/test/forbrukning.test.js).
const FB = 'Förbrukningsartiklar > ';
const T = {
  mall: `${FB}mall för den som tar insulin med penna: systemet föreslår pennkanyler, teststickor, lansetter och kanylburk med mängd ur läkemedelslistan och tar bort det som redan är förskrivet`,
  livscykel: `${FB}ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL`,
  kontroller: `${FB}kontroller: en dubbelförskrivning stoppas med förslag om förnyelse, en stor mängd kräver motivering och en artikel som inte passar listan ger en observation`,
  extern: `${FB}en förskrivning från en annan förskrivare registreras med vem och när, utan att skickas till NLL`,
  presentation: `${FB}presentation: filtrering på grupp, sortering och uppföljning med vem och när`,
  behorighet: `${FB}behörighet: undersköterskan och nödåtkomst förskriver inte, en annan vårdenhet ändrar inte, och en spärrad vårdenhets förskrivning röjs inte`,
  api: `${FB}API: lista, mall, ändring, förnyelse, utsättning och återinsättning med loggning, och sjuksköterskan förskriver`,
  klick: 'Gränssnitt > Klickbudget > Förskriva förbrukningsartiklar ur en mall inom budget',
};
const DEMO = 'Artiklarna och varunumren är påhittade demoposter, och mängderna, mallarna och att sjuksköterskor förskriver utan särskild behörighet är demoregler. NLL är simulerad.';

export default [
  { id: '3.5.4.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.presentation, T.livscykel, T.behorighet],
    losning: 'Förbrukningsartiklarna visas i läkemedelsfliken i egna tabeller för giltiga, utgångna och utsatta förskrivningar, med artikel, mängd, uttag, giltighet, NLL-status, uppföljning och vem som förskrev, och historik per förskrivning.',
    expert: 'Systemet delar själv upp förskrivningarna efter giltighet och föreslår vid listan det som patienten behöver men inte har, så att användaren ser helheten utan att leta.',
    anmarkning: DEMO },
  { id: '3.5.4.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.livscykel, T.kontroller, T.behorighet, T.api],
    losning: 'Förskrivning, förnyelse, återinsättning, utsättning och ändring av förbrukningsartiklar i en egen förskrivning per artikel, med historik och överföring till den simulerade NLL. Läkaren och sjuksköterskan förskriver med vårdrelation på sin vårdenhet, och en förskrivning ändras bara där den gjordes.',
    expert: 'Systemet fyller i mängd, uttag, anvisning, giltighet och uppföljning, stoppar en dubbelförskrivning och föreslår förnyelse i stället, och kräver en orsak när en artikel sätts ut eller in igen.',
    anmarkning: DEMO },
  { id: '3.5.4.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.presentation, T.livscykel],
    losning: 'Varje förskrivning visas med sin historik: förskriven, ändrad, förnyad, utsatt och insatt igen, med vem, vilken vårdenhet och när. Listan filtreras på grupp och sorteras på giltighet, artikel eller uppföljning, och uppföljningen visar datum och ansvarig.',
    expert: 'Systemet sätter uppföljningen en månad före giltighetens slut med förskrivaren som ansvarig, så att det syns vem som följer upp och när utan att någon behöver ange det.',
    anmarkning: DEMO },
  { id: '3.5.4.4', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [T.mall, T.livscykel, T.kontroller, T.extern, T.klick],
    losning: 'Artiklar för egenkontroll av medicinering (teststickor och lansetter), för tillförsel av läkemedel (pennkanyler, insulinsprutor och kanylburk) och vid stomi (påsar, plattor och hudskydd). Mallar med flera förskrivningar föreslås ur läkemedelslistan och diagnoserna, och en förskrivning från en annan förskrivare registreras med vem och när.',
    expert: 'Systemet föreslår mallen som passar patienten, räknar mängden för tre månader ur behandlingen, till exempel antalet injektioner per dygn, tar bort det som redan är förskrivet och varnar för en mängd som är större än behovet och för en artikel som inte passar läkemedelslistan eller diagnoserna.',
    anmarkning: DEMO },
  { id: '3.5.4.5', kategori: 'nationell', egna: [], tester: [], avsedd: 'planerat',
    anmarkning: 'Makulering av förskrivning med kvarvarande uttag kräver anslutning till e-hälsomyndighetens tjänster och är inte byggd.' },
];
