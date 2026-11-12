// Runda 14, r3: formulärtjänsten, 1177:s inkorg och NKRR med tjänstekontrakt i RIVTA (Sussa 2.2.1.5, 2.2.1.6 och
// 2.2.1.14). Vårdkällan är konsument, och motparterna är simulerade.
import { describe, test, expect } from 'bun:test';
import * as et from '../src/rivta-etjanster.js';
import * as sim from '../src/rivta-etjanster-simulerade.js';
import * as rivta from '../src/rivta/index.js';
import { atk, nyDb } from './hjalp.js';

const fel = async (fn) => { try { await fn(); } catch (e) { return e; } return null; };
const pat = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);
const logg = (db, k) => rivta.anropslogg(db).filter(x => x.kontrakt === k && x.riktning === 'ut').map(x => x.resultat);

describe('E-tjänster med tjänstekontrakt i RIVTA', () => {
  test('Formulär > ett formulär skickas med CreateFormRequest, statusen hämtas med GetForm och en förfrågan avbryts med CancelForm', async () => {
    const db = nyDb();
    const a = () => atk(db, 'lak-vc', 'p11', {}, 'las_admin');
    const r = await et.skickaFormular(a(), pat(db, 'p11'), { mall: 'halsodeklaration' }, new Date('2026-11-12T10:00:00Z'));
    expect(r.text).toContain('2026-11-26');
    expect((await et.hamtaFormular(a(), r.id)).status).toBe('skickat');
    sim.fyllI(db, r.formId);
    expect((await et.hamtaFormular(a(), r.id)).status).toBe('ifyllt');
    expect((await fel(() => et.avbrytFormular(a(), r.id))).status).toBe(409);
    const r2 = await et.skickaFormular(a(), pat(db, 'p11'), { mall: 'symtomskattning' });
    expect((await et.avbrytFormular(a(), r2.id)).status).toBe('avbrutet');
    for (const k of ['CreateFormRequest', 'GetForm', 'CancelForm']) expect(logg(db, k)).toContain('ok');
    // En annan vårdenhet ser inte formuläret, och fel mall ger ett fel på svenska.
    expect(et.formularFor(atk(db, 'lak-kard', 'p11', {}, 'las_admin'), pat(db, 'p11')).formular).toEqual([]);
    expect((await fel(() => et.skickaFormular(a(), pat(db, 'p11'), { mall: 'hittepa' }))).message).toContain('Välj');
  });

  test('1177 > ett meddelande går till inkorgen i 1177 bara när patienten har ett konto, med IsActiveUser och AddMessage', async () => {
    const db = nyDb();
    const mina = db.query('SELECT id, personnummer, fornamn, efternamn, fodd FROM patienter WHERE skyddad = 0').all().filter(p => atk(db, 'lak-vc', p.id).prova('las_admin').tillaten);
    const harKonto = (p) => db.query('SELECT 1 FROM invanare WHERE patient_id = ?').get(p.id);
    const udda = mina.find(p => !harKonto(p));
    // En patient med konto: en invånare i Min journal.
    const jamn = mina.find(p => p.id !== udda.id && harKonto(p)) ?? (() => {
      const p = mina.find(x => x.id !== udda.id);
      db.query('INSERT INTO invanare (id, personnummer, fornamn, efternamn, fodd, patient_id) VALUES (?, ?, ?, ?, ?, ?)').run(`inv-test-${p.id}`, p.personnummer, p.fornamn, p.efternamn, p.fodd, p.id);
      return p;
    })();
    const med = await et.meddela1177(atk(db, 'lak-vc', jamn.id, {}, 'las_admin'), pat(db, jamn.id), { rubrik: 'Inför besöket', text: 'Välkommen till vårdcentralen.' });
    expect(med.skickat).toBe(true);
    const utan = await et.meddela1177(atk(db, 'lak-vc', udda.id, {}, 'las_admin'), pat(db, udda.id), { rubrik: 'Inför besöket', text: 'Välkommen till vårdcentralen.' });
    expect(utan).toMatchObject({ skickat: false, kanal: 'brev' });
    expect(logg(db, 'IsActiveUser').filter(x => x === 'ok').length).toBe(2);
    expect(logg(db, 'AddMessage')).toEqual(['ok']);
    expect(JSON.stringify(rivta.anropslogg(db))).not.toContain(jamn.personnummer);
  });

  test('NKRR > vårdenheten meddelar kvalitetsregistret med ProcessRegistrationNotification, men aldrig för skyddade personuppgifter', async () => {
    const db = nyDb();
    const r = await et.anmalRegistrering(atk(db, 'lak-vc', 'p11', {}, 'kvalitetsregister'), pat(db, 'p11'), { register: 'demo-kvalitetsregister' });
    expect(r.referens).toMatch(/^SIM-NKRR-/);
    expect(logg(db, 'ProcessRegistrationNotification')).toEqual(['ok']);
    expect((await fel(() => et.anmalRegistrering(atk(db, 'lak-vc', 'p03', {}, 'kvalitetsregister'), pat(db, 'p03'), { register: 'demo-kvalitetsregister' }))).status).toBe(400);
    expect(logg(db, 'ProcessRegistrationNotification')).toEqual(['ok']);
  });
});
