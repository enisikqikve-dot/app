import type { ComponentType } from 'preact';
import { t, type MessageKey } from '../i18n';
import { ALL_POWERS, type PowerCategory, type PowerKind } from '../sim/powers';
import {
  IconAnger,
  IconAnimals,
  IconComfort,
  IconCourage,
  IconEmigrate,
  IconFear,
  IconFertility,
  IconForgive,
  IconIdea,
  IconSkip,
  IconTeach,
  IconLead,
  IconLove,
  IconLuck,
  IconPeace,
  IconSign,
  IconCreatePeople,
  IconDrought,
  IconFire,
  IconForest,
  IconHand,
  IconClone,
  IconHarvest,
  IconHeal,
  IconHeat,
  IconLightning,
  IconLower,
  IconMeteor,
  IconPlague,
  IconQuake,
  IconRain,
  IconRaise,
  IconRevive,
  IconSmite,
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
  harvest: IconHarvest,
  heal: IconHeal,
  revive: IconRevive,
  createPeople: IconCreatePeople,
  spawnAnimals: IconAnimals,
  smite: IconSmite,
  plague: IconPlague,
  move: IconHand,
  clone: IconClone,
  luck: IconLuck,
  fertility: IconFertility,
  sign: IconSign,
  wLove: IconLove,
  wCourage: IconCourage,
  wFear: IconFear,
  wAnger: IconAnger,
  wForgive: IconForgive,
  wComfort: IconComfort,
  wEmigrate: IconEmigrate,
  wPeace: IconPeace,
  wLead: IconLead,
  wIdea: IconIdea,
  wTeach: IconTeach,
  timeSkip: IconSkip,
};

const GROUPS: Record<PowerCategory, { key: MessageKey; kinds: PowerKind[] }[]> = {
  nature: [
    { key: 'powers.group.weather', kinds: ['lightning', 'rain', 'drought', 'fire', 'storm'] },
    { key: 'powers.group.earth', kinds: ['quake', 'volcano', 'tsunami', 'meteor'] },
    { key: 'powers.group.land', kinds: ['raise', 'lower', 'forest'] },
    { key: 'powers.group.climate', kinds: ['iceAge', 'heatAge'] },
  ],
  blessing: [
    { key: 'powers.group.blessing', kinds: ['harvest', 'heal', 'luck', 'fertility'] },
    { key: 'powers.group.miracles', kinds: ['revive', 'sign'] },
  ],
  whisper: [
    { key: 'powers.group.feelings', kinds: ['wLove', 'wCourage', 'wFear', 'wAnger', 'wForgive', 'wComfort'] },
    { key: 'powers.group.intentions', kinds: ['wEmigrate', 'wPeace', 'wLead', 'wTeach'] },
    { key: 'powers.group.ideas', kinds: ['wIdea'] },
  ],
  life: [
    { key: 'powers.group.people', kinds: ['createPeople', 'move', 'clone', 'smite'] },
    { key: 'powers.group.animals', kinds: ['spawnAnimals'] },
    { key: 'powers.group.disease', kinds: ['plague'] },
  ],
};

const TITLES: Record<PowerCategory, MessageKey> = {
  nature: 'palette.nature',
  blessing: 'palette.blessing',
  whisper: 'palette.whisper',
  life: 'palette.life',
};

interface Props {
  category: PowerCategory;
  armed: PowerKind | null;
  /** The person the palette was opened for (from their file), if any. */
  forName?: string | null;
  onPick: (kind: PowerKind) => void;
}

export function PowerPalette({ category, armed, forName, onPick }: Props) {
  return (
    <section class="palette glass-strong" aria-label={t(TITLES[category])}>
      <h2 class="palette-title">{t(TITLES[category])}</h2>
      {forName && <p class="palette-for">{t('palette.for', { name: forName })}</p>}
      {GROUPS[category].map((group) => (
        <div class="palette-group" key={group.key}>
          <h3>{t(group.key)}</h3>
          <div class="palette-grid">
            {group.kinds.map((kind) => {
              const Icon = POWER_ICONS[kind];
              const global = ALL_POWERS.find((p) => p.kind === kind)?.target === 'global';
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
          {group.kinds.length === 1 && <p class="note">{t(`powerInfo.${group.kinds[0]}` as MessageKey)}</p>}
        </div>
      ))}
      {category === 'whisper' && <p class="note">{t('palette.whisperNote')}</p>}
    </section>
  );
}
