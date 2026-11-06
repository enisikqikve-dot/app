import { useState } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { HerdInfo, PersonInfo } from '../game/Game';
import type { PersonRef, RelationInfo } from '../game/peopleInfo';
import { TRAITS } from '../sim/life/types';
import { biomeName } from './format';
import { deityName, geneWords, inventionName, speciesName } from './names';
import { INVENTION_IDS } from '../sim/life/inventions';
import { SPECIES_IDS } from '../sim/life/species';
import { IconBlessing, IconClose, IconFollow, IconTree, IconWhisper } from './icons';
import { TribeDot } from './ChroniclePanel';

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

function TraitBar({ label, value }: { label: string; value: number }) {
  return (
    <div class="need trait">
      <span class="need-label">{label}</span>
      <span class="need-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span class="need-fill trait-fill" style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

type Tab = 'now' | 'character' | 'family' | 'life';

interface PersonProps {
  person: PersonInfo;
  following: boolean;
  onFollow: (on: boolean) => void;
  onClose: () => void;
  onWhisper: () => void;
  onBless: () => void;
  onTree: () => void;
  onPerson: (id: number) => void;
}

function Names({ label, people, onPerson, opinion }: { label: string; people: (PersonRef | RelationInfo)[]; onPerson: (id: number) => void; opinion?: boolean }) {
  if (people.length === 0) return null;
  return (
    <div class="kin">
      <h3>{label}</h3>
      <div class="kin-list">
        {people.map((r) => (
          <button key={r.id} type="button" class={`kin-name${r.alive ? '' : ' is-dead'} is-${r.sex}`} onClick={() => onPerson(r.id)}>
            {r.name}
            {!r.alive && ' †'}
            <span class="muted mono"> {formatNumber(r.age)}</span>
            {opinion && 'opinion' in r && <span class={`kin-op mono${r.opinion < 0 ? ' is-neg' : ''}`}>{r.opinion > 0 ? `+${r.opinion}` : r.opinion}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PersonPanel({ person: p, following, onFollow, onClose, onWhisper, onBless, onTree, onPerson }: PersonProps) {
  const [tab, setTab] = useState<Tab>('now');
  const tabs: Tab[] = p.alive ? ['now', 'character', 'family', 'life'] : ['character', 'family', 'life'];
  const shown: Tab = tabs.includes(tab) ? tab : tabs[0];
  const hairText = t(`person.hair.${p.hair}` as MessageKey);
  const hair = p.hairNote && p.hair === p.birthHair ? t('person.hairLike', { hair: hairText, rel: t(`rel.${p.hairNote.rel}` as MessageKey), name: p.hairNote.name }) : hairText;
  const looks = [t(`person.skin.${p.skin}` as MessageKey), hair, t(`person.height.${p.height}` as MessageKey)].join(' · ');
  const reasons = [...p.moodReasons].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 7);

  return (
    <aside class="place glass person-panel" aria-live="polite">
      <div class="place-head">
        <div>
          <h2 class="place-title">{p.name}</h2>
          <div class="chips">
            <span class="chip chip-cond">
              {t(`person.phase.${p.phase}.${p.sex}` as MessageKey)} · {t('person.age', { age: formatNumber(p.age) })}
            </span>
            {!p.alive && <span class="chip chip-dead">{t(p.archived ? 'person.archived' : 'person.dead')}</span>}
            {p.leader && <span class="chip chip-gold">{t('person.leaderChip')}</span>}
            {p.pregnant && <span class="chip chip-cond">{t('person.pregnant')}</span>}
            {p.lucky && <span class="chip chip-gold">{t('person.lucky')}</span>}
            {p.teacher && <span class="chip chip-cond">{t('person.teacherChip')}</span>}
            {p.shaman && <span class="chip chip-gold">{t('person.shamanChip')}</span>}
            {p.crimes >= 3 ? <span class="chip chip-hot">{t('person.murderer')}</span> : p.crimes > 0 ? <span class="chip chip-hot">{t('person.thief')}</span> : null}
            {p.feeling && <span class="chip chip-cond">{t(`person.feeling.${p.feeling}` as MessageKey)}</span>}
            {p.sick && <span class="chip chip-hot">{t('person.sick')}</span>}
          </div>
        </div>
        <button type="button" class="icon-btn small" aria-label={t('info.close')} title={t('info.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>

      {p.alive ? (
        <p class="place-text activity">
          {p.name} {p.chat ? t(`person.chat.${p.chat.kind}` as MessageKey, { name: p.chat.name }) : t(`act.${p.activity}` as MessageKey)} ·{' '}
          <span class="muted">{biomeName(p.biome)}</span>
        </p>
      ) : (
        <p class="place-text">
          {t('person.diedOf', { cause: p.cause ? t(`cause.${p.cause}` as MessageKey) : '' })}
          {p.revivable && <span class="muted"> · {t('person.revivable')}</span>}
          {p.diedYear !== null && (
            <span class="muted"> · {t('person.archivedNote', { from: formatNumber(p.bornYear), to: formatNumber(p.diedYear) })}</span>
          )}
        </p>
      )}

      <div class="tabs" role="tablist">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={shown === k} class={`tab${shown === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
            {t(`person.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>

      {shown === 'now' && p.alive && (
        <div class="tab-body">
          <div class="needs">
            <Bar label={t('need.food')} value={p.food} />
            <Bar label={t('need.water')} value={p.water} />
            <Bar label={t('need.sleep')} value={p.sleep} />
            <Bar label={t('need.health')} value={p.health} warn={p.sick} />
            {p.age >= 3 && <Bar label={t('need.company')} value={p.company} />}
            <Bar label={t('person.mood')} value={p.mood / 100} warn={p.mood < 30} />
          </div>
          {reasons.length > 0 && (
            <ul class="reasons">
              {reasons.map((r, i) => (
                <li key={i}>
                  <span class={`mono reason-v${r.v < 0 ? ' is-neg' : ''}`}>{r.v > 0 ? `+${r.v}` : `−${Math.abs(r.v)}`}</span>
                  <span>{t(`mood.${r.key}` as MessageKey, { name: r.name ?? '' })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {shown === 'character' && (
        <div class="tab-body">
          <div class="needs">
            {TRAITS.map((id, i) => (
              <TraitBar key={id} label={t(`trait.${id}` as MessageKey)} value={p.traits[i] ?? 50} />
            ))}
          </div>
          <div class="kin">
            <h3>{t('person.knowledge')}</h3>
            <p class="note">{p.know.length ? p.know.map((id) => inventionName(id)).join(' · ') : t('person.knowsNothing')}</p>
          </div>
          <div class="kin">
            <h3>{t('person.faith')}</h3>
            <p class="note">{p.belief ? t('person.believes', { deity: deityName(p.belief, true) }) : t('person.noBelief')}</p>
            {p.alive && (p.belief || p.faith > 0.05) && (
              <div class="needs">
                <Bar label={t('person.faithStrength')} value={p.faith} />
              </div>
            )}
          </div>
          {p.task && (
            <p class="note">
              {t('person.task')}: {t(`task.${p.task}` as MessageKey)}
            </p>
          )}
          <p class="note">{looks}</p>
          {p.band && (
            <p class="note">{p.leader ? t('person.ownBand', { n: formatNumber(p.band.size) }) : t('person.band', { leader: p.band.leader, n: formatNumber(p.band.size) })}</p>
          )}
          {p.tribe && (
            <p class="note">
              <TribeDot hue={p.tribe.hue} /> {t('peoples.name', { name: p.tribe.name })}
            </p>
          )}
        </div>
      )}

      {shown === 'family' && (
        <div class="tab-body">
          {p.partner && <Names label={t('person.partner')} people={[p.partner]} onPerson={onPerson} />}
          {p.parents.length > 0 ? (
            <Names label={t('person.parents')} people={p.parents} onPerson={onPerson} />
          ) : (
            <div class="kin">
              <h3>{t('person.parents')}</h3>
              <p class="note">{t('person.unknownParents')}</p>
            </div>
          )}
          <Names label={t('person.siblings')} people={p.siblings} onPerson={onPerson} />
          <Names label={t('person.children')} people={p.children} onPerson={onPerson} />
          <Names label={t('person.formerPartners')} people={p.formerPartners} onPerson={onPerson} />
          <Names label={t('person.friends')} people={p.friends} onPerson={onPerson} opinion />
          <Names label={t('person.foes')} people={p.foes} onPerson={onPerson} opinion />
        </div>
      )}

      {shown === 'life' && (
        <div class="lifelog tab-body">
          <ol>
            {p.log.map((l, i) => {
              const key = l.key === 'born' && !l.second ? 'log.bornOf' : `log.${l.key}`;
              return (
                <li key={i}>
                  <span class="mono muted">
                    {t('top.year', { year: formatNumber(l.date.year) })} · {t(`season.${l.date.season}` as MessageKey)} {l.date.dayOfSeason}
                  </span>
                  <span>
                    {t(key as MessageKey, {
                      cause: l.cause ? t(`cause.${l.cause}` as MessageKey) : '',
                      other: l.other ?? '?',
                      second: l.second ?? '?',
                      sign: l.key === 'sawSign' ? t(`sign.${l.n ?? 0}` as MessageKey) : '',
                      invention: l.key === 'invented' || l.key === 'learned' ? inventionName(INVENTION_IDS[l.n ?? 0] ?? 'tools') : '',
                      animal: l.key === 'hunted' ? t(`speciesOne.${SPECIES_IDS[l.n ?? 0] ?? 'deer'}` as MessageKey) : '',
                    })}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div class="person-actions">
        {p.alive && (
          <button type="button" class={`btn small${following ? ' btn-primary' : ''}`} aria-pressed={following} onClick={() => onFollow(!following)}>
            <IconFollow size={16} />
            {following ? t('person.following') : t('person.follow')}
          </button>
        )}
        {p.alive && p.age >= 3 && (
          <button type="button" class="btn small" onClick={onWhisper}>
            <IconWhisper size={16} />
            {t('person.whisper')}
          </button>
        )}
        {(p.alive || p.revivable) && (
          <button type="button" class="btn small" onClick={onBless}>
            <IconBlessing size={16} />
            {t('person.bless')}
          </button>
        )}
        <button type="button" class="btn small" onClick={onTree}>
          <IconTree size={16} />
          {t('person.tree')}
        </button>
      </div>
    </aside>
  );
}

export function HerdPanel({ herd, onClose }: { herd: HerdInfo; onClose: () => void }) {
  return (
    <aside class="place glass herd-panel" aria-live="polite">
      <div class="place-head">
        <div>
          <h2 class="place-title">{speciesName(herd.species, herd.prefix)}</h2>
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
      <p class="note">
        {geneWords(herd.genes)} · {biomeName(herd.biome)}
      </p>
    </aside>
  );
}
