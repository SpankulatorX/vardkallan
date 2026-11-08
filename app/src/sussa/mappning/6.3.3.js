// Sussa 6.3.3 Datauttag för forskningsändamål: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
const F = 'Forskningsuttag > ';

export default [
  { id: '6.3.3.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${F}beställningen får diarienummer, etikprövningen kontrolleras och urvalet hämtas ur datauttaget`,
      `${F}två andra personer godkänner, den som registrerade kan inte, och utlämnandet loggas och kan inte ändras`,
      `${F}en avslagen beställning kan inte lämnas ut, och roller utan behörighet nekas`,
      `${F}verksamhetschefen godkänner bara för sin egen vårdenhet, och uttaget får bara med vårdenheter som har godkänt`,
    ],
    losning: 'Sidan Forskningsuttag. Uppföljningsrollen registrerar en beställning med forskare, studie, diarienummer för etikprövningen, urval av tabeller och fält ur datauttaget, period och om uttaget är återkommande. Beställningen anger vilka vårdenheter den gäller. Arkivarien gör sekretessprövningen och verksamhetschefen för varje vårdenhet godkänner för sin vårdenhet, och uttaget får bara med uppgifter från vårdenheter som har godkänt. Först med båda godkännandena kan uttaget lämnas ut som NDJSON per tabell med en kontrollsumma, och varje utlämnande sparas och loggas och kan inte ändras eller raderas.',
    expert: 'Systemet ger ärendet diarienummer, kontrollerar etikprövningens diarienummer, tar själv med pseudonymen så att tabellerna går att koppla ihop, lägger aldrig till namn, personnummer eller fritext och räknar pseudonymerna med en nyckel för studien. Det säger vem som ska besluta härnäst och stoppar den som försöker godkänna sin egen beställning.',
    anmarkning: 'Patientens medgivande per uttag, aggregeringar och leverans på annat sätt än som fil är inte byggda. Pseudonymiserade uppgifter är fortfarande personuppgifter.',
  },
];
