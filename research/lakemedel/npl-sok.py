# Söker i indexet från npl-index.py efter godkända produkter som inte är avregistrerade och inte har stoppad
# försäljning, och som har minst en förpackning som inte är avregistrerad eller parallelldistribuerad.
#   python3 -I research/lakemedel/npl-sok.py <index.json> <namn eller substans> [styrka]
import json, sys

index = json.load(open(sys.argv[1], encoding='utf-8'))
q = sys.argv[2].lower()
styrka = sys.argv[3] if len(sys.argv) > 3 else None
for p in index:
    if p['avregistrerad'] or p['stoppad'] or not p['namn']:
        continue
    if q not in p['namn'].lower() and q not in (p['substans'] or '').lower():
        continue
    if styrka and p['styrka'] != styrka:
        continue
    giltiga = [x for x in p['forpackningar'] if not x['avregistrerad'] and not x['parallelldistribuerad'] and x['text']]
    if not giltiga:
        continue
    print(p['npl'], '|', p['namn'], '|', p['styrka'], '|', p['form'], '|', p['substans'], '|', p['atc'], '|', ','.join(p['vagar']), '|', p['godkand'], '|', len(giltiga))
