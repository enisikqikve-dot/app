import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { ChronicleCategory, ChronicleLine } from '../game/peopleInfo';
import { chronicleText } from './chronicleText';
import { IconClose } from './icons';

const FILTERS: (ChronicleCategory | 'all')[] = ['all', 'people', 'love', 'death', 'groups', 'nature'];

interface Props {
  lines: ChronicleLine[];
  planet: string;
  onPerson: (id: number) => void;
  onClose: () => void;
}

/** The world chronicle: a history book that writes itself, newest first. */
export function ChroniclePanel({ lines, planet, onPerson, onClose }: Props) {
  const [filter, setFilter] = useState<ChronicleCategory | 'all'>('all');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const shown = filter === 'all' ? lines : lines.filter((l) => l.category === filter);
  let lastYear = -1;
  return (
    <section class="chronicle glass-strong" aria-labelledby="chronicle-title">
      <div class="place-head">
        <h2 id="chronicle-title" class="panel-title">
          {t('chron.title')}
        </h2>
        <button ref={closeRef} type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <div class="chips chron-filters" role="group">
        {FILTERS.map((f) => (
          <button key={f} type="button" class={`option${filter === f ? ' is-active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`chron.filter.${f}` as MessageKey)}
          </button>
        ))}
      </div>
      <p class="chron-chapter">{t('chron.chapter.paleolithic')}</p>
      {shown.length === 0 ? (
        <p class="place-text">{t('chron.empty')}</p>
      ) : (
        <ol class="chron-list">
          {shown.map((l) => {
            const head = l.date.year !== lastYear;
            lastYear = l.date.year;
            const text = chronicleText(l, planet);
            return (
              <li key={l.index} class={l.major ? 'is-major' : ''}>
                {head && <span class="chron-year mono">{t('top.year', { year: formatNumber(l.date.year) })}</span>}
                {l.person !== undefined ? (
                  <button type="button" class="chron-line" onClick={() => onPerson(l.person!)}>
                    {text}
                  </button>
                ) : (
                  <span class="chron-line">{text}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
