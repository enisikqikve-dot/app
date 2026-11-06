import { useEffect, useRef } from 'preact/hooks';
import { formatNumber, t } from '../i18n';
import type { SkipProgress, SkipSummary } from '../game/Game';
import { chronicleText } from './chronicleText';
import { IconClose, IconSkip } from './icons';

export const SKIP_YEARS = [10, 100, 1000];

export function SkipMenu({ onPick, onClose }: { onPick: (years: number) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <aside class="skip-menu glass-strong" aria-labelledby="skip-title">
      <div class="place-head">
        <h2 id="skip-title" class="panel-title">
          {t('skip.title')}
        </h2>
        <button type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <p class="note">{t('skip.note')}</p>
      <div class="skip-options">
        {SKIP_YEARS.map((n, i) => (
          <button key={n} ref={i === 0 ? first : undefined} type="button" class="btn" onClick={() => onPick(n)}>
            <IconSkip size={16} />
            {t('skip.years', { n: formatNumber(n) })}
          </button>
        ))}
      </div>
    </aside>
  );
}

export function SkipBar({ skip, onStop }: { skip: SkipProgress; onStop: () => void }) {
  const pct = Math.round(skip.done * 100);
  return (
    <div class="skip-bar glass-strong" role="status">
      <span class="skip-label">{t('skip.running', { year: formatNumber(skip.year) })}</span>
      <span class="need-bar skip-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span class="need-fill" style={{ width: `${pct}%` }} />
      </span>
      <button type="button" class="btn small" onClick={onStop}>
        {t('skip.stop')}
      </button>
    </div>
  );
}

export function SkipSummaryPanel({ summary, planet, onPerson, onClose }: { summary: SkipSummary; planet: string; onPerson: (id: number) => void; onClose: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ok.current?.focus();
  }, []);
  return (
    <section class="chronicle glass-strong skip-summary" aria-labelledby="summary-title">
      <div class="place-head">
        <h2 id="summary-title" class="panel-title">
          {t('summary.title', { n: formatNumber(summary.years) })}
        </h2>
        <button type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <div class="chips">
        <span class="chip chip-cond">{t('summary.people', { a: formatNumber(summary.popBefore), b: formatNumber(summary.popAfter) })}</span>
        <span class="chip chip-cond">{t('summary.births', { n: formatNumber(summary.births) })}</span>
        <span class="chip chip-cond">{t('summary.deaths', { n: formatNumber(summary.deaths) })}</span>
        {summary.stopped && <span class="chip chip-hot">{t('summary.stopped')}</span>}
      </div>
      {summary.lines.length === 0 ? (
        <p class="place-text">{t('summary.none')}</p>
      ) : (
        <ol class="chron-list">
          {summary.lines.map((l) => (
            <li key={l.index} class="is-major">
              <span class="chron-year mono">{t('top.year', { year: formatNumber(l.date.year) })}</span>
              {l.person !== undefined ? (
                <button type="button" class="chron-line" onClick={() => onPerson(l.person!)}>
                  {chronicleText(l, planet)}
                </button>
              ) : (
                <span class="chron-line">{chronicleText(l, planet)}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      <button ref={ok} type="button" class="btn btn-primary" onClick={onClose}>
        {t('summary.ok')}
      </button>
    </section>
  );
}
