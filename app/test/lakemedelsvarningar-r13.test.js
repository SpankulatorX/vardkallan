// Runda 13, r3: rättelser från det utforskande testet (E1-11, E1-21 och E1-25). Varningarna vid Kontrollera och spara
// ska nämna den aktuella interaktionen, och interaktionskontrollen ska räkna med patientens läkemedel i Nationella
// läkemedelslistan också när de har ordinerats på en spärrad vårdenhet, utan att röja något annat om den spärrade
// journalen. Testnamnen används i kravregistret.
import { describe, test, expect } from 'bun:test';
import { byggSeed, idag, addDagar } from '../src/db.js';
import * as lakemedel from '../src/lakemedel.js';
import { atk } from './hjalp.js';

const ord = (lakemedelId, extra = {}) => ({ lakemedelId, dosering: '1 tablett 3 gånger dagligen', typ: 'staende', ordinationsorsak: 'Prov', uppfoljningsdatum: addDagar(idag(), 30), ...extra });
const IBUPROFEN = 'VK-NPL-0027';
const WARAN = 'VK-NPL-0001';

describe('Läkemedelsvarningar vid ordination', () => {
  test('NSAID till en äldre patient med apixaban, furosemid och spironolakton ger varningar som nämner varje interaktion', () => {
    const db = byggSeed();
    const v = lakemedel.kontroll(atk(db, 'lak-vc', 'p10'), ord(IBUPROFEN)).varningar;
    const regler = v.map(x => `${x.niva}:${x.regel}`);
    expect(regler).toEqual(expect.arrayContaining(['allvarlig:interaktion_B01AF_M01A', 'allvarlig:interaktion_M01A_C03DA', 'observera:interaktion_M01A_C03CA', 'observera:nsaid_aldre']));
    const text = (r) => v.find(x => x.regel === r).text;
    expect(text('interaktion_B01AF_M01A')).toContain('Eliquis');
    expect(text('interaktion_B01AF_M01A')).toContain('blödning');
    expect(text('interaktion_M01A_C03DA')).toContain('Spironolakton');
    expect(text('interaktion_M01A_C03DA')).toContain('kalium');
    expect(text('interaktion_M01A_C03CA')).toContain('njur');
    expect(text('nsaid_aldre')).toContain('år');
    // Sparandet kräver kvittens av de allvarliga varningarna.
    expect(() => lakemedel.spara(atk(db, 'lak-vc', 'p10', {}, 'ordinera'), ord(IBUPROFEN))).toThrow('Allvarliga varningar måste kvitteras');
  });

  test('warfarin till en patient med tikagrelor och acetylsalicylsyra ger en varning för trippelbehandling', () => {
    const db = byggSeed();
    const v = lakemedel.kontroll(atk(db, 'lak-kard', 'p04'), ord(WARAN, { dosering: '2 tabletter till kvällen' })).varningar;
    const trippel = v.filter(x => x.regel === 'interaktion_B01AA_B01AC');
    expect(trippel.length).toBe(1);
    expect(trippel[0].niva).toBe('allvarlig');
    expect(trippel[0].text).toContain('Brilique');
    expect(trippel[0].text).toContain('Trombyl');
    expect(trippel[0].text).toMatch(/PK\(INR\)/);
  });

  test('läkemedel i Nationella läkemedelslistan från en spärrad vårdenhet ingår i interaktionskontrollen när ordinationen sparas, utan att läkemedlet röjs och med loggning', () => {
    const db = byggSeed();
    // p04 har Sertralin från psykiatrin, som är spärrad för kardiologen.
    const a = atk(db, 'lak-kard', 'p04');
    expect(JSON.stringify(lakemedel.lista(a))).not.toContain('Sertralin');
    // Säkerhetsgranskningen: Kontrollera och spara säger inget om det dolda läkemedlet, så att kontrollen inte blir ett
    // orakel för vad som står på den spärrade vårdenheten.
    const kontroll = lakemedel.kontroll(atk(db, 'lak-kard', 'p04'), ord(WARAN, { dosering: '2 tabletter till kvällen' })).varningar;
    expect(kontroll.some(x => x.regel === 'interaktion_dold')).toBe(false);
    // När ordinationen sparas med kvittens kommer varningen, utan läkemedel eller substans, och den loggas på patienten.
    const fore = db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p04' AND resurs LIKE 'nll:dold_interaktion:%'").get().n;
    const kv = kontroll.filter(x => x.niva === 'allvarlig').map(x => ({ regel: x.regel, motivering: 'Bedömt med kardiolog.' }));
    const r = lakemedel.spara(atk(db, 'lak-kard', 'p04', {}, 'ordinera'), ord(WARAN, { dosering: '2 tabletter till kvällen', kvitteradeVarningar: kv }));
    const dold = r.varningar.find(x => x.regel === 'interaktion_dold');
    expect(dold).toBeDefined();
    expect(dold.text).toBe(lakemedel.DOLD_INTERAKTION);
    expect(JSON.stringify(r.varningar)).not.toMatch(/Sertralin|N06AB|psyk|Psykiatri|SSRI/i);
    expect(db.query("SELECT count(*) AS n FROM atkomstlogg WHERE patient_id = 'p04' AND resurs LIKE 'nll:dold_interaktion:%'").get().n).toBe(fore + 1);
    // Samma substans som det dolda läkemedlet ger ingen varning, eftersom träffen bara prövas mot interaktionsreglerna.
    const sertralin = lakemedel.spara(atk(db, 'lak-kard', 'p04', {}, 'ordinera'), ord('VK-NPL-0041', { dosering: '1 tablett på morgonen',
      kvitteradeVarningar: lakemedel.kontroll(atk(db, 'lak-kard', 'p04'), ord('VK-NPL-0041')).varningar.filter(x => x.niva === 'allvarlig').map(x => ({ regel: x.regel, motivering: 'Bedömt.' })) }));
    expect(sertralin.varningar.some(x => x.regel === 'interaktion_dold')).toBe(false);
    // Med patientens samtycke syns läkemedlet, och varningen gäller det synliga läkemedlet i stället.
    const med = lakemedel.kontroll(atk(db, 'lak-kard', 'p04', { samtycke_sparr: { syfte: 'Prov', tid: new Date().toISOString() } }), ord(WARAN)).varningar;
    expect(med.some(x => x.regel === 'interaktion_B01A_N06AB')).toBe(true);
  });
});
