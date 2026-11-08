// Runda 10, r3: röstinmatningens regler (Sussa 3.1.3.2 och 3.1.3.7). Gemensam för gränssnittet och testerna på servern.
// Taligenkänningen ger text, och här avgörs vad texten betyder: vanliga ord blir text i det sökord som dikteras, och
// röstkommandon blir skiljetecken, ny rad, byte av sökord, ångra och avsluta. Systemet sätter stor bokstav i början av
// varje mening och mellanslag efter skiljetecken, så att den som dikterar bara behöver tala.
//
// Signering och andra beslut görs aldrig med rösten. Den som säger signera får veta att signeringen görs med knappen,
// efter att texten är läst, så att inget som taligenkänningen har hört fel blir journal utan att någon har läst det.

export const SKILJETECKEN = { punkt: '.', kommatecken: ',', frågetecken: '?', utropstecken: '!', kolon: ':', 'ny rad': '\n', 'nytt stycke': '\n\n' };
export const KOMMANDON = [
  { fras: 'punkt, kommatecken, frågetecken, kolon', gor: 'skriver skiljetecknet' },
  { fras: 'ny rad, nytt stycke', gor: 'börjar en ny rad eller ett nytt stycke' },
  { fras: 'nästa sökord, föregående sökord', gor: 'flyttar till nästa eller föregående sökord' },
  { fras: 'gå till och sökordets namn, till exempel gå till bedömning', gor: 'flyttar till sökordet' },
  { fras: 'ångra', gor: 'tar bort det som dikterades senast' },
  { fras: 'sluta diktera', gor: 'avslutar dikteringen' },
];
const FRASER = [
  ['nästa sökord', { kommando: 'nasta' }], ['nästa fält', { kommando: 'nasta' }],
  ['föregående sökord', { kommando: 'foregaende' }], ['föregående fält', { kommando: 'foregaende' }],
  ['ångra', { kommando: 'angra' }], ['radera senaste', { kommando: 'angra' }],
  ['sluta diktera', { kommando: 'sluta' }], ['avsluta diktering', { kommando: 'sluta' }], ['avsluta dikteringen', { kommando: 'sluta' }], ['sluta lyssna', { kommando: 'sluta' }],
  ['signera anteckningen', { kommando: 'signera' }], ['signera', { kommando: 'signera' }],
  ...Object.entries(SKILJETECKEN).map(([f, t]) => [f, { tecken: t }]),
].sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);
export const SIGNERA_TEXT = 'Signeringen görs med knappen Signera, när du har läst texten. Rösten kan inte signera, så att inget som taligenkänningen har hört fel blir journal utan att någon har läst det.';

const lagsta = (s) => s.toLocaleLowerCase('sv-SE');
const skiljetecken = new Set(Object.values(SKILJETECKEN));

// Delar upp det som sades i text och kommandon. sokord är sökordens namn, så att gå till och namnet hittar rätt.
export function tolka(transkript, { sokord = [] } = {}) {
  const ord = String(transkript ?? '').trim().split(/\s+/).filter(Boolean);
  const ut = [];
  let text = [];
  const avsluta = () => { if (text.length) ut.push({ typ: 'text', ord: text }); text = []; };
  for (let i = 0; i < ord.length;) {
    const rest = ord.slice(i).map(o => lagsta(o.replace(/[.,!?:]+$/, '')));
    if (rest[0] === 'gå' && rest[1] === 'till') {
      const traff = [...sokord].sort((a, b) => b.length - a.length).find(s => { const d = lagsta(s).split(/[\s/]+/); return d.every((x, j) => rest[2 + j] === x); });
      if (traff) { avsluta(); ut.push({ typ: 'kommando', kommando: 'ga_till', sokord: traff }); i += 2 + traff.split(/[\s/]+/).length; continue; }
    }
    const fras = FRASER.find(([f]) => f.split(' ').every((x, j) => rest[j] === x));
    if (fras) {
      const n = fras[0].split(' ').length;
      if (fras[1].tecken) text.push(fras[1].tecken);
      else { avsluta(); ut.push({ typ: 'kommando', kommando: fras[1].kommando, ...(fras[1].kommando === 'signera' ? { text: SIGNERA_TEXT } : {}) }); }
      i += n;
      continue;
    }
    text.push(ord[i]);
    i++;
  }
  avsluta();
  return ut;
}

// Lägger till dikterade ord efter den text som redan står i fältet, med mellanslag och stor bokstav där de hör hemma.
export function skriv(befintlig, ord) {
  let s = String(befintlig ?? '');
  for (const o of ord) {
    if (skiljetecken.has(o)) {
      s = s.replace(/[ \t]+$/, '');
      if (o.startsWith('\n')) s += o;
      else if (s && !/[.,!?:]$/.test(s)) s += o;
      continue;
    }
    const borjan = !s.trim() || /[.!?]\s*$/.test(s) || /\n\s*$/.test(s);
    const mellan = s && !/\s$/.test(s) ? ' ' : '';
    s += mellan + (borjan ? o.charAt(0).toLocaleUpperCase('sv-SE') + o.slice(1) : o);
  }
  return s;
}
