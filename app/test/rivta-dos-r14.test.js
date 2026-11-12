// Runda 14, r3: dosdispensering med riv.druglogistics.dosedispensing (Sussa 5.1.4.3), RIVTA Basic Profile 2.0, mot ett
// simulerat dosapotek.
import { describe, test, expect } from 'bun:test';
import * as dos from '../src/rivta-dos.js';
import * as rivta from '../src/rivta/index.js';
import { atk, nyDb } from './hjalp.js';

const fel = async (fn) => { try { await fn(); } catch (e) { return e; } return null; };
const pat = (db, id) => db.query('SELECT * FROM patienter WHERE id = ?').get(id);

describe('Dosdispensering med tjänstekontrakt i RIVTA', () => {
  test('Dos > läkaren anmäler patienten till dosapoteket med SkapaVardtagare och journalen hämtar uppgifterna med HamtaVardtagareinformation', async () => {
    const db = nyDb();
    const a = (h) => atk(db, 'lak-vc', 'p11', {}, h);
    expect((await dos.hamta(a('las_lakemedel'), pat(db, 'p11'))).dospatient).toBe(false);
    expect((await fel(() => dos.anmal(a('ordinera'), pat(db, 'p11'), {}))).message).toContain('samtyckt');
    const r = await dos.anmal(a('ordinera'), pat(db, 'p11'), { samtycke: true }, new Date('2026-11-12T10:00:00Z'));
    expect(r.forstaDosdag).toBe('2026-11-23');
    expect((await dos.hamta(a('las_lakemedel'), pat(db, 'p11'))).dospatient).toBe(true);
    expect((await fel(() => dos.anmal(a('ordinera'), pat(db, 'p11'), { samtycke: true }))).status).toBe(409);
    const ut = rivta.anropslogg(db).filter(x => x.riktning === 'ut').map(x => [x.kontrakt, x.resultat]);
    expect(ut).toEqual(expect.arrayContaining([['SkapaVardtagare', 'ok'], ['HamtaVardtagareinformation', 'ok']]));
    // Kontraktet är profil 2.0, med den logiska adressen i wsa:To.
    expect(dos.DEF.skapa().profil).toBe('RIVTABP20');
    // Sjuksköterskan anmäler inte.
    const ssk = db.query("SELECT id FROM personal WHERE yrke = 'sjukskoterska' AND enhet_id LIKE 'vc-tybble%' LIMIT 1").get()?.id;
    if (ssk) expect((await fel(() => dos.anmal(atk(db, ssk, 'p11', {}, 'ordinera'), pat(db, 'p11'), { samtycke: true }))).status).toBe(403);
  });

  test('Dos > en patient med skyddade personuppgifter anmäls utan adress', async () => {
    const db = nyDb();
    const r = await dos.anmal(atk(db, 'lak-vc', 'p03', {}, 'ordinera'), pat(db, 'p03'), { samtycke: true });
    expect(r.text).toContain('anmäld');
    const u = JSON.parse(db.query('SELECT uppgifter FROM sim_dosapotek').get().uppgifter);
    expect(u.Hemmaboendeinformation).toBeUndefined();
  });
});
