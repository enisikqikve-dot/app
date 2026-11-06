import type { ComponentType } from 'preact';
import { t, type MessageKey } from '../i18n';
import { NATURE_POWERS, type PowerKind } from '../sim/powers';
import {
  IconDrought,
  IconFire,
  IconForest,
  IconHeat,
  IconLightning,
  IconLower,
  IconMeteor,
  IconQuake,
  IconRain,
  IconRaise,
  IconSnow,
  IconStorm,
  IconVolcano,
  IconWave,
} from './icons';

export const POWER_ICONS: Record<PowerKind, ComponentType<{ size?: number }>> = {
  lightning: IconLightning,
  rain: IconRain,
  drought: IconDrought,
  fire: IconFire,
  storm: IconStorm,
  quake: IconQuake,
  volcano: IconVolcano,
  tsunami: IconWave,
  meteor: IconMeteor,
  iceAge: IconSnow,
  heatAge: IconHeat,
  raise: IconRaise,
  lower: IconLower,
  forest: IconForest,
};

const GROUPS: { key: MessageKey; kinds: PowerKind[] }[] = [
  { key: 'powers.group.weather', kinds: ['lightning', 'rain', 'drought', 'fire', 'storm'] },
  { key: 'powers.group.earth', kinds: ['quake', 'volcano', 'tsunami', 'meteor'] },
  { key: 'powers.group.land', kinds: ['raise', 'lower', 'forest'] },
  { key: 'powers.group.climate', kinds: ['iceAge', 'heatAge'] },
];

interface Props {
  armed: PowerKind | null;
  onPick: (kind: PowerKind) => void;
}

export function PowerPalette({ armed, onPick }: Props) {
  return (
    <section class="palette glass-strong" aria-label={t('powers.choose')}>
      <h2 class="palette-title">{t('powers.choose')}</h2>
      {GROUPS.map((group) => (
        <div class="palette-group" key={group.key}>
          <h3>{t(group.key)}</h3>
          <div class="palette-grid">
            {group.kinds.map((kind) => {
              const Icon = POWER_ICONS[kind];
              const global = NATURE_POWERS.find((p) => p.kind === kind)?.target === 'global';
              return (
                <button
                  key={kind}
                  id={`power-${kind}`}
                  type="button"
                  class={`palette-tile${armed === kind ? ' is-armed' : ''}${global ? ' is-global' : ''}`}
                  aria-pressed={armed === kind}
                  title={t(`powerInfo.${kind}` as MessageKey)}
                  onClick={() => onPick(kind)}
                >
                  <Icon size={22} />
                  <span>{t(`power.${kind}` as MessageKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
