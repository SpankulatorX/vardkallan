// Prognos för lagringens volym ur tillväxten (runda 12, r2, Sussa KD1.1.3.5). Systemet räknar hur många rader som har
// tillkommit per månad i varje tabell med en tidskolumn, och skriver fram databasens storlek och kopiornas storlek ett,
// tre och tio år framåt, både med dagens tillväxt och om aktiviteten fördubblas. Med lagringsklasserna (migrering 2 i
// releaser.js) räknar det också hur mycket som hör till lagringen för äldre uppgifter och vad lagringen kostar per månad.
// Bara antal och storlekar, inga patientuppgifter.

const TIDSKOLUMNER = ['skapad', 'registrerad', 'tid', 'start', 'datum'];
const DAG = 86400_000;
const AR = 365.25 * DAG;

const tabeller = (db) => db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
const kolumner = (db, t) => db.query(`PRAGMA table_info("${t}")`).all().map(k => k.name);

// Den första tidskolumnen i tabellen, eller null.
const tidskolumn = (db, t) => TIDSKOLUMNER.find(c => kolumner(db, t).includes(c)) ?? null;

export function prognos(db, { nu = new Date(), behallKopior = 48 } = {}) {
  const byte = db.query('PRAGMA page_count').get().page_count * db.query('PRAGMA page_size').get().page_size;
  const per = [];
  let rader = 0;
  for (const t of tabeller(db)) {
    const n = db.query(`SELECT count(*) AS n FROM "${t}"`).get().n;
    rader += n;
    const c = tidskolumn(db, t);
    if (!c || !n) continue;
    // Rader från det senaste året (inte framtida, som bokade tider), och rader äldre än tre år.
    const ar = db.query(`SELECT count(*) AS n FROM "${t}" WHERE "${c}" > ? AND "${c}" <= ?`).get(new Date(nu.getTime() - AR).toISOString(), nu.toISOString()).n;
    per.push({ tabell: t, kolumn: c, rader: n, senasteAret: ar });
  }
  const snitt = rader ? byte / rader : 0;
  const tillvaxtRader = per.reduce((s, x) => s + x.senasteAret, 0);
  const tillvaxtByte = Math.round(tillvaxtRader * snitt);
  const fram = (ar, faktor = 1) => Math.round(byte + ar * tillvaxtByte * faktor);
  const scenarier = [1, 3, 10].map(ar => ({ ar, byte: fram(ar), byteFordubblad: fram(ar, 2), kopiorByte: fram(ar) * 2 }));

  // Lagringsklasserna: hur mycket som är äldre än gränsen för flytt, och vad lagringen kostar per månad.
  let klasser = null;
  if (db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'lagringsklasser'").get()) {
    const lista = db.query('SELECT * FROM lagringsklasser ORDER BY svarstid_ms').all();
    const aldre = lista.find(k => k.flytt_efter_ar != null);
    let aldreRader = 0;
    if (aldre) {
      const grans = new Date(nu.getTime() - aldre.flytt_efter_ar * AR).toISOString();
      for (const x of per) aldreRader += db.query(`SELECT count(*) AS n FROM "${x.tabell}" WHERE "${x.kolumn}" <= ?`).get(grans).n;
    }
    const aldreByte = Math.round(aldreRader * snitt);
    const kr = (b, k) => (b / 1024 ** 3) * k.kr_per_gb_manad;
    klasser = lista.map(k => {
      const b = k.flytt_efter_ar != null ? aldreByte : byte - aldreByte;
      return { id: k.id, namn: k.namn, kvalitet: k.kvalitet, svarstidMs: k.svarstid_ms, krPerGbManad: k.kr_per_gb_manad, flyttEfterAr: k.flytt_efter_ar, byte: b, krPerManad: kr(b, k) };
    });
    const allaAktuell = lista.find(k => k.flytt_efter_ar == null);
    if (allaAktuell) {
      const utanKlasser = kr(byte, allaAktuell);
      const medKlasser = klasser.reduce((s, k) => s + k.krPerManad, 0);
      klasser = { lista: klasser, krPerManad: medKlasser, krPerManadUtanKlasser: utanKlasser };
    } else klasser = { lista: klasser, krPerManad: klasser.reduce((s, k) => s + k.krPerManad, 0), krPerManadUtanKlasser: null };
  }

  return {
    tid: nu.toISOString(), byte, rader, snittBytePerRad: Math.round(snitt),
    tillvaxt: { rader: tillvaxtRader, byte: tillvaxtByte, procent: byte ? Math.round((tillvaxtByte / byte) * 1000) / 10 : 0 },
    kopior: { antal: behallKopior, platser: 2 },
    scenarier, klasser,
    storstaTillvaxt: [...per].sort((a, b) => b.senasteAret - a.senasteAret).slice(0, 6),
    metod: 'Tillväxten är antalet rader som har tillkommit det senaste året i varje tabell med en tidskolumn, gånger databasens genomsnittliga storlek per rad. Prognosen skriver fram den linjärt, och scenariot med fördubblad aktivitet visar hur lagringen klarar kraftigt ökade mängder. Kopiorna finns på två platser.',
  };
}
