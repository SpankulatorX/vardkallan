// Streckkod Code 128 (kodtabell B) för provtagningsetiketterna (runda 8, r1, Sussa 4.4.3), utan externa bibliotek.
// Kodningen följer ISO/IEC 15417: startkod B, tecknen, kontrollsiffran (startkodens värde plus varje teckens värde gånger
// dess position, modulo 103) och stoppkoden. Varje mönster är bredderna på streck och mellanrum i moduler, och varje
// tecken är 11 moduler brett (stoppkoden 13). Streckkoden innehåller bara etikettens id, aldrig patientens uppgifter.

const MONSTER = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
export const START_B = 104;
export const STOPP = 106;
export const MONSTERTABELL = MONSTER;

// Värdena i kodtabell B: tecknen från mellanslag (32) till tilde (126) har värdet teckenkoden minus 32.
export function varden(text) {
  const s = String(text);
  if (!s.length || s.length > 40) throw new Error('Streckkoden ska ha 1 till 40 tecken.');
  const v = [...s].map(c => c.charCodeAt(0) - 32);
  if (v.some(x => x < 0 || x > 94)) throw new Error('Streckkoden kan bara innehålla tecken från mellanslag till tilde.');
  return v;
}
export function kontrollsiffra(v) {
  return (START_B + v.reduce((s, x, i) => s + x * (i + 1), 0)) % 103;
}

// Strecken som [start, bredd] i moduler, med tio moduler tyst zon före och efter.
export function streck(text) {
  const v = varden(text);
  const koder = [START_B, ...v, kontrollsiffra(v), STOPP];
  const ut = [];
  let x = 10;
  for (const k of koder) {
    const m = MONSTER[k];
    for (let i = 0; i < m.length; i++) {
      const b = Number(m[i]);
      if (i % 2 === 0) ut.push([x, b]);
      x += b;
    }
  }
  return { streck: ut, bredd: x + 10 };
}

// Streckkoden som SVG, med etikettens id i klartext under strecken.
export function svg(text, { hojd = 40, modul = 1.5, klartext = true } = {}) {
  const { streck: s, bredd } = streck(text);
  const b = bredd * modul;
  const h = hojd + (klartext ? 14 : 0);
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rader = s.map(([x, w]) => `<rect x="${(x * modul).toFixed(2)}" y="0" width="${(w * modul).toFixed(2)}" height="${hojd}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="streckkod" viewBox="0 0 ${b.toFixed(2)} ${h}" width="${b.toFixed(0)}" height="${h}" role="img" aria-label="Streckkod ${esc(text)}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rader}</g>${klartext ? `<text x="${(b / 2).toFixed(2)}" y="${hojd + 12}" text-anchor="middle" font-family="monospace" font-size="11" fill="#000">${esc(text)}</text>` : ''}</svg>`;
}
