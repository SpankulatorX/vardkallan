// Runda 11, r7: API för intensivvården (realtid, patientens egna regler, vätskebalansens mål och prognos, andningsstöd,
// vårdtyngd enligt NEMS, sammanräkning av doser och överrapportering) och för tillväxten. All behörighet prövas i
// behörighetsmotorn och varje åtkomst till patientuppgifter loggas.
import { Fel, datumAv } from './db.js';
import { Atkomst, kanRoll } from './atkomst.js';
import * as iva from './iva.js';
import * as regler from './iva-patientregler.js';
import * as vagform from './iva-vagform.js';
import * as vatska from './iva-vatskemal.js';
import * as nems from './iva-nems.js';
import * as lakemedelsvyer from './lakemedelsvyer.js';

// Krokarna i iva.js: patientens regler i analysen, och behandlingsbegränsningar och NEMS på raderna i översikten.
iva.KROKAR.analys.push(regler.analysFor);
iva.KROKAR.rad.push((atk, rad, { nu }) => {
  const b = regler.behandlingsbegransningar(atk);
  const n = nems.registreringar(atk).find(x => x.dygn === nems.dygnFor(nu)) ?? null;
  return { ...rad, behandlingsbegransningar: b.map(x => x.term), nems: n ? { poang: n.poang, dygn: n.dygn } : null, egnaRegler: regler.reglerFor(atk).length };
});

const TIMME = 3600_000;
// Sammanräkningen av givna doser för en kontinuerlig infusion: dosen per timme gånger tiden för varje dos sedan starten
// (ur titreringarna), det senaste dygnet och sedan starten, och mot den högsta dygnsdosen.
export function sammanrakning(db, infusioner, nu = new Date()) {
  return infusioner.map(inf => {
    const i = db.query('SELECT * FROM iva_infusioner WHERE ordination_id = ?').get(inf.ordinationId);
    const o = db.query('SELECT utsatt_tid FROM ordinationer WHERE id = ?').get(inf.ordinationId);
    if (!i) return null;
    const slut = Math.min(nu.getTime(), o?.utsatt_tid ? Date.parse(o.utsatt_tid) : Infinity);
    const steg = [{ tid: Date.parse(i.skapad), dos: i.startdos }, ...db.query('SELECT tid, dos FROM iva_titreringar WHERE ordination_id = ? ORDER BY tid, id').all(i.ordination_id).map(t => ({ tid: Date.parse(t.tid), dos: t.dos }))];
    const fran24 = nu.getTime() - 24 * TIMME;
    let totalt = 0, dygn = 0;
    steg.forEach((s, k) => {
      const a = s.tid, b = Math.min(slut, steg[k + 1]?.tid ?? slut);
      if (b <= a) return;
      const perTimme = s.dos * i.vikt_kg;
      totalt += perTimme * (b - a) / TIMME;
      dygn += perTimme * Math.max(0, b - Math.max(a, fran24)) / TIMME;
    });
    const enhet = i.konc_enhet.split('/')[0];
    const bolus = db.query("SELECT coalesce(sum(dos), 0) AS s FROM mt_pumphandelser WHERE ordination_id = ? AND typ = 'bolus' AND till > ?").get(i.ordination_id, new Date(fran24).toISOString())?.s ?? 0;
    const sumDygn = Math.round((dygn + bolus) * 100) / 100;
    const text = `${inf.lakemedel}: ${String(sumDygn).replace('.', ',')} ${enhet} det senaste dygnet${bolus ? `, varav bolus ${String(Math.round(bolus * 100) / 100).replace('.', ',')} ${enhet}` : ''}, ${String(Math.round(totalt * 100) / 100).replace('.', ',')} ${enhet} sedan starten.`;
    const over = i.max_dygn != null && sumDygn > i.max_dygn;
    return { ordinationId: i.ordination_id, lakemedel: inf.lakemedel, enhet, senasteDygnet: sumDygn, bolus: Math.round(bolus * 100) / 100, sedanStart: Math.round(totalt * 100) / 100, maxDygn: i.max_dygn,
      text: over ? `${text} Det är över den högsta dygnsdosen ${i.max_dygn} ${enhet}. Kontakta ansvarig läkare.` : text, over };
  }).filter(Boolean);
}

// Energin som patienten har fått sedan dygnsbrytningen kl. 06, ur vätskebalansens kalorier, eller null.
function kcalSedanBrytning(atk, nu) {
  try {
    const br = vatska.dygnsbrytning(nu);
    const dag = new Date(br.senaste).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    return lakemedelsvyer.vatskebalans(new Atkomst(atk.db, atk.personal, atk.patientId, atk.val, 'las_matvarden'), { dag, brytning: '06' }).kcalIn ?? null;
  } catch { return null; }
}

// Det som intensivvården visar utöver övervakningen för en patient.
export function tillagg(atk, p, nu = new Date()) {
  atk.krav('las_matvarden');
  const db = atk.db;
  const ov = iva.overvakning(atk, p, { timmar: 6 }, nu);
  const pr = regler.reglerFor(atk);
  const stod = vatska.andningsstodFor(atk);
  const v = vatska.utokad(atk, { nu, infusioner: ov.infusioner, kcal: kcalSedanBrytning(atk, nu) });
  const n = nems.vy(atk, nu, stod);
  const b = regler.behandlingsbegransningar(atk);
  const kan = (h) => kanRoll(atk.personal, h) && atk.prova(h).tillaten && atk.prova(h).grund !== 'nodatkomst';
  return {
    regler: pr, parametrar: Object.entries(regler.PARAMETRAR).map(([id, d]) => ({ id, namn: d.namn, enhet: d.enhet, min: d.min, max: d.max, standard: { under: regler.standardGrans(id, 'under', ov.parametrar), over: regler.standardGrans(id, 'over', ov.parametrar) } })),
    begransningar: b, vatska: v, nems: n, sammanrakning: sammanrakning(db, ov.infusioner, nu),
    overrapportering: regler.overrapportering(atk, ov, { begransningar: b, regler: pr, vatska: v, nems: n }),
    andningsstodTyper: vatska.ANDNINGSSTOD, befuktningar: Object.fromEntries(Object.entries(vatska.BEFUKTNING).map(([k, [t]]) => [k, t])), malTyper: vatska.MAL,
    kan: { regler: kan('ordinera'), mal: kan('ordinera'), andningsstod: kan('registrera_matvarde'), nems: n.kan && kan('registrera_matvarde') },
    demoregel: [regler.DEMOREGEL, vatska.DEMOREGEL, nems.DEMOREGEL].join(' '),
  };
}

export function registreraRutter({ rutt, kravInloggad, medPatient }) {
  // Realtidsvisningen hämtas var tredje sekund medan vyn är öppen. Åtkomsten loggas en gång per session och patient, så
  // att vyn inte fyller loggen.
  rutt('GET', '/api/patient/:id/iva/realtid', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_matvarden', (atk) => {
      const ut = vagform.realtid(atk);
      const loggade = (c.s.ivaLoggad ??= new Set());
      const nyckel = `iva:realtid:${atk.patientId}`;
      if (loggade.has(nyckel)) atk.loggad = true;
      else { loggade.add(nyckel); atk.logga('las_matvarden', atk.grund(), nyckel); }
      return ut;
    });
  });
  rutt('GET', '/api/patient/:id/iva/tillagg', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_matvarden', (atk, p) => tillagg(atk, p)); });
  rutt('POST', '/api/patient/:id/iva/regler', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk, p) => regler.sparaRegel(atk, p, c.body))]; });
  rutt('POST', '/api/patient/:id/iva/regler/:rid/avsluta', (c, id, rid) => { kravInloggad(c); return medPatient(c, id, 'ordinera', (atk) => regler.avslutaRegel(atk, rid, c.body)); });
  rutt('POST', '/api/patient/:id/iva/andningsstod', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'registrera_matvarde', (atk) => vatska.registreraStod(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/iva/andningsstod/avsluta', (c, id) => { kravInloggad(c); return medPatient(c, id, 'registrera_matvarde', (atk) => vatska.avslutaStod(atk)); });
  rutt('POST', '/api/patient/:id/iva/mal', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => vatska.sattMal(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/iva/nems', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'registrera_matvarde', (atk) => nems.registrera(atk, c.body, new Date(), vatska.andningsstodFor(atk)))];
  });
}

export { Fel, datumAv };
