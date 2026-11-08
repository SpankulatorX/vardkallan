import { byggSeed } from './db.js';
const db = byggSeed(new Date('2026-11-08T10:00:00Z'));
const q = (s, ...a) => db.query(s).all(...a);
console.log(JSON.stringify(q("SELECT patient_id, enhet_id, kod, datum FROM diagnoser ORDER BY patient_id")));
console.log(JSON.stringify(q("SELECT typ, count(*) n, count(DISTINCT patient_id) p FROM matvarden GROUP BY typ")));
console.log(JSON.stringify(q("SELECT patient_id, enhet_id, typ, varde, substr(tid,1,10) t FROM matvarden WHERE typ IN ('hba1c','blodtryck') ORDER BY patient_id")));
console.log(JSON.stringify(q("SELECT patient_id, enhet_id FROM listningar")));
console.log(JSON.stringify(q("SELECT kod, patient_id, enhet_id FROM atgarder")));
console.log(JSON.stringify(q("SELECT o.patient_id, o.enhet_id, k.atc FROM ordinationer o JOIN katalog k ON k.id=o.lakemedel_id WHERE o.status='aktiv' ORDER BY o.patient_id")));
