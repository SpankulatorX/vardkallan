// Runda 12, r1: API för journalens struktur (journalstruktur.js, Sussa 12.1.1.7 och vårt D11). Inget här rör en enskild
// patient, och inga svar innehåller patientuppgifter: förhandsvisningen har bara antal. Behörigheten prövas i modulen,
// och varje ändring loggas med vem som gjorde den.
import * as struktur from './journalstruktur.js';
import * as mallbyggare from './lakemedelsmallbyggare.js';
import * as journal from './journal.js';
import { MATKOD } from './kodverk.js';
import { Fel } from './db.js';

// En förhandsvisning svarar 200 också när något är fel, med förklaringen i fel, så att den kan visas medan man skriver.
const forhand = (fn) => {
  try { return fn(); } catch (e) {
    if (e instanceof Fel && e.status === 400) return { ok: false, fel: [e.message], paverkas: [] };
    throw e;
  }
};

export function registreraRutter({ rutt, kravInloggad }) {
  rutt('GET', '/api/journalstruktur', (c) => struktur.oversikt(c.db, kravInloggad(c)));
  rutt('POST', '/api/journalstruktur/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(() => struktur.forhandsvisa(c.db, p, c.body)); });
  rutt('POST', '/api/journalstruktur', (c) => [201, struktur.foresla(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/journalstruktur/:id/godkann', (c, id) => struktur.godkann(c.db, kravInloggad(c), id, c.body));
  rutt('POST', '/api/journalstruktur/:id/avsluta', (c, id) => struktur.avsluta(c.db, kravInloggad(c), id, c.body));
  // Mätvärdestyperna som går att registrera, de inbyggda och de som systemförvaltningen har skapat. Inga patientuppgifter.
  rutt('GET', '/api/mattyper', (c) => {
    kravInloggad(c);
    const inb = Object.entries(journal.MATTYPER).map(([id, m]) => ({ id, namn: m.namn, enhet: m.enhet ?? '', format: m.format ?? null, min: m.min ?? null, max: m.max ?? null, kod: MATKOD[id]?.coding?.[0]?.code ?? null }));
    const egna = Object.entries(struktur.mattyper(c.db)).map(([id, m]) => ({ id, namn: m.namn, enhet: m.enhet, format: null, min: m.min, max: m.max, heltal: m.heltal, kod: m.kod.coding[0].code, egen: true }));
    return { mattyper: [...inb, ...egna] };
  });
  // Läkemedelsmallar som läkaren bygger och ändrar (lakemedelsmallbyggare.js). Godkännandet görs som förut i den
  // mallansvarigas inkorg (POST /api/lakemedelsmallar/godkann).
  rutt('GET', '/api/lakemedelsmallar/byggstenar', (c) => mallbyggare.byggstenar(c.db, kravInloggad(c)));
  rutt('POST', '/api/lakemedelsmallar/forhandsvisa', (c) => { const p = kravInloggad(c); return forhand(() => mallbyggare.forhandsvisa(c.db, p, c.body)); });
  rutt('POST', '/api/lakemedelsmallar/ny', (c) => [201, mallbyggare.skapa(c.db, kravInloggad(c), c.body)]);
  rutt('POST', '/api/lakemedelsmallar/:atc/andra', (c, atc) => [201, mallbyggare.andra(c.db, kravInloggad(c), atc, c.body)]);
}
