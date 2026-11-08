// Runda 9, r7: folkhälsoarbetet enligt arbetsprocessen i kravspecifikationens figur 5 (Sussa 6.2.2.1): datainsamling,
// databehandling, befolkningsanalys, rekommendationer och notifieringar, och uppföljning.
//
//   Datainsamling      levnadsvanorna dokumenteras strukturerat (tobak.js och levnadsvanor.js), tillsammans med
//                      diagnoser, mätvärden, läkemedel, vårdkontakter, listning och demografi som systemet redan har.
//   Databehandling     systemet räknar risken per levnadsvana ur svaren, BMI ur vikt och längd och ålder ur
//                      personnumret, och översätter allt till samma villkor (analys.js).
//   Befolkningsanalys  en folkhälsoinsats startar med en riskgrupp ur patientgrupperingen (Sussa 6.2.1.2): patienterna
//                      med en viss ohälsosam levnadsvana, eventuellt med fler villkor. Gruppen sparas som den var vid
//                      starten, så att utfallet går att följa.
//   Rekommendationer   för varje patient i insatsen föreslår systemet stödet ur Socialstyrelsens riktlinjer med KVÅ-kod,
//                      och förslaget visas i patientens översikt för den som kan ge stödet. Vårdenheten ser hur många
//                      som väntar på stöd.
//   Uppföljning        andelen som har fått stöd och andelen vars senaste dokumentation inte längre visar risk, mot
//                      målet för insatsen. Uppföljningsrollen ser alla insatser som antal för hela vårdgivaren.
//
// Behörigheten är patientgrupperingens: läkare och sjuksköterskor startar och följer insatser för patienter som de har
// vårdrelation till på den egna vårdenheten, och utfallet räknas bara på uppgifter från den egna vårdenheten.
import { Fel, iso, idag, addDagar } from './db.js';
import { kanRoll, vardenhetFor, visningsnamn, visningsPnr, alder as alderAv, prova } from './atkomst.js';
import { loggaRad } from './logg.js';
import * as analys from './analys.js';
import * as LV from '../public/js/levnadsvanor-regler.js';
import * as TB from '../public/js/tobak-regler.js';

export const SCHEMA = `
-- En folkhälsoinsats på en vårdenhet: en riskgrupp för en levnadsvana, ett mål för andelen som får stöd och ett datum
-- för utvärderingen. villkor är patientgrupperingens villkor (JSON). Raden ändras bara när insatsen avslutas.
CREATE TABLE IF NOT EXISTS folkhalsoinsatser (
  id INTEGER PRIMARY KEY, enhet_id TEXT NOT NULL, skapad_av TEXT NOT NULL, namn TEXT NOT NULL, omrade TEXT NOT NULL, villkor TEXT NOT NULL,
  mal_andel INTEGER NOT NULL, startad TEXT NOT NULL, utvarderas TEXT NOT NULL, avslutad TEXT
);
-- Patienterna i riskgruppen när insatsen startade. Raderna ändras och raderas aldrig.
CREATE TABLE IF NOT EXISTS folkhalsoinsats_patienter (
  insats_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, risk_text TEXT, PRIMARY KEY (insats_id, patient_id)
);
CREATE TRIGGER IF NOT EXISTS folkhalsoinsats_patienter_andras_ej BEFORE UPDATE ON folkhalsoinsats_patienter BEGIN SELECT RAISE(ABORT, 'Riskgruppen vid starten ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS folkhalsoinsats_patienter_raderas_ej BEFORE DELETE ON folkhalsoinsats_patienter BEGIN SELECT RAISE(ABORT, 'Riskgruppen vid starten raderas inte'); END;
`;
export function sakra(db) { db.exec(SCHEMA); }

// Stödet som räknas för varje område, och det som systemet föreslår.
export const OMRADEN = {
  tobak: { namn: 'Tobak', risk: 'Tobaksbruk där systemet föreslår stöd', koder: Object.keys(TB.KVA_TOBAK), forslag: 'DV113' },
  alkohol: { namn: 'Alkohol', risk: LV.OMRADEN.alkohol.risk, koder: ['DV121', 'DV122', 'DV123'], forslag: 'DV122' },
  fysisk: { namn: 'Fysisk aktivitet', risk: LV.OMRADEN.fysisk.risk, koder: ['DV131', 'DV132', 'DV133', 'DV200'], forslag: 'DV132' },
  mat: { namn: 'Matvanor', risk: LV.OMRADEN.mat.risk, koder: ['DV141', 'DV142', 'DV143'], forslag: 'DV142' },
};
const KVA = { ...TB.KVA_TOBAK, ...LV.KVA_LEVNADSVANOR };
const MAX_AKTIVA = 20;

function krav(db, personal, handling = 'patientgrupp') {
  if (kanRoll(personal, handling)) return;
  loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling, resurs: 'folkhalsa', grund: 'nekad', resultat: 'nekad' });
  throw new Fel(403, 'Folkhälsoinsatserna är för läkare och sjuksköterskor på vårdenheten.', 'nekad');
}

// POST /api/folkhalsa/insatser { omrade, villkor?, namn?, malAndel?, utvarderas? }. Systemet sätter namn, mål och datum
// för utvärderingen om de saknas, och sparar riskgruppen som den är i dag.
export function starta(db, personal, inp = {}) {
  krav(db, personal);
  const omr = OMRADEN[inp.omrade] ? inp.omrade : null;
  if (!omr) throw new Fel(400, 'Välj levnadsvanan som insatsen gäller: tobak, alkohol, fysisk aktivitet eller matvanor.', 'ogiltig', { falt: ['omrade'] });
  const ve = vardenhetFor(db, personal.enhet_id);
  if (db.query('SELECT count(*) AS n FROM folkhalsoinsatser WHERE enhet_id = ? AND avslutad IS NULL').get(ve).n >= MAX_AKTIVA) throw new Fel(400, `Vårdenheten har redan ${MAX_AKTIVA} pågående insatser. Avsluta en innan du startar en ny.`, 'ogiltig');
  const extra = inp.villkor && typeof inp.villkor === 'object' ? inp.villkor : {};
  const villkor = analys.provaVillkor({ ...extra, levnadsvanor: [omr] });
  const mal = inp.malAndel == null || inp.malAndel === '' ? 50 : Number(inp.malAndel);
  if (!Number.isInteger(mal) || mal < 1 || mal > 100) throw new Fel(400, 'Målet anges som en andel i procent mellan 1 och 100.', 'ogiltig', { falt: ['malAndel'] });
  const utv = inp.utvarderas ?? addDagar(idag(), 180);
  if (typeof utv !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(utv) || utv <= idag()) throw new Fel(400, 'Utvärderingen ska ligga efter i dag. Skriv datumet som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: ['utvarderas'] });
  const enhetNamn = db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn;
  const namn = typeof inp.namn === 'string' && inp.namn.trim() ? inp.namn.trim().slice(0, 80) : `${OMRADEN[omr].risk}, ${enhetNamn}`;
  const { traffar } = analys.traffar(db, personal, villkor, 'enhet');
  const id = db.transaction(() => {
    const r = db.query('INSERT INTO folkhalsoinsatser (enhet_id, skapad_av, namn, omrade, villkor, mal_andel, startad, utvarderas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(ve, personal.id, namn, omr, JSON.stringify(villkor), mal, iso(), utv);
    const iid = Number(r.lastInsertRowid);
    for (const t of traffar) db.query('INSERT INTO folkhalsoinsats_patienter (insats_id, patient_id, enhet_id, risk_text) VALUES (?, ?, ?, ?)').run(iid, t.p.id, ve, t.skal.join('. '));
    return iid;
  })();
  return insats(db, personal, id);
}

const insatsRad = (db, personal, id) => {
  const r = /^\d{1,9}$/.test(String(id)) ? db.query('SELECT * FROM folkhalsoinsatser WHERE id = ?').get(Number(id)) : null;
  if (!r || r.enhet_id !== vardenhetFor(db, personal.enhet_id)) throw new Fel(404, 'Insatsen finns inte.', 'saknas');
  return r;
};

// Status för varje patient i insatsen, räknat på uppgifter från vårdenheten: stöd givet efter starten, och om den
// senaste dokumentationen efter starten inte längre visar risk. Varje patient prövas först i behörighetsmotorn
// (vårdrelation, spärr och inre sekretess, utan aktiva val), och en patient som den inloggade inte får se kommer inte
// med alls, inte heller i antalen.
function utfall(db, personal, r, u) {
  const def = OMRADEN[r.omrade];
  const pats = db.query('SELECT * FROM folkhalsoinsats_patienter WHERE insats_id = ? ORDER BY patient_id').all(r.id)
    .map(x => ({ x, a: prova(db, { personal, patient: x.patient_id, handling: 'las_omvardnad', resurs: { enhet_id: r.enhet_id } }) }))
    .filter(({ a }) => a.tillaten);
  return pats.map(({ x, a }) => {
    const stod = (u.atgarder.get(x.patient_id) ?? []).filter(a => u.far(x.patient_id, a.enhet_id) && def.koder.includes(a.kod) && a.tid >= r.startad).sort((a, b) => b.tid.localeCompare(a.tid))[0] ?? null;
    const senaste = analys.levnadsvana(u, x.patient_id, r.omrade);
    const forbattrad = Boolean(senaste && senaste.tid > r.startad && !senaste.risk);
    const status = forbattrad ? 'forbattrad' : stod ? 'stod_givet' : 'vantar_stod';
    return { x, stod, senaste, forbattrad, status, grund: a.grund };
  });
}
const STATUS = { forbattrad: 'Ingen risk vid senaste dokumentationen', stod_givet: 'Har fått stöd', vantar_stod: 'Väntar på stöd' };

function insatsUt(db, personal, r, { medPatienter = false } = {}) {
  const u = analys.underlag(db, personal, 'enhet');
  const rader = utfall(db, personal, r, u);
  const n = rader.length;
  const andel = (k) => (n ? Math.round(k / n * 100) : null);
  const stodN = rader.filter(x => x.stod || x.forbattrad).length;
  const forbN = rader.filter(x => x.forbattrad).length;
  const forslag = OMRADEN[r.omrade].forslag;
  const ut = {
    id: r.id, namn: r.namn, omrade: r.omrade, omradeNamn: OMRADEN[r.omrade].namn, villkor: JSON.parse(r.villkor), text: analys.beskriv(JSON.parse(r.villkor)),
    startad: r.startad, utvarderas: r.utvarderas, avslutad: r.avslutad, malAndel: r.mal_andel,
    skapadAv: db.query('SELECT namn FROM personal WHERE id = ?').get(r.skapad_av)?.namn ?? null,
    antal: n, stod: stodN, forbattrade: forbN, vantar: n - stodN, andelStod: andel(stodN), andelForbattrade: andel(forbN),
    malUppnatt: n ? andel(stodN) >= r.mal_andel : false,
    forslag: { kod: forslag, text: KVA[forslag] },
    sammanfattning: n ? `${stodN} av ${n} har fått stöd (${andel(stodN)} procent, målet är ${r.mal_andel} procent). ${forbN} har ingen risk vid den senaste dokumentationen.` : 'Ingen patient på vårdenheten hörde till riskgruppen när insatsen startade.',
  };
  if (medPatienter) {
    const t = iso();
    ut.patienter = rader.map(({ x, stod, status, grund }) => {
      const p = db.query('SELECT * FROM patienter WHERE id = ?').get(x.patient_id);
      loggaRad(db, { tid: t, personal_id: personal.id, enhet_id: personal.enhet_id, patient_id: p.id, handling: 'patientgrupp', resurs: `folkhalsa:${r.id}`, grund, resultat: 'tillaten' });
      return { id: p.id, namn: visningsnamn(p), personnummer: visningsPnr(p), skyddad: Boolean(p.skyddad), alder: alderAv(p.fodd, idag()), status, statusText: STATUS[status],
        riskVidStart: x.risk_text, stod: stod ? { kod: stod.kod, text: KVA[stod.kod], tid: stod.tid } : null,
        rekommendation: status === 'vantar_stod' ? `Erbjud ${KVA[forslag].toLowerCase()} (KVÅ ${forslag}).` : null };
    });
  }
  return ut;
}

export function insats(db, personal, id) {
  krav(db, personal);
  return insatsUt(db, personal, insatsRad(db, personal, id), { medPatienter: true });
}

export function avsluta(db, personal, id) {
  krav(db, personal);
  const r = insatsRad(db, personal, id);
  if (r.avslutad) throw new Fel(409, 'Insatsen är redan avslutad.', 'ogiltig');
  db.query('UPDATE folkhalsoinsatser SET avslutad = ? WHERE id = ?').run(iso(), r.id);
  return insatsUt(db, personal, insatsRad(db, personal, r.id));
}

// GET /api/folkhalsa: vårdenhetens insatser utan patienter, eller alla insatser som antal för uppföljningsrollen.
export function oversikt(db, personal) {
  if (kanRoll(personal, 'statistik_region')) {
    loggaRad(db, { personal_id: personal.id, enhet_id: personal.enhet_id, handling: 'statistik_region', resurs: 'folkhalsa', grund: 'uppfoljning', resultat: 'tillaten' });
    const skydda = (n) => (n > 0 && n < analys.MINSTA_ANTAL ? null : n);
    return {
      niva: 'region',
      insatser: db.query('SELECT * FROM folkhalsoinsatser ORDER BY startad DESC').all().map(r => {
        const pats = db.query('SELECT patient_id FROM folkhalsoinsats_patienter p JOIN patienter x ON x.id = p.patient_id WHERE insats_id = ? AND x.skyddad = 0').all(r.id);
        return { id: r.id, namn: r.namn, omradeNamn: OMRADEN[r.omrade].namn, vardenhet: db.query('SELECT namn FROM enheter WHERE id = ?').get(r.enhet_id)?.namn, startad: r.startad, utvarderas: r.utvarderas, avslutad: r.avslutad, malAndel: r.mal_andel, antal: skydda(pats.length) };
      }),
      anmarkning: `Antal patienter i riskgruppen när insatsen startade, utan personuppgifter. Antal mellan 1 och ${analys.MINSTA_ANTAL - 1} visas inte.`,
    };
  }
  krav(db, personal);
  const ve = vardenhetFor(db, personal.enhet_id);
  return {
    niva: 'enhet', omraden: Object.entries(OMRADEN).map(([id, o]) => ({ id, namn: o.namn, risk: o.risk, forslag: { kod: o.forslag, text: KVA[o.forslag] } })),
    insatser: db.query('SELECT * FROM folkhalsoinsatser WHERE enhet_id = ? ORDER BY avslutad IS NOT NULL, startad DESC').all(ve).map(r => insatsUt(db, personal, r)),
  };
}

// Översikten för en patient: de pågående insatserna på den egna vårdenheten där patienten väntar på stöd, med systemets
// rekommendation. Bara för den som kan ge stödet.
export function forPatient(atk) {
  const db = atk.db;
  if (!kanRoll(atk.personal, 'patientgrupp')) return null;
  if (!db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'folkhalsoinsatser'").get()) return null;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const rader = db.query('SELECT i.* FROM folkhalsoinsatser i JOIN folkhalsoinsats_patienter p ON p.insats_id = i.id WHERE p.patient_id = ? AND i.enhet_id = ? AND i.avslutad IS NULL').all(atk.patientId, ve);
  if (!rader.length) return [];
  const u = analys.underlag(db, atk.personal, 'enhet');
  return rader.map(r => ({ r, s: utfall(db, atk.personal, r, u).find(x => x.x.patient_id === atk.patientId) }))
    .filter(({ s }) => s && s.status === 'vantar_stod')
    .map(({ r }) => ({ insatsId: r.id, namn: r.namn, kod: OMRADEN[r.omrade].forslag, text: `Patienten ingår i insatsen ${r.namn}. Erbjud ${KVA[OMRADEN[r.omrade].forslag].toLowerCase()} (KVÅ ${OMRADEN[r.omrade].forslag}) och dokumentera levnadsvanorna.` }));
}

// Seeden: levnadsvanor för några patienter på Vårdcentralen Tybble och en pågående insats mot riskbruk av alkohol.
export function seeda(db, bas = new Date()) {
  if (db.query('SELECT 1 FROM folkhalsoinsatser LIMIT 1').get()) return;
  const kontakt = (pid) => db.query("SELECT id FROM vardkontakter WHERE patient_id = ? AND enhet_id = 'vc-tybble' ORDER BY start DESC LIMIT 1").get(pid)?.id ?? null;
  const tid = (dagar) => new Date(bas.getTime() - dagar * 86400_000).toISOString();
  const levnadsvanor = require('./levnadsvanor.js');
  const NOTER = [
    { pid: 'p01', dagar: 120, av: 'ssk-vc', svar: { alkohol: { glasPerVecka: 14, berusning: 'manad' }, fysisk: { traningMinuter: 0, vardagMinuter: 60 }, stod: { alkohol: 'accepterat', fysisk: 'avbojt' }, givet: {} } },
    { pid: 'p14', dagar: 110, av: 'ssk-vc', svar: { alkohol: { glasPerVecka: 18, berusning: 'vecka' }, stod: { alkohol: 'avbojt' }, givet: {} } },
    { pid: 'p10', dagar: 100, av: 'ssk-vc', svar: { alkohol: { glasPerVecka: 12, berusning: 'sallan' }, stod: { alkohol: 'accepterat' }, givet: {} } },
    { pid: 'p06', dagar: 90, av: 'ssk-vc', svar: { mat: { gronsaker: '1', frukt: '0', fisk: '0', sotsaker: '1' }, fysisk: { traningMinuter: 20, vardagMinuter: 90 }, stod: { mat: 'accepterat', fysisk: 'accepterat' }, givet: { mat: true } } },
    { pid: 'p11', dagar: 80, av: 'ssk-vc', svar: { alkohol: { glasPerVecka: 3, berusning: 'aldrig' }, fysisk: { traningMinuter: 120, vardagMinuter: 150 } } },
  ];
  const ins = (n, extraTid = null) => {
    const k = kontakt(n.pid);
    if (!k) return null;
    const p = db.query('SELECT fodd FROM patienter WHERE id = ?').get(n.pid);
    if (!p) return null;
    const alder = alderAv(p.fodd, (extraTid ?? tid(n.dagar)).slice(0, 10));
    const pr = LV.prova(n.svar, { alder });
    if (!pr.ok) throw new Error(`Seeden för levnadsvanor: ${pr.varfor}`);
    const t = extraTid ?? tid(n.dagar);
    const r = db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av)
      VALUES (?, 'vc-tybble', ?, ?, 'omvardnad', ?, ?, ?, 'signerad', ?, ?)`).run(n.pid, k, levnadsvanor.TYP, JSON.stringify(LV.sokord(pr.varde, { alder })), n.av, t, t, n.av);
    const id = Number(r.lastInsertRowid);
    const risk = LV.risk(pr.varde, { alder });
    const forslag = LV.forslag(pr.varde, { alder });
    db.query('INSERT INTO levnadsvanor (anteckning_id, svar, risk, forslag, alder, sparad) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, JSON.stringify(pr.varde), JSON.stringify(Object.fromEntries(Object.entries(risk).map(([o, x]) => [o, x.risk]))), JSON.stringify(Object.fromEntries(Object.entries(forslag).filter(([, x]) => x.kod).map(([o, x]) => [o, x.kod]))), alder, t);
    for (const [omr, g] of Object.entries(pr.varde.givet ?? {})) if (g && forslag[omr]?.kod) db.query('INSERT INTO atgarder (patient_id, enhet_id, vardkontakt_id, kod, tid, av, underlag) VALUES (?, ?, ?, ?, ?, ?, ?)').run(n.pid, 'vc-tybble', k, forslag[omr].kod, t, n.av, JSON.stringify({ anteckning: id }));
    return id;
  };
  for (const n of NOTER) ins(n);
  // Insatsen startade för 60 dagar sedan med riskgruppen för alkohol som den var då.
  const start = tid(60);
  const villkor = analys.provaVillkor({ levnadsvanor: ['alkohol'], period: { fran: addDagar(start.slice(0, 10), -365), till: start.slice(0, 10) } });
  const r = db.query("INSERT INTO folkhalsoinsatser (enhet_id, skapad_av, namn, omrade, villkor, mal_andel, startad, utvarderas) VALUES ('vc-tybble', 'lak-vc', ?, 'alkohol', ?, 60, ?, ?)")
    .run('Riskbruk av alkohol, Vårdcentralen Tybble', JSON.stringify(villkor), start, addDagar(start.slice(0, 10), 180));
  const iid = Number(r.lastInsertRowid);
  for (const pid of ['p01', 'p14', 'p10']) if (kontakt(pid)) db.query("INSERT INTO folkhalsoinsats_patienter (insats_id, patient_id, enhet_id, risk_text) VALUES (?, ?, 'vc-tybble', 'Riskbruk av alkohol')").run(iid, pid);
  // Efter starten: Gunnar fick rådgivande samtal, och Karl-Eriks nya dokumentation visar inget riskbruk.
  const k1 = kontakt('p01');
  if (k1) db.query("INSERT INTO atgarder (patient_id, enhet_id, vardkontakt_id, kod, tid, av) VALUES ('p01', 'vc-tybble', ?, 'DV122', ?, 'ssk-vc')").run(k1, tid(30));
  ins({ pid: 'p10', dagar: 20, av: 'ssk-vc', svar: { alkohol: { glasPerVecka: 4, berusning: 'aldrig' } } });
}
