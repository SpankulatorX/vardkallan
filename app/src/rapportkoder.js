// Kodverk och mappning för rapporteringen till myndigheter och register (runda 7, r5, Sussa 6.3.2). Varje kod är
// kontrollerad mot primärkällan, och källorna med version och kontrollsumma står i docs/kodkontroll.md. Mappningen från
// Vårdkällans vårdenheter till Socialstyrelsens sjukhus- och verksamhetskoder ligger här och visas i gränssnittet, så
// att den går att granska. Vårdenheterna och deras HSA-id är påhittade i demon, men sjukhuskoderna är de verkliga.

// Länskod enligt SCB:s förteckning över läns- och kommunkoder. Den är filkoden i filnamnen för en offentlig vårdgivare.
export const LANSKOD = '18';

// Kommunkoder enligt SCB, för patientens folkbokföringskommun. I demon finns bara orten, så kommunen räknas ur den.
export const KOMMUNKOD = { 'Örebro': '1880', 'Kumla': '1881', 'Askersund': '1882', 'Karlskoga': '1883', 'Nora': '1884', 'Lindesberg': '1885' };

// Sjukhuskoder ur Socialstyrelsens förteckning över koder för sjukhus (koder-for-sjukhus-patientregister-2026.xlsx).
export const SJUKHUS = { uso: '55010', kkoga: '55011', lind: '55012' };

// Medicinska verksamhetsområden (MVO) ur Socialstyrelsens kodlista över verksamhetsområden.
export const MVO = {
  '011': 'Distriktsläkarvård', '100': 'Akutklinik', '101': 'Internmedicinsk vård', '121': 'Infektionssjukvård', '231': 'Kardiologisk vård',
  '311': 'Ortopedisk vård', '441': 'Förlossningsvård (BB)', '451': 'Obstetrisk och gynekologisk vård', '901': 'Allmänpsykiatrisk vård, vuxna',
};

// Vårdenhet i Vårdkällan till sjukhus, verksamhetsområde och akutverksamhet (uppgift 8 i OV-filen). primarvard betyder att
// enheten är primärvård, som inte omfattas av uppgiftsskyldigheten till patientregistret (HSLF-FS 2023:33 2 §).
// Att akutmottagningen har MVO 100 och psykiatrins akut räknas som psykiatrisk akutmottagning (3) är antaganden i demon.
export const ENHETER = {
  'uso-akut': { sjukhus: 'uso', mvo: '100', akut: '1' },
  'uso-kard': { sjukhus: 'uso', mvo: '231' },
  'uso-med': { sjukhus: 'uso', mvo: '101' },
  'uso-inf': { sjukhus: 'uso', mvo: '121' },
  'uso-ort': { sjukhus: 'uso', mvo: '311' },
  'uso-psyk': { sjukhus: 'uso', mvo: '901', akut: '3', psykiatri: true },
  'lind-med': { sjukhus: 'lind', mvo: '101' },
  'kkoga-ort': { sjukhus: 'kkoga', mvo: '311' },
  'vc-tybble': { mvo: '011', primarvard: true },
  'vc-kumla': { mvo: '011', primarvard: true },
};

// Yrkeskod enligt Socialstyrelsens nationella yrkeskodverk SOSNYK (för OV_YK i psykiatrisk öppenvård).
export const SOSNYK = { lakare: '11000', sjukskoterska: '31000', underskoterska: '52800' };
// Yrkesgrupp i väntetidsrapporteringen, KVÅ-koder ur filspecifikationen för väntande i specialiserad vård.
export const VIV_YRKESGRUPP = { lakare: 'XS915', sjukskoterska: 'XS919', underskoterska: 'XS921', ovriga: 'XS922' };

// Aktiviteter i väntetidsdatabasens vårdutbudsförteckning (register-vantetider-aktiviteter-vantetidsdatabasen.xlsx,
// version 1.0) för de ingrepp som finns i demons tidbok. Nyckeln är ordet i väntelistans orsak.
export const VIV_AKTIVITET = { elkonvertering: { kod: '23102', text: 'Elkonvertering', mvo: '231' } };

// Yttre orsak (ICD-10-SE kapitel XX) som systemet sätter ihop ur tre frågor: vad som hände, var och vad patienten
// gjorde. Titlarna är ordagranna ur icd-10-se.tsv, och alla 280 kombinationer är kontrollerade mot filen.
export const YTTRE_MEKANISM = {
  W01: 'Fall i samma plan genom halkning, snavning eller snubbling',
  W10: 'Fall i och från trappa och trappsteg',
  W19: 'Fall, ospecificerat',
  X59: 'Exponering för ospecificerad faktor',
};
export const YTTRE_PLATS = {
  0: 'bostad och bostadsområde', 1: 'institutionellt boende', 2: 'skola, annan institution och offentlig lokal', 3: 'idrotts- och sportanläggning',
  4: 'gata och väg', 5: 'butiks-, handels- eller serviceområde', 6: 'industriområde, byggarbetsplats', 7: 'lantbruksområde',
  8: 'andra specificerade platser', 9: 'plats, ospecificerad',
};
export const YTTRE_AKTIVITET = {
  0: 'idrott, sport, motion', 1: 'lek och annan fritidsverksamhet', 2: 'förvärvsarbete', 3: 'annan sysselsättning',
  4: 'vitalaktivitet såsom vila, sömn, måltid och personlig hygien', 8: 'andra specificerade aktiviteter', 9: 'aktivitet, ospecificerad',
};
// Koden och titeln för en kombination, eller null om någon del inte finns.
export function yttreOrsak(mekanism, plats, aktivitet) {
  const m = YTTRE_MEKANISM[mekanism];
  const p = YTTRE_PLATS[plats];
  const a = YTTRE_AKTIVITET[aktivitet];
  if (!m || !p || !a) return null;
  return { kod: `${mekanism}.${plats}${aktivitet}`, text: `${m} - ${p} - ${a}` };
}
export function tolkaYttreOrsak(kod) {
  const r = /^([WX]\d\d)\.(\d)(\d)$/.exec(String(kod ?? ''));
  return r ? yttreOrsak(r[1], r[2], r[3]) : null;
}

// Förlossning och förlossningsutfall i ICD-10-SE, för medicinska födelseregistret. Titlarna ordagranna ur icd-10-se.tsv.
export const FORLOSSNING = {
  O80: 'Spontanförlossning vid enkelbörd', O81: 'Enkelbördsförlossning med tång eller sugklocka', O82: 'Kejsarsnittsförlossning, enkelbörd',
  O83: 'Annan enkelbördsförlossning med förlossningshjälp', O84: 'Förlossning vid flerbörd',
};
// Antal barn per kod för förlossningsutfall (Z37). Z37.9 betyder att utfallet inte är specificerat.
export const UTFALL_ANTAL = { 'Z37.0': 1, 'Z37.1': 1, 'Z37.2': 2, 'Z37.3': 2, 'Z37.4': 2 };

// Ett kapitel i ICD-10-SE ur koden: XIX är skador och förgiftningar (S00 till T98), XX yttre orsaker (V01 till Y98).
export const arSkada = (kod) => /^[ST]\d/.test(kod);
export const arYttreOrsak = (kod) => /^[VWXY]\d/.test(kod);
// Koder som enligt ICD-10-SE inte ska användas som huvuddiagnos: yttre orsaker och förlossningsutfall.
export const ejHuvuddiagnos = (kod) => arYttreOrsak(kod) || /^Z37/.test(kod);
// En kod utan punkt, som filerna kräver.
export const utanPunkt = (kod) => String(kod ?? '').replace('.', '');

// Källorna, som gränssnittet och docs/kodkontroll.md visar.
export const KALLOR = [
  { id: 'par', namn: 'Socialstyrelsens föreskrifter (HSLF-FS 2023:33) om uppgiftsskyldighet till Socialstyrelsens patientregister, bilaga 1 till 3', version: 'Beslutade 2023-06-20, gäller uppgifter från 2024. Bilaga 1 och 2 gäller i lydelsen enligt HSLF-FS 2025:44 (från 2025-07-01). Ändrade också genom HSLF-FS 2024:9 (från 2025-04-01) och HSLF-FS 2026:27 (från 2027-01-01).', url: 'https://www.socialstyrelsen.se/publikationer/hslf-fs-202333-socialstyrelsens-foreskrifter-om-uppgiftsskyldighet-till-socialstyrelsens-patientregister-2023-6-8667/' },
  { id: 'mfr', namn: 'Socialstyrelsens föreskrifter (HSLF-FS 2024:5) om uppgiftsskyldighet till Socialstyrelsens medicinska födelseregister, bilaga 1 och 2', version: 'Beslutade 2024-03-05, gäller från 2025-07-01, med rättelseblad.', url: 'https://www.socialstyrelsen.se/publikationer/hslf-fs-20245-socialstyrelsens-foreskrifter-om-uppgiftsskyldighet-till-socialstyrelsens-medicinska-fodelseregister-2024-3-8995' },
  { id: 'viv', namn: 'Socialstyrelsens filspecifikation för uppgifter om väntande i specialiserad vård (VTID_SVV_AD)', version: 'Version 1.2, 2025-10-01. Rapporteringen gick från SKR till Socialstyrelsen den 1 juli 2025.', url: 'https://socialstyrelsen.se/statistik-och-data/register/lamna-uppgifter-till-register/vantetider/' },
  { id: 'sjukhus', namn: 'Socialstyrelsens förteckning över koder för sjukhus och kodlista över verksamhetsområden', version: 'koder-for-sjukhus-patientregister-2026.xlsx och sjukhuskoder-kodlista-verksamhetsomraden-2006.pdf', url: 'https://socialstyrelsen.se/statistik-och-data/klassifikationer-och-koder/andra-kodverk/sjukhuskoder/' },
  { id: 'sosnyk', namn: 'Socialstyrelsens nationella yrkeskodverk (SOSNYK)', version: 'SOSNYK 2027 version 1.0. Koderna som används här är oförändrade sedan 2024.', url: 'https://www.socialstyrelsen.se/statistik-och-data/klassifikationer-och-koder/andra-kodverk/sosnyk/' },
  { id: 'icd', namn: 'ICD-10-SE, Socialstyrelsens kodfil icd-10-se.tsv', version: 'Giltig från 2026-01-01', url: 'https://www.socialstyrelsen.se/globalassets/sharepoint-dokument/dokument-webb/klassifikationer-och-koder/icd-10-se.tsv' },
];
