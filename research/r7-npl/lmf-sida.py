# Hämtar Läkemedelsfaktas produktsida för angivna NPL-id, en sida i taget med två sekunders paus, sparar varje sida i
# utkatalogen och skriver ut sidans titel och beskrivning (där ATC-koden står). Sidorna läses bara som data.
#   python3 -I research/r7-npl/lmf-sida.py <utkatalog> <NPL-id> [...]
import hashlib, html, os, re, sys, time, urllib.request

ut = sys.argv[1]
for n, npl in enumerate(sys.argv[2:]):
    if n:
        time.sleep(2)
    url = f'https://www.lakemedelsverket.se/sv/sok-lakemedelsfakta/lakemedel?id={npl}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (vardkallan lakemedelskontroll)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        b = r.read()
        status = r.status
    open(os.path.join(ut, f'{npl}.html'), 'wb').write(b)
    s = b.decode('utf-8', 'replace')
    titel = re.search(r'<title>(.*?)</title>', s, re.S)
    besk = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', s) or re.search(r'<meta\s+content="([^"]*)"\s+name="description"', s)
    print(npl, status, len(b), hashlib.sha256(b).hexdigest())
    print('  titel:', html.unescape(titel.group(1).strip()) if titel else None)
    print('  beskrivning:', html.unescape(besk.group(1)) if besk else None)
