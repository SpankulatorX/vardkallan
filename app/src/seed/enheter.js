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
  { id: 'lind', hsa: 'SE2321000164-VK0200', namn: 'Lindesbergs lasarett', typ: 'sjukhus', forald: 'rol' },
  { id: 'lind-med', hsa: 'SE2321000164-VK0210', namn: 'Medicinkliniken Lindesbergs lasarett', typ: 'vardenhet', forald: 'lind' },
  { id: 'kkoga', hsa: 'SE2321000164-VK0300', namn: 'Karlskoga lasarett', typ: 'sjukhus', forald: 'rol' },
  { id: 'kkoga-ort', hsa: 'SE2321000164-VK0310', namn: 'Ortopediska kliniken Karlskoga lasarett', typ: 'vardenhet', forald: 'kkoga' },
  { id: 'primarvard', hsa: 'SE2321000164-VK0400', namn: 'Primärvården', typ: 'sjukhus', forald: 'rol' },
  { id: 'vc-tybble', hsa: 'SE2321000164-VK0410', namn: 'Vårdcentralen Tybble', typ: 'vardenhet', forald: 'primarvard' },
  { id: 'vc-kumla', hsa: 'SE2321000164-VK0420', namn: 'Vårdcentralen Kumla', typ: 'vardenhet', forald: 'primarvard' },
  { id: 'rk', hsa: 'SE2321000164-VK0900', namn: 'Regionkansliet', typ: 'forvaltning', forald: 'rol' },
];
