// Runda 14, r2: HSA-katalogen (Sussa 2.2.1.1), PU-tjänsten (2.2.1.2) och engagemangsindex (2.2.1.10) med
// tjänstekontrakten i RIVTA. Vårdkällan är konsument. Tjänsterna är simulerade i demon (nationella.js) och svarar med
// demons påhittade HSA-uppgifter och Skatteverkets testpersonnummer. Systemet är experten: det hämtar uppgifterna
// själv, jämför dem med sina egna och säger på vanlig svenska vad som skiljer sig, utan att någon behöver kunna
// kontrakten.
//   GetEmployeeIncludingProtectedPerson 4.0   personalens uppgifter i HSA, jämförda med personalkatalogen
//   LookupResidentForFullProfile 1.2           patientens folkbokföring, jämförd med patientens uppgifter
//   Update 1.0                                 engagemangsindex: att patienten har uppgifter hos Vårdkällans vårdenheter
import { randomUUID } from 'node:crypto';
import { kontrakt } from './kontrakt.js';
import { tjanst, anropa as anropaSim, NATIONELL } from './nationella.js';
import { vardgivare } from './konsumenter.js';
import { hittaPaToken, gallandeId } from '../identitet.js';
import { vardenhetFor, kanRoll } from '../atkomst.js';
import { Fel } from '../db.js';

export const HSA = kontrakt('riv.infrastructure.directory.employee', 'GetEmployeeIncludingProtectedPerson', '4.0');
export const PU = kontrakt('riv.population.residentmaster', 'LookupResidentForFullProfile', '1.2');
export const EI = kontrakt('riv.itintegration.engagementindex', 'Update', '1.0');
// Kontrakten måste finnas bland de kontrakt som nationella.anropa känner till.
const K = { GetEmployeeIncludingProtectedPerson: HSA, LookupResidentForFullProfile: PU, Update: EI };
const anropa = (db, namn, begaran) => {
  const { anropaSynk } = require('./klient.js');
  const { transport } = require('./nationella.js');
  return anropaSynk(K[namn], { logiskAdress: NATIONELL, begaran, transport: transport(db), db });
};
void anropaSim;

// ---------------------------------------------------------------------------------------------------------------
// De simulerade katalogerna har en egen kopia av uppgifterna, tagen första gången de används i sandlådan, så att en
// ändring i Vårdkällan syns som en skillnad mot katalogen, som den skulle göra mot de riktiga tjänsterna.
function sakraKopior(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS rivta_sim_hsa (hsa_id TEXT PRIMARY KEY, namn TEXT NOT NULL, titel TEXT, dn TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rivta_sim_pu (patient_id TEXT PRIMARY KEY, personnummer TEXT NOT NULL, fornamn TEXT, efternamn TEXT, kon TEXT, fodd TEXT,
      adress TEXT, postnr TEXT, ort TEXT, skyddad INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rivta_sim_status (nyckel TEXT PRIMARY KEY, varde TEXT);`);
  if (db.query("SELECT 1 FROM rivta_sim_status WHERE nyckel = 'kataloger'").get()) return;
  const h = db.query('INSERT OR IGNORE INTO rivta_sim_hsa (hsa_id, namn, titel, dn) VALUES (?, ?, ?, ?)');
  for (const p of db.query("SELECT * FROM personal WHERE yrke <> 'systemkonto'").all()) h.run(p.hsa_id, p.namn, p.titel ?? null, dn(db, p));
  const u = db.query('INSERT OR IGNORE INTO rivta_sim_pu (patient_id, personnummer, fornamn, efternamn, kon, fodd, adress, postnr, ort, skyddad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const p of db.query("SELECT * FROM patienter WHERE id_typ = 'personnummer'").all()) u.run(p.id, p.personnummer, p.fornamn, p.efternamn, p.kon, p.fodd, p.adress, p.postnr, p.ort, p.skyddad ? 1 : 0);
  db.query("INSERT INTO rivta_sim_status (nyckel, varde) VALUES ('kataloger', ?)").run(new Date().toISOString());
}

// ---------------------------------------------------------------------------------------------------------------
// Den simulerade HSA-katalogen: demons personal och vårdenheter, märkta som påhittade (feignedPerson).
const dn = (db, p) => {
  const e = db.query('SELECT namn FROM enheter WHERE id = ?').get(vardenhetFor(db, p.enhet_id))?.namn ?? 'Okänd';
  const rena = (t) => String(t).replace(/[^0-9\p{L} \-.]/gu, '');
  return `cn=${rena(p.namn)},ou=${rena(e)},o=Vardkallan demo,l=Orebro,c=SE`;
};
tjanst.registrera(HSA, ({ db }, { begaran }) => {
  sakraKopior(db);
  const p = begaran.personHsaId ? db.query('SELECT * FROM rivta_sim_hsa WHERE hsa_id = ?').get(begaran.personHsaId) : null;
  if (!p) return {};
  const [fornamn, ...efter] = p.namn.split(' ');
  return { personInformation: [{
    personHsaId: p.hsa_id, givenName: fornamn, middleAndSurName: efter.join(' ') || fornamn, title: p.titel ?? null, dn: p.dn,
    protectedPerson: false, feignedPerson: true,
  }] };
});

// Personalens uppgifter i HSA, jämförda med personalkatalogen. Bara systemförvaltningen.
export function hsaPerson(db, personal, id) {
  if (!require('../atkomst.js').kanRoll(personal, 'forvalta_api')) throw new Fel(403, 'Bara systemförvaltaren jämför personalkatalogen med HSA.', 'nekad');
  const p = db.query("SELECT * FROM personal WHERE id = ? AND yrke <> 'systemkonto'").get(String(id));
  if (!p) throw new Fel(404, 'Personen finns inte i personalkatalogen.', 'saknas');
  let svar;
  try { svar = anropa(db, 'GetEmployeeIncludingProtectedPerson', { personHsaId: p.hsa_id }); } catch (e) {
    if (e?.kod) return { stammer: null, text: 'HSA-katalogen svarar inte just nu. Personalkatalogen gäller som vanligt.' };
    throw e;
  }
  const h = svar.personInformation?.[0];
  if (!h) return { stammer: false, hsaId: p.hsa_id, text: `HSA-id ${p.hsa_id} finns inte i HSA-katalogen. Kontrollera id:t i personalkatalogen.` };
  const namn = [h.givenName, h.middleAndSurName].filter(Boolean).join(' ');
  const skillnader = [['namn', p.namn, namn], ['titel', p.titel ?? null, h.title ?? null]].filter(([, a, b]) => a !== b).map(([falt, vardkallan, hsa]) => ({ falt, vardkallan, hsa }));
  return {
    stammer: !skillnader.length, hsaId: p.hsa_id, hsa: { namn, titel: h.title ?? null, dn: h.dn, pahittad: h.feignedPerson === true }, skillnader,
    text: skillnader.length ? `HSA-katalogen har en annan uppgift för ${skillnader.map(s => s.falt).join(' och ')}. HSA är masterkatalog: uppdatera personalkatalogen.` : 'Personalkatalogen stämmer med HSA-katalogen.',
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Den simulerade PU-tjänsten: demons patienter, som har Skatteverkets testpersonnummer. För en person med
// sekretessmarkering lämnas ingen adress ut, som i folkbokföringen.
const KON = { man: 'M', kvinna: 'K', M: 'M', K: 'K' };
tjanst.registrera(PU, ({ db }, { begaran }) => ({
  resident: (sakraKopior(db), begaran.personId ?? []).map(pnr => {
    const f = hittaPaToken(db, String(pnr));
    const p = f ? db.query('SELECT * FROM rivta_sim_pu WHERE patient_id = ?').get(gallandeId(db, f)) : null;
    if (!p) return null;
    return {
      Sekretessmarkering: p.skyddad ? 'J' : 'N',
      Personpost: {
        PersonId: p.personnummer, Kon: KON[p.kon] ?? null, Fodelsetid: String(p.fodd).replace(/-/g, '').slice(0, 8),
        Namn: { Fornamn: p.fornamn, Efternamn: p.efternamn },
        Folkbokforingsadress: p.skyddad ? null : { Utdelningsadress1: p.adress ?? null, PostNr: p.postnr ? String(p.postnr).replace(/\s/g, '') : null, Postort: p.ort ?? null },
        Relationer: {},
      },
    };
  }).filter(Boolean),
}));

// Patientens folkbokföring i PU-tjänsten, jämförd med Vårdkällans uppgifter. Systemet säger själv vad som skiljer sig.
export function puPatient(atk) {
  atk.krav('las_admin');
  const db = atk.db;
  const p = db.query('SELECT * FROM patienter WHERE id = ?').get(atk.patientId);
  if (p.id_typ !== 'personnummer') return { stammer: null, text: 'Patienten har inget personnummer, så PU-tjänsten har ingen folkbokföring att jämföra med. Identiteten hanteras i Vårdkällan.' };
  let svar;
  try { svar = anropa(db, 'LookupResidentForFullProfile', { personId: [p.personnummer], lookUpSpecification: {} }); } catch (e) {
    if (e?.kod) return { stammer: null, text: 'PU-tjänsten svarar inte just nu. Patientens uppgifter i Vårdkällan gäller som vanligt.' };
    throw e;
  }
  const r = svar.resident?.[0];
  if (!r) atk.logga('las_admin', atk.grund(), 'rivta:LookupResidentForFullProfile');
  if (!r) return { stammer: false, text: 'Personnumret finns inte i PU-tjänsten. Kontrollera identiteten med patienten.' };
  const pp = r.Personpost;
  const adress = pp.Folkbokforingsadress;
  // Säkerhetsgranskningen av runda 14: för en patient med skyddad identitet i Vårdkällan eller sekretessmarkering i
  // PU-tjänsten jämförs adressen aldrig, och svaret säger bara vilka fält som skiljer sig, utan värden. Värdena för namnet
  // visas bara efter det aktiva valet visa_identitet, som prövas på servern för just den patienten och personen, som när
  // identiteten visas i journalen. Ett sådant val kan bara göras för skyddad identitet i Vårdkällan.
  const sekretess = r.Sekretessmarkering === 'J';
  const skyddad = Boolean(p.skyddad) || sekretess;
  const visad = !skyddad || (Boolean(p.skyddad) && Boolean(atk.val?.visa_identitet) && kanRoll(atk.personal, 'visa_identitet'));
  const falt = [['förnamn', p.fornamn, pp.Namn?.Fornamn ?? null], ['efternamn', p.efternamn, pp.Namn?.Efternamn ?? null]];
  if (!skyddad) falt.push(['adress', p.adress ?? null, adress?.Utdelningsadress1 ?? null], ['postnummer', p.postnr ? String(p.postnr).replace(/\s/g, '') : null, adress?.PostNr ?? null], ['ort', p.ort ?? null, adress?.Postort ?? null]);
  const skillnader = falt.filter(([, a, b]) => a !== b).map(([f, vardkallan, pu]) => (visad ? { falt: f, vardkallan, pu } : { falt: f }));
  atk.logga('las_admin', atk.grund(), 'rivta:LookupResidentForFullProfile', 'tillaten', skyddad && visad ? 'Jämförelse med folkbokföringen efter aktivt val att visa skyddad identitet.' : null);
  return {
    stammer: !skillnader.length, sekretessmarkering: sekretess, skyddadIdentitet: Boolean(p.skyddad), varden: visad, skillnader,
    text: skillnader.length ? `Folkbokföringen har en annan uppgift för ${skillnader.map(x => x.falt).join(', ')}. Uppdatera patientens uppgifter efter folkbokföringen.${visad ? '' : ' Värdena visas inte, eftersom patienten har skyddade personuppgifter.'}`
      : skyddad ? 'Namnet stämmer med folkbokföringen. Patienten har skyddade personuppgifter, så adressen jämförs inte.' : 'Patientens uppgifter stämmer med folkbokföringen.',
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Engagemangsindex (Update 1.0): en post per patient, vårdenhet och informationsmängd där Vårdkällan har uppgifter, så
// att den aggregerande tjänsten vet var den ska fråga. Posten säger bara att det finns uppgifter, aldrig vilka. Den
// simulerade tjänsten sparar posterna i sandlådan. Kategorierna är de som domänens villkor för engagemangsindex anger
// (voo vårdöversikt och dia diagnos i riv.clinicalprocess.healthcond.description).
const EI_DOMAN = [
  ['riv:clinicalprocess:healthcond:description', 'voo', 'anteckningar'], ['riv:clinicalprocess:healthcond:description', 'dia', 'diagnoser'],
];
tjanst.registrera(EI, ({ db }, { begaran }) => {
  db.exec(`CREATE TABLE IF NOT EXISTS rivta_sim_engagemang (nyckel TEXT PRIMARY KEY, patient_id TEXT NOT NULL, doman TEXT NOT NULL, kategori TEXT NOT NULL,
    vardenhet_hsa TEXT NOT NULL, kallsystem TEXT NOT NULL, senast TEXT, uppdaterad TEXT NOT NULL)`);
  for (const t of begaran.engagementTransaction ?? []) {
    const e = t.engagement;
    const pid = (() => { const f = hittaPaToken(db, e.registeredResidentIdentification); return f ? gallandeId(db, f) : null; })();
    if (!pid) continue;
    const nyckel = [e.registeredResidentIdentification, e.serviceDomain, e.categorization, e.logicalAddress, e.businessObjectInstanceIdentifier, e.sourceSystem, e.dataController].join('|');
    if (t.deleteFlag) db.query('DELETE FROM rivta_sim_engagemang WHERE nyckel = ?').run(nyckel);
    else db.query('INSERT INTO rivta_sim_engagemang (nyckel, patient_id, doman, kategori, vardenhet_hsa, kallsystem, senast, uppdaterad) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (nyckel) DO UPDATE SET senast = excluded.senast, uppdaterad = excluded.uppdaterad')
      .run(nyckel, pid, e.serviceDomain, e.categorization, e.logicalAddress, e.sourceSystem, e.mostRecentContent ?? null, new Date().toISOString());
  }
  return { ResultCode: 'OK' };
});

// Skickar patientens engagemang till engagemangsindex. Ger antalet poster.
export function uppdateraEngagemang(db, patientId) {
  const p = db.query("SELECT personnummer FROM patienter WHERE id = ? AND skyddad = 0 AND id_typ = 'personnummer'").get(patientId);
  // En patient med skyddade personuppgifter eller utan personnummer anmäls inte till engagemangsindex.
  if (!p) return 0;
  const vg = vardgivare(db);
  const tidkolumn = { anteckningar: 'skapad', diagnoser: 'datum' };
  const sparrade = new Set(db.query('SELECT enhet_id FROM sparrar WHERE patient_id = ? AND aktiv = 1').all(patientId).map(r => vardenhetFor(db, r.enhet_id)));
  const poster = [];
  for (const [doman, kategori, mangd] of EI_DOMAN) {
    const enheter = new Map();
    for (const r of db.query(`SELECT enhet_id, max(coalesce(${tidkolumn[mangd]}, '')) AS senast FROM ${mangd} WHERE patient_id = ? GROUP BY enhet_id`).all(patientId)) {
      const ve = vardenhetFor(db, r.enhet_id);
      // Spärrade uppgifter anmäls inte, så att indexet inte röjer att de finns.
      if (sparrade.has(ve)) continue;
      const hsa = db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(ve)?.hsa_id;
      if (hsa && (!enheter.has(hsa) || enheter.get(hsa) < r.senast)) enheter.set(hsa, r.senast);
    }
    for (const [hsa, senast] of enheter) {
      const t = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.exec(senast ?? '')?.[0];
      poster.push({ engagement: {
        registeredResidentIdentification: p.personnummer, serviceDomain: doman, categorization: kategori, logicalAddress: hsa, businessObjectInstanceIdentifier: 'NA',
        clinicalProcessInterestId: randomUUID(), mostRecentContent: t ? t.replace(/[-:T]/g, '').padEnd(14, '0') : null, sourceSystem: vg, creationTime: null, updateTime: null,
        dataController: vg, owner: vg,
      }, deleteFlag: false });
    }
  }
  if (!poster.length) return 0;
  anropa(db, 'Update', { engagementTransaction: poster });
  return poster.length;
}
