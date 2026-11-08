// Runda 9, r7: mallen för levnadsvanorna alkohol, fysisk aktivitet och matvanor (Sussa 6.2.2.1), på samma sätt som mallen
// för tobaksvanor (tobak-regler.js). Gemensam för gränssnittet och servern, så att risken, förslaget och texten blir
// desamma överallt. Servern räknar alltid om allt och litar aldrig på det som gränssnittet har räknat.
//
// Frågorna följer Vägledning för enhetlig dokumentation av en persons levnadsvanor, version 3 (2026-01-14), Nationellt
// system för kunskapsstyrning hälso- och sjukvård: antal standardglas en vanlig vecka och hur ofta patienten dricker fyra
// standardglas eller fler vid samma tillfälle, minuter fysisk träning och vardagsmotion en vanlig vecka, och hur ofta
// patienten äter grönsaker och rotfrukter, frukt och bär, fisk och skaldjur och sötsaker, läsk och bakverk.
//
// Förslaget på åtgärd följer Socialstyrelsens nationella riktlinjer 2024, Vård vid ohälsosamma levnadsvanor,
// prioriteringsstöd (2024-11-9272), och koderna är KVÅ 2026 (DV121 till DV143 och DV200, ordagrant ur
// E-hälsomyndighetens fil, samma som i kodverk.js). Gränserna för riskbruk, otillräcklig fysisk aktivitet och
// ohälsosamma matvanor, och poängen för matvanorna, är Vårdkällans demoregler med riktlinjernas definitioner som
// förebild och är märkta så. Den som dokumenterar svarar bara på frågorna. Systemet räknar risken, föreslår stödet och
// sätter koden när samtalet har hållits.

export const KALLA = {
  fragor: 'Vägledning för enhetlig dokumentation av en persons levnadsvanor, version 3 (2026-01-14), Nationellt system för kunskapsstyrning hälso- och sjukvård',
  riktlinjer: 'Socialstyrelsen, Nationella riktlinjer 2024, Vård vid ohälsosamma levnadsvanor, prioriteringsstöd (2024-11-9272)',
  kva: 'KVÅ 2026, E-hälsomyndigheten',
};

export const KVA_LEVNADSVANOR = {
  DV121: 'Enkla råd om alkoholvanor', DV122: 'Rådgivande samtal om alkoholvanor', DV123: 'Kvalificerat rådgivande samtal om alkoholvanor',
  DV131: 'Enkla råd om fysisk aktivitet', DV132: 'Rådgivande samtal om fysisk aktivitet', DV133: 'Kvalificerat rådgivande samtal om fysisk aktivitet',
  DV141: 'Enkla råd om matvanor', DV142: 'Rådgivande samtal om matvanor', DV143: 'Kvalificerat rådgivande samtal om matvanor',
  DV200: 'Utfärdande av recept på fysisk aktivitet (FaR)',
};

export const OMRADEN = {
  alkohol: { namn: 'Alkohol', risk: 'Riskbruk av alkohol' },
  fysisk: { namn: 'Fysisk aktivitet', risk: 'Otillräcklig fysisk aktivitet' },
  mat: { namn: 'Matvanor', risk: 'Ohälsosamma matvanor' },
};

// Frågorna med fasta svarsalternativ. Matvanornas poäng: fler grönsaker, frukt och fisk ger högre poäng, mer sötsaker
// lägre. 0 till 12 poäng, och 4 poäng eller lägre räknas som ohälsosamma matvanor (demoregel).
export const BERUSNING = [['aldrig', 'Aldrig'], ['sallan', 'Mer sällan än en gång i månaden'], ['manad', 'Varje månad'], ['vecka', 'Varje vecka'], ['dagligen', 'Dagligen eller nästan dagligen']];
export const MATFRAGOR = [
  { id: 'gronsaker', text: 'Hur ofta äter du grönsaker och rotfrukter?', alternativ: [['0', 'Mer sällan än en gång i veckan', 0], ['1', 'Några gånger i veckan', 1], ['2', 'En gång om dagen', 2], ['3', 'Två gånger om dagen eller oftare', 3]] },
  { id: 'frukt', text: 'Hur ofta äter du frukt och bär?', alternativ: [['0', 'Mer sällan än en gång i veckan', 0], ['1', 'Några gånger i veckan', 1], ['2', 'En gång om dagen', 2], ['3', 'Två gånger om dagen eller oftare', 3]] },
  { id: 'fisk', text: 'Hur ofta äter du fisk och skaldjur?', alternativ: [['0', 'Mer sällan än en gång i veckan', 0], ['1', 'En gång i veckan', 1], ['2', 'Två gånger i veckan', 2], ['3', 'Tre gånger i veckan eller oftare', 3]] },
  { id: 'sotsaker', text: 'Hur ofta äter du sötsaker, bakverk eller dricker läsk?', alternativ: [['0', 'Dagligen', 0], ['1', 'Några gånger i veckan', 1], ['2', 'En gång i veckan', 2], ['3', 'Mer sällan än en gång i veckan', 3]] },
];
export const STOD = [['accepterat', 'Erbjudet och accepterat'], ['avbojt', 'Erbjudet men avböjt'], ['ej_erbjudet', 'Inte erbjudet nu']];
const STOD_TEXT = { accepterat: 'erbjudet och accepterat', avbojt: 'erbjudet men avböjt', ej_erbjudet: 'inte erbjudet vid besöket' };
export const KOMMENTAR_MAX = 2000;
export const GRANSER = { glasPerVecka: 10, aktivitetsminuter: 150, matpoang: 4 };

const heltal = (v, min, max) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
};

// Kontrollerar svaren för ett eller flera områden. Ger { ok, varde } eller { ok: false, varfor, falt }.
export function prova(svar, { alder = null } = {}) {
  const fel = (varfor, falt) => ({ ok: false, varfor, falt });
  if (!svar || typeof svar !== 'object' || Array.isArray(svar)) return fel('Fyll i levnadsvanorna.', 'alkohol');
  const varde = {};
  if (svar.alkohol) {
    const a = svar.alkohol;
    const glas = heltal(a.glasPerVecka, 0, 200);
    if (Number.isNaN(glas) || glas === null) return fel('Skriv antal standardglas en vanlig vecka som ett heltal, 0 om patienten inte dricker alkohol.', 'alkohol.glasPerVecka');
    if (!BERUSNING.some(([b]) => b === a.berusning)) return fel('Svara på hur ofta patienten dricker fyra standardglas eller fler vid samma tillfälle.', 'alkohol.berusning');
    if (glas === 0 && a.berusning !== 'aldrig') return fel('Patienten dricker inga standardglas en vanlig vecka men fyra eller fler vid ett tillfälle. Kontrollera svaren.', 'alkohol.berusning');
    varde.alkohol = { glasPerVecka: glas, berusning: a.berusning };
  }
  if (svar.fysisk) {
    const f = svar.fysisk;
    const traning = heltal(f.traningMinuter, 0, 3000);
    const vardag = heltal(f.vardagMinuter, 0, 5000);
    if (traning === null || Number.isNaN(traning)) return fel('Skriv minuter fysisk träning en vanlig vecka som ett heltal, 0 om patienten inte tränar.', 'fysisk.traningMinuter');
    if (vardag === null || Number.isNaN(vardag)) return fel('Skriv minuter vardagsmotion en vanlig vecka som ett heltal.', 'fysisk.vardagMinuter');
    varde.fysisk = { traningMinuter: traning, vardagMinuter: vardag };
  }
  if (svar.mat) {
    const m = {};
    for (const q of MATFRAGOR) {
      const v = svar.mat[q.id];
      if (!q.alternativ.some(([id]) => id === String(v))) return fel(`Svara på frågan: ${q.text}`, `mat.${q.id}`);
      m[q.id] = String(v);
    }
    varde.mat = m;
  }
  if (!Object.keys(varde).length) return fel('Fyll i minst ett av områdena alkohol, fysisk aktivitet och matvanor.', 'alkohol');
  const f = forslag(varde, { alder });
  const stod = {};
  for (const [omr, fo] of Object.entries(f)) {
    const s = svar.stod?.[omr] ?? null;
    if (fo.kod) {
      if (!STOD.some(([x]) => x === s)) return fel(`Ange om stödet för ${OMRADEN[omr].namn.toLowerCase()} erbjöds och om patienten tackade ja. Socialstyrelsen följer upp hur många som får stöd.`, `stod.${omr}`);
      stod[omr] = s;
    }
  }
  const givet = {};
  for (const omr of Object.keys(f)) {
    const g = Boolean(svar.givet?.[omr]);
    if (g && stod[omr] !== 'accepterat') return fel('Ett samtal kan bara ha hållits om patienten tackade ja till stödet.', `givet.${omr}`);
    givet[omr] = g;
  }
  const kommentar = typeof svar.kommentar === 'string' ? svar.kommentar.trim() : '';
  if (kommentar.length > KOMMENTAR_MAX) return fel(`Kommentaren får vara högst ${KOMMENTAR_MAX} tecken.`, 'kommentar');
  return { ok: true, varde: { ...varde, stod, givet, kommentar } };
}

export const aktivitetsminuter = (f) => f.traningMinuter * 2 + f.vardagMinuter;
export function matpoang(m) {
  return MATFRAGOR.reduce((s, q) => s + (q.alternativ.find(([id]) => id === m[q.id])?.[2] ?? 0), 0);
}

// Risken per område: { risk, text }. Systemet räknar den, och den används i patientgrupperingen och folkhälsan.
export function risk(varde, { alder = null } = {}) {
  const ut = {};
  const ung = typeof alder === 'number' && alder < 18;
  if (varde.alkohol) {
    const a = varde.alkohol;
    const berusning = ['manad', 'vecka', 'dagligen'].includes(a.berusning);
    const r = (ung && a.glasPerVecka > 0) || a.glasPerVecka > GRANSER.glasPerVecka || berusning;
    ut.alkohol = { risk: r, text: r ? (ung && a.glasPerVecka > 0 ? 'Patienten är under 18 år och dricker alkohol.' : berusning ? 'Patienten dricker fyra standardglas eller fler vid samma tillfälle minst en gång i månaden.' : `Patienten dricker mer än ${GRANSER.glasPerVecka} standardglas en vanlig vecka.`) : 'Inget riskbruk av alkohol.' };
  }
  if (varde.fysisk) {
    const min = aktivitetsminuter(varde.fysisk);
    const r = min < GRANSER.aktivitetsminuter;
    ut.fysisk = { risk: r, varde: min, text: `${min} aktivitetsminuter en vanlig vecka (träning räknas dubbelt). ${r ? `Under ${GRANSER.aktivitetsminuter} minuter är otillräcklig fysisk aktivitet.` : 'Tillräckligt fysiskt aktiv.'}` };
  }
  if (varde.mat) {
    const p = matpoang(varde.mat);
    const r = p <= GRANSER.matpoang;
    ut.mat = { risk: r, varde: p, text: `Matvanorna ger ${p} av 12 poäng. ${r ? `${GRANSER.matpoang} poäng eller lägre räknas som ohälsosamma matvanor.` : 'Inga ohälsosamma matvanor.'}` };
  }
  return ut;
}

// Förslaget per område ur risken: { kod, atgard, motivering, demoregel }.
export function forslag(varde, { alder = null } = {}) {
  const r = risk(varde, { alder });
  const ut = {};
  const kod = (k, motivering, extra = {}) => ({ kod: k, atgard: KVA_LEVNADSVANOR[k], motivering, demoregel: true, ...extra });
  if (r.alkohol) ut.alkohol = r.alkohol.risk ? kod('DV122', 'Socialstyrelsen rekommenderar rådgivande samtal till personer med riskbruk av alkohol.') : { kod: null, motivering: 'Inget riskbruk. Inget stöd behövs.' };
  if (r.fysisk) ut.fysisk = r.fysisk.risk ? kod('DV132', 'Socialstyrelsen rekommenderar rådgivande samtal, med tillägg av stegräknare eller fysisk aktivitet på recept, till personer som är otillräckligt fysiskt aktiva.', { tillagg: 'DV200' }) : { kod: null, motivering: 'Tillräckligt fysiskt aktiv. Inget stöd behövs.' };
  if (r.mat) ut.mat = r.mat.risk ? kod('DV142', 'Socialstyrelsen rekommenderar rådgivande samtal till personer med ohälsosamma matvanor.') : { kod: null, motivering: 'Inga ohälsosamma matvanor. Inget stöd behövs.' };
  return ut;
}

const BERUSNING_TEXT = Object.fromEntries(BERUSNING.map(([k, t]) => [k, t.toLowerCase()]));
// Sökorden som anteckningen får. Systemet skriver texten ur svaren.
export function sokord(varde, { alder = null } = {}) {
  const r = risk(varde, { alder });
  const f = forslag(varde, { alder });
  const ut = [];
  if (varde.alkohol) ut.push({ sokord: 'Alkohol', text: `${varde.alkohol.glasPerVecka} standardglas en vanlig vecka. Fyra standardglas eller fler vid samma tillfälle: ${BERUSNING_TEXT[varde.alkohol.berusning]}. ${r.alkohol.text}` });
  if (varde.fysisk) ut.push({ sokord: 'Fysisk aktivitet', text: `Fysisk träning ${varde.fysisk.traningMinuter} minuter och vardagsmotion ${varde.fysisk.vardagMinuter} minuter en vanlig vecka. ${r.fysisk.text}` });
  if (varde.mat) ut.push({ sokord: 'Matvanor', text: `${MATFRAGOR.map(q => `${q.text.replace('Hur ofta äter du ', '').replace(' eller dricker läsk?', ' och läsk').replace('?', '')}: ${q.alternativ.find(([id]) => id === varde.mat[q.id])[1].toLowerCase()}`).join('. ')}. ${r.mat.text}` });
  const stod = Object.entries(f).filter(([, x]) => x.kod).map(([omr, x]) => `${x.atgard} (KVÅ ${x.kod}): ${STOD_TEXT[varde.stod[omr]]}.${varde.givet[omr] ? ' Samtalet hölls vid besöket och är registrerat som åtgärd.' : ''}`);
  if (stod.length) ut.push({ sokord: 'Stöd', text: `${stod.join(' ')} Förslaget följer Socialstyrelsens nationella riktlinjer för vård vid ohälsosamma levnadsvanor.` });
  if (varde.kommentar) ut.push({ sokord: 'Kommentar', text: varde.kommentar });
  return ut;
}

export function sammanfattning(varde, { alder = null } = {}) {
  const r = risk(varde, { alder });
  return Object.entries(r).map(([omr, x]) => `${OMRADEN[omr].namn}: ${x.risk ? OMRADEN[omr].risk.toLowerCase() : 'ingen risk'}`).join('. ') + '.';
}
