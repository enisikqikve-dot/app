/**
 * World codes: a short, typeable code for a start planet, e.g. "ENIS-7K3P-Q9MS".
 *
 * 7 characters hold the 32-bit seed (Crockford base32), the 8th is the planet
 * size. Crockford base32 has no I, L, O or U, so the code is hard to misread;
 * when typing, O is read as 0 and I/L as 1.
 */

export type PlanetSize = 'small' | 'medium' | 'large';

export const PLANET_SIZES: readonly PlanetSize[] = ['small', 'medium', 'large'];

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SIZE_CHAR: Record<PlanetSize, string> = { small: 'S', medium: 'M', large: 'L' };
const CHAR_SIZE: Record<string, PlanetSize> = { S: 'small', M: 'medium', L: 'large' };
const PREFIX = 'ENIS';

export interface WorldSpec {
  seed: number;
  size: PlanetSize;
}

export function encodeWorldCode(spec: WorldSpec): string {
  let value = spec.seed >>> 0;
  let seedChars = '';
  for (let i = 0; i < 7; i++) {
    seedChars = ALPHABET[value % 32] + seedChars;
    value = Math.floor(value / 32);
  }
  const body = seedChars + SIZE_CHAR[spec.size];
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Parses a world code. Accepts lower case, missing dashes and a missing prefix. */
export function decodeWorldCode(input: string): WorldSpec | null {
  let text = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (text.startsWith(PREFIX)) text = text.slice(PREFIX.length);
  if (text.length !== 8) return null;

  const size = CHAR_SIZE[text[7]];
  if (!size) return null;

  let value = 0;
  for (let i = 0; i < 7; i++) {
    const ch = text[i].replace('O', '0').replace(/[IL]/, '1');
    const digit = ALPHABET.indexOf(ch);
    if (digit < 0) return null;
    value = value * 32 + digit;
  }
  if (value > 0xffffffff) return null;
  return { seed: value >>> 0, size };
}
