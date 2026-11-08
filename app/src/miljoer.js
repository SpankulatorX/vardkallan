// Runda 9, r5: acceptanstest-, utbildnings- och testmiljö ur en kopia av produktionsmiljön (KD1.1.1.5).
//
// I demon är produktionsmiljön besökarens sandlåda. Systemförvaltaren skapar en ny miljö med ett klick, och den blir en
// egen sandlåda:
//   Acceptanstestmiljön är en kopia av hela databasen med skarpa data, där patientuppgifterna är avidentifierade:
//   namn, personnummer och andra identiteter, adress, telefon och kontaktperson byts ut överallt, också i fritext, och
//   journalens innehåll i övrigt finns kvar. Loggarna och bevisen om signerade meddelanden följer inte med, eftersom de
//   beskriver produktionen. Miljön får egna loggar från början.
//   Utbildnings- och testmiljön har fiktiva data: demons påhittade patienter, med regler, parametrar och de andra
//   gemensamma inställningarna kopierade från produktionen, så att miljön fungerar som produktionen gör.
// Varje miljö är märkt med vad den är, och märkningen visas överst på varje sida.
//
// Systemet är experten: systemförvaltaren väljer bara vilken miljö som behövs. Systemet vet vad som är patientuppgifter,
// byter ut dem och kontrollerar att inget av det som pekar ut en patient finns kvar.
import { Database } from 'bun:sqlite';
import { Fel, installning, nySessionsDb } from './db.js';
import { GEMENSAMMA_TABELLER } from './lagring.js';
import TESTPERSONNUMMER from './seed/testpersonnummer.json' with { type: 'json' };

export const MILJOER = {
  produktion: { text: 'Produktionsmiljö', kort: 'Produktion', beskrivning: 'Demons vanliga sandlåda.' },
  acceptanstest: { text: 'Acceptanstestmiljö', kort: 'Acceptanstest', beskrivning: 'Kopia av produktionsmiljön med skarpa data, där patientuppgifterna är avidentifierade.' },
  utbildning: { text: 'Utbildningsmiljö', kort: 'Utbildning', beskrivning: 'Fiktiva patienter, med regler och parametrar kopierade från produktionsmiljön.' },
  test: { text: 'Testmiljö', kort: 'Test', beskrivning: 'Fiktiva patienter, med regler och parametrar kopierade från produktionsmiljön.' },
};
// Så många miljöer kan en sandlåda skapa. Varje miljö är en egen sandlåda på servern.
export const MAX_PER_SANDLADA = 3;

// Miljön som en sandlåda är, ur dess egen databas. En sandlåda utan märkning är produktionsmiljön.
export function miljoFor(db) {
  let m = null;
  try { m = JSON.parse(installning(db, 'miljo') ?? 'null'); } catch { m = null; }
  const typ = m?.typ && Object.hasOwn(MILJOER, m.typ) ? m.typ : 'produktion';
  return { typ, ...MILJOER[typ], skapad: m?.skapad ?? null };
}

const tabeller = (db) => db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
const kolumner = (db, t) => db.query(`PRAGMA table_info("${t}")`).all();

// Kör fn med databasens triggrar borttagna och lägger tillbaka dem. Bara i kopian som blir den nya miljön.
function utanTriggrar(db, fn) {
  const trig = db.query("SELECT name, sql FROM sqlite_master WHERE type = 'trigger'").all();
  for (const t of trig) db.exec(`DROP TRIGGER "${t.name}"`);
  try { return fn(); } finally { for (const t of trig) db.exec(t.sql); }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formatPnr = (p) => [p, `${p.slice(0, 8)}-${p.slice(8)}`, `${p.slice(2, 8)}-${p.slice(8)}`, p.slice(2)];

// Avidentifierar patientuppgifterna i databasen. Ger { patienter, ersattningar } med antalet patienter och ändrade värden.
export function avidentifiera(db) {
  const patienter = db.query('SELECT * FROM patienter ORDER BY id').all();
  const anvanda = new Set(patienter.map(p => p.personnummer));
  const lediga = TESTPERSONNUMMER.filter(p => !anvanda.has(p));
  // Ordningen blandas, så att numret inte går att räkna tillbaka till patienten.
  const slump = new Uint32Array(lediga.length);
  crypto.getRandomValues(slump);
  for (let i = lediga.length - 1; i > 0; i--) { const j = slump[i] % (i + 1); [lediga[i], lediga[j]] = [lediga[j], lediga[i]]; }
  // Namnen byts bara i patientens egna rader, så att samma förnamn hos personalen eller en annan patient inte ändras.
  // Personnumren byts överallt, eftersom ett nummer bara kan vara en persons.
  const namnFor = new Map();
  const nummer = new Map();
  const nya = new Map();
  const ord = (s) => `(?<![\\p{L}\\p{N}])${esc(s)}(?=s?(?![\\p{L}\\p{N}]))`;
  patienter.forEach((p, i) => {
    const pnr = lediga[i] ?? `99${String(i).padStart(10, '0')}`;
    const ny = { fornamn: 'Patient', efternamn: `P${String(i + 1).padStart(3, '0')}`, personnummer: pnr };
    nya.set(p.id, ny);
    // Fritext: hela namnet, efternamnet och förnamnet, också i genitiv, och personnumret i alla vanliga former.
    // Kontaktuppgifterna, där de står i fritext eller i ett meddelande som har skickats, tas bort.
    const kontakt = [[p.adress, 'adress borttagen'], [p.telefon, 'telefon borttagen'], [p.kontaktperson, 'kontaktperson borttagen']]
      .filter(([g]) => g && g.length > 3).map(([g, n]) => [new RegExp(esc(g), 'gu'), n]);
    namnFor.set(p.id, [...kontakt, ...[[`${p.fornamn} ${p.efternamn}`, `${ny.fornamn} ${ny.efternamn}`], [p.efternamn, ny.efternamn], [p.fornamn, ny.fornamn]]
      .filter(([g]) => g && g.length > 1).map(([g, n]) => [new RegExp(ord(g), 'gu'), n])]);
    formatPnr(p.personnummer).forEach((f, k) => { if (f.length >= 10) nummer.set(f, formatPnr(pnr)[k]); });
  });
  // Ett enda uttryck för alla nummer, längst först, så att varje textvärde bara läses en gång.
  const nummerRe = nummer.size ? new RegExp(`(?<![0-9])(${[...nummer.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![0-9])`, 'g') : null;
  const bytNummer = (x) => (nummerRe && /[0-9]{6}/.test(x) ? x.replace(nummerRe, (m) => nummer.get(m)) : x);
  let andrade = 0;
  utanTriggrar(db, () => {
    db.exec('PRAGMA foreign_keys = OFF');
    db.transaction(() => {
      // Patienten själv: nya namn och nummer, och inga kontaktuppgifter.
      for (const p of patienter) {
        const n = nya.get(p.id);
        db.query('UPDATE patienter SET personnummer = ?, fornamn = ?, efternamn = ?, adress = NULL, postnr = NULL, ort = NULL, telefon = NULL, kontaktperson = NULL WHERE id = ?')
          .run(`tmp-${p.id}`, n.fornamn, n.efternamn, p.id);
      }
      for (const p of patienter) db.query('UPDATE patienter SET personnummer = ? WHERE id = ?').run(nya.get(p.id).personnummer, p.id);
      // Alla andra textvärden i alla tabeller utom patienterna: namn och nummer byts ut där de står.
      for (const t of tabeller(db)) {
        if (t === 'patienter') continue;
        const kol = kolumner(db, t);
        const text = kol.filter(k => (/TEXT/i.test(k.type) || k.type === '') && k.name !== 'patient_id').map(k => k.name);
        if (!text.length) continue;
        const harPatient = kol.some(k => k.name === 'patient_id');
        for (const r of db.query(`SELECT rowid AS __rad, ${harPatient ? 'patient_id __pid, ' : ''}${text.map(k => `"${k}"`).join(', ')} FROM "${t}"`).all()) {
          const regler = harPatient ? namnFor.get(r.__pid) ?? [] : [];
          const andra = [];
          for (const k of text) {
            const v = r[k];
            if (typeof v !== 'string' || !v) continue;
            let x = bytNummer(v);
            for (const [re, nytt] of regler) x = x.replace(re, nytt);
            if (x !== v) andra.push([k, x]);
          }
          if (andra.length) {
            db.query(`UPDATE "${t}" SET ${andra.map(([k]) => `"${k}" = ?`).join(', ')} WHERE rowid = ?`).run(...andra.map(([, x]) => x), r.__rad);
            andrade++;
          }
        }
      }
      // Patienternas identiteter: den gällande blir det nya personnumret, och tidigare identiteter följer inte med.
      if (tabeller(db).includes('identiteter')) {
        db.exec("DELETE FROM identiteter WHERE status <> 'gallande'");
        db.exec("UPDATE identiteter SET typ = 'personnummer', varde = (SELECT personnummer FROM patienter p WHERE p.id = identiteter.patient_id) WHERE status = 'gallande'");
      }
      if (kolumner(db, 'patienter').some(k => k.name === 'id_typ')) db.exec("UPDATE patienter SET id_typ = 'personnummer'");
      // Invånarna i Min journal är patienterna själva eller deras vårdnadshavare. En invånare som är patient får patientens
      // nya personnummer, en vårdnadshavare ett annat testpersonnummer, och alla får ett namn utan koppling till personen.
      if (tabeller(db).includes('invanare')) {
        let n = patienter.length;
        for (const r of db.query('SELECT id, patient_id FROM invanare ORDER BY id').all()) {
          const pnr = r.patient_id && nya.has(r.patient_id) ? nya.get(r.patient_id).personnummer : lediga[n++] ?? `98${String(n).padStart(10, '0')}`;
          db.query("UPDATE invanare SET personnummer = ?, fornamn = 'Invånare', efternamn = ? WHERE id = ?").run(pnr, `I${String(n).padStart(3, '0')}`, r.id);
        }
      }
      // Loggarna och bevisen beskriver produktionen och följer inte med.
      for (const t of ['atkomstlogg', 'sakerhetslogg', 'signerade_meddelanden', 'stickprov', 'stickprov_rader']) if (tabeller(db).includes(t)) db.exec(`DELETE FROM "${t}"`);
    })();
  });
  return { patienter: patienter.length, andrade };
}

// Skapar databasen för en ny miljö ur produktionsmiljöns databas.
export function skapa(prod, typ, { nu = new Date() } = {}) {
  if (!Object.hasOwn(MILJOER, typ) || typ === 'produktion') throw new Fel(400, 'Välj acceptanstestmiljö, utbildningsmiljö eller testmiljö.', 'ogiltig', { falt: ['typ'] });
  let db;
  let resultat;
  if (typ === 'acceptanstest') {
    db = Database.deserialize(prod.serialize());
    resultat = avidentifiera(db);
  } else {
    db = nySessionsDb();
    // Regler, parametrar och andra gemensamma inställningar kopieras från produktionen, rad för rad.
    const kopierade = [];
    utanTriggrar(db, () => {
      for (const t of GEMENSAMMA_TABELLER) {
        if (!tabeller(prod).includes(t) || !tabeller(db).includes(t)) continue;
        const k = kolumner(db, t).map(x => x.name).filter(n => kolumner(prod, t).some(y => y.name === n));
        db.exec(`DELETE FROM "${t}"`);
        const ins = db.query(`INSERT INTO "${t}" (${k.map(n => `"${n}"`).join(', ')}) VALUES (${k.map(() => '?').join(', ')})`);
        for (const r of prod.query(`SELECT ${k.map(n => `"${n}"`).join(', ')} FROM "${t}"`).values()) ins.run(...r);
        kopierade.push(t);
      }
    });
    resultat = { kopierade };
  }
  installning(db, 'miljo', JSON.stringify({ typ, skapad: nu.toISOString() }));
  return { db, resultat };
}
