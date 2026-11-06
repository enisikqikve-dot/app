import { describe, expect, it } from 'vitest';
import { decodeHistory, encodeHistory, saveFileName } from '../src/game/share';
import type { PowerEvent } from '../src/sim/powers';

describe('sharing a world by code', () => {
  it('packs the planet, the start and every power into a code and back', async () => {
    const events: PowerEvent[] = [
      { id: 1, kind: 'sign', minutes: 1000, cell: 12, seed: 99, extra: 1 },
      { id: 2, kind: 'createPeople', minutes: 2000, cell: 40, seed: 7, extra: 5 },
      { id: 3, kind: 'wLove', minutes: 3000, cell: 41, seed: 8, target: 17, other: 23 },
      { id: 4, kind: 'raise', minutes: 3100, cell: 50, seed: 9, stamps: [50, 51, 52] },
      { id: 5, kind: 'timeSkip', minutes: 4000, cell: -1, seed: 1, extra: 57600 },
    ];
    const code = await encodeHistory({ code: 'ENIS-0000-0B7M', start: 360, minutes: 90000, events });
    expect(code.startsWith('ENIS-0000-0B7M.')).toBe(true);
    const back = await decodeHistory(code);
    expect(back).not.toBeNull();
    expect(back!.start).toBe(360);
    expect(back!.minutes).toBe(90000);
    expect(back!.events).toEqual(events);
  });

  it('refuses broken codes', async () => {
    expect(await decodeHistory('ENIS-0000-0B7M')).toBeNull();
    expect(await decodeHistory('ENIS-0000-0B7M.zAAAA')).toBeNull();
    expect(await decodeHistory('hello.jworld')).toBeNull();
  });

  it('names saved files after the planet and the year', () => {
    expect(saveFileName('Troton', 1203)).toBe('eNis-Troton-1203.json');
  });
});
