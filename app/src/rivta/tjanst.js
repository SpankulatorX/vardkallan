// Runda 14, r2: tjänsteproducenten för RIVTA. Ett anrop tas emot som SOAP 1.1 enligt RIVTA Basic Profile 2.1 och går
// igenom samma steg varje gång, i den här ordningen:
//   1. kuvertet tolkas säkert (xml.js) och följer profilen (soap.js);
//   2. kroppens element ger tjänstekontraktet, och SOAPAction och adressen ska stämma med det;
//   3. begäran valideras mot kontraktets schema (xsd.js);
//   4. den logiska adressen ska vara en adress som Vårdkällan svarar för;
//   5. den anropande organisationen ska vara ansluten med behörighet till kontraktet (konsumenter.js);
//   6. producenten svarar med det som behörighetsmotorn ger den anropande organisationen;
//   7. svaret byggs ur schemat och valideras innan det skickas. Ett svar som inte följer schemat skickas aldrig, utan
//      blir ett soap:Server-fel.
// Varje anrop sparas i rivta_anrop med kontraktet, den anropande organisationen och resultatet, utan patientuppgifter.
// Åtkomsten till patientuppgifter loggas dessutom på patienten i åtkomstloggen, som i FHIR-API:t.
import { randomBytes } from 'node:crypto';
import { skriv } from './xml.js';
import { lasKuvert, kuvert, fault, SoapFel, soapAction as rensaAction, CONTENT_TYPE } from './soap.js';
import { SchemaFel } from './xsd.js';
import * as konsumenter from './konsumenter.js';
import { loggaAnrop } from './anropslogg.js';

const nyckel = (ns, lokal) => `${ns}|${lokal}`;

// En tjänst är en uppsättning producenter med samma prövning av logisk adress och anropande organisation. Vårdkällans
// egna producenter finns i vardkallan nedan. De simulerade nationella tjänsterna (mockar.js) är egna tjänster med samma
// kuvert, validering och fel, så att en konsument i Vårdkällan prövas mot samma profil som mot en riktig producent.
//   adresser(db)                     de logiska adresser som tjänsten svarar för
//   prova(db, avsandare, def)        { tillaten, konsument, skal } för den anropande organisationen
export function skapaTjanst({ namn = 'Vårdkällan', adresser = konsumenter.egnaAdresser, prova = konsumenter.prova, logga = true } = {}) {
  const producenter = new Map();
  return {
    namn,
    // Registrerar en producent för ett kontrakt. hantera(ctx, { begaran, logiskAdress, konsument, def }) ger svarets
    // objekt i schemats form (se xsd.js bygg).
    registrera(def, hantera, opts = {}) { producenter.set(nyckel(def.begaran.ns, def.begaran.lokal), { def, hantera, adresser: opts.adresser }); return def; },
    producenter: () => [...producenter.values()].map(p => p.def),
    arProducent: (n) => [...producenter.values()].some(p => p.def.namn === n),
    hanteraAnrop: (ctx, anrop) => hanteraAnrop(ctx, anrop, { producenter, adresser, prova, namn, logga }),
  };
}

const svar = (status, body) => ({ status, headers: { 'Content-Type': CONTENT_TYPE }, body });
const faultSvar = (e) => svar(500, fault(e.soapkod, e.message));

// Tar emot ett anrop. anrop: { text, soapAction, vag, avsandare: { hsaId, via } }. avsandare kommer från transporten
// (det prövade klientcertifikatet, eller tjänsteplattformens huvud med den ursprungliga konsumenten). ctx: { db, nu }.
async function hanteraAnrop(ctx, anrop, { producenter: PRODUCENTER, adresser, prova, namn, logga }) {
  const { db } = ctx;
  const logg = { riktning: 'in', kontrakt: null, version: null, organisation: anrop.avsandare?.hsaId ?? null, logiskAdress: null, via: anrop.avsandare?.via ?? null };
  try {
    const k = lasKuvert(anrop.text);
    if (k.fault) throw new SoapFel('Client', 'En begäran kan inte vara ett SOAP Fault.');
    const p = PRODUCENTER.get(nyckel(k.kropp.ns, k.kropp.lokal));
    if (!p) throw new SoapFel('Client', `${namn} är inte producent för ${k.kropp.lokal} i namnrymden ${k.kropp.ns}.`);
    const { def } = p;
    Object.assign(logg, { kontrakt: def.namn, version: def.version, logiskAdress: k.logiskAdress });
    const action = rensaAction(anrop.soapAction);
    if (action != null && action !== '' && action !== def.soapAction) throw new SoapFel('Client', `SOAPAction ${action} stämmer inte med kontraktet. Den ska vara ${def.soapAction}.`);
    if (anrop.vag && !anrop.vag.replace(/\/+$/, '').endsWith(def.vag)) throw new SoapFel('Client', `Adressen ${anrop.vag} hör inte till ${def.namn}. Den ska sluta med ${def.vag}.`);
    const fel = def.schema.validera(k.kropp);
    if (fel.length) throw new SoapFel('Client', `Begäran följer inte schemat för ${def.namn} ${def.version}: ${fel.slice(0, 3).join(' ')}`);
    if (def.logiskAdressIHuvud) {
      if (!k.logiskAdress) throw new SoapFel('Client', 'Huvudet saknar LogicalAddress (RIVTA Basic Profile 2.1).');
      const egna = (p.adresser ?? adresser)(db);
      if (!egna.includes(k.logiskAdress)) throw new SoapFel('Client', `Den logiska adressen ${k.logiskAdress} är inte en adress som ${namn} svarar för.`);
    }
    const konsument = prova(db, anrop.avsandare, def);
    if (!konsument.tillaten) {
      logg.resultat = 'nekad';
      logg.text = konsument.skal;
      throw new SoapFel('Client', konsument.skal);
    }
    const begaran = def.schema.lasUt(k.kropp);
    const objekt = await p.hantera(ctx, { begaran, logiskAdress: k.logiskAdress, konsument: konsument.konsument, def });
    let svarEl;
    try { svarEl = def.schema.bygg(def.svar.ns, def.svar.lokal, objekt); } catch (e) {
      if (e instanceof SchemaFel) throw new SoapFel('Server', `Producenten kunde inte bygga svaret enligt schemat: ${e.message}`);
      throw e;
    }
    const utFel = def.schema.validera(svarEl);
    if (utFel.length) throw new SoapFel('Server', `Svaret följer inte schemat för ${def.namn} ${def.version} och skickas inte: ${utFel.slice(0, 3).join(' ')}`);
    logg.resultat = 'ok';
    if (logga) loggaAnrop(db, logg);
    return svar(200, kuvert(skriv(svarEl)));
  } catch (e) {
    if (!(e instanceof SoapFel)) {
      console.error('RIVTA-producenten:', e);
      e = new SoapFel('Server', `Ett fel uppstod hos producenten. Felets id är ${randomBytes(6).toString('hex')}.`);
    }
    logg.resultat ??= 'fel';
    logg.text ??= e.message;
    try { if (logga) loggaAnrop(db, logg); } catch { /* loggen får inte dölja felet */ }
    return faultSvar(e);
  }
}

// Vårdkällans egna producenter.
export const vardkallan = skapaTjanst();
