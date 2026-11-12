// Runda 14, r2: tjänstekontrakten som Vårdkällan bygger mot RIVTA. Varje kontrakt läses ur sin WSDL i de pinnade
// schemana under app/rivta/ (källa, version och sha256 i KALLA.json per domän): SOAPAction, begärans och svarets element,
// schemat för meddelandena och om den logiska adressen ska stå i huvudet. Inget skrivs för hand som redan står i WSDL:en.
//
//   const k = kontrakt('riv.clinicalprocess.healthcond.description', 'GetDiagnosis', '2.0');
//   k.soapAction, k.begaran { ns, lokal }, k.svar { ns, lokal }, k.schema (xsd.js), k.vag ('/GetDiagnosis/2/rivtabp21')
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { tolka, barnen, barn, attribut } from './xml.js';
import { schema, SchemaFel } from './xsd.js';

export const RIVTA_ROT = resolve(join(import.meta.dir, '..', '..', 'rivta'));
const WSDL = 'http://schemas.xmlsoap.org/wsdl/';
const WSDL_SOAP = 'http://schemas.xmlsoap.org/wsdl/soap/';
const XS = 'http://www.w3.org/2001/XMLSchema';
const REGISTRY_XSD = 'itintegration_registry_1.0.xsd';

const filerI = (k) => {
  const ut = [];
  const ga = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) ga(f); else ut.push(f); } };
  if (existsSync(k)) ga(k);
  return ut;
};

const qname = (nod, v) => {
  const i = v.indexOf(':');
  return { ns: i < 0 ? (nod.prefixer[''] ?? '') : nod.prefixer[v.slice(0, i)], lokal: i < 0 ? v : v.slice(i + 1) };
};

// Källan för en domän ur KALLA.json: taggen och commit.
export function kalla(doman) {
  return JSON.parse(readFileSync(join(RIVTA_ROT, doman, 'KALLA.json'), 'utf8'));
}

const cache = new Map();
export function kontrakt(doman, namn, version) {
  const k = `${doman}|${namn}|${version}`;
  if (cache.has(k)) return cache.get(k);
  // Runda 14, r3: domäner för tillämpningar heter riv-application (till exempel 1177:s patientportal).
  if (!/^riv(-application)?(\.[a-z]+)+$/.test(doman) || !/^[A-Z][A-Za-z]+$/.test(namn) || !/^\d+\.\d+$/.test(version)) throw new SchemaFel(`Okänt tjänstekontrakt ${doman} ${namn} ${version}.`);
  const fil = filerI(join(RIVTA_ROT, doman, 'schemas')).find(f => f.endsWith(`/${namn}Interaction_${version}_RIVTABP21.wsdl`));
  if (!fil) throw new SchemaFel(`WSDL för ${namn} ${version} finns inte bland de pinnade schemana för ${doman}.`);
  const w = tolka(readFileSync(fil, 'utf8'));
  // Schemat för meddelandena är det som WSDL:en importerar, utom registret för den logiska adressen.
  const typer = barn(w, 'types', WSDL);
  const xsdImporter = barnen(barn(typer, 'schema', XS), 'import', XS).map(i => attribut(i, 'schemaLocation'));
  const responder = xsdImporter.find(p => !p.endsWith(REGISTRY_XSD));
  const registry = xsdImporter.find(p => p.endsWith(REGISTRY_XSD));
  const op = barn(barn(w, 'binding', WSDL), 'operation', WSDL);
  const soapAction = attribut(barn(op, 'operation', WSDL_SOAP), 'soapAction');
  const meddelanden = new Map(barnen(w, 'message', WSDL).map(m => [attribut(m, 'name'), m]));
  const portOp = barn(barn(w, 'portType', WSDL), 'operation', WSDL);
  const delAv = (m) => barnen(meddelanden.get(qname(portOp, attribut(barn(portOp, m, WSDL), 'message')).lokal), 'part', WSDL);
  const inDelar = delAv('input');
  const utDelar = delAv('output');
  const elementFor = (delar) => qname(delar.find(p => attribut(p, 'name') === 'parameters') ?? delar.at(-1), attribut(delar.find(p => attribut(p, 'name') === 'parameters') ?? delar.at(-1), 'element'));
  const rel = (p) => relative(RIVTA_ROT, resolve(dirname(fil), p));
  const def = {
    doman, namn, version, major: version.split('.')[0],
    domanKort: doman.replace(/^riv\./, '').replace(/\./g, ':'),
    wsdl: relative(RIVTA_ROT, fil), schemaFil: rel(responder), soapAction,
    begaran: elementFor(inDelar), svar: elementFor(utDelar),
    logiskAdressIHuvud: inDelar.some(p => attribut(p, 'name') === 'LogicalAddress'),
    vag: `/${namn}/${version.split('.')[0]}/rivtabp21`,
    kalla: { tagg: kalla(doman).tagg, commit: kalla(doman).commit },
  };
  // Schemat kompileras en gång, med registret för den logiska adressen.
  Object.defineProperty(def, 'schema', { enumerable: false, value: schema(RIVTA_ROT, def.schemaFil, ...(registry ? [rel(registry)] : [])) });
  cache.set(k, def);
  return def;
}

// Validerar ett element mot kontraktets schema. Ger en lista med fel, tom när elementet följer schemat.
export const validera = (def, nod) => def.schema.validera(nod);
