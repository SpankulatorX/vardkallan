// Filformat för kallelser (runda 6, r4, Sussa 3.4.3.3): en enkel PDF och iCalendar, utan externa bibliotek. Strängarna
// här är filformatens egen syntax och inte text som visas, så språkkontrollen (test/sprakkontroll.js) läser inte filen.

const pdfText = (s) => String(s).replace(/[^\x20-\x7e\xa0-\xff]/g, '?').replace(/([\\()])/g, '\\$1');

// En enkel PDF med en sida, Helvetica och WinAnsi-kodning, så att å, ä och ö blir rätt. Inga externa bibliotek.
export function pdf(rader, { titel = 'Kallelse' } = {}) {
  const innehall = ['BT', '50 790 Td'];
  let forst = true;
  for (const r of rader) {
    const storlek = r.storlek ?? 11;
    const steg = Math.round(storlek * 1.45);
    innehall.push(`/${r.fet ? 'F2' : 'F1'} ${storlek} Tf`, forst ? '' : `0 -${steg} Td`, `(${pdfText(r.text)}) Tj`);
    forst = false;
  }
  innehall.push('ET');
  const strom = Buffer.from(innehall.filter(Boolean).join('\n'), 'latin1');
  const objekt = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    null,
    `<< /Title (${pdfText(titel)}) /Producer (Vardkallan, demo) >>`,
  ];
  const delar = [Buffer.from('%PDF-1.4\n%\xe5\xe4\xf6\n', 'latin1')];
  let pos = delar[0].length;
  const xref = [];
  objekt.forEach((o, i) => {
    const huvud = Buffer.from(`${i + 1} 0 obj\n`, 'latin1');
    const kropp = o === null ? Buffer.concat([Buffer.from(`<< /Length ${strom.length} >>\nstream\n`, 'latin1'), strom, Buffer.from('\nendstream', 'latin1')]) : Buffer.from(o, 'latin1');
    const b = Buffer.concat([huvud, kropp, Buffer.from('\nendobj\n', 'latin1')]);
    xref.push(pos);
    pos += b.length;
    delar.push(b);
  });
  const tabell = `xref\n0 ${objekt.length + 1}\n0000000000 65535 f \n${xref.map(x => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}`;
  delar.push(Buffer.from(`${tabell}trailer\n<< /Size ${objekt.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(delar);
}

// iCalendar (RFC 5545): rader med CRLF, högst 75 byte per rad, och tecken som måste skyddas.
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTid = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
function vik(rad) {
  const ut = [];
  let del = '';
  let n = 0;
  for (const tecken of rad) {
    const b = Buffer.byteLength(tecken);
    if (n + b > (ut.length ? 74 : 75)) { ut.push(del); del = ''; n = 0; }
    del += tecken;
    n += b;
  }
  ut.push(del);
  return ut.join('\r\n ');
}
export function ics(handelser) {
  const rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vardkallan//Demo//SV', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const h of handelser) {
    rader.push('BEGIN:VEVENT', `UID:${h.uid}`, `DTSTAMP:${icsTid(new Date())}`, `DTSTART:${icsTid(h.start)}`, `DTEND:${icsTid(h.slut)}`, `SUMMARY:${icsText(h.rubrik)}`,
      `LOCATION:${icsText(h.plats)}`, `DESCRIPTION:${icsText(h.text)}`, `STATUS:${h.avbokad ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  rader.push('END:VCALENDAR');
  return `${rader.map(vik).join('\r\n')}\r\n`;
}

// Runda 8, r1: provtagningsetiketter som PDF (Sussa 4.4.3), utan externa bibliotek. format etikett ger en etikett per
// sida i etikettskrivarens storlek, 57 x 32 mm. format a4 ger ett ark med 3 x 7 etiketter för en vanlig skrivare.
// Streckkoden ritas som rektanglar ur streck (streckkod.js), och varje etikett har rader med text: två före
// streckkoden och resten efter.
//   etiketter: [{ rader: [{ text, fet, storlek }], streck: { streck: [[x, b]], bredd } }]
export function etikettPdf(etiketter, { format = 'etikett', titel = 'Etiketter' } = {}) {
  const mm = (v) => v * 72 / 25.4;
  const sida = format === 'a4' ? { b: 595, h: 842 } : { b: mm(57), h: mm(32) };
  const cell = format === 'a4' ? { b: mm(63.5), h: mm(38.1), kol: 3, rad: 7, x0: mm(7.2), y0: mm(15.1) } : { b: sida.b, h: sida.h, kol: 1, rad: 1, x0: 0, y0: 0 };
  const perSida = cell.kol * cell.rad;
  const sidor = [];
  for (let i = 0; i < Math.max(1, etiketter.length); i += perSida) sidor.push(etiketter.slice(i, i + perSida));
  const text = (ut, r, x, y, std) => ut.push('BT', `/${r.fet ? 'F2' : 'F1'} ${r.storlek ?? std} Tf`, `${x.toFixed(2)} ${y.toFixed(2)} Td`, `(${pdfText(r.text)}) Tj`, 'ET');
  const strommar = sidor.map(lista => {
    const ut = [];
    lista.forEach((e, i) => {
      const kx = cell.x0 + (i % cell.kol) * cell.b;
      const ky = sida.h - cell.y0 - Math.floor(i / cell.kol) * cell.h;
      const kant = mm(2.5);
      let y = ky - kant - 7;
      for (const r of e.rader.slice(0, 2)) { text(ut, r, kx + kant, y, 7); y -= (r.storlek ?? 7) + 2; }
      if (e.streck) {
        const tillganglig = cell.b - 2 * kant;
        const modul = Math.min(1.2, tillganglig / e.streck.bredd);
        const hojd = mm(9);
        const x0 = kx + kant + (tillganglig - e.streck.bredd * modul) / 2;
        y -= hojd - 4;
        for (const [x, b] of e.streck.streck) ut.push(`${(x0 + x * modul).toFixed(2)} ${y.toFixed(2)} ${(b * modul).toFixed(2)} ${hojd.toFixed(2)} re f`);
        y -= 8;
      }
      for (const r of e.rader.slice(2)) { text(ut, r, kx + kant, y, 6); y -= (r.storlek ?? 6) + 1.5; }
    });
    return Buffer.from(ut.join('\n'), 'latin1');
  });
  // Objekt: 1 katalog, 2 sidor, 3 och 4 typsnitt, 5 info, sedan sida och innehåll för varje sida.
  const objekt = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${sidor.map((_, i) => `${6 + 2 * i} 0 R`).join(' ')}] /Count ${sidor.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${pdfText(titel)}) /Producer (Vardkallan, demo) >>`,
  ];
  strommar.forEach((s, i) => {
    objekt.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${sida.b.toFixed(2)} ${sida.h.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`);
    objekt.push(s);
  });
  const delar = [Buffer.from('%PDF-1.4\n%\xe5\xe4\xf6\n', 'latin1')];
  let pos = delar[0].length;
  const xref = [];
  objekt.forEach((o, i) => {
    const huvud = Buffer.from(`${i + 1} 0 obj\n`, 'latin1');
    const kropp = Buffer.isBuffer(o) ? Buffer.concat([Buffer.from(`<< /Length ${o.length} >>\nstream\n`, 'latin1'), o, Buffer.from('\nendstream', 'latin1')]) : Buffer.from(o, 'latin1');
    const b = Buffer.concat([huvud, kropp, Buffer.from('\nendobj\n', 'latin1')]);
    xref.push(pos);
    pos += b.length;
    delar.push(b);
  });
  const tabell = `xref\n0 ${objekt.length + 1}\n0000000000 65535 f \n${xref.map(x => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}`;
  delar.push(Buffer.from(`${tabell}trailer\n<< /Size ${objekt.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(delar);
}

