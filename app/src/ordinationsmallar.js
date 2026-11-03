// Fördefinierade ordinationer (Sussa 3.5.1.3) och ordination kopplad till en planerad vårdhändelse (3.5.2.7).
// Systemet föreslår dos, administrationssätt, tider, typ och uppföljning ur produkten och patienten, så att förskrivaren
// bara ändrar det som avviker. Förslagen är demoregler, inte doseringsstöd, och märks så.
//
// Ordinationens tillägg (administrationssätt, mallen den kom från, volym för vätskebalansen och vårdhändelsen) sparas
// i ordination_tillagg, så att ordinationstabellen och NLL-överföringen är oförändrade.
import { Fel, iso, idag, addDagar } from './db.js';
import { alder as alderAv } from './atkomst.js';

export const DEMO_MALLAR = 'Förslagen är demoregler för att visa flödet. De är inte doseringsstöd och inte granskade av farmaceut eller läkare.';
export const ADMINISTRATIONSSATT = {
  peroralt: 'Peroralt', subkutant: 'Subkutant', intravenost: 'Intravenöst', inhalation: 'Inhalation', sublingualt: 'Under tungan', intramuskulart: 'Intramuskulärt',
};

// Administrationssättet ur läkemedelsformen i NPL.
export function administrationssatt(form = '') {
  if (/sublingual/i.test(form)) return 'sublingualt';
  if (/inhalation/i.test(form)) return 'inhalation';
  if (/infusion/i.test(form) || /pulver till injektion/i.test(form)) return 'intravenost';
  if (/injektionspenna|förfylld spruta/i.test(form)) return 'subkutant';
  if (/injektion/i.test(form)) return 'intravenost';
  return 'peroralt';
}

// Mallar per substans (ATC). dos i produktens enhet, tider som klockslag, uppfoljning i dagar, volym i ml per dos för
// vätskebalansen när läkemedlet ges i en infusion. Patienten kan ändra förslaget: aldre gäller från 75 år, egfr under 30.
const MALLAR = {
  N02BE01: { namn: 'Paracetamol vid behov', dosering: '1 till 2 tabletter vid behov, högst 8 tabletter per dygn', dos: 500, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 7,
    aldre: { dosering: '1 till 2 tabletter vid behov, högst 6 tabletter per dygn', varfor: 'Från 75 år föreslås högst 3 gram paracetamol per dygn.' } },
  A02BC01: { namn: 'Omeprazol 20 mg', dosering: '1 kapsel på morgonen', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 14 },
  C07AB02: { namn: 'Metoprolol depot', dosering: '1 tablett på morgonen', dos: 50, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 14 },
  C03CA01: { namn: 'Furosemid', dosering: '1 tablett på morgonen', dos: 40, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 3 },
  B01AB04: { namn: 'Tromboprofylax med dalteparin', dosering: '1 injektion subkutant kl 18', dos: 5000, dosEnhet: 'IE', tider: ['18'], typ: 'tillfallig', uppfoljning: 7,
    egfr: { dosering: '1 injektion subkutant kl 18. Kontrollera anti-Xa vid nedsatt njurfunktion', varfor: 'eGFR under 30: dalteparin kan ansamlas, och anti-Xa bör kontrolleras.' } },
  B01AB05: { namn: 'Tromboprofylax med enoxaparin', dosering: '1 injektion subkutant kl 18', dos: 40, dosEnhet: 'mg', tider: ['18'], typ: 'tillfallig', uppfoljning: 7,
    egfr: { dosering: '20 mg subkutant kl 18', dos: 20, varfor: 'eGFR under 30: dosen av enoxaparin föreslås halverad.' } },
  J01CE01: { namn: 'Bensylpenicillin intravenöst', dosering: '3 g intravenöst 3 gånger per dygn, löst i 100 ml natriumklorid', dos: 3, dosEnhet: 'g', tider: ['06', '14', '22'], typ: 'tillfallig', uppfoljning: 3, volym: 100 },
  N02AA01: { namn: 'Morfin intravenöst vid behov', dosering: '2,5 till 5 mg intravenöst vid behov, minst 4 timmar mellan doserna', dos: 2.5, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 3,
    aldre: { dosering: '1 till 2,5 mg intravenöst vid behov, minst 4 timmar mellan doserna', dos: 1, varfor: 'Från 75 år föreslås en lägre startdos av morfin.' } },
  J01CA04: { namn: 'Amoxicillin', dosering: '1 tablett 3 gånger dagligen', dos: 750, dosEnhet: 'mg', tider: ['08', '14', '20'], typ: 'tillfallig', uppfoljning: 7 },
  A10BA02: { namn: 'Metformin', dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', uppfoljning: 30 },
  C10AA05: { namn: 'Atorvastatin', dosering: '1 tablett till kvällen', dos: 40, dosEnhet: 'mg', tider: ['20'], typ: 'staende', uppfoljning: 60 },
  B01AC06: { namn: 'Acetylsalicylsyra 75 mg', dosering: '1 tablett på morgonen', dos: 75, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 30 },
  N05CF01: { namn: 'Zopiklon vid behov', dosering: '1 tablett till natten vid behov', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 14,
    aldre: { dosering: 'En halv tablett till natten vid behov', dos: 2.5, varfor: 'Från 75 år föreslås halv dos zopiklon, och sömnmedel ökar risken för fall.' } },
};

// Grundförslag ur produkten när det inte finns en mall: en dos om dagen på morgonen, med styrkan som dos.
function grund(lm) {
  const m = /^([\d,]+)\s*(\S+)/.exec(lm.styrka ?? '');
  return { namn: null, dosering: '', dos: m ? Number(m[1].replace(',', '.')) : null, dosEnhet: m ? m[2] : null, tider: [], typ: 'staende', uppfoljning: 30 };
}

// Förslaget för produkten och patienten. Varje ändring mot mallen förklaras i varfor.
export function forslag(db, lm, patientId) {
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(patientId);
  const ar = p ? alderAv(p.fodd, idag()) : null;
  const egfr = db.query("SELECT varde_num FROM matvarden WHERE patient_id = ? AND typ = 'egfr' ORDER BY tid DESC").get(patientId)?.varde_num ?? null;
  const mall = MALLAR[lm.atc];
  const f = { ...(mall ?? grund(lm)) };
  const varfor = [];
  if (mall) varfor.push(`Mallen ${mall.namn}.`);
  if (mall?.aldre && ar != null && ar >= 75) { Object.assign(f, mall.aldre); varfor.push(mall.aldre.varfor); }
  if (mall?.egfr && egfr != null && egfr < 30) { Object.assign(f, mall.egfr); varfor.push(mall.egfr.varfor); }
  const satt = administrationssatt(lm.form);
  return {
    mall: mall ? lm.atc : null, mallnamn: mall?.namn ?? null, dosering: f.dosering, dos: f.dos ?? null, dosEnhet: f.dosEnhet ?? null, tider: f.tider ?? [], typ: f.typ,
    vidBehov: f.typ === 'vid_behov', administrationssatt: satt, administrationssattText: ADMINISTRATIONSSATT[satt],
    uppfoljningsdatum: addDagar(idag(), f.uppfoljning ?? 30), volymMl: f.volym ?? null, vatskebalans: Boolean(f.volym), varfor, demoregler: true, anmarkning: DEMO_MALLAR,
  };
}

// Tillägget till en ordination, valideras innan ordinationen sparas så att ett fel inte lämnar en halv ordination.
//   administrationssatt  ett av ADMINISTRATIONSSATT, annars förslaget ur produktens form
//   vardhandelse         { text, forskjutningTimmar } för en planerad men inte tidsatt vårdhändelse (3.5.2.7)
//   volymMl, vatskebalans  volym per dos som räknas in i vätskebalansen (3.5.2.21)
export function valideraTillagg(db, inp = {}) {
  const lm = typeof inp.lakemedelId === 'string' ? db.query('SELECT * FROM katalog WHERE id = ?').get(inp.lakemedelId) : null;
  const falt = [];
  const satt = inp.administrationssatt ?? (lm ? administrationssatt(lm.form) : null);
  if (satt != null && !Object.hasOwn(ADMINISTRATIONSSATT, satt)) falt.push('administrationssatt');
  let handelse = null;
  if (inp.vardhandelse != null) {
    const text = typeof inp.vardhandelse.text === 'string' ? inp.vardhandelse.text.trim().slice(0, 120) : '';
    const h = Number(inp.vardhandelse.forskjutningTimmar ?? 0);
    if (text.length < 3 || !Number.isFinite(h) || h < -72 || h > 72) falt.push('vardhandelse');
    else handelse = { text, forskjutningMin: Math.round(h * 60) };
  }
  const volym = inp.volymMl == null || inp.volymMl === '' ? null : Number(inp.volymMl);
  if (volym != null && (!Number.isFinite(volym) || volym <= 0 || volym > 5000)) falt.push('volymMl');
  if (handelse && Array.isArray(inp.tider) && inp.tider.length) falt.push('tider');
  if (falt.length) {
    throw new Fel(400, falt.includes('tider') ? 'En ordination till en vårdhändelse som inte är tidsatt får inga fasta tider. Tiden räknas fram när vårdhändelsen får sin tid.'
      : `Kontrollera ${falt.map(f => ({ administrationssatt: 'administrationssätt', vardhandelse: 'vårdhändelsen (minst tre tecken, högst 72 timmar före eller efter)', volymMl: 'volymen' }[f])).join(', ')}.`, 'ogiltig', { falt });
  }
  return { administrationssatt: satt, mall: typeof inp.mall === 'string' ? inp.mall.slice(0, 20) : null, volymMl: volym, vatskebalans: inp.vatskebalans === false ? false : volym != null, vardhandelse: handelse };
}

export function sparaTillagg(db, ordinationId, t) {
  db.query(`INSERT INTO ordination_tillagg (ordination_id, administrationssatt, mall, volym_ml, vatskebalans, vardhandelse, forskjutning_min) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (ordination_id) DO NOTHING`).run(ordinationId, t.administrationssatt, t.mall, t.volymMl, t.vatskebalans ? 1 : 0, t.vardhandelse?.text ?? null, t.vardhandelse?.forskjutningMin ?? null);
}

const personNamn = (db, id) => (id ? db.query('SELECT namn FROM personal WHERE id = ?').get(id)?.namn ?? id : null);
// Tillägget för läkemedelslistan, FHIR och administreringslistan. Tom när ordinationen saknar tillägg.
export function tillaggUt(db, ordinationId) {
  const t = db.query('SELECT * FROM ordination_tillagg WHERE ordination_id = ?').get(ordinationId);
  if (!t) return {};
  const ut = {};
  if (t.administrationssatt) Object.assign(ut, { administrationssatt: t.administrationssatt, administrationssattText: ADMINISTRATIONSSATT[t.administrationssatt] ?? t.administrationssatt });
  if (t.volym_ml) Object.assign(ut, { volymMl: t.volym_ml, vatskebalans: Boolean(t.vatskebalans) });
  if (t.vardhandelse) {
    ut.vardhandelse = {
      text: t.vardhandelse, forskjutningMin: t.forskjutning_min ?? 0, tid: t.handelse_tid ?? null,
      administreras: t.handelse_tid ? new Date(Date.parse(t.handelse_tid) + (t.forskjutning_min ?? 0) * 60_000).toISOString() : null,
      sattAv: personNamn(db, t.handelse_satt_av), satt: t.handelse_satt ?? null,
    };
  }
  return ut;
}

// Vårdhändelsen får sin tid (3.5.2.14: administrationstiden anpassas när vårdhändelsen tidsätts).
export function tidsattHandelse(db, ordinationId, tid, personalId) {
  const t = db.query('SELECT * FROM ordination_tillagg WHERE ordination_id = ?').get(ordinationId);
  if (!t?.vardhandelse) throw new Fel(400, 'Ordinationen är inte kopplad till en planerad vårdhändelse.', 'ogiltig');
  const ms = typeof tid === 'string' ? Date.parse(tid) : NaN;
  if (!Number.isFinite(ms) || ms < Date.now() - 86400_000 || ms > Date.now() + 60 * 86400_000) {
    throw new Fel(400, 'Ange när vårdhändelsen blir av, från i går och högst 60 dagar fram.', 'ogiltig', { falt: ['tid'] });
  }
  db.query('UPDATE ordination_tillagg SET handelse_tid = ?, handelse_satt_av = ?, handelse_satt = ? WHERE ordination_id = ?').run(new Date(ms).toISOString(), personalId, iso(), ordinationId);
  return tillaggUt(db, ordinationId);
}
