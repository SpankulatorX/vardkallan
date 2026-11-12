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
  // Runda 7, r1: paramedicinare i Sussas användbarhetstester.
  fysioterapeut: 'Fysioterapeut',
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
  // Runda 7, r6: distriktssköterskan på Vårdcentralen Tybble är demoroll och har ett uppdrag på Barnavårdscentralen
  // Tybble (bhv.js), så att en sjuksköterska gör flödet i barnhälsovården.
  { id: 'ssk-vc', namn: 'Hanna Lilja', yrke: 'sjukskoterska', titel: 'Distriktssköterska', enhet: 'vc-tybble', demo: true },
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
  // Runda 7, r1: en fysioterapeut på kardiologiska mottagningen (hjärtrehabilitering), som spelar paramedicinaren i Sussas
  // testfall. Sist i listan, så att de andras HSA-id inte ändras.
  { id: 'fys-kard', namn: 'Jenny Holmberg', yrke: 'fysioterapeut', titel: 'Fysioterapeut (hjärtrehabilitering)', enhet: 'uso-kard-mott', demo: true },
  // Runda 9, r3: barnmorskan och läkaren på kvinnoklinikens förlossning (obstetrik.js). Barnmorskan har sjuksköterskans
  // behörigheter i demon. Runda 11, r3: barnmorskan går att logga in som (förlossningen och BB), läkaren inte.
  { id: 'bm-uso', namn: 'Sofia Ekdahl', yrke: 'sjukskoterska', titel: 'Barnmorska', enhet: 'uso-kk-forl', demo: true },
  { id: 'lak-kk', namn: 'Johanna Rehn', yrke: 'lakare', titel: 'Läkare (obstetrik)', enhet: 'uso-kk' },
  // Runda 11, r2: operationsplaneringen och anestesin (operation.js och anestesijournal.js). Operationskoordinatorn på
  // Ortopediska kliniken Karlskoga lasarett går att logga in som. Anestesiläkaren och anestesisjuksköterskan arbetar på
  // anestesienheten på sjukhuset och planeras in i teamet av systemet. Titeln avgör rollen i teamet. Anestesiläkaren i
  // Karlskoga går också att logga in som, för de beställda anestesibedömningarna.
  { id: 'opk-kkoga', namn: 'Therese Hedberg', yrke: 'sjukskoterska', titel: 'Operationskoordinator (operationssjuksköterska)', enhet: 'kkoga-ort', demo: true },
  { id: 'lak-ane-kkoga', namn: 'Martin Ödman', yrke: 'lakare', titel: 'Anestesiläkare', enhet: 'kkoga-ane', demo: true },
  { id: 'ssk-ane-kkoga', namn: 'Kajsa Strand', yrke: 'sjukskoterska', titel: 'Anestesisjuksköterska', enhet: 'kkoga-ane' },
  { id: 'lak-ane-ort', namn: 'Gustav Fernlund', yrke: 'lakare', titel: 'Anestesiläkare', enhet: 'uso-ane' },
  { id: 'ssk-ane-ort', namn: 'Ida Wedin', yrke: 'sjukskoterska', titel: 'Anestesisjuksköterska', enhet: 'uso-ane' },
  // Runda 11, r4: farmaceuten på cytostatikaberedningen, som bereder kurerna med batch och kontrollmätning, sköter lagret
  // och följer en batch till patienterna (cytostatika-beredning.js). Går att logga in som. Sist, så att de andras HSA-id
  // inte ändras.
  { id: 'far-bered', namn: 'Mona Fredin', yrke: 'farmaceut', titel: 'Farmaceut, cytostatikaberedningen', enhet: 'uso-bered', demo: true },
  // Runda 11, r4: Onkologiska kliniken USÖ. Onkologen och onkologisjuksköterskan går att logga in som, så att kuren kan
  // ges med dubbelkontroll i två inloggningar på samma vårdenhet. Överläkaren är den andra regimansvariga läkaren, och
  // verksamhetschefen utser de regimansvariga. Sist, så att de andras HSA-id inte ändras.
  { id: 'lak-onk', namn: 'Rebecka Ståhl', yrke: 'lakare', titel: 'Läkare (onkologi)', enhet: 'uso-onk', demo: true },
  { id: 'ssk-onk', namn: 'Elias Wickman', yrke: 'sjukskoterska', titel: 'Onkologisjuksköterska', enhet: 'uso-onk-dag', demo: true },
  { id: 'ol-onk', namn: 'Gunilla Norén', yrke: 'lakare', titel: 'Överläkare (onkologi)', enhet: 'uso-onk' },
  { id: 'vch-onk', namn: 'Peter Söderholm', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-onk' },
  // Runda 11, r6: röntgensjuksköterskan på röntgenkliniken tar emot, prioriterar och bokar beställda undersökningar och
  // registrerar att de är gjorda (undersokningar.js). Hon läser inte journalen utan vårdrelation.
  { id: 'rtg-ssk', namn: 'Linnea Forsman', yrke: 'sjukskoterska', titel: 'Röntgensjuksköterska', enhet: 'uso-rtg', demo: true },
  // Runda 13, r3 (E3-35): en verksamhetschef för varje vårdenhet i verksamhetschefstabellen, så att gallring och radering
  // går att godkänna för varje vårdenhet. Påhittade namn som inte går att logga in som. Sist, så att de andras HSA-id
  // inte ändras.
  { id: 'chef-kkoga-ane', namn: 'Annika Holmgren', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'kkoga-ane' },
  { id: 'chef-kkoga-ort', namn: 'Stefan Lundell', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'kkoga-ort' },
  { id: 'chef-lind-med', namn: 'Margareta Wiklund', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'lind-med' },
  { id: 'chef-uso-akut', namn: 'Henrik Sjöblom', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-akut' },
  { id: 'chef-uso-ane', namn: 'Cecilia Brandt', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-ane' },
  { id: 'chef-uso-inf', namn: 'Mikael Ekdahl', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-inf' },
  { id: 'chef-uso-kk', namn: 'Louise Bergqvist', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-kk' },
  { id: 'chef-uso-med', namn: 'Tomas Rehnberg', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-med' },
  { id: 'chef-uso-ort', namn: 'Jenny Sandström', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-ort' },
  { id: 'chef-uso-psyk', namn: 'Daniel Forsberg', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-psyk' },
  { id: 'chef-uso-rtg', namn: 'Helena Ottosson', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'uso-rtg' },
  { id: 'chef-vc-kumla', namn: 'Kristina Alm', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'vc-kumla' },
  { id: 'chef-vc-tybble', namn: 'Peter Nordqvist', yrke: 'verksamhetschef', titel: 'Verksamhetschef', enhet: 'vc-tybble' },
];
