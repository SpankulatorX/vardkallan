# Skriver ut produkthuvudet (allt före förpackningarna) ur NPL:s totalfil för angivna NPL-id. Filerna läses bara som data.
#   python3 -I research/r7-npl/visa.py <uppackad NPL>/Productdata <NPL-id> [...]
import os, sys, re
d, ids = sys.argv[1], sys.argv[2:]
for fil in sorted(os.listdir(d)):
    s = open(os.path.join(d, fil), encoding='utf-8').read()
    m = re.search(r'<mpa:nplid>(\d+)</mpa:nplid>', s)
    if m and m.group(1) in ids:
        print('=====', fil, m.group(1))
        print(s.split('<npl:packages>')[0][:7000])
