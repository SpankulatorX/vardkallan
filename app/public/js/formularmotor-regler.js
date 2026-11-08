// Runda 10, r3: formulärmotorns regler (Sussa 3.1.3.1, 3.1.3.5 och 5.1.1.3). Gemensam för gränssnittet och servern, så att
// kontrollen av ett formulär, kontrollen av svaren, poängen, varningarna och texten som skrivs ur svaren blir desamma
// överallt. Servern kontrollerar och räknar alltid om allt och litar aldrig på det som gränssnittet har räknat.
//
// Ett formulär är data: en definition med frågor av fördefinierade datatyper, där varje datatyp har sin validering. En
// fråga kan ha fasta svarsalternativ med poäng och kod, visas eller krävas bara när ett villkor gäller, fyllas i av
// systemet ur journalen och vara en bild där den som dokumenterar markerar ett läge. Poängen räknas till en skala med
// tolkning, och reglerna ger varningar och förslag på vanlig svenska. Kontrollen av koderna mot kodverken görs på
// servern (src/formularmotor.js), som har kodverken.
//
// Systemet är experten: den som fyller i formuläret svarar bara på frågorna. Systemet visar de frågor som gäller, fyller i
// det som redan finns i journalen, räknar poängen, säger vad poängen betyder, avgör själv vilken kroppsdel och sida en
// markering i bilden ligger på och skriver anteckningens text. Den som bygger ett formulär får en förklaring på vanlig
// svenska för varje fel i definitionen.

export const DATATYPER = {
  text: { namn: 'Fritext', beskrivning: 'Text som den som dokumenterar skriver. Högst ett antal tecken.' },
  heltal: { namn: 'Heltal', beskrivning: 'Ett heltal mellan en lägsta och en högsta gräns.' },
  decimal: { namn: 'Tal med decimaler', beskrivning: 'Ett tal med högst en decimal mellan en lägsta och en högsta gräns, med enhet.' },
  datum: { namn: 'Datum', beskrivning: 'Ett datum, som inte får ligga i framtiden.' },
  ja_nej: { namn: 'Ja eller nej', beskrivning: 'Två fasta svar. Ja och nej kan ge poäng.' },
  val: { namn: 'Ett fast svar', beskrivning: 'Ett av flera fasta svarsalternativ, som kan ge poäng och ha en kod.' },
  flerval: { namn: 'Flera fasta svar', beskrivning: 'Ett eller flera av flera fasta svarsalternativ, som kan ge poäng och ha en kod.' },
  bild: { namn: 'Bild med markeringar', beskrivning: 'En beskrivande bild där den som dokumenterar markerar var något finns, en eller flera gånger. Systemet skriver vilken kroppsdel och sida markeringen ligger på.' },
  matvarde: { namn: 'Mätvärde', beskrivning: 'Ett mätvärde ur journalens mätvärden, med mätvärdets gränser och enhet. Systemet fyller i det senaste värdet, och ett nytt värde registreras som mätvärde när anteckningen signeras.' },
};

// Det som systemet kan fylla i ur journalen, och för vilka datatyper.
export const FORIFYLLNAD = {
  alder: { text: 'Patientens ålder, ur personnumret', typer: ['heltal'] },
  senaste: { text: 'Det senaste mätvärdet som du får se', typer: ['matvarde'] },
  diagnoser: { text: 'Patientens diagnoser som du får se', typer: ['text'] },
};

export const KATEGORIER = { omvardnad: 'Omvårdnad: skrivs och läses av dem som skriver omvårdnadsanteckningar', lakare: 'Läkare: skrivs och läses av dem som skriver läkaranteckningar' };
export const YRKEN = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', underskoterska: 'Undersköterska', fysioterapeut: 'Fysioterapeut' };
export const SOKORD_STANDARD = 'Status';
export const MAX = { falt: 40, alternativ: 20, regler: 12, tolkning: 8, markeringar: 20, text: 4000, markeringText: 200 };

// Kroppsbilden. Koordinaterna är procent av bildens bredd och höjd, och regionerna är rektanglar. Bilden ritas ur samma
// regioner, så att det man ser och det systemet räknar är detsamma. I vyn framifrån ligger patientens högra sida till
// vänster i bilden, och bakifrån till höger, vilket systemet räknar med så att den som markerar aldrig behöver tänka på
// det. sida är 'h' eller 'v' för en region på en av sidorna, och mitt för en region i mitten.
const R = (id, text, x1, y1, x2, y2, sida = null) => ({ id, text, x1, y1, x2, y2, sida });
const parad = (id, text, xh1, xh2, y1, y2) => [R(`${id}-h`, `höger ${text}`, xh1, y1, xh2, y2, 'h'), R(`${id}-v`, `vänster ${text}`, 100 - xh2, y1, 100 - xh1, y2, 'v')];
const spegla = (lista) => lista.map(r => (r.sida ? { ...r, x1: 100 - r.x2, x2: 100 - r.x1 } : r));
const FRAM = [
  R('huvud', 'huvud och ansikte', 41, 0, 59, 11), R('hals', 'hals', 45, 11, 55, 15),
  R('brost', 'bröstkorg', 35, 15, 65, 33), R('buk', 'buk', 35, 33, 65, 46), R('ljumske', 'ljumskar och underliv', 37, 46, 63, 52),
  ...parad('overarm', 'överarm', 25, 35, 16, 34), ...parad('underarm', 'underarm', 20, 33, 34, 48), ...parad('hand', 'hand', 15, 30, 48, 56),
  ...parad('lar', 'lår', 36, 50, 52, 72), ...parad('kna', 'knä', 37, 50, 72, 77), ...parad('underben', 'underben', 38, 50, 77, 92), ...parad('fot', 'fot', 36, 50, 92, 100),
];
const BAK_MITT = [
  R('bakhuvud', 'bakhuvud', 41, 0, 59, 11), R('nacke', 'nacke', 45, 11, 55, 15),
  R('ovre-rygg', 'övre delen av ryggen', 35, 15, 65, 33), R('landrygg', 'ländrygg', 35, 33, 65, 42), R('korsben', 'korsbensregionen', 42, 42, 58, 47),
];
const BAK = [
  ...BAK_MITT,
  ...spegla([...parad('skinka', 'skinka', 35, 50, 42, 52), ...parad('armbage', 'armbåge och baksida av överarmen', 25, 35, 16, 34), ...parad('underarm-bak', 'underarm, utsidan', 20, 33, 34, 48), ...parad('handrygg', 'handrygg', 15, 30, 48, 56),
    ...parad('lar-bak', 'baksida av låret', 36, 50, 52, 72), ...parad('knaveck', 'knäveck', 37, 50, 72, 77), ...parad('vad', 'vad', 38, 50, 77, 90), ...parad('hal', 'häl', 38, 50, 90, 100)]),
];
export const BILDER = {
  kropp: {
    namn: 'Kroppsbild framifrån och bakifrån',
    vyer: { fram: { namn: 'Framifrån', regioner: FRAM }, bak: { namn: 'Bakifrån', regioner: BAK } },
  },
};

// Vilken region en punkt ligger i. Ligger den utanför kroppen säger systemet det, så att markeringen kan flyttas.
export function region(bild, vy, x, y) {
  const v = BILDER[bild]?.vyer?.[vy];
  if (!v) return null;
  const r = v.regioner.find(g => x >= g.x1 && x <= g.x2 && y >= g.y1 && y <= g.y2);
  if (!r) return null;
  const sidtext = vy === 'fram' ? 'framsida' : 'baksida';
  // Bakifrån har varje region redan ett eget namn. Framifrån får armar och ben ordet framsida, så att höger underben
  // framsida inte blandas ihop med vaden.
  const text = vy === 'fram' && r.sida ? `${r.text}, ${sidtext}` : r.text;
  return { id: `${vy}:${r.id}`, text };
}

const harEgen = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const tom = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const strang = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');
const talAv = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(',', '.')) : NaN);
const talText = (n) => String(n).replace('.', ',');
const fel = (varfor, falt) => ({ ok: false, varfor, falt });

// Ett villkor på en tidigare fråga: { falt, ar } (svaret är just det), { falt, minst } och { falt, hogst } (tal), eller
// { falt, ifyllt: true }. Villkoret { poang: { minst } } gäller skalans summa och används bara i regler.
function provaVillkor(v, tidigare, { poangTillat = false } = {}) {
  if (!v || typeof v !== 'object') return 'Villkoret saknas.';
  if (harEgen(v, 'poang')) {
    if (!poangTillat) return 'Ett villkor på poängen kan bara användas i en regel.';
    const m = Number(v.poang?.minst);
    return Number.isInteger(m) ? null : 'Villkoret på poängen behöver en lägsta poäng som heltal.';
  }
  const f = tidigare.get(v.falt);
  if (!f) return `Villkoret pekar på frågan ${String(v.falt ?? '').slice(0, 30)}, som inte finns före den här frågan. Ett villkor kan bara bygga på en fråga som kommer före.`;
  const slag = ['ar', 'minst', 'hogst', 'ifyllt'].filter(k => harEgen(v, k));
  if (slag.length !== 1) return `Villkoret på frågan ${f.fraga} behöver ett av: är, minst, högst eller ifyllt.`;
  if (slag[0] === 'ar') {
    if (f.typ === 'ja_nej' && !['ja', 'nej'].includes(v.ar)) return `Frågan ${f.fraga} besvaras med ja eller nej.`;
    if ((f.typ === 'val' || f.typ === 'flerval') && !f.alternativ.some(a => a.varde === v.ar)) return `Frågan ${f.fraga} har inget svarsalternativ ${String(v.ar).slice(0, 30)}.`;
    if (!['ja_nej', 'val', 'flerval'].includes(f.typ)) return `Villkoret är gäller bara frågor med fasta svar. Använd minst eller högst för frågan ${f.fraga}.`;
  }
  if ((slag[0] === 'minst' || slag[0] === 'hogst') && (!['heltal', 'decimal', 'matvarde'].includes(f.typ) || !Number.isFinite(Number(v[slag[0]])))) return `Villkoret minst eller högst behöver en fråga med tal och ett tal att jämföra med. Frågan ${f.fraga} är inte ett tal.`;
  return null;
}

function villkorGaller(v, svar, poangSumma = null) {
  if (!v) return true;
  if (harEgen(v, 'poang')) return poangSumma != null && poangSumma >= Number(v.poang.minst);
  const s = svar[v.falt];
  if (harEgen(v, 'ifyllt')) return !tom(s);
  if (harEgen(v, 'ar')) return Array.isArray(s) ? s.includes(v.ar) : s === v.ar;
  const n = talAv(s);
  if (!Number.isFinite(n)) return false;
  return harEgen(v, 'minst') ? n >= Number(v.minst) : n <= Number(v.hogst);
}

// Kontrollerar en definition och ger den i normaliserad form. opt.mattyper är journalens mätvärdestyper med namn,
// gränser och enhet, opt.sokord sökorden som en fråga kan hamna under och opt.upptagnaNamn namn som redan är mallar.
export function provaDefinition(def, { mattyper = {}, sokord = [SOKORD_STANDARD], upptagnaNamn = [], vardenheter = null } = {}) {
  if (!def || typeof def !== 'object' || Array.isArray(def)) return fel('Formuläret saknas.', 'definition');
  const namn = strang(def.namn, 60);
  if (namn.length < 3 || namn.length > 60) return fel('Formuläret behöver ett namn med 3 till 60 tecken. Namnet blir anteckningens typ i journalen.', 'namn');
  if (upptagnaNamn.some(n => n.toLowerCase() === namn.toLowerCase())) return fel(`Namnet ${namn} används redan av en mall i journalen. Välj ett annat namn, så att ingen blandar ihop dem.`, 'namn');
  const beskrivning = strang(def.beskrivning, 500);
  if (beskrivning.length > 500) return fel('Beskrivningen får vara högst 500 tecken.', 'beskrivning');
  if (!harEgen(KATEGORIER, def.kategori)) return fel('Välj om formuläret hör till omvårdnaden eller läkarnas dokumentation. Det avgör vem som får skriva och läsa det.', 'kategori');
  let roller = null;
  if (def.roller != null) {
    if (!Array.isArray(def.roller) || def.roller.some(r => !harEgen(YRKEN, r))) return fel('Yrkena som får fylla i formuläret känns inte igen.', 'roller');
    roller = [...new Set(def.roller)];
    if (!roller.length) roller = null;
    if (roller && def.kategori === 'lakare' && roller.some(r => r !== 'lakare')) return fel('Ett formulär för läkarnas dokumentation fylls bara i av läkare. Välj omvårdnad om fler yrken ska fylla i det.', 'roller');
  }
  let enheter = null;
  if (def.enheter != null) {
    if (!Array.isArray(def.enheter) || def.enheter.some(e => typeof e !== 'string')) return fel('Vårdenheterna känns inte igen.', 'enheter');
    enheter = [...new Set(def.enheter)];
    if (vardenheter && enheter.some(e => !vardenheter.includes(e))) return fel('En av vårdenheterna finns inte.', 'enheter');
    if (!enheter.length) enheter = null;
  }
  if (!Array.isArray(def.falt) || def.falt.length === 0) return fel('Formuläret behöver minst en fråga.', 'falt');
  if (def.falt.length > MAX.falt) return fel(`Ett formulär kan ha högst ${MAX.falt} frågor. Dela upp det i två formulär, så blir det lättare att fylla i.`, 'falt');
  const tidigare = new Map();
  const falt = [];
  for (const [i, f0] of def.falt.entries()) {
    const nr = `Fråga ${i + 1}`;
    if (!f0 || typeof f0 !== 'object') return fel(`${nr} saknas.`, `nr${i}`);
    const id = typeof f0.id === 'string' ? f0.id : '';
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(id)) return fel(`${nr} behöver en kort nyckel med små bokstäver a till z, siffror och understreck, till exempel fall_senaste_aret.`, `nr${i}.id`);
    if (tidigare.has(id)) return fel(`Nyckeln ${id} finns två gånger. Varje fråga behöver en egen nyckel.`, `nr${i}.id`);
    const fraga = strang(f0.fraga, 200);
    if (fraga.length < 2 || fraga.length > 200) return fel(`${nr} behöver en frågetext med 2 till 200 tecken.`, `nr${i}.fraga`);
    if (!harEgen(DATATYPER, f0.typ)) return fel(`${nr}, ${fraga}: datatypen känns inte igen. Välj en av ${Object.values(DATATYPER).map(d => d.namn.toLowerCase()).join(', ')}.`, `nr${i}.typ`);
    const f = { id, fraga, typ: f0.typ, obligatoriskt: Boolean(f0.obligatoriskt) };
    const sk = f0.sokord == null || f0.sokord === '' ? SOKORD_STANDARD : f0.sokord;
    if (!sokord.includes(sk)) return fel(`${nr}, ${fraga}: sökordet ${String(sk).slice(0, 40)} finns inte i journalens sökord. Svaret hamnar under ett sökord som har en kod i fackspråket.`, `nr${i}.sokord`);
    f.sokord = sk;
    if (f0.hjalp != null) { const h = strang(f0.hjalp, 300); if (h.length > 300) return fel(`${nr}: hjälptexten får vara högst 300 tecken.`, `nr${i}.hjalp`); if (h) f.hjalp = h; }
    if (f0.kod != null) f.kod = f0.kod;
    if (f.typ === 'text') {
      const m = f0.maxLangd == null ? 1000 : Number(f0.maxLangd);
      if (!Number.isInteger(m) || m < 1 || m > MAX.text) return fel(`${nr}, ${fraga}: längsta text ska vara ett heltal mellan 1 och ${MAX.text} tecken.`, `nr${i}.maxLangd`);
      f.maxLangd = m;
    }
    if (f.typ === 'heltal' || f.typ === 'decimal') {
      const min = Number(f0.min); const max = Number(f0.max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return fel(`${nr}, ${fraga}: ange en lägsta och en högsta gräns, där den lägsta är mindre.`, `nr${i}.min`);
      if (f.typ === 'heltal' && (!Number.isInteger(min) || !Number.isInteger(max))) return fel(`${nr}, ${fraga}: gränserna för ett heltal är heltal.`, `nr${i}.min`);
      Object.assign(f, { min, max });
      if (f0.enhet != null) { const e = strang(f0.enhet, 20); if (e.length > 20) return fel(`${nr}: enheten får vara högst 20 tecken.`, `nr${i}.enhet`); if (e) f.enhet = e; }
    }
    if (f.typ === 'matvarde') {
      const mt = mattyper[f0.matvarde];
      if (!mt || mt.format) return fel(`${nr}, ${fraga}: välj ett av journalens mätvärden som anges med ett tal, till exempel vikt eller puls.`, `nr${i}.matvarde`);
      Object.assign(f, { matvarde: f0.matvarde, min: mt.min, max: mt.max, enhet: mt.enhet, ...(mt.heltal ? { heltal: true } : {}) });
    }
    if (f.typ === 'ja_nej') {
      const p = f0.poang ?? {};
      for (const k of ['ja', 'nej']) if (p[k] != null && !(Number.isInteger(p[k]) && Math.abs(p[k]) <= 10)) return fel(`${nr}, ${fraga}: poängen för ${k} ska vara ett heltal mellan -10 och 10.`, `nr${i}.poang`);
      if (p.ja != null || p.nej != null) f.poang = { ja: p.ja ?? 0, nej: p.nej ?? 0 };
    }
    if (f.typ === 'val' || f.typ === 'flerval') {
      const alt = f0.alternativ;
      if (!Array.isArray(alt) || alt.length < 2 || alt.length > MAX.alternativ) return fel(`${nr}, ${fraga}: frågan behöver 2 till ${MAX.alternativ} svarsalternativ.`, `nr${i}.alternativ`);
      const sett = new Set();
      f.alternativ = [];
      for (const [j, a] of alt.entries()) {
        const text = strang(a?.text, 120);
        if (!text || text.length > 120) return fel(`${nr}, ${fraga}: svarsalternativ ${j + 1} behöver en text med högst 120 tecken.`, `nr${i}.alternativ.${j}`);
        const varde = typeof a.varde === 'string' && /^[a-z0-9_]{1,30}$/.test(a.varde) ? a.varde : null;
        if (!varde) return fel(`${nr}, ${fraga}: svarsalternativet ${text} behöver en kort nyckel med små bokstäver och siffror.`, `nr${i}.alternativ.${j}`);
        if (sett.has(varde)) return fel(`${nr}, ${fraga}: nyckeln ${varde} finns för två svarsalternativ.`, `nr${i}.alternativ.${j}`);
        sett.add(varde);
        if (a.poang != null && !(Number.isInteger(a.poang) && Math.abs(a.poang) <= 10)) return fel(`${nr}, ${fraga}: poängen för ${text} ska vara ett heltal mellan -10 och 10.`, `nr${i}.alternativ.${j}`);
        f.alternativ.push({ varde, text, ...(a.poang != null ? { poang: a.poang } : {}), ...(a.kod != null ? { kod: a.kod } : {}) });
      }
    }
    if (f.typ === 'bild') {
      if (!harEgen(BILDER, f0.bild)) return fel(`${nr}, ${fraga}: välj en av bilderna, till exempel kroppsbilden.`, `nr${i}.bild`);
      const m = f0.maxMarkeringar == null ? 10 : Number(f0.maxMarkeringar);
      if (!Number.isInteger(m) || m < 1 || m > MAX.markeringar) return fel(`${nr}, ${fraga}: antalet markeringar ska vara mellan 1 och ${MAX.markeringar}.`, `nr${i}.maxMarkeringar`);
      Object.assign(f, { bild: f0.bild, maxMarkeringar: m });
    }
    if (f0.forifyll != null) {
      const ff = FORIFYLLNAD[f0.forifyll];
      if (!ff || !ff.typer.includes(f.typ)) return fel(`${nr}, ${fraga}: systemet kan inte fylla i den här frågan ur journalen. ${Object.values(FORIFYLLNAD).map(x => x.text).join(', ')} kan fyllas i, för var sin datatyp.`, `nr${i}.forifyll`);
      f.forifyll = f0.forifyll;
    }
    for (const nyckel of ['visaOm', 'kravsOm']) {
      if (f0[nyckel] == null) continue;
      const v = provaVillkor(f0[nyckel], tidigare);
      if (v) return fel(`${nr}, ${fraga}: ${v}`, `nr${i}.${nyckel}`);
      f[nyckel] = { ...f0[nyckel] };
    }
    falt.push(f);
    tidigare.set(id, f);
  }
  const ut = { namn, beskrivning, kategori: def.kategori, roller, enheter, falt };
  const poangfalt = falt.filter(f => f.poang || f.alternativ?.some(a => a.poang != null));
  if (def.skala != null) {
    const s = def.skala;
    const sn = strang(s.namn, 60);
    if (sn.length < 2) return fel('Skalan behöver ett namn, till exempel Fallrisk.', 'skala.namn');
    if (!poangfalt.length) return fel('Skalan räknar poängen från frågorna, men ingen fråga ger poäng. Ge svarsalternativen poäng först.', 'skala');
    const { min, max } = poangOmfang({ falt });
    if (!Array.isArray(s.tolkning) || !s.tolkning.length || s.tolkning.length > MAX.tolkning) return fel(`Skalan behöver 1 till ${MAX.tolkning} tolkningar, till exempel låg och hög risk.`, 'skala.tolkning');
    const tolkning = [];
    for (const [j, t] of s.tolkning.entries()) {
      const fran = Number(t?.fran); const till = Number(t?.till); const text = strang(t?.text, 200);
      if (!Number.isInteger(fran) || !Number.isInteger(till) || fran > till) return fel(`Tolkning ${j + 1} behöver poäng från och till som heltal, där från är högst till.`, `skala.tolkning.${j}`);
      if (!text) return fel(`Tolkning ${j + 1} behöver en text, till exempel Hög risk för fall.`, `skala.tolkning.${j}`);
      tolkning.push({ fran, till, text, varning: Boolean(t.varning), ...(t.kod != null ? { kod: t.kod } : {}) });
    }
    tolkning.sort((a, b) => a.fran - b.fran);
    for (let p = min; p <= max; p++) {
      const traffar = tolkning.filter(t => p >= t.fran && p <= t.till).length;
      if (traffar === 0) return fel(`Poängen kan bli mellan ${min} och ${max}, men ingen tolkning gäller för ${p} poäng. Varje möjlig summa behöver precis en tolkning.`, 'skala.tolkning');
      if (traffar > 1) return fel(`Två tolkningar gäller för ${p} poäng. Varje möjlig summa behöver precis en tolkning.`, 'skala.tolkning');
    }
    ut.skala = { namn: sn, tolkning, min, max, ...(s.kalla ? { kalla: strang(s.kalla, 200) } : {}) };
  }
  if (def.regler != null) {
    if (!Array.isArray(def.regler) || def.regler.length > MAX.regler) return fel(`Formuläret kan ha högst ${MAX.regler} regler.`, 'regler');
    ut.regler = [];
    for (const [j, r] of def.regler.entries()) {
      const text = strang(r?.text, 300);
      if (!text) return fel(`Regel ${j + 1} behöver en text som säger vad som gäller, till exempel vad som bör göras.`, `regler.${j}`);
      if (harEgen(r.om, 'poang') && !ut.skala) return fel(`Regel ${j + 1} bygger på poängen, men formuläret har ingen skala.`, `regler.${j}`);
      const v = provaVillkor(r.om, tidigare, { poangTillat: true });
      if (v) return fel(`Regel ${j + 1}: ${v}`, `regler.${j}`);
      ut.regler.push({ om: { ...r.om }, text, varning: r.varning !== false });
    }
  }
  return { ok: true, varde: ut };
}

// Den lägsta och högsta summa som frågorna kan ge.
export function poangOmfang(def) {
  let min = 0; let max = 0;
  for (const f of def.falt) {
    const p = f.typ === 'ja_nej' && f.poang ? [f.poang.ja, f.poang.nej] : (f.alternativ ?? []).map(a => a.poang ?? 0);
    if (!p.length || (!f.poang && !(f.alternativ ?? []).some(a => a.poang != null))) continue;
    // En fråga som inte är obligatorisk kan lämnas tom och ge 0 poäng.
    const kanVaraTom = !f.obligatoriskt || f.visaOm;
    if (f.typ === 'flerval') {
      min += Math.min(0, ...p.filter(x => x < 0).length ? [p.filter(x => x < 0).reduce((a, b) => a + b, 0)] : [0]);
      max += p.filter(x => x > 0).reduce((a, b) => a + b, 0);
    } else {
      min += Math.min(...p, ...(kanVaraTom ? [0] : []));
      max += Math.max(...p, ...(kanVaraTom ? [0] : []));
    }
  }
  return { min, max };
}

// De frågor som gäller för svaren: en fråga med visaOm visas bara när villkoret gäller.
export function synligaFalt(def, svar = {}) {
  const synliga = [];
  const sett = {};
  for (const f of def.falt) {
    if (f.visaOm && !villkorGaller(f.visaOm, sett)) continue;
    synliga.push(f);
    if (harEgen(svar, f.id)) sett[f.id] = svar[f.id];
  }
  return synliga;
}

// Kontrollerar en markering i en bild.
function provaMarkeringar(f, v) {
  if (!Array.isArray(v)) return fel(`Markeringarna i ${f.fraga} känns inte igen.`, f.id);
  if (v.length > f.maxMarkeringar) return fel(`${f.fraga} kan ha högst ${f.maxMarkeringar} markeringar.`, f.id);
  const ut = [];
  for (const [i, m] of v.entries()) {
    const x = Number(m?.x); const y = Number(m?.y);
    if (!BILDER[f.bild].vyer[m?.vy] || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return fel(`Markering ${i + 1} i ${f.fraga} ligger utanför bilden.`, f.id);
    const r = region(f.bild, m.vy, x, y);
    if (!r) return fel(`Markering ${i + 1} i ${f.fraga} ligger utanför kroppen. Markera på kroppen, så skriver systemet vilken kroppsdel det är.`, f.id);
    const text = strang(m.text, MAX.markeringText);
    if (text.length > MAX.markeringText) return fel(`Texten till markering ${i + 1} får vara högst ${MAX.markeringText} tecken.`, f.id);
    ut.push({ vy: m.vy, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, region: r.id, regionText: r.text, text });
  }
  return { ok: true, varde: ut };
}

// Kontrollerar svaren mot definitionen och ger dem i normaliserad form. Frågor som inte visas och nycklar som inte finns
// tas bort, så att bara det som gäller sparas. opt.idag är dagens datum som ÅÅÅÅ-MM-DD.
export function provaSvar(def, svar, { idag = null } = {}) {
  if (!svar || typeof svar !== 'object' || Array.isArray(svar)) return fel('Svaren saknas.', 'svar');
  const ut = {};
  for (const f of synligaFalt(def, svar)) {
    const v = svar[f.id];
    const kravs = f.obligatoriskt || (f.kravsOm && villkorGaller(f.kravsOm, ut));
    if (tom(v)) {
      if (kravs) return fel(`Svara på frågan: ${f.fraga}`, f.id);
      continue;
    }
    if (f.typ === 'text') {
      if (typeof v !== 'string') return fel(`Svaret på ${f.fraga} ska vara text.`, f.id);
      const t = v.trim();
      if (t.length > f.maxLangd) return fel(`Svaret på ${f.fraga} får vara högst ${f.maxLangd} tecken.`, f.id);
      if (t) ut[f.id] = t; else if (kravs) return fel(`Svara på frågan: ${f.fraga}`, f.id);
    } else if (f.typ === 'heltal' || f.typ === 'decimal' || f.typ === 'matvarde') {
      const n = talAv(v);
      const heltal = f.typ === 'heltal' || f.heltal;
      if (!Number.isFinite(n) || n < f.min || n > f.max) return fel(`${f.fraga} ska vara ett tal mellan ${talText(f.min)} och ${talText(f.max)}${f.enhet ? ` ${f.enhet}` : ''}.`, f.id);
      if (heltal && !Number.isInteger(n)) return fel(`${f.fraga} anges som ett heltal.`, f.id);
      if (!heltal && Math.round(n * 10) / 10 !== n) return fel(`${f.fraga} anges med högst en decimal.`, f.id);
      ut[f.id] = n;
    } else if (f.typ === 'datum') {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`)) || new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) !== v) return fel(`${f.fraga} ska vara ett datum.`, f.id);
      if (idag && v > idag) return fel(`${f.fraga} kan inte ligga i framtiden.`, f.id);
      ut[f.id] = v;
    } else if (f.typ === 'ja_nej') {
      if (v !== 'ja' && v !== 'nej') return fel(`Svara ja eller nej på ${f.fraga}`, f.id);
      ut[f.id] = v;
    } else if (f.typ === 'val') {
      if (!f.alternativ.some(a => a.varde === v)) return fel(`Välj ett av svaren på ${f.fraga}`, f.id);
      ut[f.id] = v;
    } else if (f.typ === 'flerval') {
      const lista = Array.isArray(v) ? [...new Set(v)] : null;
      if (!lista || lista.some(x => !f.alternativ.some(a => a.varde === x))) return fel(`Välj bland svaren på ${f.fraga}`, f.id);
      if (lista.length) ut[f.id] = f.alternativ.filter(a => lista.includes(a.varde)).map(a => a.varde);
      else if (kravs) return fel(`Svara på frågan: ${f.fraga}`, f.id);
    } else if (f.typ === 'bild') {
      const m = provaMarkeringar(f, v);
      if (!m.ok) return m;
      if (m.varde.length) ut[f.id] = m.varde; else if (kravs) return fel(`Markera i bilden: ${f.fraga}`, f.id);
    }
  }
  return { ok: true, varde: ut };
}

// Poängen och tolkningen, eller null när formuläret inte har någon skala.
export function poang(def, svar) {
  if (!def.skala) return null;
  let summa = 0;
  for (const f of synligaFalt(def, svar)) {
    const v = svar[f.id];
    if (tom(v)) continue;
    if (f.typ === 'ja_nej' && f.poang) summa += f.poang[v] ?? 0;
    if (f.typ === 'val') summa += f.alternativ.find(a => a.varde === v)?.poang ?? 0;
    if (f.typ === 'flerval') summa += f.alternativ.filter(a => v.includes(a.varde)).reduce((s, a) => s + (a.poang ?? 0), 0);
  }
  const t = def.skala.tolkning.find(x => summa >= x.fran && summa <= x.till) ?? null;
  return { namn: def.skala.namn, summa, max: def.skala.max, tolkning: t ? { text: t.text, varning: t.varning, ...(t.kod ? { kod: t.kod } : {}) } : null };
}

// Varningarna och förslagen ur reglerna, i definitionens ordning.
export function varningar(def, svar) {
  const p = poang(def, svar);
  return (def.regler ?? []).filter(r => villkorGaller(r.om, svar, p?.summa ?? null)).map(r => ({ text: r.text, varning: r.varning }));
}

// Svaret på en fråga som text.
export function svarText(f, v, { kalla = null } = {}) {
  if (f.typ === 'ja_nej') return v === 'ja' ? 'ja' : 'nej';
  if (f.typ === 'val') return f.alternativ.find(a => a.varde === v)?.text ?? String(v);
  if (f.typ === 'flerval') return f.alternativ.filter(a => v.includes(a.varde)).map(a => a.text).join(', ');
  if (f.typ === 'bild') return v.map((m, i) => `${i + 1}) ${m.regionText}${m.text ? `: ${m.text}` : ''}`).join('. ');
  if (f.typ === 'heltal' || f.typ === 'decimal' || f.typ === 'matvarde') {
    const t = `${talText(v)}${f.enhet ? ` ${f.enhet}` : ''}`;
    return kalla ? `${t} (${kalla})` : t;
  }
  return String(v);
}

// Anteckningens text: frågorna och svaren under sina sökord, och skalan och reglerna under Bedömning. kallor är
// systemets text om var ett värde kommer ifrån, per fråga.
export function sokord(def, svar, { kallor = {} } = {}) {
  const per = new Map();
  const lagg = (sk, rad) => { if (!per.has(sk)) per.set(sk, []); per.get(sk).push(rad); };
  for (const f of synligaFalt(def, svar)) {
    const v = svar[f.id];
    if (tom(v)) continue;
    const t = svarText(f, v, { kalla: kallor[f.id] ?? null });
    lagg(f.sokord, `${f.fraga.replace(/[?:.]\s*$/, '')}: ${t}.`.replace(/\.\.$/, '.'));
  }
  const p = poang(def, svar);
  if (p) lagg('Bedömning', `${p.namn}: ${p.summa} poäng${p.tolkning ? `, ${p.tolkning.text.charAt(0).toLowerCase()}${p.tolkning.text.slice(1).replace(/\.$/, '')}` : ''}.`);
  for (const v of varningar(def, svar)) lagg('Bedömning', v.text);
  return [...per].map(([s, rader]) => ({ sokord: s, text: rader.join('\n') }));
}

// En kort sammanfattning för översikten.
export function sammanfattning(def, svar) {
  const p = poang(def, svar);
  if (p) return `${p.namn} ${p.summa} poäng${p.tolkning ? `, ${p.tolkning.text.toLowerCase().replace(/\.$/, '')}` : ''}`;
  return sokord(def, svar).map(s => s.text).join(' ').slice(0, 160);
}
