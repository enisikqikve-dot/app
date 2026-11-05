import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/core/rng';
import { decodeWorldCode, encodeWorldCode, PLANET_SIZES } from '../src/core/worldCode';
import { planetName } from '../src/core/names';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('forks independent, stable streams', () => {
    const base = new Rng(7);
    expect(base.fork('terrain').next()).toBe(new Rng(7).fork('terrain').next());
    expect(base.fork('terrain').next()).not.toBe(base.fork('clouds').next());
  });

  it('stays in range', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('hashes strings to 32-bit integers', () => {
    expect(hashString('eNis')).toBe(hashString('eNis'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('world codes', () => {
  it('round-trips seeds and sizes', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 200; i++) {
      const seed = Math.floor(rng.next() * 0xffffffff) >>> 0;
      const size = PLANET_SIZES[i % 3];
      const code = encodeWorldCode({ seed, size });
      expect(code).toMatch(/^ENIS-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      expect(decodeWorldCode(code)).toEqual({ seed, size });
    }
  });

  it('handles the extremes', () => {
    for (const seed of [0, 1, 0xffffffff]) {
      expect(decodeWorldCode(encodeWorldCode({ seed, size: 'medium' }))?.seed).toBe(seed);
    }
  });

  it('accepts sloppy typing', () => {
    const code = encodeWorldCode({ seed: 123456789, size: 'large' });
    const sloppy = code.toLowerCase().replace(/-/g, ' ').replace('enis', '');
    expect(decodeWorldCode(sloppy)).toEqual({ seed: 123456789, size: 'large' });
  });

  it('rejects invalid codes', () => {
    expect(decodeWorldCode('')).toBeNull();
    expect(decodeWorldCode('ENIS-1234')).toBeNull();
    expect(decodeWorldCode('ENIS-1234-567X')).toBeNull(); // unknown size
    expect(decodeWorldCode('ENIS-ZZZZ-ZZZM')).toBeNull(); // seed > 32 bits
    expect(decodeWorldCode('ENIS-UUUU-UUUM')).toBeNull(); // U is not in the alphabet
  });
});

describe('planet names', () => {
  it('are stable and pronounceable', () => {
    expect(planetName(5)).toBe(planetName(5));
    for (let s = 0; s < 50; s++) {
      const name = planetName(s);
      expect(name.length).toBeGreaterThanOrEqual(4);
      expect(name[0]).toBe(name[0].toUpperCase());
    }
  });
});
