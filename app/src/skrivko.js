// Skrivkön för arbete utan uppkoppling (runda 10, r1, Sussa 2.3.1.4). När servern inte svarar kan personalen ändå ge en
// dos och registrera ett mätvärde för en patient i läskopian, till exempel vid sängen eller i hemsjukvården. Webbläsaren
// sparar registreringen krypterad med läskopians nyckel (public/js/lasekopia.js), märker den som inte sparad i
// journalen och skickar den när förbindelsen är tillbaka (POST /api/skrivko).
//
// Systemet är experten också här: registreringen sparas med samma funktion som när förbindelsen finns, med tiden då den
// faktiskt gjordes, och prövas mot det som har hänt under avbrottet. Har någon annan gett samma dos eller har
// ordinationen ändrats blir det en konflikt, och systemet förklarar varför. Personen avgör: registrera ändå med en
// motivering (dosen gavs faktiskt) eller ta bort den ur kön (den gavs inte).
//
// Reglerna:
// - Bara den som läskopian lämnades ut till, inloggad i samma session, kan skicka kön. Raden är krypterad med
//   läskopians nyckel, så en ändrad eller påhittad rad avvisas.
// - Bara patienter som servern lämnade ut till läskopian, och bara tider inom läskopians giltighet.
// - Behörigheten prövas som vanligt när raden sparas, med behörighetsmotorn och samma kontroller som i gränssnittet.
// - Varje rad sparas en gång. En rad som skickas igen, till exempel när svaret inte kom fram, ger samma svar.
// - Åtkomstloggen får en rad per registrering med att den gjordes under ett avbrott och när.
import { createDecipheriv } from 'node:crypto';
import { Fel, iso } from './db.js';
import * as journal from './journal.js';
import * as administrering from './administrering.js';
import * as vardkontakt from './vardkontakt.js';

export const TYPER = { matvarde: 'registrera_matvarde', dos: 'ge_lakemedel' };
export const MAX_RADER = 50;
// Så långt bakåt en registrering i kön får vara gjord: läskopians giltighet, 8 timmar, och marginal för klockan.
const MAX_ALDER_MS = 8 * 3600_000 + 5 * 60_000;
const MARGINAL_MS = 5 * 60_000;

export function sakraSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS skrivko (
    id TEXT PRIMARY KEY, kopia_id TEXT NOT NULL, personal_id TEXT NOT NULL, patient_id TEXT NOT NULL, typ TEXT NOT NULL, gjord TEXT NOT NULL,
    mottagen TEXT NOT NULL, status TEXT NOT NULL, resultat_id INTEGER)`);
}

export const koAad = (kopiaId, personalId, id) => Buffer.from(`vardkallan-skrivko|${kopiaId}|${personalId}|${id}`);
function dekryptera(nyckel, aad, iv, data) {
  if (typeof iv !== 'string' || typeof data !== 'string' || iv.length > 32 || data.length > 8192) return null;
  try {
    const ivB = Buffer.from(iv, 'base64url');
    const d = Buffer.from(data, 'base64url');
    if (ivB.length !== 12 || d.length < 17) return null;
    const dc = createDecipheriv('aes-256-gcm', nyckel, ivB);
    dc.setAAD(aad);
    dc.setAuthTag(d.subarray(d.length - 16));
    const v = JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString('utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

// Vad registreringen gäller, på vanlig svenska, för den som ska avgöra en konflikt. Bara uppgifter som personen redan
// fick se i läskopian.
function beskrivning(db, rad) {
  if (rad.typ === 'matvarde') {
    const def = journal.MATTYPER[rad.data?.typ];
    return `${def?.namn ?? 'Mätvärde'} ${typeof rad.data?.varde === 'object' ? '' : String(rad.data?.varde ?? '')}`.trim();
  }
  const o = Number.isInteger(rad.data?.ordinationId) ? db.query('SELECT lakemedel_id FROM ordinationer WHERE id = ? AND patient_id = ?').get(rad.data.ordinationId, rad.patientId) : null;
  const lm = o ? db.query('SELECT namn, styrka FROM katalog WHERE id = ?').get(o.lakemedel_id) : null;
  return lm ? `${lm.namn} ${lm.styrka ?? ''}`.trim() : 'Dos';
}

// Tar emot kön. c är anropet med sessionen, medPatient serverns hjälpare. Ger { resultat: [...] }.
//   rader:        [{ id, iv, data }] krypterade med läskopians nyckel
//   kvitteringar: { [id]: [{ regel, motivering }] } när personen registrerar en dos trots en varning
//   kasta:        [id] rader som personen tar bort ur kön, eftersom de inte gjordes
export function taEmot(c, medPatient, { kopiaId, rader, kvitteringar = {}, kasta = [] } = {}) {
  if (typeof kopiaId !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(kopiaId)) throw new Fel(400, 'Ange läskopians id.', 'ogiltig', { falt: ['kopiaId'] });
  if (!Array.isArray(rader) || rader.length > MAX_RADER) throw new Fel(400, `Skicka högst ${MAX_RADER} rader åt gången.`, 'ogiltig', { falt: ['rader'] });
  const kopia = c.s.kopior?.get(kopiaId);
  // En annan persons läskopia, eller en som inte finns i sessionen, ger samma svar.
  if (!kopia || kopia.personalId !== c.personal.id) throw new Fel(404, 'Läskopian finns inte i din inloggning. Registreringarna i kön kan bara skickas av den som gjorde dem, inloggad i samma webbläsare.', 'saknas');
  const db = c.db;
  sakraSchema(db);
  const nyckel = Buffer.from(kopia.nyckel, 'base64url');
  const nu = Date.now();
  const kastas = new Set(Array.isArray(kasta) ? kasta.filter(x => typeof x === 'string') : []);
  const resultat = [];
  for (const r of rader) {
    const id = typeof r?.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(r.id) ? r.id : null;
    if (!id) { resultat.push({ id: null, status: 'avvisad', text: 'Raden saknar giltigt id.' }); continue; }
    const finns = db.query('SELECT * FROM skrivko WHERE id = ?').get(id);
    if (finns) { resultat.push({ id, status: finns.status, resultatId: finns.resultat_id, text: finns.status === 'sparad' ? 'Registreringen var redan sparad.' : 'Registreringen var redan borttagen ur kön.' }); continue; }
    const rad = dekryptera(nyckel, koAad(kopiaId, kopia.personalId, id), r.iv, r.data);
    if (!rad || rad.id !== id) { resultat.push({ id, status: 'avvisad', text: 'Raden kunde inte verifieras med läskopians nyckel.' }); continue; }
    const handling = Object.hasOwn(TYPER, rad.typ) ? TYPER[rad.typ] : null;
    if (!handling) { resultat.push({ id, status: 'avvisad', text: 'Bara givna doser och mätvärden kan registreras under ett avbrott.' }); continue; }
    if (typeof rad.patientId !== 'string' || !kopia.patienter.has(rad.patientId)) { resultat.push({ id, status: 'avvisad', text: 'Patienten fanns inte i din läskopia.' }); continue; }
    const gjord = typeof rad.gjord === 'string' ? Date.parse(rad.gjord) : NaN;
    if (!Number.isFinite(gjord) || gjord > nu + MARGINAL_MS || gjord < nu - MAX_ALDER_MS) { resultat.push({ id, status: 'avvisad', text: 'Tidpunkten ligger utanför läskopians giltighet.' }); continue; }
    const tid = new Date(gjord).toISOString();
    if (kastas.has(id)) {
      db.query("INSERT INTO skrivko (id, kopia_id, personal_id, patient_id, typ, gjord, mottagen, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'kastad')").run(id, kopiaId, c.personal.id, rad.patientId, rad.typ, tid, iso());
      resultat.push({ id, status: 'kastad', text: 'Registreringen är borttagen ur kön och sparades inte i journalen.' });
      continue;
    }
    const syfte = `Registrerad under ett avbrott ${tid} och sparad i kön på datorn tills förbindelsen var tillbaka.`;
    const data = rad.data && typeof rad.data === 'object' ? rad.data : {};
    try {
      // Registreringen och raden i skrivko sparas i samma synkrona steg, så att en rad aldrig sparas två gånger. En nekad
      // behörighet loggas av behörighetsmotorn som vanligt.
      const ut = medPatient(c, rad.patientId, handling, (atk) => {
        let svar;
        if (rad.typ === 'matvarde') {
          svar = vardkontakt.knyt(atk, 'matvarden', journal.registreraMatvarde(atk, { typ: data.typ, varde: data.varde, tid }), data);
        } else {
          const kv = Array.isArray(kvitteringar?.[id]) ? kvitteringar[id] : [];
          svar = vardkontakt.knyt(atk, 'administreringar', administrering.spara(atk, {
            ordinationId: data.ordinationId, ...(data.planerad ? { planerad: data.planerad } : {}), ...(data.kontrollkod ? { kontrollkod: data.kontrollkod } : {}),
            ...(data.dos != null ? { dos: data.dos } : {}), atgard: 'ge', tid, kvitteradeVarningar: kv,
            // Runda 13, r3 (E2-5): hur identiteten kontrollerades, som den registrerades under avbrottet.
            ...(data.identitet ? { identitet: data.identitet } : {}), ...(data.armband ? { armband: data.armband } : {}),
          }), data);
        }
        const resultatId = Number(svar.id ?? svar.administrering?.id ?? null) || null;
        atk.logga(handling, atk.grund(), `skrivko:${rad.typ}:${resultatId ?? id}`, 'tillaten', syfte);
        db.query("INSERT INTO skrivko (id, kopia_id, personal_id, patient_id, typ, gjord, mottagen, status, resultat_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'sparad', ?)")
          .run(id, kopiaId, c.personal.id, rad.patientId, rad.typ, tid, iso(), resultatId);
        return { resultatId };
      });
      resultat.push({ id, status: 'sparad', resultatId: ut.resultatId, text: `${beskrivning(db, rad)} är sparad i journalen med tiden då det gjordes.` });
    } catch (e) {
      if (!(e instanceof Fel)) throw e;
      // En varning som ska kvitteras är en konflikt med något som har hänt under avbrottet. Personen avgör.
      if (e.status === 400 && e.extra?.varningar) {
        resultat.push({ id, status: 'konflikt', typ: rad.typ, vad: beskrivning(db, rad), gjord: tid, text: e.message,
          varningar: e.extra.varningar.filter(v => v.niva === 'allvarlig' || v.kraverKvittens).map(v => ({ regel: v.regel, text: v.text })), kraverKvittens: e.extra.kraverKvittens ?? [] });
      } else {
        // Nekad behörighet ger bara meddelandet, aldrig något om patienten.
        resultat.push({ id, status: 'avvisad', text: e.status === 403 || e.status === 404 ? 'Registreringen kunde inte sparas, eftersom du inte längre får registrera för patienten.' : e.message });
      }
    }
  }
  return { resultat };
}
