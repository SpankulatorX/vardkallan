// Patientens vårdplaner i Min journal (runda 10, r7, Sussa 3.7.1.3). Patienten och vårdnadshavaren ser planens mål,
// åtgärder, uppföljningsdatum och hur målen bedömdes vid den senaste uppföljningen, och kan kommentera planen. En
// kommentar blir ett meddelande till den vårdenhet som har planen (invanarmeddelanden.js), så att vården får den i sitt
// vanliga arbete. Ett ombud ser inte vårdplanen, eftersom den är en del av journalen.
//
// Systemet är experten: planen visas på vanlig svenska, med vad patienten själv kan göra (åtgärder utan ansvarig
// yrkesroll finns inte, så planen säger vem i vården som gör vad) och när nästa uppföljning är. Inga namn på personal
// visas, bara vårdenhet och yrkesroll, som i logglistan.
import { vardenhetFor } from './atkomst.js';
import { MALSTATUS, ANSVARIGA } from './vardplan.js';

const enhetNamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? null;
const finns = (db) => Boolean(db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vardplaner'").get());

export function minaPlaner(atk) {
  const db = atk.db;
  if (!finns(db)) return { planer: [] };
  const planer = db.query('SELECT * FROM vardplaner WHERE patient_id = ? ORDER BY (status = \'avslutad\'), skapad DESC, id DESC').all(atk.patientId);
  const kommentarer = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meddelandetradar'").get()
    ? db.query("SELECT plan_id, count(*) AS n, sum(status <> 'avslutad') AS oppna FROM meddelandetradar WHERE patient_id = ? AND typ = 'vardplan' GROUP BY plan_id").all(atk.patientId)
    : [];
  return {
    planer: planer.map(p => {
      const mal = db.query('SELECT * FROM vardplan_mal WHERE plan_id = ? AND borttagen IS NULL ORDER BY id').all(p.id);
      const atg = db.query('SELECT * FROM vardplan_atgarder WHERE plan_id = ? AND borttagen IS NULL ORDER BY id').all(p.id);
      const hist = db.query("SELECT * FROM vardplan_historik WHERE plan_id = ? AND typ = 'uppfoljning' ORDER BY tid DESC, id DESC").all(p.id);
      const senaste = hist[0] ? JSON.parse(hist[0].detalj ?? '{}').mal ?? {} : {};
      const k = kommentarer.find(x => x.plan_id === p.id);
      return {
        id: p.id, rubrik: p.rubrik, status: p.status, statusText: { aktiv: 'Pågår', pausad: 'Uppehåll', avslutad: 'Avslutad' }[p.status],
        vardenhet: enhetNamn(db, vardenhetFor(db, p.enhet_id)), skapad: p.skapad, nastaUppfoljning: p.status === 'aktiv' ? p.uppfoljning : null,
        mal: mal.map(m => ({ text: m.text, status: senaste[m.id] ?? null, statusText: MALSTATUS[senaste[m.id]] ?? 'Följs upp' })),
        atgarder: atg.map(a => ({ text: a.text, vem: ANSVARIGA[a.ansvarig] ?? null, dagligen: Boolean(a.dagligen) })),
        uppfoljningar: hist.map(h => ({ tid: h.tid, text: h.text, vardenhet: enhetNamn(db, vardenhetFor(db, h.enhet_id ?? p.enhet_id)) })),
        kommentarer: k ? { antal: k.n, oppna: k.oppna } : { antal: 0, oppna: 0 },
        kanKommentera: atk.relation !== 'ombud' && p.status !== 'avslutad',
      };
    }),
  };
}
