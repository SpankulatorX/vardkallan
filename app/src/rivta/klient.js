// Runda 14, r2: tjänstekonsumenten för RIVTA. Begäran byggs ur kontraktets schema och valideras innan den skickas, och
// svaret tolkas säkert och valideras innan något i det används. Ett svar som inte följer schemat används aldrig.
//
//   const svar = await anropa(def, { logiskAdress, begaran, transport, db });
//
// transport är en funktion ({ text, soapAction, vag }) => { status, text }: https(...) för ömsesidig TLS mot en
// tjänsteplattform eller producent, eller iProcessen(tjanst, avsandare) mot en tjänst i samma process (mockarna i
// testerna). Varje anrop sparas i rivta_anrop när db är med.
import { skriv } from './xml.js';
import { kuvert, logiskAdress as adressHuvud, lasKuvert, SoapFel, CONTENT_TYPE } from './soap.js';
import { SchemaFel } from './xsd.js';
import { loggaAnrop } from './anropslogg.js';

export const TIDSGRANS_MS = 10_000;

// Ett fel från ett anrop som konsument. kod är 'fault' (producenten svarade med SOAP Fault), 'schema' (begäran eller
// svaret följer inte schemat), 'transport' (ingen förbindelse, fel status eller tidsgränsen) eller 'svar' (fel element).
export class RivtaFel extends Error {
  constructor(kod, text, faultkod = null) { super(text); this.kod = kod; this.faultkod = faultkod; }
}

// Bygger och validerar begäran. Ger kuvertets text.
function byggBegaran(def, logiskAdress, begaran) {
  let el;
  try { el = def.schema.bygg(def.begaran.ns, def.begaran.lokal, begaran); } catch (e) {
    if (e instanceof SchemaFel) throw new RivtaFel('schema', `Begäran till ${def.namn} kunde inte byggas enligt schemat: ${e.message}`);
    throw e;
  }
  const fel = def.schema.validera(el);
  if (fel.length) throw new RivtaFel('schema', `Begäran till ${def.namn} följer inte schemat och skickas inte: ${fel.slice(0, 3).join(' ')}`);
  if (def.logiskAdressIHuvud && !logiskAdress) throw new RivtaFel('schema', `${def.namn} kräver en logisk adress i huvudet.`);
  return kuvert(skriv(el), def.logiskAdressIHuvud ? [adressHuvud(logiskAdress)] : []);
}

// Tolkar och validerar svaret. Ger svarets objekt i schemats form.
function lasSvar(def, res) {
  let k;
  try { k = lasKuvert(res.text); } catch (e) {
    if (e instanceof SoapFel) throw new RivtaFel('svar', `Svaret från ${def.namn} är inget giltigt SOAP-kuvert: ${e.message}`);
    throw e;
  }
  if (k.fault) throw new RivtaFel('fault', `${def.namn} svarade med ett fel: ${k.fault.text}`, k.fault.kod);
  if (res.status !== 200) throw new RivtaFel('transport', `${def.namn} svarade med HTTP-status ${res.status}.`);
  if (k.kropp.ns !== def.svar.ns || k.kropp.lokal !== def.svar.lokal) throw new RivtaFel('svar', `Svaret från ${def.namn} är ${k.kropp.lokal}, inte ${def.svar.lokal}.`);
  const svarFel = def.schema.validera(k.kropp);
  if (svarFel.length) throw new RivtaFel('schema', `Svaret från ${def.namn} följer inte schemat och används inte: ${svarFel.slice(0, 3).join(' ')}`);
  return def.schema.lasUt(k.kropp);
}

const loggaUt = (db, def, logiskAdress, resultat, text = null) => {
  if (!db) return;
  try { loggaAnrop(db, { riktning: 'ut', kontrakt: def.namn, version: def.version, organisation: logiskAdress, logiskAdress, resultat, text }); } catch { /* loggen får inte dölja felet */ }
};

export async function anropa(def, { logiskAdress = null, begaran, transport, db = null }) {
  try {
    const text = byggBegaran(def, logiskAdress, begaran);
    let res;
    try { res = await transport({ text, soapAction: def.soapAction, vag: def.vag }); } catch (e) {
      throw new RivtaFel('transport', `${def.namn} kunde inte nås: ${e.message}`);
    }
    const ut = lasSvar(def, res);
    loggaUt(db, def, logiskAdress, 'ok');
    return ut;
  } catch (e) {
    loggaUt(db, def, logiskAdress, e instanceof RivtaFel ? e.kod : 'fel', e.message);
    throw e;
  }
}

// Samma anrop med en transport som svarar direkt (en tjänst i samma process, iProcessenSynk).
export function anropaSynk(def, { logiskAdress = null, begaran, transport, db = null }) {
  try {
    const text = byggBegaran(def, logiskAdress, begaran);
    let res;
    try { res = transport({ text, soapAction: def.soapAction, vag: def.vag }); } catch (e) {
      throw new RivtaFel('transport', `${def.namn} kunde inte nås: ${e.message}`);
    }
    const ut = lasSvar(def, res);
    loggaUt(db, def, logiskAdress, 'ok');
    return ut;
  } catch (e) {
    loggaUt(db, def, logiskAdress, e instanceof RivtaFel ? e.kod : 'fel', e.message);
    throw e;
  }
}

// En tjänst i samma process, som om anropet kom från avsandare genom en transport med ömsesidig TLS.
export const iProcessen = (tjanst, { ctx, avsandare }) => async ({ text, soapAction, vag }) => {
  const r = await tjanst.hanteraAnrop(typeof ctx === 'function' ? ctx() : ctx, { text, soapAction, vag, avsandare });
  return { status: r.status, text: r.body };
};

// Samma sak med direkt svar, för en tjänst i samma process vars producenter svarar direkt.
export const iProcessenSynk = (tjanst, { ctx, avsandare }) => ({ text, soapAction, vag }) => {
  const r = tjanst.hanteraAnropSynk(typeof ctx === 'function' ? ctx() : ctx, { text, soapAction, vag, avsandare });
  return { status: r.status, text: r.body };
};

// HTTPS med ömsesidig TLS. bas är adressen till tjänsteplattformen eller producenten, och kontraktets väg läggs till.
// cert, key och ca är PEM. Tidsgränsen gäller hela anropet.
export const https = ({ bas, cert, key, ca, tidsgransMs = TIDSGRANS_MS, huvuden = {} }) => async ({ text, soapAction, vag }) => {
  const r = await fetch(`${bas.replace(/\/+$/, '')}${vag}`, {
    method: 'POST', body: text, signal: AbortSignal.timeout(tidsgransMs),
    headers: { 'Content-Type': CONTENT_TYPE, SOAPAction: `"${soapAction}"`, ...huvuden },
    tls: { cert, key, ca, rejectUnauthorized: true },
  });
  const t = await r.text();
  if (t.length > 4 * 1024 * 1024) throw new Error('Svaret är för stort.');
  return { status: r.status, text: t };
};
