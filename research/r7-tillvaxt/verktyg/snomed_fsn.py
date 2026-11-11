"""Hämtar full lookup (FSN, modul, effectiveTime) och föräldrar och lägger dem i snomed-uppslag.json.
Användning: snomed_fsn.py RESEARCHKATALOG KOD..."""
import datetime, hashlib, json, os, sys, urllib.parse, urllib.request, urllib.error

rot = sys.argv[1]
rå = os.path.join(rot, 'original', 'snomed')
man_p = os.path.join(rot, 'manifest.json')
man = json.load(open(man_p))
ut_p = os.path.join(rot, 'snomed-uppslag.json')
ut = json.load(open(ut_p))
for kod in sys.argv[2:]:
    url = 'https://tx.fhir.org/r4/CodeSystem/$lookup?' + urllib.parse.urlencode(
        {'system': 'http://snomed.info/sct', 'code': kod, '_format': 'json', 'property': '*'})
    req = urllib.request.Request(url, headers={'Accept': 'application/fhir+json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data, status = r.read(), r.status
    except urllib.error.HTTPError as e:
        data, status = e.read(), e.code
    namn = 'lookup-full-%s.json' % kod
    open(os.path.join(rå, namn), 'wb').write(data)
    man['snomed/' + namn] = {'url': url, 'hamtad': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                             'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'status': status}
    d = json.loads(data)
    fsn, modul, eff, foraldrar = None, None, None, []
    for p in d.get('parameter', []):
        parts = {x['name']: x for x in p.get('part', [])}
        if p['name'] == 'designation' and parts.get('use', {}).get('valueCoding', {}).get('code') == '900000000000003001':
            fsn = parts['value']['valueString']
        if p['name'] == 'property':
            c = parts.get('code', {}).get('valueCode')
            v = parts.get('value', {})
            val = next((x for k, x in v.items() if k.startswith('value')), None)
            if c == 'module':
                modul = val
            elif c == 'effectiveTime':
                eff = val
            elif c == 'parent':
                foraldrar.append(val)
    for u in ut['uppslag']:
        if u['kod'] == kod:
            u.update({'fsn': fsn, 'modul': modul, 'effectiveTime': eff, 'foraldrar': foraldrar})
            break
    print(kod, fsn, modul, eff, foraldrar)
json.dump(ut, open(ut_p, 'w'), indent=1, ensure_ascii=False)
json.dump(man, open(man_p, 'w'), indent=1, ensure_ascii=False)
