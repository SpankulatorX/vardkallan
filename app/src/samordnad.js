// Samordnad individuell plan (SIP) och samordnad planering vid utskrivning (SPU), Sussa 4.3.1.1 till 4.3.1.3.
//
// Byggt från lagen (2017:612) om samverkan vid utskrivning från sluten hälso- och sjukvård, 16 kap. 4 § hälso- och
// sjukvårdslagen (2017:30), 10 kap. 8 och 9 §§ socialtjänstlagen (2025:400) och 7 a § LPT, i lydelsen hämtad från
// riksdagen.se 2026-11-03.
//
// Systemet är experten. Det föreslår SPU när en inneliggande patient kan behöva insatser efter utskrivningen, fyller i
// inskrivningsmeddelandet ur journalen (namn, personnummer, folkbokföringsadress och beräknad utskrivning, 2 kap. 2 §),
// väljer mottagarna själv (kommunen och den vårdcentral där patienten är listad, 2 kap. 1 §), skickar ett nytt besked
// när den beräknade utskrivningen ändras (2 kap. 4 §) och när patienten är utskrivningsklar (3 kap. 1 §), för över
// informationen när patienten skrivs ut (3 kap. 2 §), avgör om en samordnad individuell planering behövs (4 kap. 1 §)
// och räknar fristerna och kommunens betalningsansvar (4 kap. 3 § och 5 kap.). Varje frist har sin paragraf. Står en
// tid inte i lagen säger systemet det.
//
// Kommunen är en simulerad part i demon. Kommunens personal har ingen journalåtkomst och ser bara det som har skickats
// till kommunen i en samordnad planering: inskrivningsmeddelandets uppgifter, beskeden och planen. För en patient med
// skyddade personuppgifter skickas aldrig någon adress, och namnet visas inte för kommunen. Varje åtkomst loggas på
// patienten med grunden samverkan.
import { Fel, iso, idag, addDagar, lokalTid, giltigtDatum } from './db.js';
import { kanRoll, vardenhetFor, enheterUnder, aktivaSparrar, harVardrelation, alder, visningsnamn, visningsPnr } from './atkomst.js';
import { loggaRad } from './logg.js';
import { sistaDag } from './tvangsvard-regler.js';

export const KOMMUN = 'kommun-demo';
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS samordningar (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, typ TEXT NOT NULL, enhet_id TEXT NOT NULL, vardtillfalle_id INTEGER,
  skapad TEXT NOT NULL, skapad_av TEXT NOT NULL, CHECK (typ IN ('spu', 'sip', 'lpt7a'))
);
CREATE TABLE IF NOT EXISTS samordning_handelser (
  id INTEGER PRIMARY KEY, samordning_id INTEGER NOT NULL, typ TEXT NOT NULL, tid TEXT NOT NULL, av TEXT NOT NULL, enhet_id TEXT NOT NULL, detalj TEXT
);
CREATE TRIGGER IF NOT EXISTS sam_andras_ej BEFORE UPDATE ON samordningar BEGIN SELECT RAISE(ABORT, 'En samordnad planering ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS sam_raderas_ej BEFORE DELETE ON samordningar BEGIN SELECT RAISE(ABORT, 'En samordnad planering raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS samh_andras_ej BEFORE UPDATE ON samordning_handelser BEGIN SELECT RAISE(ABORT, 'Händelser i en samordnad planering ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS samh_raderas_ej BEFORE DELETE ON samordning_handelser BEGIN SELECT RAISE(ABORT, 'Händelser i en samordnad planering raderas inte'); END;
`;
export const sakraSchema = (db) => db.exec(SCHEMA);

export const TYPTEXT = { spu: 'Samordnad planering vid utskrivning', sip: 'Samordnad individuell plan', lpt7a: 'Samordnad vårdplan vid öppen tvångsvård' };
export const HANDELSER = {
  inskrivningsmeddelande: { text: 'Inskrivningsmeddelande skickat', paragraf: '2 kap. 1 till 3 §§ lag (2017:612)' },
  beraknad: { text: 'Ny beräknad tidpunkt för utskrivning skickad', paragraf: '2 kap. 4 § lag (2017:612)' },
  fast_vardkontakt: { text: 'Fast vårdkontakt utsedd', paragraf: '2 kap. 5 § lag (2017:612)' },
  planering: { text: 'Kommunen har påbörjat sin planering', paragraf: '2 kap. 6 § lag (2017:612)' },
  utskrivningsklar: { text: 'Underrättelse om att patienten är utskrivningsklar', paragraf: '3 kap. 1 § lag (2017:612)' },
  kallelse: { text: 'Kallelse till samordnad individuell planering', paragraf: '4 kap. 3 § lag (2017:612)' },
  plan: { text: 'Individuell plan upprättad', paragraf: '16 kap. 4 § HSL, 10 kap. 8 § SoL' },
  justerad: { text: 'Planen justerad', paragraf: '7 a § LPT' },
  information: { text: 'Information överförd vid utskrivningen', paragraf: '3 kap. 2 § lag (2017:612)' },
  avslutad: { text: 'Planeringen avslutad', paragraf: null },
};
// Demoregel för när systemet föreslår SPU: inneliggande och 75 år eller äldre, eller en diagnos som ofta ger behov av
// insatser efter utskrivningen.
export const DEMOREGEL_SPU = 'Systemet föreslår samordnad planering när patienten är inneliggande och 75 år eller äldre, eller har hjärtsvikt, en höftfraktur eller ökad fallrisk. Det är en demoregel.';
const SPU_DIAGNOSER = [['I50', 'hjärtsvikt'], ['S72', 'höftfraktur'], ['R29', 'ökad fallrisk']];

const enhetKort = (db, id) => { const e = id && db.query('SELECT id, namn FROM enheter WHERE id = ?').get(id); return e ? { id: e.id, namn: e.namn } : null; };
const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
const text = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ja = (v) => v === true || v === 'on' || v === 'true';
const TZ = 'Europe/Stockholm';
const datumI = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: TZ });
const parse = (h) => ({ ...h, detalj: h.detalj ? JSON.parse(h.detalj) : {} });
const handelser = (db, id) => db.query('SELECT * FROM samordning_handelser WHERE samordning_id = ? ORDER BY tid, id').all(id).map(parse);
const listningFor = (db, patientId) => db.query('SELECT enhet_id FROM listningar WHERE patient_id = ?').get(patientId)?.enhet_id ?? null;

// Läget för en samordning: mottagare, frister, uppgifter och kommunens betalningsansvar. nu i millisekunder.
export function lage(db, s, { nu = Date.now() } = {}) {
  const hs = handelser(db, s.id);
  const sista = (typ) => hs.filter(h => h.typ === typ).at(-1) ?? null;
  const im = sista('inskrivningsmeddelande');
  const behov = im?.detalj.behov ?? hs.find(h => h.typ === 'plan')?.detalj.behov ?? {};
  const vt = s.vardtillfalle_id ? db.query('SELECT * FROM vardtillfallen WHERE id = ?').get(s.vardtillfalle_id) : null;
  const uk = sista('utskrivningsklar');
  const plan = sista('plan');
  const kallelse = sista('kallelse');
  const fast = sista('fast_vardkontakt');
  const oppen = im?.detalj.oppenvard ?? null;
  const sipBehovs = s.typ === 'spu' ? Boolean((behov.socialtjanst || behov.kommunalHsv) && (behov.oppenvard || behov.kommunalHsv)) : true;
  const frister = [];
  const f = (id, rubrik, paragraf, senast, uppfylld, forklaring) => {
    const t = Date.parse(senast);
    frister.push({ id, rubrik, paragraf, senast, uppfylld, status: uppfylld ? 'uppfylld' : nu > t ? 'passerad' : t - nu <= 24 * 3600_000 ? 'snart' : 'kommande', forklaring });
  };
  if (s.typ === 'spu' && vt) {
    const fran = Math.max(Date.parse(vt.inskriven), im ? Date.parse(im.detalj.bedomning ?? im.tid) : 0);
    f('inskrivningsmeddelande', 'Inskrivningsmeddelande', '2 kap. 3 §', new Date(fran + 24 * 3600_000).toISOString(), im?.tid ?? null,
      'Inskrivningsmeddelandet ska skickas senast 24 timmar efter inskrivningen, eller 24 timmar efter att den behandlande läkaren gjorde bedömningen om den görs senare under vårdtiden (2 kap. 3 §).');
    if (uk && sipBehovs) {
      f('kallelse', 'Kallelse till samordnad individuell planering', '4 kap. 3 §', lokalTid(sistaDag(uk.tid, { dagar: 3 }), '23:59'), kallelse?.tid ?? null,
        'Patientens fasta vårdkontakt i den regionfinansierade öppna vården skickar kallelsen senast tre dagar efter att underrättelsen om att patienten är utskrivningsklar lämnades (4 kap. 3 §). Lagen säger inte exakt vilken dag som är den sista, så Vårdkällan visar dagen före den tredje dagen.');
    }
  }
  const uppgifter = [];
  if (s.typ === 'spu' && oppen && !fast && !vt?.utskriven) uppgifter.push({ id: 'fast_vardkontakt', enhet: oppen, text: 'Utse en fast vårdkontakt för patienten innan patienten skrivs ut. Verksamhetschefen gör det (2 kap. 5 §).', paragraf: '2 kap. 5 §', nar: 'Innan patienten skrivs ut. Lagen anger ingen tid i timmar.' });
  if (s.typ === 'spu' && im?.detalj.mottagare?.includes(KOMMUN) && !sista('planering')) uppgifter.push({ id: 'planering', enhet: KOMMUN, text: 'Kommunen ska börja planera de insatser som behövs för att patienten ska kunna lämna den slutna vården tryggt och säkert (2 kap. 6 §).', paragraf: '2 kap. 6 §', nar: 'När inskrivningsmeddelandet har kommit. Lagen anger ingen tid.' });
  if (s.typ === 'spu' && sipBehovs && uk && !plan) uppgifter.push({ id: 'plan', enhet: s.enhet_id, text: 'Patienten behöver insatser från både region och kommun. En samordnad individuell planering ska genomföras och en individuell plan upprättas om patienten samtycker (4 kap. 1 och 2 §§).', paragraf: '4 kap. 1 och 2 §§', nar: 'Arbetet med planen ska påbörjas utan dröjsmål.' });
  if (s.typ === 'lpt7a' && plan && !hs.some(h => h.typ === 'justerad' && h.detalj.part === 'kommun')) uppgifter.push({ id: 'justera', enhet: KOMMUN, text: 'Vårdplanen är upprättad när den har justerats av de enheter som ansvarar för insatserna (7 a § LPT).', paragraf: '7 a § LPT', nar: null });

  // Kommunens betalningsansvar (5 kap.). Inträder tre dagar efter underrättelsen, fyra om den skickades efter kl. 12, när
  // villkoren i 5 kap. 3 § är uppfyllda och det inte finns en överenskommelse om annat (4 kap. 5 §).
  let betalning = null;
  if (s.typ === 'spu' && uk) {
    const timme = Number(new Date(uk.tid).toLocaleTimeString('sv-SE', { hour: '2-digit', hour12: false, timeZone: TZ }));
    const dagar = timme >= 12 ? 4 : 3;
    const villkor = [
      { ok: Boolean(im && Date.parse(im.tid) <= Date.parse(frister.find(x => x.id === 'inskrivningsmeddelande')?.senast ?? im.tid)), text: 'Kommunen fick ett inskrivningsmeddelande i tid (5 kap. 3 § 1).' },
      { ok: true, text: 'Kommunen har underrättats om att patienten är utskrivningsklar (5 kap. 3 § 2).' },
    ];
    if (sipBehovs) { const k = frister.find(x => x.id === 'kallelse'); villkor.push({ ok: Boolean(k?.uppfylld && Date.parse(k.uppfylld) <= Date.parse(k.senast)), text: 'Den fasta vårdkontakten har kallat till samordnad individuell planering i tid (5 kap. 3 § andra stycket).' }); }
    betalning = {
      fran: addDagar(datumI(uk.tid), dagar), villkor, uppfyllda: villkor.every(v => v.ok),
      text: `Kommunens betalningsansvar inträder ${dagar} dagar efter underrättelsen${dagar === 4 ? ', eftersom den skickades efter kl. 12' : ''} (5 kap. 4 §), om villkoren i 5 kap. 3 § är uppfyllda. Vårdkällan räknar dagarna från dagen då underrättelsen skickades. Det gäller om region och kommun inte har en överenskommelse om annat (4 kap. 5 §), och någon sådan är inte registrerad i demon. Beloppet bestäms enligt 5 kap. 6 § och räknas inte i demon. Betalningsansvaret inträder inte om patienten inte kan skrivas ut för att den regionfinansierade öppna vårdens insatser inte är tillgängliga (5 kap. 5 §).`,
      vardDagar: Math.max(0, Math.floor(((vt?.utskriven ? Date.parse(vt.utskriven) : nu) - Date.parse(uk.tid)) / 86400_000)),
    };
  }
  const status = hs.some(h => h.typ === 'avslutad') || (s.typ === 'spu' && vt?.utskriven) ? 'avslutad' : uk ? 'utskrivningsklar' : 'pagar';
  return {
    hs, behov, mottagare: im?.detalj.mottagare ?? [s.enhet_id, KOMMUN], beraknad: sista('beraknad')?.detalj.datum ?? im?.detalj.beraknad ?? null,
    utskrivningsklar: uk?.tid ?? null, fastVardkontakt: fast ? personKort(db, fast.detalj.personal) : null, oppenvard: oppen, sipBehovs, plan: plan?.detalj ?? null,
    kallelse: kallelse?.detalj ?? null, frister, uppgifter, betalning, status, vt,
  };
}

// Vilka enheter som är parter: den som skapade planeringen, den öppna vården och kommunen.
const parter = (db, s, l) => new Set([vardenhetFor(db, s.enhet_id), ...(l.mottagare ?? []).map(e => vardenhetFor(db, e)), ...(s.typ !== 'spu' ? [KOMMUN] : [])]);

// För vårdens personal: planeringar som hör till en vårdenhet användaren får se, eller där användarens vårdenhet är
// mottagare. En planering från en spärrad vårdenhet visas inte för andra utan samtycke, och inget talar om att den finns.
export function synliga(atk) {
  const db = atk.db;
  if (!kanRoll(atk.personal, 'samordna') && !kanRoll(atk.personal, 'las_vardplan')) return [];
  const min = vardenhetFor(db, atk.personal.enhet_id);
  const sparr = aktivaSparrar(db, atk.patientId).filter(e => e !== min);
  return db.query('SELECT * FROM samordningar WHERE patient_id = ? ORDER BY skapad DESC').all(atk.patientId).filter(s => {
    const ve = vardenhetFor(db, s.enhet_id);
    if (sparr.includes(ve) && !atk.val.samtycke_sparr) return false;
    if (atk.prova('las_admin', { enhet_id: s.enhet_id }).tillaten) return true;
    return parter(db, s, lage(db, s)).has(min);
  });
}

// Patientuppgifterna till kommunen läses från patientraden varje gång, aldrig från en sparad kopia, så att en patient som
// får skyddade personuppgifter efter inskrivningsmeddelandet skyddas direkt. För en patient med skyddade
// personuppgifter lämnas varken namn, personnummer eller adress ut. Adressen lämnas bara när ett inskrivningsmeddelande
// har skickats, eftersom den är en av meddelandets uppgifter (2 kap. 2 §).
function kommunensPatient(pat, im) {
  if (pat.skyddad) return { namn: 'Skyddad identitet', personnummer: null, adress: null, skyddad: true };
  return { namn: visningsnamn(pat, true), personnummer: visningsPnr(pat, true), adress: im ? [pat.adress, pat.postnr, pat.ort].filter(Boolean).join(', ') || null : null, skyddad: false };
}

function utan(db, s, l, { forKommun = false, personal = null } = {}) {
  const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(s.patient_id);
  const im = l.hs.find(h => h.typ === 'inskrivningsmeddelande');
  return {
    id: s.id, typ: s.typ, typText: TYPTEXT[s.typ], enhet: enhetKort(db, s.enhet_id), skapad: s.skapad, skapadAv: personKort(db, s.skapad_av), status: l.status,
    patient: forKommun ? kommunensPatient(pat, im) : undefined,
    behov: l.behov, mottagare: (l.mottagare ?? []).map(e => enhetKort(db, e)), beraknad: l.beraknad, utskrivningsklar: l.utskrivningsklar, fastVardkontakt: l.fastVardkontakt,
    sipBehovs: l.sipBehovs, plan: l.plan, kallelse: l.kallelse, frister: l.frister, betalning: l.betalning,
    uppgifter: l.uppgifter.filter(u => !personal || vardenhetFor(db, u.enhet) === vardenhetFor(db, personal.enhet_id)).map(({ enhet, ...u }) => ({ ...u, enhet: enhetKort(db, enhet) })),
    historik: l.hs.map(h => ({ id: h.id, typ: h.typ, text: HANDELSER[h.typ]?.text ?? h.typ, paragraf: HANDELSER[h.typ]?.paragraf ?? null, tid: h.tid, av: personKort(db, h.av), enhet: enhetKort(db, h.enhet_id) })).reverse(),
    information: forKommun ? l.hs.filter(h => h.typ === 'utskrivningsklar' || h.typ === 'information').map(h => h.detalj.information).filter(Boolean) : l.hs.filter(h => h.typ === 'utskrivningsklar' || h.typ === 'information').map(h => h.detalj.information).filter(Boolean),
  };
}

// Informationen vid utskrivningen förs över av systemet när vårdtillfället är avslutat (3 kap. 2 §).
function informationVidUtskrivning(db, s, l, av) {
  if (s.typ !== 'spu' || !l.vt?.utskriven || l.hs.some(h => h.typ === 'information')) return false;
  db.query("INSERT INTO samordning_handelser (samordning_id, typ, tid, av, enhet_id, detalj) VALUES (?, 'information', ?, ?, ?, ?)")
    .run(s.id, l.vt.utskriven, l.vt.utskriven_av ?? av, s.enhet_id, JSON.stringify({ information: 'Informationen som behövs för insatserna efter utskrivningen fördes över när patienten skrevs ut.' }));
  return true;
}

// Förslag på SPU för en inneliggande patient på den egna vårdenheten, bara uppgifter från den egna vårdenheten.
function spuForslag(atk) {
  const db = atk.db;
  if (!kanRoll(atk.personal, 'samordna')) return null;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const vt = db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(atk.patientId);
  if (!vt || vardenhetFor(db, vt.enhet_id) !== ve) return null;
  if (db.query("SELECT 1 FROM samordningar WHERE vardtillfalle_id = ? AND typ = 'spu'").get(vt.id)) return null;
  const enheter = enheterUnder(db, ve);
  const dia = db.query(`SELECT kod, text FROM diagnoser WHERE patient_id = ? AND enhet_id IN (${enheter.map(() => '?').join(', ')})`).all(atk.patientId, ...enheter);
  const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  const ar = alder(pat.fodd, idag());
  const d = SPU_DIAGNOSER.find(([k]) => dia.some(x => x.kod.startsWith(k)));
  const varfor = [ar >= 75 ? `Patienten är ${ar} år och inneliggande.` : null, d ? `Patienten har ${d[1]}.` : null].filter(Boolean);
  if (!varfor.length) return null;
  const listad = listningFor(db, atk.patientId);
  const senast = new Date(Date.parse(vt.inskriven) + 24 * 3600_000).toISOString();
  return {
    varfor, demoregel: DEMOREGEL_SPU, senast, vardtillfalleId: vt.id, beraknad: addDagar(idag(), 3),
    behov: { socialtjanst: ar >= 75, kommunalHsv: ar >= 80, oppenvard: Boolean(listad) },
    mottagare: [enhetKort(db, KOMMUN), listad ? enhetKort(db, listad) : null].filter(Boolean),
    adress: pat.skyddad ? null : [pat.adress, pat.postnr, pat.ort].filter(Boolean).join(', '),
    skyddad: Boolean(pat.skyddad),
    forklaring: `Om patienten kan behöva insatser från socialtjänsten, den kommunala hälso- och sjukvården eller den regionfinansierade öppna vården efter utskrivningen ska inskrivningsmeddelandet skickas senast 24 timmar efter inskrivningen (2 kap. 1 och 3 §§). Systemet skickar det till kommunen${listad ? ` och till ${enhetKort(db, listad).namn}, där patienten är listad` : ''}.${pat.skyddad ? ' Patienten har skyddade personuppgifter, så ingen adress skickas och kommunen ser inte namnet.' : ''}`,
  };
}

export function forPatient(atk) {
  atk.krav(kanRoll(atk.personal, 'samordna') ? 'samordna' : 'las_vardplan');
  const db = atk.db;
  const ut = synliga(atk).map(s => { const l = lage(db, s); if (informationVidUtskrivning(db, s, l, atk.personal.id)) return utan(db, s, lage(db, s), { personal: atk.personal }); return utan(db, s, l, { personal: atk.personal }); });
  const kan = kanRoll(atk.personal, 'samordna') && atk.prova('samordna').grund !== 'nodatkomst';
  return { samordningar: ut, forslag: kan ? { spu: spuForslag(atk) } : { spu: null }, kan: { skapa: kan }, typer: TYPTEXT };
}

export function oversikt(atk) {
  if (!kanRoll(atk.personal, 'samordna') && !kanRoll(atk.personal, 'las_vardplan')) return null;
  const d = forPatient(atk);
  const pagar = d.samordningar.filter(s => s.status !== 'avslutad');
  if (!pagar.length && !d.forslag.spu) return null;
  return { pagar: pagar.map(s => ({ id: s.id, typ: s.typ, typText: s.typText, status: s.status, beraknad: s.beraknad, frist: s.frister.find(f => f.status !== 'uppfylld') ?? null, uppgifter: s.uppgifter.length })), forslag: d.forslag.spu ? { varfor: d.forslag.spu.varfor, senast: d.forslag.spu.senast } : null };
}

const ny = (db, s, typ, pers, detalj = {}, tid = iso()) => db.query('INSERT INTO samordning_handelser (samordning_id, typ, tid, av, enhet_id, detalj) VALUES (?, ?, ?, ?, ?, ?)')
  .run(s.id ?? s, typ, tid, pers.id, pers.enhet_id, JSON.stringify(detalj));

function kravSkriv(atk) {
  const r = atk.krav('samordna', { beskrivning: 'samordning' });
  if (r.grund === 'nodatkomst') { atk.logga('samordna', 'nekad', 'samordning', 'nekad'); throw new Fel(403, 'Samordnad planering kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad'); }
}

// Planens innehåll enligt 16 kap. 4 § HSL och 10 kap. 8 § SoL. Kräver patientens samtycke.
function planInnehall(body) {
  if (!ja(body.samtycke)) throw new Fel(400, 'Planen får upprättas bara om patienten samtycker (16 kap. 4 § HSL och 10 kap. 8 § SoL). Registrera samtycket.', 'ogiltig', { falt: ['samtycke'] });
  const insatser = (Array.isArray(body.insatser) ? body.insatser : []).map(x => ({ text: text(x?.text, 300), huvudman: x?.huvudman === 'kommun' ? 'kommun' : 'region' })).filter(x => x.text);
  if (!insatser.length) throw new Fel(400, 'Skriv vilka insatser som behövs och vem som ansvarar för dem.', 'ogiltig', { falt: ['insatser'] });
  return {
    insatser, andra: text(body.andra, 500) || null, overgripande: body.overgripande === 'kommun' ? 'kommun' : 'region',
    patientDelaktig: ja(body.patientDelaktig), narstaende: ja(body.narstaende), samtycke: true,
  };
}

// Skapar en samordnad planering. body.typ är spu, sip eller lpt7a.
export function skapa(atk, body = {}) {
  kravSkriv(atk);
  const db = atk.db;
  const pers = atk.personal;
  const typ = body.typ;
  const t = iso();
  if (typ === 'spu') {
    const f = spuForslag(atk);
    const vt = db.query('SELECT * FROM vardtillfallen WHERE patient_id = ? AND utskriven IS NULL').get(atk.patientId);
    if (!vt || vardenhetFor(db, vt.enhet_id) !== vardenhetFor(db, pers.enhet_id)) throw new Fel(400, 'Samordnad planering vid utskrivning görs för en patient som är inskriven på din vårdenhet.', 'ogiltig');
    if (db.query("SELECT 1 FROM samordningar WHERE vardtillfalle_id = ? AND typ = 'spu'").get(vt.id)) throw new Fel(400, 'Inskrivningsmeddelandet för vårdtillfället är redan skickat.', 'ogiltig');
    const behov = { socialtjanst: ja(body.behov?.socialtjanst ?? f?.behov.socialtjanst), kommunalHsv: ja(body.behov?.kommunalHsv ?? f?.behov.kommunalHsv), oppenvard: ja(body.behov?.oppenvard ?? f?.behov.oppenvard) };
    if (!behov.socialtjanst && !behov.kommunalHsv && !behov.oppenvard) throw new Fel(400, 'Ange vilka insatser patienten kan behöva efter utskrivningen.', 'ogiltig', { falt: ['behov'] });
    const beraknad = body.beraknad ?? addDagar(idag(), 3);
    if (!giltigtDatum(beraknad) || beraknad < idag()) throw new Fel(400, 'Ange en beräknad dag för utskrivning från och med i dag.', 'ogiltig', { falt: ['beraknad'] });
    const listad = listningFor(db, atk.patientId);
    // Den regionfinansierade öppna vården får meddelandet när den behövs eller när kommunal hälso- och sjukvård behövs
    // (2 kap. 1 § andra stycket).
    const oppen = (behov.oppenvard || behov.kommunalHsv) && listad ? listad : null;
    const mottagare = [...(behov.socialtjanst || behov.kommunalHsv ? [KOMMUN] : []), ...(oppen ? [oppen] : [])];
    const pat = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
    const id = Number(db.query("INSERT INTO samordningar (patient_id, typ, enhet_id, vardtillfalle_id, skapad, skapad_av) VALUES (?, 'spu', ?, ?, ?, ?)").run(atk.patientId, pers.enhet_id, vt.id, t, pers.id).lastInsertRowid);
    // Adressen sparas inte i meddelandet: den läses från patientraden när kommunen ser meddelandet (kommunensPatient).
    ny(db, id, 'inskrivningsmeddelande', pers, { bedomning: t, behov, beraknad, mottagare, oppenvard: oppen, adressSkickad: !pat.skyddad }, t);
    atk.logga('samordna', atk.grund(), `samordning:${id}:inskrivningsmeddelande`);
    return [201, utan(db, db.query('SELECT * FROM samordningar WHERE id = ?').get(id), lage(db, { id, typ: 'spu', vardtillfalle_id: vt.id, enhet_id: pers.enhet_id }), { personal: pers })];
  }
  if (typ !== 'sip' && typ !== 'lpt7a') throw new Fel(400, 'Okänd typ av samordnad planering.', 'ogiltig', { falt: ['typ'] });
  const plan = planInnehall(body);
  const id = Number(db.query('INSERT INTO samordningar (patient_id, typ, enhet_id, skapad, skapad_av) VALUES (?, ?, ?, ?, ?)').run(atk.patientId, typ, pers.enhet_id, t, pers.id).lastInsertRowid);
  ny(db, id, 'plan', pers, plan, t);
  if (typ === 'lpt7a') ny(db, id, 'justerad', pers, { part: 'region' }, t);
  atk.logga('samordna', atk.grund(), `samordning:${id}:${typ}`);
  const s = db.query('SELECT * FROM samordningar WHERE id = ?').get(id);
  return [201, utan(db, s, lage(db, s), { personal: pers })];
}

export const hamta = (db, id) => {
  const s = db.query('SELECT * FROM samordningar WHERE id = ?').get(Number(id));
  if (!s) throw new Fel(404, 'Den samordnade planeringen finns inte.', 'saknas');
  return s;
};

// Ändringar från vårdens personal. Den som skapade planeringen ändrar den. Den öppna vården utser fast vårdkontakt och
// kallar till samordnad individuell planering.
export function andra(atk, s, atgard, body = {}) {
  kravSkriv(atk);
  const db = atk.db;
  const pers = atk.personal;
  if (!synliga(atk).some(x => x.id === s.id)) throw new Fel(404, 'Den samordnade planeringen finns inte.', 'saknas');
  const l = lage(db, s);
  const min = vardenhetFor(db, pers.enhet_id);
  const agare = min === vardenhetFor(db, s.enhet_id);
  const oppen = l.oppenvard && min === vardenhetFor(db, l.oppenvard);
  const neka = (skal) => { atk.logga('samordna', 'nekad', `samordning:${s.id}:${atgard}`, 'nekad'); throw new Fel(403, skal, 'nekad'); };
  if (l.status === 'avslutad') throw new Fel(400, 'Planeringen är avslutad.', 'ogiltig');
  switch (atgard) {
    case 'beraknad': {
      if (!agare) neka('Den beräknade utskrivningen ändras av den vårdenhet där patienten är inskriven.');
      if (!giltigtDatum(body.datum) || body.datum < idag()) throw new Fel(400, 'Ange en beräknad dag för utskrivning från och med i dag.', 'ogiltig', { falt: ['datum'] });
      ny(db, s, 'beraknad', pers, { datum: body.datum });
      break;
    }
    case 'utskrivningsklar':
      if (!agare || s.typ !== 'spu') neka('Den behandlande läkaren på vårdenheten bedömer att patienten är utskrivningsklar (1 kap. 3 § och 3 kap. 1 §).');
      if (pers.yrke !== 'lakare') neka('Det är den behandlande läkaren som bedömer att patienten är utskrivningsklar (1 kap. 3 § 5).');
      if (l.utskrivningsklar) throw new Fel(400, 'Underrättelsen om att patienten är utskrivningsklar är redan skickad.', 'ogiltig');
      ny(db, s, 'utskrivningsklar', pers, { information: text(body.information, 1000) || null });
      break;
    case 'fast-vardkontakt': {
      if (!oppen) neka('Verksamhetschefen vid den öppna vården som fick inskrivningsmeddelandet utser den fasta vårdkontakten (2 kap. 5 §).');
      const vem = db.query('SELECT * FROM personal WHERE id = ?').get(body.personal ?? pers.id);
      if (!vem || vardenhetFor(db, vem.enhet_id) !== min || !['lakare', 'sjukskoterska'].includes(vem.yrke)) throw new Fel(400, 'Välj en läkare eller sjuksköterska på vårdenheten.', 'ogiltig', { falt: ['personal'] });
      ny(db, s, 'fast_vardkontakt', pers, { personal: vem.id });
      break;
    }
    case 'kallelse': {
      if (!oppen || l.fastVardkontakt?.id !== pers.id) neka('Kallelsen skickas av patientens fasta vårdkontakt i den regionfinansierade öppna vården (4 kap. 3 §).');
      if (!l.utskrivningsklar) throw new Fel(400, 'Kallelsen skickas när patienten är utskrivningsklar.', 'ogiltig');
      const mote = body.mote ?? addDagar(idag(), 1);
      if (!giltigtDatum(mote) || mote < idag()) throw new Fel(400, 'Ange en dag för planeringsmötet från och med i dag.', 'ogiltig', { falt: ['mote'] });
      ny(db, s, 'kallelse', pers, { mote, till: l.mottagare });
      break;
    }
    case 'plan':
      if (!agare && !oppen) neka('Planen upprättas av de enheter som ansvarar för insatserna.');
      ny(db, s, 'plan', pers, { ...planInnehall(body), behov: l.behov });
      break;
    case 'avsluta':
      if (!agare) neka('Planeringen avslutas av den vårdenhet som har ansvaret för den.');
      ny(db, s, 'avslutad', pers, {});
      break;
    default: throw new Fel(404, 'Okänd ändring.', 'saknas');
  }
  atk.logga('samordna', atk.grund(), `samordning:${s.id}:${atgard}`);
  return utan(db, s, lage(db, s), { personal: pers });
}

// Kommunens part (simulerad). Bara planeringar där kommunen är mottagare eller part. Varje åtkomst loggas på patienten.
const kommunensRad = (db, pers, s, l) => (vardenhetFor(db, pers.enhet_id) === KOMMUN && parter(db, s, l).has(KOMMUN));
function kravKommun(db, pers) {
  if (!kanRoll(pers, 'samverkan')) {
    loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, handling: 'samverkan', resurs: 'samverkan', grund: 'nekad', resultat: 'nekad' });
    throw new Fel(403, 'Den här delen är för kommunens part i samordnad planering.', 'nekad');
  }
}
export function kommunLista(db, pers) {
  kravKommun(db, pers);
  const ut = [];
  for (const s of db.query('SELECT * FROM samordningar ORDER BY skapad DESC').all()) {
    let l = lage(db, s);
    if (!kommunensRad(db, pers, s, l)) continue;
    if (informationVidUtskrivning(db, s, l, s.skapad_av)) l = lage(db, s);
    const u = utan(db, s, l, { forKommun: true, personal: pers });
    ut.push({ id: u.id, typ: u.typ, typText: u.typText, status: u.status, patient: u.patient, avsandare: u.enhet, beraknad: u.beraknad, utskrivningsklar: u.utskrivningsklar,
      betalning: u.betalning ? { fran: u.betalning.fran, uppfyllda: u.betalning.uppfyllda } : null, uppgifter: u.uppgifter.length, patientId: s.patient_id });
  }
  return ut;
}
export function kommunDetalj(db, pers, id) {
  kravKommun(db, pers);
  const s = hamta(db, id);
  const l = lage(db, s);
  if (!kommunensRad(db, pers, s, l)) throw new Fel(404, 'Den samordnade planeringen finns inte.', 'saknas');
  loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: s.patient_id, handling: 'samverkan', resurs: `samverkan:${s.id}`, grund: 'samverkan', resultat: 'tillaten' });
  return utan(db, s, l, { forKommun: true, personal: pers });
}
export function kommunAndra(db, pers, id, atgard, body = {}) {
  kravKommun(db, pers);
  const s = hamta(db, id);
  const l = lage(db, s);
  if (!kommunensRad(db, pers, s, l)) throw new Fel(404, 'Den samordnade planeringen finns inte.', 'saknas');
  if (l.status === 'avslutad') throw new Fel(400, 'Planeringen är avslutad.', 'ogiltig');
  if (atgard === 'planering') {
    if (l.hs.some(h => h.typ === 'planering')) throw new Fel(400, 'Planeringen är redan påbörjad.', 'ogiltig');
    ny(db, s, 'planering', pers, { kommentar: text(body.kommentar, 300) || null });
  } else if (atgard === 'justera') {
    if (!l.plan) throw new Fel(400, 'Det finns ingen plan att justera.', 'ogiltig');
    ny(db, s, 'justerad', pers, { part: 'kommun' });
  } else throw new Fel(404, 'Okänd åtgärd.', 'saknas');
  loggaRad(db, { personal_id: pers.id, enhet_id: pers.enhet_id, patient_id: s.patient_id, handling: 'samverkan', resurs: `samverkan:${s.id}:${atgard}`, grund: 'samverkan', resultat: 'tillaten' });
  return utan(db, s, lage(db, s), { forKommun: true, personal: pers });
}

// Inkorgen: uppgifter och frister för den egna vårdenheten (fast vårdkontakt, kallelse och planen).
export function inkorg(db, personal) {
  if (!kanRoll(personal, 'samordna')) return [];
  const min = vardenhetFor(db, personal.enhet_id);
  const ut = [];
  for (const s of db.query('SELECT * FROM samordningar ORDER BY skapad').all()) {
    let l = lage(db, s);
    if (!parter(db, s, l).has(min) || !harVardrelation(db, s.patient_id, min)) continue;
    if (aktivaSparrar(db, s.patient_id).includes(vardenhetFor(db, s.enhet_id)) && vardenhetFor(db, s.enhet_id) !== min) continue;
    if (informationVidUtskrivning(db, s, l, s.skapad_av)) l = lage(db, s);
    if (l.status === 'avslutad') continue;
    const uppg = l.uppgifter.filter(u => vardenhetFor(db, u.enhet) === min && (u.id !== 'fast_vardkontakt' || true));
    const kallelse = l.frister.find(f => f.id === 'kallelse' && f.status !== 'uppfylld' && l.fastVardkontakt?.id === personal.id);
    if (!uppg.length && !kallelse) continue;
    ut.push({ patientId: s.patient_id, samordningId: s.id, typText: TYPTEXT[s.typ], uppgifter: uppg.map(u => ({ id: u.id, text: u.text, paragraf: u.paragraf })), frist: kallelse ?? null,
      forslag: uppg.some(u => u.id === 'fast_vardkontakt') ? { personal: personKort(db, personal.id) } : null });
  }
  return ut;
}

// Uppföljning av kvalitet och produktion (Sussa 4.3.1.3), utan personuppgifter. Grupper med färre än tre visas inte
// som tal.
export function statistik(db, enheter, { nu = Date.now() } = {}) {
  const grupp = (n) => (n > 0 && n < 3 ? 'färre än 3' : n);
  return enheter.map(ve => {
    const ss = db.query('SELECT * FROM samordningar').all().filter(s => vardenhetFor(db, s.enhet_id) === ve);
    const lagen = ss.map(s => ({ s, l: lage(db, s, { nu }) }));
    const spu = lagen.filter(x => x.s.typ === 'spu');
    const iTid = spu.filter(x => x.l.frister.find(f => f.id === 'inskrivningsmeddelande')?.uppfylld && Date.parse(x.l.frister.find(f => f.id === 'inskrivningsmeddelande').uppfylld) <= Date.parse(x.l.frister.find(f => f.id === 'inskrivningsmeddelande').senast)).length;
    const kallelser = spu.map(x => x.l.frister.find(f => f.id === 'kallelse')).filter(Boolean);
    const sip = lagen.filter(x => x.s.typ !== 'spu');
    const planer = lagen.map(x => x.l.plan).filter(Boolean);
    return {
      vardenhet: enhetKort(db, ve),
      spu: { antal: grupp(spu.length), inskrivningsmeddelandeITid: spu.length >= 3 ? `${Math.round(100 * iTid / spu.length)} %` : null,
        kallelserITid: grupp(kallelser.filter(k => k.uppfylld && Date.parse(k.uppfylld) <= Date.parse(k.senast)).length), kallelserSena: grupp(kallelser.filter(k => k.status === 'passerad').length),
        utskrivningsklaraVarddygn: spu.length >= 3 ? spu.reduce((s, x) => s + (x.l.betalning?.vardDagar ?? 0), 0) : null },
      sip: { antal: grupp(sip.length), planer: grupp(planer.length), patientDelaktig: grupp(planer.filter(p => p.patientDelaktig).length), narstaende: grupp(planer.filter(p => p.narstaende).length) },
      anmarkning: 'Kostnaden för utskrivningsklara vårddygn räknas inte, eftersom beloppet bestäms enligt 5 kap. 6 § lag (2017:612) eller i en överenskommelse mellan region och kommun.',
    };
  });
}

// Seeden: Gunnar Åkesson (p01) ligger på avdelning 72 sedan tre dagar. Inskrivningsmeddelandet skickades samma dag till
// kommunen och Vårdcentralen Tybble, kommunen har påbörjat sin planering och vårdcentralen har ännu inte utsett någon
// fast vårdkontakt.
export function seeda(db) {
  sakraSchema(db);
  const vt = db.query("SELECT * FROM vardtillfallen WHERE patient_id = 'p01' AND utskriven IS NULL").get();
  if (!vt) return;
  const t = new Date(Date.parse(vt.inskriven) + 3 * 3600_000).toISOString();
  const id = Number(db.query("INSERT INTO samordningar (patient_id, typ, enhet_id, vardtillfalle_id, skapad, skapad_av) VALUES ('p01', 'spu', 'uso-kard-72', ?, ?, 'lak-kard')").run(vt.id, t).lastInsertRowid);
  const pat = db.query("SELECT * FROM patienter WHERE id = 'p01'").get();
  const beraknad = addDagar(datumI(Date.now()), 2);
  db.query("INSERT INTO samordning_handelser (samordning_id, typ, tid, av, enhet_id, detalj) VALUES (?, 'inskrivningsmeddelande', ?, 'lak-kard', 'uso-kard', ?)")
    .run(id, t, JSON.stringify({ bedomning: t, behov: { socialtjanst: true, kommunalHsv: true, oppenvard: true }, beraknad, mottagare: [KOMMUN, 'vc-tybble'], oppenvard: 'vc-tybble', adressSkickad: !pat.skyddad }));
  db.query("INSERT INTO samordning_handelser (samordning_id, typ, tid, av, enhet_id, detalj) VALUES (?, 'planering', ?, 'kom-bist', ?, ?)")
    .run(id, new Date(Date.parse(t) + 20 * 3600_000).toISOString(), KOMMUN, JSON.stringify({ kommentar: 'Hemtjänst och trygghetslarm utreds.' }));
}
export function sakra(db) {
  const fanns = db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'samordningar'").get();
  sakraSchema(db);
  if (!fanns) seeda(db);
}
