// Runda 14, r5: driftdokumenten i docs/drift/ (driftdokument.js). Dokumenten skrivs ur registret i src/ med
// scripts/dokument-md.js. I Docker-bygget finns bara app/, och då prövas texten som skrivs.
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DOKUMENT, FORKORTNINGAR, dokumentFiler, sussaId, filer, kodDelar, markdown } from '../src/driftdokument.js';
import { SPEC, MAPPNING } from '../src/sussa/index.js';
import { prova } from './sprakkontroll.js';

const APP = join(import.meta.dir, '..');
const ROT = join(APP, '..');
const DOCS = join(ROT, 'docs');
const KATALOG = join(DOCS, 'drift');
const finnsDocs = existsSync(DOCS);
const poster = new Set(SPEC.poster.map(p => p.id));
const mappade = new Set(MAPPNING.map(m => m.id));
const dok = (fil) => DOKUMENT.find(d => d.fil === fil);

// Text för språkkontrollen: det inom «» är kod, en länk är en adress, och engelska termer står inom parentes efter den
// svenska. Tankstreck, ellipser och interna anteckningar prövas i hela texten.
const tvatta = (text) => text.replace(/«[^»\n]*»/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/\([^()\n]*\)/g, ' ').replace(/`[^`\n]*`/g, ' ');
const stycken = (namn, md) => md.split(/\n\s*\n/).map((text, i) => ({ fil: namn, rad: i + 1, text: tvatta(text) }));

describe('Driftdokument', () => {
  test('varje Sussa-id som ett dokument i docs/drift/ hänvisar till finns i Sussa-registret, och varje krav som dokumentet gäller står i texten', () => {
    expect(DOKUMENT.length).toBeGreaterThanOrEqual(15);
    const saknas = [];
    for (const d of DOKUMENT) {
      expect(d.sussa.length, d.fil).toBeGreaterThan(0);
      for (const id of [...d.sussa, ...sussaId(d.text)]) if (!poster.has(id) || !mappade.has(id)) saknas.push(`${d.fil}: ${id}`);
      for (const id of d.sussa) if (!sussaId(d.text).includes(id)) saknas.push(`${d.fil}: ${id} står inte i texten`);
    }
    expect(saknas).toEqual([]);
    // Alla id i hela katalogen, också innehållsförteckningen.
    for (const [namn, md] of dokumentFiler()) for (const id of sussaId(md)) expect(poster.has(id), `${namn}: ${id}`).toBe(true);
  });

  test('varje fil som dokumenten hänvisar till finns i repot', () => {
    const saknas = [];
    for (const d of DOKUMENT) {
      for (const f of filer(d.text)) {
        // I Docker-bygget finns bara app/. Hänvisningar till docs/ prövas när repot är monterat.
        if (f.startsWith('docs/') && !finnsDocs) continue;
        if (!existsSync(join(ROT, f))) saknas.push(`${d.fil}: ${f}`);
      }
    }
    expect(saknas).toEqual([]);
  });

  test('dokumenten följer språkreglerna: svenska, inga tankstreck, ellipser eller interna anteckningar, och varje förkortning är förklarad', () => {
    const texter = dokumentFiler().flatMap(([namn, md]) => stycken(namn, md));
    const fel = prova(texter).filter(f => !(f.regel === 'okänd förkortning' && Object.hasOwn(FORKORTNINGAR, f.ord)));
    expect(fel.map(f => `${f.fil} stycke ${f.rad} ${f.regel}: ${f.ord} i "${f.text.replace(/\s+/g, ' ').trim()}"`)).toEqual([]);
    for (const [namn, md] of dokumentFiler()) {
      expect(/[—–…]|\.\.\.(?!\w)/.test(md), `${namn} har tankstreck eller ellips`).toBe(false);
      expect(/\b(TODO|FIXME)\b|[Tt]änk på att|[Kk]om ihåg att|[Gg]löm inte|[Ss]äg inte/.test(md), `${namn} har en intern anteckning`).toBe(false);
    }
    for (const d of DOKUMENT) expect(d.text.includes('`'), `${d.fil} har backticks`).toBe(false);
    for (const [f, text] of Object.entries(FORKORTNINGAR)) expect(text.length, f).toBeGreaterThan(10);
  });

  test('varje dokument har avsnitten om det systemet har som stöd och det som ska fyllas i, med platshållare', () => {
    for (const d of DOKUMENT) {
      expect(d.text.startsWith('# '), d.fil).toBe(false);
      expect(d.text, d.fil).toContain('## Det systemet redan har som stöd');
      expect(d.text, d.fil).toContain('## Att fylla i för den som driver systemet');
      expect(d.text, d.fil).toMatch(/\[fyll i: [^\]]+\]/);
      expect(d.sammanfattning.length, d.fil).toBeGreaterThan(20);
      // Varje dokument hänvisar till minst en fil i koden.
      expect(filer(d.text).some(f => f.startsWith('app/')), d.fil).toBe(true);
      const md = markdown(d);
      expect(md.startsWith(`# ${d.rubrik}\n`)).toBe(true);
      expect(md).toContain('Ett dokument gör inte att ett åtagande är uppfyllt');
    }
    expect(new Set(DOKUMENT.map(d => d.fil)).size).toBe(DOKUMENT.length);
  });

  test('dokumenten beskriver den publika demons drift inte alls, bara det som gäller för den som driver systemet', () => {
    for (const [namn, md] of dokumentFiler()) {
      expect(md, namn).not.toMatch(/404haven|darkstar|cloudflare|hetzner|tailscale|mullvad|ovpn|\bvps\b/i);
    }
  });

  test('filerna i docs/drift/ är exakt det som skrivs, och inga andra filer finns där', () => {
    const ut = dokumentFiler();
    if (!existsSync(KATALOG)) return;
    expect(readdirSync(KATALOG).sort()).toEqual(ut.map(([n]) => n).sort());
    for (const [namn, md] of ut) expect(readFileSync(join(KATALOG, namn), 'utf8'), namn).toBe(md);
  });

  // Innehållet som kraven frågar efter. Varje dokument har avsnitten som motsvarar kravets delar.
  const har = (fil, rubriker) => { const d = dok(fil); expect(d, fil).toBeDefined(); for (const r of rubriker) expect(d.text, `${fil}: ${r}`).toContain(r); return d; };

  test('processhandboken beskriver incident-, problem-, ändrings-, release- och beställningshantering med roller, prioritetsmodell, större incidenter och uppföljningsmöten, övriga processer och hur ITIL v3/2011 motsvarar ITIL 4', () => {
    const d = har('processhandbok.md', ['## Roller', '## Prioritetsmodell', '## Incidenthantering', '### Större incident', '### Incidentuppföljningsmöte', '## Problemhantering',
      '## Ändringshantering', '## Releasehantering', '## Beställningshantering', '## Övriga processer', '## ITIL v3/2011 och ITIL 4', '## Så hålls handboken uppdaterad']);
    // Prioritetsmodellen och gränsvärdena är desamma som systemet räknar med.
    for (const t of ['Kritisk', 'Hög', 'Medel', 'Låg', '2 timmar']) expect(d.text).toContain(t);
  });

  test('servicenivådokumentet har regler och anvisningar, mall för servicenivåavtal och månadsrapport, hur referensnivån för svarstider tas fram och uppföljningsmöten', () => {
    const d = har('servicenivaer.md', ['## Mall för servicenivåavtal', '## Mall för månadsrapporten', '## Referensnivå för svarstider', '## Uppföljningsmöten']);
    for (const t of ['«GET /api/servicenivaer/rapport', 'p95', 'CPE']) expect(d.text).toContain(t);
  });

  test('rutinen för incidentrapportering har förslaget till anvisning, vem som gör vad och vad exporten till beställaren innehåller', () => {
    const d = har('incidentrapportering.md', ['## Förslag till anvisning', '## Vem gör vad', '## Exporten']);
    for (const t of ['30 minuter', '72 timmar', '«POST /api/servicenivaer/export»']) expect(d.text).toContain(t);
  });

  test('kontinuitetsplanen beskriver tillgången till informationen vid avbrott, systemet när integrerade system inte svarar, riskanalys, scenarier, roller och övning', () => {
    har('kontinuitetsplan.md', ['## Det som skyddar informationen när servern inte svarar', '## Systemet när integrerade system inte svarar', '## Riskanalys', '## Scenarier och åtgärder', '## Roller', '## Övning av planen']);
  });

  test('återställningsplanen har mål, säkerhetskopiering, återställning till en tidpunkt, provåterläsning och haveri av hela servern', () => {
    har('aterstallning.md', ['## Mål för återställningen', '## Säkerhetskopieringen i systemet', '## Återställning till en tidpunkt', '## Provåterläsning', '## Haveri av hela servern']);
  });

  test('dokumentet om säkerhetsuppdateringar beskriver vad som uppdateras och hur, planerat underhåll och CE-märkningen', () => {
    har('sakerhetsuppdateringar.md', ['## Vad som behöver uppdateras', '## Så görs en säkerhetsuppdatering', '## Planerat underhåll med så lite avbrott som möjligt', '## CE-märkningen']);
  });

  test('supportdokumentet har ansvarsfördelning, nivåer, kanaler, servicenivåer, språk och ärendehantering', () => {
    har('support.md', ['## Ansvarsfördelning', '## Nivåer', '## Kanaler', '## Servicenivåer för support', '## Språk och kunskap', '## Ärendehantering']);
  });

  test('samverkansmodellen har en ansvarig för helheten, organisation på strategisk, taktisk och operativ nivå, forum, roller och förändringsarbete i samarbete', () => {
    const d = har('samverkansmodell.md', ['## Ansvarig för helheten', '## Organisation', '## Forum', '## Roller, processer och verktyg', '## Förändringsarbete i samarbete']);
    for (const t of ['strategisk', 'taktisk', 'operativ']) expect(d.text.toLowerCase()).toContain(t);
  });

  test('dokumentet om skadlig kod och intrång beskriver hur systemet förhindrar och upptäcker, det systemet inte gör och plan för åtgärd', () => {
    har('skydd-mot-skadlig-kod-och-intrang.md', ['### Förhindra', '### Upptäcka', '### Det systemet inte gör', '### Plan för åtgärd']);
  });

  test('dokumentet om åtkomst för drift och support beskriver behörighet i systemet, tilldelning och uppföljning, segmentering, direktåtkomst och nödåtkomst', () => {
    har('atkomst-for-drift-och-support.md', ['### Behörighet i applikationen', '### Tilldelning, uppföljning och borttagning', '### Segmentering och separering', '### Direktåtkomst till server och databas', '### Nödåtkomst för drift']);
  });

  test('dokumentet om kryptering anger systemets algoritmer, och varje algoritm som står där finns i koden', () => {
    har('kryptering.md', ['### Signering och integritet', '### Kryptering vid lagring', '### Det systemet inte gör', '### Trafiken', '### Nyckelhantering']);
    const kod = (f) => readFileSync(join(APP, f), 'utf8');
    for (const [f, re] of [['src/pki.js', /P-256|prime256v1/], ['src/idp.js', /ES256/], ['src/anteckningssignatur.js', /ed25519/i], ['src/flerfaktor.js', /aes-256-gcm/i],
      ['public/js/reservkopia.js', /PBKDF2[\s\S]*600_000|600_000[\s\S]*PBKDF2/], ['public/js/lasekopia.js', /AES-GCM/], ['src/server.js', /Uint8Array\(24\)/], ['src/sakerhetslogg.js', /sha256/]]) {
      expect(re.test(kod(f)), `${f} ${re}`).toBe(true);
    }
  });

  test('dokumentet om klienter beskriver klienter, insticksprogram, tredjepartsprodukter, uppdatering och eKlient, och klienten laddar inga externa skript', () => {
    har('klienter.md', ['### Klienter som stöds', '### Inga insticksprogram och ingen klientvirtualisering', '### Tredjepartsprodukter i klienten', '### Uppdatering av klienten', '## Följsamhet mot eKlient']);
    const html = readFileSync(join(APP, 'public', 'index.html'), 'utf8');
    expect([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).every(s => !/^(https?:)?\/\//.test(s))).toBe(true);
    expect(readFileSync(join(APP, 'src', 'server.js'), 'utf8')).toContain("default-src 'self'");
  });

  test('införandedokumentet har mall för projektplan, utbildningsplan, test fram till acceptanstest och planer för specialområden', () => {
    har('inforande.md', ['### Projektplan för grundimplementationen', '### Utbildningsplan för grundimplementationen', '### Test fram till acceptanstest', '### Planer för specialområden']);
  });
});
