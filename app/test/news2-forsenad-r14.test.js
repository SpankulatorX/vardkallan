// Runda 14, r5: en försenad kontroll enligt NEWS2 i inkorgen har åtgärderna som en lista, som ett larm, så att
// inkorgen går att visa också på kvällen när kontrollerna har hunnit bli försenade (gränssnittet slår ihop listan).
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { stallKlockan, aterstallKlockan } from './falsk-klocka.js';
import { testserver, klient } from './hjalp.js';

describe('NEWS2 i inkorgen (runda 14, r5)', () => {
  beforeEach(() => stallKlockan(new Date('2026-11-12T20:30:00Z')));
  afterEach(() => aterstallKlockan());

  test('åtgärden för en försenad kontroll är en lista, som för ett larm', async () => {
    const app = testserver();
    try {
      for (const id of ['ssk-kard', 'lak-kard']) {
        const k = klient(app);
        await k.logga(id);
        const larm = (await k.get('/api/inkorg')).data.news2Larm;
        expect(larm.some(x => x.forsenad), id).toBe(true);
        for (const x of larm) expect(Array.isArray(x.atgard), `${id} ${x.rubrik}`).toBe(true);
      }
    } finally { app.stopp(); }
  }, 30_000);
});
