import { formatNumber, t, type MessageKey } from '../i18n';
import type { PlaceInfo } from '../game/Game';
import { isWater } from '../sim/planet/biomes';
import { biomeInfo, biomeName, climateZone, formatHours, formatLatLon, formatTemperature, moistureLabel } from './format';
import { IconClose, IconMoon, IconSun } from './icons';

const HOT = new Set(['burning', 'lava']);

export function PlacePanel({ place, onClose }: { place: PlaceInfo; onClose: () => void }) {
  const water = isWater(place.biome);
  const state = place.frozen ? (water ? t('info.frozen') : t('info.snowy')) : null;
  const rows: [string, string][] = [
    [t('info.coords'), formatLatLon(place.latitude, place.longitude)],
    water
      ? [t('info.depth'), `${formatNumber(Math.abs(place.heightM))} m`]
      : [t('info.height'), `${formatNumber(Math.max(0, place.heightM))} m`],
    [t('info.tempNow'), formatTemperature(place.temperatureNow)],
    [t('info.tempMean'), formatTemperature(place.meanTemperature)],
    ...(water ? [] : [[t('info.moisture'), `${moistureLabel(place.moisture)} · ${Math.round(place.moisture * 100)} %`] as [string, string]]),
    [t('info.zone'), climateZone(place.latitude)],
  ];
  return (
    <aside class="place glass" aria-live="polite">
      <div class="place-head">
        <div>
          <h2 class="place-title">{biomeName(place.biome)}</h2>
          <div class="chips">
            {state && <span class="chip chip-cold">{state}</span>}
            {place.conditions.map((c) => (
              <span key={c} class={`chip ${HOT.has(c) ? 'chip-hot' : 'chip-cond'}`}>
                {t(`cond.${c}` as MessageKey)}
              </span>
            ))}
          </div>
        </div>
        <button type="button" class="icon-btn small" aria-label={t('info.close')} title={t('info.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <p class="place-text">{biomeInfo(place.biome)}</p>
      <dl class="facts">
        {rows.map(([label, value]) => (
          <div class="fact" key={label}>
            <dt>{label}</dt>
            <dd class="mono">{value}</dd>
          </div>
        ))}
        <div class="fact">
          <dt>{t('info.localTime')}</dt>
          <dd class="mono with-icon">
            {place.daylight ? <IconSun size={15} /> : <IconMoon size={15} />}
            {formatHours(place.localHours)} · {place.daylight ? t('info.day') : t('info.night')}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
