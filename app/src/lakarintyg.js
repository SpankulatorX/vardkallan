// Runda 14, r3: intyg genom en integrerad intygsapplikation (Webcert integrerat läge) och Intygstjänsten, Sussa 2.2.1.9.
//
// Tjänstekontrakten i riv.clinicalprocess.healthcond.certificate 4.0.5 (bilaga K10):
//   CreateDraftCertificate 3.3      Vårdkällan är konsument. Journalen skapar ett utkast i intygsapplikationen för
//                                   patienten, med läkaren, vårdenheten och förifyllda uppgifter ur journalen.
//   CertificateStatusUpdateForCare  Vårdkällan är producent. Intygsapplikationen meddelar varje händelse (skapat,
//   3.2                             ändrat, klart för signering, signerat, skickat, makulerat, raderat och frågor från
//                                   mottagaren), adresserad till den vårdenhet som äger intyget.
//   ListCertificatesForCareWithQA   Vårdkällan är konsument. Journalen stämmer själv av sin lista mot intygsapplikationen,
//   3.3                             så att en händelse som aldrig kom fram ändå syns.
//
// Systemet är experten: läkaren väljer bara vilket intyg som ska skrivas, och systemet föreslår det som passar
// patienten (dödsbevis för en avliden, sjukpenning för en patient i arbetsför ålder med en diagnos), visar bara de
// intygstyper som får skrivas för patienten och fyller i patienten, läkaren, vårdenheten och diagnosen. Intyget skrivs
// och signeras i intygsapplikationen, och journalen visar dess status utan att någon behöver göra något.
//
// Intygsapplikationen är simulerad i demon (webcert-simulerad.js) och märkt som simulerad. Den är inte Webcert och inte
// Ineras tjänst, och ingenting skickas till Försäkringskassan eller någon annan mottagare.
import { randomUUID } from 'node:crypto';
import { Fel, iso, idag } from './db.js';
import { vardenhetFor, kanRoll, alder, visningsnamn } from './atkomst.js';
import { avlidenFor } from './avliden.js';
import { e, hitta, text, alla, tolka, xml, XmlFel } from './rivta-r3-xml.js';
import * as transport from './rivta-r3-transport.js';

export const DOMAN = 'riv.clinicalprocess.healthcond.certificate';
export const DOMANVERSION = '4.0.5';
export const NS = {
  core: 'urn:riv:clinicalprocess:healthcond:certificate:3',
  types: 'urn:riv:clinicalprocess:healthcond:certificate:types:3',
  m3: 'urn:riv:clinicalprocess:healthcond:certificate:3.3',
  skapa: 'urn:riv:clinicalprocess:healthcond:certificate:CreateDraftCertificateResponder:3',
  status: 'urn:riv:clinicalprocess:healthcond:certificate:CertificateStatusUpdateForCareResponder:3',
  lista: 'urn:riv:clinicalprocess:healthcond:certificate:ListCertificatesForCareWithQAResponder:3',
};
export const KONTRAKT = {
  skapa: { namn: 'CreateDraftCertificate', version: '3.3', roll: 'konsument' },
  status: { namn: 'CertificateStatusUpdateForCare', version: '3.2', roll: 'producent' },
  lista: { namn: 'ListCertificatesForCareWithQA', version: '3.3', roll: 'konsument' },
};

// Kodverk ur Ineras kodverk för intyg. OID:erna är kodverkens identiteter i tjänstekontrakten.
export const KV = {
  intygstyp: 'b64ea353-e8f6-4832-b563-fc7d46f29548', handelse: 'dfd7bbad-dbe5-4a2f-ba25-f7b9b2cc6b14',
  status: '9871cd17-8755-4ed9-b894-ff3729e775a4', part: '769bb12b-bd9f-4203-a5cd-fd14f2eb3b80',
  personnummer: '1.2.752.129.2.1.3.1', samordningsnummer: '1.2.752.129.2.1.3.3', hsa: '1.2.752.129.2.1.4.1', icd10: '1.2.752.116.1.1.1',
};
// Den simulerade intygsapplikationens logiska adress. Påhittad och märkt som demo.
export const LOGISK_ADRESS_INTYGSAPPLIKATION = 'DEMO-SIM-INTYGSAPPLIKATION';
export const MOTPART = 'Intygsapplikation (simulerad, inte Webcert)';

// Intygstyperna som demon erbjuder. sekretess: får skrivas för en patient med skyddade personuppgifter. avliden: får
// (bara) skrivas för en avliden patient. Reglerna motsvarar de regler som en intygsapplikation tillämpar och är
// demoregler i Vårdkällan, så att läkaren aldrig ser ett val som intygsapplikationen sedan nekar.
export const INTYGSTYPER = [
  { kod: 'LISJP', text: 'Läkarintyg för sjukpenning', mottagare: 'Försäkringskassan', part: 'FKASSA', sekretess: true, avliden: false, alder: [16, 69] },
  { kod: 'AG7804', text: 'Läkarintyg om arbetsförmåga till arbetsgivaren', mottagare: 'Arbetsgivaren, via patienten', part: 'INVANA', sekretess: true, avliden: false, alder: [16, 69] },
  { kod: 'LUSE', text: 'Läkarutlåtande för sjukersättning', mottagare: 'Försäkringskassan', part: 'FKASSA', sekretess: true, avliden: false, alder: [19, 66] },
  { kod: 'LUAE_NA', text: 'Läkarutlåtande för aktivitetsersättning vid nedsatt arbetsförmåga', mottagare: 'Försäkringskassan', part: 'FKASSA', sekretess: true, avliden: false, alder: [19, 29] },
  { kod: 'TSTRK1007', text: 'Läkarintyg för körkort, högre behörigheter', mottagare: 'Transportstyrelsen', part: 'TRANSP', sekretess: false, avliden: false, alder: [16, 120] },
  { kod: 'DB', text: 'Dödsbevis', mottagare: 'Skatteverket', part: 'SKV', sekretess: true, avliden: true, alder: [0, 130] },
  { kod: 'DOI', text: 'Dödsorsaksintyg', mottagare: 'Socialstyrelsen', part: 'SOS', sekretess: true, avliden: true, alder: [0, 130] },
];
const TYP = new Map(INTYGSTYPER.map(t => [t.kod, t]));

// Händelserna i KV Händelse, med det journalen visar.
export const HANDELSER = {
  SKAPAT: { text: 'Utkastet skapades', status: 'utkast' }, ANDRAT: { text: 'Utkastet ändrades', status: 'utkast' },
  KFSIGN: { text: 'Klart för signering', status: 'klart_for_signering' }, SIGNAT: { text: 'Signerat', status: 'signerat' },
  SKICKA: { text: 'Skickat till mottagaren', status: 'skickat' }, MAKULE: { text: 'Makulerat', status: 'makulerat' },
  RADERA: { text: 'Utkastet raderades', status: 'raderat' },
  NYFRFM: { text: 'Ny fråga från mottagaren' }, NYSVFM: { text: 'Nytt svar från mottagaren' }, NYFRFV: { text: 'Ny fråga från vården' },
  HANFRFM: { text: 'Fråga från mottagaren hanterad' }, HANFRFV: { text: 'Fråga från vården hanterad' },
};
export const STATUSTEXT = {
  utkast: 'Utkast i intygsapplikationen', klart_for_signering: 'Klart för signering', signerat: 'Signerat', skickat: 'Signerat och skickat',
  makulerat: 'Makulerat', raderat: 'Utkastet raderades', fel: 'Utkastet kunde inte skapas',
};
// I vilken ordning statusarna kommer, så att en sen eller dubblerad händelse aldrig flyttar tillbaka statusen.
const ORDNING = ['utkast', 'klart_for_signering', 'signerat', 'skickat', 'makulerat', 'raderat'];

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS lakarintyg (
  id INTEGER PRIMARY KEY, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, typ TEXT NOT NULL, intygs_id TEXT UNIQUE,
  ref TEXT NOT NULL UNIQUE, skapad_av TEXT NOT NULL, skapad_tid TEXT NOT NULL, status TEXT NOT NULL,
  signerad_tid TEXT, skickad_tid TEXT, fragor_ej_besvarade INTEGER NOT NULL DEFAULT 0, andrad_tid TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lakarintyg_handelser (
  id INTEGER PRIMARY KEY, intyg_id INTEGER NOT NULL, patient_id TEXT NOT NULL, enhet_id TEXT NOT NULL, kod TEXT NOT NULL,
  tid TEXT NOT NULL, mottagen_tid TEXT NOT NULL, kalla TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS lakarintyg_handelse_en ON lakarintyg_handelser (intyg_id, kod, tid);
CREATE TRIGGER IF NOT EXISTS lakarintyg_handelse_andras_ej BEFORE UPDATE ON lakarintyg_handelser BEGIN SELECT RAISE(ABORT, 'En händelse för ett intyg ändras inte'); END;
CREATE TRIGGER IF NOT EXISTS lakarintyg_handelse_raderas_ej BEFORE DELETE ON lakarintyg_handelser BEGIN SELECT RAISE(ABORT, 'En händelse för ett intyg raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS lakarintyg_raderas_ej BEFORE DELETE ON lakarintyg BEGIN SELECT RAISE(ABORT, 'Ett intyg raderas inte'); END;
`;
export const sakra = (db) => { db.exec(SCHEMA); transport.sakra(db); };

const ve = (db, enhetId) => db.query('SELECT id, hsa_id, namn FROM enheter WHERE id = ?').get(vardenhetFor(db, enhetId));

// Patientens identitet i kontraktet: bara personnummer och samordningsnummer går att skicka.
export function personId(p) {
  const nr = String(p.personnummer ?? '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(nr) || /^vk/i.test(String(p.personnummer))) return null;
  const dag = Number(nr.slice(6, 8));
  return { root: dag > 60 ? KV.samordningsnummer : KV.personnummer, extension: nr };
}

// Vilka intygstyper som får skrivas för patienten och varför de andra inte får det. Ett val som inte går ska aldrig
// visas som ett val.
export function typerFor(db, p, dag = idag()) {
  const avliden = Boolean(avlidenFor(db, p.id));
  const ar = alder(p.fodd, dag);
  return INTYGSTYPER.map(t => {
    let skal = null;
    if (t.avliden && !avliden) skal = 'Skrivs först när patienten är registrerad som avliden.';
    else if (!t.avliden && avliden) skal = 'Patienten är registrerad som avliden. Bara dödsbevis och dödsorsaksintyg kan skrivas.';
    else if (p.skyddad && !t.sekretess) skal = 'Kan inte skrivas för en patient med skyddade personuppgifter.';
    else if (ar < t.alder[0] || ar > t.alder[1]) skal = `Gäller patienter mellan ${t.alder[0]} och ${t.alder[1]} år.`;
    return { kod: t.kod, text: t.text, mottagare: t.mottagare, mojlig: !skal, skal };
  });
}

// Diagnosen som förifylls: den senaste på den egna vårdenheten. Bara det läkaren får se på den egna enheten används,
// så att förifyllnaden aldrig kan föra med sig något från en annan eller spärrad vårdenhet.
function diagnosForForifyllnad(atk) {
  const min = vardenhetFor(atk.db, atk.personal.enhet_id);
  const rader = atk.db.query("SELECT id, enhet_id, kod, text, datum FROM diagnoser WHERE patient_id = ? ORDER BY datum DESC, id DESC LIMIT 50").all(atk.patientId)
    .filter(d => vardenhetFor(atk.db, d.enhet_id) === min);
  const synliga = atk.filtrera(rader, 'las_diagnoser');
  return synliga[0] ?? null;
}

// Förslaget: det systemet tror att läkaren ska skriva, med skälet.
export function forslag(atk, p, dag = idag()) {
  const typer = typerFor(atk.db, p, dag);
  const mojliga = typer.filter(t => t.mojlig);
  const avliden = avlidenFor(atk.db, p.id);
  if (avliden) return { kod: 'DB', varfor: 'Patienten är registrerad som avliden. Dödsbeviset ska skrivas först, sedan dödsorsaksintyget.' };
  const d = kanRoll(atk.personal, 'las_diagnoser') ? diagnosForForifyllnad(atk) : null;
  if (d && mojliga.some(t => t.kod === 'LISJP')) return { kod: 'LISJP', varfor: `Diagnosen ${d.kod} ${d.text} från din vårdenhet förifylls.` };
  return mojliga[0] ? { kod: mojliga[0].kod, varfor: null } : null;
}

// Meddelandet CreateDraftCertificate 3.3, i schemats ordning.
export function skapaUtkastKropp({ typ, patient, pid, personal, enhet, ref, diagnos = null }) {
  const t = TYP.get(typ);
  const namn = (patient.fornamn ?? '').trim();
  return e('skapa:CreateDraftCertificate', [
    e('skapa:intyg', [
      e('skapa:typAvIntyg', [e('types:code', t.kod), e('types:codeSystem', KV.intygstyp), e('types:displayName', t.text)]),
      e('skapa:patient', [
        e('core:person-id', [e('types:root', pid.root), e('types:extension', pid.extension)]),
        e('core:fornamn', namn), e('core:efternamn', patient.efternamn),
        // Adressen skickas inte för en patient med skyddade personuppgifter. Intygsapplikationen hämtar den själv.
        e('core:postadress', patient.skyddad ? '' : (patient.adress ?? '')), e('core:postnummer', patient.skyddad ? '' : (patient.postnr ?? '')),
        e('core:postort', patient.skyddad ? '' : (patient.ort ?? '')),
      ]),
      e('skapa:skapadAv', [
        e('skapa:personal-id', [e('types:root', KV.hsa), e('types:extension', personal.hsa_id)]),
        e('skapa:fullstandigtNamn', personal.namn),
        e('skapa:enhet', [e('skapa:enhets-id', [e('types:root', KV.hsa), e('types:extension', enhet.hsa_id)]), e('skapa:enhetsnamn', enhet.namn)]),
      ]),
      e('skapa:ref', ref),
      diagnos && typ === 'LISJP' ? e('m3:forifyllnad', [
        e('core:svar', [
          e('core:delsvar', diagnos.text, { id: '6.1' }),
          e('core:delsvar', [e('types:cv', [e('types:code', diagnos.kod.replace('.', '')), e('types:codeSystem', KV.icd10), e('types:displayName', diagnos.text)])], { id: '6.2' }),
        ], { id: '6' }),
      ]) : null,
    ]),
  ]);
}

const radUt = (db, r) => {
  const t = TYP.get(r.typ);
  return {
    id: r.id, typ: r.typ, text: t?.text ?? r.typ, mottagare: t?.mottagare ?? null, status: r.status, statusText: STATUSTEXT[r.status] ?? r.status,
    skapad: r.skapad_tid, signerad: r.signerad_tid, skickad: r.skickad_tid, fragorEjBesvarade: r.fragor_ej_besvarade,
    vardenhet: ve(db, r.enhet_id) ? { namn: ve(db, r.enhet_id).namn } : null,
    skapadAv: db.query('SELECT namn FROM personal WHERE id = ?').get(r.skapad_av)?.namn ?? null,
    kanOppnas: ['utkast', 'klart_for_signering', 'signerat', 'skickat'].includes(r.status) && Boolean(r.intygs_id),
    handelser: db.query('SELECT kod, tid FROM lakarintyg_handelser WHERE intyg_id = ? ORDER BY tid, id').all(r.id).map(h => ({ kod: h.kod, text: HANDELSER[h.kod]?.text ?? h.kod, tid: h.tid })),
  };
};

// Patientens intyg som den inloggade får se. Ett intyg från en annan vårdenhet visas efter samma regler som journalen.
export function forPatient(atk, p, dag = idag()) {
  atk.krav('las_intyg');
  const rader = atk.filtrera(atk.db.query('SELECT * FROM lakarintyg WHERE patient_id = ? ORDER BY skapad_tid DESC, id DESC').all(p.id), 'las_intyg');
  const kanSkriva = kanRoll(atk.personal, 'skriv_intyg');
  return {
    intyg: rader.map(r => radUt(atk.db, r)),
    kanSkriva,
    typer: kanSkriva ? typerFor(atk.db, p, dag) : [],
    forslag: kanSkriva ? forslag(atk, p, dag) : null,
    motpart: MOTPART,
    kontrakt: `${DOMAN} ${DOMANVERSION}: ${KONTRAKT.skapa.namn} ${KONTRAKT.skapa.version}, ${KONTRAKT.status.namn} ${KONTRAKT.status.version} och ${KONTRAKT.lista.namn} ${KONTRAKT.lista.version}`,
    simulerat: 'Intygsapplikationen är simulerad i demon. Inget intyg skickas till någon mottagare.',
    dolda: atk.doldaVal > 0 ? { kraverVal: true, text: 'Det finns intyg från andra vårdenheter. Gör ett aktivt val för att visa dem.' } : null,
  };
}

// Skapar ett utkast i intygsapplikationen. Ger raden och adressen som öppnar utkastet.
export function skapa(atk, p, body = {}, dag = idag()) {
  atk.krav('skriv_intyg');
  const typ = typeof body.typ === 'string' ? body.typ : '';
  if (!TYP.has(typ)) throw new Fel(400, 'Välj ett av intygen i listan.', 'ogiltig', { falt: ['typ'] });
  const val = typerFor(atk.db, p, dag).find(t => t.kod === typ);
  if (!val.mojlig) throw new Fel(400, `${val.text} kan inte skrivas: ${val.skal}`, 'ogiltig', { falt: ['typ'] });
  const pid = personId(p);
  if (!pid) throw new Fel(400, 'Patienten har inget personnummer eller samordningsnummer. Intyg via intygsapplikationen kräver ett av dem. Registrera patientens identitet först.', 'ogiltig');
  const db = atk.db;
  const personal = db.query('SELECT * FROM personal WHERE id = ?').get(atk.personal.id);
  const enhet = ve(db, atk.personal.enhet_id);
  const diagnos = typ === 'LISJP' && kanRoll(atk.personal, 'las_diagnoser') ? diagnosForForifyllnad(atk) : null;
  const ref = `VK-INTYG-${randomUUID()}`;
  const t = iso();
  const id = Number(db.query("INSERT INTO lakarintyg (patient_id, enhet_id, typ, ref, skapad_av, skapad_tid, status, andrad_tid) VALUES (?, ?, ?, ?, ?, ?, 'utkast', ?)")
    .run(p.id, enhet.id, typ, ref, personal.id, t, t).lastInsertRowid);
  const kropp = skapaUtkastKropp({ typ, patient: p, pid, personal, enhet, ref, diagnos });
  const ns = { skapa: NS.skapa, core: NS.core, types: NS.types, m3: NS.m3 };
  const r = transport.anropa(db, { kontrakt: KONTRAKT.skapa.namn, logiskAdress: LOGISK_ADRESS_INTYGSAPPLIKATION, kropp, ns, patientId: p.id, enhetId: enhet.id });
  const kod = r.svar ? text(r.svar, 'result/resultCode') : null;
  const intygsId = r.svar ? text(r.svar, 'intygs-id/extension') : null;
  if (r.fel || kod !== 'OK' || !intygsId) {
    db.query("UPDATE lakarintyg SET status = 'fel', andrad_tid = ? WHERE id = ?").run(iso(), id);
    const orsak = r.fel ?? (r.svar ? text(r.svar, 'result/resultText') : null) ?? 'okänt fel';
    transport.logga(db, { kontrakt: KONTRAKT.skapa.namn, riktning: 'ut', logiskAdress: LOGISK_ADRESS_INTYGSAPPLIKATION, motpart: MOTPART, patientId: p.id, enhetId: enhet.id, resultat: 'fel', text: String(orsak).slice(0, 200), kropp: r.xml });
    atk.logga('skriv_intyg', atk.grund(), `intyg:${id}`);
    throw new Fel(502, `Intygsapplikationen tog inte emot utkastet. ${orsak}`, 'motpart');
  }
  db.query('UPDATE lakarintyg SET intygs_id = ? WHERE id = ?').run(intygsId, id);
  // Intygsapplikationens statusuppdatering om det nya utkastet kommer efter svaret.
  transport.leverera(db);
  transport.logga(db, { kontrakt: KONTRAKT.skapa.namn, riktning: 'ut', logiskAdress: LOGISK_ADRESS_INTYGSAPPLIKATION, motpart: MOTPART, patientId: p.id, enhetId: enhet.id, resultat: 'ok', kropp: r.xml });
  atk.logga('skriv_intyg', atk.grund(), `intyg:${id}`);
  const rad = db.query('SELECT * FROM lakarintyg WHERE id = ?').get(id);
  return { intyg: radUt(db, rad), oppna: oppnaAdress(rad), forifyllt: diagnos ? [`Diagnos ${diagnos.kod} ${diagnos.text}`] : [], text: `Utkastet till ${TYP.get(typ).text.toLowerCase()} är skapat i intygsapplikationen.` };
}

// Adressen som öppnar intyget i intygsapplikationen, som i integrerat läge: intygets id och vårdenheten. Inga
// patientuppgifter finns i adressen.
export const oppnaAdress = (rad) => `#/intygsapplikation/${encodeURIComponent(rad.intygs_id)}`;

export function oppna(atk, id) {
  const rad = /^\d{1,9}$/.test(String(id)) ? atk.db.query('SELECT * FROM lakarintyg WHERE id = ? AND patient_id = ?').get(Number(id), atk.patientId) : null;
  const synlig = rad ? atk.filtrera([rad], 'las_intyg')[0] : null;
  if (!synlig || !synlig.intygs_id) throw new Fel(404, 'Intyget finns inte.', 'saknas');
  atk.krav(kanRoll(atk.personal, 'skriv_intyg') ? 'skriv_intyg' : 'las_intyg', { resurs: { enhet_id: synlig.enhet_id } });
  atk.logga(atk.handling, atk.grund(), `intyg:${synlig.id}`);
  return { oppna: oppnaAdress(synlig) };
}

// ---------------------------------------------------------------------------------------------------------------
// Producenten för CertificateStatusUpdateForCare 3.2. Intygsapplikationen anropar den med en händelse, adresserad till
// den vårdenhet som äger intyget. Varje kontroll görs innan något ändras, och ett meddelande som inte går att ta emot
// får ett fel med förklaring och ändrar ingenting. Svaret innehåller inga patientuppgifter.
// ---------------------------------------------------------------------------------------------------------------
const resultat = (kod, textRad = null, errorId = null) => e('status:CertificateStatusUpdateForCareResponse', [
  e('status:result', [e('core:resultCode', kod), e('core:resultText', textRad), e('core:errorId', errorId)]),
]);
const NS_STATUSSVAR = { status: NS.status, core: NS.core };
export const statussvar = (kod, t = null, err = null) => xml(resultat(kod, t, err), NS_STATUSSVAR);

export function taEmotStatus(db, kroppXml, { logiskAdress } = {}) {
  let m;
  const avvisa = (t, err = 'VALIDATION_ERROR', intyg = null) => {
    transport.logga(db, { kontrakt: KONTRAKT.status.namn, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: intyg?.patient_id ?? null, enhetId: intyg?.enhet_id ?? null, resultat: 'avvisad', text: t, kropp: kroppXml });
    return statussvar('ERROR', t, err);
  };
  try { m = tolka(kroppXml); } catch (x) { return avvisa(x instanceof XmlFel ? x.message : 'Meddelandet gick inte att tolka.'); }
  if (m.n !== 'CertificateStatusUpdateForCare' || m.ns !== NS.status) return avvisa('Meddelandet är inte CertificateStatusUpdateForCare version 3.');
  const intygsId = text(m, 'intyg/intygs-id/extension');
  const kod = text(m, 'handelse/handelsekod/code');
  const kodverk = text(m, 'handelse/handelsekod/codeSystem');
  const tid = text(m, 'handelse/tidpunkt');
  const ref = text(m, 'ref');
  const enhetHsa = text(m, 'intyg/skapadAv/enhet/enhets-id/extension');
  if (!intygsId) return avvisa('intygs-id saknas.');
  if (kodverk !== KV.handelse || !Object.hasOwn(HANDELSER, kod ?? '')) return avvisa(`Händelsekoden ${kod ?? ''} finns inte i KV Händelse.`);
  if (!tid || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(tid) || Number.isNaN(Date.parse(tid))) return avvisa('Händelsens tidpunkt ska ha formatet ÅÅÅÅ-MM-DDTtt:mm:ss.sss.');
  // Intyget slås upp på intygets id, och referensen och vårdenheten ska stämma. En händelse för ett intyg som journalen
  // inte har skapat avvisas, så att ingen kan lägga in intyg på en patient genom att skicka ett meddelande.
  const rad = db.query('SELECT * FROM lakarintyg WHERE intygs_id = ?').get(intygsId);
  if (!rad) return avvisa('Intyget finns inte i journalen.', 'APPLICATION_ERROR');
  if (ref && ref !== rad.ref) return avvisa('Referensen stämmer inte med intyget.', 'APPLICATION_ERROR', rad);
  const agare = ve(db, rad.enhet_id);
  if (logiskAdress && logiskAdress !== agare.hsa_id) return avvisa('Den logiska adressen är inte den vårdenhet som äger intyget.', 'VALIDATION_ERROR', rad);
  if (enhetHsa && enhetHsa !== agare.hsa_id) return avvisa('Vårdenheten i intyget är inte den som skapade det.', 'APPLICATION_ERROR', rad);
  const pnr = text(m, 'intyg/patient/person-id/extension');
  const pid = personId(db.query('SELECT personnummer FROM patienter WHERE id = ?').get(rad.patient_id) ?? {});
  if (pnr && pid && pnr !== pid.extension) return avvisa('Patienten i meddelandet är inte intygets patient.', 'APPLICATION_ERROR', rad);
  tillampa(db, rad, { kod, tid, kalla: 'statusuppdatering', ejBesvarade: Number(text(m, 'mottagnaFragor/ejBesvarade') ?? 0), signerad: text(m, 'intyg/signeringstidpunkt'), skickad: text(m, 'intyg/skickatTidpunkt') });
  transport.logga(db, { kontrakt: KONTRAKT.status.namn, riktning: 'in', logiskAdress, motpart: MOTPART, patientId: rad.patient_id, enhetId: rad.enhet_id, resultat: 'ok', text: kod, kropp: kroppXml });
  return statussvar('OK');
}

// En händelse ändrar statusen bara framåt, och samma händelse vid samma tid läggs bara in en gång.
function tillampa(db, rad, { kod, tid, kalla, ejBesvarade = null, signerad = null, skickad = null }) {
  const ny = db.query('INSERT OR IGNORE INTO lakarintyg_handelser (intyg_id, patient_id, enhet_id, kod, tid, mottagen_tid, kalla) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(rad.id, rad.patient_id, rad.enhet_id, kod, tid, iso(), kalla).changes > 0;
  const mal = HANDELSER[kod].status;
  const nu = db.query('SELECT * FROM lakarintyg WHERE id = ?').get(rad.id);
  const status = mal && ORDNING.indexOf(mal) > ORDNING.indexOf(nu.status) ? mal : nu.status;
  db.query(`UPDATE lakarintyg SET status = ?, signerad_tid = coalesce(signerad_tid, ?), skickad_tid = coalesce(skickad_tid, ?),
    fragor_ej_besvarade = coalesce(?, fragor_ej_besvarade), andrad_tid = ? WHERE id = ?`)
    .run(status, signerad || (kod === 'SIGNAT' ? tid : null), skickad || (kod === 'SKICKA' ? tid : null), Number.isFinite(ejBesvarade) ? ejBesvarade : null, iso(), rad.id);
  return ny;
}

// ---------------------------------------------------------------------------------------------------------------
// Avstämningen med ListCertificatesForCareWithQA 3.3: journalen frågar intygsapplikationen efter patientens intyg på
// den egna vårdenheten och lägger in de händelser som aldrig kom fram. Den som är inloggad ser bara resultatet.
// ---------------------------------------------------------------------------------------------------------------
export function listaKropp({ pid, enhetHsa }) {
  return e('lista:ListCertificatesForCareWithQA', [
    e('lista:person-id', [e('types:root', pid.root), e('types:extension', pid.extension)]),
    e('lista:enhets-id', [e('types:root', KV.hsa), e('types:extension', enhetHsa)]),
  ]);
}
export function avstam(atk, p) {
  atk.krav('las_intyg');
  const db = atk.db;
  const enhet = ve(db, atk.personal.enhet_id);
  const pid = personId(p);
  if (!pid) return { avstamt: 0, text: 'Patienten har inget personnummer eller samordningsnummer, så det finns inga intyg i intygsapplikationen.' };
  const r = transport.anropa(db, { kontrakt: KONTRAKT.lista.namn, logiskAdress: LOGISK_ADRESS_INTYGSAPPLIKATION, kropp: listaKropp({ pid, enhetHsa: enhet.hsa_id }), ns: { lista: NS.lista, types: NS.types }, patientId: p.id, enhetId: enhet.id });
  if (r.fel) { atk.logga('las_intyg', atk.grund(), 'intyg:avstamning'); return { avstamt: 0, fel: r.fel, text: 'Intygsapplikationen svarade inte. Listan visar det journalen har fått.' }; }
  let nya = 0;
  for (const item of alla(hitta(r.svar, 'list'), 'item')) {
    const intygsId = text(item, 'intyg/intygs-id/extension');
    const rad = intygsId ? db.query('SELECT * FROM lakarintyg WHERE intygs_id = ? AND patient_id = ? AND enhet_id = ?').get(intygsId, p.id, enhet.id) : null;
    if (!rad) continue;
    for (const h of alla(hitta(item, 'handelser'), 'handelse')) {
      const kod = text(h, 'handelsekod/code');
      const tid = text(h, 'tidpunkt');
      if (Object.hasOwn(HANDELSER, kod ?? '') && tid) nya += tillampa(db, rad, { kod, tid, kalla: 'avstamning', ejBesvarade: Number(text(item, 'mottagnaFragor/ejBesvarade') ?? 0) }) ? 1 : 0;
    }
  }
  transport.logga(db, { kontrakt: KONTRAKT.lista.namn, riktning: 'ut', logiskAdress: LOGISK_ADRESS_INTYGSAPPLIKATION, motpart: MOTPART, patientId: p.id, enhetId: enhet.id, resultat: 'ok', text: `${nya} nya händelser`, kropp: r.xml });
  atk.logga('las_intyg', atk.grund(), 'intyg:avstamning');
  return { avstamt: nya, text: nya ? `${nya} ${nya === 1 ? 'händelse' : 'händelser'} som inte hade kommit fram lades in.` : 'Journalen och intygsapplikationen stämmer överens.' };
}

export { visningsnamn };
