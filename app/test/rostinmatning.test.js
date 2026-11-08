// Runda 10, r3: röstinmatningen (Sussa 3.1.3.2 och 3.1.3.7). Reglerna för röstkommandon och text i
// public/js/rost-regler.js, och att dikterad text märks och blir journal först när den är signerad. Själva
// taligenkänningen och diktatet i gränssnittet prövas i klickbudgeten (test/flodessteg.cjs) med en simulerad igenkänning.
// Testnamnen står i src/sussa/runda10-r3.js.
import { describe, test, expect } from 'bun:test';
import { byggSeed } from '../src/db.js';
import { Atkomst } from '../src/atkomst.js';
import * as journal from '../src/journal.js';
import * as R from '../public/js/rost-regler.js';
import { personal } from './hjalp.js';

const NU = new Date('2026-11-08T10:00:00Z');
const SOKORD = ['Aktuellt', 'Status', 'Bedömning', 'Åtgärd', 'Andning/cirkulation'];
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };

describe('Röstinmatning', () => {
  test('röstkommandon: skiljetecken, ny rad och byte av sökord tolkas, och systemet sätter stor bokstav i början av meningen', () => {
    const d = R.tolka('patienten mår bättre punkt hon har ätit frukost kommatecken druckit väl punkt nästa sökord opåverkad punkt gå till bedömning stabil ny rad fortsatt observation', { sokord: SOKORD });
    expect(d.map(x => x.typ === 'text' ? 'text' : x.kommando)).toEqual(['text', 'nasta', 'text', 'ga_till', 'text']);
    expect(d[3].sokord).toBe('Bedömning');
    expect(R.skriv('', d[0].ord)).toBe('Patienten mår bättre. Hon har ätit frukost, druckit väl.');
    expect(R.skriv('', d[4].ord)).toBe('Stabil\nFortsatt observation');
    // Texten läggs till efter det som redan står i fältet.
    expect(R.skriv('Pratar i telefon', R.tolka('och skrattar punkt')[0].ord)).toBe('Pratar i telefon och skrattar.');
    expect(R.skriv('Slutat röka.', ['hon', 'mår', 'bra'])).toBe('Slutat röka. Hon mår bra');
    // Ett sökord med snedstreck nås med orden i namnet, och ångra och sluta är kommandon.
    expect(R.tolka('gå till andning cirkulation', { sokord: SOKORD })[0]).toEqual({ typ: 'kommando', kommando: 'ga_till', sokord: 'Andning/cirkulation' });
    expect(R.tolka('ångra').map(x => x.kommando)).toEqual(['angra']);
    expect(R.tolka('sluta diktera').map(x => x.kommando)).toEqual(['sluta']);
    // Ordet komma är ett vanligt verb och blir inte ett kommatecken.
    expect(R.skriv('', R.tolka('ska komma tillbaka')[0].ord)).toBe('Ska komma tillbaka');
  });

  test('signering och andra beslut görs aldrig med rösten: kommandot signera ger en förklaring och inget händer', () => {
    const d = R.tolka('stabil punkt signera anteckningen');
    expect(d).toEqual([{ typ: 'text', ord: ['stabil', '.'] }, { typ: 'kommando', kommando: 'signera', text: R.SIGNERA_TEXT }]);
    expect(R.SIGNERA_TEXT).toContain('Rösten kan inte signera');
    expect(R.KOMMANDON.map(k => k.fras).join(' ')).not.toContain('signera');
  });

  test('dikterad text märks i anteckningen och blir journal för andra först när den är signerad', () => {
    const db = byggSeed(NU);
    const lak = new Atkomst(db, personal(db, 'lak-kard'), 'p01', {}, 'skriv_journal');
    const ny = journal.skapaAnteckning(lak, { typ: 'Daganteckning', sokord: [{ sokord: 'Aktuellt', text: 'Mår bättre.', inmatning: 'rost' }, { sokord: 'Bedömning', text: 'Stabil.', inmatning: 'tangentbord' }] });
    expect(ny.sokord).toEqual([{ sokord: 'Aktuellt', text: 'Mår bättre.', inmatning: 'rost' }, { sokord: 'Bedömning', text: 'Stabil.' }]);
    // Ett utkast syns bara för författaren.
    const ssk = new Atkomst(db, personal(db, 'ssk-kard'), 'p01', {}, 'las_journal');
    expect(journal.listaAnteckningar(ssk).anteckningar.some(a => a.id === ny.id)).toBe(false);
    expect(fel(() => journal.hamtaAnteckning(ssk, journal.hamtaAnteckningRad(db, ny.id)))).toMatchObject({ status: 404 });
    journal.signera(lak, journal.hamtaAnteckningRad(db, ny.id));
    const las = journal.hamtaAnteckning(ssk, journal.hamtaAnteckningRad(db, ny.id));
    expect(las.sokord[0]).toMatchObject({ inmatning: 'rost' });
    expect(las.signerad.av.id).toBe('lak-kard');
  });
});
