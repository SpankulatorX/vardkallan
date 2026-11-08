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
    korningar: [kor('lakare_oppenvard', 29, 'Ett klick på patienten. Alvedon forte: Ordinera, träffen, där ordinationsorsaken får fokus, och två fältbyten med markering för att skriva om doseringen och dosen, och spara (7). Kloramfenikol: Ordinera, träffen, där doseringen får fokus, två klick för typen Tillfällig, ett fältbyte vardera för orsak och slutdatum, och spara (7). Sertralin: Ordinera, träffen, Upptrappning enligt schema, två steg för att ändra antalet dagar till 6, orsaken, uppföljning om två veckor och spara (8). Metformin: fliken Läkemedel, Sätt ut, där orsaken får fokus, bekräfta, Ordinera, träffen och spara (6). Provförpackningen med 10 tabletter är förvald.', ['Ögondropparna sparas med administrationssättet peroralt, eftersom ögat inte finns bland administrationssätten.', 'Systemet föreslår doseringen och dosen för Alvedon 500 mg också för Alvedon forte 1 g, så de skrivs om.'])],
    avvikelser: ['Metformin har ingen dosändring: den gamla ordinationen sätts ut och den nya ordineras. Ordinationen skickas till NLL när den sparas, och NLL är simulerad.', 'Kloramfenikol är Kloramfenikol Santen och Metformin 850 mg är Metformin Teva. Recept och uttag på apotek finns inte i demon.'],
  }),
  t('1.2', 'Ordinera läkemedel', ['lakare_slutenvard'], {
    syfte: 'Ur en läkemedelskatalog med minst 100 läkemedel ordinera läkemedel till Elin Arnström.',
    mal: ['Paracetamol Panpharma 10 mg/ml infusion 100 ml som engångsordination, ges som intravenös infusion under 15 minuter.', 'Glukos 25 mg/ml buffrad 1000 ml med Addex Magnesium 20 mmol, ges på två timmar.', 'Stesolid 10 mg som premedicinering en timme före röntgen.'],
    slut: 'Läkemedlen är ordinerade.',
    tidsklass: 18, tidsklassSkal: 'En infusion, en blandning med tillsats och en ordination som hänger på en undersökning.',
    korningar: [kor('lakare_slutenvard', 28, 'Ett klick på patienten. Paracetamol: Ordinera, träffen, där orsaken får fokus, två steg vardera för att skriva om doseringen och dosen, två klick för typen Tillfällig och spara (9). Glukos och Addex-Magnesium: Ordinera, träffen, där doseringen får fokus, två klick för typen, orsaken och spara (6 vardera). Stesolid: Ordinera, träffen, orsaken, Ges inför en planerad vårdhändelse, Ny vårdhändelse, där texten får fokus, och spara (6). En timme före är förvalt.', ['Systemet föreslår en dosering för tabletter till paracetamol som infusion, så doseringen, dosen och typen skrivs om.', 'Addex-Magnesium kan inte ordineras som tillsats i glukoslösningen, så den ordineras för sig med en hänvisning i doseringen.'])],
    avvikelser: ['Paracetamol Panpharma finns inte i NPL, så infusionen är Paracetamol Fresenius Kabi 10 mg/ml. Den buffrade glukosen är Glucos Baxter 25 mg/ml buffrad.', 'Röntgen är en ny vårdhändelse som väntar på tid i tidboken.'],
  }),
  t('1.3', 'Ordinera läkemedel på uppdrag', ['ssk_slutenvard'], {
    syfte: 'Ordinera två läkemedel till Trevis Ljung på uppdrag av en namngiven läkare.',
    mal: ['Alvedon 1 g tablett mot smärta som engångsordination.', 'Morfin injektionsvätska 10 mg/ml, 1 ml intramuskulärt mot smärta, engångsordination.'],
    slut: 'De två läkemedlen är ordinerade.',
    tidsklass: 9, tidsklassSkal: 'Två ordinationer med en uppdragsgivare.',
    korningar: [kor('ssk_slutenvard', 31, 'Ett klick på patienten och ett på fliken Läkemedel. För varje läkemedel: Muntlig ordination, två klick för läkaren, ett fältbyte för varför behandlingen inte kan vänta, sökningen och träffen, och spara. Alvedon forte: två steg vardera för att skriva om doseringen och dosen och två för typen (14). Morfin: ett steg för doseringen, som har fokus, två för dosen, två för typen, två för intramuskulärt och ett för orsaken (15).', ['Systemet föreslår doseringen och dosen för Alvedon 500 mg också för Alvedon forte 1 g, så de skrivs om.', 'Läkaren och skälet till den muntliga ordinationen anges på nytt för det andra läkemedlet.'])],
    avvikelser: ['Uppdragsgivaren är läkaren Sara Lindqvist, som signerar den muntliga ordinationen i sin inkorg.'],
  }),
  t('1.4', 'Administrera läkemedel', ['ssk_slutenvard'], {
    syfte: 'Utifrån ordinationslistan administrera fyra läkemedel till Bertil Danielsson.',
    mal: ['Ge Paracetamol Panpharma och läs upp instruktionen.', 'Iordningställ och ge Glukos med Addex-Magnesium och läs upp instruktionen.', 'Ge sömnmedicinen.', 'Ge premedicineringen inför röntgen.', 'Dokumentera att patienten kräktes upp premedicineringen.'],
    slut: 'Instruktionerna är upplästa, alla fyra läkemedel är administrerade och det är dokumenterat att patienten kräktes upp premedicineringen.',
    tidsklass: 15, tidsklassSkal: 'Fyra administreringar, ett iordningställande och en avvikelse som ska dokumenteras.',
    korningar: [kor('ssk_slutenvard', 12, 'Ett klick på Läkemedel att ge, ett på Ge för paracetamol, Mer och Iordningsställ för glukoslösningen och sedan Ge, Ge för Stesolid och Ge för Zopiklon vid behov (7). Instruktionerna står i doseringen i listan. Kräkningen dokumenteras med ett klick på patienten, fliken Översikt, Ny anteckning, där omvårdnadsanteckningen är förvald, ett fältbyte för sökordet Elimination och Signera (5).')],
    avvikelser: ['Ordinationerna gjordes i går och dosen ska ges i dag vid den hela timmen före testet. Att patienten kräktes upp premedicineringen registreras inte på dosen utan i en omvårdnadsanteckning.'],
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
  t('2.2', 'Upprätta och skicka vårdbegäran på uppdrag', ['medicinsk_sekreterare'], {
    syfte: 'Upprätta och skicka en vårdbegäran för Mira Axelsson på uppdrag av en namngiven läkare.',
    mal: ['Ange uppdragsgivaren, en läkare på Medicinkliniken, som remittent.', 'Mottagare Ortopedkliniken.', 'Frågeställning och anamnes som i testfall 2.1.', 'Skicka vårdbegäran.'],
    slut: 'Vårdbegäran är skickad.',
    tidsklass: 9, tidsklassSkal: 'Som testfall 2.1 med en uppdragsgivare.',
    saknas: 'Vårdadministratören kan inte skicka remisser, och en remiss på uppdrag av en annan remittent finns inte.',
  }),
  t('2.3', 'Ta emot vårdbegäran', ['lakare_slutenvard', 'lakare_oppenvard', 'paramedicinare'], {
    syfte: 'Fördela och prioritera eller avvisa vårdbegäran ur en lista med tio remisser.',
    mal: ['Fördela Berit Strandhall till bakjouren, en namngiven läkare.', 'Sätt Gerda Ström på väntelistan för besök om två månader.', 'Avvisa Elin Arnströms remiss på grund av fel vårdnivå med en svarstext.', 'Skicka Trevis Ljungs remiss vidare till psykiatriska kliniken.'],
    slut: 'De fyra remisserna är fördelade, prioriterade, avvisade eller vidareskickade.',
    tidsklass: 15, tidsklassSkal: 'Fyra remisser med fyra olika beslut.',
    saknas: 'Att fördela en remiss till en namngiven läkare finns inte. Accepterad remiss hamnar på väntelistan, avvisning med motivering och vidarebefordran finns.',
  }),
  t('2.4', 'Ta emot vårdbegäran på uppdrag', ['medicinsk_sekreterare'], {
    syfte: 'Fördela vårdbegäran ur en lista med tio remisser på uppdrag.',
    mal: ['Fördela Bertil Danielsson till bakjouren, en namngiven läkare.', 'Sätt Sara Sandmark, Anna Karlsson och Sven Markström på remisskonferens.'],
    slut: 'En remiss är fördelad till bakjouren och de övriga står på remisskonferens.',
    tidsklass: 15, tidsklassSkal: 'Fyra remisser, varav tre till samma konferens.',
    saknas: 'Remisskonferens och fördelning till en namngiven läkare finns inte. Vårdadministratören kvitterar mottagna remisser men bedömer dem inte.',
  }),
  t('2.5', 'Registrera en extern vårdbegäran', ['medicinsk_sekreterare'], {
    syfte: 'Registrera en vårdbegäran som har kommit på papper från en extern enhet, så att den kan handläggas.',
    mal: ['Patient Trevis Ljung, remissdatum, avsändande enhet, frågeställning och anamnes.', 'Spara.'],
    slut: 'Remissen är inregistrerad.',
    tidsklass: 9, tidsklassSkal: 'Fem uppgifter som skrivs av från papper.',
    saknas: 'Att registrera en remiss på papper från en vårdgivare utanför Vårdkällan finns inte.',
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
  t('3.1', 'Upprätta en labbeställning', ['lakare_slutenvard', 'lakare_oppenvard'], {
    syfte: 'Upprätta labbeställningar för Hamid Burvall.',
    mal: ['P-CRP, B-Blodstatus och P-Kreatinin till kemlab i dag klockan 9.', 'Blododling till baktlab med anamnes.', 'Spara eller skicka.'],
    slut: 'Beställningen är sparad, skickad eller verkställd.',
    tidsklass: 9, tidsklassSkal: 'Fyra analyser till två laboratorier.',
    saknas: 'Labbeställning finns inte. Provsvar visas som mätvärden, men ingen beställning går till ett laboratorium.',
  }),
  t('3.2', 'Upprätta en labbeställning på uppdrag', ['ssk_oppenvard', 'ssk_slutenvard', 'underskoterska'], {
    syfte: 'Upprätta labbeställningar för Laura August på uppdrag av en namngiven läkare.',
    mal: ['Samma analyser som i testfall 3.1.', 'Spara eller skicka.'],
    slut: 'Beställningen är sparad, skickad eller verkställd.',
    tidsklass: 9, tidsklassSkal: 'Som testfall 3.1 med en uppdragsgivare.',
    saknas: 'Labbeställning finns inte, inte heller på uppdrag.',
  }),
  t('3.3', 'Registrera provtagning', ['ssk_oppenvard', 'ssk_slutenvard', 'underskoterska'], {
    syfte: 'Registrera provtagning utifrån en befintlig beställning för Trevis Ljung och skicka den.',
    mal: ['Hitta beställningen med blodstatus, B12, folat och urinodling.', 'Markera vilka prover som är tagna och skicka.'],
    slut: 'Beställningen är skickad.',
    tidsklass: 6, tidsklassSkal: 'En befintlig beställning med fyra prover att bocka av.',
    saknas: 'Labbeställning och provtagning mot en beställning finns inte.',
  }),
  t('3.4', 'Överblicka provsvar', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_slutenvard', 'ssk_oppenvard', 'underskoterska'], {
    syfte: 'Överblicka provsvaren för Bertil Danielsson och hitta ett visst provsvar.',
    mal: ['Leta rätt på provsvaret PK som en läkare på vårdcentralen beställde, taget en viss dag klockan 11.36.', 'Läs upp provsvaret.'],
    slut: 'Resultatet är uppläst. Rätt svar är PK 0,9 INR.',
    tidsklass: 6, tidsklassSkal: 'Ett värde att hitta bland fem provtagningar.',
    korningar: [kor('lakare_slutenvard', 5, 'Ett klick på patienten i arbetslistan och ett på fliken Mätvärden. Provet togs på vårdcentralen, så inre sekretess kräver ett aktivt val: ett klick på Visa uppgifter från andra vårdenheter, ett på det syfte som systemet föreslår och ett för att visa. Tabellen visar tid, värde och vårdenhet för varje provsvar, så svaret syns utan fler klick.'),
      kor('ssk_slutenvard', 5, 'Samma steg som för läkaren, med samma aktiva val för provsvaren från vårdcentralen.'),
      kor('underskoterska', 5, 'Samma steg som för läkaren. Undersköterskan läser mätvärden och provsvar men inte läkaranteckningar.')],
    avvikelser: ['Provsvaren är tagna fem dagar till en vecka före testet i stället för i oktober 2017, så att de syns i demon. Beställande läkare visas inte, eftersom provsvaren inte har någon beställning, men vårdenheten och tiden visas.'],
  }),
  t('3.5', 'Upprätta en beställning eller ordination på intern analys eller mätvärde', ['lakare_oppenvard', 'lakare_slutenvard'], {
    syfte: 'Ordinera kontroller av mätvärden för Inga Strand.',
    mal: ['Puls, blodtryck, sänkningsreaktion, temperatur och vikt i morgon klockan 7.', 'Följ vätskebalansen det kommande dygnet.', 'Spara, signera eller verkställ.'],
    slut: 'Beställningen är sparad, signerad eller verkställd.',
    tidsklass: 9, tidsklassSkal: 'Sex kontroller vid samma tid.',
    saknas: 'En ordination av kontroller och mätvärden till avdelningen finns inte. Mätvärden registreras när de har tagits.',
  }),

  // Tema 4: Strukturerad information
  t('4.1', 'Skapa anteckning', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_oppenvard', 'ssk_slutenvard', 'underskoterska', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Mata in strukturerad information om rökning i Berit Strandhalls journal.',
    mal: ['Rökare ja, 25 cigaretter per dag, rökavvänjning erbjuden och accepterad, och en kommentar.'],
    slut: 'Informationen är inmatad på ett strukturerat sätt i journalen.',
    tidsklass: 6, tidsklassSkal: 'Fem frågor med fasta svar och en kommentar.',
    saknas: 'En mall för tobaksvanor med fasta svarsalternativ finns inte. Anteckningarna har sökord med fritext.',
  }),
  t('4.2', 'Registrera mätvärden', ['lakare_slutenvard', 'lakare_oppenvard', 'ssk_oppenvard', 'ssk_slutenvard', 'underskoterska', 'medicinsk_sekreterare'], {
    syfte: 'Registrera mätvärden strukturerat i Sara Sandmarks journal.',
    mal: ['Längd 165 cm, vikt 75 kg, blodtryck 140/90 mmHg och puls 83 slag per minut.'],
    slut: 'Mätvärdena är inmatade i journalen.',
    tidsklass: 6, tidsklassSkal: 'Fyra mätvärden.',
    korningar: [kor('lakare_oppenvard', 15, 'Ett klick på patienten i arbetslistan och ett på Registrera mätvärde, där värdefältet för blodtryck redan har fokus, och ett klick för att registrera. Sedan för längd, vikt och puls två klick för att välja mätvärdet i listan, ett fältbyte för värdet och ett klick för att registrera. Tiden och vårdkontakten sätter systemet.'),
      kor('ssk_slutenvard', 15, 'Samma steg som för läkaren i öppenvården, från arbetslistan på avdelningen.'),
      kor('underskoterska', 15, 'Samma steg som för läkaren i öppenvården, från arbetslistan på avdelningen.')],
    avvikelser: ['Tiden för besöket är nu, eftersom Sussas datum ligger före testet.'],
  }),
  t('4.3', 'Skapa slutanteckning eller epikris', ['lakare_slutenvard', 'ssk_slutenvard', 'medicinsk_sekreterare'], {
    syfte: 'Skapa en epikris strukturerat i Anna Karlssons journal.',
    mal: ['Epikris för vårdtillfället på avdelningen med diagnosen sepsis.', 'Vårdförlopp, bedömning och planering med Sussas texter.', 'Signera.'],
    slut: 'Informationen är inmatad och anteckningen är signerad.',
    tidsklass: 15, tidsklassSkal: 'Fyra textfält med längre texter och en signering.',
    korningar: [kor('lakare_slutenvard', 8, 'Ett klick på patienten i arbetslistan och ett på Ny anteckning, två klick för att välja mallen Epikris, ett fältbyte vardera för Orsak till vård, Förlopp och Uppföljning och ett klick för att signera. Det pågående vårdtillfället är förvalt som vårdkontakt.')],
    avvikelser: ['Vårdtillfället pågår på Avdelning 72 i stället för Infektionskliniken, och började tre dagar före testet.', 'Vårdkällans epikris har sökorden Orsak till vård, Förlopp, Läkemedelsförändringar och Uppföljning. Diagnosen skrivs under Orsak till vård, vårdförloppet och bedömningen under Förlopp och planeringen under Uppföljning.'],
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
  t('5.1', 'Boka patient till ett besök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Boka ett besök för Helene Lund hos en namngiven läkare på mottagningen.',
    mal: ['Ett besök på 30 minuter hos läkaren en viss dag och tid.', 'Skicka en kallelse.'],
    slut: 'Helene Lund är bokad till ett besök och en kallelse är skickad.',
    tidsklass: 6, tidsklassSkal: 'En bokning och en kallelse.',
    saknas: 'En tid bokas för det patienten väntar på (en remiss eller en post på väntelistan), och systemet föreslår tiden. Att boka en patient som inte väntar på något, på en tid och hos en vårdgivare som användaren väljer, finns inte.',
  }),
  t('5.2', 'Boka ett teambesök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Boka Sven Markström till en läkare och en sjuksköterska samtidigt.',
    mal: ['Besök på 60 minuter hos två vårdgivare.', 'Skicka en kallelse.'],
    slut: 'Sven Markström är bokad till ett teambesök och en kallelse är skickad.',
    tidsklass: 9, tidsklassSkal: 'En bokning med två resurser.',
    saknas: 'Ett besök med två vårdgivare finns inte. Ingrepp bokar läkare, rum och utrustning samtidigt, men inte två personer.',
  }),
  t('5.3', 'Boka ett gruppbesök', ['lakare_oppenvard', 'ssk_oppenvard', 'paramedicinare', 'medicinsk_sekreterare'], {
    syfte: 'Boka fem patienter till en fysioterapeut på samma tid.',
    mal: ['Fem patienter till samma gruppbesök på 60 minuter.', 'Skicka kallelse till alla.'],
    slut: 'De fem patienterna är bokade och en kallelse är skickad till alla.',
    tidsklass: 15, tidsklassSkal: 'Fem patienter till samma tid.',
    saknas: 'Gruppträffar och gruppkallelser finns, men att lägga till patienter i en gruppträff i gränssnittet finns inte.',
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
    avvikelser: ['Jourmottagningen motsvaras av ett oplanerat besök på Kardiologiska mottagningen.'],
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
  t('7.1', 'Överblicka dagens arbete för din arbetsplats', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare', 'underskoterska'], {
    syfte: 'Visa den samlade bilden av dagens arbete på avdelningen.',
    mal: ['Ta fram dagens arbete på avdelningen.', 'Meddela vilka händelser som äger rum klockan 11.'],
    slut: 'Händelserna klockan 11 är funna: provtagning för en patient och sjukgymnastik för en annan.',
    tidsklass: 6, tidsklassSkal: 'En vy och en tid.',
    saknas: 'Planerade händelser och arbetsuppgifter på en vårdavdelning (provtagning, omläggning, sjukgymnastik, teamrond) finns inte. Tidboken har mottagningens tider, och Läkemedel att ge har dagens doser.',
  }),
  t('7.2', 'Överblicka dagens händelser för en grupp patienter', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare', 'underskoterska'], {
    syfte: 'Visa dagens händelser för fyra patienter på avdelningen.',
    mal: ['Visa händelserna för Gerda Ström, Elin Arnström, Trevis Ljung och Berit Strandhall.', 'Meddela vilka händelser som äger rum klockan 11.'],
    slut: 'Händelserna klockan 11 är funna för de fyra patienterna.',
    tidsklass: 6, tidsklassSkal: 'En vy med fyra patienter.',
    saknas: 'Planerade händelser på avdelningen finns inte, se testfall 7.1.',
  }),
  t('7.3', 'Överblicka patientens planering', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare'], {
    syfte: 'Visa planerade händelser på avdelningen för en patient.',
    mal: ['Visa den samlade bilden av Bertil Danielssons händelser.', 'Meddela vilken händelse som äger rum klockan 15.'],
    slut: 'Händelsen klockan 15 är funnen. Rätt svar är EKG.',
    tidsklass: 6, tidsklassSkal: 'En patient och en tid.',
    saknas: 'Planerade händelser på avdelningen finns inte, se testfall 7.1. Patientens bokade tider på mottagningar visas i översikten.',
  }),
  t('7.4', 'Visualisera en specifik resurs arbetsplanering', ['lakare_slutenvard', 'ssk_slutenvard', 'paramedicinare'], {
    syfte: 'Visa en namngiven läkares arbetsuppgifter på avdelningen under en vecka.',
    mal: ['Visa läkarens arbetsuppgifter under perioden.', 'Meddela vilken arbetsuppgift som äger rum klockan 15.30.'],
    slut: 'Läkarens händelse är funnen. Rätt svar är infektionskonsult.',
    tidsklass: 6, tidsklassSkal: 'En vy och en tid.',
    saknas: 'Arbetsuppgifter på avdelningen per person finns inte. Tidboken visar mottagningens scheman.',
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
