import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from '../game/Game';
import { safeStorage } from '../core/store';
import { setLang, t, type Lang } from '../i18n';
import { useStore } from './useStore';
import { TopBar } from './TopBar';
import { PowersRail } from './PowersRail';
import { PlacePanel } from './PlacePanel';
import { Menu } from './Menu';
import { IconMinus, IconPlus } from './icons';

const WELCOME_KEY = 'enis.welcomed';

export function App({ game }: { game: Game }) {
  const ui = useStore(game.ui);
  const [, setLangTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcome, setWelcome] = useState(() => safeStorage.get(WELCOME_KEY) !== '1');
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const toastTimer = useRef<number>(0);
  const wasTimelapse = useRef(ui.timelapse);

  const showToast = (text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  // Explain the steady light once timelapse starts.
  useEffect(() => {
    if (ui.timelapse && !wasTimelapse.current && ui.ready) showToast(t('hint.timelapse'));
    wasTimelapse.current = ui.timelapse;
  }, [ui.timelapse]);

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
      if (e.key === 'Escape' && !menuOpen) game.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const dismissWelcome = () => {
    setWelcome(false);
    safeStorage.set(WELCOME_KEY, '1');
  };

  const changeLang = (lang: Lang) => {
    setLang(lang);
    setLangTick((n) => n + 1);
  };

  return (
    <div class="hud">
      {ui.ready && (
        <>
          <TopBar ui={ui} onSpeed={(i) => game.setSpeed(i)} onMenu={() => setMenuOpen(true)} />
          <PowersRail onLocked={showToast} />
          {ui.place && <PlacePanel place={ui.place} onClose={() => game.clearSelection()} />}
          <div class="zoom glass" role="group">
            <button type="button" class="icon-btn" aria-label="Zoom +" onClick={() => game.zoomBy(0.6)}>
              <IconPlus size={18} />
            </button>
            <button type="button" class="icon-btn" aria-label="Zoom −" onClick={() => game.zoomBy(1.6)}>
              <IconMinus size={18} />
            </button>
          </div>
          {welcome && !ui.place && (
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
            void game.createWorld(spec);
          }}
        />
      )}
    </div>
  );
}
