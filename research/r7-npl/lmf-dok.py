# Listar Läkemedelsfaktas produktdokument (öppna data, produktdokument-1.1.xml) för angivna NPL-id. Filen läses bara som data.
#   python3 -I research/r7-npl/lmf-dok.py <produktdokument.xml> <NPL-id> [...]
import re, sys

s = open(sys.argv[1], encoding='utf-8-sig').read()
poster = re.findall(r'<DocumentList>(.*?)</DocumentList>', s, re.S)
print(len(poster), 'dokument,', len(set(re.findall(r'<NplId>(\d+)</NplId>', s))), 'produkter')
def f(t, p):
    m = re.search(rf'<{t}>(.*?)</{t}>', p, re.S)
    return m.group(1) if m else ''
for npl in sys.argv[2:]:
    traffar = [p for p in poster if f('NplId', p) == npl]
    print('==', npl, len(traffar), 'dokument')
    for p in traffar:
        print('  ', f('ProduktNamn', p), '|', f('Typ', p), f('Språk', p), '|', f('DennaVersionGodkänd', p), '|', f('Företag', p), '|', f('DokumentNamn', p))
