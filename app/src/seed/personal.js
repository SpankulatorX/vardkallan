// Påhittad personal. demo: true betyder att personen går att logga in som i demon.
// yrke: lakare | sjukskoterska | underskoterska | vardadministrator | logggranskare
export const YRKEN = {
  lakare: 'Läkare',
  sjukskoterska: 'Sjuksköterska',
  underskoterska: 'Undersköterska',
  vardadministrator: 'Vårdadministratör',
  logggranskare: 'Logggranskare',
  // Arkiv och uppföljning (Sussa 5.4.2, 5.3.1.7 och 6.3.1). Egna roller, som inte läser journalen.
  arkivarie: 'Arkivarie',
  uppfoljning: 'Analytiker (uppföljning)',
  // Runda 6, r3: kommunens personal i samordnad planering. Kommunen är en simulerad part i demon.
  kommun: 'Kommunens personal (simulerad)',
  // Fördjupad läkemedelsgenomgång (runda 6, r2, HSLF-FS 2017:37 11 kap.).
  farmaceut: 'Farmaceut',
  // Runda 6, r6: verksamhetschefen utser uppdragen i läkemedelshanteringen och läser inte journalen.
  verksamhetschef: 'Verksamhetschef',
  // Runda 7, r3: ekonomen tar fram faktureringsunderlag och sköter prislistorna, och läser inte journalen.
  ekonom: 'Ekonom',
  // Runda 7, r4: systemförvaltaren konfigurerar regler och parametrar, förbereder omorganisationer, beslutar om
  // undantag från visning och publicering och följer upp lagringen. Läser inte journalen (Sussa 12.1 och KD1.1.3).
  systemforvaltare: 'Systemförvaltare',
};

export const PERSONAL = [
  { id: 'lak-kard', namn: 'Sara Lindqvist', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-kard', demo: true },
  { id: 'ssk-kard', namn: 'Johan Ek', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'uso-kard-72', demo: true },
  { id: 'usk-kard', namn: 'Amira Haddad', yrke: 'underskoterska', titel: 'Undersköterska', enhet: 'uso-kard-72', demo: true },
  { id: 'lak-akut', namn: 'Erik Nyström', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-akut', demo: true },
  { id: 'lak-vc', namn: 'Per Holm', yrke: 'lakare', titel: 'Läkare (distriktsläkare)', enhet: 'vc-tybble', demo: true },
  { id: 'lak-psyk', namn: 'Lena Ström', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-psyk', demo: true },
  { id: 'adm-kard', namn: 'Karin Berg', yrke: 'vardadministrator', titel: 'Vårdadministratör', enhet: 'uso-kard', demo: true },
  { id: 'logg', namn: 'Mats Wall', yrke: 'logggranskare', titel: 'Logggranskare (informationssäkerhet)', enhet: 'rk', demo: true },

  // Övrig personal som har skrivit i journalerna.
  { id: 'ssk-akut', namn: 'Maria Lundgren', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'uso-akut' },
  { id: 'lak-med', namn: 'Anders Wikström', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-med' },
  { id: 'lak-inf', namn: 'Nadia Karimi', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-inf' },
  { id: 'ssk-inf', namn: 'Viktor Engström', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'uso-inf' },
  { id: 'lak-ort', namn: 'Henrik Dahlgren', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-ort' },
  { id: 'lak-kkoga', namn: 'Ingrid Moberg', yrke: 'lakare', titel: 'Läkare', enhet: 'kkoga-ort' },
  { id: 'ssk-kkoga', namn: 'Tove Ahlström', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'kkoga-ort' },
  { id: 'lak-lind', namn: 'Olof Granberg', yrke: 'lakare', titel: 'Läkare', enhet: 'lind-med' },
  { id: 'ssk-lind', namn: 'Sanna Björk', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'lind-med' },
  { id: 'lak-kumla', namn: 'Eva Sjöberg', yrke: 'lakare', titel: 'Läkare (distriktsläkare)', enhet: 'vc-kumla' },
  { id: 'ssk-vc', namn: 'Hanna Lilja', yrke: 'sjukskoterska', titel: 'Sjuksköterska (astma- och KOL-sjuksköterska)', enhet: 'vc-tybble' },
  { id: 'ssk-psyk', namn: 'Robin Axelsson', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'uso-psyk' },
  { id: 'lak-vas', namn: 'Bengt Rydén', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-med', aktiv: false },
  { id: 'lak-cosmic', namn: 'Kristina Ljung', yrke: 'lakare', titel: 'Läkare', enhet: 'uso-kard', aktiv: false },
  // Arkiv och uppföljning (Sussa 5.4.2, 5.3.1.7 och 6.3.1). Sist i listan, så att de andras HSA-id inte ändras.
  { id: 'ark', namn: 'Ingela Nord', yrke: 'arkivarie', titel: 'Arkivarie (e-arkiv och gallring)', enhet: 'rk', demo: true },
  { id: 'uppf', namn: 'Daniel Sund', yrke: 'uppfoljning', titel: 'Analytiker (uppföljning och statistik)', enhet: 'rk', demo: true },
  // Kontrasignering (Sussa 3.1.11.3): en underläkare som ber om kontrasignering och en överläkare som systemet föreslår.
  { id: 'ul-kard', namn: 'Alva Berglund', yrke: 'lakare', titel: 'Underläkare', enhet: 'uso-kard' },
  { id: 'ol-kard', namn: 'Göran Malm', yrke: 'lakare', titel: 'Överläkare', enhet: 'uso-kard' },
  // Runda 6, r3: kommunens biståndshandläggare i samordnad planering, en simulerad part (enheten kommun-demo läggs in av
  // samordnad.js). Sist i listan, så att de andras HSA-id inte ändras.
  { id: 'kom-bist', namn: 'Lisa Ahlgren', yrke: 'kommun', titel: 'Biståndshandläggare (simulerad kommun)', enhet: 'kommun-demo', demo: true },
  // Fördjupad läkemedelsgenomgång (runda 6, r2): en klinisk farmaceut på kardiologen.
  { id: 'far-kard', namn: 'Elsa Nordin', yrke: 'farmaceut', titel: 'Klinisk apotekare', enhet: 'uso-kard', demo: true },
  // Runda 6, r6: verksamhetschefen på kardiologen, som utser uppdragen i läkemedelshanteringen (Gröna häftet 1.3 och 1.4).
  // r6: true betyder att personen läggs in också i en sandlåda från före runda 6, r6 (lakemedelsansvar-schema.js).
  { id: 'vch-kard', namn: 'Ulrika Sandell', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-kard', demo: true, r6: true },
  // En sjuksköterska på hjärtintensiven som systemet föreslår som reservkontrollant för narkotikaförbrukningen.
  { id: 'ssk-hia', namn: 'Petra Nyberg', yrke: 'sjukskoterska', titel: 'Sjuksköterska', enhet: 'uso-kard-hia', r6: true },
  // Runda 7, r3: ekonomen på regionkansliet, som exporterar faktureringsunderlag och sköter prislistorna (Sussa 7.1).
  // r7: true betyder att personen läggs in också i en sandlåda från före runda 7 (ekonomi-schema.js).
  { id: 'eko', namn: 'Fredrik Alm', yrke: 'ekonom', titel: 'Ekonom (vårdfakturering)', enhet: 'rk', demo: true, r7: true },
  // Runda 7, r4: systemförvaltningen på regionkansliet (Sussa 12.1). En ändring av regler och parametrar godkänns av en
  // annan systemförvaltare än den som föreslog den (fyra ögon), så det finns två, och båda går att logga in som.
  // r7: true betyder att personen läggs in också i en sandlåda från före runda 7 (systemforvaltning-schema.js).
  { id: 'sysf', namn: 'Tomas Lindh', yrke: 'systemforvaltare', titel: 'Systemförvaltare (applikationskonfiguration)', enhet: 'rk', demo: true, r7: true },
  { id: 'sysf-2', namn: 'Nora Ekholm', yrke: 'systemforvaltare', titel: 'Systemförvaltare', enhet: 'rk', demo: true, r7: true },
];
