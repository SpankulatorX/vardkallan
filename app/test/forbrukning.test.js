// Runda 9, r1: förbrukningsartiklar (Sussa 3.5.4.1 till 3.5.4.4). Förskrivning, förnyelse, ändring, utsättning och
// återinsättning per grupp, mallar ur läkemedelslistan, kontroller, behörighet, presentation med historik och API.
// Klockan styrs med setSystemTime och sandlådan byggs vid den tiden.
import { describe, test, expect, afterEach, afterAll } from 'bun:test';
import { aterstallKlockan, stallKlockan } from './falsk-klocka.js';
import { byggSeed, idag, addDagar, lokalTid } from '../src/db.js';
import * as forbrukning from '../src/forbrukning.js';
import { verifiera } from '../src/logg.js';
import { atk, testserver, klient } from './hjalp.js';

const kl = (k, dag = idag()) => lokalTid(dag, k);
function sandladaKl(k = '10:00') {
  stallKlockan(new Date(kl(k)));
  return byggSeed(new Date(kl(k)));
}
afterEach(() => aterstallKlockan());
const fel = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const lak = (db, pid, val = {}, id = 'lak-vc') => atk(db, id, pid, val, 'forskriva_forbrukning');
const las = (db, pid, id = 'lak-vc', val = {}) => atk(db, id, pid, val, 'las_lakemedel');
let app;
afterAll(() => app?.stop?.(true));

describe('Förbrukningsartiklar', () => {
  test('mall för den som tar insulin med penna: systemet föreslår pennkanyler, teststickor, lansetter och kanylburk med mängd ur läkemedelslistan och tar bort det som redan är förskrivet', () => {
    const db = sandladaKl();
    // Birgitta Nyman har Lantus med penna kl. 21, teststickor som gäller och lansetter som har gått ut.
    const l = forbrukning.lista(las(db, 'p06'));
    expect(l.giltiga.map(f => f.artikel.namn)).toEqual(['Teststickor för blodsocker']);
    expect(l.utgangna.map(f => f.artikel.namn)).toEqual(['Lansetter']);
    const m = l.forslag.find(x => x.id === 'insulin-penna');
    expect(m.varfor).toContain('insulin med penna');
    expect(m.artiklar.find(a => a.id === 'VK-FA-0001').redanForskriven).toBe(true);
    // En injektion per dygn i 90 dagar: en förpackning med 100 pennkanyler.
    expect(m.artiklar.find(a => a.id === 'VK-FA-0004').mangd).toMatchObject({ forpackningar: 1, perDygn: 1 });
    expect(m.artiklar.find(a => a.id === 'VK-FA-0004').mangd.varfor).toContain('1 injektion per dygn enligt läkemedelslistan');
    // Mallen för bara egenkontroll föreslås inte när mallen med penna gör det.
    expect(l.forslag.some(x => x.id === 'egenkontroll')).toBe(false);
    const ut = forbrukning.forskrivMall(lak(db, 'p06'), { mallId: 'insulin-penna' });
    expect(ut.forskrivningar.map(f => f.artikel.namn)).toEqual(['Pennkanyler 4 mm', 'Lansetter', 'Kanylburk 1,5 liter']);
    expect(ut.borttagna).toEqual([{ id: 'VK-FA-0001', namn: 'Teststickor för blodsocker', varfor: 'Redan förskriven och giltig.' }]);
    expect(ut.forskrivningar[0]).toMatchObject({ grupp: 'tillforsel', forpackningar: 1, uttag: 4, giltigTill: addDagar(idag(), 365), uppfoljning: { datum: addDagar(idag(), 335), ansvarig: { id: 'lak-vc' } }, nllStatus: 'kvitterad', mall: 'Insulin med penna' });
    expect(ut.forskrivningar[0].anvisning).toBe('En ny kanyl till varje injektion med insulinpennan.');
    expect(ut.nll).toMatchObject({ simulerad: true, status: 'kvitterad' });
    // Allt i mallen är nu förskrivet, och mallen föreslås inte längre.
    expect(forbrukning.lista(las(db, 'p06')).forslag.some(x => x.id === 'insulin-penna')).toBe(false);
    expect(fel(() => forbrukning.forskrivMall(lak(db, 'p06'), { mallId: 'insulin-penna' })).message).toContain('redan förskrivet');
  });

  test('ny förskrivning, ändring, förnyelse, utsättning och återinsättning för egenkontroll, tillförsel och stomi, med historik och överföring till NLL', () => {
    const db = sandladaKl();
    // Patienten får en kolostomi i diagnoslistan, så att stomimallen föreslås.
    db.query("INSERT INTO diagnoser (patient_id, enhet_id, kod, text, typ, datum) VALUES ('p06', 'vc-tybble', 'Z93.3', 'Kolostomi', 'bi', ?)").run(idag());
    expect(forbrukning.lista(las(db, 'p06')).forslag.find(x => x.id === 'stomi').artiklar.map(a => a.namn)).toEqual(['Stomipåse, sluten', 'Stomiplatta', 'Hudskyddsfilm']);
    for (const [artikelId, grupp] of [['VK-FA-0003', 'egenkontroll'], ['VK-FA-0005', 'tillforsel'], ['VK-FA-0007', 'stomi']]) {
      const ny = forbrukning.forskriv(lak(db, 'p06'), { artikelId, orsak: 'Test' });
      expect(ny.forskrivning).toMatchObject({ grupp, status: 'giltig', nllStatus: 'kvitterad' });
      const id = ny.id;
      const andrad = forbrukning.andra(lak(db, 'p06'), id, { uttag: 2 });
      expect(andrad.forskrivning.uttag).toBe(2);
      expect(fel(() => forbrukning.andra(lak(db, 'p06'), id, {})).message).toBe('Inget är ändrat.');
      stallKlockan(new Date(Date.now() + 100 * 86400_000));
      const fornyad = forbrukning.fornya(lak(db, 'p06'), id);
      expect(fornyad.forskrivning.giltigTill).toBe(addDagar(idag(), 365));
      expect(fel(() => forbrukning.sattUt(lak(db, 'p06'), id, { orsak: '' })).message).toContain('varför förskrivningen sätts ut');
      const ut = forbrukning.sattUt(lak(db, 'p06'), id, { orsak: 'Behövs inte längre' });
      expect(ut.forskrivning).toMatchObject({ status: 'utsatt', utsatt: { av: 'Per Holm', orsak: 'Behövs inte längre' } });
      expect(fel(() => forbrukning.fornya(lak(db, 'p06'), id)).message).toContain('Sätt in den igen');
      const insatt = forbrukning.atersatt(lak(db, 'p06'), id, { orsak: 'Behövs igen efter sjukhusvistelse' });
      expect(insatt.forskrivning.status).toBe('giltig');
      // Historiken har varje händelse med vem och när, och inget raderas.
      expect(insatt.forskrivning.historik.map(h => h.handelse)).toEqual(['forskriven', 'andrad', 'fornyad', 'utsatt', 'atersatt']);
      expect(insatt.forskrivning.historik.every(h => h.av === 'Per Holm' && h.tid && h.enhet.id === 'vc-tybble')).toBe(true);
      stallKlockan(new Date(kl('10:00')));
    }
    expect(() => db.query('DELETE FROM forbrukningsforskrivningar').run()).toThrow();
    expect(() => db.query("UPDATE forbrukning_historik SET detalj = 'x'").run()).toThrow();
    expect(() => db.query("UPDATE forbrukningsforskrivningar SET forskriven_av = 'lak-kard'").run()).toThrow();
    expect(verifiera(db).hel).toBe(true);
  });

  test('kontroller: en dubbelförskrivning stoppas med förslag om förnyelse, en stor mängd kräver motivering och en artikel som inte passar listan ger en observation', () => {
    const db = sandladaKl();
    const e = fel(() => forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0001' }));
    expect(e.message).toContain('redan förskriven och giltig');
    expect(e.message).toContain('Förnya eller ändra');
    const stor = fel(() => forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0004', forpackningar: 10 }));
    expect(stor.extra.kraverKvittens).toEqual(['stor_mangd']);
    expect(stor.extra.varningar[0].text).toContain('systemet räknar till 1');
    const ok = forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0004', forpackningar: 10, kvitteradeVarningar: [{ regel: 'stor_mangd', motivering: 'Patienten reser bort i fyra månader' }] });
    expect(ok.forskrivning.historik[0].detalj).toContain('Patienten reser bort');
    // Stomiartiklar utan stomi i diagnoserna ger en observation, och en okänd artikel och fel giltighet stoppas.
    expect(forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0008' }).varningar.map(v => v.regel)).toEqual(['ingen_stomi']);
    expect(fel(() => forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'constructor' })).extra.falt).toEqual(['artikelId']);
    expect(fel(() => forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0009', giltigTill: addDagar(idag(), 800) })).extra.falt).toEqual(['giltigTill']);
    // Pennkanyler till en patient utan insulin.
    expect(forbrukning.forskriv(lak(db, 'p04', {}, 'lak-kard'), { artikelId: 'VK-FA-0004' }).varningar.map(v => v.regel)).toEqual(['passar_inte_listan']);
  });

  test('en förskrivning från en annan förskrivare registreras med vem och när, utan att skickas till NLL', () => {
    const db = sandladaKl();
    const ut = forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0003', extern: { forskrivare: 'Diabetesmottagningen, demovårdgivare', datum: addDagar(idag(), -10) } });
    expect(ut.forskrivning).toMatchObject({ extern: true, nllStatus: 'finns_i_nll', externForskrivare: `Diabetesmottagningen, demovårdgivare, ${addDagar(idag(), -10)}` });
    expect(ut.nll).toBeNull();
    expect(ut.forskrivning.historik[0]).toMatchObject({ handelse: 'registrerad_extern', text: 'Registrerad från annan förskrivare' });
    expect(fel(() => forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0005', extern: { forskrivare: 'X', datum: idag() } })).extra.falt).toEqual(['extern']);
  });

  test('presentation: filtrering på grupp, sortering och uppföljning med vem och när', () => {
    const db = sandladaKl();
    forbrukning.forskrivMall(lak(db, 'p06'), { mallId: 'insulin-penna' });
    forbrukning.forskriv(lak(db, 'p06'), { artikelId: 'VK-FA-0003', uppfoljning: addDagar(idag(), 10) });
    const tillforsel = forbrukning.lista(las(db, 'p06'), { grupp: 'tillforsel' });
    expect(new Set(tillforsel.giltiga.map(f => f.grupp))).toEqual(new Set(['tillforsel']));
    expect(tillforsel.filter.grupp).toBe('tillforsel');
    const art = forbrukning.lista(las(db, 'p06'), { sortering: 'artikel' }).giltiga.map(f => f.artikel.namn);
    expect(art).toEqual([...art].sort((a, b) => a.localeCompare(b, 'sv')));
    const uppf = forbrukning.lista(las(db, 'p06'), { sortering: 'uppfoljning' }).giltiga;
    expect(uppf[0]).toMatchObject({ artikel: { namn: 'Teststickor för keton' }, uppfoljning: { datum: addDagar(idag(), 10), ansvarig: { namn: 'Per Holm' } } });
    // Översikten: antal giltiga och de som ska följas upp inom 30 dagar.
    expect(forbrukning.oversikt(las(db, 'p06'))).toMatchObject({ giltiga: 5, uppfoljning: [{ artikel: 'Teststickor för keton', datum: addDagar(idag(), 10) }] });
    // En grupp som inte finns ger hela listan.
    expect(forbrukning.lista(las(db, 'p06'), { grupp: 'constructor' }).filter.grupp).toBeNull();
  });

  test('behörighet: undersköterskan och nödåtkomst förskriver inte, en annan vårdenhet ändrar inte, och en spärrad vårdenhets förskrivning röjs inte', () => {
    const db = sandladaKl();
    expect(fel(() => forbrukning.forskriv(atk(db, 'usk-kard', 'p01', {}, 'forskriva_forbrukning'), { artikelId: 'VK-FA-0001' })).status).toBe(403);
    expect(forbrukning.lista(atk(db, 'usk-kard', 'p01', {}, 'las_lakemedel')).kan.kan).toBe(false);
    // Akutläkaren med nödåtkomst ser listan men förskriver inte.
    const nod = atk(db, 'lak-akut', 'p06', { nodatkomst: { syfte: 'Akut' } }, 'forskriva_forbrukning');
    expect(fel(() => forbrukning.forskriv(nod, { artikelId: 'VK-FA-0003' })).status).toBe(403);
    // Akutens läkare ser kardiologens förskrivning i den gemensamma listan men ändrar den inte.
    const kardF = forbrukning.forskriv(atk(db, 'lak-kard', 'p01', {}, 'forskriva_forbrukning'), { artikelId: 'VK-FA-0003' });
    const akut = atk(db, 'lak-akut', 'p01', {}, 'forskriva_forbrukning');
    expect(forbrukning.lista(atk(db, 'lak-akut', 'p01', {}, 'las_lakemedel')).giltiga.some(f => f.id === kardF.id)).toBe(true);
    const annan = fel(() => forbrukning.andra(akut, kardF.id, { uttag: 2 }));
    expect(annan.status).toBe(403);
    expect(annan.message).toContain('på den vårdenhet där den gjordes');
    // Patient 4 har spärrat psykiatrin. En förskrivning där syns inte för kardiologen och ändrar inte svaret alls.
    const fore = JSON.stringify(forbrukning.lista(las(db, 'p04', 'lak-kard')));
    const psyk = forbrukning.forskriv(atk(db, 'lak-psyk', 'p04', {}, 'forskriva_forbrukning'), { artikelId: 'VK-FA-0003' });
    const efter = JSON.stringify(forbrukning.lista(las(db, 'p04', 'lak-kard')));
    expect(efter).toBe(fore);
    expect(JSON.parse(efter).giltiga).toEqual([]);
    expect(fel(() => forbrukning.sattUt(atk(db, 'lak-kard', 'p04', {}, 'forskriva_forbrukning'), psyk.id, { orsak: 'Prov' })).status).toBe(404);
    // Med samtycke syns den.
    expect(forbrukning.lista(las(db, 'p04', 'lak-kard', { samtycke_sparr: true })).giltiga.some(f => f.id === psyk.id)).toBe(true);
    // En spärrad förskrivning styr inte förslagen eller dubblettkontrollen: kardiologen kan förskriva samma artikel.
    expect(forbrukning.forskriv(atk(db, 'lak-kard', 'p04', {}, 'forskriva_forbrukning'), { artikelId: 'VK-FA-0003' }).forskrivning.status).toBe('giltig');
  });

  test('API: lista, mall, ändring, förnyelse, utsättning och återinsättning med loggning, och sjuksköterskan förskriver', async () => {
    app = app ?? testserver();
    const k = klient(app);
    await k.logga('lak-vc');
    const l = await k.get('/api/patient/p06/forbrukning');
    expect(l.status).toBe(200);
    expect(l.data.forslag.length).toBeGreaterThan(0);
    const m = await k.post('/api/patient/p06/forbrukning/mall', { mallId: 'insulin-penna' });
    expect(m.status).toBe(201);
    const id = m.data.forskrivningar[0].id;
    expect((await k.post(`/api/forbrukning/${id}/andra`, { uttag: 2 })).data.forskrivning.uttag).toBe(2);
    expect((await k.post(`/api/forbrukning/${id}/fornya`, {})).status).toBe(200);
    expect((await k.post(`/api/forbrukning/${id}/utsatt`, { orsak: 'Byter till insulinpump' })).data.forskrivning.status).toBe('utsatt');
    expect((await k.post(`/api/forbrukning/${id}/atersatt`, { orsak: 'Pumpen fungerade inte' })).data.forskrivning.status).toBe('giltig');
    await k.logga('ssk-vc');
    const ssk = await k.post('/api/patient/p06/forbrukning', { artikelId: 'VK-FA-0003' });
    expect(ssk.status).toBe(201);
    expect(ssk.data.forskrivning.forskriven.av.namn).toBe('Hanna Lilja');
    const db = app.sessioner.get(k.kaka().split('=')[1]).db;
    const resurser = db.query("SELECT resurs FROM atkomstlogg WHERE patient_id = 'p06' AND handling = 'forskriva_forbrukning'").all().map(r => r.resurs);
    expect(resurser).toEqual(expect.arrayContaining([`forbrukning:${id}`, `forbrukning:${id}:andra`, `forbrukning:${id}:fornya`, `forbrukning:${id}:utsatt`, `forbrukning:${id}:atersatt`]));
  });
});
