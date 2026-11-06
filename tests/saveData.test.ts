import { describe, expect, it } from 'vitest';
import { parseSaveData, sanitizeEvents } from '../src/game/saveData';
import { decodeWorldCode } from '../src/core/worldCode';

describe('save data from outside', () => {
  it('ignores empty or broken data instead of crashing', () => {
    for (const junk of [undefined, null, {}, [], 'x', 42, { code: 5 }, { code: 'ENIS-0000-0B7M' }, { code: 'nope', minutes: 1 }]) {
      expect(parseSaveData(junk)).toBeNull();
    }
    expect(decodeWorldCode(undefined)).toBeNull();
    expect(decodeWorldCode({})).toBeNull();
  });

  it('accepts saves from milestone 1 (no events)', () => {
    const save = parseSaveData({ code: 'ENIS-0000-0B7M', minutes: 9000, speedIndex: 1 });
    expect(save).toEqual({ code: 'ENIS-0000-0B7M', minutes: 9000, speedIndex: 1, events: [] });
  });

  it('keeps valid events and drops broken ones', () => {
    const events = sanitizeEvents(
      [
        { id: 1, kind: 'volcano', minutes: 10, cell: 5, seed: 7 },
        { id: 2, kind: 'dragon', minutes: 20, cell: 5, seed: 7 },
        { id: 3, kind: 'raise', minutes: 30, cell: 6, seed: 9, stamps: [6, 'x', 99999, 7] },
        null,
      ],
      1000,
    );
    expect(events.map((e) => e.kind)).toEqual(['volcano', 'raise']);
    expect(events[1].stamps).toEqual([6, 7]);
  });

  it('cuts the list where time would run backwards', () => {
    const events = sanitizeEvents([
      { id: 1, kind: 'rain', minutes: 50, cell: 1, seed: 1 },
      { id: 2, kind: 'rain', minutes: 10, cell: 1, seed: 1 },
    ]);
    expect(events.length).toBe(1);
  });
});
