import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { StatsInfo } from '../game/peopleInfo';
import { IconClose } from './icons';

/** The measures shown, in order (index into a history row) and how to write them. */
const CHARTS: { field: string; unit?: '%' }[] = [
  { field: 'population' },
  { field: 'peoples' },
  { field: 'settlements' },
  { field: 'knowledge' },
  { field: 'believers', unit: '%' },
  { field: 'wars' },
  { field: 'inequality', unit: '%' },
  { field: 'price' },
];

const W = 300;
const H = 96;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 8;
const PAD_B = 18;
const MAX_POINTS = 240;

interface Series {
  field: string;
  unit?: '%';
  years: number[];
  values: number[];
  max: number;
}

/** Every year, or every n-th year for long histories (the last year is always kept). */
function sample(rows: number[][]): number[][] {
  if (rows.length <= MAX_POINTS) return rows;
  const step = Math.ceil(rows.length / MAX_POINTS);
  const out = rows.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== rows[rows.length - 1]) out.push(rows[rows.length - 1]);
  return out;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

function fmt(v: number, unit?: '%'): string {
  return unit === '%' ? `${formatNumber(Math.round(v))} %` : formatNumber(Math.round(v));
}

function Chart({ s, hover, onHover }: { s: Series; hover: number | null; onHover: (i: number | null) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const n = s.values.length;
  const x = (i: number) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD_L - PAD_R));
  const y = (v: number) => PAD_T + (1 - v / s.max) * (H - PAD_T - PAD_B);
  const path = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || n === 0) return;
    const fx = ((clientX - box.left) / box.width) * W;
    onHover(Math.max(0, Math.min(n - 1, Math.round(((fx - PAD_L) / (W - PAD_L - PAD_R)) * (n - 1)))));
  };
  const last = s.values[n - 1] ?? 0;
  const at = hover !== null && hover < n ? hover : null;
  const title = t(`stats.${s.field}` as MessageKey);
  return (
    <figure class="stat-chart">
      <figcaption>
        <span>{title}</span>
        <b class="mono">{at !== null ? fmt(s.values[at], s.unit) : fmt(last, s.unit)}</b>
      </figcaption>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}: ${fmt(last, s.unit)}`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => onHover(null)}
      >
        <line class="stat-grid" x1={PAD_L} x2={W - PAD_R} y1={y(s.max)} y2={y(s.max)} />
        <line class="stat-grid" x1={PAD_L} x2={W - PAD_R} y1={y(s.max / 2)} y2={y(s.max / 2)} />
        <line class="stat-axis" x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} />
        <text class="stat-tick" x={PAD_L} y={y(s.max) - 2}>
          {fmt(s.max, s.unit)}
        </text>
        {n > 0 && (
          <>
            <text class="stat-tick" x={PAD_L} y={H - 4}>
              {t('top.year', { year: formatNumber(s.years[0]) })}
            </text>
            <text class="stat-tick" x={W - PAD_R} y={H - 4} text-anchor="end">
              {t('top.year', { year: formatNumber(s.years[n - 1]) })}
            </text>
          </>
        )}
        <path class="stat-line" d={path} />
        {at !== null && (
          <>
            <line class="stat-cross" x1={x(at)} x2={x(at)} y1={PAD_T} y2={y(0)} />
            <circle class="stat-dot" cx={x(at)} cy={y(s.values[at])} r={4} />
          </>
        )}
      </svg>
    </figure>
  );
}

/** Statistics: how the world changed, year by year. */
export function StatsPanel({ stats, onClose }: { stats: StatsInfo; onClose: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const rows = useMemo(() => sample(stats.rows), [stats.rows.length]);
  const col = (f: string) => stats.fields.indexOf(f);
  const years = rows.map((r) => r[0]);
  const series: Series[] = CHARTS.map((c) => {
    const i = col(c.field);
    const values = rows.map((r) => r[i] ?? 0);
    return { ...c, years, values, max: niceMax(Math.max(0, ...values)) };
  });
  const hoverYear = hover !== null && hover < years.length ? years[hover] : null;
  return (
    <section class="chronicle stats glass-strong" aria-labelledby="stats-title">
      <div class="place-head">
        <h2 id="stats-title" class="panel-title">
          {t('stats.title')}
        </h2>
        <button ref={closeRef} type="button" class="icon-btn small" aria-label={t('menu.close')} onClick={onClose}>
          <IconClose size={18} />
        </button>
      </div>
      <div class="chips" role="group">
        <button type="button" class={`option${!table ? ' is-active' : ''}`} aria-pressed={!table} onClick={() => setTable(false)}>
          {t('stats.charts')}
        </button>
        <button type="button" class={`option${table ? ' is-active' : ''}`} aria-pressed={table} onClick={() => setTable(true)}>
          {t('stats.table')}
        </button>
        {hoverYear !== null && !table && <span class="chip chip-cond mono">{t('top.year', { year: formatNumber(hoverYear) })}</span>}
      </div>
      <div class="chron-body">
        {rows.length < 2 ? (
          <p class="place-text">{t('stats.empty')}</p>
        ) : table ? (
          <div class="stat-table-wrap">
            <table class="stat-table mono">
              <thead>
                <tr>
                  <th>{t('stats.year')}</th>
                  {CHARTS.map((c) => (
                    <th key={c.field}>{t(`stats.${c.field}` as MessageKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .reverse()
                  .slice(0, 60)
                  .map((r) => (
                    <tr key={r[0]}>
                      <td>{formatNumber(r[0])}</td>
                      {CHARTS.map((c) => (
                        <td key={c.field}>{fmt(r[col(c.field)] ?? 0, c.unit)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="stat-grid-wrap">
            {series.map((s) => (
              <Chart key={s.field} s={s} hover={hover} onHover={setHover} />
            ))}
          </div>
        )}
        <p class="note">{t('stats.note')}</p>
      </div>
    </section>
  );
}
