import { render } from 'preact';
import './ui/styles.css';
import { App } from './ui/App';
import { Game } from './game/Game';
import { parseSaveData, type SaveData } from './game/saveData';
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

function worldFromLink(): WorldSpec | null {
  try {
    return decodeWorldCode(decodeURIComponent(location.hash.slice(1)));
  } catch {
    return null;
  }
}

/** Which planet to show: 1. a world code in the link, 2. the live-update snapshot, 3. the last save, 4. a new one. */
function chooseWorld(hotData: unknown): { spec: WorldSpec; save: SaveData | null } {
  const fromLink = worldFromLink();
  const save = parseSaveData(hotData) ?? Game.loadSave();
  const saved = save ? decodeWorldCode(save.code) : null;
  if (fromLink && (!saved || saved.seed !== fromLink.seed || saved.size !== fromLink.size)) return { spec: fromLink, save: null };
  if (saved && save) return { spec: saved, save };
  return { spec: { seed: randomSeed(), size: 'medium' }, save: null };
}

let started = false;

function start(hotData: unknown): void {
  if (started) return;
  started = true;
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
  try {
    hot?.snapshot?.(() => game.snapshot());
  } catch {
    /* live updates are optional */
  }

  let choice: { spec: WorldSpec; save: SaveData | null };
  try {
    choice = chooseWorld(hotData);
  } catch {
    choice = { spec: { seed: randomSeed(), size: 'medium' }, save: null };
  }
  const { spec, save } = choice;
  void game.start(spec, save);
}

try {
  if (hot?.ready) hot.ready(start);
  else start(hot?.data ?? null);
} catch {
  start(null);
}
// If the viewer never calls back, start anyway.
setTimeout(() => start(null), 2500);
