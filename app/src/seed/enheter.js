// Vårdgivare, sjukhus, vårdenheter och arbetsplatser. HSA-id är påhittade.
// typ: vardgivare | sjukhus | vardenhet | arbetsplats | forvaltning
// Inre sekretess gäller per vårdenhet. En arbetsplats (avdelning, mottagning) hör till sin vårdenhet.
export const ENHETER = [
  { id: 'rol', hsa: 'SE2321000164-VK0000', namn: 'Region Örebro län', typ: 'vardgivare', forald: null },
  { id: 'uso', hsa: 'SE2321000164-VK0100', namn: 'Universitetssjukhuset Örebro', kortnamn: 'USÖ', typ: 'sjukhus', forald: 'rol' },
  { id: 'uso-akut', hsa: 'SE2321000164-VK0110', namn: 'Akutmottagningen USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-kard', hsa: 'SE2321000164-VK0120', namn: 'Kardiologiska kliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-kard-72', hsa: 'SE2321000164-VK0121', namn: 'Avdelning 72, kardiologi', typ: 'arbetsplats', forald: 'uso-kard' },
  { id: 'uso-kard-mott', hsa: 'SE2321000164-VK0122', namn: 'Kardiologiska mottagningen', typ: 'arbetsplats', forald: 'uso-kard' },
  { id: 'uso-kard-hia', hsa: 'SE2321000164-VK0123', namn: 'Hjärtintensivvårdsavdelningen (HIA)', typ: 'arbetsplats', forald: 'uso-kard' },
  { id: 'uso-med', hsa: 'SE2321000164-VK0130', namn: 'Medicinska kliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-inf', hsa: 'SE2321000164-VK0140', namn: 'Infektionskliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-ort', hsa: 'SE2321000164-VK0150', namn: 'Ortopediska kliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-psyk', hsa: 'SE2321000164-VK0160', namn: 'Allmänpsykiatriska kliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  // Runda 9, r3: kvinnokliniken med förlossningen och BB (obstetrik.js, Sussa 4.7).
  { id: 'uso-kk', hsa: 'SE2321000164-VK0170', namn: 'Kvinnokliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-kk-forl', hsa: 'SE2321000164-VK0171', namn: 'Förlossningen och BB, USÖ', typ: 'arbetsplats', forald: 'uso-kk' },
  { id: 'lind', hsa: 'SE2321000164-VK0200', namn: 'Lindesbergs lasarett', typ: 'sjukhus', forald: 'rol' },
  { id: 'lind-med', hsa: 'SE2321000164-VK0210', namn: 'Medicinkliniken Lindesbergs lasarett', typ: 'vardenhet', forald: 'lind' },
  { id: 'kkoga', hsa: 'SE2321000164-VK0300', namn: 'Karlskoga lasarett', typ: 'sjukhus', forald: 'rol' },
  { id: 'kkoga-ort', hsa: 'SE2321000164-VK0310', namn: 'Ortopediska kliniken Karlskoga lasarett', typ: 'vardenhet', forald: 'kkoga' },
  { id: 'primarvard', hsa: 'SE2321000164-VK0400', namn: 'Primärvården', typ: 'sjukhus', forald: 'rol' },
  { id: 'vc-tybble', hsa: 'SE2321000164-VK0410', namn: 'Vårdcentralen Tybble', typ: 'vardenhet', forald: 'primarvard' },
  // Runda 7, r6: barnavårdscentralen är en arbetsplats på Vårdcentralen Tybble.
  { id: 'vc-tybble-bvc', hsa: 'SE2321000164-VK0411', namn: 'Barnavårdscentralen Tybble', kortnamn: 'BVC Tybble', typ: 'arbetsplats', forald: 'vc-tybble' },
  { id: 'vc-kumla', hsa: 'SE2321000164-VK0420', namn: 'Vårdcentralen Kumla', typ: 'vardenhet', forald: 'primarvard' },
  { id: 'rk', hsa: 'SE2321000164-VK0900', namn: 'Regionkansliet', typ: 'forvaltning', forald: 'rol' },
  // Runda 6, r3: kommunen i samordnad planering (SIP och SPU) är en simulerad part med påhittat id. Den hör inte till
  // vårdgivaren och har ingen journalåtkomst.
  { id: 'kommun-demo', hsa: 'DEMO-KOMMUN-0001', namn: 'Kommunen, socialtjänst och kommunal hälso- och sjukvård (simulerad)', kortnamn: 'Kommunen (simulerad)', typ: 'kommun', forald: null },
  // Runda 11, r4: cytostatikaberedningen på USÖ (cytostatika-beredning.js, Sussa 4.8.1.5). En produktionsenhet utan
  // patienter, som tar emot beredningsorder från vårdenheterna på sjukhuset. Sist, så att de andras ordning inte ändras.
  { id: 'uso-bered', hsa: 'SE2321000164-VK0180', namn: 'Cytostatikaberedningen USÖ', kortnamn: 'Beredningen USÖ', typ: 'forvaltning', forald: 'uso' },
  // Runda 11, r4: Onkologiska kliniken USÖ, där cytostatika ordineras och ges i demon, med dagvården som arbetsplats.
  // Verksamhetsområde 741 Onkologisk vård, allmän (rapportkoder.js).
  { id: 'uso-onk', hsa: 'SE2321000164-VK0190', namn: 'Onkologiska kliniken USÖ', typ: 'vardenhet', forald: 'uso' },
  { id: 'uso-onk-dag', hsa: 'SE2321000164-VK0191', namn: 'Onkologiska dagvården', typ: 'arbetsplats', forald: 'uso-onk' },
];
