// Sussa 4.3 Samordnad individuell plan och samordnad plan för utskrivning: hur Vårdkällan möter posterna i avsnittet.
// Fälten beskrivs i ../index.js. Status räknas fram från testerna vid varje bygge.
const SP = 'Samordnad planering > ';
const SKYDD = [
  `${SP}skyddad identitet: ingen adress skickas och kommunen ser inte namnet`,
  `${SP}kommunen får aldrig adress, namn eller personnummer för en patient med skyddad identitet, inte heller när skyddet tillkommer efter inskrivningsmeddelandet`,
  `${SP}kommunen ser bara det som har skickats till den och når ingen journal`,
];

export default [
  {
    id: '4.3.1.1', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${SP}systemet föreslår SPU och skickar inskrivningsmeddelandet med lagens uppgifter till kommunen och vårdcentralen`,
      `${SP}utskrivningsklar: underrättelsen går ut, kallelsen ska ske inom tre dagar och betalningsansvaret räknas med villkoren`,
      `${SP}SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar`,
      ...SKYDD,
    ],
    losning: 'Samordnad planering vid utskrivning enligt lag (2017:612): inskrivningsmeddelande, ny beräknad tidpunkt, fast vårdkontakt, kommunens planering, utskrivningsklar, kallelse till samordnad individuell planering, individuell plan och informationsöverföring vid utskrivningen. Samordnad individuell plan enligt 16 kap. 4 § HSL och 10 kap. 8 och 9 §§ SoL, och samordnad vårdplan vid öppen tvångsvård enligt 7 a § LPT.',
    expert: 'Systemet föreslår planeringen, fyller i inskrivningsmeddelandet ur journalen, väljer mottagarna, skickar beskeden själv och räknar fristerna med paragraf.',
    anmarkning: 'Kommunen är en simulerad part i demon. Inga meddelanden skickas till en riktig kommun. Sekretessbestämmelserna i offentlighets- och sekretesslagen för uppgifter till kommunen är inte lästa.',
  },
  {
    id: '4.3.1.2', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [
      `${SP}vårdcentralen utser fast vårdkontakt och kallar till samordnad individuell planering`,
      `${SP}SIP kräver samtycke och anger insatser, huvudman och övergripande ansvar`,
      `${SP}informationen förs över när patienten skrivs ut, och en spärrad vårdenhets planering syns inte för andra`,
      ...SKYDD,
    ],
    losning: 'Planeringen delas mellan avdelningen, den vårdcentral där patienten är listad och kommunen, som var och en ser sina uppgifter. Planen anger insatser per huvudman, åtgärder av andra, övergripande ansvar och om patienten och närstående deltog, och kräver patientens samtycke.',
    expert: 'Systemet avgör själv om en samordnad individuell planering behövs, föreslår den fasta vårdkontakten och lägger varje parts nästa steg i dess inkorg eller vy.',
    anmarkning: 'Tidsbokning över huvudmannagränser är inte byggd: kallelsen anger en dag för mötet men bokar ingen tid. Patienten och anhöriga deltar inte digitalt i demon.',
  },
  {
    id: '4.3.1.3', kategori: 'system', egna: [], avsedd: 'uppfyllt_demo',
    tester: [`${SP}uppföljningen av SIP och SPU räknar per vårdenhet utan personuppgifter`],
    losning: 'Uppföljning per vårdenhet: antal planeringar, inskrivningsmeddelanden och kallelser i tid, utskrivningsklara vårddygn, antal planer och hur ofta patienten och närstående deltog, utan namn, personnummer eller id.',
    expert: 'Systemet räknar uppföljningen ur det som redan har registrerats, så ingen behöver föra statistik vid sidan om.',
    anmarkning: 'Kostnaden för utskrivningsklara vårddygn räknas inte, eftersom beloppet bestäms enligt 5 kap. 6 § lag (2017:612) eller i en överenskommelse mellan region och kommun.',
  },
];
