// Runda 8, r3: bokning, del 3 (fri bokning, teambesök och gruppträffar) och avdelningens planerade händelser. Testnamnen
// (app/test/bokning-r8.test.js, app/test/avdelningsplan.test.js, klickbudgeten och Sussas testfall i gränssnittet) och de
// poster i Sussa 3.1.2, 3.4.1 och 3.4.2 som byggdes i rundan. Mappningsfilerna ersätter sina poster med dessa efter
// runda 6, r4 (planering-r4.js), så att ändringen ligger samlad här.
import { T, flode } from './tidbok-tester.js';
import { T4 } from './planering-r4.js';
import { testfall, testfallTest } from '../sussa-testfall.js';
import { TEST } from '../krav.js';

const { A, S } = TEST;

const B = 'Bokning, del 3 > ';
const P = 'Avdelningens planering > ';
export const T8 = {
  fri: `${B}fri bokning: systemet väljer besökstyp, vårdgivare och tider, och bokningen skapar vårdkontakten och kallelsen`,
  friSakerhet: `${B}fri bokning: utan vårdrelation, fel roll, en annan vårdenhets tid och en gruppträff nekas`,
  team: `${B}teambesök: systemet föreslår teamet och tider där alla och ett rum är lediga, och teamets tider blir upptagna`,
  teamSakerhet: `${B}teambesök: färre än två vårdgivare eller en vårdgivare från en annan vårdenhet nekas`,
  grupp: `${B}gruppträff: platser kvar, kallelser som går ut för hela gruppen och direkt för den som läggs till efteråt`,
  gruppVantelista: `${B}gruppträff: en full träff ger plats på gruppens väntelista, och systemet föreslår den som har väntat längst`,
  dag: `${P}dagens händelser på avdelningen per patient med uppgifter, läkemedel att ge och bokade tider (testfall 7.1 och 7.2)`,
  patientResurs: `${P}patientens planering över flera dagar och en resurs planering för veckan (testfall 7.3 och 7.4)`,
  planera: `${P}systemet avgör typ, yrkesroll, längd och tid ur texten när en uppgift planeras, och undersköterskan registrerar att den är utförd`,
  sakerhet: `${P}en bokad tid på en annan vårdenhet syns inte utan aktivt val, och svaret är detsamma med och utan den`,
};
// Sussas testfall i gränssnittet (test/sussa-testfall.cjs), en körning per roll.
const tf = (nr) => { const x = testfall(nr); return x.korningar.map(k => testfallTest(x, k)); };

const p = (id, avsedd, egna, tester, losning, expert, anmarkning) => ({ id, kategori: 'system', egna, avsedd, tester, losning, expert, anmarkning });

const POSTER = () => Object.fromEntries([
  p('3.1.2.2', 'delvis', ['D2', 'M5'], [`${A}översikten har tidslinje med migrerade poster märkta`, `${S}migrerad historik från VAS och Cosmic finns för patient 1`, T8.dag, T8.patientResurs, flode('avdelningens-handelser'), ...tf('7.1'), ...tf('7.3')],
    'Översikten visar patientens vård i en kronologi där migrerad historik syns likvärdigt med ny dokumentation. Avdelningens planering visar aktiviteter och åtgärder för avdelningens patienter per tid, per patient och per yrkesroll, och en patients planering visar flera dagar bakåt och framåt.',
    'Systemet samlar uppgifter, läkemedel att ge och bokade tider i en vy, så att ingen behöver leta på flera ställen, och väljer avdelningen efter var användaren arbetar.',
    'Vyerna för uppföljning, resultat och avvikelser över hela vårdprocessen mellan vårdgivare finns inte som standardvyer.'),
  p('3.4.1.2', 'uppfyllt_demo', [], [T.seed, T.tidbok, T.forslag, T4.resurser, T4.ingrepp, T4.ombokaResurser, flode('boka-ingrepp'), T8.team, T8.teamSakerhet, flode('boka-team')],
    'Personal, lokaler, utrustning och sjukresor är resurser i tidboken. Ett ingrepp kräver de resurser som det behöver, och ett teambesök bokar två eller flera vårdgivare och ett behandlingsrum samtidigt. Bokningen knyter alla resurser till patienten.',
    'Systemet väljer resurserna själv, föreslår patientens läkare och sjuksköterska som team och bokar bara tider där alla är lediga hela tiden, så ingen behöver jämföra scheman.',
    'Sjukresan är simulerad. Resurser, scheman och ingreppens krav ändras bara i seeden.'),
  p('3.4.1.5', 'delvis', [], [T.tidbok, T.forslag, T4.ingrepp, T4.arbetslista, T4.resurser, T8.team, T8.grupp, T8.gruppVantelista, T8.patientResurs],
    'Tidboken visar beläggningen per vårdgivare och dag och en arbetslista per lokal och utrustning. Teambesök tar alla i teamet ur deras scheman, gruppträffar visar platser kvar och har en egen väntelista, och en persons planering visar veckan.',
    'Systemet räknar beläggningen och platserna själv, väljer bara tider där alla resurser är lediga och föreslår den som har väntat längst när en plats i en grupp blir ledig.',
    'Produktionsplanering över längre tid och prognoser för kapacitet finns inte. Sjukresan är simulerad.'),
  p('3.4.1.6', 'uppfyllt_demo', [], [T.tidbok, T.startsida, T.egenbokning, T4.vyer, T4.period, T4.arbetslista, T8.dag, T8.patientResurs, T8.sakerhet, flode('avdelningens-handelser'), ...tf('7.1'), ...tf('7.2'), ...tf('7.3'), ...tf('7.4')],
    'Planeringen visas för enheten (Dagens arbete, tidboken och avdelningens planering), per vårdgivare och person (schemat och personens vecka), per resurs (arbetslistan) och per patient (översikten, patientens planering och Min journal). Avdelningens planering visas per tid, per patient eller per yrkesroll och för ett urval av patienter.',
    'Systemet samlar det som är planerat ur uppgifterna, ordinationerna och tidboken och väljer förvalet efter rollen. Varje patient prövas i behörighetsmotorn, och en tid på en annan vårdenhet syns bara efter aktivt val.',
    'Läkare och sjuksköterskor når tidboken och avdelningens planering från arbetslistan. Valen i avdelningens planering sparas inte på servern.'),
  p('3.4.1.8', 'uppfyllt_demo', ['D6'], [`${A}arbetslista maskerar skyddad identitet`, `${A}inkorgen visar larm, okvitterade svar och NLL-avvikelser`, flode('oppna-patient'), T.startsida, flode('checka-in'), T4.period, T4.bevakning, T8.dag, T8.planera, flode('avdelningens-handelser')],
    'Arbetslistan, inkorgen, Dagens arbete och avdelningens planering är aktivitetslistor för olika roller. Avdelningens planering visar dagens uppgifter för patienterna med vem som ansvarar, och den som gör en uppgift registrerar att den är utförd med ett klick.',
    'Listorna räknas fram ur vårdrelationen, bokningarna, ordinationerna och de planerade uppgifterna. När en uppgift planeras avgör systemet typ, yrkesroll och längd ur texten och föreslår tiden.',
    'Aviseringar utanför systemet, till exempel sms eller e-post till personalen, finns inte.'),
  p('3.4.2.1', 'uppfyllt_demo', ['D6'], [T.boka, T.omboka, T.avboka, T.behorighet, T.nekad, T.avvisad, T.relationsfonster, flode('boka-remiss'), flode('omboka'), T8.fri, T8.friSakerhet, flode('boka-fri'), ...tf('5.1')],
    'Bokning, ombokning och avbokning från startsidan, väntelistan, tidboken och patientens översikt, och fri bokning av en patient som inte står på väntelistan. En bokning är en planerad vårdkontakt, och varje åtgärd prövas i behörighetsmotorn och loggas.',
    'Systemet väljer besökstyp, vårdgivare och de lämpligaste tiderna också vid fri bokning, så bokningen är ett klick. Vid ombokning flyttas vårdkontakten med, och patienten får en ny kallelse utan att någon ber om det.',
    'Bokningsregler som verksamheten själv kan ändra finns inte i gränssnittet. En patient utan vårdrelation på vårdenheten kan inte bokas fritt.'),
  p('3.4.2.2', 'uppfyllt_demo', ['D6'], [T.forslag, T.boka, T.omboka, T.avboka, T.kallelse, flode('boka-remiss'), flode('omboka'), T4.ingrepp, T4.kedja, T4.arbetslista, flode('boka-ingrepp'), flode('boka-kedja'), T8.fri, T8.team, T8.grupp, T8.gruppVantelista, flode('boka-fri'), flode('boka-team'), flode('grupp-lagg-till'), ...tf('5.1'), ...tf('5.2'), ...tf('5.3')],
    'Bokningen utgår från planeringen: väntelistan, ingrepp med personal, lokal och utrustning, tider i följd, fri bokning, teambesök med flera vårdgivare och ett rum, och gruppträffar med platser kvar, gruppens väntelista och gruppkallelse. Bokningen skapar vårdkontakten och kallelsen.',
    'Allt som går att räkna ut görs av systemet: besökstyp, vårdgivare, team, tider, resurser, kallelse, kanal, avgift och vårdkontakt. Den som bokar väljer bara bland förslagen.',
    'Bokningsregler och mallar som verksamheten själv kan ändra finns inte i gränssnittet. Ett teambesök bokas om genom att avbokas och bokas på nytt.'),
].map(x => [x.id, x]));

let cache = null;
export const medR8 = (poster) => { cache ??= POSTER(); return poster.map(x => cache[x.id] ?? x); };
