import { Rng } from './rng';

const ONSETS = ['', 'b', 'd', 'g', 'k', 'l', 'm', 'n', 'r', 's', 't', 'v', 'z', 'th', 'sh', 'kr', 'tr', 'dr', 'vel', 'or'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'ai', 'ae', 'ou'];
const CODAS = ['', '', '', 'n', 'r', 's', 'l', 'th', 'm', 'x'];

/** A pronounceable planet name from a seed, e.g. "Taluron" or "Vesmira". */
export function planetName(seed: number): string {
  const rng = new Rng(seed).fork('planet-name');
  const syllables = rng.int(2, 3);
  let name = '';
  for (let i = 0; i < syllables; i++) {
    name += rng.pick(ONSETS) + rng.pick(VOWELS);
    if (i === syllables - 1 || rng.chance(0.3)) name += rng.pick(CODAS);
  }
  if (name.length < 4) name += rng.pick(['ra', 'on', 'is', 'ea']);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
