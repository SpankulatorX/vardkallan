// Logglistan i journalen. Den lämnas ut av logggranskaren, som har den enda rollen som får läsa loggen.
import { esc } from '../ui.js';
import { far } from '../app.js';

export async function visa(el, ctx) {
  const namn = ctx.patient.skyddad && !ctx.patient.identitetVisad ? 'patienten' : ctx.patient.namn;
  el.innerHTML = `<div class="flikhuvud"><h2>Logglista</h2></div>
    <div class="ruta ruta-info logg-forklaring">
      <p>Varje gång någon öppnar journalen loggas vem det var, när, på vilken enhet och på vilken grund: egen enhet, vårdrelation, aktivt val, nödåtkomst eller samtycke. Loggen är en hashkedja i en databas där rader inte kan ändras eller tas bort.</p>
      <p>Patienten har rätt att få veta vem som har tagit del av journalen (patientdatalagen 8 kap. 5 §). Logglistan till ${esc(namn)} lämnas ut av logggranskaren på begäran. ${far('las_logg') ? '' : 'Din yrkesroll kan inte läsa loggen, så att den som dokumenterar inte också granskar sig själv.'}</p>
      <p>Logga in som Mats Wall, logggranskare, för att se logglistan för den här patienten, med din egen åtkomst i dag överst.</p>
    </div>`;
}
