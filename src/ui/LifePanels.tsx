import { formatNumber, t, type MessageKey } from '../i18n';
import type { HerdInfo, PersonInfo } from '../game/Game';
import { biomeName } from './format';
import { IconClose, IconFollow } from './icons';

function Bar({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const low = value < 0.25;
  return (
    <div class="need">
      <span class="need-label">{label}</span>
      <span class="need-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span class={`need-fill${low || warn ? ' is-low' : ''}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

interface PersonProps {
  person: PersonInfo;
  following: boolean;
  onFollow: (on: boolean) => void;
  onClose: () => void;
}

export function PersonPanel({ person: p, following, onFollow, onClose }: PersonProps) {
  const looks = [t(`person.skin.${p.skin}` as MessageKey), t(`person.hair.${p.hair}` as MessageKey), t(`person.height.${p.height}` as MessageKey)].join(' · ');
  return (
    <aside class="place glass person-panel" aria-live="polite">
      <div class="place-head">
        <div>
          <h2 class="place-title">{p.name}</h2>
          <div class="chips">
            <span class="chip chip-cond">
              {t(p.sex === 'f' ? 'person.female' : 'person.male')} · {t('person.age', { age: formatNumber(p.age) })}
            </span>
            {!p.alive && <span class="chip chip-dead">{t('person.dead')}</span>}
            {p.sick && <span class="chip chip-hot">{t('person.sick')}</span>}
          </div>
        </div>
        <button type="button" class="icon-btn small" aria-label={t('info.close')} title={t('info.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      {p.alive ? (
        <p class="place-text activity">
          {p.name} {t(`act.${p.activity}` as MessageKey)} · <span class="muted">{biomeName(p.biome)}</span>
        </p>
      ) : (
        <p class="place-text">
          {t('person.diedOf', { cause: p.cause ? t(`cause.${p.cause}` as MessageKey) : '' })}
          {p.revivable && <span class="muted"> · {t('person.revivable')}</span>}
        </p>
      )}
      {p.alive && (
        <div class="needs">
          <Bar label={t('need.food')} value={p.food} />
          <Bar label={t('need.water')} value={p.water} />
          <Bar label={t('need.sleep')} value={p.sleep} />
          <Bar label={t('need.health')} value={p.health} warn={p.sick} />
        </div>
      )}
      <p class="note">{looks}</p>
      <div class="lifelog">
        <h3>{t('person.life')}</h3>
        <ol>
          {p.log.map((l, i) => (
            <li key={i}>
              <span class="mono muted">
                {t('top.year', { year: formatNumber(l.date.year) })} · {t(`season.${l.date.season}` as MessageKey)} {l.date.dayOfSeason}
              </span>
              <span>{t(`log.${l.key}` as MessageKey, { cause: l.cause ? t(`cause.${l.cause}` as MessageKey) : '' })}</span>
            </li>
          ))}
        </ol>
      </div>
      {p.alive && (
        <button type="button" class={`btn${following ? ' btn-primary' : ''}`} aria-pressed={following} onClick={() => onFollow(!following)}>
          <IconFollow size={16} />
          {following ? t('person.following') : t('person.follow')}
        </button>
      )}
    </aside>
  );
}

export function HerdPanel({ herd, onClose }: { herd: HerdInfo; onClose: () => void }) {
  return (
    <aside class="place glass herd-panel" aria-live="polite">
      <div class="place-head">
        <div>
          <h2 class="place-title">{t(`species.${herd.species}` as MessageKey)}</h2>
          <div class="chips">
            <span class="chip chip-cond">{t('herd.count', { n: formatNumber(herd.count) })}</span>
            <span class={`chip ${herd.activity === 'hungry' ? 'chip-hot' : 'chip-cond'}`}>{t(`herd.${herd.activity}` as MessageKey)}</span>
          </div>
        </div>
        <button type="button" class="icon-btn small" aria-label={t('info.close')} title={t('info.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <p class="place-text">{t(`speciesInfo.${herd.species}` as MessageKey)}</p>
      <p class="note">{biomeName(herd.biome)}</p>
    </aside>
  );
}
