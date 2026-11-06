import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, getLang, LANGS, t, type Lang } from '../i18n';
import { decodeWorldCode, encodeWorldCode, PLANET_SIZES, type PlanetSize, type WorldSpec } from '../core/worldCode';
import { randomSeed } from '../core/rng';
import { PLANET_PRESETS } from '../sim/planet/generate';
import type { UiState } from '../game/Game';
import { IconClose, IconCopy, IconDice } from './icons';

interface Props {
  ui: UiState;
  onClose: () => void;
  onCreate: (spec: WorldSpec) => void;
  onLang: (lang: Lang) => void;
  onMusic: (on: boolean) => void;
  onFilm: () => void;
  onExport: () => Promise<'saved' | 'declined' | 'failed'>;
  onImport: (text: string) => Promise<boolean>;
  onHistoryCode: () => Promise<string | null>;
  onHistoryLoad: (code: string) => Promise<boolean>;
}

const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' };

export function Menu({ ui, onClose, onCreate, onLang, onMusic, onFilm, onExport, onImport, onHistoryCode, onHistoryLoad }: Props) {
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [history, setHistory] = useState('');
  const [historyOut, setHistoryOut] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportFile = async () => {
    const r = await onExport();
    setShareNote(t(r === 'saved' ? 'share.saved' : r === 'declined' ? 'share.declined' : 'share.failed'));
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const ok = await onImport(await file.text());
    if (!ok) setShareNote(t('share.badFile'));
  };
  const copyHistory = async () => {
    const code = await onHistoryCode();
    if (!code) {
      setShareNote(t('share.failed'));
      return;
    }
    setHistoryOut(code);
    try {
      await navigator.clipboard.writeText(code);
      setShareNote(t('share.codeCopied', { n: formatNumber(code.length) }));
    } catch {
      setShareNote(t('share.codeShown'));
    }
  };
  const loadHistory = async () => {
    const ok = await onHistoryLoad(history);
    if (!ok) setShareNote(t('share.badCode'));
  };
  const [size, setSize] = useState<PlanetSize>(ui.size);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const codeRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCodeInput = (value: string) => {
    setCode(value);
    setError(false);
    const parsed = decodeWorldCode(value);
    if (parsed) setSize(parsed.size);
  };

  const create = (e: Event) => {
    e.preventDefault();
    if (code.trim()) {
      const parsed = decodeWorldCode(code);
      if (!parsed) {
        setError(true);
        return;
      }
      onCreate(parsed);
    } else {
      onCreate({ seed: randomSeed(), size });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ui.worldCode);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
      const el = codeRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    setTimeout(() => setCopyState('idle'), 2200);
  };

  return (
    <div class="menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="menu glass-strong" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <div class="menu-head">
          <h2 id="menu-title">{t('menu.title')}</h2>
          <button ref={closeRef} type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        <section class="menu-section">
          <h3>{t('menu.thisPlanet')}</h3>
          <p class="menu-planet">
            <span class="menu-planet-name">{ui.planetName}</span>
            <span class="muted">{t('menu.radius', { km: formatNumber(ui.radiusKm) })}</span>
          </p>
          <div class="code-row">
            <span ref={codeRef} class="code mono">
              {ui.worldCode}
            </span>
            <button type="button" class="btn" onClick={copy}>
              <IconCopy size={16} />
              {copyState === 'copied' ? t('menu.copied') : t('menu.copy')}
            </button>
          </div>
          <p class="note">{copyState === 'failed' ? t('menu.copyFailed') : t('menu.shareNote')}</p>
        </section>

        <form class="menu-section" onSubmit={create}>
          <h3>{t('menu.newPlanet')}</h3>
          <span class="label" id="size-label">
            {t('menu.size')}
          </span>
          <div class="segmented" role="group" aria-labelledby="size-label">
            {PLANET_SIZES.map((s) => (
              <button
                key={s}
                id={`size-${s}`}
                type="button"
                class={size === s ? 'is-active' : ''}
                aria-pressed={size === s}
                onClick={() => {
                  setSize(s);
                  const parsed = decodeWorldCode(code);
                  if (parsed && parsed.size !== s) setCode(encodeWorldCode({ seed: parsed.seed, size: s }));
                }}
              >
                <span>{t(`menu.size.${s}`)}</span>
                <span class="mono muted">{formatNumber(PLANET_PRESETS[s].radiusKm)} km</span>
              </button>
            ))}
          </div>
          <label class="label" for="world-code">
            {t('menu.worldCode')}
          </label>
          <div class="code-row">
            <input
              id="world-code"
              class={`input mono${error ? ' has-error' : ''}`}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellcheck={false}
              placeholder={t('menu.worldCodePlaceholder')}
              value={code}
              aria-invalid={error}
              aria-describedby={error ? 'code-error' : undefined}
              onInput={(e) => onCodeInput((e.target as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="btn"
              title={t('menu.random')}
              onClick={() => onCodeInput(encodeWorldCode({ seed: randomSeed(), size }))}
            >
              <IconDice size={16} />
              <span class="hide-narrow">{t('menu.random')}</span>
            </button>
          </div>
          {error && (
            <p class="error" id="code-error">
              {t('menu.invalidCode')}
            </p>
          )}
          <button type="submit" class="btn btn-primary">
            {t('menu.create')}
          </button>
          <p class="note">{t('menu.replaceNote')}</p>
        </form>

        <section class="menu-section">
          <h3>{t('share.title')}</h3>
          <div class="share-row">
            <button type="button" class="btn" onClick={() => void exportFile()}>
              {t('share.saveFile')}
            </button>
            <button type="button" class="btn" onClick={() => fileRef.current?.click()}>
              {t('share.loadFile')}
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" class="visually-hidden" onChange={(e) => void importFile((e.target as HTMLInputElement).files?.[0])} />
            <button type="button" class="btn" onClick={() => void copyHistory()}>
              {t('share.copyCode')}
            </button>
          </div>
          {historyOut && <textarea class="input mono share-code" readOnly rows={3} value={historyOut} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />}
          <div class="code-row">
            <input
              class="input mono"
              type="text"
              autoComplete="off"
              spellcheck={false}
              placeholder={t('share.codePlaceholder')}
              value={history}
              aria-label={t('share.codePlaceholder')}
              onInput={(e) => setHistory((e.target as HTMLInputElement).value)}
            />
            <button type="button" class="btn" disabled={!history.trim()} onClick={() => void loadHistory()}>
              {t('share.loadCode')}
            </button>
          </div>
          <p class="note">{shareNote ?? t('share.note')}</p>
        </section>

        <section class="menu-section">
          <h3>{t('menu.extras')}</h3>
          <div class="share-row">
            <button type="button" class={`btn${ui.musicOn ? ' btn-primary' : ''}`} aria-pressed={ui.musicOn} onClick={() => onMusic(!ui.musicOn)}>
              {ui.musicOn ? t('music.on') : t('music.off')}
            </button>
            <button type="button" class="btn" onClick={onFilm}>
              {t('film.start')}
            </button>
          </div>
          <p class="note">{t('menu.extrasNote')}</p>
        </section>

        <section class="menu-section">
          <h3>{t('menu.language')}</h3>
          <div class="segmented" role="group" aria-label={t('menu.language')}>
            {LANGS.map((lang) => (
              <button
                key={lang}
                id={`lang-${lang}`}
                type="button"
                class={getLang() === lang ? 'is-active' : ''}
                aria-pressed={getLang() === lang}
                onClick={() => onLang(lang)}
              >
                {LANG_NAMES[lang]}
              </button>
            ))}
          </div>
        </section>

        <section class="menu-section">
          <h3>{t('menu.controls')}</h3>
          <div class="controls-grid">
            <div>
              <h4>{t('controls.mouse')}</h4>
              <ul>
                <li>{t('controls.mouse.rotate')}</li>
                <li>{t('controls.mouse.zoom')}</li>
                <li>{t('controls.mouse.tilt')}</li>
                <li>{t('controls.mouse.select')}</li>
              </ul>
            </div>
            <div>
              <h4>{t('controls.touch')}</h4>
              <ul>
                <li>{t('controls.touch.rotate')}</li>
                <li>{t('controls.touch.zoom')}</li>
                <li>{t('controls.touch.tilt')}</li>
                <li>{t('controls.touch.select')}</li>
              </ul>
            </div>
            <div>
              <h4>{t('controls.keys')}</h4>
              <ul>
                <li>{t('controls.keys.move')}</li>
                <li>{t('controls.keys.turn')}</li>
                <li>{t('controls.keys.pause')}</li>
                <li>{t('controls.keys.cancel')}</li>
              </ul>
            </div>
          </div>
        </section>

        <p class="menu-foot muted">{t('menu.version')}</p>
      </div>
    </div>
  );
}
