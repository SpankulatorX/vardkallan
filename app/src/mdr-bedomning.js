// Runda 12, r3 (vårt D10): Vårdkällans egen bedömning per beslutsstödsmodul av om modulen är en medicinteknisk produkt
// enligt MDR (EU) 2017/745, med beslutsträdet i MDCG 2019-11 (vägledning om kvalificering och klassificering av
// programvara) och klassificeringsregel 11 i bilaga VIII. Bedömningen är data här, så att ett test kan stoppa bygget
// om en modul som bedöms inte finns, om ett steg saknas eller om slutsatsen inte följer av stegen. docs/mdr-bedomning.md
// skrivs ur den med scripts/dokument-md.js.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Stegen i beslutsträdet i MDCG 2019-11, avsnitt 3.3, som gäller programvara som inte styr en annan produkt.
export const STEG = [
  ['programvara', 'Steg 1: Är det programvara enligt vägledningens definition?'],
  ['tillbehor', 'Steg 2: Är programvaran ett tillbehör till en medicinteknisk produkt eller driver eller påverkar den användningen av en sådan? Om ja omfattas den av den produkten och bedöms inte här.'],
  ['bearbetar', 'Steg 3: Utför programvaran något annat med data än lagring, arkivering, kommunikation, enkel sökning eller förlustfri komprimering?'],
  ['individ', 'Steg 4: Görs det för enskilda patienters räkning?'],
  ['andamal', 'Steg 5: Har programvaran ett medicinskt ändamål enligt artikel 2.1 i MDR, till exempel diagnos, förebyggande, övervakning, prognos eller behandling?'],
];

const m = (id, namn, filer, andamal, svar, klass, motivering) => ({ id, namn, filer, andamal, svar, klass, motivering });
const J = (programvara, tillbehor, bearbetar, individ, andamal) => ({ programvara, tillbehor, bearbetar, individ, andamal });

export const MODULER = [
  m('journalkarna', 'Journalkärnan', ['src/journal.js', 'src/db.js', 'src/logg.js', 'src/atkomst.js'],
    'Lagra, visa och kommunicera journalanteckningar, diagnoser och mätvärden med behörighet och logg.',
    J(true, false, false, true, false), null,
    'Journalkärnan lagrar, visar, söker och kommunicerar uppgifter utan att räkna fram ny information för ett medicinskt beslut. Steg 3 ger nej, och journalkärnan är därför inte en medicinteknisk produkt. Det är skälet till att beslutsstödet ligger i egna moduler.'),
  m('lakemedelsvarningar', 'Varningar vid ordination', ['src/lakemedel.js'],
    'Pröva en ny ordination mot patientens läkemedel, överkänslighet och njurfunktion och varna för interaktioner, dubbelordination och olämplig dos.',
    J(true, false, true, true, true), 'IIa',
    'Modulen räknar fram varningar för den enskilda patienten som läkaren använder för beslut om behandling. Enligt regel 11 är programvara som ger information för beslut om diagnos eller behandling minst klass IIa. Ett beslut som kan leda till allvarlig försämring eller ingrepp skulle ge klass IIb, men läkaren gör alltid sin egen bedömning och kvitterar varje varning, och modulen ordinerar inget själv.'),
  m('lakemedelsregler', 'Regler för administrering, utsättning och läkemedelsgenomgång', ['src/lakemedelsregler.js'],
    'Kontrollera en administrering mot ordinationen och föreslå åtgärder vid utsättning och i läkemedelsgenomgången.',
    J(true, false, true, true, true), 'IIa',
    'Reglerna prövar data för en enskild patient och ger information för beslut om behandling. Regel 11 ger klass IIa.'),
  m('ordinationsmallar', 'Ordinationsmallar', ['src/ordinationsmallar.js'],
    'Färdiga ordinationer som läkaren väljer och ändrar.',
    J(true, false, false, true, false), null,
    'Mallarna är fastställda texter och värden som visas och kopieras utan beräkning för den enskilda patienten. De motsvarar en enkel sökning i ett bibliotek. Steg 3 ger nej. Kontrollen av ordinationen görs i modulen för varningar.'),
  m('skalor', 'Skalor och beräkningar: NEWS2, GCS, NRS, referensintervall och eGFR', ['src/skalor.js'],
    'Räkna poäng, risknivå och vad som ska göras ur patientens mätvärden, och skatta njurfunktionen ur kreatinin.',
    J(true, false, true, true, true), 'IIa',
    'Beräkningarna ger information för beslut om övervakning och behandling av den enskilda patienten. Regel 11 ger klass IIa.'),
  m('kunskapsstod', 'Kunskapsstöd vid läkemedel och vårdförlopp', ['src/kunskapsstod.js'],
    'Visa riktlinjens steg och substansens egenskaper, och pröva dosering vid nedsatt njurfunktion och olämplighet för äldre mot patientens eGFR och ålder.',
    J(true, false, true, true, true), 'IIa',
    'De allmänna texterna är inte i sig en medicinteknisk produkt, men prövningen mot patientens eGFR och ålder ger patientspecifik information för beslut om behandling. Regel 11 ger klass IIa.'),
  m('cytostatika', 'Dosering av cytostatika', ['src/cytostatika.js'],
    'Räkna doser efter kroppsyta eller njurfunktion, premedicinering och kumulativ dos, och pröva provsvaren innan kuren godkänns.',
    J(true, false, true, true, true), 'IIb',
    'Fel dos av cytostatika kan leda till allvarlig försämring av patientens hälsa. Regel 11 ger då klass IIb för programvara som ger information för beslut om behandling.'),
  m('iva-larm', 'Larmregler i intensivvården', ['src/iva-patientregler.js', 'src/iva.js'],
    'Övervaka vitala parametrar mot avdelningens och patientens egna gränser och larma.',
    J(true, false, true, true, true), 'IIb',
    'Regel 11 säger att programvara för att övervaka vitala fysiologiska parametrar, där variationer kan innebära omedelbar fara för patienten, är klass IIb.'),
  m('vaccinationsprogram', 'Vaccinationsprogram', ['src/vaccinationsprogram-regler.js'],
    'Räkna fram vilka vaccinationer som står i tur för den enskilda patienten enligt programmet.',
    J(true, false, true, true, true), 'IIa',
    'Modulen ger information för beslut om förebyggande behandling av den enskilda patienten. Regel 11 ger klass IIa.'),
  m('tillvaxt', 'Tillväxtkurvor och avvikelser', ['src/tillvaxt.js', 'src/tillvaxt-r11.js'],
    'Räkna standardavvikelser mot referenskurvor och flagga avvikande tillväxt.',
    J(true, false, true, true, true), 'IIa',
    'Beräkningen ger information för beslut om utredning och diagnos av det enskilda barnet. Regel 11 ger klass IIa.'),
  m('uppmarksamhet', 'Förslag till uppmärksamhetsinformation', ['src/uppmarksamhet-regler.js'],
    'Föreslå att en uppgift som redan finns i journalen, till exempel en överkänslighet, visas som uppmärksamhetsinformation.',
    J(true, false, false, true, false), null,
    'Förslagen pekar på uppgifter som redan finns i journalen och visar dem på ett annat ställe, utan att räkna fram ny medicinsk information. Steg 3 ger nej.'),
];

// Slutsatsen ur stegen: en medicinteknisk produkt bara när steg 1, 3, 4 och 5 ger ja och steg 2 ger nej.
export const arMdsw = (s) => Boolean(s.programvara && !s.tillbehor && s.bearbetar && s.individ && s.andamal);

export const finnsFil = (fil, app = join(import.meta.dir, '..')) => existsSync(join(app, fil));

export function markdown() {
  const ja = (v) => (v ? 'Ja' : 'Nej');
  const ut = ['# Bedömning av beslutsstödet enligt MDR', '',
    'Det här är Vårdkällans egen bedömning av om varje beslutsstödsmodul är en medicinteknisk produkt enligt förordningen (EU) 2017/745 om medicintekniska produkter (MDR). Den är inte gjord av ett anmält organ och ersätter inte den bedömning som en tillverkare måste göra innan systemet används i vården. Demon är inte CE-märkt, och alla regler i den är märkta som demoregler.', '',
    'Metoden är beslutsträdet i MDCG 2019-11, vägledningen om kvalificering och klassificering av programvara, och klassificeringsregel 11 i bilaga VIII till MDR. Stegen är:', '',
    ...STEG.map(([, t]) => `- ${t}`), '',
    'En modul är en medicinteknisk produkt när steg 1, 3, 4 och 5 ger ja och steg 2 ger nej. Bedömningen är data i `app/src/mdr-bedomning.js`, och ett test i bygget stoppar bygget om en modul som bedöms inte finns i koden eller om slutsatsen inte följer av stegen.', '',
    '## Sammanställning', '', '| Modul | Filer | Medicinteknisk produkt | Klass |', '| --- | --- | --- | --- |',
    ...MODULER.map(x => `| ${x.namn} | ${x.filer.map(f => `\`${f}\``).join(', ')} | ${arMdsw(x.svar) ? 'Ja' : 'Nej'} | ${x.klass ?? 'Ej tillämpligt'} |`)];
  for (const x of MODULER) {
    ut.push('', `## ${x.namn}`, '', `Avsett ändamål: ${x.andamal}`, '', ...STEG.map(([k, t]) => `- ${t.split(':')[0]}: ${ja(x.svar[k])}`), '',
      `Slutsats: ${arMdsw(x.svar) ? `medicinteknisk produkt, klass ${x.klass}` : 'inte en medicinteknisk produkt'}. ${x.motivering}`);
  }
  ut.push('', '## Vad bedömningen betyder för arkitekturen', '',
    'Journalkärnan är inte en medicinteknisk produkt och ligger skild från beslutsstödet. Varje beslutsstöd som är en medicinteknisk produkt ligger i en egen modul, så att den kan valideras, versioneras och CE-märkas för sig utan att journalkärnan omfattas. Innan beslutsstödet används i vården behöver tillverkaren ett kvalitetsledningssystem, en klinisk utvärdering och ett anmält organ för klass IIa och IIb.');
  return `${ut.join('\n')}\n`;
}
