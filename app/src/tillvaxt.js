// Tillväxt för barn (Sussa 4.1, runda 7, r6): z-värden, referenslinjer, korrigerad ålder, målängd, förändring under en
// period och larm vid avvikande tillväxt. Rena funktioner utan databas. Reglerna är demoregler (D10) och inte kliniskt
// beslutsstöd. Referensen är WHO:s tillväxtstandard 0 till 5 år (seed/who-tillvaxt.js), eftersom de svenska referenserna
// inte finns utgivna under en fri licens (docs/kodkontroll.md).
import { WHO_LMS, WHO_KALLA, WHO_LICENS } from './seed/who-tillvaxt.js';

export const REFERENS = {
  namn: 'WHO:s tillväxtstandard 0 till 5 år',
  kalla: WHO_KALLA,
  licens: WHO_LICENS,
  text: 'Kurvorna visar WHO:s tillväxtstandard. Barnhälsovården i Sverige använder oftast svenska referenser, som inte finns fritt tillgängliga och därför inte används här. Kurvan för huvudomfång följer WHO, som Rikshandboken inte rekommenderar i Norden.',
};
export const DEMOREGEL = 'Demoregler, inte kliniskt beslutsstöd: larmen, gränserna och förslagen på nästa steg är påhittade för demon och inte en regions riktlinjer.';

// Måtten. who är nyckeln i WHO-tabellen, typ är mätvärdestypen i journalen. BMI räknar systemet ur vikt och längd.
export const MATT = {
  vikt: { namn: 'Vikt', enhet: 'kg', who: 'vikt', typ: 'vikt', decimaler: 3 },
  langd: { namn: 'Längd', enhet: 'cm', who: 'langd', typ: 'langd', decimaler: 1 },
  huvudomfang: { namn: 'Huvudomfång', enhet: 'cm', who: 'huvud', typ: 'huvudomfang', decimaler: 1 },
  bmi: { namn: 'BMI', enhet: 'kg/m²', who: 'bmi', typ: null, decimaler: 1, harledd: true },
};
export const SD_LINJER = [-2, -1, 0, 1, 2];
export const MAX_MANADER = 60;
const DAG = 86400_000;
const MANAD_DAGAR = 30.4375;

// Ålder i månader (med decimaler) mellan födelsedatum och en tidpunkt.
export function alderManader(fodd, tid) {
  const t0 = Date.parse(`${fodd}T00:00:00Z`);
  const t = typeof tid === 'number' ? tid : Date.parse(tid);
  return Math.max(0, (t - t0) / DAG / MANAD_DAGAR);
}

// Korrigerad ålder för ett barn som är fött före vecka 37: åldern minus de veckor som fattades till 40, till 24 månader
// (demoregel). Därefter räknas den verkliga åldern.
export const KORRIGERA_TILL_MANADER = 24;
export function korrigeradAlder(manader, gestationsvecka) {
  if (!gestationsvecka || gestationsvecka >= 37 || manader >= KORRIGERA_TILL_MANADER) return manader;
  return Math.max(0, manader - ((40 - gestationsvecka) * 7) / MANAD_DAGAR);
}

const tabell = (matt, kon) => WHO_LMS[MATT[matt].who]?.[kon === 'kvinna' ? 'K' : 'M'] ?? null;

// L, M och S för en ålder i månader, linjärt mellan hela månader. null utanför 0 till 60 månader.
export function lms(matt, kon, manader) {
  const t = tabell(matt, kon);
  if (!t || !(manader >= 0) || manader > MAX_MANADER) return null;
  const a = Math.floor(manader);
  const b = Math.min(MAX_MANADER, a + 1);
  const f = manader - a;
  const [L1, M1, S1] = t[a];
  const [L2, M2, S2] = t[b];
  return [L1 + (L2 - L1) * f, M1 + (M2 - M1) * f, S1 + (S2 - S1) * f];
}

export const vardeVidZ = ([L, M, S], z) => (L === 0 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L));

// z-värde enligt WHO. För vikt och BMI har WHO en begränsad metod utanför 3 SD, så att svansarna inte töjs ut.
export function zVarde(matt, kon, manader, x) {
  const p = lms(matt, kon, manader);
  if (!p || !(x > 0)) return null;
  const [L, M, S] = p;
  const z = L === 0 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S);
  if (!['vikt', 'bmi'].includes(matt) || Math.abs(z) <= 3) return z;
  const sd3 = vardeVidZ(p, Math.sign(z) * 3);
  const sd2 = vardeVidZ(p, Math.sign(z) * 2);
  const steg = Math.abs(sd3 - sd2);
  return Math.sign(z) * (3 + Math.abs(x - sd3) / steg);
}

// Percentil ur z-värdet (normalfördelningen), avrundad till en hel percentil mellan 1 och 99.
export function percentil(z) {
  if (z == null) return null;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const andel = z > 0 ? 1 - p : p;
  return Math.min(99, Math.max(1, Math.round(andel * 100)));
}

// Referenslinjerna -2, -1, 0, +1 och +2 SD per halv månad mellan två åldrar.
export function referenslinjer(matt, kon, fran = 0, till = MAX_MANADER) {
  const a = Math.max(0, Math.floor(fran));
  const b = Math.min(MAX_MANADER, Math.ceil(till));
  return SD_LINJER.map(sd => {
    const punkter = [];
    for (let m = a; m <= b + 1e-9; m += b - a > 24 ? 1 : 0.5) {
      const p = lms(matt, kon, m);
      if (p) punkter.push([m, Math.round(vardeVidZ(p, sd) * 1000) / 1000]);
    }
    return { sd, punkter };
  });
}

// Målängd ur föräldrarnas längd (Tanner, Goldstein och Whitehouse 1970): medelvärdet av föräldrarnas längd plus 6,5 cm
// för en pojke och minus 6,5 cm för en flicka, med ett spann på 8,5 cm åt båda hållen (demoregel).
export const MALANGD_SPANN = 8.5;
export function malangd(mor, far, kon) {
  if (!(mor > 0) || !(far > 0)) return null;
  const v = (mor + far) / 2 + (kon === 'kvinna' ? -6.5 : 6.5);
  return { varde: Math.round(v * 10) / 10, fran: Math.round((v - MALANGD_SPANN) * 10) / 10, till: Math.round((v + MALANGD_SPANN) * 10) / 10,
    text: `Målängden är ${tal(v)} cm (${tal(v - MALANGD_SPANN)} till ${tal(v + MALANGD_SPANN)} cm), räknat ur föräldrarnas längd ${tal(mor, 0)} och ${tal(far, 0)} cm.` };
}

export const tal = (v, d = 1) => (v == null ? '' : Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }));
const sdText = (z) => { const r = Math.round(z * 10) / 10; return `${r > 0 ? '+' : r < 0 ? 'minus ' : ''}${tal(Math.abs(r))} SD`; };
export const zText = (z) => (z == null ? '' : sdText(z));
const manadText = (m) => {
  const hela = Math.round(m);
  if (hela < 1) return `${Math.max(0, Math.round(m * MANAD_DAGAR / 7))} veckor`;
  if (hela < 24) return `${hela} ${hela === 1 ? 'månad' : 'månader'}`;
  const ar = Math.floor(m / 12);
  const man = Math.round(m - ar * 12);
  return man ? `${ar} år och ${man} ${man === 1 ? 'månad' : 'månader'}` : `${ar} år`;
};
export const alderText = manadText;

// BMI ur vikt och längd som är mätta samma dag.
export function bmiPunkter(vikter, langder) {
  const ut = [];
  for (const v of vikter) {
    const l = langder.find(x => x.tid.slice(0, 10) === v.tid.slice(0, 10));
    if (l && l.varde > 0) ut.push({ tid: v.tid, varde: Math.round((v.varde / (l.varde / 100) ** 2) * 10) / 10, kalla: v.kalla, harledd: true });
  }
  return ut;
}

// Punkterna för ett mått med ålder, korrigerad ålder, z-värde och percentil. punkter: [{ tid, varde, ... }].
export function berika(matt, kon, fodd, gestationsvecka, punkter) {
  return [...punkter].sort((a, b) => a.tid.localeCompare(b.tid)).map(p => {
    const verklig = alderManader(fodd, p.tid);
    const alder = korrigeradAlder(verklig, gestationsvecka);
    const z = zVarde(matt, kon, alder, p.varde);
    return { ...p, alder: Math.round(alder * 1000) / 1000, verkligAlder: Math.round(verklig * 1000) / 1000, z: z == null ? null : Math.round(z * 100) / 100, percentil: percentil(z) };
  });
}

// Förändring under en period för varje mått: första och sista värdet, skillnaden, skillnaden per månad och ändringen
// i z-värde. fran och till är ISO-datum.
export function analys(kurvor, { fran = null, till = null } = {}) {
  return Object.entries(kurvor).map(([matt, punkter]) => {
    const inom = punkter.filter(p => !p.vantar && (!fran || p.tid.slice(0, 10) >= fran) && (!till || p.tid.slice(0, 10) <= till));
    if (inom.length < 2) return { matt, namn: MATT[matt].namn, antal: inom.length, text: inom.length ? 'Ett värde under perioden. Det behövs två för att räkna förändringen.' : 'Inga värden under perioden.' };
    const a = inom[0], b = inom.at(-1);
    const manader = b.verkligAlder - a.verkligAlder;
    const skillnad = b.varde - a.varde;
    const perManad = manader > 0 ? skillnad / manader : null;
    const dz = a.z != null && b.z != null ? b.z - a.z : null;
    const e = MATT[matt].enhet;
    const d = matt === 'vikt' || matt === 'bmi' ? 2 : 1;
    return {
      matt, namn: MATT[matt].namn, antal: inom.length, fran: a.tid, till: b.tid, skillnad: Math.round(skillnad * 1000) / 1000,
      perManad: perManad == null ? null : Math.round(perManad * 1000) / 1000, zFran: a.z, zTill: b.z, zAndring: dz == null ? null : Math.round(dz * 100) / 100,
      text: `${MATT[matt].namn} ${skillnad >= 0 ? 'ökade' : 'minskade'} ${tal(Math.abs(skillnad), d)} ${e} på ${manadText(manader)}${perManad != null ? `, ${tal(perManad, d)} ${e} per månad` : ''}.${dz != null ? ` Från ${zText(a.z)} till ${zText(b.z)}.` : ''}`,
    };
  });
}

// Larm vid avvikande tillväxt (demoregler). kurvor: { vikt: [...], langd: [...], huvudomfang: [...], bmi: [...] } med
// punkter från berika. Bara bekräftade värden räknas (inte hemmätningar som väntar). fodelsevikt i kg om den finns.
export const KORSA_SD = 1;
export const UTANFOR_SD = 2;
const NASTA = {
  vikt_ned: 'Väg barnet igen inom två veckor och fråga om mat, amning eller ersättning, sömn och om barnet har varit sjukt. Fortsätter vikten nedåt ska barnet bedömas av BVC-läkaren.',
  vikt_upp: 'Prata med familjen om mat, dryck och rörelse och väg igen vid nästa besök. Korsar vikten fler kurvor uppåt bör BVC-läkaren bedöma barnet.',
  bmi_upp: 'Prata med familjen om mat, dryck och rörelse och följ BMI vid nästa besök.',
  langd_ned: 'Mät om längden noga, liggande före två års ålder. Ligger längden fortfarande lägre vid nästa mätning ska barnet bedömas av BVC-läkaren.',
  huvud_upp: 'Ett huvudomfång som växer snabbare än väntat ska bedömas av läkare inom en vecka. Mät om och boka tid hos BVC-läkaren.',
  huvud_ned: 'Mät om huvudomfånget. Är det fortfarande lägre ska barnet bedömas av BVC-läkaren.',
  utanfor: 'Kontrollera att mätningen är rätt och låt BVC-läkaren bedöma tillväxten.',
  nyfodd: 'Ge amningsstöd och väg barnet igen inom två dagar. Äter barnet dåligt eller är slött ska familjen få kontakt med läkare samma dag.',
};
export function larm(kurvor, { fodelsevikt = null } = {}) {
  const ut = [];
  const bekraftade = (m) => (kurvor[m] ?? []).filter(p => !p.vantar && p.z != null);
  for (const [matt, ned, upp] of [['vikt', 'vikt_ned', 'vikt_upp'], ['langd', 'langd_ned', null], ['huvudomfang', 'huvud_ned', 'huvud_upp'], ['bmi', null, 'bmi_upp']]) {
    const p = bekraftade(matt);
    const sista = p.at(-1);
    if (!sista) continue;
    // Korsar kurvor: z-värdet har ändrats minst 1 SD jämfört med ett värde 1 till 12 månader tidigare. Vikten räknas från
    // sex veckors ålder, eftersom nyfödda först går ned i vikt.
    const tidigare = p.filter(q => sista.verkligAlder - q.verkligAlder >= 1 && sista.verkligAlder - q.verkligAlder <= 12 && (matt !== 'vikt' || q.verkligAlder >= 1.4));
    const jmf = tidigare.length ? tidigare.reduce((a, b) => (Math.abs(sista.z - b.z) > Math.abs(sista.z - a.z) ? b : a)) : null;
    if (jmf) {
      const dz = sista.z - jmf.z;
      if (ned && dz <= -KORSA_SD) ut.push({ regel: 'korsar_nedat', matt, allvar: 'varning', tid: sista.tid,
        rubrik: `${MATT[matt].namn} korsar kurvor nedåt`, text: `${MATT[matt].namn} har gått från ${zText(jmf.z)} till ${zText(sista.z)} på ${manadText(sista.verkligAlder - jmf.verkligAlder)}.`, nastaSteg: NASTA[ned], atgard: 'lakarbesok' });
      if (upp && dz >= KORSA_SD) ut.push({ regel: 'korsar_uppat', matt, allvar: matt === 'huvudomfang' ? 'hog' : 'info', tid: sista.tid,
        rubrik: matt === 'huvudomfang' ? 'Huvudomfånget växer för snabbt' : `${MATT[matt].namn} korsar kurvor uppåt`, text: `${MATT[matt].namn} har gått från ${zText(jmf.z)} till ${zText(sista.z)} på ${manadText(sista.verkligAlder - jmf.verkligAlder)}.`, nastaSteg: NASTA[upp], atgard: matt === 'huvudomfang' ? 'lakarbesok' : null });
    }
    // Utanför två standardavvikelser i det senaste värdet.
    const lagt = sista.z < -UTANFOR_SD && matt !== 'bmi';
    const hogt = sista.z > UTANFOR_SD && matt !== 'vikt';
    if (lagt || hogt) {
      ut.push({ regel: 'utanfor', matt, allvar: 'varning', tid: sista.tid,
        rubrik: `${MATT[matt].namn} ${lagt ? 'under' : 'över'} två standardavvikelser`,
        text: matt === 'bmi' ? `BMI ${tal(sista.varde)} är ${zText(sista.z)}. WHO räknar det som övervikt.` : `${MATT[matt].namn} ${tal(sista.varde, MATT[matt].decimaler === 3 ? 2 : 1)} ${MATT[matt].enhet} är ${zText(sista.z)}.`,
        nastaSteg: matt === 'bmi' ? NASTA.bmi_upp : NASTA.utanfor, atgard: matt === 'bmi' ? null : 'lakarbesok' });
    }
  }
  // Nyfödd: mer än 10 procent under födelsevikten de första två veckorna, eller inte tillbaka på födelsevikten vid två
  // till fyra veckor.
  const v = bekraftade('vikt').filter(p => p.verkligAlder < 1);
  const sistaV = v.at(-1);
  if (fodelsevikt && sistaV) {
    const dagar = sistaV.verkligAlder * MANAD_DAGAR;
    const andel = sistaV.varde / fodelsevikt;
    if ((dagar < 14 && andel < 0.9) || (dagar >= 14 && andel < 1)) {
      ut.push({ regel: 'nyfodd', matt: 'vikt', allvar: 'hog', tid: sistaV.tid, rubrik: dagar < 14 ? 'Mer än 10 procent under födelsevikten' : 'Inte tillbaka på födelsevikten',
        text: `Vikten ${tal(sistaV.varde, 3)} kg är ${tal((1 - andel) * 100, 0)} procent under födelsevikten ${tal(fodelsevikt, 3)} kg vid ${Math.round(dagar)} dagars ålder.`,
        nastaSteg: NASTA.nyfodd, atgard: 'lakarbesok' });
    }
  }
  const ordning = { hog: 0, varning: 1, info: 2 };
  return ut.sort((a, b) => ordning[a.allvar] - ordning[b.allvar]).map(l => ({ ...l, demoregel: DEMOREGEL }));
}
