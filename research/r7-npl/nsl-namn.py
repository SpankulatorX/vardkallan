# Slår upp NSL-substanser (NSL-id) i SEnsl_ssi.xml: svenskt officiellt namn och ATC-koder. Filen läses bara som data.
# Snomed CT-koder skrivs inte ut (egna villkor).
#   python3 -I research/r7-npl/nsl-namn.py <SEnsl_ssi.xml> <NSL-id> [...]
import re, sys

s = open(sys.argv[1], encoding='utf-8').read()
for sid in sys.argv[2:]:
    i = s.find(f'<code>{sid}</code>')
    if i < 0:
        print(sid, 'saknas')
        continue
    start = s.rfind('<substance>', 0, i)
    post = s[start:s.find('</substance>', i)]
    namn = []
    for n in re.findall(r'<substance-name>\s*<substance-name>(.*?)</substance-name>(.*?)</substance-name>', post, re.S):
        if '<language-cv>swe</language-cv>' in n[1] and 'Official Name' in n[1]:
            namn.append(n[0])
    atc = re.findall(r'<code>([^<]*)</code>\s*<code-system-cv[^>]*term-english-equiv="ATC"', post)
    print(sid, '|', '; '.join(namn), '|', ', '.join(atc))
