import { formatNumber, t, type MessageKey } from '../i18n';
import { SPEEDS, type SpeedIndex } from '../sim/clock';
import type { UiState } from '../game/Game';
import { formatHours } from './format';
import { IconBook, IconMenu, IconMoon, IconPause, IconPerson, IconRewind, IconSkip, IconSoundOff, IconSoundOn, IconSun } from './icons';

interface Props {
  ui: UiState;
  rewindOpen: boolean;
  chronicleOpen: boolean;
  skipOpen: boolean;
  onSpeed: (index: SpeedIndex) => void;
  onChronicle: () => void;
  onSkip: () => void;
  onMenu: () => void;
  onRewind: () => void;
  onSound: () => void;
}

export function TopBar({ ui, rewindOpen, chronicleOpen, skipOpen, onSpeed, onChronicle, onSkip, onMenu, onRewind, onSound }: Props) {
  const busy = ui.skip !== null;
  const { date, climate } = ui;
  const climateTemp = Math.round(climate.temperature);
  return (
    <header class="topbar">
      <div class="topbar-world glass">
        <span class="wordmark">eNis</span>
        <span class="planet-name" title={ui.worldCode}>
          {ui.planetName}
        </span>
        <span class="divider" aria-hidden="true" />
        <span class="date" title={t('top.seasonNote')}>
          <b>{t('top.year', { year: formatNumber(date.year) })}</b>
          <span>
            {t(`season.${date.season}` as 'season.0')} · {t('top.day', { day: date.dayOfSeason })}
          </span>
        </span>
        <span class="clock" title={t('top.localTimeNote')}>
          {ui.focusDaylight ? <IconSun size={16} /> : <IconMoon size={16} />}
          <span class="mono">{formatHours(ui.focusHours)}</span>
        </span>
        {climate.kind && (
          <span class={`chip chip-climate is-${climate.kind}`}>
            {t(`climate.${climate.kind}` as MessageKey)}
            {climateTemp !== 0 && <span class="mono"> {climateTemp > 0 ? `+${climateTemp}` : `−${Math.abs(climateTemp)}`} °C</span>}
          </span>
        )}
        <span class="epoch">
          <span class="chip">{t(ui.epoch === 'mesolithic' ? 'epoch.mesolithic' : ui.epoch === 'paleolithic' ? 'epoch.paleolithic' : 'top.epoch')}</span>
          <span class="people" title={t('top.people')}>
            <IconPerson size={15} />
            <span class="mono">{formatNumber(ui.population)}</span>
          </span>
        </span>
      </div>

      <div class="topbar-controls">
        <div class="speed glass" role="group" aria-label={t('speed.label')}>
          <button
            type="button"
            class={`speed-btn rewind-btn${rewindOpen ? ' is-open' : ''}`}
            aria-label={t('rewind.button')}
            title={t('rewind.button')}
            aria-expanded={rewindOpen}
            disabled={busy}
            onClick={onRewind}
          >
            <IconRewind size={16} />
          </button>
          <button
            type="button"
            class={`speed-btn skip-btn${skipOpen ? ' is-open' : ''}`}
            aria-label={t('skip.button')}
            title={t('skip.button')}
            aria-expanded={skipOpen}
            disabled={busy}
            onClick={onSkip}
          >
            <IconSkip size={16} />
          </button>
          {SPEEDS.map((speed, index) => (
            <button
              key={speed}
              type="button"
              class={`speed-btn${ui.speedIndex === index ? ' is-active' : ''}`}
              aria-pressed={ui.speedIndex === index}
              disabled={busy}
              aria-label={index === 0 ? t('speed.0') : `${speed}×`}
              title={index === 0 ? `${t('speed.0')} (␣)` : `${speed}×`}
              onClick={() => onSpeed(index as SpeedIndex)}
            >
              {index === 0 ? <IconPause size={16} /> : <span class="mono">{speed}×</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          class={`icon-btn glass${chronicleOpen ? ' is-open' : ''}`}
          aria-label={t('top.chronicle')}
          title={t('top.chronicle')}
          aria-expanded={chronicleOpen}
          onClick={onChronicle}
        >
          <IconBook />
        </button>
        <button
          type="button"
          class="icon-btn glass"
          aria-label={ui.soundOn ? t('sound.off') : t('sound.on')}
          title={ui.soundOn ? t('sound.off') : t('sound.on')}
          aria-pressed={ui.soundOn}
          onClick={onSound}
        >
          {ui.soundOn ? <IconSoundOn /> : <IconSoundOff />}
        </button>
        <button type="button" class="icon-btn glass" aria-label={t('top.menu')} title={t('top.menu')} onClick={onMenu}>
          <IconMenu />
        </button>
      </div>
    </header>
  );
}
