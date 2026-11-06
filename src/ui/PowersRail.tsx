import type { ComponentType } from 'preact';
import { t, type MessageKey } from '../i18n';
import type { PowerCategory } from '../sim/powers';
import { IconBlessing, IconLife, IconLock, IconNature, IconWhisper } from './icons';

interface Group {
  key: MessageKey;
  Icon: ComponentType<{ size?: number }>;
  category: PowerCategory | null;
  /** Milestone in which a locked group unlocks. */
  milestone?: number;
}

/** The four groups of powers from the concept, unlocked milestone by milestone. */
const GROUPS: Group[] = [
  { key: 'powers.nature', Icon: IconNature, category: 'nature' },
  { key: 'powers.blessing', Icon: IconBlessing, category: 'blessing' },
  { key: 'powers.life', Icon: IconLife, category: 'life' },
  { key: 'powers.whisper', Icon: IconWhisper, category: null, milestone: 4 },
];

interface Props {
  open: PowerCategory | null;
  onOpen: (category: PowerCategory) => void;
  onLocked: (message: string) => void;
}

export function PowersRail({ open, onOpen, onLocked }: Props) {
  return (
    <nav class="powers glass" aria-label={t('powers.title')}>
      <span class="powers-title">{t('powers.title')}</span>
      {GROUPS.map(({ key, Icon, category, milestone }) => {
        if (category) {
          return (
            <button
              key={key}
              type="button"
              class={`power${open === category ? ' is-open' : ''}`}
              aria-expanded={open === category}
              title={t(key)}
              onClick={() => onOpen(category)}
            >
              <span class="power-icon">
                <Icon size={22} />
              </span>
              <span class="power-label">{t(key)}</span>
            </button>
          );
        }
        const soon = t('powers.soon', { n: milestone ?? 0 });
        return (
          <button
            key={key}
            type="button"
            class="power is-locked"
            aria-disabled="true"
            title={`${t(key)} · ${soon}`}
            onClick={() => onLocked(`${t(key)}: ${soon}`)}
          >
            <span class="power-icon">
              <Icon size={22} />
              <span class="power-lock">
                <IconLock size={11} />
              </span>
            </span>
            <span class="power-label">{t(key)}</span>
          </button>
        );
      })}
    </nav>
  );
}
