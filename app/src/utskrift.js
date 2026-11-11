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

// Runda 10, r2: strukturerad menprövning (Sussa 3.1.9.5). Före ett utlämnande prövas om uppgifterna kan lämnas ut utan
// men för patienten eller närstående. Beslutet, grunden och vem som prövade registreras och kan inte ändras. Systemet
// föreslår grunden ur mottagaren, så att den som lämnar ut inte behöver kunna lagrummen.
export const MENPROVNING_BESLUT = [
  { id: 'inget_men', text: 'Lämnas ut i sin helhet. Inget men för patienten eller närstående.' },
  { id: 'forbehall', text: 'Lämnas ut med förbehåll om hur uppgifterna får användas (OSL 10 kap. 14 §).' },
  { id: 'delvis', text: 'Lämnas ut delvis. Uppgifter som kan medföra men är borttagna.' },
];
export const MENPROVNING_GRUNDER = [
  { id: 'osl_12_1', text: 'Sekretessen gäller inte mot patienten själv (OSL 12 kap. 1 §), och inget hinder enligt 25 kap. 6 § finns.', bara: PATIENTEN },
  { id: 'osl_25_1', text: 'Uppgifterna kan lämnas ut utan men för patienten eller närstående (OSL 25 kap. 1 §).' },
  { id: 'osl_10_28', text: 'Uppgiftsskyldighet enligt lag eller förordning bryter sekretessen (OSL 10 kap. 28 §).' },
  { id: 'osl_10_23', text: 'Misstanke om ett brott med lägst sex månaders fängelse i straffskalan, eller försök, förberedelse eller stämpling till ett brott med lägst ett års fängelse (OSL 10 kap. 23 §).' },
];
const MENPROVNING_FORSLAG = {
  Patienten: { beslut: 'inget_men', grund: 'osl_12_1' },
  'Annan vårdgivare': { beslut: 'inget_men', grund: 'osl_25_1' },
  Försäkringskassan: { beslut: 'inget_men', grund: 'osl_10_28' },
  Domstol: { beslut: 'inget_men', grund: 'osl_10_28' },
  'Polis eller åklagare': { beslut: 'inget_men', grund: 'osl_10_23' },
  'Inspektionen för vård och omsorg': { beslut: 'inget_men', grund: 'osl_10_28' },
};
export const foreslaMenprovning = (mottagare) => (Object.hasOwn(MENPROVNING_FORSLAG, mottagare) ? MENPROVNING_FORSLAG[mottagare] : { beslut: 'inget_men', grund: 'osl_25_1' });
const menBeslut = new Map(MENPROVNING_BESLUT.map(b => [b.id, b]));
const menGrund = new Map(MENPROVNING_GRUNDER.map(g => [g.id, g]));
export const menprovningKatalog = () => ({ beslut: MENPROVNING_BESLUT.map(({ id, text }) => ({ id, text })), grunder: MENPROVNING_GRUNDER.map(({ id, text }) => ({ id, text })), forslag: { ...MENPROVNING_FORSLAG } });

// Läser menprövningen ur anropet. En text (som förr) blir en kommentar till det beslut systemet föreslår.
function lasMenprovning(inp, mottagare) {
  const forslag = foreslaMenprovning(mottagare);
  const m = typeof inp === 'string' ? { kommentar: inp } : inp && typeof inp === 'object' ? inp : {};
  const beslut = m.beslut ?? forslag.beslut;
  const grund = m.grund ?? forslag.grund;
  if (typeof beslut !== 'string' || !menBeslut.has(beslut)) throw new Fel(400, 'Välj ett av besluten i menprövningen: i sin helhet, med förbehåll eller delvis.', 'ogiltig', { falt: ['menprovning'] });
  if (typeof grund !== 'string' || !menGrund.has(grund)) throw new Fel(400, 'Välj en av grunderna för utlämnandet.', 'ogiltig', { falt: ['menprovning'] });
  if (menGrund.get(grund).bara && menGrund.get(grund).bara !== mottagare) throw new Fel(400, 'Grunden att sekretessen inte gäller gäller bara utlämnande till patienten själv. Välj en annan grund.', 'ogiltig', { falt: ['menprovning'] });
  const kommentar = typeof m.kommentar === 'string' && m.kommentar.trim() ? m.kommentar.trim().slice(0, 500) : null;
  if (beslut === 'delvis' && !kommentar) throw new Fel(400, 'Skriv vilka uppgifter som är borttagna, så att det går att följa upp vad som lämnades ut.', 'ogiltig', { falt: ['menprovning'] });
  return { beslut, grund, kommentar };
}
const menprovningText = (m) => [mottagareText(m), m.kommentar].filter(Boolean).join(' ');
const mottagareText = (m) => (m.grund === 'osl_12_1' && m.beslut === 'inget_men' ? 'Lämnas ut till patienten själv.' : menBeslut.get(m.beslut).text);

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
    // Runda 10, r2: urvalet. Intervallet föreslås från den äldsta till den senaste uppgiften, och posterna är de som syns.
    urval: urvalForslag(atk),
  };
}

function urvalForslag(atk) {
  const lista = valbaraPoster(atk);
  const dagar = lista.map(x => dagAv(x.tid)).filter(Boolean).sort();
  return { fran: dagar[0] ?? idag(), till: idag() > (dagar.at(-1) ?? '') ? idag() : dagar.at(-1), poster: lista.sort((a, b) => String(b.tid).localeCompare(String(a.tid))) };
}

// Bygger innehållet med samma funktioner som gränssnittet. Varje del prövas för sig och det som döljs räknas.
// Runda 10, r2: varje rad har sin post och sitt datum, så att ett urval (datumintervall eller valda poster) kan göras
// på exakt det som annars skulle ha skrivits ut. urval: { fran, till, poster } eller null.
function poster(atk, delar) {
  const db = atk.db;
  const ut = [];
  for (const d of delar) {
    if (d === 'lakemedel') {
      atk.krav('las_lakemedel');
      const rader = lakemedel.synligaOrdinationer(atk).filter(lakemedel.aktuell).map(o => lakemedel.ordinationUt(db, o, { historik: false }));
      // Ett aktuellt läkemedel gäller från starten och framåt, så det hör till varje intervall som slutar efter starten.
      ut.push({ id: d, rubrik: 'Aktuella läkemedel', poster: rader.map(o => ({ post: { typ: 'ordination', id: o.id }, fran: o.start, till: null,
        rad: { rubrik: `${o.lakemedel?.namn ?? ''} ${o.lakemedel?.styrka ?? ''}`.trim(), text: `${o.dosering}. Orsak: ${o.ordinationsorsak}. Uppföljning ${o.uppfoljningsdatum}.`, enhet: o.vardenhet.namn, tid: o.start } })) });
    } else if (d === 'diagnoser') {
      atk.krav('las_diagnoser');
      const rader = journal.synligaDiagnoser(atk).map(x => journal.diagnosUt(db, x));
      ut.push({ id: d, rubrik: 'Diagnoser', poster: rader.map(x => ({ post: { typ: 'diagnos', id: x.id }, fran: x.datum, till: x.datum,
        rad: { rubrik: `${x.kod} ${x.text}`, text: x.typ === 'huvud' ? 'Huvuddiagnos' : 'Bidiagnos', enhet: x.vardenhet.namn, tid: x.datum } })) });
    } else if (d === 'anteckningar') {
      // Bara signerade anteckningar i den gällande versionen. Utkast skrivs inte ut.
      const lista = journal.listaAnteckningar(atk).anteckningar.filter(a => a.status === 'signerad');
      const rader = lista.map(a => journal.anteckningUt(db, journal.hamtaAnteckningRad(db, a.id)));
      ut.push({ id: d, rubrik: 'Journalanteckningar', poster: rader.map(a => {
        const tid = a.signerad?.tid ?? a.skapad;
        return { post: { typ: 'anteckning', id: a.id, version: a.version }, fran: tid, till: tid, rad: {
          rubrik: a.typ, enhet: a.enhet.namn, tid,
          text: `Signerad av ${a.signerad?.av?.namn ?? ''}${a.version > 1 ? `, version ${a.version} (rättad)` : ''}${a.kallaEtikett ? `. ${a.kallaEtikett}` : ''}.`,
          sokord: a.sokord.filter(s => s.text),
        } };
      }) });
    } else if (d === 'matvarden') {
      atk.krav('las_matvarden');
      const rader = journal.synligaMatvarden(atk).map(m => journal.matvardeUt(db, m));
      ut.push({ id: d, rubrik: 'Mätvärden och provsvar', poster: rader.map(m => ({ post: { typ: 'matvarde', id: m.id }, fran: m.tid, till: m.tid,
        rad: { rubrik: m.namn, text: `${m.varde}${m.enhet ? ` ${m.enhet}` : ''}`, enhet: m.vardenhet.namn, tid: m.tid } })) });
    } else if (d === 'remisser') {
      const rader = remiss.forPatient(atk).remisser;
      ut.push({ id: d, rubrik: 'Remisser och svar', poster: rader.map(r => ({ post: { typ: 'remiss', id: r.id }, fran: r.tider.skickad, till: r.tider.skickad, rad: {
        rubrik: `Remiss från ${r.fran.namn} till ${r.till.namn}`, enhet: r.fran.namn, tid: r.tider.skickad,
        text: [r.fragestallning ? `Frågeställning: ${r.fragestallning}` : null, r.svar ? `Svar: ${r.svar}` : null, `Status: ${r.status.replace('_', ' ')}`].filter(Boolean).join(' '),
      } })) });
    } else if (d === 'vardkontakter') {
      atk.krav('las_admin');
      const rader = journal.synligaVardkontakter(atk).map(v => journal.vardkontaktUt(db, v));
      // En vårdkontakt hör till intervallet om den pågick någon gång under det.
      ut.push({ id: d, rubrik: 'Vårdkontakter', poster: rader.map(v => ({ post: { typ: 'vardkontakt', id: v.id }, fran: v.start, till: v.slut,
        rad: { rubrik: v.orsak ?? 'Vårdkontakt', text: [v.plats, v.slut ? null : 'Pågår'].filter(Boolean).join(', '), enhet: v.vardenhet.namn, tid: v.start } })) });
    }
  }
  return ut;
}

const dagAv = (t) => (t ? String(t).slice(0, 10) : null);
const nyckel = (p) => `${p.typ}:${p.id}`;
// En post hör till intervallet om den gäller någon dag i det: från postens start till dess slut (eller tills vidare).
const iIntervall = (x, fran, till) => (!till || dagAv(x.fran) <= till) && (!fran || x.till == null || dagAv(x.till) >= fran);

function innehall(atk, delar, urval = null) {
  const sektioner = [];
  const valda = [];
  const valdaNycklar = urval?.poster ? new Set(urval.poster.map(nyckel)) : null;
  for (const s of poster(atk, delar)) {
    const med = s.poster.filter(x => iIntervall(x, urval?.fran, urval?.till) && (!valdaNycklar || valdaNycklar.has(nyckel(x.post))));
    // En del utan någon vald post tas inte med när enstaka poster väljs.
    if (valdaNycklar && !med.length) continue;
    valda.push(...med.map(x => x.post));
    sektioner.push({ id: s.id, rubrik: s.rubrik, rader: med.map(x => x.rad) });
  }
  return { sektioner, poster: valda };
}

// Runda 10, r2: posterna som kan väljas en och en, med rubrik och datum, i samma urval som utskriften.
export const TYP_DEL = { ordination: 'lakemedel', diagnos: 'diagnoser', anteckning: 'anteckningar', matvarde: 'matvarden', remiss: 'remisser', vardkontakt: 'vardkontakter' };
function valbaraPoster(atk) {
  const delar = DELAR.map(d => d.id).filter(d => kanDel(atk.personal, d));
  return poster(atk, delar).flatMap(s => s.poster.map(x => ({ typ: x.post.typ, id: x.post.id, del: s.id, rubrik: x.rad.rubrik, tid: x.rad.tid, enhet: x.rad.enhet })));
}

// Kontrollerar urvalet. Valda poster måste finnas bland det den inloggade får se; en post som inte gör det får samma svar
// som en post som inte finns, så att inget röjs.
function lasUrval(inp) {
  const fran = inp?.fran ?? null;
  const till = inp?.till ?? null;
  for (const [falt, v] of [['fran', fran], ['till', till]]) if (v != null && !giltigtDatum(v)) throw new Fel(400, 'Ange datum som ÅÅÅÅ-MM-DD.', 'ogiltig', { falt: [falt] });
  if (fran && till && fran > till) throw new Fel(400, 'Intervallet slutar före det börjar. Välj ett slutdatum som är samma dag eller senare.', 'ogiltig', { falt: ['till'] });
  let lista = null;
  if (inp?.anteckningId != null) lista = [{ typ: 'anteckning', id: Number(inp.anteckningId) }];
  else if (Array.isArray(inp?.poster)) {
    if (!inp.poster.length || inp.poster.length > 200) throw new Fel(400, 'Välj mellan en och 200 poster.', 'ogiltig', { falt: ['poster'] });
    lista = inp.poster.map(p => ({ typ: String(p?.typ ?? ''), id: Number(p?.id) }));
    if (lista.some(p => !Object.hasOwn(TYP_DEL, p.typ) || !Number.isInteger(p.id))) throw new Fel(400, 'En vald post finns inte bland det du kan se.', 'ogiltig', { falt: ['poster'] });
    lista = [...new Map(lista.map(p => [nyckel(p), p])).values()];
  }
  if (lista && lista.some(p => !Number.isInteger(p.id))) throw new Fel(400, 'En vald post finns inte bland det du kan se.', 'ogiltig', { falt: ['poster'] });
  return fran || till || lista ? { fran, till, poster: lista } : null;
}

// Skriver ut. inp: { syfte, delar, avidentifierad, utlamnasTill, menprovning }. Returnerar utskriften med id, och
// utlämnandet om utskriften lämnas ut i samma steg.
export function skrivUt(atk, p, inp, val) {
  atk.krav('skriv_ut');
  const db = atk.db;
  const syfte = typeof inp?.syfte === 'string' ? inp.syfte.trim() : '';
  if (syfte.length < 3 || syfte.length > 200) throw new Fel(400, 'Ange syftet med utskriften.', 'ogiltig', { falt: ['syfte'] });
  // Runda 10, r2: urvalet. Med valda poster följer delarna av posterna, om inga delar anges.
  const urval = lasUrval(inp);
  const valda = Array.isArray(inp?.delar) ? [...new Set(inp.delar)]
    : urval?.poster ? [...new Set(urval.poster.map(p => TYP_DEL[p.typ]))] : [];
  if (!valda.length || valda.some(d => !Object.hasOwn(DEL, d))) throw new Fel(400, 'Välj vad som ska skrivas ut.', 'ogiltig', { falt: ['delar'] });
  const delar = DELAR.map(d => d.id).filter(d => valda.includes(d) && kanDel(atk.personal, d));
  const ejRoll = DELAR.filter(d => valda.includes(d.id) && !kanDel(atk.personal, d.id)).map(d => d.rubrik);
  if (!delar.length) throw new Fel(403, 'Din yrkesroll får inte läsa något av det som valdes, så det går inte att skriva ut.', 'nekad');
  const utlamnasTill = typeof inp?.utlamnasTill === 'string' && inp.utlamnasTill.trim() ? inp.utlamnasTill.trim().slice(0, 120) : null;
  if (utlamnasTill && !kanRoll(atk.personal, 'utlamna')) throw new Fel(403, 'Din yrkesroll kan inte registrera utlämnande av journalhandlingar.', 'nekad');
  const avidentifierad = Boolean(inp?.avidentifierad);
  if (avidentifierad && utlamnasTill === PATIENTEN) throw new Fel(400, 'En kopia till patienten skrivs ut med patientens namn och personnummer.', 'ogiltig', { falt: ['avidentifierad'] });

  const { sektioner, poster } = innehall(atk, delar, urval);
  if (urval?.poster) {
    const fanns = new Set(poster.map(nyckel));
    if (urval.poster.some(p => !fanns.has(nyckel(p)))) throw new Fel(400, 'En vald post finns inte bland det du kan se.', 'ogiltig', { falt: ['poster'] });
  }
  // Det som inte kom med. Det röjs inte vad det är eller vilken vårdenhet det kommer från.
  const utelamnat = [];
  if (atk.doldaVal > 0) utelamnat.push(`${atk.doldaVal === 1 ? 'En uppgift' : `${atk.doldaVal} uppgifter`} från andra vårdenheter finns inte med, eftersom de kräver ett aktivt val som inte är gjort för patienten.`);
  if (atk.doldaSparr) utelamnat.push('Det finns spärrade uppgifter som inte finns med. De kan bara visas om patienten samtycker.');
  if (ejRoll.length) utelamnat.push(`${ejRoll.join(', ')} ingår inte, eftersom din yrkesroll inte får läsa ${ejRoll.length === 1 ? 'den delen' : 'de delarna'}.`);
  if (urval?.fran || urval?.till) utelamnat.push(`Urval: bara uppgifter ${urval.fran ? `från ${urval.fran} ` : ''}${urval.till ? `till ${urval.till}` : 'till i dag'}. Aktuella läkemedel och vårdkontakter är med om de gällde någon dag i intervallet.`.replace('  ', ' '));
  if (urval?.poster) utelamnat.push(`Urval: ${urval.poster.length === 1 ? 'en vald post' : `${urval.poster.length} valda poster`}. Andra uppgifter i journalen finns inte med.`);
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
    db.query(`INSERT INTO utskrifter (id, patient_id, personal_id, enhet_id, tid, syfte, delar, utelamnat, avidentifierad, poster, innehall_hash, grund, urval)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, p.id, atk.personal.id, atk.personal.enhet_id, tid, syfte, JSON.stringify(delar), JSON.stringify(utelamnat), avidentifierad ? 1 : 0, JSON.stringify(poster), hash, grund, urval ? JSON.stringify(urval) : null);
    atk.logga('skriv_ut', grund, `utskrift:${id}`, 'tillaten', syfte);
  })();
  let utlamnande = null;
  if (utlamnasTill) {
    utlamnande = registreraUtlamnande(atk, p, {
      mottagare: utlamnasTill, utskriftId: id,
      menprovning: inp?.menprovning ?? null,
    });
  }
  return {
    id, tid, syfte, grund, avidentifierad, kontrollsumma: hash,
    av: { ...personKort(db, atk.personal.id), enhet: enhetsnamn(db, atk.personal.enhet_id) },
    vardgivare: enhetsnamn(db, 'rol'), patient, delar: delar.map(d => DEL[d].rubrik), sektioner, utelamnat, utlamnande, urval,
  };
}

const utskriftUt = (db, u) => ({
  id: u.id, tid: u.tid, syfte: u.syfte, av: personKort(db, u.personal_id), enhet: { id: u.enhet_id, namn: enhetsnamn(db, u.enhet_id) },
  delar: JSON.parse(u.delar).map(d => DEL[d]?.rubrik ?? d), utelamnat: JSON.parse(u.utelamnat), avidentifierad: Boolean(u.avidentifierad),
  antalPoster: JSON.parse(u.poster).length, kontrollsumma: u.innehall_hash, grund: u.grund, patientId: u.patient_id,
  urval: u.urval ? JSON.parse(u.urval) : null,
});
const utlamnandeUt = (db, u) => ({
  id: u.id, mottagare: u.mottagare, beskrivning: u.beskrivning, menprovning: u.menprovning, utskriftId: u.utskrift_id,
  // Runda 10, r2: den strukturerade menprövningen. Äldre utlämnanden har bara texten.
  menprovningBeslut: u.menprovning_beslut ? {
    beslut: u.menprovning_beslut, beslutText: menBeslut.get(u.menprovning_beslut)?.text ?? u.menprovning_beslut,
    grund: u.menprovning_grund, grundText: menGrund.get(u.menprovning_grund)?.text ?? u.menprovning_grund,
    av: personKort(db, u.menprovning_av), tid: u.utlamnad, kommentar: u.menprovning_kommentar ?? null,
  } : null,
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
  // Runda 10, r2: den som registrerar utlämnandet har gjort menprövningen i sin egen inloggning.
  const men = lasMenprovning(inp?.menprovning, mottagare);
  const menprovning = menprovningText(men);
  const tid = iso();
  const r = db.query(`INSERT INTO utlamnanden (patient_id, enhet_id, utskrift_id, mottagare, beskrivning, menprovning, utlamnad, utlamnad_av, aterlamnas_senast,
      menprovning_beslut, menprovning_grund, menprovning_av, menprovning_kommentar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.id, atk.personal.enhet_id, utskriftId, mottagare, beskrivning, menprovning, tid, atk.personal.id, senast,
    men.beslut, men.grund, atk.personal.id, men.kommentar);
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
    menprovning: menprovningKatalog(),
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

// Runda 10, r2: eftersökning av utlämnade journalhandlingar på mottagare över alla patienter (Sussa 3.1.9.5), för
// logggranskaren. Mottagaren söks utan hänsyn till skiftläge, och ett tidsintervall kan anges. Rutten prövar rollen och
// loggar sökningen, och patientens namn och personnummer läggs till där, maskerade för skyddad identitet.
export function sokUtlamnanden(db, { mottagare = null, fran = null, till = null } = {}) {
  const q = typeof mottagare === 'string' && mottagare.trim() ? mottagare.trim().toLocaleLowerCase('sv').slice(0, 120) : null;
  const rader = db.query('SELECT * FROM utlamnanden WHERE (?1 IS NULL OR utlamnad >= ?1) AND (?2 IS NULL OR utlamnad <= ?2) ORDER BY utlamnad DESC, id DESC').all(fran, till)
    .filter(u => !q || u.mottagare.toLocaleLowerCase('sv').includes(q));
  const alla = [...new Set(db.query('SELECT mottagare FROM utlamnanden ORDER BY mottagare').all().map(r => r.mottagare))];
  return { mottagare: alla, sokt: q, rader: rader.slice(0, 500).map(u => utlamnandeUt(db, u)), antal: rader.length };
}
