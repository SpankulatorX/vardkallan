// Runda 8, r5: mallen för tobaks- och nikotinvanor (Sussa testfall 4.1). Gemensam för gränssnittet (vyer/patient-tobak.js)
// och servern (src/tobak.js), så att förslaget, texten och kontrollen blir desamma överallt. Servern räknar alltid om allt
// och litar aldrig på det som gränssnittet har räknat.
//
// Frågorna och svarsalternativen är de nationella: Vägledning för enhetlig dokumentation av en persons levnadsvanor,
// version 3 (2026-01-14), Nationellt system för kunskapsstyrning hälso- och sjukvård, med Socialstyrelsen adjungerad.
// Nivå 1 är frågan om patienten över huvud taget använder tobak eller nikotin, nivå 2 användningen per produkt med
// antal. Koderna för produkterna och användningen är ur Struktur och kodning för svar på frågor om en persons
// levnadsvanor, version 1.2 (2025-12-15), Snomed CT i svensk version.
//
// Förslaget på åtgärd följer Socialstyrelsens nationella riktlinjer 2024, Vård vid ohälsosamma levnadsvanor,
// prioriteringsstöd (artikelnummer 2024-11-9272), avsnittet Tobaks- och nikotinbruk, och åtgärdskoderna är KVÅ 2026.
// Systemet är experten: det räknar själv ut att patienten använder tobak när en produkt är ifylld, vet patientens ålder
// och föreslår åtgärden och koden ur svaren. Den som dokumenterar behöver inte kunna riktlinjerna eller KVÅ.

export const KALLA = {
  fragor: 'Vägledning för enhetlig dokumentation av en persons levnadsvanor, version 3 (2026-01-14), Nationellt system för kunskapsstyrning hälso- och sjukvård',
  koder: 'Struktur och kodning för svar på frågor om en persons levnadsvanor, version 1.2 (2025-12-15), Nationellt system för kunskapsstyrning hälso- och sjukvård',
  riktlinjer: 'Socialstyrelsen, Nationella riktlinjer 2024, Vård vid ohälsosamma levnadsvanor, prioriteringsstöd (2024-11-9272), Tobaks- och nikotinbruk',
  kva: 'KVÅ 2026, E-hälsomyndigheten',
};

// Nivå 1: använder patienten, eller har patienten använt, tobak eller nikotin?
export const ANVANDER = [
  ['nej', 'Nej'],
  ['slutat', 'Har slutat för mer än 6 månader sedan'],
  ['ja', 'Ja, använder nu eller har slutat för mindre än 6 månader sedan'],
];

// Nivå 2: produkterna med enheten för antal per bruk. snomed är koden för produkten. fler visas under Fler produkter.
export const PRODUKTER = [
  { id: 'cigaretter', namn: 'Cigaretter', snomed: '66562002', snomedText: 'cigarettobak', rok: true, dagligen: 'per dag', ibland: 'per månad', sort: 'cigaretter' },
  { id: 'tobakssnus', namn: 'Tobakssnus', snomed: '39789004', snomedText: 'snustobak', snus: true, dagligen: 'dosor per vecka', ibland: 'dosor per månad', sort: 'dosor' },
  { id: 'nikotinsnus', namn: 'Nikotinsnus', snomed: '598111000005109', snomedText: 'nikotinsnus', snus: true, dagligen: 'dosor per vecka', ibland: 'dosor per månad', sort: 'dosor' },
  { id: 'ecigaretter', namn: 'E-cigaretter', snomed: '722498003', snomedText: 'elektronisk cigarett', dagligen: 'gånger per dag', ibland: 'gånger per månad', sort: 'gånger' },
  { id: 'vattenpipa', namn: 'Vattenpipa', snomed: '722495000', snomedText: 'vattenpipa', rok: true, dagligen: 'sessioner per dag', ibland: 'sessioner per månad', sort: 'sessioner', fler: true },
  { id: 'nikotinlakemedel', namn: 'Nikotinläkemedel (tuggummi, plåster med mera)', snomed: '323283001', snomedText: 'läkemedel som innehåller nikotin', utanAntal: true, fler: true },
  { id: 'andra', namn: 'Andra tobaks- eller nikotinprodukter', snomed: null, utanAntal: true, vad: true, fler: true },
];
export const PRODUKT = Object.fromEntries(PRODUKTER.map(p => [p.id, p]));

export const BRUK = [['dagligen', 'Dagligen'], ['ibland', 'Ibland'], ['slutat', 'Slutat senaste 6 månaderna']];
// Användningen i Snomed CT (tabell 2 i Struktur och kodning).
export const ANVANDNING_SNOMED = {
  aldrig: { kod: '273851000052101', text: 'har aldrig varit användare av nikotinprodukt' },
  fore_detta: { kod: '194251000052109', text: 'före detta användare av nikotinprodukt' },
  dagligen: { kod: '273861000052103', text: 'dagliganvändare av nikotinprodukt' },
  ibland: { kod: '273871000052107', text: 'sällananvändare av nikotinprodukt' },
};

// Stödet som föreslås. KVÅ 2026, titlarna ordagrant (kodverk.js har samma, testat).
export const KVA_TOBAK = {
  DV111: 'Enkla råd om tobaks- och nikotinbruk',
  DV112: 'Rådgivande samtal om tobaks- och nikotinbruk',
  DV113: 'Kvalificerat rådgivande samtal om tobaks- och nikotinbruk',
};

export const STOD = [['accepterat', 'Erbjudet och accepterat'], ['avbojt', 'Erbjudet men avböjt'], ['ej_erbjudet', 'Inte erbjudet nu']];
const STOD_TEXT = { accepterat: 'erbjudet och accepterat', avbojt: 'erbjudet men avböjt', ej_erbjudet: 'inte erbjudet vid besöket' };
export const KOMMENTAR_MAX = 2000;
const ANTAL_MAX = 500;

const versal = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Kontrollerar svaren och ger { ok, varde } eller { ok: false, varfor, falt }. varde är svaren i den form som sparas,
// där systemet själv har satt nivå 1 när en produkt är ifylld. idag är dagens datum (ÅÅÅÅ-MM-DD) för slutdatumen och
// alder patientens ålder i år, som systemet räknar ur personnumret.
export function prova(svar, { idag = null, alder = null } = {}) {
  const fel = (varfor, falt) => ({ ok: false, varfor, falt });
  if (!svar || typeof svar !== 'object' || Array.isArray(svar)) return fel('Fyll i tobaksvanorna.', 'anvander');
  const produkter = {};
  const inmatat = svar.produkter && typeof svar.produkter === 'object' && !Array.isArray(svar.produkter) ? svar.produkter : {};
  for (const [id, v] of Object.entries(inmatat)) {
    const p = PRODUKT[id];
    if (!p) return fel('Okänd produkt.', 'produkter');
    if (!v || !v.bruk) continue;
    if (!BRUK.some(([b]) => b === v.bruk)) return fel(`Välj dagligen, ibland eller slutat för ${p.namn.toLowerCase()}.`, `produkter.${id}`);
    const rad = { bruk: v.bruk };
    if (v.bruk !== 'slutat' && !p.utanAntal && v.antal != null && v.antal !== '') {
      const n = Number(String(v.antal).trim().replace(',', '.'));
      if (!Number.isInteger(n) || n < 1 || n > ANTAL_MAX) return fel(`Antalet för ${p.namn.toLowerCase()} ska vara ett heltal mellan 1 och ${ANTAL_MAX} ${v.bruk === 'dagligen' ? p.dagligen : p.ibland}.`, `produkter.${id}.antal`);
      rad.antal = n;
    }
    if (v.bruk === 'slutat' && v.slutdatum) {
      if (typeof v.slutdatum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.slutdatum) || Number.isNaN(Date.parse(v.slutdatum))) return fel('Skriv slutdatumet som ÅÅÅÅ-MM-DD.', `produkter.${id}.slutdatum`);
      if (idag && v.slutdatum > idag) return fel('Slutdatumet kan inte ligga i framtiden.', `produkter.${id}.slutdatum`);
      rad.slutdatum = v.slutdatum;
    }
    if (p.vad) {
      const vad = typeof v.vad === 'string' ? v.vad.trim() : '';
      if (!vad) return fel('Skriv vilken produkt det är, till exempel cigarr eller pipa.', `produkter.${id}.vad`);
      if (vad.length > 100) return fel('Produkten får vara högst 100 tecken.', `produkter.${id}.vad`);
      rad.vad = vad;
    }
    produkter[id] = rad;
  }
  // Systemet sätter nivå 1 själv när en produkt är ifylld.
  let anvander = Object.keys(produkter).length ? 'ja' : svar.anvander;
  if (!ANVANDER.some(([a]) => a === anvander)) return fel('Svara på om patienten använder tobak eller nikotin.', 'anvander');
  if (svar.anvander && svar.anvander !== 'ja' && Object.keys(produkter).length) return fel('Du har svarat att patienten inte använder tobak eller nikotin, men fyllt i en produkt. Ta bort produkten eller ändra svaret.', 'anvander');
  if (anvander === 'ja' && !Object.keys(produkter).length) return fel('Fyll i vilken produkt patienten använder eller nyligen har slutat med.', 'produkter');
  const f = forslag({ anvander, produkter }, { alder });
  const stod = svar.stod ?? null;
  if (f.kod) {
    if (!STOD.some(([s]) => s === stod)) return fel('Ange om stödet erbjöds och om patienten tackade ja. Socialstyrelsen följer upp hur många som får stöd.', 'stod');
  } else if (stod != null && stod !== '') return fel('Systemet föreslår inget stöd för de här svaren, så det finns inget att erbjuda.', 'stod');
  const givet = Boolean(svar.givet);
  if (givet && stod !== 'accepterat') return fel('Ett samtal kan bara ha hållits om patienten tackade ja till stödet.', 'givet');
  const kommentar = typeof svar.kommentar === 'string' ? svar.kommentar.trim() : '';
  if (kommentar.length > KOMMENTAR_MAX) return fel(`Kommentaren får vara högst ${KOMMENTAR_MAX} tecken.`, 'kommentar');
  return { ok: true, varde: { anvander, produkter, stod: f.kod ? stod : null, givet: f.kod ? givet : false, kommentar } };
}

// Förslaget ur svaren och patientens ålder. Ger { kod, atgard, motivering } eller { kod: null, motivering }.
export function forslag({ anvander, produkter = {} }, { alder = null } = {}) {
  const kalla = KALLA.riktlinjer;
  if (anvander !== 'ja') return { kod: null, motivering: anvander === 'slutat' ? 'Patienten slutade för mer än sex månader sedan. Inget stöd behövs nu.' : 'Patienten använder inte tobak eller nikotin. Inget stöd behövs.', kalla };
  const lista = Object.entries(produkter).map(([id, v]) => ({ ...PRODUKT[id], ...v }));
  const nu = lista.filter(p => p.bruk !== 'slutat');
  if (!nu.length) return { kod: null, motivering: 'Patienten har slutat under de senaste sex månaderna. Följ upp vid nästa besök att patienten fortfarande avstår.', kalla };
  const ung = typeof alder === 'number' && alder < 18;
  const roker = nu.filter(p => p.rok);
  const snusar = nu.filter(p => p.snus);
  if (ung && (roker.length || snusar.length)) {
    return { kod: 'DV113', atgard: KVA_TOBAK.DV113, kalla, motivering: 'Socialstyrelsen rekommenderar kvalificerat rådgivande samtal till unga under 18 år som röker eller snusar, oavsett mängd.' };
  }
  if (roker.some(p => p.bruk === 'dagligen')) {
    return { kod: 'DV113', atgard: KVA_TOBAK.DV113, kalla, motivering: 'Socialstyrelsen rekommenderar stöd till vuxna som röker dagligen, i första hand kvalificerat rådgivande samtal. Nikotinläkemedel eller receptbelagda läkemedel kan läggas till vid behov.' };
  }
  if (snusar.some(p => p.bruk === 'dagligen')) {
    return { kod: 'DV112', atgard: KVA_TOBAK.DV112, kalla, motivering: 'Socialstyrelsen rekommenderar rådgivande samtal till vuxna som snusar dagligen.' };
  }
  if (roker.length || snusar.length) {
    return { kod: 'DV111', atgard: KVA_TOBAK.DV111, kalla, demoregel: true, motivering: 'Riktlinjerna för vuxna gäller daglig rökning och daglig snusning. När bruket inte är dagligt föreslår systemet enkla råd (demoregel).' };
  }
  return { kod: null, kalla, motivering: 'Riktlinjerna har ingen rekommendation för de här produkterna. Systemet föreslår inget stöd, men du kan skriva vad som sades i kommentaren.' };
}

// Användningen per produkt på vanlig svenska, till exempel "Cigaretter dagligen, 25 per dag".
export function produktText(id, v) {
  const p = PRODUKT[id];
  const namn = p.vad ? versal(v.vad ?? p.namn) : p.namn.replace(/ \(.*\)$/, '');
  if (v.bruk === 'slutat') return `${namn}: slutat under de senaste 6 månaderna${v.slutdatum ? `, slutdatum ${v.slutdatum}` : ''}`;
  const bruk = v.bruk === 'dagligen' ? 'dagligen' : 'ibland';
  return `${namn} ${bruk}${v.antal ? `, ${v.antal} ${v.bruk === 'dagligen' ? p.dagligen : p.ibland}` : ''}`;
}

// Sökorden som anteckningen får. Systemet skriver texten ur svaren, så att den går att läsa överallt där anteckningar
// visas (journalen, Min journal, utskrift och FHIR), och den strukturerade informationen sparas bredvid.
export function sokord(varde, { alder = null } = {}) {
  const ut = [];
  const tobak = varde.anvander === 'nej' ? 'Använder inte tobak eller nikotin.'
    : varde.anvander === 'slutat' ? 'Har slutat med tobak och nikotin för mer än 6 månader sedan.'
      : `${Object.entries(varde.produkter).map(([id, v]) => produktText(id, v)).join('. ')}.`;
  ut.push({ sokord: 'Tobak och nikotin', text: tobak });
  const f = forslag(varde, { alder });
  if (f.kod) {
    const kod = `${f.atgard} (KVÅ ${f.kod})`;
    ut.push({ sokord: 'Stöd', text: `${versal(kod)}: ${STOD_TEXT[varde.stod]}.${varde.givet ? ' Samtalet hölls vid besöket och är registrerat som åtgärd.' : ''} Förslaget följer Socialstyrelsens nationella riktlinjer för vård vid ohälsosamma levnadsvanor.` });
  }
  if (varde.kommentar) ut.push({ sokord: 'Kommentar', text: varde.kommentar });
  return ut;
}

// Den sammanfattning som översikten visar.
export function sammanfattning(varde) {
  return sokord(varde)[0].text;
}
