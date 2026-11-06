import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { ChronicleCategory, ChronicleLine, FaithInfo, KnowledgeInfo, PeoplesInfo, SpeciesInfo, TribeInfo } from '../game/peopleInfo';
import { chronicleText } from './chronicleText';
import { deityName, geneWords, inventionName, speciesName } from './names';
import { biomeName } from './format';
import { IconClose } from './icons';

const FILTERS: (ChronicleCategory | 'all')[] = ['all', 'people', 'love', 'death', 'groups', 'conflict', 'knowledge', 'faith', 'animals', 'nature'];
type Tab = 'chronicle' | 'knowledge' | 'faith' | 'peoples' | 'animals';

interface Props {
  lines: ChronicleLine[];
  knowledge: KnowledgeInfo[];
  species: SpeciesInfo[];
  faith: FaithInfo;
  peoples: PeoplesInfo;
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

/** A colour dot for a people. */
export function TribeDot({ hue }: { hue: number }) {
  return <span class="tribe-dot" style={{ background: `hsl(${Math.round(hue * 360)} 62% 55%)` }} aria-hidden="true" />;
}

function cultureWords(c: TribeInfo['culture']): string {
  const out: string[] = [];
  out.push(t(c[0] > 60 ? 'culture.warlike' : c[0] < 42 ? 'culture.peaceful' : 'culture.calm'));
  out.push(t(c[1] > 55 ? 'culture.pious' : c[1] < 35 ? 'culture.worldly' : 'culture.believing'));
  out.push(t(c[2] > 52 ? 'culture.open' : c[2] < 42 ? 'culture.closed' : 'culture.careful'));
  return out.join(' · ');
}

function PeoplesList({ info, onPerson }: { info: PeoplesInfo; onPerson: (id: number) => void }) {
  const living = info.tribes.filter((tr) => tr.endedYear === null);
  const gone = info.tribes.filter((tr) => tr.endedYear !== null);
  return (
    <>
      <p class="note">{t('peoples.note')}</p>
      {info.tribes.length === 0 && <p class="place-text">{t('peoples.none')}</p>}
      <ol class="know-list">
        {living.map((tr) => (
          <li key={tr.id} class="know tribe">
            <div class="know-head">
              <b>
                <TribeDot hue={tr.hue} /> {t('peoples.name', { name: tr.name })}
              </b>
              <span class="chip chip-cond">{t('peoples.size', { n: formatNumber(tr.population), g: formatNumber(tr.groups) })}</span>
            </div>
            <span class="know-info">
              {cultureWords(tr.culture)}
              {tr.religion ? ` · ${t('person.believes', { deity: deityName(tr.religion, true) })}` : ''}
            </span>
            <span class="know-meta mono">
              {tr.chief && (
                <>
                  <button type="button" class="link-btn" onClick={() => onPerson(tr.chiefId)}>
                    {t('peoples.chief', { name: tr.chief })}
                  </button>
                  {' · '}
                </>
              )}
              {t(`peoples.origin.${tr.origin}` as MessageKey, { year: formatNumber(tr.foundedYear), parent: tr.parent ?? '?' })}
            </span>
            {tr.relations.length > 0 && (
              <div class="chips tribe-rels">
                {tr.relations.map((r) => (
                  <span key={r.id} class={`chip rel-${r.state}`} title={`${r.value > 0 ? '+' : ''}${r.value}`}>
                    <TribeDot hue={r.hue} /> {r.name}: {t(`peoples.rel.${r.state}` as MessageKey)}
                    {r.traded ? ' · 🤝' : ''}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {info.wars.length > 0 && (
        <>
          <h3 class="list-title">{t('peoples.wars')}</h3>
          <ol class="know-list">
            {info.wars.map((w) => (
              <li key={w.id} class={`know${w.endYear === null ? ' is-war' : ''}`}>
                <div class="know-head">
                  <b>
                    <TribeDot hue={w.a.hue} /> {w.a.name} ⚔ <TribeDot hue={w.b.hue} /> {w.b.name}
                  </b>
                  <span class={`chip ${w.endYear === null ? 'chip-hot' : 'chip-cond'}`}>
                    {w.endYear === null ? t('peoples.warNow') : t('peoples.warYears', { from: formatNumber(w.startYear), to: formatNumber(w.endYear) })}
                  </span>
                </div>
                <span class="know-info">{t(`peoples.reason.${w.reason}` as MessageKey)}</span>
                <span class="know-meta mono">
                  {[
                    t('peoples.battles', { n: formatNumber(w.battles) }),
                    t('peoples.fallen', { a: formatNumber(w.dead[0]), b: formatNumber(w.dead[1]) }),
                    w.winner ? t('peoples.winner', { name: w.winner }) : w.endYear !== null ? t('peoples.noWinner') : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {gone.length > 0 && (
        <>
          <h3 class="list-title">{t('peoples.gone')}</h3>
          <ol class="know-list">
            {gone.map((tr) => (
              <li key={tr.id} class="know is-lost">
                <div class="know-head">
                  <b>
                    <TribeDot hue={tr.hue} /> {t('peoples.name', { name: tr.name })}
                  </b>
                  <span class="chip chip-hot">{t('peoples.ended', { from: formatNumber(tr.foundedYear), to: formatNumber(tr.endedYear!) })}</span>
                </div>
              </li>
            ))}
          </ol>
        </>
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
export function ChroniclePanel({ lines, knowledge, species, faith, peoples, planet, epoch, onPerson, onPlace, onClose }: Props) {
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
        {(['chronicle', 'knowledge', 'faith', 'peoples', 'animals'] as Tab[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} class={`tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
            {t(`chron.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <div class="chron-body">
        {tab === 'chronicle' && <ChronicleList lines={lines} planet={planet} epoch={epoch} onPerson={onPerson} />}
        {tab === 'knowledge' && <KnowledgeList items={knowledge} />}
        {tab === 'faith' && <FaithList info={faith} onPerson={onPerson} onPlace={onPlace} />}
        {tab === 'peoples' && <PeoplesList info={peoples} onPerson={onPerson} />}
        {tab === 'animals' && <SpeciesList items={species} />}
      </div>
    </section>
  );
}
