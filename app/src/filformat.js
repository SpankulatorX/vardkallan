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

