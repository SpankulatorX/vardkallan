// API för utskrifter och utlämnanden (utskrift.js), kontrasignering (kontrasignering.js), arkiv, gallring och radering
// (arkiv.js) och datauttaget för uppföljning (datauttag.js). Servern lämnar sina hjälpare hit, så att routningen för de
// här delarna ligger samlad. All behörighet prövas i behörighetsmotorn och varje åtkomst loggas, som i resten av API:t.
// Runda 7, r4: gallringsåren kan ändras av systemförvaltningen.
import * as konfiguration from './konfiguration.js';
import { Fel } from './db.js';
import { kanRoll } from './atkomst.js';
import * as logg from './logg.js';
import * as utskrift from './utskrift.js';
import * as ks from './kontrasignering.js';
import * as arkiv from './arkiv.js';
import * as datauttag from './datauttag.js';

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor, version }) {
  // En roll utan behörighet nekas, och försöket loggas som nekat, också när det inte gäller en patient.
  const kravRoll = (c, handling, patientId = null) => {
    const p = kravInloggad(c);
    if (!kanRoll(p, handling)) {
      logg.loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, patient_id: patientId, handling, resurs: c.url.pathname, grund: 'nekad', resultat: 'nekad' });
      throw new Fel(403, 'Din yrkesroll har inte behörighet till det här.', 'nekad');
    }
    return p;
  };
  const loggUtanPatient = (c, handling, grund, resurs) => logg.loggaRad(c.db, { personal_id: c.personal.id, enhet_id: c.personal.enhet_id, handling, resurs, grund, resultat: 'tillaten' });

  // Utskrifter och utlämnanden (Sussa 3.1.9).
  rutt('GET', '/api/patient/:id/utskrift/forslag', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'skriv_ut', (atk, p) => {
      const ut = utskrift.forslag(atk, p);
      atk.logga('las_admin', atk.grund(), 'utskrift:forslag');
      return ut;
    });
  });
  rutt('POST', '/api/patient/:id/utskrift', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'skriv_ut', (atk, p) => utskrift.skrivUt(atk, p, c.body, valFor(c.s, p.id)))]; });
  rutt('GET', '/api/patient/:id/utskrifter', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk) => utskrift.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/utlamnanden', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'utlamna', (atk, p) => utskrift.registreraUtlamnande(atk, p, c.body))]; });
  rutt('POST', '/api/utlamnande/:id/aterlamna', (c, id) => {
    kravInloggad(c);
    const u = utskrift.hamtaUtlamnande(c.db, id);
    return medPatient(c, u.patient_id, 'utlamna', (atk) => utskrift.aterlamna(atk, u));
  });
  // Eftersökning av en utskrift med utskrifts-id:t på papperet. Logggranskaren ser alla, andra bara sådana som de får se.
  rutt('GET', '/api/utskrift/:id', (c, id) => {
    const pers = kravInloggad(c);
    const u = utskrift.hamtaUtskrift(c.db, id);
    if (kanRoll(pers, 'las_logg')) {
      logg.loggaRad(c.db, { personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: u.patient_id, handling: 'las_logg', resurs: `utskrift:${u.id}`, grund: 'logggranskning', resultat: 'tillaten' });
      return utskrift.utskriftMetadata(c.db, u);
    }
    return medPatient(c, u.patient_id, 'las_admin', (atk) => {
      atk.krav('las_admin', { resurs: { enhet_id: u.enhet_id }, beskrivning: `utskrift:${u.id}` });
      atk.logga('las_admin', atk.grund(), `utskrift:${u.id}`);
      return utskrift.utskriftMetadata(c.db, u);
    });
  });

  // Kontrasignering (Sussa 3.1.11.3).
  const postAv = (c, typ, id) => ks.hamtaPost(c.db, typ, id);
  rutt('GET', '/api/kontrasignering/forslag', (c) => {
    kravInloggad(c);
    const post = postAv(c, c.url.searchParams.get('typ'), c.url.searchParams.get('id'));
    return medPatient(c, post.patientId, 'begara_kontrasignering', (atk) => {
      const ut = ks.forslag(atk, post);
      atk.logga(post.handling, atk.grund(), `kontrasignering:forslag:${post.typ}:${post.id}`);
      return ut;
    });
  });
  rutt('POST', '/api/kontrasigneringar', (c) => {
    kravInloggad(c);
    const post = postAv(c, c.body.typ, c.body.id);
    return [201, medPatient(c, post.patientId, 'begara_kontrasignering', (atk) => ks.begar(atk, post, c.body))];
  });
  rutt('GET', '/api/kontrasignering/:id', (c, id) => {
    kravInloggad(c);
    const k = ks.hamtaRad(c.db, id);
    return medPatient(c, k.patient_id, 'las_journal', (atk) => ks.las(atk, k));
  });
  rutt('POST', '/api/kontrasignering/:id/kontrasignera', (c, id) => {
    kravInloggad(c);
    const k = ks.hamtaRad(c.db, id);
    return medPatient(c, k.patient_id, 'kontrasignera', (atk) => ks.kontrasignera(atk, k));
  });

  // Arkiv, gallring och radering (Sussa 5.4.2 och 5.3.1.7). Bara arkivarien, och bara efter ett registrerat beslut.
  rutt('GET', '/api/arkiv/typer', (c) => { kravRoll(c, 'registrera_arkivbeslut'); return { typer: arkiv.BESLUTSTYPER, gallringAr: konfiguration.varde(c.db, 'arkiv.gallring_ar') }; });
  rutt('GET', '/api/arkiv/beslut', (c) => {
    kravRoll(c, 'registrera_arkivbeslut');
    loggUtanPatient(c, 'registrera_arkivbeslut', 'administrativ', 'arkiv:beslut');
    return arkiv.listaBeslut(c.db);
  });
  rutt('GET', '/api/arkiv/patient', (c) => { const p = kravRoll(c, 'registrera_arkivbeslut'); return arkiv.hittaPatient(c.db, p, c.url.searchParams.get('q')); });
  rutt('GET', '/api/arkiv/patient/:id/poster', (c, id) => { const p = kravRoll(c, 'registrera_arkivbeslut', id); return arkiv.poster(c.db, p, id); });
  rutt('POST', '/api/arkiv/beslut', (c) => { const p = kravRoll(c, 'registrera_arkivbeslut'); return [201, arkiv.registreraBeslut(c.db, p, c.body)]; });
  rutt('GET', '/api/arkiv/beslut/:id/underlag', (c, id) => { const p = kravRoll(c, 'registrera_arkivbeslut'); return arkiv.underlag(c.db, p, arkiv.hamtaBeslut(c.db, id)); });
  rutt('POST', '/api/arkiv/beslut/:id/paket', (c, id) => {
    const p = kravRoll(c, 'arkivera');
    const r = arkiv.exportera(c.db, p, arkiv.hamtaBeslut(c.db, id), { version });
    return new Response(r.paket, { status: 200, headers: {
      'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${r.objid}.zip"`, 'Cache-Control': 'no-store',
      'X-Paket-Id': r.objid, 'X-Paket-Sha256': r.sha256, 'X-Paket-Patienter': String(r.patienter), 'X-Paket-Filer': String(r.filer),
    } });
  });
  rutt('POST', '/api/arkiv/beslut/:id/verkstall', (c, id) => { const p = kravRoll(c, 'gallra'); return arkiv.verkstall(c.db, p, arkiv.hamtaBeslut(c.db, id)); });

  // Datauttaget för uppföljning (Sussa 6.3.1). Bara uppföljningsrollen, och inga direkta personuppgifter.
  const bas = (c) => `${c.url.protocol}//${c.url.host}`;
  rutt('GET', '/api/datauttag', (c) => {
    kravRoll(c, 'datauttag');
    const m = datauttag.manifest(c.db, bas(c));
    loggUtanPatient(c, 'datauttag', 'uppfoljning', 'datauttag:manifest');
    return m;
  });
  rutt('GET', '/api/datauttag/schema', (c) => { kravRoll(c, 'datauttag'); return { tabeller: datauttag.SCHEMA, uppdateras: `Varje natt klockan ${datauttag.status(c.db)?.klockan ?? '02.00'} svensk tid` }; });
  rutt('GET', '/api/datauttag/:typ', (c, typ) => {
    kravRoll(c, 'datauttag');
    if (!datauttag.TYPER.includes(typ)) throw new Fel(404, 'Det finns ingen sådan tabell i datauttaget.', 'saknas');
    const andringar = c.url.searchParams.get('andringar') === '1';
    // Runda 9, r7: ändringarna sedan en äldre sparad uppdatering (?sedan=id ur manifestets historik).
    const sedanText = c.url.searchParams.get('sedan');
    const sedan = sedanText && /^\d{1,9}$/.test(sedanText) ? Number(sedanText) : null;
    if (sedanText && sedan == null) throw new Fel(400, 'Ange uppdateringens id ur manifestets historik.', 'ogiltig');
    const text = datauttag.ndjson(c.db, typ, { andringar, sedan });
    if (text == null) throw new Fel(404, 'Den uppdateringen sparas inte längre. Läs hela tabellen i stället.', 'saknas');
    loggUtanPatient(c, 'datauttag', 'uppfoljning', `datauttag:${typ}${andringar ? ':andringar' : ''}${sedan != null ? `:sedan:${sedan}` : ''}`);
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
  });
}

// Det som servern lägger till i befintliga svar. Samlat här så att ändringarna i server.js blir några rader.
export const tillagg = {
  inkorg: (db, p) => ({
    kontrasigneringar: kanRoll(p, 'kontrasignera') ? ks.inkorg(db, p) : [],
    aterlamnanden: kanRoll(p, 'utlamna') ? utskrift.forsenadeAterlamnanden(db, p) : [],
  }),
  drift: (db) => { if (!db) return {}; datauttag.uppdateraOmDags(db); return { datauttag: datauttag.status(db) }; },
  huvud: (db, p) => ({ journalForstord: arkiv.huvudDel(db, p) }),
  anteckning: (db, personal, ut) => ({ ...ut, kontrasignering: ks.forPost(db, personal, 'anteckning', ut.id) }),
  stadning: (db) => { try { datauttag.uppdateraOmDags(db); } catch { /* sandlådan kan vara stängd */ } },
};
