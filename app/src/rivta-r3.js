// Runda 14, r3: del r3:s tjänstekontrakt på den gemensamma grunden i src/rivta/ (intyg, e-remiss, remisstatus,
// vaccination, Infektionsverktyget, NKRR, formulär, 1177 och dos). Här finns bara det som är gemensamt för del r3:
//   - kontrakten ur de pinnade WSDL-filerna (kontrakt.js);
//   - Vårdkällans producenter för meddelanden som andra system skickar till en vårdenhet (statusuppdateringar för intyg,
//     remisser, besked och svar). De adresseras till vårdenhetens HSA-id och tas bara emot från de organisationer som är
//     anslutna för kontraktet. De läser inga journaluppgifter åt den som anropar, så de har inget systemkonto;
//   - transporterna i samma process till de simulerade motparterna och tillbaka (iProcessen), som i grundens tester;
//   - en kö för det som en motpart skickar efter sitt svar.
// Motparterna är simulerade, märkta som simulerade och har påhittade HSA-id. Ingen av dem är en verklig nationell tjänst.
import { kontrakt } from './rivta/kontrakt.js';
import { skapaTjanst } from './rivta/tjanst.js';
import { anropa as anropaRivta, iProcessen, RivtaFel } from './rivta/klient.js';
import { vardgivare } from './rivta/konsumenter.js';

export { RivtaFel };
const cache = new Map();
export const def = (doman, namn, version) => {
  const k = `${doman}|${namn}|${version}`;
  if (!cache.has(k)) cache.set(k, kontrakt(doman, namn, version));
  return cache.get(k);
};

// Vårdenheternas HSA-id: de logiska adresser som en statusuppdatering eller en remiss till en vårdenhet har.
export const vardenhetsadresser = (db) => db.query("SELECT hsa_id FROM enheter WHERE typ = 'vardenhet' AND hsa_id IS NOT NULL ORDER BY id").all().map(r => r.hsa_id);

// Organisationer som får skicka till Vårdkällans producenter i del r3, per kontrakt. Påhittade HSA-id i demon.
const BEHORIGA = new Map();
export function tillat(kontraktsnamn, hsaId, namn) {
  if (!BEHORIGA.has(kontraktsnamn)) BEHORIGA.set(kontraktsnamn, new Map());
  BEHORIGA.get(kontraktsnamn).set(hsaId, namn);
}
const prova = (db, avsandare, d) => {
  const hsaId = typeof avsandare?.hsaId === 'string' ? avsandare.hsaId : null;
  const namn = hsaId ? BEHORIGA.get(d.namn)?.get(hsaId) : null;
  if (!namn) return { tillaten: false, skal: `Den anropande organisationen ${hsaId ?? 'okänd'} har ingen anropsbehörighet till ${d.namn} hos Vårdkällan.` };
  return { tillaten: true, konsument: { hsaId, namn } };
};
// Vårdkällans producenter för meddelanden till en vårdenhet.
export const vardenheter = skapaTjanst({ namn: 'Vårdkällan', adresser: vardenhetsadresser, prova });

// En simulerad motpart: en egen tjänst med samma kuvert, validering och fel, som tar emot från Vårdkällans vårdgivare.
export function simuleradTjanst(namn, adresser) {
  return skapaTjanst({
    namn, adresser: typeof adresser === 'function' ? adresser : () => adresser,
    prova: (db, avsandare) => (avsandare?.hsaId && avsandare.hsaId === vardgivare(db)
      ? { tillaten: true, konsument: { hsaId: avsandare.hsaId, namn: 'Vårdkällan' } }
      : { tillaten: false, skal: 'Bara Vårdkällan är ansluten till den simulerade tjänsten.' }),
  });
}

// Vårdkällan anropar en motpart. Avsändaren är vårdgivaren, som i funktionscertifikatet.
export const tillMotpart = (db, tjanst) => iProcessen(tjanst, { ctx: { db }, avsandare: { hsaId: vardgivare(db), via: 'direkt' } });
// En motpart anropar Vårdkällan, med sitt HSA-id.
export const tillVardkallan = (db, hsaId, tjanst = vardenheter) => iProcessen(tjanst, { ctx: { db }, avsandare: { hsaId, via: 'direkt' } });

export async function anropa(db, d, { logiskAdress, begaran, transport }) {
  return anropaRivta(d, { logiskAdress, begaran, transport, db });
}

// Prövningen innan uppgifter om en patient lämnas till ett register eller en uppföljningstjänst utanför Vårdkällan.
// Alla flöden i del r3 som registrerar eller rapporterar anropar den, så att den aldrig är svagare i ett flöde än i ett
// annat. Ger { tillaten, skal }, där skal förklarar på vanlig svenska varför inget skickas.
//   kvalitetsregister   patienten har inte motsatt sig registreringen i registret, eller har återkallat invändningen
//                       (patientdatalagen 7 kap. 2 §), och har inte skyddade personuppgifter.
//   uppfoljning         uppgifterna lämnas inte för en patient med skyddade personuppgifter (Infektionsverktyget).
export function provaUtlamning(db, patient, { slag, register = null } = {}) {
  if (!patient) return { tillaten: false, skal: 'Patienten finns inte.' };
  if (patient.skyddad) return { tillaten: false, skal: 'Uppgifter om en patient med skyddade personuppgifter lämnas inte ut i demon.' };
  if (slag === 'kvalitetsregister') {
    let r = null;
    try {
      // Tabellen för invändningarna finns i rapporteringen till kvalitetsregistret och skapas där om den saknas.
      require('./myndighetsrapport.js').sakra(db);
      r = db.query('SELECT id FROM kvalitetsregister_motsatt WHERE patient_id = ? AND register = ? AND aterkallad IS NULL').get(patient.id, register); } catch {
      // Utan tabellen går invändningen inte att pröva, och då skickas inget (en kontroll som inte kan avgöras stoppar).
      return { tillaten: false, skal: 'Det går inte att se om patienten har motsatt sig registreringen, så inget skickas.' };
    }
    if (r) return { tillaten: false, skal: 'Patienten har motsatt sig registrering i kvalitetsregistret, så uppgifterna lämnas inte (patientdatalagen 7 kap. 2 §). Invändningen kan återkallas av patienten.' };
    return { tillaten: true, skal: null };
  }
  if (slag === 'uppfoljning') return { tillaten: true, skal: null };
  return { tillaten: false, skal: 'Okänd mottagare för uppgifterna.' };
}

// Meddelanden som skickas efter en handling i journalen (till exempel beskedet när en e-remiss tas emot) går i bakgrunden,
// så att handlingen inte väntar på motparten. klart(db) väntar in dem, för testerna och före en utloggning.
const PAGAENDE = new WeakMap();
export function bakgrund(db, lofte) {
  if (!PAGAENDE.has(db)) PAGAENDE.set(db, new Set());
  const s = PAGAENDE.get(db);
  const p = Promise.resolve(lofte).catch(x => { console.error('Ett meddelande i bakgrunden kunde inte skickas:', x.message); }).finally(() => s.delete(p));
  s.add(p);
  return p;
}
export async function klart(db) { while (PAGAENDE.get(db)?.size) await Promise.all([...PAGAENDE.get(db)]); }

// Kön: det som en motpart skickar efter sitt svar levereras när anroparen har sparat svaret, som när svaret har kommit
// fram över nätet. Kön finns bara i minnet. En händelse som går förlorad hittas av journalens egen avstämning.
const KO = new WeakMap();
export function ko(db, fn) { if (!KO.has(db)) KO.set(db, []); KO.get(db).push(fn); }
export async function leverera(db) {
  const k = KO.get(db) ?? [];
  KO.delete(db);
  let n = 0;
  for (const fn of k) { try { await fn(); n++; } catch (x) { console.error('Ett köat meddelande kunde inte levereras:', x.message); } }
  return n;
}
