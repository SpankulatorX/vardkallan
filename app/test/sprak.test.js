// Språkkontrollen av gränssnittet (Sussa 2.7.1.3): alla texter som visas för användaren, i public/ och i serverns
// felmeddelanden och varningar, är på svenska. Reglerna och listorna över tillåtna lånord står i sprakkontroll.js.
import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gransnittTexter, serverTexter, prova, strangar, synligHtml, arText } from './sprakkontroll.js';

const APP = join(import.meta.dir, '..');
const lista = (fel) => fel.map(f => `${f.fil}:${f.rad} ${f.regel}: ${f.ord} i "${f.text.replace(/\s+/g, ' ').trim()}"`);
const pröva = (text) => prova([{ fil: 'x', rad: 1, text }]).map(f => f.regel);

describe('Språk', () => {
  test('gränssnittets texter är svenska, utan engelska ord, tankstreck, ellipser och interna anteckningar', () => {
    const texter = gransnittTexter(APP);
    expect(texter.length).toBeGreaterThan(1500);
    expect(lista(prova(texter))).toEqual([]);
  });

  test('serverns felmeddelanden och varningar är svenska', () => {
    const texter = serverTexter(APP);
    expect(texter.length).toBeGreaterThan(800);
    // Kontrollen når felmeddelandena: ett känt meddelande från servern finns bland texterna.
    expect(texter.some(t => t.text === 'Okänd FHIR-resurs.')).toBe(true);
    expect(lista(prova(texter))).toEqual([]);
  });

  test('inga tankstreck, ellipser eller interna anteckningar någonstans i public/ och src/, inte heller i kommentarer', () => {
    const filer = (rot) => readdirSync(rot).flatMap(f => { const p = join(rot, f); return statSync(p).isDirectory() ? filer(p) : /\.(js|html|css|json)$/.test(p) ? [p] : []; });
    const traffar = [];
    for (const f of [...filer(join(APP, 'public')), ...filer(join(APP, 'src'))]) {
      readFileSync(f, 'utf8').split('\n').forEach((rad, i) => { if (/[—–…]|\b(TODO|FIXME)\b/.test(rad)) traffar.push(`${relative(APP, f)}:${i + 1}`); });
    }
    expect(traffar).toEqual([]);
  });

  test('kontrollen hittar engelska ord, okända förkortningar, tankstreck, ellipser och interna anteckningar', () => {
    expect(pröva('Save changes')).toContain('engelska');
    expect(pröva('Patienten är inskriven. Loading')).toContain('engelska');
    expect(pröva('Det blev undefined')).toContain('engelska');
    expect(pröva('Svarstider per endpoint')).toContain('engelska');
    // Lånord som skrivs på svenska (beslut 2026-11-03): inget svar i tid, uppkopplad, syremättnad och tomt.
    expect(pröva('NLL gav timeout')).toContain('engelska');
    expect(pröva('När webbläsaren är online')).toContain('engelska');
    expect(pröva('Saturation 95 procent')).toContain('engelska');
    expect(pröva('Fältet är null när värdet saknas')).toContain('engelska');
    expect(pröva('Datum, eller null')).toContain('engelska');
    expect(pröva('Datum i svensk tid, eller "null" om kontakten pågår.')).toContain('engelska');
    expect(pröva('NLL svarade inte i tid. Webbläsaren är uppkopplad. Syremättnad 95 procent. Fältet är tomt när värdet saknas.')).toEqual([]);
    expect(pröva('Skicka till XYZ')).toContain('okänd förkortning');
    expect(pröva('Patienten är inskriven — avdelning 72')).toContain('tankstreck');
    expect(pröva('Från 08.00 – 16.00')).toContain('tankstreck');
    expect(pröva('Hämtar…')).toContain('ellips');
    expect(pröva('Hämtar...')).toContain('ellips');
    expect(pröva('TODO: byt text')).toContain('intern anteckning');
    expect(pröva('Tänk på att inte peka ut någon.')).toContain('intern anteckning');
    // Tillåtna lånord, förkortningar och egennamn, och kodvärden inom citattecken.
    expect(pröva('Läkemedlet har ATC-kod och NPL-id, och kan läsas i FHIR som MedicationRequest.')).toEqual([]);
    expect(pröva('Logga in med SITHS-kort. Uppgifterna finns i NPÖ.')).toEqual([]);
    expect(pröva('Kontaktsätt: "besok" eller "hembesok".')).toEqual([]);
  });

  test('kontrollen hittar å, ä och ö som saknas', () => {
    expect(pröva('Patienten ar inskriven')).toContain('å, ä och ö');
    expect(pröva('Valj nagon i listan')).toContain('å, ä och ö');
    expect(pröva('Ingen lakare pa enheten')).toContain('å, ä och ö');
    // Ett ord som finns med prickar någon annanstans räknas också, till exempel Incheckningsskarmen bredvid Incheckningsskärmen.
    const fel = prova([{ fil: 'a', rad: 1, text: 'Incheckningsskärmen' }, { fil: 'b', rad: 2, text: 'Öppna Incheckningsskarmen' }]);
    expect(fel.map(f => `${f.fil} ${f.ord}`)).toEqual(['b Incheckningsskarmen (Incheckningsskärmen)']);
    // Ord som är riktiga med och utan prickar.
    expect(pröva('Andra svar och val visas här')).toEqual([]);
  });

  test('texterna hämtas ur strängar, mallsträngar, HTML och felmeddelanden, men inte ur kod', () => {
    const kod = 'const a = `<button class="knapp liten" title="Visa mer">Spara ${namn} nu</button>`;\n'
      + "throw new Fel(400, 'Patient not found.', 'saknas');\n"
      + "const sel = '#vl-lista'; const re = /it's/; const sql = 'SELECT * FROM patienter WHERE id = ?';\n"
      + "// Kommentar med 'citat' som inte är en sträng\nconst t = `Väntar ${x ? `på ${y} i rummet` : ''} i dag`;";
    const s = strangar(kod).map(x => x.text);
    expect(s).toContain("Patient not found.");
    expect(s).not.toContain('citat');
    const synliga = s.flatMap(t => (/<[a-z]/.test(t) ? synligHtml(t) : [t])).filter(arText).map(t => t.replace(/\s+/g, ' ').replace(/\u0001/g, '·').trim());
    expect(synliga).toContain('Spara · nu');
    expect(synliga).toContain('Visa mer');
    expect(synliga).toContain('Patient not found.');
    expect(synliga).toContain('på · i rummet');
    expect(synliga.some(t => t.includes('knapp liten'))).toBe(false);
    expect(synliga).not.toContain('#vl-lista');
    expect(synliga.some(t => t.startsWith('SELECT'))).toBe(false);
    expect(prova(synliga.map(text => ({ fil: 'x', rad: 1, text }))).map(f => f.ord)).toContain('not');
  });
});
