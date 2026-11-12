// Runda 14, r2: loggen över anrop med tjänstekontrakt, in till Vårdkällans producenter och ut till andra tjänster.
// En rad har kontraktet, riktningen, den andra organisationen, den logiska adressen och resultatet, men aldrig
// patientuppgifter: ett personnummer eller samordningsnummer i en feltext byts ut innan raden sparas. Åtkomsten till
// patientuppgifter loggas för sig på patienten i åtkomstloggen.
export function sakraSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS rivta_anrop (
    id INTEGER PRIMARY KEY, tid TEXT NOT NULL, riktning TEXT NOT NULL, kontrakt TEXT, version TEXT, organisation TEXT,
    logisk_adress TEXT, via TEXT, resultat TEXT NOT NULL, text TEXT)`);
}

const PNR = /(?<!\d)(?:\d{2})?\d{6}[-+]?\d{4}(?!\d)/g;
export const utanPersonnummer = (t) => (t == null ? null : String(t).replace(PNR, '[personnummer]').slice(0, 500));

export function loggaAnrop(db, { riktning, kontrakt, version, organisation, logiskAdress, via, resultat, text, tid }) {
  sakraSchema(db);
  db.query('INSERT INTO rivta_anrop (tid, riktning, kontrakt, version, organisation, logisk_adress, via, resultat, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(tid ?? new Date().toISOString(), riktning, kontrakt ?? null, version ?? null, organisation ?? null, logiskAdress ?? null, via ?? null, resultat ?? 'fel', utanPersonnummer(text));
}

export function anrop(db, { max = 50 } = {}) {
  sakraSchema(db);
  return db.query('SELECT * FROM rivta_anrop ORDER BY id DESC LIMIT ?').all(max);
}
