// Runda 13, r1: testinbjudan på servern. Skapar och återkallar läskoder för testledarens vy (#/testledare) och skriver
// ut nya synpunkter och jämförelser som Markdown. Körs i containern, där databasen ligger bredvid sandlådorna:
//
//   docker exec vardkallan bun scripts/testinbjudan.js ny-laskod [namn]   en ny läskod, som visas en gång
//   docker exec vardkallan bun scripts/testinbjudan.js laskoder           läskoderna, utan koderna själva
//   docker exec vardkallan bun scripts/testinbjudan.js aterkalla <id>     återkallar en läskod
//   docker exec vardkallan bun scripts/testinbjudan.js nya                det som har kommit sedan förra gången
//   docker exec vardkallan bun scripts/testinbjudan.js alla               allt som Markdown, utan att markera något
//
// Databasen är SYNPUNKT_FIL, annars synpunkter.sqlite bredvid SESSION_FIL. Läskoden sparas bara som sha256.
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import * as sp from '../src/synpunkter.js';
import { namnFor } from '../src/testinbjudan.js';

const fil = process.env.SYNPUNKT_FIL || (process.env.SESSION_FIL ? join(dirname(process.env.SESSION_FIL), 'synpunkter.sqlite') : null);
const [kommando, arg] = process.argv.slice(2);
if (!fil) { console.error('Ange SYNPUNKT_FIL eller SESSION_FIL, så att skriptet hittar databasen med synpunkterna.'); process.exit(2); }
if (!existsSync(fil) && kommando !== 'ny-laskod') { console.error(`Databasen ${fil} finns inte än. Den skapas när servern startar.`); process.exit(2); }
const db = sp.oppna(fil);
try {
  if (kommando === 'ny-laskod') {
    const { id, kod } = sp.skapaLaskod(db, { namn: arg || 'testledare' });
    console.log(`Läskod ${id} (${arg || 'testledare'}). Den visas bara nu och sparas bara som hash:\n\n${kod}\n\nÖppna #/testledare i demon och skriv in koden.`);
  } else if (kommando === 'laskoder') {
    for (const k of sp.laskoder(db)) console.log(`${k.id}\t${k.namn}\tskapad ${k.skapad}${k.aterkallad ? `\tåterkallad ${k.aterkallad}` : ''}`);
  } else if (kommando === 'aterkalla') {
    console.log(sp.aterkallaLaskod(db, arg) ? `Läskod ${arg} är återkallad.` : `Ingen aktiv läskod med id ${arg}.`);
  } else if (kommando === 'nya' || kommando === 'alla') {
    if (kommando === 'alla') process.stdout.write(sp.exportera(db, { format: 'md', namnFor }).text);
    else process.stdout.write(sp.nyaSomMarkdown(db, { namnFor }).text);
  } else {
    console.error('Användning: bun scripts/testinbjudan.js ny-laskod [namn] | laskoder | aterkalla <id> | nya | alla');
    process.exitCode = 2;
  }
} finally { db.close(); }
