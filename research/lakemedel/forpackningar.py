# Läser förpackningarna (NPL-pack-id och förpackningstext) för katalogens produkter ur NPL:s totalfil.
# Körs med python3 -I mot en uppackad totalfil i en egen katalog. Filen läses bara som data.
#   python3 -I research/lakemedel/forpackningar.py <uppackad NPL> app/src/seed/lakemedel-katalog.js <utfil.json>
# Med i utfilen är alla förpackningar per produkt med NPL-pack-id, text, avregistreringsdatum och om förpackningen
# är parallelldistribuerad (PD). Katalogen i demon använder bara förpackningar som inte är avregistrerade och inte
# parallelldistribuerade.
import re, json, sys

npldir, katalog, utfil = sys.argv[1], sys.argv[2], sys.argv[3]
ids = re.findall(r"L\((\d+), '(\d{14})', '([^']+)'", open(katalog, encoding='utf-8').read())
ut = {}
for nr, npl, namn in ids:
    s = open(f'{npldir}/Productdata/{npl}.xml', encoding='utf-8').read()
    packs = []
    for p in re.findall(r'<npl:package>(.*?)</npl:package>', s, re.S):
        pid = re.search(r'<mpa:nplpackid>(\d+)</mpa:nplpackid>', p).group(1)
        txt = re.search(r'<mpa:pack-text>\s*<mpa:v>(.*?)</mpa:v>', p, re.S)
        avreg = re.search(r'<mpa:pack-withdrawaldate>([^<]*)</mpa:pack-withdrawaldate>', p)
        packs.append({'nplpackid': pid, 'text': txt.group(1).strip() if txt else None,
                      'avregistrerad': avreg.group(1) if avreg else None, 'parallelldistribuerad': 'npl:para-dist-organization' in p})
    ut[nr] = {'npl': npl, 'namn': namn, 'forpackningar': packs}
json.dump(ut, open(utfil, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for nr, v in ut.items():
    giltiga = [p for p in v['forpackningar'] if not p['avregistrerad'] and not p['parallelldistribuerad']]
    print(nr, v['npl'], v['namn'], f"{len(giltiga)} av {len(v['forpackningar'])}")
    for p in giltiga[:6]:
        print('   ', p['nplpackid'], p['text'])
