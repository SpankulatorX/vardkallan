# Skriver katalogens förpackningar (app/src/seed/forpackningar.js) och facit för testerna
# (app/test/data/npl-forpackningar.json) ur utdraget som forpackningar.py gjorde ur NPL:s totalfil.
#   python3 -I research/lakemedel/forpackningar-seed.py research/lakemedel/forpackningar-2026-11-03.json app
# Bara förpackningar som inte är avregistrerade och inte parallelldistribuerade tas med. Per produkt tas högst fyra:
# först en endosförpackning om det finns en (förval i slutenvården), sedan de andra i NPL:s ordning.
import json, sys

utdrag, app = sys.argv[1], sys.argv[2]
d = json.load(open(utdrag, encoding='utf-8'))
facit = {}
rader = []
for nr, v in sorted(d.items(), key=lambda x: int(x[0])):
    giltiga = [p for p in v['forpackningar'] if not p['avregistrerad'] and not p['parallelldistribuerad'] and p['text']]
    facit[v['npl']] = {p['nplpackid']: p['text'] for p in giltiga}
    endos = [p for p in giltiga if 'endos' in p['text']]
    valda = (endos[:1] + [p for p in giltiga if p not in endos[:1]])[:4]
    katalog = f"VK-NPL-{int(nr):04d}"
    for i, p in enumerate(valda):
        rader.append(f"  F('{katalog}', '{p['nplpackid']}', {json.dumps(p['text'], ensure_ascii=False)}{', true' if i == 0 else ''}),")
js = """// Förpackningar för katalogens produkter med NPL-pack-id ur Läkemedelsverkets NPL (totalfilen 2026-11-03, se
// docs/lakemedelskontroll.md). Skriven av research/lakemedel/forpackningar-seed.py. Bara förpackningar som inte är
// avregistrerade och inte parallelldistribuerade, högst fyra per produkt. forval är förpackningen som systemet väljer
// när förskrivaren inte väljer själv: en endosförpackning om produkten har en, annars den första i NPL.
const F = (lakemedelId, nplpackid, text, forval = false) => ({ lakemedelId, nplpackid, text, forval });

export const FORPACKNINGAR = [
""" + "\n".join(rader) + "\n];\n"
open(f'{app}/src/seed/forpackningar.js', 'w', encoding='utf-8').write(js)
json.dump({'kalla': 'NPL totalfil 2026-11-03 (npl.mpa.se/MpaProductExport/4.5/2026-11-03_Total_NPL.zip)', 'produkter': facit},
          open(f'{app}/test/data/npl-forpackningar.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(rader), 'förpackningar,', sum(len(x) for x in facit.values()), 'i facit')
