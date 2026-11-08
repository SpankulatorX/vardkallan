// Testerna för beställning och svar och för kontrollerna till avdelningen (runda 8, r1), gemensamma för mappningen av
// Sussa 4.4.1, 4.4.2, 4.4.3 och 12.1.1.9.
import { klickbudgetTest } from '../krav.js';
import { FLODEN } from '../klickbudget.js';
import { TESTFALL, testfallTest } from '../sussa-testfall.js';

const BS = 'Beställning och svar > ';
const SE = 'Streckkod och etikett > ';
const FB = 'FHIR för beställning och svar > ';
const AB = 'API för beställning och svar > ';
const KA = 'Kontroller till avdelningen > ';
const AK = 'API för kontroller och planerade uppgifter > ';
const kb = (id) => klickbudgetTest(FLODEN.find(f => f.id === id));
const testfall = (nr) => { const x = TESTFALL.find(t => t.nr === nr); return x.korningar.map(k => testfallTest(x, k)); };

export const T = {
  paket: `${BS}ett paket beställs med ett klick: systemet föreslår det ur vårdkontakten och väljer laboratorium, rör, provtagningsordning och anamnes`,
  flerLab: `${BS}klinisk kemi har flera utförande laboratorier, och systemet väljer det som hör till sjukhuset`,
  unikt: `${BS}beställnings-id:t är unikt och återanvänds aldrig, inte heller efter makulering eller radering`,
  dubbDold: `${BS}dubblettvarningen räknas bara på det läkaren får se: en dold rad på en spärrad enhet ändrar inget i svaret`,
  dubb: `${BS}ett prov som nyss är taget eller redan är beställt tas bort ur paketet med en förklaring, och en ny beställning kräver kvittens`,
  dubbHistorik: `${BS}en beställning trots dubblettvarning sparar bara analysnamnen, så att historiken inte röjer ett svar som en kollega inte får se`,
  nycklar: `${BS}nycklar som constructor, __proto__ och toString är aldrig analyser, paket, laboratorier, kontroller eller frekvenser`,
  signeraBehorighet: `${BS}signeringen prövar behörigheten först och nämner inte den ansvariga läkaren för den som inte får se beställningen`,
  uppdrag: `${BS}sjuksköterskan och undersköterskan beställer på uppdrag av en läkare på vårdenheten, som signerar i inkorgen`,
  provtagning: `${BS}provtagningen registreras med ett klick per rör, systemet sätter tid och provtagare och skickar när alla rör är tagna`,
  svar: `${BS}laboratoriet svarar efter svarstiden: svaren blir mätvärden med NPU-kod, referensintervall och avvikelse, och hamnar hos den beställande läkaren`,
  kritisk: `${BS}ett kritiskt svar larmar den ansvariga läkaren och sjuksköterskorna på den beställande vårdenheten, men ingen annan`,
  vidimera: `${BS}vidimeringen görs av den ansvariga läkaren med ett klick, och Min journal visar svaret därefter`,
  folja: `${BS}beställningen kan följas från upprättande till avslut med vem och när för varje steg`,
  makulera: `${BS}makulering kräver orsak och går inte efter svar, och en analys tas bort eller läggs till innan röret är taget`,
  overlat: `${BS}ansvaret överlåts till en annan läkare, som får svaren att vidimera, men bara om läkaren har vårdrelation till patienten`,
  etiketter: `${BS}etiketterna har streckkod med etikett-id, beställnings-id och analyser, och skyddad identitet visas bara efter ett aktivt val`,
  anvisning: `${BS}provtagningsanvisningen har rören i provtagningsordning och förberedelserna för patienten`,
  samman: `${BS}beställningarna följer med när två journaler slås samman, så att allt för patienten visas samlat`,
  konfig: `${BS}paketens innehåll och laboratoriets svarstid ändras på ett ställe och slår igenom i förslagen och svaren`,
  uppfoljning: `${BS}uppföljningen av kvalitet och produktion räknar antal och ledtider utan personuppgifter`,
  katalog: `${BS}katalogen: varje analys har rör och disciplin, varje labbvärde har NPU-kod och varje paket har kända analyser`,
  code128: `${SE}Code 128 B: varje mönster är 11 moduler, kontrollsiffran räknas enligt standarden och stoppkoden avslutar`,
  pdf: `${SE}etiketterna som PDF: en sida per etikett för etikettskrivaren och ett A4-ark för en vanlig skrivare`,
  fhir: `${FB}varje analys är en ServiceRequest med beställnings-id:t, varje rör en Specimen och varje svar en DiagnosticReport med mätvärdena`,
  fhirBehorighet: `${FB}samma behörighet som i gränssnittet: en annan vårdenhets beställning kräver aktivt val och en spärrad syns inte alls`,
  apiFlode: `${AB}läkaren beställer, sjuksköterskan tar proverna, demoknappen ger svaret och läkaren vidimerar från inkorgen`,
  apiLista: `${AB}provtagningslistan visar vårdenhetens prover att ta, med skyddad identitet maskerad, och loggar varje patient`,
  apiSparr: `${AB}en spärrad beställning som har överlåtits till en annan vårdenhets läkare röjs inte i inkorgen`,
  kontroll: `${KA}läkaren ordinerar puls, blodtryck, SR, temperatur, vikt och vätskebalans till i morgon klockan 7, och systemet lägger dem på avdelningen där patienten ligger`,
  kontrollUppgift: `${KA}kontrollerna blir uppgifter med tid för sjuksköterskan, och ett registrerat mätvärde bockar av kontrollen utan något mer`,
  planerat: `${KA}de planerade uppgifterna per vårdenhet och dag har formatet i docs/design.md och visar bara det som den inloggade får se`,
  apiKontroll: `${AK}läkaren ordinerar kontroller och sjuksköterskan hämtar avdelningens planerade uppgifter, och varje patient loggas`,
  kbPaket: kb('bestall-paket'),
  kbProv: kb('registrera-provtagning'),
};
export const TESTFALL_3 = Object.fromEntries(['3.1', '3.2', '3.3', '3.4', '3.5'].map(nr => [nr, testfall(nr)]));
