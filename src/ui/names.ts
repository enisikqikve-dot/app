import { getLang, t, type MessageKey } from '../i18n';
import type { SpeciesId } from '../sim/life/types';
import type { InventionId } from '../sim/life/inventions';

const DE_PLURAL: Record<SpeciesId, string> = { deer: 'Hirsche', bison: 'Wildrinder', mammoth: 'Mammuts', wolf: 'Wölfe' };
const DE_ONE: Record<SpeciesId, string> = { deer: 'Hirsch', bison: 'Wildrind', mammoth: 'Mammut', wolf: 'Wolf' };
const EN_PLURAL: Record<SpeciesId, string> = { deer: 'deer', bison: 'bison', mammoth: 'mammoths', wolf: 'wolves' };
const EN_ONE: Record<SpeciesId, string> = { deer: 'deer', bison: 'bison', mammoth: 'mammoth', wolf: 'wolf' };
const DE_PREFIX: Record<string, string> = { giant: 'Riesen', dwarf: 'Zwerg', woolly: 'Woll', bare: 'Kurzhaar', swift: 'Flink', heavy: 'Schwer' };
const EN_PREFIX: Record<string, string> = { giant: 'giant', dwarf: 'dwarf', woolly: 'woolly', bare: 'short-haired', swift: 'swift', heavy: 'heavy' };

/** "Wollhirsche", "Riesen-Wollmammut", "woolly deer" … */
export function speciesName(base: SpeciesId, prefix: string, plural = true): string {
  const parts = prefix ? prefix.split('+') : [];
  if (getLang() === 'en') {
    const name = [...parts.map((p) => EN_PREFIX[p] ?? p), plural ? EN_PLURAL[base] : EN_ONE[base]].join(' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  const noun = plural ? DE_PLURAL[base] : DE_ONE[base];
  if (parts.length === 0) return noun;
  const words = parts.map((p) => DE_PREFIX[p] ?? p);
  const last = words.pop()!;
  return [...words, last + noun.toLowerCase()].join('-');
}

/** How a herd differs from its ancestors, e.g. "groß · dickes Fell". */
export function geneWords(genes: readonly number[]): string {
  const out: string[] = [];
  if (genes[0] > 0.62) out.push(t('gene.big'));
  if (genes[0] < 0.38) out.push(t('gene.small'));
  if (genes[1] > 0.62) out.push(t('gene.thickFur'));
  if (genes[1] < 0.38) out.push(t('gene.thinFur'));
  if (genes[2] > 0.62) out.push(t('gene.fast'));
  if (genes[2] < 0.38) out.push(t('gene.slow'));
  return out.length ? out.join(' · ') : t('gene.normal');
}

export function inventionName(id: InventionId | string): string {
  return t(`invention.${id}` as MessageKey);
}

/** "Der Himmelsgeist", or in a sentence "den Himmelsgeist". */
export function deityName(id: string, inSentence = false): string {
  return t(`${inSentence ? 'deityAcc' : 'deity'}.${id}` as MessageKey);
}
