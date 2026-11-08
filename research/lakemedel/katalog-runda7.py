# Väljer de nya produkterna i läkemedelskatalogen (runda 7, r1) ur indexet från npl-index.py och skriver dem som
# rader för app/src/seed/lakemedel-katalog.js, facit för app/src/kodverk.js (NPL) och ett utdrag för
# forpackningar-seed.py. Varje produkt ska finnas exakt en gång med det namn, den styrka och den form som anges, vara
# godkänd, inte avregistrerad, inte ha stoppad försäljning och ha minst en förpackning som inte är avregistrerad eller
# parallelldistribuerad. Annars stoppar skriptet.
#   python3 -I research/lakemedel/katalog-runda7.py <index.json> <utkatalog>
import json, os, sys

index = json.load(open(sys.argv[1], encoding='utf-8'))
ut = sys.argv[2]

# Sussas 22 läkemedel i Bilaga F1:3 tabell 6. Fyra finns redan i katalogen (Alvedon 500 mg, Metformin 500 mg, Morfin
# injektionsvätska, Sertralin 50 mg, Waran och Zopiklon 5 mg). Där Sussas produkt inte finns i NPL står en annan
# produkt med samma substans, styrka och form: Atrovent Nasal heter i dag Rinivent, Paracetamol Panpharma finns inte i
# Sverige, och den buffrade glukosen är Baxters.
SUSSA = [
    ('Addex-Magnesium', '1 mmol/ml', 'Koncentrat till infusionsvätska, lösning'),
    ('Alvedon forte', '1 g', 'Filmdragerad tablett'),
    ('Atrovent', '20 mikrogram/dos', 'Inhalationsspray, lösning', '20120904000099'),
    ('Atrovent', '0,25 mg/ml', 'Lösning för nebulisator', '19870213000054'),
    ('Atrovent', '0,5 mg/ml', 'Lösning för nebulisator'),
    ('Rinivent', '21 mikrogram/dos', 'Nässpray, lösning'),
    ('Glucos Baxter 25 mg/ml buffrad', None, 'Infusionsvätska, lösning'),
    ('Kloramfenikol Santen', '5 mg/ml', 'Ögondroppar, lösning'),
    ('Kloramfenikol Santen', '10 mg/g', 'Ögonsalva'),
    ('Metformin Teva', '850 mg', 'Filmdragerad tablett'),
    ('Morfin Alternova', '10 mg', 'Tablett'),
    ('Paracetamol Fresenius Kabi', '10 mg/ml', 'Infusionsvätska, lösning'),
    ('Sertralin Teva Pharma', '100 mg', 'Filmdragerad tablett'),
    ('Stesolid', '5 mg', 'Tablett'),
    ('Stesolid', '10 mg', 'Tablett'),
    ('Zopiklon Pilum', '7,5 mg', 'Filmdragerad tablett'),
]
# Fler styrkor av produkter och substanser som redan finns, så att katalogen får minst 100 produkter med ATC-koder
# som redan är kontrollerade mot WHO:s register.
FLER = [
    ('Metoprolol Sandoz', '100 mg', 'Depottablett'), ('Bisoprolol Teva', '2,5 mg', 'Tablett'), ('Bisoprolol Teva', '10 mg', 'Tablett'),
    ('Spironolakton Pfizer', '50 mg', 'Tablett'), ('Spironolakton Pfizer', '100 mg', 'Tablett'),
    ('Enalapril Krka', '5 mg', 'Tablett'), ('Enalapril Krka', '20 mg', 'Tablett'), ('Oxikodon Actavis', '20 mg', 'Kapsel, hård'), ('Mirtazapin Krka', '45 mg', 'Filmdragerad tablett'),
    ('Losartan Krka', '12,5 mg', 'Filmdragerad tablett'), ('Losartan Krka', '100 mg', 'Filmdragerad tablett'),
    ('Amlodipin Krka', '10 mg', 'Tablett'), ('Atorvastatin Krka', '10 mg', 'Filmdragerad tablett', '20070404'), ('Atorvastatin Krka', '20 mg', 'Filmdragerad tablett', '20070404'),
    ('Simvastatin Krka', '10 mg', 'Filmdragerad tablett'), ('Simvastatin Krka', '40 mg', 'Filmdragerad tablett'),
    ('Jardiance', '25 mg', 'Filmdragerad tablett'), ('Levaxin', '50 mikrogram', 'Tablett'), ('Levaxin', '25 mikrogram', 'Tablett'),
    ('Omeprazol Sandoz', '40 mg', 'Enterokapsel, hård'), ('Ibuprofen Orifarm', '200 mg', 'Filmdragerad tablett'), ('Ibuprofen Orifarm', '600 mg', 'Filmdragerad tablett'),
    ('Naproxen Orifarm', '500 mg', 'Tablett'), ('Oxikodon Actavis', '10 mg', 'Kapsel, hård'), ('Escitalopram Krka', '5 mg', 'Filmdragerad tablett'),
    ('Escitalopram Krka', '20 mg', 'Filmdragerad tablett'), ('Mirtazapin Krka', '30 mg', 'Filmdragerad tablett'), ('Donepezil Krka', '10 mg', 'Filmdragerad tablett'),
    ('Prednisolon Pfizer', '10 mg', 'Tablett'), ('Eliquis', '2,5 mg', 'Filmdragerad tablett'), ('Xarelto', '15 mg', 'Filmdragerad tablett'),
    ('Xarelto', '10 mg', 'Filmdragerad tablett'), ('Brilique', '60 mg', 'Filmdragerad tablett'), ('Trombyl', '160 mg', 'Tablett'),
    ('Levaxin', '75 mikrogram', 'Tablett'), ('Metformin Sandoz', '1000 mg', 'Filmdragerad tablett'), ('Amoxicillin Sandoz', '500 mg', 'Filmdragerad tablett'),
]

def giltig(p):
    packs = [x for x in p['forpackningar'] if not x['avregistrerad'] and not x['parallelldistribuerad'] and x['text']]
    return not p['avregistrerad'] and not p['stoppad'] and p['godkand'] and packs

valda, fel = [], []
for rad in SUSSA + FLER:
    namn, styrka, form = rad[:3]
    ett = rad[3] if len(rad) > 3 else None
    traff = [p for p in index if p['namn'] == namn and p['styrka'] == styrka and p['form'] == form and giltig(p) and (not ett or p['npl'].startswith(ett))]
    if len(traff) != 1:
        fel.append(f'{namn} {styrka} {form}: {len(traff)} träffar')
        continue
    valda.append(traff[0])
if fel:
    print('\n'.join(fel))
    sys.exit(1)
os.makedirs(ut, exist_ok=True)
json.dump(valda, open(os.path.join(ut, 'valda.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for p in valda:
    print(p['npl'], p['namn'], p['styrka'], p['form'], p['substans'], p['atc'], ','.join(p['vagar']), p['godkand'])
print(len(valda), 'produkter')
