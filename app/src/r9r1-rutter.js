// API för runda 9, r1: beredning med kontroll och etikett och patientnära skanning (beredning.js). Servern lämnar sina
// hjälpare hit. All behörighet prövas i behörighetsmotorn, och varje åtkomst till patientuppgifter loggas.
import { etikettPdf } from './filformat.js';
import * as streckkod from './streckkod.js';
import * as beredning from './beredning.js';
import { etikettformatFor } from './labb-rutter.js';
import * as forbrukning from './forbrukning.js';
import * as egenadministrering from './egenadministrering.js';
import * as administrering from './administrering.js';
import * as lakemedel from './lakemedel.js';
import { tillaggUt } from './ordinationsmallar.js';
import * as bestallning from './lakemedelsbestallning.js';
import * as lakemedelsstatistik from './lakemedelsstatistik.js';
import * as provning from './kliniskprovning.js';

const PDF_HUVUD = (namn) => ({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${namn}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor }) {
  const q = (c, k) => c.url.searchParams.get(k);
  const format = (c) => (['etikett', 'a4'].includes(q(c, 'format')) ? q(c, 'format') : etikettformatFor(c.db, c.personal.enhet_id));

  // Etiketten för en iordningsställd dos, med streckkoden som bara innehåller kontrollkoden.
  rutt('GET', '/api/patient/:id/administreringar/:aid/etikett', (c, id, aid) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_lakemedel', (atk) => {
      const e = beredning.etikett(atk, aid);
      return { ...e, rader: beredning.etikettRader(e), svg: streckkod.svg(e.kontrollkod), format: format(c) };
    });
  });
  rutt('GET', '/api/patient/:id/administreringar/:aid/etikett.pdf', (c, id, aid) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_lakemedel', (atk) => {
      const e = beredning.etikett(atk, aid);
      return new Response(etikettPdf([{ rader: beredning.etikettRader(e), streck: streckkod.streck(e.kontrollkod) }], { format: format(c), titel: `Etikett ${e.kontrollkod}` }),
        { headers: PDF_HUVUD(`etikett-${e.kontrollkod}.pdf`) });
    });
  });
  // Patientens armband, med journalnumret som streckkod.
  rutt('GET', '/api/patient/:id/armband', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_lakemedel', (atk) => { const a = beredning.armband(atk); return { ...a, svg: streckkod.svg(a.kod) }; });
  });
  rutt('GET', '/api/patient/:id/armband.pdf', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_lakemedel', (atk) => {
      const a = beredning.armband(atk);
      return new Response(etikettPdf([{ rader: [{ text: a.patient.namn, fet: true, storlek: 8 }, { text: a.patient.personnummer, storlek: 7 }, { text: 'Armband, demo' }], streck: streckkod.streck(a.kod) }],
        { format: 'etikett', titel: `Armband ${a.kod}` }), { headers: PDF_HUVUD(`armband-${a.kod}.pdf`) });
    });
  });
  // Patientnära skanning: etiketten och armbandet kontrolleras innan dosen ges.
  rutt('POST', '/api/patient/:id/administreringar/skanna', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => beredning.skanna(atk, c.body)); });
  // Kontrollen av en beredning, av en annan sjuksköterska eller läkare.
  rutt('POST', '/api/patient/:id/beredningar/:bid/kontroll', (c, id, bid) => { kravInloggad(c); return medPatient(c, id, 'ge_lakemedel', (atk) => beredning.kontrollera(atk, bid, c.body)); });

  // Egenadministrering: sjuksköterskan kvitterar patientens intag (egenadministrering.js).
  rutt('POST', '/api/patient/:id/egenintag', (c, id) => {
    kravInloggad(c);
    return [201, medPatient(c, id, 'ge_lakemedel', (atk) => egenadministrering.kvittera(atk, c.body,
      { kravVardande: administrering.kravVardande, synligaOrdinationer: lakemedel.synligaOrdinationer, dostider: administrering.dostider, tillaggUt }))];
  });

  // Beställning av extempore, licens och blodprodukter från simulerade parter (lakemedelsbestallning.js).
  rutt('GET', '/api/patient/:id/lakemedelsbestallningar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_lakemedel', (atk) => bestallning.lista(atk)); });
  rutt('POST', '/api/patient/:id/lakemedelsbestallningar', (c, id) => {
    kravInloggad(c);
    const handling = c.body?.lakemedelId != null && c.body?.ordinationId == null ? 'ordinera' : 'bestalla_lakemedel';
    return [201, medPatient(c, id, handling, (atk) => bestallning.bestall(atk, c.body))];
  });
  rutt('POST', '/api/lakemedelsbestallning/:id/simulera-svar', (c, id) => {
    kravInloggad(c);
    const r = bestallning.hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, r.typ === 'licens' ? 'ordinera' : 'bestalla_lakemedel', (atk) => bestallning.simuleraSvar(atk, r.id));
  });

  // Uppföljningen av läkemedel på vårdgivarens nivå, utan personuppgifter (lakemedelsstatistik.js).
  rutt('GET', '/api/lakemedel/uppfoljning/vardgivare', (c) => { kravInloggad(c); return lakemedelsstatistik.vardgivarniva(c.db, c.personal, { dagar: q(c, 'dagar') ?? 90 }); });

  // Klinisk läkemedelsprövning (kliniskprovning.js): patientens deltagande, inkludering, avslutning och prövarens lista.
  rutt('GET', '/api/patient/:id/provningar', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_oversikt', (atk) => provning.forPatient(atk)); });
  rutt('POST', '/api/patient/:id/provningar', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'ordinera', (atk) => provning.inkludera(atk, c.body))]; });
  rutt('POST', '/api/studiedeltagande/:id/avsluta', (c, id) => {
    kravInloggad(c);
    const d = provning.hamtaDeltagande(c.db, id);
    return medPatient(c, d.patient_id, 'ordinera', (atk) => provning.avsluta(atk, d, c.body));
  });
  rutt('GET', '/api/provningar', (c) => { kravInloggad(c); return provning.forProvare(c.db, c.personal, (pid) => valFor(c.s, pid)); });

  // Förbrukningsartiklar (forbrukning.js): listan med förslag, ny förskrivning, mall, ändring, förnyelse, utsättning
  // och återinsättning.
  rutt('GET', '/api/patient/:id/forbrukning', (c, id) => {
    kravInloggad(c);
    return medPatient(c, id, 'las_lakemedel', (atk) => forbrukning.lista(atk, { grupp: q(c, 'grupp'), sortering: q(c, 'sortering') ?? 'giltighet' }));
  });
  rutt('POST', '/api/patient/:id/forbrukning', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'forskriva_forbrukning', (atk) => forbrukning.forskriv(atk, c.body))]; });
  rutt('POST', '/api/patient/:id/forbrukning/mall', (c, id) => { kravInloggad(c); return [201, medPatient(c, id, 'forskriva_forbrukning', (atk) => forbrukning.forskrivMall(atk, c.body))]; });
  const medForskrivning = (c, id, fn) => {
    kravInloggad(c);
    const r = forbrukning.hamtaRad(c.db, id);
    return medPatient(c, r.patient_id, 'forskriva_forbrukning', (atk) => fn(atk, r));
  };
  rutt('POST', '/api/forbrukning/:id/andra', (c, id) => medForskrivning(c, id, (atk, r) => forbrukning.andra(atk, r.id, c.body)));
  rutt('POST', '/api/forbrukning/:id/fornya', (c, id) => medForskrivning(c, id, (atk, r) => forbrukning.fornya(atk, r.id, c.body)));
  rutt('POST', '/api/forbrukning/:id/utsatt', (c, id) => medForskrivning(c, id, (atk, r) => forbrukning.sattUt(atk, r.id, c.body)));
  rutt('POST', '/api/forbrukning/:id/atersatt', (c, id) => medForskrivning(c, id, (atk, r) => forbrukning.atersatt(atk, r.id, c.body)));
}

// Inkorgen: beredningar på den egna vårdenheten som väntar på kontroll, bara antal och utan patientuppgifter.
export function inkorg(c) {
  const n = c.personal ? beredning.vantarPaKontroll(c.db, c.personal) : 0;
  return { beredningarAttKontrollera: n ? [{ antal: n, text: `${n} ${n === 1 ? 'beredning väntar' : 'beredningar väntar'} på kontroll av en annan sjuksköterska eller läkare.`, lank: '#/administrering' }] : [] };
}
