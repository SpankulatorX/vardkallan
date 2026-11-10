// Runda 9, r5: API för informationens skyddsbehov (skyddsbehov.js, Sussa 5.3.1.2), certifikaten och de signerade
// meddelandena (pki.js och signering.js, Sussa 5.3.1.5 och 5.3.1.8) och leveransen till e-arkivet (earkiv.js, Sussa
// 5.4.2.3). Behörigheten prövas här med rollens handling, och inget av svaren innehåller patientuppgifter.
import { Fel } from './db.js';
import * as skyddsbehov from './skyddsbehov.js';
import * as pki from './pki.js';
import * as signering from './signering.js';
import * as earkiv from './earkiv.js';
import * as arkiv from './arkiv.js';
import * as lakemedel from './lakemedel.js';
import * as labb from './labb.js';
import { loggaRad } from './logg.js';

// Innehållet som ett bevis gäller, ur journalen som den ser ut nu. undefined när det inte finns kvar.
function innehallFor(db, kalla, status) {
  if (status === 'avvisat') return undefined;
  const [slag, ...rest] = kalla.split(':');
  if (slag === 'nll') { const [ord, typ, ...tid] = rest; return lakemedel.nllInnehall(db, Number(ord), typ, tid.join(':')); }
  // Runda 11, r6: labb_analyser:<id>:v<n> är en rättad version av svaret.
  if (slag === 'labb_analyser') return labb.mottagetSvar(db, Number(rest[0]), rest[1] ?? null);
  if (slag === 'arkivexporter') {
    const e = db.query('SELECT * FROM arkivexporter WHERE id = ?').get(rest.join(':'));
    return e ? { paket: e.id, storlek: e.storlek, sha256: e.sha256, informationstyp: earkiv.INFORMATIONSTYP } : undefined;
  }
  return undefined;
}

export function registreraRutter({ rutt, kravInloggad, kravRoll, version = null }) {
  // Klassningen av skyddsbehovet per informationstyp. Den innehåller inga patientuppgifter och kan läsas av all personal.
  rutt('GET', '/api/skyddsbehov', (c) => { kravInloggad(c); return skyddsbehov.klassning(); });

  // Certifikaten: betrodda utfärdare, instansernas certifikat och de signerade meddelandena, för systemförvaltaren.
  const certifikat = (c) => ({ ...pki.oversikt(c.db), meddelanden: signering.oversikt(c.db) });
  rutt('GET', '/api/certifikat', (c) => { kravRoll(c, 'konfigurera'); return certifikat(c); });
  // Ett certifikat återkallas i sandlådans spärrlista, så att det går att se vad som händer. Bara i den egna sandlådan.
  rutt('POST', '/api/certifikat/aterkalla', (c) => {
    kravRoll(c, 'konfigurera');
    const part = typeof c.body.part === 'string' && Object.hasOwn(pki.PARTER, c.body.part) ? c.body.part : null;
    if (!part || part === 'vardkallan') throw new Fel(400, 'Välj en av motparterna. Vårdkällans eget certifikat återkallas inte här.', 'ogiltig', { falt: ['part'] });
    pki.aterkalla(c.db, pki.instans(part).cert.serialNumber, 'Återkallat av systemförvaltaren i demon.');
    return certifikat(c);
  });
  // Kontroll av ett bevis i efterhand: signaturen, certifikatet vid tiden för meddelandet, kvittensen och om innehållet i
  // journalen är detsamma som det som signerades.
  rutt('GET', '/api/signerade/:id/kontroll', (c, id) => {
    kravRoll(c, 'konfigurera');
    signering.sakraSchema(c.db);
    const r = c.db.query('SELECT kalla, status FROM signerade_meddelanden WHERE id = ?').get(id);
    if (!r) throw new Fel(404, 'Beviset finns inte.', 'saknas');
    return signering.kontrolleraBevis(c.db, id, innehallFor(c.db, r.kalla, r.status));
  });

  // Leverans till e-arkivet: systemet bygger paketet som vid export, skickar det med ett signerat manifest och tar emot
  // e-arkivets signerade kvittens med resultatet av mottagningskontrollen.
  rutt('POST', '/api/arkiv/beslut/:id/leverera', (c, id) => {
    kravRoll(c, 'arkivera');
    const p = c.personal;
    const b = arkiv.hamtaBeslut(c.db, id);
    const paket = arkiv.exportera(c.db, p, b, { version });
    const l = earkiv.leverera(c.db, { objid: paket.objid, paket: paket.paket, enhetId: p.enhet_id });
    loggaRad(c.db, { personal_id: p.id, enhet_id: p.enhet_id, patient_id: b.patient_id, handling: 'arkivera', resurs: `beslut:${b.id}:${paket.objid}:leverans`, grund: 'arkivbeslut',
      syfte: `Leverans till ${earkiv.EARKIV} enligt ${b.diarienummer}: ${l.status === 'kvitterat' ? 'mottagen och kvitterad' : 'avvisad'}.`, resultat: 'tillaten' });
    return { ...l, patienter: paket.patienter, filer: paket.filer, sha256: paket.sha256, beslut: arkiv.beslutUt(c.db, arkiv.hamtaBeslut(c.db, id)) };
  });
  rutt('GET', '/api/arkiv/leverans/:id/kontroll', (c, id) => { kravRoll(c, 'arkivera'); return earkiv.kontrolleraLeverans(c.db, id); });
}
