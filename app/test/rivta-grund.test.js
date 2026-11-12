import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { nyDb } from './hjalp.js';
import * as rivta from '../src/rivta/index.js';
import { tolka, skriv, XmlFel } from '../src/rivta/xml.js';
import { Schemaset } from '../src/rivta/xsd.js';
import { SOAP_NS, kuvert, logiskAdress } from '../src/rivta/soap.js';
import { prova as provaScheman } from '../scripts/rivta-scheman.js';

// Runda 14, r2: den gemensamma grunden för tjänstekontrakten i RIVTA (Sussa 2.2.1): säker XML, validering mot de
// pinnade schemana, SOAP 1.1 och SOAP Fault enligt RIVTA Basic Profile 2.1, ömsesidig TLS med testcertifikat och
// anropsbehörigheten för den anropande organisationen.

const T = 'RIVTA-grunden';
const VG = 'SE2321000164-VK0000';
const DIA = rivta.journal.GET_DIAGNOSIS;
const ctxFor = (db) => ({ db, nu: new Date() });
const fraga = (pnr, extra = {}) => ({ patientId: { id: pnr, type: '1.2.752.129.2.1.3.1' }, ...extra });
const anropa = (db, begaran, { hsaId = rivta.konsumenter.NPO, adress = VG } = {}) => rivta.anropa(DIA, { logiskAdress: adress, begaran, transport: rivta.iProcessen(rivta.vardkallan, { ctx: ctxFor(db), avsandare: { hsaId, via: 'direkt' } }) });
// Ett kuvert för hand, för att pröva felen.
const kuvertFor = (kropp, huvud = [logiskAdress(VG)]) => kuvert(kropp, huvud);
const diagnosBegaran = (pnr = '194502024732') => skriv(DIA.schema.bygg(DIA.begaran.ns, DIA.begaran.lokal, fraga(pnr)));
const tjanstSvar = (db, text, { soapAction = DIA.soapAction, vag = DIA.vag, hsaId = rivta.konsumenter.NPO } = {}) => rivta.vardkallan.hanteraAnrop(ctxFor(db), { text, soapAction, vag, avsandare: { hsaId, via: 'direkt' } });
const faultText = (body) => /<faultstring[^>]*>([^<]*)</.exec(body)?.[1] ?? '';

describe(T, () => {
  test('schemana är pinnade med källa, version och sha256, och alla kontraktens scheman kan läsas', () => {
    expect(provaScheman()).toEqual([]);
    const rot = rivta.RIVTA_ROT;
    const responders = [];
    const ga = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) ga(f); else if (/Responder_[\d.]+\.xsd$/.test(n)) responders.push(relative(rot, f)); } };
    ga(rot);
    expect(responders.length).toBeGreaterThanOrEqual(40);
    for (const f of responders) expect(() => new Schemaset(rot).las(f).kompileraAllt()).not.toThrow();
    expect(rivta.kalla('riv.clinicalprocess.healthcond.description')).toMatchObject({ tagg: '2.1.19', commit: '9ad620ea8cddde2e02c5a1da69e9102b1b959914' });
    expect(DIA).toMatchObject({ namn: 'GetDiagnosis', version: '2.0', soapAction: 'urn:riv:clinicalprocess:healthcond:description:GetDiagnosisResponder:2:GetDiagnosis', vag: '/GetDiagnosis/2/rivtabp21', logiskAdressIHuvud: true });
  });

  test('XML-tolken avvisar DTD, entiteter, instruktioner och för stora eller djupa meddelanden', () => {
    const avvisa = (x, tak) => { try { tolka(x, tak); return null; } catch (e) { expect(e).toBeInstanceOf(XmlFel); return e.message; } };
    // Extern entitet (XXE) och en entitetsbomb stoppas redan vid DOCTYPE.
    expect(avvisa('<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>')).toContain('DOCTYPE');
    expect(avvisa('<!DOCTYPE a [<!ENTITY l "lol"><!ENTITY l2 "&l;&l;&l;">]><a>&l2;</a>')).toContain('DOCTYPE');
    expect(avvisa('<a>&x;</a>')).toContain('inte tillåten');
    expect(avvisa('<a><?php echo 1 ?></a>')).toContain('Instruktioner');
    expect(avvisa('<?xml version="1.0" encoding="ISO-8859-1"?><a/>')).toContain('UTF-8');
    expect(avvisa(`${'<a>'.repeat(60)}${'</a>'.repeat(60)}`)).toContain('djupare');
    expect(avvisa(`<a>${'x'.repeat(2000)}</a>`, { byte: 1000 })).toContain('större');
    expect(avvisa(`<a>${'<b/>'.repeat(200)}</a>`, { element: 100 })).toContain('fler än 100 element');
    expect(avvisa(`<a ${Array.from({ length: 80 }, (_, i) => `x${i}="1"`).join(' ')}/>`)).toContain('attribut');
    expect(avvisa('<p:a/>')).toContain('inte deklarerat');
    expect(avvisa('<a/><b/>')).toContain('mer än ett rotelement');
    expect(avvisa('x<a/>')).toContain('Text utanför');
    expect(avvisa('<a a="1" a="2"/>')).toContain('två gånger');
    expect(avvisa('<a>&#0;</a>')).toContain('inte är tillåtet');
    // Det som är tillåtet tolkas rätt, med namnrymder, de fem entiteterna, teckenreferenser och CDATA.
    const r = tolka('<?xml version="1.0" encoding="UTF-8"?><!-- k --><p:a xmlns:p="urn:x" xmlns="urn:y" b="&lt;&amp;"><c>&#229;&#xE4;&quot;<![CDATA[<ö>]]></c></p:a>');
    expect(r).toMatchObject({ ns: 'urn:x', lokal: 'a' });
    expect(r.attr[0]).toMatchObject({ lokal: 'b', varde: '<&' });
    expect(r.barn[0]).toMatchObject({ ns: 'urn:y', lokal: 'c', text: 'åä"<ö>' });
    // Skrivet och tolkat igen blir det samma.
    const igen = tolka(skriv(r));
    expect(igen.barn[0].text).toBe('åä"<ö>');
    expect(igen.attr[0].varde).toBe('<&');
  });

  test('valideringen följer schemat: ordning, obligatoriska element, kodlistor, mönster och främmande namnrymder', () => {
    const s = DIA.schema;
    const ns = DIA.begaran.ns;
    const core = 'urn:riv:clinicalprocess:healthcond:description:2';
    const dok = (inre) => tolka(`<r:GetDiagnosis xmlns:r="${ns}" xmlns:c="${core}">${inre}</r:GetDiagnosis>`);
    const pid = '<r:patientId><c:id>194502024732</c:id><c:type>1.2.752.129.2.1.3.1</c:type></r:patientId>';
    expect(s.validera(dok(pid))).toEqual([]);
    expect(s.validera(dok(`<r:careUnitHSAId>X</r:careUnitHSAId><r:careUnitHSAId>Y</r:careUnitHSAId>${pid}<r:timePeriod><c:start>20200101</c:start><c:end>20261231</c:end></r:timePeriod>`))).toEqual([]);
    expect(s.validera(dok(''))[0]).toContain('obligatoriskt element saknas');
    expect(s.validera(dok(`${pid}<r:careUnitHSAId>X</r:careUnitHSAId>`))[0]).toContain('careUnitHSAId är inte tillåtet här');
    expect(s.validera(dok(`${pid}<r:timePeriod><c:start>2020-01-01</c:start><c:end>20261231</c:end></r:timePeriod>`))[0]).toContain('mönster');
    expect(s.validera(dok(`${pid}<r:okant>1</r:okant>`))[0]).toContain('okant är inte tillåtet');
    expect(s.validera(dok('<r:patientId><c:type>1</c:type></r:patientId>'))[0]).toContain('type är inte tillåtet');
    expect(s.validera(dok(`${pid}text`))[0]).toContain('får inte ha text');
    // xs:any namespace="##other" processContents="lax": ett element i en annan namnrymd är tillåtet sist.
    expect(s.validera(dok(`${pid}<x:tillagg xmlns:x="urn:annan">1</x:tillagg>`))).toEqual([]);
    // Svaret: en kodlista som inte stämmer och ett attribut som inte finns.
    const svar = s.bygg(DIA.svar.ns, DIA.svar.lokal, { result: { resultCode: 'OK', logId: '1' } });
    expect(s.validera(svar)).toEqual([]);
    svar.barn[0].barn[0].text = 'KANSKE';
    expect(s.validera(svar)[0]).toContain('ska vara ett av OK, ERROR, INFO');
    svar.barn[0].barn[0].text = 'OK';
    svar.attr.push({ ns: '', lokal: 'x', varde: '1' });
    expect(s.validera(svar)[0]).toContain('attributet x är inte tillåtet');
    // bygg sätter elementen i schemats ordning och avvisar fält som schemat inte har.
    const b = s.bygg(ns, 'GetDiagnosis', { timePeriod: { end: '20261231', start: '20200101' }, patientId: { type: '1.2.752.129.2.1.3.1', id: '194502024732' }, careUnitHSAId: ['X'] });
    expect(b.barn.map(x => x.lokal)).toEqual(['careUnitHSAId', 'patientId', 'timePeriod']);
    expect(b.barn[2].barn.map(x => x.lokal)).toEqual(['start', 'end']);
    expect(() => s.bygg(ns, 'GetDiagnosis', { ...fraga('194502024732'), patient: 'x' })).toThrow('fältet patient finns inte i schemat');
    expect(s.lasUt(b)).toEqual({ careUnitHSAId: ['X'], patientId: { id: '194502024732', type: '1.2.752.129.2.1.3.1' }, timePeriod: { start: '20200101', end: '20261231' } });
  });

  // Samma meddelanden prövas med xmllint (libxml2) mot samma schemafiler, när xmllint finns (i GitHub Actions och på
  // utvecklarens dator; Docker-bygget har inte xmllint). Valideringen i servern och xmllint ska ge samma svar.
  const xmllint = Bun.which('xmllint');
  test.skipIf(!xmllint)('valideringen ger samma svar som xmllint för giltiga och ogiltiga meddelanden', () => {
    const katalog = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'rivta-xmllint-'));
    try {
      const ns = `${DIA.begaran.ns}" xmlns:c="urn:riv:clinicalprocess:healthcond:description:2`;
      const pid = '<r:patientId><c:id>194502024732</c:id><c:type>1.2.752.129.2.1.3.1</c:type></r:patientId>';
      const fall = [
        `<r:GetDiagnosis xmlns:r="${ns}">${pid}</r:GetDiagnosis>`,
        `<r:GetDiagnosis xmlns:r="${ns}"></r:GetDiagnosis>`,
        `<r:GetDiagnosis xmlns:r="${ns}">${pid}<r:careUnitHSAId>X</r:careUnitHSAId></r:GetDiagnosis>`,
        `<r:GetDiagnosis xmlns:r="${ns}">${pid}<r:timePeriod><c:start>2020-01-01</c:start><c:end>20261231</c:end></r:timePeriod></r:GetDiagnosis>`,
        `<r:GetDiagnosis xmlns:r="${ns}">${pid}<x:t xmlns:x="urn:annan"/></r:GetDiagnosis>`,
        `<r:GetDiagnosis xmlns:r="${ns}">${pid}<r:t/></r:GetDiagnosis>`,
        skriv(DIA.schema.bygg(DIA.svar.ns, DIA.svar.lokal, { result: { resultCode: 'OK', logId: '1' } })),
        skriv(DIA.schema.bygg(DIA.svar.ns, DIA.svar.lokal, { result: { resultCode: 'OK', logId: '1' } })).replace('>OK<', '>KANSKE<'),
      ];
      const xsd = join(rivta.RIVTA_ROT, DIA.schemaFil);
      for (const [i, x] of fall.entries()) {
        const fil = join(katalog, `${i}.xml`);
        writeFileSync(fil, x);
        const lint = Bun.spawnSync([xmllint, '--noout', '--nonet', '--schema', xsd, fil], { stderr: 'pipe' }).exitCode === 0;
        expect([i, DIA.schema.validera(tolka(x)).length === 0]).toEqual([i, lint]);
      }
    } finally { rmSync(katalog, { recursive: true, force: true }); }
  });

  test('ett anrop som inte följer profilen ger SOAP Fault på svenska med HTTP-status 500', async () => {
    const db = nyDb();
    const giltig = kuvertFor(diagnosBegaran());
    const ok = await tjanstSvar(db, giltig);
    expect(ok.status).toBe(200);
    expect(ok.headers['Content-Type']).toBe('text/xml; charset=UTF-8');
    const fall = [
      [`<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"><e:Body>${diagnosBegaran()}</e:Body></e:Envelope>`, {}, 'VersionMismatch', 'SOAP 1.1'],
      ['<a>inte soap</a>', {}, 'Client', 'inget SOAP 1.1-kuvert'],
      ['<a>', {}, 'Client', 'inte giltig XML'],
      [kuvertFor(diagnosBegaran(), []), {}, 'Client', 'saknar LogicalAddress'],
      [kuvertFor(diagnosBegaran(), [logiskAdress('SE0000000000-ANNAN')]), {}, 'Client', 'logiska adressen SE0000000000-ANNAN'],
      [kuvertFor(diagnosBegaran(), [logiskAdress(VG), `<x:Krav xmlns:x="urn:x" xmlns:s="${SOAP_NS}" s:mustUnderstand="1"/>`]), {}, 'MustUnderstand', 'mustUnderstand'],
      [giltig, { soapAction: 'urn:fel' }, 'Client', 'SOAPAction urn:fel'],
      [giltig, { vag: '/GetCareContacts/2/rivtabp21' }, 'Client', 'hör inte till GetDiagnosis'],
      [kuvertFor(diagnosBegaran().replace('<ns2:type>', '<ns2:typ>').replace('</ns2:type>', '</ns2:typ>')), {}, 'Client', 'följer inte schemat'],
      [kuvertFor(`<x:Okand xmlns:x="urn:x"/>`), {}, 'Client', 'inte producent'],
      [kuvertFor(diagnosBegaran()), { hsaId: 'SE0000000000-OKAND' }, 'Client', 'ingen anropsbehörighet till GetDiagnosis'],
      [kuvertFor(`${diagnosBegaran()}${diagnosBegaran()}`), {}, 'Client', 'exakt ett element'],
    ];
    for (const [text, opts, kod, del] of fall) {
      const r = await tjanstSvar(db, text, opts);
      expect([del, r.status]).toEqual([del, 500]);
      expect(r.body).toContain(`<faultcode>soap:${kod}</faultcode>`);
      expect(faultText(r.body)).toContain(del);
    }
    // Varje anrop finns i anropsloggen med kontraktet och organisationen, utan patientuppgifter.
    const logg = rivta.anropslogg(db, { max: 100 });
    expect(logg.find(r => r.organisation === 'SE0000000000-OKAND')).toMatchObject({ riktning: 'in', kontrakt: 'GetDiagnosis', resultat: 'nekad' });
    expect(logg.filter(r => r.resultat === 'ok').length).toBe(1);
    expect(JSON.stringify(logg)).not.toContain('194502024732');
  });

  test('producenten svarar bara med det som den anropande organisationens systemkonto får se, och loggar på patienten', async () => {
    const db = nyDb();
    const svar = await anropa(db, fraga('194502024732'));
    expect(svar.result.resultCode).toBe('OK');
    expect(svar.diagnosis.length).toBeGreaterThan(0);
    const d = svar.diagnosis.find(x => x.diagnosisBody.diagnosisCode?.code === 'I50.1');
    expect(d.diagnosisBody).toMatchObject({ typeOfDiagnosis: 'Huvuddiagnos', diagnosisCode: { codeSystem: '1.2.752.116.1.1.1' } });
    expect(d.diagnosisHeader).toMatchObject({ sourceSystemHSAId: VG, patientId: { id: '194502024732' }, approvedForPatient: false });
    const logg = db.query("SELECT * FROM atkomstlogg WHERE patient_id = 'p01' AND resurs LIKE '%_kontrakt=GetDiagnosis%_konsument=SE0000000000-SIMNPO%'").all();
    expect(logg.length).toBe(1);
    expect(logg[0]).toMatchObject({ grund: 'systemkonto', resultat: 'tillaten' });
    // Skyddade personuppgifter lämnas aldrig ut, och en patient som inte finns ger samma svar som en patient som
    // organisationen inte får se.
    const skyddad = await anropa(db, fraga('198404162383'));
    const finnsInte = await anropa(db, fraga('191212121212'));
    const utan = (x) => ({ ...x, result: { ...x.result, logId: null } });
    expect(utan(skyddad)).toEqual(utan(finnsInte));
    expect(skyddad.diagnosis).toBeUndefined();
    // Spärrade uppgifter: patient 4 har spärrat Allmänpsykiatriska kliniken, och inget därifrån lämnas ut.
    const sparr = await anropa(db, fraga('197701182383'));
    expect(JSON.stringify(sparr)).not.toContain('SE2321000164-VK0160');
    // En ogiltig identitet ger resultatet ERROR med INVALID_REQUEST, inte ett fel i transporten.
    const fel = await anropa(db, { patientId: { id: '12', type: 'x' } });
    expect(fel.result).toMatchObject({ resultCode: 'ERROR', errorCode: 'INVALID_REQUEST' });
    // Filtren i begäran.
    const period = await anropa(db, fraga('194502024732', { timePeriod: { start: '20990101', end: '20991231' } }));
    expect(period.diagnosis).toBeUndefined();
  });

  test('ömsesidig TLS med testcertifikat: organisationen fastställs ur certifikatet eller tjänsteplattformens huvud', async () => {
    const db = nyDb();
    const ca = rivta.testCa();
    const producent = ca.utfarda({ hsaId: 'SE0000000000-VKPRODUCENT', cn: 'Vårdkällan producent' });
    const npo = ca.utfarda({ hsaId: rivta.konsumenter.NPO, cn: 'Simulerad NPÖ' });
    const vp = ca.utfarda({ hsaId: 'SE0000000000-SIMVP', cn: 'Simulerad tjänsteplattform' });
    const okand = ca.utfarda({ hsaId: 'SE0000000000-OKAND', cn: 'Okänd' });
    const annanCa = rivta.testCa().utfarda({ hsaId: rivta.konsumenter.NPO, cn: 'Fel CA' });
    expect(npo.cert).toContain('BEGIN CERTIFICATE');
    const t = await rivta.tls.starta({ cert: producent.cert, key: producent.key, ca: ca.cert, plattformar: [vp.fingeravtryck], hantera: rivta.tls.tjanstHanterare(rivta.vardkallan, ctxFor(db)) });
    try {
      const bas = `https://127.0.0.1:${t.port}`;
      const via = (c, huvuden) => rivta.https({ bas, cert: c.cert, key: c.key, ca: ca.cert, huvuden });
      const svar = await rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga('194502024732'), transport: via(npo) });
      expect(svar.diagnosis.length).toBeGreaterThan(0);
      // Genom tjänsteplattformen är den ursprungliga konsumenten huvudet x-rivta-original-serviceconsumer-hsaid.
      const genomVp = await rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga('194502024732'), transport: via(vp, { 'x-rivta-original-serviceconsumer-hsaid': rivta.konsumenter.NPO }) });
      expect(genomVp.diagnosis.length).toBe(svar.diagnosis.length);
      // Tjänsteplattformen utan huvudet, och en organisation utan anropsbehörighet, får ett fel.
      await expect(rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga('194502024732'), transport: via(vp) })).rejects.toThrow('kunde inte fastställas');
      await expect(rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga('194502024732'), transport: via(okand) })).rejects.toThrow('ingen anropsbehörighet');
      // Ett certifikat från en annan CA och ett anrop utan certifikat stoppas redan i TLS.
      await expect(rivta.anropa(DIA, { logiskAdress: VG, begaran: fraga('194502024732'), transport: via(annanCa) })).rejects.toThrow('kunde inte nås');
      await expect(fetch(`${bas}${DIA.vag}`, { method: 'POST', body: 'x', tls: { ca: ca.cert } })).rejects.toThrow();
      const logg = rivta.anropslogg(db, { max: 20 });
      expect(logg.filter(r => r.via === 'tjänsteplattform' && r.resultat === 'ok').length).toBe(1);
    } finally { await t.stopp(); }
  });
});
