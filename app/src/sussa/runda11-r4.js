// Testerna för cytostatika och blodprodukter i version 1.1 (runda 11, r4), för mappningen av Sussa 4.8 och 4.4.2.12:
// regimbiblioteket, premedicineringen, den kumulativa dosen, beredningsenheten (cytostatika-beredning.js), infusionen,
// patientens uppföljning i Min journal, datauttaget, transfusionen i läkemedelslistan, hemovigilansen och
// blodcentralens vy (test/cytostatika-r11.test.js och test/blod-r11.test.js).
const CY = 'Cytostatika i version 1.1 > ';
const CYAPI = 'Cytostatika i version 1.1 via API > ';
const BL = 'Blodprodukter i version 1.1 > ';
const BLAPI = 'Blodprodukter i version 1.1 via API > ';

export const CYTOSTATIKA_R11 = {
  regimbibliotek: `${CY}regimbiblioteket: en ändrad regim är en ny version som en regimansvarig läkare godkänner i sin egen inloggning, och nya ordinationer får den godkända versionen`,
  premed: `${CY}premedicineringen läggs ut med kuren och ges vid sängen före den första cytostatikadosen`,
  kumulativ: `${CY}kumulativ dos: systemet räknar den kumulativa antracyklindosen per kvadratmeter och stoppar kuren som skulle passera gränsen`,
  kapacitet: `${CY}kapaciteten: beredningsenheten styr hur många kurer den tar emot per dag, och en full dag stoppar godkännandet med första lediga dag`,
  beredning: `${CY}beredningsenheten: arbetslistan visar de godkända kurerna med beräkning och föreslagen batch, och beredningen signeras med batch och kontrollmätt volym`,
  lager: `${CY}lagret: batcher tas emot, utgångna kasseras och systemet säger om lagret räcker till de planerade kurerna`,
  sparbarhet: `${CY}spårbarhet: från en batch till varje patient som har fått den, och från dosen till batchen`,
  sakerhet: `${CY}säkerhet: beredningsenheten ser bara beställningen och aldrig journalen, en farmaceut på en vårdenhet bereder inte, och varje patient i arbetslistan loggas`,
  infusion: `${CY}infusionen: systemet räknar takten, och start, avbrott, ny takt och slut registreras med vem och när`,
  reaktion: `${CY}extravasering och reaktioner: systemet avgör om infusionen fortsätter, pausas eller stoppas och säger vad som ska göras`,
  min: `${CY}Min journal: patienten ser den överlämnade behandlingen och rapporterar intag och mående, och systemet säger när patienten ska ringa`,
  uttag: `${CY}uppföljningen finns i datauttaget med regim, cykel, beredning och batch, och i beredningsenhetens uppföljning, utan personuppgifter`,
  enhet: `${CY}vårdenhetens vy visar kurerna med nästa steg och beredningsenhetens platser, och bara patienter som den inloggade får se`,
  api: `${CYAPI}API: regimen godkänns i två inloggningar, beredningsenheten bereder och avdelningen ger kuren med start och slut`,
};

export const BLOD_R11 = {
  lakemedelslista: `${BL}transfusionen blir en ordination och en administrering i läkemedelslistan, med enhetsnumret och de två som kontrollerade`,
  endaVagen: `${BL}en blodprodukt i läkemedelslistan ges bara från blodbeställningen, aldrig med en vanlig administrering`,
  sangen: `${BL}kontrollen vid sängen går genom den gemensamma transfusionskontrollen: ett bastest som har gått ut sedan blodet bereddes stoppar transfusionen`,
  hemovigilans: `${BL}hemovigilans: en transfusionsreaktion är en egen rapport som systemet klassar, transfusionen stoppas och proverna beställs med ett klick`,
  sakerhet: `${BL}säkerhet: en reaktion eller dess prover för en annan patient eller vårdenhet ges inte, och en spärrad reaktion syns inte i blodcentralens vy`,
  blodcentral: `${BL}blodcentralens vy visar vårdenhetens beställningar i kedjan, enheterna på avdelningen och lagret per blodgrupp, och varje patient loggas`,
  api: `${BLAPI}API: blodcentralens vy, journalens markering och reaktionen rapporteras med proverna i två anrop`,
};

// Klickbudgetens flöden (app/src/klickbudget.js och test/flodessteg.cjs), som följer med i klickbudget.json.
const GK = (namn) => `Gränssnitt > Klickbudget > ${namn} inom budget`;
export const GRANSSNITT_R11R4 = {
  godkann: GK('Godkänna en cytostatikakur'),
  regim: GK('Godkänna en ny version av en cytostatikaregim'),
  blod: GK('Beställa blod'),
  bered: GK('Bereda en cytostatikados på beredningsenheten'),
  min: GK('Rapportera dagens tabletter i Min journal'),
};
