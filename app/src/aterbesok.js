// Läkaren sätter upp ett återbesök (Sussa 3.4.1.1 och 3.4.1.4), från en signerad anteckning eller patientens översikt.
//
// Systemet är experten. Det föreslår tidstyp (återbesök, telefon eller video), yrkesroll och tidsram ur sammanhanget,
// i den här ordningen:
//   1. Anteckningens planering: sökorden Planering, Åtgärd och Uppföljning, till exempel "Telefonkontakt med
//      sjuksköterska om två veckor". Från översikten läses den senaste signerade läkaranteckningen på vårdenheten.
//   2. Diagnosen på vårdenheten, med demoregler (DIAGNOSREGLER), till exempel hjärtsvikt: återbesök hos
//      hjärtsviktssjuksköterska inom två veckor.
//   3. Den senaste kontakten: var den ett telefonsamtal eller ett videobesök föreslås samma sätt.
// Läkaren bekräftar med ett klick, och posten hamnar på väntelistan och i vårdadministratörens Dagens arbete, där tiden
// bokas som vanligt. Varje förslag säger varför. Posten innehåller aldrig journaltext: orsaken säger bara vem som
// planerade återbesöket.
//
// Behörighet. Att sätta upp ett återbesök kräver skriv_journal och vårdrelation till patienten på den egna vårdenheten.
// Nödåtkomst ger bara läsning. En anteckning används bara om användaren får läsa den, så att en spärrad vårdenhet eller
// en annan vårdenhet bakom inre sekretess inte påverkar förslaget. Diagnoser och kontakter läses bara från den egna
// vårdenheten. Posten skapar ingen vårdkontakt och ingen vårdrelation.
import { Fel, idag, addDagar, iso } from './db.js';
import { vardenhetFor, enheterUnder } from './atkomst.js';
import * as journal from './journal.js';
import * as tidbok from './tidbok.js';

export const TIDSTYPER = ['aterbesok', 'telefon', 'video'];
export const TIDSRAMAR = [14, 30, 90, 180, 365];
export const DEMOREGLER = 'Förslagen på tidsram och yrkesroll efter diagnos är demoregler för att visa flödet. De är inte granskade av läkare.';

// Demoregler per diagnos (ICD-10-SE, prefix). Den första som matchar gäller.
export const DIAGNOSREGLER = [
  { kod: 'I50', namn: 'hjärtsvikt', tidstyp: 'aterbesok', yrkesroll: 'sjukskoterska', dagar: 14, varfor: 'Vid hjärtsvikt föreslås ett återbesök hos hjärtsviktssjuksköterska inom två veckor.' },
  { kod: 'I21', namn: 'hjärtinfarkt', tidstyp: 'aterbesok', yrkesroll: 'lakare', dagar: 42, varfor: 'Efter en hjärtinfarkt föreslås ett återbesök hos läkare inom sex veckor.' },
  { kod: 'I20', namn: 'kärlkramp', tidstyp: 'aterbesok', yrkesroll: 'lakare', dagar: 30, varfor: 'Vid kärlkramp föreslås ett återbesök hos läkare inom en månad.' },
  { kod: 'I48', namn: 'förmaksflimmer', tidstyp: 'aterbesok', yrkesroll: 'lakare', dagar: 90, varfor: 'Vid förmaksflimmer föreslås ett återbesök hos läkare inom tre månader.' },
  { kod: 'I10', namn: 'högt blodtryck', tidstyp: 'telefon', yrkesroll: 'sjukskoterska', dagar: 30, varfor: 'Vid högt blodtryck föreslås en telefonkontakt med sjuksköterska inom en månad.' },
  { kod: 'E1', namn: 'diabetes', tidstyp: 'aterbesok', yrkesroll: 'sjukskoterska', dagar: 90, varfor: 'Vid diabetes föreslås ett återbesök hos diabetessjuksköterska inom tre månader.' },
  { kod: 'J45', namn: 'astma', tidstyp: 'aterbesok', yrkesroll: 'sjukskoterska', dagar: 180, varfor: 'Vid astma föreslås ett återbesök hos astmasjuksköterska inom ett halvår.' },
  { kod: 'F3', namn: 'depression', tidstyp: 'aterbesok', yrkesroll: 'lakare', dagar: 28, varfor: 'Vid depression föreslås ett återbesök hos läkare inom fyra veckor.' },
];

// Sökord som innehåller planeringen, i den ordning de läses.
const PLANERING = ['Planering', 'Uppföljning', 'Åtgärd'];
const TAL = { en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10, elva: 11, tolv: 12 };
const ENHET = [[/^dag(ar)?$/, 1], [/^veck(a|or)$/, 7], [/^månad(er)?$/, 30], [/^mån$/, 30], [/^år$/, 365]];
const DAGTEXT = (n) => (n % 365 === 0 ? `${n / 365 === 1 ? 'ett år' : `${n / 365} år`}` : n % 30 === 0 ? `${n / 30 === 1 ? 'en månad' : `${n / 30} månader`}` : n % 7 === 0 ? `${n / 7 === 1 ? 'en vecka' : `${n / 7} veckor`}` : `${n} dagar`);
export const dagText = DAGTEXT;

// Tolkar en planering som "Återbesök om tre månader" eller "Telefonkontakt med sjuksköterska om två veckor". Bara
// meningar som handlar om en kontakt med vården räknas, så att "Dubbel trombocythämning i tolv månader" inte blir ett
// återbesök. Ger { tidstyp, yrkesroll, inomDagar } (yrkesroll kan saknas) eller null.
export function tolkaPlanering(text) {
  const meningar = String(text ?? '').split(/(?<=[.!?])\s+|\n+/).map(m => m.trim().toLowerCase()).filter(Boolean);
  const traff = [];
  for (const m of meningar) {
    const typ = /video/.test(m) ? 'video' : /telefon|ringer|ringa|samtal per telefon/.test(m) ? 'telefon'
      : /återbesök|nytt besök|besök|kontroll|uppföljning|polikliniskt|årskontroll/.test(m) ? 'aterbesok' : null;
    if (!typ) continue;
    const tid = /(?:om|efter|inom)\s+(?:ca\s+|cirka\s+|ungefär\s+)?(\d+|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv)\s+(dagar|dag|veckor|vecka|månader|månad|mån|år)\b/.exec(m);
    const halvar = /(?:om|efter|inom)\s+(?:ett\s+)?halvår/.test(m);
    if (!tid && !halvar) continue;
    let dagar = 180;
    if (tid) {
      const n = /^\d+$/.test(tid[1]) ? Number(tid[1]) : TAL[tid[1]];
      const f = ENHET.find(([re]) => re.test(tid[2]))?.[1] ?? 1;
      // Tolv månader är ett år.
      dagar = f === 30 && n === 12 ? 365 : n * f;
    }
    const yrkesroll = /sjuksköterska|ssk\b|astmasköterska|diabetessköterska/.test(m) ? 'sjukskoterska' : /läkare|doktor/.test(m) ? 'lakare' : null;
    // Ett besök på en annan vårdenhet, till exempel en INR-kontroll på vårdcentralen, är inte vårdenhetens eget återbesök.
    const annan = /vårdcentral/.test(m) && !/återbesök/.test(m);
    traff.push({ tidstyp: typ, yrkesroll, inomDagar: Math.min(365, Math.max(1, dagar)), annan, aterbesok: /återbesök/.test(m), mening: m });
  }
  const valt = traff.find(t => t.aterbesok) ?? traff.find(t => !t.annan) ?? null;
  return valt ? { tidstyp: valt.tidstyp, yrkesroll: valt.yrkesroll, inomDagar: valt.inomDagar } : null;
}

const planeringstext = (a) => {
  const so = JSON.parse(a.sokord ?? '[]');
  return PLANERING.map(n => so.find(s => s.sokord === n)?.text).filter(Boolean).join(' ');
};
const datumText = (t) => new Date(t).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });

// Skriva journal och vårdrelation på den egna vårdenheten. Nödåtkomst ger bara läsning. Nekade försök loggas.
function kravAterbesok(atk) {
  const r = atk.krav('skriv_journal', { beskrivning: 'aterbesok' });
  if (r.grund === 'nodatkomst') {
    atk.logga('skriv_journal', 'nekad', 'aterbesok', 'nekad');
    throw new Fel(403, 'Att sätta upp ett återbesök kräver vårdrelation till patienten på din vårdenhet. Nödåtkomst ger bara läsning.', 'nekad');
  }
  return r;
}

// Anteckningen som förslaget utgår från. Den måste vara signerad, gälla patienten och få läsas av användaren. Annars
// svarar servern som om den inte fanns.
function anteckning(atk, id) {
  const db = atk.db;
  const a = db.query('SELECT * FROM anteckningar WHERE id = ?').get(Number(id));
  if (!a || a.patient_id !== atk.patientId || a.status !== 'signerad' || !atk.prova(journal.lasHandling(a.kategori), { enhet_id: a.enhet_id }).tillaten) {
    throw new Fel(404, 'Anteckningen finns inte.', 'saknas');
  }
  // Den gällande versionen om anteckningen har rättats.
  let g = a;
  for (let i = 0; i < 20; i++) { const n = db.query('SELECT * FROM anteckningar WHERE ersatter_id = ?').get(g.id); if (!n) break; g = n; }
  return g;
}

// Den senaste signerade läkaranteckningen på den egna vårdenheten de senaste 60 dagarna som har en planering.
function senasteMedPlanering(db, pid, enheter) {
  const ph = enheter.map(() => '?').join(', ');
  const grans = new Date(Date.now() - 60 * 86400_000).toISOString();
  const rader = db.query(`SELECT a.* FROM anteckningar a WHERE a.patient_id = ? AND a.enhet_id IN (${ph}) AND a.status = 'signerad' AND a.kategori = 'lakare'
    AND coalesce(a.signerad_tid, a.skapad) >= ? AND NOT EXISTS (SELECT 1 FROM anteckningar n WHERE n.ersatter_id = a.id) ORDER BY coalesce(a.signerad_tid, a.skapad) DESC, a.id DESC`).all(pid, ...enheter, grans);
  for (const a of rader) { const t = tolkaPlanering(planeringstext(a)); if (t) return { a, t }; }
  return null;
}

// Förslaget. Ger också vad som finns på väntelistan redan, så att läkaren ser det innan ett återbesök till sätts upp.
export function forslag(atk, { anteckningId = null } = {}) {
  kravAterbesok(atk);
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  const enheter = enheterUnder(db, ve);
  const ph = enheter.map(() => '?').join(', ');
  const scheman = db.query(`SELECT yrkesroll, id FROM scheman WHERE enhet_id IN (${ph})`).all(...enheter);
  const varfor = [];
  let tidstyp = null;
  let yrkesroll = null;
  let dagar = null;
  let kalla = null;
  const a = anteckningId != null ? anteckning(atk, anteckningId) : null;
  const plan = a ? { a, t: tolkaPlanering(planeringstext(a)) } : senasteMedPlanering(db, atk.patientId, enheter);
  if (plan?.t) {
    ({ tidstyp, inomDagar: dagar } = plan.t);
    yrkesroll = plan.t.yrkesroll ?? 'lakare';
    kalla = 'anteckning';
    varfor.push(`Planeringen i anteckningen (${plan.a.typ.toLowerCase()} ${datumText(plan.a.signerad_tid ?? plan.a.skapad)}) säger ${tidbok.TIDSTYPER[tidstyp].text.toLowerCase()} inom ${DAGTEXT(dagar)}${plan.t.yrkesroll ? ` hos ${tidbok.YRKESROLL[yrkesroll]}` : ''}.`);
  } else if (a) varfor.push('Anteckningen har ingen planering med en tidsram, så systemet föreslår ur diagnosen och den senaste kontakten.');
  if (!kalla) {
    const diagnoser = db.query(`SELECT * FROM diagnoser WHERE patient_id = ? AND enhet_id IN (${ph}) ORDER BY datum DESC, typ = 'huvud' DESC, id DESC`).all(atk.patientId, ...enheter);
    const regel = diagnoser.map(d => DIAGNOSREGLER.find(r => d.kod.startsWith(r.kod))).find(Boolean);
    if (regel) {
      ({ tidstyp, yrkesroll, dagar } = regel);
      kalla = 'diagnos';
      varfor.push(regel.varfor, `Diagnosen ${regel.namn} finns på ${db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? 'vårdenheten'} (demoregel).`);
    }
  }
  // Den senaste kontakten på vårdenheten.
  const senaste = db.query(`SELECT * FROM vardkontakter WHERE patient_id = ? AND enhet_id IN (${ph}) AND start <= ? ORDER BY start DESC, id DESC`).get(atk.patientId, ...enheter, iso());
  if (kalla !== 'anteckning' && senaste && ['telefon', 'video'].includes(senaste.kontaktsatt)) {
    tidstyp = senaste.kontaktsatt;
    varfor.push(`Den senaste kontakten var ${senaste.kontaktsatt === 'telefon' ? 'ett telefonsamtal' : 'ett videobesök'}, så samma sätt föreslås.`);
  }
  if (!kalla && senaste?.typ === 'slutenvard') { dagar = 30; varfor.push('Efter ett vårdtillfälle föreslås ett återbesök inom en månad.'); }
  tidstyp ??= 'aterbesok';
  yrkesroll ??= 'lakare';
  dagar ??= 30;
  if (!kalla && varfor.length === 0) varfor.push('Systemet hittade ingen planering eller diagnos att utgå från och föreslår ett återbesök hos läkare inom en månad.');
  // Tidboken måste ha yrkesrollen och tidstypen på vårdenheten. Annars väljer systemet det som finns och säger det.
  const roller = new Set(scheman.map(s => s.yrkesroll));
  if (scheman.length && !roller.has(yrkesroll)) {
    const annan = [...roller][0];
    varfor.push(`Vårdenheten har ingen ${tidbok.YRKESROLL[yrkesroll]} i tidboken, så återbesöket blir hos ${tidbok.YRKESROLL[annan]}.`);
    yrkesroll = annan;
  }
  const kan = scheman.length > 0;
  const redan = db.query("SELECT * FROM vantelista WHERE patient_id = ? AND enhet_id = ? AND status = 'vantar' ORDER BY mal, id").all(atk.patientId, ve)
    .map(p => ({ id: p.id, orsak: p.orsak, tidstypText: tidbok.TIDSTYPER[p.tidstyp]?.text, yrkesrollText: tidbok.YRKESROLL[p.yrkesroll], mal: p.mal }));
  const onskad = onskadVardgivare(db, atk, ve, yrkesroll);
  return {
    kan, varforInte: kan ? null : 'Din vårdenhet har ingen tidbok i demon, så återbesöket kan inte sättas upp här.',
    forslag: {
      tidstyp, tidstypText: tidbok.TIDSTYPER[tidstyp].text, yrkesroll, yrkesrollText: tidbok.YRKESROLL[yrkesroll], inomDagar: dagar, inomText: DAGTEXT(dagar),
      mal: addDagar(idag(), dagar), onskad: onskad ? { id: onskad, namn: db.query('SELECT namn FROM personal WHERE id = ?').get(onskad)?.namn } : null, kalla,
    },
    varfor, redan, vardenhet: { id: ve, namn: db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? null },
    alternativ: {
      tidstyper: TIDSTYPER.map(id => ({ id, text: tidbok.TIDSTYPER[id].text })),
      yrkesroller: Object.entries(tidbok.YRKESROLL).filter(([id]) => !scheman.length || roller.has(id)).map(([id, text]) => ({ id, text: text[0].toUpperCase() + text.slice(1) })),
      tidsramar: [...new Set([...TIDSRAMAR, dagar])].sort((x, y) => x - y).map(d => ({ dagar: d, text: DAGTEXT(d) })),
    },
    demoregler: true, anmarkning: DEMOREGLER,
  };
}

// Den som satte upp återbesöket, om hen har tider i tidboken med yrkesrollen, annars den vårdgivare patienten har
// träffat förut.
function onskadVardgivare(db, atk, ve, yrkesroll) {
  const egen = db.query(`SELECT 1 FROM scheman WHERE personal_id = ? AND yrkesroll = ? AND enhet_id IN (${enheterUnder(db, ve).map(() => '?').join(', ')})`).get(atk.personal.id, yrkesroll, ...enheterUnder(db, ve));
  return egen ? atk.personal.id : tidbok.tidigareVardgivare(db, atk.patientId, ve, yrkesroll)[0] ?? null;
}

// Sätter upp återbesöket på väntelistan. Systemet räknar fram förslaget på nytt, och läkaren kan ändra tidstyp,
// yrkesroll och tidsram. Värdena kontrolleras av servern.
export function skapa(atk, body = {}) {
  const f = forslag(atk, { anteckningId: body.anteckningId ?? null });
  if (!f.kan) throw new Fel(400, f.varforInte, 'ogiltig');
  const db = atk.db;
  const tidstyp = body.tidstyp ?? f.forslag.tidstyp;
  if (!TIDSTYPER.includes(tidstyp)) throw new Fel(400, 'Välj återbesök, telefontid eller videobesök.', 'ogiltig', { falt: ['tidstyp'] });
  const yrkesroll = body.yrkesroll ?? f.forslag.yrkesroll;
  if (!f.alternativ.yrkesroller.some(y => y.id === yrkesroll)) throw new Fel(400, 'Välj en yrkesroll som finns i vårdenhetens tidbok.', 'ogiltig', { falt: ['yrkesroll'] });
  const dagar = Number(body.inomDagar ?? f.forslag.inomDagar);
  if (!Number.isInteger(dagar) || dagar < 1 || dagar > 365) throw new Fel(400, 'Ange inom hur många dagar patienten ska få tid, högst ett år.', 'ogiltig', { falt: ['inomDagar'] });
  const ve = f.vardenhet.id;
  const orsak = `Uppföljning enligt planering av ${atk.personal.namn}`;
  const post = tidbok.laggPaVantelista(db, {
    patientId: atk.patientId, ve, tidstyp, yrkesroll, orsak, mal: addDagar(idag(), dagar), av: atk.personal.id,
    onskad: onskadVardgivare(db, atk, ve, yrkesroll), detalj: `${orsak}. ${tidbok.TIDSTYPER[tidstyp].text} hos ${tidbok.YRKESROLL[yrkesroll]} inom ${DAGTEXT(dagar)}.`,
  });
  atk.logga('skriv_journal', atk.grund(), `vantelista:${post.id}:aterbesok`);
  return [201, tidbok.vantelistaUt(db, post)];
}
