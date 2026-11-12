// Runda 14, r2: SOAP 1.1 enligt RIVTA Basic Profile 2.1. Ett anrop är ett SOAP-kuvert med den logiska adressen
// (LogicalAddress i namnrymden urn:riv:itintegration:registry:1) i huvudet och exakt ett element i kroppen, skickat med
// HTTP POST, Content-Type text/xml och SOAPAction. Fel skickas som SOAP Fault med HTTP-status 500: soap:Client när
// anropet är fel och soap:Server när felet ligger hos producenten. Felets text är på svenska.
import { tolka, skriv, el, barnen, barn, attribut, XmlFel } from './xml.js';

export const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
export const SOAP12_NS = 'http://www.w3.org/2003/05/soap-envelope';
export const REGISTRY_NS = 'urn:riv:itintegration:registry:1';
export const CONTENT_TYPE = 'text/xml; charset=UTF-8';

// Ett fel som blir ett SOAP Fault. kod är Client, Server, VersionMismatch eller MustUnderstand.
export class SoapFel extends Error {
  constructor(kod, text, detalj = null) {
    super(text);
    this.soapkod = kod;
    this.detalj = detalj;
  }
}

// Bygger kuvertet. kropp är XML-texten för kroppens element (utan XML-deklaration) och huvud en lista med
// XML-texter för huvudets element.
export function kuvert(kropp, huvud = []) {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Header>${huvud.join('')}</soap:Header><soap:Body>${kropp}</soap:Body></soap:Envelope>`;
}

export const logiskAdress = (adress) => skriv(el(REGISTRY_NS, 'LogicalAddress', String(adress)));
// Runda 14, r3: den logiska adressen i RIVTA Basic Profile 2.0 står i WS-Addressing (wsa:To).
export const WSA_NS = 'http://www.w3.org/2005/08/addressing';
export const wsaTo = (adress) => skriv(el(WSA_NS, 'To', String(adress)));
const WSA_TILL = el(WSA_NS, 'To').lokal;

export function fault(kod, text) {
  const f = `<soap:Fault><faultcode>soap:${kod}</faultcode><faultstring xml:lang="sv">${String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</faultstring></soap:Fault>`;
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body>${f}</soap:Body></soap:Envelope>`;
}

// Läser ett kuvert. Ger { huvud: [element], kropp: element, logiskAdress, fault }. Ett fault i kroppen ges som
// { fault: { kod, text } } och kropp null. Kastar SoapFel om kuvertet inte följer profilen.
export function lasKuvert(text, { tak } = {}) {
  let rot;
  try { rot = tolka(text, tak); } catch (e) {
    if (e instanceof XmlFel) throw new SoapFel('Client', `Meddelandet är inte giltig XML: ${e.message}`);
    throw e;
  }
  if (rot.lokal === 'Envelope' && rot.ns === SOAP12_NS) throw new SoapFel('VersionMismatch', 'RIVTA Basic Profile 2.1 använder SOAP 1.1, inte SOAP 1.2.');
  if (rot.lokal !== 'Envelope' || rot.ns !== SOAP_NS) throw new SoapFel('Client', 'Meddelandet är inget SOAP 1.1-kuvert.');
  const delar = rot.barn;
  const huvudEl = delar[0]?.lokal === 'Header' && delar[0].ns === SOAP_NS ? delar[0] : null;
  const kroppEl = delar[huvudEl ? 1 : 0];
  if (!kroppEl || kroppEl.lokal !== 'Body' || kroppEl.ns !== SOAP_NS || delar.length !== (huvudEl ? 2 : 1)) {
    throw new SoapFel('Client', 'Kuvertet ska ha ett huvud (frivilligt) och en kropp, och inget annat.');
  }
  if (/[^ \t\r\n]/.test(rot.text) || (huvudEl && /[^ \t\r\n]/.test(huvudEl.text)) || /[^ \t\r\n]/.test(kroppEl.text)) {
    throw new SoapFel('Client', 'Kuvertet får inte ha text utanför elementen.');
  }
  const huvud = huvudEl ? huvudEl.barn : [];
  const adresser = barnen({ barn: huvud }, 'LogicalAddress', REGISTRY_NS);
  if (adresser.length > 1) throw new SoapFel('Client', 'Huvudet har mer än en LogicalAddress.');
  // Ett huvudelement med mustUnderstand som producenten inte förstår ska ge MustUnderstand (SOAP 1.1, 4.2.3).
  for (const h of huvud) {
    const mu = attribut(h, 'mustUnderstand', SOAP_NS);
    if ((mu === '1' || mu === 'true') && !(h.lokal === 'LogicalAddress' && h.ns === REGISTRY_NS) && !(h.lokal === WSA_TILL && h.ns === WSA_NS)) {
      throw new SoapFel('MustUnderstand', `Huvudelementet ${h.lokal} har mustUnderstand men förstås inte av tjänsten.`);
    }
  }
  if (kroppEl.barn.length !== 1) throw new SoapFel('Client', 'Kroppen ska ha exakt ett element (RIVTA Basic Profile 2.1, document/literal).');
  const innehall = kroppEl.barn[0];
  if (innehall.lokal === 'Fault' && innehall.ns === SOAP_NS) {
    const kod = barn(innehall, 'faultcode')?.text.trim() ?? '';
    return { huvud, kropp: null, logiskAdress: null, fault: { kod: kod.replace(/^[^:]*:/, ''), text: barn(innehall, 'faultstring')?.text.trim() ?? '' } };
  }
  // Runda 14, r3: utan LogicalAddress läses adressen ur wsa:To (RIVTA Basic Profile 2.0).
  const till = adresser.length ? [] : barnen({ barn: huvud }, WSA_TILL, WSA_NS);
  if (till.length > 1) throw new SoapFel('Client', 'Huvudet har mer än en wsa:To.');
  const adress = (adresser[0] ?? till[0])?.text.trim() ?? null;
  return { huvud, kropp: innehall, logiskAdress: adress || null, fault: null };
}

// SOAPAction-huvudet står ofta inom citattecken.
export const soapAction = (v) => (v == null ? null : String(v).trim().replace(/^"(.*)"$/, '$1'));
