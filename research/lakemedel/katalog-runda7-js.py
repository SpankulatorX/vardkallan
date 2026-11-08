# Skriver raderna för katalogen och facit (runda 7, r1) ur utdraget från katalog-runda7.py, och lägger in dem sist i
# app/src/seed/lakemedel-katalog.js och i NPL-facit i app/src/kodverk.js. En produkt utan styrka i NPL (den buffrade
# glukosen, där styrkan står i namnet) får en tom styrka i båda.
#   python3 -I research/lakemedel/katalog-runda7-js.py <valda.json> <app>
import json, sys

valda = json.load(open(sys.argv[1], encoding='utf-8'))
app = sys.argv[2]
forst = lambda s: s[0].lower() + s[1:]
q = lambda s: "'" + s.replace("'", "\\'") + "'"

kat = []
npl = []
for i, p in enumerate(valda):
    nr = 51 + i
    styrka = p['styrka'] or ''
    kat.append(f"  L({nr}, '{p['npl']}', {q(p['namn'])}, {q(forst(p['substans']))}, {q(styrka)}, {q(forst(p['form']))}, '{p['atc']}'),")
    vagar = ', '.join(f"'{v}'" for v in dict.fromkeys(p['vagar']))
    npl.append(f"  '{p['npl']}': {{ namn: {q(p['namn'])}, styrka: {q(styrka)}, form: {q(p['form'])}, substans: {q(p['substans'])}, atc: '{p['atc']}', vagar: [{vagar}], godkand: '{p['godkand']}' }},")

f = f'{app}/src/seed/lakemedel-katalog.js'
s = open(f, encoding='utf-8').read()
slut = "  L(50, '20100621000022', 'Desogestrel Sandoz', 'desogestrel', '75 mikrogram', 'filmdragerad tablett', 'G03AC09'),\n"
assert slut in s and 'L(51,' not in s
s = s.replace(slut, slut + "  // Runda 7, r1: Sussas läkemedel i användbarhetstesterna (Bilaga F1:3 tabell 6) och fler styrkor, så att katalogen har\n  // minst 100 produkter. Kontrollerade mot NPL:s totalfil 2026-11-03, se docs/kodkontroll.md.\n" + "\n".join(kat) + "\n")
open(f, 'w', encoding='utf-8').write(s)

f = f'{app}/src/kodverk.js'
s = open(f, encoding='utf-8').read()
start = s.index('export const NPL = {')
slut = s.index('\n};', start)
s = s[:slut] + "\n  // Runda 7, r1: ur totalfilen 2026-11-03 (npl-schema_12.2). NPL anger ingen styrka för den buffrade glukosen, där\n  // styrkan står i namnet. Administrationsvägarna OCUL (ögat) och NASA (näsan) är nya.\n" + "\n".join(npl) + s[slut:]
open(f, 'w', encoding='utf-8').write(s)
print(len(kat), 'produkter inlagda')
