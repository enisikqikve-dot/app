import { formatNumber, t, type MessageKey } from '../i18n';
import type { PlaceInfo } from '../game/Game';
import { isWater } from '../sim/planet/biomes';
import { biomeInfo, biomeName, climateZone, formatHours, formatLatLon, formatTemperature, moistureLabel } from './format';
import { IconClose, IconMoon, IconSun } from './icons';

const HOT = new Set(['burning', 'lava', 'plague']);

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
    ...(water
      ? []
      : ([
          [t('info.fresh'), t(`fresh.${place.fresh}` as MessageKey)],
          [t('info.food'), t(`food.${place.food < 0.15 ? 0 : place.food < 0.4 ? 1 : place.food < 0.8 ? 2 : 3}` as MessageKey)],
        ] as [string, string][])),
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
      {place.settlement ? (
        <div class="town-box">
          <h3>
            {t(`town.size.${place.settlement.size}` as MessageKey)} {place.settlement.name}
          </h3>
          <p class="note">
            {[
              t('town.people', { n: formatNumber(place.settlement.people) }),
              t('town.fields', { n: formatNumber(place.settlement.fields) }),
              t('town.since', { year: formatNumber(place.settlement.foundedYear) }),
              place.settlement.size >= 1 ? t('town.price', { n: formatNumber(place.settlement.price) }) : '',
              place.settlement.temple ? t('town.temple') : '',
              place.settlement.wall ? t('town.wall') : '',
              place.settlement.robots ? t('town.robots', { n: formatNumber(place.settlement.robots) }) : '',
              place.settlement.flying ? t('town.flying') : '',
              place.settlement.weatherMachine ? t('town.weather') : '',
              place.settlement.timeMachine ? t('town.timeMachine') : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ) : null}
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
