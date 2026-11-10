// Läkemedel som inte är godkända produkter i NPL (Sussa 3.5.2.4): extempore, licensläkemedel, egendefinierade
// läkemedel, blodprodukter och nutrition. Alla är påhittade demoposter utan NPL-id, och namnen säger vilken typ de är.
// ATC-koderna är kontrollerade mot WHO:s ATC-register 2026 (src/kodverk.js). kcalPerMl gäller nutrition.
const P = (nr, prefix, typ, namn, substans, styrka, form, atc, beskrivning, extra = {}) => ({ id: `VK-${prefix}-${String(nr).padStart(4, '0')}`, typ, namn, substans, styrka, form, atc, beskrivning, ...extra });

export const PRODUKTER = [
  P(1, 'EXT', 'extempore', 'Morfin oral lösning, extempore', 'morfin', '1 mg/ml', 'oral lösning', 'N02AA01',
    'Extemporeberedning som apoteket tillverkar för en patient. Demopost.'),
  P(1, 'LIC', 'licens', 'Tiamin injektionsvätska, licens', 'tiamin', '50 mg/ml', 'injektionsvätska, lösning', 'A11DA01',
    'Licensläkemedel som kräver beviljad licens. Systemet bevakar licensens giltighet. Demopost.'),
  P(1, 'EGEN', 'egendefinierad', 'Kaliumklorid koncentrat, egendefinierad', 'kaliumklorid', '1 mmol/ml', 'koncentrat till infusionsvätska', 'B05XA01',
    'Egendefinierad tillsats som används i en infusion. Demopost.'),
  P(2, 'EGEN', 'egendefinierad', 'Natriumklorid infusion, egendefinierad', 'natriumklorid', '9 mg/ml', 'infusionsvätska, lösning', 'B05XA03',
    'Egendefinierad basvätska för infusion med tillsatser. Demopost.'),
  P(1, 'BLOD', 'blodprodukt', 'Erytrocytkoncentrat', 'erytrocyter', '1 enhet', 'blodkomponent', 'B05AX01',
    'Blodkomponent från blodcentralen. Patientens identitet och blodgrupp kontrolleras vid sängen. Demopost.'),
  P(2, 'BLOD', 'blodprodukt', 'Plasma', 'plasma', '1 enhet', 'blodkomponent', 'B05AX03',
    'Blodkomponent från blodcentralen. Demopost.'),
  P(1, 'NUT', 'nutrition', 'Näringsdryck 1,5 kcal/ml', 'näringsdryck', '200 ml', 'dryck', 'V06DB',
    'Kosttillägg som dryck. Kalorierna räknas in i vätskebalansen. Demopost.', { kcalPerMl: 1.5 }),
  P(2, 'NUT', 'nutrition', 'Sondnäring 1 kcal/ml', 'sondnäring', '500 ml', 'sondnäring', 'V06DB',
    'Sondnäring. Kalorierna och volymen räknas in i vätskebalansen. Demopost.', { kcalPerMl: 1 }),
  // Runda 9, r1: syrgas ur vårdenhetens centrala gasuttag, ordinerad i liter per minut (Sussa 3.5.2.17). I demon en egen
  // post och inte en produkt ur NPL. ATC-koden är kontrollerad mot WHO:s ATC/DDD-index.
  P(3, 'EGEN', 'egendefinierad', 'Medicinsk syrgas, egendefinierad', 'oxygen', '100 %', 'medicinsk gas för inhalation', 'V03AN01',
    'Syrgas ur vårdenhetens gasuttag, ordinerad i liter per minut med utrustning och mål för saturationen. Demopost.'),
  // Runda 9, r1: prövningsläkemedlet i den påhittade kliniska prövningen DEMO-HF-01 (Sussa 3.5.5.1). Substansen finns,
  // men studien och produkten är påhittade.
  P(4, 'EGEN', 'egendefinierad', 'Prövningsläkemedel DEMO-HF-01, egendefinierad', 'finerenon', '20 mg', 'filmdragerad tablett', 'C03DA05',
    'Prövningsläkemedel i den påhittade kliniska prövningen DEMO-HF-01. Får bara ordineras till studiens deltagare. Demopost.'),
  // Runda 11, r4: trombocyter från blodcentralen, så att varje blodprodukt i blodbeställningen blir en ordination i
  // läkemedelslistan (blod.js). ATC-koden är kontrollerad mot WHO:s ATC-register.
  P(3, 'BLOD', 'blodprodukt', 'Trombocytkoncentrat', 'trombocyter', '1 enhet', 'blodkomponent', 'B05AX02',
    'Blodkomponent från blodcentralen. Demopost.'),
];
