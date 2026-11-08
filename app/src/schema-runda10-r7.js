// Runda 10, r7: tabellerna och seeden för ombud med fullmakt, meddelanden mellan invånare och vård, kassan och
// kontorsstödet. Varje modul har sitt eget schema med IF NOT EXISTS, så att en äldre sandlåda får tabellerna när den
// läses in. Seeden läggs bara in när den inte redan finns.
import * as ombud from './ombud.js';
import * as meddelanden from './invanarmeddelanden.js';
import * as kassa from './kassa.js';
import * as kontorsstod from './kontorsstod.js';
import { iso } from './db.js';

// Två meddelanden från Gunnar Åkesson (p01) till Kardiologiska kliniken: en fråga till sjuksköterskan och en begäran om
// att förnya ett läkemedel till läkaren. Texterna är påhittade.
function seedaMeddelanden(db, bas) {
  if (db.query('SELECT 1 FROM meddelandetradar LIMIT 1').get()) return;
  const p = db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
  if (!p) return;
  const t = (timmar) => iso(new Date(bas.getTime() - timmar * 3600_000));
  const ins = (typ, yrkesroll, enhet, text, tid, extra = {}) => {
    const id = Number(db.query(`INSERT INTO meddelandetradar (patient_id, enhet_id, typ, yrkesroll, skapad, skapad_av_invanare, relation, ordination_id)
      VALUES ('p01', ?, ?, ?, ?, 'inv-p01', 'egen', ?)`).run(enhet, typ, yrkesroll, tid, extra.ordinationId ?? null).lastInsertRowid);
    db.query("INSERT INTO invanarmeddelanden (trad_id, patient_id, enhet_id, fran, invanare_id, text, tid) VALUES (?, 'p01', ?, 'invanare', 'inv-p01', ?, ?)").run(id, enhet, text, tid);
  };
  ins('fraga', 'sjukskoterska', 'uso-kard', 'Hej! Ska jag ta mina vätskedrivande tabletter som vanligt på morgonen innan jag kommer på besöket?', t(20));
  const o = db.query("SELECT o.id FROM ordinationer o JOIN enheter e ON e.id = o.enhet_id WHERE o.patient_id = 'p01' AND o.status = 'aktiv' AND o.slut IS NULL AND (o.enhet_id = 'uso-kard' OR e.forald_id = 'uso-kard') ORDER BY o.id LIMIT 1").get();
  if (o) ins('recept', 'lakare', 'uso-kard', 'Jag har snart slut på tabletterna. Kan ni förnya receptet?', t(6), { ordinationId: o.id });
}

export function sakraR10r7(db, bas = new Date()) {
  ombud.sakra(db);
  meddelanden.sakra(db);
  kassa.sakra(db);
  kontorsstod.sakra(db);
  ombud.seeda(db, bas);
  seedaMeddelanden(db, bas);
  return db;
}
