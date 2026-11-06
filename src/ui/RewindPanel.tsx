import { useEffect, useRef } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import { dateFromMinutes } from '../sim/clock';
import type { RewindPoint } from '../game/Game';
import { POWER_ICONS } from './PowerPalette';
import { IconClose, IconRewind } from './icons';

interface Props {
  points: RewindPoint[];
  onPick: (point: RewindPoint) => void;
  onClose: () => void;
}

export function RewindPanel({ points, onPick, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside class="rewind glass-strong" aria-labelledby="rewind-title">
      <div class="place-head">
        <h2 id="rewind-title" class="panel-title">
          {t('rewind.title')}
        </h2>
        <button ref={closeRef} type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <p class="note">{t('rewind.note')}</p>
      {points.length === 0 ? (
        <p class="place-text">{t('rewind.empty')}</p>
      ) : (
        <ul class="rewind-list">
          {points.map((p) => {
            const d = dateFromMinutes(p.minutes);
            const Icon = p.kind ? POWER_ICONS[p.kind] : IconRewind;
            const label = p.kind
              ? t('rewind.before', { power: t(`power.${p.kind}` as MessageKey) })
              : t('rewind.decade', { year: formatNumber(d.year) });
            return (
              <li key={`${p.minutes}-${p.eventCount}-${p.kind ?? 'decade'}`}>
                <button type="button" class="rewind-item" onClick={() => onPick(p)}>
                  <Icon size={18} />
                  <span class="rewind-label">{label}</span>
                  <span class="rewind-date mono">
                    {t('top.year', { year: formatNumber(d.year) })} · {t(`season.${d.season}` as MessageKey)} {d.dayOfSeason}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
