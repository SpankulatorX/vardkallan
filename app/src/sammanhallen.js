// Sammanhållen journalföring med en annan vårdgivare (runda 10, r5, Sussa 3.2.2.3), lagen (2022:913) om sammanhållen vård- och omsorgsdokumentation 3 kap.
//
// Vårdkällan är konsument: uppgifter som har skapats hos en annan vårdgivare hämtas och visas i samma kronologi som
// patientens egna uppgifter, med vårdgivaren, vårdenheten, yrkesrollen, den som skapade uppgiften och tiden utskrivna.
// Den andra vårdgivaren och dess uppgifter är simulerade i demon och märkta som simulerade.
//
// Systemet är experten. Det vet själv om patienten har ett samtycke registrerat på vårdenheten, frågar efter samtycket
// bara när det saknas, kräver ett aktivt val med syfte innan något hämtas och lägger uppgifterna i tidslinjen, så att
// användaren inte behöver öppna ett annat system. Patientens spärrar hos den andra vårdgivaren följer med: den
// vårdgivaren lämnar aldrig ut spärrade uppgifter. Runda 13, r3 (lagrumsgranskningen): systemet säger att det finns
// spärrade uppgifter om patienten hos en annan vårdgivare, eftersom HSLF-FS 2016:40 4 kap. 7 § första stycket kräver
// det, men inte vilken vårdgivare, vilket slag av uppgift eller hur många. Vilken vårdgivare som har spärrat visas
// inte alls: lagen (2022:913) 2 kap. 5 § medger det bara vid fara (3 kap. 5 och 6 §§), och den vägen finns inte i demon.
//
// Behörighet (lag 2022:913 3 kap. 1, 3 och 6 §§, som ersatte patientdatalagen 6 kap.). Bara den som har en aktuell patientrelation och får läsa journalen tar del av
// uppgifterna, och bara om patienten samtycker. Utan samtycke får uppgifterna hämtas vid nödåtkomst, när patienten inte
// kan samtycka och uppgifterna behövs för vård som patienten oundgängligen behöver. Varje hämtning loggas på patienten
// med vårdgivaren och syftet. Samtycket gäller vårdenheten och kan återkallas, och då tas det aktiva valet bort.
import { Fel, iso } from './db.js';
import { vardenhetFor } from './atkomst.js';
import { loggaRad } from './logg.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sammanhallen_samtycken (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, registrerat TEXT NOT NULL, registrerat_av TEXT NOT NULL,
  aterkallat TEXT, aterkallat_av TEXT
);
CREATE TRIGGER IF NOT EXISTS sj_samtycke_raderas_ej BEFORE DELETE ON sammanhallen_samtycken BEGIN SELECT RAISE(ABORT, 'Ett samtycke raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS sj_samtycke_andras_ej BEFORE UPDATE OF patient_id, enhet_id, registrerat, registrerat_av ON sammanhallen_samtycken
  BEGIN SELECT RAISE(ABORT, 'Ett samtycke ändras inte'); END;
`;
export const sakra = (db) => db.exec(SCHEMA);

// Den simulerade vårdgivaren. Id och namn är påhittade.
export const VARDGIVARE = { hsaId: 'DEMO-VG-0001', namn: 'Hälsohuset Vårdgivare AB (simulerad)', simulerad: true };
export const ENHETER = {
  vc: { hsaId: 'DEMO-VG-0001-E01', namn: 'Hälsohuset vårdcentral (simulerad)' },
  ort: { hsaId: 'DEMO-VG-0001-E02', namn: 'Hälsohuset ortopedmottagning (simulerad)' },
};
const ROLL = { lakare: 'Läkare', sjukskoterska: 'Sjuksköterska', fysioterapeut: 'Fysioterapeut' };

// Uppgifterna hos den simulerade vårdgivaren. sparrad: patienten har spärrat uppgiften där, och den lämnas aldrig ut.
const P = (id, typ, tid, enhet, roll, av, rubrik, text, extra = {}) => ({ id, typ, tid, enhet, roll, av, rubrik, text, ...extra });
export const POSTER = {
  p01: [
    P('hh-1', 'vardkontakt', '2025-09-12T08:30:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Besök på vårdcentralen', 'Kontroll av blodtryck och förmaksflimmer.'),
    P('hh-2', 'anteckning', '2025-09-12T09:05:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Mottagningsanteckning', 'Blodtryck 142/84. Ingen andfåddhet. Fortsatt behandling med warfarin, PK(INR) följs på vårdcentralen.'),
    P('hh-3', 'diagnos', '2025-09-12T09:05:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Essentiell hypertoni (I10.9)', 'Bidiagnos.'),
    P('hh-4', 'lakemedel', '2025-09-12T09:10:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Amlodipin 5 mg', '1 tablett på morgonen mot högt blodtryck.'),
    P('hh-5', 'vardkontakt', '2026-03-04T13:00:00.000Z', 'ort', 'fysioterapeut', 'Demofysioterapeut Hälsohuset', 'Besök hos fysioterapeut', 'Träning efter fall i hemmet.'),
    P('hh-6', 'anteckning', '2026-03-04T13:40:00.000Z', 'ort', 'fysioterapeut', 'Demofysioterapeut Hälsohuset', 'Fysioterapeutanteckning', 'Balansträning, går med rollator utomhus. Uppföljning om fyra veckor.'),
    // Spärrad hos den andra vårdgivaren på patientens begäran.
    P('hh-7', 'anteckning', '2024-05-20T10:00:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Samtal om alkoholvanor', 'Uppgiften är spärrad hos vårdgivaren.', { sparrad: true }),
  ],
  p13: [
    P('hh-20', 'vardkontakt', '2026-08-02T15:00:00.000Z', 'vc', 'sjukskoterska', 'Demosjuksköterska Hälsohuset', 'Telefonrådgivning', 'Ont i foten efter fotbollsträning.'),
    P('hh-21', 'lakemedel', '2026-08-02T15:20:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Ibuprofen 400 mg', 'Vid behov högst tre gånger per dygn, i högst fem dagar.'),
    P('hh-22', 'diagnos', '2023-01-10T09:00:00.000Z', 'vc', 'lakare', 'Demoläkare Hälsohuset', 'Astma (J45.9)', 'Huvuddiagnos.', { sparrad: true }),
  ],
};
const TYPTEXT = { vardkontakt: 'Vårdkontakt', anteckning: 'Anteckning', diagnos: 'Diagnos', lakemedel: 'Läkemedel' };
export const ETIKETT = `Hämtad från ${VARDGIVARE.namn} genom sammanhållen journalföring`;

// Runda 13, r3: uppgiften att det finns spärrade uppgifter hos en annan vårdgivare, och inget mer.
export const SPARR_TEXT = 'Det finns spärrade uppgifter om patienten hos en annan vårdgivare.';

// ---------------------------------------------------------------------------------------------------------------
// Runda 14, r2: uppgifterna hämtas med tjänstekontrakten i RIVTA (Sussa 2.2.1.3, 2.2.1.4 och 2.2.1.10). Vårdkällan är
// konsument: GetCareDocumentation, GetDiagnosis, GetCareContacts och GetMedicationHistory mot den aggregerande tjänsten,
// och CheckBlocks mot spärrtjänsten för varje uppgift innan den visas. Tjänsterna är simulerade i demon
// (rivta/nationella.js). Varje begäran och varje svar valideras mot det pinnade schemat.
// Kontrollen är stängd när den inte kan avgöras: svarar spärrtjänsten inte, eller går ett svar inte att läsa, visas
// inga uppgifter från andra vårdgivare, och systemet säger varför.
export const EJ_SVAR_TEXT = 'Uppgifter från andra vårdgivare kan inte visas just nu, eftersom de nationella tjänsterna för sammanhållen journalföring inte svarar. Inget visas förrän spärrarna har kunnat kontrolleras.';
const OID_PNR = '1.2.752.129.2.1.3.1';
const OID_SAMORDNING = '1.2.752.129.2.1.3.3';
const KONTRAKT_TYP = [['GetCareContacts', 'careContact', 'careContactHeader', 'vardkontakt'], ['GetCareDocumentation', 'careDocumentation', 'careDocumentationHeader', 'anteckning'],
  ['GetDiagnosis', 'diagnosis', 'diagnosisHeader', 'diagnos'], ['GetMedicationHistory', 'medicationMedicalRecord', 'medicationMedicalRecordHeader', 'lakemedel']];

// En tid i kontraktens form (ÅÅÅÅMMDDTTMMSS, svensk tid) som ISO i UTC.
export function franRivTid(ts) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(ts ?? ''));
  if (!m) return null;
  const som = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  let t = som;
  for (let i = 0; i < 2; i++) {
    const d = new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T');
    t += som - Date.parse(`${d}Z`);
  }
  return new Date(t).toISOString();
}
// Typerna av vårdkontakt i GetCareContacts.
const KONTAKTTYP = { 1: 'Besök', 2: 'Telefonkontakt', 3: 'Vårdtillfälle', 4: 'Dagsjukvård', 5: 'Vårdkontakt' };
const isoUtanZ = (iso) => iso.replace(/\.\d+Z$/, '').replace(/Z$/, '');

let nationellaModul = null;
const nationella = () => {
  if (!nationellaModul) nationellaModul = { ...require('./rivta/nationella.js'), vardgivare: require('./rivta/konsumenter.js').vardgivare };
  return nationellaModul;
};
function aktorFor(atk) {
  const db = atk.db;
  const ve = vardenhetFor(db, atk.personal.enhet_id);
  return {
    EmployeeId: atk.personal.hsa_id ?? atk.personal.id, CareProviderId: nationella().vardgivare(db),
    CareUnitId: db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(ve)?.hsa_id ?? ve,
  };
}
function patientIdFor(db, patientId) {
  const p = db.query('SELECT personnummer, id_typ FROM patienter WHERE id = ?').get(patientId);
  return p ? { id: p.personnummer, type: p.id_typ === 'samordningsnummer' ? OID_SAMORDNING : OID_PNR } : null;
}

// Uppgifterna från andra vårdgivare som får visas för den inloggade: hämtade och prövade mot spärrtjänsten.
// Ger { poster, fel }. fel är en text när något inte kunde avgöras, och då är poster tom.
function tjanst(atk) {
  const db = atk.db;
  const n = nationella();
  const pid = patientIdFor(db, atk.patientId);
  if (!pid) return { poster: [], fel: null };
  const egen = n.vardgivare(db);
  const ut = [];
  try {
    for (const [kontrakt, lista, huvudNamn, typ] of KONTRAKT_TYP) {
      const svar = n.anropa(db, kontrakt, { patientId: pid });
      for (const x of svar[lista] ?? []) {
        const h = x[huvudNamn];
        const vg = h.sourceSystemHSAId ?? h.sourceSystemHSAid;
        if (vg === egen) continue;
        const a = h.accountableHealthcareProfessional ?? {};
        const tid = franRivTid(h.documentTime ?? a.authorTime ?? x.careContactBody?.careContactTimePeriod?.start);
        if (!tid) continue;
        const enhet = a.healthcareProfessionalOrgUnit ?? x.careContactBody?.careContactOrgUnit ?? null;
        const text = x.careDocumentationBody?.clinicalDocumentNote?.clinicalDocumentNoteText ?? x.careContactBody?.careContactReason
          ?? x.medicationMedicalRecordBody?.medicationPrescription?.prescriptionNote ?? (x.diagnosisBody ? (x.diagnosisBody.typeOfDiagnosis === 'Huvuddiagnos' ? 'Huvuddiagnos.' : 'Bidiagnos.') : '');
        ut.push({
          id: h.documentId, typ, typText: TYPTEXT[typ], tid, rubrik: h.documentTitle ?? (x.careContactBody ? `${KONTAKTTYP[x.careContactBody.careContactCode] ?? 'Vårdkontakt'} på ${enhet?.orgUnitName ?? 'okänd vårdenhet'}` : TYPTEXT[typ]), text,
          vardgivare: { hsaId: vg, namn: vg === VARDGIVARE.hsaId ? VARDGIVARE.namn : vg },
          vardenhet: { hsaId: enhet?.orgUnitHSAId ?? null, namn: enhet?.orgUnitName ?? 'Okänd vårdenhet' },
          yrkesroll: a.healthcareProfessionalRoleCode?.displayName ?? 'Okänd yrkesroll', skapadAv: a.healthcareProfessionalName ?? 'Okänd',
          kalla: `extern:${vg}`, kallaEtikett: vg === VARDGIVARE.hsaId ? ETIKETT : `Hämtad från ${vg} genom sammanhållen journalföring`,
        });
      }
    }
    if (!ut.length) return { poster: [], fel: null };
    // Varje uppgift prövas mot spärrtjänsten för den som läser. Bara det som tjänsten svarar OK för visas.
    const svar = n.anropa(db, 'CheckBlocks', {
      AccessingActor: aktorFor(atk), PatientId: pid.id,
      InformationEntities: ut.map((p, i) => ({ InformationStartDate: isoUtanZ(p.tid), InformationEndDate: isoUtanZ(p.tid), InformationCareUnitId: p.vardenhet.hsaId ?? '',
        InformationCareProviderId: p.vardgivare.hsaId, RowNumber: i })),
    });
    const res = svar.CheckBlocksResultType;
    if (res.Result.ResultCode !== 'OK') return { poster: [], fel: EJ_SVAR_TEXT };
    const ok = new Set((res.CheckResults ?? []).filter(r => r.Status === 'OK').map(r => Number(r.RowNumber)));
    return { poster: ut.filter((_, i) => ok.has(i)), fel: null };
  } catch (e) {
    if (e?.kod) return { poster: [], fel: EJ_SVAR_TEXT };
    throw e;
  }
}

// Om det finns spärrade uppgifter om patienten hos en annan vårdgivare, enligt spärrtjänsten (GetAllBlocksForPatient).
// Ger null när tjänsten inte svarar.
function harSparrade(atk) {
  const db = atk.db;
  const n = nationella();
  const pid = patientIdFor(db, atk.patientId);
  if (!pid) return false;
  try {
    const svar = n.anropa(db, 'GetAllBlocksForPatient', { PatientId: pid.id });
    const egen = n.vardgivare(db);
    return (svar.BlockHeaderType.Blocks ?? []).some(b => b.BlockType === 'Outer' && b.InformationCareProviderId !== egen);
  } catch (e) {
    if (e?.kod) return null;
    throw e;
  }
}

// Samtycket i samtyckestjänsten (Sussa 2.2.1.4). Ett samtycke som registreras i Vårdkällan registreras samtidigt i
// tjänsten, med samma id, och ett återkallat samtycke återkallas där. Har tjänsten inget samtycke som Vårdkällan har,
// registreras det i tjänsten igen, eftersom Vårdkällans register är där samtycket gavs. Ett samtycke som bara finns i
// tjänsten räknas inte förrän det är registrerat i Vårdkällan, så att det strängaste gäller.
// Samtyckets id i tjänsten sparas i rivta_samtycke_intyg, så att det kan återkallas där. Ett samtycke som registreras
// igen får ett nytt id.
const sakraIntyg = (db) => db.exec('CREATE TABLE IF NOT EXISTS rivta_samtycke_intyg (intyg_id TEXT PRIMARY KEY, samtycke_id INTEGER NOT NULL, patient_id TEXT NOT NULL, registrerat TEXT NOT NULL)');
function aktion(atk) {
  const nu = isoUtanZ(new Date().toISOString());
  const aktor = { EmployeeId: atk.personal.hsa_id ?? atk.personal.id };
  return { RequestDate: nu, RequestedBy: aktor, RegistrationDate: nu, RegisteredBy: aktor };
}
function synkaSamtycke(atk, s) {
  const db = atk.db;
  const n = nationella();
  const pid = patientIdFor(db, atk.patientId);
  if (!pid || !s) return;
  try {
    const a = aktorFor(atk);
    if (!n.anropa(db, 'CheckConsent', { AccessingActor: a, PatientId: pid.id }).CheckResultType.HasConsent) {
      sakraIntyg(db);
      const id = `vk-${s.id}-${n.nyttId().slice(0, 18)}`;
      const r = n.anropa(db, 'RegisterExtendedConsent', { AssertionId: id, AssertionType: 'Consent', Scope: 'NationalLevel', PatientId: pid.id,
        CareProviderId: a.CareProviderId, CareUnitId: a.CareUnitId, RegistrationAction: aktion(atk) });
      if (r.ResultType.ResultCode === 'OK') db.query('INSERT INTO rivta_samtycke_intyg (intyg_id, samtycke_id, patient_id, registrerat) VALUES (?, ?, ?, ?)').run(id, s.id, atk.patientId, iso());
    }
  } catch (e) { if (!e?.kod) throw e; }
}
function aterkallaNationellt(atk, s) {
  const db = atk.db;
  sakraIntyg(db);
  for (const { intyg_id: id } of db.query('SELECT intyg_id FROM rivta_samtycke_intyg WHERE samtycke_id = ?').all(s.id)) {
    try { nationella().anropa(db, 'CancelExtendedConsent', { AssertionId: id, CancellationAction: aktion(atk) }); } catch (e) { if (!e?.kod) throw e; }
  }
}

const personKort = (db, id) => { const p = id && db.query('SELECT id, namn, titel FROM personal WHERE id = ?').get(id); return p ? { id: p.id, namn: p.namn, titel: p.titel } : null; };
function samtyckeFor(db, personal, patientId) {
  const ve = vardenhetFor(db, personal.enhet_id);
  return db.query('SELECT * FROM sammanhallen_samtycken WHERE patient_id = ? AND aterkallat IS NULL ORDER BY id DESC').all(patientId).find(s => vardenhetFor(db, s.enhet_id) === ve) ?? null;
}
const samtyckeUt = (db, s) => (s ? { id: s.id, registrerat: s.registrerat, registreratAv: personKort(db, s.registrerat_av) } : null);
// Säkerhetsgranskningen av runda 10 (beslut 2026-11-08): valet ligger i sessionens aktiva val för patienten (s.val), så
// att det rensas överallt där de aktiva valen rensas (inloggning, utloggning, inaktivitet, ogiltigt uppdrag, invånare och
// återställning). Det är dessutom bundet till personen och vårdenheten som gjorde det, och gäller bara när båda stämmer.
function valFor(sess, pid, atk) {
  const v = sess?.val?.[pid]?.sammanhallen ?? null;
  if (!v || !atk?.personal || v.personalId !== atk.personal.id || v.vardenhet !== vardenhetFor(atk.db, atk.personal.enhet_id)) return null;
  return v;
}

function prova(atk) {
  const r = atk.krav('las_journal', { beskrivning: 'sammanhallen' });
  return r.grund === 'nodatkomst' ? 'nodatkomst' : 'samtycke';
}

// Uppgifterna efter sortering och urval. sortera: nyast (standard) eller aldst. typ: en av typerna, eller alla.
function urval(poster, { sortera = 'nyast', typ = null } = {}) {
  const ut = typ && Object.hasOwn(TYPTEXT, typ) ? poster.filter(p => p.typ === typ) : [...poster];
  return ut.sort((a, b) => (sortera === 'aldst' ? a.tid.localeCompare(b.tid) : b.tid.localeCompare(a.tid)));
}

// GET: läget för patienten. Uppgifterna finns bara med när de har hämtats efter ett aktivt val i sessionen.
export function lage(atk, sess, fraga = {}) {
  atk.krav('las_journal');
  const db = atk.db;
  const val = valFor(sess, atk.patientId, atk);
  const samtycke = samtyckeFor(db, atk.personal, atk.patientId);
  // Ett aktivt val som bygger på samtycke upphör när samtycket återkallas.
  const giltigt = val && (val.grund === 'nodatkomst' ? atk.prova('las_journal').grund === 'nodatkomst' : Boolean(samtycke));
  if (giltigt && samtycke) synkaSamtycke(atk, samtycke);
  const hamtat = giltigt ? tjanst(atk) : { poster: [], fel: null };
  const poster = urval(hamtat.poster, fraga);
  if (giltigt && !hamtat.fel) loggaHamtning(atk, val);
  const sparrade = harSparrade(atk);
  return {
    vardgivare: [VARDGIVARE], hamtad: Boolean(giltigt), grund: giltigt ? val.grund : null, samtycke: samtyckeUt(db, samtycke), poster,
    // Runda 13, r3 (HSLF-FS 2016:40 4 kap. 7 §): före och efter hämtningen.
    sparradeHosAnnan: sparrade === true, sparrText: sparrade ? SPARR_TEXT : null,
    // Runda 14, r2: när de nationella tjänsterna inte svarar visas ingenting, och texten säger varför.
    ...(hamtat.fel ? { fel: hamtat.fel } : {}),
    typer: TYPTEXT, simulerad: 'Den andra vårdgivaren och dess uppgifter är simulerade i demon.',
    text: hamtat.fel ? hamtat.fel : giltigt ? `${poster.length} uppgifter från ${VARDGIVARE.namn}.` : samtycke ? 'Patienten har samtyckt. Gör ett aktivt val för att hämta uppgifterna från den andra vårdgivaren.' : 'Patienten kan ha uppgifter hos en annan vårdgivare. Fråga om samtycke för att hämta dem.',
  };
}

function loggaHamtning(atk, val) {
  loggaRad(atk.db, { personal_id: atk.personal.id, enhet_id: atk.personal.enhet_id, patient_id: atk.patientId, handling: 'las_journal', resurs: `sammanhallen:${VARDGIVARE.hsaId}`,
    grund: val.grund, syfte: val.syfte, resultat: 'tillaten' });
}

// POST: det aktiva valet med syfte, och samtycket om det inte redan finns. body: { syfte, samtycke? }
export function hamta(atk, sess, body = {}) {
  const grund = prova(atk);
  const db = atk.db;
  const syfte = typeof body.syfte === 'string' ? body.syfte.trim().slice(0, 300) : '';
  if (syfte.length < 3) throw new Fel(400, 'Ange syftet med att hämta uppgifterna från den andra vårdgivaren.', 'ogiltig', { falt: ['syfte'] });
  if (grund !== 'nodatkomst' && !samtyckeFor(db, atk.personal, atk.patientId)) {
    if (body.samtycke !== true) throw new Fel(400, 'Uppgifter från en annan vårdgivare hämtas bara om patienten samtycker. Fråga patienten och registrera samtycket.', 'ogiltig', { falt: ['samtycke'] });
    db.query('INSERT INTO sammanhallen_samtycken (patient_id, enhet_id, registrerat, registrerat_av) VALUES (?, ?, ?, ?)').run(atk.patientId, atk.personal.enhet_id, iso(), atk.personal.id);
    // Runda 14, r2: samtycket registreras också i samtyckestjänsten.
    synkaSamtycke(atk, samtyckeFor(db, atk.personal, atk.patientId));
  }
  sess.val ??= {};
  sess.val[atk.patientId] = { ...(sess.val[atk.patientId] ?? {}), sammanhallen: { grund, syfte, tid: iso(), personalId: atk.personal.id, vardenhet: vardenhetFor(db, atk.personal.enhet_id) } };
  atk.loggad = true;
  return lage(atk, sess, {});
}

// POST: återkallar samtycket på vårdenheten och tar bort det aktiva valet.
export function aterkalla(atk, sess) {
  atk.krav('las_journal');
  const db = atk.db;
  const s = samtyckeFor(db, atk.personal, atk.patientId);
  if (s) db.query('UPDATE sammanhallen_samtycken SET aterkallat = ?, aterkallat_av = ? WHERE id = ?').run(iso(), atk.personal.id, s.id);
  // Runda 14, r2: och i samtyckestjänsten.
  if (s) aterkallaNationellt(atk, s);
  if (sess.val?.[atk.patientId]) delete sess.val[atk.patientId].sammanhallen;
  atk.logga('las_journal', atk.grund(), 'sammanhallen:samtycke:aterkallat');
  return lage(atk, sess, {});
}

// Runda 14, r2: tillfällig hävning av spärr med patientens samtycke i stunden (Sussa 2.2.1.3, RegisterTemporaryExtendedRevoke).
// Systemet vet själv vilka spärrar hos andra vårdgivare som gäller patienten, och hävningen gäller bara den inloggade
// på sin vårdenhet till dagens slut. Den kräver ett gällande aktivt val och att patienten samtycker nu. Vilken
// vårdgivare som har spärren visas inte. body: { samtycke: true }
export function havSparr(atk, sess, body = {}) {
  atk.krav('samtycke_sparr');
  const db = atk.db;
  if (!giltigtVal(atk, sess)) throw new Fel(400, 'Gör först ett aktivt val för att hämta uppgifter från andra vårdgivare.', 'ogiltig');
  if (body.samtycke !== true) throw new Fel(400, 'En spärr hävs bara om patienten samtycker nu. Fråga patienten.', 'ogiltig', { falt: ['samtycke'] });
  const n = nationella();
  const pid = patientIdFor(db, atk.patientId);
  const a = aktorFor(atk);
  let block;
  try { block = (n.anropa(db, 'GetAllBlocksForPatient', { PatientId: pid.id }).BlockHeaderType.Blocks ?? []).filter(b => b.BlockType === 'Outer' && b.InformationCareProviderId !== a.CareProviderId); } catch (e) {
    if (e?.kod) throw new Fel(503, 'Spärrtjänsten svarar inte, så spärren kan inte hävas just nu. Försök igen om en stund.', 'ej_tillganglig');
    throw e;
  }
  const slut = n.slutPaDagen();
  for (const b of block) {
    const r = n.anropa(db, 'RegisterTemporaryExtendedRevoke', { TemporaryRevokeId: n.nyttId(), BlockId: b.BlockId, EndDate: slut, RevokedForCareUnitId: a.CareUnitId,
      RevokedForEmployeeId: a.EmployeeId, RegisterAction: aktion(atk), RevokeReason: 'PatientsConsent', ReplicationTimeout: 0 });
    if (r.ResultType.ResultCode !== 'OK') throw new Fel(409, 'Spärrtjänsten registrerade inte hävningen. Inget har ändrats för den spärren.', 'ogiltig');
  }
  loggaRad(db, { personal_id: atk.personal.id, enhet_id: atk.personal.enhet_id, patient_id: atk.patientId, handling: 'samtycke_sparr', resurs: 'sammanhallen:sparr:havd',
    grund: 'samtycke_sparr', syfte: 'Patienten samtyckte till att spärrade uppgifter hos en annan vårdgivare visas i dag.', resultat: 'tillaten' });
  atk.loggad = true;
  return lage(atk, sess, {});
}

// Runda 14, r2: Vårdkällans egna spärrar jämförs med spärrtjänsten (GetBlocksForPatient för vårdgivaren). Inom
// vårdgivaren gäller Vårdkällans spärrar, som behörighetsmotorn prövar. Skiljer de sig åt gäller det strängaste: en
// spärr som bara finns i tjänsten ska registreras i Vårdkällan, och en spärr som bara finns i Vårdkällan gäller och ska
// registreras i tjänsten. Systemet ändrar aldrig en spärr själv, utan visar skillnaden för vårdadministratören.
export function jamforSparrar(atk) {
  atk.krav('registrera_sparr');
  const db = atk.db;
  const n = nationella();
  const pid = patientIdFor(db, atk.patientId);
  const vg = n.vardgivare(db);
  const hsa = (e) => db.query('SELECT hsa_id FROM enheter WHERE id = ?').get(vardenhetFor(db, e))?.hsa_id ?? null;
  const namn = (h) => db.query('SELECT namn FROM enheter WHERE hsa_id = ?').get(h)?.namn ?? h;
  const lokala = new Set(db.query('SELECT enhet_id FROM sparrar WHERE patient_id = ? AND aktiv = 1').all(atk.patientId).map(r => hsa(r.enhet_id)).filter(Boolean));
  let tjansten;
  try { tjansten = new Set((n.anropa(db, 'GetBlocksForPatient', { PatientId: pid.id, CareProviderId: vg }).BlockHeaderType.Blocks ?? []).filter(b => b.BlockType === 'Inner').map(b => b.InformationCareUnitId)); } catch (e) {
    if (e?.kod) return { stammer: null, text: 'Spärrtjänsten svarar inte, så spärrarna kan inte jämföras just nu. Vårdkällans egna spärrar gäller som vanligt.' };
    throw e;
  }
  const baraVardkallan = [...lokala].filter(h => !tjansten.has(h)).map(namn);
  const baraTjansten = [...tjansten].filter(h => !lokala.has(h)).map(namn);
  atk.logga('registrera_sparr', 'administrativ', 'sammanhallen:sparr:jamforelse');
  const stammer = !baraVardkallan.length && !baraTjansten.length;
  return {
    stammer, baraVardkallan, baraTjansten,
    text: stammer ? 'Vårdkällans spärrar stämmer med spärrtjänsten.'
      : `Spärrarna skiljer sig åt, och det strängaste gäller.${baraTjansten.length ? ` Spärrtjänsten har en spärr för ${baraTjansten.join(', ')} som saknas i Vårdkällan: registrera den här efter att ha stämt av med patienten.` : ''}${baraVardkallan.length ? ` Vårdkällan har en spärr för ${baraVardkallan.join(', ')} som saknas i spärrtjänsten: spärren gäller i Vårdkällan och behöver registreras i tjänsten.` : ''}`,
  };
}

// Runda 11, r5: bilder hos den andra vårdgivaren hämtas på samma samtycke och efter samma regel (bildmedia.js).
// Valet görs med hamta (syfte, och samtycket om det saknas), och giltigtVal ger det aktiva valet när det gäller: bundet
// till sessionen, patienten, personen och vårdenheten, och till ett samtycke som inte är återkallat eller till nödåtkomst.
export const harSamtycke = (db, personal, patientId) => Boolean(samtyckeFor(db, personal, patientId));
export function giltigtVal(atk, sess) {
  const val = valFor(sess, atk.patientId, atk);
  if (!val || !atk.prova('las_journal').tillaten) return null;
  const giltigt = val.grund === 'nodatkomst' ? atk.prova('las_journal').grund === 'nodatkomst' : Boolean(samtyckeFor(atk.db, atk.personal, atk.patientId));
  return giltigt ? val : null;
}

// För översiktens tidslinje: de hämtade uppgifterna i samma form som Vårdkällans egna, när det aktiva valet gäller.
export function tidslinje(atk, sess) {
  const val = valFor(sess, atk.patientId, atk);
  if (!val || !atk.prova('las_journal').tillaten) return [];
  const giltigt = val.grund === 'nodatkomst' ? atk.prova('las_journal').grund === 'nodatkomst' : Boolean(samtyckeFor(atk.db, atk.personal, atk.patientId));
  if (!giltigt) return [];
  const hamtat = tjanst(atk);
  if (hamtat.fel) return [];
  loggaHamtning(atk, val);
  return hamtat.poster.map(p => ({
    tid: p.tid, typ: 'extern', rubrik: `${p.typText}: ${p.rubrik}`, text: `${p.text} ${p.yrkesroll}, ${p.skapadAv}.`, enhet: { id: p.vardenhet.hsaId, namn: p.vardenhet.namn },
    kalla: p.kalla, kallaEtikett: `${ETIKETT}. ${p.vardenhet.namn}, ${p.yrkesroll.toLowerCase()}.`, ref: { typ: 'extern', id: p.id },
  }));
}
