// Behörighetsdialoger: aktivt val, nödåtkomst, samtycke till spärrade uppgifter och visa identitet.
// Reglerna gäller på servern. Dialogerna förklarar dem och samlar in syftet, som loggas.
import { esc, api, dialog, notis, ikon, felNotis } from './ui.js';

const VAL = {
  andra_enheter: {
    rubrik: 'Visa uppgifter från andra vårdenheter',
    text: `<p>Du ser din egen vårdenhets uppgifter. Uppgifter från andra vårdenheter i Region Örebro län omfattas av inre sekretess och visas först när du gör ett aktivt val.</p>
      <p>Ange varför du behöver uppgifterna. Valet loggas och gäller den här patienten tills du loggar ut. Spärrade uppgifter visas inte genom ett aktivt val.</p>`,
    forslag: ['Bedöma aktuellt vårdbehov', 'Läkemedelsgenomgång', 'Tidigare utredningar behövs för behandlingen'],
    knapp: 'Visa uppgifterna',
    klar: 'Uppgifter från andra vårdenheter visas nu. Valet är loggat.',
  },
  nodatkomst: {
    rubrik: 'Nödåtkomst',
    text: `<p>Du har ingen vårdrelation med patienten. Nödåtkomst får användas bara när patienten inte kan samtycka och uppgifterna behövs för vården nu.</p>
      <p>Åtkomsten loggas och flaggas, och logggranskaren följer upp den i efterhand. Du ska kunna motivera varför den behövdes.</p>
      <p>Spärrade uppgifter visas inte ens vid nödåtkomst.</p>`,
    intyg: 'Patienten kan inte samtycka, och uppgifterna behövs för vården nu.',
    forslag: ['Medvetslös vid ankomst, kan inte samtycka', 'Akut omhändertagande, patienten kan inte svara'],
    knapp: 'Öppna med nödåtkomst',
    klar: 'Journalen är öppnad med nödåtkomst. Åtkomsten är loggad och följs upp.',
    allvar: true,
  },
  samtycke_sparr: {
    rubrik: 'Patienten samtycker till att spärren tillfälligt hävs',
    text: `<p>Patienten har spärrat uppgifter från en annan vårdenhet. Du ser inte vilken enhet det gäller eller vad uppgifterna handlar om.</p>
      <p>Spärren kan hävas tillfälligt bara om patienten själv samtycker, nu i stunden. Fråga patienten och registrera samtycket bara om patienten säger ja. Samtycket loggas och gäller tills du loggar ut.</p>`,
    intyg: 'Patienten har samtyckt nu, muntligt eller skriftligt.',
    forslag: ['Patienten samtycker muntligt vid läkemedelsgenomgång', 'Patienten samtycker inför bedömning av behandling'],
    knapp: 'Registrera samtycket',
    klar: 'Samtycket är registrerat och loggat. De spärrade uppgifterna visas nu.',
  },
  visa_identitet: {
    rubrik: 'Visa identitet',
    text: `<p>Patienten har skyddade personuppgifter. Namn och fullständigt personnummer visas bara när du behöver dem i vården, till exempel för säker identifiering. Adressen visas aldrig.</p>
      <p>Valet loggas. Säg aldrig patientens namn högt i väntrum eller korridor.</p>`,
    forslag: ['Säker identifiering inför provtagning', 'Identitetskontroll inför behandling'],
    knapp: 'Visa identitet',
    klar: 'Identiteten visas. Valet är loggat.',
  },
};

export async function valDialog(typ, patientId) {
  const v = VAL[typ];
  const svar = await dialog(`<form>
      <h2 id="dlg-rubrik">${v.allvar ? ikon.varning : ''}${esc(v.rubrik)}</h2>
      <div class="dialog-text">${v.text}</div>
      <fieldset class="forslag"><legend>Vanliga syften</legend>${v.forslag.map(f => `<button type="button" class="knapp liten sekundar" data-forslag="${esc(f)}">${esc(f)}</button>`).join('')}</fieldset>
      <div class="falt"><label for="dlg-syfte">Syfte <span class="obl">(obligatoriskt, loggas)</span></label>
        <textarea id="dlg-syfte" name="syfte" rows="2" required minlength="3" maxlength="300" autofocus></textarea></div>
      ${v.intyg ? `<div class="kryssfalt"><input type="checkbox" id="dlg-intyg" name="intyg" value="ja" required><label for="dlg-intyg">${esc(v.intyg)}</label></div>` : ''}
      <p class="dialog-fel form-fel" role="alert" hidden></p>
      <div class="knapprad"><button type="button" class="knapp${v.allvar ? ' knapp-allvar' : ''}" data-varde="ok">${esc(v.knapp)}</button><button type="button" class="knapp sekundar" data-varde="avbryt">Avbryt</button></div>
    </form>`, {
    klass: v.allvar ? 'dialog-allvar' : '',
    onOpen: (dl) => dl.addEventListener('click', e => {
      const f = e.target.closest('[data-forslag]');
      if (f) { const t = dl.querySelector('textarea'); t.value = f.dataset.forslag; t.focus(); }
    }),
    validera: (d) => (d.syfte.trim().length < 3 ? 'Skriv syftet med minst tre tecken.' : null),
  });
  if (!svar) return false;
  try {
    await api(`/api/patient/${encodeURIComponent(patientId)}/val`, { metod: 'POST', data: { typ, syfte: svar.data.syfte.trim() } });
    notis(v.klar);
    return true;
  } catch (e) { felNotis(e); return false; }
}

// Lugn förklaring när åtkomsten nekas. Försöket är redan loggat på servern.
export function nekadRuta(e, { rubrik = 'Du kan inte öppna den här journalen' } = {}) {
  return `<div class="ruta ruta-nekad" role="status">
    <h2>${ikon.las}${esc(rubrik)}</h2>
    <p>${esc(e?.message ?? 'Åtkomsten nekades.')}</p>
    <p class="dampad">Journalen öppnas bara när det finns en grund: vårdrelation på din enhet, ett aktivt val, nödåtkomst eller samtycke. Försöket är loggat, som alla försök att öppna en journal.</p>
  </div>`;
}
