// Tillväxtkurvor (runda 7, r6) ritade som SVG utan externa bibliotek, för personalen och för vårdnadshavaren i Min
// journal. Referenslinjerna är WHO:s standard vid -2, -1, 0, +1 och +2 SD. Punkterna har olika form efter källa, så
// att färgen inte är enda bäraren: cirkel för vården, kvadrat för en bekräftad mätning hemma, ring för en mätning hemma
// som väntar och romb för födelsen. Tabellen under kurvan har alla värden.
import { esc, tal, datum } from './ui.js';

const ALDER = (m) => {
  if (m < 1) return `${Math.round(m * 30.4375 / 7)} v`;
  if (m < 24) return `${Math.round(m)} mån`;
  return `${tal(m / 12, 1)} år`;
};
export const alderText = ALDER;
export const zText = (z) => (z == null ? '' : `${z > 0 ? '+' : z < 0 ? 'minus ' : ''}${tal(Math.abs(Math.round(z * 10) / 10), 1)} SD`);
const KALLA = { vard: 'Mätt i vården', hemma: 'Mätt hemma', fodsel: 'Vid födelsen' };
export const kallaText = (p) => (p.vantar ? 'Mätt hemma, väntar på bekräftelse' : KALLA[p.kalla] ?? '');

// Spannet i månader som kurvan visar: barnets ålder plus tre månader, och minst ett år.
export const spann = (k, till = null) => {
  const sista = Math.max(0, ...k.punkter.map(p => p.alder));
  return Math.min(60, till ?? Math.max(12, Math.ceil(sista + 3)));
};

// En kurva. k: { matt, namn, enhet, punkter, linjer }. handelser: [{ alder, text }]. till: månader som visas.
export function kurvaSvg(k, { handelser = [], till = null, fran = 0 } = {}) {
  const B = 360, H = 220, V = 38, HO = 46, T = 10, U = 26;
  const max = spann(k, till);
  const synligaLinjer = k.linjer.map(l => ({ ...l, punkter: l.punkter.filter(([m]) => m >= fran && m <= max) }));
  const pkt = k.punkter.filter(p => p.alder >= fran && p.alder <= max);
  const varden = [...synligaLinjer.flatMap(l => l.punkter.map(([, v]) => v)), ...pkt.map(p => p.varde)];
  if (!varden.length) return '';
  let ymin = Math.min(...varden), ymax = Math.max(...varden);
  const luft = (ymax - ymin) * 0.06 || 1;
  ymin -= luft; ymax += luft;
  const x = (m) => V + ((m - fran) / Math.max(1, max - fran)) * (B - V - HO);
  const y = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - U);
  const linjer = synligaLinjer.map(l => {
    if (!l.punkter.length) return '';
    const sista = l.punkter.at(-1);
    return `<polyline class="tv-ref tv-sd${l.sd < 0 ? 'm' : 'p'}${Math.abs(l.sd)}" points="${l.punkter.map(([m, v]) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>
      <text class="kurva-text" x="${(x(sista[0]) + 3).toFixed(1)}" y="${(y(sista[1]) + 3).toFixed(1)}">${l.sd === 0 ? 'median' : `${l.sd > 0 ? '+' : '-'}${Math.abs(l.sd)} SD`}</text>`;
  }).join('');
  // Rutnät och etiketter på åldersaxeln.
  const steg = max - fran <= 12 ? 2 : max - fran <= 24 ? 3 : 12;
  const xEtiketter = [];
  for (let m = Math.ceil(fran / steg) * steg; m <= max; m += steg) xEtiketter.push(`<line class="tv-rut" x1="${x(m).toFixed(1)}" x2="${x(m).toFixed(1)}" y1="${T}" y2="${H - U}"/><text class="kurva-text" x="${x(m).toFixed(1)}" y="${H - U + 13}" text-anchor="middle">${esc(m === 0 ? '0' : ALDER(m))}</text>`);
  const yEtikett = (v) => `<text class="kurva-text" x="${V - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(tal(v, k.matt === 'vikt' ? 1 : 0))}</text>`;
  const ev = handelser.filter(h => h.alder >= fran && h.alder <= max).map((h, i) => `<line class="tv-handelse" x1="${x(h.alder).toFixed(1)}" x2="${x(h.alder).toFixed(1)}" y1="${T}" y2="${H - U}"/><text class="tv-handelse-nr" x="${(x(h.alder) + 2).toFixed(1)}" y="${T + 9}">${i + 1}</text>`).join('');
  const bekr = pkt.filter(p => !p.vantar && p.kalla !== 'fodsel');
  const lin = bekr.length > 1 ? `<polyline class="tv-barn" points="${bekr.map(p => `${x(p.alder).toFixed(1)},${y(p.varde).toFixed(1)}`).join(' ')}"/>` : '';
  const punkt = (p) => {
    const cx = x(p.alder).toFixed(1), cy = y(p.varde).toFixed(1);
    if (p.kalla === 'fodsel') return `<path class="tv-punkt tv-fodsel" d="M${cx} ${(cy - 5).toFixed(1)}l5 5-5 5-5-5z"/>`;
    if (p.vantar) return `<circle class="tv-punkt tv-vantar" cx="${cx}" cy="${cy}" r="4.5"/>`;
    if (p.kalla === 'hemma') return `<rect class="tv-punkt tv-hemma" x="${(cx - 3.5).toFixed(1)}" y="${(cy - 3.5).toFixed(1)}" width="7" height="7"/>`;
    return `<circle class="tv-punkt" cx="${cx}" cy="${cy}" r="3.5"/>`;
  };
  const sist = bekr.at(-1);
  const besk = `${k.namn} efter ålder med WHO:s referenslinjer. ${pkt.length} värden${sist ? `, senast ${tal(sist.varde, k.matt === 'vikt' ? 2 : 1)} ${k.enhet} vid ${ALDER(sist.alder)}, ${zText(sist.z)}` : ''}.`;
  return `<svg class="kurva tv-kurva" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(besk)}" preserveAspectRatio="xMidYMid meet">
    ${xEtiketter.join('')}
    <line class="kurva-axel" x1="${V}" x2="${V}" y1="${T}" y2="${H - U}"/><line class="kurva-axel" x1="${V}" x2="${B - HO}" y1="${H - U}" y2="${H - U}"/>
    ${yEtikett(ymax - luft)}${yEtikett((ymax + ymin) / 2)}${yEtikett(ymin + luft)}
    <text class="kurva-text" x="${V}" y="${H - 2}">Ålder</text><text class="kurva-text" x="${V - 4}" y="${T - 1}" text-anchor="end">${esc(k.enhet)}</text>
    ${linjer}${ev}${lin}${pkt.map(punkt).join('')}
  </svg>`;
}

// Teckenförklaringen, en gång per vy.
export const teckenforklaring = () => `<ul class="tv-tecken" aria-label="Teckenförklaring">
  <li><svg viewBox="0 0 14 14" aria-hidden="true"><circle class="tv-punkt" cx="7" cy="7" r="3.5"/></svg>Mätt i vården</li>
  <li><svg viewBox="0 0 14 14" aria-hidden="true"><rect class="tv-punkt tv-hemma" x="3.5" y="3.5" width="7" height="7"/></svg>Mätt hemma, bekräftad</li>
  <li><svg viewBox="0 0 14 14" aria-hidden="true"><circle class="tv-punkt tv-vantar" cx="7" cy="7" r="4.5"/></svg>Mätt hemma, väntar</li>
  <li><svg viewBox="0 0 14 14" aria-hidden="true"><path class="tv-punkt tv-fodsel" d="M7 2l5 5-5 5-5-5z"/></svg>Vid födelsen</li>
  <li><svg viewBox="0 0 20 14" aria-hidden="true"><line class="tv-ref tv-sdp0" x1="0" x2="20" y1="7" y2="7"/></svg>Median</li>
  <li><svg viewBox="0 0 20 14" aria-hidden="true"><line class="tv-ref tv-sdp2" x1="0" x2="20" y1="7" y2="7"/></svg>Plus och minus 2 SD</li>
</ul>`;

// Tabellen med alla värden för en kurva, nyast först.
export const tabell = (k) => (k.punkter.length ? `<details class="tv-tabell"><summary>Alla värden för ${esc(k.namn.toLowerCase())}</summary><div class="tabellrulle"><table class="tabell">
  <thead><tr><th scope="col">Datum</th><th scope="col">Ålder</th><th scope="col">${esc(k.namn)}</th><th scope="col">SD</th><th scope="col">Percentil</th><th scope="col">Källa</th></tr></thead>
  <tbody>${[...k.punkter].reverse().map(p => `<tr${p.vantar ? ' class="tv-rad-vantar"' : ''}><td>${esc(datum(p.tid))}</td><td>${esc(ALDER(p.alder))}</td><td>${esc(tal(p.varde, k.matt === 'vikt' ? 3 : 1))} ${esc(k.enhet)}</td><td>${esc(zText(p.z))}</td><td>${p.percentil ?? ''}</td><td>${esc(kallaText(p))}</td></tr>`).join('')}</tbody>
</table></div></details>` : '');
