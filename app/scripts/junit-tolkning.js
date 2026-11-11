// Tolkar bun tests JUnit-rapport till en lista med { namn, fil, status }. Namnet är gruppernas och testets namn
// åtskilda med " > ", som kravregistret och Sussa-mappningen pekar på. Används av kor-tester.js och klocktest.js.
const avkoda = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'");
const attr = (s, namn) => { const m = s.match(new RegExp(`\\s${namn}="([^"]*)"`)); return m ? avkoda(m[1]) : null; };

export function tolkaJunit(text) {
  const tester = [];
  const stack = [];
  let aktuell = null;
  for (const m of text.matchAll(/<(\/?)(testsuites|testsuite|testcase|failure|error|skipped)\b([^>]*?)(\/?)>/g)) {
    const [, stang, tagg, attrs, sjalvstangd] = m;
    if (tagg === 'testsuite') {
      if (stang) stack.pop();
      else if (!sjalvstangd) stack.push({ namn: attr(attrs, 'name'), fil: attr(attrs, 'file') });
    } else if (tagg === 'testcase') {
      if (stang) { if (aktuell) tester.push(aktuell); aktuell = null; continue; }
      const grupper = stack.slice(1).map(s => s.namn);
      const t = { namn: [...grupper, attr(attrs, 'name')].join(' > '), fil: stack[0]?.namn ?? null, status: 'grön' };
      if (sjalvstangd) tester.push(t); else aktuell = t;
    } else if ((tagg === 'failure' || tagg === 'error') && aktuell && !stang) aktuell.status = 'röd';
    else if (tagg === 'skipped' && aktuell && !stang) aktuell.status = 'hoppad';
  }
  return tester;
}
