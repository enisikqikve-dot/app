import { formatNumber, t, type MessageKey } from '../i18n';
import type { FilmCaption } from '../game/Game';
import { chronicleText } from './chronicleText';

/** Film mode: black bars, a caption for each scene, and a way out. */
export function FilmOverlay({ caption, planet, onStop }: { caption: FilmCaption | null; planet: string; onStop: () => void }) {
  const text = !caption
    ? ''
    : caption.kind === 'line'
      ? chronicleText(caption.line, planet)
      : caption.kind === 'town'
        ? t('film.town', { size: t(`town.size.${caption.size}` as MessageKey), name: caption.name, n: formatNumber(caption.people) })
        : caption.kind === 'person'
          ? t('film.person', { name: caption.name })
          : t('film.planet', { planet, year: formatNumber(caption.year) });
  return (
    <div class="film" aria-live="polite">
      <div class="film-bar film-top">
        <button type="button" class="btn small film-stop" onClick={onStop}>
          {t('film.stop')}
        </button>
      </div>
      <div class="film-bar film-bottom">
        {caption && caption.kind === 'line' && <span class="film-year mono">{t('top.year', { year: formatNumber(caption.line.date.year) })}</span>}
        <p class="film-caption" key={text}>
          {text}
        </p>
      </div>
    </div>
  );
}
