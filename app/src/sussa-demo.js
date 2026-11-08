// Demoläget för Sussas användbarhetstester (runda 7, r1): lägger in testpatienterna och den data som testfallen behöver
// i den inloggades sandlåda (POST /api/demo/sussa-testfall). Varje testpar i Sussas modell ska kunna utföra sitt
// testpaket oberoende av andra (Bilaga F1:2 avsnitt 1.1), så skriptet och testledaren återställer demon och lägger in
// testdatan före varje testfall. Datan läggs in en gång per sandlåda.
//
// Tiderna räknas från nu (parametern nu), så att demon alltid ser aktuell ut: Sussas datum i oktober 2017 och 2018 är
// flyttade till dagar före eller efter testet med samma klockslag. Allt är påhittat och bara för demon.
import { Fel, addDagar, datumAv, lokalTid } from './db.js';
import { Atkomst } from './atkomst.js';
import * as tidbok from './tidbok.js';
import { SUSSA_PATIENTER, BERTIL_PK, BERTIL_EPIKRIS, ANKOMNA_5_6, OSIGNERADE_4_4 } from './seed/sussa-testdata.js';

const MIN = 60_000;
const kon = (pnr) => (Number(pnr[10]) % 2 === 1 ? 'man' : 'kvinna');
const fodd = (pnr) => `${pnr.slice(0, 4)}-${pnr.slice(4, 6)}-${pnr.slice(6, 8)}`;
const runda5 = (ms) => Math.round(ms / (5 * MIN)) * 5 * MIN;

export const harTestdata = (db) => Boolean(db.query("SELECT 1 FROM patienter WHERE id = 'sus01'").get());

// Lägger in testdatan. Returnerar vad som lades in, eller { redan: true } om den redan fanns.
export function laddaTestdata(db, personal, { nu = new Date() } = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  if (harTestdata(db)) return { ok: true, redan: true, patienter: SUSSA_PATIENTER.length };
  const basDatum = datumAv(nu);
  const T = (dag, klocka) => lokalTid(addDagar(basDatum, dag), klocka);
  const M = (min) => new Date(runda5(nu.getTime() + min * MIN)).toISOString();
  const plus = (iso, min) => new Date(Date.parse(iso) + min * MIN).toISOString();
  const pers = (id) => db.query('SELECT * FROM personal WHERE id = ?').get(id);

  db.transaction(() => {
    const insP = db.query('INSERT INTO patienter (id, personnummer, fornamn, efternamn, kon, fodd, ort, skyddad, id_typ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)');
    const insId = db.query('INSERT INTO identiteter (patient_id, typ, varde, status, fran, ursprung) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of SUSSA_PATIENTER) {
      insP.run(p.id, p.pnr, p.fornamn, p.efternamn, kon(p.pnr), fodd(p.pnr), 'Örebro', 'personnummer');
      insId.run(p.id, 'personnummer', p.pnr, 'gallande', T(-400, '09:00'), p.id);
    }

    const insVk = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, kalla, planerad, ankomst, vardtillfalle_id, skapad, skapad_av, automatisk, ger_vardrelation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vardkallan', ?, ?, ?, ?, ?, 0, 1)`);
    const vk = (pid, enhet, { typ = 'oppenvard', kontaktsatt = 'besok', start, slut = null, plats = 'Mottagning', orsak, planerad = 0, ankomst = null, vt = null, av = null }) =>
      Number(insVk.run(pid, enhet, typ, typ === 'slutenvard' ? null : kontaktsatt, start, slut, plats, orsak, planerad, ankomst, vt, start, av).lastInsertRowid);
    const insVt = db.query('INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, utskriven, orsak, inskriven_av, kalla) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insH = db.query('INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, ?, ?, ?, ?, ?, ?)');
    // Ett vårdtillfälle på en avdelning: vårdtillfället hör till vårdenheten, vårdkontakten till avdelningen.
    const vardtillfalle = (pid, avdelning, { inskriven, utskriven = null, plats, orsak, av }) => {
      const ve = db.query('SELECT forald_id FROM enheter WHERE id = ?').get(avdelning)?.forald_id ?? avdelning;
      const vt = Number(insVt.run(pid, ve, inskriven, utskriven, orsak, av, 'vardkallan').lastInsertRowid);
      insH.run(vt, 'inskrivning', inskriven, avdelning, plats, av, null);
      if (utskriven) insH.run(vt, 'utskrivning', utskriven, avdelning, plats, av, null);
      return { vt, vk: vk(pid, avdelning, { typ: 'slutenvard', start: inskriven, slut: utskriven, plats, orsak, vt, av }) };
    };
    const insAnt = db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'vardkallan')`);
    const anteckning = (pid, enhet, vkId, typ, sokord, av, skapad, signerad = true) => insAnt.run(pid, enhet, vkId, typ, typ === 'Omvårdnadsanteckning' ? 'omvardnad' : 'lakare',
      JSON.stringify(Object.entries(sokord).map(([s, text]) => ({ sokord: s, text }))), av, skapad, signerad ? 'signerad' : 'utkast', signerad ? plus(skapad, 5) : null, signerad ? av : null);
    const insDia = db.query('INSERT INTO diagnoser (patient_id, enhet_id, vardkontakt_id, kod, text, typ, datum, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insMv = db.query('INSERT INTO matvarden (patient_id, enhet_id, typ, varde, varde_num, matt_enhet, tid, registrerad_av, kalla, vidimerad, vardkontakt_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)');

    // Bertil Danielsson (testfall 3.4 och 6.3): inlagd på Avdelning 72 sedan fyra dagar, med provsvar från vårdcentralen
    // och ortopeden och en epikris från ett vårdtillfälle 2016.
    vardtillfalle('sus01', 'uso-kard-72', { inskriven: T(-4, '14:00'), plats: 'Avd 72, sal 3', orsak: 'Andfåddhet och bensvullnad', av: 'ssk-kard' });
    for (const p of BERTIL_PK) {
      const t = T(p.dag, p.klocka);
      const kontakt = vk('sus01', p.enhet, { start: t, slut: plus(t, 15), orsak: 'Provtagning' });
      insMv.run('sus01', p.enhet, 'inr', String(p.varde), p.varde, 'INR', t, 'vardkallan', plus(t, 120), kontakt);
    }
    const tidigare = vardtillfalle('sus01', 'uso-kard-72', { inskriven: lokalTid(BERTIL_EPIKRIS.inskriven, '10:00'), utskriven: lokalTid(BERTIL_EPIKRIS.utskriven, '11:00'), plats: 'Avd 72, sal 2', orsak: 'Feber och frossa', av: 'ol-kard' });
    insDia.run('sus01', 'uso-kard-72', tidigare.vk, 'A41.9', 'Sepsis, ospecificerad', 'huvud', BERTIL_EPIKRIS.inskriven, 'vardkallan');
    anteckning('sus01', 'uso-kard-72', tidigare.vk, 'Epikris', BERTIL_EPIKRIS.sokord, 'ol-kard', lokalTid(BERTIL_EPIKRIS.utskriven, '09:30'));

    // Mira Axelsson (testfall 2.1 och 6.1): på vårdcentralen i dag med en hudförändring, och på kardiologiska mottagningen
    // med feber och frossa, där hon skrivs in akut.
    vk('sus17', 'vc-tybble', { start: M(-40), plats: 'Mottagning', orsak: 'Hudförändring på låret' });
    vk('sus17', 'uso-kard-mott', { start: M(-30), plats: 'Kardiologiska mottagningen', orsak: 'Feber och frossa' });

    // Sara Sandmark (testfall 2.6, 4.2 och 5.6): en accepterad remiss från vårdcentralen till kardiologen, ett besök på
    // mottagningen i dag och ett besök på vårdcentralen i dag.
    vk('sus06', 'uso-kard-mott', { start: M(-45), plats: 'Kardiologiska mottagningen', orsak: 'Enligt remiss från Vårdcentralen Tybble' });
    db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status,
      skickad_tid, mottagen_tid, mottagen_av, bedomd_tid, bedomd_av, beslut, kalla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'vardkallan')`)
      .run('sus06', 'vc-tybble', 'uso-kard', 'lak-vc', 'Svår andfåddhet vid ansträngning. Bedömning?', 'Kvinna med tilltagande andfåddhet sedan en månad.', 'normal',
        addDagar(basDatum, 10), 'bedomd', T(-20, '10:00'), T(-20, '11:00'), 'adm-kard', T(-18, '09:00'), 'lak-kard', 'accepterad');

    // Runda 8, r5: Berit Strandhall (testfall 4.1): ett besök på vårdcentralen i dag och ett på kardiologiska
    // mottagningen, så att läkaren i öppenvården, sjuksköterskan och fysioterapeuten har henne i arbetslistan.
    vk('sus05', 'vc-tybble', { start: M(-25), plats: 'Mottagning', orsak: 'Mottagningsbesök', av: 'lak-vc' });
    vk('sus05', 'uso-kard-mott', { start: M(-35), plats: 'Kardiologiska mottagningen', orsak: 'Mottagningsbesök' });

    // Anna Karlsson (testfall 4.3): inlagd på Avdelning 72 sedan tre dagar med sepsis, med de anteckningar som Sussa
    // anger som underlag för epikrisen (Bilaga F1:3 tabell 13).
    const anna = vardtillfalle('sus07', 'uso-kard-72', { inskriven: T(-3, '15:00'), plats: 'Avd 72, sal 4', orsak: 'Feber och frossa', av: 'ssk-kard' });
    insDia.run('sus07', 'uso-kard-72', anna.vk, 'A41.9', 'Sepsis, ospecificerad', 'huvud', addDagar(basDatum, -3), 'vardkallan');
    anteckning('sus07', 'uso-kard-72', anna.vk, 'Inskrivningsanteckning', { Kontaktorsak: 'Feber och frossa.', Bedömning: 'Misstänkt sepsis.', Åtgärd: 'Odlingar och antibiotika intravenöst.' }, 'lak-kard', T(-3, '16:00'));
    anteckning('sus07', 'uso-kard-72', anna.vk, 'Omvårdnadsanteckning', { 'Andning/cirkulation': 'Feber 39,2. Takykard.', Planering: 'Täta kontroller.' }, 'ssk-kard', T(-3, '16:30'));
    for (let d = 0; d < 4; d++) {
      anteckning('sus07', 'uso-kard-72', anna.vk, 'Daganteckning', { Aktuellt: ['Fortsatt feber.', 'Feberfri sedan i natt.', 'Pigg, äter bra.', 'Stabil, går på avdelningen.'][d], Bedömning: d < 2 ? 'Svarar på behandlingen.' : 'Kan gå över till antibiotika per os.' }, 'lak-kard', T(-2 + Math.floor(d / 2), d % 2 ? '14:00' : '09:00'));
    }
    for (let i = 0; i < 10; i++) {
      anteckning('sus07', 'uso-kard-72', anna.vk, 'Omvårdnadsanteckning', { 'Andning/cirkulation': `Kontroll ${i + 1} utan anmärkning.` }, 'ssk-kard', T(-3 + Math.floor(i / 4), ['07:00', '13:00', '19:00', '23:00'][i % 4]));
    }

    // Henrik Lundin, Hanna Korlen och Sven Markström (testfall 4.4): läkaren i öppenvården har tio osignerade
    // anteckningar för var och en.
    for (const pid of OSIGNERADE_4_4.patienter) {
      const kontakt = vk(pid, 'vc-tybble', { start: T(-1, '09:00'), slut: T(-1, '09:30'), orsak: 'Mottagningsbesök', av: 'lak-vc' });
      for (let i = 0; i < OSIGNERADE_4_4.perPatient; i++) {
        anteckning(pid, 'vc-tybble', kontakt, 'Mottagningsanteckning', { Aktuellt: `Uppföljning ${i + 1}.`, Bedömning: 'Oförändrat.' }, 'lak-vc', plus(T(-1, '09:00'), i), false);
      }
    }

    // Fatima Baskar (testfall 6.2): inlagd på Avdelning 72 sedan två dagar.
    vardtillfalle('sus16', 'uso-kard-72', { inskriven: T(-2, '10:00'), plats: 'Avd 72, sal 6', orsak: 'Buksmärta', av: 'ssk-kard' });

    // Tema 1, läkemedelshantering (Bilaga F1:3 tabell 7). Ordinationerna läggs in som i seeden, med NLL:s kvittens.
    const insOrd = db.query(`INSERT INTO ordinationer (patient_id, enhet_id, lakemedel_id, dosering, dos, dos_enhet, tider, vid_behov, typ, orsak, uppfoljning, start, slut, status, ordinerad_av, skapad, nll_status, kalla)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktiv', ?, ?, 'kvitterad', 'vardkallan')`);
    let kvittens = 9000;
    const ordination = (pid, enhet, lm, { dosering, dos = null, dosEnhet = null, tider = [], typ = 'staende', orsak, uppfoljning, start, slut = null, av, skapad }) => {
      const id = Number(insOrd.run(pid, enhet, lm, dosering, dos, dosEnhet, JSON.stringify(tider), typ === 'vid_behov' ? 1 : 0, typ, orsak, uppfoljning, start, slut, av, skapad).lastInsertRowid);
      db.query('INSERT INTO ordination_historik (ordination_id, tid, personal_id, handelse, detalj) VALUES (?, ?, ?, ?, ?)').run(id, skapad, av, 'Ordinerad', dosering);
      db.query('INSERT INTO nll_meddelanden (ordination_id, typ, skickad, status, svar_tid, kvittens, nll_registrerad) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(id, 'ny', plus(skapad, 0.05), 'kvitterad', plus(skapad, 0.1), `NLL-SUS-${++kvittens}`);
      return id;
    };
    // Gerda Ström (testfall 1.1): på vårdcentralen i dag, med Waran, Metformin och Atrovent sedan tidigare.
    vk('sus02', 'vc-tybble', { start: M(-20), plats: 'Mottagning', orsak: 'Läkemedelsgenomgång', av: 'lak-vc' });
    const forr = T(-100, '10:00');
    const gStart = addDagar(basDatum, -100);
    ordination('sus02', 'vc-tybble', 'VK-NPL-0001', { dosering: 'Enligt ordination', orsak: 'Blodförtunnande', uppfoljning: addDagar(basDatum, 60), start: gStart, av: 'lak-vc', skapad: forr });
    ordination('sus02', 'vc-tybble', 'VK-NPL-0020', { dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08:00', '20:00'], orsak: 'Mot diabetes', uppfoljning: addDagar(basDatum, 60), start: gStart, av: 'lak-vc', skapad: forr });
    ordination('sus02', 'vc-tybble', 'VK-NPL-0053', { dosering: '2 inhalationer 4 gånger dagligen', orsak: 'Mot andningsproblem', uppfoljning: addDagar(basDatum, 60), start: gStart, av: 'lak-vc', skapad: forr });
    // Elin Arnström (1.2) och Trevis Ljung (1.3): inlagda på Avdelning 72.
    vardtillfalle('sus03', 'uso-kard-72', { inskriven: T(-1, '13:00'), plats: 'Avd 72, sal 7', orsak: 'Utredning inför röntgen', av: 'ssk-kard' });
    vardtillfalle('sus04', 'uso-kard-72', { inskriven: T(-1, '15:00'), plats: 'Avd 72, sal 8', orsak: 'Smärta', av: 'ssk-kard' });
    // Bertil Danielsson (1.4): fyra ordinationer från i går att ge nu, med instruktionerna i doseringen.
    const igar = addDagar(basDatum, -1);
    const timme = `${new Date(nu.getTime()).toLocaleTimeString('sv-SE', { hour: '2-digit', timeZone: 'Europe/Stockholm' }).slice(0, 2)}:00`;
    const bOrd = { start: igar, slut: basDatum, uppfoljning: addDagar(basDatum, 1), av: 'lak-kard', skapad: T(-1, '16:00'), tider: [timme], typ: 'tillfallig' };
    ordination('sus01', 'uso-kard-72', 'VK-NPL-0062', { ...bOrd, dosering: '100 ml engångsdos. Ges som intravenös infusion under 15 minuter', dos: 1000, dosEnhet: 'mg', orsak: 'Smärta' });
    ordination('sus01', 'uso-kard-72', 'VK-NPL-0057', { ...bOrd, dosering: '1000 ml med Addex-Magnesium 20 mmol. Ges på två timmar', orsak: 'Vätska och magnesium' });
    ordination('sus01', 'uso-kard-72', 'VK-NPL-0065', { ...bOrd, dosering: '1 tablett som premedicinering 1 timme före röntgen', dos: 10, dosEnhet: 'mg', orsak: 'Premedicinering inför röntgen' });
    ordination('sus01', 'uso-kard-72', 'VK-NPL-0044', { ...bOrd, slut: null, uppfoljning: addDagar(basDatum, 14), tider: [], typ: 'vid_behov', dosering: '1 tablett vid behov till natten', dos: 5, dosEnhet: 'mg', orsak: 'Sömn' });

    // Gerda Ström (testfall 5.7), Susanne Svedin (5.4) och Jonas Brun (5.8): tidigare besök på kardiologiska mottagningen.
    vk('sus02', 'uso-kard-mott', { start: T(-30, '10:00'), slut: T(-30, '10:30'), plats: 'Kardiologiska mottagningen', orsak: 'Besök' });
    vk('sus13', 'uso-kard-mott', { start: T(-40, '13:00'), slut: T(-40, '13:30'), plats: 'Kardiologiska mottagningen', orsak: 'Besök' });
    vk('sus20', 'uso-kard-mott', { start: T(-50, '11:00'), slut: T(-50, '11:30'), plats: 'Kardiologiska mottagningen', orsak: 'Besök' });
  })();

  // Tidboken görs med tidbokens egna funktioner, så att väntelistan, bokningarna, vårdkontakterna och kallelserna blir
  // som när vårdadministratören bokar.
  const adm = pers('adm-kard');
  const post = (pid, { ve, tidstyp = 'aterbesok', yrkesroll = 'lakare', orsak, mal, onskad = null }) =>
    tidbok.vantelistaRad(db, tidbok.laggPaVantelista(db, { patientId: pid, ve, tidstyp, yrkesroll, orsak, mal: addDagar(basDatum, mal), av: 'adm-kard', onskad }).id);
  const insT = db.query('INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES (?, ?, ?, ?, 1, NULL, 0)');
  const nyTid = (schema, start, tidstyp = 'aterbesok') => tidbok.tidRad(db, Number(insT.run(schema, start, plus(start, tidbok.TIDSTYPER[tidstyp].min), tidstyp).lastInsertRowid));

  // Susanne Svedin (testfall 5.4): bokad hos läkaren på mottagningen från väntelistan, med måldatum om ett halvår.
  const susanne = post('sus13', { ve: 'uso-kard', orsak: 'Återbesök hos läkare', mal: 180, onskad: 'lak-kard' });
  const forslag = tidbok.forslagForPost(new Atkomst(db, adm, 'sus13', {}, 'boka'), susanne).forslag;
  if (!forslag.length) throw new Fel(500, 'Demoläget hittade ingen ledig tid för Susanne Svedin.', 'fel');
  tidbok.bokaPostRad(db, susanne, tidbok.tidRad(db, forslag[0].tidId), { av: 'adm-kard' });

  // Sofia Andersson (testfall 5.5): bokad i dag hos läkaren på mottagningen om en kvart, inte incheckad än.
  const sofia = post('sus21', { ve: 'uso-kard', orsak: 'Besök hos läkare', mal: 30 });
  tidbok.bokaPostRad(db, sofia, nyTid('sch-kard-sara', M(15)), { av: 'adm-kard' });

  // Jonas Brun (testfall 5.8): på väntelistan för ett återbesök hos läkare.
  post('sus20', { ve: 'uso-kard', orsak: 'Återbesök, 30 minuter', mal: 60 });

  // Testfall 5.6: fem patienter har kommit till läkaren på vårdcentralen i dag. Tiderna ligger före nu, men aldrig före
  // midnatt. Incheckningen registreras som i tidboken, två minuter före tiden och med könummer.
  const midnatt = Date.parse(lokalTid(basDatum, '00:05'));
  ANKOMNA_5_6.forEach((pid, i) => {
    const start = new Date(Math.max(midnatt + i * 10 * MIN, runda5(nu.getTime() - (150 - i * 25) * MIN))).toISOString();
    const p = post(pid, { ve: 'vc-tybble', orsak: 'Återbesök hos läkare', mal: 30 });
    const { b } = tidbok.bokaPostRad(db, p, nyTid('sch-vc-per', start), { av: 'adm-kard' });
    const kom = plus(start, -2);
    db.query("UPDATE bokningar SET status = 'incheckad', incheckad = ?, incheckad_via = 'reception', konummer = ? WHERE id = ?").run(kom, `K${String(i + 1).padStart(2, '0')}`, b.id);
    db.query('UPDATE vardkontakter SET ankomst = ? WHERE id = ?').run(kom, b.vardkontakt_id);
  });

  return { ok: true, redan: false, patienter: SUSSA_PATIENTER.length };
}
