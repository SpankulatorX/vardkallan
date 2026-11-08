// Skrivning via FHIR R4 (runda 6, r5, Sussa 2.5.1.1 till 2.5.1.3). En FHIR-resurs översätts till exakt samma anrop
// som gränssnittet gör, och anropet går genom samma rutt i servern: samma funktion, samma behörighetsmotor, samma
// varningar och samma loggning. Det finns ingen egen väg förbi reglerna. Det gränssnittet inte kan göra kan API:t
// inte heller göra, och då förklarar svaret varför på vanlig svenska i en OperationOutcome.
//
// kor(metod, vag, kropp) gör anropet genom serverns routningstabell och ger { status, data } eller kastar Fel.
import { Fel, idag, addDagar, giltigtDatum } from './db.js';
import { MATTYPER } from './journal.js';
import { MATKOD, ACVPU_KOD, SYSTEM as KOD } from './kodverk.js';
import { EXT, CS, UTTRYCK } from './fhir-definitioner.js';
import * as fhir from './fhir.js';
import * as tidbokFhir from './tidbok-fhir.js';
// Runda 10, r6: remiss eller konsultation ur ServiceRequest.category (remiss-r10.js).
import { fhirTyp as remissTyp } from './remiss-r10.js';

// Resurstyperna som går att skapa och ändra, och vad gränssnittet gör för var och en.
export const SKRIVBARA = {
  Observation: { skapa: true, andra: false, text: 'Mätvärden registreras som i fliken Mätvärden. Ett registrerat mätvärde ändras inte.' },
  Composition: { skapa: true, andra: true, text: 'Anteckningar skapas som utkast eller signeras direkt. Ett utkast ändras, och en signerad anteckning rättas med en ny version.' },
  MedicationRequest: { skapa: true, andra: true, text: 'Ordination med samma kontroller och varningar som i läkemedelslistan. En ordination ändras genom att den sätts ut.' },
  ServiceRequest: { skapa: true, andra: false, text: 'Remiss med samma förval som i gränssnittet. Mottagaren sköter resten av remissens statuskedja i gränssnittet.' },
  // Runda 9, r6: bokning av en remiss och inskrivning (Sussa 2.5.1.3).
  Appointment: { skapa: true, andra: false, text: 'En tid bokas för en remiss på väntelistan, med ServiceRequest i Appointment.basedOn. Utan Slot väljer systemet den tid som det föreslår först, som i gränssnittet. Incheckning görs med PATCH.' },
  Encounter: { skapa: true, andra: false, text: 'Inskrivning i slutenvård (class IMP). Systemet föreslår avdelningen och orsaken som i gränssnittet. Besök registreras, och patienter flyttas och skrivs ut, i gränssnittet.' },
  // Runda 9, r6: diagnoser på vårdkontakten, med samma funktion som när läkaren rättar en rapport (Sussa 2.5.1.1).
  Condition: { skapa: true, andra: false, text: 'Diagnoser registreras på en vårdkontakt med en kod ur ICD-10-SE, som i gränssnittet. Systemet sätter texten, datumet och om det är huvud- eller bidiagnos. En registrerad diagnos ändras inte.' },
};
// Resurstyper som går att läsa men inte skriva, med förklaringen.
export const INTE_SKRIVBARA = {
  AllergyIntolerance: 'Överkänslighet registreras inte i gränssnittet i den här versionen, och därför inte heller via API:t. Graden bekräftas i patientens uppmärksamhetsinformation.',
  Patient: 'Patienter registreras och får nya identiteter i gränssnittet, som tolkar numret och letar dubbletter. Den vägen finns inte i FHIR-API:t än.',
};
export const TABORT_TEXT = 'Journaluppgifter tas aldrig bort. En anteckning rättas med en ny version, ett läkemedel sätts ut och en dos makuleras, och det tidigare står kvar.';


// OperationOutcome med svensk text. issue är det huvudsakliga felet, sedan en rad per varning.
export function utfall(typ, e) {
  const kod = e.kod ?? 'ogiltig';
  const code = { 401: 'login', 403: 'forbidden', 404: 'not-found', 405: 'not-supported', 409: 'conflict', 413: 'too-long', 415: 'not-supported' }[e.status] ?? 'invalid';
  const falt = Array.isArray(e.extra?.falt) ? e.extra.falt : [];
  const uttryck = falt.map(f => UTTRYCK[typ]?.[f]).filter(Boolean);
  const issue = [{
    severity: 'error', code, diagnostics: e.message,
    details: { coding: [{ system: fhir.SYSTEM.felkod, code: kod }], text: e.message },
    ...(uttryck.length ? { expression: uttryck } : {}),
  }];
  const kraver = new Set(e.extra?.kraverKvittens ?? []);
  for (const v of e.extra?.varningar ?? []) {
    issue.push({
      severity: v.niva === 'allvarlig' ? 'warning' : 'information', code: 'business-rule',
      diagnostics: kraver.has(v.regel) ? `${v.text} Kvittera varningen med tillägget kvitterad-varning, med regeln ${v.regel} och en motivering.` : v.text,
      details: { coding: [{ system: `${CS}/varningsregel`, code: v.regel }], text: v.text },
    });
  }
  for (const p of e.extra?.planer ?? []) {
    issue.push({ severity: 'information', code: 'business-rule', diagnostics: `Plan ${p.typ}: ${p.text}${p.aterinsattning ? `, återinsättning föreslås ${p.aterinsattning}` : ''}.` });
  }
  return { resourceType: 'OperationOutcome', issue };
}

// Ett lyckat anrop som OperationOutcome (Prefer: return=OperationOutcome), med varningarna som systemet gav.
export function lyckat(text, varningar = []) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'information', code: 'informational', diagnostics: text },
      ...varningar.map(v => ({ severity: v.niva === 'allvarlig' ? 'warning' : 'information', code: 'business-rule', diagnostics: v.text }))],
  };
}

const fel = (text, falt) => new Fel(400, text, 'ogiltig', falt ? { falt } : {});
const ejStod = (text) => new Fel(405, text, 'ogiltig');
// Runda 9, r6: om den inloggades yrkesroll har handlingen, ur sessionen. Röjer inget om någon patient.
const far = (kor, handling) => Boolean(kor('GET', '/api/session').data?.behorigheter?.includes(handling));
const strang = (v) => (typeof v === 'string' ? v.trim() : '');
const tillagg = (r, namn) => (Array.isArray(r?.extension) ? r.extension.filter(x => x?.url === `${EXT}/${namn}`) : []);

// Patientens id ur en referens Patient/<id>. Bara Vårdkällans egna id.
export function patientId(ref, element) {
  const m = typeof ref?.reference === 'string' ? ref.reference.match(/^(?:.*\/fhir\/)?Patient\/(p\d{1,4})$/) : null;
  if (!m) throw fel(`Ange patienten som en referens till Patient, till exempel Patient/p01, i ${element}.`, ['patient']);
  return m[1];
}
const referensId = (ref, typ) => {
  const m = typeof ref?.reference === 'string' ? ref.reference.match(new RegExp(`^(?:.*/fhir/)?${typ}/([\\w-]{1,40})$`)) : null;
  return m ? m[1] : null;
};

// Mätvärdestypen ur koden: LOINC eller NPU som i läsningen, annars den svenska texten. Användaren behöver inte kunna
// koden, men en kod som inte stämmer med texten avvisas.
function matTyp(code) {
  const koder = Array.isArray(code?.coding) ? code.coding : [];
  for (const [typ, k] of Object.entries(MATKOD)) {
    if (koder.some(c => k.coding.some(x => x.system === c?.system && x.code === c?.code))) return typ;
  }
  if (koder.length) throw fel('Koden för mätvärdet finns inte bland Vårdkällans mätvärden. Använd samma LOINC- eller NPU-kod som i läsningen, eller bara texten.', ['typ']);
  const text = strang(code?.text).toLowerCase();
  const typ = Object.keys(MATTYPER).find(t => MATTYPER[t].namn.toLowerCase() === text || t === text);
  if (!typ) throw fel('Ange vilket mätvärde det är med en LOINC- eller NPU-kod, eller med namnet, till exempel Blodtryck eller Puls.', ['typ']);
  return typ;
}

function matVarde(typ, r) {
  const kod = MATKOD[typ];
  const enhetOk = (q) => {
    if (q?.system === KOD.ucum && q.code && kod.ucum && q.code !== kod.ucum) throw new Fel(400, `Fel enhet. ${MATTYPER[typ].namn} anges i ${MATTYPER[typ].enhet} (UCUM ${kod.ucum}).`, 'ogiltig', { falt: ['enhet'] });
    return q?.value;
  };
  if (typ === 'blodtryck') {
    const del = (loinc) => (r.component ?? []).find(c => (c?.code?.coding ?? []).some(x => x?.code === loinc))?.valueQuantity;
    const sys = enhetOk(del('8480-6'));
    const dia = enhetOk(del('8462-4'));
    return sys != null && dia != null ? `${sys}/${dia}` : '';
  }
  if (typ === 'medvetande') {
    const c = (r.valueCodeableConcept?.coding ?? []).find(x => x?.system === KOD.loinc);
    const bokstav = c ? Object.keys(ACVPU_KOD).find(k => ACVPU_KOD[k].code === c.code) : strang(r.valueCodeableConcept?.text).slice(0, 1);
    return bokstav ?? '';
  }
  if (typ === 'gcs') {
    const del = (loinc) => (r.component ?? []).find(c => (c?.code?.coding ?? []).some(x => x?.code === loinc))?.valueQuantity?.value;
    const [e, v, m] = kod.komponenter.map(k => del(k.code));
    return e != null ? { e, v, m } : '';
  }
  return enhetOk(r.valueQuantity);
}

// Anteckningens sökord ur Composition.section: rubriken och texten i div, utan HTML.
const AVKODA = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const textAv = (div) => String(div ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, x) => AVKODA[x]).trim();
function sokord(r) {
  if (r.section != null && !Array.isArray(r.section)) throw fel('Composition.section ska vara en lista med ett sökord per avsnitt.', ['sokord']);
  return (r.section ?? []).map(s => ({ sokord: strang(s?.title), text: textAv(s?.text?.div) }));
}

// Läkemedlet ur medicationCodeableConcept: NPL-id först, annars ATC-koden när den bara ger en produkt i katalogen.
function lakemedelId(db, mcc) {
  const koder = Array.isArray(mcc?.coding) ? mcc.coding : [];
  const npl = koder.find(c => c?.system === KOD.nplid)?.code;
  if (npl) {
    const lm = db.query('SELECT id FROM katalog WHERE npl = ?').get(String(npl));
    if (!lm) throw fel('Läkemedlet med det NPL-id:t finns inte i katalogen.', ['lakemedelId']);
    return lm.id;
  }
  const atc = koder.find(c => c?.system === KOD.atc)?.code;
  if (atc) {
    const lm = db.query('SELECT id, namn, styrka, form FROM katalog WHERE atc = ? ORDER BY namn').all(String(atc));
    if (lm.length === 1) return lm[0].id;
    if (!lm.length) throw fel(`Det finns inget läkemedel med ATC-koden ${atc} i katalogen.`, ['lakemedelId']);
    throw fel(`ATC-koden ${atc} ger ${lm.length} produkter: ${lm.map(x => `${x.namn} ${x.styrka} ${x.form}`).join(', ')}. Ange produktens NPL-id.`, ['lakemedelId']);
  }
  throw fel('Ange läkemedlet med NPL-id eller ATC-kod i medicationCodeableConcept.', ['lakemedelId']);
}

// Kvitterade varningar ur tillägget kvitterad-varning, med delarna regel och motivering.
function kvitteringar(r) {
  return tillagg(r, 'kvitterad-varning').map((x) => {
    const del = (n) => (x.extension ?? []).find(y => y?.url === n);
    return { regel: del('regel')?.valueCode, motivering: del('motivering')?.valueString };
  }).filter(k => typeof k.regel === 'string');
}

const PRIORITET = { stat: 'akut', asap: 'skyndsam', urgent: 'skyndsam', routine: 'normal' };
// Samma förval som formuläret i gränssnittet: sista svarsdatum 14 dagar fram.
export const SVAR_SENAST_DAGAR = 14;

// Gör en skrivning. Ger { status, typ, id, resurs, varningar, text } där resurs är den sparade resursen i FHIR.
export function skriv({ db, metod, typ, id, resurs, kor, rad }) {
  if (metod === 'DELETE') throw ejStod(TABORT_TEXT);
  if (Object.hasOwn(INTE_SKRIVBARA, typ)) throw ejStod(INTE_SKRIVBARA[typ]);
  if (!Object.hasOwn(SKRIVBARA, typ)) throw ejStod(`${typ} går att läsa men inte skriva via API:t.`);
  if (!resurs || typeof resurs !== 'object' || Array.isArray(resurs) || resurs.resourceType !== typ) throw fel(`Kroppen ska vara en FHIR-resurs av typen ${typ}.`);
  if (metod === 'PUT') {
    if (!SKRIVBARA[typ].andra) throw ejStod(SKRIVBARA[typ].text);
    if (resurs.id != null && String(resurs.id) !== String(id)) throw fel('Resursens id stämmer inte med adressen.');
  } else if (metod !== 'POST') throw ejStod('Metoden stöds inte.');
  return SKRIVARE[typ][metod === 'POST' ? 'skapa' : 'andra']({ db, id, r: resurs, kor, rad });
}

const SKRIVARE = {
  // Runda 9, r6: en tid för remissen i Appointment.basedOn. Samma anrop som när vårdadministratören bokar från
  // väntelistan, med samma kontroll av tidstyp, yrkesroll, resurser och vårdgaranti. Utan Slot bokas systemets förslag.
  Appointment: {
    skapa({ db, r, kor }) {
      if ((r.status ?? 'booked') !== 'booked') throw fel('En tid kan bara bokas via API:t, inte föreslås eller avbokas.', ['status']);
      // Säkerhetsgranskningen av runda 9, r6: patienten är alltid remissens. Fält som inte finns i Appointment avvisas.
      if (r.subject !== undefined || r.patient !== undefined) throw fel('Appointment har varken subject eller patient. Patienten anges i participant och är alltid remissens patient.', ['patient']);
      const remiss = referensId(r.basedOn?.[0], 'ServiceRequest');
      if (!remiss || !/^\d{1,9}$/.test(remiss)) throw fel('Ange remissen som tiden gäller som en referens till ServiceRequest i Appointment.basedOn.', ['remissId']);
      const patienter = (Array.isArray(r.participant) ? r.participant : []).map(p => referensId(p?.actor, 'Patient')).filter(Boolean);
      if (!far(kor, 'boka')) throw new Fel(403, 'Din yrkesroll får inte boka tider.', 'nekad');
      const post = db.query("SELECT * FROM vantelista WHERE remiss_id = ? AND status = 'vantar' ORDER BY id LIMIT 1").get(Number(remiss));
      // Samma svar när remissen saknas, inte väntar på en tid, gäller en annan patient eller en vårdenhet där personen
      // inte får boka, så att svaret aldrig röjer något om en remiss som personen inte får se.
      const ingen = () => fel('Remissen i Appointment.basedOn väntar inte på en tid som du kan boka för patienten.', ['remissId']);
      if (!post || (patienter.length && patienter.some(p => p !== post.patient_id))) throw ingen();
      const vidFel = (fn) => { try { return fn(); } catch (e) { if (e instanceof Fel && (e.status === 403 || e.status === 404)) throw ingen(); throw e; } };
      let tid = referensId(r.slot?.[0], 'Slot');
      let text = 'Tiden är bokad och kallelsen är skickad.';
      if (!tid) {
        const { data: f } = vidFel(() => kor('GET', `/api/vantelista/${post.id}/forslag`));
        if (!f.forslag?.length) throw fel('Systemet hittar ingen ledig tid som passar remissen. Välj en tid och ange den som en referens till Slot.', ['tidId']);
        tid = String(f.forslag[0].tidId);
        text = `Tiden är bokad och kallelsen är skickad. Systemet valde den tid som det föreslår först: ${f.forslag[0].skal?.[0] ?? 'den passar remissen'}`;
      } else if (!/^\d{1,9}$/.test(tid)) throw fel('Tiden finns inte.', ['tidId']);
      const { data } = vidFel(() => kor('POST', `/api/vantelista/${post.id}/boka`, { tidId: Number(tid) }));
      const b = db.query('SELECT * FROM bokningar WHERE id = ?').get(data.id);
      return { status: 201, typ: 'Appointment', id: b.id, resurs: tidbokFhir.appointment(db, b), text };
    },
  },
  // Runda 9, r6: inskrivning i slutenvård. Samma anrop som knappen Skriv in, med samma förslag på avdelning och orsak.
  Encounter: {
    skapa({ db, r, kor }) {
      const pid = patientId(r.subject, 'Encounter.subject');
      if (r.class?.code !== 'IMP') throw fel('Via API:t skrivs patienter in i slutenvård med class IMP. Besök registreras i gränssnittet.', ['klass']);
      if ((r.status ?? 'in-progress') !== 'in-progress') throw fel('En inskrivning har status in-progress.', ['status']);
      const enhet = referensId(r.serviceProvider, 'Organization') ?? referensId(r.location?.[0]?.location, 'Location');
      const kropp = { ...(enhet ? { enhetId: enhet } : {}), ...(strang(r.reasonCode?.[0]?.text) ? { orsak: strang(r.reasonCode[0].text) } : {}), ...(strang(r.location?.[0]?.location?.display) ? { plats: strang(r.location[0].location.display) } : {}) };
      const { data } = kor('POST', `/api/patient/${pid}/vardtillfallen`, kropp);
      const vt = db.query('SELECT * FROM vardtillfallen WHERE id = ?').get(data.id);
      return { status: 201, typ: 'Encounter', id: `vt-${vt.id}`, resurs: fhir.vardtillfalleEncounter(db, vt), text: `Patienten är inskriven.${enhet ? '' : ' Systemet valde avdelningen.'}${kropp.orsak ? '' : ' Orsaken kommer från akutbesöket eller remissen.'}` };
    },
  },
  // Runda 9, r6: en diagnos på vårdkontakten i Condition.encounter, med koden ur ICD-10-SE. Samma anrop som när läkaren
  // registrerar diagnosen i gränssnittet, så samma behörighet, kodkontroll och loggning gäller. Systemet avgör huvud- eller
  // bidiagnos och sätter texten ur kodverket, så den som skriver behöver bara ange koden.
  Condition: {
    skapa({ db, r, kor }) {
      const pid = patientId(r.subject, 'Condition.subject');
      // Yrkesrollen prövas först, eftersom den inte röjer något om någon patient.
      if (!far(kor, 'registrera_diagnos')) throw new Fel(403, 'Din yrkesroll får inte registrera diagnoser.', 'nekad');
      const vk = referensId(r.encounter, 'Encounter');
      if (!vk || !/^\d{1,9}$/.test(vk)) throw fel('Ange vårdkontakten som diagnosen gäller som en referens till Encounter i Condition.encounter.', ['vardkontaktId']);
      const koder = Array.isArray(r.code?.coding) ? r.code.coding : [];
      const icd = koder.find(c => c?.system === KOD.icd10se) ?? (koder.length ? null : undefined);
      if (icd === null) throw fel(`Koden ska vara ur ICD-10-SE med systemet ${KOD.icd10se}.`, ['kod']);
      const kod = strang(icd?.code);
      if (!kod) throw fel('Ange diagnosens kod ur ICD-10-SE i Condition.code.coding.', ['kod']);
      // En kontakt som saknas, gäller en annan patient eller ligger där personen inte får registrera ger samma svar, så
      // att svaret aldrig röjer vems kontakten är.
      const kontakt = db.query('SELECT patient_id FROM vardkontakter WHERE id = ?').get(Number(vk));
      const ingen = () => new Fel(403, 'Diagnosen kan inte registreras på vårdkontakten i Condition.encounter: kontakten finns inte för patienten, eller så får du inte registrera diagnoser där.', 'nekad', { falt: ['vardkontaktId'] });
      if (!kontakt || kontakt.patient_id !== pid) throw ingen();
      let data;
      try { ({ data } = kor('POST', `/api/vardkontakt/${vk}/diagnos`, { kod })); } catch (e) {
        if (e instanceof Fel && (e.status === 403 || e.status === 404)) throw ingen();
        throw e;
      }
      const rad = db.query('SELECT * FROM diagnoser WHERE id = ?').get(data.id);
      return {
        status: data.fanns ? 200 : 201, typ: 'Condition', id: data.id, resurs: fhir.condition(db, rad),
        text: data.fanns ? 'Diagnosen fanns redan på vårdkontakten. Ingen ny registrerades.' : `Diagnosen är registrerad som ${data.typ === 'huvud' ? 'huvuddiagnos' : 'bidiagnos'}, som systemet avgjorde.`,
      };
    },
  },
  Observation: {
    skapa({ db, r, kor }) {
      const pid = patientId(r.subject, 'Observation.subject');
      const typ = matTyp(r.code);
      const kropp = { typ, varde: matVarde(typ, r), ...(r.effectiveDateTime ? { tid: r.effectiveDateTime } : {}) };
      const { data } = kor('POST', `/api/patient/${pid}/matvarden`, kropp);
      return { status: 201, typ: 'Observation', id: data.id, resurs: fhir.observation(db, db.query('SELECT * FROM matvarden WHERE id = ?').get(data.id)), text: `${MATTYPER[typ].namn} är registrerat.` };
    },
  },
  Composition: {
    // Ett utkast (preliminary) eller en signerad anteckning (final), med samma mall och sökord som i gränssnittet.
    skapa({ db, r, kor }) {
      const pid = patientId(r.subject, 'Composition.subject');
      const status = r.status ?? 'final';
      if (!['preliminary', 'final'].includes(status)) throw fel('En ny anteckning är ett utkast (preliminary) eller signerad (final).');
      const vk = referensId(r.encounter, 'Encounter');
      const { data } = kor('POST', `/api/patient/${pid}/anteckningar`, { typ: strang(r.type?.text) || strang(r.title), sokord: sokord(r), ...(vk && /^\d+$/.test(vk) ? { vardkontaktId: Number(vk) } : {}) });
      let text = 'Utkastet är sparat. Det signeras med status final.';
      if (status === 'final') {
        try { kor('POST', `/api/anteckning/${data.id}/signera`, {}); } catch (e) {
          if (e instanceof Fel) throw new Fel(e.status, `Utkastet sparades som Composition/${data.id} men kunde inte signeras: ${e.message}`, e.kod, e.extra);
          throw e;
        }
        text = 'Anteckningen är signerad.';
      }
      return { status: 201, typ: 'Composition', id: data.id, resurs: fhir.composition(db, db.query('SELECT * FROM anteckningar WHERE id = ?').get(data.id)), text };
    },
    // Ett utkast ändras och signeras med status final. En signerad anteckning rättas: den gamla versionen står kvar och
    // en ny version ersätter den, med orsaken i tillägget rattelseorsak.
    andra({ db, id, r, kor, rad }) {
      if (!rad) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      if (rad.status === 'signerad') {
        const orsak = strang(tillagg(r, 'rattelseorsak')[0]?.valueString);
        const { data } = kor('POST', `/api/anteckning/${id}/ratta`, { orsak, sokord: sokord(r) });
        return { status: 201, typ: 'Composition', id: data.id, resurs: fhir.composition(db, db.query('SELECT * FROM anteckningar WHERE id = ?').get(data.id)), text: `Anteckningen är rättad. Den nya versionen är Composition/${data.id} och den tidigare står kvar.` };
      }
      const vk = referensId(r.encounter, 'Encounter');
      kor('PUT', `/api/anteckning/${id}`, { sokord: sokord(r), ...(vk && /^\d+$/.test(vk) ? { vardkontaktId: Number(vk) } : {}) });
      let text = 'Utkastet är ändrat.';
      if (r.status === 'final') { kor('POST', `/api/anteckning/${id}/signera`, {}); text = 'Utkastet är ändrat och signerat.'; }
      return { status: 200, typ: 'Composition', id: Number(id), resurs: fhir.composition(db, db.query('SELECT * FROM anteckningar WHERE id = ?').get(Number(id))), text };
    },
  },
  MedicationRequest: {
    // Samma kontroller och varningar som i läkemedelslistan. Dosering, tider och uppföljningsdatum som saknas fyller
    // systemet i ur sitt förslag för produkten och patienten, som formuläret i gränssnittet. Ordinationsorsaken skriver
    // förskrivaren alltid själv.
    skapa({ db, r, kor }) {
      const pid = patientId(r.subject, 'MedicationRequest.subject');
      if ((r.intent ?? 'order') !== 'order') throw fel('Bara ordinationer kan sparas, inte förslag eller planer.');
      const lm = lakemedelId(db, r.medicationCodeableConcept);
      const d = Array.isArray(r.dosageInstruction) ? r.dosageInstruction[0] ?? {} : {};
      const dos = d.doseAndRate?.[0]?.doseQuantity;
      const uppf = tillagg(r, 'uppfoljningsdatum')[0]?.valueDate;
      const period = r.dispenseRequest?.validityPeriod ?? {};
      let kropp = {
        lakemedelId: lm, ordinationsorsak: strang(r.reasonCode?.[0]?.text),
        ...(strang(d.text) ? { dosering: strang(d.text) } : {}), ...(dos?.value != null ? { dos: dos.value, dosEnhet: dos.unit ?? null } : {}),
        ...(d.asNeededBoolean != null ? { vidBehov: Boolean(d.asNeededBoolean), typ: d.asNeededBoolean ? 'vid_behov' : 'staende' } : {}),
        ...(uppf ? { uppfoljningsdatum: uppf } : {}), ...(period.start ? { start: period.start } : {}), ...(period.end ? { slut: period.end } : {}),
        kvitteradeVarningar: kvitteringar(r),
      };
      const ifyllt = [];
      if (!kropp.dosering || !kropp.uppfoljningsdatum) {
        const { data: f } = kor('GET', `/api/patient/${pid}/lakemedel/forslag?lakemedelId=${encodeURIComponent(lm)}`);
        if (!kropp.dosering && f.dosering) { kropp = { ...kropp, dosering: f.dosering, dos: f.dos, dosEnhet: f.dosEnhet, tider: f.tider, typ: kropp.typ ?? f.typ, vidBehov: kropp.vidBehov ?? f.vidBehov }; ifyllt.push(`doseringen ${f.dosering}`); }
        if (!kropp.uppfoljningsdatum && f.uppfoljningsdatum) { kropp.uppfoljningsdatum = f.uppfoljningsdatum; ifyllt.push(`uppföljningsdatumet ${f.uppfoljningsdatum}`); }
      }
      const { data } = kor('POST', `/api/patient/${pid}/lakemedel`, kropp);
      const oid = data.ordination.id;
      return {
        status: 201, typ: 'MedicationRequest', id: oid, resurs: fhir.medicationRequest(db, db.query('SELECT * FROM ordinationer WHERE id = ?').get(oid)), varningar: data.varningar ?? [],
        text: `Ordinationen är sparad.${ifyllt.length ? ` Systemet fyllde i ${ifyllt.join(' och ')} ur sitt förslag.` : ''}`,
      };
    },
    // En ordination ändras inte, den sätts ut (status stopped) med orsak, och för antikoagulantia med en plan.
    andra({ db, id, r, kor, rad }) {
      if (!rad) throw new Fel(404, 'Resursen finns inte.', 'saknas');
      if (r.status !== 'stopped') throw ejStod('En ordination ändras inte i efterhand. Sätt ut den med status stopped och ordinera på nytt.');
      const plan = tillagg(r, 'utsattningsplan')[0]?.valueCode;
      const ater = tillagg(r, 'aterinsattningsdatum')[0]?.valueDate;
      const orsak = strang(r.statusReason?.text) || strang(tillagg(r, 'utsattningsorsak')[0]?.valueString);
      const kv = kvitteringar(r);
      const kropp = { orsak, kvitteradeVarningar: kv, ...(plan ? { plan: { typ: plan, ...(ater ? { aterinsattning: ater } : {}) } } : {}) };
      const { data } = kor('POST', `/api/ordination/${id}/utsatt`, kropp);
      return { status: 200, typ: 'MedicationRequest', id: Number(id), resurs: fhir.medicationRequest(db, db.query('SELECT * FROM ordinationer WHERE id = ?').get(Number(id))), varningar: data.varningar ?? [], text: 'Ordinationen är utsatt.' };
    },
  },
  ServiceRequest: {
    // Remiss med samma förval som formuläret: normal prioritet och svar inom 14 dagar.
    skapa({ db, r, kor }) {
      const pid = patientId(r.subject, 'ServiceRequest.subject');
      const till = referensId(r.performer?.[0], 'Organization');
      if (!till) throw fel('Ange mottagaren som en referens till Organization i ServiceRequest.performer.', ['tillEnhetId']);
      const svar = tillagg(r, 'svar-senast')[0]?.valueDate;
      if (svar != null && !giltigtDatum(svar)) throw fel('Sista svarsdatum ska vara ett datum.', ['svarSenast']);
      const prioritet = r.priority == null ? 'normal' : PRIORITET[r.priority];
      if (!prioritet) throw fel('Prioriteten är routine, urgent, asap eller stat.', ['prioritet']);
      const kropp = {
        tillEnhetId: till, fragestallning: strang(r.reasonCode?.[0]?.text), anamnes: (r.note ?? []).map(n => strang(n?.text)).filter(Boolean).join('\n\n'),
        prioritet, svarSenast: svar ?? addDagar(idag(), SVAR_SENAST_DAGAR),
        // Runda 10, r6: konsultation när kategorin säger det, annars remiss.
        ...(remissTyp(CS, r) ? { typ: remissTyp(CS, r) } : {}),
      };
      const { data } = kor('POST', `/api/patient/${pid}/remisser`, kropp);
      return { status: 201, typ: 'ServiceRequest', id: data.id, resurs: fhir.serviceRequest(db, db.query('SELECT * FROM remisser WHERE id = ?').get(data.id), true), text: `Remissen är skickad.${svar ? '' : ` Sista svarsdatum är ${kropp.svarSenast}, som i gränssnittet.`}` };
    },
  },
};

// Raden som en ändring gäller, för att kunna avgöra om en anteckning är ett utkast eller signerad.
export function radFor(db, typ, id) {
  if (!/^\d{1,9}$/.test(String(id ?? ''))) return null;
  const tabell = { Composition: 'anteckningar', MedicationRequest: 'ordinationer', Observation: 'matvarden', ServiceRequest: 'remisser', Condition: 'diagnoser' }[typ];
  return tabell ? db.query(`SELECT * FROM ${tabell} WHERE id = ?`).get(Number(id)) : null;
}
