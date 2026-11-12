// Runda 12, r3 (vårt L2): behovs- och riskanalysen per roll, enligt patientdatalagen 4 kap. 2 § och HSLF-FS 2016:40
// 4 kap. 2 och 3 §§. Analysen är data här, bredvid behörighetsmotorn, så att ett test kan stoppa bygget om en roll i
// atkomst.js saknar analys eller om analysen säger något annat än koden. docs/behorighetsanalys.md skrivs ur den med
// scripts/behorighetsanalys-md.js.
//
// För varje roll: behovet av uppgifter, riskerna, hur risken begränsas och handlingar som rollen inte ska ha. Listan
// med rollens handlingar i dokumentet tas direkt ur ROLLER.
import { ROLLER } from './atkomst.js';
// Några moduler lägger till handlingar i ROLLER när de laddas (till exempel barnhälsovården). Servern laddar alla, så
// att analysen jämförs med rollerna som de är i drift.
import './server.js';

export const INLEDNING = [
  "Det här är Vårdkällans egen behovs- och riskanalys för tilldelningen av behörigheter, enligt patientdatalagen 4 kap. 2 § och HSLF-FS 2016:40 4 kap. 2 och 3 §§. För varje roll beskrivs vilket behov av uppgifter rollen har, vilka risker åtkomsten medför och hur risken begränsas, och vilka handlingar rollen har i behörighetsmotorn (`app/src/atkomst.js`). En vårdgivare som använder Vårdkällan gör sin egen analys utifrån sin verksamhet. Den här analysen är utgångspunkten och visar hur rollerna i systemet är tänkta.",
  "Analysen och koden hänger ihop. Ett test i bygget (`app/test/behorighetsanalys.test.js`) stoppar bygget om en roll i koden saknar analys, om listan med handlingar här skiljer sig från koden eller om en handling som analysen säger att rollen inte ska ha finns i koden.",
  "För alla roller gäller: all behörighet prövas på servern i varje anrop, varje åtkomst till patientuppgifter loggas i en logg som inte går att ändra, och handlingar som rollen saknar nekas och loggas som nekade."
];

export const ANALYS = {
  lakare: {
    namn: "Läkare",
    behov: "Utreder, diagnostiserar och behandlar. Behöver läsa och skriva hela journalen för patienter med vårdrelation, ordinera läkemedel och cytostatika, beställa prover och undersökningar, bedöma och besvara remisser, kontrasignera och använda nödåtkomst när patienten inte kan samtycka.",
    risker: "Bredast åtkomst av alla roller, och därmed störst risk för otillåten läsning (nyfikenhet, fel patient) och för felaktiga ordinationer.",
    atgarder: "Åtkomst bara med vårdrelation på den egna vårdenheten. Andra vårdenheter kräver aktivt val, spärrar kräver patientens samtycke, och nödåtkomst häver aldrig en spärr, loggas och flaggas i logguppföljningen. Ordinationer kontrolleras mot varningsreglerna och kräver motiverad kvittens. Den som signerat kan inte kontrasignera själv.",
    inte: ["las_logg", "konfigurera", "datauttag", "faktureringsunderlag", "sla_samman", "gallra"],
  },
  sjukskoterska: {
    namn: "Sjuksköterska",
    behov: "Planerar och ger omvårdnad, ger läkemedel, tar prover och registrerar mätvärden. Behöver läsa journalen och läkemedelslistan och skriva omvårdnadsanteckningar.",
    risker: "Läsning utan behov, och läkemedel som ges utan giltig ordination.",
    atgarder: "Kan inte ordinera läkemedel annat än enligt generella direktiv och muntliga ordinationer som läkaren signerar. Samma regler för vårdrelation, aktivt val, spärr och nödåtkomst som för läkaren. Administreringen kontrollerar ordinationen.",
    inte: ["ordinera", "skriv_journal", "kontrasignera", "ordinera_cytostatika", "las_logg", "konfigurera"],
  },
  underskoterska: {
    namn: "Undersköterska",
    behov: "Omvårdnad, mätvärden och provtagning. Behöver se läkemedel, mätvärden, överkänslighet och omvårdnadsanteckningar.",
    risker: "Tillgång till känsliga läkaranteckningar och diagnoser som inte behövs för uppgiften.",
    atgarder: "Läser inga läkaranteckningar och inga diagnoser. Ger läkemedel bara med en giltig delegering i dag. Ingen nödåtkomst.",
    inte: ["las_journal", "las_diagnoser", "ordinera", "nodatkomst", "skriv_journal"],
  },
  vardadministrator: {
    namn: "Vårdadministratör",
    behov: "Tar emot remisser, bokar, kallar, checkar in, registrerar vårdkontakter och patienter och hanterar kassan.",
    risker: "Insyn i journaltext eller läkemedel utan vårdbehov.",
    atgarder: "Ser kontaktuppgifter, vårdkontakter och remissernas status men ingen journaltext och inga läkemedel. Åtkomsten grundas som administrativ uppgift.",
    inte: ["las_journal", "las_omvardnad", "las_lakemedel", "las_diagnoser", "ordinera"],
  },
  logggranskare: {
    namn: "Logggranskare",
    behov: "Följer upp åtkomstloggen och gör stickprovskontroller enligt HSLF-FS 2016:40 4 kap. 9 och 9 b §§.",
    risker: "Loggen visar vilka patienter som har vårdats var, och granskaren skulle kunna läsa journalen.",
    atgarder: "Läser loggen men aldrig journalen. Loggen kan inte ändras, och granskningarna sparas.",
    inte: ["las_journal", "las_oversikt", "las_lakemedel"],
  },
  arkivarie: {
    namn: "Arkivarie",
    behov: "Registrerar beslut, skapar exportpaket till e-arkiv och verkställer gallring och förstöring efter beslut.",
    risker: "Att journaler utplånas utan beslut.",
    atgarder: "Läser inte journalen. Gallring tar bara journaler äldre än tio år efter den sista uppgiften, och allt loggas.",
    inte: ["las_journal", "las_oversikt", "ordinera"],
  },
  uppfoljning: {
    namn: "Analytiker (uppföljning)",
    behov: "Hämtar datauttag och statistik för verksamhetsuppföljning och rapporterar till myndigheter och register.",
    risker: "Att uppgifter går att knyta till enskilda patienter.",
    atgarder: "Datauttaget saknar namn och personnummer och använder pseudonymer. Små tal spärras. Läser inte journalen.",
    inte: ["las_journal", "las_oversikt", "sok"],
  },
  farmaceut: {
    namn: "Farmaceut",
    behov: "Gör farmaceutens bedömning i läkemedelsgenomgången och bereder cytostatika.",
    risker: "Tillgång till journaltext som inte behövs för läkemedelsbedömningen.",
    atgarder: "Läser läkemedelslistan, mätvärden och diagnoser men inga journalanteckningar. Ordinerar inte.",
    inte: ["las_journal", "ordinera", "skriv_journal"],
  },
  kommun: {
    namn: "Kommunens personal (simulerad)",
    behov: "Samordnad planering inför utskrivning.",
    risker: "Att en annan huvudman läser regionens journal.",
    atgarder: "Ser bara det regionen har skickat i samordnad planering och läser aldrig journalen.",
    inte: ["las_journal", "las_oversikt", "sok"],
  },
  verksamhetschef: {
    namn: "Verksamhetschef",
    behov: "Utser uppdrag i läkemedelshanteringen, fastställer direktiv, utfärdar utbildarintyg och följer vårdenhetens intyg och signeringslistan.",
    risker: "Att chefsrollen används för att läsa enskilda patienters journaler.",
    atgarder: "Läser inte journalen. Uppgifterna gäller den egna vårdenheten.",
    inte: ["las_journal", "las_oversikt", "ordinera"],
  },
  ekonom: {
    namn: "Ekonom",
    behov: "Hämtar faktureringsunderlag och ändrar prislistor.",
    risker: "Att ekonomiska underlag röjer vårdinnehåll eller skyddade personuppgifter.",
    atgarder: "Läser inte journalen. Underlaget innehåller aldrig namn eller adress för en patient med skyddade personuppgifter.",
    inte: ["las_journal", "las_oversikt", "sok"],
  },
  systemforvaltare: {
    namn: "Systemförvaltare",
    behov: "Ändrar regler och parametrar, förbereder omorganisationer, beslutar om undantag och förvaltar det öppna API:t.",
    risker: "Att ändringar i konfigurationen ger någon åtkomst eller ändrar regler utan kontroll.",
    atgarder: "Läser inte journalen. Ändringar kräver fyra ögon, det vill säga en andra systemförvaltare i sin egen inloggning, och loggas.",
    inte: ["las_journal", "las_oversikt", "ordinera"],
  },
  fysioterapeut: {
    namn: "Fysioterapeut",
    behov: "Läser journalen, skriver anteckningar, registrerar mätvärden och skickar, tar emot och besvarar remisser.",
    risker: "Läsning utan behov och läkemedel som ordineras utanför yrkets ansvar.",
    atgarder: "Ordinerar och ger inga läkemedel. Samma regler för vårdrelation, aktivt val och spärr som för övrig vårdpersonal.",
    inte: ["ordinera", "ge_lakemedel", "nodatkomst"],
  },
  systemkonto: {
    namn: "Systemkonto för en tillämpning",
    behov: "En tillämpning utan inloggad person hämtar avgränsade uppgifter genom det öppna API:t (SMART Backend Services). En organisation som är ansluten via tjänstekontrakt i RIVTA (NPÖ, Journalen och sammanhållen journalföring) läser journalanteckningar och åtgärder för de vårdenheter den är ansluten för.",
    risker: "Att en tillämpning hämtar mer än den behöver, utan en person som ansvarar i stunden. Att journalanteckningar lämnas ut till en organisation som inte ska ha dem.",
    atgarder: "Prövas mot kontots vårdenheter och informationsmängder, aldrig med vårdrelation, med pseudonymer som förval. Kan bara läsa. Journalanteckningar och åtgärder (las_journal) är informationsmängder som bara ett konto för en anslutning via tjänstekontrakt kan få, aldrig ett konto som registreras för det öppna API:t, och aldrig för patienter med skyddade personuppgifter eller spärrade uppgifter.",
    inte: ["skriv_journal", "ordinera", "nodatkomst"],
  },
};

export function markdown() {
  const ut = ['# Behovs- och riskanalys per roll', '', ...INLEDNING.flatMap(s => [s, '']).slice(0, -1)];
  for (const [roll, h] of Object.entries(ROLLER)) {
    const a = ANALYS[roll];
    if (!a) continue;
    ut.push('', `## ${a.namn} (${roll})`, '', `Behov: ${a.behov}`, '', `Risker: ${a.risker}`, '', `Så begränsas risken: ${a.atgarder}`, '',
      `Får inte: ${a.inte.map(x => `\`${x}\``).join(', ')}.`, '', `Handlingar i koden (${h.length}): ${h.map(x => `\`${x}\``).join(', ')}.`);
  }
  return `${ut.join('\n')}\n`;
}
