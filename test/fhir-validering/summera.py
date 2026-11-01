# Sammanfattar HL7-validatorns utdata per resurstyp (katalognamnet i filens sökväg). Siffror och datum i texten ersätts med N så att lika meddelanden räknas ihop.
# Avslutar med felkod 1 om något fel (error eller fatal) finns eller om en utdatafil saknas. Varningar ger inte felkod.
import json, sys, collections, re, os
per = collections.defaultdict(lambda: {'n': 0, 'tot': collections.Counter(), 'unika': collections.Counter()})
saknas = []
for f in sys.argv[1:]:
    try: d = json.load(open(f, encoding='utf-8'))
    except (OSError, ValueError) as e: saknas.append(f'{f}: {e}'); continue
    oos = [e['resource'] for e in d.get('entry', [])] if d.get('resourceType') == 'Bundle' else [d]
    for oo in oos:
        fil = next((x.get('valueString') for x in oo.get('extension', []) if x['url'].endswith('operationoutcome-file')), '?/?')
        typ = os.path.basename(os.path.dirname(fil)) or '?'
        p = per[typ]; p['n'] += 1
        for i in oo.get('issue', []):
            sev = i['severity']
            if sev == 'information': continue
            p['tot'][sev] += 1
            expr = re.sub(r'\[\d+\]', '[n]', (i.get('expression') or i.get('location') or ['?'])[0])
            txt = re.sub(r"'\d+'|\b\d{4}-\d\d-\d\d\S*", 'N', i.get('details', {}).get('text', ''))[:260]
            p['unika'][(sev, expr, txt)] += 1
for typ in sorted(per):
    p = per[typ]
    print(f"## {typ}: {p['n']} resurser, fel {p['tot']['error'] + p['tot']['fatal']}, varningar {p['tot']['warning']}")
    for (sev, expr, txt), n in sorted(p['unika'].items(), key=lambda x: (x[0][0] not in ('error', 'fatal'), x[0][1])):
        print(f'  {sev:7} x{n:<3} {expr}: {txt}')
resurser = sum(p['n'] for p in per.values())
fel = sum(p['tot']['error'] + p['tot']['fatal'] for p in per.values())
varningar = sum(p['tot']['warning'] for p in per.values())
for s in saknas: print(f'Utdata saknas eller går inte att läsa: {s}')
if not sys.argv[1:]: saknas.append('inga filer')
print(f'Totalt: {resurser} resurser, fel {fel}, varningar {varningar}' + (f', saknade utdatafiler {len(saknas)}' if saknas else ''))
sys.exit(1 if fel or saknas else 0)
