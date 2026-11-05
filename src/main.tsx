import { render } from 'preact';
import './ui/styles.css';
import { App } from './ui/App';
import { Game, type SaveData } from './game/Game';
import { decodeWorldCode, type WorldSpec } from './core/worldCode';
import { randomSeed } from './core/rng';
import { getLang, setLang, t } from './i18n';

interface HotApi {
  ready?: (start: (data: unknown) => void) => void;
  data?: unknown;
  snapshot?: (fn: () => unknown) => void;
}

const hot: HotApi | undefined = (window as unknown as { claude?: { hot?: HotApi } }).claude?.hot;

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

function start(hotData: unknown): void {
  setLang(getLang());
  const root = document.getElementById('app')!;

  if (!webglAvailable()) {
    root.innerHTML = `<div class="fatal"><p>${t('app.webglError')}</p></div>`;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'world';
  canvas.setAttribute('aria-label', 'eNis');
  root.appendChild(canvas);
  const uiRoot = document.createElement('div');
  uiRoot.className = 'ui-root';
  root.appendChild(uiRoot);

  const game = new Game(canvas);
  // Handle for automated browser tests.
  (window as unknown as { __enisGame?: Game }).__enisGame = game;
  render(<App game={game} />, uiRoot);
  hot?.snapshot?.(() => game.snapshot());

  // Which planet? 1. a world code in the link, 2. the live-update snapshot, 3. the last save, 4. a new one.
  const fromHash = decodeWorldCode(decodeURIComponent(location.hash.slice(1)));
  const restored = (hotData as SaveData | null) ?? Game.loadSave();
  const restoredSpec = restored ? decodeWorldCode(restored.code) : null;
  let spec: WorldSpec;
  let minutes: number | undefined;
  if (fromHash && (!restoredSpec || restoredSpec.seed !== fromHash.seed || restoredSpec.size !== fromHash.size)) {
    spec = fromHash;
  } else if (restoredSpec && restored) {
    spec = restoredSpec;
    minutes = restored.minutes;
  } else {
    spec = { seed: randomSeed(), size: 'medium' };
  }
  void game.createWorld(spec, minutes, restored?.speedIndex === 0 ? 1 : restored?.speedIndex);
}

if (hot?.ready) hot.ready(start);
else start(hot?.data ?? null);
