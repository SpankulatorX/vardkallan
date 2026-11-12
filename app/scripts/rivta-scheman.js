// Runda 14, r2: hämtar tjänstekontraktens scheman (RIVTA) till app/rivta/<domän>/ från en pinnad version i
// https://bitbucket.org/rivta-domains, och skriver KALLA.json med källan, taggen, commit och sha256 för varje fil.
// Schemana är licensierade under Apache License 2.0 (se huvudet i varje fil). Bara schemafilerna, WSDL och XML-filerna
// (exempel och villkoren för engagemangsindex) i katalogen schemas/ tas med, utan HL7 CDA, som inget av kontrakten här
// använder. Filerna är data: de läses av valideringen i src/rivta/xsd.js och körs aldrig.
//
//   node scripts/rivta-scheman.js          hämtar alla domäner och skriver om KALLA.json
//   node scripts/rivta-scheman.js --prova  kontrollerar bara att filerna stämmer med KALLA.json
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, existsSync, mkdtempSync, cpSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROT = join(dirname(new URL(import.meta.url).pathname), '..', 'rivta');

// Domän, tagg och commit. Commit är det som pinnar; taggen står med för att kunna läsas av människor.
export const DOMANER = [
  ['riv.clinicalprocess.healthcond.description', '2.1.19', '9ad620ea8cddde2e02c5a1da69e9102b1b959914'],
  ['riv.clinicalprocess.logistics.logistics', '2.0.7', '42851358d799b89756fc55fbf64c7ee01c067a3d'],
  ['riv.clinicalprocess.healthcond.basic', '1.2.3', '55a953227545bf0500cb7976f01152773b0f6bec'],
  ['riv.clinicalprocess.activity.actions', '1.3.6', '02b15bdee612ae4c9998678edf5c31453a6a3d71'],
  ['riv.clinicalprocess.healthcond.actoutcome', '3.1.10', '7c07a857587fbf8e4484f586d045d2c366a9ace6'],
  ['riv.clinicalprocess.activityprescription.actoutcome', '2.2.2', 'a0f633712d0bdd3a65edf7b8972704dad24a9663'],
  ['riv.itintegration.engagementindex', '1.0.10', 'feef3879647a74344c55b62bead12ce2748aa841'],
  ['riv.ehr.blocking', 'ehr_blocking_3.2.2', '558d8574eefc7e5e2d0d342d882de15424d72690'],
  ['riv.ehr.patientconsent', 'ehr_patientconsent_1.0.1_RC1', '70440f0fcd082825826b9bc9acd4f6144df07ba7'],
  ['riv.infrastructure.directory.employee', '4.0.1', '0f9fd6418f2b0d7cde44e4cc6a61db856c8a861e'],
  ['riv.population.residentmaster', 'population_residentmaster_1.2', '9c8dd64e666fc9d474f622db2c8b041a20a414ef'],
  ['riv.ehr.accesscontrol', '1.0.6', '4167090fb46b9c24f13b83ecfdf4e95efcc0e86f'],
];
// Runda 14, r3: intyg, e-remiss, remisstatus, Infektionsverktyget, NKRR, formulär, 1177 och dos.
DOMANER.push(
  ['riv.clinicalprocess.healthcond.certificate', '4.0.5', '277a809399ecc9d7bee85ef1792c00c0c7e41076'],
  ['riv.clinicalprocess.activity.request', '2.3', '3fc7315e4628d7468d6c5be80ce8dcf987315dc9'],
  ['riv.crm.requeststatus', '2.0.2', 'd487f21af1b21e446210a36324aadaca7263f652'],
  ['riv.processdevelopment.infections', '1.0.2', '869d30d9a0f8adc676e052edb3f7e2141dc6aeb0'],
  ['riv.followup.qualityregistry.nkrr', '1.2.2', 'edc9ed9be6295303470de067aa8bd7518993137f'],
  ['riv.infrastructure.eservicesupply.forminteraction', '2.1.1', '3dbee167710a60606e6560bbf6d3e6d320dbf128'],
  ['riv-application.infrastructure.eservicesupply.patientportal', '2.0', '444af395016bd6c97d1b6ca26014c5890359f0e7'],
  ['riv.druglogistics.dosedispensing', 'TD_DRUGLOGISTICS_DOSEDISPENSING_1_1_0', 'ff5de62545f2bee995c5361272027758b504de91'],
);
// Runda 14, r3: --doman <namn> hämtar bara den domänen (kan anges flera gånger), så att de andra domänerna står kvar.
const VALDA = process.argv.flatMap((a, i, l) => (a === '--doman' && l[i + 1] ? [l[i + 1]] : []));

const sha = (b) => createHash('sha256').update(b).digest('hex');
function filer(k) {
  const ut = [];
  const ga = (d) => { for (const n of readdirSync(d).sort()) { const f = join(d, n); if (statSync(f).isDirectory()) ga(f); else ut.push(f); } };
  if (existsSync(k)) ga(k);
  return ut;
}

export function prova() {
  const fel = [];
  for (const [domän] of DOMANER) {
    const k = join(ROT, domän);
    const kalla = JSON.parse(readFileSync(join(k, 'KALLA.json'), 'utf8'));
    const finns = filer(join(k, 'schemas')).map(f => relative(k, f));
    for (const [f, h] of Object.entries(kalla.filer)) {
      if (!finns.includes(f)) fel.push(`${domän}: ${f} saknas`);
      else if (sha(readFileSync(join(k, f))) !== h) fel.push(`${domän}: ${f} har ändrats`);
    }
    for (const f of finns) if (!Object.hasOwn(kalla.filer, f)) fel.push(`${domän}: ${f} står inte i KALLA.json`);
  }
  return fel;
}

async function hamta() {
  const arbete = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'rivta-'));
  try {
    for (const [domän, tagg, commit] of DOMANER) {
      if (VALDA.length && !VALDA.includes(domän)) continue;
      const url = `https://bitbucket.org/rivta-domains/${domän}/get/${commit}.tar.gz`;
      const svar = await fetch(url);
      if (!svar.ok) throw new Error(`${url}: ${svar.status}`);
      const arkiv = Buffer.from(await svar.arrayBuffer());
      const ut = join(arbete, domän);
      mkdirSync(ut, { recursive: true });
      writeFileSync(join(arbete, `${domän}.tar.gz`), arkiv);
      execFileSync('tar', ['-xzf', join(arbete, `${domän}.tar.gz`), '-C', ut, '--strip-components=1']);
      const mal = join(ROT, domän);
      rmSync(join(mal, 'schemas'), { recursive: true, force: true });
      mkdirSync(mal, { recursive: true });
      cpSync(join(ut, 'schemas'), join(mal, 'schemas'), { recursive: true, filter: (f) => !/[\\/]hl7cda([\\/]|$)/.test(f) && (statSync(f).isDirectory() || /\.(xsd|wsdl|xml)$/.test(f)) });
      const lista = Object.fromEntries(filer(join(mal, 'schemas')).map(f => [relative(mal, f), sha(readFileSync(f))]));
      writeFileSync(join(mal, 'KALLA.json'), `${JSON.stringify({
        domän, källa: `https://bitbucket.org/rivta-domains/${domän}`, tagg, commit, arkiv: url, arkivSha256: sha(arkiv),
        licens: 'Apache License 2.0 (huvudet i varje schemafil)', hämtat: new Date().toISOString().slice(0, 10), filer: lista,
      }, null, 2)}\n`);
      console.log(`${domän} ${tagg}: ${Object.keys(lista).length} filer`);
    }
  } finally { rmSync(arbete, { recursive: true, force: true }); }
}

if (import.meta.main ?? process.argv[1]?.endsWith('rivta-scheman.js')) {
  if (process.argv.includes('--prova')) {
    const fel = prova();
    console.log(fel.length ? fel.join('\n') : 'Alla scheman stämmer med KALLA.json.');
    process.exit(fel.length ? 1 : 0);
  } else await hamta();
}
