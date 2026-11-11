"""Gör om HTML till text och skriver ut sammanhang kring sökord. Användning: text.py FIL [ord ...] (bredd via BREDD=n)"""
import html, os, re, sys

t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
t = re.sub(r'(?is)<script.*?</script>|<style.*?</style>', ' ', t)
t = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</h\d>|</tr>', '\n', t)
t = html.unescape(re.sub(r'<[^>]+>', ' ', t))
t = re.sub(r'[ \t\xa0]+', ' ', t)
t = re.sub(r'\n\s*\n+', '\n', t)
b = int(os.environ.get('BREDD', '300'))
ord_ = sys.argv[2:]
if not ord_:
    print(t)
for o in ord_:
    traffar = [m.start() for m in re.finditer(o, t, re.I)]
    print('=== %s (%d träffar)' % (o, len(traffar)))
    senast = -10 ** 9
    for s in traffar[:int(os.environ.get('MAX', '4'))]:
        if s - senast < b:
            continue
        senast = s
        print('...', t[max(0, s - b):s + b].replace('\n', ' / '))
