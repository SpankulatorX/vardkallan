# Bygger ett sökbart index över NPL:s totalfil (runda 7, r1), för att välja nya produkter till läkemedelskatalogen.
# Körs med python3 -I mot en uppackad totalfil i en egen katalog. Filerna läses bara som data.
#   python3 -I research/lakemedel/npl-index.py <uppackad NPL> <utfil.json>
# Med i indexet: NPL-id, namn (medprodnamelegal), styrka, beredningsform och substansbeskrivning med NPL:s svenska
# text, ATC-kod, administrationsvägar, produktklass, godkännande- och avregistreringsdatum, stoppad försäljning och
# förpackningarna med NPL-pack-id, text, avregistreringsdatum och om de är parallelldistribuerade.
import json, os, re, sys

npldir, utfil = sys.argv[1], sys.argv[2]

def lexikon(namn):
    s = open(os.path.join(npldir, 'Lexicondata', f'{namn}.xml'), encoding='utf-8').read()
    ut = {}
    for t in re.findall(r'<commonTerm>(.*?)</commonTerm>', s, re.S):
        i = re.search(r'<mpaId[^>]*>([^<]*)</mpaId>', t)
        n = re.search(r'<term-name xml:lang="sv" v="([^"]*)"', t)
        if i and n:
            ut[i.group(1)] = n.group(1)
    return ut

FORM = lexikon('pharmaceutical-form-lx')
SUBST = lexikon('substance-description-lx')

def f(rx, s, grupp=1):
    m = re.search(rx, s, re.S)
    return m.group(grupp).strip() if m else None

index = []
katalog = os.path.join(npldir, 'Productdata')
for fil in sorted(os.listdir(katalog)):
    s = open(os.path.join(katalog, fil), encoding='utf-8').read()
    huvud = s.split('<npl:packages>')[0]
    packs = []
    for p in re.findall(r'<npl:package>(.*?)</npl:package>', s, re.S):
        packs.append({'nplpackid': f(r'<mpa:nplpackid>(\d+)</mpa:nplpackid>', p), 'text': f(r'<mpa:pack-text>\s*<mpa:v>(.*?)</mpa:v>', p),
                      'avregistrerad': f(r'<mpa:pack-withdrawaldate>([^<]*)</mpa:pack-withdrawaldate>', p), 'parallelldistribuerad': 'npl:para-dist-organization' in p})
    index.append({
        'npl': f(r'<mpa:nplid>(\d+)</mpa:nplid>', huvud),
        'namn': f(r'<mpa:medprodnamelegal v="([^"]*)"', huvud),
        'styrka': f(r'<mpa:strength-text>\s*<mpa:v>(.*?)</mpa:v>', huvud),
        'form': FORM.get(f(r'<mpa:pharmaceutical-form-lx v="([^"]*)"', huvud) or '', None),
        'substans': SUBST.get(f(r'<mpa:substance-description-lx v="([^"]*)"', huvud) or '', None),
        'atc': f(r'<mpa:atc-code-lx v="([^"]*)"', huvud),
        'vagar': re.findall(r'<mpa:route-of-administration-lx v="([^"]*)"', huvud),
        'klass': f(r'<mpa:productclass-lx v="([^"]*)"', huvud),
        'godkand': f(r'<mpa:approvaldate>([^<]*)</mpa:approvaldate>', huvud),
        'avregistrerad': f(r'<mpa:withdrawaldate>([^<]*)</mpa:withdrawaldate>', huvud),
        'stoppad': f(r'<mpa:salesstopped v="([^"]*)"', huvud) == 'Y',
        'forpackningar': packs,
    })
json.dump(index, open(utfil, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(index), 'produkter')
