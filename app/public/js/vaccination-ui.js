// Runda 13, r4 (E2-39): fälten för en dos som ges, gemensamma för barnhälsovården (fliken Tillväxt) och de andra
// vaccinationsprogrammen (fliken Vaccinationer): kontrollen före vaccinationen, batchnummer, utgångsdatum och
// injektionsställe. Servern prövar samma sak (bhv.js, provaVaccinationsdetaljer).
import { esc, idag } from './ui.js';

const STALLEN = { lar_vanster: 'Vänster lår', lar_hoger: 'Höger lår', arm_vanster: 'Vänster överarm', arm_hoger: 'Höger överarm', mun: 'I munnen (droppar)' };
export const KONTROLL = 'Är patienten frisk i dag, utan feber, och har inte reagerat kraftigt på en tidigare dos?';

export const dosFaltHtml = (prefix, { barn = false } = {}) => `
  <fieldset class="kryssgrupp"><legend>${esc(barn ? KONTROLL.replace('patienten', 'barnet') : KONTROLL)}</legend>
    <div class="kryssfalt"><input type="radio" id="${prefix}-k-ja" name="kontroll" value="ja"><label for="${prefix}-k-ja">Ja</label></div>
    <div class="kryssfalt"><input type="radio" id="${prefix}-k-nej" name="kontroll" value="nej"><label for="${prefix}-k-nej">Nej, eller osäkert</label></div>
  </fieldset>
  <div class="falt-rad">
    <div class="falt"><label for="${prefix}-batch">Batchnummer</label><input id="${prefix}-batch" name="batch" maxlength="40" autocomplete="off"></div>
    <div class="falt"><label for="${prefix}-utgang">Utgångsdatum</label><input id="${prefix}-utgang" name="utgang" type="date" min="${esc(idag())}"></div>
    <div class="falt"><label for="${prefix}-stalle">Injektionsställe</label><select id="${prefix}-stalle" name="stalle">${Object.entries(STALLEN).map(([k, t]) => `<option value="${k}"${k === (barn ? 'lar_vanster' : 'arm_vanster') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
  </div>
  <p class="hjalp">Systemet föreslår injektionsstället efter åldern. Batchnummer och utgångsdatum står på förpackningen.</p>`;

// Kontrollen i dialogen: utan ja på frågan ges ingen dos.
export const provaDosFalt = (x) => (!x.kontroll ? 'Svara på frågan före vaccinationen.'
  : x.kontroll === 'nej' ? 'Ge inte dosen i dag. Vid feber eller akut sjukdom skjuts vaccinationen upp, och efter en kraftig reaktion på en tidigare dos bedömer läkaren om dosen kan ges.' : null);

export const dosData = (x) => ({ kontroll: x.kontroll === 'ja', batch: x.batch?.trim() || undefined, utgang: x.utgang || undefined, stalle: x.stalle || undefined });
