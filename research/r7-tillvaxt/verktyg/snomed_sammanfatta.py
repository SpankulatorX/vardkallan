"""Lägger till en sammanställning av Tanner-begreppen och anmärkningar i snomed-uppslag.json."""
import json, os, sys

p = os.path.join(sys.argv[1], 'snomed-uppslag.json')
d = json.load(open(p))
d['tanner'] = {
    'brost_flickor': {'observation': '251811005', 'fynd_overbegrepp': '365402005',
                      'stadium': {'1': '251812003', '2': '251813008', '3': '251814002', '4': '251815001', '5': '251816000'}},
    'genitalia_pojkar': {'observation': '251805007', 'fynd_overbegrepp': '365401003',
                         'stadium': {'1': '251806008', '2': '251807004', '3': '251808009', '4': '251809001', '5': '251810006'}},
    'pubesbeharing': {'observation': '251817009', 'fynd_overbegrepp': '365403000',
                      'stadium': {'1': '251818004', '2': '251819007', '3': '251820001', '4': '251821002', '5': '251822009'},
                      'ovrigt': {'251823004': 'Hair spread to linea alba (behåring mot linea alba, ibland kallat stadium 6)'}},
    'axillbeharing': {'observation': '251824005', 'fynd_overbegrepp': '365404006',
                      'stadium_i_sokningen': {'1': '251825006', '2': '251826007', '3': '251827003', '4': '302086000', '5': '302087009'},
                      'not': 'Axillstadierna kommer ur sökningen Tanner men är inte uppslagna en och en.'},
}
d['anmarkningar'] = [
    '248334005 Length of body är inaktiv sedan 2021-07-31 i International Edition 20250201. Uppslaget ger ingen ersättare. '
    'Aktiva begrepp i samma område: 1153637007 Body height och 1149101003 Recumbent body height (liggande längd, förälder 1153637007). '
    '169886007 Birth length har 1149101003 som förälder.',
    '53851000052106 och 53861000052109 (svensk utgåva) finns inte på tx.fhir.org, som svarar 404 Unknown code i International Edition 20250201.',
    '70931000052102 Body height of biological father och 70941000052108 Body height of biological mother har svenskt namnrymdsid (1000052) '
    'men finns på tx.fhir.org i International Edition 20250201 med modul 900000000000207008 och effectiveTime 2024-03-01.',
    'Pubesbehåringens stadier heter inte Tanner i Snomed CT men är barn till 365403000 Finding of pubic hair stage. '
    'Koppling stadium 1 till 5 för pubesbehåring efter ordningen i Tanners beskrivning; den står inte som siffra i begreppens namn.',
    'Alla uppslag gjordes mot tx.fhir.org/r4, som har International Edition. Den svenska utgåvan (modul 45991000052106) kräver licens och är inte kontrollerad.',
]
json.dump(d, open(p, 'w'), indent=1, ensure_ascii=False)
print('ok')
