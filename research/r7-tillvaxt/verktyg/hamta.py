"""Hämtar URL:er till original/ och för manifest.json bredvid. Användning: hamta.py ORIGINALKATALOG namn=url [namn=url ...]"""
import hashlib, json, os, sys, datetime, urllib.request

ut = sys.argv[1]
man_p = os.path.join(os.path.dirname(ut.rstrip('/')), 'manifest.json')
man = json.load(open(man_p)) if os.path.exists(man_p) else {}
for arg in sys.argv[2:]:
    namn, url = arg.split('=', 1)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0',
                                               'Accept': '*/*'})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
            status = r.status
            ctype = r.headers.get('Content-Type')
            slut = r.geturl()
    except Exception as e:
        print('FEL', namn, url, e)
        continue
    p = os.path.join(ut, namn)
    open(p, 'wb').write(data)
    h = hashlib.sha256(data).hexdigest()
    man[namn] = {'url': url, 'slutlig_url': slut,
                 'hamtad': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                 'sha256': h, 'bytes': len(data), 'status': status, 'content_type': ctype}
    print(namn, len(data), status, ctype, h[:16])
json.dump(man, open(man_p, 'w'), indent=1, ensure_ascii=False)
