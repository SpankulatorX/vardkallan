# Lägger intensivvårdens fyra produkter i katalogen ur utdraget ur NPL:s totalfil 2026-11-10 (runda 11, r7):
# katalogen (app/src/seed/lakemedel-katalog.js), facit (NPL i app/src/kodverk.js), förpackningarna
# (app/src/seed/forpackningar.js) och förpackningarnas facit (app/test/data/npl-forpackningar.json).
#   python3 -I research/r7-npl/katalog-r7.py research/r7-npl/detalj-2026-11-10.json app
# Katalognumren är 701 till 704, så att de inte krockar med andra delars tillägg. Bara förpackningar som inte är
# avregistrerade och inte parallelldistribuerade tas med, högst fyra per produkt, och den första är förval.
import json, sys

utdrag, app = sys.argv[1], sys.argv[2]
d = json.load(open(utdrag, encoding='utf-8'))
d = {x['npl']: x for x in d} if isinstance(d, list) else d
ORDNING = [('20070331000011', 701), ('20000825000258', 702), ('20051112000024', 703), ('19801003000053', 704)]
forst = lambda s: s[0].lower() + s[1:]

kat, npl, forp = [], [], []
facit_path = f'{app}/test/data/npl-forpackningar.json'
facit = json.load(open(facit_path, encoding='utf-8'))
for nplid, nr in ORDNING:
    p = d[nplid]
    kat.append(f"  L({nr}, '{nplid}', '{p['namn']}', '{forst(p['substans'])}', '{p['styrka']}', '{forst(p['form'])}', '{p['atc']}'),")
    npl.append(f"  '{nplid}': {{ namn: '{p['namn']}', styrka: '{p['styrka']}', form: '{p['form']}', substans: '{p['substans']}', atc: '{p['atc']}', vagar: {json.dumps(p['vagar'])}, godkand: '{p['godkand']}' }},".replace('"', "'"))
    giltiga = [x for x in p['forpackningar'] if not x['avregistrerad'] and not x['parallelldistribuerad'] and x['text']]
    facit['produkter'][nplid] = {x['nplpackid']: x['text'] for x in giltiga}
    for i, x in enumerate(giltiga[:4]):
        forp.append(f"  F('VK-NPL-{nr:04d}', '{x['nplpackid']}', {json.dumps(x['text'], ensure_ascii=False)}{', true' if i == 0 else ''}),")

def lagg(path, slut, rubrik, rader):
    s = open(path, encoding='utf-8').read()
    i = s.index(slut)
    s = s[:i] + rubrik + '\n'.join(rader) + '\n' + s[i:]
    open(path, 'w', encoding='utf-8').write(s)

lagg(f'{app}/src/seed/lakemedel-katalog.js', '];\n', "  // Runda 11, r7: vasoaktiva, sederande och diuretika för intensivvården, ur NPL:s totalfil 2026-11-10.\n", kat)
k = open(f'{app}/src/kodverk.js', encoding='utf-8').read()
start = k.index('export const NPL = {')
slut = k.index('\n};', start) + 1
k = k[:slut] + "  // Runda 11, r7: intensivvårdens produkter ur NPL:s totalfil 2026-11-10 (research/r7-npl).\n" + '\n'.join(npl) + '\n' + k[slut:]
open(f'{app}/src/kodverk.js', 'w', encoding='utf-8').write(k)
lagg(f'{app}/src/seed/forpackningar.js', '];\n', "  // Runda 11, r7: intensivvårdens produkter ur NPL:s totalfil 2026-11-10 (research/r7-npl/katalog-r7.py).\n", forp)
json.dump(facit, open(facit_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(kat), 'produkter,', len(forp), 'förpackningar')
