// Socialstyrelsens kodverkslista för uppmärksamhetsinformation (runda 10, r4, Sussa 3.1.5.1): termerna med ICD-10-SE,
// ATC och Snomed CT och motiveringarna, inlästa som data ur bilagan till informationsspecifikationen version 6.1.2
// (seed/umi-kodverkslista.json, se docs/kodkontroll.md). Allt som registreras som uppmärksamhetsinformation, och allt som
// systemet föreslår, är en term ur listan, så att dokumentationen följer den nationella rekommendationen.
//
// Systemet är experten: en diagnos eller ett läkemedel i journalen leder själv till rätt term med koder och motivering.
// Ingen behöver kunna kodverkslistan, Snomed CT eller ICD-10-SE.
import lista from './seed/umi-kodverkslista.json' with { type: 'json' };

export const KODVERK = lista;
export const KALLA = `${lista.kalla.namn}, ${lista.kalla.utgivare}, ${lista.kalla.publicerad}`;
export const TERMER = lista.termer;
const PER_ID = new Map(TERMER.map(t => [t.id, t]));
const PER_TERM = new Map(TERMER.map(t => [`${t.undergrupp}:${t.term.toLocaleLowerCase('sv')}`, t]));

// De id som användes före kodverkslistan pekar på listans termer.
export const ALIAS = Object.freeze({
  'svar-intubation': 'svarintuberad', 'avbojer-blod': 'patienten-accepterar-ej-blod-eller-plasmatransfusion',
  brytpunktssamtal: 'lakarbeslut-finns-fran-brytpunktssamtal', 'avsta-hlr': 'lakarbeslut-finns-om-att-inte-utfora-hjart-lungraddning',
  addison: 'addisons-sjukdom', sallsynt: 'sallsynt-halsotillstand-som-behover-uppmarksammas-sarskilt', uretrasfinkter: 'artificiell-uretrasfinkter',
});
export const termMedId = (id) => (typeof id === 'string' ? PER_ID.get(Object.hasOwn(ALIAS, id) ? ALIAS[id] : id) ?? null : null);
export const termFor = (undergrupp, term) => (typeof term === 'string' ? PER_TERM.get(`${undergrupp}:${term.toLocaleLowerCase('sv')}`) ?? null : null);

// Snomed CT-begrepp i den svenska utgåvans namnrymd (1000052) finns inte i den internationella utgåvan.
export const svensktBegrepp = (kod) => /1000052\d{3}$/.test(String(kod));

// Termen som den lämnas ut: koderna, motiveringen, undergruppens OID och urval och källan.
export function nationell(t) {
  if (!t) return null;
  const ug = lista.undergrupper[t.undergrupp] ?? {};
  return {
    id: t.id, term: t.term, icd: t.icd, kombination: t.kombination, atc: t.atc, snomed: t.snomed, motivering: t.motivering,
    oid: ug.oid ?? null, urval: ug.urval ?? null, kalla: KALLA,
  };
}

// Termerna som en diagnos leder till. En kod i listan med tre tecken gäller hela kategorin. En kombination av koder,
// som för MRSA, gäller när alla koderna finns, och den första får vara mindre specifik i journalen (Z22.3 för Z22.3C).
export function forDiagnoser(koder) {
  const har = (k, forsta = false) => koder.some(d => d === k || (k.length === 3 && d.startsWith(`${k}.`)) || (forsta && k.startsWith(d) && d.length >= 5));
  return TERMER.filter(t => t.icd.length && t.kategori !== 'overkanslighet' && !(t.undergrupp === 'behandling' && t.atc.length)).flatMap(t => {
    if (t.kombination) return t.icd.every((k, i) => har(k, i === 0)) ? [{ t, kod: koder.find(d => d === t.icd[0] || t.icd[0].startsWith(d)) }] : [];
    const kod = koder.find(d => t.icd.some(k => d === k || (k.length === 3 && d.startsWith(`${k}.`))));
    return kod ? [{ t, kod }] : [];
  });
}

// Reaktionen vid en överkänslighet som en term ur listan, om texten nämner den.
export function reaktionFor(text, grad) {
  const s = String(text ?? '').toLocaleLowerCase('sv');
  if (!s) return null;
  const alla = [...lista.reaktioner.varning.map(r => ({ ...r, varning: true })), ...lista.reaktioner.observandum.map(r => ({ ...r, varning: false }))];
  const r = /anafylax/.test(s) ? alla.find(x => x.term === 'Anafylaktisk reaktion') : alla.find(x => s.includes(x.term.toLocaleLowerCase('sv')));
  if (!r) return null;
  return { term: r.term, snomed: r.snomed, typ: r.varning ? 'Varningsinformation' : 'Observandum', grad: grad ?? null };
}
