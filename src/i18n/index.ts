import { de, type MessageKey } from './de';
import { en } from './en';
import { safeStorage } from '../core/store';

export type Lang = 'de' | 'en';
export const LANGS: readonly Lang[] = ['de', 'en'];
export type { MessageKey };

const DICTS: Record<Lang, Record<MessageKey, string>> = { de, en };
const STORAGE_KEY = 'enis.lang';

let current: Lang = detectLanguage();

function detectLanguage(): Lang {
  const saved = safeStorage.get(STORAGE_KEY);
  if (saved === 'de' || saved === 'en') return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'de';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'de';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  safeStorage.set(STORAGE_KEY, lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text = DICTS[current][key] ?? DICTS.de[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(current === 'de' ? 'de-DE' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}
