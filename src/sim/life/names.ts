import type { Rng } from '../../core/rng';
import type { Sex } from './types';

const START = ['A', 'Ba', 'Da', 'E', 'Ga', 'I', 'Ka', 'Lo', 'Ma', 'Na', 'O', 'Ra', 'Sa', 'Ta', 'U', 'Va', 'Ya', 'Ke', 'Mi', 'To', 'Ru', 'Zo', 'Ne', 'Hu'];
const MIDDLE = ['', '', 'ri', 'la', 'no', 'ka', 'mi', 'to', 'ru', 'shi', 'ya', 'en'];
const END_F = ['a', 'i', 'e', 'ra', 'na', 'la', 'ya', 'mi'];
const END_M = ['k', 'r', 'n', 'o', 'u', 'rok', 'tan', 'mar', 'l'];

/** Short names that could come from any early language, e.g. "Ara", "Tok", "Mina". */
export function personName(rng: Rng, sex: Sex): string {
  const end = sex === 'f' ? END_F : END_M;
  let name = rng.pick(START) + rng.pick(MIDDLE) + rng.pick(end);
  if (name.length > 7) name = name.slice(0, 7);
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
