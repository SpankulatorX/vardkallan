// Runda 14, r2: en lokal tjänsteplattform för test, som gör det som tjänsteplattformens virtualiseringstjänst (VP)
// gör med ett anrop, efter adresseringen i en lokal TAK-tabell. Den är inte Ineras tjänsteplattform och används bara i
// testerna och i skriptet scripts/rivta-plattform.js:
//   1. Konsumenten anropar plattformen med ömsesidig TLS. Konsumentens HSA-id är serialNumber i dess certifikat.
//   2. Kontraktet läses ur kroppens namnrymd och den logiska adressen ur huvudet.
//   3. Anropsbehörigheten prövas: konsumenten, kontraktet och den logiska adressen ska finnas i TAK, annars VP007.
//   4. Vägvalet: kontraktet och den logiska adressen ger producentens adress, annars VP004.
//   5. Anropet skickas vidare till producenten med plattformens eget certifikat och huvudet
//      x-rivta-original-serviceconsumer-hsaid med den ursprungliga konsumenten, och producentens svar går tillbaka.
// Felkoderna och texterna följer tjänsteplattformens (VP004 och VP007), med en förklaring på svenska.
import { randomUUID } from 'node:crypto';
import { starta as startaTls } from './tls.js';
import { lasKuvert, fault, CONTENT_TYPE } from './soap.js';

// tak: { anropsbehorigheter: [{ konsument, kontrakt, logiskAdress }], vagval: [{ kontrakt, logiskAdress, adress }] }.
// kontrakt är kontraktets namnrymd för begäran, till exempel urn:riv:clinicalprocess:healthcond:description:GetDiagnosisResponder:2.
export function starta({ cert, key, ca, tak, port = 0 }) {
  const fel = (text) => ({ status: 500, headers: { 'Content-Type': CONTENT_TYPE }, body: fault('Server', text) });
  return startaTls({
    port, cert, key, ca,
    hantera: async ({ huvuden, kropp, avsandare, vag }) => {
      if (!avsandare) return fel('VP002 Konsumentens certifikat saknar HSA-id.');
      let k;
      try { k = lasKuvert(kropp); } catch (e) { return fel(`VP001 Meddelandet kunde inte läsas: ${e.message}`); }
      if (!k.kropp) return fel('VP001 Meddelandet saknar kropp.');
      const kontrakt = k.kropp.ns;
      const adress = k.logiskAdress;
      if (!adress) return fel('VP003 Den logiska adressen saknas i huvudet.');
      const behorig = tak.anropsbehorigheter.some(a => a.konsument === avsandare.hsaId && a.kontrakt === kontrakt && a.logiskAdress === adress);
      if (!behorig) return fel(`VP007 Anropsbehörighet saknas för konsumenten ${avsandare.hsaId}, kontraktet ${kontrakt} och den logiska adressen ${adress}.`);
      const val = tak.vagval.find(v => v.kontrakt === kontrakt && v.logiskAdress === adress);
      if (!val) return fel(`VP004 Inget vägval för kontraktet ${kontrakt} och den logiska adressen ${adress}.`);
      const r = await fetch(`${val.adress.replace(/\/+$/, '')}${vag}`, {
        method: 'POST', body: kropp, signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': CONTENT_TYPE, SOAPAction: huvuden.soapaction ?? '', 'x-rivta-original-serviceconsumer-hsaid': avsandare.hsaId, 'x-skltp-correlation-id': randomUUID() },
        tls: { cert, key, ca, rejectUnauthorized: true },
      }).catch(e => ({ fel: e }));
      if (r.fel) return fel(`VP009 Producenten kunde inte nås: ${r.fel.message}`);
      return { status: r.status, headers: { 'Content-Type': CONTENT_TYPE }, body: await r.text() };
    },
  });
}
