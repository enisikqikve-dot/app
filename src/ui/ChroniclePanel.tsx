import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { Epoch } from '../game/Game';
import type { ChronicleCategory, ChronicleLine, CivTechInfo, FaithInfo, KnowledgeInfo, PeoplesInfo, SpeciesInfo, TribeInfo } from '../game/peopleInfo';
import { chronicleText } from './chronicleText';
import { civName, deityName, geneWords, inventionName, rulerTitle, speciesName } from './names';
import { biomeName } from './format';
import { IconClose } from './icons';

const FILTERS: (ChronicleCategory | 'all')[] = ['all', 'people', 'love', 'death', 'groups', 'conflict', 'civ', 'future', 'knowledge', 'faith', 'animals', 'nature'];
type Tab = 'chronicle' | 'knowledge' | 'faith' | 'peoples' | 'animals';

interface Props {
  lines: ChronicleLine[];
  knowledge: KnowledgeInfo[];
  species: SpeciesInfo[];
  faith: FaithInfo;
  peoples: PeoplesInfo;
  civTech: CivTechInfo[];
  planet: string;
  epoch: Epoch;
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
      <p class="chron-chapter">{t(epoch === 'none' ? 'chron.chapter.paleolithic' : (`chron.chapter.${epoch}` as MessageKey))}</p>
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

function KnowledgeList({ items, civ }: { items: KnowledgeInfo[]; civ: CivTechInfo[] }) {
  const civKnown = civ.some((c) => c.peoples.length > 0 || c.first);
  return (
    <>
      {civKnown && (
        <>
          <h3 class="list-title">{t('know.civTitle')}</h3>
          <p class="note">{t('know.civNote')}</p>
          <ol class="know-list">
            {civ.map((c) => (
              <li key={c.id} class={`know ${c.peoples.length ? 'is-known' : c.first ? 'is-lost' : 'is-unknown'}`}>
                <div class="know-head">
                  <b>{civName(c.id)}</b>
                  {c.peoples.length > 0 ? (
                    <span class="chip chip-gold">{t('know.civPeoples', { n: formatNumber(c.peoples.length) })}</span>
                  ) : (
                    <span class={`chip ${c.first ? 'chip-hot' : 'chip-cond'}`}>{t(c.first ? 'know.status.lost' : 'know.status.unknown')}</span>
                  )}
                </div>
                <span class="know-info">{t(`civInfo.${c.id}` as MessageKey)}</span>
                <span class="know-meta mono">
                  {[
                    c.peoples.length ? c.peoples.map((p) => p.name).join(', ') : '',
                    c.first ? t('know.civFirst', { name: c.first.name, tribe: c.first.tribe, year: formatNumber(c.first.year) }) : '',
                    !c.peoples.length && c.needs.length ? t('know.needs', { list: c.needs.map((n) => civName(n)).join(', ') }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>
          <h3 class="list-title">{t('know.stoneTitle')}</h3>
        </>
      )}
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
        {info.found && <p class="faith-found">{t('faith.found')}</p>}
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

function PeoplesList({ info, onPerson, onPlace }: { info: PeoplesInfo; onPerson: (id: number) => void; onPlace: (cell: number) => void }) {
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
              <span class="chip chip-cond">
                {tr.settlements.length ? t(tr.settlements.length === 1 ? 'peoples.sizeTown' : 'peoples.sizeTowns', { n: formatNumber(tr.total), s: formatNumber(tr.settlements.length) }) : t('peoples.size', { n: formatNumber(tr.population), g: formatNumber(tr.groups) })}
              </span>
            </div>
            <span class="know-info">
              <span class="chip chip-cond epoch-chip">{t(tr.epoch === 'stone' ? 'epoch.paleolithic' : (`epoch.${tr.epoch}` as MessageKey))}</span> <b>{t(`gov.${tr.gov}` as MessageKey)}</b>
              {tr.unrest > 0.45 ? ` · ${t('peoples.unrest')}` : ''}
            </span>
            <span class="know-info">
              {cultureWords(tr.culture)}
              {tr.religion ? ` · ${t('person.believes', { deity: deityName(tr.religion, true) })}` : ''}
            </span>
            <span class="know-meta mono">
              {tr.chief && (
                <>
                  <button type="button" class="link-btn" onClick={() => onPerson(tr.chiefId)}>
                    {rulerTitle(tr.gov, tr.rulerSex)}: {tr.chief}
                  </button>
                  {' · '}
                </>
              )}
              {t(`peoples.origin.${tr.origin}` as MessageKey, { year: formatNumber(tr.foundedYear), parent: tr.parent ?? '?' })}
            </span>
            {tr.laws.length > 0 && <span class="know-meta">{t('peoples.laws', { list: tr.laws.map((l) => t(`lawShort.${l}` as MessageKey)).join(' · ') })}</span>}
            {tr.settlements.length > 0 && (
              <div class="chips tribe-rels">
                {tr.settlements.slice(0, 12).map((h) => (
                  <button key={h.id} type="button" class="chip town-chip" onClick={() => onPlace(h.cell)}>
                    {t(`town.size.${h.size}` as MessageKey)} {h.name} · {formatNumber(h.people)}
                  </button>
                ))}
              </div>
            )}
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
export function ChroniclePanel({ lines, knowledge, species, faith, peoples, civTech, planet, epoch, onPerson, onPlace, onClose }: Props) {
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
        {tab === 'knowledge' && <KnowledgeList items={knowledge} civ={civTech} />}
        {tab === 'faith' && <FaithList info={faith} onPerson={onPerson} onPlace={onPlace} />}
        {tab === 'peoples' && <PeoplesList info={peoples} onPerson={onPerson} onPlace={onPlace} />}
        {tab === 'animals' && <SpeciesList items={species} />}
      </div>
    </section>
  );
}
