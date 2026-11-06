import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { ChronicleCategory, ChronicleLine, FaithInfo, KnowledgeInfo, SpeciesInfo } from '../game/peopleInfo';
import { chronicleText } from './chronicleText';
import { deityName, geneWords, inventionName, speciesName } from './names';
import { biomeName } from './format';
import { IconClose } from './icons';

const FILTERS: (ChronicleCategory | 'all')[] = ['all', 'people', 'love', 'death', 'groups', 'knowledge', 'faith', 'animals', 'nature'];
type Tab = 'chronicle' | 'knowledge' | 'faith' | 'animals';

interface Props {
  lines: ChronicleLine[];
  knowledge: KnowledgeInfo[];
  species: SpeciesInfo[];
  faith: FaithInfo;
  planet: string;
  epoch: 'none' | 'paleolithic' | 'mesolithic';
  onPerson: (id: number) => void;
  onPlace: (cell: number) => void;
  onClose: () => void;
}

function ChronicleList({ lines, planet, epoch, onPerson }: { lines: ChronicleLine[]; planet: string; epoch: Props['epoch']; onPerson: (id: number) => void }) {
  const [filter, setFilter] = useState<ChronicleCategory | 'all'>('all');
  const shown = filter === 'all' ? lines : lines.filter((l) => l.category === filter);
  let lastYear = -1;
  return (
    <>
      <div class="chips chron-filters" role="group">
        {FILTERS.map((f) => (
          <button key={f} type="button" class={`option${filter === f ? ' is-active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`chron.filter.${f}` as MessageKey)}
          </button>
        ))}
      </div>
      <p class="chron-chapter">{t(epoch === 'mesolithic' ? 'chron.chapter.mesolithic' : 'chron.chapter.paleolithic')}</p>
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
    </>
  );
}

function KnowledgeList({ items }: { items: KnowledgeInfo[] }) {
  return (
    <>
      <p class="note">{t('know.note')}</p>
      <ol class="know-list">
        {items.map((k) => (
          <li key={k.id} class={`know is-${k.status}`}>
            <div class="know-head">
              <b>{inventionName(k.id)}</b>
              <span class={`chip ${k.status === 'known' ? 'chip-gold' : k.status === 'lost' ? 'chip-hot' : 'chip-cond'}`}>{t(`know.status.${k.status}` as MessageKey)}</span>
            </div>
            <span class="know-info">{t(`inventionInfo.${k.id}` as MessageKey)}</span>
            <span class="know-meta mono">
              {[
                k.status === 'known' ? t('know.people', { n: formatNumber(k.people), g: formatNumber(k.groups) }) : '',
                k.first ? t('know.first', { name: k.first.name, year: formatNumber(k.first.year) }) : '',
                k.status !== 'known' && k.needs.length > 0 ? t('know.needs', { list: k.needs.map((n) => inventionName(n)).join(', ') }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function FaithList({ info, onPerson, onPlace }: { info: FaithInfo; onPerson: (id: number) => void; onPlace: (cell: number) => void }) {
  return (
    <>
      <div class="faith-image">
        <h3>{t('faith.imageTitle')}</h3>
        <p>
          <b>{t(`faith.image.${info.image}` as MessageKey)}</b> <span class="muted">{t(`faith.imageNote.${info.image}` as MessageKey, { good: formatNumber(info.good), bad: formatNumber(info.bad) })}</span>
        </p>
        <p class="know-meta mono">{t('faith.believers', { n: formatNumber(info.believers), m: formatNumber(info.population) })}</p>
      </div>
      {info.prayers.length > 0 && (
        <div class="faith-prayers">
          <h3>{t('faith.prayers')}</h3>
          <ul>
            {info.prayers.map((p) => (
              <li key={p.band}>
                <button type="button" class="chron-line" onClick={() => onPlace(p.cell)}>
                  🙏 {t(`faith.prayer.${p.need}` as MessageKey, { name: p.leader })}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p class="note">{t('faith.note')}</p>
      {info.religions.length === 0 ? (
        <p class="place-text">{t('faith.none')}</p>
      ) : (
        <ol class="know-list">
          {info.religions.map((r) => (
            <li key={r.id} class={`know${r.endedYear !== null ? ' is-lost' : ''}`}>
              <div class="know-head">
                <b>{t('faith.religionName', { deity: deityName(r.deity, true) })}</b>
                {r.endedYear !== null ? (
                  <span class="chip chip-hot">{t('faith.ended', { year: formatNumber(r.endedYear) })}</span>
                ) : (
                  <span class="chip chip-gold">{t('faith.followers', { n: formatNumber(r.followers) })}</span>
                )}
              </div>
              <span class="know-info">{t(`deityInfo.${r.deity}` as MessageKey)}</span>
              <span class="know-meta mono">
                <button type="button" class="link-btn" onClick={() => onPerson(r.founderId)}>
                  {t('faith.founded', { name: r.founder ?? '?', year: formatNumber(r.foundedYear) })}
                </button>
                {' · '}
                <button type="button" class="link-btn" onClick={() => onPlace(r.holyCell)}>
                  {t('faith.holy', { biome: biomeName(r.holy) })}
                </button>
                {r.shamans > 0 ? ` · ${t('faith.shamans', { n: formatNumber(r.shamans) })}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function SpeciesList({ items }: { items: SpeciesInfo[] }) {
  return (
    <>
      <p class="note">{t('animals.note')}</p>
      <ol class="know-list">
        {items.map((s) => (
          <li key={s.id} class={`know${s.extinctYear !== null ? ' is-lost' : ''}`}>
            <div class="know-head">
              <b>{speciesName(s.base, s.prefix)}</b>
              {s.extinctYear !== null ? (
                <span class="chip chip-hot">{t('animals.extinct', { year: formatNumber(s.extinctYear) })}</span>
              ) : (
                <span class="chip chip-cond">{t('animals.count', { n: formatNumber(s.animals), h: formatNumber(s.herds) })}</span>
              )}
            </div>
            <span class="know-info">{geneWords(s.genes)}</span>
            <span class="know-meta mono">
              {[s.bornYear !== null ? t('animals.since', { year: formatNumber(s.bornYear) }) : '', s.createdByYou ? t('animals.byYou') : ''].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** The world chronicle (a history book that writes itself), the knowledge net and the animal species. */
export function ChroniclePanel({ lines, knowledge, species, faith, planet, epoch, onPerson, onPlace, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('chronicle');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
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
      <div class="tabs" role="tablist">
        {(['chronicle', 'knowledge', 'faith', 'animals'] as Tab[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} class={`tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
            {t(`chron.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <div class="chron-body">
        {tab === 'chronicle' && <ChronicleList lines={lines} planet={planet} epoch={epoch} onPerson={onPerson} />}
        {tab === 'knowledge' && <KnowledgeList items={knowledge} />}
        {tab === 'faith' && <FaithList info={faith} onPerson={onPerson} onPlace={onPlace} />}
        {tab === 'animals' && <SpeciesList items={species} />}
      </div>
    </section>
  );
}
