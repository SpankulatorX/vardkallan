// Påhittad personal. demo: true betyder att personen går att logga in som i demon.
// yrke: lakare | sjukskoterska | underskoterska | vardadministrator | logggranskare
export const YRKEN = {
  lakare: 'Läkare',
  sjukskoterska: 'Sjuksköterska',
  underskoterska: 'Undersköterska',
  vardadministrator: 'Vårdadministratör',
  logggranskare: 'Logggranskare',
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
];
