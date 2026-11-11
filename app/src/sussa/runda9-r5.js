// Runda 9, r5: tilläggen till posterna i Sussa 5.2, 5.3, 5.4.2 och KD1.1 för inloggningen med biljett, behörigheten ur
// masterdata, skyddsbehovet, signeringen och certifikaten, säkerhetsarkitekturen, e-arkivet, gallringsreglerna och
// miljöerna. Mappningsfilerna lägger tilläggen härifrån ovanpå sina egna poster med medR9r5, så att ändringen ligger
// samlad här. tester läggs till postens egna, och de andra fälten ersätter postens.
import { T } from './runda9-r5-tester.js';
import { HOTMODELL_TESTER } from '../hotmodell.js';

export { T };

const POSTER = {
  '5.2.1.6': {
    avsedd: 'uppfyllt_demo',
    tester: [T.idp, T.falsk, T.engang, T.uppdrag, T.konf],
    losning: 'Personalen loggar in genom en autentiseringstjänst (IdP) med OpenID Connect. Tjänsten autentiserar personen med SITHS-kortet i samma webbläsare (in-band, tillitsnivå 3) och utfärdar en id-biljett, en JWT signerad med ES256, med personens HSA-id, medarbetaruppdragets HSA-id och ändamål, vårdenheten, vårdgivaren och yrkesrollen. Vårdkällan tar inloggningen och behörigheten ur biljettens attribut och prövar dem mot masterdata i varje anrop. API:erna för externa tillämpningar använder OAuth 2.0 med åtkomstbiljetter (Bearer), där omfånget bara kan minska behörigheten. Allt går över HTTP med standardprotokollen.',
    expert: 'Personen väljer aldrig uppdrag, vårdenhet eller behörighet. Systemet läser dem ur biljetten, kontrollerar dem mot katalogen och säger på vanlig svenska vad som är fel och vem som kan rätta det, och en biljett som inte går att lita på avvisas med orsaken i säkerhetsloggen.',
    anmarkning: 'Autentiseringstjänsten är simulerad i demon, och valet av demoroll är det simulerade SITHS-kortet. Biljetten utfärdas på servern, inte genom en omdirigering till tjänsten. Utfärdarens nyckel skapas när servern startar. SAML, utloggning hos tjänsten, autentisering med en annan enhet (out-of-band) och federation med andra legitimationer som BankID eller eIDAS finns inte.',
  },
  '5.2.1.8': {
    avsedd: 'uppfyllt_demo',
    tester: [T.ny, T.andrad, T.inaktiv, T.uppdrag],
    losning: 'Behörigheten räknas ur masterdata: yrkesrollen ger handlingarna (rollerna i behörighetsmotorn), vårdenheten ger den inre sekretessen och vårdrelationen ger åtkomsten till patienten. Personal och organisation synkroniseras från källan, och en ny person kan logga in med en biljett utan att någon lägger upp något. Ändamålet med behandlingen följer rollen (vård och behandling, kvalitetssäkring, statistik eller administration) och måste stå i medarbetaruppdraget. Ändras yrke eller vårdenhet i källan, eller blir personen inaktiv, upphör inloggningen vid nästa anrop.',
    expert: 'Ingen administratör lägger upp, ändrar eller tar bort behörigheter. Systemet räknar ut dem ur katalogen i varje anrop och loggar ut den vars uppdrag har upphört, med orsaken på vanlig svenska.',
    anmarkning: 'Källan i demon är seeden genom filadaptern. Regelverket för attributen (rollerna och ändamålen) finns i koden och ändras inte i gränssnittet.',
  },
  '5.3.1.2': {
    avsedd: 'uppfyllt_demo',
    tester: [T.klassning, T.sbLogg, T.sbStickprov,
      'Vårdplan > åtgärden registreras av den ansvariga yrkesrollen, och daglig vikt ses av systemet i mätvärdena',
      'Vårdplan > inre sekretess, spärr och nödåtkomst gäller vårdplanerna',
      'Samordnad planering > kommunen ser bara det som har skickats till den och når ingen journal',
      'Tvångsvård > inre sekretess: en annan vårdenhet ser tvångsvården bara efter aktivt val, och en spärr döljer allt',
      'Vårdkontakt > nödåtkomst ger ingen vårdrelation genom en kontakt som systemet skapar eller som registreras'],
    losning: 'Varje uppgift hör till en vårdenhet (organisation), en vårdkontakt, ett vårdtillfälle, ett hälsoärende eller en tvångsvårdsperiod (process) och, för vårdplaner och samordnad planering, en plan. Varje informationstyp har en klassning av skyddsbehovet i tre nivåer: grundläggande, högt för alla patientuppgifter och mycket högt för tvångsvård, spärrade uppgifter, skyddade personuppgifter och åtkomstloggen. Skyddet följer organisation, yrkesroll, process och plan: inre sekretess och spärr per vårdenhet, handlingar per yrkesroll, beslutsjournalen bara med handlingen för tvångsvård, en vårdplans åtgärd bara för den ansvariga rollen och kommunen bara det som har skickats i planeringen. Åtkomst till uppgifter med mycket högt skyddsbehov kan tas fram för sig i logguppföljningen och tas alltid med i stickprovet.',
    expert: 'Ingen användare behöver avgöra vad som är känsligt. Klassningen och strukturen avgör skyddet, en ny informationstyp får nivån högt av sig själv, och systemet ser till att åtkomsten till det mest skyddsvärda alltid kontrolleras.',
    anmarkning: 'Klassningen finns i koden (skyddsbehov.js) och ändras inte i gränssnittet.',
  },
  '5.3.1.5': {
    avsedd: 'uppfyllt_demo',
    tester: [T.nll, T.andrat, T.labbsvar, T.bevisTrigger, T.bevisApi, T.leverans],
    losning: 'Meddelanden till och från andra organisationer signeras med avsändarens certifikat (ECDSA P-256 med SHA-256) över ett huvud med meddelandets id, typ, parter, tid och SHA-256 av innehållet. Mottagaren kontrollerar signaturen och certifikatet och svarar med en kvittens som den signerar med sitt certifikat. Det gäller förskrivningar till läkemedelslistan, svaren från laboratoriet och leveranser till e-arkivet. Beviset (huvudet, signaturen, certifikatkedjan och kvittensen, men inte innehållet) sparas i en tabell som inte kan ändras eller raderas och kan kontrolleras i efterhand mot journalens innehåll.',
    expert: 'Systemet signerar, kontrollerar och sparar beviset av sig självt när meddelandet skickas eller tas emot. Ingen användare signerar eller väljer certifikat, och ett meddelande som inte går att lita på tas inte emot, med orsaken på vanlig svenska.',
    anmarkning: 'Motparterna är simulerade i samma server. Remisser till vårdgivare utanför Vårdkällan och svaren från de nationella tjänsterna i tjänstekontrakten signeras inte, och signaturen följer inget nationellt format som XAdES.',
  },
  '5.3.1.8': {
    avsedd: 'uppfyllt_demo',
    tester: [T.kedja, T.utgang, T.part, T.aterkalla, T.labbsvar],
    losning: 'Vårdkällan och instanserna som den utbyter meddelanden med (det simulerade laboratoriet, läkemedelslistan och e-arkivet) har X.509-certifikat från en utfärdare för tjänster, som är utfärdad av en rotutfärdare. Certifikaten används för att autentisera avsändaren och för den elektroniska underskriften på meddelandena. Kedjan kontrolleras mot listan över betrodda utfärdare, och ett certifikat som har gått ut, inte gäller ännu, är återkallat, tillhör en annan instans eller är utfärdat av någon annan än en utfärdare godtas inte. Systemförvaltaren ser certifikaten och kan återkalla ett i sandlådans spärrlista.',
    expert: 'Systemet kontrollerar kedjan, giltigheten och spärrlistan för varje meddelande och säger varför ett certifikat inte godtas. Ingen behöver kunna certifikat för att se om en motpart går att lita på.',
    anmarkning: 'Rotutfärdaren är en test-CA som står för den publikt erkända utfärdaren. Den skapas när servern startar och är inte publikt erkänd. Certifikaten används för signerade anrop och inte för ömsesidig TLS mellan instanserna, och spärrlistan är en lista per sandlåda och inte en CRL eller OCSP.',
  },
  '5.3.1.18': {
    avsedd: 'uppfyllt_demo',
    tester: [T.hotmodell, T.principer, ...HOTMODELL_TESTER],
    losning: 'Säkerhetsarkitekturen är beskriven på konceptuell nivå i docs/sakerhetsarkitektur.md, med en hotmodell (hotmodell.js) för yttre och inre hot där varje hot pekar på kontrollen som möter det, principen i kravtexten och testerna som visar att kontrollen fungerar. All behörighetskontroll sker på servern, journalen, loggarna och bevisen skyddas av databastriggrar och hashkedjor, anrop från andra webbplatser avvisas, inloggningen tar behörigheten ur en signerad biljett och prövar den mot masterdata, meddelanden till andra organisationer signeras och kvitteras, och logguppföljningen och säkerhetsloggen visar det som har hänt.',
    expert: 'Säkerheten ligger i servern och databasen och inte i användarens val, så den gäller oavsett hur systemet anropas. Hotmodellens tester körs i varje bygge, så en kontroll som slutar fungera stoppar bygget.',
    anmarkning: 'Ingen extern säkerhetsgranskning eller penetrationstest är gjord.',
  },
  '5.4.2.3': {
    avsedd: 'uppfyllt_demo',
    tester: [T.index, T.leverans, T.avvisad, T.skilda],
    losning: 'Exportpaketet följer FGS Paketstruktur 2.0 med journalen i sitt ursprungliga innehåll som HL7 FHIR R4, med alla versioner av rättade anteckningar, och metadata i METS och PREMIS. Varje journalhandling har en post i ett index med e-arkivets dataelement, och mappningen från Vårdkällans dataelement till e-arkivets står i paketets dokumentation. Leveransen skickas med ett signerat manifest, och e-arkivet gör en mottagningskontroll (METS.xml, kontrollsummor, mappar och obligatoriska dataelement) och svarar med en signerad kvittens. Journalhandlingarna ligger skilda från åtkomstloggen, som inte är en journalhandling.',
    expert: 'Arkivarien trycker på Leverera till e-arkivet. Systemet bygger paketet, mappar varje journalhandling mot e-arkivets dataelement, skickar och visar om e-arkivet tog emot paketet och annars vad som var fel.',
    anmarkning: 'E-arkivet är simulerat, och dess dataelement är en förenklad uppsättning i demon och inte R7e-arkivets eller en verklig leveransöverenskommelse. XML-schemana för METS ligger i mappen schemas, och paketet är prövat med E-ARK:s validator med öppen källkod (commons-ip 2.12.1 mot CSIP 2.1.0) utan fel (docs/earkiv-validering.md).',
  },
  '5.4.2.4': {
    avsedd: 'uppfyllt_demo',
    tester: [T.regler, T.delar, T.delarLogg],
    losning: 'Gallring efter ett registrerat gallringsbeslut, med regler per informationsmängd: hela journalen tio år efter den sista uppgiften när ingen kontakt pågår (patientdatalagen 3 kap. 17 §), mätvärden ett antal år efter mätningen och kallelser och påminnelser ett antal år efter att de skickades. Reglerna är parametrar som systemförvaltaren ändrar under Regler och parametrar med fyra ögon och giltighetsdatum, och systemet vägrar värden under lagens gräns med en förklaring. Beslutet tar med reglerna som de gäller när det registreras. Arkivarien ser underlaget med hela journaler och delar av journaler, och verkställer. Gallringen loggas per journal med antal och utan innehåll, och åtkomstloggen ändras inte.',
    expert: 'Systemet räknar fram underlaget ur reglerna och uppgifternas datum, så att ingen behöver leta fram journaler eller kunna bevarandetiderna, och det tar bort det som pekar på en gallrad uppgift i samma steg.',
    anmarkning: 'Informationsmängderna som kan gallras för sig är mätvärden och kallelser. Fler mängder, till exempel tidboken, kräver ett tillägg i koden.',
  },
  'KD1.1.1.5': {
    avsedd: 'delvis',
    tester: [T.acceptans, T.fiktiva, T.markt, T.miljoTak],
    losning: 'Systemförvaltaren skapar en acceptanstestmiljö, en utbildningsmiljö eller en testmiljö ur en kopia av produktionsmiljön med ett klick. Acceptanstestmiljön är en kopia med skarpa data där systemet avidentifierar patientuppgifterna: namn, personnummer och andra identiteter, adress, telefon och kontaktperson byts överallt, också i fritext, och loggarna börjar om. Utbildnings- och testmiljön har fiktiva patienter med reglerna, parametrarna och de andra gemensamma inställningarna kopierade från produktionen. Varje miljö är märkt överst på varje sida och i API:t.',
    expert: 'Systemförvaltaren väljer bara vilken miljö som behövs. Systemet vet vad som är patientuppgifter, byter ut dem och kontrollerar att inget som pekar ut en patient följer med.',
    anmarkning: 'I demon är produktionsmiljön besökarens sandlåda, och miljöerna är nya sandlådor på samma server. Dimensioneringen för 100 och 500 samtidiga användare och SLA:erna för övriga miljöer gäller driften och är inte prövade. Kravet är formulerat som ett åtagande för anbudsgivaren.',
  },
};

// Lägger rundans tillägg ovanpå avsnittets poster.
export const medR9r5 = (poster) => poster.map(x => {
  const p = POSTER[x.id];
  if (!p) return x;
  const { tester = [], ...ovrigt } = p;
  return { ...x, ...ovrigt, tester: [...new Set([...(x.tester ?? []), ...tester])] };
});
