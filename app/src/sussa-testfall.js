// Sussas användbarhetstester som automatiska tester av Vårdkällan (runda 7, r1). Underlaget är förfrågningsunderlaget
// för Cosmic: Bilaga F1:4 Testfall (34 testfall i 7 teman för 7 användargrupper), Bilaga F1:2 Modell för att testa och
// utvärdera användbarhet (fyra mätningar), Bilaga F1:3 Information till anbudsgivare (testdata) och Bilaga F1
// Utvärderingsmodell. Registret har en post per testfall med Sussas nummer, tema, roller, mål, slutvillkor och tidsklass.
// test/sussa-testfall.cjs spelar de testfall som Vårdkällan klarar i gränssnittet med rätt roll, kontrollerar
// slutvillkoret och räknar klick, fältbyten och tangenter som klickbudgeten (klickbudget.js). Resultatet skrivs till
// sussa-testfall.json och visas på kravsidan under K4.
//
// Sussa lämnade aldrig ut vilken tidsklass varje testfall hade (svar på fråga 136, 2017-10-13: "Information delges inte då
// utvärderingsmetodiken undermineras om informationen är känd i förväg"). Tidsklassen här är Vårdkällans egen bedömning
// av hur stort testfallet är och står med motivering i varje post.
//
// Testpatienternas namn kommer från Sussas testdata, där de är påhittade. Personnumren är Skatteverkets
// testpersonnummer (seed/sussa-testdata.js). Personalen i Sussas testdata nämns här bara med sin roll.

import { utvarderingspoang } from '../public/js/sussa-formular.js';

export const KALLA = 'Region Örebro län, upphandlingen Framtidens vårdinformationsstöd (Sussa samverkan, dnr 16RS2022): Bilaga F1:4 Testfall, Bilaga F1:2 Modell för att testa och utvärdera användbarhet, Bilaga F1:3 Information till anbudsgivare och Bilaga F1 Utvärderingsmodell, versionerna 2018-03-07.';

export const TEMAN = {
  1: 'Läkemedelshantering', 2: 'Vårdbegäran', 3: 'Beställning och svar', 4: 'Strukturerad information', 5: 'Administration', 6: 'Övergångar', 7: 'Gemensamma vyer',
};

// Sussas sju användargrupper och den demoroll i Vårdkällan som spelar gruppen. Sjuksköterska i öppenvården har ingen egen
// demoroll: sjuksköterskan på vårdcentralen finns i seeden men går inte att logga in som.
export const ROLLER = {
  lakare_oppenvard: { namn: 'Läkare öppenvård', demoroll: 'lak-vc' },
  lakare_slutenvard: { namn: 'Läkare slutenvård', demoroll: 'lak-kard' },
  ssk_slutenvard: { namn: 'Sjuksköterska slutenvård', demoroll: 'ssk-kard' },
  ssk_oppenvard: { namn: 'Sjuksköterska öppenvård', demoroll: null },
  underskoterska: { namn: 'Undersköterska', demoroll: 'usk-kard' },
  paramedicinare: { namn: 'Paramedicinare', demoroll: 'fys-kard' },
  medicinsk_sekreterare: { namn: 'Medicinsk sekreterare', demoroll: 'adm-kard' },
};

// Sussas verksamheter och var de finns i Vårdkällan. Vårdkällans demo har Region Örebro läns verksamheter, så Sussas
// påhittade enheter motsvaras av den enhet där demorollen arbetar.
export const ENHETER = [
  { sussa: 'Vårdcentral Backen, Mottagning 1', vardkallan: 'Vårdcentralen Tybble för läkaren i öppenvården, Kardiologiska mottagningen för vårdadministratören, som bara arbetar där' },
  { sussa: 'Vårdcentral Backen, Jourmottagning 1', vardkallan: 'Kardiologiska mottagningen (besök nu, oplanerat)' },
  { sussa: 'Medicinkliniken, Mottagning 1', vardkallan: 'Kardiologiska kliniken USÖ, som tar emot remisser' },
  { sussa: 'Medicinkliniken, Avdelning A', vardkallan: 'Avdelning 72, kardiologi' },
  { sussa: 'Infektionskliniken, Avdelning A', vardkallan: 'Avdelning 72, kardiologi, där demorollerna i slutenvården arbetar' },
  { sussa: 'Kirurgkliniken, Avdelning A', vardkallan: 'Ortopediska kliniken USÖ, en annan vårdenhet med en annan medicinsk specialitet' },
  { sussa: 'Hudkliniken, Mottagning 1', vardkallan: 'Medicinska kliniken USÖ, eftersom demon inte har någon hudklinik' },
];

// Tidsklasserna i Bilaga F1:2 avsnitt 4.2: maximal tid i minuter och gränserna för 10, 5 och 2 poäng i sekunder. Den som
// når den maximala tiden får 0 poäng och testfallet avbryts.
export const TIDSKLASSER = {
  6: { max: 360, granser: [120, 240, 360] },
  9: { max: 540, granser: [180, 360, 540] },
  15: { max: 900, granser: [300, 600, 900] },
  18: { max: 1080, granser: [360, 720, 1080] },
};

// Mätning 2, effektivitet: poäng ur tiden i sekunder och tidsklassen i minuter.
export function tidspoang(sek, tidsklass) {
  const k = TIDSKLASSER[tidsklass];
  if (!k || typeof sek !== 'number' || !Number.isFinite(sek) || sek < 0) return 0;
  if (sek < k.granser[0]) return 10;
  if (sek < k.granser[1]) return 5;
  if (sek < k.granser[2]) return 2;
  return 0;
}

// Mätning 1, ändamålsenlighet och måluppfyllelse (F1:2 avsnitt 4.1): 10 lyckades utan svårigheter, 5 med vissa
// svårigheter, 2 med svårigheter och 0 lyckades inte. Ett skript har inga svårigheter att observera, så Vårdkällan
// räknar klickbudgeten som mått: inom budget ger 10, upp till en och en halv gång budgeten 5, mer 2. Ett testfall som
// inte når slutvillkoret, eller som Vårdkällan inte kan genomföra, ger 0.
export function malpoang({ uppnatt, steg, budget, brister = [] }) {
  if (!uppnatt) return 0;
  if (typeof budget !== 'number' || typeof steg !== 'number') return 0;
  if (steg <= budget) return brister.length ? 5 : 10;
  if (steg <= budget * 1.5) return 5;
  return 2;
}

// Omvandlingen till slutliga utvärderingspoäng (F1:2 avsnitt 5), expertgranskningen och SUS finns i
// public/js/sussa-formular.js, som gränssnittet och servern delar.
export { OMVANDLING, utvarderingspoang, DIALOGPRINCIPER, PRINCIPPOANG, PRINCIPSKALA, expertpoang, SUS_SUSSA, SUS_SUSSA_KALLA, susPoang } from '../public/js/sussa-formular.js';

// Uppskattad tid för en människa med keystroke-level model (KLM): Card, Moran och Newell, The keystroke-level model for
// user performance time with interactive systems, Communications of the ACM 23(7), 1980, s. 396 till 410. Operatorerna
// och tiderna i sekunder är artikelns: K tangenttryck för en van användare som skriver omkring 40 ord i minuten, P peka
// med musen, B trycka ned eller släppa musknappen, H flytta handen mellan mus och tangentbord och M mental förberedelse.
// Systemets svarstid (R) tas från skriptets uppmätta tid i webbläsaren, där skriptet själv inte väntar på något annat än
// gränssnittet. Läs- och letartid utöver M ingår inte, så en verklig användare är långsammare än uppskattningen.
export const KLM = {
  kalla: 'Card, Moran och Newell 1980, Communications of the ACM 23(7), s. 396 till 410',
  K: 0.28, P: 1.1, B: 0.1, H: 0.4, M: 1.35,
};
// Ett klick: M + P + B + B. Ett fältbyte: M + P + B + B och handen till tangentbordet och tillbaka (2 H). Varje tecken
// som skrivs: K. En specialtangent som Enter: K, eftersom handen redan är på tangentbordet. En rullgardinslista: M och
// två pekningar med klick.
export const KLM_STEG = {
  klick: KLM.M + KLM.P + 2 * KLM.B,
  faltbyte: KLM.M + KLM.P + 2 * KLM.B + 2 * KLM.H,
  tecken: KLM.K,
  tangent: KLM.K,
  listval: KLM.M + 2 * (KLM.P + 2 * KLM.B),
};
const runda = (x, dec = 1) => Math.round(x * 10 ** dec) / 10 ** dec;
// matt har räkningen från skriptet: klick (utan listornas klick), listval, faltbyten, tecken, tangenter och
// svarstidMs (systemets svarstid, uppmätt).
export function klmTid({ klick = 0, listval = 0, faltbyten = 0, tecken = 0, tangenter = 0, svarstidMs = 0 }) {
  const delar = {
    klick: klick * KLM_STEG.klick, listval: listval * KLM_STEG.listval, faltbyten: faltbyten * KLM_STEG.faltbyte,
    tecken: tecken * KLM_STEG.tecken, tangenter: tangenter * KLM_STEG.tangent, svarstid: Math.max(0, svarstidMs) / 1000,
  };
  const summa = Object.values(delar).reduce((a, b) => a + b, 0);
  return { sekunder: runda(summa), delar: Object.fromEntries(Object.entries(delar).map(([k, v]) => [k, runda(v)])) };
}

// En post i registret.
//   nr, tema, titel  Sussas numrering och rubrik i F1:4.
//   roller           Sussas användargrupper för testfallet (nycklar i ROLLER).
//   syfte, mal       Sussas syfte och mål, med personalens namn ersatta av roller.
//   slut             när testfallet är slut enligt informationen till observatören.
//   tidsklass        maximal tid i minuter (6, 9, 15 eller 18), Vårdkällans bedömning, med motivering i tidsklassSkal.
//   korningar        en körning per roll som spelar testfallet: roll, demoroll och klickbudget med motivering. Tom när
//                    Vårdkällan inte kan genomföra testfallet.
//   saknas           vad Vårdkällan saknar för att genomföra testfallet.
//   avvikelser       hur Vårdkällan avviker från Sussas text när testfallet genomförs.
const t = (nr, titel, roller, rest) => ({ nr, tema: Number(nr.split('.')[0]), temaNamn: TEMAN[Number(nr.split('.')[0])], titel, roller, avvikelser: [], korningar: [], saknas: null, ...rest });
// brister är det som testfallet når men inte på det sätt som principen om att systemet är experten kräver. Ett testfall
// med brister får högst 5 poäng i måluppfyllelse (lyckades men med vissa svårigheter).
const kor = (roll, budget, motivering, brister = []) => ({ roll, demoroll: ROLLER[roll].demoroll, budget, motivering, brister });

export const TESTFALL = [
  // Tema 1: Läkemedelshantering
  t('1.1', 'Förskriva läkemedel', ['lakare_oppenvard'], {
    syfte: 'Ur en läkemedelskatalog med minst 100 läkemedel förskriva läkemedel till Gerda Ström.',
    mal: ['Förskriv Alvedon 1 g tablett vid behov mot värk, tillsvidare.', 'Förskriv Kloramfenikol ögondroppar 5 mg/ml, 1 droppe 6 gånger dagligen i en vecka i höger öga, tidsbegränsat.', 'Förskriv Sertralin 50 mg, en halv tablett i 6 dagar och därefter en tablett varje morgon, med uppföljning om två veckor och provförpackning.', 'Ändra dosen av Metformin till 850 mg morgon och kväll och byt ut receptet mot ett nytt.', 'Skicka förskrivningen.'],
    slut: 'Tre läkemedel är förskrivna och dosen är ändrad.',
    tidsklass: 18, tidsklassSkal: 'Fyra läkemedel med var sin dosering, en upptrappning och en dosändring. Det största testfallet i temat.',
    // Runda 8, r4: doseringen ur produkten, administrationssättet ur beredningsformen och dosändring i den pågående
    // ordinationen. Budgeten var 29 med två brister.
    korningar: [kor('lakare_oppenvard', 22, 'Ett klick på patienten. Alvedon forte: Ordinera, träffen, där doseringen och dosen för 1 g kommer ur produkten och ordinationsorsaken får fokus, och spara (3). Kloramfenikol: Ordinera, träffen, där doseringen får fokus och administrationssättet I ögat kommer ur beredningsformen, två klick för typen Tillfällig, ett fältbyte vardera för orsak och slutdatum, och spara (7). Sertralin: Ordinera, träffen, Upptrappning enligt schema, två steg för att ändra antalet dagar till 6, orsaken, uppföljning om två veckor och spara (8). Metformin: Ändra dos, styrkan 850 mg, där systemet fyller i doseringen och dosen, och Ändra dosen (3). Provförpackningen med 10 tabletter är förvald.')],
    avvikelser: ['Dosen av Metformin ändras i den pågående ordinationen, som byter till styrkan 850 mg (Metformin Teva). Ändringen skickas till NLL som en ny förskrivning som ersätter den förra, och NLL är simulerad.', 'Kloramfenikol är Kloramfenikol Santen och Metformin 850 mg är Metformin Teva. Recept och uttag på apotek finns inte i demon.'],
  }),
  t('1.2', 'Ordinera läkemedel', ['lakare_slutenvard'], {
    syfte: 'Ur en läkemedelskatalog med minst 100 läkemedel ordinera läkemedel till Elin Arnström.',
    mal: ['Paracetamol Panpharma 10 mg/ml infusion 100 ml som engångsordination, ges som intravenös infusion under 15 minuter.', 'Glukos 25 mg/ml buffrad 1000 ml med Addex Magnesium 20 mmol, ges på två timmar.', 'Stesolid 10 mg som premedicinering en timme före röntgen.'],
    slut: 'Läkemedlen är ordinerade.',
    tidsklass: 18, tidsklassSkal: 'En infusion, en blandning med tillsats och en ordination som hänger på en undersökning.',
    // Runda 8, r4: doseringen för infusion ur produkten och Addex-Magnesium som tillsats i glukosen. Budgeten var 28 med två
    // brister.
    korningar: [kor('lakare_slutenvard', 16, 'Ett klick på patienten. Paracetamol: Ordinera, träffen, där doseringen, dosen och typen för infusion kommer ur produkten och orsaken får fokus, och spara (3). Glukos med Addex-Magnesium: Ordinera, träffen, där orsaken får fokus, ett fältbyte för tillsatsen, två steg för att ändra infusionstiden till 120 minuter och spara (6). Systemet skriver doseringen ur infusionen och tillsatsen. Stesolid: Ordinera, träffen, orsaken, Ges inför en planerad vårdhändelse, Ny vårdhändelse, där texten får fokus, och spara (6). En timme före är förvalt.')],
    avvikelser: ['Paracetamol Panpharma finns inte i NPL, så infusionen är Paracetamol Fresenius Kabi 10 mg/ml. Den buffrade glukosen är Glucos Baxter 25 mg/ml buffrad.', 'Engångsordinationen är en tillfällig ordination som slutar samma dag.', 'Röntgen är en ny vårdhändelse som väntar på tid i tidboken.'],
  }),
  t('1.3', 'Ordinera läkemedel på uppdrag', ['ssk_slutenvard'], {
    syfte: 'Ordinera två läkemedel till Trevis Ljung på uppdrag av en namngiven läkare.',
    mal: ['Alvedon 1 g tablett mot smärta som engångsordination.', 'Morfin injektionsvätska 10 mg/ml, 1 ml intramuskulärt mot smärta, engångsordination.'],
    slut: 'De två läkemedlen är ordinerade.',
    tidsklass: 9, tidsklassSkal: 'Två ordinationer med en uppdragsgivare.',
    // Runda 8, r4: dosen för 1 g ur produkten, Engångsdos, och läkaren och skälet från den förra muntliga ordinationen.
    // Budgeten var 31 med två brister.
    korningar: [kor('ssk_slutenvard', 18, 'Ett klick på patienten och ett på fliken Läkemedel. Alvedon forte: Muntlig ordination, två klick för läkaren, ett fältbyte för varför behandlingen inte kan vänta, sökningen och träffen, där dosen för 1 g kommer ur produkten och orsaken får fokus, Engångsdos och spara (8). Morfin: Muntlig ordination, där läkaren och skälet är ifyllda från den förra, träffen, där orsaken får fokus, två steg för dosen, två för intramuskulärt, Engångsdos och spara (8).')],
    avvikelser: ['Uppdragsgivaren är läkaren Sara Lindqvist, som signerar den muntliga ordinationen i sin inkorg.', 'Engångsordinationen är en tillfällig ordination som slutar samma dag och ges utan fast tid.'],
  }),
  t('1.4', 'Administrera läkemedel', ['ssk_slutenvard'], {
    syfte: 'Utifrån ordinationslistan administrera fyra läkemedel till Bertil Danielsson.',
    mal: ['Ge Paracetamol Panpharma och läs upp instruktionen.', 'Iordningställ och ge Glukos med Addex-Magnesium och läs upp instruktionen.', 'Ge sömnmedicinen.', 'Ge premedicineringen inför röntgen.', 'Dokumentera att patienten kräktes upp premedicineringen.'],
    slut: 'Instruktionerna är upplästa, alla fyra läkemedel är administrerade och det är dokumenterat att patienten kräktes upp premedicineringen.',
    tidsklass: 15, tidsklassSkal: 'Fyra administreringar, ett iordningställande och en avvikelse som ska dokumenteras.',
    korningar: [kor('ssk_slutenvard', 12, 'Ett klick på Läkemedel att ge, ett på Ge för paracetamol, Mer och Iordningsställ för glukoslösningen med Addex-Magnesium och sedan Ge, Ge för Stesolid och Ge för Zopiklon vid behov (7). Instruktionerna står i doseringen i listan, och för infusionen med tillsatsen räknar systemet koncentrationen och hastigheten. Kräkningen dokumenteras med ett klick på patienten, fliken Översikt, Ny anteckning, där omvårdnadsanteckningen är förvald, ett fältbyte för sökordet Elimination och Signera (5).')],
    avvikelser: ['Ordinationerna gjordes i går och dosen ska ges i dag vid den hela timmen före testet. Glukosen med Addex-Magnesium är en ordination med tillsats. Att patienten kräktes upp premedicineringen registreras inte på dosen utan i en omvårdnadsanteckning.',
      // Runda 10, r5: kollegakontrollen av högriskläkemedel (beslut 2026-11-08).
      'Addex-Magnesium är en koncentrerad elektrolyt, så en kollega kontrollerar beredningen i sin egen inloggning innan glukosen ges. I körningen gör läkaren Sara Lindqvist kontrollen, och hennes steg räknas inte i sjuksköterskans klick.'],
  }),

  // Tema 2: Vårdbegäran
  t('2.1', 'Upprätta och skicka vårdbegäran', ['lakare_oppenvard', 'lakare_slutenvard', 'paramedicinare'], {
    syfte: 'Upprätta och skicka en vårdbegäran för Mira Axelsson.',
    mal: ['Mottagare Hudkliniken.', 'Frågeställning: Hudförändring, malignt?', 'Anamnes: Pat har en hudförändring på låret som har förändrats snabbt. Är det malignt?', 'Skicka vårdbegäran.'],
    slut: 'Vårdbegäran är skickad.',
    tidsklass: 9, tidsklassSkal: 'En mottagare och två textfält.',
    korningar: [kor('lakare_oppenvard', 7, 'Ett klick på patienten i arbetslistan och ett på Skicka remiss, två klick för att välja mottagare i listan, ett fältbyte vardera för frågeställning och anamnes och ett klick för att skicka. Prioritet och sista svarsdatum har förval, som i flödet Skicka remiss i klickbudgeten.'),
      kor('lakare_slutenvard', 7, 'Samma steg som för läkaren i öppenvården, från arbetslistan på kardiologen.'),
      kor('paramedicinare', 7, 'Samma steg som för läkaren i öppenvården: fysioterapeuten skickar remissen från arbetslistan på kardiologiska mottagningen.')],
    avvikelser: ['Mottagaren är Medicinska kliniken USÖ, eftersom demon inte har någon hudklinik.'],
  }),
  // Runda 8, r2: testfall 2.2 till 2.5 är genomförbara med remiss på uppdrag, fördelning, remisskonferens och pappersremiss.
  t('2.2', 'Upprätta och skicka vårdbegäran på uppdrag', ['medicinsk_sekreterare'], {
    syfte: 'Upprätta och skicka en vårdbegäran för Mira Axelsson på uppdrag av en namngiven läkare.',
    mal: ['Ange uppdragsgivaren, en läkare på Medicinkliniken, som remittent.', 'Mottagare Ortopedkliniken.', 'Frågeställning och anamnes som i testfall 2.1.', 'Skicka vårdbegäran.'],
    slut: 'Vårdbegäran är skickad.',
    tidsklass: 9, tidsklassSkal: 'Som testfall 2.1 med en uppdragsgivare.',
    korningar: [kor('medicinsk_sekreterare', 9, 'Ett klick på Sök patient, där sökfältet har fokus, Enter och ett klick på träffen. Ett klick på Remiss på uppdrag, där mottagaren har fokus, två klick för att välja mottagare i listan, ett fältbyte vardera för frågeställning och anamnes och ett klick för att skicka till läkaren. Uppdragsgivaren är förvald, eftersom läkaren registrerade patientens besök, och prioritet och sista svarsdatum har förval.')],
    avvikelser: ['Uppdragsgivaren är läkaren Sara Lindqvist på Kardiologiska kliniken USÖ, som motsvarar Medicinkliniken. Mottagaren är Ortopediska kliniken USÖ.', 'Remissen skickas när läkaren har signerat den i sin inkorg, med läkaren som remittent. Testfallet slutar när remissen väntar på signering.'],
  }),
  t('2.3', 'Ta emot vårdbegäran', ['lakare_slutenvard', 'lakare_oppenvard', 'paramedicinare'], {
    syfte: 'Fördela och prioritera eller avvisa vårdbegäran ur en lista med tio remisser.',
    mal: ['Fördela Berit Strandhall till bakjouren, en namngiven läkare.', 'Sätt Gerda Ström på väntelistan för besök om två månader.', 'Avvisa Elin Arnströms remiss på grund av fel vårdnivå med en svarstext.', 'Skicka Trevis Ljungs remiss vidare till psykiatriska kliniken.'],
    slut: 'De fyra remisserna är fördelade, prioriterade, avvisade eller vidareskickade.',
    tidsklass: 15, tidsklassSkal: 'Fyra remisser med fyra olika beslut.',
    korningar: [kor('lakare_slutenvard', 15, 'Ett klick på Remisser i menyn. Berit Strandhall: Fördela och ett klick på bakjouren, som systemet föreslår först (2). Gerda Ström: Bedöm, ett klick på Inom två månader och spara (3). Elin Arnström: Bedöm, Avvisa, ett fältbyte för svarstexten och spara (4). Trevis Ljung: Skicka vidare, två klick för psykiatriska kliniken i listan, ett fältbyte för motiveringen och ett klick för att skicka (5).'),
      kor('paramedicinare', 15, 'Samma steg som för läkaren: fysioterapeuten på kardiologiska mottagningen tar emot remisserna till kardiologen.')],
    avvikelser: ['Remisserna kommer från Vårdcentralen Tybble till Kardiologiska kliniken USÖ, som motsvarar Medicinkliniken, Mottagning 1. Läkaren i öppenvården arbetar på vårdcentralen och spelar därför inte testfallet.', 'Bakjouren är överläkaren Göran Malm (demoregel), som systemet föreslår först.', 'Väntelistan för besök om två månader är tidsramen Inom två månader när remissen accepteras. Psykiatriska kliniken är Allmänpsykiatriska kliniken USÖ, och vidarebefordran har en motivering som avsändaren ser.'],
  }),
  t('2.4', 'Ta emot vårdbegäran på uppdrag', ['medicinsk_sekreterare'], {
    syfte: 'Fördela vårdbegäran ur en lista med tio remisser på uppdrag.',
    mal: ['Fördela Bertil Danielsson till bakjouren, en namngiven läkare.', 'Sätt Sara Sandmark, Anna Karlsson och Sven Markström på remisskonferens.'],
    slut: 'En remiss är fördelad till bakjouren och de övriga står på remisskonferens.',
    tidsklass: 15, tidsklassSkal: 'Fyra remisser, varav tre till samma konferens.',
    korningar: [kor('medicinsk_sekreterare', 6, 'Ett klick på Remisser i menyn. Bertil Danielsson: Fördela och ett klick på bakjouren, som systemet föreslår först (2). Sara Sandmark, Anna Karlsson och Sven Markström: ett klick vardera på Till remisskonferens (3). Systemet väljer nästa konferens och kvitterar mottagningen.')],
    avvikelser: ['Remisskonferensen är vårdenhetens nästa, tisdag eller torsdag klockan 8 (demoregel). Bakjouren är överläkaren Göran Malm (demoregel).', 'På konferensen bedömer läkarna remisserna i följd med ett klick per beslut, och vårdadministratören kan registrera besluten på uppdrag med läkaren som ansvarig. Det ingår inte i testfallet.'],
  }),
  t('2.5', 'Registrera en extern vårdbegäran', ['medicinsk_sekreterare'], {
    syfte: 'Registrera en vårdbegäran som har kommit på papper från en extern enhet, så att den kan handläggas.',
    mal: ['Patient Trevis Ljung, remissdatum, avsändande enhet, frågeställning och anamnes.', 'Spara.'],
    slut: 'Remissen är inregistrerad.',
    tidsklass: 9, tidsklassSkal: 'Fem uppgifter som skrivs av från papper.',
    korningar: [kor('medicinsk_sekreterare', 7, 'Ett klick på Remisser i menyn och ett på Registrera vid den inskannade remissen, där patientfältet har fokus och systemet väljer patienten när namnet ger en träff. Ett fältbyte vardera för avsändande enhet (ur den simulerade HSA-katalogen), remissdatum, frågeställning och anamnes, och ett klick för att registrera. Remissdatumet är förvalt till i dag och skrivs om.')],
    avvikelser: ['Pappersremissen är redan inskannad och blir bilaga till remissen. Den går in bland de inkommande remisserna och ger vårdrelation först när någon annan än den som registrerade den har tagit emot den (beslut 2026-11-08).', 'Behandlingshemmet Löparen finns i den simulerade HSA-katalogen.'],
  }),
  t('2.6', 'Besvara en vårdbegäran', ['lakare_slutenvard', 'lakare_oppenvard', 'paramedicinare'], {
    syfte: 'Besvara vårdbegäran efter bedömning av patienten.',
    mal: ['Du har just träffat Sara Sandmark på mottagningen.', 'Besvara vårdbegäran från vårdcentralen med texten: Tack för remissen. Vi har träffat Sara och gett henne rätt behandling.', 'Skicka svaret.'],
    slut: 'Remissvaret är skickat.',
    tidsklass: 6, tidsklassSkal: 'En remiss och ett textfält.',
    korningar: [kor('lakare_slutenvard', 4, 'Ett klick på patienten i arbetslistan, ett på fliken Remisser och ett på Svara för remissen, där svarsfältet redan har fokus, och ett klick för att skicka svaret. Remissen är redan accepterad, så inget annat behöver väljas.'),
      kor('paramedicinare', 4, 'Samma steg som för läkaren: fysioterapeuten på kardiologiska mottagningen besvarar remissen till kardiologen.')],
    avvikelser: ['Remissen kommer från Vårdcentralen Tybble till Kardiologiska kliniken USÖ, som motsvarar Medicinkliniken.'],
  }),

  // Tema 3: Beställning och svar
  // Runda 8, r1: testfall 3.1 till 3.3, beställning och svar (labb.js).
  t('3.1', 'Upprätta en labbeställning', ['lakare_slutenvard', 'lakare_oppenvard'], {
    syfte: 'Upprätta labbeställningar för Hamid Burvall.',
    mal: ['P-CRP, B-Blodstatus och P-Kreatinin till kemlab i dag klockan 9.', 'Blododling till baktlab med anamnes.', 'Spara eller skicka.'],
    slut: 'Beställningen är sparad, skickad eller verkställd.',
    tidsklass: 9, tidsklassSkal: 'Fyra analyser till två laboratorier.',
    korningar: [kor('lakare_slutenvard', 3, 'Ett klick på patienten i arbetslistan, ett på Beställ prover i översikten och ett på Beställ vid paketet Feber och frossa, som systemet föreslår ur vårdkontaktens orsak. Paketet har de fyra analyserna, systemet väljer klinisk kemi och klinisk mikrobiologi, rören och provtagningsordningen och fyller i anamnesen ur vårdkontakten.'),
      kor('lakare_oppenvard', 3, 'Samma steg som för läkaren i slutenvården, från arbetslistan på vårdcentralen. Klinisk kemi är laboratoriet som hör till vårdcentralen.')],
    avvikelser: ['Provtagningen är förvald till nu, inte till klockan 9, eftersom testet görs när patienten är på plats. Klockan 7 i morgon kan väljas.', 'Laboratorierna heter Klinisk kemi USÖ och Klinisk mikrobiologi och är simulerade.', 'Anamnesen skrivs inte: systemet hämtar den ur vårdkontakten, Inkommen med feber och frossa.'],
  }),
  t('3.2', 'Upprätta en labbeställning på uppdrag', ['ssk_oppenvard', 'ssk_slutenvard', 'underskoterska'], {
    syfte: 'Upprätta labbeställningar för Laura August på uppdrag av en namngiven läkare.',
    mal: ['Samma analyser som i testfall 3.1.', 'Spara eller skicka.'],
    slut: 'Beställningen är sparad, skickad eller verkställd.',
    tidsklass: 9, tidsklassSkal: 'Som testfall 3.1 med en uppdragsgivare.',
    korningar: [kor('ssk_slutenvard', 5, 'Ett klick på patienten i arbetslistan och ett på Beställ prover i översikten, två klick för att välja den läkare som gav uppdraget och ett klick på Beställ vid paketet Feber och frossa. Läkaren signerar beställningen i inkorgen.'),
      kor('underskoterska', 5, 'Samma steg som för sjuksköterskan. Undersköterskan beställer på uppdrag men inte själv.')],
    avvikelser: ['Läkaren i Sussas testdata spelas av läkaren på kardiologen. Sjuksköterska i öppenvården har ingen egen demoroll.', 'Beställningen kan tas och skickas direkt, och läkaren signerar den i inkorgen.'],
  }),
  t('3.3', 'Registrera provtagning', ['ssk_oppenvard', 'ssk_slutenvard', 'underskoterska'], {
    syfte: 'Registrera provtagning utifrån en befintlig beställning för Trevis Ljung och skicka den.',
    mal: ['Hitta beställningen med blodstatus, B12, folat och urinodling.', 'Markera vilka prover som är tagna och skicka.'],
    slut: 'Beställningen är skickad.',
    tidsklass: 6, tidsklassSkal: 'En befintlig beställning med fyra prover att bocka av.',
    korningar: [kor('ssk_slutenvard', 4, 'Ett klick på Prover och kontroller i menyn, där beställningen står under patienten med rören i provtagningsordning, och ett klick på Tagen för vart och ett av de tre rören: serumröret för B12 och folat, EDTA-röret för blodstatus och urinröret. Systemet sätter tid och provtagare och skickar proverna när alla rör är tagna.'),
      kor('underskoterska', 4, 'Samma steg som för sjuksköterskan.')],
    avvikelser: ['Beställningen gjordes dagen före testet i stället för 2017-11-26, så att den syns i demon. Proverna skickas av systemet när det sista röret är taget, och det finns ingen knapp att skicka med.'],
  }),
  t('3.4', 'Överblicka provsvar', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_slutenvard', 'ssk_oppenvard', 'underskoterska'], {
    syfte: 'Överblicka provsvaren för Bertil Danielsson och hitta ett visst provsvar.',
    mal: ['Leta rätt på provsvaret PK som en läkare på vårdcentralen beställde, taget en viss dag klockan 11.36.', 'Läs upp provsvaret.'],
    slut: 'Resultatet är uppläst. Rätt svar är PK 0,9 INR.',
    tidsklass: 6, tidsklassSkal: 'Ett värde att hitta bland fem provtagningar.',
    korningar: [kor('lakare_slutenvard', 5, 'Ett klick på patienten i arbetslistan och ett på fliken Mätvärden. Provet togs på vårdcentralen, så inre sekretess kräver ett aktivt val: ett klick på Visa uppgifter från andra vårdenheter, ett på det syfte som systemet föreslår och ett för att visa. Tabellen visar tid, värde och vårdenhet för varje provsvar, så svaret syns utan fler klick.'),
      kor('ssk_slutenvard', 5, 'Samma steg som för läkaren, med samma aktiva val för provsvaren från vårdcentralen.'),
      kor('underskoterska', 5, 'Samma steg som för läkaren. Undersköterskan läser mätvärden och provsvar men inte läkaranteckningar.')],
    avvikelser: ['Provsvaren är tagna fem dagar till en vecka före testet i stället för i oktober 2017, så att de syns i demon. Svaren från vårdcentralen visar beställande läkare (runda 8), läkaren på vårdcentralen, och svaren från ortopeden visar vårdenheten och tiden.'],
  }),
  // Runda 8, r1: testfall 3.5, kontroller till avdelningen (kontroller.js).
  t('3.5', 'Upprätta en beställning eller ordination på intern analys eller mätvärde', ['lakare_oppenvard', 'lakare_slutenvard'], {
    syfte: 'Ordinera kontroller av mätvärden för Inga Strand.',
    mal: ['Puls, blodtryck, sänkningsreaktion, temperatur och vikt i morgon klockan 7.', 'Följ vätskebalansen det kommande dygnet.', 'Spara, signera eller verkställ.'],
    slut: 'Beställningen är sparad, signerad eller verkställd.',
    tidsklass: 9, tidsklassSkal: 'Sex kontroller vid samma tid.',
    korningar: [kor('lakare_slutenvard', 9, 'Ett klick på patienten i arbetslistan och ett på Kontroller i översikten, ett klick på var och en av de sex kontrollerna och ett på Ordinera. Klockan 7 i morgon är förvald, och vätskebalansen följs ett dygn. Systemet lägger kontrollerna på avdelningen där patienten ligger, och sjuksköterskan ser dem som uppgifter med tid.'),
      kor('lakare_oppenvard', 9, 'Samma steg som för läkaren i slutenvården. Kontrollerna görs på vårdcentralen, där patienten har sitt besök.')],
    avvikelser: ['SR är en intern analys som tas på avdelningen och registreras som mätvärde, och vätskebalansen följs i läkemedelsprocessens vätskebalans.'],
  }),

  // Tema 4: Strukturerad information
  // Runda 8, r5: testfall 4.1 med mallen för tobaksvanor (tobak-regler.js och tobak.js).
  t('4.1', 'Skapa anteckning', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_oppenvard', 'ssk_slutenvard', 'underskoterska', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Mata in strukturerad information om rökning i Berit Strandhalls journal.',
    mal: ['Rökare ja, 25 cigaretter per dag, rökavvänjning erbjuden och accepterad, och en kommentar.'],
    slut: 'Informationen är inmatad på ett strukturerat sätt i journalen.',
    tidsklass: 6, tidsklassSkal: 'Fem frågor med fasta svar och en kommentar.',
    korningar: [kor('lakare_oppenvard', 6, 'Ett klick på patienten i arbetslistan och ett på Dokumentera tobaksvanor i översikten. Ett klick på Dagligen för cigaretter sätter svaret Ja själv och flyttar fokus till antalet, och systemet föreslår kvalificerat rådgivande samtal med KVÅ-kod. Ett klick på Erbjudet och accepterat, ett fältbyte för kommentaren och ett klick för att signera.'),
      kor('ssk_slutenvard', 6, 'Samma steg som för läkaren, från arbetslistan på Kardiologiska kliniken. Tobaksvanorna skrivs och läses med samma behörighet som omvårdnadsanteckningar.'),
      kor('paramedicinare', 6, 'Samma steg som för läkaren. Fysioterapeuten skriver omvårdnadsanteckningar och därmed tobaksvanor.')],
    avvikelser: ['Tiden för besöket är nu, eftersom Sussas datum ligger före testet. Besöket är på Vårdcentralen Tybble för läkaren och på Kardiologiska mottagningen för sjuksköterskan och fysioterapeuten.',
      'Undersköterskan och vårdadministratören skriver inte anteckningar i Vårdkällan och kan därför inte spela testfallet. Undersköterskan ser tobaksvanorna i översikten.',
      'Sussas fråga om rökare ja eller nej följer den nationella vägledningen: om patienten använder tobak eller nikotin, och per produkt dagligen, ibland eller slutat. Erbjuden och accepterad rökavvänjning är ett val, Erbjudet och accepterat.'],
  }),
  t('4.2', 'Registrera mätvärden', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_oppenvard', 'ssk_slutenvard', 'underskoterska', 'medicinsk_sekreterare'], {
    syfte: 'Registrera mätvärden strukturerat i Sara Sandmarks journal.',
    mal: ['Längd 165 cm, vikt 75 kg, blodtryck 140/90 mmHg och puls 83 slag per minut.'],
    slut: 'Mätvärdena är inmatade i journalen.',
    tidsklass: 6, tidsklassSkal: 'Fyra mätvärden.',
    // Runda 8, r5: alla fyra värdena i ett formulär, 7 steg i stället för 15.
    korningar: [kor('lakare_oppenvard', 7, 'Ett klick på patienten i arbetslistan, ett på Registrera mätvärde och ett på formuläret för längd, vikt, blodtryck och puls, där längden har fokus. Ett fältbyte vardera för vikt, blodtryck och puls och ett klick för att registrera alla fyra. Tiden och vårdkontakten sätter systemet, och BMI räknas själv.'),
      kor('ssk_slutenvard', 7, 'Samma steg som för läkaren i öppenvården, från arbetslistan på avdelningen.'),
      kor('underskoterska', 7, 'Samma steg som för läkaren i öppenvården, från arbetslistan på avdelningen.')],
    avvikelser: ['Tiden för besöket är nu, eftersom Sussas datum ligger före testet.', 'Formuläret för flera värden byggdes i runda 8 för testfallet. I runda 7 krävde testfallet 15 steg, med ett val i listan för varje mätvärde.'],
  }),
  t('4.3', 'Skapa slutanteckning eller epikris', ['lakare_slutenvard', 'ssk_slutenvard', 'medicinsk_sekreterare'], {
    syfte: 'Skapa en epikris strukturerat i Anna Karlssons journal.',
    mal: ['Epikris för vårdtillfället på avdelningen med diagnosen sepsis.', 'Vårdförlopp, bedömning och planering med Sussas texter.', 'Signera.'],
    slut: 'Informationen är inmatad och anteckningen är signerad.',
    tidsklass: 15, tidsklassSkal: 'Fyra textfält med längre texter och en signering.',
    // Runda 8, r5: epikrisen från vårdtillfället med systemets förslag, 4 steg i stället för 8.
    korningar: [kor('lakare_slutenvard', 4, 'Ett klick på patienten i arbetslistan och ett på Skriv epikris vid vårdtillfället. Systemet har skrivit orsaken till vården och diagnosen sepsis med kod ur vårdtillfället, och fokus står i Förlopp. Ett fältbyte till Uppföljning och ett klick för att signera. Det pågående vårdtillfället är förvalt som vårdkontakt.')],
    avvikelser: ['Vårdtillfället pågår på Avdelning 72 i stället för Infektionskliniken, och började tre dagar före testet.', 'Vårdkällans epikris har sökorden Orsak till vård, Förlopp, Läkemedelsförändringar och Uppföljning. Systemet skriver diagnosen under Orsak till vård, och vårdförloppet och bedömningen skrivs under Förlopp och planeringen under Uppföljning.', 'Förslaget till epikrisen byggdes i runda 8. I runda 7 krävde testfallet 8 steg.'],
  }),
  t('4.4', 'Signera', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_oppenvard', 'ssk_slutenvard', 'paramedicinare'], {
    syfte: 'Signera alla egna osignerade poster, 30 för läkare och 20 för övriga.',
    mal: ['Signera alla osignerade poster.'],
    slut: 'Alla osignerade poster är signerade.',
    tidsklass: 9, tidsklassSkal: 'Många poster, men samma handling varje gång.',
    korningar: [kor('lakare_oppenvard', 3, 'Ett klick på Inkorg i menyn, ett på Granska och signera alla, som visar alla utkast med patient, tid och text i en lista, och ett klick för att signera alla. Varje anteckning går att öppna från listan innan den signeras.')],
    avvikelser: ['Posterna är 30 osignerade anteckningar för de tre patienterna. Osignerade mätvärden och provsvar finns inte i Vårdkällan, eftersom mätvärden sparas direkt.', 'Granska och signera alla i inkorgen byggdes i runda 7 för testfallet.'],
  }),

  // Tema 5: Administration
  // Runda 8, r3: fri bokning i Dagens arbete (bokning-r8.js).
  t('5.1', 'Boka patient till ett besök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Boka ett besök för Helene Lund hos en namngiven läkare på mottagningen.',
    mal: ['Ett besök på 30 minuter hos läkaren en viss dag och tid.', 'Skicka en kallelse.'],
    slut: 'Helene Lund är bokad till ett besök och en kallelse är skickad.',
    tidsklass: 6, tidsklassSkal: 'En bokning och en kallelse.',
    korningar: [kor('medicinsk_sekreterare', 4, 'Ett klick på Boka besök i Dagens arbete, där sökfältet har fokus, och Enter. Det finns en träff, så systemet väljer patienten och visar sitt val: återbesök på 30 minuter hos läkaren som patienten har träffat förut, och de lämpligaste tiderna. Ett klick på den första tiden bokar den, skapar vårdkontakten och skickar kallelsen. Budgeten har plats för att välja patienten när det finns flera träffar.')],
    avvikelser: ['Patienten står inte på väntelistan och har ingen remiss. Hon har varit på mottagningen förut, eftersom en bokning kräver vårdrelation, och läkaren är Sara Lindqvist på Kardiologiska mottagningen.', 'Systemet föreslår tiden, så användaren väljer inte klockslaget 13.30. Sussas datum ligger före testet. Vårdgivare och besökstyp går att ändra i dialogen.', 'Kallelsen skickas som brev till en påhittad adress, och breven är simulerade.'],
  }),
  // Runda 8, r3: teambesök i Dagens arbete (bokning-r8.js).
  t('5.2', 'Boka ett teambesök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Boka Sven Markström till en läkare och en sjuksköterska samtidigt.',
    mal: ['Besök på 60 minuter hos två vårdgivare.', 'Skicka en kallelse.'],
    slut: 'Sven Markström är bokad till ett teambesök och en kallelse är skickad.',
    tidsklass: 9, tidsklassSkal: 'En bokning med två resurser.',
    korningar: [kor('medicinsk_sekreterare', 5, 'Ett klick på Boka teambesök i Dagens arbete, där sökfältet har fokus, och Enter. Systemet väljer patienten, föreslår teamet (den läkare och den sjuksköterska som patienten har träffat förut) och visar tider då båda och ett behandlingsrum är lediga i 60 minuter. Ett klick på den första tiden bokar besöket och rummet och skickar kallelsen med båda vårdgivarna. Budgeten har plats för att ändra teamet med två klick.')],
    avvikelser: ['Vårdgivarna är läkaren Sara Lindqvist och sjuksköterskan Lina Persson på Kardiologiska mottagningen, och patienten har träffat båda förut.', 'Systemet föreslår tiden, så användaren väljer inte klockslaget 10.45. Kallelsen skickas som brev till en påhittad adress, och breven är simulerade.'],
  }),
  // Runda 8, r3: patienter läggs till i en gruppträff i Dagens arbete (bokning-r8.js).
  t('5.3', 'Boka ett gruppbesök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Boka fem patienter till en fysioterapeut på samma tid.',
    mal: ['Fem patienter till samma gruppbesök på 60 minuter.', 'Skicka kallelse till alla.'],
    slut: 'De fem patienterna är bokade och en kallelse är skickad till alla.',
    tidsklass: 15, tidsklassSkal: 'Fem patienter till samma tid.',
    korningar: [kor('medicinsk_sekreterare', 15, 'Ett klick på Lägg till patient vid gruppträffen i Dagens arbete. Dialogen står kvar med sökfältet i fokus: för varje patient Enter och ett klick på träffen, och systemet bokar platsen, skriver kallelsen och räknar platserna kvar (tio steg för fem patienter). Ett klick på Klar, ett på Skicka kallelser vid gruppen och ett för att bekräfta. Budgeten har plats för ett steg till.')],
    avvikelser: ['Gruppträffen leds av fysioterapeuten Jenny Holmberg på Kardiologiska mottagningen, och patienterna har varit på mottagningen förut, eftersom en bokning kräver vårdrelation.', 'Gruppträffen ligger tre arbetsdagar efter testet klockan 11.45, eftersom Sussas datum ligger före testet. Kallelserna skickas som brev till påhittade adresser, och breven är simulerade.'],
  }),
  t('5.4', 'Omboka besök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Susanne Svedin ringer för att boka om sitt besök, men det finns inga lediga tider.',
    mal: ['Avboka besöket och sätt patienten på väntelistan med prioritet 6 månader.'],
    slut: 'Det planerade besöket är avbokat och patienten står på väntelistan.',
    tidsklass: 6, tidsklassSkal: 'En avbokning och en post på väntelistan.',
    korningar: [kor('medicinsk_sekreterare', 5, 'Ett klick på Sök patient, där sökfältet har fokus, Enter och ett klick på träffen. Ett klick på Avboka vid tiden, där orsaksfältet har fokus, och ett klick för att avboka. Patienten stod på väntelistan när tiden bokades, så systemet lägger tillbaka henne där med samma tidstyp, vårdgivare och gräns.')],
    avvikelser: ['Väntelistan har prioriteten hög, normal eller låg och ett måldatum. Patienten får tillbaka sitt måldatum, som är 6 månader efter att hon sattes upp, i stället för att användaren skriver 6 månader.'],
  }),
  t('5.5', 'Ankomstregistrering', ['medicinsk_sekreterare'], {
    syfte: 'Ankomstregistrera Sofia Andersson.',
    mal: ['Ankomstregistrera Sofia Andersson på mottagningen i dag hos en namngiven läkare.'],
    slut: 'Sofia Andersson är ankomstregistrerad.',
    tidsklass: 6, tidsklassSkal: 'En incheckning.',
    korningar: [kor('medicinsk_sekreterare', 1, 'Som flödet Checka in en patient i klickbudgeten: ett klick på Checka in i raden för patienten i Dagens arbete. Avgiften räknar systemet.')],
    avvikelser: ['Mottagningen är Kardiologiska mottagningen och läkaren Sara Lindqvist.'],
  }),
  t('5.6', 'Överblicka ankomstregistrering', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare'], {
    syfte: 'Överblicka de egna patienter som har ankomstregistrerats i dag på mottagningen.',
    mal: ['Sök fram dina patienter som har kommit i dag.', 'Meddela antalet.'],
    slut: 'Användaren har räknat till fem ankomstregistreringar.',
    tidsklass: 6, tidsklassSkal: 'En vy och en räkning.',
    korningar: [kor('lakare_oppenvard', 1, 'Ett klick på Min tidbok i arbetslistan. Läkaren ser sitt eget schema för i dag med Incheckad vid varje patient som har kommit.')],
    avvikelser: ['Läkaren är Per Holm på Vårdcentralen Tybble. Patienterna är de fem i Sussas testdata för läkaren.'],
  }),
  t('5.7', 'Oplanerad ankomstregistrering', ['ssk_oppenvard', 'medicinsk_sekreterare'], {
    syfte: 'Akut eller oplanerad ankomstregistrering av Gerda Ström på jourmottagningen.',
    mal: ['Registrera Gerda Ström som oplanerat besök.'],
    slut: 'Gerda Ström är ankomstregistrerad.',
    tidsklass: 6, tidsklassSkal: 'Ett oplanerat besök.',
    korningar: [kor('medicinsk_sekreterare', 5, 'Ett klick på Sök patient, där sökfältet har fokus, Enter och ett klick på träffen. Ett klick på Registrera vårdkontakt, där besök och nu är förvalda och orsaksfältet har fokus, och ett klick för att registrera.')],
    avvikelser: ['Jourmottagningen motsvaras av ett oplanerat besök på Kardiologiska mottagningen.', 'Gerda Ström har en remiss till kardiologen i testdatan för testfall 2.3 (runda 8), så systemet föreslår orsaken ur remissen.'],
  }),
  t('5.8', 'Väntelista', ['medicinsk_sekreterare'], {
    syfte: 'Boka Jonas Brun från väntelistan.',
    mal: ['Sök fram väntelistan för mottagningen.', 'Hitta Jonas Brun.', 'Boka honom till ett besök på 30 minuter.', 'Skicka kallelse.'],
    slut: 'Jonas Brun är bokad till ett besök och en kallelse är skickad.',
    tidsklass: 9, tidsklassSkal: 'En sökning i väntelistan, en bokning och en kallelse.',
    korningar: [kor('medicinsk_sekreterare', 3, 'Ett klick på Väntelista i menyn, ett på Boka tid för patienten och ett på den tid som systemet föreslår först. Kallelsen går ut av sig själv.')],
    avvikelser: ['Systemet föreslår tiden hos den vårdgivare som har lediga tider av rätt typ, så användaren väljer inte klockslaget. Vårdgivaren är en läkare på Kardiologiska mottagningen, eftersom fysioterapeuten inte har någon tidbok.'],
  }),

  // Tema 6: Övergångar
  t('6.1', 'Akut inskrivning av patient på vårdavdelning', ['lakare_slutenvard', 'ssk_slutenvard'], {
    syfte: 'Skriva in Mira Axelsson akut på avdelningen.',
    mal: ['Upprätta ett oplanerat slutenvårdstillfälle på avdelningen.', 'Koppla patienten till en sängplats.'],
    slut: 'Mira Axelsson finns på en sängplats på avdelningen.',
    tidsklass: 6, tidsklassSkal: 'En inskrivning och en sängplats.',
    korningar: [kor('ssk_slutenvard', 4, 'Ett klick på patienten i arbetslistan och ett på Skriv in, där orsaksfältet har fokus, ett fältbyte för sal och säng och ett klick för att skriva in. Avdelningen är förvald.'),
      kor('lakare_slutenvard', 4, 'Samma steg som för sjuksköterskan, med avdelningen förvald.')],
    avvikelser: ['Avdelningen är Avdelning 72, kardiologi, där sjuksköterskan arbetar.'],
  }),
  t('6.2', 'Överflyttning av patient mellan avdelningar med olika medicinsk specialitet', ['lakare_slutenvard', 'ssk_slutenvard'], {
    syfte: 'Planerad överflyttning av Fatima Baskar till en avdelning med annan specialitet.',
    mal: ['Flytta Fatima Baskar till den andra avdelningen.', 'Hon ska inte knytas till någon sängplats.'],
    slut: 'Fatima Baskar finns på den nya avdelningen utan sängplats.',
    tidsklass: 6, tidsklassSkal: 'En flytt.',
    korningar: [kor('ssk_slutenvard', 5, 'Ett klick på patienten i arbetslistan och ett på Flytta, två klick för att välja avdelning i listan och ett klick för att flytta. Sal och säng lämnas tomt.'),
      kor('lakare_slutenvard', 5, 'Samma steg som för sjuksköterskan.')],
    avvikelser: ['Flytten går från Avdelning 72, kardiologi, till Ortopediska kliniken USÖ.'],
  }),
  t('6.3', 'Hitta information från tidigare slutenvårdstillfälle', ['lakare_slutenvard', 'ssk_slutenvard'], {
    syfte: 'Visa och läsa epikrisen från ett tidigare slutenvårdstillfälle för Bertil Danielsson.',
    mal: ['Sök epikrisen från vårdtillfället 2016-03-22 till 2016-03-26.', 'Öppna den och hitta huvuddiagnosen.'],
    slut: 'Epikrisen är öppen och huvuddiagnosen är funnen. Rätt svar är sepsis.',
    tidsklass: 6, tidsklassSkal: 'En sökning och en anteckning att öppna.',
    korningar: [kor('lakare_slutenvard', 4, 'Ett klick på patienten i arbetslistan, ett fältbyte till sökfältet i journalen, Enter för att söka och ett klick på träffen, som öppnar epikrisen. Systemet söker bara i det läkaren får läsa.'),
      kor('ssk_slutenvard', 4, 'Samma steg som för läkaren. Sjuksköterskan får läsa epikrisen.')],
    avvikelser: ['Vårdtillfället var på Avdelning 72, kardiologi.'],
  }),

  // Tema 7: Gemensamma vyer
  // Runda 8, r3: avdelningens planering (avdelningsplan.js).
  t('7.1', 'Överblicka dagens arbete för din arbetsplats', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare', 'underskoterska'], {
    syfte: 'Visa den samlade bilden av dagens arbete på avdelningen.',
    mal: ['Ta fram dagens arbete på avdelningen.', 'Meddela vilka händelser som äger rum klockan 11.'],
    slut: 'Händelserna klockan 11 är funna: provtagning för en patient och sjukgymnastik för en annan.',
    tidsklass: 6, tidsklassSkal: 'En vy och en tid.',
    korningar: [kor('ssk_slutenvard', 1, 'Ett klick på Avdelningens planering i arbetslistan. Vyn visar dagens händelser för avdelningens patienter i tidsordning: uppgifter, läkemedel att ge och bokade tider.'),
      kor('lakare_slutenvard', 1, 'Samma steg som för sjuksköterskan. Avdelningen är förvald, eftersom läkarens patienter ligger där.'),
      kor('paramedicinare', 1, 'Samma steg som för sjuksköterskan. Fysioterapeuten på mottagningen ser avdelningen på samma vårdenhet.')],
    avvikelser: ['Avdelningen är Avdelning 72, kardiologi. Sussas händelser ligger i dag med Sussas klockslag.', 'Kontrollerna i Sussas testdata (temperatur, puls, blodtryck och blodsocker) är planerade uppgifter här. Ordinerade kontroller ansluts när de finns.'],
  }),
  // Runda 8, r3: avdelningens planering för ett urval av patienter (avdelningsplan.js).
  t('7.2', 'Överblicka dagens händelser för en grupp patienter', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare', 'underskoterska'], {
    syfte: 'Visa dagens händelser för fyra patienter på avdelningen.',
    mal: ['Visa händelserna för Gerda Ström, Elin Arnström, Trevis Ljung och Berit Strandhall.', 'Meddela vilka händelser som äger rum klockan 11.'],
    slut: 'Händelserna klockan 11 är funna för de fyra patienterna.',
    tidsklass: 6, tidsklassSkal: 'En vy med fyra patienter.',
    korningar: [kor('ssk_slutenvard', 5, 'Ett klick på Avdelningens planering i arbetslistan och ett klick per patient för att markera de fyra. Vyn visar då bara deras händelser, och valet står kvar tills sidan laddas om.'),
      kor('underskoterska', 5, 'Samma steg som för sjuksköterskan.')],
    avvikelser: ['Avdelningen är Avdelning 72, kardiologi.'],
  }),
  // Runda 8, r3: en patients planering (avdelningsplan.js).
  t('7.3', 'Överblicka patientens planering', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare'], {
    syfte: 'Visa planerade händelser på avdelningen för en patient.',
    mal: ['Visa den samlade bilden av Bertil Danielssons händelser.', 'Meddela vilken händelse som äger rum klockan 15.'],
    slut: 'Händelsen klockan 15 är funnen. Rätt svar är EKG.',
    tidsklass: 6, tidsklassSkal: 'En patient och en tid.',
    korningar: [kor('lakare_slutenvard', 2, 'Ett klick på Avdelningens planering i arbetslistan och ett på Planering vid patienten. Vyn visar tre dagar bakåt och tre framåt, med dagen i dag markerad.'),
      kor('ssk_slutenvard', 2, 'Samma steg som för läkaren.')],
    avvikelser: ['Avdelningen är Avdelning 72, kardiologi.'],
  }),
  // Runda 8, r3: en persons planering för veckan (avdelningsplan.js).
  t('7.4', 'Visualisera en specifik resurs arbetsplanering', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare'], {
    syfte: 'Visa en namngiven läkares arbetsuppgifter på avdelningen under en vecka.',
    mal: ['Visa läkarens arbetsuppgifter under perioden.', 'Meddela vilken arbetsuppgift som äger rum klockan 11.'],
    slut: 'Läkarens händelse är funnen. Rätt svar är infektionskonsult.',
    tidsklass: 6, tidsklassSkal: 'En vy och en tid.',
    korningar: [kor('lakare_slutenvard', 2, 'Ett klick på Avdelningens planering i arbetslistan och ett på läkarens namn vid en händelse. Vyn visar läkarens vecka med uppgifterna på avdelningen, bokade tider och teambesök, och dagen i dag markerad.'),
      kor('ssk_slutenvard', 2, 'Samma steg som för läkaren.')],
    avvikelser: ['Läkaren är överläkaren Göran Malm på kardiologen, och perioden är veckan med testdagen i stället för Sussas datum i november 2017.'],
  }),
];

export const GENOMFORBARA = TESTFALL.filter(x => x.korningar.length);
// Varje körning: testfallet och rollen. Sussa räknade medelvärdet av alla mätningar, så varje roll räknas för sig.
export const KORNINGAR = GENOMFORBARA.flatMap(x => x.korningar.map(k => ({ x, k })));
export const testfall = (nr) => TESTFALL.find(x => x.nr === nr);

// Testerna av registret och demoläget (test/sussa-testfall.test.js), som K4 och Sussa 8.4 pekar på.
export const TEST = 'Sussas testfall > ';
export const TEST_REGISTER = [
  `${TEST}registret har alla 34 testfall i Sussas sju teman med roller, mål, slutvillkor och tidsklass`,
  `${TEST}tidspoängen följer tabellen i Bilaga F1:2 för de fyra tidsklasserna`,
  `${TEST}måluppfyllelsen ger 10, 5, 2 eller 0 efter slutvillkoret och klickbudgeten`,
  `${TEST}omvandlingen till utvärderingspoäng följer Bilaga F1:2 avsnitt 5`,
  `${TEST}tidsuppskattningen följer keystroke-level model med den uppmätta svarstiden`,
  `${TEST}sussa-testfall.json har varje genomförbart testfall med registrets klickbudget och tidsklass, inom budget`,
  `${TEST}demoläget lägger in testpatienterna med Skatteverkets testpersonnummer och datan som testfallen behöver`,
  `${TEST}tema 1 genomförs med Sussas läkemedel i en katalog med minst 100 produkter`,
];

// Testnamnet för ett testfall som genomförs i gränssnittet (test/sussa-testfall.cjs).
export const PREFIX = 'Gränssnitt > Sussas testfall > ';
export const testfallTest = (x, k) => `${PREFIX}${x.nr} ${x.titel} (${ROLLER[k.roll].namn.toLowerCase()}) når slutvillkoret inom klickbudgeten`;
export const KORNINGSTESTER = KORNINGAR.map(({ x, k }) => testfallTest(x, k));

// Sammanställningen enligt F1:2 avsnitt 5 ur resultatfilen. Mätning 1 och 2 räknas både för alla 34 testfall, där ett
// testfall som Vårdkällan inte kan genomföra ger 0 poäng som i Sussas modell, och för de testfall som genomförs.
export function sammanstall(resultat, { testfall = TESTFALL } = {}) {
  const medel = (v) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null);
  // Ett testfall med flera roller får medelvärdet av rollernas poäng. En körning som inte nådde slutvillkoret ger 0.
  const rader = testfall.map(x => {
    const r = (resultat?.testfall ?? []).filter(y => y.nr === x.nr);
    const genomford = Boolean(x.korningar.length && r.length && r.some(y => y.uppnatt));
    return { nr: x.nr, mal: genomford ? medel(r.map(y => (y.uppnatt ? y.malpoang : 0))) : 0, tid: genomford ? medel(r.map(y => (y.uppnatt ? y.tidspoang : 0))) : 0, genomford };
  });
  const genomforda = rader.filter(r => r.genomford);
  const del = (lista) => {
    const m1 = medel(lista.map(r => r.mal));
    const m2 = medel(lista.map(r => r.tid));
    return { antal: lista.length, malupfyllelse: m1, effektivitet: m2, poang: { malupfyllelse: utvarderingspoang('malupfyllelse', m1), effektivitet: utvarderingspoang('effektivitet', m2) } };
  };
  return { alla: del(rader), genomforda: del(genomforda), antalGenomforda: genomforda.length, antal: rader.length, korningar: (resultat?.testfall ?? []).length };
}
