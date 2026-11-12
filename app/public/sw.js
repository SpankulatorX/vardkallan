// Service worker för läsläget vid avbrott (D4). Den cachar gränssnittets statiska filer, så att appen startar även
// när servern inte svarar, också i en ny flik eller efter en omstart av webbläsaren (då med reservinloggningen). Den
// rör aldrig /api eller /fhir: patientuppgifter cachas inte här utan bara i den krypterade läskopian
// (js/lasekopia.js och js/reservkopia.js).
//
// Nätet först: varje fil hämtas från servern och cachen uppdateras. Bara när servern inte svarar inom fyra sekunder,
// eller svarar med ett serverfel (502 till 504 och Cloudflares 52x när servern bakom är nere), används den cachade
// filen. Så får alla en ny version direkt när servern svarar, och den gamla versionen bara under ett avbrott.
//
// Listan måste ha med varje fil i public/. Ett test (Läskopia > service workern cachar alla statiska filer) jämför.
const CACHE = 'vardkallan-v3';
// Runda 13, r4: vaccination-ui.js sist, fälten för en dos som ges, gemensamma för Tillväxt och Vaccinationer.
const FILER = [
  '/index.html', '/app.css', '/favicon.svg',
  '/fonts/OFL.txt', '/fonts/noto-sans-400.woff2', '/fonts/noto-sans-600.woff2', '/fonts/noto-sans-700.woff2',
  '/fonts/noto-sans-c600.woff2', '/fonts/noto-sans-c700.woff2',
  '/js/anvandartest.js', '/js/anvandartest-rakning.js', '/js/anvandartest-uppgifter.js',
  '/js/app.js', '/js/avbrott.js', '/js/behorighet.js', '/js/lasekopia.js', '/js/reservkopia.js', '/js/sus.js', '/js/ui.js', '/js/uppmarksamhet.js',
  '/js/vyer/arbetslista.js', '/js/vyer/drift.js', '/js/vyer/inkorg.js', '/js/vyer/inloggning.js', '/js/vyer/krav.js',
  '/js/vyer/logg.js', '/js/vyer/migrering.js', '/js/vyer/min.js', '/js/vyer/min-delar.js', '/js/vyer/moduler.js', '/js/vyer/oppet-api.js', '/js/vyer/patient-journal.js',
  '/js/vyer/patient-identitet.js', '/js/vyer/patient-lakemedel.js', '/js/vyer/patient-logglista.js', '/js/vyer/patient-matvarden.js', '/js/vyer/patient-oversikt.js',
  '/js/vyer/patient-remisser.js', '/js/vyer/patient-vardkontakt.js', '/js/vyer/patient.js', '/js/vyer/remisser.js', '/js/vyer/sok.js', '/js/vyer/vantrum.js',
  '/js/vyer/administrering.js',
  '/js/utskrift.js', '/js/kontrasignering.js', '/js/vyer/patient-utlamnat.js', '/js/vyer/arkiv.js', '/js/vyer/datauttag.js',
  '/js/tidbok-ui.js', '/js/vyer/idag.js', '/js/vyer/tidbok.js', '/js/vyer/vantelista.js', '/js/vyer/incheckning.js', '/js/vyer/patient-tider.js', '/js/vyer/min-tider.js',
  '/js/vyer/delegeringar.js', '/js/vyer/r3.js', '/js/vyer/patient-sok.js',
  '/js/vyer/lakemedelsstod.js', '/js/vyer/lakemedelsansvar.js',
  '/js/vyer/patient-tillampningar.js', '/tillampningar/blodtryck/index.html', '/tillampningar/blodtryck/app.js', '/tillampningar/blodtryck/app.css',
  '/js/planering-ui.js', '/js/vyer/min-vardbegaran.js',
  '/js/ekonomi-ui.js', '/js/vyer/ekonomi.js',
  '/js/vyer/systemforvaltning.js',
  '/js/vyer/rapportering.js', '/js/rapportfel.js', '/js/tjanstekontrakt.js',
  '/js/tillvaxt-kurva.js', '/js/vyer/patient-tillvaxt.js', '/js/vyer/min-tillvaxt.js', '/js/vyer/bhv.js',
  '/js/nyheter.js', '/js/hjalp.js', '/js/kontrast.js', '/js/vyer/nyheter.js', '/js/vyer/utbildning.js', '/js/vyer/tillganglighet.js', '/js/tidsgrans.js',
  '/js/sussa-formular.js', '/js/sussa-testfall-ui.js', '/js/vyer/sussatest.js',
  '/js/tobak-regler.js', '/js/vyer/patient-tobak.js',
  '/js/remiss-r8-ui.js',
  '/js/remiss-r10-ui.js',
  '/js/labb-ui.js', '/js/vyer/patient-prover.js', '/js/vyer/provtagning.js',
  '/js/vyer/undersokningar.js',
  '/js/vyer/uppgraderingar.js',
  '/js/bokning-r8.js', '/js/vyer/avdelning.js',
  '/js/oppet-api-forvaltning.js',
  '/js/mt-ui.js', '/js/vyer/iva.js',
  '/js/vyer/forbrukning.js',
  '/js/levnadsvanor-regler.js', '/js/skanner.js', '/js/vyer/analys.js', '/js/vyer/forskning.js', '/js/vyer/signeringslista.js', '/js/vyer/patient-levnadsvanor.js',
  '/js/vyer/kodverk.js', '/exempel/uttag-vas.json',
  '/js/vyer/patient-uppfoljning.js', '/js/vyer/patient-utbildningslage.js',
  '/js/kunskapsstod-ui.js', '/js/vyer/patient-vaccinationer.js',
  '/js/formularmotor-regler.js', '/js/vyer/patient-formular.js', '/js/vyer/formularbyggare.js', '/js/rost-regler.js', '/js/rostinmatning.js', '/js/stavning-ui.js',
  '/js/vyer/patient-infarter.js', '/js/vyer/patient-restjournaler.js', '/js/vyer/patient-donation.js',
  '/js/vyer/r10r7.js', '/js/vyer/min-r10r7.js',
  '/js/vyer/patient-operation.js', '/js/vyer/operation.js',
  '/js/obstetrik-ui.js', '/js/vyer/patient-graviditet.js', '/js/vyer/forlossning.js', '/js/vyer/modrahalsovard.js', '/js/vyer/min-graviditet.js',
  '/js/vyer/patient-cytostatika.js', '/js/vyer/patient-blod.js', '/js/vyer/cytostatikaberedning.js', '/js/vyer/cytostatika-enhet.js', '/js/vyer/blodcentral.js', '/js/vyer/min-cytostatika.js',
  '/js/vyer/patient-bilder.js', '/js/bildvisare.js',
  '/js/vyer/iva-tillagg.js', '/js/vyer/patient-iva.js', '/js/bhv-indikatorer-ui.js',
  '/js/vyer/journalstruktur.js', '/js/lakemedelsmallar-ui.js',
  '/js/flerfaktor-ui.js', '/js/vyer/flerfaktor.js', '/js/flera-fonster.js',
  '/js/testinbjudan.js', '/js/synpunkt-regler.js', '/js/kanda-begransningar.js', '/js/vyer/testa.js', '/js/vyer/om.js', '/js/vyer/testledare.js',
  '/js/vaccination-ui.js',
  '/js/demo-full.js',
];
// Runda 13, r1: listan har testinbjudan, synpunkterna, de kända begränsningarna, startsidan för testare, sidan om demon och testledarens vy.
// Runda 13, r2: listan har sidan när demon är full (demo-full.js).
// Runda 12, r1: listan har mallarna och mätvärdestyperna (journalstruktur.js) och läkemedelsmallarna (lakemedelsmallar-ui.js).
// Runda 12, r3: listan har flerfaktorsinloggningen (flerfaktor-ui.js och vyer/flerfaktor.js) och flera skärmar (flera-fonster.js).
// Runda 11, r2: listan har operationen i journalen och operationsavdelningen (patient-operation.js och operation.js).
// Runda 11, r3: listan har graviditetsjournalen, den nyföddas BB-journal, förlossningen och mödrahälsovården.
// Runda 11, r5: listan har bilder och media i journalen, med kameran, annoteringarna och arkivets visare (patient-bilder.js och bildvisare.js).
// Runda 11, r7: listan har intensivvårdens tillägg, fliken Intensivvård i journalen och barnhälsovårdens indikatorer.
// Runda 10, r2: listan har uppföljningsvyn och utbildningsläget (patient-uppfoljning.js och patient-utbildningslage.js).
// Runda 10, r6: listan har remiss eller konsultation, urvalet i remissöversikten och kvittensen av beslut på uppdrag (remiss-r10-ui.js).
// Runda 10, r5: listan har kunskapsstödet och vaccinationsprogrammen (kunskapsstod-ui.js och patient-vaccinationer.js).
// Runda 10, r3: listan har formulären, kroppsbilden, röstinmatningen och rättstavningen.
// Runda 10, r4: listan har in- och utfarterna, restjournalerna och donationen (patient-infarter.js, patient-restjournaler.js och patient-donation.js).
// Runda 11, r4: listan har cytostatika, beredningsenheten, blodet, blodcentralen och Min behandling.
// Runda 10, r7: listan har meddelandena, ombuden, vårdplanen i Min journal, kassan, kapaciteten och kontorsstödet.
// Runda 9, r1: listan har förbrukningsartiklarna (vyer/forbrukning.js).
// Runda 9, r2: listan har medicinteknisk utrustning i fliken Mätvärden och intensivvårdens vy (mt-ui.js och iva.js).
// Runda 9, r6: listan har ändringsloggen, utvecklarna och förvaltningen av det öppna API:t (oppet-api-forvaltning.js).
// Runda 9, r7: listan har levnadsvanorna, streckkodsläsaren, analysen och forskningsuttagen.
// Runda 9, r4: listan har kodverken och masterdatan (kodverk.js) och exempeluttaget för migreringen.
// Runda 8, r3: listan har fri bokning, teambesök, gruppträffar och avdelningens planering.
// Runda 8, r5: listan har mallen för tobaksvanor (tobak-regler.js och patient-tobak.js).
// Runda 8, r2: remiss på uppdrag, fördelning, remisskonferens och pappersremiss (remiss-r8-ui.js).
// Runda 8, r1: listan har beställning och svar (labb-ui.js, patient-prover.js och provtagning.js).
// Runda 7, r5: listan har rapporteringen, rättningarna i inkorgen och tabellen över tjänstekontrakten.
// Runda 7, r2: listan har nyhetsrutan, hjälpen, högkontrastläget, nyheterna, utbildningen och tillgänglighetsredogörelsen.
// Runda 7, r1: formulären och resultatet för Sussas användbarhetstester.
// Runda 6, r5: listan har tillämpningsfliken och demotillämpningen Blodtryck över tid (/tillampningar/blodtryck/).
// Runda 7, r4: listan har systemförvaltningens vy. r6: och tillväxtkurvorna och barnhälsovården (tillvaxt-kurva.js, patient-tillvaxt.js, min-tillvaxt.js och bhv.js).
const TIDSGRANS_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(namn => Promise.all(namn.filter(n => n.startsWith('vardkallan-') && n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/fhir' || url.pathname.startsWith('/fhir/')) return;
  // Runda 6, r5: inloggningen för externa tillämpningar och tillämpningarna själva går aldrig via cachen. En tillämpning
  // behöver servern för att få sin åtkomst, så den kan inte användas i läsläget ändå.
  if (url.pathname.startsWith('/oauth/') || url.pathname.startsWith('/tillampningar/')) return;
  // Runda 9, r2: mottagningen från medicinteknisk utrustning går aldrig via cachen.
  if (url.pathname === '/mt' || url.pathname.startsWith('/mt/')) return;
  e.respondWith(hamta(req, url));
});

const medTidsgrans = (p, ms) => Promise.race([p, new Promise((_, nej) => setTimeout(() => nej(new Error('tidsgräns')), ms))]);

async function hamta(req, url) {
  const cache = await caches.open(CACHE);
  // Alla adresser i gränssnittet är index.html med routning i #, så en navigering till en adress utan filändelse ger
  // index.html. En navigering direkt till en fil (till exempel /js/ui.js) sparas under filens eget namn, och bara ett
  // HTML-svar får ersätta index.html i cachen.
  const sida = url.pathname === '/' || (req.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(url.pathname));
  const nyckel = sida ? '/index.html' : url.pathname;
  try {
    const svar = await medTidsgrans(fetch(req), TIDSGRANS_MS);
    if (svar.ok) {
      const html = (svar.headers.get('content-type') || '').startsWith('text/html');
      if (FILER.includes(nyckel) && (nyckel !== '/index.html' || html)) await cache.put(nyckel, svar.clone());
      return svar;
    }
    if (svar.status < 500) return svar;
  } catch { /* servern svarar inte */ }
  const sparad = await cache.match(nyckel);
  return sparad ?? new Response('Vårdkällan svarar inte, och filen finns inte i webbläsarens cache.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
