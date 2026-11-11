"""Slår upp Snomed CT-koder på tx.fhir.org. Användning: snomed.py RESEARCHKATALOG steg [koder...]
steg = lookup KOD... | expand FILTER"""
import datetime, hashlib, json, os, sys, urllib.parse, urllib.request, urllib.error

rot = sys.argv[1]
steg = sys.argv[2]
rå = os.path.join(rot, 'original', 'snomed')
os.makedirs(rå, exist_ok=True)
man_p = os.path.join(rot, 'manifest.json')
man = json.load(open(man_p))
ut_p = os.path.join(rot, 'snomed-uppslag.json')
ut = json.load(open(ut_p)) if os.path.exists(ut_p) else {'kalla': 'tx.fhir.org/r4 (HL7 FHIR terminologiserver)', 'uppslag': [], 'sokningar': []}


def hamta(url, namn):
    req = urllib.request.Request(url, headers={'Accept': 'application/fhir+json', 'User-Agent': 'vardkallan-research'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data, status = r.read(), r.status
    except urllib.error.HTTPError as e:
        data, status = e.read(), e.code
    open(os.path.join(rå, namn), 'wb').write(data)
    man['snomed/' + namn] = {'url': url, 'hamtad': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                             'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'status': status}
    try:
        return status, json.loads(data)
    except Exception:
        return status, {'_rå': data[:500].decode('utf-8', 'replace')}


def parametrar(d):
    out = {'egenskaper': {}}
    for p in d.get('parameter', []):
        n = p.get('name')
        if n == 'property':
            kod, varde = None, None
            for pp in p.get('part', []):
                if pp['name'] == 'code':
                    kod = pp.get('valueCode')
                elif pp['name'] == 'value':
                    varde = next(v for k, v in pp.items() if k.startswith('value'))
            if kod:
                out['egenskaper'].setdefault(kod, []).append(varde)
        elif n in ('name', 'version', 'display'):
            out[n] = next(v for k, v in p.items() if k.startswith('value'))
    return out


if steg == 'lookup':
    for kod in sys.argv[3:]:
        url = 'https://tx.fhir.org/r4/CodeSystem/$lookup?' + urllib.parse.urlencode(
            {'system': 'http://snomed.info/sct', 'code': kod, '_format': 'json', 'property': 'inactive'})
        status, d = hamta(url, 'lookup-%s.json' % kod)
        post = {'kod': kod, 'http_status': status}
        if status == 200 and d.get('resourceType') == 'Parameters':
            p = parametrar(d)
            post['display'] = p.get('display')
            post['version'] = p.get('version')
            ina = p['egenskaper'].get('inactive')
            post['aktiv'] = (not ina[0]) if ina else None
            post['egenskaper_inactive'] = ina
        else:
            post['fel'] = '; '.join(i.get('details', {}).get('text') or i.get('diagnostics', '') for i in d.get('issue', [])) or str(d)[:300]
        ut['uppslag'] = [u for u in ut['uppslag'] if u['kod'] != kod] + [post]
        print(json.dumps(post, ensure_ascii=False))
elif steg == 'expand':
    filt = sys.argv[3]
    url = 'https://tx.fhir.org/r4/ValueSet/$expand?' + urllib.parse.urlencode(
        {'url': 'http://snomed.info/sct?fhir_vs', 'filter': filt, 'count': '100', '_format': 'json'})
    status, d = hamta(url, 'expand-%s.json' % filt.replace(' ', '_'))
    traffar = [{'kod': c['code'], 'display': c.get('display'), 'version': c.get('version')}
               for c in d.get('expansion', {}).get('contains', [])]
    ut['sokningar'] = [t for t in ut['sokningar'] if t['filter'] != filt] + [
        {'filter': filt, 'http_status': status, 'total': d.get('expansion', {}).get('total'), 'traffar': traffar}]
    for t in traffar:
        print(t['kod'], t['display'])
    print('total', d.get('expansion', {}).get('total'), 'status', status)
json.dump(ut, open(ut_p, 'w'), indent=1, ensure_ascii=False)
json.dump(man, open(man_p, 'w'), indent=1, ensure_ascii=False)
