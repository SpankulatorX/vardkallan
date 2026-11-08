// Plan för införande av tillväxt och barnhälsovård (Sussa 11.3.1.1 och 11.3.1.5, runda 7, r6). Planen har de delar som
// Sussa kräver i 11.3.1.1. Den är ett förslag från projektet och är inte överenskommen med någon region. Veckorna räknas
// från beslutet om införande.
export const DELAR_11_3_1_1 = ['Organisation och kompetens', 'Leveransobjekt', 'Tid- och aktivitetsplan', 'Milstolpar', 'Roller och ansvar', 'Testaktiviteter',
  'Utbildningsaktiviteter', 'Övergripande risker', 'Ändringshantering', 'Förväntningar på beställaren', 'Beställarens aktiviteter'];

export const PLAN = {
  rubrik: 'Plan för införande av tillväxt och barnhälsovård',
  status: 'Förslag från projektet. Inte överenskommet med någon beställare.',
  delar: [
    { rubrik: 'Organisation och kompetens', text: 'En införandegrupp med en projektledare, en utvecklare med kunskap om FHIR och kvalitetsregister, en BHV-sjuksköterska och en barnläkare från den centrala barnhälsovården som verksamhetsföreträdare, och en informationssäkerhetssamordnare.' },
    { rubrik: 'Leveransobjekt', text: 'Tillväxtkurvor med en referens som regionen har licens för, larmregler som den centrala barnhälsovården har fastställt, besöks- och vaccinationsprogrammet med regionens tidsfönster, rapporteringen till Svenska barnhälsovårdsregistret mot registrets riktiga mottagare och migrering av tidigare tillväxtdata.' },
    { rubrik: 'Tid- och aktivitetsplan', text: 'Vecka 1 till 4: val av referens och licens, fastställande av larmregler och tidsfönster. Vecka 5 till 10: konfiguration, migrering i testmiljö och anslutning till registrets testmottagare. Vecka 11 till 12: acceptanstest och utbildning. Vecka 13: start på en barnavårdscentral. Vecka 14 till 20: övriga barnavårdscentraler.' },
    { rubrik: 'Milstolpar', text: 'M1 referens och regler fastställda (vecka 4). M2 migreringen avstämd i testmiljön (vecka 10). M3 acceptanstest godkänt (vecka 12). M4 första barnavårdscentralen i drift (vecka 13). M5 alla barnavårdscentraler i drift och första utskicket till registret kvitterat (vecka 20).' },
    { rubrik: 'Roller och ansvar', text: 'Den centrala barnhälsovården beslutar om referens, larmregler och program. Vårdgivaren är lokalt personuppgiftsansvarig för utlämnandet till registret och godkänner den tekniska lösningen. Projektet bygger, testar och dokumenterar. Registerhållaren ansvarar för mottagaren.' },
    { rubrik: 'Testaktiviteter', text: 'De automatiska testerna i bygget, ett jämförande test där regionens referensvärden räknas om och jämförs med registrets eller kurvbladens, användartest med BHV-sjuksköterskor enligt klickbudgeten, test av rapporteringen mot registrets testmottagare och behörighetstest med spärr, skyddad identitet och barn på andra vårdenheter.' },
    { rubrik: 'Utbildningsaktiviteter', text: 'En kort utbildning för BHV-sjuksköterskor och BVC-läkare i demoläget med regionens referens, och information till vårdnadshavare om mätningar hemma i Min journal.' },
    { rubrik: 'Övergripande risker', text: 'Licensen för de svenska referenserna kan dröja, och då används WHO:s standard längre. Larmregler som inte är förankrade ger för många eller för få larm. Migrerade mätningar kan ha fel enhet; kontrollen före utskick och kontrollen av orimliga värden fångar dem. Registrets mottagare kan ändra format.' },
    { rubrik: 'Ändringshantering', text: 'Ändringar i referens, larmregler, tidsfönster och vaccinationsprogram görs som versioner med giltighetsdatum och godkänns av den centrala barnhälsovården, och varje ändring prövas med de automatiska testerna innan den tas i drift.' },
    { rubrik: 'Förväntningar på beställaren', text: 'Att beställaren tar fram eller köper licens för den referens som ska användas, fastställer larmregler och tidsfönster, utser verksamhetsföreträdare och ger tillgång till registrets testmottagare och till tidigare tillväxtdata för migreringen.' },
    { rubrik: 'Beställarens aktiviteter', text: 'Beslut om referens och regler, deltagande i acceptanstestet, utbildning av medarbetarna, information till vårdnadshavare och uppföljning efter start med de indikatorer som uppföljningen på barnavårdscentralen visar.' },
  ],
};
