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
// Runda 8, r2: remisserna i testfall 2.3 och 2.4 och den inskannade pappersremissen i testfall 2.5.
import { REMISSER_2_3, SKANNAD_2_5 } from './seed/sussa-testdata.js';
import { laggTillSkanning } from './remiss-r8.js';
// Runda 8, r1: tema 3, beställning och svar (labb.js och kontroller.js).
import * as labb from './labb.js';
import { TREVIS_3_3, BERTIL_PK_BESTALLD_AV } from './seed/sussa-testdata.js';
// Runda 8, r3: testfall 5.1 till 5.3 och tema 7.
import { TIDIGARE_BESOK_5, GRUPP_5_3, INSKRIVNA_7, HANDELSER_7 } from './seed/sussa-testdata.js';
import * as avdelningsplan from './avdelningsplan.js';

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
    // Runda 8, r2: läkaren på mottagningen registrerade besöket, så att systemet föreslår henne som uppdragsgivare (2.2).
    vk('sus17', 'uso-kard-mott', { start: M(-30), plats: 'Kardiologiska mottagningen', orsak: 'Feber och frossa', av: 'lak-kard' });

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
    // Runda 8, r4: paracetamol som infusion med produktens dosering, och glukos med Addex-Magnesium som en ordination med
    // tillsats, som iordningsställs och ges tillsammans.
    const tillagg = (id, volym) => db.query("INSERT INTO ordination_tillagg (ordination_id, administrationssatt, volym_ml, vatskebalans) VALUES (?, 'intravenost', ?, 1)").run(id, volym);
    tillagg(ordination('sus01', 'uso-kard-72', 'VK-NPL-0062', { ...bOrd, dosering: '1 g (100 ml) som intravenös infusion under 15 minuter, engångsdos', dos: 1000, dosEnhet: 'mg', orsak: 'Smärta' }), 100);
    const glukos = ordination('sus01', 'uso-kard-72', 'VK-NPL-0057', { ...bOrd, dosering: '1000 ml Glucos Baxter 25 mg/ml buffrad med 20 mmol Addex-Magnesium, intravenöst under 2 timmar', dos: 1000, dosEnhet: 'ml', orsak: 'Vätska och magnesium' });
    tillagg(glukos, 1020);
    db.query('INSERT INTO ordination_spadning (ordination_id, losning, volym_ml, tid_min, tillsatser) VALUES (?, NULL, 1000, 120, ?)')
      .run(glukos, JSON.stringify([{ lakemedelId: 'VK-NPL-0051', mangd: 20, enhet: 'mmol', volymMl: 20 }]));
    ordination('sus01', 'uso-kard-72', 'VK-NPL-0065', { ...bOrd, dosering: '1 tablett som premedicinering 1 timme före röntgen', dos: 10, dosEnhet: 'mg', orsak: 'Premedicinering inför röntgen' });
    ordination('sus01', 'uso-kard-72', 'VK-NPL-0044', { ...bOrd, slut: null, uppfoljning: addDagar(basDatum, 14), tider: [], typ: 'vid_behov', dosering: '1 tablett vid behov till natten', dos: 5, dosEnhet: 'mg', orsak: 'Sömn' });

    // Gerda Ström (testfall 5.7), Susanne Svedin (5.4) och Jonas Brun (5.8): tidigare besök på kardiologiska mottagningen.
    vk('sus02', 'uso-kard-mott', { start: T(-30, '10:00'), slut: T(-30, '10:30'), plats: 'Kardiologiska mottagningen', orsak: 'Besök' });
    vk('sus13', 'uso-kard-mott', { start: T(-40, '13:00'), slut: T(-40, '13:30'), plats: 'Kardiologiska mottagningen', orsak: 'Besök' });
    vk('sus20', 'uso-kard-mott', { start: T(-50, '11:00'), slut: T(-50, '11:30'), plats: 'Kardiologiska mottagningen', orsak: 'Besök' });
    // Runda 13, r4: testfall 5.8 skickar en kallelse till Jonas Brun. Han har en påhittad adress, så att den går som brev
    // (simulerat), som för patienterna i testfall 5.1 till 5.3.
    db.query("UPDATE patienter SET adress = 'Påhittad gata 20 (demo)', postnr = '702 10' WHERE id = 'sus20' AND adress IS NULL").run();

    // Runda 8, r2: tio inkommande remisser från vårdcentralen till kardiologen (Medicinkliniken, Mottagning 1 i
    // Sussas testdata), kvitterade som mottagna och inte bedömda (testfall 2.3 och 2.4).
    const insR = db.query(`INSERT INTO remisser (patient_id, fran_enhet_id, till_enhet_id, avsandare_id, fragestallning, anamnes, prioritet, svar_senast, status,
      skickad_tid, mottagen_tid, mottagen_av, kalla) VALUES (?, 'vc-tybble', 'uso-kard', 'lak-vc', ?, ?, ?, ?, 'mottagen', ?, ?, 'adm-kard', 'vardkallan')`);
    REMISSER_2_3.forEach((r, i) => insR.run(r.patient, r.fragestallning, r.anamnes, r.prioritet ?? 'normal', addDagar(basDatum, 20), T(-3, `${String(8 + i).padStart(2, '0')}:00`), T(-2, `${String(8 + i).padStart(2, '0')}:30`)));
  })();
  // Runda 8, r2: pappersremissen från Behandlingshemmet Löparen är redan inskannad till kardiologen (testfall 2.5).
  laggTillSkanning(db, 'uso-kard', SKANNAD_2_5.namn, SKANNAD_2_5.rader, nu);

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
  // Runda 11, r1: räcker de 150 minuterna bakåt till före midnatt, fördelas tiderna jämnt mellan midnatt och en kvart
  // före nu, i samma ordning (tidigare kunde de hamna efter nu strax efter midnatt).
  const midnatt = Date.parse(lokalTid(basDatum, '00:00'));
  const tidigast = runda5(nu.getTime() - 150 * MIN);
  const sista = Math.max(midnatt + 5 * MIN, nu.getTime() - 15 * MIN);
  ANKOMNA_5_6.forEach((pid, i) => {
    const t = tidigast >= midnatt + 2 * MIN ? runda5(nu.getTime() - (150 - i * 25) * MIN)
      : Math.floor((midnatt + (i + 1) / ANKOMNA_5_6.length * (sista - midnatt)) / MIN) * MIN;
    const start = new Date(t).toISOString();
    const p = post(pid, { ve: 'vc-tybble', orsak: 'Återbesök hos läkare', mal: 30 });
    const { b } = tidbok.bokaPostRad(db, p, nyTid('sch-vc-per', start), { av: 'adm-kard' });
    const kom = new Date(Math.max(Date.parse(plus(start, -2)), midnatt)).toISOString();
    db.query("UPDATE bokningar SET status = 'incheckad', incheckad = ?, incheckad_via = 'reception', konummer = ? WHERE id = ?").run(kom, `K${String(i + 1).padStart(2, '0')}`, b.id);
    db.query('UPDATE vardkontakter SET ankomst = ? WHERE id = ?').run(kom, b.vardkontakt_id);
  });

  // Runda 8, r1: tema 3, beställning och svar (Bilaga F1:3 och F1:4, testfall 3.1 till 3.5).
  // Hamid Burvall (3.1) har kommit med feber och frossa till kardiologiska mottagningen och till vårdcentralen, och Laura
  // August (3.2) till kardiologiska mottagningen, så att systemet föreslår paketet och anamnesen. Inga Strand (3.5) är
  // inlagd på Avdelning 72 och har ett besök på vårdcentralen i dag.
  db.transaction(() => {
    const insVk = db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, plats, orsak, kalla, planerad, skapad, automatisk, ger_vardrelation)
      VALUES (?, ?, 'oppenvard', 'besok', ?, ?, ?, 'vardkallan', 0, ?, 0, 1)`);
    const besok = (pid, enhet, start, plats, orsak) => insVk.run(pid, enhet, start, plats, orsak, start);
    besok('sus19', 'uso-kard-mott', M(-15), 'Kardiologiska mottagningen', 'Feber och frossa');
    besok('sus19', 'vc-tybble', M(-10), 'Mottagning', 'Feber och frossa');
    besok('sus18', 'uso-kard-mott', M(-25), 'Kardiologiska mottagningen', 'Feber och frossa');
    besok('sus14', 'vc-tybble', M(-5), 'Mottagning', 'Uppföljning');
    const ve = 'uso-kard';
    const vt = Number(db.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, orsak, inskriven_av, kalla) VALUES ('sus14', ?, ?, 'Dehydrering och feber', 'ssk-kard', 'vardkallan')").run(ve, T(-1, '11:00')).lastInsertRowid);
    db.query("INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av) VALUES (?, 'inskrivning', ?, 'uso-kard-72', 'Avd 72, sal 9', 'ssk-kard')").run(vt, T(-1, '11:00'));
    db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, start, plats, orsak, kalla, planerad, vardtillfalle_id, skapad, skapad_av, automatisk, ger_vardrelation)
      VALUES ('sus14', 'uso-kard-72', 'slutenvard', ?, 'Avd 72, sal 9', 'Dehydrering och feber', 'vardkallan', 0, ?, ?, 'ssk-kard', 0, 1)`).run(T(-1, '11:00'), vt, T(-1, '11:00'));
  })();
  // Trevis Ljung (3.3): beställningen som läkaren gjorde i går, med blodstatus, B12, folat och urinodling, att ta i dag.
  labb.bestall(new Atkomst(db, pers(TREVIS_3_3.av), 'sus04', {}, 'bestalla_prov'), { analyser: TREVIS_3_3.analyser, anamnes: TREVIS_3_3.anamnes, planerad: T(0, TREVIS_3_3.klocka), kvitteraDubbletter: true }, new Date(T(-1, '16:00')));
  // Bertil Danielsson (3.4): provsvaren från vårdcentralen är beställda av läkaren där, så att beställande läkare syns.
  for (const m of db.query("SELECT * FROM matvarden WHERE patient_id = 'sus01' AND typ = 'inr' AND enhet_id = 'vc-tybble' ORDER BY tid").all()) {
    labb.kopplaBefintligtSvar(db, { matvardeId: m.id, analys: 'pk', ansvarig: BERTIL_PK_BESTALLD_AV, bestalld: plus(m.tid, -30) });
  }
  // Runda 8, r3: testfall 5.1 till 5.3.
  laggTillBokningsdata(db, { nu, T, plus });

  return { ok: true, redan: false, patienter: SUSSA_PATIENTER.length };
}

// Runda 8, r3: testfall 5.1 till 5.3. Patienterna har varit på mottagningen förut, med en signerad anteckning av den de
// träffade, och har en påhittad adress så att kallelsen kan skickas (som brev, simulerat). Fysioterapeuten får ett schema
// med gruppträffen i testfall 5.3.
function laggTillBokningsdata(db, { nu, T, plus }) {
  const basDatum = datumAv(nu);
  db.transaction(() => {
    TIDIGARE_BESOK_5.forEach((b, i) => {
      const start = T(-60 + i, '10:00');
      const vk = Number(db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, kalla, planerad, skapad, automatisk, ger_vardrelation)
        VALUES (?, 'uso-kard-mott', 'oppenvard', 'besok', ?, ?, 'Kardiologiska mottagningen', 'Besök', 'vardkallan', 0, ?, 0, 1)`).run(b.patient, start, plus(start, 30), start).lastInsertRowid);
      b.hos.forEach((av, j) => {
        const typ = j ? 'Omvårdnadsanteckning' : 'Mottagningsanteckning';
        db.query(`INSERT INTO anteckningar (patient_id, enhet_id, vardkontakt_id, typ, kategori, sokord, forfattare_id, skapad, status, signerad_tid, signerad_av, version, kalla)
          VALUES (?, 'uso-kard-mott', ?, ?, ?, ?, ?, ?, 'signerad', ?, ?, 1, 'vardkallan')`)
          .run(b.patient, vk, typ, j ? 'omvardnad' : 'lakare', JSON.stringify([{ sokord: 'Aktuellt', text: 'Besök på mottagningen.' }]), av, plus(start, 10 + j), plus(start, 15 + j), av);
      });
      db.query("UPDATE patienter SET adress = ?, postnr = '702 10' WHERE id = ? AND adress IS NULL").run(`Påhittad gata ${i + 1} (demo)`, b.patient);
    });
    const g = GRUPP_5_3;
    db.query('INSERT OR IGNORE INTO scheman (id, enhet_id, personal_id, yrkesroll) VALUES (?, ?, ?, ?)').run(g.schema, g.enhet, g.personal, 'fysioterapeut');
    let dag = addDagar(basDatum, g.dag);
    while ([0, 6].includes(new Date(`${dag}T12:00:00Z`).getUTCDay())) dag = addDagar(dag, 1);
    const start = lokalTid(dag, g.klocka);
    db.query("INSERT INTO tider (schema_id, start, slut, tidstyp, platser, rubrik, relativ) VALUES (?, ?, ?, 'grupp', ?, ?, 0)").run(g.schema, start, plus(start, g.minuter), g.platser, g.rubrik);
  })();
}

// Runda 8, r3: tema 7, gemensamma vyer. Fyra patienter till skrivs in på Avdelning 72, och de planerade händelserna i
// Bilaga F1:3 tabell 17 läggs in med Sussas dagar och klockslag räknade från i dag. Händelser som redan har varit är
// utförda. Läggs in en gång per sandlåda, efter Sussas testdata (POST /api/demo/sussa-avdelning).
export function laddaAvdelning(db, personal, { nu = new Date() } = {}) {
  if (!personal) throw new Fel(401, 'Logga in först.', 'ej_inloggad');
  if (!harTestdata(db)) laddaTestdata(db, personal, { nu });
  avdelningsplan.sakra(db);
  if (db.query("SELECT 1 FROM planerade_uppgifter WHERE kalla = 'sussa' LIMIT 1").get()) return { ok: true, redan: true };
  const basDatum = datumAv(nu);
  const T = (dag, klocka) => lokalTid(addDagar(basDatum, dag), klocka);
  db.transaction(() => {
    for (const x of INSKRIVNA_7) {
      const inskriven = T(-2, '10:00');
      const vt = Number(db.query("INSERT INTO vardtillfallen (patient_id, enhet_id, inskriven, utskriven, orsak, inskriven_av, kalla) VALUES (?, 'uso-kard', ?, NULL, ?, 'ssk-kard', 'vardkallan')").run(x.patient, inskriven, x.orsak).lastInsertRowid);
      db.query("INSERT INTO vardtillfalle_handelser (vardtillfalle_id, typ, tid, enhet_id, plats, av, detalj) VALUES (?, 'inskrivning', ?, 'uso-kard-72', ?, 'ssk-kard', NULL)").run(vt, inskriven, x.plats);
      db.query(`INSERT INTO vardkontakter (patient_id, enhet_id, typ, kontaktsatt, start, slut, plats, orsak, kalla, planerad, vardtillfalle_id, skapad, skapad_av, automatisk, ger_vardrelation)
        VALUES (?, 'uso-kard-72', 'slutenvard', NULL, ?, NULL, ?, ?, 'vardkallan', 0, ?, ?, 'ssk-kard', 0, 1)`).run(x.patient, inskriven, x.plats, x.orsak, vt, inskriven);
    }
    const ins = db.query(`INSERT INTO planerade_uppgifter (patient_id, enhet_id, typ, text, start, slut, yrke, ansvarig_id, status, skapad, skapad_av, utford, utford_av, kalla)
      VALUES (?, 'uso-kard-72', ?, ?, ?, ?, ?, ?, ?, ?, 'ssk-kard', ?, ?, 'sussa')`);
    for (const h of HANDELSER_7) {
      const typ = avdelningsplan.tolkaTyp(h.text);
      const start = T(h.dag, h.klocka);
      const slut = new Date(Date.parse(start) + avdelningsplan.TYPER[typ].min * MIN).toISOString();
      const yrke = h.ansvarig ? db.query('SELECT yrke FROM personal WHERE id = ?').get(h.ansvarig).yrke : avdelningsplan.TYPER[typ].yrke;
      const utford = Date.parse(slut) < nu.getTime() && h.dag < 0;
      ins.run(h.patient, typ, h.text, start, slut, yrke, h.ansvarig ?? null, utford ? 'utford' : 'planerad', T(-5, '08:00'), utford ? slut : null, utford ? 'ssk-kard' : null);
    }
  })();
  return { ok: true, redan: false, uppgifter: HANDELSER_7.length };
}
