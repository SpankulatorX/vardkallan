// Runda 13, r1: kända begränsningar som testarna ser på startsidan för testare (#/testa) och på sidan Om demon (#/om),
// så att de inte lägger tid på att rapportera det som projektet redan vet. Listan är data och uppdateras här.
// Varje post: rubrik (kort) och text (vad som saknas eller är förenklat). Fältet kalla är fynd ur det utforskande testet
// och visas inte.
import { esc } from './ui.js';

export const KANDA_BEGRANSNINGAR = [
  { rubrik: 'Nationella tjänster är simulerade', text: 'Anslutningarna till Nationell patientöversikt (NPÖ), Nationella läkemedelslistan (NLL), 1177, e-remiss, laboratorier och andra nationella tjänster är simulerade i demon. Det som skickas och tas emot där kommer inte från någon riktig tjänst.' },
  { rubrik: 'Recept med uttag och expeditionsintervall', text: 'Förskrivning av recept med antal uttag och expeditionsintervall finns inte än.', kalla: 'E1-13' },
  { rubrik: 'Sjukintyg till Försäkringskassan', text: 'Läkarintyg för sjukpenning och andra intyg till Försäkringskassan finns inte än.', kalla: 'E1-15' },
  { rubrik: 'Partogram och födelsens uppgifter', text: 'Partogrammet har inte alla fält som barnmorskor dokumenterar, till exempel varnings- och åtgärdslinje, fosterljud och värkar, och registreringen av födelsen saknar en del av förlossningsberättelsens uppgifter.', kalla: 'E2-32, E2-33, E2-35' },
  { rubrik: 'Arbetslista för barnavårdscentralen', text: 'BVC-sjuksköterskan har ingen egen arbetslista med barnen, nästa besök i programmet och försenade besök och doser.', kalla: 'E2-37' },
  { rubrik: 'Mall för fysioterapi', text: 'Det finns ingen fysioterapeutisk journalmall med KVÅ-koder för åtgärderna och mätvärden som gångtest och Borg.', kalla: 'E2-42' },
  { rubrik: 'Överrapportering för hela avdelningen', text: 'Det finns ingen rapportvy för hela avdelningen eller teamet inför nästa pass.', kalla: 'E2-52' },
  { rubrik: 'Andra kontroll i cytostatikaberedningen', text: 'En separat kontroll och frisläppning av en andra person innan dosen lämnar beredningen finns inte än.', kalla: 'E2-27' },
  { rubrik: 'Kontroller före och under transfusion', text: 'Vitalparametrar före, efter 15 minuter och efter en transfusion, och kontrollen av en enhet i taget vid sängen, är förenklade.', kalla: 'E2-55' },
  { rubrik: 'Incheckning med id och frikort', text: 'Incheckningen kontrollerar inte identitet, kontaktuppgifter eller frikort, och kassan ger inget kvitto direkt efter betalningen.', kalla: 'E3-12' },
  { rubrik: 'Dagens arbete vid avbrott', text: 'Vårdadministratörens Dagens arbete och tidbok finns inte i läskopian när servern inte svarar.', kalla: 'E3-51' },
];

// Den ihopfällda listan, som startsidan och sidan Om demon visar.
export const begransningarHtml = (id) => `<details class="ruta kanda" id="${id}"><summary>Kända begränsningar (${KANDA_BEGRANSNINGAR.length})</summary>
  <p class="liten dampad">Det här vet projektet redan om. Du behöver inte rapportera det, men säg gärna till om något av det är extra viktigt i ditt arbete.</p>
  <ul>${KANDA_BEGRANSNINGAR.map(b => `<li><strong>${esc(b.rubrik)}.</strong> ${esc(b.text)}</li>`).join('')}</ul></details>`;
