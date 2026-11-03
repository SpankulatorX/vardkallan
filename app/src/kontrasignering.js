// Kontrasignering av vald journalinformation (Sussa 3.1.11.3): en signerad anteckning eller ett mätvärde, till exempel
// ett provsvar, kan begäras kontrasignerat. Systemet föreslår vem, begäran hamnar i den personens inkorg och
// kontrasigneras med ett klick.
//
// Reglerna, som alla prövas i servern:
// - Bara den egna vårdenhetens uppgifter kan begäras kontrasignerade, och bara av den som får läsa uppgiften.
// - Systemet föreslår läkare på samma vårdenhet som får läsa uppgiften i behörighetsmotorn, med överläkare först och
//   aldrig underläkare, den som signerade eller den som begär. Begäran kan bara gå till någon i förslaget.
// - En begäran ger ingen behörighet. Den som ska kontrasignera läser uppgiften med sin egen behörighet, och svaret på
//   begäran innehåller bara den posten. Har behörigheten upphört nekas läsningen och kontrasigneringen.
// - Den som har signerat uppgiften kan inte kontrasignera den själv.
import { Fel, iso } from './db.js';
import { prova, kanRoll, vardenhetFor, visningsnamn, visningsPnr } from './atkomst.js';
import * as journal from './journal.js';

const personKort = (db, id) => {
  const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id);
  return p ? { id: p.id, namn: p.namn, titel: p.titel } : null;
};

// Posten som kontrasigneringen gäller: anteckning eller mätvärde, med den läshandling som krävs och vem som signerade.
export function hamtaPost(db, typ, id) {
  if (typ === 'anteckning') {
    const a = db.query('SELECT * FROM anteckningar WHERE id = ?').get(Number(id));
    if (!a) throw new Fel(404, 'Anteckningen finns inte.', 'saknas');
    return { typ, id: a.id, rad: a, patientId: a.patient_id, enhetId: a.enhet_id, handling: journal.lasHandling(a.kategori), signeradAv: a.signerad_av, signerad: a.status === 'signerad', aktuell: !db.query('SELECT 1 FROM anteckningar WHERE ersatter_id = ?').get(a.id), rubrik: a.typ };
  }
  if (typ === 'matvarde') {
    const m = db.query('SELECT * FROM matvarden WHERE id = ?').get(Number(id));
    if (!m) throw new Fel(404, 'Mätvärdet finns inte.', 'saknas');
    return { typ, id: m.id, rad: m, patientId: m.patient_id, enhetId: m.enhet_id, handling: 'las_matvarden', signeradAv: m.registrerad_av, signerad: true, aktuell: true, rubrik: journal.MATTYPER[m.typ]?.namn ?? m.typ };
  }
  throw new Fel(400, 'Det går bara att begära kontrasignering av anteckningar och mätvärden.', 'ogiltig', { falt: ['typ'] });
}

// Vem som kan kontrasignera, i den ordning systemet föreslår. Varje kandidat prövas i behörighetsmotorn mot posten,
// utan aktiva val, så att förslaget aldrig ger någon åtkomst som den inte redan har.
export function kandidater(db, post, begarare) {
  const ve = vardenhetFor(db, post.enhetId);
  const rang = (t) => (/överläkare/i.test(t ?? '') ? 0 : /specialist/i.test(t ?? '') ? 1 : 2);
  return db.query("SELECT * FROM personal WHERE yrke = 'lakare' AND aktiv = 1").all()
    .filter(p => vardenhetFor(db, p.enhet_id) === ve && p.id !== post.signeradAv && p.id !== begarare.id && !/underläkare/i.test(p.titel ?? ''))
    .filter(p => kanRoll(p, 'kontrasignera') && prova(db, { personal: p, patient: post.patientId, handling: post.handling, resurs: { enhet_id: post.enhetId } }).tillaten)
    .sort((a, b) => rang(a.titel) - rang(b.titel) || a.namn.localeCompare(b.namn, 'sv'))
    .map(p => ({ id: p.id, namn: p.namn, titel: p.titel }));
}

const pagaende = (db, post) => db.query("SELECT * FROM kontrasigneringar WHERE typ = ? AND post_id = ? AND status = 'begard'").get(post.typ, post.id);

// Kontrollerna före en begäran. Den som begär måste få läsa posten, och posten ska höra till den egna vårdenheten.
function provaBegaran(atk, post) {
  atk.krav('begara_kontrasignering');
  atk.krav(post.handling, { resurs: { enhet_id: post.enhetId }, beskrivning: `kontrasignering:${post.typ}:${post.id}` });
  if (!post.signerad) throw new Fel(400, 'Bara signerad journalinformation kan kontrasigneras. Signera först.', 'ogiltig');
  if (!post.aktuell) throw new Fel(400, 'Anteckningen har rättats. Begär kontrasignering av den gällande versionen.', 'ogiltig');
  if (vardenhetFor(atk.db, post.enhetId) !== vardenhetFor(atk.db, atk.personal.enhet_id)) {
    throw new Fel(403, 'Bara den egna vårdenhetens journalinformation kan begäras kontrasignerad.', 'nekad');
  }
}

export function forslag(atk, post) {
  provaBegaran(atk, post);
  const lista = kandidater(atk.db, post, atk.personal);
  return { post: { typ: post.typ, id: post.id, rubrik: post.rubrik }, forslag: lista, pagaende: Boolean(pagaende(atk.db, post)),
    skal: lista.length ? `Systemet föreslår ${lista[0].titel?.toLowerCase() ?? 'läkare'} ${lista[0].namn}, som arbetar på samma vårdenhet och får läsa uppgiften.` : 'Det finns ingen läkare på vårdenheten som kan kontrasignera uppgiften.' };
}

export function begar(atk, post, { mottagareId, kommentar } = {}) {
  provaBegaran(atk, post);
  const db = atk.db;
  if (pagaende(db, post)) throw new Fel(400, 'Det finns redan en begäran om kontrasignering av uppgiften som inte är klar.', 'ogiltig');
  const lista = kandidater(db, post, atk.personal);
  const mottagare = mottagareId == null ? lista[0] : lista.find(k => k.id === mottagareId);
  if (!mottagare) {
    throw new Fel(400, mottagareId === post.signeradAv ? 'Den som har signerat uppgiften kan inte kontrasignera den.' : 'Personen kan inte kontrasignera uppgiften. Välj någon av dem som systemet föreslår.', 'ogiltig', { falt: ['mottagareId'] });
  }
  const k = typeof kommentar === 'string' ? kommentar.trim().slice(0, 300) || null : null;
  const r = db.query('INSERT INTO kontrasigneringar (patient_id, typ, post_id, enhet_id, begard_av, begard, mottagare_id, kommentar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(post.patientId, post.typ, post.id, post.enhetId, atk.personal.id, iso(), mottagare.id, k);
  atk.logga('begara_kontrasignering', atk.grund(), `kontrasignering:${post.typ}:${post.id}`, 'tillaten', `Till ${mottagare.namn}`);
  return kontrasigneringUt(db, hamtaRad(db, r.lastInsertRowid));
}

export function hamtaRad(db, id) {
  const k = db.query('SELECT * FROM kontrasigneringar WHERE id = ?').get(Number(id));
  if (!k) throw new Fel(404, 'Begäran om kontrasignering finns inte.', 'saknas');
  return k;
}

export const kontrasigneringUt = (db, k) => ({
  id: k.id, typ: k.typ, postId: k.post_id, status: k.status, begard: k.begard, begardAv: personKort(db, k.begard_av),
  mottagare: personKort(db, k.mottagare_id), kommentar: k.kommentar, kontrasignerad: k.kontrasignerad,
});

// Den som begäran gäller läser den, med bara den posten. Läsningen prövas med egen behörighet och loggas.
export function las(atk, k) {
  if (![k.mottagare_id, k.begard_av].includes(atk.personal.id)) throw new Fel(403, 'Begäran om kontrasignering gäller inte dig.', 'nekad');
  const post = hamtaPost(atk.db, k.typ, k.post_id);
  atk.krav(post.handling, { resurs: { enhet_id: post.enhetId }, beskrivning: `kontrasignering:${k.id}` });
  const innehall = k.typ === 'anteckning' ? journal.anteckningUt(atk.db, post.rad) : journal.matvardeUt(atk.db, post.rad);
  atk.logga(post.handling, atk.grund(), `kontrasignering:${k.id}`);
  return { ...kontrasigneringUt(atk.db, k), post: innehall };
}

export function kontrasignera(atk, k) {
  if (k.mottagare_id !== atk.personal.id) throw new Fel(403, 'Bara den som begäran gäller kan kontrasignera.', 'nekad');
  if (k.status !== 'begard') throw new Fel(400, 'Uppgiften är redan kontrasignerad.', 'ogiltig');
  const post = hamtaPost(atk.db, k.typ, k.post_id);
  if (post.signeradAv === atk.personal.id) throw new Fel(403, 'Den som har signerat uppgiften kan inte kontrasignera den.', 'nekad');
  atk.krav('kontrasignera');
  atk.krav(post.handling, { resurs: { enhet_id: post.enhetId }, beskrivning: `kontrasignering:${k.id}` });
  atk.db.query("UPDATE kontrasigneringar SET status = 'kontrasignerad', kontrasignerad = ? WHERE id = ?").run(iso(), k.id);
  atk.logga('kontrasignera', atk.grund(), `kontrasignering:${k.typ}:${k.post_id}`);
  return kontrasigneringUt(atk.db, hamtaRad(atk.db, k.id));
}

// Status för en post: begärda och gjorda kontrasigneringar, och vad den inloggade kan göra.
export function forPost(db, personal, typ, id) {
  const rader = db.query('SELECT * FROM kontrasigneringar WHERE typ = ? AND post_id = ? ORDER BY id').all(typ, Number(id)).map(k => kontrasigneringUt(db, k));
  const minBegaran = rader.find(k => k.status === 'begard' && k.mottagare?.id === personal.id) ?? null;
  return {
    begaranden: rader, minBegaran: minBegaran?.id ?? null,
    kan: { begara: kanRoll(personal, 'begara_kontrasignering') && !rader.some(k => k.status === 'begard'), kontrasignera: Boolean(minBegaran) },
  };
}

// Begäranden som väntar på den inloggade, för inkorgen. Patienten visas bara när behörighetsmotorn fortfarande släpper
// igenom posten, och med maskering för skyddad identitet.
export function inkorg(db, personal) {
  return db.query("SELECT * FROM kontrasigneringar WHERE mottagare_id = ? AND status = 'begard' ORDER BY begard").all(personal.id).map(k => {
    const post = hamtaPost(db, k.typ, k.post_id);
    const ok = prova(db, { personal, patient: post.patientId, handling: post.handling, resurs: { enhet_id: post.enhetId } }).tillaten;
    const p = ok ? db.query('SELECT * FROM patienter WHERE id = ?').get(k.patient_id) : null;
    return {
      ...kontrasigneringUt(db, k), rubrik: post.rubrik, tillganglig: ok,
      patientId: ok ? k.patient_id : null,
      patient: p ? { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad) } : null,
    };
  });
}
