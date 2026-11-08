// Övningar och intyg i utbildningsmiljön (Sussa 10.1.1.5, och 10.1.1.3 för onlinehjälp och uppföljning).
//
// Varje yrkesroll har ett antal korta övningar om hur Vårdkällan fungerar, med demopatienter. Den som svarar rätt på
// alla får ett intyg som gäller i ett år, och verksamhetschefen ser vilka på vårdenheten som har ett giltigt intyg,
// vilka som går ut inom 30 dagar och vilka som saknar intyg.
//
// Systemet är experten: det väljer själv övningarna efter yrkesrollen, rättar på servern (rätt svar lämnas aldrig ut
// före rättningen), förklarar varje svar på vanlig svenska, räknar giltighetstiden och påminner när intyget snart går
// ut. Verksamhetschefen behöver inte föra listor: systemet vet vilka som arbetar på vårdenheten.
//
// Övningarna innehåller inga patientuppgifter utom demopatienternas påhittade namn. Demon är själv utbildningsmiljön.
import { Fel, iso } from './db.js';
import { kanRoll, vardenhetFor } from './atkomst.js';
import { chefFor } from './lakemedelsansvar.js';
import { YRKEN } from './seed/personal.js';
import { KURS, GILTIG_DAGAR } from './utbildning-schema.js';

const DAG = 86400_000;
export const GAR_UT_DAGAR = 30;
export const UTBILDNINGSMILJO = 'Övningarna görs i demon, som är Vårdkällans utbildningsmiljö. Patienterna i övningarna är demopatienter med påhittade namn, och intyget gäller bara i demon.';

// Grupper av yrken. journal är de roller som läser patientens journal.
const JOURNAL = ['lakare', 'sjukskoterska', 'underskoterska', 'vardadministrator', 'farmaceut'];
const ALLA = Object.keys(YRKEN);

const o = (id, roller, fraga, alternativ, ratt, forklaring, prova = null) => ({ id, roller, fraga, alternativ, ratt, forklaring, prova });

export const OVNINGAR = [
  o('logg', ALLA, 'Vad händer när du öppnar journalen för en patient i Vårdkällan?', [
    ['a', 'Inget sparas om du bara läser.'],
    ['b', 'Åtkomsten skrivs i åtkomstloggen med vem, när och på vilken grund, och patienten kan se den i Min journal.'],
    ['c', 'Bara ändringar i journalen loggas.'],
  ], 'b', 'Varje åtkomst till patientuppgifter loggas, också när du bara läser. Loggen går inte att ändra, och patienten ser i Min journal vilken vårdenhet och yrkesroll som har läst.'),
  o('expert', ALLA, 'Ett val dyker upp som du inte vet hur du ska fylla i. Vad gäller i Vårdkällan?', [
    ['a', 'Du behöver kunna kodverket för att fylla i det.'],
    ['b', 'Systemet fyller i det som går att räkna ut, föreslår resten och förklarar på vanlig svenska varför något inte går.'],
    ['c', 'Hoppa över valet, det kontrolleras ändå inte.'],
  ], 'b', 'Systemet är experten: koder, vårdkontakt, enhet och tider sätts av systemet, och när något inte går står det varför. Knappen Hjälp i flödet förklarar stegen.'),
  o('andra-enheter', JOURNAL, 'Du behöver läsa vad en annan vårdenhet har dokumenterat om demopatienten Gunnar Åkesson. Hur gör du?', [
    ['a', 'Ber en kollega på den andra vårdenheten skriva ut journalen.'],
    ['b', 'Väljer Visa uppgifter från andra vårdenheter i patienthuvudet och anger syftet, som systemet föreslår.'],
    ['c', 'Det går inte att läsa andra vårdenheters uppgifter.'],
  ], 'b', 'Inre sekretess: andra vårdenheters uppgifter visas efter ett aktivt val med syfte. Valet loggas och gäller sessionen för den patienten.', '#/patient/p01'),
  o('sparr', JOURNAL, 'Demopatienten Elin Sandberg har spärrat uppgifter. Vad ser du som inte arbetar på den spärrade vårdenheten?', [
    ['a', 'Allt, eftersom du har vårdrelation.'],
    ['b', 'En spärrmarkering, men inte innehållet eller vilken vårdenhet det gäller. Spärren hävs bara med patientens samtycke i stunden.'],
    ['c', 'Innehållet, om du väljer nödåtkomst.'],
  ], 'b', 'En spärr hävs bara tillfälligt med patientens samtycke, och nödåtkomst häver aldrig en spärr.'),
  o('skyddad', JOURNAL, 'En patient har skyddade personuppgifter. Vad visar systemet i arbetslistan och väntrummet?', [
    ['a', 'Namn och adress som vanligt.'],
    ['b', 'Skyddad identitet i stället för namnet, och adressen visas aldrig. Väntrummet visar bara könummer.'],
    ['c', 'Patienten visas inte alls.'],
  ], 'b', 'Systemet maskerar skyddad identitet överallt utan att någon behöver komma ihåg det. Visa identitet kräver ett syfte och loggas.', '#/arbetslista'),
  o('overkanslighet', ['lakare'], 'Du ordinerar amoxicillin till demopatienten Gunnar Åkesson, som är överkänslig mot penicilliner. Vad gör systemet?', [
    ['a', 'Sparar ordinationen utan varning.'],
    ['b', 'Varnar innan ordinationen sparas och kräver en motivering om du ändå vill ordinera.'],
    ['c', 'Tar bort överkänsligheten ur journalen.'],
  ], 'b', 'Ordinationen kontrolleras mot överkänslighet och andra läkemedel innan den sparas. En allvarlig varning kräver en motivering, som sparas med ordinationen.', '#/patient/p01/lakemedel'),
  o('nodatkomst', ['lakare', 'sjukskoterska'], 'Patienten saknar vårdrelation till din vårdenhet och kan inte samtycka, men du behöver journalen för vården. Vad gäller?', [
    ['a', 'Du kan inte öppna journalen.'],
    ['b', 'Du väljer Nödåtkomst med ett syfte. Åtkomsten flaggas i loggen och följs upp, och en spärr hävs aldrig.'],
    ['c', 'Du öppnar journalen som vanligt.'],
  ], 'b', 'Nödåtkomst kräver syfte och intyg om att patienten inte kan samtycka. Den syns för logggranskaren.', '#/sok'),
  o('dubbel-dos', ['sjukskoterska', 'underskoterska'], 'Du ska ge en dos från Läkemedel att ge, och systemet varnar för dubbel dos. Vad betyder det?', [
    ['a', 'Att listan är fel och varningen kan bortses från.'],
    ['b', 'Att en dos av samma läkemedel redan är registrerad nyss. Kontrollera innan du ger igen.'],
    ['c', 'Att läkaren måste ordinera på nytt.'],
  ], 'b', 'Systemet räknar fram dagens doser ur ordinationerna och varnar för dubbel dos, för tidig dos och högsta dygnsdos, med en förklaring.', '#/administrering'),
  o('news2', ['sjukskoterska'], 'Du registrerar vitalparametrar och NEWS2 blir 7. Vad gör systemet?', [
    ['a', 'Inget, du räknar NEWS2 själv.'],
    ['b', 'Räknar NEWS2, skriver vad som ska göras och när nästa kontroll ska göras, och larmar i inkorgen för sjuksköterskan och läkaren.'],
    ['c', 'Skickar ett sms till patienten.'],
  ], 'b', 'NEWS2 räknas ur vitalparametrarna. En summa som kräver åtgärd larmar i inkorgen. Reglerna är demoregler.'),
  o('delegering', ['underskoterska'], 'När får du som undersköterska ge ett läkemedel?', [
    ['a', 'När som helst om sjuksköterskan säger det.'],
    ['b', 'Bara med en giltig delegering. Systemet prövar delegeringen för just den dosen och visar knappen Ge bara då.'],
    ['c', 'Aldrig.'],
  ], 'b', 'Delegeringen registreras av en sjuksköterska eller läkare enligt HSLF-FS 2017:37 9 kap., och systemet påminner innan den går ut.', '#/delegeringar'),
  o('boka', ['vardadministrator'], 'En remiss väntar på tid. Hur bokar du?', [
    ['a', 'Letar själv efter en ledig tid i tidboken och räknar dagarna mot vårdgarantin.'],
    ['b', 'Väljer en av de tider som systemet föreslår i Dagens arbete. Systemet räknar dagarna mot vårdgarantin och skriver kallelsen.'],
    ['c', 'Ringer patienten först.'],
  ], 'b', 'Systemet föreslår de lämpligaste tiderna, så att bokningen är ett klick, och väljer kanal för kallelsen.', '#/idag'),
  o('samman', ['vardadministrator'], 'Systemet har hittat en trolig dubblett. Vem slår samman journalerna?', [
    ['a', 'Den som först ser dubbletten.'],
    ['b', 'Vårdadministratören bekräftar sammanslagningen, med behörighet till båda journalerna. Den gamla identiteten går att söka på.'],
    ['c', 'Systemet slår samman utan att fråga.'],
  ], 'b', 'Systemet hittar troliga dubbletter, och bara en vårdadministratör bekräftar sammanslagningen.'),
  o('genomgang', ['farmaceut'], 'Vad gör du i en fördjupad läkemedelsgenomgång?', [
    ['a', 'Ändrar ordinationerna själv.'],
    ['b', 'Går igenom läkemedlen med läkaren och patienten. Systemet tar fram läkemedelsberättelsen.'],
    ['c', 'Skickar en remiss till apoteket.'],
  ], 'b', 'Farmaceuten deltar i genomgången, och läkaren ordinerar. Systemet sammanställer underlaget.'),
  o('stickprov', ['logggranskare'], 'Hur väljs åtkomsterna i ett stickprov?', [
    ['a', 'Granskaren väljer själv vilka personer som ska granskas.'],
    ['b', 'Systemet drar åtkomsterna slumpvis för perioden, och du markerar var och en som befogad eller att den ska utredas.'],
    ['c', 'Bara nödåtkomster granskas.'],
  ], 'b', 'Stickprov enligt HSLF-FS 2016:40 4 kap. 9 b §. Nödåtkomster är dessutom flaggade i logguppföljningen.', '#/logg'),
  o('gallring', ['arkivarie'], 'När får en journal gallras?', [
    ['a', 'När den är äldre än tio år.'],
    ['b', 'Bara efter ett registrerat beslut, och åtkomstloggen ändras inte.'],
    ['c', 'När patienten ber om det.'],
  ], 'b', 'Gallring och förstöring görs bara efter ett registrerat beslut. Exportpaketet följer Riksarkivets FGS.', '#/arkiv'),
  o('datauttag', ['uppfoljning'], 'Vad innehåller datauttaget för uppföljning?', [
    ['a', 'Hela journalen med namn.'],
    ['b', 'Uppgifter utan namn och personnummer, uppdaterade varje natt.'],
    ['c', 'Bara antalet patienter.'],
  ], 'b', 'Datauttaget har inga namn eller personnummer och uppdateras varje natt.', '#/datauttag'),
  o('samverkan', ['kommun'], 'Vad ser du som kommunens personal i Vårdkällan?', [
    ['a', 'Patientens hela journal.'],
    ['b', 'Den samordnade planeringen som delas med kommunen, inte journalen.'],
    ['c', 'Ingenting.'],
  ], 'b', 'Kommunen är en simulerad part i demon och ser bara den samordnade planeringen.', '#/samverkan'),
  o('ledningsansvar', ['verksamhetschef'], 'Vilket ansvar kan du som verksamhetschef inte lämna över?', [
    ['a', 'Inget, allt kan lämnas över.'],
    ['b', 'Det samlade ledningsansvaret för läkemedel. Enskilda uppgifter kan uppdras åt andra, och systemet påminner när ett uppdrag saknas.'],
    ['c', 'Ansvaret för läkemedelsmallarna.'],
  ], 'b', 'Gröna häftet 1.3: ledningsansvaret kan inte överlåtas, men uppdrag som medicinskt ansvarig läkare kan utses.', '#/lakemedelsansvar'),
  o('intyg', ['verksamhetschef'], 'Hur ser du vilka på vårdenheten som har giltigt intyg?', [
    ['a', 'Du frågar var och en.'],
    ['b', 'Under Utbildning. Systemet vet vilka som arbetar på vårdenheten, räknar giltigheten och visar vilka som går ut inom 30 dagar.'],
    ['c', 'Det går inte att se.'],
  ], 'b', 'Intyget gäller i ett år. Systemet räknar själv vilka som har giltigt intyg.', '#/utbildning'),
];

export const ovningarFor = (yrke) => OVNINGAR.filter(x => x.roller.includes(yrke));

// Alternativen visas i en ordning som beror på övningen, så att det rätta svaret inte alltid står på samma plats.
const blanda = (ovning, alternativ) => {
  const h = (s) => {
    let v = [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    v ^= v >>> 13; v = Math.imul(v, 0x5bd1e995) >>> 0; v ^= v >>> 15;
    return v >>> 0;
  };
  return [...alternativ].sort((a, b) => h(`${ovning}:${a[0]}`) - h(`${ovning}:${b[0]}`));
};

// En övning som den visas före rättningen: utan rätt svar och förklaring.
const utan = (x, personal) => ({
  id: x.id, fraga: x.fraga, alternativ: blanda(x.id, x.alternativ).map(([id, text]) => ({ id, text })),
  // Länken till samma ställe i demon visas bara när rollen når det.
  prova: x.prova && provaNar(x.prova, personal) ? x.prova : null,
});
const provaNar = (vag, personal) => {
  if (vag.startsWith('#/patient')) return kanRoll(personal, 'las_oversikt') || kanRoll(personal, 'las_admin');
  const krav = { '#/administrering': 'las_lakemedel', '#/delegeringar': 'ge_lakemedel', '#/idag': 'boka', '#/logg': 'las_logg', '#/arkiv': 'registrera_arkivbeslut',
    '#/datauttag': 'datauttag', '#/samverkan': 'samverkan', '#/lakemedelsansvar': 'lakemedelsansvar', '#/sok': 'sok' }[vag];
  return krav ? kanRoll(personal, krav) : true;
};

const dagarMellan = (fran, till) => Math.floor((Date.parse(till) - Date.parse(fran)) / DAG);

// Statusen för ett intyg vid tiden nu: giltigt, gar_ut (inom 30 dagar), utgatt eller saknas.
export function intygStatus(intyg, nu = new Date()) {
  if (!intyg) return { status: 'saknas', text: 'Inget intyg', giltigtTill: null, utfardat: null, dagarKvar: null };
  const kvar = dagarMellan(iso(nu), intyg.giltigt_till);
  const s = Date.parse(intyg.giltigt_till) <= nu.getTime() ? 'utgatt' : kvar <= GAR_UT_DAGAR ? 'gar_ut' : 'giltigt';
  const text = { giltigt: 'Giltigt intyg', gar_ut: `Går ut om ${kvar} ${kvar === 1 ? 'dag' : 'dagar'}`, utgatt: 'Intyget har gått ut' }[s];
  return { status: s, text, giltigtTill: intyg.giltigt_till, utfardat: intyg.utfardat, dagarKvar: s === 'utgatt' ? 0 : kvar, kurs: intyg.kurs, roll: intyg.roll };
}

const senasteIntyg = (db, personalId) => db.query('SELECT * FROM utbildningsintyg WHERE personal_id = ? ORDER BY utfardat DESC, id DESC LIMIT 1').get(personalId) ?? null;

function kravUtbildning(personal) {
  if (!kanRoll(personal, 'utbildning')) throw new Fel(403, 'Din yrkesroll har inga övningar i Vårdkällan.', 'nekad');
}

// Övningarna för den inloggade, och personens intyg.
export function oversikt(db, personal, { nu = new Date() } = {}) {
  kravUtbildning(personal);
  const ovningar = ovningarFor(personal.yrke).map(x => utan(x, personal));
  return {
    kurs: KURS, giltigDagar: GILTIG_DAGAR, utbildningsmiljo: UTBILDNINGSMILJO, roll: personal.yrke, rollText: YRKEN[personal.yrke],
    ovningar, intyg: intygStatus(senasteIntyg(db, personal.id), nu), enhet: Boolean(chefFor(db, personal)),
  };
}

// Rättar svaren. Alla övningar ska vara besvarade. Är alla rätt utfärdas ett intyg som gäller i ett år.
export function ratta(db, personal, svar, { nu = new Date() } = {}) {
  kravUtbildning(personal);
  const lista = ovningarFor(personal.yrke);
  if (!svar || typeof svar !== 'object' || Array.isArray(svar)) throw new Fel(400, 'Svara på övningarna först.', 'ogiltig', { falt: ['svar'] });
  const obesvarade = lista.filter(x => !x.alternativ.some(([id]) => id === svar[x.id]));
  if (obesvarade.length) {
    throw new Fel(400, obesvarade.length === 1 ? 'En övning är inte besvarad.' : `${obesvarade.length} övningar är inte besvarade.`, 'ogiltig', { falt: obesvarade.map(x => x.id) });
  }
  const resultat = lista.map(x => ({ id: x.id, ratt: svar[x.id] === x.ratt, rattSvar: x.alternativ.find(([id]) => id === x.ratt)[1], forklaring: x.forklaring }));
  const antalRatt = resultat.filter(r => r.ratt).length;
  const godkand = antalRatt === lista.length;
  if (godkand) {
    const till = new Date(nu.getTime() + GILTIG_DAGAR * DAG);
    db.query('INSERT INTO utbildningsintyg (personal_id, vardenhet, roll, kurs, utfardat, giltigt_till, antal_ovningar) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(personal.id, vardenhetFor(db, personal.enhet_id), personal.yrke, KURS, iso(nu), iso(till), lista.length);
  }
  return {
    godkand, antalRatt, antal: lista.length, resultat,
    text: godkand ? `Alla ${lista.length} rätt. Intyget gäller i ett år.` : `${antalRatt} av ${lista.length} rätt. Läs förklaringarna och gör övningarna igen. Alla ska vara rätt för ett intyg.`,
    intyg: intygStatus(senasteIntyg(db, personal.id), nu),
  };
}

const ORDNING = { utgatt: 0, saknas: 1, gar_ut: 2, giltigt: 3 };

// Verksamhetschefens vy: alla som arbetar på vårdenheten och deras intyg. Bara vårdenhetens verksamhetschef.
export function enhet(db, personal, { nu = new Date() } = {}) {
  const ve = chefFor(db, personal);
  if (!ve || !kanRoll(personal, 'intyg_enhet')) throw new Fel(403, 'Bara vårdenhetens verksamhetschef ser intygen för vårdenheten.', 'nekad');
  const personer = db.query('SELECT * FROM personal WHERE aktiv = 1 ORDER BY namn').all()
    .filter(p => vardenhetFor(db, p.enhet_id) === ve && ROLLER_MED_OVNINGAR.includes(p.yrke))
    .map(p => ({ id: p.id, namn: p.namn, titel: p.titel, yrke: p.yrke, ...intygStatus(senasteIntyg(db, p.id), nu) }))
    .sort((a, b) => ORDNING[a.status] - ORDNING[b.status] || a.namn.localeCompare(b.namn, 'sv'));
  const summa = { giltigt: 0, gar_ut: 0, utgatt: 0, saknas: 0 };
  for (const p of personer) summa[p.status]++;
  const namn = db.query('SELECT namn FROM enheter WHERE id = ?').get(ve)?.namn ?? ve;
  return { vardenhet: { id: ve, namn }, personer, summa, garUtDagar: GAR_UT_DAGAR };
}

export const ROLLER_MED_OVNINGAR = ALLA.filter(y => ovningarFor(y).length);
