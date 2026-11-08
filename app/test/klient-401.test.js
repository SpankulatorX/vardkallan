// Ett anrop som startade före en inloggning och svarar 401 efteråt får inte logga ut den nya sessionen.
// Felet syntes i tillgänglighetstestet: efter inloggningen kom tre 401 från anrop som gjordes på inloggningssidan,
// och gränssnittet gick tillbaka till inloggningen.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { api, krokar, nySession } from '../public/js/ui.js';

const svar = (status) => new Response(JSON.stringify({ fel: 'Inte inloggad' }), { status, headers: { 'Content-Type': 'application/json' } });
let fetchFore;
beforeEach(() => { fetchFore = globalThis.fetch; globalThis.performance ??= { now: () => Date.now() }; });
afterEach(() => { globalThis.fetch = fetchFore; krokar.vid401 = null; });

describe('Klienten, 401', () => {
  test('ett 401 på ett anrop från före inloggningen loggar inte ut, men ett 401 i den nuvarande sessionen gör det', async () => {
    let utloggad = 0;
    krokar.vid401 = () => { utloggad++; };
    let slapp;
    globalThis.fetch = () => new Promise(r => { slapp = () => r(svar(401)); });
    const gammalt = api('/api/nagot').catch(e => e.status);
    // Inloggningen blir klar medan det gamla anropet väntar på svar.
    nySession();
    slapp();
    expect(await gammalt).toBe(401);
    expect(utloggad).toBe(0);
    // Ett anrop i den nya sessionen som får 401 loggar ut som förut.
    globalThis.fetch = async () => svar(401);
    expect(await api('/api/nagot').catch(e => e.status)).toBe(401);
    expect(utloggad).toBe(1);
  });
});
