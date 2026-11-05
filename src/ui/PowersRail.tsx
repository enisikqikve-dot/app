import type { ComponentType } from 'preact';
import { t, type MessageKey } from '../i18n';
import { IconBlessing, IconLife, IconLock, IconNature, IconWhisper } from './icons';

interface Power {
  key: MessageKey;
  Icon: ComponentType<{ size?: number }>;
  milestone: number;
}

/** The four powers from the concept, unlocked milestone by milestone. */
const POWERS: Power[] = [
  { key: 'powers.nature', Icon: IconNature, milestone: 2 },
  { key: 'powers.blessing', Icon: IconBlessing, milestone: 3 },
  { key: 'powers.life', Icon: IconLife, milestone: 3 },
  { key: 'powers.whisper', Icon: IconWhisper, milestone: 4 },
];

export function PowersRail({ onLocked }: { onLocked: (message: string) => void }) {
  return (
    <nav class="powers glass" aria-label={t('powers.title')}>
      <span class="powers-title">{t('powers.title')}</span>
      {POWERS.map(({ key, Icon, milestone }) => {
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
