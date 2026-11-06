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
import { Menu } from './Menu';
import { IconMinus, IconPlus } from './icons';

const WELCOME_KEY = 'enis.welcomed';

function armedHint(kind: PowerKind, carryStep: 'pick' | 'place' | null): MessageKey {
  const target = powerDef(kind).target;
  if (target === 'brush') return 'armed.brush';
  if (target === 'person') return 'armed.person';
  if (target === 'dead') return 'armed.dead';
  if (target === 'carry') return carryStep === 'place' ? 'armed.carryPlace' : 'armed.carryPick';
  return 'armed.point';
}

export function App({ game }: { game: Game }) {
  const ui = useStore(game.ui);
  const [, setLangTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [palette, setPalette] = useState<PowerCategory | null>(null);
  const [rewindOpen, setRewindOpen] = useState(false);
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

  // Messages from the game (ice age started, rewound …).
  useEffect(() => {
    if (ui.notice) showToast(t(ui.notice.key), 5200);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menuOpen || rewindOpen) return;
      if (ui.armed) game.arm(null);
      else if (palette) setPalette(null);
      else game.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, rewindOpen, palette, ui.armed]);

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
    if (ui.armed === kind) {
      game.arm(null);
      return;
    }
    if (powerDef(kind).target !== 'person' && powerDef(kind).target !== 'dead' && powerDef(kind).target !== 'carry') game.clearSelection();
    game.arm(kind);
    // On small screens the palette would cover the planet while aiming.
    if (powerDef(kind).target !== 'global' && window.innerWidth < 640) setPalette(null);
  };

  const ArmedIcon = ui.armed ? POWER_ICONS[ui.armed] : null;
  const options = ui.armed ? POWER_OPTIONS[ui.armed] : undefined;
  const showPanels = !ui.armed && !rewindOpen;

  return (
    <div class="hud">
      {ui.ready && (
        <>
          <TopBar
            ui={ui}
            rewindOpen={rewindOpen}
            onSpeed={(i) => game.setSpeed(i)}
            onMenu={() => setMenuOpen(true)}
            onRewind={() => setRewindOpen((open) => !open)}
            onSound={() => game.setSound(!ui.soundOn)}
          />
          <PowersRail
            open={palette}
            onOpen={(category) => {
              dismissWelcome();
              setPalette((open) => (open === category ? null : category));
            }}
            onLocked={(text) => showToast(text)}
          />
          {palette && <PowerPalette category={palette} armed={ui.armed} onPick={pickPower} />}
          {showPanels && ui.person && (
            <PersonPanel person={ui.person} following={ui.following} onFollow={(on) => game.follow(on)} onClose={() => game.clearSelection()} />
          )}
          {showPanels && ui.herd && <HerdPanel herd={ui.herd} onClose={() => game.clearSelection()} />}
          {showPanels && ui.place && <PlacePanel place={ui.place} onClose={() => game.clearSelection()} />}
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
                  <span class="armed-options" role="group" aria-label={t(ui.armed === 'spawnAnimals' ? 'option.which' : 'option.howMany')}>
                    {options.map((value) => (
                      <button
                        key={value}
                        type="button"
                        class={`option${ui.armedOption === value ? ' is-active' : ''}`}
                        aria-pressed={ui.armedOption === value}
                        onClick={() => game.setArmedOption(value)}
                      >
                        {ui.armed === 'spawnAnimals' ? t(`speciesOne.${SPECIES_IDS[value]}` as MessageKey) : value}
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
          {welcome && !ui.place && !ui.person && !ui.herd && !palette && !ui.armed && (
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
