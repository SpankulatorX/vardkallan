// Utskrifter och utlämnande av journalhandlingar (Sussa 3.1.9). En utskrift innehåller aldrig mer än gränssnittet visar
// den inloggade: varje del hämtas med samma funktioner och samma Atkomst som de vanliga anropen, så att yrkesroll,
// vårdrelation, inre sekretess, spärr och skyddad identitet gäller precis som på skärmen. Det som inte kom med står i
// utskriften, utan att det röjs vad det är eller varifrån det kommer.
//
// Varje utskrift får ett utskrifts-id som står på varje sida, sparas med vem, när, varför, vilka delar och vilka poster
// (med version) som togs med och en kontrollsumma av innehållet, och loggas i åtkomstloggen. Tabellen kan inte ändras.
// Ett utlämnande av en journalhandling (patientdatalagen 3 kap. 11 §: vem som har fått den och när) registreras i samma
// steg när utskriften lämnas till patienten, eller för sig. Återlämnandet registreras på utlämnandet.
import { createHash, randomBytes } from 'node:crypto';
import { Fel, iso, idag, giltigtDatum, addDagar } from './db.js';
import { kanRoll, vardenhetFor, visningsnamn, visningsPnr, alder } from './atkomst.js';
import * as journal from './journal.js';
import * as lakemedel from './lakemedel.js';
import * as remiss from './remiss.js';

// Delarna som kan skrivas ut, med den läshandling som krävs. En del som rollen inte får läsa erbjuds inte.
export const DELAR = [
  { id: 'lakemedel', rubrik: 'Läkemedel', handling: ['las_lakemedel'] },
  { id: 'diagnoser', rubrik: 'Diagnoser', handling: ['las_diagnoser'] },
  { id: 'anteckningar', rubrik: 'Journalanteckningar', handling: ['las_journal', 'las_omvardnad'] },
  { id: 'matvarden', rubrik: 'Mätvärden och provsvar', handling: ['las_matvarden'] },
  { id: 'remisser', rubrik: 'Remisser och svar', handling: ['las_remiss', 'las_remiss_status'] },
  { id: 'vardkontakter', rubrik: 'Vårdkontakter', handling: ['las_admin'] },
];
const DEL = Object.fromEntries(DELAR.map(d => [d.id, d]));
export const kanDel = (personal, del) => DEL[del].handling.some(h => kanRoll(personal, h));
const PATIENTEN = 'Patienten';
// Mottagare som systemet föreslår vid utlämnande. Fritext går också.
export const MOTTAGARE = [PATIENTEN, 'Annan vårdgivare', 'Försäkringskassan', 'Domstol', 'Polis eller åklagare', 'Inspektionen för vård och omsorg'];

const nyttId = () => {
  const alfabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `U-${[...randomBytes(8)].map(b => alfabet[b % alfabet.length]).join('')}`;
};
const personKort = (db, id) => {
  const p = id && db.query('SELECT id, namn, titel, enhet_id FROM personal WHERE id = ?').get(id);
  return p ? { id: p.id, namn: p.namn, titel: p.titel } : null;
};
const enhetsnamn = (db, id) => db.query('SELECT namn FROM enheter WHERE id = ?').get(id)?.namn ?? id;

// Syftet föreslås ur sammanhanget. Det första förslaget är förvalt. Delarna är de som passar syftet och som rollen får.
export function forslag(atk, p) {
  atk.krav('skriv_ut');
  const db = atk.db;
  const min = vardenhetFor(db, atk.personal.enhet_id);
  const alla = DELAR.filter(d => kanDel(atk.personal, d.id)).map(d => d.id);
  const med = (ids) => ids.filter(id => alla.includes(id));
  const ut = [];
  const inlagd = db.query('SELECT v.enhet_id AS vt_enhet, k.enhet_id FROM vardtillfallen v JOIN vardkontakter k ON k.vardtillfalle_id = v.id AND k.slut IS NULL WHERE v.patient_id = ? AND v.utskriven IS NULL').all(p.id)
    .some(r => vardenhetFor(db, r.vt_enhet) === min || vardenhetFor(db, r.enhet_id) === min);
  if (inlagd && med(['lakemedel']).length) ut.push({ id: 'utskrivning', syfte: 'Läkemedelslista till patienten vid utskrivning', delar: med(['lakemedel']), utlamnasTill: PATIENTEN, skal: 'Patienten är inskriven på din vårdenhet.' });
  const remissUt = db.query("SELECT till_enhet_id FROM remisser WHERE patient_id = ? AND fran_enhet_id = ? AND status IN ('skickad', 'mottagen') ORDER BY skickad_tid DESC").get(p.id, min);
  if (remissUt) ut.push({ id: 'remiss', syfte: `Underlag till ${enhetsnamn(db, remissUt.till_enhet_id)} med remissen`, delar: med(['diagnoser', 'lakemedel', 'anteckningar']), utlamnasTill: null, skal: 'Det finns en obesvarad remiss från din vårdenhet.' });
  ut.push({ id: 'kopia', syfte: 'Kopia av journalen till patienten på begäran', delar: alla, utlamnasTill: PATIENTEN, skal: 'Patienten har rätt att få en kopia av sin journal.' });
  ut.push({ id: 'reserv', syfte: 'Pappersunderlag för reservrutin vid avbrott', delar: med(['lakemedel', 'diagnoser', 'matvarden']), utlamnasTill: null, skal: 'Underlag om systemet inte går att nå.' });
  return {
    forslag: ut.filter(f => f.delar.length),
    delar: DELAR.filter(d => alla.includes(d.id)).map(d => ({ id: d.id, rubrik: d.rubrik })),
    // Delar som rollen inte får skriva ut nämns, så att ingen tror att utskriften är hela journalen.
    ingarInte: DELAR.filter(d => !alla.includes(d.id)).map(d => d.rubrik),
    mottagare: MOTTAGARE,
  };
}

// Bygger innehållet med samma funktioner som gränssnittet. Varje del prövas för sig och det som döljs räknas.
function innehall(atk, delar) {
  const db = atk.db;
  const sektioner = [];
  const poster = [];
  for (const d of delar) {
    if (d === 'lakemedel') {
      atk.krav('las_lakemedel');
      const rader = lakemedel.synligaOrdinationer(atk).filter(lakemedel.aktuell).map(o => lakemedel.ordinationUt(db, o, { historik: false }));
      poster.push(...rader.map(o => ({ typ: 'ordination', id: o.id })));
      sektioner.push({ id: d, rubrik: 'Aktuella läkemedel', rader: rader.map(o => ({ rubrik: `${o.lakemedel?.namn ?? ''} ${o.lakemedel?.styrka ?? ''}`.trim(), text: `${o.dosering}. Orsak: ${o.ordinationsorsak}. Uppföljning ${o.uppfoljningsdatum}.`, enhet: o.vardenhet.namn, tid: o.start })) });
    } else if (d === 'diagnoser') {
      atk.krav('las_diagnoser');
      const rader = journal.synligaDiagnoser(atk).map(x => journal.diagnosUt(db, x));
      poster.push(...rader.map(x => ({ typ: 'diagnos', id: x.id })));
      sektioner.push({ id: d, rubrik: 'Diagnoser', rader: rader.map(x => ({ rubrik: `${x.kod} ${x.text}`, text: x.typ === 'huvud' ? 'Huvuddiagnos' : 'Bidiagnos', enhet: x.vardenhet.namn, tid: x.datum })) });
    } else if (d === 'anteckningar') {
      // Bara signerade anteckningar i den gällande versionen. Utkast skrivs inte ut.
      const lista = journal.listaAnteckningar(atk).anteckningar.filter(a => a.status === 'signerad');
      const rader = lista.map(a => journal.anteckningUt(db, journal.hamtaAnteckningRad(db, a.id)));
      poster.push(...rader.map(a => ({ typ: 'anteckning', id: a.id, version: a.version })));
      sektioner.push({ id: d, rubrik: 'Journalanteckningar', rader: rader.map(a => ({
        rubrik: a.typ, enhet: a.enhet.namn, tid: a.signerad?.tid ?? a.skapad,
        text: `Signerad av ${a.signerad?.av?.namn ?? ''}${a.version > 1 ? `, version ${a.version} (rättad)` : ''}${a.kallaEtikett ? `. ${a.kallaEtikett}` : ''}.`,
        sokord: a.sokord.filter(s => s.text),
      })) });
    } else if (d === 'matvarden') {
      atk.krav('las_matvarden');
      const rader = journal.synligaMatvarden(atk).map(m => journal.matvardeUt(db, m));
      poster.push(...rader.map(m => ({ typ: 'matvarde', id: m.id })));
      sektioner.push({ id: d, rubrik: 'Mätvärden och provsvar', rader: rader.map(m => ({ rubrik: m.namn, text: `${m.varde}${m.enhet ? ` ${m.enhet}` : ''}`, enhet: m.vardenhet.namn, tid: m.tid })) });
    } else if (d === 'remisser') {
      const rader = remiss.forPatient(atk).remisser;
      poster.push(...rader.map(r => ({ typ: 'remiss', id: r.id })));
      sektioner.push({ id: d, rubrik: 'Remisser och svar', rader: rader.map(r => ({
        rubrik: `Remiss från ${r.fran.namn} till ${r.till.namn}`, enhet: r.fran.namn, tid: r.tider.skickad,
        text: [r.fragestallning ? `Frågeställning: ${r.fragestallning}` : null, r.svar ? `Svar: ${r.svar}` : null, `Status: ${r.status.replace('_', ' ')}`].filter(Boolean).join(' '),
      })) });
    } else if (d === 'vardkontakter') {
      atk.krav('las_admin');
      const rader = journal.synligaVardkontakter(atk).map(v => journal.vardkontaktUt(db, v));
      poster.push(...rader.map(v => ({ typ: 'vardkontakt', id: v.id })));
      sektioner.push({ id: d, rubrik: 'Vårdkontakter', rader: rader.map(v => ({ rubrik: v.orsak ?? 'Vårdkontakt', text: [v.plats, v.slut ? null : 'Pågår'].filter(Boolean).join(', '), enhet: v.vardenhet.namn, tid: v.start })) });
    }
  }
  return { sektioner, poster };
}

// Skriver ut. inp: { syfte, delar, avidentifierad, utlamnasTill, menprovning }. Returnerar utskriften med id, och
// utlämnandet om utskriften lämnas ut i samma steg.
export function skrivUt(atk, p, inp, val) {
  atk.krav('skriv_ut');
  const db = atk.db;
  const syfte = typeof inp?.syfte === 'string' ? inp.syfte.trim() : '';
  if (syfte.length < 3 || syfte.length > 200) throw new Fel(400, 'Ange syftet med utskriften.', 'ogiltig', { falt: ['syfte'] });
  const valda = Array.isArray(inp?.delar) ? [...new Set(inp.delar)] : [];
  if (!valda.length || valda.some(d => !DEL[d])) throw new Fel(400, 'Välj vad som ska skrivas ut.', 'ogiltig', { falt: ['delar'] });
  const delar = DELAR.map(d => d.id).filter(d => valda.includes(d) && kanDel(atk.personal, d));
  const ejRoll = DELAR.filter(d => valda.includes(d.id) && !kanDel(atk.personal, d.id)).map(d => d.rubrik);
  if (!delar.length) throw new Fel(403, 'Din yrkesroll får inte läsa något av det som valdes, så det går inte att skriva ut.', 'nekad');
  const utlamnasTill = typeof inp?.utlamnasTill === 'string' && inp.utlamnasTill.trim() ? inp.utlamnasTill.trim().slice(0, 120) : null;
  if (utlamnasTill && !kanRoll(atk.personal, 'utlamna')) throw new Fel(403, 'Din yrkesroll kan inte registrera utlämnande av journalhandlingar.', 'nekad');
  const avidentifierad = Boolean(inp?.avidentifierad);
  if (avidentifierad && utlamnasTill === PATIENTEN) throw new Fel(400, 'En kopia till patienten skrivs ut med patientens namn och personnummer.', 'ogiltig', { falt: ['avidentifierad'] });

  const { sektioner, poster } = innehall(atk, delar);
  // Det som inte kom med. Det röjs inte vad det är eller vilken vårdenhet det kommer från.
  const utelamnat = [];
  if (atk.doldaVal > 0) utelamnat.push(`${atk.doldaVal === 1 ? 'En uppgift' : `${atk.doldaVal} uppgifter`} från andra vårdenheter finns inte med, eftersom de kräver ett aktivt val som inte är gjort för patienten.`);
  if (atk.doldaSparr) utelamnat.push('Det finns spärrade uppgifter som inte finns med. De kan bara visas om patienten samtycker.');
  if (ejRoll.length) utelamnat.push(`${ejRoll.join(', ')} ingår inte, eftersom din yrkesroll inte får läsa ${ejRoll.length === 1 ? 'den delen' : 'de delarna'}.`);
  if (delar.includes('anteckningar')) utelamnat.push('Osignerade utkast och tidigare versioner av rättade anteckningar skrivs inte ut. Den gällande versionen är med.');
  const identitetDold = p.skyddad && !val.visa_identitet;
  if (identitetDold) utelamnat.push('Namn och personnummer är dolda eftersom patienten har skyddade personuppgifter.');
  if (avidentifierad) utelamnat.push('Utskriften är avidentifierad: namn och personnummer är borttagna. Fritexten i anteckningarna kan ändå innehålla uppgifter som pekar ut patienten.');

  const id = nyttId();
  const tid = iso();
  const grund = atk.grund();
  const patient = avidentifierad
    ? { namn: 'Avidentifierad', personnummer: null, alder: alder(p.fodd, idag()), kon: p.kon }
    : { namn: visningsnamn(p, val.visa_identitet), personnummer: visningsPnr(p, val.visa_identitet), alder: alder(p.fodd, idag()), kon: p.kon };
  const hash = createHash('sha256').update(JSON.stringify({ patient, sektioner, utelamnat })).digest('hex');
  db.transaction(() => {
    db.query(`INSERT INTO utskrifter (id, patient_id, personal_id, enhet_id, tid, syfte, delar, utelamnat, avidentifierad, poster, innehall_hash, grund)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, p.id, atk.personal.id, atk.personal.enhet_id, tid, syfte, JSON.stringify(delar), JSON.stringify(utelamnat), avidentifierad ? 1 : 0, JSON.stringify(poster), hash, grund);
    atk.logga('skriv_ut', grund, `utskrift:${id}`, 'tillaten', syfte);
  })();
  let utlamnande = null;
  if (utlamnasTill) {
    utlamnande = registreraUtlamnande(atk, p, {
      mottagare: utlamnasTill, utskriftId: id,
      menprovning: typeof inp?.menprovning === 'string' && inp.menprovning.trim() ? inp.menprovning : null,
    });
  }
  return {
    id, tid, syfte, grund, avidentifierad, kontrollsumma: hash,
    av: { ...personKort(db, atk.personal.id), enhet: enhetsnamn(db, atk.personal.enhet_id) },
    vardgivare: enhetsnamn(db, 'rol'), patient, delar: delar.map(d => DEL[d].rubrik), sektioner, utelamnat, utlamnande,
  };
}

const utskriftUt = (db, u) => ({
  id: u.id, tid: u.tid, syfte: u.syfte, av: personKort(db, u.personal_id), enhet: { id: u.enhet_id, namn: enhetsnamn(db, u.enhet_id) },
  delar: JSON.parse(u.delar).map(d => DEL[d]?.rubrik ?? d), utelamnat: JSON.parse(u.utelamnat), avidentifierad: Boolean(u.avidentifierad),
  antalPoster: JSON.parse(u.poster).length, kontrollsumma: u.innehall_hash, grund: u.grund, patientId: u.patient_id,
});
const utlamnandeUt = (db, u) => ({
  id: u.id, mottagare: u.mottagare, beskrivning: u.beskrivning, menprovning: u.menprovning, utskriftId: u.utskrift_id,
  utlamnad: u.utlamnad, av: personKort(db, u.utlamnad_av), enhet: { id: u.enhet_id, namn: enhetsnamn(db, u.enhet_id) },
  aterlamnasSenast: u.aterlamnas_senast, aterlamnad: u.aterlamnad, aterlamnadAv: personKort(db, u.aterlamnad_av),
  forsenad: Boolean(u.aterlamnas_senast && !u.aterlamnad && u.aterlamnas_senast < idag()),
  patientId: u.patient_id,
});

// Registrerar att en journalhandling har lämnats ut (patientdatalagen 3 kap. 11 §). Systemet fyller i beskrivningen ur
// utskriften och föreslår menprövningen. Originalhandlingar som ska komma tillbaka får ett datum för återlämnande.
export function registreraUtlamnande(atk, p, inp) {
  atk.krav('utlamna');
  const db = atk.db;
  const mottagare = typeof inp?.mottagare === 'string' ? inp.mottagare.trim() : '';
  if (mottagare.length < 2 || mottagare.length > 120) throw new Fel(400, 'Ange vem som får handlingen.', 'ogiltig', { falt: ['mottagare'] });
  let beskrivning = typeof inp?.beskrivning === 'string' ? inp.beskrivning.trim() : '';
  let utskriftId = null;
  if (inp?.utskriftId != null) {
    const u = db.query('SELECT * FROM utskrifter WHERE id = ? AND patient_id = ?').get(String(inp.utskriftId), p.id);
    if (!u) throw new Fel(400, 'Utskriften finns inte för patienten.', 'ogiltig', { falt: ['utskriftId'] });
    utskriftId = u.id;
    if (!beskrivning) beskrivning = `Utskrift ${u.id}: ${JSON.parse(u.delar).map(d => DEL[d]?.rubrik ?? d).join(', ')}`;
  }
  if (beskrivning.length < 3 || beskrivning.length > 300) throw new Fel(400, 'Beskriv vilken handling som lämnas ut.', 'ogiltig', { falt: ['beskrivning'] });
  const senast = inp?.aterlamnasSenast ?? null;
  if (senast != null && (!giltigtDatum(senast) || senast < idag())) throw new Fel(400, 'Datumet för återlämnande ska vara i dag eller senare.', 'ogiltig', { falt: ['aterlamnasSenast'] });
  const menprovning = typeof inp?.menprovning === 'string' && inp.menprovning.trim()
    ? inp.menprovning.trim().slice(0, 500)
    : mottagare === PATIENTEN ? 'Lämnas ut till patienten själv.' : 'Prövad enligt offentlighets- och sekretesslagen 25 kap. 1 § före utlämnandet.';
  const tid = iso();
  const r = db.query(`INSERT INTO utlamnanden (patient_id, enhet_id, utskrift_id, mottagare, beskrivning, menprovning, utlamnad, utlamnad_av, aterlamnas_senast)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id, atk.personal.enhet_id, utskriftId, mottagare, beskrivning, menprovning, tid, atk.personal.id, senast);
  const id = Number(r.lastInsertRowid);
  atk.logga('utlamna', atk.grund(), `utlamnande:${id}${utskriftId ? `:${utskriftId}` : ''}`, 'tillaten', `Utlämnad till ${mottagare}`);
  return utlamnandeUt(db, db.query('SELECT * FROM utlamnanden WHERE id = ?').get(id));
}

export function hamtaUtlamnande(db, id) {
  const u = db.query('SELECT * FROM utlamnanden WHERE id = ?').get(Number(id));
  if (!u) throw new Fel(404, 'Utlämnandet finns inte.', 'saknas');
  return u;
}

export function aterlamna(atk, u) {
  atk.krav('utlamna', { resurs: { enhet_id: u.enhet_id } });
  if (u.aterlamnad) throw new Fel(400, 'Handlingen är redan registrerad som återlämnad.', 'ogiltig');
  const tid = iso();
  atk.db.query('UPDATE utlamnanden SET aterlamnad = ?, aterlamnad_av = ? WHERE id = ?').run(tid, atk.personal.id, u.id);
  atk.logga('utlamna', atk.grund(), `aterlamnande:${u.id}`, 'tillaten', `Återlämnad från ${u.mottagare}`);
  return utlamnandeUt(atk.db, hamtaUtlamnande(atk.db, u.id));
}

// Utskrifter och utlämnanden för en patient. Som annan journalinformation hör de till en vårdenhet: andra vårdenheters
// syns efter ett aktivt val, och en spärrad vårdenhets syns inte.
export function forPatient(atk) {
  atk.krav('las_admin');
  const db = atk.db;
  const utskrifter = atk.filtrera(db.query('SELECT * FROM utskrifter WHERE patient_id = ? ORDER BY tid DESC').all(atk.patientId), 'las_admin');
  const utlamnanden = atk.filtrera(db.query('SELECT * FROM utlamnanden WHERE patient_id = ? ORDER BY utlamnad DESC').all(atk.patientId), 'las_admin');
  return {
    utskrifter: utskrifter.map(u => utskriftUt(db, u)), utlamnanden: utlamnanden.map(u => utlamnandeUt(db, u)),
    dolda: { kraverVal: atk.doldaVal, sparrade: atk.doldaSparr }, mottagare: MOTTAGARE,
    kan: { utlamna: kanRoll(atk.personal, 'utlamna'), skrivUt: kanRoll(atk.personal, 'skriv_ut') },
    forslagAterlamnas: addDagar(idag(), 30),
  };
}

export function hamtaUtskrift(db, id) {
  const u = typeof id === 'string' && /^U-[A-Z0-9]{8}$/.test(id) ? db.query('SELECT * FROM utskrifter WHERE id = ?').get(id) : null;
  if (!u) throw new Fel(404, 'Det finns ingen utskrift med det id:t.', 'saknas');
  return u;
}
export const utskriftMetadata = (db, u) => ({ ...utskriftUt(db, u), utlamnanden: db.query('SELECT * FROM utlamnanden WHERE utskrift_id = ?').all(u.id).map(x => utlamnandeUt(db, x)) });

// Utlämnade originalhandlingar som skulle ha kommit tillbaka, för den egna vårdenhetens inkorg.
export function forsenadeAterlamnanden(db, personal) {
  const min = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT * FROM utlamnanden WHERE aterlamnad IS NULL AND aterlamnas_senast IS NOT NULL AND aterlamnas_senast < ? ORDER BY aterlamnas_senast').all(idag())
    .filter(u => vardenhetFor(db, u.enhet_id) === min).map(u => utlamnandeUt(db, u));
}
