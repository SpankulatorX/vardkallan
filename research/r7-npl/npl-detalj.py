# Läser ut detaljer för angivna NPL-id ur en uppackad NPL-totalfil (runda 7, r7). Filerna läses bara som data.
#   python3 -I research/r7-npl/npl-detalj.py <uppackad NPL> <utfil.json> <NPL-id> [...]
# Med: namn (medprodnamelegal), styrka, beredningsform och substansbeskrivning med NPL:s svenska text, ATC-kod,
# administrationsvägar, produktklass, godkännandeförfarande, innehavare (MAH), godkännande- och avregistreringsdatum,
# stoppad försäljning, aktiva beståndsdelar (substans-id och roll) och förpackningar.
import json, os, re, sys

npldir, utfil, ids = sys.argv[1], sys.argv[2], set(sys.argv[3:])

def lexikon(namn, tagg='commonTerm'):
    s = open(os.path.join(npldir, 'Lexicondata', f'{namn}.xml'), encoding='utf-8').read()
    ut = {}
    for t in re.findall(rf'<{tagg}\b.*?</{tagg}>', s, re.S):
        i = re.search(r'<mpaId[^>]*>([^<]*)</mpaId>', t) or re.search(r'id="([^"]*)"', t)
        n = re.search(r'<term-name xml:lang="sv" v="([^"]*)"', t)
        if i and n:
            ut[i.group(1)] = n.group(1)
    return ut

FORM = lexikon('pharmaceutical-form-lx')
SUBST = lexikon('substance-description-lx')
KLASS = lexikon('productclass-lx')
FORF = lexikon('authorisation-procedure-lx')
ROLL = lexikon('ingredient-role-lx')

org = open(os.path.join(npldir, 'Lexicondata', 'organization.xml'), encoding='utf-8').read()

ORG = dict(re.findall(r'<organization id="([^"]*)"[^>]*>\s*<orgname>([^<]*)</orgname>', org))

def orgnamn(oid):
    return ORG.get(oid)

def f(rx, s, grupp=1):
    m = re.search(rx, s, re.S)
    return m.group(grupp).strip() if m else None

ut = []
katalog = os.path.join(npldir, 'Productdata')
for fil in sorted(os.listdir(katalog)):
    s = open(os.path.join(katalog, fil), encoding='utf-8').read()
    npl = f(r'<mpa:nplid>(\d+)</mpa:nplid>', s)
    if npl not in ids:
        continue
    huvud = s.split('<npl:packages>')[0]
    orgs = [(o, r) for o, r in re.findall(r'<mpa:organization-lx v="([^"]*)"\s*/>\s*<mpa:organization-role-lx v="([^"]*)"', huvud)]
    ingred = [(ROLL.get(r, r), sid) for r, sid in re.findall(r'<mpa:ingredient-role-lx v="([^"]*)".*?<mpa:substance-lx v="([^"]*)"', huvud, re.S)]
    packs = []
    for p in re.findall(r'<npl:package>(.*?)</npl:package>', s, re.S):
        packs.append({'nplpackid': f(r'<mpa:nplpackid>(\d+)</mpa:nplpackid>', p), 'text': f(r'<mpa:pack-text>\s*<mpa:v>(.*?)</mpa:v>', p),
                      'avregistrerad': f(r'<mpa:pack-withdrawaldate>([^<]*)</mpa:pack-withdrawaldate>', p), 'parallelldistribuerad': 'npl:para-dist-organization' in p})
    ut.append({
        'fil': fil, 'npl': npl,
        'namn': f(r'<mpa:medprodnamelegal v="([^"]*)"', huvud),
        'styrka': f(r'<mpa:strength-text>\s*<mpa:v>(.*?)</mpa:v>', huvud),
        'form': FORM.get(f(r'<mpa:pharmaceutical-form-lx v="([^"]*)"', huvud) or ''),
        'substans': SUBST.get(f(r'<mpa:substance-description-lx v="([^"]*)"', huvud) or ''),
        'atc': f(r'<mpa:atc-code-lx v="([^"]*)"', huvud),
        'vagar': re.findall(r'<mpa:route-of-administration-lx v="([^"]*)"', huvud),
        'klass': KLASS.get(f(r'<mpa:productclass-lx v="([^"]*)"', huvud) or '', f(r'<mpa:productclass-lx v="([^"]*)"', huvud)),
        'forfarande': FORF.get(f(r'<mpa:authorisation-procedure-lx v="([^"]*)"', huvud) or '', f(r'<mpa:authorisation-procedure-lx v="([^"]*)"', huvud)),
        'organisationer': [{'id': o, 'roll': r, 'namn': orgnamn(o)} for o, r in orgs],
        'godkand': f(r'<mpa:approvaldate>([^<]*)</mpa:approvaldate>', huvud),
        'avregistrerad': f(r'<mpa:withdrawaldate>([^<]*)</mpa:withdrawaldate>', huvud),
        'stoppad': f(r'<mpa:salesstopped v="([^"]*)"', huvud),
        'bestandsdelar': [{'roll': r, 'substans_id': sid} for r, sid in ingred],
        'forpackningar': packs,
    })
json.dump(ut, open(utfil, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for p in ut:
    giltiga = [x for x in p['forpackningar'] if not x['avregistrerad'] and not x['parallelldistribuerad']]
    print(p['npl'], '|', p['namn'], '|', p['styrka'], '|', p['form'], '|', p['substans'], '|', p['atc'], '|', p['klass'], '|', p['forfarande'], '|',
          ';'.join(f"{o['roll']}:{o['namn']}" for o in p['organisationer']), '|', p['godkand'], '|', p['avregistrerad'], '|', p['stoppad'], '|', len(giltiga), '/', len(p['forpackningar']))
