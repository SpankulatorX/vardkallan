"""Minimal xlsx-läsare med standardbiblioteket. läs_ark(sökväg) -> lista av rader (första arket)."""
import re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def _kol(ref):
    s = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for c in s:
        n = n * 26 + ord(c) - 64
    return n - 1


def läs_ark(p, ark=1):
    z = zipfile.ZipFile(p)
    delade = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            delade.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    rot = ET.fromstring(z.read('xl/worksheets/sheet%d.xml' % ark))
    rader = []
    for row in rot.iter('{%s}row' % NS['m']):
        rad = {}
        for c in row.findall('m:c', NS):
            v = c.find('m:v', NS)
            t = c.get('t')
            if t == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
            elif v is None:
                continue
            elif t == 's':
                val = delade[int(v.text)]
            elif t in ('str', 'b', 'e'):
                val = v.text
            else:
                val = v.text  # behåll som sträng för exakt värde
            rad[_kol(c.get('r'))] = val
        if rad:
            m = max(rad)
            rader.append([rad.get(i) for i in range(m + 1)])
    return rader


if __name__ == '__main__':
    for r in läs_ark(sys.argv[1])[: int(sys.argv[2]) if len(sys.argv) > 2 else 5]:
        print(r)
