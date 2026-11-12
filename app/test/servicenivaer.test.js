// Runda 14, r5: incidentregistret, servicenivårapporten och incidentrapporten till beställaren (servicenivaer.js, Sussa
// KD1.2.1.1 till KD1.2.1.4, KD1.3.2.2, KD1.3.2.3 och 5.3.1.14). Tiderna skickas in som fasta värden, så att testerna
// inte beror på klockan.
import { describe, test, expect, afterAll } from 'bun:test';
import { nySessionsDb } from '../src/db.js';
import * as sn from '../src/servicenivaer.js';
import * as sakerhetslogg from '../src/sakerhetslogg.js';
import { kanRoll } from '../src/atkomst.js';
import { personal, testserver, klient } from './hjalp.js';

const T0 = new Date('2026-11-11T09:00:00Z');
const min = (n) => new Date(T0.getTime() + n * 60_000);
const ny = () => { const db = nySessionsDb(); return { db, sysf: personal(db, 'sysf') }; };
const STOPP = { kategori: 'drift', omfattning: 'alla', paverkan: 'stoppar' };

describe('Servicenivåer', () => {
  test('systemet sätter prioriteten enligt prioritetsmodellen i bilaga DU2 ur två frågor på vanlig svenska, och saknad redundans blir prioritet 2', () => {
    expect(sn.prioritet(STOPP).prioritet).toBe(1);
    expect(sn.prioritet({ omfattning: 'kritisk', paverkan: 'stoppar' }).prioritet).toBe(1);
    expect(sn.prioritet({ omfattning: 'alla', paverkan: 'begransar' }).prioritet).toBe(2);
    expect(sn.prioritet({ omfattning: 'alla', paverkan: 'vag_runt' }).prioritet).toBe(3);
    expect(sn.prioritet({ omfattning: 'fatal', paverkan: 'stoppar' }).prioritet).toBe(3);
    expect(sn.prioritet({ omfattning: 'ingen' }).prioritet).toBe(4);
    const r = sn.prioritet({ kategori: 'redundans' });
    expect(r.prioritet).toBe(2);
    expect(r.skal).toContain('KD1.2.1.4');
    expect(sn.prioritet(STOPP).skal).toContain('prioritet 1 (Kritisk)');
    expect(() => sn.prioritet({ omfattning: 'alla' })).toThrow(/Välj om vården kan arbeta/);
    expect(() => sn.prioritet({ omfattning: 'constructor', paverkan: 'stoppar' })).toThrow(/Välj hur många/);
    expect(sn.PRIORITETER[1].atgardTimmar).toBe(2);
    expect(sn.PRIORITETER[2].atgardTimmar).toBe(4);
    expect(sn.PRIORITETER[3].atgardTimmar).toBe(12);
    expect([sn.PRIORITETER[1].maxPerAr, sn.PRIORITETER[2].maxPerAr, sn.PRIORITETER[1].maxTimmarPerAr, sn.PRIORITETER[2].maxTimmarPerAr]).toEqual([3, 8, 4, 16]);
  });

  test('bara systemförvaltningen registrerar incidenter, och registreringen loggas i säkerhetsloggen utan incidentens text', () => {
    const { db, sysf } = ny();
    try {
      expect(kanRoll(sysf, 'servicenivaer')).toBe(true);
      for (const id of ['lak-kard', 'logg', 'adm-kard']) expect(() => sn.registrera(db, personal(db, id), { rubrik: 'Hemlig rubrik', ...STOPP }, T0)).toThrow(/Bara systemförvaltningen/);
      expect(() => sn.lista(db, personal(db, 'lak-kard'))).toThrow(/Bara systemförvaltningen/);
      const i = sn.registrera(db, sysf, { rubrik: 'Inloggningen svarar inte', ...STOPP, borjade: min(-10).toISOString() }, T0);
      expect(i.prioritet).toBe(1);
      expect(i.prioritetNamn).toBe('Kritisk');
      const rad = db.query("SELECT * FROM sakerhetslogg WHERE typ = 'incident' ORDER BY id DESC LIMIT 1").get();
      expect(rad.personal_id).toBe('sysf');
      expect(rad.beskrivning).toContain(`Incident ${i.id} registrerades`);
      expect(rad.beskrivning).not.toContain('Inloggningen svarar inte');
      expect(sakerhetslogg.verifiera(db).hel).toBe(true);
    } finally { db.close(); }
  });

  test('en incident tar inte emot patientuppgifter: en text som ser ut att innehålla ett personnummer stoppas', () => {
    const { db, sysf } = ny();
    try {
      for (const rubrik of ['Fel för 19121212-1212', 'Patienten 191212121212 kan inte öppnas', 'Fel för 121212-1212']) {
        expect(() => sn.registrera(db, sysf, { rubrik, ...STOPP }, T0)).toThrow(/Skriv inga patientuppgifter/);
      }
      expect(() => sn.registrera(db, sysf, { rubrik: 'Långsam lista', beskrivning: 'Gäller 20121212-1212', ...STOPP }, T0)).toThrow(/Skriv inga patientuppgifter/);
      expect(db.query('SELECT COUNT(*) AS n FROM incidenter').get().n).toBe(0);
      expect(() => sn.registrera(db, sysf, { rubrik: 12, ...STOPP }, T0)).toThrow(/ska vara text/);
      expect(() => sn.registrera(db, sysf, { rubrik: 'Ok', ...STOPP }, T0)).toThrow(/minst 3 tecken/);
      expect(() => sn.registrera(db, sysf, { rubrik: 'Fel i framtiden', ...STOPP, borjade: min(60).toISOString() }, T0)).toThrow(/framtiden/);
      expect(() => sn.registrera(db, sysf, { rubrik: 'Okänd kategori', kategori: '__proto__', ...{ omfattning: 'alla', paverkan: 'stoppar' } }, T0)).toThrow(/Okänd kategori/);
    } finally { db.close(); }
  });

  test('prioritet 1 som inte är löst inom 2 timmar startar processen för en större incident, och åtgärdstiden räknas mot gränsvärdet', () => {
    const { db, sysf } = ny();
    try {
      const i = sn.registrera(db, sysf, { rubrik: 'Hela systemet nere', ...STOPP, borjade: T0.toISOString() }, T0);
      const efter1 = sn.lista(db, sysf, min(60)).incidenter.find(x => x.id === i.id);
      expect(efter1.major.aktiv).toBe(false);
      expect(efter1.atgardstid.inomMal).toBe(true);
      const efter3 = sn.lista(db, sysf, min(180)).incidenter.find(x => x.id === i.id);
      expect(efter3.major.aktiv).toBe(true);
      expect(efter3.nasta).toContain('större incident (Major Incident)');
      expect(efter3.atgardstid.inomMal).toBe(false);
      expect(efter3.atgardstid.text).toBe('3 timmar');
    } finally { db.close(); }
  });

  test('prioritet 1 och 2 avslutas bara med orsak, konsekvens, åtgärd och förebyggande åtgärd, och uppföljningsmötet registreras efteråt', () => {
    const { db, sysf } = ny();
    try {
      const i = sn.registrera(db, sysf, { rubrik: 'Läkemedelslistan är långsam', omfattning: 'alla', paverkan: 'begransar', borjade: T0.toISOString() }, T0);
      expect(i.prioritet).toBe(2);
      expect(() => sn.avsluta(db, sysf, i.id, { orsak: 'Index saknades' }, min(90))).toThrow('Skriv konsekvensen, åtgärden och vad som görs för att det inte ska hända igen. En incident med prioritet 2 avslutas med underlaget till incidentuppföljningsmötet.');
      expect(() => sn.uppfoljning(db, sysf, i.id, {}, min(90))).toThrow(/Avsluta incidenten först/);
      const a = sn.avsluta(db, sysf, i.id, { orsak: 'Ett index saknades', konsekvens: 'Listan tog tio sekunder att öppna', atgard: 'Indexet lades till', forebyggande: 'Lasttestet prövar listan' }, min(90));
      expect(a.pagar).toBe(false);
      expect(a.atgardstid.minuter).toBe(90);
      // Först rapporten till beställaren, sedan mötet.
      expect(a.nasta).toContain('Rapportera till beställaren senast');
      sn.exportera(db, sysf, { fran: '2026-11-11', till: '2026-11-11' }, min(95));
      expect(sn.lista(db, sysf, min(96)).incidenter.find(x => x.id === i.id).nasta).toContain('Håll incidentuppföljningsmötet');
      expect(() => sn.avsluta(db, sysf, i.id, {}, min(91))).toThrow(/redan avslutad/);
      expect(() => sn.uppfoljning(db, sysf, i.id, { datum: '2026-11-20' }, min(100))).toThrow(/innan det har hållits/);
      const u = sn.uppfoljning(db, sysf, i.id, { datum: '2026-11-11' }, min(100));
      expect(u.uppfoljning.mote).toBe('2026-11-11');
      // Prioritet 3 avslutas utan underlag, och har inget uppföljningsmöte.
      const l = sn.registrera(db, sysf, { rubrik: 'Fel ikon i listan', omfattning: 'fatal', paverkan: 'vag_runt' }, T0);
      expect(sn.avsluta(db, sysf, l.id, {}, min(5)).pagar).toBe(false);
      expect(() => sn.uppfoljning(db, sysf, l.id, {}, min(6))).toThrow(/prioritet 1 och 2/);
      expect(() => sn.avsluta(db, sysf, 'abc', {}, min(6))).toThrow(/finns inte/);
    } finally { db.close(); }
  });

  test('systemet säger när beställaren ska ha rapporten om incidenten, och en personuppgiftsincident ska rapporteras inom 24 timmar', () => {
    const { db, sysf } = ny();
    try {
      const p1 = sn.registrera(db, sysf, { rubrik: 'Inloggningen svarar inte', ...STOPP }, T0);
      expect(p1.rapportering.senast).toBe(min(30).toISOString());
      expect(p1.nasta).toContain('Rapportera till beställaren senast');
      const p4 = sn.registrera(db, sysf, { rubrik: 'Fel färg på en knapp', omfattning: 'ingen' }, T0);
      expect(p4.rapportering.senast).toBeNull();
      expect(p4.rapportering.text).toBe('Redovisas i månadsrapporten.');
      const pu = sn.registrera(db, sysf, { rubrik: 'Fel mottagare för en utskrift', kategori: 'sakerhet', omfattning: 'fatal', paverkan: 'vag_runt', personuppgifter: true }, T0);
      expect(pu.personuppgifter).toBe(true);
      expect(pu.prioritet).toBe(3);
      expect(pu.rapportering.senast).toBe(min(24 * 60).toISOString());
      // Bara en säkerhetsincident kan vara en personuppgiftsincident.
      expect(sn.registrera(db, sysf, { rubrik: 'Långsam sökning', omfattning: 'fatal', paverkan: 'vag_runt', personuppgifter: true }, T0).personuppgifter).toBe(false);
      expect(() => sn.registrera(db, sysf, { rubrik: 'Långsam sökning', omfattning: 'fatal', paverkan: 'vag_runt', personuppgifter: 'ja' }, T0)).toThrow(/ja eller nej/);
      const sen = sn.lista(db, sysf, min(45)).incidenter.find(x => x.id === p1.id);
      expect(sen.rapportering.iTid).toBe(false);
      expect(sen.nasta).toContain('Rapportera till beställaren nu');
    } finally { db.close(); }
  });

  test('incidentrapporten till beställaren har incidenterna och säkerhetsloggens händelser per typ, utan patientuppgifter eller personer, markerar incidenterna som rapporterade och loggas', () => {
    const { db, sysf } = ny();
    try {
      const i = sn.registrera(db, sysf, { rubrik: 'Inloggningen svarar inte', ...STOPP }, T0);
      sakerhetslogg.logga(db, { typ: 'inloggning_misslyckad', personal_id: 'lak-kard', tid: min(1).toISOString(), beskrivning: 'Inloggningen misslyckades.' });
      expect(() => sn.exportera(db, personal(db, 'logg'), {}, min(10))).toThrow(/Bara systemförvaltningen/);
      expect(() => sn.exportera(db, sysf, { fran: '2026-11-12', till: '2026-11-11' }, min(10))).toThrow(/efter dess slut/);
      expect(() => sn.exportera(db, sysf, { fran: '2026-11-01', till: '2026-11-30' }, min(10))).toThrow(/framtiden/);
      const ut = sn.exportera(db, sysf, { fran: '2026-11-01', till: '2026-11-11' }, min(10));
      expect(ut.fil).toBe('incidentrapport-2026-11-01-2026-11-11.json');
      expect(ut.nyRapporterade).toBe(1);
      const r = ut.rapport;
      expect(r.incidenter.map(x => x.id)).toEqual([i.id]);
      expect(r.incidenter[0].rapporteradITid).toBe(true);
      expect(r.sakerhetslogg.handelser).toEqual(expect.arrayContaining([expect.objectContaining({ typ: 'inloggning_misslyckad', antal: 1 })]));
      const text = JSON.stringify(r);
      for (const s of ['sysf', 'lak-kard', 'Tomas Lindh', 'Sara Lindqvist', '19121212', 'personal_id', 'registrerad_av']) expect(text).not.toContain(s);
      expect(sn.lista(db, sysf, min(11)).incidenter[0].rapportering.rapporterad).toBe(min(10).toISOString());
      // En andra export markerar inget nytt.
      expect(sn.exportera(db, sysf, { fran: '2026-11-01', till: '2026-11-11' }, min(12)).nyRapporterade).toBe(0);
      expect(db.query("SELECT COUNT(*) AS n FROM sakerhetslogg WHERE typ = 'incidentrapport'").get().n).toBe(2);
    } finally { db.close(); }
  });

  test('månadsrapporten räknas ur incidentregistret och systemets mått: tillgänglighet, åtgärdstider mot gränsvärdena, året hittills, svarstider, kopior och säkerhetsloggen', () => {
    const { db, sysf } = ny();
    try {
      const nu = new Date('2026-11-20T12:00:00Z');
      // Två timmar och 30 minuter med prioritet 1 i november, och en incident i oktober som räknas till året.
      const a = sn.registrera(db, sysf, { rubrik: 'Systemet nere', ...STOPP, borjade: '2026-11-05T08:00:00Z' }, new Date('2026-11-05T08:05:00Z'));
      sn.avsluta(db, sysf, a.id, { orsak: 'Disken blev full', konsekvens: 'Ingen kunde logga in', atgard: 'Disken utökades', forebyggande: 'Larm vid 80 procent', tid: '2026-11-05T10:30:00Z' }, new Date('2026-11-05T10:31:00Z'));
      const b = sn.registrera(db, sysf, { rubrik: 'Systemet nere igen', ...STOPP, borjade: '2026-10-20T08:00:00Z' }, new Date('2026-10-20T08:01:00Z'));
      sn.avsluta(db, sysf, b.id, { orsak: 'Fel i en uppgradering', konsekvens: 'Ingen kunde logga in', atgard: 'Återgång till förra versionen', forebyggande: 'Provåterläsning före uppgradering', tid: '2026-10-20T09:00:00Z' }, new Date('2026-10-20T09:01:00Z'));
      const matning = [{ endpoint: '/api/patient/:id', p95: 120, inomMal: true }, { endpoint: '/api/sok', p95: 260, inomMal: false }];
      const kopior = { kopior: [{ tid: '2026-11-10T10:00:00Z', verifierad: true }, { tid: '2026-10-10T10:00:00Z', verifierad: true }], senasteVerifierade: { tid: '2026-11-10T10:00:00Z' }, platser: [{}, {}] };
      const r = sn.rapport(db, sysf, { manad: '2026-11', nu, matning, malP95: 200, kopior });
      expect(r.pagar).toBe(true);
      expect(r.nasta).toBeNull();
      expect(r.forra).toBe('2026-10');
      expect(r.tillganglighet.avbrottMinuter).toBe(150);
      const minuter = (Date.parse(nu) - Date.parse(r.fran)) / 60_000;
      expect(r.tillganglighet.utfall).toBe(Math.round((1 - 150 / minuter) * 100000) / 1000);
      const p1 = r.prioriteter.find(p => p.prioritet === 1);
      expect(p1.antal).toBe(1);
      expect(p1.overskridna).toBe(1);
      expect(p1.aretHittills.antal).toBe(2);
      expect(p1.aretHittills.minuter).toBe(210);
      expect(p1.aretHittills.overTid).toBe(false);
      expect(r.svarstider).toEqual(expect.objectContaining({ adresser: 2, overMal: 1, hogstaP95Ms: 260 }));
      expect(r.sakerhetskopior).toEqual({ antal: 1, verifierade: 1, senasteVerifierade: '2026-11-10T10:00:00Z', platser: 2 });
      expect(r.sakerhetslogg.kedjanHel).toBe(true);
      expect(r.sakerhetslogg.handelser.find(h => h.typ === 'incident').antal).toBe(2);
      expect(r.avvikelser).toEqual(expect.arrayContaining([
        expect.stringContaining('åtgärdades inte inom 2 timmar'),
        expect.stringContaining('krävde processen för en större incident'),
        expect.stringContaining('Incidentuppföljningsmötet för incident'),
        expect.stringContaining('p95 över målet 200 ms'),
      ]));
      expect(r.sammanfattning).toMatch(/avvikelser mot servicenivåerna hittills i månaden/);
      // Oktober har sin incident och en hel månad.
      const okt = sn.rapport(db, sysf, { manad: '2026-10', nu, matning: [], kopior: null });
      expect(okt.pagar).toBe(false);
      expect(okt.nasta).toBe('2026-11');
      expect(okt.tillganglighet.avbrottMinuter).toBe(60);
      expect(okt.sakerhetskopior).toBeNull();
      expect(() => sn.rapport(db, sysf, { manad: '2026-12', nu })).toThrow(/inte börjat/);
      expect(() => sn.rapport(db, sysf, { manad: '2026-13', nu })).toThrow(/ÅÅÅÅ-MM/);
      expect(() => sn.rapport(db, personal(db, 'lak-kard'), { manad: '2026-11', nu })).toThrow(/Bara systemförvaltningen/);
    } finally { db.close(); }
  });

  test('månaderna följer svensk tid, också över skiftet till vintertid', () => {
    const okt = sn.manadGranser('2026-10');
    expect(okt.fran).toBe('2026-09-30T22:00:00.000Z');
    expect(okt.till).toBe('2026-10-31T23:00:00.000Z');
    expect(sn.manadGranser('2026-12').nasta).toBe('2027-01');
    expect(sn.manadGranser('2026-01').forra).toBe('2025-12');
  });

  describe('API', () => {
    const app = testserver();
    afterAll(() => app.stopp());

    test('rutterna nekar annan roll än systemförvaltaren, och systemförvaltaren registrerar, avslutar, följer upp och tar ut rapporten', async () => {
      const k = klient(app);
      await k.post('/api/session', {});
      await k.logga('lak-kard');
      expect((await k.get('/api/servicenivaer/incidenter')).status).toBe(403);
      expect((await k.post('/api/servicenivaer/incidenter', { rubrik: 'Försök', ...STOPP })).status).toBe(403);
      expect((await k.get('/api/servicenivaer/rapport')).status).toBe(403);
      expect((await k.post('/api/servicenivaer/export', {})).status).toBe(403);
      await k.logga('sysf');
      const ny = await k.post('/api/servicenivaer/incidenter', { rubrik: 'Utskrifter fastnar', omfattning: 'fatal', paverkan: 'begransar' });
      expect(ny.status).toBe(201);
      expect(ny.data.prioritet).toBe(3);
      const l = await k.get('/api/servicenivaer/incidenter');
      expect(l.status).toBe(200);
      expect(l.data.incidenter.map(x => x.id)).toContain(ny.data.id);
      expect(Object.keys(l.data.val.omfattning)).toEqual(['alla', 'kritisk', 'fatal', 'ingen']);
      const r = await k.get('/api/servicenivaer/rapport');
      expect(r.status).toBe(200);
      expect(r.data.incidenter.map(x => x.id)).toContain(ny.data.id);
      // Systemförvaltaren har behörigheten för lagring och ser kopiorna i rapporten.
      expect(r.data.sakerhetskopior).not.toBeNull();
      expect((await k.get('/api/servicenivaer/rapport?manad=fel')).status).toBe(400);
      const av = await k.post(`/api/servicenivaer/incidenter/${ny.data.id}/avsluta`, {});
      expect(av.status).toBe(200);
      expect(av.data.pagar).toBe(false);
      const ex = await k.post('/api/servicenivaer/export', {});
      expect(ex.status).toBe(200);
      expect(ex.data.rapport.incidenter.map(x => x.id)).toContain(ny.data.id);
      expect(ex.data.nyRapporterade).toBe(1);
      expect((await k.post('/api/servicenivaer/incidenter/999999/avsluta', {})).status).toBe(404);
    }, 30_000);
  });
});
