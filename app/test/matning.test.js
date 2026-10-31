import { test, expect } from 'bun:test';
import { Matning } from '../src/server.js';
import { testserver } from './hjalp.js';

test('svarstidsmätningen har ett tak för antalet nycklar', () => {
  const m = new Matning(10, 5);
  for (let i = 0; i < 50; i++) m.lagg(`GET /api/x${i}`, 1);
  const nycklar = m.sammanstall().map(r => r.endpoint);
  expect(nycklar.length).toBe(6);
  expect(nycklar).toContain('övrigt');
});

test('okända sökvägar mäts under en gemensam nyckel', async () => {
  const app = testserver();
  try {
    for (let i = 0; i < 20; i++) await fetch(`${app.url}/api/finns-inte-${i}`);
    const r = await (await fetch(`${app.url}/api/drift`)).json();
    const nycklar = r.server.map(x => x.endpoint);
    expect(nycklar.filter(n => n.includes('finns-inte'))).toEqual([]);
    expect(nycklar).toContain('GET okänd');
  } finally { app.stopp(); }
});
