import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import salesIcon from '../art/icon-sales.avif';
import { formatCents } from '../lib/format';
import { Surface } from './parts';
import { chartTickLabel, chartTicks, type SeriesPoint } from './model';

const HEIGHT = 280;
// Recharts AreaChart of SalesChart: margin top 10 right 10, a 45px y axis, the x ticks below the plot.
const PAD = { top: 10, right: 10, bottom: 30, left: 45 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Monotone curve through the points (Fritsch-Carlson, the d3 curveMonotoneX Recharts draws). */
export function monotonePath(pts: [number, number][]): string {
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    slope[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0
      ? 0
      : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
  }
  tangent[n - 1] = slope[n - 2];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    d += ` C${pts[i][0] + third},${pts[i][1] + third * tangent[i]} ${pts[i + 1][0] - third},${pts[i + 1][1] - third * tangent[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function Plot({ series, total }: { series: SeriesPoint[]; total: number }) {
  const [box, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const tip = useRef<HTMLDivElement>(null);

  if (!series.length) {
    return <div ref={box} className="chart"><p className="chart-empty">Nenhum dado disponível</p></div>;
  }
  const w = Math.max(1, width - PAD.left - PAD.right);
  const h = HEIGHT - PAD.top - PAD.bottom;
  const ticks = chartTicks(Math.max(...series.map((p) => p.revenue)));
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => PAD.left + (series.length === 1 ? w / 2 : (i / (series.length - 1)) * w);
  const y = (v: number) => PAD.top + h - (v / top) * h;
  const pts = series.map((p, i) => [x(i), y(p.revenue)] as [number, number]);
  const line = monotonePath(pts);
  // interval="preserveStartEnd": first and last always, the rest as room allows.
  const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(w / 48))));

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const rel = (event.clientX - rect.left - PAD.left) / w;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round(rel * (series.length - 1)))));
  };
  const point = hover == null ? null : series[hover];
  const tipWidth = tip.current?.offsetWidth ?? 120;
  const tipLeft = hover == null ? 0 : x(hover) + 12 + tipWidth > width ? Math.max(0, x(hover) - tipWidth - 12) : x(hover) + 12;

  return (
    <div ref={box} className="chart">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`Receita no período: ${formatCents(total)}`}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopOpacity={0.3} />
              <stop offset="95%" stopOpacity={0} />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <text key={tick} className="axis" x={PAD.left - 5} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {chartTickLabel(tick)}
            </text>
          ))}
          {series.map((p, i) => {
            const last = i === series.length - 1;
            if (!last && i % every !== 0) return null;
            if (last && i % every !== 0 && x(i) - x(i - (i % every)) < 40) return null;
            return <text key={p.date || i} className="axis" x={x(i)} y={PAD.top + h + 22} textAnchor="middle">{p.label}</text>;
          })}
          <path className="area" d={`${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} />
          <path className="line" d={line} />
          {point && hover != null && <circle className="dot" r={6} cx={x(hover)} cy={y(point.revenue)} />}
          <rect x={PAD.left - 6} y={0} width={w + 12} height={HEIGHT} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {point && hover != null && (
        <div ref={tip} className="tip" style={{ left: tipLeft, top: Math.max(0, y(point.revenue) - 24) }}>
          <p className="tip-value">{formatCents(point.revenue)}</p>
          <p className="tip-label">{point.label}</p>
        </div>
      )}
    </div>
  );
}

/** SalesChart of the seller dashboard: revenue in the period. */
export function SalesChart({ series, revenue }: { series: SeriesPoint[]; revenue: number }) {
  return (
    <Surface className="analytics chart-card art-sales-chart">
      <header className="chart-head">
        <span className="chart-icon"><img src={salesIcon} alt="" /></span>
        <div>
          <h3 className="card-title">Vendas</h3>
          <p className="card-sub">Receita no período selecionado</p>
        </div>
      </header>
      <div className="chart-body">
        <div className="chart-summary"><span className="chart-total num">{formatCents(revenue)}</span></div>
        <Plot series={series} total={revenue} />
      </div>
    </Surface>
  );
}
