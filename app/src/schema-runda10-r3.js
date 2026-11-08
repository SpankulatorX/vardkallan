// Runda 10, r3: tabellerna för formulärmotorn (formularmotor.js), den personliga ordlistan för rättstavningen
// (stavning.js) och seedens formulär. Modulen beror inte på db.js, så att db.js kan använda den både när mallen byggs och
// när en äldre sandlåda läses in. Allt är IF NOT EXISTS.

export const SCHEMA_FORMULAR = `
-- Formulären, en rad per version. definition är JSON (public/js/formularmotor-regler.js). En version föreslås av en
-- systemförvaltare och gäller (aktiv) först när en annan har godkänt den. Högst en version per formulär gäller. En
-- version raderas aldrig, och innehållet ändras aldrig: bara statusen går från väntar till gäller eller avslagen, och
-- från gäller till ersatt eller avvecklad.
CREATE TABLE IF NOT EXISTS formular (
  id INTEGER PRIMARY KEY, kod TEXT NOT NULL, version INTEGER NOT NULL, namn TEXT NOT NULL, definition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'vantar', motivering TEXT NOT NULL, andring TEXT, foreslagen_av TEXT NOT NULL, foreslagen TEXT NOT NULL,
  beslutad_av TEXT, beslutad TEXT, beslut_kommentar TEXT, avvecklad_av TEXT, avvecklad TEXT, avveckling_motivering TEXT,
  UNIQUE (kod, version),
  CHECK (status IN ('vantar', 'aktiv', 'avslagen', 'ersatt', 'avvecklad')),
  CHECK (status NOT IN ('aktiv', 'ersatt', 'avvecklad') OR (beslutad_av IS NOT NULL AND beslutad_av <> foreslagen_av)),
  CHECK (length(trim(motivering)) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_formular_aktiv ON formular (kod) WHERE status = 'aktiv';
CREATE TRIGGER IF NOT EXISTS formular_raderas_ej BEFORE DELETE ON formular
  BEGIN SELECT RAISE(ABORT, 'Ett formulär raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS formular_andras_ej BEFORE UPDATE ON formular
  WHEN NEW.id IS NOT OLD.id OR NEW.kod IS NOT OLD.kod OR NEW.version IS NOT OLD.version OR NEW.namn IS NOT OLD.namn
    OR NEW.definition IS NOT OLD.definition OR NEW.motivering IS NOT OLD.motivering OR NEW.foreslagen_av IS NOT OLD.foreslagen_av
    OR NEW.foreslagen IS NOT OLD.foreslagen
    OR NOT ((OLD.status = 'vantar' AND NEW.status IN ('vantar', 'aktiv', 'avslagen')) OR (OLD.status = 'aktiv' AND NEW.status IN ('aktiv', 'ersatt', 'avvecklad')))
  BEGIN SELECT RAISE(ABORT, 'Ett formulärs innehåll ändras inte, och en beslutad version ändras bara till ersatt eller avvecklad'); END;

-- Svaren i en anteckning som är ett ifyllt formulär, en rad per version av anteckningen. svar är JSON med de
-- normaliserade svaren, kallor JSON med var förifyllda värden kommer ifrån. En rad ändras bara medan anteckningen är ett
-- utkast och raderas aldrig.
CREATE TABLE IF NOT EXISTS formular_svar (
  anteckning_id INTEGER PRIMARY KEY, formular_id INTEGER NOT NULL, svar TEXT NOT NULL, poang INTEGER, kallor TEXT, sparad TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_formular_svar_formular ON formular_svar (formular_id);
CREATE TRIGGER IF NOT EXISTS formular_svar_raderas_ej BEFORE DELETE ON formular_svar
  BEGIN SELECT RAISE(ABORT, 'Svaren i ett formulär raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS formular_svar_andras_ej BEFORE UPDATE ON formular_svar
  WHEN (SELECT status FROM anteckningar WHERE id = OLD.anteckning_id) = 'signerad'
  BEGIN SELECT RAISE(ABORT, 'Svaren i en signerad anteckning ändras inte'); END;

-- Mätvärden som systemet registrerade ur ett formulär när anteckningen signerades, så att samma värde aldrig registreras
-- två gånger. Raderas och ändras aldrig.
CREATE TABLE IF NOT EXISTS formular_matvarden (
  anteckning_id INTEGER NOT NULL, falt TEXT NOT NULL, matvarde_id INTEGER NOT NULL, PRIMARY KEY (anteckning_id, falt)
);
CREATE TRIGGER IF NOT EXISTS formular_matvarden_raderas_ej BEFORE DELETE ON formular_matvarden BEGIN SELECT RAISE(ABORT, 'En registrering raderas inte'); END;
CREATE TRIGGER IF NOT EXISTS formular_matvarden_andras_ej BEFORE UPDATE ON formular_matvarden BEGIN SELECT RAISE(ABORT, 'En registrering ändras inte'); END;

-- Den personliga ordlistan för rättstavningen (stavning.js): ord som personen har lagt till och som inte markeras.
-- Inga patientuppgifter, och ordlistan hör till personen, inte till en vårdenhet.
CREATE TABLE IF NOT EXISTS personlig_ordlista (
  personal_id TEXT NOT NULL, ord TEXT NOT NULL, tillagd TEXT NOT NULL, PRIMARY KEY (personal_id, ord)
);
`;

// Seedens formulär. Poängen och gränserna är Vårdkällans demoregler och inte validerade skalor.
export const FALLRISK = {
  namn: 'Fallriskbedömning',
  beskrivning: 'Bedömning av risken för fall hos patienter i slutenvården. Poängen är Vårdkällans demoregel och inte en validerad skala.',
  kategori: 'omvardnad', roller: ['sjukskoterska', 'fysioterapeut'],
  falt: [
    { id: 'alder', typ: 'heltal', fraga: 'Ålder', min: 0, max: 130, enhet: 'år', forifyll: 'alder', sokord: 'Status' },
    { id: 'fall', typ: 'ja_nej', fraga: 'Har patienten fallit det senaste året?', obligatoriskt: true, poang: { ja: 1, nej: 0 }, sokord: 'Aktivitet' },
    { id: 'lakemedel', typ: 'val', fraga: 'Läkemedel som ökar risken för fall, till exempel sömnmedel eller lugnande', obligatoriskt: true, sokord: 'Status',
      alternativ: [{ varde: 'inga', text: 'Inga', poang: 0 }, { varde: 'ett', text: 'Ett', poang: 1 }, { varde: 'tva', text: 'Två eller fler', poang: 2 }] },
    { id: 'syn', typ: 'ja_nej', fraga: 'Nedsatt syn', obligatoriskt: true, poang: { ja: 1, nej: 0 }, sokord: 'Status' },
    { id: 'gang', typ: 'val', fraga: 'Gångförmåga', obligatoriskt: true, sokord: 'Aktivitet',
      alternativ: [{ varde: 'sjalvstandig', text: 'Går självständigt', poang: 0 }, { varde: 'hjalpmedel', text: 'Går med hjälpmedel', poang: 2 }, { varde: 'hjalp', text: 'Behöver hjälp av en person', poang: 3 }] },
    { id: 'forvirring', typ: 'ja_nej', fraga: 'Förvirring eller nedsatt minne', obligatoriskt: true, poang: { ja: 1, nej: 0 }, sokord: 'Kommunikation' },
  ],
  skala: {
    namn: 'Fallrisk', kalla: 'Vårdkällans demoregel, inte en validerad skala',
    tolkning: [{ fran: 0, till: 2, text: 'Låg risk för fall' }, { fran: 3, till: 8, text: 'Hög risk för fall', varning: true, kod: { system: 'icd10', kod: 'R29.6' } }],
  },
  regler: [
    { om: { falt: 'alder', minst: 80 }, text: 'Patienten är 80 år eller äldre, vilket i sig ökar risken för fall.' },
    { om: { poang: { minst: 3 } }, text: 'Hög risk för fall. Systemet föreslår att åtgärder mot fall, till exempel hjälp vid förflyttning och ett larm vid sängen, förs in i vårdplanen.' },
  ],
};

export const SAR = {
  namn: 'Sårdokumentation',
  beskrivning: 'Sårets läge på kroppsbilden, typ, storlek, sårbotten och tecken på infektion, och patientens vikt.',
  kategori: 'omvardnad', roller: null,
  falt: [
    { id: 'lage', typ: 'bild', bild: 'kropp', fraga: 'Sårets läge', obligatoriskt: true, maxMarkeringar: 10, sokord: 'Hud/vävnad', hjalp: 'Klicka där såret sitter. Systemet skriver kroppsdelen och sidan.' },
    { id: 'sartyp', typ: 'val', fraga: 'Sårtyp', obligatoriskt: true, sokord: 'Hud/vävnad',
      alternativ: [{ varde: 'trycksar', text: 'Trycksår' }, { varde: 'venost', text: 'Venöst bensår' }, { varde: 'arteriellt', text: 'Arteriellt bensår' },
        { varde: 'diabetes', text: 'Diabetesfotsår' }, { varde: 'operation', text: 'Operationssår' }, { varde: 'annat', text: 'Annat sår' }] },
    { id: 'langd', typ: 'decimal', fraga: 'Sårets längd', min: 0, max: 50, enhet: 'cm', sokord: 'Hud/vävnad' },
    { id: 'bredd', typ: 'decimal', fraga: 'Sårets bredd', min: 0, max: 50, enhet: 'cm', sokord: 'Hud/vävnad' },
    { id: 'sarbotten', typ: 'val', fraga: 'Sårbotten', sokord: 'Hud/vävnad',
      alternativ: [{ varde: 'granulation', text: 'Rosa och granulerande' }, { varde: 'belaggning', text: 'Gul beläggning' }, { varde: 'nekros', text: 'Nekros, död vävnad' }] },
    { id: 'infektion', typ: 'ja_nej', fraga: 'Tecken på infektion, till exempel rodnad, värme eller var', sokord: 'Hud/vävnad' },
    { id: 'vikt', typ: 'matvarde', matvarde: 'vikt', fraga: 'Vikt', forifyll: 'senaste', sokord: 'Nutrition', hjalp: 'Vikten påverkar sårläkningen. Systemet har fyllt i det senaste värdet. Ett nytt värde registreras som mätvärde när du signerar.' },
    { id: 'kommentar', typ: 'text', fraga: 'Kommentar', maxLangd: 1000, sokord: 'Kommentar' },
  ],
  regler: [
    { om: { falt: 'infektion', ar: 'ja' }, text: 'Tecken på infektion. Systemet föreslår att läkaren kontaktas och att en sårodling övervägs.' },
    { om: { falt: 'sarbotten', ar: 'nekros' }, text: 'Nekros i sårbotten. Systemet föreslår bedömning av läkare eller sårsjuksköterska före omläggning.' },
  ],
};
