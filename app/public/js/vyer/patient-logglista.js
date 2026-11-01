// Logglistan i journalen. Personalen läser den inte: logggranskaren har den enda rollen som får läsa loggen, och patienten
// ser själv vem som har läst journalen i Min journal.
import { esc } from '../ui.js';
import { far } from '../app.js';

export async function visa(el, ctx) {
  const namn = ctx.patient.skyddad && !ctx.patient.identitetVisad ? 'patienten' : ctx.patient.namn;
  el.innerHTML = `<div class="flikhuvud"><h2>Logglista</h2></div>
    <div class="ruta ruta-info logg-forklaring">
      <p>Varje gång någon öppnar journalen loggas vem det var, när, på vilken enhet och på vilken grund: egen enhet, vårdrelation, aktivt val, nödåtkomst eller samtycke. Loggen är en hashkedja i en databas där rader inte kan ändras eller tas bort.</p>
      <p>Patienten har rätt att få information om åtkomsten till journalen (patientdatalagen 8 kap. 5 §). ${esc(namn === 'patienten' ? 'Patienten' : namn)} ser själv i Min journal, Vårdkällans e-tjänst för invånare, vilken vårdenhet och yrkesroll som har läst journalen, när och på vilken grund. Ett loggutdrag med namn lämnas ut av vården på begäran. ${far('las_logg') ? '' : 'Din yrkesroll kan inte läsa loggen, så att den som dokumenterar inte också granskar sig själv.'}</p>
      <p>Logga in som Mats Wall, logggranskare, för att se hela logglistan för den här patienten, eller logga in som patienten under Patient på inloggningssidan för att se den som patienten ser den.</p>
    </div>`;
}
