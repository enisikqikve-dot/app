import type { ComponentType } from 'preact';
import { t, type MessageKey } from '../i18n';
import { IconBlessing, IconLife, IconLock, IconNature, IconWhisper } from './icons';

interface Power {
  key: MessageKey;
  Icon: ComponentType<{ size?: number }>;
  /** Milestone in which this group unlocks; 0 = available now. */
  milestone: number;
}

/** The four groups of powers from the concept, unlocked milestone by milestone. */
const POWERS: Power[] = [
  { key: 'powers.nature', Icon: IconNature, milestone: 0 },
  { key: 'powers.blessing', Icon: IconBlessing, milestone: 3 },
  { key: 'powers.life', Icon: IconLife, milestone: 3 },
  { key: 'powers.whisper', Icon: IconWhisper, milestone: 4 },
];

interface Props {
  natureOpen: boolean;
  onNature: () => void;
  onLocked: (message: string) => void;
}

export function PowersRail({ natureOpen, onNature, onLocked }: Props) {
  return (
    <nav class="powers glass" aria-label={t('powers.title')}>
      <span class="powers-title">{t('powers.title')}</span>
      {POWERS.map(({ key, Icon, milestone }) => {
        if (milestone === 0) {
          return (
            <button
              key={key}
              type="button"
              class={`power${natureOpen ? ' is-open' : ''}`}
              aria-expanded={natureOpen}
              title={t(key)}
              onClick={onNature}
            >
              <span class="power-icon">
                <Icon size={22} />
              </span>
              <span class="power-label">{t(key)}</span>
            </button>
          );
        }
        const soon = t('powers.soon', { n: milestone });
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
