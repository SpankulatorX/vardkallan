// Runda 9, r5: informationens skyddsbehov (Sussa 5.3.1.2). Varje informationstyp i journalen har en klassning av
// skyddsbehovet, och informationsstrukturen gör att uppgifterna kan urskiljas efter organisation (vårdenheten där de
// registrerades), process (vårdkontakt, vårdtillfälle, hälsoärende eller tvångsvårdsperiod) och plan (vårdplan och
// samordnad planering).
//
// Skyddet följer av klassningen och strukturen, inte av vad användaren väljer:
//   Organisation: inre sekretess och spärr per vårdenhet i behörighetsmotorn (atkomst.js).
//   Yrkesroll: varje handling kräver en roll som får göra den (ROLLER i atkomst.js).
//   Process: uppgifter i en tvångsvårdsperiod nås bara med handlingen för tvångsvård, och en vårdkontakt som skapades vid
//   nödåtkomst ger ingen bestående vårdrelation.
//   Plan: en vårdplans åtgärd registreras av den ansvariga yrkesrollen, och kommunens part ser bara det som har skickats i
//   den samordnade planeringen, aldrig journalen.
//   Skyddsnivå: åtkomst till uppgifter med mycket högt skyddsbehov kan tas fram för sig i logguppföljningen, och
//   stickprovet tar alltid med sådana åtkomster när de finns (logguppfoljning.js).
//
// Systemet är experten: ingen användare behöver avgöra vad som är känsligt. En ny tabell med patientuppgifter får nivån
// Högt utan att någon gör något, eftersom alla patientuppgifter har minst det skyddet.
export const NIVAER = {
  1: { namn: 'Grundläggande', text: 'Uppgifter utan koppling till en patient, till exempel organisation, kodverk och katalog.' },
  2: { namn: 'Högt', text: 'Patientuppgifter. Skyddas av vårdrelation, inre sekretess, spärr och yrkesroll, och varje åtkomst loggas.' },
  3: { namn: 'Mycket högt', text: 'Uppgifter vars röjande kan skada patienten allvarligt. Utöver skyddet för patientuppgifter kan åtkomsten tas fram för sig i logguppföljningen, och stickprovet tar alltid med den.' },
};
export const STANDARDNIVA = 2;

// Informationstyperna. tabell är där uppgifterna finns, och urskiljs säger vilka kolumner som ger organisation, process
// och plan. handlingar är handlingarna i behörighetsmotorn som läser eller skriver typen.
export const INFORMATIONSTYPER = [
  { id: 'identitet', rubrik: 'Patientens identitet och kontaktuppgifter', niva: 2, tabell: 'patienter', urskiljs: { organisation: null, process: null, plan: null },
    skydd: 'Visas för den med vårdrelation eller administrativ grund. Adress och telefon visas inte för en patient med skyddade personuppgifter.' },
  { id: 'skyddad_identitet', rubrik: 'Skyddade personuppgifter', niva: 3, tabell: 'patienter', villkor: 'skyddad = 1', handlingar: ['visa_identitet'],
    urskiljs: { organisation: null, process: null, plan: null },
    skydd: 'Namn och personnummer maskeras överallt. Att visa identiteten kräver ett syfte och loggas. Varje åtkomst till journalen har mycket högt skyddsbehov.' },
  { id: 'anteckning', rubrik: 'Journalanteckningar', niva: 2, tabell: 'anteckningar', handlingar: ['las_journal', 'las_omvardnad', 'skriv_journal', 'skriv_omvardnad'],
    urskiljs: { organisation: 'enhet_id', process: 'vardkontakt_id', plan: null },
    skydd: 'Läkaranteckningar och omvårdnadsanteckningar har var sin handling, så att yrkesrollen avgör vilka som syns.' },
  { id: 'diagnos', rubrik: 'Diagnoser', niva: 2, tabell: 'diagnoser', handlingar: ['las_diagnoser'], urskiljs: { organisation: 'enhet_id', process: 'vardkontakt_id', plan: null },
    skydd: 'Inre sekretess och spärr per vårdenhet.' },
  { id: 'matvarde', rubrik: 'Mätvärden och provsvar', niva: 2, tabell: 'matvarden', handlingar: ['las_matvarden', 'registrera_matvarde'], urskiljs: { organisation: 'enhet_id', process: 'vardkontakt_id', plan: null },
    skydd: 'Inre sekretess och spärr per vårdenhet.' },
  { id: 'lakemedel', rubrik: 'Läkemedel', niva: 2, tabell: 'ordinationer', handlingar: ['las_lakemedel', 'ordinera'], urskiljs: { organisation: 'enhet_id', process: 'vardkontakt_id', plan: null },
    skydd: 'Läkemedelslistan är gemensam för vårdgivaren och omfattas inte av aktivt val, men av spärr.' },
  { id: 'remiss', rubrik: 'Remisser och svar', niva: 2, tabell: 'remisser', handlingar: ['las_remiss', 'remittera'], urskiljs: { organisation: 'fran_enhet_id', process: null, plan: null },
    skydd: 'Avsändaren och mottagaren ser remissen. Vårdadministratören ser bara status.' },
  { id: 'vardkontakt', rubrik: 'Vårdkontakter och vårdtillfällen', niva: 2, tabell: 'vardkontakter', handlingar: ['las_admin', 'registrera_vardkontakt'], urskiljs: { organisation: 'enhet_id', process: 'halsoarende_id', plan: null },
    skydd: 'En vårdkontakt som skapades vid nödåtkomst ger ingen bestående vårdrelation.' },
  { id: 'vardplan', rubrik: 'Vårdplaner', niva: 2, tabell: 'vardplaner', handlingar: ['las_vardplan', 'vardplan', 'vardplan_atgard'], urskiljs: { organisation: 'enhet_id', process: null, plan: 'id' },
    skydd: 'Planen hör till vårdenheten som upprättade den. En åtgärd i planen registreras av den yrkesroll som är ansvarig för den.' },
  { id: 'samordnad', rubrik: 'Samordnad individuell plan och samordnad planering vid utskrivning', niva: 2, tabell: 'samordningar', handlingar: ['samordna', 'samverkan'],
    urskiljs: { organisation: 'enhet_id', process: 'vardtillfalle_id', plan: 'id' },
    skydd: 'Kommunens part ser bara det som har skickats i planeringen och når aldrig journalen.' },
  { id: 'tvangsvard', rubrik: 'Psykiatrisk tvångsvård och rättspsykiatrisk vård', niva: 3, tabell: 'tvangsvard_handelser', handlingar: ['las_tvangsvard', 'tvangsvard'],
    urskiljs: { organisation: 'enhet_id', process: 'period_id', plan: null },
    skydd: 'Beslutsjournalen nås bara med handlingen för tvångsvård och ändras aldrig. Läskopian för avbrott har bara läget och nästa frist, inte beslutsjournalen.' },
  { id: 'sparrad', rubrik: 'Spärrade uppgifter', niva: 3, tabell: 'sparrar', handlingar: ['samtycke_sparr'], urskiljs: { organisation: 'enhet_id', process: null, plan: null },
    skydd: 'Visas bara med patientens samtycke i stunden. Nödåtkomst häver aldrig en spärr, och inget talar om att spärrade uppgifter finns.' },
  { id: 'atkomstlogg', rubrik: 'Åtkomstloggen', niva: 3, tabell: 'atkomstlogg', handlingar: ['las_logg'], urskiljs: { organisation: 'enhet_id', process: null, plan: null },
    skydd: 'Bara logggranskaren läser loggen. Raderna kedjas med hash och kan inte ändras eller raderas.' },
];

const TYP = new Map(INFORMATIONSTYPER.map(t => [t.id, t]));
export const typ = (id) => TYP.get(id) ?? null;

// Handlingarna som läser eller skriver uppgifter med mycket högt skyddsbehov, utom loggens egen granskning.
export const HOGA_HANDLINGAR = [...new Set(INFORMATIONSTYPER.filter(t => t.niva === 3 && t.id !== 'atkomstlogg').flatMap(t => t.handlingar ?? []))];

// Villkoret i SQL för en rad i åtkomstloggen (alias l) som gäller uppgifter med mycket högt skyddsbehov: en handling för
// sådana uppgifter, spärrade uppgifter som visades med samtycke, eller en patient med skyddade personuppgifter.
export const MYCKET_HOGT_SQL = `(l.handling IN (${HOGA_HANDLINGAR.map(h => `'${h}'`).join(', ')}) OR l.grund = 'samtycke_sparr'
  OR l.patient_id IN (SELECT id FROM patienter WHERE skyddad = 1))`;

// Skyddsnivån för en rad i åtkomstloggen. skyddad är om patienten har skyddade personuppgifter.
export function nivaForLoggrad(rad, skyddad = false) {
  if (!rad?.patient_id && !rad?.patientId) return 1;
  if (HOGA_HANDLINGAR.includes(rad.handling) || rad.grund === 'samtycke_sparr' || skyddad) return 3;
  return STANDARDNIVA;
}

// Varför en åtkomst har mycket högt skyddsbehov, för granskaren.
export function orsakFor(rad, skyddad = false) {
  if (skyddad) return 'Patienten har skyddade personuppgifter.';
  if (rad.grund === 'samtycke_sparr') return 'Spärrade uppgifter visades med patientens samtycke.';
  const t = INFORMATIONSTYPER.find(x => x.niva === 3 && (x.handlingar ?? []).includes(rad.handling));
  return t ? `${t.rubrik}.` : null;
}

// Klassningen som gränssnittet och API:t visar.
export const klassning = () => ({
  nivaer: Object.entries(NIVAER).map(([n, v]) => ({ niva: Number(n), ...v })),
  typer: INFORMATIONSTYPER.map(t => ({ id: t.id, rubrik: t.rubrik, niva: t.niva, nivaNamn: NIVAER[t.niva].namn, urskiljs: t.urskiljs, skydd: t.skydd })),
  standard: `En informationstyp som inte står här har nivån ${NIVAER[STANDARDNIVA].namn}, eftersom alla patientuppgifter har minst det skyddet.`,
});
