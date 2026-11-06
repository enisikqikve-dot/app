import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from '../game/Game';
import { safeStorage } from '../core/store';
import { randomSeed } from '../core/rng';
import { setLang, t, type Lang, type MessageKey } from '../i18n';
import { POWER_OPTIONS, powerDef, type PowerCategory, type PowerKind } from '../sim/powers';
import { SPECIES_IDS } from '../sim/life/species';
import { useStore } from './useStore';
import { TopBar } from './TopBar';
import { PowersRail } from './PowersRail';
import { PowerPalette, POWER_ICONS } from './PowerPalette';
import { RewindPanel } from './RewindPanel';
import { PlacePanel } from './PlacePanel';
import { HerdPanel, PersonPanel } from './LifePanels';
import { FamilyTreeView } from './FamilyTree';
import { ChroniclePanel } from './ChroniclePanel';
import { chronicleText } from './chronicleText';
import { inventionName } from './names';
import { SkipBar, SkipMenu, SkipSummaryPanel } from './SkipPanels';
import { Menu } from './Menu';
import { IconMinus, IconPlus } from './icons';

const WELCOME_KEY = 'enis.welcomed';

function armedHint(kind: PowerKind, step: 'pick' | 'place' | 'pick2' | null): MessageKey {
  const target = powerDef(kind).target;
  if (target === 'brush') return 'armed.brush';
  if (target === 'person') return 'armed.person';
  if (target === 'dead') return 'armed.dead';
  if (target === 'carry') return step === 'place' ? 'armed.carryPlace' : 'armed.carryPick';
  if (target === 'pair') return step === 'pick2' ? 'armed.pairPick2' : 'armed.pairPick';
  return 'armed.point';
}

function optionLabel(kind: PowerKind, value: number): string {
  if (kind === 'spawnAnimals') return value >= SPECIES_IDS.length ? t('option.newSpecies') : t(`speciesOne.${SPECIES_IDS[value]}` as MessageKey);
  if (kind === 'sign') return t(`option.sign.${value}` as MessageKey);
  return String(value);
}

export function App({ game }: { game: Game }) {
  const ui = useStore(game.ui);
  const [, setLangTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [palette, setPalette] = useState<PowerCategory | null>(null);
  /** A person whose file opened the palette: powers then act on them directly. */
  const [paletteFor, setPaletteFor] = useState<number | null>(null);
  const [rewindOpen, setRewindOpen] = useState(false);
  const [treeFor, setTreeFor] = useState<number | null>(null);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [welcome, setWelcome] = useState(() => safeStorage.get(WELCOME_KEY) !== '1');
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const toastTimer = useRef<number>(0);
  const wasTimelapse = useRef(ui.timelapse);

  const showToast = (text: string, ms = 3600) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };

  // Explain the steady light once timelapse starts.
  useEffect(() => {
    if (ui.timelapse && !wasTimelapse.current && ui.ready) showToast(t('hint.timelapse'));
    wasTimelapse.current = ui.timelapse;
  }, [ui.timelapse]);

  // Messages from the game (ice age started, a child was born …).
  useEffect(() => {
    const n = ui.notice;
    if (!n) return;
    if (n.line) showToast(chronicleText(n.line, ui.planetName), 5200);
    else if (n.key) {
      const params = n.params && typeof n.params.invention === 'string' ? { ...n.params, invention: inventionName(n.params.invention) } : n.params;
      showToast(t(n.key, params), 5200);
    }
  }, [ui.notice?.id]);

  // Keep the world code in the link so it can be shared.
  useEffect(() => {
    if (!ui.worldCode) return;
    try {
      history.replaceState(null, '', `#${ui.worldCode}`);
    } catch {
      /* not allowed here */
    }
  }, [ui.worldCode]);

  const closePalette = () => {
    setPalette(null);
    setPaletteFor(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menuOpen || rewindOpen) return;
      if (treeFor !== null) setTreeFor(null);
      else if (skipOpen) setSkipOpen(false);
      else if (ui.skipSummary) game.closeSkipSummary();
      else if (chronicleOpen) setChronicleOpen(false);
      else if (ui.armed) game.arm(null);
      else if (palette) closePalette();
      else game.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, rewindOpen, palette, ui.armed, treeFor, chronicleOpen, skipOpen, ui.skipSummary]);

  const dismissWelcome = () => {
    setWelcome(false);
    safeStorage.set(WELCOME_KEY, '1');
  };

  const changeLang = (lang: Lang) => {
    setLang(lang);
    setLangTick((n) => n + 1);
  };

  const pickPower = (kind: PowerKind) => {
    dismissWelcome();
    const target = powerDef(kind).target;
    // Opened from someone's file: the power acts on that person right away.
    if (paletteFor !== null && target !== 'brush' && target !== 'carry') {
      const id = paletteFor;
      closePalette();
      game.castOn(kind, id);
      return;
    }
    if (ui.armed === kind) {
      game.arm(null);
      return;
    }
    if (target !== 'person' && target !== 'dead' && target !== 'carry' && target !== 'pair') game.clearSelection();
    game.arm(kind);
    // On small screens the palette would cover the planet while aiming.
    if (target !== 'global' && window.innerWidth < 640) closePalette();
  };

  const openPerson = (id: number) => {
    setChronicleOpen(false);
    setTreeFor(null);
    game.selectPerson(id);
  };

  const ArmedIcon = ui.armed ? POWER_ICONS[ui.armed] : null;
  const options = ui.armed ? POWER_OPTIONS[ui.armed] : undefined;
  const overlay = treeFor !== null || chronicleOpen || skipOpen || ui.skipSummary !== null || ui.skip !== null;
  const showPanels = !ui.armed && !rewindOpen && !overlay;
  const tree = treeFor !== null ? game.familyTree(treeFor) : null;

  return (
    <div class="hud">
      {ui.ready && (
        <>
          <TopBar
            ui={ui}
            rewindOpen={rewindOpen}
            chronicleOpen={chronicleOpen}
            skipOpen={skipOpen}
            onSkip={() => {
              setChronicleOpen(false);
              setRewindOpen(false);
              setSkipOpen((open) => !open);
            }}
            onSpeed={(i) => game.setSpeed(i)}
            onMenu={() => setMenuOpen(true)}
            onRewind={() => setRewindOpen((open) => !open)}
            onSound={() => game.setSound(!ui.soundOn)}
            onChronicle={() => {
              setTreeFor(null);
              setChronicleOpen((open) => !open);
            }}
          />
          <PowersRail
            open={palette}
            onOpen={(category) => {
              if (ui.skip) return;
              dismissWelcome();
              setPaletteFor(null);
              setPalette((open) => (open === category ? null : category));
            }}
            onLocked={(text) => showToast(text)}
          />
          {palette && (
            <PowerPalette
              category={palette}
              armed={ui.armed}
              forName={paletteFor !== null && ui.person?.id === paletteFor ? ui.person.name : null}
              onPick={pickPower}
            />
          )}
          {showPanels && ui.person && (
            <PersonPanel
              person={ui.person}
              following={ui.following}
              onFollow={(on) => game.follow(on)}
              onClose={() => game.clearSelection()}
              onWhisper={() => {
                setPaletteFor(ui.person!.id);
                setPalette('whisper');
              }}
              onBless={() => {
                setPaletteFor(ui.person!.id);
                setPalette('blessing');
              }}
              onTree={() => setTreeFor(ui.person!.id)}
              onPerson={openPerson}
            />
          )}
          {showPanels && ui.herd && <HerdPanel herd={ui.herd} onClose={() => game.clearSelection()} />}
          {showPanels && ui.place && <PlacePanel place={ui.place} onClose={() => game.clearSelection()} />}
          {tree && <FamilyTreeView tree={tree} onFocus={(id) => setTreeFor(id)} onOpen={openPerson} onClose={() => setTreeFor(null)} />}
          {chronicleOpen && (
            <ChroniclePanel
              lines={game.chronicleLines()}
              knowledge={game.knowledge()}
              species={game.speciesList()}
              faith={game.faithInfo()}
              planet={ui.planetName}
              epoch={ui.epoch}
              onPerson={openPerson}
              onPlace={(cell) => {
                setChronicleOpen(false);
                game.showCell(cell);
              }}
              onClose={() => setChronicleOpen(false)}
            />
          )}
          {skipOpen && !ui.skip && (
            <SkipMenu
              onClose={() => setSkipOpen(false)}
              onPick={(years) => {
                setSkipOpen(false);
                closePalette();
                game.timeSkip(years);
              }}
            />
          )}
          {ui.skip && <SkipBar skip={ui.skip} onStop={() => game.stopSkip()} />}
          {ui.skipSummary && !ui.skip && (
            <SkipSummaryPanel
              summary={ui.skipSummary}
              planet={ui.planetName}
              onPerson={(id) => {
                game.closeSkipSummary();
                openPerson(id);
              }}
              onClose={() => game.closeSkipSummary()}
            />
          )}
          {rewindOpen && (
            <RewindPanel
              points={game.rewindPoints()}
              onClose={() => setRewindOpen(false)}
              onPick={(p) => {
                setRewindOpen(false);
                game.rewindTo(p);
              }}
            />
          )}
          {ui.armed && ArmedIcon && (
            <div class="armed glass-strong" role="status">
              <span class="armed-icon">
                <ArmedIcon size={20} />
              </span>
              <span class="armed-text">
                <b>{t(`power.${ui.armed}` as MessageKey)}</b>
                <span>{t(armedHint(ui.armed, ui.carryStep))}</span>
                {options && (
                  <span
                    class="armed-options"
                    role="group"
                    aria-label={t(ui.armed === 'spawnAnimals' ? 'option.which' : ui.armed === 'sign' ? 'option.sign' : 'option.howMany')}
                  >
                    {options.map((value) => (
                      <button
                        key={value}
                        type="button"
                        class={`option${ui.armedOption === value ? ' is-active' : ''}`}
                        aria-pressed={ui.armedOption === value}
                        onClick={() => game.setArmedOption(value)}
                      >
                        {optionLabel(ui.armed!, value)}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              <button type="button" class="btn" onClick={() => game.arm(null)}>
                {t('armed.cancel')}
              </button>
            </div>
          )}
          <div class="zoom glass" role="group">
            <button type="button" class="icon-btn" aria-label="Zoom +" onClick={() => game.zoomBy(0.6)}>
              <IconPlus size={18} />
            </button>
            <button type="button" class="icon-btn" aria-label="Zoom −" onClick={() => game.zoomBy(1.6)}>
              <IconMinus size={18} />
            </button>
          </div>
          {welcome && !ui.place && !ui.person && !ui.herd && !palette && !ui.armed && !overlay && (
            <section class="welcome glass" aria-labelledby="welcome-title">
              <h2 id="welcome-title">{t('welcome.title')}</h2>
              <p>{t('welcome.text', { name: ui.planetName })}</p>
              <p class="muted">{t('welcome.tip')}</p>
              <button type="button" class="btn btn-primary" onClick={dismissWelcome}>
                {t('welcome.ok')}
              </button>
            </section>
          )}
        </>
      )}

      {toast && (
        <div class="toast glass-strong" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}

      {ui.error && !ui.loading && (
        <div class="loading" role="alert">
          <span class="loading-orb is-broken" aria-hidden="true" />
          <p class="error-title">{t('app.error')}</p>
          <p class="error-detail mono">{ui.error}</p>
          <button type="button" class="btn btn-primary" onClick={() => void game.start({ seed: randomSeed(), size: 'small' }, null)}>
            {t('app.retry')}
          </button>
        </div>
      )}

      {ui.loading && (
        <div class={`loading${ui.ready ? ' is-over' : ''}`} role="status">
          <span class="loading-orb" aria-hidden="true" />
          <span>{t('app.loading')}</span>
        </div>
      )}

      {menuOpen && (
        <Menu
          ui={ui}
          onClose={() => setMenuOpen(false)}
          onLang={changeLang}
          onCreate={(spec) => {
            setMenuOpen(false);
            void game.start(spec, null);
          }}
        />
      )}
    </div>
  );
}
