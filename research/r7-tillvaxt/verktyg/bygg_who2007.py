"""Bygger who2007-tillvaxt.js ur WHO:s xlsx-filer i original/. Användning: bygg_who2007.py RESEARCHKATALOG"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx import läs_ark

rot = sys.argv[1]
man = json.load(open(os.path.join(rot, 'manifest.json')))
FILER = {
    'bmi': ('who2007-bmi-boys-z-exp.xlsx', 'who2007-bmi-girls-z-exp.xlsx'),
    'langd': ('who2007-hfa-boys-z-exp.xlsx', 'who2007-hfa-girls-z-exp.xlsx'),
    'vikt': ('who2007-wfa-boys-z-exp.xlsx', 'who2007-wfa-girls-z-exp.xlsx'),
}


def fmt(x, d):
    s = repr(round(float(x), d))
    if s.endswith('.0'):
        s = s[:-2]
    return s


def tabell(fil):
    rader = läs_ark(os.path.join(rot, 'original', fil))
    h = rader[0]
    assert h[:4] == ['Month', 'L', 'M', 'S'], h
    ut = []
    for r in rader[1:]:
        if r[0] is None:
            continue
        ut.append((int(float(r[0])), r[1], r[2], r[3]))
    man_ = [u[0] for u in ut]
    assert man_ == list(range(man_[0], man_[-1] + 1)), 'luckor i månader'
    return ut


data, intervall = {}, {}
for matt, (fm, fk) in FILER.items():
    data[matt] = {}
    for kon, fil in (('M', fm), ('K', fk)):
        t = tabell(fil)
        data[matt][kon] = t
        intervall.setdefault(matt, (t[0][0], t[-1][0]))
        assert intervall[matt] == (t[0][0], t[-1][0])
for m, (a, b) in intervall.items():
    print(m, a, b, len(data[m]['M']), len(data[m]['K']), file=sys.stderr)

datum = sorted({man[f]['hamtad'][:10] for fs in FILER.values() for f in fs})
url_rader = []
for matt, fs in FILER.items():
    for f in fs:
        url_rader.append('//   %s\n//     sha256 %s' % (man[f]['url'], man[f]['sha256']))

o = []
o.append('''// WHO:s tillväxtreferens för barn och ungdomar 5 till 19 år (WHO Growth Reference 2007), L, M och S per hel månad
// för BMI efter ålder (61 till 228 månader), längd efter ålder (61 till 228 månader) och vikt efter ålder (61 till 120
// månader, WHO publicerar ingen viktreferens efter 10 år), pojkar (M) och flickor (K). Längden är stående längd.
// Index 0 i varje lista är månaden i WHO2007_INTERVALL[mått].fran, och index i motsvarar månad fran + i.
//
// Källa: de Onis M, Onyango AW, Borghi E, Siyam A, Nishida C, Siekmann J. Development of a WHO growth reference for
// school-aged children and adolescents. Bull World Health Organ 2007;85:660-7. Tabellerna med z-värden per månad
// ("expanded tables", filerna *-z-who-2007-exp.xlsx) hämtades från cdn.who.int %s via sidorna under
// https://www.who.int/tools/growth-reference-data-for-5to19-years. Värdena är avskrivna utan ändring och avrundade
// till fyra decimaler för L och M och fem för S, som i who-tillvaxt.js. Filerna och deras SHA-256:
%s
//
// Kontroll: alla 792 rader är lika med WHO:s egna tabeller i R-paketet anthroplus (WHO upphovsrättsinnehavare,
// licens GPL-3.0 eller senare, github.com/WorldHealthOrganization/anthroplus, commit
// 7cfcdb39026e9a55de55732bc3cf14c82261bcf7, filerna data-raw/growthstandards/{bfa,hfa,wfa}who2007.txt).
//
// Licens: WHO:s upphovsrättspolicy (https://www.who.int/about/policies/publishing/copyright) anger licensen
// CC BY-NC-SA 3.0 IGO för WHO:s publikationer, och WHO:s villkor för webbplatsen
// (https://www.who.int/about/policies/terms-of-use) tillåter användning för undervisning och andra icke-kommersiella
// syften med WHO som källa. Sidorna för 2007 års referens anger ingen egen licens, och artikeln i Bulletin of the WHO är
// "(c) World Health Organization (WHO) 2007. All rights reserved." Samma tabeller ges också ut av WHO under GPL-3.0 i
// anthroplus. Filen omfattas inte av Vårdkällans licens EUPL 1.2. Vårdkällan är ett demoprojekt utan kommersiellt
// syfte och använder tabellen med angiven källa. Innan någon använder Vårdkällan kommersiellt ska villkoren prövas på
// nytt (GPL-3.0 via anthroplus eller tillstånd från WHO).
''' % (' och '.join(datum), '\n'.join(url_rader)))
o.append("export const WHO2007_KALLA = 'WHO Growth Reference 2007, 5 till 19 år (de Onis m.fl., Bull World Health Organ 2007;85:660-7), tabeller med L, M och S per månad, hämtade från who.int %s';" % datum[-1])
o.append("export const WHO2007_LICENS = 'CC BY-NC-SA 3.0 IGO enligt WHO:s upphovsrättspolicy (samma tabeller också under GPL-3.0 i WHO:s R-paket anthroplus). Används utan kommersiellt syfte med angiven källa.';")
o.append('')
o.append('// Första månaden (index 0) i alla tre måtten.')
o.append('export const WHO2007_FRAN_MANAD = %d;' % intervall['bmi'][0])
o.append('')
o.append('// Giltigt intervall i hela månader per mått, båda gränserna ingår.')
o.append('export const WHO2007_INTERVALL = {')
for m in ('bmi', 'langd', 'vikt'):
    o.append('  %s: { fran: %d, till: %d },' % (m, *intervall[m]))
o.append('};')
o.append('')
o.append('export const WHO2007_LMS = {')
for m in ('bmi', 'langd', 'vikt'):
    o.append('  %s: {' % m)
    for kon in ('M', 'K'):
        o.append('    %s: [' % kon)
        for (man_, L, M, S) in data[m][kon]:
            rad = '      [%s, %s, %s],' % (fmt(L, 4), fmt(M, 4), fmt(S, 5))
            if man_ % 12 == 0 or man_ == intervall[m][0]:
                rad += ' // %d mån (%d år)' % (man_, man_ // 12) if man_ % 12 == 0 else ' // %d mån' % man_
            o.append(rad)
        o.append('    ],')
    o.append('  },')
o.append('};')
open(os.path.join(rot, 'who2007-tillvaxt.js'), 'w').write('\n'.join(o) + '\n')
