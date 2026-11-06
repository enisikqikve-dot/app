import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from '../game/Game';
import { safeStorage } from '../core/store';
import { randomSeed } from '../core/rng';
import { setLang, t, type Lang, type MessageKey } from '../i18n';
import { powerDef, type PowerKind } from '../sim/powers';
import { useStore } from './useStore';
import { TopBar } from './TopBar';
import { PowersRail } from './PowersRail';
import { PowerPalette, POWER_ICONS } from './PowerPalette';
import { RewindPanel } from './RewindPanel';
import { PlacePanel } from './PlacePanel';
import { Menu } from './Menu';
import { IconMinus, IconPlus } from './icons';

const WELCOME_KEY = 'enis.welcomed';

export function App({ game }: { game: Game }) {
  const ui = useStore(game.ui);
  const [, setLangTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
      else if (paletteOpen) setPaletteOpen(false);
      else game.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, rewindOpen, paletteOpen, ui.armed]);

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
    game.clearSelection();
    game.arm(kind);
    // On small screens the palette would cover the planet while aiming.
    if (powerDef(kind).target !== 'global' && window.innerWidth < 640) setPaletteOpen(false);
  };

  const ArmedIcon = ui.armed ? POWER_ICONS[ui.armed] : null;

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
            natureOpen={paletteOpen}
            onNature={() => {
              dismissWelcome();
              setPaletteOpen((open) => !open);
            }}
            onLocked={(text) => showToast(text)}
          />
          {paletteOpen && <PowerPalette armed={ui.armed} onPick={pickPower} />}
          {ui.place && !ui.armed && !rewindOpen && <PlacePanel place={ui.place} onClose={() => game.clearSelection()} />}
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
                <span>{powerDef(ui.armed).target === 'brush' ? t('armed.brush') : t('armed.point')}</span>
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
          {welcome && !ui.place && !paletteOpen && !ui.armed && (
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

