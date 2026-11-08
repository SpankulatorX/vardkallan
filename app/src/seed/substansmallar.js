// Läkemedelsmallar per substans (ATC), Sussa 3.5.1.3. Grunddata i demon: mallarna läggs in i tabellen substansmallar
// (lakemedelsansvar-schema.js) som version 1, och en mall används först när vårdenhetens mallansvariga läkare har
// godkänt den (Gröna häftet 688488 R5 avsnitt 1.4.3). Förslagen är demoregler.
// form är beredningsformens grupp (ordinationsmallar.FORMGRUPPER), peroral om den inte anges, och varianter gäller
// andra former och styrkor (runda 8, r4). dos i produktens enhet, tider som klockslag, uppfoljning i dagar, volym i ml per dos för
// vätskebalansen när läkemedlet ges i en infusion. Patienten kan ändra förslaget: aldre gäller från 75 år, egfr under 30.
export const MALLAR = {
  // Runda 8, r4: mallen gäller 500 mg tabletter och har varianter för 1 g tabletter och för infusion, så att systemet
  // föreslår doseringen ur produkten. Den räknas inte om för andra styrkor, eftersom högsta antal tabletter per dygn då
  // skulle ändra högsta dosen.
  N02BE01: { namn: 'Paracetamol vid behov', dosering: '1 till 2 tabletter vid behov, högst 8 tabletter per dygn', dos: 500, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 7, skalas: false,
    aldre: { dosering: '1 till 2 tabletter vid behov, högst 6 tabletter per dygn', varfor: 'Från 75 år föreslås högst 3 gram paracetamol per dygn.' },
    varianter: [
      { styrka: '1 g', namn: 'Paracetamol 1 g vid behov', dosering: '1 tablett vid behov, högst 4 tabletter per dygn', dos: 1000, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 7,
        aldre: { dosering: '1 tablett vid behov, högst 3 tabletter per dygn', varfor: 'Från 75 år föreslås högst 3 gram paracetamol per dygn.' } },
      { form: 'infusion', namn: 'Paracetamol intravenöst', dosering: '1 g (100 ml) som intravenös infusion under 15 minuter, engångsdos', dos: 1000, dosEnhet: 'mg', typ: 'tillfallig', uppfoljning: 1, volym: 100, engangs: true },
    ] },
  A02BC01: { namn: 'Omeprazol 20 mg', dosering: '1 kapsel på morgonen', dos: 20, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 14 },
  C07AB02: { namn: 'Metoprolol depot', dosering: '1 tablett på morgonen', dos: 50, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 14 },
  C03CA01: { namn: 'Furosemid', dosering: '1 tablett på morgonen', dos: 40, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 3 },
  B01AB04: { form: 'injektion', namn: 'Tromboprofylax med dalteparin', dosering: '1 injektion subkutant kl 18', dos: 5000, dosEnhet: 'IE', tider: ['18'], typ: 'tillfallig', uppfoljning: 7,
    egfr: { dosering: '1 injektion subkutant kl 18. Kontrollera anti-Xa vid nedsatt njurfunktion', varfor: 'eGFR under 30: dalteparin kan ansamlas, och anti-Xa bör kontrolleras.' } },
  B01AB05: { form: 'injektion', namn: 'Tromboprofylax med enoxaparin', dosering: '1 injektion subkutant kl 18', dos: 40, dosEnhet: 'mg', tider: ['18'], typ: 'tillfallig', uppfoljning: 7,
    egfr: { dosering: '20 mg subkutant kl 18', dos: 20, varfor: 'eGFR under 30: dosen av enoxaparin föreslås halverad.' } },
  J01CE01: { form: 'infusion', namn: 'Bensylpenicillin intravenöst', dosering: '3 g intravenöst 3 gånger per dygn, löst i 100 ml natriumklorid', dos: 3, dosEnhet: 'g', tider: ['06', '14', '22'], typ: 'tillfallig', uppfoljning: 3, volym: 100 },
  N02AA01: { form: 'injektion', namn: 'Morfin intravenöst vid behov', dosering: '2,5 till 5 mg intravenöst vid behov, minst 4 timmar mellan doserna', dos: 2.5, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 3,
    aldre: { dosering: '1 till 2,5 mg intravenöst vid behov, minst 4 timmar mellan doserna', dos: 1, varfor: 'Från 75 år föreslås en lägre startdos av morfin.' } },
  J01CA04: { namn: 'Amoxicillin', dosering: '1 tablett 3 gånger dagligen', dos: 750, dosEnhet: 'mg', tider: ['08', '14', '20'], typ: 'tillfallig', uppfoljning: 7 },
  A10BA02: { namn: 'Metformin', dosering: '1 tablett morgon och kväll', dos: 500, dosEnhet: 'mg', tider: ['08', '20'], typ: 'staende', uppfoljning: 30 },
  C10AA05: { namn: 'Atorvastatin', dosering: '1 tablett till kvällen', dos: 40, dosEnhet: 'mg', tider: ['20'], typ: 'staende', uppfoljning: 60 },
  B01AC06: { namn: 'Acetylsalicylsyra 75 mg', dosering: '1 tablett på morgonen', dos: 75, dosEnhet: 'mg', tider: ['08'], typ: 'staende', uppfoljning: 30 },
  // Runda 8, r4: glukos med elektrolyter som basvätska i en infusion, där en tillsats läggs till i ordinationen.
  B05BA03: { form: 'infusion', namn: 'Glukos med elektrolyter', dosering: '', dos: 1000, dosEnhet: 'ml', typ: 'tillfallig', uppfoljning: 1 },
  N05CF01: { namn: 'Zopiklon vid behov', dosering: '1 tablett till natten vid behov', dos: 5, dosEnhet: 'mg', typ: 'vid_behov', uppfoljning: 14,
    aldre: { dosering: 'En halv tablett till natten vid behov', dos: 2.5, varfor: 'Från 75 år föreslås halv dos zopiklon, och sömnmedel ökar risken för fall.' } },
};

