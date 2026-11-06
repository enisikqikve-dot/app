import { t, type MessageKey } from '../i18n';
import type { ChronicleLine } from '../game/peopleInfo';

/** One line of the world chronicle, written like a history book. */
export function chronicleText(l: ChronicleLine, planet: string): string {
  const a = l.a ?? '?';
  const b = l.b ?? '?';
  const c = l.c ?? '?';
  const n = l.n ?? 0;
  const near = l.a ? t('chron.near', { a: l.a }) : '';
  switch (l.key) {
    case 'founders':
      return t('chron.founders', { n, planet, a });
    case 'newcomers':
      return t('chron.newcomers', { n, a });
    case 'birth':
      return l.c ? t('chron.birth', { a, b, c }) : t('chron.birthOf', { a, b });
    case 'twins':
      return t('chron.twins', { a, b, c });
    case 'couple':
      return t('chron.couple', { a, b });
    case 'separated':
      return t('chron.separated', { a, b });
    case 'death':
      return t('chron.death', { a, n, cause: l.s ? t(`cause.${l.s}` as MessageKey) : '' });
    case 'leader':
      return t('chron.leader', { a });
    case 'emigrate':
      return n <= 1 ? t('chron.emigrateAlone', { a }) : t('chron.emigrate', { a, m: n - 1 });
    case 'moved':
      return t('chron.moved', { a });
    case 'population':
      return t('chron.population', { n, planet });
    case 'extinct':
      return t('chron.extinct');
    case 'power':
      return l.s === 'revive' ? t('chron.power.revive', { a }) : t(`chron.power.${l.s}` as MessageKey, { near });
    case 'sign':
      return t(`chron.sign.${Math.max(0, Math.min(2, n))}` as MessageKey, { near });
    default:
      return '';
  }
}
