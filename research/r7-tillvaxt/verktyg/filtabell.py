"""Lägger till tabellen över nedladdade filer sist i KALLOR.md ur manifest.json, och kontrollerar sha256 mot filerna."""
import hashlib, json, os, sys

rot = sys.argv[1]
man = json.load(open(os.path.join(rot, 'manifest.json')))
k_p = os.path.join(rot, 'KALLOR.md')
text = open(k_p, encoding='utf-8').read()
markor = '## Nedladdade filer\n'
text = text[:text.index(markor) + len(markor)]
rader = ['', 'Fil i original/, hämtad (UTC), HTTP-status, sha256 och URL.', '',
         '| Fil | Hämtad | Status | sha256 | URL |', '|---|---|---|---|---|']
fel = 0
for namn in sorted(man):
    m = man[namn]
    p = os.path.join(rot, 'original', namn)
    if not os.path.exists(p):
        continue
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if h != m['sha256']:
        fel += 1
        print('AVVIKER', namn)
    rader.append('| %s | %s | %s | %s | %s |' % (namn, m['hamtad'], m.get('status'), m['sha256'], m['url']))
rader.append('')
rader.append('Filen original/snomed/lookup-248334005-full.json hämtades med curl och står inte i manifest.json, sha256 %s.' %
             hashlib.sha256(open(os.path.join(rot, 'original/snomed/lookup-248334005-full.json'), 'rb').read()).hexdigest())
open(k_p, 'w', encoding='utf-8').write(text + '\n'.join(rader) + '\n')
print('rader', len(rader) - 7, 'avvikelser', fel)
