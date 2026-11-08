// Runda 10, r7: API för ombud med fullmakt, meddelanden mellan invånare och vård, invånarens begäranden, patientens
// vårdplan i Min journal, kassan, kapaciteten och kontorsstödet. Behörigheten prövas i modulerna och av
// behörighetsmotorn, och varje anrop som rör en patient loggas på patienten (medPatient och medMinJournal).
import { Fel, idag, giltigtDatum } from './db.js';
import { Atkomst, kanRoll, visningsnamn, visningsPnr } from './atkomst.js';
import * as ombud from './ombud.js';
import * as meddelanden from './invanarmeddelanden.js';
import * as minVardplan from './min-vardplan.js';
import * as kassa from './kassa.js';
import * as kapacitet from './kapacitetsprognos.js';
import * as kontorsstod from './kontorsstod.js';
import * as journal from './journal.js';
import * as tidbok from './tidbok.js';

const fil = (data, typ, namn) => new Response(data, { status: 200, headers: { 'Content-Type': typ, 'Content-Disposition': `attachment; filename="${namn}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

// Delarna i Min journal som läses med GET /api/min/journal/:id/<del> (server.js, MIN_DELAR).
export const MIN_DELAR = {
  meddelanden: meddelanden.minLista, ombud: ombud.minLista, vardplaner: minVardplan.minaPlaner, avgifter: kassa.minaAvgifter,
  // Möteslänkarna för patientens videobesök.
  videomoten: (atk) => ({ moten: atk.db.query("SELECT v.bokning_id, v.kod FROM videomoten v JOIN bokningar b ON b.id = v.bokning_id WHERE v.patient_id = ? AND b.status IN ('bokad', 'incheckad')").all(atk.patientId)
    .map(m => ({ bokningId: m.bokning_id, lank: kontorsstod.motesLank(m.kod) })) }),
};

export function registreraRutter({ rutt, kravInloggad, medPatient, valFor, medMinJournal, kalender }) {
  // --- Min journal ------------------------------------------------------------------------------------------------
  rutt('POST', '/api/min/journal/:id/meddelanden', (c, id) => medMinJournal(c, id, 'min:meddelanden', (atk) => meddelanden.minSkapa(atk, c.body)));
  rutt('POST', '/api/min/journal/:id/meddelanden/:tid/svar', (c, id, tid) => medMinJournal(c, id, `min:meddelanden:${Number(tid) || 0}:svar`, (atk) => meddelanden.minSvara(atk, tid, c.body)));
  rutt('POST', '/api/min/journal/:id/ombud', (c, id) => medMinJournal(c, id, 'min:ombud', (atk) => ombud.minGe(atk, c.body)));
  rutt('POST', '/api/min/journal/:id/ombud/:fid/aterkalla', (c, id, fid) => medMinJournal(c, id, `min:ombud:${Number(fid) || 0}`, (atk) => ombud.minAterkalla(atk, fid)));
  // Ombudet godkänner eller avböjer en fullmakt i sin egen inloggning.
  rutt('POST', '/api/min/fullmakt/:fid/:svar', (c, fid, svar) => {
    if (!c.invanare) throw new Fel(401, 'Logga in med e-legitimation.', 'ej_inloggad');
    if (!['godkann', 'avboj'].includes(svar)) throw new Fel(404, 'Okänd adress.', 'saknas');
    return ombud.besvara(c.db, c.invanare, fid, svar);
  });
  rutt('POST', '/api/min/journal/:id/avgift/:aid/betala', (c, id, aid) => medMinJournal(c, id, `min:avgift:${Number(aid) || 0}`, (atk) => kassa.minBetala(atk, aid, c.body)));

  // --- Meddelanden från invånare och begäranden -----------------------------------------------------------------
  const prova = (c) => (pid, enhet) => new Atkomst(c.db, c.personal, pid, valFor(c.s, pid)).prova('meddelande_invanare', { enhet_id: enhet }).tillaten;
  rutt('GET', '/api/meddelanden', (c) => meddelanden.lista(c.db, kravInloggad(c), { prova: prova(c) }));
  const medTrad = (c, id, fn) => {
    kravInloggad(c);
    if (!kanRoll(c.personal, 'meddelande_invanare')) throw new Fel(403, 'Din yrkesroll läser inte meddelanden från invånare.', 'nekad');
    const t = meddelanden.hamtaTrad(c.db, id);
    return medPatient(c, t.patient_id, 'meddelande_invanare', (atk) => fn(atk, t));
  };
  rutt('GET', '/api/meddelanden/:id', (c, id) => medTrad(c, id, (atk, t) => meddelanden.vardTrad(atk, t)));
  rutt('POST', '/api/meddelanden/:id/svar', (c, id) => medTrad(c, id, (atk, t) => meddelanden.vardSvara(atk, t, c.body)));
  rutt('POST', '/api/meddelanden/:id/avsluta', (c, id) => medTrad(c, id, (atk, t) => meddelanden.vardAvsluta(atk, t, c.body)));
  rutt('GET', '/api/begaran', (c) => meddelanden.begaranLista(c.db, kravInloggad(c)));
  rutt('POST', '/api/begaran/:id/handlagg', (c, id) => meddelanden.begaranHandlagg(c.db, kravInloggad(c), id));

  // --- Fullmakter i vården ----------------------------------------------------------------------------------------
  rutt('GET', '/api/patient/:id/fullmakter', (c, id) => { kravInloggad(c); return medPatient(c, id, 'las_admin', (atk) => ombud.vardLista(atk)); });
  rutt('POST', '/api/patient/:id/fullmakter', (c, id) => { kravInloggad(c); return medPatient(c, id, 'fullmakt', (atk, p) => ombud.vardRegistrera(atk, p, c.body)); });
  rutt('POST', '/api/patient/:id/fullmakter/:fid/aterkalla', (c, id, fid) => { kravInloggad(c); return medPatient(c, id, 'fullmakt', (atk, p) => ombud.vardAterkalla(atk, p, fid)); });

  // --- Kassan -------------------------------------------------------------------------------------------------------
  const datum = (c) => { const d = c.url.searchParams.get('datum'); return d && giltigtDatum(d) ? d : idag(); };
  rutt('GET', '/api/kassa', (c) => kassa.kassa(c.db, kravInloggad(c), { datum: datum(c) }));
  // Demoläget för gränssnittstesterna: en patient med en tid i dag på kassörens vårdenhet checkas in och betalar med kort,
  // så att kassan har en betalning att göra dagsavslut på.
  rutt('POST', '/api/demo/kassa-besok', (c) => {
    const p = kravInloggad(c);
    for (const b of kassa.demoBokningar(c.db, p)) {
      try {
        return medPatient(c, b.patient_id, 'checka_in', (atk) => {
          tidbok.checkaIn(atk, b);
          return [201, tidbok.betala(atk, tidbok.bokningRad(c.db, b.id), { satt: 'kort' })];
        });
      } catch { /* nästa tid */ }
    }
    throw new Fel(400, 'Det finns ingen tid i dag att ta betalt för.', 'ogiltig');
  });
  rutt('POST', '/api/kassa/dagsavslut', (c) => kassa.dagsavslut(c.db, kravInloggad(c), c.body));
  rutt('POST', '/api/kassa/aterbetalning', (c) => {
    kravInloggad(c);
    const bet = kassa.hamtaBetalning(c.db, c.body.kalla, c.body.id);
    if (!bet) throw new Fel(404, 'Betalningen finns inte.', 'saknas');
    return medPatient(c, bet.patient_id, 'checka_in', (atk) => kassa.aterbetala(atk, bet, c.body));
  });
  // Ekonomens summa för avgifter för tjänster per dag och vårdenhet, utan uppgifter per patient.
  rutt('GET', '/api/ekonomi/tjanstavgifter', (c) => kassa.tjanstRedovisning(c.db, kravInloggad(c), { datum: datum(c) }));
  rutt('GET', '/api/kassa/rapport.docx', (c) => {
    const k = kassa.kassa(c.db, kravInloggad(c), { datum: datum(c) });
    const block = [
      { typ: 'rubrik', text: `Kassaredovisning ${k.datum}` }, { typ: 'stycke', text: k.vardenhet.namn },
      { typ: 'tabell', huvud: ['Kassör', 'Kort', 'Faktura', 'Återbetalt', 'Netto', 'Rader'], rader: k.kassorer.map(x => [x.namn, `${x.summa.kort} kr`, `${x.summa.faktura} kr`, `${x.summa.aterbetalt} kr`, `${x.summa.netto} kr`, String(x.summa.antal)]) },
      { typ: 'rubrik', niva: 2, text: 'Dagsavslut' },
      k.avslut.length ? { typ: 'tabell', huvud: ['Tid', 'Kassör', 'Rader', 'Kort enligt terminalen', 'Räknat', 'Skillnad'], rader: k.avslut.map(a => [a.tid.slice(11, 16), a.kassor.namn ?? '', String(a.antal), `${a.terminal} kr`, `${a.raknat} kr`, `${a.avvikelse} kr`]) } : { typ: 'stycke', text: 'Inget dagsavslut ännu.' },
      { typ: 'stycke', text: k.demoregler },
    ];
    return fil(kontorsstod.docx({ titel: `Kassaredovisning ${k.datum}`, block }), kontorsstod.DOCX_TYP, `kassaredovisning-${k.datum}.docx`);
  });

  // --- Kapaciteten ---------------------------------------------------------------------------------------------------
  rutt('GET', '/api/kapacitet', (c) => kapacitet.prognos(c.db, kravInloggad(c), { veckor: c.url.searchParams.get('veckor') }));
  rutt('GET', '/api/kapacitet/rapport.docx', (c) => {
    const k = kapacitet.prognos(c.db, kravInloggad(c), { veckor: c.url.searchParams.get('veckor') });
    const block = [
      { typ: 'rubrik', text: `Kapacitet och prognos, ${k.vardenhet.namn}` }, { typ: 'stycke', text: `Från vecka ${k.veckor[0].nummer}, ${k.veckor.length} veckor. Väntar: ${k.summa.vantar}. Riskerar att passera gränsen: ${k.summa.riskerarGransen}.` },
      { typ: 'tabell', huvud: ['Tidstyp', 'Yrkesroll', 'Väntar', 'Lediga tider', 'Inflöde per vecka', 'Kön är borta', 'Riskerar gränsen'], rader: k.grupper.map(g => [g.tidstypText, g.yrkesrollText, String(g.vantar), String(g.ledigaTotalt), String(g.inflodePerVecka), g.kontBorta ? `vecka ${g.kontBorta.vecka}` : 'inte inom perioden', String(g.riskerarGransen)]) },
      { typ: 'rubrik', niva: 2, text: 'Förslag' },
      ...k.grupper.flatMap(g => g.forslag).map(f => ({ typ: 'stycke', text: f.text })),
      { typ: 'stycke', text: k.demoregler },
    ];
    return fil(kontorsstod.docx({ titel: 'Kapacitet och prognos', block }), kontorsstod.DOCX_TYP, `kapacitet-${k.dag}.docx`);
  });

  // --- Kontorsstödet -----------------------------------------------------------------------------------------------
  rutt('GET', '/api/kontorsstod', (c) => { kravInloggad(c); return kontorsstod.arkitektur(); });
  rutt('GET', '/api/kalender', (c) => kontorsstod.kalenderStatus(c.db, kravInloggad(c)));
  rutt('POST', '/api/kalender/lank', (c) => {
    const personal = kravInloggad(c);
    const token = kalender.skapa(c.s, personal);
    return [201, { ...kontorsstod.kalenderStatus(c.db, personal), adress: `${c.url.origin}/api/kalender/${token}.ics`, visasEnGang: 'Länken visas bara nu. Lägg in den som prenumeration i ditt kalenderprogram, till exempel Lägg till kalender från internet i Outlook. En tidigare länk gäller inte längre.' }];
  });
  rutt('POST', '/api/kalender/lank/aterkalla', (c) => { const personal = kravInloggad(c); const ok = kalender.aterkalla(c.s, personal); return { aterkallad: ok, ...kontorsstod.kalenderStatus(c.db, personal) }; });
  // Journaltexten som Word-dokument: samma prövning som när anteckningen öppnas, och uttaget loggas på patienten.
  rutt('GET', '/api/anteckning/:id/docx', (c, id) => {
    kravInloggad(c);
    const a = journal.hamtaAnteckningRad(c.db, id);
    return medPatient(c, a.patient_id, journal.lasHandling(a.kategori), (atk, p) => {
      let ut;
      try { ut = journal.hamtaAnteckning(atk, a); } catch (e) {
        if (e instanceof Fel && [403, 404].includes(e.status)) throw new Fel(404, 'Anteckningen finns inte.', 'saknas');
        throw e;
      }
      const visad = valFor(c.s, p.id).visa_identitet;
      atk.logga(journal.lasHandling(a.kategori), atk.grund(), `anteckning:${a.id}:docx`, 'tillaten', 'Journaltexten togs ut som Word-dokument');
      return fil(kontorsstod.anteckningDocx(ut, { namn: visningsnamn(p, visad), personnummer: visningsPnr(p, visad) }), kontorsstod.DOCX_TYP, `anteckning-${a.id}.docx`);
    });
  });
  // En bokning i tidboken: möteslänk, uppringning och inbjudan.
  const medBokning = (c, id, fn) => {
    kravInloggad(c);
    const b = tidbok.bokningRad(c.db, id);
    const handling = kanRoll(c.personal, 'boka') ? 'boka' : 'las_tidbok';
    return medPatient(c, b.patient_id, handling, (atk, p) => {
      const tid = tidbok.tidRad(c.db, b.tid_id);
      tidbok.kravEgenVardenhet(atk, tidbok.bokningensEnhet(c.db, b), `bokning:${b.id}`);
      atk.krav(handling);
      return fn(atk, b, tid, p);
    });
  };
  rutt('GET', '/api/bokning/:id/kontorsstod', (c, id) => medBokning(c, id, (atk, b, tid, p) => kontorsstod.forBokning(c.db, b, tid, p, { visad: valFor(c.s, p.id).visa_identitet })));
  rutt('GET', '/api/bokning/:id/inbjudan.ics', (c, id) => medBokning(c, id, (atk, b, tid) => fil(kontorsstod.kalenderIcs([kontorsstod.inbjudanHandelse(c.db, b, tid)], { metod: 'PUBLISH' }), 'text/calendar; charset=utf-8', `bokning-${b.id}.ics`)));
  rutt('GET', '/api/bokning/:id/inbjudan.eml', (c, id) => medBokning(c, id, (atk, b, tid) => fil(kontorsstod.inbjudanEpost(kontorsstod.inbjudanHandelse(c.db, b, tid), c.personal), 'message/rfc822', `inbjudan-${b.id}.eml`)));
  // Den simulerade mötessidan. Inga patientuppgifter, bara att mötet finns och när det är.
  rutt('GET', '/api/videomote/:kod', (c, kod) => {
    kontorsstod.sakra(c.db);
    const m = typeof kod === 'string' && /^[A-Za-z0-9_-]{16}$/.test(kod) ? c.db.query('SELECT * FROM videomoten WHERE kod = ?').get(kod) : null;
    const b = m ? c.db.query('SELECT * FROM bokningar WHERE id = ?').get(m.bokning_id) : null;
    if (!b || !['bokad', 'incheckad'].includes(b.status)) throw new Fel(404, 'Mötet finns inte, eller så är tiden avbokad.', 'saknas');
    const tid = tidbok.tidRad(c.db, b.tid_id);
    return { simulerat: true, start: tid.start, slut: tid.slut, text: 'Det här är ett simulerat videomöte. I en riktig installation öppnas mötet i Microsoft Teams eller regionens videotjänst, och både patienten och vårdgivaren går in med samma länk.' };
  });
}

// Kalenderprenumerationen hämtas av ett kalenderprogram utan inloggning. Den behandlas före sessionen, så att en
// hämtning aldrig skapar en sandlåda. Svaret har bara tid, typ och mottagning.
export function kalenderSvar(url, { kalender, sessioner }) {
  const m = url.pathname.match(/^\/api\/kalender\/(vkcal_[A-Za-z0-9_-]{32})\.ics$/);
  if (!m) return null;
  const k = kalender.hitta(m[1], [...sessioner.values()]);
  const text = (t, status) => new Response(t, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!k) return text('Kalendern finns inte, eller så är länken återkallad.', 404);
  if (k.tak) return text('Kalendern har hämtats för många gånger den senaste timmen. Försök igen senare.', 429);
  const p = k.s.db.query('SELECT namn FROM personal WHERE id = ?').get(k.personalId);
  const ics = kontorsstod.kalenderIcs(kontorsstod.kalenderHandelser(k.s.db, k.personalId), { namn: `Vårdkällan, ${p?.namn ?? 'tidbok'}` });
  return new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
